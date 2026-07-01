/*
 * smoke-s2b-duty-authority-reform.js — S2 ②履职度 行为验证 + ②③④ 接线源契约
 *   ②履职度(officeDutyStateEnabled)：tickOfficeDutyState 漂向承载力(域才0.6+德0.4)·出缺快衰·
 *     失职(<35)扣实征率/涨腐败·称职(>70)反之·mid 中性。已接 applier:1953(_applyOfficeDutyTick→FE)。
 *   ③权限门(officeAuthorityGateEnabled)：_applyTaxAuthorityGate 接 applier:1645 税入循环·按掌征税权者执行力打折。
 *   ④改制裁定(officeReformAdjudicationEnabled)：adjudicatePendingReforms 接 apply:3115·computeReformResistance 机械band。
 *   ★测真代码：headless 调真 tickOfficeDutyState + 四刀接线源契约。
 * node scripts/smoke-s2b-duty-authority-reform.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const HEADLESS = path.join(__dirname, 'headless-smoke.js');
let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log('  ✗ FAIL: ' + m); } }

// ════════ 一·②③④ 接线源契约（flag 门控 + 真被调用·非仅定义）════════
const applierSrc = fs.readFileSync(path.join(ROOT, 'tm-ai-change-applier.js'), 'utf8');
ok(/officeFlagOn\('officeDutyStateEnabled'\)[\s\S]{0,200}tickOfficeDutyState\(G\)/.test(applierSrc), '②_applyOfficeDutyTick flag门控调 tickOfficeDutyState');
ok(/try \{ _applyOfficeDutyTick\(G\); \}/.test(applierSrc), '②_applyOfficeDutyTick 每回合被调用(非仅定义)');
ok(/adjustPlayerCompliance\(pFac, agg\.compliance/.test(applierSrc) && /adjustPlayerDivisionCorruption\(pFac, agg\.corruption/.test(applierSrc), '②delta 真施加到 FE 实征率/腐败');
ok(/amount = _applyTaxAuthorityGate\(G, fa, amount\)/.test(applierSrc), '③_applyTaxAuthorityGate 真接税入循环(applier:1645)');
ok(/officeFlagOn\('officeAuthorityGateEnabled'\)/.test(applierSrc) && /resolveOfficeAuthority\(G, 'taxCollect'\)/.test(applierSrc), '③flag门控 + 调 resolveOfficeAuthority 打折');
const applySrc = fs.readFileSync(path.join(ROOT, 'tm-endturn-apply.js'), 'utf8');
ok(/officeFlagOn\('officeReformAdjudicationEnabled'\)[\s\S]{0,80}adjudicatePendingReforms\(GM/.test(applySrc), '④adjudicatePendingReforms flag门控被调用(apply:3115)');
ok(/officeFlagOn\('officeDutyStateEnabled'\)[\s\S]{0,80}applyNpcActionToDuty/.test(applySrc), '④B·npc_action→履职反哺 flag门控(apply:819)');

// ════════ 二·真代码：headless 调真 tickOfficeDutyState ════════
function loadHeadlessHelpers() { const s = fs.readFileSync(HEADLESS, 'utf8').replace(/^#![^\n]*\n/, '').replace(/\nmain\(\);\s*$/, '\nreturn { makeStubs, parseIndexHtmlScripts };'); return (new Function('require', 'process', '__dirname', '__filename', 'module', 'exports', s))(require, process, __dirname, HEADLESS, { exports: {} }, {}); }
const helpers = loadHeadlessHelpers();
const env = helpers.makeStubs();
const sandbox = vm.createContext(env.win);
const scripts = helpers.parseIndexHtmlScripts();
const cutoff = scripts.findIndex((s) => path.basename(s) === 'tm-test-harness.js');
(cutoff >= 0 ? scripts.slice(0, cutoff) : scripts).forEach((s) => { try { vm.runInContext(fs.readFileSync(path.join(ROOT, s), 'utf8'), sandbox, { filename: s, timeout: 20000 }); } catch (e) {} });

ok(vm.runInContext('typeof tickOfficeDutyState === "function" && typeof resolveOfficeAuthority === "function" && typeof computeReformResistance === "function"', sandbox), 'boot 后 ②③④ 真函数全可调');

const lowCap = { name: '庸吏', administration: 18, military: 18, management: 18, intelligence: 18, wuchang: { yi: 25, xin: 25, li: 25, ren: 25, zhi: 25 } };
const highCap = { name: '干吏', administration: 90, military: 90, management: 90, intelligence: 90, wuchang: { yi: 88, xin: 88, li: 85, ren: 85, zhi: 85 } };
const midCap = { name: '寻常', administration: 50, military: 50, management: 50, intelligence: 50, wuchang: { yi: 50, xin: 50, li: 50, ren: 50, zhi: 50 } };
function tick1(holder, powers, fulfillment, chars) {
  const p = { name: '某职', rank: '正三品', holder: holder, powers: powers, _dutyState: { fulfillment: fulfillment, trend: 'stable', lastTurn: null } };
  sandbox.GM = { turn: 1, chars: chars || [], officeTree: [{ name: '某部', positions: [p] }] };
  return vm.runInContext('tickOfficeDutyState(GM)', sandbox);
}

// ② 失职(<35)：掌征税 → 扣实征率；掌监察 → 涨腐败
let r1 = tick1('庸吏', { taxCollect: true }, 30, [lowCap]);
ok(r1.compliance < 0, '真码：失职·掌征税 → 实征率扣（compliance ' + r1.compliance + ' < 0）');
let r2 = tick1('庸吏', { supervise: true }, 30, [lowCap]);
ok(r2.corruption > 0, '真码：失职·掌监察 → 腐败涨（corruption ' + r2.corruption + ' > 0）');
// ② 称职(>70)：掌征税 → 奖实征率；掌监察 → 降腐败
let r3 = tick1('干吏', { taxCollect: true }, 80, [highCap]);
ok(r3.compliance > 0, '真码：称职·掌征税 → 实征率奖（compliance ' + r3.compliance + ' > 0）');
let r4 = tick1('干吏', { supervise: true }, 80, [highCap]);
ok(r4.corruption < 0, '真码：称职·掌监察 → 腐败降（corruption ' + r4.corruption + ' < 0）');
// ② 中性(35~70)：不奖不罚
let r5 = tick1('寻常', { taxCollect: true }, 50, [midCap]);
ok(r5.compliance === 0 && r5.corruption === 0, '真码：履职 mid(50) → 不奖不罚（中性带）');
// ② 出缺 → 快衰至失职
let r6 = tick1(null, { taxCollect: true }, 40, []);
ok(r6.compliance < 0, '真码：出缺·掌征税 → 衰至失职扣实征率（compliance ' + r6.compliance + ' < 0）');

// ③ resolveOfficeAuthority：掌征税权者出缺/失职 → effectiveness < 1（实征打折）
sandbox.GM = { turn: 1, chars: [], officeTree: [{ name: '户部', positions: [{ name: '尚书', rank: '正二品', holder: null, powers: { taxCollect: true } }] }] };
const auth = vm.runInContext('resolveOfficeAuthority(GM, "taxCollect")', sandbox);
ok(auth && typeof auth.effectiveness === 'number', '③resolveOfficeAuthority 返 effectiveness');
ok(auth.effectiveness < 1, '③掌征税主官出缺 → effectiveness < 1（' + (auth && auth.effectiveness) + '·实征打折）');

// ④ computeReformResistance：返机械抵抗 band（防放水地板）
sandbox.GM = {
  turn: 5, chars: [{ name: '某尚书', loyalty: 80, ambition: 40 }], huangwei: { index: 50 }, huangquan: { index: 50 },
  officeTree: [{ name: '某部', positions: [{ name: '尚书', rank: '正二品', holder: '某尚书', powers: { appointment: true } }] }]
};
const rr = vm.runInContext('computeReformResistance(GM, { dept: "某部", position: "尚书", reformDetail: "裁撤" }, { authority: 50, difficulty: "standard" })', sandbox);
ok(rr && typeof rr.resistance === 'number' && typeof rr.band === 'string', '④computeReformResistance 返 {resistance, band} 机械地板');

console.log('\nsmoke-s2b-duty-authority-reform: ' + (fail === 0 ? 'PASS' : 'FAIL') + ' ' + pass + '/' + (pass + fail));
process.exit(fail > 0 ? 1 : 0);
