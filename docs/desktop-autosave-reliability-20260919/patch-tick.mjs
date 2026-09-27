import fs from 'node:fs'; import {edit} from './patch-utils.mjs';
edit('web/tm-save-lifecycle.js',(s,r)=>{
  s=r(s,'function _tmDesktopAutoSaveResultOk(result){',fs.readFileSync('docs/desktop-autosave-reliability-20260919/wait.fragment.txt','utf8')+'function _tmDesktopAutoSaveResultOk(result){');
  s=r(s,"  if (!_tmCommittedSnapshotMatchesLive()) {\n    return { ok: false, skipped: true, reason: 'no-committed-snapshot' };", "  if (_autoSaveNativePending) return { ok: false, pending: true, reason: 'native-write-unconfirmed', error: _tmDesktopAutoSaveWaitError('DESKTOP_AUTOSAVE_UNCONFIRMED') };\n  if (!_tmCommittedSnapshotMatchesLive()) {\n    return { ok: false, skipped: true, reason: 'no-committed-snapshot' };");
  s=r(s,'  var sourceIdentity = _lastCommittedSnapshotIdentity;',`  var sourceIdentity = _lastCommittedSnapshotIdentity;
  var targetGM=GM,targetP=P,targetGeneration=window._tmLoadGen||0,bridge=window.tianming;
  function snapshotStillCurrent(){return GM===targetGM&&P===targetP&&(window._tmLoadGen||0)===targetGeneration
    &&window.tianming===bridge&&lastCommittedSnapshot===sourceSnapshot&&_lastCommittedSnapshotIdentity===sourceIdentity
    &&_tmCommittedSnapshotMatchesLive();}`);
  s=r(s,"      var result = typeof window.tianming.autoSaveJson === 'function'\n        ? await window.tianming.autoSaveJson(JSON.stringify(saveData))\n        : await window.tianming.autoSave(saveData);",`      var result = await _tmAwaitDesktopAutoSaveReply(function(){
        if(!snapshotStillCurrent()||isWorldTransactionActive())throw _tmDesktopAutoSaveWaitError('DESKTOP_AUTOSAVE_STALE');
        if(typeof bridge.autoSaveJson==='function'){
          var json=JSON.stringify(saveData);
          if(!snapshotStillCurrent()||isWorldTransactionActive())throw _tmDesktopAutoSaveWaitError('DESKTOP_AUTOSAVE_STALE');
          return bridge.autoSaveJson(json);
        }
        return bridge.autoSave(saveData);
      });`);
  s=r(s,'      if (lastCommittedSnapshot !== sourceSnapshot || _lastCommittedSnapshotIdentity !== sourceIdentity\n          || !_tmCommittedSnapshotMatchesLive()) {','      if (!snapshotStillCurrent()) {');
  s=r(s,'      _autoSaveLastDoneMs = Date.now();',"      if (result && result.sessionToken && String(result.sessionToken)!==String(sourceIdentity.sessionToken)) throw _tmDesktopAutoSaveWaitError('DESKTOP_AUTOSAVE_STALE');\n      _autoSaveLastDoneMs = Date.now();");
  return r(s,'  window._tmRunDesktopAutoSaveTick = _tmRunDesktopAutoSaveTick;','  window._tmRunDesktopAutoSaveTick = _tmRunDesktopAutoSaveTick;\n  window._tmDesktopAutoSaveTransportStatus = _tmDesktopAutoSaveTransportStatus;');
});
