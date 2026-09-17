// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// tm-arcs.js — 角色弧线 + 玩家决策追踪
//
// R91 从 tm-endturn.js §A 抽出·原 L2213-2356 (144 行)
// 5 函数：recordCharacterArc / getCharacterArcSummary / getAllCharacterArcContext /
//        recordPlayerDecision / getPlayerDecisionContext
//
// 外部调用：较多·recordCharacterArc 被 6 个 js 调用·
//         recordPlayerDecision 被 3 个调用·
//         getAllCharacterArcContext/getPlayerDecisionContext 各被 tm-memory-anchors 调用
// 依赖外部：GM / _dbg（均为 window 全局）
//
// 加载顺序：必须在 tm-endturn.js 之前·且在 tm-memory-anchors.js 之前
// ============================================================

// ============================================================
// 角色弧线追踪
// 记录每个角色的重大事件，供 AI 生成连贯的人物叙事
// ============================================================

/** @param {string} charName @param {string} eventType - appointment|dismissal|war|death|inheritance|achievement @param {string} description */
function recordCharacterArc(charName, eventType, description) {
  if (typeof TM !== 'undefined' && TM.NativeWorld && TM.NativeWorld.enabled(GM)) { var nativeChar=TM.NativeWorld.resolveCharacter(GM,charName); charName=nativeChar&&nativeChar.id; }
  if (!charName || !eventType) return;
  if (!GM.characterArcs) GM.characterArcs = {};
  if (!GM.characterArcs[charName]) GM.characterArcs[charName] = [];

  GM.characterArcs[charName].push({
    type: eventType,    // 'appointment'|'dismissal'|'war'|'betrayal'|'alliance'|'death'|'marriage'|'achievement'
    desc: (description || '').substring(0, 100),
    turn: GM.turn,
    year: getCurrentYear ? getCurrentYear() : GM.turn
  });

  // 每角色最多保留 N 条弧线事件（超限时压缩最老半数为归档条目，不永久丢失）
  var arcLimit = (P.conf && P.conf.characterArcKeep) || 10;
  if (GM.characterArcs[charName].length > arcLimit) {
    var _arr = GM.characterArcs[charName];
    var _keepN = Math.max(1, arcLimit - 1);
    var _old = _arr.slice(0, _arr.length - _keepN);
    var _keep = _arr.slice(-_keepN);
    var _existArc = (_old[0] && _old[0].type === 'arc_archive') ? _old[0] : null;
    var _archArc;
    if (_existArc) {
      _archArc = _existArc;
      var _toM = _old.slice(1);
      _archArc.desc = ('早年事迹·' + (_archArc.desc||'').replace(/^早年事迹·/, '') + '；' +
        _toM.map(function(e){return 'T'+(e.turn||0)+'['+(e.type||'事件')+']'+(e.desc||'');}).join('；')).slice(0, 500);
      _archArc.eventCount = (_archArc.eventCount||1) + _toM.length;
      _archArc.turn = _archArc.firstTurn || _old[0].turn;
      _archArc.lastTurn = Math.max(_archArc.lastTurn||0, (_toM[_toM.length-1]||{}).turn || 0);
    } else {
      _archArc = {
        type: 'arc_archive',
        desc: '早年事迹·' + _old.map(function(e){return 'T'+(e.turn||0)+'['+(e.type||'事件')+']'+(e.desc||'');}).join('；').slice(0, 460),
        turn: _old[0].turn,
        firstTurn: _old[0].turn,
        lastTurn: _old[_old.length-1].turn,
        year: _old[0].year,
        eventCount: _old.length
      };
    }
    GM.characterArcs[charName] = [_archArc].concat(_keep);
  }
}

/** 获取角色弧线摘要（供 AI prompt） */
function getCharacterArcSummary(charName, maxEvents) {
  if (typeof TM !== 'undefined' && TM.NativeWorld && TM.NativeWorld.enabled(GM)) { var nativeChar=TM.NativeWorld.resolveCharacter(GM,charName); charName=nativeChar&&nativeChar.id; }
  if (!GM.characterArcs || !GM.characterArcs[charName]) return '';
  var _arr = GM.characterArcs[charName];
  var _arch = (_arr[0] && _arr[0].type === 'arc_archive') ? _arr[0] : null;
  var _recentCount = Math.max(1, (maxEvents || 5) - (_arch ? 1 : 0));
  var _recent = _arr.slice(_arch ? 1 : 0).slice(-_recentCount);
  var events = _arch ? [_arch].concat(_recent) : _recent;
  return events.map(function(e) { var _d=(typeof getTSText==='function')?getTSText(e.turn):''; return _d+'：'+e.desc; }).join('；');
}

