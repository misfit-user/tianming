#!/usr/bin/env node
// smoke-formal-player-action-only.js - 主角行止 can be submitted without an edict body.

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

function assert(cond, msg) {
  if (!cond) throw new Error('[assert] ' + msg);
}

function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function makeEl(overrides) {
  const attrs = Object.create(null);
  return Object.assign({
    id: '',
    className: '',
    value: '',
    textContent: '',
    innerHTML: '',
    dataset: {},
    style: { cssText: '' },
    classList: { add(){}, remove(){}, toggle(){ return false; }, contains(){ return false; } },
    appendChild(child){ return child; },
    removeChild(child){ return child; },
    insertBefore(child){ return child; },
    addEventListener(){},
    removeEventListener(){},
    querySelector(){ return null; },
    querySelectorAll(){ return []; },
    closest(){ return null; },
    focus(){},
    remove(){},
    setAttribute(name, value){ attrs[name] = String(value); this[name] = value; },
    getAttribute(name){ return attrs[name] || null; },
    hasAttribute(name){ return Object.prototype.hasOwnProperty.call(attrs, name); }
  }, overrides || {});
}

const selectorValues = new Map();
const appended = [];
const overlayRoot = makeEl({
  querySelector(selector) {
    if (!selectorValues.has(selector)) return null;
    return makeEl({ value: selectorValues.get(selector) });
  },
  querySelectorAll() { return []; }
});

const documentStub = {
  body: makeEl({ appendChild(el){ appended.push(el); return el; } }),
  head: makeEl({ appendChild(el){ appended.push(el); return el; } }),
  readyState: 'complete',
  createElement(tag) { return makeEl({ tagName: String(tag || '').toUpperCase() }); },
  getElementById() { return null; },
  querySelector(selector) {
    if (selector === '.tm-desk-overlay') return overlayRoot;
    if (selectorValues.has(selector)) return makeEl({ value: selectorValues.get(selector) });
    return null;
  },
  querySelectorAll() { return []; },
  addEventListener(){},
  removeEventListener(){}
};

const toastMessages = [];
const parserCalls = [];

const sandbox = {
  console,
  Math, Date, JSON, RegExp, Error, Promise,
  Array, Object, String, Number, Boolean,
  parseInt, parseFloat, isNaN, isFinite,
  setTimeout: (fn) => { if (typeof fn === 'function') fn(); return 1; },
  clearTimeout(){},
  document: documentStub,
  window: {},
  navigator: { userAgent: 'node' },
  localStorage: { getItem: () => null, setItem(){}, removeItem(){} },
  performance: { now: () => Date.now() },
  alert(){},
  confirm: () => true,
  prompt: () => null,
  addEB(){},
  renderEventFeed(){},
  renderMemorials(){},
  renderLetterPanel(){},
  renderJishi(){},
  renderQiju(){},
  renderBiannian(){},
  renderGameState(){},
  EdictParser: { tryExecute(){ parserCalls.push(Array.from(arguments)); return { ok: true }; } }
};
sandbox.window = sandbox;
sandbox.global = sandbox;
sandbox.globalThis = sandbox;
sandbox.P = {
  playerInfo: { characterName: '陛下' },
  conf: { partyClassLlmEnabled: true }
};
sandbox.GM = {
  turn: 41,
  qijuHistory: [],
  _chronicle: [],
  _edictTracker: [],
  parties: [
    { name: '清议党', tags: ['court'], currentAgenda: '观察君主行止与皇威' }
  ],
  classes: [
    { name: '京城士民', tags: ['capital'], demands: '愿见天子亲问疾苦' }
  ]
};
sandbox.scriptData = sandbox.GM;
sandbox.getTSText = turn => 'T' + turn;

