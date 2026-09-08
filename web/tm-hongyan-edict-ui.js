// @ts-check
// ═══ 巨石拆分(20260706·第十五拆)：tm-hongyan-office.js 中段切出 edict 草拟 UI ═══
// 内容：_showEdictAdoptMenu/_closeEdictMenu/_renderEdictSuggestions/_edictUiRoot/_edictEl/_hidePolishedEdict/
//        _polishEdicts/_renderPolishedEdict/_applyPolishedEdict(原行 2337-2697)。
// 型态：顶层函数型(列0 全局函数·无 alias·无 'use strict'·随 origin 非严格)。
// 装载：须紧接 tm-game-ui-shell.js 之后(origin→game-ui-shell→edict-ui 三片连序·保序等价)。契约见 lint-split-contracts。
// 装载期可执行语句：末尾 window 导出块(原 2693-2697·window._polishEdicts 等)——在本片 edict 函数定义之后执行·自洽。
//        注：其上一行 "注册结算步骤" 注释(原 2690-2692)描述的是留守 origin 的 register('letters')·因字节序随本段一同迁出。
// ── 建议库动态渲染 ──
// 纳入诏书的下拉菜单——以 body 级 fixed 定位呈现，避免被侧栏 overflow 裁切
function _showEdictAdoptMenu(evt, realIdx) {
  if (evt) { evt.stopPropagation(); evt.preventDefault(); }
  // 移除旧菜单
  var _old = document.getElementById('_edictAdoptMenu'); if (_old) _old.remove();
  var _btn = evt && evt.currentTarget ? evt.currentTarget : (evt && evt.target);
  if (!_btn) return;
  var rect = _btn.getBoundingClientRect();
  var cats = [
    {id:'edict-pol', label:'\u653F\u4EE4', color:'var(--indigo-400)'},
    {id:'edict-mil', label:'\u519B\u4EE4', color:'var(--vermillion-400)'},
    {id:'edict-dip', label:'\u5916\u4EA4', color:'var(--celadon-400)'},
    {id:'edict-eco', label:'\u7ECF\u6D4E', color:'var(--gold-400)'},
    {id:'edict-oth', label:'\u5176\u4ED6', color:'var(--ink-300)'}
  ];
  var menu = document.createElement('div');
  menu.id = '_edictAdoptMenu';
  // 计算位置——优先向下；若下方空间不足则向上
  var menuH = cats.length * 28 + 6;
  var vh = window.innerHeight;
  var top = rect.bottom + 4;
  if (top + menuH > vh - 10) top = Math.max(10, rect.top - menuH - 4);
  menu.style.cssText = 'position:fixed;left:' + rect.left + 'px;top:' + top + 'px;z-index:9999;background:var(--color-elevated,#1a1a2e);border:1px solid var(--color-border-subtle,#444);border-radius:6px;box-shadow:0 8px 24px rgba(0,0,0,0.5);min-width:90px;padding:3px 0;';
  cats.forEach(function(cat) {
    var item = document.createElement('div');
    item.textContent = cat.label;
    item.style.cssText = 'padding:5px 12px;font-size:0.8rem;cursor:pointer;color:' + cat.color + ';transition:background 0.12s;';
    item.onmouseover = function() { this.style.background = 'var(--color-surface,rgba(255,255,255,0.06))'; };
    item.onmouseout = function() { this.style.background = ''; };
    item.onclick = function(ev) {
      ev.stopPropagation();
      var sg = GM._edictSuggestions && GM._edictSuggestions[realIdx];
      if (sg) {
        var ta = _$(cat.id);
        if (ta) {
          // 纳入时保留问题背景：先写 topic，再写 content
          var prefix = '';
          if (sg.topic) prefix += '〔' + sg.topic + '〕';
          if (sg.from) prefix += '（' + sg.from + '言）';
          var block = (prefix ? prefix + '\n' : '') + sg.content;
          ta.value += (ta.value ? '\n\n' : '') + block;
        }
        if (typeof toast === 'function') toast('\u5DF2\u7EB3\u5165' + cat.label + (sg.topic?'（含问题背景）':''));
      }
      menu.remove();
      document.removeEventListener('click', _closeEdictMenu);
    };
    menu.appendChild(item);
  });
  document.body.appendChild(menu);
  // 点击外部关闭
  setTimeout(function() { document.addEventListener('click', _closeEdictMenu); }, 0);
}
function _closeEdictMenu(e) {
  var m = document.getElementById('_edictAdoptMenu');
  if (m && !m.contains(e.target)) {
    m.remove();
    document.removeEventListener('click', _closeEdictMenu);
  }
}

