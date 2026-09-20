import { edit } from './patch-utils.mjs';
edit('web/tm-endturn-core.js',(s,r)=>{
  s=r(s,"  if (pendingResult && typeof showTurnResult === 'function') showTurnResult(pendingResult.html, pendingResult.idx);",`  if (pendingResult && typeof showTurnResult === 'function') {
    try { showTurnResult(pendingResult.html, pendingResult.idx); }
    catch (displayError) { txn.presentationError = displayError; try { _tmReportEndTurnBoundaryError(displayError, 'committed result display'); } catch (_) {} }
  }`);
  s=r(s,"  if (!_tmEndTurnTransactionCurrent(txn)) return false;\n  var rollbackLease",`  if (!_tmEndTurnTransactionCurrent(txn)) return false;
  var receipt = txn.canonicalSaveReceipt;
  if (receipt && receipt.state === 'committed' && receipt.transactionId === txn.transactionId && Array.isArray(receipt.slots)
      && receipt.slots.length === 2 && ['autosave', 'slot_0'].every(function(id) { return receipt.slots.some(function(slot) {
        return slot.id === id && slot.campaignId === txn.campaignId && slot.timelineId === txn.timelineId;
      }); })) return false;
  var rollbackLease`);
  s=r(s,'    var adopted = _tmAdoptCommittedWorldSnapshot(', '    var adopted = false;\n    try { adopted = _tmAdoptCommittedWorldSnapshot(');
  s=r(s,"      ctx.meta.canonicalWorldSnapshotMeta || { turn: GM.turn, transactionId: ctx.meta.transactionId, takeOwnership: true }\n    );", "      ctx.meta.canonicalWorldSnapshotMeta || { turn: GM.turn, transactionId: ctx.meta.transactionId, takeOwnership: true }\n    ); } catch (adoptionError) { _tmReportEndTurnBoundaryError(adoptionError, 'desktop autosave baseline'); }");
  return r(s,'  if (reliability) reliability.finish(ctx.meta.reliabilityScope,',`  var saveWarnings = ctx.meta.turnSaveWarnings || [];
  if (saveWarnings.length) {
    ctx.results = ctx.results || {}; ctx.results.turnSaveWarnings = saveWarnings;
    try { if (typeof toast === 'function') toast('回合已完整保存；附加快照或存档后处理发生错误，详情见控制台。请勿为此重新推演本回合。'); } catch (_) {}
  }
  if (reliability) reliability.finish(ctx.meta.reliabilityScope,`);
});
