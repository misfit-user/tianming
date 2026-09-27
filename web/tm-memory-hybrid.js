// Chinese-aware lexical retrieval + vector reciprocal-rank fusion + evidence diversity.
(function(root) {
  'use strict';
  root.TM = root.TM || {};
  var NS = root.TM.MemoryHybrid = root.TM.MemoryHybrid || {};
  function tokens(value) {
    var parts = String(value || '').toLowerCase().slice(0, 12000).match(/[a-z0-9_:-]+|[\u3400-\u9fff]+/g) || [], out = [];
    parts.forEach(function(part) { if (/^[\u3400-\u9fff]+$/.test(part) && part.length > 1) { for (var i = 0; i < part.length - 1; i++) out.push(part.slice(i, i + 2)); } else if (part.length > 1) out.push(part); });
    return out;
  }
  function body(hit) { return String(hit && (hit.safeBody != null ? hit.safeBody : (hit.text || hit.body)) || ''); }
  function key(hit) { return hit && hit.id ? String(hit.id) : [hit.source, hit.turn, body(hit)].join('|'); }
  function collect(gm, opts) {
    var E = root.TM.MemoryEnvelope, R = root.TM.MemoryRetrieval;
    if (!gm || !E || !R) return [];
    var policy = Object.assign({ GM: gm, turn: gm.turn, audience: 'system', actorScope: 'system', intent: 'historical_evidence' }, opts || {});
    return R.rankHitsDetailed(E.collect(gm).map(R.hitFromEnvelope), policy).ranked || [];
  }
  // Cache pure token counts by exact input text, never by a mutable world ID.
  var tokenCache = new Map(), cacheChars = 0, cacheWorld = null;
  function countsFor(text) {
    if (cacheWorld !== root.GM) { tokenCache.clear(); cacheChars = 0; cacheWorld = root.GM; }
    var cached = tokenCache.get(text);
    if (cached) { tokenCache.delete(text); tokenCache.set(text, cached); return cached; }
    var words = tokens(text), counts = Object.create(null);
    words.forEach(function(word) { counts[word] = (counts[word] || 0) + 1; });
    var result = { counts: counts, length: words.length };
    if (text.length <= 16000) {
      tokenCache.set(text, result); cacheChars += text.length;
      while (tokenCache.size > 2048 || cacheChars > 2000000) { var key = tokenCache.keys().next().value; cacheChars -= key.length; tokenCache.delete(key); }
    }
    return result;
  }
  function lexical(hits, query, limit) {
    var q = Array.from(new Set(tokens(query))).slice(0, 48), df = Object.create(null), totalLength = 0;
    if (!q.length) return [];
    var docs = hits.map(function(hit) {
      var cached = countsFor(body(hit) + ' ' + (hit.entities || []).join(' ') + ' ' + (hit.char || '')), counts = cached.counts;
      q.forEach(function(word) { if (counts[word]) df[word] = (df[word] || 0) + 1; });
      totalLength += cached.length; return { hit: hit, counts: counts, length: cached.length };
    });
    var average = totalLength / Math.max(1, docs.length) || 1;
    return docs.map(function(doc) {
      var score = 0;
      q.forEach(function(word) { var tf = doc.counts[word] || 0; if (tf) score += Math.log(1 + (docs.length - df[word] + 0.5) / (df[word] + 0.5)) * tf * 2.2 / (tf + 1.2 * (0.25 + 0.75 * doc.length / average)); });
      if (String(query).length >= 2 && body(doc.hit).toLowerCase().includes(String(query).toLowerCase())) score += 1;
      return { hit: doc.hit, score: score };
    }).filter(function(row) { return row.score > 0; }).sort(function(a, b) { return b.score - a.score || key(a.hit).localeCompare(key(b.hit)); }).slice(0, limit || 60);
  }
  function overlap(a, b) {
    var aa = new Set(tokens(body(a))), bb = new Set(tokens(body(b))), count = 0;
    aa.forEach(function(word) { if (bb.has(word)) count++; });
    return count / Math.max(1, aa.size + bb.size - count);
  }
  function fuse(lexicalRows, vectors, topK) {
    var pool = Object.create(null);
    [lexicalRows.map(function(r) { return r.hit; }), vectors].forEach(function(rows, channel) {
      rows.forEach(function(hit, index) { var id = key(hit), row = pool[id];
        if (!row) row = pool[id] = { hit: hit, score: 0, channels: [] };
        if (row.channels.includes(channel)) return;
        row.score += 1 / (60 + index + 1); row.channels.push(channel);
      });
    });
    var candidates = Object.keys(pool).map(function(id) { var row = pool[id]; row.words = new Set(tokens(body(row.hit))); row.similarity = 0; return row; }), selected = [];
    while (selected.length < topK && candidates.length) {
      var latest = selected.length ? selected[selected.length - 1] : null;
      candidates.forEach(function(row) {
        if (latest) { var count = 0; row.words.forEach(function(word) { if (latest.words.has(word)) count++; }); row.similarity = Math.max(row.similarity, count / Math.max(1, row.words.size + latest.words.size - count)); }
        row.utility = row.score * (1 - 0.35 * row.similarity);
      });
      candidates.sort(function(a, b) { return b.utility - a.utility || key(a.hit).localeCompare(key(b.hit)); }); selected.push(candidates.shift());
    }
    return selected.map(function(row) { return Object.assign({}, row.hit, { relevance: Math.min(1, 0.6 + row.score * 8), _hybrid: { channels: row.channels.map(function(c) { return c ? 'vector' : 'lexical'; }), rrf: row.score } }); });
  }
  function limit(value, fallback, maximum) { var n = Number(value); return Number.isFinite(n) && n > 0 ? Math.min(maximum, Math.floor(n)) : fallback; }
  function lease(gm) {
    var state = [gm.turn, gm._campaignId, gm._timelineId, gm.campaignId, gm.timelineId, root._tmLoadGen].join('|'), currentRoot = root.GM;
    return function() { return (!currentRoot || root.GM === currentRoot) && state === [gm.turn, gm._campaignId, gm._timelineId, gm.campaignId, gm.timelineId, root._tmLoadGen].join('|'); };
  }
  function snippet(hit, query, maxChars) {
    var out = Object.assign({}, hit), value = body(hit), terms = tokens(query), at = -1;
    terms.some(function(term) { at = value.toLowerCase().indexOf(term); return at >= 0; });
    var start = at > maxChars / 2 ? Math.max(0, at - Math.floor(maxChars / 3)) : 0;
    out.text = value.slice(start, start + maxChars); out.safeBody = out.text; out.excerptOffset = start; out.excerpted = out.text.length < value.length;
    return out;
  }
  async function search(gm, query, opts) {
    opts = opts || {}; if (!gm || !String(query || '').trim()) return { hits: [], diagnostics: { empty: true } };
    var active = lease(gm), profile = root.TM.MemoryAdaptive ? root.TM.MemoryAdaptive.plan({ tier: opts.tier || 'primary' }) : { topK: 12, perHitChars: 240 };
    var topK = limit(opts.topK || opts.limit, profile.topK, 40), hits = collect(gm, opts), vectorHits = [], vectorError = '';
    var lex = lexical(hits, String(query).slice(0, 512), Math.min(100, topK * 4));
    if (opts.vector !== false && root.SemanticRecall && root.SemanticRecall.searchSyncSafe) {
      try { vectorHits = await root.SemanticRecall.searchSyncSafe(String(query).slice(0, 512), Object.assign({}, opts, { topK: Math.min(100, topK * 3), GM: gm })); }
      catch (_) { vectorError = 'vector_unavailable'; }
    }
    if (!active() || (opts.signal && opts.signal.aborted)) return { hits: [], diagnostics: { stale: true } };
    var byId = Object.create(null); hits.forEach(function(h) { byId[h.id] = h; });
    vectorHits = (Array.isArray(vectorHits) ? vectorHits : []).map(function(h) { return byId[h.memoryId || h.id] || h; });
    if (root.TM.MemoryRetrieval) vectorHits = root.TM.MemoryRetrieval.rankHitsDetailed(vectorHits, Object.assign({ GM: gm, turn: gm.turn, audience: 'system', intent: 'historical_evidence' }, opts)).ranked || [];
    var fused = fuse(lex, vectorHits, topK), maxChars = limit(opts.maxChars, profile.perHitChars, 1600);
    return { hits: fused.map(function(h) { return snippet(h, query, maxChars); }), diagnostics: { candidates: hits.length, lexical: lex.length, vector: vectorHits.length, selected: fused.length, vectorError: vectorError, mode: profile.mode || 'balanced' } };
  }
  function read(gm, ids, opts) {
    opts = opts || {};
    ids = (Array.isArray(ids) ? ids : [ids]).map(String).slice(0, 6);
    return collect(gm, opts).filter(function(h) {
      return ids.includes(String(h.id));
    }).slice(0, 6).map(function(h) {
      return snippet(h, '', limit(opts.maxChars, 1000, 1600));
    });
  }
  function related(gm, ids, opts) {
    opts = opts || {};
    var pool = collect(gm, opts);
    var selectedIds = new Set((Array.isArray(ids) ? ids : [ids]).map(String).slice(0, 6));
    var targets = new Set();
    pool.filter(function(h) { return selectedIds.has(String(h.id)); }).forEach(function(h) {
      (h.sourceRefs || []).forEach(function(r) {
        if (r && r.id) { selectedIds.add(String(r.id)); selectedIds.add(r.type + ':' + r.id); }
      });
    });
    (Array.isArray(gm._memEdges) ? gm._memEdges : []).slice(-500).forEach(function(edge) {
      if (!edge || edge.active === false || (edge.turn != null && Number(edge.turn) > Number(gm.turn))) return;
      if (!['causes','continues','elaborates','supports','related','related_to','resolves','supersedes','contradicts'].includes(edge.type)) return;
      if (selectedIds.has(String(edge.src))) targets.add(String(edge.dst));
      if (selectedIds.has(String(edge.dst))) targets.add(String(edge.src));
    });
    return pool.filter(function(h) {
      return targets.has(String(h.id)) || (h.sourceRefs || []).some(function(r) {
        return r && (targets.has(String(r.id)) || targets.has(r.type + ':' + r.id));
      });
    }).slice(0, limit(opts.limit, 12, 30));
  }
  NS.tokens = tokens; NS.lexical = lexical; NS.fuse = fuse; NS.collect = collect;
  NS.search = search; NS.read = read; NS.related = related; NS.lease = lease;
})(typeof window !== 'undefined' ? window : globalThis);
