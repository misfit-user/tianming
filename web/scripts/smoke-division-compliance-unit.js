#!/usr/bin/env node
'use strict';
// 合规率单位（2026-10-16）
//   案：开发群 E.B 自建剧本「我明明设定的是回合入三百万…上期回合入 1.4 亿」。真档（文泰元年 T2）里 275 个叶子
//       fiscal.compliance ≈ 85（百分数），剧本模板是 0.86（比例）。tm-minxin-hard-links 非统一账本分支把合规率写成
//       round2(collection*100)，cascade splitCascadeAmount 拿它直接乘上解额 → 中央岁入 ×85。
//   根治：写侧统一按 0..1 比例写；读侧（_ensureRegionFiscal / splitCascadeAmount / budgetRevenue）把旧档残留的百分数折回。
//   本 smoke 把 MinxinHardLinks 与 CascadeTax 装进同一沙盒，钉写侧口径、读侧折回、以及端到端「上解不可能超过税额」。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
function ok(condition, message) {
  if (condition) { pass++; console.log('  PASS - ' + message); }
  else { fail++; console.error('  FAIL - ' + message); }
}
function makeSandbox() {
  const sandbox = {
    console: { log() {}, warn() {}, error() {}, info() {}, debug() {} },
    Math, Date, JSON, RegExp, Error, Array, Object, String, Number, Boolean, parseInt, parseFloat, isNaN, isFinite,
    setTimeout: fn => { if (typeof fn === 'function') fn(); return 1; }, clearTimeout() {}, addEB() {}, toast() {},
    GM: null, P: {}
  };
  sandbox.window = sandbox; sandbox.global = sandbox; sandbox.globalThis = sandbox;
  sandbox.TM = { errors: { capture() {}, captureSilent() {} } };
  sandbox.IntegrationBridge = {
    getLeafDivisions(adminHierarchy) {
      const out = [];
      (function walk(nodes) {
        (Array.isArray(nodes) ? nodes : []).forEach(node => {
          if (!node || typeof node !== 'object') return;
          const kids = node.children || node.divisions || node.subs || [];
          if (kids.length) walk(kids); else out.push(node);
        });
      })(Object.keys(adminHierarchy || {}).map(k => (adminHierarchy[k] || {}).divisions || []).flat());
      return out;
    }
  };
  vm.createContext(sandbox);
  ['tm-patches-start.js', 'tm-fiscal-engine.js', 'tm-minxin-hard-links.js'].forEach(name => {
    vm.runInContext(fs.readFileSync(path.join(ROOT, name), 'utf8'), sandbox, { filename: name });
  });
  return sandbox;
}
const TURN_DAYS = 30;
const FARMLAND = 1000000, RATE = 0.01;
const GROSS_TAX = Math.round(FARMLAND * RATE * TURN_DAYS / 365); // 单税种本回合税额上限（上解 ≤ 此数）
const AUTHORED_TAX = { taxes: [{ id: 't1', name: '田赋', base: 'arableLand', baseFactor: 1, rate: RATE, storeAs: 'money', sourceTag: 'tianfu', annual: true }] };
function leaf(id, extra) {
  return Object.assign({
    id: id, name: id, minxin: 60, minxinLocal: 60, population: 100000,
    populationDetail: { households: 20000, mouths: 100000, ding: 40000, hiddenCount: 0, fugitives: 0 },
    fiscalDetail: { claimedRevenue: 200000, actualRevenue: 180000, remittedToCenter: 120000, skimmingRate: 0.1 },
    economyBase: { farmland: FARMLAND }, corruptionLocal: 30, minxinDetails: { trueIndex: 60 }
  }, extra || {});
}
function world(divisions, fiscalConfig) {
  return {
    turn: 1, guoku: { money: 100000, grain: 80000 }, military: { reserves: 6000 },
    corruption: { trueIndex: 40, perceivedIndex: 40, subDepts: { provincial: { true: 40 } } },
    minxin: { trueIndex: 60, perceivedIndex: 60, byRegion: {}, byClass: {}, sources: {} }, classes: [],
    adminHierarchy: { player: { divisions: divisions } }, fiscalConfig: fiscalConfig || AUTHORED_TAX
  };
}
function collect(sb) { return sb.CascadeTax.collect({ faction: 'player', turnDays: TURN_DAYS, force: true }); }

console.log('[smoke-division-compliance-unit]');

{ // 写侧：非统一账本分支的 MinxinHardLinks.tick 写出 0..1 比例，与 minxinCollectionMultiplier 同口径
  const sb = makeSandbox();
  sb.GM = world([leaf('heavy', { taxLevel: 'heavy', minxin: 22, minxinLocal: 22, minxinDetails: { trueIndex: 22 }, corruptionLocal: 82 }), leaf('light', { taxLevel: 'light', minxin: 80, minxinLocal: 80, minxinDetails: { trueIndex: 80 } })]);
  sb.MinxinHardLinks.tick(sb.GM, { turn: 1 });
  const leaves = sb.GM.adminHierarchy.player.divisions;
  ok(leaves.every(d => d.fiscalDetail && typeof d.fiscalDetail.compliance === 'number' && d.fiscalDetail.compliance >= 0 && d.fiscalDetail.compliance <= 1),
    'non-unified tick writes fiscalDetail.compliance as a 0..1 ratio :: ' + leaves.map(d => d.fiscalDetail.compliance).join(','));
  ok(leaves.every(d => Math.abs(d.fiscalDetail.compliance - d.fiscalDetail.minxinCollectionMultiplier) < 0.02),
    'compliance and minxinCollectionMultiplier agree in unit (ratio, not percent)');
  ok(leaves[0].fiscalDetail.compliance < leaves[1].fiscalDetail.compliance, 'low-minxin heavy-tax leaf collects worse than the content light-tax leaf');
}

