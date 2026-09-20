import { edit } from './patch-utils.mjs';
edit('web/tm-memory-retrieval.js', (s, r) => r(s,
  "      if (expected != null && expected !== '' && hit[field] != null && hit[field] !== '' && String(hit[field]) !== String(expected)) return 'world_scope';",
  `      if (expected != null && expected !== '' && hit[field] != null && hit[field] !== '' && String(hit[field]) !== String(expected)) {
        // Loading forks the timeline: common parent history remains valid up to the fork, never after it.
        var forkTurn = numberOrNull(gm._forkTurn);
        var eventTurn = numberOrNull(hit.turn);
        var learnedTurn = numberOrNull(hit.learnedAtTurn);
        var parentHistory = field === 'timelineId' && gm._parentTimelineId && String(hit[field]) === String(gm._parentTimelineId)
          && forkTurn != null && eventTurn != null && eventTurn <= forkTurn && (learnedTurn == null || learnedTurn <= forkTurn);
        if (!parentHistory) return 'world_scope';
      }`
));
edit('web/tm-memory-trace.js', (s, r) => r(s,
  '    suppressed = suppressed.concat(Array.isArray(data.suppressed) ? data.suppressed : []);',
  `    suppressed = suppressed.concat(Array.isArray(data.suppressed) ? data.suppressed : []);
    var suppressedSeen = Object.create(null);
    suppressed = suppressed.filter(function(row) {
      var key = [row && row.id, row && row.source, row && row.reason, row && row.by, row && (row.budgetStage || row.stage)].join('|');
      if (suppressedSeen[key]) return false;
      suppressedSeen[key] = true;
      return true;
    });`
));
edit('web/scripts/verify-all.js', (s) => {
  const line = s.split('\n').find(row => row.includes("name: 'memory-boundary-upgrade'"));
  if (!line) throw Error('Missing memory smoke manifest entry');
  return line.endsWith('\r') ? s.replace(line + '\n', line.slice(0, -1) + '\n') : s;
});
edit('web/scripts/smoke-memory-boundary-upgrade.js', (s, r) => {
  const marker = "console.log('smoke-memory-boundary-upgrade: '";
  const tests = `check('loaded branches inherit only pre-fork parent evidence', () => {
  const gm = { turn: 20, _timelineId: 'child', _parentTimelineId: 'parent', _forkTurn: 6 };
  const parent = { ...base, turn: 4, timelineId: 'parent' };
  assert(M.compileHits([parent], { GM: gm, turn: 20, maxTokens: 1000 }).text.includes(base.text));
  for (const invalid of [{ ...parent, turn: 7 }, { ...parent, learnedAtTurn: 7 }, { ...parent, timelineId: 'sibling' }]) {
    assert.strictEqual(M.compileHits([invalid], { GM: gm, turn: 20, maxTokens: 1000 }).text, '');
  }
});
check('trace rejection entries are not duplicated', () => {
  const compiled = M.compileHits(Array.from({ length: 15 }, (_, i) => ({ ...base, id: 'drop-' + i, text: 'Different evidence ' + i })), { maxTokens: 180 });
  const trace = TM.MemoryTrace.recordCompiledContext({ turn: 10, _turnAiResults: {} }, { compiled });
  const keys = Array.from(trace.suppressed, hit => [hit.id, hit.source, hit.reason].join('|'));
  assert.strictEqual(new Set(keys).size, keys.length);
});
`;
  return r(s, marker, tests + marker);
});
edit('web/tm-memory-context-compiler.js', (s, r) => r(s,
  "      if (!reason && opts.turn != null && opts.includeFuture !== true && Number(hit.turn) > Number(opts.turn)) reason = 'future_memory';",
  "      if (!reason && (hit.worldId || hit.saveId || hit.campaignId || hit.timelineId)) reason = 'identity_policy_unavailable';\n      if (!reason && opts.turn != null && opts.includeFuture !== true && (Number(hit.turn) > Number(opts.turn) || Number(hit.learnedAtTurn) > Number(opts.turn))) reason = 'future_memory';"
));
edit('web/tm-memory-envelope.js', (s) => {
  let count = 0;
  const updated = s.replace(/^(\s*(?:(?:saveId|worldId|campaignId|timelineId): clean|if \(!env\.(?:saveId|worldId|campaignId|timelineId)\) env\.(?:saveId|worldId|campaignId|timelineId) = clean)\([^\r\n]*), 120\)/gm, (_all, prefix) => { count++; return prefix + ', 128)'; });
  if (count !== 8) throw Error('Expected eight identity length bounds, got ' + count);
  return updated;
});
edit('web/scripts/smoke-memory-boundary-upgrade.js', (s, r) => r(s,
  "console.log('smoke-memory-boundary-upgrade: '",
  `check('missing retrieval policy rejects identity-bound evidence', () => {
  const isolated = load(['tm-context-zones.js', 'tm-memory-context-compiler.js']).MemoryContextCompiler;
  assert.strictEqual(isolated.compileHits([{ ...base, worldId: 'foreign' }], { GM: { worldId: 'current' }, maxTokens: 1000 }).text, '');
});
check('valid 128-character campaign IDs do not reject their own projections', () => {
  const gm = { turn: 10, _campaignId: 'tmc_' + 'x'.repeat(124), chars: [{ id: 'minister-a', name: 'Minister A', alive: true }] };
  assert(M.compileFromGM(gm, { maxTokens: 1000 }).text.includes('Minister A'));
});
console.log('smoke-memory-boundary-upgrade: '`
));
edit('web/tm-memory-retrieval.js', (s, r) => r(s,
  "        var parentHistory = field === 'timelineId' && gm._parentTimelineId && String(hit[field]) === String(gm._parentTimelineId)",
  "        var parentHistory = field === 'timelineId' && String(expected) === String(gm.timelineId || gm._timelineId || '') && gm._parentTimelineId && String(hit[field]) === String(gm._parentTimelineId)"
));
edit('web/scripts/smoke-memory-boundary-upgrade.js', (s, r) => r(s,
  "  assert(M.compileHits([parent], { GM: gm, turn: 20, maxTokens: 1000 }).text.includes(base.text));",
  "  assert(M.compileHits([parent], { GM: gm, turn: 20, maxTokens: 1000 }).text.includes(base.text));\n  assert.strictEqual(M.compileHits([parent], { GM: gm, timelineId: 'unrelated', turn: 20, maxTokens: 1000 }).text, '');"
));
