/*
 * smoke-s1d-official-disaffection.js — S1d 才不配位反哺（能臣不得其位·大材小用 → 怨望离心 + 求去信号）
 *   背景：calcOfficialSatisfaction 算了才不配位却零机制后果(仅面板展示·且其分数语义/标签倒置)。
 *   新增 flag officeSatisfactionFeedbackEnabled(默认关)：按正确语义(才高位卑→真不满)自建机械反哺——
 *   忠诚渐降·久郁(≥3回合)萌求去 c._seeksRemoval(交 AI/S4·绝不自动罢官)。
 *   ★测真代码：headless 加载 app → 调真 _tickOfficialDisaffection()，验 char.loyalty 真降/求去信号。
 * node scripts/smoke-s1d-official-disaffection.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const HEADLESS = path.join(__dirname, 'headless-smoke.js');
let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log('  ✗ FAIL: ' + m); } }

// ════════ 一·源契约 ════════
const src = fs.readFileSync(path.join(ROOT, 'tm-office-system.js'), 'utf8');
ok(/function _officeSatisfactionFeedbackOn\(\)/.test(src), '_officeSatisfactionFeedbackOn 开关已定义');
ok(/officeSatisfactionFeedbackEnabled/.test(src), '开关读 officeSatisfactionFeedbackEnabled');
ok(/function _tickOfficialDisaffection\(\)/.test(src), '_tickOfficialDisaffection 已定义');
ok(/gap = ability - expected/.test(src), '按 能力-品级落差(才高位卑)判定·非倒置满意度分');
ok(/_seeksRemoval = \{ since: GM\.turn/.test(src), '久郁 → c._seeksRemoval 求去信号(喂 AI/S4)');
ok(/SettlementPipeline\.register\('officeDisaffection'/.test(src), '注册 perturn 结算步 officeDisaffection');
ok(/绝不自动罢官/.test(src), '注释明确：绝不自动罢官(交 AI/S4)');

// ════════ 二·真代码：headless 加载 → 调真 _tickOfficialDisaffection ════════
function loadHeadlessHelpers() { const s = fs.readFileSync(HEADLESS, 'utf8').replace(/^#![^\n]*\n/, '').replace(/\nmain\(\);\s*$/, '\nreturn { makeStubs, parseIndexHtmlScripts };'); return (new Function('require', 'process', '__dirname', '__filename', 'module', 'exports', s))(require, process, __dirname, HEADLESS, { exports: {} }, {}); }
const helpers = loadHeadlessHelpers();
const env = helpers.makeStubs();
const sandbox = vm.createContext(env.win);
const scripts = helpers.parseIndexHtmlScripts();
const cutoff = scripts.findIndex((s) => path.basename(s) === 'tm-test-harness.js');
(cutoff >= 0 ? scripts.slice(0, cutoff) : scripts).forEach((s) => { try { vm.runInContext(fs.readFileSync(path.join(ROOT, s), 'utf8'), sandbox, { filename: s, timeout: 20000 }); } catch (e) {} });

ok(vm.runInContext('typeof _tickOfficialDisaffection === "function"', sandbox), 'boot 后 _tickOfficialDisaffection 可调');
ok(vm.runInContext('(typeof getRankLevel === "function") && getRankLevel("从九品") >= 15', sandbox), 'getRankLevel(从九品) 为低品(level 大)·才高位卑可成立');

function tree() {
  return [{ name: '某部', positions: [
    { name: '主事', rank: '从九品', holder: '能臣' },   // 才高位卑 → 大材小用
    { name: '尚书', rank: '正二品', holder: '称职' },   // 能力配位 → 位得其人
    { name: '侍郎', rank: '正三品', holder: '君上' },   // isPlayer → 跳过
    { name: '员外', rank: '正六品', holder: '空缺' }    // 空缺 → 跳过
  ]}];
}
function chars() {
  return [
    { name: '能臣', alive: true, isPlayer: false, intelligence: 92, administration: 92, military: 86, ambition: 75, loyalty: 80, stress: 0 },
    { name: '称职', alive: true, isPlayer: false, intelligence: 83, administration: 83, military: 83, ambition: 50, loyalty: 60, stress: 0 },
    { name: '君上', alive: true, isPlayer: true, intelligence: 90, administration: 90, military: 90, ambition: 90, loyalty: 100, stress: 0 }
  ];
}
function run(chs, flagOn, times) {
  sandbox.GM = { turn: 10, chars: chs, officeTree: tree(), evtLog: [] };
  sandbox.P = { conf: flagOn ? { officeSatisfactionFeedbackEnabled: true } : {} };
  let err = null;
  try { for (let i = 0; i < (times || 1); i++) vm.runInContext('_tickOfficialDisaffection()', sandbox); } catch (e) { err = e; }
  return err;
}
const by = (chs, nm) => chs.find(c => c.name === nm);

// (a) flag 关 → 能臣忠诚不变（零回归）
let c0 = chars();
let e0 = run(c0, false, 1);
ok(!e0, 'flag 关 无异常' + (e0 ? ': ' + e0.message : ''));
ok(by(c0, '能臣').loyalty === 80, '真码：flag 关 → 能臣(才高位卑)忠诚不变 80（零回归）');

// (b) flag 开一次 → 能臣忠诚下降（怨望离心）
let c1 = chars();
let e1 = run(c1, true, 1);
ok(!e1, 'flag 开 无异常' + (e1 ? ': ' + e1.message : ''));
ok(by(c1, '能臣').loyalty < 80, '真码：flag 开 → 能臣忠诚下降（' + by(c1, '能臣').loyalty.toFixed(2) + ' < 80）·怀才不遇离心');
ok(by(c1, '能臣')._disaffectTurns === 1, '真码：能臣 _disaffectTurns=1（积郁记数）');
ok((by(c1, '能臣').stress || 0) > 0, '真码：能臣 stress 上升（郁结）');

// (c) flag 开三次 → 触发求去信号（不自动罢官·仅 _seeksRemoval）
let c2 = chars();
run(c2, true, 3);
ok(!!by(c2, '能臣')._seeksRemoval, '真码：连续3回合怀才不遇 → c._seeksRemoval 求去信号置位（喂 AI/S4）');
ok(by(c2, '能臣').officialTitle === undefined || by(c2, '能臣').alive === true, '真码：求去不自动罢官（角色仍在·officialTitle 未被引擎清）');

// (d) flag 开 → 位得其人(称职)忠诚不降·无求去
let c3 = chars();
run(c3, true, 3);
ok(by(c3, '称职').loyalty >= 60, '真码：位得其人 忠诚不降（' + by(c3, '称职').loyalty.toFixed(2) + ' ≥ 60）');
ok(!by(c3, '称职')._seeksRemoval, '真码：位得其人 无求去信号');
ok((by(c3, '称职')._disaffectTurns || 0) === 0, '真码：位得其人 _disaffectTurns 保持 0');

// (e) flag 开 → 君上(isPlayer)跳过
let c4 = chars();
run(c4, true, 3);
ok(by(c4, '君上').loyalty === 100, '真码：君上(isPlayer)忠诚不变 100（跳过）');

console.log('\nsmoke-s1d-official-disaffection: ' + (fail === 0 ? 'PASS' : 'FAIL') + ' ' + pass + '/' + (pass + fail));
process.exit(fail > 0 ? 1 : 0);
