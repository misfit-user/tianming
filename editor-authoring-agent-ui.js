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
  var ui = { adapter: null, draft: null, running: false, els: null, _checkpoints: [], _ckptSeq: 0 };
  var MAX_CKPT = 15;   // 方向G · 检查点栈上限（session 内存态·满则淘汰最旧）

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function _clone(o) { try { return JSON.parse(JSON.stringify(o)); } catch (e) { return o; } }   // 维度3 · 撤销快照

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

  // ── 单色描边 SVG 图标集（去 emoji·随 currentColor 融入双主题） ──
  var _ICON_PATHS = {
    bars: '<path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11"/>',
    contrast: '<circle cx="8" cy="8" r="5.5"/><path d="M8 2.5v11"/>',
    pen: '<path d="M9.6 3.4l3 3L6.2 12.8 3 13l.2-3.2z"/>',
    expand: '<path d="M6 3H3v3M10 3h3v3M3 10v3h3M13 10v3h-3"/>',
    restore: '<path d="M5.5 3v2.5H3M10.5 3v2.5H13M3 10.5h2.5V13M13 10.5h-2.5V13"/>',
    close: '<path d="M4 4l8 8M12 4l-8 8"/>',
    pulse: '<path d="M2 8.5h2.6L6.6 4l2.6 8 1.6-3.5H14"/>',
    search: '<circle cx="7" cy="7" r="4.2"/><path d="M10.2 10.2l3.2 3.2"/>',
    chat: '<path d="M3 4.5h10V11H8.2L5 13.5V11H3z"/>',
    book: '<path d="M8 4c-1.2-.9-3.2-1-5-.4V12c1.8-.6 3.8-.5 5 .4 1.2-.9 3.2-1 5-.4V3.6C11.2 3 9.2 3.1 8 4z"/><path d="M8 4v8.4"/>',
    route: '<circle cx="4.5" cy="4" r="1.7"/><circle cx="11.5" cy="12" r="1.7"/><path d="M4.5 5.7V8a3 3 0 0 0 3 3h2.3"/>',
    scale: '<path d="M8 3v10M4.5 5h7M4.5 5 3 8.2a1.9 1.9 0 0 0 3 0zM11.5 5 10 8.2a1.9 1.9 0 0 0 3 0z"/>',
    save: '<path d="M3.5 3.5h7l2 2v7h-9z"/><path d="M5.5 3.5V7h5V3.5M5.5 12.5V9.5h5v3"/>',
    image: '<rect x="2.5" y="3.5" width="11" height="9" rx="1.5"/><path d="m4.5 10.5 2.5-3 2 2.2L11 7l2.5 3.5"/><circle cx="6" cy="6.2" r="1"/>',
    undo: '<path d="M4.5 6.5H10a3 3 0 0 1 0 6H7"/><path d="M6.8 4 4.5 6.5 6.8 9"/>',
    check: '<path d="M3 8.5 6.5 12 13 4.5"/>',
    clip: '<path d="M12.4 7.6 7.8 12.2a3.1 3.1 0 0 1-4.4-4.4l5.2-5.2a2.1 2.1 0 0 1 3 3L6.4 10.8a1.05 1.05 0 0 1-1.5-1.5l4.3-4.3"/>'
  };
  // 工作过程 · 步骤行的工具类别图标（写/读/校/记/完成）
  var _TOOL_ICON = {
    applyEdit: 'pen', applyPush: 'pen', multiEdit: 'pen', bulkAdd: 'pen', renameEntity: 'pen', removeEntity: 'pen', mapAssignOwner: 'pen', renameRegion: 'pen',
    getField: 'search', getFields: 'search', searchEntities: 'search', globalSearch: 'search', findReferences: 'search', listCollection: 'search', describeSchema: 'search', listGaps: 'search', readSource: 'search', grepSource: 'search', listSource: 'search', mapOverview: 'search', genReference: 'search', checkHistory: 'search', fieldContract: 'search',
    validateDraft: 'pulse', preflight: 'pulse', generateImage: 'image',
    note: 'book', todoWrite: 'book', recordConvention: 'book', flagUncertain: 'book', steer: 'chat', macroCompact: 'undo',
    finish: 'check'
  };
  function _icon(name) {
    return '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (_ICON_PATHS[name] || '') + '</svg>';
  }

  function injectStyles() {
    if (document.getElementById('tm-aa-style')) return;
    var css = [
      // ── 自带美术字体（editor.html 未链主 styles.css·面板自声明 @font-face·同名文件随游戏分发）──
      //    站酷小薇=文艺宋体风(显示+回复正文·SIL OFL)·马善政=毛笔楷(朱印「师」)。Windows 无思源宋时不再砸到 SimSun 锯齿。
      '@font-face{font-family:"GS-XiaoWei";src:url("' + FONT_BASE + 'assets/fonts/ZCOOLXiaoWei-Regular.ttf") format("truetype");font-weight:400;font-style:normal;font-display:swap}',
      '@font-face{font-family:"GS-MaShanZheng";src:url("' + FONT_BASE + 'assets/fonts/MaShanZheng-Regular.ttf") format("truetype");font-weight:400;font-style:normal;font-display:swap}',
      // 面板域内钉死盒模型与表单字体继承（宿主 editor.html 有 *{box-sizing:border-box}·此处显式声明保证任何宿主下渲染一致）
      '#' + PANEL_ID + ',#' + PANEL_ID + ' *,#' + PANEL_ID + ' *::before,#' + PANEL_ID + ' *::after{box-sizing:border-box}',
      '#' + PANEL_ID + ' button,#' + PANEL_ID + ' input,#' + PANEL_ID + ' textarea{font-family:inherit;font-size:inherit;line-height:inherit}',
      '#tm-aa-fab,#tm-aa-fab *{box-sizing:border-box}',
      // ── 主题变量（调研自 claude.ai 真 token：珊瑚 #cc785c/激活 #a9583e·画布 #faf9f5·暗面 #181715/#1f1e1b·发丝线 #e6dfd8·墨 #141413）──
      '#' + PANEL_ID + '{--bg:#262624;--surface:#30302e;--sunken:#1f1e1b;--code:#181715;--bubble:#3a3833;',
      '--bd:rgba(250,249,245,.08);--bd2:rgba(250,249,245,.16);--ink:#faf9f5;--tx:#f0eee6;--tx2:#a09d96;--tx3:#807d75;',
      '--ac:#cc785c;--ac-hi:#dd8a6e;--ok:#72c88a;--warn:#d9ad4b;--bad:#e07a72;--danger:#c64545;',
      '--serif:"GS-XiaoWei","TM-ZCOOL-XiaoWei","Noto Serif SC","Source Han Serif SC","KaiTi","楷体",Georgia,serif;',   // 自带小薇打头·思源宋次之·再退楷体(CN Windows 预装·远优于 SimSun)
      '--seal:"GS-MaShanZheng","TM-MaShanZheng","KaiTi","楷体",var(--serif);',   // 朱印「师」=毛笔楷
      '--mono:"JetBrains Mono",ui-monospace,Consolas,"Courier New",monospace;',
      '--shadow:0 18px 60px rgba(0,0,0,.5),0 2px 10px rgba(0,0,0,.35)}',
      '#' + PANEL_ID + '[data-theme="light"]{--bg:#faf9f5;--surface:#fdfdfb;--sunken:#f5f0e8;--code:#f5f0e8;--bubble:#efe9de;',
      '--bd:#ebe6df;--bd2:#e6dfd8;--ink:#141413;--tx:#3d3d3a;--tx2:#6c6a64;--tx3:#8e8b82;',
      '--ac:#cc785c;--ac-hi:#a9583e;--ok:#3f9e58;--warn:#a67c12;--bad:#c64545;--danger:#c64545;',
      '--shadow:0 18px 60px rgba(60,50,35,.18),0 2px 10px rgba(60,50,35,.10)}',
      // 世界类型选择器（史实/虚构·标签隐于气泡提示·药丸自明）
      '#tm-aa-worldkind{display:flex;align-items:center;gap:5px;font-size:11px;color:var(--tx3)}',
      '#tm-aa-worldkind .tm-aa-wk-lab{display:none}',
      '#tm-aa-worldkind .tm-aa-wk-opt{background:transparent;color:var(--tx2);border:1px solid var(--bd2);border-radius:999px;padding:2px 11px;font-size:11px;cursor:pointer;font-family:inherit;line-height:1.5;transition:background .12s,color .12s,border-color .12s}',
      '#tm-aa-worldkind .tm-aa-wk-opt:hover{background:var(--surface);color:var(--tx)}',
      '#tm-aa-worldkind .tm-aa-wk-opt.on{background:var(--ac);color:#fff;border-color:var(--ac)}',
      // 呼出按钮（朱印徽记 + 文字）
      '#tm-aa-fab{position:fixed;right:18px;bottom:18px;z-index:99998;display:inline-flex;align-items:center;gap:8px;background:#2f2d2a;color:#f0eee6;border:1px solid rgba(255,255,255,.14);',
      'border-radius:999px;padding:8px 16px 8px 9px;font-size:13px;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.35);font-family:inherit;letter-spacing:.06em;transition:transform .12s,box-shadow .12s,background .12s,border-color .12s}',
      '#tm-aa-fab:hover{background:#3a3833;border-color:rgba(217,119,87,.6);transform:translateY(-1px);box-shadow:0 10px 26px rgba(0,0,0,.4)}',
      '#tm-aa-fab .fab-seal{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:6px;background:linear-gradient(140deg,#cc785c,#a9583e);color:#fff;font-family:"GS-MaShanZheng","TM-MaShanZheng","KaiTi","楷体",serif;font-weight:400;font-size:14px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.14)}',
      // 面板窗体（应用级窗口感·开场淡入）
      '#' + PANEL_ID + '{position:fixed;right:18px;bottom:64px;z-index:99999;width:560px;max-width:calc(100vw - 36px);',
      'height:86vh;display:none;flex-direction:column;background:var(--bg);color:var(--tx);border:1px solid var(--bd2);',
      'border-radius:16px;box-shadow:var(--shadow);font-family:-apple-system,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;font-size:14px;overflow:hidden}',
      '#' + PANEL_ID + '.open{display:flex;animation:tm-aa-in .18s ease-out}',
      '@keyframes tm-aa-in{from{opacity:0;transform:translateY(10px) scale(.985)}to{opacity:1;transform:none}}',
      '#' + PANEL_ID + ' ::-webkit-scrollbar{width:8px;height:8px}',
      '#' + PANEL_ID + ' ::-webkit-scrollbar-thumb{background:var(--bd2);border-radius:99px;border:2px solid transparent;background-clip:content-box}',
      '#' + PANEL_ID + ' ::-webkit-scrollbar-track{background:transparent}',
      // 顶栏（纤薄·同底色·发丝线）
      '#tm-aa-hd{display:flex;align-items:center;justify-content:space-between;padding:9px 12px 9px 14px;background:var(--bg);border-bottom:1px solid var(--bd);flex:0 0 auto}',
      '#tm-aa-hd .tm-aa-hdbtns{display:flex;align-items:center;gap:2px}',
      '.tm-aa-resize{position:absolute;left:0;top:0;bottom:0;width:6px;cursor:ew-resize;z-index:5}.tm-aa-resize:hover{background:rgba(217,119,87,.3)}',
      '.tm-aa-search{position:sticky;top:-10px;z-index:6;display:flex;align-items:center;gap:4px;margin:-4px -2px 2px;padding:4px 6px;background:var(--sunken);border:1px solid var(--bd);border-radius:9px}',
      '.tm-aa-search[hidden]{display:none}',
      '.tm-aa-search input{flex:1;min-width:0;background:var(--bg);color:var(--tx);border:1px solid var(--bd);border-radius:6px;padding:3px 7px;font-size:11px;font-family:inherit;outline:none}',
      '.tm-aa-search .tm-aa-search-n{color:var(--tx3);font-size:10px;white-space:nowrap;font-variant-numeric:tabular-nums}',
      '.tm-aa-search button{background:var(--surface);color:var(--tx2);border:none;border-radius:6px;padding:2px 8px;font-size:11px;cursor:pointer;line-height:1.4}.tm-aa-search button:hover{color:var(--tx)}',
      '.tm-aa-hl{background:rgba(229,192,123,.35);color:inherit;border-radius:2px}.tm-aa-hl.active{background:#e5c07b;color:#1a1206}',
      '#tm-aa-hd button{display:inline-flex;align-items:center;justify-content:center;background:none;border:none;color:var(--tx3);cursor:pointer;line-height:1;padding:6px;border-radius:8px;transition:background .12s,color .12s}',
      '#tm-aa-hd button:hover{background:var(--surface);color:var(--tx)}',
      '#tm-aa-hd button svg{display:block}',
      '#tm-aa-hd b{font-size:15px;font-family:var(--serif);font-weight:600;letter-spacing:-0.2px;color:var(--ink)}',   // 显示衬线负字距（Copernicus 规范）
      // 朱印徽记「师」：方印形制（印章为方·非圆）·衬线白文·随处替代 emoji 头像
      '.tm-aa-ava{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:7px;background:linear-gradient(140deg,#cc785c,#a9583e);color:#fff;font-family:var(--seal);font-weight:400;font-size:16px;margin-right:9px;vertical-align:middle;box-shadow:0 1px 5px rgba(204,120,92,.4),inset 0 0 0 1px rgba(255,255,255,.14);text-shadow:0 1px 1px rgba(0,0,0,.2)}',
      '#tm-aa-hd .sub{font-size:11.5px;color:var(--tx3);margin-left:8px;font-family:inherit;letter-spacing:0}',
      // 侧栏（Claude 桌面端式·全屏下的会话历史栏）
      '#tm-aa-rail{position:absolute;left:0;top:45px;bottom:0;width:236px;display:none;flex-direction:column;gap:4px;background:var(--sunken);border-right:1px solid var(--bd);padding:10px 9px;box-sizing:border-box;z-index:6}',
      '#' + PANEL_ID + '.railon #tm-aa-rail{display:flex}',
      '#' + PANEL_ID + '.railon #tm-aa-body{margin-left:236px}',
      '#tm-aa-railnew{display:flex;align-items:center;gap:7px;background:transparent;color:var(--tx);border:1px solid var(--bd2);border-radius:10px;padding:8px 11px;font-size:13px;cursor:pointer;font-family:inherit;transition:background .12s,border-color .12s}',
      '#tm-aa-railnew:hover{background:var(--surface);border-color:var(--ac)}',
      '#tm-aa-rail .rail-sec{font-size:11px;color:var(--tx3);letter-spacing:.06em;margin:10px 4px 3px}',
      '#tm-aa-raillist{flex:1 1 auto;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:2px}',
      '.rail-item{position:relative;padding:7px 24px 7px 9px;border-radius:9px;cursor:pointer;transition:background .12s}',
      '.rail-item:hover{background:var(--surface)}',
      '.rail-item.on{background:var(--surface);box-shadow:inset 2px 0 0 var(--ac)}',   // S5 · 当前会话高亮（Claude 桌面端式左缘线）
      '.rail-item .ri-req{font-size:12.5px;color:var(--tx);line-height:1.45;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.rail-item .ri-meta{font-size:10.5px;color:var(--tx3);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.rail-item .ri-meta .ri-ok{color:var(--ok)}',
      '.rail-item .ri-meta .ri-file{color:var(--ac)}',   // S5 · 属别的剧本 → 切换徽记
      '.rail-item .ri-del,.rail-item .ri-ren,.rail-item .ri-fork{position:absolute;right:5px;top:6px;display:none;background:none;border:none;color:var(--tx3);font-size:13px;line-height:1;padding:2px 4px;border-radius:6px;cursor:pointer}',
      '.rail-item .ri-ren{right:24px;font-size:11px;top:7px}',
      '.rail-item .ri-fork{right:43px;font-size:11px;top:7px}',
      '.rail-item:hover .ri-del,.rail-item:hover .ri-ren,.rail-item:hover .ri-fork{display:block}',
      '.rail-item .ri-del:hover{color:var(--bad);background:var(--sunken)}',
      '.rail-item .ri-ren:hover,.rail-item .ri-fork:hover{color:var(--tx);background:var(--sunken)}',
      '.rail-empty{font-size:11.5px;color:var(--tx3);padding:8px 6px;line-height:1.6}',
      '#tm-aa-railclear{background:none;border:none;color:var(--tx3);font-size:11px;cursor:pointer;padding:6px;border-radius:8px;font-family:inherit}#tm-aa-railclear:hover{color:var(--bad);background:var(--surface)}',
      '#tm-aa-body{padding:10px 20px 14px;overflow:hidden;display:flex;flex-direction:column;gap:10px;position:relative;flex:1 1 auto;min-height:0;transition:margin-left .15s ease-out;',
      'background:radial-gradient(900px 380px at 82% -6%,rgba(217,119,87,.06),transparent 62%)}',   // 氛围：右上暖光晕·纵深而非平涂
      '#' + PANEL_ID + '[data-theme="light"] #tm-aa-body{background:radial-gradient(900px 380px at 82% -6%,rgba(201,100,66,.05),transparent 62%)}',
      '#' + PANEL_ID + ' button:focus-visible,#' + PANEL_ID + ' textarea:focus-visible{outline:2px solid var(--ac);outline-offset:2px}',
      // 空态（Claude 桌面端招牌）：问候语 + composer 一起居中于画布·有内容后 composer 落底
      '#tm-aa-body.tm-aa-blank{justify-content:center}',
      '#tm-aa-body.tm-aa-blank #tm-aa-composer{order:5;margin-top:6px}',
      '#tm-aa-body.tm-aa-blank .tm-aa-empty{margin:0}',
      // Composer（Claude 式：圆角大卡片·内嵌底行）
      '#tm-aa-composer{display:flex;flex-direction:column;gap:7px;order:80;flex:0 0 auto;z-index:7;background:var(--bg);margin-left:-20px;margin-right:-20px;padding:8px 20px 10px;position:relative}',
      '#tm-aa-req{width:100%;box-sizing:border-box;background:transparent;color:var(--tx);border:none;',
      'border-radius:16px;padding:13px 15px 6px;font-family:inherit;font-size:14px;line-height:1.65;resize:none;min-height:56px;max-height:200px;overflow:auto;display:block;outline:none}',
      '#tm-aa-req::placeholder{color:var(--tx3)}',
      '.tm-aa-charcount{position:absolute;top:6px;right:12px;font-size:10px;color:var(--tx3);pointer-events:none;background:var(--surface);padding:0 5px;border-radius:5px;z-index:1;opacity:.9}',
      '.tm-aa-charcount[hidden]{display:none}',
      '#tm-aa-field{position:relative;width:100%;max-width:760px;margin:0 auto;box-sizing:border-box;background:var(--surface);border:1px solid var(--bd2);border-radius:16px;transition:border-color .15s,box-shadow .15s;box-shadow:0 2px 12px rgba(0,0,0,.10)}',
      '#tm-aa-field:focus-within{border-color:var(--ac);box-shadow:0 0 0 3px rgba(204,120,92,.15),0 2px 14px rgba(0,0,0,.12)}',
      // 输入卡内嵌底行：＋能力菜单 · 世界类型 · 发送
      '.tm-aa-fieldbar{display:flex;align-items:center;gap:7px;padding:5px 7px 7px 8px;flex-wrap:wrap}',
      // 权限模式 pill（问策/共审/放行·CC permission modes 对照）
      '#tm-aa-perm{flex:0 0 auto;background:transparent;color:var(--tx2);border:1px solid var(--bd2);border-radius:999px;padding:2px 12px;font-size:11px;cursor:pointer;font-family:inherit;line-height:1.5;transition:color .12s,border-color .12s,background .12s}',
      '#tm-aa-perm:hover{color:var(--tx);background:var(--sunken)}',
      '#tm-aa-perm.pm-auto{color:#fff;background:var(--ac);border-color:var(--ac)}',   // 放行=高权·实底提示
      '#tm-aa-perm.pm-plan{color:var(--ok);border-color:rgba(132,216,165,.45)}',        // 问策=只读·青提示
      '#tm-aa-permpop{position:absolute;left:8px;bottom:calc(100% + 6px);z-index:12;width:300px;max-width:calc(100vw - 40px);background:var(--surface);border:1px solid var(--bd2);border-radius:12px;box-shadow:0 14px 44px rgba(0,0,0,.35);padding:9px 8px}',
      '#tm-aa-permpop[hidden]{display:none}',
      '#tm-aa-permpop .mp-h{font-size:12px;color:var(--tx);font-weight:600;margin:2px 5px 7px;letter-spacing:.04em}',
      '.tm-aa-pm{display:block;width:100%;text-align:left;background:none;border:1px solid transparent;color:var(--tx);cursor:pointer;font-size:12.5px;padding:7px 9px;border-radius:9px;font-family:inherit;line-height:1.45}',
      '.tm-aa-pm:hover{background:rgba(204,120,92,.12)}',
      '.tm-aa-pm.on{border-color:var(--ac);background:rgba(204,120,92,.10)}',
      '.tm-aa-pm b{font-weight:600}',
      '.tm-aa-pm .pm-d{display:block;font-size:10.5px;color:var(--tx3);margin-top:1px}',
      '#tm-aa-permpop .pm-danger{display:flex;align-items:center;gap:7px;font-size:11.5px;color:var(--tx2);margin:8px 6px 2px;cursor:pointer}',
      '#tm-aa-permpop .pm-danger input{cursor:pointer}',
      '#tm-aa-permpop .mp-hint{font-size:10.5px;color:var(--tx3);line-height:1.6;margin:8px 6px 2px;border-top:1px solid var(--bd);padding-top:7px}',
      '.tm-aa-flex{flex:1 1 auto}',
      '#tm-aa-plus{flex:0 0 auto;width:30px;height:30px;display:flex;align-items:center;justify-content:center;background:transparent;color:var(--tx2);border:1px solid var(--bd2);border-radius:50%;padding:0;cursor:pointer;font-size:16px;line-height:1;transition:background .12s,color .12s,transform .12s}',
      '#tm-aa-plus:hover{background:var(--sunken);color:var(--tx)}',
      '#tm-aa-plus.on{background:var(--ac);border-color:var(--ac);color:#fff;transform:rotate(45deg)}',
      '#tm-aa-attach-btn{flex:0 0 auto;width:30px;height:30px;display:flex;align-items:center;justify-content:center;background:transparent;color:var(--tx2);border:1px solid var(--bd2);border-radius:50%;padding:0;cursor:pointer;transition:background .12s,color .12s}',
      '#tm-aa-attach-btn:hover{background:var(--sunken);color:var(--tx)}',
      // 附件签行（图片缩略 + 文件名签·发送时随需求交付）
      '#tm-aa-attach{display:flex;flex-wrap:wrap;gap:6px;width:100%;max-width:760px;margin:0 auto;box-sizing:border-box}',
      '#tm-aa-attach[hidden]{display:none}',
      '.att-chip{display:inline-flex;align-items:center;gap:6px;background:var(--surface);border:1px solid var(--bd2);border-radius:9px;padding:3px 6px 3px 8px;font-size:11px;color:var(--tx2);max-width:230px}',
      '.att-chip .att-ic{display:inline-flex;color:var(--tx3)}',
      '.att-chip .att-nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:130px}',
      '.att-chip .att-sz{color:var(--tx3);font-size:10px}',
      '.att-chip.att-img{padding:3px}',
      '.att-chip.att-img img{width:40px;height:40px;object-fit:cover;border-radius:6px;display:block}',
      '.att-x{background:none;border:none;color:var(--tx3);cursor:pointer;font-size:13px;line-height:1;padding:0 3px}.att-x:hover{color:var(--bad)}',
      '#' + PANEL_ID + '.tm-aa-drag{outline:2px dashed var(--ac);outline-offset:-6px}',
      '#' + PANEL_ID + '.tm-aa-drag::before{content:"松手把文件 / 截图交给国师";position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(204,120,92,.10);color:var(--ac);font-size:15px;font-family:var(--serif);z-index:99;pointer-events:none}',
      '#tm-aa-plusmenu{position:absolute;left:8px;bottom:calc(100% + 6px);z-index:12;min-width:230px;background:var(--surface);border:1px solid var(--bd2);border-radius:12px;box-shadow:0 14px 44px rgba(0,0,0,.35);padding:5px;max-height:min(460px,62vh);overflow:auto}',
      '#tm-aa-plusmenu[hidden]{display:none}',
      '.tm-aa-mi{display:flex;align-items:center;gap:9px;width:100%;text-align:left;background:none;border:none;color:var(--tx);cursor:pointer;font-size:12.5px;padding:7px 9px;border-radius:8px;font-family:inherit;line-height:1.4}',
      '.tm-aa-mi:hover{background:rgba(217,119,87,.14)}',
      '.tm-aa-mi .mi-ic{flex:0 0 18px;display:inline-flex;align-items:center;justify-content:center;color:var(--tx3)}',
      '.tm-aa-mi:hover .mi-ic{color:var(--ac)}',
      '.tm-aa-mi .mi-ic svg{display:block}',
      '.tm-aa-mi .mi-d{display:block;font-size:10.5px;color:var(--tx3);margin-top:1px}',
      '.tm-aa-mi-sep{height:1px;background:var(--bd);margin:4px 8px}',
      '#tm-aa-go{flex:0 0 auto;width:32px;height:32px;display:flex;align-items:center;justify-content:center;background:var(--ac);color:#fff;border:none;border-radius:10px;padding:0;cursor:pointer;font-size:15px;line-height:1;transition:background .12s,transform .08s}',   // 圆角方（claude.ai 发送钮形制·非正圆）
      '#tm-aa-go:hover{background:var(--ac-hi)}#tm-aa-go:active{transform:scale(.92)}',
      '#tm-aa-go:disabled{opacity:.5;cursor:default}',
      '#tm-aa-go.stopbtn{background:var(--danger)}#tm-aa-go.stopbtn:hover{background:#d2554f}',
      '#tm-aa-status{font-size:11.5px;color:var(--tx3);min-height:15px;width:100%;max-width:760px;margin:0 auto;box-sizing:border-box;padding:0 4px;line-height:1.5}',
      '.tm-aa-running #tm-aa-status{color:var(--tx2)}',
      '.tm-aa-running #tm-aa-status::before{content:"";display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--ac);margin-right:7px;vertical-align:1px;animation:tm-aa-pulse 1.5s ease-in-out infinite}',   // 呼吸朱点（纯 CSS·非 emoji）
      '@keyframes tm-aa-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.35;transform:scale(.8)}}',
      '#tm-aa-ctx{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--tx2);background:rgba(217,119,87,.09);border:1px solid rgba(217,119,87,.3);border-radius:8px;padding:3px 9px;width:100%;max-width:760px;margin:0 auto;box-sizing:border-box}',
      '#tm-aa-ctx[hidden]{display:none}',
      '.tm-aa-ctx-txt{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.tm-aa-ctx-ico{flex:0 0 auto;opacity:.85}',
      '.tm-aa-ctx-pin{flex:0 0 auto;background:none;border:none;cursor:pointer;font-size:12px;opacity:.6;padding:0 2px;line-height:1}',
      '.tm-aa-ctx-pin:hover,.tm-aa-ctx-pin.on{opacity:1}',
      '#tm-aa-mentions{display:flex;flex-wrap:wrap;gap:4px;width:100%;max-width:760px;margin:0 auto;box-sizing:border-box}',
      '#tm-aa-mentions[hidden]{display:none}',
      '.tm-aa-mchip{display:inline-flex;align-items:center;gap:3px;font-size:11px;color:var(--tx2);background:var(--surface);border:1px solid var(--bd2);border-radius:999px;padding:1px 4px 1px 8px}',
      '.tm-aa-mx{background:none;border:none;color:var(--tx2);cursor:pointer;font-size:13px;line-height:1;padding:0 2px;opacity:.7}.tm-aa-mx:hover{opacity:1}',
      '#tm-aa-atpop{position:absolute;left:50%;transform:translateX(-50%);width:min(728px,calc(100% - 40px));bottom:calc(100% + 4px);z-index:13;max-height:210px;overflow:auto;background:var(--surface);border:1px solid var(--bd2);border-radius:12px;box-shadow:0 12px 36px rgba(0,0,0,.4);padding:4px}',
      '#tm-aa-atpop[hidden]{display:none}',
      // composer 位于面板上部（空态/无消息）时浮层翻到下方，否则飞出面板顶（@ 与 / 同治·JS 量空间挂 below）
      '#tm-aa-atpop.below,#tm-aa-cmdpop.below{bottom:auto;top:calc(100% + 4px)}',
      '.tm-aa-atitem{display:flex;align-items:center;gap:7px;width:100%;text-align:left;background:none;border:none;color:var(--tx);cursor:pointer;font-size:12px;padding:5px 8px;border-radius:8px;font-family:inherit}',
      '.tm-aa-atitem:hover{background:rgba(217,119,87,.16)}',
      // S6 · / 命令面板（CC slash commands 对照·与 @提及同一浮层语言）
      '#tm-aa-cmdpop{position:absolute;left:50%;transform:translateX(-50%);width:min(728px,calc(100% - 40px));bottom:calc(100% + 4px);z-index:14;max-height:280px;overflow:auto;background:var(--surface);border:1px solid var(--bd2);border-radius:12px;box-shadow:0 12px 36px rgba(0,0,0,.4);padding:4px}',
      '#tm-aa-cmdpop[hidden]{display:none}',
      '.tm-aa-cmdhd{font-size:10.5px;color:var(--tx3);padding:4px 8px 5px;letter-spacing:.04em}',
      '.tm-aa-cmditem{display:flex;align-items:baseline;gap:8px;width:100%;text-align:left;background:none;border:none;color:var(--tx);cursor:pointer;font-size:12.5px;padding:6px 8px;border-radius:8px;font-family:inherit}',
      '.tm-aa-cmditem b{font-weight:600;white-space:nowrap}',
      '.tm-aa-cmditem .cmd-d{color:var(--tx3);font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.tm-aa-cmditem:hover,.tm-aa-cmditem.on{background:rgba(217,119,87,.16)}',
      '.tm-aa-atkind{flex:0 0 auto;font-size:10px;color:var(--tx3);background:var(--sunken);border-radius:5px;padding:1px 5px}',
      '.tm-aa-diff-jump{cursor:pointer;border-bottom:1px dashed rgba(132,216,165,.5)}',
      '.tm-aa-diff-jump:hover{color:var(--ok)}',
      '#tm-aa-meter{font-size:11px;color:var(--tx3);font-variant-numeric:tabular-nums;padding:0 4px;width:100%;max-width:760px;margin:0 auto;box-sizing:border-box}',
      // 欢迎屏（朱印徽记 + 衬线问候·级联入场·与 composer 一同居中）
      '.tm-aa-empty{order:4;margin:auto 0;background:none;border:none;padding:10px;display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center}',
      '.tm-aa-empty>*{animation:tm-aa-rise .34s ease-out both}',
      '.tm-aa-empty .emp-title{animation-delay:.05s}.tm-aa-empty .emp-sub{animation-delay:.11s}.tm-aa-empty .emp-chips{animation-delay:.17s}',
      '.tm-aa-empty .emp-seal{display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:14px;background:linear-gradient(140deg,#cc785c,#a9583e);color:#fff;font-family:var(--seal);font-weight:400;font-size:34px;box-shadow:0 6px 24px rgba(217,119,87,.35),inset 0 0 0 1.5px rgba(255,255,255,.16);text-shadow:0 1px 2px rgba(0,0,0,.25);margin-bottom:4px}',
      '.tm-aa-empty .emp-title{color:var(--ink);font-size:28px;font-family:var(--serif);font-weight:500;letter-spacing:-0.5px;line-height:1.3}',   // display-sm 负字距
      '.tm-aa-empty .emp-sub{color:var(--tx3);font-size:13px;margin-bottom:10px;line-height:1.6}',
      '.tm-aa-empty .emp-chips{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;max-width:440px}',
      '.tm-aa-empty .emp-chip{background:transparent;color:var(--tx2);border:1px solid var(--bd2);border-radius:999px;padding:6px 15px;font-size:12px;cursor:pointer;font-family:inherit;transition:background .12s,color .12s,border-color .12s,transform .12s}.tm-aa-empty .emp-chip:hover{background:var(--surface);color:var(--tx);border-color:var(--ac);transform:translateY(-1px)}',
      '@keyframes tm-aa-rise{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}',
      '.tm-aa-msg-user,.tm-aa-reply,.tm-aa-think,.tm-aa-msg-ai{animation:tm-aa-rise .22s ease-out}',   // 消息入场微动
      // 会话流（居中栏·Claude 式）
      '.tm-aa-logwrap{position:relative;flex:1 1 0;min-height:0;overflow-y:auto}',
      '.tm-aa-log{padding:4px 2px;font-size:13px;line-height:1.7;max-width:760px;margin:0 auto}',
      '.tm-aa-tobottom{position:absolute;right:9px;bottom:7px;background:var(--surface);color:var(--tx2);border:1px solid var(--bd2);border-radius:999px;padding:3px 11px;font-size:10.5px;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.3);z-index:2}.tm-aa-tobottom:hover{color:var(--tx)}',
      '.tm-aa-tobottom[hidden]{display:none}',
      '.tm-aa-log .ln{color:var(--tx2)}.tm-aa-log .bad{color:var(--bad)}.tm-aa-log .fin{color:var(--ok)}',
      // 工具执行卡（Claude 式折叠 chip·带工具类别图标）
      '.tm-aa-step{margin:2px 0}.tm-aa-step>summary{cursor:pointer;list-style:none;padding:3px 5px;line-height:1.55;outline:none;border-radius:7px;font-size:11.5px;display:flex;align-items:baseline;gap:6px}',
      '.tm-aa-step>summary:hover{background:var(--sunken)}',
      '.tm-aa-step>summary::-webkit-details-marker{display:none}.tm-aa-step>summary::before{content:"▸";color:var(--tx3);flex:0 0 auto}.tm-aa-step[open]>summary::before{content:"▾"}',
      '.tm-aa-step .st-ic{flex:0 0 auto;display:inline-flex;align-self:center;color:var(--tx3)}',
      '.tm-aa-step .st-ic svg{display:block;width:12px;height:12px}',
      '.tm-aa-step .st-tx{flex:1 1 auto;min-width:0}',
      '.tm-aa-step.fin>summary{color:var(--ok)}.tm-aa-step.fin .st-ic{color:var(--ok)}.tm-aa-step.ln>summary{color:var(--tx2)}.tm-aa-step.bad>summary{color:var(--bad)}.tm-aa-step.bad .st-ic{color:var(--bad)}',
      '.tm-aa-step:not([open])>.tm-aa-step-body{display:none}',
      // 工作过程 · 实时活动行（当前在做什么·转环+最新动作/思考）
      '.tm-aa-live{display:flex;align-items:center;gap:8px;margin:8px 0 4px;padding:6px 11px;background:var(--surface);border:1px solid var(--bd);border-radius:11px;font-size:12px;color:var(--tx2);width:fit-content;max-width:100%;box-sizing:border-box}',
      '.tm-aa-live .lv-spin{flex:0 0 auto;width:12px;height:12px;border:2px solid var(--bd2);border-top-color:var(--ac);border-radius:50%;animation:tm-aa-spin .8s linear infinite}',
      '.tm-aa-live .lv-tx{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:560px}',
      '.tm-aa-live .lv-tx.think{font-family:var(--serif);font-style:italic;color:var(--tx3)}',
      '@keyframes tm-aa-spin{to{transform:rotate(360deg)}}',
      // 工作过程 · 顶栏活动条（不确定进度·滑光）
      '#tm-aa-progress{height:2px;background:transparent;position:relative;overflow:hidden;flex:0 0 auto}',
      '.tm-aa-running #tm-aa-progress::after{content:"";position:absolute;left:-30%;top:0;bottom:0;width:30%;background:linear-gradient(90deg,transparent,var(--ac),transparent);animation:tm-aa-slide 1.3s ease-in-out infinite}',
      '@keyframes tm-aa-slide{to{left:100%}}',
      '.tm-aa-think{margin:10px auto 10px 0;background:var(--surface);border:1px solid var(--bd);border-radius:11px;padding:3px 12px;width:fit-content;max-width:100%;box-sizing:border-box}',
      '.tm-aa-think[open]{width:100%}',
      '.tm-aa-think>summary{cursor:pointer;list-style:none;color:var(--tx2);font-size:12px;padding:4px 0;outline:none;white-space:nowrap}',
      '.tm-aa-think>summary::-webkit-details-marker{display:none}.tm-aa-think>summary::before{content:"▸ ";font-style:normal;color:var(--tx3)}.tm-aa-think[open]>summary::before{content:"▾ "}',
      '.tm-aa-running .tm-aa-think:last-of-type>summary .tk-label{background:linear-gradient(90deg,var(--tx3),var(--tx),var(--tx3));background-size:200% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:tm-aa-sheen 2s linear infinite}',
      '@keyframes tm-aa-sheen{0%{background-position:180% 0}100%{background-position:-20% 0}}',
      '.tm-aa-think:not([open])>.tm-aa-think-body{display:none}',
      '.tm-aa-think-body{padding:2px 0 6px 13px;border-left:2px solid var(--bd2);margin:2px 0 2px 4px}',
      '.tm-aa-think-body .tk-line{color:var(--tx3);font-style:italic;font-size:12px;line-height:1.7;margin:3px 0;white-space:pre-wrap;word-break:break-word;font-family:var(--serif)}',   // 思考=衬线斜体（与回复正文同族）
      '.tm-aa-think[open]>.tm-aa-think-body{max-height:42vh;overflow-y:auto}',   // 长跑不撑爆视口·块内滚
      '.tm-aa-step-body{padding:2px 0 5px 12px;border-left:2px solid var(--bd);margin:2px 0 2px 4px}',
      '.tm-aa-step-body .sb-row{margin:2px 0}.tm-aa-step-body .sb-k{display:inline-block;color:var(--tx3);font-size:10px;margin-right:4px}',
      '.tm-aa-step-body pre{margin:1px 0;white-space:pre-wrap;word-break:break-all;font-family:var(--mono);font-size:10px;line-height:1.5;color:var(--tx3);max-height:120px;overflow:auto;background:var(--code);border-radius:6px;padding:4px 6px}',
      '.tm-aa-checklist{background:var(--surface);border:1px solid var(--bd);border-radius:10px;padding:7px 10px;margin-bottom:6px}',
      '.tm-aa-checklist .cl-head{font-size:11px;color:var(--tx2);font-weight:bold;margin-bottom:3px}',
      '.tm-aa-checklist .cl-item{font-size:11.5px;line-height:1.75;color:var(--tx3);display:flex;gap:6px;align-items:baseline}',
      '.tm-aa-checklist .cl-item .cl-ic{width:12px;text-align:center;flex:none}',
      '.tm-aa-checklist .cl-item.done{color:var(--ok)}.tm-aa-checklist .cl-item.done .cl-ic{color:var(--ok)}',
      '.tm-aa-checklist .cl-item.run{color:var(--warn)}.tm-aa-checklist .cl-item.run .cl-ic{color:var(--warn);display:inline-block;animation:tm-aa-spin 1.1s linear infinite}',   // 进行中 ⟳ 真转
      '.tm-aa-checklist .cl-item.pend{color:var(--tx3)}',
      // 用户消息（软卡片·右对齐）与助手正文（Claude 式：无气泡·直接书于底色上）
      '.tm-aa-msg-user{position:relative;margin:16px 0 12px auto;max-width:82%;width:fit-content;padding:9px 15px;background:var(--bubble);border:none;border-radius:18px 18px 6px 18px;font-size:13.5px;line-height:1.7;color:var(--tx);box-shadow:0 1px 5px rgba(0,0,0,.1)}',
      '.tm-aa-msg-user .mu-who{display:none}',
      '.tm-aa-msg-acts{position:absolute;top:-13px;right:6px;display:none;gap:1px;background:var(--surface);border:1px solid var(--bd2);border-radius:8px;padding:1px 2px;box-shadow:0 4px 12px rgba(0,0,0,.3)}',
      '.tm-aa-msg-user:hover .tm-aa-msg-acts{display:inline-flex}',
      '.tm-aa-msg-ai{position:relative;margin:14px auto 12px 0;max-width:96%;width:fit-content;padding:2px 2px 2px 0;background:none;border:none;font-size:15px;line-height:1.85;color:var(--tx);font-family:var(--serif)}',   // 回复正文=衬线（Tiempos 语义·Claude 签名）
      '.tm-aa-msg-ai .ai-who{color:var(--ac);font-weight:600;font-size:11.5px;display:block;margin-bottom:4px;font-family:var(--serif);letter-spacing:0}',
      '.tm-aa-msg-ai .ai-sev{display:inline-block;background:rgba(229,192,123,.16);color:var(--warn);border-radius:5px;padding:0 6px;font-size:10.5px;margin-right:5px}',
      '.tm-aa-msg-ai .ai-sug{color:var(--ok);margin-top:4px}',
      '.tm-aa-msg-ai .ai-qs{margin-top:3px}.tm-aa-msg-ai .ai-q{line-height:1.8}',
      '.tm-aa-msg-ai .ai-hint{color:var(--tx3);font-size:11px;margin-top:6px;border-top:1px solid var(--bd);padding-top:5px}',
      '.tm-aa-reply{margin:14px 0 12px;padding:0 2px;background:none;border:none;border-radius:0}',
      '.tm-aa-reply .reply-who{display:flex;align-items:center;gap:7px;margin-bottom:7px}',
      '.tm-aa-reply .reply-who .reply-ava{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:6px;background:linear-gradient(140deg,#cc785c,#a9583e);color:#fff;font-family:var(--seal);font-weight:400;font-size:14px;line-height:1;box-shadow:0 1px 4px rgba(217,119,87,.35),inset 0 0 0 1px rgba(255,255,255,.14);text-shadow:0 1px 1px rgba(0,0,0,.2)}',
      '.tm-aa-reply .reply-who b{color:var(--ac);font-size:12px;font-weight:600;font-family:var(--serif);letter-spacing:0}',
      '.tm-aa-reply .reply-copy{background:none;border:none;color:var(--tx3);cursor:pointer;font-size:12px;padding:2px 7px;border-radius:6px;opacity:0;transition:opacity .12s,color .12s,background .12s;line-height:1.4}',
      '.tm-aa-reply:hover .reply-copy{opacity:1}.tm-aa-reply .reply-copy:hover{color:var(--tx);background:var(--sunken)}',
      '.tm-aa-reply .tm-aa-summary{background:none;padding:0;border-radius:0}',
      '.tm-aa-reply .tm-aa-summary::before{display:none}',
      '.tm-aa-reply.frozen{opacity:.62}',
      '.tm-aa-reply .reply-actions{display:flex;gap:7px;margin-top:10px}',
      '.tm-aa-reply .reply-actions button{flex:1;font-size:12px;padding:7px 8px;border-radius:9px;cursor:pointer;border:1px solid var(--bd2);background:transparent;color:var(--tx2);font-family:-apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;transition:background .12s,color .12s,border-color .12s}',
      '.tm-aa-reply .reply-actions button:hover{background:var(--surface);color:var(--tx)}',
      '.tm-aa-reply .reply-actions button:first-child{flex:2;background:var(--ac);border-color:var(--ac);color:#fff}',
      '.tm-aa-reply .reply-actions button:first-child:hover{background:var(--ac-hi)}',
      '.tm-aa-reply .reply-actions button:first-child.warn{background:transparent;border-color:var(--warn);color:var(--warn)}',
      '.tm-aa-reply.applied .reply-actions button:first-child{background:transparent;border-color:var(--ok);color:var(--ok)}',
      '.tm-aa-reply .reply-tag{font-size:10.5px;margin-top:6px;display:none}.tm-aa-reply.applied .reply-tag{display:block;color:var(--ok)}.tm-aa-reply.discarded .reply-tag{display:block;color:var(--tx3)}',
      '.mu-act{background:none;border:none;color:var(--tx2);cursor:pointer;font-size:11px;padding:2px 6px;border-radius:6px;line-height:1.5}.mu-act:hover{background:var(--sunken);color:var(--tx)}',
      '.tm-aa-sec{font-size:11px;color:var(--tx3);letter-spacing:.06em;margin-top:2px;width:100%;max-width:760px;margin-left:auto;margin-right:auto;box-sizing:border-box;padding:0 2px}',
      '.tm-aa-sec[data-sec="log"]{display:none}',   // Claude 式：会话流不设小节标（执行块自带「执行过程 · N 步」标签）
      // 改动预览 / 校验 / 动作条（居中栏）
      '.tm-aa-diff{background:var(--surface);border:1px solid var(--bd);border-radius:12px;padding:8px 10px;max-height:190px;overflow:auto;font-size:11.5px;line-height:1.6;width:100%;max-width:760px;margin:0 auto;box-sizing:border-box}',
      '.tm-aa-diff .add{color:var(--ok)}.tm-aa-diff .rm{color:var(--bad)}.tm-aa-diff .ch{color:var(--warn)}',
      '.tm-aa-diff .uncertain{background:rgba(229,192,123,.08);border-left:2px solid var(--warn);padding-left:5px;margin-left:-7px}',
      '.tm-aa-diff .tm-aa-unc{display:block;color:var(--warn);font-size:10px;margin-top:1px}',
      '.tm-aa-summary{background:none;border:none;border-radius:0;padding:1px 2px;font-size:15px;line-height:1.85;color:var(--tx);width:100%;max-width:760px;margin:0 auto;box-sizing:border-box;font-family:var(--serif)}',   // 回复正文=衬线（Tiempos 语义）
      '.tm-aa-summary::before{content:"国师";display:block;font-size:11px;color:var(--ac);font-weight:600;margin-bottom:5px;font-family:var(--serif);letter-spacing:0}',
      '.tm-aa-summary b{color:var(--tx3);font-size:11px;display:block;margin-bottom:4px;font-weight:600;letter-spacing:.5px;font-family:-apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif}',   // caption 小标回归 sans（正文衬线的对照层）
      '.tm-aa-summary .note{color:var(--tx3);font-size:12px;margin-top:5px}',
      '.tm-aa-summary.tm-aa-clamped{max-height:var(--clamp-max,280px);overflow:hidden;position:relative;flex:0 0 auto}',
      '.tm-aa-summary.tm-aa-clamped::after{content:"";position:absolute;left:0;right:0;bottom:0;height:44px;background:linear-gradient(transparent,var(--bg));pointer-events:none}',
      '.tm-aa-summary.tm-aa-clamp-open{max-height:none;overflow:visible}.tm-aa-summary.tm-aa-clamp-open::after{display:none}',
      '.tm-aa-clamp-btn{align-self:center;background:none;border:none;color:var(--ac);font-size:11.5px;cursor:pointer;padding:2px 0;margin-top:-4px;font-family:inherit}.tm-aa-clamp-btn:hover{text-decoration:underline}',
      '.tm-aa-errcard{background:rgba(192,65,59,.08);border:1px solid rgba(192,65,59,.35);border-left:3px solid var(--danger);border-radius:10px;padding:9px 12px;width:100%;max-width:760px;margin:0 auto;box-sizing:border-box}',
      '.tm-aa-errcard .ec-head{color:var(--bad);font-weight:bold;font-size:11.5px;margin-bottom:3px}',
      '.tm-aa-errcard .ec-msg{color:var(--tx2);font-size:11.5px;line-height:1.6;white-space:pre-wrap;word-break:break-word}',
      '.tm-aa-errcard .ec-acts{display:flex;gap:7px;margin-top:8px}',
      '.tm-aa-errcard .ec-retry{background:var(--danger);color:#fff;border:none;border-radius:999px;padding:4px 14px;font-size:11.5px;cursor:pointer}.tm-aa-errcard .ec-retry:hover{background:#d2554f}',
      '.tm-aa-errcard .ec-copy{background:transparent;color:var(--tx2);border:1px solid var(--bd2);border-radius:999px;padding:4px 12px;font-size:11.5px;cursor:pointer}.tm-aa-errcard .ec-copy:hover{color:var(--tx)}',
      // markdown 渲染
      '.md-p{margin:3px 0;line-height:1.75}.md-h{font-weight:600;color:var(--tx);margin:7px 0 3px;font-family:var(--serif);letter-spacing:.03em}.md-h1{font-size:15px}.md-h2{font-size:14px}.md-h3,.md-h4{font-size:13px}',
      '.md-list{margin:3px 0;padding-left:19px}.md-list li{margin:2px 0;line-height:1.7}',
      '.md-ic{background:rgba(229,192,123,.13);color:var(--warn);padding:0 5px;border-radius:4px;font-family:var(--mono);font-size:11px}',
      '.md-code{background:var(--code);border:1px solid var(--bd);border-radius:0 0 8px 8px;border-top:none;padding:7px 9px;margin:0;overflow:auto;font-family:var(--mono);font-size:11px;line-height:1.55;white-space:pre-wrap;color:var(--tx2)}',
      '.md-codewrap{margin:5px 0;position:relative}',
      '.md-codebar{display:flex;align-items:center;justify-content:space-between;background:var(--sunken);border:1px solid var(--bd);border-radius:8px 8px 0 0;padding:2px 6px 2px 9px}',
      '.md-codebar .md-lang{color:var(--tx3);font-size:10px;font-family:var(--mono);text-transform:lowercase}',
      '.md-codebar .md-copy{background:none;border:none;color:var(--tx3);cursor:pointer;font-size:10px;padding:1px 6px;border-radius:5px;opacity:0;transition:opacity .12s}',
      '.md-codewrap:hover .md-copy{opacity:1}.md-codebar .md-copy:hover{background:var(--surface);color:var(--tx)}',
      '.md-code .tok-str{color:#9ad6a0}.md-code .tok-key{color:#7fb4e8}.md-code .tok-num{color:#e0b863}.md-code .tok-kw{color:#c98ad6}.md-code .tok-punct{color:var(--tx3)}',
      '.md-p strong{color:var(--tx);font-weight:600}.md-p em{color:var(--tx2)}',
      '.md-table{border-collapse:collapse;margin:6px 0;font-size:11.5px;max-width:100%;display:block;overflow:auto}',
      '.md-table th,.md-table td{border:1px solid var(--bd);padding:4px 8px;text-align:left;line-height:1.55}',
      '.md-table th{background:var(--sunken);color:var(--tx);font-weight:600;white-space:nowrap}',
      '.md-table td{color:var(--tx2)}.md-table tbody tr:nth-child(even) td{background:rgba(128,128,128,.04)}',
      '.tm-aa-stream{display:block}',
      '.je-entity-ref{color:var(--ac);text-decoration:underline dotted;text-underline-offset:2px;cursor:pointer}.je-entity-ref:hover{color:var(--ac-hi);text-decoration-style:solid;background:rgba(217,119,87,.1);border-radius:3px}',
      '.tm-aa-caret{display:inline-block;color:var(--ac);font-weight:400;margin-left:1px;animation:tm-aa-blink 1.05s step-end infinite}',
      '@keyframes tm-aa-blink{50%{opacity:0}}',
      '.tm-aa-summary .tm-aa-cl-copy{margin-left:8px;background:var(--sunken);color:var(--tx);border:none;border-radius:6px;padding:1px 9px;font-size:10px;cursor:pointer}',
      '.tm-aa-summary .tm-aa-conv-clear{display:inline-block;margin-top:6px;background:var(--sunken);color:var(--tx2);border:1px solid var(--bd2);border-radius:6px;padding:2px 10px;font-size:10.5px;cursor:pointer;font-family:inherit}',
      '.tm-aa-summary .tm-aa-conv-clear:hover{color:var(--bad);border-color:var(--bad)}',
      '.tm-aa-summary pre.tm-aa-cl{white-space:pre-wrap;margin:5px 0 0;font-family:inherit;font-size:11.5px;line-height:1.65;color:var(--tx2);max-height:200px;overflow:auto}',
      '.tm-aa-sug{margin-top:7px;padding-top:6px;border-top:1px solid var(--bd)}.tm-aa-sug b{color:var(--warn)}',
      '.tm-aa-sug .sug-row{display:flex;align-items:center;gap:6px;margin-top:4px;font-size:11.5px;color:var(--tx2)}.tm-aa-sug .sug-row span{flex:1}',
      '.tm-aa-sug .sug-keep{font-family:-apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;background:transparent;color:var(--tx2);border:1px solid var(--bd2);border-radius:999px;padding:2px 10px;font-size:11px;cursor:pointer}.tm-aa-sug .sug-keep:hover{color:var(--tx)}.tm-aa-sug .sug-keep:disabled{opacity:.6;cursor:default}',
      '.tm-aa-finding{margin-bottom:7px;padding:6px 9px;background:var(--surface);border:1px solid var(--bd);border-left:3px solid var(--bd2);border-radius:8px}',
      '.tm-aa-finding .sev{font-weight:bold;font-size:11px}.tm-aa-finding .sev.rm{color:var(--bad)}.tm-aa-finding .sev.ch{color:var(--warn)}.tm-aa-finding .sev.add{color:var(--ok)}',
      '.tm-aa-finding b{color:var(--tx);font-size:12px}.tm-aa-finding .loc{color:var(--tx3);font-size:10px}',
      '.tm-aa-finding .iss{color:var(--tx2);font-size:11.5px;margin-top:2px;line-height:1.55}.tm-aa-finding .sug{color:var(--tx3);font-size:11.5px;margin-top:2px;line-height:1.55}',
      '.tm-aa-diff-group{margin-bottom:7px;border-bottom:1px solid var(--bd);padding-bottom:4px}.tm-aa-diff-head{display:flex;align-items:center;gap:6px;color:var(--tx);padding:2px 0;font-size:12px}',
      '.tm-aa-diff-head .grp-tog{margin-left:auto;background:transparent;color:var(--tx2);border:1px solid var(--bd2);border-radius:999px;padding:1px 9px;font-size:10px;cursor:pointer}.tm-aa-diff-head .grp-tog:hover{color:var(--tx)}',
      '.tm-aa-hunk{display:flex;align-items:flex-start;gap:6px;margin:3px 0}',
      '.tm-aa-hunk .hunk-tog{flex:0 0 auto;width:18px;height:18px;line-height:16px;text-align:center;border-radius:6px;border:1px solid rgba(132,216,165,.4);background:rgba(132,216,165,.12);color:var(--ok);cursor:pointer;font-size:11px;padding:0}',
      '.tm-aa-hunk .hunk-body{flex:1;min-width:0}',
      '.tm-aa-hunk.rejected .hunk-tog{border-color:rgba(239,143,143,.4);background:rgba(239,143,143,.12);color:var(--bad)}',
      '.tm-aa-hunk.rejected .hunk-body{opacity:.42;text-decoration:line-through}',
      '.tm-aa-val{width:100%;max-width:760px;margin:0 auto;box-sizing:border-box;font-size:12px}',
      '.tm-aa-val.ok{color:var(--ok)}.tm-aa-val.bad{color:var(--bad)}',
      '#tm-aa-actions{display:flex;gap:8px;width:100%;max-width:760px;margin:0 auto;box-sizing:border-box}',
      '#tm-aa-apply{flex:1;background:var(--ac);color:#fff;border:none;border-radius:10px;padding:9px;cursor:pointer;font-family:inherit;font-size:13px;font-weight:500;transition:background .12s}',   // 主按钮=圆角方（claude.ai 按钮 8-10px 形制·非药丸）
      '#tm-aa-apply:hover{background:var(--ac-hi)}',
      '#tm-aa-apply.warn{background:transparent;border:1px solid var(--warn);color:var(--warn)}',
      '#tm-aa-discard{flex:1;background:transparent;color:var(--tx2);border:1px solid var(--bd2);border-radius:10px;padding:9px;cursor:pointer;font-family:inherit;font-size:13px}',
      '#tm-aa-discard:hover{color:var(--tx);background:var(--surface)}',
      // composer 模型徽（claude.ai 形制：模型选择器在输入卡内右下）——点开 API 连接·模型弹层
      '#tm-aa-model{flex:0 0 auto;max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10.5px;color:var(--tx3);background:transparent;border:1px solid var(--bd);border-radius:7px;padding:3px 9px;line-height:1.4;cursor:pointer;font-family:inherit;transition:color .12s,border-color .12s,background .12s}',
      '#tm-aa-model::after{content:" ▾";font-size:8px;color:var(--tx3)}',
      '#tm-aa-model:hover{color:var(--tx);border-color:var(--bd2);background:var(--sunken)}',
      '#tm-aa-model.warn{color:var(--ac);border-color:rgba(204,120,92,.5)}',
      // API 连接·模型弹层（右对齐·与＋菜单同族）
      '#tm-aa-modelpop{position:absolute;right:8px;bottom:calc(100% + 6px);z-index:12;width:320px;max-width:calc(100vw - 40px);background:var(--surface);border:1px solid var(--bd2);border-radius:12px;box-shadow:0 14px 44px rgba(0,0,0,.35);padding:11px 13px}',
      '#tm-aa-modelpop[hidden]{display:none}',
      '#tm-aa-modelpop .mp-h{font-size:12px;color:var(--tx);font-weight:600;margin-bottom:6px;letter-spacing:.04em}',
      '#tm-aa-modelpop .mp-lab{display:block;font-size:11px;color:var(--tx3);margin:8px 0 0}',
      '#tm-aa-modelpop input,#tm-aa-modelpop select{display:block;width:100%;box-sizing:border-box;margin-top:4px;background:var(--sunken);color:var(--tx);border:1px solid var(--bd2);border-radius:8px;padding:7px 9px;font-size:12px;font-family:inherit;outline:none;transition:border-color .12s}',
      '#tm-aa-modelpop input:focus,#tm-aa-modelpop select:focus{border-color:var(--ac)}',
      '#tm-aa-modelpop .mp-row{display:flex;align-items:center;gap:8px;margin-top:10px}',
      '#tm-aa-modelpop .mp-row.mp-end{justify-content:flex-end;margin-top:12px}',
      '#tm-aa-api-detect{background:transparent;color:var(--tx2);border:1px solid var(--bd2);border-radius:8px;padding:6px 13px;font-size:12px;cursor:pointer;font-family:inherit;transition:color .12s,border-color .12s}',
      '#tm-aa-api-detect:hover{color:var(--tx);border-color:var(--ac)}',
      '#tm-aa-api-save{background:var(--ac);color:#fff;border:none;border-radius:8px;padding:7px 18px;font-size:12px;font-weight:500;cursor:pointer;font-family:inherit;transition:background .12s}',
      '#tm-aa-api-save:hover{background:var(--ac-hi)}',
      '#tm-aa-modelpop .mp-st{font-size:11px;color:var(--tx3);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '#tm-aa-modelpop .mp-hint{font-size:10.5px;color:var(--tx3);line-height:1.65;margin-top:10px;border-top:1px solid var(--bd);padding-top:8px}',
      // 侧栏搜索与日期分组
      '#tm-aa-railq{width:100%;box-sizing:border-box;background:var(--bg);color:var(--tx);border:1px solid var(--bd);border-radius:9px;padding:6px 10px;font-size:12px;font-family:inherit;outline:none;margin-top:2px}',
      '#tm-aa-railq:focus{border-color:var(--ac)}',
      '#tm-aa-railq::placeholder{color:var(--tx3)}'
    ].join('');
    var st = document.createElement('style');
    st.id = 'tm-aa-style';
    st.textContent = css;
    document.head.appendChild(st);
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
    panel.querySelector('#tm-aa-x').addEventListener('click', function() { if (panel._fs) _toggleFullscreen(); panel.classList.remove('open'); });
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
    var body = _sessBody(id), fk = _fileKey();
    function bind(viewOnly) {
      ui._pendingPlan = false; ui._pendingClarify = false; ui.draft = null; ui._autoCont = 0;
      if (ui._criticsArmed) _disarmCriticsVisual();
      if (body && !viewOnly) {
        ui.conversation = body.conversation;
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
    return _saveScenConv(lines.join('\n'));
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
    if (ui.running) { setStatus('运行中 · 等本轮结束再压缩'); return; }
    if (!ui.conversation || ui.conversation.length < 6) { setStatus('当前会话不长 · 无需压缩'); return; }
    var draft = ui.draft || (AA.makeDraft && ui.adapter && ui.adapter.getScenario ? AA.makeDraft(ui.adapter.getScenario()) : null);
    if (!draft || typeof AA.compactConversation !== 'function') { setStatus('压缩不可用'); return; }
    var beforeN = ui.conversation.length;
    setStatus('正在压缩前情…（一次小结调用 · 优先走次要模型）');
    AA.compactConversation(ui.conversation, draft, {}).then(function (r) {
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
      if (cb) cb.addEventListener('click', function () { _saveScenConv(''); cb.textContent = '已清空 ✓'; cb.disabled = true; setStatus('本剧本约定已清空'); });
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
      b.addEventListener('click', function () { try { AA.memories.remove(b.getAttribute('data-mem-del')); } catch (e) {} b.closest('div').style.opacity = '.35'; b.textContent = '已删 ✓'; b.disabled = true; });
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
      b.addEventListener('click', function () { try { AA.skills.remove(b.getAttribute('data-skill-del')); } catch (e) {} b.closest('div').style.opacity = '.35'; b.textContent = '已删 ✓'; b.disabled = true; });
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
        try { AA.packs.setEnabled(n, now); } catch (e) {}
        b.textContent = now ? '停用' : '启用'; setStatus('「' + n + '」已' + (now ? '启用' : '停用') + '（下轮生效）');
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
      b.addEventListener('click', function () { try { AA.packs.remove(b.getAttribute('data-pack-rm')); } catch (e) {} b.closest('div').style.opacity = '.35'; b.textContent = '已卸 ✓'; b.disabled = true; });
    });
    var ib = host.querySelector('[data-pack-imp]');
    if (ib) ib.addEventListener('click', function () {
      var j = window.prompt('粘贴能力包 JSON：', '');
      if (!j) return;
      var r = null; try { r = AA.packs.importJSON(j); } catch (e) { r = { ok: false, error: String(e && e.message || e) }; }
      setStatus(r && r.ok ? '已导入「' + r.imported + '」（' + r.skills + ' 技能·下轮生效）' : '导入失败：' + ((r && r.error) || '未知'));
      if (r && r.ok) showPacksUI();
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

  // 改动说明：把 agent 的 finish summary（做了什么+为什么）+ 计划备注醒目展示在 diff 之上；
  // 方向B · 若 agent 发现可长期沿用的约定，列出 + 给「记住」按钮（追加进持久 conventions）。
  function renderSummary(summary, notes, suggestions, stream) {
    if (!ui.els || !ui.els.summary) return;
    var s = (summary || '').trim();
    var sug = (suggestions || []).filter(Boolean);
    if (!s && (!notes || !notes.length) && !sug.length) { ui.els.summary.style.display = 'none'; return; }
    var html = '';
    if (s || (notes && notes.length)) {
      html += '<b>本次改动说明</b>' + (s ? _md(s) : '（agent 未给出说明）');
      if (notes && notes.length) {
        html += '<div class="note">思路：' + notes.slice(0, 4).map(function(n) { return esc(String(n).slice(0, 120)); }).join('；') + '</div>';
      }
    }
    if (sug.length) {
      html += '<div class="tm-aa-sug"><b>建议记住的约定</b>' + sug.slice(0, 5).map(function(c, i) {
        return '<div class="sug-row"><span>' + esc(String(c).slice(0, 120)) + '</span><button type="button" class="sug-keep" data-i="' + i + '">记住</button></div>';
      }).join('') + '</div>';
    }
    ui.els.summary.innerHTML = html;
    ui.els.summary.style.display = '';
    Array.prototype.forEach.call(ui.els.summary.querySelectorAll('.sug-keep'), function(btn) {
      btn.addEventListener('click', function() {
        var idx = +btn.getAttribute('data-i'), conv = sug[idx];
        if (conv && rememberConvention(conv)) {   // S9 · 记到本剧本层(CC 默认记进项目 CLAUDE.md 同款)
          btn.textContent = '已记住 ✓（本剧本）'; btn.disabled = true;
        }
      });
    });
    _streamThenLink(ui.els.summary, stream);   // UI·P 流式吐字 + UI·AH 实体 linkify
  }

  // UI·Z · 思考过程折叠块（Claude.ai「Thought for Ns」招牌）：把本轮 agent 的多段推理（onText·原来平铺 💭 行）
  //   收拢进一个默认收起的 <details>，标题显「💭 推理 N 步」并实时计数；点开看完整推理叙事。每轮(run)一个块。
  // UI·Z2 · 统一「执行过程」折叠块：本轮的推理 + 工具调用全收进同一个默认收起的 <details>
  //   （对齐 Claude 网页端折叠思考/工具调用）。点开看完整推理叙事 + 逐个工具卡。每轮(run)一个块。
  function _ensureExecBlock() {
    var blk = ui._thinkEl;
    if (!blk || !blk.isConnected) {
      if (ui.els) { ui.els.logSec.style.display = ''; ui.els.logWrap.style.display = ''; }
      blk = document.createElement('details');
      blk.className = 'tm-aa-think';
      blk.open = !!ui.running;   // 工作过程 · 运行中默认展开（实时看步骤流入）·收尾自动折叠
      blk.innerHTML = '<summary class="tm-aa-think-sum"><span class="tk-label">执行中…</span></summary><div class="tm-aa-think-body"></div>';
      if (ui.els) ui.els.log.appendChild(blk);
      ui._thinkEl = blk; ui._thinkCount = 0;
    }
    return blk;
  }
  // 工作过程 · 实时活动行：转环 + 当前动作/思考（贴在执行块下方·收尾移除）
  function _ensureLive() {
    if (!ui.running) return null;
    var lv = ui._liveEl;
    if (!lv || !lv.isConnected) {
      lv = document.createElement('div');
      lv.className = 'tm-aa-live';
      lv.innerHTML = '<span class="lv-spin"></span><span class="lv-tx">国师正在斟酌…</span>';
      if (ui.els) ui.els.log.appendChild(lv);
      ui._liveEl = lv;
    } else if (ui.els && ui.els.log.lastElementChild !== lv) {
      ui.els.log.appendChild(lv);   // 保持在流式尾部（执行块内新增步骤不影响·回应卡插入后仍殿后）
    }
    return lv;
  }
  function _setLive(text, isThink) {
    var lv = _ensureLive(); if (!lv) return;
    var tx = lv.querySelector('.lv-tx');
    if (tx) { tx.textContent = String(text || '').slice(0, 90); tx.classList.toggle('think', !!isThink); }
    _logScrollMaybe();
  }
  function _removeLive() {
    if (ui._liveEl) { try { ui._liveEl.remove(); } catch (e) {} ui._liveEl = null; }
  }
  function _bumpExecLabel(blk) {
    ui._thinkCount = (ui._thinkCount || 0) + 1;
    var lbl = blk.querySelector('.tk-label'); if (lbl) lbl.textContent = '执行过程 · ' + ui._thinkCount + ' 步';
  }
  function appendText(text, iter) {
    if (!ui.els || !text) return;
    var blk = _ensureExecBlock();
    var line = document.createElement('div');
    line.className = 'tk-line';
    line.textContent = String(text).slice(0, 400);
    blk.querySelector('.tm-aa-think-body').appendChild(line);
    _bumpExecLabel(blk);
    _setLive(String(text).slice(0, 90), true);   // 工作过程 · 最新思考进活动行（衬线斜体）
    _logScrollMaybe();
  }

  // 维度2 · 把工具调用 / diff 渲染成玩家看得懂的中文（rendering only · 两编辑器同享）。
  var _COLL_CN = { characters: '人物', factions: '势力', parties: '党派', classes: '阶层', items: '物品', events: '事件', families: '家族', cities: '城市', traitDefinitions: '特质', adminHierarchy: '行政区划', military: '军务', variables: '变量', relations: '关系', openingLetters: '开场信', government: '官制', goals: '目标' };
  function _shortVal(v) {
    if (v == null) return '空';
    if (typeof v === 'object') return String(v.name || v.id || v.title || (Array.isArray(v) ? (v.length + ' 项') : JSON.stringify(v))).slice(0, 40);
    return String(v).slice(0, 40);
  }
  function _friendlyPath(p) {
    var s = String(p || '');
    var top = s.split(/[.\[]/)[0];
    var rest = s.slice(top.length).replace(/^\./, '').replace(/\[(\d+)\]/g, '#$1').replace(/\./g, ' › ');
    return (_COLL_CN[top] || top) + (rest ? ' › ' + rest : '');
  }
  function _friendlyStep(step) {
    var n = step.name, i = step.input || {}, r = step.result || {};
    switch (n) {
      case 'applyEdit': return '改 ' + _friendlyPath(i.path) + ' ＝ ' + _shortVal(i.value);
      case 'getFields': return '查看 ' + ((i.paths || []).slice(0, 3).map(_friendlyPath).join('、') || '(多路径)') + ((i.paths || []).length > 3 ? ' 等 ' + i.paths.length + ' 处' : '');
      case 'applyPush': return '新增一项到 ' + (_COLL_CN[i.path] || _friendlyPath(i.path)) + '：' + _shortVal(i.value);
      case 'removeEntity': return '删除 ' + _friendlyPath(i.path);
      case 'getField': return '查看 ' + _friendlyPath(i.path);
      case 'searchEntities': return '搜索 ' + (_COLL_CN[i.collection] || i.collection || '') + (i.query ? '「' + i.query + '」' : '');
      case 'globalSearch': return '全局检索「' + (i.query || '') + '」' + (r.total != null ? '（命中 ' + r.total + '）' : '');
      case 'findReferences': return '查引用「' + (i.name || '') + '」' + (r.exactCount != null ? '（精确 ' + r.exactCount + '·提及 ' + (r.mentionCount || 0) + '）' : '');
      case 'renameEntity': return '✎ 改名「' + (i.oldName || '') + '」→「' + (i.newName || '') + '」' + (r.changed != null ? '（联动 ' + r.changed + ' 处）' : '');
      case 'listCollection': return '浏览 ' + (_COLL_CN[i.collection] || i.collection || '') + (r.count != null ? '（共 ' + r.count + '）' : '');
      case 'describeSchema': return '查字段形状 ' + (i.kind || '(全部)');
      case 'listGaps': return '查规格缺口' + (r.requiredMissing ? '（必需缺 ' + r.requiredMissing.length + '）' : '');
      case 'validateDraft': return '校验' + (r.ok === false ? '：发现 ' + ((r.violations || []).length) + ' 处问题' : '：通过');
      case 'preflight': return '运行时体检' + (r.bootable === false ? '：' + ((r.blockers || []).length) + ' 处阻塞' : (r.bootable === true ? '：可运行' : ''));
      case 'bulkAdd': return '批量新增 ' + (r.added != null ? r.added : '') + ' 项到 ' + (_COLL_CN[i.collection] || i.collection || '');
      case 'multiEdit': return '一次改 ' + (r.applied != null ? r.applied : (i.edits || []).length) + ' 处';
      case 'note': return '备注：' + _shortVal(i.text);
      case 'flagUncertain': return '标记待核 ' + _friendlyPath(i.path) + (i.reason ? '（' + _shortVal(i.reason) + '）' : '');
      case 'recordConvention': return '记下约定：' + _shortVal(i.convention);
      case 'generateImage': return '生图 → ' + _friendlyPath(i.path) + (r.model ? '（' + r.model + '）' : '') + (r.image ? ' · ' + r.image : '');
      case 'finish': return '完成：' + (i.summary || '');
      default: return n + '(' + JSON.stringify(i).slice(0, 60) + ')';
    }
  }

  function appendLog(step) {
    if (!ui.els) return;
    if (step && step.tokensUsed != null) ui._lastTokens = step.tokensUsed;   // 方向I · 实时计量
    if (step && step.budget) ui._budget = step.budget;   // S10 · 预算上限(上下文余量表)
    if (step && step.iteration != null) ui._lastIter = step.iteration;
    var execBlk = _ensureExecBlock();   // UI·Z2 · 工具卡收进同一个「执行过程」折叠块
    var r = step.result || {};
    var cls = (step.name === 'finish' && r.ok) ? 'fin' : (r.ok ? 'ln' : 'bad');
    var detail = r.ok ? '' : (' — ' + esc(r.reason || ''));
    if (r.violations && r.violations.length) detail += ' [' + esc(r.violations.slice(0, 3).join('; ')) + ']';
    // UI·C · 工具调用折叠卡片：收起=友好摘要，点开=完整 input/output（像 Claude Code 的工具卡）
    var inputStr = ''; try { inputStr = JSON.stringify(step.input); } catch (e) { inputStr = String(step.input == null ? '' : step.input); }
    var resultStr = ''; try { resultStr = JSON.stringify(step.result); } catch (e) { resultStr = String(step.result == null ? '' : step.result); }
    var card = document.createElement('details');
    card.className = 'tm-aa-step ' + cls;
    card.innerHTML = '<summary><span class="st-ic">' + _icon(_TOOL_ICON[step.name] || 'route') + '</span><span class="st-tx">#' + step.iteration + ' ' + esc(_friendlyStep(step)) + detail + '</span></summary>'
      + '<div class="tm-aa-step-body">'
      + (inputStr && inputStr !== '{}' ? '<div class="sb-row"><span class="sb-k">输入</span><pre>' + esc(inputStr.slice(0, 600)) + (inputStr.length > 600 ? '…' : '') + '</pre></div>' : '')
      + (resultStr && resultStr !== '{}' ? '<div class="sb-row"><span class="sb-k">结果</span><pre>' + esc(resultStr.slice(0, 600)) + (resultStr.length > 600 ? '…' : '') + '</pre></div>' : '')
      + '</div>';
    var body = execBlk.querySelector('.tm-aa-think-body'); if (body) body.appendChild(card); else ui.els.log.appendChild(card);
    _bumpExecLabel(execBlk);
    _setLive('刚完成：' + _friendlyStep(step) + ' · 继续推演中…');   // 工作过程 · 最新动作进活动行
    _logScrollMaybe();
  }

  // UI·X · 每条改动渲染成可【接受/拒绝】的 hunk（idx=在 diffs 数组里的稳定下标·拒绝集 ui._diffRejected）
  function _diffEntryHtml(d, uncReason, idx) {
    var p = _friendlyPath(d.path);
    var pj = '<span class="tm-aa-diff-jump" data-reveal-path="' + esc(d.path || '') + '" title="在折子里精确定位此处">' + esc(p) + '</span>';
    var warn = uncReason ? '<span class="tm-aa-unc">待核：' + esc(uncReason) + '</span>' : '';
    var cls = uncReason ? ' uncertain' : '';
    var body;
    if (d.type === 'added') body = '<span class="hunk-body add' + cls + '">＋ 新增 ' + pj + '：' + esc(_shortVal(d.after)) + warn + '</span>';
    else if (d.type === 'removed') body = '<span class="hunk-body rm' + cls + '">－ 删除 ' + pj + warn + '</span>';
    else body = '<span class="hunk-body ch' + cls + '">✎ 改 ' + pj + '：' + esc(_shortVal(d.before)) + ' → ' + esc(_shortVal(d.after)) + warn + '</span>';
    var rejected = ui._diffRejected && ui._diffRejected.has(idx);
    return '<div class="tm-aa-hunk' + (rejected ? ' rejected' : '') + '" data-diff-idx="' + idx + '">'
      + '<button type="button" class="hunk-tog" data-diff-idx="' + idx + '" title="' + (rejected ? '已拒绝·点击接受' : '已接受·点击拒绝') + '">' + (rejected ? '✗' : '✓') + '</button>'
      + body + '</div>';
  }
  // 置信度标注：某 diff 路径是否被 agent 标为没把握（前缀双向匹配），返回理由或 ''
  function _uncReasonFor(path, uncList) {
    var dp = String(path || '');
    for (var i = 0; i < (uncList || []).length; i++) {
      var up = String(uncList[i].path || ''); if (!up) continue;
      if (dp === up || dp.indexOf(up) === 0 || up.indexOf(dp) === 0) return uncList[i].reason || '（未注明原因）';
    }
    return '';
  }
  // UI·X · 逐条接受/拒绝（Cursor/Claude Code edit-review）：每条改动一个 ✓/✗ 开关，应用时只落接受的；
  //   组级「全拒/全收」批量切；置信度低的条目 ⚠ 高亮。renderDiff 存 diffs+unc 并重置拒绝集，_paintDiff 负责画。
  function renderDiff(diffs, uncertainties) {
    if (!ui.els) return;
    ui.els.diffSec.style.display = ''; ui.els.diff.style.display = '';
    ui._lastDiffs = diffs || [];
    ui._lastUnc = uncertainties || [];
    if (!ui._diffRejected) ui._diffRejected = new Set();
    ui._diffRejected.clear();   // 新一批 diff 默认全接受
    (ui._lastDiffs).forEach(function(d, i) { d.__idx = i; });   // 稳定下标
    _paintDiff();
    ui.els.diff.onclick = function(ev) {   // 委托（每次重渲覆盖·不叠加）
      var t = ev.target;
      var tog = t.closest ? t.closest('.hunk-tog') : null;
      if (tog) { _toggleHunk(+tog.getAttribute('data-diff-idx')); return; }
      var grp = t.closest ? t.closest('.grp-tog') : null;
      if (grp) { _toggleGroup((grp.getAttribute('data-group-idxs') || '').split(',').filter(Boolean).map(Number)); return; }
    };
  }
  function _diffHeaderText() {
    var diffs = ui._lastDiffs || [], rej = ui._diffRejected || new Set();
    var totalUnc = diffs.filter(function(d) { return _uncReasonFor(d.path, ui._lastUnc); }).length;
    if (!diffs.length) return '改动预览';
    var acc = diffs.length - rej.size;
    return '改动预览 · 接受 ' + acc + '/' + diffs.length + ' 处' + (rej.size ? '（✗' + rej.size + '）' : '') + (totalUnc ? ' · ' + totalUnc + ' 处待核' : '');
  }
  function _paintDiff() {
    var diffs = ui._lastDiffs || [], unc = ui._lastUnc || [];
    ui.els.diffSec.textContent = _diffHeaderText();
    if (!diffs.length) { ui.els.diff.innerHTML = '<div class="ln" style="color:#8f8a7e">（无改动）</div>'; return; }
    var groups = {}, order = [];
    diffs.forEach(function(d) { var top = String(d.path || '').split(/[.\[]/)[0] || '(根)'; if (!groups[top]) { groups[top] = []; order.push(top); } groups[top].push(d); });
    ui.els.diff.innerHTML = order.map(function(field) {
      var es = groups[field];
      var inner = es.slice(0, 40).map(function(d) { return _diffEntryHtml(d, _uncReasonFor(d.path, unc), d.__idx); }).join('');
      if (es.length > 40) inner += '<div class="ln">… 还有 ' + (es.length - 40) + ' 处（默认接受）</div>';
      var gUnc = es.filter(function(d) { return _uncReasonFor(d.path, unc); }).length;
      var idxs = es.slice(0, 40).map(function(d) { return d.__idx; });
      var allRej = idxs.every(function(i) { return ui._diffRejected.has(i); });
      var firstPath = (es[0] && es[0].path) || field;
      return '<div class="tm-aa-diff-group" data-group="' + esc(field) + '"><div class="tm-aa-diff-head"><b class="tm-aa-diff-jump" data-reveal-field="' + esc(field) + '" data-first-path="' + esc(firstPath) + '" title="在折子里定位此字段（跳首处改动）">' + esc(_COLL_CN[field] || field) + ' \u2197</b> <span style="color:#8f8a7e">(' + es.length + ' 处' + (gUnc ? ' · 待核' + gUnc : '') + ')</span><button type="button" class="grp-tog" data-group-idxs="' + idxs.join(',') + '">' + (allRej ? '全收' : '全拒') + '</button></div>' + inner + '</div>';
    }).join('');
  }
  function _toggleHunk(idx) {
    if (!ui._diffRejected) ui._diffRejected = new Set();
    if (ui._diffRejected.has(idx)) ui._diffRejected.delete(idx); else ui._diffRejected.add(idx);
    _paintDiff();
  }
  function _toggleGroup(idxs) {
    if (!idxs.length) return;
    if (!ui._diffRejected) ui._diffRejected = new Set();
    var allRej = idxs.every(function(i) { return ui._diffRejected.has(i); });
    idxs.forEach(function(i) { if (allRej) ui._diffRejected.delete(i); else ui._diffRejected.add(i); });   // 全拒→全收，否则全拒
    _paintDiff();
  }

  function renderValidation(report) {
    if (!ui.els) return;
    var v = ui.els.val;
    v.style.display = '';
    if (report.ok) { v.className = 'tm-aa-val ok'; v.textContent = '✓ 校验通过'; return; }
    v.className = 'tm-aa-val bad';
    v.textContent = '仍有 ' + report.violations.length + ' 项校验问题：' + report.violations.slice(0, 4).join('；');
  }

  // 方向D · 审阅报告：总评进 summary 块、findings 按严重度排序着色进 diff 区（只读·无应用）
  function renderReview(review, stream) {
    if (!ui.els) return;
    if (ui.els.summary) {
      ui.els.summary.innerHTML = '<b>剧本审阅报告</b><span class="tm-aa-stream">' + esc((review && review.summary) || '（无总评）') + '</span>';
      ui.els.summary.style.display = '';
      _streamThenLink(ui.els.summary.querySelector('.tm-aa-stream'), stream);   // UI·P 吐字 + UI·AH linkify（总评部分）
    }
    ui.els.diffSec.style.display = ''; ui.els.diff.style.display = '';
    var findings = ((review && review.findings) || []).slice();
    ui.els.diffSec.textContent = '审阅发现（' + findings.length + ' 条）';
    var sevRank = { '高': 0, '中': 1, '低': 2 };
    findings.sort(function(a, b) { return (sevRank[a && a.severity] != null ? sevRank[a.severity] : 3) - (sevRank[b && b.severity] != null ? sevRank[b.severity] : 3); });
    if (!findings.length) { ui.els.diff.innerHTML = '<div class="ln" style="color:#7fe0a0">✓ 未发现明显问题</div>'; return; }
    ui.els.diff.innerHTML = findings.slice(0, 40).map(function(f) {
      f = f || {};
      var sev = f.severity || '?';
      var sevCls = sev === '高' ? 'rm' : (sev === '中' ? 'ch' : 'add');
      return '<div class="tm-aa-finding"><span class="sev ' + sevCls + '">[' + esc(sev) + ']</span> <b>' + esc(f.dimension || '') + '</b>'
        + (f.location ? ' <span class="loc">' + esc(String(f.location).slice(0, 50)) + '</span>' : '')
        + '<div class="iss">' + _mdLine(f.issue || '') + '</div>'
        + (f.suggestion ? '<div class="sug">→ ' + _mdLine(f.suggestion) + '</div>' : '') + '</div>';
    }).join('') + (findings.length > 40 ? '<div class="ln">… 还有 ' + (findings.length - 40) + ' 条</div>' : '');
  }

  // 方向K · 交互式澄清：作为对话气泡展示问题（玩家在输入框作答后续接）—— 不碰 summary/diff
  function renderClarify(questions) {
    if (!ui.els) return;
    questions = questions || [];
    var qs = questions.map(function(q, i) {
      return '<div class="ai-q">' + (i + 1) + '. ' + esc(typeof q === 'string' ? q : JSON.stringify(q)) + '</div>';
    }).join('') || '<div class="ai-q">（未列出具体问题）</div>';
    _appendGuoshiMsg('<span class="ai-who">国师 · 请教</span>要改得准，我需要先弄清几点：<div class="ai-qs">' + qs + '</div><div class="ai-hint">在下方输入框作答后发送即可继续</div>');
  }

  // 国师的对话消息气泡（进谏/澄清走它·像聊天而非塞进改动预览区）—— 追加到对话流，不碰 summary/diff
  function _appendGuoshiMsg(innerHtml) {
    if (!ui.els || !ui.els.log) return;
    if (ui.els.logSec) ui.els.logSec.style.display = '';
    if (ui.els.logWrap) ui.els.logWrap.style.display = '';
    var b = document.createElement('div');
    b.className = 'tm-aa-msg-ai';
    b.innerHTML = innerHtml;
    ui.els.log.appendChild(b);
    _logScrollMaybe(true);
  }
  // 刀1 · 国师进谏：作为对话气泡展示异议 + 替代方案（玩家在输入框回应后走续接通道）
  function renderRemonstrance(r) {
    if (!ui.els) return;
    r = r || {};
    var sevMap = { '史实': '史实存疑', '平衡': '数值失衡', '机制': '跨朝代机制' };
    var html = '<span class="ai-who">国师 · 进谏</span>'
      + '<span class="ai-sev">' + esc(sevMap[r.severity] || r.severity || '谏') + '</span>'
      + esc(r.concern || '（此举我以为不妥，恕未及细陈）')
      + (r.suggestion ? '<div class="ai-sug">↳ 建议：' + esc(r.suggestion) + '</div>' : '')
      + '<div class="ai-hint">在下方回应后发送即可继续：采纳建议 ／「我坚持，因为…」／ 换个需求</div>';
    _appendGuoshiMsg(html);
  }

  // 计划模式 · 展示 agent 的编号计划
  function renderPlan(plan) {
    if (!ui.els) return;
    ui.els.diffSec.style.display = ''; ui.els.diff.style.display = '';
    ui.els.diffSec.textContent = '改动计划（批准后执行）';
    var steps = (plan && plan.steps) || [];
    var rows = [];
    if (plan && plan.summary) rows.push('<div class="ch">' + esc(plan.summary) + '</div>');
    steps.forEach(function(s, i) { rows.push('<div class="ln">' + (i + 1) + '. ' + esc(typeof s === 'string' ? s : (s.text || JSON.stringify(s))) + '</div>'); });
    if (!rows.length) rows.push('<div class="ln">（agent 未给出明确步骤）</div>');
    ui.els.diff.innerHTML = rows.join('');
  }

  // 计划模式 · 批准后按计划执行（续规划线程、全工具）
  function executePlan() {
    if (ui.running || !ui.draft) return;
    resetResults(true);   // 聊天化：保留对话流（结果作为新卡 append，不清历史）
    setRunning(true);
    setStatus('正在按计划执行…');
    AA.runAuthoringLoop(ui.draft, '按上面的计划执行这些改动；改完用 validateDraft 自查后调用 finish。', {
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
      _logRun('计划执行', '(按计划执行)', res);   // 方向M
      _beginReplyCard();
      renderSummary(res.summary, res.notes, res.suggestedConventions, true);   // UI·P · 流式
      renderDiff(AA.computeDiff(ui.adapter.getScenario(), ui.draft), res.uncertainties);   // 置信度标注
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
    if (!AA || typeof AA.runAuthoringLoop !== 'function') { setStatus('agent 核心未加载'); return; }
    resetResults(true);   // 聊天化：保留对话流（结果作为新卡 append，不清历史）
    var focus = (ui.els.req.value || '').trim();
    _appendUserMsg(focus || '审阅整个剧本', { kind: 'review', input: focus });   // UI·B 会话流 + UI·Y 重试派发
    ui.draft = AA.makeDraft(ui.adapter.getScenario());   // 只读快照（审阅不改它）
    ui.conversation = null; ui._pendingPlan = false;
    setRunning(true);
    setStatus('正在审阅剧本…（agent 只读巡查，出体检报告，可能需要数十秒）');
    AA.runAuthoringLoop(ui.draft, focus, {
      conventions: _convForRun(),   /* S9 · 两层约定注入(全局+本剧本) */
      reviewOnly: true,
      editorContext: _editorContext(),
      onStep: function(step) { appendLog(step); setStatus('审阅中·第 ' + step.iteration + ' 轮…'); },
      onText: function(text, iter) { appendText(text, iter); }
    }).then(function(res) {
      setRunning(false);
      _logRun('审阅', focus || '(全面体检)', res);   // 方向M
      ui.els.req.value = ''; _autoGrowReq();
      ui.draft = null;   // 审阅不产生可应用改动
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
    ui.draft = res.scenario; ui.conversation = null; ui._pendingPlan = false; ui._pendingClarify = false;
    var renamedN = res.renamed ? Object.keys(res.renamed).length : 0;
    var sm = '已合并捆绑包：势力 +' + res.added.factions + ' · 人物 +' + res.added.characters + ' · 关系 +' + res.added.relations + (renamedN ? ' · 重名已改 ' + renamedN + ' 个' : '');
    _logRun('导入捆绑', '捆绑包导入', { summary: sm, tokensUsed: 0, iterations: 0, stopReason: 'imported' });   // 方向M · 记历史 + 让 markLastApplied 生效
    _beginReplyCard();
    renderSummary(sm, null, null);
    renderDiff(AA.computeDiff(cur, ui.draft));
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
    var question = (ui.els.req.value || '').trim();
    if (!question) { setStatus('请先在输入框输入你想问的问题'); return; }
    if (!AA || typeof AA.runAuthoringLoop !== 'function') { setStatus('agent 核心未加载'); return; }
    resetResults(true);   // 聊天化：保留对话流（结果作为新卡 append，不清历史）
    _appendUserMsg(question, { kind: 'qa', input: question });   // UI·B 会话流 + UI·Y 重试派发
    ui.draft = AA.makeDraft(ui.adapter.getScenario());   // 只读快照
    ui.conversation = null; ui._pendingPlan = false; ui._pendingClarify = false;
    setRunning(true);
    setStatus('正在查证并回答…（只读，不改剧本）');
    AA.runAuthoringLoop(ui.draft, question, {
      conventions: _convForRun(),   /* S9 · 两层约定注入(全局+本剧本) */
      qaOnly: true,
      editorContext: _editorContext(),
      onStep: function(step) { appendLog(step); setStatus('查证中·第 ' + step.iteration + ' 轮…'); },
      onText: function(text, iter) { appendText(text, iter); }
    }).then(function(res) {
      setRunning(false);
      _logRun('问答', question, res);   // 方向M
      ui.draft = null; ui.els.req.value = ''; _autoGrowReq();
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
    if (!AA || typeof AA.runAuthoringLoop !== 'function') { setStatus('agent 核心未加载'); return; }
    var focus = (ui.els.req.value || '').trim();
    resetResults(true);   // 聊天化：保留对话流（结果作为新卡 append，不清历史）
    _appendUserMsg(focus || '讲解剧本', { kind: 'explain', input: focus });   // UI·B 会话流 + UI·Y 重试派发
    ui.draft = AA.makeDraft(ui.adapter.getScenario());   // 只读快照
    ui.conversation = null; ui._pendingPlan = false; ui._pendingClarify = false;
    setRunning(true);
    setStatus('正在通读剧本并讲解…（只读，不改剧本）');
    AA.runAuthoringLoop(ui.draft, focus, {
      conventions: _convForRun(),   /* S9 · 两层约定注入(全局+本剧本) */
      explainOnly: true,
      editorContext: _editorContext(),
      onStep: function(step) { appendLog(step); setStatus('通读中·第 ' + step.iteration + ' 轮…'); },
      onText: function(text, iter) { appendText(text, iter); }
    }).then(function(res) {
      setRunning(false);
      _logRun('讲解', focus || '(全面 onboarding)', res);
      ui.draft = null; ui.els.req.value = ''; _autoGrowReq();
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
    var request = (ui.els.req.value || '').trim();
    if (!request) { setStatus('请先输入需求（大任务会被分解为多步执行）'); return; }
    if (!AA || typeof AA.runOrchestrated !== 'function') { setStatus('agent 核心未加载'); return; }
    resetResults(true);   // 聊天化：保留对话流（结果作为新卡 append，不清历史）
    _appendUserMsg(request, { kind: 'orchestrate', input: request });   // UI·B 会话流 + UI·Y 重试派发
    ui.draft = AA.makeDraft(ui.adapter.getScenario());
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
    AA.runOrchestrated(ui.draft, request, {
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
      if (_clSteps.length) _renderChecklist(_clSteps.length, true);   // 全部 ✓
      _logRun('分解执行', request, res);   // 方向M
      ui.els.req.value = ''; _autoGrowReq();
      _beginReplyCard();
      renderSummary(res.summary, null, null, true);   // UI·P · 流式
      var diffs = AA.computeDiff(ui.adapter.getScenario(), ui.draft);
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
  function _armCritics() {
    ui._criticsArmed = true;
    if (ui.els && ui.els.go && !ui.running) { ui.els.go.textContent = '审'; ui.els.go.style.fontSize = '13px'; ui.els.go.title = '三堂会审：拟稿→史官查史+谏官批平衡→据谏修订'; }
    if (ui.els && ui.els.req) { ui.els.req.placeholder = '【三堂会审】写下要新增/修改什么——国师拟稿，再由史官查史实、谏官批平衡，据谏修订后交你审'; ui.els.req.focus(); }
    setStatus('已开启三堂会审 · 写下需求后点发送：拟稿 → 史官+谏官会审 → 据谏修订（比普通生成多 2~3 次调用）');
  }
  function _disarmCriticsVisual() {
    ui._criticsArmed = false;
    if (ui.els && ui.els.go && !ui.running) { ui.els.go.textContent = '↑'; ui.els.go.style.fontSize = ''; ui.els.go.title = 'Enter 发送 · Shift+Enter 换行'; }
    if (ui.els && ui.els.req) ui.els.req.placeholder = _REQ_PLACEHOLDER;
  }
  function runWithCriticsUI() {
    if (ui.running) return;
    var request = (ui.els.req.value || '').trim();
    if (!request) { _armCritics(); setStatus('三堂会审需要一个需求：先写下要新增/改什么，再点发送'); return; }
    if (!AA || typeof AA.runWithCritics !== 'function') { setStatus('agent 核心未加载'); return; }
    resetResults(true);   // 聊天化：保留对话流（结果作为新卡 append，不清历史）
    _appendUserMsg(request, { kind: 'critics', input: request });
    ui.draft = AA.makeDraft(ui.adapter.getScenario());
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
    AA.runWithCritics(ui.draft, request, {
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
      _info.hist = ((res.critiques && res.critiques.history && res.critiques.history.findings) || []).length;
      _info.bal = ((res.critiques && res.critiques.balance && res.critiques.balance.findings) || []).length;
      _phase.draft = 'done'; _phase.review = 'done'; _phase.revise = 'done'; _render(true);
      _logRun('三堂会审', request, res);
      ui.els.req.value = ''; _autoGrowReq();
      renderCriticsReport(res);
      var diffs = AA.computeDiff(ui.adapter.getScenario(), ui.draft);
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

  // UI·Q · 停止/中断生成：调 agent core 的 abort()（轮间干净收尾·不施未完成的改动）。
  // 适用于所有运行类型(普通编辑/计划执行/审阅/问答/讲解/分解执行)——abort() 终止当前 _activeRun。
  function onStop() {
    if (!ui.running || ui._stopping) return;
    ui._stopping = true;
    var stopped = false;
    try { stopped = !!(AA && AA.abort && AA.abort()); } catch (e) {}
    if (ui.els && ui.els.go) { ui.els.go.textContent = '…'; ui.els.go.disabled = true; }
    _cancelTypewriter();   // 打字机若在途也立即落定
    setStatus(stopped ? '正在停止…（本轮 API 返回后干净收尾，不施未完成的改动）' : '当前没有正在进行的运行');
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
    if (ui._criticsArmed) { _disarmCriticsVisual(); runWithCriticsUI(); return; }   // 刀3 · 已武装会审 → 改走三堂会审
    var request = (ui.els.req.value || '').trim();
    if (!request) { setStatus('请先输入需求'); return; }
    if (!AA || typeof AA.runAuthoringLoop !== 'function') { setStatus('agent 核心未加载'); return; }
    if (ui._pendingClarify) ui._pendingClarify = false;   // 聊天化：玩家发送即视为对上轮进谏/澄清的回应，走续接（无独立按钮）
    var planOnly = !!ui.planMode;   // 计划模式：先出计划，批准再执行
    // 真·连续会话：只要对话线程还在就续接（哪怕上一轮已应用·draft 已清）。计划模式总从当前剧本起新计划。
    //   ——治「每发一条指令都是新对话」：之前续接还要求 ui.draft，应用后 draft 没了就被迫重置；现在线程贯穿整个会话。
    var continuing = !planOnly && !!(ui.conversation && ui.conversation.length && !ui._pendingPlan);
    var _attTxt = _attachPrefix();   // S2 · 文本附件内联为参考上下文
    var _imgs = _takeImages();       // S2 · 图片走视觉通道
    var _attN = (_imgs ? _imgs.length : 0) + _attState().files.length;
    resetResults(continuing);   // UI·B · 会话流：续接保留线程+消息流、新对话清空
    _appendUserMsg(request + (_attN ? '（附 ' + _attN + ' 件）' : ''), { input: request });    // 回显用户消息气泡
    setRunning(true);
    setStatus(planOnly ? '正在规划…（agent 先只读、出计划）' : '正在生成…（agent 多轮编辑+自校验，可能需要数十秒）');
    if (!continuing) { ui.draft = AA.makeDraft(ui.adapter.getScenario()); if (!planOnly) ui.conversation = null; }
    else if (!ui.draft) { ui.draft = AA.makeDraft(ui.adapter.getScenario()); }   // 续接但上轮已应用 → 从当前(已更新)剧本新建 draft，对话线程保留

    var _rtd = (continuing && ui._restoredTodos && ui._restoredTodos.length) ? ui._restoredTodos : null;   // 刀H3 · 恢复的任务表一次性回灌
    ui._restoredTodos = null;
    _clearAttach();   // S2 · 附件随本轮发出·签行清空
    AA.runAuthoringLoop(ui.draft, request + _attTxt, {
      conventions: _convForRun(),   /* S9 · 两层约定注入(全局+本剧本) */
      planOnly: planOnly,
      images: _imgs,
      initialTodos: _rtd,
      priorConversation: continuing ? ui.conversation : null,
      memory: continuing ? '' : _buildMemory(),             // 跨会话记忆：新对话才注入历史；续接已在线程里
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
      // 自动续接：未完成且因轮次/token 上限停 → 自动发「继续」续接（复用连续会话线程·持续调用直到完整·安全上限 3 次）。
      if (!planOnly && !res.finished && (res.stopReason === 'maxIterations' || res.stopReason === 'tokenBudget') && (ui._autoCont || 0) < 3) {
        ui._autoCont = (ui._autoCont || 0) + 1;
        setStatus('未完成（' + (res.stopReason === 'tokenBudget' ? '达 token 上限' : '达迭代上限') + '）· 自动继续 ' + ui._autoCont + '/3…（持续到完整结果）');
        ui.els.req.value = '继续完成上面尚未完成的改动，全部完成后再调用 finish，不要重复已做的。';
        setTimeout(onGenerate, 60);   // 续接：ui.conversation 在 → onGenerate 走 continuing
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
      } else {                              // 普通：diff + 应用（进对话流回应卡）
        _beginReplyCard();
        ui._pendingPlan = false;
        ui.els.discard.textContent = '放弃';
        setStatus('结束（' + (stopMap[res.stopReason] || res.stopReason) + '·' + res.iterations + ' 轮·约 ' + res.tokensUsed + ' tokens）· 可继续追加需求，或应用/放弃');
        renderSummary(res.summary, res.notes, res.suggestedConventions, true);   // UI·P · 流式
        var diffs = AA.computeDiff(ui.adapter.getScenario(), ui.draft);
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

  // UI·X · 逐条接受/拒绝 · 应用：只落【接受】的 hunk（拒绝集外的）。核心纯函数 applySelectedDiffs 负责
  //   从当前剧本起、把拒绝的 hunk revert 回原状（数组 compact 无洞）。无拒绝 → 整份草稿。
  function _applyScenario() {
    var diffs = ui._lastDiffs || [], rej = ui._diffRejected || new Set();
    if (!diffs.length || !rej.size) return ui.draft;   // 全接受 → 整份草稿
    if (AA && typeof AA.applySelectedDiffs === 'function') {
      return AA.applySelectedDiffs(ui.adapter.getScenario(), ui.draft, diffs, function(d) { return !rej.has(d.__idx); });
    }
    return ui.draft;
  }

  function onApply() {
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
      if (diffs.length && rej.size >= diffs.length) { setStatus('已拒绝全部改动，未应用'); return; }
      _pushCheckpoint('应用前 ' + _ckptTime());   // 方向G · 应用前自动存检查点（可多级回溯）
      var _finalSc = _applyScenario();
      ['characters', 'factions', 'parties', 'classes', 'items', 'events', 'families', 'relations', 'factionRelations', 'rigidHistoryEvents', 'timeline', 'openingLetters', 'goals'].forEach(function (f) {
        if (!_finalSc || _finalSc[f] == null || Array.isArray(_finalSc[f])) return;
        var _v = _finalSc[f];
        if (typeof _v === 'object') {
          var _ks = Object.keys(_v);
          // 数字键对象→还原数组；命名对象（单条漏包数组）→包成 [实体]
          _finalSc[f] = (_ks.length && _ks.every(function (k) { return /^\d+$/.test(k); })) ? _ks.map(function (k) { return _v[k]; }) : [_v];
        } else { _finalSc[f] = [_v]; }
      });
      ui.adapter.commit(_finalSc);   // 应用前规范化：集合字段非数组→数组（修已生成草稿里 agent 误设成对象的集合，防下游遍历崩）
      var partial = rej.size > 0;
      markLastApplied();   // 方向M · 把最近一条历史标记为已应用
      try {   // N4 · 通知编辑器：在折子里高亮国师刚改的字段 + 精确跳到首处改动
        var _touched = {}, _rejN = ui._diffRejected || new Set(), _firstPath = null;
        (ui._lastDiffs || []).forEach(function (d) { if (_rejN.has(d.__idx)) return; var top = String(d.path || '').split(/[.[]/)[0]; if (top) _touched[top] = 1; if (!_firstPath && d.path) _firstPath = d.path; });
        var _app = global.TM_SCENARIO_EDITOR_RESET_APP;
        if (_app && typeof _app.markAgentTouched === 'function') _app.markAgentTouched(Object.keys(_touched));
        if (_firstPath && _app && typeof _app.revealPath === 'function') _app.revealPath(_firstPath);
      } catch (e) {}
      setStatus('已应用到剧本 ✓' + (partial ? '（仅接受的改动·拒绝了 ' + rej.size + ' 处）' : '') + '（可继续追问·同一会话）');
      if (ui._reply) { ui._reply.classList.add('applied'); var _atag = ui._reply.querySelector('.reply-tag'); if (_atag) _atag.textContent = '✓ 已应用到剧本' + (partial ? '（拒绝 ' + rej.size + ' 处）' : ''); }
      _freezeLastReply();   // 聊天化：应用后冻结当前卡（按钮隐藏·成历史只读）
      ui.draft = null;
      // 真·连续会话：应用后【保留】对话线程，下条指令在同一会话里续接（draft 已清·续接时从当前剧本新建）。
      //   想另起新对话用「＋ 新对话」或「放弃」。线程上限交 runAuthoringLoop 的 token 预算自然收口。
    } catch (e) {
      setStatus('应用失败：' + (e && e.message || e));
    }
  }

  function onDiscard() {
    ui.draft = null;
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
    ui.draft = null; ui.conversation = null; ui._pendingPlan = false; ui._pendingClarify = false;
    ui._restoredTodos = null; ui._sessId = null; _sessPtrSet(_fileKey(), null);   // S5 · 新对话=新会话·旧会话留侧栏可切回·指针置空(开面板不再拉回)
    if (ui._criticsArmed) _disarmCriticsVisual();   // 刀3 · 新对话清掉未用的会审武装
    resetResults(false);
    _syncEmpty();
    setStatus('已开始新对话（上一会话已入历史/记忆，可被延续）');
  }

  // 方向G · 检查点栈：把"应用前快照"升级为可命名、多级回溯的检查点（session 内存态·不持久，避免大剧本撑爆 localStorage）。
  function _ckptTime() { try { var d = new Date(); function p(n) { return (n < 10 ? '0' : '') + n; } return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds()); } catch (e) { return ''; } }
  function _pushCheckpoint(label) {
    if (!ui.adapter || typeof ui.adapter.getScenario !== 'function') return null;
    var cp = { id: ++ui._ckptSeq, label: label || '检查点', when: _ckptTime(), snapshot: _clone(ui.adapter.getScenario()) };
    ui._checkpoints.push(cp);
    if (ui._checkpoints.length > MAX_CKPT) ui._checkpoints.shift();   // 淘汰最旧
    if (typeof ui._onCheckpointsChange === 'function') { try { ui._onCheckpointsChange(); } catch (e) {} }
    return cp;
  }
  // 撤销 = 弹出并恢复最近的检查点（回到上次应用/回退前）
  function undoLastApply() {
    if (!ui._checkpoints.length) { setStatus('无可撤销的检查点'); return false; }
    try {
      var cp = ui._checkpoints.pop();
      ui.adapter.commit(cp.snapshot);
      ui.draft = null; ui.conversation = null; ui._sessId = null; _sessPtrSet(_fileKey(), null);   // S5 · 剧本已回退·脱离当前会话(旧会话留档不删)
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
    var cp = null;
    for (var i = 0; i < ui._checkpoints.length; i++) { if (ui._checkpoints[i].id === id) { cp = ui._checkpoints[i]; break; } }
    if (!cp) { setStatus('找不到该检查点'); return false; }
    try {
      _pushCheckpoint('回退前 ' + _ckptTime());
      ui.adapter.commit(_clone(cp.snapshot));
      ui.draft = null; ui.conversation = null; ui._sessId = null; _sessPtrSet(_fileKey(), null);   // S5 · 同上·回退后脱离会话(留档)
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
  global.TM_AuthoringAgentUI = { init: init, _ui: ui, undo: undoLastApply, stop: onStop, review: runReview, orchestrate: runOrchestratedUI, preflight: runPreflightUI, qa: runQaUI, explain: runExplainUI, checkpoint: manualCheckpoint, checkpoints: listCheckpoints, restore: restoreCheckpoint, history: listHistory, clearHistory: clearHistory, changelog: buildChangelog, runChangelog: runChangelogUI, macros: listMacros, saveMacro: saveMacro, deleteMacro: deleteMacro, applyMacro: applyMacro, exportBundle: exportBundle, importBundle: importBundle, detectModels: _detectModels, saveApiCfg: _saveApiCfg, permMode: function (m) { if (m && _PM_LABEL[m]) { var p = _loadPerm(); p.mode = m; _applyPerm(p); } return _loadPerm().mode; }, attachIngest: _ingestFiles, showMemories: showMemoriesUI, showSkills: showSkillsUI, showPacks: showPacksUI, showUsage: showUsageUI,
    listSessions: listSessions, switchSession: switchSession, deleteSession: deleteSession, renameSession: renameSession, forkSession: forkSession, rememberConvention: rememberConvention };
})(typeof window !== 'undefined' ? window : this);
