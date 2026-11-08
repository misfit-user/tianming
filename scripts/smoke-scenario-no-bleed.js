// smoke-scenario-no-bleed.js
// 验证「载入绍宋却混入天启人物/地图/军队/官制」的串台漏洞已修。
// 用真官方剧本内建数据的绍宋(真缺 government/military/map/mapData/mapRuntimeContract)+天启数据,
// 模拟「上一局玩天启→P 残留天启的这些字段→本局开绍宋」,对照「无修(复现漏洞)」vs「有修(本次补丁)」。
// 应用逻辑严格照 tm-patches.js doActualStart 的真实片段(if(sc.X) P.X=...; 官制 government 覆盖; 地图绑定; GM.armies 派生)。
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } }
const clone = (x) => JSON.parse(JSON.stringify(x));

// 载入真内建（web/scenarios/*.js·上下文没有 P 时只进注册表）·只装天启+绍宋两个
const { loadBuiltins } = require(path.join(__dirname, '..', 'web', 'scripts', 'lib-official-builtins.js'));
const builtins = loadBuiltins({ ids: ['sc-tianqi7-1627', 'sc-jianyan1-1127-shaosong'] }).TMOfficialScenarioBuiltins;
const TQ = builtins['sc-tianqi7-1627'], SS = builtins['sc-jianyan1-1127-shaosong'];
const SID = SS.id; // 绍宋 sid

// 严格复刻 doActualStart 应用片段(只取与本漏洞相关的字段),applyFix 控制是否带本次补丁
function runStart(sc, applyFix) {
  // P = 上一局天启残留(关键:government/military/map/mapData 都是天启的)
  const P = {
    government: clone(TQ.government),
    military: clone(TQ.military),
    map: clone(TQ.map),
    mapData: clone(TQ.mapData),
    mapRuntimeContract: TQ.mapRuntimeContract ? clone(TQ.mapRuntimeContract) : { _from: 'tianqi' },
    officeTree: clone(TQ.officeTree),
    officeConfig: TQ.officeConfig ? clone(TQ.officeConfig) : null,
    adminHierarchy: clone(TQ.adminHierarchy)
  };

  // ===== 本次补丁:应用新剧本前清空非 sid「整个世界」字段 =====
  if (applyFix) {
    ['government', 'military', 'map', 'mapData', 'mapRuntimeContract'].forEach(function (k) { try { delete P[k]; } catch (e) { P[k] = undefined; } });
  }

  // GM 全新重建(L1988 关键字段)
  const GM = { sid: sc.id, officeTree: P.officeTree ? clone(P.officeTree) : [], mapData: null, armies: [], chars: [] };

  // ── 应用剧本字段(照 tm-patches.js L2140-2192 的 if(sc.X) 模式)──
  if (sc.military) P.military = clone(sc.military);
  if (sc.map) P.map = clone(sc.map);
  if (sc.government) P.government = clone(sc.government);
  if (sc.adminHierarchy) P.adminHierarchy = clone(sc.adminHierarchy);
  if (sc.officeTree) P.officeTree = clone(sc.officeTree);
  if (sc.officeConfig) P.officeConfig = clone(sc.officeConfig);
  // 官制源优先级:government.nodes(含 holder)覆盖 officeTree (L2150-2156)
  if (P.government && P.government.nodes && P.government.nodes.length > 0) {
    let hasHolders = false;
    (function chk(ns){ ns.forEach(function(n){ if(n.positions) n.positions.forEach(function(p){ if(p.holder) hasHolders = true; }); if(n.subs) chk(n.subs); }); })(P.government.nodes);
    if (hasHolders || !P.officeTree || P.officeTree.length === 0) P.officeTree = clone(P.government.nodes);
  }
  if (P.officeTree && P.officeTree.length > 0) GM.officeTree = clone(P.officeTree);
  if (sc.mapData) P.mapData = clone(sc.mapData);
  // 地图进入 live (L2182-2191)
  if ((P.map && P.map.regions && P.map.regions.length > 0) || (P.mapData && P.mapData.regions && P.mapData.regions.length > 0)) {
    const srcMap = (P.map && P.map.regions && P.map.regions.length > 0) ? P.map : P.mapData;
    GM.mapData = clone(srcMap);
  }
  // GM.armies 派生 (L2297-2300)
  const initTroops = (P.military && P.military.initialTroops) || [];
  const legacyArmies = (P.military && P.military.armies) || [];
  const rawArmies = (initTroops.length > 0) ? initTroops : legacyArmies;
  GM.armies = rawArmies.filter(function(a){ return !a.sid || a.sid === sc.id; }).map(clone);
  // GM.chars 派生 (L2285) —— sid 过滤,本就隔离,作对照
  // (此测试 P.characters 只放绍宋的,验证 sid 过滤正常)
  return { P, GM };
}

