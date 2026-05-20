#!/usr/bin/env node
// smoke-military-systems.js - phase 5 military systems regression gate.

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { readSource: readEndturnSource } = require('./smoke-endturn-baseline-helpers');

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
load('tm-faction-membership.js');
load('tm-military.js');
load('tm-region-enrich.js');
load('tm-char-full-schema.js');
load('tm-rel-graph.js');
load('tm-migration.js');
load('tm-map-system.js');
load('tm-ai-schema.js');
load('tm-ai-output-validator.js');
load('tm-ai-change-applier.js');
load('tm-data-access.js');

const EC = context.TM.EngineConstants;
const MS = context.MilitarySystems;
check(EC, 'EngineConstants missing');
check(MS, 'MilitarySystems missing');
check(context.TM.MilitarySystems === MS, 'MilitarySystems TM alias missing');
check(context.DA && context.DA.armies, 'DataAccess armies facade missing');

const endturnSource = readEndturnSource();
check(endturnSource.indexOf('MilitarySystems.getMilitarySystems(GM)') >= 0, 'sc18 should inject militarySystems catalog context');
check(endturnSource.indexOf('p18.battleResult') >= 0 && endturnSource.indexOf('MilitarySystems.applyBattleResult(p18.battleResult') >= 0, 'sc18 should apply structured battleResult');
check(endturnSource.indexOf('affectedArmies:[{armyId,side,loss,moraleDelta,loyaltyDelta,state,commanderFate}]') >= 0, 'sc18 should request affectedArmies');
check(endturnSource.indexOf('_battleResultCasualtyFactions') >= 0, 'sc18 should track battleResult casualty factions before faction action writeback');
check(endturnSource.indexOf('_skipCasualtyWriteback') >= 0, 'sc18 should skip duplicated faction casualties already covered by battleResult');
check(endturnSource.indexOf("global.applyAIArmyChange(ac, { source: 'endturn.army_changes'") >= 0,
  'sc1 army_changes should use shared AI army writeback');
check(endturnSource.indexOf("global.applyAIArmyChange(ac, { source: 'sc18.supplementary_army_changes'") >= 0,
  'sc18 supplementary army changes should use shared AI army writeback');
check(endturnSource.indexOf('lastInteractionMemory') >= 0 && endturnSource.indexOf('recognitionState') >= 0, 'sc07 should expose new cognition fields');
check(endturnSource.indexOf('lastInteractionMemory/recognitionState') >= 0, 'sc07 dynamic info rule missing');

const militarySource = fs.readFileSync(path.join(ROOT, 'tm-military.js'), 'utf8');
const renderSource = fs.readFileSync(path.join(ROOT, 'tm-endturn-render.js'), 'utf8');
const applierSource = fs.readFileSync(path.join(ROOT, 'tm-ai-change-applier.js'), 'utf8');
const phase8FormalSource = fs.readFileSync(path.join(ROOT, 'phase8-formal-bridge.js'), 'utf8');
check(militarySource.indexOf('a.armyType') >= 0, 'syncMilitarySources should preserve scenario armyType buckets');
check(renderSource.indexOf("['军','势力','统帅','驻地'") >= 0, 'military risk table should show faction column');
check(renderSource.indexOf('欠饷≥3月') >= 0, 'military risk warning should use 欠饷 wording');
check(applierSource.indexOf('function applyAIArmyChange') >= 0, 'AI applier should expose shared army writeback helper');
check(applierSource.indexOf('military_changes') >= 0 && applierSource.indexOf('army_changes') >= 0,
  'AI applier should consume both military_changes and army_changes');
check(phase8FormalSource.indexOf('function refreshActivePanel') >= 0 &&
      phase8FormalSource.indexOf('function refreshArmyFlyout') >= 0 &&
      phase8FormalSource.indexOf('refreshPanel: refreshActivePanel') >= 0 &&
      phase8FormalSource.indexOf('refreshActivePanel();') >= 0,
  'phase8 formal refresh should redraw the active right panel');

