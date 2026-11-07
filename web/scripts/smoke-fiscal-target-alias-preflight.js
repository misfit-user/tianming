#!/usr/bin/env node
// smoke-fiscal-target-alias-preflight.js — preflight fiscal 中文 target/kind 别名归一（2026-07-16·落库契约硬化刀②）
//   悬案(居平内帑案在档)：preflightAIWriteBack 的 fiscal 白名单只认英文 guoku/neitang/province:/income/expense·
//   AI 写中文别名(内帑/国库/太仓/收入/支出…)的 fiscal_adjustments 条目在 preflight 即被剔·而下游 applier 本有
//   中文容差归一(2026-06-02 bug A 修)能吃这些条目——preflight 比消费端更严=好账被冤杀。
//   本刀：preflight 校验前做同款中文→canonical 归一(镜像 applier 映射)·归一后再过白名单——真垃圾 target 照剔·中文好账放行。
//   端到端：真 preflightAIWriteBack(直闸判定) + 真 applyAITurnChanges(preflight→applier 落账)。
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');

let passed = 0;
function assert(cond, msg) { if (!cond) throw new Error('[assert] ' + msg); passed++; console.log('  ok - ' + msg); }

function load(ctx, file) { vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), ctx, { filename: file }); }

const ctx = {
  console,
  Math, Date, JSON, Object, Array, Number, String, Boolean, RegExp,
  isFinite, isNaN, parseInt, parseFloat,
  setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
  Error, TypeError, RangeError, GM: null, P: {}
};
ctx.window = ctx; ctx.global = ctx; ctx.globalThis = ctx;
ctx.TM = { errors: { capture() {}, captureSilent() {} } };
ctx._eb = [];
ctx.addEB = (cat, msg) => { ctx._eb.push({ cat, msg }); };
vm.createContext(ctx);

function freshGM() {
  return {
    turn: 42,
    chars: [], facs: [], parties: [], classes: [], armies: [], items: [], regions: [],
    guoku: { money: 5000000, balance: 5000000, monthlyIncome: 80000, monthlyExpense: 75000, extraIncome: [], extraExpense: [] },
    neitang: { money: 2000000, balance: 2000000, monthlyIncome: 60000, monthlyExpense: 50000, extraIncome: [], extraExpense: [] },
    _turnReport: []
  };
}
function run(fiscal) {
  ctx.GM = freshGM(); ctx._eb = [];
  const res = ctx.applyAITurnChanges({ fiscal_adjustments: fiscal });
  return { G: ctx.GM, res: res, eb: ctx._eb };
}

