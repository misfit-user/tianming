#!/usr/bin/env node
// smoke-endturn-systems-tail-guards.js
// Guards the end-turn systems tail after "应用决策变动" from aborting the whole turn.
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'tm-endturn-systems.js'), 'utf8');

let passed = 0;
function assert(cond, label) {
  if (!cond) throw new Error('[assert] ' + label);
  passed++;
}

assert(src.indexOf('showLoading("应用决策变动", 93)') >= 0,
  'systems step still exposes the change-queue loading marker');
assert(src.indexOf("typeof checkHistoryEvents === 'function'") >= 0,
  'history event check is guarded');
assert(src.indexOf("typeof checkRigidTriggers === 'function'") >= 0,
  'rigid trigger check is guarded');
assert(src.indexOf("typeof processChangeQueue === 'function'") >= 0,
  'reactive processChangeQueue is guarded');
assert(src.indexOf("typeof WorldHelper !== 'undefined'") >= 0 && src.indexOf('WorldHelper.clearCache') >= 0,
  'WorldHelper.clearCache is guarded');
assert(src.indexOf("typeof PositionSystem !== 'undefined'") >= 0,
  'PositionSystem optional call is guarded');
assert(src.indexOf("typeof VacantPositionReminder !== 'undefined'") >= 0,
  'VacantPositionReminder optional call is guarded');
assert(src.indexOf("typeof NaturalDeathSystem !== 'undefined'") >= 0,
  'NaturalDeathSystem optional call is guarded');

assert(src.indexOf('endTurn] 历史事件触发检查失败') >= 0,
  'history event failure has diagnostic log');
assert(src.indexOf('endTurn] 世界缓存清理失败') >= 0,
  'WorldHelper failure has diagnostic log');

console.log('[smoke-endturn-systems-tail-guards] pass assertions=' + passed);
