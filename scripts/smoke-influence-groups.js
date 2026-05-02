#!/usr/bin/env node
// smoke-influence-groups.js - regression checks for influence group state.

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
  GM: { turn: 1 },
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

function assertEq(actual, expected, msg) {
  assert(actual === expected, msg + ' expected=' + expected + ' actual=' + actual);
}

const N = {
  eunuch: '\u5ba6\u5b98',
  waiqi: '\u5916\u621a',
  consort: '\u540e\u5bab',
  yan: '\u9609\u515a',
  wei: '\u9b4f\u5fe0\u8d24',
  wang: '\u738b\u627f\u6069',
  cao: '\u66f9\u5316\u6df3',
  zhouQueen: '\u5468\u7687\u540e',
  zhouKui: '\u5468\u594e',
  sijian: '\u53f8\u793c\u76d1\u79c9\u7b14\u592a\u76d1',
  dongchang: '\u4e1c\u5382\u63d0\u7763\u592a\u76d1',
  queenTitle: '\u7687\u540e',
  chengen: '\u627f\u6069\u516c'
};

load('tm-engine-constants.js');
load('tm-influence-groups.js');
load('tm-corruption-engine.js');
load('tm-ai-schema.js');
load('tm-ai-output-validator.js');
load('tm-ai-change-applier.js');

const EC = context.TM.EngineConstants;
const IG = context.TM.InfluenceGroups;

assert(EC && IG, 'influence group APIs must be mounted on TM');
assert(context.InfluenceGroups === IG, 'InfluenceGroups global alias missing');
assert(IG.currentVersion === 1, 'influence group version mismatch');
assert(EC.read('influenceGroupCatalog', { engineConstants: {} }) === undefined, 'empty constants must not invent influenceGroupCatalog');
assert(context.TM_AI_SCHEMA && context.TM_AI_SCHEMA.toKnownFields('turn-full').regent_decisions === 'array', 'schema should know regent_decisions');
assert((context.TM_AI_SCHEMA.toRequiredSubfields().regent_decisions || []).indexOf('action') >= 0, 'schema should require regent decision action');
const regentValidation = context.TM.validateAIOutput({ regent_decisions: [{ action: 'appoint', reason: 'smoke' }] }, 'smoke-regent');
assert(regentValidation && regentValidation.ok === true, 'validator should accept regent_decisions');
assert(typeof context._applyRegentDecisions === 'function', 'regent decision applier should be exposed');

const templateProbe = {};
EC.applyTemplate(templateProbe, 'ming');
assert(templateProbe.engineConstants.influenceGroupCatalog, 'template missing influenceGroupCatalog');
assert(templateProbe.engineConstants.influenceGroupCatalog.eunuch.influenceBaseline === 30, 'eunuch baseline mismatch');
assert(templateProbe.engineConstants.influenceGroupCatalog.consort.influenceBaseline === 20, 'consort baseline mismatch');
assert(templateProbe.engineConstants.influenceGroupAiClamp === 0.3, 'influence group clamp missing');
assert(templateProbe.engineConstants.regentTriggerAgeMin === 14, 'regent trigger age missing');
assert(templateProbe.engineConstants.regentTriggerHealthMax === 30, 'regent trigger health missing');
assert(templateProbe.engineConstants.tinyiSealBlock.eunuchSealBonus === 0.15, 'eunuch seal bonus missing');
assert(EC.getTemplate('han').influenceGroupCatalog.eunuch.keyOffices.indexOf('\u4e2d\u5e38\u4f8d') >= 0, 'han catalog should use Han eunuch offices');
assert(EC.getTemplate('tang').influenceGroupCatalog.eunuch.keyOffices.indexOf('\u795e\u7b56\u519b\u4e2d\u5c09') >= 0, 'tang catalog should use Shence Army office');
assert(EC.getTemplate('ming').influenceGroupCatalog.eunuch.keyOffices.indexOf('\u4e1c\u5382\u63d0\u7763') >= 0, 'ming catalog should use Ming eunuch offices');
assert(EC.getTemplate('qing').influenceGroupCatalog.eunuch.keyOffices.indexOf('\u517b\u5fc3\u6bbf\u9996\u9886') >= 0, 'qing catalog should use Qing eunuch offices');

