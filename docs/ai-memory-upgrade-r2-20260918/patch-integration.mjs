import { edit } from './patch-utils.mjs';
edit('web/tm-ai-schema.js', (s, r) => {
  const line = s.split('\n').find(line => line.includes('    long_term_memory_updates:'));
  if (!line) throw Error('long-term schema field missing');
  return r(s, line.trimEnd(), "    long_term_memory_updates: { type: 'array', desc: 'Source-bound long-term memory candidates; WriteGate only', requiredSubFields: ['kind', 'memory', 'confidence', 'source_refs'], consumedBy: ['MemoryTurnInference.collectPostTurnCandidates'] },");
});
edit('web/tm-ai-output-validator.js', (s, r) => r(s, "    character_memory_updates: ['actor', 'memory', 'confidence', 'source_refs'],", "    character_memory_updates: ['actor', 'memory', 'confidence', 'source_refs'],\n    long_term_memory_updates: ['kind', 'memory', 'confidence', 'source_refs'],"));
edit('web/tm-memory-retrieval.js', (s, r) => r(s, '      memoryKind: env.memoryKind || (env.extra && env.extra.memoryKind) || "",', '      memoryKind: env.memoryKind || (env.extra && env.extra.memoryKind) || (root.TM.MemoryLongTerm && Object.prototype.hasOwnProperty.call(root.TM.MemoryLongTerm.types, env.type) ? env.type : ""),'));
edit('web/tm-memory-hybrid.js', (s) => { if (s.split('root._tmLoadGeneration').length !== 3) throw Error('Expected both lease generation reads'); return s.replaceAll('root._tmLoadGeneration', 'root._tmLoadGen'); });
edit('web/tm-endturn-ai.js', (s, r) => {
  s = r(s, "              if (global.TM && global.TM.MemoryRetrieval && typeof global.TM.MemoryRetrieval.rankHitsDetailed === 'function') {\n                var _rankedRecall", "              if (global.TM && global.TM.MemoryHybrid) {\n                var _hybridTerm = String(q.query || (Array.isArray(q.keywords) ? q.keywords.join(' ') : q.participant || '')).slice(0, 512);\n                if (_hybridTerm) { var _hybridRecall = await global.TM.MemoryHybrid.search(GM, _hybridTerm, { vector: false, limit: 12 }); allHits = allHits.concat(_hybridRecall.hits || []); }\n              }\n              if (global.TM && global.TM.MemoryRetrieval && typeof global.TM.MemoryRetrieval.rankHitsDetailed === 'function') {\n                var _rankedRecall");
  const old = 'maxTokens: P && P.conf && P.conf.memoryRecallZoneTokenBudget != null ? P.conf.memoryRecallZoneTokenBudget : (P && P.conf && P.conf.memoryRecallTokenBudget != null ? P.conf.memoryRecallTokenBudget : 1200),';
  s = r(s, old, 'maxTokens: P && P.conf && P.conf.memoryRecallZoneTokenBudget != null ? P.conf.memoryRecallZoneTokenBudget : (P && P.conf && P.conf.memoryRecallTokenBudget != null ? P.conf.memoryRecallTokenBudget : (global.TM.MemoryAdaptive ? global.TM.MemoryAdaptive.budget("memoryRecallTokenBudget", 1200) : 1200)),');
  s = r(s, '                perHitMaxChars: 100,\n                suppressed: _traceSuppressed', '                perHitMaxChars: global.TM.MemoryAdaptive ? global.TM.MemoryAdaptive.plan().perHitChars : 100,\n                suppressed: _traceSuppressed');
  s = r(s, '              maxTokens: _sc1MemBudget,\n              sc1q:', '              maxTokens: _sc1MemBudget,\n              perHitMaxChars: global.TM.MemoryAdaptive ? global.TM.MemoryAdaptive.plan().perHitChars : 180,\n              sc1q:');
  return s;
});
edit('web/tm-ai-infra-model-detect.js', (s, r) => {
  let count = 0;
  s = s.replace(/(\} catch\(e[1-6]\) \{[^\n]+\{ weight:)\d+( \}\); \})/g, (_all, a, b) => { count++; return a + "0, state:'unavailable'" + b; });
  if (count !== 6) throw Error('Expected six transport outcome handlers, found ' + count);
  s = r(s, 'Math.floor((opts.contextChars || 10000) / fillerUnit.length)', 'Math.floor(Math.min(24000, Math.max(2000, Number(opts.contextChars) || 10000)) / fillerUnit.length)');
  return s;
});
