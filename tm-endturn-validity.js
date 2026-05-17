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
    return (v == null) ? '' : String(v).trim();
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

  ns.validateBeforeCommit = function(ctx) {
    ctx = ctx || {};
    var aiEnabled = !!(global.P && P.ai && P.ai.key);
    var results = ctx.results || {};
    var record = ctx.record || {};
    var aiResult = results.aiResult || {};
    var sc1 = results.sc1;
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

    if (!hasSc1) reasons.push('SC1 结构化数据为空');
    else if (sc1._g2Fallback) warnings.push('SC1 使用 SC1b/SC1c 降级合成结果');

    if (_isFailureText(shizhengji)) reasons.push('时政记为空或为失败文本');
    if (_isFailureText(zhengwen)) reasons.push('正文为空或为失败文本');

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
