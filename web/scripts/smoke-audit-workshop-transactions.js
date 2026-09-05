'use strict';
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const cp = require('child_process');
const { createWorkshopTransactions } = require('../../main-workshop-transaction');
function harness(base, fault) {
  const root = path.join(base, 'workshop'), packsRoot = path.join(root, 'packs'), indexFile = path.join(root, 'index.json');
  const io = Object.create(fs); let copies = 0, renames = 0;
  io.copyFileSync = (...args) => { if (fault === 'copy-' + (++copies)) throw new Error('injected copy'); return fs.copyFileSync(...args); };
  io.renameSync = (...args) => { if (fault === 'rename-' + (++renames)) throw new Error('injected rename'); const result = fs.renameSync(...args); if (fault === 'crash') process.exit(86); return result; };
  io.rmSync = (...args) => { if (fault === 'cleanup' && path.basename(args[0]).startsWith('.backup-')) throw new Error('injected cleanup'); return fs.rmSync(...args); };
  const writeJsonAtomic = (file, value) => {
    if (fault === 'index' && file === indexFile) throw new Error('injected index');
    fs.mkdirSync(path.dirname(file), { recursive: true }); const tmp = file + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(value)); fs.renameSync(tmp, file);
    if (fault === 'commit-crash' && file === indexFile) process.exit(86);
  };
  const validate = dir => { if (fault === 'validate' && dir.includes('.stage-')) throw new Error('injected validation'); return JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'))); };
  return { root, packsRoot, indexFile, tx: createWorkshopTransactions({ fs: io, path, crypto, root, packsRoot, indexFile, writeJsonAtomic, validate,
    publicInfo: (pack, target, enabled) => ({ ...pack, path: target, enabled }), normalizeId: id => /^[a-z-]+$/.test(id) ? id : 'invalid' }) };
}
if (process.argv[2] === '--crash') { harness(process.argv[3], 'crash').tx.install(path.join(process.argv[3], 'incoming'), { overwrite: true }); process.exit(1); }
if (process.argv[2] === '--commit-crash') { harness(process.argv[3], 'commit-crash').tx.install(path.join(process.argv[3], 'incoming'), { overwrite: true }); process.exit(1); }
if (process.argv[2] === '--contend') {
  const original = fs.copyFileSync; let signalled = false;
  fs.copyFileSync = (...args) => { if (!signalled) { signalled = true; console.log('LOCKED'); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 350); } return original(...args); };
  harness(process.argv[3]).tx.install(path.join(process.argv[3], 'incoming'), { overwrite: true }); process.exit(0);
}
(async () => {
const base = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-audit-workshop-'));
try {
  const incoming = path.join(base, 'incoming'); fs.mkdirSync(incoming);
  fs.writeFileSync(path.join(incoming, 'manifest.json'), JSON.stringify({ id: 'a-pack', version: 'old' }));
  fs.writeFileSync(path.join(incoming, 'data.txt'), 'old');
  const h = harness(base); h.tx.install(incoming);
  const oldIndex = fs.readFileSync(h.indexFile);
  fs.writeFileSync(path.join(incoming, 'data.txt'), 'new');
  fs.writeFileSync(path.join(incoming, 'manifest.json'), JSON.stringify({ id: 'a-pack', version: 'new' }));
  for (const fault of ['copy-1', 'copy-2', 'validate', 'rename-1', 'rename-2', 'index']) {
    assert.throws(() => harness(base, fault).tx.install(incoming, { overwrite: true }), /injected/);
    assert.equal(fs.readFileSync(path.join(h.packsRoot, 'a-pack/data.txt'), 'utf8'), 'old', fault);
    assert.deepEqual(fs.readFileSync(h.indexFile), oldIndex, fault);
  }
  const crash = cp.spawnSync(process.execPath, [__filename, '--crash', base]); assert.equal(crash.status, 86);
  harness(base).tx.recover();
  assert.equal(fs.readFileSync(path.join(h.packsRoot, 'a-pack/data.txt'), 'utf8'), 'old');
  assert.deepEqual(fs.readFileSync(h.indexFile), oldIndex);
  assert.equal(h.tx.install(incoming, { overwrite: true }).success, true);
  assert.equal(h.tx.read().packs[0].version, 'new');
  assert.equal(fs.readFileSync(path.join(h.packsRoot, 'a-pack/data.txt'), 'utf8'), 'new');
  assert.throws(() => h.tx.install(path.join(h.packsRoot, 'a-pack'), { overwrite: true }), /overlap/);
  const cleanup = harness(base, 'cleanup').tx.install(incoming, { overwrite: true });
  assert.equal(cleanup.success, true); assert.match(cleanup.warning, /已提交/);
  assert.equal(h.tx.read().packs[0].version, 'new'); // recovery only removes obsolete backups after commit
  const committedCrash = cp.spawnSync(process.execPath, [__filename, '--commit-crash', base]); assert.equal(committedCrash.status, 86);
  harness(base).tx.recover(); assert.equal(h.tx.read().packs[0].version, 'new'); assert.equal(fs.readFileSync(path.join(h.packsRoot, 'a-pack/data.txt'), 'utf8'), 'new');
  const concurrent = cp.spawn(process.execPath, [__filename, '--contend', base], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  const done = new Promise((resolve, reject) => { concurrent.once('error', reject); concurrent.once('exit', resolve); });
  await new Promise((resolve, reject) => { concurrent.stdout.once('data', resolve); concurrent.once('error', reject); });
  assert.throws(() => h.tx.setEnabled('a-pack', false), /in-progress/);
  assert.equal(await done, 0); assert.equal(h.tx.read().packs[0].version, 'new');
  await Promise.all([Promise.resolve().then(() => h.tx.setEnabled('a-pack', false)), Promise.resolve().then(() => h.tx.install(incoming, { overwrite: true }))]);
  const other = path.join(base, 'other'); fs.mkdirSync(other); fs.writeFileSync(path.join(other, 'manifest.json'), JSON.stringify({ id: 'b-pack', version: 'b' }));
  await Promise.all([Promise.resolve().then(() => h.tx.install(other)), Promise.resolve().then(() => h.tx.setEnabled('a-pack', false))]);
  assert.equal(h.tx.read().packs.length, 2); assert.equal(h.tx.read().packs.find(p => p.id === 'a-pack').enabled, false);
  assert.throws(() => harness(base, 'index').tx.remove('a-pack'), /injected/);
  assert.ok(fs.existsSync(path.join(h.packsRoot, 'a-pack'))); assert.equal(h.tx.read().packs.length, 2);
  h.tx.remove('a-pack'); assert.equal(h.tx.read().packs.length, 1); assert.ok(!fs.existsSync(path.join(h.packsRoot, 'a-pack')));
  assert.ok(!fs.readdirSync(h.root).some(name => /stage|backup|transaction/.test(name)));
  console.log('PASS workshop copy/validate/rename/index failure, process interruption recovery, update, overlap, shared index serialization');
} finally { fs.rmSync(base, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
