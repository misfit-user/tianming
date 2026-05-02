#!/usr/bin/env node
// smoke-military-systems.js - phase 5 military systems regression gate.

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

function fakeEl() {
  return {
    classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    style: { cssText: '' },
    appendChild(c){ return c; },
    removeChild(c){ return c; },
    insertBefore(c){ return c; },
    setAttribute(){},
    getAttribute(){ return null; },
    addEventListener(){},
    removeEventListener(){},
    querySelector(){ return fakeEl(); },
    querySelectorAll(){ return []; },
    children: [],
    childNodes: [],
    firstChild: null,
    parentNode: null,
    innerHTML: '',
    textContent: '',
    value: '',
    dataset: {},
    remove(){}
  };
}

const context = {
  console,
  Date,
  JSON,
  Math,
  RegExp,
  Error,
  Array,
  Object,
  String,
  Number,
  Boolean,
  Map,
  Set,
  parseInt,
  parseFloat,
  isFinite,
  isNaN,
  setTimeout(){},
  clearTimeout(){},
  document: {
    getElementById: () => fakeEl(),
    querySelector: () => fakeEl(),
    querySelectorAll: () => [],
    addEventListener(){},
    createElement: () => fakeEl(),
    body: fakeEl(),
    head: fakeEl(),
    readyState: 'complete'
  },
  localStorage: { getItem: () => null, setItem(){}, removeItem(){} },
  navigator: { userAgent: 'node' },
  TM: {},
  GM: { turn: 1, chars: [], armies: [], facs: [] },
  P: { battleConfig: { enabled: true } },
  scriptData: {},
  SettlementPipeline: { register(){} },
  EndTurnHooks: { register(){} },
  uid: (() => {
    let n = 0;
    return () => 'smoke_uid_' + (++n);
  })(),
  _rngState: { seed: 'smoke' },
  createSubRng: () => () => 0.5,
  getTimeRatio: () => 1 / 12,
  _dbg(){},
  addEB(){},
  toast(){},
  findCharByName(name) {
    return (context.GM.chars || []).find(c => c && c.name === name) || null;
  }
};
context.window = context;
context.globalThis = context;
vm.createContext(context);

function load(file) {
  const code = fs.readFileSync(path.join(ROOT, file), 'utf8');
  vm.runInContext(code, context, { filename: file });
}

let assertions = 0;
function check(cond, msg) {
  if (!cond) throw new Error(msg);
  assertions++;
}
function checkEq(actual, expected, msg) {
  check(actual === expected, msg + ' expected=' + expected + ' actual=' + actual);
}

load('tm-engine-constants.js');
load('tm-military.js');
load('tm-char-full-schema.js');
load('tm-rel-graph.js');
load('tm-migration.js');
load('tm-ai-schema.js');
load('tm-ai-output-validator.js');
load('tm-ai-change-applier.js');

const EC = context.TM.EngineConstants;
const MS = context.MilitarySystems;
check(EC, 'EngineConstants missing');
check(MS, 'MilitarySystems missing');
check(context.TM.MilitarySystems === MS, 'MilitarySystems TM alias missing');

const endturnSource = fs.readFileSync(path.join(ROOT, 'tm-endturn-ai-infer.js'), 'utf8');
check(endturnSource.indexOf('MilitarySystems.getMilitarySystems(GM)') >= 0, 'sc18 should inject militarySystems catalog context');
check(endturnSource.indexOf('p18.battleResult') >= 0 && endturnSource.indexOf('MilitarySystems.applyBattleResult(p18.battleResult') >= 0, 'sc18 should apply structured battleResult');
check(endturnSource.indexOf('affectedArmies:[{armyId,side,loss,moraleDelta,loyaltyDelta,state,commanderFate}]') >= 0, 'sc18 should request affectedArmies');
check(endturnSource.indexOf('lastInteractionMemory') >= 0 && endturnSource.indexOf('recognitionState') >= 0, 'sc07 should expose new cognition fields');
check(endturnSource.indexOf('lastInteractionMemory/recognitionState') >= 0, 'sc07 dynamic info rule missing');

const saveLifecycleSource = fs.readFileSync(path.join(ROOT, 'tm-save-lifecycle.js'), 'utf8');
check(saveLifecycleSource.indexOf('EngineMigration.run(GM);') >= 0, 'save lifecycle should run engine migration');
check(saveLifecycleSource.indexOf('RelGraph.syncCharRefs(ch, GM)') >= 0, 'save lifecycle should sync char refs');

