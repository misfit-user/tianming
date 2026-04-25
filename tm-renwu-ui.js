// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// tm-renwu-ui.js — 人物志 UI（§F 渲染层）
//
// R98 从 tm-endturn.js 抽出·原 L13351-14237 (887 行)
// 单次最大拆分·9 函数：
//   主：renderRenwu (~110 行) / viewRenwu (~546 行·人物详情弹窗)
//   辅助 _rw*：_rwFacClass / _rwFacChipStyle / _rwRankChip /
//            _rwLoyRing / _rwStatRow / _rwWcDot / _rwRenderCard
//   状态：var _rwSearch/_rwFaction/_rwRole/_rwSort/_rwShowDead
//
// 外部调用：renderRenwu 被 4 文件调用
//         (tm-audio-theme/tm-char-autogen/tm-game-engine/tm-index-world)
// 依赖外部：GM / P / _$ / toast / openGenericModal 等 window 全局
//
// 加载顺序：必须在 tm-endturn.js 之前
// ============================================================

// ============================================================
//  人物志
// ============================================================
var _rwSearch='',_rwFaction='all',_rwRole='all',_rwSort='loyalty',_rwShowDead=false;

function renderRenwu(){
  var el=_$("rw-grid");var cnt=_$("rw-cnt");if(!el)return;
  var _sbar=_$("rw-statbar"), _leg=_$("rw-legend");

  // 填充派系下拉（首次）
  var _facSel = _$('rw-faction');
  if (_facSel && _facSel.options.length <= 1 && GM.facs) {
    GM.facs.forEach(function(f) {
      var opt = document.createElement('option');
      opt.value = f.name; opt.textContent = f.name;
      _facSel.appendChild(opt);
    });
  }

  var _all = (GM.chars||[]).slice();
  (GM.allCharacters||[]).forEach(function(ac) {
    if (!_all.find(function(c){return c.name===ac.name;})) _all.push(ac);
  });
  _all.forEach(function(c) {
    if (c.alive !== false && c.alive !== true) c.alive = true;
  });

  // 统计数据
  var _stat = { all: 0, civil: 0, mili: 0, harem: 0, bu: 0, dead: 0 };
  _all.forEach(function(c) {
    if (c.alive === false) { _stat.dead++; return; }
    if (c.spouse) _stat.harem++;
    else if (c.officialTitle || c.title) {
      _stat.all++;
      if ((c.military||0) >= (c.administration||0) && (c.military||0) >= 40) _stat.mili++;
      else _stat.civil++;
    } else {
      _stat.bu++;
    }
  });
  if (_sbar) {
    _sbar.innerHTML = ''
      + '<div class="rw-stat-card s-all"><div class="rw-stat-lbl">\u5728 \u671D \u7FA4 \u81E3</div><div class="rw-stat-num">'+_stat.all+'</div><div class="rw-stat-sub">\u5458</div></div>'
      + '<div class="rw-stat-card s-civil"><div class="rw-stat-lbl">\u6587 \u81E3</div><div class="rw-stat-num">'+_stat.civil+'</div><div class="rw-stat-sub">\u6587\u5B98</div></div>'
      + '<div class="rw-stat-card s-mili"><div class="rw-stat-lbl">\u6B66 \u5C06</div><div class="rw-stat-num">'+_stat.mili+'</div><div class="rw-stat-sub">\u5C06\u9886</div></div>'
      + '<div class="rw-stat-card s-harem"><div class="rw-stat-lbl">\u540E \u5BAB</div><div class="rw-stat-num">'+_stat.harem+'</div><div class="rw-stat-sub">\u5AD4\u59C3</div></div>'
      + '<div class="rw-stat-card s-bu"><div class="rw-stat-lbl">\u5E03 \u8863</div><div class="rw-stat-num">'+_stat.bu+'</div><div class="rw-stat-sub">\u8349\u83BD</div></div>'
      + '<div class="rw-stat-card s-dead"><div class="rw-stat-lbl">\u5DF2 \u6B81</div><div class="rw-stat-num">'+_stat.dead+'</div><div class="rw-stat-sub">\u5352</div></div>';
  }

  var filtered = _all;
  if (!_rwShowDead) filtered = filtered.filter(function(c) { return c.alive !== false; });
  if (_rwSearch) {
    var kw = _rwSearch.toLowerCase();
    filtered = filtered.filter(function(c) { return (c.name||'').toLowerCase().indexOf(kw)>=0 || (c.officialTitle||c.title||'').toLowerCase().indexOf(kw)>=0 || (c.faction||'').toLowerCase().indexOf(kw)>=0; });
  }
  if (_rwFaction !== 'all') filtered = filtered.filter(function(c) { return c.faction === _rwFaction; });
  if (_rwRole !== 'all') {
    filtered = filtered.filter(function(c) {
      if (_rwRole === 'civil') return (c.administration||0) > (c.military||0) && !c.spouse;
      if (_rwRole === 'military') return (c.military||0) >= (c.administration||0) && !c.spouse;
      if (_rwRole === 'harem') return c.spouse;
      if (_rwRole === 'none') return !c.officialTitle && !c.spouse;
      return true;
    });
  }

  filtered.sort(function(a,b) {
    if (a.alive === false && b.alive !== false) return 1;
    if (a.alive !== false && b.alive === false) return -1;
    if (a.isPlayer && !b.isPlayer) return -1;
    if (!a.isPlayer && b.isPlayer) return 1;
    var va = (a[_rwSort]||50), vb = (b[_rwSort]||50);
    return vb - va;
  });

  if(cnt)cnt.textContent=filtered.length + '/' + _all.length;

  // 派系 Legend
  if (_leg) {
    var _facCounts = {};
    filtered.forEach(function(c) {
      var fk = c.faction || '\u65E0\u6D3E\u7CFB';
      _facCounts[fk] = (_facCounts[fk]||0) + 1;
    });
    var _fkeys = Object.keys(_facCounts).sort(function(a,b){return _facCounts[b]-_facCounts[a];});
    var _lhtml = '<span class="rw-legend-lbl">\u6D3E \u7CFB</span>';
    _fkeys.slice(0,10).forEach(function(fk) {
      var _st = _rwFacChipStyle(fk);
      _lhtml += '<span class="rw-legend-chip" style="'+_st+'">'+escHtml(fk)+'<span class="num">\u00B7'+_facCounts[fk]+'</span></span>';
    });
    _leg.innerHTML = _lhtml;
  }

  // 按派系分组
  var _facGroups = {};
  filtered.forEach(function(c) { var fk = c.faction || '\u65E0\u6D3E\u7CFB'; if (!_facGroups[fk]) _facGroups[fk] = []; _facGroups[fk].push(c); });
  var _facKeys = Object.keys(_facGroups);
  var _playerFac = (P.playerInfo && P.playerInfo.factionName) || '';
  _facKeys.sort(function(a,b) { if (a === _playerFac) return -1; if (b === _playerFac) return 1; return _facGroups[b].length - _facGroups[a].length; });

  var html = '';
  var _useGroups = _facKeys.length > 1 && _rwFaction === 'all';

  if (_useGroups) {
    _facKeys.forEach(function(fk) {
      var chars = _facGroups[fk];
      var _st = _rwFacChipStyle(fk);
      html += '<div class="rw-fac-group-hdr" style="'+_st+';--fac-c:var(--chip-c,var(--gold-400));">'+escHtml(fk)+' <span class="cnt">'+chars.length+' \u4EBA</span></div>';
      chars.forEach(function(c) { html += _rwRenderCard(c); });
    });
  } else {
    filtered.forEach(function(c) { html += _rwRenderCard(c); });
  }

  el.innerHTML = html || '<div class="rw-empty">\u671D \u91CE \u5BC2 \u5BC2\u3000\u65E0 \u5339 \u914D \u4E4B \u4EBA<br>\u8BD5\u8C03\u62AB\u89C8\u6216\u653E\u5BBD\u7B5B\u9009</div>';
}

/** 派系→CSS 类 */
function _rwFacClass(c) {
  if (c.spouse) return 'rw-consort';
  var fac = c.faction || '';
  if (fac.indexOf('\u4E1C\u6797') >= 0 || fac.indexOf('\u590D\u793E') >= 0) return 'rw-dongin';
  if (fac.indexOf('\u6D59') >= 0) return 'rw-zhe';
  if (fac.indexOf('\u5BA6') >= 0 || fac.indexOf('\u9609') >= 0 || fac.indexOf('\u5185\u5EF7') >= 0) return 'rw-yan';
  if (fac.indexOf('\u6606') >= 0 || fac.indexOf('\u9F50') >= 0 || fac.indexOf('\u695A') >= 0) return 'rw-kun';
  if (fac.indexOf('\u6E05\u6D41') >= 0 || fac.indexOf('\u6B63\u5B66') >= 0) return 'rw-qing';
  if (!c.officialTitle && !c.title && !c.spouse) return 'rw-bu';
  if ((c.military || 0) >= 60 && (c.military || 0) >= (c.administration || 0)) return 'rw-mili';
  return '';
}

