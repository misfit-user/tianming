#!/usr/bin/env node
// scripts/smoke-faction-npc-llm-decision.js — Phase G·smoke
// 验证 schema validation + apply 副作用 (不真调 LLM·mock decision)

'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const SCN_DIR = path.resolve(ROOT, '..', 'scenarios');

function fail(msg) { throw new Error(msg); }
function assert(cond, msg) { if (!cond) fail(msg); }

function buildContext() {
  var ctx = { console: { log: function(){}, warn: function(){} },
    Math: Math, Date: Date, JSON: JSON, Object: Object, Array: Array,
    Number: Number, String: String, Boolean: Boolean, RegExp: RegExp,
    isFinite: isFinite, parseInt: parseInt, parseFloat: parseFloat, isNaN: isNaN, Set: Set,
    Promise: Promise, setTimeout: setTimeout, clearTimeout: clearTimeout };
  ctx.window = ctx; ctx.global = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  ['tm-faction-paradigm.js', 'tm-faction-personality.js', 'tm-faction-index.js',
   'tm-faction-derived-health.js', 'tm-faction-membership.js',
   'tm-faction-derived-economy.js', 'tm-faction-derived-cohesion.js', 'tm-faction-derived-strength.js',
   'tm-faction-npc-settings.js',
   'tm-faction-npc-news-bridge.js',
   'tm-faction-action-engine.js',
   'tm-faction-npc-memorial.js', 'tm-faction-npc-edict.js', 'tm-faction-npc-chaoyi.js',
   'tm-faction-npc-office.js', 'tm-faction-npc-guoku.js',
   'tm-faction-npc-llm-decision.js'].forEach(function(f){
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  });
  return ctx;
}

function loadGM(ctx, sc) {
  ctx.GM = {
    turn: 1,
    facs: (sc.factions || []).map(function(f){ return Object.assign({}, f); }),
    chars: (sc.characters || []).map(function(c){ return Object.assign({}, c, { alive: c.alive !== false }); }),
    armies: (sc.military && sc.military.initialTroops || []).map(function(a){ return Object.assign({}, a); }),
    parties: (sc.parties || []).map(function(p){ return Object.assign({}, p); }),
    factionRelations: sc.factionRelations || [],
    adminHierarchy: JSON.parse(JSON.stringify(sc.adminHierarchy || {})),
    _provinceToFaction: {}, provinceStats: {}
  };
  ctx.P = { playerInfo: sc.playerInfo || {}, conf: { npcAiPrecision: true }, ai: { key: 'fake' }, adminHierarchy: sc.adminHierarchy || {} };
  ctx.getFactionProvinces = function(n) {
    var f = ctx.GM.facs.find(function(x){ return x.name === n; });
    if (!f) return [];
    if (Array.isArray(f.territories)) return f.territories.slice();
    if (typeof f.territory === 'string') return [f.territory];
    if (Array.isArray(f.territory)) return f.territory.slice();
    return [];
  };
  ctx.TM.FactionMembership.migrateArmyOwnerToFaction();
  ctx.TM.FactionMembership.migrateCharsAddFactionId();
  ctx.TM.FactionMembership.migrateProvinceOwnership();
  ctx.TM.FactionIndex.rebuild();
  ctx.TM.FactionDerived.compute();
  ctx.TM.FactionDerivedEconomy.compute();
  ctx.TM.FactionDerivedCohesion.compute();
  ctx.TM.FactionDerivedStrength.compute();
}

function unitTests() {
  var ctx = buildContext();
  var fld = ctx.TM.FactionNpcLlmDecision;
  assert(typeof fld.decideFor === 'function', 'decideFor missing');
  assert(typeof fld.decideAll === 'function', 'decideAll missing');
  assert(typeof fld.buildFactionAiDiagnostics === 'function', 'buildFactionAiDiagnostics missing');

  // Validate·正常
  var d1 = fld._validateDecision({
    rationale: '本朝当稳·示恩。',
    memorials: [{ from: 'A', type: '政务', content: 'xx', rulerDecision: 'approved', loyaltyDelta: 2 }],
    edict: { type: '赏赐', content: 'yy', trigger: '稳定', treasuryDelta: -50000, loyaltyDeltas: { court: 3 } },
    chaoyi: { type: 'cooperate', summary: 'zz', partyImbalanceDelta: -0.05, loyaltyDeltaByParty: { '满洲': 2 } },
    office: [{ kind: 'promote', target: 'B', newPosition: '议政大臣', loyaltyDelta: 5, reason: 'rrr' }]
  });
  assert(d1, 'validate good decision');
  assert(d1.memorials.length === 1, 'memorials kept');
  assert(d1.edict, 'edict kept');
  assert(d1.chaoyi, 'chaoyi kept');
  assert(d1.office.length === 1, 'office kept');

  // Validate·bad enum 被过滤
  var d2 = fld._validateDecision({
    memorials: [{ from: 'X', type: 'INVALID', content: 'x', rulerDecision: 'approved' }],
    edict: { type: 'INVALID', content: 'x' },
    chaoyi: { type: 'INVALID' },
    office: [{ kind: 'INVALID', target: 'X' }]
  });
  assert(d2.memorials.length === 0, 'invalid memorial filtered');
  assert(d2.edict === null, 'invalid edict null');
  assert(d2.chaoyi === null, 'invalid chaoyi null');
  assert(d2.office.length === 0, 'invalid office filtered');

  console.log('[smoke-faction-npc-llm-decision] unit tests pass·9 assertions');
}

function actionSchemaAndOfficeSyncTest() {
  var ctx = buildContext();
  var fac = { name: '测试势力', treasury: { money: 300000 }, derivedHealth: { _source: { partyImbalance: 0.2 } } };
  var ruler = { name: '测试君', faction: '测试势力', position: '主君', role: 'ruler', loyalty: 60, alive: true };
  var minister = { name: '测试臣', faction: '测试势力', position: '旧职', officialTitle: '旧职', party: '清流', loyalty: 50, alive: true };
  ctx.GM = {
    turn: 7,
    facs: [fac],
    chars: [ruler, minister],
    qijuHistory: [],
    _facIndex: { '测试势力': { chars: [ruler, minister], parties: { '清流': { name: '清流' } }, metrics: {} } }
  };
  ctx.P = { conf: { npcAiPrecision: true }, ai: { key: 'fake' }, playerInfo: { factionName: '明朝廷' } };
  ctx._appointmentCalls = [];
  ctx.onAppointment = function(name, position, binding) {
    ctx._appointmentCalls.push({ name: name, position: position, binding: binding });
    var ch = ctx.GM.chars.find(function(c){ return c.name === name; });
    if (ch) ch.officialTitle = position;
    return { ok: true, treeUpdated: true };
  };

  var decision = ctx.TM.FactionNpcLlmDecision._validateDecision({
    rationale: '测试君衡量内外，先行整饬朝班。',
    memorials: [{ from: '测试臣', type: '人事', content: '臣请整饬官箴。', rulerDecision: 'approved', loyaltyDelta: 1 }],
    edict: { type: '赏赐', content: '赐群臣银，以固人心。', trigger: '稳定', treasuryDelta: -10000, loyaltyDeltas: { court: 1 } },
    chaoyi: { type: 'cooperate', summary: '清流暂与主君相和。', partyImbalanceDelta: -0.05, loyaltyDeltaByParty: { '清流': 2 } },
    office: [{ kind: 'promote', target: '测试臣', newPosition: '议政大臣', loyaltyDelta: 3, reason: '才堪任事' }]
  });

  var actions = ctx.TM.FactionNpcLlmDecision._normalizeDecisionActions(fac, decision);
  assert(Array.isArray(actions), 'normalized actions should be array');
  assert(actions.map(function(a){ return a.type; }).join('|') === 'memorial|edict|court_alignment|office_change', 'decision should normalize into canonical action types');
  assert(actions.every(function(a){ return a.decisionId && a.actionId; }), 'actions should carry decision/action ids');

  var summary = ctx.TM.FactionNpcLlmDecision._applyDecision(fac, decision);
  assert(summary.actions === 4, 'summary should report applied action count');
  assert(ctx._appointmentCalls.length === 1, 'office change should use onAppointment hook when available');
  assert(ctx._appointmentCalls[0].position === '议政大臣', 'onAppointment receives target office title');
  assert(minister.position === '议政大臣', 'character position still syncs for old UI');
  assert(minister.officialTitle === '议政大臣', 'officialTitle should sync through appointment hook');
  assert(Array.isArray(fac._npcLlmActionLedger) && fac._npcLlmActionLedger.length === 4, 'faction should keep normalized LLM action ledger');
  assert(fac.npcOfficeActions[fac.npcOfficeActions.length - 1]._actionType === 'office_change', 'office trajectory should be tagged with canonical action type');
  console.log('[action-schema] normalization and office sync assertions pass');
}

