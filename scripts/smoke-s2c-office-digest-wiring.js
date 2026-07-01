/*
 * smoke-s2c-office-digest-wiring.js — S2 官制后果接入 World Reaction Bus digest（官制成为反应总线一个域）
 *   ②履职失职/称职 + ③加赋失实 → 推 GM._chronicle 联动项（type=官制↔财政·吏治·tags含联动）
 *   → WorldDigest.collect/promptBlock 前景化进「天下牵动·因果综述」。flag 关→不写=零回归。
 *   ★测真代码：headless 调真 _applyTaxAuthorityGate → 真 WorldDigest.collect/promptBlock 端到端。
 * node scripts/smoke-s2c-office-digest-wiring.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const HEADLESS = path.join(__dirname, 'headless-smoke.js');
let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log('  ✗ FAIL: ' + m); } }

// ════════ 一·源契约：②③ 均推 chronicle 联动(官制↔ + 联动 tag) ════════
const applierSrc = fs.readFileSync(path.join(ROOT, 'tm-ai-change-applier.js'), 'utf8');
ok(/百官履职[\s\S]{0,300}tags: \['联动', '官制'\]/.test(applierSrc), '②履职结算 → chronicle 联动(官制)');
ok(/掌征税之权[\s\S]{0,300}tags: \['联动', '官制'\]/.test(applierSrc), '③加赋失实 → chronicle 联动(官制)');
ok(/type: \(agg\.compliance !== 0 && agg\.corruption !== 0\) \? '官制↔财政·吏治'/.test(applierSrc), '②按 compliance/corruption 取 官制↔财政/吏治 域');

// ════════ 二·真代码：headless → _applyTaxAuthorityGate → WorldDigest 端到端 ════════
function loadHeadlessHelpers() { const s = fs.readFileSync(HEADLESS, 'utf8').replace(/^#![^\n]*\n/, '').replace(/\nmain\(\);\s*$/, '\nreturn { makeStubs, parseIndexHtmlScripts };'); return (new Function('require', 'process', '__dirname', '__filename', 'module', 'exports', s))(require, process, __dirname, HEADLESS, { exports: {} }, {}); }
const helpers = loadHeadlessHelpers();
const env = helpers.makeStubs();
const sandbox = vm.createContext(env.win);
const scripts = helpers.parseIndexHtmlScripts();
const cutoff = scripts.findIndex((s) => path.basename(s) === 'tm-test-harness.js');
(cutoff >= 0 ? scripts.slice(0, cutoff) : scripts).forEach((s) => { try { vm.runInContext(fs.readFileSync(path.join(ROOT, s), 'utf8'), sandbox, { filename: s, timeout: 20000 }); } catch (e) {} });

ok(vm.runInContext('typeof _applyTaxAuthorityGate === "function" && !!(typeof WorldDigest !== "undefined" && WorldDigest.collect)', sandbox), 'boot 后 _applyTaxAuthorityGate + WorldDigest.collect 可调');

function taxGate(flagOn, amount) {
  sandbox.GM = { turn: 5, chars: [], _chronicle: [], officeTree: [{ name: '户部', positions: [{ name: '尚书', rank: '正二品', holder: null, powers: { taxCollect: true } }] }] };
  sandbox.P = { conf: flagOn ? { officeAuthorityGateEnabled: true } : {}, playerInfo: {} };
  sandbox.__fa = { kind: 'income', category: '田赋', name: '田赋' };
  sandbox.__amt = amount;
  const collected = vm.runInContext('_applyTaxAuthorityGate(GM, __fa, __amt)', sandbox);
  const chron = vm.runInContext('GM._chronicle.slice()', sandbox);
  return { collected, chron };
}

// (a) flag 关 → 不打折·不写 chronicle（零回归）
const off = taxGate(false, 1000);
ok(off.collected === 1000, '真码：flag 关 → 加赋足额(1000)·不打折（零回归）');
ok(off.chron.length === 0, '真码：flag 关 → 不写 chronicle 联动（零回归）');

// (b) flag 开 → 掌征税主官出缺 → 实征打折 + 写 chronicle 官制↔ 联动
const on = taxGate(true, 1000);
ok(on.collected < 1000, '真码：flag 开 → 加赋失实·实收打折（' + on.collected + ' < 1000）');
ok(on.chron.length >= 1, '真码：flag 开 → 写入 chronicle 联动项');
const ce = on.chron.find(e => e && /官制/.test(String(e.type)) && Array.isArray(e.tags) && e.tags.indexOf('联动') >= 0);
ok(!!ce, '真码：chronicle 项 type 含官制↔ 且 tags 含「联动」');
ok(ce && /掌征税之权/.test(ce.text) && /中饱/.test(ce.text), '真码：chronicle 文记 掌征税之权失效·漏额中饱');

// (c) WorldDigest.collect 前景化该联动项（官制进入「天下牵动」因果综述）
const items = vm.runInContext('WorldDigest.collect(GM, { turnsBack: 1 })', sandbox);
ok(Array.isArray(items) && items.length >= 1, 'WorldDigest.collect 返回项');
const di = items.find(it => /官制/.test(String(it.domain)) && /掌征税之权/.test(String(it.line)));
ok(!!di, 'WorldDigest.collect 含官制↔财政 联动行（官制成为反应总线一个域）');

// (d) promptBlock 真把官制联动写进「天下牵动·因果综述」
const block = vm.runInContext('WorldDigest.promptBlock(GM, { turnsBack: 1 })', sandbox);
ok(typeof block === 'string' && block.indexOf('天下牵动') >= 0 && block.indexOf('掌征税之权') >= 0, 'promptBlock 含官制联动行（注入推演的因果综述）');

console.log('\nsmoke-s2c-office-digest-wiring: ' + (fail === 0 ? 'PASS' : 'FAIL') + ' ' + pass + '/' + (pass + fail));
process.exit(fail > 0 ? 1 : 0);
