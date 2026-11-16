#!/usr/bin/env node
// smoke-huji-governance-court-feedback.js - court/tinyi outcomes feed back into huji commitments.

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

function assert(cond, msg) {
  if (!cond) throw new Error('[assert] ' + msg);
}

function load(name, sandbox) {
  const file = path.join(ROOT, name);
  assert(fs.existsSync(file), name + ' should exist');
  vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: name });
}

const sandbox = {
  console,
  Math, Date, JSON, RegExp, Error,
  Array, Object, String, Number, Boolean,
  parseInt, parseFloat, isNaN, isFinite,
  setTimeout: fn => { if (typeof fn === 'function') fn(); return 1; },
  clearTimeout() {},
  addEB() {},
  toast() {}
};
sandbox.window = sandbox;
sandbox.global = sandbox;
sandbox.globalThis = sandbox;
sandbox.TM = { errors: { capture() {}, captureSilent() {} } };
sandbox.IntegrationBridge = {
  getLeafDivisions(adminHierarchy) {
    const out = [];
    function walk(nodes) {
      (Array.isArray(nodes) ? nodes : []).forEach(node => {
        if (!node || typeof node !== 'object') return;
        const kids = node.children || node.divisions || node.subs || [];
        if (kids.length) walk(kids);
        else out.push(node);
      });
    }
    Object.keys(adminHierarchy || {}).forEach(k => walk((adminHierarchy[k] || {}).divisions || []));
    return out;
  }
};

const scenario = {
  id: 'smoke-huji-governance-court',
  name: 'Huji Governance Court Feedback Smoke',
  populationConfig: {
    initial: { nationalHouseholds: 9000, nationalMouths: 45000, nationalDing: 13500, hiddenPopulation: 100 },
    categoryEnabled: ['bianhu', 'junhu'],
    corveeRules: { annualCorveeDays: 30, commutationRate: 0.2 },
    militaryRules: { maxExpansionRate: 0.08 }
  }
};

sandbox.findScenarioById = () => scenario;
sandbox.P = scenario;
sandbox.GM = {
  sid: 'smoke-huji-governance-court',
  turn: 120,
  guoku: { money: 480000, balance: 480000, monthlyIncome: 38000, turnIncome: 38000 },
  fiscal: { expectedRevenue: 38000 },
  hukou: {},
  minxin: { trueIndex: 48, byRegion: {} },
  corruption: { trueIndex: 32 },
  huangquan: { executionRate: 0.74 },
  military: { pendingRecruitment: 2400, draftQuota: 2400 },
  armies: [{ id: 'army-1', soldiers: 4200, type: 'junhu', morale: 52, supply: 55 }],
  adminHierarchy: {
    player: {
      divisions: [
        { id: 'north', name: 'North', minxinLocal: 48, corruptionLocal: 30, populationDetail: { households: 5200, mouths: 26000, ding: 7800, hiddenCount: 560, fugitives: 160 } },
        { id: 'south', name: 'South', minxinLocal: 50, corruptionLocal: 24, populationDetail: { households: 3000, mouths: 15000, ding: 4400, hiddenCount: 220, fugitives: 80 } }
      ]
    }
  },
  _courtRecords: [],
  tinyiSeals: [],
  _pendingTinyiTopics: []
};

vm.createContext(sandbox);
load('tm-social-political-signals.js', sandbox);
load('tm-player-action-signals.js', sandbox);
load('tm-minxin-ledger.js', sandbox);
load('tm-huji-engine.js', sandbox);
load('tm-huji-deep-fill.js', sandbox);
load('tm-huji-runtime-bridge.js', sandbox);
load('tm-huji-governance-loop.js', sandbox);

const Bridge = sandbox.TM.HujiRuntimeBridge;
const Loop = sandbox.TM.HujiGovernanceLoop;
assert(Loop && typeof Loop.applyCourtFeedbacks === 'function', 'TM.HujiGovernanceLoop.applyCourtFeedbacks should exist');

sandbox.HujiEngine.init(scenario);
Bridge.maintain(sandbox.GM, { scenario, turn: 120, source: 'smoke-baseline', applyHardEffects: false });

