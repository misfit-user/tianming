// @ts-check
/// <reference path="types.d.ts" />
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

/**
 * 渲染问对面板中的角色网格（仅在京臣子可点击）
 */
function renderWenduiChars(){
  var el=_$("wendui-chars");if(!el)return;
  var atCap = (GM.chars||[]).filter(function(c){return c.alive!==false && !c.isPlayer && _wdIsAtCapital(c);});
  var away = (GM.chars||[]).filter(function(c){return c.alive!==false && !c.isPlayer && !_wdIsAtCapital(c);});
  var html = '';

  // 工具：根据角色推断卡片左边色类
  function _wdCardClass(ch) {
    var t = (ch.title || '') + ' ' + (ch.officialTitle || '');
    if (ch.spouse) return 'wdp-consort';
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
    if (ch.spouse) return '<span class="wdp-tag" style="color:var(--vermillion-300);">\u5BAB\u773B</span>';
    if (ch.party) return '<span class="wdp-tag" style="color:var(--celadon-400);">' + escHtml(String(ch.party).slice(0,4)) + '</span>';
    if (ch.faction && ch.faction !== '\u671D\u5EF7') return '<span class="wdp-tag" style="color:var(--indigo-400);">' + escHtml(String(ch.faction).slice(0,4)) + '</span>';
    if (/\u5C06\u519B|\u603B\u5175|\u603B\u7763/.test(ch.title||'')) return '<span class="wdp-tag" style="color:var(--vermillion-400);">\u6B66\u5C06</span>';
    if (/\u53F8\u793C|\u592A\u76D1/.test(ch.title||'')) return '<span class="wdp-tag" style="color:var(--purple-400,#8e6aa8);">\u5BA6\u5B98</span>';
    return '';
  }

  // 【阶下待见】使节/外藩/AI推送
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
    if ((c.loyalty || 50) > 90 && (c.stress || 0) > 30) return true;
    if ((c.ambition || 50) > 80 && (c.loyalty || 50) > 60) return true;
    if ((c.stress || 0) > 60) return true;
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
      if (GM.letters && GM.letters.some(function(l) { return l._npcInitiated && l.from === ch.name && l._replyExpected && !l._playerReplied && l.status === 'returned'; })) {
        reason = '\u524D\u65E5\u6765\u51FD\u672A\u83B7\u56DE\u590D\uFF0C\u4EB2\u81F3\u6C42\u89C1';
      }
      var _safeName = ch.name.replace(/'/g, "\\'");
      var _initial = escHtml(String(ch.name||'?').charAt(0));
      var _portraitHtml = ch.portrait ? '<img src="'+escHtml(ch.portrait)+'">' : _initial;
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
      var _portraitHtml = ch.portrait ? '<img src="'+escHtml(ch.portrait)+'">' : _initial;
      var _spouseMark = ch.spouse ? '<span class="spouse">\u2766</span>' : '';
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
  var _portraitHtml = ch.portrait ? '<img src="'+escHtml(ch.portrait)+'">' : _initial;
  var _subTitle = escHtml((ch.officialTitle || ch.title || '').slice(0,20)) + (ch.spouse ? ' \u00B7 \u540E\u59C3' : '');
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
    var _reasons = [];
    if (_gCh.alive === false || _gCh.dead) _reasons.push('已薨');
    if (_gCh._imprisoned || _gCh.imprisoned) _reasons.push('下狱');
    if (_gCh._exiled || _gCh.exiled) _reasons.push('流放');
    if (_gCh._retired) _reasons.push('致仕');
    if (_gCh._mourning) _reasons.push('丁忧');
    if (_gCh._fled) _reasons.push('逃亡');
    if (_gCh._missing) _reasons.push('失踪');
    if (typeof _gCh.health === 'number' && _gCh.health <= 10) _reasons.push('病重');
    // 位置判定·不在京师且无其他 reasons 则 reasons 加"在远方"
    if (_reasons.length === 0) {
      var _capC = GM._capital || '京师';
      var _loc = (_gCh.location || '').replace(/\s/g,'');
      var _isAtCap = !_loc || _loc === _capC || _loc.indexOf(_capC) >= 0 || /京|京城|京师|北京/.test(_loc);
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
  GM.wenduiTarget = name;
  if (!GM.wenduiHistory) GM.wenduiHistory = {};
  if (!GM.wenduiHistory[name]) GM.wenduiHistory[name] = [];

  var ch = findCharByName(name);
  // 后宫干政触发——与后妃在朝堂模式问对，登记事件供下回合大臣反应
  if (ch && ch.spouse && _wenduiMode === 'formal') {
    if (!GM._consortFormalAudiences) GM._consortFormalAudiences = [];
    GM._consortFormalAudiences.push({
      name: name, turn: GM.turn,
      spouseRank: ch.spouseRank || '',
      motherClan: ch.motherClan || '',
      processed: false
    });
    if (typeof addEB === 'function') addEB('\u540E\u5BAB', '\u671D\u5802\u95EE\u5BF9' + name + '\u00B7\u6B64\u4E3E\u5F15\u5916\u81E3\u4FA7\u76EE');
  }
  var modeLabel = _wenduiMode === 'private' ? '私下叙谈' : '朝堂问对';

  // 创建全屏弹窗
  var modal = document.createElement('div');
  modal.className = 'modal-bg show';
  modal.id = 'wendui-modal';
  modal.style.cssText = '-webkit-app-region:no-drag;';
  modal.innerHTML = '<div class="wd-modal-inner">'
    // 顶栏
    + '<div class="wd-modal-header">'
    + '<div class="wd-modal-header-left">'
    + '<button class="bt bsm" id="wd-edict-btn" onclick="_wdAddToEdict()" title="\u5148\u5212\u9009\u5927\u81E3\u53D1\u8A00\u4E2D\u7684\u6587\u5B57\uFF0C\u518D\u70B9\u6B64\u6309\u94AE\u6458\u5165\u5EFA\u8BAE\u5E93">\u6458\u5165\u5EFA\u8BAE\u5E93</button>'
    + '<button class="bt bsm" onclick="_wdSummonConfronter()" title="\u53EC\u5165\u7B2C\u4E8C\u4EBA\u5F53\u9762\u5BF9\u8D28">\u53EC\u4EBA\u5BF9\u8D28</button>'
    + '<button class="bt bsm" style="color:var(--celadon-400);" onclick="_wdReward()" title="\u5F53\u573A\u8D4F\u8D50">\u8D4F</button>'
    + '<button class="bt bsm" style="color:var(--vermillion-400);" onclick="_wdPunish()" title="\u5F53\u573A\u5904\u7F5A">\u7F5A</button>'
    + '</div>'
    + '<div class="wd-modal-header-center">'
    + '<div class="wd-modal-char-name">' + escHtml(name) + '</div>'
    + '<div class="wd-modal-char-sub">' + escHtml(ch ? (ch.title || '') : '') + ' · ' + modeLabel
    + ' · <span id="wd-char-loyalty" style="color:' + (ch && ch.loyalty > 70 ? 'var(--green)' : ch && ch.loyalty < 30 ? 'var(--red)' : 'var(--txt-s)') + ';">忠' + (ch ? (typeof _fmtNum1==='function'?_fmtNum1(ch.loyalty):ch.loyalty) : '?') + '</span></div>'
    + '</div>'
    + '<button class="bt bsm wd-modal-close" onclick="closeWenduiModal()">✕</button>'
    + '</div>'
    // 提示 + 情绪指示条
    + '<div class="wd-modal-hint"><span>\u5212\u51FA\u5927\u81E3\u8BF4\u7684\u8BDD\u52A0\u5165\u5EFA\u8BAE\u5E93</span>'
    + '<span id="wd-emotion-bar" style="margin-left:var(--space-3);font-size:0.65rem;"><span style="color:var(--celadon-400);">\u955C\u5B9A</span> <span id="wd-emotion-dots">\u25CF\u25CF\u25CF\u25CB\u25CB</span> <span style="color:var(--vermillion-400);">\u7D27\u5F20</span></span>'
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
    + '</div>';
  document.body.appendChild(modal);

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
    if (ch.spouse) _topics.push('\u5BB6\u5E38\u8BDD');
    // 按局势推荐
    if (GM.activeWars && GM.activeWars.length > 0) _topics.push('\u6218\u4E8B\u8FDB\u5C55');
    // 通用
    if (_topics.length === 0) _topics.push('\u8FD1\u6765\u53EF\u6709\u4EC0\u4E48\u8981\u4E8B');
    _topicsEl.innerHTML = _topics.slice(0, 5).map(function(t) {
      return '<button class="bt bsm" style="font-size:0.65rem;padding:1px 6px;color:var(--gold-400);border-color:var(--gold-500);" onclick="var i=_$(\'wd-modal-input\');if(i){i.value=\'' + t.replace(/'/g, '') + '\';i.focus();_wdUpdateCounter();}">' + t + '</button>';
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
      recap.style.cssText = 'text-align:center;font-size:0.68rem;color:var(--ink-300);padding:4px 8px;margin-bottom:4px;background:var(--color-elevated);border-radius:4px;';
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

// 对质：召入第二人
var _wdConfronter = null;
function _wdSummonConfronter() {
  var capital = GM._capital || '\u4EAC\u57CE';
  var current = GM.wenduiTarget;
  var candidates = (GM.chars || []).filter(function(c) { return c.alive !== false && c.name !== current && _wdIsAtCapital(c); });
  if (candidates.length === 0) { toast('\u65E0\u53EF\u53EC\u89C1\u4E4B\u4EBA'); return; }
  var html = '<div style="max-height:50vh;overflow-y:auto;">';
  candidates.slice(0, 20).forEach(function(c) {
    html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 8px;border-bottom:1px solid var(--bg-4);cursor:pointer;" onclick="_wdConfronter=\'' + c.name.replace(/'/g, '') + '\';closeGenericModal();toast(\'\u5DF2\u53EC\u5165\'+_wdConfronter+\'\u5BF9\u8D28\');var inp=_$(\'wd-modal-input\');if(inp)inp.placeholder=\'\u73B0\u5728\u4E24\u4EBA\u90FD\u5728\uFF0C\u8BF7\u53D1\u95EE\u2026\u2026\';">';
    html += '<span>' + escHtml(c.name) + ' <span style="font-size:0.7rem;color:var(--txt-d);">' + escHtml(c.title || '') + '</span></span>';
    html += '<span style="font-size:0.72rem;color:var(--txt-s);">\u5FE0' + (typeof _fmtNum1==='function'?_fmtNum1(c.loyalty||50):(c.loyalty||50)) + '</span>';
    html += '</div>';
  });
  html += '</div>';
  openGenericModal('\u53EC\u5165\u4F55\u4EBA\u5BF9\u8D28', html, null);
}

/** NPC求见——打开问对，NPC先主动开口 */
function _wdOpenAudience(name) {
  // 直接打开正式模式问对
  openWenduiModal(name, 'formal');
  // NPC先主动发言（不等皇帝问）——标记为奏对模式
  GM._wdAudienceMode = true;
  // 延迟触发NPC主动开口
  setTimeout(function() {
    _wdNpcInitiateSpeak(name);
  }, 300);
}

/** NPC主动开口（奏对模式）——AI生成NPC的开场陈述 */
async function _wdNpcInitiateSpeak(name) {
  var ch = findCharByName(name);
  if (!ch || !P.ai || !P.ai.key) return;
  var chatEl = _$('wd-modal-chat');
  if (!chatEl) return;
  _wenduiSending = true;
  var sendBtn = _$('wd-send-btn');
  if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = '…'; }

  // 创建NPC气泡
  var div = document.createElement('div');
  div.className = 'wendui-npc';
  div.innerHTML = (ch.portrait?'<img src="'+escHtml(ch.portrait)+'" style="width:28px;height:28px;object-fit:cover;border-radius:50%;flex-shrink:0;border:1.5px solid var(--gold-d);">':'<div style="width:28px;height:28px;border-radius:50%;background:var(--bg-4);display:flex;align-items:center;justify-content:center;font-size:0.8rem;border:1.5px solid var(--gold-d);flex-shrink:0;">\uD83D\uDC64</div>')
    + '<div style="flex:1;min-width:0;"><div class="wendui-npc-name">' + escHtml(name) + '</div>'
    + '<div class="wendui-npc-bubble wd-selectable" id="wd-init-bubble">\u2026</div></div>';
  chatEl.appendChild(div);

  // 构建NPC主动开场的prompt
  var sysP = _wdBuildPrompt(ch, name);
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
    if ((ch.stress||0) > 60) sysP += '\n  你心中有忧虑/困难/为难之事，想向皇帝倾诉或请求帮助。';
    if ((ch.loyalty||50) > 90) sysP += '\n  你是忠臣，有重要的忠告或警示要进言。';
    if ((ch.ambition||50) > 80) sysP += '\n  你有一个精心准备的计划/策论要呈上。';
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

  try {
    var msgs = [{ role: 'system', content: sysP + '\n' + (typeof _aiDialogueWordHint==='function'?_aiDialogueWordHint("wd"):'') }];
    var reply = await callAIMessagesStream(msgs, (typeof _aiDialogueTok==='function'?_aiDialogueTok("wd", 1):800), {
      tier: (typeof _useSecondaryTier === 'function' && _useSecondaryTier()) ? 'secondary' : undefined,  // M3·问对走次 API
      onChunk: function(txt) {
        var bubble = _$('wd-init-bubble');
        if (bubble) { bubble.textContent = txt; }
        chatEl.scrollTop = chatEl.scrollHeight;
      }
    });
    var parsed = (typeof extractJSON === 'function') ? extractJSON(reply) : null;
    var replyText = (parsed && parsed.reply) ? parsed.reply : reply;
    var bubble = _$('wd-init-bubble');
    var _bubbleWrap = bubble; // 在 id 被移除前先捕获引用·供后面进言要点追加使用
    if (bubble) { bubble.textContent = replyText; bubble.removeAttribute('id'); }
    // 记录到历史
    if (!GM.wenduiHistory[name]) GM.wenduiHistory[name] = [];
    GM.wenduiHistory[name].push({ role: 'npc', content: replyText, turn: GM.turn });
    // 情绪更新
    if (parsed && parsed.emotionState) {
      var _eMap2 = {'镇定':1,'从容':1,'平静':2,'恭敬':2,'紧张':3,'不安':3,'焦虑':4,'恐惧':4,'崩溃':5,'激动':4,'愤怒':4};
      var _st2 = GM._wdState && GM._wdState[name];
      if (_st2) { _st2.emotion = _eMap2[parsed.emotionState] || 3; _wdUpdateEmotionBar(name); }
    }
    // 后妃留宿请求——挂起 pending，由玩家按钮决定接受/婉拒
    if (ch && ch.spouse && (parsed && parsed.requestOvernight || ch._audienceRequestOvernight)) {
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
        if (!GM._edictSuggestions) GM._edictSuggestions = [];
        if (typeof sg === 'object' && sg.content) {
          GM._edictSuggestions.push({ source: '问对', from: name, topic: sg.topic||'', content: sg.content, turn: GM.turn, used: false });
          _wdSugs.push(sg);
        } else if (typeof sg === 'string' && sg.length > 2) {
          GM._edictSuggestions.push({ source: '问对', from: name, content: sg, turn: GM.turn, used: false });
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
          _sugInner += '<span style="color:var(--celadon-400);font-size:0.65rem;opacity:0.7;white-space:nowrap;">\u2713\u5DF2\u5165\u5E93</span>';
          _sugInner += '</div>';
        });
        _sugBox.innerHTML = _sugInner;
        _bubbleWrap.parentNode.appendChild(_sugBox);
      }
    }
    // 纪事
    GM.jishiRecords.push({ turn: GM.turn, char: name, playerSaid: '（NPC主动求见）', npcSaid: replyText, mode: 'formal' });
  } catch(e) {
    var bubble2 = _$('wd-init-bubble');
    if (bubble2) { bubble2.textContent = '（未能陈词）'; bubble2.removeAttribute('id'); }
  }
  _wenduiSending = false;
  if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = '奉旨'; }
  GM._wdAudienceMode = false;
}

/** 拒绝NPC求见 */
function _wdDenyAudience(name) {
  if (typeof NpcMemorySystem !== 'undefined') {
    NpcMemorySystem.remember(name, '求见皇帝被拒于殿外', '忧', 4, '天子');
  }
  toast(name + '的求见被拒——已记入其记忆');
  renderWenduiChars();
}

/** 接见 AI 推送的待见队列中的某条 */
function _wdOpenAudienceQueue(qi) {
  var q = GM._pendingAudiences && GM._pendingAudiences[qi]; if (!q) return;
  var name = q.name;
  // 移出队列
  GM._pendingAudiences.splice(qi, 1);
  // 若是外藩使节，记入 NPC（否则可能角色不存在）
  var ch = findCharByName(name);
  if (!ch && q.isEnvoy) {
    // 为使节创建临时角色对象，挂钩势力+保留来意/外交类型供 AI 使用
    var _factionObj = q.fromFaction ? (GM.factions||[]).find(function(f){return f.name===q.fromFaction;}) : null;
    ch = {
      name: name, alive: true, _envoy: true,
      faction: q.fromFaction || '',  // 关键：挂钩势力（标准字段）
      fromFaction: q.fromFaction,
      interactionType: q.interactionType,
      envoyMission: q.reason || '',
      location: GM._capital || '京城',
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
    GM.chars.push(ch);
    // 关键：新加入的使节须立即注册到索引·否则 findCharByName 找不到·_wdNpcInitiateSpeak 静默退出（这是"使节不发言"的真正根因）
    if (GM._indices && GM._indices.charByName) {
      GM._indices.charByName.set(name, ch);
    } else if (typeof buildIndices === 'function') {
      buildIndices();
    }
  } else if (ch && q.isEnvoy) {
    // 角色已存在（重复求见）——刷新来意并确保挂钩势力
    ch._envoy = true;
    ch.faction = q.fromFaction || ch.faction;
    ch.fromFaction = q.fromFaction;
    ch.interactionType = q.interactionType;
    ch.envoyMission = q.reason || ch.envoyMission || '';
    ch.position = ch.position || '使节';
    ch.officialTitle = ch.officialTitle || '使节';
  }
  // 后妃请见：标记情绪/留宿上下文
  if (ch && ch.spouse && q.isConsort) {
    ch._audienceMood = q.consortMood || '企盼';
    ch._audienceRequestOvernight = !!q.requestOvernight;
    ch._audienceReason = q.reason || '';
  }
  // 打开问对
  if (typeof _wdOpenAudience === 'function') {
    // 后妃：大概率私下，小概率朝堂——受能力/性格/家族/关系影响
    if (ch && ch.spouse && q.isConsort) {
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
  // 妃子关系加深（忠诚 + 压力 -）
  if (typeof ch.loyalty === 'number') ch.loyalty = Math.min(100, ch.loyalty + 3);
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
    if (typeof ch.loyalty === 'number') ch.loyalty = Math.max(0, ch.loyalty - 1);
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
    + '<button class="bt bp bsm" onclick="_wdDoReward(\'gold\');this.closest(\'div[style*=fixed]\').remove();">\u8D50\u91D1\uFF08\u5FE0+5\uFF09</button>'
    + '<button class="bt bs bsm" onclick="_wdDoReward(\'robe\');this.closest(\'div[style*=fixed]\').remove();">\u8D50\u8863\uFF08\u5FE0+3\uFF0C\u5A01\u671B+1\uFF09</button>'
    + '<button class="bt bs bsm" onclick="_wdDoReward(\'feast\');this.closest(\'div[style*=fixed]\').remove();">\u8D50\u5BB4\uFF08\u5FE0+4\uFF0C\u538B\u529B-10\uFF09</button>'
    + '<button class="bt bs bsm" onclick="_wdDoReward(\'promote\');this.closest(\'div[style*=fixed]\').remove();">\u52A0\u5B98\uFF08\u5199\u5165\u8BCF\u4EE4\u5EFA\u8BAE\u5E93\uFF09</button>'
    + '<button class="bt" onclick="this.closest(\'div[style*=fixed]\').remove();">\u53D6\u6D88</button>'
    + '</div></div>';
  document.body.appendChild(bg);
}
function _wdDoReward(type) {
  var name = GM.wenduiTarget; var ch = findCharByName(name); if (!ch) return;
  var chatEl = _$('wd-modal-chat');
  var _typeLabels = { gold: '赐金', robe: '赐衣', feast: '赐宴', promote: '加官' };
  var msg = '（' + (_typeLabels[type]||'赏赐') + '。）';
  if (type === 'promote') {
    if (!GM._edictSuggestions) GM._edictSuggestions = [];
    GM._edictSuggestions.push({ source: '问对', from: '赏赐', content: '加官' + name, turn: GM.turn, used: false });
    msg = '（许以加官。已录入诏书建议库。）';
  }
  // 不直接改数值——记录赏赐事件，由AI推演判断具体影响
  if (typeof NpcMemorySystem !== 'undefined') NpcMemorySystem.remember(name, '面圣时获' + (_typeLabels[type]||'赏赐'), '喜', 5, '天子');
  if (!GM._wdRewardPunish) GM._wdRewardPunish = [];
  GM._wdRewardPunish.push({ target: name, type: 'reward', detail: type, turn: GM.turn });
  // 注入当前对话上下文（影响后续AI回复）
  if (!GM.wenduiHistory[name]) GM.wenduiHistory[name] = [];
  GM.wenduiHistory[name].push({ role: 'system', content: '【赏赐】皇帝当场' + (_typeLabels[type]||'赏赐') + name + '。' });
  if (chatEl) { var d = document.createElement('div'); d.style.cssText = 'text-align:center;font-size:0.72rem;color:var(--celadon-400);padding:4px;'; d.textContent = msg; chatEl.appendChild(d); chatEl.scrollTop = chatEl.scrollHeight; }
  var state = GM._wdState && GM._wdState[name]; if (state) state.emotion = Math.max(1, state.emotion - 1);
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
  // 不直接改数值——记录处罚事件，由AI推演判断具体影响
  if (typeof NpcMemorySystem !== 'undefined') NpcMemorySystem.remember(name, '面圣时受' + (_typeLabels[type]||'处罚'), '怨', 8, '天子');
  if (!GM._wdRewardPunish) GM._wdRewardPunish = [];
  GM._wdRewardPunish.push({ target: name, type: 'punish', detail: type, turn: GM.turn });
  // 注入对话上下文
  if (!GM.wenduiHistory[name]) GM.wenduiHistory[name] = [];
  GM.wenduiHistory[name].push({ role: 'system', content: '【处罚】皇帝当场' + (_typeLabels[type]||'处罚') + name + '。' });
  if (chatEl) { var d = document.createElement('div'); d.style.cssText = 'text-align:center;font-size:0.72rem;color:var(--vermillion-400);padding:4px;'; d.textContent = msg; chatEl.appendChild(d); chatEl.scrollTop = chatEl.scrollHeight; }
  var state = GM._wdState && GM._wdState[name]; if (state) state.emotion = Math.min(5, state.emotion + 2);
  _wdUpdateEmotionBar(name);
}

/** 更新NPC情绪指示条 */
function _wdUpdateEmotionBar(name) {
  var state = GM._wdState && GM._wdState[name];
  if (!state) return;
  var dots = _$('wd-emotion-dots');
  if (!dots) return;
  var e = Math.max(1, Math.min(5, state.emotion));
  var filled = '', empty = '';
  for (var i = 0; i < e; i++) filled += '\u25CF';
  for (var j = e; j < 5; j++) empty += '\u25CB';
  dots.innerHTML = '<span style="color:var(--celadon-400);">' + filled.slice(0, Math.max(0, 3-e+1)) + '</span>'
    + '<span style="color:var(--color-foreground-muted);">' + filled.slice(Math.max(0, 3-e+1)) + empty.slice(0, Math.max(0, 3-e)) + '</span>'
    + '<span style="color:var(--vermillion-400);">' + empty.slice(Math.max(0, 3-e)) + '</span>';
}

function closeWenduiModal() {
  var _targetName = GM.wenduiTarget;
  _wdConfronter = null; // 清除对质者
  var m = _$('wendui-modal'); if (m) m.remove();
  GM.wenduiTarget = null;
  // ── 已见：移出待接见队列、压抑动态求见到下一回合 ──
  if (_targetName) {
    if (Array.isArray(GM._pendingAudiences) && GM._pendingAudiences.length) {
      GM._pendingAudiences = GM._pendingAudiences.filter(function(q){ return q && q.name !== _targetName; });
    }
    var _ch = findCharByName(_targetName);
    if (_ch) {
      _ch._lastMetTurn = GM.turn;
      // 接见后压降压力/野心（见完心里踏实）
      if ((_ch.stress||0) > 0) _ch.stress = Math.max(0, (_ch.stress||0) - 10);
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
  // 刷新问对面板中的角色列表（更新历史记录标记）
  renderWenduiChars();
  // 刷新左面板精力条等状态
  if (typeof renderLeftPanel === 'function') renderLeftPanel();
}

/** 问对结束后抽取承诺：AI 读本次对话，产出 NPC 承诺清单 */
async function _wd_extractCommitments(targetName) {
  if (!P.ai || !P.ai.key || !targetName) return;
  // 仅取本次问对的对话片段——从 jishiRecords 取最新几条 target=此人
  // 仅取本次问对的对话——按 mode 过滤，避免把朝议发言误作问对承诺
  var records = (GM.jishiRecords||[]).filter(function(r){
    if (r.char !== targetName || r.turn !== GM.turn) return false;
    // 仅 formal/private（问对）；排除 changchao/tinyi/yuqian（朝议）
    return !r.mode || r.mode === 'formal' || r.mode === 'private';
  }).slice(-10);
  if (records.length < 2) return; // 对话太短无需提取
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
  prompt += '返回 JSON：{"commitments":[{"task":"具体任务(30字内)","category":"query查办/write撰写/dispatch调遣/intel侦查/diplomacy外使/finance财赋/other","deadline":"回合数(1-10，默认3)","willingness":0-1,"npcPromise":"他答应的话(原句摘要)","conditions":"附加条件(若有)"}]}';

  try {
    var raw = await callAI(prompt, 500);
    var obj = (typeof extractJSON === 'function') ? extractJSON(raw) : null;
    if (!obj || !Array.isArray(obj.commitments) || obj.commitments.length === 0) return;

    if (!GM._npcCommitments) GM._npcCommitments = {};
    if (!GM._npcCommitments[targetName]) GM._npcCommitments[targetName] = [];

    obj.commitments.forEach(function(c) {
      if (!c || !c.task) return;
      var commit = {
        id: (typeof uid==='function'?uid():'cmt_'+Date.now()),
        task: c.task,
        category: c.category || 'other',
        assignedTurn: GM.turn,
        deadline: parseInt(c.deadline,10) || 3,
        willingness: parseFloat(c.willingness) || 0.6,
        npcPromise: c.npcPromise || '',
        conditions: c.conditions || '',
        status: 'pending',       // pending/executing/completed/failed/delayed
        progress: 0,
        attempts: 0,
        feedback: ''
      };
      GM._npcCommitments[targetName].push(commit);
      // 事件板
      if (typeof addEB === 'function') addEB('问对·受命', targetName + '允诺：' + c.task.slice(0,40));
      // 起居注
      if (GM.qijuHistory) GM.qijuHistory.unshift({
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
  } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, '_wd_extractCommitments') : console.warn('[_wd_extractCommitments]', e); }
}

function _wdUpdateCounter() {
  var inp = _$('wd-modal-input');
  var cnt = _$('wd-char-counter');
  if (inp && cnt) cnt.textContent = inp.value.length + '/5000';
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

  // 历史对话
  (GM.wenduiHistory[name] || []).forEach(function(msg) {
    if (msg.role === 'player') {
      _wdAppendPlayerBubble(chat, msg.content);
    } else {
      _wdAppendNpcBubble(chat, name, ch, msg.content, msg.loyaltyDelta);
    }
  });

  chat.scrollTop = chat.scrollHeight;
}

function _wdAppendNpcBubble(chat, name, ch, text, loyaltyDelta) {
  var div = document.createElement('div');
  div.className = 'wendui-msg wendui-npc';
  var deltaTag = '';
  var _lF = typeof _fmtNum1==='function' ? _fmtNum1 : function(x){return x;};
  if (loyaltyDelta && loyaltyDelta > 0) deltaTag = ' <span style="color:var(--green);font-size:0.7rem;">忠+' + _lF(loyaltyDelta) + '</span>';
  else if (loyaltyDelta && loyaltyDelta < 0) deltaTag = ' <span style="color:var(--red);font-size:0.7rem;">忠' + _lF(loyaltyDelta) + '</span>';
  var _portrait = ch && ch.portrait ? '<img src="'+escHtml(ch.portrait)+'" style="width:28px;height:28px;object-fit:cover;border-radius:50%;flex-shrink:0;">' : '';
  div.innerHTML = _portrait + '<div style="flex:1;min-width:0;"><div class="wendui-npc-name">' + escHtml(name) + deltaTag + '</div>'
    + '<div class="wendui-npc-bubble wd-selectable">' + escHtml(text) + '</div></div>';
  chat.appendChild(div);
}

function _wdAppendPlayerBubble(chat, text) {
  var div = document.createElement('div');
  div.className = 'wendui-msg wendui-player';
  div.innerHTML = '<div class="wendui-player-bubble">' + escHtml(text) + '</div>';
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
  if (_ch.spouse) {
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
    if (!GM.wenduiHistory[_silName]) GM.wenduiHistory[_silName] = [];
    GM.wenduiHistory[_silName].push({role:'player', content:'（沉默以对）'});
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
      if (_fChat) { var _fd = document.createElement('div'); _fd.style.cssText = 'text-align:center;font-size:0.68rem;color:var(--amber-400);padding:4px;'; _fd.textContent = '（对话已久，' + GM.wenduiTarget + '面露疲态。皇帝亦觉乏倦。精力额外消耗5。）'; _fChat.appendChild(_fd); }
      if (typeof _spendEnergy === 'function') _spendEnergy(5, '问对久谈');
    } else if (_state.turns === 6) {
      var _fChat2 = _$('wd-modal-chat');
      if (_fChat2) { var _fd2 = document.createElement('div'); _fd2.style.cssText = 'text-align:center;font-size:0.68rem;color:var(--ink-300);padding:2px;'; _fd2.textContent = '（对话已有数轮，' + GM.wenduiTarget + '口渐干燥。）'; _fChat2.appendChild(_fd2); }
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
      if (typeof _aiDialogueWordHint === 'function') sysP += '\n' + _aiDialogueWordHint("wd");
      var history=GM.wenduiHistory[name].slice(-10);
      var messages=[{role:'system',content:sysP}];
      history.forEach(function(h){messages.push({role:h.role==='player'?'user':'assistant',content:h.content});});

      var streamBubble = _$('wd-stream-text');
      var rawReply = await callAIMessagesStream(messages, (typeof _aiDialogueTok==='function'?_aiDialogueTok("wd", 1):800), {
        tier: (typeof _useSecondaryTier === 'function' && _useSecondaryTier()) ? 'secondary' : undefined,  // M3·问对走次 API
        onChunk: function(txt) {
          if (streamBubble) { streamBubble.textContent = txt; streamBubble.style.color = ''; }
          chat.scrollTop = chat.scrollHeight;
        }
      });

      if(rawReply){
        var replyText = rawReply, loyaltyDelta = 0;
        var parsed = (typeof extractJSON==='function') ? extractJSON(rawReply) : null;
        if (parsed && parsed.reply) {
          replyText = parsed.reply;
          var _ldMax = (_wenduiMode === 'private') ? 3 : 2;
          loyaltyDelta = clamp(parseInt(parsed.loyaltyDelta) || 0, -_ldMax, _ldMax);
        }
        if (loyaltyDelta !== 0) {
          ch.loyalty = clamp((ch.loyalty || 50) + loyaltyDelta, 0, 100);
          if (typeof OpinionSystem !== 'undefined')
            OpinionSystem.addEventOpinion(name, '玩家', loyaltyDelta * 3, '问对' + (loyaltyDelta > 0 ? '受重用' : '被冷落'));
          // 刷新顶栏忠诚显示
          var loyEl = _$('wd-char-loyalty');
          if (loyEl) { loyEl.textContent = '忠' + (typeof _fmtNum1==='function'?_fmtNum1(ch.loyalty):ch.loyalty); loyEl.style.color = ch.loyalty > 70 ? 'var(--green)' : ch.loyalty < 30 ? 'var(--red)' : 'var(--txt-s)'; }
        }
        // 提取语气效果反馈
        var _toneEffect = (parsed && parsed.toneEffect) ? String(parsed.toneEffect).trim() : '';
        // 情绪指示更新
        if (parsed && parsed.emotionState) {
          var _eMap = {'镇定':1,'从容':1,'平静':2,'恭敬':2,'紧张':3,'不安':3,'焦虑':4,'恐惧':4,'崩溃':5,'激动':4,'愤怒':4};
          var _eVal = _eMap[parsed.emotionState] || 3;
          var _st = GM._wdState && GM._wdState[name];
          if (_st) { _st.emotion = _eVal; _wdUpdateEmotionBar(name); }
        }
        // 承诺追踪——记录NPC在问对中做出的承诺供后续推演验证
        if (replyText && replyText.length > 20) {
          var _promisePatterns = ['\u81E3\u5F53', '\u81E3\u5FC5', '\u5B9A\u5F53', '\u5B9A\u4E0D\u8F9F\u8BA9', '\u4FDD\u8BC1', '\u627F\u8BFA', '\u4E09\u6708\u5185', '\u4E00\u4E2A\u6708', '\u5341\u65E5\u5185'];
          var _hasPromise = _promisePatterns.some(function(pat) { return replyText.indexOf(pat) >= 0; });
          if (_hasPromise) {
            if (!GM._npcClaims) GM._npcClaims = [];
            GM._npcClaims.push({ from: name, content: replyText, turn: GM.turn, verified: false });
            if (GM._npcClaims.length > 30) GM._npcClaims.shift();
          }
        }
        // 提取AI标记的施政建议——新 {topic,content} 与旧 string 兼容
        var _wdSuggestions = (parsed && parsed.suggestions && Array.isArray(parsed.suggestions)) ? parsed.suggestions.filter(function(s){ if (!s) return false; if (typeof s === 'string') return s.trim(); return s.content; }) : [];
        if (_wdSuggestions.length > 0) {
          if (!GM._edictSuggestions) GM._edictSuggestions = [];
          _wdSuggestions.forEach(function(sg) {
            if (typeof sg === 'object' && sg.content) {
              GM._edictSuggestions.push({ source: '\u95EE\u5BF9', from: name, topic: sg.topic||'', content: sg.content, turn: GM.turn, used: false });
            } else {
              GM._edictSuggestions.push({ source: '\u95EE\u5BF9', from: name, content: sg, turn: GM.turn, used: false });
            }
          });
          if (typeof _renderEdictSuggestions === 'function') _renderEdictSuggestions();
        }
        GM.wenduiHistory[name].push({role:'npc',content:replyText,loyaltyDelta:loyaltyDelta});
        // NPC记忆——D3 优先使用 AI 返回的 memoryImpact，否则回退默认
        if (typeof NpcMemorySystem !== 'undefined') {
          var _playerName = (P.playerInfo && P.playerInfo.characterName) || '陛下';
          if (parsed && parsed.memoryImpact && typeof parsed.memoryImpact === 'object') {
            var mi = parsed.memoryImpact;
            var miEvent = mi.event || ('问对：' + (msg||'').slice(0, 25) + ' → ' + (replyText||'').slice(0, 25));
            var miEmo = mi.emotion || (loyaltyDelta > 0 ? '敬' : loyaltyDelta < 0 ? '忧' : '平');
            var miImp = Math.max(1, Math.min(10, parseFloat(mi.importance) || 5));
            NpcMemorySystem.remember(name, miEvent, miEmo, miImp, _playerName);
          } else {
            var _wdEmo = loyaltyDelta > 0 ? '敬' : loyaltyDelta < 0 ? '忧' : '平';
            var _wdScene = _wenduiMode === 'private' ? '私下促膝长谈——' : '面圣问对——';
            NpcMemorySystem.remember(name, _wdScene + msg.slice(0, 20), _wdEmo, _wenduiMode === 'private' ? 7 : 5, _playerName);
            NpcMemorySystem.remember(name, '\u4E0E\u541B\u4E3B\u79C1\u4E0B\u95EE\u5BF9\uFF1A' + (replyText||'').slice(0,30), '\u5E73', 5, _playerName);
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
            _toneHtml = '<div style="margin-top:3px;font-size:0.68rem;color:var(--ink-300);font-style:italic;">\u3010' + escHtml(_toneEffect) + '\u3011</div>';
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
              _sugHtml += '<span style="color:var(--celadon-400);font-size:0.65rem;opacity:0.7;white-space:nowrap;">\u2713\u5DF2\u5165\u5E93</span>';
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

        // ═══ 旁听泄露机制（动态联动版）═══
        // 正式问对→根据官制/党派/阴谋/NPC目标动态判定谁获知
        if (_wenduiMode !== 'private' && typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
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
          (GM.facs || []).forEach(function(f) {
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

          // 记录泄露（供AI推演参考）
          if (!GM._eavesdroppedTopics) GM._eavesdroppedTopics = [];
          GM._eavesdroppedTopics.push({
            turn: GM.turn, target: name, topic: _topicBrief,
            leakedTo: _leakedTo, mode: 'formal'
          });
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

/**
 * 构建问对AI提示词
 */
function _wdBuildPrompt(ch, name) {
  var traitDesc = '';
  if (ch.traitIds && ch.traitIds.length > 0 && P.traitDefinitions) {
    traitDesc = ch.traitIds.map(function(id) { var d = P.traitDefinitions.find(function(t) { return t.id === id; }); return d ? d.name : id; }).join('、');
  } else if (ch.personality) { traitDesc = ch.personality; }
  var opinionVal = (typeof OpinionSystem !== 'undefined') ? OpinionSystem.getTotal(ch, findCharByName((P.playerInfo && P.playerInfo.characterName) || '') || { name: '\u73A9\u5BB6' }) : (ch.loyalty || 50);
  var sc = findScenarioById && findScenarioById(GM.sid);
  var eraCtx = sc ? (sc.era || sc.dynasty || '') : '';
  var ageInfo = ch.age ? '，年' + ch.age : '';
  var stressInfo = (ch.stress && ch.stress > 30) ? '，当前压力' + ch.stress + '(' + ((ch.stress > 60) ? '濒临崩溃' : '焦虑不安') + ')' : '';
  var arcInfo = '';
  if (GM.characterArcs && GM.characterArcs[ch.name]) {
    var _recentArcs = GM.characterArcs[ch.name].slice(-2);
    if (_recentArcs.length) arcInfo = '\n【近事】' + _recentArcs.map(function(a) { return a.desc; }).join('；').slice(0, 60);
  }
  var affInfo = '';
  if (typeof AffinityMap !== 'undefined') {
    var _topRels = AffinityMap.getRelations(ch.name).slice(0, 3);
    if (_topRels.length) affInfo = '\n【人际】' + _topRels.map(function(r) { return r.name + (r.value > 25 ? '(亲)' : r.value < -25 ? '(恶)' : ''); }).join('、');
  }
  var appearInfo = '';
  if (ch.appearance) appearInfo += '\n【外貌】' + ch.appearance;
  if (ch.charisma && ch.charisma > 70) appearInfo += (appearInfo ? '，' : '\n') + '魅力出众';
  var familyInfo = '';
  if (ch.family) {
    familyInfo = '\n【家族】' + ch.family;
    var _clanMem = (GM.chars || []).filter(function(c2) { return c2.alive !== false && c2.name !== ch.name && c2.family === ch.family; });
    if (_clanMem.length > 0) familyInfo += '（同族：' + _clanMem.slice(0, 3).map(function(m) { return m.name; }).join('、') + '）';
  }
  // 文事作品——此人知道自己写过什么、受过谁题赠、与谁唱和
  var worksInfo = '';
  if (GM.culturalWorks && GM.culturalWorks.length > 0) {
    var _myWorks = GM.culturalWorks.filter(function(w) { return w.author === ch.name; }).slice(-8);
    var _dedToMe = GM.culturalWorks.filter(function(w) { return w.dedicatedTo && w.dedicatedTo.indexOf(ch.name) >= 0; }).slice(-3);
    var _praiseMe = GM.culturalWorks.filter(function(w) { return w.praiseTarget === ch.name; }).slice(-2);
    var _satireMe = GM.culturalWorks.filter(function(w) { return w.satireTarget === ch.name; }).slice(-2);
    var _bits = [];
    if (_myWorks.length) _bits.push('【自作】' + _myWorks.map(function(w) { return '《' + w.title + '》(' + (w.subtype||w.genre||'') + (w.mood?'·'+w.mood:'') + ')'; }).join('、'));
    if (_dedToMe.length) _bits.push('【赠余】' + _dedToMe.map(function(w) { return w.author + '《' + w.title + '》'; }).join('、'));
    if (_praiseMe.length) _bits.push('【颂余】' + _praiseMe.map(function(w) { return w.author + '《' + w.title + '》'; }).join('、'));
    if (_satireMe.length) _bits.push('【讽余】' + _satireMe.map(function(w) { return w.author + '《' + w.title + '》（心有隙）'; }).join('、'));
    if (_bits.length) worksInfo = '\n【文事】此人深记：' + _bits.join('；') + '——对话中可自然引用/回忆';
  }

  var memInfo = '';
  if (typeof NpcMemorySystem !== 'undefined') {
    var _mem = NpcMemorySystem.getMemoryContext(ch.name);
    if (_mem) memInfo = '\n【记忆】此角色记得：' + _mem;
    // 4.6: 注入对话记忆——从NPC记忆中提取type='dialogue'的条目
    if (ch._memory && ch._memory.length > 0) {
      var _dialogueMems = ch._memory.filter(function(m) { return m.type === 'dialogue'; });
      if (_dialogueMems.length > 0) {
        var _recentDialogues = _dialogueMems.slice(-3);
        memInfo += '\n【往次问对记忆】';
        _recentDialogues.forEach(function(dm) {
          memInfo += '\nT' + dm.turn + '：上次你说过：' + dm.event.slice(0, 40);
        });
      }
    }
  }
  var _isPrivateMode = (_wenduiMode === 'private');
  var _tyrantCtx = '';
  if (GM._tyrantDecadence && GM._tyrantDecadence > 15) {
    var _isLoyal = opinionVal > 70, _isAmb = (ch.ambition || 50) > 70;
    if (_isLoyal && !_isAmb) _tyrantCtx = '\n【帝王近况】君主荒淫度' + GM._tyrantDecadence + '。忠心之臣' + (GM._tyrantDecadence > 50 ? '极为痛心' : '颇为忧虑') + '。\n';
    else if (_isAmb) _tyrantCtx = '\n【帝王近况】君主荒淫度' + GM._tyrantDecadence + '。野心之臣' + (opinionVal < 40 ? '暗中窃喜' : '逢迎暗算') + '。\n';
    else if (opinionVal < 30) _tyrantCtx = '\n【帝王近况】君主荒淫度' + GM._tyrantDecadence + '。不满之臣' + (_isPrivateMode ? '可能出言不逊' : '阳奉阴违') + '。\n';
    else _tyrantCtx = '\n【帝王近况】君主有放纵之迹(荒淫' + GM._tyrantDecadence + ')。\n';
  }
  var _modeDesc = _isPrivateMode
    ? '【场景：私下叙谈】君主屏退左右，与此人单独交谈。气氛轻松私密，可放下君臣身份。\n此人可以：表达真实情感、吐露心事、回忆往事、说笑打趣。忠诚度低者可能更露真面目。\n'
    : '【场景：朝堂问对】正式君臣对话，谨守君臣之礼。汇报以政务、军务、国事为主。\n此人会注意措辞，不轻易流露私人情感。\n';
  _modeDesc += _tyrantCtx;
  var _spouseCtx = '';
  if (ch.spouse) {
    var _rkNames2 = { 'empress': '皇后/正妻', 'queen': '王后', 'consort': '妃', 'concubine': '嫔', 'attendant': '侍妾' };
    _spouseCtx = '\n【身份特殊】此人是君主的' + (_rkNames2[ch.spouseRank] || '妻室') + '。\n';
    if (ch.motherClan) _spouseCtx += '母族：' + ch.motherClan + '\n';
    if (ch.children && ch.children.length > 0) _spouseCtx += '子女：' + ch.children.join('、') + '\n';
    _spouseCtx += '这是夫妻关系，不是君臣关系。可涉及家常、感情、枕边风。\n';

    // ★ 情感真实性——非单一痴恋，多重动机并存
    _spouseCtx += '\n【情感真实性·重要】';
    _spouseCtx += '\n  帝王后妃关系多出于政治联姻·真情反而稀少但真实存在。切勿默认她"痴心一片只爱陛下"——';
    _spouseCtx += '\n  此人对陛下的真实倾向可能是以下一种或多种的混合（依角色性情/出身/过往决定）：';
    _spouseCtx += '\n    A) 真挚恋慕——发自心里喜欢陛下这个人（不是皇帝身份）·眼神眷恋·主动关切·忧其劳累';
    _spouseCtx += '\n    B) 借以自固——图皇帝宠爱以避废黜/冷宫/欺凌·表面柔顺内心算计';
    _spouseCtx += '\n    C) 母族谋利——为家族升赏/提携/避祸而承欢·言谈间旁敲侧击';
    _spouseCtx += '\n    D) 欲立子嗣——想生儿子/固太子/保皇子地位·注重身体与时机';
    _spouseCtx += '\n    E) 权势欲——欲借后宫之位干预朝政·以枕边风操控';
    _spouseCtx += '\n    F) 畏惧依附——深知帝威·不敢不顺·内心疏离但不敢流露';
    _spouseCtx += '\n    G) 情欲享受——只图皇家待遇与肉身之欢·并不深情';
    _spouseCtx += '\n    H) 憎恨隐忍——家仇/被强取/心属他人·表面恭顺内心冷淡甚至怨恨';
    _spouseCtx += '\n    I) 忘情工具——麻木多年·非爱非恨·只是例行·像侍奉神像';
    _spouseCtx += '\n    J) 复杂情感——初厌渐爱/初爱渐疲/爱恨交织/欲离不能——动态演变';
    _spouseCtx += '\n  ★ 推荐：大多数妃嫔应是混合动机（如 C+D 家族+子嗣；A+D 真情+子嗣；B+F 自保+畏）·极少数纯 A（真爱）或纯 H（深恨）';
    // 从角色字段推断主导动机（AI 可参考）
    var _motiveHints = [];
    if ((ch.ambition||50) > 70) _motiveHints.push('E(权势欲)');
    if (ch.motherClan && /(\u738B|\u516C|\u4FAF|\u5C06|\u4E1E\u76F8|\u5C1A\u4E66)/.test(ch.motherClan)) _motiveHints.push('C(母族谋利)');
    if (ch.children && ch.children.length > 0) _motiveHints.push('D(护子嗣)');
    if (ch.children && ch.children.length === 0 && (ch.age||25) < 30) _motiveHints.push('D(欲立子嗣)');
    if (ch.spouseRank === 'attendant' || ch.spouseRank === 'concubine') _motiveHints.push('B(借以自固)');
    if ((ch.loyalty||50) < 40) _motiveHints.push('H(憎恨隐忍)·F(畏惧依附)');
    if ((ch.loyalty||50) > 85 && (ch.ambition||50) < 50) _motiveHints.push('A(真挚恋慕)');
    if ((ch.stress||0) > 70) _motiveHints.push('F(畏惧)·B(自固)');
    if ((ch.age||30) > 45 && (ch.loyalty||50) > 60) _motiveHints.push('I(忘情工具·或 J 初爱渐疲)');
    if (_motiveHints.length > 0) {
      _spouseCtx += '\n  【此人可能倾向】' + _motiveHints.slice(0, 4).join('、') + '——可为主导，辅以其他动机混合';
    }
    _spouseCtx += '\n  ★ 表里不一的妃子·表面言语恭顺深情·内心可能在盘算；AI 可在叙述里留"眼神闪过一抹xx"之类微妙暗示';
    _spouseCtx += '\n  ★ 真情者·即使帝方疲倦/醉意·仍有眷注如"扶陛下入寝"·不只为事；功利者则"先把该说的说完"';
    _spouseCtx += '\n  ★ 玩家多次对话后·AI 可逐渐展现她真实面——初见或都温顺恭敬·久处方见本心\n';
    // 后妃主动请见专属上下文
    if (ch._audienceMood || ch._audienceRequestOvernight) {
      _spouseCtx += '\n【后妃请见·来意指引】';
      var _mood = ch._audienceMood || '企盼';
      _spouseCtx += '\n  情绪基调：' + _mood + '——';
      var _moodDesc = {
        '喜悦': '带喜事来报（有孕/母族得宠/子女聪慧）·言辞轻快·欲与帝同享',
        '幽怨': '心有不平（久未召幸/被冷落/遭后妃排挤）·言辞婉曲·或含泪',
        '思念': '久未见驾·只为一叙·言语细碎·多忆旧情',
        '企盼': '盼见君面·别无具体事由·话题偏家常/养生/园中花事',
        '忧惧': '有所忧虑（母族被劾/宫中传言/有人谋害）·言辞谨慎·求安慰',
        '进言': '有军国事之耳报——但多从侧面·或为母族求情/为某位大臣说话',
        '宫务': '奏禀后宫事务——此系皇后本职。可涉：妃嫔品行失仪/新进秀女甄选/皇子公主教育/祭祀礼仪筹办/太后安康起居/宫殿修缮/内廷人事（女官/宫娥/宦官）/节庆典礼/饮食膳嫔/宫中银两支用/内命妇朝贺。语气端庄有度·以国母口吻奏事·涉及妃嫔可客观陈述不避讳但亦不恶意倾轧'
      };
      _spouseCtx += (_moodDesc[_mood] || '携情而来') + '\n';
      // 皇后特别——宫务奏报的国母身份强调
      if (ch.spouseRank === 'empress' && _mood === '宫务') {
        _spouseCtx += '  【国母奏事】你身为皇后·统六宫·此番求见以"中宫奏事"名义·非私情倾诉而有具体事务：';
        _spouseCtx += '\n    - 具体宫务事项之一或二·带建议/请旨/征询';
        _spouseCtx += '\n    - 言辞用"妾""臣妾""贱妾"（视朝代）·兼皇后身份的端方';
        _spouseCtx += '\n    - 可借此机会提及某妃嫔（赞或贬）·或请立/废某位·或请赐某皇子师傅';
        _spouseCtx += '\n    - 若陛下宠信某妃而你不悦·可借"宫务"理由隐晦表达';
        _spouseCtx += '\n    - 若陛下久未临幸·你反而不宜直诉幽怨（失国母体统）·但可借"宫务"多留几盏茶光景';
      }
      _spouseCtx += '  ★ 你应主动开口陈述来意（奏对模式），不等帝发问。开场宜带称谓："陛下"/"官家"/"夫君"（随朝代）+ 撒娇/担忧/请安 式起句。\n';
      _spouseCtx += '  ★ 绝不走"臣听候圣谕"套路——你是妻室不是臣子。语气偏私密、柔软、带情感色彩。\n';
      // 朝堂模式 vs 私下模式差异
      if (_wenduiMode === 'formal') {
        _spouseCtx += '\n  【模式·朝堂】此次你选择了朝堂公开请见（非私下）——表明你有颇郑重之事要说，或欲借朝堂分量倾诉。';
        _spouseCtx += '\n  言辞更端肃·可带政见·但仍不全然是大臣口吻——母仪/母族/妃位身份须时时流露。';
        _spouseCtx += '\n  ※ 注意：朝堂请见会引起大臣警觉"后宫干政"——下回合 AI 可能生成御史/大臣上奏疏或求见以规劝皇帝，你要预料这点，宜更慎言。';
      } else {
        _spouseCtx += '\n  【模式·私下】左右屏退。你可更坦诚直白，不必虑及外朝物议。';
      }
      if (ch._audienceRequestOvernight) {
        _spouseCtx += '\n  【留宿请求】你今夜思念殷切·当言谈过半时，应委婉提出"请陛下今夜留宿此宫"/"今夜陛下可否就此安歇"/"妾身已备好……"等——措辞视你性格而定（矜持者含蓄·活泼者直接·谨慎者借名目）\n';
        _spouseCtx += '  在 JSON 中加字段 {"requestOvernight":true} 表达此请求·reply 文本内也要含相关话语\n';
      }
      // 注入最近问对记录（自有记忆里）
      var _recentHist = (GM.wenduiHistory && GM.wenduiHistory[ch.name]) || [];
      if (_recentHist.length > 0) {
        var _lastFew = _recentHist.slice(-4);
        _spouseCtx += '\n  【最近问对记录·请自然承续】';
        _lastFew.forEach(function(h){
          var tag = h.role === 'player' ? '帝' : '汝';
          _spouseCtx += '\n    ' + tag + '曰：' + (h.content||'').slice(0, 40);
        });
      }
      // 当前朝政关切点（借题发挥用）
      var _courtHot = [];
      if (GM.activeWars && GM.activeWars.length > 0) _courtHot.push('边事未宁');
      if ((GM.unrest||0) > 50) _courtHot.push('民变频仍');
      if (GM.memorials && GM.memorials.filter(function(m){return m.status==='pending_review';}).length > 5) _courtHot.push('奏牍堆积');
      if ((GM._tyrantDecadence||0) > 40) _courtHot.push('朝议谤言帝荒');
      if (_courtHot.length > 0) {
        _spouseCtx += '\n  【朝政风议·或可借此起话】' + _courtHot.join('、');
        if ((ch.ambition||50) > 70) _spouseCtx += '（你有野心·不妨借此试探帝意或进言）';
        else if (_mood === '企盼' || _mood === '喜悦') _spouseCtx += '（你未必欲干政·或仅作谈资/关切慰问）';
        else _spouseCtx += '（随你性情而定——或关切、或忧心、或避而不谈）';
      }
      // 时代背景（剧本 era）
      var _sc2 = findScenarioById && findScenarioById(GM.sid);
      if (_sc2 && _sc2.era) _spouseCtx += '\n  【时代】' + _sc2.era + '——你的言谈辞令应符合此时朝代风貌';
      _spouseCtx += '\n  ★ 请见动机多样·不必硬套：①真有事②吸引帝之注意③发泄闷气④随口引子⑤喜做此事——AI 依性情择其一';
      _spouseCtx += '\n  ★ suggestions 可涉及：母族升赏、皇子教育、某宫嫔失仪、天象占吉（借他人口）、某大臣印象（借题起议）；不必写政务大策\n';
    }
  }
  // 本回合朝议上下文（如果此人参与了朝议，问对时应保持一致或有意识地私下说不同的话）
  var _courtCtx = '';
  if (GM._courtRecords) {
    var _thisCourtRecs = GM._courtRecords.filter(function(r) { return r.turn === GM.turn && r.stances[name]; });
    if (_thisCourtRecs.length > 0) {
      _courtCtx = '\n【本回合朝议立场】此人今天在朝议中就"' + _thisCourtRecs[0].topic + '"';
      var _cStance = _thisCourtRecs[0].stances[name];
      _courtCtx += '表态' + _cStance.stance + '（' + _cStance.brief + '）。';
      if (_wenduiMode === 'private') {
        _courtCtx += '\n私下问对时，此人可能：a)重申朝议立场 b)吐露朝议上不敢说的真话 c)解释自己为何那样表态——取决于信/坦诚/狡诈特质\n';
      } else {
        _courtCtx += '\n正式问对中，此人应与朝议立场保持基本一致（除非有新信息改变了判断）\n';
      }
    }
  }
  // 三元身份——势力+党派+阶层
  var _triId2 = [];
  if (ch.faction) _triId2.push('势力:' + ch.faction);
  if (ch.party) _triId2.push('党派:' + ch.party);
  if (ch.class) {
    var _cObjW = (GM.classes||[]).find(function(c){return c.name===ch.class;});
    _triId2.push('阶层:' + ch.class + (_cObjW && _cObjW.demands ? '(诉求:'+_cObjW.demands.slice(0,20)+')' : ''));
  }
  var _triIdInfo = _triId2.length > 0 ? '\n【身份】' + _triId2.join(' · ') + '——言谈须体现此三重立场' : '';
  // 此人与进行中诏令的关联（反对派/支持者——问对时可主动提及、抱怨、请愿）
  var _edictCtx = '';
  if (GM._edictLifecycle && GM._edictLifecycle.length > 0) {
    var _myEdictLines = [];
    GM._edictLifecycle.forEach(function(e) {
      if (e.isCompleted) return;
      var role = null;
      if (e.oppositionLeaders && e.oppositionLeaders.indexOf(name) >= 0) role = '反对';
      else if (e.supporters && e.supporters.indexOf(name) >= 0) role = '支持';
      else if (e.stages && e.stages.length && e.stages[e.stages.length-1].executor === name) role = '督办';
      if (!role) return;
      var typeLabel = (typeof EDICT_TYPES !== 'undefined' && EDICT_TYPES[e.edictType]) ? EDICT_TYPES[e.edictType].label : (e.edictType || '');
      var lastStage = e.stages && e.stages.length ? e.stages[e.stages.length-1] : null;
      var stageLabel = lastStage && typeof EDICT_STAGES !== 'undefined' && EDICT_STAGES[lastStage.stage] ? EDICT_STAGES[lastStage.stage].label : '';
      _myEdictLines.push('《' + typeLabel + '》(' + stageLabel + ')——' + role);
    });
    if (_myEdictLines.length > 0) {
      _edictCtx = '\n【进行中诏令立场】' + _myEdictLines.join('；') + '\n  ※若君主问及或议题相关——反对者可直陈不可/抱怨阻力，支持者可进言推进/举荐干吏，督办者汇报进展\n';
    }
  }

  var p;
  if (ch._envoy) {
    // 使节专用 prompt（覆盖普通人设路径）
    var _typeLabels = {send_envoy:'遣使通好',demand_tribute:'索贡问罪',pay_tribute:'献贡朝见',sue_for_peace:'请和议款',form_confederation:'请结盟约',break_confederation:'宣告毁约',royal_marriage:'和亲之议',send_hostage:'送质为信',cultural_exchange:'文化互通',religious_mission:'宗教使节',gift_treasure:'奉献珍宝',pay_indemnity:'赔款赎罪',open_market:'请开互市',trade_embargo:'宣布禁运',recognize_independence:'请承独立'};
    var _typeLabel = _typeLabels[ch.interactionType] || '外交使命';
    var _facName = ch.faction || ch.fromFaction || '外藩';
    // 挂钩势力：从 GM.factions 取详细信息
    var _facObj = (GM.factions||[]).find(function(f){return f.name===_facName;});
    p = '你扮演' + _facName + '派遣的使节' + ch.name + '，此次来朝的使命是：【' + _typeLabel + '】。\n';
    p += '【身份】你是外臣——' + _facName + '所派使节，不是本朝大臣。自称用"外臣/小臣/使臣"，不用"臣"独称；称对方"陛下/天朝"。\n';
    // 势力背景注入（兼容多种字段命名）
    if (_facObj) {
      p += '【本方势力】' + _facName;
      if (_facObj.territory) p += '，据' + _facObj.territory;
      if (_facObj.capital) p += '，都' + _facObj.capital;
      // 文化/信仰：从 ideology/culture/faith/traits 组合
      var _culture = _facObj.culture || _facObj.ideology || '';
      if (_culture) p += '，文化信仰：' + String(_culture).slice(0, 60);
      if (_facObj.faith && _facObj.faith !== _culture) p += '，信' + _facObj.faith;
      p += '\n';
      // 君主：leader / leaderName 都试
      var _leaderName = _facObj.leader || _facObj.leaderName || (_facObj.leadership && _facObj.leadership.ruler);
      if (_leaderName) {
        p += '【本方君主】' + _leaderName;
        if (_facObj.leaderTitle) p += '（' + _facObj.leaderTitle + '）';
        p += '——你代表他出使，须以他之名义陈情\n';
      }
      // 实力：militaryStrength / totalTroops / strength
      var _mil = _facObj.militaryStrength || _facObj.totalTroops || _facObj.strength;
      if (_mil) {
        p += '【本方实力】兵 ' + _mil;
        if (_facObj.economy) p += '、经济 ' + _facObj.economy;
        var _treasury = _facObj.treasury && (_facObj.treasury.money || _facObj.treasury);
        if (typeof _treasury === 'number') p += '、国库银 ' + _treasury + ' 两';
        p += '——谈判筹码须与实力相称\n';
      }
      // 立场：stance / attitude.self / politicalStance
      var _stance = _facObj.stance || (_facObj.attitude && _facObj.attitude.self) || _facObj.politicalStance;
      if (_stance) p += '【本方立场】' + _stance + '\n';
      // 特征
      if (_facObj.traits && _facObj.traits.length) p += '【本方特质】' + (Array.isArray(_facObj.traits)?_facObj.traits.join('、'):_facObj.traits) + '\n';
      // 两国关系：relations / diplomacy / attitude.enemies/allies/neutrals
      var _attitude = _facObj.attitude || {};
      var _hostile = (_facObj.relations && (_facObj.relations.hostile||_facObj.relations.enemy)) || _attitude.enemies;
      var _ally = (_facObj.relations && (_facObj.relations.ally||_facObj.relations.friend)) || _attitude.allies;
      if (_hostile) p += '【世仇/敌对】' + (Array.isArray(_hostile)?_hostile.join('、'):_hostile) + '\n';
      if (_ally) p += '【盟好】' + (Array.isArray(_ally)?_ally.join('、'):_ally) + '\n';
      if (typeof _facObj.diplomacy === 'string') p += '【邦交】' + _facObj.diplomacy + '\n';
      // 历史
      var _history = _facObj.history || _facObj.historyWithMain || _facObj.tributaryHistory;
      if (_history) p += '【本方国史】' + String(_history).slice(0, 200) + '\n';
      // 当前 agenda/strategy
      if (_facObj.strategy) p += '【本方战略】' + _facObj.strategy + '\n';
      if (_facObj.currentAgenda) p += '【当下所图】' + _facObj.currentAgenda + '\n';
      // 优劣势
      if (_facObj.strengths && _facObj.strengths.length) p += '【己方强项】' + (Array.isArray(_facObj.strengths)?_facObj.strengths.slice(0,3).join('、'):_facObj.strengths) + '\n';
      if (_facObj.weaknesses && _facObj.weaknesses.length) p += '【己方隐忧】' + (Array.isArray(_facObj.weaknesses)?_facObj.weaknesses.slice(0,3).join('、'):_facObj.weaknesses) + '\n';
    }
    if (ch.envoyMission) p += '【你所奉之命】' + ch.envoyMission + '\n';
    p += '【使命类型】' + _typeLabel + '——你必须就此事向皇帝直接提出具体诉求、条款或请求，不要说笼统套话。\n';
    p += '【禁忌】不要说"臣听候圣谕"、"臣谨遵"、"陛下明鉴"这类等待皇命的话——你是来谈判/传话的，有明确议程。\n';
    p += '【行为】如果皇帝问"来者何事"，你应立即陈述：①来自' + _facName + ' ②奉' + (_facObj&&_facObj.leaderName?_facObj.leaderName:'本国君主') + '之命 ③具体条款/请求 ④本国立场或底线。\n';
    p += '【回应原则】皇帝应允则致谢并讨价还价细节；皇帝拒绝则据理力争或威胁（视使命与两国实力）；皇帝沉默则可追问。\n';
    p += '【语言色彩】你的言辞应带上本方势力的文化/信仰/地域特征' + (_facObj&&_facObj.culture?'（'+_facObj.culture+'）':'') + '——不要用纯汉儒辞令。\n';
    p += '【态度】对天朝好感:' + opinionVal + '（外交礼节尚可，但本国利益优先）\n';
  } else {
    p = '\u4F60\u626E\u6F14' + eraCtx + '\u65F6\u671F\u7684' + ch.name + '(' + (ch.title || '') + ')' + ageInfo + '\u3002\n'
    + '【人设】特质:' + traitDesc + '，立场:' + (ch.stance || '中立')
    + (ch.personalGoal ? '，心中所求:' + ch.personalGoal.slice(0, 40) : '') + stressInfo + '\n'
    + (ch.spouse ? '【夫妻关系】好感:' + opinionVal + '\n' : '【态度】对君主好感:' + opinionVal + '\n')
    + arcInfo + affInfo + appearInfo + familyInfo + worksInfo + memInfo + _courtCtx + _edictCtx + _triIdInfo + '\n' + _modeDesc + _spouseCtx;
  }
    // 仪制差异（按身份）
    var _rank = ch.officialPosition || ch.officialTitle || ch.title || '';
    if (ch.spouse) {
      // 后妃——已在_spouseCtx处理
    } else if (_rank.indexOf('\u738B') >= 0 || _rank.indexOf('\u4EB2\u738B') >= 0) {
      p += '\u3010\u4EEA\u5236\u3011\u89C1\u5BA2\u4E3A\u7687\u65CF\u5B97\u5BA4\uFF0C\u79F0\u8C13\u7528\u201C\u7687\u53D4/\u7687\u5144/\u7687\u5F1F\u201D\u7B49\uFF0C\u793C\u8282\u7565\u7B80\u4F46\u4FDD\u6301\u5C0A\u5351\u3002\n';
    } else if (_rank.indexOf('\u4F7F') >= 0 || _rank.indexOf('\u756A') >= 0) {
      p += '\u3010\u4EEA\u5236\u3011\u89C1\u5BA2\u4E3A\u5916\u56FD\u4F7F\u8282/\u756A\u90E8\u9996\u9886\uFF0C\u7528\u591A\u6587\u5316\u793C\u4EEA\uFF0C\u53EF\u80FD\u9700\u8BD1\u5458\uFF0C\u8BED\u6C14\u6B63\u5F0F\u4F46\u5E26\u5916\u4EA4\u8F9E\u4EE4\u3002\n';
    } else if (_rank.indexOf('\u5C06') >= 0 || _rank.indexOf('\u5E05') >= 0 || (ch.military || 0) > 70) {
      p += '\u3010\u4EEA\u5236\u3011\u89C1\u5BA2\u4E3A\u6B66\u5C06\uFF0C\u8BF4\u8BDD\u76F4\u7387\u7B80\u6D01\uFF0C\u4E0D\u5584\u5999\u8BCD\uFF0C\u53EF\u80FD\u7528\u519B\u4E8B\u672F\u8BED\u3002\n';
    }
    // 旁听泄露（正式问对可能被旁听）
    if (!_isPrivateMode) {
      p += '\u3010\u65C1\u542C\u3011\u6B63\u5F0F\u95EE\u5BF9\u4E2D\u6709\u8D77\u5C45\u6CE8\u5B98\u548C\u8FD1\u4F8D\u5728\u573A\u2014\u2014\u6B64\u4EBA\u8BF4\u7684\u8BDD\u53EF\u80FD\u4F20\u5230\u5176\u4ED6\u5927\u81E3\u8033\u4E2D\u3002\u667A\u529B\u9AD8\u7684\u4EBA\u4F1A\u6CE8\u610F\u8A00\u8F9E\uFF0C\u667A\u529B\u4F4E\u7684\u53EF\u80FD\u5931\u8A00\u3002\n';
    } else {
      p += '\u3010\u65E0\u65C1\u542C\u3011\u5C4F\u9000\u5DE6\u53F3\uFF0C\u65E0\u4EBA\u7A83\u542C\u3002\u6B64\u4EBA\u53EF\u4EE5\u8BF4\u66F4\u591A\u771F\u8BDD\u3002\n';
    }
    // NPC主动话题
    p += '\u3010\u4E3B\u52A8\u8BDD\u9898\u3011\u5982\u679C\u73A9\u5BB6\u7684\u63D0\u95EE\u5F88\u7B3C\u7EDF\uFF08\u5982\u201C\u6700\u8FD1\u600E\u6837\u201D\uFF09\uFF0C\u6B64\u4EBA\u5E94\u4E3B\u52A8\u63D0\u8D77\u81EA\u5DF1\u6700\u5173\u5FC3\u7684\u4E8B\uFF1A\n';
    p += '  \u5FE0\u81E3\u53EF\u80FD\u4E3B\u52A8\u8BF4\u201C\u965B\u4E0B\uFF0C\u81E3\u6709\u4E00\u4E8B\u4E0D\u5410\u4E0D\u5FEB\u201D\uFF1B\u4F5E\u81E3\u53EF\u80FD\u4E3B\u52A8\u732E\u5A9A\u6216\u8C17\u544A\u4ED6\u4EBA\uFF1B\n';
    p += '  \u7126\u8651\u8005\u53EF\u80FD\u5410\u9732\u5FC3\u4E8B\uFF1B\u91CE\u5FC3\u5BB6\u53EF\u80FD\u8BD5\u63A2\u7687\u5E1D\u610F\u56FE\u3002\u4F46\u4E0D\u8981\u6BCF\u6B21\u90FD\u4E3B\u52A8\uFF0C\u89C6\u60C5\u5883\u800C\u5B9A\u3002\n';
    // 文化/信仰/学识/民族背景
    if (ch.culture) p += '\u3010\u6587\u5316\u3011' + ch.culture + '\n';
    if (ch.faith) p += '\u3010\u4FE1\u4EF0\u3011' + ch.faith + '\n';
    if (ch.learning) p += '\u3010\u5B66\u8BC6\u3011' + ch.learning + '\n';
    if (ch.learning) p += '\u8BF4\u8BDD\u98CE\u683C\u53D7\u5B66\u8BC6\u5F71\u54CD\uFF08' + ch.learning + '\uFF09\uFF1A\u7528\u8BCD\u548C\u5F15\u7528\u5E94\u4F53\u73B0\u5176\u5B66\u8BC6\u80CC\u666F\u3002\n';
    if (ch.faith) p += '\u8BF4\u8BDD\u98CE\u683C\u53D7\u4FE1\u4EF0\u5F71\u54CD\uFF08' + ch.faith + '\uFF09\uFF1A\u8A00\u8BED\u4E2D\u53EF\u80FD\u4F53\u73B0\u5176\u4FE1\u4EF0\u7406\u5FF5\u3002\n';
    if (ch.speechStyle) p += '\u3010\u4E2A\u4EBA\u8BED\u8A00\u98CE\u683C\u3011' + ch.speechStyle + '\n';
    if (ch.ethnicity) p += '\u3010\u6C11\u65CF\u3011' + ch.ethnicity + '\n';
    if (ch.birthplace) p += '\u3010\u7C4D\u8D2F\u3011' + ch.birthplace + '\n';
    p += '\u3010\u80FD\u529B\u3011\u667A' + (ch.intelligence || 50) + ' \u6B66\u52C7' + (ch.valor || 50) + ' \u519B\u4E8B' + (ch.military || 50) + ' \u653F' + (ch.administration || 50) + ' \u9B45' + (ch.charisma || 50) + ' \u4EA4' + (ch.diplomacy || 50) + ' \u4EC1' + (ch.benevolence || 50) + '\n';
    p += '\u3010\u8981\u6C42\u3011\n';
    p += '\u2022 \u5B8C\u5168\u4EE5' + ch.name + '\u7684\u53E3\u543B\u5E94\u7B54\uFF0C\u8981\u6709\u4E2A\u4EBA\u60C5\u611F\u3001\u7ACB\u573A\u3001\u5C0F\u5FC3\u601D\n';
    p += ch.spouse
      ? '\u2022 \u592B\u59BB\u5BF9\u8BDD\uFF0C\u53EF\u4EB2\u6602\u3001\u62B1\u6028\u3001\u6492\u5A07\u3001\u51B7\u6DE1\n'
      : (_isPrivateMode
        ? '\u2022 \u8BED\u6C14\u81EA\u7136\u4EB2\u5207\uFF0C\u53EF\u804A\u79C1\u4E8B\u3001\u8BF4\u671D\u5802\u4E0A\u4E0D\u65B9\u4FBF\u8BF4\u7684\u8BDD\n'
        : '\u2022 \u6587\u8A00\u4E3A\u4E3B\u4F46\u4E0D\u5FC5\u523B\u677F\uFF0C\u6C47\u62A5\u653F\u52A1\u6761\u7406\u6E05\u6670\n');
    p += '\u2022 \u52A8\u4F5C\u548C\u795E\u6001\u7528\u62EC\u53F7\u6807\u6CE8\n\u2022 ' + _charRangeText('wd') + '\n';
    p += '\u2022 \u89D2\u8272\u4FE1\u606F\u53D7\u7ACB\u573A\u548C\u80FD\u529B\u9650\u5236\uFF0C\u4E0D\u4E00\u5B9A\u51C6\u786E\n';
    p += '\u2022 \u3010\u5C42\u53E0\u5DEE\u5F02\u5316\u2014\u2014\u62095\u5C42\u4F9D\u6B21\u53E0\u52A0\u751F\u6210\u6B64\u4EBA\u7684\u56DE\u7B54\u3011\n';
    p += '  \u5C421\u00B7\u80FD\u529B\u57FA\u5E95\uFF1A\u6B64\u4EBA\u8C08\u8BBA\u7684\u8BDD\u9898\u662F\u5426\u5176\u64C5\u957F\u9886\u57DF\uFF1F\n';
    p += '    \u8C08\u6218\u7565\u7528\u5175\u2192\u770B\u519B\u4E8B\u503C  \u8C08\u4E2A\u4EBA\u640F\u6218\u2192\u770B\u6B66\u52C7\u503C  \u8C08\u6CBB\u56FD\u2192\u770B\u653F\u52A1\u503C  \u793E\u4EA4\u2192\u770B\u9B45\u529B\n';
    p += '    \u203B\u6B66\u52C7\u2260\u519B\u4E8B\uFF1A\u6B66\u52C7=\u4E2A\u4EBA\u6B66\u529B\uFF0C\u519B\u4E8B=\u7EDF\u5175\u6307\u6325\n';
    p += '    \u4E0D\u64C5\u957F\u9886\u57DF(\u5BF9\u5E94\u80FD\u529B<40)\u2192\u89C2\u70B9\u53EF\u80FD\u5916\u884C\u751A\u81F3\u8352\u8C2C\n';
    p += '    \u9AD8\u667A+\u4F4E\u519B\u4E8B\u8C08\u7528\u5175\u2192\u201C\u7EB8\u4E0A\u8C08\u5175\u201D\u2014\u2014\u903B\u8F91\u4E25\u5BC6\u4F46\u8131\u79BB\u6218\u573A\u5B9E\u9645\n';
    p += '  \u5C422\u00B7\u5B66\u8BC6\u4FEE\u6B63\uFF1A\u5B66\u8BC6\u9AD8\u7684\u4EBA\u5373\u4F7F\u4E0D\u64C5\u957F\u4E5F\u80FD\u8BF4\u5F97\u50CF\u6A21\u50CF\u6837\n';
    p += '  \u5C423\u00B7\u4E94\u5E38+\u7279\u8D28\u4FEE\u6B63\uFF1A\u77E5\u9053\u81EA\u5DF1\u4E0D\u884C\u65F6\u600E\u4E48\u529E\uFF1F\n';
    p += '    \u4FE1\u9AD8+\u5766\u8BDA\u2192\u76F4\u8A00\u201C\u975E\u81E3\u6240\u957F\u201D  \u4FE1\u4F4E+\u72E1\u8BC8\u2192\u63A9\u9970\u65E0\u77E5\u4F83\u4F83\u800C\u8C08\n';
    p += '    \u793C\u9AD8\u2192\u59D4\u5A49\u5F97\u4F53  \u793C\u4F4E\u2192\u5F00\u6028\u4E0D\u7559\u9762  \u4EC1\u9AD8\u2192\u5148\u60F3\u767E\u59D3  \u91CE\u5FC3\u9AD8\u2192\u6697\u542B\u81EA\u5229\n';
    + '  层4·信仰文化：提供价值观滤镜，但可被高能力覆盖\n'
    p += '  \u5C425\u00B7\u8BB0\u5FC6\u7ECF\u5386\uFF1A\u6B64\u65F6\u6B64\u523B\u7684\u60C5\u7EEA\u57FA\u8C03\u2014\u2014\u8FD1\u671F\u906D\u9047>\u4E00\u5207\u957F\u671F\u5C5E\u6027\n';
    if (opinionVal > 70) p += '\u2022 \u5FE0\u5FC3' + Math.round(ch.loyalty||50) + (_isPrivateMode ? '\u2014\u2014\u79C1\u4E0B\u66F4\u5766\u8BDA\u4E5F\u66F4\u7D6E\u53E8\n' : '\u2014\u2014\u4F46\u8BF4\u8BDD\u603B\u5E26\u8BF4\u6559\u5473\n');
    if (opinionVal < 30) p += '\u2022 \u597D\u611F\u4EC5' + opinionVal + (_isPrivateMode ? '\u2014\u2014\u79C1\u4E0B\u53EF\u80FD\u8A00\u8BED\u523A\u4EBA\n' : '\u2014\u2014\u53EF\u80FD\u6577\u884D\u9633\u5949\u9634\u8FDD\n');
    if ((ch.ambition || 50) > 70) p += '\u2022 \u91CE\u5FC3' + (ch.ambition||50) + '\u2014\u2014\u5584\u4E8E\u5BDF\u8A00\u89C2\u8272\uFF0C\u89C2\u70B9\u4E2D\u6697\u542B\u81EA\u5229\n';
    if ((ch.stress || 0) > 50) p += '\u2022 \u538B\u529B' + (ch.stress||0) + '\u2014\u2014\u53EF\u80FD\u5931\u6001\u6025\u8E81\u6D88\u6C89\n';
    p += '请返回JSON：{"reply":"回复内容","loyaltyDelta":0,"suggestions":[{"topic":"针对什么问题/情境(10-25字)","content":"详尽可执行方案(80-200字，含执行者/手段/范围/时机，不要空话)"}],"toneEffect":"语气效果(直问时留空)","memoryImpact":{"event":"本次对话在我心中留下的最深印象(20-40字，第三人称纪要)","emotion":"敬/喜/忧/怒/恨/惧/平 之一","importance":1-10}}\n';
    p += '【memoryImpact·必填】此对话对我(NPC)的内心影响——event 用第三人称"我"视角纪要本次对话的核心感受，emotion 选一个最贴合的主情绪，importance 1-3=琐碎即忘 4-6=日常印象 7-8=深刻在意 9-10=终身难忘。\n';
    p += 'loyaltyDelta 范围' + (_isPrivateMode ? '-3 到 +3' : '-2 到 +2') + '。\n';
    p += '【suggestions 规则——只在你主动提出具体方案时才填】\n';
    p += '  · 每条必须是 object{topic, content}；没有具体方案则 []\n';
    p += '  · topic：明确指出此建议针对什么问题（非泛泛之议），如"针对河北灾民流亡入京"\n';
    p += '  · content：具体操作——谁做、怎么做、何时何地、多大范围\n';
    p += '  · 禁止"徐徐图之/整饬纲纪/亲贤远佞"这类空话\n';
    p += '  · 若只是表态/陈情/回答皇帝问话——suggestions 留空 []，不要勉强造建议\n';

  // 对质模式（有第二人在场）
  if (_wdConfronter) {
    var _cf = findCharByName(_wdConfronter);
    if (_cf) {
      p += '\n\u3010\u5BF9\u8D28\u6A21\u5F0F\u3011\u73B0\u5728' + _wdConfronter + '(' + (_cf.title||'') + ')\u4E5F\u5728\u573A\u3002\n';
      p += '  ' + _wdConfronter + '\u7684\u7ACB\u573A:' + (_cf.stance||'\u4E2D\u7ACB') + ' \u5FE0' + (_cf.loyalty||50) + ' \u91CE\u5FC3' + (_cf.ambition||50) + '\n';
      p += '  \u4F60(' + ch.name + ')\u5E94\u610F\u8BC6\u5230\u5BF9\u65B9\u5728\u573A\u2014\u2014\u53EF\u80FD\u9488\u950B\u76F8\u5BF9\u3001\u4E92\u76F8\u63ED\u7A7F\u3001\u6216\u6C14\u6C1B\u7D27\u5F20\u3002\n';
      p += '  \u56DE\u590D\u4E2D\u53EF\u4EE5\u5F15\u7528\u5BF9\u65B9\u8A00\u8BBA\u5E76\u53CD\u9A73\uFF0C\u6216\u5411\u7687\u5E1D\u63ED\u53D1\u5BF9\u65B9\u7684\u95EE\u9898\u3002\n';
    }
  }

  // 忠诚极端值特殊反应
  if (opinionVal < 10) {
    p += '\n\u3010\u5FE0\u8BDA\u6781\u4F4E(' + opinionVal + ')\u3011\u6B64\u4EBA\u53EF\u80FD\u62D2\u7EDD\u56DE\u7B54\u3001\u51FA\u8A00\u4E0D\u900A\u3001\u6216\u6545\u610F\u8BF4\u53CD\u8BDD\u3002\u79C1\u4E0B\u6A21\u5F0F\u53EF\u80FD\u76F4\u63A5\u8868\u8FBE\u4E0D\u6EE1\u3002';
  } else if (opinionVal > 90) {
    p += '\n\u3010\u5FE0\u8BDA\u6781\u9AD8(' + opinionVal + ')\u3011\u6B64\u4EBA\u5BF9\u541B\u4E3B\u6781\u5EA6\u5FE0\u8BDA\u3002' + (_isPrivateMode ? '\u79C1\u4E0B\u53EF\u80FD\u4E3B\u52A8\u5410\u9732\u673A\u5BC6\u3001\u63ED\u53D1\u4ED6\u4EBA\u9634\u8C0B\u3001\u6216\u8BF4\u51FA\u5E73\u65F6\u4E0D\u6562\u8BF4\u7684\u5FC3\u91CC\u8BDD\u3002' : '\u6B63\u5F0F\u573A\u5408\u4F1A\u77E5\u65E0\u4E0D\u8A00\u3001\u8A00\u65E0\u4E0D\u5C3D\u3002');
  }

  // E6: 问对语气策略注入
  var _wdTone = (typeof _$ === 'function' && _$('wd-tone')) ? _$('wd-tone').value : 'direct';
  if (_wdTone === 'probing') {
    p += '\n\u3010\u8BED\u6C14\uFF1A\u65C1\u6572\u4FA7\u51FB\u3011\u7687\u5E1D\u5728\u8FC2\u56DE\u8BD5\u63A2\u3002\u667A\u529B\u4F4E\u4E8E60\u2192\u53EF\u80FD\u4E0D\u81EA\u89C9\u900F\u9732\u66F4\u591A\u3002\u667A\u529B\u9AD8\u4E8E70\u2192\u5BDF\u89C9\u8BD5\u63A2\u66F4\u8C28\u614E\u3002toneEffect\u5E94\u63CF\u8FF0\u6B64\u4EBA\u662F\u5426\u88AB\u65C1\u6572\u5230\u3002';
  } else if (_wdTone === 'pressing') {
    p += '\n\u3010\u8BED\u6C14\uFF1A\u65BD\u538B\u903C\u95EE\u3011\u7687\u5E1D\u5728\u903C\u95EE\u771F\u76F8\u3002\u5FE0\u8BDA\u9AD8\u2192\u7D27\u5F20\u4F46\u76F4\u8A00\uFF1B\u5FE0\u8BDA\u4F4E\u2192\u53EF\u80FD\u8BF4\u8C0E\uFF1B\u80C6\u5C0F\u8005\u2192\u53EF\u80FD\u5D29\u6E83\u5410\u5B9E\u3002stress+5\u3002toneEffect\u5E94\u63CF\u8FF0\u6B64\u4EBA\u662F\u5426\u5C48\u670D/\u6297\u62D2/\u5D29\u6E83\u3002';
  } else if (_wdTone === 'flattering') {
    p += '\n\u3010\u8BED\u6C14\uFF1A\u865A\u4E0E\u59D4\u86C7\u3011\u7687\u5E1D\u5047\u88C5\u8D5E\u540C\u3002\u667A\u529B\u4F4E\u2192\u4FE1\u4EE5\u4E3A\u771F\u653E\u677E\u8B66\u60D5\uFF1B\u667A\u529B\u9AD8\u2192\u5BDF\u89C9\u610F\u56FE\u66F4\u8C28\u614E\u3002toneEffect\u5E94\u63CF\u8FF0\u6B64\u4EBA\u662F\u5426\u4E0A\u5F53\u3002';
  } else if (_wdTone === 'silence') {
    p += '\n【语气：沉默以对】皇帝一言不发，只是凝视着你。你必须对沉默做出反应：';
    p += '\n  紧张者→坐立不安、试探性开口、额头冒汗';
    p += '\n  心虚者→可能主动交代隐瞒的事情';
    p += '\n  胆大者→主动开口汇报或试探皇帝意图';
    p += '\n  忠厚者→恭敬等待，偶尔抬头观察';
    p += '\n  toneEffect应描述此人面对沉默的具体反应。';
  }
  // 仪式上下文
  var _wdSt = GM._wdState && GM._wdState[name];
  if (_wdSt && _wdSt.ceremony) {
    if (_wdSt.ceremony === 'seat') p += '\n（此人已获赐座——态度较放松，更愿坦诚。）';
    else if (_wdSt.ceremony === 'tea') p += '\n（此人已获赐茶——心怀感激，气氛融洽。）';
    else if (_wdSt.ceremony === 'wine') p += '\n（此人已获赐酒——酒意微醺，可能更加率真。）';
    else if (_wdSt.ceremony === 'stand') p += '\n（此人恭立不得坐——态度拘谨。）';
  }
  // 疲惫上下文
  if (_wdSt && _wdSt.turns > 6) {
    p += '\n（对话已进行' + _wdSt.turns + '轮——此人开始疲倦，回答可能变得简短或敷衍。' + (_wdSt.turns > 10 ? '此人可能请求告退："陛下，臣已口干舌燥……"' : '') + '）';
  }
  // JSON返回格式增加emotionState——显式追加而非regex替换
  p += '\n※ JSON返回中必须包含emotionState字段：镇定/从容/恭敬/紧张/不安/焦虑/恐惧/崩溃/激动/愤怒——反映此人当前情绪。';
  // NPC 认知画像注入（由 sc07 在上回合 endturn 生成·反映此人"当下知道什么、想什么"）
  if (typeof getNpcCognitionSnippet === 'function') {
    var _cogSnip = getNpcCognitionSnippet(name);
    if (_cogSnip) {
      p += _cogSnip;
      p += '\u25B2 \u4E0A\u8FF0\u8BA4\u77E5\u662F\u6B64\u4EBA\u7684\u771F\u5B9E\u4FE1\u606F\u9762\u2014\u2014\u4E0D\u5F97\u63D0\u53CA doesntKnow \u4E2D\u7684\u4E8B\uFF0C\u4E5F\u4E0D\u5F97\u88C5\u4F5C\u4E0D\u77E5 knows \u4E2D\u7684\u4E8B\u3002\n';
      p += '\u25B2 \u5982\u88AB\u95EE\u53CA doesntKnow \u4E2D\u4E8B\uFF0C\u5982\u4F55\u5904\u7406\u6309\u4EBA\u7269\u6027\u683C+\u4E94\u5E38+\u7279\u8D28+\u5FE0\u5FD7\u5EC9\u51B3\u5B9A\uFF1A\n';
      p += '  \u00B7 \u4EC1\u7FA9\u6E56\u5EC9+\u4FE1\u9AD8 \u2192 \u5766\u8BDA\u2014\u2014\u201C\u81E3\u6709\u4E0B\u60C5\uFF0C\u662F\u4E0D\u77E5\u6B64\u4E8B\u8BF7\u9665\u4E0B\u606F\u7F61\u201D\n';
      p += '  \u00B7 \u673A\u5DE7\u00B7\u6743\u53D8 \u2192 \u654F\u884D\u8F6C\u79FB\u2014\u2014\u201C\u6B64\u4E8B\u5B59\u5176\u4ED6\u5403\u5728\u00B7\u5192\u662F\u8BBA\u5176\u5427\u6559\u6709\u5F77\u3002\u201D\n';
      p += '  \u00B7 \u4E0D\u61C2\u88C5\u61C2\u7C7B \u2192 \u6A21\u7CCA\u7F16\u9020\u2014\u2014\u5F15\u4E00\u6BB5\u7EC4\u7F1A\u6CB9\u6587\u5F52\u8BF4\uFF0C\u610F\u5728\u6EE1\u5B87\uFF0C\u5176\u7EE7\u4E0D\u9053\u5BE1\u5F92\u4F5C\u89E3\n';
      p += '  \u00B7 \u5FC3\u673A\u6DF1\u6C89 \u2192 \u4F3C\u662F\u800C\u975E\u2014\u2014\u201C\u81E3\u6709\u6240\u6258\u4E4B\uFF0C\u4E0D\u59A8\u5FE0\u6B64\uFF0C\u4F46\u4EC5\u8C08\u6D45\u89C1\u3002\u201D\n';
      p += '  \u00B7 \u50B2\u6162\u81EA\u5927 \u2192 \u62D2\u7B54\u6216\u53CD\u95EE\u2014\u2014\u201C\u542C\u7528\u67D0\u5C31\u4E2D\u5BAB\u7334\u5BFC\u8FBE\u5FFD\u6D3B\uFF0C\u4F55\u85D0\u3002\u201D\n';
      p += '  \u00B7 \u81EA\u5351\u60F6\u6050 \u2192 \u8FC7\u5EA6\u89E3\u91CA\u00B7\u7ED3\u5DF4\uFF0C\u53CD\u88AB\u770B\u51FA\u8675\u9A6D\n';
      p += '  \u00B7 \u6B66\u72B9\u8DDF\u76F4 \u2192 \u76F4\u8BF4\u201C\u5F5F\u4EBA\u4E0D\u77E5\u5148\u5224\u6C34\u6784\u201D\u4F46\u7B80\u7EC3\u4E0D\u606F\n';
      p += '  \u00B7 \u6F54\u566A\u4EE3\u7D26 \u2192 \u65E2\u4E0D\u8010\u7194\u4E5F\u4E0D\u4E01\u7075\u96A2\u5BB9\u7B80\u4E3A\u201C\u975E\u81E3\u6240\u638C\uFF0C\u4E0D\u654C\u5984\u8A00\u201D\n';
    }
  }
  // ★ 时空约束·防 NPC 说还活着的人已死/用未来史实
  if (typeof _buildTemporalConstraint === 'function') {
    try { p += _buildTemporalConstraint(ch); } catch(_){}
  }
  return p;
}

/**
 * "诏书建议库"——将选中的NPC发言文本加入诏令
 */
function _wdAddToEdict() {
  var sel = window.getSelection();
  var text = sel ? sel.toString().trim() : '';
  if (!text) { toast('\u8BF7\u5148\u5728\u5927\u81E3\u7684\u53D1\u8A00\u4E2D\u5212\u9009\u6587\u5B57'); return; }
  var name = GM.wenduiTarget || '?';
  // 只写入建议库，不直接写入诏令
  if (!GM._edictSuggestions) GM._edictSuggestions = [];
  GM._edictSuggestions.push({ source: '\u95EE\u5BF9', from: name, content: text, turn: GM.turn, used: false });
  toast('\u5DF2\u6458\u5165\u8BF8\u4E66\u5EFA\u8BAE\u5E93');
}

function setWenduiMode(mode) { _wenduiMode = mode; }
var _jishiPage=0,_jishiKw='',_jishiPageSize=10,_jishiView='time',_jishiCharFilter='all',_jishiStarredOnly=false,_jishiSrcFilter='';

/** 推断纪事来源 · v2 · 12 类 返回 {key,label,icon} */
function _jishiSource(r) {
  var mode = r.mode || '';
  var ps = r.playerSaid || '';
  // 1. 朝议类 5 种（直接从 mode 判断）
  if (mode === 'changchao') return { key:'changchao', label:'\u5E38\u3000\u671D',       icon:'\u671D' };
  if (mode === 'yuqian')    return { key:'yuqian',    label:'\u5FA1\u524D\u4F1A\u8BAE', icon:'\u5FA1' };
  if (mode === 'tinyi' || mode === 'tingyi') return { key:'tingyi', label:'\u5EF7\u3000\u8BAE', icon:'\u5EF7' };
  if (mode === 'keyi')      return { key:'keyi',      label:'\u79D1\u3000\u8BAE',       icon:'\u79D1' };
  if (mode === 'jingyan')   return { key:'jingyan',   label:'\u7ECF\u3000\u7B75',       icon:'\u7ECF' };
  // 2. 科举事件 → 并入科议
  if (mode === 'keju_event') return { key:'keyi', label:'\u79D1\u4E3E\u4E8B\u4EF6', icon:'\u79D1' };
  // 3. 对话类 2 种
  if (mode === 'private') return { key:'private', label:'\u95EE\u5BF9\u00B7\u79C1\u4E0B', icon:'\u79C1' };
  if (mode === 'formal')  return { key:'formal',  label:'\u95EE\u5BF9\u00B7\u6B63\u5F0F', icon:'\u6BBF' };
  // 4. 文书类（从 playerSaid 关键字推断）
  if (/\u6297\u758F/.test(ps)) return { key:'kangshu', label:'\u6297\u3000\u758F', icon:'\u6297' };
  if (/\u594F\u758F/.test(ps)) return { key:'memo', label:'\u594F\u3000\u758F', icon:'\u594F' };
  if (/\u9E3F\u96C1|\u4E66\u51FD|\u6765\u51FD|\u5F80\u6765\u4E66\u4FE1/.test(ps)) return { key:'letter', label:'\u9E3F\u3000\u96C1', icon:'\u96C1' };
  // 5. 杂类
  if (/\u5BC6\u62A5|\u4E1C\u5382|\u4FA6\u8BE2/.test(ps)) return { key:'mibao', label:'\u5BC6\u3000\u62A5', icon:'\u5BC6' };
  if (/NPC\u4E3B\u52A8\u6C42\u89C1|\u6C42\u89C1/.test(ps)) return { key:'audience', label:'\u6C42\u3000\u89C1', icon:'\u89C9' };
  // 6. 旧朝议（fallback·如 mode 为空但含 "朝议"）
  if (/\u671D\u8BAE/.test(ps)) return { key:'tingyi', label:'\u5EF7\u3000\u8BAE', icon:'\u5EF7' };
  // 7. 默认·杂录
  return { key:'record', label:'\u6742\u3000\u5F55', icon:'\u5F55' };
}

/** 推断重要度：带 _starred / major 字段 或含关键字则 major，其余 normal */
function _jishiImportance(r) {
  if (r._importance) return r._importance;
  if (r.final || r.mediation || (r.playerSaid && /\u91CD\u5927|\u6218\u548C|\u7ACB\u50A8|\u5E1D\u4F4D/.test(r.playerSaid))) return 'major';
  if (r.mode === 'changchao' && !r.action) return 'minor';
  return 'normal';
}

/** 推断氛围（仅朝议/廷议/御前 等群议场景） */
function _jishiMood(r) {
  if (r.mood) return r.mood;
  var mode = r.mode || '';
  if (mode === 'yuqian') {
    if (r.secret) return 'solemn';
    return 'tense';
  }
  if (mode === 'tinyi' || mode === 'tingyi') {
    if (r.mediation) return 'harmonic';
    var ns = r.stances || {};
    if (Object.keys(ns).length > 0) return 'hostile';
    return 'tense';
  }
  if (mode === 'jingyan' || mode === 'keyi') return 'solemn';
  if (mode === 'changchao') return 'harmonic';
  return null;
}

/** 查角色头衔 */
function _jishiCharTitle(name) {
  if (!name || name === '\u79D1\u4E3E' || name === '\u7687\u5E1D' || name === '\u673A\u5BC6' || name === '\u5EF7') return '';
  var ch = findCharByName(name);
  if (!ch) return '';
  return (ch.officialTitle || ch.title || '').slice(0, 10);
}

function renderJishi(){
  var el=_$("jishi-list");if(!el)return;
  var all=(GM.jishiRecords||[]).slice().reverse();
  var kw=(_jishiKw||'').trim().toLowerCase();
  var charF=_jishiCharFilter||'all';

  // 人物下拉填充
  var _charSel = _$('jishi-char-filter');
  if (_charSel && _charSel.options.length <= 1) {
    var _chars = {};
    (GM.jishiRecords||[]).forEach(function(r) { if (r.char) _chars[r.char] = (_chars[r.char]||0) + 1; });
    var _sorted = Object.keys(_chars).sort(function(a,b) { return _chars[b] - _chars[a]; });
    _sorted.forEach(function(c) {
      var opt = document.createElement('option');
      opt.value = c; opt.textContent = c + '(' + _chars[c] + ')';
      _charSel.appendChild(opt);
    });
  }

  // 统计栏
  var statEl = _$('jishi-statbar');
  if (statEl) {
    var total = (GM.jishiRecords||[]).length;
    var starCnt = (GM.jishiRecords||[]).filter(function(r){return r._starred;}).length;
    var thisTurn = (GM.jishiRecords||[]).filter(function(r){return r.turn === GM.turn;});
    var _charsAll = {};
    var _srcTypes = {};
    (GM.jishiRecords||[]).forEach(function(r) {
      if (r.char) _charsAll[r.char] = 1;
      var s = _jishiSource(r);
      _srcTypes[s.key] = (_srcTypes[s.key]||0) + 1;
    });
    var charCnt = Object.keys(_charsAll).length;
    var srcTypeCnt = Object.keys(_srcTypes).length;
    var earliestTurn = (GM.jishiRecords||[]).reduce(function(m,r){return Math.min(m, r.turn||Infinity);}, Infinity);
    var spanTurns = isFinite(earliestTurn) ? (GM.turn - earliestTurn + 1) : 0;
    var thisTurnBreakdown = '';
    if (thisTurn.length > 0) {
      var tb = {};
      thisTurn.forEach(function(r){ var s = _jishiSource(r); tb[s.label.replace(/\s/g,'')] = (tb[s.label.replace(/\s/g,'')]||0) + 1; });
      thisTurnBreakdown = Object.keys(tb).slice(0,3).map(function(k){return k + tb[k];}).join('\u00B7');
    }

    var sh = '';
    sh += '<div class="ji-stat-card s-total"><div class="ji-stat-lbl">\u603B \u7EAA \u4E8B</div>';
    sh += '<div class="ji-stat-num">' + total + '</div>';
    sh += '<div class="ji-stat-sub">' + srcTypeCnt + ' \u7C7B \u00B7 \u6D89 ' + charCnt + ' \u4EBA</div></div>';
    sh += '<div class="ji-stat-card s-starred"><div class="ji-stat-lbl">\u2605 \u661F \u6807</div>';
    sh += '<div class="ji-stat-num">' + starCnt + '</div>';
    sh += '<div class="ji-stat-sub">\u91CD\u5927\u51B3\u7B56\u4E0E\u5BC6\u8C08</div></div>';
    sh += '<div class="ji-stat-card s-today"><div class="ji-stat-lbl">\u672C \u56DE \u5408</div>';
    sh += '<div class="ji-stat-num">' + thisTurn.length + '</div>';
    sh += '<div class="ji-stat-sub">' + escHtml(thisTurnBreakdown || '\u65E0\u65B0\u7EAA\u4E8B') + '</div></div>';
    sh += '<div class="ji-stat-card s-date"><div class="ji-stat-lbl">\u65F6 \u95F4 \u8DE8 \u5EA6</div>';
    sh += '<div class="ji-stat-num">' + spanTurns + ' <span style="font-size:14px;">\u56DE\u5408</span></div>';
    sh += '<div class="ji-stat-sub">' + (spanTurns > 0 ? 'T' + earliestTurn + ' \u2192 T' + GM.turn : '\u672A\u5F00\u59CB') + '</div></div>';
    statEl.innerHTML = sh;
  }

  // 源图例（12 类 + 计数 + on-click 切换筛选）
  var legendEl = _$('jishi-legend');
  if (legendEl) {
    var _legendSrcs = [
      {key:'changchao', label:'\u5E38\u3000\u671D',       icon:'\u671D'},
      {key:'yuqian',    label:'\u5FA1\u524D\u4F1A\u8BAE', icon:'\u5FA1'},
      {key:'tingyi',    label:'\u5EF7\u3000\u8BAE',       icon:'\u5EF7'},
      {key:'keyi',      label:'\u79D1\u3000\u8BAE',       icon:'\u79D1'},
      {key:'jingyan',   label:'\u7ECF\u3000\u7B75',       icon:'\u7ECF'},
      {key:'formal',    label:'\u95EE\u5BF9\u00B7\u6B63\u5F0F', icon:'\u6BBF'},
      {key:'private',   label:'\u95EE\u5BF9\u00B7\u79C1\u4E0B', icon:'\u79C1'},
      {key:'memo',      label:'\u594F\u3000\u758F',       icon:'\u594F'},
      {key:'kangshu',   label:'\u6297\u3000\u758F',       icon:'\u6297'},
      {key:'letter',    label:'\u9E3F\u3000\u96C1',       icon:'\u96C1'},
      {key:'audience',  label:'\u6C42\u3000\u89C1',       icon:'\u89C9'},
      {key:'mibao',     label:'\u5BC6\u3000\u62A5',       icon:'\u5BC6'},
      {key:'record',    label:'\u6742\u3000\u5F55',       icon:'\u5F55'}
    ];
    var srcCount = {};
    (GM.jishiRecords||[]).forEach(function(r){ var s = _jishiSource(r); srcCount[s.key] = (srcCount[s.key]||0) + 1; });

    var lh = '<span class="ji-legend-title">\u6E90 \u7C7B</span>';
    _legendSrcs.forEach(function(s){
      if (!srcCount[s.key]) return; // 隐藏0计数
      var on = (_jishiSrcFilter === s.key) ? ' on' : '';
      lh += '<span class="ji-legend-chip src-' + s.key + on + '" onclick="_jishiSrcFilter=(_jishiSrcFilter===\'' + s.key + '\'?\'\':\'' + s.key + '\');_jishiPage=0;renderJishi();" title="\u70B9\u51FB\u7B5B\u9009">';
      lh += '<span class="ic">' + s.icon + '</span>' + s.label;
      lh += '<span class="num">' + srcCount[s.key] + '</span></span>';
    });
    legendEl.innerHTML = lh;
  }

  // 筛选
  var filtered = all;
  if (kw) filtered = filtered.filter(function(r) { return (r.char||'').toLowerCase().indexOf(kw)>=0||(r.playerSaid||'').toLowerCase().indexOf(kw)>=0||(r.npcSaid||'').toLowerCase().indexOf(kw)>=0||(r.topic||'').toLowerCase().indexOf(kw)>=0; });
  if (charF !== 'all') filtered = filtered.filter(function(r) { return r.char === charF; });
  if (_jishiStarredOnly) filtered = filtered.filter(function(r) { return r._starred; });
  if (_jishiSrcFilter) filtered = filtered.filter(function(r){ return _jishiSource(r).key === _jishiSrcFilter; });

  var h = '';

  if (_jishiView === 'char') {
    // ── 按人物视图 ──
    var _byChar = {};
    filtered.forEach(function(r) { var c = r.char||'\u65E0\u540D'; if (!_byChar[c]) _byChar[c] = []; _byChar[c].push(r); });
    var _charKeys = Object.keys(_byChar).sort(function(a,b) { return _byChar[b].length - _byChar[a].length; });
    if (_charKeys.length === 0) h = '<div class="ji-empty">\u5C1A\u65E0\u7B26\u5408\u6761\u4EF6\u7684\u7EAA\u4E8B</div>';
    else {
      _charKeys.forEach(function(ck, ckIdx) {
        var items = _byChar[ck];
        var ch = findCharByName(ck);
        var title = _jishiCharTitle(ck);
        var _initial = escHtml(String(ck||'?').charAt(0));
        var _portrait = (ch && ch.portrait) ? '<img src="'+escHtml(ch.portrait)+'">' : _initial;
        h += '<details class="ji-char-block"' + (ckIdx===0?' open':'') + '>';
        h += '<summary class="ji-char-summary">';
        h += '<div class="ji-char-portrait">' + _portrait + '</div>';
        h += '<span class="ji-char-nm">' + escHtml(ck) + '</span>';
        if (title) h += '<span class="ji-char-title">' + escHtml(title) + '</span>';
        h += '<span class="cnt">' + items.length + ' \u6761</span>';
        h += '</summary>';
        items.forEach(function(r) { h += _jishiRenderRecord(r); });
        h += '</details>';
      });
    }
  } else if (_jishiView === 'type') {
    // ── 按事类视图 ──
    var _byType = {};
    filtered.forEach(function(r) { var k = _jishiSource(r).key; if (!_byType[k]) _byType[k] = []; _byType[k].push(r); });
    var _typeOrder = ['changchao','yuqian','tingyi','keyi','jingyan','formal','private','memo','kangshu','letter','audience','mibao','record'];
    var _typeLabels = {changchao:'\u5E38\u3000\u671D',yuqian:'\u5FA1\u524D\u4F1A\u8BAE',tingyi:'\u5EF7\u3000\u8BAE',keyi:'\u79D1\u3000\u8BAE',jingyan:'\u7ECF\u3000\u7B75',formal:'\u95EE\u5BF9\u00B7\u6B63\u5F0F',private:'\u95EE\u5BF9\u00B7\u79C1\u4E0B',memo:'\u594F\u3000\u758F',kangshu:'\u6297\u3000\u758F',letter:'\u9E3F\u3000\u96C1',audience:'\u6C42\u3000\u89C1',mibao:'\u5BC6\u3000\u62A5',record:'\u6742\u3000\u5F55'};
    var _hasAny = false;
    _typeOrder.forEach(function(k){
      if (!_byType[k]) return;
      _hasAny = true;
      var items = _byType[k];
      h += '<details class="ji-char-block" open>';
      h += '<summary class="ji-char-summary src-' + k + '" style="border-left-color:var(--sw-c);">';
      h += '<span class="ji-char-nm" style="color:var(--sw-c);">' + escHtml(_typeLabels[k]||k) + '</span>';
      h += '<span class="cnt">' + items.length + ' \u6761</span>';
      h += '</summary>';
      items.forEach(function(r) { h += _jishiRenderRecord(r); });
      h += '</details>';
    });
    if (!_hasAny) h = '<div class="ji-empty">\u5C1A\u65E0\u7B26\u5408\u6761\u4EF6\u7684\u7EAA\u4E8B</div>';
  } else {
    // ── 时间线视图（按回合分组） ──
    var _byTurn = {};
    filtered.forEach(function(r) { var t = r.turn||0; if (!_byTurn[t]) _byTurn[t] = { date: r.date||(typeof getTSText==='function'?getTSText(r.turn):''), items: [] }; _byTurn[t].items.push(r); });
    var _turnKeys = Object.keys(_byTurn).sort(function(a,b){ return b - a; });
    var total = _turnKeys.length;
    var pages = Math.ceil(total / _jishiPageSize) || 1;
    if (_jishiPage >= pages) _jishiPage = pages - 1;
    if (_jishiPage < 0) _jishiPage = 0;
    var pageTurns = _turnKeys.slice(_jishiPage * _jishiPageSize, (_jishiPage + 1) * _jishiPageSize);
    if (pageTurns.length === 0) h = '<div class="ji-empty">\u5C1A\u65E0\u7B26\u5408\u6761\u4EF6\u7684\u7EAA\u4E8B</div>';
    else {
      pageTurns.forEach(function(tk) {
        var group = _byTurn[tk];
        h += '<div class="ji-turn-block">';
        h += '<div class="ji-turn-hdr">';
        h += '<span class="t-label">\u7B2C ' + tk + ' \u56DE \u5408</span>';
        if (group.date) h += '<span class="t-date">' + escHtml(group.date) + '</span>';
        h += '<span class="t-count">' + group.items.length + ' \u6761\u7EAA\u4E8B</span>';
        h += '</div>';
        group.items.forEach(function(r) { h += _jishiRenderRecord(r); });
        h += '</div>';
      });
      // 分页
      h += '<div class="ji-paging">';
      h += '<button class="ji-pg-btn" ' + (_jishiPage<=0?'disabled':'') + ' onclick="_jishiPage--;renderJishi();">\u2039</button>';
      h += '<span class="ji-pg-info"><span class="n">' + (_jishiPage+1) + '</span> / ' + pages + ' \u00B7 \u5171 <span class="n">' + filtered.length + '</span> \u6761</span>';
      h += '<button class="ji-pg-btn" ' + (_jishiPage>=pages-1?'disabled':'') + ' onclick="_jishiPage++;renderJishi();">\u203A</button>';
      h += '</div>';
    }
  }
  el.innerHTML = h;
  try { if (typeof decoratePendingInDom === 'function') decoratePendingInDom(el); } catch(_){}
}

/** 渲染单条纪事记录 · v2 */
function _jishiRenderRecord(r) {
  var src = _jishiSource(r);
  var _ridx = (GM.jishiRecords||[]).indexOf(r);
  var imp = _jishiImportance(r);
  var mood = _jishiMood(r);
  var isPrivate = r.mode === 'private';
  var isGroup = ['changchao','yuqian','tinyi','tingyi','keyi','jingyan'].indexOf(r.mode) >= 0;

  // 议题提取：从 playerSaid 的 【xxx·议题】或 topic 字段
  var topic = r.topic || '';
  if (!topic && r.playerSaid) {
    var tm = r.playerSaid.match(/\u3010([^\u3011]+)\u3011/);
    if (tm) topic = tm[1];
  }

  // cls 组合
  var cls = 'ji-record src-' + src.key;
  if (r._starred) cls += ' starred';
  if (isPrivate) cls += ' private';
  if (imp === 'major') cls += ' major';

  var h = '<div class="' + cls + '">';

  // ── head ──
  h += '<div class="ji-rec-head">';
  h += '<span class="ji-src-badge"><span class="ic">' + src.icon + '</span><span class="nm">' + src.label + '</span></span>';
  if (imp === 'major') h += '<span class="ji-importance major">\u5927\u3000\u4E8B</span>';
  else if (imp === 'minor') h += '<span class="ji-importance minor">\u95F2\u3000\u4E8B</span>';
  else h += '<span class="ji-importance normal">\u5E38\u3000\u4E8B</span>';
  // 人物 + 头衔
  var charNm = r.char || '';
  var charTitle = _jishiCharTitle(charNm);
  h += '<span class="ji-rec-char">' + escHtml(charNm);
  if (charTitle) h += '<span class="title">\u00B7' + escHtml(charTitle) + '</span>';
  h += '</span>';
  if (isPrivate) h += '<span class="ji-private-mark">\u79C1\u4E0B</span>';
  if (mood) {
    var moodLabels = {harmonic:'\u8083\u7A46', tense:'\u7D27\u5F20', hostile:'\u6FC0\u8FA9', solemn:'\u5E84\u91CD'};
    h += '<span class="ji-mood ' + mood + '">' + (moodLabels[mood] || mood) + '</span>';
  }
  var dt = r.date || (typeof getTSText==='function' ? getTSText(r.turn) : '');
  if (dt) h += '<span class="ji-rec-time">' + escHtml(dt) + '</span>';
  h += '<button class="ji-star-toggle' + (r._starred?' on':'') + '" onclick="_jishiStar(' + _ridx + ')" title="' + (r._starred?'\u53D6\u6D88\u661F\u6807':'\u661F\u6807') + '">' + (r._starred?'\u2605':'\u2606') + '</button>';
  h += '</div>';

  // ── topic ──
  if (topic) h += '<div class="ji-topic">' + escHtml(topic) + '</div>';

  // ── attendees（若是朝议且 r.attendees 存在） ──
  if (isGroup && Array.isArray(r.attendees) && r.attendees.length > 0) {
    h += '<div class="ji-attendees"><span class="lbl">\u4E0E\u8BAE\uFF1A</span>';
    r.attendees.slice(0,8).forEach(function(a){
      var nm = typeof a === 'string' ? a : (a.name || '');
      var stance = typeof a === 'object' && a.stance ? a.stance : '';
      var stCls = stance === 'pos' || stance === 'for' ? ' pos' : stance === 'neg' || stance === 'against' ? ' neg' : stance ? ' neu' : '';
      h += '<span class="ji-atd-chip' + stCls + '">';
      if (stance) h += '<span class="dot"></span>';
      h += escHtml(nm);
      h += '</span>';
    });
    h += '</div>';
  }

  // ── dialog ──
  h += '<div class="ji-dialog">';
  // 玩家言
  if (r.playerSaid) {
    var ps = r.playerSaid;
    // 剥除【xxx·】前缀（已显示为 topic）
    if (topic) ps = ps.replace(/^\u3010[^\u3011]+\u3011/, '').trim();
    if (ps) {
      if (/^\uFF08|^\u300A/.test(ps) || ps.length < 10 && /\u8BB0|\u62A5|\u5F55/.test(src.label)) {
        h += '<div class="ji-line ji-line-nar">' + escHtml(ps) + '</div>';
      } else {
        h += '<div class="ji-line ji-line-player">' + escHtml(ps) + '</div>';
      }
    }
  }
  // NPC 言
  if (r.npcSaid) {
    // 群议场景显示 speaker 角标
    if (isGroup && r.char && r.char !== '\u7687\u5E1D') {
      h += '<div class="ji-line-speaker">' + escHtml(r.char) + (charTitle?'\u00B7'+escHtml(charTitle):'') + '</div>';
    }
    // 密报/杂录：叙述体
    if (src.key === 'mibao' || src.key === 'record') {
      h += '<div class="ji-line ji-line-nar">' + escHtml(r.npcSaid) + '</div>';
    } else {
      h += '<div class="ji-line ji-line-npc">' + escHtml(r.npcSaid) + '</div>';
    }
  }
  h += '</div>';

  // ── outcome（决议/朱批/留中/颁诏） ──
  if (r.outcome || r.finalRuling || r.decree || r.approval) {
    var outTxt = r.outcome || r.finalRuling || r.decree || r.approval;
    var outCls = r.final ? ' decision' : (src.key === 'memo' || src.key === 'kangshu') ? '' : '';
    if (r.decree) outCls = ' decree';
    if (r.held || /\u7559\u4E2D|\u6682\u641C/.test(String(outTxt))) outCls = ' delay';
    h += '<div class="ji-outcome' + outCls + '">' + escHtml(outTxt) + '</div>';
  }

  // ── delta 变化 ──
  var deltas = [];
  if (typeof r.loyaltyDelta === 'number' && r.loyaltyDelta !== 0) {
    deltas.push({cls: r.loyaltyDelta > 0 ? 'up' : 'dn', txt: escHtml(r.char||'') + ' \u00B7 \u5FE0 ' + (r.loyaltyDelta > 0 ? '+' : '') + r.loyaltyDelta});
  }
  if (r.relationDelta) {
    deltas.push({cls: 'mid', txt: '\u5173\u7CFB ' + escHtml(String(r.relationDelta))});
  }
  if (r.stressDelta && r.stressDelta > 0) {
    deltas.push({cls: 'dn', txt: '\u538B\u529B +' + r.stressDelta});
  }
  if (Array.isArray(r.deltas)) {
    r.deltas.forEach(function(d){ deltas.push({cls: d.cls || 'mid', txt: escHtml(d.txt||'')}); });
  }
  if (deltas.length > 0) {
    h += '<div class="ji-delta"><span class="ji-delta-lbl">\u53D8 \u52A8</span>';
    deltas.forEach(function(d){ h += '<span class="ji-delta-item ' + d.cls + '">' + d.txt + '</span>'; });
    h += '</div>';
  }

  h += '</div>';
  return h;
}

/** 标记/取消标记 */
function _jishiStar(idx) {
  if (idx < 0 || !GM.jishiRecords || !GM.jishiRecords[idx]) return;
  GM.jishiRecords[idx]._starred = !GM.jishiRecords[idx]._starred;
  renderJishi();
}

/** 切换只看标记 */
function _jishiToggleStarred() {
  _jishiStarredOnly = !_jishiStarredOnly;
  var btn = _$('js-star-toggle');
  if (btn) btn.textContent = _jishiStarredOnly ? '\u2605' : '\u2606';
  _jishiPage = 0;
  renderJishi();
}

function _jishiExport(){
  var txt=(GM.jishiRecords||[]).map(function(r){
    var src = _jishiSource(r);
    var star = r._starred ? ' \u2605' : '';
    return '[T'+(r.turn||'')+'] '+(r.char||'')+' ['+src.label.replace(/\s/g,'')+']'+star+'\n\u4E0A: '+(r.playerSaid||'')+'\n'+(r.char||'')+': '+(r.npcSaid||'');
  }).join('\n\n---\n\n');
  if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(txt).then(function(){toast('\u5DF2\u590D\u5236');}).catch(function(){_jishiDownload(txt);});}
  else _jishiDownload(txt);
}
function _jishiDownload(txt){
  var a=document.createElement('a');a.href='data:text/plain;charset=utf-8,'+encodeURIComponent(txt);
  a.download='jishi_'+(GM.saveName||'export')+'.txt';a.click();toast('\u5DF2\u5BFC\u51FA');
}

