#!/usr/bin/env node
// smoke-faction-llm-comprehensive-upgrade.js
// Guards the comprehensive faction LLM upgrade: true-decision settings,
// SC16 hard ordering, local-template preplan context, expanded action effects,
// and useful failure diagnostics.

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function src(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

function runFile(ctx, file) {
  vm.runInContext(src(file), ctx, { filename: file });
}

function makeContext(files) {
  const ctx = {
    console: { log() {}, warn() {}, error() {} },
    Math,
    Date,
    JSON,
    Object,
    Array,
    Number,
    String,
    Boolean,
    RegExp,
    Promise,
    setTimeout,
    clearTimeout,
    isFinite,
    parseInt,
    parseFloat,
    isNaN,
    Set
  };
  ctx.window = ctx;
  ctx.global = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  files.forEach(function(file) { runFile(ctx, file); });
  return ctx;
}

function makeFactionLlmContext() {
  return makeContext([
    'tm-faction-npc-settings.js',
    'tm-faction-action-engine.js',
    'tm-faction-npc-llm-decision.js',
    'tm-faction-npc-in-turn-driver.js'
  ]);
}

function settingsTextSeparationTest() {
  const patches = src('tm-patches.js');
  const settings = src('tm-faction-npc-settings.js');
  assert(settings.indexOf('npcAiCosmeticEnrich') >= 0, 'settings should expose a separate cosmetic enrich switch');
  assert(settings.indexOf('isCosmeticEnrichEnabled') >= 0, 'settings should expose a cosmetic enrich capability check');
  assert(settings.indexOf('npcAiPrecisionMaxTokens: 6000') >= 0, 'precision faction LLM should default to a larger JSON budget');
  assert(patches.indexOf('每回合最多 8 次润色') < 0, 'npcAiPrecision UI copy must not describe true decision LLM as polish');
  assert(patches.indexOf('真实改动数据') >= 0 || patches.indexOf('真决策') >= 0, 'npcAiPrecision UI copy should say this is a true data-changing decision path');
}

async function sc16HardOrderingTest() {
  const ctx = makeFactionLlmContext();
  ctx.P = {
    playerInfo: { factionName: 'PlayerRealm' },
    ai: { key: 'fake' },
    conf: {
      npcAiPrecision: true,
      npcAiPrecisionMode: 'eager',
      npcAiPrecisionMaxPerTurn: 1,
      npcAiPrecisionConcurrency: 1,
      npcAiPrecisionRetryAttempts: 1,
      npcAiPrecisionMaxTokens: 3200
    }
  };
  ctx.GM = {
    turn: 31,
    facs: [
      { name: 'PriorityNpc', treasury: { money: 1000 }, derivedStrength: { value: 1 }, derivedHealth: { overall: 80 } },
      { name: 'StrongNpc', treasury: { money: 1000 }, derivedStrength: { value: 1000 }, derivedHealth: { overall: 80 } },
      { name: 'PlayerRealm', isPlayer: true, treasury: { money: 1000 }, derivedStrength: { value: 5000 } }
    ],
    chars: [],
    qijuHistory: [],
    activeWars: [],
    currentIssues: [],
    factionEvents: [],
    _factionUndercurrents: [],
    _facIndex: {},
    _sc16FactionDirectives: {
      turn: 31,
      priorityQueue: [
        { faction: 'PriorityNpc', priority: 10, reason: 'must resolve first despite low raw strength' }
      ],
      byFaction: {
        PriorityNpc: {
          faction: 'PriorityNpc',
          turn: 31,
          priorityScore: 10,
          priorityRank: 1,
          hasDirectContent: false,
          directives: []
        }
      }
    }
  };
  ctx.callAI = function() {
    return Promise.resolve(JSON.stringify({
      rationale: 'ordered ok',
      memorials: [],
      edict: null,
      chaoyi: null,
      office: [],
      actions: []
    }));
  };
  const batch = await ctx.TM.FactionNpcLlmDecision.decideAll({ source: 'eager', turn: 31 });
  assert(batch && batch.attempted === 1, 'decideAll should respect maxPerTurn=1');
  assert(batch.results[0] && batch.results[0].fac === 'PriorityNpc', 'SC16 priorityQueue should hard-order selected factions before raw score');
  assert(ctx.GM._npcFactionLlmCandidateRanks.rows[0].faction === 'PriorityNpc', 'candidate rank ledger should show hard priority first');
  assert(ctx.GM._npcFactionLlmCandidateRanks.rows[0].reasons.indexOf('sc16-hard-priority') >= 0, 'candidate rank ledger should explain hard SC16 priority');
}

function localTemplatePreplanPromptTest() {
  const ctx = makeFactionLlmContext();
  const fac = {
    name: 'LocalPlanNpc',
    treasury: { money: 100000 },
    derivedStrength: { value: 30 },
    derivedHealth: { overall: 70 },
    _npcLlmActionLedger: [
      {
        turn: 7,
        type: 'fiscal_policy',
        source: 'local',
        engine: 'FactionActionEngine',
        status: 'applied',
        detail: { resource: 'money', delta: 25000, reason: 'local levy' }
      }
    ]
  };
  ctx.P = { playerInfo: { factionName: 'PlayerRealm' }, ai: { key: 'fake' }, conf: { npcAiPrecision: true } };
  ctx.GM = { turn: 7, facs: [fac], chars: [], qijuHistory: [], _facIndex: { LocalPlanNpc: { chars: [], parties: {}, metrics: {} } } };
  const prompts = ctx.TM.FactionNpcLlmDecision._buildPrompt(fac);
  const combined = prompts.system + '\n' + prompts.user;
  assert(combined.indexOf('LOCAL_TEMPLATE_PREPLAN') >= 0, 'prompt should include local-template preplan context');
  assert(combined.indexOf('fiscal_policy') >= 0 && combined.indexOf('local levy') >= 0, 'preplan context should carry local action type and reason');
  assert(combined.indexOf('already applied') >= 0 || combined.indexOf('avoid duplicates') >= 0, 'preplan context should tell LLM not to duplicate local actions blindly');
}

function expandedActionExecutionTest() {
  const ctx = makeFactionLlmContext();
  const engine = ctx.TM.FactionActionEngine;
  const contract = engine.getActionContract();
  assert(contract.fiscal_policy.optional.indexOf('incomeDelta') >= 0, 'fiscal contract should expose incomeDelta');
  assert(contract.fiscal_policy.optional.indexOf('expenseDelta') >= 0, 'fiscal contract should expose expenseDelta');
  assert(contract.province_policy.optional.indexOf('unrestDelta') >= 0, 'province contract should expose unrestDelta');
  assert(contract.province_policy.optional.indexOf('taxDelta') >= 0, 'province contract should expose taxDelta');
  assert(contract.diplomacy.optional.indexOf('treaty') >= 0, 'diplomacy contract should expose treaty');

  const actor = { name: 'Actor', treasury: { money: 100000 }, territories: ['ProvinceA'], derivedStrength: { value: 40 } };
  const target = { name: 'Target', treasury: { money: 100000 }, territories: [], derivedStrength: { value: 40 } };
  ctx.GM = {
    turn: 32,
    facs: [actor, target],
    chars: [],
    qijuHistory: [],
    armies: [{ name: 'ArmyA', faction: 'Actor', soldiers: 1000, morale: 50, training: 20 }],
    factionRelations: [{ from: 'Actor', to: 'Target', type: 'tense', value: -20, desc: '' }],
    provinceStats: { ProvinceA: { owner: 'Actor', minxinLocal: 40, corruptionLocal: 20, unrest: 10, taxRevenue: 500 } },
    _provinceToFaction: { ProvinceA: 'Actor' },
    _facIndex: { Actor: { chars: [], parties: {}, metrics: {} } }
  };
  ctx.P = { playerInfo: { factionName: 'PlayerRealm' }, ai: { key: 'fake' }, conf: { npcAiPrecision: true } };
  const decision = {
    rationale: 'expand action effects',
    actions: [
      { type: 'fiscal_policy', resource: 'money', treasuryDelta: 1000, incomeDelta: 250, expenseDelta: -50, reason: 'new salt levy' },
      { type: 'province_policy', province: 'ProvinceA', policy: 'pacify', minxinDelta: 5, corruptionDelta: -4, unrestDelta: -3, taxDelta: 120, reason: 'repair granary' },
      { type: 'diplomacy', targetFaction: 'Target', relationDelta: 10, relationType: 'truce', treaty: 'three-year truce', durationTurns: 3, reason: 'buy time' },
      { type: 'military_order', army: 'ArmyA', order: 'reinforce', soldiersDelta: 200, moraleDelta: 5, trainingDelta: 3, reason: 'frontier drill' }
    ]
  };
  const summary = engine.applyDecision(actor, decision, { turn: 32 });
  assert(summary.actions === 4, 'expanded fiscal/province/diplomacy/military actions should all apply');
  assert(actor.treasury.money === 101000, 'fiscal_policy should still change current treasury');
  assert(actor.fiscalPolicy && actor.fiscalPolicy.longTermIncomeDelta === 250, 'fiscal_policy should record long-term income delta');
  assert(actor.fiscalPolicy.longTermExpenseDelta === -50, 'fiscal_policy should record long-term expense delta');
  assert(ctx.GM.provinceStats.ProvinceA.minxinLocal === 45, 'province_policy should change public sentiment');
  assert(ctx.GM.provinceStats.ProvinceA.corruptionLocal === 16, 'province_policy should change local corruption');
  assert(ctx.GM.provinceStats.ProvinceA.unrest === 7, 'province_policy should change unrest');
  assert(ctx.GM.provinceStats.ProvinceA.taxRevenue === 620, 'province_policy should change tax revenue');
  assert(Array.isArray(ctx.GM.treaties) && ctx.GM.treaties.some(function(t) {
    return t.from === 'Actor' && t.to === 'Target' && t.title === 'three-year truce';
  }), 'diplomacy action with treaty should add a treaty record');
  assert(ctx.GM.armies[0].soldiers === 1200, 'military_order should apply soldiersDelta');
  assert(ctx.GM.armies[0].morale === 55, 'military_order should apply moraleDelta');
  assert(ctx.GM.armies[0].training === 23, 'military_order should apply trainingDelta');
  assert(actor.aiStrategy && Array.isArray(actor.aiStrategy.economicPlans) && actor.aiStrategy.economicPlans.length > 0, 'strategy memory should track economic plans');
  assert(Array.isArray(actor.aiStrategy.governanceFocus) && actor.aiStrategy.governanceFocus.indexOf('ProvinceA') >= 0, 'strategy memory should track governance focus');
  assert(Array.isArray(actor.aiStrategy.treaties) && actor.aiStrategy.treaties.indexOf('Target:three-year truce') >= 0, 'strategy memory should track treaties');
}

async function failureDiagnosticsTest() {
  const ctx = makeFactionLlmContext();
  const fac = { name: 'DiagNpc', treasury: { money: 1000 }, derivedStrength: { value: 20 } };
  ctx.P = {
    playerInfo: { factionName: 'PlayerRealm' },
    ai: { key: 'fake' },
    conf: { npcAiPrecision: true, npcAiPrecisionRetryAttempts: 1, npcAiPrecisionMaxTokens: 3200 }
  };
  ctx.GM = { turn: 33, facs: [fac], chars: [], qijuHistory: [], _facIndex: { DiagNpc: { chars: [], parties: {}, metrics: {} } } };
  ctx.callAI = function() {
    return Promise.resolve('plain text without json object');
  };
  const ret = await ctx.TM.FactionNpcLlmDecision.decideFor('DiagNpc', { source: 'manual', turn: 33, maxAttempts: 1 });
  assert(ret && ret.skipped, 'bad LLM output should skip with fallback');
  const row = ctx.GM._npcFactionLlmLedger.runs.DiagNpc;
  assert(row && row.status === 'failed', 'failed run should stay in faction LLM ledger');
  assert(row.failure && row.failure.kind, 'failed run should record failure kind');
  assert(row.failure.rawPreview && row.failure.rawPreview.indexOf('plain text') >= 0, 'failed run should record raw output preview');

  const ctx2 = makeFactionLlmContext();
  const fac2 = { name: 'TruncNpc', treasury: { money: 1000 }, derivedStrength: { value: 20 } };
  ctx2.P = {
    playerInfo: { factionName: 'PlayerRealm' },
    ai: { key: 'fake' },
    conf: { npcAiPrecision: true, npcAiPrecisionRetryAttempts: 1, npcAiPrecisionMaxTokens: 1200 }
  };
  ctx2.GM = { turn: 34, facs: [fac2], chars: [], qijuHistory: [], _facIndex: { TruncNpc: { chars: [], parties: {}, metrics: {} } } };
  ctx2.callAI = function() {
    return Promise.resolve('{"rationale":"' + 'truncated-json-body '.repeat(90));
  };
  await ctx2.TM.FactionNpcLlmDecision.decideFor('TruncNpc', { source: 'manual', turn: 34, maxAttempts: 1 });
  const row2 = ctx2.GM._npcFactionLlmLedger.runs.TruncNpc;
  assert(row2 && row2.failure && row2.failure.rawLength > 1000, 'failed run should record raw output length');
  assert(row2.failure.possibleTruncation === true, 'failed run should flag likely truncated JSON output');
}

function inTurnForcedPoolTest() {
  const source = src('tm-faction-npc-in-turn-driver.js');
  assert(source.indexOf("'sc16-priority'") >= 0 || source.indexOf('"sc16-priority"') >= 0, 'in-turn forced pool should include sc16-priority');
  assert(source.indexOf("'sc16-rank'") >= 0 || source.indexOf('"sc16-rank"') >= 0, 'in-turn forced pool should include sc16-rank');
}

async function main() {
  settingsTextSeparationTest();
  await sc16HardOrderingTest();
  localTemplatePreplanPromptTest();
  expandedActionExecutionTest();
  await failureDiagnosticsTest();
  inTurnForcedPoolTest();
  console.log('[smoke-faction-llm-comprehensive-upgrade] all assertions pass');
}

main().catch(function(e) {
  console.error('[smoke-faction-llm-comprehensive-upgrade] fail:', (e && e.message) || e);
  if (e && e.stack) console.error(e.stack.split('\n').slice(1, 7).join('\n'));
  process.exit(1);
});
