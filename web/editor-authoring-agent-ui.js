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
    setStatus(_ownerError().message);
    return false;
  }
  function _runOwned(method, draft, request, options) {
    var owner = ui._draftOwner, run = { owner: owner, draft: draft };
    ui._activeUiRun = run;
    ui._conversationOwner = owner;
    options = Object.assign({}, options);
    function current() { return ui._activeUiRun === run && draft === ui.draft && _ownerCurrent(owner); }
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
      if (error) throw error;
      return result;
    }
    return Promise.resolve().then(function() {
      if (!current()) throw _ownerError();
      return AA[method](draft, request, options);
    }).then(function(res) { return settle(res); }, function(err) { return settle(null, err); });
  }
  function _commitCurrent(scenario, owner) {
    if (!_ownerCurrent(owner)) throw _ownerError();
    var lease = ui.adapter.captureLease ? ui.adapter.captureLease() : null;
    var result = ui.adapter.commit(scenario, lease);
    if (!result || result.ok !== true) throw new Error('编辑器未确认应用成功');
    return result;
  }
  function _startDraft(source) {
    var live = source || (ui.adapter && ui.adapter.getScenario ? ui.adapter.getScenario() : {});
    ui.baseScenario = AA.makeDraft(live);
    ui.draft = AA.makeDraft(live);
    ui._draftOwner = _captureOwner();
    ui._pendingSideEffects = [];
    return ui.draft;
  }
  function _setDraftFromBase(base, draft) {
    ui.baseScenario = AA.makeDraft(base || {});
    ui.draft = draft;
    ui._draftOwner = _captureOwner();
    ui._pendingSideEffects = [];
    return ui.draft;
  }
  function _draftDiff() {
    return AA.computeDiff(ui.baseScenario || (ui.adapter && ui.adapter.getScenario ? ui.adapter.getScenario() : {}), ui.draft || {});
  }
  function _clearDraft() { ui.draft = null; ui.baseScenario = null; ui._draftOwner = null; ui._staleResult = null; ui._pendingSideEffects = []; }
  function _captureSideEffects(res, append) {
    var fx = (res && Array.isArray(res.sideEffects)) ? res.sideEffects : [];
    if (!append) ui._pendingSideEffects = [];
    if (!Array.isArray(ui._pendingSideEffects)) ui._pendingSideEffects = [];
    if (fx.length) ui._pendingSideEffects = ui._pendingSideEffects.concat(_clone(fx));
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
    function done() { _linkifyEntities(el); _applyClamp(ui.els.summary, 280); }
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
        if (!ui.running && typeof onGoClick === 'function') onGoClick();
        else if (ui.running && typeof onSteer === 'function') onSteer();   // 刀G9 · 运行中回车=插话(排队注入下一轮·不打断)
      }
    });
    if (ui.els.atpop) ui.els.atpop.addEventListener('mousedown', function (ev) { var b = ev.target && ev.target.closest ? ev.target.closest('.tm-aa-atitem') : null; if (b) { ev.preventDefault(); _selectMention(b.getAttribute('data-label')); } });
    if (ui.els.mentions) ui.els.mentions.addEventListener('click', function (ev) { var x = ev.target && ev.target.closest ? ev.target.closest('.tm-aa-mx') : null; if (x) { var nm = x.getAttribute('data-m'); ui._mentions = (ui._mentions || []).filter(function (k) { return k !== nm; }); _renderMentionChips(); if (ui._ctx) ui._ctx._sig = null; _refreshCtxChip(); } });
    document.addEventListener('click', function (ev) { if (ui._atActive && ui.els.atpop && !ui.els.atpop.contains(ev.target) && ev.target !== ta) _hideAtPop(); });
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
    el.innerHTML = '<span class="tm-aa-ctx-ico">\uD83D\uDCCD</span><span class="tm-aa-ctx-txt">' + esc(shown) + '</span>' +
      '<button type="button" class="tm-aa-ctx-pin' + (pinned ? ' on' : '') + '" title="' + (pinned ? '\u53d6\u6d88\u56fa\u5b9a\uff08\u8ddf\u968f\u7f16\u8f91\u5668\u9009\u4e2d\uff09' : '\u56fa\u5b9a\u5f53\u524d\u4e0a\u4e0b\u6587') + '">' + (pinned ? '\uD83D\uDCCC' : '\uD83D\uDCCD') + '</button>';
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
      try { if (ui.els && ui.els.panel && ui.els.panel.classList.contains('open')) _refreshCtxChip(); } catch (e) {}
    }, 700);
    _refreshCtxChip();
  }

  function buildPanel() {
    var panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.setAttribute('role', 'complementary');
    panel.setAttribute('aria-label', '国师 · AI 剧本助手');
    panel.innerHTML = [
      '<div class="tm-aa-resize" id="tm-aa-resize" title="拖动调整宽度"></div>',   // UI·AI · 左缘拖拽调宽
      '<div id="tm-aa-hd"><span><button id="tm-aa-rail-tg" aria-label="会话历史侧栏" title="会话历史（全屏侧栏）">' + _icon('bars') + '</button><span class="tm-aa-ava">师</span><b>国师</b><span class="sub">' + esc(ui.adapter.label || '') + '</span></span>',
      '<span class="tm-aa-hdbtns"><button id="tm-aa-theme" aria-label="切换明暗主题" title="明暗主题切换">' + _icon('contrast') + '</button><button id="tm-aa-newchat" aria-label="开始新对话" title="开始新对话（清空当前会话线程与消息·上一会话已入历史/记忆）">' + _icon('pen') + '</button><button id="tm-aa-fs" aria-label="全屏或还原" title="全屏 / 还原">' + _icon('expand') + '</button><button id="tm-aa-x" aria-label="关闭" title="关闭">' + _icon('close') + '</button></span></div>',
      '<div id="tm-aa-progress" aria-hidden="true"></div>',
      '<div id="tm-aa-rail"><button id="tm-aa-railnew" type="button">＋ 新对话</button><input id="tm-aa-railq" type="text" placeholder="搜索会话…" aria-label="搜索会话"><div id="tm-aa-raillist"></div><button id="tm-aa-railclear" type="button" title="清空全部会话（运行审计/版本说明不受影响）">清空会话</button></div>',
      '<div id="tm-aa-body">',
      '<div class="tm-aa-search" id="tm-aa-search" hidden><input type="text" id="tm-aa-search-in" placeholder="在结果里查找…"><span class="tm-aa-search-n" id="tm-aa-search-n">0/0</span><button type="button" id="tm-aa-search-prev" title="上一个">↑</button><button type="button" id="tm-aa-search-next" title="下一个">↓</button><button type="button" id="tm-aa-search-x" title="关闭 (Esc)">×</button></div>',
      '<div id="tm-aa-composer">',   // Claude 桌面端式 composer：圆角大卡片·内嵌底行（＋能力菜单 · 世界类型 · 发送）
      '<div id="tm-aa-ctx" hidden></div>',
      '<div id="tm-aa-mentions" hidden></div>',
      '<div id="tm-aa-atpop" hidden></div>',
      '<div id="tm-aa-cmdpop" hidden></div>',
      '<div id="tm-aa-status" aria-live="polite"></div>',
      '<div id="tm-aa-meter" style="display:none"></div>',
      '<div id="tm-aa-attach" hidden></div>',
      '<div id="tm-aa-field">',
      '<textarea id="tm-aa-req" placeholder="描述你想要的修改，例如：把主角势力改名为「西凉军」并补两个文官"></textarea>',
      '<span class="tm-aa-charcount" id="tm-aa-charcount" hidden></span>',
      '<div class="tm-aa-fieldbar">',
      '<button type="button" id="tm-aa-plus" aria-label="更多能力" title="更多能力：体检 / 审阅 / 问答 / 讲解 / 分解编排 / 三堂会审 / 检查点">＋</button>',
      '<button type="button" id="tm-aa-perm" aria-label="权限模式" title="权限模式：问策(只读出计划) / 共审(改动经你审后应用) / 放行(校验通过自动应用)"></button>',
      '<button type="button" id="tm-aa-attach-btn" aria-label="添加附件" title="添加附件：文本文件(txt/md/json/csv…)作参考上下文·图片/截图走视觉(需主模型支持)。也可直接拖进面板或在输入框粘贴截图">' + _icon('clip') + '</button>',
      '<input type="file" id="tm-aa-file" multiple hidden accept="image/*,.txt,.md,.json,.csv,.tsv,.js,.yml,.yaml,.xml,.html">',
      '<div id="tm-aa-worldkind"><span class="tm-aa-wk-lab">世界类型</span><button type="button" class="tm-aa-wk-opt" data-wk="historical" title="史实剧本·全考据：年号/生卒/职官/事件与正史相符，遇硬伤进谏">史实</button><button type="button" class="tm-aa-wk-opt" data-wk="fictional" title="虚构/架空世界观·奇幻/武侠/仙侠/未来/异世界等原创设定，不受真实历史约束，国师只管设定自洽与平衡">虚构</button></div>',
      '<span class="tm-aa-flex"></span>',
      '<button type="button" id="tm-aa-model" title="API 连接与模型选择" aria-label="API 连接与模型选择"></button>',
      '<button id="tm-aa-go" title="Enter 发送 · Shift+Enter 换行" aria-label="发送">↑</button>',
      '</div>',
      '<div id="tm-aa-plusmenu" hidden></div>',
      '<div id="tm-aa-permpop" hidden>',
      '<div class="mp-h">权限模式</div>',
      '<button type="button" class="tm-aa-pm" data-pm="plan"><b>问策</b><span class="pm-d">只读勘察·出编号计划交你批准·绝不动剧本（对应 Claude Code 的 Plan）</span></button>',
      '<button type="button" class="tm-aa-pm" data-pm="review"><b>共审</b><span class="pm-d">国师起草改动·你逐条审 diff 后应用（默认·最稳）</span></button>',
      '<button type="button" class="tm-aa-pm" data-pm="auto"><b>放行</b><span class="pm-d">校验通过即自动应用到剧本·适合信得过的批量活（对应 Accept Edits）</span></button>',
      '<label class="pm-danger"><input type="checkbox" id="tm-aa-perm-danger">允许危险操作（删除实体 / 改名联动等破坏性写入）</label>',
      '<div class="mp-hint">模式与开关会记住。范围沙箱（只许改某几类集合）在＋菜单的分解编排/会审同样生效。</div>',
      '</div>',
      '<div id="tm-aa-modelpop" hidden>',
      '<div class="mp-h">API 连接 · 模型</div>',
      '<label class="mp-lab">API 地址<input id="tm-aa-api-url" type="text" placeholder="https://api.deepseek.com 或第三方中转地址" autocomplete="off" spellcheck="false"></label>',
      '<label class="mp-lab">API Key<input id="tm-aa-api-key" type="password" placeholder="sk-…" autocomplete="off"></label>',
      '<div class="mp-row"><button type="button" id="tm-aa-api-detect">检测模型</button><span class="mp-st" id="tm-aa-api-st"></span></div>',
      '<label class="mp-lab">主模型<select id="tm-aa-api-model"></select></label>',
      '<label class="mp-lab">次要模型（杂活分工：三堂会审两官 / 前情摘要·可省主模型开销）<select id="tm-aa-api-model2"><option value="">不用 · 都走主模型</option></select></label>',
      '<div class="mp-row mp-end"><button type="button" id="tm-aa-api-save">保存并使用</button></div>',
      '<div class="mp-hint">与正式游戏共用一份（存 tm_api · 国师 / 生图同源）。「检测模型」会真调该 API 的模型清单接口，选到的模型即刻用于下一次运行。</div>',
      '</div>',
      '</div>',
      '</div>',
      '<div class="tm-aa-empty" id="tm-aa-empty" style="display:none"></div>',
      '<div class="tm-aa-sec" data-sec="log" style="display:none">执行过程</div>',
      '<div class="tm-aa-logwrap" id="tm-aa-logwrap" style="display:none"><div class="tm-aa-log" id="tm-aa-loglist"></div><button type="button" class="tm-aa-tobottom" id="tm-aa-tobottom" hidden>↓ 最新</button></div>',
      '<div class="tm-aa-summary" id="tm-aa-summary" role="region" aria-label="国师回复" style="display:none"></div>',
      '<div class="tm-aa-sec" data-sec="diff" style="display:none">改动预览</div>',
      '<div class="tm-aa-diff" id="tm-aa-difflist" style="display:none"></div>',
      '<div class="tm-aa-val" id="tm-aa-val" style="display:none"></div>',
      '<div id="tm-aa-actions" style="display:none">',
      '<button id="tm-aa-apply">应用到剧本</button><button id="tm-aa-discard">放弃</button>',
      '</div></div>'
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
      empty: panel.querySelector('#tm-aa-empty'),
      logSec: panel.querySelector('[data-sec="log"]'),
      logWrap: panel.querySelector('#tm-aa-logwrap'),
      log: panel.querySelector('#tm-aa-loglist'),
      toBottom: panel.querySelector('#tm-aa-tobottom'),
      summary: panel.querySelector('#tm-aa-summary'),
      diffSec: panel.querySelector('[data-sec="diff"]'),
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
      theme: panel.querySelector('#tm-aa-theme'),       // Claude 桌面端式 · 明暗主题切换
      plus: panel.querySelector('#tm-aa-plus'),         // Claude 桌面端式 · ＋能力菜单
      plusmenu: panel.querySelector('#tm-aa-plusmenu'),
      model: panel.querySelector('#tm-aa-model'),       // API 连接·模型选择（弹层）
      modelpop: panel.querySelector('#tm-aa-modelpop'),
      perm: panel.querySelector('#tm-aa-perm'),         // 权限模式（问策/共审/放行·CC 对照）
      permpop: panel.querySelector('#tm-aa-permpop'),
      attach: panel.querySelector('#tm-aa-attach'),     // S2 · 附件签行
      rail: panel.querySelector('#tm-aa-rail'),         // Claude 桌面端式 · 会话历史侧栏（全屏）
      raillist: panel.querySelector('#tm-aa-raillist'),
      railTg: panel.querySelector('#tm-aa-rail-tg')
    };
    panel.querySelector('#tm-aa-x').addEventListener('click', function() {
      if (panel._fs) _toggleFullscreen();
      panel.classList.remove('open');
      // 剧本工坊停靠态也必须真正关闭并归还正文宽度；此前 CSS 强制 display:flex 导致 × 形同虚设。
      try { document.body.classList.remove('je-guoshi-docked', 'je-guoshi-settings-open'); } catch (e) {}
    });
    var _nc = panel.querySelector('#tm-aa-newchat'); if (_nc) _nc.addEventListener('click', newConversation);   // 真·连续会话：另起新对话
    var _pf = panel.querySelector('#tm-aa-preflight'); if (_pf) _pf.addEventListener('click', function () { runPreflightUI(); });   // 常驻·运行时体检(确定性免API·随时重跑·不止空状态)
    if (ui.els.fs) ui.els.fs.addEventListener('click', function () { _toggleFullscreen('user'); });   // UI·AI · 全屏切换
    _ensurePanelResize();   // UI·AI · 左缘拖拽调宽 + 载入持久宽度
    _ensureSearch();   // UI·AJ · 过程区内搜索（⌘F）
    _ensureCtxChip();   // N1 焦点上下文 chip
    _ensureAtMention();   // N3 @提及作用域上下文
    _ensureCmdPal();      // S6 · / 命令面板（CC slash commands 对照·⌘K 唤起）
    ui.els.go.addEventListener('click', onGoClick);   // UI·Q · 运行中此键=停止
    ui.els.apply.addEventListener('click', onApply);
    ui.els.discard.addEventListener('click', onDiscard);
    _ensureWorldKind();   // 刀2 · 世界类型选择器（史实/虚构）绑定 + 初始反映
    _ensureTheme();       // Claude 桌面端式 · 明暗主题（持久）
    _ensurePlusMenu();    // Claude 桌面端式 · ＋能力菜单（体检/审阅/问答/讲解/编排/会审/检查点/撤销）
    _ensureRail();        // Claude 桌面端式 · 会话历史侧栏（全屏下展开）
    _ensureModelPop();    // API 连接·模型选择弹层（模型徽即入口·检测该 API 的真实模型清单）
    _ensurePermPop();     // 权限模式（问策/共审/放行·持久·CC permission modes 对照）
    _ensureAttach();      // S2 · 附件：曲别针/拖拽/粘贴截图 → 文本内联+图片视觉通道
    _ensureLogFollow();   // UI·AB · 滚动跟随 + 回到底部
    _renderEmpty();   // UI·AD · 空状态欢迎 + 建议提示
    ui.els.req.addEventListener('input', _syncEmpty);   // 有字则隐欢迎态
    ui.els.req.addEventListener('input', _autoGrowReq);   // UI·AF · 自增高 + 字数
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

  // ── Claude 桌面端式 · 明暗主题（暖炭黑默认 / 象牙白·持久） ──
  var THEME_KEY = 'tm_aa_theme';
  function _ensureTheme() {
    var p = ui.els && ui.els.panel; if (!p) return;
    var saved = 'dark';
    try { saved = localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'; } catch (e) {}
    p.setAttribute('data-theme', saved);
    if (ui.els.theme) ui.els.theme.addEventListener('click', function () {
      var next = p.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      p.setAttribute('data-theme', next);
      try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
      setStatus(next === 'light' ? '已切换为浅色主题' : '已切换为深色主题');
    });
  }

  // ── Claude 桌面端式 · ＋能力菜单：把散落的高级能力收进输入卡左下角（全部走既有运行器·零新行为） ──
  var _PLUS_ITEMS = [
    { act: 'preflight', ic: 'pulse', t: '运行时体检', d: '确定性检查·免 API·查会影响加载的阻塞' },
    { act: 'auto-select', ic: 'route', t: '自动选择工作模式', d: '手动武装下一次请求·由国师在直接/计划/编排/会审中择一' },
    { act: 'review', ic: 'search', t: '审阅出报告', d: '全面体检剧本（输入框可写审阅重点）' },
    { act: 'qa', ic: 'chat', t: '剧本问答', d: '就剧本提问（先在输入框写问题）' },
    { act: 'explain', ic: 'book', t: '讲解剧本', d: '给接手的人做 onboarding 式讲解' },
    { act: 'orchestrate', ic: 'route', t: '分解编排', d: '大需求拆成子任务逐个执行' },
    { act: 'critics', ic: 'scale', t: '三堂会审', d: '国师拟稿·史官查史实·谏官批平衡' },
    { act: 'sep' },
    { act: 'checkpoint', ic: 'save', t: '存检查点', d: '把当前剧本存为可回退的存档点' },
    { act: 'undo', ic: 'undo', t: '撤销上次应用', d: '回到上次应用前的快照' }
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
    else if (act === 'undo') undoLastApply();
  }

  // ── S6 · / 命令面板（CC slash commands 对照）：输入框开头敲 / 即出面板·边敲边过滤·↑↓ 选·
  //    Enter 执行·「/审阅 平衡性」式参数会回填输入框再跑对应模式·Ctrl/⌘+K 亦可唤起
  //    （工坊 dock 顶栏的「⌘K 命令」提示至此成真）。全部命令走既有运行器·零新行为。 ──
  function _cmdDefs() {
    return [
      { k: 'new', t: '新对话', d: '另起新会话（旧会话留侧栏可切回）', run: function () { newConversation(); } },
      { k: 'sessions', t: '会话侧栏', d: '打开/收起会话历史（全屏侧栏）', run: function () { if (ui.els.railTg) ui.els.railTg.click(); } },
      { k: 'review', t: '审阅出报告', d: '全面体检·可带重点：/审阅 平衡性', run: function () { _plusAct('review'); } },
      { k: 'auto', t: '自动选择工作模式', d: '手动武装下一次请求·自动选直接/计划/编排/会审', run: function () { _plusAct('auto-select'); } },
      { k: 'qa', t: '剧本问答', d: '就剧本提问：/剧本问答 谁掌兵权', run: function () { _plusAct('qa'); } },
      { k: 'explain', t: '讲解剧本', d: '给接手的人做 onboarding 式讲解', run: function () { _plusAct('explain'); } },
      { k: 'orchestrate', t: '分解编排', d: '大需求拆子任务：/分解编排 重做经济', run: function () { _plusAct('orchestrate'); } },
      { k: 'critics', t: '三堂会审', d: '拟稿+史官+谏官（武装下一轮生成）', run: function () { _plusAct('critics'); } },
      { k: 'preflight', t: '运行时体检', d: '确定性检查·免 API', run: function () { _plusAct('preflight'); } },
      { k: 'changelog', t: '版本说明', d: '汇总已应用改动·零 token', run: function () { runChangelogUI(); } },
      { k: 'fork', t: '分叉会话', d: '把当前会话复制成分支再演化（原线不动）', run: function () { if (ui._sessId) forkSession(ui._sessId); else setStatus('当前没有活动会话（先跑一轮，或从侧栏选中一条）'); } },
      { k: 'conv', t: '创作约定', d: '查看全局+本剧本两层约定（等价 CLAUDE.md）', run: function () { showConventionsUI(); } },
      { k: 'memories', t: '记忆册', d: '国师存下的跨会话记忆（四型·可删）', run: function () { showMemoriesUI(); } },
      { k: 'skills', t: '技能册', d: '可用技能清单（内置+能力包+自存·可删自存）', run: function () { showSkillsUI(); } },
      { k: 'packs', t: '能力包', d: '技能+约定的打包单元（启停/导入/导出）', run: function () { showPacksUI(); } },
      { k: 'usage', t: '用量·上下文', d: '本轮 token 构成与上下文窗口占比', run: function () { showUsageUI(); } },
      { k: 'initconv', t: '初始化约定', d: '通读剧本·总结值得沿用的创作约定（可逐条记住）', run: function () { ui.els.req.value = '【梳理创作约定】通读剧本，总结 5-10 条值得长期沿用的创作约定（命名规律、文风与称谓、数值区间、结构惯例、世界观基调）。每确认一条就调用 recordConvention 记录一条；报告 findings 也逐条列出这些约定及其依据。不评质量问题，只提炼惯例。'; runReview(); } },
      { k: 'compact', t: '压缩前情', d: '把长对话压成前情摘要（省上下文·续接不断）', run: function () { runCompactUI(); } },
      { k: 'notify', t: '完成通知', d: '页面切后台时跑完弹系统通知（开/关）', run: function () { _toggleNotify(); } },
      { k: 'microplan', t: '歧义先对齐', d: '需求多解时国师先给微计划确认再动手（开/关·默认开）', run: function () { _toggleMicroPlan(); } },
      { k: 'checkpoint', t: '存检查点', d: '当前剧本存为可回退存档点', run: function () { _plusAct('checkpoint'); } },
      { k: 'undo', t: '撤销上次应用', d: '回到上次应用前快照', run: function () { _plusAct('undo'); } },
      { k: 'perm-plan', t: '权限·问策', d: '只读出计划·绝不动剧本', run: function () { var p = _loadPerm(); p.mode = 'plan'; _applyPerm(p); setStatus('权限已切到「问策」· 只读出计划'); } },
      { k: 'perm-review', t: '权限·共审', d: '改动经你审后应用（默认）', run: function () { var p = _loadPerm(); p.mode = 'review'; _applyPerm(p); setStatus('权限已切到「共审」· 改动经你审后应用'); } },
      { k: 'perm-auto', t: '权限·放行', d: '校验通过自动应用', run: function () { var p = _loadPerm(); p.mode = 'auto'; _applyPerm(p); setStatus('权限已切到「放行」· 校验通过自动应用'); } },
      { k: 'theme', t: '切换主题', d: '深色 / 浅色', run: function () { if (ui.els.theme) ui.els.theme.click(); } }
    ];
  }
  function _cmdQuery() {
    var v = (ui.els && ui.els.req ? ui.els.req.value : '') || '';
    if (v.charAt(0) !== '/') return null;
    var sp = v.indexOf(' ');
    return { cmd: (sp > 0 ? v.slice(1, sp) : v.slice(1)).trim().toLowerCase(), arg: sp > 0 ? v.slice(sp + 1) : '' };
  }
  // 浮层上下自适应：composer 上方空间不足（空态/无消息时 composer 贴顶）→ 翻到 composer 下方
  function _popPlace(pop) {
    function place() {
      try {
        var pb = ui.els.panel.getBoundingClientRect(), cb = pop.parentElement.getBoundingClientRect();
        pop.classList.toggle('below', (cb.top - pb.top) < 300);
      } catch (e) {}
    }
    place();
    // 同一输入事件里 _syncEmpty 可能撤掉空态居中（composer 从屏中跳到贴顶）——布局稳定后复测一次
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
      return '<button type="button" class="tm-aa-cmditem' + (i === ui._cmdIdx ? ' on' : '') + '" data-k="' + esc(c.k) + '"><b>/' + esc(c.t) + '</b><span class="cmd-d">' + esc(c.d) + '</span></button>';
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
    if (ui.running && k !== 'sessions' && k !== 'theme') { setStatus('运行中 · 先点「■」停止，再用「' + def.t + '」'); return; }
    ui.els.req.value = pq.arg || '';   // 「/命令 参数」→ 参数回填输入框供运行器取用
    _autoGrowReq();
    def.run();
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
      if ((ev.key === 'Enter' || ev.keyCode === 13) && !ev.isComposing) {
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
    document.addEventListener('keydown', function (ev) {   // Ctrl/⌘+K 唤起
      if ((ev.ctrlKey || ev.metaKey) && (ev.key === 'k' || ev.key === 'K')) {
        var p = ui.els.panel; if (!p || !p.classList.contains('open')) return;
        ev.preventDefault();
        ui.els.req.value = '/'; _autoGrowReq();
        try { ui.els.req.focus(); ui.els.req.setSelectionRange(1, 1); } catch (e) {}
        ui._cmdIdx = 0; _showCmdPop();
      }
    });
    document.addEventListener('click', function (ev) { if (ui._cmdActive && ui.els.cmdpop && !ui.els.cmdpop.contains(ev.target) && ev.target !== ui.els.req) _hideCmdPop(); });
  }
  function _ensurePlusMenu() {
    var btn = ui.els && ui.els.plus, menu = ui.els && ui.els.plusmenu;
    if (!btn || !menu || ui._plusBound) return;
    ui._plusBound = true;
    menu.innerHTML = _PLUS_ITEMS.map(function (it, i) {
      if (it.act === 'sep') return '<div class="tm-aa-mi-sep"></div>';
      return '<button type="button" class="tm-aa-mi" data-act="' + it.act + '"><span class="mi-ic">' + _icon(it.ic) + '</span><span><span>' + esc(it.t) + '</span><span class="mi-d">' + esc(it.d) + '</span></span></button>';
    }).join('');
    btn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      menu.hidden = !menu.hidden;
      btn.classList.toggle('on', !menu.hidden);
    });
    menu.addEventListener('click', function (ev) {
      var b = ev.target && ev.target.closest ? ev.target.closest('.tm-aa-mi') : null;
      if (!b) return;
      _plusClose();
      var act = b.getAttribute('data-act');
      if (ui.running) { setStatus('运行中 · 先点「■」停止，再使用「' + (b.textContent || '').slice(0, 6) + '…」'); return; }
      _plusAct(act);
    });
    document.addEventListener('click', function (ev) {
      if (!menu.hidden && !menu.contains(ev.target) && ev.target !== btn) _plusClose();
    });
    document.addEventListener('keydown', function (ev) {   // Esc 关能力菜单
      if (ev.key === 'Escape' && !menu.hidden) { _plusClose(); ev.stopPropagation(); }
    });
  }

  // ── Claude 桌面端式 · 会话历史侧栏：全屏下左侧展开（数据=既有 listHistory 持久历史·点击回填输入框）
  //    调研对齐：桌面端侧栏 = 搜索框 + 按日期分组的会话列表（今天/昨天/七日内/更早） ──
  function _railGroupOf(ts) {
    var d = new Date(); d.setHours(0, 0, 0, 0);
    var day0 = d.getTime();
    if (ts >= day0) return '今天';
    if (ts >= day0 - 86400000) return '昨天';
    if (ts >= day0 - 6 * 86400000) return '七日内';
    return '更早';
  }
  // S5 · 侧栏=会话列表（CC/Claude 桌面端对照）：按日期分组·点击切换会话（跨剧本自动切剧本）·
  //   悬停 × 删除·当前会话高亮·会话属别的剧本时显剧本徽记。
  function _renderRail(query) {
    var list = ui.els && ui.els.raillist; if (!list) return;
    var l = listSessions(query).slice(0, 40), fk = _fileKey();
    if (!l.length) { list.innerHTML = '<div class="rail-empty">' + (query ? '没有匹配「' + esc(String(query).slice(0, 20)) + '」的会话。' : '还没有会话——发出第一条需求后，这里会按日期列出会话，点击可随时切回（连剧本一起切）。') + '</div>'; return; }
    var out = [], lastGrp = null;
    l.forEach(function (m) {
      if (!m || !m.id) return;
      var g = _railGroupOf(m.ts || 0);
      if (g !== lastGrp) { out.push('<div class="rail-sec">' + g + '</div>'); lastGrp = g; }
      var other = m.fileKey && m.fileKey !== fk;
      var noBody = !_sessBody(m.id);
      out.push('<div class="rail-item' + (m.id === ui._sessId ? ' on' : '') + '" data-sess="' + esc(m.id) + '" title="'
        + (other ? '点击切换到剧本「' + esc(m.fileLabel || '') + '」并续接该会话' : '点击续接该会话') + (noBody ? '（正文已按容量清理·只余档卡）' : '') + '">'
        + '<div class="ri-req">' + esc(m.title || '（未命名会话）') + '</div>'
        + '<div class="ri-meta">' + (other ? '<span class="ri-file">⇄ ' + esc(m.fileLabel || '?') + '</span> · ' : (m.fileLabel ? esc(m.fileLabel) + ' · ' : ''))
        + (m.msgs || 0) + ' 条 · ' + esc(m.kind || '') + '</div>'
        + '<button type="button" class="ri-fork" data-fork="' + esc(m.id) + '" title="分叉该会话（复制成新会话·从这里分头演化）">⎇</button>'
        + '<button type="button" class="ri-ren" data-ren="' + esc(m.id) + '" title="重命名会话">✎</button>'
        + '<button type="button" class="ri-del" data-del="' + esc(m.id) + '" title="删除该会话">×</button>'
        + '</div>');
    });
    list.innerHTML = out.join('');
  }
  function _ensureRail() {
    if (!ui.els || !ui.els.railTg || ui._railBound) return;
    ui._railBound = true;
    ui.els.railTg.addEventListener('click', function () {
      var p = ui.els.panel;
      if (!p.classList.contains('railon') && !p._fs) _toggleFullscreen('user');   // 侧栏是全屏版式的一部分：未全屏先进全屏
      p.classList.toggle('railon');
      if (p.classList.contains('railon')) _renderRail(ui._railQ || '');
    });
    var _rq = ui.els.panel.querySelector('#tm-aa-railq');
    if (_rq) _rq.addEventListener('input', function () { ui._railQ = _rq.value.trim(); _renderRail(ui._railQ); });
    var _rn = ui.els.panel.querySelector('#tm-aa-railnew');
    if (_rn) _rn.addEventListener('click', function () { newConversation(); _renderRail(ui._railQ || ''); });
    var _rc = ui.els.panel.querySelector('#tm-aa-railclear');
    if (_rc) _rc.addEventListener('click', function () { clearSessions(); _renderRail(ui._railQ || ''); setStatus('会话历史已清空（运行审计与版本说明不受影响）'); });
    if (ui.els.raillist) ui.els.raillist.addEventListener('click', function (ev) {
      var del = ev.target && ev.target.closest ? ev.target.closest('.ri-del') : null;
      if (del) { deleteSession(del.getAttribute('data-del')); _renderRail(ui._railQ || ''); return; }
      var fk8 = ev.target && ev.target.closest ? ev.target.closest('.ri-fork') : null;
      if (fk8) { if (ui.running) { setStatus('运行中 · 先停止再分叉'); return; } forkSession(fk8.getAttribute('data-fork')); _renderRail(ui._railQ || ''); return; }
      var ren = ev.target && ev.target.closest ? ev.target.closest('.ri-ren') : null;
      if (ren) {
        var rid = ren.getAttribute('data-ren'), row = ren.closest('.rail-item');
        var cur = (row && row.querySelector('.ri-req') || {}).textContent || '';
        var nv = null; try { nv = window.prompt('重命名会话', cur); } catch (e) {}
        if (nv != null && renameSession(rid, nv)) { _renderRail(ui._railQ || ''); setStatus('已重命名会话'); }
        return;
      }
      var it = ev.target && ev.target.closest ? ev.target.closest('.rail-item') : null;
      if (!it) return;
      switchSession(it.getAttribute('data-sess'));
      _renderRail(ui._railQ || '');
    });
    ui._onSessionsChange = function () { if (ui.els.panel.classList.contains('railon')) _renderRail(ui._railQ || ''); };   // 会话落盘/删除 → 侧栏活刷新
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
    else if (anthropic) { endpoint = url + '/v1/models'; headers = { 'x-api-key': key || '', 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }; }
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
      if (!ids.length) throw new Error('该 API 未返回模型列表（可手填模型名后直接保存）');
      return ids;
    });
  }
  function _refreshModelChip() {
    var el = ui.els && ui.els.model; if (!el) return;
    var cfg = _loadApiCfg();
    var ok = !!(cfg.key && cfg.url);
    el.textContent = ok ? (String(cfg.model || '').slice(0, 40) || '选择模型') : '配置 API';
    el.classList.toggle('warn', !ok);
  }
  function _modelPopClose() { if (ui.els && ui.els.modelpop) ui.els.modelpop.hidden = true; }

  // ── S2 · 附件（Claude 桌面端式）：曲别针/拖拽入面板/输入框粘贴截图 → 签行预览 → 发送时
  //    文本文件内联为【附件】上下文·图片走视觉通道（user 消息 images[]·主模型须支持视觉）。 ──
  var _ATT_TEXT_RE = /\.(txt|md|json|csv|tsv|js|yml|yaml|xml|html?)$/i;
  function _attState() { if (!ui._att) ui._att = { files: [], images: [] }; return ui._att; }
  function _renderAttach() {
    var box = ui.els && ui.els.attach; if (!box) return;
    var a = _attState();
    if (!a.files.length && !a.images.length) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    box.innerHTML = a.images.map(function (u, i) {
      return '<span class="att-chip att-img"><img src="' + u + '" alt="附图"><button type="button" class="att-x" data-k="img" data-i="' + i + '" title="移除">×</button></span>';
    }).join('') + a.files.map(function (f, i) {
      return '<span class="att-chip"><span class="att-ic">' + _icon('book') + '</span><span class="att-nm" title="' + esc(f.name) + '">' + esc(f.name) + '</span><span class="att-sz">' + Math.ceil(f.text.length / 1000) + 'k字</span><button type="button" class="att-x" data-k="file" data-i="' + i + '" title="移除">×</button></span>';
    }).join('');
  }
  function _ingestFiles(list) {
    var a = _attState();
    Array.prototype.forEach.call(list || [], function (f) {
      if (!f) return;
      if (/^image\//.test(f.type)) {
        if (a.images.length >= 3) { setStatus('图片最多 3 张（已忽略「' + f.name + '」）'); return; }
        if (f.size > 4 * 1024 * 1024) { setStatus('图片过大（>4MB）：' + f.name + ' 已忽略·请截小一点'); return; }
        var rd = new FileReader();
        rd.onload = function () { a.images.push(String(rd.result)); _renderAttach(); };
        rd.readAsDataURL(f);
      } else if (_ATT_TEXT_RE.test(f.name) || /^text\//.test(f.type) || f.type === 'application/json') {
        if (a.files.length >= 4) { setStatus('文本附件最多 4 个（已忽略「' + f.name + '」）'); return; }
        if (f.size > 300 * 1024) { setStatus('文件过大（>300KB）：' + f.name + ' 已忽略'); return; }
        var rt = new FileReader();
        rt.onload = function () { a.files.push({ name: f.name, text: String(rt.result || '').slice(0, 12000) }); _renderAttach(); };
        rt.readAsText(f);
      } else setStatus('暂不支持该类型附件：' + f.name + '（支持文本类与图片）');
    });
  }
  function _attachPrefix() {   // 发送时把文本附件内联进需求（各 12k 上限·总量再由预算/压缩管）
    var a = _attState();
    if (!a.files.length) return '';
    return a.files.map(function (f) { return '\n\n【附件 · ' + f.name + '】\n' + f.text; }).join('') + '\n\n（以上为玩家提供的参考附件·按需取用）';
  }
  function _takeImages() { var a = _attState(); var im = a.images.slice(0, 3); return im.length ? im : null; }
  function _clearAttach() { ui._att = { files: [], images: [] }; _renderAttach(); }
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
  function _refreshPermChip() {
    var el = ui.els && ui.els.perm; if (!el) return;
    var p = _loadPerm();
    el.textContent = _PM_LABEL[p.mode] || '共审';
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
      if (!pop.hidden) { _plusClose(); _modelPopClose(); _refreshPermChip(); }
    });
    pop.addEventListener('click', function (ev) {
      var b = ev.target && ev.target.closest ? ev.target.closest('.tm-aa-pm') : null;
      if (!b) return;
      var p = _loadPerm(); p.mode = b.getAttribute('data-pm');
      _applyPerm(p); _permPopClose();
      setStatus(p.mode === 'plan' ? '已切「问策」——国师只读勘察出计划·批准后才会执行'
        : (p.mode === 'auto' ? '已切「放行」——校验通过的改动将自动应用到剧本（可随时切回共审）'
          : '已切「共审」——改动出 diff·由你逐条审后应用'));
    });
    var dg = pop.querySelector('#tm-aa-perm-danger');
    if (dg) dg.addEventListener('change', function () { var p = _loadPerm(); p.allowDestructive = !!dg.checked; _applyPerm(p); setStatus(dg.checked ? '已允许危险操作（删除/改名联动等）' : '已禁止危险操作——删除类写入会被权限闸拦下'); });
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
      st.textContent = '';
    }
    btn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      pop.hidden = !pop.hidden;
      if (!pop.hidden) { _plusClose(); _seed(); try { inUrl.focus(); } catch (eF) {} }
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
      var u = inUrl.value.trim(), k = inKey.value.trim(), m = (sel.value || '').trim(), m2 = (sel2.value || '').trim();
      if (!u || !k) { st.textContent = 'API 地址与 Key 都要填'; return; }
      if (_saveApiCfg(u, k, m, m2)) {
        _refreshModelChip(); _modelPopClose();
        setStatus('API 已保存（全游戏共用 · 国师 / 生图同源）' + (m ? ' · 主模型：' + m : '') + (m2 ? ' · 次模：' + m2 + '（会审两官/摘要分工）' : '') + ' · 下一次运行即生效');
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
  function _fmtTok(n) { n = n || 0; return n >= 1000 ? (Math.round(n / 100) / 10) + 'k' : String(n); }
  function _renderMeter(done) {
    if (!ui.els || !ui.els.meter) return;
    if (!ui._runStart || done) { ui.els.meter.style.display = 'none'; return; }   // Claude 式：只在运行中显示（收尾由状态行汇总·不重复）
    var sec = Math.round((Date.now() - ui._runStart) / 1000);
    var tok = ui._lastTokens || 0, iter = ui._lastIter || 0;
    // S10(Codex context-left 对照) · 上下文余量：预算越吃越紧时玩家能看见（≤30% 时着色提醒·撞线前引擎会自动宏压缩）
    var left = (ui._budget && tok) ? Math.max(0, 100 - Math.round(tok * 100 / ui._budget)) : null;
    ui.els.meter.style.display = '';
    ui.els.meter.textContent = '⏱ ' + sec + 's · ~' + _fmtTok(tok) + ' tokens' + (iter ? ' · ' + iter + ' 轮' : '') + (left != null ? ' · 上下文余 ' + left + '%' : '');
    ui.els.meter.style.color = (left != null && left <= 15) ? 'var(--bad)' : ((left != null && left <= 30) ? 'var(--warn)' : '');
  }
  // 集中管理运行态：切换 running/禁用生成键 + 启停实时计量
  function setRunning(on) {
    ui.running = on;
    ui._stopping = false;
    if (ui.els && ui.els.panel) ui.els.panel.classList.toggle('tm-aa-running', on);   // Claude 式 · 运行态（✳ 状态脉动 + 执行标签流光）
    if (on) _plusClose();   // 开跑收起能力菜单
    if (on && ui.els && ui.els.empty) ui.els.empty.style.display = 'none';   // UI·AD · 一跑就隐欢迎态
    // UI·Q · 运行中「生成」键变形为「■ 停止」(不禁用·桌面端范式)；收尾恢复「生成」
    if (ui.els && ui.els.go) { ui.els.go.disabled = false; ui.els.go.textContent = on ? '■' : '↑'; ui.els.go.style.fontSize = ''; ui.els.go.setAttribute('aria-label', on ? '停止' : '发送'); ui.els.go.title = on ? '停止（本轮 API 返回后干净收尾·不施未完成的改动）' : 'Enter 发送 · Shift+Enter 换行'; ui.els.go.classList.toggle('stopbtn', on); }
    if (!on) {   // 工作过程 · 收尾：活动行移除·执行块自动折叠并定格标签
      _maybeNotify();   // S12 · 页面切后台时跑完弹系统通知(Codex notify 对照·先于 _runStart 清理)
      _removeLive();
      if (ui._thinkEl && ui._thinkEl.isConnected) {
        ui._thinkEl.open = false;
        var _lbl = ui._thinkEl.querySelector('.tk-label');
        if (_lbl && ui._thinkCount) _lbl.textContent = '执行过程 · ' + ui._thinkCount + ' 步';
      }
    }
    // 刀G9 · 运行中输入框保持可用·占位提示"回车可插话"(收尾恢复常规提示)
    if (ui.els && ui.els.req) ui.els.req.placeholder = on ? '运行中 · 输入新指示并回车可随时插话（agent 完成当前一步后处理，不打断）' : _REQ_PLACEHOLDER;
    if (on) {
      ui._runStart = Date.now(); ui._lastTokens = 0; ui._lastIter = 0;
      if (ui._meterTimer) clearInterval(ui._meterTimer);
      ui._meterTimer = setInterval(function() { _renderMeter(false); }, 400);
      _renderMeter(false);
    } else {
      if (ui._meterTimer) { clearInterval(ui._meterTimer); ui._meterTimer = null; }
      _renderMeter(true);   // 收尾定格总用时/tokens
    }
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
  function _migrateLegacyThread() {
    try {
      var raw = localStorage.getItem(THREAD_KEY); if (!raw) return;
      localStorage.removeItem(THREAD_KEY);
      var pack = JSON.parse(raw);
      if (!pack || !Array.isArray(pack.conversation) || !pack.conversation.length) return;
      var same = pack.sid && pack.sid === _scenKey();
      var id = 's' + (pack.ts || Date.now()) + '-mig';
      var meta = { id: id, ts: pack.ts || Date.now(), created: pack.ts || Date.now(),
        fileKey: same ? _fileKey() : ('name:' + (pack.sid || 'default')), fileLabel: same ? _fileLabel() : String(pack.sid || ''),
        title: _rawReq(pack.conversation[0] && pack.conversation[0].text) || '上次会话', msgs: pack.conversation.length, tokens: 0, kind: '编辑', summary: '' };
      localStorage.setItem(SESS_BODY + id, JSON.stringify({ id: id, ts: meta.ts, todos: pack.todos || [], conversation: pack.conversation }));
      var idx = _sessIndex(); idx.unshift(meta); _sessIndexSave(idx);
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
      if (turn && turn.role === 'user') { var t = _rawReq(turn.text); if (t) _appendUserMsg(t, { input: t }); i++; continue; }
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
        if (ui.els.summary) { ui.els.summary.innerHTML = lastTxt ? _md(lastTxt.slice(0, 4000)) : '<span class="tm-aa-stream">（该轮以工具操作为主）</span>'; ui.els.summary.style.display = ''; }
        var tag = ui._reply && ui._reply.querySelector('.reply-tag'); if (tag && tools) tag.textContent = '— 本轮执行 ' + tools + ' 个工具';
        _freezeLastReply();
      }
    }
    if (meta && meta.summary) {   // 收尾档卡：当轮 finish 的改动说明存在 meta 里（正文里只有工具调用）
      _beginReplyCard();
      if (ui.els.summary) { ui.els.summary.innerHTML = _md(String(meta.summary)); ui.els.summary.style.display = ''; }
      _freezeLastReply();
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
  function _refreshFileSub() {
    try {
      var sub = ui.els && ui.els.panel ? ui.els.panel.querySelector('#tm-aa-hd .sub') : null;
      if (!sub) return;
      var cur = sub.textContent || '', lbl = String((ui.adapter && ui.adapter.label) || '');
      if (cur !== lbl && cur.indexOf(' · ') < 0) return;
      var fl = _fileLabel();
      sub.textContent = fl ? (lbl.split(' · ')[0] + ' · ' + fl) : lbl;
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
      resetResults(true);
      _beginReplyCard();
      if (ui.els.summary) { ui.els.summary.innerHTML = '<b>前情已压缩</b><span class="tm-aa-stream">' + beforeN + ' 条 → ' + r.after + ' 条（摘要 ' + Math.round(r.summaryChars / 100) / 10 + 'k 字 · 近尾原文保留）。续接不断片，后续轮次省上下文。</span>'; ui.els.summary.style.display = ''; }
      _freezeLastReply();
      setStatus('前情压缩完成：' + beforeN + ' → ' + r.after + ' 条 · 直接输入续接');
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
  function _maybeNotify() {
    try {
      if (localStorage.getItem('tm_aa_notify') !== '1') return;
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
      if (typeof document === 'undefined' || !document.hidden) return;   // 页面可见就不打扰
      var dur = ui._runStart ? Math.round((Date.now() - ui._runStart) / 1000) : 0;
      if (dur < 12) return;   // 快跑不值一条系统通知
      new Notification('国师', { body: '本轮已完成（用时 ' + (dur >= 60 ? Math.floor(dur / 60) + ' 分 ' + (dur % 60) + ' 秒' : dur + ' 秒') + '）· 回来看看结果', tag: 'tm-aa-run' });
    } catch (e) {}
  }
  function showConventionsUI() {   // /创作约定 · 两层透视（CC /memory 对照）
    if (ui.running) { setStatus('请等当前运行结束'); return; }
    resetResults(true);
    _beginReplyCard();
    var g = ''; try { g = (AA.loadConventions && AA.loadConventions()) || ''; } catch (e) {}
    var s = _loadScenConv(), fl = _fileLabel();
    if (ui.els.summary) {
      ui.els.summary.innerHTML = '<b>创作约定（等价 CLAUDE.md · 每轮注入提示词）</b>'
        + '<div class="tm-aa-cl-md"><b>全局 · 所有剧本通用</b>' + (g ? _md(g) : '<div style="color:var(--tx3)">（空 · 可在工坊「剧本约定」里编辑）</div>')
        + '<b>本剧本 · ' + esc(fl || '当前剧本') + '</b>' + (s ? _md(s) : '<div style="color:var(--tx3)">（空 · 「记住」按钮与国师自记的约定会落在这里）</div>')
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
    _freezeLastReply();
    setStatus('约定两层：全局' + (g ? ' ' + g.split('\n').filter(Boolean).length + ' 条' : '空') + ' · 本剧本' + (s ? ' ' + s.split('\n').filter(Boolean).length + ' 条' : '空'));
  }

  /* ═══ CC 三件套 UI 曝光（2026-07-03·记忆册/技能册/能力包）+ 用量·上下文卡 ═══ */
  function _mgmtCard(title, bodyHtml, status) {
    if (ui.running) { setStatus('请等当前运行结束'); return null; }
    resetResults(true);
    _beginReplyCard();
    if (!ui.els.summary) return null;
    ui.els.summary.innerHTML = '<b>' + title + '</b><div class="tm-aa-cl-md">' + bodyHtml + '</div>';
    ui.els.summary.style.display = '';
    _freezeLastReply();
    if (status) setStatus(status);
    return ui.els.summary;
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
        + '<div style="font-size:12px;color:var(--tx2);margin:4px 0 10px">合计（=下次请求真实体量）：<b>' + fmt(tot) + '</b> tokens · 占预算上限 ' + Math.round(tot * 100 / budget) + '%（上限 ' + fmt(budget) + '·撞 85% 会自动宏压缩）</div>';
    } else {
      body += '<div style="color:var(--tx3);font-size:12px;margin-bottom:8px">（本会话还没跑过——跑一轮后这里显示真口径构成）</div>';
    }
    body += '<b style="font-size:12px">当前会话线程</b>'
      + '<div style="font-size:12px;color:var(--tx2)">消息 ' + ((ui.conversation && ui.conversation.length) || 0) + ' 条 · 线程体量约 ' + fmt(convTok) + ' tokens（续跑时计入下轮请求）</div>'
      + '<b style="font-size:12px;display:block;margin-top:8px">常驻注入面（每轮都发）</b>'
      + '<div style="font-size:12px;color:var(--tx2)">记忆清单候选 ~' + fmt(memTok) + ' · 技能清单 ~' + fmt(skillTok) + ' tokens（记忆正文只在被召回时注入·技能全文只在 useSkill 时展开）</div>';
    _mgmtCard('用量 · 上下文（真口径 = 系统词 + 工具 schema + 全对话）', body, m ? ('最近一轮 ' + fmt(m.tokensUsed) + ' tokens · 占上限 ' + Math.round((m.tokensUsed || 0) * 100 / budget) + '%') : '暂无运行数据');
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
      var h = _loadHistory();
      if (!h || !h.length) return '';
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
      request: String(request || '').slice(0, 200),
      summary: String(_runSummaryOf(res) || '').slice(0, 240),
      tokensUsed: (res && res.tokensUsed) || 0,
      iterations: (res && res.iterations) || 0,
      stopReason: (res && res.stopReason) || '',
      applied: false
    };
    /* 用量卡数据：最近一轮的真口径构成(G1)与压缩/插话计数(所有模式都经此汇点) */
    if (res && res.tokensUsed != null) ui._lastRunMeta = { kind: kind, tokensUsed: res.tokensUsed || 0, tokensBreakdown: res.tokensBreakdown || null, iterations: res.iterations || 0, macroCompactions: res.macroCompactions || 0, steered: res.steered || 0, ts: Date.now() };
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
    var h = _loadHistory();   // 旧→新
    var changes = h.filter(function(r) { return _CHANGE_KINDS[r.kind] && (!onlyApplied || r.applied); });
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
    ui._thinkEl = null; ui._thinkCount = 0;   // UI·Z · 新一轮起一个新的思考折叠块
    if (ui.els.empty) ui.els.empty.style.display = 'none';   // UI·AD · 一有动作就隐欢迎态（onDiscard 会再按需显）
    if (ui._searchMarks && ui._searchMarks.length) { ui._searchMarks = []; ui._searchIdx = -1; _searchCount(); }   // UI·AJ · 新一轮清掉旧高亮引用（innerHTML 已换）
    if (!keepLog) { ui.els.log.innerHTML = ''; ui.els.logWrap.style.display = 'none'; ui.els.logSec.style.display = 'none'; ui._logPinned = true; if (ui.els.toBottom) ui.els.toBottom.hidden = true; ui._reply = null; }   // 新对话才清流
    ui._clampBtn = null;   // 折叠按钮归属各自的卡（新卡 _beginReplyCard 会重置）
    if (ui.els.meter) { ui.els.meter.style.display = 'none'; ui._runStart = null; }
    // 聊天化：summary/diff/val/actions 是「当前回应卡」的子元素，由 _beginReplyCard 每轮新建，旧卡留在流里——这里不再清固定区
  }
  // 聊天化：每轮国师「实质回应」在对话流里建一张回应卡，把结果元素引用重指到卡内子元素，
  //   于是现有 render*（用 ui.els.summary/diff/val/actions）自动渲进当前卡。多轮 → 多卡，历史留在流里。
  function _beginReplyCard() {
    if (!ui.els || !ui.els.log) return;
    _freezeLastReply();   // 上一张卡冻结为历史（只最新一轮可应用/放弃）
    if (ui.els.logSec) ui.els.logSec.style.display = '';
    if (ui.els.logWrap) ui.els.logWrap.style.display = '';
    var card = document.createElement('div');
    card.className = 'tm-aa-reply';
    card.innerHTML = '<div class="reply-who"><span class="reply-ava">师</span><b>国师</b><span class="tm-aa-flex"></span><button type="button" class="reply-copy" title="复制这条回复">⧉</button></div>'
      + '<div class="tm-aa-summary" style="display:none"></div>'
      + '<div class="tm-aa-sec" data-sec="diff" style="display:none">改动预览</div>'
      + '<div class="tm-aa-diff" style="display:none"></div>'
      + '<div class="tm-aa-val" style="display:none"></div>'
      + '<div class="reply-actions" style="display:none"><button type="button" class="reply-apply">应用到剧本</button><button type="button" class="reply-discard">放弃</button></div>'
      + '<div class="reply-tag"></div>';
    ui.els.log.appendChild(card);
    // 重指当前结果元素到本卡
    ui.els.summary = card.querySelector('.tm-aa-summary');
    ui.els.diffSec = card.querySelector('[data-sec="diff"]');
    ui.els.diff = card.querySelector('.tm-aa-diff');
    ui.els.val = card.querySelector('.tm-aa-val');
    ui.els.actions = card.querySelector('.reply-actions');
    ui.els.apply = card.querySelector('.reply-apply');
    ui.els.discard = card.querySelector('.reply-discard');
    ui.els.apply.addEventListener('click', onApply);
    ui.els.discard.addEventListener('click', onDiscard);
    var _cp = card.querySelector('.reply-copy');   // Claude 式 · 回复悬停复制
    if (_cp) _cp.addEventListener('click', function () {
      var _sm = card.querySelector('.tm-aa-summary');
      var _txt = (_sm && _sm.innerText) || card.innerText || '';
      try { navigator.clipboard.writeText(_txt.trim()).then(function () { _cp.textContent = '✓'; setTimeout(function () { _cp.textContent = '⧉'; }, 900); }, function () { setStatus('复制失败（浏览器限制）'); }); }
      catch (e) { setStatus('复制失败'); }
    });
    ui._reply = card;
    ui._clampBtn = null;   // 长总结折叠按钮归属新卡
    _logScrollMaybe(true);   // 设 pinned·生成中跟随
    // 聊天化：summary/diff 在本函数返回后才同步渲染，故用 rAF 在下一帧（渲染完）把新卡顶滚入视口，让玩家从回复开头读起
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(function () { try { if (ui._reply && ui._reply.scrollIntoView) ui._reply.scrollIntoView({ block: 'start' }); } catch (e) {} });
  }
  // 冻结上一张回应卡：隐藏操作按钮（历史只读）。tag 由 onApply/onDiscard 设。
  function _freezeLastReply() {
    var c = ui._reply;
    if (!c || !c.isConnected) { ui._reply = null; return; }
    c.classList.add('frozen');
    var act = c.querySelector('.reply-actions'); if (act) act.style.display = 'none';
    ui._reply = null;
  }
  // UI·B · 会话流：把一条用户消息作为气泡追加进过程区（开启一轮对话）
  // UI·Y · 消息操作：每个气泡 hover 出 复制/编辑重发/重试（Claude Code/ChatGPT 招牌）。
  //   opts.input=真正要回填的文本（display text 可能是合成标签如"🔍 审阅整个剧本")；opts.kind=重试时派发到对应运行器。
  function _appendUserMsg(text, opts) {
    if (!ui.els || !ui.els.log) return;
    opts = opts || {};
    ui.els.logSec.style.display = ''; ui.els.logWrap.style.display = '';
    var b = document.createElement('div');
    b.className = 'tm-aa-msg-user';
    var input = (opts.input != null ? opts.input : text) || '';
    b.setAttribute('data-msg', String(input).slice(0, 2000));
    b.setAttribute('data-kind', opts.kind || 'generate');
    b.innerHTML = '<span class="mu-who">你</span><span class="mu-text">' + esc(String(text || '').slice(0, 300)) + '</span>'
      + '<span class="tm-aa-msg-acts">'
      + '<button type="button" class="mu-act" data-act="copy" title="复制">⧉</button>'
      + '<button type="button" class="mu-act" data-act="edit" title="编辑后重发">✎</button>'
      + '<button type="button" class="mu-act" data-act="retry" title="重试这条">↻</button>'
      + '</span>';
    ui.els.log.appendChild(b);
    _ensureMsgActions();
    _logScrollMaybe(true);   // 用户刚发消息 → 强制滚到底并重新跟随
  }
  // UI·Y · 气泡操作的委托监听（在 log 容器上绑一次）
  function _ensureMsgActions() {
    if (!ui.els || !ui.els.log || ui._msgActsBound) return;
    ui._msgActsBound = true;
    ui.els.log.addEventListener('click', function(ev) {
      var btn = ev.target && ev.target.closest ? ev.target.closest('.mu-act') : null;
      if (!btn) return;
      var bubble = btn.closest('.tm-aa-msg-user'); if (!bubble) return;
      var text = bubble.getAttribute('data-msg') || '', kind = bubble.getAttribute('data-kind') || 'generate';
      var act = btn.getAttribute('data-act');
      if (act === 'copy') {
        try { navigator.clipboard.writeText(text).then(function() { var o = btn.textContent; btn.textContent = '✓'; setTimeout(function() { btn.textContent = o; }, 900); }, function() { setStatus('复制失败（浏览器限制）'); }); }
        catch (e) { setStatus('复制失败'); }
        return;
      }
      if (ui.running) { setStatus('运行中 · 先点「■ 停止」再' + (act === 'edit' ? '编辑重发' : '重试')); return; }
      if (act === 'edit') {   // 回填输入框·不自动发·让玩家改
        ui.els.req.value = text; try { ui.els.req.dispatchEvent(new Event('input')); } catch (e) {}
        ui.els.req.focus();
        setStatus('已填回输入框 · 编辑后点「生成」重发');
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
    if (ui._logPinned) { el.scrollTop = el.scrollHeight; if (ui.els.toBottom) ui.els.toBottom.hidden = true; }
  }
  function _ensureLogFollow() {
    if (!ui.els || !ui.els.logWrap || ui._logFollowBound) return;
    ui._logFollowBound = true;
    if (ui._logPinned == null) ui._logPinned = true;
    var el = ui.els.logWrap;
    el.addEventListener('scroll', function() {
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
      p.style.cssText = p._fsPrev || ''; p._fs = false;
      p.classList.remove('railon');   // 侧栏是全屏版式的一部分·退全屏一并收起
      if (ui.els.resize) ui.els.resize.style.display = '';
      if (ui.els.fs) ui.els.fs.innerHTML = _icon('expand');
      if (origin === 'user') { try { localStorage.setItem('tm_aa_winmode', 'dock'); } catch (e) {} }   // 只记用户亲手的选择（关闭面板等内部退全屏不算）
    } else {
      p._fsPrev = p.style.cssText;
      p.style.position = 'fixed'; p.style.left = '14px'; p.style.top = '14px'; p.style.right = '14px'; p.style.bottom = '14px';
      p.style.width = 'auto'; p.style.height = 'auto'; p.style.maxWidth = 'none'; p.style.maxHeight = 'none'; p.style.zIndex = '100000';
      p._fs = true;
      if (ui.els.resize) ui.els.resize.style.display = 'none';
      if (ui.els.fs) ui.els.fs.innerHTML = _icon('restore');
      if (origin === 'user') { try { localStorage.setItem('tm_aa_winmode', 'fs'); } catch (e) {} }
    }
  }
  // 首开默认全屏窗（应用感·Claude 桌面端即窗口）·此后尊重用户上次亲手选择的窗态。
  // 剧本工坊(reset)把面板钉成案侧常驻坞(body.je-guoshi-docked)——坞即窗态·不再叠加全屏。
  function _autoWinMode() {
    setTimeout(function () {   // 推迟一拍：宿主坞胶水在 fab.click() 之后才挂 je-guoshi-docked·同步检查会扑空
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
    { label: '体检（免 API）', act: 'preflight' },
    { label: '补齐缺失字段', fill: '请用 listGaps 找出游戏运行时必需但缺失的字段，逐一补齐，让剧本完整可玩；改完用 validateDraft 自查。' },
    { label: '校验并列问题', fill: '请用 validateDraft 全面校验本剧本，列出所有引用冲突、人口/区划不一致等问题（先只报告，不要改）。' },
    { label: '加 3 个人物', fill: '请按「人物塑造章法」技能（useSkill 展开）新增 3 名贴合本剧本背景的人物：含姓名、势力归属、官职、性格与 AI 人格；势力名必须用剧本里已存在的势力。' },
    { label: '生成人物立绘', fill: '请按「人物立绘生成规范」技能（useSkill 展开）给主角与 2-3 名核心人物生成立绘：先读各自人设字段再生成；已有立绘的跳过不覆盖；未配生图 API 就告诉我怎么配。' },
    { label: '审阅出报告', act: 'review' },
    { label: '讲解剧本', act: 'explain' },
    { label: '三堂会审', act: 'critics' }
  ];
  function _renderEmpty() {
    if (!ui.els || !ui.els.empty || ui._emptyBuilt) return;
    ui._emptyBuilt = true;
    var chips = _EMPTY_CHIPS.map(function(c, i) { return '<button type="button" class="emp-chip" data-i="' + i + '">' + esc(c.label) + '</button>'; }).join('');
    var _hr = new Date().getHours();   // Claude 桌面端式 · 按时辰问安
    var _greet = _hr < 5 ? '夜深了' : (_hr < 11 ? '早上好' : (_hr < 13 ? '午安' : (_hr < 18 ? '下午好' : '晚上好')));
    ui.els.empty.innerHTML = '<div class="emp-seal">师</div><div class="emp-title">' + _greet + '，陛下。国师在此</div><div class="emp-sub">把想改什么告诉国师，或试试：</div><div class="emp-chips">' + chips + '</div>';
    ui.els.empty.addEventListener('click', function(ev) {
      var btn = ev.target && ev.target.closest ? ev.target.closest('.emp-chip') : null;
      if (!btn) return;
      var c = _EMPTY_CHIPS[+btn.getAttribute('data-i')]; if (!c) return;
      if (c.act === 'preflight') { runPreflightUI(); return; }
      if (c.act === 'review') { runReview(); return; }
      if (c.act === 'explain') { runExplainUI(); return; }
      if (c.act === 'critics') { _armCritics(); return; }   // 刀3 · 武装会审：玩家输入需求后点发送即走三堂会审
      if (c.fill != null) {   // 回填 → 让玩家审阅后自己发（不自动跑·省 API）
        ui.els.req.value = c.fill; try { ui.els.req.dispatchEvent(new Event('input')); } catch (e) {}
        ui.els.req.focus(); _syncEmpty();
      }
    });
  }
  // UI·AF · 输入框自动增高 + 实时字数（Claude.ai/ChatGPT 输入框招牌）：随内容长高(到上限才滚)·右下角显字数。
  function _autoGrowReq() {
    var el = ui.els && ui.els.req; if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 180) + 'px';
    var n = (el.value || '').length;
    var cc = ui.els.charCount;
    if (cc) {
      cc.hidden = n === 0;
      cc.textContent = n + ' 字';
      cc.style.top = (el.offsetTop + el.offsetHeight - 18) + 'px';   // 贴输入框右下（body 为定位容器）
    }
  }
  // 仅在「面板空闲、什么都没跑」时显示欢迎态（Claude 式：此时问候语与 composer 一同居中）
  function _syncEmpty() {
    if (!ui.els || !ui.els.empty) return;
    var blank = !ui.running
      && ui.els.logWrap.style.display === 'none'
      && ui.els.summary.style.display === 'none'
      && ui.els.actions.style.display === 'none'
      && !(ui.els.req && ui.els.req.value.trim());
    ui.els.empty.style.display = blank ? '' : 'none';
    if (ui.els.body) ui.els.body.classList.toggle('tm-aa-blank', blank);
  }

  // 计划模式 · 批准后按计划执行（续规划线程、全工具）
  function executePlan() {
    if (ui.running || !ui.draft) return;
    if (!_contextReady()) return;
    resetResults(true);   // 聊天化：保留对话流（结果作为新卡 append，不清历史）
    setRunning(true);
    setStatus('正在按计划执行…');
    _runOwned('runAuthoringLoop', ui.draft, '按上面的计划执行这些改动；改完用 validateDraft 自查后调用 finish。', {
      conventions: _convForRun(),   /* S9 · 两层约定注入(全局+本剧本) */
      priorConversation: ui.conversation,
      editorContext: _editorContext(),
      allowedCollections: ui.allowedCollections || null,
      allowDestructive: ui.allowDestructive !== false,
      exemplars: _exemplars(),                              // 方向J · 从剧本已有实体学丰满度（治空内容）
      onStep: function(step) { appendLog(step); setStatus('第 ' + step.iteration + ' 轮…'); },
      onText: function(text, iter) { appendText(text, iter); }
    }).then(function(res) {
      setRunning(false);
      ui.conversation = res.conversation;
      _captureSideEffects(res, true);
      _logRun('计划执行', '(按计划执行)', res);   // 方向M
      _beginReplyCard();
      renderSummary(res.summary, res.notes, res.suggestedConventions, true);   // UI·P · 流式
      renderDiff(_draftDiff(), res.uncertainties);   // 以开工基线审阅，实时剧本留到应用时做冲突合并
      renderValidation(res.finalValidation);
      ui.els.actions.style.display = '';
      ui.els.apply.className = res.finalValidation.ok ? '' : 'warn';
      ui.els.apply.textContent = res.finalValidation.ok ? '应用到剧本' : '仍有问题·确认应用';
      ui.els.discard.textContent = '放弃';
      setStatus('已按计划执行（' + res.iterations + ' 轮）· 可应用 / 放弃 / 追问');
    }).catch(function(err) { renderError('plan-execute', '(按计划执行)', err); });   // UI·AC · 错误卡+重试
  }

  // 方向D · 审阅模式：只读巡查 → 出体检报告（不产生可应用改动）。输入框文字（若有）作审阅重点。
  function runReview() {
    if (ui.running) return;
    if (!_contextReady()) return;
    if (!AA || typeof AA.runAuthoringLoop !== 'function') { setStatus('agent 核心未加载'); return; }
    resetResults(true);   // 聊天化：保留对话流（结果作为新卡 append，不清历史）
    var focus = (ui.els.req.value || '').trim();
    _appendUserMsg(focus || '审阅整个剧本', { kind: 'review', input: focus });   // UI·B 会话流 + UI·Y 重试派发
    _startDraft();   // 只读快照（审阅不改它）
    ui.conversation = null; ui._pendingPlan = false;
    setRunning(true);
    setStatus('正在审阅剧本…（agent 只读巡查，出体检报告，可能需要数十秒）');
    _runOwned('runAuthoringLoop', ui.draft, focus, {
      conventions: _convForRun(),   /* S9 · 两层约定注入(全局+本剧本) */
      reviewOnly: true,
      editorContext: _editorContext(),
      onStep: function(step) { appendLog(step); setStatus('审阅中·第 ' + step.iteration + ' 轮…'); },
      onText: function(text, iter) { appendText(text, iter); }
    }).then(function(res) {
      setRunning(false);
      _captureSideEffects(res, false);
      _logRun('审阅', focus || '(全面体检)', res);   // 方向M
      ui.els.req.value = ''; _autoGrowReq();
      _clearDraft();   // 审阅不产生可应用改动
      if (res.review) {
        _beginReplyCard();
        renderReview(res.review, true);   // UI·P · 流式
        _renderConvSuggest(res.suggestedConventions);   // S11 · 审阅中发现的约定 → 记住(本剧本层)
        setStatus('审阅完成（' + res.iterations + ' 轮·约 ' + res.tokensUsed + ' tokens）· 仅诊断，未改动剧本');
      } else {
        setStatus('审阅结束（' + (res.stopReason || '') + '）· 未生成报告，可重试');
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
    _beginReplyCard();   // 聊天化：体检结果进对话流卡
    if (ui.els.summary) { ui.els.summary.innerHTML = '<b>运行时体检</b>' + esc(pf.summary); ui.els.summary.style.display = ''; }
    ui.els.diffSec.style.display = ''; ui.els.diff.style.display = '';
    ui.els.diffSec.textContent = '体检结果（' + pf.blockers.length + ' 阻塞 · ' + pf.warnings.length + ' 建议）';
    var rows = [];
    pf.blockers.forEach(function(b) { rows.push('<div class="tm-aa-finding"><span class="sev rm">[阻塞]</span> ' + esc(b) + '</div>'); });
    pf.warnings.slice(0, 30).forEach(function(w) { rows.push('<div class="tm-aa-finding"><span class="sev ch">[建议]</span> ' + esc(w) + '</div>'); });
    if (!rows.length) rows.push('<div class="ln" style="color:#7fe0a0">✓ 运行时体检通过，可正常加载</div>');
    ui.els.diff.innerHTML = rows.join('');
    setStatus(pf.bootable ? ('✓ 运行时体检：可运行' + (pf.warnings.length ? ('·' + pf.warnings.length + ' 项建议') : '')) : ('✗ ' + pf.blockers.length + ' 处会影响运行·可让国师修'));
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
    var sm = '已合并捆绑包：势力 +' + res.added.factions + ' · 人物 +' + res.added.characters + ' · 关系 +' + res.added.relations + (renamedN ? ' · 重名已改 ' + renamedN + ' 个' : '');
    _logRun('导入捆绑', '捆绑包导入', { summary: sm, tokensUsed: 0, iterations: 0, stopReason: 'imported' });   // 方向M · 记历史 + 让 markLastApplied 生效
    _beginReplyCard();
    renderSummary(sm, null, null);
    renderDiff(_draftDiff());
    renderValidation(AA.validateDraft(ui.draft));
    ui.els.actions.style.display = '';
    ui.els.apply.className = ''; ui.els.apply.textContent = '应用到剧本'; ui.els.discard.textContent = '放弃';
    setStatus('捆绑包已合并入草稿 · 审阅后应用');
    return true;
  }

  // 方向O · 生成版本说明（确定性·无需 API）：汇总已应用改动 + 一键复制
  function runChangelogUI() {
    if (ui.running) { setStatus('请等当前运行结束'); return; }
    resetResults(true);   // 聊天化：保留对话流（结果作为新卡 append，不清历史）
    var cl = buildChangelog();
    if (!cl.count) { setStatus('暂无已应用的改动可汇总（先应用一些 agent 改动，版本说明会自动累积）'); return; }
    if (ui.els.summary) {
      ui.els.summary.innerHTML = '<b>版本说明（' + cl.count + ' 项改动）<button type="button" class="tm-aa-cl-copy">复制</button></b>'
        + '<div class="tm-aa-cl-md">' + _md(cl.text) + '</div>';
      ui.els.summary.style.display = '';
      var btn = ui.els.summary.querySelector('.tm-aa-cl-copy');
      if (btn) btn.addEventListener('click', function() {
        try { navigator.clipboard.writeText(cl.text).then(function() { btn.textContent = '已复制 ✓'; }, function() { btn.textContent = '复制失败'; }); }
        catch (e) { btn.textContent = '复制失败'; }
      });
    }
    setStatus('版本说明已生成（' + cl.count + ' 项）· 可复制');
  }

  // 方向L · 剧本问答（只读）：玩家问关于剧本的问题，agent 查清后直接回答，不碰剧本
  function runQaUI() {
    if (ui.running) return;
    if (!_contextReady()) return;
    var question = (ui.els.req.value || '').trim();
    if (!question) { setStatus('请先在输入框输入你想问的问题'); return; }
    if (!AA || typeof AA.runAuthoringLoop !== 'function') { setStatus('agent 核心未加载'); return; }
    resetResults(true);   // 聊天化：保留对话流（结果作为新卡 append，不清历史）
    _appendUserMsg(question, { kind: 'qa', input: question });   // UI·B 会话流 + UI·Y 重试派发
    _startDraft();   // 只读快照
    ui.conversation = null; ui._pendingPlan = false; ui._pendingClarify = false;
    setRunning(true);
    setStatus('正在查证并回答…（只读，不改剧本）');
    _runOwned('runAuthoringLoop', ui.draft, question, {
      conventions: _convForRun(),   /* S9 · 两层约定注入(全局+本剧本) */
      qaOnly: true,
      editorContext: _editorContext(),
      onStep: function(step) { appendLog(step); setStatus('查证中·第 ' + step.iteration + ' 轮…'); },
      onText: function(text, iter) { appendText(text, iter); }
    }).then(function(res) {
      setRunning(false);
      _logRun('问答', question, res);   // 方向M
      _clearDraft(); ui.els.req.value = ''; _autoGrowReq();
      if (res.answer) {
        _beginReplyCard();
        renderAnswer(question, res.answer.answer, true);   // UI·P · 流式
        setStatus('回答完成（' + res.iterations + ' 轮·约 ' + res.tokensUsed + ' tokens）· 仅查询，未改动剧本');
      } else {
        setStatus('未得到回答（' + (res.stopReason || '') + '）· 可重试');
      }
    }).catch(function(err) { renderError('qa', question, err); });   // UI·AC · 错误卡+重试
  }
  function renderAnswer(question, answer, stream) {
    if (!ui.els || !ui.els.summary) return;
    ui.els.summary.innerHTML = '<b>问：' + esc(question) + '</b><span class="tm-aa-stream">' + _md(answer || '（无回答）') + '</span>';
    ui.els.summary.style.display = '';
    _streamThenLink(ui.els.summary.querySelector('.tm-aa-stream'), stream);   // UI·P 吐字 + UI·AH linkify（只对答案部分）
  }

  // 方向N · 解释/教学（只读）：讲解剧本设计意图与机制脉络，给接手者 onboarding
  function runExplainUI() {
    if (ui.running) return;
    if (!_contextReady()) return;
    if (!AA || typeof AA.runAuthoringLoop !== 'function') { setStatus('agent 核心未加载'); return; }
    var focus = (ui.els.req.value || '').trim();
    resetResults(true);   // 聊天化：保留对话流（结果作为新卡 append，不清历史）
    _appendUserMsg(focus || '讲解剧本', { kind: 'explain', input: focus });   // UI·B 会话流 + UI·Y 重试派发
    _startDraft();   // 只读快照
    ui.conversation = null; ui._pendingPlan = false; ui._pendingClarify = false;
    setRunning(true);
    setStatus('正在通读剧本并讲解…（只读，不改剧本）');
    _runOwned('runAuthoringLoop', ui.draft, focus, {
      conventions: _convForRun(),   /* S9 · 两层约定注入(全局+本剧本) */
      explainOnly: true,
      editorContext: _editorContext(),
      onStep: function(step) { appendLog(step); setStatus('通读中·第 ' + step.iteration + ' 轮…'); },
      onText: function(text, iter) { appendText(text, iter); }
    }).then(function(res) {
      setRunning(false);
      _logRun('讲解', focus || '(全面 onboarding)', res);
      _clearDraft(); ui.els.req.value = ''; _autoGrowReq();
      if (res.explanation) {
        _beginReplyCard();
        renderExplanation(res.explanation, true);   // UI·P · 流式
        setStatus('讲解完成（' + res.iterations + ' 轮·约 ' + res.tokensUsed + ' tokens）· 仅讲解，未改动剧本');
      } else {
        setStatus('未生成讲解（' + (res.stopReason || '') + '）· 可重试');
      }
    }).catch(function(err) { renderError('explain', focus, err); });   // UI·AC · 错误卡+重试
  }
  function renderExplanation(ex, stream) {
    if (!ui.els) return;
    if (ui.els.summary) {
      ui.els.summary.innerHTML = '<b>剧本讲解</b><span class="tm-aa-stream">' + _md((ex && ex.summary) || '（无总览）') + '</span>'; ui.els.summary.style.display = '';
      _streamThenLink(ui.els.summary.querySelector('.tm-aa-stream'), stream);   // UI·P 吐字 + UI·AH linkify（总览部分）
    }
    ui.els.diffSec.style.display = ''; ui.els.diff.style.display = '';
    var points = (ex && ex.points) || [];
    ui.els.diffSec.textContent = '讲解（' + points.length + ' 个主题）';
    if (!points.length) { ui.els.diff.innerHTML = '<div class="ln" style="color:#8f8a7e">（无主题）</div>'; return; }
    ui.els.diff.innerHTML = points.slice(0, 20).map(function(p) {
      p = p || {};
      return '<div class="tm-aa-finding"><span class="sev ch">▸</span> <b>' + esc(p.topic || '') + '</b><div class="iss">' + _md(p.detail || '') + '</div></div>';
    }).join('');
  }

  // UI·AC · 错误态卡片 + 一键重试（Claude.ai/ChatGPT 网页端范式）：失败不再只是一行灰状态字，
  //   渲一张醒目错误卡（核心已 _classifyApiError 给中文可操作提示）+「重试」(按 kind 重跑) +「复制错误」。
  function renderError(kind, request, err) {
    setRunning(false);
    if (err && err.code === 'editor-document-changed') {
      ui._lastErr = null; // 旧请求不能通过“重试”重新套到当前案卷。
      if (ui.els && ui.els.actions) ui.els.actions.style.display = 'none';
      setStatus(err.message);
      return;
    }
    ui._lastErr = { kind: kind, request: request || '', message: (err && err.message) || String(err || '未知错误') };
    if (!ui.els) { setStatus('失败：' + ui._lastErr.message); return; }
    _beginReplyCard();   // 聊天化：错误也作为对话流里一张卡
    if (!ui.els.summary) { setStatus('失败：' + ui._lastErr.message); return; }
    ui.els.summary.innerHTML = '<div class="tm-aa-errcard">'
      + '<div class="ec-head">运行失败</div>'
      + '<div class="ec-msg">' + esc(ui._lastErr.message) + '</div>'
      + '<div class="ec-acts"><button type="button" class="ec-retry">↻ 重试</button><button type="button" class="ec-copy">复制错误</button></div>'
      + '</div>';
    ui.els.summary.style.display = '';
    if (ui.els.diffSec) ui.els.diffSec.style.display = 'none';
    if (ui.els.diff) ui.els.diff.style.display = 'none';
    if (ui.els.val) ui.els.val.style.display = 'none';
    if (ui.els.actions) ui.els.actions.style.display = 'none';
    var rt = ui.els.summary.querySelector('.ec-retry');
    if (rt) rt.addEventListener('click', _retryLast);
    var cp = ui.els.summary.querySelector('.ec-copy');
    if (cp) cp.addEventListener('click', function() {
      try { navigator.clipboard.writeText(ui._lastErr.message).then(function() { cp.textContent = '✓ 已复制'; setTimeout(function() { cp.textContent = '复制错误'; }, 900); }, function() {}); } catch (e) {}
    });
    setStatus('运行失败 · 可点「重试」重跑');
  }
  function _retryLast() {
    var e = ui._lastErr; if (!e || ui.running) return;
    if (e.kind === 'plan-execute') { executePlan(); return; }   // 计划执行：草稿/线程仍在，直接重跑
    ui.els.req.value = e.request || '';
    try { ui.els.req.dispatchEvent(new Event('input')); } catch (er) {}
    if (e.kind === 'review') runReview();
    else if (e.kind === 'qa') runQaUI();
    else if (e.kind === 'explain') runExplainUI();
    else if (e.kind === 'orchestrate') runOrchestratedUI();
    else if (e.kind === 'critics') runWithCriticsUI();
    else onGenerate();
  }

  // 方向H · 子代理/任务分解：大需求先分解、再逐步在同一草稿上聚焦执行（共享草稿即合并）
  function runOrchestratedUI() {
    if (ui.running) return;
    if (!_contextReady()) return;
    if (ui.planMode) { setStatus('问策仅规划；分解执行前请切换为共审/放行，或先生成并批准计划。'); return; }
    var request = (ui.els.req.value || '').trim();
    if (!request) { setStatus('请先输入需求（大任务会被分解为多步执行）'); return; }
    if (!AA || typeof AA.runOrchestrated !== 'function') { setStatus('agent 核心未加载'); return; }
    resetResults(true);   // 聊天化：保留对话流（结果作为新卡 append，不清历史）
    _appendUserMsg(request, { kind: 'orchestrate', input: request });   // UI·B 会话流 + UI·Y 重试派发
    _startDraft();
    ui.conversation = null; ui._pendingPlan = false;
    setRunning(true);
    setStatus('正在分解任务…（先拆子任务，再逐步执行）');
    // UI·D · 步骤清单 + 实时勾：分解任务渲染成清单，子任务 待办○/进行中⟳/完成✓ 实时更新
    var _clSteps = [], _clEl = null;
    function _renderChecklist(currentIdx, allDone) {
      if (!_clSteps.length || !ui.els) return;
      if (!_clEl) {
        _clEl = document.createElement('div'); _clEl.className = 'tm-aa-checklist';
        ui.els.logSec.style.display = ''; ui.els.logWrap.style.display = '';
        ui.els.log.insertBefore(_clEl, ui.els.log.firstChild);
      }
      _clEl.innerHTML = '<div class="cl-head">分解为 ' + _clSteps.length + ' 个子任务' + (allDone ? '（已完成）' : '') + '</div>' + _clSteps.map(function(s, k) {
        var st = (allDone || k < currentIdx) ? 'done' : (k === currentIdx ? 'run' : 'pend');
        var ic = st === 'done' ? '✓' : (st === 'run' ? '⟳' : '○');
        return '<div class="cl-item ' + st + '"><span class="cl-ic">' + ic + '</span>' + esc((k + 1) + '. ' + s) + '</div>';
      }).join('');
    }
    _runOwned('runOrchestrated', ui.draft, request, {
      conventions: _convForRun(),   /* S9 · 两层约定注入(全局+本剧本) */
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
      if (_clSteps.length) _renderChecklist(_clSteps.length, true);   // 全部 ✓
      _logRun('分解执行', request, res);   // 方向M
      ui.els.req.value = ''; _autoGrowReq();
      _beginReplyCard();
      renderSummary(res.summary, null, null, true);   // UI·P · 流式
      var diffs = _draftDiff();
      renderDiff(diffs);
      renderValidation(res.finalValidation);
      ui.els.actions.style.display = '';
      ui.els.apply.className = res.finalValidation.ok ? '' : 'warn';
      ui.els.apply.textContent = res.finalValidation.ok ? '应用到剧本' : '仍有问题·确认应用';
      ui.els.discard.textContent = '放弃';
      setStatus((res.orchestrated ? '分解执行完成（' + res.steps.length + ' 步）' : '执行完成') + (res.stopReason === 'aborted' ? '·已中断' : '') + '· 可应用 / 放弃');
      if (ui.autonomy === 'auto' && res.finalValidation.ok && diffs.length) { onApply(); }
    }).catch(function(err) { renderError('orchestrate', request, err); });   // UI·AC · 错误卡+重试
  }

  // ───────────────────────────────────────────────
  //  刀3 · 对抗式三角色（三堂会审）：国师拟稿 → 史官查史+谏官批平衡 → 据谏修订 → 走 diff/应用审
  //  入口走「武装」式：点 🏛️ chip 武装，玩家写需求后点发送即走会审（区别于普通生成）。引擎在 AA.runWithCritics。
  // ───────────────────────────────────────────────
  var _REQ_PLACEHOLDER = '描述你想要的修改，例如：把主角势力改名为「西凉军」并补两个文官';
  function _armAutoMode() {
    if (ui._criticsArmed) _disarmCriticsVisual();
    ui._autoModeArmed = true;
    if (ui.els && ui.els.go && !ui.running) { ui.els.go.textContent = '智'; ui.els.go.style.fontSize = '13px'; ui.els.go.title = '自动选择工作模式：直接执行 / 先出计划 / 分解编排 / 三堂会审'; }
    if (ui.els && ui.els.req) { ui.els.req.placeholder = '【自动选择模式】写下需求——国师只为这次请求选择最合适的工作模式'; ui.els.req.focus(); }
    setStatus('已手动选择「自动选择工作模式」· 下一次发送时择一执行；它不是默认行为，也不改变问策/共审/放行权限');
  }
  function _disarmAutoVisual() {
    ui._autoModeArmed = false;
    if (ui.els && ui.els.go && !ui.running && !ui._criticsArmed) { ui.els.go.textContent = '↑'; ui.els.go.style.fontSize = ''; ui.els.go.title = 'Enter 发送 · Shift+Enter 换行'; }
    if (ui.els && ui.els.req && !ui._criticsArmed) ui.els.req.placeholder = _REQ_PLACEHOLDER;
  }
  function _armCritics() {
    if (ui._autoModeArmed) _disarmAutoVisual();
    ui._criticsArmed = true;
    if (ui.els && ui.els.go && !ui.running) { ui.els.go.textContent = '审'; ui.els.go.style.fontSize = '13px'; ui.els.go.title = '三堂会审：拟稿→史官查史+谏官批平衡→据谏修订'; }
    if (ui.els && ui.els.req) { ui.els.req.placeholder = '【三堂会审】写下要新增/修改什么——国师拟稿，再由史官查史实、谏官批平衡，据谏修订后交你审'; ui.els.req.focus(); }
    setStatus('已开启三堂会审 · 写下需求后点发送：拟稿 → 史官+谏官会审 → 据谏修订（比普通生成多 2~3 次调用）');
  }
  function _disarmCriticsVisual() {
    ui._criticsArmed = false;
    if (ui.els && ui.els.go && !ui.running && !ui._autoModeArmed) { ui.els.go.textContent = '↑'; ui.els.go.style.fontSize = ''; ui.els.go.title = 'Enter 发送 · Shift+Enter 换行'; }
    if (ui.els && ui.els.req && !ui._autoModeArmed) ui.els.req.placeholder = _REQ_PLACEHOLDER;
  }
  function runWithCriticsUI() {
    if (!_contextReady()) return;
    if (ui.running) return;
    if (ui.planMode) { setStatus('问策仅规划；三堂会审包含实际拟稿，请先切换为共审/放行。'); return; }
    var request = (ui.els.req.value || '').trim();
    if (!request) { _armCritics(); setStatus('三堂会审需要一个需求：先写下要新增/改什么，再点发送'); return; }
    if (!AA || typeof AA.runWithCritics !== 'function') { setStatus('agent 核心未加载'); return; }
    resetResults(true);   // 聊天化：保留对话流（结果作为新卡 append，不清历史）
    _appendUserMsg(request, { kind: 'critics', input: request });
    _startDraft();
    ui.conversation = null; ui._pendingPlan = false;
    setRunning(true);
    setStatus('三堂会审 · 国师拟稿中…');
    _beginReplyCard();   // 聊天化打磨：会审开始就建卡，进度清单 + 两官报告 + 修订 diff 都进同一张卡
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
    _runOwned('runWithCritics', ui.draft, request, {
      conventions: _convForRun(),   /* S9 · 两层约定注入(全局+本剧本) */
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
      _info.hist = ((res.critiques && res.critiques.history && res.critiques.history.findings) || []).length;
      _info.bal = ((res.critiques && res.critiques.balance && res.critiques.balance.findings) || []).length;
      _phase.draft = 'done'; _phase.review = 'done'; _phase.revise = 'done'; _render(true);
      _logRun('三堂会审', request, res);
      ui.els.req.value = ''; _autoGrowReq();
      renderCriticsReport(res);
      var diffs = _draftDiff();
      renderDiff(diffs);
      var val = res.finalValidation || AA.validateDraft(ui.draft);
      renderValidation(val);
      if (diffs.length) {
        ui.els.actions.style.display = '';
        ui.els.apply.className = val.ok ? '' : 'warn';
        ui.els.apply.textContent = val.ok ? '应用到剧本' : '仍有问题·确认应用';
        ui.els.discard.textContent = '放弃';
      }
      setStatus('三堂会审完成 · ' + (res.revised ? '已据谏修订' : '两官无异议') + (diffs.length ? '：审阅 diff 后应用 / 放弃' : '：无改动'));
      if (ui.autonomy === 'auto' && val.ok && diffs.length) { onApply(); }
    }).catch(function(err) { renderError('critics', request, err); });
  }
  // 刀3 · 会审报告：史官 + 谏官两份意见并列展示（只读·让玩家看到博弈），修订后的 diff 在下方走应用审
  function renderCriticsReport(res) {
    if (!ui.els || !ui.els.summary) return;
    function block(icon, title, rev) {
      var fs = (rev && rev.findings) || [];
      var head = '<div class="cl-head">' + (icon ? icon + ' ' : '') + title + '（' + fs.length + ' 条' + (rev && rev.summary ? '·' + esc(rev.summary) : '') + '）</div>';
      if (!fs.length) return head + '<div class="ln" style="color:#7fe0a0">✓ 无异议</div>';
      var sevRank = { '高': 0, '中': 1, '低': 2 };
      fs = fs.slice().sort(function(a, b) { return (sevRank[a && a.severity] != null ? sevRank[a.severity] : 3) - (sevRank[b && b.severity] != null ? sevRank[b.severity] : 3); });
      return head + fs.slice(0, 20).map(function(f) {
        f = f || {}; var sev = f.severity || '?'; var sevCls = sev === '高' ? 'rm' : (sev === '中' ? 'ch' : 'add');
        return '<div class="tm-aa-finding"><span class="sev ' + sevCls + '">[' + esc(sev) + ']</span> <b>' + esc(f.dimension || '') + '</b>'
          + (f.location ? ' <span class="loc">' + esc(String(f.location).slice(0, 50)) + '</span>' : '')
          + '<div class="iss">' + _mdLine(f.issue || '') + '</div>'
          + (f.suggestion ? '<div class="sug">→ ' + _mdLine(f.suggestion) + '</div>' : '') + '</div>';
      }).join('');
    }
    var hist = (res.critiques && res.critiques.history) || null;
    var bal = (res.critiques && res.critiques.balance) || null;
    ui.els.summary.innerHTML = '<b>三堂会审报告</b><span class="tm-aa-stream">' + esc(res.summary || '') + '</span>'
      + block('', '史官·史实核查', hist) + block('', '谏官·平衡可玩', bal)
      + (res.revised ? '<div class="ln" style="color:#a7e0cf;margin-top:6px">下方 diff 是国师据两官意见修订后的终稿，审阅后决定应用。</div>'
                     : '<div class="ln" style="color:#8f8a7e;margin-top:6px">两官未提需修订的问题，下方即拟稿终稿。</div>');
    ui.els.summary.style.display = '';
  }

  // UI·Q · 停止/中断生成：调 agent core 的 abort()（立即取消在途请求·不施未完成的改动）。
  // 适用于所有运行类型(普通编辑/计划执行/审阅/问答/讲解/分解执行)——abort() 终止当前 _activeRun。
  function onStop() {
    if (!ui.running || ui._stopping) return;
    ui._stopping = true;
    var stopped = false;
    try { stopped = !!(AA && AA.abort && AA.abort()); } catch (e) {}
    if (ui.els && ui.els.go) { ui.els.go.textContent = '…'; ui.els.go.disabled = true; }
    _cancelTypewriter();   // 打字机若在途也立即落定
    setStatus(stopped ? '正在停止…（已取消在途请求，不施未完成的改动）' : '当前没有正在进行的运行');
  }
  // 「生成」键的统一入口：运行中→停止，空闲→生成
  function onGoClick() { if (ui.running) onStop(); else onGenerate(); }

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
    if (ui._criticsArmed) { _disarmCriticsVisual(); runWithCriticsUI(); return; }   // 刀3 · 已武装会审 → 改走三堂会审
    var request = (ui.els.req.value || '').trim();
    if (!request) { setStatus('请先输入需求'); return; }
    if (!AA || typeof AA.runAuthoringLoop !== 'function') { setStatus('agent 核心未加载'); return; }
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
    var continuing = !planOnly && !!(ui.conversation && ui.conversation.length && !ui._pendingPlan);
    var _attTxt = _attachPrefix();   // S2 · 文本附件内联为参考上下文
    var _imgs = _takeImages();       // S2 · 图片走视觉通道
    var _attN = (_imgs ? _imgs.length : 0) + _attState().files.length;
    resetResults(continuing);   // UI·B · 会话流：续接保留线程+消息流、新对话清空
    _appendUserMsg(request + (_attN ? '（附 ' + _attN + ' 件）' : ''), { input: request });    // 回显用户消息气泡
    setRunning(true);
    var _autoPrefix = _autoSelection ? ('自动选择 → ' + _autoSelection.label + '（' + _autoSelection.reason + '）· ') : '';
    setStatus(_autoPrefix + (planOnly ? '正在规划…（agent 先只读、出计划）' : '正在生成…（agent 多轮编辑+自校验，可能需要数十秒）'));
    if (!continuing) { _startDraft(); if (!planOnly) ui.conversation = null; }
    else if (!ui.draft) { _startDraft(); }   // 续接但上轮已应用 → 从当前(已更新)剧本新建 draft，对话线程保留

    var _rtd = (continuing && ui._restoredTodos && ui._restoredTodos.length) ? ui._restoredTodos : null;   // 刀H3 · 恢复的任务表一次性回灌
    ui._restoredTodos = null;
    _clearAttach();   // S2 · 附件随本轮发出·签行清空
    _runOwned('runAuthoringLoop', ui.draft, request + _attTxt, {
      conventions: _convForRun(),   /* S9 · 两层约定注入(全局+本剧本) */
      planOnly: planOnly,
      images: _imgs,
      initialTodos: _rtd,
      priorConversation: continuing ? ui.conversation : null,
      memory: continuing ? '' : _buildMemory(),             // 跨会话记忆：新对话才注入历史；续接已在线程里
      runHistory: continuing ? '' : _runHistoryBrief(),     // 刀③D2 · 运行教训回喂（新对话首轮）
      microPlanConfirm: _microPlanOn(),                     // 刀③D1 · 歧义先对齐微计划（默认开·＋菜单可关）
      editorContext: _editorContext(),
      allowedCollections: ui.allowedCollections || null,   // 方向F · 范围沙箱
      allowDestructive: ui.allowDestructive !== false,      // 方向F · 危险操作开关
      exemplars: _exemplars(),                              // 方向J · 从剧本已有实体学丰满度（治空内容）（开关式）
      onStep: function(step) { appendLog(step); setStatus('第 ' + step.iteration + ' 轮…'); },
      onText: function(text, iter) { appendText(text, iter); }
    }).then(function(res) {
      setRunning(false);
      ui.conversation = res.conversation;   // 维度1 · 存住线程
      _saveSession(res, request, res.remonstrance ? '进谏' : (res.clarification ? '澄清' : (res.plan ? '计划' : '编辑')));   // S5 · 落盘到当前会话(跨刷新/跨剧本可切回)
      _captureSideEffects(res, continuing);   // saveMemory/saveSkill 先暂存，随草稿一起批准/放弃
      // 自动续接：未完成且因轮次/token 上限停 → 自动发「继续」续接（复用连续会话线程·持续调用直到完整·安全上限 3 次）。
      if (!planOnly && !res.finished && (res.stopReason === 'maxIterations' || res.stopReason === 'tokenBudget') && (ui._autoCont || 0) < 3) {
        ui._autoCont = (ui._autoCont || 0) + 1;
        setStatus('未完成（' + (res.stopReason === 'tokenBudget' ? '达 token 上限' : '达迭代上限') + '）· 自动继续 ' + ui._autoCont + '/3…（持续到完整结果）');
        ui.els.req.value = '继续完成上面尚未完成的改动，全部完成后再调用 finish，不要重复已做的。';
        var nextOwner = ui._draftOwner, nextConversation = ui.conversation;
        setTimeout(function() { if (_ownerCurrent(nextOwner) && ui.conversation === nextConversation) onGenerate(); }, 60);
        return;
      }
      ui._autoCont = 0;
      _logRun(res.remonstrance ? '进谏' : (res.clarification ? '澄清' : (res.plan ? '计划' : '编辑')), request, res);   // 方向M · 记一条历史
      ui.els.req.value = ''; _autoGrowReq();
      var stopMap = { finish: '完成', maxIterations: '达迭代上限', tokenBudget: '达 token 上限', finishBlocked: '校验未过·已停', noToolCalls: 'agent 未再操作', aborted: '已停止', planned: '已出计划', needsClarification: '需澄清', needsConfirmation: '需定夺' };
      if (res.clarification) {              // 方向K · 交互式澄清：气泡 + 输入框作答续接（聊天化·无独立按钮）
        ui._pendingPlan = false; ui._pendingClarify = true;
        renderClarify(res.clarification.questions);
        setStatus('国师需要先澄清几点 · 在下方输入框作答后发送即可继续');
      } else if (res.remonstrance) {        // 刀1 · 国师进谏：气泡 + 输入框回应续接（聊天化·无独立按钮）
        ui._pendingPlan = false; ui._pendingClarify = true;
        renderRemonstrance(res.remonstrance);
        setStatus('国师进谏 · 在下方输入框回应（采纳／坚持／改需求）后发送即可继续');
      } else if (res.plan) {                // 计划模式：展示计划 + 批准/重规划（进对话流回应卡）
        _beginReplyCard();
        renderPlan(res.plan);
        ui.els.actions.style.display = '';
        ui.els.apply.className = 'plan-approve';
        ui.els.apply.textContent = '批准并执行';
        ui.els.discard.textContent = '放弃计划';
        ui._pendingPlan = true;
        setStatus('已出计划（' + res.iterations + ' 轮）· 批准则按计划执行，或改需求重新规划');
      } else if (planOnly) {
        ui._pendingPlan = false;
        ui.els.actions.style.display = 'none';
        setStatus('问策结束（' + (stopMap[res.stopReason] || res.stopReason) + '）· 未生成可批准计划，未改动剧本');
      } else {                              // 普通：diff + 应用（进对话流回应卡）
        _beginReplyCard();
        ui._pendingPlan = false;
        ui.els.discard.textContent = '放弃';
        setStatus('结束（' + (stopMap[res.stopReason] || res.stopReason) + '·' + res.iterations + ' 轮·约 ' + res.tokensUsed + ' tokens）· 可继续追加需求，或应用/放弃');
        renderSummary(res.summary, res.notes, res.suggestedConventions, true);   // UI·P · 流式
        var diffs = _draftDiff();
        renderDiff(diffs, res.uncertainties);   // 置信度标注：高亮没把握的改动
        renderValidation(res.finalValidation);
        ui.els.actions.style.display = '';
        ui.els.apply.className = res.finalValidation.ok ? '' : 'warn';
        ui.els.apply.textContent = res.finalValidation.ok ? '应用到剧本' : '仍有问题·确认应用';
        // 方向F · 自主度「全自动」：校验通过且有改动则自动应用（无需玩家点）
        if (ui.autonomy === 'auto' && res.finalValidation.ok && diffs.length) { onApply(); }
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

  function onApply() {
    if (ui.running || !_contextReady()) return;
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
      if (!diffs.length) { setStatus('本轮没有可应用的改动'); return; }
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
      _commitCurrent(_finalSc, ui._draftOwner);   // 逐项冲突合并后仍须由同一案卷确认提交。
      var _fxN = (ui._pendingSideEffects || []).length;
      if (_fxN && AA && typeof AA.commitSideEffects === 'function') {
        var _fxCommit = AA.commitSideEffects(ui._pendingSideEffects);
        if (!_fxCommit || _fxCommit.ok === false) {
          try { _commitCurrent(_liveBefore, ui._draftOwner); }
          catch (rollbackError) { throw new Error('记忆/技能提交失败；剧本回滚未确认，请检查当前案卷：' + (rollbackError && rollbackError.message || rollbackError)); }
          throw new Error('剧本附带的记忆/技能提交失败，已回滚剧本：' + ((_fxCommit && _fxCommit.error) || '未知错误'));
        }
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
      setStatus('已应用到剧本 ✓' + (partial ? '（仅接受的改动·拒绝了 ' + rej.size + ' 处）' : '') + (_fxN ? '（并提交 ' + _fxN + ' 条记忆/技能）' : '') + ((_fixN || _dropN) ? '（已自动修复 ' + _fixN + ' 条' + (_dropN ? '·丢弃 ' + _dropN + ' 条无法解析条目' : '') + '）' : '') + '（可继续追问·同一会话）');
      if (ui._reply) { ui._reply.classList.add('applied'); var _atag = ui._reply.querySelector('.reply-tag'); if (_atag) _atag.textContent = '✓ 已应用到剧本' + (partial ? '（拒绝 ' + rej.size + ' 处）' : ''); }
      _freezeLastReply();   // 聊天化：应用后冻结当前卡（按钮隐藏·成历史只读）
      _clearDraft();
      // 真·连续会话：应用后【保留】对话线程，下条指令在同一会话里续接（draft 已清·续接时从当前剧本新建）。
      //   想另起新对话用「＋ 新对话」或「放弃」。线程上限交 runAuthoringLoop 的 token 预算自然收口。
    } catch (e) {
      if (e && e.code === 'edit-conflict') {
        var paths = (e.conflicts || []).slice(0, 3).map(function(c) { return c.path; }).join('、');
        setStatus('检测到并行编辑冲突，未应用任何改动' + (paths ? '：' + paths : '') + '；请重新生成或先处理冲突');
      } else setStatus('应用失败：' + (e && e.message || e));
    }
  }

  function onDiscard() {
    if (ui.running) return;
    _clearDraft();
    ui._conversationOwner = null;
    ui.conversation = null;   // 维度1 · 放弃后结束会话
    ui._pendingPlan = false;
    ui._pendingClarify = false;
    if (ui._reply) { ui._reply.classList.add('discarded'); var _dtag = ui._reply.querySelector('.reply-tag'); if (_dtag) _dtag.textContent = '— 已放弃本轮改动'; }
    _freezeLastReply();   // 聊天化：放弃后冻结当前卡（留在流里·只读）
    setStatus('已放弃本次改动 · 可继续追加需求或开新对话');
    _syncEmpty();   // UI·AD · 回到干净状态则重现欢迎态
  }
  // 真·连续会话：另起新对话（清空当前线程+消息流；上一会话已存入历史·下次新对话会注入记忆延续）。
  function newConversation() {
    if (ui.running) { setStatus('运行中，请先停止再新开对话'); return; }
    if (ui._sessionSwitch) { setStatus('正在切换案卷，请等待载入完成'); return; }
    _clearDraft(); ui.conversation = null; ui._pendingPlan = false; ui._pendingClarify = false;
    ui._conversationOwner = null;
    ui._restoredTodos = null; ui._sessId = null; _sessPtrSet(_fileKey(), null);   // S5 · 新对话=新会话·旧会话留侧栏可切回·指针置空(开面板不再拉回)
    if (ui._criticsArmed) _disarmCriticsVisual();   // 刀3 · 新对话清掉未用的会审武装
    if (ui._autoModeArmed) _disarmAutoVisual();
    resetResults(false);
    _syncEmpty();
    setStatus('已开始新对话（上一会话已入历史/记忆，可被延续）');
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
    listSessions: listSessions, switchSession: switchSession, deleteSession: deleteSession, renameSession: renameSession, forkSession: forkSession, rememberConvention: rememberConvention };
})(typeof window !== 'undefined' ? window : this);
