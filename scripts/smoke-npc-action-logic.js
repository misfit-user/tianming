#!/usr/bin/env node
// smoke-npc-action-logic.js - NPC action normalization, candidate actions, and empty-engine guard.
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
    { id: 'c1', name: 'ZhangSan', alive: true, loyalty: 65, ambition: 82, intelligence: 75, integrity: 80, officialTitle: 'Minister', location: 'Capital', faction: 'Ming', party: 'CourtBloc' },
    { id: 'c2', name: 'LiSi', alive: true, loyalty: 50, ambition: 40, intelligence: 55, integrity: 45, officialTitle: 'Clerk', location: 'Capital', faction: 'Ming', party: 'CourtBloc' },
    { id: 'c3', name: 'GeneralWang', alive: true, loyalty: 58, ambition: 65, valor: 88, troops: 1000, officialTitle: 'General', location: 'Frontier' },
    { id: 'c4', name: 'RemoteZhao', alive: true, loyalty: 72, ambition: 35, intelligence: 70, officialTitle: 'Governor', location: 'Liaodong', faction: 'Ming' },
    { id: 'c5', name: 'QianRival', alive: true, loyalty: 45, ambition: 77, intelligence: 72, officialTitle: 'Censor', location: 'Capital', faction: 'Ming', party: 'RivalBloc' },
    { id: 'c6', name: 'ChenAlly', alive: true, loyalty: 80, ambition: 25, intelligence: 50, officialTitle: 'Secretary', location: 'Capital', faction: 'Ming', party: 'CourtBloc' },
    { id: 'c7', name: 'CleanCensor', alive: true, loyalty: 82, ambition: 42, intelligence: 86, integrity: 92, officialTitle: 'Censor', location: 'Capital', faction: 'Ming', party: 'CourtBloc' },
    { id: 'c8', name: 'LocalMagistrate', alive: true, loyalty: 68, ambition: 45, intelligence: 66, integrity: 72, officialTitle: 'Magistrate', location: 'Liaodong', faction: 'Ming', jurisdiction: 'Liaodong' }
  ];
  const events = [];
  let lastPrompt = '';

  const ctx = {
    console: console,
    setTimeout: function(fn) { if (typeof fn === 'function') fn(); return 1; },
    clearTimeout: function(){},
    Promise: Promise,
    Math: Math,
    Date: Date,
    JSON: JSON,
    Map: Map,
    Array: Array,
    Object: Object,
    String: String,
    Number: Number,
    RegExp: RegExp,
    P: {
      ai: { key: 'test-key', url: 'https://example.invalid/v1/chat/completions', model: 'test' },
      traitDefinitions: [],
      npcEngine: {
        enabled: true,
        behaviors: [
          { id: 'recommend', name: 'recommend', enabled: true, weight: { base: 20 } }
        ]
      }
    },
    GM: {
      turn: 3,
      vars: {},
      rels: {},
      facs: [],
      chars: chars,
      armies: [{ name: 'Border Army', commander: 'GeneralWang', training: 40, morale: 50 }],
      memorials: [],
      letters: [],
      _pendingNpcLetters: [],
      _pendingNpcCorrespondence: [],
      _pendingNpcConspiracies: [],
      _npcHiddenMoves: [],
      _pendingAudiences: [],
      _npcActionLedger: [],
      _npcPlans: [],
      _npcDecisionDiagnostics: [],
      _capital: 'Capital',
      provinceStats: {
        Liaodong: { prosperity: 45, unrest: 32, security: 44 },
        Capital: { prosperity: 70, unrest: 8, security: 72 }
      },
      officeTree: [
        { name: 'Court', positions: [
          { name: 'Minister', holder: 'ZhangSan', rank: '2' },
          { name: 'Clerk', holder: 'LiSi', rank: '7' },
          { name: 'Censor', holder: 'QianRival', rank: '5' },
          { name: 'Censor', holder: 'CleanCensor', rank: '5' }
        ] },
        { name: 'Army', positions: [
          { name: 'General', holder: 'GeneralWang', rank: '3' }
        ] },
        { name: 'Province', positions: [
          { name: 'Governor', holder: 'RemoteZhao', rank: '4' },
          { name: 'Magistrate', holder: 'LocalMagistrate', rank: '7' }
        ] }
      ],
      _turnContext: { npcActionsThisTurn: [] }
    },
    AICache: { cleanup: function(){} },
    _dbg: function(){},
    getTSText: function(turn) { return 'T' + turn; },
    getCompressionParams: function() { return { scale: 1 }; },
    findCharByName: function(name) { return chars.find(function(c) { return c.name === name; }) || null; },
    addEB: function(type, text) { events.push({ type: type, text: text }); },
    random: function() { return 0.2; },
    adjustCharacterLoyalty: function(ch, delta, reason, meta) {
      ch.loyalty += delta;
      ch._lastLoyaltyReason = reason;
      ch._lastLoyaltyMeta = meta;
    },
    callAI: async function(prompt) {
      lastPrompt = String(prompt || '');
      const behaviorContext = ctx.buildNpcBehaviorContext();
      const zhangPetition = ctx._buildNpcActionCandidates(chars[0], behaviorContext).find(function(c) { return c.behaviorType === 'petition'; });
      const wangTrain = ctx._buildNpcActionCandidates(chars[2], behaviorContext).find(function(c) { return c.behaviorType === 'train_troops'; });
      const zhaoLetter = ctx._buildNpcActionCandidates(chars[3], behaviorContext).find(function(c) { return c.behaviorType === 'send_letter'; });
      return JSON.stringify([
        { name: 'ZhangSan', actionId: zhangPetition.id, shouldExecute: true },
        { name: 'GeneralWang', actionId: wangTrain.id, shouldExecute: true },
        { name: 'RemoteZhao', actionId: zhaoLetter.id, shouldExecute: true }
      ]);
    },
    extractJSON: function(text) { return JSON.parse(text); }
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);

  load(ctx, 'tm-npc-engine.js');
  load(ctx, 'tm-npc-action-ledger.js');
  load(ctx, 'tm-npc-decision.js');

  assert(ctx.TM && ctx.TM.NPC && ctx.TM.NPC.ActionLedger,
    'TM.NPC.ActionLedger should expose the unified character NPC action ledger');
  assert(typeof ctx.TM.NPC.ActionLedger.collectHandledNamesFromP1 === 'function',
    'NPC action ledger should collect handled actors from main AI outputs');
  assert(typeof ctx.TM.NPC.ActionLedger.record === 'function',
    'NPC action ledger should record normalized character NPC actions');
  assert(typeof ctx.TM.NPC.ActionLedger.diagnose === 'function',
    'NPC action ledger should expose diagnostics');
  assert(typeof ctx.TM.NPC.ActionLedger.recordConsideration === 'function',
    'NPC action ledger should record per-turn NPC decision consideration diagnostics');
  assert(typeof ctx.TM.NPC.ActionLedger.recordPlan === 'function',
    'NPC action ledger should persist multi-turn NPC plans');

  const indexSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const inferSrc = fs.readFileSync(path.join(ROOT, 'tm-endturn-ai-infer.js'), 'utf8');
  const applySrc = fs.readFileSync(path.join(ROOT, 'tm-endturn-apply.js'), 'utf8');
  const decisionSrc = fs.readFileSync(path.join(ROOT, 'tm-npc-decision.js'), 'utf8');
  assert(indexSrc.indexOf('tm-npc-action-ledger.js') >= 0,
    'index.html should load the unified NPC action ledger before npc decision logic');
  assert(inferSrc.indexOf('collectHandledNamesFromP1') >= 0,
    'end-turn inference should prime handled NPC names from all main-AI NPC outputs');
  assert(applySrc.indexOf('main_ai:npc_actions') >= 0,
    'end-turn apply should record main-AI npc_actions into the NPC action ledger');
  assert(applySrc.indexOf('main_ai:npc_interactions') >= 0,
    'end-turn apply should record main-AI npc_interactions into the NPC action ledger');
  assert(applySrc.indexOf('main_ai:npc_letters') >= 0,
    'end-turn apply should record main-AI npc_letters into the NPC action ledger');
  assert(applySrc.indexOf('main_ai:npc_correspondence') >= 0,
    'end-turn apply should record main-AI npc_correspondence into the NPC action ledger');
  assert(decisionSrc.indexOf('TM.NPC.ActionLedger.record') >= 0,
    'supplemental NPC autonomy should record decisions through the unified NPC action ledger');
  assert(decisionSrc.indexOf('TM.NPC.ActionLedger.getHandledNames') >= 0,
    'supplemental NPC autonomy should dedupe through the unified handled-name list');

  const handledFromMainAi = ctx.TM.NPC.ActionLedger.collectHandledNamesFromP1({
    npc_actions: [{ name: 'ZhangSan', action: 'petition' }],
    npc_interactions: [{ actor: 'QianRival', target: 'LiSi', type: 'slander' }],
    npc_letters: [{ from: 'RemoteZhao', content: 'frontier report' }],
    npc_correspondence: [{ from: 'ChenAlly', to: 'LiSi', content: 'private note' }]
  });
  assert(handledFromMainAi.indexOf('ZhangSan') >= 0,
    'main npc_actions should mark actor as handled');
  assert(handledFromMainAi.indexOf('QianRival') >= 0,
    'main npc_interactions should mark actor as handled');
  assert(handledFromMainAi.indexOf('RemoteZhao') >= 0 && handledFromMainAi.indexOf('ChenAlly') >= 0,
    'main npc letter/correspondence outputs should mark senders as handled');

  const deadPreflight = ctx.TM.NPC.ActionLedger.preflight({
    actor: 'DeadMinister',
    type: 'petition',
    source: 'unit'
  }, { chars: chars.concat([{ name: 'DeadMinister', alive: false }]) });
  assert(deadPreflight.ok === false,
    'NPC action preflight should reject dead actors');
  chars[0].isPlayer = true;
  const playerPreflight = ctx.TM.NPC.ActionLedger.preflight({
    actor: 'ZhangSan',
    type: 'petition',
    source: 'unit'
  });
  assert(playerPreflight.ok === false,
    'NPC action preflight should reject player-controlled actors as autonomous actors');
  chars[0].isPlayer = false;

  const interactionEntry = ctx.TM.NPC.ActionLedger.record({
    source: 'main_ai:npc_interactions',
    actor: 'QianRival',
    type: 'slander',
    target: 'LiSi',
    action: 'QianRival slanders LiSi',
    uiRoutes: ['relation', 'memory']
  }, { markHandled: true });
  assert(interactionEntry && interactionEntry.kind === 'npc_interaction',
    'recorded npc_interactions should normalize to npc_interaction kind');
  assert(ctx.GM._turnContext.npcActionsThisTurn.indexOf('QianRival') >= 0,
    'recorded NPC interaction should mark actor as handled for supplemental decision dedupe');
  assert(ctx.TM.NPC.ActionLedger.diagnose().byKind.npc_interaction >= 1,
    'NPC action diagnostics should count recorded interaction entries');

  assert(typeof ctx.NpcEngine.hasExecutableBehaviors === 'function',
    'NpcEngine should expose hasExecutableBehaviors() for end-turn guard');
  assert(ctx.NpcEngine.hasExecutableBehaviors() === false,
    'data-only npcEngine behavior templates should be detected as non-executable');

  assert(typeof ctx._buildNpcActionCandidates === 'function',
    'NPC decision layer should expose candidate action builder');
  assert(typeof ctx._scoreNpcActionCandidate === 'function',
    'NPC decision layer should expose candidate scoring helper');
  assert(typeof ctx._buildNpcMotiveProfile === 'function',
    'NPC decision layer should expose motive profile builder');

  const behaviorContext = ctx.buildNpcBehaviorContext();
  const courtCandidates = ctx._buildNpcActionCandidates(chars[0], behaviorContext);
  const militaryCandidates = ctx._buildNpcActionCandidates(chars[2], behaviorContext);
  const remoteCandidates = ctx._buildNpcActionCandidates(chars[3], behaviorContext);
  const censorCandidates = ctx._buildNpcActionCandidates(chars[6], behaviorContext);
  const localCandidates = ctx._buildNpcActionCandidates(chars[7], behaviorContext);
  const zhangMotives = ctx._buildNpcMotiveProfile(chars[0], behaviorContext);
  const crowdedNpcs = [];
  for (let i = 0; i < 14; i++) {
    crowdedNpcs.push({ name: 'CourtHeavy' + i, alive: true, loyalty: 35, ambition: 86, intelligence: 82, officialTitle: 'Minister', location: 'Capital', faction: 'Ming' });
  }
  crowdedNpcs.push(chars[7]);
  const cohortSelected = ctx.selectImportantNpcs(crowdedNpcs).map(function(c) { return c.name; });

  assert(zhangMotives && zhangMotives.networking > 0 && zhangMotives.career > 0,
    'motive profile should expose scored career/networking motives for ambitious officials');
  assert(cohortSelected.indexOf('LocalMagistrate') >= 0,
    'important NPC selection should reserve room for local/frontier actors even when court elites crowd the top score list');
  assert(courtCandidates.every(function(c) { return c.motive && typeof c.motiveScore === 'number'; }),
    'candidate actions should include a motive label and motiveScore');
  assert(courtCandidates.some(function(c) { return c.behaviorType === 'petition'; }),
    'court NPC should receive petition candidate');
  assert(courtCandidates.some(function(c) { return c.behaviorType === 'conspire'; }),
    'ambitious court NPC should receive conspire candidate');
  assert(courtCandidates.some(function(c) { return c.behaviorType === 'conspire' && c.target === 'LiSi'; }),
    'conspire candidate should target a concrete ally instead of a generic label');
  assert(courtCandidates.some(function(c) { return c.behaviorType === 'private_correspondence' && c.target === 'LiSi'; }),
    'ambitious NPC should receive private NPC-to-NPC correspondence with a concrete ally');
  assert(courtCandidates.some(function(c) { return (c.behaviorType === 'obstruct' || c.behaviorType === 'slander') && c.target === 'QianRival'; }),
    'rivalry candidate should target a concrete political rival');
  assert(militaryCandidates.some(function(c) { return c.behaviorType === 'train_troops'; }),
    'military NPC should receive train_troops candidate');
  assert(remoteCandidates.some(function(c) { return c.behaviorType === 'send_letter'; }),
    'remote NPC should receive send_letter candidate');
  assert(remoteCandidates.some(function(c) { return c.behaviorType === 'seek_audience'; }),
    'remote NPC should receive seek_audience candidate');
  assert(militaryCandidates.some(function(c) { return c.behaviorType === 'request_funds'; }),
    'military NPC should receive request_funds candidate');
  assert(militaryCandidates.some(function(c) { return c.behaviorType === 'patrol'; }),
    'military NPC should receive patrol candidate');
  assert(militaryCandidates.some(function(c) { return c.behaviorType === 'fortify'; }),
    'military NPC should receive fortify candidate');
  assert(censorCandidates.some(function(c) { return c.behaviorType === 'recommend'; }),
    'high-integrity intelligent censor should receive recommend candidate');
  assert(censorCandidates.some(function(c) { return c.behaviorType === 'impeach'; }),
    'high-integrity intelligent censor should receive impeach candidate');
  assert(courtCandidates.some(function(c) { return c.behaviorType === 'build_network'; }),
    'ambitious court NPC should receive a multi-turn build_network candidate');
  assert(localCandidates.some(function(c) { return c.behaviorType === 'develop_local'; }),
    'local official should receive develop_local candidate');
  assert(localCandidates.some(function(c) { return c.behaviorType === 'relief'; }),
    'local official in unrest province should receive relief candidate');
  assert(courtCandidates.every(function(c) { return typeof c.score === 'number' && c.score > 0; }),
    'candidate actions should carry positive motivation scores');

  ctx.GM._npcInternalActionHistory = [{ kind: 'private_correspondence', from: 'ZhangSan', to: 'LiSi', intent: 'Recent private note', turn: ctx.GM.turn - 1 }];
  const diversifiedCandidates = ctx._buildNpcActionCandidates(chars[0], ctx.buildNpcBehaviorContext());
  const diversifiedPrivate = diversifiedCandidates.find(function(c) { return c.behaviorType === 'private_correspondence'; });
  assert(diversifiedPrivate && diversifiedPrivate.target && diversifiedPrivate.target !== 'LiSi',
    'recent private correspondence should diversify the next NPC-to-NPC correspondence target');
  ctx.GM._npcInternalActionHistory = [];

  ctx.GM._pendingNpcCorrespondence.push({ from: 'ZhangSan', to: 'LiSi', intent: 'Pending private note', turn: ctx.GM.turn });
  const pendingDiversifiedCandidates = ctx._buildNpcActionCandidates(chars[0], ctx.buildNpcBehaviorContext());
  const pendingDiversifiedPrivate = pendingDiversifiedCandidates.find(function(c) { return c.behaviorType === 'private_correspondence'; });
  assert(pendingDiversifiedPrivate && pendingDiversifiedPrivate.target && pendingDiversifiedPrivate.target !== 'LiSi',
    'pending private correspondence should diversify same-turn NPC-to-NPC correspondence target');
  ctx.GM._pendingNpcCorrespondence = [];

  ctx.GM._pendingNpcCorrespondence.push({ from: 'ZhangSan', to: 'LiSi', intent: 'Pre-seeded private note', turn: ctx.GM.turn });
  ctx.GM._pendingNpcConspiracies.push({ from: 'ZhangSan', target: 'LiSi', intent: 'Pre-seeded faction talk', turn: ctx.GM.turn });
  ctx.GM._npcHiddenMoves.push({ actor: 'QianRival', target: 'ZhangSan', intent: 'Pre-seeded obstruction', turn: ctx.GM.turn });
  const enrichedContext = ctx.buildNpcBehaviorContext();
  assert(enrichedContext.courtWorkload && enrichedContext.courtWorkload.pendingNpcCorrespondence === 1,
    'NPC behavior context should expose pending private correspondence pressure');
  assert(enrichedContext.courtWorkload.pendingConspiracies === 1 && enrichedContext.courtWorkload.hiddenMoves === 1,
    'NPC behavior context should expose hidden NPC activity counts');
  assert(enrichedContext.npcInternalActions.some(function(x) { return x.kind === 'private_correspondence' && x.from === 'ZhangSan' && x.to === 'LiSi'; }),
    'NPC behavior context should summarize recent private correspondence');
  assert(enrichedContext.npcInternalActions.some(function(x) { return x.kind === 'hidden_move' && x.from === 'QianRival' && x.to === 'ZhangSan'; }),
    'NPC behavior context should summarize recent hidden moves');

  const savedMemorials = ctx.GM.memorials;
  ctx.GM.memorials = Array.from({ length: 12 }, function(_, i) {
    return { id: 'busy-' + i, from: 'Busy' + i, status: 'pending_review', reviewed: false };
  });
  const pressureCourtCandidates = ctx._buildNpcActionCandidates(chars[0], behaviorContext);
  assert(!pressureCourtCandidates.some(function(c) { return c.behaviorType === 'petition'; }),
    'busy memorial queue should suppress low-priority new petition candidates');
  assert(pressureCourtCandidates.some(function(c) { return c.behaviorType === 'private_correspondence'; }),
    'busy court-facing queue should not suppress NPC-to-NPC private correspondence');
  const pressureMilitaryCandidates = ctx._buildNpcActionCandidates(chars[2], behaviorContext);
  assert(!pressureMilitaryCandidates.some(function(c) { return c.behaviorType === 'request_funds'; }),
    'busy memorial queue should suppress low-priority military fund requests');
  assert(pressureMilitaryCandidates.some(function(c) { return c.behaviorType === 'train_troops'; }),
    'busy memorial queue should not suppress self-contained military training');
  ctx.GM.memorials = savedMemorials;

  const savedAudiences = ctx.GM._pendingAudiences;
  ctx.GM._pendingAudiences = Array.from({ length: 7 }, function(_, i) {
    return { name: 'Audience' + i, reason: 'busy' };
  });
  const pressureAudienceCandidates = ctx._buildNpcActionCandidates(chars[3], behaviorContext);
  assert(!pressureAudienceCandidates.some(function(c) { return c.behaviorType === 'seek_audience'; }),
    'busy audience queue should suppress low-priority new audience requests');
  assert(pressureAudienceCandidates.some(function(c) { return c.behaviorType === 'send_letter'; }),
    'busy audience queue should still allow written reports');
  ctx.GM._pendingAudiences = savedAudiences;

  const savedLetters = ctx.GM._pendingNpcLetters;
  ctx.GM._pendingNpcLetters = Array.from({ length: 11 }, function(_, i) {
    return { from: 'Letter' + i };
  });
  const pressureLetterCandidates = ctx._buildNpcActionCandidates(chars[3], behaviorContext);
  assert(!pressureLetterCandidates.some(function(c) { return c.behaviorType === 'send_letter'; }),
    'busy letter queue should suppress low-priority new NPC letters');
  assert(pressureLetterCandidates.some(function(c) { return c.behaviorType === 'seek_audience'; }),
    'busy letter queue should still allow audience requests');
  ctx.GM._pendingNpcLetters = savedLetters;

  await ctx.executeNpcBehaviors();

  assert(ctx.GM.memorials.some(function(m) { return m.from === 'ZhangSan'; }),
    'candidate actionId petition should materialize as memorial');
  assert(ctx.GM.armies[0].training > 40,
    'candidate actionId train_troops should improve commanded army training');
  assert(ctx.GM._pendingNpcLetters.some(function(l) { return l.from === 'RemoteZhao'; }),
    'candidate actionId send_letter should enqueue NPC letter');
  assert(ctx.GM._turnContext.npcActionsThisTurn.indexOf('ZhangSan') >= 0,
    'executed supplemental NPC decision should be recorded in per-turn handled ledger');
  assert(events.some(function(e) { return /ZhangSan/.test(e.text); }),
    'supplemental NPC decision should leave a readable NPC event');
  assert(/actionId/.test(lastPrompt) && /npcact/.test(lastPrompt),
    'batch NPC prompt should expose actionId candidate action cards');
  assert(/CourtWorkload/.test(lastPrompt) && /NpcInternalActions/.test(lastPrompt),
    'batch NPC prompt should expose court workload and internal NPC action context');
  assert(ctx.GM._npcActionLedger.some(function(x) { return x.actor === 'ZhangSan' && x.behaviorType === 'petition'; }),
    'executed NPC action should be recorded in structured action ledger');
  assert(!ctx._buildNpcActionCandidates(chars[0], behaviorContext).some(function(c) { return c.behaviorType === 'petition'; }),
    'same NPC action type should cool down after it has just executed');
  const repeatPetitionOk = ctx._executeNormalizedNpcDecision({
    actor: 'ZhangSan',
    behaviorType: 'petition',
    target: '朝廷',
    action: 'Repeat petition',
    shouldExecute: true
  }, chars[0], behaviorContext);
  assert(repeatPetitionOk === false,
    'direct repeated NPC action should be rejected while cooldown is active');

  const directOk = ctx._executeNormalizedNpcDecision({
    actor: 'ZhangSan',
    behaviorType: 'reward',
    target: 'LiSi',
    action: 'Reward LiSi',
    shouldExecute: true
  }, chars[0], behaviorContext);
  assert(directOk === true,
    'normalized actor/action decision should still execute direct behavior');
  assert(chars[1].loyalty === 55,
    'normalized actor/action reward should adjust target loyalty');

  const deadExecOk = ctx._executeNormalizedNpcDecision({
    actor: 'DeadMinister',
    behaviorType: 'petition',
    action: 'Dead petition',
    shouldExecute: true
  }, { name: 'DeadMinister', alive: false }, behaviorContext);
  assert(deadExecOk === false,
    'supplemental NPC executor should reject dead actors through unified preflight');
  chars[1].isPlayer = true;
  const playerExecOk = ctx._executeNormalizedNpcDecision({
    actor: 'LiSi',
    behaviorType: 'petition',
    action: 'Player-controlled petition',
    shouldExecute: true
  }, chars[1], behaviorContext);
  assert(playerExecOk === false,
    'supplemental NPC executor should reject player-controlled actors through unified preflight');
  chars[1].isPlayer = false;

  const audienceOk = ctx._executeNormalizedNpcDecision({
    actor: 'RemoteZhao',
    behaviorType: 'seek_audience',
    action: 'Ask for audience',
    shouldExecute: true
  }, chars[3], behaviorContext);
  assert(audienceOk === true && ctx.GM._pendingAudiences.some(function(q) { return q.name === 'RemoteZhao'; }),
    'seek_audience behavior should enqueue pending audience');

  const memorialsBeforeFunds = ctx.GM.memorials.length;
  const fundsOk = ctx._executeNormalizedNpcDecision({
    actor: 'GeneralWang',
    behaviorType: 'request_funds',
    action: 'Request army funds',
    shouldExecute: true
  }, chars[2], behaviorContext);
  assert(fundsOk === true && ctx.GM.memorials.length === memorialsBeforeFunds + 1,
    'request_funds behavior should materialize as memorial');

  const corrOk = ctx._executeNormalizedNpcDecision({
    actor: 'ZhangSan',
    behaviorType: 'private_correspondence',
    target: 'LiSi',
    action: 'Coordinate privately with LiSi',
    shouldExecute: true
  }, chars[0], behaviorContext);
  assert(corrOk === true && ctx.GM._pendingNpcCorrespondence.some(function(x) { return x.from === 'ZhangSan' && x.to === 'LiSi'; }),
    'private_correspondence behavior should enqueue NPC-to-NPC correspondence');
  assert(ctx.GM._npcInternalActionHistory.some(function(x) { return x.kind === 'private_correspondence' && x.from === 'ZhangSan' && x.to === 'LiSi'; }),
    'private_correspondence behavior should persist internal action history for future inference');

  const conspireOk = ctx._executeNormalizedNpcDecision({
    actor: 'ZhangSan',
    behaviorType: 'conspire',
    target: 'LiSi',
    action: 'Coordinate factionally with LiSi',
    shouldExecute: true
  }, chars[0], behaviorContext);
  assert(conspireOk === true && ctx.GM._npcInternalActionHistory.some(function(x) { return x.kind === 'conspiracy' && x.from === 'ZhangSan' && x.to === 'LiSi'; }),
    'conspire behavior should persist internal action history');

  const obstructOk = ctx._executeNormalizedNpcDecision({
    actor: 'ZhangSan',
    behaviorType: 'obstruct',
    target: 'QianRival',
    action: 'Quietly obstruct QianRival',
    shouldExecute: true
  }, chars[0], behaviorContext);
  assert(obstructOk === true && ctx.GM._npcInternalActionHistory.some(function(x) { return x.kind === 'hidden_move' && x.from === 'ZhangSan' && x.to === 'QianRival'; }),
    'hidden obstruct behavior should persist internal action history');

  const recommendOk = ctx._executeNormalizedNpcDecision({
    actor: 'CleanCensor',
    behaviorType: 'recommend',
    target: 'ChenAlly',
    action: 'Recommend ChenAlly',
    shouldExecute: true
  }, chars[6], behaviorContext);
  assert(recommendOk === true && ctx.GM.memorials.some(function(m) { return m.from === 'CleanCensor' && /ChenAlly/.test(String(m.content || m.title || '')); }),
    'recommend behavior should materialize as a personnel memorial');

  const beforeProsperity = ctx.GM.provinceStats.Liaodong.prosperity;
  const developOk = ctx._executeNormalizedNpcDecision({
    actor: 'LocalMagistrate',
    behaviorType: 'develop_local',
    target: 'Liaodong',
    action: 'Develop Liaodong',
    shouldExecute: true
  }, chars[7], behaviorContext);
  assert(developOk === true && ctx.GM.provinceStats.Liaodong.prosperity > beforeProsperity,
    'develop_local behavior should change live province prosperity data');

  const beforeUnrest = ctx.GM.provinceStats.Liaodong.unrest;
  const reliefOk = ctx._executeNormalizedNpcDecision({
    actor: 'LocalMagistrate',
    behaviorType: 'relief',
    target: 'Liaodong',
    action: 'Relief Liaodong',
    shouldExecute: true
  }, chars[7], behaviorContext);
  assert(reliefOk === true && ctx.GM.provinceStats.Liaodong.unrest < beforeUnrest,
    'relief behavior should change live province unrest data');

  const planOk = ctx._executeNormalizedNpcDecision({
    actor: 'ZhangSan',
    behaviorType: 'build_network',
    target: 'ChenAlly',
    action: 'Build a court network',
    shouldExecute: true
  }, chars[0], behaviorContext);
  assert(planOk === true && ctx.GM._npcPlans.some(function(p) { return p.actor === 'ZhangSan' && p.type === 'build_network'; }),
    'build_network behavior should create a durable multi-turn NPC plan');
  assert(ctx.TM.NPC.ActionLedger.diagnose().plans >= 1,
    'NPC action diagnostics should report durable NPC plans');
  assert(ctx.GM._npcDecisionDiagnostics.some(function(d) { return d.actor === 'ZhangSan' && d.status === 'executed'; }),
    'NPC executor should record decision diagnostics for executed actions');

  ctx.GM._pendingNpcCorrespondence = [];
  ctx.GM._pendingNpcConspiracies = [];
  ctx.GM._npcHiddenMoves = [];
  const postSettleContext = ctx.buildNpcBehaviorContext();
  assert(postSettleContext.npcInternalActions.some(function(x) { return x.kind === 'private_correspondence' && x.from === 'ZhangSan' && x.to === 'LiSi'; }),
    'settled private correspondence should still influence later NPC inference context');
  assert(postSettleContext.npcInternalActions.some(function(x) { return x.kind === 'hidden_move' && x.from === 'ZhangSan' && x.to === 'QianRival'; }),
    'settled hidden moves should still influence later NPC inference context');

  const saveLifecycleSrc = fs.readFileSync(path.join(ROOT, 'tm-save-lifecycle.js'), 'utf8');
  assert(saveLifecycleSrc.indexOf('GM._npcInternalActionHistory') >= 0 && saveLifecycleSrc.indexOf('GM._savedNpcInternalActionHistory') >= 0,
    'save lifecycle should persist NPC internal action history');
  assert(saveLifecycleSrc.indexOf('GM._npcActionLedger') >= 0 && saveLifecycleSrc.indexOf('GM._savedNpcActionLedger') >= 0,
    'save lifecycle should persist NPC action ledger cooldowns across save/load');
  assert(saveLifecycleSrc.indexOf('GM._npcPlans') >= 0 && saveLifecycleSrc.indexOf('GM._savedNpcPlans') >= 0,
    'save lifecycle should persist durable NPC plans across save/load');
  assert(saveLifecycleSrc.indexOf('GM._npcDecisionDiagnostics') >= 0 && saveLifecycleSrc.indexOf('GM._savedNpcDecisionDiagnostics') >= 0,
    'save lifecycle should persist recent NPC decision diagnostics across save/load');

  console.log('[smoke-npc-action-logic] PASS ' + passed + ' assertions');
}

main().catch(function(err) {
  console.error('[smoke-npc-action-logic] FAIL');
  console.error(err && err.stack || err);
  process.exit(1);
});
