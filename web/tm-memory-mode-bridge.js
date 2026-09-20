// Both turn modes share evidence policy; their orchestration and write authority remain separate.
(function(root) {
  'use strict';
  var TM = root.TM = root.TM || {};
  if (TM.MemoryModeBridge) return;
  var READS = ['recall_history', 'read_memory', 'recall_related'];
  function profile(tier) {
    return TM.MemoryAdaptive ? TM.MemoryAdaptive.plan({ tier: tier || 'primary' }) : { memoryTokens: 1800, perHitChars: 180, topK: 8, consolidationOutput: 2000, mode: 'balanced' };
  }
  function tokens(text) { return TM.ContextZones && TM.ContextZones.estimateTokens ? TM.ContextZones.estimateTokens(text) : Math.ceil(String(text).length * 1.3); }
  function budget(p) {
    var conf = (root.P || {}).conf || {};
    var value = conf.memoryRecallTokenBudget;
    if (value == null) return p.memoryTokens;
    var n = Number(value); return Number.isFinite(n) && n >= 0 ? Math.min(12000, Math.floor(n)) : p.memoryTokens;
  }
  function serial(hit, chars) {
    return { id: String(hit.id || ''), source: hit.source || '', turn: hit.turn, kind: hit.memoryKind || hit.type || '',
      authority: hit.authority || 'unknown', status: hit.status || '', readScope: hit.readScope || '',
      validFromTurn: hit.validFromTurn, validToTurn: hit.validToTurn, expiredAtTurn: hit.expiredAtTurn,
      sourceRefs: (hit.sourceRefs || []).slice(0, 12),
      text: String(hit.safeBody != null ? hit.safeBody : hit.text || '').slice(0, chars) };
  }
  function pack(hits, opts) {
    opts = opts || {}; var p = profile(), max = opts.maxTokens == null ? budget(p) : opts.maxTokens, kept = [];
    var source = Array.isArray(hits) ? hits : [], chars = opts.expanded ? 1400 : p.perHitChars;
    if (max <= 0) return { text: '', hits: [], candidateCount: source.length, tokenEstimate: 0 };
    var output = '';
    for (var i = 0; i < source.length; i++) {
      var item = serial(source[i], chars);
      if (!item.id || !item.text) continue;
      var candidate = JSON.stringify({ memoryEvidence: kept.concat([item]), remainingCount: source.length - kept.length - 1 });
      if (tokens(candidate) > max) continue;
      kept.push(item); output = candidate;
    }
    return { text: output, hits: kept, candidateCount: source.length, tokenEstimate: tokens(output) };
  }
  async function read(name, input, ctx) {
    input = input || {}; ctx = ctx || {}; var gm = ctx.GM || root.GM, p = profile();
    if (!gm || !TM.MemoryAgentTools) return { ok: false, name: name, text: '(记忆服务未加载)', hits: [] };
    var generation = root._tmLoadGen, turn = gm.turn, timeline = gm._timelineId, liveGM = root.GM, player = root.P;
    var map = name === 'recall_history' ? 'recall_by_term' : name;
    var args = name === 'recall_history' ? { terms: [String(input.query || '').slice(0, 240)], limit: p.topK } : input;
    var response = await TM.MemoryAgentTools.exec(map, args, gm);
    if (root.GM !== liveGM || root.P !== player || root._tmLoadGen !== generation || gm.turn !== turn || gm._timelineId !== timeline) return { ok: false, stale: true, name: name, text: '(读取期间世界已改变，结果已丢弃)', hits: [] };
    var packed = pack(response && response.hits, { expanded: name === 'read_memory' });
    return { ok: !!response && response.ok !== false, name: name, text: packed.text || '(未找到可注入的记忆证据)', hits: packed.hits, tokenEstimate: packed.tokenEstimate };
  }
  function dossier(gm, opts) {
    opts = opts || {}; var p = profile(opts.tier), compiler = TM.MemoryContextCompiler;
    if (!compiler || !compiler.compileFromGM || !gm) return '';
    var compiled = compiler.compileFromGM(gm, { GM: gm, turn: gm.turn, audience: 'system', intent: 'historical_evidence', maxTokens: budget(p), perHitMaxChars: p.perHitChars });
    return compiled.ok ? compiled.text : '';
  }
  function memoryDepth() {
    var raw = ((root.P || {}).conf || {}).agentMemoryDepth, p = profile(), n = Number(raw);
    return raw != null && Number.isFinite(n) ? Math.max(1, Math.min(30, Math.floor(n))) : ({ compact: 3, balanced: 6, deep: 10 }[p.mode] || 6);
  }
  function enqueue(gm, parsed) {
    if (!TM.MemoryLongTerm || !TM.MemoryWriteGate) throw new Error('长期记忆写入服务未加载');
    var candidates = TM.MemoryLongTerm.candidates(gm, parsed || {}), count = 0;
    candidates.forEach(function(candidate) { if (TM.MemoryWriteGate.enqueue(gm, candidate, { forceDraft: true })) count++; });
    return { candidates: candidates.length, queued: count };
  }
  function archive(gm, result, ctx) {
    if (!TM.MemoryTurnArchive || !TM.MemoryTurnRollup || !TM.MemoryLongTerm) throw new Error('回合记忆归档服务未加载');
    var archived = TM.MemoryTurnArchive.archiveTurn(gm, result, { sourceId: 'AGENT', sourceType: 'agentTurnResult', turn: gm.turn });
    var rollup = archived.archived ? TM.MemoryTurnRollup.rebuildFromArchive(gm, { turn: gm.turn }) : null;
    if (ctx) { ctx.meta = ctx.meta || {}; ctx.meta.memoryArchive = archived; ctx.meta.memoryRollup = rollup; }
    return archived;
  }
  function tagSummary(gm, record, body) {
    var bound = TM.MemorySourceBound;
    if (!bound || !bound.buildSummaryMetadata) return record;
    var meta = bound.buildSummaryMetadata(gm, { type: 'agent_memory_summary', turn: gm.turn, text: body,
      sourceItems: (gm._turnReport || []).slice(-30), maxBasisRefs: 24 });
    ['id','sourceRefs','basisRefs','contentHash','authorityLevel','authorityRank','basisMaxAuthorityRank','factStatus','lane'].forEach(function(k) { if (meta && meta[k] != null) record[k] = meta[k]; });
    return record;
  }
  TM.MemoryModeBridge = { profile: profile, budget: budget, pack: pack, read: read, dossier: dossier, memoryDepth: memoryDepth,
    enqueue: enqueue, archive: archive, tagSummary: tagSummary, isRead: function(name) { return READS.indexOf(name) >= 0; },
    candidateRoots: ['_memoryWriteQueue', '_memoryDraftInbox', '_memoryQuarantine', '_memoryAccepted', '_memoryAuditEvents', '_memoryLongTerm', '_memoryRevision'] };
})(typeof window !== 'undefined' ? window : globalThis);
