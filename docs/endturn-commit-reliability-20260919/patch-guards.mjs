import { edit } from './patch-utils.mjs';
edit('web/tm-storage.js',(s,r)=>{
  s=r(s,'      return _gcReplacedSaveTimelines(previousMetadata, savedRecords);','      return Promise.resolve(_gcReplacedSaveTimelines(previousMetadata, savedRecords)).then(function() { return true; });');
  const a=s.indexOf('  function _putSaveRecordsAtomic('),b=s.indexOf('  // ── 通用写入',a);let fn=s.slice(a,b);
  fn=r(fn,'      } catch (error) { reject(error); }','      } catch (error) { try { if (tx) tx.abort(); } catch (_) {} reject(error); }');
  return r(s,s.slice(a,b),fn);
});
edit('web/tm-endturn-render.js',(s,r)=>{
  s=r(s,"if (typeof StateSnapshot === 'undefined' || !StateSnapshot || typeof StateSnapshot.save !== 'function') return null;","if (typeof StateSnapshot === 'undefined' || !StateSnapshot || typeof StateSnapshot.save !== 'function') return { ok: true, skipped: true };");
  return r(s,"        if (result !== null) _saveWarning('time-snapshot', result && result.error);","        _saveWarning('time-snapshot', result && result.error);");
});
