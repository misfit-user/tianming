// @ts-check
// End-turn timing ledger.
(function(root) {
  if (!root) return;
  root.TM = root.TM || {};
  root.TM.Endturn = root.TM.Endturn || {};

  function _now() {
    return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  }

  function _wallNow() {
    return Date.now();
  }

  function _turn() {
    try { return (typeof GM !== 'undefined' && GM && GM.turn) ? GM.turn : 0; } catch(_) { return 0; }
  }

  function _fmtMs(ms) {
    ms = Math.max(0, Number(ms) || 0);
    if (ms >= 60000) return (ms / 60000).toFixed(ms >= 600000 ? 1 : 2) + 'm';
    if (ms >= 1000) return (ms / 1000).toFixed(ms >= 10000 ? 1 : 2) + 's';
    return Math.round(ms) + 'ms';
  }

  function _labelOf(entry) {
    if (!entry) return '';
    return entry.label || entry.step || entry.id || entry.kind || '';
  }

  function _slowLevel(ms) {
    ms = Number(ms) || 0;
    if (ms >= 180000) return 'critical';
    if (ms >= 60000) return 'high';
    if (ms >= 15000) return 'medium';
    return 'normal';
  }

  function _ensureHistory(ledger) {
    try {
      if (typeof GM === 'undefined' || !GM) return;
      if (!Array.isArray(GM._endturnTimingHistory)) GM._endturnTimingHistory = [];
      var hist = GM._endturnTimingHistory;
      if (ledger && hist.indexOf(ledger) < 0) {
        hist.push(ledger);
        if (hist.length > 20) hist.splice(0, hist.length - 20);
      }
    } catch(_) {}
  }

  function _getLedger(ctx) {
    if (ctx && ctx.meta && ctx.meta.timingLedger) return ctx.meta.timingLedger;
    try {
      if (typeof GM !== 'undefined' && GM && GM._endturnTimingLedger) return GM._endturnTimingLedger;
    } catch(_) {}
    return null;
  }

  function startLedger(ctx, meta) {
    var t = _now();
    var ledger = {
      turn: _turn(),
      startedAt: _wallNow(),
      startMs: t,
      status: 'running',
      totalMs: 0,
      entries: [],
      steps: [],
      subcalls: [],
      systems: [],
      background: [],
      queue: [],
      current: null,
      summary: null,
      meta: meta || {}
    };
    if (ctx) {
      ctx.meta = ctx.meta || {};
      ctx.meta.timingLedger = ledger;
    }
    try { if (typeof GM !== 'undefined' && GM) GM._endturnTimingLedger = ledger; } catch(_) {}
    _ensureHistory(ledger);
    return ledger;
  }

  function mark(ctx, kind, data) {
    var ledger = _getLedger(ctx);
    if (!ledger) ledger = startLedger(ctx || null, { autoStarted: true });
    ledger.entries = Array.isArray(ledger.entries) ? ledger.entries : [];
    ledger.steps = Array.isArray(ledger.steps) ? ledger.steps : [];
    ledger.subcalls = Array.isArray(ledger.subcalls) ? ledger.subcalls : [];
    ledger.systems = Array.isArray(ledger.systems) ? ledger.systems : [];
    ledger.background = Array.isArray(ledger.background) ? ledger.background : [];
    ledger.queue = Array.isArray(ledger.queue) ? ledger.queue : [];
    var entry = Object.assign({
      kind: kind || 'mark',
      turn: _turn(),
      at: _wallNow(),
      sinceStartMs: Math.max(0, _now() - (ledger.startMs || _now()))
    }, data || {});
    ledger.entries.push(entry);
    if (entry.kind === 'step_start') ledger.current = entry;
    if (entry.kind === 'step') ledger.steps.push(entry);
    else if (entry.kind === 'subcall') ledger.subcalls.push(entry);
    else if (entry.kind === 'systems_stage') ledger.systems.push(entry);
    else if (entry.kind === 'background') ledger.background.push(entry);
    else if (entry.kind === 'queue') ledger.queue.push(entry);
    return entry;
  }

  async function wrap(ctx, kind, label, fn, data) {
    var t0 = _now();
    try {
      var result = await fn();
      mark(ctx, kind, Object.assign({ label: label, ok: true, ms: _now() - t0 }, data || {}));
      return result;
    } catch(e) {
      mark(ctx, kind, Object.assign({
        label: label,
        ok: false,
        ms: _now() - t0,
        error: String(e && (e.message || e) || '')
      }, data || {}));
      throw e;
    }
  }

  function buildSummary(ledger) {
    ledger = ledger || _getLedger(null);
    if (!ledger) return null;
    var entries = Array.isArray(ledger.entries) ? ledger.entries : [];
    var timed = entries.filter(function(e) {
      return e && typeof e.ms === 'number' && isFinite(e.ms) && e.ms >= 0
        && e.kind !== 'step_start';
    }).map(function(e) {
      return {
        kind: e.kind || '',
        id: e.id || e.step || '',
        label: _labelOf(e),
        ok: e.ok !== false,
        ms: Math.max(0, e.ms || 0),
        text: _fmtMs(e.ms || 0),
        level: _slowLevel(e.ms || 0),
        error: e.error || '',
        status: e.status || '',
        attempts: e.attempts || undefined,
        phase: e.phase || ''
      };
    });
    timed.sort(function(a, b) { return b.ms - a.ms; });
    var failed = timed.filter(function(e) { return e.ok === false || e.error; }).slice(0, 12);
    var slow = timed.filter(function(e) { return e.ms >= 15000; }).slice(0, 12);
    var steps = Array.isArray(ledger.steps) ? ledger.steps : [];
    var systems = Array.isArray(ledger.systems) ? ledger.systems : [];
    var subcalls = Array.isArray(ledger.subcalls) ? ledger.subcalls : [];
    var background = Array.isArray(ledger.background) ? ledger.background : [];
    var totalMs = Math.max(0, Number(ledger.totalMs) || (_now() - (ledger.startMs || _now())));
    var current = ledger.current ? {
      kind: ledger.current.kind || '',
      step: ledger.current.step || '',
      label: _labelOf(ledger.current),
      sinceStartMs: Math.max(0, Number(ledger.current.sinceStartMs) || 0),
      at: ledger.current.at || 0
    } : null;
    return {
      turn: ledger.turn || _turn(),
      status: ledger.status || 'running',
      startedAt: ledger.startedAt || 0,
      finishedAt: ledger.finishedAt || 0,
      totalMs: totalMs,
      totalText: _fmtMs(totalMs),
      current: current,
      slowest: timed[0] || null,
      slow: slow,
      top: timed.slice(0, 10),
      failed: failed,
      counts: {
        entries: entries.length,
        steps: steps.length,
        subcalls: subcalls.length,
        systems: systems.length,
        background: background.length,
        queue: Array.isArray(ledger.queue) ? ledger.queue.length : 0
      },
      systems: systems.slice().sort(function(a, b) { return (b.ms || 0) - (a.ms || 0); }).slice(0, 12),
      subcalls: subcalls.slice().sort(function(a, b) { return (b.ms || 0) - (a.ms || 0); }).slice(0, 12),
      generatedAt: Date.now()
    };
  }

  function _publishSummary(ledger) {
    var summary = buildSummary(ledger);
    if (!summary) return null;
    ledger.summary = summary;
    try {
      if (typeof GM !== 'undefined' && GM) GM._lastEndturnTimingSummary = summary;
    } catch(_) {}
    try {
      if (typeof ensureAIDiagnostics === 'function') {
        var d = ensureAIDiagnostics(summary.turn);
        if (d) d.timing = summary;
      }
    } catch(_) {}
    try {
      if (typeof console !== 'undefined' && console.log) {
        console.log('[EndturnTiming] total=' + summary.totalText + ' status=' + summary.status, summary);
        if (console.table && summary.top && summary.top.length) {
          console.table(summary.top.map(function(x) {
            return { kind: x.kind, id: x.id, label: x.label, ms: Math.round(x.ms), ok: x.ok, level: x.level };
          }));
        }
      }
    } catch(_) {}
    try {
      var slowest = summary.slowest;
      if (slowest && slowest.ms >= 60000 && typeof toast === 'function') {
        toast('过回合耗时 ' + summary.totalText + '；最慢：' + slowest.label + ' ' + slowest.text);
      }
    } catch(_) {}
    return summary;
  }

  function _esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(ch) {
      return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[ch];
    });
  }

  function renderSummaryHtml(summary) {
    summary = summary || buildSummary();
    if (!summary) return '<div style="color:#888">暂无回合耗时记录。</div>';
    function row(x) {
      var color = x.level === 'critical' ? '#ff7777' : (x.level === 'high' ? '#f0a060' : (x.level === 'medium' ? '#e8c66e' : '#bbb'));
      return '<tr>'
        + '<td style="padding:3px 6px;color:#888">' + _esc(x.kind || '') + '</td>'
        + '<td style="padding:3px 6px;color:#e8c66e">' + _esc(x.label || x.id || '') + '</td>'
        + '<td style="padding:3px 6px;text-align:right;color:' + color + '">' + _esc(x.text || _fmtMs(x.ms)) + '</td>'
        + '<td style="padding:3px 6px;color:' + (x.ok ? '#9ac870' : '#d66') + '">' + (x.ok ? 'ok' : 'fail') + '</td>'
        + '</tr>';
    }
    var html = '<div style="line-height:1.7;color:#ddd;">'
      + '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:10px;">'
      + '<b style="color:#e8c66e">T' + _esc(summary.turn) + '</b>'
      + '<span>状态：' + _esc(summary.status) + '</span>'
      + '<span>总耗时：<b style="color:#e8c66e">' + _esc(summary.totalText) + '</b></span>'
      + '<span>step ' + summary.counts.steps + ' / subcall ' + summary.counts.subcalls + ' / systems ' + summary.counts.systems + '</span>'
      + '</div>';
    if (summary.current && summary.status === 'running') {
      html += '<div style="border:1px solid #5a3a1a;padding:8px;margin-bottom:10px;color:#e8c66e;">当前阶段：'
        + _esc(summary.current.label || summary.current.step || '') + '</div>';
    }
    html += '<div style="font-size:12px;color:#aaa;margin-bottom:4px;">最慢阶段</div>'
      + '<table style="width:100%;border-collapse:collapse;font-size:12px;">'
      + '<tr style="color:#888"><th style="text-align:left;padding:3px 6px">类型</th><th style="text-align:left;padding:3px 6px">名称</th><th style="text-align:right;padding:3px 6px">耗时</th><th style="text-align:left;padding:3px 6px">状态</th></tr>'
      + (summary.top || []).map(row).join('')
      + '</table>';
    if (summary.failed && summary.failed.length) {
      html += '<div style="font-size:12px;color:#d66;margin-top:10px;">失败项</div>'
        + '<pre style="white-space:pre-wrap;max-height:140px;overflow:auto;background:rgba(0,0,0,0.25);padding:8px;border:1px solid rgba(200,80,80,0.35);">'
        + _esc(JSON.stringify(summary.failed, null, 2)) + '</pre>';
    }
    html += '</div>';
    return html;
  }

  function openDiagnostics() {
    var summary = buildSummary();
    if (typeof openGenericModal === 'function') {
      var reliability = root.TM && root.TM.Endturn && root.TM.Endturn.Reliability;
      var attempts = reliability && reliability.snapshot ? reliability.snapshot() : [];
      var extra = '';
      if (attempts.length) {
        var last = attempts[attempts.length - 1];
        var labels = { dependency: '启动依赖', cancelled: '玩家取消', world_changed: '存档或配置改变', timeout: '等待超时', authentication: '鉴权', rate_limit: '供应商限流', provider: '供应商故障', context_budget: '上下文或恢复预算', output_format: '输出格式', persistence: '保存', world_validation: '世界校验', mobile_transport: '手机联网', runtime: '运行时' };
        extra = '<details open><summary>最近过回合尝试（回滚后仍可查看）</summary><div>模式：' + _esc(last.mode) + ' · 状态：' + _esc(last.status) + ' · 耗时：' + _esc(_fmtMs(last.ms)) + '</div>';
        if (last.failure) extra += '<div>失败类别：' + _esc(labels[last.failure.category] || last.failure.category) + ' · ' + _esc(last.failure.code) + '</div>';
        extra += '<pre style="white-space:pre-wrap;max-height:260px;overflow:auto">' + _esc(JSON.stringify(last.requests || [], null, 2)) + '</pre><small>仅保存本次页面会话的安全元数据；刷新后清除。</small></details>';
      }
      var recovery = root.TM && root.TM.Endturn && root.TM.Endturn.ResponseRecovery;
      if (recovery) {
        var rs = recovery.status();
        extra += '<section><h4>完整响应恢复</h4><div>本次复用 ' + (Number(rs.hits) || 0) + ' 份；待匹配候选 ' + (Number(rs.available) || 0) + ' 份。</div>';
        extra += '<p>只复用输入一致的完整响应；原有解析、质量校验和结算仍执行。刷新后仅严格匹配的本地候选可复用，不跨不同世界或分支。</p>';
        extra += '<button class="bt bs" onclick="TM.Endturn.ResponseRecovery.clear();TM.Endturn.Timing.openDiagnostics()">放弃本次复用，重新生成</button></section>';
      }
      var vault = root.TM && root.TM.Endturn && root.TM.Endturn.RecoveryVault;
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
      if (typeof root._aiWaitSnapshot === 'function') {
        var waiting = root._aiWaitSnapshot();
        if (waiting.length) {
          extra += '<section><h4>正在等待完整响应</h4>';
          waiting.forEach(function(w) { extra += '<div>' + _esc(w.phase === 'body' ? '已收到响应头，等待完整内容' : w.phase === 'native-buffered' ? '等待原生接口返回完整结果，首包不可见' : '尚未收到成功响应头') + ' · ' + Math.round(w.elapsedMs / 1000) + ' 秒</div>'; });
          extra += '<button class="bt bs" onclick="_aiCancelPendingWaits()">取消正在等待的 AI 请求</button></section>';
        }
      }
      openGenericModal('回合耗时诊断', renderSummaryHtml(summary) + extra);
    } else {
      try { console.log('[EndturnTimingDiagnostics]', summary); } catch(_) {}
      try { if (typeof toast === 'function') toast('回合耗时诊断已输出到控制台'); } catch(_) {}
    }
    return summary;
  }

  function finishLedger(ctx, status, extra) {
    var ledger = _getLedger(ctx);
    if (!ledger) return null;
    ledger.status = status || 'done';
    ledger.finishedAt = _wallNow();
    ledger.totalMs = Math.max(0, _now() - (ledger.startMs || _now()));
    if (extra && typeof extra === 'object') {
      Object.keys(extra).forEach(function(k) { ledger[k] = extra[k]; });
    }
    _publishSummary(ledger);
    _ensureHistory(ledger);
    return ledger;
  }

  root.TM.Endturn.Timing = {
    startLedger: startLedger,
    mark: mark,
    wrap: wrap,
    finishLedger: finishLedger,
    getLedger: _getLedger,
    buildSummary: buildSummary,
    renderSummaryHtml: renderSummaryHtml,
    openDiagnostics: openDiagnostics,
    formatMs: _fmtMs
  };
  root.openEndturnTimingDiagnostics = openDiagnostics;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
