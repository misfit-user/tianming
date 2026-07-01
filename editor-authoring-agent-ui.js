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
      if (_isEnter && !ev.isComposing && !ui._atActive && (!ev.shiftKey || ev.metaKey || ev.ctrlKey)) {
        ev.preventDefault();
        if (!ui.running && typeof onGoClick === 'function') onGoClick();
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

  function injectStyles() {
    if (document.getElementById('tm-aa-style')) return;
    var css = [
      // 世界类型选择器（史实/虚构）
      '#tm-aa-worldkind{display:flex;align-items:center;gap:6px;margin:0 0 6px;font-size:11px;color:#b8b4a6}',
      '#tm-aa-worldkind .tm-aa-wk-lab{opacity:.75;letter-spacing:.05em}',
      '#tm-aa-worldkind .tm-aa-wk-opt{background:#34322d;color:#b8b4a6;border:1px solid #46433c;border-radius:11px;padding:2px 11px;font-size:11px;cursor:pointer;font-family:inherit;line-height:1.5}',
      '#tm-aa-worldkind .tm-aa-wk-opt:hover{background:#3c3933;color:#ecebe2}',
      '#tm-aa-worldkind .tm-aa-wk-opt.on{background:#d97757;color:#fff;border-color:#d97757}',
      '#tm-aa-fab{position:fixed;right:18px;bottom:18px;z-index:99998;background:#d97757;color:#fff;border:none;',
      'border-radius:24px;padding:10px 16px;font-size:13px;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.3);font-family:inherit}',
      '#tm-aa-fab:hover{background:#e08a6b}',
      '#' + PANEL_ID + '{position:fixed;right:18px;bottom:64px;z-index:99999;width:380px;max-width:calc(100vw - 36px);',
      'height:78vh;display:none;flex-direction:column;background:#2a2926;color:#ecebe2;border:1px solid #3c3933;',
      'border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,.5);font-family:inherit;font-size:13px;overflow:hidden}',
      '#' + PANEL_ID + '.open{display:flex}',
      '#tm-aa-hd{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:#34322d;border-bottom:1px solid #3c3933}',
      '.tm-aa-resize{position:absolute;left:0;top:0;bottom:0;width:6px;cursor:ew-resize;z-index:5}.tm-aa-resize:hover{background:rgba(217,119,87,.3)}',
      '.tm-aa-search{position:sticky;top:-10px;z-index:6;display:flex;align-items:center;gap:4px;margin:-4px -2px 2px;padding:4px 6px;background:#1f1d1a;border:1px solid #3c3933;border-radius:7px}',
      '.tm-aa-search[hidden]{display:none}',
      '.tm-aa-search input{flex:1;min-width:0;background:#181613;color:#ecebe2;border:1px solid #322f2a;border-radius:5px;padding:3px 6px;font-size:11px;font-family:inherit}',
      '.tm-aa-search .tm-aa-search-n{color:#8f8a7e;font-size:10px;white-space:nowrap;font-variant-numeric:tabular-nums}',
      '.tm-aa-search button{background:#322f2a;color:#b4afa2;border:none;border-radius:5px;padding:2px 7px;font-size:11px;cursor:pointer;line-height:1.4}.tm-aa-search button:hover{background:#3c3933;color:#ecebe2}',
      '.tm-aa-hl{background:rgba(232,200,106,.32);color:inherit;border-radius:2px}.tm-aa-hl.active{background:#e8c86a;color:#1a1206}',
      '#tm-aa-fs{background:none;border:none;color:#8f8a7e;font-size:13px;cursor:pointer;line-height:1;padding:0 3px}#tm-aa-fs:hover{color:#ecebe2}',
      '#tm-aa-preflight{background:none;border:none;color:#8f8a7e;font-size:13px;cursor:pointer;line-height:1;padding:0 3px}#tm-aa-preflight:hover{color:#7fe0a0}',
      '#tm-aa-hd b{font-size:13px}',
      '.tm-aa-ava{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:linear-gradient(135deg,#d97757,#bf5f3f);font-size:13px;margin-right:7px;vertical-align:middle;box-shadow:0 1px 4px rgba(217,119,87,.45)}',
      '#tm-aa-hd .sub{font-size:11px;color:#8f8a7e;margin-left:6px}',
      '#tm-aa-x{background:none;border:none;color:#8f8a7e;font-size:18px;cursor:pointer;line-height:1}',
      '#tm-aa-body{padding:12px 14px;overflow:hidden;display:flex;flex-direction:column;gap:10px;position:relative;flex:1 1 auto;min-height:0}',
      '#tm-aa-composer{display:flex;flex-direction:column;gap:9px;order:80;flex:0 0 auto;z-index:7;background:#2a2926;margin-left:-14px;margin-right:-14px;padding:9px 14px 4px;border-top:1px solid #322f2a}',
      '#tm-aa-req{width:100%;box-sizing:border-box;background:transparent;color:#ecebe2;border:none;',
      'border-radius:14px;padding:10px 44px 10px 13px;font-family:inherit;font-size:13px;resize:none;min-height:56px;max-height:180px;overflow:auto;display:block;outline:none}',
      '.tm-aa-charcount{position:absolute;top:6px;right:12px;font-size:10px;color:#726d62;pointer-events:none;background:rgba(31,29,26,.82);padding:0 4px;border-radius:4px;z-index:1}',
      '.tm-aa-charcount[hidden]{display:none}',
      '#tm-aa-field{position:relative;background:#1f1d1a;border:1px solid #3c3933;border-radius:14px;transition:border-color .12s,box-shadow .12s}',
      '#tm-aa-field:focus-within{border-color:#d97757;box-shadow:0 0 0 3px rgba(217,119,87,.16)}',
      '#tm-aa-go{position:absolute;right:7px;bottom:7px;width:30px;height:30px;display:flex;align-items:center;justify-content:center;background:#d97757;color:#fff;border:none;border-radius:50%;padding:0;cursor:pointer;font-size:15px;line-height:1;transition:background .12s,transform .08s}',
      '#tm-aa-go:hover{background:#e08a6b}#tm-aa-go:active{transform:scale(.92)}',
      '#tm-aa-go:disabled{opacity:.5;cursor:default}',
      '#tm-aa-go.stopbtn{background:#c0413b}#tm-aa-go.stopbtn:hover{background:#d2554f}',
      '#tm-aa-status{font-size:12px;color:#9b968a;min-height:16px}',
      '#tm-aa-ctx{display:flex;align-items:center;gap:6px;font-size:11px;color:#b4afa2;background:rgba(217,119,87,.10);border:1px solid rgba(217,119,87,.32);border-radius:6px;padding:3px 8px;margin-bottom:2px}',
      '#tm-aa-ctx[hidden]{display:none}',
      '.tm-aa-ctx-txt{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.tm-aa-ctx-ico{flex:0 0 auto;opacity:.85}',
      '.tm-aa-ctx-pin{flex:0 0 auto;background:none;border:none;cursor:pointer;font-size:12px;opacity:.6;padding:0 2px;line-height:1}',
      '.tm-aa-ctx-pin:hover,.tm-aa-ctx-pin.on{opacity:1}',
      '#tm-aa-mentions{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:2px}',
      '#tm-aa-mentions[hidden]{display:none}',
      '.tm-aa-mchip{display:inline-flex;align-items:center;gap:3px;font-size:11px;color:#cfe6dd;background:rgba(126,184,167,.14);border:1px solid rgba(126,184,167,.4);border-radius:10px;padding:1px 4px 1px 7px}',
      '.tm-aa-mx{background:none;border:none;color:#cfe6dd;cursor:pointer;font-size:13px;line-height:1;padding:0 2px;opacity:.7}.tm-aa-mx:hover{opacity:1}',
      '#tm-aa-atpop{position:absolute;left:12px;right:12px;bottom:calc(100% + 4px);z-index:9;max-height:210px;overflow:auto;background:#1f1d1a;border:1px solid #3c3933;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.5);padding:4px}',
      '#tm-aa-atpop[hidden]{display:none}',
      '.tm-aa-atitem{display:flex;align-items:center;gap:7px;width:100%;text-align:left;background:none;border:none;color:#ecebe2;cursor:pointer;font-size:12px;padding:5px 8px;border-radius:6px;font-family:inherit}',
      '.tm-aa-atitem:hover{background:rgba(217,119,87,.18)}',
      '.tm-aa-atkind{flex:0 0 auto;font-size:10px;color:#9b968a;background:rgba(255,255,255,.06);border-radius:4px;padding:1px 5px}',
      '.tm-aa-diff-jump{cursor:pointer;border-bottom:1px dashed rgba(126,184,167,.5)}',
      '.tm-aa-diff-jump:hover{color:#a7e0cf}',
      '#tm-aa-meter{font-size:11px;color:#e8a98c;font-variant-numeric:tabular-nums;padding:2px 0}',
      '.tm-aa-empty{order:4;margin:auto 0;background:none;border:none;padding:14px 8px;display:flex;flex-direction:column;align-items:center;gap:4px;text-align:center}',
      '.tm-aa-empty .emp-hi{font-size:30px;line-height:1.1}',
      '.tm-aa-empty .emp-title{color:#cec9bb;font-size:16px;font-weight:bold;line-height:1.2}',
      '.tm-aa-empty .emp-sub{color:#8f8a7e;font-size:11px;margin-bottom:9px;line-height:1.5}',
      '.tm-aa-empty .emp-chips{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;max-width:300px}',
      '.tm-aa-empty .emp-chip{background:#34322d;color:#dedacb;border:1px solid #3c3933;border-radius:13px;padding:4px 11px;font-size:11px;cursor:pointer;font-family:inherit}.tm-aa-empty .emp-chip:hover{background:#403d37;border-color:#56514a}',
      '.tm-aa-logwrap{position:relative;flex:1 1 0;min-height:0;overflow-y:auto}',
      '.tm-aa-log{padding:2px 0;font-size:11px;line-height:1.5}',
      '.tm-aa-tobottom{position:absolute;right:9px;bottom:7px;background:#322f2a;color:#dedacb;border:1px solid #48443d;border-radius:11px;padding:2px 9px;font-size:10px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.4);z-index:2}.tm-aa-tobottom:hover{background:#423e37}',
      '.tm-aa-tobottom[hidden]{display:none}',
      '.tm-aa-log .ln{color:#b4afa2}.tm-aa-log .bad{color:#ff8f8f}.tm-aa-log .fin{color:#7fe0a0}',
      '.tm-aa-step{margin:1px 0}.tm-aa-step>summary{cursor:pointer;list-style:none;padding:1px 0;line-height:1.5;outline:none}',
      '.tm-aa-step>summary::-webkit-details-marker{display:none}.tm-aa-step>summary::before{content:"▸ ";color:#8f8a7e}.tm-aa-step[open]>summary::before{content:"▾ "}',
      '.tm-aa-step.fin>summary{color:#7fe0a0}.tm-aa-step.ln>summary{color:#b4afa2}.tm-aa-step.bad>summary{color:#ff8f8f}',
      '.tm-aa-step:not([open])>.tm-aa-step-body{display:none}',
      '.tm-aa-think{margin:2px 0}.tm-aa-think>summary{cursor:pointer;list-style:none;color:#9b968a;font-style:italic;font-size:11px;padding:1px 0;outline:none}',
      '.tm-aa-think>summary::-webkit-details-marker{display:none}.tm-aa-think>summary::before{content:"▸ ";font-style:normal;color:#8f8a7e}.tm-aa-think[open]>summary::before{content:"▾ "}',
      '.tm-aa-think:not([open])>.tm-aa-think-body{display:none}',
      '.tm-aa-think-body{padding:2px 0 3px 14px;border-left:1px solid #322f2a;margin:2px 0 2px 3px}',
      '.tm-aa-think-body .tk-line{color:#9b968a;font-style:italic;font-size:11px;line-height:1.5;margin:1px 0;white-space:pre-wrap;word-break:break-word}',
      '.tm-aa-step-body{padding:2px 0 4px 12px;border-left:1px solid #322f2a;margin:2px 0 2px 3px}',
      '.tm-aa-step-body .sb-row{margin:2px 0}.tm-aa-step-body .sb-k{display:inline-block;color:#8f8a7e;font-size:10px;margin-right:4px}',
      '.tm-aa-step-body pre{margin:1px 0;white-space:pre-wrap;word-break:break-all;font-family:ui-monospace,Consolas,monospace;font-size:10px;line-height:1.45;color:#9b968a;max-height:120px;overflow:auto}',
      '.tm-aa-checklist{background:#23211e;border:1px solid #3c3933;border-radius:8px;padding:6px 8px;margin-bottom:6px}',
      '.tm-aa-checklist .cl-head{font-size:11px;color:#e8a98c;font-weight:bold;margin-bottom:3px}',
      '.tm-aa-checklist .cl-item{font-size:11px;line-height:1.7;color:#9b968a;display:flex;gap:6px;align-items:baseline}',
      '.tm-aa-checklist .cl-item .cl-ic{width:12px;text-align:center;flex:none}',
      '.tm-aa-checklist .cl-item.done{color:#7fe0a0}.tm-aa-checklist .cl-item.done .cl-ic{color:#7fe0a0}',
      '.tm-aa-checklist .cl-item.run{color:#e8c86a}.tm-aa-checklist .cl-item.run .cl-ic{color:#e8c86a}',
      '.tm-aa-checklist .cl-item.pend{color:#726d62}',
      '.tm-aa-msg-user{position:relative;margin:8px 0 6px auto;max-width:88%;width:fit-content;padding:5px 9px;background:rgba(217,119,87,.16);border:1px solid rgba(217,119,87,.32);border-radius:9px 9px 3px 9px;font-size:11px;line-height:1.55;color:#ece4d8}',
      '.tm-aa-msg-user .mu-who{color:#e8a98c;font-weight:bold;margin-right:6px;font-size:10px}',
      '.tm-aa-msg-acts{position:absolute;top:-11px;right:6px;display:none;gap:1px;background:#34322d;border:1px solid #3c3933;border-radius:6px;padding:1px 2px;box-shadow:0 2px 6px rgba(0,0,0,.3)}',
      '.tm-aa-msg-user:hover .tm-aa-msg-acts{display:inline-flex}',
      '.tm-aa-msg-ai{position:relative;margin:8px auto 6px 0;max-width:90%;width:fit-content;padding:6px 10px;background:#23211e;border:1px solid #3c3933;border-radius:9px 9px 9px 3px;font-size:11px;line-height:1.6;color:#dbd8cb}',
      '.tm-aa-msg-ai .ai-who{color:#e8a98c;font-weight:bold;font-size:10px;display:block;margin-bottom:3px}',
      '.tm-aa-msg-ai .ai-sev{display:inline-block;background:rgba(232,200,106,.18);color:#e8c86a;border-radius:4px;padding:0 5px;font-size:10px;margin-right:5px}',
      '.tm-aa-msg-ai .ai-sug{color:#a7e0cf;margin-top:4px}',
      '.tm-aa-msg-ai .ai-qs{margin-top:3px}.tm-aa-msg-ai .ai-q{line-height:1.7}',
      '.tm-aa-msg-ai .ai-hint{color:#8f8a7e;font-size:10px;margin-top:5px;border-top:1px solid #322f2a;padding-top:4px}',
      '.tm-aa-reply{margin:6px 0;padding:8px 10px;background:#1c1a17;border:1px solid #322f2a;border-radius:9px 9px 9px 3px}',
      '.tm-aa-reply .reply-who{display:flex;align-items:center;gap:5px;margin-bottom:4px}',
      '.tm-aa-reply .reply-who .reply-ava{font-size:13px;line-height:1}',
      '.tm-aa-reply .reply-who b{color:#e8a98c;font-size:11px;font-weight:bold}',
      '.tm-aa-reply .tm-aa-summary{background:none;padding:0;border-radius:0}',
      '.tm-aa-reply .tm-aa-summary::before{display:none}',
      '.tm-aa-reply.frozen{opacity:.66}',
      '.tm-aa-reply .reply-actions{display:flex;gap:6px;margin-top:8px}',
      '.tm-aa-reply .reply-actions button{flex:1;font-size:11px;padding:5px 6px;border-radius:6px;cursor:pointer;border:1px solid #3c3933;background:#2a2824;color:#ece4d8}',
      '.tm-aa-reply .reply-actions button:hover{background:#3c3933}',
      '.tm-aa-reply .reply-actions button:first-child{flex:2;background:rgba(127,224,160,.16);border-color:rgba(127,224,160,.4);color:#bfe8cf}',
      '.tm-aa-reply .reply-actions button:first-child.warn{background:rgba(232,200,106,.16);border-color:rgba(232,200,106,.4);color:#e8c86a}',
      '.tm-aa-reply.applied{border-color:rgba(127,224,160,.35)}',
      '.tm-aa-reply .reply-tag{font-size:10px;margin-top:6px;display:none}.tm-aa-reply.applied .reply-tag{display:block;color:#7fe0a0}.tm-aa-reply.discarded .reply-tag{display:block;color:#8f8a7e}',
      '.mu-act{background:none;border:none;color:#b4afa2;cursor:pointer;font-size:11px;padding:1px 5px;border-radius:4px;line-height:1.5}.mu-act:hover{background:#3c3933;color:#ecebe2}',
      '.tm-aa-sec{font-size:11px;color:#8f8a7e;text-transform:none;margin-top:2px}',
      '.tm-aa-diff{background:#1f1d1a;border:1px solid #322f2a;border-radius:8px;padding:6px 8px;max-height:180px;overflow:auto;font-size:11px;line-height:1.5}',
      '.tm-aa-diff .add{color:#7fe0a0}.tm-aa-diff .rm{color:#ff8f8f}.tm-aa-diff .ch{color:#e8c86a}',
      '.tm-aa-diff .uncertain{background:rgba(232,200,106,.10);border-left:2px solid #e8c86a;padding-left:5px;margin-left:-7px}',
      '.tm-aa-diff .tm-aa-unc{display:block;color:#e8c86a;font-size:10px;margin-top:1px}',
      '.tm-aa-summary{background:#23211e;border:none;border-radius:10px;padding:10px 12px;font-size:12px;line-height:1.65;color:#dbd8cb}',
      '.tm-aa-summary::before{content:"🧙 国师";display:block;font-size:10px;color:#9b968a;font-weight:bold;margin-bottom:4px;opacity:.85}',
      '.tm-aa-summary b{color:#e8a98c;font-size:11px;display:block;margin-bottom:3px}',
      '.tm-aa-summary .note{color:#9b968a;font-size:11px;margin-top:3px}',
      '.tm-aa-summary.tm-aa-clamped{max-height:var(--clamp-max,280px);overflow:hidden;position:relative;flex:0 0 auto}',
      '.tm-aa-summary.tm-aa-clamped::after{content:"";position:absolute;left:0;right:0;bottom:0;height:44px;background:linear-gradient(rgba(35,33,30,0),#23211e);pointer-events:none}',
      '.tm-aa-summary.tm-aa-clamp-open{max-height:none;overflow:visible}.tm-aa-summary.tm-aa-clamp-open::after{display:none}',
      '.tm-aa-clamp-btn{align-self:flex-start;background:none;border:none;color:#e8a98c;font-size:11px;cursor:pointer;padding:2px 0;margin-top:-4px}.tm-aa-clamp-btn:hover{text-decoration:underline}',
      '.tm-aa-errcard{background:rgba(192,65,59,.10);border:1px solid #5d3a3a;border-left:3px solid #c0413b;border-radius:8px;padding:8px 10px}',
      '.tm-aa-errcard .ec-head{color:#ff8f8f;font-weight:bold;font-size:11px;margin-bottom:3px}',
      '.tm-aa-errcard .ec-msg{color:#e2c0c0;font-size:11px;line-height:1.55;white-space:pre-wrap;word-break:break-word}',
      '.tm-aa-errcard .ec-acts{display:flex;gap:6px;margin-top:7px}',
      '.tm-aa-errcard .ec-retry{background:#c0413b;color:#fff;border:none;border-radius:6px;padding:3px 12px;font-size:11px;cursor:pointer}.tm-aa-errcard .ec-retry:hover{background:#d2554f}',
      '.tm-aa-errcard .ec-copy{background:#3c3933;color:#dedacb;border:none;border-radius:6px;padding:3px 10px;font-size:11px;cursor:pointer}.tm-aa-errcard .ec-copy:hover{background:#48443d}',
      '.md-p{margin:2px 0;line-height:1.6}.md-h{font-weight:bold;color:#cec9bb;margin:4px 0 2px}.md-h1{font-size:13px}.md-h2,.md-h3,.md-h4{font-size:12px}',
      '.md-list{margin:3px 0;padding-left:18px}.md-list li{margin:1px 0;line-height:1.6}',
      '.md-ic{background:rgba(184,154,83,.14);color:#e8c86a;padding:0 4px;border-radius:3px;font-family:ui-monospace,Consolas,monospace;font-size:11px}',
      '.md-code{background:#181613;border:1px solid #322f2a;border-radius:0 0 6px 6px;border-top:none;padding:6px 8px;margin:0;overflow:auto;font-family:ui-monospace,Consolas,monospace;font-size:11px;line-height:1.5;white-space:pre-wrap;color:#d2cdbd}',
      '.md-codewrap{margin:4px 0;position:relative}',
      '.md-codebar{display:flex;align-items:center;justify-content:space-between;background:#1f1d1a;border:1px solid #322f2a;border-radius:6px 6px 0 0;padding:2px 6px 2px 8px}',
      '.md-codebar .md-lang{color:#8f8a7e;font-size:10px;font-family:ui-monospace,Consolas,monospace;text-transform:lowercase}',
      '.md-codebar .md-copy{background:none;border:none;color:#9b968a;cursor:pointer;font-size:10px;padding:1px 5px;border-radius:4px;opacity:0;transition:opacity .12s}',
      '.md-codewrap:hover .md-copy{opacity:1}.md-codebar .md-copy:hover{background:#322f2a;color:#ecebe2}',
      '.md-code .tok-str{color:#9ad6a0}.md-code .tok-key{color:#7fb4e8}.md-code .tok-num{color:#e0b863}.md-code .tok-kw{color:#c98ad6}.md-code .tok-punct{color:#8f8a7e}',
      '.md-p strong{color:#ecebe2}.md-p em{color:#cec9bb}',
      '.md-table{border-collapse:collapse;margin:5px 0;font-size:11px;max-width:100%;display:block;overflow:auto}',
      '.md-table th,.md-table td{border:1px solid #322f2a;padding:3px 7px;text-align:left;line-height:1.5}',
      '.md-table th{background:#23211e;color:#cec9bb;font-weight:bold;white-space:nowrap}',
      '.md-table td{color:#dbd8cb}.md-table tbody tr:nth-child(even) td{background:rgba(255,255,255,.025)}',
      '.tm-aa-stream{display:block}',
      '.je-entity-ref{color:#e8a98c;text-decoration:underline dotted;text-underline-offset:2px;cursor:pointer}.je-entity-ref:hover{color:#f0c4ad;text-decoration-style:solid;background:rgba(217,119,87,.12);border-radius:3px}',
      '.tm-aa-caret{display:inline-block;color:#e8a98c;font-weight:400;margin-left:1px;animation:tm-aa-blink 1.05s step-end infinite}',
      '@keyframes tm-aa-blink{50%{opacity:0}}',
      '.tm-aa-summary .tm-aa-cl-copy{margin-left:8px;background:#3c3933;color:#ecebe2;border:none;border-radius:6px;padding:1px 8px;font-size:10px;cursor:pointer}',
      '.tm-aa-summary pre.tm-aa-cl{white-space:pre-wrap;margin:5px 0 0;font-family:inherit;font-size:11px;line-height:1.6;color:#dbd8cb;max-height:200px;overflow:auto}',
      '.tm-aa-sug{margin-top:6px;padding-top:5px;border-top:1px solid #3c3933}.tm-aa-sug b{color:#e8c86a}',
      '.tm-aa-sug .sug-row{display:flex;align-items:center;gap:6px;margin-top:4px;font-size:11px;color:#dbd8cb}.tm-aa-sug .sug-row span{flex:1}',
      '.tm-aa-sug .sug-keep{background:#3c3933;color:#ecebe2;border:none;border-radius:6px;padding:2px 8px;font-size:11px;cursor:pointer}.tm-aa-sug .sug-keep:disabled{opacity:.6;cursor:default}',
      '.tm-aa-finding{margin-bottom:6px;padding:5px 7px;background:#1f1d1a;border:1px solid #322f2a;border-left:3px solid #3c3933;border-radius:6px}',
      '.tm-aa-finding .sev{font-weight:bold;font-size:11px}.tm-aa-finding .sev.rm{color:#ff8f8f}.tm-aa-finding .sev.ch{color:#e8c86a}.tm-aa-finding .sev.add{color:#7fe0a0}',
      '.tm-aa-finding b{color:#cec9bb;font-size:12px}.tm-aa-finding .loc{color:#8f8a7e;font-size:10px}',
      '.tm-aa-finding .iss{color:#dbd8cb;font-size:11px;margin-top:2px;line-height:1.5}.tm-aa-finding .sug{color:#9b968a;font-size:11px;margin-top:2px;line-height:1.5}',
      '.tm-aa-diff-group{margin-bottom:6px;border-bottom:1px solid #322f2a;padding-bottom:4px}.tm-aa-diff-head{display:flex;align-items:center;gap:6px;color:#ecebe2;padding:2px 0;font-size:12px}',
      '.tm-aa-diff-head .grp-tog{margin-left:auto;background:#322f2a;color:#b4afa2;border:none;border-radius:5px;padding:1px 7px;font-size:10px;cursor:pointer}.tm-aa-diff-head .grp-tog:hover{background:#3c3933}',
      '.tm-aa-hunk{display:flex;align-items:flex-start;gap:6px;margin:2px 0}',
      '.tm-aa-hunk .hunk-tog{flex:0 0 auto;width:18px;height:18px;line-height:16px;text-align:center;border-radius:5px;border:1px solid #3a4d3a;background:rgba(127,224,160,.14);color:#7fe0a0;cursor:pointer;font-size:11px;padding:0}',
      '.tm-aa-hunk .hunk-body{flex:1;min-width:0}',
      '.tm-aa-hunk.rejected .hunk-tog{border-color:#5d3a3a;background:rgba(255,143,143,.14);color:#ff8f8f}',
      '.tm-aa-hunk.rejected .hunk-body{opacity:.42;text-decoration:line-through}',
      '.tm-aa-val.ok{color:#7fe0a0}.tm-aa-val.bad{color:#ff8f8f}',
      '#tm-aa-actions{display:flex;gap:8px}',
      '#tm-aa-apply{flex:1;background:#2e9e5b;color:#fff;border:none;border-radius:8px;padding:8px;cursor:pointer}',
      '#tm-aa-apply.warn{background:#b5872e}',
      '#tm-aa-discard{flex:1;background:#3c3933;color:#ecebe2;border:none;border-radius:8px;padding:8px;cursor:pointer}'
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
      '<div id="tm-aa-hd"><span><span class="tm-aa-ava">🧙</span><b>国师</b><span class="sub">' + esc(ui.adapter.label || '') + '</span></span>',
      '<button id="tm-aa-preflight" aria-label="运行时体检" title="运行时体检（确定性·免 API）：检查会影响加载的阻塞问题，随时可重跑">🩺</button><button id="tm-aa-newchat" aria-label="开始新对话" title="开始新对话（清空当前会话线程与消息·上一会话已入历史/记忆）">✎</button><button id="tm-aa-fs" aria-label="全屏或还原" title="全屏 / 还原">⛶</button><button id="tm-aa-x" aria-label="关闭" title="关闭">×</button></div>',
      '<div id="tm-aa-body">',
      '<div class="tm-aa-search" id="tm-aa-search" hidden><input type="text" id="tm-aa-search-in" placeholder="在结果里查找…"><span class="tm-aa-search-n" id="tm-aa-search-n">0/0</span><button type="button" id="tm-aa-search-prev" title="上一个">↑</button><button type="button" id="tm-aa-search-next" title="下一个">↓</button><button type="button" id="tm-aa-search-x" title="关闭 (Esc)">×</button></div>',
      '<div id="tm-aa-composer">',   // UI iteration2 · 输入区聚成一块（docked 下 sticky 钉底）
      '<div id="tm-aa-ctx" hidden></div>',
      '<div id="tm-aa-mentions" hidden></div>',
      '<div id="tm-aa-atpop" hidden></div>',
      '<div id="tm-aa-status" aria-live="polite"></div>',
      '<div id="tm-aa-worldkind"><span class="tm-aa-wk-lab">世界类型</span><button type="button" class="tm-aa-wk-opt" data-wk="historical" title="史实剧本·全考据：年号/生卒/职官/事件与正史相符，遇硬伤进谏">史实</button><button type="button" class="tm-aa-wk-opt" data-wk="fictional" title="虚构/架空世界观·奇幻/武侠/仙侠/未来/异世界等原创设定，不受真实历史约束，国师只管设定自洽与平衡">虚构</button></div>',
      '<div id="tm-aa-field">',
      '<textarea id="tm-aa-req" placeholder="描述你想要的修改，例如：把主角势力改名为「西凉军」并补两个文官"></textarea>',
      '<span class="tm-aa-charcount" id="tm-aa-charcount" hidden></span>',
      '<button id="tm-aa-go" title="Enter 发送 · Shift+Enter 换行" aria-label="发送">↑</button>',
      '</div>',
      '</div>',
      '<div id="tm-aa-meter" style="display:none"></div>',
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
      searchCount: panel.querySelector('#tm-aa-search-n')
    };
    panel.querySelector('#tm-aa-x').addEventListener('click', function() { if (panel._fs) _toggleFullscreen(); panel.classList.remove('open'); });
    var _nc = panel.querySelector('#tm-aa-newchat'); if (_nc) _nc.addEventListener('click', newConversation);   // 真·连续会话：另起新对话
    var _pf = panel.querySelector('#tm-aa-preflight'); if (_pf) _pf.addEventListener('click', function () { runPreflightUI(); });   // 常驻·运行时体检(确定性免API·随时重跑·不止空状态)
    if (ui.els.fs) ui.els.fs.addEventListener('click', _toggleFullscreen);   // UI·AI · 全屏切换
    _ensurePanelResize();   // UI·AI · 左缘拖拽调宽 + 载入持久宽度
    _ensureSearch();   // UI·AJ · 过程区内搜索（⌘F）
    _ensureCtxChip();   // N1 焦点上下文 chip
    _ensureAtMention();   // N3 @提及作用域上下文
    ui.els.go.addEventListener('click', onGoClick);   // UI·Q · 运行中此键=停止
    ui.els.apply.addEventListener('click', onApply);
    ui.els.discard.addEventListener('click', onDiscard);
    _ensureWorldKind();   // 刀2 · 世界类型选择器（史实/虚构）绑定 + 初始反映
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

  function setStatus(t) { if (ui.els) ui.els.status.textContent = t || ''; }

  // 方向I · 可观测性：运行中实时 token / 耗时 / 轮次计量条。
  function _fmtTok(n) { n = n || 0; return n >= 1000 ? (Math.round(n / 100) / 10) + 'k' : String(n); }
  function _renderMeter(done) {
    if (!ui.els || !ui.els.meter) return;
    if (!ui._runStart) { ui.els.meter.style.display = 'none'; return; }
    var sec = Math.round((Date.now() - ui._runStart) / 1000);
    var tok = ui._lastTokens || 0, iter = ui._lastIter || 0;
    ui.els.meter.style.display = '';
    ui.els.meter.textContent = (done ? '✓ 用时 ' : '⏱ ') + sec + 's · ' + (done ? '约 ' : '~') + _fmtTok(tok) + ' tokens' + (iter ? ' · ' + iter + ' 轮' : '');
  }
  // 集中管理运行态：切换 running/禁用生成键 + 启停实时计量
  function setRunning(on) {
    ui.running = on;
    ui._stopping = false;
    if (on && ui.els && ui.els.empty) ui.els.empty.style.display = 'none';   // UI·AD · 一跑就隐欢迎态
    // UI·Q · 运行中「生成」键变形为「■ 停止」(不禁用·桌面端范式)；收尾恢复「生成」
    if (ui.els && ui.els.go) { ui.els.go.disabled = false; ui.els.go.textContent = on ? '■' : '↑'; ui.els.go.setAttribute('aria-label', on ? '停止' : '发送'); ui.els.go.classList.toggle('stopbtn', on); }
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
    card.innerHTML = '<div class="reply-who"><span class="reply-ava">🧙</span><b>国师</b></div>'
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
  function _toggleFullscreen() {
    var p = ui.els && ui.els.panel; if (!p) return;
    if (p._fs) {
      p.style.cssText = p._fsPrev || ''; p._fs = false;
      if (ui.els.resize) ui.els.resize.style.display = '';
      if (ui.els.fs) ui.els.fs.textContent = '⛶';
    } else {
      p._fsPrev = p.style.cssText;
      p.style.position = 'fixed'; p.style.left = '14px'; p.style.top = '14px'; p.style.right = '14px'; p.style.bottom = '14px';
      p.style.width = 'auto'; p.style.height = 'auto'; p.style.maxWidth = 'none'; p.style.maxHeight = 'none'; p.style.zIndex = '100000';
      p._fs = true;
      if (ui.els.resize) ui.els.resize.style.display = 'none';
      if (ui.els.fs) ui.els.fs.textContent = '🗗';
    }
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
    { label: '🩺 体检（免 API）', act: 'preflight' },
    { label: '补齐缺失字段', fill: '请用 listGaps 找出游戏运行时必需但缺失的字段，逐一补齐，让剧本完整可玩；改完用 validateDraft 自查。' },
    { label: '校验并列问题', fill: '请用 validateDraft 全面校验本剧本，列出所有引用冲突、人口/区划不一致等问题（先只报告，不要改）。' },
    { label: '加 3 个人物', fill: '请新增 3 名贴合本剧本背景的人物：含姓名、势力归属、官职、性格与 AI 人格；势力名必须用剧本里已存在的势力。' },
    { label: '🔍 审阅出报告', act: 'review' },
    { label: '📖 讲解剧本', act: 'explain' },
    { label: '🏛️ 三堂会审', act: 'critics' }
  ];
  function _renderEmpty() {
    if (!ui.els || !ui.els.empty || ui._emptyBuilt) return;
    ui._emptyBuilt = true;
    var chips = _EMPTY_CHIPS.map(function(c, i) { return '<button type="button" class="emp-chip" data-i="' + i + '">' + esc(c.label) + '</button>'; }).join('');
    ui.els.empty.innerHTML = '<div class="emp-hi">🧙</div><div class="emp-title">国师在此</div><div class="emp-sub">把想改什么告诉国师，或试试：</div><div class="emp-chips">' + chips + '</div>';
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
  // 仅在「面板空闲、什么都没跑」时显示欢迎态
  function _syncEmpty() {
    if (!ui.els || !ui.els.empty) return;
    var blank = !ui.running
      && ui.els.logWrap.style.display === 'none'
      && ui.els.summary.style.display === 'none'
      && ui.els.actions.style.display === 'none'
      && !(ui.els.req && ui.els.req.value.trim());
    ui.els.empty.style.display = blank ? '' : 'none';
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
      html += '<div class="tm-aa-sug"><b>💡 建议记住的约定</b>' + sug.slice(0, 5).map(function(c, i) {
        return '<div class="sug-row"><span>' + esc(String(c).slice(0, 120)) + '</span><button type="button" class="sug-keep" data-i="' + i + '">记住</button></div>';
      }).join('') + '</div>';
    }
    ui.els.summary.innerHTML = html;
    ui.els.summary.style.display = '';
    Array.prototype.forEach.call(ui.els.summary.querySelectorAll('.sug-keep'), function(btn) {
      btn.addEventListener('click', function() {
        var idx = +btn.getAttribute('data-i'), conv = sug[idx];
        if (conv && AA && AA.saveConventions && AA.loadConventions) {
          var cur = AA.loadConventions(), lines = cur ? cur.split('\n') : [];
          if (lines.indexOf(conv) < 0) { lines.push(conv); AA.saveConventions(lines.join('\n')); }
          btn.textContent = '已记住 ✓'; btn.disabled = true;
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
      blk.innerHTML = '<summary class="tm-aa-think-sum">⚙ <span class="tk-label">执行中…</span></summary><div class="tm-aa-think-body"></div>';
      if (ui.els) ui.els.log.appendChild(blk);
      ui._thinkEl = blk; ui._thinkCount = 0;
    }
    return blk;
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
    line.textContent = '💭 ' + String(text).slice(0, 400);
    blk.querySelector('.tm-aa-think-body').appendChild(line);
    _bumpExecLabel(blk);
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
      case 'applyPush': return '新增一项到 ' + (_COLL_CN[i.path] || _friendlyPath(i.path)) + '：' + _shortVal(i.value);
      case 'removeEntity': return '删除 ' + _friendlyPath(i.path);
      case 'getField': return '查看 ' + _friendlyPath(i.path);
      case 'searchEntities': return '搜索 ' + (_COLL_CN[i.collection] || i.collection || '') + (i.query ? '「' + i.query + '」' : '');
      case 'globalSearch': return '🔎 全局检索「' + (i.query || '') + '」' + (r.total != null ? '（命中 ' + r.total + '）' : '');
      case 'findReferences': return '🔗 查引用「' + (i.name || '') + '」' + (r.exactCount != null ? '（精确 ' + r.exactCount + '·提及 ' + (r.mentionCount || 0) + '）' : '');
      case 'renameEntity': return '✎ 改名「' + (i.oldName || '') + '」→「' + (i.newName || '') + '」' + (r.changed != null ? '（联动 ' + r.changed + ' 处）' : '');
      case 'listCollection': return '浏览 ' + (_COLL_CN[i.collection] || i.collection || '') + (r.count != null ? '（共 ' + r.count + '）' : '');
      case 'describeSchema': return '查字段形状 ' + (i.kind || '(全部)');
      case 'listGaps': return '查规格缺口' + (r.requiredMissing ? '（必需缺 ' + r.requiredMissing.length + '）' : '');
      case 'validateDraft': return '校验' + (r.ok === false ? '：发现 ' + ((r.violations || []).length) + ' 处问题' : '：通过');
      case 'preflight': return '🩺 运行时体检' + (r.bootable === false ? '：' + ((r.blockers || []).length) + ' 处阻塞' : (r.bootable === true ? '：可运行' : ''));
      case 'bulkAdd': return '批量新增 ' + (r.added != null ? r.added : '') + ' 项到 ' + (_COLL_CN[i.collection] || i.collection || '');
      case 'multiEdit': return '一次改 ' + (r.applied != null ? r.applied : (i.edits || []).length) + ' 处';
      case 'note': return '📝 ' + _shortVal(i.text);
      case 'flagUncertain': return '⚠ 标记待核 ' + _friendlyPath(i.path) + (i.reason ? '（' + _shortVal(i.reason) + '）' : '');
      case 'recordConvention': return '📌 记下约定：' + _shortVal(i.convention);
      case 'finish': return '✓ 完成：' + (i.summary || '');
      default: return n + '(' + JSON.stringify(i).slice(0, 60) + ')';
    }
  }

  function appendLog(step) {
    if (!ui.els) return;
    if (step && step.tokensUsed != null) ui._lastTokens = step.tokensUsed;   // 方向I · 实时计量
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
    card.innerHTML = '<summary>#' + step.iteration + ' ' + esc(_friendlyStep(step)) + detail + '</summary>'
      + '<div class="tm-aa-step-body">'
      + (inputStr && inputStr !== '{}' ? '<div class="sb-row"><span class="sb-k">输入</span><pre>' + esc(inputStr.slice(0, 600)) + (inputStr.length > 600 ? '…' : '') + '</pre></div>' : '')
      + (resultStr && resultStr !== '{}' ? '<div class="sb-row"><span class="sb-k">结果</span><pre>' + esc(resultStr.slice(0, 600)) + (resultStr.length > 600 ? '…' : '') + '</pre></div>' : '')
      + '</div>';
    var body = execBlk.querySelector('.tm-aa-think-body'); if (body) body.appendChild(card); else ui.els.log.appendChild(card);
    _bumpExecLabel(execBlk);
    _logScrollMaybe();
  }

  // UI·X · 每条改动渲染成可【接受/拒绝】的 hunk（idx=在 diffs 数组里的稳定下标·拒绝集 ui._diffRejected）
  function _diffEntryHtml(d, uncReason, idx) {
    var p = _friendlyPath(d.path);
    var pj = '<span class="tm-aa-diff-jump" data-reveal-path="' + esc(d.path || '') + '" title="在折子里精确定位此处">' + esc(p) + '</span>';
    var warn = uncReason ? '<span class="tm-aa-unc">⚠ 待核：' + esc(uncReason) + '</span>' : '';
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
    return '改动预览 · 接受 ' + acc + '/' + diffs.length + ' 处' + (rej.size ? '（✗' + rej.size + '）' : '') + (totalUnc ? ' · ⚠ ' + totalUnc + ' 待核' : '');
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
      return '<div class="tm-aa-diff-group" data-group="' + esc(field) + '"><div class="tm-aa-diff-head"><b class="tm-aa-diff-jump" data-reveal-field="' + esc(field) + '" data-first-path="' + esc(firstPath) + '" title="在折子里定位此字段（跳首处改动）">' + esc(_COLL_CN[field] || field) + ' \u2197</b> <span style="color:#8f8a7e">(' + es.length + ' 处' + (gUnc ? ' · ⚠' + gUnc : '') + ')</span><button type="button" class="grp-tog" data-group-idxs="' + idxs.join(',') + '">' + (allRej ? '全收' : '全拒') + '</button></div>' + inner + '</div>';
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
    v.textContent = '⚠ 仍有 ' + report.violations.length + ' 项校验问题：' + report.violations.slice(0, 4).join('；');
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
    _appendGuoshiMsg('<span class="ai-who">🧙 国师 · 请教</span>要改得准，我需要先弄清几点：<div class="ai-qs">' + qs + '</div><div class="ai-hint">在下方输入框作答后发送即可继续</div>');
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
    var html = '<span class="ai-who">🧙 国师 · 进谏</span>'
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
    _appendUserMsg(focus || '🔍 审阅整个剧本', { kind: 'review', input: focus });   // UI·B 会话流 + UI·Y 重试派发
    ui.draft = AA.makeDraft(ui.adapter.getScenario());   // 只读快照（审阅不改它）
    ui.conversation = null; ui._pendingPlan = false;
    setRunning(true);
    setStatus('正在审阅剧本…（agent 只读巡查，出体检报告，可能需要数十秒）');
    AA.runAuthoringLoop(ui.draft, focus, {
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
    _appendUserMsg(focus || '📖 讲解剧本', { kind: 'explain', input: focus });   // UI·B 会话流 + UI·Y 重试派发
    ui.draft = AA.makeDraft(ui.adapter.getScenario());   // 只读快照
    ui.conversation = null; ui._pendingPlan = false; ui._pendingClarify = false;
    setRunning(true);
    setStatus('正在通读剧本并讲解…（只读，不改剧本）');
    AA.runAuthoringLoop(ui.draft, focus, {
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
      + '<div class="ec-head">⚠ 运行失败</div>'
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
      _clEl.innerHTML = '<div class="cl-head">🧩 分解为 ' + _clSteps.length + ' 个子任务' + (allDone ? '（已完成）' : '') + '</div>' + _clSteps.map(function(s, k) {
        var st = (allDone || k < currentIdx) ? 'done' : (k === currentIdx ? 'run' : 'pend');
        var ic = st === 'done' ? '✓' : (st === 'run' ? '⟳' : '○');
        return '<div class="cl-item ' + st + '"><span class="cl-ic">' + ic + '</span>' + esc((k + 1) + '. ' + s) + '</div>';
      }).join('');
    }
    AA.runOrchestrated(ui.draft, request, {
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
    if (ui.els && ui.els.go && !ui.running) { ui.els.go.textContent = '🏛'; ui.els.go.title = '三堂会审：拟稿→史官查史+谏官批平衡→据谏修订'; }
    if (ui.els && ui.els.req) { ui.els.req.placeholder = '【三堂会审】写下要新增/修改什么——国师拟稿，再由史官查史实、谏官批平衡，据谏修订后交你审'; ui.els.req.focus(); }
    setStatus('已开启三堂会审 · 写下需求后点发送：拟稿 → 史官+谏官会审 → 据谏修订（比普通生成多 2~3 次调用）');
  }
  function _disarmCriticsVisual() {
    ui._criticsArmed = false;
    if (ui.els && ui.els.go && !ui.running) { ui.els.go.textContent = '↑'; ui.els.go.title = 'Enter 发送 · Shift+Enter 换行'; }
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
      _el.innerHTML = '<div class="cl-head">🏛 三堂会审' + (done ? '（已完成）' : '') + '</div>'
        + row(_phase.draft, '① 国师拟稿') + row(_phase.review, '② 史官查史实 + 谏官批平衡' + rv) + row(_phase.revise, '③ 国师据谏修订');
    }
    _render(false);
    AA.runWithCritics(ui.draft, request, {
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
      var head = '<div class="cl-head">' + icon + ' ' + title + '（' + fs.length + ' 条' + (rev && rev.summary ? '·' + esc(rev.summary) : '') + '）</div>';
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
    ui.els.summary.innerHTML = '<b>🏛 三堂会审报告</b><span class="tm-aa-stream">' + esc(res.summary || '') + '</span>'
      + block('📜', '史官·史实核查', hist) + block('⚖', '谏官·平衡可玩', bal)
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
    resetResults(continuing);   // UI·B · 会话流：续接保留线程+消息流、新对话清空
    _appendUserMsg(request);    // 回显用户消息气泡
    setRunning(true);
    setStatus(planOnly ? '正在规划…（agent 先只读、出计划）' : '正在生成…（agent 多轮编辑+自校验，可能需要数十秒）');
    if (!continuing) { ui.draft = AA.makeDraft(ui.adapter.getScenario()); if (!planOnly) ui.conversation = null; }
    else if (!ui.draft) { ui.draft = AA.makeDraft(ui.adapter.getScenario()); }   // 续接但上轮已应用 → 从当前(已更新)剧本新建 draft，对话线程保留

    AA.runAuthoringLoop(ui.draft, request, {
      planOnly: planOnly,
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
      ui.draft = null; ui.conversation = null;
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
      ui.draft = null; ui.conversation = null;
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
    fab.textContent = '🧙 国师';
    fab.addEventListener('click', function() {
      var p = ensurePanel();
      p.classList.toggle('open');
      if (p.classList.contains('open')) { _syncEmpty(); _reflectWorldKind(); }   // UI·AD · 开面板时按需显欢迎态 + 反映当前世界类型
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
  global.TM_AuthoringAgentUI = { init: init, _ui: ui, undo: undoLastApply, stop: onStop, review: runReview, orchestrate: runOrchestratedUI, preflight: runPreflightUI, qa: runQaUI, explain: runExplainUI, checkpoint: manualCheckpoint, checkpoints: listCheckpoints, restore: restoreCheckpoint, history: listHistory, clearHistory: clearHistory, changelog: buildChangelog, runChangelog: runChangelogUI, macros: listMacros, saveMacro: saveMacro, deleteMacro: deleteMacro, applyMacro: applyMacro, exportBundle: exportBundle, importBundle: importBundle };
})(typeof window !== 'undefined' ? window : this);
