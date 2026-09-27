(function(global) {
  'use strict';

  var root = global || (typeof window !== 'undefined' ? window : {});
  root.TM = root.TM || {};

  var ns = root.TM.MemoryTrace = root.TM.MemoryTrace || {};
  var SCHEMA_VERSION = 'memorytrace.v0';
  var DEFAULT_PREVIEW_LIMIT = 160;
  var MAX_LIST = 80;

  function now() {
    return (typeof Date !== 'undefined' && Date.now) ? Date.now() : 0;
  }

  function toText(value) {
    if (value == null) return '';
    if (typeof value === 'string') return value;
    try { return JSON.stringify(value); } catch(_) { return String(value); }
  }

  function normalizeText(value) {
    return toText(value)
      .replace(/[\u0000-\u001f\u007f]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function safePreview(value, limit) {
    var max = Math.max(0, Math.min(500, limit || DEFAULT_PREVIEW_LIMIT));
    var text = normalizeText(value);
    if (text.length <= max) return text;
    return text.slice(0, Math.max(0, max - 1)) + '...';
  }

  function hashText(value) {
    var text = toText(value);
    var h1 = 0x811c9dc5;
    var h2 = 0x01000193;
    for (var i = 0; i < text.length; i++) {
      var c = text.charCodeAt(i);
      h1 ^= c;
      h1 = Math.imul(h1, 0x01000193);
      h2 = Math.imul(h2 ^ c, 0x85ebca6b);
    }
    return 'h' + (h1 >>> 0).toString(16).padStart(8, '0') + '-' + (h2 >>> 0).toString(16).padStart(8, '0') + ':len' + text.length;
  }

  function estimateTokens(text) {
    var value = toText(text);
    try {
      if (typeof root.estimateTokens === 'function') return root.estimateTokens(value);
    } catch(_) {}
    if (!value) return 0;
    var cjk = (value.match(/[\u3400-\u9fff]/g) || []).length;
    var other = Math.max(0, value.length - cjk);
    return Math.max(1, Math.ceil(cjk * 0.75 + other / 4));
  }

  function createTraceId(prefix) {
    var p = prefix || 'mt';
    var rand = Math.floor(Math.random() * 0xffffffff).toString(36);
    return p + '-' + now().toString(36) + '-' + rand;
  }

  function ensureResults(GM) {
    if (!GM) return null;
    if (!GM._turnAiResults || typeof GM._turnAiResults !== 'object') GM._turnAiResults = {};
    return GM._turnAiResults;
  }

  function ensureTurnTrace(GM, opts) {
    var results = ensureResults(GM);
    if (!results) return null;
    var trace = results.memoryTrace;
    if (!trace || typeof trace !== 'object' || trace.schemaVersion !== SCHEMA_VERSION) {
      trace = {
        schemaVersion: SCHEMA_VERSION,
        traceId: createTraceId('mt'),
        traceOnly: true,
        source: opts && opts.source || '',
        turnId: GM && GM.turn || 0,
        createdAt: now(),
        subcalls: [],
        retrievals: [],
        injections: [],
        writes: [],
        prompts: [],
        compiledContexts: [],
        incidents: []
      };
      results.memoryTrace = trace;
    }
    if (!Array.isArray(trace.compiledContexts)) trace.compiledContexts = [];
    return trace;
  }

  function pushBounded(list, item) {
    if (!Array.isArray(list)) return item;
    list.push(item);
    while (list.length > MAX_LIST) list.shift();
    return item;
  }

  function usageShape(usage) {
    if (!usage || typeof usage !== 'object') return null;
    return {
      prompt_tokens: Number(usage.prompt_tokens || 0),
      completion_tokens: Number(usage.completion_tokens || 0),
      total_tokens: Number(usage.total_tokens || ((usage.prompt_tokens || 0) + (usage.completion_tokens || 0)))
    };
  }

  function extractMessagesText(body) {
    if (!body) return '';
    if (typeof body === 'string') return body;
    if (Array.isArray(body)) {
      return body.map(function(m) { return m && (m.content || m.text || ''); }).join('\n');
    }
    if (Array.isArray(body.messages)) {
      return body.messages.map(function(m) { return m && (m.content || m.text || ''); }).join('\n');
    }
    if (body.prompt) return body.prompt;
    return '';
  }

  function recordSubcall(GM, data) {
    var trace = ensureTurnTrace(GM, { source: data && data.source || 'recordSubcall' });
    if (!trace) return null;
    data = data || {};
    var prompt = data.prompt != null ? data.prompt : extractMessagesText(data.body || data.messages);
    var response = data.response != null ? data.response : data.raw;
    var promptHash = hashText(prompt);
    var responseHash = hashText(response);
    var item = {
      id: String(data.id || ''),
      label: String(data.label || ''),
      ok: data.ok !== false,
      at: now(),
      latencyMs: Number(data.latencyMs || data.ms || 0),
      model: String(data.model || ''),
      usage: usageShape(data.usage),
      promptHash: promptHash,
      promptLength: toText(prompt).length,
      promptTokensEstimate: estimateTokens(prompt),
      promptPreview: data.promptPreview != null ? safePreview(data.promptPreview, data.promptPreviewLimit || 160) : '',
      responseHash: responseHash,
      responseLength: toText(response).length,
      responseTokensEstimate: estimateTokens(response),
      responsePreview: data.responsePreview != null ? safePreview(data.responsePreview, data.responsePreviewLimit || 160) : ''
    };
    if (data.error) item.error = safePreview(data.error, 160);
    if (data.status) item.status = data.status;
    if (data.finishReason) item.finishReason = String(data.finishReason);
    return pushBounded(trace.subcalls, item);
  }

  function compactHit(hit) {
    hit = hit || {};
    var text = hit.text != null ? hit.text : (hit.event != null ? hit.event : hit.content);
    var reason = hit._reason && typeof hit._reason === 'object' ? hit._reason : null;
    var item = {
      id: String(hit.id || hit.key || ''),
      source: String(hit.source || (hit.char ? 'npc' : 'unknown')),
      turn: Number(hit.turn || 0),
      score: typeof hit.score === 'number' ? hit.score : (typeof hit._score === 'number' ? hit._score : (typeof hit.sim === 'number' ? hit.sim : null)),
      status: hit.status != null ? String(hit.status) : '',
      importance: hit.importance != null ? hit.importance : null,
      textHash: hashText(text),
      textLength: toText(text).length,
      textPreview: safePreview(text, 18)
    };
    copyEvidenceMeta(item, hit);
    if (reason) {
      item.reason = {
        relevance: Number(reason.relevance || 0),
        importance: Number(reason.importance || 0),
        recency: Number(reason.recency || 0),
        source: Number(reason.source || 0),
        dimension: Number(reason.dimension || 0)
      };
    }
    if (hit.char) item.char = safePreview(hit.char, 40);
    if (hit.sub) item.sub = safePreview(hit.sub, 40);
    return item;
  }

  function compactSuppressedHit(hit) {
    hit = hit || {};
    return {
      id: String(hit.id || hit.key || ''),
      source: String(hit.source || 'unknown'),
      reason: String(hit.reason || 'filtered'),
      status: hit.status != null ? String(hit.status) : '',
      turn: Number(hit.turn || 0),
      by: hit.by ? String(hit.by) : '',
      edgeReason: hit.edgeReason ? safePreview(hit.edgeReason, 80) : '',
      budgetStage: hit.budgetStage ? String(hit.budgetStage) : '',
      cost: hit.cost != null ? Number(hit.cost || 0) : 0,
      textPreview: safePreview(hit.textPreview || hit.text || '', 32)
    };
  }

  function compactBudgetItem(it) {
    it = it || {};
    return {
      id: String(it.id || it.key || ''),
      source: String(it.source || ''),
      stage: String(it.stage || ''),
      cost: Number(it.cost || 0),
      groupIndex: Number(it.groupIndex || 0),
      hitIndex: Number(it.hitIndex || 0)
    };
  }

  function compactRef(ref) {
    ref = ref || {};
    var out = {
      type: String(ref.type || 'unknown'),
      id: String(ref.id || 'unknown')
    };
    if (ref.turn != null) out.turn = Number(ref.turn || 0);
    if (ref.authority) out.authority = String(ref.authority);
    if (ref.authorityRank != null) out.authorityRank = Number(ref.authorityRank);
    if (ref.visibility) out.visibility = String(ref.visibility);
    if (ref.lane) out.lane = String(ref.lane);
    if (ref.role) out.role = String(ref.role);
    return out;
  }

  function compactRefs(list) {
    return (Array.isArray(list) ? list : []).slice(0, 8).map(compactRef);
  }

  function copyEvidenceMeta(target, src) {
    src = src || {};
    if (src.authority != null) target.authority = String(src.authority);
    if (src.authorityRank != null) target.authorityRank = Number(src.authorityRank);
    if (src.visibility != null) target.visibility = String(src.visibility);
    if (src.lane != null) target.lane = String(src.lane);
    if (src.factStatus != null) target.factStatus = String(src.factStatus);
    if (src.confidence != null) target.confidence = Number(src.confidence);
    if (Array.isArray(src.sourceRefs)) target.sourceRefs = compactRefs(src.sourceRefs);
    if (Array.isArray(src.basisRefs)) target.basisRefs = compactRefs(src.basisRefs);
    return target;
  }

  function recordRetrieval(GM, data) {
    var trace = ensureTurnTrace(GM, { source: data && data.source || 'recordRetrieval' });
    if (!trace) return null;
    data = data || {};
    var hits = Array.isArray(data.hits) ? data.hits : [];
    var query = data.query;
    var item = {
      id: String(data.id || ''),
      at: now(),
      gate: data.gate || null,
      sources: data.sources || null,
      queryHash: hashText(query),
      queryPreview: safePreview(query, 160),
      queryLength: toText(query).length,
      hits: hits.slice(0, 50).map(compactHit),
      suppressed: Array.isArray(data.suppressed) ? data.suppressed.slice(0, 80).map(compactSuppressedHit) : [],
      budget: data.budget ? {
        maxTokens: Number(data.budget.maxTokens || 0),
        tokenEstimate: Number(data.budget.tokenEstimate || 0),
        guaranteed: data.budget.diagnostics ? Number(data.budget.diagnostics.guaranteed || 0) : 0,
        fair: data.budget.diagnostics ? Number(data.budget.diagnostics.fair || 0) : 0,
        filled: data.budget.diagnostics ? Number(data.budget.diagnostics.filled || 0) : 0,
        dropped: data.budget.diagnostics ? Number(data.budget.diagnostics.dropped || 0) : 0,
        kept: data.budget.diagnostics && Array.isArray(data.budget.diagnostics.kept)
          ? data.budget.diagnostics.kept.slice(0, 50).map(compactBudgetItem)
          : []
      } : null
    };
    if (data.status) item.status = String(data.status);
    if (data.agent) {
      item.agent = {
        enabled: true,
        toolCallCount: Number(data.agent.toolCallCount || 0),
        totalHits: Number(data.agent.totalHits || 0),
        fallback: !!data.agent.fallback,
        toolCalls: Array.isArray(data.agent.toolCalls)
          ? data.agent.toolCalls.slice(0, 6).map(function (c) { return { name: String((c && c.name) || ''), input: (c && c.input) || {} }; })
          : []
      };
    }
    if (data.anomaly) {
      item.anomaly = {
        detected: !!data.anomaly.detected,
        moves: Array.isArray(data.anomaly.moves)
          ? data.anomaly.moves.slice(0, 3).map(function (m) { return { what: String((m && m.what) || '').slice(0, 60), why: String((m && m.why_uncommon) || '').slice(0, 60) }; })
          : []
      };
    }
    return pushBounded(trace.retrievals, item);
  }

  function compactInjectedItem(it) {
    it = it || {};
    var item = {
      id: String(it.id || it.key || ''),
      source: String(it.source || ''),
      reason: safePreview(it.reason || '', 80),
      lane: it.lane ? String(it.lane) : ''
    };
    return copyEvidenceMeta(item, it);
  }

  function compactCompiledItem(it) {
    var item = compactHit(it);
    if (it && it.type != null) item.type = String(it.type);
    if (it && it.ownerScope != null) item.ownerScope = safePreview(it.ownerScope, 80);
    if (it && it.readScope != null) item.readScope = safePreview(it.readScope, 80);
    return item;
  }

  function compactZone(zone) {
    zone = zone || {};
    var text = zone.text != null ? zone.text : '';
    var item = {
      id: String(zone.id || zone.key || ''),
      source: String(zone.source || ''),
      lane: zone.lane ? String(zone.lane) : '',
      reason: safePreview(zone.reason || zone.stage || '', 80),
      order: zone.order != null ? Number(zone.order || 0) : 0,
      cost: zone.cost != null ? Number(zone.cost || 0) : (zone.tokens != null ? Number(zone.tokens || 0) : 0),
      score: typeof zone.score === 'number' ? zone.score : null
    };
    if (text) {
      item.textHash = hashText(text);
      item.textLength = toText(text).length;
      item.textPreview = safePreview(text, 12);
    }
    return item;
  }

  function sectionCounts(sections) {
    var out = {};
    if (!sections || typeof sections !== 'object') return out;
    Object.keys(sections).forEach(function(key) {
      out[key] = Array.isArray(sections[key]) ? sections[key].length : 0;
    });
    return out;
  }

  function countByField(list, field) {
    var out = {};
    (Array.isArray(list) ? list : []).forEach(function(item) {
      var value = item && item[field] != null ? String(item[field]) : '';
      var key = value || 'unknown';
      out[key] = (out[key] || 0) + 1;
    });
    return out;
  }

  function compileOptsShape(opts) {
    opts = opts || {};
    var out = {};
    ['turn', 'intent', 'audience', 'actorScope', 'actorId', 'factionId', 'maxTokens'].forEach(function(key) {
      if (opts[key] != null) out[key] = opts[key];
    });
    if (opts.includeHidden === true) out.includeHidden = true;
    if (opts.includeFuture === true) out.includeFuture = true;
    return out;
  }

  function compactWriteItem(it) {
    it = it || {};
    var text = it.safeBody != null ? it.safeBody : (it.body != null ? it.body : (it.text != null ? it.text : it.content));
    var item = {
      id: String(it.id || it.key || ''),
      type: String(it.type || it.kind || ''),
      status: String(it.status || ''),
      reviewStatus: String(it.reviewStatus || ''),
      authority: String(it.authority || ''),
      lane: it.lane ? String(it.lane) : '',
      turn: Number(it.turn || 0),
      bodyHash: hashText(text),
      bodyLength: toText(text).length,
      bodyPreview: safePreview(text, 24),
      sourceRefs: compactRefs(it.sourceRefs),
      basisRefs: compactRefs(it.basisRefs)
    };
    if (it.ownerScope) item.ownerScope = safePreview(it.ownerScope, 80);
    if (it.readScope) item.readScope = safePreview(it.readScope, 80);
    if (it.reason) item.reason = safePreview(it.reason, 120);
    return item;
  }

  function compactWriteRef(ref) {
    return compactRef(ref);
  }

  function recordInjection(GM, data) {
    var trace = ensureTurnTrace(GM, { source: data && data.source || 'recordInjection' });
    if (!trace) return null;
    data = data || {};
    var text = data.text != null ? data.text : '';
    var item = {
      lane: String(data.lane || ''),
      stage: String(data.stage || ''),
      at: now(),
      textHash: hashText(text),
      textLength: toText(text).length,
      textTokensEstimate: data.tokenEstimate != null ? Number(data.tokenEstimate) : estimateTokens(text),
      textPreview: safePreview(text, 12),
      items: Array.isArray(data.items) ? data.items.slice(0, 50).map(compactInjectedItem) : [],
      suppressed: Array.isArray(data.suppressed) ? data.suppressed.slice(0, 80).map(compactSuppressedHit) : []
    };
    return pushBounded(trace.injections, item);
  }

  function recordCompiledContext(GM, data) {
    var trace = ensureTurnTrace(GM, { source: data && data.source || 'recordCompiledContext' });
    if (!trace) return null;
    data = data || {};
    if (!Array.isArray(trace.compiledContexts)) trace.compiledContexts = [];
    var compiled = data.compiled && typeof data.compiled === 'object' ? data.compiled : {};
    var diagnostics = compiled.diagnostics || {};
    var hits = Array.isArray(compiled.injectedHits) ? compiled.injectedHits : (Array.isArray(data.items) ? data.items : (Array.isArray(compiled.hits) ? compiled.hits : []));
    var text = data.text != null ? data.text : (compiled.text || '');
    var tokenEstimate = data.tokenEstimate != null ? Number(data.tokenEstimate) : Number(compiled.tokenEstimate || 0);
    if (!tokenEstimate) tokenEstimate = estimateTokens(text);
    var suppressed = [];
    suppressed = suppressed.concat(Array.isArray(compiled.suppressed) ? compiled.suppressed : []);
    suppressed = suppressed.concat(Array.isArray(diagnostics.suppressed) ? diagnostics.suppressed : []);
    suppressed = suppressed.concat(Array.isArray(data.suppressed) ? data.suppressed : []);
    var suppressedSeen = Object.create(null);
    suppressed = suppressed.filter(function(row) {
      var key = [row && row.id, row && row.source, row && row.reason, row && row.by, row && (row.budgetStage || row.stage)].join('|');
      if (suppressedSeen[key]) return false;
      suppressedSeen[key] = true;
      return true;
    });
    var item = {
      id: String(data.id || 'compiled-context'),
      stage: String(data.stage || ''),
      lane: String(data.lane || ''),
      at: now(),
      schemaVersion: String(compiled.schemaVersion || data.schemaVersion || ''),
      intent: String(data.intent || (data.compileOpts && data.compileOpts.intent) || ''),
      audience: String(data.audience || (data.compileOpts && data.compileOpts.audience) || ''),
      actorScope: String(data.actorScope || (data.compileOpts && data.compileOpts.actorScope) || ''),
      textHash: hashText(text),
      textLength: toText(text).length,
      textTokensEstimate: tokenEstimate,
      textPreview: safePreview(text, 12),
      maxTokens: data.maxTokens != null ? Number(data.maxTokens || 0) : Number(compiled.maxTokens || 0),
      sectionCounts: sectionCounts(compiled.injectedSections || compiled.sections),
      candidateCount: Array.isArray(compiled.hits) ? compiled.hits.length : hits.length,
      injectedCount: hits.length,
      countsByType: countByField(hits, 'type'),
      countsBySource: countByField(hits, 'source'),
      countsByLane: countByField(hits, 'lane'),
      countsByAuthority: countByField(hits, 'authority'),
      kept: Array.isArray(diagnostics.kept) ? diagnostics.kept.slice(0, 50).map(compactBudgetItem) : [],
      suppressed: suppressed.slice(0, 80).map(compactSuppressedHit),
      zones: Array.isArray(compiled.zones) ? compiled.zones.slice(0, 40).map(compactZone) : [],
      items: hits.slice(0, 50).map(compactCompiledItem)
    };
    if (data.compileOpts) item.compileOpts = compileOptsShape(data.compileOpts);
    return pushBounded(trace.compiledContexts, item);
  }

  function recordWrite(GM, data) {
    var trace = ensureTurnTrace(GM, { source: data && data.source || 'recordWrite' });
    if (!trace) return null;
    data = data || {};
    if (!Array.isArray(trace.writes)) trace.writes = [];
    var items = Array.isArray(data.items) ? data.items : [];
    var item = {
      id: String(data.id || 'memory-write'),
      stage: String(data.stage || ''),
      sourceId: String(data.sourceId || ''),
      at: now(),
      status: String(data.status || ''),
      candidates: Number(data.candidates != null ? data.candidates : items.length),
      added: Number(data.added || 0),
      drafts: Number(data.drafts || 0),
      quarantined: Number(data.quarantined || 0),
      accepted: Number(data.accepted || 0),
      archived: Number(data.archived || 0),
      readContextRefs: Array.isArray(data.readContextRefs) ? data.readContextRefs.slice(0, 12).map(compactWriteRef) : [],
      items: items.slice(0, 50).map(compactWriteItem)
    };
    if (data.error) item.error = safePreview(data.error, 160);
    return pushBounded(trace.writes, item);
  }

  function summarize(traceOrGM) {
    var trace = traceOrGM && traceOrGM.schemaVersion === SCHEMA_VERSION
      ? traceOrGM
      : snapshot(traceOrGM);
    if (!trace) return null;
    var summary = {
      traceId: trace.traceId || '',
      traceOnly: true,
      subcalls: Array.isArray(trace.subcalls) ? trace.subcalls.length : 0,
      failedSubcalls: 0,
      retrievals: Array.isArray(trace.retrievals) ? trace.retrievals.length : 0,
      injections: Array.isArray(trace.injections) ? trace.injections.length : 0,
      compiledContexts: Array.isArray(trace.compiledContexts) ? trace.compiledContexts.length : 0,
      writes: Array.isArray(trace.writes) ? trace.writes.length : 0,
      totalTokens: 0,
      promptTokens: 0,
      completionTokens: 0,
      latencyMs: 0,
      injectedTokensEstimate: 0,
      compiledContextTokensEstimate: 0,
      writeCandidates: 0,
      writeDrafts: 0,
      writeQuarantined: 0,
      writeAccepted: 0,
      writeArchived: 0,
      sources: {}
    };
    (trace.subcalls || []).forEach(function(sc) {
      if (sc && sc.ok === false) summary.failedSubcalls += 1;
      if (sc && sc.usage) {
        summary.promptTokens += Number(sc.usage.prompt_tokens || 0);
        summary.completionTokens += Number(sc.usage.completion_tokens || 0);
        summary.totalTokens += Number(sc.usage.total_tokens || ((sc.usage.prompt_tokens || 0) + (sc.usage.completion_tokens || 0)));
      }
      summary.latencyMs += Number(sc && sc.latencyMs || 0);
    });
    (trace.injections || []).forEach(function(inj) {
      summary.injectedTokensEstimate += Number(inj && inj.textTokensEstimate || 0);
    });
    (trace.compiledContexts || []).forEach(function(ctx) {
      summary.compiledContextTokensEstimate += Number(ctx && ctx.textTokensEstimate || 0);
    });
    (trace.writes || []).forEach(function(write) {
      summary.writeCandidates += Number(write && (write.candidates != null ? write.candidates : (Array.isArray(write.items) ? write.items.length : 0)) || 0);
      summary.writeDrafts += Number(write && write.drafts || 0);
      summary.writeQuarantined += Number(write && write.quarantined || 0);
      summary.writeAccepted += Number(write && write.accepted || 0);
      summary.writeArchived += Number(write && write.archived || 0);
    });
    (trace.retrievals || []).forEach(function(ret) {
      if (ret && ret.sources && typeof ret.sources === 'object') {
        Object.keys(ret.sources).forEach(function(k) {
          summary.sources[k] = (summary.sources[k] || 0) + Number(ret.sources[k] || 0);
        });
      } else if (ret && Array.isArray(ret.hits)) {
        ret.hits.forEach(function(h) {
          var src = h && h.source || 'unknown';
          summary.sources[src] = (summary.sources[src] || 0) + 1;
        });
      }
    });
    return summary;
  }

  function finalizeTurnTrace(GM) {
    var trace = snapshot(GM);
    if (!trace) return null;
    trace.completedAt = trace.completedAt || now();
    trace.summary = summarize(trace);
    return trace;
  }

  function snapshot(GM) {
    var results = GM && GM._turnAiResults;
    return results && results.memoryTrace || null;
  }

  ns.hashText = hashText;
  ns.safePreview = safePreview;
  ns.estimateTokens = estimateTokens;
  ns.createTraceId = createTraceId;
  ns.ensureTurnTrace = ensureTurnTrace;
  ns.recordSubcall = recordSubcall;
  ns.recordRetrieval = recordRetrieval;
  ns.recordInjection = recordInjection;
  ns.recordCompiledContext = recordCompiledContext;
  ns.recordWrite = recordWrite;
  ns.summarize = summarize;
  ns.finalizeTurnTrace = finalizeTurnTrace;
  ns.snapshot = snapshot;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
