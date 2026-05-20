#!/usr/bin/env node
/* eslint-env node */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const HEADLESS = path.join(__dirname, 'headless-smoke.js');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function loadHeadlessHelpers() {
  const source = fs.readFileSync(HEADLESS, 'utf8')
    .replace(/^#![^\n]*\n/, '')
    .replace(/\nmain\(\);\s*$/, '\nreturn { makeStubs, parseIndexHtmlScripts };');
  const factory = new Function('require', 'process', '__dirname', '__filename', 'module', 'exports', source);
  return factory(require, process, __dirname, HEADLESS, { exports: {} }, {});
}

const helpers = loadHeadlessHelpers();

function installNodeExtras(win) {
  win.location.href = 'http://localhost/index.html';
  win.location.search = '';
  win.fetch = function () {
    return Promise.resolve({
      ok: true,
      status: 200,
      headers: { get() { return ''; } },
      text() { return Promise.resolve('{}'); },
      json() { return Promise.resolve({ ok: true }); }
    });
  };
}

function loadGame() {
  const env = helpers.makeStubs();
  installNodeExtras(env.win);
  const sandbox = vm.createContext(env.win);
  const scripts = helpers.parseIndexHtmlScripts();
  const loadScripts = scripts.filter((src) => path.basename(src) !== 'tm-test-harness.js');

  loadScripts.forEach((src) => {
    const abs = path.join(ROOT, src);
    assert(fs.existsSync(abs), 'script missing: ' + src);
    const code = fs.readFileSync(abs, 'utf8');
    vm.runInContext(code, sandbox, { filename: src, displayErrors: true, timeout: 10000 });
  });

  return sandbox;
}

function makeClassList() {
  const values = new Set();
  return {
    add() { Array.from(arguments).forEach((v) => values.add(String(v))); },
    remove() { Array.from(arguments).forEach((v) => values.delete(String(v))); },
    contains(v) { return values.has(String(v)); },
    toggle(v, force) {
      if (force === true) { values.add(String(v)); return true; }
      if (force === false) { values.delete(String(v)); return false; }
      if (values.has(String(v))) { values.delete(String(v)); return false; }
      values.add(String(v)); return true;
    },
    toString() { return Array.from(values).join(' '); }
  };
}

function installTrackedDom(sandbox) {
  const doc = sandbox.document;
  const baseCreate = doc.createElement.bind(doc);
  const registry = Object.create(null);

  function register(node) {
    if (node && node.id) registry[node.id] = node;
    return node;
  }

  function makeNode(tag, id) {
    const node = baseCreate(tag || 'div');
    node.id = id || '';
    node.children = [];
    node.style = {};
    node.dataset = {};
    node.classList = makeClassList();
    node.appendChild = function (child) {
      this.children.push(child);
      if (child && child.id) registry[child.id] = child;
      return child;
    };
    node.removeChild = function (child) {
      this.children = this.children.filter((x) => x !== child);
      if (child && child.id && registry[child.id] === child) delete registry[child.id];
      return child;
    };
    node.insertBefore = function (child) {
      this.children.unshift(child);
      if (child && child.id) registry[child.id] = child;
      return child;
    };
    node.remove = function () {
      if (node.id && registry[node.id] === node) delete registry[node.id];
    };
    node.querySelector = function (sel) {
      if (typeof sel === 'string' && sel.charAt(0) === '#') return registry[sel.slice(1)] || null;
      return null;
    };
    node.querySelectorAll = function () { return []; };
    node.addEventListener = function () {};
    node.removeEventListener = function () {};
    node.setAttribute = function (key, value) { this.attributes = this.attributes || {}; this.attributes[key] = String(value); };
    node.getAttribute = function (key) { return this.attributes && this.attributes[key] || null; };
    return register(node);
  }

  doc.createElement = function (tag) { return makeNode(tag); };
  doc.createElementNS = function (_ns, tag) { return makeNode(tag); };
  doc.getElementById = function (id) { return registry[id] || null; };
  doc.querySelector = function (sel) {
    if (typeof sel === 'string' && sel.charAt(0) === '#') return registry[sel.slice(1)] || null;
    return null;
  };
  doc.querySelectorAll = function () { return []; };
  doc.body = makeNode('body');
  doc.head = makeNode('head');
  doc.documentElement = makeNode('html');
}

const LIAODONG = '\u8fbd\u4e1c';
const MING = '\u660e\u671d\u5ef7';
const HOUJIN = '\u540e\u91d1';
const OLD_OFFICIAL = '\u65e7\u5b88\u4ee4';
const LIVE_OFFICIAL = '\u65b0\u5b88\u4ee4';
const LIVE_TERRAIN = 'LIVE terrain field 901';
const OLD_TERRAIN = 'OLD terrain field 101';
const LIVE_RESOURCE = 'LIVE resource field 902';
const OLD_RESOURCE = 'OLD resource field 102';
const LIVE_CULTURE = 'LIVE culture field 903';
const OLD_CULTURE = 'OLD culture field 103';
const LIVE_STRATEGIC = 'LIVE strategic field 904';
const OLD_STRATEGIC = 'OLD strategic field 104';
const LIVE_COMMANDER = 'LIVE commander field 905';
const OLD_COMMANDER = 'OLD commander field 105';
const LIVE_THREAT = 'LIVE threat field 906';
const OLD_THREAT = 'OLD threat field 106';
const LIVE_TRADE = 'LIVE trade field 907';
const OLD_TRADE = 'OLD trade field 107';
const LIVE_DISASTER = 'LIVE disaster field 908';
const OLD_DISASTER = 'OLD disaster field 108';
const LIVE_GENTRY = 'LIVE gentry field 909';
const OLD_GENTRY = 'OLD gentry field 109';
const LIVE_FACTION_GOAL = 'LIVE faction goal field 920';
const OLD_FACTION_GOAL = 'OLD faction goal field 120';
const LIVE_FACTION_RELATIONS = 'LIVE faction relations field 921';
const OLD_FACTION_RELATIONS = 'OLD faction relations field 121';
const OLD_HOUJIN_LABEL = '\u65e7\u540e\u91d1\u6807\u7b7e';
const LIVE_HOUJIN_LABEL = '\u5927\u91d1\u56fd';
const LIVE_LEADER = '\u7687\u592a\u6781';
const LIVE_ARMY_TOTAL = 2468;
const ALIAS_REGION = '\u5e7f\u5b81';
const ALIAS_GOV = '\u5b59\u627f\u5b97';
const ALIAS_OFFICE = '\u7ecf\u7565';
const ALIAS_COMMANDER = '\u8d75\u7387\u6559';

const sandbox = loadGame();
installTrackedDom(sandbox);

sandbox.GM = sandbox.GM || {};
sandbox.P = sandbox.P || {};
sandbox.GM.mapData = {
  id: 'phase8-live-panel-test',
  width: 1200,
  height: 720,
  factions: {
    ming: { label: MING, name: MING, leader: '\u65e7\u7687\u5e1d', color: '#a33' },
    houjin: {
      label: OLD_HOUJIN_LABEL,
      name: OLD_HOUJIN_LABEL,
      leader: '\u65e7\u9996\u9886',
      color: '#36a',
      goal: OLD_FACTION_GOAL,
      relations: OLD_FACTION_RELATIONS,
      treasury: 111,
      economy: 112,
      militaryStrength: 113
    }
  },
  regions: [{
    id: 'region-liaodong',
    name: LIAODONG,
    ownerKey: 'ming',
    controllerKey: 'OLD controller key field 120',
    type: 'OLD region type field 121',
    troops: 555,
    armyPressure: 44,
    terrain: OLD_TERRAIN,
    resources: OLD_RESOURCE,
    data: {
      name: LIAODONG,
      factionId: 'ming',
      ownerName: MING,
      governor: OLD_OFFICIAL,
      officialPosition: 'OLD office field 110',
      terrain: OLD_TERRAIN,
      specialResources: OLD_RESOURCE,
      specialCulture: OLD_CULTURE,
      strategicValue: OLD_STRATEGIC,
      populationDetail: { mouths: 1000, households: 200 },
      fiscalDetail: { actualRevenue: 100, claimedRevenue: 120, remittedToCenter: 130, retainedBudget: 140, compliance: 0.31, skimmingRate: 0.41, autonomy: 'OLD fiscal autonomy field 118', taxBurden: 'OLD tax burden field 119' },
      publicTreasuryInit: { money: 150, grain: 1000, cloth: 160 },
      armyDetail: { troops: 500, commander: OLD_COMMANDER, supply: 'OLD supply field 111' },
      garrison: 500,
      armyPressure: 45,
      fortification: 46,
      commander: OLD_COMMANDER,
      borderRisk: 'OLD border field 112',
      supply: 'OLD supply field 111',
      minxinLocal: 40,
      corruptionLocal: 20,
      policyExecution: 'OLD execution field 113',
      localFaction: 'OLD local faction field 114',
      leadingGentry: OLD_GENTRY,
      academies: 'OLD academy field 115',
      religiousSites: 'OLD temple field 116',
      bySettlement: 'OLD settlement field 117',
      tradeRoutes: OLD_TRADE,
      recentDisasters: OLD_DISASTER,
      threats: OLD_THREAT,
      economyBase: {
        farmland: 170,
        commerceVolume: 180,
        saltProduction: 190,
        mineralProduction: 191,
        horseProduction: 192,
        roadQuality: 193,
        postRelays: 194
      }
    }
  }]
};
sandbox.P.map = sandbox.GM.mapData;
sandbox.P.mapData = sandbox.GM.mapData;
sandbox.GM._provinceToFaction = { [LIAODONG]: HOUJIN };
sandbox.GM.provinceStats = {
  [LIAODONG]: {
    name: LIAODONG,
    owner: HOUJIN,
    level: 'LIVE region level field 935',
    governor: LIVE_OFFICIAL,
    officialPosition: 'LIVE office field 910',
    terrain: LIVE_TERRAIN,
    specialResources: LIVE_RESOURCE,
    specialCulture: LIVE_CULTURE,
    strategicValue: LIVE_STRATEGIC,
    population: 9000,
    households: 2100,
    ding: 3100,
    fugitives: 41,
    hiddenCount: 52,
    taxRevenue: 777,
    claimedRevenue: 999,
    remittedToCenter: 778,
    retainedBudget: 779,
    compliance: 0.82,
    skimmingRate: 0.18,
    taxBurden: 'LIVE tax burden field 934',
    grain: 3210,
    money: 8765,
    cloth: 9876,
    soldiers: 1234,
    armyPressure: 77,
    fortification: 78,
    commander: LIVE_COMMANDER,
    borderRisk: 'LIVE border field 911',
    supply: 'LIVE supply field 912',
      minxin: 33,
      corruption: 66,
      prosperity: 67,
      carryingCapacity: 6789,
      baojia: 'LIVE baojia field 918',
      byGender: 'LIVE gender field 919',
      byAge: 'LIVE age field 920',
      byEthnicity: 'LIVE ethnicity field 921',
      byFaith: 'LIVE faith field 922',
      officeVacancy: 'LIVE vacancy field 923',
      taxLevel: 'LIVE tax level field 924',
      fiscalAutonomy: 'LIVE fiscal autonomy field 925',
      dejureOwner: 'LIVE dejure field 926',
      controllerKey: 'LIVE controller key field 927',
      coreStatus: 'LIVE core field 928',
      ownerHistory: 'LIVE owner history field 929',
      note: 'LIVE note field 930',
      navy: 'LIVE navy field 931',
      policyExecution: 'LIVE execution field 913',
      localFaction: 'LIVE local faction field 914',
      leadingGentry: LIVE_GENTRY,
    academies: 'LIVE academy field 915',
    religiousSites: 'LIVE temple field 916',
    bySettlement: 'LIVE settlement field 917',
    tradeRoutes: LIVE_TRADE,
    recentDisasters: LIVE_DISASTER,
    threats: LIVE_THREAT
  }
};
sandbox.GM.adminHierarchy = {
  player: {
    divisions: [{
      name: LIAODONG,
      owner: HOUJIN,
      governor: LIVE_OFFICIAL,
      populationDetail: { mouths: 9000, households: 2100 },
      fiscalDetail: { actualRevenue: 777 },
      publicTreasuryInit: { money: 4321, grain: 3210, cloth: 5432 },
      armyDetail: { troops: 1234 },
      minxinLocal: 33,
      corruptionLocal: 66,
      economyBase: {
        farmland: 971,
        commerceVolume: 972,
        saltProduction: 973,
        mineralProduction: 974,
        horseProduction: 975,
        roadQuality: 976,
        postRelays: 977,
        kejuQuota: 'LIVE keju field 932',
        imperialAssets: { zhizao: 'LIVE zhizao field 933' }
      }
    }]
  }
};
sandbox.GM.facs = [{
  id: 'houjin',
  name: HOUJIN,
  label: LIVE_HOUJIN_LABEL,
  leader: LIVE_LEADER,
  leaderTitle: 'LIVE leader title field 934',
  type: 'LIVE faction type field 935',
  government: 'LIVE government field 936',
  capital: 'LIVE capital field 937',
  goal: LIVE_FACTION_GOAL,
  strategy: 'LIVE strategy field 938',
  ideology: 'LIVE ideology field 939',
  culture: 'LIVE faction culture field 940',
  members: 'LIVE members field 941',
  openingProblems: 'LIVE opening problems field 942',
  territory: 'LIVE territory field 943',
  resources: 'LIVE faction resource field 944',
  militaryBreakdown: 'LIVE military breakdown field 945',
  warState: 'LIVE war state field 946',
  mobilization: 'LIVE mobilization field 947',
  strategicPriorities: 'LIVE strategic priorities field 948',
  decisionHints: 'LIVE decision hints field 949',
  tabooMoves: 'LIVE taboo moves field 950',
  economicStructure: 'LIVE economic structure field 951',
  economicPolicy: 'LIVE economic policy field 952',
  publicOpinion: 'LIVE public opinion field 953',
  techLevel: 'LIVE tech field 954',
  cultureLevel: 'LIVE culture level field 955',
  succession: 'LIVE succession field 956',
  cohesion: 'LIVE cohesion field 957',
  strengths: 'LIVE strengths field 958',
  weaknesses: 'LIVE weaknesses field 959',
  relations: LIVE_FACTION_RELATIONS,
  allies: 'LIVE allies field 960',
  enemies: 'LIVE enemies field 961',
  neutrals: 'LIVE neutrals field 962',
  attitude: 'LIVE attitude field 963',
  playerRelation: 'LIVE player relation field 964',
  offendThresholds: 'LIVE offend field 965',
  knownSpies: 'LIVE spies field 966',
  internalParties: 'LIVE internal parties field 967',
  partyRelations: 'LIVE party relations field 968',
  description: 'LIVE description field 969',
  history: 'LIVE history field 970',
  historicalEvents: 'LIVE events field 971',
  aiProfile: 'LIVE ai profile field 972',
  longTermStrategy: 'LIVE long strategy field 973',
  victoryConditions: 'LIVE victory field 974',
  defeatConditions: 'LIVE defeat field 975',
  treasury: 9999,
  economy: 88,
  militaryStrength: 4567
}];
sandbox.GM.armies = [{
  id: 'army-live-houjin',
  name: '\u540e\u91d1\u6b63\u9ec4\u65d7',
  faction: HOUJIN,
  soldiers: LIVE_ARMY_TOTAL,
  commander: '\u591a\u5c14\u886e'
}];
sandbox.TMMapRuntime = {
  getMap() { return sandbox.GM.mapData; }
};
sandbox.window.TMMapRuntime = sandbox.TMMapRuntime;

assert(sandbox.TMPhase8FormalBridge, 'TMPhase8FormalBridge missing');
assert(typeof sandbox.TMPhase8FormalBridge.openRegionById === 'function', 'openRegionById missing');
assert(typeof sandbox.TMPhase8FormalBridge.openFactionByKey === 'function', 'openFactionByKey missing');
assert(typeof sandbox.TMPhase8FormalBridge.openRegionTab === 'function', 'openRegionTab missing');
assert(typeof sandbox.TMPhase8FormalBridge.openFactionTab === 'function', 'openFactionTab missing');

function ppopHtml() {
  const pop = sandbox.document.getElementById('ppop');
  return pop && pop.innerHTML || '';
}

function assertAll(html, values, context) {
  values.forEach((value) => assert(html.includes(value), context + ' missing: ' + value));
}

function assertNone(html, values, context) {
  values.forEach((value) => assert(!html.includes(value), context + ' stale: ' + value));
}

function regionTab(tab) {
  sandbox.TMPhase8FormalBridge.openRegionTab('region-liaodong', tab);
  return ppopHtml();
}

function regionTabById(id, tab) {
  sandbox.TMPhase8FormalBridge.openRegionTab(id, tab);
  return ppopHtml();
}

function factionTab(tab) {
  sandbox.TMPhase8FormalBridge.openFactionTab('houjin', tab);
  return ppopHtml();
}

sandbox.TMPhase8FormalBridge.openRegionById('region-liaodong');
const regionHtml = ppopHtml();
assert(regionHtml.includes(LIVE_OFFICIAL), 'region panel did not prefer live governor');
assert(!regionHtml.includes(OLD_OFFICIAL), 'region panel still shows stale governor');
assert(regionHtml.includes(HOUJIN) || regionHtml.includes(LIVE_HOUJIN_LABEL), 'region panel did not follow live owner');
assert(regionHtml.includes('9000') || regionHtml.includes('9,000'), 'region panel did not show live population');
assert(regionHtml.includes('777'), 'region panel did not show live revenue');
assert(regionHtml.includes('66'), 'region panel did not show live corruption');
assertAll(regionHtml, [
  LIVE_TERRAIN,
  'LIVE region level field 935',
  LIVE_RESOURCE,
  LIVE_CULTURE,
  LIVE_STRATEGIC,
  LIVE_COMMANDER,
  LIVE_THREAT,
  LIVE_TRADE,
  LIVE_DISASTER,
  LIVE_GENTRY,
  'LIVE office field 910',
  '1234',
  '77',
  '8765',
  '9876',
  '971',
  '976',
  '977'
], 'region overview');
assertNone(regionHtml, [
  OLD_TERRAIN,
  OLD_RESOURCE,
  OLD_CULTURE,
  OLD_STRATEGIC,
  OLD_COMMANDER,
  OLD_THREAT,
  OLD_TRADE,
  OLD_DISASTER,
  OLD_GENTRY,
  'OLD office field 110',
  '555',
  'OLD region type field 121'
], 'region overview');

assertAll(regionTab('mood'), ['9000', '2100', '3100', '41', '52', '33', '67', '6789', 'LIVE baojia field 918', 'LIVE gender field 919', 'LIVE age field 920', 'LIVE ethnicity field 921', 'LIVE faith field 922', 'LIVE settlement field 917', 'LIVE temple field 916', LIVE_DISASTER], 'region mood tab');
assertAll(regionTab('tax'), ['999', '777', '778', '779', '82%', '18%', 'LIVE fiscal autonomy field 925', 'LIVE tax burden field 934', '8765', '3210', '9876', 'LIVE tax level field 924'], 'region tax tab');
assertAll(regionTab('army'), ['1234', '77', '78', LIVE_COMMANDER, 'LIVE border field 911', 'LIVE supply field 912', LIVE_STRATEGIC, LIVE_THREAT, LIVE_TRADE, '976', '977', '975', 'LIVE navy field 931'], 'region army tab');
assertAll(regionTab('office'), ['LIVE office field 910', LIVE_OFFICIAL, 'LIVE vacancy field 923', '66', 'LIVE execution field 913', 'LIVE local faction field 914', LIVE_GENTRY, 'LIVE academy field 915', 'LIVE tax level field 924', 'LIVE keju field 932', 'LIVE zhizao field 933', 'LIVE note field 930'], 'region office tab');
assertAll(regionTab('owner'), [LIVE_HOUJIN_LABEL, HOUJIN, 'LIVE dejure field 926', 'LIVE controller key field 927', 'LIVE core field 928', 'LIVE owner history field 929'], 'region owner tab');
const allRegionTabsHtml = ['overview', 'mood', 'tax', 'army', 'office', 'owner'].map(regionTab).join('\n');
assertNone(allRegionTabsHtml, [OLD_TERRAIN, OLD_RESOURCE, OLD_CULTURE, OLD_STRATEGIC, OLD_COMMANDER, OLD_THREAT, OLD_TRADE, OLD_DISASTER, OLD_GENTRY, 'OLD office field 110', '555', 'OLD supply field 111', 'OLD border field 112', 'OLD execution field 113', 'OLD local faction field 114', 'OLD fiscal autonomy field 118', 'OLD tax burden field 119', 'OLD controller key field 120'], 'region all tabs');

sandbox.TMPhase8FormalBridge.openFactionByKey('houjin');
const factionHtml = ppopHtml();
assert(factionHtml.includes(LIVE_HOUJIN_LABEL), 'faction panel did not prefer live faction label');
assert(!factionHtml.includes(OLD_HOUJIN_LABEL), 'faction panel still shows stale map faction label');
assert(factionHtml.includes(LIVE_LEADER), 'faction panel did not show live faction leader');
assert(factionHtml.includes(LIAODONG), 'faction panel did not include live-owned region');
assert(factionHtml.includes('9000') || factionHtml.includes('9,000'), 'faction panel aggregate did not use live population');
assert(factionHtml.includes('777'), 'faction panel aggregate did not use live revenue');
assert(factionHtml.includes(String(LIVE_ARMY_TOTAL)) || factionHtml.includes('2,468'), 'faction panel did not use live army index troop count');
assertAll(factionTab('overview'), [LIVE_HOUJIN_LABEL, LIVE_LEADER, 'LIVE leader title field 934', 'LIVE faction type field 935', 'LIVE government field 936', 'LIVE capital field 937', LIVE_FACTION_GOAL, 'LIVE ideology field 939', 'LIVE faction culture field 940', 'LIVE opening problems field 942'], 'faction overview tab');
assertAll(factionTab('territory'), [LIAODONG, '9000', 'LIVE territory field 943', 'LIVE faction resource field 944', LIVE_THREAT, LIVE_TRADE], 'faction territory tab');
assertAll(factionTab('military'), [String(LIVE_ARMY_TOTAL), 'LIVE military breakdown field 945', 'LIVE war state field 946', 'LIVE mobilization field 947', 'LIVE strategic priorities field 948', 'LIVE decision hints field 949', 'LIVE taboo moves field 950', LIVE_THREAT], 'faction military tab');
assertAll(factionTab('finance'), ['88', '9999', 'LIVE economic structure field 951', 'LIVE economic policy field 952', 'LIVE public opinion field 953', 'LIVE tech field 954', 'LIVE culture level field 955', 'LIVE succession field 956', 'LIVE cohesion field 957', 'LIVE strengths field 958', 'LIVE weaknesses field 959', 'LIVE faction resource field 944'], 'faction finance tab');
assertAll(factionTab('relations'), [LIVE_FACTION_RELATIONS, 'LIVE allies field 960', 'LIVE enemies field 961', 'LIVE neutrals field 962', 'LIVE attitude field 963', 'LIVE player relation field 964', 'LIVE offend field 965', 'LIVE spies field 966', 'LIVE internal parties field 967', 'LIVE party relations field 968'], 'faction relations tab');
assertAll(factionTab('records'), ['LIVE description field 969', 'LIVE history field 970', 'LIVE events field 971', 'LIVE ai profile field 972', 'LIVE long strategy field 973', 'LIVE victory field 974', 'LIVE defeat field 975'], 'faction records tab');
const allFactionTabsHtml = ['overview', 'territory', 'military', 'finance', 'relations', 'records'].map(factionTab).join('\n');
assertNone(allFactionTabsHtml, [OLD_HOUJIN_LABEL, OLD_FACTION_GOAL, OLD_FACTION_RELATIONS, '\u65e7\u9996\u9886'], 'faction all tabs');

sandbox.GM.mapData.regions.push({
  id: 'region-alias-guangning',
  name: ALIAS_REGION,
  ownerKey: 'ming',
  data: {
    name: ALIAS_REGION,
    ownerName: MING,
    governor: OLD_OFFICIAL,
    officialPosition: 'OLD alias office field',
    armyDetail: { commander: OLD_COMMANDER },
    garrison: 100
  }
});
sandbox.GM.provinceStats[ALIAS_REGION] = {
  name: ALIAS_REGION,
  currentOwnerName: HOUJIN,
  governorName: ALIAS_GOV,
  officialTitle: ALIAS_OFFICE,
  troops: 3456,
  armyDetail: { commanderName: ALIAS_COMMANDER, supply: 'ALIAS supply field' }
};
sandbox.TMPhase8FormalBridge.openRegionById('region-alias-guangning');
const aliasRegionHtml = ppopHtml();
assertAll(aliasRegionHtml, [ALIAS_REGION, HOUJIN, ALIAS_GOV, ALIAS_OFFICE], 'region alias overview');
assertNone(aliasRegionHtml, [OLD_OFFICIAL, 'OLD alias office field'], 'region alias overview');
assertAll(regionTabById('region-alias-guangning', 'army'), ['3456', ALIAS_COMMANDER, 'ALIAS supply field'], 'region alias army tab');

sandbox.GM.armies.push({
  id: 'army-alias-commander',
  name: '\u522b\u540d\u519b',
  faction: MING,
  soldiers: 1111,
  commanderDisplayName: ALIAS_COMMANDER,
  generalName: ALIAS_COMMANDER,
  state: 'garrison'
});
sandbox.GM.running = true;
sandbox.P.playerInfo = { factionName: MING };
const gameRoot = sandbox.document.createElement('div');
gameRoot.id = 'G';
gameRoot.style.display = 'block';
sandbox.document.body.appendChild(gameRoot);
sandbox.TMPhase8FormalBridge.openPanel('army');
const rightPanel = sandbox.document.getElementById('tm-phase8-formal-panel');
const armyPanelHtml = rightPanel && rightPanel.innerHTML || '';
assertAll(armyPanelHtml, ['\u522b\u540d\u519b', ALIAS_COMMANDER], 'right army panel alias commander');
const bridgeSource = fs.readFileSync(path.join(ROOT, 'phase8-formal-bridge.js'), 'utf8');
assert(bridgeSource.includes("garrison: '驻防'"), 'right army detail should localize raw garrison state');

console.log('[smoke-phase8-map-live-panels] PASS');
process.exit(0);