/** 派系→chip style 变量 */
function _rwFacChipStyle(fkName) {
  if (fkName.indexOf('\u4E1C\u6797') >= 0 || fkName.indexOf('\u590D\u793E') >= 0) return '--chip-c:var(--celadon-400);--chip-rgb:106,154,127';
  if (fkName.indexOf('\u6D59') >= 0) return '--chip-c:var(--indigo-400,#5a6fa8);--chip-rgb:90,111,168';
  if (fkName.indexOf('\u5BA6') >= 0 || fkName.indexOf('\u9609') >= 0 || fkName.indexOf('\u5185\u5EF7') >= 0) return '--chip-c:var(--purple-400,#8e6aa8);--chip-rgb:142,106,168';
  if (fkName.indexOf('\u6606') >= 0 || fkName.indexOf('\u9F50') >= 0 || fkName.indexOf('\u695A') >= 0) return '--chip-c:var(--amber-400,#c9a045);--chip-rgb:201,160,69';
  if (fkName.indexOf('\u6E05\u6D41') >= 0 || fkName.indexOf('\u6B63\u5B66') >= 0) return '--chip-c:var(--gold-400);--chip-rgb:184,154,83';
  if (fkName.indexOf('\u65E0') >= 0 || fkName.indexOf('\u5E03\u8863') >= 0) return '--chip-c:var(--ink-500);--chip-rgb:166,148,112';
  return '';
}

/** 品级→徽章 */
function _rwRankChip(c) {
  var _level = 99, _lbl = '';
  if (c.rank) {
    _lbl = c.rank;
    if (typeof getRankLevel === 'function') _level = getRankLevel(c.rank);
  } else if (c.officialTitle || c.title) {
    if (typeof getRankLevel === 'function') _level = getRankLevel(c.officialTitle||c.title);
  }
  if (!_lbl && _level < 99 && typeof RANK_HIERARCHY !== 'undefined' && RANK_HIERARCHY) {
    for (var i = 0; i < RANK_HIERARCHY.length; i++) {
      if (RANK_HIERARCHY[i].level === _level) { _lbl = RANK_HIERARCHY[i].label; break; }
    }
  }
  if (!_lbl) return '';
  var _cls = 'rw-rank-low';
  if (_level <= 3) _cls = 'rw-rank-top';
  else if (_level <= 8) _cls = 'rw-rank-high';
  else if (_level <= 14) _cls = 'rw-rank-mid';
  return '<span class="rw-rank-chip '+_cls+'">'+escHtml(_lbl)+'</span>';
}

/** 忠诚 SVG 环 */
function _rwLoyRing(val) {
  var _v = Math.max(0, Math.min(100, val));
  var _c = 2 * Math.PI * 22;
  var _off = _c * (1 - _v / 100);
  var _cls = _v >= 70 ? 'rw-loy-hi' : _v >= 40 ? 'rw-loy-mid' : 'rw-loy-lo';
  return '<div class="rw-loy-ring '+_cls+'"><svg viewBox="0 0 54 54">'
    + '<circle class="bg" cx="27" cy="27" r="22" fill="none" stroke-width="3"/>'
    + '<circle class="fg" cx="27" cy="27" r="22" fill="none" stroke-width="3" stroke-dasharray="'+_c.toFixed(2)+'" stroke-dashoffset="'+_off.toFixed(2)+'"/>'
    + '</svg>'
    + '<div class="val"><div class="n">'+Math.round(_v)+'</div><div class="k">\u5FE0</div></div>'
    + '</div>';
}

/** 单条属性条 */
function _rwStatRow(kk, cls, v) {
  var _v = Math.max(0, Math.min(100, v||0));
  return '<div class="rw-stat '+cls+'">'
    + '<span class="rw-stat-k">'+kk+'</span>'
    + '<span class="rw-stat-bar"><span class="rw-stat-fill" style="width:'+_v+'%"></span></span>'
    + '<span class="rw-stat-v">'+Math.round(_v)+'</span>'
    + '</div>';
}

/** 五常 dot */
function _rwWcDot(k, v) {
  var lv = 'none';
  if (v != null) {
    if (v >= 60) lv = 'hi';
    else if (v >= 30) lv = 'mid';
    else lv = 'lo';
  }
  return '<span class="rw-wc-dot '+lv+'" title="'+k+' '+(v!=null?Math.round(v):'?')+'">'+k+'</span>';
}

