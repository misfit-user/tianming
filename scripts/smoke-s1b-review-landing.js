/*
 * smoke-s1b-review-landing.js — S1b 考课落地（年度考课优劣 → 功名升降·喂既有 runAutoPromotion 引擎）
 *   背景：原 runAnnualReview 评出优/劣 + promotions/demotions 建议·但建议仅事件文字+_annualReviewHistory，
 *   引擎不真升降·实际后果只有 ±5 loyalty。新增 flag officeReviewLandingEnabled(默认关)：
 *   优等→功名推力、劣等→功名扣减失职，接入既有「功名→自动升迁」管道。
 *   ★测真代码：headless 加载 app → 调真 runAnnualReview()，验 char.resources.virtueMerit 真变。
 * node scripts/smoke-s1b-review-landing.js
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
const src = fs.readFileSync(path.join(ROOT, 'tm-endturn-helpers.js'), 'utf8');
ok(/function _officeReviewLandingOn\(\)/.test(src), '_officeReviewLandingOn 开关已定义');
ok(/officeReviewLandingEnabled/.test(src), '开关读 officeReviewLandingEnabled');
ok(/adjustVirtueMerit\(c, _grant, '考课优等'\)/.test(src), '优等 → adjustVirtueMerit 功名推力');
ok(/adjustVirtueMerit\(c, _pen, '考课劣等'\)/.test(src), '劣等 → adjustVirtueMerit 功名扣减');
ok(/_reviewPoorStreak = \(c\._reviewPoorStreak \|\| 0\) \+ 1/.test(src), '连劣记数 _reviewPoorStreak（喂 S4）');
ok(/_officeReviewLandingOn\(\) && c\.officialTitle/.test(src), '仅在任官(有officialTitle)受考课功名后果');

// ════════ 二·真代码：headless 加载 → 调真 runAnnualReview ════════
function loadHeadlessHelpers() { const s = fs.readFileSync(HEADLESS, 'utf8').replace(/^#![^\n]*\n/, '').replace(/\nmain\(\);\s*$/, '\nreturn { makeStubs, parseIndexHtmlScripts };'); return (new Function('require', 'process', '__dirname', '__filename', 'module', 'exports', s))(require, process, __dirname, HEADLESS, { exports: {} }, {}); }
const helpers = loadHeadlessHelpers();
const env = helpers.makeStubs();
const sandbox = vm.createContext(env.win);
const scripts = helpers.parseIndexHtmlScripts();
const cutoff = scripts.findIndex((s) => path.basename(s) === 'tm-test-harness.js');
(cutoff >= 0 ? scripts.slice(0, cutoff) : scripts).forEach((s) => { try { vm.runInContext(fs.readFileSync(path.join(ROOT, s), 'utf8'), sandbox, { filename: s, timeout: 20000 }); } catch (e) {} });

ok(vm.runInContext('typeof runAnnualReview === "function"', sandbox), 'boot 后 runAnnualReview 可调');
ok(vm.runInContext('typeof CharEconEngine !== "undefined" && typeof CharEconEngine.adjustVirtueMerit === "function"', sandbox), 'CharEconEngine.adjustVirtueMerit 在');

function mkChar(name, hi, hasOffice, isPlayer) {
  const v = hi ? 90 : 20;
  return {
    name: name, alive: true, isPlayer: !!isPlayer,
    officialTitle: hasOffice ? '知府' : '',
    intelligence: v, administration: v, loyalty: v, virtue: v, benevolence: v,
    rankLevel: 9,
    wuchang: { ren: v, yi: v, li: v, zhi: v, xin: v },
    resources: { virtueMerit: 1000 }
  };
}
function runReview(chars, flagOn) {
  // 先设 stub GM，再按同一 GM 算年区间，令 turn=区间（保证 turn % _yearInterval === 0·不早退）
  sandbox.GM = { turn: 1, chars: chars, evtLog: [], officeTree: [], daysPerTurn: 90 };
  sandbox.P = { conf: flagOn ? { officeReviewLandingEnabled: true } : {} };
  const interval = vm.runInContext('(typeof turnsForDuration === "function" ? (turnsForDuration("year") || 12) : 12)', sandbox);
  sandbox.GM.turn = interval;
  let err = null;
  try { vm.runInContext('runAnnualReview()', sandbox); } catch (e) { err = e; }
  return err;
}
function vm_(ch) { return ch.resources && ch.resources.virtueMerit; }

// (a) flag 关 → 优等官功名不变（零回归）
let off = [mkChar('优甲', true, true, false), mkChar('劣乙', false, true, false)];
let e0 = runReview(off, false);
ok(!e0, 'runAnnualReview(flag关) 无异常' + (e0 ? ': ' + e0.message : ''));
ok(vm_(off[0]) === 1000, '真码：flag 关 → 优等官 virtueMerit 不变 1000（零回归）');
ok(vm_(off[1]) === 1000, '真码：flag 关 → 劣等官 virtueMerit 不变 1000（零回归）');

// (b) flag 开 → 优等官功名升、劣等官功名降
let on = [mkChar('优丙', true, true, false), mkChar('劣丁', false, true, false)];
let e1 = runReview(on, true);
ok(!e1, 'runAnnualReview(flag开) 无异常' + (e1 ? ': ' + e1.message : ''));
ok(vm_(on[0]) > 1000, '真码：flag 开 → 优等官 virtueMerit 升（' + vm_(on[0]) + ' > 1000）·喂自动升迁');
ok(vm_(on[1]) < 1000, '真码：flag 开 → 劣等官 virtueMerit 降（' + vm_(on[1]) + ' < 1000）·失职');
ok(on[1]._reviewPoorStreak === 1, '真码：劣等官 _reviewPoorStreak=1（连劣记数·喂 S4）');
ok(on[0]._reviewPoorStreak === 0, '真码：优等官 _reviewPoorStreak 清零');

// (c) flag 开 → 无官职者(布衣)即便评优也不授考课功名（考课只对在任官）
let bo = [mkChar('布衣优', true, false, false), mkChar('占位劣', false, true, false)];
let e2 = runReview(bo, true);
ok(!e2, 'runAnnualReview(布衣场景) 无异常' + (e2 ? ': ' + e2.message : ''));
ok(vm_(bo[0]) === 1000, '真码：无官衔者 virtueMerit 不变（考课功名仅在任官）');

// (d) flag 开 → 君上(isPlayer)不受考课（功名不被动）
let pl = [{ name: '君上', alive: true, isPlayer: true, officialTitle: '皇帝', intelligence: 90, administration: 90, loyalty: 90, virtue: 90, wuchang: { ren: 90, yi: 90, li: 90, zhi: 90, xin: 90 }, rankLevel: 1, resources: { virtueMerit: 1000 } }, mkChar('陪跑劣', false, true, false)];
let e3 = runReview(pl, true);
ok(!e3, 'runAnnualReview(君上场景) 无异常' + (e3 ? ': ' + e3.message : ''));
ok(vm_(pl[0]) === 1000, '真码：君上 virtueMerit 不变（isPlayer 跳过）');

console.log('\nsmoke-s1b-review-landing: ' + (fail === 0 ? 'PASS' : 'FAIL') + ' ' + pass + '/' + (pass + fail));
process.exit(fail > 0 ? 1 : 0);
