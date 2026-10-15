// @ts-check
// ── 章节导航（grep 小节标题跳转，行号会漂）──
//   剧本 authoring agent 对话面板 UI（S4·暴露 TM_AuthoringAgentUI·仅浏览器）
//   自注入浮层：检测当前页属哪个编辑器（旧 editor.html / 新 scenario-editor-reset），注入启动按钮+面板
//   流程：输入需求 → getScenario → makeDraft → runAuthoringLoop（实时 transcript）
//         → computeDiff 预览 + finalValidation → 玩家「应用」走 adapter.commit / 「放弃」
//   依赖 editor-authoring-agent.js（TM.AuthoringAgent）
// ─────────────────────────────────────────────
/**
 * editor-authoring-agent-ui.js — 剧本 authoring agent 的对话面板 UI（S4）
 *
 * 自注入浮层：检测当前页面属于哪个剧本编辑器（旧 editor.html / 新 scenario-editor-reset），
 * 注入一个启动按钮 + 面板。流程：
 *   输入需求 → getScenario → makeDraft → runAuthoringLoop（实时 transcript）
 *           → computeDiff 预览 + finalValidation → 玩家「应用」走 adapter.commit / 「放弃」。
 *
 * 依赖 editor-authoring-agent.js（TM.AuthoringAgent）。仅浏览器加载。
 * 两个编辑器零布局耦合：浮层 + adapter，HTML 不需要预留容器。
 */
(function(global) {
  'use strict';
  if (typeof document === 'undefined') return;

  var AA = global.TM && global.TM.AuthoringAgent;
  var PANEL_ID = 'tm-aa-panel';
  /* 字体基址按脚本自身位置解析（须在顶层求值·injectStyles 运行时 currentScript 已是 null）：
     宿主页面可能在子目录（剧本工坊 preview/），页面相对 "assets/fonts/…" 会 404 → 面板字体一直在回退。
     editor.html 在根目录引用，脚本相对 == 页面相对，行为不变；无 src（内联）时回退旧相对路径。 */
  var FONT_BASE = (function () {
    try {
      var s = document.currentScript;
      var src = s && s.src ? String(s.src) : '';
      return src ? src.replace(/[^\/]*(?:[?#].*)?$/, '') : '';
    } catch (e) { return ''; }
  })();
  // ═══ 巨石拆分(20260706·第十八拆)：ui 共享单例 bucket + 图标/渲染两片跨闭包桥接 ═══
  //   装载序 icons→origin→render(契约见 lint-split-contracts)。ui 升格为 TM.__aaUiParts.ui 单例：
  //   origin 建之(canonical init)·render 读同一引用·354 处突变全域一致。
  var TM = global.TM = global.TM || {};
  var __aaU = TM.__aaUiParts = TM.__aaUiParts || {};   // dep-graph 可识别的 provide 形(TM.X=)·同 provider 簇 __aaParts
  var ui = (__aaU.ui = __aaU.ui || { adapter: null, draft: null, running: false, els: null, _checkpoints: [], _ckptSeq: 0 });
  // 发布 origin 助手给 render 片(其静态别名读取·函数声明已提升)
  __aaU.esc = esc; __aaU._md = _md; __aaU._mdLine = _mdLine; __aaU._streamThenLink = _streamThenLink;
  __aaU.rememberConvention = rememberConvention; __aaU._logScrollMaybe = _logScrollMaybe;
  // 反向 shim：icons 片(先装载)与 render 片(后装载)的成员·运行期经 bucket 委托(装载序无关)
  function _icon() { return __aaU._icon.apply(null, arguments); }
  function injectStyles() { return __aaU.injectStyles.apply(null, arguments); }
  function renderSummary() { return __aaU.renderSummary.apply(null, arguments); }
  function _removeLive() { return __aaU._removeLive.apply(null, arguments); }
  function appendText() { return __aaU.appendText.apply(null, arguments); }
  function appendLog() { return __aaU.appendLog.apply(null, arguments); }
  function renderDiff() { return __aaU.renderDiff.apply(null, arguments); }
  function renderValidation() { return __aaU.renderValidation.apply(null, arguments); }
  function renderReview() { return __aaU.renderReview.apply(null, arguments); }
  function renderClarify() { return __aaU.renderClarify.apply(null, arguments); }
  function renderRemonstrance() { return __aaU.renderRemonstrance.apply(null, arguments); }
  function renderPlan() { return __aaU.renderPlan.apply(null, arguments); }
  function _validationDelta() { return __aaU.validationDelta.apply(null, arguments); }
  function _supersedeDiff() { return __aaU.supersedeDiff.apply(null, arguments); }
  var MAX_CKPT = 15;   // 方向G · 检查点栈上限（session 内存态·满则淘汰最旧）

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function _clone(o) { try { return JSON.parse(JSON.stringify(o)); } catch (e) { return o; } }   // 维度3 · 撤销快照
  function _captureOwner() {
    var adapter = ui.adapter;
    return { adapter: adapter, lease: adapter && adapter.captureLease ? adapter.captureLease() : null,
      scenario: adapter && adapter.getScenario ? adapter.getScenario() : null, fileKey: _fileKey(), label: _fileLabel() };
  }
  function _ownerCurrent(owner) {
    if (!owner || owner.adapter !== ui.adapter) return false;
    if (owner.adapter && owner.adapter.isLeaseCurrent) return owner.adapter.isLeaseCurrent(owner.lease);
    // 旧嵌入适配器只能证明同一对象，不允许以同名案卷作为跨加载身份。
    return !!owner.scenario && owner.adapter && owner.scenario === owner.adapter.getScenario();
  }
  function _ownerError() {
    var error = new Error('案卷已切换或重新载入，原国师草稿仍保留但未应用。请查看原结果，或新开对话处理当前案卷。');
    error.code = 'editor-document-changed';
    return error;
  }
  function _contextReady() {
    if (ui._sessionSwitch) { setStatus('正在切换案卷，请等待载入完成'); return false; }
    var owner = ui._draftOwner || (ui.conversation && ui.conversation.length ? ui._conversationOwner : null);
    if (!owner || _ownerCurrent(owner)) return true;
    ui._attachmentCarry = null;
    ui._planAttachments = null;
    setStatus(_ownerError().message);
    return false;
  }
  function _runOwned(method, draft, request, options) {
    ui._lastErr = null; ui._partialApplyConfirmed = false; // 旧恢复按钮/部分应用确认不能授权新一轮结果。
    var owner = ui._draftOwner, run = { owner: owner, draft: draft };
    ui._activeUiRun = run;
    ui._conversationOwner = owner;
    options = Object.assign({}, options);
    if (Array.isArray(options.attachments)) ui._attachmentCarry = options.attachments.slice();
    if(ui._workbenchTask){
      if(method!=='runAuthoringLoop')return Promise.reject(new Error('持久预算任务请使用标准国师执行；并行会审尚未接入这份调用预算'));
      options.workbenchTask=Object.assign({},ui._workbenchTask);options.noMemoryRecall=true;
      if(ui._workbenchCheckpoint){var savedCheckpoint=ui._workbenchCheckpoint;Object.keys(draft).forEach(function(k){delete draft[k];});Object.assign(draft,AA.makeDraft(savedCheckpoint.draft));options.initialTodos=savedCheckpoint.todos||[];if(Array.isArray(savedCheckpoint.conversation))options.priorConversation=savedCheckpoint.conversation;options.editorContext=(options.editorContext||'')+'；从已校验的持久检查点继续，已完成的操作不要重放。';ui._workbenchCheckpoint=null;}
    }
    if(options.workbenchTask)ui._budgetedRun=true;
    var recovery = ui._recovery;
    if (recovery && recovery.method === method && recovery.draft === draft) {
      if (!_recoveryReady(recovery)) { ui._activeUiRun = null; return Promise.reject(_recoveryError()); }
      options.resumeState = recovery.state;
    }
    function current() { return ui._activeUiRun === run && draft === ui.draft && _ownerCurrent(owner); }
    if (options.stream == null && _streamOn()) {   // S4 · 实时显示（设置·偏好可关）
      // 只管显示：案卷换了就不画，但不像下面那些回调去中断国师——中断时机留给真正的步骤回调
      options.stream = true; options.onDelta = function (ev) { if (current()) _onDelta(ev); };
    }
    if (options.stateNotes == null && ui._stateNotes && ui._stateNotes.length) {   // 撤销/恢复过国师的改动：下一句告诉它
      options.stateNotes = ui._stateNotes.slice(); ui._stateNotes = [];
    }
    if (options.webAsk == null && _webOn()) {   // S7 · 读网页：每个网站先问玩家一次（设置·权限可关）
      options.webAsk = function (req) { return current() ? _webAsk(req) : Promise.resolve(false); };
    }
    ['onStep', 'onText', 'onSubtask', 'onCritique'].forEach(function(key) {
      var callback = options[key];
      if (typeof callback !== 'function') return;
      options[key] = function() {
        if (!current()) { if (ui._activeUiRun === run && AA.abort) AA.abort(); return; }
        return callback.apply(null, arguments);
      };
    });
    function settle(result, error) {
      var valid = current();
      if (ui._activeUiRun === run) ui._activeUiRun = null;
      if (!valid) {
        // 单个内存恢复材料，不挂到新案卷会话，不自动续跑/应用，不复制正文到日志。
        ui._staleResult = { owner: owner, result: result || (error && error.partial) || null, draft: draft };
        throw _ownerError();
      }
      var data = result || (error && error.partial);
      if (data) {
        ui._completion = data.completion || null;
        if (data.metrics) ui._lastRunMeta={kind:method,metrics:data.metrics,tokensUsed:data.tokensUsed||0,tokensBreakdown:data.tokensBreakdown||null,iterations:data.iterations||0,ts:Date.now()};
        _captureSideEffects(data, true);
        ui._recovery = data.resumeState ? { method: method, state: data.resumeState, draft: draft, owner: owner, request: request,
          planOnly: !!options.planOnly, reviewOnly: !!options.reviewOnly, qaOnly: !!options.qaOnly, explainOnly: !!options.explainOnly } : null;
        if (data.resumeState && Array.isArray(data.conversation) && data.conversation.length) ui.conversation = data.conversation;
      }
      if (error) throw error;
      return result;
    }
    return Promise.resolve().then(function() {
      if (!current()) throw _ownerError();
      return AA[method](draft, request, options);
    }).then(function(res) { return settle(res); }, function(err) { return settle(null, err); });
  }
  function _recoveryReady(recovery) {
    if (!recovery || recovery.draft !== ui.draft || !_ownerCurrent(recovery.owner) || !AA.canResume || !AA.canResume(recovery.state, ui.draft)) return false;
    if (ui.adapter.isLeaseCurrent && !ui.adapter.isLeaseCurrent(recovery.owner.lease, true)) return false;
    try { return JSON.stringify(ui.baseScenario) === JSON.stringify(ui.adapter.getScenario()); } catch (_) { return false; }
  }
  function _recoveryError() {
    var e = new Error('案卷、手工编辑或草稿已变化，不能直接续做。已保留未应用草稿；可在同一案卷确认后从当前内容重新生成。');
    e.code = 'authoring-recovery-stale'; return e;
  }
  function _prepareRunDraft(method) {
    var resume = ui._resumeNext; ui._resumeNext = false;
    if (resume && ui._recovery && ui._recovery.method === method) return ui.draft;
    return _startDraft();
  }
  function _autoApplyAllowed(res) { return !!(res && res.finished && res.completion && /^(completed|unchanged)$/.test(res.completion.status)); }
  function _autoApplyFinished(res, validation) {
    // 所有写入入口共用：按结束时的权限判断，且仍走同一冲突/校验/案卷确认提交。
    // 完成的记忆/技能也属于放行范围；失败、澄清、只读计划及部分草稿绝不自动提交。
    // 校验按「这次新带来的问题」判（剧本原有的提示不该把放行永远卡住；应用时的选后复核也是同一口径）。
    if (ui.autonomy !== 'auto' || ui.planMode || ui._pendingClarify || ui._pendingPlan || !_autoApplyAllowed(res)) return;
    if (!validation || !validation.ok) {
      setStatus('放行没有自动应用：这次改动带来了新问题，草稿留着等你看' + (validation && validation.violations && validation.violations.length ? '：' + validation.violations.slice(0, 2).join('；') : ''));
      return;
    }
    if (!((ui._lastDiffs || []).length || (ui._pendingSideEffects || []).length)) return;
    onApply();
  }
  function _applyLabel(valid, diffs) {
    if (!diffs.length && (ui._pendingSideEffects || []).length) return '批准记忆/技能（不改剧本）';
    var n = diffs.length - ((ui._diffRejected && ui._diffRejected.size) || 0);
    return valid ? ('应用 ' + n + ' 处改动') : '仍要应用';
  }
  // 结果卡收尾：校验（只看新问题）+ 应用键标签；返回校验差量供放行判断
  function _finishReplyActions(report, diffs) {
    var vd = renderValidation(report || { ok: true, violations: [] });
    ui.els.actions.style.display = '';
    ui.els.apply.className = 'reply-apply' + (vd.ok ? '' : ' warn');
    ui.els.apply.textContent = _applyLabel(vd.ok, diffs || []);
    ui.els.discard.textContent = '放弃';
    ui._applyValid = vd.ok;
    return vd;
  }
  function _renderIncomplete(res, kind, request) {
    _beginReplyCard(kind);
    var status = res.completion && res.completion.status || 'blocked';
    var label = status === 'cancelled' ? '停下了，任务未完成' : (status === 'partial' ? '只完成了一部分' : '任务未完成');
    var remaining = (res.completion && res.completion.unresolved || []).map(function(f) { return f.tool + '：' + (f.targets || []).join('、'); });
    remaining = remaining.concat(res.completion && res.completion.pendingTodos || []);
    renderSummary('**' + label + '**' + (res.summary ? '：' + res.summary : '') + (remaining.length ? '\n\n还差：\n' + remaining.slice(0, 8).map(function (r) { return '- ' + r; }).join('\n') : ''), res.notes, res.suggestedConventions, false);
    if (res.clarification) { renderClarify(res.clarification.questions); ui._pendingClarify = true; }
    else if (res.remonstrance) { renderRemonstrance(res.remonstrance); ui._pendingClarify = true; }
    var _incDiffs = _draftDiff();
    renderDiff(_incDiffs, res.uncertainties);
    var _incVal = renderValidation(res.finalValidation || AA.validateDraft(ui.draft));
    // 一处都没改（比如只查了资料）就不挂空的改动区和「没有带来新问题」
    if (!_incDiffs.length && !(ui._pendingSideEffects || []).length) { ui.els.diffSec.style.display = 'none'; ui.els.diff.style.display = 'none'; if (_incVal && _incVal.ok) ui.els.val.style.display = 'none'; }
    ui._lastErr = { kind: kind, request: request || '', message: label, owner: ui._draftOwner };
    _recoveryButtons(ui.els.summary, ui._lastErr);
    var hasPending = (ui._lastDiffs || []).length > 0 || (ui._pendingSideEffects || []).length > 0;
    ui.els.actions.style.display = hasPending ? '' : 'none';
    ui.els.apply.textContent = '只应用已有的改动（任务未完成）';
    ui.els.apply.className = 'reply-apply warn';
    ui.els.discard.textContent = '放弃本轮草稿';
    setStatus(label + '：草稿留着没应用，可以继续未完成的部分，或从当前剧本重来');
  }
  function _recoveryButtons(container, record) {
    if (!container) return;
    var actions = document.createElement('div'); actions.className = 'ec-acts tm-aa-recovery-actions';
    var retry = document.createElement('button'); retry.type = 'button'; retry.className = 'ec-retry'; retry.innerHTML = _icon('retry', 13) + (ui._recovery ? '继续未完成的部分' : '再试一次');
    retry.addEventListener('click', function() { _retryLast(record); }); actions.appendChild(retry);
    var restart = document.createElement('button'); restart.type = 'button'; restart.className = 'ec-restart'; restart.textContent = '从当前剧本重来';
    restart.addEventListener('click', function() {
      if (ui.running || ui._lastErr !== record || !_ownerCurrent(record.owner)) { setStatus('这个按钮已经过期了，请在当前案卷开个新对话'); return; }
      if (!record.restartConfirmed) { record.restartConfirmed = true; restart.textContent = '再点一下：扔掉没应用的草稿，重来'; return; }
      _clearDraft(); ui.conversation = null; ui._conversationOwner = null;
      ui.els.req.value = record.request; _dispatchRetry(record.kind);
    }); actions.appendChild(restart); container.appendChild(actions);
  }
  function _dispatchRetry(kind) {
    if (kind === 'plan-execute') { if (ui.draft) executePlan(); else onGenerate(); }
    else if (kind === 'review') runReview();
    else if (kind === 'qa') runQaUI();
    else if (kind === 'explain') runExplainUI();
    else if (kind === 'orchestrate') runOrchestratedUI();
    else if (kind === 'critics') runWithCriticsUI();
    else onGenerate();
  }
  function _commitCurrent(scenario, owner) {
    if (!_ownerCurrent(owner)) throw _ownerError();
    var lease = ui.adapter.captureLease ? ui.adapter.captureLease() : null;
    var result = ui.adapter.commit(scenario, lease);
    if (!result || result.ok !== true) throw new Error('编辑器未确认应用成功');
    return result;
  }
  function _startDraft(source) {
    ui._recovery = null; ui._completion = null; ui._partialApplyConfirmed = false;
    var live = source || (ui.adapter && ui.adapter.getScenario ? ui.adapter.getScenario() : {});
    ui.baseScenario = AA.makeDraft(live);
    ui.draft = AA.makeDraft(live);
    ui._draftOwner = _captureOwner();
    ui._pendingSideEffects = [];
    return ui.draft;
  }
  function _setDraftFromBase(base, draft) {
    ui._recovery = null; ui._completion = null;
    ui.baseScenario = AA.makeDraft(base || {});
    ui.draft = draft;
    ui._draftOwner = _captureOwner();
    ui._pendingSideEffects = [];
    return ui.draft;
  }
  function _draftDiff() {
    return AA.computeDiff(ui.baseScenario || (ui.adapter && ui.adapter.getScenario ? ui.adapter.getScenario() : {}), ui.draft || {});
  }
  function _clearDraft() { ui.draft = null; ui.baseScenario = null; ui._draftOwner = null; ui._staleResult = null; ui._pendingSideEffects = []; ui._recovery = null; ui._resumeNext = false; ui._completion = null; ui._lastErr = null; ui._partialApplyConfirmed = false; ui._planAttachments = null; ui._baseValCache = null; if (typeof _refreshPending === 'function') _refreshPending(); }
  function _captureSideEffects(res, append) {
    var fx = (res && Array.isArray(res.sideEffects)) ? res.sideEffects : [];
    if (!append) ui._pendingSideEffects = [];
    if (!Array.isArray(ui._pendingSideEffects)) ui._pendingSideEffects = [];
    if (fx.length) {
      var seen = {};
      ui._pendingSideEffects.forEach(function(f) { if (f.id) seen[f.id] = true; });
      _clone(fx).forEach(function(f) { if (!f.id || !seen[f.id]) { ui._pendingSideEffects.push(f); if (f.id) seen[f.id] = true; } });
    }
    return ui._pendingSideEffects.length;
  }

  // UI 借鉴 Claude Code/Codex · 轻量安全 markdown 渲染（先转义、再套 md；支持代码块/行内码/标题/有序无序列表/加粗/斜体）
  function _mdInline(s) {
    return String(s)
      .replace(/`([^`]+)`/g, '<code class="md-ic">$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
  }
  function _md(src) {
    var escd = String(src == null ? '' : src).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    var blocks = [];
    escd = escd.replace(/```([\s\S]*?)```/g, function(_, code) { blocks.push(_renderCodeBlock(code)); return '%%MDCODE' + (blocks.length - 1) + '%%'; });
    var lines = _mdExtractTables(escd.split('\n'), blocks);   // UI·AE · 先抽 GFM 表格成块占位
    var out = [], listType = null, items = [];
    function flush() { if (listType) { out.push('<' + listType + ' class="md-list">' + items.join('') + '</' + listType + '>'); listType = null; items = []; } }
    lines.forEach(function(line) {
      var bm = line.match(/^\s*[-*]\s+(.+)$/), nm = line.match(/^\s*\d+[.、]\s+(.+)$/), hm = line.match(/^\s*(#{1,4})\s+(.+)$/);
      if (/^\s*%%MD(?:CODE|TABLE)\d+%%\s*$/.test(line)) { flush(); out.push(line.trim()); }
      else if (bm) { if (listType !== 'ul') flush(); listType = 'ul'; items.push('<li>' + _mdInline(bm[1]) + '</li>'); }
      else if (nm) { if (listType !== 'ol') flush(); listType = 'ol'; items.push('<li>' + _mdInline(nm[1]) + '</li>'); }
      else if (hm) { flush(); out.push('<div class="md-h md-h' + hm[1].length + '">' + _mdInline(hm[2]) + '</div>'); }
      else if (line.trim() === '') { flush(); }
      else { flush(); out.push('<div class="md-p">' + _mdInline(line) + '</div>'); }
    });
    flush();
    return out.join('').replace(/%%MD(?:CODE|TABLE)(\d+)%%/g, function(_, i) { return blocks[+i] || ''; });
  }
  // UI·AE · GFM 表格：表头行 + 分隔行(---|:--:)+数据行 → <table>。在【已转义】行上做，cell 走 _mdInline。
  function _mdIsTableSep(line) { return line.indexOf('-') >= 0 && /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/.test(line); }
  function _mdSplitRow(line) { return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(function(c) { return c.trim(); }); }
  function _mdExtractTables(lines, blocks) {
    var out = [];
    for (var i = 0; i < lines.length; i++) {
      if (i + 1 < lines.length && lines[i].indexOf('|') >= 0 && _mdIsTableSep(lines[i + 1]) && lines[i].trim() !== '') {
        var header = _mdSplitRow(lines[i]);
        var aligns = _mdSplitRow(lines[i + 1]).map(function(s) { var l = /^:/.test(s), r = /:$/.test(s); return (l && r) ? 'center' : (r ? 'right' : (l ? 'left' : '')); });
        var rows = [header], j = i + 2;
        for (; j < lines.length && lines[j].indexOf('|') >= 0 && lines[j].trim() !== ''; j++) rows.push(_mdSplitRow(lines[j]));
        var n = header.length;
        rows = rows.map(function(r) { while (r.length < n) r.push(''); return r.slice(0, n); });
        blocks.push(_mdRenderTable(rows, aligns));
        out.push('%%MDTABLE' + (blocks.length - 1) + '%%');
        i = j - 1;
      } else { out.push(lines[i]); }
    }
    return out;
  }
  function _mdRenderTable(rows, aligns) {
    function cell(tag, c, i) { var a = aligns[i] ? ' style="text-align:' + aligns[i] + '"' : ''; return '<' + tag + a + '>' + _mdInline(c) + '</' + tag + '>'; }
    var thead = '<thead><tr>' + rows[0].map(function(c, i) { return cell('th', c, i); }).join('') + '</tr></thead>';
    var tbody = '<tbody>' + rows.slice(1).map(function(r) { return '<tr>' + r.map(function(c, i) { return cell('td', c, i); }).join('') + '</tr>'; }).join('') + '</tbody>';
    return '<table class="md-table">' + thead + tbody + '</table>';
  }
  function _mdLine(s) { return _mdInline(String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')); }   // 行内版（短字段·不分块）

  // UI·AA · 代码块复制 + 轻语法高亮（Claude.ai/ChatGPT 网页端招牌）：单遍 tokenizer 在【已转义】文本上包 span。
  //   字符串整体先吃掉(故串内数字不会被单独着色)·"key": 标键名·true/false/null 关键字·数字。XSS 安全(只插自有 span)。
  function _highlightCode(s) {
    return String(s).replace(/("(?:[^"\\]|\\.)*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?)/g, function(m, str, colon, kw, num) {
      if (str !== undefined && str !== '') {
        if (colon) return '<span class="tok-key">' + str + '</span><span class="tok-punct">' + colon + '</span>';
        return '<span class="tok-str">' + str + '</span>';
      }
      if (kw !== undefined && kw !== '') return '<span class="tok-kw">' + kw + '</span>';
      if (num !== undefined && num !== '') return '<span class="tok-num">' + num + '</span>';
      return m;
    });
  }
  // 把围栏代码渲染成 带语言标签 + 复制键 的代码卡。code 已被 _md 整体 HTML 转义；提取首行语言；
  //   data-code 存转义体(getAttribute 解码即还原原文·供复制)。
  function _renderCodeBlock(code) {
    var lang = '', body = String(code);
    var m = body.match(/^([A-Za-z0-9_+#.-]{1,20})\n([\s\S]*)$/);
    if (m) { lang = m[1]; body = m[2]; }
    body = body.replace(/^\n+/, '').replace(/\n+$/, '');
    var dataAttr = body.replace(/"/g, '&quot;');   // 供复制：getAttribute('data-code') 会把实体解码回原文
    return '<div class="md-codewrap"><div class="md-codebar"><span class="md-lang">' + (lang || 'code') + '</span>'
      + '<button type="button" class="md-copy" title="复制代码">⧉ 复制</button></div>'
      + '<pre class="md-code" data-code="' + dataAttr + '">' + _highlightCode(body) + '</pre></div>';
  }
  // UI·AA · 代码块复制键委托（document 级·绑一次·过滤 .md-copy）：复制 data-code 解码后的原文
  function _ensureCodeCopy() {
    if (ui._codeCopyBound) return;
    ui._codeCopyBound = true;
    document.addEventListener('click', function(ev) {
      var btn = ev.target && ev.target.closest ? ev.target.closest('.md-copy') : null;
      if (!btn) return;
      var wrap = btn.closest('.md-codewrap'); if (!wrap) return;
      var pre = wrap.querySelector('pre.md-code');
      var code = pre ? (pre.getAttribute('data-code') != null ? pre.getAttribute('data-code') : pre.textContent) : '';
      try { navigator.clipboard.writeText(code).then(function() { var o = btn.textContent; btn.textContent = '✓ 已复制'; setTimeout(function() { btn.textContent = o; }, 900); }, function() { setStatus('复制失败（浏览器限制）'); }); }
      catch (e) { setStatus('复制失败'); }
    });
  }

  // UI·AH · 行内实体引用跳转（Claude Code 点 file:line 跳转的剧本版）：把结果里出现的剧本实体名渲成可点链接，
  //   点了让编辑器导航到那个实体（编辑器需暴露 revealEntity·旧编辑器无则优雅降级）。
  function _entityNameMap() {
    var sc = (ui.adapter && ui.adapter.getScenario) ? ui.adapter.getScenario() : null;
    if (!sc) return null;
    var map = {};
    ['factions', 'characters'].forEach(function(field) {
      (Array.isArray(sc[field]) ? sc[field] : []).forEach(function(e) { var n = e && (e.name || e.title || e.id); n = n && String(n); if (n && n.length >= 2 && !map[n]) map[n] = field; });
    });
    return Object.keys(map).length ? map : null;
  }
  function _linkifyEntities(container) {
    if (!container) return;
    var map = _entityNameMap(); if (!map) return;
    var names = Object.keys(map).sort(function(a, b) { return b.length - a.length; });   // 长名优先，避免子串误匹配
    var reSrc = '(' + names.map(function(n) { return n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|') + ')';
    var test = new RegExp(reSrc), reg = new RegExp(reSrc, 'g');
    var targets = [];
    (function walk(node) {
      for (var c = node.firstChild; c; c = c.nextSibling) {
        if (c.nodeType === 3) { if (test.test(c.nodeValue)) targets.push(c); }
        else if (c.nodeType === 1 && !/^(a|code|pre|kbd|button)$/i.test(c.tagName) && !(c.classList && c.classList.contains('je-entity-ref'))) walk(c);
      }
    })(container);
    targets.forEach(function(tn) {
      var text = tn.nodeValue, frag = document.createDocumentFragment(), last = 0, m, any = false;
      reg.lastIndex = 0;
      while ((m = reg.exec(text))) {
        any = true;
        if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        var name = m[0], a = document.createElement('a');
        a.className = 'je-entity-ref'; a.setAttribute('data-field', map[name]); a.setAttribute('data-name', name);
        a.setAttribute('role', 'link'); a.textContent = name; a.title = '跳到剧本里的「' + name + '」';
        frag.appendChild(a);
        last = m.index + name.length;
        if (reg.lastIndex === m.index) reg.lastIndex++;
      }
      if (any) { if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last))); tn.parentNode.replaceChild(frag, tn); }
    });
  }
  // 流式则吐完字再 linkify（避免打字机清空已 linkify 的文本节点）；瞬显则直接 linkify
  function _streamThenLink(el, stream) {
    if (!el) return;
    var box = (el.closest && el.closest('.tm-aa-summary')) || el;   // 夹高按本卡的说明区算（打字机收尾时 ui.els 可能已指向别的卡）
    function done() { _linkifyEntities(el); _applyClamp(box, 360); }
    if (stream && ui._liveSaid) { stream = false; ui._liveSaid = false; }   // 已经实时显示过：不再重放打字机
    if (stream) _typewrite(el, { onDone: done });
    else done();
  }
  // UI·AK · 长内容折叠「显示更多」（Claude.ai/ChatGPT 超长消息招牌）：结果卡超阈值则夹高 + 渐隐 + 展开/收起。
  function _applyClamp(el, maxPx) {
    if (!el) return;
    if (ui._clampBtn && ui._clampBtn.parentNode) ui._clampBtn.parentNode.removeChild(ui._clampBtn);   // 去旧按钮
    ui._clampBtn = null;
    el.classList.remove('tm-aa-clamped', 'tm-aa-clamp-open');
    maxPx = maxPx || 280;
    if (el.scrollHeight <= maxPx + 40) return;   // 不够长 → 不夹
    el.style.setProperty('--clamp-max', maxPx + 'px');
    el.classList.add('tm-aa-clamped');
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'tm-aa-clamp-btn'; btn.textContent = '显示更多 ▾';
    btn.addEventListener('click', function() {
      var open = el.classList.toggle('tm-aa-clamp-open');
      btn.textContent = open ? '收起 ▴' : '显示更多 ▾';
    });
    if (el.parentNode) el.parentNode.insertBefore(btn, el.nextSibling); else el.appendChild(btn);   // 按钮放卡外（不被 overflow 裁）
    ui._clampBtn = btn;
  }
  function _ensureEntityNav() {
    if (ui._entNavBound) return;
    ui._entNavBound = true;
    document.addEventListener('click', function(ev) {
      var jpath = ev.target && ev.target.closest ? ev.target.closest('.tm-aa-diff-jump[data-reveal-path]') : null;
      if (jpath) {
        ev.preventDefault();
        var pp = jpath.getAttribute('data-reveal-path');
        var appP = global.TM_SCENARIO_EDITOR_RESET_APP;
        if (appP && typeof appP.revealPath === 'function') { appP.revealPath(pp); setStatus('已在折子精确定位'); }
        else if (appP && typeof appP.revealField === 'function') { appP.revealField(String(pp).split('.')[0]); }
        return;
      }
      var jmp = ev.target && ev.target.closest ? ev.target.closest('.tm-aa-diff-jump[data-reveal-field]') : null;
      if (jmp) {
        ev.preventDefault();
        var jf = jmp.getAttribute('data-reveal-field');
        var app0 = global.TM_SCENARIO_EDITOR_RESET_APP;
        var firstPath = jmp.getAttribute('data-first-path');
        if (app0 && firstPath && typeof app0.revealPath === 'function') { app0.revealPath(firstPath); setStatus('已在折子定位「' + jf + '」'); }
        else if (app0 && typeof app0.revealField === 'function') { app0.revealField(jf); setStatus('已在折子定位「' + jf + '」'); }
        return;
      }
      var a = ev.target && ev.target.closest ? ev.target.closest('.je-entity-ref') : null;
      if (!a) return;
      ev.preventDefault();
      var field = a.getAttribute('data-field'), name = a.getAttribute('data-name');
      var app = global.TM_SCENARIO_EDITOR_RESET_APP;
      if (app && typeof app.revealEntity === 'function') {
        var ok = app.revealEntity(field, name);
        setStatus(ok ? ('已跳到「' + name + '」') : ('未在剧本里找到「' + name + '」'));
      } else { setStatus('当前编辑器不支持跳转'); }
    });
  }

  // UI·P · 流式打字机：对已渲染好的容器，逐字「揭显」其文本节点 + 闪烁光标，模拟 Claude Code/Codex 桌面端的 token 流式吐字。
  // 纯 UI 层（不动网络/relay）：先把最终 markdown 渲染好，再把文本节点清空、按节奏补回，结构与事件绑定不受影响。
  // 守护：尊重 prefers-reduced-motion、太长(>6000 字)或无字直接瞬显；同一时刻仅一个动画，新动画/重置即取消旧的。
  function _cancelTypewriter() { if (ui._tw && ui._tw.cancel) { try { ui._tw.cancel(); } catch (e) {} } ui._tw = null; }
  function _typewrite(container, opts) {
    opts = opts || {};
    _cancelTypewriter();
    if (!container) { if (opts.onDone) opts.onDone(); return null; }
    var reduce = false;
    try { reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
    // 采集文本节点（跳过 script/style；保留含可见字符的节点）
    var nodes = [], total = 0;
    (function walk(n) {
      for (var c = n.firstChild; c; c = c.nextSibling) {
        if (c.nodeType === 3) { if (c.nodeValue && /\S/.test(c.nodeValue)) { nodes.push({ node: c, full: c.nodeValue }); total += c.nodeValue.length; } }
        else if (c.nodeType === 1 && !/^(script|style)$/i.test(c.tagName)) walk(c);
      }
    })(container);
    if (reduce || total === 0 || total > 6000) { if (opts.onDone) opts.onDone(); return null; }
    nodes.forEach(function(o) { o.node.nodeValue = ''; });
    var caret = document.createElement('span'); caret.className = 'tm-aa-caret'; caret.textContent = '▌';
    var idx = 0, pos = 0, timer = null, ended = false;
    var perTick = Math.max(2, Math.round(total / 80));   // ~80 tick → 约 1.3s 走完，长文按比例提速
    function placeCaret() {
      if (caret.parentNode) caret.parentNode.removeChild(caret);
      var cur = nodes[Math.min(idx, nodes.length - 1)];
      if (cur && cur.node.parentNode) cur.node.parentNode.insertBefore(caret, cur.node.nextSibling);
    }
    function revealAll() { nodes.forEach(function(o) { o.node.nodeValue = o.full; }); if (caret.parentNode) caret.parentNode.removeChild(caret); }
    function finish() { if (ended) return; ended = true; if (timer) clearTimeout(timer); revealAll(); if (ui._tw === api) ui._tw = null; if (opts.onDone) opts.onDone(); }
    function cancel() { if (ended) return; ended = true; if (timer) clearTimeout(timer); revealAll(); if (ui._tw === api) ui._tw = null; }
    function tick() {
      if (ended) return;
      var budget = perTick;
      while (budget > 0 && idx < nodes.length) {
        var o = nodes[idx], remain = o.full.length - pos, take = Math.min(budget, remain);
        o.node.nodeValue = o.full.slice(0, pos + take); pos += take; budget -= take;
        if (pos >= o.full.length) { idx++; pos = 0; }
      }
      placeCaret();
      _followReply();
      if (idx >= nodes.length) { finish(); } else { timer = setTimeout(tick, 16); }
    }
    var api = { cancel: cancel, finish: finish };
    ui._tw = api;
    placeCaret();   // 同步先把光标插入 DOM：消除「已清空文本但光标未插」的窗口（否则外部"等光标消失"会误判流式已结束）
    timer = setTimeout(tick, 16);
    return api;
  }
  // 上下文感知：编辑器当前焦点（模块/集合/选中实体），喂给 agent 解析"他/这个/当前"等指代
  function _liveEditorContext() {
    try { return (ui.adapter && typeof ui.adapter.getContext === 'function') ? (ui.adapter.getContext() || '') : ''; }
    catch (e) { return ''; }
  }
  // 治「生成质量低·大量空内容」：把剧本里已有的丰满实体当 few-shot 范例喂 agent（之前 ui.exemplars 从未赋值→无参照）。
  //   按当前剧本算（每势力/人物/事件取 2 个最丰满的），缓存到 ui._exemplarsCache 避免每轮重算。
  function _exemplars() {
    try {
      if (localStorage.getItem('tm_aa_exemplars') === '0') return null;   // 设置·偏好「照剧本里已有的写法来」关掉时不喂范例
      if (!AA || typeof AA.buildExemplars !== 'function' || !ui.adapter || typeof ui.adapter.getScenario !== 'function') return ui.exemplars || null;
      var sc = ui.adapter.getScenario();
      if (ui._exemplarsCache && ui._exemplarsSc === sc) return ui._exemplarsCache;
      var ex = AA.buildExemplars(sc, { perColl: 2, capEach: 1100, collections: ['characters', 'factions', 'events'] }) || '';
      ui._exemplarsCache = ex || null; ui._exemplarsSc = sc;
      return ui._exemplarsCache;
    } catch (e) { return ui.exemplars || null; }
  }
  // 跨会话记忆（治「会话一次性·无跨对话记忆」）：把近期运行记录(需求→做了什么·是否应用)拼成记忆串喂 agent，
  //   让新对话延续上下文、不重复已做、与之前改动保持一致。基于已持久化的 _loadHistory(cap50·跨刷新存活)。
  function _buildMemory() {
    try {
      var h = (typeof listHistory === 'function') ? listHistory() : [];   // 新→旧
      if (!h || !h.length) return '';
      var lines = [];
      h.slice(0, 6).forEach(function (r) {
        var req = String(r.request || '').trim(), did = String(r.summary || '').replace('（无说明）', '').trim();
        if (!req && !did) return;
        lines.push('· ' + (r.applied ? '[已应用] ' : '[未应用] ') + (r.when ? r.when.slice(5, 16) + ' · ' : '') + (req ? '「' + req.slice(0, 46) + '」' : '') + (did ? ' → ' + did.slice(0, 76) : ''));
      });
      return lines.join('\n');
    } catch (e) { return ''; }
  }
  // N1 · 焦点上下文：默认跟随编辑器选中；固定后冻结为固定值（喂 agent 也用固定值）。
  function _editorContext() {
    var base = (ui._ctx && ui._ctx.pinned) ? (ui._ctx.value || '') : _liveEditorContext();
    if (ui._mentions && ui._mentions.length) base += (base ? '\uFF1B' : '') + '\u3010\u7528\u6237\u5708\u5b9a\u3011' + ui._mentions.join('\u3001');
    return base;
  }
  // N3 · @\u63d0\u53ca\u4f5c\u7528\u57df\u4e0a\u4e0b\u6587\uFF1A@\u5b9e\u4f53/@\u5b57\u6bb5\u8bfb\u5f53\u524d\u5267\u672c\u5019\u9009\uFF0C\u9009\u4e2d\u63d2\u5165\u540d\u5b57+\u8bb0 chip\uFF0C\u663e\u5f0f\u5708\u5b9a AI \u64cd\u4f5c\u8303\u56f4\u3002
  function _mentionCandidates(q) {
    var out = [];
    try {
      var sc = (ui.adapter && ui.adapter.getScenario) ? ui.adapter.getScenario() : null;
      if (sc) {
        ['characters', 'factions', 'events', 'rigidHistoryEvents', 'families', 'parties', 'items'].forEach(function (coll) {
          var arr = sc[coll];
          if (Array.isArray(arr)) arr.forEach(function (e) { var nm = e && (e.name || e.id || e.title); if (nm) out.push({ kind: '\u5b9e\u4f53', label: String(nm) }); });
        });
        Object.keys(sc).forEach(function (k) { out.push({ kind: '\u5b57\u6bb5', label: k }); });
      }
    } catch (e) {}
    var seen = {}, uniq = [];
    out.forEach(function (c) { if (!seen[c.label]) { seen[c.label] = 1; uniq.push(c); } });
    if (q) { var lq = q.toLowerCase(); uniq = uniq.filter(function (c) { return c.label.toLowerCase().indexOf(lq) >= 0; }); }
    return uniq.slice(0, 24);
  }
  function _renderMentionChips() {
    if (!ui.els || !ui.els.mentions) return;
    var m = ui._mentions || [];
    if (!m.length) { ui.els.mentions.hidden = true; ui.els.mentions.innerHTML = ''; return; }
    ui.els.mentions.hidden = false;
    ui.els.mentions.innerHTML = m.map(function (nm) { return '<span class="tm-aa-mchip">@' + esc(nm) + '<button type="button" class="tm-aa-mx" data-m="' + esc(nm) + '" title="\u79fb\u9664">\u00d7</button></span>'; }).join('');
  }
  function _addMention(nm) { if (!nm) return; if (!ui._mentions) ui._mentions = []; if (ui._mentions.indexOf(nm) < 0) ui._mentions.push(nm); _renderMentionChips(); if (ui._ctx) ui._ctx._sig = null; _refreshCtxChip(); }
  function _hideAtPop() { if (ui.els && ui.els.atpop) { ui.els.atpop.hidden = true; ui.els.atpop.innerHTML = ''; } ui._atActive = false; }
  function _atQueryAtCursor() {
    var ta = ui.els && ui.els.req; if (!ta) return null;
    var pos = ta.selectionStart, before = ta.value.slice(0, pos);
    var mm = before.match(/@([^\s@\u3000]*)$/);
    return mm ? { q: mm[1], start: pos - mm[0].length, end: pos } : null;
  }
  function _showAtPop() {
    var at = _atQueryAtCursor();
    if (!at) { _hideAtPop(); return; }
    var cands = _mentionCandidates(at.q);
    if (!cands.length) { _hideAtPop(); return; }
    ui._atActive = true; ui._atRange = at;
    ui.els.atpop.hidden = false;
    _popPlace(ui.els.atpop);   // composer 在面板上部时翻到下方（否则飞出面板顶）
    ui.els.atpop.innerHTML = cands.map(function (c) { return '<button type="button" class="tm-aa-atitem" data-label="' + esc(c.label) + '"><span class="tm-aa-atkind">' + esc(c.kind) + '</span>' + esc(c.label) + '</button>'; }).join('');
  }
  function _selectMention(label) {
    var ta = ui.els && ui.els.req; var at = ui._atRange; if (!ta || !at) { _hideAtPop(); return; }
    var v = ta.value; ta.value = v.slice(0, at.start) + '@' + label + ' ' + v.slice(at.end);
    var np = at.start + label.length + 2; try { ta.focus(); ta.setSelectionRange(np, np); } catch (e) {}
    _addMention(label); _hideAtPop();
    try { ta.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
  }
  function _ensureAtMention() {
    if (ui._atWired) return; ui._atWired = true; ui._mentions = ui._mentions || [];
    var ta = ui.els && ui.els.req; if (!ta) return;
    ta.addEventListener('input', _showAtPop);
    ta.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && ui._atActive) { ev.stopPropagation(); _hideAtPop(); return; }
      // Enter 发送 · Shift+Enter 换行（输入法合成中 / @提及浮层激活时不触发；Ctrl/⌘+Enter 亦发送）
      var _isEnter = (ev.key === 'Enter' || ev.keyCode === 13);
      if (_isEnter && !ev.isComposing && !ui._atActive && !ui._cmdActive && (!ev.shiftKey || ev.metaKey || ev.ctrlKey)) {
        ev.preventDefault();
        _pushPromptHistory(ta.value);
        if (!ui.running && typeof onGoClick === 'function') onGoClick();
        else if (ui.running && typeof onSteer === 'function') onSteer();   // 刀G9 · 运行中回车=插话(排队注入下一轮·不打断)
        return;
      }
      if (ev.isComposing || ui._atActive || ui._cmdActive) return;
      // Shift+Tab：问策 → 共审 → 放行 轮换
      if (ev.key === 'Tab' && ev.shiftKey && !ev.ctrlKey && !ev.altKey && !ev.metaKey) {
        ev.preventDefault();
        var order = ['plan', 'review', 'auto'], p0 = _loadPerm();
        p0.mode = order[(order.indexOf(p0.mode) + 1) % order.length];
        _applyPerm(p0);
        setStatus(_PERM_TIP[p0.mode]);
        return;
      }
      // Esc：运行中且输入框是空的 → 停下
      if (ev.key === 'Escape' && ui.running && !ta.value.trim()) { ev.preventDefault(); onStop(); return; }
      // ↑ ↓：空输入框（或已在翻）时翻以前发过的话
      if ((ev.key === 'ArrowUp' || ev.key === 'ArrowDown') && !ev.shiftKey && !ev.altKey) _historyNav(ev, ta);
    });
    if (ui.els.atpop) ui.els.atpop.addEventListener('mousedown', function (ev) { var b = ev.target && ev.target.closest ? ev.target.closest('.tm-aa-atitem') : null; if (b) { ev.preventDefault(); _selectMention(b.getAttribute('data-label')); } });
    if (ui.els.mentions) ui.els.mentions.addEventListener('click', function (ev) { var x = ev.target && ev.target.closest ? ev.target.closest('.tm-aa-mx') : null; if (x) { var nm = x.getAttribute('data-m'); ui._mentions = (ui._mentions || []).filter(function (k) { return k !== nm; }); _renderMentionChips(); if (ui._ctx) ui._ctx._sig = null; _refreshCtxChip(); } });
    document.addEventListener('click', function (ev) { if (ui._atActive && ui.els.atpop && !ui.els.atpop.contains(ev.target) && ev.target !== ta) _hideAtPop(); });
  }
  // \u6307\u4ee4\u5386\u53f2\uff08\u4ee5\u524d\u53d1\u8fc7\u7684\u8bdd\u00b7\u2191\u2193 \u7ffb\u00b7\u4e0e\u5de5\u574a\u539f\u5148\u540c\u4e00\u4e2a\u5b58\u50a8\u952e\uff09
  var PROMPT_HIST_KEY = 'tm_aa_prompt_history';
  function _loadPromptHistory() { try { var h = JSON.parse(localStorage.getItem(PROMPT_HIST_KEY) || '[]'); return Array.isArray(h) ? h : []; } catch (e) { return []; } }
  function _pushPromptHistory(v) {
    v = String(v || '').trim();
    ui._histNav = -1;
    if (!v || v.charAt(0) === '/') return;
    var h = _loadPromptHistory();
    if (h[h.length - 1] !== v) { h.push(v); try { localStorage.setItem(PROMPT_HIST_KEY, JSON.stringify(h.slice(-30))); } catch (e) {} }
  }
  function _historyNav(ev, ta) {
    var nav = ui._histNav == null ? -1 : ui._histNav;
    var empty = !ta.value, atStart = ta.selectionStart === 0 && ta.selectionEnd === 0;
    var h = _loadPromptHistory(); if (!h.length) return;
    if (ev.key === 'ArrowUp' && (empty || (atStart && nav >= 0))) {
      ev.preventDefault();
      if (nav === -1) { ui._histDraft = ta.value || ''; nav = h.length - 1; } else if (nav > 0) nav--;
      ui._histNav = nav; ta.value = h[nav]; _autoGrowReq();
      try { ta.setSelectionRange(0, 0); } catch (e) {}
    } else if (ev.key === 'ArrowDown' && nav >= 0) {
      ev.preventDefault();
      if (nav < h.length - 1) { nav++; ta.value = h[nav]; } else { nav = -1; ta.value = ui._histDraft || ''; }
      ui._histNav = nav; _autoGrowReq();
      try { ta.setSelectionRange(ta.value.length, ta.value.length); } catch (e) {}
    }
  }
  // \u300c\u5f53\u524d\u6a21\u5757\uff1aX\uff0c\u5f53\u524d\u96c6\u5408/\u5b57\u6bb5\uff1aname\uff0c\u9009\u4e2d\u7b2c 3 \u9879\u300c\u67d0\u300d\u300d\u2192\u300cX \u00b7 \u5267\u672c\u540d \u00b7 \u67d0\u300d\uff08\u7ed9\u4eba\u770b\u7684\uff1b\u5582\u6a21\u578b\u7684\u4ecd\u662f\u539f\u53e5\uff09
  function _ctxLabel(raw) {
    var s = String(raw || ''); if (!s) return '';
    var mod = (s.match(/\u5f53\u524d\u6a21\u5757\uff1a([^\uff0c]+)/) || [])[1] || '';
    var fld = (s.match(/\u5f53\u524d\u96c6\u5408\/\u5b57\u6bb5\uff1a([^\uff0c]+)/) || [])[1] || '';
    var ent = (s.match(/\u9009\u4e2d\u7b2c \d+ \u9879\u300c([^\u300d]+)\u300d/) || [])[1] || '';
    var fl = fld ? ((__aaU._COLL_CN && __aaU._COLL_CN[fld]) || (__aaU._fieldLabel ? __aaU._fieldLabel(fld) : fld)) : '';
    var parts = [mod, fl, ent].filter(Boolean);
    var rest = s.replace(/\u5f53\u524d\u6a21\u5757\uff1a[^\uff0c]+\uff0c?/, '').replace(/\u5f53\u524d\u96c6\u5408\/\u5b57\u6bb5\uff1a[^\uff0c]+\uff0c?/, '').replace(/\u9009\u4e2d\u7b2c \d+ \u9879(\u300c[^\u300d]+\u300d)?\uff0c?/, '').trim();
    return parts.length ? parts.join(' \u00b7 ') + (rest ? ' \u00b7 ' + rest : '') : s;
  }
  function _refreshCtxChip() {
    if (!ui.els || !ui.els.ctx) return;
    if (!ui._ctx) ui._ctx = { pinned: false, value: '', _sig: null };
    var pinned = !!ui._ctx.pinned;
    var shown = pinned ? (ui._ctx.value || '') : _liveEditorContext();
    var sig = (pinned ? 'P:' : 'L:') + shown;
    if (ui._ctx._sig === sig) return;
    ui._ctx._sig = sig;
    var el = ui.els.ctx;
    if (!shown) { el.hidden = true; el.innerHTML = ''; return; }
    el.hidden = false;
    el.innerHTML = '<span class="tm-aa-ctx-ico" title="\u56fd\u5e08\u4f1a\u628a\u8fd9\u91cc\u5f53\u4f5c\u300c\u8fd9\u4e2a\u300d\u300c\u4ed6\u300d\u6240\u6307">' + _icon('flag', 13) + '</span><span class="tm-aa-ctx-txt" title="' + esc(shown) + '">' + esc((pinned ? '\u56fa\u5b9a\u5728 ' : '\u773c\u4e0b\u5728 ') + _ctxLabel(shown)) + '</span>' +
      '<button type="button" class="tm-aa-ctx-pin' + (pinned ? ' on' : '') + '" title="' + (pinned ? '\u53d6\u6d88\u56fa\u5b9a\uff08\u8ddf\u7740\u7f16\u8f91\u5668\u7684\u9009\u4e2d\u8d70\uff09' : '\u56fa\u5b9a\u773c\u4e0b\u8fd9\u4e00\u5904\uff0c\u6362\u9875\u4e5f\u4e0d\u8ddf\u7740\u53d8') + '">' + (pinned ? '\u5df2\u56fa\u5b9a' : '\u56fa\u5b9a') + '</button>';
  }
  function _ensureCtxChip() {
    if (ui._ctxWired) return; ui._ctxWired = true;
    if (!ui._ctx) ui._ctx = { pinned: false, value: '', _sig: null };
    if (ui.els && ui.els.ctx) ui.els.ctx.addEventListener('click', function (ev) {
      var b = ev.target && ev.target.closest ? ev.target.closest('.tm-aa-ctx-pin') : null;
      if (!b) return;
      ui._ctx.pinned = !ui._ctx.pinned;
      if (ui._ctx.pinned) ui._ctx.value = _liveEditorContext();
      ui._ctx._sig = null; _refreshCtxChip();
    });
    setInterval(function () {
      try { if (ui.els && ui.els.panel && ui.els.panel.classList.contains('open')) { _refreshCtxChip(); _refreshFileSub(); } } catch (e) {}
    }, 700);
    _refreshCtxChip();
  }

  function buildPanel() {
    var panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.setAttribute('role', 'complementary');
    panel.setAttribute('aria-label', '国师 · AI 剧本助手');
    panel.innerHTML = [
      '<div class="tm-aa-resize" id="tm-aa-resize" title="拖动调整宽度"></div>',   // 左缘拖拽调宽
      '<div id="tm-aa-hd">',
      '<button id="tm-aa-rail-tg" aria-label="会话" title="会话（按剧本分开，可切回、改名、分叉）">' + _icon('bars', 16) + '</button>',
      '<span class="tm-aa-ava" aria-hidden="true">师</span>',
      '<span class="hd-tt"><b>国师</b><span class="sub">' + esc(ui.adapter.label || '') + '</span></span>',
      '<span class="tm-aa-hdbtns">',
      '<button id="tm-aa-newchat" aria-label="开始新对话" title="新对话（这一段会话留在侧栏，随时可切回）">' + _icon('plus', 16) + '</button>',
      '<button id="tm-aa-ledger" aria-label="改动史" title="改动史：国师应用过的每一次改动，可逐次撤销">' + _icon('history', 16) + '</button>',
      '<button id="tm-aa-settings" aria-label="设置" title="设置：连接与模型、权限、约定、偏好">' + _icon('gear', 16) + '</button>',
      '<button id="tm-aa-theme" aria-label="切换明暗主题" title="漆案（深色）/ 宣纸（浅色）">' + _icon('contrast', 16) + '</button>',
      '<button id="tm-aa-fs" aria-label="展开或还原" title="展开 / 还原">' + _icon('expand', 16) + '</button>',
      '<button id="tm-aa-x" aria-label="收起" title="收起">' + _icon('close', 16) + '</button>',
      '</span></div>',
      '<div id="tm-aa-progress" aria-hidden="true"></div>',
      '<div id="tm-aa-rail"><button id="tm-aa-railnew" type="button">' + _icon('plus', 14) + '新对话</button><input id="tm-aa-railq" type="text" placeholder="搜索会话…" aria-label="搜索会话"><div id="tm-aa-raillist"></div><button id="tm-aa-railclear" type="button" title="清空全部会话（运行记录与版本说明不受影响）">清空会话</button></div>',
      '<div id="tm-aa-body">',
      '<div class="tm-aa-search" id="tm-aa-search" hidden><input type="text" id="tm-aa-search-in" placeholder="在对话里查找…"><span class="tm-aa-search-n" id="tm-aa-search-n">0/0</span><button type="button" id="tm-aa-search-prev" title="上一个">↑</button><button type="button" id="tm-aa-search-next" title="下一个">↓</button><button type="button" id="tm-aa-search-x" title="关闭 (Esc)">×</button></div>',
      '<div class="tm-aa-empty" id="tm-aa-empty" style="display:none"></div>',
      '<div class="tm-aa-sec" data-sec="log" style="display:none">对话</div>',
      '<div class="tm-aa-logwrap" id="tm-aa-logwrap" style="display:none"><div class="tm-aa-log" id="tm-aa-loglist"></div><button type="button" class="tm-aa-tobottom" id="tm-aa-tobottom" hidden>' + _icon('down', 13) + '回到最新</button></div>',
      // 旧版固定结果位：回应卡建好之前 ui.els 先指着它们（不显示）
      '<div class="tm-aa-legacy" aria-hidden="true"><div class="tm-aa-summary" id="tm-aa-summary" style="display:none"></div><div class="tm-aa-sec" data-sec="diff" style="display:none"></div><div class="tm-aa-diff" id="tm-aa-difflist" style="display:none"></div><div class="tm-aa-val" id="tm-aa-val" style="display:none"></div>',
      '<div id="tm-aa-actions" style="display:none"><button id="tm-aa-apply">应用到剧本</button><button id="tm-aa-discard">放弃</button></div></div>',
      '<div id="tm-aa-composer"><div class="tm-aa-composer-in">',
      '<div id="tm-aa-ctx" hidden></div>',
      '<div id="tm-aa-mentions" hidden></div>',
      '<div id="tm-aa-attach" hidden></div>',
      '<div id="tm-aa-atpop" class="tm-aa-pop" hidden></div>',
      '<div id="tm-aa-cmdpop" class="tm-aa-pop" hidden></div>',
      '<div id="tm-aa-plusmenu" class="tm-aa-pop" hidden></div>',
      '<div id="tm-aa-permpop" class="tm-aa-pop" hidden>',
      '<div class="mp-h">国师能动到哪一步 · Shift+Tab 轮换</div>',
      '<button type="button" class="tm-aa-pm" data-pm="plan"><span class="pm-dot"></span><span><b>问策</b><span class="pm-d">只读勘察，出一份编号计划给你批，批了才动剧本。</span></span></button>',
      '<button type="button" class="tm-aa-pm" data-pm="review"><span class="pm-dot"></span><span><b>共审</b><span class="pm-d">国师起草改动，你逐项过目后再应用。（默认，最稳）</span></span></button>',
      '<button type="button" class="tm-aa-pm" data-pm="auto"><span class="pm-dot"></span><span><b>放行</b><span class="pm-d">做完且没带来新问题，就直接应用到剧本。适合信得过的批量活。</span></span></button>',
      '<label class="pm-danger"><input type="checkbox" id="tm-aa-perm-danger">允许删除实体、联动改名这类伤筋动骨的写入</label>',
      '<div class="mp-hint">模式和开关会记住。只许改哪几类内容，在「设置 · 权限」里定。</div>',
      '</div>',
      '<div id="tm-aa-modelpop" class="tm-aa-pop" hidden>',
      '<div class="mp-h">连接与模型</div>',
      '<label class="mp-lab">API 地址<input id="tm-aa-api-url" type="text" placeholder="https://api.deepseek.com 或中转地址" autocomplete="off" spellcheck="false"></label>',
      '<label class="mp-lab">API Key<input id="tm-aa-api-key" type="password" placeholder="sk-…" autocomplete="off"></label>',
      '<div class="mp-row"><button type="button" id="tm-aa-api-detect">检测模型</button><button type="button" id="tm-aa-api-test">测试连接</button><span class="mp-st" id="tm-aa-api-st"></span></div>',
      '<label class="mp-lab">主模型<select id="tm-aa-api-model"></select></label>',
      '<input id="tm-aa-api-model-custom" class="tm-aa-input" type="text" placeholder="或手填模型名（列表里没有时）" spellcheck="false" autocomplete="off" style="margin:-4px 0 9px">',
      '<label class="mp-lab">次要模型（三堂会审两官、前情摘要、起标题这些杂活，可省主模型的钱）<select id="tm-aa-api-model2"><option value="">不用 · 都走主模型</option></select></label>',
      '<div class="mp-row mp-end"><button type="button" id="tm-aa-api-save">保存并使用</button></div>',
      '<div class="mp-hint">与正式游戏共用一份（存 tm_api，国师和生图同源）。「检测模型」会真去调这个 API 的模型清单；「测试连接」发一次最小调用，确认工具通道能用。</div>',
      '</div>',
      '<div id="tm-aa-field">',
      '<textarea id="tm-aa-req" placeholder="' + esc(_REQ_PLACEHOLDER) + '" aria-label="对国师说"></textarea>',
      '<span class="tm-aa-charcount" id="tm-aa-charcount" hidden></span>',
      '<div class="tm-aa-fieldbar">',
      '<button type="button" id="tm-aa-plus" class="tm-aa-ib" aria-label="更多能力" title="更多：附件、导入、审阅、问答、讲解、分解编排、三堂会审…">' + _icon('plus', 16) + '</button>',
      '<button type="button" id="tm-aa-perm" class="tm-aa-chip" aria-label="权限模式" title="权限模式：问策 / 共审 / 放行（Shift+Tab 轮换）"></button>',
      '<button type="button" id="tm-aa-attach-btn" class="tm-aa-ib" aria-label="添加附件" title="附件：文本（txt/md/json/csv…）作参考；图片和截图走看图（主模型要支持）。也可以直接拖进来或粘贴截图">' + _icon('clip', 16) + '</button>',
      '<input type="file" id="tm-aa-file" multiple hidden accept="image/*,.txt,.md,.json,.csv,.tsv,.js,.yml,.yaml,.xml,.html">',
      '<div id="tm-aa-worldkind"><span class="tm-aa-wk-lab">世界类型</span><button type="button" class="tm-aa-wk-opt" data-wk="historical" title="史实剧本：年号、生卒、职官、事件要与正史相符，遇到硬伤会进谏">史实</button><button type="button" class="tm-aa-wk-opt" data-wk="fictional" title="虚构/架空：不受真实历史约束，国师只管设定自洽与平衡">虚构</button></div>',
      '<span class="tm-aa-flex"></span>',
      '<button type="button" id="tm-aa-model" class="tm-aa-chip" title="连接与模型" aria-label="连接与模型"></button>',
      '<button id="tm-aa-go" title="发送（Enter）· 换行（Shift+Enter）" aria-label="发送">' + _icon('send', 17) + '</button>',
      '</div>',
      '</div>',
      '<div class="tm-aa-statusrow"><span id="tm-aa-status" aria-live="polite"></span><button type="button" class="tm-aa-pending" id="tm-aa-pending" hidden title="看待审改动"></button><span id="tm-aa-meter"></span></div>',
      '</div></div>',
      '</div>'
    ].join('');
    document.body.appendChild(panel);

    ui.els = {
      panel: panel,
      req: panel.querySelector('#tm-aa-req'),
      charCount: panel.querySelector('#tm-aa-charcount'),
      worldkind: panel.querySelector('#tm-aa-worldkind'),
      go: panel.querySelector('#tm-aa-go'),
      status: panel.querySelector('#tm-aa-status'),
      ctx: panel.querySelector('#tm-aa-ctx'),
      mentions: panel.querySelector('#tm-aa-mentions'),
      atpop: panel.querySelector('#tm-aa-atpop'),
      cmdpop: panel.querySelector('#tm-aa-cmdpop'),   // S6 · / 命令面板
      meter: panel.querySelector('#tm-aa-meter'),
      pending: panel.querySelector('#tm-aa-pending'),
      empty: panel.querySelector('#tm-aa-empty'),
      logSec: panel.querySelector('[data-sec="log"]'),
      logWrap: panel.querySelector('#tm-aa-logwrap'),
      log: panel.querySelector('#tm-aa-loglist'),
      toBottom: panel.querySelector('#tm-aa-tobottom'),
      summary: panel.querySelector('#tm-aa-summary'),
      diffSec: panel.querySelector('.tm-aa-legacy [data-sec="diff"]'),
      diff: panel.querySelector('#tm-aa-difflist'),
      val: panel.querySelector('#tm-aa-val'),
      actions: panel.querySelector('#tm-aa-actions'),
      apply: panel.querySelector('#tm-aa-apply'),
      discard: panel.querySelector('#tm-aa-discard'),
      resize: panel.querySelector('#tm-aa-resize'),
      fs: panel.querySelector('#tm-aa-fs'),
      body: panel.querySelector('#tm-aa-body'),
      composer: panel.querySelector('#tm-aa-composer'),
      search: panel.querySelector('#tm-aa-search'),
      searchIn: panel.querySelector('#tm-aa-search-in'),
      searchCount: panel.querySelector('#tm-aa-search-n'),
      theme: panel.querySelector('#tm-aa-theme'),       // 漆案 / 宣纸
      plus: panel.querySelector('#tm-aa-plus'),         // ＋ 能力菜单
      plusmenu: panel.querySelector('#tm-aa-plusmenu'),
      model: panel.querySelector('#tm-aa-model'),       // 连接与模型（弹层）
      modelpop: panel.querySelector('#tm-aa-modelpop'),
      perm: panel.querySelector('#tm-aa-perm'),         // 权限模式（问策/共审/放行）
      permpop: panel.querySelector('#tm-aa-permpop'),
      attach: panel.querySelector('#tm-aa-attach'),     // 附件签行
      rail: panel.querySelector('#tm-aa-rail'),         // 会话抽屉
      raillist: panel.querySelector('#tm-aa-raillist'),
      railTg: panel.querySelector('#tm-aa-rail-tg'),
      settings: panel.querySelector('#tm-aa-settings'),
      ledger: panel.querySelector('#tm-aa-ledger')
    };
    panel.querySelector('#tm-aa-x').addEventListener('click', function() {
      if (panel._fs) _toggleFullscreen();
      panel.classList.remove('open');
      // 剧本工坊停靠态也必须真正关闭并归还正文宽度；此前 CSS 强制 display:flex 导致 × 形同虚设。
      try { document.body.classList.remove('je-guoshi-docked', 'je-guoshi-settings-open'); } catch (e) {}
    });
    var _nc = panel.querySelector('#tm-aa-newchat'); if (_nc) _nc.addEventListener('click', newConversation);   // 真·连续会话：另起新对话
    var _pf = panel.querySelector('#tm-aa-preflight'); if (_pf) _pf.addEventListener('click', function () { runPreflightUI(); });   // 运行时体检(确定性免API)：宿主若自带按钮也接到这里
    if (ui.els.fs) ui.els.fs.addEventListener('click', function () { _toggleFullscreen('user'); });
    if (ui.els.settings) ui.els.settings.addEventListener('click', function () { _toggleSheet('settings'); });
    if (ui.els.ledger) ui.els.ledger.addEventListener('click', function () { _toggleSheet('ledger'); });
    if (ui.els.pending) ui.els.pending.addEventListener('click', function () { _scrollToPending(); });
    var _sub = panel.querySelector('#tm-aa-hd .sub');
    if (_sub) { _sub.classList.add('cmdk'); _sub.title = '命令面板（Ctrl+K）'; _sub.addEventListener('click', function () { _openCmdPalette(); }); }
    _ensurePanelResize();   // 左缘拖拽调宽 + 载入持久宽度
    _ensureSearch();        // 对话内查找（Ctrl+F）
    _ensureCtxChip();       // 焦点上下文
    _ensureAtMention();     // @ 提及 + 发送/插话/轮换模式/指令历史的键位
    _ensureCmdPal();        // / 命令面板（Ctrl+K 唤起）
    ui.els.go.addEventListener('click', onGoClick);   // 运行中此键=停止
    ui.els.apply.addEventListener('click', onApply);
    ui.els.discard.addEventListener('click', onDiscard);
    _ensureWorldKind();   // 世界类型（史实/虚构）
    _ensureTheme();       // 漆案 / 宣纸（持久）
    _ensurePlusMenu();    // ＋ 能力菜单
    _ensureRail();        // 会话抽屉
    _ensureModelPop();    // 连接与模型（检测该 API 的真实模型清单）
    _ensurePermPop();     // 权限模式（问策/共审/放行·持久）
    _ensureAttach();      // 附件：曲别针/拖拽/粘贴截图 → 文本内联 + 图片看图通道
    _ensureLogFollow();   // 滚动跟随 + 回到最新
    _renderEmpty();       // 空状态欢迎 + 建议
    ui.els.req.addEventListener('input', _syncEmpty);   // 有字则隐欢迎态
    ui.els.req.addEventListener('input', _autoGrowReq);   // 自增高 + 字数
    ui._onDiffPainted = function () {   // 逐项采纳/不要后，应用键上的处数跟着变
      try {
        if (!ui.els || !ui.els.apply || ui._pendingPlan || ui._partialApplyConfirmed) return;
        var t = ui.els.apply.textContent || '';
        if (/^应用 \d+ 处改动$|^仍要应用$/.test(t)) ui.els.apply.textContent = _applyLabel(ui._applyValid !== false, ui._lastDiffs || []);
        _refreshPending();
      } catch (e) {}
    };
    _syncEmpty(); _autoGrowReq();
    return panel;
  }

  function ensurePanel() {
    var p = document.getElementById(PANEL_ID);
    if (!p) p = buildPanel();
    return p;
  }

  // ── 刀2 · 世界类型（史实/虚构）：写进剧本对象 worldKind；国师 runAuthoringLoop 经 draft.worldKind 自动读取，5 个入口零改 ──
  function _worldKind() {
    try {
      var sc = (ui.adapter && ui.adapter.getScenario) ? ui.adapter.getScenario() : null;
      return (sc && sc.worldKind === 'fictional') ? 'fictional' : 'historical';
    } catch (e) { return 'historical'; }
  }
  function _reflectWorldKind() {
    var box = ui.els && ui.els.worldkind; if (!box) return;
    var cur = _worldKind();
    var btns = box.querySelectorAll('.tm-aa-wk-opt');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('on', btns[i].getAttribute('data-wk') === cur);
    }
  }
  function _setWorldKind(v) {
    v = (v === 'fictional') ? 'fictional' : 'historical';
    try {
      var sc = (ui.adapter && ui.adapter.getScenario) ? ui.adapter.getScenario() : null;
      if (sc) {
        sc.worldKind = v;                 // 写进活剧本对象：makeDraft 每次克隆活对象 → draft.worldKind 带过去
        if (ui.draft) ui.draft.worldKind = v;   // 续接会话中已建 draft → 同步本轮
        var app = global.TM_SCENARIO_EDITOR_RESET_APP;
        if (app && typeof app.recordExternalEdit === 'function') app.recordExternalEdit('设置世界类型', 'worldKind=' + v);
      }
    } catch (e) {}
    _reflectWorldKind();
    setStatus(v === 'fictional'
      ? '世界类型已设为「虚构」——国师按架空/原创世界观创作，不再以真实史实为据（只管设定自洽与平衡）。'
      : '世界类型已设为「史实」——国师按正史考据创作（年号/生卒/职官相符，遇硬伤进谏）。');
  }
  function _ensureWorldKind() {
    var box = ui.els && ui.els.worldkind; if (!box) return;
    box.addEventListener('click', function (ev) {
      var b = (ev.target && ev.target.closest) ? ev.target.closest('.tm-aa-wk-opt') : null;
      if (b) _setWorldKind(b.getAttribute('data-wk'));
    });
    _reflectWorldKind();   // 初始反映剧本当前 worldKind
  }

  // ── 漆案（深色·默认）/ 宣纸（浅色）·持久 ──
  var THEME_KEY = 'tm_aa_theme';
  function _setTheme(next) {
    var p = ui.els && ui.els.panel; if (!p) return;
    p.setAttribute('data-theme', next === 'light' ? 'light' : 'dark');
    try { localStorage.setItem(THEME_KEY, next === 'light' ? 'light' : 'dark'); } catch (e) {}
  }
  function _ensureTheme() {
    var p = ui.els && ui.els.panel; if (!p) return;
    var saved = 'dark';
    try { saved = localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'; } catch (e) {}
    p.setAttribute('data-theme', saved);
    if (ui.els.theme) ui.els.theme.addEventListener('click', function () {
      var next = p.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      _setTheme(next);
      setStatus(next === 'light' ? '换成宣纸（浅色）' : '换成漆案（深色）');
    });
  }

  // ── ＋ 能力菜单：附件与素材 / 只读的问与审 / 大活 / 存档（全部走既有运行器） ──
  var _PLUS_ITEMS = [
    { h: '附件与素材' },
    { act: 'attach', ic: 'clip', t: '添加附件', d: '文本作参考、截图走看图；也能直接拖进来' },
    { act: 'import', ic: 'import', t: '导入素材', d: '粘一段史料或设定，国师抽成人物、势力、事件入草稿' },
    { act: 'batch', ic: 'layers', t: '批量扩写', d: '一次新增一批同类实体，照现有范例的笔法' },
    { act: 'bundle', ic: 'box', t: '实体捆绑', d: '把一个势力连同人物、关系打包，跨剧本复用' },
    { h: '只读，不改剧本' },
    { act: 'preflight', ic: 'pulse', t: '运行时体检', d: '确定性检查，免 API，查会挡住开局的硬伤' },
    { act: 'review', ic: 'search', t: '审阅出报告', d: '平衡、史实、可玩性、缺口；输入框可写审阅重点' },
    { act: 'qa', ic: 'chat', t: '剧本问答', d: '先在输入框写问题，国师查证后回答' },
    { act: 'explain', ic: 'book', t: '讲解剧本', d: '给接手的人讲格局、人物、上手要点' },
    { h: '大活' },
    { act: 'orchestrate', ic: 'route', t: '分解编排', d: '大需求拆成子任务逐个做，共用一份草稿' },
    { act: 'critics', ic: 'scale', t: '三堂会审', d: '国师拟稿，史官查史实、谏官批平衡，再据谏修订' },
    { act: 'auto-select', ic: 'sparkle', t: '自动选择工作方式', d: '只管下一次：由国师在直接改、先计划、编排、会审里择一' },
    { h: '存档' },
    { act: 'checkpoint', ic: 'save', t: '存检查点', d: '把当前剧本存为可回退的存档点' },
    { act: 'undo', ic: 'undo', t: '撤销上次应用', d: '回到上次应用国师改动之前' },
    { act: 'ledger', ic: 'history', t: '改动史', d: '国师应用过的每一次改动，可逐次撤销' }
  ];
  function _plusClose() { if (ui.els && ui.els.plusmenu) { ui.els.plusmenu.hidden = true; ui.els.plus.classList.remove('on'); } }
  // ＋菜单与 / 命令面板共用的能力派发（S6·CC slash commands 对照）
  function _plusAct(act) {
    if (act === 'preflight') runPreflightUI();
    else if (act === 'auto-select') _armAutoMode();
    else if (act === 'review') runReview();
    else if (act === 'qa') runQaUI();
    else if (act === 'explain') runExplainUI();
    else if (act === 'orchestrate') runOrchestratedUI();
    else if (act === 'critics') _armCritics();
    else if (act === 'checkpoint') manualCheckpoint();
    else if (act === 'undo') _undoLatest();
    else if (act === 'attach') { var fin = ui.els && ui.els.panel && ui.els.panel.querySelector('#tm-aa-file'); if (fin) fin.click(); }
    else if (act === 'import' || act === 'batch' || act === 'bundle' || act === 'ledger' || act === 'settings' || act === 'keys' || act === 'macros') _toggleSheet(act, true);
  }

  // ── / 命令面板：行首敲 / 即出，边敲边筛，↑↓ 选，Enter 执行；「/审阅 平衡性」式参数回填输入框。Ctrl+K 亦可唤起。 ──
  function _cmdDefs() {
    return [
      { k: 'new', t: '新对话', d: '另起新会话（旧的留在会话侧栏，可切回）', ic: 'plus', run: function () { newConversation(); } },
      { k: 'sessions', t: '会话', d: '打开会话侧栏', ic: 'bars', run: function () { if (ui.els.railTg) ui.els.railTg.click(); } },
      { k: 'ledger', t: '改动史', d: '国师应用过的改动，逐次可撤销', ic: 'history', run: function () { _plusAct('ledger'); } },
      { k: 'review', t: '审阅出报告', d: '全面体检，可带重点：/审阅 平衡性', ic: 'search', run: function () { _plusAct('review'); } },
      { k: 'qa', t: '剧本问答', d: '就剧本提问：/剧本问答 谁掌兵权', ic: 'chat', run: function () { _plusAct('qa'); } },
      { k: 'explain', t: '讲解剧本', d: '给接手的人讲格局与上手要点', ic: 'book', run: function () { _plusAct('explain'); } },
      { k: 'preflight', t: '运行时体检', d: '确定性检查，免 API', ic: 'pulse', run: function () { _plusAct('preflight'); } },
      { k: 'orchestrate', t: '分解编排', d: '大需求拆子任务：/分解编排 重做经济', ic: 'route', run: function () { _plusAct('orchestrate'); } },
      { k: 'critics', t: '三堂会审', d: '拟稿＋史官＋谏官（下一次发送生效）', ic: 'scale', run: function () { _plusAct('critics'); } },
      { k: 'auto', t: '自动选择工作方式', d: '下一次发送由国师择一种做法', ic: 'sparkle', run: function () { _plusAct('auto-select'); } },
      { k: 'import', t: '导入素材', d: '史料/设定文本 → 实体入草稿', ic: 'import', run: function () { _plusAct('import'); } },
      { k: 'batch', t: '批量扩写', d: '一次新增一批同类实体', ic: 'layers', run: function () { _plusAct('batch'); } },
      { k: 'bundle', t: '实体捆绑', d: '势力连人物、关系打包导出/导入', ic: 'box', run: function () { _plusAct('bundle'); } },
      { k: 'macros', t: '模板', d: '存常用指令，一键填进输入框', ic: 'scroll', run: function () { _plusAct('macros'); } },
      { k: 'changelog', t: '版本说明', d: '汇总已应用的改动，零 token', ic: 'scroll', run: function () { runChangelogUI(); } },
      { k: 'fork', t: '分叉会话', d: '把当前会话复制一份分头演化（原线不动）', ic: 'branch', run: function () { if (ui._sessId) forkSession(ui._sessId); else setStatus('眼下没有会话（先聊一轮，或从侧栏选一条）'); } },
      { k: 'conv', t: '创作约定', d: '全局＋本剧本两层约定（每次都会遵守）', ic: 'scroll', run: function () { showConventionsUI(); } },
      { k: 'initconv', t: '初始化约定', d: '通读剧本，提炼值得沿用的约定（可逐条记住）', ic: 'sparkle', run: function () { ui.els.req.value = '【梳理创作约定】通读剧本，总结 5-10 条值得长期沿用的创作约定（命名规律、文风与称谓、数值区间、结构惯例、世界观基调）。每确认一条就调用 recordConvention 记录一条；报告 findings 也逐条列出这些约定及其依据。不评质量问题，只提炼惯例。'; runReview(); } },
      { k: 'memories', t: '记忆册', d: '国师存下的跨会话记忆（可删）', ic: 'book', run: function () { showMemoriesUI(); } },
      { k: 'skills', t: '技能册', d: '可用技能（内置、能力包、自存）', ic: 'sparkle', run: function () { showSkillsUI(); } },
      { k: 'packs', t: '能力包', d: '技能＋约定的打包单元（启停/导入/导出）', ic: 'box', run: function () { showPacksUI(); } },
      { k: 'usage', t: '用量·上下文', d: '本轮 token 构成与上下文占比', ic: 'pulse', run: function () { showUsageUI(); } },
      { k: 'compact', t: '压缩前情', d: '把长对话压成前情摘要，续着聊不断片', ic: 'layers', run: function () { runCompactUI(); } },
      { k: 'checkpoint', t: '存检查点', d: '当前剧本存为可回退的存档点', ic: 'save', run: function () { _plusAct('checkpoint'); } },
      { k: 'undo', t: '撤销上次应用', d: '回到上次应用之前', ic: 'undo', run: function () { _plusAct('undo'); } },
      { k: 'perm-plan', t: '权限·问策', d: '只读出计划，批了才动剧本', ic: 'shield', run: function () { var p = _loadPerm(); p.mode = 'plan'; _applyPerm(p); setStatus(_PERM_TIP.plan); } },
      { k: 'perm-review', t: '权限·共审', d: '改动经你过目后应用（默认）', ic: 'shield', run: function () { var p = _loadPerm(); p.mode = 'review'; _applyPerm(p); setStatus(_PERM_TIP.review); } },
      { k: 'perm-auto', t: '权限·放行', d: '做完且没带来新问题就直接应用', ic: 'shield', run: function () { var p = _loadPerm(); p.mode = 'auto'; _applyPerm(p); setStatus(_PERM_TIP.auto); } },
      { k: 'notify', t: '完成通知', d: '页面在后台时，跑完弹系统通知（开/关）', ic: 'bell', run: function () { _toggleNotify(); } },
      { k: 'microplan', t: '歧义先对齐', d: '需求有几种做法时先给微计划确认（开/关）', ic: 'chat', run: function () { _toggleMicroPlan(); } },
      { k: 'stream', t: '实时显示', d: '国师边想边说，字一个个冒出来（开/关）', ic: 'pen', run: function () { _setStreamPref(!_streamOn()); } },
      { k: 'web', t: '联网查资料', d: '国师读网页查史料（开/关·每个网站先问你）', ic: 'globe', run: function () { _setWebPref(!_webOn()); } },
      { k: 'settings', t: '设置', d: '连接与模型、权限、约定、偏好', ic: 'gear', run: function () { _plusAct('settings'); } },
      { k: 'theme', t: '切换主题', d: '漆案（深色）/ 宣纸（浅色）', ic: 'contrast', run: function () { if (ui.els.theme) ui.els.theme.click(); } },
      { k: 'keys', t: '快捷键', d: '国师面板里的键位', ic: 'keyboard', run: function () { _plusAct('keys'); } }
    ];
  }
  function _cmdQuery() {
    var v = (ui.els && ui.els.req ? ui.els.req.value : '') || '';
    if (v.charAt(0) !== '/') return null;
    var sp = v.indexOf(' ');
    return { cmd: (sp > 0 ? v.slice(1, sp) : v.slice(1)).trim().toLowerCase(), arg: sp > 0 ? v.slice(sp + 1) : '' };
  }
  // 浮层上下自适应：上方空间不足（欢迎态时输入区贴近顶部）→ 翻到下方
  function _popPlace(pop) {
    function place() {
      try {
        var pb = ui.els.panel.getBoundingClientRect(), cb = pop.parentElement.getBoundingClientRect();
        pop.classList.toggle('below', (cb.top - pb.top) < 300);
      } catch (e) {}
    }
    place();
    // 同一输入事件里 _syncEmpty 可能撤掉空态——布局稳定后复测一次
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(place);
  }
  function _hideCmdPop() { ui._cmdActive = false; ui._cmdIdx = 0; if (ui.els && ui.els.cmdpop) ui.els.cmdpop.hidden = true; }
  function _showCmdPop() {
    var pop = ui.els && ui.els.cmdpop; if (!pop) return;
    var pq = _cmdQuery();
    if (pq == null) { if (ui._cmdActive) _hideCmdPop(); return; }
    var list = _cmdDefs().filter(function (c) { return !pq.cmd || (c.t + ' ' + c.d + ' ' + c.k).toLowerCase().indexOf(pq.cmd) >= 0; });
    if (!list.length) { _hideCmdPop(); return; }
    ui._cmdActive = true;
    if (!ui._cmdIdx || ui._cmdIdx >= list.length) ui._cmdIdx = 0;
    pop.innerHTML = '<div class="tm-aa-cmdhd">命令 · ↑↓ 选 · Enter 执行 · Esc 关</div>' + list.map(function (c, i) {
      return '<button type="button" class="tm-aa-cmditem' + (i === ui._cmdIdx ? ' on' : '') + '" data-k="' + esc(c.k) + '"><span class="cmd-ic">' + _icon(c.ic || 'chevron', 15) + '</span><span><b>' + esc(c.t) + '</b><span class="cmd-d">' + esc(c.d) + '</span></span><span class="cmd-k">/' + esc(c.k) + '</span></button>';
    }).join('');
    pop.hidden = false;
    _popPlace(pop);
  }
  function _execCmd(k) {
    var pq = _cmdQuery() || { arg: '' };
    var def = null;
    _cmdDefs().forEach(function (c) { if (!def && c.k === k) def = c; });
    _hideCmdPop();
    if (!def) return;
    if (ui.running && k !== 'sessions' && k !== 'theme' && k !== 'keys' && k !== 'ledger' && k !== 'settings') { setStatus('国师还在忙，先停下再用「' + def.t + '」'); return; }
    ui.els.req.value = pq.arg || '';   // 「/命令 参数」→ 参数回填输入框供运行器取用
    _autoGrowReq();
    def.run();
  }
  function _openCmdPalette() {
    if (!ui.els || !ui.els.req) return;
    var p = ui.els.panel; if (p && !p.classList.contains('open')) _openPanel();
    ui.els.req.value = '/'; _autoGrowReq();
    try { ui.els.req.focus(); ui.els.req.setSelectionRange(1, 1); } catch (e) {}
    ui._cmdIdx = 0; _showCmdPop();
  }
  function _ensureCmdPal() {
    if (ui._cmdWired || !ui.els || !ui.els.req) return;
    ui._cmdWired = true;
    ui._cmdIdx = 0;
    ui.els.req.addEventListener('input', _showCmdPop);
    ui.els.req.addEventListener('keydown', function (ev) {
      if (!ui._cmdActive) return;
      var items = ui.els.cmdpop ? ui.els.cmdpop.querySelectorAll('.tm-aa-cmditem') : [];
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
        ev.preventDefault();
        if (!items.length) return;
        ui._cmdIdx = (ui._cmdIdx + (ev.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length;
        for (var i = 0; i < items.length; i++) items[i].classList.toggle('on', i === ui._cmdIdx);
        try { items[ui._cmdIdx].scrollIntoView({ block: 'nearest' }); } catch (e) {}
        return;
      }
      if ((ev.key === 'Enter' || ev.keyCode === 13 || ev.key === 'Tab') && !ev.isComposing) {
        ev.preventDefault();
        var el = items[ui._cmdIdx];
        if (el) _execCmd(el.getAttribute('data-k'));
        return;
      }
      if (ev.key === 'Escape') { ev.stopPropagation(); _hideCmdPop(); }
    });
    if (ui.els.cmdpop) ui.els.cmdpop.addEventListener('mousedown', function (ev) {
      var b = ev.target && ev.target.closest ? ev.target.closest('.tm-aa-cmditem') : null;
      if (b) { ev.preventDefault(); _execCmd(b.getAttribute('data-k')); }
    });
    document.addEventListener('keydown', function (ev) {   // Ctrl/⌘+K 唤起（工坊不再另挂一份）
      if ((ev.ctrlKey || ev.metaKey) && (ev.key === 'k' || ev.key === 'K')) {
        var p = ui.els.panel; if (!p) return;
        if (!p.classList.contains('open') && !document.body.classList.contains('je-guoshi-docked')) return;
        ev.preventDefault();
        _openCmdPalette();
      }
    });
    document.addEventListener('click', function (ev) { if (ui._cmdActive && ui.els.cmdpop && !ui.els.cmdpop.contains(ev.target) && ev.target !== ui.els.req) _hideCmdPop(); });
  }
  function _ensurePlusMenu() {
    var btn = ui.els && ui.els.plus, menu = ui.els && ui.els.plusmenu;
    if (!btn || !menu || ui._plusBound) return;
    ui._plusBound = true;
    menu.innerHTML = _PLUS_ITEMS.map(function (it) {
      if (it.h) return '<div class="mi-h">' + esc(it.h) + '</div>';
      return '<button type="button" class="tm-aa-mi" data-act="' + it.act + '"><span class="mi-ic">' + _icon(it.ic) + '</span><span><span class="mi-t">' + esc(it.t) + '</span><span class="mi-d">' + esc(it.d) + '</span></span></button>';
    }).join('');
    btn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      menu.hidden = !menu.hidden;
      btn.classList.toggle('on', !menu.hidden);
      if (!menu.hidden) { _permPopClose(); _modelPopClose(); _popPlace(menu); }
    });
    menu.addEventListener('click', function (ev) {
      var b = ev.target && ev.target.closest ? ev.target.closest('.tm-aa-mi') : null;
      if (!b) return;
      _plusClose();
      var act = b.getAttribute('data-act');
      if (ui.running && act !== 'ledger' && act !== 'attach') { setStatus('国师还在忙，先停下再用「' + ((b.querySelector('.mi-t') || b).textContent || '').slice(0, 8) + '」'); return; }
      _plusAct(act);
    });
    document.addEventListener('click', function (ev) {
      if (!menu.hidden && !menu.contains(ev.target) && ev.target !== btn && !btn.contains(ev.target)) _plusClose();
    });
    document.addEventListener('keydown', function (ev) {   // Esc 关能力菜单
      if (ev.key === 'Escape' && !menu.hidden) { _plusClose(); ev.stopPropagation(); }
    });
  }

  // ── 会话侧栏（抽屉）：搜索 + 按日期分组；点哪条切哪条（连剧本一起切） ──
  function _railGroupOf(ts) {
    var d = new Date(); d.setHours(0, 0, 0, 0);
    var day0 = d.getTime();
    if (ts >= day0) return '今天';
    if (ts >= day0 - 86400000) return '昨天';
    if (ts >= day0 - 6 * 86400000) return '七日内';
    return '更早';
  }
  function _renderRail(query) {
    var list = ui.els && ui.els.raillist; if (!list) return;
    var l = listSessions(query).slice(0, 40), fk = _fileKey();
    if (!l.length) { list.innerHTML = '<div class="rail-empty">' + (query ? '没有与「' + esc(String(query).slice(0, 20)) + '」相符的会话。' : '还没有会话。发出第一句话以后，这里按日期列出会话，点一下就能切回去（连剧本一起切）。') + '</div>'; return; }
    var out = [], lastGrp = null;
    l.forEach(function (m) {
      if (!m || !m.id) return;
      var g = _railGroupOf(m.ts || 0);
      if (g !== lastGrp) { out.push('<div class="rail-sec">' + g + '</div>'); lastGrp = g; }
      var other = m.fileKey && m.fileKey !== fk;
      var noBody = !_sessBody(m.id);
      out.push('<div class="rail-item' + (m.id === ui._sessId ? ' on' : '') + '" data-sess="' + esc(m.id) + '" title="'
        + (other ? '点一下切到剧本「' + esc(m.fileLabel || '') + '」并接着这段会话' : '点一下接着这段会话') + (noBody ? '（正文因容量已清，只剩档卡）' : '') + '">'
        + '<div class="ri-req">' + esc(m.title || '（未命名会话）') + '</div>'
        + '<div class="ri-meta">' + (other ? '<span class="ri-file">⇄ ' + esc(m.fileLabel || '?') + '</span> · ' : (m.fileLabel ? esc(m.fileLabel) + ' · ' : ''))
        + (m.msgs || 0) + ' 条' + (m.kind ? ' · ' + esc(m.kind) : '') + '</div>'
        + '<button type="button" class="ri-fork" data-fork="' + esc(m.id) + '" title="分叉（复制一份分头演化）">' + _icon('branch', 13) + '</button>'
        + '<button type="button" class="ri-ren" data-ren="' + esc(m.id) + '" title="改名">' + _icon('pen', 13) + '</button>'
        + '<button type="button" class="ri-del" data-del="' + esc(m.id) + '" title="删除">×</button>'
        + '</div>');
    });
    list.innerHTML = out.join('');
  }
  function _railClose() { if (ui.els && ui.els.panel) ui.els.panel.classList.remove('railon'); if (ui.els && ui.els.railTg) ui.els.railTg.classList.remove('on'); }
  function _ensureRail() {
    if (!ui.els || !ui.els.railTg || ui._railBound) return;
    ui._railBound = true;
    ui.els.railTg.addEventListener('click', function () {
      var p = ui.els.panel;
      p.classList.toggle('railon');
      ui.els.railTg.classList.toggle('on', p.classList.contains('railon'));
      if (p.classList.contains('railon')) { _closeSheet(); _renderRail(ui._railQ || ''); var q = p.querySelector('#tm-aa-railq'); if (q) { try { q.focus(); } catch (e) {} } }
    });
    // 点抽屉外（遮罩）收起
    if (ui.els.body) ui.els.body.addEventListener('mousedown', function (ev) { if (ui.els.panel.classList.contains('railon') && ev.target === ui.els.body) _railClose(); });
    ui.els.panel.addEventListener('click', function (ev) {
      if (!ui.els.panel.classList.contains('railon')) return;
      if (ui.els.rail.contains(ev.target) || ui.els.railTg.contains(ev.target)) return;
      _railClose();
    }, true);
    var _rq = ui.els.panel.querySelector('#tm-aa-railq');
    if (_rq) {
      _rq.addEventListener('input', function () { ui._railQ = _rq.value.trim(); _renderRail(ui._railQ); });
      _rq.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') { ev.preventDefault(); _railClose(); } });
    }
    var _rn = ui.els.panel.querySelector('#tm-aa-railnew');
    if (_rn) _rn.addEventListener('click', function () { newConversation(); _renderRail(ui._railQ || ''); _railClose(); });
    var _rc = ui.els.panel.querySelector('#tm-aa-railclear');
    if (_rc) _rc.addEventListener('click', function () {
      if (!_rc._armed) { _rc._armed = true; _rc.textContent = '再点一下，清空全部会话'; setTimeout(function () { _rc._armed = false; _rc.textContent = '清空会话'; }, 3000); return; }
      _rc._armed = false; _rc.textContent = '清空会话';
      clearSessions(); _renderRail(ui._railQ || ''); setStatus('会话都清了（运行记录与版本说明不受影响）');
    });
    if (ui.els.raillist) ui.els.raillist.addEventListener('click', function (ev) {
      var del = ev.target && ev.target.closest ? ev.target.closest('.ri-del') : null;
      if (del) { deleteSession(del.getAttribute('data-del')); _renderRail(ui._railQ || ''); return; }
      var fk8 = ev.target && ev.target.closest ? ev.target.closest('.ri-fork') : null;
      if (fk8) { if (ui.running) { setStatus('国师还在忙，先停下再分叉'); return; } forkSession(fk8.getAttribute('data-fork')); _renderRail(ui._railQ || ''); return; }
      var ren = ev.target && ev.target.closest ? ev.target.closest('.ri-ren') : null;
      if (ren) {
        var rid = ren.getAttribute('data-ren'), row = ren.closest('.rail-item');
        var cur = (row && row.querySelector('.ri-req') || {}).textContent || '';
        var nv = null; try { nv = window.prompt('给这段会话改个名', cur); } catch (e) {}
        if (nv != null && renameSession(rid, nv)) { _renderRail(ui._railQ || ''); setStatus('改好了'); }
        return;
      }
      var it = ev.target && ev.target.closest ? ev.target.closest('.rail-item') : null;
      if (!it) return;
      switchSession(it.getAttribute('data-sess'));
      _renderRail(ui._railQ || '');
      _railClose();
    });
    ui._onSessionsChange = function () { if (ui.els.panel.classList.contains('railon')) _renderRail(ui._railQ || ''); _refreshEmptyRecent(); };   // 会话落盘/删除 → 侧栏活刷新
    ui._onHistoryChange = function () { if (ui.els.panel.classList.contains('railon')) _renderRail(ui._railQ || ''); };    // 兼容旧钩子(标记已应用等)
  }

  // ── API 连接 · 模型选择（模型徽即入口·owner 定案）：地址+Key → 真调该 API 的模型清单接口 → 下拉选定即用。
  //    存全游戏共用 tm_api·并 best-effort 镜像回游戏存档 P.ai(tm_P_lite/tm_P·与工坊 API 模态同构——
  //    loadEditorApiConfig 以「游戏存档有 key」为优先源·不镜像则此处新配置会被存档压掉)。 ──
  function _loadApiCfg() { try { return (AA && typeof AA.loadEditorApiConfig === 'function') ? AA.loadEditorApiConfig() : {}; } catch (e) { return {}; } }
  function _saveApiCfg(url, key, model, model2) {
    try {
      var cur = {}; try { cur = JSON.parse(localStorage.getItem('tm_api') || '{}') || {}; } catch (e0) {}
      cur.url = url; cur.key = key; if (model) cur.model = model; cur.model2 = model2 || '';
      localStorage.setItem('tm_api', JSON.stringify(cur));
      ['tm_P_lite', 'tm_P'].forEach(function (k) {
        try {
          var o = JSON.parse(localStorage.getItem(k) || 'null');
          if (o && o.ai) { o.ai.url = url; o.ai.key = key; if (model) o.ai.model = model; o.ai.model2 = model2 || ''; localStorage.setItem(k, JSON.stringify(o)); }
        } catch (e1) {}
      });
      return true;
    } catch (e) { return false; }
  }
  // 检测模型清单：OpenAI 兼容(含 DeepSeek/一切中转) GET {base}/models · Anthropic /v1/models · Gemini /v1beta/models
  function _detectModels(url, key) {
    url = String(url || '').replace(/\/+$/, '');
    var gemini = /generativelanguage\.googleapis\.com/i.test(url) && !/\/v1beta\/openai\//i.test(url);
    var anthropic = !gemini && /api\.anthropic\.com/i.test(url);
    var endpoint, headers = {};
    if (gemini) { endpoint = url.replace(/\/v1beta.*$/i, '') + '/v1beta/models?key=' + encodeURIComponent(key || ''); }
    else if (anthropic) { endpoint = url.replace(/\/v1$/i, '') + '/v1/models'; headers = { 'x-api-key': key || '', 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }; }
    else {
      var base = url.replace(/\/chat\/completions\/?$/i, '');
      if (!/\/v\d+(beta)?$/i.test(base)) base += '/v1';
      endpoint = base + '/models'; headers = { 'Authorization': 'Bearer ' + (key || '') };
    }
    return fetch(endpoint, { headers: headers }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error('HTTP ' + r.status + '：' + String(t).slice(0, 120)); });
      return r.json();
    }).then(function (d) {
      var ids;
      if (gemini) ids = ((d && d.models) || []).map(function (m) { return String((m && m.name) || '').replace(/^models\//, ''); });
      else ids = (((d && d.data) || (d && d.models)) || []).map(function (m) { return m && (m.id || m.name); });
      ids = (ids || []).filter(Boolean).map(String); ids.sort();
      if (!ids.length) throw new Error('这个 API 没给出模型清单，可在下面手填模型名再保存');
      return ids;
    });
  }
  function _refreshModelChip() {
    var el = ui.els && ui.els.model; if (!el) return;
    var cfg = _loadApiCfg();
    var ok = !!(cfg.key && cfg.url);
    var label = ok ? (String(cfg.model || '').slice(0, 40) || '选择模型') : '配置 API';
    el.innerHTML = '<span class="mc-tx">' + esc(label) + '</span>' + _icon('chevron', 11);
    el.title = ok ? ('连接与模型：' + label + (cfg.model2 ? '（杂活走 ' + cfg.model2 + '）' : '')) : '还没配 API，点这里填地址和 Key';
    el.classList.toggle('warn', !ok);
  }
  function _modelPopClose() { if (ui.els && ui.els.modelpop) ui.els.modelpop.hidden = true; }

  // ── S2 · 附件（Claude 桌面端式）：曲别针/拖拽入面板/输入框粘贴截图 → 签行预览 → 发送时
  //    文本文件内联为【附件】上下文·图片走视觉通道（user 消息 images[]·主模型须支持视觉）。 ──
  var _ATT_TEXT_RE = /\.(txt|md|json|csv|tsv|js|yml|yaml|xml|html?)$/i;
  var _ATT_TEXT_MAX_BYTES = 128 * 1024 * 1024;
  var _ATT_TEXT_INLINE_CHARS = 12000;
  function _attState() {
    if (!ui._att) ui._att = { files: [], images: [], pending: 0, pendingNames: Object.create(null) };
    if (!ui._att.pendingNames) ui._att.pendingNames = Object.create(null);
    return ui._att;
  }
  function _mergeTextAttachments(previous, current) {
    var out = [], byName = Object.create(null);
    (Array.isArray(previous) ? previous : []).concat(Array.isArray(current) ? current : []).forEach(function (f) {
      if (!f || !f.name || typeof f.text !== 'string') return;
      var clean = { name: String(f.name), text: f.text };
      if (byName[clean.name] != null) out[byName[clean.name]] = clean;
      else { byName[clean.name] = out.length; out.push(clean); }
    });
    return out;
  }
  function _renderAttach() {
    var box = ui.els && ui.els.attach; if (!box) return;
    var a = _attState();
    if (!a.files.length && !a.images.length && !a.pending) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    box.innerHTML = a.images.map(function (u, i) {
      return '<span class="att-chip att-img"><img src="' + u + '" alt="附图"><button type="button" class="att-x" data-k="img" data-i="' + i + '" title="移除">×</button></span>';
    }).join('') + a.files.map(function (f, i) {
      return '<span class="att-chip"><span class="att-ic">' + _icon('book') + '</span><span class="att-nm" title="' + esc(f.name) + '">' + esc(f.name) + '</span><span class="att-sz">' + Math.ceil(f.text.length / 1000) + 'k字</span><button type="button" class="att-x" data-k="file" data-i="' + i + '" title="移除">×</button></span>';
    }).join('') + (a.pending ? '<span class="att-chip att-pending">附件读取中…</span>' : '');
  }
  function _ingestFiles(list) {
    var a = _attState();
    Array.prototype.forEach.call(list || [], function (f) {
      if (!f) return;
      if (/^image\//.test(f.type)) {
        if (a.images.length >= 3) { setStatus('图片最多 3 张（已忽略「' + f.name + '」）'); return; }
        if (f.size > 4 * 1024 * 1024) { setStatus('图片过大（>4MB）：' + f.name + ' 已忽略·请截小一点'); return; }
        var rd = new FileReader(); a.pending++;
        rd.onload = function () { a.images.push(String(rd.result)); };
        rd.onerror = function () { setStatus('图片读取失败：' + f.name); };
        rd.onloadend = function () { a.pending = Math.max(0, a.pending - 1); _renderAttach(); };
        _renderAttach();
        rd.readAsDataURL(f);
      } else if (_ATT_TEXT_RE.test(f.name) || /^text\//.test(f.type) || f.type === 'application/json') {
        if (a.files.length + Object.keys(a.pendingNames || {}).length >= 4) { setStatus('文本附件最多 4 个（已忽略「' + f.name + '」）'); return; }
        if (a.files.some(function (x) { return x && x.name === f.name; }) || (a.pendingNames && a.pendingNames[f.name])) { setStatus('附件名重复，已忽略「' + f.name + '」·请先重命名后再附加'); return; }
        if (f.size > _ATT_TEXT_MAX_BYTES) { setStatus('文件过大（>128MB）：' + f.name + ' 已忽略'); return; }
        var rt = new FileReader(); a.pending++; a.pendingNames[f.name] = true;
        rt.onload = function () { a.files.push({ name: f.name, text: String(rt.result || '') }); };
        rt.onerror = function () { setStatus('文本附件读取失败：' + f.name); };
        rt.onloadend = function () { delete a.pendingNames[f.name]; a.pending = Math.max(0, a.pending - 1); _renderAttach(); };
        _renderAttach();
        rt.readAsText(f);
      } else setStatus('暂不支持该类型附件：' + f.name + '（支持文本类与图片）');
    });
  }
  function _attachPrefix() {   // 发送时把文本附件内联进需求（完整正文保留在 readAttachment 分段工具）
    var a = _attState();
    if (!a.files.length) return '';
    return a.files.map(function (f) {
      var head = f.text.slice(0, _ATT_TEXT_INLINE_CHARS);
      return '\n\n【附件 · ' + f.name + ' · 共' + f.text.length + '字】\n' + head + (f.text.length > head.length ? '\n（正文未截断，使用 readAttachment(name="' + f.name + '", offset=' + head.length + ') 继续读取）' : '');
    }).join('') + '\n\n（以上为玩家提供的参考附件·需完整处理时必须分段读完）';
  }
  function _takeTextAttachments() { return _mergeTextAttachments(ui._attachmentCarry, _attState().files); }
  function _takeImages() { var a = _attState(); var im = a.images.slice(0, 3); return im.length ? im : null; }
  function _clearAttach() { ui._att = { files: [], images: [], pending: 0, pendingNames: Object.create(null) }; _renderAttach(); }
  function _ensureAttach() {
    if (!ui.els || ui._attBound) return;
    ui._attBound = true;
    var btn = ui.els.panel.querySelector('#tm-aa-attach-btn'), fin = ui.els.panel.querySelector('#tm-aa-file');
    if (btn && fin) {
      btn.addEventListener('click', function () { fin.click(); });
      fin.addEventListener('change', function () { _ingestFiles(fin.files); fin.value = ''; });
    }
    if (ui.els.attach) ui.els.attach.addEventListener('click', function (ev) {
      var x = ev.target && ev.target.closest ? ev.target.closest('.att-x') : null;
      if (!x) return;
      var a = _attState();
      if (x.getAttribute('data-k') === 'img') a.images.splice(+x.getAttribute('data-i'), 1); else a.files.splice(+x.getAttribute('data-i'), 1);
      _renderAttach();
    });
    var p = ui.els.panel;
    p.addEventListener('dragover', function (ev) { ev.preventDefault(); p.classList.add('tm-aa-drag'); });
    p.addEventListener('dragleave', function (ev) { if (ev.target === p) p.classList.remove('tm-aa-drag'); });
    p.addEventListener('drop', function (ev) {
      ev.preventDefault(); p.classList.remove('tm-aa-drag');
      if (ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files.length) { _ingestFiles(ev.dataTransfer.files); setStatus('附件已加入（发送时随需求一起交给国师）'); }
    });
    if (ui.els.req) ui.els.req.addEventListener('paste', function (ev) {
      var fs = ev.clipboardData && ev.clipboardData.files;
      if (fs && fs.length) { ev.preventDefault(); _ingestFiles(fs); setStatus('截图已加入附件（发送时走视觉通道·需主模型支持）'); }
    });
  }

  // ── 权限模式（owner 点名的缺失件·CC permission modes 对照）：问策=Plan(只读出计划)·共审=默认(diff 审后应用)·
  //    放行=Accept Edits(校验通过自动应用)。持久 tm_aa_perm·映射到既有引擎旗标(planMode/autonomy/allowDestructive)。 ──
  var PERM_KEY = 'tm_aa_perm';
  var _PM_LABEL = { plan: '问策', review: '共审', auto: '放行' };
  function _loadPerm() {
    var p = { mode: 'review', allowDestructive: true };
    try { var s = JSON.parse(localStorage.getItem(PERM_KEY) || 'null'); if (s && _PM_LABEL[s.mode]) { p.mode = s.mode; p.allowDestructive = s.allowDestructive !== false; } } catch (e) {}
    return p;
  }
  function _applyPerm(p) {
    ui.planMode = p.mode === 'plan';
    ui.autonomy = p.mode === 'auto' ? 'auto' : 'review';
    ui.allowDestructive = p.allowDestructive !== false;
    try { localStorage.setItem(PERM_KEY, JSON.stringify({ mode: p.mode, allowDestructive: p.allowDestructive !== false })); } catch (e) {}
    _refreshPermChip();
  }
  var _PERM_TIP = {
    plan: '问策：国师只读勘察、出计划，你批了才动剧本',
    review: '共审：国师起草改动，你过目后再应用',
    auto: '放行：做完且没带来新问题，就直接应用到剧本'
  };
  function _refreshPermChip() {
    var el = ui.els && ui.els.perm; if (!el) return;
    var p = _loadPerm();
    el.innerHTML = '<span class="dot"></span>' + esc(_PM_LABEL[p.mode] || '共审');
    el.title = _PERM_TIP[p.mode] + '（Shift+Tab 轮换）';
    el.classList.toggle('pm-auto', p.mode === 'auto');
    el.classList.toggle('pm-plan', p.mode === 'plan');
    if (ui.els.permpop) {
      Array.prototype.forEach.call(ui.els.permpop.querySelectorAll('.tm-aa-pm'), function (b) { b.classList.toggle('on', b.getAttribute('data-pm') === p.mode); });
      var dg = ui.els.permpop.querySelector('#tm-aa-perm-danger'); if (dg) dg.checked = p.allowDestructive !== false;
    }
  }
  function _permPopClose() { if (ui.els && ui.els.permpop) ui.els.permpop.hidden = true; }
  function _ensurePermPop() {
    var btn = ui.els && ui.els.perm, pop = ui.els && ui.els.permpop;
    if (!btn || !pop || ui._permBound) return;
    ui._permBound = true;
    _applyPerm(_loadPerm());   // 启动即按持久模式布防（含引擎旗标）
    btn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      pop.hidden = !pop.hidden;
      if (!pop.hidden) { _plusClose(); _modelPopClose(); _refreshPermChip(); _popPlace(pop); }
    });
    pop.addEventListener('click', function (ev) {
      var b = ev.target && ev.target.closest ? ev.target.closest('.tm-aa-pm') : null;
      if (!b) return;
      var p = _loadPerm(); p.mode = b.getAttribute('data-pm');
      _applyPerm(p); _permPopClose();
      setStatus(_PERM_TIP[p.mode]);
    });
    var dg = pop.querySelector('#tm-aa-perm-danger');
    if (dg) dg.addEventListener('change', function () { var p = _loadPerm(); p.allowDestructive = !!dg.checked; _applyPerm(p); setStatus(dg.checked ? '允许删除、联动改名这类写入' : '删除类写入会被拦下，国师只能增改'); });
    document.addEventListener('click', function (ev) { if (!pop.hidden && !pop.contains(ev.target) && ev.target !== btn) _permPopClose(); });
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && !pop.hidden) { _permPopClose(); ev.stopPropagation(); } });
    _refreshPermChip();
  }
  function _ensureModelPop() {
    var btn = ui.els && ui.els.model, pop = ui.els && ui.els.modelpop;
    if (!btn || !pop || ui._modelPopBound) return;
    ui._modelPopBound = true;
    var q = function (s) { return pop.querySelector(s); };
    var inUrl = q('#tm-aa-api-url'), inKey = q('#tm-aa-api-key'), sel = q('#tm-aa-api-model'), sel2 = q('#tm-aa-api-model2'), st = q('#tm-aa-api-st');
    function _fill2(ids, cur2) {   // 次要模型下拉:首项恒「不用」·清单同主
      sel2.innerHTML = '<option value="">不用 · 都走主模型</option>';
      (ids || []).forEach(function (id) { var o = document.createElement('option'); o.value = id; o.textContent = id; sel2.appendChild(o); });
      sel2.value = (cur2 && (ids || []).indexOf(cur2) >= 0) ? cur2 : (cur2 || '');
      if (cur2 && sel2.value !== cur2) { var ox = document.createElement('option'); ox.value = cur2; ox.textContent = cur2 + '（当前）'; sel2.appendChild(ox); sel2.value = cur2; }
    }
    function _seed() {
      var cfg = _loadApiCfg();
      inUrl.value = cfg.url || ''; inKey.value = cfg.key || '';
      sel.innerHTML = '';
      if (cfg.model) { var o0 = document.createElement('option'); o0.value = cfg.model; o0.textContent = cfg.model + '（当前）'; sel.appendChild(o0); }
      _fill2([], cfg.model2 || '');
      var mc0 = q('#tm-aa-api-model-custom'); if (mc0) mc0.value = '';
      st.textContent = '';
    }
    btn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      pop.hidden = !pop.hidden;
      if (!pop.hidden) { _plusClose(); _permPopClose(); _seed(); _popPlace(pop); try { inUrl.focus(); } catch (eF) {} }
    });
    var tb = q('#tm-aa-api-test');
    if (tb) tb.addEventListener('click', function () {
      if (!AA || typeof AA.testConnection !== 'function') { st.textContent = '国师核心没载入'; return; }
      st.textContent = '测试中…（先存当前填的再测）'; tb.disabled = true;
      var u0 = inUrl.value.trim(), k0 = inKey.value.trim(), m0 = ((q('#tm-aa-api-model-custom') || {}).value || '').trim() || (sel.value || '').trim();
      if (u0 && k0) _saveApiCfg(u0, k0, m0, (sel2.value || '').trim());
      Promise.resolve().then(function () { return AA.testConnection(); }).then(function (r) {
        st.textContent = (r && r.ok ? '✓ ' : '✗ ') + ((r && r.detail) || '') + (r && r.ok && r.model ? '（' + r.model + '）' : '');
        _refreshModelChip();
      }, function (e) { st.textContent = '✗ ' + ((e && e.message) || e); }).then(function () { tb.disabled = false; });
    });
    q('#tm-aa-api-detect').addEventListener('click', function () {
      var u = inUrl.value.trim(), k = inKey.value.trim();
      if (!u) { st.textContent = '先填 API 地址'; return; }
      st.textContent = '检测中…';
      _detectModels(u, k).then(function (ids) {
        var cur = sel.value || _loadApiCfg().model || '';
        var cur2 = sel2.value || _loadApiCfg().model2 || '';
        sel.innerHTML = '';
        ids.slice(0, 300).forEach(function (id) { var o = document.createElement('option'); o.value = id; o.textContent = id; sel.appendChild(o); });
        if (cur && ids.indexOf(cur) >= 0) sel.value = cur;
        _fill2(ids.slice(0, 300), cur2);
        st.textContent = '✓ 检测到 ' + ids.length + ' 个模型';
      }).catch(function (e) { st.textContent = '✗ ' + ((e && e.message) || e); });
    });
    q('#tm-aa-api-save').addEventListener('click', function () {
      var mc = q('#tm-aa-api-model-custom');
      var u = inUrl.value.trim(), k = inKey.value.trim(), m = ((mc && mc.value) || '').trim() || (sel.value || '').trim(), m2 = (sel2.value || '').trim();
      if (!u || !k) { st.textContent = 'API 地址与 Key 都要填'; return; }
      if (_saveApiCfg(u, k, m, m2)) {
        _refreshModelChip(); _modelPopClose();
        setStatus('连接已保存（全游戏共用）' + (m ? '，主模型 ' + m : '') + (m2 ? '，杂活走 ' + m2 : '') + '，下一次就用');
      } else st.textContent = '保存失败（localStorage 不可用）';
    });
    document.addEventListener('click', function (ev) { if (!pop.hidden && !pop.contains(ev.target) && ev.target !== btn) _modelPopClose(); });
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && !pop.hidden) { _modelPopClose(); ev.stopPropagation(); } });
    _refreshModelChip();
  }

  function setStatus(t) { if (ui.els) ui.els.status.textContent = t || ''; }

  // 用户主动写操作必须先确认底层持久化成功，再更新按钮或显示成功。
  function _reportUserWriteFailure(error, operation, target) {
    var err = error && typeof error === 'object' ? error : new Error(String(error || '未知错误'));
    var reported = false;
    try {
      if (global.TM && global.TM.errors && typeof global.TM.errors.capture === 'function') {
        global.TM.errors.capture(err, 'authoring-agent.user-write', { operation: operation || 'unknown', target: target || '' });
        reported = true;
      }
    } catch (captureError) {
      if (global.console && typeof global.console.error === 'function') global.console.error('[authoring-agent] 写失败诊断记录异常', captureError);
    }
    if (!reported && global.console && typeof global.console.error === 'function') {
      global.console.error('[authoring-agent] 用户写操作失败', operation || 'unknown', target || '', err);
    }
    return err;
  }
  function _commitUserWrite(opts) {
    opts = opts || {};
    var result;
    try {
      if (typeof opts.run !== 'function') throw new Error('缺少写操作处理器');
      result = opts.run();
      if (!(result === true || (result && result.ok === true))) {
        var rejected = new Error(String((result && (result.error || result.reason || result.code)) || '操作未完成'));
        rejected.code = (result && result.code) || 'authoring-user-write-failed';
        throw rejected;
      }
    } catch (error) {
      var err = _reportUserWriteFailure(error, opts.operation, opts.target);
      setStatus((opts.failureLabel || '操作') + '失败：' + String((err && err.message) || err));
      return false;
    }
    if (typeof opts.onSuccess === 'function') opts.onSuccess(result);
    if (opts.successMessage) setStatus(typeof opts.successMessage === 'function' ? opts.successMessage(result) : opts.successMessage);
    return true;
  }

  // 方向I · 可观测性：运行中实时 token / 耗时 / 轮次计量条。
  function _fmtTok(n) { n = n || 0; return n >= 10000 ? (Math.round(n / 1000) / 10) + ' 万' : (n >= 1000 ? (Math.round(n / 100) / 10) + 'k' : String(n)); }
  function _fmtDur(sec) { sec = Math.max(0, Math.round(sec || 0)); return sec >= 60 ? Math.floor(sec / 60) + ' 分 ' + (sec % 60) + ' 秒' : sec + ' 秒'; }
  function _renderMeter(done) {
    if (!ui.els || !ui.els.meter) return;
    if (!ui._runStart || done) { ui.els.meter.textContent = ''; ui.els.meter.style.color = ''; return; }   // 只在运行中显示（收尾由状态行汇总）
    var sec = (Date.now() - ui._runStart) / 1000;
    var tok = ui._lastTokens || 0, iter = ui._lastIter || 0;
    // 上下文余量：预算越吃越紧时看得见（≤30% 着色；撞线前引擎会自动压缩前情）
    var left = (ui._budget && tok) ? Math.max(0, 100 - Math.round(tok * 100 / ui._budget)) : null;
    ui.els.meter.textContent = _fmtDur(sec) + (iter ? ' · 第 ' + iter + ' 轮' : '') + (tok ? ' · 约 ' + _fmtTok(tok) + ' token' : '') + (left != null && left <= 60 ? ' · 上下文余 ' + left + '%' : '');
    ui.els.meter.style.color = (left != null && left <= 15) ? 'var(--bad)' : ((left != null && left <= 30) ? 'var(--warn)' : '');
  }
  // 收尾状态行：说人话（改了几处 / 用了多久 / 多少 token）
  function _doneStatus(res, head) {
    var n = ui.draft ? (ui._lastDiffs || []).length : 0, fx = (ui._pendingSideEffects || []).length;
    var sec = ui._lastRunMs ? ui._lastRunMs / 1000 : 0;
    var tail = [];
    if (sec) tail.push('用时 ' + _fmtDur(sec));
    if (res && res.tokensUsed) tail.push('约 ' + _fmtTok(res.tokensUsed) + ' token');
    var body = head || '完成了';
    if (n) body += '，' + n + ' 处改动等你过目';
    else if (fx) body += '，' + fx + ' 条记忆/技能等你批准';
    else if (res && res.completion && res.completion.status === 'unchanged') body += '，这一轮没改剧本';
    return body + (tail.length ? ' · ' + tail.join(' · ') : '');
  }
  // 运行中状态行：当前在做哪一步（中文），不再报「第 N 轮」（右边的计量已经有轮数）
  function _stepStatus(step, prefix) {
    try { setStatus((prefix || '') + (__aaU._friendlyStep ? __aaU._friendlyStep(step) : (step && step.name) || '')); } catch (e) {}
  }
  // 还有没应用的改动时，审阅/问答/讲解/编排/会审会另起草稿把它们扔掉：先提醒，再点一次才照做
  function _guardPendingDraft(what) {
    if (ui._resumeNext && ui._recovery) { ui._pendingGuard = null; return true; }   // 续做没做完的：接着用这份草稿，不扔
    var n = (ui.draft && !ui._pendingPlan) ? (ui._lastDiffs || []).length : 0;
    if (!n) { ui._pendingGuard = null; return true; }
    if (ui._pendingGuard === what) { ui._pendingGuard = null; return true; }
    ui._pendingGuard = what;
    setStatus('还有 ' + n + ' 处改动没应用：' + what + '会把它们扔掉。先应用或放弃；要直接' + what + '，再点一次');
    _refreshPending();
    return false;
  }
  // 回复卡跟随：卡不高就贴底；卡比可视区高就停在卡头，让人从头读
  function _followReply() {
    var wrap = ui.els && ui.els.logWrap, card = ui._reply;
    if (!wrap || !card || !card.isConnected || !ui._logPinned) return;
    if (card.offsetHeight > wrap.clientHeight * 0.85) { ui._logPinned = false; wrap.scrollTop = Math.max(0, card.offsetTop - 10); }
    else wrap.scrollTop = wrap.scrollHeight;
    ui._autoScrollAt = wrap.scrollTop;
  }
  function _goIdleFace() {
    var g = ui.els && ui.els.go; if (!g) return;
    g.classList.remove('stopbtn');
    if (ui._criticsArmed) { g.classList.add('armed'); g.textContent = '会审'; g.title = '三堂会审：拟稿 → 史官查史实＋谏官批平衡 → 据谏修订'; return; }
    if (ui._autoModeArmed) { g.classList.add('armed'); g.textContent = '智选'; g.title = '由国师为这一次挑做法：直接改 / 先计划 / 分解编排 / 三堂会审'; return; }
    g.classList.remove('armed'); g.innerHTML = _icon('send', 17); g.title = '发送（Enter）· 换行（Shift+Enter）';
  }
  // 集中管理运行态：切换 running/禁用生成键 + 启停实时计量
  function setRunning(on) {
    ui.running = on;
    ui._stopping = false;
    if (ui.els && ui.els.panel) ui.els.panel.classList.toggle('tm-aa-running', on);
    if (on) { _plusClose(); _permPopClose(); _modelPopClose(); ui._runOutcome = null; _lvClear(true); ui._liveSaid = false; ui._webOnce = {}; }
    if (on && ui.els && ui.els.empty) { ui.els.empty.style.display = 'none'; if (ui.els.body) ui.els.body.classList.remove('tm-aa-blank'); }
    // 运行中发送键变成「停止」（不禁用）；收尾恢复
    if (ui.els && ui.els.go) {
      ui.els.go.disabled = false;
      ui.els.go.setAttribute('aria-label', on ? '停止' : '发送');
      if (on) { ui.els.go.classList.remove('armed'); ui.els.go.classList.add('stopbtn'); ui.els.go.innerHTML = _icon('stop', 16); ui.els.go.title = '停下（这一步收完就停，不施没做完的改动）· Esc'; }
      else _goIdleFace();
    }
    if (!on) {   // 收尾：活动行移除；「思考与查阅」折起并定格
      ui._lastRunMs = ui._runStart ? Date.now() - ui._runStart : 0;
      setTimeout(_maybeNotify, 0);   // 页面在后台时跑完弹系统通知（同一拍里出错/停止会先记下结局）
      _lvClear(true);
      _removeLive();
      if (ui._thinkEl && ui._thinkEl.isConnected) {
        ui._thinkEl.open = false;
        ui._thinkEl.classList.remove('live');
        var _lbl = ui._thinkEl.querySelector('.tk-label'), _mt = ui._thinkEl.querySelector('.tk-meta');
        if (_lbl && ui._thinkCount) _lbl.textContent = '思考与查阅 · ' + ui._thinkCount + ' 步';
        if (_mt && ui._lastRunMs) _mt.textContent = '· ' + _fmtDur(ui._lastRunMs / 1000);
      }
    }
    // 运行中输入框仍可用：回车 = 插话（排队，做完手头这一步就看）
    if (ui.els && ui.els.req) ui.els.req.placeholder = on ? '国师在忙。这时说的话会排进去，他做完手头这一步就看（Esc 停下）' : (ui._criticsArmed || ui._autoModeArmed ? ui.els.req.placeholder : _REQ_PLACEHOLDER);
    if (on) {
      ui._runStart = Date.now(); ui._lastTokens = 0; ui._lastIter = 0;
      if (ui._meterTimer) clearInterval(ui._meterTimer);
      ui._meterTimer = setInterval(function() { _renderMeter(false); }, 500);
      _renderMeter(false);
    } else {
      if (ui._meterTimer) { clearInterval(ui._meterTimer); ui._meterTimer = null; }
      _renderMeter(true);
      _refreshPending();
    }
  }
  // 状态行旁的「待审 N 处」：还有没应用的改动时常亮，点一下滚到那张卡
  function _refreshPending() {
    var el = ui.els && ui.els.pending; if (!el) return;
    var n = ui.draft ? (ui._lastDiffs || []).length - ((ui._diffRejected && ui._diffRejected.size) || 0) : 0;
    var show = !!(ui.draft && (ui._lastDiffs || []).length && ui._reply && !ui._pendingPlan);
    el.hidden = !show;
    if (show) el.textContent = '待审 ' + Math.max(0, n) + ' 处';
  }
  function _scrollToPending() {
    var c = ui._reply; if (!c) return;
    try { var d = c.querySelector('.tm-aa-diff') || c; d.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {}
  }

  // ═══ 改动账（S2）：应用后记一笔；回复卡与改动史里可撤销（反向差异·连带之后几笔）、可恢复 ═══
  function Ledger() { return global.TM && global.TM.AuthoringLedger; }
  function _fmtWhen(ts) {
    try {
      var d = new Date(ts), now = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
      var hm = p(d.getHours()) + ':' + p(d.getMinutes());
      if (d.toDateString() === now.toDateString()) return '今天 ' + hm;
      var y = new Date(now); y.setDate(now.getDate() - 1);
      if (d.toDateString() === y.toDateString()) return '昨天 ' + hm;
      return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + hm;
    } catch (e) { return ''; }
  }
  function _entryTitle(e) {
    var t = String(e.request || '').replace(/\s+/g, ' ').trim();
    if (!t) t = String(e.summary || '').replace(/[#*`>\-]/g, '').replace(/\s+/g, ' ').trim();
    return (t || '国师的改动').slice(0, 60);
  }
  function _entryNames(e, max) {
    var C = __aaU._COLL_CN || {};
    return (e.names || []).slice(0, max || 6).map(function (n) {
      var opTx = n.op === 'add' ? '新增' : (n.op === 'rm' ? '删除' : '修改');
      return '<span class="lg-chip ' + n.op + '">' + opTx + ' ' + esc((C[n.top] || n.top) + (n.name ? '「' + n.name + '」' : '')) + '</span>';
    }).join('') + ((e.names || []).length > (max || 6) ? '<span class="lg-chip">…还有 ' + ((e.names || []).length - (max || 6)) + ' 项</span>' : '');
  }
  function _paintAppliedTag(card, e) {
    var tag = card && card.querySelector('.reply-tag'); if (!tag || !e) return;
    card.setAttribute('data-ledger', e.id);
    if (e.undone) {
      card.classList.add('undone');
      tag.innerHTML = '<span>这次应用已撤销（' + esc(_fmtWhen(e.undoneAt || Date.now())) + '）</span><button type="button" class="rt-act" data-lg-redo="' + esc(e.id) + '">恢复</button>';
    } else {
      card.classList.remove('undone');
      tag.innerHTML = _icon('check', 13) + '<span>已应用 ' + (e.total || (e.diffs || []).length) + ' 处</span><button type="button" class="rt-act" data-lg-undo="' + esc(e.id) + '" title="只回退国师改过的这几处；你别处的手工编辑不动">撤销</button>';
    }
  }
  ui._onApplied = function (card, tag, info) {
    var L = Ledger(); if (!L || !info || !(info.diffs || []).length) return;
    var sm = L.summarize(info.diffs, info.after, info.before);
    var entry = { fileKey: _fileKey(), fileLabel: _fileLabel(), sessId: ui._sessId || null,
      request: String(info.request || '').slice(0, 300), summary: String(info.summary || '').slice(0, 600),
      diffs: L.strip(info.diffs), counts: sm.counts, names: sm.names, total: sm.total };
    L.record(entry).then(function (e) { _paintAppliedTag(card, e); _refreshLedgerSheet(); }, function () {});
  };
  function _refreshLedgerSheet() {
    var p = ui.els && ui.els.panel; if (!p || ui._sheetKind !== 'ledger') return;
    var el = p.querySelector('.tm-aa-sheet'); if (el && !el.hidden) _renderLedger(el);
  }
  function _repaintLedgerTags(entries) {
    if (!ui.els || !ui.els.log) return;
    (entries || []).forEach(function (e) {
      var card = ui.els.log.querySelector('.tm-aa-reply[data-ledger="' + e.id + '"]');
      if (card) _paintAppliedTag(card, e);
    });
  }
  // 确认框：连带哪几笔、哪几处冲突；按钮执行或作罢
  function _confirmBox(host, html, okLabel, onOk, danger) {
    if (!host) return;
    var box = host.querySelector(':scope > .lg-confirm');
    if (!box) { box = document.createElement('div'); box.className = 'lg-confirm'; host.appendChild(box); }
    box.innerHTML = '<div class="lg-cf-msg">' + html + '</div><div class="lg-cf-acts"><button type="button" class="tm-aa-btn' + (danger ? ' danger' : ' primary') + '" data-cf="ok">' + esc(okLabel) + '</button><button type="button" class="tm-aa-btn ghost" data-cf="no">算了</button></div>';
    box.onclick = function (ev) {
      var b = ev.target.closest && ev.target.closest('[data-cf]'); if (!b) return;
      ev.stopPropagation();
      if (b.getAttribute('data-cf') === 'ok') { box.remove(); onOk(); } else box.remove();
    };
    try { box.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) {}
  }
  function _conflictHtml(conflicts) {
    var fp = __aaU._friendlyPath || function (x) { return x; };
    return '<ul class="lg-cf-list">' + (conflicts || []).slice(0, 6).map(function (c) { return '<li>' + esc(fp(c.path)) + '</li>'; }).join('') + ((conflicts || []).length > 6 ? '<li>…还有 ' + (conflicts.length - 6) + ' 处</li>' : '') + '</ul>';
  }
  // 撤销、恢复以后记一句，下次发送时告诉国师（它的对话里还记着那些改动）
  function _noteState(text) { ui._stateNotes = (ui._stateNotes || []).concat([text]).slice(-12); }
  function _undoEntry(id, opts) {
    opts = opts || {};
    if (ui.running) { setStatus('国师还在忙，先停下再撤销'); return; }
    if (ui.draft && (ui._lastDiffs || []).length && !ui._pendingPlan) { setStatus('眼下还有没应用的改动：先应用或放弃它，再撤销以前的'); return; }
    var L = Ledger(); if (!L) { setStatus('改动账没载入'); return; }
    L.list(_fileKey(), _fileLabel()).then(function (lst) {
      var all = lst.mine.concat(lst.kin);
      var target = all.filter(function (x) { return x.id === id; })[0];
      if (!target) { setStatus('这笔账找不到了'); return; }
      if (target.undone) { setStatus('这次应用已经撤销过了'); return; }
      var pool = all.filter(function (x) { return x.fileKey === target.fileKey; });
      var chain = L.chainFor(pool, target);
      var n = chain.reduce(function (s, e) { return s + (e.total || (e.diffs || []).length); }, 0);
      if (!opts.confirmed) {
        var msg = chain.length > 1
          ? '撤销这一次，会连带撤销它之后的 ' + (chain.length - 1) + ' 次应用（一共 ' + n + ' 处），不然会留下新旧混着的半截：<ul class="lg-cf-list">' + chain.map(function (e) { return '<li>' + esc(_fmtWhen(e.ts)) + ' · ' + esc(_entryTitle(e)) + '</li>'; }).join('') + '</ul>'
          : '撤销这次应用的 ' + n + ' 处？只回退国师改过的地方，你别处的手工编辑不动。';
        _confirmBox(opts.host, msg, chain.length > 1 ? '都撤销' : '撤销', function () { _undoEntry(id, Object.assign({}, opts, { confirmed: true })); });
        return;
      }
      var res;
      try { res = L.applyChain(ui.adapter.getScenario(), chain, { force: !!opts.force }); }
      catch (e) { setStatus('没撤成：' + ((e && e.message) || e)); return; }
      if (!res.ok) {
        _confirmBox(opts.host, '这几处在国师改完之后又被手工改过，撤销会把它们冲回改前：' + _conflictHtml(res.conflicts), '仍要撤销（覆盖这几处）', function () { _undoEntry(id, Object.assign({}, opts, { confirmed: true, force: true })); }, true);
        setStatus('有 ' + res.conflicts.length + ' 处后来被手工改过，等你定');
        return;
      }
      try { _commitCurrent(res.scenario, _captureOwner()); }
      catch (e2) { setStatus('没撤成：' + ((e2 && e2.message) || e2)); return; }
      var now = Date.now();
      Promise.all(chain.map(function (e) { return L.update(e.id, { undone: true, undoneAt: now }); })).then(function (upd) {
        _repaintLedgerTags(upd.filter(Boolean)); _refreshLedgerSheet();
      });
      try { var app = global.TM_SCENARIO_EDITOR_RESET_APP; var first = chain[chain.length - 1].diffs[0]; if (first && app && typeof app.revealPath === 'function') app.revealPath(first.path); } catch (e3) {}
      ui._exemplarsCache = null;
      _noteState('在改动史里撤销了「' + _entryTitle(target) + '」那次应用' + (chain.length > 1 ? '（连带它之后的 ' + (chain.length - 1) + ' 次）' : '') + '，共 ' + n + ' 处回到了改前');
      setStatus('撤销了 ' + (chain.length > 1 ? chain.length + ' 次应用、' : '') + n + ' 处' + (opts.force ? '（覆盖了后来手改的几处）' : '') + '。想要回来，在改动史里点「恢复」');
    });
  }
  function _redoEntry(id, opts) {
    opts = opts || {};
    if (ui.running) { setStatus('国师还在忙，先停下再恢复'); return; }
    if (ui.draft && (ui._lastDiffs || []).length && !ui._pendingPlan) { setStatus('眼下还有没应用的改动：先应用或放弃它'); return; }
    var L = Ledger(); if (!L) return;
    L.list(_fileKey(), _fileLabel()).then(function (lst) {
      var target = lst.mine.concat(lst.kin).filter(function (x) { return x.id === id; })[0];
      if (!target || !target.undone) { setStatus('这笔账不用恢复'); return; }
      var res;
      try { res = L.redoChain(ui.adapter.getScenario(), [target], { force: !!opts.force }); }
      catch (e) { setStatus('没恢复成：' + ((e && e.message) || e)); return; }
      if (!res.ok) {
        _confirmBox(opts.host, '这几处眼下的样子跟撤销后不一样了，恢复会覆盖它们：' + _conflictHtml(res.conflicts), '仍要恢复', function () { _redoEntry(id, Object.assign({}, opts, { force: true })); }, true);
        return;
      }
      try { _commitCurrent(res.scenario, _captureOwner()); }
      catch (e2) { setStatus('没恢复成：' + ((e2 && e2.message) || e2)); return; }
      L.update(id, { undone: false, undoneAt: null, redoneAt: Date.now() }).then(function (e) { _repaintLedgerTags([e]); _refreshLedgerSheet(); });
      ui._exemplarsCache = null;
      _noteState('在改动史里恢复了「' + _entryTitle(target) + '」那次应用的 ' + (target.total || (target.diffs || []).length) + ' 处');
      setStatus('恢复了这次应用的 ' + (target.total || (target.diffs || []).length) + ' 处');
    });
  }
  // 「撤销上次应用」：有账就撤最近一笔（持久、可恢复）；没账才退回页内检查点
  function _undoLatest() {
    var L = Ledger();
    if (!L) { undoLastApply(); return; }
    L.list(_fileKey(), _fileLabel()).then(function (lst) {
      var last = lst.mine.filter(function (e) { return !e.undone; })[0];
      if (!last) { if (ui._checkpoints.length) undoLastApply(); else setStatus('这个剧本上还没有可撤销的国师改动'); return; }
      _toggleSheet('ledger', true);
      setTimeout(function () {
        var item = ui.els.panel.querySelector('.lg-item[data-id="' + last.id + '"]');
        if (item) { try { item.scrollIntoView({ block: 'nearest' }); } catch (e) {} _undoEntry(last.id, { host: item }); }
      }, 60);
    });
  }
  // 改动史（叠页）
  function _renderLedger(el) {
    var L = Ledger();
    var parts = _sheetFill(el, '改动史', '<p class="sh-hint">国师应用到这个剧本上的每一次改动。撤销只回退国师改过的那几处，你别处的手工编辑不动；撤销较早的一次会连带它之后的几次。刷新、关页都还在。</p><div class="lg-list"><div class="lg-empty">读取中…</div></div>');
    if (!L) { parts.body.querySelector('.lg-list').innerHTML = '<div class="lg-empty">改动账没载入。</div>'; return; }
    L.list(_fileKey(), _fileLabel()).then(function (lst) {
      function item(e, kin) {
        var c = e.counts || {};
        return '<div class="lg-item' + (e.undone ? ' undone' : '') + '" data-id="' + esc(e.id) + '">'
          + '<div class="lg-hd"><span class="lg-t" title="' + esc(e.request || '') + '">' + esc(_entryTitle(e)) + '</span>'
          + (e.undone ? '<span class="lg-badge undone">已撤销</span>' : '') + (kin ? '<span class="lg-badge">上次载入</span>' : '')
          + '<span class="lg-m">' + esc(_fmtWhen(e.ts)) + ' · ' + (e.total || (e.diffs || []).length) + ' 处</span></div>'
          + '<div class="lg-chips">' + ((e.names || []).length > 5 ? (c.add ? '<span class="lg-chip add">新增 ' + c.add + '</span>' : '') + (c.chg ? '<span class="lg-chip chg">修改 ' + c.chg + '</span>' : '') + (c.rm ? '<span class="lg-chip rm">删除 ' + c.rm + '</span>' : '') : '') + _entryNames(e, 5) + '</div>'
          + '<div class="lg-acts">' + (e.undone ? '<button type="button" class="tm-aa-btn" data-lg-redo="' + esc(e.id) + '">' + _icon('retry', 13) + '恢复</button>' : '<button type="button" class="tm-aa-btn" data-lg-undo="' + esc(e.id) + '">' + _icon('undo', 13) + '撤销</button>')
          + '<button type="button" class="tm-aa-btn ghost" data-lg-more="' + esc(e.id) + '">看改动</button></div>'
          + '<div class="lg-detail" hidden></div></div>';
      }
      var html = lst.mine.length ? lst.mine.map(function (e) { return item(e, false); }).join('') : '<div class="lg-empty">这个剧本上还没有国师应用过的改动。<br>应用一次，这里就会记下来。</div>';
      if (lst.kin.length) html += '<div class="sh-sec-h" style="margin-top:18px">同名剧本以前的记录（' + lst.kin.length + '）</div><p class="sh-hint">剧本没存进案卷库时，每次载入身份不同，按名字把旧账找回来。撤销照样会先查冲突。</p>' + lst.kin.slice(0, 30).map(function (e) { return item(e, true); }).join('');
      var cps = listCheckpoints();
      if (cps.length) html += '<div class="sh-sec-h" style="margin-top:18px">检查点（只在这次打开的页面里）</div>' + cps.map(function (c) { return '<div class="tm-aa-row"><div class="rw-main"><div class="rw-t">' + esc(c.label) + '</div>' + (String(c.label).indexOf(c.when) >= 0 ? '' : '<div class="rw-d">' + esc(c.when) + '</div>') + '</div><button type="button" class="tm-aa-btn" data-restore="' + c.id + '">回到这里</button></div>'; }).join('');
      parts.body.querySelector('.lg-list').innerHTML = html;
      parts.body.onclick = function (ev) {
        var t = ev.target;
        var u = t.closest && t.closest('[data-lg-undo]'); if (u) { _undoEntry(u.getAttribute('data-lg-undo'), { host: u.closest('.lg-item') }); return; }
        var r = t.closest && t.closest('[data-lg-redo]'); if (r) { _redoEntry(r.getAttribute('data-lg-redo'), { host: r.closest('.lg-item') }); return; }
        var cp = t.closest && t.closest('[data-restore]'); if (cp) { restoreCheckpoint(+cp.getAttribute('data-restore')); _renderLedger(el); return; }
        var m = t.closest && t.closest('[data-lg-more]');
        if (m) {
          var it = m.closest('.lg-item'), det = it && it.querySelector('.lg-detail');
          if (!det) return;
          if (!det.hidden) { det.hidden = true; m.textContent = '看改动'; return; }
          var e = lst.mine.concat(lst.kin).filter(function (x) { return x.id === m.getAttribute('data-lg-more'); })[0];
          var fp = __aaU._friendlyPath || function (x) { return x; }, sv = __aaU._shortVal || function (x) { return String(x); };
          det.innerHTML = (e && e.diffs || []).slice(0, 60).map(function (d) {
            var k = esc(fp(d.path));
            if (d.type === 'added') return '<div class="ch-field"><span class="cf-k">' + k + '</span><span class="cf-new">＋ ' + esc(sv(d.after, 80)) + '</span></div>';
            if (d.type === 'removed') return '<div class="ch-field"><span class="cf-k">' + k + '</span><span class="cf-old">' + esc(sv(d.before, 60)) + '</span><span class="cf-arrow">删去</span></div>';
            return '<div class="ch-field"><span class="cf-k">' + k + '</span><span class="cf-old">' + esc(sv(d.before, 50)) + '</span><span class="cf-arrow">→</span><span class="cf-new">' + esc(sv(d.after, 80)) + '</span></div>';
          }).join('') + ((e && e.diffs || []).length > 60 ? '<div class="sh-hint">…还有 ' + (e.diffs.length - 60) + ' 处</div>' : '');
          det.hidden = false; m.textContent = '收起';
        }
      };
    });
  }
  ui._renderLedger = _renderLedger;

  // ═══ 联网查资料（S7）：国师要读网页时，每个网站先问你一次 ═══
  //   「这次任务里允许」只管这一次发送；「总是允许」记在本机，设置·权限里可移除。不许就告诉国师别再请求那个网站。
  var _WEB_SITES_KEY = 'tm_aa_web_sites';
  function _webOn() { return _prefOn('tm_aa_web', true); }
  function _webSites() { try { var m = JSON.parse(localStorage.getItem(_WEB_SITES_KEY) || '{}'); return m && typeof m === 'object' ? m : {}; } catch (e) { return {}; } }
  function _webSaveSites(m) { try { localStorage.setItem(_WEB_SITES_KEY, JSON.stringify(m)); } catch (e) {} }
  function _webShortUrl(u) {
    try { var x = new URL(u), p = decodeURIComponent(x.pathname + x.search); return x.hostname + (p.length > 72 ? p.slice(0, 70) + '…' : p); }
    catch (e) { return String(u || '').slice(0, 90); }
  }
  function _webHas(m, k) { return !!m && Object.prototype.hasOwnProperty.call(m, k); }
  function _webAsk(req) {
    var site = String(req && req.site || '').toLowerCase();
    if (!site) return Promise.resolve(false);
    if (_webHas(_webSites(), site)) return Promise.resolve('always');
    if (_webHas(ui._webOnce, site)) return Promise.resolve('once');
    if (!ui.els || !ui.els.log) return Promise.resolve(false);
    // 三堂会审里史官、谏官并行审：同一个网站正问着，后来的就等同一张卡，不再摆第二张
    ui._webPending = ui._webPending || {};
    if (_webHas(ui._webPending, site)) return ui._webPending[site];
    var asking = new Promise(function (resolve) {
      var card = document.createElement('div'), settled = false, signal = req.signal;
      card.className = 'tm-aa-msg-ai webask';
      card.innerHTML = '<span class="ai-who">' + _icon('globe', 14) + ' 国师 · 想上网查</span>'
        + '想读 <b>' + esc(site) + '</b> 上的网页：<div class="wa-url">' + esc(_webShortUrl(req.url)) + '</div>'
        + '<div class="ai-hint">只读公开页面，不登录、不带你的账号；读到的内容只当资料，不当指令。</div>'
        + '<div class="wa-acts"><button type="button" class="tm-aa-btn primary" data-wa="once">这次任务里允许</button>'
        + '<button type="button" class="tm-aa-btn" data-wa="always">总是允许这个网站</button>'
        + '<button type="button" class="tm-aa-btn ghost" data-wa="no">不许</button></div>';
      if (ui._liveEl && ui._liveEl.parentNode === ui.els.log) ui.els.log.insertBefore(card, ui._liveEl); else ui.els.log.appendChild(card);
      // 卡被清掉（清空对话、换会话）时这一问就算没允许，免得国师一直等着
      var watch = setInterval(function () { if (!card.isConnected) finish(false, ''); }, 1000);
      function finish(v, note) {
        if (settled) return;
        settled = true;
        clearInterval(watch);
        if (signal) signal.removeEventListener('abort', onAbort);
        if (v === 'always') { var m = _webSites(); m[site] = Date.now(); _webSaveSites(m); }
        if (v === 'once' || v === 'always') { ui._webOnce = ui._webOnce || {}; ui._webOnce[site] = 1; }
        card.classList.add('done');
        var acts = card.querySelector('.wa-acts');
        if (acts) acts.outerHTML = '<div class="wa-done">' + esc(note) + '</div>';
        resolve(v === 'once' || v === 'always' ? v : false);
      }
      function onAbort() { finish(false, '已停下，没读'); }
      if (signal) { if (signal.aborted) { onAbort(); return; } signal.addEventListener('abort', onAbort); }
      card.addEventListener('click', function (ev) {
        var b = ev.target && ev.target.closest ? ev.target.closest('[data-wa]') : null;
        if (!b) return;
        var a = b.getAttribute('data-wa');
        if (a === 'no') { finish(false, '没允许，国师会换别的来源'); setStatus('没让国师读 ' + site); return; }
        finish(a, a === 'always' ? '✓ 总是允许 ' + site + '（设置·权限里可移除）' : '✓ 这次任务里允许读 ' + site);
        setStatus('国师在读 ' + site + ' 上的网页…');
      });
      setStatus('等你点头：国师想读 ' + site + ' 上的网页');
      __aaU._setLive('等你点头：要不要让国师读 ' + site, true);
      _logScrollMaybe(true);
    });
    ui._webPending[site] = asking;
    asking.then(function () { if (ui._webPending[site] === asking) delete ui._webPending[site]; });
    return asking;
  }
  function _fmtDay(t) { var d = new Date(Number(t) || 0); return (d.getMonth() + 1) + '月' + d.getDate() + '日'; }
  function _webSettingsHtml() {
    var sites = _webSites(), names = Object.keys(sites).sort();
    return '<div class="sh-sec"><div class="sh-sec-h">联网查资料</div>'
      + _swHtml('web', _webOn(), '允许国师读网页', '查史料、核史实时读公开网页（维基百科、维基文库等）。每个网站第一次读都会先问你；不登录、不带你的账号。')
      + (names.length
        ? '<p class="sh-hint" style="margin-top:8px">总是允许的网站：</p>' + names.map(function (s) {
            return '<div class="tm-aa-row"><div class="rw-main"><div class="rw-t">' + esc(s) + '</div><div class="rw-d">' + esc(_fmtDay(sites[s])) + '起总是允许</div></div>'
              + '<button type="button" class="tm-aa-btn" data-web-forget="' + esc(s) + '">移除</button></div>';
          }).join('')
        : '<p class="sh-hint" style="margin-top:8px">还没有总是允许的网站。</p>')
      + '<p class="sh-hint">维基百科、维基文库在网页版、桌面版都能读；桌面版还能读其它公开网站。百度百科等要人机验证的读不了。</p></div>';
  }
  function _setWebPref(on) { _prefSet('tm_aa_web', on); setStatus(on ? '国师可以联网查资料了（每个网站先问你）' : '国师不再联网查资料'); }

  // ═══ 实时显示（S4）：真流式时国师边想边说——思考、话、收尾说明一个字一个字冒出来 ═══
  //   只是先给人看：改不改剧本、改什么，仍以收齐后的完整回复为准；收齐即由正式渲染接手。
  //   设置·偏好可关；某条线路不认流式时网络层自动整段重取，这里记下那条线路，往后不再试。
  var _STREAM_OFF_KEY = 'tm_aa_stream_off';
  var _LIVE_ANSWER_KEY = { finish: 'summary', submitAnswer: 'answer', submitReview: 'summary', submitExplanation: 'summary', submitSummary: 'summary', remonstrate: 'concern' };
  function _streamOffMap() { try { return JSON.parse(localStorage.getItem(_STREAM_OFF_KEY) || '{}') || {}; } catch (e) { return {}; } }
  function _streamLineKey() { var c = _loadApiCfg() || {}; return String(c.url || '') + '|' + String(c.model || ''); }
  // 显示思考原文：默认上屏（同志 2026-10-16 定）；只是给人看——原文照旧原样回传给模型续轮，从不当指令执行。设置·偏好可关
  function _showThinking() { return _prefOn('tm_aa_show_thinking', true); }
  function _streamOn() { return _prefOn('tm_aa_stream', true) && !_streamOffMap()[_streamLineKey()]; }
  // 开：连这条线路上回记下的「不支持」一起清掉，再试一次
  function _setStreamPref(on) {
    _prefSet('tm_aa_stream', on);
    if (on) { var m = _streamOffMap(); delete m[_streamLineKey()]; try { localStorage.setItem(_STREAM_OFF_KEY, JSON.stringify(m)); } catch (e) {} }
    setStatus(on ? '实时显示已开' : '实时显示已关，回复收齐后整段出来');
  }
  function _rememberStreamOff() {
    var m = _streamOffMap(); m[_streamLineKey()] = Date.now();
    try { localStorage.setItem(_STREAM_OFF_KEY, JSON.stringify(m)); } catch (e) {}
  }
  function _partialJsonStr(src, key) { return AA.partialJsonString(src, key); }   // 核心里那份：地图国师也用
  function _fmtChars(n) { return n >= 1000 ? (Math.round(n / 100) / 10) + 'k 字' : n + ' 字'; }
  // 正在拟的那一步：从半截参数里认出路径/名字，借「思考与查阅」的说法讲给人听
  function _toolDraftLabel(t) {
    var a = t.args || '', inp = {};
    ['path', 'collection', 'query', 'oldName', 'newName', 'from', 'to', 'text', 'reason', 'kind', 'field', 'region', 'owner', 'convention'].forEach(function (k) { var p = _partialJsonStr(a, k); if (p && p.text) inp[k] = p.text; });
    var nm = _partialJsonStr(a, 'name');
    if (nm && nm.text) { inp.name = nm.text; inp.value = { name: nm.text }; }
    else { var v = _partialJsonStr(a, 'value'); if (v && v.text) inp.value = v.text; }
    var s = '';
    try { s = __aaU._friendlyStep({ name: t.name, input: inp, result: {} }); } catch (e) { s = ''; }
    return s || t.name;
  }
  var _lv = null;
  function _lvState() { return _lv || (_lv = { think: '', text: '', tools: {}, order: [], timer: 0, raf: 0, last: 0 }); }
  function _lvDrop(el) { if (el && el.parentNode) el.parentNode.removeChild(el); }
  // 收起本问旁听到的半截。keepThought：这一问正常收完，想法留作「思考与查阅」里的一条（可展开）。
  function _lvClear(keepThought) {
    var s = _lv; _lv = null;
    if (!s) return;
    if (s.timer) clearTimeout(s.timer);
    if (s.raf) { try { cancelAnimationFrame(s.raf); } catch (e) {} }
    _lvDrop(s.textEl);
    if (s.thinkEl && !_showThinking()) keepThought = false;
    if (s.thinkEl) {
      var full = s.think.trim();
      if (keepThought && full) {
        s.thinkEl.classList.remove('streaming');
        s.thinkEl.textContent = full.length > 8000 ? full.slice(0, 8000) + '…' : full;
        if (full.length > 360) {
          s.thinkEl.classList.add('long');
          s.thinkEl.title = '点开看全部想法';
          s.thinkEl.addEventListener('click', function () { this.classList.toggle('open'); });
        }
      } else _lvDrop(s.thinkEl);
    }
    // 收尾说明的预览卡留到正式回复卡接手（setRunning(false) 里 _removeLive 摘掉）；被打回重来时由下一问的 reset 摘掉
    if (!keepThought && ui._streamEl) { _lvDrop(ui._streamEl); ui._streamEl = null; }
  }
  function _onDelta(ev) {
    if (!ev || !ui.els) return;
    if (ev.kind === 'stream-off') { _rememberStreamOff(); setStatus('这条线路不支持实时显示，已改回整段返回（往后不再试；设置·偏好里可重开）'); return; }
    if (ev.kind === 'reset') { _lvClear(false); return; }
    if (ev.kind === 'done') { _lvPaint(true); _lvClear(true); return; }
    if (!ui.running) return;
    var s = _lvState();
    if (ev.kind === 'think') { s.think += ev.text || ''; s.thinking = true; }
    else if (ev.kind === 'text') s.text += ev.text || '';
    else if (ev.kind === 'tool' || ev.kind === 'args') {
      var k = String(ev.index != null ? ev.index : 0), t = s.tools[k];
      if (!t) { t = s.tools[k] = { name: '', args: '' }; s.order.push(k); }
      if (ev.kind === 'tool') t.name += ev.name || ''; else t.args += ev.text || '';
    } else return;
    if (s.timer || s.raf) return;   // 一帧最多画一次，且两次之间至少隔 60ms
    s.timer = setTimeout(function () {
      s.timer = 0;
      if (_lv !== s) return;
      if (typeof requestAnimationFrame === 'function') s.raf = requestAnimationFrame(function () { s.raf = 0; if (_lv === s) _lvPaint(false); });
      else _lvPaint(false);
    }, Math.max(0, 60 - (Date.now() - s.last)));
  }
  function _lvPaint(final) {
    var s = _lv; if (!s || !ui.els || !ui.els.log) return;
    s.last = Date.now();
    var blk = null;
    // 想法：原文贴进「思考与查阅」，边想边长；关了「显示思考原文」就只在活动行说一句「正在想…」
    if (s.thinking && !_showThinking() && !final) __aaU._setLive('正在想…', true);
    if (s.think.trim() && _showThinking()) {
      blk = __aaU._ensureExecBlock();
      if (!s.thinkEl || !s.thinkEl.isConnected) {
        s.thinkEl = document.createElement('div');
        s.thinkEl.className = 'tk-line reason streaming';
        blk.querySelector('.tm-aa-think-body').appendChild(s.thinkEl);
      }
      var th = s.think.replace(/^\s+/, '');
      s.thinkEl.textContent = th.length > 700 ? '…' + th.slice(-700) : th;
      // 「思考与查阅」开着时想法就在眼前，活动行只说在想；折起来了才把最新一句挂到活动行
      if (!final) { var tail = th.replace(/\s+$/, '').split(/\n+/).pop(); __aaU._setLive(blk.open ? '正在想…' : (tail.length > 90 ? '…' + tail.slice(-88) : tail), true); }
    }
    // 话：同样贴在「思考与查阅」里（收齐后由正式的那一行接手）
    if (s.text.trim()) {
      blk = blk || __aaU._ensureExecBlock();
      if (!s.textEl || !s.textEl.isConnected) {
        s.textEl = document.createElement('div');
        s.textEl.className = 'tk-line streaming';
        blk.querySelector('.tm-aa-think-body').appendChild(s.textEl);
      }
      s.textEl.textContent = s.text.replace(/^\s+/, '').slice(0, 2000);
      if (!final && !(s.think.trim() && _showThinking())) __aaU._setLive(s.text.replace(/\s+/g, ' ').trim(), true);
    }
    // 工具：收尾说明/回答直接在预览卡里成形；改剧本的那几步在活动行报「正在拟」
    var answer = null, drafting = null;
    s.order.forEach(function (k) {
      var t = s.tools[k], key = _LIVE_ANSWER_KEY[t.name];
      if (key) { var p = _partialJsonStr(t.args, key); if (p && p.text.trim()) answer = p.text; }
      else if (t.name) drafting = t;
    });
    if (answer != null) {
      var card = ui._streamEl;
      if (!card || !card.isConnected) {
        card = document.createElement('div');
        card.className = 'tm-aa-reply streaming';
        card.innerHTML = '<div class="reply-who"><span class="reply-ava">师</span><b>国师</b><span class="reply-time">' + _nowHM() + '</span></div><div class="tm-aa-summary"></div>';
        if (ui._liveEl && ui._liveEl.parentNode === ui.els.log) ui.els.log.insertBefore(card, ui._liveEl); else ui.els.log.appendChild(card);
        ui._streamEl = card;
      }
      // 写到一半的 Markdown：去掉尾巴上落单的记号，没合上的加粗先替它合上，免得 ** 露在外面
      var md = answer.slice(0, 12000).replace(/[*_`~\[]+$/, '');
      if ((md.match(/\*\*/g) || []).length % 2) md += '**';
      var sm = card.querySelector('.tm-aa-summary');
      sm.innerHTML = _md(md);
      if (!final) {   // 光标跟在最后一段字后面，不单占一行
        var host = sm;
        while (host.lastElementChild && /^(P|UL|OL|LI|BLOCKQUOTE|DIV|H[1-6]|TABLE|TBODY|TR|TD)$/.test(host.lastElementChild.tagName)) host = host.lastElementChild;
        var caret = document.createElement('span'); caret.className = 'tm-aa-caret'; caret.textContent = '▌';
        host.appendChild(caret);
      }
      ui._liveSaid = true;   // 正式回复卡不再重放打字机
      if (!final) __aaU._setLive('正在落笔…', false);
    } else if (drafting && !final) {
      var n = drafting.args.length;
      __aaU._setLive('正在拟：' + _toolDraftLabel(drafting) + (n > 400 ? '（已写 ' + _fmtChars(n) + '）' : ''), false);
    }
    _logScrollMaybe();
  }

  // ═══ 编辑重发（S3）：点自己说过的话，改了重发——对话回到那句话之前；那之后应用过的改动可一并撤销 ═══
  //   每句话发出时记下：当时的对话（数组浅拷）、当时没应用的草稿相对开工剧本的差异（只存差异，不存整份剧本）、发出时刻。
  function _stampUserMsg(b, kind) {
    if (!b) return;
    b._kind = kind || 'generate';
    b._ts = Date.now();
    b._convBefore = (ui.conversation && ui.conversation.length) ? ui.conversation.slice() : null;
    b._draftDiff = null;
    try { if (ui.draft && ui.baseScenario && (ui._lastDiffs || []).length) b._draftDiff = AA.computeDiff(ui.baseScenario, ui.draft); } catch (e) { b._draftDiff = null; }
  }
  function _laterApplies(b) {
    var L = Ledger();
    if (!L || !b || !b._ts) return Promise.resolve([]);
    return L.list(_fileKey(), _fileLabel()).then(function (lst) {
      return lst.mine.filter(function (e) { return !e.undone && e.ts >= b._ts; }).sort(function (a, c) { return c.ts - a.ts; });
    }, function () { return []; });
  }
  function _cancelEdit() {
    var ed = ui._editing; if (!ed) return;
    ui._editing = null;
    if (ed.box && ed.box.parentNode) ed.box.parentNode.removeChild(ed.box);
    if (ed.bubble) ed.bubble.style.display = '';
    Array.prototype.forEach.call(ui.els.log.querySelectorAll('.doomed'), function (n) { n.classList.remove('doomed'); });
  }
  ui._editPrompt = function (bubble, text, kind) {
    if (ui.running) { setStatus('国师还在忙，先停下再改'); return; }
    _cancelEdit();
    var box = document.createElement('div');
    box.className = 'tm-aa-msg-edit';
    box.innerHTML = '<textarea aria-label="改这句话"></textarea><div class="me-note"></div><div class="me-bar"><span class="tm-aa-flex"></span><button type="button" class="tm-aa-btn ghost" data-me="cancel">取消（Esc）</button><button type="button" class="tm-aa-btn primary" data-me="send">' + _icon('send', 14) + '重发（Enter）</button></div>';
    bubble.parentNode.insertBefore(box, bubble.nextSibling);
    bubble.style.display = 'none';
    var ta = box.querySelector('textarea'); ta.value = text;
    // 这句之后的都会被替掉：先变淡
    var after = [], n = box.nextSibling;
    while (n) { if (n.nodeType === 1 && !n.classList.contains('tm-aa-live')) { n.classList.add('doomed'); after.push(n); } n = n.nextSibling; }
    ui._editing = { box: box, bubble: bubble, kind: kind, undoAfter: true, later: [] };
    var note = box.querySelector('.me-note');
    var bits = [];
    if (after.length) bits.push('这句之后的对话会被替掉。');
    if (ui.draft && (ui._lastDiffs || []).length) bits.push('眼下没应用的改动会退回到这句话发出时的样子。');
    note.innerHTML = esc(bits.join('') || '改好直接重发。');
    _laterApplies(bubble).then(function (later) {
      if (!ui._editing || ui._editing.box !== box) return;
      ui._editing.later = later;
      if (!later.length) return;
      var nAll = later.reduce(function (s, e) { return s + (e.total || (e.diffs || []).length); }, 0);
      var opt = document.createElement('label');
      opt.className = 'me-opt';
      opt.innerHTML = '<button type="button" class="tm-aa-switch on" aria-pressed="true"></button><span>同时撤销这句之后应用的 ' + nAll + ' 处改动（' + later.length + ' 次）</span>';
      note.parentNode.insertBefore(opt, note.nextSibling);
      opt.addEventListener('click', function (ev) {
        ev.preventDefault();
        var sw = opt.querySelector('.tm-aa-switch'), on = !sw.classList.contains('on');
        sw.classList.toggle('on', on); sw.setAttribute('aria-pressed', on ? 'true' : 'false');
        ui._editing.undoAfter = on;
      });
    });
    function send() {
      var t = ta.value.trim();
      if (!t) { ta.focus(); return; }
      _resendFrom(bubble, t, kind);
    }
    box.addEventListener('click', function (ev) {
      var b = ev.target.closest && ev.target.closest('[data-me]'); if (!b) return;
      if (b.getAttribute('data-me') === 'cancel') _cancelEdit(); else send();
    });
    ta.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); _cancelEdit(); return; }
      if ((ev.key === 'Enter' || ev.keyCode === 13) && !ev.shiftKey && !ev.isComposing) { ev.preventDefault(); send(); }
    });
    ta.style.height = 'auto'; ta.style.height = Math.min(240, Math.max(64, ta.scrollHeight)) + 'px';
    try { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); box.scrollIntoView({ block: 'nearest' }); } catch (e) {}
    setStatus('改好按 Enter 重发，Esc 作罢');
  };
  function _resendFrom(bubble, text, kind) {
    var ed = ui._editing; if (!ed || ed.bubble !== bubble) return;
    if (ui.running) { setStatus('国师还在忙，先停下再重发'); return; }
    var later = (ed.undoAfter && ed.later) ? ed.later : [];
    var step = Promise.resolve(true);
    if (later.length) {
      var L = Ledger();
      step = Promise.resolve().then(function () {
        var chain = L.chainFor(later.concat([]), later[later.length - 1]);   // 最早那一笔连带其后
        var res = L.applyChain(ui.adapter.getScenario(), chain);
        if (!res.ok) { setStatus('这句之后应用的改动里有 ' + res.conflicts.length + ' 处又被手工改过，没自动撤销。可以关掉「同时撤销」再重发，或去改动史里处理'); return false; }
        _commitCurrent(res.scenario, _captureOwner());
        var now = Date.now();
        return Promise.all(chain.map(function (e) { return L.update(e.id, { undone: true, undoneAt: now }); })).then(function () { return true; });
      });
    }
    step.then(function (okGo) {
      if (!okGo) return;
      // 草稿回到这句话发出时：当时没应用的差异落回当前剧本（冲突就作罢、从当前剧本起新草稿）
      var dd = bubble._draftDiff;
      _clearDraft();
      if (dd && dd.length) {
        try {
          var live = ui.adapter.getScenario();
          var restored = AA.applySelectedDiffs(live, null, dd);
          _setDraftFromBase(live, AA.makeDraft(restored));
        } catch (e) { _clearDraft(); }
      }
      ui.conversation = bubble._convBefore ? bubble._convBefore.slice() : null;
      ui._conversationOwner = ui.conversation ? _captureOwner() : null;
      ui._pendingPlan = false; ui._pendingClarify = false; ui._autoCont = 0; ui._restoredTodos = null;
      // 流里删掉这句及之后
      _cancelEdit();
      var n = bubble;
      while (n) { var next = n.nextSibling; if (n.nodeType === 1 && !n.classList.contains('tm-aa-live')) n.parentNode.removeChild(n); n = next; }
      ui._reply = null; ui._thinkEl = null;
      _syncEmpty(); _refreshPending();
      ui.els.req.value = text; _autoGrowReq();
      if (kind === 'review') runReview();
      else if (kind === 'qa') runQaUI();
      else if (kind === 'explain') runExplainUI();
      else if (kind === 'orchestrate') runOrchestratedUI();
      else if (kind === 'critics') runWithCriticsUI();
      else onGenerate();
    }, function (e) { setStatus('没重发成：' + ((e && e.message) || e)); });
  }

  // ═══ 叠页：设置 / 改动史 / 导入素材 / 批量扩写 / 实体捆绑 / 模板 / 快捷键 ═══
  //   盖在面板正文之上（顶栏留着），Esc 或 × 收起。工坊原先那层折叠块、弹窗与快捷键速查都收到这里。
  function _sheetEl() {
    var p = ui.els && ui.els.panel; if (!p) return null;
    var el = p.querySelector('.tm-aa-sheet');
    if (!el) {
      el = document.createElement('div');
      el.className = 'tm-aa-sheet'; el.hidden = true;
      el.setAttribute('role', 'dialog');
      el.innerHTML = '<div class="sh-hd"><span class="sh-tt"></span><button type="button" class="sh-x" aria-label="收起" title="收起（Esc）">' + _icon('close', 16) + '</button></div><div class="sh-tabs" hidden></div><div class="sh-body"></div><div class="sh-ft" hidden></div>';
      p.appendChild(el);
      el.querySelector('.sh-x').addEventListener('click', _closeSheet);
      document.addEventListener('keydown', function (ev) {
        if (ev.key !== 'Escape' || el.hidden) return;
        var t = ev.target;
        if (t && t.tagName === 'TEXTAREA' && t.closest && t.closest('.tm-aa-sheet') && t.value) return;   // 写了半截的字不因 Esc 丢
        ev.preventDefault(); ev.stopPropagation(); _closeSheet();
      }, true);
    }
    return el;
  }
  function _closeSheet() {
    var p = ui.els && ui.els.panel; if (!p) return;
    var el = p.querySelector('.tm-aa-sheet'); if (el) el.hidden = true;
    ui._sheetKind = null;
    if (ui.els.settings) ui.els.settings.classList.remove('on');
    if (ui.els.ledger) ui.els.ledger.classList.remove('on');
  }
  function _toggleSheet(kind, force) {
    var el = _sheetEl(); if (!el) return;
    if (!force && !el.hidden && ui._sheetKind === kind) { _closeSheet(); return; }
    _railClose(); _plusClose(); _permPopClose(); _modelPopClose(); _hideCmdPop();
    ui._sheetKind = kind;
    el.hidden = false;
    if (ui.els.settings) ui.els.settings.classList.toggle('on', kind === 'settings');
    if (ui.els.ledger) ui.els.ledger.classList.toggle('on', kind === 'ledger');
    var fn = _SHEETS[kind]; if (fn) fn(el);
  }
  function _sheetFill(el, title, bodyHtml, footHtml, tabsHtml) {
    el.querySelector('.sh-tt').textContent = title;
    var tabs = el.querySelector('.sh-tabs'); tabs.hidden = !tabsHtml; tabs.innerHTML = tabsHtml || '';
    el.querySelector('.sh-body').innerHTML = bodyHtml || '';
    var ft = el.querySelector('.sh-ft'); ft.hidden = !footHtml; ft.innerHTML = footHtml || '';
    return { body: el.querySelector('.sh-body'), foot: ft, tabs: tabs };
  }
  function _swHtml(id, on, label, desc) {
    return '<div class="tm-aa-row"><div class="rw-main"><div class="rw-t">' + esc(label) + '</div>' + (desc ? '<div class="rw-d">' + esc(desc) + '</div>' : '') + '</div><button type="button" class="tm-aa-switch' + (on ? ' on' : '') + '" data-sw="' + id + '" aria-pressed="' + (on ? 'true' : 'false') + '" aria-label="' + esc(label) + '"></button></div>';
  }
  function _prefOn(key, dflt) { try { var v = localStorage.getItem(key); return v == null ? dflt : v === '1'; } catch (e) { return dflt; } }
  function _prefSet(key, on) { try { localStorage.setItem(key, on ? '1' : '0'); } catch (e) {} }
  function _guardHost() { return typeof global._jeGuardSetEnabled === 'function'; }
  function _maskKey(k) { k = String(k || ''); return k ? (k.length > 10 ? k.slice(0, 4) + '…' + k.slice(-4) : '已填') : '没填'; }
  function _saveThinking(mode, protocol) {
    function apply(o) { if (!o) return; if (mode === 'on') o.thinking = true; else if (mode === 'off') o.thinking = false; else delete o.thinking; o.thinkingProtocol = protocol || 'auto'; }
    try {
      var cur = {}; try { cur = JSON.parse(localStorage.getItem('tm_api') || '{}') || {}; } catch (e0) {}
      apply(cur); localStorage.setItem('tm_api', JSON.stringify(cur));
      ['tm_P_lite', 'tm_P'].forEach(function (k) {
        try { var o = JSON.parse(localStorage.getItem(k) || 'null'); if (o && o.ai) { apply(o.ai); localStorage.setItem(k, JSON.stringify(o)); } } catch (e1) {}
      });
      return true;
    } catch (e) { return false; }
  }

  var _SETTINGS_TABS = [['conn', '连接与模型'], ['perm', '权限'], ['conv', '约定'], ['pref', '偏好'], ['more', '资料']];
  function _settingsSheet(el, tab) {
    tab = tab || ui._settingsTab || 'conn';
    ui._settingsTab = tab;
    var tabs = _SETTINGS_TABS.map(function (t) { return '<button type="button" class="sh-tab' + (t[0] === tab ? ' on' : '') + '" data-tab="' + t[0] + '">' + t[1] + '</button>'; }).join('');
    var html = '';
    if (tab === 'conn') {
      var cfg = _loadApiCfg();
      var th = cfg.thinking === true ? 'on' : (cfg.thinking === false ? 'off' : 'auto');
      var protos = [['auto', '自动识别'], ['openai', 'OpenAI · reasoning_effort'], ['deepseek', 'DeepSeek · thinking'], ['qwen', 'Qwen · enable_thinking'], ['openrouter', 'OpenRouter · reasoning'], ['gemini', 'Gemini · thinking_config'], ['anthropic', 'Claude 原生 · thinking']];
      html = '<div class="sh-sec"><div class="sh-sec-h">眼下用的</div><div class="tm-aa-kv">'
        + '<span class="k">地址</span><span class="v">' + esc(cfg.url || '没填') + '</span>'
        + '<span class="k">Key</span><span class="v">' + esc(_maskKey(cfg.key)) + '</span>'
        + '<span class="k">主模型</span><span class="v">' + esc(cfg.model || '—') + '</span>'
        + '<span class="k">次要模型</span><span class="v">' + esc(cfg.model2 || '不用（杂活也走主模型）') + '</span>'
        + '</div><div class="reply-actions" style="margin-top:12px"><button type="button" class="tm-aa-btn primary" data-do="edit-conn">改连接</button><button type="button" class="tm-aa-btn" data-do="test-conn">测试连接</button><span class="mp-st" data-st="conn"></span></div></div>'
        + '<div class="sh-sec"><div class="sh-sec-h">思考</div><p class="sh-hint">让模型先想再答。有的中转不认思考参数，出错就切回「默认」。</p>'
        + '<div class="tm-aa-seg" data-seg="think"><button type="button" data-v="auto"' + (th === 'auto' ? ' class="on"' : '') + '>模型默认</button><button type="button" data-v="on"' + (th === 'on' ? ' class="on"' : '') + '>开</button><button type="button" data-v="off"' + (th === 'off' ? ' class="on"' : '') + '>关</button></div>'
        + '<div class="tm-aa-form" style="margin-top:10px"><label class="fl">协议<select data-sel="proto">' + protos.map(function (p) { return '<option value="' + p[0] + '"' + ((cfg.thinkingProtocol || 'auto') === p[0] ? ' selected' : '') + '>' + p[1] + '</option>'; }).join('') + '</select></label></div></div>'
        + '<p class="sh-hint">与正式游戏共用一份配置（tm_api），国师和生图同源。</p>';
    } else if (tab === 'perm') {
      var pm = _loadPerm();
      var sc = (ui.adapter && ui.adapter.getScenario) ? (ui.adapter.getScenario() || {}) : {};
      var colls = Object.keys(sc).filter(function (k) { return Array.isArray(sc[k]) && sc[k].length; });
      var allowed = ui.allowedCollections;
      html = '<div class="sh-sec"><div class="sh-sec-h">国师能动到哪一步</div>'
        + '<div class="tm-aa-seg" data-seg="perm"><button type="button" data-v="plan"' + (pm.mode === 'plan' ? ' class="on"' : '') + '>问策</button><button type="button" data-v="review"' + (pm.mode === 'review' ? ' class="on"' : '') + '>共审</button><button type="button" data-v="auto"' + (pm.mode === 'auto' ? ' class="on"' : '') + '>放行</button></div>'
        + '<p class="sh-hint" style="margin-top:8px">' + esc(_PERM_TIP[pm.mode]) + '。输入框里按 Shift+Tab 也能轮换。</p>'
        + _swHtml('danger', pm.allowDestructive !== false, '允许伤筋动骨的写入', '删除实体、联动改名。关掉后国师只能增改。')
        + '</div><div class="sh-sec"><div class="sh-sec-h">只许改这些内容</div><p class="sh-hint">全选就是不设限。只在这次打开的页面里有效。</p><div class="tm-aa-scope">'
        + (colls.length ? colls.map(function (k) { var on = !allowed || allowed.indexOf(k) >= 0; return '<label class="' + (on ? 'on' : '') + '"><input type="checkbox" value="' + esc(k) + '"' + (on ? ' checked' : '') + '>' + esc((__aaU._COLL_CN && __aaU._COLL_CN[k]) || k) + '</label>'; }).join('') : '<span class="sh-hint">（剧本里还没有成组的内容）</span>')
        + '</div></div>';
      html += _webSettingsHtml();
    } else if (tab === 'conv') {
      var g = ''; try { g = (AA.loadConventions && AA.loadConventions()) || ''; } catch (e) {}
      html = '<p class="sh-hint">约定是国师每次都会遵守的创作偏好，比如文风、命名、数值区间。全局对所有剧本生效；本剧本只管「' + esc(_fileLabel() || '当前剧本') + '」。</p>'
        + '<div class="sh-sec tm-aa-form"><div class="sh-sec-h">全局</div><textarea data-conv="g" placeholder="例：文风冷峻克制；忠奸不脸谱化；新增人物必配 AI 人格与动机">' + esc(g) + '</textarea><div class="reply-actions" style="margin-top:8px"><button type="button" class="tm-aa-btn primary" data-do="save-conv-g">保存全局约定</button></div></div>'
        + '<div class="sh-sec tm-aa-form"><div class="sh-sec-h">本剧本</div><textarea data-conv="s" placeholder="国师建议的、你点过「记住」的约定也落在这里">' + esc(_loadScenConv()) + '</textarea><div class="reply-actions" style="margin-top:8px"><button type="button" class="tm-aa-btn primary" data-do="save-conv-s">保存本剧本约定</button><button type="button" class="tm-aa-btn" data-do="init-conv">让国师通读剧本提炼约定</button></div></div>';
    } else if (tab === 'pref') {
      var dark = !(ui.els.panel && ui.els.panel.getAttribute('data-theme') === 'light');
      var streamLineOff = _prefOn('tm_aa_stream', true) && !_streamOn();
      html = '<div class="sh-sec"><div class="sh-sec-h">外观与显示</div><div class="tm-aa-seg" data-seg="theme"><button type="button" data-v="dark"' + (dark ? ' class="on"' : '') + '>漆案（深色）</button><button type="button" data-v="light"' + (!dark ? ' class="on"' : '') + '>宣纸（浅色）</button></div>'
        + _swHtml('stream', _streamOn(), '实时显示', streamLineOff ? '这条线路上回不支持流式，已自动改成整段返回。打开会再试一次。' : '国师边查边说，字一个个冒出来。个别中转不支持时会自动退回整段返回。')
        + _swHtml('thinking', _showThinking(), '显示思考原文', '有的模型会先想一段再动手，这段原文显示在「思考与查阅」里。它是模型的草稿，可能杂乱，也可能夹着像工具调用的字样——只给你看，不会被执行。嫌乱可以关掉。')
        + '</div>'
        + '<div class="sh-sec"><div class="sh-sec-h">国师的做法</div>'
        + _swHtml('microplan', _microPlanOn(), '歧义先对齐', '要求有几种做法、影响面大时，先给一份小计划让你点头再动手。')
        + _swHtml('exemplars', _prefOn('tm_aa_exemplars', true), '照剧本里已有的写法来', '把剧本里最丰满的几个人物、势力、事件给国师当范例，新写的更贴近原有笔法（会多用一些 token）。')
        + (_guardHost() ? _swHtml('guard', _prefOn('tm_aa_guard', true), '实时守护', '你手工改完剧本后，自动查一遍死链和前后矛盾（不花 token）。') : '')
        + '</div><div class="sh-sec"><div class="sh-sec-h">提醒</div>'
        + _swHtml('notify', _prefOn('tm_aa_notify', false), '跑完弹系统通知', '页面在后台、跑了十几秒以上时才弹。第一次打开要允许浏览器通知。')
        + '</div>';
    } else {
      var rows = [['memories', '记忆册', '国师存下的跨会话记忆，可删'], ['skills', '技能册', '内置、能力包与自存的技能'], ['packs', '能力包', '技能＋约定的打包单元，可启停、导入、导出'], ['usage', '用量与上下文', '上一轮的 token 构成和上下文占比'], ['changelog', '版本说明', '把已应用的改动汇成一份说明，可复制'], ['macros', '模板', '存常用指令，一键填进输入框'], ['keys', '快捷键', '面板里的键位']];
      html = rows.map(function (r) { return '<div class="tm-aa-row"><div class="rw-main"><div class="rw-t">' + r[1] + '</div><div class="rw-d">' + r[2] + '</div></div><button type="button" class="tm-aa-btn" data-open="' + r[0] + '">打开</button></div>'; }).join('');
    }
    var parts = _sheetFill(el, '设置', html, '', tabs);
    parts.tabs.onclick = function (ev) { var b = ev.target.closest && ev.target.closest('.sh-tab'); if (b) _settingsSheet(el, b.getAttribute('data-tab')); };
    parts.body.onclick = function (ev) {
      var t = ev.target;
      var sw = t.closest && t.closest('.tm-aa-switch');
      if (sw) {
        var on = !sw.classList.contains('on'), id = sw.getAttribute('data-sw');
        sw.classList.toggle('on', on); sw.setAttribute('aria-pressed', on ? 'true' : 'false');
        if (id === 'danger') { var p0 = _loadPerm(); p0.allowDestructive = on; _applyPerm(p0); }
        else if (id === 'microplan') { try { if (on) localStorage.removeItem('tm_aa_microplan'); else localStorage.setItem('tm_aa_microplan', '0'); } catch (e) {} }
        else if (id === 'exemplars') { _prefSet('tm_aa_exemplars', on); ui._exemplarsCache = null; ui._exemplarsSc = null; }
        else if (id === 'stream') _setStreamPref(on);
        else if (id === 'web') _setWebPref(on);
        else if (id === 'thinking') { _prefSet('tm_aa_show_thinking', on); setStatus(on ? '会显示模型的思考原文' : '不再显示思考原文'); }
        else if (id === 'guard') { _prefSet('tm_aa_guard', on); try { global._jeGuardSetEnabled(on); } catch (e) {} }
        else if (id === 'notify') {
          if (on) _toggleNotifyOn(function (ok) { if (!ok) { sw.classList.remove('on'); sw.setAttribute('aria-pressed', 'false'); } });
          else { try { localStorage.removeItem('tm_aa_notify'); } catch (e) {} setStatus('完成通知已关'); }
        }
        return;
      }
      var wf = t.closest && t.closest('[data-web-forget]');
      if (wf) { var wm = _webSites(); delete wm[wf.getAttribute('data-web-forget')]; _webSaveSites(wm); _settingsSheet(el, 'perm'); setStatus('已移除，下次读这个网站会再问你'); return; }
      var segB = t.closest && t.closest('.tm-aa-seg button');
      if (segB) {
        var seg = segB.parentNode, v = segB.getAttribute('data-v'), which = seg.getAttribute('data-seg');
        Array.prototype.forEach.call(seg.querySelectorAll('button'), function (b) { b.classList.toggle('on', b === segB); });
        if (which === 'perm') { var p1 = _loadPerm(); p1.mode = v; _applyPerm(p1); setStatus(_PERM_TIP[v]); _settingsSheet(el, 'perm'); }
        else if (which === 'theme') _setTheme(v);
        else if (which === 'think') { var proto = parts.body.querySelector('[data-sel="proto"]'); _saveThinking(v, proto ? proto.value : 'auto'); setStatus(v === 'on' ? '思考已开' : (v === 'off' ? '思考已关' : '思考跟模型默认走')); }
        return;
      }
      var sc0 = t.closest && t.closest('.tm-aa-scope label');
      if (sc0) {
        setTimeout(function () {
          var boxes = [].slice.call(parts.body.querySelectorAll('.tm-aa-scope input'));
          boxes.forEach(function (b) { b.parentNode.classList.toggle('on', b.checked); });
          var checked = boxes.filter(function (b) { return b.checked; }).map(function (b) { return b.value; });
          ui.allowedCollections = (boxes.length && checked.length < boxes.length) ? checked : null;   // 全勾=不限制
          setStatus(ui.allowedCollections ? '这次只许国师改：' + checked.map(function (k) { return (__aaU._COLL_CN && __aaU._COLL_CN[k]) || k; }).join('、') : '国师能改的内容不设限');
        }, 0);
        return;
      }
      var op = t.closest && t.closest('[data-open]');
      if (op) {
        var k = op.getAttribute('data-open');
        if (k === 'macros' || k === 'keys') { _toggleSheet(k, true); return; }
        _closeSheet();
        if (k === 'memories') showMemoriesUI(); else if (k === 'skills') showSkillsUI(); else if (k === 'packs') showPacksUI(); else if (k === 'usage') showUsageUI(); else if (k === 'changelog') runChangelogUI();
        return;
      }
      var d = t.closest && t.closest('[data-do]'); if (!d) return;
      var act = d.getAttribute('data-do');
      if (act === 'edit-conn') { _closeSheet(); if (ui.els.model) ui.els.model.click(); }
      else if (act === 'test-conn') {
        var st = parts.body.querySelector('[data-st="conn"]');
        if (!AA || typeof AA.testConnection !== 'function') { if (st) st.textContent = '国师核心没载入'; return; }
        if (st) st.textContent = '测试中…'; d.disabled = true;
        Promise.resolve().then(function () { return AA.testConnection(); }).then(function (r) { if (st) st.textContent = (r && r.ok ? '✓ ' : '✗ ') + ((r && r.detail) || ''); }, function (e) { if (st) st.textContent = '✗ ' + ((e && e.message) || e); }).then(function () { d.disabled = false; });
      }
      else if (act === 'save-conv-g') {
        var tg = parts.body.querySelector('[data-conv="g"]');
        _commitUserWrite({ operation: 'convention-global-save', target: 'global', failureLabel: '保存全局约定', run: function () { return AA.saveConventions ? AA.saveConventions(tg.value) : false; }, successMessage: (tg.value || '').trim() ? '全局约定已保存，之后每次都会遵守' : '全局约定已清空' });
      }
      else if (act === 'save-conv-s') {
        var ts = parts.body.querySelector('[data-conv="s"]');
        _commitUserWrite({ operation: 'convention-save', target: _fileKey(), failureLabel: '保存本剧本约定', run: function () { return _saveScenConv(ts.value); }, successMessage: (ts.value || '').trim() ? '本剧本约定已保存' : '本剧本约定已清空' });
      }
      else if (act === 'init-conv') { _closeSheet(); _execCmdByKey('initconv'); }
    };
    var proto = parts.body.querySelector('[data-sel="proto"]');
    if (proto) proto.onchange = function () { var on = parts.body.querySelector('[data-seg="think"] .on'); _saveThinking(on ? on.getAttribute('data-v') : 'auto', proto.value); setStatus('思考协议：' + proto.options[proto.selectedIndex].text); };
  }
  function _execCmdByKey(k) { var def = null; _cmdDefs().forEach(function (c) { if (!def && c.k === k) def = c; }); if (def) def.run(); }

  // 导入素材：粘一段史料 / 设定 / 笔记 → 国师抽成实体入草稿（只增不改，照常过目再应用）
  function _importSheet(el) {
    var parts = _sheetFill(el, '导入素材', '<p class="sh-hint">粘贴史料、设定或笔记，国师从中抽出贴合本剧本的人物、势力、事件等，新增进草稿。只新增，不动已有内容；照常逐项过目后再应用。</p><div class="tm-aa-form"><textarea data-in="text" style="min-height:260px" placeholder="在这里粘贴素材…"></textarea></div>',
      '<button type="button" class="tm-aa-btn ghost" data-do="cancel">取消</button><button type="button" class="tm-aa-btn primary" data-do="go">抽取入草稿</button>');
    var ta = parts.body.querySelector('[data-in="text"]');
    setTimeout(function () { try { ta.focus(); } catch (e) {} }, 0);
    parts.foot.onclick = function (ev) {
      var d = ev.target.closest && ev.target.closest('[data-do]'); if (!d) return;
      if (d.getAttribute('data-do') === 'cancel') { _closeSheet(); return; }
      var text = (ta.value || '').trim();
      if (!text) { setStatus('先粘贴素材'); return; }
      if (ui.running) { setStatus('国师还在忙，等这一轮做完再导入'); return; }
      _closeSheet();
      ui.els.req.value = '下面是一段素材（史料 / 设定 / 笔记），请从中抽取出贴合本剧本背景的人物、势力、事件等，新增进剧本草稿——与现有设定保持一致、字段尽量完整、中文显示名；只新增、不改动已有内容。素材如下：\n\n' + text;
      onGenerate();
    };
  }
  // 批量扩写：选集合＋数量＋风格 → 内嵌现有范例的批量提示词 → bulkAdd 一次生成 → 过目后应用
  var _BATCH_CN = { characters: '人物', factions: '势力', parties: '党派', events: '事件', items: '物品', families: '家族', relations: '关系', cities: '城市', classes: '阶层', traitDefinitions: '特质', goals: '目标', openingLetters: '开场信' };
  function _batchSheet(el) {
    var sc = (ui.adapter && ui.adapter.getScenario) ? (ui.adapter.getScenario() || {}) : {};
    var opts = Object.keys(sc).filter(function (k) { return Array.isArray(sc[k]); }).map(function (k) { return '<option value="' + esc(k) + '">' + esc(_BATCH_CN[k] || k) + (sc[k].length ? '（现有 ' + sc[k].length + '）' : '') + '</option>'; }).join('') || '<option value="characters">人物</option>';
    var parts = _sheetFill(el, '批量扩写', '<p class="sh-hint">一次新增一批同类实体，国师会参考剧本里现有的范例，保持一样的笔法和字段丰满度。改动先进草稿，过目后再应用。</p>'
      + '<div class="tm-aa-form"><label class="fl">加哪一类<select data-in="coll">' + opts + '</select></label><label class="fl">加几个<input type="number" data-in="n" min="1" max="50" value="5"></label><label class="fl">风格或侧重（可不填）<input type="text" data-in="note" placeholder="比如：偏武将；东林背景；晚明世情"></label></div>',
      '<button type="button" class="tm-aa-btn ghost" data-do="cancel">取消</button><button type="button" class="tm-aa-btn primary" data-do="go">开始扩写</button>');
    parts.foot.onclick = function (ev) {
      var d = ev.target.closest && ev.target.closest('[data-do]'); if (!d) return;
      if (d.getAttribute('data-do') === 'cancel') { _closeSheet(); return; }
      if (ui.running) { setStatus('国师还在忙，等这一轮做完再扩写'); return; }
      var coll = parts.body.querySelector('[data-in="coll"]').value, n = Math.max(1, Math.min(50, parseInt(parts.body.querySelector('[data-in="n"]').value, 10) || 5)), note = (parts.body.querySelector('[data-in="note"]').value || '').trim();
      var collCN = _BATCH_CN[coll] || coll;
      var ex = (AA && AA.buildExemplars) ? AA.buildExemplars(sc, { collections: [coll], perColl: 2 }) : '';
      _closeSheet();
      ui.els.req.value = '请批量新增 ' + n + ' 个' + collCN + '（集合 ' + coll + '），与现有内容保持一致的笔法、字段完整度与设定风格' + (note ? ('；风格侧重：' + note) : '') + '。中文显示名，涉及引用（如 faction）必须用剧本已存在的；优先用 bulkAdd 一次性添加，改完用 validateDraft 自查。' + (ex ? '\n【参考现有范例·照其字段丰满度生成】\n' + ex : '');
      onGenerate();
    };
  }
  // 实体捆绑：导出一个势力连同人物、关系；导入别处导出的包（重名自动改名），照常过目后应用
  function _bundleSheet(el) {
    var sc = (ui.adapter && ui.adapter.getScenario) ? (ui.adapter.getScenario() || {}) : {};
    var facs = (sc.factions || []).filter(function (f) { return f && f.name; }).map(function (f) { return '<option>' + esc(f.name) + '</option>'; }).join('') || '<option value="">（没有势力）</option>';
    var parts = _sheetFill(el, '实体捆绑', '<p class="sh-hint">导出：选一个势力，连同它的人物、关系打成包。导入：粘贴别处导出的包，合并进本剧本（势力去重、重名自动改名），照常过目后再应用。</p>'
      + '<div class="tm-aa-form"><div class="mp-row"><select data-in="fac" style="flex:1">' + facs + '</select><button type="button" class="tm-aa-btn" data-do="export">导出这个势力</button><button type="button" class="tm-aa-btn" data-do="download" hidden>下载 .json</button></div>'
      + '<textarea data-in="text" style="min-height:220px;font-family:var(--f-mono);font-size:12px" placeholder="导出的包会出现在这里（可复制）；也可以把要导入的包粘在这里"></textarea></div>',
      '<button type="button" class="tm-aa-btn ghost" data-do="cancel">关闭</button><button type="button" class="tm-aa-btn primary" data-do="import">导入这个包</button>');
    var ta = parts.body.querySelector('[data-in="text"]'), sel = parts.body.querySelector('[data-in="fac"]'), dl = parts.body.querySelector('[data-do="download"]');
    function on(ev) {
      var d = ev.target.closest && ev.target.closest('[data-do]'); if (!d) return;
      var a = d.getAttribute('data-do');
      if (a === 'cancel') { _closeSheet(); return; }
      if (a === 'export') { var b = exportBundle(sel.value); if (!b) { ta.value = '导出失败（先选一个势力）'; return; } ta.value = JSON.stringify(b, null, 2); dl.hidden = false; return; }
      if (a === 'download') {
        try { var blob = new Blob([ta.value], { type: 'application/json' }); var link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = '势力捆绑-' + (sel.value || 'bundle') + '.json'; document.body.appendChild(link); link.click(); setTimeout(function () { URL.revokeObjectURL(link.href); link.remove(); }, 100); } catch (e) { setStatus('下载失败'); }
        return;
      }
      if (a === 'import') {
        var parsed; try { parsed = JSON.parse(ta.value); } catch (e) { setStatus('导入失败：这不是一个合法的 JSON 包'); return; }
        if (ui.running) { setStatus('国师还在忙，等这一轮做完再导入'); return; }
        if (importBundle(parsed)) _closeSheet();
      }
    }
    parts.body.onclick = on; parts.foot.onclick = on;
  }
  // 模板：存常用指令，一键填进输入框
  function _macrosSheet(el) {
    var list = listMacros();
    var cur = (ui.els.req && ui.els.req.value || '').trim();
    var parts = _sheetFill(el, '模板', '<p class="sh-hint">把常用的指令存成模板，用时一点就填进输入框（不会自己发出去）。</p>'
      + '<div class="sh-sec tm-aa-form"><div class="sh-sec-h">把输入框里的话存成模板</div><div class="mp-row"><input type="text" data-in="name" placeholder="起个名字"' + (cur ? '' : ' disabled') + '><button type="button" class="tm-aa-btn" data-do="save"' + (cur ? '' : ' disabled') + '>存</button></div>' + (cur ? '<p class="sh-hint">「' + esc(cur.slice(0, 60)) + (cur.length > 60 ? '…' : '') + '」</p>' : '<p class="sh-hint">输入框是空的，先写好再来存。</p>') + '</div>'
      + '<div class="sh-sec"><div class="sh-sec-h">已存（' + list.length + '）</div>' + (list.length ? list.map(function (m) { return '<div class="tm-aa-row"><div class="rw-main"><div class="rw-t">' + esc(m.name) + '</div><div class="rw-d">' + esc(String(m.prompt || '').slice(0, 90)) + '</div></div><button type="button" class="tm-aa-btn" data-use="' + esc(m.id) + '">用</button><button type="button" class="tm-aa-btn ghost danger" data-del="' + esc(m.id) + '" aria-label="删除">' + _icon('trash', 14) + '</button></div>'; }).join('') : '<p class="sh-hint">还没有模板。</p>') + '</div>');
    parts.body.onclick = function (ev) {
      var t = ev.target;
      var u = t.closest && t.closest('[data-use]'); if (u) { applyMacro(u.getAttribute('data-use')); _closeSheet(); try { ui.els.req.focus(); } catch (e) {} return; }
      var d = t.closest && t.closest('[data-del]'); if (d) { deleteMacro(d.getAttribute('data-del')); _macrosSheet(el); return; }
      var s = t.closest && t.closest('[data-do="save"]');
      if (s) { var nm = parts.body.querySelector('[data-in="name"]').value; if (saveMacro(nm, ui.els.req.value)) { setStatus('存好了'); _macrosSheet(el); } else setStatus('起个名字再存'); }
    };
  }
  // 快捷键
  function _keysSheet(el) {
    var mod = /Mac|iPhone|iPad/.test((navigator && navigator.platform) || '') ? '⌘' : 'Ctrl';
    var groups = [
      ['说话', [['Enter', '发送'], ['Shift + Enter', '换行'], ['↑ / ↓', '输入框空着时翻以前说过的话'], ['@', '点名剧本里的人物、势力或字段'], ['/', '行首敲斜杠：命令面板'], ['Esc', '国师在忙时（输入框空着）停下']]],
      ['模式', [['Shift + Tab', '问策 → 共审 → 放行 轮换'], [mod + ' + K', '命令面板']]],
      ['看', [[mod + ' + F', '在对话里查找（焦点在面板里时）'], ['Esc', '收起弹层、叠页']]]
    ];
    _sheetFill(el, '快捷键', groups.map(function (g) {
      return '<div class="sh-sec"><div class="sh-sec-h">' + g[0] + '</div>' + g[1].map(function (r) { return '<div class="tm-aa-row"><div class="rw-main"><div class="rw-t">' + esc(r[1]) + '</div></div>' + r[0].split(' + ').map(function (k) { return '<span class="tm-aa-kbd">' + esc(k) + '</span>'; }).join('<span style="color:var(--tx4)">＋</span>') + '</div>'; }).join('') + '</div>';
    }).join(''));
  }
  // 改动史（第一版：运行记录＋检查点；改动账接上后换成逐次可撤销的账本）
  function _ledgerSheet(el) {
    if (typeof ui._renderLedger === 'function') { ui._renderLedger(el); return; }
    var hist = listHistory(), cps = listCheckpoints();
    var html = '<div class="sh-sec"><div class="sh-sec-h">检查点（' + cps.length + '）<span class="tm-aa-flex"></span><button type="button" class="tm-aa-btn" data-do="ckpt">存一个</button></div>'
      + (cps.length ? cps.map(function (c) { return '<div class="tm-aa-row"><div class="rw-main"><div class="rw-t">' + esc(c.label) + '</div><div class="rw-d">' + esc(c.when) + '</div></div><button type="button" class="tm-aa-btn" data-restore="' + c.id + '">回到这里</button></div>'; }).join('') : '<p class="sh-hint">还没有检查点。每次应用国师的改动前会自动存一个（只在这次打开的页面里）。</p>') + '</div>'
      + '<div class="sh-sec"><div class="sh-sec-h">运行记录（' + hist.length + '）</div>' + (hist.length ? hist.slice(0, 30).map(function (r) { return '<div class="tm-aa-row"><div class="rw-main"><div class="rw-t">' + esc(r.request || r.kind || '') + '</div><div class="rw-d">' + esc((r.kind || '') + ' · ' + (r.when || '') + (r.applied ? ' · 已应用' : '') + (r.summary ? ' · ' + String(r.summary).slice(0, 60) : '')) + '</div></div></div>'; }).join('') : '<p class="sh-hint">还没有运行记录。</p>') + '</div>';
    var parts = _sheetFill(el, '改动史', html);
    parts.body.onclick = function (ev) {
      var r = ev.target.closest && ev.target.closest('[data-restore]'); if (r) { restoreCheckpoint(+r.getAttribute('data-restore')); _ledgerSheet(el); return; }
      if (ev.target.closest && ev.target.closest('[data-do="ckpt"]')) { manualCheckpoint(); _ledgerSheet(el); }
    };
  }
  var _SHEETS = { settings: function (el) { _settingsSheet(el); }, import: _importSheet, batch: _batchSheet, bundle: _bundleSheet, macros: _macrosSheet, keys: _keysSheet, ledger: _ledgerSheet };

  // 打开面板（工坊停靠时顺带把坞态挂上）
  function _openPanel() {
    var p = ensurePanel();
    if (!p.classList.contains('open')) {
      p.classList.add('open');
      _syncEmpty(); _reflectWorldKind(); _maybeRestoreThread(); _autoWinMode();
    }
    return p;
  }
  // 宿主（工坊各处的「问国师」「AI 生成」按钮）把一句话交给国师：默认填进输入框等人确认，opts.run=true 直接发
  function askGuoshi(text, opts) {
    opts = opts || {};
    _openPanel();
    if (!ui.els || !ui.els.req) return false;
    if (ui.running && opts.run) { setStatus('国师还在忙，先停下或等这一轮做完'); return false; }
    ui.els.req.value = String(text == null ? '' : text);
    try { ui.els.req.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
    _autoGrowReq();
    if (opts.status) setStatus(opts.status);
    if (opts.run) { onGenerate(); return true; }
    try { ui.els.req.focus(); var L = ui.els.req.value.length; ui.els.req.setSelectionRange(L, L); } catch (e) {}
    if (ui.els.composer) { ui.els.composer.classList.remove('flash'); void ui.els.composer.offsetWidth; ui.els.composer.classList.add('flash'); }
    return true;
  }

  // S5(CC sessions 对照) · 会话体系：会话=独立线程·绑定剧本文件（fileKey）·切会话即切剧本。
  //   索引 tm_aa_sessions（meta·新→旧·cap 20）+ 正文 tm_aa_sessbody_<id>（只保最新 10 条·护 quota）·
  //   活动指针 tm_aa_sess_active{fileKey,sessId}（「＋ 新对话」把 sessId 置空 → 开面板不再拉回旧线程·
  //   对应 CC --continue 取「当前项目最近会话」的语义）·旧单线程 tm_aa_thread 首次开面板迁移成一条会话。
  var THREAD_KEY = 'tm_aa_thread';   // 旧单线程键·仅迁移用
  var SESS_KEY = 'tm_aa_sessions', SESS_BODY = 'tm_aa_sessbody_', SESS_PTR = 'tm_aa_sess_active';
  var SESS_MAX = 20, SESS_BODY_KEEP = 10, SESS_FRESH_MS = 48 * 3600 * 1000;
  function _scenKey() {
    try { var sc = ui.adapter && ui.adapter.getScenario ? ui.adapter.getScenario() : null; return String((sc && (sc.id || sc.editingScenarioId || sc.name)) || 'default'); }
    catch (e) { return 'default'; }
  }
  function _fileKey() {
    try { return (ui.adapter && typeof ui.adapter.getFileKey === 'function') ? String(ui.adapter.getFileKey()) : ('name:' + _scenKey()); }
    catch (e) { return 'name:' + _scenKey(); }
  }
  function _fileLabel() {
    try {
      if (ui.adapter && typeof ui.adapter.getFileLabel === 'function') return String(ui.adapter.getFileLabel());
      var sc = ui.adapter && ui.adapter.getScenario ? ui.adapter.getScenario() : null;
      return String((sc && sc.name) || '');
    } catch (e) { return ''; }
  }
  function _sessIndex() { try { var v = JSON.parse(localStorage.getItem(SESS_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
  function _sessIndexSave(list) { try { localStorage.setItem(SESS_KEY, JSON.stringify(list.slice(0, SESS_MAX))); } catch (e) {} }
  function _sessBody(id) { try { var v = JSON.parse(localStorage.getItem(SESS_BODY + id) || 'null'); return (v && Array.isArray(v.conversation) && v.conversation.length) ? v : null; } catch (e) { return null; } }
  function _sessPtr() { try { return JSON.parse(localStorage.getItem(SESS_PTR) || 'null') || {}; } catch (e) { return {}; } }
  function _sessPtrSet(fileKey, sessId) { try { localStorage.setItem(SESS_PTR, JSON.stringify({ fileKey: fileKey, sessId: sessId || null, ts: Date.now() })); } catch (e) {} }
  // 从「构建后的 user 消息」提取玩家原话（回放气泡/会话标题用）：剥掉【用户需求】等标记头与草稿现状等附文
  function _rawReq(text) {
    var t = String(text || '').replace(/^【曾附图 \d+ 张】/, '').trim();
    var m = t.match(/^【[^】]{1,14}】\n?([\s\S]*)$/);
    var body = m ? m[1] : t;
    var cut = body.search(/\n【|\n（在上面已改|\n（当前编辑上下文|\n（提示：/);
    if (cut > 0) body = body.slice(0, cut);
    return body.trim().slice(0, 300);
  }
  // 正文只保最新 N 条（quota）·索引之外的孤儿正文一并清（SESS_PTR 不带 SESS_BODY 前缀·不会被误清）
  function _evictSessBodies(extra) {
    try {
      var keep = {};
      _sessIndex().slice(0, Math.max(0, SESS_BODY_KEEP - (extra || 0))).forEach(function (m) { if (m && m.id) keep[SESS_BODY + m.id] = 1; });
      var kill = [];
      for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf(SESS_BODY) === 0 && !keep[k]) kill.push(k); }
      kill.forEach(function (k) { try { localStorage.removeItem(k); } catch (e0) {} });
    } catch (e) {}
  }
  // 先写新、后删旧：读不懂或写不进（配额满）时旧记录原样留着，下回再迁，不会两头落空
  function _migrateLegacyThread() {
    try {
      var raw = localStorage.getItem(THREAD_KEY); if (!raw) return;
      var pack;
      try { pack = JSON.parse(raw); } catch (e0) { return; }
      if (!pack || !Array.isArray(pack.conversation) || !pack.conversation.length) { localStorage.removeItem(THREAD_KEY); return; }
      var same = pack.sid && pack.sid === _scenKey();
      var id = 's' + (pack.ts || Date.now()) + '-mig';
      var meta = { id: id, ts: pack.ts || Date.now(), created: pack.ts || Date.now(),
        fileKey: same ? _fileKey() : ('name:' + (pack.sid || 'default')), fileLabel: same ? _fileLabel() : String(pack.sid || ''),
        title: _rawReq(pack.conversation[0] && pack.conversation[0].text) || '上次会话', msgs: pack.conversation.length, tokens: 0, kind: '编辑', summary: '' };
      localStorage.setItem(SESS_BODY + id, JSON.stringify({ id: id, ts: meta.ts, todos: pack.todos || [], conversation: pack.conversation }));
      var idx = _sessIndex();
      if (!idx.some(function (m) { return m && m.id === id; })) { idx.unshift(meta); _sessIndexSave(idx); }
      if (!_sessIndex().some(function (m) { return m && m.id === id; })) return;   // 索引没存进去：旧记录先留着
      localStorage.removeItem(THREAD_KEY);
    } catch (e) {}
  }
  // 每轮跑完落盘到当前会话（无则新建）：meta 进索引·正文分键存（压缩副本·体量上限护 quota）
  function _saveSession(res, request, kind) {
    try {
      if (ui._conversationOwner && !_ownerCurrent(ui._conversationOwner)) return;
      if (!res || !Array.isArray(res.conversation) || !res.conversation.length) return;
      var copy = JSON.parse(JSON.stringify(res.conversation));
      copy.forEach(function (m) { if (m && m.images && m.images.length) { m.text = '【曾附图 ' + m.images.length + ' 张】' + (m.text || ''); delete m.images; } });   // S2 · 像素不进 localStorage(体量)
      try { AA._compactOldToolResults(copy, 4); } catch (e0) {}
      ui._sessSeq = (ui._sessSeq || 0) + 1;
      var id = ui._sessId || ('s' + Date.now() + '-' + ui._sessSeq);
      ui._sessId = id;
      var body = { id: id, ts: Date.now(), todos: (res.todos || []).slice(0, 20), conversation: copy };
      var s = JSON.stringify(body);
      if (s.length > 900000) { try { AA._compactOldToolResults(copy, 1); } catch (e1) {} s = JSON.stringify(body); }
      var all = _sessIndex();
      var old = null, rest = [];
      all.forEach(function (m) { if (m && m.id === id) old = m; else if (m) rest.push(m); });
      var meta = {
        id: id, ts: Date.now(), created: old ? (old.created || old.ts) : Date.now(),
        fileKey: _fileKey(), fileLabel: _fileLabel(),
        title: (old && old.title) || _rawReq(String(request || '')) || _rawReq(copy[0] && copy[0].text) || '（未命名会话）',
        msgs: copy.length, tokens: ((old && old.tokens) || 0) + ((res && res.tokensUsed) || 0),
        kind: kind || (old && old.kind) || '编辑',
        summary: String(_runSummaryOf(res) || '').slice(0, 240)
      };
      rest.unshift(meta); _sessIndexSave(rest);
      if (s.length <= 900000) {
        try { localStorage.setItem(SESS_BODY + id, s); }
        catch (eq) { _evictSessBodies(3); try { localStorage.setItem(SESS_BODY + id, s); } catch (eq2) {} }   // quota 满：先腾再存
      } else { try { localStorage.removeItem(SESS_BODY + id); } catch (e2) {} }   // 仍过大：留档卡·正文宁缺毋 quota 爆
      _evictSessBodies(0);
      _sessPtrSet(meta.fileKey, id);
      if (!old) _autoTitle(id, request, meta.summary);   // S8 · 新会话首存后异步起短标题(CC ai-title)
      if (typeof ui._onSessionsChange === 'function') { try { ui._onSessionsChange(); } catch (e3) {} }
    } catch (e) {}
  }
  // 把会话正文回放进消息流（CC 恢复会话即见完整往来对照）：user 气泡=玩家原话；
  //   assistant/tool 段聚合成一张只读回应卡（取该轮最后一条有文字的 assistant·统计工具数）。
  function _renderConversation(conv, meta) {
    if (!ui.els || !Array.isArray(conv)) return;
    resetResults(false);
    if (ui.els.empty) ui.els.empty.style.display = 'none';
    var i = 0;
    while (i < conv.length) {
      var turn = conv[i];
      if (turn && turn.role === 'user') { var t = _rawReq(turn.text); if (t) { var ub = _appendUserMsg(t, { input: t }); if (ub) { ub._kind = 'generate'; ub._convBefore = i ? conv.slice(0, i) : null; } } i++; continue; }
      var lastTxt = '', tools = 0;
      while (i < conv.length && conv[i] && conv[i].role !== 'user') {
        var a = conv[i];
        if (a.role === 'assistant') {
          if (String(a.text || '').trim()) lastTxt = String(a.text).trim();
          tools += Array.isArray(a.toolCalls) ? a.toolCalls.length : 0;
        }
        i++;
      }
      if (lastTxt || tools) {
        _beginReplyCard();
        if (ui.els.summary) { ui.els.summary.innerHTML = lastTxt ? _md(lastTxt.slice(0, 4000)) : '<span class="tm-aa-stream" style="color:var(--tx3)">（这一轮主要是查和改，没留下说明）</span>'; ui.els.summary.style.display = ''; }
        var tag = ui._reply && ui._reply.querySelector('.reply-tag'); if (tag && tools) tag.textContent = '这一轮用了 ' + tools + ' 次工具';
        _freezeLastReply();
      }
    }
    if (meta && meta.summary) {   // 收尾档卡：当轮 finish 的改动说明存在 meta 里（正文里只有工具调用）
      _beginReplyCard();
      if (ui.els.summary) { ui.els.summary.innerHTML = _md(String(meta.summary)); ui.els.summary.style.display = ''; }
      _freezeLastReply();
    }
    if (ui.els.log && ui.els.log.children.length) {   // 回放的分隔：往下是接着聊的
      var sep = document.createElement('div'); sep.className = 'tm-aa-sec'; sep.style.cssText = 'justify-content:center;opacity:.8';
      sep.textContent = '—— 以上是之前的对话 ——';
      ui.els.log.appendChild(sep);
    }
    ui._logPinned = true;
    if (ui.els.logWrap) { try { ui.els.logWrap.scrollTop = ui.els.logWrap.scrollHeight; } catch (e) {} }
  }
  // 开面板自动续接（CC --continue 语义）：优先活动指针指的会话·否则本剧本最新会话；
  //   玩家点过「＋ 新对话」（指针 sessId=null）或过陈(48h)则不拉回。
  function _maybeRestoreThread() {
    try {
      if (ui.running || (ui.conversation && ui.conversation.length)) return false;
      _migrateLegacyThread();
      var fk = _fileKey(), ptr = _sessPtr(), idx = _sessIndex();
      if (ptr && ptr.fileKey === fk && !ptr.sessId && Date.now() - (ptr.ts || 0) < SESS_FRESH_MS) return false;
      var cand = null;
      if (ptr && ptr.fileKey === fk && ptr.sessId) idx.forEach(function (m) { if (!cand && m && m.id === ptr.sessId) cand = m; });
      if (!cand) idx.forEach(function (m) { if (!cand && m && m.fileKey === fk) cand = m; });
      if (!cand || Date.now() - (cand.ts || 0) > SESS_FRESH_MS) return false;
      var body = _sessBody(cand.id); if (!body) return false;
      ui.conversation = body.conversation;
      ui._conversationOwner = _captureOwner();
      ui._restoredTodos = Array.isArray(body.todos) ? body.todos : null;
      ui._sessId = cand.id;
      _renderConversation(body.conversation, cand);
      var pend = (ui._restoredTodos || []).filter(function (t) { return t && t.status !== 'completed'; }).length;
      setStatus('已续上会话「' + (cand.title || '') + '」（' + body.conversation.length + ' 条消息' + (pend ? '·' + pend + ' 项任务未完' : '') + '）· 直接输入续接；不需要就点「＋ 新对话」');
      return true;
    } catch (e) { return false; }
  }
  // 跨剧本切换后刷新顶栏副标题（仅当副标题仍是我方默认值/带「 · 」分隔时才动——工坊 dock 的自定义 sub 不碰）
  function _refreshFileSub() {   // 顶栏副标题 = 眼下的剧本名（切会话跨剧本、换案卷后跟着变）
    try {
      var sub = ui.els && ui.els.panel ? ui.els.panel.querySelector('#tm-aa-hd .sub') : null;
      if (!sub) return;
      var fl = _fileLabel() || String((ui.adapter && ui.adapter.label) || '');
      if (sub.textContent !== fl) { sub.textContent = fl; sub.title = fl + ' · 点一下打开命令面板（Ctrl+K）'; }
    } catch (e) {}
  }
  // 切换会话（CC resume 对照）：绑定的剧本≠当前 → 先让宿主按键打开那个剧本（案卷库），成功才续接；
  //   打不开（已删/未入库/宿主不支持）→ 只读回看正文，不绑定，防止把 A 剧本的会话续在 B 剧本上。
  function switchSession(id) {
    if (ui.running) { setStatus('运行中 · 先停止再切换会话'); return; }
    var meta = null;
    _sessIndex().forEach(function (m) { if (!meta && m && m.id === id) meta = m; });
    if (!meta) { setStatus('该会话已不存在'); return; }
    var body = _sessBody(id), fk = _fileKey(), switchOwner = {};
    ui._sessionSwitch = switchOwner;
    function bind(viewOnly) {
      if (ui._sessionSwitch !== switchOwner) return;
      ui._sessionSwitch = null;
      ui._conversationOwner = null;
      ui._attachmentCarry = null;
      ui._planAttachments = null;
      if (!viewOnly && meta.fileKey !== _fileKey()) viewOnly = true;
      ui._pendingPlan = false; ui._pendingClarify = false; _clearDraft(); ui._autoCont = 0;
      if (ui._criticsArmed) _disarmCriticsVisual();
      if (body && !viewOnly) {
        ui.conversation = body.conversation;
        ui._conversationOwner = _captureOwner();
        ui._restoredTodos = Array.isArray(body.todos) ? body.todos : null;
        ui._sessId = id;
        _sessPtrSet(meta.fileKey, id);
        _renderConversation(body.conversation, meta);
        setStatus('已切到会话「' + (meta.title || '') + '」· 剧本「' + (meta.fileLabel || '') + '」· 直接输入续接');
      } else if (body && viewOnly) {
        ui.conversation = null; ui._restoredTodos = null; ui._sessId = null;
        _renderConversation(body.conversation, meta);
        setStatus('只读回看：会话绑定的剧本「' + (meta.fileLabel || '') + '」当前打不开（可能已删或未入案卷库）· 未续接，输入会对当前打开的剧本生效');
      } else {
        ui.conversation = null; ui._restoredTodos = null; ui._sessId = viewOnly ? null : id;
        resetResults(false); _syncEmpty();
        if (!viewOnly) _sessPtrSet(meta.fileKey, id);
        setStatus('该会话正文已按容量清理（只余档卡）' + (viewOnly ? '·且其剧本打不开' : ' · 已就位，直接输入开新一轮'));
      }
      if (typeof ui._onSessionsChange === 'function') { try { ui._onSessionsChange(); } catch (e) {} }
    }
    if (meta.fileKey && meta.fileKey !== fk && ui.adapter && typeof ui.adapter.openFile === 'function') {
      setStatus('正在切换到剧本「' + (meta.fileLabel || '') + '」…');
      try {
        ui.adapter.openFile(meta.fileKey).then(function (okv) {
          if (okv) { try { _reflectWorldKind(); } catch (e0) {} _refreshFileSub(); bind(false); }
          else bind(true);
        }, function () { bind(true); });
      } catch (e) { bind(true); }
    } else if (meta.fileKey && meta.fileKey !== fk) {
      bind(true);   // 宿主没有 openFile（旧适配器/极端环境）
    } else bind(false);
  }
  function deleteSession(id) {
    var idx = _sessIndex(), meta = null;
    idx.forEach(function (m) { if (!meta && m && m.id === id) meta = m; });
    _sessIndexSave(idx.filter(function (m) { return m && m.id !== id; }));
    try { localStorage.removeItem(SESS_BODY + id); } catch (e) {}
    if (ui._sessId === id) { ui._sessId = null; ui.conversation = null; ui._restoredTodos = null; }
    var p = _sessPtr(); if (p && p.sessId === id) _sessPtrSet(p.fileKey, null);
    setStatus('已删除会话' + (meta && meta.title ? '「' + String(meta.title).slice(0, 24) + '」' : ''));
    if (typeof ui._onSessionsChange === 'function') { try { ui._onSessionsChange(); } catch (e2) {} }
  }
  function listSessions(query) {
    var l = _sessIndex().slice();
    var q = String(query || '').trim().toLowerCase();
    if (q) l = l.filter(function (m) { return ((m.title || '') + ' ' + (m.fileLabel || '') + ' ' + (m.kind || '') + ' ' + (m.summary || '')).toLowerCase().indexOf(q) >= 0; });
    return l;
  }
  // CC custom-title 对照：玩家改名永远压过自动标题（titleKind=custom·AI 标题不再覆盖）
  function renameSession(id, title) {
    title = String(title || '').trim().slice(0, 60);
    if (!title) return false;
    var idx = _sessIndex(), hit = false;
    idx.forEach(function (m) { if (m && m.id === id) { m.title = title; m.titleKind = 'custom'; hit = true; } });
    if (hit) { _sessIndexSave(idx); if (typeof ui._onSessionsChange === 'function') { try { ui._onSessionsChange(); } catch (e) {} } }
    return hit;
  }
  // S8(CC /branch + --fork-session 对照) · 会话分叉：正文快照复制成新会话（新 id·同剧本绑定），
  //   从这一点分头演化——原会话不动，试两种改法/保底探索都不怕弄脏原线。
  function forkSession(id) {
    var src = null;
    _sessIndex().forEach(function (m) { if (!src && m && m.id === id) src = m; });
    if (!src) { setStatus('该会话已不存在'); return null; }
    var body = _sessBody(id);
    if (!body) { setStatus('该会话正文已按容量清理·无从分叉'); return null; }
    ui._sessSeq = (ui._sessSeq || 0) + 1;
    var nid = 's' + Date.now() + '-' + ui._sessSeq + 'f';
    try { localStorage.setItem(SESS_BODY + nid, JSON.stringify({ id: nid, ts: Date.now(), todos: body.todos || [], conversation: body.conversation })); }
    catch (e) { setStatus('分叉失败（本地空间不足·可先删几条旧会话）'); return null; }
    var meta = { id: nid, ts: Date.now(), created: Date.now(), fileKey: src.fileKey, fileLabel: src.fileLabel,
      title: String(src.title || '会话').slice(0, 52) + '·分支', titleKind: src.titleKind === 'custom' ? 'custom' : 'auto',
      msgs: src.msgs, tokens: 0, kind: src.kind, summary: src.summary || '' };
    var idx = _sessIndex(); idx.unshift(meta); _sessIndexSave(idx);
    _evictSessBodies(0);
    setStatus('已从「' + String(src.title || '').slice(0, 20) + '」分叉 · 正切换到分支');
    switchSession(nid);
    return nid;
  }
  // S8(CC ai-title 对照) · 会话首轮跑完后异步起短标题：走次要模型（没配则主模型）·一次结构化小调用·
  //   静默失败保持首句标题·玩家改过名(titleKind=custom)绝不覆盖。
  function _autoTitle(id, request, summary) {
    if(ui._workbenchTask||ui._budgetedRun)return; // Task-budgeted runs do not issue uncounted auxiliary title requests.
    try {
      if (!AA || typeof AA.callWithTools !== 'function' || typeof AA.loadEditorApiConfig !== 'function') return;
      var cfg = AA.loadEditorApiConfig() || {};
      if (!cfg.key || !cfg.url) return;
      if (cfg.model2 && cfg.model2 !== cfg.model) { cfg = JSON.parse(JSON.stringify(cfg)); cfg.model = cfg.model2; }
      var tools = [{ name: 'setTitle', description: '提交会话标题', parameters: { type: 'object', properties: { title: { type: 'string', description: '不超过 12 个字的中文标题·名词短语·不带引号句号' } }, required: ['title'] } }];
      AA.callWithTools([{ role: 'user', text: '给这轮剧本编辑会话起一个不超过 12 个字的中文短标题（概括意图·名词短语），调用 setTitle 提交。\n玩家需求：' + String(request || '').slice(0, 300) + (summary ? '\n完成摘要：' + String(summary).slice(0, 200) : '') }], tools, { cfg: cfg, maxTok: 260, system: '你只负责起标题。必须调用 setTitle 工具提交，不要输出其他内容。' })
        .then(function (r) {
          var tc = r && Array.isArray(r.toolCalls) ? r.toolCalls.filter(function (c) { return c && c.name === 'setTitle'; })[0] : null;
          var t = tc && tc.input && String(tc.input.title || '').trim().replace(/^["'「『]+|["'」』。]+$/g, '').slice(0, 16);
          if (!t) return;
          var idx = _sessIndex(), hit = false;
          idx.forEach(function (m) { if (m && m.id === id && m.titleKind !== 'custom') { m.title = t; m.titleKind = 'ai'; hit = true; } });
          if (hit) { _sessIndexSave(idx); if (typeof ui._onSessionsChange === 'function') { try { ui._onSessionsChange(); } catch (e0) {} } }
        }, function () {});
    } catch (e) {}
  }
  function clearSessions() {
    try { _sessIndex().forEach(function (m) { if (m && m.id) { try { localStorage.removeItem(SESS_BODY + m.id); } catch (e0) {} } }); localStorage.removeItem(SESS_KEY); } catch (e) {}
    ui._sessId = null;
    if (typeof ui._onSessionsChange === 'function') { try { ui._onSessionsChange(); } catch (e2) {} }
  }

  // ── S9 · 约定分层（CC CLAUDE.md 层级对照：~/.claude/CLAUDE.md=全局·项目 CLAUDE.md=本剧本）：
  //    全局约定 tm_aa_conventions（工坊「剧本约定」抽屉继续管）+ 本剧本约定 tm_aa_conv_s::<fileKey>。
  //    每轮 run 注入两层合并；「记住」与国师 recordConvention 的建议默认记到本剧本层
  //    （CC 默认记进项目 CLAUDE.md 同款）——绍宋的文风约定不再灌进天启。 ──
  function _scenConvKey() { return 'tm_aa_conv_s::' + _fileKey(); }
  function _loadScenConv() { try { return String(localStorage.getItem(_scenConvKey()) || '').slice(0, 2600); } catch (e) { return ''; } }
  function _saveScenConv(text) { try { localStorage.setItem(_scenConvKey(), String(text == null ? '' : text).slice(0, 2600)); return true; } catch (e) { return false; } }
  function _convForRun() {
    var g = '', s = _loadScenConv();
    try { g = (AA.loadConventions && AA.loadConventions()) || ''; } catch (e) {}
    if (g && s) return '【全局约定·所有剧本通用】\n' + g + '\n\n【本剧本约定·仅当前剧本】\n' + s;
    return s ? ('【本剧本约定】\n' + s) : g;
  }
  function rememberConvention(conv) {   // 建议/手记 → 本剧本层（同句去重）
    conv = String(conv || '').trim();
    if (!conv) return false;
    var cur = _loadScenConv(), lines = cur ? cur.split('\n') : [];
    if (lines.indexOf(conv) >= 0) return true;
    lines.push(conv);
    return _commitUserWrite({
      operation: 'convention-save',
      target: _fileKey(),
      failureLabel: '记住本剧本约定',
      run: function () { return _saveScenConv(lines.join('\n')); }
    });
  }
  // S11 · 审阅报告尾追加「发现的约定」记住签（复用本剧本层落点）
  function _renderConvSuggest(sug) {
    if (!Array.isArray(sug) || !sug.length || !ui.els || !ui.els.summary) return;
    var box = document.createElement('div');
    box.className = 'tm-aa-cl-md';
    box.innerHTML = '<b>发现的创作约定</b>' + sug.slice(0, 12).map(function (c, i) {
      return '<div>· ' + esc(c) + ' <button type="button" class="tm-aa-cl-copy" data-ci="' + i + '">记住</button></div>';
    }).join('');
    box.addEventListener('click', function (ev) {
      var b = ev.target && ev.target.closest ? ev.target.closest('[data-ci]') : null;
      if (!b || b.disabled) return;
      if (rememberConvention(sug[+b.getAttribute('data-ci')])) { b.textContent = '已记住 ✓（本剧本）'; b.disabled = true; }
    });
    ui.els.summary.appendChild(box);
  }
  // S10(Codex·CC /compact 对照) · 手动压缩前情：跑的间隙把当前会话线程压成七段摘要（一次小结调用·优先次模）
  function runCompactUI() {
    if (!_contextReady()) return;
    if (ui.running) { setStatus('运行中 · 等本轮结束再压缩'); return; }
    if (!ui.conversation || ui.conversation.length < 6) { setStatus('当前会话不长 · 无需压缩'); return; }
    var draft = ui.draft || (AA.makeDraft && ui.adapter && ui.adapter.getScenario ? AA.makeDraft(ui.adapter.getScenario()) : null);
    if (!draft || typeof AA.compactConversation !== 'function') { setStatus('压缩不可用'); return; }
    var beforeN = ui.conversation.length;
    var compactOwner = ui._conversationOwner || _captureOwner(), compactConversation = ui.conversation;
    setStatus('正在压缩前情…（一次小结调用 · 优先走次要模型）');
    AA.compactConversation(ui.conversation, draft, {}).then(function (r) {
      if (!_ownerCurrent(compactOwner) || ui.conversation !== compactConversation || ui.running) { setStatus('案卷或会话已变化，未替换当前前情'); return; }
      if (!r || !r.ok) { setStatus(r && r.reason === 'too-small' ? '对话太短 · 无需压缩' : '压缩失败（模型没给出可信摘要）· 原对话未动'); return; }
      ui.conversation = r.conversation;
      _saveSession({ conversation: r.conversation, todos: ui._restoredTodos || [], tokensUsed: 0 }, '压缩前情', null);
      _infoCard('压缩前情', function () {
        if (ui.els.summary) { ui.els.summary.innerHTML = '<b>前情压好了</b><span class="tm-aa-stream">' + beforeN + ' 条 → ' + r.after + ' 条（摘要约 ' + Math.round(r.summaryChars / 100) / 10 + 'k 字，最近几条原话照留）。接着聊不断片，往后每轮也省上下文。</span>'; ui.els.summary.style.display = ''; }
      });
      setStatus('前情压好了：' + beforeN + ' → ' + r.after + ' 条，直接接着说');
    }, function (e) { setStatus('压缩失败：' + ((e && e.message) || e) + ' · 原对话未动'); });
  }
  // S12(Codex notify 对照) · 完成通知：页面切后台时跑完弹系统通知（palette 开/关·授权在开启时申请）
  function _toggleNotify() {
    try {
      if (localStorage.getItem('tm_aa_notify') === '1') { localStorage.removeItem('tm_aa_notify'); setStatus('完成通知已关'); return; }
      if (typeof Notification === 'undefined') { setStatus('此环境不支持系统通知'); return; }
      if (Notification.permission === 'granted') { localStorage.setItem('tm_aa_notify', '1'); setStatus('完成通知已开 · 页面切后台时跑完会弹通知'); }
      else Notification.requestPermission().then(function (p) {
        if (p === 'granted') { localStorage.setItem('tm_aa_notify', '1'); setStatus('完成通知已开 · 页面切后台时跑完会弹通知'); }
        else setStatus('浏览器未授权通知 · 未开启');
      });
    } catch (e) { setStatus('通知开启失败'); }
  }
  function _toggleNotifyOn(cb) {
    try {
      if (typeof Notification === 'undefined') { setStatus('这里不支持系统通知'); if (cb) cb(false); return; }
      if (Notification.permission === 'granted') { localStorage.setItem('tm_aa_notify', '1'); setStatus('完成通知已开'); if (cb) cb(true); return; }
      Notification.requestPermission().then(function (pm) {
        if (pm === 'granted') { localStorage.setItem('tm_aa_notify', '1'); setStatus('完成通知已开'); if (cb) cb(true); }
        else { setStatus('浏览器没允许通知，没开成'); if (cb) cb(false); }
      });
    } catch (e) { setStatus('通知没开成'); if (cb) cb(false); }
  }
  function _maybeNotify() {
    try {
      if (localStorage.getItem('tm_aa_notify') !== '1') return;
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
      if (typeof document === 'undefined' || !document.hidden) return;   // 页面可见就不打扰
      var dur = Math.round((ui._lastRunMs || 0) / 1000);
      if (dur < 12) return;   // 快跑不值一条系统通知
      if (ui._runOutcome === 'stopped') return;   // 自己停的，不用通知
      var body = ui._runOutcome === 'error' ? '这一轮出错停下了（用时 ' + _fmtDur(dur) + '）· 回来看看' : '这一轮做完了（用时 ' + _fmtDur(dur) + '）· 回来看看结果';
      new Notification('国师', { body: body, tag: 'tm-aa-run' });
    } catch (e) {}
  }
  function showConventionsUI() {   // /创作约定 · 两层透视（CC /memory 对照）
    if (ui.running) { setStatus('国师还在忙，等这一轮做完'); return; }
    var g = ''; try { g = (AA.loadConventions && AA.loadConventions()) || ''; } catch (e) {}
    var s = _loadScenConv(), fl = _fileLabel();
    _infoCard('创作约定', function () {
    if (ui.els.summary) {
      ui.els.summary.innerHTML = '<b>创作约定</b><div class="note" style="margin:0 0 4px">国师每一轮都会遵守。在「设置 · 约定」里可以直接改。</div>'
        + '<div class="tm-aa-cl-md"><b>全局 · 所有剧本通用</b>' + (g ? _md(g) : '<div style="color:var(--tx3)">（空）</div>')
        + '<b>本剧本 · ' + esc(fl || '当前剧本') + '</b>' + (s ? _md(s) : '<div style="color:var(--tx3)">（空 · 点过「记住」的约定会落在这里）</div>')
        + (s ? '<button type="button" class="tm-aa-conv-clear">清空本剧本约定</button>' : '') + '</div>';
      ui.els.summary.style.display = '';
      var cb = ui.els.summary.querySelector('.tm-aa-conv-clear');
      if (cb) cb.addEventListener('click', function () {
        _commitUserWrite({
          operation: 'convention-clear',
          target: _fileKey(),
          failureLabel: '清空本剧本约定',
          run: function () { return _saveScenConv(''); },
          onSuccess: function () { cb.textContent = '已清空 ✓'; cb.disabled = true; },
          successMessage: '本剧本约定已清空'
        });
      });
    }
    });
    setStatus('约定两层：全局' + (g ? ' ' + g.split('\n').filter(Boolean).length + ' 条' : '空') + ' · 本剧本' + (s ? ' ' + s.split('\n').filter(Boolean).length + ' 条' : '空'));
  }

  /* ═══ CC 三件套 UI 曝光（2026-07-03·记忆册/技能册/能力包）+ 用量·上下文卡 ═══ */
  function _mgmtCard(title, bodyHtml, status) {
    if (ui.running) { setStatus('国师还在忙，等这一轮做完'); return null; }
    var host = null;
    _infoCard('', function () {   // 只读信息卡：不顶掉正在待审的那张
      if (!ui.els.summary) return;
      ui.els.summary.innerHTML = '<b>' + title + '</b><div class="tm-aa-cl-md">' + bodyHtml + '</div>';
      ui.els.summary.style.display = '';
      host = ui.els.summary;
    });
    if (status) setStatus(status);
    return host;
  }
  function showMemoriesUI() {   // /记忆册 · ≈CC /memory 的记忆目录视图
    var ms = []; try { ms = (AA.memories && AA.memories.list()) || []; } catch (e) {}
    var TYPE_ZH = { user: '玩家', feedback: '反馈', project: '进行中', reference: '资料' };
    var body = ms.length
      ? ms.map(function (m) {
          return '<div style="border-bottom:1px solid var(--bd);padding:6px 0"><b>' + esc(m.name) + '</b> <span style="color:var(--tx3);font-size:11px">[' + (TYPE_ZH[m.type] || m.type) + '] ' + esc(m.description || '') + '</span>'
            + '<div style="color:var(--tx2);font-size:12px;margin-top:2px;white-space:pre-wrap">' + esc(m.body || '') + '</div>'
            + '<button type="button" class="tm-aa-conv-clear" data-mem-del="' + esc(m.name) + '">删除</button></div>';
        }).join('')
      : '<div style="color:var(--tx3)">（空 · 国师在共事中了解到推导不出的背景时会自动存；也可让它「把XX记住」）</div>';
    var host = _mgmtCard('记忆册（跨会话背景 · 按需求召回注入 · 存 ' + ms.length + ' 条）', body, '记忆 ' + ms.length + ' 条');
    if (host) host.querySelectorAll('[data-mem-del]').forEach(function (b) {
      b.addEventListener('click', function () {
        var name = b.getAttribute('data-mem-del');
        _commitUserWrite({
          operation: 'memory-remove', target: name, failureLabel: '删除记忆',
          run: function () { return AA.memories.remove(name); },
          onSuccess: function () { b.closest('div').style.opacity = '.35'; b.textContent = '已删 ✓'; b.disabled = true; },
          successMessage: '已删除记忆「' + name + '」'
        });
      });
    });
  }
  function showSkillsUI() {   // /技能册 · ≈CC Skill 目录
    var sk = []; try { sk = (AA.skills && AA.skills.list()) || []; } catch (e) {}
    var userNames = {}; try { JSON.parse(localStorage.getItem('tm_aa_skills') || '[]').forEach(function (s) { userNames[s.name] = 1; }); } catch (e) {}
    var biNames = {}; try { (AA.skills.builtin || []).forEach(function (s) { biNames[s.name] = 1; }); } catch (e) {}
    var body = sk.length
      ? sk.map(function (s) {
          var src = biNames[s.name] ? '内置' : (userNames[s.name] ? '自存' : '能力包');
          return '<div style="border-bottom:1px solid var(--bd);padding:6px 0"><b>' + esc(s.name) + '</b> <span style="color:var(--tx3);font-size:11px">[' + src + '] ' + esc(s.whenToUse || s.description || '') + '</span>'
            + '<details style="margin-top:2px"><summary style="cursor:pointer;color:var(--tx3);font-size:11px">展开指令全文</summary><div style="color:var(--tx2);font-size:12px;white-space:pre-wrap">' + esc(s.body || '') + '</div></details>'
            + (userNames[s.name] ? '<button type="button" class="tm-aa-conv-clear" data-skill-del="' + esc(s.name) + '">删除</button>' : '') + '</div>';
        }).join('')
      : '<div style="color:var(--tx3)">（空）</div>';
    var host = _mgmtCard('技能册（打磨过的操作指令包 · 国师做对应事时自动展开照做 · ' + sk.length + ' 项）', body, '技能 ' + sk.length + ' 项');
    if (host) host.querySelectorAll('[data-skill-del]').forEach(function (b) {
      b.addEventListener('click', function () {
        var name = b.getAttribute('data-skill-del');
        _commitUserWrite({
          operation: 'skill-remove', target: name, failureLabel: '删除技能',
          run: function () { return AA.skills.remove(name); },
          onSuccess: function () { b.closest('div').style.opacity = '.35'; b.textContent = '已删 ✓'; b.disabled = true; },
          successMessage: '已删除技能「' + name + '」'
        });
      });
    });
  }
  function showPacksUI() {   // /能力包 · ≈CC /plugin（启停/导入/导出）
    var ps = []; try { ps = (AA.packs && AA.packs.list()) || []; } catch (e) {}
    var body = ps.map(function (p) {
      return '<div style="border-bottom:1px solid var(--bd);padding:6px 0"><b>' + esc(p.name) + '</b> <span style="color:var(--tx3);font-size:11px">v' + esc(p.version || '1.0') + (p.builtin ? ' · 内置' : ' · 玩家装') + ' · ' + p.skills + ' 技能</span>'
        + '<div style="color:var(--tx2);font-size:12px">' + esc(p.description || '') + '</div>'
        + '<button type="button" class="tm-aa-conv-clear" data-pack-tg="' + esc(p.name) + '">' + (p.enabled ? '停用' : '启用') + '</button>'
        + '<button type="button" class="tm-aa-conv-clear" data-pack-exp="' + esc(p.name) + '">导出 JSON</button>'
        + (!p.builtin ? '<button type="button" class="tm-aa-conv-clear" data-pack-rm="' + esc(p.name) + '">卸载</button>' : '') + '</div>';
    }).join('') + '<div style="margin-top:6px"><button type="button" class="tm-aa-conv-clear" data-pack-imp="1">导入能力包 JSON（粘贴）</button></div>';
    var host = _mgmtCard('能力包（技能+约定的打包单元 · 可跨玩家分享 · ' + ps.length + ' 个）', body, '能力包 ' + ps.length + ' 个');
    if (!host) return;
    host.querySelectorAll('[data-pack-tg]').forEach(function (b) {
      b.addEventListener('click', function () {
        var n = b.getAttribute('data-pack-tg'), now = b.textContent === '停用' ? false : true;
        _commitUserWrite({
          operation: 'pack-set-enabled', target: n, failureLabel: now ? '启用能力包' : '停用能力包',
          run: function () { return AA.packs.setEnabled(n, now); },
          onSuccess: function () { b.textContent = now ? '停用' : '启用'; },
          successMessage: '「' + n + '」已' + (now ? '启用' : '停用') + '（下轮生效）'
        });
      });
    });
    host.querySelectorAll('[data-pack-exp]').forEach(function (b) {
      b.addEventListener('click', function () {
        var j = ''; try { j = AA.packs.exportJSON(b.getAttribute('data-pack-exp')) || ''; } catch (e) {}
        if (j && navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(j); b.textContent = '已复制 ✓'; }
        else if (j) { window.prompt('复制此 JSON 分享给其他玩家：', j); }
      });
    });
    host.querySelectorAll('[data-pack-rm]').forEach(function (b) {
      b.addEventListener('click', function () {
        var name = b.getAttribute('data-pack-rm');
        _commitUserWrite({
          operation: 'pack-remove', target: name, failureLabel: '卸载能力包',
          run: function () { return AA.packs.remove(name); },
          onSuccess: function () { b.closest('div').style.opacity = '.35'; b.textContent = '已卸 ✓'; b.disabled = true; },
          successMessage: '已卸载能力包「' + name + '」（下轮生效）'
        });
      });
    });
    var ib = host.querySelector('[data-pack-imp]');
    if (ib) ib.addEventListener('click', function () {
      var j = window.prompt('粘贴能力包 JSON：', '');
      if (!j) return;
      _commitUserWrite({
        operation: 'pack-import', target: 'clipboard-json', failureLabel: '导入能力包',
        run: function () { return AA.packs.importJSON(j); },
        onSuccess: function () { showPacksUI(); },
        successMessage: function (r) { return '已导入「' + r.imported + '」（' + r.skills + ' 技能·下轮生效）'; }
      });
    });
  }
  function showUsageUI() {   // /用量·上下文 · CC /context+/cost 对照（本地 codex-token-usage / claude-hud 思路）
    function fmt(n) { return n >= 10000 ? (n / 1000).toFixed(1) + 'k' : String(Math.round(n || 0)); }
    function bar(part, total, color, label) {
      var pct = total > 0 ? Math.min(100, Math.round(part * 100 / total)) : 0;
      return '<div style="display:flex;align-items:center;gap:8px;font-size:12px;margin:2px 0"><span style="flex:0 0 92px;color:var(--tx2)">' + label + '</span>'
        + '<span style="flex:1;height:8px;background:var(--sunken);border-radius:4px;overflow:hidden"><i style="display:block;height:100%;width:' + pct + '%;background:' + color + '"></i></span>'
        + '<span style="flex:0 0 88px;text-align:right;color:var(--tx3)">' + fmt(part) + ' · ' + pct + '%</span></div>';
    }
    var m = ui._lastRunMeta, budget = ui._budget || 260000;
    var est = function (o) { try { return Math.ceil(((JSON.stringify(o) || '').replace(/[^一-鿿]/g, '').length) * 1.3 + ((JSON.stringify(o) || '').replace(/[一-鿿]/g, '').length) * 0.25); } catch (e) { return 0; } };
    var convTok = ui.conversation && ui.conversation.length ? est(ui.conversation) : 0;
    var memTok = 0, skillTok = 0;
    try { memTok = est((AA.memories.list() || []).map(function (x) { return x.name + x.description; })); } catch (e) {}
    try { skillTok = est((AA.skills.list() || []).map(function (x) { return x.name + (x.whenToUse || ''); })); } catch (e) {}
    var body = '';
    if (m && m.tokensBreakdown) {
      var b = m.tokensBreakdown, tot = m.tokensUsed || (b.system + b.tools + b.conversation);
      body += '<b style="font-size:12px">最近一轮（' + esc(m.kind || '') + ' · ' + m.iterations + ' 轮迭代' + (m.macroCompactions ? ' · 宏压缩×' + m.macroCompactions : '') + (m.steered ? ' · 插话×' + m.steered : '') + '）</b>'
        + bar(b.system, tot, 'var(--ac)', '系统词')
        + bar(b.tools, tot, 'var(--warn)', '工具schema')
        + bar(b.conversation, tot, 'var(--ok)', '对话与结果')
        + '<div style="font-size:12px;color:var(--tx2);margin:4px 0 10px">下次请求体量估算：<b>' + fmt(tot) + '</b> tokens · 占预算上限 ' + Math.round(tot * 100 / budget) + '%（不是服务商账单；上限 ' + fmt(budget) + '·撞 85% 会自动宏压缩）</div>';
    } else {
      body += '<div style="color:var(--tx3);font-size:12px;margin-bottom:8px">（本会话还没跑过——跑一轮后这里显示真口径构成）</div>';
    }
    if (m && m.metrics) {
      var measured=m.metrics;
      body += '<div class="tm-aa-request-metrics" style="font-size:12px;margin:8px 0">本任务累计：逻辑请求 '+fmt(measured.logicalRequests)+' · HTTP尝试 '+fmt(measured.httpRequests)+' · 传输重试 '+fmt(measured.retries)
        + '<br>服务商已报告：'+(measured.usageResponses ? ('输入 '+(measured.inputReports?fmt(measured.inputTokens):'未知')+' / 输出 '+(measured.outputReports?fmt(measured.outputTokens):'未知')+' tokens') : '未提供 usage（未知，不记为零消耗）')
        + (measured.incompleteUsage ? ' · 数据不完整，仅统计已报告部分' : '')+'<br>请求累计经过时间 '+((measured.requestElapsedMs || 0)/1000).toFixed(1)+' 秒（含等待/并行，不是主线程阻塞时间或计费金额）</div>';
    }
    body += '<b style="font-size:12px">当前会话线程</b>'
      + '<div style="font-size:12px;color:var(--tx2)">消息 ' + ((ui.conversation && ui.conversation.length) || 0) + ' 条 · 线程体量约 ' + fmt(convTok) + ' tokens（续跑时计入下轮请求）</div>'
      + '<b style="font-size:12px;display:block;margin-top:8px">常驻注入面（每轮都发）</b>'
      + '<div style="font-size:12px;color:var(--tx2)">记忆清单候选 ~' + fmt(memTok) + ' · 技能清单 ~' + fmt(skillTok) + ' tokens（记忆正文只在被召回时注入·技能全文只在 useSkill 时展开）</div>';
    _mgmtCard('用量 · 上下文（估算与服务商报告分列）', body, m ? ('最近一轮约 ' + fmt(m.tokensUsed) + ' tokens · 占上限 ' + Math.round((m.tokensUsed || 0) * 100 / budget) + '%') : '暂无运行数据');
  }

  // 方向M · 运行历史/审计日志（持久·可搜·跨刷新存活·不存大快照避 quota·cap 50）
  var HISTORY_KEY = 'tm_aa_run_history';
  function _loadHistory() { try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch (e) { return []; } }
  function _saveHistory(h) { try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(-50))); } catch (e) {} }
  function _runSummaryOf(res) {
    if (!res) return '';
    if (res.clarification) return '需澄清：' + ((res.clarification.questions || []).slice(0, 2).join('；'));
    if (res.remonstrance) return '进谏：' + String(res.remonstrance.concern || '').slice(0, 40);
    if (res.plan) return '出计划：' + (res.plan.summary || ((res.plan.steps || []).length + ' 步'));
    if (res.review) return '审阅：' + (res.review.summary || ((res.review.findings || []).length + ' 条问题'));
    if (res.answer) return '回答：' + String(res.answer.answer || '').slice(0, 100);
    return res.summary || '（无说明）';
  }
  // 刀③(2026-07-10 智能升级D1)：微计划开关（默认开·localStorage 持久·家规=新行为必配开关）
  function _microPlanOn() { try { return localStorage.getItem('tm_aa_microplan') !== '0'; } catch (e) { return true; } }
  function _toggleMicroPlan() {
    try {
      if (_microPlanOn()) { localStorage.setItem('tm_aa_microplan', '0'); setStatus('「歧义先对齐」已关 · 国师将直接按理解动手'); }
      else { localStorage.setItem('tm_aa_microplan', '1'); setStatus('「歧义先对齐」已开 · 需求多解时国师先给微计划确认'); }
    } catch (e) {}
  }

  // 刀③(2026-07-10 智能升级D2)：运行教训回喂——最近数次运行结局一行一条·新对话首轮注入（此前审计日志与上下文割裂·每次从零）
  function _runHistoryBrief() {
    try {
      var fk = _fileKey();
      var h = (_loadHistory() || []).filter(function (r) { return r && r.fileKey && r.fileKey === fk; });   // 只看本剧本的结局
      if (!h.length) return '';
      return h.slice(-5).map(function (r) {
        var outcome = (r.stopReason === 'finish' || r.stopReason === 'imported') ? ('完成' + (r.applied ? '·玩家已应用' : '')) : ('未完成:' + (r.stopReason || '?'));
        return '· [' + (r.kind || '?') + '] ' + String(r.request || '').slice(0, 40) + ' → ' + outcome + (r.summary ? '（' + String(r.summary).slice(0, 60) + '）' : '');
      }).join('\n');
    } catch (e) { return ''; }
  }

  function _logRun(kind, request, res) {
    ui._histSeq = (ui._histSeq || 0) + 1;
    var rec = {
      id: 'r' + Date.now() + '-' + ui._histSeq,
      ts: Date.now(),
      when: (function() { try { return new Date().toLocaleString('zh-CN', { hour12: false }); } catch (e) { return ''; } })(),
      kind: kind,
      fileKey: _fileKey(),   // 教训回喂与版本说明按剧本分开
      request: String(request || '').slice(0, 200),
      summary: String(_runSummaryOf(res) || '').slice(0, 240),
      tokensUsed: (res && res.tokensUsed) || 0,
      iterations: (res && res.iterations) || 0,
      stopReason: (res && res.stopReason) || '',
      applied: false
    };
    /* 用量卡数据：最近一轮的真口径构成(G1)与压缩/插话计数(所有模式都经此汇点) */
    if (res && (res.tokensUsed != null || res.metrics)) ui._lastRunMeta = { kind: kind, tokensUsed: res.tokensUsed || 0, tokensBreakdown: res.tokensBreakdown || null, metrics:res.metrics || null, iterations: res.iterations || 0, macroCompactions: res.macroCompactions || 0, steered: res.steered || 0, ts: Date.now() };
    var h = _loadHistory(); h.push(rec); _saveHistory(h);
    ui._lastRunId = rec.id;
    if (typeof ui._onHistoryChange === 'function') { try { ui._onHistoryChange(); } catch (e) {} }
    return rec.id;
  }
  function markLastApplied() {   // onApply 后把最近一条 run 标记为已应用
    if (!ui._lastRunId) return;
    var h = _loadHistory();
    for (var i = h.length - 1; i >= 0; i--) { if (h[i].id === ui._lastRunId) { h[i].applied = true; break; } }
    _saveHistory(h);
    if (typeof ui._onHistoryChange === 'function') { try { ui._onHistoryChange(); } catch (e) {} }
  }
  function listHistory(query) {   // 新→旧·可按关键词过滤
    var h = _loadHistory().slice().reverse();
    var q = String(query || '').trim().toLowerCase();
    if (q) h = h.filter(function(r) { return (r.request + ' ' + r.summary + ' ' + r.kind).toLowerCase().indexOf(q) >= 0; });
    return h;
  }
  function clearHistory() { try { localStorage.removeItem(HISTORY_KEY); } catch (e) {} if (typeof ui._onHistoryChange === 'function') { try { ui._onHistoryChange(); } catch (e) {} } }

  // 方向O · 自动 changelog：把历史里【已应用的改动】汇总成人话版本说明（确定性·零 token·摘要本就是 agent 给的改动理由）。
  var _CHANGE_KINDS = { '编辑': 1, '计划执行': 1, '分解执行': 1, '澄清': 1, '导入捆绑': 1 };
  function buildChangelog(opts) {
    opts = opts || {};
    var onlyApplied = opts.onlyApplied !== false;   // 默认只汇总已应用的（真落地的改动）
    var h = _loadHistory(), fk = _fileKey();   // 旧→新
    var changes = h.filter(function(r) { return r.fileKey === fk && _CHANGE_KINDS[r.kind] && (!onlyApplied || r.applied); });
    if (!changes.length) return { text: '', count: 0 };
    var lines = ['## 本次更新', ''];
    changes.forEach(function(r) {
      var sum = String(r.summary || r.request || '').replace(/^(改动说明|回答|审阅|出计划)[:：]?/, '').trim();
      if (sum) lines.push('- ' + sum);
    });
    return { text: lines.join('\n'), count: changes.length };
  }

  // 方向R · 模板/宏：玩家自定义、持久的常用指令库（一键载入输入框·可直接生成或再编辑）
  var MACROS_KEY = 'tm_aa_macros';
  function _loadMacros() { try { return JSON.parse(localStorage.getItem(MACROS_KEY) || '[]'); } catch (e) { return []; } }
  function _saveMacros(m) { try { localStorage.setItem(MACROS_KEY, JSON.stringify(m.slice(0, 40))); } catch (e) {} }
  function listMacros() { return _loadMacros(); }
  function saveMacro(name, prompt) {
    name = String(name || '').trim(); prompt = String(prompt || '').trim();
    if (!name || !prompt) return false;
    var m = _loadMacros();
    var existing = m.filter(function(x) { return x.name === name; })[0];
    if (existing) { existing.prompt = prompt; }   // 同名覆盖
    else { ui._macroSeq = (ui._macroSeq || 0) + 1; m.push({ id: 'm' + Date.now() + '-' + ui._macroSeq, name: name, prompt: prompt }); }
    _saveMacros(m);
    if (typeof ui._onMacrosChange === 'function') { try { ui._onMacrosChange(); } catch (e) {} }
    return true;
  }
  function deleteMacro(id) {
    _saveMacros(_loadMacros().filter(function(x) { return x.id !== id; }));
    if (typeof ui._onMacrosChange === 'function') { try { ui._onMacrosChange(); } catch (e) {} }
  }
  function applyMacro(id) {
    var mm = _loadMacros().filter(function(x) { return x.id === id; })[0];
    if (mm && ui.els && ui.els.req) {
      ui.els.req.value = mm.prompt; ui.els.req.focus();
      try { ui.els.req.dispatchEvent(new Event('input')); } catch (e) {}
      setStatus('已载入模板「' + mm.name + '」· 可直接生成，或编辑后再跑');
    }
  }

  function resetResults(keepLog) {
    if (!ui.els) return;
    _cancelTypewriter();   // UI·P · 新一轮/重置时停掉在途的打字机动画
    ui._thinkEl = null; ui._thinkCount = 0;   // 新一轮起一个新的「思考与查阅」块
    if (ui.els.empty) ui.els.empty.style.display = 'none';
    if (ui.els.body) ui.els.body.classList.remove('tm-aa-blank');
    if (ui._searchMarks && ui._searchMarks.length) { ui._searchMarks = []; ui._searchIdx = -1; _searchCount(); }
    if (!keepLog) { ui.els.log.innerHTML = ''; ui.els.logWrap.style.display = 'none'; ui._logPinned = true; if (ui.els.toBottom) ui.els.toBottom.hidden = true; ui._reply = null; ui._prevDiffPaths = null; }   // 新对话才清流
    ui._clampBtn = null;
    if (ui.els.meter) { ui.els.meter.textContent = ''; ui._runStart = null; }
    // 聊天化：summary/diff/val/actions 是「当前回应卡」的子元素，由 _beginReplyCard 每轮新建，旧卡留在流里
  }
  var _KIND_LABEL = { generate: '', plan: '计划', 'plan-execute': '按计划执行', review: '审阅', qa: '问答', explain: '讲解', orchestrate: '分解编排', critics: '三堂会审', preflight: '体检' };
  function _nowHM() { try { var d = new Date(); return (d.getHours() < 10 ? '0' : '') + d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes(); } catch (e) { return ''; } }
  function _buildReplyCard(kind) {
    var card = document.createElement('div');
    card.className = 'tm-aa-reply';
    var kl = kind ? (_KIND_LABEL[kind] != null ? _KIND_LABEL[kind] : kind) : '';
    card.innerHTML = '<div class="reply-who"><span class="reply-ava">师</span><b>国师</b>' + (kl ? '<span class="reply-kind">' + esc(kl) + '</span>' : '') + '<span class="reply-time">' + _nowHM() + '</span><span class="tm-aa-flex"></span><button type="button" class="reply-copy" title="复制这条回复" aria-label="复制这条回复">' + _icon('copy', 14) + '</button></div>'
      + '<div class="tm-aa-summary" style="display:none"></div>'
      + '<div class="tm-aa-sec" data-sec="diff" style="display:none">改动</div>'
      + '<div class="tm-aa-diff" style="display:none"></div>'
      + '<div class="tm-aa-val" style="display:none"></div>'
      + '<div class="reply-actions" style="display:none"><button type="button" class="reply-apply">应用到剧本</button><button type="button" class="reply-discard">放弃</button></div>'
      + '<div class="reply-tag"></div>';
    var cp = card.querySelector('.reply-copy');
    if (cp) cp.addEventListener('click', function () {
      var sm = card.querySelector('.tm-aa-summary');
      var txt = (sm && sm.innerText) || card.innerText || '';
      try { navigator.clipboard.writeText(txt.trim()).then(function () { cp.innerHTML = _icon('check', 14); setTimeout(function () { cp.innerHTML = _icon('copy', 14); }, 900); }, function () { setStatus('复制失败（浏览器不让写剪贴板）'); }); }
      catch (e) { setStatus('复制失败'); }
    });
    return card;
  }
  function _pointElsAt(card) {
    ui.els.summary = card.querySelector('.tm-aa-summary');
    ui.els.diffSec = card.querySelector('[data-sec="diff"]');
    ui.els.diff = card.querySelector('.tm-aa-diff');
    ui.els.val = card.querySelector('.tm-aa-val');
    ui.els.actions = card.querySelector('.reply-actions');
    ui.els.apply = card.querySelector('.reply-apply');
    ui.els.discard = card.querySelector('.reply-discard');
  }
  // 聊天化：每轮国师「实质回应」在对话流里建一张回应卡，把结果元素引用重指到卡内子元素，
  //   于是现有 render*（用 ui.els.summary/diff/val/actions）自动渲进当前卡。多轮 → 多卡，历史留在流里。
  function _beginReplyCard(kind) {
    if (!ui.els || !ui.els.log) return;
    _freezeLastReply();   // 上一张卡冻结为历史（只最新一轮可应用/放弃）
    if (ui.els.logWrap) ui.els.logWrap.style.display = '';
    var card = _buildReplyCard(kind);
    ui.els.log.appendChild(card);
    _pointElsAt(card);
    ui.els.apply.addEventListener('click', onApply);
    ui.els.discard.addEventListener('click', onDiscard);
    ui._reply = card;
    ui._clampBtn = null;   // 长总结折叠按钮归属新卡
    _logScrollMaybe(true);   // 设 pinned·生成中跟随
    // summary/diff 在本函数返回后才同步渲染，故用 rAF 在下一帧把新卡顶滚入视口，让人从回复开头读起
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(function () { try { _followReply(); } catch (e) {} });
  }
  // 只读信息卡（体检/版本说明/约定/记忆册…）：不冻结、不顶掉正在待审的那张卡；渲完把元素引用还回去
  function _infoCard(kind, fn) {
    if (!ui.els || !ui.els.log) return null;
    var saved = { reply: ui._reply, summary: ui.els.summary, diffSec: ui.els.diffSec, diff: ui.els.diff, val: ui.els.val, actions: ui.els.actions, apply: ui.els.apply, discard: ui.els.discard, clamp: ui._clampBtn };
    if (ui.els.logWrap) ui.els.logWrap.style.display = '';
    if (ui.els.empty) ui.els.empty.style.display = 'none';
    if (ui.els.body) ui.els.body.classList.remove('tm-aa-blank');
    var card = _buildReplyCard(kind);
    card.classList.add('info', 'frozen');
    ui.els.log.appendChild(card);
    _pointElsAt(card);
    ui._clampBtn = null;
    try { fn(card); }
    finally {
      ui._reply = saved.reply; ui.els.summary = saved.summary; ui.els.diffSec = saved.diffSec; ui.els.diff = saved.diff; ui.els.val = saved.val;
      ui.els.actions = saved.actions; ui.els.apply = saved.apply; ui.els.discard = saved.discard; ui._clampBtn = saved.clamp;
    }
    _logScrollMaybe(true);
    return card;
  }
  // 冻结上一张回应卡：隐藏操作按钮（历史只读）。它的改动还没应用、又接着聊 → 改动并入下一轮，老卡收成一行。
  function _freezeLastReply() {
    var c = ui._reply;
    if (!c || !c.isConnected) { ui._reply = null; return; }
    var pendingCarry = !!(ui.draft && (ui._lastDiffs || []).length && !c.classList.contains('applied') && !c.classList.contains('discarded'));
    if (pendingCarry) {
      var seen = {}; (ui._lastDiffs || []).forEach(function (d) { if (d && d.path) seen[d.path] = 1; });
      ui._prevDiffPaths = seen;
      _supersedeDiff(c);
    } else ui._prevDiffPaths = null;
    c.classList.add('frozen');
    var act = c.querySelector('.reply-actions'); if (act) act.style.display = 'none';
    ui._reply = null;
  }
  // UI·B · 会话流：把一条用户消息作为气泡追加进流（开启一轮对话）
  // UI·Y · 消息操作：悬停出 复制 / 编辑重发 / 重试。opts.input=真正要回填的文本；opts.kind=重试时派发到对应运行器。
  var _MSG_FOLD = 600;
  function _appendUserMsg(text, opts) {
    if (!ui.els || !ui.els.log) return null;
    opts = opts || {};
    ui.els.logWrap.style.display = '';
    if (ui.els.empty) ui.els.empty.style.display = 'none';
    if (ui.els.body) ui.els.body.classList.remove('tm-aa-blank');
    var b = document.createElement('div');
    b.className = 'tm-aa-msg-user' + (opts.kind === 'steer' ? ' steer' : '');
    var input = (opts.input != null ? opts.input : text) || '';
    b._msgText = String(input);   // 完整原话（复制/编辑/重试用，不截断）
    b.setAttribute('data-msg', String(input).slice(0, 2000));
    b.setAttribute('data-kind', opts.kind || 'generate');
    if (opts.convLen != null) b.setAttribute('data-conv', String(opts.convLen));
    var shown = String(text || ''), long = shown.length > _MSG_FOLD;
    b.innerHTML = '<span class="mu-who">你</span><span class="mu-text">' + esc(long ? shown.slice(0, _MSG_FOLD) + '…' : shown) + '</span>'
      + (long ? '<button type="button" class="mu-more">展开全文（' + shown.length + ' 字）</button>' : '')
      + '<span class="tm-aa-msg-acts">'
      + '<button type="button" class="mu-act" data-act="copy" title="复制" aria-label="复制">' + _icon('copy', 13) + '</button>'
      + (opts.kind === 'steer' ? '' : '<button type="button" class="mu-act" data-act="edit" title="改了重发" aria-label="改了重发">' + _icon('edit', 13) + '</button>')
      + '<button type="button" class="mu-act" data-act="retry" title="再来一次" aria-label="再来一次">' + _icon('retry', 13) + '</button>'
      + '</span>';
    if (long) b._fullText = shown;
    ui.els.log.appendChild(b);
    _ensureMsgActions();
    _logScrollMaybe(true);   // 用户刚发消息 → 强制滚到底并重新跟随
    return b;
  }
  // UI·Y · 气泡操作的委托监听（在 log 容器上绑一次）
  function _ensureMsgActions() {
    if (!ui.els || !ui.els.log || ui._msgActsBound) return;
    ui._msgActsBound = true;
    ui.els.log.addEventListener('click', function(ev) {
      var more = ev.target && ev.target.closest ? ev.target.closest('.mu-more') : null;
      if (more) {
        var mb = more.closest('.tm-aa-msg-user'), tx = mb && mb.querySelector('.mu-text');
        if (tx && mb._fullText) { var open = more.getAttribute('data-open') === '1'; tx.textContent = open ? mb._fullText.slice(0, _MSG_FOLD) + '…' : mb._fullText; more.setAttribute('data-open', open ? '0' : '1'); more.textContent = open ? '展开全文（' + mb._fullText.length + ' 字）' : '收起'; }
        return;
      }
      var lgU = ev.target && ev.target.closest ? ev.target.closest('.rt-act[data-lg-undo]') : null;
      if (lgU) { _undoEntry(lgU.getAttribute('data-lg-undo'), { host: lgU.closest('.tm-aa-reply') }); return; }
      var lgR = ev.target && ev.target.closest ? ev.target.closest('.rt-act[data-lg-redo]') : null;
      if (lgR) { _redoEntry(lgR.getAttribute('data-lg-redo'), { host: lgR.closest('.tm-aa-reply') }); return; }
      var btn = ev.target && ev.target.closest ? ev.target.closest('.mu-act') : null;
      if (!btn) return;
      var bubble = btn.closest('.tm-aa-msg-user'); if (!bubble) return;
      var text = bubble._msgText != null ? bubble._msgText : (bubble.getAttribute('data-msg') || ''), kind = bubble.getAttribute('data-kind') || 'generate';
      var act = btn.getAttribute('data-act');
      if (act === 'copy') {
        try { navigator.clipboard.writeText(text).then(function() { var o = btn.innerHTML; btn.innerHTML = _icon('check', 13); setTimeout(function() { btn.innerHTML = o; }, 900); }, function() { setStatus('复制失败（浏览器不让写剪贴板）'); }); }
        catch (e) { setStatus('复制失败'); }
        return;
      }
      if (ui.running) { setStatus('国师还在忙，先停下再' + (act === 'edit' ? '改了重发' : '重试')); return; }
      if (act === 'edit') {
        if (typeof ui._editPrompt === 'function') { ui._editPrompt(bubble, text, kind); return; }
        ui.els.req.value = text; try { ui.els.req.dispatchEvent(new Event('input')); } catch (e) {}
        ui.els.req.focus();
        setStatus('原话放回输入框了，改好再发');
        return;
      }
      if (act === 'retry') {   // 按原 kind 重跑
        ui.els.req.value = text; try { ui.els.req.dispatchEvent(new Event('input')); } catch (e) {}
        if (kind === 'review') runReview();
        else if (kind === 'qa') runQaUI();
        else if (kind === 'explain') runExplainUI();
        else if (kind === 'orchestrate') runOrchestratedUI();
        else if (kind === 'critics') runWithCriticsUI();
        else onGenerate();
      }
    });
  }
  // UI·AB · 滚动跟随 + 回到底部：跟随只在「贴底」时生效；用户上翻则暂停跟随并浮出「↓ 最新」。
  function _logScrollMaybe(force) {
    var el = ui.els && ui.els.logWrap; if (!el) return;   // 聊天化：logwrap 是对话流滚动容器
    if (force) ui._logPinned = true;
    if (ui._logPinned) { el.scrollTop = el.scrollHeight; ui._autoScrollAt = el.scrollTop; if (ui.els.toBottom) ui.els.toBottom.hidden = true; }
  }
  function _ensureLogFollow() {
    if (!ui.els || !ui.els.logWrap || ui._logFollowBound) return;
    ui._logFollowBound = true;
    if (ui._logPinned == null) ui._logPinned = true;
    var el = ui.els.logWrap;
    el.addEventListener('scroll', function() {
      // 程序自己滚的那一下（贴底/停卡头）晚一拍才触发 scroll：别把它当成人往上翻，否则跟随会被误关
      if (ui._autoScrollAt != null && Math.abs(el.scrollTop - ui._autoScrollAt) < 4) return;
      ui._autoScrollAt = null;
      var nearBottom = (el.scrollHeight - el.scrollTop - el.clientHeight) < 24;
      ui._logPinned = nearBottom;
      if (ui.els.toBottom) ui.els.toBottom.hidden = nearBottom || (el.scrollHeight <= el.clientHeight + 2);   // 没溢出也不显
    });
    if (ui.els.toBottom) ui.els.toBottom.addEventListener('click', function() {
      ui._logPinned = true; el.scrollTop = el.scrollHeight; ui.els.toBottom.hidden = true;
    });
  }

  // UI·AI · 面板可调宽度 + 全屏（Claude Code/Codex 桌面端面板招牌）。宽度持久；docked 时同步 CSS 变量给 preview 槽宽。
  var PANEL_W_KEY = 'tm_aa_panel_width';
  function _applyPanelWidth(w) {
    var p = ui.els && ui.els.panel; if (!p || p._fs) return;
    var docked = false; try { docked = document.body.classList.contains('je-guoshi-docked'); } catch (e) {}
    var maxW = Math.round(window.innerWidth * (docked ? 0.6 : 0.92));
    w = Math.max(320, Math.min(w, maxW));
    p.style.width = w + 'px';
    try { document.body.style.setProperty('--tm-aa-dock-w', w + 'px'); } catch (e) {}   // preview 案侧槽宽随动
    try { localStorage.setItem(PANEL_W_KEY, String(w)); } catch (e) {}
  }
  function _ensurePanelResize() {
    if (!ui.els || !ui.els.resize || ui._resizeBound) return;
    ui._resizeBound = true;
    try { var saved = parseInt(localStorage.getItem(PANEL_W_KEY) || '0', 10); if (saved >= 320) _applyPanelWidth(saved); } catch (e) {}
    var dragging = false;
    ui.els.resize.addEventListener('mousedown', function(e) { if (ui.els.panel._fs) return; e.preventDefault(); dragging = true; document.body.style.userSelect = 'none'; });
    document.addEventListener('mousemove', function(e) { if (!dragging) return; _applyPanelWidth(Math.round(ui.els.panel.getBoundingClientRect().right - e.clientX)); });
    document.addEventListener('mouseup', function() { if (dragging) { dragging = false; document.body.style.userSelect = ''; } });
  }
  function _toggleFullscreen(origin) {
    var p = ui.els && ui.els.panel; if (!p) return;
    if (p._fs) {
      p._fs = false; p.classList.remove('fs');
      if (ui.els.fs) { ui.els.fs.innerHTML = _icon('expand', 16); ui.els.fs.title = '展开'; }
      if (origin === 'user') { try { localStorage.setItem('tm_aa_winmode', 'dock'); } catch (e) {} }   // 只记亲手的选择
    } else {
      p._fs = true; p.classList.add('fs');
      if (ui.els.fs) { ui.els.fs.innerHTML = _icon('restore', 16); ui.els.fs.title = '还原'; }
      if (origin === 'user') { try { localStorage.setItem('tm_aa_winmode', 'fs'); } catch (e) {} }
    }
  }
  // 浮窗（旧编辑器）首开默认展开，此后尊重上次亲手的选择。剧本工坊把面板钉成案侧常驻（body.je-guoshi-docked），停靠即窗态，不再叠加展开。
  function _autoWinMode() {
    setTimeout(function () {   // 推迟一拍：宿主停靠胶水在 fab.click() 之后才挂 je-guoshi-docked
      try {
        if (document.body.classList.contains('je-guoshi-docked')) return;
        if (!ui.els || !ui.els.panel || !ui.els.panel.classList.contains('open')) return;
        var m = localStorage.getItem('tm_aa_winmode');
        if ((m === 'fs' || !m) && !ui.els.panel._fs) _toggleFullscreen();
      } catch (e) {}
    }, 0);
  }

  // UI·AJ · 过程区内搜索（⌘F）：在结果/过程区里查关键词，高亮 + 上下跳（浏览器 find 的面板版）。
  function _searchClear() {
    (ui._searchMarks || []).forEach(function(m) {
      if (m.parentNode) { var t = document.createTextNode(m.textContent); var par = m.parentNode; par.replaceChild(t, m); try { par.normalize(); } catch (e) {} }
    });
    ui._searchMarks = []; ui._searchIdx = -1;
  }
  function _searchCount() { var n = (ui._searchMarks || []).length; if (ui.els.searchCount) ui.els.searchCount.textContent = (n ? (ui._searchIdx + 1) : 0) + '/' + n; }
  function _searchActivate() {
    var marks = ui._searchMarks || [];
    marks.forEach(function(m, i) { m.classList.toggle('active', i === ui._searchIdx); });
    var cur = marks[ui._searchIdx];
    if (cur && cur.scrollIntoView) { try { cur.scrollIntoView({ block: 'center' }); } catch (e) {} }
  }
  function _searchRun(query) {
    _searchClear();
    query = (query || '');
    if (!query || !ui.els.body) { _searchCount(); return; }
    var marks = [], nodes = [];
    (function walk(n) {
      for (var c = n.firstChild; c; c = c.nextSibling) {
        if (c.nodeType === 3) { if (c.nodeValue && c.nodeValue.indexOf(query) >= 0) nodes.push(c); }
        else if (c.nodeType === 1 && !/^(textarea|input|script|style|mark)$/i.test(c.tagName) && !(c.classList && c.classList.contains('tm-aa-search'))) walk(c);
      }
    })(ui.els.body);
    nodes.forEach(function(tn) {
      var text = tn.nodeValue, idx, last = 0, frag = document.createDocumentFragment(), any = false;
      while ((idx = text.indexOf(query, last)) >= 0) {
        any = true;
        if (idx > last) frag.appendChild(document.createTextNode(text.slice(last, idx)));
        var mk = document.createElement('mark'); mk.className = 'tm-aa-hl'; mk.textContent = text.substr(idx, query.length);
        frag.appendChild(mk); marks.push(mk);
        last = idx + query.length;
      }
      if (any) { if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last))); tn.parentNode.replaceChild(frag, tn); }
    });
    ui._searchMarks = marks; ui._searchIdx = marks.length ? 0 : -1;
    _searchActivate(); _searchCount();
  }
  function _searchNav(delta) {
    var marks = ui._searchMarks || []; if (!marks.length) return;
    ui._searchIdx = (ui._searchIdx + delta + marks.length) % marks.length;
    _searchActivate(); _searchCount();
  }
  function _searchToggle(show) {
    if (!ui.els.search) return;
    if (show) {
      ui.els.search.hidden = false;
      if (ui.els.searchIn) { ui.els.searchIn.focus(); ui.els.searchIn.select(); _searchRun(ui.els.searchIn.value); }
    } else {
      _searchClear(); ui.els.search.hidden = true; if (ui.els.searchIn) ui.els.searchIn.value = ''; _searchCount();
    }
  }
  function _ensureSearch() {
    if (!ui.els || !ui.els.search || ui._searchBound) return;
    ui._searchBound = true;
    ui.els.searchIn.addEventListener('input', function() { _searchRun(ui.els.searchIn.value); });
    ui.els.searchIn.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') { e.preventDefault(); _searchToggle(false); ui.els.req && ui.els.req.focus(); }
      else if (e.key === 'Enter') { e.preventDefault(); _searchNav(e.shiftKey ? -1 : 1); }
    });
    var prev = ui.els.search.querySelector('#tm-aa-search-prev'), next = ui.els.search.querySelector('#tm-aa-search-next'), x = ui.els.search.querySelector('#tm-aa-search-x');
    if (prev) prev.addEventListener('click', function() { _searchNav(-1); ui.els.searchIn.focus(); });
    if (next) next.addEventListener('click', function() { _searchNav(1); ui.els.searchIn.focus(); });
    if (x) x.addEventListener('click', function() { _searchToggle(false); });
    // ⌘F / Ctrl+F：仅当焦点在国师面板内时拦截（否则放行浏览器 find）
    document.addEventListener('keydown', function(e) {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
        var p = ui.els.panel;
        if (p && p.contains(document.activeElement)) { e.preventDefault(); _searchToggle(true); }
      }
    });
  }

  // UI·AD · 空状态欢迎 + 建议提示（Claude.ai/ChatGPT 新会话招牌）：面板刚开、还没跑时给个上手引导 + 可点 chips。
  //   fill 类 → 回填输入框让玩家审阅再发；act 类（体检/审阅/讲解）→ 直接跑对应运行器。
  var _EMPTY_CHIPS = [
    { label: '体检（免 API）', act: 'preflight', ic: 'pulse' },
    { label: '补齐缺失字段', ic: 'pen', fill: '请用 listGaps 找出游戏运行时必需但缺失的字段，逐一补齐，让剧本完整可玩；改完用 validateDraft 自查。' },
    { label: '校验并列问题', ic: 'search', fill: '请用 validateDraft 全面校验本剧本，列出所有引用冲突、人口/区划不一致等问题（先只报告，不要改）。' },
    { label: '加 3 个人物', ic: 'plus', fill: '请按「人物塑造章法」技能（useSkill 展开）新增 3 名贴合本剧本背景的人物：含姓名、势力归属、官职、性格与 AI 人格；势力名必须用剧本里已存在的势力。' },
    { label: '生成人物立绘', ic: 'image', fill: '请按「人物立绘生成规范」技能（useSkill 展开）给主角与 2-3 名核心人物生成立绘：先读各自人设字段再生成；已有立绘的跳过不覆盖；未配生图 API 就告诉我怎么配。' },
    { label: '审阅出报告', act: 'review', ic: 'scroll' },
    { label: '讲解剧本', act: 'explain', ic: 'book' },
    { label: '三堂会审', act: 'critics', ic: 'scale' }
  ];
  function _greeting() {
    var h = new Date().getHours();
    return h < 5 ? '夜深了' : (h < 9 ? '早' : (h < 11 ? '上午好' : (h < 13 ? '午安' : (h < 18 ? '下午好' : '晚上好'))));
  }
  function _renderEmpty() {
    if (!ui.els || !ui.els.empty || ui._emptyBuilt) return;
    ui._emptyBuilt = true;
    var chips = _EMPTY_CHIPS.map(function(c, i) { return '<button type="button" class="emp-chip" data-i="' + i + '">' + _icon(c.ic || 'chevron', 13) + esc(c.label) + '</button>'; }).join('');
    ui.els.empty.innerHTML = '<div class="emp-seal" aria-hidden="true">師</div><div class="emp-title">国师在此</div>'
      + '<div class="emp-sub"><span class="emp-greet">' + _greeting() + '</span>。说说想改什么——加人、补字段、理顺官制、核对史实都行。也可以从这里开始：</div>'
      + '<div class="emp-chips">' + chips + '</div><div class="emp-recent" hidden></div>';
    ui.els.empty.addEventListener('click', function(ev) {
      var rec = ev.target && ev.target.closest ? ev.target.closest('.emp-rec') : null;
      if (rec) { switchSession(rec.getAttribute('data-sess')); return; }
      var btn = ev.target && ev.target.closest ? ev.target.closest('.emp-chip') : null;
      if (!btn) return;
      var c = _EMPTY_CHIPS[+btn.getAttribute('data-i')]; if (!c) return;
      if (c.act === 'preflight') { runPreflightUI(); return; }
      if (c.act === 'review') { runReview(); return; }
      if (c.act === 'explain') { runExplainUI(); return; }
      if (c.act === 'critics') { _armCritics(); return; }   // 武装会审：写下要求后发送即走三堂会审
      if (c.fill != null) {   // 回填 → 看过再自己发（不自动跑·省 API）
        ui.els.req.value = c.fill; try { ui.els.req.dispatchEvent(new Event('input')); } catch (e) {}
        ui.els.req.focus(); _syncEmpty();
      }
    });
    _refreshEmptyRecent();
  }
  // 欢迎态下列出这个剧本最近的三段会话，点了接着聊
  function _refreshEmptyRecent() {
    var box = ui.els && ui.els.empty && ui.els.empty.querySelector('.emp-recent'); if (!box) return;
    var fk = _fileKey(), rows = listSessions('').filter(function (m) { return m && m.fileKey === fk && _sessBody(m.id); }).slice(0, 3);
    if (!rows.length) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    box.innerHTML = '<div class="emp-recent-h">接着聊</div>' + rows.map(function (m) {
      return '<button type="button" class="emp-rec" data-sess="' + esc(m.id) + '">' + _icon('chat', 13) + '<span class="er-t">' + esc(m.title || '（未命名会话）') + '</span><span class="er-m">' + esc(_railGroupOf(m.ts || 0)) + ' · ' + (m.msgs || 0) + ' 条</span></button>';
    }).join('');
  }
  // 输入框自动增高 + 实时字数
  function _autoGrowReq() {
    var el = ui.els && ui.els.req; if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
    var n = (el.value || '').length;
    var cc = ui.els.charCount;
    if (cc) { cc.hidden = n < 200; cc.textContent = n + ' 字'; }
  }
  // 仅在「面板空闲、什么都没有」时显示欢迎态
  function _syncEmpty() {
    if (!ui.els || !ui.els.empty) return;
    var hasLog = !!(ui.els.log && ui.els.log.children.length);
    var blank = !ui.running && !hasLog && !(ui.els.req && ui.els.req.value.trim());
    var showWelcome = !ui.running && !hasLog;
    ui.els.empty.style.display = showWelcome ? '' : 'none';
    if (ui.els.body) ui.els.body.classList.toggle('tm-aa-blank', showWelcome);
    if (showWelcome) { var g = ui.els.empty.querySelector('.emp-greet'); if (g) g.textContent = _greeting(); _refreshEmptyRecent(); }
    return blank;
  }

  // 计划模式 · 批准后按计划执行（续规划线程、全工具）
  function executePlan() {
    if (ui.running || !ui.draft) return;
    if (!_contextReady()) return;
    if (_attState().pending) { setStatus('附件仍在读取，请等待读取完成后再执行计划'); return; }
    var _planAttachments = _mergeTextAttachments(ui._planAttachments, _attState().files);
    resetResults(true);   // 聊天化：保留对话流（结果作为新卡 append，不清历史）
    setRunning(true);
    setStatus('正在按计划执行…');
    ui._planAttachments = null;
    _clearAttach();
    _runOwned('runAuthoringLoop', ui.draft, '按上面的计划执行这些改动；改完用 validateDraft 自查后调用 finish。', {
      conventions: _convForRun(),   /* S9 · 两层约定注入(全局+本剧本) */
      attachments: _planAttachments,
      priorConversation: ui.conversation,
      editorContext: _editorContext(),
      allowedCollections: ui.allowedCollections || null,
      allowDestructive: ui.allowDestructive !== false,
      exemplars: _exemplars(),                              // 方向J · 从剧本已有实体学丰满度（治空内容）
      onStep: function(step) { appendLog(step); _stepStatus(step); },
      onText: function(text, iter) { appendText(text, iter); }
    }).then(function(res) {
      setRunning(false);
      ui.conversation = res.conversation;
      _captureSideEffects(res, true);
      if (!res.finished) { _renderIncomplete(res, 'plan-execute', '按已批准的计划继续执行'); return; }
      _logRun('计划执行', '(按计划执行)', res);   // 方向M
      _beginReplyCard('按计划执行');
      renderSummary(res.summary, res.notes, res.suggestedConventions, true);   // UI·P · 流式
      renderDiff(_draftDiff(), res.uncertainties);   // 以开工基线审阅，实时剧本留到应用时做冲突合并
      var _vdPlan = _finishReplyActions(res.finalValidation, ui._lastDiffs || []);
      setStatus(_doneStatus(res, '按计划完成了'));
      _autoApplyFinished(res, _vdPlan);
    }).catch(function(err) { renderError('plan-execute', '(按计划执行)', err); });   // UI·AC · 错误卡+重试
  }

  // 方向D · 审阅模式：只读巡查 → 出体检报告（不产生可应用改动）。输入框文字（若有）作审阅重点。
  function runReview() {
    if (ui.running) return;
    if (!_contextReady()) return;
    if (!AA || typeof AA.runAuthoringLoop !== 'function') { setStatus('agent 核心未加载'); return; }
    if (_attState().pending) { setStatus('附件仍在读取，请等待读取完成后再发送'); return; }
    var _attTxt = _attachPrefix(), _textAttachments = _takeTextAttachments();
    resetResults(true);   // 聊天化：保留对话流（结果作为新卡 append，不清历史）
    var focus = (ui.els.req.value || '').trim();
    if (!_guardPendingDraft('审阅')) { ui.els.req.value = focus; return; }
    ui.els.req.value = ''; _autoGrowReq();
    _stampUserMsg(_appendUserMsg(focus || '审阅整个剧本', { kind: 'review', input: focus }), 'review');   // 会话流 + 重试/改了重发派发
    _prepareRunDraft('runAuthoringLoop');   // 重试复用原草稿/恢复点，正常审阅另起只读快照。
    ui.conversation = null; ui._pendingPlan = false;
    setRunning(true);
    setStatus('正在审阅剧本…（agent 只读巡查，出体检报告，可能需要数十秒）');
    _clearAttach();
    _runOwned('runAuthoringLoop', ui.draft, focus + _attTxt, {
      conventions: _convForRun(),   /* S9 · 两层约定注入(全局+本剧本) */
      reviewOnly: true,
      attachments: _textAttachments,
      editorContext: _editorContext(),
      onStep: function(step) { appendLog(step); _stepStatus(step, '审阅 · '); },
      onText: function(text, iter) { appendText(text, iter); }
    }).then(function(res) {
      setRunning(false);
      _captureSideEffects(res, false);
      if (!res.finished) { _renderIncomplete(res, 'review', focus); return; }
      _logRun('审阅', focus || '(全面体检)', res);   // 方向M
      ui.els.req.value = ''; _autoGrowReq();
      _clearDraft();   // 审阅不产生可应用改动
      if (res.review) {
        _beginReplyCard('review');
        renderReview(res.review, true);   // UI·P · 流式
        _renderConvSuggest(res.suggestedConventions);   // S11 · 审阅中发现的约定 → 记住(本剧本层)
        setStatus(_doneStatus(res, '审阅完了，只看不改'));
      } else {
        setStatus('审阅停下了，没出报告，可以再试一次');
      }
    }).catch(function(err) { renderError('review', focus, err); });   // UI·AC · 错误卡+重试
  }

  // 方向E · 运行时体检（确定性·无需 API）：对当前剧本跑 preflight，报告会影响运行的 blockers + 建议性 warnings
  function runPreflightUI() {
    if (ui.running) return;
    if (!AA || typeof AA.preflight !== 'function') { setStatus('agent 核心未加载'); return; }
    resetResults(true);   // 聊天化：保留对话流（结果作为新卡 append，不清历史）
    var pf;
    try { pf = AA.preflight(AA.makeDraft(ui.adapter.getScenario())); }
    catch (e) { setStatus('体检失败：' + (e && e.message || e)); return; }
    var _idm = __aaU._idNameMap ? __aaU._idNameMap() : {}, _rv = function (t) { return __aaU._readableViolation ? __aaU._readableViolation(t, _idm) : t; };
    _infoCard('preflight', function () {   // 只读信息卡：不顶掉正在待审的那张
      if (ui.els.summary) { ui.els.summary.innerHTML = '<b>运行时体检</b>' + esc(pf.bootable ? (pf.warnings.length ? '能正常开局，另有几处建议' : '能正常开局，没发现问题') : (pf.blockers.length + ' 处会挡住开局，可以交给国师修')); ui.els.summary.style.display = ''; }
      ui.els.diffSec.style.display = ''; ui.els.diff.style.display = '';
      ui.els.diffSec.textContent = '体检结果 · ' + pf.blockers.length + ' 处会挡住开局 · ' + pf.warnings.length + ' 条建议';
      var rows = [];
      pf.blockers.forEach(function(b) { rows.push('<div class="tm-aa-finding"><span class="sev rm">挡开局</span>' + esc(_rv(b)) + '</div>'); });
      pf.warnings.slice(0, 30).forEach(function(w) { rows.push('<div class="tm-aa-finding"><span class="sev ch">建议</span>' + esc(_rv(w)) + '</div>'); });
      if (pf.warnings.length > 30) rows.push('<div class="ln">… 还有 ' + (pf.warnings.length - 30) + ' 条建议</div>');
      if (!rows.length) rows.push('<div class="ln ok">运行时体检通过，能正常开局</div>');
      ui.els.diff.innerHTML = rows.join('');
    });
    setStatus(pf.bootable ? ('体检：能正常开局' + (pf.warnings.length ? '，' + pf.warnings.length + ' 条建议' : '')) : ('体检：' + pf.blockers.length + ' 处会挡住开局，可以交给国师修'));
  }

  // 方向W · 实体捆绑：导出当前剧本某势力的包；导入捆绑包→合并进草稿→走 diff/应用审。
  function exportBundle(factionName) {
    if (!AA || !AA.buildEntityBundle) return null;
    try { return AA.buildEntityBundle(ui.adapter.getScenario(), factionName); } catch (e) { return null; }
  }
  function importBundle(bundle) {
    if (!AA || !AA.mergeEntityBundle) { setStatus('agent 核心未加载'); return false; }
    var cur = ui.adapter.getScenario();
    var res = AA.mergeEntityBundle(cur, bundle);
    if (res.error) { setStatus('导入失败：' + res.error); return false; }
    resetResults(true);   // 聊天化：保留对话流（结果作为新卡 append，不清历史）
    _setDraftFromBase(cur, res.scenario); ui.conversation = null; ui._pendingPlan = false; ui._pendingClarify = false;
    var renamedN = res.renamed ? Object.keys(res.renamed).length : 0;
    ui._lastRequest = '导入实体捆绑包';
    var sm = '已合并捆绑包：势力 +' + res.added.factions + ' · 人物 +' + res.added.characters + ' · 关系 +' + res.added.relations + (renamedN ? ' · 重名已改 ' + renamedN + ' 个' : '');
    _logRun('导入捆绑', '捆绑包导入', { summary: sm, tokensUsed: 0, iterations: 0, stopReason: 'imported' });   // 方向M · 记历史 + 让 markLastApplied 生效
    _beginReplyCard('导入捆绑');
    renderSummary(sm, null, null);
    renderDiff(_draftDiff());
    _finishReplyActions(AA.validateDraft(ui.draft), ui._lastDiffs || []);
    setStatus('捆绑包已并进草稿，看过再应用');
    return true;
  }

  // 方向O · 生成版本说明（确定性·无需 API）：汇总已应用改动 + 一键复制
  function _changelogFromLedger(ents) {
    var C = __aaU._COLL_CN || {}, lines = ['## 本次更新', ''];
    ents.forEach(function (e) {
      var sum = String(e.summary || '').replace(/\*\*|__|`/g, '').replace(/^\s*[-*#>]+\s*/gm, '').replace(/\s+/g, ' ').trim();
      if (!sum) sum = String(e.request || '').replace(/\s+/g, ' ').trim();
      if (sum.length > 160) sum = sum.slice(0, 158) + '…';
      var nm = (e.names || []).slice(0, 8).map(function (n) { return (n.op === 'add' ? '新增' : (n.op === 'rm' ? '删除' : '修改')) + (C[n.top] || n.top) + (n.name ? '「' + n.name + '」' : ''); });
      if ((e.names || []).length > 8) nm.push('等 ' + e.names.length + ' 项');
      lines.push('- ' + (sum || '国师的改动') + (nm.length ? '（' + nm.join('、') + '）' : ''));
    });
    return { text: lines.join('\n'), count: ents.length };
  }
  function runChangelogUI() {
    if (ui.running) { setStatus('请等当前运行结束'); return; }
    // 只认改动账：运行记录不知道哪些后来撤销了，拿它兜底会把撤销过的又写进说明
    var L = Ledger();
    var src = L ? L.list(_fileKey(), _fileLabel()).then(function (lst) { return lst.mine || []; }, function () { return []; }) : Promise.resolve([]);
    src.then(function (mine) {
      var ents = mine.filter(function (e) { return !e.undone; }).sort(function (a, b) { return a.ts - b.ts; });
      if (!ents.length) { setStatus(mine.length ? '这个剧本应用过的改动都已撤销，没有要写进版本说明的' : '这个剧本还没有应用过的改动可汇总（应用过国师的改动后，版本说明会自动攒起来）'); return; }
      var cl = _changelogFromLedger(ents);
      _infoCard('版本说明', function () {   // 只读信息卡：不顶掉正在待审的那张
        ui.els.summary.innerHTML = '<b>版本说明（' + cl.count + ' 次改动）<button type="button" class="tm-aa-cl-copy">复制</button></b>'
          + '<div class="tm-aa-cl-md">' + _md(cl.text) + '</div>';
        ui.els.summary.style.display = '';
        var btn = ui.els.summary.querySelector('.tm-aa-cl-copy');
        if (btn) btn.addEventListener('click', function() {
          try { navigator.clipboard.writeText(cl.text).then(function() { btn.textContent = '已复制 ✓'; }, function() { btn.textContent = '复制失败'; }); }
          catch (e) { btn.textContent = '复制失败'; }
        });
      });
      setStatus('版本说明已生成（' + cl.count + ' 次改动，撤销过的不算）· 可复制');
    });
  }

  // 方向L · 剧本问答（只读）：玩家问关于剧本的问题，agent 查清后直接回答，不碰剧本
  function runQaUI() {
    if (ui.running) return;
    if (!_contextReady()) return;
    var question = (ui.els.req.value || '').trim();
    if (!question) { setStatus('先在输入框写下想问的'); return; }
    if (!_guardPendingDraft('问答')) return;
    if (!AA || typeof AA.runAuthoringLoop !== 'function') { setStatus('agent 核心未加载'); return; }
    if (_attState().pending) { setStatus('附件仍在读取，请等待读取完成后再发送'); return; }
    var _attTxt = _attachPrefix(), _textAttachments = _takeTextAttachments();
    resetResults(true);   // 聊天化：保留对话流（结果作为新卡 append，不清历史）
    ui.els.req.value = ''; _autoGrowReq();
    _stampUserMsg(_appendUserMsg(question, { kind: 'qa', input: question }), 'qa');   // 会话流 + 重试/改了重发派发
    _prepareRunDraft('runAuthoringLoop');   // 只读快照或同案卷恢复点
    ui.conversation = null; ui._pendingPlan = false; ui._pendingClarify = false;
    setRunning(true);
    setStatus('正在查证并回答…（只读，不改剧本）');
    _clearAttach();
    _runOwned('runAuthoringLoop', ui.draft, question + _attTxt, {
      conventions: _convForRun(),   /* S9 · 两层约定注入(全局+本剧本) */
      qaOnly: true,
      attachments: _textAttachments,
      editorContext: _editorContext(),
      onStep: function(step) { appendLog(step); _stepStatus(step, '查证 · '); },
      onText: function(text, iter) { appendText(text, iter); }
    }).then(function(res) {
      setRunning(false);
      _logRun('问答', question, res);   // 方向M
      if (!res.finished) { _renderIncomplete(res, 'qa', question); return; }
      _clearDraft(); ui.els.req.value = ''; _autoGrowReq();
      if (res.answer) {
        _beginReplyCard('qa');
        renderAnswer(question, res.answer.answer, true);   // UI·P · 流式
        setStatus(_doneStatus(res, '答完了，只查不改'));
      } else {
        setStatus('没得到回答，可以再问一次');
      }
    }).catch(function(err) { renderError('qa', question, err); });   // UI·AC · 错误卡+重试
  }
  function renderAnswer(question, answer, stream) {
    if (!ui.els || !ui.els.summary) return;
    ui.els.summary.innerHTML = '<span class="tm-aa-stream">' + _md(answer || '（没有回答）') + '</span>';
    ui.els.summary.style.display = '';
    _streamThenLink(ui.els.summary.querySelector('.tm-aa-stream'), stream);   // UI·P 吐字 + UI·AH linkify（只对答案部分）
  }

  // 方向N · 解释/教学（只读）：讲解剧本设计意图与机制脉络，给接手者 onboarding
  function runExplainUI() {
    if (ui.running) return;
    if (!_contextReady()) return;
    if (!AA || typeof AA.runAuthoringLoop !== 'function') { setStatus('agent 核心未加载'); return; }
    if (_attState().pending) { setStatus('附件仍在读取，请等待读取完成后再发送'); return; }
    var _attTxt = _attachPrefix(), _textAttachments = _takeTextAttachments();
    var focus = (ui.els.req.value || '').trim();
    if (!_guardPendingDraft('讲解')) return;
    resetResults(true);   // 聊天化：保留对话流（结果作为新卡 append，不清历史）
    ui.els.req.value = ''; _autoGrowReq();
    _stampUserMsg(_appendUserMsg(focus || '讲解剧本', { kind: 'explain', input: focus }), 'explain');   // 会话流 + 重试/改了重发派发
    _prepareRunDraft('runAuthoringLoop');   // 只读快照或同案卷恢复点
    ui.conversation = null; ui._pendingPlan = false; ui._pendingClarify = false;
    setRunning(true);
    setStatus('正在通读剧本并讲解…（只读，不改剧本）');
    _clearAttach();
    _runOwned('runAuthoringLoop', ui.draft, focus + _attTxt, {
      conventions: _convForRun(),   /* S9 · 两层约定注入(全局+本剧本) */
      explainOnly: true,
      attachments: _textAttachments,
      editorContext: _editorContext(),
      onStep: function(step) { appendLog(step); _stepStatus(step, '通读 · '); },
      onText: function(text, iter) { appendText(text, iter); }
    }).then(function(res) {
      setRunning(false);
      _logRun('讲解', focus || '(全面 onboarding)', res);
      if (!res.finished) { _renderIncomplete(res, 'explain', focus); return; }
      _clearDraft(); ui.els.req.value = ''; _autoGrowReq();
      if (res.explanation) {
        _beginReplyCard('explain');
        renderExplanation(res.explanation, true);   // UI·P · 流式
        setStatus(_doneStatus(res, '讲完了，只讲不改'));
      } else {
        setStatus('没讲出来，可以再试一次');
      }
    }).catch(function(err) { renderError('explain', focus, err); });   // UI·AC · 错误卡+重试
  }
  function renderExplanation(ex, stream) {
    if (!ui.els) return;
    if (ui.els.summary) {
      ui.els.summary.innerHTML = '<b>剧本讲解</b><span class="tm-aa-stream">' + _md((ex && ex.summary) || '（没有总览）') + '</span>'; ui.els.summary.style.display = '';
      _streamThenLink(ui.els.summary.querySelector('.tm-aa-stream'), stream);   // UI·P 吐字 + UI·AH linkify（总览部分）
    }
    ui.els.diffSec.style.display = ''; ui.els.diff.style.display = '';
    var points = (ex && ex.points) || [];
    ui.els.diffSec.textContent = '要点 · ' + points.length + ' 条';
    if (!points.length) { ui.els.diff.innerHTML = '<div class="ln">（没有分要点）</div>'; return; }
    ui.els.diff.innerHTML = points.slice(0, 20).map(function(p, i) {
      p = p || {};
      return '<div class="plan-step"><span class="ps-n">' + (i + 1) + '</span><span><b>' + esc(p.topic || '') + '</b><div class="iss">' + _md(p.detail || '') + '</div></span></div>';
    }).join('');
  }

  // UI·AC · 错误态卡片 + 一键重试（Claude.ai/ChatGPT 网页端范式）：失败不再只是一行灰状态字，
  //   渲一张醒目错误卡（核心已 _classifyApiError 给中文可操作提示）+「重试」(按 kind 重跑) +「复制错误」。
  function renderError(kind, request, err) {
    if (!ui._runOutcome) ui._runOutcome = 'error';
    setRunning(false);
    if (err && err.code === 'editor-document-changed') {
      ui._lastErr = null; // 旧请求不能通过“重试”重新套到当前案卷。
      if (ui.els && ui.els.actions) ui.els.actions.style.display = 'none';
      setStatus(err.message);
      return;
    }
    ui._lastErr = { kind: kind, request: request || '', message: (err && err.message) || String(err || '未知错误'), owner: ui._draftOwner };
    if (!ui.els) { setStatus('失败：' + ui._lastErr.message); return; }
    _beginReplyCard(kind);   // 错误也作为对话流里一张卡
    if (!ui.els.summary) { setStatus('失败：' + ui._lastErr.message); return; }
    ui.els.summary.innerHTML = '<div class="tm-aa-errcard">'
      + '<div class="ec-head">' + _icon('alert', 15) + '这一轮出错了</div>'
      + '<div class="ec-msg">' + esc(ui._lastErr.message) + '</div>'
      + (ui._recovery ? '<div class="note" style="margin-top:6px">没应用的草稿、任务清单和对话都留着，可以接着做。</div>' : '')
      + '<div class="ec-acts"><button type="button" class="ec-copy">' + _icon('copy', 13) + '复制错误</button></div>'
      + '</div>';
    ui.els.summary.style.display = '';
    if (ui.els.diffSec) ui.els.diffSec.style.display = 'none';
    if (ui.els.diff) ui.els.diff.style.display = 'none';
    if (ui.els.val) ui.els.val.style.display = 'none';
    if (ui.els.actions) ui.els.actions.style.display = 'none';
    _recoveryButtons(ui.els.summary.querySelector('.tm-aa-errcard'), ui._lastErr);
    // 流式回复在路上被传坏（正文不成 JSON / 事件流断开）：多半是中转不善流式，给个一键关掉实时显示
    var ecode = (err && (err.code || (err.cause && err.cause.code))) || '';
    if (_streamOn() && (/^authoring-response-(invalid-json|incomplete-stream|invalid-event)$/.test(ecode) || /事件流|不符合 JSON 格式/.test(ui._lastErr.message))) {
      var ec = ui.els.summary.querySelector('.tm-aa-errcard'), tip = document.createElement('div');
      tip.className = 'note ec-stream';
      tip.innerHTML = '有的中转会把边说边传的回复传坏。关掉「实时显示」后回复整段返回，通常就好了。<button type="button" class="tm-aa-btn ghost ec-stream-off">关掉实时显示</button>';
      ec.insertBefore(tip, ec.querySelector('.ec-acts'));
      tip.querySelector('.ec-stream-off').addEventListener('click', function () { _setStreamPref(false); this.disabled = true; this.textContent = '已关，再试一次即可'; });
    }
    var cp = ui.els.summary.querySelector('.ec-copy');
    if (cp) cp.addEventListener('click', function() {
      try { navigator.clipboard.writeText(ui._lastErr.message).then(function() { cp.textContent = '已复制'; setTimeout(function() { cp.innerHTML = _icon('copy', 13) + '复制错误'; }, 900); }, function() {}); } catch (e) {}
    });
    setStatus(ui._recovery ? '出错了：草稿和对话都留着，可以接着做' : '出错了：可以再试一次，或从当前剧本重来');
  }
  function _retryLast(expected) {
    var e = ui._lastErr; if (!e || ui.running) return;
    if (expected && expected !== e) { setStatus('此恢复入口已过期'); return; }
    if (!_contextReady() || !_ownerCurrent(e.owner)) return;
    if (ui._recovery) {
      if (!_recoveryReady(ui._recovery)) { setStatus(_recoveryError().message); return; }
      if (ui.planMode && !ui._recovery.planOnly && !ui._recovery.reviewOnly && !ui._recovery.qaOnly && !ui._recovery.explainOnly && e.kind !== 'plan-execute') { setStatus('当前为问策，不能续做写入任务；请切换共审/放行或重新规划'); return; }
      ui._resumeNext = true;
    }
    ui.els.req.value = e.request || '';
    try { ui.els.req.dispatchEvent(new Event('input')); } catch (er) {}
    _dispatchRetry(e.kind);
  }

  // 方向H · 子代理/任务分解：大需求先分解、再逐步在同一草稿上聚焦执行（共享草稿即合并）
  function runOrchestratedUI() {
    if (ui.running) return;
    if (!_contextReady()) return;
    if (ui.planMode) { setStatus('问策仅规划；分解执行前请切换为共审/放行，或先生成并批准计划。'); return; }
    var request = (ui.els.req.value || '').trim();
    if (!request) { setStatus('请先输入需求（大任务会被分解为多步执行）'); return; }
    if (!AA || typeof AA.runOrchestrated !== 'function') { setStatus('agent 核心未加载'); return; }
    if (_attState().pending) { setStatus('附件仍在读取，请等待读取完成后再发送'); return; }
    var _attTxt = _attachPrefix(), _textAttachments = _takeTextAttachments();
    if (!_guardPendingDraft('分解编排')) return;
    resetResults(true);   // 聊天化：保留对话流（结果作为新卡 append，不清历史）
    ui.els.req.value = ''; _autoGrowReq();
    _stampUserMsg(_appendUserMsg(request, { kind: 'orchestrate', input: request }), 'orchestrate');   // 会话流 + 重试/改了重发派发
    ui._lastRequest = request;
    _prepareRunDraft('runOrchestrated');
    ui.conversation = null; ui._pendingPlan = false;
    setRunning(true);
    setStatus('正在分解任务…（先拆子任务，再逐步执行）');
    // UI·D · 步骤清单 + 实时勾：分解任务渲染成清单，子任务 待办○/进行中⟳/完成✓ 实时更新
    var _clSteps = [], _clEl = null;
    function _renderChecklist(currentIdx, allDone) {
      if (!_clSteps.length || !ui.els) return;
      if (!_clEl) {
        _clEl = document.createElement('div'); _clEl.className = 'tm-aa-checklist';
        ui.els.logWrap.style.display = '';
        ui.els.log.appendChild(_clEl);   // 跟在这一轮的话后面（原先插在整个流最上头，多轮后找不到）
      }
      _clEl.innerHTML = '<div class="cl-head">拆成 ' + _clSteps.length + ' 步' + (allDone ? '（都做完了）' : '') + '</div>' + _clSteps.map(function(s, k) {
        var st = (allDone || k < currentIdx) ? 'done' : (k === currentIdx ? 'run' : 'pend');
        var ic = st === 'done' ? '✓' : (st === 'run' ? '⟳' : '○');
        return '<div class="cl-item ' + st + '"><span class="cl-ic">' + ic + '</span>' + esc((k + 1) + '. ' + s) + '</div>';
      }).join('');
    }
    _clearAttach();
    _runOwned('runOrchestrated', ui.draft, request + _attTxt, {
      conventions: _convForRun(),   /* S9 · 两层约定注入(全局+本剧本) */
      attachments: _textAttachments,
      editorContext: _editorContext(),
      allowedCollections: ui.allowedCollections || null,
      allowDestructive: ui.allowDestructive !== false,
      exemplars: _exemplars(),                              // 方向J · 从剧本已有实体学丰满度（治空内容）
      memory: _buildMemory(),                               // 跨会话记忆：注入近期已做的事
      onStep: function(step) { appendLog(step); },
      onText: function(text, iter) { appendText(text, iter); },
      onSubtask: function(p) {
        if (p.phase === 'decompose') setStatus('正在分解任务…');
        else if (p.phase === 'plan') { _clSteps = p.steps || []; _renderChecklist(-1, false); setStatus('已分解为 ' + _clSteps.length + ' 个子任务'); }
        else if (p.phase === 'single') setStatus('任务较简单，直接执行…');
        else if (p.phase === 'subtask') { _renderChecklist(p.index - 1, false); setStatus('执行子任务 ' + p.index + '/' + p.total + '…'); }
      }
    }).then(function(res) {
      setRunning(false);
      _captureSideEffects(res, false);
      if (!res.finished) { _renderIncomplete(res, 'orchestrate', request); return; }
      if (_clSteps.length) _renderChecklist(_clSteps.length, true);   // 全部 ✓
      _logRun('分解执行', request, res);   // 方向M
      ui.els.req.value = ''; _autoGrowReq();
      _beginReplyCard('orchestrate');
      renderSummary(res.summary, null, null, true);   // UI·P · 流式
      var diffs = _draftDiff();
      renderDiff(diffs);
      var _vdOr = _finishReplyActions(res.finalValidation, diffs);
      setStatus(_doneStatus(res, res.orchestrated ? '分成 ' + res.steps.length + ' 步完成了' : '完成了'));
      _autoApplyFinished(res, _vdOr);
    }).catch(function(err) { renderError('orchestrate', request, err); });   // UI·AC · 错误卡+重试
  }

  // ───────────────────────────────────────────────
  //  刀3 · 对抗式三角色（三堂会审）：国师拟稿 → 史官查史+谏官批平衡 → 据谏修订 → 走 diff/应用审
  //  入口走「武装」式：点 🏛️ chip 武装，玩家写需求后点发送即走会审（区别于普通生成）。引擎在 AA.runWithCritics。
  // ───────────────────────────────────────────────
  var _REQ_PLACEHOLDER = '跟国师说要改什么，比如：给主角势力补两个文官，要有籍贯和派系';
  function _armAutoMode() {
    if (ui._criticsArmed) _disarmCriticsVisual();
    ui._autoModeArmed = true;
    if (!ui.running) _goIdleFace();
    if (ui.els && ui.els.req) { ui.els.req.placeholder = '【智选】写下要做的事，国师只为这一次挑最合适的做法'; ui.els.req.focus(); }
    setStatus('下一次发送由国师挑做法（直接改 / 先计划 / 分解编排 / 三堂会审）。只管这一次，不改权限模式');
  }
  function _disarmAutoVisual() {
    ui._autoModeArmed = false;
    if (!ui.running) _goIdleFace();
    if (ui.els && ui.els.req && !ui._criticsArmed && !ui.running) ui.els.req.placeholder = _REQ_PLACEHOLDER;
  }
  function _armCritics() {
    if (ui._autoModeArmed) _disarmAutoVisual();
    ui._criticsArmed = true;
    if (!ui.running) _goIdleFace();
    if (ui.els && ui.els.req) { ui.els.req.placeholder = '【三堂会审】写下要新增或修改什么：国师拟稿，史官查史实、谏官批平衡，据谏修订后交你过目'; ui.els.req.focus(); }
    setStatus('三堂会审已备好：写下要求再发送。会比平常多两三次调用');
  }
  function _disarmCriticsVisual() {
    ui._criticsArmed = false;
    if (!ui.running) _goIdleFace();
    if (ui.els && ui.els.req && !ui._autoModeArmed && !ui.running) ui.els.req.placeholder = _REQ_PLACEHOLDER;
  }
  function runWithCriticsUI() {
    if (!_contextReady()) return;
    if (ui.running) return;
    if (ui.planMode) { setStatus('问策仅规划；三堂会审包含实际拟稿，请先切换为共审/放行。'); return; }
    var request = (ui.els.req.value || '').trim();
    if (!request) { _armCritics(); setStatus('三堂会审需要一个需求：先写下要新增/改什么，再点发送'); return; }
    if (!AA || typeof AA.runWithCritics !== 'function') { setStatus('agent 核心未加载'); return; }
    if (_attState().pending) { setStatus('附件仍在读取，请等待读取完成后再发送'); return; }
    var _attTxt = _attachPrefix(), _textAttachments = _takeTextAttachments();
    if (!_guardPendingDraft('三堂会审')) return;
    resetResults(true);   // 聊天化：保留对话流（结果作为新卡 append，不清历史）
    ui.els.req.value = ''; _autoGrowReq();
    _stampUserMsg(_appendUserMsg(request, { kind: 'critics', input: request }), 'critics');
    ui._lastRequest = request;
    _prepareRunDraft('runWithCritics');
    ui.conversation = null; ui._pendingPlan = false;
    setRunning(true);
    setStatus('三堂会审 · 国师拟稿中…');
    _beginReplyCard('critics');   // 会审开始就建卡，进度清单 + 两官报告 + 修订改动都进同一张卡
    var _card = ui._reply;
    var _phase = { draft: 'run', review: 'pend', revise: 'pend' }, _info = { hist: null, bal: null }, _el = null;
    function _render(done) {
      if (!ui.els) return;
      if (!_el) { _el = document.createElement('div'); _el.className = 'tm-aa-checklist'; var _anchor = _card && _card.querySelector('.tm-aa-summary'); if (_card && _anchor) _card.insertBefore(_el, _anchor); else if (ui.els.log) ui.els.log.insertBefore(_el, ui.els.log.firstChild); }
      function row(st, label) { var ic = st === 'done' ? '✓' : (st === 'run' ? '⟳' : '○'); return '<div class="cl-item ' + st + '"><span class="cl-ic">' + ic + '</span>' + label + '</div>'; }
      var rv = (_info.hist != null) ? ('（史官 ' + _info.hist + ' 条 · 谏官 ' + _info.bal + ' 条）') : '';
      _el.innerHTML = '<div class="cl-head">三堂会审' + (done ? '（已完成）' : '') + '</div>'
        + row(_phase.draft, '① 国师拟稿') + row(_phase.review, '② 史官查史实 + 谏官批平衡' + rv) + row(_phase.revise, '③ 国师据谏修订');
    }
    _render(false);
    _clearAttach();
    _runOwned('runWithCritics', ui.draft, request + _attTxt, {
      conventions: _convForRun(),   /* S9 · 两层约定注入(全局+本剧本) */
      attachments: _textAttachments,
      editorContext: _editorContext(),
      allowedCollections: ui.allowedCollections || null,
      allowDestructive: ui.allowDestructive !== false,
      exemplars: _exemplars(),
      memory: _buildMemory(),
      onStep: function(step) { appendLog(step); },
      onText: function(text, iter) { appendText(text, iter); },
      onCritique: function(p) {
        if (p.phase === 'draft') { _phase.draft = 'run'; setStatus('三堂会审 · 国师拟稿中…'); }
        else if (p.phase === 'review') { _phase.draft = 'done'; _phase.review = 'run'; setStatus('三堂会审 · 史官与谏官同时审阅中…'); }
        else if (p.phase === 'revise') { _phase.review = 'done'; _phase.revise = 'run'; setStatus('三堂会审 · 国师据谏修订中…'); }
        _render(false);
      }
    }).then(function(res) {
      setRunning(false);
      // 拟稿阶段被国师进谏/澄清打断 → 渲染对应卡片，提示玩家调整需求后重新发起（会审不做续接，避免与主流程纠缠）
      if (res.stopReason === 'needsConfirmation' && res.remonstrance) { _logRun('三堂会审', request, res); renderRemonstrance(res.remonstrance); setStatus('国师对此需求有异议（见上）· 调整需求后可重新发起三堂会审'); return; }
      if (res.stopReason === 'needsClarification' && res.clarification) { _logRun('三堂会审', request, res); renderClarify(res.clarification.questions); setStatus('国师拟稿前需澄清（见上）· 补充需求后可重新发起三堂会审'); return; }
      _captureSideEffects(res, false);
      if (!res.finished) { _renderIncomplete(res, 'critics', request); return; }
      _info.hist = ((res.critiques && res.critiques.history && res.critiques.history.findings) || []).length;
      _info.bal = ((res.critiques && res.critiques.balance && res.critiques.balance.findings) || []).length;
      _phase.draft = 'done'; _phase.review = 'done'; _phase.revise = 'done'; _render(true);
      _logRun('三堂会审', request, res);
      ui.els.req.value = ''; _autoGrowReq();
      renderCriticsReport(res);
      var diffs = _draftDiff();
      renderDiff(diffs);
      var val = res.finalValidation || AA.validateDraft(ui.draft);
      var _vdCr = renderValidation(val);
      if (diffs.length || (ui._pendingSideEffects || []).length) _vdCr = _finishReplyActions(val, diffs);
      setStatus(_doneStatus(res, '三堂会审完了，' + (res.revised ? '已据谏修订' : '两官没有异议')));
      _autoApplyFinished(res, _vdCr);
    }).catch(function(err) { renderError('critics', request, err); });
  }
  // 刀3 · 会审报告：史官 + 谏官两份意见并列展示（只读·让玩家看到博弈），修订后的 diff 在下方走应用审
  function renderCriticsReport(res) {
    if (!ui.els || !ui.els.summary) return;
    function block(icon, title, rev) {
      var fs = (rev && rev.findings) || [];
      var head = '<b>' + title + ' · ' + fs.length + ' 条</b>' + (rev && rev.summary ? '<div class="note" style="margin:0 0 4px">' + esc(rev.summary) + '</div>' : '');
      if (!fs.length) return head + '<div class="ln" style="color:var(--ok);margin:2px 0 10px">没有异议</div>';
      var sevRank = { '高': 0, '中': 1, '低': 2 };
      fs = fs.slice().sort(function(a, b) { return (sevRank[a && a.severity] != null ? sevRank[a.severity] : 3) - (sevRank[b && b.severity] != null ? sevRank[b.severity] : 3); });
      return head + '<div class="tm-aa-diff" style="margin:4px 0 10px">' + fs.slice(0, 20).map(function(f) { return __aaU._findingHtml(f); }).join('') + '</div>';
    }
    var hist = (res.critiques && res.critiques.history) || null;
    var bal = (res.critiques && res.critiques.balance) || null;
    ui.els.summary.innerHTML = '<b>三堂会审</b><span class="tm-aa-stream">' + _md(res.summary || '') + '</span>'
      + '<div class="tm-aa-cl-md">' + block('', '史官 · 查史实', hist) + block('', '谏官 · 批平衡与可玩', bal) + '</div>'
      + (res.revised ? '<div class="note">下面的改动是国师据两官意见修订后的终稿。</div>'
                     : '<div class="note">两官没提要改的，下面就是拟稿终稿。</div>');
    ui.els.summary.style.display = '';
  }

  // UI·Q · 停止/中断生成：调 agent core 的 abort()（立即取消在途请求·不施未完成的改动）。
  // 适用于所有运行类型(普通编辑/计划执行/审阅/问答/讲解/分解执行)——abort() 终止当前 _activeRun。
  function onStop() {
    if (!ui.running || ui._stopping) return;
    ui._stopping = true;
    ui._runOutcome = 'stopped';
    var stopped = false;
    try { stopped = !!(AA && AA.abort && AA.abort()); } catch (e) {}
    if (ui.els && ui.els.go) { ui.els.go.innerHTML = '<span class="lv-spin" style="display:inline-block;width:12px;height:12px;border-radius:50%;border:1.6px solid rgba(253,238,221,.4);border-top-color:#fdeedd;animation:tm-aa-spin .8s linear infinite"></span>'; ui.els.go.disabled = true; }
    _cancelTypewriter();   // 打字机若在途也立即落定
    setStatus(stopped ? '正在停下…（已撤回在途请求，没做完的改动不会落下）' : '眼下没有在跑的');
  }
  // 「生成」键的统一入口：运行中→停止，空闲→生成
  function onGoClick() { if (ui.running) onStop(); else { _pushPromptHistory(ui.els.req.value); onGenerate(); } }

  // 刀G9(CC message queue 对照) · 运行中插话：agent 跑着时在输入框回车 → 新指示排队·
  //   本轮工具结果落定后注入(agent 下一轮即见·"完成当前一步后必须处理")·不打断当前轮。
  function onSteer() {
    if (!ui.running || ui._stopping) return;
    var t = (ui.els.req.value || '').trim();
    if (!t) return;
    var okQ = false;
    try { okQ = !!(AA && typeof AA.steer === 'function' && AA.steer(t)); } catch (e) {}
    if (!okQ) { setStatus('插话未送达（运行正在收尾）· 可等本轮结束后作为追加需求发送'); return; }
    _appendUserMsg('（插话）' + t, { kind: 'steer', input: t });   // 气泡回显·retry 时按普通需求重发
    ui.els.req.value = ''; _autoGrowReq();
    setStatus('已插话 · agent 完成当前一步后会按你的新指示调整');
  }

  function onGenerate() {
    if (ui.running) return;
    if (!_contextReady()) return;
    if (ui._recovery && ui.draft && ui._recovery.method !== 'runAuthoringLoop') {
      if (!_recoveryReady(ui._recovery)) { setStatus(_recoveryError().message); return; }
      ui._resumeNext = true;
      if (ui._recovery.method === 'runOrchestrated') { runOrchestratedUI(); return; }
      if (ui._recovery.method === 'runWithCritics') { runWithCriticsUI(); return; }
    }
    if (ui._criticsArmed) { _disarmCriticsVisual(); runWithCriticsUI(); return; }   // 刀3 · 已武装会审 → 改走三堂会审
    var request = (ui.els.req.value || '').trim();
    if (!request) { setStatus('请先输入需求'); return; }
    if (!AA || typeof AA.runAuthoringLoop !== 'function') { setStatus('agent 核心未加载'); return; }
    if (_attState().pending) { setStatus('附件仍在读取，请等待读取完成后再发送'); return; }
    var _autoSelection = null;
    if (ui._autoModeArmed && typeof AA.selectWorkMode === 'function') {
      _autoSelection = AA.selectWorkMode(request, ui.adapter && ui.adapter.getScenario ? ui.adapter.getScenario() : null, { permissionMode: _loadPerm().mode });
      _disarmAutoVisual();
      if (_autoSelection.mode === 'orchestrate') { setStatus('自动选择 → 分解编排：' + _autoSelection.reason); runOrchestratedUI(); return; }
      if (_autoSelection.mode === 'critics') { setStatus('自动选择 → 三堂会审：' + _autoSelection.reason); runWithCriticsUI(); return; }
    }
    if (ui._pendingClarify) ui._pendingClarify = false;   // 聊天化：玩家发送即视为对上轮进谏/澄清的回应，走续接（无独立按钮）
    var planOnly = !!ui.planMode || !!(_autoSelection && _autoSelection.mode === 'plan');   // 权限问策或手动自动选模判为计划
    // 真·连续会话：只要对话线程还在就续接（哪怕上一轮已应用·draft 已清）。计划模式总从当前剧本起新计划。
    //   ——治「每发一条指令都是新对话」：之前续接还要求 ui.draft，应用后 draft 没了就被迫重置；现在线程贯穿整个会话。
    var resuming = !!(ui._recovery && ui._recovery.method === 'runAuthoringLoop' && ui.draft);
    if (resuming && !_recoveryReady(ui._recovery)) { setStatus(_recoveryError().message); return; }
    var continuing = resuming || (!planOnly && !!(ui.conversation && ui.conversation.length && !ui._pendingPlan));
    ui._resumeNext = false;
    var _attTxt = _attachPrefix();   // S2 · 文本附件内联为参考上下文
    var _imgs = _takeImages();       // S2 · 图片走视觉通道
    var _textAttachments = _takeTextAttachments(); // 大文件正文由 readAttachment 分段读取
    var _attN = (_imgs ? _imgs.length : 0) + _attState().files.length;
    resetResults(continuing);   // UI·B · 会话流：续接保留线程+消息流、新对话清空
    var _ub = _appendUserMsg(request + (_attN ? '（附 ' + _attN + ' 件）' : ''), { input: request });    // 回显用户消息气泡
    _stampUserMsg(_ub, 'generate');
    if (_ub && !continuing) { _ub._convBefore = null; _ub._draftDiff = null; }   // 这句开的是新话头
    if (!/^继续完成上面尚未完成的改动/.test(request)) ui._lastRequest = request;   // 记进改动账的标题（自动续做那句不算）
    ui.els.req.value = ''; _autoGrowReq();   // 发出去就清空输入框（运行中再打字就是插话）
    setRunning(true);
    var _autoPrefix = _autoSelection ? ('自动选择 → ' + _autoSelection.label + '（' + _autoSelection.reason + '）· ') : '';
    setStatus(_autoPrefix + (planOnly ? '正在规划…（agent 先只读、出计划）' : '正在生成…（agent 多轮编辑+自校验，可能需要数十秒）'));
    if (!continuing) { _startDraft(); if (!planOnly) ui.conversation = null; }
    else if (!ui.draft) { _startDraft(); }   // 续接但上轮已应用 → 从当前(已更新)剧本新建 draft，对话线程保留

    var _rtd = (continuing && ui._restoredTodos && ui._restoredTodos.length) ? ui._restoredTodos : null;   // 刀H3 · 恢复的任务表一次性回灌
    ui._restoredTodos = null;
    ui._planAttachments = planOnly ? _textAttachments.slice() : null;
    _clearAttach();   // S2 · 附件随本轮发出·签行清空
    _runOwned('runAuthoringLoop', ui.draft, request + _attTxt, {
      conventions: _convForRun(),   /* S9 · 两层约定注入(全局+本剧本) */
      planOnly: planOnly,
      images: _imgs,
      attachments: _textAttachments,
      initialTodos: _rtd,
      priorConversation: continuing ? ui.conversation : null,
      memory: continuing ? '' : _buildMemory(),             // 跨会话记忆：新对话才注入历史；续接已在线程里
      runHistory: continuing ? '' : _runHistoryBrief(),     // 刀③D2 · 运行教训回喂（新对话首轮）
      microPlanConfirm: _microPlanOn(),                     // 刀③D1 · 歧义先对齐微计划（默认开·＋菜单可关）
      editorContext: _editorContext(),
      allowedCollections: ui.allowedCollections || null,   // 方向F · 范围沙箱
      allowDestructive: ui.allowDestructive !== false,      // 方向F · 危险操作开关
      exemplars: _exemplars(),                              // 方向J · 从剧本已有实体学丰满度（治空内容）（开关式）
      onStep: function(step) { appendLog(step); _stepStatus(step); },
      onText: function(text, iter) { appendText(text, iter); }
    }).then(function(res) {
      setRunning(false);
      ui.conversation = res.conversation;   // 维度1 · 存住线程
      _saveSession(res, request, res.remonstrance ? '进谏' : (res.clarification ? '澄清' : (res.plan ? '计划' : '编辑')));   // S5 · 落盘到当前会话(跨刷新/跨剧本可切回)
      _captureSideEffects(res, continuing);   // saveMemory/saveSkill 先暂存，随草稿一起批准/放弃
      // 自动续接：未完成且因轮次/token 上限停 → 自动发「继续」续接（复用连续会话线程·持续调用直到完整·安全上限 3 次）。
      if (!planOnly && !res.finished && (res.stopReason === 'maxIterations' || res.stopReason === 'tokenBudget') && (ui._autoCont || 0) < 3) {
        ui._autoCont = (ui._autoCont || 0) + 1;
        setStatus('这一轮' + (res.stopReason === 'tokenBudget' ? '的 token 预算' : '的轮数') + '用完了还没做完，接着做（第 ' + ui._autoCont + '/3 次）…');
        ui.els.req.value = '继续完成上面尚未完成的改动，全部完成后再调用 finish，不要重复已做的。';
        var nextOwner = ui._draftOwner, nextConversation = ui.conversation;
        setTimeout(function() { if (_ownerCurrent(nextOwner) && ui.conversation === nextConversation) onGenerate(); }, 60);
        return;
      }
      ui._autoCont = 0;
      _logRun(res.remonstrance ? '进谏' : (res.clarification ? '澄清' : (res.plan ? '计划' : '编辑')), request, res);   // 方向M · 记一条历史
      ui.els.req.value = ''; _autoGrowReq();
      var stopMap = { finish: '完成', maxIterations: '达迭代上限', tokenBudget: '达 token 上限', outputLimit: '达单次输出上限', finishBlocked: '校验未过·已停', noToolCalls: 'agent 未再操作', aborted: '已停止', planned: '已出计划', needsClarification: '需澄清', needsConfirmation: '需定夺' };
      if (res.clarification) {              // 方向K · 交互式澄清：气泡 + 输入框作答续接（聊天化·无独立按钮）
        ui._pendingPlan = false; ui._pendingClarify = true;
        renderClarify(res.clarification.questions);
        setStatus('国师有几点想先问清楚，在下面作答，发出去就接着干');
      } else if (res.remonstrance) {        // 刀1 · 国师进谏：气泡 + 输入框回应续接（聊天化·无独立按钮）
        ui._pendingPlan = false; ui._pendingClarify = true;
        renderRemonstrance(res.remonstrance);
        setStatus('国师有异议：采纳、坚持（说说理由）或换个要求，发出去就接着干');
      } else if (res.plan) {                // 计划模式：展示计划 + 批准/重规划（进对话流回应卡）
        _beginReplyCard('plan');
        renderPlan(res.plan);
        ui.els.actions.style.display = '';
        ui.els.apply.className = 'reply-apply plan-approve';
        ui.els.apply.textContent = '批准并执行';
        ui.els.discard.textContent = '不要这个计划';
        ui._pendingPlan = true;
        setStatus('计划出来了：批准就照着做；想改就直接说哪里不对');
      } else if (planOnly) {
        ui._pendingPlan = false;
        ui.els.actions.style.display = 'none';
        setStatus('问策停下了（' + (stopMap[res.stopReason] || res.stopReason) + '），没出可批的计划，剧本没动');
      } else {                              // 普通：改动折子 + 应用（进对话流回应卡）
        if (!res.finished) { _renderIncomplete(res, 'generate', request); return; }
        _beginReplyCard();
        ui._pendingPlan = false;
        renderSummary(res.summary, res.notes, res.suggestedConventions, true);   // UI·P · 流式
        var diffs = _draftDiff();
        renderDiff(diffs, res.uncertainties);   // 置信度标注：高亮没把握的改动
        var _vdGen = (diffs.length || (ui._pendingSideEffects || []).length) ? _finishReplyActions(res.finalValidation, diffs) : renderValidation(res.finalValidation);
        if (!diffs.length) { ui.els.diffSec.style.display = 'none'; ui.els.diff.style.display = 'none'; if (_vdGen.ok) ui.els.val.style.display = 'none'; }
        setStatus(_doneStatus(res, res.completion && res.completion.status === 'unchanged' ? '看过了' : '完成了'));
        // 放行：做完且没带来新问题就自动应用（无需点）
        _autoApplyFinished(res, _vdGen);
      }
    }).catch(function(err) { renderError('generate', request, err); });   // UI·AC · 错误卡+重试（重试走 onGenerate·仍按当前 planMode）
  }

  // UI·X · 逐条接受/拒绝：永远从实时剧本起只落接受 hunk；全接受也不能整份旧草稿覆盖用户并行编辑。
  function _applyScenario() {
    if (!_ownerCurrent(ui._draftOwner)) throw _ownerError();
    var diffs = ui._lastDiffs || [], rej = ui._diffRejected || new Set();
    if (AA && typeof AA.applySelectedDiffs === 'function') {
      return AA.applySelectedDiffs(ui.adapter.getScenario(), ui.draft, diffs, function(d) { return !rej.has(d.__idx); });
    }
    throw new Error('缺少安全的逐项应用器，已拒绝覆盖当前剧本');
  }

  // 选择性应用会破坏原草稿内部一致性，因此按“相对实时剧本新增的问题”重新跑结构+运行时契约。
  function _validateSelectedScenario(live, candidate) {
    var groups = ['admin-population', 'faction-refs', 'region-coverage', 'timeline-compliance', 'char-completeness', 'relation-consistency', 'runtime-chars', 'runtime-office', 'runtime-boot'];
    var added = [];
    groups.forEach(function(group) {
      var before = AA.validateDraft(live, group), after = AA.validateDraft(candidate, group);
      var known = {};
      (before.violations || []).forEach(function(v) { known[v] = 1; });
      (after.violations || []).forEach(function(v) { if (!known[v]) added.push(v); });
    });
    if (AA.preflight) {
      var beforePf = AA.preflight(live), afterPf = AA.preflight(candidate), knownBlockers = {};
      (beforePf.blockers || []).forEach(function(v) { knownBlockers[v] = 1; });
      (afterPf.blockers || []).forEach(function(v) { if (!knownBlockers[v]) added.push(v); });
    }
    return { ok: added.length === 0, violations: added, results: {}, stats: { checked: groups.length, failed: added.length ? 1 : 0 } };
  }

  // 元素级归一（onApply 用·2026-08-10 堵双编码洞）：数组集合内混入的字符串条目多为 LLM 双编码的
  //   实体 JSON（偶套 ```json 围栏）→ parse 回对象/数组；无法解析返回 null → 丢弃计数。
  //   与 editor-authoring-agent.js 的 _coerceEntityValue 同规：写入侧拦新，这里兜存量草稿。
  function _coerceArrElem(s) {
    var t = String(s).trim(), m = t.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
    if (m) t = m[1].trim();
    try { var p = JSON.parse(t); return (p && typeof p === 'object') ? p : null; } catch (e) { return null; }
  }

  function _commitPendingSideEffects() {
    var effects = ui._pendingSideEffects || [];
    if (!effects.length) return 0;
    if (!AA || typeof AA.commitSideEffects !== 'function') throw new Error('缺少记忆/技能提交器，未确认保存');
    var result = AA.commitSideEffects(effects);
    if (!result || result.ok !== true) throw new Error((result && result.error) || '记忆/技能提交未确认');
    return effects.length;
  }
  async function onApply() {
    if (ui.running || !_contextReady()) return;
    var unfinished = !!(!ui._pendingClarify && !ui._pendingPlan && ui._completion && !/^(completed|unchanged|planned)$/.test(ui._completion.status));
    if (unfinished && !ui._partialApplyConfirmed) {
      ui._partialApplyConfirmed = true;
      ui.els.apply.textContent = '再点一下：确认应用部分结果';
      setStatus('任务还没完成。再点一下就只应用眼下采纳的这几处，没完成的另说'); return;
    }
    if (ui._pendingClarify) {   // 方向K · 提交澄清回答 → 续接 onGenerate（输入框里是玩家的回答）
      if (!(ui.els.req.value || '').trim()) { setStatus('请先在输入框回答问题'); return; }
      ui._pendingClarify = false;
      onGenerate();   // ui.draft + ui.conversation 仍在 → 作为续接运行，把回答当追加需求
      return;
    }
    if (ui._pendingPlan) { ui._pendingPlan = false; executePlan(); return; }   // 计划模式：批准 → 执行
    if (!ui.draft) {
      try { console.warn('[国师 onApply] 无待应用 draft · pendingClarify=' + !!ui._pendingClarify + ' pendingPlan=' + !!ui._pendingPlan + ' lastDiffs=' + ((ui._lastDiffs || []).length) + ' reply=' + !!ui._reply); } catch (e) {}
      setStatus('应用未生效：当前没有待应用的草稿（本轮可能没产出改动，或草稿已被清空）· 可重发需求');
      return;
    }
    try {
      var diffs = ui._lastDiffs || [], rej = ui._diffRejected || new Set();
      if (!diffs.length) {
        if (!(ui._pendingSideEffects || []).length) { setStatus('本轮没有可应用的改动'); return; }
        var onlyEffects = _commitPendingSideEffects();
        markLastApplied();
        setStatus('已提交 ' + onlyEffects + ' 条记忆/技能，未改动剧本' + (unfinished ? '（任务仍有未完成项）' : ''));
        if (ui._reply) { ui._reply.classList.add('applied'); var effectTag = ui._reply.querySelector('.reply-tag'); if (effectTag) effectTag.textContent = '✓ 记忆/技能已提交' + (unfinished ? '（任务未完成）' : ''); }
        _freezeLastReply(); _clearDraft(); return;
      }
      if (diffs.length && rej.size >= diffs.length) { setStatus('已拒绝全部改动，未应用'); return; }
      var _liveBefore = ui.adapter.getScenario();
      var _finalSc = _applyScenario();
      var _fixN = 0, _dropN = 0;   // 元素级归一计数：字符串条目 parse 修复 / 无法解析丢弃
      ['characters', 'factions', 'parties', 'classes', 'items', 'events', 'families', 'relations', 'factionRelations', 'rigidHistoryEvents', 'timeline', 'openingLetters', 'goals'].forEach(function (f) {
        if (!_finalSc || _finalSc[f] == null) return;
        if (!Array.isArray(_finalSc[f])) {
          var _v = _finalSc[f];
          if (typeof _v === 'object') {
            var _ks = Object.keys(_v);
            // 数字键对象→还原数组；命名对象（单条漏包数组）→包成 [实体]
            _finalSc[f] = (_ks.length && _ks.every(function (k) { return /^\d+$/.test(k); })) ? _ks.map(function (k) { return _v[k]; }) : [_v];
          } else { _finalSc[f] = [_v]; }
        }
        // 元素级归一：数组内字符串条目（LLM 双编码 JSON）parse 回对象；无法解析的丢弃·防污染写回链
        _finalSc[f] = _finalSc[f].reduce(function (acc, it) {
          if (typeof it !== 'string') { acc.push(it); return acc; }
          var _c = _coerceArrElem(it);
          if (_c === null) { _dropN++; return acc; }
          _fixN++;
          acc.push(_c);
          return acc;
        }, []);
      });
      var _selectedValidation = _validateSelectedScenario(_liveBefore, _finalSc);
      if (!_selectedValidation.ok) {
        renderValidation(_selectedValidation);
        ui.els.apply.className = 'warn';
        setStatus('选择后的剧本新增 ' + _selectedValidation.violations.length + ' 项一致性问题，已拒绝应用；请调整接受项');
        return;
      }
      _pushCheckpoint('应用前 ' + _ckptTime());   // 通过冲突与选择后校验后才建检查点
      var _workbench=global.TM&&global.TM.AuthoringExtensions&&global.TM.AuthoringExtensions.getWorkbench();
      if(_finalSc.authoringWorkbench&&_workbench){
        if(rej.size||(ui._pendingSideEffects||[]).length)throw new Error('地图、归属、引用属于同一操作包，不能部分应用或混合记忆写入；请整包审阅');
        setRunning(true);setStatus('正在校验并原子提交地图操作包…');
        try { await _workbench.commitDraft(_finalSc,ui._draftOwner); }
        finally { setRunning(false); }
      } else _commitCurrent(_finalSc, ui._draftOwner);   // 逐项冲突合并后仍须由同一案卷确认提交。
      var _fxN;
      try { _fxN = _commitPendingSideEffects(); }
      catch (effectError) {
        try { _commitCurrent(_liveBefore, ui._draftOwner); }
        catch (rollbackError) { throw new Error('记忆/技能提交失败；剧本回滚未确认，请检查当前案卷：' + (rollbackError && rollbackError.message || rollbackError)); }
        throw new Error('剧本附带的记忆/技能提交失败，已回滚剧本：' + (effectError && effectError.message || effectError));
      }
      ui._pendingSideEffects = [];
      var partial = rej.size > 0;
      markLastApplied();   // 方向M · 把最近一条历史标记为已应用
      try {   // N4 · 通知编辑器：在折子里高亮国师刚改的字段 + 精确跳到首处改动
        var _touched = {}, _rejN = ui._diffRejected || new Set(), _firstPath = null;
        (ui._lastDiffs || []).forEach(function (d) { if (_rejN.has(d.__idx)) return; var top = String(d.path || '').split(/[.[]/)[0]; if (top) _touched[top] = 1; if (!_firstPath && d.path) _firstPath = d.path; });
        var _app = global.TM_SCENARIO_EDITOR_RESET_APP;
        if (_app && typeof _app.markAgentTouched === 'function') _app.markAgentTouched(Object.keys(_touched));
        if (_firstPath && _app && typeof _app.revealPath === 'function') _app.revealPath(_firstPath);
      } catch (e) {}
      var _accN = diffs.length - rej.size;
      setStatus('已应用到剧本：' + _accN + ' 处' + (partial ? '（没要的 ' + rej.size + ' 处留在外面）' : '') + (unfinished ? '，任务仍有未完成项' : '') + (_fxN ? '，另存了 ' + _fxN + ' 条记忆/技能' : '') + ((_fixN || _dropN) ? '，已自动修复 ' + _fixN + ' 条格式不对的条目' + (_dropN ? '、丢弃 ' + _dropN + ' 条读不懂的' : '') : '') + '。接着说就在同一段对话里');
      if (ui._reply) {
        ui._reply.classList.add('applied');
        var _atag = ui._reply.querySelector('.reply-tag');
        if (_atag) {
          _atag.innerHTML = _icon('check', 13) + '<span>已应用 ' + _accN + ' 处' + (unfinished ? '（任务未完成）' : '') + (partial ? '，没要 ' + rej.size + ' 处' : '') + '</span>';
          if (typeof ui._onApplied === 'function') { try { ui._onApplied(ui._reply, _atag, { diffs: (ui._lastDiffs || []).filter(function (d) { return !rej.has(d.__idx); }), before: _liveBefore, after: _finalSc, request: ui._lastRequest || '', summary: ui._lastSummary || '' }); } catch (eA) {} }
        }
      }
      _freezeLastReply();   // 聊天化：应用后冻结当前卡（按钮隐藏·成历史只读）
      _clearDraft();
      // 真·连续会话：应用后【保留】对话线程，下条指令在同一会话里续接（draft 已清·续接时从当前剧本新建）。
      //   想另起新对话用「＋ 新对话」或「放弃」。线程上限交 runAuthoringLoop 的 token 预算自然收口。
    } catch (e) {
      if (e && e.code === 'edit-conflict') {
        var paths = (e.conflicts || []).slice(0, 3).map(function(c) { return __aaU._friendlyPath ? __aaU._friendlyPath(c.path) : c.path; }).join('、');
        setStatus('和你的手工改动冲突：国师干活期间这几处被改过，一处都没应用' + (paths ? '：' + paths : '') + '。可以让国师按现在的剧本重做');
      } else setStatus('没应用成：' + (e && e.message || e));
    }
  }

  function onDiscard() {
    if (ui.running) return;
    _clearDraft();
    ui._attachmentCarry = null;
    ui._conversationOwner = null;
    ui.conversation = null;   // 维度1 · 放弃后结束会话
    ui._pendingPlan = false;
    ui._pendingClarify = false;
    if (ui._reply) { ui._reply.classList.add('discarded'); var _dtag = ui._reply.querySelector('.reply-tag'); if (_dtag) _dtag.textContent = '这一轮的改动放弃了'; }
    _freezeLastReply();   // 放弃后冻结当前卡（留在流里·只读）
    _refreshPending();
    setStatus('放弃了。接着说会开一段新的话头');
    _syncEmpty();   // UI·AD · 回到干净状态则重现欢迎态
  }
  // 真·连续会话：另起新对话（清空当前线程+消息流；上一会话已存入历史·下次新对话会注入记忆延续）。
  function newConversation() {
    if (ui.running) { setStatus('国师还在忙，先停下再开新对话'); return; }
    if (ui._sessionSwitch) { setStatus('正在切换案卷，等它载完'); return; }
    ui._workbenchTask=null;ui._workbenchCheckpoint=null;ui._budgetedRun=false;
    _clearDraft(); ui.conversation = null; ui._pendingPlan = false; ui._pendingClarify = false;
    ui._attachmentCarry = null;
    ui._conversationOwner = null;
    ui._restoredTodos = null; ui._sessId = null; _sessPtrSet(_fileKey(), null);   // S5 · 新对话=新会话·旧会话留侧栏可切回·指针置空(开面板不再拉回)
    if (ui._criticsArmed) _disarmCriticsVisual();   // 刀3 · 新对话清掉未用的会审武装
    if (ui._autoModeArmed) _disarmAutoVisual();
    resetResults(false);
    _syncEmpty();
    _refreshPending();
    setStatus('新对话。上一段留在会话侧栏里，随时能切回');
  }

  // 方向G · 检查点栈：把"应用前快照"升级为可命名、多级回溯的检查点（session 内存态·不持久，避免大剧本撑爆 localStorage）。
  function _ckptTime() { try { var d = new Date(); function p(n) { return (n < 10 ? '0' : '') + n; } return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds()); } catch (e) { return ''; } }
  function _pushCheckpoint(label) {
    if (!ui.adapter || typeof ui.adapter.getScenario !== 'function') return null;
    var cp = { id: ++ui._ckptSeq, label: label || '检查点', when: _ckptTime(), owner: _captureOwner(), snapshot: AA.makeDraft(ui.adapter.getScenario()) };
    ui._checkpoints.push(cp);
    if (ui._checkpoints.length > MAX_CKPT) ui._checkpoints.shift();   // 淘汰最旧
    if (typeof ui._onCheckpointsChange === 'function') { try { ui._onCheckpointsChange(); } catch (e) {} }
    return cp;
  }
  // 撤销 = 弹出并恢复最近的检查点（回到上次应用/回退前）
  function undoLastApply() {
    if (ui.running) { setStatus('运行中，请先停止再撤销'); return false; }
    if (!ui._checkpoints.length) { setStatus('无可撤销的检查点'); return false; }
    try {
      var cp = ui._checkpoints[ui._checkpoints.length - 1];
      _commitCurrent(cp.snapshot, cp.owner);
      ui._checkpoints.pop();
      _clearDraft(); ui.conversation = null; ui._sessId = null; _sessPtrSet(_fileKey(), null);   // S5 · 剧本已回退·脱离当前会话(旧会话留档不删)
      ui._conversationOwner = null;
      if (typeof ui._onCheckpointsChange === 'function') { try { ui._onCheckpointsChange(); } catch (e) {} }
      setStatus('已撤销，回到「' + cp.label + '」(' + cp.when + ') ↩');
      return true;
    } catch (e) { setStatus('撤销失败：' + (e && e.message || e)); return false; }
  }
  // 手动存检查点（命名存档点）
  function manualCheckpoint(label) {
    var cp = _pushCheckpoint(label || ('手动存档 ' + _ckptTime()));
    if (cp) setStatus('已存检查点「' + cp.label + '」(' + cp.when + ')');
    return cp;
  }
  // 回到指定检查点（先把当前状态存一个"回退前"·使回退本身可再撤销）
  function restoreCheckpoint(id) {
    if (ui.running) { setStatus('运行中，请先停止再回退'); return false; }
    var cp = null;
    for (var i = 0; i < ui._checkpoints.length; i++) { if (ui._checkpoints[i].id === id) { cp = ui._checkpoints[i]; break; } }
    if (!cp) { setStatus('找不到该检查点'); return false; }
    try {
      if (!_ownerCurrent(cp.owner)) throw _ownerError();
      _pushCheckpoint('回退前 ' + _ckptTime());
      _commitCurrent(AA.makeDraft(cp.snapshot), cp.owner);
      _clearDraft(); ui.conversation = null; ui._sessId = null; _sessPtrSet(_fileKey(), null);   // S5 · 同上·回退后脱离会话(留档)
      ui._conversationOwner = null;
      setStatus('已回到检查点「' + cp.label + '」(' + cp.when + ')');
      return true;
    } catch (e) { setStatus('回退失败：' + (e && e.message || e)); return false; }
  }
  // 列出检查点元数据（新→旧·供 UI 渲染）
  function listCheckpoints() {
    return ui._checkpoints.slice().reverse().map(function(c) { return { id: c.id, label: c.label, when: c.when }; });
  }

  function mountLauncher() {
    if (document.getElementById('tm-aa-fab')) return;
    var fab = document.createElement('button');
    fab.id = 'tm-aa-fab';
    fab.innerHTML = '<span class="fab-seal">师</span>国师';
    fab.addEventListener('click', function() {
      var p = ensurePanel();
      p.classList.toggle('open');
      if (p.classList.contains('open')) { _syncEmpty(); _reflectWorldKind(); _maybeRestoreThread(); _autoWinMode(); }   // UI·AD · 开面板时按需显欢迎态 + 反映当前世界类型；刀H3 · 同剧本自动恢复上次线程
    });
    document.body.appendChild(fab);
  }

  function init() {
    if (!AA || typeof AA.detectAdapter !== 'function') {
      console.warn('[authoring-ui] TM.AuthoringAgent 未加载，跳过');
      return;
    }
    var adapter = AA.detectAdapter(global);
    if (!adapter) return; // 非剧本编辑器页面
    ui.adapter = adapter;
    injectStyles();
    _ensureCodeCopy();   // UI·AA · 代码块复制键委托
    _ensureEntityNav();   // UI·AH · 行内实体引用跳转委托
    mountLauncher();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  // 暴露给测试/调试
  global.TM_AuthoringAgentUI = { init: init, _ui: ui, _commitUserWrite: _commitUserWrite, undo: undoLastApply, stop: onStop, review: runReview, orchestrate: runOrchestratedUI, preflight: runPreflightUI, qa: runQaUI, explain: runExplainUI, autoMode: _armAutoMode, checkpoint: manualCheckpoint, checkpoints: listCheckpoints, restore: restoreCheckpoint, history: listHistory, clearHistory: clearHistory, changelog: buildChangelog, runChangelog: runChangelogUI, macros: listMacros, saveMacro: saveMacro, deleteMacro: deleteMacro, applyMacro: applyMacro, exportBundle: exportBundle, importBundle: importBundle, detectModels: _detectModels, saveApiCfg: _saveApiCfg, permMode: function (m) { if (m && _PM_LABEL[m]) { var p = _loadPerm(); p.mode = m; _applyPerm(p); } return _loadPerm().mode; }, attachIngest: _ingestFiles, showMemories: showMemoriesUI, showSkills: showSkillsUI, showPacks: showPacksUI, showUsage: showUsageUI,
    listSessions: listSessions, switchSession: switchSession, deleteSession: deleteSession, renameSession: renameSession, forkSession: forkSession, rememberConvention: rememberConvention,
    // 宿主接口（2026-10-15）：工坊各处的「问国师」「AI 生成」按钮走这里，不再直接改 ui.els
    ask: askGuoshi, open: _openPanel, sheet: function (kind) { _openPanel(); _toggleSheet(kind, true); }, palette: _openCmdPalette, newConversation: newConversation };
})(typeof window !== 'undefined' ? window : this);
