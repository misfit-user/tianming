// @ts-check
// Retry ownership and cancellation helpers; classic script, loaded before tm-ai-infra.js.
// ============================================================
//  1.7.5 AI 调用基础设施（重试 + 超时 + 429 处理 + raw 保留）
// ============================================================
var _aiLastRaw = { url: '', body: null, response: null, error: null, ts: 0 };
/**
 * 统一的 AI fetch 包装：3 次指数退避重试、180s 超时、429 读取 Retry-After、原始响应保留供 debug。
 * 返回已解析的 JSON。抛出时 error.lastRaw 含现场信息。
 */
// Successful headers end the first-response deadline, not cancellation or validation.
var _aiPendingWaits = new Map(), _aiWaitSequence = 0;
function _aiWaitSetting(raw, label) {
  if (raw == null || raw === '') return 0;
  var n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 86400000) { var e = new Error(label + '须为 0 至 86400 秒；0 表示默认策略'); e.code = 'AI_WAIT_CONFIG'; e.status = 400; throw e; }
  return Math.floor(n);
}
function _aiWaitConfig(opts) {
  opts = opts || {};
  if (typeof _getAITier === 'function') return _getAITier(opts.tier) || {};
  var ai = typeof P !== 'undefined' && P.ai || {};
  return opts.tier === 'secondary' && ai.secondary && ai.secondary.key ? ai.secondary : ai;
}
function _aiTotalResponseTimeout(opts) {
  opts = opts || {}; var cfg = _aiWaitConfig(opts);
  return _aiWaitSetting(opts.totalResponseTimeoutMs != null ? opts.totalResponseTimeoutMs : cfg.totalResponseTimeoutMs, '完整响应最大等待');
}
function _aiQueueWaitTimeout(opts) {
  opts = opts || {}; var cfg = _aiWaitConfig(opts);
  return _aiWaitSetting(opts.queueTimeoutMs != null ? opts.queueTimeoutMs : cfg.queueTimeoutMs, '排队最大等待');
}
function _aiFirstResponseTimeout(maxTok, opts) {
  opts = opts || {}; var cfg = _aiWaitConfig(opts);
  var chosen = _aiWaitSetting(opts.firstResponseTimeoutMs != null ? opts.firstResponseTimeoutMs : cfg.firstResponseTimeoutMs, '首响应等待');
  return chosen || _aiComputeTimeout(maxTok, opts.timeoutMs);
}
function _aiStartResponseWait(opts, timeoutMs, fail) {
  opts = opts || {}; var headerTimer = null, hardTimer = null, noticeTimer = null, guardTimer = null, closed = false;
  var native = typeof _tmAINativePlatform === 'function' && _tmAINativePlatform();
  var row = { id: ++_aiWaitSequence, phase: native ? 'native-buffered' : 'headers', startedAt: Date.now() };
  var totalMs = _aiTotalResponseTimeout(opts); _aiPendingWaits.set(row.id, row);
  row.cancel = function() { if (!closed) { stop(); fail(_aiCancelledError(opts.signal)); } };
  function stop() {
    if (closed) return; closed = true;
    clearTimeout(headerTimer); clearTimeout(hardTimer); clearTimeout(noticeTimer); clearTimeout(guardTimer);
    _aiPendingWaits.delete(row.id);
  }
  function reject(code, ms) {
    if (closed) return;
    var e = new Error(code === 'AI_REQUEST_DEADLINE' ? '达到明确设置的完整响应最大等待时间' : '等待服务端首响应超时，尚未收到成功响应头');
    e.name = 'TimeoutError'; e.code = code; e.timeoutMs = ms; e.phase = row.phase; if (row.httpStatus) e.status = row.httpStatus; stop(); fail(e);
  }
  if (!native) headerTimer = setTimeout(function() { reject('AI_TIMEOUT', timeoutMs); }, timeoutMs);
  if (totalMs > 0) hardTimer = setTimeout(function() { reject('AI_REQUEST_DEADLINE', totalMs); }, totalMs);
  function notice() {
    if (closed) return;
    try { if (typeof toast === 'function') toast(row.phase === 'body' ? '已收到服务端响应，尚未收到完整结果；正在继续等待，可取消本次推演。' : '原生请求尚未返回完整结果；正在继续等待，可取消本次推演。'); } catch (_) {}
  }
  if (native) noticeTimer = setTimeout(notice, 120000);
  var guard = opts._requestGuard || opts._streamGuard;
  function inspect() {
    if (closed) return;
    try { guard(); } catch (e) { stop(); fail(e); return; }
    guardTimer = setTimeout(inspect, 1000);
  }
  if (guard) guardTimer = setTimeout(inspect, 1000);
  return { headerTimer: headerTimer, headers: function(ok, status) {
    if (closed) return;
    if (!ok) { row.phase = "error-body"; row.httpStatus = status; return; }
    clearTimeout(headerTimer); clearTimeout(noticeTimer); row.phase = 'body'; row.headersAt = Date.now();
    noticeTimer = setTimeout(notice, 120000);
  }, dispose: stop };
}
function _aiCancelPendingWaits() { Array.from(_aiPendingWaits.values()).forEach(function(row) { row.cancel(); }); }
function _aiWaitSnapshot() {
  return Array.from(_aiPendingWaits.values(), function(row) { return { phase: row.phase, elapsedMs: Date.now() - row.startedAt, headersReceived: row.headersAt != null }; });
}

