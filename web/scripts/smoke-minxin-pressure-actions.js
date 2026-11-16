#!/usr/bin/env node
// smoke-minxin-pressure-actions.js - low minxin pressure should become playable court work, then feed back.

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
  turn: 41,
  classes: [
    { id: 'farmers', name: 'Farmers', satisfaction: 31, influence: 75, size: '72%', regionalVariants: [{ region: 'Canal Ward', satisfaction: 26 }] },
    { id: 'merchants', name: 'Merchants', satisfaction: 55, influence: 50, size: '12%' }
  ],
  parties: [
    { id: 'relief', name: 'Relief Party', socialBase: ['Farmers'], influence: 42, cohesion: 58 },
    { id: 'tax', name: 'Tax Party', policyStance: ['tax'], influence: 38, cohesion: 62 }
  ],
  chars: [
    { id: 'li', name: 'Li Censor', title: 'Censor', office: 'Censorate', party: 'Relief Party', influence: 62 },
    { id: 'zhang', name: 'Zhang Prefect', title: 'Prefect of Canal Ward', office: 'Local Prefect', location: 'Canal Ward', influence: 52 }
  ],
  corruption: { trueIndex: 68, perceivedIndex: 44 },
  minxin: { trueIndex: 48, perceivedIndex: 58, byRegion: {}, byClass: {}, sources: {}, uprisingCandidates: [] },
  adminHierarchy: {
    player: {
      divisions: [
        { id: 'canal', name: 'Canal Ward', minxin: 24, minxinLocal: 24, population: 10000, minxinDetails: { trueIndex: 24 } },
        { id: 'river', name: 'River County', minxin: 57, minxinLocal: 57, population: 7000, minxinDetails: { trueIndex: 57 } }
      ]
    }
  },
  _pendingTinyiTopics: []
};

vm.createContext(sandbox);
load('tm-social-political-signals.js', sandbox);
load('tm-minxin-ledger.js', sandbox);
load('tm-minxin-pressure-actions.js', sandbox);

const ML = sandbox.TM.MinxinLedger;
const PA = sandbox.TM.MinxinPressureActions;
assert(PA && typeof PA.maintain === 'function', 'TM.MinxinPressureActions.maintain should exist');
assert(typeof PA.recordPlayerResponse === 'function', 'TM.MinxinPressureActions.recordPlayerResponse should exist');
assert(typeof PA.formatForPrompt === 'function', 'TM.MinxinPressureActions.formatForPrompt should exist');

ML.maintain(sandbox.GM, { turn: 41, source: 'smoke-pressure-prep' });
const scan = PA.maintain(sandbox.GM, { turn: 41, source: 'smoke-pressure' });
assert(scan && scan.spawned >= 1, 'low minxin matrix should spawn at least one pressure action');
assert(sandbox.GM._minxinPressureActions.items.some(x => x.regionName === 'Canal Ward' && x.className === 'Farmers'), 'pressure ledger should store region/class actor');

const issue = sandbox.GM._minxinPressureActions.items.find(x => x.regionName === 'Canal Ward' && x.className === 'Farmers');
assert(issue && issue.id, 'pressure item should have stable id');
assert((sandbox.GM.memorials || []).some(m => m && m._minxinPressureActionId === issue.id && m.status === 'pending'), 'pressure should create a memorial, not a direct button');
assert(sandbox.GM._pendingTinyiTopics.some(t => t && t.sourceType === 'minxin_pressure' && t.linkedIssue === issue.id), 'pressure should enter pending tinyi queue');
assert((sandbox.GM._minxinWenduiHints || []).some(h => h && h.linkedIssue === issue.id && /Li Censor|Zhang Prefect/.test(h.personName)), 'pressure should create wendui clues for relevant people');
assert((sandbox.GM._minxinLetterHints || []).some(h => h && h.linkedIssue === issue.id), 'pressure should create hongyan letter clues');
assert(/民情积压/.test(PA.formatForPrompt(sandbox.GM, { limit: 8 })), 'pressure prompt should identify itself');
assert(/Canal Ward/.test(PA.formatForPrompt(sandbox.GM, { limit: 8 })) && /Farmers/.test(PA.formatForPrompt(sandbox.GM, { limit: 8 })), 'pressure prompt should include region and class');

const before = sandbox.GM.adminHierarchy.player.divisions[0].minxin;
const response = PA.recordPlayerResponse(sandbox.GM, {
  channel: 'memorial',
  decision: 'approved',
  linkedIssue: issue.id,
  text: 'Approve remission and dispatch Zhang Prefect to verify corvee abuses',
  actor: 'Emperor'
}, { turn: 41, source: 'smoke-response' });
assert(response && response.ok, 'formal response should be accepted');
assert(sandbox.GM._socialPoliticalSignals.items.some(s => s && s.sourceSystem === 'minxin-pressure-response' && s.linkedIssue === issue.id), 'formal response should become a social/political signal');
assert(sandbox.GM._minxinLedger.items.some(x => x && x.kind === 'response-memorial' && x.linkedIssue === issue.id), 'formal response should write back into minxin ledger');
assert(sandbox.GM.adminHierarchy.player.divisions[0].minxin > before, 'approved response should improve targeted regional minxin');
assert(sandbox.GM._minxinPressureActions.items.find(x => x.id === issue.id).status === 'responded', 'pressure item should track response status');

console.log('[smoke-minxin-pressure-actions] PASS minxin pressure action loop');