function nativeExpandedActionsTest() {
  var ctx = buildContext();
  var ming = { name: '明朝廷', territories: ['辽东'] };
  var hj = { name: '后金', territories: [] };
  ctx.GM = {
    turn: 8,
    facs: [ming, hj],
    chars: [{ name: '袁崇焕', faction: '明朝廷', alive: true }],
    armies: [{ name: '关宁军', faction: '明朝廷', commander: '旧帅', soldiers: 30000 }],
    factionRelations: [{ from: '明朝廷', to: '后金', type: '敌对', value: -60, desc: '辽东交兵' }],
    provinceStats: { '辽东': { owner: '明朝廷', minxinLocal: 45, corruptionLocal: 30 } },
    _provinceToFaction: { '辽东': '明朝廷' },
    qijuHistory: [],
    _facIndex: { '明朝廷': { chars: [{ name: '袁崇焕', faction: '明朝廷', alive: true }], parties: {}, metrics: {} } }
  };
  ctx.P = { conf: { npcAiPrecision: true }, ai: { key: 'fake' }, playerInfo: { factionName: '玩家外部势力' } };

  var decision = ctx.TM.FactionNpcLlmDecision._validateDecision({
    rationale: '边事急，先易将、绝盟、割据辽东。',
    actions: [
      { type: 'military_order', army: '关宁军', order: 'change_commander', commander: '袁崇焕', reason: '辽事专任' },
      { type: 'diplomacy', targetFaction: '后金', relationDelta: -20, relationType: '敌对加深', reason: '边衅再起' },
      { type: 'province_policy', province: '辽东', policy: 'transfer_owner', ownerFaction: '后金', reason: '战线失守' }
    ]
  });
  var actions = ctx.TM.FactionNpcLlmDecision._normalizeDecisionActions(ming, decision);
  assert(actions.map(function(a){ return a.type; }).join('|') === 'military_order|diplomacy|province_policy', 'native expanded actions should normalize');
  assert(actions.every(function(a){ return a.source === 'native'; }), 'expanded actions should be tagged native');

  var summary = ctx.TM.FactionNpcLlmDecision._applyDecision(ming, decision);
  assert(summary.actions === 3, 'expanded native actions should apply');
  assert(ctx.GM.armies[0].commander === '袁崇焕', 'military_order should update commander');
  assert(ctx.GM.armies[0].general === '袁崇焕', 'military_order should sync commander aliases');
  var rel = ctx.GM.factionRelations.find(function(r){ return r.from === '明朝廷' && r.to === '后金'; });
  assert(rel && rel.value === -80, 'diplomacy should shift relation list value');
  assert(ctx.GM._provinceToFaction['辽东'] === '后金', 'province_policy should update canonical owner');
  assert(ctx.GM.provinceStats['辽东'].owner === '后金', 'province_policy should update provinceStats owner');
  assert(hj.territories.indexOf('辽东') >= 0, 'province_policy should update receiving faction territories');
  assert(Array.isArray(ming.npcMilitaryActions) && ming.npcMilitaryActions.length === 1, 'military action trajectory should be recorded');
  assert(Array.isArray(ming.npcDiplomacyActions) && ming.npcDiplomacyActions.length === 1, 'diplomacy action trajectory should be recorded');
  assert(Array.isArray(ming.npcProvincePolicies) && ming.npcProvincePolicies.length === 1, 'province policy trajectory should be recorded');
  console.log('[native-actions] expanded military/diplomacy/province assertions pass');
}

function nativeOfficeFiscalActionsTest() {
  var ctx = buildContext();
  var fac = { name: '财政测试势力', treasury: { money: 100000, grain: 50000 } };
  var minister = { name: '财政臣', faction: '财政测试势力', position: '旧职', officialTitle: '旧职', loyalty: 40, alive: true };
  ctx.GM = {
    turn: 9,
    facs: [fac],
    chars: [minister],
    qijuHistory: [],
    _facIndex: { '财政测试势力': { chars: [minister], parties: {}, metrics: {} } }
  };
  ctx.P = { conf: { npcAiPrecision: true }, ai: { key: 'fake' }, playerInfo: { factionName: '明朝廷' } };
  ctx._appointmentCalls = [];
  ctx.onAppointment = function(name, position) {
    ctx._appointmentCalls.push({ name: name, position: position });
    minister.officialTitle = position;
    return { ok: true, treeUpdated: true };
  };

  var decision = ctx.TM.FactionNpcLlmDecision._validateDecision({
    rationale: '财赋吃紧，擢臣督办。',
    actions: [
      { type: 'office_change', kind: 'promote', target: '财政臣', newPosition: '户部侍郎', loyaltyDelta: 4, reason: '督理饷务' },
      { type: 'fiscal_policy', resource: 'money', treasuryDelta: 25000, reason: '清丈补入' }
    ]
  });
  var summary = ctx.TM.FactionNpcLlmDecision._applyDecision(fac, decision);
  assert(summary.actions === 2, 'native office/fiscal actions should apply');
  assert(ctx._appointmentCalls.length === 1, 'native office_change should use appointment hook');
  assert(minister.position === '户部侍郎' && minister.officialTitle === '户部侍郎', 'native office_change should sync character office fields');
  assert(minister.loyalty === 44, 'native office_change should apply loyalty delta');
  assert(fac.treasury.money === 125000, 'native fiscal_policy should change treasury money');
  assert(Array.isArray(fac.npcOfficeActions) && fac.npcOfficeActions.length === 1, 'native office trajectory should be recorded');
  assert(Array.isArray(fac.npcFiscalActions) && fac.npcFiscalActions.length === 1, 'native fiscal trajectory should be recorded');
  console.log('[native-actions] office/fiscal assertions pass');
}

