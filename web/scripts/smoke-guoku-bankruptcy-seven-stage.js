#!/usr/bin/env node
// smoke-guoku-bankruptcy-seven-stage.js - guoku bankruptcy must be a staged state machine.
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

function assert(cond, msg) {
  if (!cond) throw new Error('[assert] ' + msg);
}

const events = [];
const ctx = {
  console,
  Date, JSON, Math,
  GM: {
    turn: 300,
    guoku: {
      balance: -1300000,
      money: -1300000,
      monthlyIncome: 100000,
      monthlyExpense: 280000,
      annualIncome: 1200000,
      lastDelta: -180000,
      ledgers: { money: { stock: -1300000, sources: {}, sinks: {}, history: [] } },
      history: { monthly: [], yearly: [], events: [] },
      bankruptcy: { active: false, consecutiveMonths: 0, severity: 0 }
    },
    minxin: { trueIndex: 64 },
    huangwei: { index: 66, subDims: { foreign: { value: 61 } } },
    huangquan: { index: 62 },
    corruption: { sources: {} },
    military: { morale: 70 },
    armies: [
      { id: 'frontier', name: '边军', morale: 62, supply: 55 },
      { id: 'capital', name: '京营', morale: 68, supply: 62 }
    ],
    regions: [
      { id: 'jiangnan', name: '江南', unrest: 22 },
      { id: 'shaanxi', name: '陕西', unrest: 35 }
    ],
    activeWars: [{ id: 'liaodong' }],
    activeDisasters: [{ id: 'flood' }]
  },
  P: {},
  addEB(type, text) { events.push({ type, text }); },
  _getDaysPerTurn() { return 30; }
};
ctx.window = ctx;
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-guoku-engine.js'), 'utf8'), ctx, { filename: 'tm-guoku-engine.js' });

const G = ctx.GM;
const before = {
  minxin: G.minxin.trueIndex,
  huangwei: G.huangwei.index,
  huangquan: G.huangquan.index,
  armyMorale: G.armies[0].morale
};

assert(Array.isArray(ctx.GuokuEngine.BANKRUPTCY_STAGES), 'BANKRUPTCY_STAGES should be exported');
assert(ctx.GuokuEngine.BANKRUPTCY_STAGES.length === 7, 'bankruptcy should define seven stages');

for (let i = 0; i < 8; i++) {
  G.turn = 300 + i;
  ctx.GuokuEngine.checkBankruptcy(1);
}

const b = G.guoku.bankruptcy;
assert(b && b.active, 'bankruptcy should be active');
assert(b.stateMachine === true, 'bankruptcy should mark stateMachine mode');
assert(b.stage === 7, 'deep insolvency should reach stage 7 after sustained months, got ' + b.stage);
assert(b.stageId === 'fiscal_collapse', 'stage 7 should be fiscal collapse');
assert(Array.isArray(b.history) && b.history.length >= 7, 'bankruptcy should keep stage transition history');
assert(b.history.some(e => e.stageId === 'salary_arrears'), 'history should include salary arrears stage');
assert(b.history.some(e => e.stageId === 'army_pay_break'), 'history should include army pay break stage');
assert(b.history.some(e => e.stageId === 'fiscal_collapse'), 'history should include final collapse stage');
assert(b.effects && b.effects.appliedStageIds && b.effects.appliedStageIds.length >= 7, 'effects should be tracked per stage');
assert(G.minxin.trueIndex < before.minxin, 'bankruptcy stages should reduce minxin');
assert(G.huangwei.index < before.huangwei, 'bankruptcy stages should reduce huangwei');
assert(G.huangquan.index < before.huangquan, 'final bankruptcy should shake huangquan');
assert(G.corruption.sources.lowSalary > 0, 'salary arrears should feed low-salary corruption');
assert(G.armies[0].morale < before.armyMorale, 'army pay break should reduce army morale');
assert(G.regions.some(r => r.unrest > 35), 'late bankruptcy should raise regional unrest');
assert(events.some(e => /第七阶段|财政崩溃/.test(e.text)), 'stage events should be player-visible');

G.guoku.balance = 200000;
G.turn += 1;
ctx.GuokuEngine.checkBankruptcy(1);
assert(b.recoveryMonths >= 1, 'positive balance should start recovery counter');
assert(b.stage <= 6, 'recovery should step the state machine down');

// 「待诏给付」的旧欠（开局欠饷，manualSettlement）不让破产链开跑：库里有钱、没有新欠，就不在危机里（11-09）。
// 原先天启开局九百九十九万两待诏欠饷让破产链从第一个月起逐月升级，第八个月必到「财政崩溃」。
G.guoku.balance = 850000;
G.guoku.money = 850000;
G.guoku.ledgers.money = {
  stock: 850000, deficit: 9990300, sources: {}, sinks: {}, history: [],
  deficitDetails: { junxiang: [{ id: 'army-arrears:tq:guanning:opening', name: '关宁军既欠军饷', amount: 9990300, manualSettlement: true }] }
};
G.guoku.bankruptcy = { active: false, consecutiveMonths: 0, severity: 0 };
const hwBeforeManual = G.huangwei.index, hqBeforeManual = G.huangquan.index;
for (let i = 0; i < 9; i++) {
  G.turn += 1;
  ctx.GuokuEngine.checkBankruptcy(1);
}
const bm = G.guoku.bankruptcy;
assert(!bm.active && (bm.stage || 0) === 0 && (bm.consecutiveMonths || 0) === 0, 'manual-settlement opening arrears alone must not run the bankruptcy ladder, got stage ' + bm.stage + ' months ' + bm.consecutiveMonths);
assert(G.huangwei.index === hwBeforeManual && G.huangquan.index === hqBeforeManual, 'no authority loss from manual-settlement arrears alone');
G.guoku.ledgers.money.deficit += 50000;
G.guoku.ledgers.money.deficitDetails.junxiang.push({ id: 'army-pay:new', name: '本月欠饷', amount: 50000 });
G.turn += 1;
ctx.GuokuEngine.checkBankruptcy(1);
assert(bm.active && bm.stage >= 1, 'new (non-manual) arrears still enter the crisis ladder, got stage ' + bm.stage);

console.log('[smoke-guoku-bankruptcy-seven-stage] PASS bankruptcy seven-stage state machine');