function _renderEdictSuggestions() {
  var container = _$('edict-sug-sidebar');
  if (!container) return;
  var _edictCatIds = [
    {id:'edict-pol', label:'\u653F\u4EE4', color:'var(--indigo-400)'},
    {id:'edict-mil', label:'\u519B\u4EE4', color:'var(--vermillion-400)'},
    {id:'edict-dip', label:'\u5916\u4EA4', color:'var(--celadon-400)'},
    {id:'edict-eco', label:'\u7ECF\u6D4E', color:'var(--gold-400)'},
    {id:'edict-oth', label:'\u5176\u4ED6', color:'var(--ink-300)'}
  ];
  // 性能·预存原始插入顺序索引 Map·避免 sort 比较器内每次 indexOf 造成 O(n² log n)
  var _edSugAll = GM._edictSuggestions || [];
  var _edSugOrder = new Map();
  for (var _eoi = 0; _eoi < _edSugAll.length; _eoi++) _edSugOrder.set(_edSugAll[_eoi], _eoi);
  var _unused = _edSugAll.filter(function(s) { return !s.used; });
  // 按回合倒序（本回合最上·以往回合依次下排·同回合按原入库顺序）
  _unused.sort(function(a, b) {
    var ta = a.turn || 0, tb = b.turn || 0;
    if (tb !== ta) return tb - ta;
    // 同回合：保持插入顺序·取预存原数组索引（O(1)）
    return (_edSugOrder.get(a) || 0) - (_edSugOrder.get(b) || 0);
  });
  // 按来源映射 src 类
  var _srcClsMap = {
    '\u671D\u8BAE': 'ed-src-chaoyi',
    '\u95EE\u5BF9': 'ed-src-wendui',
    '\u9E3F\u96C1': 'ed-src-letter',
    '\u594F\u758F': 'ed-src-memorial',
    '\u5B98\u5236': 'ed-src-office',
    '\u5730\u65B9': 'ed-src-local',
    '\u72EC\u53EC': 'ed-src-wendui',
    '\u72EC\u53EC\u00B7\u5212\u9009': 'ed-src-wendui',
    '\u72EC\u53EC\u00B7\u5EFA\u8A00\u8981\u70B9': 'ed-src-wendui'
  };
  var html = '';
  if (_unused.length === 0) {
    html += '<div style="font-size:11.5px;color:var(--color-foreground-muted);line-height:1.7;padding:12px 10px;text-align:center;font-family:var(--font-serif);font-style:italic;">\u8BF8\u4E8B\u6682\u5B81\u3002\u53EC\u5F00\u300C\u671D\u8BAE\u300D\u6216\u300C\u95EE\u5BF9\u300D\uFF0C\u5176\u8FDB\u8A00\u5C06\u6536\u5165\u6B64\u5904\u3002</div>';
  } else {
    var _curTurn = (GM.turn || 1);
    var _lastTurnHeader = null;
    _unused.forEach(function(s) {
      var _realIdx = (GM._edictSuggestions || []).indexOf(s);
      var _srcCls = _srcClsMap[s.source] || 'ed-src-default';
      var _srcLine = '\u3010' + escHtml(s.source || '?') + (s.from ? '\u00B7' + escHtml(s.from) : '') + '\u3011';
      // 插入回合分组 header
      var _sTurn = s.turn || 0;
      if (_sTurn !== _lastTurnHeader) {
        _lastTurnHeader = _sTurn;
        var _turnLabel;
        if (_sTurn === _curTurn) _turnLabel = '\u672C\u56DE\u5408';
        else if (_sTurn === _curTurn - 1) _turnLabel = '\u4E0A\u56DE\u5408';
        else if (_sTurn > 0) _turnLabel = '\u7B2C ' + _sTurn + ' \u56DE\u5408';
        else _turnLabel = '\u5F80\u65E5';
        var _dateStr = (typeof getTSText === 'function' && _sTurn > 0) ? getTSText(_sTurn) : '';
        html += '<div style="font-size:11.5px;color:var(--gold,#c9a84c);letter-spacing:0.3em;padding:6px 8px 3px;border-bottom:1px dashed rgba(201,168,76,0.2);margin-top:4px;font-family:var(--font-serif);">\u00B7 ' + _turnLabel + (_dateStr ? ' \u00B7 ' + escHtml(_dateStr) : '') + ' \u00B7</div>';
      }
      html += '<div class="ed-sug-item ' + _srcCls + '" onclick="_showEdictAdoptMenu(event,' + _realIdx + ')">';
      html += '<div class="src">' + _srcLine + '</div>';
      if (s.topic) html += '<div class="topic">\u3014' + escHtml(s.topic) + '\u3015</div>';
      html += '<div class="txt">' + escHtml(s.content) + '</div>';
      html += '<span class="act">\u6458\u5165</span>';
      // Phase G\u00b7F7\u00b7Path B wendui inline button\u00b7G2 enke / G3 wuju\u00b7click \u89e6\u672c\u90e8 wendui
      if (s._enkeSubtype && typeof window._kjG2OpenLibuEnkeWendui === 'function') {
        html += '<button class="ed-sug-wendui" style="position:absolute;right:30px;top:6px;font-size:11px;padding:1px 6px;border:1px solid var(--celadon-400,#6a9);background:rgba(120,180,140,0.12);color:var(--celadon-400,#6a9);cursor:pointer;border-radius:2px;" onclick="event.stopPropagation();window._kjG2OpenLibuEnkeWendui();" title="\u4eb2\u95ee\u793c\u90e8\u00b7\u8c10\u5546\u5f00\u79d1">\u95ee\u793c\u90e8</button>';
      }
      if (s._wujuSubtype && typeof window._kjG3OpenBingbuWujuWendui === 'function') {
        html += '<button class="ed-sug-wendui" style="position:absolute;right:30px;top:6px;font-size:11px;padding:1px 6px;border:1px solid var(--vermillion-400,#c87);background:rgba(200,120,100,0.12);color:var(--vermillion-400,#c87);cursor:pointer;border-radius:2px;" onclick="event.stopPropagation();window._kjG3OpenBingbuWujuWendui();" title="\u4eb2\u95ee\u5175\u90e8\u00b7\u8c10\u5546\u5f00\u6b66\u4e3e">\u95ee\u5175\u90e8</button>';
      }
      // Phase H\u00b7H5\u00b7Path B \u95ee\u5b66\u653f button (\u671d\u4ee3\u5dee\u5f02 label)
      if (s._schoolSubtype && typeof window._kjpHOpenLibuSchoolWendui === 'function') {
        var _xzLabel = typeof window._kjpHGetXuezhengLabel === 'function' ? window._kjpHGetXuezhengLabel() : '\u95ee\u5b66\u653f';
        var _xzShort = _xzLabel.length > 4 ? _xzLabel.slice(0, 4) : _xzLabel;
        html += '<button class="ed-sug-wendui" style="position:absolute;right:30px;top:6px;font-size:11px;padding:1px 6px;border:1px solid var(--indigo-400,#779);background:rgba(120,140,200,0.12);color:var(--indigo-400,#779);cursor:pointer;border-radius:2px;" onclick="event.stopPropagation();window._kjpHOpenLibuSchoolWendui();" title="\u4eb2\u95ee ' + escHtml(_xzLabel) + '\u00b7\u8c10\u5546\u4e66\u9662">\u95ee' + escHtml(_xzShort) + '</button>';
      }
      // G5 v2\u00b7\u7ae5\u5b50\u79d1\u00b7\u95ee\u793c\u90e8 button (audit Fix 2)
      if (s._tongziSubtype && typeof window._kjG5OpenLibuTongziWendui === 'function') {
        html += '<button class="ed-sug-wendui" style="position:absolute;right:30px;top:6px;font-size:11px;padding:1px 6px;border:1px solid var(--rose-400,#c79);background:rgba(200,120,150,0.12);color:var(--rose-400,#c79);cursor:pointer;border-radius:2px;" onclick="event.stopPropagation();window._kjG5OpenLibuTongziWendui();" title="\u4eb2\u95ee\u793c\u90e8\u00b7\u8c10\u5546\u8350\u795e\u7ae5">\u95ee\u793c\u90e8</button>';
      }
      html += '<button class="del" onclick="event.stopPropagation();GM._edictSuggestions[' + _realIdx + '].used=true;_renderEdictSuggestions();" title="\u5220\u9664">\u2715</button>';
      html += '</div>';
    });
  }
  container.innerHTML = html;
}

