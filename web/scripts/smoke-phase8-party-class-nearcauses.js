#!/usr/bin/env node
// smoke-phase8-party-class-nearcauses.js - right rail shows causes and intervention actions for classes/parties.

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

const playerSignals = [];
const toasts = [];
const nodes = {};
const classes = [
  {
    name: 'Farmers',
    satisfaction: 38,
    influence: 55,
    demands: 'reduce emergency levy',
    supportingParties: [{ party: 'Relief Party', affinity: 0.8 }],
    _socialPoliticalHistory: [
      { turn: 7, kind: 'fiscal-peasant-burden', reason: 'high rural burden', sourceSystem: 'fiscal' }
    ],
    partyOutcomeHistory: [
      { turn: 7, outcome: 'blocked', grade: 'B', satisfactionDelta: -4, refs: [{ partyName: 'Relief Party' }] }
    ]
  }
];
const parties = [
  {
    name: 'Relief Party',
    status: 'active',
    influence: 58,
    leader: 'Minister Lin',
    currentAgenda: 'reduce levy',
    shortGoal: 'carry rural relief',
    agenda_history: [
      { turn: 8, source: 'social-political-signal', reason: 'responded to rural burden', shortGoal: 'carry rural relief' }
    ],
    _socialPoliticalHistory: [
      { turn: 8, kind: 'fiscal-peasant-burden', reason: 'rural burden became party agenda' }
    ]
  }
];

const bridge = {
  _state: { rightOutlineTab: 'classes', activePanel: 'ol' },
  _esc: esc,
  _attr: esc,
  _asset: (v) => v,
  _fmtNum: (v) => String(v),
  _miniRows: () => '',
  _actionButton: () => '',
  _moduleShell: () => '',
  _dossierRows: () => '',
  _ownerKey: () => '',
  _ownerName: () => '',
  _findFaction: () => null,
  _findPerson: (name) => ({ name, alive: true, location: 'capital', officialTitle: 'minister' }),
  _personKey: (p) => p && (p.name || p.id) || '',
  _getPeople: () => [{ name: 'Minister Lin', alive: true, party: 'Relief Party', location: 'capital', officialTitle: 'minister' }],
  _getMapData: () => ({ regions: [] }),
  _getParties: () => parties,
  _getClasses: () => classes,
  _collectRecentEvents: () => [],
  _getTurnText: () => 'T8',
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
  _toast: (msg) => { toasts.push(String(msg || '')); },
  openPanel(slot) { this._lastPanel = slot; },
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
  setTimeout: (fn) => { if (typeof fn === 'function') fn(); return 1; },
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
    TM: {
      PlayerActionSignals: {
        record(root, payload) { playerSignals.push({ root, payload }); }
      },
      PartyClassLlmCalibrator: {
        notifyPlayerAction() {}
      }
    }
  }
};
sandbox.window.window = sandbox.window;
sandbox.window.document = sandbox.document;
sandbox.window.globalThis = sandbox.window;
sandbox.GM = sandbox.window.GM = {
  turn: 8,
  classes,
  parties,
  turnChanges: {
    classes: [{ name: 'Farmers', changes: [{ field: 'satisfaction', oldValue: 45, newValue: 38, reason: 'tax pressure' }] }],
    parties: [{ name: 'Relief Party', changes: [{ field: 'cohesion', oldValue: 50, newValue: 55, reason: 'rural relief promise' }] }]
  },
  _socialPoliticalSignalApplications: [
    { turn: 8, source: 'runtime-pressure', summary: { signals: 2 } }
  ],
  _partyClassCourtIssueLinks: [
    { turn: 8, party: 'Relief Party', className: 'Farmers', goalText: 'carry rural relief through court debate', topic: 'Emergency grain levy' }
  ],
  tinyiSeals: [
    { turn: 8, topic: 'Emergency grain levy', sourceParty: 'Relief Party', sourceClass: 'Farmers', sealStatus: 'issued', grade: 'B' }
  ],
  _pendingTinyiTopics: [],
  _edictSuggestions: []
};
sandbox.P = sandbox.window.P;
sandbox.TM = sandbox.window.TM;
vm.createContext(sandbox);

vm.runInContext(fs.readFileSync(path.join(ROOT, 'phase8-formal-rightrail.js'), 'utf8'), sandbox, { filename: 'phase8-formal-rightrail.js' });
vm.runInContext(fs.readFileSync(path.join(ROOT, 'phase8-formal-rightrail-social.js'), 'utf8'), sandbox, { filename: 'phase8-formal-rightrail-social.js' });

assert(bridge.rightrail && bridge.rightrail.renderers && typeof bridge.rightrail.renderers.ol === 'function', 'right rail outline renderer should be exported');

let html = bridge.rightrail.renderers.ol();
assert(/data-right-action="outline-select"/.test(html), 'class card should remain clickable into detail flyout');
assert(!/tmrp-social-cause/.test(html), 'class card should not render near-cause entries inline');
assert(!/tmrp-social-chain/.test(html), 'class card should not render cause chain inline');
assert(!/data-right-action="social-action"/.test(html), 'class card should not expose intervention actions inline');
assert(!/fiscal-peasant-burden|tax pressure|reduce emergency levy/.test(html), 'class card should localize or hide raw cause/demand English');