function actionEngineStrategicActionsTest() {
  var ctx = buildContext();
  assert(ctx.TM.FactionActionEngine, 'FactionActionEngine missing');
  assert(typeof ctx.TM.FactionActionEngine.validateDecision === 'function', 'engine validateDecision missing');
  assert(typeof ctx.TM.FactionActionEngine.applyDecision === 'function', 'engine applyDecision missing');
  assert(typeof ctx.TM.FactionActionEngine.scoreFactionCandidate === 'function', 'engine scoreFactionCandidate missing');
  assert(typeof ctx.TM.FactionActionEngine.getActionContract === 'function', 'engine action contract getter missing');
  assert(typeof ctx.TM.FactionActionEngine.formatActionContractForPrompt === 'function', 'engine action contract formatter missing');
  var contract = ctx.TM.FactionActionEngine.getActionContract();
  assert(contract.diplomacy && contract.diplomacy.required.indexOf('targetFaction') >= 0, 'action contract should describe diplomacy target');
  assert(ctx.TM.FactionActionEngine.formatActionContractForPrompt().indexOf('province_policy') >= 0, 'prompt contract should list province_policy');

  var fac = { name: '北镇', treasury: { money: 200000 }, derivedStrength: { value: 30 }, derivedHealth: { overall: 35, _source: { partyImbalance: 0.4 } }, aiProfile: { posture: '守势' } };
  var target = { name: '南藩', treasury: { money: 300000 }, derivedStrength: { value: 90 }, derivedHealth: { overall: 80, _source: { partyImbalance: 0.1 } } };
  var spy = { name: '密探甲', faction: '北镇', loyalty: 60, alive: true };
  ctx.GM = {
    turn: 11,
    facs: [fac, target],
    chars: [spy],
    armies: [],
    factionRelations: [],
    _npcInterventions: [{ turn: 10, targetFac: '北镇', action: 'spreadRumor' }],
    activeWars: [{ name: '北南战事', sides: ['北镇', '南藩'], status: 'active' }],
    qijuHistory: [],
    _facIndex: { '北镇': { chars: [spy], parties: {}, metrics: {} }, '南藩': { chars: [], parties: {}, metrics: {} } }
  };
  ctx.P = { conf: { npcAiPrecision: true }, ai: { key: 'fake' }, playerInfo: { factionName: '玩家朝廷' } };

  var raw = {
    rationale: '北镇受压，暗行离间并扶乱牵制南藩。',
    actions: [
      { type: 'spy_or_intrigue', targetFaction: '南藩', target: '密探甲', intrigue: 'spread_rumor', relationDelta: -12, reason: '离间其众' },
      { type: 'rebellion_policy', targetFaction: '南藩', policy: 'incite', support: 2, reason: '扰其边境' }
    ]
  };
  var decision = ctx.TM.FactionActionEngine.validateDecision(raw);
  var actions = ctx.TM.FactionActionEngine.normalizeDecisionActions(fac, decision);
  assert(actions.map(function(a){ return a.type; }).join('|') === 'spy_or_intrigue|rebellion_policy', 'engine should normalize intrigue/rebellion actions');
  var summary = ctx.TM.FactionActionEngine.applyDecision(fac, decision);
  assert(summary.actions === 2, 'engine should apply intrigue/rebellion actions');
  assert(summary.attemptedActions === 2, 'engine summary should expose attempted action count');
  assert(fac._lastLlmApplySummary && fac._lastLlmApplySummary.appliedActions === 2, 'faction should remember last apply summary for UI/debug');
  assert(Array.isArray(fac.npcIntrigueActions) && fac.npcIntrigueActions.length === 1, 'intrigue trajectory should be recorded');
  assert(Array.isArray(fac.npcRebellionPolicies) && fac.npcRebellionPolicies.length === 1, 'rebellion trajectory should be recorded');
  assert(target._rebellionPressure >= 2, 'rebellion policy should pressure target faction');
  assert(fac.aiStrategy && Array.isArray(fac.aiStrategy.goals) && fac.aiStrategy.goals.length > 0, 'engine should maintain long-term strategy memory');

  var weakButUrgent = ctx.TM.FactionActionEngine.scoreFactionCandidate(fac, { turn: 11, playerFactionNames: ['玩家朝廷'] });
  var strongQuiet = ctx.TM.FactionActionEngine.scoreFactionCandidate(target, { turn: 11, playerFactionNames: ['玩家朝廷'] });
  assert(weakButUrgent.score > strongQuiet.score, 'crisis/war/intervention should outrank raw strength');
  console.log('[action-engine] strategic actions and priority scoring assertions pass');
}

function actionEnginePreflightStrategyNewsTest() {
  var ctx = buildContext();
  var engine = ctx.TM.FactionActionEngine;
  assert(engine && typeof engine.dryRunDecision === 'function', 'engine should expose dryRunDecision');
  assert(typeof engine.validateActionTarget === 'function', 'engine should expose action target validator');

  var fac = {
    name: 'NorthCourt',
    treasury: { money: 200000, grain: 100000, cloth: 20000 },
    territories: [],
    derivedStrength: { value: 35 },
    derivedHealth: { overall: 48, _source: { partyImbalance: 0.45 } },
    derivedEconomy: { fiscalStress: 64 },
    aiProfile: { posture: 'defensive', strategicPriority: 18 }
  };
  var target = {
    name: 'SouthCamp',
    treasury: { money: 400000 },
    territories: ['Frontier'],
    derivedStrength: { value: 82 },
    derivedHealth: { overall: 80 }
  };
  var player = { name: 'PlayerRealm', isPlayer: true, territories: ['Capital'] };
  var ruler = { name: 'NorthRuler', faction: 'NorthCourt', role: 'ruler', loyalty: 80, alive: true };
  var general = { name: 'NorthGeneral', faction: 'NorthCourt', role: 'general', loyalty: 70, alive: true };
  ctx.GM = {
    turn: 12,
    facs: [fac, target, player],
    chars: [ruler, general],
    armies: [{ name: 'FrontArmy', faction: 'NorthCourt', commander: 'OldGeneral', soldiers: 12000 }],
    factionRelations: [
      { from: 'NorthCourt', to: 'PlayerRealm', type: 'hostile', value: -58, desc: 'border dispute' },
      { from: 'NorthCourt', to: 'SouthCamp', type: 'tense', value: -35, desc: 'frontier claim' }
    ],
    provinceStats: { Frontier: { owner: 'SouthCamp' } },
    _provinceToFaction: { Frontier: 'SouthCamp' },
    _facIndex: { NorthCourt: { chars: [ruler, general], parties: {}, metrics: {} }, SouthCamp: { chars: [], parties: {}, metrics: {} } },
    qijuHistory: [],
    _npcInterventions: [{ turn: 11, targetFac: 'NorthCourt', action: 'spreadRumor' }],
    activeWars: [{ sides: ['NorthCourt', 'SouthCamp'], status: 'active' }]
  };
  ctx.P = { conf: { npcAiPrecision: true }, ai: { key: 'fake' }, playerInfo: { factionName: 'PlayerRealm' } };

  var invalid = {
    rationale: 'Probe invalid targets.',
    actions: [
      { type: 'military_order', army: 'MissingArmy', commander: 'NorthGeneral', reason: 'bad army' },
      { type: 'province_policy', province: 'MissingProvince', ownerFaction: 'NorthCourt', reason: 'bad province' }
    ]
  };
  var dry = engine.dryRunDecision(fac, invalid);
  assert(dry && dry.ok === false && dry.errors.length === 2, 'dryRunDecision should reject unknown army/province before mutation');
  var skipped = engine.applyDecision(fac, invalid, { turn: 12 });
  assert(skipped.actions === 0 && skipped.skippedActions === 2, 'applyDecision should skip preflight failures');
  assert(!fac.npcMilitaryActions && ctx.GM._provinceToFaction.Frontier === 'SouthCamp', 'preflight failures should not mutate army/province state');

  var localRec = { id: 'fixed-local-office', turn: 12 };
  var localAction = engine.recordLocalAction(fac, 'office_change', { target: 'NorthGeneral' }, localRec);
  assert(localAction.actionId.indexOf('fixed-local-office') >= 0, 'local action id should use record id instead of random number');

  var valid = {
    rationale: 'Use army, diplomacy, province, intrigue and rebellion tools together.',
    actions: [
      { type: 'military_order', army: 'FrontArmy', order: 'change_commander', commander: 'NorthGeneral', reason: 'trusted general' },
      { type: 'diplomacy', targetFaction: 'SouthCamp', relationDelta: -12, relationType: 'hostile', reason: 'press claim' },
      { type: 'province_policy', province: 'Frontier', ownerFaction: 'NorthCourt', policy: 'transfer_owner', reason: 'frontier seizure' },
      { type: 'spy_or_intrigue', targetFaction: 'SouthCamp', intrigue: 'spread_rumor', relationDelta: -6, reason: 'covert pressure' },
      { type: 'rebellion_policy', targetFaction: 'SouthCamp', policy: 'incite', support: 3, reason: 'stir border rebels' }
    ]
  };
  var applied = engine.applyDecision(fac, valid, { turn: 12 });
  assert(applied.actions === 5, 'valid strategic actions should apply');
  assert(ctx.GM._npcFactionAiTurnLedger && ctx.GM._npcFactionAiTurnLedger.actions && ctx.GM._npcFactionAiTurnLedger.actions.length >= 5,
    'valid faction LLM actions should also enter unified faction AI turn ledger');
  assert(ctx.GM._npcFactionAiTurnLedger.actions.some(function(row){ return row.faction === 'NorthCourt' && row.type === 'province_policy'; }),
    'unified faction AI turn ledger should preserve faction and action type for UI/debug');
  assert(ctx.GM.armies[0].commander === 'NorthGeneral', 'military preflight should still allow valid army mutation');
  assert(ctx.GM._provinceToFaction.Frontier === 'NorthCourt', 'province policy should transfer valid province');
  assert(target._intriguePressure > 0 && target._rebellionPressure >= 3, 'intrigue and rebellion pressure should reach target faction');
  assert(fac.aiStrategy && fac.aiStrategy.version >= 2, 'strategy memory should be upgraded to v2');
  assert(Array.isArray(fac.aiStrategy.objectives) && fac.aiStrategy.objectives.length > 0, 'strategy memory should track objectives');
  assert(Array.isArray(fac.aiStrategy.threats) && fac.aiStrategy.threats.indexOf('SouthCamp') >= 0, 'strategy memory should track hostile targets');
  assert(Array.isArray(fac.aiStrategy.claims) && fac.aiStrategy.claims.indexOf('Frontier') >= 0, 'strategy memory should track province claims');
  assert(fac.aiStrategy.lastDecision && fac.aiStrategy.lastDecision.turn === 12, 'strategy memory should store last decision summary');
  assert(ctx.GM.qijuHistory.some(function(x){ return String(x.content).indexOf('FrontArmy') >= 0; }), 'military action should enter qiju news');
  assert(ctx.GM.qijuHistory.some(function(x){ return String(x.content).indexOf('SouthCamp') >= 0 && String(x.category).indexOf('间') >= 0; }), 'intrigue action should enter qiju news');

  var ranked = engine.scoreFactionCandidate(fac, { turn: 12, playerFactionNames: ['PlayerRealm'] });
  assert(ranked.reasons.join('|').indexOf('player-border') >= 0 || ranked.reasons.join('|').indexOf('player-relation') >= 0, 'candidate scoring should account for player-facing pressure');
  var targetRanked = engine.scoreFactionCandidate(target, { turn: 12, playerFactionNames: ['PlayerRealm'] });
  assert(targetRanked.reasons.join('|').indexOf('intrigue') >= 0 || targetRanked.reasons.join('|').indexOf('rebellion') >= 0, 'candidate scoring should account for covert/rebellion pressure');
  console.log('[action-engine-v2] preflight, strategy memory, news, scoring assertions pass');
}

