#!/usr/bin/env node
// smoke-phase8-party-class-debug-panel.js - right rail exposes party/class observability ledger.

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
  _getParties: () => [{ name: 'Relief Party', currentAgenda: 'reduce levy', influence: 55 }],
  _getClasses: () => [{ name: 'Farmers', satisfaction: 34, influence: 66, demands: 'reduce emergency levy' }],
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

const clipboardWrites = [];
const sandbox = {
  console,
  Math, Date, JSON, RegExp, Error,
  Array, Object, String, Number, Boolean,
  parseInt, parseFloat, isNaN, isFinite,
  setTimeout: fn => { if (typeof fn === 'function') fn(); return 1; },
  navigator: { clipboard: { writeText(text) { clipboardWrites.push(String(text)); return true; } } },
  document: { getElementById: () => null, createElement: () => ({ addEventListener(){}, remove(){}, style: {} }), body: { appendChild(){} } },
  window: {
    TMPhase8FormalBridge: bridge,
    GM: null,
    P: {},
    TM: {},
    navigator: null
  }
};
sandbox.window.window = sandbox.window;
sandbox.window.document = sandbox.document;
sandbox.window.globalThis = sandbox.window;
sandbox.window.navigator = sandbox.navigator;
sandbox.GM = sandbox.window.GM = {
  turn: 21,
  _socialPoliticalSignals: {
    items: [
      { turn: 20, sourceSystem: 'fiscal', kind: 'tax-pressure', intensity: 0.8, confidence: 0.72, linkedIssue: 'issue-levy', reason: 'tax pressure hit Farmers', affectedClasses: [{ name: 'Farmers' }], affectedParties: [{ name: 'Relief Party' }], applied: true },
      { turn: 18, sourceSystem: 'court', kind: 'tinyi-stage6-issued', intensity: 0.22, confidence: 0.44, linkedIssue: 'issue-grain', reason: 'old grain levy issued', resolved: true, resolvedTurn: 21, affectedClasses: [{ name: 'Farmers' }], affectedParties: [] }
    ],
    stats: { recorded: 2, applied: 2 }
  },
  _socialPoliticalSignalMaintenance: [
    { turn: 21, source: 'pre-submit-signal-maintenance', summary: { resolved: 1, decayed: 2, escalated: 1, expired: 0 } }
  ],
  _socialPoliticalSignalEscalations: [
    { turn: 21, linkedIssue: 'issue-levy', kind: 'tax-pressure', affectedClasses: ['Farmers'], reason: 'unresolved levy pressure' }
  ],
  _partyClassActorMemory: {
    items: [
      { turn: 21, actorType: 'class', actorId: 'Farmers', agenda: 'reduce emergency levy', grievance: 'unresolved levy pressure', belief: 'petition may escalate', source: 'social-political-signal-escalation', confidence: 0.68, expiry: 25, linkedIssue: 'issue-levy' },
      { turn: 17, actorType: 'class', actorId: 'Farmers', agenda: 'old grain levy', grievance: 'old pressure', belief: 'court cooled it', source: 'manual', confidence: 0.32, expiry: 25, linkedIssue: 'issue-grain', status: 'resolved', resolved: true }
    ]
  },
  _partyClassActorMaintenance: [
    { turn: 21, source: 'pre-submit-party-class-actor-maintenance', summary: { expiredMemories: 1, resolvedMemories: 1, escalatedActions: 1, expiredActions: 1 } }
  ],
  party_actions: [
    { turn: 21, actorType: 'party', actorId: 'Relief Party', actionType: 'memorial', agenda: 'carry levy relief', linkedIssue: 'issue-levy', status: 'planned' }
  ],
  class_actions: [
    { turn: 21, actorType: 'class', actorId: 'Farmers', actionType: 'strike', agenda: 'reduce emergency levy', linkedIssue: 'issue-levy', status: 'planned' }
  ],
  _pendingTinyiTopics: [
    { turn: 21, topic: 'Emergency grain levy', sourceType: 'party_class_calibration', party: 'Relief Party', sourceClass: 'Farmers', linkedIssue: 'issue-levy' },
    { turn: 21, topic: 'Class minxin levy hearing', from: 'class-minxin-bridge', sourceType: 'class_pressure', sourceClass: 'Farmers', demandText: 'reduce emergency levy', linkedIssue: 'issue-levy' }
  ],
  _partyClassCourtIssueLinks: [
    { turn: 21, topic: 'Emergency grain levy', party: 'Relief Party', className: 'Farmers', goalText: 'carry levy relief through court debate' }
  ],
  _courtRecords: [
    { turn: 21, topic: 'Old grain levy', issueId: 'issue-grain', sourceParty: 'Relief Party', sourceClass: 'Farmers', sealStatus: 'issued', grade: 'B' }
  ],
  minxin: {
    trueIndex: 48,
    perceivedIndex: 56,
    byClass: {
      farmers: {
        index: 33,
        true: 33,
        perceived: 41,
        className: 'Farmers',
        satisfaction: 33,
        influence: 66,
        unrestPhase: 'brewing',
        demand: 'reduce emergency levy',
        lastSyncTurn: 21,
        source: 'test-sync',
        lastPressure: {
          turn: 21,
          sourceSystem: 'fiscal',
          sourceId: 'sig-tax-pressure',
          delta: -1.4,
          appliedRegions: ['Canal Ward'],
          reason: 'tax pressure hit Farmers',
          linkedIssue: 'issue-levy'
        }
      }
    },
    uprisingCandidates: [
      { id: 'mxuc-21-farmers-canal', className: 'Farmers', region: 'Canal Ward', momentum: 42, level: 2, hidden: true, linkedIssue: 'issue-levy', cause: 'tax pressure hit Farmers' }
    ]
  },
  _classMinxinBridgeLedger: [
    { key: 'fiscal|sig-tax-pressure|farmers|21', turn: 21, classKey: 'farmers', className: 'Farmers', sourceSystem: 'fiscal', sourceId: 'sig-tax-pressure', linkedIssue: 'issue-levy', reason: 'tax pressure hit Farmers', delta: -1.4, satisfactionDelta: -7, appliedRegions: [{ region: 'Canal Ward', before: 45, after: 43.6, delta: -1.4 }], regionWeights: [{ region: 'Canal Ward', weight: 1 }] }
  ],
  _classMinxinBridgeAudit: {
    ok: false,
    turn: 21,
    source: 'test-audit',
    counts: { classes: 1, byClass: 1, ledger: 1, duplicates: 1, drifts: 1, blindRegionWrites: 0 },
    duplicates: ['fiscal|sig-tax-pressure|farmers|21'],
    drifts: [{ className: 'Farmers', satisfaction: 34, minxin: 33, delta: -1 }],
    blindRegionWrites: []
  },
  _classMinxinBridgeMaintenance: { turn: 21, source: 'pre-submit-class-minxin-bridge', courtIssues: 1, uprisingCandidates: 1, auditOk: false }
};
sandbox.P = sandbox.window.P;
sandbox.TM = sandbox.window.TM;
vm.createContext(sandbox);

vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-class-minxin-bridge.js'), 'utf8'), sandbox, { filename: 'tm-class-minxin-bridge.js' });
vm.runInContext(fs.readFileSync(path.join(ROOT, 'phase8-formal-rightrail.js'), 'utf8'), sandbox, { filename: 'phase8-formal-rightrail.js' });
vm.runInContext(fs.readFileSync(path.join(ROOT, 'phase8-formal-rightrail-social.js'), 'utf8'), sandbox, { filename: 'phase8-formal-rightrail-social.js' });

assert(sandbox.TM.ClassMinxinBridge && typeof sandbox.TM.ClassMinxinBridge.diagnosticsText === 'function', 'ClassMinxinBridge should expose diagnosticsText for copy/debug');
assert(bridge.rightrail && bridge.rightrail.renderers && typeof bridge.rightrail.renderers.pcdebug === 'function', 'right rail should export pcdebug renderer');
assert(bridge.rightrail.titles && bridge.rightrail.titles.pcdebug, 'right rail should title pcdebug renderer');

let html = bridge.rightrail.renderers.ol();
assert(/data-right-action="pcdebug-open"/.test(html), 'outline panel should expose a debug/observability entry');

bridge.rightrail.handleRightPanelAction('pcdebug-open', {});
assert(bridge._lastPanel === 'pcdebug', 'pcdebug action should open debug panel');

html = bridge.rightrail.renderers.pcdebug();
assert(/tmrp-pcdebug/.test(html), 'pcdebug renderer should use debug shell class');
assert(/社会政治信号/.test(html), 'debug panel should show signal ledger section');
assert(/tax-pressure/.test(html) && /issue-levy/.test(html), 'debug panel should show recent unresolved signal with issue');
assert(/pre-submit-signal-maintenance/.test(html), 'debug panel should show signal maintenance source');
assert(/unresolved levy pressure/.test(html), 'debug panel should show escalation reason');
assert(/行动者记忆/.test(html), 'debug panel should show actor memory section');
assert(/social-political-signal-escalation/.test(html), 'debug panel should show actor memory source');
assert(/党派动作/.test(html) && /阶层动作/.test(html), 'debug panel should show actor action ledgers');
assert(/廷议队列/.test(html) && /party_class_calibration/.test(html), 'debug panel should show pending tinyi source');
assert(/朝议记录/.test(html) && /颁行 B/.test(html), 'debug panel should show recent court record status and grade');
assert(/阶层民心桥/.test(html), 'debug panel should show class-minxin bridge section');
assert(/稽核|重复|漂移|FAIL/i.test(html), 'debug panel should show class-minxin audit warnings');
assert(/Canal Ward/.test(html) && /tax pressure hit Farmers/.test(html), 'debug panel should show class-minxin region and reason');
assert(/民变候选/.test(html) && /mxuc-21-farmers-canal/.test(html), 'debug panel should show uprising candidates');
assert(/data-right-action="pcdebug-copy"/.test(html), 'debug panel should expose copy diagnostic snapshot action');

bridge.rightrail.handleRightPanelAction('pcdebug-copy', {});
assert(clipboardWrites.some(text => /Class Minxin Bridge/.test(text) && /tax pressure hit Farmers/.test(text) && /audit=FAIL/.test(text)), 'copy action should write class-minxin diagnostics snapshot');

console.log('[smoke-phase8-party-class-debug-panel] PASS phase8 party/class debug panel');
