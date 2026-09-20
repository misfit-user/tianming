import fs from 'node:fs';
import { edit } from './patch-utils.mjs';
edit('web/tm-endturn-render.js',(s,r)=>{
  const start=s.indexOf('function _endTurn_saveSnapshot(ctx) {'),end=s.indexOf('// 世界态变更摘要',start);
  if(start<0||end<0)throw Error('Save entry boundary missing');
  let fn=s.slice(start,end);
  fn=r(fn,'  ctx = ctx || { meta: {} };','  ctx = ctx || { meta: {} };\n  ctx.meta = ctx.meta || {};');
  fn=r(fn,'    var _canonicalCommitted = false;','    var _canonicalCommitted = false;\n'+fs.readFileSync('docs/endturn-commit-reliability-20260919/save-helpers.fragment.txt','utf8'));
  fn=r(fn,'        writeGuard: _endturnSaveStillCurrent,','        writeGuard: _endturnSaveStillCurrent,\n        onCommitted: _acceptCommit,');
  const a=fn.indexOf("      if (_writeOk !== true)"),b=fn.indexOf('      // 两个 canonical 槽位',a);
  if(a<0||b<0)throw Error('Post-commit tail missing');
  fn=r(fn,fn.slice(a,b),`      if (_writeOk !== true && !_canonicalCommitted) throw new Error('canonical 回合存档未原子落库');
      if (!_canonicalCommitted) _acceptCommit({ state: 'committed', transactionId: String(ctx.meta.transactionId || ''), slots: ['autosave', 'slot_0'].map(function(id) {
        return { id: id, turn: _endturnSaveTurn, campaignId: _canonicalIdentity.campaignId, timelineId: _canonicalIdentity.timelineId };
      }) });
      if (!_endturnSaveStillCurrent()) { ctx.meta.stagedTurnData = null; return false; }
      await _snapshotTask;
      if (!_endturnSaveStillCurrent()) { ctx.meta.stagedTurnData = null; return false; }
`);
  fn=r(fn,'      } else {\n        // 世界已与 receipt 同事务落库；',`      } else {
        _saveWarning('post-commit', e);
        await _snapshotTask;
        if (_endturnSaveStillCurrent()) return true;
        // 世界已与 receipt 同事务落库；`);
  return r(s,s.slice(start,end),fn);
});
