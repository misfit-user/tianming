import fs from 'node:fs';
import { edit } from './patch-utils.mjs';
edit('web/tm-semantic-recall.js', (s, r) => {
  s = r(s, '  async function _buildIndexForLease(opts, identity, lease) {', fs.readFileSync('docs/ai-memory-upgrade-r2-20260918/semantic-memory.fragment.txt','utf8') + '\n  async function _buildIndexForLease(opts, identity, lease) {');
  s = r(s, '      STATE.index = [];', '      STATE.index = [];\n      if (_queryVectors) _queryVectors.clear();');
  s = r(s, "    if (!a || !b || a.length !== b.length) return 0;", "    if (!a || !b || !a.length || a.length !== b.length) return -Infinity;");
  s = r(s, '    for (var i = 0; i < a.length; i++) dot += a[i] * b[i];', '    for (var i = 0; i < a.length; i++) { if (!Number.isFinite(a[i]) || !Number.isFinite(b[i])) return -Infinity; dot += a[i] * b[i]; }');
  s = r(s, "    _assertLeaseCurrent(lease, 'scan');", `    var memoryRows = _memoryVectorRows(gm), removeIds = [], memoryKeys = new Set();
    if (memoryRows) {
      memoryRows.forEach(function(row) { memoryKeys.add(row.sourceId); if (!STATE.existingIds.has('memory|' + row.sourceId)) pending.push(row); });
      STATE.index.forEach(function(item) { if (item.source === 'memory' && !memoryKeys.has(item.sourceId)) removeIds.push(item.id); });
      if (removeIds.length) cursorChanged = true;
    }
    _assertLeaseCurrent(lease, 'scan');`);
  s = r(s, '          sourceId: pendingItem.sourceId,', '          sourceId: pendingItem.sourceId,\n          memoryId: pendingItem.memoryId || "",\n          excerptOffset: pendingItem.excerptOffset || 0,');
  s = r(s, '      count: STATE.index.length + addedItems.length,', '      count: STATE.index.length + addedItems.length - removeIds.length,\n      removeIds: removeIds,');
  s = r(s, "    _assertLeaseCurrent(lease, 'persist-complete');", "    _assertLeaseCurrent(lease, 'persist-complete');\n    if (removeIds.length) {\n      var removals = new Set(removeIds); STATE.index = STATE.index.filter(function(item) { if (!removals.has(item.id)) return true; STATE.existingIds.delete(item.source + '|' + (item.sourceId || item.id)); return false; });\n    }");
  s = r(s, "    if (!await ensureModel()) return { ok: false, reason: 'model not ready: ' + STATE.error };", "    var requestWorld = typeof GM !== 'undefined' ? GM : null, requestGeneration = _loadGeneration(), requestIdentity = _worldIdentity(requestWorld).key;\n    if (!await ensureModel()) return { ok: false, reason: 'model not ready: ' + STATE.error };\n    if (requestWorld !== (typeof GM !== 'undefined' ? GM : null) || requestGeneration !== _loadGeneration() || requestIdentity !== _worldIdentity(requestWorld).key) return { ok: false, reason: 'semantic_world_changed' };");
  s = r(s, '          s.put(meta);', "          (staged.removeIds || []).forEach(function(id) { s.delete(id); _perfCount('semantic.idbDeleteCount', 1); });\n          s.put(meta);");
  s = r(s, '    var qVec = await _embed(query);', "    if (opts.GM && opts.GM !== lease.gmRef) return [];\n    var qVec = await _queryVector(query, lease);");
  return s;
});
edit('web/tm-semantic-recall.js', (s, r) => {
  s = r(s, '    function worse(left, right) {', `    var freshMemory = null, hybrid = global.TM && global.TM.MemoryHybrid;
    if (hybrid) {
      freshMemory = Object.create(null);
      hybrid.collect(lease.gmRef, opts).forEach(function(hit) { freshMemory[hit.id] = hit; });
    }
    var heapLimit = freshMemory ? Math.min(400, topK * 4) : topK;
    function worse(left, right) {`);
  s = r(s, '        var item = STATE.index[i];\n        var sim', `        var item = STATE.index[i];
        if (freshMemory) {
          var latest = freshMemory[item.memoryId];
          if (item.source !== 'memory' || !latest) continue;
          var currentText = String(latest.safeBody != null ? latest.safeBody : latest.text || '').slice(item.excerptOffset || 0, (item.excerptOffset || 0) + 360);
          if (currentText !== item.text) continue;
        }
        var sim`);
  s = r(s, '        if (sim < threshold) continue;', '        if (!Number.isFinite(sim) || sim < threshold) continue;');
  s = r(s, '        if (heap.length < topK) heapPush(heap, entry);', '        if (heap.length < heapLimit) heapPush(heap, entry);');
  s = r(s, '    return scored.map(function(s) {\n      return {', `    var seenMemory = new Set();
    return scored.filter(function(row) { var id = row.item.memoryId || row.item.id; if (seenMemory.has(id)) return false; seenMemory.add(id); return true; }).slice(0, topK).map(function(s) {
      if (freshMemory && freshMemory[s.item.memoryId]) return Object.assign({}, freshMemory[s.item.memoryId], { memoryId: s.item.memoryId, sim: Math.round(s.sim * 10000) / 10000, vectorSource: 'memory', matchedOffset: s.item.excerptOffset || 0 });
      return {`);
  s = r(s, "        source: 'vector',\n        sub: s.item.source,", "        source: 'vector',\n        campaignId: identity.campaignId, timelineId: identity.timelineId,\n        sub: s.item.source,");
  return s;
});
