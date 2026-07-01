/*
 * smoke-s1e-salary-headcount.js — S1 俸禄认人（国库俸禄按实有人数·冗员超编有财政代价）
 *   背景：calcSalary 原 heads = hasHolder ? floor(编制×虚拟在岗率) : 0·换谁来当、冗员超编对国库零差别。
 *   新增 flag officeSalaryHeadcountEnabled(默认关)：实有人数超编制虚拟在岗(超编) → 按实有计俸。
 *   ★测真代码：headless 加载 app → 调真 FiscalEngine.calcSalary / _salaryActualBodies。
 *   ★只惩超编：空缺/常编/缺员俸禄不变(零回归边界)。
 * node scripts/smoke-s1e-salary-headcount.js
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
const src = fs.readFileSync(path.join(ROOT, 'tm-fiscal-engine.js'), 'utf8');
ok(/function _salaryHeadcountOn\(\)/.test(src), '_salaryHeadcountOn 开关已定义');
ok(/officeSalaryHeadcountEnabled/.test(src), '开关读 officeSalaryHeadcountEnabled');
ok(/function _salaryActualBodies\(pos\)/.test(src), '_salaryActualBodies 实有人数(跨双模型)已定义');
ok(/if \(_bodies > heads\) heads = _bodies/.test(src), '仅超编(实有>虚拟在岗)才提高 heads（只惩超编）');
ok(/calcSalary: calcSalary/.test(src), '导出 calcSalary 供单测真代码');

// ════════ 二·真代码：headless 加载 → 调真函数 ════════
function loadHeadlessHelpers() { const s = fs.readFileSync(HEADLESS, 'utf8').replace(/^#![^\n]*\n/, '').replace(/\nmain\(\);\s*$/, '\nreturn { makeStubs, parseIndexHtmlScripts };'); return (new Function('require', 'process', '__dirname', '__filename', 'module', 'exports', s))(require, process, __dirname, HEADLESS, { exports: {} }, {}); }
const helpers = loadHeadlessHelpers();
const env = helpers.makeStubs();
const sandbox = vm.createContext(env.win);
const scripts = helpers.parseIndexHtmlScripts();
const cutoff = scripts.findIndex((s) => path.basename(s) === 'tm-test-harness.js');
(cutoff >= 0 ? scripts.slice(0, cutoff) : scripts).forEach((s) => { try { vm.runInContext(fs.readFileSync(path.join(ROOT, s), 'utf8'), sandbox, { filename: s, timeout: 20000 }); } catch (e) {} });

ok(vm.runInContext('!!(typeof FiscalEngine!=="undefined" && typeof FiscalEngine.calcSalary==="function" && typeof FiscalEngine._salaryActualBodies==="function")', sandbox), 'boot 后 FiscalEngine.calcSalary / _salaryActualBodies 可调');

// ── 实有人数 _salaryActualBodies ──
function bodies(pos) { sandbox.__pos = pos; return vm.runInContext('FiscalEngine._salaryActualBodies(__pos)', sandbox); }
ok(bodies({ holder: '主官', actualHolders: [{ name: '甲' }, { name: '乙' }, { name: '丙' }, { name: '丁' }, { name: '戊' }] }) === 5, '真码：5 名 actualHolders → 实有 5');
ok(bodies({ holder: '主官', additionalHolders: ['乙', '丙'] }) === 3, '真码：holder + 2 additionalHolders(旧模型) → 实有 3');
ok(bodies({ holder: '空缺' }) === 0, '真码：空缺 → 实有 0');
ok(bodies({ holder: '主官', actualHolders: [{ name: '甲', generated: false }] }) === 1, '真码：未具象占位(generated:false)不计·回退 holder=1');

// ── calcSalary 俸禄总额 ──
function payroll(tree, flagOn) {
  sandbox.GM = { turn: 5, officeTree: tree, turnDays: 30 };
  sandbox.P = { conf: flagOn ? { officeSalaryHeadcountEnabled: true } : {} };
  const r = vm.runInContext('FiscalEngine.calcSalary({ turnDays: 30 })', sandbox);
  return r && r.total ? (r.total.money + r.total.grain + r.total.cloth) : null;
}
const superTree = () => [{ name: '某部', positions: [{ name: '主事', rank: '正七品', salary: 100, establishedCount: 1, holder: '主官', actualHolders: [{ name: '甲' }, { name: '乙' }, { name: '丙' }, { name: '丁' }, { name: '戊' }] }] }];
const normalTree = () => [{ name: '某部', positions: [{ name: '主事', rank: '正七品', salary: 100, establishedCount: 1, holder: '主官' }] }];
const vacantTree = () => [{ name: '某部', positions: [{ name: '主事', rank: '正七品', salary: 100, establishedCount: 1, holder: '空缺' }] }];

const supOff = payroll(superTree(), false);
const supOn = payroll(superTree(), true);
ok(supOff > 0, '真码：超编职位 flag 关俸禄基线 > 0（' + supOff + '）');
ok(supOn > supOff, '真码：超编职位 flag 开 → 俸禄上升（' + supOn + ' > ' + supOff + '）·冗官有财政代价');
ok(Math.abs(supOn - supOff * 5) < 1e-6, '真码：5 人超编(编制虚拟在岗=1) → 俸禄恰 5×（按实有计俸）');

const normOff = payroll(normalTree(), false);
const normOn = payroll(normalTree(), true);
ok(normOff === normOn, '真码：常编(实有≤虚拟在岗)flag 开关俸禄不变（' + normOff + '·只惩超编）');

const vacOff = payroll(vacantTree(), false);
const vacOn = payroll(vacantTree(), true);
ok(vacOff === vacOn, '真码：空缺职位 flag 开关俸禄不变（' + vacOff + '·缺员不另算）');

console.log('\nsmoke-s1e-salary-headcount: ' + (fail === 0 ? 'PASS' : 'FAIL') + ' ' + pass + '/' + (pass + fail));
process.exit(fail > 0 ? 1 : 0);
