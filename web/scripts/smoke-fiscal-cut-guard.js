#!/usr/bin/env node
// smoke-fiscal-cut-guard.js - fiscal_adjustments 裁减语义守卫 + 金额相称闸（2026-07-12·居平内帑案）
//   实证病根：AI 把「后宫裁减用度」错映射成 neitang expense 1300 万 + guoku income 1300 万——
//   省钱旨意被执行成巨款搬家（内帑真扣穿·国库凭空进账）。
//   刀1 裁减语义守卫：动词+宾语双匹配的节流令不动库存·记 fiscal_adj_rejected（独立 type·agent 写工具得 ok:false）。
//   刀2 金额相称闸：单条银两超 max(年流水×3, 100 万) 压至上限·留痕勿静默。

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

let passed = 0;
function assert(cond, msg) {
  if (!cond) throw new Error('[assert] ' + msg);
  passed++;
  console.log('  ok - ' + msg);
}

function load(ctx, file) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), ctx, { filename: file });
}

const ctx = {
  console,
  Math, Date, JSON, Object, Array, Number, String, Boolean, RegExp,
  isFinite, isNaN, parseInt, parseFloat, Promise, Symbol, Map, Set,
  setTimeout: () => 0, clearTimeout: () => {},
  setInterval: () => 0, clearInterval: () => {},
  Error, TypeError, RangeError,
  GM: null,
  P: {}
};
ctx.window = ctx;
ctx.global = ctx;
ctx.globalThis = ctx;
ctx.TM = { errors: { capture() {}, captureSilent() {} } };
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
  ctx.GM = freshGM();
  const res = ctx.applyAITurnChanges({ fiscal_adjustments: fiscal });
  return { G: ctx.GM, res: res };
}

(function main() {
  load(ctx, 'tm-ai-change-pathutils.js');
  load(ctx, 'tm-ai-change-army.js');
  load(ctx, 'tm-ai-change-narrative.js');
  load(ctx, 'tm-ai-change-applier.js');
  load(ctx, 'tm-ai-change-applier-validators.js');
  load(ctx, 'tm-ai-change-applier-reconcile.js');
  assert(typeof ctx.applyAITurnChanges === 'function', 'applyAITurnChanges 已加载');

  // ── 案1 复现原病·内帑侧：裁减用度 expense 1300 万 → 拦截·库存不动 ──
  //   注意 target 必须英文——reconcile preflight 白名单(reconcile.js:624)只认 guoku/neitang/province:*·
  //   中文 target 在 preflight 即被剔(applier 内中文归一因此在主链路挨不到·独立悬案·此处如实用英文复现)。
  {
    const { G, res } = run([{ target: 'neitang', kind: 'expense', name: '后宫裁减用度', amount: 13000000, reason: '上谕裁减后宫用度' }]);
    assert(G.neitang.money === 2000000, '案1 内帑库存分文未动（原病=直接扣穿）');
    assert(G.neitang.extraExpense.length === 0, '案1 无支出条目入账');
    const rej = G._turnReport.filter(e => e.type === 'fiscal_adj_rejected');
    assert(rej.length === 0, '案1 原子回滚后不在 GM 遗留未提交的 rejection 记录');
    assert(G._turnReport.every(e => e.type !== 'fiscal_adj'), '案1 无 fiscal_adj 条目（agent 写工具将正确得 ok:false）');
    assert(res.ok === false && res.rolledBack === true, '案1 语义守卫拒绝整批并原子回滚');
    assert(res.applied && res.applied.failed.some(f => f.fiscal_adjustment && /裁减/.test(String(f.reason))), '案1 applied.failed 留痕');
  }

  // ── 案2 复现原病·国库侧：节省银两 income 1300 万 → 拦截·不凭空进账 ──
  {
    const { G, res } = run([{ target: 'guoku', kind: 'income', name: '裁减后宫用度节省银两', amount: 13000000, reason: '节省用度解入太仓' }]);
    assert(G.guoku.money === 5000000, '案2 国库分文未增（原病=凭空+1300万）');
    assert(G.guoku.extraIncome.length === 0, '案2 无收入条目入账');
    assert(G._turnReport.length === 0 && res.ok === false && res.rolledBack === true, '案2 拒绝证据随返回值交付，GM 回到原状');
    assert(res.applied.failed.some(f => f.fiscal_adjustment && /裁减/.test(String(f.reason))), '案2 applied.failed 留存语义拒绝证据');
  }

  // ── 案3 正常支出不受扰：犒军银 5 万 ──
  {
    const { G } = run([{ target: 'guoku', kind: 'expense', name: '犒军银', amount: 50000, reason: '犒赏辽东守军' }]);
    assert(G.guoku.money === 4950000, '案3 犒军 5 万照常扣账');
    assert(G.guoku.extraExpense.length === 1 && G.guoku.extraExpense[0].executionStatus === 'completed', '案3 条目 completed');
  }

  // ── 案4 金额相称闸：赏赐 3000 万（年流水 96 万·上限 max(288万,100万)=288万）→ 压至 288 万 ──
  {
    const { G } = run([{ target: 'guoku', kind: 'expense', name: '赏赐藩王大婚', amount: 30000000, reason: '厚赏' }]);
    const e = G.guoku.extraExpense[0];
    assert(e && e.amount === 2880000 && e._clampedFrom === 30000000, '案4 3000万压至288万·_clampedFrom 留痕');
    assert(G.guoku.money === 5000000 - 2880000, '案4 库存按压后额扣账');
    assert(/超账户年流水三倍/.test(e.reason), '案4 reason 追注压额原委');
  }

  // ── 案5 合法大年例放行：加派 50 万/年（低于上限）→ 原额 scheduled 不压 ──
  {
    const { G } = run([{ target: 'guoku', kind: 'income', name: '辽饷加派', amount: 500000, recurring: true, reason: '岁入年例' }]);
    const e = G.guoku.extraIncome[0];
    assert(e && e.amount === 500000 && e._clampedFrom === undefined, '案5 年例 50 万原额入账·不误压');
    assert(e.executionStatus === 'scheduled' && G.guoku.money === 5000000, '案5 recurring=scheduled·当回合不动库存');
  }

  // ── 案6 守卫不越界：裁汰冗兵遣散费=真支出（动词命中·宾语不命中）→ 照常入账 ──
  {
    const { G } = run([{ target: 'guoku', kind: 'expense', name: '裁汰冗兵遣散银', amount: 80000, reason: '汰兵给散' }]);
    assert(G.guoku.money === 4920000, '案6 遣散银 8 万真支出照常执行（守卫不误伤裁军实务）');
    assert(G._turnReport.every(e => e.type !== 'fiscal_adj_rejected'), '案6 无误拦');
  }

  console.log('\nsmoke-fiscal-cut-guard: ' + passed + ' assertions PASS');
})();
