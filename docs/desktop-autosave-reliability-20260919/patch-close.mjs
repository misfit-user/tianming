import {edit} from './patch-utils.mjs';
edit('web/tm-save-close-flush.js',(s,r)=>{
  s=r(s,'  async function awaitDesktopAutoSave(reason){',"  function nativeWritePending(){return typeof _tmDesktopAutoSaveTransportStatus==='function'&&_tmDesktopAutoSaveTransportStatus().pending;}\n  async function awaitDesktopAutoSave(reason){");
  s=r(s,'    while (_autoSaveInFlightPromise||_autoSaveInFlight||_autoSaveDeferred) {','    while (_autoSaveInFlightPromise||_autoSaveInFlight||_autoSaveDeferred||nativeWritePending()) {\n      if(nativeWritePending()&&!_autoSaveInFlightPromise)return {ok:false,code:"desktop-autosave-unconfirmed",reason:"桌面自动存档仍有未确认的原生写入，不可当成已排空"};');
  s=r(s,'      if (!(result&&result.ok===true)) {','      if (!(result&&result.ok===true)||result.stale===true) {');
  return r(s,'&&!_autoSaveDeferred&&!_autoSaveFlushTimer&&!_autoSaveInFlight&&!_autoSaveInFlightPromise;','&&!_autoSaveDeferred&&!_autoSaveFlushTimer&&!_autoSaveInFlight&&!_autoSaveInFlightPromise&&!nativeWritePending();');
});