let militaryRefreshHits = 0;
let formalBridgeRefreshHits = 0;
const realSyncMilitarySources = context.syncMilitarySources;
context.syncMilitarySources = function(G) {
  check(G === context.GM, 'military refresh should receive live GM');
  militaryRefreshHits++;
  if (typeof realSyncMilitarySources === 'function') return realSyncMilitarySources(G);
  return undefined;
};
context.renderTopBarVars = function() { militaryRefreshHits++; };
context.syncArmiesToMap = function() { militaryRefreshHits++; };
context.renderMap = function() { militaryRefreshHits++; };
context.TMPhase8FormalBridge = {
  refresh() {
    militaryRefreshHits++;
    formalBridgeRefreshHits++;
  }
};
context.GM = {
  turn: 7,
  chars: [],
  facs: [],
  armies: [{
    id: 'army_liaodong',
    name: '辽东军',
    faction: '明朝廷',
    commander: '旧将',
    commanderName: '旧将',
    general: '旧将',
    leader: '旧将',
    generalName: '旧将',
    commanderDisplayName: '旧将',
    commandingOfficer: '旧将',
    chiefCommander: '旧将',
    soldiers: 12000,
    size: 12000,
    strength: 12000
  }]
};
const commanderSwap = context.applyAIArmyChange(
  { name: '辽东军', commander: '新将', reason: '改任主将' },
  { source: 'smoke.army.commander' }
);
check(commanderSwap && commanderSwap.ok && commanderSwap.changed, 'existing army commander change should be applied');
checkEq(context.GM.armies[0].commander, '新将', 'army.commander should update on existing army');
checkEq(context.GM.armies[0].commanderName, '新将', 'army commanderName alias should stay live');
checkEq(context.GM.armies[0].general, '新将', 'army general alias should stay live');
checkEq(context.GM.armies[0].leader, '新将', 'army leader alias should stay live');
checkEq(context.GM.armies[0].generalName, '新将', 'army generalName alias should stay live');
checkEq(context.GM.armies[0].commanderDisplayName, '新将', 'army commanderDisplayName alias should stay live');
checkEq(context.GM.armies[0].commandingOfficer, '新将', 'army commandingOfficer alias should stay live');
checkEq(context.GM.armies[0].chiefCommander, '新将', 'army chiefCommander alias should stay live');
check(militaryRefreshHits >= 4, 'army commander change should refresh military views');
check(formalBridgeRefreshHits >= 1, 'army commander change should refresh phase8 formal bridge');
check(context.GM._turnReport.some(function(r) {
  return r && r.type === 'military' && r.field === 'commander' && r.old === '旧将' && r.new === '新将';
}), 'army commander change should be recorded in turn report');

context.GM = {
  turn: 7,
  chars: [{ name: '曹文诏', faction: '明朝廷' }],
  facs: [],
  armies: [{
    id: 'army_shenlong',
    name: '神龙军',
    faction: '明朝廷',
    commander: '',
    commanderName: '',
    general: '',
    quality: '',
    equipmentCondition: '',
    soldiers: 30000,
    size: 30000,
    strength: 30000,
    state: 'garrison'
  }]
};
const chineseArmyFieldSwap = context.applyAITurnChanges({
  narrative: '命兵部补录更正神龙军信息：统帅 曹文诏；军质：精锐；装备：精良（全员列装自生火铳）。',
  army_changes: [{
    name: '神龙军',
    '统帅': '曹文诏',
    '军质': '精锐',
    '装备': '精良（全员列装自生火铳）',
    reason: '兵部补录'
  }]
});
check(chineseArmyFieldSwap && chineseArmyFieldSwap.ok, 'Chinese army field correction should apply turn');
checkEq(context.GM.armies[0].commander, '曹文诏', 'Chinese 统帅 key should update army.commander');
checkEq(context.GM.armies[0].commanderName, '曹文诏', 'Chinese 统帅 key should sync commander aliases');
checkEq(context.GM.armies[0].quality, '精锐', 'Chinese 军质 key should update army.quality');
checkEq(context.GM.armies[0].equipmentCondition, '精良（全员列装自生火铳）', 'Chinese 装备 key should update army.equipmentCondition');

context.GM = {
  turn: 7,
  chars: [{ name: '曹变蛟', faction: '明朝廷' }],
  facs: [],
  armies: [{
    id: 'army_shenlong_narrative',
    name: '神龙军',
    faction: '明朝廷',
    commander: '',
    commanderName: '',
    general: '',
    quality: '',
    equipmentCondition: '',
    soldiers: 30000
  }]
};
const narrativeArmyFieldSwap = context.applyAITurnChanges({
  narrative: '命兵部补录更正神龙军信息：统帅 曹变蛟；军质：精锐；装备：精良（全员列装自生火铳）。'
});
check(narrativeArmyFieldSwap && narrativeArmyFieldSwap.ok, 'narrative-only army field correction should apply turn');
checkEq(context.GM.armies[0].commander, '曹变蛟', 'narrative 统帅 should update army.commander');
checkEq(context.GM.armies[0].quality, '精锐', 'narrative 军质 should update army.quality');
checkEq(context.GM.armies[0].equipmentCondition, '精良（全员列装自生火铳）', 'narrative 装备 should update army.equipmentCondition');