console.log('smoke-scenario-no-bleed');
const tqMapRegions = (TQ.map.regions || []).length;
const tqOfficeLen = TQ.officeTree.length;

// ════ Part A:绍宋现已自带南宋地图(内容修复·不再缺 map)════
ok(SS.map && SS.map.regions && SS.map.regions.length > 0, 'A1 绍宋现有自己的 map(' + (SS.map ? SS.map.regions.length : 0) + ' 区)');
ok(SS.mapData && SS.mapData.regions && SS.mapData.regions.length > 0, 'A2 绍宋有 mapData');
const ownerNames = new Set((SS.map.regions || []).map(function(r){ return r.ownerName || r.owner; }));
ok(ownerNames.has('宋朝廷') && ownerNames.has('金国（大金）'), 'A3 绍宋地图归属是宋金格局(含宋朝廷+金国)·非明朝廷');
ok(!ownerNames.has('明朝廷'), 'A4 绍宋地图无"明朝廷"(未串天启)');
// 载入绍宋 → GM.mapData = 绍宋自己的南宋图(非天启)
const ssStart = runStart(SS, true);
ok(ssStart.GM.mapData && ssStart.GM.mapData.regions && ssStart.GM.mapData.regions.length === SS.map.regions.length,
  'A5 载入绍宋 → GM.mapData = 绍宋自己的南宋图(' + (ssStart.GM.mapData ? ssStart.GM.mapData.regions.length : 0) + ' 区)');
const ssGmOwners = new Set((ssStart.GM.mapData.regions || []).map(function(r){ return r.ownerName || r.owner; }));
ok(!ssGmOwners.has('明朝廷'), 'A6 绍宋运行态地图无明朝廷泄漏');

// ════ Part B:P-reset 漏洞修复(防任何缺字段剧本继承上一局)════
// 构造合成"缺 map/government/military"剧本(模拟未来不完整剧本)→ 验 P-reset 隔离
const synthetic = clone(SS);
delete synthetic.map; delete synthetic.mapData; delete synthetic.mapRuntimeContract;
delete synthetic.government; delete synthetic.military;
synthetic.id = 'sc-synthetic-mapless';
ok(!synthetic.map && !synthetic.government && !synthetic.military, 'B0 合成无图/无government/无military 剧本(模拟不完整剧本)');
// 无修 → 复现漏洞:合成剧本混入天启地图
const noFix = runStart(synthetic, false);
ok(noFix.GM.mapData && noFix.GM.mapData.regions && noFix.GM.mapData.regions.length === tqMapRegions,
  'B1【无修·复现漏洞】缺图剧本混入天启地图(' + (noFix.GM.mapData ? noFix.GM.mapData.regions.length : 0) + ' 区=天启 ' + tqMapRegions + ')');
// 有修 → P-reset 隔离干净
const fixed = runStart(synthetic, true);
ok(!fixed.GM.mapData || !fixed.GM.mapData.regions || fixed.GM.mapData.regions.length === 0,
  'B2【有修】缺图剧本不再继承天启地图(空)');
ok(fixed.GM.armies.length === 0, 'B3【有修】缺 military 剧本无天启军队');
ok(noFix.GM.officeTree.length === synthetic.officeTree.length && fixed.GM.officeTree.length === synthetic.officeTree.length,
  'B4 官制本就有保护(天启 government 无 nodes 不覆盖)·有修无修都=剧本自己的(' + fixed.GM.officeTree.length + ')');

console.log('\n结果: ' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