function factionAiDiagnosticsSnapshotTest() {
  var ctx = buildContext();
  var fac = { name: 'DiagNpc', treasury: { money: 100000 }, derivedStrength: { value: 33 } };
  ctx.GM = {
    turn: 13,
    facs: [fac],
    chars: [],
    qijuHistory: [{ turn: 13, _source: 'npc-in-turn-llm', _facName: 'DiagNpc', content: 'DiagNpc 后台推演完成' }],
    _npcFactionLlmLedger: { turn: 13, runs: { DiagNpc: { status: 'applied', source: 'eager', startedAt: 1, finishedAt: 2 } }, order: ['DiagNpc'] },
    _npcFactionLlmDispatchLedger: { turn: 13, jobs: [{ source: 'eager', status: 'applied' }, { source: 'in-turn', status: 'scheduled' }] },
    _npcFactionLlmCandidateRanks: { turn: 13, rows: [{ faction: 'DiagNpc', score: 88, reasons: ['sc16-directive'] }] },
    _sc16FactionDirectives: { turn: 13, source: 'sc16', byFaction: { DiagNpc: { faction: 'DiagNpc', hasDirectContent: true, directives: [{ strategic_intent: '稳内政而窥边' }] } } }
  };
  fac._npcLlmActionLedger = [{ turn: 13, type: 'diplomacy', status: 'applied', detail: { targetFaction: 'Other' } }];
  fac._lastLlmApplySummary = { turn: 13, attemptedActions: 1, appliedActions: 1, skippedActions: 0, mergedActions: 0 };
  var snap = ctx.TM.FactionNpcLlmDecision.buildFactionAiDiagnostics('DiagNpc');
  assert(snap && snap.faction === 'DiagNpc', 'diagnostics should resolve faction');
  assert(snap.run && snap.run.status === 'applied', 'diagnostics should include run ledger');
  assert(snap.sc16Directive && snap.sc16Directive.hasDirectContent, 'diagnostics should include sc16 directive');
  assert(snap.dispatch && snap.dispatch.jobs.length === 2, 'diagnostics should include dispatch ledger');
  assert(snap.turnLedger && snap.turnLedger.turn === 13, 'diagnostics should include unified faction AI turn ledger');
  assert(snap.actionLedger.length === 1 && snap.qijuWrites.length === 1, 'diagnostics should include action ledger and qiju writes');
  assert(snap.candidateRank && snap.candidateRank.score === 88, 'diagnostics should include candidate rank row');
  console.log('[faction-ai-diagnostics] snapshot assertions pass');
}

async function llmRetryAndConcurrencyTest() {
  var ctx = buildContext();
  var fac = { name: 'RetryNpc', treasury: { money: 100000 }, derivedStrength: { value: 20 } };
  var ruler = { name: 'RetryRuler', faction: 'RetryNpc', role: 'ruler', loyalty: 70, alive: true };
  ctx.GM = { turn: 20, facs: [fac], chars: [ruler], qijuHistory: [], _facIndex: { RetryNpc: { chars: [ruler], parties: {}, metrics: {} } } };
  ctx.P = { conf: { npcAiPrecision: true, npcAiPrecisionMaxPerTurn: 3 }, ai: { key: 'fake' }, playerInfo: { factionName: 'PlayerRealm' } };
  assert(ctx.TM.FactionNpcSettings.getStatus().maxTokens >= 2400, 'precision LLM max token default should be expanded beyond the old 800-token cap');
  var prompt = ctx.TM.FactionNpcLlmDecision._buildPrompt(fac);
  var combined = prompt.system + '\n' + prompt.user;
  assert(combined.indexOf('ACTION_CONTRACT') >= 0, 'prompt should include engine action contract');
  assert(combined.indexOf('spy_or_intrigue') >= 0 && combined.indexOf('rebellion_policy') >= 0, 'prompt should advertise intrigue and rebellion actions');
  assert(combined.indexOf('0-8') >= 0, 'prompt action limit should match engine limit');

  var calls = 0;
  var tokenArgs = [];
  var tierArgs = [];
  ctx.callAI = function(promptText, maxTokens, apiKey, tier){
    calls++;
    tokenArgs.push(maxTokens);
    tierArgs.push(tier);
    if (calls === 1) return Promise.resolve('not json at all');
    return Promise.resolve(JSON.stringify({ rationale: 'retry ok', memorials: [], edict: null, chaoyi: null, office: [], actions: [] }));
  };
  var ret = await ctx.TM.FactionNpcLlmDecision.decideFor('RetryNpc', { source: 'manual' });
  assert(ret && ret.applied, 'decideFor should retry once after malformed JSON');
  assert(calls === 2, 'malformed JSON should trigger exactly one repair retry');
  assert(tokenArgs.length === 2 && tokenArgs.every(function(x){ return x >= 2400 && x > 800; }),
    'single-faction LLM should request expanded output tokens on initial call and retry');
  assert(tierArgs.every(function(x){ return x === 'secondary'; }), 'single-faction LLM should stay on secondary API tier');

  var facs = [
    { name: 'QueueA', treasury: { money: 1 }, derivedStrength: { value: 50 } },
    { name: 'QueueB', treasury: { money: 1 }, derivedStrength: { value: 40 } },
    { name: 'QueueC', treasury: { money: 1 }, derivedStrength: { value: 30 } }
  ];
  ctx.GM = { turn: 21, facs: facs, chars: [], qijuHistory: [], _facIndex: {} };
  ctx.P.conf.npcAiPrecisionMaxPerTurn = 3;
  ctx.P.conf.npcAiPrecisionConcurrency = 1;
  ctx.P.conf.npcAiPrecisionMaxTokens = 3600;
  var active = 0;
  var maxActive = 0;
  var configuredTokenArgs = [];
  ctx.callAI = function(promptText, maxTokens){
    active++;
    maxActive = Math.max(maxActive, active);
    configuredTokenArgs.push(maxTokens);
    return new Promise(function(resolve){
      setTimeout(function(){
        active--;
        resolve(JSON.stringify({ rationale: 'queued ok', memorials: [], edict: null, chaoyi: null, office: [], actions: [] }));
      }, 5);
    });
  };
  var batch = await ctx.TM.FactionNpcLlmDecision.decideAll({ source: 'eager', turn: 21 });
  assert(batch.attempted === 3 && batch.applied === 3, 'decideAll should attempt all selected factions');
  assert(maxActive === 1, 'decideAll should honor npcAiPrecisionConcurrency=1');
  assert(configuredTokenArgs.length === 3 && configuredTokenArgs.every(function(x){ return x === 3600; }),
    'single-faction LLM should honor configured npcAiPrecisionMaxTokens');
  assert(ctx.GM._npcFactionLlmCandidateRanks && ctx.GM._npcFactionLlmCandidateRanks.rows.length >= 3, 'decideAll should record candidate rank ledger');
  console.log('[llm-retry-concurrency] assertions pass');
}

