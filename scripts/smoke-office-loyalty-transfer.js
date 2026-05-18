#!/usr/bin/env node
// smoke-office-loyalty-transfer.js - paired office dismiss+appoint should be treated as transfer/promotion.

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
let assertions = 0;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
  assertions++;
}

const context = {
  console,
  Date,
  JSON,
  Math,
  RegExp,
  Array,
  Object,
  String,
  Number,
  Boolean,
  parseInt,
  parseFloat,
  isNaN,
  isFinite,
  setTimeout() {},
  clearTimeout() {},
  document: {
    getElementById() { return null; },
    querySelectorAll() { return []; },
    createElement() { return {}; },
    body: {},
    addEventListener() {}
  },
  window: null,
  globalThis: null,
  TM: { errors: { capture(){}, captureSilent(){}, getLog(){ return []; } } },
  DebugLog: { log(){}, warn(){}, error(){} },
  P: { ai: {}, conf: {}, variables: [] },
  scriptData: {},
  GM: {
    turn: 3,
    chars: [
      { name: '袁崇焕', loyalty: 50, alive: true, officialTitle: '兵部右侍郎', title: '兵部右侍郎' }
    ],
    allCharacters: [
      { name: '袁崇焕', loyalty: 50, relationValue: 50 }
    ],
    turnChanges: {},
    _turnReport: [],
    evtLog: [],
    officeTree: [
      { name: '兵部', positions: [{ name: '兵部右侍郎', holder: '袁崇焕', headCount: 1, actualHolders: [{ name: '袁崇焕', joinedTurn: 1 }] }], subs: [] },
      { name: '内阁', positions: [{ name: '大学士', holder: '', headCount: 1, actualHolders: [] }], subs: [] }
    ]
  },
  addEB(type, text) { context.GM.evtLog.push({ type, text }); },
  preflightAIWriteBack(output) { return output; },
  applyAITurnChanges() {},
  applyCharacterDeaths() {},
  _dbg() {},
  toast() {},
  alert() {},
  autoSave() {},
  escHtml(v) { return String(v == null ? '' : v); },
  getTSText(turn) { return 'T' + turn; }
};

context.window = context;
context.globalThis = context;
context.findCharByName = function(name) {
  return (context.GM.chars || []).find(ch => ch && ch.name === name) || null;
};

vm.createContext(context);

function load(file) {
  const code = fs.readFileSync(path.join(ROOT, file), 'utf8');
  vm.runInContext(code, context, { filename: file });
}

load('tm-utils.js');
load('tm-endturn-apply.js');

(async function main() {
  const ctx = {
    input: {},
    prompt: { sc: {} },
    subcalls: {},
    results: {
      sc1: {
        office_changes: [
          { action: 'dismiss', dept: '兵部', position: '兵部右侍郎', reason: '升任内阁大学士' },
          { action: 'appoint', dept: '内阁', position: '大学士', person: '袁崇焕', reason: '升任内阁大学士' }
        ]
      }
    },
    apply: { applied: {} },
    record: {},
    meta: { errors: [], warnings: [], timing: {}, retries: {} }
  };

  await context.TM.Endturn.AI.apply.writeBack(ctx);

  const ch = context.findCharByName('袁崇焕');
  const log = context.GM._loyaltyLog || [];
  const memoryText = (ch._memory || []).map(m => m.event || '').join('\n');
  const turnChanges = ((context.GM.turnChanges || {}).characters || []).find(c => c.name === '袁崇焕');
  const loyaltyChanges = turnChanges ? turnChanges.changes.filter(c => c.field === 'loyalty') : [];

  assert(ch.officialTitle === '大学士', 'paired dismiss+appoint should leave character in the new office');
  assert(ch.loyalty >= 50, 'paired dismiss+appoint promotion must not reduce loyalty; got ' + ch.loyalty);
  assert(!log.some(x => x.name === '袁崇焕' && x.delta < 0 && /免去官职|罢免|dismiss/.test(x.reason || x.source || '')), 'promotion transfer should not log punitive dismissal loyalty');
  assert(!/被免去官职/.test(memoryText), 'promotion transfer should not write dismissal loyalty memory');
  assert(!context.GM.evtLog.some(e => e.type === '罢免' && /袁崇焕/.test(e.text || '')), 'promotion transfer should not be announced as punitive dismissal');
  assert(loyaltyChanges.every(c => c.newValue >= c.oldValue), 'turnChanges should not show a negative loyalty change for promotion transfer');

  console.log('[smoke-office-loyalty-transfer] PASS assertions=' + assertions);
})().catch(function(err) {
  console.error(err && err.stack || err);
  process.exit(1);
});