const root = {
  turn: 7,
  chars: [
    { name: N.wei, officialTitle: N.sijian, occupation: N.eunuch, influence: 88, alive: true },
    { name: N.wang, officialTitle: '\u53f8\u793c\u76d1\u592a\u76d1', occupation: N.eunuch, influence: 40, alive: true },
    { name: N.zhouQueen, title: N.queenTitle, gender: '\u5973', isRoyal: true, spouseRank: 'empress', influence: 55, alive: true },
    { name: N.zhouKui, officialTitle: N.chengen, royalRelation: 'empress_family', influence: 36, alive: true },
    { name: '\u666e\u901a\u5b98', officialTitle: '\u6237\u90e8\u4e3b\u4e8b', influence: 20, alive: true }
  ]
};
EC.applyTemplate(root, 'ming');
const boot = IG.bootstrap(root, { turn: 7, source: 'smoke' });
assert(boot.ok === true, 'bootstrap should succeed');
assert(boot.groups === 3, 'bootstrap should create three group states');
assert(root.chars.every(ch => typeof ch.health === 'number'), 'bootstrap should default character health');
assert(root.chars[0].health === 80, 'default health should be 80');

const eunuch = root.influenceGroupState[N.eunuch];
assert(eunuch && eunuch.type === 'eunuch', 'eunuch group missing');
assert(eunuch.members.indexOf(N.wei) >= 0 && eunuch.members.indexOf(N.wang) >= 0, 'eunuch members mismatch');
assert(eunuch.leader === N.wei, 'eunuch leader should be highest-score member');
assert(eunuch.officeCount >= 1, 'eunuch officeCount should detect key offices');
assert(eunuch.influence >= 30, 'eunuch influence should start at baseline or above');
assert(IG.describeInfluence(eunuch.influence), 'describeInfluence should return a tier');

const consort = root.influenceGroupState[N.consort];
assert(consort && consort.members.indexOf(N.zhouQueen) >= 0, 'consort group should include queen');
assert(consort.leader === N.zhouQueen, 'consort leader mismatch');

const waiqi = root.influenceGroupState[N.waiqi];
assert(waiqi && waiqi.members.indexOf(N.zhouKui) >= 0, 'waiqi group should include empress family');
assert(waiqi.officeCount >= 1, 'waiqi officeCount should detect key title');

const tangCatalog = EC.getTemplate('tang').influenceGroupCatalog;
const maleMirror = IG.classifyChar({ name: '\u6768\u56fd\u5fe0', title: '\u8d35\u5983\u5144', officialTitle: '\u53f3\u76f8', gender: '\u7537', royalRelation: 'consort_family' }, tangCatalog);
assert(maleMirror.indexOf('waiqi') >= 0, 'male consort-family mirror should classify as waiqi');
assert(maleMirror.indexOf('consort') < 0, 'male consort-family mirror must not classify as consort');
const femaleConsort = IG.classifyChar({ name: '\u6768\u8d35\u5983', title: '\u8d35\u5983', gender: '\u5973', spouseRank: 'consort', royalRelation: 'consort' }, tangCatalog);
assert(femaleConsort.indexOf('consort') >= 0, 'female consort should classify as consort');
assert(femaleConsort.indexOf('waiqi') < 0, 'female consort should be excluded from waiqi');
const rulerExcluded = IG.classifyChar({ name: '\u5c11\u5e1d', title: '\u7687\u5e1d', gender: '\u7537', royalRelation: 'emperor_family' }, tangCatalog);
assert(rulerExcluded.indexOf('waiqi') < 0, 'emperor-like ruler should be excluded from waiqi');
const playerRulerExcluded = IG.classifyChar({ name: 'player-ruler', isPlayer: true, royalRelation: 'emperor_family', role: 'monarch', gender: '\u7537' }, tangCatalog);
assert(playerRulerExcluded.indexOf('waiqi') < 0, 'player royalRelation emperor_family should be excluded from waiqi');
const babyPrince = IG.classifyChar({ name: 'baby-prince', isPlayer: false, royalRelation: 'emperor_family', role: 'prince', gender: '\u7537', age: 0 }, tangCatalog);
assert(babyPrince.indexOf('waiqi') < 0, 'non-player emperor_family prince should not classify as waiqi');

