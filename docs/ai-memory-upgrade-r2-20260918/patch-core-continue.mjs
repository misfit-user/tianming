import { edit } from './patch-utils.mjs';
edit('web/tm-memory-envelope.js', (s, r) => r(s,
  '    pushCharacterStanceEnvelopes(out, GM, turn);',
  '    pushCharacterStanceEnvelopes(out, GM, turn);\n    if (root.TM.MemoryLongTerm && root.TM.MemoryLongTerm.project) out = out.concat(root.TM.MemoryLongTerm.project(GM));'
));
edit('web/tm-memory-retrieval.js', (s, r) => {
  s = r(s, '      projectionVersion: env.projectionVersion,', '      projectionVersion: env.projectionVersion,\n      memoryKind: env.memoryKind || (env.extra && env.extra.memoryKind) || "",\n      longTerm: env.longTerm === true,');
  return s;
});
edit('web/tm-memory-writegate.js', (s, r) => {
  s = r(s, '    pruned += capAcceptedProtected(GM, GM._memoryAccepted, caps.accepted || DEFAULT_CAPS.accepted);', '    if (root.TM.MemoryLongTerm && root.TM.MemoryLongTerm.capture) root.TM.MemoryLongTerm.capture(GM, GM._memoryAccepted);\n    pruned += capAcceptedProtected(GM, GM._memoryAccepted, caps.accepted || DEFAULT_CAPS.accepted);');
  s = r(s, '    item.extra = extra;', '    item.extra = extra;\n    ["memoryKind", "campaignId", "timelineId", "validFromTurn", "validToTurn", "expiredAtTurn", "learnedAtTurn"].forEach(function(k) { if (candidate[k] != null) item[k] = candidate[k]; });');
  return s;
});
edit('web/tm-memory-turn-inference.js', (s, r) => {
  s = r(s, '      .concat(forgetCandidates(GM, aiResult || {}, opts));', '      .concat(forgetCandidates(GM, aiResult || {}, opts))\n      .concat(root.TM.MemoryLongTerm ? root.TM.MemoryLongTerm.candidates(GM, aiResult || {}) : []);');
  s = r(s, "      if (item.type !== 'character_memory') return;", "      if (item.type !== 'character_memory' && !(item.extra && item.extra.sourceBound === true && item.extra.literalEvidence === true)) return;");
  return s;
});
edit('web/tm-memory-turn-rollup.js', (s, r) => r(s, '    return result;\n  }\n\n  ns.SCHEMA_VERSION', '    if (root.TM.MemoryLongTerm && root.TM.MemoryLongTerm.harvest) result.longTerm = root.TM.MemoryLongTerm.harvest(GM);\n    return result;\n  }\n\n  ns.SCHEMA_VERSION'));
edit('web/tm-memory-context-compiler.js', (s, r) => {
  s = r(s, "    if (authority === 'rumor' || src === 'rumor') return 'warnings';", "    if (authority === 'rumor' || src === 'rumor') return 'warnings';\n    if (hit.memoryKind === 'unresolved_thread') return 'stateAffairs';\n    if (hit.memoryKind === 'decision_rationale') return 'courtRecords';\n    if (hit.memoryKind === 'causal_lesson' || hit.memoryKind === 'economic_pattern') return 'warnings';\n    if (hit.memoryKind === 'institutional_memory' || hit.memoryKind === 'territorial_change' || hit.memoryKind === 'correction') return 'chronology';");
  s = r(s, '    if (hit.temporalUse) attrs.push(', '    if (hit.memoryKind) attrs.push(\'memory-kind="\' + xml(hit.memoryKind) + \'"\');\n    if (hit.temporalUse) attrs.push(');
  return s;
});
edit('web/tm-endturn-ai.js', (s, r) => {
  const field = "          character_memory_updates: { type: 'array', items: { type: 'object', additionalProperties: true } },";
  s = r(s, field, field + "\n          long_term_memory_updates: { type: 'array', items: { type: 'object', additionalProperties: true } },");
  s = r(s, 'var _maxRecallTokens = P && P.conf && P.conf.memoryRecallTokenBudget != null ? P.conf.memoryRecallTokenBudget : 1200;', 'var _maxRecallTokens = P && P.conf && P.conf.memoryRecallTokenBudget != null ? P.conf.memoryRecallTokenBudget : (global.TM.MemoryAdaptive ? global.TM.MemoryAdaptive.budget("memoryRecallTokenBudget", 1200) : 1200);');
  s = r(s, "            : (P && P.conf && P.conf.memoryTurnContextTokenBudget);", "            : (P && P.conf && P.conf.memoryTurnContextTokenBudget != null ? P.conf.memoryTurnContextTokenBudget : (global.TM.MemoryAdaptive ? global.TM.MemoryAdaptive.budget('memorySc1ContextTokenBudget', 1800) : 1800));");
  s = r(s, "      tp1 += 'Optional field character_memory_updates must be an array.", "      tp1 += 'Optional long_term_memory_updates is an array of {kind,memory,confidence,source_refs,entities}. Kinds: episodic_event,semantic_fact,character_memory,relationship_event,commitment,decision_rationale,causal_lesson,institutional_memory,territorial_change,economic_pattern,unresolved_thread,correction. Use only IDs supplied in memory context as source_refs; omit unverifiable claims. Preserve uncertainty and separate completed obligations from open ones. Maximum 8 entries. ';\n      tp1 += 'Optional field character_memory_updates must be an array.");
  return s;
});
edit('web/tm-ai-output-validator.js', (s, r) => r(s, "    character_memory_updates: 'array',", "    character_memory_updates: 'array',\n    long_term_memory_updates: 'array',"));
edit('web/tm-ai-schema.js', (s, r) => r(s, '    character_memory_updates: {', "    long_term_memory_updates: { type: 'array', items: { type: 'object', properties: { kind: { type: 'string' }, memory: { type: 'string' }, confidence: { type: 'number' }, source_refs: { type: 'array', items: { type: 'string' } }, entities: { type: 'array', items: { type: 'string' } } }, required: ['kind', 'memory', 'confidence', 'source_refs'] } },\n    character_memory_updates: {"));