/** 获取所有有弧线的关键人物摘要（供 AI prompt） */
function getAllCharacterArcContext(maxChars) {
  if (!GM.characterArcs) return '';
  var names = Object.keys(GM.characterArcs);
  if (names.length === 0) return '';
  // 按事件数排序，取最活跃的
  names.sort(function(a, b) {
    return (GM.characterArcs[b] || []).length - (GM.characterArcs[a] || []).length;
  });
  var result = '【人物履历】\n';
  names.slice(0, maxChars || 6).forEach(function(name) {
    var summary = getCharacterArcSummary(name, 3);
    var nativeChar=typeof TM!=='undefined' && TM.NativeWorld && TM.NativeWorld.enabled(GM) ? TM.NativeWorld.resolveCharacter(GM,name) : null;
    if (summary) result += '  ' + (nativeChar ? nativeChar.name+' ['+nativeChar.id+']' : name) + '：' + summary + '\n';
  });
  return result;
}

// ============================================================
// 玩家决策追踪
// 记录玩家的关键决策（诏令/朝议选择/事件分支），供 AI 理解玩家意图
// ============================================================

/** @param {string} category - edict|agenda|event|keju|policy|goal @param {string} description @param {string} [consequences] */
function recordPlayerDecision(category, description, consequences) {
  if (!GM.playerDecisions) GM.playerDecisions = [];
  GM.playerDecisions.push({
    category: category,  // 'edict'|'agenda'|'event'|'appointment'|'war'|'reform'
    desc: (description || '').substring(0, 150),
    consequences: (consequences || '').substring(0, 100),
    turn: GM.turn
  });
  // 保留最近 N 条（超限时压缩最老半数为归档条目，不永久丢失）
  var decLimit = (P.conf && P.conf.playerDecisionKeep) || 30;
  if (GM.playerDecisions.length > decLimit) {
    var _keepN = Math.max(1, decLimit - 1);
    var _old = GM.playerDecisions.slice(0, GM.playerDecisions.length - _keepN);
    var _keep = GM.playerDecisions.slice(-_keepN);
    var _existDec = (_old[0] && _old[0].category === 'decision_archive') ? _old[0] : null;
    var _archDec;
    if (_existDec) {
      _archDec = _existDec;
      var _toM = _old.slice(1);
      _archDec.desc = ('早期决策摘要·' + (_archDec.desc||'').replace(/^早期决策摘要·/, '') + '；' +
        _toM.map(function(d){return 'T'+(d.turn||0)+'['+(d.category||'')+']'+(d.desc||'');}).join('；')).slice(0, 800);
      _archDec.eventCount = (_archDec.eventCount||1) + _toM.length;
      _archDec.turn = _archDec.firstTurn || _old[0].turn;
      _archDec.lastTurn = Math.max(_archDec.lastTurn||0, (_toM[_toM.length-1]||{}).turn || 0);
    } else {
      _archDec = {
        category: 'decision_archive',
        desc: '早期决策摘要·' + _old.map(function(d){return 'T'+(d.turn||0)+'['+(d.category||'')+']'+(d.desc||'');}).join('；').slice(0, 720),
        consequences: '',
        turn: _old[0].turn,
        firstTurn: _old[0].turn,
        lastTurn: _old[_old.length-1].turn,
        eventCount: _old.length
      };
    }
    GM.playerDecisions = [_archDec].concat(_keep);
  }
}

/** 获取玩家决策上下文（供 AI 理解玩家风格和意图） */
function getPlayerDecisionContext(maxDecisions) {
  if (!GM.playerDecisions || GM.playerDecisions.length === 0) return '';
  var _arr = GM.playerDecisions;
  var _arch = (_arr[0] && _arr[0].category === 'decision_archive') ? _arr[0] : null;
  var _recentCount = Math.max(1, (maxDecisions || 8) - (_arch ? 1 : 0));
  var _recent = _arr.slice(_arch ? 1 : 0).slice(-_recentCount);
  var recent = _arch ? [_arch].concat(_recent) : _recent;
  var result = '【玩家决策轨迹】\n';
  recent.forEach(function(d) {
    result += '  T' + d.turn + ' [' + d.category + '] ' + d.desc;
    if (d.consequences) result += ' → ' + d.consequences;
    result += '\n';
  });
  // 简要风格分析
  var cats = {};
  GM.playerDecisions.forEach(function(d) { cats[d.category] = (cats[d.category] || 0) + 1; });
  var topCat = Object.entries(cats).sort(function(a,b){return b[1]-a[1];})[0];
  if (topCat) result += '  (玩家偏好: ' + topCat[0] + '类决策占比最高)\n';
  return result;
}
