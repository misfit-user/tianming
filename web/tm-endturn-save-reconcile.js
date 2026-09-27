// A late, genuine IDB terminal event may finish the existing transaction, never re-run the simulation.
(function(root) {
  'use strict';
  var TM = root.TM = root.TM || {}; TM.Endturn = TM.Endturn || {};
  if (TM.Endturn.SaveReconcile) return;
  var active = null, last = { state: 'idle' };
  function current(job) { return active === job && root.GM === job.gm && root.P === job.p && (root._tmLoadGen || 0) === job.generation && root.GM.turn === job.turn && [root.GM._campaignId, root.GM._timelineId].join("|") === job.world && !job.txn.committed && !job.txn.rolledBack; }
  function status() { return Object.assign({}, last); }
  async function check() {
    var job = active; if (!job || job.checking) return status();
    if (!current(job)) { if (job.dispose) job.dispose(); active = null; last = { state: 'stale' }; return status(); }
    var db = root.TM_SaveDB, outcome = job.confirmedOutcome || db && db.writeOutcome && db.writeOutcome(job.id);
    if (!outcome || outcome.outcome === 'unconfirmed') return status();
    job.confirmedOutcome = outcome;
    job.checking = true;
    try {
      if (outcome.outcome === 'committed') {
        var payload = job.ctx.meta.canonicalWorldPayload;
        if (!payload || typeof payload.json !== 'string') throw new Error('没有完整待提交状态，不能自动采用磁盘结果');
        var slots = await Promise.all(['autosave','slot_0'].map(function(id) { return db.load(id); }));
        if (!current(job)) throw new Error('核对期间世界已改变');
        if (!slots.every(function(row) { return row && JSON.stringify(row.gameState) === payload.json; })) throw new Error('双槽内容与本回合完整状态不一致，继续保留待核对状态');
        if (typeof job.ctx.meta.acceptReconciledCommit !== 'function') throw new Error('缺少提交回执接收入口');
        if (!job.acknowledged && !db.acknowledgeWriteOutcome(job.id)) throw new Error('还有其他未确认写入，不能解除保护');
        job.acknowledged = true;
        job.txn.saveWriteUnconfirmed = false; job.ctx.meta.saveWriteUnconfirmed = false;
        await job.ctx.meta.acceptReconciledCommit();
        job.ctx.meta.endTurnSavePromise = Promise.resolve(true);
        await root._tmFinalizeEndTurnTransaction(job.ctx, job.txn);
        last = { state: 'committed', verifiedSlots: 2 };
      } else if (outcome.outcome === 'aborted') {
        if (!job.acknowledged && !db.acknowledgeWriteOutcome(job.id)) throw new Error('还有其他未确认写入，不能解除保护');
        job.acknowledged = true;
        job.txn.saveWriteUnconfirmed = false; job.ctx.meta.saveWriteUnconfirmed = false;
        if (!root._tmRollbackEndTurnTransaction(job.txn, new Error('已确认原写事务中止'))) throw new Error('事务已中止，但恢复原世界失败');
        last = { state: 'aborted', restored: true };
        var doc = root.document, button = doc && (doc.getElementById('btn-end') || doc.getElementById('btn-end-turn'));
        if (button) { button.textContent = '\u9759\u5F85\u65F6\u53D8'; button.style.opacity = '1'; }
        if (typeof root._tmRequestEndTurnDesktopAutoSaveFlush === 'function') root._tmRequestEndTurnDesktopAutoSaveFlush('save-abort-reconciled');
      } else return status();
      if (job.dispose) job.dispose(); active = null;
      try { if (typeof root.toast === 'function') root.toast(last.state === 'committed' ? '已核对完整双槽，原回合已安全完成，无需重新推演。' : '已确认写事务中止并恢复原世界，可以重试。'); } catch (_) {}
    } catch (e) {
      if (job.txn.committed) { if (job.dispose) job.dispose(); active = null; last = { state: 'committed-display-pending', verifiedSlots: 2 }; return status(); }
      if (!job.txn.canonicalSaveReceipt && !job.txn.rolledBack) { job.txn.saveWriteUnconfirmed = true; job.ctx.meta.saveWriteUnconfirmed = true; }
      last = { state: 'verification-required', error: String(e.message || e).slice(0, 200) }; }
    finally { job.checking = false; }
    return status();
  }
  function watch(ctx, txn, error) {
    if (active && active.dispose) active.dispose();
    if (!ctx || !txn || !error || !error.storageOperationId || !(root.TM_SaveDB && root.TM_SaveDB.whenWriteSettled)) return false;
    var job = { ctx: ctx, txn: txn, id: error.storageOperationId, gm: root.GM, p: root.P, generation: root._tmLoadGen || 0, turn: root.GM.turn, world: [root.GM._campaignId, root.GM._timelineId].join('|'), checking: false };
    active = job; last = { state: 'awaiting-terminal-event' };
    job.dispose = root.TM_SaveDB.whenWriteSettled(job.id, function() { check(); });
    return true;
  }
  TM.Endturn.SaveReconcile = { watch: watch, check: check, status: status };
})(typeof window !== 'undefined' ? window : globalThis);
