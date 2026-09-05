'use strict';
const assert = require('assert'), fs = require('fs'), path = require('path');
const h = require('./lib-audit-main')();
(async () => {
  const saveDir = h.T.paths.SAVE_DIR; fs.mkdirSync(saveDir, { recursive: true });
  const payload = { gameState: { GM: { turn: 8, chars: [] }, P: {} } };
  fs.writeFileSync(path.join(saveDir, '旧中文档.json'), JSON.stringify(payload));
  for (const name of ['甲?乙', '甲*乙', '含 空格中文']) assert.equal((await h.invoke('save-project', { filename: name, data: payload })).success, true);
  const listed = await h.invoke('list-saves'); assert.equal(listed.success, true); assert.equal(listed.files.length, 4);
  for (const file of listed.files) assert.equal((await h.invoke('load-project', file)).success, true, file.name);
  assert.equal((await h.invoke('load-project', { name: '旧中文档' })).success, true);
  // Reading legacy data must not depend on metadata writes.
  const originalWrite = h.io.writeFileSync; h.io.writeFileSync = () => { throw new Error('read-only'); };
  assert.equal((await h.invoke('load-project', { storageKey: '旧中文档' })).success, true); delete h.io.writeFileSync;
  for (const ref of [{ storageKey: '../escape' }, { storageKey: '..\\escape' }, { name: '../x' }, { storageKey: 'x\u0000' }, {}]) assert.equal((await h.invoke('load-project', ref)).success, false);
  const k1 = h.T.stableStorageKey('甲?乙'), k2 = h.T.stableStorageKey('甲*乙'); assert.notEqual(k1, k2);
  assert.equal((await h.invoke('delete-save', { storageKey: k1 })).success, true);
  assert(fs.existsSync(path.join(saveDir, k2 + '.json')));
  assert.equal((await h.invoke('delete-save', listed.files.find(x => x.storageKey === '旧中文档'))).success, true);
  assert(!fs.existsSync(path.join(saveDir, '旧中文档.json')));
  const target = path.join(h.dir, 'export.json'), old = Buffer.from('{"old":"precious"}');
  h.dialog.showSaveDialog = async () => ({ canceled: false, filePath: target });
  assert.equal((await h.invoke('dialog-export', { fresh: 1 })).success, true);
  for (const fault of ['openSync', 'writeFileSync', 'fsyncSync', 'renameSync']) {
    fs.writeFileSync(target, old);
    h.io[fault] = function(...args) { if (fault === 'writeFileSync') fs.writeSync(args[0], Buffer.from('partial')); throw new Error('injected-' + fault); };
    assert.equal((await h.invoke('dialog-export', { new: true })).success, false);
    delete h.io[fault]; assert(fs.readFileSync(target).equals(old), fault);
    assert(!fs.readdirSync(h.dir).some(n => n.includes('.tmp-')));
  }
  h.dialog.showSaveDialog = async () => ({ canceled: true, filePath: target });
  assert.equal((await h.invoke('dialog-export', { ignored: true })).canceled, true); assert(fs.readFileSync(target).equals(old));
  h.dialog.showSaveDialog = async () => ({ canceled: false, filePath: target });
  assert.equal((await h.invoke('dialog-export', { replacement: true })).success, true);
  assert.deepEqual(JSON.parse(fs.readFileSync(target)), { replacement: true });
  console.log('PASS actual save/list/load/delete IPC legacy roundtrip, collisions and atomic export failures');
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => h.cleanup());
