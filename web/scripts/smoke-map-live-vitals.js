#!/usr/bin/env node
/* eslint-env node */
// smoke-map-live-vitals.js — 死字段修：地块活态要素聚合（2026-06-13）
// 病根：minxin/corruption/prosperity 引擎只更新 adminHierarchy 叶子，省级节点与地图 r.data 开局后从不回滚，
// 故视图/册页读 r.data.minxinLocal / 省节点.minxin 恒显开局死值。修=regionBundle 优先取「活叶人口加权聚合」。
// 本 smoke：vm 抽出 liveRegionVitals 纯函数实算聚合 + 源码契约（regionBundle 取 vitals 首位·军务读活军）。
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// 第二十五拆：regionBundle 等已迁出至 dossier sibling·源码契约需并检两片(origin 先·sibling 后·合装载序)
const SRC = fs.readFileSync(path.join(__dirname, '..', 'phase8-formal-map.js'), 'utf8')
  + '\n' + fs.readFileSync(path.join(__dirname, '..', 'phase8-formal-map-dossier.js'), 'utf8');

let passed = 0, failed = 0;
function ok(cond, msg) {
  if (cond) { passed += 1; console.log('  PASS', msg); }
  else { failed += 1; console.error('  FAIL', msg); }
}

// ── 抽出 liveRegionVitals（传入 liveDivision 即绕开 findLiveAdminDivision）──
const m = SRC.match(/ {2}(function liveRegionVitals\([^)]*\)\{[\s\S]*?\n {2}\})/);
ok(!!m, '源码可抽出 liveRegionVitals');
const _GM = { turn: 1 };
const ctx = {
  window: { GM: _GM },
  GM: _GM, // 浏览器里 window===globalThis 故裸 GM 可解析·沙箱须显式给
  findLiveAdminDivision: function () { return null; },
  Math: Math, Number: Number, isFinite: isFinite, String: String
};
ctx._liveVitalsCache = { turn: -1, byRegion: {} };
vm.createContext(ctx);
vm.runInContext('var _liveVitalsCache = { turn: -1, byRegion: {} };\n' + m[1] + '\nthis.__lrv = liveRegionVitals;', ctx);
const lrv = ctx.__lrv;

// 叶子树：人口悬殊（大府民心低·小州民心高）→ 加权聚合应偏向大府
const tree = {
  name: '某省', children: [
    { name: '甲府', population: { mouths: 9000000 }, minxin: 20, corruption: 80, prosperity: 30 },
    { name: '乙州', population: { mouths: 1000000 }, minxin: 70, corruption: 40, prosperity: 60 }
  ]
};
const v = lrv({ id: 'r1' }, tree);
// 加权民心 = (20*9e6 + 70*1e6)/1e7 = (180e6+70e6)/1e7 = 25
ok(v.minxin === 25, '人口加权民心 = 25（大府 20×900万 主导）got ' + v.minxin);
ok(v.corruption === 76, '人口加权吏治 = 76 got ' + v.corruption);
ok(v.prosperity === 33, '人口加权繁荣 = 33 got ' + v.prosperity);
ok(v.leaves === 2, '叶计数 2');

// 嵌套子树（府→州→县）：只数叶
const nested = { name: 'P', children: [
  { name: 'A', children: [
    { name: 'A1', population: { mouths: 1000000 }, minxin: 10 },
    { name: 'A2', population: { mouths: 1000000 }, minxin: 50 }
  ] }
] };
ok(lrv({ id: 'r2' }, nested).minxin === 30, '嵌套子树只聚叶 (10+50)/2=30');

// 缺活值 → null（不凭空造）·静态兜底由 regionBundle 的 firstValue 接手
ok(lrv({ id: 'r3' }, { name: 'X', children: [{ name: 'x1', population: { mouths: 100 } }] }).minxin === null, '叶无 minxin → null（让位静态）');

// 单叶（region 本身是叶）
ok(lrv({ id: 'r4' }, { name: 'solo', minxin: 42, corruption: 5 }).minxin === 42, '单叶直读 minxin=42');

// 民变取叶最坏（max）
ok(lrv({ id: 'r5' }, { name: 'U', children: [
  { name: 'u1', population: { mouths: 100 }, unrest: 12 },
  { name: 'u2', population: { mouths: 100 }, unrest: 55 }
] }).unrest === 55, '民变取叶最坏 55');

// 回合缓存：同回合同 region 命中缓存（改 turn 才失效）
const first = lrv({ id: 'rc' }, tree);
ctx.window.GM.turn = 1;
ok(lrv({ id: 'rc' }, tree) === first, '同回合命中缓存（同引用）');

// ── 源码契约：regionBundle 把 vitals 置于 firstValue 首位 + 覆盖死字段 ──
ok(/var vitals = liveRegionVitals\(r, liveDivision\);/.test(SRC), 'regionBundle 调 liveRegionVitals');
ok(/var minxin = firstValue\(\s*vitals\.minxin,/.test(SRC), 'minxin 取 vitals 首位（压过省节点死值）');
ok(/var corruption = firstValue\(\s*vitals\.corruption,/.test(SRC), 'corruption 取 vitals 首位');
ok(/var prosperity = firstValue\(\s*vitals\.prosperity,/.test(SRC), 'prosperity 取 vitals 首位');
ok(/data\.minxinLocal = minxin; data\.minxin = minxin;/.test(SRC), '活民心覆盖 minxinLocal+minxin 双键');
ok(/data\.liveVitals = vitals;/.test(SRC), 'vitals 挂 data 供册页直取');
ok(/vitals: vitals \}/.test(SRC), 'regionBundle 返回带 vitals');

// ── 军务视图读活军（兵变险/欠饷/低气/缺粮）──
ok(/b\.army && b\.army\.liveArmies/.test(SRC), 'armyViewScore 读绑定活军');
ok(/_a\.mutinyRisk/.test(SRC) && /_a\.payArrearsMonths/.test(SRC), '军务计活态兵变险+欠饷');
const armySource = SRC.match(/ {2}(function armyViewScore\([^)]*\)\{[\s\S]*?\n {2}\})/)[1];
const levelSource = SRC.match(/ {2}(function parseLevelWord\([^)]*\)\{[\s\S]*?\n {2}\})/)[1];
ctx.firstValue = function(){return Array.from(arguments).find(v=>v!==undefined&&v!==null&&v!=='');};
ctx.hasDisplayValue = v=>v!==undefined&&v!==null&&v!=='';
vm.runInContext(levelSource+'\n'+armySource,ctx);
const armyView = (data,live,armies)=>ctx.armyViewScore({}, {data:data,liveDivision:live,pop:{mouths:10000},army:{troops:1000,liveArmies:armies}});
ok(armyView({}, {}, [{payArrearsMonths:3}])===54, '无静态军压时，真实欠饷仍显示压力');
ok(armyView({armyPressure:20}, {}, [{mutinyRisk:81}])===81, '兵变风险按活军抬高军务压力');
ok(armyView({}, {_warZone:true}, [])===86, '缺基础军账时交战状态仍显示危急');
ok(armyView({}, {}, [])===null, '缺军务账不捏造25分');

console.log('\n[smoke-map-live-vitals] ' + (failed === 0 ? 'PASS' : 'FAIL') + ' — ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
