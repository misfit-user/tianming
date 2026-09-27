// Shared turn diagnostics and request ownership. No world mutation or API credentials are stored.
(function(root) {
  'use strict';
  var TM = root.TM = root.TM || {};
  TM.Endturn = TM.Endturn || {};
  if (TM.Endturn.Reliability) return;
  var active = null, history = [], sequence = 0;
  function error(code, message) { var e = new Error(message); e.code = code; return e; }
  function selectedMode(p) {
    var contract = TM.Endturn.ModeContract;
    return contract ? contract.selectedMode(p) : (typeof root.agentModeOn === 'function' && root.agentModeOn() ? 'agent' : 'llm');
  }
  function preflight(p) {
    p = p || root.P || {};
    var missing = [], mode = selectedMode(p);
    function need(name, value) { if (typeof value !== 'function') missing.push(name); }
    need('Pipeline.run', TM.Endturn.Pipeline && TM.Endturn.Pipeline.run);
    need('Pipeline.buildCtx', TM.Endturn.Pipeline && TM.Endturn.Pipeline.buildCtx);
    need('_buildSaveState', root._buildSaveState);
    if (p.ai && p.ai.key) {
      need('_aiFetchWithRetry', root._aiFetchWithRetry); need('_aiComputeTimeout', root._aiComputeTimeout);
      need('_aiErrorIsTerminal', root._aiErrorIsTerminal); need('_tmAIFetch', root._tmAIFetch);
      if (mode === 'agent') {
        need('AgentMode.run', TM.Endturn.AgentMode && TM.Endturn.AgentMode.run);
        need('AgentIntentPlan.commitSpecialistProposal', TM.Endturn.AgentIntentPlan && TM.Endturn.AgentIntentPlan.commitSpecialistProposal);
      } else need('_endTurn_aiInfer', root._endTurn_aiInfer);
    }
    return { ok: !missing.length, mode: mode, missing: missing };
  }
  function classify(e) {
    var code = String(e && e.code || ''), status = Number(e && (e.status || e.statusCode)) || 0;
    if (code === 'TURN_DEPENDENCY_MISSING') return 'dependency';
    if (code === 'AI_ABORTED' || e && e.name === 'AbortError') return 'cancelled';
    if (/STALE|world_changed|load_changed/i.test(code)) return 'world_changed';
    if (/TIMEOUT|DEADLINE/.test(code) || e && e.name === 'TimeoutError') return 'timeout';
    if (status === 401 || status === 403) return 'authentication';
    if (status === 429) return 'rate_limit';
    if (status >= 500) return 'provider';
    if (/context|budget/i.test(code)) return 'context_budget';
    if (/parse|json|schema/i.test(code) || e && e.name === 'SyntaxError') return 'output_format';
    if (/save|persist|quota|storage/i.test(code)) return 'persistence';
    if (e && (e.writebackFailures || e.validity)) return 'world_validation';
    if (/^AI_MOBILE_/.test(code)) return 'mobile_transport';
    return status >= 400 ? 'request_rejected' : 'runtime';
  }
  function begin() {
    var gm = root.GM, p = root.P, generation = root._tmLoadGen;
    var identity = [gm && gm._campaignId, gm && gm._timelineId].join('|');
    var scope = { id: 'turn-' + Date.now().toString(36) + '-' + (++sequence), mode: selectedMode(p), turn: gm && gm.turn, startedAt: Date.now(), status: 'running', requests: [], stages: [] };
    scope.current = function() { return root.GM === gm && root.P === p && root._tmLoadGen === generation && identity === [gm && gm._campaignId, gm && gm._timelineId].join('|'); };
    scope.controllers = new Set();
    active = scope;
    return scope;
  }
  function requestStart(label) {
    var scope = active;
    if (!scope || scope.status !== 'running' || !scope.current()) return null;
    var row = { id: String(label || 'request').replace(/[^a-zA-Z0-9_:-]/g, '').slice(0, 80), at: Date.now(), phase: 'queue', attempts: 0 };
    scope.requests.push(row); if (scope.requests.length > 160) scope.requests.shift();
    return { row: row, owner: scope };
  }
  function bindRequest(ticket, ctrl) { if (ticket && ticket.owner.status === "running") ticket.owner.controllers.add(ctrl); }
  function unbindRequest(ticket, ctrl) { if (ticket) ticket.owner.controllers.delete(ctrl); }
  function requestPhase(ticket, phase) {
    if (!ticket || ticket.owner.status !== 'running') return;
    var row = ticket.row, now = Date.now(); row.phase = phase;
    if (phase === 'request') { if (row.queueMs == null) row.queueMs = now - row.at; row.attempts++; }
    if (phase === 'body') row.headersAt = now;
  }
  function requestEnd(ticket, e) {
    if (!ticket) return;
    var row = ticket.row; row.ms = Date.now() - row.at; row.ok = !e;
    if (e) { row.category = classify(e); row.code = String(e.code || e.name || '').slice(0, 80); row.status = Number(e.status) || 0; }
  }
  function mark(scope, stage) {
    if (scope && scope.status === 'running') scope.stages.push({ stage: stage, at: Date.now(), ms: Date.now() - scope.startedAt });
  }
  function finish(scope, status, e) {
    if (!scope || scope.status !== 'running') return;
    scope.status = status; scope.ms = Date.now() - scope.startedAt;
    if (status === 'failed') {
      scope.controllers.forEach(function(ctrl) { if (!ctrl.signal.aborted) { var stopped = error('AI_ABORTED', '本回合已失败，其余请求已停止等待'); ctrl.abort(stopped); } });
      scope.requests.forEach(function(row) { if (row.ok == null) { row.ok = false; row.category = 'cancelled'; row.code = 'TURN_FAILED_CANCELLED'; row.ms = Date.now() - row.at; } });
    }
    scope.controllers.clear();
    var record = { id: scope.id, turn: scope.turn, mode: scope.mode, startedAt: scope.startedAt, ms: scope.ms, status: status, stages: scope.stages, requests: scope.requests };
    if (e) record.failure = { category: classify(e), code: String(e.code || e.name || '').slice(0, 80), status: Number(e.status) || 0 };
    history.push(JSON.parse(JSON.stringify(record))); if (history.length > 12) history.shift();
    if (active === scope) active = null;
  }
  // An invoke timeout ends local waiting, never cancels a main-process disk operation.
  var bridgeFlights = new WeakMap(), bridgeEvents = [], bridgePending = 0;
  var BRIDGE_WAIT_MS = 60000, BRIDGE_MAX_PENDING = 32;
  function bridgeError(code, message, uncertain) {
    var e = error(code, message); e.outcome = uncertain ? 'unconfirmed' : 'not-sent'; return e;
  }
  function bridgeRecord(method, state, e, started) {
    bridgeEvents.push({ method: method, state: state, code: String(e && e.code || '').slice(0, 80), ms: Date.now() - started, at: Date.now() });
    if (bridgeEvents.length > 12) bridgeEvents.shift();
  }
  function callTurnBridge(method, payload, opts) {
    opts = opts || {};
    return new Promise(function(resolve, reject) {
      var bridge = root.tianming;
      var allowed = ['stageTurnData','publishTurnData','recoverTurnData','discardTurnData','listSaveTimelineRefs'];
      if (allowed.indexOf(method) < 0 || !bridge || typeof bridge[method] !== 'function') {
        reject(bridgeError('TURN_BRIDGE_UNAVAILABLE', '桌面分卷接口未就绪', false)); return;
      }
      if (method !== 'listSaveTimelineRefs' && bridge.turnDataProtocolVersion !== 2) { reject(bridgeError('TURN_BRIDGE_PROTOCOL', '分卷时间线协议不匹配，未发送桌面操作', false)); return; }
      var key, expected = {};
      if (payload) ['transactionId','campaignId','timelineId','turn','stateChecksum'].forEach(function(k) { expected[k] = payload[k]; });
      if (method === 'listSaveTimelineRefs') key = 'timeline-refs';
      else {
        if (!payload || !['campaignId','timelineId','transactionId'].every(function(k) { return typeof payload[k] === 'string' && payload[k].length > 0 && payload[k].length <= 160; })) {
          reject(bridgeError('TURN_BRIDGE_IDENTITY', '分卷事务身份缺失，未发送桌面写入', false)); return;
        }
        key = JSON.stringify([payload.campaignId, payload.timelineId, payload.transactionId]);
      }
      var table = bridgeFlights.get(bridge);
      if (!table) { table = new Map(); bridgeFlights.set(bridge, table); }
      if (table.has(key)) { reject(bridgeError('TURN_BRIDGE_PENDING', '同一分卷事务仍等待桌面回执，未重复发送', true)); return; }
      if (bridgePending >= BRIDGE_MAX_PENDING) { reject(bridgeError('TURN_BRIDGE_BUSY', '桌面未确认请求过多，请核对后重新打开游戏', true)); return; }
      var signal = opts.signal, protocol = bridge.turnDataProtocolVersion, token = {}, started = Date.now(), timer, done = false, ticket;
      function current() { return root.tianming === bridge && bridge.turnDataProtocolVersion === protocol && (!opts.isCurrent || opts.isCurrent() === true); }
      function cleanup() { clearTimeout(timer); if (signal) signal.removeEventListener('abort', cancelled); }
      function stop(e) {
        if (done) return; done = true; cleanup(); bridgeRecord(method, 'waiting-ended', e, started);
        requestEnd(ticket, e); reject(e);
      }
      function cancelled() { stop(bridgeError('TURN_BRIDGE_ABORTED', '已停止等待桌面分卷回执；未宣称远端操作已取消', true)); }
      function settle(e, value) {
        if (table.get(key) === token) { table.delete(key); bridgePending--; }
        if (done) { bridgeRecord(method, e ? 'late-rejection' : 'late-response', null, started); return; }
        try { if (!current()) e = bridgeError('TURN_BRIDGE_STALE', '分卷回执对应的世界或桌面连接已改变', true); } catch (guardError) { e = guardError; }
        if (!e && value && value.success === true && method !== 'listSaveTimelineRefs') {
          var mismatch = Object.keys(expected).some(function(k) { return value[k] != null && String(value[k]) !== String(expected[k]); });
          if (mismatch) e = bridgeError('TURN_BRIDGE_IDENTITY', '桌面分卷回执身份不匹配，保留恢复信息', true);
        }
        done = true; cleanup(); bridgeRecord(method, e ? 'failed' : 'responded', e, started);
        requestEnd(ticket, e || (value && value.success === false ? error('TURN_BRIDGE_REJECTED', '桌面返回失败') : null));
        if (e) reject(e); else resolve(value);
      }
      try {
        if (signal && signal.aborted) { reject(bridgeError('TURN_BRIDGE_ABORTED', '操作已取消，未发送桌面请求', false)); return; }
        if (!current()) { reject(bridgeError('TURN_BRIDGE_STALE', '世界已改变，未发送旧分卷请求', false)); return; }
        table.set(key, token); bridgePending++;
        ticket = requestStart('bridge:' + method); requestPhase(ticket, 'request');
        timer = setTimeout(function() { stop(bridgeError('TURN_BRIDGE_TIMEOUT', '桌面分卷等待超时；远端结果未确认，恢复凭据保持不变', true)); }, BRIDGE_WAIT_MS);
        if (signal) signal.addEventListener('abort', cancelled, { once: true });
        var response = method === 'listSaveTimelineRefs' ? bridge[method]() : bridge[method](payload);
        Promise.resolve(response).then(function(value) { settle(null, value); }, function(e) { settle(e); });
      } catch (e) { settle(e); }
    });
  }
  function bridgeDiagnostics() { return { pending: bridgePending, limit: BRIDGE_MAX_PENDING, waitMs: BRIDGE_WAIT_MS, events: JSON.parse(JSON.stringify(bridgeEvents)) }; }

  function snapshot() { return JSON.parse(JSON.stringify(history)); }
  TM.Endturn.Reliability = { preflight: preflight, classify: classify, begin: begin, mark: mark, finish: finish, requestStart: requestStart, requestPhase: requestPhase, requestEnd: requestEnd, bindRequest: bindRequest, unbindRequest: unbindRequest, snapshot: snapshot,
    callTurnBridge: callTurnBridge, bridgeDiagnostics: bridgeDiagnostics,
    assertReady: function(p) { var result = preflight(p); if (!result.ok) { var e = error('TURN_DEPENDENCY_MISSING', '过回合依赖未加载：' + result.missing.join('、') + '。未发送 AI 请求。'); e.missing = result.missing; throw e; } return result; } };
})(typeof window !== 'undefined' ? window : globalThis);
