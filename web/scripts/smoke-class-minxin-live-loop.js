#!/usr/bin/env node
// smoke-class-minxin-live-loop.js - player action calibration closes class-minxin loop before submit.

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

function classList() {
  const values = new Set();
  return {
    add() { Array.from(arguments).forEach((v) => values.add(String(v))); },
    remove() { Array.from(arguments).forEach((v) => values.delete(String(v))); },
    contains(v) { return values.has(String(v)); },
    toggle(v, force) {
      if (force === true) { values.add(String(v)); return true; }
      if (force === false) { values.delete(String(v)); return false; }
      if (values.has(String(v))) { values.delete(String(v)); return false; }
      values.add(String(v));
      return true;
    }
  };
}

const calls = [];
const elements = Object.create(null);
function makeEl(id) {
  return elements[id] || (elements[id] = {
    id,
    innerHTML: '',
    textContent: '',
    style: {},
    dataset: {},
    classList: classList(),
    addEventListener() {},
    appendChild() {},
    remove() { if (this.id) delete elements[this.id]; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    setAttribute(key, value) { this[key] = String(value); }
  });
}

const root = {
  turn: 71,
  sid: 'smoke-class-minxin-live-loop',
  minxin: { trueIndex: 58, perceivedIndex: 66, byClass: {}, sources: {}, revolts: [] },
  adminHierarchy: {
    player: {
      divisions: [{
        name: 'Canal Circuit',
        children: [
          { name: 'Canal Ward', minxin: 46, minxinLocal: 46, population: { mouths: 120000 }, children: [] },
          { name: 'Hill County', minxin: 64, minxinLocal: 64, population: { mouths: 80000 }, children: [] }
        ]
      }]
    }
  },
  classes: [{
    name: 'Canal Laborers',
    key: 'canal_laborers',
    satisfaction: 44,
    influence: 73,
    demands: 'reduce lock repair levy',
    regionalVariants: [{ region: 'Canal Ward', weight: 1 }],
    unrestLevels: { grievance: 62, petition: 70, strike: 82, revolt: 88 },
    _populationShare: 0.2
  }],
  parties: [{ name: 'Works Relief Party', influence: 58, cohesion: 54 }],
  _edictSuggestions: [{ source: 'player-edict', from: 'Works Office', content: 'tighten lock repair levy collection', turn: 71, used: false }],
  memorials: [{ from: 'Canal Censor', title: 'Lock levy complaint', reviewed: false, text: 'laborers cannot bear the levy' }],
  letters: [{ to: 'Canal Guild Elder', subjectLine: 'levy', status: 'draft', content: 'prepare a relief bargain', turn: 71 }],
  wenduiTarget: 'Canal Guild Elder'
};

const bridgeShell = {
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
  _getPeople: () => [{ name: 'Canal Censor', alive: true, location: 'capital', officialTitle: 'censor' }],
  _getMapData: () => ({ regions: [] }),
  _getParties: () => root.parties,
  _getClasses: () => root.classes,
  _collectRecentEvents: () => [],
  _getTurnText: () => 'T71',
  _firstArray: () => [],
  _actionBtn: () => '',
  _actionChip: () => '',
  _renderActionStats: () => '',
  _compactText: (v, n) => String(v || '').slice(0, n || 160),
  _getMemorials: () => root.memorials,
  _getIssues: () => root._pendingTinyiTopics || [],
  _getActiveScenario: () => ({}),
  _getArmies: () => [],
  _issueIsResolved: () => false,
  _tmfRenwuPortrait: () => '',
  _toast() {},
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
  _saveFormalDraftsToGM() {}
};

const sandbox = {
  console,
  Math, Date, JSON, RegExp, Error, Promise,
  Array, Object, String, Number, Boolean,
  parseInt, parseFloat, isNaN, isFinite,
  setTimeout: (fn) => { if (typeof fn === 'function') fn(); return 1; },
  clearTimeout: () => {},
  document: {
    readyState: 'complete',
    getElementById(id) { return elements[id] || null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    createElement(tag) { return makeEl(tag + '-' + Object.keys(elements).length); },
    addEventListener() {},
    body: { appendChild(node) { if (node && node.id) elements[node.id] = node; return node; } }
  },
  window: {},
  scriptData: {},
  GM: root
};
sandbox.window = sandbox;
sandbox.global = sandbox;
sandbox.globalThis = sandbox;
sandbox.TMPhase8FormalBridge = bridgeShell;
sandbox.P = {
  conf: { partyClassLlmEnabled: true, classMinxin: { thresholds: { courtIssuePressureDelta: 0.3 } } },
  ai: {
    key: 'primary-key',
    url: 'https://primary.example/v1',
    model: 'primary-model',
    secondary: { key: 'secondary-key', url: 'https://secondary.example/v1', model: 'secondary-model' }
  }
};
sandbox.callAIMessages = async function(messages, maxTok, signal, tier, opts) {
  calls.push({ messages, maxTok, tier, opts });
  return JSON.stringify({
    class_updates: [{
      className: 'Canal Laborers',
      satisfactionDelta: -10,
      demands: ['remit lock repair levy'],
      unrestDelta: { grievance: 8, petition: 6 },
      linkedIssue: 'issue-lock-levy',
      reason: 'player operation tightened the lock repair levy'
    }],
    notes: ['canal laborers harden against the works levy']
  });
};
vm.createContext(sandbox);

function load(file) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox, { filename: file });
}