const bridge = {
  _state: { activePanel: 'desk', letterDraft: {}, edictDrafts: {}, playerAction: '' },
  _esc: esc,
  _attr: esc,
  _asset: v => v,
  _fmtNum: v => String(v),
  _miniRows: () => '',
  _actionButton: () => '',
  _moduleShell: () => '',
  _dossierRows: () => '',
  _ownerKey: () => '',
  _ownerName: () => '',
  _findFaction: () => null,
  _findPerson: name => ({ name, alive: true }),
  _personKey: p => p && (p.name || p.id) || '',
  _personNameKey: p => String(p && (p.name || p.id) || '').replace(/\s+/g, ''),
  _getPeople: () => [],
  _getMapData: () => ({ regions: [] }),
  _getParties: () => sandbox.GM.parties,
  _getClasses: () => sandbox.GM.classes,
  _collectRecentEvents: () => [],
  _getTurnText: turn => 'T' + (turn || sandbox.GM.turn || 1),
  _firstArray: (...args) => args.find(Array.isArray) || [],
  _compactText: (v, n) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, n || 160),
  _getMemorials: () => [],
  _getIssues: () => [],
  _getLetters: () => [],
  _getActiveScenario: () => ({}),
  _getArmies: () => [],
  _issueIsResolved: () => false,
  _tmfRenwuPortrait: () => '',
  _fullHongyanText: l => l && (l.content || l.body || ''),
  _toast(text){ toastMessages.push(String(text || '')); },
  _cssEscape: v => String(v || '').replace(/"/g, '\\"'),
  _clearFormalDraftStore(){},
  _openChaoyiMode(){},
  _openShizhengPreviewPanel(){},
  _closeModule(){},
  _returnFormalHomeSoon(){},
  _saveFormalDraftsToGM(){},
  _restoreFormalDraftsFromGM(){},
  _handleModuleAction(){},
  _updateRailBadges(){},
  _renderEventFeed(){},
  openPanel(){},
  openModule(){},
  openGuoku(){}
};
sandbox.TMPhase8FormalBridge = bridge;

vm.createContext(sandbox);

function load(file) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox, { filename: file });
}

(function main() {
  load('tm-player-action-signals.js');
  load('phase8-formal-drafts.js');
  load('phase8-formal-drafts-message-panels.js'); // 第二十六拆：奏疏/鸿雁面板迁出·须紧随 origin 装载(origin-first 双向 bucket)

  assert(bridge.drafts && typeof bridge.drafts.handleDeskAction === 'function', 'formal drafts should expose handleDeskAction');

  selectorValues.set('#xinglu-pub', '微服私访东市，亲问京城士民疾苦，夜召清议党臣工问对。');
  selectorValues.set('[data-desk-player-action]', '微服私访东市，亲问京城士民疾苦，夜召清议党臣工问对。');
  bridge.drafts.handleDeskAction('publish-edict-desk', {});

  assert(!sandbox.GM._edictTracker.length, 'xinglu-only submission should not create an edict tracker item');
  assert(parserCalls.length === 0, 'xinglu-only submission should not call EdictParser');
  assert(sandbox.GM.qijuHistory.some(q => q && q.category === '行止' && /微服私访东市/.test(q.xinglu || '')), 'xinglu-only submission should write structured qijuHistory.xinglu');
  assert(sandbox.GM._chronicle.some(c => c && c.type === '行止' && /亲问京城士民/.test(c.text || '')), 'xinglu-only submission should be visible in chronicle records');

  const playerItems = sandbox.GM._playerActionSignals && sandbox.GM._playerActionSignals.items || [];
  const signal = playerItems.find(s => s && s.source === 'phase8-desk' && s.action === 'player-action-desk');
  assert(signal && /夜召清议党臣工问对/.test(signal.text || ''), 'xinglu-only submission should record the actual player action text');
  assert(signal.policyTags && signal.policyTags.includes('xinglu'), 'xinglu-only player action signal should carry xinglu tag');
  assert(toastMessages.some(t => /主角行止|行止/.test(t)), 'xinglu-only submission should tell the player it was recorded');

  const playerCountBeforeEdict = playerItems.length;
  selectorValues.set('[data-desk-edict-body]', '着礼部会同都察院整饬京城粥厂，三日内具报贫民安置。');
  selectorValues.set('#xinglu-pub', '晨幸太庙，午后亲临粥厂，慰问京城士民。');
  selectorValues.set('[data-desk-player-action]', '晨幸太庙，午后亲临粥厂，慰问京城士民。');
  bridge.drafts.handleDeskAction('publish-edict-desk', {});

  assert(sandbox.GM._edictTracker.some(e => e && /整饬京城粥厂/.test(e.content || '')), 'edict plus xinglu should still create an edict tracker item');
  assert(sandbox.GM.qijuHistory.some(q => q && q.category === '行止' && /亲临粥厂/.test(q.xinglu || '')), 'edict plus xinglu should also preserve a separate xinglu qiju entry');
  assert((sandbox.GM._playerActionSignals.items || []).length > playerCountBeforeEdict, 'edict plus xinglu should add more structured player action evidence');
  assert(parserCalls.length === 0, 'formal desk xinglu handling should not call EdictParser directly');

  console.log('[smoke-formal-player-action-only] PASS formal xinglu-only player action path');
})();
