#!/usr/bin/env node
// smoke-huji-governance-loop.js - formal player actions become per-turn hukou/corvee/military commitments.

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
  id: 'smoke-huji-governance',
  name: 'Huji Governance Loop Smoke',
  populationConfig: {
    initial: {
      nationalHouseholds: 10000,
      nationalMouths: 50000,
      nationalDing: 15000,
      hiddenPopulation: 200
    },
    categoryEnabled: ['bianhu', 'junhu', 'jianghu'],
    corveeRules: { annualCorveeDays: 36, commutationRate: 0.2 },
    militaryRules: { maxExpansionRate: 0.08 }
  }
};

sandbox.findScenarioById = () => scenario;
sandbox.P = scenario;
sandbox.GM = {
  sid: 'smoke-huji-governance',
  turn: 101,
  guoku: { money: 500000, balance: 500000, grain: 300000, monthlyIncome: 42000, turnIncome: 42000 },
  fiscal: { expectedRevenue: 42000 },
  hukou: {},
  minxin: { trueIndex: 46, byRegion: {} },
  corruption: { trueIndex: 28, subDepts: { provincial: { true: 35 } } },
  huangquan: { executionRate: 0.86 },
  localExecution: { edictExecutionRate: 0.84 },
  military: { pendingRecruitment: 3600, draftQuota: 3600 },
  armies: [
    { id: 'army-1', name: 'Capital Guard', soldiers: 5200, type: 'mubing', morale: 48, supply: 60 },
    { id: 'army-2', name: 'Garrison Households', soldiers: 4100, type: 'junhu', morale: 52, supply: 48 }
  ],
  adminHierarchy: {
    player: {
      divisions: [
        {
          id: 'capital',
          name: 'Capital',
          regionType: 'capital',
          minxinLocal: 44,
          corruptionLocal: 36,
          taxLevel: 'heavy',
          populationDetail: { households: 5400, mouths: 27000, ding: 7900, hiddenCount: 620, fugitives: 180 },
          fiscalDetail: { claimedRevenue: 36000, actualRevenue: 30000, remittedToCenter: 21000, skimmingRate: 0.08 }
        },
        {
          id: 'plain',
          name: 'Plain Prefecture',
          regionType: 'rural',
          minxinLocal: 52,
          corruptionLocal: 24,
          taxLevel: 'medium',
          populationDetail: { households: 2800, mouths: 14000, ding: 4100, hiddenCount: 180, fugitives: 90 },
          fiscalDetail: { claimedRevenue: 18000, actualRevenue: 16000, remittedToCenter: 11000, skimmingRate: 0.04 }
        },
        {
          id: 'frontier',
          name: 'Frontier',
          regionType: 'frontier',
          minxinLocal: 58,
          corruptionLocal: 18,
          taxLevel: 'light',
          populationDetail: { households: 1200, mouths: 6000, ding: 1900, hiddenCount: 80, fugitives: 50 },
          fiscalDetail: { claimedRevenue: 7000, actualRevenue: 6100, remittedToCenter: 2600, skimmingRate: 0.03 }
        }
      ]
    }
  }
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
assert(Loop && typeof Loop.ingestPlayerSignals === 'function', 'TM.HujiGovernanceLoop.ingestPlayerSignals should exist');
assert(typeof Loop.tick === 'function', 'governance loop should tick');
assert(typeof Loop.snapshot === 'function', 'governance loop should expose snapshot');
assert(typeof Loop.formatForPrompt === 'function', 'governance loop should format prompt evidence');

sandbox.HujiEngine.init(scenario);
Bridge.maintain(sandbox.GM, { scenario, turn: 101, source: 'smoke-baseline', applyHardEffects: false });

const beforeHidden = sandbox.GM.population.hiddenCount;
const beforeFugitives = sandbox.GM.population.fugitives;
const beforeTaxBase = sandbox.GM.hukou.effectiveTaxHouseholds;
const beforeGap = sandbox.GM.corvee.ledger.summary.gapDays;
const beforeRecruits = sandbox.GM.military.servicePool.availableRecruits;
const beforeMoney = sandbox.GM.guoku.balance;
const beforeMinxin = sandbox.GM.minxin.trueIndex;

sandbox.TM.PlayerActionSignals.record(sandbox.GM, {
  source: 'formal-desk',
  kind: 'edict',
  action: 'edict',
  linkedIssue: 'huji-reform-101',
  text: 'Imperial edict: order a hukou census, inspect hidden households, resettle refugees, commute corvee labor into silver, audit military households, and recruit frontier soldiers.',
  intensity: 0.88
});

const ingested = Loop.ingestPlayerSignals(sandbox.GM, { turn: 101, source: 'smoke-ingest' });
assert(ingested.created >= 3, 'formal action should create hukou/corvee/military commitments');
assert(sandbox.GM._hujiCommitments.some(x => x.type === 'hukou_census'), 'should create hukou census commitment');
assert(sandbox.GM._hujiCommitments.some(x => x.type === 'corvee_commutation'), 'should create corvee commutation commitment');
assert(sandbox.GM._hujiCommitments.some(x => x.type === 'military_register'), 'should create military register commitment');
assert(sandbox.GM._hujiCommitments.every(x => x.linkedIssue === 'huji-reform-101'), 'commitments should preserve linked court issue');

const ticked = Loop.tick(sandbox.GM, { turn: 101, monthRatio: 1, source: 'smoke-tick' });
assert(ticked && ticked.active >= 3, 'tick should run active governance commitments');
assert(sandbox.GM.population.hiddenCount < beforeHidden, 'governance tick should reduce hidden population before bridge reconciliation');
assert(sandbox.GM.population.fugitives < beforeFugitives, 'governance tick should reduce fugitives/refugees before bridge reconciliation');
assert(sandbox.GM.adminHierarchy.player.divisions[0].populationDetail.hiddenCount < 620, 'regional hidden detail should be written so bridge does not overwrite the change');
assert(sandbox.GM.corvee.ledger.summary.gapDays < beforeGap, 'corvee gap should be reduced by governance execution');
assert(sandbox.GM.military.servicePool.availableRecruits > beforeRecruits, 'military service pool should gain recruit capacity');
assert(sandbox.GM.guoku.balance < beforeMoney, 'governance execution should spend treasury funds');
assert(sandbox.GM.minxin.trueIndex >= beforeMinxin - 0.01, 'successful governance should not lower minxin');
assert(sandbox.GM._socialPoliticalSignals.items.some(s => s.sourceSystem === 'huji-governance-loop'), 'loop should write social/political signal');
assert(sandbox.GM._minxinLedger.items.some(s => s.sourceSystem === 'huji-governance-loop'), 'loop should write minxin ledger signal');

Bridge.maintain(sandbox.GM, { scenario, turn: 101, source: 'smoke-after-governance', applyHardEffects: false });
assert(sandbox.GM.hukou.effectiveTaxHouseholds > beforeTaxBase, 'bridge should read improved tax base after governance tick');
assert(sandbox.GM.corvee.ledger.summary.gapDays < beforeGap, 'bridge should preserve governance corvee relief after reconciliation');
assert(sandbox.GM.military.servicePool.availableRecruits > beforeRecruits, 'bridge should preserve governance recruit boost after reconciliation');

const prompt = Loop.formatForPrompt(sandbox.GM, { limit: 8 });
assert(/Huji Governance Loop/.test(prompt), 'prompt should identify governance loop');
assert(/hukou_census/.test(prompt), 'prompt should include hukou commitment');
assert(/corvee_commutation/.test(prompt), 'prompt should include corvee commitment');
assert(/military_register/.test(prompt), 'prompt should include military commitment');

const snap = Loop.snapshot(sandbox.GM, { limit: 8 });
assert(snap.commitments.length >= 3, 'snapshot should expose commitments');
assert(snap.events.some(x => x.type === 'commitment-tick'), 'snapshot should expose tick events');

console.log('[smoke-huji-governance-loop] PASS huji governance loop');
