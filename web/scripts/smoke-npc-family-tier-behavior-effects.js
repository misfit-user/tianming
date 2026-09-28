#!/usr/bin/env node
// smoke-npc-family-tier-behavior-effects.js - family economy and social tier affect NPC choices and outcomes.
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
let passed = 0;
let lastPrompt = '';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
  passed++;
}

function load(ctx, rel) {
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  vm.runInContext(src, ctx, { filename: rel });
}

function byType(cards, type) {
  return cards.find(function(c) { return c.behaviorType === type; });
}

function buildContext() {
  const chars = [
    {
      id: 'clan-patron',
      name: 'ClanPatron',
      alive: true,
      officialTitle: 'RevenueMinister',
      rankLevel: 3,
      rank: 3,
      family: { clanId: 'great-clan', role: 'head' },
      familyTier: 'great_clan',
      clanPrestige: 92,
      socialClass: 'civilOfficial',
      loyalty: 64,
      ambition: 66,
      integrity: 72,
      intelligence: 76,
      administration: 72,
      management: 70,
      charisma: 78,
      diplomacy: 76,
      location: 'Capital',
      faction: 'Ming',
      resources: {
        privateWealth: { money: 900, commerce: 200, land: 300, treasure: 600, debt: 0 },
        fame: 22,
        virtueMerit: 160,
        stress: 42
      }
    },
    {
      id: 'isolated-official',
      name: 'IsolatedOfficial',
      alive: true,
      officialTitle: 'RevenueMinister',
      rankLevel: 3,
      rank: 3,
      familyTier: 'commoner',
      clanPrestige: 5,
      socialClass: 'civilOfficial',
      loyalty: 64,
      ambition: 66,
      integrity: 72,
      intelligence: 76,
      administration: 72,
      management: 70,
      charisma: 78,
      diplomacy: 76,
      location: 'Capital',
      faction: 'Ming',
      resources: {
        privateWealth: { money: 900, commerce: 200, land: 30, treasure: 60, debt: 0 },
        fame: 8,
        virtueMerit: 80,
        stress: 42
      }
    },
    {
      id: 'merchant-broker',
      name: 'MerchantBroker',
      alive: true,
      socialClass: 'merchant',
      family: { clanId: 'merchant-clan', role: 'head' },
      familyTier: 'merchant',
      clanPrestige: 64,
      loyalty: 48,
      ambition: 62,
      integrity: 52,
      intelligence: 68,
      management: 74,
      charisma: 70,
      diplomacy: 72,
      location: 'Capital',
      faction: 'Ming',
      resources: {
        privateWealth: { money: 1800, commerce: 9600, land: 60, treasure: 1000, debt: 0 },
        fame: 12,
        virtueMerit: 50,
        stress: 44
      }
    },
    {
      id: 'debtor-scholar',
      name: 'DebtorScholar',
      alive: true,
      socialClass: 'commoner',
      familyTier: 'commoner',
      clanPrestige: 8,
      loyalty: 58,
      ambition: 50,
      integrity: 60,
      intelligence: 72,
      management: 52,
      charisma: 45,
      diplomacy: 48,
      location: 'Capital',
      faction: 'Ming',
      resources: {
        privateWealth: { money: -1500, debt: 1600, commerce: 0, land: 0, treasure: 0 },
        fame: -4,
        virtueMerit: 30,
        stress: 78
      }
    }
  ];
  const events = [];
  const ctx = {
    console: console,
    Math, Date, JSON, Object, Array, Number, String, Boolean, RegExp,
    isFinite, isNaN, parseInt, parseFloat, Promise, Symbol, Map, Set,
    setTimeout: function() { return 0; },
    clearTimeout: function() {},
    setInterval: function() { return 0; },
    clearInterval: function() {},
    Error, TypeError, RangeError,
    GM: {
      running: true,
      turn: 15,
      vars: {},
      rels: {},
      facs: [],
      parties: [],
      classes: [],
      armies: [],
      chars: chars,
      clans: {
        'great-clan': { id: 'great-clan', name: '\u6c5d\u5357\u5468\u6c0f', tier: 'great_clan', renown: 92, sharedWealth: 32000, members: ['clan-patron'] },
        'merchant-clan': { id: 'merchant-clan', name: '\u6dee\u626c\u5546\u65cf', tier: 'merchant', renown: 64, sharedWealth: 14000, members: ['merchant-broker'] }
      },
      guoku: { balance: 100000, money: 100000, ledgers: { money: { stock: 100000 } } },
      corruption: { trueIndex: 30, subDepts: {} },
      memorials: [],
      letters: [],
      officeTree: [
        { name: 'Court', positions: [
          { name: 'RevenueMinister', holder: 'ClanPatron', rank: '3' },
          { name: 'RevenueMinister', holder: 'IsolatedOfficial', rank: '3' }
        ] }
      ],
      _pendingNpcLetters: [],
      _pendingNpcCorrespondence: [],
      _pendingNpcConspiracies: [],
      _npcHiddenMoves: [],
      _pendingAudiences: [],
      _npcActionLedger: [],
      _npcInternalActionHistory: [],
      _npcExecutionResults: [],
      _turnContext: { npcActionsThisTurn: [] },
      _capital: 'Capital'
    },
    P: { ai: { key: 'test-key' }, traitDefinitions: [], npcEngine: { enabled: true, behaviors: [] }, playerInfo: { characterName: 'Emperor' } },
    TM: { errors: { capture: function() {} } },
    AICache: { cleanup: function() {}, stats: { cacheHits: 0, cacheMisses: 0, totalCalls: 0, totalTime: 0, avgTime: 0, errors: 0 } },
    getTSText: function(turn) { return 'T' + turn; },
    getCompressionParams: function() { return { scale: 1 }; },
    findCharByName: function(name) { return chars.find(function(c) { return c.name === name; }) || null; },
    addEB: function(type, text) { events.push({ type: type, text: text }); },
    random: function() { return 0.2; },
    callAI: async function(prompt) {
      lastPrompt = String(prompt || '');
      return JSON.stringify([{ name: 'ClanPatron', behaviorType: 'none', shouldExecute: false }]);
    },
    extractJSON: function(text) { return JSON.parse(text); }
  };
  ctx.window = ctx;
  ctx.global = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  return ctx;
}

