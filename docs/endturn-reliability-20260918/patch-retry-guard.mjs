import { edit } from './patch-utils.mjs';
edit('web/tm-ai-infra-retry.js', (s, r) => r(s, '  opts._requestTicket = ticket;', '  opts._requestTicket = ticket;\n  opts._requestGuard = check;'));
edit('web/tm-ai-infra.js', (s, r) => {
  s = r(s, '    protocolReplay = false;\n    if (signal && signal.aborted)', '    protocolReplay = false;\n    if (opts._requestGuard) opts._requestGuard();\n    if (signal && signal.aborted)');
  s = r(s, "      _aiLastRaw = { url: url, body: body, response: data, error: null, ts: Date.now() };", "      if (opts._requestGuard) opts._requestGuard();\n      _aiLastRaw = { url: url, body: body, response: data, error: null, ts: Date.now() };");
  const start = s.indexOf('async function _aiFetchWithRetryInner('), end = s.indexOf('function _tmAiErrHuman(', start);
  let fn = s.slice(start,end);
  fn = r(fn, '      lastError = e;', '      lastError = e;\n      if (e && (e.code === "AI_STALE_WORLD" || e.code === "AI_RETRY_BUDGET")) throw e;');
  return r(s, s.slice(start,end), fn);
});
