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
    || error.code === 'mandatory_context_overflow' || error.code === 'context_length_exceeded'
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
