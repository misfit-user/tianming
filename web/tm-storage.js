// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// IndexedDB 存储层 — 替代 localStorage 的 5MB 限制
// 两个 store：saves（游戏存档）+ projects（剧本项目P）
// 带 localStorage 回退
// ============================================================

// 7.1: 存档压缩——使用CompressionStream(gzip)
var SaveCompression = {
  supported: typeof CompressionStream !== 'undefined',
  decompressionSupported: typeof DecompressionStream !== 'undefined',

  compress: async function(jsonStr) {
    if (!this.supported) return jsonStr;
    try {
      var blob = new Blob([jsonStr]);
      var cs = new CompressionStream('gzip');
      var stream = blob.stream().pipeThrough(cs);
      var compressed = await new Response(stream).blob();
      return compressed;
    } catch(e) { console.warn('[SaveCompression] compress failed:', e); return jsonStr; }
  },

  decompress: async function(data) {
    if (data == null) throw new Error('存档数据为空');
    if (typeof data === 'string') return data; // 未压缩的旧存档（字符串）
    // Blob·ArrayBuffer·Uint8Array 等
    // 检查是否是 gzip 压缩（前两字节 0x1f 0x8b）
    var blob = data instanceof Blob ? data : new Blob([data]);
    var headBuf = await blob.slice(0, 2).arrayBuffer();
    var head = new Uint8Array(headBuf);
    var isGzip = head.length >= 2 && head[0] === 0x1f && head[1] === 0x8b;
    if (isGzip) {
      if (!this.decompressionSupported) {
        throw new Error('当前浏览器不支持 gzip 解压，无法读取该压缩存档');
      }
      var ds = new DecompressionStream('gzip');
      var stream = blob.stream().pipeThrough(ds);
      return await new Response(stream).text();
    }
    // 非 gzip 的 Blob/ArrayBuffer 是 UTF-8 文本旧档。严禁 String(ArrayBuffer)
    // 产生 "[object ArrayBuffer]" 后再被当成有效内容。
    if (typeof blob.text === 'function') return await blob.text();
    var bytes = new Uint8Array(await blob.arrayBuffer());
    if (typeof TextDecoder === 'undefined') throw new Error('当前环境缺少 UTF-8 解码器');
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  }
};

