import { edit } from './patch-utils.mjs';
edit('web/scripts/verify-all.js', (s, r) => r(s,
  "  { name: 'memory-manifest', file: 'smoke-memory-manifest.js', estSec: 1, expectExit: 0 }",
  "  { name: 'memory-adaptive-upgrade', file: 'smoke-memory-adaptive-upgrade.js', estSec: 5, expectExit: 0 },\n  { name: 'memory-vector-upgrade', file: 'smoke-memory-vector-upgrade.js', estSec: 5, expectExit: 0 },\n  { name: 'memory-manifest', file: 'smoke-memory-manifest.js', estSec: 1, expectExit: 0 }"
));
edit('web/tm-ai-infra-model-detect.js', (s, r) => r(s,
  "  report.reliability = report.score >= 90 ? 'high' : report.score >= 65 ? 'medium' : 'low';",
  "  report.reliability = totalWeight ? (report.score >= 90 ? 'high' : report.score >= 65 ? 'medium' : 'low') : 'unknown';"
));
edit('web/tm-player-settings.js', (s, r) => {
  s = r(s, "    var color = c.ok ? 'var(--celadon-400)' : 'var(--vermillion-400)';", "    var color = c.state === 'unavailable' ? 'var(--txt-d)' : (c.ok ? 'var(--celadon-400)' : 'var(--vermillion-400)');");
  s = r(s, '  var evidence = isSec ? probe.evidence_secondary : probe.evidence;', '  var evidence = isSec ? probe.evidence_secondary : probe.evidence;\n  if (evidence && window.TM && window.TM.MemoryAdaptive && evidence.memoryIdentity !== window.TM.MemoryAdaptive.identity(tier)) evidence = null;');
  s = r(s, "(mp.verified ? '近期实测证据' : '未验证或证据已过期')", "(mp.verified ? '近期实测证据' : '未验证或证据已过期') + ' · ' + escHtml({ native: '原生工具检索', json: 'JSON 计划检索', local: '本地辅助检索' }[mp.plannerMode] || '本地辅助检索')");
  return s;
});
edit('web/tm-semantic-recall.js', (s, r) => {
  s = r(s, '      indexSize: STATE.index.length,', '      indexSize: STATE.index.length,\n      memoryVectorCount: STATE.index.filter(function(row) { return row.source === "memory"; }).length,\n      queryCacheSize: _queryVectors ? _queryVectors.size : 0,');
  s = r(s, '    var qVec = await _queryVector(query, lease);', '    var searchTurn = lease.gmRef && lease.gmRef.turn;\n    var qVec = await _queryVector(query, lease);');
  s = r(s, '    if (!qVec || !_isLeaseCurrent(lease)) return [];', '    if (!qVec || !_isLeaseCurrent(lease) || (lease.gmRef && lease.gmRef.turn !== searchTurn) || (opts.signal && opts.signal.aborted)) return [];');
  return s;
});
edit('web/scripts/verify-all.js', (s, r) => r(s,
  "  { name: 'memory-manifest', file: 'smoke-memory-manifest.js', estSec: 1, expectExit: 0 }",
  "  { name: 'memory-model-detection', file: 'smoke-memory-model-detection.js', estSec: 5, expectExit: 0 },\n  { name: 'memory-manifest', file: 'smoke-memory-manifest.js', estSec: 1, expectExit: 0 }"
));
edit('web/scripts/smoke-memory-adaptive-upgrade.js', (s, r) => r(s, 'function stewardFixture() {', `test('JSON-only models can plan retrieval without native tool support', async () => {
  const c = context(); profile(c, ['memory_tools']); let calls = 0; c.GM._memoryAccepted = [fact('json-record', 'Canal repair evidence is available.')];
  c.callAIWithTools = async () => { throw Error('native tool path must not run'); };
  c.callAIMessages = async () => { calls++; return JSON.stringify({ calls: [{ name: 'recall_by_term', input: { terms: ['canal'] } }] }); };
  assert.equal(c.TM.MemoryAdaptive.plan().plannerMode, 'json');
  const result = await c.TM.MemoryAgentTools.runRecall(c.GM, { baseQueries: ['canal'] }); assert(result.totalHits > 0); assert(calls <= 2); assert(result.toolCallCount <= 6);
});
function stewardFixture() {`));
