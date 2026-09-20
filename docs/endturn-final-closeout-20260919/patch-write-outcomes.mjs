import {edit} from './patch-utils.mjs';
edit('web/tm-storage.js',(s,r)=>{
 s=r(s,'  var _writeSafety = null;','  var _writeSafety = null, _writeSequence = 0, _uncertainWrites = new Map(), _writeOutcomeListeners = new Map();\n  function _publishWriteOutcome(record, outcome) {\n    record.outcome = outcome;\n    var listeners = _writeOutcomeListeners.get(record.id) || [];\n    _writeOutcomeListeners.delete(record.id);\n    listeners.forEach(function(fn) { Promise.resolve().then(function() { fn(Object.assign({}, record)); }).catch(function() {}); });\n  }');
 s=r(s,"error.code = 'SAVE_WRITE_UNCONFIRMED'; error.storageOutcome = 'unconfirmed'; error.stage = stage;","error.code = 'SAVE_WRITE_UNCONFIRMED'; error.storageOutcome = 'unconfirmed'; error.stage = stage;\n    if (_writeSafety) error.storageOperationId = _writeSafety.id;");
 s=r(s,'      var tx, timer, abortTimer, settled = false, cause = null, abortRequested = false;','      var tx, timer, abortTimer, settled = false, cause = null, abortRequested = false;\n      var outcomeRecord = { id: "write-" + (++_writeSequence), stage: stage, outcome: "pending", at: Date.now() };');
 s=r(s,"        _writeSafety = { stage: stage, outcome: 'unconfirmed', at: Date.now() };","        outcomeRecord.outcome = 'unconfirmed';\n        _uncertainWrites.set(outcomeRecord.id, outcomeRecord);\n        _writeSafety = outcomeRecord;");
 s=r(s,"if (settled) { try { _storageDiagnostic(stage, { code: 'SAVE_LATE_COMMIT' }, 'late-committed'); } catch (_) {} return; }","if (settled) { if (_uncertainWrites.has(outcomeRecord.id)) _publishWriteOutcome(outcomeRecord, 'committed'); try { _storageDiagnostic(stage, { code: 'SAVE_LATE_COMMIT' }, 'late-committed'); } catch (_) {} return; }");
 s=r(s,"if (settled) { try { _storageDiagnostic(stage, { code: 'SAVE_LATE_ABORT' }, 'late-aborted'); } catch (_) {} return; }","if (settled) { if (_uncertainWrites.has(outcomeRecord.id)) _publishWriteOutcome(outcomeRecord, 'aborted'); try { _storageDiagnostic(stage, { code: 'SAVE_LATE_ABORT' }, 'late-aborted'); } catch (_) {} return; }");
 const marker='  function _retryStorageQuota(error, enabled, retryCount, guard, ids, retry) {';
 const helper=`  function _writeOutcome(id) { var row = _uncertainWrites.get(String(id)); return row ? Object.assign({}, row) : null; }
  function _acknowledgeWriteOutcome(id) {
    var row = _uncertainWrites.get(String(id));
    if (!row || !['committed','aborted'].includes(row.outcome)) return false;
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
`;
 return r(s,marker,helper+marker);
});
