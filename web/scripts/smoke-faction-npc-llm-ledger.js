#!/usr/bin/env node
// scripts/smoke-faction-npc-llm-ledger.js
// Locks the shared per-turn ledger for eager and in-turn NPC faction LLM runs.

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

function makeContext(opts) {
  opts = opts || {};
  const extraFactions = opts.extraFactions || [];
  const conf = Object.assign({
    npcAiPrecision: true,
    npcAiPrecisionMode: 'eager',
    npcAiPrecisionMaxPerTurn: 2,
    npcInTurnMaxPerTurn: 8
  }, opts.conf || {});
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
    setTimeout(fn) {
      return { fn };
    },
    clearTimeout() {}
  };
  ctx.window = ctx;
  ctx.global = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);

  require('./lib-political-test-runtime').install(ctx);
  runFile(ctx, 'tm-faction-npc-settings.js');
  runFile(ctx, 'tm-faction-action-engine.js');
  runFile(ctx, 'tm-faction-npc-llm-decision.js');
  runFile(ctx, 'tm-faction-npc-in-turn-driver.js');

  ctx.P = {
    playerInfo: { factionName: 'PLAYER' },
    conf,
    ai: { key: 'fake' }
  };
  const baseFactions = [
    { name: 'PLAYER', derivedStrength: { value: 999 } },
    { name: 'A', derivedStrength: { value: 100 } },
    { name: 'B', derivedStrength: { value: 90 } }
  ].concat(extraFactions);
  const facIndex = {
    A: { chars: [{ name: 'A-ruler', role: 'ruler', faction: 'A', loyalty: 50, alive: true }] },
    B: { chars: [{ name: 'B-ruler', role: 'ruler', faction: 'B', loyalty: 50, alive: true }] }
  };
  extraFactions.forEach(function(f) {
    facIndex[f.name] = { chars: [{ name: f.name + '-ruler', role: 'ruler', faction: f.name, loyalty: 50, alive: true }] };
  });
  ctx.GM = {
    turn: 7,
    facs: baseFactions,
    _facIndex: facIndex,
    shijiHistory: [],
    qijuHistory: []
  };
  require('./lib-political-test-runtime').schedulingWorld(ctx);
  ctx.callAI = async function() {
    return JSON.stringify({ rationale: 'ok', memorials: [], edict: null, chaoyi: null, office: [] });
  };
  return ctx;
}

async function main() {
  const ctx = makeContext();

  const eager = await ctx.TM.FactionNpcLlmDecision.decideAll({ source: 'eager', turn: 7 });
  assert(eager && eager.attempted === 2, 'eager should attempt the two NPC factions');
  assert(eager.applied === 0 && eager.generated === 2, 'generation is deferred and never counted as an executed political action');
  assert(ctx.GM._npcActionState.politicalPending.length===2, 'both bounded packets persist until simulation advances');
  ctx.TM.PoliticalActions.flush();assert(ctx.GM._npcActionState.politicalPending.every(p=>p.status==='waiting'),'real-time repeats cannot settle packets');
  assert(ctx.TM.FactionNpcInTurnDriver._pickOneFac(7) === null, 'in-turn picker must skip NPC factions already run by eager ledger');

  const stale = makeContext();
  stale.callAI = async function() {
    stale.GM.turn = 8;
    return JSON.stringify({ rationale: 'late', memorials: [], edict: null, chaoyi: null, office: [] });
  };
  const staleResult = await stale.TM.FactionNpcLlmDecision.decideFor('A', { source: 'eager', turn: 7 });
  assert(staleResult && staleResult.skipped && staleResult.expired && staleResult.reason === 'stale world or turn', 'stale NPC LLM result should be skipped');
  assert(!stale.GM.facs[1]._lastLlmRationale, 'stale NPC LLM result must not mutate faction state');

  const budget = makeContext({
    conf: { npcInTurnMaxPerTurn: 3 },
    extraFactions: [
      { name: 'C', derivedStrength: { value: 80 } },
      { name: 'D', derivedStrength: { value: 70 } },
      { name: 'E', derivedStrength: { value: 60 } }
    ]
  });
  await budget.TM.FactionNpcLlmDecision.decideAll({ source: 'eager', turn: 7 });
  const firstInTurn = await budget.TM.FactionNpcInTurnDriver._runOneInTurn(7, 'budget-1');
  assert(firstInTurn && firstInTurn.generated, 'one in-turn run should be allowed after two eager runs when total budget is three');
  const overBudget = await budget.TM.FactionNpcInTurnDriver._runOneInTurn(7, 'budget-2');
  assert(overBudget && overBudget.skipped && overBudget.reason === 'NPC LLM turn budget exhausted', 'in-turn should stop once eager + in-turn reaches total budget');

  console.log('[smoke-faction-npc-llm-ledger] all assertions pass');
}

main().catch(function(e) {
  console.error('[smoke-faction-npc-llm-ledger] failed:', e && e.stack || e);
  process.exit(1);
});
