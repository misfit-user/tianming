#!/usr/bin/env node
// smoke-postturn-court-deferred-finalize.js
// Guards that the post-turn court deferred path still runs normal post-render openers.

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'tm-endturn-pipeline-steps.js'), 'utf8');

let passed = 0;
function assert(cond, label) {
  if (!cond) throw new Error('[assert] ' + label);
  passed++;
}

assert(src.indexOf('async function _runPostRenderTurnOpeners(ctx)') >= 0, 'shared post-render opener helper exists');
assert(src.indexOf('await _runPostRenderTurnOpeners(ctx);') >= 0, 'post-turn court close path calls post-render opener helper');

const deferredMatch = src.match(/GM\._pendingShijiModal\.deferredPhase5\s*=\s*async function\(\)\s*\{([\s\S]*?)return ctx; \/\/ deferred/);
assert(!!deferredMatch, 'deferred phase5 block found');
assert(deferredMatch[1].indexOf('await _runPostRenderTurnOpeners(ctx);') >= 0, 'deferred court-close path calls shared opener helper');

const helperMatch = src.match(/async function _runPostRenderTurnOpeners\(ctx\)\s*\{([\s\S]*?)\n  \}\n\n  \/\*\* @type/);
assert(!!helperMatch, 'helper body found');
assert(helperMatch[1].indexOf('FactionNpcDispatchQueue') >= 0, 'helper includes unified NPC LLM dispatch scheduling');
assert(helperMatch[1].indexOf('scheduleTurnRuns') >= 0, 'helper schedules eager and in-turn NPC LLM through one dispatcher');
assert(helperMatch[1].indexOf('FactionIndex') >= 0, 'helper includes faction index refresh');

console.log('[smoke-postturn-court-deferred-finalize] pass assertions=' + passed);
