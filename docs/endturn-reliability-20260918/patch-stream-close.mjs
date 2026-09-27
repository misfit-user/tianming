import { edit } from './patch-utils.mjs';
edit('web/tm-ai-infra.js', (s, r) => {
  s = r(s, '      body: JSON.stringify(_bodyCore),\n      signal: ctrl.signal\n    });', '      body: JSON.stringify(_bodyCore),\n      signal: ctrl.signal, timeoutMs: streamTimeout\n    }), streamDeadline]);\n    if (opts._streamGuard) opts._streamGuard();\n    streamPhase = "body"; if (diag) diag.requestPhase(opts._requestTicket, "body");');
  const start = s.indexOf('async function _callAIMessagesStreamDirect('), end = s.indexOf('async function callAIMessagesStream(', start);
  let fn = s.slice(start, end);
  if (!fn.includes('cancelReader')) fn = r(fn, '    clearTimeout(timer);\n    if (opts.signal', '    clearTimeout(timer);\n    if (reader) { try { var cancelReader = reader.cancel(); if (cancelReader && cancelReader.catch) cancelReader.catch(function() {}); reader.releaseLock(); } catch (_) {} }\n    if (opts.signal');
  return r(s, s.slice(start, end), fn);
});
