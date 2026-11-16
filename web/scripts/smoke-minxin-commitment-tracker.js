#!/usr/bin/env node
// smoke-minxin-commitment-tracker.js - formal minxin responses become governed commitments with turn settlements.

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
  turn: 51,
  guoku: { money: 120000, grain: 90000 },
  fiscal: { treasury: 120000 },
  corruption: { trueIndex: 26, perceivedIndex: 34, subDepts: { provincial: { true: 24 }, judicial: { true: 30 } } },
  war_state: { activeWars: [] },
  classes: [
    { id: 'farmers', name: 'Farmers', satisfaction: 30, influence: 78, size: '74%', regionalVariants: [{ region: 'Canal Ward', satisfaction: 24 }] }
  ],
  parties: [
    { id: 'relief', name: 'Relief Party', socialBase: ['Farmers'], influence: 45, cohesion: 60 }
  ],
  chars: [
    { id: 'li', name: 'Li Censor', title: 'Censor', office: 'Censorate', party: 'Relief Party', influence: 62 },
    { id: 'zhang', name: 'Zhang Prefect', title: 'Prefect of Canal Ward', office: 'Local Prefect', location: 'Canal Ward', influence: 52 }
  ],
  minxin: { trueIndex: 46, perceivedIndex: 59, byRegion: {}, byClass: {}, sources: {}, uprisingCandidates: [] },
  adminHierarchy: {
    player: {
      divisions: [
        { id: 'canal', name: 'Canal Ward', minxin: 23, minxinLocal: 23, population: 10000, minxinDetails: { trueIndex: 23 } },
        { id: 'river', name: 'River County', minxin: 61, minxinLocal: 61, population: 7000, minxinDetails: { trueIndex: 61 } }
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

const ML = sandbox.TM.MinxinLedger;
const PA = sandbox.TM.MinxinPressureActions;
const CT = sandbox.TM.MinxinCommitmentTracker;
assert(CT && typeof CT.recordFromPressureResponse === 'function', 'TM.MinxinCommitmentTracker.recordFromPressureResponse should exist');
assert(typeof CT.tick === 'function', 'TM.MinxinCommitmentTracker.tick should exist');
assert(typeof CT.formatForPrompt === 'function', 'TM.MinxinCommitmentTracker.formatForPrompt should exist');

ML.maintain(sandbox.GM, { turn: 51, source: 'commitment-smoke-prep' });
PA.maintain(sandbox.GM, { turn: 51, source: 'commitment-smoke-pressure' });
const pressure = sandbox.GM._minxinPressureActions.items.find(x => x.regionName === 'Canal Ward' && x.className === 'Farmers');
assert(pressure && pressure.id, 'pressure item should exist before commitment response');

const response = PA.recordPlayerResponse(sandbox.GM, {
  channel: 'memorial',
  decision: 'approved',
  linkedIssue: pressure.id,
  actor: 'Emperor',
  text: 'Approve grain relief, tax remission, and dispatch an audit to Canal Ward'
}, { turn: 51, source: 'commitment-smoke-response' });
assert(response && response.ok, 'pressure response should succeed');
assert(sandbox.GM._minxinCommitments && sandbox.GM._minxinCommitments.items.length === 1, 'positive pressure response should create one governance commitment');

const commitment = sandbox.GM._minxinCommitments.items[0];
assert(commitment.linkedIssue === pressure.id, 'commitment should link back to pressure item');
assert(commitment.regionName === 'Canal Ward' && commitment.className === 'Farmers', 'commitment should retain region/class target');
assert(commitment.measures.indexOf('relief') >= 0 && commitment.measures.indexOf('tax_remission') >= 0 && commitment.measures.indexOf('audit') >= 0, 'commitment should classify relief, remission, and audit measures');

const afterResponse = sandbox.GM.adminHierarchy.player.divisions[0].minxin;
sandbox.GM.turn = 52;
const tick = CT.tick(sandbox.GM, { turn: 52, source: 'commitment-smoke-good' });
assert(tick && tick.settled >= 1, 'tick should settle active commitments');
const progressed = sandbox.GM._minxinCommitments.items.find(x => x.id === commitment.id);
assert(progressed.progress > 0, 'good-condition settlement should advance commitment progress');
assert(progressed.status === 'active' || progressed.status === 'resolved', 'good-condition commitment should remain active or resolve');
assert(sandbox.GM._minxinCommitments.settlements.some(x => x.commitmentId === commitment.id && x.status === 'progress'), 'settlement ledger should record progress');
assert(sandbox.GM._socialPoliticalSignals.items.some(s => s.sourceSystem === 'minxin-commitment' && s.kind === 'commitment-progress'), 'progress settlement should create social/political signal');
assert(sandbox.GM._minxinLedger.items.some(x => x.kind === 'commitment-settlement' && x.linkedIssue === commitment.id), 'progress settlement should write minxin ledger');
assert(sandbox.GM.adminHierarchy.player.divisions[0].minxin > afterResponse, 'progress settlement should improve targeted regional minxin');

const bad = CT.record(sandbox.GM, {
  linkedIssue: 'manual-bad',
  regionName: 'Canal Ward',
  className: 'Farmers',
  channel: 'hongyan',
  decision: 'sent',
  text: 'Promise relief while treasury is empty and roads are blocked',
  measures: ['relief', 'audit']
}, { turn: 52, source: 'commitment-smoke-manual' });
assert(bad && bad.id, 'manual commitment record should be possible for non-pressure formal promises');
sandbox.GM.guoku.money = 0;
sandbox.GM.fiscal.treasury = 0;
sandbox.GM.corruption.trueIndex = 92;
sandbox.GM.corruption.subDepts.provincial.true = 88;
sandbox.GM._routeDisruptions = [{ region: 'Canal Ward', severity: 0.9 }];
sandbox.GM.war_state.activeWars = [{ inTerritory: true, region: 'Canal Ward' }];
sandbox.GM.turn = 53;
const badTick = CT.tick(sandbox.GM, { turn: 53, source: 'commitment-smoke-bad' });
assert(badTick.settled >= 1, 'bad-condition tick should settle commitments');
const badItem = sandbox.GM._minxinCommitments.items.find(x => x.id === bad.id);
assert(badItem.status === 'stalled' || badItem.status === 'failed', 'bad-condition commitment should stall or fail');
assert((badItem.lastSettlement && /finance|corruption|route|war/.test(badItem.lastSettlement.reason || '')), 'bad settlement should explain blocking conditions');
assert(sandbox.GM._socialPoliticalSignals.items.some(s => s.sourceSystem === 'minxin-commitment' && s.kind === 'commitment-backlash'), 'bad settlement should create backlash social/political signal');
assert(sandbox.GM._minxinLedger.items.some(x => x.kind === 'commitment-backlash' && x.linkedIssue === bad.id), 'bad settlement should write negative minxin ledger');

const prompt = CT.formatForPrompt(sandbox.GM, { limit: 8 });
assert(/Minxin Commitments/.test(prompt), 'commitment prompt should identify itself');
assert(/Canal Ward/.test(prompt) && /Farmers/.test(prompt), 'commitment prompt should include region and class');
assert(/progress|stalled|failed/.test(prompt), 'commitment prompt should include settlement status');

console.log('[smoke-minxin-commitment-tracker] PASS minxin governance commitment loop');