(function main() {
  // family-order 契约序：pathutils → army → narrative → applier → validators → reconcile
  load(ctx, 'tm-ai-change-pathutils.js');
  load(ctx, 'tm-ai-change-army.js');
  load(ctx, 'tm-ai-change-narrative.js');
  load(ctx, 'generated/tm-ai-change-applier.bundle.js');
  assert(typeof ctx.applyAITurnChanges === 'function', 'applyAITurnChanges 已加载');
  assert(typeof ctx.preflightAIWriteBack === 'function', 'preflightAIWriteBack 已加载');

  // ── 案1·★直闸判定：中文别名 target/kind 归一后全过 preflight(不被冤杀) ──
  {
    ctx.GM = freshGM();
    const ai = { fiscal_adjustments: [
      { target: '内帑', kind: '支出', name: '郊祀赏赉', amount: 100000 },   // 中文 target + 中文 kind
      { target: '国库', kind: '收入', name: '盐课',     amount: 200000 },
      { target: '太仓', kind: 'income', name: '田赋',   amount: 50000 },     // 中文 target + 英文 kind
      { target: '省:陕西', kind: '支出', name: '赈灾',  amount: 30000 }      // 中文 province 前缀
    ]};
    ctx.preflightAIWriteBack(ai, { source: 'test' });
    assert(ai.fiscal_adjustments.length === 4, '案1 ★中文别名 target/kind(内帑/国库/太仓/省:陕西·支出/收入)全过 preflight·好账不冤杀');
  }

  // ── 案2·★直闸判定：真垃圾 target/kind/零额照剔·仅合法条目留存(归一不放水) ──
  {
    ctx.GM = freshGM();
    const ai2 = { fiscal_adjustments: [
      { target: '月球基地', kind: 'income',  name: 'x', amount: 100 },   // 垃圾 target·归一落空
      { target: 'neitang',  kind: '飞天',    name: 'y', amount: 100 },   // 垃圾 kind·归一落空
      { target: 'guoku',    kind: 'income',  name: 'z', amount: 0 },     // 零额·invalid amount
      { target: 'neitang',  kind: 'expense', name: 'ok', amount: 500 }   // 合法 canonical(对照)
    ]};
    ctx.preflightAIWriteBack(ai2, {});
    assert(ai2.fiscal_adjustments.length === 1 && ai2.fiscal_adjustments[0].name === 'ok',
      '案2 ★垃圾 target(月球基地)/垃圾 kind(飞天)/零额仍被剔·仅合法条目留存(归一只救真别名·不放水)');
  }

  // ── 案3·★端到端：中文 target=内帑/kind=支出 过 preflight 后·被 applier 正确落账并作用于余额 ──
  {
    const { G } = run([{ target: '内帑', kind: '支出', name: '内帑赏赐', amount: 100000, reason: '郊祀赏赉' }]);
    assert(G.neitang.extraExpense.length === 1, '案3 中文 target=内帑/kind=支出 过 preflight 后·applier 落账(neitang.extraExpense)');
    assert(G.neitang.money === 2000000 - 100000, '案3 ★中文别名 fiscal 真作用于内帑余额(好账不再被 preflight 冤杀而漏账)');
  }

  // ── 案4·端到端：中文 target=太仓/kind=收入 → guoku 落账 ──
  {
    const { G } = run([{ target: '太仓', kind: '收入', name: '盐课增收', amount: 200000, reason: '两淮盐课' }]);
    assert(G.guoku.extraIncome.length === 1, '案4 中文 target=太仓/kind=收入 → guoku.extraIncome 落账');
    assert(G.guoku.money === 5000000 + 200000, '案4 真作用于国库余额');
  }

  // ── 案5·回归：英文 canonical target/kind 照旧落账(不误伤既有正路) ──
  {
    const { G } = run([{ target: 'neitang', kind: 'expense', name: '英文正路', amount: 100000 }]);
    assert(G.neitang.extraExpense.length === 1 && G.neitang.money === 2000000 - 100000, '案5 英文 canonical 回归·照旧落账不误伤');
  }

  // ── 案6·端到端：垃圾 target 经 preflight 剔除·不落任何库(未穿透到 applier) ──
  {
    const { G } = run([{ target: '月球', kind: 'income', name: '虚账', amount: 100000 }]);
    assert(G.guoku.extraIncome.length === 0 && G.neitang.extraIncome.length === 0, '案6 垃圾 target(月球)经 preflight 剔除·不落任何库');
  }

  // ── 案7~11·另一种写法 {subject, action, amount, note}（11-07·玩家 09-21 那局实录形状）：认得准的改成标准形状落账 ──
  {
    const alt = { subject: '太仓银库', action: '拨发陕西急赈', amount: -100000, note: '拨发十万两急救关中饥荒，户部帑藏极度告匮。' };
    const { G } = run([Object.assign({}, alt)]);
    const row = G.guoku.extraExpense[0];
    assert(G.guoku.extraExpense.length === 1 && G.guoku.money === 5000000 - 100000, '案7 ★负数为支出·太仓银库认作 guoku·落账（原来整条 missing target/kind）');
    assert(row && row.name === '拨发陕西急赈', '案7 action 记作名目');
    const rep = G._turnReport.find(r => r.type === 'fiscal_adj');
    assert(rep && rep.kind === 'expense' && rep.amount === 100000, '案7 _turnReport 记一笔支出 10 万');
  }
  {
    const { G } = run([{ subject: '户部', action: '出售虚衔冠带', amount: 30000, note: '续售监生资格，得银三万' }]);
    assert(G.guoku.extraIncome.length === 1 && G.guoku.money === 5000000 + 30000, '案8 正数看字面：出售为入·落 guoku 收入');
  }
  {
    const { G } = run([
      { subject: '太仓', action: '调整', amount: 50000 },                      // 正数又看不出出入：不改
      { subject: '陕西布政使司', action: '拨发赈银', amount: -20000 }           // 账户认不得（省账不猜）：不改
    ]);
    assert(G.guoku.extraIncome.length === 0 && G.guoku.extraExpense.length === 0 && G.guoku.money === 5000000, '案9 认不准的照旧剔·不猜');
  }
  {
    // 同批央地调拨是同一笔钱：只按调拨落，财政这条跳过（不扣两次）
    ctx.GM = freshGM();
    const batch = {
      fiscal_adjustments: [{ subject: '太仓银库', action: '拨发陕西急赈', amount: -100000, note: '急救关中饥荒' }],
      central_local_actions: [{ action: 'transfer_to_region', fromAccount: 'guoku.money', region: '陕西布政使司', amount: 100000, purpose: 'disaster_relief', reason: '赈济水灾' }]
    };
    const v = ctx.validateAIWriteBackBatch(batch, { source: 'test' });
    const fa = v.output.fiscal_adjustments[0];
    assert(fa.target === 'guoku' && fa.kind === 'expense' && /陕西布政使司/.test(fa._dupOfTransfer || ''), '案10 严格预检里就地改形、认出与调拨同一笔');
    assert(!v.failures.some(f => f.field === 'fiscal_adjustments'), '案10 严格预检不再把这条判 missing target/kind');
    assert(batch.fiscal_adjustments[0].target === undefined, '案10 严格预检只改副本，不动原批');
    ctx.GM = freshGM();
    ctx.applyAITurnChanges({ fiscal_adjustments: [Object.assign({}, batch.fiscal_adjustments[0])], central_local_actions: [] });
    const g1 = ctx.GM;
    assert(g1.guoku.extraExpense.length === 1, '案10 没有同批调拨时照常落一笔（去重只对同一笔钱）');
    ctx.GM = freshGM();
    ctx.applyAITurnChanges({ fiscal_adjustments: [Object.assign({}, batch.fiscal_adjustments[0])], central_local_actions: batch.central_local_actions.map(x => Object.assign({}, x)) });
    const g2 = ctx.GM;
    assert(g2.guoku.extraExpense.length === 0, '案11 ★与同批调拨同一笔：财政这条不再扣一次');
    assert(g2._turnReport.some(r => r.type === 'fiscal_adj_dedup' && r.requested === 100000), '案11 跳过留痕 fiscal_adj_dedup');
  }

  console.log('\nsmoke-fiscal-target-alias-preflight: ' + passed + ' assertions PASS');
})();
