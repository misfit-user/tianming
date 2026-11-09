#!/usr/bin/env node
// smoke-guoku-bankruptcy-seven-stage.js - guoku bankruptcy is a seven-stage state machine whose every stage
// stands on a fact in the ledger (11-09): no stage by months of deficit, no random mutiny/famine roll,
// and no consequence that another line already carries (army arrears, loans, surtax, disasters).
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

let assertions = 0;
function assert(cond, msg) {
  assertions += 1;
  if (!cond) throw new Error('[assert] ' + msg);
}

const events = [];
const ctx = {
  console,
  Date, JSON,
  // Any leftover dice roll would fire at 0; the ladder must not depend on it.
  Math: Object.assign(Object.create(Math), { random: () => 0 }),
  GM: {
    turn: 300,
    guoku: {
      balance: 0,
      money: 0,
      monthlyIncome: 100000,
      monthlyExpense: 280000,
      annualIncome: 1200000,
      lastDelta: -180000,
      ledgers: { money: { stock: 0, deficit: 0, sources: {}, sinks: {}, history: [] } },
      history: { monthly: [], yearly: [], events: [] },
      emergency: { extraTax: { active: false, rate: 0 }, loan: { active: false, amount: 0, monthsLeft: 0 } },
      bankruptcy: { active: false, consecutiveMonths: 0, severity: 0 }
    },
    minxin: { trueIndex: 64 },
    huangwei: { index: 66, subDims: { foreign: { value: 61 } } },
    huangquan: { index: 62 },
    corruption: { sources: {} },
    military: { morale: 70 },
    chars: [
      { name: '毕自严', alive: true, loyalty: 70, officialTitle: '户部尚书' },
      { name: '布衣', alive: true, loyalty: 50 }
    ],
    armies: [
      { id: 'frontier', name: '边军', morale: 62, supply: 55 },
      { id: 'capital', name: '京营', morale: 68, supply: 62 }
    ],
    regions: [
      { id: 'jiangnan', name: '江南', unrest: 22 },
      { id: 'shaanxi', name: '陕西', unrest: 35 }
    ],
    activeWars: [{ id: 'liaodong' }],
    activeDisasters: [{ id: 'flood', _relieved: true }]
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
const GE = ctx.GuokuEngine;
const led = () => G.guoku.ledgers.money;
// One month of settled ledger: balance, unpaid tags this period, non-manual arrears on the book.
function month(o) {
  G.turn += 1;
  G.guoku.balance = G.guoku.money = o.balance;
  led().stock = Math.max(0, o.balance);
  led().deficit = o.deficit || 0;
  led().sinks = Object.assign({ 俸禄: 80000, 军饷: 290000 }, o.sinks || {});
  GE.checkBankruptcy(1);
  return G.guoku.bankruptcy;
}
const said = (re) => events.filter(e => re.test(e.text)).length;
const snapshot = () => JSON.stringify({
  minxin: G.minxin.trueIndex, huangwei: G.huangwei.index, huangquan: G.huangquan.index,
  foreign: G.huangwei.subDims.foreign.value, military: G.military.morale,
  armies: G.armies.map(a => [a.morale, a.supply]), regions: G.regions.map(r => r.unrest)
});

assert(Array.isArray(GE.BANKRUPTCY_STAGES), 'BANKRUPTCY_STAGES should be exported');
assert(GE.BANKRUPTCY_STAGES.length === 7, 'bankruptcy should define seven stages');

// 1. 天启空转：太仓见底、每月欠发军饷，但没欠俸、没借钱、没加派、灾已赈。八个月后仍是「军饷断裂」，不是「财政崩溃」。
const untouched = snapshot();
const creditBefore = 70;
let b;
for (let i = 0; i < 8; i++) b = month({ balance: -14000, deficit: 690000 * (i + 1), sinks: { '军饷_欠': 690000 } });
assert(b.active && b.stateMachine === true, 'army-pay shortfall is a crisis');
assert(b.stage === 5 && b.stageId === 'army_pay_break', 'idle Tianqi sits at army pay break, got ' + b.stage + ' ' + b.stageId);
assert(b.history.some(e => e.stageId === 'cash_warning') && b.history.some(e => e.stageId === 'army_pay_break'), 'history records the two real stages');
assert(!b.history.some(e => /salary_arrears|emergency_borrowing|tax_credit_break|relief_failure|fiscal_collapse/.test(e.stageId)), 'no stage without its fact: ' + JSON.stringify(b.history.map(e => e.stageId)));
assert(said(/第一阶段/) === 1 && said(/第五阶段/) === 1, 'each real stage is announced once per episode');
assert(said(/第二阶段|第三阶段|第四阶段|第六阶段|第七阶段/) === 0, 'no announcement for stages that did not happen');
assert(said(/兵变四起|饥民暴起/) === 0, 'no random mutiny or famine roll');
assert(snapshot() === untouched, 'no authority, minxin, army or unrest change from the ladder itself: ' + snapshot());
assert(!(G.corruption.sources.lowSalary > 0), 'no salary-arrears corruption without unpaid salary');
assert(G.guoku.fiscalCredit === creditBefore - 3, 'stage one still marks fiscal credit once');
assert(JSON.stringify(b.effects.appliedStageIds) === JSON.stringify(['cash_warning', 'army_pay_break']), 'effects tracked only for real stages');

// 2. 真欠了俸：二级报一次，记低俸腐败、在任官员离心；级别仍按最高的事实（五级）。
b = month({ balance: -14000, deficit: 700000, sinks: { '军饷_欠': 600000, '俸禄_欠': 30000 } });
assert(b.stage === 5, 'top fact still army pay break');
assert(said(/第二阶段/) === 1, 'real salary arrears are announced');
assert(G.corruption.sources.lowSalary === 6, 'real salary arrears feed low-salary corruption');
assert(G.chars[0].loyalty === 69 && G.chars[1].loyalty === 50, 'only office holders lose loyalty over unpaid salary');

// 3. 真借了钱、4. 真下了加派：各报一次，不再另扣皇威、民心（借时、加派时已算）。
G.guoku.emergency.loans = [{ source: 'moneyMerchant', principal: 100000, monthsLeft: 12, totalTerm: 12, interestRate: 0.02 }];
b = month({ balance: -14000, deficit: 700000, sinks: { '军饷_欠': 600000 } });
assert(said(/第三阶段/) === 1, 'a real loan is announced');
G.guoku.emergency.extraTax = { active: true, rate: 0.2 };
b = month({ balance: -14000, deficit: 700000, sinks: { '军饷_欠': 600000 } });
assert(said(/第四阶段/) === 1, 'a real surtax is announced');
assert(snapshot() === untouched, 'loan and surtax stages add no second penalty');

// 5. 灾未赈而库空：六级报一次，不给天下各区一律加民变。
G.activeDisasters = [{ id: 'drought' }];
b = month({ balance: -14000, deficit: 700000, sinks: { '军饷_欠': 600000 } });
assert(b.stage === 6 && said(/第六阶段/) === 1, 'unrelieved disaster while broke is relief failure');
assert(snapshot() === untouched, 'relief failure leaves unrest to the disaster line');

// 6. 俸饷皆欠、新欠过一年岁入：七级。不扣皇权、皇威、民心。
b = month({ balance: -14000, deficit: 1300000, sinks: { '军饷_欠': 600000, '俸禄_欠': 30000 } });
assert(b.stage === 7 && b.stageId === 'fiscal_collapse' && said(/第七阶段/) === 1, 'collapse needs unpaid salary and pay with arrears over a year of income');
assert(snapshot() === untouched, 'collapse itself shakes nothing: ' + snapshot());

// 7. 事实好转就往回落：俸饷发足、灾已赈、借款还清、加派停了，只剩旧账未清 → 一级。
G.activeDisasters = [{ id: 'drought', _relieved: true }];
G.guoku.emergency.loans = [];
G.guoku.emergency.extraTax = { active: false, rate: 0 };
const announcedBeforeDrop = events.length;
b = month({ balance: 0, deficit: 300000 });
assert(b.active && b.stage === 1 && b.history[b.history.length - 1].direction === 'recover', 'stage follows the facts down');
assert(events.length === announcedBeforeDrop, 'falling back announces nothing new');

// 8. 回升：不在危机里级别归零；连着三个月才算这一场过去，再亏空时重新报（后果一局只起一次）。
b = month({ balance: 200000, deficit: 0 });
assert(!b.active && b.stage === 0 && b.recoveryMonths >= 1, 'out of crisis the ladder is stable');
assert(said(/危机解除/) === 0, 'one good month does not close the episode');
b = month({ balance: -5000, deficit: 5000 });
assert(b.stage === 1 && said(/第一阶段/) === 1, 'a dip within three months is the same episode, not re-announced');
month({ balance: 200000, deficit: 0 });
month({ balance: 200000, deficit: 0 });
b = month({ balance: 200000, deficit: 0 });
assert(said(/危机解除/) === 1 && b.episodeStageIds.length === 0, 'three clear months close the episode');
const credit = G.guoku.fiscalCredit;
b = month({ balance: -5000, deficit: 5000 });
assert(said(/第一阶段/) === 2 && G.guoku.fiscalCredit === credit, 'a new episode is announced again, effects stay once per game');

// 9. 旧档正在危机里：已起过后果的级算作报过，读档后不重报。
G.guoku.bankruptcy = { active: true, stage: 4, consecutiveMonths: 4, severity: 0.1, history: [], effects: { appliedStageIds: ['cash_warning', 'salary_arrears', 'emergency_borrowing', 'tax_credit_break'] } };
const oldSaveEvents = events.length;
b = month({ balance: -14000, deficit: 690000, sinks: { '军饷_欠': 690000 } });
assert(b.stage === 5, 'old save takes the factual stage');
assert(events.slice(oldSaveEvents).map(e => e.text).join('|') === GE.BANKRUPTCY_STAGES[4].event, 'old save announces only the new real stage: ' + events.slice(oldSaveEvents).map(e => e.text).join('|'));

// 10. 「待诏给付」的旧欠（开局欠饷，manualSettlement）不让破产链开跑：库里有钱、没有新欠，就不在危机里（11-09）。
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
  GE.checkBankruptcy(1);
}
const bm = G.guoku.bankruptcy;
assert(!bm.active && (bm.stage || 0) === 0 && (bm.consecutiveMonths || 0) === 0, 'manual-settlement opening arrears alone must not run the bankruptcy ladder, got stage ' + bm.stage + ' months ' + bm.consecutiveMonths);
assert(G.huangwei.index === hwBeforeManual && G.huangquan.index === hqBeforeManual, 'no authority loss from manual-settlement arrears alone');
G.guoku.ledgers.money.deficit += 50000;
G.guoku.ledgers.money.deficitDetails.junxiang.push({ id: 'army-pay:new', name: '本月欠饷', amount: 50000 });
G.turn += 1;
GE.checkBankruptcy(1);
assert(bm.active && bm.stage >= 1, 'new (non-manual) arrears still enter the crisis ladder, got stage ' + bm.stage);

console.log('[smoke-guoku-bankruptcy-seven-stage] PASS assertions=' + assertions);