bridge.rightrail.handleRightPanelAction('outline-select', { type: 'class', key: 'Farmers' });
let detailHtml = nodes['tm-social-detail-flyout'] && nodes['tm-social-detail-flyout'].innerHTML || '';
assert(/tm-social-detail-flyout/.test(nodes['tm-social-detail-flyout'].className || ''), 'class click should open the social detail flyout');
assert(/tmrp-social-cause/.test(detailHtml), 'class detail flyout should render near-cause entries');
assert(/财政民负/.test(detailHtml) || /税负压力/.test(detailHtml), 'class detail flyout should localize signal or turn-change reason');
assert(/data-right-action="social-action"/.test(detailHtml), 'class detail flyout should expose social intervention actions');
assert(/data-actor-type="class"/.test(detailHtml), 'class action should identify class actor type');
assert(/data-social-command="chaoyi"/.test(detailHtml), 'class detail should expose court-agenda action');
assert(/data-social-command="edict"/.test(detailHtml), 'class detail should expose edict action');
assert(/tmrp-social-chain/.test(detailHtml), 'class detail should render clickable social cause chain');
assert(/data-right-action="social-chain"/.test(detailHtml), 'social chain entries should be clickable right-rail actions');
assert(/data-chain-kind="demand"/.test(detailHtml), 'social chain should include demand source');
assert(/data-chain-kind="party"/.test(detailHtml), 'social chain should include supporting party');
assert(/data-chain-kind="issue"/.test(detailHtml), 'social chain should include related court issue');
assert(/data-chain-kind="ruling"/.test(detailHtml), 'social chain should include recent ruling');
assert(/data-chain-kind="risk"/.test(detailHtml), 'social chain should include follow-up risk');
assert(!/fiscal-peasant-burden|tax pressure|reduce emergency levy/.test(detailHtml), 'class detail should not leak raw English slugs');

bridge._state.rightOutlineTab = 'parties';
html = bridge.rightrail.renderers.ol();
assert(/data-right-action="outline-select"/.test(html), 'party card should remain clickable into detail flyout');
assert(!/tmrp-social-cause/.test(html), 'party card should not render near-cause entries inline');
assert(!/tmrp-social-chain/.test(html), 'party card should not render cause chain inline');
assert(!/carry rural relief/.test(html), 'party card should not leak raw agenda English');

bridge.rightrail.handleRightPanelAction('outline-select', { type: 'party', key: 'Relief Party' });
detailHtml = nodes['tm-social-detail-flyout'] && nodes['tm-social-detail-flyout'].innerHTML || '';
assert(/tmrp-social-cause/.test(detailHtml), 'party detail flyout should render near-cause entries');
assert(/Relief Party/.test(detailHtml) && /推动乡里纾困/.test(detailHtml), 'party detail should include localized agenda/goal evidence');
assert(/data-actor-type="party"/.test(detailHtml), 'party action should identify party actor type');
assert(/data-social-command="audience"/.test(detailHtml), 'party detail should expose audience action');
assert(/tmrp-social-chain/.test(detailHtml) && /data-chain-kind="issue"/.test(detailHtml), 'party detail should render social cause chain with issue link');
assert(!/carry rural relief|rural burden became party agenda/.test(detailHtml), 'party detail should not leak raw English causes');

bridge.rightrail.handleRightPanelAction('social-chain', {
  actorType: 'class',
  name: 'Farmers',
  chainKind: 'party',
  target: 'Relief Party',
  topic: 'Emergency grain levy'
});
assert(bridge._state.rightOutlineTab === 'parties', 'party chain click should switch outline tab to parties');

bridge.rightrail.handleRightPanelAction('social-chain', {
  actorType: 'class',
  name: 'Farmers',
  chainKind: 'issue',
  target: 'issue-tax-levy',
  topic: 'Emergency grain levy'
});
assert(bridge._state.rightIssueTab === 'chaoyi', 'issue chain click should switch issue tab to court agenda');
assert(bridge._state.rightChaoyiTopic === 'Emergency grain levy', 'issue chain click should prefill court topic');

bridge.rightrail.handleRightPanelAction('social-action', {
  actorType: 'class',
  name: 'Farmers',
  socialCommand: 'chaoyi',
  buttonText: 'pay to court'
});
assert(sandbox.GM._pendingTinyiTopics.length === 1, 'class court action should enqueue a court issue');
assert(sandbox.GM._pendingTinyiTopics[0].sourceClass === 'Farmers', 'class court issue should preserve source class');
assert(playerSignals.some(x => x.payload && x.payload.action === 'social-action'), 'social action should be recorded for player-action calibration');

bridge.rightrail.handleRightPanelAction('social-action', {
  actorType: 'party',
  name: 'Relief Party',
  socialCommand: 'edict',
  buttonText: 'draft balancing edict'
});
assert(sandbox.GM._edictSuggestions.length === 1, 'party edict action should create an edict suggestion');
assert(/Relief Party/.test(sandbox.GM._edictSuggestions[0].content), 'party edict suggestion should include party name');

console.log('[smoke-phase8-party-class-nearcauses] PASS phase8 party/class near causes');
