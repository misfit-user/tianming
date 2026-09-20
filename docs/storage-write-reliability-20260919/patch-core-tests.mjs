import { edit } from './patch-utils.mjs';
edit('web/scripts/smoke-storage-write-reliability.js',(s,r)=>r(s,'(async()=>{',`test('actual turn entry pauses an unconfirmed save without rollback or desktop flush',async()=>{
  const f=renderFixture(),c=f.c;let restored=0,flushed=0,notice='';
  c.console.error=()=>{};c._$=()=>null;c.showLoading=()=>{};c.hideLoading=()=>{};c.toast=text=>{notice=text;};
  c._tmCaptureEndTurnTransaction=()=>f.txn;c._tmCapturePreEndTurnCommittedState=()=>({});
  c._tmPrepareEndTurnBoundary=async()=>{throw Object.assign(Error('存档待核对'),{code:'SAVE_WRITE_UNCONFIRMED'});};
  c._tmRollbackEndTurnTransaction=()=>{restored++;};c._tmRequestEndTurnDesktopAutoSaveFlush=()=>{flushed++;};
  loadFunctions(c,'tm-endturn-core.js',['_endTurnCore']);await c._endTurnCore({});
  assert.equal(restored,0);assert.equal(flushed,0);assert.equal(f.txn.saveWriteUnconfirmed,true);assert.equal(c.GM.busy,true);assert.equal(notice,'存档待核对');
});
(async()=>{`));
