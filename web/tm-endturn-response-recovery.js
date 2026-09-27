// Exact-response checkpoints for a failed turn in the same loaded runtime.
// Never replays world mutations, bypasses validators, or truncates model output.
(function(root) {
  'use strict';
  var TM = root.TM = root.TM || {};
  TM.Endturn = TM.Endturn || {};
  if (TM.Endturn.ResponseRecovery) return;
  var active = null, retained = null, last = null, sequence = 0;
  var LIMITS = { entries: 64, responseChars: 1000000, totalChars: 8000000, inputChars: 32000000, requestChars: 1000000, identityChars: 8000000, ttlMs: 30 * 60000 };
  function generation() { return root._tmLoadGen || 0; }
  function current(s) {
    return !!s && root.GM === s.gm && root.P === s.p && generation() === s.generation
      && [s.gm._campaignId, s.gm._timelineId].join('|') === s.world;
  }
  function eligible() { return active && active.state === 'running' && current(active) ? active : null; }
  function failed(code) { var e = new Error('回合恢复对应的操作已取消或世界已改变'); e.code = code || 'AI_STALE_WORLD'; if (e.code === 'AI_ABORTED') e.name = 'AbortError'; return e; }
  async function digest(value) {
    if (!root.crypto || !root.crypto.subtle || typeof root.TextEncoder !== 'function') return null;
    var bytes = new root.TextEncoder().encode(value);
    var hashed, timer;
    try { hashed = await Promise.race([root.crypto.subtle.digest('SHA-256', bytes), new Promise(function(_, reject) { timer = setTimeout(function() { reject(new Error('恢复指纹校验未完成，继续原请求路径')); }, 3000); })]); }
    finally { clearTimeout(timer); }
    return Array.from(new Uint8Array(hashed), function(b) { return b.toString(16).padStart(2, '0'); }).join('');
  }
  function baseline(txn, options) {
    var gm = Object.assign({}, txn.gm.data);
    ['busy', '_endTurnBusy', '_endTurnCommitPending', '_lastEndTurnRollback'].forEach(function(k) { delete gm[k]; });
    return JSON.stringify({ version: 1, gm: gm, p: txn.p.data,
      scenario: txn.p.descriptors && txn.p.descriptors.scenario && txn.p.descriptors.scenario.value,
      postTurnCourt: options && options.postTurnCourt });
  }
  async function begin(txn, options) {
    var previous = retained, start = ++sequence;
    retained = null; active = null;
    if (!txn || !txn.gm || !txn.p) return false;
    try {
      var input = baseline(txn, options);
      if (input.length > LIMITS.inputChars) { last = { state: 'disabled', reason: 'input_size' }; return false; }
      var fingerprint = await digest(input);
      if (!fingerprint || start !== sequence || root.GM !== txn.gmRef || root.P !== txn.pRef || generation() !== txn.loadGen) return false;
      var persisted = null, vault = TM.Endturn.RecoveryVault;
      if (!previous && vault) persisted = await vault.load(fingerprint, [root.GM._campaignId, root.GM._timelineId].join('|'));
      if (start !== sequence || root.GM !== txn.gmRef || root.P !== txn.pRef || generation() !== txn.loadGen) return false;
      if (persisted) previous = { fingerprint: persisted.fingerprint, gm: root.GM, p: root.P, generation: generation(), at: persisted.at, records: new Map(persisted.records) };
      var age = previous ? Date.now() - previous.at : Infinity;
      var reuse = previous && previous.fingerprint === fingerprint && previous.gm === root.GM && previous.p === root.P
        && previous.generation === generation() && age >= 0 && age <= LIMITS.ttlMs ? previous.records : null;
      active = { txn: txn, gm: root.GM, p: root.P, generation: generation(), fingerprint: fingerprint,
        world: [root.GM._campaignId, root.GM._timelineId].join('|'), at: reuse ? previous.at : Date.now(), state: 'running',
        records: new Map(), reuse: reuse, ordinals: new Map(), chars: 0, identityChars: 0, hits: 0, stored: 0, skipped: 0 };
      last = { state: 'running', available: reuse ? reuse.size : 0, hits: 0 };
      return true;
    } catch (_) { last = { state: 'disabled', reason: 'fingerprint_unavailable' }; return false; }
  }
  function safeFailure(e) {
    if (!e || e.writebackFailures || e.validity) return false;
    var detail = e.code === 'agent-run-failed' && e.meta && e.meta.transportFailure || e;
    var code = String(detail.code || ''), status = Number(detail.status) || 0;
    return /^(AI_TIMEOUT|AI_REQUEST_DEADLINE|AI_QUEUE_TIMEOUT|AI_RETRY_BUDGET|tool-timeout)$/.test(code)
      || status === 408 || status === 429 || status >= 500 && status <= 599;
  }
  function finish(txn, outcome, e) {
    var s = active;
    if (!s || s.txn !== txn) return;
    s.state = outcome; s.ordinals.clear(); s.reuse = null;
    var canKeep = outcome === 'failed' && txn.rolledBack === true && !txn.committed
      && root.GM === s.gm && root.P === s.p && root.GM.turn === txn.turn && safeFailure(e);
    retained = canKeep && s.records.size ? { gm: s.gm, p: s.p, generation: generation(),
      fingerprint: s.fingerprint, world: s.world, at: s.at, records: s.records } : null;
    last = { state: retained ? 'ready' : outcome, available: retained ? retained.records.size : 0,
      hits: s.hits, stored: s.stored, skipped: s.skipped, reason: e ? String(e.code || e.name || '').slice(0, 80) : '' };
    active = null;
    var vault = TM.Endturn.RecoveryVault;
    if (vault) {
      if (retained) return vault.save({ version: 1, fingerprint: retained.fingerprint, world: retained.world, at: retained.at, records: Array.from(retained.records) });
      return vault.clear(s.fingerprint);
    }
  }
  function lossless(value) {
    var invalid = false;
    var encoded = JSON.stringify(value, function(k, v) {
      if (typeof v === 'number' && (!Number.isFinite(v) || Object.is(v, -0))) invalid = true;
      if (typeof v === 'undefined' || typeof v === 'function' || typeof v === 'symbol') invalid = true;
      var original = this && this[k];
      if (original && typeof original === 'object' && !Array.isArray(original) && Object.prototype.toString.call(original) !== '[object Object]') invalid = true;
      return v;
    });
    return invalid ? null : encoded;
  }
  function remember(s, key, encoded) {
    if (s.records.has(key)) return;
    if (encoded.length > LIMITS.responseChars || s.records.size >= LIMITS.entries || s.chars + encoded.length > LIMITS.totalChars) { s.skipped++; return; }
    s.records.set(key, encoded); s.chars += encoded.length; s.stored++;
  }
  function status() {
    if (active) return { state: active.state, hits: active.hits, stored: active.stored, available: active.reuse ? active.reuse.size : 0 };
    if (retained && (Date.now() < retained.at || Date.now() - retained.at > LIMITS.ttlMs)) clear();
    return Object.assign({ state: 'empty', available: 0, hits: 0 }, last || {});
  }
  function clear() {
    sequence++; retained = null;
    if (TM.Endturn.RecoveryVault) TM.Endturn.RecoveryVault.clear();
    if (active) { active.reuse = null; active.records.clear(); active.chars = 0; }
    last = { state: 'cleared', available: 0, hits: 0 };
  }
  async function run(kind, descriptor, signal, execute, policy) {
    var s = eligible(); policy = policy || {};
    if (!s) return execute();
    if (signal && signal.aborted) throw failed('AI_ABORTED');
    var identity, ordinal, key, config, hash, callTurn = s.gm.turn;
    try {
      config = JSON.stringify(root.P && root.P.ai);
      identity = JSON.stringify([kind, descriptor, config, callTurn]);
      if (identity.length <= LIMITS.requestChars && s.ordinals.size < 256 && (s.ordinals.has(identity) || s.identityChars + identity.length <= LIMITS.identityChars)) {
        if (!s.ordinals.has(identity)) s.identityChars += identity.length;
        ordinal = (s.ordinals.get(identity) || 0) + 1; s.ordinals.set(identity, ordinal);
        hash = await digest(identity);
        if (hash) key = kind + ':' + hash + ':' + ordinal;
      }
    } catch (_) { key = null; }
    if (!key) { if (!current(s) || active !== s || s.state !== 'running' || s.gm.turn !== callTurn) throw failed(); if (signal && signal.aborted) throw failed('AI_ABORTED'); return execute(); }
    if (!current(s) || active !== s || s.state !== 'running' || config !== JSON.stringify(root.P && root.P.ai) || s.gm.turn !== callTurn) throw failed();
    if (signal && signal.aborted) throw failed('AI_ABORTED');
    var stillMatches = true;
    try { if (policy.matches) stillMatches = policy.matches(); } catch (_) { stillMatches = false; }
    if (!stillMatches) { s.skipped++; return execute(); }
    if (Date.now() < s.at || Date.now() - s.at > LIMITS.ttlMs) s.reuse = null;
    if (s.reuse && s.reuse.has(key)) {
      var encoded = s.reuse.get(key), restored;
      try { restored = JSON.parse(encoded); } catch (_) { s.reuse.delete(key); }
      if (restored !== undefined) {
        if (kind === 'json' && restored && typeof restored === 'object') { delete restored.usage; restored._tmRecoveredResponse = true; }
        s.hits++; remember(s, key, encoded);
        var assertFresh = function() {
          if (!current(s) || active !== s || s.state !== 'running' || config !== JSON.stringify(root.P && root.P.ai) || s.gm.turn !== callTurn) throw failed();
          if (signal && signal.aborted) throw failed('AI_ABORTED');
        };
        if (policy.onReplay) policy.onReplay(restored, assertFresh);
        assertFresh();
        var diagnostics = TM.Endturn.Reliability;
        try { if (diagnostics) { var ticket = diagnostics.requestStart('checkpoint:' + kind); diagnostics.requestPhase(ticket, 'reused'); diagnostics.requestEnd(ticket, null); } } catch (_) { /* Diagnostics must not invalidate a complete response. */ }
        return restored;
      }
    }
    var value = await execute();
    if (active === s && current(s) && s.state === 'running' && s.gm.turn === callTurn && config === JSON.stringify(root.P && root.P.ai) && !(signal && signal.aborted)) {
      try { var encoded = (!policy.matches || policy.matches()) && policy.complete && policy.complete(value) ? lossless(value) : null; if (encoded != null) remember(s, key, encoded); else s.skipped++; } catch (_) { s.skipped++; }
    }
    return value;
  }
  function jsonComplete(data) {
    return !!data && !data.error && Array.isArray(data.choices) && data.choices.length > 0 && data.choices.every(function(c) {
      return c && ['stop', 'tool_calls', 'function_call'].indexOf(c.finish_reason) >= 0 && c.message && !c.message.refusal
        && (typeof c.message.content === 'string' && c.message.content.length > 0 || Array.isArray(c.message.tool_calls) && c.message.tool_calls.length > 0);
    });
  }
  function optionKey(opts) {
    var out = {};
    Object.keys(opts || {}).forEach(function(k) {
      if (['signal', 'retryBudget', 'timeoutMs', 'priority', 'onChunk', 'onDone', '_requestTicket', '_requestGuard', '_streamGuard', '_responseRecoveryReceipt', '_recoveryStream'].indexOf(k) < 0 && typeof opts[k] !== 'function') out[k] = opts[k];
    });
    return out;
  }
  function jsonRequest(url, body, signal, opts, execute) {
    if (!eligible()) return execute(opts);
    var receipt = {}, request, originalOptions;
    try { request = JSON.stringify(body); originalOptions = JSON.stringify(optionKey(opts)); } catch (_) { return execute(opts); }
    var next = Object.assign({}, opts || {}, { _responseRecoveryReceipt: receipt });
    return run('json', [url, request, optionKey(opts)], signal, function() { return execute(next); }, {
      matches: function() { return JSON.stringify(body) === request && JSON.stringify(optionKey(opts)) === originalOptions; },
      complete: function(value) { return receipt.request === request && jsonComplete(value); }
    });
  }
  function toolRequest(prompt, tools, opts, execute) {
    opts = opts || {};
    if (!eligible()) return execute(opts);
    var compression, descriptor, encodedDescriptor;
    try { compression = typeof root.getCompressionParams === 'function' ? root.getCompressionParams() : null; descriptor = [prompt, tools, optionKey(opts), compression]; encodedDescriptor = JSON.stringify(descriptor); } catch (_) { return execute(opts); }
    return run('tools', descriptor, opts.signal, function() { return execute(opts); }, {
      matches: function() { return JSON.stringify([prompt, tools, optionKey(opts), typeof root.getCompressionParams === 'function' ? root.getCompressionParams() : null]) === encodedDescriptor; },
      complete: function(v) { return !!v && !v.error && !v.fallback && v.truncated === false && Array.isArray(v.toolCalls) && v.toolCalls.length > 0; }
    });
  }
  function streamRequest(kind, payload, maxTokens, opts, execute) {
    opts = opts || {};
    if (!eligible()) return execute(opts);
    var receipt = {}, next = Object.assign({}, opts, { _recoveryStream: receipt });
    var expectedTier = typeof root._getAITier === 'function' ? (root._getAITier(opts.tier) || {}).tier : opts.tier;
    expectedTier = expectedTier || opts.tier || 'primary';
    var compression = typeof root.getCompressionParams === 'function' ? root.getCompressionParams() : null;
    var descriptor, encodedDescriptor;
    try { descriptor = [kind, payload, maxTokens, optionKey(opts), compression]; encodedDescriptor = JSON.stringify(descriptor); } catch (_) { return execute(opts); }
    return run('stream', descriptor, opts.signal, function() { return execute(next); }, {
      matches: function() { return JSON.stringify([kind, payload, maxTokens, optionKey(opts), typeof root.getCompressionParams === 'function' ? root.getCompressionParams() : null]) === encodedDescriptor; },
      complete: function(v) { return receipt.complete === true && receipt.tier === expectedTier && typeof v === 'string' && v.length > 0; },
      onReplay: function(v, assertFresh) { if (opts.onChunk) opts.onChunk(v); assertFresh(); if (opts.onDone) opts.onDone(v); }
    });
  }
  TM.Endturn.ResponseRecovery = { begin: begin, finish: finish, status: status, clear: clear, run: run,
    jsonRequest: jsonRequest, toolRequest: toolRequest, streamRequest: streamRequest, jsonComplete: jsonComplete,
    limits: Object.freeze(Object.assign({}, LIMITS)) };
})(typeof window !== 'undefined' ? window : globalThis);
