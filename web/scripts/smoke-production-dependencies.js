#!/usr/bin/env node
'use strict';
// Exercise the parser actually resolved by electron-updater; never contact an update server.
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
let passed = 0;
function test(name, fn) { fn(); console.log('PASS ' + name); passed++; }
const updaterRequire = createRequire(require.resolve('electron-updater/package.json'));
const yaml = updaterRequire('js-yaml');
const { parseUpdateInfo, resolveFiles } = updaterRequire('./out/providers/Provider.js');
test('empty mappings consume the YAML merge budget', () => {
  const input = 'base: &base [{}, {}, {}, {}]\nresult:\n  <<: *base\n';
  assert.throws(() => yaml.load(input, { maxTotalMergeKeys: 3 }), /maxTotalMergeKeys/);
  assert.deepEqual(yaml.load(input, { maxTotalMergeKeys: 8 }).result, {});
});
test('actual updater rejects excessive empty-source merges with its default budget', () => {
  const input = 'base: &base [' + Array(100).fill('{}').join(',') + ']\nrows:\n' + '  - <<: *base\n'.repeat(101);
  assert.throws(() => parseUpdateInfo(input, 'latest.yml', 'https://updates.invalid/latest.yml'), error =>
    error.code === 'ERR_UPDATER_INVALID_UPDATE_INFO' && /maxTotalMergeKeys/.test(error.message));
});
test('ordinary Chinese update metadata, hashes and signed-file URL resolution are preserved', () => {
  const info = parseUpdateInfo('version: 1.3.411\nreleaseNotes: "天命·例行修复"\nfiles:\n  - url: tianming.exe\n    sha512: example-hash\n    size: 123456\n',
    'latest.yml', 'https://updates.invalid/latest.yml');
  assert.equal(info.releaseNotes, '天命·例行修复');
  const files = resolveFiles(info, new URL('https://updates.invalid/releases/'));
  assert.equal(files[0].url.href, 'https://updates.invalid/releases/tianming.exe');
  assert.equal(files[0].info.sha512, 'example-hash');
  assert.equal(files[0].info.size, 123456);
  assert.throws(() => resolveFiles({ files: [{ url: 'no-hash.exe' }] }, new URL('https://updates.invalid/')),
    error => error.code === 'ERR_UPDATER_NO_CHECKSUM');
});
test('small legitimate YAML merges and invalid YAML retain their behavior', () => {
  assert.deepEqual(yaml.load('base: &b {size: 3}\nfile: {<<: *b, url: game.exe}\n').file, { size: 3, url: 'game.exe' });
  assert.throws(() => parseUpdateInfo('files: [', 'latest.yml', 'https://updates.invalid/latest.yml'),
    error => error.code === 'ERR_UPDATER_INVALID_UPDATE_INFO');
});
test('production closure contains neither adm-zip nor a vulnerable YAML version', () => {
  const pkg = require(path.join(root, 'package.json'));
  const lock = require(path.join(root, 'package-lock.json'));
  assert.equal(pkg.dependencies['adm-zip'], undefined);
  assert.equal(lock.packages['node_modules/adm-zip'].dev, true);
  assert.equal(updaterRequire('js-yaml/package.json').version, '4.3.2');
  assert.equal(lock.packages['node_modules/js-yaml'].version, '4.3.2');
  // Inspect npm's actual installed runtime closure, not only the root dependency label.
  const npmCli = path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
  const r = spawnSync(process.execPath, [npmCli, 'ls', '--omit=dev', '--all', '--json'], { cwd: root, encoding: 'utf8', timeout: 30000 });
  assert.equal(r.status, 0, r.stderr);
  const names = [];
  function walk(n) { for (const [name, value] of Object.entries(n.dependencies || {})) { names.push(name); walk(value); } }
  walk(JSON.parse(r.stdout));
  assert(!names.includes('adm-zip'));
  assert(names.includes('electron-updater') && names.includes('js-yaml') && names.includes('yauzl'));
});
console.log('PASS production-dependencies ' + passed + '/' + passed);
