#!/usr/bin/env node
/* eslint-env node */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const wenduiSrc = (fs.readFileSync(path.join(ROOT, 'tm-wendui.js'), 'utf8') + '\n' + fs.readFileSync(path.join(ROOT, 'tm-wendui-persona-views.js'), 'utf8'));

let passed = 0;
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
  passed += 1;
}

const parserCalls = [];
const toasts = [];
const sandbox = {
  console,
  setTimeout() {},
  clearTimeout() {},
  Promise,
  Array,
  Object,
  String,
  Number,
  Boolean,
  RegExp,
  Date,
  Math,
  JSON,
  parseInt,
  parseFloat,
  isFinite,
  GM: {
    sid: 'smoke',
    turn: 18,
    chars: [{ name: '毕自严', officialTitle: '户部尚书', loyalty: 80, alive: true }],
    wenduiHistory: {},
    qijuHistory: [],
    _edictSuggestions: []
  },
  P: { ai: { key: 'k' }, playerInfo: { characterName: '崇祯' } },
  document: {
    createElement() { return { style: {}, appendChild() {}, textContent: '', innerHTML: '' }; },
    getElementById() { return null; }
  },
  window: {},
  findScenarioById: () => null,
  findCharByName(n) { return sandbox.GM.chars.find(c => c.name === n); },
  escHtml(s) { return String(s == null ? '' : s); },
  _$() { return null; },
  toast(s) { toasts.push(String(s || '')); },
  addEB() {},
  renderWenduiChars() {},
  _renderEdictSuggestions() {},
  EdictParser: {
    tryExecute() {
      parserCalls.push(Array.from(arguments));
      return { ok: true };
    }
  },
  getTSText: () => 'T18'
};
sandbox.window = sandbox;
sandbox.global = sandbox;
sandbox.globalThis = sandbox;

vm.createContext(sandbox);
vm.runInContext(wenduiSrc, sandbox, { filename: 'tm-wendui.js' });

assert(typeof sandbox._wdStoreEdictSuggestion === 'function', '_wdStoreEdictSuggestion must exist');
assert(typeof sandbox._wdBuildEdictDraftFromCounsel === 'function', '_wdBuildEdictDraftFromCounsel must exist');

const stored = sandbox._wdStoreEdictSuggestion('毕自严', {
  topic: '针对辽饷拖欠',
  content: '臣请户部会同兵部，核辽东各镇欠饷，先发银五万两，三月内具册回奏。'
}, { mode: 'formal', playerPrompt: '辽饷何以处置？' });

assert(stored && stored.source === '问对', 'stored suggestion should keep 问对 source');
assert(stored.from === '毕自严', 'stored suggestion should keep adviser name');
assert(stored.draftOnly === true, 'stored suggestion should be draft-only');
assert(stored.requiresPlayerApproval === true, 'stored suggestion should require player approval');
assert(stored.status === 'pending_player_edict', 'stored suggestion should wait for player edict');
assert(/诏令/.test(stored.draftText || ''), 'stored suggestion should generate an edict draft text');
assert(/辽饷拖欠/.test(stored.draftText || '') && /五万两/.test(stored.draftText || ''), 'draft should preserve topic and concrete proposal');
assert(stored.text === stored.draftText, 'suggestion text should point at editable draft');
assert(sandbox.GM._edictSuggestions.length === 1, 'suggestion should be pushed into GM._edictSuggestions');
assert(parserCalls.length === 0, 'storing wendui suggestions must not execute EdictParser');

sandbox.GM.wenduiTarget = '毕自严';
sandbox.window.getSelection = () => ({ toString: () => '臣请严禁私铸，责成五城兵马司搜检私钱作坊。' });
sandbox._wdAddToEdict();
const manual = sandbox.GM._edictSuggestions[1];
assert(manual && manual.draftOnly === true, 'manual excerpt should also be draft-only');
assert(/严禁私铸/.test(manual.draftText || ''), 'manual excerpt should become draft text');
assert(parserCalls.length === 0, 'manual excerpt must not execute EdictParser');
assert(toasts.some(t => /草诏|建议库/.test(t)), 'manual excerpt should notify the suggestion library');

console.log(`[smoke-wendui-edict-draft-suggestions] PASS ${passed} assertions`);
