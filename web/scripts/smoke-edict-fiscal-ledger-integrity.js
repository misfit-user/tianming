#!/usr/bin/env node
// Edict fiscal writes must preserve the canonical guoku ledger and atomic region transfers.
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');

let passed = 0;
function assert(value, message) {
  if (!value) throw new Error('[smoke-edict-fiscal-ledger-integrity] ' + message);
  passed += 1;
}
function same(actual, expected, message) {
  assert(JSON.stringify(actual) === JSON.stringify(expected), message);
}

function makeGame(money, regionMoney) {
  return {
    turn: 12,
    month: 1,
    guoku: { balance: money, money: money, grain: 0, cloth: 0 },
    huangquan: { index: 50 },
    chars: [],
    regions: [{ id: 'r1', name: '河东', unrest: 20, disasterLevel: 0 }],
    fiscal: {
      regions: {
        r1: {
          regionId: 'r1',
          ledgers: { money: regionMoney, grain: 0, cloth: 0 },
          compliance: 0.8,
          autonomyLevel: 0.2,
          annualReport: { collected: 0, remitted: 0, skimmed: 0 },
          expenditures: { fixed: [], discretionary: [], imperial: [], illicit: [], downstream: [] },
          history: []
        }
      }
    }
  };
}

function makeContext(game) {
  const context = {
    console,
    Date,
    JSON,
    Math,
    Object,
    Array,
    Number,
    String,
    Boolean,
    RegExp,
    Error,
    Map,
    Set,
    WeakMap,
    WeakSet,
    isFinite,
    isNaN,
    parseInt,
    parseFloat,
    GM: game,
    P: { conf: {} },
    scriptData: game,
    addEB() {},
    toast() {},
    _adjAuthority() {},
    isYearBoundary() { return true; },
    EconomyEventBus: { emit() {} },
    TM: { errors: { capture(error) { throw error; } } }
  };
  context.window = context;
  context.global = context;
  context.globalThis = context;
  vm.createContext(context);
  ['tm-fiscal-engine.js', 'tm-economy-engine.js', 'tm-edict-parser.js'].forEach(function(file) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), context, { filename: file });
  });
  return context;
}

function assertTrinity(game, label) {
  const stock = game.guoku.ledgers && game.guoku.ledgers.money && game.guoku.ledgers.money.stock;
  assert(game.guoku.balance === game.guoku.money, label + ': balance must equal money');
  assert(game.guoku.money === stock, label + ': money must equal ledger stock');
}

// Region → guoku transfer is source-limited, conserved, and audited on both sides.
{
  const ctx = makeContext(makeGame(100000, 60000));
  const beforeTotal = ctx.GM.guoku.money + ctx.GM.fiscal.regions.r1.ledgers.money;
  const result = ctx.EconomyGapFill.forceLevy('r1', 100000, '军饷');
  assert(result.ok === true, 'force levy should succeed through the canonical fiscal engine');
  assert(result.actualAmount === 60000 && result.limitedBySource === true,
    'force levy should transfer only funds actually held by the region');
  assert(ctx.GM.guoku.money + ctx.GM.fiscal.regions.r1.ledgers.money === beforeTotal,
    'force levy must conserve central plus regional money');
  assertTrinity(ctx.GM, 'force levy');
  assert(ctx.GM.guoku.ledgers.money.sources['诏令·地方强征'] === 60000,
    'central ledger should record the force-levy source');
  assert(ctx.GM.fiscal.regions.r1.ledgerAudit.money.sinks['诏令·地方强征'] === 60000,
    'regional audit ledger should record the force-levy sink');
}

