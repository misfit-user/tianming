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
  function stop() {
    if (closed) return; closed = true;
    clearTimeout(headerTimer); clearTimeout(hardTimer); clearTimeout(noticeTimer); clearTimeout(guardTimer);
    _aiPendingWaits.delete(row.id);
  }
  function reject(code, ms) {
    if (closed) return;
    var e = new Error(code === 'AI_REQUEST_DEADLINE' ? '达到明确设置的完整响应最大等待时间' : '等待服务端首响应超时，尚未收到成功响应头');
    e.name = 'TimeoutError'; e.code = code; e.timeoutMs = ms; e.phase = row.phase; stop(); fail(e);
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
  return { headers: function(ok) {
    if (!ok || closed) return;
    clearTimeout(headerTimer); clearTimeout(noticeTimer); row.phase = 'body'; row.headersAt = Date.now();
    noticeTimer = setTimeout(notice, 120000);
  }, dispose: stop };
}
function _aiWaitSnapshot() {
  return Array.from(_aiPendingWaits.values(), function(row) { return { phase: row.phase, elapsedMs: Date.now() - row.startedAt, headersReceived: row.headersAt != null }; });
}
