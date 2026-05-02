#!/usr/bin/env node
// smoke-class-party-bidirectional.js - party outcome -> class satisfaction bridge.

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
let ASSERTS = 0;

function assert(cond, msg) {
  ASSERTS++;
  if (!cond) throw new Error('[assert] ' + msg);
}

function assertEq(actual, expected, msg) {
  assert(actual === expected, msg + ' expected=' + expected + ' actual=' + actual);
}

const context = {
  console,
  Date,
  JSON,
  Math,
  GM: { turn: 20 },
  P: {},
  scriptData: {}
};
context.window = context;
context.globalThis = context;
vm.createContext(context);

function load(file) {
  const code = fs.readFileSync(path.join(ROOT, file), 'utf8');
  vm.runInContext(code, context, { filename: file });
}

function makeRoot() {
  return {
    turn: 20,
    population: { national: { mouths: 1000 }, byClass: {} },
    minxin: { alerts: [] },
    engineConstants: context.TM.EngineConstants.getTemplate('generic'),
    partyState: {
      Reform: { name: 'Reform', cohesion: 50, influence: 60, recentPolicyWin: 4, recentPolicyLose: 0 },
      Blocker: { name: 'Blocker', cohesion: 50, influence: 55, recentPolicyWin: 0, recentPolicyLose: 2 }
    },
    parties: [
      { name: 'Reform', cohesion: 50, influence: 60 },
      { name: 'Blocker', cohesion: 50, influence: 55 }
    ],
    classes: [
      { name: 'Gentry', satisfaction: 50, influence: 50, supportingParties: [{ class: 'Reform', affinity: 1 }] },
      { name: 'Merchants', satisfaction: 50, influence: 50, supportingParties: [{ class: 'Blocker', affinity: 1 }] },
      { name: 'Peasants', satisfaction: 50, influence: 50, supportingParties: [{ class: 'Reform', affinity: 0.5 }, { class: 'Blocker', affinity: 0.5 }] }
    ]
  };
}

load('tm-engine-constants.js');
load('tm-class-engine.js');

const EC = context.TM.EngineConstants;
const CE = context.TM.ClassEngine;

assert(EC && CE, 'engine/class APIs should exist');
assertEq(EC.read('partyToClassWeight', { engineConstants: {} }), undefined, 'missing partyToClassWeight should read undefined');
assertEq(EC.read('recentPolicyDecay', { engineConstants: {} }), undefined, 'missing recentPolicyDecay should read undefined');
const tpl = EC.getTemplate('generic');
assertEq(tpl.partyToClassWeight, 1, 'generic template should seed partyToClassWeight');
assertEq(tpl.recentPolicyDecay, 0.2, 'generic template should seed recentPolicyDecay');

const issuedRoot = makeRoot();
const issued = CE.applyPartyOutcomeToClasses(issuedRoot, {
  sealStatus: 'issued',
  outcome: 'issued',
  grade: 'S',
  sourceParty: 'Reform',
  opposingParties: ['Blocker']
}, { turn: 20, source: 'smoke-issued' });
assert(issued.ok, 'issued outcome should apply to classes');
assert(issued.applied.length >= 2, 'issued outcome should touch source and opposing classes');
assert(issuedRoot.classes[0].satisfaction > 50, 'source party win should raise supporting class satisfaction');
assert(issuedRoot.classes[1].satisfaction < 50, 'opposing party loss should lower supporting class satisfaction');
assert(Array.isArray(issuedRoot.classes[0].partyOutcomeHistory), 'party outcome history should be written');
assert(Array.isArray(issuedRoot._partyClassCouplingLog), 'party-class coupling log should be written');
assert(issuedRoot.classes[0].lastPartyOutcomeRef[0].partyName === 'Reform', 'source party ref should be recorded');