context.GM = {
  turn: 8,
  chars: [{ name: '张惟贤', faction: '明朝廷' }],
  facs: [],
  armies: [{
    id: 'jingying_wujun',
    name: '京营 - 五军营',
    faction: '明朝廷',
    commander: '崔呈秀',
    commanderName: '崔呈秀',
    general: '崔呈秀',
    soldiers: 60000
  }]
};
const narrativeCommander = context.applyAITurnChanges({
  narrative: '京营·五军营 统帅更正为 张惟贤。'
});
check(narrativeCommander && narrativeCommander.ok, 'narrative commander turn should apply');
checkEq(context.GM.armies[0].commander, '张惟贤', 'narrative army commander correction should update army.commander');
checkEq(context.GM.armies[0].commanderName, '张惟贤', 'narrative army commander correction should update commanderName');
checkEq(context.GM.armies[0].general, '张惟贤', 'narrative army commander correction should update general');
check(narrativeCommander.applied &&
      narrativeCommander.applied.semantic &&
      narrativeCommander.applied.semantic.army_commander_fallback === 1,
  'narrative army commander fallback should be counted');
check(context.GM._turnReport.some(function(r) {
  return r && r.type === 'military' && r.field === 'commander' && r.old === '崔呈秀' && r.new === '张惟贤';
}), 'narrative army commander correction should be recorded in turn report');

function runNarrativeCommanderCase(text, initialCommander, expectedCommander, message) {
  context.GM = {
    turn: 8,
    chars: [{ name: expectedCommander, faction: '明朝廷' }],
    facs: [],
    armies: [{
      id: 'jingying_wujun',
      name: '京营 - 五军营',
      faction: '明朝廷',
      commander: initialCommander,
      commanderName: initialCommander,
      general: initialCommander,
      soldiers: 60000
    }]
  };
  const res = context.applyAITurnChanges({ narrative: text });
  check(res && res.ok, message + ' should apply turn');
  checkEq(context.GM.armies[0].commander, expectedCommander, message);
  checkEq(context.GM.armies[0].commanderName, expectedCommander, message + ' commanderName');
  checkEq(context.GM.armies[0].general, expectedCommander, message + ' general');
}

runNarrativeCommanderCase(
  '张惟贤出掌京营·五军营。',
  '',
  '张惟贤',
  'person-first direct army command appointment should update commander'
);
runNarrativeCommanderCase(
  '京营·五军营交张惟贤统带。',
  '崔呈秀',
  '张惟贤',
  'army-first handover to commander should update commander'
);
runNarrativeCommanderCase(
  '以京营·五军营付张惟贤节制。',
  '崔呈秀',
  '张惟贤',
  'army-first entrusted command should update commander'
);
runNarrativeCommanderCase(
  '命张惟贤提督京营·五军营。',
  '',
  '张惟贤',
  'imperial order direct command appointment should update commander'
);

context.GM = {
  turn: 9,
  chars: [],
  facs: [{ id:'fac-ming', name:'明朝廷' }, { id:'fac-later-jin', name:'后金' }],
  armies: [{
    id: 'jingying_wujun',
    name: '京营 - 五军营',
    faction: '明朝廷',
    location: '京师',
    garrison: '京师',
    soldiers: 60000
  }]
};
const narrativeArmyFields = context.applyAITurnChanges({
  narrative: '京营·五军营移驻山海关，改隶后金。'
});
check(narrativeArmyFields && narrativeArmyFields.ok, 'narrative army field turn should apply');
checkEq(context.GM.armies[0].location, '山海关', 'narrative army location should update');
checkEq(context.GM.armies[0].garrison, '山海关', 'narrative army garrison alias should update');
checkEq(context.GM.armies[0].faction, '后金', 'narrative army faction should update');
check(narrativeArmyFields.applied &&
      narrativeArmyFields.applied.semantic &&
      narrativeArmyFields.applied.semantic.army_field_fallback >= 2,
  'narrative army field fallback should count location and faction');

