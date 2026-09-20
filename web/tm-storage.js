// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// IndexedDB 存储层 — 替代 localStorage 的 5MB 限制
// 分层 store：大型存档、轻量元数据、剧本项目、年度编年与回合分卷 receipt
// 带 localStorage 回退
// ============================================================

// 7.1: 存档压缩——使用CompressionStream(gzip)
var SaveCompression = {
  supported: typeof CompressionStream !== 'undefined',
  decompressionSupported: typeof DecompressionStream !== 'undefined',

  awaitResult: function(promise, stage, cancel) {
    var timer, settled = false;
    return new Promise(function(resolve, reject) {
      timer = setTimeout(function() {
        if (settled) return; settled = true;
        var error = new Error('存档' + ({compress:'压缩',decompress:'解压',checksum:'校验'}[stage] || '处理') + '超时，未把不完整数据当成成功');
        error.code = stage === 'compress' ? 'SAVE_COMPRESS_TIMEOUT' : stage === 'checksum' ? 'SAVE_CHECKSUM_TIMEOUT' : 'SAVE_DECOMPRESS_TIMEOUT';
        try { if (cancel) cancel(error); } catch (_) {}
        reject(error);
      }, 60000);
      Promise.resolve(promise).then(function(value) {
        if (settled) return; settled = true; clearTimeout(timer); resolve(value);
      }, function(error) {
        if (settled) return; settled = true; clearTimeout(timer); reject(error);
      });
    });
  },
  transform: function(source, transformer, stage, text) {
    var controller = new AbortController(), reader;
    var output = (async function() {
      reader = source.pipeThrough(transformer, { signal: controller.signal }).getReader();
      var chunks = [];
      try { while (true) { if (controller.signal.aborted) throw controller.signal.reason; var part = await reader.read(); if (controller.signal.aborted) throw controller.signal.reason; if (part.done) break; chunks.push(part.value); } }
      finally { try { reader.releaseLock(); } catch (_) {} }
      var blob = new Blob(chunks); return text ? await blob.text() : blob;
    })();
    return this.awaitResult(output, stage, function(error) {
      controller.abort(error);
      if (reader) { try { var cancellation = reader.cancel(error); if (cancellation && cancellation.catch) cancellation.catch(function() {}); } catch (_) {} }
    });
  },

  compress: async function(jsonStr) {
    if (!this.supported) return jsonStr;
    try {
      var blob = new Blob([jsonStr]);
      var cs = new CompressionStream('gzip');
      var compressed = await this.transform(blob.stream(), cs, 'compress', false);
      return compressed;
    } catch(e) { console.warn('[SaveCompression] compress failed:', e); return jsonStr; }
  },

  decompress: async function(data) {
    if (data == null) throw new Error('存档数据为空');
    if (typeof data === 'string') return data; // 未压缩的旧存档（字符串）
    // Blob·ArrayBuffer·Uint8Array 等
    // 检查是否是 gzip 压缩（前两字节 0x1f 0x8b）
    var blob = data instanceof Blob ? data : new Blob([data]);
    var headBuf = await this.awaitResult(blob.slice(0, 2).arrayBuffer(), 'decompress');
    var head = new Uint8Array(headBuf);
    var isGzip = head.length >= 2 && head[0] === 0x1f && head[1] === 0x8b;
    if (isGzip) {
      if (!this.decompressionSupported) {
        throw new Error('当前浏览器不支持 gzip 解压，无法读取该压缩存档');
      }
      var ds = new DecompressionStream('gzip');
      return await this.transform(blob.stream(), ds, 'decompress', true);
    }
    // 非 gzip 的 Blob/ArrayBuffer 是 UTF-8 文本旧档。严禁 String(ArrayBuffer)
    // 产生 "[object ArrayBuffer]" 后再被当成有效内容。
    if (typeof blob.text === 'function') return await this.awaitResult(blob.text(), 'decompress');
    var bytes = new Uint8Array(await this.awaitResult(blob.arrayBuffer(), 'decompress'));
    if (typeof TextDecoder === 'undefined') throw new Error('当前环境缺少 UTF-8 解码器');
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  }
};

