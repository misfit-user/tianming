import { edit } from './patch-utils.mjs';
edit('web/tm-ai-infra-retry.js',(s,r)=>r(s,'async function _aiFetchWithRetry(url, body, signal, opts) {',`async function _aiFetchWithRetry(url, body, signal, opts) {
  var recovery = globalThis.TM && globalThis.TM.Endturn && globalThis.TM.Endturn.ResponseRecovery;
  var execute = function(next) { return _aiFetchWithRetryUncached(url, body, signal, next); };
  return recovery ? recovery.jsonRequest(url, body, signal, opts, execute) : execute(opts);
}
async function _aiFetchWithRetryUncached(url, body, signal, opts) {`));
edit('web/tm-ai-infra.js',(s,r)=>{
  s=r(s,"      _aiLastRaw = { url: url, body: body, response: data, error: null, ts: Date.now() };","      if (opts._responseRecoveryReceipt) opts._responseRecoveryReceipt.request = JSON.stringify(body);\n      _aiLastRaw = { url: url, body: body, response: data, error: null, ts: Date.now() };");
  s=r(s,'async function callAIWithTools(prompt, tools, opts) {',`async function callAIWithTools(prompt, tools, opts) {
  var recovery = globalThis.TM && globalThis.TM.Endturn && globalThis.TM.Endturn.ResponseRecovery;
  var execute = function(next) { return _callAIWithToolsUncached(prompt, tools, next); };
  return recovery ? recovery.toolRequest(prompt, tools, opts, execute) : execute(opts);
}
async function _callAIWithToolsUncached(prompt, tools, opts) {`);
  s=r(s,'  return _aiWithStreamScope(opts, function(scoped) { return _callAIMessagesStreamQueued(messages, maxTok, scoped); });',`  var execute = function(next) { return _aiWithStreamScope(next, function(scoped) { return _callAIMessagesStreamQueued(messages, maxTok, scoped); }); };
  var recovery = globalThis.TM && globalThis.TM.Endturn && globalThis.TM.Endturn.ResponseRecovery;
  return recovery ? recovery.streamRequest('messages', messages, maxTok, opts, execute) : execute(opts);`);
  return r(s,'  return _aiWithStreamScope(opts, function(scoped) { return _callAIBodyStreamQueued(finalizedBody, scoped); });',`  var execute = function(next) { return _aiWithStreamScope(next, function(scoped) { return _callAIBodyStreamQueued(finalizedBody, scoped); }); };
  var recovery = globalThis.TM && globalThis.TM.Endturn && globalThis.TM.Endturn.ResponseRecovery;
  return recovery ? recovery.streamRequest('body', finalizedBody, null, opts, execute) : execute(opts);`);
});
