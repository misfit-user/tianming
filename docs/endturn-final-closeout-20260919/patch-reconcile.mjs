import {edit} from './patch-utils.mjs';
edit('web/tm-storage.js',(s,r)=>{
 s=r(s,'  function _publishWriteOutcome(record, outcome) {\n    record.outcome = outcome;','  function _publishWriteOutcome(record, outcome) {\n    if (record.outcome !== "unconfirmed") return;\n    record.outcome = outcome;');
 s=r(s,"if (!row || !['committed','aborted'].includes(row.outcome)) return false;","if (!row || _uncertainWrites.size !== 1 || !['committed','aborted'].includes(row.outcome)) return false;");
 return r(s,'    assertWritable: _assertStorageWritable,','    assertWritable: _assertStorageWritable,\n    writeOutcome: _writeOutcome, acknowledgeWriteOutcome: _acknowledgeWriteOutcome, whenWriteSettled: _whenWriteSettled,');
});
edit('web/tm-endturn-render.js',(s,r)=>{
 const anchor='      var _autoWriteOptions = {';
 const code=`      ctx.meta.acceptReconciledCommit = async function() {
        if (!_endturnSaveStillCurrent()) throw new Error('核对后的保存不再属于当前世界');
        _acceptCommit({ state: 'committed', transactionId: String(ctx.meta.transactionId || ''), slots: ['autosave','slot_0'].map(function(id) {
          return { id: id, turn: _endturnSaveTurn, campaignId: _canonicalIdentity.campaignId, timelineId: _canonicalIdentity.timelineId };
        }) });
        if (!_canonicalCommitted) throw new Error('无法确认恢复后的主存档回执');
        await _snapshotTask;
        if (!_endturnSaveStillCurrent()) throw new Error('附加快照期间世界已变化');
        try { _clearPreEndturnMarkerAfterSave(_endturnSavePreId); } catch (_) {}
      };
`;
 return r(s,anchor,code+anchor);
});
edit('web/tm-endturn-core.js',(s,r)=>r(s,'      return; // Never re-run the turn or flush a desktop autosave over an unconfirmed write.',"      if (globalThis.TM && globalThis.TM.Endturn && globalThis.TM.Endturn.SaveReconcile) globalThis.TM.Endturn.SaveReconcile.watch(_obsCtx, _turnTxn, error);\n      return; // Never re-run the turn or flush a desktop autosave over an unconfirmed write."));
edit('web/index.html',(s,r)=>{const t=s.match(/<script src="tm-endturn-core\.js[^\"]*"><\/script>/)[0];return r(s,t,'<script src="tm-endturn-save-reconcile.js?v=20260919-complete"></script>\n'+t);});