async function _aiWithStreamScope(opts, execute) {
  opts = _aiConfiguredCallOptions(opts);
  var root = typeof window !== 'undefined' ? window : globalThis;
  var gm = typeof GM !== 'undefined' ? GM : null, player = typeof P !== 'undefined' ? P : null, generation = root._tmLoadGen;
  var identity = gm ? [gm._campaignId, gm._timelineId, gm.turn].join('|') : '';
  var cfg = typeof _getAITier === 'function' ? _getAITier(opts.tier) : player && player.ai || {};
  var cfgKey = JSON.stringify([cfg.url, cfg.model, cfg.key]);
  var ctrl = new AbortController(), deadlineReject, timer, external;
  var deadline = new Promise(function(_resolve, reject) { deadlineReject = reject; }); deadline.catch(function() {});
  var userLimit = _aiTotalResponseTimeout(opts);
  var timeout = Math.min(userLimit > 0 ? userLimit : Infinity, opts.retryBudget ? opts.retryBudget.deadlineAt - Date.now() : Infinity);
  if (timeout <= 0) throw _aiRetryBudgetError();
  function guard() {
    if (ctrl.signal.aborted) throw ctrl.signal.reason || _aiCancelledError(opts.signal);
    var currentCfg = typeof _getAITier === 'function' ? _getAITier(opts.tier) : player && player.ai || {};
    if ((root.GM || null) !== gm || (root.P || null) !== player || root._tmLoadGen !== generation || (gm && identity !== [gm._campaignId, gm._timelineId, gm.turn].join('|')) || cfgKey !== JSON.stringify([currentCfg.url, currentCfg.model, currentCfg.key])) {
      var e = new Error('流式推演对应的存档或模型配置已改变'); e.code = 'AI_STALE_WORLD'; throw e;
    }
  }
  var diag = root.TM && root.TM.Endturn && root.TM.Endturn.Reliability, ticket = diag && diag.requestStart(opts.id || 'stream');
  if (diag && diag.bindRequest) diag.bindRequest(ticket, ctrl);
  function abort(e) { if (!ctrl.signal.aborted) { ctrl.abort(e); deadlineReject(e); } }
  external = function() { abort(_aiCancelledError(opts.signal)); };
  var scoped = Object.assign({}, opts, { signal: ctrl.signal, _streamGuard: guard, _requestTicket: ticket });
  if (opts.onChunk) scoped.onChunk = function(text) { guard(); return opts.onChunk(text); };
  if (opts.onDone) scoped.onDone = function(text) { guard(); return opts.onDone(text); };
  try {
    if (opts.signal) { opts.signal.addEventListener('abort', external, { once: true }); if (opts.signal.aborted) external(); }
    guard();
    if (Number.isFinite(timeout)) timer = setTimeout(function() { var e = new Error('达到明确设置的完整响应最大等待时间'); e.code = 'AI_REQUEST_DEADLINE'; e.name = 'TimeoutError'; abort(e); }, timeout);
    var result = await Promise.race([Promise.resolve().then(function() { guard(); return execute(scoped); }), deadline]);
    guard(); if (diag) diag.requestEnd(ticket, null); return result;
  } catch (e) { abort(e); if (diag) diag.requestEnd(ticket, e); throw e; }
  finally { clearTimeout(timer); if (diag && diag.unbindRequest) diag.unbindRequest(ticket, ctrl); if (opts.signal) opts.signal.removeEventListener('abort', external); }
}

