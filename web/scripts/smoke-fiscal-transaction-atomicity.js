#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
let passed = 0;
function ok(value, label) {
  if (!value) throw new Error('[smoke-fiscal-transaction-atomicity] ' + label);
  passed++;
  console.log('  ok - ' + label);
}
function clone(v) { return JSON.parse(JSON.stringify(v)); }
function fiscalView(G) {
  return clone({
    adminHierarchy: G.adminHierarchy,
    guoku: G.guoku,
    neitang: G.neitang,
    turnChanges: G.turnChanges,
    lastCascade: G._lastCascadeTaxTurn,
    lastCascadeSummary: G._lastCascadeSummary,
    lastFixed: G._lastFixedExpenseTurn,
    lastFixedExpense: G._lastFixedExpense
  });
}

const ctx = {
  console, Math, Date, JSON, Array, Object, Number, String, RegExp,
  parseFloat, parseInt, isFinite,
  setTimeout() {}, clearTimeout() {},
  document: { readyState: 'loading', addEventListener() {} },
  addEventListener() {},
  deepClone: clone,
  P: {
    time: { daysPerTurn: 30 },
    playerInfo: { factionName: '本朝' },
    fiscalConfig: {},
    salaryConfig: {}
  }
};
ctx.window = ctx;
ctx.globalThis = ctx;
ctx.GM = {
  turn: 5,
  chars: [{ name: '甲官', alive: true, faction: '本朝', rank: '五品', officialTitle: '知县' }],
  armies: [{ name: '京营', faction: '本朝', soldiers: 1000 }],
  officeTree: [],
  activeDisasters: [],
  turnChanges: { variables: [] },
  huangwei: { index: 50 },
  adminHierarchy: {
    player: {
      divisions: [{
        id: 'div_a', name: '甲县', type: 'county',
        population: { mouths: 100000, households: 20000, ding: 25000 },
        economyBase: { farmland: 100000, commerceVolume: 50000, workshops: 20, mines: 2 },
        publicTreasury: {
          money: { stock: 0, available: 0, used: 0, quota: 0 },
          grain: { stock: 0, available: 0, used: 0, quota: 0 },
          cloth: { stock: 0, available: 0, used: 0, quota: 0 }
        },
        children: []
      }]
    }
  },
  guoku: {
    money: 1000000, balance: 1000000, grain: 1000000, cloth: 1000000,
    ledgers: {
      money: { stock: 1000000, sources: {}, sinks: {}, history: [] },
      grain: { stock: 1000000, sources: {}, sinks: {}, history: [] },
      cloth: { stock: 1000000, sources: {}, sinks: {}, history: [] }
    }
  },
  neitang: {
    money: 500000, balance: 500000, grain: 500000, cloth: 500000,
    ledgers: {
      money: { stock: 500000, sources: {}, sinks: {}, history: [] },
      grain: { stock: 500000, sources: {}, sinks: {}, history: [] },
      cloth: { stock: 500000, sources: {}, sinks: {}, history: [] }
    }
  }
};

vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-fiscal-engine.js'), 'utf8'), ctx, { filename: 'tm-fiscal-engine.js' });

const beforeCascade = fiscalView(ctx.GM);
let cascadeThrew = false;
try {
  ctx.CascadeTax.collect({ _faultInjector() { throw new Error('fault after first division'); } });
} catch (_) { cascadeThrew = true; }
ok(cascadeThrew, '级联征税故障注入向上抛出');
ok(JSON.stringify(fiscalView(ctx.GM)) === JSON.stringify(beforeCascade), '级联征税中途失败完整回滚账簿、区划与 marker');
const cascadeSuccess = ctx.CascadeTax.collect();
ok(cascadeSuccess && cascadeSuccess.ok === true && ctx.GM._lastCascadeTaxTurn === 5, '级联征税成功后才提交 marker');
const afterCascade = JSON.stringify(fiscalView(ctx.GM));
const cascadeDuplicate = ctx.CascadeTax.collect();
ok(cascadeDuplicate && cascadeDuplicate.skipped && JSON.stringify(fiscalView(ctx.GM)) === afterCascade, '级联征税同回合重试不重复入账');

ctx.GM.turn = 6;
const beforeFixed = fiscalView(ctx.GM);
let fixedThrew = false;
try {
  ctx.FixedExpense.collect({ _faultInjector() { throw new Error('fault after deductions'); } });
} catch (_) { fixedThrew = true; }
ok(fixedThrew, '固定支出故障注入向上抛出');
ok(JSON.stringify(fiscalView(ctx.GM)) === JSON.stringify(beforeFixed), '固定支出中途失败完整回滚国库、内帑与 marker');
const fixedSuccess = ctx.FixedExpense.collect();
ok(fixedSuccess && fixedSuccess.ok === true && ctx.GM._lastFixedExpenseTurn === 6, '固定支出成功后才提交 marker');
const afterFixed = JSON.stringify(fiscalView(ctx.GM));
const fixedDuplicate = ctx.FixedExpense.collect();
ok(fixedDuplicate && fixedDuplicate.skipped && JSON.stringify(fiscalView(ctx.GM)) === afterFixed, '固定支出同回合重试不重复扣款');

console.log('[smoke-fiscal-transaction-atomicity] pass=' + passed);
