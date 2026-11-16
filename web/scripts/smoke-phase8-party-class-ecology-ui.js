#!/usr/bin/env node
// smoke-phase8-party-class-ecology-ui.js - right rail shows ecology-built party/class relationship causes.

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const nodes = {};

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

const classes = [
  {
    name: 'Canal Tenants',
    satisfaction: 32,
    influence: 56,
    demands: 'reduce tax and levy pressure',
    economicRole: 'tenant households carrying rent arrears'
  }
];

const parties = [
  {
    name: 'Relief League',
    status: 'active',
    influence: 54,
    currentAgenda: 'carry tenant relief'
  },
  {
    name: 'Revenue Clique',
    status: 'active',
    influence: 68,
    currentAgenda: 'defend arrear collection',
    rivalParty: 'Relief League'
  }
];

const bridge = {
  _state: { rightOutlineTab: 'classes', activePanel: 'ol' },
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
  _findPerson: name => ({ name, alive: true, location: 'capital', officialTitle: 'minister' }),
  _personKey: p => p && (p.name || p.id) || '',
  _getPeople: () => [],
  _getMapData: () => ({ regions: [] }),
  _getParties: () => parties,
  _getClasses: () => classes,
  _collectRecentEvents: () => [],
  _getTurnText: () => 'T21',
  _firstArray: () => [],
  _actionBtn: () => '',
  _actionChip: () => '',
  _renderActionStats: () => '',
  _compactText: (v, n) => String(v || '').slice(0, n || 160),
  _getMemorials: () => [],
  _getIssues: () => [],
  _getActiveScenario: () => ({}),
  _getArmies: () => [],
  _issueIsResolved: () => false,
  _tmfRenwuPortrait: () => '',
  _toast() {},
  openPanel(slot) { this._lastPanel = slot; this._state.activePanel = slot; },
  openModule(kind, opts) { this._lastModule = { kind, opts }; },
  openGuoku() {},
  _openOfficeStandalone() {},
  _openShiluPreviewPanel() {},
  _openHongyanPreviewPanel() {},
  _closeModule() {},
  _closeDeskOverlay() {},
  _closeRightDrawer() {},
  _returnFormalHomeSoon() {},
  _saveFormalDraftsToGM() {},
  openRenwu() {},
  personAction() {},
  unpin() {}
};

const sandbox = {
  console,
  Math, Date, JSON, RegExp, Error,
  Array, Object, String, Number, Boolean,
  parseInt, parseFloat, isNaN, isFinite,
  setTimeout: fn => { if (typeof fn === 'function') fn(); return 1; },
  document: {
    getElementById: (id) => nodes[id] || null,
    createElement: () => ({
      id: '',
      className: '',
      style: {},
      addEventListener(){},
      remove(){ if (this.id) delete nodes[this.id]; },
      set innerHTML(v) { this._html = String(v || ''); },
      get innerHTML() { return this._html || ''; }
    }),
    body: { appendChild(node){ if (node && node.id) nodes[node.id] = node; } }
  },
  window: {
    TMPhase8FormalBridge: bridge,
    GM: null,
    P: {},
    TM: {}
  }
};
sandbox.window.window = sandbox.window;
sandbox.window.document = sandbox.document;
sandbox.window.globalThis = sandbox.window;
sandbox.GM = sandbox.window.GM = {
  turn: 21,
  classes,
  parties,
  _partyGoalRelationIndex: {
    classParties: { 'Canal Tenants': ['Relief League'] },
    partyClasses: { 'Relief League': ['Canal Tenants'] },
    evidence: [
      { className: 'Canal Tenants', partyName: 'Relief League', source: 'runtime-affinity', detail: 'affinity=52', affinity: 52, status: 'aligned', trust: 49, grievance: 33 },
      { className: 'Canal Tenants', partyName: 'Revenue Clique', source: 'runtime-estranged', detail: 'affinity=4', affinity: 4, status: 'estranged', trust: 21, grievance: 70 }
    ]
  },
  partyClassRelations: {
    edges: {
      'canaltenants::reliefleague': {
        className: 'Canal Tenants',
        partyName: 'Relief League',
        affinity: 52,
        trust: 49,
        grievance: 33,
        status: 'aligned',
        lastTurn: 21,
        lastSource: 'smoke-ecology-apply-21',
        lastReason: 'ecology signal tax linked class pressure to party agenda',
        evidence: [{ source: 'smoke-ecology-apply-21', detail: 'tax/commerce' }]
      },
      'canaltenants::revenueclique': {
        className: 'Canal Tenants',
        partyName: 'Revenue Clique',
        affinity: 4,
        trust: 21,
        grievance: 70,
        status: 'estranged',
        lastTurn: 21,
        lastSource: 'smoke-ecology-apply-21',
        lastReason: 'ecology signal tax linked class pressure to party agenda',
        evidence: [{ source: 'smoke-ecology-apply-21', detail: 'tax/commerce' }]
      }
    },
    history: [
      { turn: 20, className: 'Canal Tenants', partyName: 'Relief League', source: 'smoke-ecology-apply-20', delta: 11.8, after: 39.8, status: 'wavering' },
      { turn: 21, className: 'Canal Tenants', partyName: 'Relief League', source: 'smoke-ecology-apply-21', delta: 12.15, after: 52, status: 'aligned' },
      { turn: 21, className: 'Canal Tenants', partyName: 'Revenue Clique', source: 'smoke-ecology-apply-21', delta: -12.15, after: 4, status: 'estranged' }
    ]
  },
  _partyClassEcology: {
    signalHistory: [
      { turn: 20, source: 'smoke-ecology-tax-20', kind: 'tax-pressure', categories: ['tax', 'commerce'], affectedClasses: ['Canal Tenants'], affectedParties: ['Relief League', 'Revenue Clique'] },
      { turn: 21, source: 'smoke-ecology-tax-21', kind: 'tax-pressure', categories: ['tax', 'commerce'], affectedClasses: ['Canal Tenants'], affectedParties: ['Relief League', 'Revenue Clique'] }
    ]
  }
};
sandbox.P = sandbox.window.P;
sandbox.TM = sandbox.window.TM;
vm.createContext(sandbox);

