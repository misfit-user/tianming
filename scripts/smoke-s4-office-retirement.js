/*
 * smoke-s4-office-retirement.js — S4 人事新陈代谢·致仕（年迈乞骸骨 → 耄耋准致仕·可起复）
 *   原致仕全靠 AI·引擎无主动新陈代谢。新增 flag officePersonnelTurnoverEnabled(默认关)：年终察老·
 *   高龄(≥66)乞骸骨 signal(可慰留可规避)·耄耋(≥74)引擎准致仕(去位·标 _retired+officialTitle 致仕·可诏起复)。
 *   ★测真代码：headless 调真 _tickOfficePersonnelTurnover。
 * node scripts/smoke-s4-office-retirement.js
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
ok(/function _officePersonnelTurnoverOn\(\)/.test(src), '_officePersonnelTurnoverOn 开关已定义');
ok(/officePersonnelTurnoverEnabled/.test(src), '开关读 officePersonnelTurnoverEnabled');
ok(/function _engineRetireOfficial\(c, reason\)/.test(src), '_engineRetireOfficial 致仕原语');
ok(/c\.officialTitle = c\.officialTitle \+ '·致仕'/.test(src), '标 officialTitle 致仕（_OFF_RETIRE_RE 排出树）');
ok(/可诏起复/.test(src), '注释明确：可诏起复（可规避·复用既有召回路径）');
ok(/SettlementPipeline\.register\('officePersonnelTurnover'/.test(src), '注册 perturn 结算步 officePersonnelTurnover');
ok(/tags: \['联动', '官制'\]/.test(src), '致仕 → World Reaction Bus digest 联动');

// ════════ 二·真代码：headless 调真 _tickOfficePersonnelTurnover ════════
function loadHeadlessHelpers() { const s = fs.readFileSync(HEADLESS, 'utf8').replace(/^#![^\n]*\n/, '').replace(/\nmain\(\);\s*$/, '\nreturn { makeStubs, parseIndexHtmlScripts };'); return (new Function('require', 'process', '__dirname', '__filename', 'module', 'exports', s))(require, process, __dirname, HEADLESS, { exports: {} }, {}); }
const helpers = loadHeadlessHelpers();
const env = helpers.makeStubs();
const sandbox = vm.createContext(env.win);
const scripts = helpers.parseIndexHtmlScripts();
const cutoff = scripts.findIndex((s) => path.basename(s) === 'tm-test-harness.js');
(cutoff >= 0 ? scripts.slice(0, cutoff) : scripts).forEach((s) => { try { vm.runInContext(fs.readFileSync(path.join(ROOT, s), 'utf8'), sandbox, { filename: s, timeout: 20000 }); } catch (e) {} });

ok(vm.runInContext('typeof _tickOfficePersonnelTurnover === "function"', sandbox), 'boot 后 _tickOfficePersonnelTurnover 可调');

function mk(name, age, title, isPlayer) { return { name: name, age: age, officialTitle: title, alive: true, isPlayer: !!isPlayer }; }
function buildTree(chars) { return [{ name: '某部', positions: chars.filter(c => c.officialTitle && !c.isPlayer).map(c => ({ name: c.officialTitle, rank: '正一品', holder: c.name })) }]; }
function run(chars, flagOn, notYear) {
  sandbox.GM = { turn: 1, chars: chars, officeTree: buildTree(chars), evtLog: [], _chronicle: [], daysPerTurn: 90 };
  sandbox.P = { conf: flagOn ? { officePersonnelTurnoverEnabled: true } : {} };
  const yr = vm.runInContext('(typeof turnsForDuration === "function" ? (turnsForDuration("year") || 12) : 12)', sandbox);
  sandbox.GM.turn = notYear ? (yr + 1) : yr;
  vm.runInContext('_tickOfficePersonnelTurnover()', sandbox);
  return { chron: vm.runInContext('GM._chronicle.slice()', sandbox) };
}
const by = (chs, nm) => chs.find(c => c.name === nm);

// (a) flag 关 → 无人动（零回归）
let c0 = [mk('耄耋', 76, '太傅'), mk('高龄', 68, '尚书'), mk('壮年', 45, '侍郎')];
run(c0, false);
ok(!by(c0, '耄耋')._retired && !by(c0, '高龄')._seeksRetirement, '真码：flag 关 → 无致仕无乞骸骨（零回归）');

// (b) flag 开·年终 → 耄耋准致仕 / 高龄乞骸骨 / 壮年不动
let c1 = [mk('耄耋', 76, '太傅'), mk('高龄', 68, '尚书'), mk('壮年', 45, '侍郎'), mk('君上', 75, '皇帝', true)];
let r1 = run(c1, true);
ok(by(c1, '耄耋')._retired === true, '真码：耄耋(76≥74) → _retired=true（引擎准致仕）');
ok(/致仕/.test(by(c1, '耄耋').officialTitle), '真码：耄耋 officialTitle 标致仕（排出官制树）');
ok(by(c1, '耄耋')._preRetireTitle === '太傅', '真码：保留原衔 _preRetireTitle=太傅（可起复还原）');
ok(!!by(c1, '高龄')._seeksRetirement && !by(c1, '高龄')._retired, '真码：高龄(68≥66<74) → 乞骸骨 signal·未去位（可慰留·可规避）');
ok(by(c1, '高龄').officialTitle === '尚书', '真码：高龄 officialTitle 未变（仍在任）');
ok(!by(c1, '壮年')._retired && !by(c1, '壮年')._seeksRetirement, '真码：壮年(45) → 不动');
ok(!by(c1, '君上')._retired, '真码：君上(isPlayer·75) → 跳过（不致仕君主）');
ok(r1.chron.some(e => e && /官制↔人事/.test(String(e.type)) && /耄耋/.test(String(e.text))), '真码：致仕 → chronicle 官制↔人事 联动（入反应总线）');

// (c) flag 开·非年终回合 → 不触发（按年 cadence）
let c2 = [mk('耄耋2', 80, '太师')];
run(c2, true, true);
ok(!by(c2, '耄耋2')._retired, '真码：非年终回合 → 不察老（按年 cadence·turn%year≠0）');

// (d) 幂等：已致仕者再 tick 不重复处理
let c3 = [mk('已致仕', 82, '原任尚书·致仕')];
run(c3, true);
ok(by(c3, '已致仕').officialTitle === '原任尚书·致仕', '真码：已含致仕标者 → 跳过（不重复加标·幂等）');

// (e) 无 age 者跳过（不误致仕）
let c4 = [{ name: '无龄', officialTitle: '尚书', alive: true }];
run(c4, true);
ok(!by(c4, '无龄')._retired, '真码：无 age 字段 → 跳过（不误判致仕）');

console.log('\nsmoke-s4-office-retirement: ' + (fail === 0 ? 'PASS' : 'FAIL') + ' ' + pass + '/' + (pass + fail));
process.exit(fail > 0 ? 1 : 0);