function _aiConfiguredCallOptions(opts) {
  var policy = globalThis.TM && globalThis.TM.CallRetryPolicy;
  return policy ? policy.options(opts) : Object.assign({}, opts || {});
}
async function _aiConfiguredStreamRetry(messages, maxTok, opts) {
  var policy = globalThis.TM.CallRetryPolicy, partial = false;
  var owned = Object.assign({}, opts, {_streamRetryOwner:true});
  owned.retryBudget = opts.retryBudget || _aiCreateRetryBudget({maxAttempts:opts.maxRetries+3,configuredRetries:true,totalTimeoutMs:_aiTotalResponseTimeout(opts)});
  owned.onChunk = function(text) { if(text)partial=true;if(opts.onChunk)opts.onChunk(text); };
  for(var attempt=0;attempt<=opts.maxRetries;attempt++) {
    if(opts.signal && opts.signal.aborted)throw _aiCancelledError(opts.signal);
    _aiClaimRetryAttempt(owned.retryBudget);
    try { return await _callAIMessagesStreamDirect(messages,maxTok,owned); }
    catch(e) {
      if(partial || attempt>=opts.maxRetries || !policy.retryable(e)) { if(e && typeof e==='object')e._aiRetryExhausted=true;throw e; }
      await _aiBudgetedRetryWait(Number.isFinite(e.retryAfterMs) ? e.retryAfterMs : _aiRetryDelay(null,attempt),opts.signal,owned.retryBudget);
    }
  }
}

function _aiCreateRetryBudget(opts) {
  opts = opts || {};
  var attempts = Number(opts.maxAttempts), duration = Number(opts.totalTimeoutMs);
  if (!Number.isFinite(attempts)) attempts = 4;
  if (!Number.isFinite(duration) || duration <= 0) duration = 0;
  return { attempts: 0, maxAttempts: Math.max(1, Math.min(opts.configuredRetries === true ? 64 : 10, Math.floor(attempts))), deadlineAt: duration ? Date.now() + Math.min(86400000, duration) : Infinity };
}
function _aiRetryBudgetError() {
  var e = new Error('本次 AI 任务的恢复次数或总等待预算已用尽'); e.code = 'AI_RETRY_BUDGET'; e._aiRetryExhausted = true; return e;
}
function _aiClaimRetryAttempt(budget) {
  if (!budget) return;
  if (Date.now() >= budget.deadlineAt || budget.attempts >= budget.maxAttempts) throw _aiRetryBudgetError();
  budget.attempts++;
}
function _aiRetryDelay(response, attempt) {
  var value = response && response.headers && response.headers.get('Retry-After'), now = Date.now();
  if (value != null && String(value).trim()) {
    var seconds = Number(value), date = Date.parse(value);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds * 1000);
    if (Number.isFinite(date)) return Math.max(0, date - now);
  }
  var upper = Math.min(30000, 1000 * Math.pow(2, Math.max(0, attempt)));
  return Math.floor(upper * (0.5 + Math.random() * 0.5));
}
async function _aiBudgetedRetryWait(ms, signal, budget) {
  if (budget && (Date.now() + ms >= budget.deadlineAt || budget.attempts >= budget.maxAttempts)) throw _aiRetryBudgetError();
  return _aiWaitForRetry(ms, signal);
}
async function _aiFetchWithRetry(url, body, signal, opts) {
  var recovery = globalThis.TM && globalThis.TM.Endturn && globalThis.TM.Endturn.ResponseRecovery;
  var execute = function(next) { return _aiFetchWithRetryUncached(url, body, signal, next); };
  return recovery && !(opts && opts._recoveryValidationRetry) ? recovery.jsonRequest(url, body, signal, opts, execute) : execute(opts);
}
async function _aiFetchWithRetryUncached(url, body, signal, opts) {
  if (globalThis.TM && TM.RecoveryAdapters) opts = TM.RecoveryAdapters.beginNormal(opts);
  opts = _aiConfiguredCallOptions(opts);
  var retries = Number(opts.maxRetries); if (!Number.isFinite(retries)) retries = 3;
  retries = Math.max(0, Math.min(opts._configuredRetries ? 20 : 6, Math.floor(retries))); opts.maxRetries = retries;
  var timeout = _aiFirstResponseTimeout(body && (body.max_completion_tokens || body.max_tokens), opts);
  var budget = opts.retryBudget || _aiCreateRetryBudget({ maxAttempts: retries + 3, configuredRetries:opts._configuredRetries === true, totalTimeoutMs: _aiTotalResponseTimeout(opts) });
  opts.retryBudget = budget;
  var ctrl = new AbortController(), timer, cancel;
  var gm = typeof GM !== 'undefined' ? GM : null, player = typeof P !== 'undefined' ? P : null;
  var root = typeof window !== 'undefined' ? window : globalThis, generation = root._tmLoadGen;
  var identity = gm ? [gm._campaignId, gm._timelineId, gm.turn].join('|') : '';
  function configured() { var ai = player && player.ai || {}, second = ai.secondary || {}; return JSON.stringify([ai.url, ai.model, ai.key, second.url, second.model, second.key]); }
  var configStamp = configured();
  function current() { return configStamp === configured() && (typeof GM === 'undefined' ? null : GM) === gm && (typeof P === 'undefined' ? null : P) === player && root._tmLoadGen === generation && (!gm || identity === [gm._campaignId, gm._timelineId, gm.turn].join('|')); }
  function check() {
    if (ctrl.signal.aborted) throw ctrl.signal.reason || _aiCancelledError(signal);
    if (!current()) { var e = new Error('读取期间存档已改变，旧请求结果已丢弃'); e.code = 'AI_STALE_WORLD'; throw e; }
  }
  var diag = root.TM && root.TM.Endturn && root.TM.Endturn.Reliability, ticket = diag && diag.requestStart(opts.id);
  if (diag && diag.bindRequest) diag.bindRequest(ticket, ctrl);
  opts._requestTicket = ticket;
  opts._requestGuard = check;
  try {
    cancel = function() { ctrl.abort(signal.reason || _aiCancelledError(signal)); };
    if (signal) { signal.addEventListener('abort', cancel, { once: true }); if (signal.aborted) cancel(); }
    var explicitTotal = _aiTotalResponseTimeout(opts);
    var remaining = Math.min(budget.deadlineAt - Date.now(), explicitTotal > 0 ? explicitTotal : Infinity);
    if (remaining <= 0) throw _aiRetryBudgetError();
    if (Number.isFinite(remaining)) timer = setTimeout(function() { var e = new Error('达到明确设置的完整响应最大等待时间'); e.code = 'AI_REQUEST_DEADLINE'; e.name = 'TimeoutError'; ctrl.abort(e); }, remaining);
    var result = await _aiQueue.enqueue(function() { check(); return _aiFetchWithRetryInner(url, body, ctrl.signal, opts); }, opts.priority || 'normal', { signal: ctrl.signal, timeoutMs: _aiQueueWaitTimeout(opts) });
    check(); if (diag) diag.requestEnd(ticket, null);
    if (globalThis.TM && TM.RecoveryAdapters) TM.RecoveryAdapters.markResponse(result, opts);
    return result;
  } catch (e) { if (e && typeof e === 'object') e._aiRetryExhausted = true; if (diag) diag.requestEnd(ticket, e); throw e; }
  finally { clearTimeout(timer); if (diag && diag.unbindRequest) diag.unbindRequest(ticket, ctrl); if (signal && cancel) signal.removeEventListener('abort', cancel); }
}