function executeCard(ctx, npc, card) {
  const ok = ctx._executeNormalizedNpcDecision({
    name: npc.name,
    actionId: card.id,
    target: card.target,
    shouldExecute: true
  }, npc, ctx.buildNpcBehaviorContext());
  assert(ok === true, npc.name + ' should execute ' + card.behaviorType);
}

async function main() {
  const ctx = buildContext();
  ctx.GM.chars.forEach((c,i)=>c.id='family-'+i);
  load(ctx, 'tm-char-economy-engine.js');
  load(ctx, 'tm-npc-engine.js');
  load(ctx, 'tm-npc-action-ledger.js');
  load(ctx, 'tm-npc-decision.js'); load(ctx, 'tm-npc-decision-ai-driven.js');
  ['tm-ai-change-pathutils.js','tm-ai-change-army.js','tm-ai-change-narrative.js','generated/tm-ai-change-applier.bundle.js'].forEach(f=>load(ctx,f));

  const patron = ctx.GM.chars[0];
  const isolated = ctx.GM.chars[1];
  const merchant = ctx.GM.chars[2];
  const debtor = ctx.GM.chars[3];
  const context = ctx.buildNpcBehaviorContext();

  const patronCards = ctx._buildNpcActionCandidates(patron, context);
  const isolatedCards = ctx._buildNpcActionCandidates(isolated, context);
  const patronNetwork = byType(patronCards, 'build_network');
  const isolatedNetwork = byType(isolatedCards, 'build_network');
  assert(patronNetwork, 'great-clan head should get build_network even below the old ambition threshold');
  assert(typeof patronNetwork.familyFit === 'number' && patronNetwork.familyFit >= 8,
    'great-clan build_network should carry familyFit');
  assert(!isolatedNetwork || patronNetwork.score >= isolatedNetwork.score + 6,
    'family shared wealth should materially separate clan patron from isolated official');

  const merchantCards = ctx._buildNpcActionCandidates(merchant, context);
  const merchantNetwork = byType(merchantCards, 'build_network');
  const merchantPrivate = byType(merchantCards, 'private_life');
  assert(merchantNetwork, 'merchant with commerce should get a network action below the old ambition threshold');
  assert(merchantNetwork.tierFit >= 8 && merchantNetwork.score > merchantPrivate.score,
    'merchant commerce tier should push build_network above routine private_life');

  const debtorCards = ctx._buildNpcActionCandidates(debtor, context);
  const debtorPrivate = byType(debtorCards, 'private_life');
  assert(debtorPrivate && debtorPrivate.tierFit >= 2,
    'debt-burdened commoner should still carry tier/survival pressure on private_life');

  // Family position changes motivation; asking for a network no longer spends family money or invents consent.
  const clanBefore=ctx.GM.clans['great-clan'].sharedWealth;
  executeCard(ctx,patron,patronNetwork);
  assert(ctx.GM.clans['great-clan'].sharedWealth===clanBefore,'an invitation does not spend clan resources');
  assert(ctx.GM._npcPlans.length===1&&ctx.GM._npcPlans[0].progress===0,'network request is a persistent uncompleted plan');
  assert(patron._lastNpcExecution.outcome==='submitted','network record reports submission, not completion');
  const wealth=merchant.resources.privateWealth.money;
  const merchantResult=ctx.TM.NPC.ActionLedger.ingest({actorId:merchant.id,behaviorType:'private_life',intent:'料理家务'},'smoke');
  assert(merchantResult.outcome==='noop','private life can legitimately rest without a transaction');
  assert(ctx.GM.chars.find(c=>c.id===merchant.id).resources.privateWealth.money===wealth,'commerce class does not mint money in autonomous handler');
  await ctx.batchNpcDecisions([patron],context,{maxTokens:800,tier:'secondary',privateActorId:patron.id});
  assert(lastPrompt.includes(patron.name)&&lastPrompt.includes('self'),'private decision receives its own context');
  await ctx.batchNpcDecisions([patron,merchant],context,{maxTokens:800,tier:'secondary'});
  assert(!lastPrompt.includes('sharedWealth'),'public batch excludes clan private ledgers');
  console.log('[smoke-npc-family-tier-behavior-effects] PASS ' + passed + ' assertions');
}

main().catch(function(err) {
  console.error('[smoke-npc-family-tier-behavior-effects] FAIL');
  console.error(err && err.stack || err);
  process.exit(1);
});
