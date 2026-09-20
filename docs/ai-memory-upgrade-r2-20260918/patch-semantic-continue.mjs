import { edit } from './patch-utils.mjs';
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
