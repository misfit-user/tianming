#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const WEB = path.resolve(__dirname, '..');
const attack = '<img src=x onerror="document.documentElement.dataset.tmScenarioXss=\'triggered\'">';
let assertions = 0;

function check(value, label) {
  if (!value) throw new Error('[smoke-scenario-renderer-html-boundary] ' + label);
  assertions += 1;
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function assertEscapedHtml(html, label) {
  check(!String(html).includes('<img'), label + ' does not create attacker markup');
  check(String(html).includes('&lt;img'), label + ' preserves attacker content as text');
}

function baseContext() {
  const em = { innerHTML: '' };
  const modal = { html: '' };
  const context = {
    console,
    JSON,
    Object,
    Array,
    Number,
    String,
    Boolean,
    Math,
    Date,
    parseInt,
    parseFloat,
    isFinite,
    editingScenarioId: 'scenario-1',
    escHtml: escapeHtml,
    uid() { return 'id-1'; },
    _$(id) { return id === 'em' ? em : null; },
    openGenericModal(_title, html) { modal.html = String(html); },
    closeGenericModal() {},
    gv() { return ''; },
    renderEdTab() {},
    toast() {},
    showLoading() {},
    hideLoading() {},
    callAISmart() { throw new Error('AI must not run in renderer boundary smoke'); },
    extractJSONMatch() { return null; }
  };
  context.window = context;
  context.globalThis = context;
  context.__em = em;
  context.__modal = modal;
  return context;
}

const editorContext = baseContext();
editorContext.P = {
  characters: [{
    name: attack,
    title: attack,
    faction: attack,
    stance: attack,
    desc: attack,
    personality: attack,
    appearance: attack,
    skills: [attack],
    dialogues: [attack],
    secret: attack,
    stats: { [attack]: 1 }
  }],
  items: [{ sid: 'scenario-1', type: attack, name: attack, desc: attack, effect: { [attack]: 1 }, prereq: attack }],
  rules: [{ sid: 'scenario-1', name: attack, enabled: true, trigger: { type: 'keyword', keywords: [attack] }, effect: { narrative: attack } }],
  events: [{ sid: 'scenario-1', name: attack, narrative: attack, choices: [] }],
  factions: [{ sid: 'scenario-1', name: attack, desc: attack }],
  classes: [{ sid: 'scenario-1', name: attack, desc: attack, privileges: attack, restrictions: attack, population: attack, influence: 0 }],
  world: { entries: [{ sid: 'scenario-1', category: attack, content: attack }], rules: attack },
  techTree: [{ sid: 'scenario-1', name: attack, desc: attack, era: attack, costs: [{ variable: attack, amount: 1 }] }],
  variables: [],
  scenarios: []
};
vm.createContext(editorContext);
vm.runInContext(fs.readFileSync(path.join(WEB, 'editor-details.js'), 'utf8'), editorContext, { filename: 'editor-details.js' });

editorContext.editChr(0);
assertEscapedHtml(editorContext.__em.innerHTML, 'character editor');
[
  'renderItmTab',
  'renderRulTab',
  'renderEvtTab',
  'renderFacTab',
  'renderClassTab',
  'renderWldTab',
  'renderTechTab'
].forEach((name) => {
  editorContext.__em.innerHTML = '';
  editorContext[name](editorContext.__em, 'scenario-1');
  assertEscapedHtml(editorContext.__em.innerHTML, name);
});

const officeSource = fs.readFileSync(path.join(WEB, 'tm-office-editor.js'), 'utf8');
const officeContext = baseContext();
officeContext.P = {
  conf: { style: attack, refText: attack },
  techTree: [{ sid: 'scenario-1', name: attack, desc: attack, era: attack, prereqs: [attack], effect: { value: attack } }],
  factions: [{ sid: 'scenario-1', name: attack, leader: attack, desc: attack, ideology: attack, territory: attack, strength: 50 }],
  rules: [{ sid: 'scenario-1', name: attack, enabled: true, trigger: { variable: attack, op: '<', value: 1 }, effect: { narrative: attack } }],
  events: [{ sid: 'scenario-1', name: attack, triggerTurn: 1, type: attack, narrative: attack, oneTime: true }],
  civicTree: [{ sid: 'scenario-1', name: attack, desc: attack }]
};
officeContext.document = { getElementById() { return null; }, createElement() { return { innerHTML: '', appendChild() {} }; } };
vm.createContext(officeContext);

const phase6Start = officeSource.indexOf('function _officeEditorEsc');
const phase6End = officeSource.indexOf('// ---- Feature 7', phase6Start);
check(phase6Start >= 0 && phase6End > phase6Start, 'office phase 6 source is discoverable');
vm.runInContext(officeSource.slice(phase6Start, phase6End), officeContext, { filename: 'tm-office-editor-phase6.js' });

['editTech', 'editFac', 'editRul', 'editEvt'].forEach((name) => {
  officeContext.__modal.html = '';
  officeContext[name](0);
  assertEscapedHtml(officeContext.__modal.html, name);
});
// renderTechTab / renderFacTab / renderRulTab / renderEvtTab：tm-office-editor.js 里的旧版从来没被用到
// （editor-details.js 后装载，整个换掉），2026-11-16 已删。现行版在上面 editorContext 那一段验过。
['renderTechTab', 'renderFacTab', 'renderRulTab', 'renderEvtTab'].forEach((name) => {
  check(typeof officeContext[name] !== 'function', 'tm-office-editor.js 不再带作废的 ' + name);
});

const civicStart = officeSource.indexOf('function renderCivicTab');
const civicEnd = officeSource.indexOf('// _addCivic', civicStart);
check(civicStart >= 0 && civicEnd > civicStart, 'civic renderer source is discoverable');
vm.runInContext(officeSource.slice(civicStart, civicEnd), officeContext, { filename: 'tm-office-editor-civic.js' });
officeContext.renderCivicTab(officeContext.__em);
assertEscapedHtml(officeContext.__em.innerHTML, 'renderCivicTab');

const deptStart = officeSource.indexOf('function _renderOfficeDept');
const deptEnd = officeSource.indexOf('function _officeAddTopDept', deptStart);
check(deptStart >= 0 && deptEnd > deptStart, 'office department renderer source is discoverable');
vm.runInContext(officeSource.slice(deptStart, deptEnd), officeContext, { filename: 'tm-office-editor-dept.js' });
const deptHtml = officeContext._renderOfficeDept({
  name: attack,
  desc: attack,
  functions: [attack],
  positions: [{ name: attack, rank: attack, holder: attack, desc: attack }],
  subs: []
}, [0], 0);
assertEscapedHtml(deptHtml, 'office tree renderer');

function sidebarNode() {
  return {
    id: '',
    style: {},
    children: [],
    innerHTML: '',
    appendChild(child) { this.children.push(child); return child; },
    remove() { this.removed = true; }
  };
}
function sidebarHtml(node) {
  return String(node.innerHTML || '') + (node.children || []).map(sidebarHtml).join('');
}
const sidebarRoot = sidebarNode();
const sidebarContext = {
  console,
  JSON,
  Object,
  Array,
  Number,
  String,
  Boolean,
  Math,
  Date,
  parseInt,
  parseFloat,
  isFinite,
  escHtml: escapeHtml,
  GameHooks: { on() {} },
  P: {
    goals: [{ name: attack, desc: attack, type: 'win', progress: 0 }],
    playerInfo: { coreContradictions: [] },
    adminHierarchy: { root: { divisions: [{ name: attack, terrain: attack, level: attack, prosperity: 0, governor: attack, children: [] }] } },
    officeConfig: { costVariables: [{ variable: attack, perDept: 1, perOfficial: 1 }] },
    palaceSystem: { enabled: true, capitalName: attack, palaces: [{ type: attack, subHalls: [] }] }
  },
  GM: {
    facs: [{ name: attack, type: attack, attitude: attack, color: attack, strength: 50 }],
    factionRelations: [{ from: attack, to: attack, type: attack, value: 0 }],
    armies: [{ name: attack, armyType: attack, commander: attack, garrison: attack, soldiers: 10, morale: 50, training: 50 }],
    classes: [{ name: attack, influence: 50, satisfaction: 50 }],
    parties: [{ name: attack, status: attack, influence: 50 }],
    items: [{ name: attack, type: attack, rarity: attack, effect: attack, owner: attack }],
    chars: [{ name: attack, alive: true, spouse: true, spouseRank: attack, loyalty: 50, favor: 0, children: [] }],
    harem: { heirs: [attack], pregnancies: [{ mother: attack }] },
    buildings: [{ category: attack, type: attack }],
    buildingQueue: [],
    events: [{ name: attack, type: attack, triggered: false }, { name: attack, type: attack, triggered: true }],
    officeTree: [{ positions: [{ holder: attack }], subs: [] }],
    vars: { [attack]: { value: 100 } },
    _indices: {}
  },
  _$(id) { return id === 'gl' ? sidebarRoot : null; },
  document: {
    createElement() { return sidebarNode(); },
    getElementById() { return null; }
  },
  findCharByName() { return null; },
  getHaremRankLevel() { return 1; },
  getHaremRankName() { return attack; },
  getHaremRankIcon() { return attack; }
};
sidebarContext.window = sidebarContext;
sidebarContext.globalThis = sidebarContext;
vm.createContext(sidebarContext);
vm.runInContext(fs.readFileSync(path.join(WEB, 'tm-sidebar-ui.js'), 'utf8'), sidebarContext, { filename: 'tm-sidebar-ui.js' });
sidebarContext.renderSidePanels();
assertEscapedHtml(sidebarHtml(sidebarRoot), 'game sidebar renderer');

const mapContext = {
  console,
  JSON,
  Object,
  Array,
  Number,
  String,
  Boolean,
  Math,
  Date,
  parseInt,
  parseFloat,
  isFinite,
  P: { map: { regions: [{ id: 'template-region' }] } },
  GM: { mapData: { enabled: true, regions: [{ id: 'runtime-region' }] }, facs: [], chars: [], _useAIGeo: false },
  getLiveMapData() { return mapContext.GM.mapData; },
  getTerrainName(value) { return value; },
  document: {
    body: { appendChild() {} },
    documentElement: { dataset: {} },
    createElement() { return { id: '', innerHTML: '', addEventListener() {} }; },
    addEventListener() {},
    getElementById(id) {
      if (id === 'game-map-mode') return { value: 'owner', onchange: null };
      if (id === 'game-map-labels') return { checked: false, onchange: null };
      if (id === 'game-map-info') return { innerHTML: '' };
      return null;
    }
  }
};
mapContext.window = mapContext;
mapContext.globalThis = mapContext;
vm.createContext(mapContext);
vm.runInContext(fs.readFileSync(path.join(WEB, 'map-display.js'), 'utf8'), mapContext, { filename: 'map-display.js' });
let renderedMap = null;
mapContext.renderGameMap = function(_container, map) { renderedMap = map; };
mapContext.showMapInGame();
check(renderedMap === mapContext.GM.mapData, 'game map UI renders the live GM map rather than the P template');
const provinceHtml = mapContext.showProvinceDetails({
  name: attack,
  owner: attack,
  terrain: attack,
  resources: [attack],
  development: 0,
  troops: 0,
  characters: []
});
assertEscapedHtml(provinceHtml, 'province detail renderer');
check(!mapContext.document.documentElement.dataset.tmScenarioXss, 'scenario payload never executes during renderer smoke');

console.log('[smoke-scenario-renderer-html-boundary] PASS assertions=' + assertions);