const childRegentRoot = { turn: 2, playerInfo: { playerRole: 'minister' }, chars: [{ name: '\u5c11\u5e1d', title: '\u7687\u5e1d', isEmperor: true, age: 8, health: 80 }] };
EC.applyTemplate(childRegentRoot, 'ming');
const childSignal = IG.buildRegentSignal(childRegentRoot);
assert(childSignal.active === true && childSignal.hardCeiling === true, 'young ruler should trigger hard regent signal');
const adultRoot = { turn: 2, playerInfo: { playerRole: 'minister' }, chars: [{ name: '\u5929\u5b50', title: '\u7687\u5e1d', isEmperor: true, age: 30, health: 80 }] };
EC.applyTemplate(adultRoot, 'ming');
const adultSignal = IG.buildRegentSignal(adultRoot);
assert(adultSignal.active === false && adultSignal.hardCeiling === false, 'early turn alone should not trigger regent signal');
const sickRoot = { turn: 9, playerInfo: { playerRole: 'minister' }, chars: [{ name: '\u75c5\u5e1d', title: '\u7687\u5e1d', isEmperor: true, age: 24, health: 20 }] };
EC.applyTemplate(sickRoot, 'qing');
const sickSignal = IG.buildRegentSignal(sickRoot);
assert(sickSignal.active === true && sickSignal.hardCeiling === false, 'sick ruler should trigger soft regent signal after opening turns');
const resourceHealthRoot = { turn: 8, playerInfo: { playerRole: 'minister' }, chars: [{ name: 'resource-health-ruler', title: '\u7687\u5e1d', isEmperor: true, age: 24, resources: { health: 20 } }] };
EC.applyTemplate(resourceHealthRoot, 'ming');
const resourceHealthSignal = IG.buildRegentSignal(resourceHealthRoot);
assert(resourceHealthSignal.active === true && resourceHealthSignal.rulerHealth === 20, 'regent signal should read resources.health');
const staleRegentRoot = { turn: 6, regentState: { active: true, hardCeiling: true, signal: null } };
context._applyRegentDecisions(staleRegentRoot, { regent_decisions: [] });
assert(staleRegentRoot.regentState.active === false, 'empty regent signal should clear stale active state');
assert(staleRegentRoot.regentState.hardCeiling === false, 'empty regent signal should clear stale hard ceiling');
assert(staleRegentRoot.regentState.lastDecisionTurn === 6, 'regent inactive sync should stamp current turn');

const declared = {
  turn: 8,
  influenceGroups: [{
    name: N.yan,
    type: 'eunuch',
    leader: N.wei,
    members: [N.wei],
    initialInfluence: 75,
    initialCohesion: 62,
    keyOffices: [N.dongchang]
  }],
  chars: [
    { name: N.wei, officialTitle: N.sijian, occupation: N.eunuch, influence: 90 },
    { name: N.cao, officialTitle: '\u53f8\u793c\u76d1\u592a\u76d1', occupation: N.eunuch, influence: 35 }
  ]
};
EC.applyTemplate(declared, 'ming');
const declaredBoot = IG.bootstrap(declared, { turn: 8, source: 'smoke' });
assert(declaredBoot.explicitGroups === 1, 'declared group should be counted');
assert(declared.influenceGroupState[N.yan], 'declared group state missing');
assert(!declared.influenceGroupState[N.eunuch], 'explicit eunuch group should own auto eunuch members');
assert(declared.influenceGroupState[N.yan].influence === 75, 'declared influence should be preserved');
assert(declared.influenceGroupState[N.yan].cohesion === 62, 'declared cohesion should be preserved');
assert(declared.influenceGroupState[N.yan].members.indexOf(N.cao) >= 0, 'declared group should absorb auto members of same type');
declared.influenceGroupState[N.yan].influence = 85;
declared.influenceGroupState[N.yan].cohesion = 41;
declared.influenceGroupState[N.yan].members.push('runtime-added');
declared.influenceGroupState[N.yan].keyOffices.push('runtime-office');
IG.bootstrap(declared, { turn: 9, source: 'reload-smoke' });
assert(declared.influenceGroupState[N.yan].influence === 85, 'declared group reload must preserve runtime influence');
assert(declared.influenceGroupState[N.yan].cohesion === 41, 'declared group reload must preserve runtime cohesion');
assert(declared.influenceGroupState[N.yan].members.indexOf('runtime-added') >= 0, 'declared group reload must preserve runtime members');
assert(declared.influenceGroupState[N.yan].keyOffices.indexOf('runtime-office') >= 0, 'declared group reload must preserve runtime key offices');

