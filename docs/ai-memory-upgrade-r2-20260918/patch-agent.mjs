import fs from 'node:fs';
import { edit } from './patch-utils.mjs';
edit('web/tm-memory-agent-tools.js', (s, r) => {
  s = r(s, '  // ───────── 下层句柄（缺失即降级）─────────', `  TOOL_DEFS.push(
    { name: 'read_memory', description: '按已返回的记忆 ID 展开原文片段和来源；摘要不足以判断时调用，不要编造 ID。', parameters: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' }, maxItems: 6 } }, required: ['ids'] } },
    { name: 'recall_related', description: '沿已知记忆的因果、延续、解决、替代或矛盾关系追查关联证据，一次仅扩展一跳。', parameters: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' }, maxItems: 6 }, limit: { type: 'integer' } }, required: ['ids'] } }
  );
  // ───────── 下层句柄（缺失即降级）─────────`);
  s = r(s, "    var text = String(h.text || h.event || h.safeBody || h.summary || '').trim();", "    var text = String(h.safeBody != null ? h.safeBody : (h.text || h.event || h.summary || '')).trim();");
  s = r(s, '    var out = {\n      source: h.source', '    var out = Object.assign({}, h, {\n      source: h.source');
  s = r(s, '      text: text.slice(0, 200)\n    };', '      text: text.slice(0, 1600), safeBody: text.slice(0, 1600)\n    });\n    delete out.body; delete out.vec;');
  s = r(s, '  function _recallByTerm(input, GM) {', `  function _recallByTerm(input, GM) {
    if (root.TM.MemoryHybrid) return root.TM.MemoryHybrid.search(GM, _cleanTerms(input.terms).join(' '), { limit: input.limit }).then(function(r) { return { ok: true, hits: r.hits.map(_normHit).filter(Boolean), meta: { tool: 'recall_by_term', hybrid: r.diagnostics } }; });`);
  s = r(s, '  function _recallByEntity(input, GM) {', `  function _recallByEntity(input, GM) {
    if (root.TM.MemoryHybrid) return root.TM.MemoryHybrid.search(GM, String(input.name || '').slice(0, 80), { limit: input.limit }).then(function(r) { return { ok: true, hits: r.hits.map(_normHit).filter(Boolean), meta: { tool: 'recall_by_entity', hybrid: r.diagnostics } }; });`);
  s = r(s, '  function _recallByTurn(input, GM) {', `  function _recallByTurn(input, GM) {
    if (root.TM.MemoryHybrid && GM) {
      var lo = Number.isFinite(Number(input.from)) ? Number(input.from) : 0, hi = Number.isFinite(Number(input.to)) ? Number(input.to) : Number(GM.turn);
      if (lo > hi) { var swap = lo; lo = hi; hi = swap; }
      var scoped = root.TM.MemoryHybrid.collect(GM).filter(function(h) { return h.turn >= lo && h.turn <= hi && Number(h.importance || 0) >= Number(input.minImportance || 0); }).slice(0, _clampLimit(input.limit, 12, 30));
      return Promise.resolve({ ok: true, hits: scoped.map(_normHit).filter(Boolean), meta: { tool: 'recall_by_turn' } });
    }`);
  s = r(s, "      switch (name) {", "      switch (name) {\n        case 'read_memory': return Promise.resolve({ ok: true, hits: root.TM.MemoryHybrid ? root.TM.MemoryHybrid.read(GM, input.ids).map(_normHit).filter(Boolean) : [], meta: { tool: name } });\n        case 'recall_related': return Promise.resolve({ ok: true, hits: root.TM.MemoryHybrid ? root.TM.MemoryHybrid.related(GM, input.ids, input).map(_normHit).filter(Boolean) : [], meta: { tool: name } });");
  s = r(s, '  async function runRecall(GM, ctx) {', fs.readFileSync('docs/ai-memory-upgrade-r2-20260918/adaptive-recall.fragment.txt','utf8') + '  async function runRecall(GM, ctx) {');
  s = r(s, '    var out = { results: [], toolCallCount: 0, totalHits: 0, toolCalls: [], fallback: false };', '    if (GM && root.TM.MemoryAdaptive && root.TM.MemoryHybrid) return runAdaptiveRecall(GM, ctx);\n    var out = { results: [], toolCallCount: 0, totalHits: 0, toolCalls: [], fallback: false };');
  return s;
});
