// Bounded local response checkpoints. No prompts, API credentials or world mutations are stored.
(function(root) {
  'use strict';
  var TM = root.TM = root.TM || {}; TM.Endturn = TM.Endturn || {};
  if (TM.Endturn.RecoveryVault) return;
  var DB = 'tianming-response-recovery-v1', STORE = 'checkpoint', LIMIT = 8000000;
  var epoch = 0, last = { state: 'idle' }, WAIT = 3000;
  function enabled() { try { return root.localStorage.getItem('tm_response_recovery_persist') !== 'off'; } catch (_) { return true; } }
  function timeout() { var e = new Error('本地恢复候选存储未及时回应'); e.code = 'RECOVERY_STORE_TIMEOUT'; return e; }
  function open() {
    return new Promise(function(resolve, reject) {
      if (!root.indexedDB) { reject(new Error('恢复存储不可用')); return; }
      var done = false, request, timer = setTimeout(function() { if (!done) { done = true; reject(timeout()); } }, WAIT);
      function fail(e) { if (done) return; done = true; clearTimeout(timer); reject(e); }
      try {
        request = root.indexedDB.open(DB, 1);
        request.onupgradeneeded = function() { if (done) { try { request.transaction.abort(); } catch (_) {} return; } if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE); };
        request.onsuccess = function() { if (done) { request.result.close(); return; } done = true; clearTimeout(timer); resolve(request.result); };
        request.onerror = function() { fail(request.error || new Error('恢复存储打开失败')); };
        request.onblocked = function() { fail(new Error('恢复存储被阻塞')); };
      } catch (e) { fail(e); }
    });
  }
  async function transact(mode, action) {
    var connection = await open();
    return new Promise(function(resolve, reject) {
      var tx, value, done = false, timer;
      function end(e) { if (done) return; done = true; clearTimeout(timer); connection.close(); if (e) reject(e); else resolve(value); }
      timer = setTimeout(function() { if (done) return; try { if (tx) tx.abort(); } catch (_) {} end(timeout()); }, WAIT);
      try {
        tx = connection.transaction(STORE, mode);
        tx.oncomplete = function() { end(null); };
        tx.onabort = function() { end(tx.error || new Error('恢复存储事务已中止')); };
        tx.onerror = function() { /* onabort is the transaction outcome. */ };
        action(tx.objectStore(STORE), function(v) { value = v; });
      } catch (e) { try { if (tx) tx.abort(); } catch (_) {} end(e); }
    });
  }
  function valid(row) {
    if (!row || row.version !== 1 || !/^[a-f0-9]{64}$/.test(row.fingerprint || '') || (typeof row.world !== 'string' || row.world.length > 400)) return false;
    var age = Date.now() - Number(row.at);
    if (!Number.isFinite(age) || age < 0 || age > 30 * 60000 || !Array.isArray(row.records) || row.records.length > 64) return false;
    var size = 0, seen = new Set();
    return row.records.every(function(pair) {
      if (!Array.isArray(pair) || pair.length !== 2 || typeof pair[0] !== 'string' || !/^(json|tools|stream):[a-f0-9]{64}:\d+$/.test(pair[0]) || seen.has(pair[0]) || typeof pair[1] !== 'string' || pair[1].length > 1000000) return false;
      seen.add(pair[0]); size += pair[1].length; return size <= LIMIT;
    });
  }
  async function read(fingerprint, world) {
    if (!enabled()) return null;
    try {
      var row = await transact('readonly', function(s, set) { var r = s.get('latest'); r.onsuccess = function() { set(r.result || null); }; });
      if (!valid(row) || row.fingerprint !== fingerprint || row.world !== world) return null;
      last = { state: 'available', entries: row.records.length, at: row.at }; return row;
    } catch (_) { last = { state: 'unavailable' }; return null; }
  }
  async function write(row) {
    if (!enabled() || !valid(row)) return false;
    var mine = ++epoch, snapshot = JSON.parse(JSON.stringify(row));
    try {
      snapshot.checksum = await checksum(snapshot);
      if (mine !== epoch || !enabled()) return false;
      await transact('readwrite', function(s) { if (mine !== epoch || !enabled()) return; s.put(snapshot, 'latest'); });
      if (mine !== epoch || !enabled()) return false;
      last = { state: 'stored', entries: snapshot.records.length, at: snapshot.at }; return true;
    } catch (_) { last = { state: 'unavailable' }; return false; }
  }
  async function checksum(row) {
    if (!(root.crypto && root.crypto.subtle && root.TextEncoder)) throw new Error('恢复候选校验不可用');
    var text = JSON.stringify([row.version, row.fingerprint, row.world, row.at, row.records]), timer;
    try {
      var bytes = await Promise.race([root.crypto.subtle.digest('SHA-256', new root.TextEncoder().encode(text)), new Promise(function(_, reject) { timer = setTimeout(function() { reject(timeout()); }, WAIT); })]);
      return Array.from(new Uint8Array(bytes), function(b) { return b.toString(16).padStart(2, '0'); }).join('');
    } finally { clearTimeout(timer); }
  }
  async function clear(fingerprint) {
    epoch++;
    try { await transact('readwrite', function(s) { var request = s.get('latest'); request.onsuccess = function() { if (!fingerprint || request.result && request.result.fingerprint === fingerprint) s.delete('latest'); }; }); last = { state: 'cleared' }; return true; }
    catch (_) { last = { state: 'unavailable' }; return false; }
  }
  function setEnabled(value) { try { root.localStorage.setItem('tm_response_recovery_persist', value ? 'on' : 'off'); } catch (_) { return false; } if (!value) clear(); return true; }
  TM.Endturn.RecoveryVault = { load: async function(f, w) { var mine = epoch, row = await read(f, w); if (!row || mine !== epoch || !enabled()) return null; try { var matches = row.checksum === await checksum(row); return matches && mine === epoch && enabled() ? row : null; } catch (_) { return null; } },
    save: write, clear: clear, enabled: enabled, setEnabled: setEnabled, status: function() { return Object.assign({ enabled: enabled() }, last); } };
})(typeof window !== 'undefined' ? window : globalThis);
