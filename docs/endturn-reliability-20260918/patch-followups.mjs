import { edit } from './patch-utils.mjs';
for (const file of ['web/tm-memory-mode-bridge.js','web/tm-endturn-agent-intent-plan.js']) edit(file, (s, r) => r(s,
  "'_memoryAuditEvents', '_memoryLongTerm']", "'_memoryAuditEvents', '_memoryLongTerm', '_memoryRevision']"));
edit('web/index.html', (s, r) => {
  const battle = s.match(/<script src="tm-battle-contract\.js[^\"]*"><\/script>/)[0], military = s.match(/<script src="tm-military\.js[^\"]*"><\/script>/)[0];
  s = r(s, battle + '\n', ''); return r(s, military, military + '\n' + battle);
});
edit('web/tm-memory-mode-bridge.js', (s, r) => {
  s = r(s, 'var generation = root._tmLoadGen, turn = gm.turn, timeline = gm._timelineId;', 'var generation = root._tmLoadGen, turn = gm.turn, timeline = gm._timelineId, liveGM = root.GM, player = root.P;');
  return r(s, 'if (root._tmLoadGen !== generation || gm.turn !== turn', 'if (root.GM !== liveGM || root.P !== player || root._tmLoadGen !== generation || gm.turn !== turn');
});
edit('web/tm-agent-kernel.js', (s, r) => r(s,
  "        if (ctrl && !ctrl.signal.aborted) ctrl.abort(reason || 'aborted');\n        else signal.aborted = true;",
  "        if (ctrl) { if (!ctrl.signal.aborted) ctrl.abort(reason || 'aborted'); }\n        else signal.aborted = true;"));
edit('web/tm-endturn-ai.js', (s, r) => r(s,
  'var _retries = (_policy && _policy.subcallRetries != null) ? _policy.subcallRetries : 1;',
  'var _retries = (_policy && _policy.subcallRetries != null) ? _policy.subcallRetries : 0;'));
edit('web/scripts/smoke-agent-mode-s2.js', (s, r) => r(s,
  "assert(RT.defs().length === 10, '10 个只读工具(原6 + 高阶聚合3 + get_relations 关系网)');",
  "assert(RT.defs().length === 12 && RT.isToolName('read_memory') && RT.isToolName('recall_related'), '12 个只读工具：原十项保留，增加证据展开与关联追查');"));
edit('web/scripts/smoke-agent-mode-tools.js', (s, r) => r(s,
  "assert(names.length === 10, 'defs 共 10 工具(原6+高阶3+关系1)');",
  "assert(names.length === 12 && names.includes('read_memory') && names.includes('recall_related'), 'defs 共十二工具，原十项及两项证据工具齐全');"));
edit('web/scripts/smoke-endturn-performance-optimizations.js', (s, r) => {
  const start = s.indexOf('// ★2026-09-18·契约钉回'), end = s.indexOf("assert(/max_tokens:", start);
  if (start < 0 || end < 0) throw Error('Retry contract test changed; inspect before patching');
  const replacement = `// 2026-09-18：整段子调用可能已经落账，默认不重放；网络恢复由传输层的共享预算负责。
// 明确配置仍然保留。smoke-turn-request-reliability 动态验证传输耗尽不触发外层重放。
assert(/var _retries = \\(_policy && _policy\\.subcallRetries != null\\) \\? _policy\\.subcallRetries : 0;/.test(aiSubcallSrc),
  'subcall wrapper honors explicit retry count and defaults to no whole-stage replay');
assert(/subcallRetries:0/.test(aiSubcallSrc), 'default call policy does not replay partially applied stages');
`;
  return r(s, s.slice(start, end), replacement);
});
