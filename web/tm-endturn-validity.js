// tm-endturn-validity.js - local commit gate for end-turn AI results
(function(global) {
  'use strict';

  global.TM = global.TM || {};
  global.TM.Endturn = global.TM.Endturn || {};
  global.TM.Endturn.Validity = global.TM.Endturn.Validity || {};

  var ns = global.TM.Endturn.Validity;

  function _isObject(v) {
    return !!v && typeof v === 'object' && !Array.isArray(v);
  }

  function _text(v) {
    return typeof v === 'string' ? v.trim() : '';
  }

  function _isFailureText(v) {
    var s = _text(v);
    if (!s) return true;
    return /^(失败[:：]|错误$|本回合 AI 推演未形成可提交结果|AI推演未返回有效数据)/.test(s);
  }

  function _collectCallFailures(ctx) {
    var out = [];
    try {
      if (global.GM && GM._turnAiResults && Array.isArray(GM._turnAiResults._callFailures)) {
        out = out.concat(GM._turnAiResults._callFailures);
      }
    } catch(_) {}
    try {
      var metaFailures = ctx && ctx.meta && ctx.meta.aiInferMeta && ctx.meta.aiInferMeta.callFailures;
      if (Array.isArray(metaFailures)) out = out.concat(metaFailures);
    } catch(_) {}
    return out;
  }

  function _isCriticalFailure(f) {
    if (!f) return false;
    var id = _text(f.id).toLowerCase();
    var label = _text(f.label);
    return id === 'sc1' || id === 'main' || id === 'endturn'
      || /结构化|主推演|endturn|SC1/i.test(label);
  }

  function _finish(result) {
    result.checkedAt = (global.GM && typeof GM.turn === 'number') ? GM.turn : 0;
    result.ok = result.status !== 'failed';
    return result;
  }

  function _buildMessage(validity) {
    validity = validity || {};
    var reasons = Array.isArray(validity.reasons) ? validity.reasons : [];
    return '本回合 AI 推演未形成可提交结果：' + (reasons.join('；') || '未知原因');
  }

  function EndturnInvalidResultError(validity) {
    this.name = 'EndturnInvalidResultError';
    this.validity = validity || null;
    this.message = _buildMessage(this.validity);
    if (Error.captureStackTrace) Error.captureStackTrace(this, EndturnInvalidResultError);
  }
  EndturnInvalidResultError.prototype = Object.create(Error.prototype);
  EndturnInvalidResultError.prototype.constructor = EndturnInvalidResultError;

  ns.EndturnInvalidResultError = EndturnInvalidResultError;

  // Completion is owned by the real main generation, never by auxiliary approval.
  ns.mainResult = function(ctx) {
    ctx=ctx||{};var results=ctx.results||{},record=ctx.record||{},output=results.aiResult||record;
    var sc1=results.sc1;
    if(!sc1&&ctx.input&&ctx.input._agentModeRan===true)sc1=results.aiResult;
    if(!sc1&&results.aiResult&&global.GM&&GM._turnAiResults)sc1=GM._turnAiResults.subcall1;
    if(!_isObject(sc1)||!Object.keys(sc1).length||sc1._emergencyFallback||sc1._g2Fallback)return null;
    var narrative=_text(output.shizhengji)||_text(sc1.shizhengji)||_text(sc1.narrative);
    if(_isFailureText(narrative))return null;
    return {sc1:sc1,narrative:narrative};
  };
  ns.defer = function(ctx,label,error) {
    ctx.meta=ctx.meta||{};var rows=ctx.meta.deferredIssues||(ctx.meta.deferredIssues=[]);
    var row={stage:String(label||'auxiliary'),code:String(error&&error.code||''),reason:String(error&&error.message||error||'待补正')};
    rows.push(row);if(global.console&&console.warn)console.warn('[EndturnDeferred] '+row.stage+': '+row.reason+'；主推演已完成，继续保存回合');return row;
  };
  ns.canDefer = function(ctx,error) {
    if(!ns.mainResult(ctx))return false;
    var meta=ctx.meta||{},signal=ctx.signal||meta.signal,txn=meta.transaction;
    if(signal&&signal.aborted||txn&&txn.rolledBack)return false;
    if(txn&&(txn.gmRef&&txn.gmRef!==global.GM||txn.pRef&&txn.pRef!==global.P||txn.loadGen!==undefined&&Number(txn.loadGen)!==Number(global._tmLoadGen||0)))return false;
    var owned=txn&&txn.gmRef===global.GM&&txn.pRef===global.P&&(txn.loadGen===undefined||Number(txn.loadGen)===Number(global._tmLoadGen||0));
    // Respect cancellation and world ownership. Real durable-save errors remain fatal.
    return !(error&&(error.mainCommitted||/^(SAVE_|STORAGE_|PRE_ENDTURN|WORLD_)/.test(error.code||'')||!owned&&(error.name==='AbortError'||/^(AI_ABORTED|AI_STALE)/.test(error.code||''))));
  };
  ns.recoverMain = function(ctx,error,label) {
    if(!ns.canDefer(ctx,error))return false;
    ctx.meta=ctx.meta||{};
    var main=ns.mainResult(ctx),out=ns.preserveNarrative(ctx);
    ctx.record=ctx.record||{};ctx.record.shizhengji=main.narrative;
    if(_isFailureText(ctx.record.zhengwen))ctx.record.zhengwen=_isFailureText(out.zhengwen)?main.narrative:out.zhengwen;
    if(error&&error.mainWriteback)ctx.meta.deferredMainOutput=main.sc1;
    ns.defer(ctx,label||'辅助推演',error);return true;
  };
  // A failed world-data writer may exit before record assembly. Its generated
  // chronicle remains valid output and must survive independently of that writer.
  ns.preserveNarrative=function(ctx){
    var results=ctx.results||{},record=ctx.record||(ctx.record={});
    var sources=[results.aiResult,record,results.sc1d,results.sc1].filter(_isObject);
    var fields={shizhengji:['shizhengji'],zhengwen:['zhengwen'],shiluText:['shiluText','shilu_text','shilu','record'],
      szjTitle:['szjTitle','szj_title','shizhengji_title','title'],szjSummary:['szjSummary','szj_summary','shizhengji_summary','summary'],
      turnSummary:['turnSummary','turn_summary'],playerStatus:['playerStatus','player_status'],playerInner:['playerInner','player_inner'],
      hourenXishuo:['hourenXishuo','houren_xishuo','houren']};
    Object.keys(fields).forEach(function(key){
      var candidates=/^(zhengwen|hourenXishuo)$/.test(key)?[results.aiResult,results.sc2,record,results.sc1d,results.sc1].filter(_isObject):sources;
      for(var i=0;i<candidates.length;i++)for(var j=0;j<fields[key].length;j++){
        var value=candidates[i][fields[key][j]];
        try{if(global.TM&&TM.AIResultContract)value=TM.AIResultContract.text(value,key);}catch(_){continue;}
        if(_text(value)){record[key]=value;return;}
      }
    });
    var arrays={personnelChanges:'personnel_changes',suggestions:'suggestions',basis_refs:'basisRefs'};
    Object.keys(arrays).forEach(function(key){var candidates=sources.concat([results.sc2]).filter(_isObject);for(var i=0;i<candidates.length;i++){var value=candidates[i][key]||candidates[i][arrays[key]];if(Array.isArray(value)&&value.length){record[key]=value;break;}}});
    return record;
  };
  ns.renderArgs=function(ctx){var r=ns.preserveNarrative(ctx),i=ctx.input||{};return [r.shizhengji,r.zhengwen||r.shizhengji,r.playerStatus,r.playerInner,i.edicts,i.xinglu,i.oldVars,'',ctx.results.queueResult,r.suggestions,ctx.results.tyrantResult,r.turnSummary,r.shiluText,r.szjTitle,r.szjSummary,r.personnelChanges,r.hourenXishuo,{basis_refs:r.basis_refs||[],source:'sc1d'}];};
  ns.minimalPresentation=function(ctx){
    var r=ns.preserveNarrative(ctx),turn=Number(GM.turn)-1;
    var esc=function(s){return String(s||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});};
    var html='<section class="turn-result"><h2>'+esc(r.szjTitle||'本回合纪事')+'</h2><div style="white-space:pre-wrap">'+esc(r.shizhengji)+'</div>'+(r.shiluText?'<h3>实录</h3><div style="white-space:pre-wrap">'+esc(r.shiluText)+'</div>':'')+(r.hourenXishuo?'<h3>后人戏说</h3><div style="white-space:pre-wrap">'+esc(r.hourenXishuo)+'</div>':'')+'</section>';
    if(!Array.isArray(GM.shijiHistory))GM.shijiHistory=[]; // arch-ok: fallback record owner preserves the already generated turn when optional presentation fails.
    var index=GM.shijiHistory.findIndex(function(row){return row&&Number(row.turn)===turn;});
    if(index<0){GM.shijiHistory.push({turn:turn,shizhengji:r.shizhengji,zhengwen:r.zhengwen||r.shizhengji,shilu:r.shiluText||'',szjTitle:r.szjTitle||'',szjSummary:r.szjSummary||'',turnSummary:r.turnSummary||'',houren:r.hourenXishuo||'',playerStatus:r.playerStatus||'',playerInner:r.playerInner||'',personnel:r.personnelChanges||[],suggestions:r.suggestions||[],basis_refs:r.basis_refs||[],edicts:ctx.input.edicts,html:html});index=GM.shijiHistory.length-1;} // arch-ok: one actual main result record, never a fabricated inference or duplicate tick.
    return {shijiHtml:GM.shijiHistory[index].html||html,shijiIndex:index,pendingToasts:[],turnData:{}};
  };

  ns.validateBeforeCommit = function(ctx) {
    ctx = ctx || {};
    var aiEnabled = !!(global.P && P.ai && P.ai.key);
    var results = ctx.results || {};
    var record = ctx.record || {};
    var aiResult = results.aiResult || {};
    var sc1 = results.sc1;
    if (!sc1 && ctx.input && ctx.input._agentModeRan === true) sc1 = results.aiResult;
    try {
      if (!sc1 && global.GM && GM._turnAiResults) sc1 = GM._turnAiResults.subcall1 || null;
    } catch(_) {}

    if (!aiEnabled) {
      return _finish({ status: 'ok', mode: 'no-ai', reasons: [], warnings: ['AI disabled'] });
    }

    var reasons = [];
    var warnings = [];
    var shizhengji = _text(aiResult.shizhengji || record.shizhengji);
    var zhengwen = _text(aiResult.zhengwen || record.zhengwen);
    var hasSc1 = _isObject(sc1) && Object.keys(sc1).length > 0;
    var meta = ctx.meta && ctx.meta.aiInferMeta || ctx.meta || {};
    var appFailures = (global.GM && GM._turnAiResults && GM._turnAiResults._applyFailures) || [];
    var errors = Array.isArray(meta.errors) ? meta.errors : [];
    if ((Array.isArray(appFailures) && appFailures.length) || errors.some(function(e) { return e && e.id === 'sc1_apply'; }) || meta.mainWriteback && meta.mainWriteback.ok !== true) warnings.push('部分主推演变更尚未落账，已保留待补正');
    if (meta.requireMainWriteback && !(meta.mainWriteback && meta.mainWriteback.ok === true)) warnings.push('主写回回执不完整，待补正');
    if (meta.requireTurnReview && !(meta.emergencyReview && meta.emergencyReview.verified === true)) warnings.push('Agent 复核仍有待处理事项，不影响已完成的主推演提交');
    if (sc1 && (sc1._emergencyFallback || sc1._g2Fallback)) reasons.push('主推演仅有应急或片段合成结果，不是完整推演');

    if (!hasSc1) reasons.push('SC1 结构化数据为空');
    else if (sc1._g2Fallback) warnings.push('SC1 使用 SC1b/SC1c 降级合成结果');

    if (_isFailureText(shizhengji)) reasons.push('时政记为空或为失败文本');
    if (_isFailureText(zhengwen)) warnings.push('辅助正文未完成，保留已生成的时政记');

    var failures = _collectCallFailures(ctx);
    var criticalFailures = failures.filter(_isCriticalFailure);
    if (criticalFailures.length && !hasSc1) reasons.push('关键 AI 调用失败且没有可用 SC1 结果');
    else if (criticalFailures.length) warnings.push('关键 AI 调用曾失败，但已有可用结果');

    if (reasons.length) {
      return _finish({
        status: 'failed',
        reasons: reasons,
        warnings: warnings,
        criticalFailures: criticalFailures.slice(0, 5),
        sc1Present: hasSc1,
        shizhengjiLength: shizhengji.length,
        zhengwenLength: zhengwen.length
      });
    }

    return _finish({
      status: warnings.length ? 'degraded' : 'ok',
      reasons: [],
      warnings: warnings,
      criticalFailures: criticalFailures.slice(0, 5),
      sc1Present: hasSc1,
      shizhengjiLength: shizhengji.length,
      zhengwenLength: zhengwen.length
    });
  };
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : globalThis));
