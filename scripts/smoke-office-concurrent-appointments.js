#!/usr/bin/env node
// smoke-office-concurrent-appointments.js - guard one character holding multiple offices.

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
let assertions = 0;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
  assertions += 1;
}

function fakeEl() {
  return { value: '', style: {}, innerHTML: '', textContent: '', appendChild(){}, remove(){}, querySelector(){ return null; } };
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
  isFinite,
  isNaN,
  setTimeout(){},
  clearTimeout(){},
  document: {
    getElementById: () => fakeEl(),
    querySelectorAll: () => [],
    createElement: () => fakeEl(),
    body: fakeEl(),
    addEventListener(){}
  },
  window: null,
  P: { playerInfo: { characterName: '皇帝' } },
  scriptData: {},
  GM: {
    turn: 12,
    officeTree: [],
    chars: [],
    evtLog: [],
    _turnReport: [],
    _chronicle: [],
    qijuHistory: []
  },
  SettlementPipeline: { register(){} },
  TM: { errors: { capture(){}, captureSilent(){} } },
  autoSave(){},
  showToast(){},
  alert(){},
  escHtml(v) { return String(v == null ? '' : v); },
  toast(){},
  _dbg(){},
  addEB(){},
  recordCharacterArc(){},
  _isSameLocation(a, b) { return a === b; },
  getTSText(turn) { return 'T' + turn; },
  findCharByName() { return null; }
};
context.window = context;
context.globalThis = context;
context.addEB = function(type, text) { context.GM.evtLog.push({ type, text }); };
context.findCharByName = function(name) {
  return (context.GM.chars || []).find(ch => ch && ch.name === name) || null;
};

vm.createContext(context);

function load(file) {
  const code = fs.readFileSync(path.join(ROOT, file), 'utf8');
  vm.runInContext(code, context, { filename: file });
}

load('tm-office-system.js');
load('tm-ai-change-applier.js');
load('tm-endturn-edict.js');

function resetState() {
  context.GM.turn = 12;
  context.GM.evtLog = [];
  context.GM._turnReport = [];
  context.GM._chronicle = [];
  context.GM.qijuHistory = [];
  context.GM.chars = [
    { name: '兼官者', officialTitle: '侍郎', position: '侍郎', alive: true, location: '京师' },
    { name: '前任尚书', officialTitle: '尚书', position: '尚书', alive: true, location: '京师' },
    { name: '调任者', officialTitle: '给事中', position: '给事中', alive: true, location: '京师' }
  ];
  context.GM.officeTree = [
    { name: '吏部', positions: [
      { name: '尚书', holder: '前任尚书', establishedCount: 1, vacancyCount: 0, actualHolders: [{ name: '前任尚书', generated: true }] },
      { name: '侍郎', holder: '兼官者', establishedCount: 1, vacancyCount: 0, actualHolders: [{ name: '兼官者', generated: true }] },
      { name: '给事中', holder: '调任者', establishedCount: 1, vacancyCount: 0, actualHolders: [{ name: '调任者', generated: true }] }
    ], subs: [] }
  ];
}

resetState();
let parsed = context.extractEdictActions('命兼官者以侍郎加兼尚书。');
assert(parsed.appointments.length === 1, 'edict parser should find concurrent appointment');
assert(parsed.appointments[0].concurrent === true, 'edict parser should mark 加兼 as concurrent');
context.applyEdictActions(parsed);

let shangshu = context.GM.officeTree[0].positions[0];
let shilang = context.GM.officeTree[0].positions[1];
let concurrentChar = context.findCharByName('兼官者');
assert(shangshu.holder === '兼官者', 'concurrent edict should seat character in new office');
assert(shilang.holder === '兼官者', 'concurrent edict should keep original office holder');
assert(concurrentChar.officialTitle === '侍郎', 'concurrent edict should keep original title as primary');
assert(Array.isArray(concurrentChar.concurrentTitles) && concurrentChar.concurrentTitles.indexOf('尚书') >= 0, 'concurrent edict should record new office as concurrent title');
assert(Array.isArray(concurrentChar.officialTitles) && concurrentChar.officialTitles.indexOf('侍郎') >= 0 && concurrentChar.officialTitles.indexOf('尚书') >= 0, 'concurrent edict should expose all offices');

resetState();
let normal = context.onAppointment('调任者', '尚书', { dept: '吏部' });
assert(normal && normal.ok, 'normal appointment should succeed');
assert(context.GM.officeTree[0].positions[2].holder === '', 'normal appointment should still vacate previous office');
assert(context.findCharByName('调任者').officialTitle === '尚书', 'normal appointment should replace primary title');

resetState();
let aiConcurrent = context.onAppointment('兼官者', '尚书', { dept: '吏部', concurrent: true, reason: '兼职总理部务' });
assert(aiConcurrent && aiConcurrent.ok, 'AI concurrent appointment should succeed');
assert(context.GM.officeTree[0].positions[1].holder === '兼官者', 'AI concurrent appointment should not vacate old office');
assert(context.findCharByName('兼官者').concurrentTitles.indexOf('尚书') >= 0, 'AI concurrent appointment should store concurrent title');

resetState();
const ch = context.findCharByName('兼官者');
ch._travelTo = '京师';
ch._travelFrom = '南京';
ch._travelRemainingDays = 0;
ch._travelReason = '奉诏加兼尚书·赴任';
ch._travelAssignPost = '吏部/尚书';
ch._travelAssignConcurrent = true;
context.AIChangeApplier.advanceCharTravelByDays(1);
assert(context.GM.officeTree[0].positions[1].holder === '兼官者', 'travel arrival concurrent appointment should keep old office');
assert(context.findCharByName('兼官者').concurrentTitles.indexOf('尚书') >= 0, 'travel arrival should preserve concurrent title');

console.log('[smoke-office-concurrent-appointments] pass assertions=' + assertions);
