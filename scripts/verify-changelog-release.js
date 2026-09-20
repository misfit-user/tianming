'use strict';
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const source = fs.readFileSync(path.join(__dirname, '../web/tm-changelog.js'), 'utf8');
function data(version, count, date = '2026-09-20') { return { entries: Array.from({ length: count }, (_, i) => ({ module: version + ' item ' + i, date, title: 'test' })) }; }
async function selected(local, remote) {
  const context = { document: { readyState: 'loading', addEventListener() {} }, localStorage: { getItem() { return null; } }, setTimeout() {}, clearTimeout() {}, console,
    fetch(url) { const value = String(url).startsWith('changelog.json') ? local : remote; return Promise.resolve({ ok: !!value, json: () => Promise.resolve(value) }); } };
  context.window = context;vm.runInNewContext(source, context);return context.TM_Changelog.getUnreadCount();
}
(async () => {
  assert.equal(await selected(data('1.3.5.2', 2), data('1.3.5.1', 5)), 2, 'older server with more rows must not mask current release');
  assert.equal(await selected(data('1.3.5.2', 5), data('1.3.5.10', 1)), 1, 'numeric newest version wins');
  assert.equal(await selected(data('1.3.5.2', 2, '2026-09-21'), data('1.3.5.2', 5)), 2, 'date resolves same-version updates');
  assert.equal(await selected(data('1.3.5.2', 2), null), 2, 'offline local release remains readable');
  assert.equal(await selected(null, data('1.3.5.2', 3)), 3, 'remote-only fallback retained');
  console.log('PASS changelog release selection: 5 cases');
})().catch(error => { console.error(error); process.exitCode = 1; });
