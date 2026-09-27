import { edit } from './patch-utils.mjs';
edit('web/tm-endturn-response-recovery.js',(s,r)=>{
  s=r(s,'        if (policy.onReplay) policy.onReplay(restored);',`        var assertFresh = function() {
          if (!current(s) || active !== s || s.state !== 'running' || config !== JSON.stringify(root.P && root.P.ai)) throw failed();
          if (signal && signal.aborted) throw failed('AI_ABORTED');
        };
        if (policy.onReplay) policy.onReplay(restored, assertFresh);
        assertFresh();
        var diagnostics = TM.Endturn.Reliability;
        if (diagnostics) { var ticket = diagnostics.requestStart('checkpoint:' + kind); diagnostics.requestPhase(ticket, 'reused'); diagnostics.requestEnd(ticket, null); }`);
  return r(s,'onReplay: function(v) { if (opts.onChunk) opts.onChunk(v); if (opts.onDone) opts.onDone(v); }','onReplay: function(v, assertFresh) { if (opts.onChunk) opts.onChunk(v); assertFresh(); if (opts.onDone) opts.onDone(v); }');
});
edit('web/tm-endturn-core.js',(s,r)=>r(s,"    toast(_ehuman ? ('回合中断 · ' + _ehuman) : ('回合处理出错: ' + error.message));",`    var _recoveryInfo = _responseRecovery && _responseRecovery.status();
    var _recoveryHint = _recoveryInfo && _recoveryInfo.state === 'ready' ? '；当前页面保留了 ' + _recoveryInfo.available + ' 份完整响应，重试时校验一致后复用，刷新后失效。' : '';
    toast((_ehuman ? ('回合中断 · ' + _ehuman) : ('回合处理出错: ' + error.message)) + _recoveryHint);`));
edit('web/tm-endturn-timing-ledger.js',(s,r)=>r(s,"      openGenericModal('回合耗时诊断', renderSummaryHtml(summary) + extra);",`      var recovery = root.TM && root.TM.Endturn && root.TM.Endturn.ResponseRecovery;
      if (recovery) {
        var rs = recovery.status();
        extra += '<section><h4>完整响应恢复</h4><div>本次复用 ' + (Number(rs.hits) || 0) + ' 份；待匹配候选 ' + (Number(rs.available) || 0) + ' 份。</div>';
        extra += '<p>只复用输入一致的完整响应；原有解析、质量校验和结算仍执行。不跨刷新或读档恢复。</p>';
        extra += '<button class="bt bs" onclick="TM.Endturn.ResponseRecovery.clear();TM.Endturn.Timing.openDiagnostics()">放弃本次复用，重新生成</button></section>';
      }
      openGenericModal('回合耗时诊断', renderSummaryHtml(summary) + extra);`));