var TM_SaveDB = (function() {
  'use strict';

  var DB_NAME = 'tianming_db'; // 统一数据库名
  var DB_VERSION = 6; // v6: 将 v4/v5 的无 timeline 辅助记录原子迁入确定性 legacy 时间线
  var SAVE_STORE = 'saves';
  var SAVE_META_STORE = 'saveMetadata';
  var PROJECT_STORE = 'projects';
  var CHRONICLE_RECORD_STORE = 'chronicleRecords';
  var TURN_PUBLISH_RECEIPT_STORE = 'turnPublishReceipts';
  var _db = null;
  var _available = false;
  var _openPromise = null; // 防止重复打开
  var _migrationTail = Promise.resolve(); // 两类旧源必须串行探测/占用目标 ID
  var LOCAL_SAVE_BATCH_JOURNAL = 'tm_save_batch_journal_v1';
  var PROTECTED_SAVE_IDS = Object.freeze({
    autosave: true,
    slot_0: true,
    pre_endturn: true
  });

  function _perfCount(name, delta) {
    if (typeof TM !== 'undefined' && TM.perf && typeof TM.perf.count === 'function') TM.perf.count(name, delta);
  }

  function _perfWithSpan(name, fn, metadata) {
    if (typeof TM !== 'undefined' && TM.perf && typeof TM.perf.withSpan === 'function') {
      return TM.perf.withSpan(name, fn, metadata);
    }
    return fn();
  }

  // Opening and readonly operations retain their own independent deadlines.
  var OPEN_WAIT_MS = 15000, READ_WAIT_MS = 30000;
  var _openOwner = null, _readDiagnostics = [];
  function _storageWaitError(code, stage) {
    var error = new Error(stage === 'open' ? '主存档数据库打开超时；未把等待失败当成空存档' : '主存档数据库读取超时；未继续依赖该结果的写入');
    error.name = 'TimeoutError'; error.code = code; error.stage = stage;
    return error;
  }
  function _storageDiagnostic(stage, error, abortState) {
    _readDiagnostics.push({ stage: stage, code: String(error && (error.code || error.name) || 'Error').slice(0, 80), abortState: abortState || 'not-needed', at: Date.now() });
    if (_readDiagnostics.length > 12) _readDiagnostics.shift();
  }
  function _abortRead(tx) {
    if (!tx) return 'not-started';
    try { tx.abort(); return 'requested'; } catch (_) { return 'unconfirmed'; }
  }
  function _boundedStorageRead(storeName, stage, select, emptyValue) {
    var connection = _db;
    return new Promise(function(resolve, reject) {
      var tx, timer, settled = false;
      function end(error, value) {
        if (settled) return;
        settled = true; clearTimeout(timer);
        if (error) { _storageDiagnostic(stage, error); reject(error); } else resolve(value);
      }
      timer = setTimeout(function() {
        if (settled) return;
        settled = true; clearTimeout(timer);
        var error = _storageWaitError('SAVE_READ_TIMEOUT', stage);
        _storageDiagnostic(stage, error, _abortRead(tx)); reject(error);
      }, READ_WAIT_MS);
      try {
        tx = connection.transaction(storeName, 'readonly');
        tx.onabort = function(e) { end(e && e.target && e.target.error || tx.error || new Error('主存档只读事务已中止')); };
        tx.onerror = function(e) { end(e && e.target && e.target.error || tx.error || new Error('主存档只读事务失败')); };
        var request = select(tx.objectStore(storeName));
        request.onsuccess = function() { end(null, request.result == null ? emptyValue : request.result); };
        request.onerror = function(e) { end(e && e.target && e.target.error || request.error || new Error('主存档读取失败')); };
      } catch (error) { end(error); _abortRead(tx); }
    });
  }

  var WRITE_WAIT_MS = 60000, WRITE_ABORT_WAIT_MS = 5000;
  var _writeSafety = null, _writeSequence = 0, _uncertainWrites = new Map(), _writeOutcomeListeners = new Map();
  function _publishWriteOutcome(record, outcome) {
    if (record.outcome !== "unconfirmed") return;
    record.outcome = outcome;
    var listeners = _writeOutcomeListeners.get(record.id) || [];
    _writeOutcomeListeners.delete(record.id);
    listeners.forEach(function(fn) { Promise.resolve().then(function() { fn(Object.assign({}, record)); }).catch(function() {}); });
  }
  function _unconfirmedWriteError(stage) {
    var error = new Error('主存档写入结果尚未确认；已暂停本页继续写入，不能直接重试覆盖。请重新打开游戏并核对恢复点。');
    error.code = 'SAVE_WRITE_UNCONFIRMED'; error.storageOutcome = 'unconfirmed'; error.stage = stage;
    if (_writeSafety) error.storageOperationId = _writeSafety.id;
    return error;
  }
  function _assertStorageWritable() {
    if (_writeSafety) throw _unconfirmedWriteError(_writeSafety.stage);
  }
  function _runStorageWrite(stores, stage, writer) {
    var connection = _db;
    return new Promise(function(resolve, reject) {
      var tx, timer, abortTimer, settled = false, cause = null, abortRequested = false;
      var outcomeRecord = { id: "write-" + (++_writeSequence), stage: stage, outcome: "pending", at: Date.now() };
      function clear() { clearTimeout(timer); clearTimeout(abortTimer); }
      function end(error) {
        if (settled) return;
        settled = true; clear();
        if (error) { try { _storageDiagnostic(stage, error, 'confirmed'); } catch (_) {} reject(error); }
        else resolve(true);
      }
      function unknown() {
        if (settled) return;
        settled = true; clear();
        outcomeRecord.outcome = 'unconfirmed';
        _uncertainWrites.set(outcomeRecord.id, outcomeRecord);
        _writeSafety = outcomeRecord;
        var error = _unconfirmedWriteError(stage);
        try { _storageDiagnostic(stage, error, 'unconfirmed'); } catch (_) {}
        reject(error);
      }
      function abort(error) {
        if (settled || abortRequested) return;
        cause = error; abortRequested = true; clearTimeout(timer);
        abortTimer = setTimeout(unknown, WRITE_ABORT_WAIT_MS);
        try { tx.abort(); } catch (_) { /* Await the genuine terminal event, never infer a commit. */ }
      }
      try {
        _assertStorageWritable();
        tx = connection.transaction(stores, 'readwrite');
        tx.oncomplete = function() {
          if (settled) { if (_uncertainWrites.has(outcomeRecord.id)) _publishWriteOutcome(outcomeRecord, 'committed'); try { _storageDiagnostic(stage, { code: 'SAVE_LATE_COMMIT' }, 'late-committed'); } catch (_) {} return; }
          end(null);
        };
        tx.onabort = function(e) {
          if (settled) { if (_uncertainWrites.has(outcomeRecord.id)) _publishWriteOutcome(outcomeRecord, 'aborted'); try { _storageDiagnostic(stage, { code: 'SAVE_LATE_ABORT' }, 'late-aborted'); } catch (_) {} return; }
          var error = cause || e && e.target && e.target.error || tx.error || new Error('主存档写事务已中止');
          try { error.storageOutcome = 'aborted'; } catch (_) {}
          end(error);
        };
        tx.onerror = function(e) { abort(e && e.target && e.target.error || tx.error || new Error('主存档写事务发生错误')); };
        timer = setTimeout(function() {
          var error = new Error('主存档写入等待超时，正在确认事务中止'); error.name = 'TimeoutError'; error.code = 'SAVE_WRITE_TIMEOUT';
          abort(error);
        }, WRITE_WAIT_MS);
        writer(tx);
      } catch (error) { if (tx) abort(error); else end(error); }
    });
  }

  function _writeOutcome(id) { var row = _uncertainWrites.get(String(id)); return row ? Object.assign({}, row) : null; }
  function _acknowledgeWriteOutcome(id) {
    var row = _uncertainWrites.get(String(id));
    if (!row || _uncertainWrites.size !== 1 || !['committed','aborted'].includes(row.outcome)) return false;
    _uncertainWrites.delete(String(id)); _writeOutcomeListeners.delete(String(id));
    _writeSafety = _uncertainWrites.size ? _uncertainWrites.values().next().value : null;
    return !_writeSafety;
  }
  function _whenWriteSettled(id, fn) {
    var row = _uncertainWrites.get(String(id)); if (!row || typeof fn !== 'function') return function() {};
    var live = true, wrapped = function(value) { if (live) fn(value); };
    if (row.outcome !== 'unconfirmed') Promise.resolve().then(function() { wrapped(Object.assign({}, row)); });
    else { var list = _writeOutcomeListeners.get(String(id)) || []; list.push(wrapped); _writeOutcomeListeners.set(String(id), list); }
    return function() { live = false; };
  }
  function _retryStorageQuota(error, enabled, retryCount, guard, ids, retry) {
    if (!enabled || retryCount || !error || error.name !== 'QuotaExceededError' || error.storageOutcome !== 'aborted') throw error;
    if (!_writeGuardAllows(guard)) return false;
    var excluded = Object.create(null); ids.forEach(function(id) { excluded[String(id)] = true; });
    return _dropOldestAutoSave(guard, excluded).then(function(dropped) {
      if (!_writeGuardAllows(guard)) return false;
      if (dropped) return retry();
      if (typeof window.toast === 'function') window.toast('❌ 存档空间满·请手动删除旧存档后重试');
      return false;
    });
  }

  function _utf8ByteLength(text) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text).byteLength;
    return unescape(encodeURIComponent(text)).length;
  }

  function _checksumJson(json, utf8Bytes) {
    return _perfWithSpan('save.checksum', async function() {
      if (typeof crypto !== 'undefined' && crypto.subtle && utf8Bytes) {
        var digestPromise = crypto.subtle.digest('SHA-256', utf8Bytes);
        utf8Bytes = null; // digest has accepted its input; do not retain it through compression.
        var digest = await (typeof SaveCompression.awaitResult === 'function' ? SaveCompression.awaitResult(digestPromise, 'checksum') : digestPromise);
        return Array.prototype.map.call(new Uint8Array(digest), function(byte) {
          return byte.toString(16).padStart(2, '0');
        }).join('');
      }
      var hash = 2166136261;
      for (var i = 0; i < json.length; i++) {
        hash ^= json.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
      }
      return 'fnv1a-' + (hash >>> 0).toString(16).padStart(8, '0');
    });
  }

  /**
   * Build the single immutable serialization artifact for one detached world.
   * JSON is frozen synchronously before compression/checksum cross an async boundary.
   */
  function createCanonicalPayload(state, identity) {
    var json = _perfWithSpan('save.stringify', function() { return JSON.stringify(state); }, identity || {});
    if (typeof json !== 'string') return Promise.reject(new Error('canonical world state is not serializable'));
    var utf8Bytes = _perfWithSpan('save.utf8', function() {
      return typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(json) : null;
    });
    var jsonByteLength = utf8Bytes ? utf8Bytes.byteLength : _utf8ByteLength(json);
    _perfCount('save.stringify.count', 1);
    _perfCount('save.stringify.bytes', jsonByteLength);
    var compressedPromise = _perfWithSpan('save.compress', function() {
      _perfCount('save.compress.count', 1);
      return SaveCompression.compress(json);
    }, identity || {});
    var checksumPromise = _checksumJson(json, utf8Bytes);
    utf8Bytes = null;
    return Promise.all([compressedPromise, checksumPromise]).then(function(parts) {
      var compressed = parts[0];
      var compressedBytes = compressed && typeof compressed.size === 'number'
        ? compressed.size : (compressed === json ? jsonByteLength : _utf8ByteLength(String(compressed)));
      _perfCount('save.compressed.bytes', compressedBytes);
      return Object.freeze({
        identity: Object.freeze(Object.assign({}, identity || {})),
        state: state,
        json: json,
        jsonByteLength: jsonByteLength,
        checksum: parts[1],
        compressed: compressed,
        compressedByteLength: compressedBytes
      });
    });
  }

  function _legacyTimelineId(campaignId) {
    try {
      if (typeof window !== 'undefined' && typeof window._tmLegacyTimelineId === 'function') {
        return window._tmLegacyTimelineId(campaignId);
      }
    } catch (_) {}
    var source = String(campaignId || '').trim();
    var hash = 2166136261;
    for (var i = 0; i < source.length; i++) {
      hash ^= source.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    var tail = source.replace(/[^A-Za-z0-9_-]/g, '_').slice(-40) || 'campaign';
    return 'tml_legacy_' + (hash >>> 0).toString(16).padStart(8, '0') + '_' + tail;
  }

  function _migrateLocalAuxiliaryRecords() {
    [CHRONICLE_RECORD_STORE, TURN_PUBLISH_RECEIPT_STORE].forEach(function(storeName) {
      var prefix = 'tm_idb_' + storeName + '_';
      var keys = [];
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (key && key.indexOf(prefix) === 0) keys.push(key);
      }
      keys.forEach(function(oldKey) {
        var raw = localStorage.getItem(oldKey);
        if (!raw) return;
        var record;
        try { record = JSON.parse(raw); } catch (_) { return; }
        if (!record || _validTimelineId(record.timelineId) || !record.campaignId) return;
        var oldId = String(record.id || oldKey.slice(prefix.length));
        var timelineId = _legacyTimelineId(record.campaignId);
        record.timelineId = timelineId;
        record.legacySourceId = oldId;
        if (storeName === CHRONICLE_RECORD_STORE) {
          if (!Number.isSafeInteger(Number(record.year))) return;
          record.id = _auxRecordId('chronicle', record.campaignId, timelineId + ':' + Number(record.year));
          record.sourceTurn = -1;
          record.historyBasisHash = '';
          record.migrationState = 'legacy-unassigned';
        } else {
          if (!String(record.transactionId || '')) return;
          record.id = _auxRecordId('turn-publish', record.campaignId, timelineId + ':' + String(record.transactionId || ''));
          record.migrationState = 'legacy-v4';
        }
        var newKey = prefix + record.id;
        localStorage.setItem(newKey, JSON.stringify(record));
        if (newKey !== oldKey) localStorage.removeItem(oldKey);
      });
    });
  }

  function _restoreLocalSaveBatchItems(items) {
    items = Array.isArray(items) ? items : [];
    for (var i = items.length - 1; i >= 0; i--) {
      var item = items[i] || {};
      if (!item.key) continue;
      if (item.previous == null) localStorage.removeItem(item.key);
      else localStorage.setItem(item.key, item.previous);
    }
  }

  // localStorage 没有事务。批量存档在任何 payload/metadata 写入前先持久化旧值；
  // 页面若在中途崩溃，下次 open() 会恢复整批旧值，避免 autosave/slot_0 分叉。
  function _recoverLocalSaveBatchJournal() {
    var raw = localStorage.getItem(LOCAL_SAVE_BATCH_JOURNAL);
    if (!raw) return;
    var journal;
    try { journal = JSON.parse(raw); }
    catch (_) { localStorage.removeItem(LOCAL_SAVE_BATCH_JOURNAL); return; }
    if (!journal || !Array.isArray(journal.items)) {
      localStorage.removeItem(LOCAL_SAVE_BATCH_JOURNAL);
      return;
    }
    if (journal.phase !== 'committed') _restoreLocalSaveBatchItems(journal.items);
    localStorage.removeItem(LOCAL_SAVE_BATCH_JOURNAL);
  }

  // ── 打开数据库 ──
  function open() {
    try { _recoverLocalSaveBatchJournal(); }
    catch (journalError) { var recoveryError = new Error('localStorage 批量存档恢复失败：' + (journalError && journalError.message || journalError)); recoveryError.code = 'SAVE_LOCAL_RECOVERY_FAILED'; return Promise.reject(recoveryError); }
    try { _migrateLocalAuxiliaryRecords(); }
    catch (migrationError) { console.warn('[SaveDB] localStorage 辅助记录迁移延后重试:', migrationError); }
    if (_db) return Promise.resolve(_db);
    if (_openPromise) return _openPromise;

    var resolveOpen, rejectOpen;
    var owner = { settled: false, failed: false, timer: null, upgrade: null };
    owner.promise = new Promise(function(resolve, reject) { resolveOpen = resolve; rejectOpen = reject; });
    _openOwner = owner; _openPromise = owner.promise;
    function releasePending() {
      clearTimeout(owner.timer);
      if (_openOwner === owner) { _openOwner = null; _openPromise = null; }
    }
    function failOpen(error) {
      if (owner.settled) return;
      owner.failed = true; owner.settled = true;
      releasePending();
      _storageDiagnostic('open', error, _abortRead(owner.upgrade));
      if (!_db) _available = false;
      rejectOpen(error);
    }
    try {
      if (!window.indexedDB) {
        console.warn('[SaveDB] IndexedDB不可用，回退localStorage');
        _available = false; owner.settled = true; releasePending(); resolveOpen(null); return owner.promise;
      }
      owner.timer = setTimeout(function() { failOpen(_storageWaitError('SAVE_OPEN_TIMEOUT', 'open')); }, OPEN_WAIT_MS);
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function(e) {
        if (owner.failed) { _abortRead(e.target.transaction); try { e.target.result.close(); } catch (_) {} return; }
        owner.upgrade = e.target.transaction;
        var db = e.target.result;
        var saveStore;
        if (!db.objectStoreNames.contains(SAVE_STORE)) {
          saveStore = db.createObjectStore(SAVE_STORE, { keyPath: 'id' });
          saveStore.createIndex('timestamp', 'timestamp', { unique: false });
        } else {
          saveStore = e.target.transaction.objectStore(SAVE_STORE);
        }
        var metadataStore;
        if (!db.objectStoreNames.contains(SAVE_META_STORE)) {
          metadataStore = db.createObjectStore(SAVE_META_STORE, { keyPath: 'id' });
          metadataStore.createIndex('timestamp', 'timestamp', { unique: false });
        } else {
          metadataStore = e.target.transaction.objectStore(SAVE_META_STORE);
        }
        if (!db.objectStoreNames.contains(PROJECT_STORE)) {
          db.createObjectStore(PROJECT_STORE, { keyPath: 'id' });
        }
        var chronicleStore = db.objectStoreNames.contains(CHRONICLE_RECORD_STORE)
          ? e.target.transaction.objectStore(CHRONICLE_RECORD_STORE)
          : db.createObjectStore(CHRONICLE_RECORD_STORE, { keyPath: 'id' });
        var receiptStore = db.objectStoreNames.contains(TURN_PUBLISH_RECEIPT_STORE)
          ? e.target.transaction.objectStore(TURN_PUBLISH_RECEIPT_STORE)
          : db.createObjectStore(TURN_PUBLISH_RECEIPT_STORE, { keyPath: 'id' });
        function ensureIndex(store, name, keyPath) {
          try {
            if (!store.indexNames || !store.indexNames.contains(name)) store.createIndex(name, keyPath, { unique: false });
          } catch (_) {}
        }
        ensureIndex(chronicleStore, 'campaignTimeline', ['campaignId', 'timelineId']);
        ensureIndex(chronicleStore, 'campaignTimelineYear', ['campaignId', 'timelineId', 'year']);
        ensureIndex(receiptStore, 'campaignTimelineStatus', ['campaignId', 'timelineId', 'status']);
        // v4 的 key 只有 campaign/year 或 campaign/transactionId；v5 只补了索引，旧行仍不进入
        // compound index。v6 在同一 upgrade transaction 中先 put 新键、再删旧键；任何异常都会
        // 由 IndexedDB 原子回滚，旧记录可在下次启动继续迁移。
        if (e.oldVersion > 0 && e.oldVersion < 6) {
          function migrateAuxStore(store, kind) {
            var cursorReq = store.openCursor();
            cursorReq.onsuccess = function() {
              if (owner.failed) return;
              var cursor = cursorReq.result;
              if (!cursor) return;
              var record = cursor.value;
              if (record && record.campaignId && !_validTimelineId(record.timelineId)) {
                var oldId = String(record.id || '');
                var timelineId = _legacyTimelineId(record.campaignId);
                record.timelineId = timelineId;
                record.legacySourceId = oldId;
                if (kind === 'chronicle') {
                  if (!Number.isSafeInteger(Number(record.year))) { cursor.continue(); return; }
                  record.id = _auxRecordId('chronicle', record.campaignId, timelineId + ':' + Number(record.year));
                  record.sourceTurn = -1;
                  record.historyBasisHash = '';
                  record.migrationState = 'legacy-unassigned';
                } else {
                  if (!String(record.transactionId || '')) { cursor.continue(); return; }
                  record.id = _auxRecordId('turn-publish', record.campaignId, timelineId + ':' + String(record.transactionId || ''));
                  record.migrationState = 'legacy-v4';
                }
                store.put(record);
                if (oldId && oldId !== record.id) store.delete(oldId);
              }
              cursor.continue();
            };
          }
          migrateAuxStore(chronicleStore, 'chronicle');
          migrateAuxStore(receiptStore, 'turn-publish');
        }
        // v2→v3 只在升级事务中遍历一次旧 payload，之后列表永远只读轻量 metadata。
        if (e.oldVersion > 0 && e.oldVersion < 3 && saveStore && metadataStore) {
          var cursorReq = saveStore.openCursor();
          cursorReq.onsuccess = function() {
              if (owner.failed) return;
            var cursor = cursorReq.result;
            if (!cursor) return;
            metadataStore.put(_toSaveMetadata(cursor.value));
            cursor.continue();
          };
        }
      };
      req.onsuccess = function(e) {
        var openedDb = e.target.result;
        if (owner.settled || _openOwner !== owner) { try { openedDb.close(); } catch (_) {} return; }
        function releaseConnection() {
          try { openedDb.close(); } catch (_) {}
          if (_db === openedDb) { _db = null; _available = false; }
        }
        openedDb.onversionchange = releaseConnection;
        openedDb.onclose = releaseConnection;
        _db = openedDb; _available = true;
        owner.settled = true; releasePending();
        console.log('[SaveDB] IndexedDB就绪 (v' + DB_VERSION + ')');
        resolveOpen(openedDb);
      };
      req.onerror = function(e) {
        if (owner.settled) return;
        var err = e.target && e.target.error || new Error('IndexedDB 打开失败');
        console.error('[SaveDB] IndexedDB打开失败:', err);
        failOpen(err);
      };
      req.onblocked = function() {
        var error = new Error('IndexedDB 升级被其他页面阻塞'); error.code = 'SAVE_OPEN_BLOCKED';
        failOpen(error);
      };
    } catch (error) { failOpen(error); }
    return owner.promise;
  }

  // ── R103·quota 满时自动清最老 auto 存档（type='auto'），手动存档永不删 ──
  function _writeGuardAllows(writeGuard) {
    _assertStorageWritable();
    if (typeof writeGuard !== 'function') return true;
    try { return writeGuard() === true; }
    catch (_) { return false; }
  }

  function _toSaveMetadata(record) {
    record = record || {};
    return {
      id: record.id,
      name: record.name,
      type: record.type,
      timestamp: record.timestamp,
      turn: record.turn,
      scenarioName: record.scenarioName,
      eraName: record.eraName,
      date: record.date || '',
      dynastyPhase: record.dynastyPhase || '',
      snapshotId: record.snapshotId || '',
      commitState: record.commitState || '',
      campaignId: record.campaignId || '',
      timelineId: record.timelineId || ''
    };
  }

  function _saveIdentityFromGameState(gameState) {
    var gm = gameState && gameState.GM ? gameState.GM : gameState;
    return {
      campaignId: String(gm && gm._campaignId || ''),
      timelineId: String(gm && gm._timelineId || '')
    };
  }

  function _dropOldestAutoSave(writeGuard, excludedIds) {
    if (!_writeGuardAllows(writeGuard)) return Promise.resolve(false);
    var protectedIds = Object.create(null);
    Object.keys(PROTECTED_SAVE_IDS).forEach(function(id) { protectedIds[id] = true; });
    Object.keys(excludedIds || {}).forEach(function(id) { protectedIds[String(id)] = true; });
    return _listSaveMetadata().then(function(records) {
      // 列表读取本身是异步的；失效请求不得为了一个已取消的写入删除仍可恢复的旧 autosave。
      if (!_writeGuardAllows(writeGuard)) return false;
      var autos = (records || []).filter(function(r){ return r.type === 'auto' && !protectedIds[String(r.id)]; })
                                 .sort(function(a,b){ return (a.timestamp||0) - (b.timestamp||0); });
      if (autos.length === 0) return false; // 没 auto 可清
      var victim = autos[0];
      console.warn('[SaveDB] quota 满·清最老自动存档:', victim.id, 'ts=' + new Date(victim.timestamp||0).toLocaleString());
      return _deleteSaveRecord(victim.id, writeGuard).then(function(){ return true; });
    });
  }

  function _putSaveRecord(record, _retryCount, writeGuard) {
    if (!_writeGuardAllows(writeGuard)) return Promise.resolve(false);
    var metadata = _toSaveMetadata(record);
    if (!_available || !_db) {
      return _perfWithSpan('save.localFallback', function() {
      var payloadKey = 'tm_idb_' + SAVE_STORE + '_' + record.id;
      var metadataKey = 'tm_idb_' + SAVE_META_STORE + '_' + record.id;
      var previousPayload = localStorage.getItem(payloadKey);
      var previousMetadata = localStorage.getItem(metadataKey);
      try {
        localStorage.setItem(payloadKey, JSON.stringify(record));
        localStorage.setItem(metadataKey, JSON.stringify(metadata));
        return Promise.resolve(true);
      } catch (e) {
        try {
          if (previousPayload == null) localStorage.removeItem(payloadKey);
          else localStorage.setItem(payloadKey, previousPayload);
          if (previousMetadata == null) localStorage.removeItem(metadataKey);
          else localStorage.setItem(metadataKey, previousMetadata);
        } catch (_) {}
        if (e && e.name === 'QuotaExceededError' && !_retryCount) {
          var excludedLocal = Object.create(null);
          excludedLocal[String(record.id)] = true;
          if (!_writeGuardAllows(writeGuard)) return Promise.resolve(false);
          return _dropOldestAutoSave(writeGuard, excludedLocal).then(function(dropped) {
            if (!_writeGuardAllows(writeGuard)) return false;
            if (dropped) return _putSaveRecord(record, 1, writeGuard);
            if (typeof window.toast === 'function') window.toast('❌ 存档空间满·请手动删除旧存档后重试');
            return false;
          });
        }
        return Promise.reject(e);
      }
      }, { records: 1 });
    }
    return _runStorageWrite([SAVE_STORE, SAVE_META_STORE], 'single-save', function(tx) {
      tx.objectStore(SAVE_STORE).put(record);
      tx.objectStore(SAVE_META_STORE).put(metadata);
    }).catch(function(error) {
      return _retryStorageQuota(error, true, _retryCount, writeGuard, [record.id], function() { return _putSaveRecord(record, 1, writeGuard); });
    });
  }

  function _putSaveRecordsAtomic(records, writeGuard, _retryCount, turnPublishReceipt, onCommitted) {
    records = Array.isArray(records) ? records : [];
    if (!records.length) return Promise.resolve(false);
    function committed() {
      try { if (typeof onCommitted === 'function') onCommitted(records); }
      catch (error) { try { console.warn('[SaveDB] 已提交存档的通知失败:', error); } catch (_) {} }
    }
    if (!_writeGuardAllows(writeGuard)) return Promise.resolve(false);
    if (!_available || !_db) {
      return _perfWithSpan('save.localFallback', function() {
      var items = [];
      records.forEach(function(record) {
        var payloadKey = 'tm_idb_' + SAVE_STORE + '_' + record.id;
        var metadataKey = 'tm_idb_' + SAVE_META_STORE + '_' + record.id;
        items.push({ key: payloadKey, previous: localStorage.getItem(payloadKey) });
        items.push({ key: metadataKey, previous: localStorage.getItem(metadataKey) });
      });
      var receiptKey = '';
      if (turnPublishReceipt) {
        receiptKey = 'tm_idb_' + TURN_PUBLISH_RECEIPT_STORE + '_' + turnPublishReceipt.id;
        items.push({ key: receiptKey, previous: localStorage.getItem(receiptKey) });
      }
      var journal = { version: 1, phase: 'prepared', createdAt: Date.now(), items: items };
      try {
        localStorage.setItem(LOCAL_SAVE_BATCH_JOURNAL, JSON.stringify(journal));
        records.forEach(function(record) {
          localStorage.setItem('tm_idb_' + SAVE_STORE + '_' + record.id, JSON.stringify(record));
          localStorage.setItem('tm_idb_' + SAVE_META_STORE + '_' + record.id, JSON.stringify(_toSaveMetadata(record)));
        });
        if (turnPublishReceipt) localStorage.setItem(receiptKey, JSON.stringify(turnPublishReceipt));
        journal.phase = 'committed';
        localStorage.setItem(LOCAL_SAVE_BATCH_JOURNAL, JSON.stringify(journal));
        committed();
        try { localStorage.removeItem(LOCAL_SAVE_BATCH_JOURNAL); }
        catch (cleanupError) { try { console.warn('[SaveDB] 已提交日志留待下次清理:', cleanupError); } catch (_) {} }
        return Promise.resolve(true);
      } catch (error) {
        var restored = false;
        try {
          _restoreLocalSaveBatchItems(items);
          localStorage.removeItem(LOCAL_SAVE_BATCH_JOURNAL);
          restored = true;
        } catch (_) {
          // 保留 prepared journal；下次 open() 会继续恢复旧值。
        }
        if (restored && error && error.name === 'QuotaExceededError' && !_retryCount) {
          var excludedLocal = Object.create(null);
          records.forEach(function(record) { excludedLocal[String(record.id)] = true; });
          if (!_writeGuardAllows(writeGuard)) return Promise.resolve(false);
          return _dropOldestAutoSave(writeGuard, excludedLocal).then(function(dropped) {
            if (!_writeGuardAllows(writeGuard)) return false;
            if (dropped) return _putSaveRecordsAtomic(records, writeGuard, 1, turnPublishReceipt, onCommitted);
            if (typeof window.toast === 'function') window.toast('❌ 存档空间满·请手动删除旧存档后重试');
            return false;
          });
        }
        return Promise.reject(error);
      }
      }, { records: records.length, atomic: true });
    }
    var txStores = [SAVE_STORE, SAVE_META_STORE];
    if (turnPublishReceipt) txStores.push(TURN_PUBLISH_RECEIPT_STORE);
    return _runStorageWrite(txStores, 'canonical-save', function(tx) {
      var payloadStore = tx.objectStore(SAVE_STORE), metadataStore = tx.objectStore(SAVE_META_STORE);
      records.forEach(function(record) { payloadStore.put(record); metadataStore.put(_toSaveMetadata(record)); });
      if (turnPublishReceipt) tx.objectStore(TURN_PUBLISH_RECEIPT_STORE).put(turnPublishReceipt);
    }).then(function() { committed(); return true; }).catch(function(error) {
      return _retryStorageQuota(error, true, _retryCount, writeGuard, records.map(function(record) { return record.id; }), function() { return _putSaveRecordsAtomic(records, writeGuard, 1, turnPublishReceipt, onCommitted); });
    });
  }

  // ── 通用写入（R103·加 QuotaExceededError 自动回收） ──
  function _put(storeName, record, _retryCount, writeGuard) {
    // 每一次真正落盘（包括 quota 回收后的重试）都必须重新验证租约。
    // 调用方在压缩前的检查只能挡住正常路径，不能覆盖异步回收窗口。
    if (!_writeGuardAllows(writeGuard)) return Promise.resolve(false);
    if (!_available || !_db) {
      // localStorage 回退
      try {
        localStorage.setItem('tm_idb_' + storeName + '_' + record.id, JSON.stringify(record));
        return Promise.resolve(true);
      } catch(e) {
        console.error('[SaveDB] localStorage写入失败:', e.message);
        if (e && e.name === 'QuotaExceededError' && storeName === SAVE_STORE && !_retryCount) {
          var excludedLocal = Object.create(null);
          excludedLocal[String(record.id)] = true;
          if (!_writeGuardAllows(writeGuard)) return Promise.resolve(false);
          return _dropOldestAutoSave(writeGuard, excludedLocal).then(function(dropped) {
            if (!_writeGuardAllows(writeGuard)) return false;
            if (dropped) return _put(storeName, record, 1, writeGuard);
            if (typeof window.toast === 'function') window.toast('❌ 存档空间满·请手动删除旧存档后重试');
            return false;
          });
        }
        return Promise.reject(e);
      }
    }
    return _runStorageWrite(storeName, 'record-write', function(tx) {
      tx.objectStore(storeName).put(record);
    }).catch(function(error) {
      return _retryStorageQuota(error, storeName === SAVE_STORE, _retryCount, writeGuard, [record.id], function() { return _put(storeName, record, 1, writeGuard); });
    });
  }

  // 多记录同事务提交；迁移只有在这一事务完整成功后才允许删除旧源。
  function _putManyAtomic(storeName, records) {
    _assertStorageWritable();
    records = Array.isArray(records) ? records : [];
    if (!records.length) return Promise.resolve(0);
    if (!_available || !_db) {
      var written = [];
      try {
        records.forEach(function(record) {
          var key = 'tm_idb_' + storeName + '_' + record.id;
          var previous = localStorage.getItem(key);
          localStorage.setItem(key, JSON.stringify(record));
          written.push({ key: key, previous: previous });
          if (storeName === SAVE_STORE) {
            var metadataKey = 'tm_idb_' + SAVE_META_STORE + '_' + record.id;
            var previousMetadata = localStorage.getItem(metadataKey);
            localStorage.setItem(metadataKey, JSON.stringify(_toSaveMetadata(record)));
            written.push({ key: metadataKey, previous: previousMetadata });
          }
        });
        return Promise.resolve(records.length);
      } catch (e) {
        written.reverse().forEach(function(item) {
          try {
            if (item.previous == null) localStorage.removeItem(item.key);
            else localStorage.setItem(item.key, item.previous);
          } catch (_) {}
        });
        return Promise.reject(e);
      }
    }
    var txStores = storeName === SAVE_STORE ? [SAVE_STORE, SAVE_META_STORE] : storeName;
    return _runStorageWrite(txStores, 'migration-batch', function(tx) {
      var store = tx.objectStore(storeName), metadataStore = storeName === SAVE_STORE ? tx.objectStore(SAVE_META_STORE) : null;
      records.forEach(function(record) { store.put(record); if (metadataStore) metadataStore.put(_toSaveMetadata(record)); });
    }).then(function() { return records.length; });
  }

  // ── 通用读取 ──
  function _get(storeName, id) {
    if (!_available || !_db) {
      try {
        var raw = localStorage.getItem('tm_idb_' + storeName + '_' + id);
        return Promise.resolve(raw ? JSON.parse(raw) : null);
      } catch(e) { return Promise.reject(e); }
    }
    return _boundedStorageRead(storeName, 'record-read', function(store) { return store.get(id); }, null);
  }

  // ── 通用删除 ──
  function _del(storeName, id, writeGuard) {
    if (!_writeGuardAllows(writeGuard)) return Promise.resolve(false);
    if (!_available || !_db) {
      try { localStorage.removeItem('tm_idb_' + storeName + '_' + id); } catch(e) { return Promise.reject(e); }
      return Promise.resolve(true);
    }
    return _runStorageWrite(storeName, 'record-delete', function(tx) { tx.objectStore(storeName).delete(id); });
  }

  function _deleteSaveRecord(id, writeGuard) {
    if (!_writeGuardAllows(writeGuard)) return Promise.resolve(false);
    if (!_available || !_db) {
      var payloadKey = 'tm_idb_' + SAVE_STORE + '_' + id;
      var metadataKey = 'tm_idb_' + SAVE_META_STORE + '_' + id;
      var previousPayload = localStorage.getItem(payloadKey);
      var previousMetadata = localStorage.getItem(metadataKey);
      try {
        localStorage.removeItem(payloadKey);
        localStorage.removeItem(metadataKey);
        return Promise.resolve(true);
      } catch (e) {
        try {
          if (previousPayload != null) localStorage.setItem(payloadKey, previousPayload);
          if (previousMetadata != null) localStorage.setItem(metadataKey, previousMetadata);
        } catch (_) {}
        return Promise.reject(e);
      }
    }
    return _runStorageWrite([SAVE_STORE, SAVE_META_STORE], 'save-delete', function(tx) {
      tx.objectStore(SAVE_STORE).delete(id); tx.objectStore(SAVE_META_STORE).delete(id);
    });
  }

  // ── 通用列出 ──
  function _listAll(storeName) {
    if (!_available || !_db) {
      var results = [];
      try {
        for (var i = 0; i < localStorage.length; i++) {
          var key = localStorage.key(i);
          var prefix = 'tm_idb_' + storeName + '_';
          if (key && key.indexOf(prefix) === 0) {
            var raw = localStorage.getItem(key);
            if (raw) results.push(JSON.parse(raw));
          }
        }
      } catch(e){ return Promise.reject(e); }
      return Promise.resolve(results);
    }
    return _boundedStorageRead(storeName, 'store-list', function(store) { return store.getAll(); }, []);
  }

  function _listByIndex(storeName, indexName, key) {
    if (!_available || !_db) return _listAll(storeName);
    return _boundedStorageRead(storeName, 'index-list', function(store) {
      if (typeof store.index !== 'function') return store.getAll();
      try { return store.index(indexName).getAll(key); }
      catch (error) {
        if (error && error.name === 'NotFoundError') return store.getAll();
        throw error;
      }
    }, []);
  }

  function _deleteMany(storeName, records) {
    _assertStorageWritable();
    records = Array.isArray(records) ? records.filter(function(record) { return record && record.id != null; }) : [];
    if (!records.length) return Promise.resolve(0);
    if (!_available || !_db) {
      records.forEach(function(record) { localStorage.removeItem('tm_idb_' + storeName + '_' + record.id); });
      return Promise.resolve(records.length);
    }
    return _runStorageWrite(storeName, 'auxiliary-delete', function(tx) {
      var store = tx.objectStore(storeName); records.forEach(function(record) { store.delete(record.id); });
    }).then(function() { return records.length; });
  }

  function _listSaveMetadata() {
    if (_available && _db) return _listAll(SAVE_META_STORE);
    return _listAll(SAVE_META_STORE).then(function(metadataRecords) {
      // 旧 localStorage fallback 没有独立 metadata；只为缺失项做一次惰性回填。
      var byId = Object.create(null);
      (metadataRecords || []).forEach(function(record) { if (record && record.id != null) byId[String(record.id)] = true; });
      var payloadPrefix = 'tm_idb_' + SAVE_STORE + '_';
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (!key || key.indexOf(payloadPrefix) !== 0) continue;
        var id = key.slice(payloadPrefix.length);
        if (byId[id]) continue;
        var raw = localStorage.getItem(key);
        if (!raw) continue;
        var metadata = _toSaveMetadata(JSON.parse(raw));
        localStorage.setItem('tm_idb_' + SAVE_META_STORE + '_' + id, JSON.stringify(metadata));
        metadataRecords.push(metadata);
        byId[id] = true;
      }
      return metadataRecords;
    });
  }

  // ============================================================
  //  公开API：游戏存档
  // ============================================================

  /** 确保DB就绪后执行操作 */
  function _ensureOpen() {
    if (_db) return Promise.resolve();
    return open().catch(function(error) {
      if (error && (error.code === 'SAVE_OPEN_TIMEOUT' || error.code === 'SAVE_LOCAL_RECOVERY_FAILED')) throw error;
      if (_db && _available) return _db;
      if (_openPromise) return _openPromise;
      // IndexedDB 被禁用、打开失败或升级被阻塞时，公开 API 仍应兑现
      // “回退 localStorage”的契约；失败原因保留在控制台供诊断。
      console.warn('[SaveDB] IndexedDB打开不可用，回退localStorage:', error);
      _available = false;
      _db = null;
      return null;
    });
  }

  /** 保存游戏存档（7.1: 支持gzip压缩） */
  function _gcReplacedSaveTimelines(previousMetadata, currentRecords) {
    previousMetadata = Array.isArray(previousMetadata) ? previousMetadata : [];
    currentRecords = Array.isArray(currentRecords) ? currentRecords : [];
    var currentById = Object.create(null);
    currentRecords.forEach(function(record) { if (record && record.id != null) currentById[String(record.id)] = record; });
    var candidates = [];
    var seen = Object.create(null);
    previousMetadata.forEach(function(previous) {
      if (!previous || previous.id == null) return;
      var current = currentById[String(previous.id)];
      if (!current) return;
      var previousCampaign = String(previous.campaignId || '');
      var previousTimeline = String(previous.timelineId || '');
      if (!previousCampaign || !_validTimelineId(previousTimeline)) return;
      if (previousCampaign === String(current.campaignId || '') && previousTimeline === String(current.timelineId || '')) return;
      var key = previousCampaign + ':' + previousTimeline;
      if (seen[key]) return;
      seen[key] = true;
      candidates.push(previous);
    });
    return Promise.all(candidates.map(function(metadata) {
      return _gcAuxiliaryTimelineIfUnreferenced(metadata).catch(function(error) {
        try { console.warn('[SaveDB] 覆盖存档后的辅助记录回收失败:', error); } catch (_) {}
        return false;
      });
    })).then(function() { return true; });
  }

  function save(id, gameState, meta, options) {
    options = options || {};
    function _writeStillAllowed() {
      if (typeof options.writeGuard !== 'function') return true;
      try { return options.writeGuard() === true; }
      catch (_) { return false; }
    }
    // 在调用栈内立即固化 JSON。_ensureOpen / gzip 都是异步；若延后 stringify，
    // selective snapshot 中安全复用的 append-only 引用可能在过回合期间继续增长，污染 pre_endturn 时点。
    var saveIdentity = _saveIdentityFromGameState(gameState);
    var payloadPromise;
    try {
      payloadPromise = options.canonicalPayload
        ? Promise.resolve(options.canonicalPayload)
        : createCanonicalPayload(gameState, {
          campaignId: saveIdentity.campaignId,
          timelineId: saveIdentity.timelineId,
          turn: meta && meta.turn
        });
    } catch (e) { return Promise.reject(e); }
    if (!_writeStillAllowed()) return Promise.resolve(false);
    var previousMetadata = null;
    return Promise.all([
      _ensureOpen().then(function() { return _get(SAVE_META_STORE, id); }),
      payloadPromise
    ]).then(function(parts) {
      previousMetadata = parts[0];
      var payload = parts[1];
      if (!payload || typeof payload.json !== 'string') throw new Error('canonical save payload invalid');
      var jsonStr = payload.json;
      var compressed = payload.compressed;
        // Blob 只能由 IndexedDB 结构化克隆安全保存。localStorage 的 JSON.stringify
        // 会把 Blob 变成 {}，因此降级路径必须保留原始 JSON 字符串。
        var isCompressed = !!(_available && _db && compressed !== jsonStr);
        var record = {
          id: id,
          type: (meta && meta.type) || 'manual',
          name: (meta && meta.name) || id,
          timestamp: Date.now(),
          turn: (meta && meta.turn != null) ? meta.turn : 0,
          scenarioName: (meta && meta.scenarioName) || '',
          eraName: (meta && meta.eraName) || '',
          date: (meta && meta.date) || '',
          dynastyPhase: (meta && meta.dynastyPhase) || '',
          // pre_endturn 两阶段恢复校验元数据；普通/旧存档保持空值兼容。
          snapshotId: (meta && meta.snapshotId) || '',
          commitState: (meta && meta.commitState) || '',
          campaignId: (meta && meta.campaignId) || saveIdentity.campaignId,
          timelineId: (meta && meta.timelineId) || saveIdentity.timelineId,
          gameState: isCompressed ? compressed : jsonStr,
          _compressed: isCompressed
        };
        if (isCompressed) {
          var origKB = (jsonStr.length / 1024).toFixed(1);
          console.log('[SaveDB] 存档压缩: ' + origKB + 'KB -> gzip Blob');
        }
        // 压缩/开库可能跨越读档或下一回合；真正开启写事务前再验一次租约。
        if (!_writeStillAllowed()) return false;
        return _perfWithSpan('save.idbCommit', function() {
          return _putSaveRecord(record, 0, _writeStillAllowed);
        }, { slots: 1 }).then(function(saved) {
          if (saved !== true) return saved;
          return _gcReplacedSaveTimelines(previousMetadata ? [previousMetadata] : [], [record]);
        });
    });
  }

  /** 同一事务保存多个 canonical 槽位；任一 payload/metadata 失败则整批不推进。 */
  function saveManyAtomic(entries, options) {
    entries = Array.isArray(entries) ? entries : [];
    options = options || {};
    var committed = false, commitObserver = typeof options.onCommitted === 'function' ? options.onCommitted : null;
    var transactionId = String(options.transactionId || '');
    function observedCommit(records) {
      if (committed) return;
      committed = true;
      var slots = records.map(function(record) { return Object.freeze({ id: record.id, turn: record.turn, campaignId: record.campaignId, timelineId: record.timelineId }); });
      var receipt = Object.freeze({ state: 'committed', transactionId: transactionId, slots: Object.freeze(slots) });
      try {
        var notification = commitObserver ? commitObserver(receipt) : null;
        if (notification && typeof notification.then === 'function') Promise.resolve(notification).catch(function(error) { try { console.warn('[SaveDB] 异步提交通知失败:', error); } catch (_) {} });
      }
      catch (error) { try { console.warn('[SaveDB] 提交通知失败，主存档仍已提交:', error); } catch (_) {} }
    }
    if (!entries.length) return Promise.resolve(false);
    function _writeStillAllowed() {
      if (typeof options.writeGuard !== 'function') return true;
      try { return options.writeGuard() === true; }
      catch (_) { return false; }
    }
    var frozen;
    var uniqueStates = [];
    var uniquePayloads = [];
    var uniqueProvidedPayloads = [];
    var frozenTurnPublishReceipt = null;
    try {
      var seenIds = Object.create(null);
      frozen = entries.map(function(entry) {
        if (!entry || entry.id == null || entry.id === '') throw new Error('批量存档缺少 id');
        var id = String(entry.id);
        if (seenIds[id]) throw new Error('批量存档 id 重复：' + id);
        seenIds[id] = true;
        var frozenMeta = Object.assign({}, entry.meta || {});
        var identity = _saveIdentityFromGameState(entry.gameState);
        if (!frozenMeta.campaignId) frozenMeta.campaignId = identity.campaignId;
        if (!frozenMeta.timelineId) frozenMeta.timelineId = identity.timelineId;
        var sharedIndex = uniqueStates.indexOf(entry.gameState);
        var payloadPromise;
        if (sharedIndex >= 0) {
          if (entry.canonicalPayload && uniqueProvidedPayloads[sharedIndex]
              && entry.canonicalPayload !== uniqueProvidedPayloads[sharedIndex]) {
            throw new Error('同一 canonical state 收到不同 payload：' + id);
          }
          payloadPromise = uniquePayloads[sharedIndex];
          _perfCount('save.payloadReuse.count', 1);
        } else {
          if (entry.canonicalPayload) {
            payloadPromise = Promise.resolve(entry.canonicalPayload);
          } else {
            payloadPromise = createCanonicalPayload(entry.gameState, {
              campaignId: frozenMeta.campaignId,
              timelineId: frozenMeta.timelineId,
              turn: frozenMeta.turn,
              transactionId: options.transactionId || ''
            });
          }
          uniqueStates.push(entry.gameState);
          uniquePayloads.push(payloadPromise);
          uniqueProvidedPayloads.push(entry.canonicalPayload || null);
        }
        return { id: id, payloadPromise: payloadPromise, meta: frozenMeta };
      });
      if (options.turnPublishReceipt) {
        frozenTurnPublishReceipt = _normalizeTurnPublishReceipt(options.turnPublishReceipt, 'world-committed');
      }
    } catch (error) { return Promise.reject(error); }
    if (!_writeStillAllowed()) return Promise.resolve(false);
    var previousMetadata = [];
    var savedRecords = [];
    return _ensureOpen().then(async function() {
      previousMetadata = await Promise.all(frozen.map(function(item) { return _get(SAVE_META_STORE, item.id); }));
      var payloads = await Promise.all(frozen.map(function(item) { return item.payloadPromise; }));
      var timestamp = Date.now();
      var records = [];
      for (var i = 0; i < frozen.length; i++) {
        var item = frozen[i];
        var payload = payloads[i];
        if (!payload || typeof payload.json !== 'string') throw new Error('批量存档 canonical payload 无效：' + item.id);
        var compressed = payload.compressed;
        var isCompressed = !!(_available && _db && compressed !== payload.json);
        records.push({
          id: item.id,
          type: item.meta.type || 'manual',
          name: item.meta.name || item.id,
          timestamp: timestamp,
          turn: item.meta.turn != null ? item.meta.turn : 0,
          scenarioName: item.meta.scenarioName || '',
          eraName: item.meta.eraName || '',
          date: item.meta.date || '',
          dynastyPhase: item.meta.dynastyPhase || '',
          snapshotId: item.meta.snapshotId || '',
          commitState: item.meta.commitState || '',
          campaignId: item.meta.campaignId || '',
          timelineId: item.meta.timelineId || '',
          gameState: isCompressed ? compressed : payload.json,
          _compressed: isCompressed
        });
      }
      if (!_writeStillAllowed()) return false;
      savedRecords = records;
      return _perfWithSpan('save.idbCommit', function() {
        return _putSaveRecordsAtomic(records, _writeStillAllowed, 0, frozenTurnPublishReceipt, observedCommit);
      }, { slots: records.length });
    }).then(function(saved) {
      if (saved !== true && !committed) return saved;
      observedCommit(savedRecords);
      return Promise.resolve(_gcReplacedSaveTimelines(previousMetadata, savedRecords)).then(function() { return true; });
    }).catch(function(error) {
      if (!committed) throw error;
      try { console.warn('[SaveDB] 主存档已提交，后处理失败:', error); } catch (_) {}
      return true;
    });
  }

  /** v4 以前的兼容迁移：清除烘在 canonical 槽位正文中的旧 publish marker。 */
  function clearPendingTurnDataPublishAtomic(ids, transactionId, options) {
    ids = Array.isArray(ids) ? ids.map(String) : [];
    transactionId = String(transactionId || '');
    options = options || {};
    if (!ids.length || !transactionId) return Promise.resolve(false);
    function stillAllowed() {
      if (typeof options.writeGuard !== 'function') return true;
      try { return options.writeGuard() === true; }
      catch (_) { return false; }
    }
    if (!stillAllowed()) return Promise.resolve(false);
    return Promise.all(ids.map(function(id) { return load(id); })).then(function(records) {
      if (!stillAllowed() || records.some(function(record) { return !record || !record.gameState; })) return false;
      var changed = false;
      var entries = [];
      for (var i = 0; i < records.length; i++) {
        var record = records[i];
        var state = record.gameState;
        var marker = state && state.GM && state.GM._pendingTurnDataPublish;
        if (marker && String(marker.transactionId || '') !== transactionId) return false;
        if (marker) {
          delete state.GM._pendingTurnDataPublish;
          changed = true;
        }
        entries.push({ id: record.id, gameState: state, meta: _toSaveMetadata(record) });
      }
      if (!changed) return true;
      return saveManyAtomic(entries, { writeGuard: stillAllowed });
    });
  }

  function _auxRecordId(prefix, campaignId, suffix) {
    campaignId = String(campaignId || '');
    suffix = String(suffix == null ? '' : suffix);
    if (!campaignId || campaignId.length > 128 || !/^[A-Za-z0-9_-]+$/.test(campaignId)) {
      throw new Error('轻量记录缺少合法 campaignId');
    }
    if (!suffix || suffix.length > 160) throw new Error('轻量记录缺少合法键');
    return prefix + ':' + campaignId + ':' + suffix;
  }

  function _validTimelineId(value) {
    value = String(value || '');
    return value.length >= 12 && value.length <= 128 && /^tml_[A-Za-z0-9_-]+$/.test(value);
  }

  /** 年度正史独立 checkpoint；AI 成功结果不必等待下一次大型世界存档。 */
  function saveChronicleRecord(input, options) {
    input = input || {};
    options = options || {};
    var campaignId = String(input.campaignId || '');
    var timelineId = String(input.timelineId || '');
    var year = Number(input.year);
    if (!Number.isSafeInteger(year)) return Promise.reject(new Error('年度正史缺少合法年份'));
    if (!_validTimelineId(timelineId)) return Promise.reject(new Error('年度正史缺少合法 timelineId'));
    var sourceTurn = Number(input.sourceTurn);
    if (!Number.isSafeInteger(sourceTurn) || sourceTurn < 0) return Promise.reject(new Error('年度正史缺少合法来源回合'));
    var historyBasisHash = String(input.historyBasisHash || '');
    if (!historyBasisHash || historyBasisHash.length > 128) return Promise.reject(new Error('年度正史缺少历史基础校验值'));
    var chronicle;
    try { chronicle = JSON.parse(JSON.stringify(input.chronicle)); }
    catch (error) { return Promise.reject(error); }
    if (!chronicle || typeof chronicle !== 'object' || Array.isArray(chronicle)) {
      return Promise.reject(new Error('年度正史内容不可持久化'));
    }
    var record;
    try {
      record = {
        id: _auxRecordId('chronicle', campaignId, timelineId + ':' + year),
        campaignId: campaignId,
        timelineId: timelineId,
        year: year,
        sourceTurn: sourceTurn,
        historyBasisHash: historyBasisHash,
        requestId: String(input.requestId || ''),
        loadGeneration: Number(input.loadGeneration) || 0,
        generatedAt: Number(input.generatedAt) || Date.now(),
        chronicle: chronicle
      };
    } catch (error) { return Promise.reject(error); }
    return _ensureOpen().then(function() {
      return _put(CHRONICLE_RECORD_STORE, record, 0, options.writeGuard);
    }).then(function(saved) {
      if (saved !== true) return saved;
      var maxYears = Math.max(1, Math.floor(Number(input.maxYears) || 20));
      return pruneChronicleRecords(campaignId, timelineId, maxYears).then(function() { return true; });
    });
  }

  function listChronicleRecords(campaignId, timelineId) {
    campaignId = String(campaignId || '');
    timelineId = String(timelineId || '');
    if (!campaignId || !_validTimelineId(timelineId)) return Promise.resolve([]);
    return _ensureOpen().then(function() { return _listByIndex(CHRONICLE_RECORD_STORE, 'campaignTimeline', [campaignId, timelineId]); }).then(function(records) {
      return (records || []).filter(function(record) {
        return record && String(record.campaignId || '') === campaignId && String(record.timelineId || '') === timelineId;
      });
    });
  }

  function listQuarantinedChronicleRecords(campaignId) {
    campaignId = String(campaignId || '');
    if (!campaignId) return Promise.resolve([]);
    return _ensureOpen().then(function() { return _listAll(CHRONICLE_RECORD_STORE); }).then(function(records) {
      return (records || []).filter(function(record) {
        return record && String(record.campaignId || '') === campaignId
          && String(record.migrationState || '') === 'legacy-unassigned';
      }).sort(function(a, b) {
        return Number(a && a.year || 0) - Number(b && b.year || 0)
          || Number(a && a.generatedAt || 0) - Number(b && b.generatedAt || 0);
      });
    });
  }

  function importQuarantinedChronicleRecord(input, options) {
    input = input || {};
    options = options || {};
    if (input.confirmed !== true) return Promise.reject(new Error('导入隔离编年必须由玩家明确确认'));
    var recordId = String(input.recordId || '');
    var campaignId = String(input.campaignId || '');
    var timelineId = String(input.timelineId || '');
    var year = Number(input.year);
    var sourceTurn = Number(input.sourceTurn);
    var historyBasisHash = String(input.historyBasisHash || '');
    if (!recordId || !campaignId || !_validTimelineId(timelineId)) return Promise.reject(new Error('隔离编年导入身份无效'));
    if (!Number.isSafeInteger(year) || !Number.isSafeInteger(sourceTurn) || sourceTurn < 0 || !historyBasisHash) {
      return Promise.reject(new Error('隔离编年导入缺少当前时间线历史基础'));
    }
    var targetId = _auxRecordId('chronicle', campaignId, timelineId + ':' + year);
    return _ensureOpen().then(function() {
      return Promise.all([_get(CHRONICLE_RECORD_STORE, recordId), _get(CHRONICLE_RECORD_STORE, targetId)]);
    }).then(function(rows) {
      var legacy = rows[0];
      var existing = rows[1];
      if (!legacy || String(legacy.campaignId || '') !== campaignId || String(legacy.migrationState || '') !== 'legacy-unassigned') {
        throw new Error('隔离编年记录不存在或已失效');
      }
      if (Number(legacy.year) !== year) throw new Error('隔离编年年份不匹配');
      if (existing) throw new Error('当前时间线已有该年度正史，未覆盖');
      var chronicle;
      try { chronicle = JSON.parse(JSON.stringify(legacy.chronicle)); }
      catch (error) { throw new Error('隔离编年内容损坏：' + (error && error.message || error)); }
      var claimed = {
        id: targetId,
        campaignId: campaignId,
        timelineId: timelineId,
        year: year,
        sourceTurn: sourceTurn,
        historyBasisHash: historyBasisHash,
        requestId: 'legacy-import-' + Date.now(),
        loadGeneration: Number(input.loadGeneration) || 0,
        generatedAt: Number(legacy.generatedAt) || Date.now(),
        chronicle: chronicle,
        migrationState: 'legacy-confirmed',
        legacySourceId: String(legacy.legacySourceId || legacy.id || ''),
        importedAt: Date.now()
      };
      return _put(CHRONICLE_RECORD_STORE, claimed, 0, options.writeGuard).then(function(saved) {
        if (saved !== true) return saved;
        return claimed;
      });
    });
  }

  function pruneChronicleRecords(campaignId, timelineId, maxYears) {
    maxYears = Math.max(1, Math.floor(Number(maxYears) || 20));
    return listChronicleRecords(campaignId, timelineId).then(function(records) {
      records = (records || []).slice().sort(function(a, b) {
        return Number(b && b.year || 0) - Number(a && a.year || 0) || Number(b && b.generatedAt || 0) - Number(a && a.generatedAt || 0);
      });
      return _deleteMany(CHRONICLE_RECORD_STORE, records.slice(maxYears));
    });
  }

  function _normalizeTurnPublishReceipt(marker, status) {
    marker = marker || {};
    var campaignId = String(marker.campaignId || '');
    var timelineId = String(marker.timelineId || '');
    var transactionId = String(marker.transactionId || '');
    var normalizedStatus = String(status || marker.status || 'world-committed');
    if (['staged', 'world-committed', 'published'].indexOf(normalizedStatus) < 0) {
      throw new Error('回合分卷 receipt 状态无效');
    }
    var record = {
      id: _auxRecordId('turn-publish', campaignId, timelineId + ':' + transactionId),
      campaignId: campaignId,
      timelineId: timelineId,
      transactionId: transactionId,
      saveName: String(marker.saveName || ''),
      turn: Number(marker.turn),
      stateChecksum: String(marker.stateChecksum || ''),
      status: normalizedStatus,
      createdAt: Number(marker.createdAt) || Date.now(),
      updatedAt: Date.now()
    };
    if (!_validTimelineId(record.timelineId)) throw new Error('回合分卷 receipt timelineId 无效');
    if (!Number.isSafeInteger(record.turn) || record.turn < 0) throw new Error('回合分卷 receipt 回合号无效');
    if (!record.stateChecksum || record.stateChecksum.length > 128) throw new Error('回合分卷 receipt checksum 无效');
    return record;
  }

  function saveTurnPublishReceipt(marker, status, options) {
    options = options || {};
    var record;
    try { record = _normalizeTurnPublishReceipt(marker, status); }
    catch (error) { return Promise.reject(error); }
    return _ensureOpen().then(function() {
      return _put(TURN_PUBLISH_RECEIPT_STORE, record, 0, options.writeGuard);
    });
  }

  function listTurnPublishReceipts(campaignId, timelineId, status) {
    campaignId = String(campaignId || '');
    timelineId = String(timelineId || '');
    status = status == null ? '' : String(status);
    if (!campaignId || !_validTimelineId(timelineId)) return Promise.resolve([]);
    var query = status ? [campaignId, timelineId, status] : null;
    return _ensureOpen().then(function() {
      return query ? _listByIndex(TURN_PUBLISH_RECEIPT_STORE, 'campaignTimelineStatus', query) : _listAll(TURN_PUBLISH_RECEIPT_STORE);
    }).then(function(records) {
      return (records || []).filter(function(record) {
        return record && String(record.campaignId || '') === campaignId && String(record.timelineId || '') === timelineId
          && (!status || String(record.status || '') === status);
      });
    });
  }

  function deleteTurnPublishReceipt(marker, options) {
    marker = marker || {};
    options = options || {};
    var id;
    try { id = _auxRecordId('turn-publish', marker.campaignId, String(marker.timelineId || '') + ':' + marker.transactionId); }
    catch (error) { return Promise.reject(error); }
    return _ensureOpen().then(function() {
      return _del(TURN_PUBLISH_RECEIPT_STORE, String(id), options.writeGuard);
    });
  }

  /** 读取游戏存档（7.1: 支持gzip解压，兼容旧存档） */
  function load(id) {
    return _ensureOpen().then(function() {
      return _get(SAVE_STORE, id);
    }).then(function(record) {
      if (!record) return null;
      // 7.1: 解压压缩的gameState
      if (record._compressed && record.gameState) {
        return SaveCompression.decompress(record.gameState).then(function(jsonStr) {
          record.gameState = JSON.parse(jsonStr);
          delete record._compressed;
          return record;
        });
      }
      // 未压缩存档（包括 localStorage fallback）以 JSON 字符串保存；统一还原成对象，
      // 避免调用方把一个合法降级存档误判为损坏。
      if (typeof record.gameState === 'string') {
        record.gameState = JSON.parse(record.gameState);
      }
      delete record._compressed;
      // 旧存档：gameState已经是对象，直接返回
      return record;
    });
  }

  /** 列出所有游戏存档（不含gameState大数据，仅元信息） */
  function list() {
    return _ensureOpen().then(function() {
      return _listSaveMetadata();
    }).then(function(records) {
      return records.map(function(r) {
        return { id:r.id, name:r.name, type:r.type, timestamp:r.timestamp, turn:r.turn, scenarioName:r.scenarioName, eraName:r.eraName, date:r.date||'', dynastyPhase:r.dynastyPhase||'', snapshotId:r.snapshotId||'', commitState:r.commitState||'', campaignId:r.campaignId||'', timelineId:r.timelineId||'' };
      }).sort(function(a,b) { return b.timestamp - a.timestamp; });
    });
  }

  /** 删除游戏存档 */
  function _desktopTimelineMayBeReferenced(campaignId, timelineId) {
    var bridge = (typeof window !== 'undefined') ? window.tianming : null;
    if (!(bridge && bridge.isDesktop)) return Promise.resolve(false);
    if (typeof bridge.listSaveTimelineRefs !== 'function') return Promise.resolve(true);
    var reliability = window.TM && window.TM.Endturn && window.TM.Endturn.Reliability;
    if (!reliability || typeof reliability.callTurnBridge !== 'function') return Promise.resolve(true);
    return reliability.callTurnBridge('listSaveTimelineRefs', null).then(function(result) {
      if (!(result && result.success === true && result.complete === true && Array.isArray(result.refs))) return true;
      return result.refs.some(function(ref) {
        return ref && String(ref.campaignId || '') === campaignId && String(ref.timelineId || '') === timelineId;
      });
    }).catch(function() { return true; });
  }

  function _gcAuxiliaryTimelineIfUnreferenced(metadata) {
    var campaignId = String(metadata && metadata.campaignId || '');
    var timelineId = String(metadata && metadata.timelineId || '');
    if (!campaignId || !_validTimelineId(timelineId)) return Promise.resolve(false);
    return _listSaveMetadata().then(function(records) {
      var referenced = (records || []).some(function(record) {
        return record && String(record.campaignId || '') === campaignId && String(record.timelineId || '') === timelineId;
      });
      if (referenced) return false;
      return _desktopTimelineMayBeReferenced(campaignId, timelineId).then(function(desktopReferenced) {
        if (desktopReferenced) return false;
        return Promise.all([
          listChronicleRecords(campaignId, timelineId).then(function(rows) { return _deleteMany(CHRONICLE_RECORD_STORE, rows); }),
          listTurnPublishReceipts(campaignId, timelineId, '').then(function(rows) { return _deleteMany(TURN_PUBLISH_RECEIPT_STORE, rows); })
        ]).then(function() { return true; });
      });
    });
  }

  function deleteSave(id) {
    var metadata = null;
    return _ensureOpen().then(function() { return _get(SAVE_META_STORE, id); }).then(function(record) {
      metadata = record;
      return _deleteSaveRecord(id);
    }).then(function(deleted) {
      if (deleted !== true) return deleted;
      return _gcAuxiliaryTimelineIfUnreferenced(metadata).catch(function(error) {
        try { console.warn('[SaveDB] 辅助记录回收失败:', error); } catch (_) {}
        return false;
      }).then(function() { return true; });
    });
  }

  // ============================================================
  //  公开API：剧本项目
  // ============================================================

  /** 保存剧本项目P */
  function saveProject(projectData) {
    var record = { id: 'current_project', timestamp: Date.now(), data: projectData };
    return _ensureOpen().then(function() { return _put(PROJECT_STORE, record); });
  }

  /** 读取剧本项目P */
  function loadProject() {
    return _ensureOpen().then(function() {
      return _get(PROJECT_STORE, 'current_project');
    }).then(function(r) {
      return r ? r.data : null;
    });
  }

  // ============================================================
  //  旧存档迁移
  // ============================================================

  function _serializeMigration(fn) {
    var run = _migrationTail.then(fn, fn);
    _migrationTail = run.then(function() {}, function() {});
    return run;
  }

  function _migrationPayloadSignature(record) {
    if (!record) return null;
    var payload = record.gameState;
    if (typeof payload === 'string') return 's:' + payload;
    if (payload == null) return 'null';
    if (typeof Blob !== 'undefined' && payload instanceof Blob) return null;
    try { return 'j:' + JSON.stringify(payload); } catch (_) { return null; }
  }

  function _migrationStableValue(value) {
    if (Array.isArray(value)) return value.map(_migrationStableValue);
    if (value && typeof value === 'object') {
      var out = {};
      Object.keys(value).sort().forEach(function(key) { out[key] = _migrationStableValue(value[key]); });
      return out;
    }
    return value;
  }

  function _migrationMetadataSignature(record) {
    if (!record || typeof record !== 'object') return null;
    var metadata = {};
    Object.keys(record).sort().forEach(function(key) {
      if (key === 'id' || key === 'gameState' || key === '_compressed') return;
      metadata[key] = _migrationStableValue(record[key]);
    });
    try { return JSON.stringify(metadata); } catch (_) { return null; }
  }

  function _migrationRecordsEquivalent(left, right) {
    var leftSig = _migrationPayloadSignature(left);
    var rightSig = _migrationPayloadSignature(right);
    var leftMeta = _migrationMetadataSignature(left);
    var rightMeta = _migrationMetadataSignature(right);
    return leftSig != null && rightSig != null && leftSig === rightSig &&
      leftMeta != null && rightMeta != null && leftMeta === rightMeta;
  }

  async function _prepareMigrationRecords(records, sourceTag) {
    records = Array.isArray(records) ? records : [];
    var prepared = [];
    var reserved = Object.create(null);
    var deduped = 0;
    for (var i = 0; i < records.length; i++) {
      var incoming = Object.assign({}, records[i] || {});
      var baseId = String(incoming.id == null || incoming.id === '' ? (sourceTag + '-' + i) : incoming.id);
      var candidate = baseId;
      var suffix = 0;
      while (true) {
        var occupied = reserved[candidate] || await _get(SAVE_STORE, candidate);
        if (!occupied) {
          incoming.id = candidate;
          prepared.push(incoming);
          reserved[candidate] = incoming;
          break;
        }
        if (_migrationRecordsEquivalent(occupied, incoming)) {
          deduped++;
          break;
        }
        suffix++;
        candidate = baseId + '-migrated-' + sourceTag + (suffix > 1 ? '-' + suffix : '');
      }
    }
    return { records: prepared, deduped: deduped, sourceCount: records.length };
  }

  async function _verifyMigrationRecords(records) {
    for (var i = 0; i < records.length; i++) {
      var stored = await _get(SAVE_STORE, records[i].id);
      if (!stored) throw new Error('迁移写后校验失败：缺少 ' + records[i].id);
      var expectedSig = _migrationPayloadSignature(records[i]);
      var storedSig = _migrationPayloadSignature(stored);
      if (expectedSig != null && storedSig != null && expectedSig !== storedSig) {
        throw new Error('迁移写后校验失败：内容不一致 ' + records[i].id);
      }
    }
  }

  function _legacyLocalSaveRecord(item) {
    var data = item.data || {};
    var state = data.gameState != null ? data.gameState : data;
    var jsonState = typeof state === 'string' ? state : JSON.stringify(state);
    var stateObject = state && typeof state === 'object' ? state : null;
    var timestamp = Number(data.timestamp);
    return {
      id: 'slot_' + item.index,
      type: 'migrated',
      name: data.name || ('存档' + item.index),
      timestamp: isFinite(timestamp) && timestamp > 0 ? timestamp : Date.now(),
      turn: (stateObject && stateObject.GM && stateObject.GM.turn) || (stateObject && stateObject.turn) || (data.GM && data.GM.turn) || 0,
      scenarioName: data.scenarioName || '',
      eraName: data.eraName || '',
      date: data.date || '',
      dynastyPhase: data.dynastyPhase || '',
      snapshotId: data.snapshotId || '',
      commitState: data.commitState || '',
      gameState: jsonState,
      _compressed: false
    };
  }

  async function _migrateFromLocalStorage() {
    if (!_available || !_db) return Promise.resolve(0);
    var candidates = [];
    for (var i = 0; i < 10; i++) {
      var key = 'tm_save_' + i;
      var raw = localStorage.getItem(key);
      if (!raw) continue;
      var data = JSON.parse(raw); // 任一源损坏即整体停止，绝不删除其他旧档。
      candidates.push({ key: key, data: data, index: i });
    }
    var prepared = await _prepareMigrationRecords(candidates.map(_legacyLocalSaveRecord), 'local-storage');
    var written = await _putManyAtomic(SAVE_STORE, prepared.records);
    if (written !== prepared.records.length) throw new Error('旧 localStorage 存档迁移未完整提交');
    await _verifyMigrationRecords(prepared.records);
    candidates.forEach(function(item) { localStorage.removeItem(item.key); });
    if (candidates.length > 0) console.log('[SaveDB] 迁移了' + candidates.length + '个旧存档（去重 ' + prepared.deduped + '）');
    return candidates.length;
  }

  function migrateFromLocalStorage() {
    return _serializeMigration(_migrateFromLocalStorage);
  }

  /** 从旧数据库名(tianming_saves)迁移到当前数据库(tianming_db) */
  function _migrateFromOldDB() {
    if (!_available || !_db) return Promise.resolve(0);
    var OLD_DB = 'tianming_saves';
    if (OLD_DB === DB_NAME) return Promise.resolve(0); // 同名，无需迁移
    return new Promise(function(resolve, reject) {
      var req = indexedDB.open(OLD_DB);
      req.onsuccess = function(e) {
        var oldDb = e.target.result;
        if (!oldDb.objectStoreNames.contains('saves')) { oldDb.close(); resolve(0); return; }
        var tx = oldDb.transaction('saves', 'readonly');
        var getAll = tx.objectStore('saves').getAll();
        getAll.onsuccess = function() {
          var records = getAll.result || [];
          if (!records.length) { oldDb.close(); resolve(0); return; }
          _prepareMigrationRecords(records, 'old-db').then(function(prepared) {
            return _putManyAtomic(SAVE_STORE, prepared.records).then(function(migrated) {
              if (migrated !== prepared.records.length) throw new Error('旧 IndexedDB 存档迁移未完整提交');
              return _verifyMigrationRecords(prepared.records).then(function() {
                return { sourceCount: records.length, deduped: prepared.deduped };
              });
            });
          }).then(function(result) {
            oldDb.close();
            console.log('[SaveDB] 从旧数据库迁移了' + result.sourceCount + '条记录（去重 ' + result.deduped + '）');
            var delReq = indexedDB.deleteDatabase(OLD_DB);
            delReq.onsuccess = function() { resolve(result.sourceCount); };
            delReq.onerror = function(e2) { reject(e2.target && e2.target.error || new Error('旧数据库删除失败')); };
            delReq.onblocked = function() { reject(new Error('旧数据库删除被其他页面阻塞')); };
          }).catch(function(err) { oldDb.close(); reject(err); });
        };
        getAll.onerror = function(e2) { oldDb.close(); reject(e2.target && e2.target.error || new Error('旧数据库读取失败')); };
      };
      req.onerror = function(e) { reject(e.target && e.target.error || new Error('旧数据库打开失败')); };
      req.onblocked = function() { reject(new Error('旧数据库打开被其他页面阻塞')); };
    });
  }

  function migrateFromOldDB() {
    return _serializeMigration(_migrateFromOldDB);
  }

  // ============================================================
  //  R104·容量管理（persistent storage + 配额查询）
  // ============================================================

  /** 申请持久化存储（浏览器不会在空间紧张时自动清理） */
  function requestPersistent() {
    if (!(navigator.storage && navigator.storage.persist)) {
      return Promise.resolve({ supported: false, granted: false, reason: 'API 不支持' });
    }
    // 先查是否已持久化
    return navigator.storage.persisted().then(function(alreadyPersisted) {
      if (alreadyPersisted) return { supported: true, granted: true, alreadyPersisted: true };
      // 申请
      return navigator.storage.persist().then(function(granted) {
        return { supported: true, granted: !!granted, alreadyPersisted: false };
      });
    }).catch(function(e) {
      return { supported: true, granted: false, error: e.message || String(e) };
    });
  }

  /** 查询存储配额和当前用量 */
  function estimate() {
    if (!(navigator.storage && navigator.storage.estimate)) {
      return Promise.resolve({ supported: false });
    }
    return navigator.storage.estimate().then(function(est) {
      var usageMB = est.usage ? (est.usage / 1048576).toFixed(2) : '?';
      var quotaMB = est.quota ? (est.quota / 1048576).toFixed(2) : '?';
      var percent = (est.usage && est.quota) ? (est.usage * 100 / est.quota).toFixed(1) : '?';
      return {
        supported: true,
        usage: est.usage,
        quota: est.quota,
        usageMB: usageMB,
        quotaMB: quotaMB,
        percent: percent,
        summary: usageMB + ' MB / ' + quotaMB + ' MB (' + percent + '%)'
      };
    }).catch(function(e) {
      return { supported: true, error: e.message || String(e) };
    });
  }

  return {
    open: open,
    assertWritable: _assertStorageWritable,
    writeOutcome: _writeOutcome, acknowledgeWriteOutcome: _acknowledgeWriteOutcome, whenWriteSettled: _whenWriteSettled,
    writeStatus: function() { return _writeSafety ? Object.assign({ blocked: true }, _writeSafety) : { blocked: false }; },
    diagnostics: function() { return _readDiagnostics.map(function(row) { return Object.assign({}, row); }); },
    save: save,
    saveManyAtomic: saveManyAtomic,
    createCanonicalPayload: createCanonicalPayload,
    clearPendingTurnDataPublishAtomic: clearPendingTurnDataPublishAtomic,
    saveChronicleRecord: saveChronicleRecord,
    listChronicleRecords: listChronicleRecords,
    listQuarantinedChronicleRecords: listQuarantinedChronicleRecords,
    importQuarantinedChronicleRecord: importQuarantinedChronicleRecord,
    pruneChronicleRecords: pruneChronicleRecords,
    saveTurnPublishReceipt: saveTurnPublishReceipt,
    listTurnPublishReceipts: listTurnPublishReceipts,
    deleteTurnPublishReceipt: deleteTurnPublishReceipt,
    load: load,
    list: list,
    delete: deleteSave,
    saveProject: saveProject,
    loadProject: loadProject,
    migrateFromLocalStorage: migrateFromLocalStorage,
    migrateFromOldDB: migrateFromOldDB,
    isAvailable: function() { return _available; },
    // R104 新增
    requestPersistent: requestPersistent,
    estimate: estimate
  };
})();