function localTemplateLedgerTest() {
  var ctx = buildContext();
  var fac = {
    name: 'LocalNpc',
    treasury: { money: 500000, grain: 0, cloth: 0 },
    derivedEconomy: { annualTaxIncome: 1200000, annualMilitaryCost: 600000, fiscalStress: 30, economyHealth: 70 },
    derivedHealth: { courtCohesion: 40, personnelHealth: 20, militaryStability: 80, _source: { partyImbalance: 0.6 } },
    derivedCohesion: { ethnic: 80 },
    derivedStrength: { value: 60 }
  };
  var ruler = { name: 'Ruler', role: 'ruler', faction: 'LocalNpc', party: 'A', loyalty: 80, alive: true };
  var court = { name: 'CourtA', role: 'court', faction: 'LocalNpc', party: 'A', loyalty: 70, charisma: 75, alive: true };
  var general = { name: 'GeneralB', role: 'general', faction: 'LocalNpc', party: 'B', loyalty: 82, charisma: 78, military: 82, valor: 72, alive: true };
  var low = { name: 'LowB', role: 'general', faction: 'LocalNpc', party: 'B', loyalty: 25, charisma: 40, military: 76, valor: 66, alive: true };
  ctx.P = { playerInfo: { factionName: 'PLAYER' }, conf: { npcAiPrecision: true }, ai: { key: 'fake' } };
  ctx.GM = {
    turn: 3,
    facs: [{ name: 'PLAYER', isPlayer: true }, fac],
    chars: [ruler, court, general, low],
    _facIndex: {
      LocalNpc: {
        chars: [ruler, court, general, low],
        parties: { A: { name: 'A', memberCount: 2 }, B: { name: 'B', memberCount: 2 } },
        metrics: { charByRole: { court: 1 } }
      }
    }
  };

  ctx.TM.FactionNpcMemorial.generate();
  ctx.TM.FactionNpcEdict.generate();
  ctx.TM.FactionNpcChaoyi.generate();
  ctx.TM.FactionNpcOffice.generate();
  ctx.TM.FactionNpcGuoku.generate();

  var types = (fac._npcLlmActionLedger || []).map(function(x){ return x.type; });
  ['memorial','edict','court_alignment','office_change','fiscal_policy'].forEach(function(t) {
    assert(types.indexOf(t) >= 0, 'local template action should enter shared ledger: ' + t);
  });
  assert((fac._npcLlmActionLedger || []).every(function(x){ return x.engine === 'local-template' || x.engine === 'FactionActionEngine'; }), 'local ledger entries should identify their source engine');
  console.log('[local-template-ledger] shared ledger assertions pass');
}

async function playerIsPlayerGuardTest() {
  var ctx = buildContext();
  ctx.P = {
    playerInfo: { factionName: 'mismatched-player-name' },
    conf: { npcAiPrecision: true, npcAiPrecisionMaxPerTurn: 8 },
    ai: { key: 'fake' }
  };
  ctx.GM = {
    turn: 5,
    facs: [
      { name: 'PlayerMarked', isPlayer: true, derivedStrength: { value: 999 }, treasury: { money: 1000000 } },
      { name: 'NpcNeighbor', derivedStrength: { value: 10 }, treasury: { money: 1000000 } }
    ],
    chars: [],
    qijuHistory: []
  };
  ctx.callAI = function(){
    return Promise.resolve(JSON.stringify({ rationale: 'mock npc move', memorials: [], edict: null, chaoyi: null, office: [] }));
  };
  var fld = ctx.TM.FactionNpcLlmDecision;
  var direct = await fld.decideFor('PlayerMarked');
  assert(direct && direct.skipped && direct.reason === 'player faction', 'decideFor must skip fac.isPlayer even when player faction name mismatches');
  var batch = await fld.decideAll({ source: 'eager' });
  assert(batch.results.every(function(r){ return r.fac !== 'PlayerMarked'; }), 'decideAll must exclude fac.isPlayer even when player faction name mismatches');
  assert(!ctx.GM.facs[0]._lastLlmRationale, 'isPlayer faction should not receive LLM trajectory');

  ctx.P.playerInfo.factionName = '';
  ctx.GM.playerFaction = 'PlayerByGM';
  ctx.GM.facs = [
    { name: 'PlayerByGM', derivedStrength: { value: 999 }, treasury: { money: 1000000 } },
    { name: 'NpcByGMNeighbor', derivedStrength: { value: 10 }, treasury: { money: 1000000 } }
  ];
  ctx.GM._npcFactionLlmLedger = null;
  var gmDirect = await fld.decideFor('PlayerByGM');
  assert(gmDirect && gmDirect.skipped && gmDirect.reason === 'player faction', 'decideFor must skip GM.playerFaction even without fac.isPlayer');
  var gmBatch = await fld.decideAll({ source: 'eager', turn: 6 });
  assert(gmBatch.results.every(function(r){ return r.fac !== 'PlayerByGM'; }), 'decideAll must exclude GM.playerFaction even without fac.isPlayer');
  console.log('[player-isPlayer-guard] assertions pass');
}

