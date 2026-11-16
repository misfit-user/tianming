#!/usr/bin/env node
// smoke-minxin-hard-link-consumers.js - hard links are consumed by real turn-facing fields.

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
  turn: 72,
  guoku: { money: 100000, monthlyIncome: 21000, turnIncome: 21000, monthlyExpense: 17000 },
  fiscal: { treasury: 100000, expectedRevenue: 21000 },
  military: { reserves: 6000, pendingRecruitment: 3600, draftQuota: 3600 },
  hukou: { registeredHouseholds: 4700, mouths: 19000 },
  huangquan: { index: 74, executionRate: 0.87 },
  localExecution: {},
  corruption: { trueIndex: 70, perceivedIndex: 60, subDepts: { provincial: { true: 78 } } },
  minxin: { trueIndex: 48, perceivedIndex: 60, byRegion: {}, byClass: {}, sources: {} },
  classes: [
    { id: 'farmers', name: 'Farmers', satisfaction: 30, influence: 78, size: '74%', regionalVariants: [{ region: 'Canal Ward', satisfaction: 24 }] }
  ],
  policyQueue: [
    { id: 'relief-canal', title: 'Canal relief edict', executionRate: 0.82 },
    { id: 'tax-audit', title: 'Tax audit', executionRate: 0.9 }
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
load('tm-minxin-hard-link-consumers.js', sandbox);

const HL = sandbox.TM.MinxinHardLinks;
const HC = sandbox.TM.MinxinHardLinkConsumers;
assert(HC && typeof HC.consume === 'function', 'TM.MinxinHardLinkConsumers.consume should exist');
assert(typeof HC.formatForPrompt === 'function', 'consumer should format prompt package');
assert(typeof HC.snapshot === 'function', 'consumer should expose snapshot');

HL.tick(sandbox.GM, { turn: 72, source: 'consumer-smoke-hard-link' });
const consumed = HC.consume(sandbox.GM, { turn: 72, source: 'consumer-smoke' });
assert(consumed && consumed.ok, 'consumer should return ok');
assert(sandbox.GM._minxinHardLinkConsumers && sandbox.GM._minxinHardLinkConsumers.summary, 'consumer store should have summary');

const fiscal = sandbox.GM._minxinHardLinkConsumers.summary.fiscal;
assert(fiscal.plannedIncome === 21000, 'fiscal consumer should preserve planned income');
assert(fiscal.actualIncome < fiscal.plannedIncome, 'fiscal consumer should cap income below plan');
assert(sandbox.GM.guoku.turnIncome === fiscal.actualIncome, 'guoku turnIncome should be constrained by actual hard-link income');
assert(sandbox.GM.guoku.monthlyIncome === fiscal.actualIncome, 'guoku monthlyIncome should be constrained by actual hard-link income');
assert(sandbox.GM.fiscal.effectiveRevenue === fiscal.actualIncome, 'fiscal effectiveRevenue should use actual hard-link income');
assert(sandbox.GM.guoku.minxinConsumer.revenueLoss > 0, 'guoku should expose minxin revenue loss');

const military = sandbox.GM._minxinHardLinkConsumers.summary.military;
assert(military.requestedRecruits === 3600, 'military consumer should read pending recruitment');
assert(military.approvedRecruits < military.requestedRecruits, 'military consumer should cap recruitment by minxin capacity');
assert(sandbox.GM.military.approvedRecruitment === military.approvedRecruits, 'military approvedRecruitment should be written');
assert(sandbox.GM.military.recruitmentShortfall > 0, 'military should expose recruitment shortfall');

const hukou = sandbox.GM._minxinHardLinkConsumers.summary.hukou;
assert(hukou.hiddenHouseholds > 0 && hukou.refugees > 0, 'hukou consumer should aggregate hidden households and refugees');
assert(hukou.effectiveTaxHouseholds < hukou.registeredHouseholds, 'hidden households should reduce effective tax base');
assert(sandbox.GM.hukou.effectiveTaxHouseholds === hukou.effectiveTaxHouseholds, 'hukou should expose effective tax households');
assert(sandbox.GM.population.national.hiddenCount === hukou.hiddenHouseholds, 'population national should mirror hidden households');

const execution = sandbox.GM._minxinHardLinkConsumers.summary.execution;
assert(execution.effectiveExecutionRate < 0.87, 'local minxin should cap execution rate');
assert(sandbox.GM.huangquan.executionRate === execution.effectiveExecutionRate, 'huangquan executionRate should be capped');
assert(sandbox.GM.policyQueue.every(p => p.minxinExecutionCap === execution.effectiveExecutionRate), 'policy queue should receive execution cap');

assert(sandbox.GM._socialPoliticalSignals.items.some(s => s.sourceSystem === 'minxin-hard-link-consumer'), 'consumer should write a social/political signal');

const prompt = HC.formatForPrompt(sandbox.GM, { limit: 8 });
assert(/Minxin Hard Link Consumers/.test(prompt), 'prompt should identify consumer layer');
assert(/fiscalConsumer/.test(prompt) && /recruitmentConsumer/.test(prompt), 'prompt should include fiscal and recruitment consumers');
assert(/hukouConsumer/.test(prompt) && /executionConsumer/.test(prompt), 'prompt should include hukou and execution consumers');

const snap = HC.snapshot(sandbox.GM, { limit: 4 });
assert(snap.summary && snap.events.length >= 4, 'snapshot should expose summary and events');

console.log('[smoke-minxin-hard-link-consumers] PASS hard-link consumers');
