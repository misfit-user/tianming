#!/usr/bin/env node
// smoke-fiscal-transfer-pair-guard.js — fiscal_adjustments 转账对语义闸（2026-07-16·落库契约硬化刀②）
//   居平内帑案的另一形态：同批次「A库 expense + B库 income、金额相等、事由同源」一对——把单边节流/增支
//   旨意错记成两库转账·凭空多出一侧假账。既有「裁减语义守卫」只拦含关键字的单条·既有「金额相称闸」
//   只拦单条超量·两者都漏"两条各自结构合法、成对才露馅"的转账对。
//   本刀：纯确定性配对(一进一出 + 跨两库 + 金额近等≤1% + 事由同源·四条全中)→两笔照落但打嫌疑标记+告警(不静默/不误伤)。
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
  isFinite, isNaN, parseInt, parseFloat, Promise, Symbol, Map, Set,
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
function suspects(G) { return (G._turnReport || []).filter(e => e.type === 'fiscal_adj' && e.transferPairSuspect === true); }
function pairWarns(eb) { return eb.filter(e => e.cat === '财政❗' && /转账对/.test(e.msg)); }

(function main() {
  load(ctx, 'tm-ai-change-pathutils.js');
  load(ctx, 'tm-ai-change-army.js');
  load(ctx, 'tm-ai-change-narrative.js');
  load(ctx, 'tm-ai-change-applier.js');
  load(ctx, 'tm-ai-change-applier-validators.js');
  load(ctx, 'tm-ai-change-applier-reconcile.js');
  assert(typeof ctx.applyAITurnChanges === 'function', 'applyAITurnChanges 已加载');

  // ── 案1·★居平案另一形态被识别：内帑 expense 150万 + 太仓 income 150万·事由同源(无裁减/用度关键字·躲过既有闸1) ──
  {
    const { G, res, eb } = run([
      { target: 'neitang', kind: 'expense', name: '内帑协济太仓', amount: 1500000, reason: '内帑拨解太仓充饷' },
      { target: 'guoku',   kind: 'income',  name: '太仓收内帑协济', amount: 1500000, reason: '内帑拨解太仓充饷' }
    ]);
    assert(G.neitang.extraExpense.length === 1 && G.guoku.extraIncome.length === 1, '案1 两笔照落(不静默吞账)');
    assert(G.neitang.extraExpense[0]._transferPairSuspect === true && G.guoku.extraIncome[0]._transferPairSuspect === true, '案1 ★两侧条目均打嫌疑标记(随存档持久化)');
    assert(suspects(G).length === 2, '案1 turnReport 两条 fiscal_adj 均携 transferPairSuspect');
    assert(pairWarns(eb).length === 1, '案1 事件簿按对告警一次(❗转账对·非逐条刷屏)');
    assert(res.applied && res.applied.semantic && res.applied.semantic.fiscal_transfer_pair_suspects === 1, '案1 applied.semantic 记 1 对嫌疑');
    assert(G.neitang.money === 2000000 - 1500000 && G.guoku.money === 5000000 + 1500000, '案1 两笔照旧作用于余额(标记不改数额·真转账不误杀)');
  }

  // ── 案2·事由不同源不误伤：同额一进一出跨两库·但缘由无关(脂粉钱 vs 盐课) → 不判 ──
  {
    const { G, res, eb } = run([
      { target: 'neitang', kind: 'expense', name: '后宫脂粉', amount: 1500000, reason: '宫中脂粉钱' },
      { target: 'guoku',   kind: 'income',  name: '盐课增收', amount: 1500000, reason: '两淮盐课新增' }
    ]);
    assert(G.neitang.extraExpense.length === 1 && G.guoku.extraIncome.length === 1, '案2 两笔正常入账');
    assert(!G.neitang.extraExpense[0]._transferPairSuspect && !G.guoku.extraIncome[0]._transferPairSuspect, '案2 ★事由不同源→不打标(两笔无关同额收支不误伤)');
    assert(suspects(G).length === 0 && pairWarns(eb).length === 0, '案2 无嫌疑记录·无告警');
  }

  // ── 案3·金额不等不配对：同源但一 150万 一 80万(差>1%) → 不判 ──
  {
    const { G } = run([
      { target: 'neitang', kind: 'expense', name: '内帑协济太仓', amount: 1500000, reason: '内帑拨解太仓' },
      { target: 'guoku',   kind: 'income',  name: '太仓收内帑', amount: 800000, reason: '内帑拨解太仓' }
    ]);
    assert(suspects(G).length === 0, '案3 金额不等(150万≠80万)→不配对');
  }

  // ── 案4·同库不配对：同一库一进一出(内帑内部对冲·非跨库转账) → 不判 ──
  {
    const { G } = run([
      { target: 'guoku', kind: 'expense', name: '内帑协济太仓', amount: 1500000, reason: '内帑拨解太仓' },
      { target: 'guoku', kind: 'income',  name: '内帑协济太仓', amount: 1500000, reason: '内帑拨解太仓' }
    ]);
    assert(suspects(G).length === 0, '案4 同库一进一出不算跨库转账对');
  }

  // ── 案5·同向不配对：两库同为 expense(两处各自开支·非转账) → 不判 ──
  {
    const { G } = run([
      { target: 'neitang', kind: 'expense', name: '协济太仓', amount: 1500000, reason: '内帑拨解太仓' },
      { target: 'guoku',   kind: 'expense', name: '协济太仓', amount: 1500000, reason: '内帑拨解太仓' }
    ]);
    assert(suspects(G).length === 0, '案5 两笔同向(均支出)不配对');
  }

  // ── 案6·三条中仅成对两条打标：一对转账对 + 一条无关收入 ──
  {
    const { G, res } = run([
      { target: 'neitang', kind: 'expense', name: '内帑协济太仓', amount: 1500000, reason: '内帑拨解太仓充饷' },
      { target: 'guoku',   kind: 'income',  name: '太仓收内帑协济', amount: 1500000, reason: '内帑拨解太仓充饷' },
      { target: 'guoku',   kind: 'income',  name: '盐课增收', amount: 1500000, reason: '两淮盐课新增' }
    ]);
    assert(suspects(G).length === 2, '案6 只成对两条打标(第三条无关收入不牵连)');
    assert(res.applied.semantic.fiscal_transfer_pair_suspects === 1, '案6 记 1 对');
    assert(G.guoku.extraIncome.length === 2, '案6 三笔全照落(含无关收入)');
  }

  // ── 案7·与既有闸1(裁减语义守卫)不打架：含裁减+用度关键字的对被闸1先拦·不再重复走转账对分支 ──
  {
    const { G, res, eb } = run([
      { target: 'neitang', kind: 'expense', name: '裁减后宫用度', amount: 1500000, reason: '裁减后宫用度' },
      { target: 'guoku',   kind: 'income',  name: '裁减用度节省银两', amount: 1500000, reason: '裁减用度节省解太仓' }
    ]);
    const rej = (G._turnReport || []).filter(e => e.type === 'fiscal_adj_rejected');
    assert(rej.length === 0 && res.ok === false && res.rolledBack === true, '案7 裁减用度对使整批原子回滚，GM 不留未提交记录');
    assert(res.applied.failed.filter(e => e.fiscal_adjustment && /裁减/.test(String(e.reason))).length === 2, '案7 两条语义拒绝均在 applied.failed 中可观测');
    assert(suspects(G).length === 0 && pairWarns(eb).length === 0, '案7 闸1 已拦→不再走转账对分支(无重复处置)');
    assert(G.neitang.money === 2000000 && G.guoku.money === 5000000, '案7 库存分文未动(闸1 原样)');
  }

  console.log('\nsmoke-fiscal-transfer-pair-guard: ' + passed + ' assertions PASS');
})();
