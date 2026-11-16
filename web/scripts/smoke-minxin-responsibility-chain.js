#!/usr/bin/env node
// smoke-minxin-responsibility-chain.js - commitments get executors, reports, rumors, and accountability.

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
sandbox.GM = {
  turn: 61,
  guoku: { money: 160000, grain: 120000 },
  fiscal: { treasury: 160000 },
  corruption: { trueIndex: 32, perceivedIndex: 42, subDepts: { provincial: { true: 28 }, judicial: { true: 24 } } },
  war_state: { activeWars: [] },
  classes: [
    { id: 'farmers', name: 'Farmers', satisfaction: 29, influence: 78, size: '74%', regionalVariants: [{ region: 'Canal Ward', satisfaction: 23 }] }
  ],
  parties: [
    { id: 'relief', name: 'Relief Party', socialBase: ['Farmers'], influence: 45, cohesion: 60 }
  ],
  chars: [
    { id: 'li', name: 'Li Censor', title: 'Censor', office: 'Censorate', party: 'Relief Party', influence: 72, integrity: 85 },
    { id: 'zhang', name: 'Zhang Prefect', title: 'Prefect of Canal Ward', office: 'Local Prefect', location: 'Canal Ward', influence: 52, integrity: 50 },
    { id: 'wang', name: 'Wang Revenue Minister', title: 'Revenue Minister', office: 'Ministry of Revenue', influence: 61, integrity: 62 }
  ],
  minxin: { trueIndex: 45, perceivedIndex: 59, byRegion: {}, byClass: {}, sources: {}, uprisingCandidates: [] },
  adminHierarchy: {
    player: {
      divisions: [
        { id: 'canal', name: 'Canal Ward', minxin: 22, minxinLocal: 22, population: 10000, minxinDetails: { trueIndex: 22 } },
        { id: 'river', name: 'River County', minxin: 62, minxinLocal: 62, population: 7000, minxinDetails: { trueIndex: 62 } }
      ]
    }
  },
  _pendingTinyiTopics: []
};

vm.createContext(sandbox);
load('tm-social-political-signals.js', sandbox);
load('tm-minxin-ledger.js', sandbox);
load('tm-minxin-pressure-actions.js', sandbox);
load('tm-minxin-commitment-tracker.js', sandbox);
load('tm-minxin-responsibility-chain.js', sandbox);

const ML = sandbox.TM.MinxinLedger;
const PA = sandbox.TM.MinxinPressureActions;
const CT = sandbox.TM.MinxinCommitmentTracker;
const RC = sandbox.TM.MinxinResponsibilityChain;
assert(RC && typeof RC.tick === 'function', 'TM.MinxinResponsibilityChain.tick should exist');
assert(typeof RC.assign === 'function', 'responsibility chain should expose assign');
assert(typeof RC.recordPlayerIntervention === 'function', 'responsibility chain should accept player interventions');
assert(typeof RC.formatForPrompt === 'function', 'responsibility chain should format prompt package');

ML.maintain(sandbox.GM, { turn: 61, source: 'responsibility-smoke-prep' });
PA.maintain(sandbox.GM, { turn: 61, source: 'responsibility-smoke-pressure' });
const pressure = sandbox.GM._minxinPressureActions.items.find(x => x.regionName === 'Canal Ward' && x.className === 'Farmers');
PA.recordPlayerResponse(sandbox.GM, {
  channel: 'memorial',
  decision: 'approved',
  linkedIssue: pressure.id,
  actor: 'Emperor',
  text: 'Approve grain relief, tax remission, and dispatch an audit to Canal Ward'
}, { turn: 61, source: 'responsibility-smoke-response' });
const commitment = sandbox.GM._minxinCommitments.items[0];
assert(commitment && commitment.id, 'commitment should exist before responsibility chain');

