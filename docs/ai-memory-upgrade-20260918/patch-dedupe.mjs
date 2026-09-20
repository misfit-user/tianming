import { edit } from './patch-utils.mjs';
edit('web/tm-memory-retrieval.js', (s, r) => {
  s = r(s, "    return String(hit.text != null ? hit.text : (hit.event != null ? hit.event : (hit.content != null ? hit.content : '')));", "    return String(hit.safeBody != null ? hit.safeBody : (hit.text != null ? hit.text : (hit.event != null ? hit.event : (hit.content != null ? hit.content : ''))));");
  s = r(s, "    return src + ':text:' + textOf(hit).replace(/\\s+/g, ' ').trim().slice(0, 80);", "    return src + ':text:' + textOf(hit).replace(/\\s+/g, ' ').trim();");
  s = r(s, '  function dedupeHits(hits) {', '  function dedupeHits(hits, onDuplicate) {');
  s = r(s, "    var seen = {};\n    var seenText = {};\n    var out = [];", "    var seen = Object.create(null);\n    var seenText = Object.create(null);\n    var out = [];");
  s = r(s, "      var tkey = sourceOf(hit) + ':text:' + textOf(hit).replace(/\\s+/g, ' ').trim().slice(0, 80);\n      if (!key || seen[key] || (tkey && seenText[tkey])) return;", "      var tkey = sourceOf(hit) + ':' + String(hit.readScope || hit.ownerScope || '') + ':text:' + textOf(hit).replace(/\\s+/g, ' ').trim();\n      if (!key || seen[key] || (tkey && seenText[tkey])) {\n        if (typeof onDuplicate === 'function') onDuplicate(hit);\n        return;\n      }");
  s = r(s, '      var deduped = dedupeHits(visible);', "      var deduped = dedupeHits(visible, function(hit) { suppressed.push(compactSuppressed(hit, 'duplicate_memory_fact')); });");
  return s;
});
edit('web/tm-context-zones.js', (s, r) => r(s,
  '      allowTruncate: zone.allowTruncate === true || zone.mustKeep === true,',
  '      allowTruncate: zone.allowTruncate === true || (zone.allowTruncate !== false && zone.mustKeep === true),'
));
