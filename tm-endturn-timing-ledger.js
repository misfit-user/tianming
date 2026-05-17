// @ts-check
// End-turn timing ledger.
(function(root) {
  if (!root) return;
  root.TM = root.TM || {};
  root.TM.Endturn = root.TM.Endturn || {};

  function _now() {
    return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  }

  function _wallNow() {
    return Date.now();
  }

  function _turn() {
    try { return (typeof GM !== 'undefined' && GM && GM.turn) ? GM.turn : 0; } catch(_) { return 0; }
  }

  function _ensureHistory(ledger) {
    try {
      if (typeof GM === 'undefined' || !GM) return;
      if (!Array.isArray(GM._endturnTimingHistory)) GM._endturnTimingHistory = [];
      var hist = GM._endturnTimingHistory;
      if (ledger && hist.indexOf(ledger) < 0) {
        hist.push(ledger);
        if (hist.length > 20) hist.splice(0, hist.length - 20);
      }
    } catch(_) {}
  }

  function _getLedger(ctx) {
    if (ctx && ctx.meta && ctx.meta.timingLedger) return ctx.meta.timingLedger;
    try {
      if (typeof GM !== 'undefined' && GM && GM._endturnTimingLedger) return GM._endturnTimingLedger;
    } catch(_) {}
    return null;
  }

  function startLedger(ctx, meta) {
    var t = _now();
    var ledger = {
      turn: _turn(),
      startedAt: _wallNow(),
      startMs: t,
      status: 'running',
      totalMs: 0,
      entries: [],
      steps: [],
      subcalls: [],
      background: [],
      queue: [],
      meta: meta || {}
    };
    if (ctx) {
      ctx.meta = ctx.meta || {};
      ctx.meta.timingLedger = ledger;
    }
    try { if (typeof GM !== 'undefined' && GM) GM._endturnTimingLedger = ledger; } catch(_) {}
    _ensureHistory(ledger);
    return ledger;
  }

  function mark(ctx, kind, data) {
    var ledger = _getLedger(ctx);
    if (!ledger) ledger = startLedger(ctx || null, { autoStarted: true });
    var entry = Object.assign({
      kind: kind || 'mark',
      turn: _turn(),
      at: _wallNow(),
      sinceStartMs: Math.max(0, _now() - (ledger.startMs || _now()))
    }, data || {});
    ledger.entries.push(entry);
    if (entry.kind === 'step') ledger.steps.push(entry);
    else if (entry.kind === 'subcall') ledger.subcalls.push(entry);
    else if (entry.kind === 'background') ledger.background.push(entry);
    else if (entry.kind === 'queue') ledger.queue.push(entry);
    return entry;
  }

  async function wrap(ctx, kind, label, fn, data) {
    var t0 = _now();
    try {
      var result = await fn();
      mark(ctx, kind, Object.assign({ label: label, ok: true, ms: _now() - t0 }, data || {}));
      return result;
    } catch(e) {
      mark(ctx, kind, Object.assign({
        label: label,
        ok: false,
        ms: _now() - t0,
        error: String(e && (e.message || e) || '')
      }, data || {}));
      throw e;
    }
  }

  function finishLedger(ctx, status, extra) {
    var ledger = _getLedger(ctx);
    if (!ledger) return null;
    ledger.status = status || 'done';
    ledger.finishedAt = _wallNow();
    ledger.totalMs = Math.max(0, _now() - (ledger.startMs || _now()));
    if (extra && typeof extra === 'object') {
      Object.keys(extra).forEach(function(k) { ledger[k] = extra[k]; });
    }
    _ensureHistory(ledger);
    return ledger;
  }

  root.TM.Endturn.Timing = {
    startLedger: startLedger,
    mark: mark,
    wrap: wrap,
    finishLedger: finishLedger,
    getLedger: _getLedger
  };
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