const typoDeclared = { influenceGroups: [{ name: 'typo-check', type: 'eunuch', initialInfluence: 50, initialCohesion: 62, initialCohion: 11 }], chars: [] };
EC.applyTemplate(typoDeclared, 'ming');
IG.bootstrap(typoDeclared, { source: 'typo-smoke' });
assert(typoDeclared.influenceGroupState['typo-check'].cohesion === 62, 'initialCohesion should win over legacy typo initialCohion');

const clamp = IG.clampInfluenceDelta(declared, 10, 99);
assert(clamp === 3, 'AI influence clamp should be 30% of baseline delta');
const changed = IG.applyInfluenceChange(declared, N.yan, { baselineDelta: 10, aiDelta: 99, cohesionDelta: -2, reason: 'smoke' }, { turn: 8 });
assert(changed.ok === true, 'applyInfluenceChange should succeed');
assert(changed.aiDelta === 3, 'applyInfluenceChange should report clamped ai delta');
assert(changed.after === 98, 'applyInfluenceChange influence result mismatch');
assert(declared.influenceGroupState[N.yan].cohesion === 39, 'applyInfluenceChange cohesion result mismatch');
assert(declared.influenceGroupState[N.yan].historyLog.length === 1, 'applyInfluenceChange should log history');
const beforeInvalidInfluence = declared.influenceGroupState[N.yan].influence;
const invalidBase = IG.applyInfluenceChange(declared, N.yan, { baselineDelta: Infinity, aiDelta: 0 }, { turn: 8 });
assert(invalidBase.ok === false && invalidBase.reason === 'invalid-delta', 'applyInfluenceChange should reject infinite baseline delta');
const invalidAi = IG.applyInfluenceChange(declared, N.yan, { baselineDelta: 1, aiDelta: Infinity }, { turn: 8 });
assert(invalidAi.ok === false && invalidAi.reason === 'invalid-delta', 'applyInfluenceChange should reject infinite AI delta');
const invalidCohesion = IG.applyInfluenceChange(declared, N.yan, { baselineDelta: 1, cohesionDelta: Infinity }, { turn: 8 });
assert(invalidCohesion.ok === false && invalidCohesion.reason === 'invalid-delta', 'applyInfluenceChange should reject infinite cohesion delta');
assert(declared.influenceGroupState[N.yan].influence === beforeInvalidInfluence, 'invalid influence change must not mutate influence');

const legacy = {
  turn: 9,
  chars: [{ name: N.wei, officialTitle: N.sijian, occupation: N.eunuch, influence: 80 }]
};
const legacyBoot = IG.bootstrap(legacy, { turn: 9, source: 'legacy-smoke' });
assert(legacyBoot.groups === 1, 'legacy fallback should classify without engineConstants');
assert(legacy.influenceGroupState[N.eunuch].members[0] === N.wei, 'legacy fallback member mismatch');

assert(IG.getGroup(declared, N.yan).name === N.yan, 'getGroup should return existing group');
assert(IG.classifyChar({ name: N.zhouQueen, title: N.queenTitle, gender: '\u5973', isRoyal: true }, IG.getCatalog(root)).indexOf('consort') >= 0, 'classifyChar should detect consort');

const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const constantsPos = indexHtml.indexOf('tm-engine-constants.js');
const influencePos = indexHtml.indexOf('tm-influence-groups.js?v=2026050202');
const inferPos = indexHtml.indexOf('tm-endturn-ai-infer.js');
assert(influencePos >= 0, 'index.html missing tm-influence-groups.js');
assert(constantsPos >= 0 && constantsPos < influencePos, 'influence groups must load after engine constants');
assert(inferPos >= 0 && influencePos < inferPos, 'influence groups should load before endturn infer');

