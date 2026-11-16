#!/usr/bin/env node
// smoke-player-action-signals.js - structured player action evidence for party/class calibration.

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

function assert(cond, msg) {
  if (!cond) throw new Error('[assert] ' + msg);
}

const sandbox = {
  console,
  Math, Date, JSON, RegExp, Error, Promise,
  Array, Object, String, Number, Boolean,
  parseInt, parseFloat, isNaN, isFinite,
  setTimeout: (fn) => { fn(); return 1; },
  clearTimeout: () => {},
  window: {},
  scriptData: {}
};
sandbox.window = sandbox;
sandbox.global = sandbox;
sandbox.globalThis = sandbox;
sandbox.P = {
  conf: { partyClassLlmEnabled: true },
  ai: {
    key: 'primary-key',
    url: 'https://primary.example/v1',
    secondary: { key: 'secondary-key', url: 'https://secondary.example/v1' }
  }
};
sandbox.GM = null;
vm.createContext(sandbox);

function load(file) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox, { filename: file });
}

(async function main() {
  load('tm-player-action-signals.js');

  const Signals = sandbox.TM && sandbox.TM.PlayerActionSignals;
  assert(Signals && typeof Signals.record === 'function', 'PlayerActionSignals.record should exist');
  assert(typeof Signals.snapshot === 'function', 'PlayerActionSignals.snapshot should exist');
  assert(typeof Signals.formatForPrompt === 'function', 'PlayerActionSignals.formatForPrompt should exist');
  assert(typeof Signals.clear === 'function', 'PlayerActionSignals.clear should exist');

  const root = {
    turn: 12,
    parties: [
      {
        name: 'Market Party',
        currentAgenda: 'stabilize stall fees and guild supply',
        shortGoal: 'broker guild relief',
        socialBase: ['Shopkeepers']
      },
      {
        name: 'Guard Party',
        currentAgenda: 'garrison discipline'
      }
    ],
    classes: [
      {
        name: 'Shopkeepers',
        aliases: ['Market folk'],
        demands: ['reduce stall fees', 'protect market roads'],
        tags: ['market', 'tax']
      },
      {
        name: 'Soldiers',
        demands: ['pay arrears'],
        tags: ['army']
      }
    ],
    _partyClassLlmActionSignals: []
  };
  sandbox.GM = root;

  const first = Signals.record(root, {
    kind: 'edict',
    source: 'smoke',
    topic: 'market relief',
    text: 'reduce stall fees for East Market after flood losses',
    target: 'East Market',
    intensity: 0.8
  });
  const second = Signals.record(root, {
    kind: 'memorial',
    source: 'smoke',
    actor: 'Market Censor',
    text: 'Market Censor reports shopkeepers cannot bear new fees'
  });

  assert(first && first.seq === 1, 'first action signal should receive sequence number');
  assert(second && second.seq === 2, 'second action signal should receive sequence number');
  assert(Array.isArray(root._playerActionSignals.items) && root._playerActionSignals.items.length === 2, 'signals should be stored on the game root');
  assert(root._partyClassLlmActionSignals.length >= 2, 'signals should mirror into the legacy calibrator action signal field');

  const snap = Signals.snapshot(root, { limit: 5 });
  assert(snap.signals.length === 2, 'snapshot should include recent player action signals');
  assert(snap.candidateClasses.some(x => x && x.name === 'Shopkeepers'), 'snapshot should infer candidate classes from scenario names/demands/tags');
  assert(snap.candidateParties.some(x => x && x.name === 'Market Party'), 'snapshot should infer candidate parties from social base and agendas');
  assert(snap.policyTags.includes('tax') || snap.policyTags.includes('market'), 'snapshot should aggregate policy tags');
  assert(/reduce stall fees/.test(snap.summaryText), 'snapshot summary should include action text evidence');

  const prompt = Signals.formatForPrompt(root, { limit: 5 });
  assert(/Player Action Signals/.test(prompt), 'prompt formatter should use a stable section heading');
  assert(/Shopkeepers/.test(prompt), 'prompt formatter should expose matched class evidence');
  assert(/Market Party/.test(prompt), 'prompt formatter should expose matched party evidence');

  load('tm-party-class-llm-calibrator.js');
  const Cal = sandbox.TM && sandbox.TM.PartyClassLlmCalibrator;
  const calSnap = Cal.buildSnapshot(root, { source: 'smoke-player-signal', phase: 'pre-submit' });
  assert(calSnap.structuredPlayerSignals && calSnap.structuredPlayerSignals.signals.length === 2, 'calibrator snapshot should include structured player action signals');
  const messages = Cal.buildMessages(calSnap);
  assert(messages.some(m => /structuredPlayerSignals/.test(String(m.content || ''))), 'calibrator prompt should serialize structured player signals');
  assert(messages.some(m => /Prefer structuredPlayerSignals/.test(String(m.content || ''))), 'calibrator system prompt should instruct the LLM to prefer structured player signals');
  assert(typeof Cal.getDiagnostics === 'function', 'calibrator diagnostics API should be exposed');
  const diag = Cal.getDiagnostics(root);
  assert(diag && diag.playerSignals && diag.playerSignals.count === 2, 'diagnostics should summarize player signals');

  Signals.clear(root);
  assert(Signals.snapshot(root).signals.length === 0, 'clear should remove structured signals for the current root');

  const indexSource = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const signalScript = indexSource.indexOf('tm-player-action-signals.js');
  const calibratorScript = indexSource.indexOf('tm-party-class-llm-calibrator.js');
  assert(signalScript >= 0, 'index.html should load tm-player-action-signals.js');
  assert(calibratorScript >= 0 && signalScript < calibratorScript, 'player action signals script should load before the LLM calibrator');

  const moduleSource = fs.readFileSync(path.join(ROOT, 'phase8-formal-modules.js'), 'utf8');
  const rightSource = fs.readFileSync(path.join(ROOT, 'phase8-formal-rightrail.js'), 'utf8');
  const moduleEmitMatch = /function emitPlayerActionSignal\(payload(?:,\s*options)?\)/.exec(moduleSource);
  const moduleEmit = moduleEmitMatch ? moduleEmitMatch.index : -1;
  const moduleRecord = moduleSource.indexOf('TM.PlayerActionSignals.record(GM, payload)', moduleEmit);
  const moduleNotify = moduleSource.indexOf('skipSignalRecord: recorded', moduleEmit);
  assert(moduleEmit >= 0 && moduleRecord > moduleEmit && moduleNotify > moduleRecord, 'formal module should record structured evidence before scheduling LLM without duplication');
  const rightEmit = rightSource.indexOf('function emitRightPlayerActionSignal(payload)');
  const rightRecord = rightSource.indexOf('TM.PlayerActionSignals.record(GM, payload)', rightEmit);
  const rightNotify = rightSource.indexOf('skipSignalRecord: recorded', rightEmit);
  assert(rightEmit >= 0 && rightRecord > rightEmit && rightNotify > rightRecord, 'right rail should record structured evidence before scheduling LLM without duplication');

  console.log('[smoke-player-action-signals] PASS structured player action signals');
})().catch((e) => {
  console.error('[smoke-player-action-signals] FAIL:', (e && e.stack) || e);
  process.exit(1);
});