const blockedRoot = makeRoot();
const blocked = CE.applyPartyOutcomeToClasses(blockedRoot, {
  sealStatus: 'blocked',
  outcome: 'blocked',
  grade: 'A',
  sourceParty: 'Reform',
  opposingParties: ['Blocker'],
  blockerParty: 'Blocker'
}, { turn: 20, source: 'smoke-blocked' });
assert(blocked.ok, 'blocked outcome should apply to classes');
assert(blockedRoot.classes[0].satisfaction < 50, 'blocked source party should lower supporting class satisfaction');
assert(blockedRoot.classes[1].satisfaction > 50, 'blocker party win should raise supporting class satisfaction');
assert(blocked.partyDeltas.Reform < 0, 'blocked source party delta should be negative');
assert(blocked.partyDeltas.Blocker > 0, 'blocked blocker party delta should be positive');

const partialRoot = makeRoot();
const partial = CE.applyPartyOutcomeToClasses(partialRoot, {
  outcome: 'partial',
  grade: 'B',
  sourceParty: 'Reform',
  opposingParties: ['Blocker']
}, { turn: 20, source: 'smoke-partial' });
assert(partial.ok, 'partial outcome should apply');
assert(partialRoot.classes[0].satisfaction > 50 && partialRoot.classes[0].satisfaction < issuedRoot.classes[0].satisfaction, 'partial strength should be weaker than issued');

const contestedRoot = makeRoot();
const contested = CE.applyPartyOutcomeToClasses(contestedRoot, {
  outcome: 'contested',
  grade: 'B',
  sourceParty: 'Reform',
  opposingParties: ['Blocker']
}, { turn: 20, source: 'smoke-contested' });
assert(contested.ok, 'contested outcome should apply');
assert(contestedRoot.classes[0].satisfaction > 50, 'contested uses reduced absolute strength, not a silent no-op');
assert(contestedRoot.classes[0].satisfaction < partialRoot.classes[0].satisfaction, 'contested should be weaker than partial');

const decayRoot = makeRoot();
const beforeWin = decayRoot.partyState.Reform.recentPolicyWin;
const beforeLose = decayRoot.partyState.Blocker.recentPolicyLose;
const decay = CE.decayRecentPolicyScores(decayRoot, { turn: 21, source: 'smoke-decay' });
assert(decay.ok, 'recent policy decay should apply when configured');
assert(decayRoot.partyState.Reform.recentPolicyWin < beforeWin, 'recentPolicyWin should decay');
assert(decayRoot.partyState.Blocker.recentPolicyLose < beforeLose, 'recentPolicyLose should decay');
assertEq(decayRoot.partyState.Reform.lastPolicyDecayTurn, 20, 'decay should stamp current root turn');

const noDecayRoot = makeRoot();
noDecayRoot.engineConstants = {};
const noDecay = CE.decayRecentPolicyScores(noDecayRoot, { turn: 21, source: 'smoke-no-decay' });
assert(noDecay.ok === false, 'missing recentPolicyDecay should not invent a decay');
assertEq(noDecayRoot.partyState.Reform.recentPolicyWin, 4, 'missing recentPolicyDecay should leave counters unchanged');

const tinyiText = fs.readFileSync(path.join(ROOT, 'tm-tinyi-v3.js'), 'utf8');
assert(tinyiText.indexOf('TM.ClassEngine.applyPartyOutcomeToClasses') >= 0, 'tinyi should call party-to-class bridge');
assert(tinyiText.indexOf('tinyi-stage6-issued') >= 0, 'tinyi should propagate issued seal outcomes');
assert(tinyiText.indexOf('tinyi-stage6-blocked') >= 0, 'tinyi should propagate blocked seal outcomes');
assert(tinyiText.indexOf('tinyi-stage7-follow-up') >= 0, 'tinyi should propagate follow-up outcomes');
assert(tinyiText.indexOf('if (force && hostile)') < tinyiText.indexOf('function _ty3_phase6_doSeal') || tinyiText.indexOf('/*\n  if (force && hostile)') < 0, 'old phase6 unreachable body should not remain commented in place');

const inferText = fs.readFileSync(path.join(ROOT, 'tm-endturn-ai-infer.js'), 'utf8');
assert(inferText.indexOf('partyOutcomeRef') >= 0, 'AI prompt/sample should mention class_changes.partyOutcomeRef');

console.log('[smoke-class-party-bidirectional] pass assertions=' + ASSERTS);
