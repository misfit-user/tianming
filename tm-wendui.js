// @ts-check
/// <reference path="types.d.ts" />
// ── 章节导航（grep 小节标题跳转，行号会漂）──
//   问对系统（R132 从 tm-memorials.js 拆出·姊妹 tm-memorials / tm-office-runtime）
//   §1 问对       正式问对 / 密问 / 独召·弹窗模式 + 发起人选择 + 对话推进 + 提示词生成 + 结算
//   §2 求见队列   已见 → 移出待接见队列 · 压抑动态求见到下一回合
//   §3 视图       按人物视图 / 按事类视图 / 时间线视图（按回合分组）
// ─────────────────────────────────────────────
// ============================================================
// tm-wendui.js — 问对系统 (R132 从 tm-memorials.js L867-3057 拆出)
// 姊妹: tm-memorials.js (真·奏疏) + tm-office-runtime.js (官员表 UI)
// 包含: 正式问对/密问/独召·问对弹窗模式+发起人选择+对话推进+提示词生成+结算
// ============================================================

// ============================================================
//  问对（弹窗模式）
// ============================================================
var _wenduiMode = 'formal';
var _wenduiSending = false;

function _wdFactionValues(src) {
  var out = [];
  if (!src) return out;
  if (Array.isArray(src)) {
    src.forEach(function(f) { if (f) out.push(f); });
    return out;
  }
  if (typeof src === 'object') {
    Object.keys(src).forEach(function(k) {
      var v = src[k];
      if (!v || typeof v !== 'object') return;
      if (!v.name && k) {
        try {
          var copy = {};
          Object.keys(v).forEach(function(vk) { copy[vk] = v[vk]; });
          copy.name = k;
          out.push(copy);
        } catch (_) {
          v.name = k;
          out.push(v);
        }
      } else {
        out.push(v);
      }
    });
  }
  return out;
}

function _wdFindFaction(name) {
  if (!name) return null;
  var lists = [];
  if (typeof GM !== 'undefined' && GM) lists.push(GM.facs, GM.factions);
  // 防串台：只补当前激活剧本的 P 势力（否则按名查势力可能命中别的剧本的同名/异名势力）
  if (typeof P !== 'undefined' && P) { var _af = (typeof _tmActiveScenarioRows==='function') ? _tmActiveScenarioRows : function(a){return a;}; lists.push(_af(P.facs), _af(P.factions)); }
  try {
    var sc = (typeof findScenarioById === 'function' && GM && GM.sid) ? findScenarioById(GM.sid) : null;
    if (sc) lists.push(sc.factions);
  } catch (_) {}
  var target = String(name).replace(/[\s·\-—]/g, '');
  var seen = {};
  var all = [];
  lists.forEach(function(list) {
    _wdFactionValues(list).forEach(function(f) {
      var key = f && (f.name || f.id || f.label || f.title);
      if (!key || seen[key]) return;
      seen[key] = true;
      all.push(f);
    });
  });
  return all.find(function(f) {
    if (!f) return false;
    var keys = [f.name, f.id, f.label, f.title, f.shortName, f.alias];
    return keys.some(function(k) {
      return k && String(k).replace(/[\s·\-—]/g, '') === target;
    });
  }) || null;
}

function _wdIsPlayerConsort(ch) {
  if (typeof _tmIsPlayerConsort === 'function') {
    try { return !!_tmIsPlayerConsort(ch); } catch (_) {}
  }
  return !!(ch && ch.spouse === true);
}

function _wdIsPlayerSideChar(ch) {
  if (!ch || ch.alive === false || ch.dead || ch.isPlayer) return false;
  if (ch._envoy || ch.isEnvoy || ch.fromFaction) return false;
  if (_wdIsPlayerConsort(ch)) return true;
  if (typeof _tmIsPlayerFactionCharLoose === 'function') {
    try { if (_tmIsPlayerFactionCharLoose(ch)) return true; } catch (_) {}
  }
  var explicit = [];
  if (typeof _tmCharacterFactionValues === 'function') {
    try { explicit = _tmCharacterFactionValues(ch); } catch (_) { explicit = []; }
  } else {
    explicit = [ch.faction, ch.factionName, ch.currentFaction, ch.allegiance, ch.country, ch.polity, ch.realm, ch.kingdom, ch.force, ch.camp];
  }
  explicit = explicit.filter(function(x) { return x != null && String(x).trim(); });
  if (explicit.length === 0) return true;
  return false;
}

function _wdCanDirectAudience(ch) {
  return !!(ch && _wdIsPlayerSideChar(ch) && _wdIsAtCapital(ch));
}

/**
 * 渲染问对面板中的角色网格（仅在京臣子可点击）
 */