// 页面加载时立即打开数据库并迁移旧存档
TM_SaveDB.open().then(function() {
  if (TM_SaveDB.isAvailable()) {
    TM_SaveDB.migrateFromLocalStorage()
      .then(function() { return TM_SaveDB.migrateFromOldDB(); }) // 从旧数据库名(tianming_saves)迁移
      .catch(function(e) {
      console.error('[SaveDB] 迁移失败·旧源已保留:', e);
      try { if (window.TM && TM.errors && TM.errors.capture) TM.errors.capture(e, 'SaveDB migration'); } catch (_) {}
      try { if (typeof window.toast === 'function') window.toast('⚠️ 旧存档迁移失败，原数据已保留'); } catch (_) {}
    });
    // R104·自动申请持久化存储，扩大实际可用配额（从"best-effort"到"persistent"）
    TM_SaveDB.requestPersistent().then(function(r) {
      if (r.granted) {
        console.log('[SaveDB] 持久化存储已' + (r.alreadyPersisted ? '预先启用' : '获批'));
      } else if (r.supported) {
        console.log('[SaveDB] 持久化存储未获批·仍可正常使用(best-effort 模式)');
      }
    });
    // 启动时打印一次配额
    TM_SaveDB.estimate().then(function(e) {
      if (e.supported && !e.error) console.log('[SaveDB] 存储: ' + e.summary);
    });
  }
}).catch(function(e) {
  console.error('[SaveDB] 初始化失败:', e);
  try { if (typeof window.toast === 'function') window.toast('❌ 存档数据库初始化失败：' + (e && e.message || e)); } catch (_) {}
});