function _edictUiRoot() {
  var active = document.getElementById('tm-action-edict-overlay');
  if (active && active.querySelector) return active;
  return document;
}

function _edictEl(id) {
  var root = _edictUiRoot();
  if (root && root.querySelector) {
    var scoped = root.querySelector('#' + id);
    if (scoped) return scoped;
  }
  return typeof _$ === 'function' ? _$(id) : document.getElementById(id);
}

function _hidePolishedEdict() {
  var pending = _polishEdicts._pending;
  if (pending) { _polishEdicts._pending = null; pending.controller.abort(); }
  var panel = _edictEl('edict-polished');
  if (panel) {
    panel.classList.remove('show');
    panel.style.display = 'none';
    panel.innerHTML = '';
  }
}

// ── 有司润色：将各类诏令合并为正式诏书 ──
function _edictPolishFailure(panel, error, tier) {
  var code = (error && error.code) || 'edict-polish-failed';
  var messages = {
    'ai-text-truncated': '模型输出已达上限，诏书尚未完成；请换用输出额度更充足的润色模型后重试。',
    'ai-text-reasoning-only': '模型只返回了思考过程，没有诏书正文；请检查所用模型的输出设置后重试。',
    'ai-text-empty': '接口已响应，但正文为空；可重试，反复出现请检查所用模型。',
    'ai-text-refused': '模型拒绝或过滤了本次润色；请检查草稿内容后重试。',
    'ai-text-format': '接口返回的正文格式不受支持；请核对模型与兼容接口。',
    'context_length_exceeded': '草稿与格式要求超过所用模型的上下文容量；请检查模型设置后重试。',
    'edict-draft-changed': '等待期间草稿已修改，旧润色结果未采用；请按新草稿重新润色。'
  };
  var message = messages[code];
  if (!message && typeof _tmAiErrHuman === 'function') message = _tmAiErrHuman(error);
  panel.innerHTML = '';
  panel.dataset.errorCode = code;
  var card = document.createElement('div');
  card.className = 'ed-polish-card loading';
  var notice = document.createElement('p');
  notice.textContent = '润色未完成（' + (tier === 'secondary' ? '次 API' : '主 API') + '）：' +
    (message || '请求失败，请稍后重试或检查 AI 设置。') + ' 原始旨意已保留。';
  card.appendChild(notice);
  var actions = document.createElement('div');
  actions.className = 'ed-scroll-actions';
  var retry = document.createElement('button');
  retry.type = 'button'; retry.className = 'ed-scroll-btn'; retry.textContent = '重试润色';
  retry.addEventListener('click', function() { _polishEdicts(); });
  actions.appendChild(retry);
  var close = document.createElement('button');
  close.type = 'button'; close.className = 'ed-scroll-btn'; close.textContent = '返回修改';
  close.addEventListener('click', _hidePolishedEdict);
  actions.appendChild(close);
  card.appendChild(actions);
  panel.appendChild(card);
}

