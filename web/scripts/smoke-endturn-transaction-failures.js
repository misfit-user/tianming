#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const WEB = path.resolve(__dirname, '..');
const coreSource = fs.readFileSync(path.join(WEB, 'tm-endturn-core.js'), 'utf8');
const systemsSource = fs.readFileSync(path.join(WEB, 'tm-endturn-systems.js'), 'utf8');
let assertions = 0;
function ok(value, label) {
  if (!value) throw new Error('[smoke-endturn-transaction-failures] ' + label);
  assertions++;
}

function sourceBetween(source, startText, endText) {
  const start = source.indexOf(startText);
  const end = source.indexOf(endText, start);
  if (start < 0 || end <= start) throw new Error('source slice missing: ' + startText);
  return source.slice(start, end);
}

const ctx = {
  console,
  Date,
  Promise,
  Object,
  JSON,
  Math,
  Error,
  setTimeout,
  clearTimeout,
  deepClone: value => JSON.parse(JSON.stringify(value)),
  buildIndices() {},
  renderGameState() {},
  showLoading() {},
  processBiannian() {},
  _dbg() {},
  TM: { errors: { capture() {} } }
};
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(sourceBetween(coreSource, 'async function _runPreSubmitPartyClassCalibration()', 'async function _endTurnInternal'), ctx);
vm.runInContext(sourceBetween(coreSource, 'function _tmCaptureEndTurnObject', 'async function _tmFinalizeEndTurnTransaction'), ctx);
vm.runInContext(systemsSource, ctx);

function resetWorld(extra) {
  ctx.GM = Object.assign({ turn: 4, sid: 's1', _campaignId: 'c1', busy: false, marker: 10, armies: [{ soldiers: 100 }], treasury: 50 }, extra || {});
  ctx.P = { marker: 'template', conf: {}, ai: {}, battleConfig: {} };
  ctx._tmLoadGen = 0;
  delete ctx.BattleEngine;
  delete ctx.GuokuEngine;
  delete ctx.CorruptionEngine;
  delete ctx.HujiEngine;
  delete ctx.HujiDeepFill;
  delete ctx.updateProvinceEconomy;
  ctx.SubTickRunner = { run() {} };
}

async function expectFailure(promise, text) {
  try { await promise; }
  catch (error) { return !text || String(error && error.message || error).includes(text); }
  return false;
}

async function main() {
  const snapshotIndex = coreSource.indexOf('_turnTxn = _tmCaptureEndTurnTransaction();');
  const calibrationIndex = coreSource.indexOf('await _runPreSubmitPartyClassCalibration();');
  ok(snapshotIndex >= 0 && calibrationIndex > snapshotIndex, 'pre-submit calibration is inside the transaction boundary');

  resetWorld();
  ctx.TM.PartyClassActionScheduler = {
    scheduleBeforeSubmit(GM) { GM.marker = 20; GM.calibrationWrite = true; }
  };
  let txn = ctx._tmCaptureEndTurnTransaction();
  await ctx._runPreSubmitPartyClassCalibration();
  ok(ctx.GM.marker === 20, 'calibration probe mutates the live world');
  ctx._tmRollbackEndTurnTransaction(txn, new Error('forced pre-save failure'));
  ok(ctx.GM.marker === 10 && !ctx.GM.calibrationWrite && ctx.P.marker === 'template', 'pre-save failure rolls calibration changes back to click-time state');
  delete ctx.TM.PartyClassActionScheduler;

  resetWorld();
  txn = ctx._tmCaptureEndTurnTransaction();
  ctx.BattleEngine = {
    _getConfig: () => ({ enabled: true }),
    resolveAllBattles() { ctx.GM.armies[0].soldiers = 25; throw new Error('battle-ledger-failure'); }
  };
  ok(await expectFailure(ctx._endTurn_updateSystems(1, ''), 'battle-ledger-failure'), 'battle failure propagates out of systems step');
  ctx._tmRollbackEndTurnTransaction(txn, new Error('battle-ledger-failure'));
  ok(ctx.GM.armies[0].soldiers === 100 && ctx.GM.turn === 4, 'partial battle mutation and turn state roll back atomically');

  resetWorld();
  txn = ctx._tmCaptureEndTurnTransaction();
  ctx.GuokuEngine = {
    tick() { ctx.GM.treasury = -999; throw new Error('guoku-ledger-failure'); }
  };
  ok(await expectFailure(ctx._endTurn_updateSystems(1, ''), 'guoku-ledger-failure'), 'treasury failure propagates after an intermediate turn increment');
  ctx._tmRollbackEndTurnTransaction(txn, new Error('guoku-ledger-failure'));
  ok(ctx.GM.treasury === 50 && ctx.GM.turn === 4, 'partial treasury mutation and turn increment roll back atomically');

  resetWorld({ turn: 8 });
  let releaseSubticks;
  ctx.SubTickRunner = { run: () => new Promise(resolve => { releaseSubticks = resolve; }) };
  const pending = ctx._endTurn_updateSystems(1, '');
  await Promise.resolve();
  await Promise.resolve();
  ok(ctx.GM.turn === 8, 'turn does not advance while asynchronous subticks are pending');
  releaseSubticks();
  await expectFailure(pending);
  ok(ctx.GM.turn === 9, 'systems continue only after asynchronous subticks resolve');

  console.log('[smoke-endturn-transaction-failures] PASS assertions=' + assertions);
}

main().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
