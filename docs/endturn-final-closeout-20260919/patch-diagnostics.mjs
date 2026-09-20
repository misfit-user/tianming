import {edit} from './patch-utils.mjs';
edit('web/tm-endturn-timing-ledger.js',(s,r)=>{
 s=r(s,'只复用输入一致的完整响应；原有解析、质量校验和结算仍执行。不跨刷新或读档恢复。','只复用输入一致的完整响应；原有解析、质量校验和结算仍执行。刷新后仅严格匹配的本地候选可复用，不跨不同世界或分支。');
 const anchor="      openGenericModal('回合耗时诊断', renderSummaryHtml(summary) + extra);";
 const block=`      var vault = root.TM && root.TM.Endturn && root.TM.Endturn.RecoveryVault;
      if (vault) {
        var vs = vault.status();
        extra += '<section><h4>本地恢复候选</h4><div>状态：' + _esc(vs.state) + '；保留完整响应，不保存 API 密钥或请求正文。默认最多 30 分钟，容量不足不影响正常推演。</div>';
        extra += '<button class="bt bs" onclick="TM.Endturn.RecoveryVault.setEnabled(!TM.Endturn.RecoveryVault.enabled());TM.Endturn.Timing.openDiagnostics()">' + (vault.enabled() ? '关闭并清除本地候选' : '启用本地候选') + '</button></section>';
      }
      var reconcile = root.TM && root.TM.Endturn && root.TM.Endturn.SaveReconcile;
      if (reconcile && reconcile.status().state !== 'idle') {
        var sr = reconcile.status();
        extra += '<section><h4>主存档结果核对</h4><div>' + _esc(sr.state) + (sr.error ? '：' + _esc(sr.error) : '') + '</div><button class="bt bs" onclick="TM.Endturn.SaveReconcile.check().then(function(){TM.Endturn.Timing.openDiagnostics()})">核对并完成原回合</button></section>';
      }
`;
 return r(s,anchor,block+anchor);
});
