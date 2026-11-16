#!/usr/bin/env node
// smoke-huji-governance-executor-causes-backlash.js - huji commitments bind executors, causes, and backlash.

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
  id: 'smoke-huji-executor',
  name: 'Huji Executor Smoke',
  populationConfig: {
    initial: { nationalHouseholds: 8000, nationalMouths: 40000, nationalDing: 12000, hiddenPopulation: 200 },
    categoryEnabled: ['bianhu', 'junhu', 'jianghu'],
    corveeRules: { annualCorveeDays: 32, commutationRate: 0.2 },
    militaryRules: { maxExpansionRate: 0.08 }
  }
};

sandbox.findScenarioById = () => scenario;
sandbox.P = scenario;
sandbox.GM = {
  sid: 'smoke-huji-executor',
  turn: 141,
  guoku: { balance: 300000, money: 300000, monthlyIncome: 30000, turnIncome: 30000 },
  fiscal: { expectedRevenue: 30000 },
  hukou: {},
  minxin: { trueIndex: 48, byRegion: {} },
  corruption: { trueIndex: 35 },
  huangquan: { executionRate: 0.76 },
  military: { pendingRecruitment: 2200, draftQuota: 2200 },
  armies: [{ id: 'army-1', soldiers: 3800, type: 'junhu', morale: 50, supply: 52 }],
  characters: [
    { name: 'Zhao Revenue', loyalty: 72, administration: 82, corruption: 18 },
    { name: 'Qian Works', loyalty: 58, administration: 68, corruption: 30 },
    { name: 'Sun War', loyalty: 64, military: 78, corruption: 22 }
  ],
  government: {
    nodes: [
      { name: 'Ministry of Revenue 户部', positions: [{ name: 'Revenue Minister 户部尚书', holder: 'Zhao Revenue', authority: 'decision' }] },
      { name: 'Ministry of Works 工部', positions: [{ name: 'Works Vice Minister 工部侍郎', holder: 'Qian Works', authority: 'execution' }] },
      { name: 'Ministry of War 兵部', positions: [{ name: 'War Minister 兵部尚书', holder: 'Sun War', authority: 'decision' }] }
    ]
  },
  adminHierarchy: {
    player: {
      divisions: [
        { id: 'east', name: 'East Circuit', minxinLocal: 47, corruptionLocal: 34, populationDetail: { households: 4700, mouths: 23500, ding: 7000, hiddenCount: 480, fugitives: 140 } },
        { id: 'west', name: 'West Circuit', minxinLocal: 51, corruptionLocal: 28, populationDetail: { households: 2900, mouths: 14500, ding: 4300, hiddenCount: 210, fugitives: 70 } }
      ]
    }
  },
  _courtRecords: [],
  _pendingTinyiTopics: [],
  _pendingMemorials: []
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
assert(Loop && typeof Loop.assignExecutor === 'function', 'HujiGovernanceLoop.assignExecutor should exist');
assert(typeof Loop.getCauseLedger === 'function', 'HujiGovernanceLoop.getCauseLedger should exist');

sandbox.HujiEngine.init(scenario);
Bridge.maintain(sandbox.GM, { scenario, turn: 141, source: 'smoke-baseline', applyHardEffects: false });

sandbox.TM.PlayerActionSignals.record(sandbox.GM, {
  source: 'formal-desk',
  kind: 'edict',
  action: 'edict',
  linkedIssue: 'huji-executor-all',
  text: 'edict: hukou census, commute corvee labor into silver, audit military households and recruit frontier soldiers',
  intensity: 0.82
});
Loop.ingestPlayerSignals(sandbox.GM, { turn: 141, source: 'smoke-ingest' });

const hukou = sandbox.GM._hujiCommitments.find(c => c.type === 'hukou_census');
const corvee = sandbox.GM._hujiCommitments.find(c => c.type === 'corvee_commutation');
const military = sandbox.GM._hujiCommitments.find(c => c.type === 'military_register');
assert(hukou && corvee && military, 'should create three huji commitments');
assert(/户部|Revenue/.test(hukou.executorOffice || ''), 'hukou commitment should bind revenue executor office');
assert(hukou.executorHolder === 'Zhao Revenue', 'hukou executor should bind holder from government tree');
assert(/工部|Works/.test(corvee.executorOffice || ''), 'corvee commitment should bind works executor office');
assert(corvee.executorHolder === 'Qian Works', 'corvee executor should bind holder from government tree');
assert(/兵部|War/.test(military.executorOffice || ''), 'military commitment should bind war executor office');
assert(military.executorHolder === 'Sun War', 'military executor should bind holder from government tree');
assert(hukou.executorReliability > 0.5 && military.executorReliability > 0.5, 'executors should calculate reliability from officials');

Loop.tick(sandbox.GM, { turn: 142, monthRatio: 1, source: 'smoke-executor-tick' });
const causeLedger = Loop.getCauseLedger(sandbox.GM, { limit: 20 });
assert(causeLedger.items.some(x => x.type === 'commitment-created' && x.executorHolder === 'Zhao Revenue'), 'cause ledger should record creation executor');
assert(causeLedger.items.some(x => x.type === 'commitment-effect' && x.commitmentType === 'corvee_commutation'), 'cause ledger should record applied effects');
assert(causeLedger.items.some(x => x.executorOffice && /兵部|War/.test(x.executorOffice)), 'cause ledger should preserve military executor office');

const prompt = Loop.formatForPrompt(sandbox.GM, { limit: 8 });
assert(/executors:/.test(prompt), 'prompt should include executor summary');
assert(/Zhao Revenue/.test(prompt) && /Qian Works/.test(prompt) && /Sun War/.test(prompt), 'prompt should include executor holders');
assert(/hujiGovernanceCauses/.test(prompt), 'prompt should include near-cause ledger');

sandbox.GM._courtRecords.push({
  id: 'reject-corvee',
  linkedIssue: corvee.linkedIssue,
  commitmentId: corvee.id,
  decision: 'rejected',
  status: 'resolved',
  reason: 'court rejected corvee commutation funding'
});
Loop.applyCourtFeedbacks(sandbox.GM, { turn: 142, source: 'smoke-reject' });
assert(corvee.status === 'blocked', 'court rejection should block corvee commitment');
assert(sandbox.GM._pendingMemorials.some(m => m && m.sourceType === 'huji_governance_backlash' && m.commitmentId === corvee.id), 'blocked commitment should spawn a memorial pressure item');
assert(sandbox.GM._pendingTinyiTopics.some(t => t && t.sourceType === 'huji_governance_commitment' && t.commitmentId === corvee.id), 'blocked commitment should spawn or preserve a tinyi pressure item');
assert(Loop.getCauseLedger(sandbox.GM, { limit: 20 }).items.some(x => x.type === 'backlash' && x.commitmentId === corvee.id), 'backlash should be recorded as near cause');
assert(sandbox.GM._socialPoliticalSignals.items.some(s => s.sourceSystem === 'huji-governance-backlash'), 'backlash should write social/political signal');

console.log('[smoke-huji-governance-executor-causes-backlash] PASS executor causes backlash');
