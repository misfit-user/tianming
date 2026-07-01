/*
 * smoke-s4b-jingcha.js — S4-2 京察/大计（周期黜陟·消费 S1b 连劣 + S1d 求去信号）
 *   每 cycleYears 年一察：黜=沉沦庸劣(连劣 _reviewPoorStreak≥2)→功名罚；陟=才高位卑能臣(_seeksRemoval)→功名擢。
 *   ★保守裁示：engine 只降/擢(功名·可逆·角色仍在)·不擅自革职去职。皆走既有功名→runAutoPromotion 引擎。
 *   ★测真代码：headless 调真 _tickJingcha，验 char.resources.virtueMerit 真变 + 黜陟名单 + digest。
 * node scripts/smoke-s4b-jingcha.js
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
ok(/function _officeJingchaOn\(\)/.test(src), '_officeJingchaOn 开关已定义');
ok(/officeJingchaEnabled/.test(src), '开关读 officeJingchaEnabled');
ok(/function _tickJingcha\(\)/.test(src), '_tickJingcha 已定义');
ok(/streak >= _JINGCHA_CFG\.demoteStreak/.test(src), '黜·消费 S1b 连劣 _reviewPoorStreak');
ok(/else if \(c\._seeksRemoval\)/.test(src), '陟·消费 S1d 才不配位 _seeksRemoval');
ok(/不擅自革职去职/.test(src), '注释明确保守裁示：只降/擢·不硬罢去职');
ok(/SettlementPipeline\.register\('officeJingcha'/.test(src), '注册 perturn 结算步 officeJingcha');

// ════════ 二·真代码：headless 调真 _tickJingcha ════════
function loadHeadlessHelpers() { const s = fs.readFileSync(HEADLESS, 'utf8').replace(/^#![^\n]*\n/, '').replace(/\nmain\(\);\s*$/, '\nreturn { makeStubs, parseIndexHtmlScripts };'); return (new Function('require', 'process', '__dirname', '__filename', 'module', 'exports', s))(require, process, __dirname, HEADLESS, { exports: {} }, {}); }
const helpers = loadHeadlessHelpers();
const env = helpers.makeStubs();
const sandbox = vm.createContext(env.win);
const scripts = helpers.parseIndexHtmlScripts();
const cutoff = scripts.findIndex((s) => path.basename(s) === 'tm-test-harness.js');
(cutoff >= 0 ? scripts.slice(0, cutoff) : scripts).forEach((s) => { try { vm.runInContext(fs.readFileSync(path.join(ROOT, s), 'utf8'), sandbox, { filename: s, timeout: 20000 }); } catch (e) {} });

ok(vm.runInContext('typeof _tickJingcha === "function"', sandbox), 'boot 后 _tickJingcha 可调');

function mk(name, title, extra) { return Object.assign({ name: name, officialTitle: title, alive: true, isPlayer: false, resources: { virtueMerit: 1000 } }, extra || {}); }
function run(chars, flagOn, notCycle) {
  sandbox.GM = { turn: 1, chars: chars, evtLog: [], _chronicle: [], daysPerTurn: 90 };
  sandbox.P = { conf: flagOn ? { officeJingchaEnabled: true } : {} };
  const yr = vm.runInContext('(typeof turnsForDuration === "function" ? (turnsForDuration("year") || 12) : 12)', sandbox);
  const cyc = Math.max(1, Math.round(yr * 3));
  sandbox.GM.turn = notCycle ? (cyc + 1) : cyc;
  vm.runInContext('_tickJingcha()', sandbox);
  return { chron: vm.runInContext('GM._chronicle.slice()', sandbox), jc: vm.runInContext('GM._jingchaResult || null', sandbox) };
}
const by = (chs, nm) => chs.find(c => c.name === nm);
const vmOf = ch => ch.resources && ch.resources.virtueMerit;

// (a) flag 关 → 无黜陟（零回归）
let c0 = [mk('庸劣', '主事', { _reviewPoorStreak: 3 }), mk('沉才', '县丞', { _seeksRemoval: { since: 1 } })];
run(c0, false);
ok(vmOf(by(c0, '庸劣')) === 1000 && vmOf(by(c0, '沉才')) === 1000, '真码：flag 关 → 无黜陟·功名不变（零回归）');

// (b) flag 开·京察年 → 黜庸劣 / 陟沉才 / 寻常不动 / 君上跳过
let c1 = [
  mk('庸劣', '主事', { _reviewPoorStreak: 3 }),
  mk('沉才', '县丞', { _seeksRemoval: { since: 1 }, _disaffectTurns: 4 }),
  mk('寻常', '主事'),
  mk('君上', '皇帝', { isPlayer: true, _reviewPoorStreak: 5 })
];
let r1 = run(c1, true);
ok(vmOf(by(c1, '庸劣')) < 1000, '真码：连劣庸劣 → 功名罚黜降（' + vmOf(by(c1, '庸劣')) + ' < 1000·rankLevel↓）');
ok((by(c1, '庸劣')._reviewPoorStreak || 0) === 0, '真码：黜后连劣计数清零（重新起算·不无限累罚）');
ok(vmOf(by(c1, '沉才')) > 1000, '真码：才高位卑能臣 → 功名擢拔（' + vmOf(by(c1, '沉才')) + ' > 1000·人尽其才）');
ok(!by(c1, '沉才')._seeksRemoval && (by(c1, '沉才')._disaffectTurns || 0) === 0, '真码：拔擢后消其求去与积郁（grievance addressed）');
ok(vmOf(by(c1, '寻常')) === 1000, '真码：寻常官(无连劣无求去) → 不动');
ok(vmOf(by(c1, '君上')) === 1000, '真码：君上(isPlayer) → 跳过（不京察君主）');

// (c) GM._jingchaResult + digest 联动
ok(r1.jc && Array.isArray(r1.jc.demoted) && r1.jc.demoted.indexOf('庸劣') >= 0 && r1.jc.promoted.indexOf('沉才') >= 0, '真码：GM._jingchaResult 录黜陟名单（供 AI/玩家）');
ok(r1.chron.some(e => e && /官制↔人事/.test(String(e.type)) && /京察/.test(String(e.text))), '真码：京察 → chronicle 官制↔人事 联动（入反应总线）');

// (d) 非京察周期回合 → 不触发
let c2 = [mk('庸劣2', '主事', { _reviewPoorStreak: 4 })];
run(c2, true, true);
ok(vmOf(by(c2, '庸劣2')) === 1000, '真码：非京察周期回合 → 不察（turn%cycle≠0）');

// (e) 连劣不足阈值 → 不黜
let c3 = [mk('一劣', '主事', { _reviewPoorStreak: 1 })];
run(c3, true);
ok(vmOf(by(c3, '一劣')) === 1000, '真码：连劣1<2 → 不黜（demoteStreak 阈值真生效）');

console.log('\nsmoke-s4b-jingcha: ' + (fail === 0 ? 'PASS' : 'FAIL') + ' ' + pass + '/' + (pass + fail));
process.exit(fail > 0 ? 1 : 0);
