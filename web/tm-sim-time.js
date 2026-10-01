// Cumulative simulation time. GM keeps the clock; this module owns its writes.
(function (root) {
  'use strict';
  var TM = root.TM = root.TM || {};
  function fail(reason) { var e = new Error(reason); e.code = 'WORLD_TIME_INVALID'; throw e; }
  function configuredDays() {
    var t = root.P && root.P.time || {}, d = Number(t.daysPerTurn);
    if (!(d > 0)) d = t.perTurn === 'custom' ? Number(t.customDays) : ({ '1d': 1, '1w': 7, '1m': 30, '1s': 90, '1y': 365 })[t.perTurn] || parseInt(t.perTurn, 10) || 30;
    return Number.isFinite(d) && d > 0 ? d : 30;
  }
  function read(g) {
    g = g || root.GM; var s = g && g._tmTime;
    if (s && (s.version !== 1 || !Number.isFinite(s.currentDay) || !Array.isArray(s.segments))) fail('unsupported_or_invalid_simulation_clock');
    return s || null;
  }
  function ensure(g) {
    g = g || root.GM; if (!g) fail('simulation_world_missing');
    var s = read(g); if (s) return s;
    var t = Number(g.turn || 1), d = configuredDays();
    // Missing historical steps remain explicitly approximate. No past effects run.
    s = { version: 1, currentDay: Math.max(0, t - 1) * d, turn: t,
      legacy: { throughTurn: t, daysPerTurn: d, source: 'legacy_turn_contract', historyQuality: t > 1 ? 'unknown_step_history' : 'opening' },
      segments: [{ startTurn: t, startDay: Math.max(0, t - 1) * d, daysPerTurn: d }], receipts: {} };
    g._tmTime = s; return s;
  }
  function now(g) {
    g = g || root.GM; var s = read(g);
    return s ? s.currentDay : Math.max(0, Number(g && g.turn || 1) - 1) * configuredDays();
  }
  function dayAtTurn(g, turn) {
    g = g || root.GM; var s = read(g), t = Number(turn || 1);
    if (!s) return Math.max(0, t - 1) * configuredDays();
    if (t === s.turn) return s.currentDay;
    if (t < s.legacy.throughTurn) return Math.max(0, t - 1) * s.legacy.daysPerTurn;
    var segment = s.segments[0];
    s.segments.forEach(function (v) { if (v.startTurn <= t) segment = v; });
    if (t > s.turn) return s.currentDay + (t - s.turn) * configuredDays(); // Explicit forecast only.
    return segment.startDay + (t - segment.startTurn) * segment.daysPerTurn;
  }
  function lockedDays(g) {
    g = g || root.GM; var s = read(g), p = s && s.pending;
    if (!p) return null;
    if (p.status === 'prepared' && Number(g.turn) === p.fromTurn) return p.days;
    if (p.status === 'committed' && Number(g.turn) === p.toTurn && (g._endTurnBusy || g._endTurnCommitPending)) return p.days;
    return null;
  }
  function prepare(g) {
    g = g || root.GM; var s = ensure(g), t = Number(g.turn || 1);
    if (s.turn !== t) fail('simulation_turn_clock_mismatch');
    if (s.pending && s.pending.status === 'prepared') return s.pending;
    var days = configuredDays();
    s.pending = { id: 'time:' + t, fromTurn: t, toTurn: t + 1, fromDay: s.currentDay, toDay: s.currentDay + days, days: days, status: 'prepared' };
    return s.pending;
  }
  function commit(g, interval) {
    g = g || root.GM; var s = ensure(g), p = s.pending;
    if (!interval || !p || interval.id !== p.id || interval.fromDay !== p.fromDay || interval.toDay !== p.toDay) fail('simulation_interval_mismatch');
    if (s.receipts[p.id]) return { ok: true, duplicate: true, interval: s.receipts[p.id] };
    if (s.currentDay !== p.fromDay || s.turn !== p.fromTurn || (Number(g.turn) !== p.fromTurn && Number(g.turn) !== p.toTurn)) fail('simulation_interval_stale');
    var last = s.segments[s.segments.length - 1];
    if (last.daysPerTurn !== p.days) s.segments.push({ startTurn: p.fromTurn, startDay: p.fromDay, daysPerTurn: p.days });
    s.currentDay = p.toDay; s.turn = p.toTurn; p.status = 'committed';
    s.receipts[p.id] = { id: p.id, fromTurn: p.fromTurn, toTurn: p.toTurn, fromDay: p.fromDay, toDay: p.toDay, days: p.days };
    return { ok: true, interval: s.receipts[p.id] };
  }
  function discardPrepared(g, interval) {
    g = g || root.GM; var s = read(g), p = s && s.pending;
    if (!p || !interval || p.id !== interval.id || p.status !== 'prepared') return false;
    delete s.pending; return true;
  }
  TM.SimTime = { version: 1, read: read, ensure: ensure, now: now, dayAtTurn: dayAtTurn, prepare: prepare, commit: commit,
    discardPrepared: discardPrepared, lockedDays: lockedDays, configuredDays: configuredDays };
  if (root.GameHooks) root.GameHooks.on('enterGame:after', function () { if (root.GM) ensure(root.GM); }, 5);
})(typeof window !== 'undefined' ? window : globalThis);