const loopText = fs.readFileSync(path.join(ROOT, 'tm-game-loop.js'), 'utf8');
assert(loopText.indexOf('TM.InfluenceGroups.bootstrap') >= 0, 'game loop missing influence group bootstrap');

assert(context.CorruptionEngine && context.CorruptionEngine.Sources, 'CorruptionEngine sources missing');
context.GM = {
  influenceGroupState: {
    [N.yan]: { type: 'eunuch', influence: 85, cohesion: 70, keyOffices: [N.sijian] }
  },
  chars: [{ name: 'legacy-favorite', influence: 95, integrity: 5, isImperialFavorite: true }]
};
assert(context.CorruptionEngine.Sources.innerCircle() === 15, 'innerCircle should prefer influenceGroupState contribution');
context.GM = { chars: [{ name: 'legacy-favorite', influence: 90, integrity: 10, isImperialFavorite: true }] };
assert(context.CorruptionEngine.Sources.innerCircle() === 6, 'innerCircle legacy fallback mismatch');

const tinyiText = fs.readFileSync(path.join(ROOT, 'tm-tinyi-v3.js'), 'utf8');
const sealStart = tinyiText.indexOf('function _ty3_phase6_influenceGroupSealBonus');
const sealEnd = tinyiText.indexOf('function _ty3_pushChronicle', sealStart);
assert(sealStart >= 0 && sealEnd > sealStart, 'tinyi seal influence helper missing');
const sealCode = tinyiText.slice(sealStart, sealEnd);
const sealContext = {
  GM: { influenceGroupState: {} },
  window: {},
  TM: { InfluenceGroups: { getCatalog: function() { return { eunuch: { keyOffices: ['\u795e\u7b56\u519b\u4e2d\u5c09'] } }; } } },
  _ty3_readEngineConstant: function(pathName, fallback) {
    if (pathName === 'tinyiSealBlock') return { base: 0, officeControlBonus: 0.16, eunuchSealBonus: 0.2, mingMultiplier: 1, qingMultiplier: 1 };
    return fallback;
  },
  _ty3_partyCohesion: function() { return 50; }
};
sealContext.window = sealContext;
const adjustBlockProb = vm.runInNewContext(sealCode + '\n_ty3_phase6_adjustBlockProb;', sealContext);
assert(Math.abs(adjustBlockProb(0.2, N.yan, 'default', false) - 0.2) < 1e-9, 'seal block should not change without influence groups');
sealContext.GM.influenceGroupState[N.yan] = { type: 'eunuch', influence: 80, keyOffices: ['\u795e\u7b56\u519b\u4e2d\u5c09'] };
assert(Math.abs(adjustBlockProb(0.2, N.yan, 'default', false) - 0.4) < 1e-9, 'seal block should use configured eunuchSealBonus');
sealContext.GM.influenceGroupState[N.yan].influence = 50;
assert(Math.abs(adjustBlockProb(0.2, N.yan, 'default', false) - 0.2) < 1e-9, 'low influence eunuch group should not affect seal block');

context.GM = {
  engineConstants: EC.getTemplate('tang'),
  influenceGroupState: {
    'tang-inner': { type: 'eunuch', influence: 80, cohesion: 50, keyOffices: ['\u795e\u7b56\u519b\u4e2d\u5c09'] }
  },
  chars: []
};
assert(Math.abs(context.CorruptionEngine.Sources.innerCircle() - 11) < 1e-9, 'innerCircle should use dynasty catalog key office bonus');

