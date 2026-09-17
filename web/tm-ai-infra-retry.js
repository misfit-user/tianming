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
async function _aiFetchWithRetry(url, body, signal, opts) {
  opts = opts || {};
  var priority = opts.priority || 'normal';
  // 所有 AI 调用走队列，受全局 maxConcurrent + minInterval 约束
  return _aiQueue.enqueue(function() {
    return _aiFetchWithRetryInner(url, body, signal, opts);
  }, priority);
}

// 默认按输出体量取 30–200s；显式子调用策略优先。本轮不改变时限/输出质量，
// 只保证同一个时限覆盖响应头与完整正文，而不是拿到响应头就提前清掉。
function _aiComputeTimeout(maxTok, optsTimeoutMs) {
  if (optsTimeoutMs != null) return optsTimeoutMs;
  var t = Number(maxTok) || 2000;
  return Math.min(200000, Math.max(30000, Math.round(t * 15)));
}

function _aiCancelledError(signal) {
  var error = new Error('AI 请求已取消');
  error.name = 'AbortError'; error.code = 'AI_ABORTED';
  if (signal && signal.reason !== undefined) error.cause = signal.reason;
  return error;
}

function _aiErrorIsTerminal(error) {
  return !!(error && (error.code === 'AI_TIMEOUT' || error.code === 'AI_ABORTED'
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
    responseType: 'text', connectTimeout: Math.min(30000, timeoutMs), readTimeout: timeoutMs,
    disableRedirects: true
  };
  if (data != null) nativeOptions.data = data;
  var timer, abort, settled = false;
  return new Promise(function(resolve, reject) {
    function cleanup() { clearTimeout(timer); if (signal) signal.removeEventListener('abort', abort); }
    function finish(error, value) { if (settled) return; settled = true; cleanup(); if (error) reject(error); else resolve(value); }
    abort = function() { finish(cancelled()); };
    timer = setTimeout(function() {
      var e = failure('AI_TIMEOUT', '手机端 API 请求超时（' + Math.round(timeoutMs / 1000) + '秒）');
      e.name = 'TimeoutError'; e.timeoutMs = timeoutMs; finish(e);
    }, timeoutMs);
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