function e2eApplyMockDecision() {
  var ctx = buildContext();
  var sc = JSON.parse(fs.readFileSync(path.join(SCN_DIR, '天启七年·九月（官方）.json'), 'utf8'));
  loadGM(ctx, sc);

  var hj = ctx.GM.facs.find(function(f){ return f.name === '后金'; });
  var hjChars = ctx.GM._facIndex['后金'].chars.filter(function(c){ return c.alive !== false; });
  var amin = hjChars.find(function(c){ return c.name === '阿敏'; });
  var huangtaiji = hjChars.find(function(c){ return c.name === '皇太极'; });

  var mockDecision = {
    rationale: '后金势盛·当下安抚之诏·稳八旗。汉军八旗暗中提阿敏入议政·示笼络。',
    memorials: [
      { from: '阿敏', type: '政务', content: '臣阿敏谨奏：朝廷诸贝勒一体·宜崇满洲·汉军可用而不可纵。', rulerDecision: 'annotated', ruling: '览·当再议。', loyaltyDelta: 1 }
    ],
    edict: {
      type: '赏赐',
      content: '诏曰：诸王贝勒功劳卓著·特赐银两·以彰朝廷怀远之意。',
      trigger: '稳定·示恩',
      treasuryDelta: -100000,
      loyaltyDeltas: { court: 4, general: 4, clan: 5 }
    },
    chaoyi: {
      type: 'cooperate',
      summary: '满洲·汉军八旗议事相和·共定经略明朝之策。',
      partyImbalanceDelta: -0.05,
      loyaltyDeltaByParty: { '满洲八旗': 2, '汉军八旗': 2 }
    },
    office: [
      { kind: 'promote', target: '阿敏', newPosition: '议政大臣', loyaltyDelta: 5, reason: '勤勉可嘉' }
    ]
  };

  var loyBefore = amin.loyalty;
  var moneyBefore = hj.treasury.money;
  var summary = ctx.TM.FactionNpcLlmDecision._applyDecision(hj, mockDecision);
  console.log('[e2e] apply summary:', JSON.stringify(summary));
  console.log('[e2e] 阿敏 loyalty: ' + loyBefore + ' → ' + amin.loyalty + ' position=' + amin.position);
  console.log('[e2e] 后金 treasury.money: ' + moneyBefore + ' → ' + hj.treasury.money);
  console.log('[e2e] 后金._lastLlmRationale.text: "' + (hj._lastLlmRationale && hj._lastLlmRationale.text) + '"');

  assert(summary.memorials === 1, 'mem applied');
  assert(summary.edicts === 1, 'edict applied');
  assert(summary.chaoyi === 1, 'chaoyi applied');
  assert(summary.office === 1, 'office applied');
  assert(amin.position === '议政大臣', '阿敏 promoted');
  assert(hj.treasury.money === moneyBefore - 100000, 'treasury changed');
  assert(amin.loyalty > loyBefore, 'loyalty up (mem +1 + office +5)');
  assert(hj._lastLlmRationale, 'rationale stored');

  // 验证 fac.npcMemorials 等 trajectory 有 LLM 标记
  var lastMem = hj.npcMemorials[hj.npcMemorials.length - 1];
  assert(lastMem._generatedByLlm === true, 'mem LLM tagged');
  var lastEd = hj.npcEdicts[hj.npcEdicts.length - 1];
  assert(lastEd._generatedByLlm === true, 'edict LLM tagged');

  // 验证 player faction 不受影响
  var ming = ctx.GM.facs.find(function(f){ return f.name === '明朝廷'; });
  assert(!ming.npcMemorials || ming.npcMemorials.length === 0, 'player not affected');
  assert(!ming._lastLlmRationale, 'player no rationale');

  console.log('[e2e] tianqi assertions pass·12 assertions');
}

