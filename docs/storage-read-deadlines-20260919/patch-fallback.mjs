import { edit } from './patch-utils.mjs';
edit('web/tm-storage.js', (s, r) => {
  s = r(s, "    catch (journalError) { return Promise.reject(new Error('localStorage 批量存档恢复失败：' + (journalError && journalError.message || journalError))); }", "    catch (journalError) { var recoveryError = new Error('localStorage 批量存档恢复失败：' + (journalError && journalError.message || journalError)); recoveryError.code = 'SAVE_LOCAL_RECOVERY_FAILED'; return Promise.reject(recoveryError); }");
  s = r(s, "    return open().catch(function(error) {\n      // IndexedDB", "    return open().catch(function(error) {\n      if (error && (error.code === 'SAVE_OPEN_TIMEOUT' || error.code === 'SAVE_LOCAL_RECOVERY_FAILED')) throw error;\n      if (_db && _available) return _db;\n      if (_openPromise) return _openPromise;\n      // IndexedDB");
  return r(s, '    open: open,', '    open: open,\n    diagnostics: function() { return _readDiagnostics.map(function(row) { return Object.assign({}, row); }); },');
});
