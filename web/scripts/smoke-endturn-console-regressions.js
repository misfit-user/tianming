#!/usr/bin/env node
/* eslint-env node */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ceming = fs.readFileSync(path.join(ROOT, 'tm-ceming.js'), 'utf8');
const semantic = fs.readFileSync(path.join(ROOT, 'tm-semantic-recall.js'), 'utf8');

let passed = 0;
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
  passed += 1;
}

assert(!ceming.includes("\n    _switchTab('library');"), 'ceming dialog still calls undefined local _switchTab');
assert(ceming.includes("TM.ceming._switchTab('library')"), 'ceming dialog does not call namespaced tab switcher');

assert(semantic.includes('function probeSemanticAsset'), 'semantic recall local asset probe missing');
assert(semantic.includes("var localModelRoot = semanticAssetURL('./vendor/models/');"), 'semantic recall does not resolve bundled vendor models against its script URL');
assert(semantic.includes("localModelPath + 'config.json'"), 'semantic recall does not probe local model config');
assert(semantic.includes("localModelPath + 'tokenizer.json'"), 'semantic recall does not probe local tokenizer');
assert(semantic.includes('transformers.env.allowRemoteModels = false;'), 'semantic recall local branch may still hit remote models');
assert(semantic.includes('transformers.env.allowLocalModels = false;'), 'semantic recall missing explicit no-local branch');
assert(semantic.includes('semanticRecallRemoteFallback === true'), 'semantic recall remote fallback is not opt-in');
assert(semantic.includes("STATE.loadSource = 'unavailable';"), 'semantic recall unavailable state is not explicit');

console.log(`[smoke-endturn-console-regressions] PASS ${passed} assertions`);
