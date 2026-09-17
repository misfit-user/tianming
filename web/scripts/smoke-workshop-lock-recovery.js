'use strict';
const assert = require('assert/strict'), fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto'), cp = require('child_process');
const { createWorkshopTransactions } = require('../../main-workshop-transaction');
function harness(base, fault) {
  const root = path.join(base, 'workshop'), packsRoot = path.join(root, 'packs'), indexFile = path.join(root, 'index.json');
  const io = Object.create(fs);
  if (fault === 'inspection-denied') {
    io.existsSync = file => file === root ? false : fs.existsSync(file);
    io.lstatSync = file => { if (file === root) { const e = new Error('controlled path inspection denied'); e.code = 'EACCES'; throw e; } return fs.lstatSync(file); };
  }
  if (fault === 'broken-link') {
    io.existsSync = file => file === root ? false : fs.existsSync(file);
    io.lstatSync = file => file === root ? { isSymbolicLink: () => true } : fs.lstatSync(file);
  }
  let critical = false;
  io.readFileSync = (file, ...rest) => {
    if (fault === 'stress' && file === indexFile && !critical) {
      // Independent exclusive marker detects overlapping REAL transaction bodies.
      const fd = fs.openSync(path.join(base, 'critical-section'), 'wx'); fs.closeSync(fd); critical = true;
    }
    return fs.readFileSync(file, ...rest);
  };
  const interrupt = point => { console.log('INTERRUPTED ' + point); process.exit(86); };
  io.mkdirSync = (file, ...rest) => {
    const result = fs.mkdirSync(file, ...rest);
    if (fault === 'owner' && /^owner-/.test(path.basename(file))) interrupt('owner-identity-published');
    if (fault === 'ticket' && /^ticket-/.test(path.basename(file))) interrupt('ticket-published');
    return result;
  };
  io.openSync = (file, ...rest) => {
    const fd = fs.openSync(file, ...rest);
    if (fault === 'private-owner' && path.basename(file) === 'owner.json') interrupt('private-owner-before-write');
    return fd;
  };
  io.linkSync = (...args) => {
    if (fault === 'publish') throw new Error('injected-publication-failure');
    const result = fs.linkSync(...args);
    if (fault === 'published') interrupt('complete-fixed-owner-published');
    return result;
  };
  io.unlinkSync = (file, ...rest) => {
    if (fault === 'release' && path.basename(file) === '.transaction.lock') throw new Error('injected-release-failure');
    if (critical && path.basename(file) === '.transaction.lock') { fs.unlinkSync(path.join(base, 'critical-section')); critical = false; }
    return fs.unlinkSync(file, ...rest);
  };
  io.rmSync = (file, ...rest) => {
    if (fault === 'release-claim' && path.basename(file).startsWith('owner-' + process.pid + '-')) throw new Error('injected-claim-release-failure');
    if (fault === 'recovery' && /^owner-/.test(path.basename(file)) && !path.basename(file).startsWith('owner-' + process.pid + '-')) {
      const result = fs.rmSync(file, ...rest); interrupt('reclaimer-during-dead-owner-removal'); return result;
    }
    return fs.rmSync(file, ...rest);
  };
  const atomic = (file, value) => {
    const tmp = file + '.' + crypto.randomUUID(); fs.writeFileSync(tmp, JSON.stringify(value)); fs.renameSync(tmp, file);
    if (fault === 'journal' && path.basename(file) === '.transaction.json') interrupt('journal-published');
  };
  const validate = dir => {
    if (fault === 'hold') {
      if (process.send) process.send({ held: true });
      // Deterministic admission barrier: the parent explicitly releases this owner.
      while (!fs.existsSync(path.join(base, 'release'))) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
    }
    return JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  };
  const ioStats = {};
  if (fault === 'stress') for (const name of ['existsSync', 'lstatSync', 'readdirSync', 'mkdirSync', 'readFileSync', 'openSync', 'fsyncSync', 'linkSync', 'unlinkSync', 'rmSync']) {
    const fn = io[name];
    io[name] = (...args) => {
      const start = performance.now(), row = ioStats[name] || (ioStats[name] = { count: 0, ms: 0 }); row.count++;
      try { return fn(...args); } finally { row.ms += performance.now() - start; }
    };
  }
  return { root, packsRoot, indexFile, ioStats, tx: createWorkshopTransactions({ fs: io, path, crypto, root, packsRoot, indexFile,
    writeJsonAtomic: atomic, validate, normalizeId: id => /^[a-z-]+$/.test(id) ? id : 'invalid', publicInfo: (p, target) => ({ ...p, path: target, enabled: true }) }) };
}
if (process.argv[2] === '--child') {
  const [, , , base, fault] = process.argv;
  const h = harness(base, fault);
  if (fault === 'stress') {
    const stats = { attempts: 0, commits: 0, busy: 0, io: h.ioStats };
    const deadline = Date.now() + 20000;
    try {
      for (let i = 0; i < 25; i++) {
        if (Date.now() > deadline) throw new Error('stress admission deadline exceeded');
        stats.attempts++;
        try { h.tx.setEnabled('old-pack', i % 2 === 0); stats.commits++; }
        catch (e) { if (!/in-progress/.test(e.message)) throw e; stats.busy++; i--; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2); }
      }
    } finally { console.error('STRESS_DIAGNOSTIC ' + JSON.stringify(stats)); }
  } else if (fault === 'hold' || fault === 'journal') h.tx.install(path.join(base, 'incoming'), { overwrite: true });
  else h.tx.read();
  process.exit(0);
}
function spawn(base, fault) {
  const child = cp.spawn(process.execPath, [__filename, '--child', base, fault], { stdio: ['ignore', 'pipe', 'pipe', 'ipc'], windowsHide: true });
  child.errors = ''; child.stderr.on('data', data => { child.errors += data; });
  child.done = new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', code => resolve(code)); });
  return child;
}
function crashed(base, fault) {
  const child = cp.spawnSync(process.execPath, [__filename, '--child', base, fault], { encoding: 'utf8', windowsHide: true, timeout: 15000 });
  assert.equal(child.status, 86, child.stderr); assert.match(child.stdout, /INTERRUPTED/);
  console.log(child.stdout.trim());
}
(async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-workshop-lock-'));
  let count = 0;
  const pass = name => { count++; console.log('PASS ' + name); };
  try {
    const incoming = path.join(base, 'incoming'); fs.mkdirSync(incoming);
    fs.writeFileSync(path.join(incoming, 'manifest.json'), JSON.stringify({ id: 'old-pack', version: 'old' }));
    fs.writeFileSync(path.join(incoming, 'content.txt'), 'old-content');
    const h = harness(base); assert.equal(h.tx.install(incoming).success, true);
    const indexBytes = fs.readFileSync(h.indexFile), pack = path.join(h.packsRoot, 'old-pack', 'content.txt');
    function intact() { assert.deepEqual(fs.readFileSync(h.indexFile), indexBytes); assert.equal(fs.readFileSync(pack, 'utf8'), 'old-content'); }
    assert.throws(() => harness(base, 'inspection-denied').tx.read(), error => error.code === 'EACCES'); intact();
    assert.throws(() => harness(base, 'broken-link').tx.read(), /symlink-rejected/); intact();
    pass('one-shot ancestor inspection rejects denial and broken links without modifying package/index');
    for (const fault of ['owner', 'ticket', 'private-owner', 'published']) {
      crashed(base, fault); intact();
      assert.ok(fs.readdirSync(path.join(h.root, '.lock-owners')).length > 0, 'interrupted owner evidence exists');
      for (let retry = 0; retry < 2; retry++) { assert.equal(harness(base).tx.read().packs[0].id, 'old-pack'); intact(); }
      pass(fault + ' crash restarts twice without changing package/index');
    }
    crashed(base, 'published'); crashed(base, 'recovery');
    assert.ok(fs.readdirSync(path.join(h.root, '.lock-owners')).length > 0, 'reclaimer owner survives its exit');
    assert.equal(harness(base).tx.recover().success, true); intact();
    assert.equal(harness(base).tx.recover().success, true); intact();
    pass('reclaimer death is itself recoverable, without fixed recovery sentinel');
    crashed(base, 'journal');
    const journalBytes = fs.readFileSync(path.join(h.root, '.transaction.json'));
    // Lock admission failure cannot touch pending transaction recovery materials.
    fs.writeFileSync(path.join(h.root, '.lock-recovery'), '');
    assert.throws(() => h.tx.recover(), /recovery-required/);
    assert.deepEqual(fs.readFileSync(path.join(h.root, '.transaction.json')), journalBytes); intact();
    fs.unlinkSync(path.join(h.root, '.lock-recovery')); // explicit removal of our synthetic unknown legacy evidence
    h.tx.recover(); intact(); pass('unproven legacy recovery marker preserves journal and original data');
    fs.writeFileSync(path.join(h.root, '.transaction.lock'), '');
    assert.throws(() => h.tx.read(), /unproven/); assert.equal(fs.readFileSync(path.join(h.root, '.transaction.lock'), 'utf8'), ''); intact();
    fs.unlinkSync(path.join(h.root, '.transaction.lock')); h.tx.recover();
    pass('unknown legacy empty lock is never stolen or deleted');
    const dead = cp.spawnSync(process.execPath, ['-e', 'console.log(process.pid)'], { encoding: 'utf8', windowsHide: true });
    assert.equal(dead.status, 0); fs.writeFileSync(path.join(h.root, '.transaction.lock'), dead.stdout.trim());
    h.tx.recover(); intact(); pass('proven dead legacy PID migration');
    assert.throws(() => harness(base, 'publish').tx.install(incoming, { overwrite: true }), /publication/); intact();
    h.tx.recover(); pass('publication failure leaves package/index unchanged and can retry');
    for (const fault of ['release', 'release-claim']) {
      const result = harness(base, fault).tx.setEnabled('old-pack', false);
      assert.equal(result.success, true); assert.match(result.warning, /锁文件清理失败/);
      assert.equal(JSON.parse(fs.readFileSync(h.indexFile)).packs[0].enabled, false);
      assert.equal(harness(base).tx.read().packs[0].enabled, false);
      pass(fault + ' after commit is warning, same-process retry cleans ownership');
    }
    const holder = spawn(base, 'hold');
    try {
      await new Promise((resolve, reject) => { holder.once('message', resolve); holder.once('exit', code => reject(new Error('holder exited ' + code))); });
      const fixed = fs.readFileSync(path.join(h.root, '.transaction.lock'));
      for (let i = 0; i < 3; i++) assert.throws(() => harness(base).tx.setEnabled('old-pack', false), /in-progress/);
      assert.deepEqual(fs.readFileSync(path.join(h.root, '.transaction.lock')), fixed);
      pass('live owner cannot be stolen by multiple contenders');
    } finally { fs.writeFileSync(path.join(base, 'release'), 'go'); assert.equal(await holder.done, 0); }
    const workers = Array.from({ length: 4 }, () => spawn(base, 'stress'));
    const exits = await Promise.all(workers.map(worker => worker.done));
    workers.forEach(worker => { for (const line of worker.errors.split(/\r?\n/).filter(s => s.startsWith('STRESS_DIAGNOSTIC '))) console.log(line); });
    exits.forEach((code, i) => assert.equal(code, 0, workers[i].errors));
    assert.equal(h.tx.read().packs.length, 1); assert.equal(fs.readFileSync(pack, 'utf8'), 'old-content');
    assert.equal(fs.readdirSync(path.join(h.root, '.lock-owners')).length, 0);
    assert.equal(fs.existsSync(path.join(h.root, '.transaction.lock')), false);
    pass('four real processes serialize 100 shared-index commits and release all claims');
    console.log('SUMMARY ' + JSON.stringify({ pass: count, fail: 0, skip: 0, waived: 0 }));
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
