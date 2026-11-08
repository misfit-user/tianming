// 断处续：中转把长回答掐断时，把半截原样交回去请模型接着写，拼成完整 JSON 再交原来的解析。
// 11-08 同志定（设计稿 docs/llm-duanchu-xu-20261108.md）：
//   · 回合里所有 JSON 子调用都加（接在 tm-endturn-ai.js 的 _callEndturnAI，拿到回答后、解析前）；
//   · 默认开，P.conf.aiContinueOnCut === false 才关（设置面板有开关）；
//   · 同一次调用最多接 3 次，拼不出完整 JSON 就照旧走拒收、救援、中止。
// 判「被掐」只看回答本身：JSON 开了头没收尾，不论中转报的结束原因
// （11-08 新中转把掐断报成 stop：主推演 18241 token，JSON 停在「阻止东林」半句）。
// 已写的部分写坏了（括号对不上、引号没转义）不算被掐：接着写拼不出能解析的 JSON，交原来的修复与重试。
// 本模块只做文本与请求体，不写 GM/P；真正发请求由调用方传入的 fetch 做。
(function(root) {
  'use strict';
  var TM = root.TM = root.TM || {};
  if (TM.AIContinuation) return;

  var MAX_LINKS = 3;
  var OVERLAP_MIN = 4, OVERLAP_MAX = 400;

  function enabled() {
    var P = root.P;
    return !(P && P.conf && P.conf.aiContinueOnCut === false);
  }

  // 去掉开头的代码块标记（```json）；结尾的 ``` 只在 JSON 已收尾时才算标记
  function stripLeadFence(text) {
    return String(text || '').replace(/^\s*```[a-zA-Z]*[ \t]*\r?\n?/, '');
  }
  function stripFences(text) {
    return stripLeadFence(text).replace(/\r?\n?```\s*$/, '');
  }

  // 字符串收尾的引号后面（跳过空白）只会是 , : } ] 或到头；别的字跟着的，是模型没转义的引号，仍在字符串里
  function quoteEnds(t, i) {
    var j = i + 1;
    while (j < t.length && (t[j] === ' ' || t[j] === '\n' || t[j] === '\r' || t[j] === '\t')) j++;
    return j >= t.length || ',:}]'.indexOf(t[j]) >= 0;
  }

  // 从第一个 { 或 [ 起扫一遍：栈（每层记着当前这个元素从哪里起：括号之后或最近一个逗号之后）、是否在字符串里、收尾的位置。
  // 写坏了的另记两种（11-08 auto-1108-1921 真遇，都不是被掐）：
  //   bad：括号对不上（统筹思考写成 "moves":[[]}}）；
  //   loose：字符串里有没转义的引号（主推演写成 …-->"</tableEdit>"）。
  function scan(text) {
    var t = String(text || '');
    var start = -1;
    for (var s = 0; s < t.length; s++) { var c0 = t[s]; if (c0 === '{' || c0 === '[') { start = s; break; } if (!/\s/.test(c0)) break; }
    var res = { start: start, stack: [], open: [], inStr: false, esc: false, closedAt: -1, bad: false, loose: false };
    if (start < 0) return res;
    for (var i = start; i < t.length; i++) {
      var c = t[i];
      if (res.inStr) {
        if (res.esc) { res.esc = false; continue; }
        if (c === '\\') { res.esc = true; continue; }
        if (c === '"') { if (quoteEnds(t, i)) res.inStr = false; else res.loose = true; }
        continue;
      }
      if (c === '"') { res.inStr = true; continue; }
      if (c === '{' || c === '[') { res.stack.push(c); res.open.push({ ch: c, elemStart: i + 1 }); }
      else if (c === '}' || c === ']') {
        if (res.stack[res.stack.length - 1] !== (c === '}' ? '{' : '[')) { res.bad = true; break; }
        res.stack.pop(); res.open.pop();
        if (!res.stack.length) { res.closedAt = i; break; }
      } else if (c === ',' && res.open.length) res.open[res.open.length - 1].elemStart = i + 1;
    }
    return res;
  }

  // 被掐：回答是 JSON（去掉代码块标记后以 { 或 [ 开头）、没收尾，而且已写的部分没写坏（补上括号就能解析）。
  // 写坏了的（括号对不上、引号没转义）接着写也拼不出能解析的 JSON，不接，交原来的修复与重试。
  function isCut(text) {
    var t = stripLeadFence(text);
    var s = scan(t);
    return s.start >= 0 && s.closedAt < 0 && !s.bad && !s.loose && closable(t);
  }

  function parses(text) {
    try { JSON.parse(stripFences(text).trim()); return true; } catch (_) { return false; }
  }

  // 半截能不能「补上括号」就解析：用来判断已写的部分没写坏、在几种拼法里挑结构没坏的那种（不拿补出来的结果当答案）。
  // 断处可能在值里、键里、冒号后、逗号后、转义符或 true/数字的半中间，几种收法都试一下，有一种能解析就算结构没坏。
  function closable(text) {
    var t = stripLeadFence(text);
    var s = scan(t);
    if (s.start < 0 || s.bad || s.loose) return false;
    if (s.closedAt >= 0) { try { JSON.parse(t.slice(s.start, s.closedAt + 1)); return true; } catch (_) { return false; } }
    var closers = '';
    for (var i = s.stack.length - 1; i >= 0; i--) closers += s.stack[i] === '{' ? '}' : ']';
    var base = t.replace(/\s+$/, '');
    var tries;
    if (s.inStr) {
      var b = s.esc ? base.slice(0, -1) : base.replace(/\\u[0-9a-fA-F]{0,3}$/, '');
      tries = [base + '"', base + '":null', b + '"', b + '":null'];
    } else {
      tries = [base.replace(/,$/, ''), base + 'null', base + ':null',
        base.replace(/[A-Za-z]+$/, '') + 'null', base.replace(/[-+.eE]+$/, ''), base.replace(/[-+.eE]+$/, '') + 'null'];
    }
    for (var j = 0; j < tries.length; j++) {
      try { JSON.parse(tries[j] + closers); return true; } catch (_) {}
    }
    return false;
  }

  function tailHint(text) {
    var t = String(text || '').replace(/\s+/g, ' ');
    return t.slice(-30);
  }

  // 接着写的请求：原消息不动，加助手（半截原文）与用户（接着写）两条；去掉 response_format
  // （json_object / json_schema 要模型写出一个完整对象，它就写不出后半截）
  function buildBody(body, carry) {
    var out = {};
    for (var k in body) if (Object.prototype.hasOwnProperty.call(body, k)) out[k] = body[k];
    delete out.response_format;
    out.stream = false;
    out.messages = (body.messages || []).slice().concat([
      { role: 'assistant', content: carry },
      { role: 'user', content: '你上一条回答在「' + tailHint(carry) + '」处被截断了。请紧接着最后一个字符往下写，把这个 JSON 写完：不要重复已写的内容，不要从头开始，不要加任何解释或代码块标记。' }
    ]);
    return out;
  }

  // 拼：依次试 ①从头重写了整个 JSON ②去重叠直接接 ③退回到半截里最后一个完整元素之后再接；挑结构没坏的
  function stitch(carry, piece) {
    var p = stripLeadFence(piece);
    var pt = p.replace(/^\s+/, '');
    var c = String(carry || '');
    var cs = scan(stripLeadFence(c));
    // ① 续写自己是一个以 { 开头的 JSON，且和半截同一个开头（第一个键相同）：它从头重写了
    if (pt.charAt(0) === '{' && cs.start >= 0) {
      var firstKey = function(x) { var m = String(x).match(/^\s*\{\s*"([^"]{1,60})"/); return m ? m[1] : ''; };
      var ck = firstKey(stripLeadFence(c));
      if (ck && firstKey(pt) === ck && closable(pt)) return { text: pt, how: 'restart', overlap: 0 };
    }
    // ② 去重叠：续写开头原样重复了半截末尾 4～400 字
    var k = Math.min(OVERLAP_MAX, c.length, p.length), overlap = 0;
    for (; k >= OVERLAP_MIN; k--) if (c.slice(-k) === p.slice(0, k)) { overlap = k; break; }
    var joined = c + p.slice(overlap);
    if (closable(joined)) return { text: joined, how: overlap ? 'overlap' : 'direct', overlap: overlap };
    // ③ 退回：断在一个元素的半中间、续写把这个元素从头重写了——退到被重写的那个元素开头再接。
    //    续写以「"键":」开头，重写的是对象里的一项：退到最里层未收尾的对象里当前这一项的开头；
    //    以 { [ 或值开头，重写的是数组里的一个元素：退到最里层未收尾的数组里当前这个元素的开头。
    //    只认这一种对应：不是键的续写退进对象，会被当成一个新键（11-08 实遇「"]}}」被收成 "]}}":null）。
    if (cs.start >= 0 && cs.closedAt < 0 && !cs.bad && !cs.loose) {
      var src = stripLeadFence(c);
      var want = /^"(?:[^"\\]|\\.)*"\s*:/.test(pt) ? '{' : '[';
      for (var li = cs.open.length - 1; li >= 0; li--) {
        if (cs.open[li].ch !== want) continue;
        var back = src.slice(0, cs.open[li].elemStart).replace(/\s+$/, '') + '\n' + pt;
        if (closable(back)) return { text: back, how: 'backoff', overlap: 0 };
        break;
      }
    }
    return { text: joined, how: overlap ? 'overlap' : 'direct', overlap: overlap, broken: true };
  }

  function contentOf(data) {
    var ch = data && data.choices && data.choices[0];
    return ch && ch.message && typeof ch.message.content === 'string' ? ch.message.content : '';
  }
  function finishOf(data) {
    var ch = data && data.choices && data.choices[0];
    return ch ? (ch.finish_reason || ch.stop_reason || '') : '';
  }

  var recent = [];
  function remember(row) { recent.push(row); if (recent.length > 30) recent.shift(); }

  // 接到完整为止（最多 3 次）。spec：{ body, raw, id, label, fetch(body, n) → data, onLink(n), deadlineAt }
  // 返回 { ok, text, links, pieces, err }；ok 为真时 text 是能解析的完整 JSON（去掉代码块标记与 JSON 之后的闲话）
  async function run(spec) {
    var carry = String(spec.raw || '');
    var pieces = [], links = 0, err = '', empties = 0;
    while (links < MAX_LINKS && isCut(carry)) {
      if (Number.isFinite(spec.deadlineAt) && Date.now() >= spec.deadlineAt) { err = 'deadline'; break; }
      links++;
      if (typeof spec.onLink === 'function') { try { spec.onLink(links); } catch (_) {} }
      var data;
      try { data = await spec.fetch(buildBody(spec.body, carry), links); }
      catch (e) { err = String((e && (e.code || e.message)) || e); break; }
      var piece = contentOf(data);
      // 续写回空：中转偶尔回空（11-08 实遇），再试一次；第二次还空就不接了（思考把时间耗光、正文没写的，接也接不出来）
      if (!piece.trim()) { pieces.push({ chars: 0, finish: finishOf(data), how: 'empty' }); if (++empties >= 2) { err = 'empty'; break; } continue; }
      var st = stitch(carry, piece);
      pieces.push({ chars: piece.length, finish: finishOf(data), how: st.how, overlap: st.overlap, broken: !!st.broken });
      carry = st.text;
      // 拼坏了（几种拼法结构都不对）：后面再接也救不回中段，停下交原来的路
      if (st.broken) { err = 'broken'; break; }
    }
    var ok = false, text = carry;
    if (!isCut(carry)) {
      var t = stripLeadFence(carry), s = scan(t);
      if (s.start >= 0 && s.closedAt >= 0) {
        var body = t.slice(s.start, s.closedAt + 1);
        if (parses(body)) { ok = true; text = body; }
      }
    }
    remember({ id: spec.id || '', label: spec.label || '', at: Date.now(), links: links, ok: ok, rawChars: String(spec.raw || '').length, chars: text.length, pieces: pieces, err: err });
    return { ok: ok, text: text, links: links, pieces: pieces, err: err };
  }

  // 回合推演的接线（tm-endturn-ai.js 的 _callEndturnAI，及主推演流式那条路）：
  // 回答是 JSON 却没收尾就接着写；拼出完整 JSON 才就地写回原 data 对象（应急恢复的记账认这个对象），拼不出原样返回，照旧拒收、救援。
  // 接着写的请求另开记账（不带原调用的重试票，id 记成「sc1:cont1」），不占普通重试次数。返回（可能换过的）正文。
  // o：{ id, label, url, key, tier, priority, timeoutMs, signal, deadlineAt }
  async function continueIfCut(body, data, raw, o) {
    o = o || {};
    if (!raw || !data || !data.choices || !data.choices[0] || !data.choices[0].message) return raw;
    if (!enabled() || !isCut(raw) || typeof root._aiFetchWithRetry !== 'function' || !o.url) return raw;
    var name = o.label || o.id || '回答';
    try { var cat = TM.CallRetryPolicy && TM.CallRetryPolicy.catalog ? TM.CallRetryPolicy.catalog() : []; for (var ci = 0; ci < cat.length; ci++) if (cat[ci].id === o.id) name = cat[ci].label; } catch (_) {}
    var P = root.P;
    // 加载提示：接着写时换成「正在从断处接着写」，接完（成没成都一样）还给原来那句——
    // 拼不成时游戏会整次重来，别让这句一直挂着（11-08 实遇挂了 4 分多钟）；别的调用改过提示就不动
    var subEl = null, prevMsg = '', lastMsg = '';
    try { subEl = root.document && root.document.getElementById ? root.document.getElementById('loading-sub') : null; prevMsg = subEl ? String(subEl.textContent || '') : ''; } catch (_) {}
    var cont = await run({
      body: body, raw: raw, id: o.id || '', label: name, deadlineAt: o.deadlineAt,
      onLink: function(n) { lastMsg = name + '被中转截断，正在从断处接着写（第' + n + '次）'; if (typeof root.showLoading === 'function') root.showLoading(lastMsg); },
      fetch: async function(contBody, n) {
        var contData = await root._aiFetchWithRetry(o.url, contBody, o.signal || null, { apiKey: o.key || (P && P.ai && P.ai.key), tier: o.tier || 'primary', priority: o.priority || 'normal', timeoutMs: o.timeoutMs, maxRetries: 1, id: (o.id || 'endturn') + ':cont' + n });
        if (contData && contData.usage && root.TokenUsageTracker) root.TokenUsageTracker.record(contData.usage, (o.id || 'endturn') + ':cont');
        return contData;
      }
    });
    try { if (lastMsg && prevMsg && subEl && String(subEl.textContent || '') === lastMsg && typeof root.showLoading === 'function') root.showLoading(prevMsg); } catch (_) {}
    if (typeof root.recordAIDiagnostic === 'function') root.recordAIDiagnostic('continuation', { id: o.id || '', label: name, ok: cont.ok, links: cont.links, raw_len: String(raw).length, len: cont.text.length, err: cont.err || '' });
    if (!cont.ok) return raw;
    data.choices[0].message.content = cont.text;
    data.choices[0].finish_reason = 'stop';
    return cont.text;
  }

  TM.AIContinuation = {
    MAX_LINKS: MAX_LINKS,
    enabled: enabled,
    isCut: isCut,
    closable: closable,
    buildBody: buildBody,
    stitch: stitch,
    run: run,
    continueIfCut: continueIfCut,
    recent: function() { return recent.slice(); }
  };
})(typeof window !== 'undefined' ? window : globalThis);
