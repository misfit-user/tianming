'use strict';

// Local-filesystem bakery admission. Owner identity is in the atomically created
// directory name; the ticket is also an atomic directory name, not a partial file.
// A choosing/live owner blocks contenders. A later entrant observes the holder's
// ticket, so it cannot overtake it. Contention returns busy (no synchronous spin).
// Dead owners have unique names: concurrent reapers cannot delete a new owner's
// claim (no fixed recovery sentinel, no unlink/recreate ABA). PID reuse fails closed.
const finished = new Map(); // only operations THIS process has finished; retry failed release
function createWorkshopLock({ fs, path, crypto, root, safe }) {
  const owners = path.join(root, '.lock-owners');
  const lockFile = path.join(root, '.transaction.lock');
  const legacyRecovery = path.join(root, '.lock-recovery');
  function absent(error) { return error && error.code === 'ENOENT'; }
  function dead(pid) {
    try { process.kill(pid, 0); return false; }
    catch (error) { if (error.code === 'ESRCH') return true; throw error; }
  }
  function removeClaim(dir) {
    try { safe(dir); fs.rmSync(dir, { recursive: true }); } catch (error) { if (!absent(error)) throw error; }
  }
  function participants() {
    const rows = [];
    for (const name of fs.readdirSync(owners)) {
      const match = /^owner-([1-9][0-9]*)-([0-9a-f-]{36})$/.exec(name);
      if (!match || !Number.isSafeInteger(Number(match[1]))) throw new Error('workshop-lock-owner-invalid');
      const dir = path.join(owners, name);
      try {
        safe(dir);
        if (!fs.lstatSync(dir).isDirectory()) throw new Error('workshop-lock-owner-invalid');
        if (finished.has(dir) || dead(Number(match[1]))) { removeClaim(dir); continue; }
        const names = fs.readdirSync(dir);
        const tickets = names.filter(n => /^ticket-[1-9][0-9]*$/.test(n));
        if (tickets.length > 1 || names.some(n => n !== 'owner.json' && !tickets.includes(n))) throw new Error('workshop-lock-ticket-invalid');
        const ticket = tickets.length ? Number(tickets[0].slice(7)) : 0;
        if (!Number.isSafeInteger(ticket)) throw new Error('workshop-lock-ticket-invalid');
        rows.push({ name, dir, ticket });
      } catch (error) {
        if (absent(error)) continue;
        // Windows may deny opening a directory while its owner is deleting it.
        // Uninspectable is BUSY, never evidence of death/absence or permission to enter.
        if (['EPERM', 'EACCES', 'EBUSY'].includes(error.code)) {
          throw new Error('workshop-operation-in-progress: owner inspection failed (' + error.code + ')', { cause: error });
        }
        throw error;
      }
    }
    return rows;
  }
  function readFixed() {
    let text;
    try { safe(lockFile); text = fs.readFileSync(lockFile, 'utf8'); } catch (error) { if (absent(error)) return null; throw error; }
    let record;
    try { record = JSON.parse(text); } catch (_) { throw new Error('workshop-lock-unproven'); }
    // A valid legacy PID may be reclaimed only after ESRCH. Unknown/empty legacy
    // evidence and legacy recovery sentinels are retained for explicit inspection.
    if (typeof record === 'number') record = { pid: record, legacy: true };
    if (!record || !Number.isSafeInteger(record.pid) || record.pid < 1
        || (!record.legacy && (record.version !== 2 || !/^[0-9a-f-]{36}$/.test(record.token)))) throw new Error('workshop-lock-unproven');
    return record;
  }
  function acquire() {
    safe(owners); fs.mkdirSync(owners, { recursive: true });
    const token = crypto.randomUUID(), name = 'owner-' + process.pid + '-' + token;
    const dir = path.join(owners, name), record = { version: 2, pid: process.pid, token };
    // Identity exists at the first externally visible operation, even if killed here.
    fs.mkdirSync(dir);
    let published = false, publishing = false;
    function release() {
      finished.set(dir, token);
      const fixed = publishing ? readFixed() : null;
      if (fixed && fixed.token === token) fs.unlinkSync(lockFile);
      else if (published && fixed) throw new Error('workshop-lock-release-owner-mismatch');
      removeClaim(dir);
      finished.delete(dir);
    }
    try {
      const ticket = participants().reduce((n, row) => Math.max(n, row.ticket), 0) + 1;
      if (!Number.isSafeInteger(ticket)) throw new Error('workshop-lock-ticket-overflow');
      fs.mkdirSync(path.join(dir, 'ticket-' + ticket));
      for (const row of participants()) {
        if (row.dir === dir) continue;
        if (!row.ticket || row.ticket < ticket || (row.ticket === ticket && row.name < name)) throw new Error('workshop-operation-in-progress');
      }
      if (fs.existsSync(safe(legacyRecovery))) throw new Error('workshop-lock-recovery-required');
      const previous = readFixed();
      if (previous) {
        const locallyFinished = [...finished.values()].includes(previous.token);
        if (!locallyFinished && !dead(previous.pid)) throw new Error('workshop-operation-in-progress');
        fs.unlinkSync(lockFile);
      }
      for (const [oldDir] of finished) if (path.dirname(oldDir) === owners) finished.delete(oldDir);
      const ownerFile = path.join(dir, 'owner.json');
      const fd = fs.openSync(ownerFile, 'wx');
      try { fs.writeFileSync(fd, JSON.stringify(record)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
      // Atomic no-replace publication of fully written ownership. No empty fixed
      // lock window. Unsupported hardlinks fail closed, never fall back to write-after-open.
      publishing = true;
      fs.linkSync(ownerFile, lockFile);
      published = true;
      return { release };
    } catch (error) {
      try { release(); } catch (cleanup) { error.cleanupError = cleanup.message; }
      throw error;
    }
  }
  return { acquire };
}
module.exports = { createWorkshopLock };