sandbox.TM.PlayerActionSignals.record(sandbox.GM, {
  source: 'formal-desk',
  kind: 'edict',
  action: 'edict',
  linkedIssue: 'huji-approve',
  text: 'edict: hukou census and refugee resettlement',
  intensity: 0.8
});
sandbox.TM.PlayerActionSignals.record(sandbox.GM, {
  source: 'formal-desk',
  kind: 'court',
  action: 'court debate',
  linkedIssue: 'huji-block',
  text: 'court debate: commute corvee labor into silver',
  intensity: 0.8
});
sandbox.TM.PlayerActionSignals.record(sandbox.GM, {
  source: 'formal-desk',
  kind: 'memorial',
  action: 'memorial reply',
  linkedIssue: 'huji-defer',
  text: 'memorial reply: audit military households and recruit frontier soldiers',
  intensity: 0.8
});

Loop.ingestPlayerSignals(sandbox.GM, { turn: 120, source: 'smoke-ingest' });
const approve = sandbox.GM._hujiCommitments.find(c => c.linkedIssue === 'huji-approve');
const block = sandbox.GM._hujiCommitments.find(c => c.linkedIssue === 'huji-block');
const defer = sandbox.GM._hujiCommitments.find(c => c.linkedIssue === 'huji-defer');
assert(approve && block && defer, 'should create three commitments with linked court issues');

const approveResistance = approve.resistance;
const approveProgress = approve.progress;
const deferExpectedTurns = defer.expectedTurns;

sandbox.GM._courtRecords.push({
  id: 'court-huji-approve',
  issueId: 'huji-approve',
  linkedIssue: 'huji-approve',
  decision: 'approved',
  status: 'resolved',
  result: 'court approved hukou census funding'
});
sandbox.GM.tinyiSeals.push({
  id: 'seal-huji-block',
  linkedIssue: 'huji-block',
  verdict: 'rejected',
  status: 'sealed',
  reason: 'court rejected immediate corvee commutation'
});
sandbox.GM._pendingTinyiTopics.push({
  id: 'topic-huji-defer',
  linkedIssue: 'huji-defer',
  decision: 'deferred',
  status: 'deferred',
  reason: 'court deferred military household audit'
});

const applied = Loop.applyCourtFeedbacks(sandbox.GM, { turn: 120, source: 'smoke-court-feedback' });
assert(applied && applied.applied >= 3, 'court feedback should apply to all matching commitments');
assert(approve.courtDecision === 'approved', 'approved court record should mark commitment approved');
assert(approve.progress > approveProgress, 'approved court record should boost progress');
assert(approve.resistance < approveResistance, 'approved court record should reduce resistance');
assert(approve.courtExecutionBoost > 0, 'approved court record should boost execution');
assert(block.status === 'blocked', 'rejected court record should block commitment');
assert(block.courtDecision === 'rejected', 'rejected court record should mark decision');
assert(defer.status === 'active', 'deferred court record should keep commitment active');
assert(defer.expectedTurns > deferExpectedTurns, 'deferred court record should extend expected turns');
assert(defer.courtDecision === 'deferred', 'deferred court record should mark decision');
assert(sandbox.GM._hujiGovernanceLoop.events.some(e => e.type === 'court-feedback-applied'), 'court feedback should be evented');

const progressAfterCourt = approve.progress;
Loop.tick(sandbox.GM, { turn: 121, monthRatio: 1, source: 'smoke-after-court-tick' });
assert(approve.progress > progressAfterCourt, 'approved commitment should continue ticking after court feedback');
assert(block.status === 'blocked', 'blocked commitment should not resume automatically');

const prompt = Loop.formatForPrompt(sandbox.GM, { limit: 8 });
assert(/court=approved/.test(prompt), 'prompt should include approved court decision');
assert(/court=rejected/.test(prompt), 'prompt should include rejected court decision');
assert(/court=deferred/.test(prompt), 'prompt should include deferred court decision');

console.log('[smoke-huji-governance-court-feedback] PASS huji governance court feedback');
