import { edit } from './patch-utils.mjs';
edit('web/tm-storage.js', (s, replace) => replace(s,
`    return new Promise(function(resolve, reject) {
      try {
        var tx = _db.transaction(storeName, 'readonly');
        var req = tx.objectStore(storeName).get(id);
        req.onsuccess = function() { resolve(req.result || null); };
        req.onerror = function(e) { reject(e.target && e.target.error || new Error('IndexedDB 读取失败')); };
        tx.onabort = function(e) { reject(e.target && e.target.error || tx.error || new Error('IndexedDB 读取事务已中止')); };
      } catch(e) { reject(e); }
    });`,
"    return _boundedStorageRead(storeName, 'record-read', function(store) { return store.get(id); }, null);"));