const threeSystemsSource = fs.readFileSync(path.join(ROOT, 'tm-three-systems-ext.js'), 'utf8');
check(threeSystemsSource.indexOf('RelGraph.syncCharRefs(ch, global.GM)') >= 0, 'three systems should sync char refs on start');

function idsOf(list) {
  return (list || []).map(x => x && x.id).filter(Boolean);
}

const han = EC.getTemplate('han');
const tang = EC.getTemplate('tang');
const ming = EC.getTemplate('ming');
const qing = EC.getTemplate('qing');
check(idsOf(han.militarySystems).indexOf('jun_guo_bing') >= 0, 'han jun_guo_bing missing');
check(idsOf(tang.militarySystems).indexOf('jiedushi_private') >= 0, 'tang jiedushi_private missing');
check(idsOf(ming.militarySystems).indexOf('jiading') >= 0, 'ming jiading missing');
check(idsOf(qing.militarySystems).indexOf('banner_army') >= 0, 'qing banner_army missing');
checkEq(qing.militarySystems.find(x => x.id === 'banner_army').loyaltyAttribution, 'banner', 'banner army attribution mismatch');

const owned = {
  engineConstants: {
    militarySystems: [{ id:'custom_guard', name:'Custom Guard', loyaltyAttribution:'commander' }],
    tactics: [{ id:'custom_tactic', name:'Custom Tactic' }],
    militaryPayArrearsBaseline: { moralePerMonth:-7, loyaltyPerMonth:-3, routeMoraleBelow:12 },
    militaryPayArrearsClamp: 0.1,
    battleResultSchemaVersion: 9
  }
};
EC.applyTemplate(owned, 'tang');
checkEq(owned.engineConstants.militarySystems.length, 1, 'owned militarySystems must not merge template entries');
checkEq(owned.engineConstants.tactics.length, 1, 'owned tactics must not merge template entries');
checkEq(owned.engineConstants.militaryPayArrearsBaseline.moralePerMonth, -7, 'owned pay-arrears baseline must survive');
checkEq(owned.engineConstants.militaryPayArrearsClamp, 0.1, 'owned pay-arrears clamp must survive');
checkEq(owned.engineConstants.battleResultSchemaVersion, 9, 'owned battle schema version must survive');

context.GM = { turn: 4, engineConstants: tang, chars: [], armies: [], facs: [] };
context.P = { battleConfig: { enabled: true } };
const systems = MS.getMilitarySystems(context.GM);
checkEq(systems.find(x => x.id === 'jiedushi_private').loyaltyAttribution, 'commander', 'runtime should read template militarySystems');
checkEq(MS.getMilitarySystemForArmy({ systemId:'jiedushi_private' }, context.GM).id, 'jiedushi_private', 'army systemId match failed');

context.GM = { turn: 4, engineConstants: {}, chars: [], armies: [], facs: [] };
context.P = { battleConfig: { enabled: true }, military: { militarySystem: { legacy: { name:'Legacy', recruitmentType:'paid', salaryType:'local', loyaltyAttribution:'state' } } } };
checkEq(MS.getMilitarySystems(context.GM)[0].id, 'legacy', 'legacy military system fallback failed');

context.GM = {
  turn: 6,
  engineConstants: {
    militarySystems: [
      { id:'leader_guard', name:'Leader Guard', loyaltyAttribution:'leader' },
      { id:'throne_guard', name:'Throne Guard', loyaltyAttribution:'throne' },
      { id:'local_guard', name:'Local Guard', loyaltyAttribution:'local' }
    ]
  },
  _militaryPayArrearsLog: []
};
const semanticSystems = MS.getMilitarySystems(context.GM);
checkEq(semanticSystems.find(x => x.id === 'leader_guard').loyaltyAttribution, 'leader', 'leader attribution should preserve semantics');
checkEq(semanticSystems.find(x => x.id === 'throne_guard').loyaltyAttribution, 'throne', 'throne attribution should preserve semantics');
checkEq(semanticSystems.find(x => x.id === 'local_guard').loyaltyAttribution, 'local', 'local attribution should preserve semantics');

