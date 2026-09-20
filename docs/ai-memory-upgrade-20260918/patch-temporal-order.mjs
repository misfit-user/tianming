import { edit } from './patch-utils.mjs';
edit('web/tm-memory-retrieval.js', (s, r) => {
  const check = "    if ((eventTurn != null && eventTurn > turn) || (learnedTurn != null && learnedTurn > turn)) return 'future_memory';\n";
  s = r(s, check, '');
  const anchor = "    if (validFrom != null && turn < validFrom && intent !== 'historical_evidence') return 'not_yet_valid';\n";
  return r(s, anchor, anchor + check);
});
edit('web/tm-memory-governance.js', (s, r) => {
  const check = "    if (ctx.includeFuture !== true && ((eventTurn != null && eventTurn > turn) || (learnedTurn != null && learnedTurn > turn))) return 'future_memory';\n";
  s = r(s, check, '');
  const anchor = "    if (validFrom != null && turn < validFrom && intent !== 'historical_evidence') return 'not_yet_valid';\n";
  return r(s, anchor, anchor + check);
});
