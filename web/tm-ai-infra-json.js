// @ts-check
/// <reference path="types.d.ts" />
// tm-ai-infra-json.js — strict bounded JSON recovery shared by all AI transports.
// Loaded after tm-utils and immediately before tm-ai-infra.js.

function robustParseJSON(raw) {
  if (!raw) return null;

  function _balancedJsonAt(text, start) {
    var opener = text[start];
    if (opener !== '{' && opener !== '[') return null;
    var stack = [], inString = false, escaped = false;
    for (var bi = start; bi < text.length; bi++) {
      var bc = text[bi];
      if (escaped) { escaped = false; continue; }
      if (bc === '\\') { escaped = true; continue; }
      if (bc === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (bc === '{' || bc === '[') stack.push(bc);
      else if (bc === '}' || bc === ']') {
        var expected = bc === '}' ? '{' : '[';
        if (!stack.length || stack.pop() !== expected) return null;
        if (!stack.length) return { end: bi, text: text.slice(start, bi + 1) };
      }
    }
    return null;
  }

  function _hasAmbiguousSecondJson(text, after) {
    for (var si = after; si < text.length; si++) {
      if (text[si] !== '{' && text[si] !== '[') continue;
      var second = _balancedJsonAt(text, si);
      if (!second) continue;
      try { JSON.parse(second.text); return true; } catch (_) { si = second.end; }
    }
    return false;
  }

  // 2026-06-07·超大响应 OOM 护栏。
  // 下面的多层修复每步都对整段 raw 做正则 .replace()(全量复制字符串·一次解析约 10~15× raw 的瞬时分配)。
  // 模型复读/代理失控可吐出数 MB 的 raw·回合「深度推演」阶段 20+ 个 AI 子调用并发各跑一遍·
  // 瞬时分配叠加可把 Electron 渲染进程内存撑爆 → 深推时突然黑屏、必须重启 App。
  // 合法子调用响应 ≤8000 tokens(数十 KB)·故超过上限者一律视为失控:只做一次零/低拷贝直解·失败即放弃(交上层截断重修)·绝不进多拷贝修复风暴。
  // 2026-06-11·安卓 WebView 小堆·解析上限同步收紧(多层正则修复每步全量复制 raw·安卓上更易爆)。合法子调用仅几十 KB。
  var _rpjIsCap = (function(){ try { if (typeof window !== 'undefined' && window.TM && window.TM.platform && window.TM.platform.kind) return window.TM.platform.kind === 'capacitor'; return !!(typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()); } catch(_) { return false; } })();
  var MAX_PARSE_LEN = _rpjIsCap ? 262144 : 500000; // 安卓~256KB·桌面~500KB·均远超任何合法子调用·远低于致 OOM 量级
  if (raw.length > MAX_PARSE_LEN) {
    try { if (typeof _dbg === 'function') _dbg('[robustParseJSON] 响应过大 ' + raw.length + ' 字符·跳过多层修复防 OOM'); } catch (_) {}
    try { return JSON.parse(raw); } catch (_e0) {}
    try {
      var _objS = raw.indexOf('{'), _arrS = raw.indexOf('[');
      var _s = _objS >= 0 && (_arrS < 0 || _objS < _arrS) ? _objS : _arrS;
      var _first = _s >= 0 ? _balancedJsonAt(raw, _s) : null;
      if (_first && !_hasAmbiguousSecondJson(raw, _first.end + 1)) return JSON.parse(_first.text);
    } catch (_e1) {}
    return null;
  }

  // Layer 1: 去掉 markdown 代码块后直接解析
  var cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  try { return JSON.parse(cleaned); } catch(e) {}

  // Layer 2: 提取最外层 { } 或 [ ] 块
  var objStart = cleaned.indexOf('{');
  var arrStart = cleaned.indexOf('[');
  var start = -1, openChar = '', closeChar = '';
  if (objStart >= 0 && (arrStart < 0 || objStart < arrStart)) { start = objStart; openChar = '{'; closeChar = '}'; }
  else if (arrStart >= 0) { start = arrStart; openChar = '['; closeChar = ']'; }
  if (start >= 0) {
    var depth = 0, end = -1, inStr = false, esc = false;
    for (var i = start; i < cleaned.length; i++) {
      var c = cleaned[i];
      if (esc) { esc = false; continue; }
      if (c === '\\') { esc = true; continue; }
      if (c === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (c === openChar) depth++;
      if (c === closeChar) depth--;
      if (depth === 0) { end = i; break; }
    }
    if (end > start) {
      var substr = cleaned.substring(start, end + 1);
      // 两个并列 JSON 对象/数组没有唯一语义；禁止旧贪婪逻辑把它们拼成一块，
      // 也禁止静默只取第一个后继续落账。
      if (_hasAmbiguousSecondJson(cleaned, end + 1)) {
        console.warn('[robustParseJSON] ambiguous multiple top-level JSON values');
        return null;
      }
      // Layer 2a: 直接尝试
      try { return JSON.parse(substr); } catch(e2) {}
      // Layer 2b: 修复尾逗号
      var fixed = substr.replace(/,\s*([}\]])/g, '$1');
      try { return JSON.parse(fixed); } catch(e3) {}
      // Layer 2c: 修复中文引号
      fixed = fixed.replace(/\u201c|\u201d/g, '"').replace(/\u2018|\u2019/g, "'").replace(/'/g, '"');
      try { return JSON.parse(fixed); } catch(e4) {}
      // Layer 2d: 修复未转义换行符
      fixed = fixed.replace(/(?<!\\)\n/g, '\\n').replace(/(?<!\\)\r/g, '\\r').replace(/(?<!\\)\t/g, '\\t');
      try { return JSON.parse(fixed); } catch(e5) {}
      // Phase 1 C-1·Layer 2.5·jsonrepair-style 强化 (项目零依赖·内嵌实现)
      // 应对·max_tokens 截断的尾部不完整 / 字符串内部含未转义引号 / 缺逗号 / 多余逗号
      try {
        var rep = fixed;
        // 1·删 ASCII 控制字符 (除 \t \n \r 已 escape)
        rep = rep.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
        // 2·`}{` / `]{` / `}[` / `][` 之间缺逗号·插入
        rep = rep.replace(/\}(\s*)\{/g, '},$1{').replace(/\](\s*)\[/g, '],$1[').replace(/\}(\s*)\[/g, '},$1[').replace(/\](\s*)\{/g, '],$1{');
        // 3·删重复逗号 `,,` 与 `,]` `,}`·已在 Layer 2b 部分处理·再扫一遍
        rep = rep.replace(/,\s*,+/g, ',').replace(/,\s*([}\]])/g, '$1');
        try { return JSON.parse(rep); } catch(e6) {}
        // 4·闭合不匹配的 } / ]·扫从前到后括号深度·结尾补 missing closers
        var stack25 = [], inStr25 = false, esc25 = false;
        for (var j = 0; j < rep.length; j++) {
          var ch = rep[j];
          if (esc25) { esc25 = false; continue; }
          if (ch === '\\') { esc25 = true; continue; }
          if (ch === '"') { inStr25 = !inStr25; continue; }
          if (inStr25) continue;
          if (ch === '{' || ch === '[') stack25.push(ch);
          else if (ch === '}' || ch === ']') stack25.pop();
        }
        var tail25 = rep;
        if (inStr25) tail25 += '"';  // 截断在字符串中间·闭合
        while (stack25.length) {
          var open25 = stack25.pop();
          tail25 += (open25 === '{') ? '}' : ']';
        }
        // 修补 trailing comma 后再 parse
        tail25 = tail25.replace(/,\s*([}\]])/g, '$1');
        try { return JSON.parse(tail25); } catch(e7) {}
      } catch(e25) {}
    }
  }

  // Layer 2.6·Layer 2 完全失败 (end<0·没闭合 brace)·从 start 截到末尾·按栈补全
  // 应对·AI 完全没写收尾·`{"events":[{"type":"war"` 这种最严重的 max_tokens 截断
  if (start >= 0) {
    try {
      var trunc = cleaned.substring(start);
      var stack26 = [], inStr26 = false, esc26 = false;
      for (var k = 0; k < trunc.length; k++) {
        var c26 = trunc[k];
        if (esc26) { esc26 = false; continue; }
        if (c26 === '\\') { esc26 = true; continue; }
        if (c26 === '"') { inStr26 = !inStr26; continue; }
        if (inStr26) continue;
        if (c26 === '{' || c26 === '[') stack26.push(c26);
        else if (c26 === '}' || c26 === ']') stack26.pop();
      }
      var tail26 = trunc;
      if (inStr26) tail26 += '"';
      // 若最后是 `,` 或 `:` 后无值·补 null
      tail26 = tail26.replace(/,\s*$/, '').replace(/:\s*$/, ':null');
      while (stack26.length) {
        var open26 = stack26.pop();
        tail26 += (open26 === '{') ? '}' : ']';
      }
      tail26 = tail26.replace(/,\s*([}\]])/g, '$1');
      try { return JSON.parse(tail26); } catch(e26b) {}
    } catch(e26a) {}
  }

  // Layer 3: 按关键字段分段提取（适用于 AI 返回的半结构化文本）
  try {
    var result = {};
    var fieldPatterns = [
      { key: 'shizhengji', pattern: /["']?shizhengji["']?\s*[:：]\s*["']([\s\S]*?)["']\s*[,}\n]/ },
      { key: 'zhengwen', pattern: /["']?zhengwen["']?\s*[:：]\s*["']([\s\S]*?)["']\s*[,}\n]/ },
      { key: 'player_status', pattern: /["']?player_status["']?\s*[:：]\s*["']([\s\S]*?)["']\s*[,}\n]/ },
      { key: 'player_inner', pattern: /["']?player_inner["']?\s*[:：]\s*["']([\s\S]*?)["']\s*[,}\n]/ }
    ];
    var found = false;
    fieldPatterns.forEach(function(fp) {
      var m = cleaned.match(fp.pattern);
      if (m && m[1]) { result[fp.key] = m[1].trim(); found = true; }
    });
    if (found) return result;
  } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-utils');}catch(_){}}

  // Layer 4: 纯文本回退
  if (cleaned.length > 20) {
    console.warn('[robustParseJSON] 所有修复层级失败，使用纯文本回退');
    return { zhengwen: cleaned.substring(0, 2000), shizhengji: '', player_status: '' };
  }

  return null;
}