context.GM = {
  turn: 10,
  chars: [{ name: '袁崇焕', faction: '明朝廷' }],
  facs: [{ id:'fac-ming', name:'明朝廷' }, { id:'fac-later-jin', name:'后金' }],
  mapData: {
    enabled: true,
    factions: {},
    regions: [{
      id: 'liaodong',
      name: '辽东',
      owner: 'fac-ming',
      currentOwner: 'fac-ming',
      ownerKey: 'fac-ming',
      currentOwnerKey: 'fac-ming',
      controllerKey: 'fac-ming',
      factionName: '明朝廷',
      ownerName: '明朝廷',
      currentOwnerName: '明朝廷',
      controllerName: '明朝廷',
      governor: '旧官',
      officialPosition: '旧巡抚',
      data: {
        ownerName: '明朝廷',
        currentOwnerName: '明朝廷',
        governor: '旧官',
        officialPosition: '旧巡抚'
      },
      points: [[0,0],[1,0],[1,1]],
      coords: [0,0,1,0,1,1],
      center: [0,0]
    }]
  },
  adminHierarchy: {
    ming: {
      divisions: [{
        id: 'liaodong',
        name: '辽东',
        owner: '明朝廷',
        currentOwner: '明朝廷',
        factionName: '明朝廷',
        governor: '旧官',
        officialPosition: '旧巡抚',
        children: []
      }]
    }
  },
  _provinceToFaction: { '辽东': '明朝廷' },
  provinceStats: { liaodong: { owner: '明朝廷', currentOwner: '明朝廷', governor: '旧官', officialPosition: '旧巡抚' } }
};
context.P = { map: context.GM.mapData, mapData: context.GM.mapData, battleConfig: { enabled: true } };
const narrativeRegionFields = context.applyAITurnChanges({
  narrative: '后金占领辽东。辽东巡抚改任为袁崇焕。'
});
check(narrativeRegionFields && narrativeRegionFields.ok, 'narrative region field turn should apply');
checkEq(context.GM.mapData.regions[0].owner, 'fac-later-jin', 'narrative region owner should update mapData owner');
checkEq(context.GM.mapData.regions[0].ownerName, '后金', 'narrative region ownerName should update');
checkEq(context.GM.mapData.regions[0].currentOwnerName, '后金', 'narrative region currentOwnerName should update');
checkEq(context.GM.mapData.regions[0].controllerName, '后金', 'narrative region controllerName should update');
checkEq(context.GM.mapData.regions[0].ownerKey, 'fac-later-jin', 'narrative region ownerKey should update');
checkEq(context.GM.mapData.regions[0].controllerKey, 'fac-later-jin', 'narrative region controllerKey should update');
checkEq(context.GM.mapData.regions[0].factionKey, 'fac-later-jin', 'narrative region factionKey should update');
checkEq(context.GM.mapData.regions[0].data.ownerName, '后金', 'narrative region nested ownerName should update');
checkEq(context.GM._provinceToFaction['辽东'], '后金', 'narrative region province owner mirror should update');
checkEq(context.GM.adminHierarchy.ming.divisions[0].owner, '后金', 'narrative region admin owner should update');
checkEq(context.GM.adminHierarchy.ming.divisions[0].ownerKey, 'fac-later-jin', 'narrative region admin ownerKey should update');
checkEq(context.GM.provinceStats.liaodong.ownerName, '后金', 'narrative region provinceStats ownerName should update');
checkEq(context.GM.provinceStats.liaodong.ownerKey, 'fac-later-jin', 'narrative region provinceStats ownerKey should update');
checkEq(context.GM.adminHierarchy.ming.divisions[0].governor, '袁崇焕', 'narrative region governor should update admin division');
checkEq(context.GM.mapData.regions[0].governor, '袁崇焕', 'narrative region governor should update mapData region');
checkEq(context.GM.mapData.regions[0].governorName, '袁崇焕', 'narrative region governorName should update mapData region');
checkEq(context.GM.mapData.regions[0].administrator, '袁崇焕', 'narrative region administrator should update mapData region');
checkEq(context.GM.mapData.regions[0].officialPosition, '巡抚', 'narrative region officialPosition should be inferred');
checkEq(context.GM.mapData.regions[0].data.governor, '袁崇焕', 'narrative region nested governor should update');
checkEq(context.GM.mapData.regions[0].data.officialPosition, '巡抚', 'narrative region nested officialPosition should update');
checkEq(context.GM.adminHierarchy.ming.divisions[0].governorName, '袁崇焕', 'narrative region admin governorName should update');
checkEq(context.GM.adminHierarchy.ming.divisions[0].administrator, '袁崇焕', 'narrative region admin administrator should update');
checkEq(context.GM.adminHierarchy.ming.divisions[0].officialPosition, '巡抚', 'narrative region admin officialPosition should update');
checkEq(context.GM.provinceStats.liaodong.governorName, '袁崇焕', 'narrative region provinceStats governorName should update');
checkEq(context.GM.provinceStats.liaodong.officialPosition, '巡抚', 'narrative region provinceStats officialPosition should update');
checkEq(context.GM.chars[0].officialTitle, '巡抚', 'narrative region governor char officialTitle should update');
checkEq(context.GM.chars[0].location, '辽东', 'narrative region governor char location should update');
check(narrativeRegionFields.applied &&
      narrativeRegionFields.applied.semantic &&
      narrativeRegionFields.applied.semantic.region_field_fallback >= 2,
  'narrative region field fallback should count owner and governor');

