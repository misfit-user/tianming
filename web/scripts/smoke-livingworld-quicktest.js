// smoke-livingworld-quicktest.js — 活世界·翻默认快测（批甲刀A2·2026-07-22）
//
// 「开闸醒世界」翻默认后的一键实跑体检：真源码 vm 实跑(非重新实现)四套活世界系统，验两矩阵——
//   场景A（默认 conf·即翻默认后的形态）：
//     民变 level≥3 → RevoltEntity.sync 具象化义军三件套(势力/渠帅/军队)；
//     leaf.borderRisk≥70 连 3 回合 → BorderInvasion.tick 出真侵攻军(army._borderInvasion)；
//     GM._factionLivingWorld 默认生效 → agentFlagOn('factionAgentEnabled'/'factionGoalStackEnabled')=true(B8 互斥仍守)；
//     一场会战结果 → WorldReactors 对败方 strength/legitimacy 确定性生效；全程零异常。
//   场景B（显式全 OFF conf）：同样种子下上述全部【不】发生（老轨回归守卫·字节级 OFF 路径）。
//
// 真源码：tm-revolt-entity.js / tm-border-invasion.js / tm-world-reactors.js / tm-agent-flags.js —— vm 实跑其真逻辑。
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.join(__dirname, '..');
var failures = [];
var exceptions = 0;
function assert(cond, msg) {
  if (cond) { console.log('  PASS ' + msg); }
  else { failures.push(msg); console.log('  FAIL ' + msg); }
}

function loadInto(sb, files) {
  sb.window = sb; sb.global = sb;
  if (!sb.console) sb.console = console;
  vm.createContext(sb);
  files.forEach(function (f) { vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sb, { filename: f }); });
  return sb;
}

// ── 民变实体化：真 RevoltEntity.sync ──
function revoltSandbox(conf) {
  var sb = { console: console, _ebs: [] };
  sb.addEB = function (cat, msg) { sb._ebs.push(cat + '·' + msg); };
  sb.GM = {
    turn: 10,
    facs: [{ id: 'f1', name: '大明', strength: 80, economy: 70, playerRelation: 100 }],
    chars: [{ name: '孙承宗', alive: true, faction: '朝廷', loyalty: 80 }],
    armies: [{ id: 'a1', name: '京营', faction: '大明', soldiers: 50000 }],
    minxin: { revolts: [] }
  };
  sb.P = { conf: conf || {} };
  return loadInto(sb, ['tm-revolt-entity.js']);
}

// ── 边患真入侵：真 BorderInvasion.tick ──
function borderSandbox(conf) {
  var leaves = [{ name: '蓟州', borderRisk: 80 }, { name: '大同', borderRisk: 50 }];
  var sb = { console: console, _ebs: [] };
  sb.addEB = function (cat, msg) { sb._ebs.push(cat + '·' + msg); };
  sb.IntegrationBridge = { getLeafDivisions: function () { return leaves; } };
  sb.GM = {
    turn: 30,
    adminHierarchy: { player: {} },
    facs: [
      { id: 'f_hj', name: '后金', strength: 80, playerRelation: -90 },
      { id: 'f_mg', name: '漠南部', strength: 60, playerRelation: -70 },
      { id: 'f_cx', name: '朝鲜', strength: 40, playerRelation: 60 }
    ],
    armies: [],
    chars: []
  };
  sb.P = { conf: conf || {} };
  loadInto(sb, ['tm-border-invasion.js']);
  sb._leaves = leaves;
  return sb;
}

// ── 世界反应总线：真 WorldReactors.Military.onBattleResolved ──
function reactorSandbox(conf) {
  var sb = { console: console };
  sb.GM = { turn: 12, _chronicle: [], facs: [
    { name: '大明', strength: 60, legitimacy: 70, morale: 55 },
    { name: '后金', strength: 50, legitimacy: 40, morale: 65 }
  ] };
  sb.P = { conf: conf || {} };
  return loadInto(sb, ['tm-world-reactors.js']);
}

