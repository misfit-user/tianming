#!/usr/bin/env node
// smoke-endturn-render-loading-guard.js
// Guards against the end-turn loading overlay being left open if Shiji render fails.
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

const renderIdx = src.indexOf('_endTurn_render.apply(null, _renderArgs);');
assert(renderIdx >= 0, 'render call exists');

const renderBlockStart = src.lastIndexOf("if (typeof _endTurn_render === 'function')", renderIdx);
const renderBlock = src.slice(renderBlockStart, renderIdx + 1800);
assert(renderBlockStart >= 0, 'render block found');
assert(renderBlock.indexOf('try {') >= 0, 'render call is wrapped in try/catch');
assert(renderBlock.indexOf("typeof hideLoading === 'function'") >= 0, 'render failure hides loading overlay');
assert(renderBlock.indexOf('pipeline.render-finalize] render failed') >= 0, 'render failure has diagnostic label');
assert(renderBlock.indexOf('ctx.results.renderError') >= 0, 'render failure is recorded in ctx');
assert(renderBlock.indexOf('showTurnResult(') >= 0 || renderBlock.indexOf('toast(') >= 0,
  'render failure gives player-visible feedback');

console.log('[smoke-endturn-render-loading-guard] pass assertions=' + passed);