context.GM = {
  turn: 10,
  chars: [{ name: '孙承宗', faction: '明朝廷' }],
  facs: [{ id:'fac-ming', name:'明朝廷' }],
  mapData: {
    enabled: true,
    factions: {},
    regions: [{
      id: 'guangning',
      name: '广宁',
      owner: 'fac-ming',
      ownerName: '明朝廷',
      governor: '',
      points: [[0,0],[1,0],[1,1]],
      coords: [0,0,1,0,1,1],
      center: [0,0]
    }]
  },
  adminHierarchy: { ming: { divisions: [{ id:'guangning', name:'广宁', children: [] }] } },
  provinceStats: { guangning: {} }
};
context.P = { map: context.GM.mapData, mapData: context.GM.mapData, battleConfig: { enabled: true } };
const narrativeDirectGovernor = context.applyAITurnChanges({
  narrative: '孙承宗出任广宁经略。'
});
check(narrativeDirectGovernor && narrativeDirectGovernor.ok, 'direct narrative governor appointment should apply');
checkEq(context.GM.mapData.regions[0].governor, '孙承宗', 'direct narrative governor appointment should update governor');
checkEq(context.GM.mapData.regions[0].officialPosition, '经略', 'direct narrative governor appointment should infer office');
checkEq(context.GM.adminHierarchy.ming.divisions[0].governorName, '孙承宗', 'direct narrative governor appointment should mirror admin governorName');
checkEq(context.GM.provinceStats.guangning.officialTitle, '经略', 'direct narrative governor appointment should mirror provinceStats officialTitle');
checkEq(context.GM.chars[0].governorOf, '广宁', 'direct narrative governor appointment should mark character region');

context.GM = {
  turn: 11,
  chars: [{ name: '皇太极', faction: '后金' }],
  facs: [
    { id:'fac-ming', name:'明朝廷', leader:'天启帝', relations:{ '后金': -20 }, enemies:[] },
    { id:'fac-later-jin', name:'后金', leader:'努尔哈赤', ruler:'努尔哈赤', capital:'赫图阿拉', relations:{ '明朝廷': -20 }, enemies:[] }
  ],
  armies: []
};
const narrativeFactionFields = context.applyAITurnChanges({
  narrative: '后金奉皇太极为主，迁都沈阳。后金与明朝廷绝交。'
});
var houjin = context.GM.facs[1];
var mingFac = context.GM.facs[0];
check(narrativeFactionFields && narrativeFactionFields.ok, 'narrative faction field turn should apply');
checkEq(houjin.leader, '皇太极', 'narrative faction leader should update');
checkEq(houjin.ruler, '皇太极', 'narrative faction ruler alias should update');
checkEq(houjin.capital, '沈阳', 'narrative faction capital should update');
check(houjin.relations['明朝廷'] <= -60, 'narrative hostile diplomacy should update source relation');
check(mingFac.relations['后金'] <= -60, 'narrative hostile diplomacy should update target relation');
check(houjin.enemies.indexOf('明朝廷') >= 0, 'narrative hostile diplomacy should update enemies list');
check(narrativeFactionFields.applied &&
      narrativeFactionFields.applied.semantic &&
      narrativeFactionFields.applied.semantic.faction_field_fallback >= 3,
  'narrative faction field fallback should count leader capital diplomacy');

