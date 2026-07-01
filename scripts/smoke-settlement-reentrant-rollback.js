'use strict';
// ============================================================
// smoke-settlement-reentrant-rollback.js — S8 map/经济结算可重入(agent 推演确定性)
//   bug:agent engine-first 跑结算后自检不过/引擎抛错 → _rollback 只 deepClone(GM) 复位·
//       但结算还累加了两个「活在 GM 之外的 module 级单例」:
//       ① AccountingSystem.ledger(收支 push+=) ② StateCouplingSystem.previousValues(耦合基线)
//       回滚盖不到 → LLM 模式重跑结算二次累加 → 账本双记 / 耦合基线污染漂进已提交回合。
//   修:随 GM 快照一并快照这两单例(_snapshotExternals)·回滚一并还原(_rollback extSnap 第4参)。
//   验:①②真模块 API+agent 接线源码守卫 ③直调 rollback 还原单例+3参向后兼容
//       ④引擎抛错→显式回滚还原单例 ⑤自检不过→bail 回滚还原单例 ⑥happy 不还原(已提交)
//   注:真 50-tick 引擎 node 跑不动·单例用记录型 stub 挂 globalThis 验编排闭环(同 s5 范式)。
// ============================================================
const fs = require('fs');
const path = require('path');
const { ROOT, makeAssert } = require('./smoke-endturn-baseline-helpers');
const passed = { value: 0 };
const assert = makeAssert(passed);

// ── ① 真模块 API:两单例暴露 snapshot/restore ──
const cqSrc = fs.readFileSync(path.join(ROOT, 'tm-change-queue.js'), 'utf8');
const mechSrc = fs.readFileSync(path.join(ROOT, 'tm-mechanics.js'), 'utf8');
assert(/function restoreLedger\(snap\)/.test(cqSrc) && /restoreLedger: restoreLedger/.test(cqSrc), '① AccountingSystem 加 restoreLedger 并暴露');
assert(/function getPreviousValues\(\)/.test(mechSrc) && /getPreviousValues: getPreviousValues/.test(mechSrc), '① StateCouplingSystem 加 getPreviousValues 并暴露');
assert(/function restorePreviousValues\(snap\)/.test(mechSrc) && /restorePreviousValues: restorePreviousValues/.test(mechSrc), '① StateCouplingSystem 加 restorePreviousValues 并暴露');

// ── ② agent-mode 接线源码守卫 ──
const amSrc = fs.readFileSync(path.join(ROOT, 'tm-endturn-agent-mode.js'), 'utf8');
assert(/function _rollback\(gm, snapshot, ctx, extSnap\)/.test(amSrc), '② _rollback 加可选第4参 extSnap');
assert(/_restoreExternals\(extSnap\)/.test(amSrc) && /function _restoreExternals/.test(amSrc), '② _rollback 内调 _restoreExternals');
assert(/var _extSnap = _snapshotExternals\(\)/.test(amSrc), '② run() 结算前捕获 _extSnap');
assert((amSrc.match(/_rollback\(gm, snapshot, ctx, _extSnap\)/g) || []).length >= 2, '② 两处回滚点(bail+引擎抛错)都传 _extSnap');

// ── 真集成:stub 两单例挂 globalThis + require agent-mode(同 s5) ──
function makeAcctStub() {
  var ledger = { items: [], totalIncome: 0 };
  return {
    getLedger: function () { return JSON.parse(JSON.stringify(ledger)); },
    restoreLedger: function (s) { if (s && typeof s === 'object') ledger = JSON.parse(JSON.stringify(s)); },
    addIncome: function (n, a) { ledger.items.push({ name: n, amount: a }); ledger.totalIncome += a; },
    _peek: function () { return ledger; }
  };
}
function makeCoupStub() {
  var prev = {};
  return {
    getPreviousValues: function () { return JSON.parse(JSON.stringify(prev)); },
    restorePreviousValues: function (s) { if (s && typeof s === 'object') prev = JSON.parse(JSON.stringify(s)); },
    updateSnapshot: function (vals) { prev = JSON.parse(JSON.stringify(vals || {})); },
    _peek: function () { return prev; }
  };
}
globalThis.AccountingSystem = makeAcctStub();
globalThis.StateCouplingSystem = makeCoupStub();

require(path.join(ROOT, 'tm-ai-change-pathutils.js'));
require(path.join(ROOT, 'tm-endturn-agent-read-tools.js'));
require(path.join(ROOT, 'tm-endturn-agent-write-tools.js'));
require(path.join(ROOT, 'tm-endturn-agent-mode.js'));
const AM = globalThis.TM.Endturn.AgentMode;

function makeGM() {
  return { turn: 7, eraName: '建炎元年', guoku: 12000, neitang: 3000, chars: [{ id: 'c1', name: '张三', mood: '平' }], facs: [{ name: '北府' }], evtLog: [], memorials: [], _turnReport: [] };
}
function setScript(arr) { let i = 0; globalThis.callAIWithTools = async function () { return arr[i++] || { toolCalls: [], text: '' }; }; }

