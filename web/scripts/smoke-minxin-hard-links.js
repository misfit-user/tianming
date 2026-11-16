#!/usr/bin/env node
// smoke-minxin-hard-links.js - minxin constrains fiscal, draft, hukou, and execution.

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
  turn: 71,
  guoku: { money: 100000, grain: 80000 },
  fiscal: { treasury: 100000 },
  military: { reserves: 6000 },
  hukou: { registeredHouseholds: 4700, mouths: 19000 },
  corruption: { trueIndex: 70, perceivedIndex: 60, subDepts: { provincial: { true: 78 } } },
  minxin: { trueIndex: 48, perceivedIndex: 60, byRegion: {}, byClass: {}, sources: {} },
  classes: [
    { id: 'farmers', name: 'Farmers', satisfaction: 30, influence: 78, size: '74%', regionalVariants: [{ region: 'Canal Ward', satisfaction: 24 }] }
  ],
  adminHierarchy: {
    player: {
      divisions: [
        {
          id: 'canal',
          name: 'Canal Ward',
          minxin: 22,
          minxinLocal: 22,
          population: 10000,
          populationDetail: { households: 2500, mouths: 10000, ding: 2600, hiddenCount: 100, fugitives: 20 },
          fiscalDetail: { claimedRevenue: 12000, actualRevenue: 11000, remittedToCenter: 8000, skimmingRate: 0.1 },
          taxLevel: 'heavy',
          corruptionLocal: 82,
          minxinDetails: { trueIndex: 22 }
        },
        {
          id: 'river',
          name: 'River County',
          minxin: 72,
          minxinLocal: 72,
          population: 9000,
          populationDetail: { households: 2200, mouths: 9000, ding: 2400, hiddenCount: 30, fugitives: 5 },
          fiscalDetail: { claimedRevenue: 9000, actualRevenue: 8800, remittedToCenter: 7000, skimmingRate: 0.08 },
          taxLevel: 'light',
          corruptionLocal: 30,
          minxinDetails: { trueIndex: 72 }
        }
      ]
    }
  }
};

vm.createContext(sandbox);
load('tm-social-political-signals.js', sandbox);
load('tm-minxin-ledger.js', sandbox);
load('tm-minxin-hard-links.js', sandbox);

const ML = sandbox.TM.MinxinLedger;
const HL = sandbox.TM.MinxinHardLinks;
assert(HL && typeof HL.tick === 'function', 'TM.MinxinHardLinks.tick should exist');
assert(typeof HL.recordCoerciveDemand === 'function', 'hard links should expose coercive demand recorder');
assert(typeof HL.formatForPrompt === 'function', 'hard links should format prompt package');

ML.maintain(sandbox.GM, { turn: 71, source: 'hard-links-smoke-prep' });
const result = HL.tick(sandbox.GM, { turn: 71, source: 'hard-links-smoke-tick' });
assert(result && result.regions >= 2, 'hard link tick should process regional divisions');
assert(sandbox.GM._minxinHardLinks && sandbox.GM._minxinHardLinks.regionImpacts.length >= 2, 'hard link store should record region impacts');

const canal = sandbox.GM.adminHierarchy.player.divisions[0];
const river = sandbox.GM.adminHierarchy.player.divisions[1];
const canalImpact = sandbox.GM._minxinHardLinks.regionImpacts.find(x => x.regionName === 'Canal Ward');
const riverImpact = sandbox.GM._minxinHardLinks.regionImpacts.find(x => x.regionName === 'River County');

assert(canalImpact && riverImpact, 'each region should get an impact row');
assert(canalImpact.collectionMultiplier < riverImpact.collectionMultiplier, 'low minxin should reduce fiscal collection more than healthy minxin');
assert(canal.fiscalDetail.actualRevenue < canal.fiscalDetail.claimedRevenue, 'low minxin plus corruption should produce actual revenue shortfall');
assert(sandbox.GM.fiscal.minxinHardLinks.actualRevenue < sandbox.GM.fiscal.minxinHardLinks.claimedRevenue, 'aggregate fiscal links should expose revenue gap');

assert(canal.militaryDetail.recruitmentEfficiency < river.militaryDetail.recruitmentEfficiency, 'low minxin should reduce draft efficiency');
assert(canal.militaryDetail.availableRecruits > 0, 'draft capacity should be calculated');
assert(canal.militaryDetail.draftResistance > river.militaryDetail.draftResistance, 'low minxin should raise draft resistance');

assert(canal.corveeDetail.executionEfficiency < river.corveeDetail.executionEfficiency, 'low minxin should reduce corvee execution');
assert(canal.populationDetail.hiddenCount > 100 || canal.populationDetail.fugitives > 20, 'low minxin should increase hidden households or fugitives');
assert(sandbox.GM.hukou.minxinHardLinks.hiddenHouseholds > 0 || sandbox.GM.hukou.minxinHardLinks.refugees > 0, 'hukou aggregate should record hidden households or refugees');

assert(canal.localExecutionRate < river.localExecutionRate, 'low minxin should lower local execution rate');
assert(sandbox.GM.localExecution.minxinHardLinks.avgExecutionRate > 0, 'aggregate local execution should be exposed');

const beforeMinxin = Number(canal.minxinDetails.trueIndex);
const coerced = HL.recordCoerciveDemand(sandbox.GM, {
  region: 'Canal Ward',
  className: 'Farmers',
  kind: 'forced-conscription',
  text: 'forced draft to fill army quota',
  recruitmentGain: 500
}, { turn: 71, source: 'hard-links-smoke-coercion' });
assert(coerced && coerced.ok, 'coercive demand should be accepted');
assert(sandbox.GM.military.minxinHardLinks.shortTermRecruits >= 500, 'coercion should add short-term recruits');
assert(sandbox.GM._minxinLedger.items.some(x => x.sourceSystem === 'minxin-hard-links' && x.kind === 'coercive-demand'), 'coercion should write minxin ledger');
assert(Number(canal.minxinDetails.trueIndex) < beforeMinxin || Number(canal.minxinLocal) < beforeMinxin, 'coercion should lower target region minxin');

const prompt = HL.formatForPrompt(sandbox.GM, { limit: 8 });
assert(/Minxin Hard Links/.test(prompt), 'prompt should identify hard links');
assert(/fiscal/.test(prompt) && /hukou/.test(prompt) && /conscription/.test(prompt), 'prompt should include fiscal, hukou, and conscription summaries');

console.log('[smoke-minxin-hard-links] PASS minxin hard links');