context.GM = { turn: 10, engineConstants: EC.getTemplate('generic'), _militaryPayArrearsLog: [] };
let army = { name:'PayArmy', payArrearsMonths:3, morale:50, loyalty:60, systemId:'recruited_army' };
let base = MS.payArrearsBaseline(army, context.GM);
checkEq(base.moraleDelta, -30, 'pay arrears morale baseline mismatch');
checkEq(base.loyaltyDelta, -15, 'pay arrears loyalty baseline mismatch');
check(MS.validatePayArrearsAdjustment(army, { moraleDelta:-24, loyaltyDelta:-12, reason:'steady commander' }, context.GM).ok, 'valid pay arrears adjustment rejected');
check(!MS.validatePayArrearsAdjustment(army, { moraleDelta:0, loyaltyDelta:0, reason:'too generous' }, context.GM).ok, 'invalid pay arrears adjustment accepted');
let invalid = MS.applyPayArrearsPressure(army, { adjustment:{ moraleDelta:0, loyaltyDelta:0, reason:'too generous' }, force:true }, context.GM);
check(!invalid.ok && army.morale === 50, 'invalid pay arrears application should not mutate morale');
let applied = MS.applyPayArrearsPressure(army, { source:'smoke' }, context.GM);
check(applied.ok, 'baseline pay arrears application failed');
checkEq(army.morale, 20, 'baseline pay arrears morale application mismatch');
checkEq(army.loyalty, 45, 'baseline pay arrears loyalty application mismatch');
checkEq(context.GM._militaryPayArrearsLog.length, 1, 'pay arrears log missing');
MS.applyPayArrearsPressure(army, { source:'smoke' }, context.GM);
checkEq(context.GM._militaryPayArrearsLog.length, 1, 'pay arrears should be once per turn/month state');

context.GM = { turn: 11, engineConstants: tang, _militaryPayArrearsLog: [] };
let stateArmy = { name:'StateArmy', systemId:'fubing', payArrearsMonths:1, morale:15, loyalty:60, mutinyRisk:0 };
MS.applyPayArrearsPressure(stateArmy, { force:true }, context.GM);
check(stateArmy.routed === true && stateArmy._routedAftermath === 'state_collapse', 'state-attributed routed aftermath failed');
checkEq(stateArmy.mutinyRisk, 25, 'state-attributed mutiny risk mismatch');
let commanderArmy = { name:'CommanderArmy', systemId:'jiedushi_private', payArrearsMonths:1, morale:15, loyalty:60 };
MS.applyPayArrearsPressure(commanderArmy, { force:true }, context.GM);
check(commanderArmy.routed === true && commanderArmy._routedAftermath === 'commander_holds', 'commander-attributed routed aftermath failed');
context.GM.engineConstants = qing;
let bannerArmy = { name:'BannerArmy', systemId:'banner_army', payArrearsMonths:1, morale:15, loyalty:60, cohesion:50 };
MS.applyPayArrearsPressure(bannerArmy, { force:true }, context.GM);
check(bannerArmy.routed === true && bannerArmy._routedAftermath === 'banner_internal', 'banner-attributed routed aftermath failed');
checkEq(bannerArmy.cohesion, 40, 'banner routed cohesion mismatch');
let localArmy = { name:'LocalArmy', systemId:'local_guard', payArrearsMonths:1, morale:15, loyalty:60, cohesion:50, loyaltyAttribution:'local' };
MS.applyPayArrearsPressure(localArmy, { force:true }, context.GM);
check(localArmy.routed === true && localArmy._routedAftermath === 'local_fragmentation', 'local-attributed routed aftermath failed');
let throneArmy = { name:'ThroneArmy', systemId:'throne_guard', payArrearsMonths:1, morale:15, loyalty:60, loyaltyAttribution:'throne' };
MS.applyPayArrearsPressure(throneArmy, { force:true }, context.GM);
check(throneArmy.routed === true && throneArmy._routedAftermath === 'throne_guard_disgraced', 'throne-attributed routed aftermath failed');