async function _polishEdicts() {
  var cats = [
    { id: 'edict-pol', label: '\u653F\u4EE4' },
    { id: 'edict-mil', label: '\u519B\u4EE4' },
    { id: 'edict-dip', label: '\u5916\u4EA4' },
    { id: 'edict-eco', label: '\u7ECF\u6D4E' },
    { id: 'edict-oth', label: '\u5176\u4ED6' }
  ];
  var parts = [];
  cats.forEach(function(cat) {
    var el = _edictEl(cat.id);
    var val = el ? el.value.trim() : '';
    if (val) parts.push({ label: cat.label, content: val });
  });
  if (parts.length === 0) { toast('\u8BF7\u5148\u5728\u5404\u7C7B\u8BCF\u4EE4\u4E2D\u586B\u5199\u5185\u5BB9'); return; }

  var panel = _edictEl('edict-polished');
  if (!panel) return;
  var previous = _polishEdicts._pending;
  if (previous && previous.panel === panel && previous.current()) return;
  if (previous) previous.controller.abort();
  panel.classList.add('show');
  panel.style.display = 'block';
  panel.innerHTML = '<div class="ed-polish-card loading">\u6709\u53F8\u6B63\u5728\u6DA6\u8272\u8BCF\u4E66\u2026\u2026</div>';

  // 读取风格选择
  var styleEl = _edictEl('edict-polish-style');
  var style = styleEl ? styleEl.value : 'elegant';
  var styleDesc = {
    elegant: '\u5178\u96C5\u5E84\u91CD\u7684\u6587\u8A00\uFF0C\u5584\u7528\u5BF9\u5076\u9A88\u53E5',
    concise: '\u7B80\u6D01\u660E\u5FEB\uFF0C\u76F4\u5165\u4E3B\u9898\uFF0C\u4E0D\u7528\u5197\u957F\u8F9E\u85FB',
    ornate: '\u534E\u4E3D\u6587\u85FB\uFF0C\u6587\u91C7\u98DE\u626C\uFF0C\u5927\u91CF\u4F7F\u7528\u5178\u6545\u3001\u8F9E\u8D4B\u3001\u6392\u6BD4',
    plain: '\u767D\u8BDD\u6587\u8A00\uFF0C\u534A\u6587\u534A\u767D\uFF0C\u901A\u4FD7\u6613\u61C2\u4F46\u4FDD\u6301\u5E84\u91CD'
  }[style] || '';

  var tier = (typeof _useSecondaryTier === 'function' && _useSecondaryTier()) ? 'secondary' : 'primary';
  var config = typeof _getAITier === 'function' ? _getAITier(tier) : P.ai;
  if (!config || !config.key) {
    var merged = parts.map(function(p) { return '\u3010' + p.label + '\u3011' + p.content; }).join('\n\n');
    _renderPolishedEdict(panel, merged);
    return;
  }

  var gm = GM, project = P;
  var lease = typeof _tmCaptureWorldLease === 'function' ? _tmCaptureWorldLease() : null;
  var controller = new AbortController();
  var request = { panel: panel, controller: controller, current: function() {
    return _polishEdicts._pending === request && !controller.signal.aborted && GM === gm && P === project &&
      panel.isConnected !== false && _edictEl('edict-polished') === panel &&
      (!lease || typeof _tmWorldLeaseCurrent !== 'function' || _tmWorldLeaseCurrent(lease));
  } };
  _polishEdicts._pending = request;
  var inputs = cats.map(function(cat) { var el = _edictEl(cat.id); return { el: el, value: el ? el.value : '' }; });
  var buttons = Array.prototype.slice.call(_edictUiRoot().querySelectorAll('.act-polish, .ed-polish-btn'));
  buttons.forEach(function(button) { button._edictPolishOwner = request; button.disabled = true; });
  delete panel.dataset.errorCode;
  try {
  var sc = typeof findScenarioById === 'function' && findScenarioById(GM.sid);
  var era = (sc && sc.era) || '';
  var dynasty = (sc && sc.dynasty) || '';
  var role = (P.playerInfo && P.playerInfo.characterName) || '\u7687\u5E1D';
  var dateText = (typeof getTSText === 'function') ? getTSText(GM.turn) : '';

  var prompt = '\u4F60\u662F' + (dynasty || era || '\u4E2D\u56FD\u53E4\u4EE3') + '\u671D\u5EF7\u7684\u4E2D\u4E66\u820D\u4EBA/\u7FF0\u6797\u5B66\u58EB\uFF0C\u8D1F\u8D23\u8D77\u8349\u6B63\u5F0F\u8BCF\u4E66\u3002\n\n';
  prompt += '\u3010\u53D1\u5E03\u8005\u3011' + role + '\n';
  prompt += '\u3010\u65F6\u95F4\u3011' + dateText + '\n\n';
  prompt += '\u3010\u73A9\u5BB6\u8349\u62DF\u7684\u5404\u7C7B\u65E8\u610F\u3011\n';
  parts.forEach(function(p) { prompt += '\u3014' + p.label + '\u3015' + p.content + '\n'; });

  prompt += '\n\u3010\u4EFB\u52A1\u3011\u5C06\u4EE5\u4E0A\u5404\u7C7B\u65E8\u610F\u5408\u5E76\u6DA6\u8272\u4E3A\u4E00\u9053\u5B8C\u6574\u7684\u6B63\u5F0F\u8BCF\u4E66\u3002\u8981\u6C42\uFF1A\n';
  prompt += '1. \u8BCF\u4E66\u683C\u5F0F\u5FC5\u987B\u4E25\u683C\u9075\u5FAA' + (era || '\u8BE5\u671D\u4EE3') + '\u7684\u771F\u5B9E\u516C\u6587\u4F53\u5236\u2014\u2014\n';
  prompt += '   \u4E0D\u540C\u671D\u4EE3\u8BCF\u4E66\u683C\u5F0F\u5DEE\u5F02\u6781\u5927\uFF0C\u4F60\u5FC5\u987B\u6839\u636E\u5177\u4F53\u671D\u4EE3\u9009\u7528\u6B63\u786E\u683C\u5F0F\uFF1A\n';
  prompt += '   \u00B7 \u79E6\u6C49\uFF1A\u5236\u66F0/\u8BCF\u66F0\uFF0C\u65E0\u56FA\u5B9A\u8D77\u9996\u5957\u8BED\uFF0C\u7ED3\u5C3E\u201C\u5E03\u544A\u5929\u4E0B\u201D\u201C\u5176\u4EE4\u2026\u2026\u201D\u7B49\n';
  prompt += '   \u00B7 \u9B4F\u664B\u5357\u5317\u671D\uFF1A\u591A\u7528\u201C\u95E8\u4E0B\u201D\u8D77\u9996\uFF0C\u9A88\u6587\u98CE\u683C\u6D53\u90C1\n';
  prompt += '   \u00B7 \u5510\u5B8B\uFF1A\u5236\u4E66\u201C\u95E8\u4E0B\uFF1A\u201D\u8D77\u9996\uFF0C\u6555\u4E66\u201C\u6555\u67D0\u67D0\u201D\u8D77\u9996\uFF0C\u7ED3\u5C3E\u201C\u4E3B\u8005\u65BD\u884C\u201D\n';
  prompt += '   \u00B7 \u5143\u4EE3\uFF1A\u8499\u6C49\u5408\u74A7\uFF0C\u767D\u8BDD\u8BCF\u4E66\u201C\u957F\u751F\u5929\u6C14\u529B\u91CC\uFF0C\u5927\u798F\u836B\u62A4\u52A9\u91CC\uFF0C\u7687\u5E1D\u5723\u65E8\u2026\u2026\u201D\n';
  prompt += '   \u00B7 \u660E\u6E05\uFF1A\u201C\u5949\u5929\u627F\u8FD0\u7687\u5E1D\uFF0C\u8BCF\u66F0/\u5236\u66F0/\u6555\u66F0\u201D\u2014\u2014\u6CE8\u610F\u201C\u5949\u5929\u627F\u8FD0\u201D\u56DB\u5B57\u540E\u63A5\u201C\u7687\u5E1D\u201D\uFF0C\n';
  prompt += '     \u201C\u8BCF\u66F0\u201D\u53E6\u8D77\uFF0C\u4E2D\u95F4\u65AD\u53E5\uFF0C\u4E0D\u662F\u201C\u5949\u5929\u627F\u8FD0\u7687\u5E1D\u8BCF\u66F0\u201D\u8FDE\u8BFB\u3002\u4E14\u6B64\u683C\u5F0F\u4EC5\u9650\u660E\u6E05\u3002\n';
  prompt += '   \u00B7 \u82E5\u975E\u5E1D\u738B\uFF08\u5982\u8BF8\u4FAF/\u738B/\u4E1E\u76F8\u7B49\uFF09\uFF0C\u5E94\u4F7F\u7528\u201C\u4EE4\u201D\u201C\u6559\u201D\u201C\u6A84\u201D\u7B49\u5BF9\u5E94\u6587\u79CD\uFF0C\u4E0D\u7528\u201C\u8BCF\u201D\n';
  prompt += '2. \u6B63\u6587\uFF1A\u5C06\u5404\u7C7B\u65E8\u610F\u6709\u673A\u878D\u5408\uFF0C\u6309\u8F7B\u91CD\u7F13\u6025\u6392\u5217\uFF0C\u884C\u6587\u6D41\u7545\n';
  prompt += '3. \u8BED\u8A00\u98CE\u683C\uFF1A' + styleDesc + '\n';
  prompt += '4. \u4FDD\u7559\u73A9\u5BB6\u6240\u6709\u65E8\u610F\u7684\u5B9E\u8D28\u5185\u5BB9\uFF0C\u4E0D\u9057\u6F0F\u4E0D\u7BE1\u6539\uFF0C\u4E0D\u51ED\u7A7A\u589E\u52A0\u65B0\u653F\u7B56\n';
  prompt += '5. \u5B57\u6570\uFF1A' + _charRangeText('zw') + '\n\n';
  prompt += '\u76F4\u63A5\u8F93\u51FA\u8BCF\u4E66\u5168\u6587\uFF0C\u4E0D\u8981\u52A0\u4EFB\u4F55\u89E3\u91CA\u3002';

  // \u65F6\u7A7A\u7EA6\u675F\u00B7clauseOnly(\u81EA\u7531\u6587\u672C\u8BCF\u4E66\u00B7\u907F 30 \u540D\u5355\u585E\u8FDB\u6B63\u5F0F\u516C\u6587)\u00B7\u626B\u63CF\u6E90=\u73A9\u5BB6\u8349\u62DF\u5404\u7C7B\u65E8\u610F(parts.content)\u00B7\u4EE4\u8BCF\u4E66\u70B9\u540D\u4EBA\u7269\u4E0D\u88AB AI \u6309\u53F2\u4E66\u5352\u5E74\u6539\u5199\u63AA\u8F9E(typeof \u5B88\u536B\u9632\u52A0\u8F7D\u5E8F)
  if (typeof _buildTemporalConstraint === 'function') {
    try {
      var _edScan = (parts || []).map(function(p){ return (p && p.content) || ''; }).join(' ');
      var _edMentioned = (typeof _tcScanMentionedNames === 'function') ? _tcScanMentionedNames(_edScan, [], 10) : [];
      prompt += _buildTemporalConstraint(null, { clauseOnly: true, mentionedNames: _edMentioned });
    } catch (_edTcE) {}
  }

    var modelLimit = typeof _matchModelOutput === 'function' ? Number(_matchModelOutput(config.model)) * 1024 : 0;
    var ceiling = Math.min(8000, modelLimit > 0 ? modelLimit : 8000);
    var result;
    for (var attempt = 0; attempt < 2; attempt++) {
      if (!request.current()) return;
      try {
        result = await callAI(prompt, attempt ? ceiling : 2000, controller.signal, tier,
          { id: 'edict-polish', requireText: true, maxOutputTokens: ceiling, maxRetries: 1 });
        break;
      } catch (error) {
        if (!request.current()) return;
        if (error.code !== 'ai-text-truncated' || attempt || !(ceiling > error.maxTokens)) throw error;
        panel.innerHTML = '<div class="ed-polish-card loading">正文输出被截断，有司正在补足输出额度后重试（1/1）……</div>';
      }
    }
    if (!request.current()) return;
    if (inputs.some(function(input) { return input.el && input.el.value !== input.value; }) || (styleEl && styleEl.value !== style)) {
      _edictPolishFailure(panel, { code: 'edict-draft-changed' }, tier); return;
    }
    if (typeof result !== 'string' || !result.trim()) { _edictPolishFailure(panel, { code: 'ai-text-empty' }, tier); return; }
    _renderPolishedEdict(panel, result);
  } catch(e) {
    if (request.current()) _edictPolishFailure(panel, e, tier);
  } finally {
    if (_polishEdicts._pending === request) _polishEdicts._pending = null;
    buttons.forEach(function(button) {
      if (button._edictPolishOwner === request) { delete button._edictPolishOwner; button.disabled = false; }
    });
  }
}

