#!/usr/bin/env node
// smoke-party-class-action-scheduler.js - pre-submit scheduler turns signals/memory/relations into actor actions and prompt evidence.

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

const sandbox = {
  console,
  Math, Date, JSON, RegExp, Error,
  Array, Object, String, Number, Boolean,
  parseInt, parseFloat, isNaN, isFinite,
  window: {},
  scriptData: {},
  P: {}
};
sandbox.window = sandbox;
sandbox.global = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

function load(file) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox, { filename: file });
}

load('tm-engine-constants.js');
load('tm-class-engine.js');
load('tm-party-goals.js');
load('tm-party-class-ecology.js');
load('tm-social-political-signals.js');
load('tm-player-action-signals.js');
load('tm-party-class-actors.js');
load('tm-party-class-action-scheduler.js');

const SPS = sandbox.TM && sandbox.TM.SocialPoliticalSignals;
const Actors = sandbox.TM && sandbox.TM.PartyClassActors;
const Scheduler = sandbox.TM && sandbox.TM.PartyClassActionScheduler;

assert(SPS && typeof SPS.record === 'function', 'SocialPoliticalSignals should load');
assert(Actors && typeof Actors.run === 'function', 'PartyClassActors should load');
assert(Scheduler && typeof Scheduler.scheduleBeforeSubmit === 'function', 'PartyClassActionScheduler.scheduleBeforeSubmit should exist');
assert(typeof Scheduler.formatForPrompt === 'function', 'PartyClassActionScheduler.formatForPrompt should exist');

const root = {
  turn: 41,
  partyState: {},
  currentIssues: [
    { id: 'issue-levy', title: 'Emergency levy review', category: 'finance', status: 'pending' }
  ],
  classes: [
    {
      name: 'Canal Tenants',
      tags: ['tenant', 'tax', 'levy', 'peasant'],
      satisfaction: 50,
      influence: 62,
      demands: 'reduce emergency levy',
      unrestLevels: { grievance: 58, petition: 52, strike: 42, revolt: 35 },
      supportingParties: [{ party: 'Relief League', affinity: 0.72 }]
    }
  ],
  parties: [
    {
      name: 'Relief League',
      tags: ['relief', 'tax', 'tenant'],
      status: 'active',
      influence: 58,
      cohesion: 50,
      currentAgenda: '',
      shortGoal: '',
      socialBase: ['Canal Tenants']
    }
  ],
  partyClassRelations: {
    edges: {
      'reliefleague::canaltenants': {
        partyName: 'Relief League',
        className: 'Canal Tenants',
        affinity: 73,
        trust: 61,
        grievance: 68,
        status: 'mobilizing',
        lastReason: 'tenant levy grievance moved toward party sponsorship'
      }
    }
  }
};
sandbox.GM = root;

SPS.record(root, {
  sourceSystem: 'player-action',
  kind: 'memorial-decision-desk',
  turn: 41,
  tags: ['player-action', 'memorial', 'tax', 'levy'],
  reason: 'Approved a memorial to investigate Emergency levy review',
  linkedIssue: 'issue-levy',
  affectedClasses: [
    { name: 'Canal Tenants', satisfactionDelta: -8, demand: 'reduce emergency levy', reason: 'tenant pressure remains unresolved' }
  ],
  affectedParties: [
    { name: 'Relief League', cohesionDelta: 1, shortGoal: 'sponsor Emergency levy review', reason: 'player memorial gives party opening' }
  ]
});

const beforeCohesion = root.parties[0].cohesion;
const result = Scheduler.scheduleBeforeSubmit(root, { turn: 41, source: 'smoke-party-class-action-scheduler' });

assert(result && result.actorRun && result.actorRun.actions >= 2, 'scheduler should run actor planner and create actions');
assert(result.actionSignals >= 2, 'scheduler should mirror actor actions into social/political signals');
assert(Array.isArray(root.party_actions) && root.party_actions.some(a => a.actorId === 'Relief League' && a.actionType === 'memorial'), 'party action scheduler should create memorial action');
assert(Array.isArray(root.class_actions) && root.class_actions.some(a => a.actorId === 'Canal Tenants' && a.actionType === 'petition'), 'class action scheduler should create petition action');
assert(root._partyClassActorMemory && root._partyClassActorMemory.items.some(m => m.actorId === 'Canal Tenants' && /scheduler/.test(m.source || '')), 'scheduler should seed actor memory from recent signals/relations');
assert(root._socialPoliticalSignals.items.some(s => s.sourceSystem === 'party-class-action' && /party-class-action-/.test(s.kind || '')), 'actor actions should be converted into deterministic social/political signals');
assert(root.parties[0].cohesion !== beforeCohesion, 'applied action signal should gently move party cohesion');
assert(root.classes[0].satisfaction >= 41, 'action signals should not double-count the source class pressure beyond the original signal');