context.GM = {
  turn: 22,
  engineConstants: tang,
  armies: [
    { id:'atk', name:'AttackArmy', soldiers:1000 },
    { id:'def', name:'DefendArmy', soldiers:1200 }
  ],
  cities: [{ id:'city1', owner:'Old' }],
  provinceStats: { city2: { owner:'Old' } },
  chars: [{ name:'General', alive:true }],
  partyState: { P1: { historyLog: [] } },
  _setProvinceOwnerCalls: []
};
context.setProvinceOwner = function(id, owner) {
  context.GM._setProvinceOwnerCalls.push({ id, owner });
  if (!context.GM.provinceStats[id]) context.GM.provinceStats[id] = {};
  context.GM.provinceStats[id].owner = owner;
};
let br = MS.applyBattleResult({
  battleId:'br1',
  winnerFactionId:'Winner',
  loserFactionId:'Loser',
  occupiedCityIds:['city1', 'city2'],
  casualties:{ attacker:100, defender:200 },
  attackerArmyId:'atk',
  defenderArmyId:'def',
  commanderFate:{ name:'General', outcome:'captured' },
  postBattleEffects:[{ type:'morale', target:'P1', magnitude:-2 }]
}, context.GM);
check(br.ok, 'applyBattleResult failed');
checkEq(context.GM.cities[0].owner, 'Winner', 'battleResult city owner writeback failed');
checkEq(context.GM.provinceStats.city2.owner, 'Winner', 'battleResult province owner writeback failed');
checkEq(context.GM.armies[0].soldiers, 900, 'attacker casualty writeback failed');
checkEq(context.GM.armies[1].soldiers, 1000, 'defender casualty writeback failed');
checkEq(context.GM.chars[0].capturedBy, 'Winner', 'commander capture writeback failed');
checkEq(context.GM.partyState.P1.historyLog.length, 1, 'postBattleEffects party history writeback failed');
checkEq(context.GM.battleHistory.length, 1, 'battle history writeback failed');

context.GM = {
  turn: 23,
  engineConstants: tang,
  armies: [
    { id:'atk2', name:'AttackWing', owner:'WinnerFaction', faction:'WinnerFaction', soldiers:900, morale:72, loyalty:66, commander:'GeneralA', state:'garrison' },
    { id:'def2', name:'DefendWing', owner:'LoserFaction', faction:'LoserFaction', soldiers:1100, morale:68, loyalty:61, commander:'GeneralB', state:'garrison' }
  ],
  cities: [],
  provinceStats: {},
  chars: [
    { name:'GeneralA', party:'PartyA', alive:true },
    { name:'GeneralB', party:'PartyB', alive:true }
  ],
  partyState: {
    PartyA: { influence: 40, cohesion: 60, historyLog: [] },
    PartyB: { influence: 50, cohesion: 55, historyLog: [] }
  },
  facs: [],
  _turnReport: []
};
let br2 = MS.applyBattleResult({
  battleId:'br2',
  winnerFactionId:'WinnerFaction',
  loserFactionId:'LoserFaction',
  occupiedCityIds:[],
  casualties:{ attacker:120, defender:240 },
  affectedArmies:[
    { armyId:'atk2', side:'attacker', loss:120, moraleDelta:4, loyaltyDelta:2, commanderFate:{ name:'GeneralA', outcome:'survived' } },
    { armyId:'def2', side:'defender', loss:240, moraleDelta:-10, loyaltyDelta:-8, state:'routed', commanderFate:{ name:'GeneralB', outcome:'captured' } }
  ]
}, context.GM);
check(br2.ok, 'applyBattleResult affectedArmies path failed');
checkEq(br2.result.affectedArmies.length, 2, 'affectedArmies summary missing');
checkEq(context.GM.armies[0].soldiers, 780, 'affectedArmies attacker casualty failed');
checkEq(context.GM.armies[1].soldiers, 860, 'affectedArmies defender casualty failed');
check(context.GM.armies[1].state === 'routed' || context.GM.armies[1].routed === true, 'affectedArmies defender state failed');
checkEq(context.GM.chars[1].capturedBy, 'WinnerFaction', 'affectedArmies commander fate capture failed');
check(context.GM.chars[1].lastInteractionMemory && context.GM.chars[1].lastInteractionMemory.source === 'battleResult', 'battle memory sync failed');
check(context.GM.chars[1].recognitionState && context.GM.chars[1].recognitionState.familiarity > 0, 'battle recognition sync failed');
check(context.GM.partyState.PartyA.influence > 40, 'winner party influence should rise');
check(context.GM.partyState.PartyB.influence < 50, 'loser party influence should fall');
check(context.GM.partyState.PartyA.historyLog.length === 1 && context.GM.partyState.PartyB.historyLog.length === 1, 'party history logs should record battle');
check(context.GM.partyState.PartyB.cohesion < 55, 'loser party cohesion should fall');
check(context.GM.battleHistory.length === 1, 'battle history should record affectedArmies battle');

