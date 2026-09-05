'use strict';

// All directory and shared-index mutations are synchronous under one process/file lock.
// The index transaction ID is the commit point; the durable journal resolves interrupted renames.
function createWorkshopTransactions(d) {
  const { fs, path, crypto, root, packsRoot, indexFile, writeJsonAtomic, validate, publicInfo, normalizeId } = d;
  const journalFile = path.join(root, '.transaction.json');
  const lockFile = path.join(root, '.transaction.lock');
  let active = false;
  function safe(target) {
    const full = path.resolve(target);
    for (let cursor = full; ; cursor = path.dirname(cursor)) {
      if (fs.existsSync(cursor) && fs.lstatSync(cursor).isSymbolicLink()) throw new Error('workshop-symlink-rejected');
      if (cursor === path.dirname(cursor)) break;
    }
    return full;
  }
  function index() {
    const value = fs.existsSync(indexFile) ? JSON.parse(fs.readFileSync(indexFile, 'utf8')) : { packs: [] };
    if (!value || !Array.isArray(value.packs)) throw new Error('workshop-index-invalid');
    return value;
  }
  function paths(j) {
    if (!j || !/^[0-9a-f-]{36}$/.test(j.tx) || !j.id || path.basename(j.id) !== j.id || /^[.]+$/.test(j.id) || /[\\/\x00-\x1f]/.test(j.id)
        || normalizeId(j.id) !== j.id || !['install', 'remove', 'enable'].includes(j.op)) throw new Error('workshop-journal-invalid');
    return { target: safe(path.join(packsRoot, j.id)), stage: safe(path.join(root, '.stage-' + j.tx)), backup: safe(path.join(root, '.backup-' + j.tx)) };
  }
  function rm(dir) { if (fs.existsSync(dir)) fs.rmSync(safe(dir), { recursive: true }); }
  function recoverLocked() {
    if (!fs.existsSync(journalFile)) return;
    const j = JSON.parse(fs.readFileSync(journalFile, 'utf8'));
    const p = paths(j);
    const committed = index()._transactionId === j.tx;
    if (!committed) {
      if (fs.existsSync(p.backup)) { rm(p.target); fs.renameSync(p.backup, p.target); }
      else if (!j.hadTarget && j.op === 'install') rm(p.target);
      // Index write is atomic: before commit it is still the original bytes. Do not rewrite it.
    }
    rm(p.stage); rm(p.backup);
    fs.unlinkSync(journalFile);
  }
  function exclusive(fn) {
    if (active) throw new Error('workshop-operation-in-progress');
    safe(root); safe(packsRoot); safe(lockFile); safe(journalFile); safe(indexFile);
    fs.mkdirSync(root, { recursive: true });
    let fd;
    try { fd = fs.openSync(lockFile, 'wx'); }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      // Serialize stale-lock reclamation too. A second process must not unlink a newly acquired lock.
      const recovery = safe(path.join(root, '.lock-recovery'));
      let guard;
      try { guard = fs.openSync(recovery, 'wx'); } catch (_) { throw new Error('workshop-lock-recovery-required'); }
      try {
        if (fs.existsSync(lockFile)) {
          const pid = Number(fs.readFileSync(lockFile, 'utf8'));
          if (!Number.isSafeInteger(pid) || pid < 1) throw new Error('workshop-lock-unproven');
          try { process.kill(pid, 0); throw new Error('workshop-operation-in-progress'); }
          catch (probe) { if (probe.code !== 'ESRCH') throw probe; }
          fs.unlinkSync(lockFile);
        }
        fd = fs.openSync(lockFile, 'wx');
      } finally { fs.closeSync(guard); fs.unlinkSync(recovery); }
    }
    active = true;
    let result, failure, cleanupError;
    try { fs.writeFileSync(fd, String(process.pid)); fs.fsyncSync(fd); recoverLocked(); result = fn(); }
    catch (error) { failure = error; }
    finally {
      active = false;
      try { fs.closeSync(fd); fs.unlinkSync(lockFile); } catch (error) { cleanupError = error; }
    }
    if (failure) { if (cleanupError) failure.cleanupError = cleanupError.message; throw failure; }
    if (cleanupError) result.warning = [result.warning, '工坊操作已完成，锁文件清理失败：' + cleanupError.message].filter(Boolean).join('; ');
    return result;
  }
  function copy(source, target) {
    safe(source); const stat = fs.lstatSync(source);
    if (stat.isDirectory()) {
      fs.mkdirSync(target, { recursive: true });
      for (const name of fs.readdirSync(source)) copy(path.join(source, name), path.join(target, name));
    } else {
      if (!stat.isFile()) throw new Error('workshop-file-type-invalid');
      fs.copyFileSync(source, target);
      const fd = fs.openSync(target, 'r+'); try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    }
  }
  function change(op, id, options = {}) {
    return exclusive(() => {
      let pack;
      if (op === 'install') {
        const source = safe(options.sourceDir);
        const managed = path.resolve(root);
        const within = (parent, child) => { const rel = path.relative(parent, child); return rel === '' || (!rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel)); };
        if (within(managed, source) || within(source, managed)) throw new Error('workshop-source-target-overlap');
        pack = validate(source); id = pack.id;
      }
      if (!id || normalizeId(id) !== id) throw new Error('workshop-id-invalid');
      const j = { tx: crypto.randomUUID(), id, op, hadTarget: fs.existsSync(path.join(packsRoot, id)) };
      const p = paths(j); const next = index();
      const old = next.packs.find(item => item.id === id);
      if (op === 'install' && j.hadTarget && !options.overwrite) return { success: false, exists: true, error: '已存在同 ID 工坊包：' + id };
      if (op === 'enable' && (!old || !j.hadTarget)) throw new Error('workshop-pack-not-found');
      writeJsonAtomic(journalFile, j);
      let committed = false;
      try {
        if (op === 'install') {
          copy(options.sourceDir, p.stage);
          pack = validate(p.stage);
          if (pack.id !== id) throw new Error('workshop-staged-id-mismatch');
          next.packs = next.packs.filter(item => item.id !== id);
          next.packs.push(Object.assign(publicInfo(pack, p.target, true), { installedAt: new Date().toISOString(), source: options.source || '' }));
        } else if (op === 'remove') next.packs = next.packs.filter(item => item.id !== id);
        else old.enabled = !!options.enabled;
        if (op !== 'enable') {
          fs.mkdirSync(packsRoot, { recursive: true });
          if (j.hadTarget) fs.renameSync(p.target, p.backup);
          if (op === 'install') fs.renameSync(p.stage, p.target);
        }
        next._transactionId = j.tx; next.updatedAt = new Date().toISOString();
        writeJsonAtomic(indexFile, next);
        committed = true;
      } catch (error) {
        // Even a fault injected after rename must respect the persisted commit point.
        committed = index()._transactionId === j.tx;
        if (!committed) {
          try { recoverLocked(); } catch (recovery) { error.recoveryError = recovery.message; }
          throw error;
        }
      }
      let warning;
      try { recoverLocked(); } catch (error) { warning = '工坊已提交，备份清理待重试：' + error.message; }
      return { success: committed, pack: next.packs.find(item => item.id === id), warning };
    });
  }
  return { install: (sourceDir, options) => change('install', '', Object.assign({}, options, { sourceDir })),
    setEnabled: (id, enabled) => change('enable', id, { enabled }), remove: id => change('remove', id),
    read: () => exclusive(index), recover: () => exclusive(() => ({ success: true })) };
}
module.exports = { createWorkshopTransactions };
