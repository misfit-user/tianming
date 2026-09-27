import {edit} from './patch-utils.mjs';
edit('web/scripts/smoke-full-turn-flow.js',(s,r)=>r(s,"  assert(selected.counts.characters >= 100 && selected.counts.factions >= 10, 'selected fixture must retain its complete official population');",`  assert(selected.counts.characters >= 100 && selected.counts.factions >= 10, 'selected fixture must retain its complete official population');
  const selectedBytes = fs.readFileSync(path.join(ROOT, selected.scriptUrl));
  assert(selectedBytes.length === selected.bytes, 'the complete official script byte count must match the catalog');
  assert(require('crypto').createHash('sha256').update(selectedBytes).digest('hex') === selected.sha256, 'the complete official script hash must match; no reduced fixture');`));