context.GM = {
  turn: 12,
  chars: [],
  facs: [{ id:'fac-ming', name:'明朝廷' }],
  armies: [{
    id: 'jingying_wujun',
    name: '京营 - 五军营',
    faction: '明朝廷',
    soldiers: 60000,
    size: 60000,
    strength: 60000,
    morale: 50,
    training: 40,
    supply: 70,
    loyalty: 55,
    control: 60
  }]
};
const narrativeArmyNumericFields = context.applyAITurnChanges({
  narrative: '京营·五军营兵力增至65000，士气升至72，训练升至63，补给降至44，忠诚升至68，控制升至71。'
});
check(narrativeArmyNumericFields && narrativeArmyNumericFields.ok, 'narrative army numeric field turn should apply');
checkEq(context.GM.armies[0].soldiers, 65000, 'narrative army soldiers should update');
checkEq(context.GM.armies[0].size, 65000, 'narrative army size should mirror soldiers');
checkEq(context.GM.armies[0].strength, 65000, 'narrative army strength should mirror soldiers');
checkEq(context.GM.armies[0].morale, 72, 'narrative army morale should update');
checkEq(context.GM.armies[0].training, 63, 'narrative army training should update');
checkEq(context.GM.armies[0].supply, 44, 'narrative army supply should update');
checkEq(context.GM.armies[0].loyalty, 68, 'narrative army loyalty should update');
checkEq(context.GM.armies[0].control, 71, 'narrative army control should update');
check(narrativeArmyNumericFields.applied &&
      narrativeArmyNumericFields.applied.semantic &&
      narrativeArmyNumericFields.applied.semantic.army_field_fallback >= 6,
  'narrative army numeric fields should be counted');

context.GM = {
  turn: 13,
  chars: [],
  facs: [{ id:'fac-ming', name:'明朝廷' }],
  mapData: {
    enabled: true,
    factions: {},
    regions: [{
      id: 'liaodong',
      name: '辽东',
      owner: 'fac-ming',
      currentOwner: 'fac-ming',
      ownerKey: 'fac-ming',
      currentOwnerKey: 'fac-ming',
      factionName: '明朝廷',
      ownerName: '明朝廷',
      troops: 4000,
      development: 50,
      prosperity: 52,
      minxinLocal: 45,
      corruptionLocal: 33,
      taxBurden: 50,
      points: [[0,0],[1,0],[1,1]],
      coords: [0,0,1,0,1,1],
      center: [0,0]
    }]
  },
  adminHierarchy: {
    ming: {
      divisions: [{
        id: 'liaodong',
        name: '辽东',
        troops: 4000,
        development: 50,
        prosperity: 52,
        minxinLocal: 45,
        corruptionLocal: 33,
        taxBurden: 50,
        children: []
      }]
    }
  },
  provinceStats: { liaodong: { troops: 4000, development: 50, prosperity: 52, minxinLocal: 45, corruptionLocal: 33, taxBurden: 50 } }
};
context.P = { map: context.GM.mapData, mapData: context.GM.mapData, battleConfig: { enabled: true } };
const narrativeRegionNumericFields = context.applyAITurnChanges({
  narrative: '辽东驻军增至8000，开发升至61，繁荣升至64，民心升至58，腐败降至22，税负降至35。'
});
check(narrativeRegionNumericFields && narrativeRegionNumericFields.ok, 'narrative region numeric field turn should apply');
checkEq(context.GM.mapData.regions[0].troops, 8000, 'narrative region troops should update');
checkEq(context.GM.mapData.regions[0].development, 61, 'narrative region development should update');
checkEq(context.GM.mapData.regions[0].prosperity, 64, 'narrative region prosperity should update');
checkEq(context.GM.mapData.regions[0].minxinLocal, 58, 'narrative region local minxin should update');
checkEq(context.GM.mapData.regions[0].corruptionLocal, 22, 'narrative region local corruption should update');
checkEq(context.GM.mapData.regions[0].taxBurden, 35, 'narrative region tax burden should update');
checkEq(context.GM.adminHierarchy.ming.divisions[0].taxBurden, 35, 'narrative region numeric should mirror admin division');
checkEq(context.GM.provinceStats.liaodong.taxBurden, 35, 'narrative region numeric should mirror provinceStats');
check(narrativeRegionNumericFields.applied &&
      narrativeRegionNumericFields.applied.semantic &&
      narrativeRegionNumericFields.applied.semantic.region_field_fallback >= 6,
  'narrative region numeric fields should be counted');

