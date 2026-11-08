(function(root) {
  'use strict';
  // 地图编辑器里的国师（2026-10-15 国师重做 S6）：与剧本工坊的国师同一身「漆案金线」、同一套模型设置与工具循环。
  //   对话流：你说的话在右，国师的回复在左（朱印「师」）；「思考与查阅」里一步步列出它查了什么、改了哪几块；
  //   「实时显示」与工坊共用一个开关（tm_aa_stream），开着时国师边想边说；改了地图的回复下面直接给「撤销这次」。
  //   外部契约照旧：#me-guoshi / #me-guoshi-launcher / #me-guoshi-request，data-role 与 data-action 的名字不变。
  var SVG_SEND = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var SVG_STOP = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><rect x="4" y="4" width="8" height="8" rx="1.5" fill="currentColor"/></svg>';
  var STREAM_OFF_KEY = 'tm_aa_stream_off';
  var TIER_CN = { all: '三级全套', realm: '国', region: '路/省', prefecture: '府州' };
  var DRAFT_CN = { listScenarioMaps: '查剧本地图', loadScenarioMap: '载入剧本地图', mapEditorOverview: '检索地块', mapEditorRead: '读取地块', mapEditorFocus: '定位地块', mapEditorEdit: '改地块', mapEditorMoveVertex: '挪边界顶点', note: '记一笔', todoWrite: '任务清单', askClarification: '向你请教' };
  var EXAMPLES = [
    { t: '按史实改名选中的地块', fill: '把选中的地块按史实改名，并说明依据。' },
    { t: '列出府州（仅查看）', fill: '这张图上一共有哪些府州？按所属势力列出来。', ro: true },
    { t: '载入剧本地图再改名', fill: '使用绍宋剧本的三级地图，把开封府改名为汴京。' }
  ];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function nowHM() {
    var d = new Date(), p = function(n) { return (n < 10 ? '0' : '') + n; };
    return p(d.getHours()) + ':' + p(d.getMinutes());
  }

  function mount() {
    var ME = root.TM && root.TM.MapEditor, AA = root.TM && root.TM.AuthoringAgent;
    if (!ME || !ME.agent || document.getElementById('me-guoshi')) return;

    var launcher = document.createElement('button');
    launcher.id = 'me-guoshi-launcher'; launcher.type = 'button';
    launcher.innerHTML = '<span class="mg-seal">师</span>国师';
    launcher.setAttribute('aria-controls', 'me-guoshi'); launcher.setAttribute('aria-expanded', 'false');

    var panel = document.createElement('section');
    panel.id = 'me-guoshi'; panel.hidden = true;
    panel.setAttribute('aria-label', '国师地图助手');
    panel.innerHTML =
      '<header class="mg-head"><span class="mg-seal">师</span><div class="mg-title"><b>国师</b><small>地图</small></div><span class="mg-flex"></span>'
      + '<span class="mg-model" data-role="model"></span>'
      + '<button type="button" class="mg-icon" data-action="close" aria-label="收起国师" title="收起（Esc）">×</button></header>'
      + '<div class="mg-sel" data-role="selection"></div>'
      + '<div class="mg-feed" data-role="log" role="log" aria-live="polite"></div>'
      + '<form class="mg-composer"><label class="mg-sr" for="me-guoshi-request">地图指令</label><div class="mg-field">'
      + '<textarea id="me-guoshi-request" rows="2" maxlength="8000" placeholder="跟国师说要改哪几块、改成什么（Enter 发送，Shift+Enter 换行）"></textarea>'
      + '<div class="mg-bar"><label class="mg-ro" title="只读地图、回答问题，不改任何地块"><input type="checkbox" data-role="readonly"><span class="mg-sw" aria-hidden="true"></span>仅查看</label>'
      + '<span class="mg-flex"></span>'
      + '<button type="button" class="mg-ghost" data-action="undo" disabled title="撤销国师上一次对地图的修改">撤销上次</button>'
      + '<button type="button" class="mg-go mg-stopbtn" data-action="stop" disabled hidden aria-label="停止" title="停下（Esc），这次的修改不会应用">' + SVG_STOP + '</button>'
      + '<button type="submit" class="mg-go" aria-label="发送" title="发送（Enter）">' + SVG_SEND + '</button></div></div></form>'
      + '<p class="mg-status" data-role="status" role="status">复用国师的模型设置</p>';
    document.body.appendChild(launcher); document.body.appendChild(panel);

    var get = function(s) { return panel.querySelector(s); };
    var log = get('[data-role="log"]'), status = get('[data-role="status"]');
    var input = get('textarea'), send = get('[type="submit"]'), stop = get('[data-action="stop"]'), undo = get('[data-action="undo"]');
    var readonly = get('[data-role="readonly"]');
    var R = null;   // 正在写的这张回复

    function cfgNow() { try { return AA.loadEditorApiConfig() || {}; } catch (e) { return {}; } }
    function lineKey(cfg) { return String(cfg.url || '') + '|' + String(cfg.model || ''); }
    function streamOn() {
      try {
        if (localStorage.getItem('tm_aa_stream') === '0') return false;
        var off = JSON.parse(localStorage.getItem(STREAM_OFF_KEY) || '{}') || {};
        return !off[lineKey(cfgNow())];
      } catch (e) { return true; }
    }
    function showThinking() { try { return localStorage.getItem('tm_aa_show_thinking') !== '0'; } catch (e) { return true; } }
    function rememberStreamOff() {
      try {
        var off = JSON.parse(localStorage.getItem(STREAM_OFF_KEY) || '{}') || {};
        off[lineKey(cfgNow())] = Date.now();
        localStorage.setItem(STREAM_OFF_KEY, JSON.stringify(off));
      } catch (e) {}
    }
    function divisionName(id) {
      try {
        var d = (ME.EDITOR.map.divisions || []).find(function(x) { return x && x.id === id; });
        return (d && d.name) || id || '';
      } catch (e) { return id || ''; }
    }
    function stepLabel(step) {
      var i = (step && step.input) || {}, r = (step && step.result) || {};
      switch (step && step.name) {
        case 'listScenarioMaps': return '查剧本地图' + (i.query ? '「' + i.query + '」' : '') + (Array.isArray(r.maps) ? '（' + r.maps.length + ' 份）' : '');
        case 'loadScenarioMap': return '载入剧本地图副本' + (i.tier ? '（' + (TIER_CN[i.tier] || i.tier) + '）' : '');
        case 'mapEditorOverview': return '检索地块' + (i.query ? '「' + i.query + '」' : '') + (i.selectedOnly ? '（只看选中）' : '');
        case 'mapEditorRead': return '读取地块「' + divisionName(i.id) + '」';
        case 'mapEditorFocus': return '定位到「' + divisionName(i.id) + '」';
        case 'mapEditorEdit':
          var es = Array.isArray(i.edits) ? i.edits : [];
          return '改 ' + es.length + ' 块地：' + es.slice(0, 3).map(function(e) {
            var nm = divisionName(e && e.id), to = e && e.patch && e.patch.name;
            return to && to !== nm ? nm + ' → ' + to : nm;
          }).join('、') + (es.length > 3 ? ' 等' : '');
        case 'mapEditorMoveVertex': return '挪动「' + divisionName(i.id) + '」的边界顶点';
        case 'finish': return '收尾';
        case 'note': return '记一笔';
        case 'todoWrite': return '更新任务清单';
        case 'askClarification': return '向你请教';
        default: return (step && step.name) || '';
      }
    }

    // ── 对话流 ──
    function scrollEnd() { log.scrollTop = log.scrollHeight; }
    function renderEmpty() {
      if (log.querySelector('.mg-u, .mg-r')) { var e0 = log.querySelector('.mg-empty'); if (e0) e0.remove(); return; }
      if (log.querySelector('.mg-empty')) return;
      var box = document.createElement('div');
      box.className = 'mg-empty';
      box.innerHTML = '<div class="mg-empty-seal">师</div><p>先在地图上选几块地，或直接说地名。改完会直接落到地图上，随时可以撤销。</p>'
        + '<div class="mg-chips">' + EXAMPLES.map(function(x, k) { return '<button type="button" data-ex="' + k + '">' + esc(x.t) + '</button>'; }).join('') + '</div>';
      box.addEventListener('click', function(ev) {
        var b = ev.target.closest && ev.target.closest('[data-ex]'); if (!b) return;
        var x = EXAMPLES[+b.getAttribute('data-ex')];
        input.value = x.fill; readonly.checked = !!x.ro; autoGrow(); input.focus();
      });
      log.appendChild(box);
    }
    function addUser(text) {
      var u = document.createElement('div');
      u.className = 'mg-u';
      u.innerHTML = '<div class="mg-u-b"></div>';
      u.firstChild.textContent = String(text || '');
      log.appendChild(u); renderEmpty();
      while (log.children.length > 80) log.removeChild(log.firstChild);
      scrollEnd();
    }
    function beginReply() {
      var el = document.createElement('div');
      el.className = 'mg-r';
      el.innerHTML = '<div class="mg-who"><span class="mg-seal sm">师</span><b>国师</b><time>' + nowHM() + '</time></div>'
        + '<details class="mg-think live" open><summary><span class="mg-tk">思考与查阅</span><span class="mg-n"></span></summary><div class="mg-steps"></div></details>'
        + '<div class="mg-say" hidden></div><div class="mg-live"><span class="mg-spin"></span><span class="mg-live-tx">正在查看地图…</span></div><div class="mg-tag" hidden></div>';
      log.appendChild(el); renderEmpty(); scrollEnd();
      R = { el: el, steps: el.querySelector('.mg-steps'), think: el.querySelector('.mg-think'), say: el.querySelector('.mg-say'), live: el.querySelector('.mg-live-tx'), tag: el.querySelector('.mg-tag'), n: 0, lv: null };
      return R;
    }
    function bump(r) { r.n++; r.think.querySelector('.mg-n').textContent = ' · ' + r.n + ' 步'; }
    function addStep(r, step) {
      var row = document.createElement('div');
      var bad = step && step.result && step.result.ok === false;
      row.className = 'mg-step' + (bad ? ' bad' : '') + (step && step.name === 'finish' ? ' fin' : '');
      row.textContent = stepLabel(step) + (bad && (step.result.reason || step.result.error) ? ' — ' + String(step.result.reason || step.result.error).slice(0, 120) : '');
      r.steps.appendChild(row); bump(r);
      r.live.textContent = stepLabel(step) + ' · 接着想…';
      scrollEnd();
    }
    function addLine(r, text) {
      var row = document.createElement('div');
      row.className = 'mg-line';
      row.textContent = String(text || '').slice(0, 2000);
      r.steps.appendChild(row);
      r.live.textContent = String(text || '').replace(/\s+/g, ' ').slice(0, 80);
      scrollEnd();
    }

    // ── 实时显示：旁听到的想法、话、收尾说明先显示，收齐后由正式结果接手 ──
    function lvClear(r, keepThought) {
      var s = r && r.lv; if (!s) return;
      r.lv = null;
      if (s.timer) clearTimeout(s.timer);
      if (s.textEl && s.textEl.parentNode) s.textEl.parentNode.removeChild(s.textEl);
      if (s.thinkEl) {
        var full = s.think.trim();
        if (keepThought && full) {
          s.thinkEl.classList.remove('streaming');
          s.thinkEl.textContent = full.length > 6000 ? full.slice(0, 6000) + '…' : full;
          if (full.length > 300) { s.thinkEl.classList.add('long'); s.thinkEl.title = '点开看全部想法'; s.thinkEl.addEventListener('click', function() { this.classList.toggle('open'); }); }
        } else if (s.thinkEl.parentNode) s.thinkEl.parentNode.removeChild(s.thinkEl);
      }
    }
    function lvPaint(r) {
      var s = r && r.lv; if (!s) return;
      s.timer = 0;
      if (s.think.trim() && !showThinking()) r.live.textContent = '正在想…';   // 关了「显示思考原文」只说在想（与工坊同一开关）
      if (s.think.trim() && showThinking()) {
        if (!s.thinkEl) { s.thinkEl = document.createElement('div'); s.thinkEl.className = 'mg-line reason streaming'; r.steps.appendChild(s.thinkEl); }
        var th = s.think.replace(/^\s+/, '');
        s.thinkEl.textContent = th.length > 600 ? '…' + th.slice(-600) : th;
        r.live.textContent = '正在想…';
      }
      if (s.text.trim()) {
        if (!s.textEl) { s.textEl = document.createElement('div'); s.textEl.className = 'mg-line streaming'; r.steps.appendChild(s.textEl); }
        s.textEl.textContent = s.text.replace(/^\s+/, '').slice(0, 2000);
      }
      var answer = null, drafting = null;
      Object.keys(s.tools).forEach(function(k) {
        var t = s.tools[k];
        if (t.name === 'finish') { var p = AA.partialJsonString && AA.partialJsonString(t.args, 'summary'); if (p && p.text.trim()) answer = p.text; }
        else if (t.name) drafting = t;
      });
      if (answer != null) {
        r.say.hidden = false; r.say.textContent = answer; r.say.classList.add('streaming');
        r.live.textContent = '正在落笔…';
      } else if (drafting) {
        r.live.textContent = '正在拟：' + (DRAFT_CN[drafting.name] || drafting.name) + (drafting.args.length > 300 ? '（已写 ' + drafting.args.length + ' 字）' : '');
      }
      scrollEnd();
    }
    function onDelta(ev) {
      var r = R; if (!r || !ev) return;
      if (ev.kind === 'stream-off') { rememberStreamOff(); status.textContent = '这条线路不支持实时显示，已改回整段返回'; return; }
      if (ev.kind === 'reset') { lvClear(r, false); r.say.hidden = true; r.say.textContent = ''; return; }
      if (ev.kind === 'done') { if (r.lv) lvPaint(r); lvClear(r, true); return; }
      var s = r.lv || (r.lv = { think: '', text: '', tools: {}, timer: 0 });
      if (ev.kind === 'think') s.think += ev.text || '';
      else if (ev.kind === 'text') s.text += ev.text || '';
      else if (ev.kind === 'tool' || ev.kind === 'args') {
        var k = String(ev.index != null ? ev.index : 0), t = s.tools[k] || (s.tools[k] = { name: '', args: '' });
        if (ev.kind === 'tool') t.name += ev.name || ''; else t.args += ev.text || '';
      } else return;
      if (!s.timer) s.timer = setTimeout(function() { if (r.lv === s) lvPaint(r); }, 60);
    }

    function finishReply(r, response, error) {
      lvClear(r, true);
      r.think.open = false; r.think.classList.remove('live');
      var lv = r.el.querySelector('.mg-live'); if (lv) lv.remove();
      if (!r.n && !r.steps.children.length) r.think.remove();
      r.say.classList.remove('streaming');
      if (error) {
        r.say.hidden = false; r.say.classList.add('mg-err');
        r.say.textContent = '没有应用这次修改：' + (error.message || error);
        return;
      }
      var result = response.result || {}, summary = result.summary || result.finishSummary || '';
      if (summary && summary !== response.reason) { r.say.hidden = false; r.say.textContent = summary; }
      else if (!r.say.textContent) { r.say.hidden = false; r.say.textContent = response.reason || ''; }
      r.tag.hidden = false;
      if (response.applied) {
        r.tag.className = 'mg-tag ok';
        r.tag.innerHTML = '<span>✓ ' + esc(response.reason || '已应用到地图') + '</span>'
          + '<button type="button" data-act="undo">撤销这次</button>'
          + (response.draft && response.draft.focusRegionId ? '<button type="button" data-act="focus">定位</button>' : '');
        r.tag.addEventListener('click', function(ev) {
          var b = ev.target.closest && ev.target.closest('[data-act]'); if (!b) return;
          if (b.getAttribute('data-act') === 'focus') { try { ME.agentTools.focus(response.draft.focusRegionId); } catch (e) { status.textContent = '定位目标已变化，请重新检索地块'; } return; }
          var u = ME.agent.undo();
          status.textContent = u.ok ? '已撤销这次国师修改' : u.reason;
          if (u.ok) { r.tag.className = 'mg-tag undone'; r.tag.innerHTML = '<span>↺ 已撤销</span>'; }
          selection();
        });
      } else {
        r.tag.className = 'mg-tag';
        r.tag.textContent = response.reason || '';
        if (!r.tag.textContent || r.tag.textContent === r.say.textContent) r.tag.hidden = true;
      }
      scrollEnd();
    }

    // ── 选中、开关、运行态 ──
    function selection() {
      var list = ME.getSelected();
      var sel = get('[data-role="selection"]');
      if (list.length) {
        sel.innerHTML = '<span class="mg-sel-k">已选中</span>' + list.slice(0, 5).map(function(d) { return '<span class="mg-chip">' + esc(d.name) + '</span>'; }).join('') + (list.length > 5 ? '<span class="mg-more">等 ' + list.length + ' 块</span>' : '');
      } else sel.innerHTML = '<span class="mg-sel-k">未选中</span><span class="mg-hint">可先在地图上选地块，或直接说地名</span>';
      undo.disabled = !ME.agent.canUndo();
    }
    function setRunning(on) {
      send.disabled = on; send.hidden = on;
      stop.disabled = !on; stop.hidden = !on;
      readonly.disabled = on;
      if (on) undo.disabled = true;
      panel.classList.toggle('mg-running', on);
    }
    function autoGrow() { input.style.height = 'auto'; input.style.height = Math.min(180, Math.max(46, input.scrollHeight)) + 'px'; }
    function show(open) {
      panel.hidden = !open; launcher.setAttribute('aria-expanded', String(open));
      if (open) {
        selection(); renderEmpty();
        var cfg = cfgNow();
        get('[data-role="model"]').textContent = cfg.model || '未配置模型';
        status.textContent = cfg.key && cfg.url ? '改完直接应用到当前地图，可撤销' : '请先在游戏或剧本工坊设置国师使用的 API';
        input.focus();
      }
    }
    launcher.onclick = function() { show(panel.hidden); };
    get('[data-action="close"]').onclick = function() { show(false); launcher.focus(); };
    stop.onclick = function() { ME.agent.stop(); status.textContent = '正在停止，本次修改将不应用'; };
    undo.onclick = function() { var r = ME.agent.undo(); status.textContent = r.ok ? '已撤销上次国师修改' : r.reason; selection(); };
    panel.addEventListener('keydown', function(e) {
      e.stopPropagation();   // 地图编辑器的快捷键别在这里触发
      if (e.key === 'Escape') { e.preventDefault(); if (ME.agent.isRunning()) stop.click(); else { show(false); launcher.focus(); } return; }
      if (e.target === input && e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); get('form').requestSubmit ? get('form').requestSubmit() : send.click(); }
    });
    panel.addEventListener('keyup', function(e) { e.stopPropagation(); });
    input.addEventListener('input', autoGrow);
    get('form').onsubmit = async function(e) {
      e.preventDefault();
      var request = input.value.trim();
      if (!request || ME.agent.isRunning()) return;
      setRunning(true);
      addUser(request); input.value = ''; autoGrow();
      status.textContent = '国师正在查看地图…';
      var r = beginReply(), live = streamOn();
      try {
        var response = await ME.agent.run(request, {
          readOnly: readonly.checked,
          stream: live, onDelta: live ? onDelta : undefined,
          onStep: function(step) { if (R === r) addStep(r, step); if (step && stepLabel(step)) status.textContent = stepLabel(step) + '…'; },
          onText: function(text) { if (R === r && text) addLine(r, text); }
        });
        panel._lastResult = response;
        finishReply(r, response);
        status.textContent = response.reason;
      } catch (error) {
        finishReply(r, null, error);
        status.textContent = '未应用本次修改：' + error.message;
      } finally {
        if (R === r) R = null;
        setRunning(false); selection();
      }
    };
    ['selection-change', 'mutation', 'map-loaded'].forEach(function(evt) { ME.on(evt, selection); });
    selection();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})(window);