// Faults after either side has changed roll back both worlds of the transfer.
{
  const ctx = makeContext(makeGame(80000, 45000));
  ctx.FiscalEngine.addToGuoku({ money: 0 }, 'init');
  const guokuBefore = JSON.parse(JSON.stringify(ctx.GM.guoku));
  const regionBefore = JSON.parse(JSON.stringify(ctx.GM.fiscal.regions.r1));
  const result = ctx.FiscalEngine.transferRegionToGuokuAtomic({
    regionId: 'r1',
    amount: 20000,
    sourceTag: '故障注入',
    gameRef: ctx.GM,
    _faultInjector(stage) {
      if (stage === 'after-guoku-credit') throw new Error('injected transfer failure');
    }
  });
  assert(result.ok === false && result.code === 'region-guoku-transfer-failed',
    'fault injection should fail the whole transfer');
  same(ctx.GM.guoku, guokuBefore, 'guoku must roll back byte-for-structure after transfer failure');
  same(ctx.GM.fiscal.regions.r1, regionBefore, 'regional fiscal state must roll back after transfer failure');
}

// Full-amount spending never partially deducts.
{
  const ctx = makeContext(makeGame(3200, 0));
  const result = ctx.FiscalEngine.trySpendFromGuoku({
    amounts: { money: 5000 },
    sinkTag: '诏令·御史核查',
    gameRef: ctx.GM,
    requireFullAmount: true
  });
  assert(result.ok === false && result.code === 'insufficient-guoku-money',
    'full spending should return a structured insufficient-funds result');
  assert(ctx.GM.guoku.money === 3200 && ctx.GM.guoku.balance === 3200,
    'insufficient full spending must not deduct the available remainder');
  assert(!ctx.GM.guoku.ledgers, 'failed full spending must restore the pre-call guoku shape');
}

// Investigation is created only after its fixed cost commits.
{
  const ctx = makeContext(makeGame(3200, 0));
  ctx.GM._pendingMemorials = [{ id: 'memo-low', status: 'drafted', drafter: '御史甲', typeName: '核查' }];
  const denied = ctx.EdictComplete.processImperialAssentExtended('memo-low', 'investigate', {});
  assert(denied.ok === false && denied.code === 'insufficient-guoku-money',
    'underfunded investigation should fail before world mutation');
  assert(!ctx.GM._investigations, 'underfunded investigation must not create an investigation record');
  assert(ctx.GM._pendingMemorials[0].status === 'drafted', 'underfunded investigation must not change memorial status');

  ctx.GM.guoku.balance = 10000;
  ctx.GM.guoku.money = 10000;
  const approved = ctx.EdictComplete.processImperialAssentExtended('memo-low', 'investigate', {});
  assert(approved.ok === true && ctx.GM._investigations.length === 1,
    'funded investigation should create exactly one record');
  assertTrinity(ctx.GM, 'investigation');
  assert(ctx.GM.guoku.money === 5000, 'funded investigation should deduct its exact fixed cost');
  assert(ctx.GM.guoku.ledgers.money.sinks['诏令·御史核查'] === 5000,
    'investigation cost should be named in the central sink ledger');
}

// Initial institution funding uses all-or-nothing spending.
{
  const ctx = makeContext(makeGame(3000, 0));
  const institution = ctx.EdictParser.registerDynamicInstitution({ name: '水利司', annualBudget: 5000 });
  assert(institution.stage === 'underfunded', 'new institution should be marked underfunded when full budget is unavailable');
  assert(ctx.GM.guoku.money === 3000, 'new institution must not partially consume an insufficient treasury');
}

// Yearly institution funding uses a fresh canonical world and never partially deducts.
{
  const ctx = makeContext(makeGame(3000, 0));
  ctx.FiscalEngine.addToGuoku({ money: 0 }, 'fixture-init');
  ctx.GM.dynamicInstitutions = [{
    id: 'inst-yearly', name: '漕运司', stage: 'running', annualBudget: 5000,
    effectiveness: 1, corruption: 10, history: []
  }];
  ctx.PhaseC.tick({ turn: ctx.GM.turn, monthRatio: 1 });
  assert(ctx.GM.dynamicInstitutions[0].stage === 'underfunded',
    'yearly institution funding failure should mark the institution underfunded');
  assert(ctx.GM.guoku.money === 3000, 'yearly funding failure must not partially deduct funds');
  assertTrinity(ctx.GM, 'underfunded institution');
}

console.log('[smoke-edict-fiscal-ledger-integrity] PASS assertions=' + passed);
