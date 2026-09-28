#!/usr/bin/env node
// smoke-npc-execution-economy-ability-wuchang-results.js - NPC execution outcomes use economy, abilities, and five constants.
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

function byType(cards, type) {
  return cards.find(function(c) { return c.behaviorType === type; });
}

function buildContext() {
  const chars = [
    {
      name: 'HonestTreasurer',
      alive: true,
      officialTitle: 'RevenueMinister',
      loyalty: 84,
      ambition: 38,
      intelligence: 86,
      administration: 90,
      management: 96,
      charisma: 64,
      diplomacy: 62,
      benevolence: 84,
      integrity: 94,
      location: 'Capital',
      faction: 'Ming',
      wuchangOverride: { '\u4EC1': 88, '\u4E49': 94, '\u793C': 78, '\u667A': 88, '\u4FE1': 96 },
      resources: {
        privateWealth: { money: 1000 },
        publicPurse: { money: 800, grain: 300, cloth: 40 },
        publicTreasury: { linkedPost: 'RevenueMinister', balance: 800, deficit: 7200, isReadOnly: true },
        fame: 18,
        virtueMerit: 360,
        stress: 34
      }
    },
    {
      name: 'CrookedMinister',
      alive: true,
      officialTitle: 'CourtMinister',
      loyalty: 38,
      ambition: 90,
      intelligence: 78,
      administration: 62,
      management: 90,
      charisma: 84,
      diplomacy: 76,
      benevolence: 28,
      integrity: 22,
      location: 'Capital',
      faction: 'Ming',
      party: 'ShadowBloc',
      wuchangOverride: { '\u4EC1': 24, '\u4E49': 18, '\u793C': 48, '\u667A': 78, '\u4FE1': 20 },
      resources: {
        privateWealth: { money: 2400, treasure: 900, commerce: 800 },
        publicPurse: { money: 2600, grain: 300, cloth: 80 },
        publicTreasury: { linkedPost: 'CourtMinister', balance: 2600, deficit: 500, isReadOnly: true },
        hiddenWealth: 1800,
        fame: -30,
        virtueMerit: -120,
        stress: 64
      }
    },
    {
      name: 'DebtorClerk',
      alive: true,
      officialTitle: 'Clerk',
      loyalty: 58,
      ambition: 62,
      intelligence: 68,
      administration: 58,
      management: 86,
      charisma: 52,
      diplomacy: 45,
      benevolence: 48,
      integrity: 52,
      location: 'Capital',
      faction: 'Ming',
      wuchangOverride: { '\u4EC1': 48, '\u4E49': 52, '\u793C': 55, '\u667A': 68, '\u4FE1': 52 },
      resources: {
        privateWealth: { money: -900, debt: 900 },
        fame: -6,
        virtueMerit: 10,
        stress: 76
      }
    },
    {
      name: 'BenevolentGovernor',
      alive: true,
      officialTitle: 'Governor',
      loyalty: 78,
      ambition: 42,
      intelligence: 74,
      administration: 84,
      management: 80,
      charisma: 74,
      diplomacy: 70,
      benevolence: 96,
      integrity: 88,
      location: 'Liaodong',
      jurisdiction: 'Liaodong',
      faction: 'Ming',
      wuchangOverride: { '\u4EC1': 96, '\u4E49': 90, '\u793C': 84, '\u667A': 76, '\u4FE1': 88 },
      resources: {
        privateWealth: { money: 800 },
        publicPurse: { money: 5200, grain: 1200, cloth: 300 },
        publicTreasury: { linkedRegion: 'Liaodong', balance: 5200, deficit: 0, isReadOnly: true },
        fame: 34,
        virtueMerit: 440,
        stress: 32
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
    GM: {
      running: true,
      turn: 11,
      vars: {},
      rels: {},
      facs: [],
      parties: [],
      chars: chars,
      armies: [],
      memorials: [],
      letters: [],
      guoku: { balance: 60000, money: 60000, ledgers: { money: { stock: 60000 } } },
      corruption: { trueIndex: 30, subDepts: { provincial: { true: 30 } } },
      _pendingNpcLetters: [],
      _pendingNpcCorrespondence: [],
      _pendingNpcConspiracies: [],
      _npcHiddenMoves: [],
      _pendingAudiences: [],
      _npcActionLedger: [],
      _npcInternalActionHistory: [],
      _npcExecutionResults: [],
      _npcDecisionDiagnostics: [],
      _capital: 'Capital',
      provinceStats: {
        Liaodong: { prosperity: 42, unrest: 40, security: 42 },
        Capital: { prosperity: 70, unrest: 8, security: 72 }
      },
      officeTree: [
        { name: 'Court', positions: [
          { name: 'RevenueMinister', holder: 'HonestTreasurer', rank: '2' },
          { name: 'CourtMinister', holder: 'CrookedMinister', rank: '2' },
          { name: 'Clerk', holder: 'DebtorClerk', rank: '7' }
        ] },
        { name: 'Province', positions: [
          { name: 'Governor', holder: 'BenevolentGovernor', rank: '4' }
        ] }
      ],
      _turnContext: { npcActionsThisTurn: [] }
    },
    P: { ai: { key: 'test-key' }, traitDefinitions: [], npcEngine: { enabled: true, behaviors: [] } },
    AICache: { cleanup: function(){} },
    _dbg: function(){},
    getTSText: function(turn) { return 'T' + turn; },
    getCompressionParams: function() { return { scale: 1 }; },
    findCharByName: function(name) { return chars.find(function(c) { return c.name === name; }) || null; },
    addEB: function(type, text) { events.push({ type: type, text: text }); },
    random: function() { return 0.2; }
  };
  ctx.window = ctx;
  ctx.global = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  return ctx;
}

function executeCard(ctx, npc, type, target) {
  const context = ctx.buildNpcBehaviorContext();
  const card = byType(ctx._buildNpcActionCandidates(npc, context), type);
  assert(card, npc.name + ' should have ' + type + ' ActionCard');
  const ok = ctx._executeNormalizedNpcDecision({
    name: npc.name,
    actionId: card.id,
    target: target || card.target,
    shouldExecute: true
  }, npc, context);
  assert(ok === true, npc.name + ' should execute ' + type);
  return card;
}

// The previous expectations awarded money from ability and from a request itself.
// Keep the same economic situations, but assert sourced operations and no fabricated balances.
function main() {
  const ctx=buildContext();ctx.GM.chars.forEach((c,i)=>c.id='econ-'+i);
  ['tm-office-holder-state.js','tm-office-system.js','tm-npc-engine.js','tm-npc-action-ledger.js','tm-npc-decision.js','tm-npc-decision-ai-driven.js','tm-ai-change-pathutils.js','tm-ai-change-army.js','tm-ai-change-narrative.js','generated/tm-ai-change-applier.bundle.js'].forEach(f=>load(ctx,f));
  for(const npc of ctx.GM.chars){
    const before=JSON.stringify(npc.resources),money=ctx.GM.guoku.balance,province=JSON.stringify(ctx.GM.provinceStats);
    const decision={actorId:npc.id,name:npc.name,behaviorType:'office_duty',step:'report',content:'呈交任内事项，请协助复核',intent:'核对任内事项',abilityFit:1e9,wuchangFit:1e9};
    const r=ctx.TM.NPC.ActionLedger.ingest(decision,'smoke');
    assert(r.outcome==='submitted','current sole office can submit an actual work memorial');
    assert(JSON.stringify(ctx.GM.chars.find(c=>c.id===npc.id).resources)===before,'duty does not invent private, hidden or public wealth');
    assert(ctx.GM.guoku.balance===money,'duty never produces or destroys public cash from ability');
    assert(JSON.stringify(ctx.GM.provinceStats)===province,'duty does not invent provincial outcomes');
    const real=ctx._npcEnsureExecutionFactors(npc,'office_duty',null,{abilityFit:1e9,wuchangFit:1e9});
    assert(real.abilityFit<1000&&real.wuchangFit<1000,'model-supplied fit is not a mechanical input');
    assert(ctx.TM.NPC.ActionLedger.ingest({actorId:npc.id,name:npc.name,behaviorType:'private_life',intent:'料理家务'},'smoke').outcome==='noop','rest remains a valid no-operation state');
    assert(JSON.stringify(ctx.GM.chars.find(c=>c.id===npc.id).resources)===before,'private life does not pay off debt by assertion');
  }
  const treasurer=ctx.GM.chars[0],before=JSON.stringify(treasurer.resources);
  const r=ctx.TM.NPC.ActionLedger.ingest({actorId:treasurer.id,behaviorType:'request_funds',intent:'请拨经费',amount:1000000000},'smoke');
  assert(r.outcome==='submitted','request creates a submitted document');
  assert(JSON.stringify(ctx.GM.chars[0].resources)===before,'request never grants itself funds');
  assert(ctx.GM.memorials.some(m=>m._npcFundingRequest&&m._npcFundingRequest.requestedAmount===1000000000),'requested amount is retained as an unapproved claim');
  assert(ctx.GM._npcExecutionResults.every(r=>r.outcome==='submitted'&&r.operationRefs[0].kind==='memorial'),'receipts describe the actual stage and actual document');
  console.log('[smoke-npc-execution-economy-ability-wuchang-results] PASS '+passed+' assertions');
}

try {
  main();
} catch (err) {
  console.error('[smoke-npc-execution-economy-ability-wuchang-results] FAIL');
  console.error(err && err.stack || err);
  process.exit(1);
}
