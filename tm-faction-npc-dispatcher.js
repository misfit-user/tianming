// tm-faction-npc-dispatcher.js
// Unified scheduler for faction precision LLM jobs: eager batch + in-turn background jobs.
(function(global) {
  'use strict';

  var _timers = [];
  var DEFAULTS = {
    eagerDelayMs: 300,
    inTurnFirstDelayMs: 30000,
    inTurnRepeatDelayMs: 90000,
    inTurnMaxPerTurn: 8
  };

  function _safeNum(v) {
    var n = Number(v);
    return isFinite(n) ? n : 0;
  }

  function _now() {
    try { return Date.now(); } catch(_) { return 0; }
  }

  function _turn(opts) {
    opts = opts || {};
    return _safeNum(opts.turn) || _safeNum(global.GM && GM.turn) || 1;
  }

  function _conf() {
    var c = (global.P && P.conf) || {};
    return {
      eagerDelayMs: _safeNum(c.npcEagerDelayMs) || DEFAULTS.eagerDelayMs,
      inTurnFirstDelayMs: _safeNum(c.npcInTurnFirstDelayMs) || DEFAULTS.inTurnFirstDelayMs,
      inTurnRepeatDelayMs: _safeNum(c.npcInTurnRepeatDelayMs) || DEFAULTS.inTurnRepeatDelayMs,
      inTurnMaxPerTurn: _safeNum(c.npcInTurnMaxPerTurn) || DEFAULTS.inTurnMaxPerTurn
    };
  }

  function _enabled() {
    return !!(global.TM && TM.FactionNpcSettings && TM.FactionNpcSettings.isAiPrecisionEnabled
      && TM.FactionNpcSettings.isAiPrecisionEnabled()
      && TM.FactionNpcLlmDecision);
  }

  function _ensureTurnLedger(turn) {
    if (!global.GM) return null;
    turn = _safeNum(turn) || _turn();
    if (!GM._npcFactionAiTurnLedger || GM._npcFactionAiTurnLedger.turn !== turn) {
      GM._npcFactionAiTurnLedger = {
        turn: turn,
        createdAt: turn,
        sc16: null,
        dispatch: null,
        runs: {},
        actions: [],
        candidateRanks: [],
        notes: [],
        stats: {}
      };
    }
    if (!GM._npcFactionAiTurnLedger.stats) GM._npcFactionAiTurnLedger.stats = {};
    if (!Array.isArray(GM._npcFactionAiTurnLedger.actions)) GM._npcFactionAiTurnLedger.actions = [];
    if (!Array.isArray(GM._npcFactionAiTurnLedger.notes)) GM._npcFactionAiTurnLedger.notes = [];
    return GM._npcFactionAiTurnLedger;
  }

  function _ensureLedger(turn) {
    if (!global.GM) return null;
    if (!GM._npcFactionLlmDispatchLedger || GM._npcFactionLlmDispatchLedger.turn !== turn) {
      GM._npcFactionLlmDispatchLedger = {
        turn: turn,
        createdAt: turn,
        jobs: [],
        stats: { scheduled: 0, running: 0, applied: 0, partial: 0, noAction: 0, skipped: 0, failed: 0, canceled: 0 }
      };
    }
    var turnLedger = _ensureTurnLedger(turn);
    if (turnLedger) {
      turnLedger.dispatch = GM._npcFactionLlmDispatchLedger;
      turnLedger.stats.dispatch = GM._npcFactionLlmDispatchLedger.stats;
    }
    return GM._npcFactionLlmDispatchLedger;
  }

  function _record(turn, row) {
    var ledger = _ensureLedger(turn);
    if (!ledger) return null;
    var job = {
      id: row.id || ('npc-llm-' + turn + '-' + (ledger.jobs.length + 1)),
      turn: turn,
      source: row.source || '',
      attempt: row.attempt || '',
      status: row.status || 'scheduled',
      scheduledAt: row.scheduledAt || _now(),
      startedAt: row.startedAt || 0,
      finishedAt: row.finishedAt || 0,
      delayMs: _safeNum(row.delayMs),
      result: row.result || null,
      error: row.error || ''
    };
    ledger.jobs.push(job);
    ledger.stats.scheduled++;
    return job;
  }

  function _finish(job, status, result, error) {
    if (!job) return;
    var wasRunning = job.status === 'running';
    job.status = status;
    job.finishedAt = _now();
    job.result = result || null;
    job.error = error ? String(error && error.message || error) : '';
    var ledger = global.GM && GM._npcFactionLlmDispatchLedger;
    if (ledger && ledger.stats) {
      if (wasRunning) ledger.stats.running = Math.max(0, _safeNum(ledger.stats.running) - 1);
      if (status === 'applied') ledger.stats.applied++;
      else if (status === 'partial') ledger.stats.partial++;
      else if (status === 'completed_no_action') ledger.stats.noAction++;
      else if (status === 'failed') ledger.stats.failed++;
      else if (status === 'canceled') ledger.stats.canceled++;
      else ledger.stats.skipped++;
    }
  }

  function _classifyResult(result) {
    if (result && result.failed) return 'failed';
    if (result && result.skipped) return 'skipped';
    var applied = result && result.applied;
    var attempted = _safeNum(result && result.attempted);
    if (!attempted) attempted = _safeNum(result && result.attemptedActions);
    var rows = Array.isArray(result && result.results) ? result.results : [];
    if (rows.length && !attempted) attempted = rows.length;
    if (rows.length) {
      var appliedRows = rows.filter(function(row) {
        var r = row && (row.result || row);
        return r && (r.applied === true || _safeNum(r.applied) > 0 || _safeNum(r.appliedActions) > 0);
      }).length;
      if (appliedRows === 0 && attempted > 0) return 'completed_no_action';
      if (appliedRows > 0 && appliedRows < attempted) return 'partial';
      if (appliedRows > 0) return 'applied';
    }
    if (applied === true) return 'applied';
    if (typeof applied === 'number') {
      if (applied > 0 && attempted > applied) return 'partial';
      if (applied > 0) return 'applied';
      return attempted > 0 ? 'completed_no_action' : 'skipped';
    }
    if (attempted > 0) return 'completed_no_action';
    return result ? 'completed_no_action' : 'skipped';
  }

  function _removeTimer(rec) {
    if (!rec) return;
    _timers = _timers.filter(function(x) { return x !== rec; });
  }

  function _setTimer(turn, source, attempt, delay, runner) {
    var job = _record(turn, { source: source, attempt: attempt, status: 'scheduled', delayMs: delay });
    if (typeof global.setTimeout !== 'function') {
      _finish(job, 'failed', null, 'setTimeout unavailable');
      return null;
    }
    var rec = { id: null, source: source, job: job };
    var timer = global.setTimeout(function() {
      _removeTimer(rec);
      if (_turn() !== turn) {
        _finish(job, 'skipped', { reason: 'stale turn', currentTurn: _turn() });
        return;
      }
      job.status = 'running';
      job.startedAt = _now();
      var ledger = global.GM && GM._npcFactionLlmDispatchLedger;
      if (ledger && ledger.stats) ledger.stats.running++;
      var p;
      try {
        p = runner();
      } catch(e) {
        _finish(job, 'failed', null, e);
        return;
      }
      Promise.resolve(p).then(function(result) {
        var status = _classifyResult(result);
        _finish(job, status, result, null);
      }, function(e) {
        _finish(job, 'failed', null, e);
        try { console.warn('[npc-llm-dispatcher] ' + source + ' failed', e); } catch(_){}
      });
    }, delay);
    rec.id = timer;
    _timers.push(rec);
    return job;
  }

  function _cancelTimers(kind) {
    var keep = [];
    _timers.forEach(function(rec) {
      var shouldCancel = kind === 'all' || !kind || rec.source === kind;
      if (!shouldCancel) { keep.push(rec); return; }
      try { global.clearTimeout(rec.id); } catch(_){}
      if (rec.job && rec.job.status === 'scheduled') _finish(rec.job, 'canceled', { reason: 'rescheduled', source: rec.source });
    });
    _timers = keep;
  }

  function cancelInTurnTimers() {
    _cancelTimers('in-turn');
  }

  function cancelAllTimers() {
    _cancelTimers('all');
  }

  function scheduleInTurnRuns(opts) {
    opts = opts || {};
    cancelInTurnTimers();
    if (!_enabled()) return { scheduled: 0, reason: 'precision off', dispatcher: true };
    var conf = _conf();
    var turn = _turn(opts);
    var maxRuns = Math.max(0, Math.floor(_safeNum(opts.maxRuns) || conf.inTurnMaxPerTurn));
    var step = Math.max(0, conf.inTurnRepeatDelayMs - conf.inTurnFirstDelayMs);
    var scheduled = 0;
    for (var i = 1; i <= maxRuns; i++) {
      (function(attempt) {
        var delay = attempt === 1 ? conf.inTurnFirstDelayMs : conf.inTurnRepeatDelayMs + (attempt - 2) * step;
        _setTimer(turn, 'in-turn', attempt, delay, function() {
          if (!global.TM || !TM.FactionNpcInTurnDriver || typeof TM.FactionNpcInTurnDriver._runOneInTurn !== 'function') {
            return { skipped: true, reason: 'in-turn driver missing' };
          }
          return TM.FactionNpcInTurnDriver._runOneInTurn(turn, attempt);
        });
        scheduled++;
      })(i);
    }
    return { scheduled: scheduled, inTurnScheduled: scheduled, turn: turn, dispatcher: true };
  }

  function scheduleTurnRuns(opts) {
    opts = opts || {};
    cancelAllTimers();
    if (!_enabled()) return { scheduled: 0, reason: 'precision off', dispatcher: true };
    var conf = _conf();
    var turn = _turn(opts);
    var scheduled = 0;
    var eagerScheduled = 0;
    var inTurnScheduled = 0;
    if (global.TM && TM.FactionNpcSettings && TM.FactionNpcSettings.isEagerMode && TM.FactionNpcSettings.isEagerMode()) {
      var eagerDelay = _safeNum(opts.eagerDelayMs) || conf.eagerDelayMs;
      _setTimer(turn, 'eager', 'batch', eagerDelay, function() {
        if (!global.TM || !TM.FactionNpcLlmDecision || typeof TM.FactionNpcLlmDecision.decideAll !== 'function') {
          return { skipped: true, reason: 'decision module missing' };
        }
        return TM.FactionNpcLlmDecision.decideAll({ source: 'eager', turn: turn });
      });
      eagerScheduled = 1;
      scheduled++;
    }
    var maxRuns = Math.max(0, Math.floor(_safeNum(opts.maxRuns) || conf.inTurnMaxPerTurn));
    var step = Math.max(0, conf.inTurnRepeatDelayMs - conf.inTurnFirstDelayMs);
    for (var i = 1; i <= maxRuns; i++) {
      (function(attempt) {
        var delay = attempt === 1 ? conf.inTurnFirstDelayMs : conf.inTurnRepeatDelayMs + (attempt - 2) * step;
        _setTimer(turn, 'in-turn', attempt, delay, function() {
          if (!global.TM || !TM.FactionNpcInTurnDriver || typeof TM.FactionNpcInTurnDriver._runOneInTurn !== 'function') {
            return { skipped: true, reason: 'in-turn driver missing' };
          }
          return TM.FactionNpcInTurnDriver._runOneInTurn(turn, attempt);
        });
        inTurnScheduled++;
        scheduled++;
      })(i);
    }
    return { scheduled: scheduled, eagerScheduled: eagerScheduled, inTurnScheduled: inTurnScheduled, turn: turn, dispatcher: true };
  }

  function getDiagnostics(turn) {
    turn = _safeNum(turn) || _turn();
    var ledger = global.GM && GM._npcFactionLlmDispatchLedger;
    if (!ledger || ledger.turn !== turn) return { turn: turn, jobs: [], stats: { scheduled: 0, running: 0, applied: 0, partial: 0, noAction: 0, skipped: 0, failed: 0, canceled: 0 } };
    return ledger;
  }

  global.TM = global.TM || {};
  global.TM.FactionNpcDispatchQueue = {
    scheduleTurnRuns: scheduleTurnRuns,
    scheduleInTurnRuns: scheduleInTurnRuns,
    cancelInTurnTimers: cancelInTurnTimers,
    cancelAllTimers: cancelAllTimers,
    getDiagnostics: getDiagnostics,
    DEFAULTS: DEFAULTS
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = global.TM.FactionNpcDispatchQueue;
  }
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : globalThis));