// ── ③ 直调 rollback:还原 GM 外单例 + 3参向后兼容 ──
(function () {
  globalThis.AccountingSystem = makeAcctStub();
  globalThis.StateCouplingSystem = makeCoupStub();
  let g = makeGM(); const snap = AM.snapshot(g);
  const extSnap = { acct: globalThis.AccountingSystem.getLedger(), coupling: globalThis.StateCouplingSystem.getPreviousValues() };
  // 污染单例(模拟结算)
  globalThis.AccountingSystem.addIncome('税', 500);
  globalThis.StateCouplingSystem.updateSnapshot({ 民心: 99 });
  g.turn = 99;
  assert(AM.rollback(g, snap, { input: { _systemsRan: true } }, extSnap) === true, '③ rollback(4参) 返回 true');
  assert(g.turn === 7, '③ GM 还原');
  assert(globalThis.AccountingSystem._peek().items.length === 0 && globalThis.AccountingSystem._peek().totalIncome === 0, '③ 账本单例还原(items 0·收入 0)');
  assert(Object.keys(globalThis.StateCouplingSystem._peek()).length === 0, '③ 耦合基线单例还原(空)');
  // 3 参向后兼容(s5 老调用)——不动单例
  globalThis.AccountingSystem.addIncome('杂', 7);
  let g2 = makeGM(); const snap2 = AM.snapshot(g2); g2.turn = 50;
  assert(AM.rollback(g2, snap2, { input: {} }) === true && g2.turn === 7, '③ rollback(3参) 向后兼容(GM 还原)');
  assert(globalThis.AccountingSystem._peek().items.length === 1, '③ 3参不传 extSnap → 不动单例(向后兼容·s5 不破)');
})();

(async function () {
  // ── ④ 引擎抛错(已污染单例)→ 显式回滚还原单例 ──
  (function reset() { globalThis.AccountingSystem = makeAcctStub(); globalThis.StateCouplingSystem = makeCoupStub(); })();
  let gm = makeGM(); let ctx = { GM: gm, input: {} };
  globalThis.P = undefined;
  globalThis._endTurn_updateSystems = async function () {
    gm.turn += 1; gm.guoku = 999;
    globalThis.AccountingSystem.addIncome('税', 300);            // 结算污染账本
    globalThis.StateCouplingSystem.updateSnapshot({ 民心: 80 }); // 结算污染耦合基线
    throw new Error('引擎炸');
  };
  setScript([{ toolCalls: [], text: '' }]);
  let res = await AM.run(ctx);
  assert(res.fallback === true && /引擎基线/.test(res.reason || ''), '④ 引擎抛错 → 回落 LLM');
  assert(gm.turn === 7 && gm.guoku === 12000, '④ GM 回滚(turn/guoku 还原)');
  assert(globalThis.AccountingSystem._peek().items.length === 0, '④ 账本单例随显式回滚还原(防 LLM 重跑双记)');
  assert(Object.keys(globalThis.StateCouplingSystem._peek()).length === 0, '④ 耦合基线单例随显式回滚还原(防基线污染)');

  // ── ⑤ 自检不过(引擎留 NaN·已污染单例)→ bail 回滚还原单例 ──
  (function reset() { globalThis.AccountingSystem = makeAcctStub(); globalThis.StateCouplingSystem = makeCoupStub(); })();
  gm = makeGM(); ctx = { GM: gm, input: {} };
  globalThis._endTurn_updateSystems = async function () {
    gm.turn += 1; gm.guoku = NaN;
    globalThis.AccountingSystem.addIncome('税', 500);
    globalThis.StateCouplingSystem.updateSnapshot({ 民心: 70 });
  };
  setScript([
    { toolCalls: [{ name: 'set_field', input: { path: 'chars.0.mood', value: '忧', reason: '心绪' } }], text: '' },
    { toolCalls: [{ name: 'finalize_turn', input: { summary: '推演' } }], text: '' }
  ]);
  res = await AM.run(ctx);
  assert(res.fallback === true && /自检/.test(res.reason || ''), '⑤ 自检不过 → 回落 LLM');
  assert(gm.turn === 7 && gm.guoku === 12000, '⑤ GM 回滚还原');
  assert(globalThis.AccountingSystem._peek().items.length === 0, '⑤ 账本单例随 bail 回滚还原');
  assert(Object.keys(globalThis.StateCouplingSystem._peek()).length === 0, '⑤ 耦合基线单例随 bail 回滚还原');

  // ── ⑥ happy(提交·无回滚)→ 单例 NOT 还原(不过度还原·结算已生效) ──
  (function reset() { globalThis.AccountingSystem = makeAcctStub(); globalThis.StateCouplingSystem = makeCoupStub(); })();
  gm = makeGM(); ctx = { GM: gm, input: { edicts: ['赈灾'] }, results: {} };
  globalThis._endTurn_updateSystems = async function () {
    gm.turn += 1; gm.guoku += 500;
    globalThis.AccountingSystem.addIncome('税', 500);
    return { ok: true, appliedCount: 1, failedCount: 0 };
  };
  setScript([
    { toolCalls: [{ name: 'adjust_field', input: { path: 'guoku', delta: -1000, reason: '赈灾' } }], text: '' },
    { toolCalls: [{ name: 'finalize_turn', input: { narrative: '开仓赈灾', summary: '赈灾' } }], text: '' }
  ]);
  res = await AM.run(ctx);
  assert(res.ok === true && res.fallback === false, '⑥ happy → 提交(无回滚)');
  assert(globalThis.AccountingSystem._peek().items.length === 1, '⑥ 提交时账本单例保留结算记账(不过度还原)');

  console.log('[smoke-settlement-reentrant-rollback] pass assertions=' + passed.value);
})().catch(function (e) { console.error(e); process.exit(1); });
