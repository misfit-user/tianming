import { edit } from './patch-utils.mjs';
edit('web/tm-semantic-recall.js', (s, r) => {
  s = r(s, 'var memoryRows = _memoryVectorRows(gm), removeIds = [], memoryKeys = new Set();', 'var memoryRows = _memoryVectorRows(gm), removeIds = [], memoryKeys = new Set(), pendingMemory = 0;\n    var memoryBatchLimit = Number(opts.memoryBatchLimit);\n    memoryBatchLimit = Number.isSafeInteger(memoryBatchLimit) && memoryBatchLimit >= 16 ? Math.min(2048, memoryBatchLimit) : 256;');
  s = r(s, "      memoryRows.forEach(function(row) { memoryKeys.add(row.sourceId); if (!STATE.existingIds.has('memory|' + row.sourceId)) pending.push(row); });", "      memoryRows.forEach(function(row) { memoryKeys.add(row.sourceId); if (!STATE.existingIds.has('memory|' + row.sourceId)) { if (pendingMemory < memoryBatchLimit) pending.push(row); pendingMemory++; } });");
  s = r(s, '    STATE.lastIndexedTurn = staged.lastIndexedTurn;', '    STATE.lastIndexedTurn = staged.lastIndexedTurn;\n    STATE.memoryPending = Math.max(0, pendingMemory - memoryBatchLimit);');
  s = r(s, 'return { ok: true, added: addedItems.length, total: STATE.index.length, visited: sourceRowsVisited };', 'return { ok: true, added: addedItems.length, total: STATE.index.length, visited: sourceRowsVisited, memoryPending: STATE.memoryPending };');
  s = r(s, '      queryCacheSize: _queryVectors ? _queryVectors.size : 0,', '      queryCacheSize: _queryVectors ? _queryVectors.size : 0,\n      memoryPending: STATE.memoryPending || 0,');
  s = r(s, '      if (_queryVectors) _queryVectors.clear();', '      if (_queryVectors) _queryVectors.clear();\n      STATE.memoryPending = 0;');
  return s;
});
edit('web/tm-player-settings.js', (s, r) => r(s, '  if (evidence) h += _renderEvidenceDetails(evidence);', `  if (!isSec && window.TM && window.TM.MemoryLongTerm && window.GM) {
    var archiveStats = window.TM.MemoryLongTerm.stats(window.GM);
    h += '<div style="color:var(--txt-d);">长期档案：' + archiveStats.records + '/' + archiveStats.maxRecords + ' 条 · 已有类型 ' + Object.keys(archiveStats.kinds).length + '/12 · 容量裁剪累计 ' + archiveStats.dropped + ' 条</div>';
  }
  if (evidence) h += _renderEvidenceDetails(evidence);`));
edit('web/scripts/smoke-memory-vector-upgrade.js', (s, r) => r(s, "test('editing a stable memory", `test('large archive indexing is bounded and resumes without losing deferred rows', async () => {
  const c = context(); semantic(c); c.GM._memoryAccepted = Array.from({ length: 70 }, (_, i) => fact('batch-' + i, 'Distinct accepted evidence ' + i));
  c.TM.MemoryLongTerm.capture(c.GM, c.GM._memoryAccepted);
  const first = await c.SemanticRecall.buildIndex({ memoryBatchLimit: 32 }); assert.equal(first.added, 32); assert.equal(first.memoryPending, 38);
  const second = await c.SemanticRecall.buildIndex({ memoryBatchLimit: 32 }); assert.equal(second.added, 32);
  const third = await c.SemanticRecall.buildIndex({ memoryBatchLimit: 32 }); assert.equal(third.added, 6); assert.equal(third.memoryPending, 0);
});
test('editing a stable memory`));