const evoRoot = {
  turn: 30,
  engineConstants: { influenceGroupSplinterCohesionMax: 10 },
  partyState: {},
  chars: [
    { name: 'consort-leader', title: N.queenTitle, gender: '\u5973', alive: false },
    { name: 'consort-aide', title: '\u8d35\u5983', gender: '\u5973', alive: true },
    { name: 'waiqi-leader', officialTitle: N.chengen, royalRelation: 'empress_family', alive: false },
    { name: 'waiqi-aide', officialTitle: N.chengen, royalRelation: 'empress_family', alive: true },
    { name: 'eunuch-leader', officialTitle: N.sijian, occupation: N.eunuch, influence: 90, alive: false },
    { name: 'eunuch-heir', officialTitle: N.dongchang, occupation: N.eunuch, influence: 72, alive: true },
    { name: 'spent-leader', officialTitle: N.sijian, occupation: N.eunuch, alive: false },
    { name: 'split-a', officialTitle: N.sijian, occupation: N.eunuch, influence: 60, alive: true },
    { name: 'split-b', officialTitle: N.dongchang, occupation: N.eunuch, influence: 55, alive: true },
    { name: 'split-c', officialTitle: '\u53f8\u793c\u76d1\u592a\u76d1', occupation: N.eunuch, influence: 52, alive: true },
    { name: 'split-d', officialTitle: '\u5185\u4f8d', occupation: N.eunuch, influence: 48, alive: true }
  ],
  influenceGroupState: {
    'consort-evo': { name: 'consort-evo', type: 'consort', leader: 'consort-leader', members: ['consort-leader', 'consort-aide'], influence: 80, cohesion: 60, keyOffices: [], historyLog: [] },
    'waiqi-evo': { name: 'waiqi-evo', type: 'waiqi', leader: 'waiqi-leader', members: ['waiqi-leader', 'waiqi-aide'], influence: 65, cohesion: 54, keyOffices: [N.chengen], historyLog: [] },
    'eunuch-evo': { name: 'eunuch-evo', type: 'eunuch', leader: 'eunuch-leader', members: ['eunuch-leader', 'eunuch-heir'], influence: 70, cohesion: 58, keyOffices: [N.dongchang], historyLog: [] },
    'extinct-evo': { name: 'extinct-evo', type: 'custom', leader: 'spent-leader', members: ['spent-leader'], influence: 45, cohesion: 44, keyOffices: [], historyLog: [] },
    'split-evo': { name: 'split-evo', type: 'eunuch', leader: 'split-a', members: ['split-a', 'split-b', 'split-c', 'split-d'], influence: 72, cohesion: 5, keyOffices: [N.sijian], historyLog: [] }
  }
};
const evoResult = IG.evolutionTick(evoRoot, { turn: 30, source: 'smoke' });
assert(evoResult.ok === true && evoResult.changed >= 4, 'evolutionTick should report changed groups');
assertEq(evoRoot.influenceGroupState['consort-evo'].status, 'dispersed', 'dead consort leader should disperse group');
assert(evoRoot.influenceGroupState['consort-evo'].influence === 40, 'consort dispersed influence should halve');
assertEq(evoRoot.influenceGroupState['waiqi-evo'].status, 'disbanded', 'dead waiqi leader should disband group');
assert(evoRoot.influenceGroupState['waiqi-evo'].influence === 35, 'waiqi disband should reduce influence by 30');
assertEq(evoRoot.influenceGroupState['eunuch-evo'].leader, 'eunuch-heir', 'dead eunuch leader should be succeeded');
assert(evoRoot.influenceGroupState['eunuch-evo'].influence === 49, 'eunuch succession should reduce influence to 70%');
assertEq(evoRoot.influenceGroupState['extinct-evo'].status, 'extinct', 'all-dead group should become extinct');
assert(evoRoot.influenceGroupState['extinct-evo'].influence === 0 && evoRoot.influenceGroupState['extinct-evo'].cohesion === 0, 'extinct group should zero influence and cohesion');
const splitChild = evoRoot.influenceGroupState['split-evo\u88c2\u652f'];
assert(splitChild && splitChild.splinterFrom === 'split-evo', 'low-cohesion strong group should splinter');
assert(splitChild.members.length === 2, 'splinter child should take half the members');
assert(evoRoot.influenceGroupState['split-evo'].members.length === 2, 'splinter parent should keep half the members');
assert(Object.keys(evoRoot.partyState).length === 0, 'influence group evolution must not write partyState');

console.log('[smoke-influence-groups] pass assertions=91');
