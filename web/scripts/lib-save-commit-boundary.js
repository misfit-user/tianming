'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),acorn=require('acorn');
const ROOT=path.resolve(__dirname,'..');
const clone=x=>JSON.parse(JSON.stringify(x));
function loadFunctions(c,file,names,root=ROOT){
  const source=fs.readFileSync(path.join(root,file),'utf8'),found=new Map();
  function visit(n){if(!n||typeof n!=='object')return;if(n.type==='FunctionDeclaration'&&n.id)found.set(n.id.name,source.slice(n.start,n.end));for(const v of Object.values(n)){if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object')visit(v);}}
  visit(acorn.parse(source,{ecmaVersion:'latest'}));
  for(const name of names){if(!found.has(name))throw Error('Missing function '+name);vm.runInContext(found.get(name),c,{filename:file+':'+name});}
}
function renderFixture(root=ROOT){
  const events=[],disk=new Map(),markers=new Map();
  const c={console:{log(){},warn(...x){events.push('warning');}},Promise,Date,JSON,GM:{turn:4,sid:'fixture',_campaignId:'tmc_fixture',_timelineId:'tml_fixture_1234'},P:{},_tmLoadGen:0,TM:{},
    localStorage:{setItem(k,v){markers.set(k,v);},getItem:k=>markers.get(k)||null},
    _buildSaveState(){events.push('capture');return {GM:clone(c.GM),P:clone(c.P)};},
    _endTurn_stripCommittedDraftsFromSnapshot(){},_endTurn_stageTurnData:async()=>{events.push('stage');},
    _endTurn_discardStagedTurnData:async()=>{events.push('discard');},
    _clearPreEndturnMarkerAfterSave(){events.push('clear-marker');},_updateSaveIndex(){events.push('index');},
    StateSnapshot:{save:async()=>{events.push('snapshot');return {ok:true};}}};
  c.window=c;vm.createContext(c);
  c.TM_SaveDB={createCanonicalPayload:async state=>({state,json:JSON.stringify(state),compressed:JSON.stringify(state),checksum:'fixture'}),saveManyAtomic:async(entries,opts)=>{
    events.push('commit');entries.forEach(e=>disk.set(e.id,clone(e.gameState)));
    if(opts.onCommitted)opts.onCommitted({state:'committed',transactionId:opts.transactionId,slots:entries.map(e=>({id:e.id,turn:e.meta.turn,campaignId:e.gameState.GM._campaignId,timelineId:e.gameState.GM._timelineId}))});
    events.push('cleanup');return true;
  }};
  loadFunctions(c,'tm-endturn-render.js',['_endTurn_saveSnapshot'],root);
  const txn={transactionId:'txn-fixture',campaignId:c.GM._campaignId,timelineId:c.GM._timelineId,turn:3,gmRef:c.GM,pRef:c.P,committed:false,rolledBack:false};
  return {c,events,disk,markers,txn,ctx:{meta:{transactionId:txn.transactionId,transaction:txn}},save(ctx){return c._endTurn_saveSnapshot(ctx||this.ctx);}};
}
function storageFixture(root=ROOT){
  const events=[],disk=new Map(),local=new Map(),transactions=[];
  const c={console:{warn(){events.push('warning');}},Promise,Date,JSON,Set,Map,Object,setTimeout,clearTimeout,WRITE_WAIT_MS:60000,WRITE_ABORT_WAIT_MS:5000,_writeSafety:null,_writeSequence:0,_uncertainWrites:new Map(),_writeOutcomeListeners:new Map(),_storageDiagnostic(){},_available:true,SAVE_STORE:'saves',SAVE_META_STORE:'metadata',TURN_PUBLISH_RECEIPT_STORE:'receipts',LOCAL_SAVE_BATCH_JOURNAL:'batch-journal',
    _ensureOpen:async()=>{},_get:async()=>null,_writeGuardAllows:fn=>!fn||fn()===true,_toSaveMetadata:r=>({id:r.id,turn:r.turn,campaignId:r.campaignId,timelineId:r.timelineId}),
    _saveIdentityFromGameState:s=>({campaignId:s.GM._campaignId,timelineId:s.GM._timelineId}),
    _perfCount(){},_perfWithSpan:(_n,fn)=>fn(),_gcReplacedSaveTimelines:async()=>{events.push('cleanup');return true;},
    _normalizeTurnPublishReceipt:r=>r,_dropOldestAutoSave:async()=>false,
    createCanonicalPayload:async state=>({json:JSON.stringify(state),compressed:JSON.stringify(state)}),
    localStorage:{getItem:k=>local.get(k)||null,setItem:(k,v)=>local.set(k,v),removeItem:k=>local.delete(k)},
    _restoreLocalSaveBatchItems(items){for(const item of items){if(item.previous==null)local.delete(item.key);else local.set(item.key,item.previous);}}};
  c._db={transaction(){const staged=[];const tx={objectStore:name=>({put(record){staged.push([name+':'+record.id,clone(record)]);}}),
    complete(){for(const [k,v] of staged)disk.set(k,v);events.push('commit');tx.oncomplete&&tx.oncomplete();},
    abort(){tx.error=Object.assign(Error('injected abort'),{name:'AbortError'});tx.onabort&&tx.onabort({target:tx});}};transactions.push(tx);return tx;}};
  c.window=c;vm.createContext(c);
  c._openFailure=null;
  loadFunctions(c,'tm-storage.js',['_isDesktopStorage','_desktopStorageError','_publishWriteOutcome','_unconfirmedWriteError','_assertStorageWritable','_runStorageWrite','_retryStorageQuota','_putSaveRecordsAtomic','saveManyAtomic','_recoverLocalSaveBatchJournal'],root);
  const state={GM:{turn:4,_campaignId:'tmc_fixture',_timelineId:'tml_fixture_1234'},P:{}};
  const entries=['autosave','slot_0'].map(id=>({id,gameState:state,meta:{turn:4}}));
  return {c,events,disk,local,transactions,entries,save(opts={}){return c.saveManyAtomic(entries,{transactionId:'txn-fixture',...opts});}};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
module.exports={ROOT,clone,loadFunctions,renderFixture,storageFixture,tick};
