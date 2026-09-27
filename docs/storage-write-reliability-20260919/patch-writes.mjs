import fs from 'node:fs';
import { parse } from 'acorn';
import { edit } from './patch-utils.mjs';
const quota=`  function _retryStorageQuota(error, enabled, retryCount, guard, ids, retry) {
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
`;
const replacements={};
replacements._putSaveRecord=`    return _runStorageWrite([SAVE_STORE, SAVE_META_STORE], 'single-save', function(tx) {
      tx.objectStore(SAVE_STORE).put(record);
      tx.objectStore(SAVE_META_STORE).put(metadata);
    }).catch(function(error) {
      return _retryStorageQuota(error, true, _retryCount, writeGuard, [record.id], function() { return _putSaveRecord(record, 1, writeGuard); });
    });
`;
replacements._putSaveRecordsAtomic=`    var txStores = [SAVE_STORE, SAVE_META_STORE];
    if (turnPublishReceipt) txStores.push(TURN_PUBLISH_RECEIPT_STORE);
    return _runStorageWrite(txStores, 'canonical-save', function(tx) {
      var payloadStore = tx.objectStore(SAVE_STORE), metadataStore = tx.objectStore(SAVE_META_STORE);
      records.forEach(function(record) { payloadStore.put(record); metadataStore.put(_toSaveMetadata(record)); });
      if (turnPublishReceipt) tx.objectStore(TURN_PUBLISH_RECEIPT_STORE).put(turnPublishReceipt);
    }).then(function() { committed(); return true; }).catch(function(error) {
      return _retryStorageQuota(error, true, _retryCount, writeGuard, records.map(function(record) { return record.id; }), function() { return _putSaveRecordsAtomic(records, writeGuard, 1, turnPublishReceipt, onCommitted); });
    });
`;
replacements._put=`    return _runStorageWrite(storeName, 'record-write', function(tx) {
      tx.objectStore(storeName).put(record);
    }).catch(function(error) {
      return _retryStorageQuota(error, storeName === SAVE_STORE, _retryCount, writeGuard, [record.id], function() { return _put(storeName, record, 1, writeGuard); });
    });
`;
replacements._putManyAtomic=`    var txStores = storeName === SAVE_STORE ? [SAVE_STORE, SAVE_META_STORE] : storeName;
    return _runStorageWrite(txStores, 'migration-batch', function(tx) {
      var store = tx.objectStore(storeName), metadataStore = storeName === SAVE_STORE ? tx.objectStore(SAVE_META_STORE) : null;
      records.forEach(function(record) { store.put(record); if (metadataStore) metadataStore.put(_toSaveMetadata(record)); });
    }).then(function() { return records.length; });
`;
replacements._del=`    return _runStorageWrite(storeName, 'record-delete', function(tx) { tx.objectStore(storeName).delete(id); });
`;
replacements._deleteSaveRecord=`    return _runStorageWrite([SAVE_STORE, SAVE_META_STORE], 'save-delete', function(tx) {
      tx.objectStore(SAVE_STORE).delete(id); tx.objectStore(SAVE_META_STORE).delete(id);
    });
`;
replacements._deleteMany=`    return _runStorageWrite(storeName, 'auxiliary-delete', function(tx) {
      var store = tx.objectStore(storeName); records.forEach(function(record) { store.delete(record.id); });
    }).then(function() { return records.length; });
`;
edit('web/tm-storage.js',(s,r)=>{
  const nodes=new Map();
  function visit(n){if(!n||typeof n!=='object')return;if(n.type==='FunctionDeclaration'&&n.id)nodes.set(n.id.name,n);for(const v of Object.values(n)){if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object')visit(v);}}
  visit(parse(s,{ecmaVersion:'latest'}));
  const changes=Object.keys(replacements).map(name=>{const n=nodes.get(name);if(!n)throw Error('Missing '+name);const old=s.slice(n.start,n.end),at=old.indexOf('    return new Promise(function(resolve, reject) {');if(at<0)throw Error('No transaction boundary '+name);return{old,next:old.slice(0,at)+replacements[name]+'  }'};});
  for(const change of changes)s=r(s,change.old,change.next);
  s=r(s,'  function _utf8ByteLength(text) {',fs.readFileSync('docs/storage-write-reliability-20260919/write-monitor.fragment.txt','utf8')+quota+'\n  function _utf8ByteLength(text) {');
  s=r(s,'  function _writeGuardAllows(writeGuard) {','  function _writeGuardAllows(writeGuard) {\n    _assertStorageWritable();');
  for(const name of ['_putManyAtomic(storeName, records)','_deleteMany(storeName, records)'])s=r(s,'  function '+name+' {','  function '+name+' {\n    _assertStorageWritable();');
  s=r(s,'    open: open,','    open: open,\n    assertWritable: _assertStorageWritable,\n    writeStatus: function() { return _writeSafety ? Object.assign({ blocked: true }, _writeSafety) : { blocked: false }; },');
  return r(s,'  // Only opening and readonly work are bounded here. Write commit semantics stay unchanged.','  // Opening and readonly operations retain their own independent deadlines.');
});