function _renderPolishedEdict(panel, text) {
  // 卷轴式·宣纸底+上下木轴+朱砂御玺+颁行天下
  panel.classList.add('show');
  panel.style.display = 'block';
  panel.innerHTML = ''
    + '<div class="ed-polish-card">'
    + '<div class="ed-scroll">'
    +   '<div class="ed-scroll-title">\u8BCF\u3000\u4E66</div>'
    +   '<textarea id="edict-polished-text" class="ed-scroll-text" rows="12">' + escHtml(text) + '</textarea>'
    +   '<div class="ed-scroll-seal"><div class="top">\u7687 \u5E1D</div><div class="main">\u5236\u5B9D</div><div class="bot">\u4E4B \u5B9D</div></div>'
    + '</div>'
    + '<div class="ed-scroll-actions">'
    +   '<button class="ed-scroll-btn" onclick="_polishEdicts()" title="\u91CD\u65B0\u7531\u6709\u53F8\u6DA6\u8272">\u91CD \u65B0 \u6DA6 \u8272</button>'
    +   '<button class="ed-scroll-btn" onclick="_applyPolishedEdict(\'keep\')" title="\u5B58\u4E3A\u8BCF\u4E66\u624B\u7A3F\u00B7\u5F52\u6863\u8D77\u5C45\u6CE8\u00B7\u672A\u9881\u884C">\u624B \u7A3F \u5165 \u6863</button>'
    +   '<button class="ed-scroll-btn primary" onclick="_applyPolishedEdict(\'replace\')" title="\u8BCF\u4E66\u9881\u884C\u5929\u4E0B\u00B7\u4F5C\u4E3A\u4E00\u9053\u5B8C\u6574\u8BCF\u4E66\u6574\u4F53\u9881\u884C\u00B7\u5F52\u6863\u8D77\u5C45\u6CE8">\u9881 \u884C \u5929 \u4E0B</button>'
    +   '<button class="ed-scroll-btn" onclick="_hidePolishedEdict()">\u6536 \u8D77</button>'
    + '</div>'
    + '</div>';
}