(async function main() {
  load('tm-engine-constants.js');
  load('tm-class-minxin-bridge.js');
  load('tm-class-engine.js');
  load('tm-party-goals.js');
  load('tm-player-action-signals.js');
  load('tm-party-class-llm-calibrator.js');

  const Bridge = sandbox.TM && sandbox.TM.ClassMinxinBridge;
  const Cal = sandbox.TM && sandbox.TM.PartyClassLlmCalibrator;
  assert(Bridge && typeof Bridge.getTuning === 'function', 'ClassMinxinBridge should expose getTuning for configurable thresholds');
  assert(Cal && typeof Cal.flushBeforeSubmit === 'function', 'PartyClassLlmCalibrator.flushBeforeSubmit should exist');

  const beforeLocal = root.adminHierarchy.player.divisions[0].children[0].minxin;
  const result = await Cal.flushBeforeSubmit({ root, source: 'pre-submit-player-action', force: true });
  assert(result && result.ok, 'pre-submit player action calibration should run');
  assert(calls[0] && calls[0].tier === 'secondary', 'live loop should use secondary API when configured');
  assert(root._partyClassLlmClassMinxin && root._partyClassLlmClassMinxin.audit.ok, 'LLM calibration should maintain class-minxin bridge before submit');
  assert(root.minxin.byClass.canal_laborers.true === root.classes[0].satisfaction, 'class-minxin byClass should be current before submit');
  assert(root.adminHierarchy.player.divisions[0].children[0].minxin < beforeLocal, 'regional minxin should move before submit');
  assert(root._pendingTinyiTopics.some(t => t && t.from === 'class-minxin-bridge' && t.sourceClass === 'Canal Laborers'), 'class-minxin pressure should enqueue a court topic before submit');
  assert(root.minxin.uprisingCandidates.some(c => c && c.className === 'Canal Laborers' && c.region === 'Canal Ward'), 'class-minxin pressure should enqueue uprising candidate before submit');

  const prompt = Bridge.formatForPrompt(root, { limit: 8 });
  assert(/Class Minxin Bridge/.test(prompt), 'prompt should include class-minxin bridge section');
  assert(/Canal Laborers/.test(prompt) && /Canal Ward/.test(prompt), 'prompt should include class and region evidence');

  const topicCount = root._pendingTinyiTopics.length;
  const candidateCount = root.minxin.uprisingCandidates.length;
  const ledgerCount = root._classMinxinBridgeLedger.length;
  Bridge.maintain(root, { turn: 71, source: 'live-loop-rerun' });
  Bridge.maintain(root, { turn: 71, source: 'live-loop-rerun' });
  assert(root._pendingTinyiTopics.length === topicCount, 'bridge maintenance should not duplicate court topics');
  assert(root.minxin.uprisingCandidates.length === candidateCount, 'bridge maintenance should not duplicate uprising candidates');
  assert(root._classMinxinBridgeLedger.length === ledgerCount, 'maintenance should not duplicate pressure ledger');

  const muted = {
    turn: 72,
    classMinxin: {
      thresholds: {
        courtIssueTrueMax: 10,
        courtIssuePressureDelta: 5,
        uprisingCandidateTrueMax: 10,
        uprisingCandidatePressureDelta: 5,
        uprisingCandidateByPhase: 0
      }
    },
    minxin: { trueIndex: 62, perceivedIndex: 64, byClass: {}, sources: {} },
    adminHierarchy: { player: { divisions: [{ name: 'Muted Circuit', children: [{ name: 'Muted Ward', minxin: 59, children: [] }] }] } },
    classes: [{
      name: 'Muted Artisans',
      key: 'muted_artisans',
      satisfaction: 55,
      influence: 50,
      demands: 'lower workshop fee',
      regionalVariants: [{ region: 'Muted Ward', weight: 1 }],
      unrestLevels: { grievance: 50, petition: 52, strike: 55, revolt: 60 }
    }]
  };
  Bridge.applyClassPressure(muted, {
    turn: 72,
    sourceSystem: 'smoke-muted',
    sourceId: 'weak-pressure',
    className: 'Muted Artisans',
    satisfactionDelta: -2,
    reason: 'weak fee pressure'
  });
  const mutedResult = Bridge.maintain(muted, { turn: 72, source: 'muted-config' });
  assert(mutedResult.courtIssues.spawned === 0, 'custom classMinxin court threshold should suppress weak court topic');
  assert(mutedResult.uprisingCandidates.spawned === 0, 'custom classMinxin uprising threshold should suppress weak uprising candidate');

  makeEl('minxin-body');
  makeEl('minxin-subtitle');
  load('tm-var-drawers.js');
  assert(typeof sandbox.renderMinxinPanel === 'function', 'minxin drawer renderer should load');
  sandbox.renderMinxinPanel();
  const drawerHtml = elements['minxin-body'].innerHTML;
  if (process.env.DEBUG_CLASS_MINXIN_LIVE) console.log(drawerHtml);
  assert(/Canal Laborers/.test(drawerHtml) && /近因/.test(drawerHtml), 'minxin drawer should render class-minxin near cause');
  assert(/Canal Ward/.test(drawerHtml), 'minxin drawer should render affected region');

  load('phase8-formal-rightrail.js');
  load('phase8-formal-rightrail-social.js');
  assert(bridgeShell.rightrail && bridgeShell.rightrail.renderers && typeof bridgeShell.rightrail.renderers.ol === 'function', 'right rail renderer should load');
  const rightHtml = bridgeShell.rightrail.renderers.ol();
  assert(!/阶层民心/.test(rightHtml), 'right rail card should not render class-minxin block inline');
  bridgeShell.rightrail.handleRightPanelAction('outline-select', { type: 'class', key: 'Canal Laborers' });
  const detailHtml = elements['tm-social-detail-flyout'] && elements['tm-social-detail-flyout'].innerHTML || '';
  assert(/阶层民心/.test(detailHtml), 'right rail detail should render class-minxin block');
  assert(/Canal Laborers/.test(detailHtml) && /Canal Ward/.test(detailHtml), 'right rail detail should render class-minxin class and region evidence');

  console.log('[smoke-class-minxin-live-loop] PASS live loop');
})().catch((e) => {
  console.error('[smoke-class-minxin-live-loop] FAIL:', (e && e.stack) || e);
  process.exit(1);
});
