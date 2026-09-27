import { edit } from './patch-utils.mjs';
edit('web/index.html',(s,r)=>{
  const tag=s.match(/<script src="tm-endturn-reliability\.js[^\"]*"><\/script>/);
  if(!tag)throw Error('Reliability loader missing');
  return r(s,tag[0],tag[0]+'\n<script src="tm-endturn-response-recovery.js?v=20260919-quality-recovery"></script>');
});
edit('web/tm-endturn-core.js',(s,r)=>{
  s=r(s,'  var _turnScope = null;','  var _turnScope = null;\n  var _responseRecovery = globalThis.TM && globalThis.TM.Endturn && globalThis.TM.Endturn.ResponseRecovery;');
  s=r(s,'    await _tmPrepareEndTurnBoundary(_turnTxn, _preCommittedState);','    await _tmPrepareEndTurnBoundary(_turnTxn, _preCommittedState);\n    if (_responseRecovery) await _responseRecovery.begin(_turnTxn, options);');
  s=r(s,'    if (_turnTxn) _tmRollbackEndTurnTransaction(_turnTxn, error);','    if (_turnTxn) _tmRollbackEndTurnTransaction(_turnTxn, error);\n    if (_responseRecovery) _responseRecovery.finish(_turnTxn, "failed", error);');
  return r(s,"  if (!_tmCommitEndTurnTransaction(txn)) throw new Error('回合提交时世界身份已变化');","  if (!_tmCommitEndTurnTransaction(txn)) throw new Error('回合提交时世界身份已变化');\n  var responseRecovery = globalThis.TM && globalThis.TM.Endturn && globalThis.TM.Endturn.ResponseRecovery;\n  if (responseRecovery) responseRecovery.finish(txn, 'committed');");
});
edit('web/tm-endturn-agent-mode.js',(s,r)=>{
  s=r(s,'    var _conf = P.conf || {};','    var _conf = P.conf || {};\n    var recoveryFailure = null;');
  s=r(s,'    function bail(reason) {','    function bail(reason) {\n      var priorRuntime = _agentRuntime(ctx);\n      if (!recoveryFailure && priorRuntime && priorRuntime.signal.aborted && priorRuntime.signal.reason && priorRuntime.signal.reason.code) recoveryFailure = { code: priorRuntime.signal.reason.code };');
  s=r(s,'{ rolledBack: rolledBack, intentPlan: TM.Endturn.AgentIntentPlan.summarize(_intentPlan) }','{ rolledBack: rolledBack, transportFailure: recoveryFailure, intentPlan: TM.Endturn.AgentIntentPlan.summarize(_intentPlan) }');
  return r(s,"          return bail('Agent 请求失败，已停止后续调用：'","          recoveryFailure = { code: state.loopError.code, status: state.loopError.status };\n          return bail('Agent 请求失败，已停止后续调用：'");
});
edit('web/tm-endturn-response-recovery.js',(s,r)=>{
  s=r(s,"    var code = String(e.code || ''), status = Number(e.status) || 0;","    var detail = e.code === 'agent-run-failed' && e.meta && e.meta.transportFailure || e;\n    var code = String(detail.code || ''), status = Number(detail.status) || 0;");
  return r(s,'|ENDTURN_SAVE_FAILED|ENDTURN_SAVE_IO','');
});
