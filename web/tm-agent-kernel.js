// @ts-check
// ============================================================
// tm-agent-kernel.js — 国师/正式 Agent 共用的工具协议、回执、预算与追踪底座
//
// 共享的是协议，不是权限：剧本工坊写 draft；正式 Agent 只能经 runtime tool 写 GM。
// 本模块不认识任何业务字段，避免两个场景互相借用写入语义。
// ============================================================
(function (root) {
  'use strict';
  var TM = root.TM || (root.TM = {});
  var EFFECTS = ['read', 'draft-write', 'runtime-write', 'memory-write', 'external', 'control'];
  var RISKS = ['low', 'medium', 'high', 'critical'];

  function _own(o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); }
  function _copy(o) {
    var out = {};
    Object.keys(o || {}).forEach(function (k) { out[k] = o[k]; });
    return out;
  }
  function _arr(v) { return Array.isArray(v) ? v.slice() : (v == null ? [] : [v]); }
  function _finite(v, fallback) { var n = Number(v); return isFinite(n) && n >= 0 ? n : fallback; }
  function _now() { return Date.now(); }

  function normalizeSpec(spec, defaults) {
    spec = _copy(spec || {}); defaults = defaults || {};
    if (!spec.name || typeof spec.name !== 'string') throw new Error('ToolSpec 缺 name');
    var effect = spec.effect || defaults.effect || 'read';
    if (EFFECTS.indexOf(effect) < 0) throw new Error('ToolSpec effect 非法:' + effect + ' (' + spec.name + ')');
    var risk = spec.risk || defaults.risk || (effect === 'read' ? 'low' : 'medium');
    if (RISKS.indexOf(risk) < 0) throw new Error('ToolSpec risk 非法:' + risk + ' (' + spec.name + ')');
    return {
      name: spec.name,
      version: String(spec.version || defaults.version || '1'),
      domain: spec.domain || defaults.domain || 'general',
      pack: spec.pack || defaults.pack || 'core',
      description: spec.description || '',
      parameters: spec.parameters || { type: 'object', properties: {}, required: [] },
      effect: effect,
      risk: risk,
      estimatedTokens: _finite(spec.estimatedTokens, _finite(defaults.estimatedTokens, 0)),
      estimatedCost: _finite(spec.estimatedCost, _finite(defaults.estimatedCost, 0)),
      capability: spec.capability || defaults.capability || '',
      idempotent: spec.idempotent != null ? !!spec.idempotent : (defaults.idempotent != null ? !!defaults.idempotent : effect === 'read'),
      preconditions: _arr(spec.preconditions || defaults.preconditions),
      postconditions: _arr(spec.postconditions || defaults.postconditions),
      invariants: _arr(spec.invariants || defaults.invariants),
      rollback: spec.rollback || defaults.rollback || (effect === 'read' ? 'none' : 'snapshot'),
      meta: _copy(spec.meta || {})
    };
  }

  function providerDef(spec) {
    return { name: spec.name, description: spec.description || '', parameters: spec.parameters || { type: 'object', properties: {}, required: [] } };
  }

  function makeReceipt(spec, raw, meta) {
    raw = raw || {}; meta = meta || {};
    var ok = raw.ok === true;
    var effect = (spec && spec.effect) || meta.effect || 'read';
    var changed;
    if (_own(meta, 'changed')) changed = !!meta.changed;
    else if (_own(raw, 'changed')) changed = !!raw.changed;
    else if (raw.result && _own(raw.result, 'changed')) changed = !!raw.result.changed;
    else changed = ok && effect !== 'read' && effect !== 'control' && Number(meta.reportDelta || 0) > 0;
    var verified;
    if (_own(meta, 'verified')) verified = !!meta.verified;
    else if (_own(raw, 'verified')) verified = !!raw.verified;
    else if (raw.result && _own(raw.result, 'verified')) verified = !!raw.result.verified;
    else verified = effect === 'read' ? ok : false;
    return {
      id: meta.id || ('tr_' + _now().toString(36) + '_' + Math.random().toString(36).slice(2, 8)),
      tool: (spec && spec.name) || meta.tool || raw.name || '',
      version: (spec && spec.version) || '1',
      effect: effect,
      risk: (spec && spec.risk) || meta.risk || 'low',
      attempted: meta.attempted !== false,
      ok: ok,
      changed: changed,
      verified: verified,
      paths: _arr(meta.paths || raw.paths || raw.path || (raw.result && raw.result.path)),
      beforeHash: meta.beforeHash || null,
      afterHash: meta.afterHash || null,
      invariants: _arr(meta.invariants),
      reason: String(raw.reason || raw.error || meta.reason || ''),
      cost: { calls: _finite(meta.calls, 0), tokens: _finite(meta.tokens, 0), amount: _finite(meta.cost, 0) },
      provenance: meta.provenance || '',
      at: _now()
    };
  }

  function createRegistry(specs, opts) {
    opts = opts || {};
    var list = [], byName = Object.create(null);
    (specs || []).forEach(function (raw) {
      var spec = normalizeSpec(raw, opts.defaults || {});
      if (byName[spec.name]) throw new Error('ToolSpec 重名:' + spec.name);
      byName[spec.name] = spec; list.push(spec);
    });
    return {
      list: function () { return list.slice(); },
      get: function (name) { return byName[name] || null; },
      has: function (name) { return !!byName[name]; },
      names: function (filter) { return list.filter(filter || function () { return true; }).map(function (s) { return s.name; }); },
      defs: function (filter) { return list.filter(filter || function () { return true; }).map(providerDef); },
      byEffect: function (effect) { return list.filter(function (s) { return s.effect === effect; }); },
      receipt: function (name, raw, meta) { return makeReceipt(byName[name] || { name: name }, raw, meta); }
    };
  }

  function createTrace(meta) {
    var seq = 0, events = [], base = _copy(meta || {});
    return {
      add: function (type, data) {
        var e = { seq: ++seq, at: _now(), type: String(type || 'event'), data: data || {} };
        events.push(e); return e;
      },
      list: function () { return events.slice(); },
      snapshot: function () { return { meta: _copy(base), events: events.slice() }; }
    };
  }

  function createBudget(opts, trace) {
    opts = opts || {};
    var maxCalls = _finite(opts.maxCalls, Infinity);
    var maxTokens = _finite(opts.maxTokens, Infinity);
    var maxCost = _finite(opts.maxCost, Infinity);
    var reserveCalls = _finite(opts.reserveCalls, 0);
    var deadlineAt = opts.deadlineAt || (opts.deadlineMs ? _now() + _finite(opts.deadlineMs, 0) : Infinity);
    var used = { calls: 0, tokens: 0, cost: 0 };
    var denied = [];
    function snapshot() {
      return {
        limits: { calls: maxCalls, tokens: maxTokens, cost: maxCost, deadlineAt: deadlineAt, reserveCalls: reserveCalls },
        used: _copy(used),
        remaining: {
          calls: maxCalls === Infinity ? Infinity : Math.max(0, maxCalls - used.calls),
          tokens: maxTokens === Infinity ? Infinity : Math.max(0, maxTokens - used.tokens),
          cost: maxCost === Infinity ? Infinity : Math.max(0, maxCost - used.cost),
          ms: deadlineAt === Infinity ? Infinity : Math.max(0, deadlineAt - _now())
        },
        denied: denied.slice()
      };
    }
    function claim(label, estimate, claimOpts) {
      estimate = estimate || {}; claimOpts = claimOpts || {};
      var add = { calls: _finite(estimate.calls, 1), tokens: _finite(estimate.tokens, 0), cost: _finite(estimate.cost, 0) };
      var reason = '';
      if (_now() >= deadlineAt) reason = 'deadline';
      else if (used.calls + add.calls > maxCalls - (claimOpts.essential ? 0 : reserveCalls)) reason = 'calls';
      else if (used.tokens + add.tokens > maxTokens) reason = 'tokens';
      else if (used.cost + add.cost > maxCost) reason = 'cost';
      if (reason) {
        var d = { label: label || '', reason: reason, estimate: add, at: _now() };
        denied.push(d); if (trace) trace.add('budget_denied', d);
        return { ok: false, reason: reason, snapshot: snapshot() };
      }
      used.calls += add.calls; used.tokens += add.tokens; used.cost += add.cost;
      var c = { ok: true, label: label || '', charged: add, snapshot: snapshot() };
      if (trace) trace.add('budget_claim', { label: c.label, charged: add });
      return c;
    }
    return { claim: claim, snapshot: snapshot, exhausted: function () { var s = snapshot(); return s.remaining.calls <= 0 || s.remaining.tokens <= 0 || s.remaining.cost <= 0 || s.remaining.ms <= 0; } };
  }

  function createRun(opts) {
    opts = opts || {};
    var trace = createTrace(opts.meta || {});
    var ctrl = typeof root.AbortController === 'function' ? new root.AbortController() : null;
    var signal = ctrl ? ctrl.signal : { aborted: false };
    var run = {
      signal: signal,
      trace: trace,
      budget: createBudget(opts.budget || {}, trace),
      abort: function (reason) {
        if (ctrl && !ctrl.signal.aborted) ctrl.abort(reason || 'aborted');
        else signal.aborted = true;
        trace.add('abort', { reason: reason || 'aborted' });
      },
      snapshot: function () { return { aborted: !!signal.aborted, budget: run.budget.snapshot(), trace: trace.snapshot() }; }
    };
    return run;
  }

  // 同步冻结序列化输入，再异步SHA；只返回来源指纹，不持久化案卷正文或凭据。
  function fingerprintScenario(value) {
    var json;
    try { json=JSON.stringify(value); } catch (e) { return Promise.reject(e); }
    if (typeof json!=='string' || !root.crypto || !root.crypto.subtle || !root.TextEncoder) return Promise.resolve(null);
    var bytes=new root.TextEncoder().encode(json), size=bytes.byteLength;
    return root.crypto.subtle.digest('SHA-256',bytes).then(function(buffer){return{algorithm:'sha256-json-v1',bytes:size,hash:Array.from(new Uint8Array(buffer)).map(function(b){return b.toString(16).padStart(2,'0');}).join('')};});
  }
  TM.AgentKernel = {
    fingerprintScenario: fingerprintScenario,
    EFFECTS: EFFECTS.slice(),
    RISKS: RISKS.slice(),
    normalizeSpec: normalizeSpec,
    providerDef: providerDef,
    makeReceipt: makeReceipt,
    createRegistry: createRegistry,
    createTrace: createTrace,
    createBudget: createBudget,
    createRun: createRun
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = TM.AgentKernel;
})(typeof window !== 'undefined' ? window : globalThis);
