import fs from 'node:fs';
import { edit } from './patch-utils.mjs';
edit('web/tm-memory-long-term.js', (s, r) => {
  s = r(s, '      if (old) rec.retainedAtTurn = old.retainedAtTurn;', '      if (old) { rec.retainedAtTurn = old.retainedAtTurn; if (old.durableControl) rec.durableControl = old.durableControl; }');
  s = r(s, '    return list(gm && gm._memoryLongTerm && gm._memoryLongTerm.records).map(function(record) {', '    return list(gm && gm._memoryLongTerm && gm._memoryLongTerm.records).slice(-MAX_RECORDS).map(function(record) {');
  s = r(s, 'var env = envelope.makeEnvelope(record); env.memoryKind', 'var env = envelope.makeEnvelope(Object.assign({}, record, { maxBody: 1600, safeBodyMax: 1600 })); env.durableControl = record.durableControl; env.memoryKind');
  s = r(s, '  function stats(gm) {', fs.readFileSync('docs/ai-memory-upgrade-r2-20260918/long-term-controls.fragment.txt','utf8') + '  function stats(gm) {');
  s = r(s, 'NS.harvest = harvest; NS.candidates = candidates; NS.stats = stats;', 'NS.harvest = harvest; NS.candidates = candidates; NS.stats = stats; NS.syncControls = syncControls;');
  return s;
});
edit('web/tm-memory-retrieval.js', (s, r) => {
  s = r(s, '      longTerm: env.longTerm === true,', '      longTerm: env.longTerm === true,\n      durableControl: env.durableControl || null,');
  const start = s.indexOf('  function memoryControlForHit('), end = s.indexOf('  function applyMemoryControls(', start);
  if (start < 0 || end < 0) throw Error('Control lookup boundary unavailable');
  let fn = s.slice(start, end);
  fn = fn.replace('    var controls = GM._memoryControls;', `    var durable = null, store = GM._memoryLongTerm;
    if (!opts.ignoreDurable) {
      var entry = _worldIndexEntry(GM);
      if (entry && entry.longTermStore !== store) {
        entry.longTermStore = store; entry.longTermControls = Object.create(null);
        arr(store && store.records).forEach(function(record) { if (record.durableControl) entry.longTermControls[record.id] = record.durableControl; });
      }
      durable = hit && hit.durableControl || (entry && entry.longTermControls && hit && entry.longTermControls[hit.id]) || null;
    }
    var controls = GM._memoryControls;`).replaceAll('return null;', 'return durable;');
  return r(s, s.slice(start, end), fn);
});
edit('web/tm-memory-controls.js', (s, r) => {
  s = r(s, '    var keys = Object.keys(controls);', '    if (root.TM.MemoryLongTerm && root.TM.MemoryLongTerm.syncControls) root.TM.MemoryLongTerm.syncControls(GM);\n    var keys = Object.keys(controls);');
  return r(s, '    delete controls[key];\n    return true;', '    delete controls[key];\n    if (root.TM.MemoryLongTerm && root.TM.MemoryLongTerm.syncControls) root.TM.MemoryLongTerm.syncControls(GM, key);\n    return true;');
});