context.GM = {
  turn: 14,
  chars: [],
  facs: [{
    id:'fac-later-jin',
    name:'后金',
    government:'部落联盟',
    goal:'固守辽东',
    mobilization:40,
    warState:'休整',
    policy:'联姻抚部'
  }],
  armies: []
};
const narrativeFactionExtendedFields = context.applyAITurnChanges({
  narrative: '后金政体改为汗国，战略目标改为入主辽东，动员程度升至72，战态改为备战，国策改为整军备边。'
});
var laterJinExtended = context.GM.facs[0];
check(narrativeFactionExtendedFields && narrativeFactionExtendedFields.ok, 'narrative faction extended field turn should apply');
checkEq(laterJinExtended.government, '汗国', 'narrative faction government should update');
checkEq(laterJinExtended.goal, '入主辽东', 'narrative faction goal should update');
checkEq(laterJinExtended.strategicGoal, '入主辽东', 'narrative faction strategicGoal alias should update');
checkEq(laterJinExtended.mobilization, 72, 'narrative faction mobilization should update');
checkEq(laterJinExtended.warState, '备战', 'narrative faction warState should update');
checkEq(laterJinExtended.policy, '整军备边', 'narrative faction policy should update');
check(narrativeFactionExtendedFields.applied &&
      narrativeFactionExtendedFields.applied.semantic &&
      narrativeFactionExtendedFields.applied.semantic.faction_field_fallback >= 5,
  'narrative faction extended fields should be counted');

context.GM = {
  armies: [
    { name:'soldiers', faction:'A', soldiers:10 },
    { name:'troops', faction:'A', troops:20 },
    { name:'size', faction:'B', size:30 },
    { name:'strength', faction:'A', strength:40 },
    { name:'initial', faction:'A', initialTroops:50 }
  ]
};
checkEq(context.DA.armies.totalTroops(), 150, 'DA.armies.totalTroops should read live army troop aliases');
checkEq(context.DA.armies.totalTroops('A'), 120, 'DA.armies.totalTroops should filter faction with live aliases');

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

context.GM = {
  turn: 23,
  facs: [{ id:'ming', name:'Ming' }, { id:'houjin', name:'Houjin' }],
  chars: [{ name:'KnownCommander', faction:'Ming' }],
  armies: [
    { id:'legacy_owner', name:'LegacyOwner', owner:'Ming' },
    { id:'known_cmd', name:'KnownCmdArmy', commander:'KnownCommander' },
    { id:'houjin_name', name:'Houjin Banner Army' },
    { id:'unknown', name:'Unknown Camp' }
  ]
};
let migArmyFac = context.TM.FactionMembership.migrateArmyOwnerToFaction();
checkEq(context.GM.armies[0].faction, 'Ming', 'army owner migration should preserve explicit owner');
checkEq(context.GM.armies[1].faction, 'Ming', 'army migration should infer faction from commander');
checkEq(context.GM.armies[2].faction, 'Houjin', 'army migration should infer faction from army name keyword');
check(!context.GM.armies[3].faction, 'army migration should not invent faction for unknown army');
check(migArmyFac.inferred >= 2, 'army migration should report inferred faction count');

context.GM = {
  turn: 40,
  armies: [{ id:'march1', name:'March Army', soldiers:1000, location:'OldTown', garrison:'OldTown', state:'garrison', supplyRatio:1 }],
  marchOrders: [],
  facs: [],
  chars: []
};
context.P = { battleConfig: { enabled:true, marchConfig:{ enabled:true } }, map: { enabled:false } };
let marchOrder = context.MarchSystem.createMarchOrder(context.GM.armies[0], 'OldTown', 'NewTown', { routeKm:30, terrainDifficulty:1, hasOfficialRoad:true });
check(marchOrder, 'MarchSystem should create enabled march order');
for (let i = 0; i < 5; i++) context.MarchSystem.advanceAll();
checkEq(context.GM.armies[0].location, 'NewTown', 'MarchSystem should update army.location on arrival');
checkEq(context.GM.armies[0].garrison, 'NewTown', 'MarchSystem should update army.garrison on arrival');
checkEq(context.GM.armies[0].state, 'garrison', 'MarchSystem should clear marching state on arrival');

context.GM = {
  turn: 41,
  armies: [{ id:'siege1', name:'Siege Army', faction:'WinnerFaction', soldiers:50000 }],
  activeSieges: [],
  cities: [{ id:'cityA', name:'CityA', owner:'OldFaction' }],
  provinceStats: { cityA: { owner:'OldFaction' } },
  facs: [],
  chars: []
};
context.P = { battleConfig: { enabled:true, siegeConfig:{ enabled:true, progressCoeff:10 } } };
context.setProvinceOwner = function(id, owner) {
  if (!context.GM.provinceStats[id]) context.GM.provinceStats[id] = {};
  context.GM.provinceStats[id].owner = owner;
};
let siege = context.SiegeSystem.createSiege(context.GM.armies[0], 'CityA', 0, 1000);
check(siege, 'SiegeSystem should create enabled siege');
context.SiegeSystem.advanceAll();
checkEq(context.GM.cities[0].owner, 'WinnerFaction', 'SiegeSystem should transfer city owner when city falls');
checkEq(context.GM.provinceStats.cityA.owner, 'WinnerFaction', 'SiegeSystem should transfer province owner when city falls');

