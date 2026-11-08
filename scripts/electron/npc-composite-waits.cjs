'use strict';
// Injected only by the formal Electron test. Original UI producers still own all
// execution and return their original Promises; this observes their completion.
function installCompositeWaits(root, deadlineAt, clock) {
  if (!Number.isFinite(deadlineAt)) throw Error('composite suite deadline missing');
  clock = clock || { now: () => Date.now(), setTimeout: (fn, ms) => root.setTimeout(fn, ms), clearTimeout: id => root.clearTimeout(id) };
  const records = new Map(), active = new Map(); let sequence = 0;
  function state() {
    const g = root.GM || {};
    return { turn: Number(g.turn), day: Number(root.TM.SimTime.now(g)), load: Number(root._tmLoadGen || 0), campaignId: String(g._campaignId || ''),
      timelineId: String(g._timelineId || ''), busy: !!(g.busy || g._endTurnBusy), pending: !!g._endTurnCommitPending, running: g.running === true };
  }
  function summary(r) {
    return { id: r.id, kind: r.kind, slot: r.slot, invocations: r.invocations, status: r.status,
      before: r.before, after: r.after || null, commit: r.commit || null, result: r.result === true,
      error: r.error || null, deadlineAt, startedAt: r.startedAt || null, finishedAt: r.finishedAt || null };
  }
  function finish(r, error, result) {
    if (r.finished) return;
    if (clock.now() >= deadlineAt) error = Error('composite suite deadline exceeded');
    r.finished = true; r.finishedAt = clock.now(); r.status = error ? 'failed' : 'completed';
    r.error = error ? String(error.message || error) : null; r.result = result === true;
    r.world = null; // Never retain a completed operation's GM/P through test history.
    clock.clearTimeout(r.timer); r.timer = null;
    if (error) r.reject(Error(r.kind + ': ' + r.error)); else r.resolve(summary(r));
    r.resolve = r.reject = null;
  }
  function sameWorld(r) {
    const s = state();
    return r.world && root.GM === r.world.gm && root.P === r.world.p && s.load === r.before.load
      && s.campaignId === r.before.campaignId && s.timelineId === r.before.timelineId;
  }
  function settled(r, value) {
    if (r.finished) return;
    try {
      r.after = state();
      if (r.kind === 'load') {
        if (value !== true || root.GM === r.world.gm || r.after.load <= r.before.load || !r.after.running
            || r.after.campaignId !== r.before.campaignId || r.after.turn !== r.before.turn || r.after.busy || r.after.pending) {
          throw Error('load producer did not confirm the expected recovered world');
        }
      } else {
        if (!sameWorld(r)) throw Error('producer crossed its original world');
        if (r.after.busy || r.after.pending) throw Error('producer settled before a confirmed idle commit');
        if (r.kind === 'turn' && (!r.commit || r.after.turn <= r.before.turn)) throw Error('turn producer has no genuine commit');
        if (r.kind === 'save' && (value !== true || r.after.turn !== r.before.turn)) throw Error('save producer did not return a true commit receipt');
      }
      finish(r, null, r.kind === 'turn' ? true : value);
    } catch (error) { finish(r, error); }
  }
  function observe(owner, key, kind) {
    const original = owner && owner[key];
    if (typeof original !== 'function') throw Error('composite producer missing: ' + key);
    owner[key] = function() {
      const r = active.get(kind);
      if (r) {
        r.invocations++;
        if (r.invocations !== 1) {
          if (r.finished) { r.status = 'failed'; r.error = 'duplicate UI producer invocation'; }
          else finish(r, Error('duplicate UI producer invocation'));
        }
        else if (!sameWorld(r)) finish(r, Error('UI producer started in another world'));
        else if (kind !== 'turn' && arguments[0] !== r.slot) finish(r, Error('UI producer used the wrong slot'));
        else { r.status = 'pending'; r.startedAt = clock.now(); }
      }
      let promise;
      try { promise = original.apply(this, arguments); }
      catch (error) { if (r && !r.finished) finish(r, error); throw error; }
      if (r && !r.finished) {
        if (!promise || typeof promise.then !== 'function') finish(r, Error('UI producer did not return its Promise'));
        else promise.then(value => settled(r, value), error => finish(r, error));
      }
      return promise;
    };
  }
  observe(root, '_endTurnInternal', 'turn');
  observe(root, 'saveToSlot', 'save');
  observe(root.SaveManager, 'loadFromSlot', 'load');
  const originalCommit = root._tmCommitEndTurnTransaction;
  if (typeof originalCommit !== 'function') throw Error('composite commit producer missing');
  root._tmCommitEndTurnTransaction = function(txn) {
    const result = originalCommit.apply(this, arguments), r = active.get('turn');
    if (r && !r.finished && r.invocations === 1 && result === true) {
      const receipt = txn && txn.canonicalSaveReceipt;
      const valid = sameWorld(r) && txn.committed === true && !txn.rolledBack && !txn.saveWriteUnconfirmed
        && txn.gmRef === root.GM && txn.pRef === root.P && txn.loadGen === r.before.load
        && Number(txn.turn) === r.before.turn && txn.campaignId === r.before.campaignId && txn.timelineId === r.before.timelineId
        && receipt && receipt.state === 'committed' && receipt.transactionId === txn.transactionId
        && Array.isArray(receipt.slots) && receipt.slots.length === 2
        && ['autosave', 'slot_0'].every(id => receipt.slots.some(slot => slot.id === id
          && slot.campaignId === r.before.campaignId && slot.timelineId === r.before.timelineId));
      if (!valid || r.commit) finish(r, Error('invalid or repeated canonical turn commit'));
      else r.commit = { transactionId: String(txn.transactionId), turn: state().turn, load: state().load, campaignId: r.before.campaignId,
        timelineId: r.before.timelineId, slots: ['autosave', 'slot_0'] };
    }
    return result;
  };
  return {
    arm(kind, slot) {
      if (!['turn', 'save', 'load'].includes(kind)) throw Error('unknown composite producer');
      if (clock.now() >= deadlineAt) throw Error('composite suite deadline exceeded');
      const previous = active.get(kind);
      if (previous && !previous.finished) throw Error('previous composite producer is still pending');
      if (Array.from(records.values()).some(r => r.status === 'failed')) throw Error('an observed composite producer failed');
      const r = { id: ++sequence, kind, slot: kind === 'turn' ? null : slot, before: state(),
        world: { gm: root.GM, p: root.P }, invocations: 0, status: 'armed', finished: false };
      r.done = new Promise((resolve, reject) => { r.resolve = resolve; r.reject = reject; });
      r.done.catch(() => {}); // UI confirmation may still be open when the shared deadline expires.
      r.timer = clock.setTimeout(() => finish(r, Error('composite suite deadline exceeded')), deadlineAt - clock.now());
      records.set(r.id, r); active.set(kind, r); return r.id;
    },
    wait(id) {
      const r = records.get(id); if (!r) return Promise.reject(Error('unknown composite producer ticket'));
      if (clock.now() >= deadlineAt) { if (!r.finished) finish(r, Error('composite suite deadline exceeded')); return Promise.reject(Error('composite suite deadline exceeded')); }
      if (r.status === 'failed') return Promise.reject(Error(r.kind + ': ' + r.error));
      return r.done;
    },
    snapshot() { return Array.from(records.values(), summary); }
  };
}
// Test-only observations keep primitive samples, never an old world or context.
function installCompositeEconomyObservers(root, calls) {
  function state() {
    const g = root.GM;
    return { turn: Number(g.turn), day: Number(root.TM.SimTime.now(g)), load: Number(root._tmLoadGen || 0),
      campaignId: String(g._campaignId || ''), timelineId: String(g._timelineId || '') };
  }
  function sample(key) {
    const p = root.GM.provinceStats && root.GM.provinceStats[key];
    if (!p) return null;
    const result = {};
    for (const field of ['population', 'wealth', 'stability', 'development', 'corruption', 'unrest']) result[field] = Number.isFinite(p[field]) ? p[field] : null;
    return result;
  }
  for (const [key, bucket] of [['_endTurn_updateSystems', 'systems'], ['updateProvinceEconomy', 'provinceEconomy']]) {
    const original = root[key];
    if (typeof original !== 'function' || !Array.isArray(calls[bucket])) throw Error('composite economy producer missing: ' + key);
    root[key] = function() {
      const entry = state(), row = { ...entry, beforeDay: entry.day, days: Number(root._getDaysPerTurn()), status: 'pending' };
      if (bucket === 'provinceEconomy') { row.province = Object.keys(root.GM.provinceStats || {}).sort()[0]; row.before = sample(row.province); }
      calls[bucket].push(row); // Record entry even when production throws or swallows its own error later.
      function finish(failed, error) {
        try {
          row.afterWorld = state(); row.afterDay = row.afterWorld.day;
          if (bucket === 'provinceEconomy') row.after = sample(row.province);
          row.status = failed ? 'failed' : 'completed'; row.error = failed ? String(error && error.message || error) : null;
        } catch (observationError) { row.status = 'failed'; row.error = String(observationError.message || observationError); }
      }
      let result;
      try { result = original.apply(this, arguments); }
      catch (error) { finish(true, error); throw error; }
      if (result && typeof result.then === 'function') result.then(() => finish(false), error => finish(true, error));
      else finish(false);
      return result;
    };
  }
}

