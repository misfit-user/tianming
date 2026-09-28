#!/usr/bin/env node
// smoke-char-economy-ai-context.js - character economy reaches AI/NPC decision context.
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
      id: 'c-rich',
      name: 'RichMinister',
      alive: true,
      officialTitle: 'RevenueMinister',
      rank: 2,
      rankLevel: 2,
      loyalty: 55,
      ambition: 76,
      integrity: 42,
      intelligence: 78,
      faction: 'MingCourt',
      location: 'Capital',
      resources: {
        privateWealth: { money: 8800, grain: 120, cloth: 80, land: 320, treasure: 1200, commerce: 450 },
        publicPurse: { money: 30000, grain: 2000, cloth: 500 },
        publicTreasury: { linkedPost: 'RevenueMinister', balance: 30000, grain: 2000, cloth: 500, deficit: 1500, isReadOnly: true },
        hiddenWealth: 2600,
        fame: -18,
        virtueMerit: 220,
        virtueStage: 3,
        health: 82,
        stress: 41
      },
      _lastTickIncome: { salary: 30, bribes: 24 },
      _lastTickExpense: { livingCost: 90, patronage: 20 },
      _lastTickNet: -56
    },
    {
      id: 'c-poor',
      name: 'PoorScholar',
      alive: true,
      loyalty: 70,
      ambition: 45,
      intelligence: 70,
      integrity: 78,
      location: 'Capital',
      resources: {
        privateWealth: { money: -300, land: 0, treasure: 0, commerce: 0 },
        fame: 12,
        virtueMerit: 60,
        virtueStage: 2,
        health: 73,
        stress: 58
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
      turn: 12,
      year: 1627,
      month: 3,
      vars: {},
      rels: {},
      facs: [],
      parties: [],
      classes: [],
      armies: [],
      items: [],
      regions: [],
      guoku: { money: 100000, balance: 100000, ledgers: { money: { stock: 100000 } } },
      neitang: { money: 20000, balance: 20000 },
      corruption: { trueIndex: 30, subDepts: {} },
      chars: chars,
      officeTree: [
        { name: 'Court', positions: [
          { name: 'RevenueMinister', holder: 'RichMinister', rank: '2' }
        ] }
      ],
      memorials: [],
      letters: [],
      _pendingNpcLetters: [],
      _pendingNpcCorrespondence: [],
      _pendingNpcConspiracies: [],
      _npcHiddenMoves: [],
      _pendingAudiences: [],
      _npcInternalActionHistory: []
    },
    P: {
      ai: { key: 'test-key' },
      traitDefinitions: [],
      npcEngine: { enabled: true, behaviors: [] }
    },
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
      return JSON.stringify([{ name: 'RichMinister', behaviorType: 'none', shouldExecute: false }]);
    },
    extractJSON: function(text) { return JSON.parse(text); }
  };
  ctx.window = ctx;
  ctx.global = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);

  load(ctx, 'tm-ai-change-pathutils.js');
  load(ctx, 'tm-ai-change-army.js');
  load(ctx, 'tm-ai-change-narrative.js');
  load(ctx, 'generated/tm-ai-change-applier.bundle.js');
  load(ctx, 'tm-npc-engine.js');
  load(ctx, 'tm-npc-action-ledger.js');
  load(ctx, 'tm-npc-decision.js'); load(ctx, 'tm-npc-decision-ai-driven.js');

  const fullContext = ctx.AIChangeApplier.buildFullAIContext();
  const richNpc = fullContext.npcs.find(function(n) { return n.name === 'RichMinister'; });
  assert(richNpc, 'full AI context should include the office-holding rich minister');
  assert(richNpc.privateWealth && richNpc.privateWealth.money === 8800,
    'full AI context should read resources.privateWealth.money, not the retired resources.private field');
  assert(richNpc.privateWealth.land === 320 && richNpc.privateWealth.treasure === 1200,
    'full AI context should expose private land and treasure');
  assert(richNpc.economy && richNpc.economy.hiddenWealth === 2600 && richNpc.economy.fame === -18,
    'full AI context should expose hidden wealth and fame in the economy snapshot');
  assert(richNpc.economy.virtueMerit === 220 && richNpc.economy.virtueStage === 3,
    'full AI context should expose virtue merit and stage');
  assert(richNpc.economy.publicPurse && richNpc.economy.publicPurse.money === 30000,
    'full AI context should expose office public purse mirror');
  assert(richNpc.economy.publicTreasury && richNpc.economy.publicTreasury.deficit === 1500,
    'full AI context should expose public treasury pressure');
  assert(richNpc.economy.lastTick && richNpc.economy.lastTick.net === -56,
    'full AI context should expose the last character economy tick');


  const behaviorContext=ctx.buildNpcBehaviorContext();
  assert(behaviorContext.characterEconomy.length===0,'public batch excludes private wealth');
  const richEconomy=ctx.buildNpcBehaviorContext(chars[0]).self.resources;
  const poorEconomy=ctx.buildNpcBehaviorContext(chars[1]).self.resources;
  assert(richEconomy.privateWealth.money===8800,'rich NPC knows its recorded private balance');
  assert(richEconomy.publicTreasury.isReadOnly&&richEconomy.publicTreasury.legacyReported,'legacy treasury mirror is labeled as reported information');
  assert(poorEconomy.privateWealth.money===-300,'legacy negative balance is preserved as data, without creating a loan or payoff');
  await ctx.batchNpcDecisions([chars[0]],behaviorContext,{maxTokens:800,tier:'secondary',privateActorId:chars[0].id});
  assert(lastPrompt.includes('8800')&&lastPrompt.includes('self'),'private packet contains the actor own resources');
  assert(!lastPrompt.includes('"money":-300'),'private packet cannot contain a different person private ledger');
  await ctx.batchNpcDecisions(chars,behaviorContext,{maxTokens:800,tier:'secondary'});
  assert(!lastPrompt.includes('8800'),'common batch contains no private balance');

  console.log('[smoke-char-economy-ai-context] PASS ' + passed + ' assertions');
}

main().catch(function(err) {
  console.error('[smoke-char-economy-ai-context] FAIL');
  console.error(err && err.stack || err);
  process.exit(1);
});
