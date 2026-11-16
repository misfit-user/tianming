#!/usr/bin/env node
// smoke-faction-llm-priority-lifecycle.js
// Guards the faction LLM handoff: manual source, SC16 priority scoring, save lifecycle.

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function runFile(ctx, file) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), ctx, { filename: file });
}

function makeContext() {
  const ctx = {
    console: { log() {}, warn() {}, error() {} },
    Math,
    Date,
    JSON,
    Object,
    Array,
    Number,
    String,
    Boolean,
    RegExp,
    isFinite,
    parseInt,
    parseFloat
  };
  ctx.window = ctx;
  ctx.global = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  runFile(ctx, 'tm-faction-action-engine.js');
  return ctx;
}

function sc16PriorityScoreTest() {
  const ctx = makeContext();
  ctx.GM = {
    turn: 12,
    facs: [
      { name: 'LowStrengthPriority', derivedStrength: { value: 10 }, derivedHealth: { overall: 80 } },
      { name: 'HighStrengthQuiet', derivedStrength: { value: 100 }, derivedHealth: { overall: 80 } }
    ],
    activeWars: [],
    currentIssues: [],
    factionEvents: [],
    _factionUndercurrents: [],
    qijuHistory: [],
    _sc16FactionDirectives: {
      turn: 12,
      byFaction: {
        LowStrengthPriority: {
          turn: 12,
          priorityScore: 95,
          priorityRank: 1,
          priorityReason: 'SC16 says this faction must be resolved first',
          hasDirectContent: false,
          actions: [],
          directives: []
        }
      }
    }
  };
  const weak = ctx.TM.FactionActionEngine.scoreFactionCandidate(ctx.GM.facs[0], { turn: 12 });
  const strong = ctx.TM.FactionActionEngine.scoreFactionCandidate(ctx.GM.facs[1], { turn: 12 });
  assert(
    weak.score > strong.score,
    'SC16 high priority should outrank a merely strong quiet faction; got weak=' + weak.score + ' strong=' + strong.score
  );
  assert(
    weak.reasons.indexOf('sc16-priority') >= 0,
    'SC16 priority score should leave an explicit sc16-priority reason'
  );
}

sc16PriorityScoreTest();

console.log('[smoke-faction-llm-priority-lifecycle] all assertions pass');