function promptContextExpansionTest() {
  var ctx = buildContext();
  var sc = JSON.parse(fs.readFileSync(path.join(SCN_DIR, '天启七年·九月（官方）.json'), 'utf8'));
  loadGM(ctx, sc);

  if (ctx.GM.adminHierarchy && ctx.GM.adminHierarchy.laterJin && ctx.GM.adminHierarchy.laterJin.divisions && ctx.GM.adminHierarchy.laterJin.divisions[0]) {
    ctx.GM.adminHierarchy.laterJin.divisions[0].name = '辽沈建州八旗辖区·运行时改名';
    ctx.GM.adminHierarchy.laterJin.divisions[0].populationDetail = ctx.GM.adminHierarchy.laterJin.divisions[0].populationDetail || {};
    ctx.GM.adminHierarchy.laterJin.divisions[0].populationDetail.mouths = 777777;
  }

  var hj = ctx.GM.facs.find(function(f){ return f.name === '后金'; });
  var amin = ctx.GM._facIndex['后金'].chars.find(function(c){ return c.name === '阿敏'; });
  amin._memory = [{ turn: 2, event: '与明朝边将旧怨未解', importance: 8 }];
  amin._scars = [{ turn: 3, event: '宁远败绩余痛' }];
  amin._impressions = { '皇太极': { favor: -18 }, '努尔哈赤': { favor: 26 } };

  hj.npcMemorials = [{ turn: 4, type: '军务', status: 'approved', from: '阿敏', content: '请整顿边骑' }];
  hj.npcEdicts = [{ turn: 4, type: '整军', trigger: '辽东吃紧', content: '整八旗兵马' }];
  hj.npcChaoyi = [{ turn: 4, type: 'infight', summary: '诸贝勒争议南下' }];
  hj.npcOfficeActions = [{ turn: 4, action: 'promote', target: '阿敏', reason: '边功' }];
  hj.npcFiscalLedger = [{ turn: 4, crisis: true, stress: 82, summary: '军饷吃紧' }];
  hj.npcMilitaryActions = [{ turn: 4, action: 'military_order', army: 'BlueBannerPrompt', reason: 'Prompt frontier drill', effect: { commanderFrom: 'OldCmd', commanderTo: 'NewCmd', trainingDelta: 4 } }];
  hj.npcDiplomacyActions = [{ turn: 4, action: 'diplomacy', to: 'MingPromptEnvoy', reason: 'Prompt peace probe', effect: { relationFrom: -80, relationTo: -70 } }];
  hj.npcProvincePolicies = [{ turn: 4, action: 'province_policy', province: 'PromptLiaoyang', reason: 'Prompt grain levy', effect: { revenueDelta: 900 } }];
  hj.npcFiscalActions = [{ turn: 4, action: 'fiscal_policy', resource: 'money', amount: 45000, reason: 'Prompt war levy', effect: { before: 100000, after: 145000 } }];
  hj._lastLlmRationale = { turn: 4, text: '先稳内部，再窥辽东' };

  ctx.GM.shijiHistory = [
    { turn: 3, shizhengji: '辽东边报频至，后金诸部窥宁远。', zhengwen: '朝廷议防辽。', edicts: ['增修宁远城防'], xinglu: '召见兵部' }
  ];
  ctx.GM.qijuHistory = [
    { turn: 4, content: '【近事】宁远守军请饷，辽东局势紧。' },
    { turn: 4, xinglu: '夜阅辽东塘报' }
  ];
  ctx.GM._lastEndturnAiContext = {
    turn: 4,
    edicts: ['密令辽东诸将互为声援'],
    xinglu: '召辽东塘报入内廷',
    aiResult: { turnSummary: '本回合主推演提示：辽东战线将成诸势力焦点。' }
  };
  ctx.GM._turnAiResults = {
    subcall16: {
      faction_actions: [
        {
          faction: '\u540e\u91d1',
          action: '\u6682\u7f13\u5357\u4e0b\uff0c\u6574\u987f\u8fbd\u4e1c\u8fb9\u5be8',
          target: '\u660e\u671d\u5ef7',
          motive: '\u7cae\u8349\u672a\u9f50',
          impact: '\u77ed\u671f\u4f11\u6574'
        }
      ],
      diplomatic_shifts: [
        {
          from: '\u540e\u91d1',
          to: '\u660e\u671d\u5ef7',
          new_relation: '\u654c\u5bf9\u52a0\u6df1',
          reason: '\u8fbd\u4e1c\u51b2\u7a81\u6269\u5927'
        }
      ],
      territorial_changes: '\u65e0\u5927\u89c4\u6a21\u6613\u624b',
      power_balance_shift: '\u540e\u91d1\u6682\u5b88\uff0c\u660e\u5ef7\u538b\u529b\u4ecd\u5728',
      faction_directives: [
        {
          faction: '\u540e\u91d1',
          strategic_intent: '\u5b88\u52bf\u6574\u519b\uff0c\u4f46\u4fdd\u6301\u5bf9\u8fbd\u4e1c\u7684\u538b\u529b',
          must_follow: '\u4e0d\u5b9c\u7acb\u523b\u5357\u4e0b\uff0c\u5e94\u8f6c\u4e3a\u6574\u519b\u4e0e\u8bd5\u63a2',
          preferred_actions: ['\u6574\u519b', '\u9063\u4f7f\u8bd5\u63a2'],
          red_lines: '\u4e0d\u8981\u65e0\u56e0\u653e\u5f03\u8fbd\u4e1c\u538b\u529b'
        }
      ]
    }
  };
  ctx.GM._sc16FactionDirectives = {
    turn: 4,
    source: 'sc16',
    byFaction: {
      '\u540e\u91d1': {
        faction: '\u540e\u91d1',
        turn: 4,
        source: 'sc16',
        hasDirectContent: true,
        directives: ctx.GM._turnAiResults.subcall16.faction_directives,
        actions: ctx.GM._turnAiResults.subcall16.faction_actions,
        diplomacy: ctx.GM._turnAiResults.subcall16.diplomatic_shifts,
        territorialChanges: ctx.GM._turnAiResults.subcall16.territorial_changes,
        powerBalanceShift: ctx.GM._turnAiResults.subcall16.power_balance_shift
      }
    },
    order: ['\u540e\u91d1']
  };
  ctx.GM.factionRelations = [
    { from: '后金', to: '明朝廷', type: '敌对', value: -90, desc: '辽东交兵' }
  ];
  ctx.GM.activeWars = [{ name: '辽东战事', sides: ['后金', '明朝廷'], status: '僵持' }];
  ctx.GM.armies.push({ name: '镶蓝旗测试军', faction: '后金', soldiers: 12000, location: '辽阳' });
  ctx.GM.currentIssues = [{ title: '辽饷不足', severity: 80 }];

  var prompts = ctx.TM.FactionNpcLlmDecision._buildPrompt(hj);
  var combined = prompts.system + '\n' + prompts.user;
  assert(combined.indexOf('RECENT_WORLD') >= 0, 'prompt should include recent world history section');
  assert(combined.indexOf('辽东边报频至') >= 0, 'prompt should include shiji history');
  assert(combined.indexOf('PLAYER_RECENT') >= 0, 'prompt should include player recent orders section');
  assert(combined.indexOf('SCENARIO_FACTION_PROFILE') >= 0, 'prompt should include scenario faction profile section');
  assert(combined.indexOf('OWN_ADMIN_HIERARCHY') >= 0, 'prompt should include own admin hierarchy section');
  assert(combined.indexOf('辽沈建州八旗辖区·运行时改名') >= 0, 'prompt should include runtime admin hierarchy, not stale opening land');
  assert(combined.indexOf('口77.8万') >= 0 || combined.indexOf('口78万') >= 0 || combined.indexOf('777777') >= 0, 'prompt should include runtime admin population');
  assert(combined.indexOf('posture:') >= 0, 'prompt should include faction aiProfile posture');
  assert(combined.indexOf('priorities:') >= 0, 'prompt should include faction strategic priorities');
  assert(combined.indexOf('decisionHints:') >= 0, 'prompt should include faction decision hints');
  assert(combined.indexOf('增修宁远城防') >= 0, 'prompt should include player edicts from shiji');
  assert(combined.indexOf('密令辽东诸将互为声援') >= 0, 'prompt should include current-turn edicts snapshot');
  assert(combined.indexOf('本回合主推演提示') >= 0, 'prompt should include current-turn main AI result snapshot');
  assert(combined.indexOf('FACTION_TRAJECTORY') >= 0, 'prompt should include faction trajectory section');
  assert(combined.indexOf('BlueBannerPrompt') >= 0 && combined.indexOf('MingPromptEnvoy') >= 0 && combined.indexOf('PromptLiaoyang') >= 0 && combined.indexOf('Prompt war levy') >= 0,
    'prompt should include expanded NPC LLM action trajectory');
  assert(combined.indexOf('SC16_WORLD_DIRECTIVE') >= 0, 'prompt should include sc16 current-turn directive section');
  assert(combined.indexOf('sc16-ledger') >= 0 && combined.indexOf('\u5b88\u52bf\u6574\u519b') >= 0, 'prompt should prefer structured sc16 directive ledger');
  assert(combined.indexOf('ACTION_CANDIDATES') >= 0, 'prompt should include action candidate section');
  assert(combined.indexOf('valid char targets') >= 0 && combined.indexOf('valid army targets') >= 0 && combined.indexOf('valid faction targets') >= 0, 'prompt should include valid concrete targets');
  assert(combined.indexOf('\u6682\u7f13\u5357\u4e0b') >= 0, 'prompt should include sc16 faction action');
  assert(combined.indexOf('sc16') >= 0, 'prompt should explain sc16 continuity rule');
  assert(combined.indexOf('先稳内部，再窥辽东') >= 0, 'prompt should include last LLM rationale');
  assert(combined.indexOf('RELATIONS_AND_WARS') >= 0, 'prompt should include relations and wars');
  assert(combined.indexOf('辽东交兵') >= 0, 'prompt should include faction relation desc');
  assert(combined.indexOf('CHAR_MEMORY') >= 0, 'prompt should include character memory section');
  assert(combined.indexOf('宁远败绩余痛') >= 0, 'prompt should include character scars');
  assert(combined.indexOf('镶蓝旗测试军') >= 0, 'prompt should include faction army context');
  assert(combined.indexOf('"actions"') >= 0 && combined.indexOf('military_order|diplomacy|province_policy') >= 0, 'prompt should advertise native expanded action schema');
  console.log('[prompt] expansion assertions pass');
}

