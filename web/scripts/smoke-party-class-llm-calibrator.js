#!/usr/bin/env node
// smoke-party-class-llm-calibrator.js - player-action LLM calibration for party/class state.

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

function assert(cond, msg) {
  if (!cond) throw new Error('[assert] ' + msg);
}

const calls = [];
const sandbox = {
  console,
  Math, Date, JSON, RegExp, Error, Promise,
  Array, Object, String, Number, Boolean,
  parseInt, parseFloat, isNaN, isFinite,
  setTimeout: (fn) => { fn(); return 1; },
  clearTimeout: () => {},
  window: {},
  scriptData: {}
};
sandbox.window = sandbox;
sandbox.global = sandbox;
sandbox.globalThis = sandbox;
sandbox.P = {
  conf: { partyClassLlmEnabled: true },
  ai: {
    key: 'primary-key',
    url: 'https://primary.example/v1',
    model: 'primary-model',
    secondary: {
      key: 'secondary-key',
      url: 'https://secondary.example/v1',
      model: 'secondary-model'
    }
  }
};
sandbox.GM = {
  turn: 7,
  sid: 'smoke-dynamic-polity',
  eraName: 'Smoke Era',
  parties: [
    { name: 'Reform Bloc', influence: 66, cohesion: 55 },
    { name: 'Tax Office', influence: 60, cohesion: 65, rivalParty: 'Reform Bloc' }
  ],
  facs: [
    { name: 'Ming Court', strength: 62, economy: 58, playerRelation: 10, attitude: 'watchful' }
  ],
  classes: [
    {
      name: 'Merchants',
      satisfaction: 35,
      influence: 70,
      demands: 'lower convoy levy',
      unrestLevels: { grievance: 30, petition: 40, strike: 70, revolt: 82 }
    }
  ],
  currentIssues: [
    { id: 'issue-market-levy', title: 'Market levy dispute', category: 'finance', status: 'pending', severity: 70 }
  ],
  partyState: {}
};
sandbox.callAIMessages = async function(messages, maxTok, signal, tier, opts) {
  calls.push({ kind: 'messages', tier, maxTok, opts, messages });
  return JSON.stringify({
    relation_adjustments: [
      {
        party: 'Reform Bloc',
        className: 'Merchants',
        affinityDelta: 24,
        trustDelta: 8,
        grievanceDelta: -10,
        reason: 'court agenda now matches merchant pressure'
      }
    ],
    class_updates: [
      {
        className: 'Merchants',
        satisfactionDelta: 5,
        demands: ['stable market levies'],
        unrestDelta: { grievance: 4 }
      }
    ],
    party_updates: [
      {
        party: 'Reform Bloc',
        currentAgenda: 'stabilize merchant taxes',
        shortGoal: 'broker guild relief',
        cohesionDelta: 3
      }
    ],
    faction_updates: [
      {
        faction: 'Ming Court',
        playerRelationDelta: 4,
        shortGoal: 'contain market unrest through measured levy relief',
        reason: 'player action signals fiscal compromise'
      }
    ],
    court_issue_updates: [
      {
        issueId: 'issue-market-levy',
        status: 'linked',
        sourceParty: 'Reform Bloc',
        sourceClass: 'Merchants',
        linkedParties: ['Reform Bloc'],
        linkedClasses: ['Merchants'],
        priorityDelta: 5,
        reason: 'levy dispute now maps to party short goal'
      }
    ],
    issue_goal_links: [
      {
        issueId: 'issue-market-levy',
        party: 'Reform Bloc',
        className: 'Merchants',
        goalText: 'carry market levy relief through court debate',
        affinityDelta: 6,
        emergent: true,
        reason: 'court issue and class pressure now align'
      }
    ],
    notes: ['merchant bloc is warming to reforms']
  });
};
vm.createContext(sandbox);

function load(file) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox, { filename: file });
}

