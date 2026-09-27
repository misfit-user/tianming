'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'scripts/release.js'), 'utf8');
const source = fs.readFileSync(path.join(root, 'scripts/release-web-only.js'), 'utf8');
function fixture(initialTag = '') {
  const calls = [], head = 'a'.repeat(40); let tag = initialTag;
  const fake = (command, args) => { calls.push([command, ...args]);
    if (command === 'git') return { status: 0, stdout: tag ? tag + '\trefs/tags/ship-1.3.5.2\n' : '' };
    if (args[0] === 'release' && args[1] === 'view') return { status: tag ? 0 : 1, stdout: '{}' };
    if (args[0] === 'release' && args[1] === 'create') tag = args[args.indexOf('--target') + 1];
    return { status: 0, stdout: 'ok' };
  };
  const context = { module: { exports: {} }, console: { log() {} }, process, require(name) { return name === 'node:child_process' ? { spawnSync: fake } : require(name); } };
  vm.runInNewContext(source, context); return { api: context.module.exports, calls, head };
}
const f = fixture();f.api.publish({ root, version: '1.3.5.2', head: f.head, notes: 'Source and Pages only' });
assert(f.calls.some(c => c[0] === 'gh' && c[1] === 'release' && c[2] === 'create'));
assert(f.calls.some(c => c[0] === 'gh' && c[1] === 'workflow' && c.includes('ref=' + f.head)));
assert(!f.calls.some(c => /upload|autodeploy|build-capgo|build-hot-update/.test(c.join(' '))));
const existing = fixture('b'.repeat(40));assert.throws(() => existing.api.publish({ root, version: '1.3.5.2', head: existing.head, notes: '' }), /does not match/);
assert.throws(() => fixture().api.publish({ root, version: '1.3.5.2', head: '', notes: '' }), /locked/);
const preparation = main.slice(main.indexOf('async function prepareRelease()'), main.indexOf('async function publishRelease()'));
const publication = main.slice(main.indexOf('async function publishRelease()'), main.indexOf('(async function main()'));
assert(preparation.indexOf('if (CFG.webOnly)') < preparation.indexOf('buildDesktop();'));
assert(publication.indexOf('if (CFG.webOnly)') < publication.indexOf('buildDesktop();'));
assert(publication.includes("gatePublishRepository('上传前');\n    gateGitHubOwner();\n    webOnly.publish"));
assert(publication.includes('if (CFG.noUpload) return;'));
console.log('PASS web-only source release: locked tag, owner gates, pinned Pages, no OTA or archive commands');