// The completed UI turns are the independent expected set. Equal observer counts
// alone cannot detect a systems/economy pair that was both omitted.
function reconcileCompositeEconomy(tickets, calls) {
  function requireThat(value, message) { if (!value) throw Error('composite economy: ' + message); }
  function validState(s) {
    return s && Number.isInteger(s.turn) && Number.isInteger(s.load) && s.load >= 0 && Number.isFinite(s.day)
      && typeof s.campaignId === 'string' && s.campaignId.length > 0 && typeof s.timelineId === 'string' && s.timelineId.length > 0;
  }
  function worldKey(s) { return JSON.stringify([s.load, s.campaignId, s.timelineId]); }
  function key(s) { return JSON.stringify([s.load, s.campaignId, s.timelineId, s.turn]); }
  requireThat(Array.isArray(tickets) && calls && Array.isArray(calls.systems) && Array.isArray(calls.provinceEconomy), 'missing observations');
  const turns = tickets.filter(row => row.kind === 'turn'), seenBefore = new Set(), seenAfter = new Set(), seenIds = new Set();
  requireThat(turns.length > 0, 'no completed top-level turns');
  requireThat(calls.systems.length === turns.length && calls.provinceEconomy.length === turns.length, 'each top-level turn needs exactly one systems and economy entry');
  const intervals = turns.map(ticket => {
    const before = ticket.before, after = ticket.after;
    requireThat(Number.isInteger(ticket.id) && ticket.id > 0 && ticket.status === 'completed' && ticket.invocations === 1 && ticket.result === true && ticket.commit, 'turn ticket is not a genuine single completion');
    requireThat(validState(before) && validState(after) && worldKey(before) === worldKey(after) && after.turn === before.turn + 1, 'turn crossed its world or skipped a turn');
    requireThat(key(ticket.commit) === key(after), 'commit identity does not match the completed turn');
    requireThat(!seenIds.has(ticket.id) && !seenBefore.has(key(before)) && !seenAfter.has(key(after)), 'duplicate completed turn ticket');
    seenIds.add(ticket.id); seenBefore.add(key(before)); seenAfter.add(key(after));
    const days = after.day - before.day;
    requireThat(Number.isFinite(days) && days > 0, 'turn interval must have positive elapsed days');
    const systems = calls.systems.filter(row => key(row) === key(before));
    const economy = calls.provinceEconomy.filter(row => key(row) === key(after));
    requireThat(systems.length === 1 && economy.length === 1, 'missing or duplicate turn/world settlement');
    const system = systems[0], province = economy[0];
    for (const row of [system, province]) {
      requireThat(row.status === 'completed' && row.error === null, 'settlement is pending or failed');
      requireThat(validState(row) && validState(row.afterWorld) && key(row.afterWorld) === key(after), 'settlement crossed its world or turn');
      requireThat(row.days > 0 && row.days === days, 'settlement days do not match the actual turn interval');
      requireThat(row.afterDay === after.day && row.afterWorld.day === after.day, 'settlement end day does not match the completed turn');
    }
    requireThat(system.day === before.day && system.beforeDay === before.day, 'systems start day does not match the completed turn');
    requireThat(province.day === after.day && province.beforeDay === after.day, 'economy did not run after the actual time commit');
    requireThat(province.before && province.after, 'province source samples are missing');
    return { ticketId: ticket.id, beforeTurn: before.turn, afterTurn: after.turn, load: before.load,
      campaignId: before.campaignId, timelineId: before.timelineId, beforeDay: before.day, afterDay: after.day, days };
  });
  return { turns: turns.length, systems: calls.systems.length, provinceEconomy: calls.provinceEconomy.length, intervals };
}
// Observe the final review/save tail without starting, retrying or cancelling work.
async function waitForCompositeBackground(root, deadlineAt, observedSince, clock) {
  clock = clock || { now: () => Date.now(), setTimeout: (fn, ms) => root.setTimeout(fn, ms), clearTimeout: id => root.clearTimeout(id) };
  function demand(value, message) { if (!value) throw Error('composite final background: ' + message); }
  demand(Number.isFinite(deadlineAt) && Number.isFinite(observedSince), 'shared deadline and final turn start are required');
  demand(clock.now() < deadlineAt, 'suite deadline exceeded');
  demand(root.TM && root.TM.RecoveryReview && typeof root.TM.RecoveryReview.status === 'function'
    && typeof root.isWorldTransactionActive === 'function' && typeof root.requestAnimationFrame === 'function'
    && typeof root.cancelAnimationFrame === 'function', 'observation modules unavailable');
  const fields = ['_backgroundSavePending', '_backgroundSaveInFlight', '_backgroundSaveTimer', '_autoSaveInFlight', '_autoSaveInFlightPromise',
    '_autoSaveFlushTimer', '_autoSaveDeferred', '_autoSaveNativePending', '_autoSaveCommittedRevision', '_autoSaveLastSavedRevision',
    '_autoSaveLastSavedTurn', '_autoSaveLastDoneMs', '_lastCommittedSnapshotIdentity', 'lastCommittedSnapshot', 'lastCommittedTurn',
    'lastCommittedTransactionId', '_tmAutoSaveSessionToken', '_tmLoadGen'];
  fields.forEach(key => demand(key in root && root[key] !== undefined, 'missing observation field ' + key));
  demand(root.__compositeCalls && Array.isArray(root.__compositeCalls.fixtureErrors), 'fixture error observations unavailable');
  function read() {
    const g = root.GM, identity = root._lastCommittedSnapshotIdentity;
    demand(g && root.P && typeof root._autoSaveInFlight === 'boolean' && typeof root._autoSaveDeferred === 'boolean', 'world or save flags unavailable');
    const review = root.TM.RecoveryReview.status(); demand(Array.isArray(review), 'review status unavailable');
    const jobs = [].concat(g._postTurnJobs && g._postTurnJobs.pending || [], g._postTurnDetachedJobs || []).map(job => ({
      id: String(job.id || ''), status: String(job.status || ''), attempts: Number(job.attempts || 0),
      turn: Number(job.lease && job.lease.turn || job.sourceTurn || 0), load: Number(job.lease && job.lease.loadGen || 0),
      settled: /^(done|failed|retryable)$/.test(job.status || ''), hasPromise: !!(job.promise && typeof job.promise.then === 'function')
    }));
    const failures = (g._backgroundSaveFailures || []).map(row => ({ turn: Number(row.turn), at: Number(row.at),
      attempts: Number(row.attempts), reasons: Array.from(row.reasons || [], String), message: String(row.message || '') }));
    let lastReview = null;
    for (let i = (g.shijiHistory || []).length - 1; i >= 0; i--) {
      const row = g.shijiHistory[i]; if (Number(row.turn) !== Number(g.turn) - 1) continue;
      const r = row.agentReview; lastReview = { turn: Number(row.turn), status: r ? String(r.status || '') : 'unrecorded',
        verified: !!(r && r.verified), calls: Number(r && r.calls || 0), reason: String(r && r.reason || '') }; break;
    }
    return {
      world: { turn: Number(g.turn), day: Number(root.TM.SimTime.now(g)), load: Number(root._tmLoadGen), campaignId: String(g._campaignId || ''),
        timelineId: String(g._timelineId || ''), sessionToken: String(root._tmAutoSaveSessionToken || ''), running: g.running === true },
      transactionActive: root.isWorldTransactionActive(), review: review.map(row => ({ id: String(row.id), phase: String(row.phase), calls: Number(row.calls || 0) })),
      background: { pending: !!root._backgroundSavePending, inFlight: !!root._backgroundSaveInFlight, timer: root._backgroundSaveTimer !== null },
      desktop: { inFlight: root._autoSaveInFlight, promise: !!root._autoSaveInFlightPromise, timer: root._autoSaveFlushTimer !== null,
        deferred: root._autoSaveDeferred, nativePending: root._autoSaveNativePending !== null,
        nativeTimedOut: !!(root._autoSaveNativePending && root._autoSaveNativePending.timedOut) },
      canonical: { present: !!(root.lastCommittedSnapshot && root.lastCommittedSnapshot.GM && root.lastCommittedSnapshot.P), revision: Number(root._autoSaveCommittedRevision), turn: Number(root.lastCommittedTurn),
        transactionId: String(root.lastCommittedTransactionId || ''), identity: identity ? { campaignId: String(identity.campaignId || ''),
          timelineId: String(identity.timelineId || ''), sessionToken: String(identity.sessionToken || ''), load: Number(identity.loadGeneration),
          turn: Number(identity.turn), transactionId: String(identity.transactionId || '') } : null },
      saved: { revision: Number(root._autoSaveLastSavedRevision), turn: Number(root._autoSaveLastSavedTurn), at: Number(root._autoSaveLastDoneMs) },
      requiredJobs: jobs.filter(job => /^(sc25|sc25c)$/.test(job.id)), otherJobs: jobs.filter(job => !/^(sc25|sc25c)$/.test(job.id)),
      lastReview, failures, fixtureErrors: root.__compositeCalls.fixtureErrors.length
    };
  }
  function ready(s) {
    const w = s.world, c = s.canonical, i = c.identity;
    return w.running && !s.transactionActive && !s.review.length && !Object.values(s.background).some(Boolean)
      && !Object.values(s.desktop).some(Boolean) && s.requiredJobs.every(job => job.settled)
      && c.present && Number.isInteger(c.revision) && c.revision > 0 && c.turn === w.turn && c.transactionId
      && i && i.campaignId === w.campaignId && i.timelineId === w.timelineId && i.sessionToken === w.sessionToken
      && w.campaignId && w.timelineId && w.sessionToken && i.load === w.load && i.turn === w.turn && i.transactionId === c.transactionId
      && s.saved.revision === c.revision && s.saved.turn === w.turn && s.saved.at > 0;
  }
  function transportEvents() {
    return Array.isArray(root._autoSaveTransportEvents) ? root._autoSaveTransportEvents.map(row => [String(row.phase || ''), Number(row.at)]) : null;
  }
  const startedAt = clock.now(), first = read(), anchor = JSON.stringify(first.world), priorFailures = new Set(first.failures.map(row => JSON.stringify(row)));
  let timer, frame = null, last = first, previousReady = '', lastLogged = '', observations = 0;
  const producerReceipts = [];
  function emit(phase, s, error) {
    const signature = JSON.stringify(s); if (phase === 'observing' && signature === lastLogged) return;
    lastLogged = signature; observations++;
    // The bridge caps each renderer log line at 2500 characters. Fragments
    // preserve complete machine evidence even when detached-job metadata grows.
    const payload = JSON.stringify({ phase, at: clock.now(), deadlineAt, observedSince, state: s, producerReceipts, error: error || null });
    for (let offset = 0; offset < payload.length; offset += 1000) {
      if (root.console && root.console.info) root.console.info('COMPOSITE_FINAL_BACKGROUND ' + JSON.stringify({ phase, observation: observations,
        part: offset / 1000, parts: Math.ceil(payload.length / 1000), payload: payload.slice(offset, offset + 1000) }));
    }
  }
  const deadline = new Promise((resolve, reject) => { timer = clock.setTimeout(() => reject(Error('composite final background: suite deadline exceeded')), deadlineAt - clock.now()); });
  try {
    while (true) {
      demand(clock.now() < deadlineAt, 'suite deadline exceeded'); last = read(); emit('observing', last);
      demand(JSON.stringify(last.world) === anchor, 'world changed while observing final work');
      demand(last.fixtureErrors === 0, 'late fixture protocol failure');
      demand(!last.failures.some(row => !priorFailures.has(JSON.stringify(row)) || !Number.isFinite(row.at) || row.at >= observedSince), 'final background canonical save failed');
      const signature = JSON.stringify(last), complete = ready(last);
      if (complete && signature === previousReady) {
        emit('settled', last); return { status: 'settled', scope: 'final-review-and-save', startedAt, finishedAt: clock.now(), observedSince, deadlineAt, observations, producerReceipts, state: last };
      }
      previousReady = complete ? signature : '';
      // Existing producers retain ownership. Never call a drain/retry/save API.
      const existing = [{ kind: 'canonical', promise: root._backgroundSaveInFlight },
        { kind: 'desktop', promise: root._autoSaveInFlightPromise, revision: last.canonical.revision, transport: transportEvents(), observedAt: clock.now() }];
      [].concat(root.GM._postTurnJobs && root.GM._postTurnJobs.pending || [], root.GM._postTurnDetachedJobs || []).forEach(job => {
        if (/^(sc25|sc25c)$/.test(job.id) && !/^(done|failed|retryable)$/.test(job.status)) existing.push({ kind: job.id, promise: job.promise });
      });
      const pending = existing.filter(entry => entry.promise && typeof entry.promise.then === 'function');
      if (pending.length) {
        const outcomes = await Promise.race([Promise.allSettled(pending.map(entry => entry.promise)), deadline]);
        outcomes.forEach((outcome, index) => {
          const kind = pending[index].kind, value = outcome.value;
          const receipt = { kind, status: outcome.status, ok: !!(value && value.ok === true),
            stale: !!(value && value.stale === true), deferred: !!(value && value.deferred === true), skipped: !!(value && value.skipped === true),
            error: outcome.status === 'rejected' ? String(outcome.reason && outcome.reason.message || outcome.reason) : value && value.error ? String(value.error.message || value.error) : null,
            errorCode: String(value && value.error && value.error.code || ''), superseded: false };
          producerReceipts.push(receipt);
          if (kind === 'canonical' || kind === 'desktop') {
            const retryScheduled = kind === 'canonical' && outcome.status === 'fulfilled' && value && value.ok === false && !!root._backgroundSavePending;
            const knownNoWrite = kind === 'canonical' && outcome.status === 'fulfilled' && value && value.ok === false && !receipt.error
              && (receipt.stale || receipt.deferred || receipt.skipped);
            if (kind === 'desktop' && outcome.status === 'fulfilled' && value && value.ok === false && receipt.errorCode === 'DESKTOP_AUTOSAVE_STALE') {
              const next = read(), identity = next.canonical.identity;
              const prior = pending[index].transport, transport = transportEvents(), event = transport && transport[transport.length - 1];
              // The same error code also protects a foreign success reply.
              // Only one provably new rejected event establishes this no-send path.
              const rejectedBeforeDispatch = !!(prior && transport && prior.length <= 12 && transport.length === Math.min(12, prior.length + 1)
                // A wrapped ring with a repeated tail cannot prove how many entries were evicted.
                && (prior.length < 12 || prior.filter(row => row[0] === prior[11][0] && row[1] === prior[11][1]).length === 1)
                && event && event[0] === 'rejected' && Number.isFinite(event[1]) && event[1] >= pending[index].observedAt
                && (!prior.length || event[1] > prior[prior.length - 1][1])
                && JSON.stringify(transport.slice(0, -1)) === JSON.stringify(prior.slice(Math.max(0, prior.length - 11))));
              receipt.transportEvidence = { before: prior, after: transport, rejectedBeforeDispatch };
              const newFlush = next.desktop.deferred || next.desktop.timer || (next.desktop.inFlight
                && root._autoSaveInFlightPromise && root._autoSaveInFlightPromise !== pending[index].promise);
              receipt.superseded = !!(rejectedBeforeDispatch && JSON.stringify(next.world) === anchor && next.canonical.revision > pending[index].revision && newFlush
                && identity && identity.campaignId === next.world.campaignId && identity.timelineId === next.world.timelineId
                && identity.sessionToken === next.world.sessionToken && identity.load === next.world.load && identity.turn === next.world.turn
                && identity.transactionId === next.canonical.transactionId);
              if (receipt.superseded) { receipt.fromRevision = pending[index].revision; receipt.toRevision = next.canonical.revision; }
            }
            demand(receipt.ok || retryScheduled || knownNoWrite || receipt.superseded, kind + ' save producer did not confirm success');
          }
        });
      }
      await Promise.race([new Promise(resolve => { frame = root.requestAnimationFrame(() => { frame = null; resolve(); }); }), deadline]);
    }
  } catch (error) { emit('failed', last, String(error.message || error)); throw error; }
  finally { clock.clearTimeout(timer); if (frame !== null) root.cancelAnimationFrame(frame); }
}
module.exports = { installCompositeWaits, installCompositeEconomyObservers, reconcileCompositeEconomy, waitForCompositeBackground };
