#!/usr/bin/env node
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert');
const web = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(web, 'vendor/transformers/wasm-manifest.json'), 'utf8'));
assert.strictEqual(manifest.version, '1.14.0');
assert.strictEqual(manifest.files.length, 4);
for (const row of manifest.files) {
  assert(/^vendor\/transformers\/ort-wasm(?:-simd)?(?:-threaded)?\.wasm$/.test(row.file));
  const content = fs.readFileSync(path.join(web, row.file));
  assert.strictEqual(content.length, row.bytes);
  assert.strictEqual(crypto.createHash('sha256').update(content).digest('hex'), row.sha256);
  assert.strictEqual(content.subarray(0, 4).toString('hex'), '0061736d');
}
const recall = fs.readFileSync(path.join(web, 'tm-semantic-recall.js'), 'utf8');
const worker = fs.readFileSync(path.join(web, 'tm-semantic-worker.js'), 'utf8');
assert(recall.includes("wasm.wasmPaths = semanticAssetURL('./vendor/transformers/');"));
assert(recall.includes("new Worker(semanticAssetURL('./tm-semantic-worker.js'), { type: 'module' })"));
assert(worker.includes('wasm.wasmPaths = localWasmRoot;'));
assert(worker.includes('new URL(localWasmRoot, self.location.href).href'));
console.log('PASS semantic offline assets: pinned WASM hashes, local roots and worker entry');
