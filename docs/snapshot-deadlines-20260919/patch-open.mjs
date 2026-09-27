import fs from 'node:fs';
import { edit } from './patch-utils.mjs';
edit('web/tm-state-snapshot.js',(s,r)=>{
  s=r(s,'  function _legacyTimelineId(campaignId) {',fs.readFileSync('docs/snapshot-deadlines-20260919/deadline-helpers.fragment.txt','utf8')+'\n  function _legacyTimelineId(campaignId) {');
  s=r(s,'    _dbPromise = new Promise(function(resolve, reject) {',`    var owner = { db: null }, pending;
    _openOwner = owner;
    pending = new Promise(function(resolve, reject) {
      var settled = false, upgradeTx = null;
      function rejectOpen(error) {
        if (settled) return; settled = true; clearTimeout(timer);
        if (_openOwner === owner) { _openOwner = null; _dbPromise = null; }
        try { if (upgradeTx) upgradeTx.abort(); } catch (_) {}
        reject(error);
      }
      var timer = setTimeout(function() {
        _snapshotIssue('open', 'SNAPSHOT_TIMEOUT'); rejectOpen(_snapshotError('open', 'SNAPSHOT_TIMEOUT'));
      }, SNAPSHOT_OPEN_MS);`);
  s=r(s,"      if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB 不可用'));\n      var req = indexedDB.open(DB_NAME, DB_VERSION);", "      if (typeof indexedDB === 'undefined') { rejectOpen(new Error('IndexedDB 不可用')); return; }\n      var req;\n      try { req = indexedDB.open(DB_NAME, DB_VERSION); } catch (e) { rejectOpen(e); return; }");
  s=r(s,'      req.onupgradeneeded = function(e) {\n        var db', '      req.onupgradeneeded = function(e) {\n        upgradeTx = e.target.transaction;\n        if (settled || _openOwner !== owner) { try { upgradeTx.abort(); } catch (_) {} return; }\n        var db');
  s=r(s,"            cursorReq.onsuccess = function() {\n              var cursor = cursorReq.result;\n              if (!cursor) return;","            cursorReq.onsuccess = function() {\n              if (settled || _openOwner !== owner) return;\n              var cursor = cursorReq.result;\n              if (!cursor) return;");
  return s;
});
edit('web/tm-state-snapshot.js',(s,r)=>{
  s=r(s,'        db.onversionchange = function() { try { db.close(); } catch (_) {} _dbPromise = null; };\n        resolve(db);',`        if (settled || _openOwner !== owner) { try { db.close(); } catch (_) {} return; }
        settled = true; clearTimeout(timer); owner.db = db;
        db.onversionchange = function() { _closeSnapshotConnection(db); };
        db.onclose = function() { if (_openOwner === owner) { _openOwner = null; _dbPromise = null; } };
        resolve(db);`);
  s=r(s,"      req.onerror = function(e) { _dbPromise = null; reject(e.target.error || new Error('快照数据库打开失败')); };", "      req.onerror = function(e) { rejectOpen(e.target.error || new Error('快照数据库打开失败')); };");
  s=r(s,"      req.onblocked = function() { _dbPromise = null; reject(new Error('快照数据库升级被其他窗口阻塞')); };", "      req.onblocked = function() { _snapshotIssue('open', 'SNAPSHOT_BLOCKED'); rejectOpen(_snapshotError('open', 'SNAPSHOT_BLOCKED')); };");
  s=r(s,'    return _dbPromise;\n  }\n\n  function _captureFullState', `    _dbPromise = pending;
    pending.catch(function() { if (_openOwner === owner) { _openOwner = null; _dbPromise = null; } });
    // A synchronous open error may have already relinquished this owner.
    if (_openOwner !== owner) _dbPromise = null;
    return pending;
  }

  function _captureFullState`);
  return r(s,'    newCampaignId: _newCampaignId','    newCampaignId: _newCampaignId,\n    diagnostics: function() { return { openTimeoutMs: SNAPSHOT_OPEN_MS, operationTimeoutMs: SNAPSHOT_OPERATION_MS, issues: _snapshotIssues.map(function(r) { return Object.assign({}, r); }) }; }');
});
