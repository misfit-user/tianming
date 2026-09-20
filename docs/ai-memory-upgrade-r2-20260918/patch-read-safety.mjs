import { edit } from './patch-utils.mjs';
edit('web/tm-memory-long-term.js', (s, r) => {
  s = r(s, 'var previous = gm._memoryLongTerm || {}, rows = list(previous.records).slice(),', 'var previous = gm._memoryLongTerm || {}, rows = list(previous.records).filter(function(row) { return row && typeof row === "object" && row.id; }).slice(-MAX_RECORDS),');
  s = r(s, 'list(gm && gm._memoryLongTerm && gm._memoryLongTerm.records).slice(-MAX_RECORDS).map', 'list(gm && gm._memoryLongTerm && gm._memoryLongTerm.records).slice(-MAX_RECORDS).filter(function(row) { return row && typeof row === "object" && row.id; }).map');
  s = r(s, '      var probe = Object.assign({}, record); delete probe.durableControl;', '      if (!record || typeof record !== "object" || !record.id) return record;\n      var probe = Object.assign({}, record); delete probe.durableControl;');
  s = r(s, 'list(store.records).forEach(function(r) { var k', 'list(store.records).forEach(function(r) { if (!r || typeof r !== "object") return; var k');
  return s;
});
edit('web/tm-memory-adaptive.js', (s, r) => r(s, '  var NS = root.TM.MemoryAdaptive = root.TM.MemoryAdaptive || {};', '  if (root.TM.MemoryAdaptive && root.TM.MemoryAdaptive.plan) return;\n  var NS = root.TM.MemoryAdaptive = root.TM.MemoryAdaptive || {};'));