vm.runInContext(fs.readFileSync(path.join(ROOT, 'phase8-formal-rightrail.js'), 'utf8'), sandbox, { filename: 'phase8-formal-rightrail.js' });
vm.runInContext(fs.readFileSync(path.join(ROOT, 'phase8-formal-rightrail-social.js'), 'utf8'), sandbox, { filename: 'phase8-formal-rightrail-social.js' });

let html = bridge.rightrail.renderers.ol();
assert(!/tmrp-ecology/.test(html), 'class card should not render ecology relation block inline');
assert(/data-right-action="outline-select"/.test(html), 'class card should remain clickable into detail flyout');

bridge.rightrail.handleRightPanelAction('outline-select', { type: 'class', key: 'Canal Tenants' });
let detailHtml = nodes['tm-social-detail-flyout'] && nodes['tm-social-detail-flyout'].innerHTML || '';
assert(/tmrp-ecology/.test(detailHtml), 'class detail flyout should render ecology relation block');
assert(/生态关系/.test(detailHtml), 'class detail should label ecology relation block');
assert(/Relief League/.test(detailHtml) && /趋同/.test(detailHtml), 'class detail should show localized aligned supporter from dynamic ecology');
assert(/Revenue Clique/.test(detailHtml) && /疏离/.test(detailHtml), 'class detail should show localized estranged hostile party');
assert(/亲和 52/.test(detailHtml) && /信 49/.test(detailHtml) && /怨 33/.test(detailHtml), 'class detail should show affinity/trust/grievance numbers');
assert(/税负压力/.test(detailHtml) && /税负生态信号T21/.test(detailHtml), 'class detail should show localized recent ecology signal cause');
assert(/data-chain-kind="party"/.test(detailHtml) && /data-target="Relief League"/.test(detailHtml), 'ecology supporter should remain clickable through the social chain');
assert(!/>aligned<|>estranged<|tax-pressure|smoke-ecology-tax-21/.test(detailHtml), 'class detail should not leak raw visible ecology English');

bridge._state.rightOutlineTab = 'parties';
html = bridge.rightrail.renderers.ol();
assert(!/tmrp-ecology/.test(html), 'party card should not render ecology relation block inline');
bridge.rightrail.handleRightPanelAction('outline-select', { type: 'party', key: 'Relief League' });
detailHtml = nodes['tm-social-detail-flyout'] && nodes['tm-social-detail-flyout'].innerHTML || '';
assert(/tmrp-ecology/.test(detailHtml), 'party detail flyout should render ecology relation block');
assert(/Canal Tenants/.test(detailHtml) && /趋同/.test(detailHtml), 'party detail should show linked class from ecology relation');
assert(/生态关系更新T21/.test(detailHtml), 'party detail should show localized relation update source');
assert(!/Revenue Clique<\/b><span>.*Revenue Clique/.test(detailHtml), 'party detail should not list itself as a linked party');
assert(!/>aligned<|smoke-ecology-apply-21/.test(detailHtml), 'party detail should not leak raw visible relation English');

console.log('[smoke-phase8-party-class-ecology-ui] PASS phase8 ecology relation UI');
