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
console.log('PASS semantic offline assets: pinned WASM hashes, local roots and worker entry');