var TM_SaveDB = (function() {
  'use strict';

  var DB_NAME = 'tianming_db'; // 统一数据库名
  var DB_VERSION = 2; // v2: saves + projects 双store
  var SAVE_STORE = 'saves';
  var PROJECT_STORE = 'projects';
  var _db = null;
  var _available = false;
  var _openPromise = null; // 防止重复打开

  // ── 打开数据库 ──
  function open() {
    if (_db) return Promise.resolve(_db);
    if (_openPromise) return _openPromise;

    _openPromise = new Promise(function(resolve, reject) {
      if (!window.indexedDB) {
        console.warn('[SaveDB] IndexedDB不可用，回退localStorage');
        _available = false;
        resolve(null);
        return;
      }
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function(e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(SAVE_STORE)) {
          var s = db.createObjectStore(SAVE_STORE, { keyPath: 'id' });
          s.createIndex('timestamp', 'timestamp', { unique: false });
        }
        if (!db.objectStoreNames.contains(PROJECT_STORE)) {
          db.createObjectStore(PROJECT_STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = function(e) {
        _db = e.target.result;
        _available = true;
        _openPromise = null;
        console.log('[SaveDB] IndexedDB就绪 (v' + DB_VERSION + ')');
        resolve(_db);
      };
      req.onerror = function(e) {
        var err = e.target && e.target.error || new Error('IndexedDB 打开失败');
        console.error('[SaveDB] IndexedDB打开失败:', err);
        _available = false;
        _openPromise = null;
        reject(err);
      };
      req.onblocked = function() {
        _available = false;
        _openPromise = null;
        reject(new Error('IndexedDB 升级被其他页面阻塞'));
      };
    });
    return _openPromise;
  }

  // ── R103·quota 满时自动清最老 auto 存档（type='auto'），手动存档永不删 ──
  function _writeGuardAllows(writeGuard) {
    if (typeof writeGuard !== 'function') return true;
    try { return writeGuard() === true; }
    catch (_) { return false; }
  }

  function _dropOldestAutoSave(writeGuard) {
    if (!_writeGuardAllows(writeGuard)) return Promise.resolve(false);
    return _listAll(SAVE_STORE).then(function(records) {
      // 列表读取本身是异步的；失效请求不得为了一个已取消的写入删除仍可恢复的旧 autosave。
      if (!_writeGuardAllows(writeGuard)) return false;
      var autos = (records || []).filter(function(r){ return r.type === 'auto'; })
                                 .sort(function(a,b){ return (a.timestamp||0) - (b.timestamp||0); });
      if (autos.length === 0) return false; // 没 auto 可清
      var victim = autos[0];
      console.warn('[SaveDB] quota 满·清最老自动存档:', victim.id, 'ts=' + new Date(victim.timestamp||0).toLocaleString());
      return _del(SAVE_STORE, victim.id).then(function(){ return true; });
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
        return Promise.reject(e);
      }
    }
    return new Promise(function(resolve, reject) {
      try {
        var tx = _db.transaction(storeName, 'readwrite');
        var settled = false;
        tx.objectStore(storeName).put(record);
        tx.oncomplete = function() { if (!settled) { settled = true; resolve(true); } };
        function handleWriteFailure(e) {
          if (settled) return;
          settled = true;
          var err = e.target && e.target.error;
          var isQuota = err && (err.name === 'QuotaExceededError' || err.name === 'QuotaExceededError');
          if (isQuota && storeName === SAVE_STORE && !_retryCount) {
            if (!_writeGuardAllows(writeGuard)) { resolve(false); return; }
            console.warn('[SaveDB] 配额已满·尝试清最老自动存档后重试');
            _dropOldestAutoSave(writeGuard).then(function(dropped) {
              if (!_writeGuardAllows(writeGuard)) { resolve(false); return; }
              if (dropped) {
                // 重试（带 flag 防止无限递归）
                _put(storeName, record, 1, writeGuard).then(resolve, reject);
              } else {
                // 没 auto 可清·通知用户手动清理
                if (typeof window.toast === 'function') {
                  window.toast('❌ 存档空间满·请手动删除旧存档后重试');
                }
                resolve(false);
              }
            }).catch(reject);
          } else {
            console.error('[SaveDB] 写入失败:', err ? err.name + ':' + err.message : e);
            reject(err || new Error('IndexedDB 写入失败'));
          }
        }
        tx.onerror = handleWriteFailure;
        tx.onabort = handleWriteFailure;
      } catch(e) { console.error('[SaveDB] 事务失败:', e); reject(e); }
    });
  }

  // 多记录同事务提交；迁移只有在这一事务完整成功后才允许删除旧源。
  function _putManyAtomic(storeName, records) {
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
    return new Promise(function(resolve, reject) {
      try {
        var tx = _db.transaction(storeName, 'readwrite');
        var store = tx.objectStore(storeName);
        records.forEach(function(record) { store.put(record); });
        tx.oncomplete = function() { resolve(records.length); };
        tx.onerror = function(e) { reject(e.target && e.target.error || new Error('IndexedDB 批量写入失败')); };
        tx.onabort = function(e) { reject(e.target && e.target.error || new Error('IndexedDB 批量写入已中止')); };
      } catch (e) { reject(e); }
    });
  }

  // ── 通用读取 ──
  function _get(storeName, id) {
    if (!_available || !_db) {
      try {
        var raw = localStorage.getItem('tm_idb_' + storeName + '_' + id);
        return Promise.resolve(raw ? JSON.parse(raw) : null);
      } catch(e) { return Promise.reject(e); }
    }
    return new Promise(function(resolve, reject) {
      try {
        var tx = _db.transaction(storeName, 'readonly');
        var req = tx.objectStore(storeName).get(id);
        req.onsuccess = function() { resolve(req.result || null); };
        req.onerror = function(e) { reject(e.target && e.target.error || new Error('IndexedDB 读取失败')); };
        tx.onabort = function(e) { reject(e.target && e.target.error || tx.error || new Error('IndexedDB 读取事务已中止')); };
      } catch(e) { reject(e); }
    });
  }

  // ── 通用删除 ──
  function _del(storeName, id) {
    if (!_available || !_db) {
      try { localStorage.removeItem('tm_idb_' + storeName + '_' + id); } catch(e) { return Promise.reject(e); }
      return Promise.resolve(true);
    }
    return new Promise(function(resolve, reject) {
      try {
        var tx = _db.transaction(storeName, 'readwrite');
        tx.objectStore(storeName).delete(id);
        tx.oncomplete = function() { resolve(true); };
        tx.onerror = function(e) { reject(e.target && e.target.error || new Error('IndexedDB 删除失败')); };
        tx.onabort = function(e) { reject(e.target && e.target.error || tx.error || new Error('IndexedDB 删除事务已中止')); };
      } catch(e) { reject(e); }
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
    return new Promise(function(resolve, reject) {
      try {
        var tx = _db.transaction(storeName, 'readonly');
        var req = tx.objectStore(storeName).getAll();
        req.onsuccess = function() { resolve(req.result || []); };
        req.onerror = function(e) { reject(e.target && e.target.error || new Error('IndexedDB 列表读取失败')); };
        tx.onabort = function(e) { reject(e.target && e.target.error || tx.error || new Error('IndexedDB 列表事务已中止')); };
      } catch(e) { reject(e); }
    });
  }

  // ============================================================
  //  公开API：游戏存档
  // ============================================================

  /** 确保DB就绪后执行操作 */
  function _ensureOpen() {
    if (_db) return Promise.resolve();
    return open();
  }

  /** 保存游戏存档（7.1: 支持gzip压缩） */
  function save(id, gameState, meta, options) {
    options = options || {};
    function _writeStillAllowed() {
      if (typeof options.writeGuard !== 'function') return true;
      try { return options.writeGuard() === true; }
      catch (_) { return false; }
    }
    // 在调用栈内立即固化 JSON。_ensureOpen / gzip 都是异步；若延后 stringify，
    // selective snapshot 中安全复用的 append-only 引用可能在过回合期间继续增长，污染 pre_endturn 时点。
    var jsonStr;
    try { jsonStr = JSON.stringify(gameState); }
    catch (e) { return Promise.reject(e); }
    if (!_writeStillAllowed()) return Promise.resolve(false);
    return _ensureOpen().then(function() {
      return SaveCompression.compress(jsonStr).then(function(compressed) {
        var isCompressed = compressed !== jsonStr; // Blob vs string
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
          gameState: compressed,
          _compressed: isCompressed
        };
        if (isCompressed) {
          var origKB = (jsonStr.length / 1024).toFixed(1);
          console.log('[SaveDB] 存档压缩: ' + origKB + 'KB -> gzip Blob');
        }
        // 压缩/开库可能跨越读档或下一回合；真正开启写事务前再验一次租约。
        if (!_writeStillAllowed()) return false;
        return _put(SAVE_STORE, record, 0, _writeStillAllowed);
      });
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
      // 旧存档：gameState已经是对象，直接返回
      return record;
    });
  }

  /** 列出所有游戏存档（不含gameState大数据，仅元信息） */
  function list() {
    return _ensureOpen().then(function() {
      return _listAll(SAVE_STORE);
    }).then(function(records) {
      return records.map(function(r) {
        return { id:r.id, name:r.name, type:r.type, timestamp:r.timestamp, turn:r.turn, scenarioName:r.scenarioName, eraName:r.eraName, date:r.date||'', dynastyPhase:r.dynastyPhase||'', snapshotId:r.snapshotId||'', commitState:r.commitState||'' };
      }).sort(function(a,b) { return b.timestamp - a.timestamp; });
    });
  }

  /** 删除游戏存档 */
  function deleteSave(id) { return _ensureOpen().then(function() { return _del(SAVE_STORE, id); }); }

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

  function migrateFromLocalStorage() {
    if (!_available || !_db) return Promise.resolve(0);
    var candidates = [];
    for (var i = 0; i < 10; i++) {
      var key = 'tm_save_' + i;
      var raw = localStorage.getItem(key);
      if (!raw) continue;
      var data = JSON.parse(raw); // 任一源损坏即整体停止，绝不删除其他旧档。
      candidates.push({ key: key, data: data, index: i });
    }
    return Promise.all(candidates.map(function(item) {
      var data = item.data;
      return save('slot_' + item.index, data.gameState || data, {
        name: data.name || ('存档' + item.index),
        type: 'migrated',
        turn: (data.gameState && data.gameState.turn) || (data.GM && data.GM.turn) || 0,
        scenarioName: (data.scenarioName || '')
      });
    })).then(function(results) {
      if (results.some(function(ok) { return ok !== true; })) throw new Error('旧 localStorage 存档迁移未完整提交');
      candidates.forEach(function(item) { localStorage.removeItem(item.key); });
      if (candidates.length > 0) console.log('[SaveDB] 迁移了' + candidates.length + '个旧存档');
      return candidates.length;
    });
  }

  /** 从旧数据库名(tianming_saves)迁移到当前数据库(tianming_db) */
  function migrateFromOldDB() {
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
          _putManyAtomic(SAVE_STORE, records).then(function(migrated) {
            oldDb.close();
            console.log('[SaveDB] 从旧数据库迁移了' + migrated + '条记录');
            var delReq = indexedDB.deleteDatabase(OLD_DB);
            delReq.onsuccess = function() { resolve(migrated); };
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
    save: save,
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
    Promise.all([
      TM_SaveDB.migrateFromLocalStorage(),
      TM_SaveDB.migrateFromOldDB() // 从旧数据库名(tianming_saves)迁移
    ]).catch(function(e) {
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