function _applyPolishedEdict(mode) {
  var ta = _edictEl('edict-polished-text');
  if (!ta) return;
  var text = ta.value.trim();
  if (!text) { toast('\u8BCF\u4E66\u5185\u5BB9\u4E3A\u7A7A'); return; }

  // 升级 GM.edicts 为结构化数组·兼容老字符串数据
  if (!Array.isArray(GM.edicts)) GM.edicts = [];
  for (var _i = 0; _i < GM.edicts.length; _i++) {
    if (typeof GM.edicts[_i] === 'string') {
      GM.edicts[_i] = { id: 'legacy-' + _i, turn: 0, time: '', text: GM.edicts[_i], status: 'draft', source: 'polish', style: '', styleLabel: '', polishVersion: 1, _chainEffects: [] };
    }
  }

  var styleEl = _edictEl('edict-polish-style');
  var style = styleEl ? styleEl.value : 'elegant';
  var styleLabel = ({elegant:'\u5178\u96C5', concise:'\u7B80\u6D01', ornate:'\u534E\u4E3D', plain:'\u767D\u8BDD'})[style] || '\u5178\u96C5';

  // 本回合已有几次润色
  var _curTurn = GM.turn || 0;
  var _thisTurnPolish = GM.edicts.filter(function(e) { return e.turn === _curTurn && e.source === 'polish'; });
  var polishVersion = _thisTurnPolish.length + 1;

  var status;
  if (mode === 'replace') {
    status = 'promulgated';
    // 同回合之前已颁行的·回落为"诏书手稿"(被后润色稿替代)
    GM.edicts.forEach(function(e) {
      if (e.turn === _curTurn && e.status === 'promulgated') e.status = 'draft';
    });
    var formalApplied = false;
    try {
      var formalBridge = window.TMPhase8FormalBridge && window.TMPhase8FormalBridge.drafts;
      if (formalBridge && typeof formalBridge.applyPolishedEdict === 'function') {
        formalApplied = !!formalBridge.applyPolishedEdict(text, mode);
      } else if (typeof window.applyPhase8FormalPolishedEdict === 'function') {
        formalApplied = !!window.applyPhase8FormalPolishedEdict(text, mode);
      }
    } catch(_) {}
    if (!formalApplied) {
      // \u7ECF\u5178 UI \u56DE\u9000\uFF1A\u4E0E\u5FA1\u6848\u4E00\u81F4\u00B7\u6574\u4F53\u9881\u884C\u4E0D\u704C\u653F\u4EE4\u680F\u00B7\u6E05\u7A7A\u5404\u7C7B\u8349\u62DF\u3002
      // \u8BCF\u4E66\u5168\u6587\u5DF2\u5728 GM.edicts(status=promulgated)\u00B7\u56DE\u5408\u63A8\u6F14\u6309 edicts.decree \u4F5C\u4E3A\u4E00\u9053\u5B8C\u6574\u8BCF\u4E66\u6574\u4F53\u5904\u7406\u3002
      // \uFF08\u82E5\u4ECD\u704C edict-pol\u00B7\u4F1A\u4E0E prep \u7684 decree \u6CE8\u5165\u91CD\u590D\u63A8\u6F14\u540C\u4E00\u8BCF\u4E66\u3002\uFF09
      ['edict-pol', 'edict-mil', 'edict-dip', 'edict-eco', 'edict-oth'].forEach(function(id) {
        var el = _edictEl(id); if (el) el.value = '';
      });
    }
    toast('\u8BCF\u4E66\u9881\u884C\u5929\u4E0B\u00B7\u4F5C\u4E3A\u4E00\u9053\u8BCF\u4E66\u6574\u4F53\u9881\u884C\u00B7\u5F52\u6863\u8D77\u5C45\u6CE8');
  } else {
    status = 'draft';
    toast('\u8BCF\u4E66\u5DF2\u7F16\u8BA2\u5165\u6863\u00B7\u672A\u9881\u884C\uFF08\u8BCF\u4E66\u624B\u7A3F\uFF09');
  }

  var rec = {
    id: 'edict-' + _curTurn + '-' + Date.now() + '-' + polishVersion,
    turn: _curTurn,
    time: (typeof getTSText === 'function') ? getTSText(_curTurn) : '',
    text: text,
    status: status,
    source: 'polish',
    style: style,
    styleLabel: styleLabel,
    polishVersion: polishVersion,
    _chainEffects: []
  };
  GM.edicts.push(rec);

  // 诏书入起居注（"诏令"分类·即时可见）
  if (!GM.qijuHistory) GM.qijuHistory = [];
  var _statusLabel = status === 'promulgated' ? '\u9881\u884C\u5929\u4E0B' : '\u8BCF\u4E66\u624B\u7A3F';
  var _headline = '\u3010\u8BCF\u4E66\u00B7' + _statusLabel + '\u00B7\u7B2C' + polishVersion + '\u6B21\u6DA6\u8272\u00B7' + styleLabel + '\u3011';
  if (typeof TM !== 'undefined' && TM.Qiju) TM.Qiju.recordEntry({
    turn: _curTurn,
    time: rec.time,
    category: '\u8BCF\u4EE4',
    content: _headline + '\n' + text,
    _edictRef: rec.id
  });

  _hidePolishedEdict();
  if (typeof renderQiju === 'function') renderQiju();
}




// 注册结算步骤（top-level·使存档加载路径也生效——
// 历史问题：原先放在 startGame 内·loadFromSlot/fullLoadGame 不会走 startGame·
// 导致存档玩家全部信件永远卡 traveling·UI 显示"信使逾期/失踪"。）
if (typeof window !== 'undefined') {
  window._polishEdicts = _polishEdicts;
  window._applyPolishedEdict = _applyPolishedEdict;
  window._hidePolishedEdict = _hidePolishedEdict;
}