// ── 势力活世界总闸 → factionAgent/goalStack 子闸(真 agentFlagOn) ──
function flagSandbox(livingWorldVal) {
  var sb = { console: console };
  sb.GM = { turn: 5, facs: [{ name: '甲' }], chars: [] };
  if (livingWorldVal !== undefined) sb.GM._factionLivingWorld = livingWorldVal;
  sb.P = { conf: {}, ai: {} };
  return loadInto(sb, ['tm-agent-flags.js']);
}

try {
  // ══════════════ 场景 A：默认 conf（翻默认后 = ON） ══════════════
  console.log('══ 场景A：默认 conf（翻默认后活世界全生效） ══');

  console.log('— A1 民变实体化：level≥3 → 义军三件套具象化 —');
  var ra = revoltSandbox({});                        // 默认 conf·无 revoltEntityEnabled
  ra.GM.minxin.revolts.push({ id: 'rvA', region: '陕西', status: 'ongoing', level: 3, scale: 30000, turn: 8 });
  ra.TM.RevoltEntity.sync(ra.GM);
  var aFac = ra.GM.facs.find(function (f) { return f._revoltEntity; });
  var aArmy = ra.GM.armies.find(function (a) { return a._revoltEntity; });
  var aLeader = ra.GM.chars.find(function (c) { return c._revoltEntity; });
  assert(!!aFac && aFac.name === '陕西义军', 'A·默认 conf → 义军势力具象化入档(证明 revoltEntityEnabled 默认 ON)');
  assert(!!aArmy && aArmy.soldiers === 9000 && aArmy.faction === '陕西义军', 'A·义军军队具象化(9000 兵)');
  assert(!!aLeader && aLeader.officialTitle === '义军渠帅', 'A·义军渠帅人物具象化');
  assert(ra._ebs.some(function (e) { return e.indexOf('陕西民变成势') >= 0; }), 'A·具象化落起居注(实体链真跑)');

  console.log('— A2 边患真入侵：borderRisk≥70 连 3 回合 → 侵攻军入境 —');
  var ba = borderSandbox({});                        // 默认 conf·无 borderInvasionEnabled
  var BIa = ba.TM.BorderInvasion;
  BIa.tick(ba.GM); ba.GM.turn++;                     // streak 1
  assert(ba.GM.armies.length === 0 && ba._leaves[0]._invRiskStreak === 1, 'A·第1回合高压 → 记 streak 不出兵(确定性)');
  BIa.tick(ba.GM); ba.GM.turn++;                     // streak 2
  BIa.tick(ba.GM); ba.GM.turn++;                     // streak 3 → 出兵
  var aInv = ba.GM.armies.find(function (a) { return a._borderInvasion; });
  assert(!!aInv, 'A·默认 conf·高压三回合 → 出真侵攻军(证明 borderInvasionEnabled 默认 ON)');
  assert(!!aInv && aInv.faction === '后金' && aInv.location === '蓟州', 'A·攻方=最强敌对(后金)·兵锋落最险 leaf(蓟州)');

  console.log('— A3 世界反应总线：会战结果 → 败方 strength/legitimacy 生效 —');
  var wa = reactorSandbox({});                       // 默认 conf·无 worldReactorBattleEnabled
  var wrA = wa.WorldReactors.Military.onBattleResolved(wa.GM, { winner: '后金', loser: '大明' });
  assert(wrA && wrA.applied === true, 'A·默认 conf → world reactor 生效(证明 worldReactorBattleEnabled 默认 ON)');
  assert(wa.GM.facs[0].strength === 55, 'A·败方大明 strength 确定性 -5');
  assert(wa.GM.facs[0].legitimacy === 67, 'A·败方大明 legitimacy 确定性 -3');

  console.log('— A4 势力活世界总闸 → 子闸点亮 + B8 互斥仍守 —');
  var fa = flagSandbox(undefined);                   // GM 无 _factionLivingWorld = 翻默认后的默认态
  assert(fa.agentFlagOn('factionAgentEnabled') === true, 'A·默认(GM._factionLivingWorld 未显式关) → factionAgentEnabled 生效(证明默认 ON)');
  assert(fa.agentFlagOn('factionGoalStackEnabled') === true, 'A·同上 → factionGoalStackEnabled 生效');
  fa.P.conf.agentModeEnabled = true;                 // 进 agent 模式(mode-b)
  assert(fa.agentFlagOn('factionAgentEnabled') === false, 'A·B8 互斥不变：agent 模式下总闸不点亮子闸(功能不可达·翻默认不破坏互斥)');

  // ══════════════ 场景 B：显式全 OFF（老轨回归守卫） ══════════════
  console.log('══ 场景B：显式全 OFF conf（老轨回归·字节级 OFF 路径） ══');

  console.log('— B1 民变实体化 OFF：不具象化 —');
  var rb = revoltSandbox({ revoltEntityEnabled: false });
  rb.GM.minxin.revolts.push({ id: 'rvB', region: '陕西', status: 'ongoing', level: 3, scale: 30000, turn: 8 });
  rb.TM.RevoltEntity.sync(rb.GM);
  assert(rb.GM.facs.length === 1 && !rb.GM.facs.some(function (f) { return f._revoltEntity; }), 'B·显式 OFF → 民变不具象化(势力零新增)');
  assert(rb.GM.armies.length === 1 && rb.GM.chars.length === 1, 'B·显式 OFF → 军队/人物零新增(老轨)');

  console.log('— B2 边患真入侵 OFF：永不出兵 —');
  var bb = borderSandbox({ borderInvasionEnabled: false });
  var BIb = bb.TM.BorderInvasion;
  BIb.tick(bb.GM); bb.GM.turn++; BIb.tick(bb.GM); bb.GM.turn++; BIb.tick(bb.GM); bb.GM.turn++; BIb.tick(bb.GM);
  assert(bb.GM.armies.length === 0, 'B·显式 OFF → 高压多回合亦永不出兵');
  assert(!bb._leaves[0]._invRiskStreak, 'B·显式 OFF → 连 streak 都不记');

  console.log('— B3 世界反应总线 OFF：no-op —');
  var wb = reactorSandbox({ worldReactorBattleEnabled: false });
  var wrB = wb.WorldReactors.Military.onBattleResolved(wb.GM, { winner: '后金', loser: '大明' });
  assert(wrB && wrB.applied === false && wrB.reason === 'disabled', 'B·显式 OFF → world reactor disabled no-op');
  assert(wb.GM.facs[0].strength === 60 && wb.GM._chronicle.length === 0, 'B·显式 OFF → 败方零折损·零 chronicle 副作用');

  console.log('— B4 势力活世界总闸 OFF：子闸不点亮 —');
  var fb = flagSandbox(false);                       // GM._factionLivingWorld = 显式 false
  assert(fb.agentFlagOn('factionAgentEnabled') === false, 'B·显式 false → factionAgentEnabled 不点亮(老轨)');
  assert(fb.agentFlagOn('factionGoalStackEnabled') === false, 'B·显式 false → factionGoalStackEnabled 不点亮(老轨)');

  // ══════════════ 场景 C：势力活世界迁移矩阵（normalizer 真源实跑）+ 总纲勾选推导 ══════════════
  console.log('══ 场景C：迁移矩阵（tm-save-lifecycle normalizer 真源抽取实跑）+ 总纲勾选推导 ══');

  console.log('— C1 迁移+自愈单一真源 _tmReconcileFactionLivingWorld：用户意图戳 vs 跨局默认镜像 —');
  var slSrc = fs.readFileSync(path.join(ROOT, 'tm-save-lifecycle.js'), 'utf8');
  var reconM = slSrc.match(/function _tmReconcileFactionLivingWorld\(gm, p\)[\s\S]*?\n\}/);
  assert(!!reconM, 'C·从 tm-save-lifecycle.js 真源抽出迁移+自愈单一真源函数 _tmReconcileFactionLivingWorld(normalizer 与 tm:p-restored 自愈同调)');
  var runNorm = new Function('gm', 'p', (reconM ? reconM[0] : 'throw new Error("no reconcile fn")') + '\n_tmReconcileFactionLivingWorld(gm, p);');
  function normResult(gm, p) { runNorm(gm, p); return gm._factionLivingWorld; }
  assert(normResult({ _factionLivingWorld: false }, { conf: {} }) === true, 'C①·旧档自动 false + 无戳 → 一次性翻 ON(true·迁移根治混合态)');
  assert(normResult({ _factionLivingWorld: false, _factionLivingWorldSetByUser: true }, { conf: {} }) === false, 'C②·带用户意图戳 false → 永久尊重·保持 false');
  assert(normResult({}, { conf: {} }) === true, 'C③·字段缺失(全新/异常档) → 翻默认 ON(true)');
  assert(normResult({ _factionLivingWorld: false }, { conf: { factionLivingWorldDefault: false } }) === false, 'C④·无戳 + P.conf.factionLivingWorldDefault=false → 取跨局镜像·false');
  assert(normResult({ _factionLivingWorld: true, _factionLivingWorldSetByUser: true }, { conf: {} }) === true, 'C⑤·带戳 true → 尊重·保持 true');
  assert(normResult({}, { conf: { factionLivingWorldDefault: false } }) === false, 'C⑥·无戳+字段缺失+镜像 false → 取镜像 false(不越过用户跨局选择)');

  console.log('— C1b 启动竞态自愈（Codex 二轮 B）：lite 曾无 conf → 迟到镜像重算 —');
  // 竞态：boot 时无镜像+无戳 → normalizer 落 GM=true；完整 P 迟到带回 factionLivingWorldDefault=false → tm:p-restored 自愈同一真源重算
  assert(normResult({ _factionLivingWorld: true }, { conf: { factionLivingWorldDefault: false } }) === false, 'C⑦·自愈：无戳 GM 已=true(启动无镜像) + 迟到恢复镜像 false → 重算为 false(消除 GM=true↔镜像 false 永久矛盾)');
  assert(normResult({ _factionLivingWorld: true, _factionLivingWorldSetByUser: true }, { conf: { factionLivingWorldDefault: false } }) === true, 'C⑧·带戳 true 不被自愈覆盖(用户本会话显式设过·迟到镜像 false 不动它)');
  console.log('— C1c lite conf 净化器 _tmLiteSafeConf（Codex 三轮 A·敏感值/配额）：真源实跑 —');
  var utilsSrc = fs.readFileSync(path.join(ROOT, 'tm-utils.js'), 'utf8');
  var safeM = utilsSrc.match(/function _tmLiteSafeConf\(conf\)\{[\s\S]*?\n\}/);
  assert(!!safeM, 'C·从 tm-utils.js 真源抽出 lite conf 净化器 _tmLiteSafeConf');
  var runSafe = new Function('conf', (safeM ? safeM[0] : 'throw new Error("no _tmLiteSafeConf")') + '\nreturn _tmLiteSafeConf(conf);');
  var _big = new Array(20005).join('x');   // >20KB 字符串
  var _dirty = { apiKey: 'sk-secret', aiKey: 'sk-secret2', refText: '史料'.repeat(100000), bigStr: _big, factionLivingWorldDefault: false, revoltEntityEnabled: true, qijuLookback: 7 };
  var _clean = runSafe(_dirty);
  assert(_clean.apiKey === undefined && _clean.aiKey === undefined, 'C⑨·净化器剔除敏感值 apiKey/aiKey(对齐 resume-point 清单·不进明文 localStorage)');
  assert(_clean.refText === undefined && _clean.bigStr === undefined, 'C⑩·净化器剔除 refText + 任意 >20KB 串(通用配额守卫·防 QuotaExceededError 被空 catch 静默吞)');
  assert(_clean.factionLivingWorldDefault === false && _clean.revoltEntityEnabled === true && _clean.qijuLookback === 7, 'C⑪·正常设置键完整保留(含 factionLivingWorldDefault 跨局镜像·不误伤)');
  assert(_dirty.apiKey === 'sk-secret' && _dirty.refText.length > 0, 'C⑫·纯函数零副作用(不改入参 conf)');
  // 两个 lite 写口都接净化器（saveP 原路径 + 桌面 autoSave 本批路径·同一 tm_P_lite 键·同一泄露面）
  assert(/conf:\s*_tmLiteSafeConf\(P\.conf\)/.test(utilsSrc), 'C·fix-A(原路径同修)：tm-utils saveP lite 写口 conf 走 _tmLiteSafeConf');
  assert(/conf:_tmLiteSafeConf\(P\.conf\)/.test(slSrc), 'C·fix-A：tm-save-lifecycle 桌面 autoSave lite 写口 conf 走 _tmLiteSafeConf');
  assert(slSrc.indexOf("addEventListener('tm:p-restored'") >= 0 && /_tmReconcileFactionLivingWorld\(GM, \(typeof P/.test(slSrc), 'C·fix2：tm:p-restored 自愈监听已挂 + 调单一真源 _tmReconcileFactionLivingWorld');
  assert(/_tmReconcileFactionLivingWorld\(GM, \(typeof P/.test(slSrc) && /_tmReconcileFactionLivingWorld\(GM, P\)/.test(slSrc), 'C·单一真源：normalizer 与自愈监听两处同调 _tmReconcileFactionLivingWorld(无逻辑分叉)');

  console.log('— C2 总纲勾选推导：真源 _tmSyncLivingWorldMaster·vm 实跑(stub document) —');
  var psSrc = fs.readFileSync(path.join(ROOT, 'tm-player-settings.js'), 'utf8');
  var syncM = psSrc.match(/function _tmSyncLivingWorldMaster\(\)[\s\S]*?\n\}/);
  assert(!!syncM, 'C·从 tm-player-settings.js 真源抽出 _tmSyncLivingWorldMaster');
  function masterChecked(conf, gmFlw) {
    var el = { checked: undefined };
    var sb = { console: console };
    sb.window = sb; sb.global = sb;
    sb.document = { getElementById: function (id) { return id === 's-livingworld-master' ? el : null; } };
    sb.P = { conf: conf };
    sb.GM = (gmFlw !== undefined) ? { _factionLivingWorld: gmFlw } : {};
    vm.createContext(sb);
    vm.runInContext(syncM[0] + '\n_tmSyncLivingWorldMaster();', sb, { filename: 'sync-extract.js' });
    return el.checked;
  }
  assert(masterChecked({}, true) === true, 'C·总纲推导：四组件默认 + 势力活世界 ON → 勾选');
  assert(masterChecked({ revoltEntityEnabled: false }, true) === false, 'C·总纲推导：任一组件显式关(民变) → 不勾');
  assert(masterChecked({}, false) === false, 'C·总纲推导：势力活世界 OFF → 不勾');
  assert(masterChecked({ factionLivingWorldDefault: false }, undefined) === false, 'C·总纲推导：无 GM 字段 + 跨局镜像 false → 不勾(读镜像)');
} catch (e) {
  exceptions++;
  console.log('  FAIL 快测抛异常: ' + ((e && e.stack) || e));
  failures.push('全程零异常(实际抛出: ' + ((e && e.message) || e) + ')');
}

console.log('');
if (failures.length || exceptions) {
  console.log('FAIL smoke-livingworld-quicktest: ' + failures.length + ' 处失败' + (exceptions ? ('·' + exceptions + ' 处异常') : ''));
  failures.forEach(function (f) { console.log('  - ' + f); });
  process.exit(1);
}
console.log('PASS smoke-livingworld-quicktest (场景A 默认→四系统全生效 / 场景B 显式OFF→老轨回归 / 场景C 迁移矩阵+总纲勾选推导 / 全程零异常)');
