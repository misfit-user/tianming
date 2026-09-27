// Bounded, source-preserving archive independent of the active model's context size.
(function(root) {
  'use strict';
  root.TM = root.TM || {};
  var NS = root.TM.MemoryLongTerm = root.TM.MemoryLongTerm || {};
  var MAX_RECORDS = 2048, MAX_CHARS = 2400000;
  var TYPES = Object.freeze({ episodic_event: '事件经历', semantic_fact: '事实知识', character_memory: '人物经历', relationship_event: '关系变化', commitment: '承诺义务', decision_rationale: '决策依据', causal_lesson: '因果与经验', institutional_memory: '制度沿革', territorial_change: '地域变迁', economic_pattern: '经济变化', unresolved_thread: '未解线索', correction: '纠错记录' });
  function list(value) { return Array.isArray(value) ? value : []; }
  function text(value, max) { return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max || 1600); }
  function hash(value) { var h = 2166136261, s = String(value); for (var i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0).toString(16); }
  function category(record) {
    if (Object.prototype.hasOwnProperty.call(TYPES, record.memoryKind)) return record.memoryKind;
    if (Object.prototype.hasOwnProperty.call(TYPES, record.type)) return record.type;
    if (/issue|affair/.test(record.type || '')) return 'unresolved_thread';
    if (/court_resolution/.test(record.type || '')) return 'decision_rationale';
    if (/law|edict/.test(record.type || '')) return 'institutional_memory';
    if (/procedural|lesson/.test(record.type || '')) return 'causal_lesson';
    return 'episodic_event';
  }
  function allowed(records, gm) {
    var retrieval = root.TM.MemoryRetrieval;
    if (!retrieval || !retrieval.rankHitsDetailed) return [];
    return retrieval.rankHitsDetailed(records, { GM: gm, turn: gm.turn, audience: 'system', actorScope: 'system', intent: 'historical_evidence', includeHidden: false }).ranked || [];
  }
  function capture(gm, records) {
    if (!gm || !records || !records.length) return { added: 0, total: list(gm && gm._memoryLongTerm && gm._memoryLongTerm.records).length };
    var previous = gm._memoryLongTerm || {}, rows = list(previous.records).filter(function(row) { return row && typeof row === "object" && row.id; }).slice(-MAX_RECORDS), byId = Object.create(null), changed = 0;
    rows.forEach(function(r, i) { if (r && r.id) byId[r.id] = i; });
    allowed(records, gm).forEach(function(item) {
      var states = [item.status, item.reviewStatus, item.factStatus].join('|');
      if (!item.id || /draft|pending_review|quarantin|rejected|deleted/.test(states) || item.source === 'hard_state' || item.type === 'hard_state') return;
      var body = item.safeBody != null ? item.safeBody : (item.body || item.text || '');
      if (!text(body) || !list(item.sourceRefs).length) return;
      var rec = { id: text(item.id, 160), body: text(body), safeBody: text(body), memoryKind: category(item), type: item.type || 'episodic_event', retainedAtTurn: Number(gm.turn) || 0 };
      ['source','turn','status','reviewStatus','authority','authorityRank','confidence','readScope','writeScope','ownerScope','ownerId','ownerKind','visibility','worldId','saveId','campaignId','timelineId','validFromTurn','validToTurn','expiredAtTurn','learnedAtTurn','lane','factStatus','pinned','importance','factKey'].forEach(function(k) { if (item[k] != null) rec[k] = item[k]; });
      ['sourceRefs','basisRefs','invalidationRefs','entities','audience'].forEach(function(k) { rec[k] = JSON.parse(JSON.stringify(list(item[k]).slice(0, 24))); });
      rec.contentHash = hash(rec.safeBody); rec.excerpted = String(body).length > rec.safeBody.length;
      var at = byId[rec.id], old = at == null ? null : rows[at];
      if (old) { rec.retainedAtTurn = old.retainedAtTurn; if (old.durableControl) rec.durableControl = old.durableControl; }
      if (old && JSON.stringify(old) === JSON.stringify(rec)) return;
      if (at == null) { byId[rec.id] = rows.length; rows.push(rec); } else rows[at] = rec;
      changed++;
    });
    if (!changed) return { added: 0, total: rows.length };
    function priority(r) {
      var control = root.TM.MemoryRetrieval.memoryControlForHit(r, { GM: gm }) || {};
      return (control.pinned || control.resident || r.pinned ? 1000000 : 0) + (r.memoryKind === 'commitment' || r.memoryKind === 'unresolved_thread' ? 10000 : 0) + (Number(r.authorityRank) || 40) * 10 + Math.max(0, Number(r.turn) || 0);
    }
    rows.sort(function(a, b) { return priority(b) - priority(a) || String(a.id).localeCompare(String(b.id)); });
    var kept = [], chars = 0, dropped = 0;
    rows.forEach(function(r) { var size = JSON.stringify(r).length; if (kept.length < MAX_RECORDS && chars + size <= MAX_CHARS) { kept.push(r); chars += size; } else dropped++; });
    kept.sort(function(a, b) { return (Number(a.turn) || 0) - (Number(b.turn) || 0) || String(a.id).localeCompare(String(b.id)); });
    gm._memoryLongTerm = { version: 1, records: kept, revision: (Number(previous.revision) || 0) + 1, chars: chars, droppedTotal: (Number(previous.droppedTotal) || 0) + dropped, lastRetainedTurn: Number(gm.turn) || 0 }; // arch-ok MemoryLongTerm owns the bounded durable evidence archive
    if (root.TM.MemoryRetrieval.bumpRevision) root.TM.MemoryRetrieval.bumpRevision(gm);
    return { added: changed, total: kept.length, dropped: dropped, chars: chars };
  }
  function project(gm) {
    var envelope = root.TM.MemoryEnvelope;
    if (!envelope || !envelope.makeEnvelope) return [];
    return list(gm && gm._memoryLongTerm && gm._memoryLongTerm.records).slice(-MAX_RECORDS).filter(function(row) { return row && typeof row === "object" && row.id; }).map(function(record) {
      var env = envelope.makeEnvelope(Object.assign({}, record, { maxBody: 1600, safeBodyMax: 1600 })); env.durableControl = record.durableControl; env.memoryKind = record.memoryKind || category(record); env.longTerm = true;
      return env;
    });
  }
  function harvest(gm) {
    var envelope = root.TM.MemoryEnvelope, retrieval = root.TM.MemoryRetrieval;
    if (!gm || !envelope || !retrieval) return { added: 0 };
    var records = envelope.collect(gm).filter(function(env) { return !env.longTerm && env.type !== 'hard_state' && env.type !== 'active_law' && env.type !== 'commitment'; });
    return capture(gm, records.map(retrieval.hitFromEnvelope));
  }
  function candidates(gm, result) {
    var updates = list(result && result.long_term_memory_updates).slice(0, 16), out = [];
    if (!updates.length || !gm || !root.TM.MemoryEnvelope || !root.TM.MemoryRetrieval) return out;
    var refs = Object.create(null);
    var sources = allowed(root.TM.MemoryEnvelope.collect(gm).map(root.TM.MemoryRetrieval.hitFromEnvelope), gm);
    sources.forEach(function(s) {
      refs[s.id] = s;
      list(s.sourceRefs).forEach(function(r) { if (r && r.type && r.id) refs[r.type + ':' + r.id] = s; });
    });
    updates.forEach(function(update) {
      if (!update || !Object.prototype.hasOwnProperty.call(TYPES, update.kind)) return;
      var body = text(update.memory), confidence = Number(update.confidence), explicit = list(update.source_refs).slice(0, 12), found = [];
      explicit.forEach(function(ref) { var key = typeof ref === 'string' ? ref : (ref && ref.type && ref.id ? ref.type + ':' + ref.id : ref && ref.id); if (key && refs[key] && found.indexOf(refs[key]) < 0) found.push(refs[key]); });
      if (!body || body.length < 10) return;
      var valid = Number.isFinite(confidence) && confidence >= 0.7 && confidence <= 1 && explicit.length > 0 && explicit.every(function(ref) { var key = typeof ref === 'string' ? ref : (ref && ref.type && ref.id ? ref.type + ':' + ref.id : ref && ref.id); return !!refs[key]; });
      var publicOnly = found.length > 0 && found.every(function(s) { return (!s.readScope || s.readScope === 'public') && ['public','court','world_truth','player_known'].includes(s.visibility || 'public'); });
      var basis = found.map(function(s) { return { type: 'memory', id: s.id, turn: s.turn }; });
      var literal = valid && found.some(function(s) { return String(s.safeBody != null ? s.safeBody : s.text).indexOf(body) >= 0 && Number(s.authorityRank) >= 58; });
      var candidate = { id: 'lt-' + hash(update.kind + '|' + body + '|' + JSON.stringify(basis)), type: update.kind, memoryKind: update.kind, body: body, safeBody: body,
        authority: 'ai_extracted', source: 'ai_extracted', confidence: confidence, turn: Number(gm.turn) || 0,
        campaignId: gm._campaignId || gm.campaignId || '', timelineId: gm._timelineId || gm.timelineId || '',
        readScope: publicOnly ? 'public' : 'system', visibility: publicOnly ? 'public' : 'gm_only', sourceRefs: basis, basisRefs: basis,
        entities: list(update.entities).map(function(s) { return text(s, 80); }).slice(0, 8), lane: 'L6_retrieved_evidence',
        extra: { memoryKind: update.kind, confidence: confidence, sourceBound: valid, literalEvidence: literal && publicOnly, qualityStatus: valid ? 'draftable' : 'quarantined' } };
      if (!valid) { candidate.status = 'quarantined'; candidate.reviewStatus = 'quarantined'; candidate.reasons = [{ code: 'unverified_long_term_basis', message: 'long-term memory requires known evidence and finite confidence' }]; }
      out.push(candidate);
    });
    return out;
  }
  function syncControls(gm, clearedKey) {
    var store = gm && gm._memoryLongTerm, retrieval = root.TM.MemoryRetrieval;
    if (!store || !retrieval || !list(store.records).length) return 0;
    var changed = 0;
    var rows = store.records.map(function(record) {
      if (!record || typeof record !== "object" || !record.id) return record;
      var probe = Object.assign({}, record); delete probe.durableControl;
      var control = retrieval.memoryControlForHit(probe, { GM: gm, ignoreDurable: true });
      var previous = record.durableControl;
      if (!control && !(previous && previous.key === clearedKey)) return record;
      var compact = control ? { key: text(control.key, 180) } : null;
      if (control) ['hidden','archived','markedFalse','pinned','resident','supersededBy','cooldownUntilTurn'].forEach(function(k) { if (control[k] != null) compact[k] = control[k]; });
      if (JSON.stringify(previous || null) === JSON.stringify(compact)) return record;
      var out = Object.assign({}, record); if (compact) out.durableControl = compact; else delete out.durableControl;
      changed++; return out;
    });
    if (changed) {
      var chars = rows.reduce(function(n, row) { return n + JSON.stringify(row).length; }, 0), removed = 0;
      while (chars > MAX_CHARS && rows.length) { var old = rows.shift(); chars -= JSON.stringify(old).length; removed++; }
      gm._memoryLongTerm = Object.assign({}, store, { records: rows, chars: chars, revision: (store.revision || 0) + 1, droppedTotal: (store.droppedTotal || 0) + removed }); // arch-ok MemoryLongTerm owns durable control snapshots
      if (retrieval.bumpRevision) retrieval.bumpRevision(gm);
    }
    return changed;
  }

  function stats(gm) {
    var store = gm && gm._memoryLongTerm || {}, kinds = Object.create(null);
    list(store.records).forEach(function(r) { if (!r || typeof r !== "object") return; var k = r.memoryKind || category(r); kinds[k] = (kinds[k] || 0) + 1; });
    return { records: list(store.records).length, maxRecords: MAX_RECORDS, chars: Number(store.chars) || 0, maxChars: MAX_CHARS, dropped: Number(store.droppedTotal) || 0, kinds: kinds };
  }
  NS.types = TYPES; NS.capture = capture; NS.project = project; NS.harvest = harvest; NS.candidates = candidates; NS.stats = stats; NS.syncControls = syncControls;
})(typeof window !== 'undefined' ? window : globalThis);
