#!/usr/bin/env node
// smoke-class-engine.js - regression checks for the class bridge layer.

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

const context = {
  console,
  Date,
  JSON,
  Math,
  GM: { turn: 12 },
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

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function makeRoot() {
  return {
    turn: 12,
    population: {
      national: { mouths: 1000 },
      byClass: {
        gentry_high: { mouths: 0, households: 0, ding: 0 },
        gentry_low: { mouths: 0, households: 0, ding: 0 }
      }
    },
    minxin: { alerts: [] },
    classes: []
  };
}

load('tm-ai-schema.js');
load('tm-ai-output-validator.js');
load('tm-engine-constants.js');
load('tm-class-engine.js');

const EC = context.TM.EngineConstants;
const CE = context.TM.ClassEngine;

assert(EC && CE, 'class bridge APIs must be mounted on TM');
assert(context.EngineConstants === EC, 'EngineConstants global alias missing');
assert(context.ClassEngine === CE, 'ClassEngine global alias missing');
assert(CE.currentVersion === 1, 'class engine version mismatch');
assert(EC.read('classToPartyWeight', { engineConstants: {} }) === undefined, 'empty engine constants should not invent classToPartyWeight');
assert(EC.read('classPartyDefaultAffinity', { engineConstants: {} }) === undefined, 'empty engine constants should not invent classPartyDefaultAffinity');
assert(context.TM_AI_SCHEMA.toKnownFields().class_alert_responses === 'array', 'schema missing class_alert_responses');
assert(context.TM_AI_SCHEMA.toRequiredSubfields().class_alert_responses.indexOf('alertId') >= 0, 'schema missing class alert alertId requirement');
assert(context.TM_AI_SCHEMA.toRequiredSubfields().class_alert_responses.indexOf('action') >= 0, 'schema missing class alert action requirement');
const validation = context.TM.validateAIOutput({
  class_alert_responses: [{ alertId: 'class:test', action: 'defer', reason: 'test' }]
}, 'class-alert-smoke');
assert(validation && validation.stats && validation.stats.unknownKeys === 0, 'validator should know class_alert_responses');

const templateProbe = { name: 'template-probe' };
EC.applyTemplate(templateProbe, 'ming');
assert(templateProbe.engineConstants && templateProbe.engineConstants.classPopulationMap, 'template missing classPopulationMap');
assert(templateProbe.engineConstants && templateProbe.engineConstants.classTagDeltaMatrix, 'template missing classTagDeltaMatrix');
assert(templateProbe.engineConstants.classToPartyWeight === 1, 'template missing classToPartyWeight');
assert(templateProbe.engineConstants.classPartyDefaultAffinity === 0.5, 'template missing classPartyDefaultAffinity');
assert(Array.isArray(templateProbe.engineConstants.classPopulationMap['士绅']), 'classPopulationMap did not inherit named class keys');
assert(templateProbe.engineConstants.classPopulationMap['士绅'].indexOf('gentry_high') >= 0, '士绅 population map missing gentry_high');
assert(templateProbe.engineConstants.classTagDeltaMatrix.tax.gentry_high.satisfaction === -6, 'tax matrix for gentry_high mismatch');

const bridgeRoot = makeRoot();
EC.applyTemplate(bridgeRoot, 'ming');
bridgeRoot.classes = [{ name: '士绅', size: '12%', satisfaction: 50, influence: 50, demands: '旧诉求', status: '良' }];

const resolved = CE.resolvePopulationKeys(bridgeRoot.classes[0], bridgeRoot);
assert(Array.isArray(resolved) && resolved.length === 2, 'resolvePopulationKeys should resolve two buckets for 士绅');
assert(resolved[0] === 'gentry_high' && resolved[1] === 'gentry_low', 'resolvePopulationKeys order mismatch');

const boot = CE.bootstrap(bridgeRoot, { turn: 12, source: 'smoke' });
assert(boot.seeded === 1, 'bootstrap should seed one class');
assert(bridgeRoot.classes[0]._populationMouths === 120, 'bootstrap did not bridge class mouths');
assert(bridgeRoot.population.byClass.gentry_high.mouths === 60, 'bootstrap did not split first bucket correctly');
assert(bridgeRoot.population.byClass.gentry_low.mouths === 60, 'bootstrap did not split second bucket correctly');
assert(String(bridgeRoot.classes[0].size).indexOf('12%') >= 0, 'bootstrap did not backfill size text');

bridgeRoot.population.byClass.gentry_high.mouths = 80;
bridgeRoot.population.byClass.gentry_low.mouths = 20;
const refreshed = CE.refresh(bridgeRoot, { turn: 12, source: 'smoke' });
assert(refreshed.refreshed === 1, 'refresh should read one bridged class');
assert(bridgeRoot.classes[0]._populationMouths === 100, 'refresh did not pull bucket mouths back into class');
assert(String(bridgeRoot.classes[0].size).indexOf('10%') >= 0, 'refresh did not rewrite size text');

const changeRoot = makeRoot();
EC.applyTemplate(changeRoot, 'ming');
const changeClass = {
  name: '士绅',
  size: '12%',
  satisfaction: 50,
  influence: 50,
  supportingParties: [{ class: '东林党', affinity: 0.8 }, { class: '浙党', affinity: 0.3 }],
  demands: '旧诉求',
  status: '良'
};
changeRoot.classes = [changeClass];
const change = CE.applyClassChange(changeRoot, changeClass, {
  name: '士绅',
  satisfaction_delta: 99,
  influence_delta: -99,
  new_demands: '更重徭役',
  new_status: '激化',
  reason: '加税徭役特权'
}, { turn: 12, source: 'smoke' });
assert(change.ok === true, 'applyClassChange must succeed');
assert(change.baseline.satisfaction === -5, 'baseline satisfaction mismatch');
assert(change.baseline.influence === 0, 'baseline influence mismatch');
assert(change.clamp.satisfaction === 2, 'AI satisfaction clamp should stay within 30% of baseline');
assert(change.clamp.influence === 1, 'AI influence clamp should stay within 30% of baseline');
assert(change.ai.satisfaction === 2, 'AI satisfaction delta not clamped correctly');
assert(change.ai.influence === -1, 'AI influence delta not clamped correctly');
assert(change.after.satisfaction === 47, 'final satisfaction mismatch');
assert(change.after.influence === 49, 'final influence mismatch');
assert(changeClass.demands === '更重徭役', 'new_demands was not applied');
assert(changeClass.status === '激化', 'new_status was not applied');

assert(change.partyCoupling && change.partyCoupling.ok === true, 'applyClassChange must forward party coupling');
assert(change.partyCoupling.applied.length === 2, 'applyClassChange should couple two supporting parties');
assert(Math.abs(changeClass.supportingParties[0].cohesionDelta + 2.4) < 1e-9, 'first supporting party delta mismatch');
assert(Math.abs(changeClass.supportingParties[1].cohesionDelta + 0.9) < 1e-9, 'second supporting party delta mismatch');
assert(Math.abs(changeRoot.partyState['东林党'].cohesion - 47.6) < 1e-9, 'first supporting party cohesion mismatch');
assert(Math.abs(changeRoot.partyState['浙党'].cohesion - 49.1) < 1e-9, 'second supporting party cohesion mismatch');

const couplingRoot = makeRoot();
EC.applyTemplate(couplingRoot, 'ming');
couplingRoot.parties = [
  { name: '东林党', cohesion: 40 },
  { name: '浙党', cohesion: 20 }
];
const couplingClass = {
  name: '阀门',
  supportingParties: [{ class: '东林党', affinity: 0.8 }, { class: '浙党', affinity: 0.3 }]
};
const coupling = CE.applyClassPartyCoupling(couplingRoot, couplingClass, 5, { turn: 12, source: 'smoke', reason: 'test' });
assert(coupling.ok === true, 'direct party coupling must succeed');
assert(coupling.applied.length === 2, 'direct party coupling should touch two parties');
assert(Math.abs(coupling.totalDelta - 5.5) < 1e-9, 'direct party coupling total delta mismatch');
assert(Math.abs(couplingRoot.partyState['东林党'].cohesion - 44) < 1e-9, 'direct party coupling first cohesion mismatch');
assert(Math.abs(couplingRoot.partyState['浙党'].cohesion - 21.5) < 1e-9, 'direct party coupling second cohesion mismatch');
assert(Math.abs(couplingClass.supportingParties[0].cohesionDelta - 4) < 1e-9, 'direct party coupling first entry delta mismatch');
assert(Math.abs(couplingClass.supportingParties[1].cohesionDelta - 1.5) < 1e-9, 'direct party coupling second entry delta mismatch');

const brewingRoot = {
  turn: 12,
  population: { national: { mouths: 0 }, byClass: {} },
  minxin: { alerts: [] },
  classes: [{
    name: '商贾',
    satisfaction: 40,
    influence: 30,
    unrestLevels: { revolt: 32 },
    revoltState: { phase: 'brewing', turns: 11, lastTurn: 0, note: '' }
  }]
};
const brewing = CE.refreshClassPhase(brewingRoot, brewingRoot.classes[0]);
assert(brewing.phase === 'uprising', 'brewing state should escalate to uprising at turn 12');
assert(brewing.changed === true, 'brewing escalation should mark changed');
assert(brewingRoot.classes[0].revoltState.turns >= 12, 'brewing turns should accumulate');
assert(Array.isArray(brewingRoot.minxin.alerts) && brewingRoot.minxin.alerts.length === 1, 'brewing should write one alert');
assert(brewingRoot.minxin.alerts[0].phase === 'uprising', 'brewing alert phase mismatch');

const uprisingRoot = {
  turn: 12,
  population: { national: { mouths: 0 }, byClass: {} },
  minxin: { alerts: [] },
  classes: [{
    name: '军户',
    satisfaction: 20,
    influence: 20,
    unrestLevels: { revolt: 18 },
    revoltState: { phase: 'calm', turns: 0, lastTurn: 0, note: '' }
  }]
};
const uprising = CE.refreshClassPhase(uprisingRoot, uprisingRoot.classes[0]);
assert(uprising.phase === 'uprising', 'low revolt must trigger uprising');
assert(uprising.changed === true, 'direct uprising should mark changed');
assert(uprisingRoot.minxin.alerts[0].text.indexOf('军户') >= 0, 'uprising alert should name the class');

const promptText = CE.buildAlertPrompt(uprisingRoot, { limit: 8 });
assert(promptText.indexOf('class_alert_responses') >= 0, 'alert prompt must require class_alert_responses');
assert(Array.isArray(uprisingRoot._classAlertPromptIds) && uprisingRoot._classAlertPromptIds[0] === 'class:军户', 'alert prompt should snapshot required ids');
const responseSummary = CE.applyAlertResponses(uprisingRoot, [{
  alertId: 'class:军户',
  action: 'partial',
  reason: '先抚后剿'
}], { turn: 12, source: 'smoke' });
assert(responseSummary.responded === 1, 'alert response should mark one responded alert');
assert(uprisingRoot.minxin.alerts[0].acknowledged === true, 'alert should be acknowledged');
assert(uprisingRoot.minxin.alerts[0].status === 'partial', 'partial response should keep partial status');
assert(uprisingRoot.minxin.alerts[0].resolved !== true, 'partial response should not resolve alert');
assert(Array.isArray(uprisingRoot.minxin.alertResponseLog) && uprisingRoot.minxin.alertResponseLog.length === 1, 'alert response should write log');

uprisingRoot.minxin.alerts[0].resolved = false;
uprisingRoot._classAlertPromptIds = ['class:军户'];
const missedSummary = CE.applyAlertResponses(uprisingRoot, [], { turn: 13, source: 'smoke' });
assert(missedSummary.missed === 1, 'missing response should be counted');
assert(uprisingRoot.minxin.alerts[0].missedCount >= 1, 'missing response should accumulate missedCount');
assert(uprisingRoot.minxin.alertResponseLog.some(function(x){ return x && x.action === 'missed'; }), 'missing response should write missed log');

const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const classScriptPos = indexHtml.indexOf('tm-class-engine.js?v=2026050102');
const inferScriptPos = indexHtml.indexOf('tm-endturn-ai-infer.js');
assert(classScriptPos >= 0, 'index.html missing tm-class-engine.js');
assert(inferScriptPos >= 0, 'index.html missing tm-endturn-ai-infer.js');
assert(classScriptPos < inferScriptPos, 'tm-class-engine.js must load before endturn AI infer');

const inferText = fs.readFileSync(path.join(ROOT, 'tm-endturn-ai-infer.js'), 'utf8');
assert(inferText.indexOf('TM.ClassEngine.applyClassChange') >= 0, 'endturn infer missing class change hook');
assert(inferText.indexOf('TM.ClassEngine.finalizeTurn') >= 0, 'endturn infer missing class finalize hook');
assert(inferText.indexOf('TM.ClassEngine.buildAlertPrompt') >= 0, 'endturn infer missing class alert prompt hook');
assert(inferText.indexOf('TM.ClassEngine.applyAlertResponses') >= 0, 'endturn infer missing class alert response hook');
assert(inferText.indexOf('TM.ClassEngine.applyClassPartyCoupling') >= 0, 'endturn infer missing class party coupling hook');
assert(inferText.indexOf('class_alert_responses') >= 0, 'endturn infer missing class alert response schema prompt');
assert(inferText.indexOf('supportingParties:[{class:"倾向支持的党派",affinity:0.5-1}]') >= 0, 'endturn infer missing structured supportingParties prompt');

const loopText = fs.readFileSync(path.join(ROOT, 'tm-game-loop.js'), 'utf8');
assert(loopText.indexOf('TM.ClassEngine.bootstrap') >= 0, 'game loop missing class bridge bootstrap');

console.log('[smoke-class-engine] pass assertions=78');