context.GM = {
  armies: [
    { name:'Water', armyType:'navy', soldiers:100, morale:60, supply:70, training:80 },
    { name:'Inf', type:'infantry', soldiers:200, morale:50, supply:50, training:50 }
  ],
  population: { military: { types: {} } }
};
context.syncMilitarySources(context.GM);
check(context.GM.population.military.types.navy && context.GM.population.military.types.navy.strength === 100, 'syncMilitarySources should bucket by armyType');
check(context.GM.population.military.types.infantry && context.GM.population.military.types.infantry.strength === 200, 'syncMilitarySources should keep type bucket');

context.P = { playerInfo: { factionName:'PlayerFaction' }, battleConfig: { enabled:true } };
context.GM = {
  turn: 44,
  population: { military: { types: {} } },
  armies: [],
  facs: [{ name:'PlayerFaction', isPlayer:true }],
  chars: [{ name:'PlayerRuler', isPlayer:true, faction:'PlayerFaction' }]
};
let farm = context.PhaseB.registerMilitaryFarm({ name:'Hexi Farm', region:'Hexi', acres:300000, garrison:12000 });
check(farm && farm.linkedArmyId, 'military farm should record linked army id');
checkEq(context.GM.armies.length, 1, 'military farm should create one visible GM.armies unit');
checkEq(context.GM.armies[0].soldiers, 12000, 'military farm army soldiers should match garrison');
checkEq(context.GM.armies[0].faction, 'PlayerFaction', 'military farm army should belong to player faction');
check(context.GM.population.military.types.tuntian && context.GM.population.military.types.tuntian.strength === 12000,
  'military farm army should sync into military UI/stat source');

context.P = { playerInfo: { factionName:'PlayerFaction' }, battleConfig: { enabled:true } };
context.GM = {
  turn: 45,
  population: { military: { types: {} } },
  armies: [],
  facs: [{ name:'PlayerFaction', isPlayer:true }],
  chars: [{ name:'PlayerRuler', isPlayer:true, faction:'PlayerFaction' }],
  guoku: { money: 1000000, extraIncome: [], extraExpense: [] },
  neitang: { money: 500000, extraIncome: [], extraExpense: [] }
};
context.applyAITurnChanges({
  narrative: 'Imperial order recruits a new Shenji camp.',
  military_changes: [
    { armyName:'Shenji New Camp', delta:12000, faction:'PlayerFaction', location:'Capital', type:'firearms', reason:'edict recruitment' }
  ]
});
checkEq(context.GM.armies.length, 1, 'ai military_changes should create missing positive-delta army');
checkEq(context.GM.armies[0].name, 'Shenji New Camp', 'created army should preserve AI armyName');
checkEq(context.GM.armies[0].soldiers, 12000, 'created army soldiers should use positive delta');
checkEq(context.GM.armies[0].faction, 'PlayerFaction', 'created army should keep AI faction');
check(context.GM.population.military.types.firearms && context.GM.population.military.types.firearms.strength === 12000,
  'created army should sync into military UI/stat source');

context.GM.armies = [];
context.GM.population.military.types = {};
context.applyAITurnChanges({
  narrative: 'Court debate approves a new capital garrison.',
  army_changes: [
    { name:'Capital Garrison New Army', soldiers_delta:8000, faction:'PlayerFaction', location:'Capital', armyType:'infantry', reason:'court approval' }
  ]
});
checkEq(context.GM.armies.length, 1, 'ai army_changes should create missing positive-delta army');
checkEq(context.GM.armies[0].soldiers, 8000, 'army_changes created army soldiers should use soldiers_delta');
check(context.GM.population.military.types.infantry && context.GM.population.military.types.infantry.strength === 8000,
  'army_changes created army should sync into military UI/stat source');

context.GM.armies = [];
context.GM.population.military.types = {};
context.applyAITurnChanges({
  narrative: 'Approved memorial raises a guard unit through generic changes.',
  changes: [
    {
      path:'armies',
      op:'push',
      value:{ name:'Memorial Guard Unit', soldiers:6000, faction:'PlayerFaction', location:'Capital', armyType:'guards' },
      reason:'memorial approval'
    }
  ]
});
checkEq(context.GM.armies.length, 1, 'generic changes push should create one army');
check(context.GM.population.military.types.guards && context.GM.population.military.types.guards.strength === 6000,
  'generic changes pushed army should sync into military UI/stat source');

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
