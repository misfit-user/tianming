#!/usr/bin/env node
// smoke-char-economy-family-tier-contract.js - family/tier/legacy wealth contract reaches AI and NPC contexts.
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
let passed = 0;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
  passed++;
}

function load(ctx, rel) {
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  vm.runInContext(src, ctx, { filename: rel });
}

async function main() {
  const chars = [
    {
      id: 'legacy-gentry',
      name: 'LegacyGentry',
      alive: true,
      officialTitle: 'RevenueMinister',
      rankLevel: 3,
      rank: 3,
      family: 'li-clan',
      familyTier: 'great_clan',
      familyStatus: { '\u95e8\u7b2c': 'scholar_official', '\u90e1\u671b': '\u9647\u897f\u674e\u6c0f', '\u58f0\u671b': 82 },
      clanPrestige: 82,
      loyalty: 66,
      ambition: 54,
      integrity: 73,
      intelligence: 78,
      location: 'Capital',
      faction: 'Ming',
      resources: {
        private: { cash: 6400, grain: 80, cloth: 30, landAcres: 260, treasure: 700, commerce: 330, debt: 1200 },
        fame: 14,
        virtueMerit: 180,
        virtueStage: 3,
        stress: 39
      }
    },
    {
      id: 'merchant-head',
      name: 'MerchantHead',
      alive: true,
      socialClass: 'merchant',
      family: { clanId: 'merchant-clan', role: 'head' },
      familyTier: 'merchant',
      clanPrestige: 58,
      loyalty: 45,
      ambition: 72,
      integrity: 48,
      intelligence: 64,
      location: 'Capital',
      resources: {
        privateWealth: { money: 9200, commerce: 6400, land: 40, treasure: 1200, debt: 0 },
        fame: 8,
        virtueMerit: 40,
        stress: 48
      }
    }
  ];

  let lastPrompt = '';
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
      turn: 14,
      vars: {},
      rels: {},
      facs: [],
      parties: [],
      classes: [],
      armies: [],
      items: [],
      regions: [],
      chars: chars,
      clans: {
        'li-clan': { id: 'li-clan', name: '\u9647\u897f\u674e\u6c0f', tier: 'great_clan', renown: 88, sharedWealth: 20000, members: ['legacy-gentry', 'merchant-head'] },
        'merchant-clan': { id: 'merchant-clan', name: '\u6dee\u626c\u5546\u65cf', tier: 'merchant', renown: 54, sharedWealth: 12000, members: ['merchant-head'] }
      },
      guoku: { balance: 100000, money: 100000, ledgers: { money: { stock: 100000 } } },
      neitang: { balance: 20000, money: 20000 },
      corruption: { trueIndex: 25, subDepts: {} },
      memorials: [],
      letters: [],
      officeTree: [
        { name: 'Court', positions: [
          { name: 'RevenueMinister', holder: 'LegacyGentry', rank: '3' }
        ] }
      ],
      _pendingNpcLetters: [],
      _pendingNpcCorrespondence: [],
      _pendingNpcConspiracies: [],
      _npcHiddenMoves: [],
      _pendingAudiences: [],
      _npcActionLedger: [],
      _npcInternalActionHistory: [],
      _turnContext: { npcActionsThisTurn: [] }
    },
    P: { ai: { key: 'test-key' }, traitDefinitions: [], npcEngine: { enabled: true, behaviors: [] } },
    TM: { errors: { capture: function() {} } },
    AICache: { cleanup: function() {}, stats: { cacheHits: 0, cacheMisses: 0, totalCalls: 0, totalTime: 0, avgTime: 0, errors: 0 } },
    getTSText: function(turn) { return 'T' + turn; },
    getCompressionParams: function() { return { scale: 1 }; },
    getTopRelations: function() { return []; },
    findCharByName: function(name) { return chars.find(function(c) { return c.name === name; }) || null; },
    addEB: function() {},
    random: function() { return 0.2; },
    callAI: async function(prompt) {
      lastPrompt = String(prompt || '');
      return JSON.stringify([{ name: 'LegacyGentry', behaviorType: 'none', shouldExecute: false }]);
    },
    extractJSON: function(text) { return JSON.parse(text); }
  };
  ctx.window = ctx;
  ctx.global = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);

  load(ctx, 'tm-char-economy-engine.js');
  load(ctx, 'tm-ai-change-pathutils.js');
  load(ctx, 'tm-ai-change-army.js');
  load(ctx, 'tm-ai-change-narrative.js');
  load(ctx, 'generated/tm-ai-change-applier.bundle.js');
  load(ctx, 'tm-npc-engine.js');
  load(ctx, 'tm-npc-action-ledger.js');
  load(ctx, 'tm-npc-decision.js'); load(ctx, 'tm-npc-decision-ai-driven.js');

  assert(ctx.CharEconEngine && typeof ctx.CharEconEngine.buildEconomySnapshot === 'function',
    'CharEconEngine should expose buildEconomySnapshot contract');

  ctx.CharEconEngine.ensureCharResources(chars[0]);
  assert(chars[0].resources.privateWealth.money === 6400,
    'ensureCharResources should migrate legacy resources.private.cash into privateWealth.money');
  assert(chars[0].resources.privateWealth.land === 260 && chars[0].resources.privateWealth.debt === 1200,
    'ensureCharResources should preserve legacy landAcres and debt');

  const legacySnapshot = ctx.CharEconEngine.buildEconomySnapshot(chars[0]);
  assert(legacySnapshot.familyEconomy && legacySnapshot.familyEconomy.clanId === 'li-clan',
    'snapshot should resolve string family into clan id');
  assert(legacySnapshot.familyEconomy.clanName === '\u9647\u897f\u674e\u6c0f' && legacySnapshot.familyEconomy.sharedWealth === 20000,
    'snapshot should expose clan name and shared wealth');
  assert(legacySnapshot.familyEconomy.familyStatus && legacySnapshot.familyEconomy.familyStatus['\u90e1\u671b'] === '\u9647\u897f\u674e\u6c0f',
    'snapshot should preserve legacy familyStatus fields');
  assert(legacySnapshot.socialTier && legacySnapshot.socialTier.key === 'civilOfficial',
    'ranked office holder should normalize into civilOfficial social tier');
  assert(legacySnapshot.socialTier.familyTier === 'great_clan' && legacySnapshot.socialTier.clanPrestige === 82,
    'social tier should carry family tier and clan prestige');
  assert(legacySnapshot.socialTier.classParams && legacySnapshot.socialTier.classParams.consumptionBase >= 500,
    'social tier should expose class economy parameters');

  const merchantSnapshot = ctx.CharEconEngine.buildEconomySnapshot(chars[1]);
  assert(merchantSnapshot.socialTier.key === 'merchant' && merchantSnapshot.socialTier.classParams.commerceYield > 0,
    'merchant social tier should expose commerce yield');
  assert(merchantSnapshot.familyEconomy.isHead === true && merchantSnapshot.familyEconomy.memberCount === 1,
    'family object role=head should become familyEconomy.isHead');

  const fullContext = ctx.AIChangeApplier.buildFullAIContext();
  const legacyNpc = fullContext.npcs.find(function(n) { return n.name === 'LegacyGentry'; });
  assert(legacyNpc && legacyNpc.privateWealth.money === 6400 && legacyNpc.privateWealth.debt === 1200,
    'full AI context should use normalized privateWealth from legacy private/cash fields');
  assert(legacyNpc.economy.familyEconomy.sharedWealth === 20000 && legacyNpc.economy.socialTier.key === 'civilOfficial',
    'full AI context should expose family economy and social tier');


  const behaviorContext=ctx.buildNpcBehaviorContext();
  assert(behaviorContext.characterEconomy.length===0,'shared batch has no family treasury block');
  const legacyEconomy=ctx.buildNpcBehaviorContext(chars[0]).self.resources;
  const merchantEconomy=ctx.buildNpcBehaviorContext(chars[1]).self.resources;
  assert(legacyEconomy.familyEconomy.clanName==='陇西李氏','private actor packet retains own family background');
  assert(merchantEconomy.socialTier.key==='merchant','private merchant packet retains own economic circumstances');
  await ctx.batchNpcDecisions([chars[0]],behaviorContext,{maxTokens:800,tier:'secondary',privateActorId:chars[0].id});
  assert(lastPrompt.includes('familyEconomy')&&lastPrompt.includes('socialTier'),'actor own family and tier inform private decisions');
  await ctx.batchNpcDecisions(chars,behaviorContext,{maxTokens:800,tier:'secondary'});
  assert(!lastPrompt.includes('sharedWealth'),'another actor cannot receive clan balances through a shared prompt');

  console.log('[smoke-char-economy-family-tier-contract] PASS ' + passed + ' assertions');
}

main().catch(function(err) {
  console.error('[smoke-char-economy-family-tier-contract] FAIL');
  console.error(err && err.stack || err);
  process.exit(1);
});
