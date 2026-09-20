import { edit } from './patch-utils.mjs';
edit('web/tm-ai-infra.js', (s, r) => {
  s = r(s, '    if (opts.retryBudget) timeoutMs = Math.min(timeoutMs, Math.max(1, opts.retryBudget.deadlineAt - Date.now()));', '    var budgetLimited = !!opts.retryBudget && opts.retryBudget.deadlineAt - Date.now() <= timeoutMs;\n    if (opts.retryBudget) timeoutMs = Math.min(timeoutMs, Math.max(1, opts.retryBudget.deadlineAt - Date.now()));');
  return r(s, "timeoutError.name = 'TimeoutError'; timeoutError.code = 'AI_TIMEOUT';", "timeoutError.name = 'TimeoutError'; timeoutError.code = budgetLimited ? 'AI_REQUEST_DEADLINE' : 'AI_TIMEOUT';");
});
edit('web/tm-endturn-timing-ledger.js', (s, r) => {
  return r(s, "      openGenericModal('回合耗时诊断', renderSummaryHtml(summary));", `      var reliability = root.TM && root.TM.Endturn && root.TM.Endturn.Reliability;
      var attempts = reliability && reliability.snapshot ? reliability.snapshot() : [];
      var extra = '';
      if (attempts.length) {
        var last = attempts[attempts.length - 1];
        var labels = { dependency: '启动依赖', cancelled: '玩家取消', world_changed: '存档或配置改变', timeout: '等待超时', authentication: '鉴权', rate_limit: '供应商限流', provider: '供应商故障', context_budget: '上下文或恢复预算', output_format: '输出格式', persistence: '保存', world_validation: '世界校验', mobile_transport: '手机联网', runtime: '运行时' };
        extra = '<details open><summary>最近过回合尝试（回滚后仍可查看）</summary><div>模式：' + _esc(last.mode) + ' · 状态：' + _esc(last.status) + ' · 耗时：' + _esc(_fmtMs(last.ms)) + '</div>';
        if (last.failure) extra += '<div>失败类别：' + _esc(labels[last.failure.category] || last.failure.category) + ' · ' + _esc(last.failure.code) + '</div>';
        extra += '<pre style="white-space:pre-wrap;max-height:260px;overflow:auto">' + _esc(JSON.stringify(last.requests || [], null, 2)) + '</pre><small>仅保存本次页面会话的安全元数据；刷新后清除。</small></details>';
      }
      openGenericModal('回合耗时诊断', renderSummaryHtml(summary) + extra);`);
});