const moneyBefore = sandbox.GM.guoku.money;
const grainBefore = sandbox.GM.guoku.grain;
const tick1 = RC.tick(sandbox.GM, { turn: 61, source: 'responsibility-smoke-tick1' });
assert(tick1 && tick1.assigned >= 1, 'responsibility tick should assign active commitments');
const assigned = sandbox.GM._minxinCommitments.items.find(x => x.id === commitment.id);
assert(assigned.executor && /Li Censor|Wang Revenue Minister|Zhang Prefect/.test(assigned.executor.name), 'commitment should get real executor from GM.chars');
assert(assigned.agency && /Revenue|Censorate|Local/.test(assigned.agency), 'commitment should get agency');
assert(assigned.resourcePlan && assigned.resourcePlan.money > 0 && assigned.resourcePlan.grain > 0, 'commitment should get resource plan');
assert(sandbox.GM.guoku.money < moneyBefore || sandbox.GM.guoku.grain < grainBefore, 'responsibility tick should consume or reserve resources');
assert(sandbox.GM._minxinResponsibilityChain.assignments.some(x => x.commitmentId === commitment.id), 'assignment ledger should record responsibility');
assert(sandbox.GM._minxinResponsibilityChain.officialReports.some(x => x.commitmentId === commitment.id), 'official report should be generated');
assert(sandbox.GM._minxinResponsibilityChain.rumors.some(x => x.commitmentId === commitment.id), 'rumor should be generated');

const report = sandbox.GM._minxinResponsibilityChain.officialReports.find(x => x.commitmentId === commitment.id);
const rumor = sandbox.GM._minxinResponsibilityChain.rumors.find(x => x.commitmentId === commitment.id);
assert(report.reportedProgress >= report.actualProgress, 'official report should not understate progress');
assert(rumor.trueProgress === report.actualProgress, 'rumor should carry true progress');

const riskBefore = assigned.falseReportRisk;
const intervention = RC.recordPlayerIntervention(sandbox.GM, {
  channel: 'hongyan',
  target: assigned.executor.name,
  linkedCommitment: assigned.id,
  text: 'Secretly verify Canal Ward relief and compare local accounts'
}, { turn: 61, source: 'responsibility-smoke-intervention' });
assert(intervention && intervention.ok, 'player intervention should be accepted');
assert(sandbox.GM._minxinResponsibilityChain.interventions.some(x => x.commitmentId === assigned.id), 'intervention ledger should record player action');
assert(assigned.falseReportRisk < riskBefore || assigned.independentAudit, 'intervention should reduce false-report risk or mark independent audit');
assert(sandbox.GM._socialPoliticalSignals.items.some(s => s.sourceSystem === 'minxin-responsibility' && s.kind === 'responsibility-intervention'), 'intervention should create social/political signal');

const bad = CT.record(sandbox.GM, {
  linkedIssue: 'manual-false-report',
  regionName: 'Canal Ward',
  className: 'Farmers',
  channel: 'memorial',
  decision: 'approved',
  text: 'Promise relief while local offices are corrupt',
  measures: ['relief', 'audit']
}, { turn: 61, source: 'responsibility-smoke-manual' });
sandbox.GM.corruption.trueIndex = 94;
sandbox.GM.corruption.subDepts.provincial.true = 92;
sandbox.GM.guoku.money = 0;
sandbox.GM.guoku.grain = 0;
sandbox.GM.turn = 62;
CT.tick(sandbox.GM, { turn: 62, source: 'responsibility-smoke-bad-commitment' });
const badTick = RC.tick(sandbox.GM, { turn: 62, source: 'responsibility-smoke-bad' });
assert(badTick.accountability >= 1, 'false report or failed responsibility should trigger accountability');
const badReports = sandbox.GM._minxinResponsibilityChain.officialReports.filter(x => x.commitmentId === bad.id);
const badRumors = sandbox.GM._minxinResponsibilityChain.rumors.filter(x => x.commitmentId === bad.id);
assert(badReports.some(x => x.reportedProgress > x.actualProgress), 'high corruption should produce inflated official report');
assert(badRumors.some(x => x.falseReportRisk >= 0.5 || x.severity === 'hot'), 'rumor should expose false-report risk');
assert((sandbox.GM.memorials || []).some(m => m && m.sourceType === 'minxin_accountability' && m.linkedCommitment === bad.id), 'accountability should create impeachment memorial');
assert((sandbox.GM._pendingTinyiTopics || []).some(t => t && t.sourceType === 'minxin_accountability' && t.linkedCommitment === bad.id), 'accountability should create pending tinyi topic');

const prompt = RC.formatForPrompt(sandbox.GM, { limit: 8 });
assert(/民情执行·责任链/.test(prompt), 'prompt should identify responsibility chain');
assert(/officialReports/.test(prompt) && /rumors/.test(prompt), 'prompt should include reports and rumors');
assert(/Canal Ward/.test(prompt), 'prompt should include target region');

console.log('[smoke-minxin-responsibility-chain] PASS minxin responsibility chain');
