import { edit } from './patch-utils.mjs';
edit('web/tm-ai-infra-retry.js', (s, r) => {
  const at = s.indexOf('async function _aiFetchWithRetry('), end = s.indexOf('// 默认按输出体量', at);
  let fn = s.slice(at, end);
  fn = r(fn, '  function current() {', '  function configured() { var ai = player && player.ai || {}, second = ai.secondary || {}; return JSON.stringify([ai.url, ai.model, ai.key, second.url, second.model, second.key]); }\n  var configStamp = configured();\n  function current() {');
  fn = r(fn, 'return (typeof GM', 'return configStamp === configured() && (typeof GM');
  return r(s, s.slice(at, end), fn);
});
edit('web/scripts/smoke-turn-request-reliability.js', (s, r) => r(s,
  "test('transport exhaustion does not restart",
  `test('changing provider configuration invalidates an in-flight result', async () => {
  const f = transport(); try {
    f.c.fetch = async () => { f.c.P.ai.model = 'different-model'; return okay({ stale: true }); };
    await assert.rejects(f.request(), e => e.code === 'AI_STALE_WORLD');
  } finally { f.dispose(); }
});
test('transport exhaustion does not restart`));
