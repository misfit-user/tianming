import { edit } from './patch-utils.mjs';
edit('web/tm-storage.js', (s, r) => {
  const from = s.indexOf('  function _listByIndex('), to = s.indexOf('  function _deleteMany(', from);
  if (from < 0 || to < 0) throw Error('Expected index-read boundary');
  return r(s, s.slice(from, to), `  function _listByIndex(storeName, indexName, key) {
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

`);
});
