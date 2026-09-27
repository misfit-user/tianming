import { edit } from './patch-utils.mjs';
edit('web/scripts/smoke-endturn-performance-optimizations.js', (s, r) => {
  const from = s.indexOf('assert(/function\\s+_callAIMessagesStreamDirect/'), to = s.indexOf("assert(/priority:", from);
  if (from < 0 || to < 0) throw Error('Stream contract test changed');
  return r(s, s.slice(from,to), `assert(/function\\s+_callAIMessagesStreamDirect/.test(infraSrc)
  && /function\\s+callAIMessagesStream[\\s\\S]*?_aiWithStreamScope/.test(infraSrc)
  && /function\\s+callAIBodyStream[\\s\\S]*?_aiWithStreamScope/.test(infraSrc)
  && /_aiQueue\\.enqueue\\(run, opts\\.priority \\|\\| 'normal', \\{ signal: opts\\.signal/.test(infraSrc),
  'legacy and finalized streams use cancellation-aware scopes and the same request queue');
`);
});
edit('web/scripts/verify-all.js', (s, r) => r(s,
  "  { name: 'memory-manifest', file: 'smoke-memory-manifest.js', estSec: 1, expectExit: 0 }",
  "  { name: 'turn-memory-parity', file: 'smoke-turn-memory-parity.js', estSec: 3, expectExit: 0 },\n  { name: 'turn-request-reliability', file: 'smoke-turn-request-reliability.js', estSec: 3, expectExit: 0 },\n  { name: 'turn-stream-reliability', file: 'smoke-turn-stream-reliability.js', estSec: 3, expectExit: 0 },\n  { name: 'memory-manifest', file: 'smoke-memory-manifest.js', estSec: 1, expectExit: 0 }"
));
