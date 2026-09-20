import { edit } from './patch-utils.mjs';
edit('web/tm-endturn-reliability.js', (s, r) => {
  s = r(s, '    active = scope;', '    scope.controllers = new Set();\n    active = scope;');
  s = r(s, '    scope.status = status; scope.ms = Date.now() - scope.startedAt;', `    scope.status = status; scope.ms = Date.now() - scope.startedAt;
    if (status === 'failed') {
      scope.controllers.forEach(function(ctrl) { if (!ctrl.signal.aborted) { var stopped = error('AI_ABORTED', '本回合已失败，其余请求已停止等待'); ctrl.abort(stopped); } });
      scope.requests.forEach(function(row) { if (row.ok == null) { row.ok = false; row.category = 'cancelled'; row.code = 'TURN_FAILED_CANCELLED'; row.ms = Date.now() - row.at; } });
    }
    scope.controllers.clear();`);
  s = r(s, '  function requestPhase(ticket, phase) {', '  function bindRequest(ticket, ctrl) { if (ticket && ticket.owner.status === "running") ticket.owner.controllers.add(ctrl); }\n  function unbindRequest(ticket, ctrl) { if (ticket) ticket.owner.controllers.delete(ctrl); }\n  function requestPhase(ticket, phase) {');
  return r(s, 'requestEnd: requestEnd, snapshot: snapshot,', 'requestEnd: requestEnd, bindRequest: bindRequest, unbindRequest: unbindRequest, snapshot: snapshot,');
});
edit('web/tm-ai-infra-retry.js', (s, r) => {
  s = r(s, "var diag = root.TM && root.TM.Endturn && root.TM.Endturn.Reliability, ticket = diag && diag.requestStart(opts.id || 'stream');", "var diag = root.TM && root.TM.Endturn && root.TM.Endturn.Reliability, ticket = diag && diag.requestStart(opts.id || 'stream');\n  if (diag && diag.bindRequest) diag.bindRequest(ticket, ctrl);");
  s = r(s, 'var diag = root.TM && root.TM.Endturn && root.TM.Endturn.Reliability, ticket = diag && diag.requestStart(opts.id);', 'var diag = root.TM && root.TM.Endturn && root.TM.Endturn.Reliability, ticket = diag && diag.requestStart(opts.id);\n  if (diag && diag.bindRequest) diag.bindRequest(ticket, ctrl);');
  s = r(s, "finally { clearTimeout(timer); if (opts.signal) opts.signal.removeEventListener('abort', external); }", "finally { clearTimeout(timer); if (diag && diag.unbindRequest) diag.unbindRequest(ticket, ctrl); if (opts.signal) opts.signal.removeEventListener('abort', external); }");
  return r(s, "finally { clearTimeout(timer); if (signal && cancel) signal.removeEventListener('abort', cancel); }", "finally { clearTimeout(timer); if (diag && diag.unbindRequest) diag.unbindRequest(ticket, ctrl); if (signal && cancel) signal.removeEventListener('abort', cancel); }");
});