let migChar = {
  name:'MigratingStar',
  party:'PartyMigrating',
  faction:'Han',
  officialTitle:'OfficeA',
  _memory:[{ turn: 21, event:'secret military talk', emotion:'tense', importance: 8, who:'Zhao', type:'dialogue', source:'witnessed', summary:'secret military talk with Zhao' }]
};
context.GM = { turn: 24, chars: [migChar], armies: [], facs: [] };
let mig = context.EngineMigration.run(context.GM);
check(mig && mig.version === 2, 'engine migration version should advance to 2');
check(mig.applied.indexOf('phase6-char-refs-memory') >= 0, 'engine migration should apply char refs memory migration');
check(context.GM.chars[0].lastInteractionMemory && context.GM.chars[0].lastInteractionMemory.event.indexOf('secret military talk') >= 0, 'migration should backfill lastInteractionMemory');
check(context.GM.chars[0].recognitionState && context.GM.chars[0].recognitionState.familiarity > 0, 'migration should backfill recognitionState');
let refs = context.RelGraph.syncCharRefs(context.GM.chars[0], context.GM);
check(Array.isArray(refs) && refs.length >= 3, 'RelGraph syncCharRefs should bind party faction office');
check(context.GM.relGraph && Array.isArray(context.GM.relGraph.edges) && context.GM.relGraph.edges.length >= 3, 'RelGraph edges should exist after sync');
let aiCtx = context.CharFullSchema.toAIContext(context.GM.chars[0]) || '';
check(aiCtx.indexOf('secret military talk') >= 0, 'toAIContext should include recent interaction');
check(context.CharFullSchema.describeRecognitionState(context.GM.chars[0].recognitionState).length > 0, 'toAIContext should include recognition state inputs');

let viaEngine = context.BattleEngine.resolve({}, {}, {
  battleResult: { winnerFactionId:'A', loserFactionId:'B', occupiedCityIds:[], casualties:{} },
  root: context.GM
});
check(viaEngine && viaEngine.structured === true, 'BattleEngine structured verdict path failed');

checkEq(context.TM_AI_SCHEMA.toKnownFields('turn-full').battleResult, 'object', 'schema battleResult type missing');
check(context.TM_AI_SCHEMA.toRequiredSubfields().battleResult.indexOf('winnerFactionId') >= 0, 'schema battleResult required field missing');
let validOut = context.TM.validateAIOutput({ battleResult:{ winnerFactionId:'A', loserFactionId:'B' } }, 'military-smoke', 'turn-full');
check(validOut && validOut.ok, 'validator should accept valid battleResult');
let invalidOut = context.TM.validateAIOutput({ battleResult:{ winnerFactionId:'A' } }, 'military-smoke-missing', 'turn-full');
check(invalidOut && invalidOut.warnings.some(w => w.indexOf('battleResult.loserFactionId') >= 0), 'validator should warn on missing battleResult loser');

context.GM = {
  turn: 30,
  engineConstants: tang,
  armies: [{ id:'aa', name:'AA', soldiers:500 }, { id:'dd', name:'DD', soldiers:600 }],
  cities: [{ id:'xian', owner:'Old' }],
  chars: [{ name:'Cmd', alive:true }],
  facs: [],
  _turnReport: []
};
let app = context.AIChangeApplier.applyAITurnChanges({
  battleResult:{
    battleId:'applier_br',
    winnerFactionId:'Winner2',
    loserFactionId:'Loser2',
    occupiedCityIds:['xian'],
    casualties:{ attacker:50, defender:60 },
    attackerArmyId:'aa',
    defenderArmyId:'dd',
    commanderFate:{ name:'Cmd', outcome:'killed' },
    postBattleEffects:[]
  }
});
check(app && app.ok && app.applied.semantic.battleResult === 1, 'applier battleResult semantic count missing');
checkEq(context.GM.cities[0].owner, 'Winner2', 'applier battleResult city writeback failed');
checkEq(context.GM.armies[0].soldiers, 450, 'applier battleResult attacker casualty failed');
checkEq(context.GM.chars[0].alive, false, 'applier battleResult commander death failed');

context.GM = {
  turn: 31,
  engineConstants: tang,
  armies: [],
  cities: [],
  chars: [],
  facs: [],
  _turnReport: []
};
context.AIChangeApplier.applyAITurnChanges({
  shilu_text:'\u6b64\u6218\u9635\u4ea1\u4e09\u5343\u5175\u3002',
  battleResult:{
    battleId:'validator_br',
    winnerFactionId:'A',
    loserFactionId:'B',
    occupiedCityIds:[],
    casualties:{ attacker:1000, defender:2000 },
    postBattleEffects:[]
  }
});
check(!context.GM._militaryValidatorLog, 'battleResult casualties should satisfy military consistency validator');

console.log('[smoke-military-systems] pass assertions=' + assertions);