function sc16BridgeContextTest() {
  var ctx = buildContext();
  var hj = { name: '\u540e\u91d1', strength: 70 };
  ctx.GM = {
    turn: 4,
    facs: [hj, { name: '\u660e\u671d\u5ef7', isPlayer: true, strength: 80 }],
    qijuHistory: [],
    adminHierarchy: {
      laterJin: {
        factionId: 'laterJin',
        factionName: '\u540e\u91d1',
        divisions: [{
          name: '\u8fbd\u6c88\u5efa\u5dde\u516b\u65d7\u8f96\u533a\u00b7SC16\u8fd0\u884c\u65f6',
          level: 'province',
          regionType: 'normal',
          terrain: '\u5e73\u539f/\u5c71\u5730',
          populationDetail: { mouths: 666666, households: 120000, fugitives: 10000 },
          fiscalDetail: { claimedRevenue: 800000, actualRevenue: 620000, remittedToCenter: 0, retainedBudget: 620000 },
          publicTreasuryInit: { money: 200000, grain: 300000, cloth: 30000 },
          minxinLocal: 48,
          corruptionLocal: 35,
          threats: ['\u660e\u519b\u53cd\u653b']
        }]
      },
      mingFront: {
        factionId: 'fac-ming',
        factionName: '\u660e\u671d\u5ef7',
        divisions: [{
          name: '\u5b81\u8fdc\u65b0\u5360\u533a',
          level: 'province',
          currentOwner: '\u540e\u91d1',
          populationDetail: { mouths: 88000 },
          publicTreasuryInit: { money: 10000, grain: 20000, cloth: 2000 }
        }]
      }
    }
  };
  hj.npcMemorials = [{ turn: 3, type: '\u519b\u52a1', status: 'approved', from: '\u963f\u654f', content: '\u8bf7\u6574\u987f\u8fb9\u9a91' }];
  hj.npcEdicts = [{ turn: 3, type: '\u6574\u519b', trigger: '\u8fbd\u4e1c\u7d27\u5f20', content: '\u5148\u7a33\u5185\u90e8\uff0c\u6682\u4e0d\u8f7b\u8fdb' }];
  hj.npcChaoyi = [{ turn: 3, type: 'compromise', summary: '\u8bf8\u8d1d\u52d2\u8bae\u5b9a\u7f13\u56fe\u8fb9\u9632' }];
  hj.npcFiscalLedger = [{ turn: 3, crisis: true, stress: 75, summary: '\u519b\u7cae\u5403\u7d27' }];
  hj.npcMilitaryActions = [{ turn: 3, action: 'military_order', army: 'BlueBannerSc16', reason: 'Sc16 frontier drill', effect: { commanderFrom: 'OldCmd', commanderTo: 'NewCmd' } }];
  hj.npcDiplomacyActions = [{ turn: 3, action: 'diplomacy', to: 'MingSc16Envoy', reason: 'Sc16 probe peace', effect: { relationFrom: -80, relationTo: -72 } }];
  hj.npcProvincePolicies = [{ turn: 3, action: 'province_policy', province: 'Sc16Liaoyang', reason: 'Sc16 grain levy', effect: { revenueDelta: 700 } }];
  hj.npcFiscalActions = [{ turn: 3, action: 'fiscal_policy', resource: 'money', amount: 25000, reason: 'Sc16 war levy', effect: { before: 100000, after: 125000 } }];
  hj._lastLlmRationale = { turn: 3, text: '\u5148\u7a33\u5185\u90e8\uff0c\u518d\u7aa5\u8fb9\u673a' };
  ctx.GM.qijuHistory = [
    { turn: 3, _source: 'npc-in-turn-llm', _facName: '\u540e\u91d1', content: '\u3010\u52bf\u529b\u8fd1\u4e8b\u3011\u540e\u91d1\u56de\u5408\u5185\u8c03\u9a91\u7a33\u8fbd\u4e1c' },
    { turn: 3, _source: 'npc-bridge', _facName: '\u540e\u91d1', content: '\u3010\u52bf\u529b\u52a8\u6001\u3011\u540e\u91d1\u8fc7\u56de\u5408\u540e\u7eed\u6574\u519b' }
  ];

  var fld = ctx.TM.FactionNpcLlmDecision;
  assert(typeof fld.buildRecentTrajectoryContextForSc16 === 'function', 'sc16 bridge helper missing');
  assert(typeof fld.buildFactionAdminSummaryForSc16 === 'function', 'sc16 admin hierarchy helper missing');
  var adminBridge = fld.buildFactionAdminSummaryForSc16({ maxFactions: 6, maxChars: 4000 });
  assert(adminBridge.indexOf('FACTION_ADMIN_HIERARCHY') >= 0, 'sc16 admin bridge should include admin hierarchy marker');
  assert(adminBridge.indexOf('\u8fbd\u6c88\u5efa\u5dde\u516b\u65d7\u8f96\u533a\u00b7SC16\u8fd0\u884c\u65f6') >= 0, 'sc16 admin bridge should include runtime province name');
  assert(adminBridge.indexOf('\u5b81\u8fdc\u65b0\u5360\u533a') >= 0, 'sc16 admin bridge should include runtime owner-changed province');
  assert(adminBridge.indexOf('\u53e366.7\u4e07') >= 0 || adminBridge.indexOf('666666') >= 0, 'sc16 admin bridge should include runtime population');
  var bridge = fld.buildRecentTrajectoryContextForSc16({ maxFactions: 6, maxChars: 4000 });
  assert(bridge.indexOf('FACTION_PRECISION_HISTORY') >= 0, 'sc16 bridge should include precision history marker');
  assert(bridge.indexOf('\u5148\u7a33\u5185\u90e8') >= 0, 'sc16 bridge should include previous faction rationale/edict');
  assert(bridge.indexOf('BlueBannerSc16') >= 0 && bridge.indexOf('MingSc16Envoy') >= 0 && bridge.indexOf('Sc16Liaoyang') >= 0 && bridge.indexOf('Sc16 war levy') >= 0,
    'sc16 bridge should include expanded NPC LLM action trajectory');
  assert(bridge.indexOf('npc-in-turn-llm') >= 0, 'sc16 bridge should include in-turn precision news');
  assert(bridge.indexOf('npc-bridge') >= 0, 'sc16 bridge should include post-endturn precision news');

  var followupSrc = fs.readFileSync(path.join(ROOT, 'tm-endturn-followup.js'), 'utf8');
  vm.runInContext(followupSrc, ctx, { filename: 'tm-endturn-followup.js' });
  assert(ctx.TM.Endturn && ctx.TM.Endturn.AI && ctx.TM.Endturn.AI.followup,
    'followup helpers should be loadable for sc16 directive ledger tests');
  var p16 = {
    faction_priorities: [
      { faction: '\u540e\u91d1', priority: 96, urgency: 'high', reason: 'frontline initiative' },
      { faction: 'OtherNpc', priority: 40, urgency: 'low', reason: 'watch' }
    ],
    faction_directives: [
      { faction: '\u540e\u91d1', strategic_intent: '\u5b88\u52bf\u6574\u519b', must_follow: '\u6682\u7f13\u5357\u4e0b' }
    ],
    faction_actions: [
      { faction: '\u540e\u91d1', action: '\u6682\u7f13\u5357\u4e0b', motive: 'ledger test' }
    ],
    diplomatic_shifts: []
  };
  var sc16Ledger = ctx.TM.Endturn.AI.followup._storeSc16DirectiveLedger(p16, ctx.GM, ['\u660e']);
  assert(sc16Ledger && Array.isArray(sc16Ledger.priorityQueue) && sc16Ledger.priorityQueue[0].faction === '\u540e\u91d1',
    'sc16 directive ledger should expose a sorted faction priority queue');
  assert(sc16Ledger.byFaction['\u540e\u91d1'].priorityScore >= 90 && sc16Ledger.byFaction['\u540e\u91d1'].priorityReason,
    'sc16 directive row should preserve priority score and reason for later precision LLM');
  assert(ctx.GM._npcFactionAiTurnLedger && ctx.GM._npcFactionAiTurnLedger.sc16 && ctx.GM._npcFactionAiTurnLedger.sc16.priorityQueue[0].faction === '\u540e\u91d1',
    'sc16 storage should attach priority directives to the unified faction AI turn ledger');
  assert(followupSrc.indexOf('buildRecentTrajectoryContextForSc16') >= 0, 'sc16 prompt should call precision history helper');
  assert(followupSrc.indexOf('buildFactionAdminSummaryForSc16') >= 0, 'sc16 prompt should call admin hierarchy helper');
  assert(followupSrc.indexOf('rel.type = ds.new_relation') < 0,
    'sc16 should remain a strategic directive ledger and must not directly mutate factionRelations.type');
  assert(followupSrc.indexOf('_tmStoreSc16DirectiveLedger') >= 0,
    'sc16 should store structured directives for later faction precision LLM');
  console.log('[sc16-bridge] precision history assertions pass');
}

async function main() {
  unitTests();
  actionSchemaAndOfficeSyncTest();
  nativeExpandedActionsTest();
  nativeOfficeFiscalActionsTest();
  actionEngineStrategicActionsTest();
  actionEnginePreflightStrategyNewsTest();
  factionAiDiagnosticsSnapshotTest();
  localTemplateLedgerTest();
  await playerIsPlayerGuardTest();
  await llmRetryAndConcurrencyTest();
  promptContextExpansionTest();
  sc16BridgeContextTest();
  e2eApplyMockDecision();
  console.log('[smoke-faction-npc-llm-decision] all pass');
}

main().catch(function(e) {
  console.error('[smoke-faction-npc-llm-decision] fail:', (e && e.message) || e);
  if (e && e.stack) console.error(e.stack.split('\n').slice(1, 6).join('\n'));
  process.exit(1);
});
