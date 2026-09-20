import { edit } from './patch-utils.mjs';
edit('web/scripts/lib-save-commit-boundary.js',(s,r)=>{
  s=r(s,'const c={console:{warn(){events.push(\'warning\');}},Promise,Date,JSON,Set,Map,Object,_available:true,','const c={console:{warn(){events.push(\'warning\');}},Promise,Date,JSON,Set,Map,Object,setTimeout,clearTimeout,WRITE_WAIT_MS:60000,WRITE_ABORT_WAIT_MS:5000,_writeSafety:null,_storageDiagnostic(){},_available:true,');
  return r(s,"['_putSaveRecordsAtomic','saveManyAtomic','_recoverLocalSaveBatchJournal']","['_unconfirmedWriteError','_assertStorageWritable','_runStorageWrite','_retryStorageQuota','_putSaveRecordsAtomic','saveManyAtomic','_recoverLocalSaveBatchJournal']");
});
edit('web/scripts/smoke-runtime-save-consistency.js',(s,r)=>{
  const at=s.indexOf('let allowed = true, writeAttempts = 0, committed = 0, deletes = 0;');
  if(at<0)throw Error('Lease fixture missing');
  const tail=s.slice(at),original='      const tx = {};';
  if(!tail.includes(original))throw Error('Fixture transaction missing');
  return r(s,tail,tail.replace(original,"      const tx = { abort() { if (tx.onabort) tx.onabort({ target: tx }); } }; // Model the real terminal abort after request error."));
});
