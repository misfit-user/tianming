import { edit } from './patch-utils.mjs';
edit('web/index.html', (s, r) => {
  const tag = s.match(/<script src="tm-memory-agent-tools\.js[^\"]*"><\/script>/)[0];
  return r(s, tag, tag + '\n<script src="tm-memory-mode-bridge.js?v=20260918-reliability"></script>');
});
edit('web/tm-endturn-agent-read-tools.js', (s, r) => {
  s = r(s, '  var SPECS = DEFS.map(', "  DEFS.push({ name: 'read_memory', description: '根据记忆 ID 展开证据与来源，不得编造 ID。', parameters: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' }, maxItems: 6 } }, required: ['ids'] } },\n    { name: 'recall_related', description: '沿记忆因果、解决与矛盾关系追查一跳关联证据。', parameters: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' }, maxItems: 6 } }, required: ['ids'] } });\n  var SPECS = DEFS.map(");
  s = r(s, '    var gm = _GM(ctx);\n    try {\n      switch (name)', '    var gm = _GM(ctx);\n    try {\n      if (TM.MemoryModeBridge && TM.MemoryModeBridge.isRead(name)) return await TM.MemoryModeBridge.read(name, input, ctx);\n      switch (name)');
  return s;
});
edit('web/tm-endturn-agent-mode.js', (s, r) => {
  s = r(s, 'var memDepth = Math.max(1, Math.round((Pm.conf && Pm.conf.agentMemoryDepth) || 6));', 'var memDepth = TM.MemoryModeBridge ? TM.MemoryModeBridge.memoryDepth() : Math.max(1, Math.round((Pm.conf && Pm.conf.agentMemoryDepth) || 6));');
  const at = s.indexOf('  function _memoryDossier('), end = s.indexOf('\n  //', at + 100), fragment = s.slice(at, end);
  if (!fragment.includes('var parts = [];')) throw Error('Memory dossier declaration unavailable');
  s = r(s, fragment, fragment.replace('var parts = [];', 'var parts = [];\n    if (TM.MemoryModeBridge) { var shared = TM.MemoryModeBridge.dossier(gm); if (shared) parts.push(shared); }'));
  s = r(s, '        var resultLines = [];', '        var resultLines = [];\n        var memoryRoundBudget = TM.MemoryModeBridge ? TM.MemoryModeBridge.budget(TM.MemoryModeBridge.profile()) : 0;');
  const line = s.split('\n').find(l => l.includes("resultLines.push('· '") && l.includes('.slice(0, 500)'));
  if (!line) throw Error('Agent result truncation point unavailable');
  s = r(s, line.trimEnd(), "          if (TM.MemoryModeBridge && TM.MemoryModeBridge.isRead(c.name)) {\n            var evidence = TM.MemoryModeBridge.pack(r && r.hits, { maxTokens: memoryRoundBudget, expanded: c.name === 'read_memory' });\n            memoryRoundBudget = Math.max(0, memoryRoundBudget - evidence.tokenEstimate);\n            resultLines.push(c.name + ': ' + (evidence.text || '(记忆结果未装入：无证据或本轮预算已用尽)'));\n          } else {\n" + line.trimEnd() + '\n          }');
  return s;
});
edit('web/tm-endturn-agent-depth-tools.js', (s, r) => {
  s = r(s, 'var _memDepth = Math.max(2, Math.round((_Pmd.conf && _Pmd.conf.agentMemoryDepth) || 6));', 'var _memDepth = TM.MemoryModeBridge ? TM.MemoryModeBridge.memoryDepth() : Math.max(2, Math.round((_Pmd.conf && _Pmd.conf.agentMemoryDepth) || 6));');
  const start = s.indexOf('  async function _recallConsolidate('), end = s.indexOf('\n  // ── deepen_letters', start);
  let fn = s.slice(start, end);
  fn = fn.replace('    var raw;', '    if (TM.MemoryModeBridge) {\n      tp += "\\n\\n可引用的记忆证据：\\n" + TM.MemoryModeBridge.dossier(gm, { tier: "secondary" });\n      tp += "\\n可选 long_term_memory_updates 数组，每条含 kind、memory、confidence、source_refs、entities。kind 使用已支持的长期记忆类型，source_refs 只能引用上面真实 ID；无依据则不写，禁止将推测写成既定事实。";\n    }\n    var raw;');
  fn = fn.replace('    var did = [];', '    if ((p.memory != null && typeof p.memory !== "string") || (p.state_board != null && (typeof p.state_board !== "object" || Array.isArray(p.state_board)))) return { ok: false, text: "(记忆整合结构无效，未写入)" };\n    var did = [];');
  fn = fn.replace("gm._aiMemory.push({ turn: turn, text: String(p.memory), priority: 'high' });", "var memoryRecord = { turn: turn, text: String(p.memory), priority: 'high' };\n      if (TM.MemoryModeBridge) TM.MemoryModeBridge.tagSummary(gm, memoryRecord, String(p.memory));\n      gm._aiMemory.push(memoryRecord);");
  fn = fn.replace("    if (!did.length) return", '    if (TM.MemoryModeBridge && Array.isArray(p.long_term_memory_updates)) { TM.MemoryModeBridge.enqueue(gm, p); did.push("长期记忆候选"); }\n    if (!did.length) return');
  return r(s, s.slice(start, end), fn);
});
edit('web/tm-endturn-agent-intent-plan.js', (s, r) => r(s,
  '  function validatePatches(tool, patches) {',
  "  ['_memoryWriteQueue', '_memoryDraftInbox', '_memoryQuarantine', '_memoryAccepted', '_memoryAuditEvents', '_memoryLongTerm'].forEach(function(k) { ALLOWED.recall_consolidate.push(k); });\n  function validatePatches(tool, patches) {"
));
edit('web/tm-endturn-pipeline-steps.js', (s, r) => r(s,
  '          ctx.results.aiResult = _agentResult;',
  '          if (TM.MemoryModeBridge) TM.MemoryModeBridge.archive(typeof GM !== "undefined" ? GM : ctx.GM, _agentResult, ctx);\n          ctx.results.aiResult = _agentResult;'
));
