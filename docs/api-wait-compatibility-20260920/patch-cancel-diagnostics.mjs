import {edit} from './patch-utils.mjs';
edit('web/tm-ai-infra-retry.js',(s,r)=>{
 s=r(s,'  var totalMs = _aiTotalResponseTimeout(opts); _aiPendingWaits.set(row.id, row);','  var totalMs = _aiTotalResponseTimeout(opts); _aiPendingWaits.set(row.id, row);\n  row.cancel = function() { if (!closed) { stop(); fail(_aiCancelledError(opts.signal)); } };');
 return r(s,'function _aiWaitSnapshot() {','function _aiCancelPendingWaits() { Array.from(_aiPendingWaits.values()).forEach(function(row) { row.cancel(); }); }\nfunction _aiWaitSnapshot() {');
});
edit('web/tm-ai-infra.js',(s,r)=>r(s,'if (e && (e.code === "AI_STALE_WORLD" || e.code === "AI_RETRY_BUDGET")) throw e;','if (e && (e.code === "AI_ABORTED" || e.code === "AI_STALE_WORLD" || e.code === "AI_RETRY_BUDGET")) throw e;'));
edit('web/tm-endturn-timing-ledger.js',(s,r)=>r(s,"      openGenericModal('回合耗时诊断', renderSummaryHtml(summary) + extra);",`      if (typeof root._aiWaitSnapshot === 'function') {
        var waiting = root._aiWaitSnapshot();
        if (waiting.length) {
          extra += '<section><h4>正在等待完整响应</h4>';
          waiting.forEach(function(w) { extra += '<div>' + _esc(w.phase === 'body' ? '已收到响应头，等待完整内容' : w.phase === 'native-buffered' ? '等待原生接口返回完整结果，首包不可见' : '尚未收到成功响应头') + ' · ' + Math.round(w.elapsedMs / 1000) + ' 秒</div>'; });
          extra += '<button class="bt bs" onclick="_aiCancelPendingWaits()">取消正在等待的 AI 请求</button></section>';
        }
      }
      openGenericModal('回合耗时诊断', renderSummaryHtml(summary) + extra);`));