// 默认按输出体量取 30–200s 首响应期限；收到成功响应头即清除。
// 完整正文由取消信号与明确配置的总上限约束，不缩减生成内容。
function _aiComputeTimeout(maxTok, optsTimeoutMs) {
  if (optsTimeoutMs != null && Number.isFinite(Number(optsTimeoutMs)) && Number(optsTimeoutMs) > 0) return Math.min(900000, Number(optsTimeoutMs));
  var t = Number(maxTok) || 2000;
  return Math.min(200000, Math.max(30000, Math.round(t * 15)));
}

function _aiCancelledError(signal) {
  if (signal && signal.reason && typeof signal.reason === 'object' && /^AI_(REQUEST_DEADLINE|RETRY_BUDGET|STALE_WORLD)$/.test(signal.reason.code || '')) return signal.reason;
  var error = new Error('AI 请求已取消');
  error.name = 'AbortError'; error.code = 'AI_ABORTED';
  if (signal && signal.reason !== undefined) error.cause = signal.reason;
  return error;
}

function _aiErrorIsTerminal(error) {
  return !!(error && (error._aiRetryExhausted === true || /^AI_(QUEUE_TIMEOUT|REQUEST_DEADLINE|RETRY_BUDGET|STALE_WORLD)$/.test(error.code || '') || error.code === 'AI_TIMEOUT' || error.code === 'AI_ABORTED'
    || error.name === 'AbortError' || error.name === 'TimeoutError'
    || /^AI_MOBILE_/.test(error.code || '') || error.code === 'mandatory_context_overflow' || error.code === 'context_length_exceeded'
    || (Number(error.status) >= 400 && Number(error.status) < 500)));
}

function _aiWaitForRetry(ms, signal) {
  return new Promise(function(resolve, reject) {
    if (signal && signal.aborted) { reject(_aiCancelledError(signal)); return; }
    var timer;
    function cleanup() { clearTimeout(timer); if (signal) signal.removeEventListener('abort', cancel); }
    function cancel() { cleanup(); reject(_aiCancelledError(signal)); }
    timer = setTimeout(function() { cleanup(); resolve(); }, ms);
    if (signal) signal.addEventListener('abort', cancel, { once:true });
  });
}