{ // 读侧：旧档里残留的百分数（85）与比例（0.85）产出同一上解额，并被就地折回
  const sbRatio = makeSandbox(); sbRatio.GM = world([leaf('d', { fiscal: { compliance: 0.85 } })]);
  const sbPercent = makeSandbox(); sbPercent.GM = world([leaf('d', { fiscal: { compliance: 85 } })]);
  const r1 = collect(sbRatio), r2 = collect(sbPercent);
  ok(r1 && r1.ok !== false && r2 && r2.ok !== false, 'both collections succeed');
  ok(sbRatio.GM.guoku.turnIncome > 0 && sbRatio.GM.guoku.turnIncome === sbPercent.GM.guoku.turnIncome,
    'a legacy percent compliance yields the same central income as the ratio form :: ' + sbRatio.GM.guoku.turnIncome + ' vs ' + sbPercent.GM.guoku.turnIncome);
  ok(sbPercent.GM.adminHierarchy.player.divisions[0].fiscal.compliance === 0.85, 'the percent value is normalised in place to 0.85');
  ok(sbRatio.GM.guoku.turnIncome <= GROSS_TAX, 'central income never exceeds the gross tax of the turn (' + sbRatio.GM.guoku.turnIncome + ' <= ' + GROSS_TAX + ')');
}

{ // 读侧：只有 fiscalDetail（无 fiscal）的叶子带百分数 → 首次 cascade 克隆进 fiscal 时折回（E.B 真档成因：09-28 后开局只读，首回合才建 fiscal）
  const sb = makeSandbox();
  sb.GM = world([leaf('d', { fiscalDetail: { claimedRevenue: 200000, actualRevenue: 180000, remittedToCenter: 120000, skimmingRate: 0.1, compliance: 85.57 } })]);
  collect(sb);
  const d = sb.GM.adminHierarchy.player.divisions[0];
  ok(Math.abs(d.fiscal.compliance - 0.8557) < 1e-9, 'fiscalDetail percent is folded back when fiscal is first derived from it :: ' + d.fiscal.compliance);
  ok(sb.GM.guoku.turnIncome <= GROSS_TAX, 'and the income stays within the gross tax (' + sb.GM.guoku.turnIncome + ' <= ' + GROSS_TAX + ')');
}

{ // 端到端：tick → collect（E.B 的回合顺序）·上解不可能超过税额·fiscal 与 fiscalDetail 同口径
  const sb = makeSandbox();
  sb.GM = world([leaf('a'), leaf('b', { minxin: 30, minxinLocal: 30, minxinDetails: { trueIndex: 30 } })]);
  sb.MinxinHardLinks.tick(sb.GM, { turn: 1 });
  const res = collect(sb);
  ok(res && res.ok !== false, 'tick then collect succeeds');
  const leaves = sb.GM.adminHierarchy.player.divisions;
  ok(leaves.every(d => d.fiscal.compliance >= 0 && d.fiscal.compliance <= 1), 'fiscal.compliance derived from the tick is a ratio :: ' + leaves.map(d => d.fiscal.compliance).join(','));
  ok(sb.GM.guoku.turnIncome > 0 && sb.GM.guoku.turnIncome <= 2 * GROSS_TAX, 'two leaves remit at most two gross taxes (' + sb.GM.guoku.turnIncome + ' <= ' + (2 * GROSS_TAX) + ')');
}

{ // 统一账本 budgetRevenue 同口径：百分数折回（不是夹成 1）
  const sb = makeSandbox();
  const src = fs.readFileSync(path.join(ROOT, 'tm-fiscal-engine.js'), 'utf8');
  ok(/collected=fiscalRound\(eligible\*_complianceRatio\(div\.fiscal\.compliance,1\)\)/.test(src), 'unified budgetRevenue reads compliance through the same ratio normaliser');
  ok(!/fd\.compliance=round2\(collection\*100\)/.test(fs.readFileSync(path.join(ROOT, 'tm-minxin-hard-links.js'), 'utf8')), 'the percent writer is gone from tm-minxin-hard-links');
  void sb;
}

{ // 2026-10-17 复审（Astra 6）统一账本分支：tick 收到旧百分数（85）先折回比例，不再先被夹成 1
  const sb = makeSandbox();
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-fiscal-statements.js'), 'utf8'), sb, { filename: 'tm-fiscal-statements.js' }); // 统一账本分支要用 FiscalStatement
  const fc = Object.assign({ accounting: { schema: 'tm-fiscal-ledger/2' } }, AUTHORED_TAX);
  sb.GM = world([leaf('pct', { fiscal: { compliance: 85 } }), leaf('ratio', { fiscal: { compliance: 0.85 } })], fc);
  ok(sb.CascadeTax.isUnified(sb.GM, 'player'), '夹具确实走统一账本分支');
  sb.MinxinHardLinks.tick(sb.GM, { turn: 1 });
  const pct = sb.GM.adminHierarchy.player.divisions[0], ratio = sb.GM.adminHierarchy.player.divisions[1];
  ok(Math.abs(pct.fiscal.compliance - ratio.fiscal.compliance) < 1e-9 && pct.fiscal.compliance < 1, '统一分支：百分数 85 与比例 0.85 结果相同（' + pct.fiscal.compliance + ' / ' + ratio.fiscal.compliance + '）');
}

console.log('\n[smoke-division-compliance-unit] ' + pass + ' passed / ' + fail + ' failed');
process.exit(fail ? 1 : 0);