function renderWenduiChars(force){
  // 性能·2026-06-10·与纪录类面板同范式:gt-wendui 隐藏时跳过(renderGameState 尾部无条件调它·
  // 全名册数百卡+肖像重建纯浪费)·切到该页时 switchGTab 传 force=true 强制渲染
  if(!force && typeof _gtTabVisible==='function' && !_gtTabVisible('gt-wendui')) return;
  var el=_$("wendui-chars");if(!el)return;
  var wenduiPeople = (GM.chars||[]).filter(function(c){ return _wdIsPlayerSideChar(c); });
  var atCap = wenduiPeople.filter(function(c){return _wdIsAtCapital(c);});
  var away = wenduiPeople.filter(function(c){return !_wdIsAtCapital(c);});
  var html = '';

  // 工具：根据角色推断卡片左边色类
  function _wdCardClass(ch) {
    var t = (ch.title || '') + ' ' + (ch.officialTitle || '');
    if (_wdIsPlayerConsort(ch)) return 'wdp-consort';
    if (/\u4E1C\u5382|\u53F8\u793C|\u5B98|\u592A\u76D1/.test(t)) return 'wdp-eunuch'; // 宦官
    if (/\u5C06\u519B|\u603B\u5175|\u603B\u7763|\u6307\u6325|\u6307\u6325\u4F7F/.test(t)) return 'wdp-mili'; // 武将
    if (ch.party === '\u4E1C\u6797\u515A' || ch.faction === '\u4E1C\u6797') return 'wdp-dongin';
    if (ch.party && /\u6D59/.test(ch.party)) return 'wdp-zhejian';
    return 'wdp-civil';
  }
  // 工具：忠诚色
  function _wdLoyClass(loy) {
    var v = Number(loy) || 50;
    if (v >= 75) return 'wdp-loy-hi';
    if (v >= 45) return 'wdp-loy-mid';
    return 'wdp-loy-lo';
  }
  // 工具：派系标签
  function _wdFactionTag(ch) {
    if (_wdIsPlayerConsort(ch)) return '<span class="wdp-tag" style="color:var(--vermillion-300);">\u5BAB\u773B</span>';
    if (ch.party) return '<span class="wdp-tag" style="color:var(--celadon-400);">' + escHtml(String(ch.party).slice(0,4)) + '</span>';
    if (ch.faction && ch.faction !== '\u671D\u5EF7') return '<span class="wdp-tag" style="color:var(--indigo-400);">' + escHtml(String(ch.faction).slice(0,4)) + '</span>';
    if (/\u5C06\u519B|\u603B\u5175|\u603B\u7763/.test(ch.title||'')) return '<span class="wdp-tag" style="color:var(--vermillion-400);">\u6B66\u5C06</span>';
    if (/\u53F8\u793C|\u592A\u76D1/.test(ch.title||'')) return '<span class="wdp-tag" style="color:var(--purple-400,#8e6aa8);">\u5BA6\u5B98</span>';
    return '';
  }

  // 【阶下待见】使节/外藩/AI推送
  // 存量清洗(2026-07-04)：旧版 NPC 社交行动无阵营闸·外邦君主(皇太极等)曾被排进求见队列并喂入推演。渲染时滤除已混入的明确异势力人物·救活污染存档免回档。使节(isEnvoy/fromFaction)/后妃(isConsort·消费侧另有专检)/剧本预置(_sid/_opening·作者意图)/空 faction 者均放行;查无此人留给消费侧既有兜底。
  if (Array.isArray(GM._pendingAudiences) && GM._pendingAudiences.length > 0) {
    GM._pendingAudiences = GM._pendingAudiences.filter(function(q) {
      if (!q || !q.name) return true;
      if (q.isEnvoy || q.fromFaction || q.isConsort || q._sid || q._opening) return true;
      var _qCh = (typeof findCharByName === 'function') ? findCharByName(q.name) : null;
      if (!_qCh) return true;
      if (typeof _tmIsForeignCourtChar === 'function' && _tmIsForeignCourtChar(_qCh)) return false;
      return true;
    });
  }
  if (Array.isArray(GM._pendingAudiences) && GM._pendingAudiences.length > 0) {
    html += '<div class="wdp-group wdp-g-envoy">';
    html += '<div class="wdp-group-title"><span class="tag">\u9636 \u4E0B \u5F85 \u89C1</span><span class="desc">\u4F7F\u8282\u00B7\u5916\u85E9\u00B7\u7279\u8BF7\u00B7\u7B49\u5F85\u9661\u4E0B\u51B3\u65AD</span><span class="count">' + GM._pendingAudiences.length + ' \u4EBA</span></div>';
    html += '<div class="wdp-req-list">';
    GM._pendingAudiences.forEach(function(q, qi) {
      var _nm = escHtml(q.name || '?');
      var _initial = escHtml(String(q.name||'?').charAt(0));
      var _envoyB = q.isEnvoy ? '<span class="wdp-envoy-badge">\u4F7F\u8282</span>' : '';
      html += '<div class="wdp-req-item">';
      html += '<div class="wdp-req-portrait">' + _initial + _envoyB + '</div>';
      html += '<div class="wdp-req-info"><div class="wdp-req-name">' + _nm + '</div><div class="wdp-req-reason">' + escHtml((q.reason || '').substring(0, 80)) + '</div></div>';
      html += '<div class="wdp-req-actions">';
      html += '<button class="wdp-req-btn" onclick="_wdOpenAudienceQueue(' + qi + ')">\u63A5\u89C1</button>';
      html += '<button class="wdp-req-btn dismiss" onclick="_wdDismissPending(' + qi + ')">\u6682\u5374</button>';
      html += '</div></div>';
    });
    html += '</div></div>';
  }

  // 【有臣求见】朱砂高亮
  var _seekAudience = atCap.filter(function(c) {
    if (c.isPlayer) return false;
    if (c._mourning) return false;
    if (c._lastMetTurn === GM.turn) return false;
    try {
      var _sa = (typeof _wdDeriveAudienceAgenda === 'function') ? _wdDeriveAudienceAgenda(c) : null;
      if (_sa && _sa.seek) return true;
    } catch (_) {}
    if (GM.letters) {
      var _hasUn = GM.letters.some(function(l) { return l._npcInitiated && l.from === c.name && l._replyExpected && !l._playerReplied && l.status === 'returned'; });
      if (_hasUn) return true;
    }
    return false;
  });
  if (_seekAudience.length > 0) {
    html += '<div class="wdp-group wdp-g-seeking">';
    html += '<div class="wdp-group-title"><span class="tag">\u6709 \u81E3 \u6C42 \u89C1</span><span class="desc">\u5FE0\u6781\u9AD8\u6216\u5FC3\u6709\u5FE7\u4E8B\u8005\u00B7\u53EF\u901F\u89C1\u4EE5\u5B89\u5176\u5FC3</span><span class="count">' + _seekAudience.length + ' \u4EBA</span></div>';
    html += '<div class="wdp-req-list">';
    _seekAudience.forEach(function(ch) {
      var reason = '';
      if ((ch.stress||0) > 60) reason = '\u9762\u5E26\u5FE7\u8272\uFF0C\u4F3C\u6709\u4E3A\u96BE\u4E4B\u4E8B';
      else if ((ch.loyalty||50) > 90 && (ch.stress||0) > 30) reason = '\u795E\u8272\u51DD\u91CD\uFF0C\u6B32\u8FDB\u5FE0\u8A00';
      else if ((ch.ambition||50) > 80) reason = '\u7CBE\u795E\u6296\u64DE\uFF0C\u6B32\u5448\u7B56\u8BBA';
      else reason = '\u5019\u4E8E\u6BBF\u5916\uFF0C\u8BF7\u6C42\u9762\u5723';
      try { var _ra = (typeof _wdDeriveAudienceAgenda === 'function') ? _wdDeriveAudienceAgenda(ch) : null; if (_ra && _ra.brief) reason = _ra.brief; } catch (_) {}
      if (GM.letters && GM.letters.some(function(l) { return l._npcInitiated && l.from === ch.name && l._replyExpected && !l._playerReplied && l.status === 'returned'; })) {
        reason = '\u524D\u65E5\u6765\u51FD\u672A\u83B7\u56DE\u590D\uFF0C\u4EB2\u81F3\u6C42\u89C1';
      }
      var _safeName = ch.name.replace(/'/g, "\\'");
      var _initial = escHtml(String(ch.name||'?').charAt(0));
      var _portraitHtml = ch.portrait ? '<img src="'+escHtml(ch.portrait)+'" loading="lazy" decoding="async">' : _initial;
      html += '<div class="wdp-req-item">';
      html += '<div class="wdp-req-portrait">' + _portraitHtml + '</div>';
      html += '<div class="wdp-req-info"><div class="wdp-req-name">' + escHtml(ch.name) + '</div><div class="wdp-req-reason">' + reason + '</div></div>';
      html += '<div class="wdp-req-actions">';
      html += '<button class="wdp-req-btn" onclick="_wdOpenAudience(\'' + _safeName + '\')">\u63A5\u89C1</button>';
      html += '<button class="wdp-req-btn dismiss" onclick="_wdDenyAudience(\'' + _safeName + '\')">\u4E0D\u89C1</button>';
      html += '</div></div>';
    });
    html += '</div></div>';
  }

  // 【百官候旨】卡片网格
  var _nonSeeking = atCap.filter(function(c) { return _seekAudience.indexOf(c) < 0; });
  if (_nonSeeking.length > 0) {
    html += '<div class="wdp-group wdp-g-incap">';
    html += '<div class="wdp-group-title"><span class="tag">\u767E \u5B98 \u5019 \u65E8</span><span class="desc">\u73B0\u5728\u4EAC\u4E2D\u00B7\u53EF\u968F\u65F6\u53EC\u5BF9</span><span class="count">' + _nonSeeking.length + ' \u4EBA</span></div>';
    html += '<div class="wdp-char-grid">';
    _nonSeeking.forEach(function(ch) {
      var _cardCls = _wdCardClass(ch);
      var _loyCls = _wdLoyClass(ch.loyalty);
      var _hasHist = (GM.wenduiHistory && GM.wenduiHistory[ch.name] && GM.wenduiHistory[ch.name].length > 0);
      var _loyDisp = typeof _fmtNum1==='function' ? _fmtNum1(ch.loyalty) : (ch.loyalty||0);
      var _initial = escHtml(String(ch.name||'?').charAt(0));
      var _portraitHtml = ch.portrait ? '<img src="'+escHtml(ch.portrait)+'" loading="lazy" decoding="async">' : _initial;
      var _spouseMark = _wdIsPlayerConsort(ch) ? '<span class="spouse">\u2766</span>' : '';
      html += '<div class="wdp-char-card ' + _cardCls + ' ' + _loyCls + (_hasHist?' has-hist':'') + '" onclick="openWenduiPick(\'' + ch.name.replace(/'/g,"") + '\')">';
      html += '<div class="wdp-char-top">';
      html += '<div class="wdp-portrait">' + _portraitHtml + '</div>';
      html += '<div class="wdp-name-wrap">';
      html += '<div class="wdp-name">' + escHtml(ch.name) + _spouseMark + '</div>';
      html += '<div class="wdp-char-title">' + escHtml((ch.officialTitle || ch.title || '').slice(0,14)) + '</div>';
      html += '</div></div>';
      html += '<div class="wdp-char-bottom">';
      html += '<span class="wdp-loyalty">\u5FE0 <span class="num">' + _loyDisp + '</span></span>';
      html += _wdFactionTag(ch);
      html += '</div></div>';
    });
    html += '</div></div>';
  }

  // 【远方臣子】灰度
  if (away.length > 0) {
    var _playerLoc2 = (typeof _getPlayerLocation === 'function') ? _getPlayerLocation() : (GM._capital||'京城');
    html += '<div class="wdp-group wdp-g-away">';
    html += '<div class="wdp-group-title"><span class="tag">\u8FDC \u65B9 \u81E3 \u5B50</span><span class="desc">\u4E0D\u5728' + escHtml(_playerLoc2) + '\u00B7\u9700\u53EC\u56DE\u6216\u9E3F\u96C1\u4F20\u4E66</span><span class="count">' + away.length + ' \u4EBA</span></div>';
    html += '<div class="wdp-away-list">';
    away.forEach(function(ch) {
      var loc = ch.location || '\u8FDC\u65B9';
      var travel = ch._travelTo ? '<span class="travel">\u2192' + escHtml(ch._travelTo) + '</span>' : '';
      html += '<div class="wdp-away-item" title="' + escHtml(loc + (ch._travelTo?' \u2192'+ch._travelTo:'')) + '">' + escHtml(ch.name) + ' <span class="loc">' + escHtml(loc.slice(0,6)) + '</span>' + travel + '</div>';
    });
    html += '</div></div>';
  }

  el.innerHTML = html;
}

function _wdIsAtCapital(ch) {
  if (!ch || ch.alive === false) return false;
  // 使用玩家所在地而非固定京城
  var playerLoc = (typeof _getPlayerLocation === 'function') ? _getPlayerLocation() : (GM._capital || '京城');
  var loc = ch.location || (GM._capital || '京城');
  if (ch._travelTo) return false;
  // 宽松匹配——紫禁城·乾清宫 / 坤宁宫 / 京师·文渊阁 视为同地
  return (typeof _isSameLocation === 'function') ? _isSameLocation(loc, playerLoc) : (loc === playerLoc);
}

/**
 * 点击角色 → 弹出模式选择对话框
 */
function openWenduiPick(name) {
  // 自检·不得对自己发起问对
  try {
    var _slfPk = (P.playerInfo && P.playerInfo.characterName) || '';
    if (_slfPk && _slfPk === name) {
      if (typeof toast === 'function') toast('不能召见自己');
      return;
    }
  } catch(_){}
  var ch = findCharByName(name); if (!ch) return;
  var hist = GM.wenduiHistory && GM.wenduiHistory[name] && GM.wenduiHistory[name].length > 0;
  var _initial = escHtml(String(name||'?').charAt(0));
  var _portraitHtml = ch.portrait ? '<img src="'+escHtml(ch.portrait)+'" loading="lazy" decoding="async">' : _initial;
  var _subTitle = escHtml((ch.officialTitle || ch.title || '').slice(0,20)) + (_wdIsPlayerConsort(ch) ? ' \u00B7 \u540E\u59C3' : '');
  var modal = document.createElement('div');
  modal.className = 'modal-bg show';
  modal.id = 'wd-pick-modal';
  modal.innerHTML = '<div class="wdp-pick-modal-inner">'
    + '<div class="wdp-pick-portrait">' + _portraitHtml + '</div>'
    + '<div class="wdp-pick-name">\u53EC \u89C1 \u00B7 ' + escHtml(name) + '</div>'
    + '<div class="wdp-pick-title">' + _subTitle + '</div>'
    + (hist ? '<div class="wdp-pick-hist">\u6B64\u524D\u6709 ' + GM.wenduiHistory[name].length + ' \u6761\u5BF9\u8BDD\u8BB0\u5F55</div>' : '')
    + '<div class="wdp-pick-modes">'
    + '<div class="wdp-mode-card sel" id="wd-pick-formal" onclick="_wdPickMode(\'formal\')">'
    +   '<div class="icon">\u6BBF</div><div class="name">\u671D\u5802\u95EE\u5BF9</div>'
    +   '<div class="desc">\u8D77\u5C45\u6CE8\u5B98\u5728\u573A\u00B7\u4E25\u8083\u6B63\u5F0F\u00B7\u8A00\u8F9E\u6709\u5EA6</div>'
    + '</div>'
    + '<div class="wdp-mode-card" id="wd-pick-private" onclick="_wdPickMode(\'private\')">'
    +   '<div class="icon">\u5BC6</div><div class="name">\u79C1\u4E0B\u53D9\u8C08</div>'
    +   '<div class="desc">\u5C4F\u9000\u5DE6\u53F3\u00B7\u66F4\u5766\u8BDA\u4EA6\u66F4\u7D6E\u53E8</div>'
    + '</div>'
    + '</div>'
    + '<div class="wdp-pick-actions">'
    +   '<button class="wdp-pick-btn primary" onclick="_wdConfirmPick(\'' + name.replace(/'/g,"") + '\')">\u53EC\u3000\u89C1</button>'
    +   '<button class="wdp-pick-btn secondary" onclick="document.getElementById(\'wd-pick-modal\').remove()">\u53D6\u3000\u6D88</button>'
    + '</div>'
    + '</div>';
  document.body.appendChild(modal);
}

var _wdPickedMode = 'formal';
function _wdPickMode(mode) {
  _wdPickedMode = mode;
  var f = _$('wd-pick-formal'), p = _$('wd-pick-private');
  if (f) f.classList.toggle('sel', mode === 'formal');
  if (p) p.classList.toggle('sel', mode === 'private');
}

function _wdConfirmPick(name) {
  var m = _$('wd-pick-modal'); if (m) m.remove();
  openWenduiModal(name, _wdPickedMode);
}

/**
 * 打开问对聊天弹窗（核心函数）
 * @param {string} name - 角色名
 * @param {string} mode - 'formal' 或 'private'
 * @param {string} [prefillMsg] - 预填消息（如从奏疏传召）
 */
function openWenduiModal(name, mode, prefillMsg) {
  // 自检·不得对自己发起问对
  try {
    var _slfNm = (P.playerInfo && P.playerInfo.characterName) || '';
    if (_slfNm && _slfNm === name) {
      if (typeof toast === 'function') toast('不能召见自己');
      return;
    }
  } catch(_){}
  // 位置/状态 gate·不在京师/下狱/流放/死亡者不得召对·改导向鸿雁传书
  var _gCh = (typeof findCharByName === 'function') ? findCharByName(name) : null;
  if (_gCh) {
    if (!_gCh._envoy && !_wdIsPlayerSideChar(_gCh)) {
      if (typeof toast === 'function') toast(name + '不属本朝可直接召见人员，请经使节或鸿雁往来。');
      return;
    }
    // 2026-05-21·下狱者不再阻断·改导向"狱中问对"模式 (tm-wendui-prison.js)
    if ((_gCh._imprisoned || _gCh.imprisoned) && typeof window !== 'undefined' && window.WenduiPrison && typeof window.WenduiPrison.openPrompt === 'function') {
      window.WenduiPrison.openPrompt(name, _gCh, mode);
      return;
    }
    var _reasons = [];
    if (_gCh.alive === false || _gCh.dead) _reasons.push('已薨');
    if (_gCh._imprisoned || _gCh.imprisoned) _reasons.push('下狱');  // fallback·若 prison 模块未加载
    if (_gCh._exiled || _gCh.exiled) _reasons.push('流放');
    if (_gCh._retired) _reasons.push('致仕');
    if (_gCh._mourning) _reasons.push('丁忧');
    if (_gCh._fled) _reasons.push('逃亡');
    if (_gCh._missing) _reasons.push('失踪');
    if (typeof _gCh.health === 'number' && _gCh.health <= 10) _reasons.push('病重');
    // 位置判定·不在京师且无其他 reasons 则 reasons 加"在远方"
    if (_reasons.length === 0) {
      var _playerLocC = (typeof _getPlayerLocation === 'function') ? _getPlayerLocation() : (GM._capital || '京师');
      var _locRaw = _gCh.location || '';
      var _loc = String(_locRaw || '').replace(/\s/g,'');
      // 2026-06-26 使节/外藩使者本就是来御前求见的·永远视作"在御前"·不受位置门拦(否则玩家不在都城时使节被判"远在·不能召见")
      var _isAtCap = !_locRaw || _gCh._envoy || _gCh.fromFaction || ((typeof _isSameLocation === 'function') ? _isSameLocation(_locRaw, _playerLocC) : (_loc === String(_playerLocC || '').replace(/\s/g,'')));
      // 也考虑在途·若正赴京则仍不在京
      if (!_isAtCap || _gCh._travelTo || _gCh._enRouteToOffice) {
        _reasons.push('远在' + (_loc || '外地') + (_gCh._travelTo ? ('·正赴 '+_gCh._travelTo) : ''));
      }
    }
    if (_reasons.length > 0) {
      var _msg = name + ' 目下 '+_reasons.join('·')+'·不能召见。';
      if (!/已薨|下狱|流放/.test(_reasons.join(''))) _msg += '\n\n可改遣鸿雁传书。';
      if (typeof toast === 'function') toast(_msg.split('\n')[0]);
      // 对远方者·直接跳传书
      if (!/已薨|下狱|流放|病重/.test(_reasons.join(''))) {
        if (typeof switchGTab === 'function') switchGTab(null, 'gt-letter');
        if (typeof GM !== 'undefined') GM._pendingLetterTo = name;
        setTimeout(function(){ if (typeof renderLetterPanel === 'function') renderLetterPanel(); }, 50);
      }
      return;
    }
  }
  // N4: 问对消耗精力
  if (typeof _spendEnergy === 'function' && !_spendEnergy(5, '问对·' + name)) return;
  _wenduiMode = mode || 'formal';
  try { _wdSessionShichenBase = Math.floor(Math.random() * 9); } catch(_) { _wdSessionShichenBase = 0; }
  GM.wenduiTarget = name;
  if (!GM.wenduiHistory) GM.wenduiHistory = {};
  if (!GM.wenduiHistory[name]) GM.wenduiHistory[name] = [];

  var ch = findCharByName(name);
  // 后宫干政触发——与后妃在朝堂模式问对，登记事件供下回合大臣反应
  if (ch && _wdIsPlayerConsort(ch) && _wenduiMode === 'formal') {
    if (!GM._consortFormalAudiences) GM._consortFormalAudiences = [];
    GM._consortFormalAudiences.push({
      name: name, turn: GM.turn,
      spouseRank: ch.spouseRank || '',
      motherClan: ch.motherClan || '',
      processed: false
    });
    if (typeof addEB === 'function') addEB('\u540E\u5BAB', '\u671D\u5802\u95EE\u5BF9' + name + '\u00B7\u6B64\u4E3E\u5F15\u5916\u81E3\u4FA7\u76EE');
  }
  // L4·a·加 cedui mode label
  var modeLabel = _wenduiMode === 'private' ? '私下叙谈' :
                  _wenduiMode === 'cedui' ? '改革策对' :
                  '朝堂问对';

  // 创建全屏弹窗
  var modal = document.createElement('div');
  modal.className = 'modal-bg show';
  modal.id = 'wendui-modal';
  modal.style.cssText = '-webkit-app-region:no-drag;';
  modal.innerHTML = '<div class="wd-modal-inner">'
    // 顶栏
    + '<div class="wd-modal-header">'
    + '<div class="wd-modal-header-left">'
    + '<button class="bt bsm" id="wd-screen-btn" onclick="_wdToggleScreen()" title="屏退左右·本次问对内容不外泄（然外廷仍知陛下有密谈）">屏退</button>'
    + '<button class="bt bsm" onclick="_wdDirectOrder()" title="面谕当面差遣·确定性记入承诺追踪（不靠AI事后抽取）">差遣</button>'
    + '<button class="bt bsm" onclick="_wdShowCommitTracker()" title="查看朕已交办的全部事项·进度/期限/复命·谁在拖谁办砸">交办</button>'
    + '<button class="bt bsm" id="wd-edict-btn" onclick="_wdAddToEdict()" title="\u5148\u5212\u9009\u5927\u81E3\u53D1\u8A00\u4E2D\u7684\u6587\u5B57\uFF0C\u518D\u70B9\u6B64\u6309\u94AE\u6458\u5165\u5EFA\u8BAE\u5E93">\u6458\u5165\u5EFA\u8BAE\u5E93</button>'
    + '<button class="bt bsm" onclick="_wdSummonConfronter()" title="\u53EC\u5165\u7B2C\u4E8C\u4EBA\u5F53\u9762\u5BF9\u8D28">\u53EC\u4EBA\u5BF9\u8D28</button>'
    + '<button class="bt bsm" style="color:var(--celadon-400);" onclick="_wdReward()" title="\u5F53\u573A\u8D4F\u8D50">\u8D4F</button>'
    + '<button class="bt bsm" style="color:var(--vermillion-400);" onclick="_wdPunish()" title="\u5F53\u573A\u5904\u7F5A">\u7F5A</button>'
    + ((ch && !ch._envoy && !ch.fromFaction) ? '<button class="bt bsm" style="color:var(--gold-400);" onclick="_wdAdoptCounsel()" title="\u5609\u7EB3\u5176\u8A00\u00B7\u660E\u541B\u7EB3\u8C0F\uFF08\u7687\u5A01+\u00B7\u8FDB\u8A00\u8005\u77E5\u9047\u00B7\u5165\u8D77\u5C45\u6CE8\u5F85\u529E\uFF09">\u7EB3\u8C0F</button>' : '')
    + ((ch && (ch._envoy || ch.fromFaction)) ? ('<button class="bt bsm" style="color:var(--gold-400);" onclick="_wdEnvoyDecision(\'accept\')" title="\u51C6\u5176\u6240\u8BF7\u00B7\u6539\u5584\u90A6\u4EA4\uFF08\u6309\u4F7F\u547D\u5B9A\u6548\u679C\u00B7\u548C\u4EB2/\u8BF7\u548C/\u7ED3\u76DF/\u7EB3\u8D21\uFF09">\u51C6\u594F</button>'
        + '<button class="bt bsm" style="color:var(--vermillion-400);" onclick="_wdEnvoyDecision(\'reject\')" title="\u9A73\u5176\u6240\u8BF7\u00B7\u90A6\u4EA4\u8F6C\u51B7\u6216\u751F\u8FB9\u8845\uFF08\u7D22\u8D21\u53EF\u65A5\u9000\u7ACB\u5A01\uFF09">\u9A73\u56DE</button>'
        + '<button class="bt bsm" onclick="_wdEnvoyDecision(\'temporize\')" title="\u7F81\u7E3B\u6577\u884D\u00B7\u4E0D\u5373\u5B9A\u593A\u00B7\u5C0F\u635F\u90A6\u4EA4\u4EE5\u6362\u65F6\u95F4">\u7F81\u7E3B</button>') : '')
    + '</div>'
    + '<div class="wd-modal-header-center">'
    + '<div class="wd-modal-char-name">' + escHtml(name) + '</div>'
    + '<div class="wd-modal-char-sub">' + escHtml(ch ? (ch.title || '') : '') + ' · ' + modeLabel
    + ' · <span id="wd-char-loyalty" style="color:' + (ch && ch.loyalty > 70 ? 'var(--green)' : ch && ch.loyalty < 30 ? 'var(--red)' : 'var(--txt-s)') + ';">忠' + (ch ? (typeof _fmtNum1==='function'?_fmtNum1(ch.loyalty):ch.loyalty) : '?') + '</span></div>'
    + '</div>'
    + '<button class="bt bsm wd-modal-close" onclick="closeWenduiModal()">✕</button>'
    + '</div>'
    // 立绘对话两栏：左立绘舞台 + 右(原 hint/topics/chat/footer)·2026-06 landing
    + '<div class="wd-modal-body">'
    + '<div class="wd-actor">'
    +   '<div class="wd-actor-stage">' + (ch && ch.portrait ? '<img class="wd-actor-img" src="' + escHtml(ch.portrait) + '" alt="">' : '<div class="wd-actor-ph">' + escHtml(String(name||'?').charAt(0)) + '</div>') + '<div class="wd-actor-vig"></div></div>'
    +   '<div class="wd-actor-plate"><div class="wd-actor-nm">' + escHtml(name) + '</div><div class="wd-actor-rl">' + escHtml(ch ? (ch.officialTitle || ch.title || '') : '') + ' · ' + modeLabel + '</div></div>'
    + '</div>'
    + '<div class="wd-main">'
    // 提示 + 情绪指示条
    + '<div class="wd-modal-hint"><span>\u5212\u51FA\u5927\u81E3\u8BF4\u7684\u8BDD\u52A0\u5165\u5EFA\u8BAE\u5E93</span>'
    + '<span id="wd-emotion-bar" style="margin-left:var(--space-3);font-size:0.7rem;"><span style="color:var(--celadon-400);">\u955C\u5B9A</span> <span id="wd-emotion-dots" class="wd-emo-track"><i class="wd-emo-mark"></i></span><span style="color:var(--vermillion-400);">\u7D27\u5F20</span></span>'
    + '</div>'
    // 推荐话题
    + '<div id="wd-topics" style="display:flex;gap:4px;flex-wrap:wrap;padding:2px 8px;"></div>'
    // 聊天区
    + '<div class="wd-modal-chat" id="wd-modal-chat"></div>'
    // 输入区
    + '<div class="wd-modal-footer">'
    + '<div style="display:flex;gap:var(--space-2);align-items:flex-end;">'
    + '<div style="display:flex;gap:var(--space-2);margin-bottom:var(--space-1);align-items:center;">'
    + '<span style="font-size:var(--text-xs);color:var(--color-foreground-muted);">\u8BED\u6C14</span>'
    + '<select id="wd-tone" style="font-size:var(--text-xs);padding:2px 6px;background:var(--color-elevated);border:1px solid var(--color-border);color:var(--color-foreground);border-radius:var(--radius-sm);">'
    + '<option value="direct">\u76F4\u95EE</option><option value="probing">\u65C1\u6572\u4FA7\u51FB</option>'
    + '<option value="pressing">\u65BD\u538B\u903C\u95EE</option><option value="flattering">\u865A\u4E0E\u59D4\u86C7</option>'
    + '<option value="silence">\u6C89\u9ED8\u4EE5\u5BF9</option></select></div>'
    + '<textarea id="wd-modal-input" class="wd-modal-textarea" placeholder="请输入……" rows="3" maxlength="5000" oninput="_wdUpdateCounter()"></textarea>'
    + '<div style="display:flex;flex-direction:column;gap:var(--space-1);">'
    + '<button class="bt bp bsm" onclick="sendWendui()" id="wd-send-btn" title="发送">奉旨</button>'
    + '<button class="bt bs bsm" onclick="closeWenduiModal()" title="退下">退下</button>'
    + '</div></div>'
    + '<div id="wd-char-counter" style="text-align:right;font-size:var(--text-xs);color:var(--color-foreground-muted);margin-top:2px;">0/5000</div>'
    + '</div>'
    + '</div>'
    + '</div>'
    + '</div>';
  document.body.appendChild(modal);

  // 2026-06 faithful landing·重排为预览版式（动作钮入立绘名牌·顶栏=印+朝堂问对+情绪条·保留全部 onclick/id）
  try {
    var _hl = modal.querySelector('.wd-modal-header-left');
    var _ap = modal.querySelector('.wd-actor-plate');
    if (_hl && _ap) {
      var _acts = document.createElement('div'); _acts.className = 'wd-actor-acts';
      while (_hl.firstChild) _acts.appendChild(_hl.firstChild);
      _ap.appendChild(_acts);
    }
    var _hc = modal.querySelector('.wd-modal-header-center');
    if (_hc) _hc.innerHTML = '<div class="wd-modal-title">' + escHtml(modeLabel) + '</div>';
    var _hdr = modal.querySelector('.wd-modal-header');
    if (_hdr && !_hdr.querySelector('.wd-modal-seal')) {
      var _sd = document.createElement('div'); _sd.className = 'wd-modal-seal';
      _sd.textContent = (_wenduiMode === 'private') ? '密' : (_wenduiMode === 'cedui') ? '策' : '对';
      _hdr.insertBefore(_sd, _hdr.firstChild);
    }
    var _emo = modal.querySelector('#wd-emotion-bar');
    if (_emo && _hdr) { _emo.classList.add('wd-modal-emo'); _hdr.insertBefore(_emo, _hdr.querySelector('.wd-modal-close')); }
    var _hint = modal.querySelector('.wd-modal-hint'); if (_hint) _hint.style.display = 'none';
    // 话题行移到聊天区下方·footer 之上（对齐预览）
    var _tp = modal.querySelector('#wd-topics'); var _ft = modal.querySelector('.wd-modal-footer');
    if (_tp && _ft && _ft.parentNode) _ft.parentNode.insertBefore(_tp, _ft);
    var _rl = modal.querySelector('.wd-actor-rl');
    if (_rl && ch && !modal.querySelector('#wd-char-loyalty')) {
      _rl.innerHTML += ' · <span id="wd-char-loyalty" style="color:' + (ch.loyalty > 70 ? 'var(--green)' : ch.loyalty < 30 ? 'var(--red)' : 'var(--txt-s)') + ';">忠' + (typeof _fmtNum1 === 'function' ? _fmtNum1(ch.loyalty) : ch.loyalty) + '</span>';
    }
    // 朝议在列·在朝可召之臣（当前高亮·点击换召）
    var _actor = modal.querySelector('.wd-actor');
    if (_actor && typeof GM !== 'undefined' && GM.chars && !_actor.querySelector('.wd-court')) {
      var _ploc = (typeof _getPlayerLocation === 'function') ? _getPlayerLocation() : '';
      var _peers = [];
      for (var _pi = 0; _pi < GM.chars.length && _peers.length < 7; _pi++) {
        var _c = GM.chars[_pi];
        if (!_c || _c.name === name || _c.isPlayer || _c.alive === false) continue;
        if (_c._envoy || _c._imprisoned || _c.imprisoned || _c._exiled || _c._mourning || _c._retired || _c._fled) continue;
        if (typeof _wdIsPlayerSideChar === 'function' && !_wdIsPlayerSideChar(_c)) continue;
        var _loc = _c.location || '';
        var _atCap = !_loc || (typeof _isSameLocation === 'function' && _isSameLocation(_loc, _ploc)) || _loc.indexOf('京师') >= 0;
        if (!_atCap) continue;
        _peers.push(_c);
      }
      if (_peers.length) {
        var _figs = '<div class="wd-court-fig on" title="' + escHtml(name) + '">' + (ch && ch.portrait ? '<img src="' + escHtml(ch.portrait) + '">' : '<span style="color:#a98f55">' + escHtml(String(name||'?').charAt(0)) + '</span>') + '<span class="wd-court-nm">' + escHtml(name) + '</span></div>';
        _peers.forEach(function(_c) {
          var _pic = _c.portrait ? '<img src="' + escHtml(_c.portrait) + '">' : '<span style="color:#a98f55">' + escHtml(String(_c.name).charAt(0)) + '</span>';
          _figs += '<div class="wd-court-fig" title="' + escHtml(_c.name) + '" onclick="closeWenduiModal();openWenduiPick(\'' + String(_c.name).replace(/'/g, '') + '\')">' + _pic + '<span class="wd-court-nm">' + escHtml(_c.name) + '</span></div>';
        });
        var _strip = document.createElement('div'); _strip.className = 'wd-court';
        _strip.innerHTML = '<span class="wd-court-lab">在朝</span><div class="wd-court-list">' + _figs + '</div>';
        _actor.appendChild(_strip);
      }
    }
  } catch(_wdRelayoutErr) { try { window.TM && TM.errors && TM.errors.captureSilent(_wdRelayoutErr, 'wendui-faithful-relayout'); } catch(_) {} }

  // 渲染聊天记录
  _wdRenderHistory(name, ch);

  // 推荐话题（根据NPC职务+当前局势生成）
  var _topicsEl = _$('wd-topics');
  if (_topicsEl && ch) {
    var _topics = [];
    // 按职务推荐
    var _off = (ch.officialTitle || '').toLowerCase();
    if (_off.indexOf('\u5175') >= 0 || _off.indexOf('\u5C06') >= 0 || _off.indexOf('\u519B') >= 0 || (ch.military || 0) > 65) _topics.push('\u8FB9\u5883\u519B\u60C5\u5982\u4F55');
    if (_off.indexOf('\u6237') >= 0 || _off.indexOf('\u5EA6\u652F') >= 0 || _off.indexOf('\u8D22') >= 0) _topics.push('\u56FD\u5E93\u8D22\u653F\u73B0\u72B6');
    if (_off.indexOf('\u5409') >= 0 || _off.indexOf('\u94E8') >= 0 || _off.indexOf('\u4EBA') >= 0) _topics.push('\u5B98\u5458\u8003\u8BFE\u60C5\u51B5');
    if (_off.indexOf('\u793C') >= 0 || _off.indexOf('\u592A\u5E38') >= 0) _topics.push('\u793C\u5236\u4E0E\u7956\u5236');
    // 按性格/关系推荐
    if ((ch.loyalty || 50) > 80) _topics.push('\u670B\u515A\u4E4B\u5F0A');
    if ((ch.ambition || 50) > 70) _topics.push('\u5BF9\u5F53\u524D\u5C40\u52BF\u6709\u4F55\u770B\u6CD5');
    if (_wdIsPlayerConsort(ch)) _topics.push('\u5BB6\u5E38\u8BDD');
    // 按局势推荐
    if (GM.activeWars && GM.activeWars.length > 0) _topics.push('\u6218\u4E8B\u8FDB\u5C55');
    // 通用
    if (_topics.length === 0) _topics.push('\u8FD1\u6765\u53EF\u6709\u4EC0\u4E48\u8981\u4E8B');
    ['边境军情如何', '官员考课情况', '对当前局势有何看法', '近来朝中可有要事'].forEach(function(_t) { if (_topics.indexOf(_t) < 0 && _topics.length < 4) _topics.push(_t); });
    _topicsEl.innerHTML = _topics.slice(0, 4).map(function(t) {
      return '<button class="bt bsm" style="font-size:0.7rem;padding:1px 6px;color:var(--gold-400);border-color:var(--gold-500);" onclick="var i=_$(\'wd-modal-input\');if(i){i.value=\'' + t.replace(/'/g, '') + '\';i.focus();_wdUpdateCounter();}">' + t + '</button>';
    }).join('');
  }

  // 仪式/氛围选择（第一次对话开始前）
  if (!GM.wenduiHistory[name] || GM.wenduiHistory[name].length === 0) {
    var chatEl0 = _$('wd-modal-chat');
    if (chatEl0 && ch) {
      var _ceremonyDiv = document.createElement('div');
      _ceremonyDiv.id = 'wd-ceremony';
      _ceremonyDiv.style.cssText = 'text-align:center;padding:var(--space-3);';
      if (_wenduiMode === 'formal') {
        _ceremonyDiv.innerHTML = '<div style="font-size:0.75rem;color:var(--ink-300);margin-bottom:var(--space-2);">（' + escHtml(name) + '入殿行礼，候旨。）</div>'
          + '<div style="display:flex;gap:var(--space-2);justify-content:center;">'
          + '<button class="bt bsm" onclick="_wdCeremony(\'seat\')" style="color:var(--celadon-400);">\u8D50\u5EA7</button>'
          + '<button class="bt bsm" onclick="_wdCeremony(\'stand\')">\u4E0D\u8D50\u5EA7</button>'
          + '</div>';
      } else {
        _ceremonyDiv.innerHTML = '<div style="font-size:0.75rem;color:var(--ink-300);margin-bottom:var(--space-2);">（' + escHtml(name) + '入内，左右退下。）</div>'
          + '<div style="display:flex;gap:var(--space-2);justify-content:center;">'
          + '<button class="bt bsm" onclick="_wdCeremony(\'tea\')" style="color:var(--celadon-400);">\u8D50\u8336</button>'
          + '<button class="bt bsm" onclick="_wdCeremony(\'wine\')" style="color:var(--gold-400);">\u8D50\u9152</button>'
          + '<button class="bt bsm" onclick="_wdCeremony(\'none\')">\u76F4\u5165\u6B63\u9898</button>'
          + '</div>';
      }
      chatEl0.appendChild(_ceremonyDiv);
    }
  }
  // 初始化问对状态
  if (!GM._wdState) GM._wdState = {};
  GM._wdState[name] = { emotion: 3, turns: 0, ceremony: '', fatigued: false };

  // 上次问对回顾提示
  var _lastHist = (GM.wenduiHistory[name] || []).filter(function(h) { return h.role === 'npc'; });
  if (_lastHist.length > 0) {
    var _lastReply = _lastHist[_lastHist.length - 1];
    var chatEl = _$('wd-modal-chat');
    if (chatEl) {
      var recap = document.createElement('div');
      recap.style.cssText = 'text-align:center;font-size:0.71rem;color:var(--ink-300);padding:4px 8px;margin-bottom:4px;background:var(--color-elevated);border-radius:4px;';
      recap.textContent = '\u4E0A\u6B21\u95EE\u5BF9\u8981\u70B9\uFF1A' + (_lastReply.content || '').slice(0, 60) + (_lastReply.content && _lastReply.content.length > 60 ? '\u2026' : '');
      chatEl.insertBefore(recap, chatEl.firstChild);
    }
  }

  // 预填消息
  if (prefillMsg) {
    var inp = _$('wd-modal-input');
    if (inp) { inp.value = prefillMsg; _wdUpdateCounter(); inp.focus(); }
  }
}

// 对质：召入第二人（L4·f1·多人对质·_wdConfronters 列表，最多 3 人）
var _wdConfronters = [];
function _wdAddConfronter(nm) {
  if (!nm) return;
  if (!Array.isArray(_wdConfronters)) _wdConfronters = [];
  if (_wdConfronters.indexOf(nm) >= 0) { toast(nm + '已在场'); return; }
  if (_wdConfronters.length >= 3) { toast('对质者最多三人'); return; }
  _wdConfronters.push(nm);
  if (typeof closeGenericModal === 'function') closeGenericModal();
  toast('已召入' + nm + '对质（在场' + _wdConfronters.length + '人）');
  var inp = _$('wd-modal-input');
  if (inp) inp.placeholder = '现在' + (_wdConfronters.length + 1) + '人在场，请发问……';
}
// E2·屏退左右：本次问对内容不外泄（费精力·但密谈本身外廷可知）
var _wdScreened = false;
function _wdToggleScreen() {
  _wdScreened = !_wdScreened;
  var _scBtn = (typeof _$ === 'function') ? _$('wd-screen-btn') : null;
  if (_scBtn) { _scBtn.textContent = _wdScreened ? '已屏退' : '屏退'; _scBtn.style.color = _wdScreened ? 'var(--gold-400)' : ''; }
  var _scChat = (typeof _$ === 'function') ? _$('wd-modal-chat') : null;
  if (_wdScreened) {
    if (typeof _spendEnergy === 'function') _spendEnergy(3, '屏退左右');
    if (_scChat) { var _scd = document.createElement('div'); _scd.style.cssText = 'text-align:center;font-size:0.7rem;color:var(--gold-400);padding:3px;'; _scd.textContent = '（屏退左右，殿中再无第三人。此后所言不外泄；然外廷已知陛下有密谈。）'; _scChat.appendChild(_scd); _scChat.scrollTop = _scChat.scrollHeight; }
  } else if (_scChat) {
    var _scd2 = document.createElement('div'); _scd2.style.cssText = 'text-align:center;font-size:0.7rem;color:var(--txt-d);padding:3px;'; _scd2.textContent = '（召左右复入。）'; _scChat.appendChild(_scd2); _scChat.scrollTop = _scChat.scrollHeight;
  }
}
// #5·即时差遣：面谕当面下达·确定性成约束承诺（接 _npcCommitments·不靠 AI 事后抽取）
function _wdDirectOrder() {
  var name = GM.wenduiTarget; if (!name) return;
  var bg = document.createElement('div');
  bg.style.cssText = 'position:fixed;inset:0;z-index:1300;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;';
  bg.innerHTML = '<div style="background:var(--color-surface);border:1px solid var(--gold-500);border-radius:var(--radius-lg);padding:1rem 1.5rem;max-width:340px;width:90%;">'
    + '<div style="font-size:var(--text-sm);color:var(--gold-400);margin-bottom:var(--space-2);">面谕差遣 ' + escHtml(name) + '</div>'
    + '<textarea id="wd-order-task" rows="2" placeholder="面谕其办何事（如：三月内查清盐政积弊、节制蓟镇兵马）" style="width:100%;box-sizing:border-box;background:var(--bg-3);color:var(--color-foreground);border:1px solid var(--bg-4);border-radius:4px;padding:6px;font-size:0.8rem;resize:vertical;"></textarea>'
    + '<div style="display:flex;align-items:center;gap:6px;margin:6px 0;font-size:0.78rem;color:var(--txt-s);">期限 <select id="wd-order-deadline" style="background:var(--bg-3);color:var(--color-foreground);border:1px solid var(--bg-4);border-radius:4px;padding:3px;"><option value="1">1回合</option><option value="2">2回合</option><option value="3" selected>3回合</option><option value="5">5回合</option><option value="8">8回合</option></select></div>'
    + '<div style="display:flex;gap:var(--space-1);justify-content:flex-end;">'
    + '<button class="bt bp bsm" onclick="if(_wdDoDirectOrder())this.closest(\'div[style*=fixed]\').remove();">下达</button>'
    + '<button class="bt" onclick="this.closest(\'div[style*=fixed]\').remove();">取消</button>'
    + '</div></div>';
  document.body.appendChild(bg);
  var _ta = _$('wd-order-task'); if (_ta) _ta.focus();
}
function _wdDoDirectOrder() {
  var name = GM.wenduiTarget; var ch = findCharByName(name); if (!ch) return false;
  var _taEl = _$('wd-order-task'); var task = _taEl ? String(_taEl.value || '').trim() : '';
  if (!task) { if (typeof toast === 'function') toast('请先写明所差何事'); return false; }
  var _dlEl = _$('wd-order-deadline'); var deadline = _dlEl ? (parseInt(_dlEl.value, 10) || 3) : 3;
  if (!GM._npcCommitments) GM._npcCommitments = {};
  if (!GM._npcCommitments[name]) GM._npcCommitments[name] = [];
  var _orderKey = task.slice(0, 30);
  var _sameTurnOrder = GM._npcCommitments[name].find(function(c) {
    if (!c || c.assignedTurn !== (GM.turn || 0)) return false;
    var _oldTask = String(c.task || '');
    return _oldTask.slice(0, 30) === _orderKey || _oldTask.indexOf(_orderKey.slice(0, 14)) >= 0 || task.indexOf(_oldTask.slice(0, 14)) >= 0;
  });
  if (_sameTurnOrder) {
    _sameTurnOrder.task = task.slice(0, 60);
    _sameTurnOrder.deadline = deadline;
    _sameTurnOrder.status = _sameTurnOrder.status || 'pending';
    _sameTurnOrder.lastUpdateTurn = GM.turn || 0;
    _sameTurnOrder._source = _sameTurnOrder._source || 'direct-order';
    _sameTurnOrder.responsibility = 'npc';
    if (typeof toast === 'function') toast('已更新同回合面谕差遣');
    return true;
  }
  var loy = (typeof ch.loyalty === 'number') ? ch.loyalty : 50;
  var rap = (typeof ch._rapport === 'number') ? ch._rapport : 50;
  var willingness = Math.max(0.2, Math.min(0.95, (loy + rap) / 200));
  GM._npcCommitments[name].push({
    id: (typeof uid === 'function' ? uid() : 'ord_' + (GM.turn || 0) + '_' + name + '_' + GM._npcCommitments[name].length),
    task: task.slice(0, 60), category: 'other', assignedTurn: GM.turn || 0, deadline: deadline,
    willingness: willingness, npcPromise: '面谕当面领命', conditions: '', status: 'pending', progress: 0, attempts: 0, feedback: '', _source: 'direct-order', responsibility: 'npc'
  });
  if (typeof _spendEnergy === 'function') _spendEnergy(2, '面谕差遣');
  if (typeof addEB === 'function') addEB('问对·差遣', name + '领命：' + task.slice(0, 40));
  if (typeof TM !== 'undefined' && TM.Qiju) TM.Qiju.recordEntry({ turn: GM.turn, date: typeof getTSText === 'function' ? getTSText(GM.turn) : '', content: '【问对·面谕】命' + name + '：' + task + '（限' + deadline + '回合）', category: '问对' });
  if (typeof NpcMemorySystem !== 'undefined') NpcMemorySystem.remember(name, '奉旨面谕：' + task.slice(0, 30), willingness > 0.6 ? '敬' : '忧', 6, '天子');
  if (!GM.wenduiHistory[name]) GM.wenduiHistory[name] = [];
  GM.wenduiHistory[name].push({ role: 'system', content: '【面谕】皇帝命' + name + '：' + task + '（限' + deadline + '回合）' });
  var chatEl = _$('wd-modal-chat');
  if (chatEl) { var d = document.createElement('div'); d.style.cssText = 'text-align:center;font-size:0.72rem;color:var(--gold-400);padding:4px;'; d.textContent = '（面谕差遣：' + task.slice(0, 30) + '·限' + deadline + ' 回合。已入承诺追踪。）'; chatEl.appendChild(d); chatEl.scrollTop = chatEl.scrollHeight; }
  return true;
}
// ★2026-07-01 W4·交办追踪面板:GM._npcCommitments 数据早已结构化(进度/期限/意愿/复命/逾期兜底全齐)·但只散落进混排事件流·
//   玩家答不出「手上压着几件差事·谁在拖·谁办砸」。此处纯读聚合成一个可视视图·零新状态·不碰执行闭环。
function _wdCommitBuckets() {
  var out = { active: [], overdue: [], done: [], failed: [] };
  var _t = GM.turn || 0;
  var cm = GM._npcCommitments;
  if (!cm || typeof cm !== 'object') return out;
  Object.keys(cm).forEach(function(nm) {
    (cm[nm] || []).forEach(function(c) {
      if (!c || !c.task) return;
      var st = c.status || 'pending';
      var rec = { nm: nm, c: c };
      if (st === 'completed') { out.done.push(rec); return; }
      if (st === 'failed' || st === 'obstructed' || c._terminalSettled) { out.failed.push(rec); return; }
      var due = (Number.isFinite(c.assignedTurn) ? c.assignedTurn : (GM.turn || 0)) + (c.deadline || 3);   // ★codex-fix W4:assignedTurn 缺失/脏数据不按 T0 算(否则老存档误判逾期)   // pending/executing/delayed → 逾期 or 承办中
      if (due < _t) out.overdue.push(rec); else out.active.push(rec);
    });
  });
  return out;
}
function _wdCommitRow(rec, kind) {
  var c = rec.c, nm = rec.nm, _t = GM.turn || 0;
  var prog = Math.max(0, Math.min(100, parseInt(c.progress, 10) || 0));
  var due = (c.assignedTurn || 0) + (c.deadline || 3);
  var left = due - _t;
  var willPct = Math.round((parseFloat(c.willingness) || 0.6) * 100);
  var barColor = kind === 'overdue' ? 'var(--red-400,#c0392b)' : kind === 'done' ? 'var(--green-400,#3a9a5c)' : kind === 'failed' ? 'var(--txt-s,#8a8578)' : 'var(--gold-500)';
  var dueLabel = kind === 'done' ? '已履约' : kind === 'failed' ? '已终结' : (left < 0 ? ('逾期 ' + (-left) + ' 回合') : left === 0 ? '本回合到期' : ('尚余 ' + left + ' 回合'));
  var promise = c.npcPromise ? ('<span style="color:var(--txt-s);">「' + escHtml(String(c.npcPromise).slice(0, 20)) + '」</span>') : '';
  var fb = c.feedback ? ('<div style="color:var(--txt-s);font-size:0.7rem;margin-top:2px;">复命：' + escHtml(String(c.feedback).slice(0, 64)) + '</div>') : '';
  // ★2026-07-01 打磨·失败归因徽标(为何办砸:推诿/无能/被掣肘/阳奉阴违·AI 报或确定性兜底)
  var _frBadge = ((kind === 'failed' || kind === 'overdue') && c._failReason) ? ('<span style="display:inline-block;font-size:0.66rem;color:var(--red-400,#c0392b);border:1px solid var(--red-400,#c0392b);border-radius:3px;padding:0 5px;margin-top:2px;">因由：' + escHtml(String(c._failReason).slice(0, 12)) + '</span>') : '';
  return '<div style="border-left:2px solid ' + barColor + ';padding:4px 8px;margin:4px 0;background:var(--bg-3);border-radius:0 4px 4px 0;">'
    + '<div style="display:flex;justify-content:space-between;gap:6px;font-size:0.76rem;">'
    + '<span style="color:var(--gold-300);font-weight:600;">' + escHtml(nm) + '</span>'
    + '<span style="color:' + barColor + ';font-size:0.7rem;white-space:nowrap;">' + dueLabel + '</span></div>'
    + '<div style="font-size:0.74rem;color:var(--color-foreground);margin:2px 0;">' + escHtml(String(c.task).slice(0, 50)) + ' ' + promise + '</div>'
    + '<div style="display:flex;align-items:center;gap:6px;">'
    + '<div style="flex:1;background:var(--bg-4);height:5px;border-radius:3px;overflow:hidden;"><div style="background:' + barColor + ';width:' + prog + '%;height:100%;"></div></div>'
    + '<span style="font-size:0.66rem;color:var(--txt-s);white-space:nowrap;">' + prog + '%·意愿' + willPct + '</span></div>'
    + _frBadge + fb + '</div>';
}
function _wdShowCommitTracker() {
  var b = _wdCommitBuckets();
  function section(title, arr, kind, color, cap) {
    if (!arr.length) return '';
    var shown = (cap && arr.length > cap) ? arr.slice(-cap) : arr;
    return '<div style="margin-bottom:8px;"><div style="font-size:0.72rem;color:' + color + ';font-weight:600;border-bottom:1px solid var(--bg-4);padding-bottom:2px;margin-bottom:2px;">' + title + '（' + arr.length + '）</div>'
      + shown.map(function(r){ return _wdCommitRow(r, kind); }).join('') + '</div>';
  }
  var body = section('⚠ 逾期未办', b.overdue, 'overdue', 'var(--red-400,#c0392b)')
    + section('▸ 承办中', b.active, 'active', 'var(--gold-400)')
    + section('✓ 已复命', b.done, 'done', 'var(--green-400,#3a9a5c)', 10)
    + section('✕ 失诺·搁置', b.failed, 'failed', 'var(--txt-s,#8a8578)', 10);
  if (!body) body = '<div style="color:var(--txt-s);font-size:0.78rem;text-align:center;padding:16px 4px;">尚无交办事项。可在问对中面谕「差遣」·或对臣工下达具体指令·所交办之事将在此追踪其进度与复命。</div>';
  var total = b.overdue.length + b.active.length;
  var bg = document.createElement('div');
  bg.style.cssText = 'position:fixed;inset:0;z-index:1300;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;';
  bg.innerHTML = '<div style="background:var(--color-surface);border:1px solid var(--gold-500);border-radius:var(--radius-lg);padding:1rem 1.2rem;max-width:440px;width:92%;max-height:80vh;display:flex;flex-direction:column;">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;"><div style="font-size:var(--text-sm);color:var(--gold-400);">朕之交办 · 待办 ' + total + ' 件' + (b.overdue.length ? '（<span style="color:var(--red-400,#c0392b);">' + b.overdue.length + ' 件逾期</span>）' : '') + '</div>'
    + '<button class="bt" style="padding:2px 8px;" onclick="this.closest(\'div[style*=fixed]\').remove();">✕</button></div>'
    + '<div style="overflow-y:auto;flex:1;">' + body + '</div></div>';
  bg.addEventListener('click', function(e){ if (e.target === bg) bg.remove(); });
  document.body.appendChild(bg);
}
// ④ 纳谏:嘉纳其言→皇威(benevolence·明君纳言)+进言者知遇+采纳之谏入起居注(待办留档)
function _wdAdoptCounsel() {
  var name = GM.wenduiTarget; if (!name) return;
  var ch = (typeof findCharByName === 'function') ? findCharByName(name) : null;
  if (!ch) return;
  if (ch._envoy || ch.fromFaction) { if (typeof toast === 'function') toast('外藩之议请用「准奏/驳回」'); return; }
  // 取此人最近一句话作为所纳之谏(best-effort)
  var _adv = '';
  var _hist = (GM.wenduiHistory && GM.wenduiHistory[name]) || [];
  for (var i = _hist.length - 1; i >= 0; i--) { if (_hist[i] && _hist[i].role !== 'player' && _hist[i].content) { _adv = String(_hist[i].content).slice(0, 60); break; } }
  // 皇威:明君纳谏(走表内 benevolence 源·cap10·防 farm)
  if (typeof AuthorityEngines !== 'undefined' && AuthorityEngines.adjustHuangwei) {
    try { AuthorityEngines.adjustHuangwei('benevolence', 1, '嘉纳' + name + '之谏·明君纳言'); } catch (_) {}
  }
  // 进言者知遇之感
  if (typeof adjustCharacterLoyalty === 'function') adjustCharacterLoyalty(ch, 2, '所谏蒙嘉纳·知遇之感', { source: 'wendui-counsel-adopted' });
  ch._rapport = (ch._rapport || 0) + 3;
  ch._counselAdoptedTurn = GM.turn;  // 防 close 的 ④纳谏 affirmation 重复加
  if (typeof NpcMemorySystem !== 'undefined') NpcMemorySystem.remember(name, '所进之言蒙陛下当面嘉纳·君臣相得', '敬', 7, '天子');
  // 待办留档:采纳之谏入起居注(供回顾/演绎后续推进)
  if (!Array.isArray(GM._adoptedCounsel)) GM._adoptedCounsel = [];
  GM._adoptedCounsel.push({ advisor: name, counsel: _adv, turn: GM.turn });
  if (GM._adoptedCounsel.length > 40) GM._adoptedCounsel = GM._adoptedCounsel.slice(-40);
  if (typeof TM !== 'undefined' && TM.Qiju) TM.Qiju.recordEntry({ turn: GM.turn, date: (typeof getTSText === 'function') ? getTSText(GM.turn) : '', content: '【问对·纳谏】陛下嘉纳' + name + '之言' + (_adv ? '：' + _adv : ''), category: '问对' });
  if (typeof addEB === 'function') addEB('问对·纳谏', '嘉纳' + name + '之谏');
  var chatEl = _$('wd-modal-chat');
  if (chatEl) { var d = document.createElement('div'); d.style.cssText = 'text-align:center;font-size:0.72rem;color:var(--gold-400);padding:4px;'; d.textContent = '（嘉纳其言·' + name + '感君知遇）'; chatEl.appendChild(d); chatEl.scrollTop = chatEl.scrollHeight; }
  if (typeof toast === 'function') toast('已嘉纳' + name + '之谏·皇威+');
}
// ⑨ 使节准奏/驳回/羁縻:确定性接外交子系统(setFactionRelation)+皇威(纳贡/屈辱)+留痕·完整条款细节仍由对话演绎
// ⑨ 外交效果表：受使决断(kind × interactionType) → {rel:关系增量, hwSource/hwDelta:皇威源/量, tribute:我方纳岁币(扣国库), desc:文案}
// 调参集中于此一处；新增使命类型加一行即可。缺省走 _default。
var _WD_ENVOY_EFFECTS = {
  accept: {
    sue_for_peace:      { rel: 28, desc: '准其请和·罢兵息争' },
    form_confederation: { rel: 30, desc: '准结盟约' },
    royal_marriage:     { rel: 22, desc: '准和亲之议' },
    pay_tribute:        { rel: 12, hwSource: 'tribute', hwDelta: 4, desc: '纳其朝贡·万国来朝' },
    demand_tribute:     { rel: 15, hwSource: 'diplomaticHumiliation', hwDelta: -6, tribute: { money: 30000, cloth: 3000 }, desc: '许其岁币·屈己安边' },
    _default:           { rel: 12, desc: '准其所请·邦交转睦' }
  },
  reject: {
    sue_for_peace:  { rel: -10, desc: '拒其请和·战事未休' },
    demand_tribute: { rel: -16, desc: '斥其索贡·寸土不让' },
    royal_marriage: { rel: -10, desc: '却其和亲' },
    _default:       { rel: -12, desc: '驳其所请·邦交转冷' }
  },
  temporize: { _default: { rel: -4, desc: '羁縻敷衍·未即定夺' } }
};
function _wdEnvoyDecision(kind) {
  var name = GM.wenduiTarget; if (!name) return;
  var ch = (typeof findCharByName === 'function') ? findCharByName(name) : null;
  if (!ch || !(ch._envoy || ch.fromFaction)) { if (typeof toast === 'function') toast('此人非外藩使节'); return; }
  var fac = ch.fromFaction || ch.faction || '';
  var itype = ch.interactionType || '';
  var playerFac = (typeof P !== 'undefined' && (P.playerFactionName || (P.playerInfo && P.playerInfo.factionName))) || GM.playerFactionName || GM.playerFaction || '本朝';
  var L = ({ accept: '准奏', reject: '驳回', temporize: '羁縻' })[kind] || kind;
  var _km = _WD_ENVOY_EFFECTS[kind] || _WD_ENVOY_EFFECTS.temporize;
  var _eff = _km[itype] || _km._default;
  var relDelta = _eff.rel || 0;
  var desc = _eff.desc || '';
  if (fac && playerFac && typeof setFactionRelation === 'function') {
    try { setFactionRelation(playerFac, fac, { delta: relDelta, desc: '问对·' + L + '：' + desc }, { mirror: true }); } catch (_) {}
  }
  if (_eff.hwSource && _eff.hwDelta && typeof AuthorityEngines !== 'undefined' && AuthorityEngines.adjustHuangwei) {
    try { AuthorityEngines.adjustHuangwei(_eff.hwSource, _eff.hwDelta, '受使·' + desc); } catch (_) {}
  }
  // ⑨ 若该决断含岁币(我方纳贡·见 _WD_ENVOY_EFFECTS)→确定性扣国库(走 FiscalEngine.spendFromGuoku·cascade-safe·不足记欠)
  if (_eff.tribute && typeof FiscalEngine !== 'undefined' && FiscalEngine.spendFromGuoku) {
    // 岁币额按外藩势力 strength 派生(原硬编 30000·绍宋岁币机制核心)·strength 50→30000·夹保守上下限
    var _tFac = (typeof GM !== 'undefined' && Array.isArray(GM.facs)) ? GM.facs.find(function(f){ return f && f.name === fac; }) : null;
    var _tStr = Math.max(20, Math.min(200, (_tFac && Number(_tFac.strength)) || 50));
    var _trib = { money: Math.round(Math.max(8000, Math.min(120000, _tStr * 600))), cloth: Math.round(Math.max(0, Math.min(8000, _tStr * 40))) };
    try { FiscalEngine.spendFromGuoku(_trib, '岁币·' + (fac || '外藩')); desc += '·岁币 ' + _trib.money + ' 两出帑'; } catch (_) {}
  }
  // #26·议和落地:准和(sue_for_peace)→真调 endWar 上停战期(原 endWar 零调用·停战期机制名存实亡)
  if (kind === 'accept' && itype === 'sue_for_peace' && typeof CasusBelliSystem !== 'undefined' && CasusBelliSystem.endWar) {
    try {
      var _peaceWar = (GM.activeWars || []).find(function(w){ return w && ((w.attacker===playerFac&&w.defender===fac)||(w.attacker===fac&&w.defender===playerFac)); });
      if (_peaceWar) { CasusBelliSystem.endWar(_peaceWar.id); desc += '·罢兵息争'; }
    } catch (_) {}
  }
  // 【S3·势力外交双向闭环】若为势力 agent 提议(_factionProposalId)·把玩家准奏/驳回显式回写发起势力持久记忆(aiStrategy.playerProposalOutcomes)·供其下回合 decideFor 感知(PLAYER_PROPOSAL_OUTCOMES 段)·非仅靠邦交 delta 间接推
  if (ch._factionProposalId && typeof window !== 'undefined' && window.TM && window.TM.FactionDiplomacy && typeof window.TM.FactionDiplomacy.recordPlayerResponse === 'function') {
    try { window.TM.FactionDiplomacy.recordPlayerResponse(fac, { id: ch._factionProposalId, type: ch._diplomacyType, terms: String(ch.envoyMission || '').replace(/^【[^】]*】/, ''), outcome: (kind === 'accept' ? 'accepted' : (kind === 'reject' ? 'rejected' : 'temporized')), turn: (typeof GM !== 'undefined' && GM) ? GM.turn : 0 }); } catch (_) {}
  }
  ch._pendingEnvoyDisposition = kind;  // 供 closeWenduiModal 留痕带上处置
  if (typeof addEB === 'function') addEB('外交·' + L, fac + '使节之请——' + desc + '（邦交' + (relDelta >= 0 ? '+' : '') + relDelta + '）');
  var chatEl = _$('wd-modal-chat');
  if (chatEl) { var d = document.createElement('div'); d.style.cssText = 'text-align:center;font-size:0.72rem;color:var(--gold-400);padding:4px;'; d.textContent = '（' + L + '：' + desc + '·' + fac + '邦交' + (relDelta >= 0 ? '+' : '') + relDelta + '）'; chatEl.appendChild(d); chatEl.scrollTop = chatEl.scrollHeight; }
  if (typeof toast === 'function') toast(L + '·' + fac + '邦交' + (relDelta >= 0 ? '+' : '') + relDelta);
  if (typeof closeWenduiModal === 'function') setTimeout(closeWenduiModal, 600);
}
function _wdSummonConfronter() {
  // L4\u00B7f1\u00B7cedui mode \u5141\u53EC\u4EBA\u5BF9\u8D28\u00B7multi-advisor \u534F\u5546\u00B7confronter \u72EC\u7ACB archetype\u00B7\u5173\u540E\u8DD1 merge LLM
  // (RX\u00B7C3 \u4E34\u7981\u89E3\u9664)
  var capital = GM._capital || '\u4EAC\u57CE';
  var current = GM.wenduiTarget;
  var candidates = (GM.chars || []).filter(function(c) { return c.alive !== false && c.name !== current && _wdConfronters.indexOf(c.name) < 0 && _wdCanDirectAudience(c); });
  // L4\u00B7f1\u00B7\u82E5 cedui mode\u00B7\u989D\u5916\u8FC7\u6EE4 loyalty>=60\u00B7\u8DDF L4\u00B7a advisor \u5019\u9009\u6807\u51C6\u4E00\u81F4
  if (_wenduiMode === 'cedui') {
    candidates = candidates.filter(function(c) { return (c.loyalty || 50) >= 60; });
  }
  if (candidates.length === 0) { toast('\u65E0\u53EF\u53EC\u89C1\u4E4B\u4EBA'); return; }
  var html = '<div style="max-height:50vh;overflow-y:auto;">';
  candidates.slice(0, 20).forEach(function(c) {
    html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 8px;border-bottom:1px solid var(--bg-4);cursor:pointer;" onclick="_wdAddConfronter(\'' + c.name.replace(/'/g, '') + '\');">';
    html += '<span>' + escHtml(c.name) + ' <span style="font-size:0.7rem;color:var(--txt-d);">' + escHtml(c.title || '') + '</span></span>';
    html += '<span style="font-size:0.72rem;color:var(--txt-s);">\u5FE0' + (typeof _fmtNum1==='function'?_fmtNum1(c.loyalty||50):(c.loyalty||50)) + '</span>';
    html += '</div>';
  });
  html += '</div>';
  openGenericModal('\u53EC\u5165\u4F55\u4EBA\u5BF9\u8D28', html, null);
}

/** NPC求见——打开问对，NPC先主动开口 */
function _wdOpenAudience(name) {
  var ch = (typeof findCharByName === 'function') ? findCharByName(name) : null;
  if (ch && !ch._envoy && !_wdCanDirectAudience(ch)) {
    if (typeof toast === 'function') toast(name + '不在御前，不能直接召见。');
    if (typeof renderWenduiChars === 'function') renderWenduiChars();
    return;
  }
  // 直接打开正式模式问对
  openWenduiModal(name, 'formal');
  // NPC先主动发言（不等皇帝问）——标记为奏对模式
  GM._wdAudienceMode = true;
  // 延迟触发NPC主动开口
  setTimeout(function() {
    _wdNpcInitiateSpeak(name);
  }, 300);
}

function _wdAudienceOpeningFallback(name, ch) {
  var fallback = '';
  try {
    fallback = _wdGenerateGreeting(name, ch);
  } catch (_) {}
  fallback = String(fallback || '').trim();
  if (fallback) return fallback;
  if (ch && ch._envoy) {
    var fac = ch.fromFaction || ch.faction || '外藩';
    var mission = String(ch.envoyMission || '').slice(0, 60);
    var line = '外臣' + fac + '使节' + name + '，谨奉国书，参见陛下。';
    if (mission) line += '此来——' + mission;
    return line;
  }
  if (ch && _wdIsPlayerConsort(ch)) return '妾' + name + '参见陛下，陛下万安。';
  return '臣' + name + '叩见陛下。臣有事启奏。';
}

function _wdDecodeJsonTextFragment(fragment) {
  var txt = String(fragment == null ? '' : fragment);
  txt = txt.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t');
  txt = txt.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  return txt.trim();
}

function _wdTrimStructuredTail(text) {
  var txt = String(text == null ? '' : text);
  var markers = [
    '","loyaltyDelta"', '", "loyaltyDelta"', '","suggestions"', '", "suggestions"',
    '"loyaltyDelta"', '"suggestions"', '"toneEffect"', '"memoryImpact"', '"emotionState"',
    '],"toneEffect"', '}],"toneEffect"', '],"memoryImpact"', '}],"memoryImpact"'
  ];
  var cut = -1;
  markers.forEach(function(m) {
    var idx = txt.indexOf(m);
    if (idx >= 0 && (cut < 0 || idx < cut)) cut = idx;
  });
  if (cut >= 0) txt = txt.slice(0, cut);
  return txt.replace(/[,{[\]\s"]+$/g, '').trim();
}

function _wdExtractJsonStringField(raw, key, allowPartial) {
  var text = String(raw == null ? '' : raw);
  var re = new RegExp('["\\\']?' + key + '["\\\']?\\s*[:：]\\s*["\\\']', 'i');
  var m = re.exec(text);
  if (!m) return '';
  var quote = text.charAt(m.index + m[0].length - 1);
  var start = m.index + m[0].length;
  var esc = false;
  for (var i = start; i < text.length; i++) {
    var c = text.charAt(i);
    if (esc) { esc = false; continue; }
    if (c === '\\') { esc = true; continue; }
    if (c === quote) {
      var tail = text.slice(i + 1, i + 80);
      if (/^\s*[,}\]]/.test(tail)) return _wdDecodeJsonTextFragment(text.slice(start, i));
    }
  }
  if (!allowPartial) return '';
  return _wdDecodeJsonTextFragment(_wdTrimStructuredTail(text.slice(start)));
}

function _wdLooksLikeStructuredReply(raw) {
  var text = String(raw == null ? '' : raw).trim();
  if (!text) return false;
  if (/^```?json/i.test(text) || /^[{\[]/.test(text)) return true;
  return /["']?(reply|loyaltyDelta|suggestions|toneEffect|memoryImpact|emotionState)["']?\s*[:：]/.test(text);
}

function _wdVisibleReplyPreview(raw) {
  var text = String(raw == null ? '' : raw).trim();
  if (!text) return '';
  var reply = _wdExtractJsonStringField(text, 'reply', true);
  if (reply) return reply;
  if (_wdLooksLikeStructuredReply(text)) return '';
  return text;
}

function _wdReadableTextFallback(raw) {
  var text = String(raw == null ? '' : raw).trim();
  if (!text) return '';
  text = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  text = text.replace(/^[{\[]+/, '').replace(/[}\]]+$/, '').trim();
  text = text.replace(/["']?(loyaltyDelta|suggestions|toneEffect|memoryImpact|emotionState|requestOvernight)["']?\s*[:：]\s*[\s\S]*$/i, '').trim();
  text = text.replace(/["']?reply["']?\s*[:：]\s*["']?/i, '').trim();
  text = _wdTrimStructuredTail(text);
  text = _wdDecodeJsonTextFragment(text);
  text = text.replace(/^[,\s"']+|[,\s"']+$/g, '').trim();
  return text;
}

function _wdSanitizeDialogueReplyText(name, ch, parsed, rawReply) {
  var replyText = '';
  if (parsed && Object.prototype.hasOwnProperty.call(parsed, 'reply')) {
    replyText = parsed.reply;
  }
  if (!replyText && parsed && parsed.zhengwen) {
    replyText = _wdExtractJsonStringField(parsed.zhengwen, 'reply', true);
  }
  if (!replyText) replyText = _wdExtractJsonStringField(rawReply, 'reply', true);
  if (!replyText && !_wdLooksLikeStructuredReply(rawReply)) replyText = rawReply;
  if (!replyText) replyText = _wdReadableTextFallback(rawReply);
  replyText = String(replyText == null ? '' : replyText).trim();
  if (_wdLooksLikeStructuredReply(replyText)) replyText = _wdVisibleReplyPreview(replyText);
  if (!replyText) replyText = _wdReadableTextFallback(replyText);
  if (!replyText) replyText = _wdAudienceOpeningFallback(name, ch);
  return replyText;
}

function _wdResolveAudienceReplyText(name, ch, parsed, rawReply) {
  return _wdSanitizeDialogueReplyText(name, ch, parsed, rawReply);
}

function _wdCommitAudienceOpening(name, ch, replyText) {
  var safeText = String(replyText == null ? '' : replyText).trim() || _wdAudienceOpeningFallback(name, ch);
  var bubble = _$('wd-init-bubble');
  if (bubble) { bubble.textContent = safeText; bubble.removeAttribute('id'); }
  if (!GM.wenduiHistory) GM.wenduiHistory = {};
  if (!GM.wenduiHistory[name]) GM.wenduiHistory[name] = [];
  GM.wenduiHistory[name].push({ role: 'npc', content: safeText, turn: GM.turn });
  if (!GM.jishiRecords) GM.jishiRecords = [];
  GM.jishiRecords.push({ turn: GM.turn, char: name, playerSaid: '（NPC主动求见）', npcSaid: safeText, mode: 'formal' });
  return bubble;
}

function _wdCleanCounselText(text) {
  text = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
  return text
    .replace(/^臣(?:愚)?(?:请|以为|闻|奏|谨奏|谨按)[：:，,\s]*/g, '')
    .replace(/^陛下[：:，,\s]*/g, '')
    .trim();
}

function _wdBuildEdictDraftFromCounsel(name, suggestion) {
  var topic = '';
  var content = '';
  if (suggestion && typeof suggestion === 'object') {
    topic = String(suggestion.topic || suggestion.title || '').trim();
    content = String(suggestion.content || suggestion.text || suggestion.body || '').trim();
  } else {
    content = String(suggestion == null ? '' : suggestion).trim();
  }
  content = _wdCleanCounselText(content);
  if (!content) return '';
  if (/^(诏令|诏曰|奉天承运|谕|敕)/.test(content)) return content;
  var who = String(name || '').trim();
  var prefix = '诏令：';
  if (topic) prefix += '为' + topic + '，';
  if (who) prefix += '据' + who + '问对所陈，';
  return prefix + content;
}

function _wdStoreEdictSuggestion(name, suggestion, meta) {
  if (typeof GM === 'undefined' || !GM) return null;
  meta = meta || {};
  var topic = '';
  var content = '';
  if (suggestion && typeof suggestion === 'object') {
    topic = String(suggestion.topic || suggestion.title || '').trim();
    content = String(suggestion.content || suggestion.text || suggestion.body || '').trim();
  } else {
    content = String(suggestion == null ? '' : suggestion).trim();
  }
  if (!content) return null;
  var draftText = _wdBuildEdictDraftFromCounsel(name, { topic: topic, content: content });
  if (!draftText) return null;
  if (!GM._edictSuggestions) GM._edictSuggestions = [];
  var row = {
    id: 'wd_sug_' + (GM.turn || 0) + '_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
    source: '问对',
    sourceChannel: 'wendui',
    from: name || '',
    topic: topic,
    content: content,
    draftText: draftText,
    text: draftText,
    turn: GM.turn || 0,
    used: false,
    draftOnly: true,
    requiresPlayerApproval: true,
    status: 'pending_player_edict',
    mode: meta.mode || _wenduiMode || 'formal',
    playerPrompt: meta.playerPrompt || '',
    tags: ['问对', '草诏']
  };
  GM._edictSuggestions.push(row);
  return row;
}

/** NPC主动开口（奏对模式）——AI生成NPC的开场陈述 */
// C·派生主动求见的真实议程（从承诺/赏罚/忠诚野心等真实处境推导·UI reason 与开场 prompt 共用·让求见者带具体目的来）
function _wdDeriveAudienceAgenda(ch) {
  if (!ch) return null;
  var nm = ch.name;
  var loy = (typeof ch.loyalty === 'number') ? ch.loyalty : 50;
  var amb = (typeof ch.ambition === 'number') ? ch.ambition : 50;
  var str = ch.stress || 0;
  var _t = (typeof GM !== 'undefined' && GM.turn) || 0;
  // ① 未了承诺：为前命复命/请罪展限（接 _npcCommitments·闭环：受命→主动回报）
  try {
    if (typeof GM !== 'undefined' && GM._npcCommitments && Array.isArray(GM._npcCommitments[nm])) {
      var _pend = GM._npcCommitments[nm].filter(function(c){ return c && (c.status === 'pending' || c.status === 'executing' || c.status === 'delayed'); });
      if (_pend.length) {
        var _c = _pend[_pend.length - 1];
        var _od = (_t - (_c.assignedTurn || _t)) > (_c.deadline || 3);
        var _tk = String(_c.task || '').slice(0, 16);
        return { tag:'commitment', seek: _od, overdue: _od, brief: _od ? ('为「' + _tk + '」逾期请罪/请展限') : ('为「' + _tk + '」复命'),
          hint: '你曾奉旨办「' + (_c.task || '') + '」' + (_od ? '，至今未竟，今来请罪或恳请宽限，并陈所遇难处' : '，今来当面复命、奏报进展或所遇阻力') + '。' };
      }
    }
  } catch (_) {}
  // ② 近受赏/罚：谢恩 或 谢罪/鸣屈
  try {
    if (typeof GM !== 'undefined' && Array.isArray(GM._wdRewardPunish)) {
      var _rp = GM._wdRewardPunish.filter(function(r){ return r && r.target === nm && (_t - r.turn) <= 2; });
      if (_rp.length) {
        var _last = _rp[_rp.length - 1];
        if (_last.type === 'reward') return { tag:'thank', seek:true, brief:'入谢天恩', hint:'你近日蒙陛下赏赐，今来叩谢天恩、表明忠悃。' };
        return { tag:'grieve', seek:true, brief:'似为前罚而来', hint:'你近日受了责罚，今来或谢罪自省、或委婉鸣屈陈情——按你性情与忠诚拿捏。' };
      }
    }
  } catch (_) {}
  // ③ 低忠诚：怨望（未必直言）
  if (loy < 35) return { tag:'grievance', seek: (loy < 30 || str > 60), brief:'神色怏怏，似怀怨望', hint:'你对朝廷或陛下心存不满（待遇不公、抱负不得伸、或党争失势），今来或试探、或诉苦、或暗藏机锋——按你忠诚之低与性情，未必直言。' };
  // ④ 高忠诚高压：犯颜进谏
  // ④ 真危兆探测——供犯颜进谏锚定真实国是(复用本文件 court-hot 同源字段)
  var _crisis = [];
  try {
    if (GM.activeWars && GM.activeWars.length > 0) _crisis.push('边事未宁');
    if ((GM.unrest || 0) > 50) _crisis.push('民变频仍');
    if (GM.memorials && GM.memorials.filter(function(m){ return m && m.status === 'pending_review'; }).length > 8) _crisis.push('奏牍积压如山');
    if ((GM._tyrantDecadence || 0) > 40) _crisis.push('朝议谤君荒怠');
  } catch (_) {}
  // 忠臣(放宽至>75)察觉真危兆→针对真问题进谏;无危兆但极忠高压→泛泛忠言
  if (loy > 75 && _crisis.length > 0) return { tag:'warn', seek:true, brief:'神色凝重，似为' + _crisis[0] + '而来', hint:'你是忠耿之臣，深忧当下【' + _crisis.slice(0, 3).join('、') + '】之危，今来犯颜直谏——务必针对此实情条陈对策或密陈警示，要具体切中时弊，勿空言"臣有忧"。' };
  if (loy > 90 && str > 30) return { tag:'warn', seek:true, brief:'神色凝重，欲进忠言', hint:'你是忠耿之臣，察觉某隐忧或危兆，今来犯颜直谏或密陈警示。' };
  // ⑤ 高野心：游说进取
  if (amb > 80 && loy > 60) return { tag:'ambition', seek:true, brief:'精神抖擞，欲呈策论', hint:'你抱负甚大，今来呈上精心准备的策论或方略，或为某职位/差遣自荐、游说，意在进取。' };
  // ⑥ 高压：诉难求裁
  if (str > 60) return { tag:'burden', seek:true, brief:'面带忧色，似有为难', hint:'你被某事所困（钱粮、人事、或地方棘手），今来向陛下倾诉为难、请求帮助或裁夺。' };
  return { tag:'routine', seek:false, brief:'候于殿外，请求面圣', hint:'你为常事求见——或例行述职、或谢前恩、或闲话近况借机观望帝意、或试探某事风向，依礼从容陈奏即可，不必强作惊人之语。' };
}
if (typeof window !== 'undefined') window._wdDeriveAudienceAgenda = _wdDeriveAudienceAgenda;

async function _wdNpcInitiateSpeak(name) {
  var ch = findCharByName(name);
  if (!ch) return;
  var chatEl = _$('wd-modal-chat');
  if (!chatEl) return;
  _wenduiSending = true;
  var sendBtn = _$('wd-send-btn');
  if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = '…'; }

  // 创建NPC气泡
  var div = document.createElement('div');
  div.className = 'wendui-npc';
  div.innerHTML = (ch.portrait?'<img src="'+escHtml(ch.portrait)+'" loading="lazy" decoding="async" style="width:28px;height:28px;object-fit:cover;border-radius:50%;flex-shrink:0;border:1.5px solid var(--gold-d);">':'<div style="width:28px;height:28px;border-radius:50%;background:var(--bg-4);display:flex;align-items:center;justify-content:center;font-size:0.8rem;border:1.5px solid var(--gold-d);flex-shrink:0;">\uD83D\uDC64</div>')
    + '<div style="flex:1;min-width:0;"><div class="wendui-npc-name">' + escHtml(name) + '</div>'
    + '<div class="wendui-npc-bubble wd-selectable" id="wd-init-bubble">\u2026</div></div>';
  chatEl.appendChild(div);

  if (!(typeof P !== 'undefined' && P.ai && P.ai.key && typeof callAIMessagesStream === 'function')) {
    _wdCommitAudienceOpening(name, ch, _wdAudienceOpeningFallback(name, ch));
    _wenduiSending = false;
    if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = '奉旨'; }
    GM._wdAudienceMode = false;
    return;
  }

  var _audienceOpeningCommitted = false;
  try {
    // 构建NPC主动开场的prompt
    var sysP = _wdBuildPrompt(ch, name);
    if (!ch._envoy && typeof _sovereignLanguagePromptLine === 'function') sysP = _sovereignLanguagePromptLine(typeof GM !== 'undefined' ? GM : null) + sysP;
    if (ch._envoy) {
      // 外藩使节：不走本朝官员的情绪分支，而是以外交使命为主
      sysP += '\n\n【特殊：外藩使节入朝陈事】';
      sysP += '\n你刚刚入觐天朝皇帝，须主动开口——不要说"候陛下垂询"或"臣听候圣谕"。';
      sysP += '\n第一句务必完成以下四件事：①自报家门（"外臣/小臣/使臣某某奉X国之命"）②到朝目的（奉命行X使命）③呈上主君意旨或条款 ④表明己方立场或期望。';
      sysP += '\n开头示例（按身份风格选）：';
      sysP += '\n  · 女真 / 蒙古：直率豪迈——"外臣奉天聪汗之命入朝，实有三事求见天朝皇帝"';
      sysP += '\n  · 朝鲜：恭顺委婉——"小邦使臣叩谢天恩·有紧要军情告于陛下"';
      sysP += '\n  · 海商/南洋：商人本色——"小使奉主公之命，特献方物，亦有一议奉陈"';
      sysP += '\n  · 西洋：带外语译意感——"Your Majesty·外使奉总督大人之命远渡而来"';
      sysP += '\n切忌说"臣有事启奏"（本朝辞令）——你是外臣，应明确使命与己方立场。';
    } else {
      sysP += '\n\n【特殊：NPC主动求见模式】';
      sysP += '\n你是主动请求面圣的——你有准备好的话要说。不要问"陛下找臣何事"。';
      sysP += '\n你应该直接开口陈述你的来意：';
      var _wdAg = (typeof _wdDeriveAudienceAgenda === 'function') ? _wdDeriveAudienceAgenda(ch) : null;
      if (_wdAg && _wdAg.hint) {
        sysP += '\n  【你此来的来意（按此切入，具体陈事，勿泛泛客套）】' + _wdAg.hint;
      } else {
        if ((ch.stress||0) > 60) sysP += '\n  你心中有忧虑/困难/为难之事，想向皇帝倾诉或请求帮助。';
        if ((ch.loyalty||50) > 90) sysP += '\n  你是忠臣，有重要的忠告或警示要进言。';
        if ((ch.ambition||50) > 80) sysP += '\n  你有一个精心准备的计划/策论要呈上。';
      }
      // 检查未回复来函
      var _unansLetter = (GM.letters||[]).find(function(l) { return l._npcInitiated && l.from === name && l._replyExpected && !l._playerReplied && l.status === 'returned'; });
      if (_unansLetter) sysP += '\n  你之前写了一封信给皇帝但未获回复，内容是：「' + (_unansLetter.content||'').slice(0,80) + '」——你这次亲自来是为了当面追问此事。';
      sysP += '\n直接以"臣有事启奏——"或类似开头，主动陈述你的来意和诉求。不要等皇帝先说话。';
    }
    sysP += '\n返回 JSON：{"reply":"主动陈述内容","loyaltyDelta":0,"emotionState":"当前情绪","suggestions":[{"topic":"针对什么问题/情境(10-25字具体说明上下文)","content":"详尽建议(80-200字，含具体执行者、手段、范围、时机；不要笼统套话)"}]}\n';
    sysP += '【suggestions 要求】\n';
    sysP += '  · 必须是 object 数组，每条含 topic(问题描述) + content(具体方案)\n';
    sysP += '  · topic 示例："针对辽东军饷拖欠之困"、"应对江南士绅抗税"、"关于太子人选之议"\n';
    sysP += '  · content 要具体：谁去办、怎么办、涉及哪些部门/地方/人——须有可操作性\n';
    sysP += '  · 反面例子（不可接受）：\n';
    sysP += '    ❌ "依靠清流与儒家礼法徐徐图之" —— 太笼统，无执行路径\n';
    sysP += '    ❌ "整饬吏治" —— 空话\n';
    sysP += '  · 正面例子：\n';
    sysP += '    ✓ topic="针对吴地赋税连年欠缴"\n';
    sysP += '      content="臣请陛下遣户部侍郎某某巡按江南，择苏松常三州先行清丈田亩，以三月为期。若豪右隐匿，许其自首减免，逾期则籍没半数。同时诏命漕运总督约束胥吏，不得骚扰民户。如此上体朝廷之公，下息百姓之怨"\n';

    var msgs = [{ role: 'system', content: sysP + '\n' + (typeof _aiDialogueWordHint==='function'?_aiDialogueWordHint("wd"):'') }];
    var _wdInitPending = null, _wdInitRaf = 0;
    var _wdInitFlush = function() {
      _wdInitRaf = 0;
      if (_wdInitPending == null) return;
      var txt = _wdInitPending;
      var bubble = _$('wd-init-bubble');
      if (bubble) {
        var visible = _wdVisibleReplyPreview(txt);
        bubble.textContent = visible || '…';
      }
      var _nearBottom = (chatEl.scrollHeight - chatEl.scrollTop - chatEl.clientHeight) < 80;
      if (_nearBottom) chatEl.scrollTop = chatEl.scrollHeight;
    };
    var reply = await callAIMessagesStream(msgs, (typeof _aiDialogueTok==='function'?_aiDialogueTok("wd", 1):800), {
      tier: (typeof _useSecondaryTier === 'function' && _useSecondaryTier()) ? 'secondary' : undefined,  // M3·问对走次 API
      onChunk: function(txt) {
        _wdInitPending = txt;
        if (_wdInitRaf) return;
        _wdInitRaf = (typeof requestAnimationFrame === 'function') ? requestAnimationFrame(_wdInitFlush) : (setTimeout(_wdInitFlush, 16), 1);
      }
    });
    if (_wdInitRaf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(_wdInitRaf);
    _wdInitRaf = 0;
    _wdInitFlush();
    var parsed = (typeof extractJSON === 'function') ? extractJSON(reply) : null;
    var replyText = _wdResolveAudienceReplyText(name, ch, parsed, reply);
    var _bubbleWrap = _wdCommitAudienceOpening(name, ch, replyText);
    _audienceOpeningCommitted = true;
    // 情绪更新
    if (parsed && parsed.emotionState) {
      var _eMap2 = {'镇定':1,'从容':1,'平静':2,'恭敬':2,'紧张':3,'不安':3,'焦虑':4,'恐惧':4,'崩溃':5,'激动':4,'愤怒':4};
      var _st2 = GM._wdState && GM._wdState[name];
      if (_st2) { _st2.emotion = _eMap2[parsed.emotionState] || 3; _wdUpdateEmotionBar(name); }
    }
    // 后妃留宿请求——挂起 pending，由玩家按钮决定接受/婉拒
    if (ch && _wdIsPlayerConsort(ch) && (parsed && parsed.requestOvernight || ch._audienceRequestOvernight)) {
      GM._pendingOvernightReq = { name: name, turn: GM.turn };
      // 在对话下方渲染接受/婉拒按钮
      setTimeout(function(){
        var chatE = _$('wd-modal-chat'); if (!chatE) return;
        if (_$('wd-overnight-btns')) return;  // 避免重复
        var btnDiv = document.createElement('div');
        btnDiv.id = 'wd-overnight-btns';
        btnDiv.style.cssText = 'display:flex;gap:10px;justify-content:center;padding:12px 0;border-top:1px dashed var(--vermillion-400);margin-top:8px;';
        btnDiv.innerHTML = '<div style="flex:1;text-align:center;font-size:0.8rem;color:var(--vermillion-400);padding:6px;font-family:\'STKaiti\',serif;letter-spacing:0.12em;">〘 留 宿 之 请 〙</div>'
          + '<button class="bt bp bsm" onclick="_wdAcceptOvernight()" style="background:linear-gradient(135deg,var(--vermillion-400),var(--vermillion-500));">应 允</button>'
          + '<button class="bt bs bsm" onclick="_wdDeclineOvernight()">改 日</button>';
        chatE.appendChild(btnDiv);
        chatE.scrollTop = chatE.scrollHeight;
      }, 200);
    }
    // 建议——兼容新 {topic,content} object 与旧 string
    var _wdSugs = [];
    if (parsed && parsed.suggestions && Array.isArray(parsed.suggestions)) {
      parsed.suggestions.forEach(function(sg) {
        if (!sg) return;
        var stored = _wdStoreEdictSuggestion(name, sg, { mode: 'audience-opening' });
        if (stored) {
          _wdSugs.push(sg);
        }
      });
      // 刷新诸书建议库侧边栏
      if (typeof _renderEdictSuggestions === 'function') _renderEdictSuggestions();
    }
    // 在 NPC 气泡下方追加"进言要点"展示（对齐普通问对路径）
    if (_wdSugs.length > 0) {
      if (_bubbleWrap && _bubbleWrap.parentNode) {
        var _sugBox = document.createElement('div');
        _sugBox.style.cssText = 'margin-top:4px;padding:4px 6px;background:rgba(184,154,83,0.1);border-radius:4px;font-size:0.72rem;';
        var _sugInner = '<div style="color:var(--gold-400);font-weight:700;margin-bottom:2px;">\u8FDB\u8A00\u8981\u70B9\uFF1A</div>';
        _wdSugs.forEach(function(sg) {
          var _txt = (typeof sg === 'string') ? sg
                   : (sg && sg.content) ? ((sg.topic ? '\u3014' + sg.topic + '\u3015 ' : '') + sg.content)
                   : '';
          if (!_txt) return;
          _sugInner += '<div style="display:flex;justify-content:space-between;align-items:center;padding:2px 0;gap:6px;">';
          _sugInner += '<span style="color:var(--color-foreground);flex:1;">\u2022 ' + escHtml(_txt) + '</span>';
          _sugInner += '<span style="color:var(--celadon-400);font-size:0.7rem;opacity:0.7;white-space:nowrap;">\u2713\u5DF2\u5165\u5E93</span>';
          _sugInner += '</div>';
        });
        _sugBox.innerHTML = _sugInner;
        _bubbleWrap.parentNode.appendChild(_sugBox);
      }
    }
  } catch(e) {
    if (!_audienceOpeningCommitted) _wdCommitAudienceOpening(name, ch, _wdAudienceOpeningFallback(name, ch));
  }
  _wenduiSending = false;
  if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = '奉旨'; }
  GM._wdAudienceMode = false;
}

/** 拒绝NPC求见 */
function _wdDenyAudience(name) {
  var ch = (typeof findCharByName === 'function') ? findCharByName(name) : null;
  // #7·拒见有后果：按求见诉求紧要程度，被拒者生怨（确定性·经 canonical adjustCharacterLoyalty）
  var _urgent = false, _agTag = '';
  if (ch && typeof _wdDeriveAudienceAgenda === 'function') {
    try { var _ag = _wdDeriveAudienceAgenda(ch); _agTag = (_ag && _ag.tag) || ''; _urgent = (_agTag === 'commitment' || _agTag === 'grievance' || _agTag === 'warn'); } catch (_) {}
  }
  // ④ 朝堂噤声:记下被拒的忠谏(warn)·供回合末聚合"屡拒忠谏→群臣噤声"
  if (_agTag === 'warn') {
    if (!Array.isArray(GM._wdRefusedCounsel)) GM._wdRefusedCounsel = [];
    GM._wdRefusedCounsel.push({ name: name, turn: GM.turn });
    if (GM._wdRefusedCounsel.length > 40) GM._wdRefusedCounsel = GM._wdRefusedCounsel.slice(-40);
  }
  if (ch) {
    var _loyHit = _urgent ? -2 : -1;
    if (typeof adjustCharacterLoyalty === 'function') adjustCharacterLoyalty(ch, _loyHit, '求见被拒于殿外', { source: 'wendui-audience-denied' });
    else ch.loyalty = Math.max(0, Math.min(100, ((typeof ch.loyalty === 'number') ? ch.loyalty : 50) + _loyHit));
    ch.stress = Math.max(0, Math.min(100, (ch.stress || 0) + (_urgent ? 8 : 4)));
  }
  if (typeof NpcMemorySystem !== 'undefined') {
    NpcMemorySystem.remember(name, _urgent ? '有紧要事求见，竟被拒于殿外——心寒' : '求见皇帝被拒于殿外', _urgent ? '怨' : '忧', _urgent ? 6 : 4, '天子');
  }
  // 移出待见队列（已处置）
  if (Array.isArray(GM._pendingAudiences)) GM._pendingAudiences = GM._pendingAudiences.filter(function(q){ return q && q.name !== name; });
  if (typeof addEB === 'function') addEB('问对·拒见', name + '求见被拒' + (_urgent ? '（其事紧要·恐生怨怼）' : ''));
  toast(name + '的求见被拒' + (_urgent ? '——其有紧要事，恐生怨怼' : '——已记入其记忆'));
  renderWenduiChars();
}

/** 接见 AI 推送的待见队列中的某条 */
function _wdOpenAudienceQueue(qi) {
  var q = GM._pendingAudiences && GM._pendingAudiences[qi]; if (!q) return;
  var name = q.name;
  // 若是外藩使节，记入 NPC（否则可能角色不存在）
  var ch = findCharByName(name);
  if (!ch && q.isEnvoy) {
    // 为使节创建临时角色对象，挂钩势力+保留来意/外交类型供 AI 使用
    var _factionObj = q.fromFaction ? _wdFindFaction(q.fromFaction) : null;
    ch = {
      name: name, alive: true, _envoy: true,
      faction: q.fromFaction || '',  // 关键：挂钩势力（标准字段）
      fromFaction: q.fromFaction,
      interactionType: q.interactionType,
      _factionProposalId: q._factionProposalId, _diplomacyType: q._diplomacyType,  // 【S3】带提议 id·供准奏/驳回回写发起势力持久记忆
      envoyMission: q.reason || '',
      location: (typeof _getPlayerLocation === 'function' ? _getPlayerLocation() : null) || GM._capital || '京城',  // 2026-06-26 使节所在地随玩家实际所在地(非固定 GM._capital/京城)·否则玩家不在都城(如绍宋在应天府)时使节被判"远在京城·不能召见"
      isTemp: true,
      title: q.fromFaction ? (q.fromFaction + '使节') : '外藩使节',
      officialTitle: '使节',
      position: '使节',
      loyalty: 50,
      // 从势力继承立场/文化/外交倾向
      stance: _factionObj ? (_factionObj.stance || '') : '',
      culture: _factionObj ? (_factionObj.culture || '') : '',
      diplomacy: _factionObj ? (_factionObj.diplomacy || 55) : 55,
      intelligence: 60
    };
    if (!GM.chars) GM.chars = [];
    (typeof TM !== 'undefined' && TM.Roster ? TM.Roster.addChar : function(_c){ GM.chars.push(_c); })(ch);
    // 关键：新加入的使节须立即注册到索引·否则 findCharByName 找不到·_wdNpcInitiateSpeak 静默退出（这是"使节不发言"的真正根因）
    if (GM._indices && GM._indices.charByName) {
      GM._indices.charByName.set(name, ch);
    } else if (typeof buildIndices === 'function') {
      buildIndices();
    }
  } else if (ch && q.isEnvoy) {
    // 角色已存在（重复求见）——刷新来意并确保挂钩势力
    ch._envoy = true;
    // [Slice J·2026-05-10] 走 Membership API·替代直接 ch.faction= 写
    var _envFac = q.fromFaction || ch.faction;
    if (window.TM && window.TM.FactionMembership && window.TM.FactionMembership.assignChar && _envFac !== ch.faction) {
      window.TM.FactionMembership.assignChar(ch, _envFac, { reason: '使节再次到访·势力归属同步' });
    } else {
      ch.faction = _envFac;
    }
    ch.fromFaction = q.fromFaction;
    ch.interactionType = q.interactionType;
    ch._factionProposalId = q._factionProposalId; ch._diplomacyType = q._diplomacyType;  // 【S3】同步提议 id(重复求见也能回写)
    ch.envoyMission = q.reason || ch.envoyMission || '';
    ch.position = ch.position || '使节';
    ch.officialTitle = ch.officialTitle || '使节';
  }
  var isPlayerConsortQueue = !!(ch && q.isConsort && _wdIsPlayerConsort(ch));
  if (q.isConsort && !isPlayerConsortQueue) {
    GM._pendingAudiences.splice(qi, 1);
    if (typeof toast === 'function') toast(name + '并非本朝后宫，已移出求见。');
    renderWenduiChars();
    return;
  }
  if (!q.isEnvoy) {
    if (!ch) {
      GM._pendingAudiences.splice(qi, 1);
      if (typeof toast === 'function') toast('求见人物不存在，已移出队列。');
      renderWenduiChars();
      return;
    }
    if (!_wdCanDirectAudience(ch)) {
      GM._pendingAudiences.splice(qi, 1);
      if (typeof toast === 'function') toast(name + '不在御前，不能直接接见。');
      renderWenduiChars();
      return;
    }
  }
  // 移出队列
  GM._pendingAudiences.splice(qi, 1);
  // 后妃请见：标记情绪/留宿上下文
  if (isPlayerConsortQueue) {
    ch._audienceMood = q.consortMood || '企盼';
    ch._audienceRequestOvernight = !!q.requestOvernight;
    ch._audienceReason = q.reason || '';
  }
  // 打开问对
  if (typeof _wdOpenAudience === 'function') {
    // 后妃：大概率私下，小概率朝堂——受能力/性格/家族/关系影响
    if (isPlayerConsortQueue) {
      var wantFormal = 0.1;  // 基础 10% 走朝堂
      // 野心高/好干政 → 更愿在朝堂
      if ((ch.ambition||50) > 70) wantFormal += 0.15;
      if ((ch.intelligence||50) > 75) wantFormal += 0.08;
      // 母族强势（有权臣/节度使亲戚）→ 更愿公开发言
      if (ch.motherClan && /(\u738B|\u516C|\u4FAF|\u5C06|\u8282\u5EA6|\u4E1E\u76F8|\u5C1A\u4E66|\u5927\u5C06\u519B)/.test(ch.motherClan)) wantFormal += 0.12;
      // 皇后比其他妃嫔更有朝堂资格
      if (ch.spouseRank === 'empress') wantFormal += 0.1;
      // 情绪"进言"基本只走朝堂；"喜悦/思念/企盼"几乎必私下
      if (q.consortMood === '进言') wantFormal += 0.4;
      else if (q.consortMood === '喜悦' || q.consortMood === '思念' || q.consortMood === '企盼') wantFormal -= 0.15;
      // 与帝亲密（高 loyalty + 高 opinion）→ 更倾向私下
      if ((ch.loyalty||50) > 80) wantFormal -= 0.08;
      // 性格/特质
      if (ch.traitIds && P.traitDefinitions) {
        var _traits = ch.traitIds.map(function(id){ var d=P.traitDefinitions.find(function(t){return t.id===id;}); return d ? d.name : ''; }).join('');
        if (/\u6A2A|\u72E0|\u86EE\u6A2A/.test(_traits)) wantFormal += 0.15;  // 强横妃嫔
        if (/\u6E29\u987A|\u6DD1\u5FB7/.test(_traits)) wantFormal -= 0.1;
      }
      wantFormal = Math.max(0.03, Math.min(0.5, wantFormal));
      var mode = Math.random() < wantFormal ? 'formal' : 'private';
      _wenduiMode = mode;
      openWenduiModal(name, mode);
      GM._wdAudienceMode = true;
      setTimeout(function(){ _wdNpcInitiateSpeak(name); }, 300);
    } else {
      _wdOpenAudience(name);
    }
  } else {
    toast('接见 ' + name);
  }
}

/** 应允留宿——次回合推演须体现帝幸某宫 */
function _wdAcceptOvernight() {
  var req = GM._pendingOvernightReq; if (!req) return;
  var name = req.name;
  var ch = findCharByName(name);
  if (!ch) return;
  if (!GM._pendingOvernight) GM._pendingOvernight = [];
  GM._pendingOvernight.push({ name: name, turn: GM.turn, status: 'accepted' });
  // ⑧ 闭合冷落计数:留宿即帝幸·重置 _lastEmperorVisitTurn(否则 _generateConsortAudiences 永远算"久未蒙幸"·后妃恒幽怨)
  ch._lastEmperorVisitTurn = GM.turn;
  // 妃子关系加深（忠诚 + 压力 -）
  if (typeof ch.loyalty === 'number') {
    if (typeof adjustCharacterLoyalty === 'function') adjustCharacterLoyalty(ch, 3, '\u51C6\u7559\u5BBF\u00B7\u6069\u7737\u52A0\u6DF1', { source:'wendui-overnight-accepted' });
    else ch.loyalty = Math.min(100, ch.loyalty + 3);
  }
  if (typeof ch.stress === 'number') ch.stress = Math.max(0, ch.stress - 10);
  if (typeof NpcMemorySystem !== 'undefined') NpcMemorySystem.remember(name, '请得陛下留宿·恩眷殷深', '喜', 8, (P.playerInfo && P.playerInfo.characterName) || '陛下');
  if (typeof addEB === 'function') addEB('\u540E\u5BAB', '\u5E1D\u5C06\u5BBF\u4E8E' + name + '\u5BAB');
  delete GM._pendingOvernightReq;
  var btnDiv = _$('wd-overnight-btns');
  if (btnDiv) btnDiv.innerHTML = '<div style="flex:1;text-align:center;color:var(--vermillion-300);font-style:italic;padding:6px;">\u5DF2\u5E94\u5141\u00B7\u4ECA\u591C\u5C06\u5BBF' + escHtml(name) + '\u5BAB</div>';
  if (typeof toast === 'function') toast('\u5DF2\u5E94\u5141\u00B7\u4ECA\u591C\u5BBF' + name + '\u5BAB');
}
function _wdDeclineOvernight() {
  var req = GM._pendingOvernightReq; if (!req) return;
  var name = req.name;
  var ch = findCharByName(name);
  if (ch) {
    if (typeof ch.loyalty === 'number') {
      if (typeof adjustCharacterLoyalty === 'function') adjustCharacterLoyalty(ch, -1, '\u8BF7\u7559\u5BBF\u672A\u51C6', { source:'wendui-overnight-denied' });
      else ch.loyalty = Math.max(0, ch.loyalty - 1);
    }
    if (typeof ch.stress === 'number') ch.stress = Math.min(100, ch.stress + 5);
    if (typeof NpcMemorySystem !== 'undefined') NpcMemorySystem.remember(name, '请留宿而未准·心中黯然', '忧', 5, (P.playerInfo && P.playerInfo.characterName) || '陛下');
  }
  delete GM._pendingOvernightReq;
  var btnDiv = _$('wd-overnight-btns');
  if (btnDiv) btnDiv.innerHTML = '<div style="flex:1;text-align:center;color:var(--ink-400);font-style:italic;padding:6px;">\u5BAB\u6709\u8981\u4E8B\u00B7\u6539\u65E5\u518D\u8BAE</div>';
  if (typeof toast === 'function') toast('\u6539\u65E5\u518D\u8BAE');
}

/** 拒见队列中的某条 */
function _wdDismissPending(qi) {
  var q = GM._pendingAudiences && GM._pendingAudiences[qi]; if (!q) return;
  if (typeof NpcMemorySystem !== 'undefined') {
    NpcMemorySystem.remember(q.name, '求见陛下被拒——' + (q.reason || ''), '忧', 4);
  }
  GM._pendingAudiences.splice(qi, 1);
  toast('已拒见 ' + q.name);
  renderWenduiChars();
}

/** 问对仪式操作 */
function _wdCeremony(type) {
  var name = GM.wenduiTarget;
  var chatEl = _$('wd-modal-chat');
  var _cDiv = _$('wd-ceremony');
  if (_cDiv) _cDiv.remove();
  var state = GM._wdState && GM._wdState[name];
  if (state) state.ceremony = type;
  var msg = '';
  if (type === 'seat') { msg = '（赐座。' + escHtml(name) + '谢恩入座，神色放松。）'; if (state) state.emotion = Math.max(1, state.emotion - 1); }
  else if (type === 'stand') { msg = '（未赐座。' + escHtml(name) + '恭立殿中。）'; }
  else if (type === 'tea') { msg = '（赐茶。' + escHtml(name) + '双手捧茶，感激之色溢于言表。）'; if (state) state.emotion = Math.max(1, state.emotion - 1); }
  else if (type === 'wine') { msg = '（赐酒。' + escHtml(name) + '受宠若惊，酒过三巡更加畅所欲言。）'; if (state) state.emotion = Math.max(1, state.emotion - 2); }
  else { msg = '（直入正题。）'; }
  if (chatEl) {
    var div = document.createElement('div');
    div.style.cssText = 'text-align:center;font-size:0.72rem;color:var(--ink-300);padding:4px;';
    div.textContent = msg;
    chatEl.appendChild(div);
  }
  // 赐座/赐茶影响NPC记忆
  if ((type === 'seat' || type === 'tea' || type === 'wine') && typeof NpcMemorySystem !== 'undefined') {
    NpcMemorySystem.remember(name, '面圣时获' + (type === 'seat' ? '赐座' : type === 'tea' ? '赐茶' : '赐酒') + '之礼', '喜', 3, '天子');
  }
  _wdUpdateEmotionBar(name);
}

/** 当场赏赐 */
function _wdReward() {
  var name = GM.wenduiTarget; if (!name) return;
  var bg = document.createElement('div');
  bg.style.cssText = 'position:fixed;inset:0;z-index:1300;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;';
  bg.innerHTML = '<div style="background:var(--color-surface);border:1px solid var(--gold-500);border-radius:var(--radius-lg);padding:1rem 1.5rem;max-width:300px;">'
    + '<div style="font-size:var(--text-sm);color:var(--gold-400);margin-bottom:var(--space-2);">\u8D4F\u8D50 ' + escHtml(name) + '</div>'
    + '<div style="display:flex;flex-direction:column;gap:var(--space-1);">'
    + '<button class="bt bp bsm" onclick="_wdDoReward(\'gold\');this.closest(\'div[style*=fixed]\').remove();">\u8D50\u91D1\uFF08忠+5·耗内帑）</button>'
    + '<button class="bt bs bsm" onclick="_wdDoReward(\'robe\');this.closest(\'div[style*=fixed]\').remove();">\u8D50\u8863\uFF08\u5FE0+3\uFF0C\u5A01\u671B+1\uFF09</button>'
    + '<button class="bt bs bsm" onclick="_wdDoReward(\'feast\');this.closest(\'div[style*=fixed]\').remove();">\u8D50\u5BB4\uFF08\u5FE0+4\uFF0C\u538B\u529B-10\uFF09</button>'
    + '<button class="bt bs bsm" onclick="_wdDoReward(\'promote\');this.closest(\'div[style*=fixed]\').remove();">\u52A0\u5B98\uFF08\u5199\u5165\u8BCF\u4EE4\u5EFA\u8BAE\u5E93\uFF09</button>'
    + '<button class="bt" onclick="this.closest(\'div[style*=fixed]\').remove();">\u53D6\u6D88</button>'
    + '</div></div>';
  document.body.appendChild(bg);
}
// ★2026-07-01 W5·双向问责:皇帝对臣的许诺登记入册·激活 tm-authority-deep 里在等却没人喂的 _imperialPromises 死钩子。
//   快照许诺时官职→detector 每回合判:官职有变=践诺(宽松避误罚)·逾3月未变=铁证食言→掉该臣忠诚+入怨恨记忆+损皇威。
//   同类未决承诺只续期不重复登记(避免反复许诺刷罚)。
function _registerImperialPromise(npcName, kind, detail) {
  if (!npcName) return;
  var ch = (typeof findCharByName === 'function') ? findCharByName(npcName) : null;
  if (!GM._imperialPromises) GM._imperialPromises = [];
  var dup = GM._imperialPromises.find(function(p){ return p && p.npc === npcName && p.kind === kind && !p.fulfilled && !p._npcReneged; });
  if (dup) { dup.promiseTurn = GM.turn || 0; return; }
  GM._imperialPromises.push({
    npc: npcName, kind: kind || 'promote', detail: detail || '',
    promiseTurn: GM.turn || 0, fulfilled: false, _brokenFired: false, _npcReneged: false,
    _snapTitle: ch ? (ch.officialTitle || ch.title || '') : '',
    _snapRank: (ch && typeof ch.rankLevel === 'number') ? ch.rankLevel : null   // ★codex-fix W5:快照品级(1=正一品最高·数值越小越高)·detector 据此判「真升迁」而非任意 title 变化
  });
}
function _wdDoReward(type) {
  var name = GM.wenduiTarget; var ch = findCharByName(name); if (!ch) return;
  var chatEl = _$('wd-modal-chat');
  var _typeLabels = { gold: '赐金', robe: '赐衣', feast: '赐宴', promote: '加官' };
  var msg = '（' + (_typeLabels[type]||'赏赐') + '。）';
  if (type === 'promote') {
    if (!GM._edictSuggestions) GM._edictSuggestions = [];
    GM._edictSuggestions.push({ source: '问对', from: '赏赐', content: '加官' + name, turn: GM.turn, used: false });
    _registerImperialPromise(name, 'promote', '加官');   // ★W5·许加官=对该臣的承诺·登记入册·逾期不兑现将掉其忠诚+损皇威
    msg = '（许以加官。已录入诏书建议库。）';
  }
  // A·确定性落账：标多少落多少（dedup·prompt 已告知 AI 勿在 char_updates 重复给 loyalty/stress）
  else if (type === 'gold') {
    if (typeof adjustCharacterLoyalty === 'function') adjustCharacterLoyalty(ch, 5, '面圣获赐金', { source:'wendui-reward' });
    else ch.loyalty = clamp((typeof ch.loyalty === 'number' ? ch.loyalty : 50) + 5, 0, 100);
    // A·待办完成：赐金真耗内帑（皇帝私藏·neitang 为安全 top-level 字段·非 cascade·clamp 到余额）
    var _gpay = 0;
    if (GM.neitang) {
      var _gbal = (typeof GM.neitang.balance === 'number') ? GM.neitang.balance : (typeof GM.neitang.money === 'number' ? GM.neitang.money : null);
      if (_gbal !== null) {
        _gpay = Math.min(5000, Math.max(0, _gbal));
        // 内帑走 FiscalEngine 写口(2026-07-04 收口)·直改标量=ledger 不知情两本账
        if (_gpay > 0 && typeof FiscalEngine !== 'undefined' && FiscalEngine.spendFromNeitang) {
          FiscalEngine.spendFromNeitang({ money: _gpay }, '赐金');
        } else if (_gpay > 0) { // 沙箱兜底
          if (typeof GM.neitang.balance === 'number') GM.neitang.balance = _gbal - _gpay;
          if (typeof GM.neitang.money === 'number') GM.neitang.money = _gbal - _gpay;
        }
      }
    }
    msg = _gpay > 0 ? ('（赐金。忠+5·内帑-' + _gpay + '两。）') : '（赐金。忠+5·内帑空乏。）';
  } else if (type === 'robe') {
    if (typeof adjustCharacterLoyalty === 'function') adjustCharacterLoyalty(ch, 3, '面圣获赐衣', { source:'wendui-reward' });
    else ch.loyalty = clamp((typeof ch.loyalty === 'number' ? ch.loyalty : 50) + 3, 0, 100);
    if (typeof ch.fame === 'number') ch.fame = clamp(ch.fame + 1, 0, 100);
    msg = '（赐衣。忠+3·威望+1。）';
  } else if (type === 'feast') {
    if (typeof adjustCharacterLoyalty === 'function') adjustCharacterLoyalty(ch, 4, '面圣赐宴', { source:'wendui-reward' });
    else ch.loyalty = clamp((typeof ch.loyalty === 'number' ? ch.loyalty : 50) + 4, 0, 100);
    ch.stress = clamp((ch.stress || 0) - 10, 0, 100);
    msg = '（赐宴。忠+4·压力-10。）';
  }
  if (typeof NpcMemorySystem !== 'undefined') NpcMemorySystem.remember(name, '面圣时获' + (_typeLabels[type]||'赏赐'), '喜', 5, '天子');
  if (!GM._wdRewardPunish) GM._wdRewardPunish = [];
  GM._wdRewardPunish.push({ target: name, type: 'reward', detail: type, turn: GM.turn });
  // 注入当前对话上下文（影响后续AI回复）
  if (!GM.wenduiHistory[name]) GM.wenduiHistory[name] = [];
  GM.wenduiHistory[name].push({ role: 'system', content: '【赏赐】皇帝当场' + (_typeLabels[type]||'赏赐') + name + '。' });
  if (chatEl) { var d = document.createElement('div'); d.style.cssText = 'text-align:center;font-size:0.72rem;color:var(--celadon-400);padding:4px;'; d.textContent = msg; chatEl.appendChild(d); chatEl.scrollTop = chatEl.scrollHeight; }
  var state = GM._wdState && GM._wdState[name]; if (state) state.emotion = Math.max(1, state.emotion - 1);
  if (typeof renderWenduiChars === 'function') renderWenduiChars();
  _wdUpdateEmotionBar(name);
}

/** 当场处罚 */
function _wdPunish() {
  var name = GM.wenduiTarget; if (!name) return;
  var bg = document.createElement('div');
  bg.style.cssText = 'position:fixed;inset:0;z-index:1300;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;';
  bg.innerHTML = '<div style="background:var(--color-surface);border:1px solid var(--vermillion-400);border-radius:var(--radius-lg);padding:1rem 1.5rem;max-width:300px;">'
    + '<div style="font-size:var(--text-sm);color:var(--vermillion-400);margin-bottom:var(--space-2);">\u5904\u7F5A ' + escHtml(name) + '</div>'
    + '<div style="display:flex;flex-direction:column;gap:var(--space-1);">'
    + '<button class="bt bsm" style="color:var(--amber-400);" onclick="_wdDoPunish(\'fine\');this.closest(\'div[style*=fixed]\').remove();">\u7F5A\u4FF8\uFF08\u5FE0-3\uFF09</button>'
    + '<button class="bt bsm" style="color:var(--vermillion-400);" onclick="_wdDoPunish(\'demote\');this.closest(\'div[style*=fixed]\').remove();">\u964D\u804C\uFF08\u5199\u5165\u8BCF\u4EE4\uFF09</button>'
    + '<button class="bt bsm" style="color:var(--vermillion-400);" onclick="_wdDoPunish(\'imprison\');this.closest(\'div[style*=fixed]\').remove();">\u4E0B\u72F1\uFF08\u5FE0-15\uFF0C\u538B\u529B+30\uFF09</button>'
    + '<button class="bt bsm" style="color:var(--vermillion-400);" onclick="_wdDoPunish(\'cane\');this.closest(\'div[style*=fixed]\').remove();">\u6756\u8D23\uFF08\u5FE0-8\uFF0C\u538B\u529B+15\uFF09</button>'
    + '<button class="bt" onclick="this.closest(\'div[style*=fixed]\').remove();">\u53D6\u6D88</button>'
    + '</div></div>';
  document.body.appendChild(bg);
}
function _wdDoPunish(type) {
  var name = GM.wenduiTarget; var ch = findCharByName(name); if (!ch) return;
  var chatEl = _$('wd-modal-chat');
  var _typeLabels = { fine: '罚俸', demote: '降职', imprison: '下狱', cane: '杖责' };
  var msg = '（' + (_typeLabels[type]||'处罚') + '。）';
  if (type === 'imprison') msg = '（令拿下！）';
  else if (type === 'cane') msg = '（杖责二十。）';
  if (type === 'demote') {
    if (!GM._edictSuggestions) GM._edictSuggestions = [];
    GM._edictSuggestions.push({ source: '问对', from: '处罚', content: '降职' + name, turn: GM.turn, used: false });
    msg = '（令降职。已录入诏书建议库。）';
  }
  // A·确定性落账：标多少落多少（dedup·prompt 已告知 AI 勿重复给 loyalty/stress）
  else if (type === 'fine') {
    if (typeof adjustCharacterLoyalty === 'function') adjustCharacterLoyalty(ch, -3, '面圣罚俸', { source:'wendui-punish' });
    else ch.loyalty = clamp((typeof ch.loyalty === 'number' ? ch.loyalty : 50) - 3, 0, 100);
    msg = '（罚俸。忠-3。）';
  } else if (type === 'cane') {
    if (typeof adjustCharacterLoyalty === 'function') adjustCharacterLoyalty(ch, -8, '面圣杖责', { source:'wendui-punish' });
    else ch.loyalty = clamp((typeof ch.loyalty === 'number' ? ch.loyalty : 50) - 8, 0, 100);
    ch.stress = clamp((ch.stress || 0) + 15, 0, 100);
    msg = '（杖责二十。忠-8·压力+15。）';
  } else if (type === 'imprison') {
    if (typeof adjustCharacterLoyalty === 'function') adjustCharacterLoyalty(ch, -15, '面圣下狱', { source:'wendui-punish' });
    else ch.loyalty = clamp((typeof ch.loyalty === 'number' ? ch.loyalty : 50) - 15, 0, 100);
    ch.stress = clamp((ch.stress || 0) + 30, 0, 100);
    // A·真下狱：set _imprisoned 接 WenduiPrison 狱中子系统（canonical 三字段·同 tm-ai-change-applier:463）
    ch._imprisoned = true;
    ch._imprisonedTurn = GM.turn || 0;
    ch._imprisonReason = ch._imprisonReason || '面圣忤旨·当场下诏狱';
    msg = '（令拿下，下诏狱！忠-15·压力+30·已入狱。）';
  }
  if (typeof NpcMemorySystem !== 'undefined') NpcMemorySystem.remember(name, '面圣时受' + (_typeLabels[type]||'处罚'), '怨', 8, '天子');
  if (!GM._wdRewardPunish) GM._wdRewardPunish = [];
  GM._wdRewardPunish.push({ target: name, type: 'punish', detail: type, turn: GM.turn });
  // 注入对话上下文
  if (!GM.wenduiHistory[name]) GM.wenduiHistory[name] = [];
  GM.wenduiHistory[name].push({ role: 'system', content: '【处罚】皇帝当场' + (_typeLabels[type]||'处罚') + name + '。' });
  if (chatEl) { var d = document.createElement('div'); d.style.cssText = 'text-align:center;font-size:0.72rem;color:var(--vermillion-400);padding:4px;'; d.textContent = msg; chatEl.appendChild(d); chatEl.scrollTop = chatEl.scrollHeight; }
  var state = GM._wdState && GM._wdState[name]; if (state) state.emotion = Math.min(5, state.emotion + 2);
  if (typeof renderWenduiChars === 'function') renderWenduiChars();
  _wdUpdateEmotionBar(name);
}

/** 更新NPC情绪指示条 */
function _wdUpdateEmotionBar(name) {
  var state = GM._wdState && GM._wdState[name];
  if (!state) return;
  var dots = _$('wd-emotion-dots');
  if (!dots) return;
  var e = Math.max(1, Math.min(5, state.emotion));
  var mark = dots.querySelector ? dots.querySelector('.wd-emo-mark') : null;
  if (mark) {
    // \u60C5\u7EEA 1(\u955C\u5B9A)\u21925(\u7D27\u5F20)\u00B7\u6ED1\u5757\u6CBF\u9752\u2194\u6731\u8F68\u79FB\u52A8
    mark.style.left = Math.round((e - 1) / 4 * 100) + '%';
  } else {
    var filled = '', empty = '';
    for (var i = 0; i < e; i++) filled += '\u25CF';
    for (var j = e; j < 5; j++) empty += '\u25CB';
    dots.textContent = filled + empty;
  }
}

function closeWenduiModal() {
  var _targetName = GM.wenduiTarget;
  var _closingMode = _wenduiMode;   // L4·b2·snapshot 关前 mode
  // L4·f1·对质后果——御前对质给在场者之间记 confront 关系账（行为有代价：affinity−10/积怨+1）
  if (Array.isArray(_wdConfronters) && _wdConfronters.length && _targetName && typeof applyNpcInteraction === 'function') {
    _wdConfronters.forEach(function(_cfName) {
      if (!_cfName || _cfName === _targetName) return;
      try {
        applyNpcInteraction(_targetName, _cfName, 'confront', { description: '御前对质', visibility: 'court' });
        applyNpcInteraction(_cfName, _targetName, 'confront', { description: '御前对质', visibility: 'court' });
      } catch(_){}
    });
  }
  _wdConfronters = []; // 清除对质者
  _wdScreened = false; // E2·清除屏退态
  var m = _$('wendui-modal'); if (m) m.remove();
  GM.wenduiTarget = null;
  // L4·b2·若关 cedui mode·调 hook 应用政治后果
  // G2·step 0a·若 G2 enke wendui context active·优先路由 G2 hook (避误调 L4 改革 handler)
  if (_closingMode === 'cedui' && _targetName && typeof window !== 'undefined') {
    var _g2Routed = false;
    if (window._kjG2EnkeWenduiContext && typeof window._kjG2OnEnkeWenduiClose === 'function') {
      try { _g2Routed = window._kjG2OnEnkeWenduiClose(_targetName); } catch(_){}
    }
    if (!_g2Routed && typeof window._kjpOnCeduiClose === 'function') {
      try { window._kjpOnCeduiClose(_targetName); } catch(_){}
    }
  }
  // ── 已见：移出待接见队列、压抑动态求见到下一回合 ──
  if (_targetName) {
    if (Array.isArray(GM._pendingAudiences) && GM._pendingAudiences.length) {
      GM._pendingAudiences = GM._pendingAudiences.filter(function(q){ return q && q.name !== _targetName; });
    }
    var _ch = findCharByName(_targetName);
    if (_ch) {
      _ch._lastMetTurn = GM.turn;
      // ⑧ 私下召见后妃即帝幸眷顾·重置冷落计数(与留宿同源·闭合 _generateConsortAudiences 的"久未蒙幸"循环)
      if (_wenduiMode === 'private' && typeof _wdIsPlayerConsort === 'function' && _wdIsPlayerConsort(_ch)) {
        _ch._lastEmperorVisitTurn = GM.turn;
      }
      // ⑨ 使节问对收尾:留痕(起居注+事件板·可见)+结构化记录(供外交层/endturn 演绎后续邦交反应·完整准/拒→关系/岁币/边境效果归外交子系统)
      if (_ch._envoy) {
        var _envFac = _ch.fromFaction || _ch.faction || '外藩';
        var _envMission = String(_ch.envoyMission || _ch.interactionType || '外交使命').slice(0, 40);
        if (!Array.isArray(GM._envoyAudiences)) GM._envoyAudiences = [];
        var _envDisp = _ch._pendingEnvoyDisposition || 'received';
        GM._envoyAudiences.push({ faction: _envFac, interactionType: _ch.interactionType || '', mission: _envMission, turn: GM.turn, received: true, disposition: _envDisp });
        delete _ch._pendingEnvoyDisposition;
        if (GM._envoyAudiences.length > 30) GM._envoyAudiences = GM._envoyAudiences.slice(-30);
        if (typeof TM !== 'undefined' && TM.Qiju) TM.Qiju.recordEntry({ turn: GM.turn, date: (typeof getTSText === 'function') ? getTSText(GM.turn) : '', content: '【问对·受使】陛下接见' + _envFac + '使节' + _targetName + '·议「' + _envMission + '」', category: '外交' });
        if (typeof addEB === 'function') addEB('外交·受使', _envFac + '使节面圣·议' + _envMission);
      }
      // 接见后压降压力/野心（见完心里踏实）
      if ((_ch.stress||0) > 0) _ch.stress = Math.max(0, (_ch.stress||0) - 10);
      // ④ 纳谏:忠臣犯颜进谏而获面陈(被听取)→忠诚得申·亲信微增(与拒忠言 #7 对称·_lastMetTurn 天然限一回合一次)
      try {
        var _clAg = (typeof _wdDeriveAudienceAgenda === 'function') ? _wdDeriveAudienceAgenda(_ch) : null;
        if (_clAg && _clAg.tag === 'warn' && _ch._counselAdoptedTurn !== GM.turn) {
          if (typeof adjustCharacterLoyalty === 'function') adjustCharacterLoyalty(_ch, 1, '犯颜进谏获君主当面听取', { source: 'wendui-warn-heard' });
          _ch._rapport = (_ch._rapport || 0) + 2;
          if (typeof NpcMemorySystem !== 'undefined') NpcMemorySystem.remember(_targetName, '犯颜进言·陛下肯当面听取——颇感欣慰', '敬', 5, '天子');
        }
      } catch (_) {}
    }
    // 来函未回标记 → 已回（视为面复）
    if (Array.isArray(GM.letters)) {
      GM.letters.forEach(function(l){
        if (l._npcInitiated && l.from === _targetName && l._replyExpected && !l._playerReplied) {
          l._playerReplied = true;
          l._repliedInAudience = true;
          l._repliedTurn = GM.turn;
        }
      });
    }
  }
  // ★ 异步提取本次问对中的承诺（玩家指令→NPC应答），供推演使用
  if (_targetName) _wd_extractCommitments(_targetName);
  // 性能·2026-06-10·名册/左栏刷新推迟一帧:先让弹窗移除这帧立即上屏(点关闭手感即时)·
  // 重建工作下一帧再做(renderWenduiChars 自带 gt-wendui 隐藏跳过 guard)
  var _wdAfterCloseRefresh = function(){
    try { renderWenduiChars(); } catch(_){}
    try { if (typeof renderLeftPanel === 'function') renderLeftPanel(); } catch(_){}
  };
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(function(){ requestAnimationFrame(_wdAfterCloseRefresh); });
  else setTimeout(_wdAfterCloseRefresh, 16);
}

/** 问对结束后抽取承诺：AI 读本次对话，产出 NPC 承诺清单 */
async function _wd_extractCommitments(targetName) {
  if (!P.ai || !P.ai.key || !targetName) return;
  // 仅取本次问对的对话片段——从 jishiRecords 取最新几条 target=此人
  // 仅取本次问对的对话——按 mode 过滤，避免把朝议发言误作问对承诺
  var records = (GM.jishiRecords||[]).filter(function(r){
    if (r.char !== targetName || r.turn !== GM.turn) return false;
    // ★2026-07-01 S3治「允诺不执行」:问对三态(formal正式/private私下/cedui策对)皆可成约——玩家在私下叙谈里下达的
    //   具体安排也应执行·而非只 formal。仍排除朝议(changchao/tinyi/yuqian)=群臣议政非君臣受命。具体性由下方抽取
    //   prompt「泛辞不提取」保证·故纳私下不会把体己闲谈误转承诺。
    return !r.mode || r.mode === 'formal' || r.mode === 'private' || r.mode === 'cedui';
  }).slice(-10);
  // ★2026-07-01 codex-fix S3:单轮指令(1条有来有往)也须能成约——说一句「去办X」+NPC应答+关闭=只1条记录·旧 <2 会静默跳过
  if (!records.length) return;
  if (records.length < 2 && !(records[0] && records[0].playerSaid && records[0].npcSaid)) return;
  var dialog = records.map(function(r){ return (r.playerSaid||'') + '\n' + (r.npcSaid||''); }).join('\n').slice(-3000);
  var ch = findCharByName(targetName);
  if (!ch) return;

  var prompt = '以下是皇帝与' + targetName + '（' + (ch.officialTitle||ch.title||'') + '，忠' + (ch.loyalty||50) + '，性' + (ch.personality||'').slice(0,15) + '）的问对片段。请提取玩家（皇帝）向此人下达的指令/任务/期望，以及该人在对话中的应答与承诺。\n\n';
  prompt += dialog + '\n\n';
  prompt += '【关键】\n';
  prompt += '· 只提取实实在在、有明确内容的任务（如"去查某事""写奏章""节制某军""调查某人"）\n';
  prompt += '· 泛泛之辞（"尽力为之""不负陛下"等）不提取\n';
  prompt += '· 若皇帝未下任何指令，返回空数组\n';
  prompt += '· willingness 体现该人执行意愿（按对话态度判——推诿者低，坦然应承者高）\n';
  // ★2026-07-01 S4·传话/涉他:若皇帝在对话里「要第三方B知晓某事」或「让此人转告B某事」·抽入 relays·供把消息传达给B(让B日后能知)
  prompt += '· relays：若皇帝提到要「通知/转告/让某第三方(记其姓名B)知道或去办」某事·填 relays（to=B的姓名·content=B应知或应办之事·via=经谁转告，如让此人转告B则填此人姓名、皇帝只是当面议及B则留空）；对话未涉及第三方则空数组\n';
  prompt += '返回 JSON：{"commitments":[{"task":"具体任务(30字内)","category":"query查办/write撰写/dispatch调遣/intel侦查/diplomacy外使/finance财赋/other","deadline":"回合数(1-10，默认3)","willingness":0-1,"npcPromise":"他答应的话(原句摘要)","conditions":"附加条件(若有)"}],"relays":[{"to":"第三方姓名","content":"要其知晓或去办之事(30字内)","via":"经谁转告(空=皇帝当面议及)"}]}';

  try {
    var raw = await callAI(prompt, 500);
    var obj = (typeof extractJSON === 'function') ? extractJSON(raw) : null;
    if (!obj) return;
    // ★2026-07-01 codex-fix S4:纯传话场景 AI 返回 {commitments:[], relays:[...]}·绝不能因 commitments 空就早退·
    //   否则 relays 永不执行=「让A转告B·B却不知」核心场景整个失效(codex 抓到的硬 bug)。commits/relays 任一有内容即处理。
    var _hasCommits = Array.isArray(obj.commitments) && obj.commitments.length > 0;
    var _hasRelays = Array.isArray(obj.relays) && obj.relays.length > 0;
    if (!_hasCommits && !_hasRelays) return;

    if (!GM._npcCommitments) GM._npcCommitments = {};
    if (!GM._npcCommitments[targetName]) GM._npcCommitments[targetName] = [];

    (obj.commitments || []).forEach(function(c) {
      if (!c || !c.task) return;
      var _cTask = String(c.task || '').trim();
      if (!_cTask) return;
      var _cKey = _cTask.slice(0, 30);
      var _dupCommit = GM._npcCommitments[targetName].find(function(old) {
        if (!old || old.assignedTurn !== GM.turn) return false;
        var _oldTask = String(old.task || '');
        if (!_oldTask) return false;
        return _oldTask.slice(0, 30) === _cKey || _oldTask.indexOf(_cKey.slice(0, 14)) >= 0 || _cTask.indexOf(_oldTask.slice(0, 14)) >= 0;
      });
      if (_dupCommit) {
        _dupCommit.category = c.category || _dupCommit.category || 'other';
        _dupCommit.deadline = parseInt(c.deadline,10) || _dupCommit.deadline || 3;
        _dupCommit.willingness = parseFloat(c.willingness) || _dupCommit.willingness || 0.6;
        if (c.npcPromise && !_dupCommit.npcPromise) _dupCommit.npcPromise = c.npcPromise;
        if (c.conditions && !_dupCommit.conditions) _dupCommit.conditions = c.conditions;
        _dupCommit.responsibility = 'npc';
        return;
      }
      var commit = {
        id: (typeof uid==='function'?uid():'cmt_'+Date.now()),
        task: _cTask,
        category: c.category || 'other',
        assignedTurn: GM.turn,
        deadline: Math.max(1, Math.min(10, parseInt(c.deadline,10) || 3)),   // ★codex-fix W4:clamp 1-10·防 AI 写负数/超大 deadline(负数会被立即判逾期)
        willingness: parseFloat(c.willingness) || 0.6,
        npcPromise: c.npcPromise || '',
        conditions: c.conditions || '',
        status: 'pending',       // pending/executing/completed/failed/delayed
        progress: 0,
        attempts: 0,
        feedback: '',
        responsibility: 'npc',
        _source: 'wendui-extract'
      };
      GM._npcCommitments[targetName].push(commit);
      // 事件板
      if (typeof addEB === 'function') addEB('问对·受命', targetName + '允诺：' + c.task.slice(0,40));
      // 起居注
      if (typeof TM !== 'undefined' && TM.Qiju) TM.Qiju.recordEntry({
        turn: GM.turn,
        date: typeof getTSText==='function'?getTSText(GM.turn):'',
        content: '【问对·受命】' + targetName + '允：' + c.task + (c.npcPromise?' ——"' + c.npcPromise + '"':''),
        category: '问对'
      });
      // 写入 NPC 记忆
      if (typeof NpcMemorySystem !== 'undefined') {
        NpcMemorySystem.remember(targetName, '奉旨：' + c.task, c.willingness > 0.6 ? '敬' : '忧', 6);
      }
    });
    // ★2026-07-01 S4·传话落地:把「涉及第三方B」的消息写进 B 自己的记忆·B 日后被问对/推演即"知道"此事
    //   (治「告诉A让A转告B·B却不知」)。B 须真人·在世·非玩家。imp 6 令推演也可见。
    if (Array.isArray(obj.relays)) obj.relays.forEach(function(rl) {
      if (!rl || !rl.to || !rl.content) return;
      var _toName = String(rl.to).trim();
      if (!_toName || _toName === targetName) return;
      var _toCh = (typeof findCharByName === 'function') ? findCharByName(_toName) : null;
      if (!_toCh || _toCh.alive === false || _toCh.dead || _toCh._fakeDeath || _toCh.isPlayer) return;   // ★codex-fix S4:补 dead/_fakeDeath 守卫(与问对入口死亡判断对齐)
      var _via = String(rl.via || '').trim();
      var _relayContent = String(rl.content).slice(0, 30);
      // ★2026-07-01 W3b·传话以讹传讹:经中间人(via)转述时·若其操守低或对收件人有敌意→消息走样
      //   (呼应「让A转告B·A不可靠则B听到的变了味」)·复用 W3 的 TM.Gossip._distort·纯词面变换。
      //   注意:下面 addEB/起居注仍用原文(皇帝真实旨意留痕)·只有 B 的「记忆」存走样版·日后玩家可察觉出入。
      if (_via && typeof TM !== 'undefined' && TM.Gossip && typeof TM.Gossip._distort === 'function') {
        var _viaCh = (typeof findCharByName === 'function') ? findCharByName(_via) : null;
        var _viaHostile = (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.getImpression) ? (NpcMemorySystem.getImpression(_via, _toName) < -20) : false;
        _relayContent = TM.Gossip._distort(_relayContent, _viaCh, _viaHostile);
      }
      var _relayEvent = _via
        ? ('经' + _via + '转达圣意：' + _relayContent)
        : ('皇帝当面议及·嘱我知悉：' + _relayContent);
      if (typeof NpcMemorySystem !== 'undefined') NpcMemorySystem.remember(_toName, _relayEvent, '平', 6, '天子');
      if (typeof addEB === 'function') addEB('问对·传话', '皇帝托' + (_via || targetName) + '致意' + _toName + '：' + String(rl.content).slice(0, 30));
      if (typeof TM !== 'undefined' && TM.Qiju) TM.Qiju.recordEntry({ turn: GM.turn, date: typeof getTSText === 'function' ? getTSText(GM.turn) : '', content: '【问对·传话】皇帝令' + (_via || targetName) + '转致' + _toName + '：' + String(rl.content).slice(0, 30), category: '问对' });
    });
  } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, '_wd_extractCommitments') : console.warn('[_wd_extractCommitments]', e); }
}

// 2026-06-11·性能·打字流畅:计数器更新改 rAF 合帧。原每次按键(含中文 IME 逐字)同步写 cnt.textContent,
//   每写一次都生成一条 childList 变动 → 触发 tm-fixed-fit.js 那个挂在 documentElement(subtree) 的全局
//   MutationObserver 微任务。合帧后每帧至多一次更新·快速连打只在停顿那一帧落字数·肉眼无差。
var _wdCounterRaf = 0;
function _wdDoUpdateCounter() {
  _wdCounterRaf = 0;
  var inp = _$('wd-modal-input');
  var cnt = _$('wd-char-counter');
  if (inp && cnt) cnt.textContent = inp.value.length + '/5000';
}
function _wdUpdateCounter() {
  if (_wdCounterRaf) return;
  _wdCounterRaf = (typeof requestAnimationFrame === 'function')
    ? requestAnimationFrame(_wdDoUpdateCounter)
    : (setTimeout(_wdDoUpdateCounter, 16), 1);
}

/**
 * 渲染聊天历史 + 开场白
 */
function _wdRenderHistory(name, ch) {
  var chat = _$('wd-modal-chat'); if (!chat) return;
  chat.innerHTML = '';

  // 生成开场白
  var _greeting = _wdGenerateGreeting(name, ch);

  // 开场白气泡
  _wdAppendNpcBubble(chat, name, ch, _greeting);

  // 历史对话·性能 2026-06-10:只渲染最近 60 条(长期君臣的全量历史可达数百气泡·开窗即整列重排)·
  // 数据不裁(wenduiHistory 原样保留·AI 上下文照常 slice(-10))·只是开窗渲染窗口化
  var _wdAllHist = GM.wenduiHistory[name] || [];
  var _wdHistWin = _wdAllHist.length > 60 ? _wdAllHist.slice(-60) : _wdAllHist;
  if (_wdAllHist.length > _wdHistWin.length) {
    var _wdElide = document.createElement('div');
    _wdElide.style.cssText = 'text-align:center;font-size:0.71rem;color:var(--ink-300);padding:4px 8px;';
    _wdElide.textContent = '（更早 ' + (_wdAllHist.length - _wdHistWin.length) + ' 条问对记录已收起）';
    chat.appendChild(_wdElide);
  }
  _wdHistWin.forEach(function(msg) {
    if (msg.role === 'player') {
      _wdAppendPlayerBubble(chat, msg.content);
    } else if (msg.role === 'system') {
      // 面谕/赏罚等 system 纪事渲染为居中注记——曾被当 NPC 气泡·御赐显示成大臣发言(2026-07-04 审查定罪)
      var _sysD = document.createElement('div');
      _sysD.style.cssText = 'text-align:center;font-size:0.71rem;color:var(--ink-300);padding:4px 8px;';
      _sysD.textContent = String(msg.content || '');
      chat.appendChild(_sysD);
    } else {
      _wdAppendNpcBubble(chat, name, ch, msg.content, msg.loyaltyDelta, msg.suggestions, msg.toneEffect);
    }
  });

  chat.scrollTop = chat.scrollHeight;
}

// 时辰戳·每次问对随机起始时辰（会话内固定推进·会话间不同）
var _wdSessionShichenBase = 0;
function _wdShichen(i) {
  var t = ['辰初', '辰初一刻', '辰初二刻', '辰初三刻', '辰正', '辰正一刻', '辰正二刻', '巳初', '巳初一刻', '巳初二刻', '巳正', '巳正二刻', '午初', '午正', '未初', '未正'];
  var idx = _wdSessionShichenBase + (i | 0);
  return t[Math.min(Math.max(0, idx), t.length - 1)];
}
// 问对回复「附加块」HTML——语气效果 +「进言要点」(NPC 建议)。
// 2026-06-26 根治：此前仅实时回复(主路径内联渲染)有进言要点，历史重渲染(_wdAppendNpcBubble)无此渲染位置，
// 且历史条目不存 suggestions —— 故开窗/重渲后进言要点彻底丢失=「新UI没有进言要点这个设计」。
// 抽为共享 helper，让历史气泡也能渲染保留；条件渲染：仅当该条确有 suggestions/toneEffect 才出现
// （非每段都有，符合老问对UI行为）。
function _wdReplyExtrasHtml(suggestions, toneEffect) {
  var html = '';
  if (toneEffect) {
    html += '<div style="margin-top:3px;font-size:0.71rem;color:var(--ink-300);font-style:italic;">【' + escHtml(String(toneEffect)) + '】</div>';
  }
  var sugs = (suggestions && Array.isArray(suggestions)) ? suggestions.filter(function(s){ if (!s) return false; if (typeof s === 'string') return s.trim(); return s.content || s.text; }) : [];
  if (sugs.length > 0) {
    html += '<div style="margin-top:4px;padding:4px 6px;background:var(--gold-500,rgba(184,154,83,0.1));border-radius:4px;font-size:0.72rem;">';
    html += '<div style="color:var(--gold-400);font-weight:700;margin-bottom:2px;">进言要点：</div>';
    sugs.forEach(function(sg) {
      var _sgText = (typeof sg === 'string') ? sg
                  : (sg && sg.content) ? ((sg.topic ? '〔' + sg.topic + '〕 ' : '') + sg.content)
                  : (sg && sg.text) ? sg.text : '';
      if (!_sgText) return;
      html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:2px 0;gap:6px;">';
      html += '<span style="color:var(--color-foreground);flex:1;">• ' + escHtml(_sgText) + '</span>';
      html += '<span style="color:var(--celadon-400);font-size:0.7rem;opacity:0.7;white-space:nowrap;">✓已入库</span>';
      html += '</div>';
    });
    html += '</div>';
  }
  return html;
}
function _wdAppendNpcBubble(chat, name, ch, text, loyaltyDelta, suggestions, toneEffect) {
  var div = document.createElement('div');
  div.className = 'wendui-msg wendui-npc';
  var deltaTag = '';
  var _lF = typeof _fmtNum1==='function' ? _fmtNum1 : function(x){return x;};
  if (loyaltyDelta && loyaltyDelta > 0) deltaTag = ' <span style="color:var(--green);font-size:0.7rem;">忠+' + _lF(loyaltyDelta) + '</span>';
  else if (loyaltyDelta && loyaltyDelta < 0) deltaTag = ' <span style="color:var(--red);font-size:0.7rem;">忠' + _lF(loyaltyDelta) + '</span>';
  var _portrait = ch && ch.portrait ? '<img src="'+escHtml(ch.portrait)+'" loading="lazy" decoding="async" style="width:28px;height:28px;object-fit:cover;border-radius:50%;flex-shrink:0;">' : '';
  var _ts = (typeof _wdShichen === 'function') ? _wdShichen(chat.children.length) : '';
  div.innerHTML = _portrait + '<div style="flex:1;min-width:0;"><div class="wendui-npc-name">' + escHtml(name) + deltaTag + '</div>'
    + '<div class="wendui-npc-bubble wd-selectable">' + escHtml(text) + '<span class="wd-ts">' + _ts + '</span></div>'
    + _wdReplyExtrasHtml(suggestions, toneEffect) + '</div>';
  chat.appendChild(div);
}

function _wdAppendPlayerBubble(chat, text) {
  var div = document.createElement('div');
  div.className = 'wendui-msg wendui-player';
  var _ts = (typeof _wdShichen === 'function') ? _wdShichen(chat.children.length) : '';
  div.innerHTML = '<div class="wendui-player-col"><div class="wendui-emp-name">御笔</div><div class="wendui-player-bubble">' + escHtml(text) + '<span class="wd-ts">' + _ts + '</span></div></div><div class="wd-emp-av">御</div>';
  chat.appendChild(div);
}

/**
 * 生成开场白（基于角色特质、忠诚度、模式等）
 */
function _wdGenerateGreeting(name, _ch) {
  if (!_ch) return '参见。臣听候圣谕。';
  // 使节专用开场——不说"臣听候圣谕"，直接报来意
  if (_ch._envoy) {
    var _fac = _ch.fromFaction || '外藩';
    var _mission = (_ch.envoyMission || '').slice(0, 60);
    var _opener = '外臣' + _fac + '使节' + name + '，谨奉国书，参见陛下。';
    if (_mission) _opener += '此来——' + _mission;
    return _opener;
  }
  var _isPrv = (_wenduiMode === 'private');
  var _isAmbitious = (_ch.ambition || 50) > 70;
  var _isStressed = (_ch.stress || 0) > 50;
  var _traitWords = (_ch.personality || '') + ((_ch.traitIds || []).join(' '));
  var _isBrave = _traitWords.indexOf('勇') >= 0 || _traitWords.indexOf('brave') >= 0;
  var _isCautious = _traitWords.indexOf('慎') >= 0 || _traitWords.indexOf('cautious') >= 0;
  var _isScholar = _traitWords.indexOf('学') >= 0 || _traitWords.indexOf('diligent') >= 0;
  var _recentArc = '';
  if (GM.characterArcs && GM.characterArcs[_ch.name]) {
    var _last = GM.characterArcs[_ch.name].slice(-1)[0];
    if (_last) _recentArc = _last.type || '';
  }
  var _isTyrant = GM._tyrantDecadence && GM._tyrantDecadence > 30;
  var _isSycophant = _isAmbitious && (_ch.loyalty || 50) >= 40 && (_ch.loyalty || 50) <= 80;

  // 配偶
  if (_wdIsPlayerConsort(_ch)) {
    var _spRk = _ch.spouseRank || 'consort';
    var _spLoy = _ch.loyalty || 50;
    if (_isPrv) {
      if (_spLoy > 75) return _spRk === 'empress' ? '（端坐于妆台前，回头嫣然一笑）陛下怎么来了？今夜不批折子了么？' : '（迎上前来，挽住手臂）郎君……今天怎么有空来看我？';
      if (_spLoy > 50) return _spRk === 'empress' ? '（放下手中针线，神色平淡）陛下来了。请坐吧。' : '（福了一福）妾身见过陛下。';
      if (_spLoy > 30) return '（没有起身，只抬了抬眼）……来了。';
      return '（冷冷地侧过脸去）哦，陛下还记得这里有个人？';
    }
    return _spRk === 'empress' ? '（凤冠霞帔，盈盈行礼）妾身参见陛下。' : '妾' + _ch.name + '参见陛下，陛下万安。';
  }
  // 佞臣+昏君
  if (_isTyrant && _isSycophant) {
    return _isPrv ? '（满面春风，呈上礼盒）主上！臣得了一样好东西，特来献给主上！' : '（跪拜）陛下圣安！微臣' + _ch.name + '恭请圣安。';
  }
  // 忠臣+昏君
  if (_isTyrant && (_ch.loyalty || 50) > 80 && !_isAmbitious) {
    return _isPrv ? '（面色凝重，沉默良久）……主上。臣有话说，但……（叹气）不知从何说起。' : '（长跪不起）陛下……臣' + _ch.name + '冒死觐见。';
  }
  if (_ch.loyalty > 85) {
    return _isPrv
      ? (_isBrave ? '（大步而入，笑容满面）主上！又找末将喝酒？' : _isScholar ? '（抱着一卷书）主上，我方才读到一段妙论，正想与您分享。' : '（笑着行礼）主上，这个时辰召臣来……可是又睡不着了？')
      : (_isBrave ? '末将' + _ch.name + '参见陛下！但有差遣，赴汤蹈火！' : _isScholar ? '臣' + _ch.name + '叩见陛下。臣近日研读典籍，颇有心得。' : '陛下万安！微臣' + _ch.name + '叩首，恭候圣训。');
  }
  if (_ch.loyalty > 60) {
    return _isPrv
      ? (_isAmbitious ? '（拱手入座）主上有事吩咐？我正好也有话想说。' : _isCautious ? '主上……私下相召，可是有什么不便明说之事？' : '（入座）主上找我，是公事还是闲话？')
      : (_isAmbitious ? '参见陛下。臣有要事奏报。' : _isCautious ? '臣' + _ch.name + '觐见。不知陛下召臣何事？' : '参见陛下。臣' + _ch.name + '听候吩咐。');
  }
  if (_ch.loyalty > 40) {
    return _isPrv
      ? (_isStressed ? '（疲惫地坐下）……主上，我今日实在乏了。' : _recentArc === 'dismissal' ? '……主上又找我。有什么话，直说吧。' : '（沉默片刻）主上。')
      : (_isStressed ? '（面色憔悴）臣' + _ch.name + '……奉召觐见。' : '臣' + _ch.name + '，奉召觐见。');
  }
  if (_ch.loyalty > 20) {
    return _isPrv
      ? (_isAmbitious ? '（倚门而立，似笑非笑）这么晚了，找我做什么？' : '……找我有事？')
      : (_isAmbitious ? '（目光闪烁）陛下有何吩咐？' : '……臣在。不知陛下何事相召。');
  }
  return _isPrv
    ? (_isBrave ? '（冷笑一声）没想到你还敢单独叫我来。' : '……哦，你居然还愿意跟我说话。')
    : (_isBrave ? '（按剑而立）陛下，臣已至。' : '哼。陛下既然召见，臣便来了。');
}

/**
 * 发送问对消息（新版：弹窗模式 + 流式）
 */
async function sendWendui(){
  if (_wenduiSending) return;
  if(!GM.wenduiTarget){toast('请先选择人物');return;}
  var _tone = _$('wd-tone') ? _$('wd-tone').value : 'direct';
  // 沉默以对——不需要输入文字
  if (_tone === 'silence') {
    var _silChat = _$('wd-modal-chat');
    if (_silChat) {
      var _silDiv = document.createElement('div');
      _silDiv.style.cssText = 'display:flex;justify-content:flex-end;margin-bottom:0.5rem;';
      _silDiv.innerHTML = '<div style="font-size:0.8rem;color:var(--ink-300);font-style:italic;padding:0.3rem 0.6rem;">（沉默不语，目光审视。）</div>';
      _silChat.appendChild(_silDiv); _silChat.scrollTop = _silChat.scrollHeight;
    }
    var _silName = GM.wenduiTarget;
    // 沉默条目由下方统一入史(msg='（沉默以对）'走通用 push)——此处预写曾双写·AI 上下文与重开渲染出重复条目(2026-07-04 审查定罪)
    // NPC对沉默的反应——按性格不同
    var _silCh = findCharByName(_silName);
    if (_silCh && P.ai && P.ai.key) {
      _wenduiSending = true;
      var _silPrompt = _wdBuildPrompt(_silCh, _silName);
      _silPrompt += '\n【特殊】皇帝沉默以对，不发一言，只是凝视着你。你必须对这种沉默做出反应——紧张者坐立不安，胆大者主动开口，心虚者可能自我暴露。';
      // 继续走正常AI流程……
    }
    // 走后续的正常发送流程，msg设为沉默标记
    var input = _$('wd-modal-input');
    var msg = '（沉默以对）';
    if (input) input.value = '';
    // 不return，继续走下面的流程
  } else {
    var input=_$('wd-modal-input');
    var msg=input?input.value.trim():'';
    if(!msg)return;
  }
  // 自动移除未点击的仪式div
  var _cDiv2 = _$('wd-ceremony');
  if (_cDiv2) _cDiv2.remove();
  // 疲惫检查
  var _state = GM._wdState && GM._wdState[GM.wenduiTarget];
  if (_state) {
    _state.turns++;
    if (_state.turns > 10 && !_state.fatigued) {
      _state.fatigued = true;
      var _fChat = _$('wd-modal-chat');
      if (_fChat) { var _fd = document.createElement('div'); _fd.style.cssText = 'text-align:center;font-size:0.71rem;color:var(--amber-400);padding:4px;'; _fd.textContent = '（对话已久，' + GM.wenduiTarget + '面露疲态。皇帝亦觉乏倦。精力额外消耗5。）'; _fChat.appendChild(_fd); }
      if (typeof _spendEnergy === 'function') _spendEnergy(5, '问对久谈');
    } else if (_state.turns === 6) {
      var _fChat2 = _$('wd-modal-chat');
      if (_fChat2) { var _fd2 = document.createElement('div'); _fd2.style.cssText = 'text-align:center;font-size:0.71rem;color:var(--ink-300);padding:2px;'; _fd2.textContent = '（对话已有数轮，' + GM.wenduiTarget + '口渐干燥。）'; _fChat2.appendChild(_fd2); }
    }
  }
  if(input)input.value='';_wdUpdateCounter();
  var name=GM.wenduiTarget;
  if(!GM.wenduiHistory[name])GM.wenduiHistory[name]=[];
  GM.wenduiHistory[name].push({role:'player',content:msg});

  var chat=_$('wd-modal-chat');if(!chat)return;
  _wdAppendPlayerBubble(chat, msg);
  chat.scrollTop=chat.scrollHeight;

  var ch=findCharByName(name);
  if(P.ai.key&&ch){
    _wenduiSending = true;
    var sendBtn = _$('wd-send-btn');
    if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = '…'; }

    // 创建流式NPC气泡
    var streamDiv = document.createElement('div');
    streamDiv.className = 'wendui-msg wendui-npc';
    streamDiv.id = 'wd-stream-active';
    streamDiv.innerHTML = '<div style="flex:1;min-width:0;"><div class="wendui-npc-name">' + escHtml(name) + '</div>'
      + '<div class="wendui-npc-bubble" id="wd-stream-text" style="color:var(--color-foreground-muted);">……</div></div>';
    chat.appendChild(streamDiv);
    chat.scrollTop = chat.scrollHeight;

    try{
      var sysP = _wdBuildPrompt(ch, name);
      if (!ch._envoy && typeof _sovereignLanguagePromptLine === 'function') sysP = _sovereignLanguagePromptLine(typeof GM !== 'undefined' ? GM : null) + sysP;
      // L4·a·若 mode === 'cedui'·prompt 顶段注入 archetype voice + paradigm context
      if (_wenduiMode === 'cedui' && typeof _kjpBuildCeduiPromptContext === 'function') {
        try {
          var _arch = (typeof _kjpInferAdvisorArchetype === 'function')
            ? _kjpInferAdvisorArchetype(ch)
            : 'A3_pragmatic';
          var _ceduiCtx = _kjpBuildCeduiPromptContext(ch, _arch);
          if (_ceduiCtx) sysP = _ceduiCtx + '\n\n' + sysP;
        } catch(_){}
      }
      if (typeof _aiDialogueWordHint === 'function') sysP += '\n' + _aiDialogueWordHint("wd");
      // 根治(2026-06-26)：真机证实此模型常把问对回复写成沉浸式散文·不守 {reply,loyaltyDelta} JSON →
      // 改用末尾简单标记承载忠诚/压力(对这种模型远比 JSON 可靠)·顺带加「压力」维度(owner需求)。
      sysP += '\n\n⚠【末尾硬性标记·务必输出】无论你以散文还是何种文体回话，回复的最末都必须另起一行，用此固定格式标出本次召对对你的真实影响：〔忠诚±N 压力±N〕（N为0-3整数）。判定：受重用/获理解/得偿所请→忠诚正；被冷落/受辱/失望/遭斥→忠诚负；被逼问/受责/惊惧→压力正；被安抚/宽慰/获赏→压力负；无波动填0。例：〔忠诚+2 压力-1〕。此行不可省略。';
      var history=GM.wenduiHistory[name].slice(-10);
      var messages=[{role:'system',content:sysP}];
      history.forEach(function(h){
        // system(面谕/赏罚)=帝侧动作·曾被映成 assistant 令 AI 把御赐当自己说过的话(2026-07-04 审查定罪)。
        // 映 user+纪事前缀·相邻 user 合并(防严格交替 API 400)。
        var _isSys = h.role === 'system';
        var _r = (h.role === 'player' || _isSys) ? 'user' : 'assistant';
        var _c = _isSys ? ('【朝廷纪事·非对话】' + h.content) : h.content;
        var _last = messages[messages.length - 1];
        if (_last && _last.role === 'user' && _r === 'user') _last.content += '\n' + _c;
        else messages.push({ role: _r, content: _c });
      });

      var streamBubble = _$('wd-stream-text');
      // 性能·2026-06-10·流式合帧:原每 chunk 都「全文重提取+textContent 重排+scrollTop 强制布局」·快流 20-60 chunk/s 把聊天列每秒重排几十次。
      // 改 rAF 合并:每帧至多一次 DOM 写·且仅当玩家贴近底部才跟滚(不打断回看·少一次强制布局)
      var _wdStreamPending = null, _wdStreamRaf = 0;
      var _wdStreamFlush = function() {
        _wdStreamRaf = 0;
        if (_wdStreamPending == null) return;
        var txt = _wdStreamPending;
        if (streamBubble && streamBubble.isConnected !== false) {
          var visible = _wdVisibleReplyPreview(txt);
          streamBubble.textContent = visible || '\u2026';
          streamBubble.style.color = '';
        }
        var _nearBottom = (chat.scrollHeight - chat.scrollTop - chat.clientHeight) < 80;
        if (_nearBottom) chat.scrollTop = chat.scrollHeight;
      };
      var rawReply = await callAIMessagesStream(messages, (typeof _aiDialogueTok==='function'?_aiDialogueTok("wd", 1):800), {
        tier: (typeof _useSecondaryTier === 'function' && _useSecondaryTier()) ? 'secondary' : undefined,  // M3·问对走次 API
        onChunk: function(txt) {
          _wdStreamPending = txt;
          if (_wdStreamRaf) return;
          _wdStreamRaf = (typeof requestAnimationFrame === 'function') ? requestAnimationFrame(_wdStreamFlush) : (setTimeout(_wdStreamFlush, 16), 1);
        }
      });
      // 流尾:确保最后一段已上屏(可能还压在未触发的 rAF 里)
      if (_wdStreamRaf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(_wdStreamRaf);
      _wdStreamRaf = 0;
      _wdStreamFlush();

      if(rawReply){
        var replyText = rawReply, loyaltyDelta = 0;
        var parsed = (typeof extractJSON==='function') ? extractJSON(rawReply) : null;
        // 深诊断(2026-06-26)：定位"问对AI返回史记格式{shizhengji,zhengwen,player_status}"——
        // 确认发出的 sysP 是问对(含loyaltyDelta)还是被串成史记(含shizhengji/时政记)·并看 AI 原始回复
        try { var _spS = String(typeof sysP !== 'undefined' ? sysP : ''); console.log('[问对诊断·深] sysP问对schema=' + (_spS.indexOf('loyaltyDelta') >= 0) + '·sysP混入史记=' + (_spS.indexOf('shizhengji') >= 0 || _spS.indexOf('时政记') >= 0) + '·history条=' + ((GM.wenduiHistory && GM.wenduiHistory[name] || []).length) + '·rawReply前300=' + String(rawReply || '').slice(0, 300)); } catch (_dgX) {}
        if (parsed && parsed.reply) {
          replyText = parsed.reply;
        } else {
          replyText = _wdSanitizeDialogueReplyText(name, ch, parsed, rawReply);
        }
        // #9·基础对话忠诚缩放：深谈（多轮）更有分量·仍封顶（formal≤4·private≤5）
        var _ldBase = (_wenduiMode === 'private') ? 3 : 2;
        var _ldTurns = (GM._wdState && GM._wdState[name] && GM._wdState[name].turns) || 0;
        var _ldMax = Math.min((_wenduiMode === 'private') ? 5 : 4, _ldBase + (_ldTurns >= 9 ? 2 : (_ldTurns >= 5 ? 1 : 0)));
        var _stressDelta = 0;
        // 根治(2026-06-26)：真机 [问对诊断·深] 证实——此模型常把问对回复写成沉浸式散文·不返 {reply,loyaltyDelta} JSON
        //（甚至混入史记式 JSON）。优先抽末尾标记〔忠诚±N 压力±N〕(对这种模型远比 JSON 可靠)·抽到即用并从展示正文抹去。
        var _tagM = String(rawReply || '').match(/忠诚\s*([+\-]?\d+)[\s\S]{0,8}?压力\s*([+\-]?\d+)/);
        if (_tagM) {
          loyaltyDelta = clamp(parseInt(_tagM[1]) || 0, -_ldMax, _ldMax);
          _stressDelta = clamp(parseInt(_tagM[2]) || 0, -5, 5);
          replyText = String(replyText).replace(/〔?[^〔〕\n]*忠诚\s*[+\-]?\d+[\s\S]{0,8}?压力\s*[+\-]?\d+[^〔〕\n]*〕?/g, '').trim();
        } else if (parsed && parsed.loyaltyDelta != null && parsed.loyaltyDelta !== '') {
          loyaltyDelta = clamp(parseInt(parsed.loyaltyDelta) || 0, -_ldMax, _ldMax);
          if (parsed.stressDelta != null) _stressDelta = clamp(parseInt(parsed.stressDelta) || 0, -5, 5);
        } else if (parsed) {
          // 兜底：AI 既无标记也无 loyaltyDelta → 用它给的情绪折算小幅忠诚(仍属 AI 驱动)
          var _emo = String((parsed.memoryImpact && parsed.memoryImpact.emotion) || parsed.emotionState || parsed.toneEffect || '');
          var _emoMap = { '敬':1, '喜':1, '悦':1, '感':1, '慰':1, '怒':-1, '恨':-2, '怨':-1, '惧':-1, '厌':-1, '失望':-1, '不满':-1 };
          var _fb = 0;
          for (var _ek in _emoMap) { if (_emo.indexOf(_ek) >= 0) { _fb = _emoMap[_ek]; break; } }
          if (_fb !== 0) loyaltyDelta = clamp(_fb, -_ldMax, _ldMax);
          try { console.log('[问对诊断] 无标记+AI未返回loyaltyDelta·情绪兜底=' + loyaltyDelta + '(emo=' + (_emo||'无') + ')'); } catch(_e){}
        } else {
          try { console.log('[问对诊断] 无标记+非JSON回复·raw前120=' + String(rawReply).slice(0,120)); } catch(_e){}
        }
        if (loyaltyDelta !== 0) {
          if (typeof adjustCharacterLoyalty === 'function') {
            var _wdReason = parsed && parsed.memoryImpact && parsed.memoryImpact.event ? parsed.memoryImpact.event : ((_wenduiMode === 'private' ? '\u79C1\u4E0B\u95EE\u5BF9' : '\u9762\u5723\u95EE\u5BF9') + '\uFF1A' + (msg || '').slice(0, 20));
            adjustCharacterLoyalty(ch, loyaltyDelta, _wdReason, { source:'wendui-dialogue', ai:true, defaultReason:'AI\u63A8\u6F14' });
          } else {
            var _wdOldL = (typeof ch.loyalty === 'number' && isFinite(ch.loyalty)) ? ch.loyalty : 50;
            ch.loyalty = clamp(_wdOldL + loyaltyDelta, 0, 100);
          }
          if (typeof OpinionSystem !== 'undefined')
            OpinionSystem.addEventOpinion(name, '玩家', loyaltyDelta * 3, '问对' + (loyaltyDelta > 0 ? '受重用' : '被冷落'));
          // 刷新顶栏忠诚显示
          var loyEl = _$('wd-char-loyalty');
          if (loyEl) { loyEl.textContent = '忠' + (typeof _fmtNum1==='function'?_fmtNum1(ch.loyalty):ch.loyalty); loyEl.style.color = ch.loyalty > 70 ? 'var(--green)' : ch.loyalty < 30 ? 'var(--red)' : 'var(--txt-s)'; }
        }
        // 压力(2026-06-26·owner需求)：问对也影响对象压力·标记驱动·受逼问/惊惧→升·被宽慰/赏赐→降
        if (_stressDelta !== 0 && ch) {
          var _oldStress = (typeof ch.stress === 'number' && isFinite(ch.stress)) ? ch.stress : 0;
          ch.stress = clamp(_oldStress + _stressDelta, 0, 100);
        }
        // 提取语气效果反馈
        var _toneEffect = (parsed && parsed.toneEffect) ? String(parsed.toneEffect).trim() : '';
        // #2·说谎与识破：NPC 谎报时按语气+智力+信用/情报佐证判定玩家能否识破（不靠玄学·靠现成信号）
        if (parsed && parsed.deception && parsed.deception.lying) {
          var _dcInt = (typeof ch.intelligence === 'number') ? ch.intelligence : 50;
          var _dcChance = (_tone === 'pressing' || _tone === 'silence') ? 0.65 : (_tone === 'probing') ? 0.5 : (_tone === 'flattering') ? 0.2 : 0.35;
          _dcChance -= (_dcInt > 75 ? 0.2 : (_dcInt < 45 ? -0.1 : 0)); // 高智善掩饰·愚钝易露馅
          var _dcCorrob = '';
          if ((ch._promiseBroken || 0) >= 2) { _dcChance += 0.2; _dcCorrob += '（此人素来失信）'; }
          var _dcIntel = Array.isArray(GM._interceptedIntel) ? GM._interceptedIntel.filter(function(it){ return it && it.to === name && (GM.turn - (it.turn || 0)) <= 3; }) : [];
          if (_dcIntel.length) { _dcChance += 0.3; _dcCorrob += '（厂卫风闻与所言不符）'; }
          var _dcCaught = Math.random() < Math.max(0.05, Math.min(0.95, _dcChance));
          if (!GM._wdSuspicions) GM._wdSuspicions = [];
          GM._wdSuspicions.push({ turn: GM.turn, who: name, hiding: String(parsed.deception.hiding || '').slice(0, 80), caught: _dcCaught });
          if (GM._wdSuspicions.length > 40) GM._wdSuspicions.shift();
          if (_dcCaught) {
            var _dcChat = _$('wd-modal-chat');
            if (_dcChat) {
              var _dcD = document.createElement('div');
              _dcD.style.cssText = 'text-align:center;font-size:0.71rem;color:var(--amber-400);font-style:italic;padding:2px;';
              _dcD.textContent = '⚠ 似有隐情：' + String(parsed.deception.tell || '神色微动，言语闪烁').slice(0, 60) + _dcCorrob;
              _dcChat.appendChild(_dcD); _dcChat.scrollTop = _dcChat.scrollHeight;
            }
          }
        }
        // 情绪指示更新
        if (parsed && parsed.emotionState) {
          var _eMap = {'镇定':1,'从容':1,'平静':2,'恭敬':2,'紧张':3,'不安':3,'焦虑':4,'恐惧':4,'崩溃':5,'激动':4,'愤怒':4};
          var _eVal = _eMap[parsed.emotionState] || 3;
          var _st = GM._wdState && GM._wdState[name];
          if (_st) { _st.emotion = _eVal; _wdUpdateEmotionBar(name); }
        }
        // 提取AI标记的施政建议——新 {topic,content} 与旧 string 兼容
        var _wdSuggestions = (parsed && parsed.suggestions && Array.isArray(parsed.suggestions)) ? parsed.suggestions.filter(function(s){ if (!s) return false; if (typeof s === 'string') return s.trim(); return s.content; }) : [];
        if (_wdSuggestions.length > 0) {
          _wdSuggestions.forEach(function(sg) {
            _wdStoreEdictSuggestion(name, sg, { mode: _wenduiMode || 'formal', playerPrompt: msg || '' });
          });
          if (typeof _renderEdictSuggestions === 'function') _renderEdictSuggestions();
        }
        // L4·a·若 mode === 'cedui'·entry 加 mode + ceduiParadigmDigest 字段·便 L4·g1 自引用读
        // RX·B5·加 turn 字段·_kjpAppendOwnCeduiHint 按 turn 算近 5 turn boost
        var _wdEntry = { role:'npc', content:replyText, loyaltyDelta:loyaltyDelta, turn: (typeof GM !== 'undefined' && GM.turn) || 0 };
        // 2026-06-26 根治：把进言要点(suggestions)与语气效果存进历史条目，使其在历史重渲染时不丢失(配合 _wdReplyExtrasHtml)
        if (_wdSuggestions && _wdSuggestions.length) _wdEntry.suggestions = _wdSuggestions;
        if (_toneEffect) _wdEntry.toneEffect = _toneEffect;
        if (_wenduiMode && _wenduiMode !== 'formal') _wdEntry.mode = _wenduiMode;
        if (_wenduiMode === 'cedui' && typeof window !== 'undefined' && window._kjpCurrentCeduiDigest) {
          _wdEntry.ceduiParadigmDigest = window._kjpCurrentCeduiDigest;
        }
        GM.wenduiHistory[name].push(_wdEntry);
        // 性能·2026-06-10·写入端封顶:单人 400 条(AI 上下文只用 slice(-10)·UI 只渲最近 60·起居注/纪事另有完整留痕)·防长局单人史无界膨胀存档
        if (GM.wenduiHistory[name].length > 400) GM.wenduiHistory[name] = GM.wenduiHistory[name].slice(-400);
        // #4·君臣私交长弧：每次问对累积亲信度（私下更快·负面交流不涨·封顶100）
        if (ch) { var _rapGain = (loyaltyDelta < 0) ? 0 : ((_wenduiMode === 'private') ? 2 : 1); ch._rapport = Math.max(0, Math.min(100, ((typeof ch._rapport === 'number') ? ch._rapport : 50) + _rapGain)); }
        // NPC记忆——D3 优先使用 AI 返回的 memoryImpact，否则回退默认
        if (typeof NpcMemorySystem !== 'undefined') {
          var _playerName = (P.playerInfo && P.playerInfo.characterName) || '陛下';
          if (parsed && parsed.memoryImpact && typeof parsed.memoryImpact === 'object') {
            var mi = parsed.memoryImpact;
            var miEvent = mi.event || ('问对：' + (msg||'').slice(0, 25) + ' → ' + (replyText||'').slice(0, 25));
            var miEmo = mi.emotion || (loyaltyDelta > 0 ? '敬' : loyaltyDelta < 0 ? '忧' : '平');
            // ★2026-07-01 S1治「过回合失忆」:与天子面圣对话本身即要事·记忆 importance 下限提到 6·越过回合推演
            //   <npc-hearts> 的 imp>=6 门槛(tm-endturn-prompt.js:922)——否则正式问对(原imp5)推演永远看不到=聊完过回合就"忘"。
            var miImp = Math.max(6, Math.min(10, parseFloat(mi.importance) || 6));
            NpcMemorySystem.remember(name, miEvent, miEmo, miImp, _playerName);
          } else {
            var _wdEmo = loyaltyDelta > 0 ? '敬' : loyaltyDelta < 0 ? '忧' : '平';
            var _wdScene = _wenduiMode === 'private' ? '私下促膝长谈——' : '面圣问对——';
            NpcMemorySystem.remember(name, _wdScene + msg.slice(0, 20), _wdEmo, _wenduiMode === 'private' ? 7 : 6, _playerName);  // ★正式 5→6 过推演门槛
            NpcMemorySystem.remember(name, '\u4E0E\u541B\u4E3B\u79C1\u4E0B\u95EE\u5BF9\uFF1A' + (replyText||'').slice(0,30), '\u5E73', 6, _playerName);  // \u2605S1:5\u21926 \u8FC7\u63A8\u6F14\u95E8\u69DB
          }
        }
        // 更新气泡为最终版
        var sd = _$('wd-stream-active');
        if (sd) {
          sd.id = '';
          var _lF2 = typeof _fmtNum1==='function' ? _fmtNum1 : function(x){return x;};
          var deltaTag = loyaltyDelta > 0 ? ' <span style="color:var(--green);font-size:0.7rem;">忠+' + _lF2(loyaltyDelta) + '</span>'
            : (loyaltyDelta < 0 ? ' <span style="color:var(--red);font-size:0.7rem;">忠' + _lF2(loyaltyDelta) + '</span>' : '');
          // 语气效果提示
          var _toneHtml = '';
          if (_toneEffect) {
            _toneHtml = '<div style="margin-top:3px;font-size:0.71rem;color:var(--ink-300);font-style:italic;">\u3010' + escHtml(_toneEffect) + '\u3011</div>';
          }
          var _sugHtml = '';
          if (_wdSuggestions.length > 0) {
            _sugHtml = '<div style="margin-top:4px;padding:4px 6px;background:var(--gold-500,rgba(184,154,83,0.1));border-radius:4px;font-size:0.72rem;">';
            _sugHtml += '<div style="color:var(--gold-400);font-weight:700;margin-bottom:2px;">\u8FDB\u8A00\u8981\u70B9\uFF1A</div>';
            _wdSuggestions.forEach(function(sg, si) {
              // 兼容：sg 可能是字符串 或 {topic, content} 对象
              var _sgText = (typeof sg === 'string') ? sg
                          : (sg && sg.content) ? ((sg.topic ? '〔' + sg.topic + '〕 ' : '') + sg.content)
                          : (sg && sg.text) ? sg.text
                          : '';
              if (!_sgText) return;
              _sugHtml += '<div style="display:flex;justify-content:space-between;align-items:center;padding:2px 0;gap:6px;">';
              _sugHtml += '<span style="color:var(--color-foreground);flex:1;">\u2022 ' + escHtml(_sgText) + '</span>';
              _sugHtml += '<span style="color:var(--celadon-400);font-size:0.7rem;opacity:0.7;white-space:nowrap;">\u2713\u5DF2\u5165\u5E93</span>';
              _sugHtml += '</div>';
            });
            _sugHtml += '</div>';
          }
          sd.innerHTML = '<div style="flex:1;min-width:0;"><div class="wendui-npc-name">' + escHtml(name) + deltaTag + '</div>'
            + '<div class="wendui-npc-bubble wd-selectable">' + escHtml(replyText) + '</div>' + _toneHtml + _sugHtml + '</div>';
        }
        chat.scrollTop = chat.scrollHeight;
        GM.jishiRecords.push({turn:GM.turn,char:name,playerSaid:msg,npcSaid:replyText,loyaltyDelta:loyaltyDelta,mode:_wenduiMode});
        if (typeof renderJishi === 'function') renderJishi();

        // L4·f1·对质者发声——渲染在场对质者各自的当庭回应
        if (parsed && Array.isArray(parsed.confronterReplies) && Array.isArray(_wdConfronters) && _wdConfronters.length) {
          parsed.confronterReplies.forEach(function(cr) {
            if (!cr || !cr.name || !cr.reply) return;
            if (_wdConfronters.indexOf(cr.name) < 0) return; // 只认在场者
            var _crText = String(cr.reply).slice(0, 1200);
            var _crDiv = document.createElement('div');
            _crDiv.className = 'wendui-msg wendui-npc';
            _crDiv.innerHTML = '<div style="flex:1;min-width:0;"><div class="wendui-npc-name" style="color:var(--amber-400);">'
              + escHtml(cr.name) + ' <span style="font-size:0.68rem;opacity:0.7;">·对质</span></div>'
              + '<div class="wendui-npc-bubble wd-selectable">' + escHtml(_crText) + '</div></div>';
            chat.appendChild(_crDiv);
            if (!GM.wenduiHistory[cr.name]) GM.wenduiHistory[cr.name] = [];
            GM.wenduiHistory[cr.name].push({ role:'npc', content:_crText, turn:GM.turn, mode:_wenduiMode, _confrontWith:name });
            if (Array.isArray(GM.jishiRecords)) GM.jishiRecords.push({ turn:GM.turn, char:cr.name, playerSaid:'〔' + name + '对质·在场〕' + msg, npcSaid:_crText, loyaltyDelta:0, mode:_wenduiMode });
          });
          chat.scrollTop = chat.scrollHeight;
          if (typeof renderJishi === 'function') renderJishi();
        }

        // ═══ 旁听泄露机制（动态联动版）═══
        // 正式问对→根据官制/党派/阴谋/NPC目标动态判定谁获知
        if (_wenduiMode !== 'private' && !_wdScreened && typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
          var _topicBrief = msg.slice(0, 40);
          var _leakedTo = [];
          var _targetParty = ch ? (ch.party || '') : '';

          (GM.chars || []).filter(function(c) {
            return c.alive !== false && c.name !== name && !c.isPlayer && _wdIsAtCapital(c);
          }).forEach(function(c) {
            var _prob = 0;
            // 1. 官制：起居注官/侍从官必知或高概率
            var _off = (c.officialTitle || '').toLowerCase();
            if (_off.indexOf('\u8D77\u5C45') >= 0 || _off.indexOf('\u8BB0\u6CE8') >= 0) _prob = 1.0;
            else if (_off.indexOf('\u4F8D') >= 0 || _off.indexOf('\u8FD1\u4F8D') >= 0 || _off.indexOf('\u5185\u4F8D') >= 0) _prob = Math.max(_prob, 0.7);
            // 2. 党派：与问对对象不同党→更关注
            if (c.party && _targetParty && c.party !== _targetParty) _prob = Math.max(_prob, 0.4);
            // 3. 野心/低忠诚→更爱打听
            if ((c.ambition || 50) > 65) _prob = Math.max(_prob, 0.35);
            if ((c.loyalty || 50) < 35) _prob = Math.max(_prob, 0.4);
            // 4. 高智力→更善于获取情报
            if ((c.intelligence || 50) > 75) _prob = Math.min(1, _prob + 0.1);
            // 5. 普通人基础概率
            if (_prob < 0.08) _prob = 0.08;

            if (Math.random() < _prob) {
              var _emo = (c.ambition || 50) > 60 ? '\u8B66' : '\u5E73';
              NpcMemorySystem.remember(c.name, '\u95FB\u7687\u5E1D\u53EC\u89C1' + name + '\uFF0C\u8BAE\u53CA\u201C' + _topicBrief + '\u201D\u4E4B\u4E8B', _emo, 4);
              _leakedTo.push(c.name);

              // 阴谋联动：如果此人有进行中的阴谋且话题相关，加速推进
              if (GM.activeSchemes) {
                GM.activeSchemes.forEach(function(sc) {
                  if (sc.schemer === c.name && !sc.completed) {
                    sc.progress = Math.min(100, (sc.progress || 0) + 5);
                  }
                });
              }
            }
          });

          // 外国势力间谍（在京使节/暗探获知→写入截获情报池，与截获系统共享）
          _wdFactionValues(GM.facs).forEach(function(f) {
            if (f.isPlayer || !f.name) return;
            // 有在京成员且关系敌对的势力
            var _hasAgent = (GM.chars || []).some(function(c) {
              return c.alive !== false && c.faction === f.name && _wdIsAtCapital(c);
            });
            if (_hasAgent && (f.playerRelation || 0) < -30) {
              if (Math.random() < 0.3) {
                if (!GM._interceptedIntel) GM._interceptedIntel = [];
                GM._interceptedIntel.push({
                  turn: GM.turn, interceptor: f.name,
                  from: '\u65C1\u542C', to: name,
                  content: '\u7687\u5E1D\u4E0E' + name + '\u8BAE\u201C' + _topicBrief + '\u201D',
                  urgency: 'eavesdrop'
                });
              }
            }
          });

          // #8·NPC↔NPC 消息传播：知情者向同党/近臣传二手风闻（一跳·低可信·全局封顶防爆炸）
          if (_leakedTo.length) {
            var _gossipBudget = 4;
            var _known = {}; _leakedTo.forEach(function(n){ _known[n] = true; }); _known[name] = true;
            for (var _gi = 0; _gi < _leakedTo.length && _gossipBudget > 0; _gi++) {
              var _src = findCharByName(_leakedTo[_gi]);
              if (!_src) continue;
              var _srcParty = _src.party || _src.faction || '';
              (GM.chars || []).forEach(function(c) {
                if (_gossipBudget <= 0 || !c || c.isPlayer || c.alive === false || _known[c.name]) return;
                if (typeof _wdIsAtCapital === 'function' && !_wdIsAtCapital(c)) return;
                var _assoc = !!(_srcParty && (c.party === _srcParty || c.faction === _srcParty));
                if (!_assoc && _src.relations && _src.relations[c.name] && (_src.relations[c.name].affinity || 0) >= 70) _assoc = true;
                if (!_assoc) return;
                if (Math.random() < 0.5) {
                  NpcMemorySystem.remember(c.name, '风闻' + _leakedTo[_gi] + '言及：皇帝召' + name + '议“' + _topicBrief + '”', '平', 3);
                  _known[c.name] = true; _gossipBudget--;
                }
              });
            }
          }
          // 记录泄露（供AI推演参考）
          if (!GM._eavesdroppedTopics) GM._eavesdroppedTopics = [];
          GM._eavesdroppedTopics.push({
            turn: GM.turn, target: name, topic: _topicBrief,
            leakedTo: _leakedTo, mode: 'formal'
          });
          if (GM._eavesdroppedTopics.length > 20) GM._eavesdroppedTopics.shift();
          // E1·泄露回显：让玩家感到正式问对的信息代价
          if (_leakedTo.length) {
            var _lkChat = (typeof _$ === 'function') ? _$('wd-modal-chat') : null;
            if (_lkChat) {
              var _lkNames = _leakedTo.slice(0, 4).join('、') + (_leakedTo.length > 4 ? ' 等' : '');
              var _lkD = document.createElement('div');
              _lkD.style.cssText = 'text-align:center;font-size:0.7rem;color:var(--amber-400);font-style:italic;padding:2px;';
              _lkD.textContent = '〔此事恐已入 ' + _lkNames + ' 耳〕';
              _lkChat.appendChild(_lkD); _lkChat.scrollTop = _lkChat.scrollHeight;
            }
          }
        } else if (_wdScreened && _wenduiMode !== 'private') {
          // E2·屏退密谈：内容不外泄，但"密谈"本身外廷可知（供 AI 推演生疑）
          if (!GM._eavesdroppedTopics) GM._eavesdroppedTopics = [];
          GM._eavesdroppedTopics.push({ turn: GM.turn, target: name, topic: '（屏退密谈·内容不详）', leakedTo: [], mode: 'screened' });
          if (GM._eavesdroppedTopics.length > 20) GM._eavesdroppedTopics.shift();
        }
      } else {
        var sd2 = _$('wd-stream-active'); if (sd2) sd2.remove();
      }
    }catch(err){
      console.error('[问对] 流式失败:', err);
      var sd3 = _$('wd-stream-active'); if (sd3) sd3.remove();
      toast('对话失败');
    }
    _wenduiSending = false;
    if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = '奉旨'; }
  }else{
    var fb=ch&&ch.dialogues&&ch.dialogues[0]?ch.dialogues[0]:'臣谨遵。';
    GM.wenduiHistory[name].push({role:'npc',content:fb});
    _wdAppendNpcBubble(chat, name, ch, fb);
    chat.scrollTop=chat.scrollHeight;
  }
}
// ═══════════════════════════════════════════════════════════════════════
//  【立项拆分 2026-07-04】人设prompt层+纪事视图(原§2528-末) → tm-wendui-persona-views.js
//  （载于本文件之后）·保序切割·全局名跨文件解析
// ═══════════════════════════════════════════════════════════════════════