// Request-protocol compatibility helpers, loaded before the transport.
// 把 body.messages 里「带 cache_control 的数组型 content」拍回纯字符串·返回是否真剥离了（仅动含 cache_control 的，真·多模态数组不碰）
function _stripCacheControlFromBody(body) {
  if (!body || !Array.isArray(body.messages)) return false;
  var stripped = false;
  for (var i = 0; i < body.messages.length; i++) {
    var m = body.messages[i];
    if (m && Array.isArray(m.content) && m.content.some(function(b){ return b && b.cache_control; })) {
      m.content = m.content.map(function(b){ return (b && typeof b.text === 'string') ? b.text : ''; }).join('');
      stripped = true;
    }
  }
  return stripped;
}

function _isContextLengthResponse(status, text) {
  if (Number(status) !== 400) return false;
  return /context(?:_|\s|-)*(?:length|window)|maximum context|too many (?:input )?tokens|prompt (?:is )?too long|token limit|上下文.{0,8}(?:过长|超限)|超出.{0,8}(?:上下文|token)/i.test(String(text || ''));
}

// Mobile API transport: keep browser/Electron fetch untouched; native requests use
// the core HTTP plugin explicitly, not Capacitor 6's implicit fetch patch.
function _tmAINativePlatform() {
  var cap = typeof window !== 'undefined' && window.Capacitor;
  return !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
}
async function _tmAIFetch(resource, options) {
  options = options || {};
  if (!_tmAINativePlatform()) return fetch(resource, options);
  var cap = window.Capacitor, headers = new Headers(options.headers || {});
  function failure(code, message) { var e = new Error(message); e.code = code; e._tmNativeTransport = true; return e; }
  var url;
  try { url = new URL(String(resource), typeof location !== 'undefined' ? location.href : undefined); }
  catch (_) { throw failure('AI_MOBILE_URL', 'API 地址无效，请填写完整的 HTTPS 地址'); }
  if (!/^https?:$/.test(url.protocol) || url.username || url.password) {
    throw failure('AI_MOBILE_URL', 'API 地址须为 HTTP(S)，不能在地址中填写账号密码');
  }
  if (url.protocol === 'http:' && !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(url.hostname)) {
    throw failure('AI_MOBILE_INSECURE', '手机端 API 请使用 HTTPS 地址；未关闭证书验证或开放明文传输');
  }
  var method = String(options.method || 'GET').toUpperCase(), signal = options.signal;
  var completeWait = options.waitForCompleteResponse === true;
  var explicitTotal = completeWait ? _aiWaitSetting(options.totalResponseTimeoutMs, '完整响应最大等待') : 0;
  var timeoutMs = Number(options.timeoutMs);
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) timeoutMs = 180000;
  var cancelled = function() {
    var timedOut = signal && signal.reason && (signal.reason.name === 'TimeoutError' || signal.reason.code === 'AI_TIMEOUT');
    var e = failure(timedOut ? 'AI_TIMEOUT' : 'AI_ABORTED', timedOut ? '手机端 API 请求超时，请检查网络或服务商响应' : 'AI 请求已取消');
    e.name = timedOut ? 'TimeoutError' : 'AbortError'; if (timedOut) e.timeoutMs = timeoutMs; return e;
  };
  if (signal && signal.aborted) throw cancelled();  var plugin = cap.Plugins && cap.Plugins.CapacitorHttp;
  var request;
  if (plugin && typeof plugin.request === 'function') request = function(o) { return plugin.request(o); };
  else if (typeof cap.nativePromise === 'function') request = function(o) { return cap.nativePromise('CapacitorHttp', 'request', o); };
  else throw failure('AI_MOBILE_BRIDGE', '手机端原生联网组件未就绪，请重新启动或更新安卓客户端');
  var data = options.body;
  if (data != null && typeof data !== 'string') throw failure('AI_MOBILE_BODY', '此 API 请求需要 JSON 文本正文');
  if (/^(GET|HEAD)$/.test(method) && data != null) throw failure('AI_MOBILE_BODY', 'GET/HEAD 请求不能携带正文');
  // Core HTTP accepts a string as JSON content: no double JSON encoding or prompt edits.
  var nativeOptions = {
    url: url.href, method: method, headers: Object.fromEntries(headers.entries()),
    responseType: 'text', connectTimeout: Math.min(30000, timeoutMs), readTimeout: completeWait ? explicitTotal : timeoutMs,
    disableRedirects: true
  };
  if (data != null) nativeOptions.data = data;
  var timer, abort, settled = false;
  return new Promise(function(resolve, reject) {
    function cleanup() { clearTimeout(timer); if (signal) signal.removeEventListener('abort', abort); }
    function finish(error, value) { if (settled) return; settled = true; cleanup(); if (error) reject(error); else resolve(value); }
    abort = function() { finish(cancelled()); };
    if (!completeWait || explicitTotal > 0) timer = setTimeout(function() {
      var e = failure('AI_TIMEOUT', '手机端 API 请求超时（' + Math.round(timeoutMs / 1000) + '秒）');
      e.name = 'TimeoutError'; e.timeoutMs = timeoutMs; finish(e);
    }, completeWait ? explicitTotal : timeoutMs);
    if (signal) { signal.addEventListener('abort', abort, { once: true }); if (signal.aborted) { abort(); return; } }
    // The plugin has no cancel API: reject locally, ignore late results, and bound
    // native connect/read waits. Never retry via browser fetch after sending a POST.
    Promise.resolve().then(function() { if (!settled) return request(nativeOptions); }).then(function(result) {
      if (settled) return;
      if (!result || !Number.isInteger(result.status) || result.status < 200 || result.status > 599) {
        throw failure('AI_MOBILE_RESPONSE', '手机端联网组件返回了无效的 HTTP 响应');
      }
      if (result.status >= 300 && result.status < 400) {
        var redirect = failure('AI_MOBILE_REDIRECT', 'API 地址发生跳转；请填写服务商最终接口地址，避免密钥被转发');
        redirect.status = result.status; throw redirect;
      }
      var responseHeaders = new Headers();
      Object.keys(result.headers || {}).forEach(function(k) {
        var value = result.headers[k]; if (k && value != null) responseHeaders.set(k, Array.isArray(value) ? value.join(', ') : String(value));
      });
      var payload = result.data;
      // Android may already parse JSON even with responseType:text. Header case
      // and application/*+json must not turn a valid response into [object Object].
      if (payload != null && typeof payload === 'object') payload = JSON.stringify(payload);
      if (payload == null || method === 'HEAD' || result.status === 204 || result.status === 205) payload = null;
      else payload = String(payload);
      var response = new Response(payload, { status: result.status, headers: responseHeaders });
      Object.defineProperty(response, 'url', { value: result.url || url.href });
      Object.defineProperty(response, '_tmNativeBuffered', { value: true });
      finish(null, response);
    }).catch(function(error) {
      if (settled) return;
      if (error && /^AI_/.test(error.code || '')) { finish(error); return; }
      var text = String(error && (error.message || error.error) || '');
      // Do not copy native errors containing request URLs/headers into diagnostics.
      var message = /ssl|tls|certificate|trust anchor|certpath/i.test(text) ? '手机端 API 证书校验失败，请检查服务端证书链或系统时间（未跳过证书验证）' : /timed?\s*out|timeout/i.test(text) ? '手机端 API 连接或读取超时，请检查网络与服务商状态' : '手机端原生 API 请求失败，请检查网络与接口地址';
      var e = failure(/timed?\s*out|timeout/i.test(text) ? 'AI_TIMEOUT' : 'AI_MOBILE_NETWORK', message);
      if (e.code === 'AI_TIMEOUT') e.timeoutMs = timeoutMs;
      if (error && /UNIMPLEMENTED|UNAVAILABLE/.test(String(error.code || ''))) { e.code = 'AI_MOBILE_BRIDGE'; e.message = '手机端原生联网组件未就绪，请重新启动或更新安卓客户端'; }
      finish(e);
    });
  });
}

