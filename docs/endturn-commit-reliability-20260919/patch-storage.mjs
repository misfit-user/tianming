import { edit } from './patch-utils.mjs';
edit('web/tm-storage.js',(s,r)=>{
  s=r(s,'  function _putSaveRecordsAtomic(records, writeGuard, _retryCount, turnPublishReceipt) {','  function _putSaveRecordsAtomic(records, writeGuard, _retryCount, turnPublishReceipt, onCommitted) {');
  const start=s.indexOf('  function _putSaveRecordsAtomic('),end=s.indexOf('  // ── 通用写入',start);
  if(start<0||end<0)throw Error('Atomic write boundary missing');
  let fn=s.slice(start,end);
  fn=r(fn,'    if (!records.length) return Promise.resolve(false);',`    if (!records.length) return Promise.resolve(false);
    function committed() {
      try { if (typeof onCommitted === 'function') onCommitted(records); }
      catch (error) { try { console.warn('[SaveDB] 已提交存档的通知失败:', error); } catch (_) {} }
    }`);
  fn=r(fn,"        journal.phase = 'committed';\n        localStorage.setItem(LOCAL_SAVE_BATCH_JOURNAL, JSON.stringify(journal));\n        localStorage.removeItem(LOCAL_SAVE_BATCH_JOURNAL);",`        journal.phase = 'committed';
        localStorage.setItem(LOCAL_SAVE_BATCH_JOURNAL, JSON.stringify(journal));
        committed();
        try { localStorage.removeItem(LOCAL_SAVE_BATCH_JOURNAL); }
        catch (cleanupError) { try { console.warn('[SaveDB] 已提交日志留待下次清理:', cleanupError); } catch (_) {} }`);
  fn=fn.replaceAll('_putSaveRecordsAtomic(records, writeGuard, 1, turnPublishReceipt)','_putSaveRecordsAtomic(records, writeGuard, 1, turnPublishReceipt, onCommitted)');
  fn=r(fn,'tx.oncomplete = function() { if (!settled) { settled = true; resolve(true); } };','tx.oncomplete = function() { if (!settled) { settled = true; committed(); resolve(true); } };');
  s=r(s,s.slice(start,end),fn);
  return s;
});
edit('web/tm-storage.js',(s,r)=>{
  const start=s.indexOf('  function saveManyAtomic(entries, options) {'),end=s.indexOf('  /** v4 以前',start);
  if(start<0||end<0)throw Error('Batch save boundary missing');
  let fn=s.slice(start,end);
  fn=r(fn,'    options = options || {};',`    options = options || {};
    var committed = false, commitObserver = typeof options.onCommitted === 'function' ? options.onCommitted : null;
    var transactionId = String(options.transactionId || '');
    function observedCommit(records) {
      if (committed) return;
      committed = true;
      var slots = records.map(function(record) { return Object.freeze({ id: record.id, turn: record.turn, campaignId: record.campaignId, timelineId: record.timelineId }); });
      var receipt = Object.freeze({ state: 'committed', transactionId: transactionId, slots: Object.freeze(slots) });
      try { if (commitObserver) commitObserver(receipt); }
      catch (error) { try { console.warn('[SaveDB] 提交通知失败，主存档仍已提交:', error); } catch (_) {} }
    }`);
  fn=r(fn,'return _putSaveRecordsAtomic(records, _writeStillAllowed, 0, frozenTurnPublishReceipt);','return _putSaveRecordsAtomic(records, _writeStillAllowed, 0, frozenTurnPublishReceipt, observedCommit);');
  fn=r(fn,`    }).then(function(saved) {
      if (saved !== true) return saved;
      return _gcReplacedSaveTimelines(previousMetadata, savedRecords);
    });`, `    }).then(function(saved) {
      if (saved !== true && !committed) return saved;
      observedCommit(savedRecords);
      return _gcReplacedSaveTimelines(previousMetadata, savedRecords);
    }).catch(function(error) {
      if (!committed) throw error;
      try { console.warn('[SaveDB] 主存档已提交，后处理失败:', error); } catch (_) {}
      return true;
    });`);
  return r(s,s.slice(start,end),fn);
});