const prompt = Scheduler.formatForPrompt(root, { limit: 8 });
assert(/Party Class Actor Actions/.test(prompt), 'scheduler prompt formatter should emit actor action section');
assert(/Relief League/.test(prompt) && /memorial/.test(prompt), 'prompt should include party memorial action');
assert(/Canal Tenants/.test(prompt) && /petition/.test(prompt), 'prompt should include class petition action');
assert(/Emergency levy|issue-levy/.test(prompt), 'prompt should preserve linked issue context');

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
  _findPerson: (name) => ({ name, alive: true }),
  _personKey: (p) => p && (p.name || p.id) || '',
  _getPeople: () => [],
  _getMapData: () => ({ regions: [] }),
  _getParties: () => root.parties,
  _getClasses: () => root.classes,
  _collectRecentEvents: () => [],
  _getTurnText: () => 'T41',
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
  _toast: () => {},
  openPanel() {},
  openModule() {},
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
sandbox.TMPhase8FormalBridge = bridge;
sandbox.window.TMPhase8FormalBridge = bridge;
const nodes = {};
sandbox.document = {
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
};
sandbox.window.document = sandbox.document;

load('phase8-formal-rightrail.js');
load('phase8-formal-rightrail-social.js');
assert(bridge.rightrail && bridge.rightrail.renderers && typeof bridge.rightrail.renderers.ol === 'function', 'right rail outline renderer should load');

let html = bridge.rightrail.renderers.ol();
assert(!/tmrp-actor-action/.test(html), 'class card should not show autonomous actor actions inline');
bridge.rightrail.handleRightPanelAction('outline-select', { type: 'class', key: 'Canal Tenants' });
let detailHtml = nodes['tm-social-detail-flyout'] && nodes['tm-social-detail-flyout'].innerHTML || '';
assert(/tmrp-actor-action/.test(detailHtml), 'class detail should show autonomous actor actions');
assert(/Canal Tenants/.test(detailHtml) && /petition|请愿/.test(detailHtml), 'class detail should show class petition action');

bridge._state.rightOutlineTab = 'parties';
html = bridge.rightrail.renderers.ol();
assert(!/tmrp-actor-action/.test(html), 'party card should not show autonomous actor actions inline');
bridge.rightrail.handleRightPanelAction('outline-select', { type: 'party', key: 'Relief League' });
detailHtml = nodes['tm-social-detail-flyout'] && nodes['tm-social-detail-flyout'].innerHTML || '';
assert(/tmrp-actor-action/.test(detailHtml), 'party detail should show autonomous actor actions');
assert(/Relief League/.test(detailHtml) && /memorial|奏疏|上书/.test(detailHtml), 'party detail should show party memorial action');
assert(!/data-relation-command=/.test(detailHtml), 'actor action visibility should not expose direct relation command buttons');

// ── 批乙·党派演绎层排序契约（2026-07-22）──
// 三层排序=确定性 actor(喂证据)→AI 演绎(批乙新·post-turn)→校准兜底。
// 演绎层为 post-turn 天然晚于回合内 scheduler/校准器（静态断言 tm-party-inference.js 走
// _enqueuePostTurnJob 且不在 flushBeforeSubmit/scheduleBeforeSubmit 链）。
const partyInferSource = fs.readFileSync(path.join(ROOT, 'tm-party-inference.js'), 'utf8');
assert(!/flushBeforeSubmit/.test(partyInferSource), 'party inference must NOT hook the pre-submit flushBeforeSubmit chain');
assert(!/scheduleBeforeSubmit/.test(partyInferSource), 'party inference must NOT hook the pre-submit scheduleBeforeSubmit chain');
// 防双注入：演绎层不回写确定性信号源 GM._partyDynamics（那是 helpers partyDynamics 的产物·仅作证据读入）。
assert(!/_partyDynamics\s*(?:=(?![=>])|\.push|\.splice|\.unshift)/.test(partyInferSource), 'party inference must NOT write back GM._partyDynamics (deterministic signal source, read-only evidence)');
// 演绎层 prompt 独立构造·不改 tm-endturn-prompt.js 的党派阶层/动态段。

console.log('[smoke-party-class-action-scheduler] PASS party/class action scheduler (+ party-inference ordering/anti-double-injection contract)');
