#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const WEB = path.resolve(__dirname, '..');
const render = fs.readFileSync(path.join(WEB, 'tm-endturn-render.js'), 'utf8');
const formal = fs.readFileSync(path.join(WEB, 'phase8-formal-drafts.js'), 'utf8');
let assertions = 0;
function check(value, message) {
  if (!value) throw new Error('[smoke-postcommit-draft-cleanup] ' + message);
  assertions++;
}
function sliceFn(source, marker) {
  const start = source.indexOf(marker);
  if (start < 0) throw new Error('missing function: ' + marker);
  let pos = source.indexOf('{', start), depth = 0;
  for (; pos < source.length; pos++) {
    if (source[pos] === '{') depth++;
    else if (source[pos] === '}' && --depth === 0) return source.slice(start, pos + 1);
  }
  throw new Error('unterminated function: ' + marker);
}

const ids = ['edict-pol','edict-mil','edict-dip','edict-eco','edict-oth','xinglu','xinglu-pub','xinglu-prv'];
const nodes = Object.fromEntries(ids.map(id => [id, { value: 'submitted-' + id }]));
let toastText = '';
let captured = 0;
const ctx = {
  console,
  Error,
  Array,
  _: id => nodes[id] || null,
  toast(text) { toastText = String(text); },
  TM: { errors: { capture() { captured++; } } }
};
ctx._$ = ctx._;
ctx.window = ctx;
ctx.TMPhase8FormalBridge = {
  clearEdictDrafts() {
    return { ok: false, committed: true, errors: [new Error('injected draft-store cleanup failure')] };
  }
};
vm.createContext(ctx);
vm.runInContext(sliceFn(render, 'function _endTurn_clearCommittedInputs()'), ctx);
const result = ctx._endTurn_clearCommittedInputs();
check(result === false && ids.every(id => nodes[id].value === ''), 'all legacy input values are cleared even when durable UI cleanup reports an error');
check(captured === 1 && /已经生效/.test(toastText) && /清理不完整/.test(toastText),
  'post-commit cleanup failure is diagnostic and explicitly tells the player the edict already committed');

const clearStart = formal.indexOf('function clearFormalEdictDrafts()');
const clearBody = sliceFn(formal, 'function clearFormalEdictDrafts()');
check(clearStart >= 0 && clearBody.indexOf('state.edictDraft = []') < clearBody.indexOf('clearFormalDraftStore'),
  'formal bridge clears in-memory truth before fallible persistence cleanup');

console.log('[smoke-postcommit-draft-cleanup] PASS assertions=' + assertions);