(async function main() {
  load('tm-engine-constants.js');
  load('tm-class-engine.js');
  load('tm-party-goals.js');
  load('tm-party-class-llm-calibrator.js');

  const PG = sandbox.TM && sandbox.TM.PartyGoals;
  const Cal = sandbox.TM && sandbox.TM.PartyClassLlmCalibrator;
  assert(Cal && typeof Cal.run === 'function', 'PartyClassLlmCalibrator.run should exist');
  assert(typeof Cal.buildSnapshot === 'function', 'PartyClassLlmCalibrator.buildSnapshot should exist');
  assert(typeof Cal.notifyPlayerAction === 'function', 'PartyClassLlmCalibrator.notifyPlayerAction should exist for in-turn player operations');
  assert(typeof Cal.flushBeforeSubmit === 'function', 'PartyClassLlmCalibrator.flushBeforeSubmit should exist for pre-submit synchronization');
  assert(PG && typeof PG.applyDynamicRelationAdjustment === 'function', 'PartyGoals should expose dynamic relation adjustment API');

  const first = await Cal.run({ source: 'smoke-player-action', phase: 'player-action', force: true });
  assert(first && first.ok, 'calibrator run should succeed');
  assert(calls[0] && calls[0].tier === 'secondary', 'configured secondary API should be preferred');
  assert(first.applied && first.applied.relations >= 1, 'LLM relation adjustment should be applied');
  assert(first.applied.classes === 1, 'LLM class update should be applied');
  assert(first.applied.parties === 1, 'LLM party update should be applied');
  assert(first.applied.factions === 1, 'LLM faction update should be applied');
  assert(first.applied.courtIssues === 1, 'LLM court issue update should be applied');
  assert(first.applied.issueGoalLinks === 1, 'LLM court issue goal link should be applied');

  const edge = Object.values(sandbox.GM.partyClassRelations.edges).find(e => e && e.partyName === 'Reform Bloc' && e.className === 'Merchants');
  assert(edge && edge.affinity >= 50, 'calibrated relation should be strong enough to affect future demand derivation');
  assert(edge.trust > 40 && edge.grievance < 40, 'calibrated relation should track trust/grievance correction');
  assert(sandbox.GM.classes[0].satisfaction === 40, 'class satisfaction should be corrected');
  assert(Array.isArray(sandbox.GM.classes[0].demands) && sandbox.GM.classes[0].demands[0] === 'stable market levies', 'class demands should be corrected');
  assert(sandbox.GM.parties[0].currentAgenda === 'stabilize merchant taxes', 'party agenda should be corrected');
  assert(sandbox.GM.parties[0].shortGoal === 'broker guild relief', 'party short goal should be corrected');
  assert(sandbox.GM.facs[0].shortGoal === 'contain market unrest through measured levy relief', 'faction short goal should be corrected');
  assert(sandbox.GM.currentIssues[0].sourceParty === 'Reform Bloc', 'court issue should be linked to source party');
  assert(Array.isArray(sandbox.GM.currentIssues[0].linkedClasses) && sandbox.GM.currentIssues[0].linkedClasses.includes('Merchants'), 'court issue should be linked to source class');
  assert(Array.isArray(sandbox.GM._partyClassCourtIssueLinks) && sandbox.GM._partyClassCourtIssueLinks.some(x => x.goalText === 'carry market levy relief through court debate'), 'court issue goal link ledger should be written');
  assert(Array.isArray(sandbox.GM._pendingTinyiTopics) && sandbox.GM._pendingTinyiTopics.some(x => x && x.sourceType === 'party_class_calibration' && x.party === 'Reform Bloc' && x.sourceClass === 'Merchants'), 'calibrated court issue links should enter the real pending tinyi queue');
  assert(PG.getActiveGoals(sandbox.GM, 'Reform Bloc', { turn: 7 }).some(g => g && g.kind === 'courtIssue' && /market levy relief/.test(g.text)), 'court issue should create a short party goal');
  assert(sandbox.GM._partyClassLlmUiDirty === true, 'calibration should mark class/party UI dirty');
  assert(PG.getActiveGoals(sandbox.GM, 'Reform Bloc', { turn: 7 }).some(g => g && g.kind === 'classDemand' && g.sourceClass === 'Merchants'), 'derived class-demand goal should be available for later turn inference');

  const notifyCallCount = calls.length;
  await Cal.notifyPlayerAction({ source: 'smoke-notify-player-action', immediate: true, force: true, cooldownMs: 0 });
  assert(calls.length > notifyCallCount, 'notifyPlayerAction should launch a player-action calibration call');
  const afterNotifyCalls = calls.length;
  const flushedFresh = await Cal.flushBeforeSubmit({ source: 'smoke-flush-fresh' });
  assert(flushedFresh && flushedFresh.skipped && flushedFresh.reason === 'already fresh', 'flushBeforeSubmit should reuse a fresh player-action calibration');
  assert(calls.length === afterNotifyCalls, 'fresh pre-submit flush should not start a duplicate LLM call');

  const rootForFlush = {
    turn: 9,
    parties: [{ name: 'Market Party', influence: 50 }],
    classes: [{ name: 'Shopkeepers', satisfaction: 32, influence: 55, demands: 'reduce stall fees' }],
    _edictSuggestions: [{ source: '地方', from: 'East Market', content: 'reduce stall fees for flood recovery', turn: 9, used: false }],
    memorials: [{ from: 'Market Censor', title: 'Stall fee complaint', reviewed: false, text: 'shopkeepers cannot bear new fees' }],
    letters: [{ to: 'Guild Elder', subjectLine: 'Fees', status: 'draft', content: 'prepare relief bargain', turn: 9 }],
    wenduiTarget: 'Guild Elder'
  };
  const opSnapshot = Cal.buildSnapshot(rootForFlush, { source: 'smoke-ops-snapshot', phase: 'pre-submit' });
  assert(opSnapshot.playerOperations && opSnapshot.playerOperations.edictSuggestions.length === 1, 'snapshot should include pending edict suggestions from player operations');
  assert(opSnapshot.playerOperations.pendingMemorials.length === 1, 'snapshot should include pending memorials from player operations');
  assert(opSnapshot.playerOperations.recentLetters.length === 1, 'snapshot should include recent letters from player operations');
  assert(opSnapshot.playerOperations.wenduiTarget === 'Guild Elder', 'snapshot should include pending wendui target');
  const beforeFlushCalls = calls.length;
  const flushed = await Cal.flushBeforeSubmit({ root: rootForFlush, source: 'pre-submit-player-action', force: true });
  assert(flushed && flushed.ok, 'flushBeforeSubmit should run a missing pre-submit calibration before submission');
  assert(calls.length === beforeFlushCalls + 1, 'missing pre-submit flush should make exactly one LLM call');
  assert(calls[calls.length - 1].messages.some(m => /playerActionSignals/.test(String(m.content || ''))), 'pre-submit snapshot should include player action signals field');

  const originalSetTimeout = sandbox.setTimeout;
  const originalClearTimeout = sandbox.clearTimeout;
  let delayedLaunch = null;
  let clearedTimer = false;
  sandbox.setTimeout = (fn) => { delayedLaunch = fn; return 99; };
  sandbox.clearTimeout = () => { clearedTimer = true; };
  const delayedRoot = {
    turn: 10,
    parties: [{ name: 'Canal Party' }],
    classes: [{ name: 'Boatmen', satisfaction: 34, influence: 50, demands: 'repair locks' }]
  };
  const delayedBefore = calls.length;
  const delayedNotice = Cal.notifyPlayerAction({ root: delayedRoot, source: 'smoke-delayed-action', delayMs: 1000, force: true });
  assert(delayedNotice && delayedNotice.scheduled === true && delayedLaunch, 'delayed notify should schedule without immediate LLM call');
  assert(calls.length === delayedBefore, 'delayed notify should not call LLM before flush');
  const delayedFlush = await Cal.flushBeforeSubmit({ root: delayedRoot, source: 'pre-submit-player-action' });
  assert(clearedTimer === true, 'flushBeforeSubmit should clear a pending debounce timer');
  assert(delayedFlush && delayedFlush.skipped && delayedFlush.reason === 'already fresh', 'flushBeforeSubmit should consume pending player-action calibration');
  assert(calls.length === delayedBefore + 1, 'flushing pending player action should make exactly one LLM call');
  sandbox.setTimeout = originalSetTimeout;
  sandbox.clearTimeout = originalClearTimeout;

  load('tm-faction-npc-dispatcher.js');
  const inTurnSchedule = sandbox.TM.FactionNpcDispatchQueue.scheduleInTurnRuns({ maxRuns: 0 });
  assert(inTurnSchedule.partyClassScheduled === 1, 'in-turn player-action dispatcher should schedule party/class calibration');
  assert(inTurnSchedule.scheduled >= 1, 'in-turn dispatcher should count party/class calibration');

  sandbox.P.ai.secondary = null;
  await Cal.run({ source: 'smoke-player-action-primary', phase: 'player-action-primary', force: true });
  assert(calls[calls.length - 1].tier === 'primary', 'missing secondary API should fall back to primary');

  const dispatcherSource = fs.readFileSync(path.join(ROOT, 'tm-faction-npc-dispatcher.js'), 'utf8');
  assert(!/post-endturn-render-finalize/.test(dispatcherSource), 'party/class calibration should not be scheduled after endturn render-finalize');

  const endturnSource = fs.readFileSync(path.join(ROOT, 'tm-endturn-core.js'), 'utf8');
  assert(!/pre-endturn-player-submit/.test(endturnSource), 'calibration should no longer run after the player has submitted into endturn internals');
  assert(!/EndTurnHooks\.register\([^)]*PartyClassLlmCalibrator/.test(endturnSource), 'calibrator should not be registered as a generic end-turn hook');

  console.log('[smoke-party-class-llm-calibrator] PASS player-action LLM calibration');
})().catch((e) => {
  console.error('[smoke-party-class-llm-calibrator] FAIL:', (e && e.stack) || e);
  process.exit(1);
});
