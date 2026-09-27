import { edit } from './patch-utils.mjs';
edit('web/tm-endturn-render.js',(s,r)=>r(s,"      console.warn('[AutoSave] post-turn save failed:', e);",`      console.warn('[AutoSave] post-turn save failed:', e);
      if (e && e.code === 'SAVE_WRITE_UNCONFIRMED' && !_canonicalCommitted) {
        ctx.meta.saveWriteUnconfirmed = true;
        if (ctx.meta.transaction) ctx.meta.transaction.saveWriteUnconfirmed = true;
        throw e; // Do not discard staged data or infer rollback before the storage result is known.
      }`));
edit('web/tm-endturn-core.js',(s,r)=>{
  s=r(s,'  var receipt = txn.canonicalSaveReceipt;','  if (txn.saveWriteUnconfirmed || reason && reason.code === "SAVE_WRITE_UNCONFIRMED") return false;\n  var receipt = txn.canonicalSaveReceipt;');
  s=r(s,'  if(GM.busy)return;','  if (typeof TM_SaveDB !== "undefined" && typeof TM_SaveDB.assertWritable === "function") TM_SaveDB.assertWritable();\n  if(GM.busy)return;');
  s=r(s,"    console.error('endTurn error:', error);",`    console.error('endTurn error:', error);
    if (error && error.code === 'SAVE_WRITE_UNCONFIRMED') {
      if (_turnTxn) _turnTxn.saveWriteUnconfirmed = true;
      if (_responseRecovery) _responseRecovery.finish(_turnTxn, 'unconfirmed', error);
      if (!_turnTxn || GM === _turnTxn.gmRef && P === _turnTxn.pRef) {
        GM.busy = true; // arch-ok end-turn owner freezes writes while canonical outcome is unknown
        GM._endTurnBusy = false; // arch-ok end-turn owner ends spinner without claiming a rollback
        var pausedButton = _$("btn-end") || _$("btn-end-turn");
        if (pausedButton) { pausedButton.textContent = '存档待核对'; pausedButton.style.opacity = '0.6'; }
        toast(error.message); hideLoading();
      }
      return; // Never re-run the turn or flush a desktop autosave over an unconfirmed write.
    }`);
  return s;
});
