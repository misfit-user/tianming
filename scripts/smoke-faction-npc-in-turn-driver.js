#!/usr/bin/env node
// scripts/smoke-faction-npc-in-turn-driver.js
// Locks Phase H3 wiring: index load tag, timer scheduling/cancel, and one in-turn NPC LLM move.

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function runFile(ctx, file) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), ctx, { filename: file });
}

async function main() {
  const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const pipelineSrc = fs.readFileSync(path.join(ROOT, 'tm-endturn-pipeline-steps.js'), 'utf8');
  const decisionPos = index.indexOf('tm-faction-npc-llm-decision.js');
  const driverPos = index.indexOf('tm-faction-npc-in-turn-driver.js');
  const dispatcherPos = index.indexOf('tm-faction-npc-dispatcher.js');
  const indexPos = index.indexOf('tm-faction-index.js');
  assert(decisionPos >= 0, 'index missing tm-faction-npc-llm-decision.js');
  assert(driverPos > decisionPos, 'in-turn driver must load after LLM decision');
  assert(dispatcherPos > driverPos, 'dispatcher must load after in-turn driver');
  assert(indexPos < 0 || driverPos < indexPos, 'in-turn driver should load before faction index/UI block');
  assert(indexPos < 0 || dispatcherPos < indexPos, 'dispatcher should load before faction index/UI block');
  assert(pipelineSrc.indexOf('FactionNpcDispatchQueue.scheduleTurnRuns') >= 0,
    'render-finalize should schedule faction LLM through unified dispatch queue');

  const timers = [];
  const cleared = [];
  const ctx = {
    console: { log() {}, warn() {} },
    Math,
    Date,
    JSON,
    Object,
    Array,
    Number,
    String,
    Boolean,
    RegExp,
    isFinite,
    parseInt,
    parseFloat,
    setTimeout(fn, delay) {
      const id = { fn, delay, cleared: false };
      timers.push(id);
      return id;
    },
    clearTimeout(id) {
      if (id) id.cleared = true;
      cleared.push(id);
    }
  };
  ctx.window = ctx;
  ctx.global = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);

  runFile(ctx, 'tm-faction-npc-settings.js');
  runFile(ctx, 'tm-faction-npc-in-turn-driver.js');

  ctx.P = {
    playerInfo: { factionName: '明朝廷' },
    conf: {
      npcAiPrecision: true,
      npcAiPrecisionMaxPerTurn: 8,
      npcInTurnMaxPerTurn: 2,
      npcInTurnFirstDelayMs: 10,
      npcInTurnRepeatDelayMs: 20
    },
    ai: { key: 'fake' }
  };
  ctx.P.conf.npcAiPrecisionMode = 'lazy';
  ctx.TM.FactionNpcSettings.setEnabled(true);
  assert(ctx.P.conf.npcAiPrecisionMode === 'eager', 'turning precision on should migrate old lazy mode to eager');
  assert(ctx.TM.FactionNpcSettings.isAiPrecisionEnabled(), 'precision switch + key should enable NPC LLM');
  assert(ctx.TM.FactionNpcSettings.isEagerMode(), 'precision switch should also enable endturn eager NPC LLM batch');
  assert(ctx.TM.FactionNpcSettings.getStatus().maxPerTurn === 2, 'legacy endturn precision max should migrate from 8 to 2');
  assert(ctx.P.conf.npcInTurnMaxPerTurn === 8, 'legacy in-turn precision max should migrate from 2 to 8');
  ctx.GM = {
    turn: 7,
    facs: [
      { name: '明朝廷', derivedStrength: { value: 99 } },
      { name: '后金', derivedStrength: { value: 80 } },
      { name: '察哈尔', derivedStrength: { value: 20 } }
    ],
    qijuHistory: []
  };
  ctx.TM.FactionNpcLlmDecision = {
    calls: [],
    async decideFor(name) {
      this.calls.push(name);
      return { applied: true, rationale: name + ' 自主措置' };
    }
  };
  ctx.TM.FactionNpcNewsBridge = {};

  const driver = ctx.TM.FactionNpcInTurnDriver;
  assert(driver && typeof driver.scheduleInTurnRuns === 'function', 'driver export missing');

  const normalGM = ctx.GM;
  const normalPlayerFactionName = ctx.P.playerInfo.factionName;
  ctx.P.playerInfo.factionName = 'mismatched-player-name';
  ctx.GM = {
    turn: 7,
    facs: [
      { name: 'PlayerMarkedOnly', isPlayer: true, derivedStrength: { value: 999 } }
    ],
    qijuHistory: []
  };
  assert(driver._pickOneFac(7) === null, 'pickOneFac must skip fac.isPlayer even when player faction name mismatches');
  ctx.P.playerInfo.factionName = '';
  ctx.GM = {
    turn: 7,
    playerFaction: 'PlayerByGM',
    facs: [
      { name: 'PlayerByGM', derivedStrength: { value: 999 } },
      { name: 'NpcOnly', derivedStrength: { value: 1 } }
    ],
    qijuHistory: []
  };
  assert(driver._pickOneFac(7).name === 'NpcOnly', 'pickOneFac must skip GM.playerFaction even without fac.isPlayer');
  ctx.GM = normalGM;
  ctx.P.playerInfo.factionName = normalPlayerFactionName;
  ctx.TM.FactionActionEngine = {
    scoreFactionCandidate(f) {
      if (f === ctx.GM.facs[2]) return { score: 120, reasons: ['sc16-directive'] };
      return { score: 10, reasons: ['strength-fallback'] };
    }
  };
  const forcedPicked = driver._pickOneFac(7);
  assert(forcedPicked === ctx.GM.facs[2], 'pickOneFac should prefer forced SC16/directive pool before ordinary weighted pool');
  assert(ctx.GM._npcFactionLlmPickLog && ctx.GM._npcFactionLlmPickLog[0].pool === 'forced', 'pickOneFac should record chosen candidate pool');
  delete ctx.TM.FactionActionEngine;

  const scheduled = driver.scheduleInTurnRuns();
  assert(scheduled.scheduled === 8, 'default should move eight precision API runs to after-endturn background');
  assert(timers.length === 8, 'mock timers not registered');
  assert(timers[0].delay === 10 && timers[1].delay === 20 && timers[2].delay === 30, 'timer delays should spread by P.conf cadence');

  driver.cancelInTurnTimers();
  assert(cleared.length === 8 && timers.every(t => t.cleared), 'cancel should clear all active timers');

  const picked = driver._pickOneFac(7);
  assert(picked && picked.name !== '明朝廷', 'pickOneFac must skip player faction');

  const ret = await driver._runOneInTurn(7, 'smoke');
  assert(ret && ret.applied, 'runOneInTurn should apply mocked decision');
  assert(ctx.TM.FactionNpcLlmDecision.calls.length === 1, 'decideFor should be called once');
  assert(ctx.TM.FactionNpcLlmDecision.calls[0] !== '明朝廷', 'decideFor must not target player faction');
  const ranFac = ctx.GM.facs.find(f => f.name === ctx.TM.FactionNpcLlmDecision.calls[0]);
  assert(ranFac._inTurnLlmRanTurns.indexOf(7) >= 0, 'ran faction should be marked for this turn');
  assert(ctx.GM.qijuHistory.length === 1 && ctx.GM.qijuHistory[0]._source === 'npc-in-turn-llm', 'qiju marker missing');
  ctx.TM.FactionNpcSettings.setEnabled(false);
  assert(ctx.P.conf.npcAiPrecision === false, 'turning precision off should lower the master switch');
  assert(!ctx.TM.FactionNpcSettings.isAiPrecisionEnabled(), 'turning precision off should stop NPC LLM');
  assert(!ctx.TM.FactionNpcSettings.isEagerMode(), 'turning precision off should stop endturn eager NPC LLM batch');

  timers.length = 0;
  cleared.length = 0;
  ctx.P.conf.npcAiPrecision = true;
  ctx.P.conf.npcAiPrecisionMode = 'eager';
  ctx.P.conf.npcInTurnFirstDelayMs = 10;
  ctx.P.conf.npcInTurnRepeatDelayMs = 20;
  ctx.P.conf.npcInTurnMaxPerTurn = 8;
  ctx.P.conf.npcAiPrecisionMaxTokens = 3200;
  ctx.GM = normalGM;
  let eagerResolve = null;
  ctx.TM.FactionNpcLlmDecision = {
    async decideAll() { return new Promise(resolve => { eagerResolve = resolve; }); },
    async decideFor(name) { return { applied: true, fac: name, rationale: name + ' queue move' }; },
    countRunsThisTurn() { return 0; }
  };
  runFile(ctx, 'tm-faction-npc-dispatcher.js');
  assert(ctx.TM.FactionNpcDispatchQueue && typeof ctx.TM.FactionNpcDispatchQueue.scheduleTurnRuns === 'function',
    'dispatcher should expose unified scheduleTurnRuns');
  const queued = ctx.TM.FactionNpcDispatchQueue.scheduleTurnRuns({ turn: 7, eagerDelayMs: 300 });
  assert(queued.scheduled === 9 && queued.eagerScheduled === 1 && queued.inTurnScheduled === 8,
    'unified dispatcher should schedule one eager batch plus eight in-turn faction LLM jobs');
  assert(timers.length === 9 && timers[0].delay === 300 && timers[1].delay === 10 && timers[2].delay === 20,
    'dispatcher should preserve eager and in-turn timing cadence');
  assert(ctx.GM._npcFactionLlmDispatchLedger && ctx.GM._npcFactionLlmDispatchLedger.jobs.length === 9,
    'dispatcher should record every scheduled faction LLM job in one ledger');
  assert(ctx.GM._npcFactionAiTurnLedger && ctx.GM._npcFactionAiTurnLedger.dispatch === ctx.GM._npcFactionLlmDispatchLedger,
    'dispatcher should attach dispatch ledger to unified faction AI turn ledger');
  timers[0].fn();
  assert(ctx.GM._npcFactionLlmDispatchLedger.stats.running === 1,
    'dispatcher stats should count a job while it is running');
  eagerResolve({ applied: 0, attempted: 2, results: [{ fac: 'A', result: { skipped: true, reason: 'no valid action' } }] });
  await Promise.resolve();
  await Promise.resolve();
  await new Promise(resolve => setImmediate(resolve));
  assert(ctx.GM._npcFactionLlmDispatchLedger.jobs[0].status === 'completed_no_action',
    'dispatcher should distinguish completed jobs with zero applied actions from applied jobs');
  assert(ctx.GM._npcFactionLlmDispatchLedger.stats.running === 0 && ctx.GM._npcFactionLlmDispatchLedger.stats.noAction === 1,
    'dispatcher stats should decrement running and count no-action completions');
  const delegated = driver.scheduleInTurnRuns({ turn: 7, maxRuns: 1 });
  assert(delegated && delegated.dispatcher === true,
    'old in-turn driver scheduler should delegate to unified dispatcher when available');
  assert(timers[0].cleared !== true,
    'rescheduling in-turn jobs through dispatcher must not cancel the pending eager batch');

  console.log('[smoke-faction-npc-in-turn-driver] all assertions pass');
}

main().catch(function(e) {
  console.error('[smoke-faction-npc-in-turn-driver] failed:', e && e.stack || e);
  process.exit(1);
});