/** 渲染单个人物卡片 */
function _rwRenderCard(c) {
  var _isDead = c.alive === false;
  var _isPlayer = !!c.isPlayer;
  var _ch = (typeof findCharByName === 'function') ? findCharByName(c.name) : c;
  if (!_ch) _ch = c;
  var _playerLoc = (typeof _getPlayerLocation === 'function') ? _getPlayerLocation() : (GM._capital||'\u4EAC\u57CE');

  var _facCls = _rwFacClass(_ch);
  var _cardCls = 'rw-card' + (_facCls?' '+_facCls:'');
  if (_isDead) _cardCls += ' dead';
  if (_isPlayer) _cardCls += ' player';

  // 立轴头像 + 忠诚环
  var _portraitInner = _ch.portrait ? '<img src="'+escHtml(_ch.portrait)+'" alt="">' : escHtml((c.name||'').charAt(0));
  var _loy = _ch.loyalty != null ? _ch.loyalty : 50;
  var _loyRing = _rwLoyRing(_loy);

  // 姓名行
  var _nameRow = '<span class="rw-name">'+escHtml(c.name||'')+'</span>';
  if (_ch.zi) _nameRow += '<span class="rw-zi">\u5B57 '+escHtml(_ch.zi)+'</span>';
  else if (_ch.courtesy) _nameRow += '<span class="rw-zi">\u5B57 '+escHtml(_ch.courtesy)+'</span>';
  if (_ch.age) _nameRow += '<span class="rw-age">'+(_ch.age|0)+'\u5C81</span>';

  // 官职行
  var _offRow = '';
  if (_ch.officialTitle) _offRow += '<span class="rw-pos">'+escHtml(_ch.officialTitle)+'</span>';
  else if (_ch.title) _offRow += '<span class="rw-pos">'+escHtml(_ch.title)+'</span>';
  else if (_ch.role) _offRow += '<span class="rw-pos" style="color:#d4c9b0;">'+escHtml(_ch.role)+'</span>';
  else if (_ch.occupation) _offRow += '<span class="rw-pos" style="color:#d4c9b0;">'+escHtml(_ch.occupation)+'</span>';
  else if (_ch.spouse) _offRow += '<span class="rw-pos" style="color:var(--vermillion-300,#d15c47);">\u540E\u5BAB</span>';
  else _offRow += '<span class="rw-pos" style="color:#d4c9b0;">\u5E03\u8863</span>';
  _offRow += _rwRankChip(_ch);
  if (_ch.faction) _offRow += '<span class="rw-fac-chip">'+escHtml(_ch.faction)+'</span>';

  // 位置 + 状态
  var _stateHtml = '';
  if (_ch.location) {
    var _awayCls = (_ch.location !== _playerLoc && !_isDead) ? ' away' : '';
    var _locInner = escHtml(_ch.location);
    if (_ch._travelTo && _ch._travelTo.toLocation) {
      _locInner += '<span class="travel">\u2192</span>' + escHtml(_ch._travelTo.toLocation);
    }
    _stateHtml += '<span class="rw-loc'+_awayCls+'">'+_locInner+'</span>';
  }
  if (_ch._mourning) _stateHtml += '<span class="rw-state-chip mourn">\u4E01\u5FE7</span>';
  if (_ch._retired) _stateHtml += '<span class="rw-state-chip retired">\u81F4\u4ED5</span>';
  if ((_ch.stress||0) > 70) _stateHtml += '<span class="rw-state-chip stress">\u91CD\u538B</span>';
  if (_ch._travelTo) _stateHtml += '<span class="rw-state-chip away">\u8D74\u4EFB</span>';
  if (_ch._scheming) _stateHtml += '<span class="rw-state-chip scheme">\u5BC6\u8C0B</span>';
  if (_ch.joinTurn && GM.turn && (GM.turn - _ch.joinTurn) < 5) _stateHtml += '<span class="rw-state-chip new">\u65B0\u664B</span>';
  else if (_ch.age && _ch.age >= 60) _stateHtml += '<span class="rw-state-chip veteran">\u8001\u6210</span>';

  // 属性 6 条
  var _statsHtml = ''
    + _rwStatRow('\u667A', 'zhi', _ch.intelligence)
    + _rwStatRow('\u653F', 'zheng', _ch.administration)
    + _rwStatRow('\u519B', 'jun', _ch.military)
    + _rwStatRow('\u4EA4', 'jiao', _ch.diplomacy)
    + _rwStatRow('\u62B1', 'ye', _ch.ambition)
    + _rwStatRow('\u538B', 'ya', _ch.stress);

  // 五常
  var _wc = _ch.wuchang || {};
  var _wcHtml = _rwWcDot('\u4EC1', _wc['\u4EC1'])
    + _rwWcDot('\u4E49', _wc['\u4E49'])
    + _rwWcDot('\u793C', _wc['\u793C'])
    + _rwWcDot('\u667A', _wc['\u667A'])
    + _rwWcDot('\u4FE1', _wc['\u4FE1']);

  // 名望/贤能/廉
  var _repHtml = '';
  var _ming = _ch.mingwang != null ? _ch.mingwang : (_ch.reputation != null ? _ch.reputation : null);
  var _xian = _ch.xianneng != null ? _ch.xianneng : null;
  if (_ming != null) _repHtml += '<span class="rw-rep-item ming"><span class="k">\u540D\u671B</span><span class="v">'+Math.round(_ming)+'</span></span>';
  if (_xian != null) _repHtml += '<span class="rw-rep-item xian"><span class="k">\u8D24\u80FD</span><span class="v">'+Math.round(_xian)+'</span></span>';
  if (_ch.integrity != null) _repHtml += '<span class="rw-rep-item"><span class="k">\u5EC9</span><span class="v">'+Math.round(_ch.integrity)+'</span></span>';

  // 特质
  var _traitsHtml = '';
  if (Array.isArray(_ch.traits) && _ch.traits.length) {
    _ch.traits.slice(0, 4).forEach(function(t) {
      var _tid = typeof t === 'string' ? t : (t && (t.id || t.name) || '');
      var _tname = _tid, _tcls = 'neu';
      if (typeof TRAIT_LIBRARY !== 'undefined' && TRAIT_LIBRARY[_tid]) {
        var _t = TRAIT_LIBRARY[_tid];
        _tname = _t.name || _tid;
        var _sum = 0;
        if (_t.effects) { Object.keys(_t.effects).forEach(function(k){ _sum += (_t.effects[k]||0); }); }
        if (_sum >= 3) _tcls = 'pos';
        else if (_sum <= -3) _tcls = 'neg';
      }
      _traitsHtml += '<span class="rw-trait-chip '+_tcls+'">'+escHtml(_tname)+'</span>';
    });
  }

  // 关系 (top 3)
  var _relsHtml = '';
  if (_ch._relationships) {
    var _relList = [];
    Object.keys(_ch._relationships).forEach(function(oname) {
      var rels = _ch._relationships[oname];
      if (!rels || !rels.length) return;
      rels.forEach(function(r) {
        _relList.push({ name: oname, type: r.type||'friend', strength: Math.abs(r.strength||0), raw: r.strength||0 });
      });
    });
    _relList.sort(function(a,b){return b.strength-a.strength;});
    _relList.slice(0, 3).forEach(function(r) {
      var _rcls = 'friend';
      if (r.type === 'foe' || r.type === 'rival' || r.type === 'enemy' || r.raw < -30) _rcls = 'foe';
      else if (r.type === 'spouse' || r.type === 'lover') _rcls = 'spouse';
      _relsHtml += '<span class="rw-rel-chip '+_rcls+'">'+escHtml(r.name.slice(0,4))+'</span>';
    });
  }

  // 操作按钮
  var _nameArg = "'" + (c.name||'').replace(/'/g,"\\'") + "'";
  var _actionsHtml = '';
  if (!_isDead && !_isPlayer) {
    var _capRW = GM._capital || '\u4EAC\u5E08';
    var _locRW = (c.location || '').replace(/\s/g,'');
    var _atCapRW = !_locRW || _locRW === _capRW || _locRW.indexOf(_capRW) >= 0 || /\u4EAC|\u4EAC\u57CE|\u4EAC\u5E08|\u5317\u4EAC/.test(_locRW);
    var _enRouteRW = !!(c._travelTo || c._enRouteToOffice);
    if (_atCapRW && !_enRouteRW && typeof openWenduiPick === 'function') {
      _actionsHtml += '<button class="rw-btn" onclick="event.stopPropagation();openWenduiPick('+_nameArg+');">\u95EE\u5BF9</button>';
    } else if (!_enRouteRW || _locRW) {
      _actionsHtml += '<button class="rw-btn" onclick="event.stopPropagation();GM._pendingLetterTo='+_nameArg+';switchGTab(null,\'gt-letter\');">\u4F20\u4E66</button>';
    }
  }
  _actionsHtml += '<button class="rw-btn primary" onclick="event.stopPropagation();(typeof openCharRenwuPage===\'function\'?openCharRenwuPage:viewRenwu)('+_nameArg+');">'+(_isDead?'\u9057\u4E8B':'\u8BE6\u60C5')+'</button>';

  var _clickCall = '(typeof openCharRenwuPage===\'function\'?openCharRenwuPage:viewRenwu)(' + _nameArg + ')';

  return '<div class="'+_cardCls+'" onclick="'+_clickCall+'">'
    + '<div class="rw-portrait-col">'
    + '<div class="rw-portrait">'+_portraitInner+'</div>'
    + _loyRing
    + '</div>'
    + '<div class="rw-info-col">'
    + '<div class="rw-name-row">'+_nameRow+'</div>'
    + '<div class="rw-office-row">'+_offRow+'</div>'
    + (_stateHtml ? '<div class="rw-states">'+_stateHtml+'</div>' : '')
    + '<div class="rw-stats">'+_statsHtml+'</div>'
    + '<div class="rw-wuchang"><span class="lbl">\u4E94\u5E38</span>'+_wcHtml+'</div>'
    + (_repHtml ? '<div class="rw-rep">'+_repHtml+'</div>' : '')
    + (_traitsHtml ? '<div class="rw-traits">'+_traitsHtml+'</div>' : '')
    + (_relsHtml ? '<div class="rw-rels">'+_relsHtml+'</div>' : '')
    + '<div class="rw-actions">'+_actionsHtml+'</div>'
    + '</div>'
    + '</div>';
}
function viewRenwu(i){
  var ch;
  if(typeof i === 'string'){
    // 按名字查找
    ch = (GM.chars||[]).find(function(c){return c.name===i;}) || (GM.allCharacters||[]).find(function(c){return c.name===i;});
  } else {
    ch = (GM.allCharacters||GM.chars||[])[i];
  }
  if(!ch) return;

  // 有效属性（含特质加成）
  var effInt = typeof getEffectiveAttr==='function' ? getEffectiveAttr(ch,'intelligence') : (ch.intelligence||0);
  var effVal = typeof getEffectiveAttr==='function' ? getEffectiveAttr(ch,'valor') : (ch.valor||0);
  var effAdm = typeof getEffectiveAttr==='function' ? getEffectiveAttr(ch,'administration') : (ch.administration||0);
  var effMng = typeof getEffectiveAttr==='function' ? getEffectiveAttr(ch,'management') : (ch.management||0);
  var effCha = typeof getEffectiveAttr==='function' ? getEffectiveAttr(ch,'charisma') : (ch.charisma||0);
  var effDip = typeof getEffectiveAttr==='function' ? getEffectiveAttr(ch,'diplomacy') : (ch.diplomacy||0);
  var effMil = typeof getEffectiveAttr==='function' ? getEffectiveAttr(ch,'military') : (ch.military||0);
  var effBen = typeof getEffectiveAttr==='function' ? getEffectiveAttr(ch,'benevolence') : (ch.benevolence||0);

  var html = '<div style="max-width:600px;margin:auto;">';

  // 头部：名字+称号+阵营
  var _isPlayerChar = ch.isPlayer || (P.playerInfo && P.playerInfo.characterName === ch.name);
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.8rem;">';
  html += '<div><span style="font-size:1.3rem;font-weight:700;color:var(--gold);">' + escHtml(ch.name) + '</span>';
  if(ch.title) html += ' <span style="color:var(--txt-s);font-size:0.85rem;">' + escHtml(ch.title) + '</span>';
  html += '</div>';
  if(ch.faction) html += '<span style="font-size:0.78rem;padding:0.15rem 0.5rem;background:var(--bg-3);border-radius:10px;color:var(--blue);">' + escHtml(ch.faction) + '</span>';
  html += '</div>';

  // ── 快捷操作栏 ──
  if (!_isPlayerChar && ch.alive !== false) {
    html += '<div style="display:flex;gap:var(--space-1);margin-bottom:0.6rem;flex-wrap:wrap;">';
    var _safeName = escHtml(ch.name).replace(/'/g, "\\'");
    var _capDV = GM._capital || '\u4EAC\u5E08';
    var _locDV = (ch.location || '').replace(/\s/g,'');
    var _atCapDV = !_locDV || _locDV === _capDV || _locDV.indexOf(_capDV) >= 0 || /\u4EAC|\u4EAC\u57CE|\u4EAC\u5E08|\u5317\u4EAC/.test(_locDV);
    var _enRouteDV = !!(ch._travelTo || ch._enRouteToOffice);
    if (_atCapDV && !_enRouteDV) {
      html += '<button class="bt bsm" style="font-size:0.7rem;" onclick="GM.wenduiTarget=\'' + _safeName + '\';switchGTab(null,\'gt-wendui\');">\u95EE\u5BF9</button>';
    } else {
      html += '<button class="bt bsm" style="font-size:0.7rem;" onclick="GM._pendingLetterTo=\'' + _safeName + '\';switchGTab(null,\'gt-letter\');">\u4F20\u4E66</button>';
    }
    html += '<button class="bt bsm" style="font-size:0.7rem;" onclick="switchGTab(null,\'gt-office\');">\u5B98\u5236</button>';
    html += '</div>';
  }
  if (ch.alive === false) {
    html += '<div style="font-size:0.8rem;color:var(--vermillion-400);margin-bottom:0.6rem;padding:0.3rem 0.6rem;background:rgba(231,76,60,0.1);border-radius:4px;">\u5DF2\u6545' + (ch.deathReason ? '\uFF1A' + escHtml(ch.deathReason) : '') + (ch.deathTurn ? ' (T' + ch.deathTurn + ')' : '') + '</div>';
  }

  // ── 身份档案（基本信息上移） ──
  var _idTags = [];
  if (ch.age) _idTags.push({ l: '\u5E74\u9F84', v: ch.age + '\u5C81' });
  if (ch.gender) _idTags.push({ l: '\u6027\u522B', v: ch.gender });
  if (ch.birthplace) _idTags.push({ l: '\u7C4D\u8D2F', v: ch.birthplace });
  if (ch.ethnicity) _idTags.push({ l: '\u6C11\u65CF', v: ch.ethnicity });
  if (ch.faith) _idTags.push({ l: '\u4FE1\u4EF0', v: ch.faith });
  if (ch.culture) _idTags.push({ l: '\u6587\u5316', v: ch.culture });
  if (ch.learning) _idTags.push({ l: '\u5B66\u8BC6', v: ch.learning });
  if (ch.stance) _idTags.push({ l: '\u7ACB\u573A', v: ch.stance });
  if (ch.party) _idTags.push({ l: '\u515A\u6D3E', v: ch.party + (ch.partyRank ? '(' + ch.partyRank + ')' : '') });
  if (ch.speechStyle) _idTags.push({ l: '\u8BED\u98CE', v: ch.speechStyle });
  if (ch.family) _idTags.push({ l: '\u5BB6\u65CF', v: ch.family + ({imperial:'\u7687\u65CF',noble:'\u4E16\u5BB6',gentry:'\u58EB\u65CF',common:'\u5BD2\u95E8'}[ch.familyTier]||'') });
  if (_idTags.length > 0) {
    html += '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:0.6rem;">';
    _idTags.forEach(function(t) {
      html += '<span style="font-size:0.65rem;padding:1px 6px;background:var(--color-elevated);border:1px solid var(--color-border-subtle);border-radius:3px;color:var(--color-foreground-secondary);">' + t.l + '\uFF1A' + escHtml(t.v) + '</span>';
    });
    html += '</div>';
  }

  // 官制信息+仕途（嵌入人物志详情页）
  if (typeof _offRenderCareerHTML === 'function' && !_isPlayerChar) {
    var _careerHtml = _offRenderCareerHTML(ch.name);
    if (_careerHtml) {
      html += '<div style="margin-bottom:0.8rem;padding:0.5rem;background:var(--color-elevated);border-radius:6px;border:1px solid var(--color-border-subtle);">';
      html += '<div style="font-size:0.78rem;color:var(--gold-400);font-weight:700;margin-bottom:0.3rem;letter-spacing:0.08em;">\u5B98\u5236\u4E0E\u4ED5\u9014</div>';
      html += _careerHtml;
      html += '</div>';
    }
  }

  // 双重身份概览（所有角色通用——公职身份+私人身份）
  (function() {
    // 公职身份
    var _pubRole = ch.officialTitle || ch.title || '';
    var _pubFaction = ch.faction || '';
    // 判断是否势力领袖
    var _isLeader = false;
    if (GM.facs) _isLeader = GM.facs.some(function(f) { return f.leader === ch.name; });
    if (_isPlayerChar) {
      var _sc3 = findScenarioById && findScenarioById(GM.sid);
      _pubRole = (_sc3 ? _sc3.role || '' : '') || _pubRole;
      if (P.playerInfo && P.playerInfo.factionName) _pubFaction = P.playerInfo.factionName + '\u4E4B\u4E3B';
      else if (_isLeader) _pubFaction += '\u4E4B\u4E3B';
    } else if (_isLeader) {
      _pubFaction += '\u4E4B\u4E3B';
    }
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-bottom:0.8rem;">';
    html += '<div style="padding:0.5rem;background:var(--bg-3);border-radius:6px;border-left:3px solid var(--gold-d);">';
    html += '<div style="font-size:0.7rem;color:var(--gold-d);letter-spacing:0.1em;margin-bottom:0.2rem;">\u516C\u804C\u8EAB\u4EFD</div>';
    html += '<div style="font-size:0.82rem;color:var(--txt);">' + escHtml(_pubRole || '\u5E03\u8863') + '</div>';
    if (_pubFaction) html += '<div style="font-size:0.72rem;color:var(--txt-s);">' + escHtml(_pubFaction) + '</div>';
    if (ch.party) html += '<div style="font-size:0.68rem;color:var(--ink-300);">\u515A\uFF1A' + escHtml(ch.party) + '</div>';
    html += '</div>';
    html += '<div style="padding:0.5rem;background:var(--bg-3);border-radius:6px;border-left:3px solid var(--purple,#9b59b6);">';
    html += '<div style="font-size:0.7rem;color:var(--purple,#9b59b6);letter-spacing:0.1em;margin-bottom:0.2rem;">\u79C1\u4EBA\u8EAB\u4EFD</div>';
    html += '<div style="font-size:0.82rem;color:var(--txt);">' + escHtml(ch.name) + (ch.age ? '\uFF0C' + ch.age + '\u5C81' : '') + '</div>';
    if (ch.personality) html += '<div style="font-size:0.72rem;color:var(--txt-s);">' + escHtml(ch.personality) + '</div>';
    if (ch.personalGoal) html += '<div style="font-size:0.68rem;color:var(--ink-300);">\u6240\u6C42\uFF1A' + escHtml(ch.personalGoal.slice(0,30)) + '</div>';
    html += '</div></div>';
    // 玩家角色专属：近期内省记录
    if (_isPlayerChar) {
      var _recentInners = (GM.shijiHistory || []).slice(-3).filter(function(s) { return s.playerInner; }).reverse();
      if (_recentInners.length > 0) {
        html += '<div style="margin-bottom:0.6rem;"><div style="font-weight:600;color:var(--purple,#9b59b6);font-size:0.85rem;margin-bottom:0.3rem;">\u8FD1\u65E5\u5FC3\u7EEA</div>';
        _recentInners.forEach(function(s) {
          html += '<div style="font-size:0.75rem;color:var(--txt-s);font-style:italic;padding:0.2rem 0.4rem;border-left:2px solid var(--purple,#9b59b6);margin-bottom:0.2rem;">';
          html += '<span style="color:var(--txt-d);">' + (s.time || '') + '</span> ' + escHtml(s.playerInner);
          html += '</div>';
        });
        html += '</div>';
      }
    }
  })();

  // 外貌描写（在属性条之前）
  if (ch.appearance) {
    html += '<div style="margin-bottom:0.6rem;padding:0.4rem 0.6rem;background:var(--bg-2);border-radius:6px;font-size:0.8rem;color:var(--txt-s);line-height:1.6;font-style:italic;border-left:2px solid var(--bg-4);">' + escHtml(ch.appearance) + '</div>';
  }

  // 家族与门第 + 家谱树
  if (ch.family) {
    var _fam = GM.families ? GM.families[ch.family] : null;
    var _tierName = typeof getFamilyTierName === 'function' ? getFamilyTierName(ch.familyTier) : '';
    var _tierColor = {'imperial':'var(--gold)','noble':'#e67e22','gentry':'var(--blue)','common':'var(--txt-d)'}[ch.familyTier] || 'var(--txt-d)';

    html += '<div class="fam-tree">';
    // 标题栏：家族名+门第+声望
    html += '<div class="fam-tree-title"><span style="color:' + _tierColor + ';">' + escHtml(ch.family) + (_tierName ? ' <span style="font-size:0.7rem;font-weight:400;">(' + _tierName + ')</span>' : '') + '</span>';
    if (_fam) html += '<span class="fam-tree-renown">\u58F0\u671B ' + Math.round(_fam.renown || 0) + '</span>';
    html += '</div>';

    // 家谱树（简易3代视图）
    if (_fam) {
      // 找到当前角色的血亲
      var _myRels = typeof getBloodRelatives === 'function' ? getBloodRelatives(ch.name) : [];
      // 构建三代树：父辈→自己一代→子辈
      var _parents = _myRels.filter(function(r) { return r.relation === '\u7236\u5B50' || r.relation === '\u6BCD\u5B50'; });
      var _siblings = _myRels.filter(function(r) { return r.relation === '\u5144\u5F1F' || r.relation === '\u5144\u59B9'; });
      var _childRels = (ch.children || []).map(function(cn) { return { name: cn }; });
      // 配偶
      var _spouses = (GM.chars || []).filter(function(c2) { return c2.alive !== false && c2.spouse && c2.family !== ch.family; });
      // 这里用关联spouse（如果当前角色是玩家）
      var _mySpouses = [];
      if (ch.isPlayer || (P.playerInfo && P.playerInfo.characterName === ch.name)) {
        _mySpouses = (GM.chars || []).filter(function(c2) { return c2.spouse && c2.alive !== false; });
      }

      // 渲染函数
      var _nodeHtml = function(name, extra) {
        var c2 = findCharByName(name);
        var cls = 'fam-tree-name';
        if (name === ch.name) cls += ' current';
        if (c2 && c2.alive === false) cls += ' dead';
        if (c2 && c2.spouse) cls += ' spouse-node';
        var titleStr = c2 ? (c2.title || '') : '';
        return '<div class="fam-tree-node"><span class="' + cls + '" onclick="closeGenericModal();viewRenwu(\'' + name.replace(/'/g, "\\'") + '\')">' + escHtml(name) + '</span><span class="fam-tree-role">' + escHtml(titleStr) + (extra || '') + '</span></div>';
      };

      // 父辈行
      if (_parents.length > 0) {
        html += '<div class="fam-tree-gen">';
        _parents.forEach(function(p) { html += _nodeHtml(p.name, ' (' + p.relation + ')'); });
        html += '</div><div class="fam-tree-conn">\u2502</div>';
      }

      // 本代行（自己+配偶+兄弟）
      html += '<div class="fam-tree-gen">';
      _siblings.forEach(function(s) { html += _nodeHtml(s.name, ''); });
      html += _nodeHtml(ch.name, '');
      _mySpouses.forEach(function(sp) { html += _nodeHtml(sp.name, ' ' + (typeof getHaremRankName === 'function' ? getHaremRankName(sp.spouseRank) : '')); });
      html += '</div>';

      // 子辈行
      if (_childRels.length > 0 || (_mySpouses.length > 0 && _mySpouses.some(function(sp) { return sp.children && sp.children.length > 0; }))) {
        html += '<div class="fam-tree-conn">\u2502</div><div class="fam-tree-gen">';
        var _allChildNames = [];
        _childRels.forEach(function(cr) { if (_allChildNames.indexOf(cr.name) < 0) _allChildNames.push(cr.name); });
        _mySpouses.forEach(function(sp) { (sp.children || []).forEach(function(cn) { if (_allChildNames.indexOf(cn) < 0) _allChildNames.push(cn); }); });
        _allChildNames.forEach(function(cn) {
          var _childCh = findCharByName(cn);
          var _motherInfo = '';
          if (_childCh) {
            var _mom = (GM.chars || []).find(function(m) { return m.children && m.children.indexOf(cn) >= 0 && m.spouse; });
            if (_mom) _motherInfo = '\u6BCD:' + _mom.name;
          }
          html += _nodeHtml(cn, _motherInfo);
        });
        html += '</div>';
      }

      // 分支信息
      if (_fam.branches && _fam.branches.length > 1) {
        html += '<div style="font-size:0.68rem;color:var(--txt-d);margin-top:0.3rem;">\u5BB6\u652F\uFF1A';
        _fam.branches.forEach(function(b, bi) {
          html += (bi > 0 ? ' | ' : '') + '<span style="color:' + (bi === 0 ? _tierColor : 'var(--txt-s)') + ';">' + escHtml(b.name) + '(' + b.members.length + '\u4EBA)</span>';
        });
        html += '</div>';
      }

      // 家族关联势力
      if (GM.facs || GM.parties) {
        var _facLink = (GM.facs || []).find(function(f) { return f.name && ch.family && f.name.indexOf(ch.family.replace(/\u6C0F$/, '')) >= 0; });
        if (_facLink) html += '<div style="font-size:0.68rem;color:var(--txt-d);margin-top:0.2rem;">\u5173\u8054\u52BF\u529B\uFF1A' + escHtml(_facLink.name) + '</div>';
      }
    }
    html += '</div>';
  }

  // 核心数值条（10项 5×2网格）——显示四舍五入 1 位小数
  html += '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:0.4rem;margin-bottom:0.8rem;">';
  var _f1 = (typeof _fmtNum1 === 'function') ? _fmtNum1 : function(v){ return v==null?0:v; };
  var bars = [
    {label:'\u5FE0\u8BDA',val:(ch.loyalty!=null?ch.loyalty:50),color:'var(--celadon-400)'},
    {label:'\u667A\u529B',val:effInt,color:'var(--indigo-400)',bonus:effInt-(ch.intelligence||0)},
    {label:'\u6B66\u52C7',val:effVal,color:'var(--vermillion-400)',bonus:effVal-(ch.valor||0)},
    {label:'\u519B\u4E8B',val:effMil,color:'var(--vermillion-400)',bonus:effMil-(ch.military||0)},
    {label:'\u653F\u52A1',val:effAdm,color:'var(--gold-400)',bonus:effAdm-(ch.administration||0)},
    {label:'\u7BA1\u7406',val:effMng,color:'#d4a04c',bonus:effMng-(ch.management||0)},
    {label:'\u9B45\u529B',val:effCha,color:'#e84393',bonus:effCha-(ch.charisma||0)},
    {label:'\u5916\u4EA4',val:effDip,color:'var(--amber-400)',bonus:effDip-(ch.diplomacy||0)},
    {label:'\u4EC1\u5FB7',val:effBen,color:'var(--celadon-400)',bonus:effBen-(ch.benevolence||0)},
    {label:'\u91CE\u5FC3',val:(ch.ambition!=null?ch.ambition:50),color:'var(--purple,#9b59b6)'},
    {label:'\u538B\u529B',val:ch.stress||0,color:(ch.stress||0)>=50?'var(--vermillion-400)':'var(--ink-300)'}
  ];
  bars.forEach(function(b){
    var bonusTag = (b.bonus && b.bonus!==0) ? '<span style="color:'+(b.bonus>0?'var(--green)':'var(--red)')+';font-size:0.65rem;">('+(b.bonus>0?'+':'')+_f1(b.bonus)+')</span>' : '';
    html += '<div style="font-size:0.75rem;color:var(--txt-s);">' + b.label + ' ' + _f1(b.val) + bonusTag;
    html += '<div style="height:4px;background:var(--bg-4);border-radius:2px;margin-top:2px;"><div style="height:100%;width:'+Math.min(100,Math.max(0,parseFloat(b.val)||0))+'%;background:'+b.color+';border-radius:2px;"></div></div></div>';
  });
  html += '</div>';

  // 特质展示
  if (ch.traits && ch.traits.length > 0 && typeof TRAIT_LIBRARY !== 'undefined') {
    html += '<div style="margin-top:0.5rem;padding:0.4rem 0.5rem;background:var(--color-elevated);border:1px solid var(--color-border-subtle);border-radius:4px;">';
    html += '<div style="font-size:0.7rem;color:var(--gold-400);margin-bottom:0.2rem;">特质</div>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:3px;">';
    ch.traits.forEach(function(tid) {
      var t = TRAIT_LIBRARY[tid]; if (!t) return;
      var cat = TRAIT_CATEGORIES && TRAIT_CATEGORIES[t.category];
      var col = cat ? cat.color : '#888';
      html += '<span title="' + escHtml(t.behaviorTendency || t.description || '') + '" style="font-size:0.65rem;padding:1px 6px;background:' + col + '22;color:' + col + ';border:1px solid ' + col + ';border-radius:10px;cursor:help;">' + escHtml(t.name || tid) + '</span>';
    });
    html += '</div></div>';
  }

  // 个人目标
  if(ch.personalGoal){
    html += '<div style="padding:0.4rem 0.6rem;background:var(--bg-3);border-radius:6px;margin-bottom:0.6rem;font-size:0.82rem;"><span style="color:var(--gold-d);">目标：</span>' + escHtml(ch.personalGoal) + '</div>';
  }

  // 文事作品集
  if (GM.culturalWorks && GM.culturalWorks.length > 0) {
    var _myWorks = GM.culturalWorks.filter(function(w) { return w.author === ch.name; });
    if (_myWorks.length > 0) {
      html += '<div style="margin-bottom:0.6rem;padding:0.5rem 0.6rem;background:var(--color-elevated);border:1px solid var(--color-border-subtle);border-radius:6px;">';
      html += '<div style="font-weight:600;color:var(--gold);font-size:0.85rem;margin-bottom:0.4rem;">文事作品（' + _myWorks.length + '）</div>';
      html += '<div style="display:flex;flex-direction:column;gap:0.25rem;">';
      _myWorks.slice(-8).reverse().forEach(function(w) {
        var realIdx = GM.culturalWorks.indexOf(w);
        var genreLbl = (typeof _WENYUAN_GENRES !== 'undefined' ? _WENYUAN_GENRES[w.genre] : w.genre) || '';
        var tier = w.isPreserved ? '★' : '';
        html += '<div style="padding:0.25rem 0.4rem;background:var(--bg-2);border-radius:3px;cursor:pointer;font-size:0.75rem;" onclick="closeGenericModal();_showWorkDetail(' + realIdx + ')" title="点击查看全文">';
        html += '<span style="color:var(--gold-400);">' + tier + '《' + escHtml(w.title || '?') + '》</span>';
        html += ' <span style="color:var(--txt-d);font-size:0.68rem;">[' + genreLbl + (w.subtype ? '·' + escHtml(w.subtype) : '') + '] T' + (w.turn||0) + ' 品' + (w.quality||0);
        if (w.mood) html += ' · ' + escHtml(w.mood);
        html += '</span>';
        html += '</div>';
      });
      if (_myWorks.length > 8) html += '<div style="font-size:0.65rem;color:var(--txt-d);text-align:center;">…另有 ' + (_myWorks.length - 8) + ' 篇（可在文苑标签查阅）</div>';
      html += '</div></div>';
    }
  }

  // 特质卡片
  if(ch.traitIds && ch.traitIds.length>0 && P.traitDefinitions){
    html += '<div style="margin-bottom:0.6rem;"><div style="font-weight:600;color:var(--gold);font-size:0.85rem;margin-bottom:0.3rem;">性格特质</div><div style="display:flex;flex-wrap:wrap;gap:0.2rem;">';
    ch.traitIds.forEach(function(tid){
      var def = P.traitDefinitions.find(function(t){return t.id===tid;});
      if(!def) return;
      var oppLabel = '';
      if(def.opposite){ var opp=P.traitDefinitions.find(function(t){return t.id===def.opposite;}); if(opp) oppLabel='↔'+opp.name; }
      var attrParts = [];
      if(def.attrMod){ var an={valor:'武',intelligence:'智',administration:'政',military:'军'}; Object.keys(def.attrMod).forEach(function(k){attrParts.push((an[k]||k)+(def.attrMod[k]>0?'+':'')+def.attrMod[k]);}); }
      html += '<span style="display:inline-flex;align-items:center;gap:0.2rem;padding:0.15rem 0.4rem;background:var(--bg-4);border-radius:10px;font-size:0.75rem;">';
      html += '<b style="color:var(--gold-l);">'+escHtml(def.name)+'</b>';
      if(attrParts.length) html += '<span style="color:var(--blue);font-size:0.65rem;">'+attrParts.join(' ')+'</span>';
      if(oppLabel) html += '<span style="color:var(--txt-d);font-size:0.6rem;">'+oppLabel+'</span>';
      html += '</span>';
    });
    html += '</div>';
    // 行为倾向
    var hints = ch.traitIds.map(function(tid){var d=P.traitDefinitions.find(function(t){return t.id===tid;}); return d&&d.aiHint?d.aiHint:null;}).filter(Boolean);
    if(hints.length) html += '<div style="font-size:0.75rem;color:var(--txt-s);margin-top:0.3rem;"><span style="color:var(--gold-d);">行为倾向：</span>'+escHtml(hints.join('；'))+'</div>';
    html += '</div>';
  }

  // 压力详情
  if((ch.stress||0) >= 20 && typeof StressSystem !== 'undefined'){
    html += '<div style="padding:0.3rem 0.6rem;background:rgba(192,57,43,0.1);border-radius:6px;margin-bottom:0.6rem;font-size:0.78rem;">';
    html += '<span style="color:var(--red);">'+StressSystem.getStressLabel(ch)+'</span> ('+ch.stress+'/100)';
    // 压力触发和缓解
    if(ch.traitIds && P.traitDefinitions){
      var stOn=[],stOff=[];
      ch.traitIds.forEach(function(tid){var d=P.traitDefinitions.find(function(t){return t.id===tid;}); if(d){if(d.stressOn)stOn=stOn.concat(d.stressOn);if(d.stressOff)stOff=stOff.concat(d.stressOff);}});
      if(stOn.length) html += '<div style="margin-top:0.2rem;">\u5FCC\uFF1A'+escHtml(stOn.join('\u3001'))+'</div>';
      if(stOff.length) html += '<div>\u597D\uFF1A'+escHtml(stOff.join('\u3001'))+'</div>';
    }
    html += '</div>';
  }

  // 血缘关系（来自家族系统）
  if (typeof getBloodRelatives === 'function') {
    var _bRels = getBloodRelatives(ch.name);
    if (_bRels.length > 0) {
      html += '<div style="margin-bottom:0.6rem;"><div style="font-weight:600;color:#e67e22;font-size:0.85rem;margin-bottom:0.3rem;">\u8840\u7F18\u5173\u7CFB</div>';
      _bRels.forEach(function(br) {
        html += '<div style="display:flex;justify-content:space-between;padding:0.15rem 0;font-size:0.78rem;border-bottom:1px solid var(--bg-4);">';
        html += '<span style="cursor:pointer;color:var(--blue);text-decoration:underline;" onclick="closeGenericModal();viewRenwu(\'' + br.name.replace(/'/g, "\\'") + '\')">' + escHtml(br.name) + '</span>';
        html += '<span style="color:#e67e22;">' + escHtml(br.relation) + '</span></div>';
      });
      html += '</div>';
    }
  }

  // 人际关系网（亲疏度）
  if(typeof AffinityMap !== 'undefined'){
    var rels = AffinityMap.getRelations(ch.name);
    if(rels.length > 0){
      html += '<div style="margin-bottom:0.6rem;"><div style="font-weight:600;color:var(--gold);font-size:0.85rem;margin-bottom:0.3rem;">\u4EBA\u9645\u5173\u7CFB</div>';
      rels.forEach(function(r){
        var col = r.value>=30?'var(--green)':r.value<=-30?'var(--red)':'var(--txt-s)';
        var label = r.value>=50?'\u83AB\u9006':r.value>=25?'\u4EB2\u8FD1':r.value<=-50?'\u6B7B\u654C':r.value<=-25?'\u4E0D\u7766':'\u4E00\u822C';
        html += '<div style="display:flex;justify-content:space-between;padding:0.15rem 0;font-size:0.78rem;border-bottom:1px solid var(--bg-4);">';
        html += '<span>'+escHtml(r.name)+'</span><span style="color:'+col+';">'+label+' ('+r.value+')</span></div>';
      });
      html += '</div>';
    }
  }

  // 好感分解（对玩家）
  if(typeof OpinionSystem !== 'undefined'){
    var playerChar = findCharByName(P.playerInfo.characterName);
    if(playerChar && playerChar.name !== ch.name){
      var baseOp = OpinionSystem.calculateBase(ch, playerChar);
      var totalOp = OpinionSystem.getTotal(ch, playerChar);
      var eventOp = totalOp - baseOp;
      html += '<div style="font-size:0.78rem;margin-bottom:0.6rem;padding:0.3rem 0.6rem;background:var(--bg-3);border-radius:6px;">';
      html += '<span style="color:var(--gold-d);">对君主好感：</span>';
      html += '<span style="color:'+(totalOp>=0?'var(--green)':'var(--red)')+';">'+totalOp+'</span>';
      html += ' <span style="color:var(--txt-d);">(基础'+baseOp+(eventOp!==0?'，事件'+(eventOp>0?'+':'')+eventOp:'')+')</span>';
      html += '</div>';
    }
  }

  // 角色弧线时间轴
  if(GM.characterArcs && GM.characterArcs[ch.name] && GM.characterArcs[ch.name].length > 0){
    html += '<div style="margin-bottom:0.6rem;"><div style="font-weight:600;color:var(--gold);font-size:0.85rem;margin-bottom:0.3rem;">经历</div>';
    GM.characterArcs[ch.name].slice(-8).forEach(function(arc){
      var icon = (typeof tmIcon==='function')?({appointment:tmIcon('memorial',12),dismissal:tmIcon('close',12),death:tmIcon('close',12),inheritance:tmIcon('prestige',12),war:tmIcon('troops',12),autonomous:tmIcon('person',12),achievement:tmIcon('policy',12),event:tmIcon('event',12)}[arc.type]||'•'):'•';
      html += '<div style="font-size:0.75rem;padding:0.15rem 0;border-left:2px solid var(--gold-d);padding-left:0.5rem;margin-bottom:0.15rem;">';
      html += '<span style="color:var(--txt-d);">T'+arc.turn+'</span> '+icon+' '+escHtml(arc.desc)+'</div>';
    });
    html += '</div>';
  }

  // 生平简介
  if(ch.bio){
    html += '<div style="margin-bottom:0.6rem;"><div style="font-weight:600;color:var(--gold);font-size:0.85rem;margin-bottom:0.3rem;">生平</div>';
    html += '<div style="font-size:0.82rem;color:var(--txt-s);line-height:1.8;text-indent:2em;padding:0.5rem 0.7rem;background:var(--bg-2);border-radius:6px;border-left:2px solid var(--gold-d);">'+escHtml(ch.bio)+'</div></div>';
  }

  // 角色描写
  if(ch.description && ch.description !== ch.bio){
    html += '<div style="font-size:0.8rem;color:var(--txt-d);line-height:1.6;margin-bottom:0.5rem;font-style:italic;">'+escHtml(ch.description)+'</div>';
  }

  // 人生历练
  if(ch._lifeExp && ch._lifeExp.length > 0){
    html += '<div style="margin-bottom:0.6rem;"><div style="font-weight:600;color:var(--gold);font-size:0.85rem;margin-bottom:0.3rem;">人生历练</div>';
    // 按领域分组统计
    var domainCounts = {};
    ch._lifeExp.forEach(function(e) { domainCounts[e.domain] = (domainCounts[e.domain]||0) + 1; });
    var domainTags = [];
    var domainIcons = (typeof tmIcon==='function')?{'军旅':tmIcon('troops',12),'治理':tmIcon('office',12),'仕途':tmIcon('memorial',12),'求学':tmIcon('chronicle',12),'师承':tmIcon('person',12),'帝师':tmIcon('prestige',12),'蛰伏':tmIcon('scroll',12),'暮年':tmIcon('history',12),'磨难':tmIcon('unrest',12)}:{};
    for(var dk in domainCounts) domainTags.push((domainIcons[dk]||'•') + dk + '×' + domainCounts[dk]);
    html += '<div style="font-size:0.75rem;color:var(--txt-s);margin-bottom:0.3rem;">' + domainTags.join(' ') + '</div>';
    // 最近几条
    ch._lifeExp.slice(-4).reverse().forEach(function(e){
      html += '<div style="font-size:0.72rem;padding:0.12rem 0;color:var(--txt-d);border-left:2px solid var(--bg-4);padding-left:0.4rem;margin-bottom:0.1rem;">';
      html += (domainIcons[e.domain]||'') + ' ' + escHtml(e.desc) + '</div>';
    });
    html += '</div>';
  }

  // （培养栽培 UI 已删除——人物成长应由推演驱动）

  // 当前情绪
  if(ch._mood && ch._mood !== '平'){
    var moodMap = {'喜':'〔喜〕心情愉悦','怒':'〔怒〕满腔怒火','忧':'〔忧〕忧心忡忡','惧':'〔惧〕惴惴不安','恨':'〔恨〕满怀怨恨','敬':'〔敬〕心怀敬意'};
    var moodColors = {'喜':'var(--color-success)','怒':'var(--vermillion-400)','忧':'#e67e22','惧':'var(--indigo-400)','恨':'var(--vermillion-400)','敬':'var(--celadon-400)'};
    html += '<div style="padding:0.3rem 0.6rem;background:var(--bg-3);border-radius:6px;margin-bottom:0.6rem;font-size:0.82rem;color:'+(moodColors[ch._mood]||'var(--txt-s)')+';">'+(moodMap[ch._mood]||ch._mood)+'</div>';
  }

  // NPC个人记忆
  if((ch._memory && ch._memory.length > 0) || (ch._memArchive && ch._memArchive.length > 0)){
    html += '<div style="margin-bottom:0.6rem;"><div style="font-weight:600;color:var(--gold);font-size:0.85rem;margin-bottom:0.3rem;">此人记忆</div>';
    var emotionIcons = {'喜':'〔喜〕','怒':'〔怒〕','忧':'〔忧〕','惧':'〔惧〕','恨':'〔恨〕','敬':'〔敬〕','平':'〔平〕'};
    // 归档记忆（折叠）
    if(ch._memArchive && ch._memArchive.length > 0){
      html += '<div style="font-size:0.7rem;color:var(--txt-d);padding:0.2rem 0.4rem;background:var(--bg-4);border-radius:4px;margin-bottom:0.3rem;cursor:pointer;" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display===\'none\'?\'block\':\'none\';">'+tmIcon('history',11)+' 往事归档（'+ch._memArchive.length+'段）▸</div>';
      html += '<div style="display:none;font-size:0.7rem;color:var(--txt-d);padding:0.3rem;background:var(--bg-2);border-radius:4px;margin-bottom:0.3rem;">';
      ch._memArchive.forEach(function(a) { html += '<div style="margin-bottom:0.2rem;">T'+a.period+'：'+escHtml(a.summary)+'</div>'; });
      html += '</div>';
    }
    // 活跃记忆
    if(ch._memory && ch._memory.length > 0){
      ch._memory.slice(-8).reverse().forEach(function(m){
        html += '<div style="font-size:0.75rem;padding:0.15rem 0;border-bottom:1px solid var(--bg-4);">';
        html += '<span style="color:var(--txt-d);">T'+m.turn+'</span> '+(emotionIcons[m.emotion]||'•')+' '+escHtml(m.event);
        if(m.who) html += ' <span style="color:var(--blue);font-size:0.65rem;">→'+escHtml(m.who)+'</span>';
        html += '</div>';
      });
    }
    html += '</div>';
  }

  // 对他人的印象
  if(ch._impressions){
    var impEntries = [];
    for(var pn in ch._impressions){
      var iv = ch._impressions[pn];
      if(Math.abs(iv.favor) >= 2) impEntries.push({name:pn, favor:iv.favor, events:iv.events||[]});
    }
    if(impEntries.length > 0){
      impEntries.sort(function(a,b){return Math.abs(b.favor)-Math.abs(a.favor);});
      html += '<div style="margin-bottom:0.6rem;"><div style="font-weight:600;color:var(--gold);font-size:0.85rem;margin-bottom:0.3rem;">对他人印象</div>';
      impEntries.forEach(function(ie){
        var col = ie.favor >= 5 ? 'var(--green)' : ie.favor <= -5 ? 'var(--red)' : 'var(--txt-s)';
        var label = ie.favor >= 15 ? '感恩戴德' : ie.favor >= 8 ? '心存感激' : ie.favor >= 3 ? '略有好感' : ie.favor <= -15 ? '恨之入骨' : ie.favor <= -8 ? '怀恨在心' : ie.favor <= -3 ? '心生不满' : '无感';
        html += '<div style="display:flex;justify-content:space-between;padding:0.12rem 0;font-size:0.75rem;border-bottom:1px solid var(--bg-4);">';
        html += '<span>'+escHtml(ie.name)+'</span><span style="color:'+col+';">'+label+'('+Math.round(ie.favor)+')</span></div>';
      });
      html += '</div>';
    }
  }

  // 基本信息汇总
  // 基本信息标签已移至头部"身份档案"区

  // ── 家庭关系（妻妾+子嗣+亲属——后宫继承仅势力领袖） ──
  var _isLeader2 = false;
  if (GM.facs) _isLeader2 = GM.facs.some(function(f) { return f.leader === ch.name; });
  if (ch.spouse) {
    var _rkDisplay = {'empress':'\u7687\u540E','queen':'\u738B\u540E','consort':'\u5983','concubine':'\u5ABE','attendant':'\u4F8D\u59BE'};
    html += '<div style="margin-bottom:0.6rem;padding:0.5rem;background:linear-gradient(135deg,rgba(232,67,147,0.05),rgba(253,121,168,0.05));border-radius:6px;border-left:3px solid #e84393;">';
    html += '<div style="font-weight:600;color:#e84393;font-size:0.85rem;margin-bottom:0.3rem;">\uD83D\uDC90 ' + (_rkDisplay[ch.spouseRank] || '\u59BB\u5BA4') + '</div>';
    if (ch.motherClan) html += '<div style="font-size:0.78rem;color:var(--txt-s);margin-bottom:0.2rem;">\u6BCD\u65CF\uFF1A<span style="color:var(--blue);">' + escHtml(ch.motherClan) + '</span></div>';
    if (ch.children && ch.children.length > 0) {
      html += '<div style="font-size:0.78rem;color:var(--txt-s);margin-bottom:0.2rem;">\u5B50\u5973\uFF1A';
      ch.children.forEach(function(cn) {
        var childCh = findCharByName(cn);
        html += '<span style="cursor:pointer;color:var(--gold-l);text-decoration:underline;" onclick="closeGenericModal();viewRenwu(\'' + cn.replace(/'/g, "\\'") + '\')">' + escHtml(cn) + '</span> ';
        if (childCh && childCh.age) html += '<span style="font-size:0.65rem;color:var(--txt-d);">(' + childCh.age + '\u5C81)</span> ';
        // 标注太子
        if (GM.harem && GM.harem.heirs && GM.harem.heirs[0] === cn) html += '<span style="font-size:0.6rem;color:var(--gold);">\u{1F451}\u592A\u5B50</span> ';
      });
      html += '</div>';
    }
    // 怀孕中
    if (GM.harem && GM.harem.pregnancies) {
      var _isPreg = GM.harem.pregnancies.find(function(p) { return p.motherName === ch.name; });
      if (_isPreg) {
        html += '<div style="font-size:0.78rem;color:#e84393;margin-bottom:0.2rem;">\u{1F930} \u6709\u5B55\u4E2D</div>';
      }
    }
    html += '</div>';
  }
  // 势力领袖（含玩家）查看时显示完整后宫和继承人；普通角色不显示后宫
  if ((_isPlayerChar || _isLeader2) && GM.chars) {
    var _mySpouses = GM.chars.filter(function(c) { return c.alive !== false && c.spouse; });
    if (_mySpouses.length > 0) {
      html += '<div style="margin-bottom:0.6rem;"><div style="font-weight:600;color:#e84393;font-size:0.85rem;margin-bottom:0.3rem;">\uD83C\uDFDB\uFE0F \u540E\u5BAE</div>';
      var _rkOrder = {'empress':0,'queen':0,'consort':1,'concubine':2,'attendant':3};
      _mySpouses.sort(function(a,b){return (_rkOrder[a.spouseRank]||9) - (_rkOrder[b.spouseRank]||9);});
      _mySpouses.forEach(function(sp) {
        var _rkD = {'empress':'\u7687\u540E','queen':'\u738B\u540E','consort':'\u5983','concubine':'\u5ABE','attendant':'\u4F8D\u59BE'};
        html += '<div style="display:flex;justify-content:space-between;padding:0.2rem 0;font-size:0.78rem;border-bottom:1px solid var(--bg-4);cursor:pointer;" onclick="closeGenericModal();viewRenwu(\'' + sp.name.replace(/'/g, "\\'") + '\')">';
        html += '<span><span style="color:#e84393;">' + (_rkD[sp.spouseRank] || '') + '</span> ' + escHtml(sp.name) + '</span>';
        var _childCount = sp.children ? sp.children.length : 0;
        html += '<span style="color:var(--txt-d);">' + (sp.motherClan || '') + (_childCount > 0 ? ' \u5B50\u00D7' + _childCount : '') + '</span>';
        html += '</div>';
      });
      html += '</div>';
    }
    // 继承人
    if (GM.harem && GM.harem.heirs && GM.harem.heirs.length > 0) {
      html += '<div style="margin-bottom:0.6rem;padding:0.4rem 0.6rem;background:var(--bg-3);border-radius:6px;"><div style="font-weight:600;color:var(--gold);font-size:0.85rem;margin-bottom:0.2rem;">\uD83D\uDC51 \u7EE7\u627F\u987A\u5E8F</div>';
      html += '<div style="font-size:0.78rem;color:var(--txt-s);">' + GM.harem.heirs.map(function(h, i) { return '<span style="color:' + (i === 0 ? 'var(--gold)' : 'var(--txt-d)') + ';">' + (i + 1) + '. ' + escHtml(h) + '</span>'; }).join(' \u2192 ') + '</div>';
      html += '</div>';
    }
  }
  // 子嗣（非leader且有children时显示——leader的children已在后宫区显示）
  if (!_isLeader2 && !_isPlayerChar && ch.children && ch.children.length > 0) {
    html += '<div style="margin-bottom:0.4rem;">';
    html += '<div style="font-weight:600;color:var(--gold);font-size:0.8rem;margin-bottom:0.2rem;">\u5B50\u55E3</div>';
    html += '<div style="font-size:0.75rem;">';
    ch.children.forEach(function(cn) {
      var childCh = findCharByName(cn);
      html += '<span style="cursor:pointer;color:var(--gold-l);text-decoration:underline;margin-right:0.4rem;" onclick="closeGenericModal();viewRenwu(\'' + cn.replace(/'/g,"\\'") + '\')">' + escHtml(cn) + '</span>';
      if (childCh && childCh.age) html += '<span style="font-size:0.65rem;color:var(--txt-d);">(' + childCh.age + '\u5C81)</span> ';
    });
    html += '</div></div>';
  }
  // 亲属（非leader额外显示）
  if (!_isLeader2 && !_isPlayerChar) {
    var _kinfolk2 = (typeof getBloodRelatives === 'function') ? getBloodRelatives(ch.name) : [];
    if (_kinfolk2.length > 0) {
      html += '<div style="margin-bottom:0.4rem;">';
      html += '<div style="font-weight:600;color:var(--celadon-400);font-size:0.8rem;margin-bottom:0.2rem;">\u4EB2\u5C5E</div>';
      html += '<div style="font-size:0.75rem;">';
      _kinfolk2.slice(0,10).forEach(function(r) {
        html += '<span style="cursor:pointer;color:var(--celadon-400);margin-right:0.3rem;" onclick="closeGenericModal();viewRenwu(\'' + r.name.replace(/'/g,"\\'") + '\')">' + escHtml(r.name) + '(' + escHtml(r.relation) + ')</span>';
      });
      html += '</div></div>';
    }
  }

  html += '</div>';
  // 动态标题含头衔
  var _modalTitle = ch.name;
  if(ch.title) _modalTitle += ' · ' + ch.title;
  if(ch.spouse) {
    var _rkT = {'empress':'\u7687\u540E','queen':'\u738B\u540E','consort':'\u5983','concubine':'\u5ABE','attendant':'\u4F8D\u59BE'};
    _modalTitle += ' · ' + (_rkT[ch.spouseRank] || '\u59BB\u5BA4');
  }
  openGenericModal(_modalTitle, html);
}