// Stream transport shares the timeout and cancellation owner.
async function _callAIMessagesStreamDirect(messages, maxTok, opts) {
  opts = _aiConfiguredCallOptions(opts);
  if (opts._configuredRetries && !opts._streamRetryOwner) return _aiConfiguredStreamRetry(messages, maxTok, opts);
  var _finalizedBody = null;
  if (opts.finalizedBody !== undefined) {
    if (!opts.finalizedBody || typeof opts.finalizedBody !== 'object' || Array.isArray(opts.finalizedBody)) {
      throw new Error('流式 finalizedBody 非法');
    }
    _finalizedBody = opts.finalizedBodyDetached === true
      ? opts.finalizedBody
      : JSON.parse(JSON.stringify(opts.finalizedBody));
    var _exactMax = Number(_finalizedBody.max_completion_tokens != null ? _finalizedBody.max_completion_tokens : _finalizedBody.max_tokens);
    var hasOutputLimit = _finalizedBody.max_completion_tokens != null || _finalizedBody.max_tokens != null;
    if (hasOutputLimit && (!Number.isFinite(_exactMax) || _exactMax <= 0)) throw new Error('流式 finalizedBody.max_tokens 非法');
    maxTok = hasOutputLimit ? Math.floor(_exactMax) : undefined;
  }
  // M3.1·次 API 走 secondary 且网络不可达 → 自动回退主 API 重试一次（_noSecFallback 防递归）
  if (_aiEffectiveTierIsSecondary(opts.tier) && !opts._noSecFallback) {
    var _oS = Object.assign({}, opts, { _noSecFallback: true });
    try { return await _callAIMessagesStreamDirect(messages, maxTok, _oS); }
    catch (e) {
      if (_isAINetworkError(e) && !_finalizedBody && !_aiErrorIsTerminal(e)) { console.warn('[AI] 次 API 不可达·回退主 API: ' + ((e && e.message) || e)); return await _callAIMessagesStreamDirect(messages, maxTok, Object.assign({}, _oS, { tier: 'primary' })); }
      throw e;
    }
  }
  // M3·按 tier 取 API 配置·默认 primary·secondary 未配自动回退（带 try 兜底以防万一）
  var _aiCfg = null;
  try { if (typeof _getAITier === 'function') _aiCfg = _getAITier(opts.tier); } catch(_){}
  if (!_aiCfg) _aiCfg = { key: (P.ai&&P.ai.key)||'', url: (P.ai&&P.ai.url)||'', model: (P.ai&&P.ai.model)||'gpt-4o', tier: 'primary' };
  var key = _aiCfg.key || (P.ai && P.ai.key) || ''; if (!key) throw new Error('API未配置');
  var url = (typeof _buildAIUrlForTier === 'function') ? _buildAIUrlForTier(opts.tier) : _buildAIUrl();
  if (!url) throw new Error('API地址未配置');
  var ctrl = new AbortController();
  var streamReject, streamPhase = 'headers';
  var streamDeadline = new Promise(function(_resolve, reject) { streamReject = reject; }); streamDeadline.catch(function() {});
  var streamTimeout = _aiFirstResponseTimeout(maxTok, opts);
  var responseWait = _aiStartResponseWait(opts, streamTimeout, function(e) { streamReject(e); ctrl.abort(e); });
  var timer = responseWait.headerTimer;
  if (opts.signal && opts.signal.aborted) { clearTimeout(timer); responseWait.dispose(); throw _aiCancelledError(opts.signal); } // 同 _toolFetchQueued·已置位预检(2026-07-04 审查定罪)
  var onExternalAbort = function() { var e = _aiCancelledError(opts.signal); streamReject(e); ctrl.abort(e); };
  if (opts.signal) opts.signal.addEventListener('abort', onExternalAbort);
  var _scaledTok = _finalizedBody
    ? maxTok
    : Math.round((maxTok || 500) * ((typeof getCompressionParams === 'function') ? Math.max(1.0, getCompressionParams().scale) : 1.0));
  try {
    if (opts._streamGuard) opts._streamGuard();
    var diag = window.TM && window.TM.Endturn && window.TM.Endturn.Reliability; if (diag) diag.requestPhase(opts._requestTicket, "request");
    // M4·Anthropic cache_control：原生 Anthropic API + sys 足够长 → 加 cache_control 享 90% 折扣
    var _msgsStream = messages;
    try {
      var _providerS = (typeof _detectAIProvider === 'function') ? _detectAIProvider() : '';
      var _isNativeS = (P.ai && P.ai.url && /api\.anthropic\.com/i.test(P.ai.url));
      if (!_finalizedBody && _providerS === 'anthropic' && _isNativeS && messages && messages.length > 0) {
        var _firstS = messages[0];
        if (_firstS && _firstS.role === 'system' && typeof _firstS.content === 'string' && _firstS.content.length > 1500) {
          _msgsStream = messages.slice();
          _msgsStream[0] = { role: 'system', content: [{ type: 'text', text: _firstS.content, cache_control: { type: 'ephemeral' } }] };
        }
      }
    } catch(_cE) {}
    var _bodyCore = _finalizedBody || {
      model: (_aiCfg && _aiCfg.model) || (P.ai && P.ai.model) || 'gpt-4o', messages: _msgsStream,
      temperature: (opts.temperature !== undefined) ? opts.temperature : (P.ai.temp || 0.8),
      max_tokens: _scaledTok
    };
    if (!_finalizedBody && opts.extraBody) Object.assign(_bodyCore, opts.extraBody);
    if (!_finalizedBody && window.TM && TM.AIOptions) _bodyCore = TM.AIOptions.apply(_bodyCore, _aiCfg, 'openai');
    _bodyCore.stream = true;
    if (globalThis.TM && TM.RecoveryAdapters) TM.RecoveryAdapters.claimNormal(opts);
    var resp = await Promise.race([(typeof _tmAIFetch === 'function' ? _tmAIFetch : fetch)(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify(_bodyCore),
      signal: ctrl.signal, timeoutMs: streamTimeout, waitForCompleteResponse: true, totalResponseTimeoutMs: _aiTotalResponseTimeout(opts)
    }), streamDeadline]);
    if (opts._streamGuard) opts._streamGuard();
    responseWait.headers(resp.ok, resp.status);
    streamPhase = "body"; if (diag) diag.requestPhase(opts._requestTicket, "body");
    if (!resp.ok) { var httpError = new Error('HTTP ' + resp.status); httpError.status = resp.status; httpError.retryAfterMs = _aiRetryDelay(resp, 0); throw httpError; }
    // 非流式回退（部分代理不支持stream）
    var ct = resp.headers.get('content-type') || '';
    if (ct.indexOf('application/json') >= 0) {
      var data = await Promise.race([resp.json(), streamDeadline]);
      if (opts._streamGuard) opts._streamGuard();
      if(opts._normalRecoveryTicket)opts._normalRecoveryTicket.streamComplete=!!(data.choices&&data.choices[0]&&data.choices[0].finish_reason==='stop'&&data.choices[0].message&&!data.choices[0].message.refusal);
      var txt = '';
      if (data.choices && data.choices[0] && data.choices[0].message) txt = data.choices[0].message.content;
      if (opts.onChunk) opts.onChunk(txt);
      if (opts._recoveryStream) {
        var recovery = globalThis.TM && globalThis.TM.Endturn && globalThis.TM.Endturn.ResponseRecovery;
        opts._recoveryStream.complete = !!recovery && recovery.jsonComplete(data);
        opts._recoveryStream.tier = _aiCfg.tier || opts.tier || 'primary';
      }
      if (opts.onDone) opts.onDone(txt);
      return txt;
    }
    // SSE 流式读取
    var reader = resp.body.getReader();
    var decoder = new TextDecoder();
    var buffer = '';
    var full = '';
    var recoveryComplete = false, recoveryInvalid = false;
    while (true) {
      var _r = await Promise.race([reader.read(), streamDeadline]);
      if (opts._streamGuard) opts._streamGuard();
      if (_r.done) break;
      buffer += decoder.decode(_r.value, { stream: true });
      var lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (!line || !line.startsWith('data:')) continue;
        var payload = line.slice(5).trim();
        if (payload === '[DONE]') { recoveryComplete = true; continue; }
        try {
          var chunk = JSON.parse(payload);
          var finishReason = chunk.choices && chunk.choices[0] && chunk.choices[0].finish_reason;
          if (finishReason === 'stop') recoveryComplete = true;
          else if (finishReason) recoveryInvalid = true;
          if (chunk.error || chunk.choices && chunk.choices[0] && chunk.choices[0].delta && chunk.choices[0].delta.refusal) recoveryInvalid = true;
          var delta = '';
          // OpenAI / compatible format
          if (chunk.choices && chunk.choices[0] && chunk.choices[0].delta) {
            delta = chunk.choices[0].delta.content || '';
          }
          if (delta) {
            full += delta;
            if (opts.onChunk) opts.onChunk(full);
          }
        } catch (_e) { recoveryInvalid = true; /* Existing partial-output handling is unchanged; never checkpoint malformed streams. */ }
      }
    }
    if (opts._recoveryStream) {
      opts._recoveryStream.complete = recoveryComplete && !recoveryInvalid && !buffer.trim();
      opts._recoveryStream.tier = _aiCfg.tier || opts.tier || 'primary';
    }
    if(opts._normalRecoveryTicket)opts._normalRecoveryTicket.streamComplete=recoveryComplete&&!recoveryInvalid&&!buffer.trim();
    if (opts.onDone) opts.onDone(full);
    return full;
  } finally {
    responseWait.dispose();
    clearTimeout(timer);
    if (reader) { try { var cancelReader = reader.cancel(); if (cancelReader && cancelReader.catch) cancelReader.catch(function() {}); reader.releaseLock(); } catch (_) {} }
    if (opts.signal && typeof opts.signal.removeEventListener === 'function') opts.signal.removeEventListener('abort', onExternalAbort);
  }
}
