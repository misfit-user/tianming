// ============================================================
//  tm-chaoyi.js — 朝议系统（R112 从 tm-chaoyi-keju.js L1054-end 拆出）
// Requires: tm-utils.js (GameHooks, _$, callAI, escHtml),
//           tm-index-world.js (findCharByName)
// 姊妹文件：tm-keju.js (科举)
// ============================================================

function openChaoyi(){
  // 频率限制：每回合最多2次朝议（廷议+常朝各1次，御前会议不限）
  if (!GM._chaoyiCount) GM._chaoyiCount = {};
  if (!GM._chaoyiCount[GM.turn]) GM._chaoyiCount[GM.turn] = 0;
  if (GM._chaoyiCount[GM.turn] >= 2) { toast('今日已朝议' + GM._chaoyiCount[GM.turn] + '次，改日再议'); return; }
  CY={open:true,topic:"",selected:[],messages:[],speaking:false,abortCtrl:null,round:0,phase:'setup',stances:{},mode:'tinyi',maxRounds:99,_playerActions:[],_pendingPlayerLine:null,_abortChaoyi:false};
  var modal=document.createElement("div");modal.className="modal-bg show";modal.id="chaoyi-modal";
  modal.innerHTML='<div style="background:var(--bg-1);border:1px solid var(--gold-d);border-radius:12px;width:95%;max-width:860px;height:88vh;display:flex;flex-direction:column;overflow:hidden;">'
    +'<div style="padding:0.8rem 1.2rem;border-bottom:1px solid var(--bdr);display:flex;justify-content:space-between;align-items:center;">'
    +'<div id="cy-mode-label" style="font-size:1.1rem;font-weight:700;color:var(--gold);">\uD83C\uDFDB \u671D\u8BAE</div>'
    +'<div style="display:flex;align-items:center;gap:0.6rem;">'
    +'<span id="cy-round-tag" style="font-size:0.72rem;color:var(--txt-d);display:none;"></span>'
    +'<button class="bt bs bsm" onclick="closeChaoyi()">\u2715 \u9000\u671D</button></div></div>'
    +'<div id="cy-topic" style="padding:0.5rem 1.2rem;border-bottom:1px solid var(--bdr);display:none;font-size:0.9rem;color:var(--gold-l);"></div>'
    +'<div id="cy-body" style="flex:1;overflow-y:auto;padding:1rem;"></div>'
    +'<div id="cy-input-row" style="padding:0.5rem 0.8rem;border-top:1px solid var(--bdr);background:var(--color-elevated);display:none;align-items:center;gap:0.4rem;">'
      +'<input type="text" id="cy-player-input" placeholder="陛下欲言……(回车插言)" style="flex:1;padding:0.4rem 0.6rem;background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius-sm);color:var(--color-foreground);font-size:0.8rem;" onkeydown="if(event.key===\'Enter\'){_cySubmitPlayerLine();}" />'
      +'<button class="bt bsm bp" onclick="_cySubmitPlayerLine()">📣 插言</button>'
      +'<button class="bt bsm" style="color:var(--vermillion-400);" onclick="_cyAbortChaoyi()" title="立即停止当前发言序列">⏸ 打断</button>'
    +'</div>'
    +'<div id="cy-footer" style="padding:0.6rem 1rem;border-top:1px solid var(--bdr);"></div></div>';
  document.body.appendChild(modal);
  showChaoyiSetup();
}

function closeChaoyi(){
  CY.open=false;CY.phase='setup';CY._pendingPlayerLine=null;CY._abortChaoyi=true;
  if(CY.abortCtrl){try{CY.abortCtrl.abort();}catch(e){ console.warn("[catch] 静默异常:", e.message || e); }}
  var m=_$("chaoyi-modal");if(m)m.remove();
  if(typeof renderLeftPanel==='function')renderLeftPanel();
  // 后朝结束钩子——触发史记弹窗或过渡到加载条
  if (GM._isPostTurnCourt && typeof _onPostTurnCourtEnd === 'function') {
    _onPostTurnCourtEnd();
  }
}

/** 显示/隐藏玩家输入栏（朝议进入讨论后再显示） */
function _cyShowInputRow(show){
  var row=_$("cy-input-row"); if(!row) return;
  row.style.display = show ? 'flex' : 'none';
}

/** 玩家回车或点击"插言"：将发言缓存，下一轮 AI 生成前会被读取并插入对话 */
function _cySubmitPlayerLine(){
  var inp=_$("cy-player-input"); if(!inp) return;
  var v=(inp.value||'').trim();
  if(!v) return;
  if(!CY || !CY.open){ toast('朝议已散'); return; }
  CY._pendingPlayerLine = v;
  inp.value = '';
  // 立刻显示一个"候言"提示气泡，避免玩家以为没反应
  try { if(typeof addCYBubble==='function') addCYBubble('内侍','（陛下举笏示意，待当前发言毕即插言。）', true); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-chaoyi-keju');}catch(_){}}
}

/** 玩家打断：停止当前发言序列 */
function _cyAbortChaoyi(){
  if(!CY || !CY.open) return;
  CY._abortChaoyi = true;
  if(CY.abortCtrl){ try { CY.abortCtrl.abort(); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-chaoyi-keju');}catch(_){}} }
  try { if(typeof addCYBubble==='function') addCYBubble('内侍','（陛下拊案——群臣噤声。）', true); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-chaoyi-keju');}catch(_){}}
}

/** 获取玩家当前所在地（可能不是京城） */
function _getPlayerLocation() {
  if (P.playerInfo && P.playerInfo.characterName) {
    var pch = findCharByName(P.playerInfo.characterName);
    if (pch && pch.location) return pch.location;
  }
  return GM._capital || '京城';
}

function _isAtCapital(ch) {
  if (!ch || ch.alive === false) return false;
  var playerLoc = _getPlayerLocation();
  var loc = ch.location || (GM._capital || '京城');
  if (ch._travelTo) return false;
  // 使用 _isSameLocation 做宽松匹配——紫禁城·乾清宫 / 坤宁宫 / 京师·文渊阁 视为同地
  return (typeof _isSameLocation === 'function') ? _isSameLocation(loc, playerLoc) : (loc === playerLoc);
}

function showChaoyiSetup(){
  var body=_$("cy-body");var footer=_$("cy-footer");
  body.innerHTML = '<div style="padding:1.5rem 1rem;">'
    + '<div style="text-align:center;font-size:1rem;color:var(--gold);letter-spacing:0.12em;margin-bottom:1.2rem;">〔 今 日 朝 议 〕</div>'
    + '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0.8rem;">'
    + _cy_modeCardHtml('changchao', '📜 常 朝', '例行朝参', '多事并奏·百官齐集·逐条裁决', '30-50 人', '精力 10')
    + _cy_modeCardHtml('tinyi',    '🏛 廷 议', '集议大政', '一议多轮·辩难立场·共识或独断', '15-30 人', '精力 25')
    + _cy_modeCardHtml('yuqian',   '👑 御前会议', '密召心腹', '坦言直陈·君臣密议·可不录', '3-8 人',   '精力 10')
    + '</div>'
    + '<div style="text-align:center;margin-top:1rem;"><button class="bt" onclick="closeChaoyi()">取消</button></div>'
    + '</div>';
  footer.innerHTML = '';
}

function _cy_modeCardHtml(mode, title, subtitle, desc, scale, energy) {
  return '<div class="cy-mode-card" onclick="_cy_pickMode(\'' + mode + '\')" '
    + 'style="cursor:pointer;padding:0.9rem 0.6rem;background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius-md);text-align:center;transition:all 0.15s;" '
    + 'onmouseover="this.style.borderColor=\'var(--gold-500)\';this.style.background=\'var(--color-elevated)\'" '
    + 'onmouseout="this.style.borderColor=\'var(--color-border)\';this.style.background=\'var(--color-surface)\'">'
    + '<div style="font-size:1rem;font-weight:700;color:var(--gold-400);margin-bottom:0.3rem;">' + title + '</div>'
    + '<div style="font-size:0.72rem;color:var(--color-foreground);margin-bottom:0.5rem;">' + subtitle + '</div>'
    + '<div style="font-size:0.65rem;color:var(--color-foreground-muted);line-height:1.4;margin-bottom:0.5rem;">' + desc + '</div>'
    + '<div style="font-size:0.62rem;color:var(--ink-300);">' + scale + ' · ' + energy + '</div>'
    + '</div>';
}

function _cy_pickMode(mode) {
  CY.mode = mode;
  if (mode === 'changchao') { _cc2_openPrepareDialog(); return; }
  if (mode === 'tinyi')     { _ty2_openSetup(); return; }
  if (mode === 'yuqian')    { _yq2_openSetup(); return; }
}

// 老版进入函数——若旧代码路径仍调用，重导向到 showChaoyiSetup
function startChaoyiSession(){ showChaoyiSetup(); }

/** 获取角色品级 */
function _cyGetRank(ch) {
  if (!ch || !GM.officeTree) return '';
  var rank = '';
  (function _w(ns) { ns.forEach(function(n) { (n.positions||[]).forEach(function(p) { if (p.holder === ch.name && p.rank) rank = p.rank; }); if (n.subs) _w(n.subs); }); })(GM.officeTree);
  return rank;
}

/** 切换朝议形式 */
function _cySetMode(btn, mode) {
  CY.mode = mode;
  document.querySelectorAll('.cy-mode-btn').forEach(function(b){ b.classList.remove('active','bp'); b.classList.add('bs'); });
  btn.classList.add('active','bp'); btn.classList.remove('bs');
  var desc = _$('cy-mode-desc');
  var modeLabel = _$('cy-mode-label');
  if (mode === 'tinyi') {
    if (desc) desc.textContent = '\u5EF7\u8BAE\uFF1A\u5C31\u7279\u5B9A\u91CD\u5927\u8BAE\u9898\u53EC\u96C6\u767E\u5B98\u8BA8\u8BBA\uFF0C\u6D88\u801725\u7CBE\u529B';
    if (modeLabel) modeLabel.innerHTML = '\uD83C\uDFDB \u5EF7\u8BAE';
  } else if (mode === 'yuqian') {
    if (desc) desc.textContent = '\u5FA1\u524D\u4F1A\u8BAE\uFF1A\u5C0F\u89C4\u6A21\u5BC6\u8BAE\uFF08\u9009\u62E93-5\u4EBA\uFF09\uFF0C\u4E0D\u6D88\u8017\u7CBE\u529B';
    if (modeLabel) modeLabel.innerHTML = '\uD83D\uDC51 \u5FA1\u524D\u4F1A\u8BAE';
  } else if (mode === 'changchao') {
    if (desc) desc.textContent = '\u5E38\u671D\uFF1A\u65E5\u5E38\u65E9\u671D\uFF0C\u7901\u4EEA\u6027\u6C47\u62A5\u4E3A\u4E3B\uFF0C\u6D88\u801710\u7CBE\u529B\u3002\u8BAE\u9898\u81EA\u52A8\u751F\u6210\u3002';
    if (modeLabel) modeLabel.innerHTML = '\uD83C\uDFEF \u5E38\u671D';
    // 常朝自动议程——从时局要务中提取
    var topicInput = _$('cy-topic-input');
    if (topicInput) {
      var _autoTopics = [];
      if (GM.currentIssues) {
        var _pending = GM.currentIssues.filter(function(i) { return i.status === 'pending'; });
        _pending.slice(0, 3).forEach(function(i) { _autoTopics.push(i.title); });
      }
      if (_autoTopics.length === 0) _autoTopics.push('日常朝政汇报');
      topicInput.value = _autoTopics.join('；');
    }
  }
}

function toggleCY(btn,name){var idx=CY.selected.indexOf(name);if(idx>=0){CY.selected.splice(idx,1);btn.classList.remove("active");}else{CY.selected.push(name);btn.classList.add("active");}}

function startChaoyiSession(){
  var topic=_$("cy-topic-input")?_$("cy-topic-input").value.trim():"";
  if(!topic){toast("\u8F93\u5165\u8BAE\u9898");return;}
  if(CY.selected.length<1){toast("\u81F3\u5C11\u53EC\u96C61\u4EBA");return;}
  // 模式验证
  var mode = CY.mode || 'tinyi';
  if (mode === 'yuqian' && CY.selected.length > 5) { toast('御前会议至多5人'); return; }
  // 能量消耗（御前会议不消耗也不计次）
  var _energyCost = mode === 'tinyi' ? 25 : mode === 'changchao' ? 10 : 0;
  if (_energyCost > 0 && typeof _spendEnergy === 'function' && !_spendEnergy(_energyCost, mode === 'tinyi' ? '廷议' : '常朝')) return;
  if (mode !== 'yuqian') {
    if (!GM._chaoyiCount) GM._chaoyiCount = {};
    if (!GM._chaoyiCount[GM.turn]) GM._chaoyiCount[GM.turn] = 0;
    GM._chaoyiCount[GM.turn]++;
  }
  // 品级排序发言顺序
  CY.selected.sort(function(a,b) {
    var ra = typeof getRankLevel === 'function' ? getRankLevel(_cyGetRank(findCharByName(a)||{})) : 99;
    var rb = typeof getRankLevel === 'function' ? getRankLevel(_cyGetRank(findCharByName(b)||{})) : 99;
    return ra - rb; // 高品级先说
  });
  CY.topic=topic;CY.messages=[];CY.round=0;CY.phase='debate';CY.stances={};CY._playerActions=[];
  _$("cy-topic").style.display="block";_$("cy-topic").innerHTML='\u8BAE\u9898\uFF1A'+escHtml(topic);
  var body=_$("cy-body");body.innerHTML="";
  // 主议大臣宣读（议题相关部门主官）
  var _mainSpeaker = _cyFindMainSpeaker(topic);
  if (mode === 'tinyi') {
    addCYBubble('\u5185\u4F8D','（宣召各臣入殿，列序而立。）',true);
    if (_mainSpeaker) {
      addCYBubble(_mainSpeaker, '（上前一步，宣读议题背景）臣' + _mainSpeaker + '奉旨宣读：' + escHtml(topic).slice(0,50) + '……请陛下及诸公议之。');
      CY.messages.push({from:_mainSpeaker,content:'宣读议题：'+topic});
    }
  } else if (mode === 'yuqian') {
    addCYBubble('\u5185\u4F8D','（内侍引' + CY.selected.length + '位大臣入御书房密议。）',true);
  } else if (mode === 'changchao') {
    // 常朝——独立流程
    _startChangchao();
    return;
  }
  _runChaoyiRound();
}

// ============================================================
// 常朝——独立流程（区别于廷议的管理决策流）
// ============================================================

/** 启动常朝——入口重导向到 2.0 */
async function _startChangchao() {
  return _cc2_openPrepareDialog();
}

/** 构建常朝AI议程生成prompt */
function _buildChangchaoPrompt() {
  var p = '你是中国古代朝廷的内侍记录官。当前回合：' + (typeof getTSText === 'function' ? getTSText(GM.turn) : 'T' + GM.turn) + '。\n';
  p += '请为今日常朝生成6-12条奏报事务。\n\n';
  // 时局要务
  if (GM.currentIssues) {
    var _pi = GM.currentIssues.filter(function(i) { return i.status === 'pending'; }).slice(0, 5);
    if (_pi.length > 0) {
      p += '【待处理时局要务——应出现在议程中】\n';
      _pi.forEach(function(i) { p += '  ' + i.title + '：' + (i.description||'').slice(0,60) + '\n'; });
    }
  }
  // 部门概况
  if (GM.officeTree && typeof _offTreeStats === 'function') {
    var ts = _offTreeStats(GM.officeTree);
    p += '官制：编制' + ts.headCount + '实有' + ts.actualCount + '缺' + (ts.headCount-ts.actualCount) + '\n';
  }
  // 军事态势
  if (GM.armies && GM.armies.length > 0) {
    var _atWar = GM.armies.filter(function(a) { return a.status === 'combat' || a.status === 'marching'; });
    if (_atWar.length > 0) p += '军事：' + _atWar.length + '支军队在行动中\n';
  }
  // 经济
  var _ecoVars = [];
  if (GM.vars) Object.entries(GM.vars).forEach(function(e) { if (e[0].indexOf('金') >= 0 || e[0].indexOf('粮') >= 0 || e[0].indexOf('钱') >= 0) _ecoVars.push(e[0] + ':' + Math.round(e[1].value)); });
  if (_ecoVars.length > 0) p += '经济：' + _ecoVars.join(' ') + '\n';
  // 近期事件
  if (GM.evtLog) {
    var _recent = GM.evtLog.slice(-5);
    if (_recent.length > 0) p += '近事：' + _recent.map(function(e) { return e.text; }).join('；').slice(0,200) + '\n';
  }
  // 在京官员（用于确定奏报者）
  var capital = GM._capital || '京城';
  var _inKy = (GM.chars||[]).filter(function(c) { return c.alive !== false && _isAtCapital(c) && !c.isPlayer && _isPlayerFactionChar(c); });
  if (_inKy.length > 0) {
    p += '在京官员：' + _inKy.slice(0, 15).map(function(c) { return c.name + '(' + (c.officialTitle||c.title||'') + ')'; }).join('、') + '\n';
  }
  p += '\n每条事务格式：\n';
  p += '{"presenter":"奏报者姓名（优先用在京官员名，无则用"某部官员"）","dept":"所属部门","type":"routine/request/warning/emergency/personnel","title":"标题10字内","announceLine":"启奏开场白15-30字（此为简短开场·将作为"启奏"阶段气泡）","content":"奏报正文（此为"奏报"阶段气泡·须遵朝议字数·见下）","recommendation":"approve/reject/discuss","urgency":"normal/urgent"}\n';
  p += '事务类型说明：routine=日常汇报 request=请求批准 warning=预警 emergency=紧急 personnel=人事\n';
  p += '（content 字数必须遵守朝议字数设置——' + (typeof _aiDialogueWordHint === 'function' ? _aiDialogueWordHint('cy').replace(/^（|）$/g,'') : '约 150-300 字') + '）\n';
  // 上次搁置的事务——应再次出现
  if (GM._ccHeldItems && GM._ccHeldItems.length > 0) {
    p += '\n【上次搁置的事务——必须包含在议程中】\n';
    GM._ccHeldItems.forEach(function(h) { p += '  ' + (h.dept||'') + '：' + (h.title||'') + '——' + (h.content||'') + '\n'; });
    // 清空（已纳入本次）
    GM._ccHeldItems = [];
  }
  // 待议的廷议题目——提醒但不纳入常朝
  if (GM._pendingTinyiTopics && GM._pendingTinyiTopics.length > 0) {
    p += '\n（注：以下题目已转廷议，不要在常朝中重复：' + GM._pendingTinyiTopics.map(function(t){ return t.topic; }).join('、') + '）\n';
  }
  // 出席官员性格（影响奏报风格）
  var _attending = CY._ccAttendees || [];
  if (_attending.length > 0) {
    p += '\n【出席官员性格——影响奏报风格】\n';
    _attending.slice(0, 12).forEach(function(a) {
      var ch = findCharByName(a.name);
      var traits = ch && ch.personality ? ch.personality.slice(0,20) : '';
      p += '  ' + a.name + '(' + (a.title||'') + ')' + (traits ? ' 性格:'+traits : '') + (a.faction ? ' 派:'+a.faction : '') + '\n';
    });
    p += '  勤勉者→汇报详尽；懒惰者→敷衍了事；贪腐者→隐瞒问题\n';
  }
  // 派系信息
  var _facs = {};
  _attending.forEach(function(a) { if (a.faction) { if (!_facs[a.faction]) _facs[a.faction] = []; _facs[a.faction].push(a.name); } });
  if (Object.keys(_facs).length > 1) {
    p += '【派系——影响冲突和联动】\n';
    Object.keys(_facs).forEach(function(f) { p += '  ' + f + '：' + _facs[f].join('、') + '\n'; });
  }
  // 扩展类型
  p += '\n【额外事务类型】\n';
  p += '  personal_plea: NPC个人请旨（致仕/追谥/赦免亲属）\n';
  p += '  confrontation: 朝堂冲突——需attacker和target字段\n';
  p += '  joint_petition: 联名上奏——presenter填"张三、李四等N人"\n';
  p += '【要求】至少1条confrontation或personal_plea。每条可加reaction字段（他人暗中反应20字）。\n';
  // 裁决倾向学习
  if (GM._lastChangchaoDecisions && GM._lastChangchaoDecisions.length > 0) {
    var _ac = GM._lastChangchaoDecisions.filter(function(d){return d.action==='approve';}).length;
    var _rc = GM._lastChangchaoDecisions.filter(function(d){return d.action==='reject';}).length;
    p += '【皇帝上次裁决倾向】准' + _ac + '驳' + _rc + '——NPC据此调整措辞\n';
  }
  p += '返回JSON数组。涵盖多个部门，不要全是同一类型。';
  return p;
}

/** 生成突发事务（基于游戏状态概率触发） */
function _genEmergencyItem() {
  // 有战争进行中→30%概率战报
  if (GM.armies && GM.armies.some(function(a) { return a.status === 'combat'; })) {
    if (Math.random() < 0.3) {
      return { presenter: '兵部官员', dept: '兵部', type: 'emergency', title: '前线急报', content: '战事有新进展，请陛下裁决。', recommendation: 'discuss', urgency: 'urgent', _generated: true };
    }
  }
  return null;
}

/** 渲染常朝议程卡片 */
function _renderChangchaoAgenda() {
  var body = _$('cy-body'); var footer = _$('cy-footer');
  if (!body) return;
  // 清除旧内容但保留鸣鞭
  var items = CY._ccItems || [];
  if (items.length === 0) {
    addCYBubble('内侍', '（百官无事启奏。）', true);
    footer.innerHTML = '<div style="text-align:center;"><button class="bt bp" onclick="_ccEndCourt()">卷帘退朝</button></div>';
    return;
  }

  var html = '';
  items.forEach(function(item, idx) {
    var decided = CY._ccDecisions.find(function(d) { return d.idx === idx; });
    var urgClr = item.urgency === 'urgent' ? 'var(--vermillion-400)' : 'var(--color-border-subtle)';
    var urgTag = item.urgency === 'urgent' ? '<span style="font-size:0.65rem;background:rgba(231,76,60,0.15);color:var(--vermillion-400);padding:1px 4px;border-radius:3px;">\u2757\u6025</span>' : '';
    var typeLabels = { routine: '\u65E5\u5E38', request: '\u8BF7\u6307', warning: '\u9884\u8B66', emergency: '\u7D27\u6025', personnel: '\u4EBA\u4E8B', announcement: '\u5BA3\u544A' };
    var typeTag = '<span style="font-size:0.6rem;color:var(--ink-300);background:var(--color-surface);padding:1px 3px;border-radius:2px;">' + (typeLabels[item.type]||item.type) + '</span>';

    html += '<div class="cc-item" id="cc-item-' + idx + '" style="padding:var(--space-3);background:var(--color-surface);border:1px solid ' + urgClr + ';border-left:3px solid ' + urgClr + ';border-radius:var(--radius-md);margin-bottom:var(--space-2);' + (decided ? 'opacity:0.6;' : '') + '">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-1);">';
    html += '<div><span style="font-size:var(--text-xs);color:var(--gold-400);font-weight:var(--weight-bold);">' + escHtml(item.dept||'') + '</span> · <span style="font-size:var(--text-xs);color:var(--color-foreground-muted);">' + escHtml(item.presenter||'') + '</span></div>';
    html += '<div>' + typeTag + ' ' + urgTag + '</div>';
    html += '</div>';
    html += '<div style="font-size:var(--text-sm);font-weight:var(--weight-bold);color:var(--color-foreground);margin-bottom:2px;">' + escHtml(item.title||'') + '</div>';
    html += '<div style="font-size:var(--text-xs);color:var(--color-foreground-secondary);line-height:1.5;margin-bottom:var(--space-2);">' + escHtml(item.content||'') + '</div>';

    if (decided) {
      var _dLabels = { approve: '\u2705\u51C6', reject: '\u274C\u9A73', discuss: '\u2192\u8F6C\u5EF7\u8BAE', hold: '\u23F8\u7559', ask: '\u2753\u5DF2\u8FFD\u95EE' };
      html += '<div style="font-size:var(--text-xs);color:var(--gold-400);">' + (_dLabels[decided.action]||decided.action) + '</div>';
      // NPC即时反应
      if (decided._reaction) html += '<div style="font-size:0.65rem;color:var(--color-foreground-muted);font-style:italic;margin-top:2px;">' + escHtml(decided._reaction) + '</div>';
    } else if (item.type === 'confrontation') {
      // 对质特殊按钮
      html += '<div style="display:flex;gap:var(--space-1);flex-wrap:wrap;">';
      html += '<button class="bt bp bsm" onclick="_ccDecide(' + idx + ',\'approve\')">\u67E5\u529E</button>';
      html += '<button class="bt bsm" style="color:var(--vermillion-400);" onclick="_ccDecide(' + idx + ',\'reject\')">\u9A73\u56DE\u5F39\u52BE</button>';
      html += '<button class="bt bsm" onclick="_ccDecide(' + idx + ',\'discuss\')">\u4EE4\u5F53\u5EF7\u5BF9\u8D28</button>';
      html += '<button class="bt bsm" onclick="_ccAsk(' + idx + ')">\u95EE</button>';
      html += '</div>';
    } else {
      html += '<div style="display:flex;gap:var(--space-1);flex-wrap:wrap;">';
      html += '<button class="bt bp bsm" onclick="_ccDecide(' + idx + ',\'approve\')">\u51C6</button>';
      html += '<button class="bt bsm" style="color:var(--vermillion-400);" onclick="_ccDecide(' + idx + ',\'reject\')">\u9A73</button>';
      html += '<button class="bt bsm" onclick="_ccDecide(' + idx + ',\'discuss\')">\u8BAE</button>';
      html += '<button class="bt bsm" onclick="_ccDecide(' + idx + ',\'hold\')">\u7559</button>';
      html += '<button class="bt bsm" onclick="_ccAsk(' + idx + ')">\u95EE</button>';
      html += '</div>';
    }
    // 暗流线索
    if (item.reaction) {
      html += '<div style="font-size:0.6rem;color:var(--amber-400);font-style:italic;margin-top:2px;">（' + escHtml(item.reaction) + '）</div>';
    }
    // 追问展开区
    html += '<div id="cc-ask-' + idx + '" style="display:none;margin-top:var(--space-2);border-top:1px solid var(--color-border-subtle);padding-top:var(--space-2);"></div>';
    html += '</div>';
  });

  // 统计
  var _total = items.length;
  var _done = CY._ccDecisions.length;
  html += '<div style="text-align:center;font-size:var(--text-xs);color:var(--color-foreground-muted);padding:var(--space-2);">共' + _total + '条事务，已处理' + _done + '条</div>';

  // 用一个容器包裹所有卡片
  var container = _$('cc-agenda-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'cc-agenda-container';
    body.appendChild(container);
  }
  container.innerHTML = html;

  // footer with full controls——传召名单：分"在京缺朝"和"远地召入"两组
  var _loc = _getPlayerLocation();
  var _summonInCapital = (GM.chars||[]).filter(function(c) { return c.alive !== false && _isAtCapital(c) && !c.isPlayer && _isPlayerFactionChar(c) && !CY._ccAttendees.some(function(a){return a.name===c.name;}); });
  var _summonRemote = (GM.chars||[]).filter(function(c) { return c.alive !== false && !c.isPlayer && _isPlayerFactionChar(c) && !_isAtCapital(c) && !c._retired && !CY._ccAttendees.some(function(a){return a.name===c.name;}); }).slice(0, 30);
  var _summonOpts = '';
  if (_summonInCapital.length > 0) {
    _summonOpts += '<optgroup label="在京缺朝">';
    _summonInCapital.forEach(function(c) { _summonOpts += '<option value="' + escHtml(c.name) + '">' + escHtml(c.name) + (c.officialTitle ? '(' + escHtml(c.officialTitle) + ')' : '') + '</option>'; });
    _summonOpts += '</optgroup>';
  }
  if (_summonRemote.length > 0) {
    _summonOpts += '<optgroup label="远地召入(即刻启程)">';
    _summonRemote.forEach(function(c) { _summonOpts += '<option value="' + escHtml(c.name) + '">' + escHtml(c.name) + (c.officialTitle?'(' + escHtml(c.officialTitle) + ')':'') + ' 在' + escHtml(c.location||'?') + '</option>'; });
    _summonOpts += '</optgroup>';
  }
  footer.innerHTML = '<div style="display:flex;gap:var(--space-1);justify-content:center;align-items:center;flex-wrap:wrap;">'
    + '<button class="bt bsm" onclick="_ccBatchApprove()" title="\u6240\u6709\u65E5\u5E38\u4E00\u5F8B\u51C6">\u6279\u51C6\u65E5\u5E38</button>'
    + '<button class="bt bsm" onclick="_ccBatchHold()" title="\u672A\u5904\u7406\u7684\u5168\u90E8\u6401\u7F6E">\u6279\u7559</button>'
    + '<button class="bt" onclick="_ccAnnounce()">\u5BA3\u8C15</button>'
    + '<select id="cc-summon-sel" style="font-size:0.68rem;padding:1px 3px;background:var(--bg-3);border:1px solid var(--bdr);color:var(--txt);border-radius:3px;"><option value="">\u4F20\u53EC\u2026</option>' + _summonOpts + '</select>'
    + '<button class="bt bsm" onclick="_ccSummon()" title="\u4F20\u53EC\u67D0\u4EBA\u4E0A\u671D">\u53EC</button>'
    + '<button class="bt bsm" style="color:var(--vermillion-400);" onclick="_ccEarlyDismiss()" title="\u63D0\u524D\u7ED3\u675F\u671D\u4F1A">\u9000\u671D</button>'
    + '<button class="bt bp" onclick="_ccEndCourt()">\u5377\u5E18\u9000\u671D</button>'
    + '</div>';
}

/** 常朝裁决 */
function _ccDecide(idx, action) {
  var item = CY._ccItems[idx];
  if (!item) return;
  CY._ccDecisions.push({ idx: idx, action: action, item: item });

  // NPC即时反应
  var _reaction = '';
  var _presenter = findCharByName(item.presenter);
  if (action === 'approve' && _presenter) {
    _reaction = item.presenter + '：\u201C\u81E3\u8C22\u6069\u3002\u201D';
  } else if (action === 'reject' && _presenter) {
    if ((_presenter.loyalty||50) > 70) _reaction = item.presenter + '：\u201C\u81E3\u2026\u2026\u9075\u65E8\u3002\u201D（面色沉重）';
    else _reaction = item.presenter + '（面色一沉，退回班列）';
  }
  // 旁观者反应——对立派可能幸灾乐祸
  if (action === 'reject' && item.presenter) {
    CY._ccAttendees.forEach(function(a) {
      if (a.name === item.presenter) return;
      var _ach = findCharByName(a.name);
      if (_ach && _ach.faction && _presenter && _presenter.faction && _ach.faction !== _presenter.faction) {
        if (Math.random() < 0.3) _reaction += '（' + a.name + '嘴角微扬）';
      }
    });
  }
  CY._ccDecisions[CY._ccDecisions.length - 1]._reaction = _reaction;

  // 即时效果
  var _date = typeof getTSText === 'function' ? getTSText(GM.turn) : '';
  if (action === 'approve') {
    // 准→写入诏令追踪
    if (!GM._edictTracker) GM._edictTracker = [];
    GM._edictTracker.push({ id: (typeof uid === 'function' ? uid() : 'cc_' + idx), content: item.title + '：' + item.content, category: item.dept||'常朝', turn: GM.turn, status: 'pending', assignee: item.presenter||'', feedback: '', progressPercent: 0, source: 'changchao' });
    if (typeof addEB === 'function') addEB('常朝', '准：' + item.title);
  } else if (action === 'reject') {
    if (typeof addEB === 'function') addEB('常朝', '驳：' + item.title);
    // 奏报者记忆
    if (item.presenter && typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
      var _pch = findCharByName(item.presenter);
      if (_pch) NpcMemorySystem.remember(item.presenter, '常朝所奏「' + item.title + '」被驳回', '忧', 4);
    }
  } else if (action === 'discuss') {
    // 转廷议——记录待议题目
    if (!GM._pendingTinyiTopics) GM._pendingTinyiTopics = [];
    GM._pendingTinyiTopics.push({ topic: item.title + '：' + item.content, from: item.presenter, turn: GM.turn });
    if (typeof addEB === 'function') addEB('常朝', '转廷议：' + item.title);
    toast('已加入廷议待议——下次开廷议时可选此题');
  } else if (action === 'hold') {
    // 留→下次常朝再出现
    if (!GM._ccHeldItems) GM._ccHeldItems = [];
    GM._ccHeldItems.push(item);
  }

  // ── 多方互动：触发在场 NPC 的即时反应（1-2 条朝堂对话气泡） ──
  _ccTriggerCourtReactions(item, action);

  _renderChangchaoAgenda();
}

/** 常朝开场气氛——朝会刚开始时，AI 生成 1-2 条即兴氛围台词（非议程事务） */
async function _ccGenOpeningAtmosphere() {
  if (!P.ai || !P.ai.key) return;
  if (!CY._ccAttendees || CY._ccAttendees.length < 2) return;
  if (Math.random() > 0.65) return; // 65% 概率触发
  var _sample = CY._ccAttendees.slice().sort(function(){return Math.random()-0.5;}).slice(0, 3);
  var _date = typeof getTSText === 'function' ? getTSText(GM.turn) : ('T' + GM.turn);
  var prompt = '今日常朝开幕——' + _date + '。皇帝御殿，百官列班候旨。尚未进入奏事。\n';
  prompt += '请为以下 ' + _sample.length + ' 位在场官员生成一句入殿前/候旨时的即兴台词或低语（20-45 字，半文言，符合身份心境）：\n';
  _sample.forEach(function(a) {
    var ch = findCharByName(a.name);
    prompt += '  ' + a.name + '（' + (a.title||'') + (a.faction?'·'+a.faction:'') + '，性格:' + ((ch && ch.personality)||'') + '）\n';
    // 认知画像（由 sc07 生成）
    if (typeof getNpcCognitionSnippet === 'function') {
      var _snip = getNpcCognitionSnippet(a.name, { short: true });
      if (_snip) prompt += '    ' + _snip.replace(/\n/g, ' ').replace(/\u3010\u8BE5\u81E3\u6B64\u65F6\u8BA4\u77E5\u3011/g, '\u8BA4\u77E5\uFF1A').trim() + '\n';
    }
  });
  prompt += '内容类型：忧国/冷眼旁观/与同僚窃语/默念近况/期待奏事/玩味皇帝近日举措。不要议论具体政策（那是后续奏报的事）。\n';
  prompt += '\u203B \u4E0A\u8FF0"\u8BA4\u77E5"\u662F\u6BCF\u4EBA\u7684\u771F\u5B9E\u4FE1\u606F\u638C\u63E1\u2014\u2014\u53F0\u8BCD\u8981\u4F53\u73B0\u8BE5\u4EBA\u5FC3\u5FF5\u4E0E\u4FE1\u606F\u4E0D\u5BF9\u79F0\uFF0C\u4E0D\u8981\u88C5\u4F5C\u77E5\u9053\u4E0D\u77E5\u7684\u4E8B\u3002\n';
  prompt += (typeof _aiDialogueWordHint === 'function' ? _aiDialogueWordHint() + '\n' : '');
  prompt += '返回 JSON 数组：[{"name":"...","line":"..."}]';
  try {
    var raw = await callAI(prompt, (typeof _aiDialogueTok==='function'?_aiDialogueTok("cy", _sample.length):500));
    var arr = (typeof extractJSON === 'function') ? extractJSON(raw) : null;
    if (!Array.isArray(arr)) return;
    arr.forEach(function(r) {
      if (!r || !r.name || !r.line) return;
      addCYBubble(r.name, r.line, false);
    });
  } catch(e) { /* 静默 */ }
}

/** 触发朝堂即时反应——附和/反驳/弹劾/劝谏 */
async function _ccTriggerCourtReactions(item, action) {
  if (!item || !P.ai || !P.ai.key) return;
  if (!CY._ccAttendees || CY._ccAttendees.length < 2) return;
  // 40% 概率触发交锋（避免每次都来）
  if (Math.random() > 0.4) return;

  var presenter = item.presenter || '';
  var presenterCh = findCharByName(presenter);
  // 挑选 1-3 个可能有反应的 NPC
  var _candidates = CY._ccAttendees.filter(function(a) { return a.name !== presenter; }).slice(0, 20);
  if (_candidates.length === 0) return;

  // 优先挑对立派系 / 高情绪人物
  var _scored = _candidates.map(function(a) {
    var ch = findCharByName(a.name);
    var score = Math.random() * 10;
    if (ch) {
      // 对立派系加分
      if (presenterCh && ch.faction && presenterCh.faction && ch.faction !== presenterCh.faction) score += 8;
      // 同党加分（附和）
      if (presenterCh && ch.party && presenterCh.party && ch.party === presenterCh.party) score += 5;
      // 御史谏官加分
      if (/御史|谏|给事中/.test(ch.officialTitle||ch.title||'')) score += 10;
      // 忠诚低 → 可能借题发挥
      if ((ch.loyalty||50) < 40) score += 3;
      // 压力大 → 可能失态
      if ((ch.stress||0) > 60) score += 2;
    }
    return { a: a, score: score };
  }).sort(function(x,y){return y.score-x.score;});

  var _reactors = _scored.slice(0, Math.min(3, Math.max(2, Math.floor(Math.random() * 3) + 2))).map(function(s){return s.a;});

  var _actionLbl = {approve:'准',reject:'驳',discuss:'付廷议',hold:'留中',ask:'追问'}[action] || action;

  // 逐人逐轮生成（2 轮），玩家若在发言框插话则用户发言纳入上下文
  var _turnTranscript = '';  // 累计全场对话用于上下文
  for (var _round = 1; _round <= 2; _round++) {
    for (var _ri = 0; _ri < _reactors.length; _ri++) {
      // 检查玩家是否中途打断
      if (CY._pendingPlayerLine) {
        var pline = CY._pendingPlayerLine;
        CY._pendingPlayerLine = null;
        var _pName = (P.playerInfo && P.playerInfo.characterName) || '陛下';
        addCYBubble(_pName, pline, true);
        _turnTranscript += '\n' + _pName + '：' + pline;
      }
      if (CY._abortChaoyi) return;

      var a = _reactors[_ri];
      var ch = findCharByName(a.name);
      var p = '朝堂即时反应（第' + _round + '轮）——皇帝刚对「' + (item.title||'') + '」（' + (presenter||'?') + '所奏）裁决：' + _actionLbl + '。\n';
      p += '当前发言者：' + a.name + '（' + (a.title||'') + (a.faction?'·'+a.faction:'') + '，性格:' + ((ch && ch.personality)||'') + (ch && ch.loyalty!=null?'，忠'+Math.round(ch.loyalty):'') + '）\n';
      // 认知画像（sc07）
      if (typeof getNpcCognitionSnippet === 'function') {
        var _cogSnip = getNpcCognitionSnippet(a.name);
        if (_cogSnip) p += _cogSnip;
      }
      if (_turnTranscript) p += '\n已发生的对话：\n' + _turnTranscript.slice(-1500) + '\n';
      p += '\n请以 ' + a.name + ' 的身份说出这一轮的话（文言或半文言，按其身份/立场/当前情绪·结合认知画像）。\n';
      p += (typeof _aiDialogueWordHint === 'function' ? _aiDialogueWordHint('cy') + '（发言必须达到此字数范围）\n' : '（约 150-300 字）\n');
      p += '可选类型：附议/反驳/弹劾/劝谏/讽喻/冷眼/窃笑。\n';
      p += '返回 JSON：{"type":"附议/反驳/弹劾/...","line":"此人发言（达到字数要求）"}';

      try {
        if (CY._abortChaoyi) return;
        var raw = await callAI(p, (typeof _aiDialogueTok==='function'?_aiDialogueTok("cy", 1):800));
        var r = (typeof extractJSON === 'function') ? extractJSON(raw) : null;
        if (!r || !r.line) continue;
        addCYBubble(a.name, '〔' + (r.type||'') + '〕' + r.line, false);
        _turnTranscript += '\n' + a.name + '：' + r.line;
        if (typeof NpcMemorySystem !== 'undefined') {
          var _emo = r.type === '附议' ? '喜' : (r.type === '反驳' || r.type === '弹劾') ? '怒' : (r.type === '劝谏' ? '忧' : '平');
          NpcMemorySystem.remember(a.name, '常朝上就「' + (item.title||'') + '」' + (r.type||'发言') + '——' + r.line.slice(0,40), _emo, 4);
        }
      } catch (e) { /* 单人失败跳过，继续 */ }
    }
  }
}

/** 常朝追问——展开inline微型问答 */
async function _ccAsk(idx) {
  var item = CY._ccItems[idx];
  if (!item) return;
  var askEl = _$('cc-ask-' + idx);
  if (!askEl) return;
  askEl.style.display = 'block';
  askEl.innerHTML = '<div style="display:flex;gap:var(--space-1);align-items:center;">'
    + '<input id="cc-ask-input-' + idx + '" placeholder="\u8FFD\u95EE\u2026\u2026" style="flex:1;padding:3px 6px;font-size:var(--text-xs);background:var(--color-elevated);border:1px solid var(--color-border);border-radius:var(--radius-sm);color:var(--color-foreground);font-family:inherit;">'
    + '<button class="bt bp bsm" onclick="_ccDoAsk(' + idx + ')">\u95EE</button>'
    + '</div>';
  _$('cc-ask-input-' + idx).focus();
}

async function _ccDoAsk(idx) {
  var item = CY._ccItems[idx];
  if (!item) return;
  var input = _$('cc-ask-input-' + idx);
  var question = input ? input.value.trim() : '';
  if (!question) question = '此事详情如何？';
  var askEl = _$('cc-ask-' + idx);
  if (!askEl) return;

  // 显示追问
  askEl.innerHTML = '<div style="font-size:var(--text-xs);color:var(--gold-400);margin-bottom:2px;">帝：' + escHtml(question) + '</div>'
    + '<div style="font-size:var(--text-xs);color:var(--color-foreground-muted);">（' + escHtml(item.presenter||'官员') + '回奏中……）</div>';

  // AI生成回答
  var ch = findCharByName(item.presenter);
  var brief = ch ? (ch.personality || '') : '';
  var _cogPresenter = (typeof getNpcCognitionSnippet === 'function') ? getNpcCognitionSnippet(item.presenter) : '';
  var prompt = '你扮演' + (item.presenter||'官员') + '（' + (item.dept||'') + '），皇帝在常朝上追问你的奏报。\n'
    + '你的奏报：' + item.title + '——' + item.content + '\n'
    + '皇帝问：' + question + '\n'
    + (brief ? '你的性格：' + brief + '\n' : '')
    + (_cogPresenter || '')
    + (typeof _aiDialogueWordHint === 'function' ? _aiDialogueWordHint() + '\n' : '')
    + '用臣子口吻直接输出回答（言语必须符合 speechThread 口吻，让人一听就是此人）。\n'
    + '若问及 doesntKnow 中之事——按人物性格+五常+特质决定应对方式：忠义坦诚者直言"不知"请罪，机巧者敷衍转移，不懂装懂者模糊编造，心机深沉者似是而非，傲慢者拒答反问，自卑者过度解释。不要千篇一律！';
  try {
    var reply = await callAI(prompt, (typeof _aiDialogueTok==='function'?_aiDialogueTok("cy", 1):300));
    askEl.innerHTML = '<div style="font-size:var(--text-xs);color:var(--gold-400);margin-bottom:2px;">帝：' + escHtml(question) + '</div>'
      + '<div style="font-size:var(--text-xs);color:var(--color-foreground);line-height:1.5;">' + escHtml(item.presenter||'') + '：' + escHtml(reply) + '</div>'
      + '<div style="display:flex;gap:var(--space-1);margin-top:var(--space-1);">'
      + '<button class="bt bp bsm" onclick="_ccDecide(' + idx + ',\'approve\')">\u51C6</button>'
      + '<button class="bt bsm" style="color:var(--vermillion-400);" onclick="_ccDecide(' + idx + ',\'reject\')">\u9A73</button>'
      + '</div>';
    // 记录起居注
    if (GM.qijuHistory) GM.qijuHistory.unshift({ turn: GM.turn, date: typeof getTSText === 'function' ? getTSText(GM.turn) : '', content: '【常朝】帝问' + (item.presenter||'') + '：' + question + '。对曰：' + reply });
    // 标记已追问
    CY._ccDecisions.push({ idx: idx, action: 'ask', item: item });
  } catch(e) {
    askEl.innerHTML += '<div style="color:var(--red);font-size:var(--text-xs);">回奏失败</div>';
  }
}

/** 批量准——所有routine类型一律approve */
function _ccBatchApprove() {
  var count = 0;
  CY._ccItems.forEach(function(item, idx) {
    if (item.type === 'routine' && !CY._ccDecisions.find(function(d){return d.idx===idx;})) {
      CY._ccDecisions.push({ idx: idx, action: 'approve', item: item, _reaction: '' });
      if (!GM._edictTracker) GM._edictTracker = [];
      GM._edictTracker.push({ id: (typeof uid === 'function' ? uid() : 'cc_'+idx), content: item.title + '：' + item.content, category: item.dept||'常朝', turn: GM.turn, status: 'pending', assignee: item.presenter||'', source: 'changchao' });
      count++;
    }
  });
  toast('批准' + count + '条日常事务');
  _renderChangchaoAgenda();
}

/** 批量留——未处理的全部搁置 */
function _ccBatchHold() {
  var count = 0;
  CY._ccItems.forEach(function(item, idx) {
    if (!CY._ccDecisions.find(function(d){return d.idx===idx;})) {
      CY._ccDecisions.push({ idx: idx, action: 'hold', item: item });
      if (!GM._ccHeldItems) GM._ccHeldItems = [];
      GM._ccHeldItems.push(item);
      count++;
    }
  });
  toast('搁置' + count + '条事务');
  _renderChangchaoAgenda();
}

/** 传召——允许玩家传召不在朝会中的在京角色 */
/** 传召——朝会中或朝会前传召角色 */
function _ccSummon() {
  var sel = _$('cc-summon-sel');
  var name = sel ? sel.value : '';
  if (!name) { toast('请选择要传召的人'); return; }
  var ch = findCharByName(name);
  if (!ch) return;
  var _hasOffice = ch.officialTitle || ch.title;

  // 弹窗：选择传召方式
  var bg = document.createElement('div');
  bg.style.cssText = 'position:fixed;inset:0;z-index:1200;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;';
  var html = '<div style="background:var(--color-surface);border:1px solid var(--gold-500);border-radius:var(--radius-lg);padding:1.2rem 1.5rem;max-width:380px;">';
  html += '<div style="font-size:var(--text-sm);color:var(--color-primary);margin-bottom:var(--space-2);">传召 ' + escHtml(name) + '</div>';
  html += '<div style="font-size:0.72rem;color:var(--color-foreground-muted);margin-bottom:var(--space-3);">' + escHtml(ch.officialTitle||'无官职') + (ch.faction ? ' · ' + escHtml(ch.faction) : '') + '</div>';
  if (!_hasOffice) {
    html += '<div style="font-size:0.7rem;color:var(--vermillion-400);margin-bottom:var(--space-2);">⚠ 此人无朝职——传召上朝恐引百官非议</div>';
  }
  html += '<div style="display:flex;flex-direction:column;gap:var(--space-2);">';
  html += '<button class="bt bp" onclick="_ccDoSummon(\'' + escHtml(name).replace(/'/g,"\\'") + '\',false);this.closest(\'div[style*=fixed]\').remove();">直接传召上朝</button>';
  html += '<button class="bt bs" onclick="_ccDoSummon(\'' + escHtml(name).replace(/'/g,"\\'") + '\',true);this.closest(\'div[style*=fixed]\').remove();">先私下交谈再决定</button>';
  html += '<button class="bt" onclick="this.closest(\'div[style*=fixed]\').remove();">取消</button>';
  html += '</div></div>';
  bg.innerHTML = html;
  document.body.appendChild(bg);
}

/** 执行传召 */
function _ccDoSummon(name, talkFirst) {
  var ch = findCharByName(name);
  if (!ch) return;

  if (talkFirst) {
    // 先私下交谈——打开问对弹窗，交谈结束后回到朝会
    // 暂时关闭朝会modal（不销毁状态）
    var modal = _$('chaoyi-modal');
    if (modal) modal.style.display = 'none';
    if (typeof openWenduiModal === 'function') {
      openWenduiModal(name, 'private', '朕欲召你参加朝会，你意下如何？');
      // 交谈结束后恢复朝会——通过一个按钮
      setTimeout(function() {
        var _wdFooter = document.querySelector('.wd-modal-footer');
        if (_wdFooter) {
          var _backBtn = document.createElement('button');
          _backBtn.className = 'bt bs bsm';
          _backBtn.style.cssText = 'margin-left:var(--space-2);';
          _backBtn.textContent = '返回朝会';
          _backBtn.onclick = function() {
            // 关闭问对
            var _wdBg = document.querySelector('.wd-modal-inner');
            if (_wdBg) { var _p = _wdBg.closest('.modal-bg'); if (_p) _p.remove(); }
            // 恢复朝会
            if (modal) modal.style.display = '';
            // 提供"确认传召/取消"选择
            addCYBubble('\u5185\u4F8D', '（与' + name + '交谈完毕，是否传召其上朝？）', true);
            var body = _$('cy-body');
            if (body) {
              var _confirmDiv = document.createElement('div');
              _confirmDiv.style.cssText = 'text-align:center;margin:var(--space-2) 0;';
              _confirmDiv.innerHTML = '<button class="bt bp bsm" onclick="_ccConfirmSummon(\'' + name.replace(/'/g,"\\'") + '\');this.parentNode.remove();">确认传召</button> '
                + '<button class="bt bsm" onclick="addCYBubble(\'内侍\',\'（陛下决定不传召' + escHtml(name) + '。）\',true);this.parentNode.remove();">不召</button>';
              body.appendChild(_confirmDiv);
              body.scrollTop = body.scrollHeight;
            }
          };
          _wdFooter.appendChild(_backBtn);
        }
      }, 500);
    } else {
      toast('问对模块未加载');
      if (modal) modal.style.display = '';
    }
    return;
  }

  // 直接传召
  _ccConfirmSummon(name);
}

/** 确认传召——将人加入朝会 */
function _ccConfirmSummon(name) {
  var ch = findCharByName(name);
  if (!ch) return;
  var _hasOffice = ch.officialTitle || ch.title;
  CY._ccAttendees.push({ name: ch.name, title: ch.officialTitle||ch.title||'', faction: ch.faction||'' });
  addCYBubble('\u5185\u4F8D', '（传召' + name + '上朝。' + name + '入殿列于班末。）', true);

  if (!_hasOffice) {
    addCYBubble('\u5185\u4F8D', '（百官面露讶色——' + name + '并无朝职，何以列于殿上？）', true);
    (CY._ccAttendees||[]).forEach(function(a) {
      if (a.name !== name && typeof NpcMemorySystem !== 'undefined') {
        NpcMemorySystem.remember(a.name, '皇帝在常朝中传召无朝职的' + name + '，甚为蹊跷', '疑', 3);
      }
    });
  }

  // 传召行为本身可能引发新议程——AI生成朝堂对传召的反应
  toast(name + '已传召上朝');
  _ccGenSummonReactions(name, _hasOffice);
}

/** 传召后AI生成朝堂反应议程（0-2条） */
async function _ccGenSummonReactions(summonedName, hasOffice) {
  if (!P.ai || !P.ai.key) { _renderChangchaoAgenda(); return; }
  var ch = findCharByName(summonedName);
  var _attendeeNames = (CY._ccAttendees||[]).map(function(a){ return a.name; }).join('、');
  var prompt = '朝会进行中，皇帝突然传召' + summonedName + '（' + (ch ? (ch.officialTitle||ch.title||'无官职') : '?') + '）上朝。\n'
    + (hasOffice ? '' : '此人无朝职——百官讶异。\n')
    + '在场官员：' + _attendeeNames + '\n'
    + '请生成0-2条因传召引发的朝堂反应事务。可能包括：\n'
    + '· 某位御史/言官质疑传召的合理性（confrontation类型）\n'
    + '· 被召者主动奏报某事（如果其有重要事务）\n'
    + '· 某位大臣借机提出与被召者相关的事务\n'
    + '· 如无特别反应则返回空数组[]\n'
    + '返回JSON数组，格式同常朝事务：[{"presenter":"","dept":"","type":"","title":"","content":"","urgency":"normal","reaction":""}]';
  try {
    var raw = await callAI(prompt, 1500);
    var items = (typeof extractJSON === 'function') ? extractJSON(raw) : null;
    if (Array.isArray(items) && items.length > 0) {
      items.forEach(function(item) { CY._ccItems.push(item); });
    }
  } catch(e) { /* 静默 */ }
  _renderChangchaoAgenda();
}

/** 提前退朝——NPC会有反应 */
function _ccEarlyDismiss() {
  var _undecided = CY._ccItems.filter(function(item, idx) { return !CY._ccDecisions.find(function(d){return d.idx===idx;}); });
  if (_undecided.length === 0) { _ccEndCourt(); return; }
  addCYBubble('\u5185\u4F8D', '（陛下示意退朝——尚有' + _undecided.length + '条事务未议。）', true);
  // NPC反应——勤勉者不满，佞臣乐见
  var _reactions = [];
  CY._ccAttendees.forEach(function(a) {
    var ch = findCharByName(a.name);
    if (!ch) return;
    if ((ch.loyalty||50) > 70 && (ch.administration||50) > 60) {
      _reactions.push(a.name + '面露忧色');
      if (typeof NpcMemorySystem !== 'undefined') NpcMemorySystem.remember(a.name, '皇帝提前退朝，尚有' + _undecided.length + '条要务未议', '忧', 3);
    }
  });
  if (_reactions.length > 0) {
    addCYBubble('\u5185\u4F8D', '（' + _reactions.slice(0,3).join('；') + '。）', true);
  }
  // 未决事务全部搁置
  _undecided.forEach(function(item) {
    if (!GM._ccHeldItems) GM._ccHeldItems = [];
    GM._ccHeldItems.push(item);
  });
  setTimeout(function() { _ccEndCourt(); }, 600);
}

/** 常朝宣谕——玩家当场宣布事项 */
function _ccAnnounce() {
  showPrompt('宣谕内容：', '', function(decree) {
    if (!decree) return;
    addCYBubble('内侍', '（宣读圣谕）' + decree, true);
    if (!GM._edictSuggestions) GM._edictSuggestions = [];
    GM._edictSuggestions.push({ source: '常朝', from: '宣谕', content: decree, turn: GM.turn, used: false });
    if (typeof _renderEdictSuggestions === 'function') _renderEdictSuggestions();
    if (GM.qijuHistory) GM.qijuHistory.unshift({ turn: GM.turn, date: typeof getTSText === 'function' ? getTSText(GM.turn) : '', content: '【常朝】帝当朝宣谕：' + decree });
    toast('圣谕已宣读');
  });
}

/** 退朝——记录所有裁决 */
function _ccEndCourt() {
  // 记录到起居注
  var _date = typeof getTSText === 'function' ? getTSText(GM.turn) : '';
  var _summary = CY._ccDecisions.map(function(d) {
    var lbl = { approve: '准', reject: '驳', discuss: '转议', hold: '留', ask: '追问' };
    return (lbl[d.action]||d.action) + '：' + (d.item.title||'');
  }).join('；');
  if (GM.qijuHistory && _summary) GM.qijuHistory.unshift({ turn: GM.turn, date: _date, content: '【常朝】裁决：' + _summary });

  // 记录到courtRecords · postTurn 则 targetTurn=GM.turn+1
  if (!GM._courtRecords) GM._courtRecords = [];
  var _isPostTurnCC = !!GM._isPostTurnCourt;
  GM._courtRecords.push({
    turn: GM.turn, targetTurn: _isPostTurnCC ? (GM.turn + 1) : GM.turn,
    topic: '常朝', mode: 'changchao',
    phase: _isPostTurnCC ? 'post-turn' : 'in-turn',
    participants: (CY._ccAttendees||[]).map(function(a){return a.name;}),
    stances: {}, adopted: CY._ccDecisions.filter(function(d) { return d.action === 'approve'; }).map(function(d) { return { author: d.item.presenter, content: d.item.title }; }),
    _decisions: CY._ccDecisions,
    dismissed: false
  });
  if (GM._courtRecords.length > 8) GM._courtRecords.shift();
  // 勤政计数
  if (typeof recordCourtHeld === 'function') recordCourtHeld({ isPostTurn: _isPostTurnCC });

  // 保存常朝裁决到GM（供AI推演读取）
  GM._lastChangchaoDecisions = CY._ccDecisions.map(function(d) {
    return { action: d.action, dept: d.item.dept, title: d.item.title, content: d.item.content, presenter: d.item.presenter };
  });

  addCYBubble('\u5185\u4F8D', '（卷帘退朝。）', true);
  // 退朝统计面板
  var _stats = { approve: 0, reject: 0, discuss: 0, hold: 0, ask: 0 };
  CY._ccDecisions.forEach(function(d) { _stats[d.action] = (_stats[d.action]||0) + 1; });
  var body = _$('cy-body');
  if (body) {
    var statDiv = document.createElement('div');
    statDiv.style.cssText = 'background:var(--color-elevated);border:1px solid var(--gold-500);border-radius:var(--radius-md);padding:var(--space-3);margin:var(--space-3) 0;text-align:center;';
    statDiv.innerHTML = '<div style="font-size:var(--text-sm);color:var(--gold-400);font-weight:var(--weight-bold);margin-bottom:var(--space-2);">\u4ECA\u65E5\u5E38\u671D\u7EDF\u8BA1</div>'
      + '<div style="display:flex;gap:var(--space-3);justify-content:center;font-size:var(--text-xs);">'
      + '<span style="color:var(--celadon-400);">\u51C6 ' + _stats.approve + '</span>'
      + '<span style="color:var(--vermillion-400);">\u9A73 ' + _stats.reject + '</span>'
      + '<span>\u8BAE ' + _stats.discuss + '</span>'
      + '<span style="color:var(--ink-300);">\u7559 ' + _stats.hold + '</span>'
      + '<span>\u95EE ' + _stats.ask + '</span>'
      + '</div>'
      + (CY._ccAbsent.length > 0 ? '<div style="font-size:0.65rem;color:var(--ink-300);margin-top:var(--space-1);">\u7F3A\u671D\uFF1A' + CY._ccAbsent.map(function(a){return a.name;}).join('\u3001') + '</div>' : '');
    body.appendChild(statDiv);
    body.scrollTop = body.scrollHeight;
  }
  var footer = _$('cy-footer');
  if (footer) footer.innerHTML = '<div style="text-align:center;"><button class="bt bp" onclick="closeChaoyi()">\u5173\u95ED</button></div>';
}

/** 查找议题相关部门的主官作为主议大臣 */
function _cyFindMainSpeaker(topic) {
  if (!GM.officeTree) return null;
  var best = null, bestScore = 0;
  (function _w(ns) {
    ns.forEach(function(n) {
      var score = 0;
      (n.functions||[]).forEach(function(f) { if (topic.indexOf(f) >= 0 || f.indexOf(topic.slice(0,4)) >= 0) score += 10; });
      if (n.name && topic.indexOf(n.name) >= 0) score += 5;
      if (score > bestScore) {
        // 找该部门最高级在任官员
        (n.positions||[]).forEach(function(p) {
          if (p.holder && CY.selected.indexOf(p.holder) >= 0) {
            bestScore = score; best = p.holder;
          }
        });
      }
      if (n.subs) _w(n.subs);
    });
  })(GM.officeTree);
  return best;
}

function addCYBubble(name,text,isSystem){
  var body=_$("cy-body");if(!body)return;
  var div=document.createElement("div");
  if(isSystem){
    div.style.cssText="text-align:center;margin:0.6rem 0;font-size:0.75rem;color:var(--txt-d);opacity:0.7;";
    div.textContent=text;
  } else {
    div.style.cssText="display:flex;gap:0.5rem;margin-bottom:0.8rem;animation:fi 0.3s ease;";
    var _cych=typeof findCharByName==='function'?findCharByName(name):null;
    var _cyAvatar=_cych&&_cych.portrait?'<img src="'+escHtml(_cych.portrait)+'" style="width:28px;height:28px;object-fit:cover;border-radius:50%;flex-shrink:0;border:1.5px solid var(--gold-d);">':'<div style="width:28px;height:28px;border-radius:50%;background:var(--bg-4);display:flex;align-items:center;justify-content:center;font-size:0.8rem;border:1.5px solid var(--gold-d);flex-shrink:0;">\uD83D\uDC64</div>';
    div.innerHTML=_cyAvatar
      +'<div style="flex:1;min-width:0;"><div style="font-size:0.7rem;color:var(--gold);">'+escHtml(name)+'</div>'
      +'<div class="cy-bubble" style="background:var(--bg-3);border:1px solid var(--bdr);border-radius:3px 10px 10px 10px;padding:0.4rem 0.7rem;font-size:0.85rem;line-height:1.6;">'+text+'</div></div>';
  }
  body.appendChild(div);body.scrollTop=body.scrollHeight;
  return div;
}

function addCYPlayerBubble(msg){
  var body=_$("cy-body");if(!body)return;
  var pd=document.createElement("div");pd.style.cssText="display:flex;justify-content:flex-end;margin-bottom:0.8rem;animation:fi 0.3s ease;";
  pd.innerHTML='<div style="background:rgba(184,154,83,0.12);border-right:3px solid var(--gold-d);border-radius:10px 3px 3px 10px;padding:0.4rem 0.7rem;max-width:75%;font-size:0.85rem;color:var(--gold-l);">'+escHtml(msg)+'</div>';
  body.appendChild(pd);body.scrollTop=body.scrollHeight;
}

/**
 * 为单个朝臣生成流式发言
 */
async function _streamCYSpeech(name, sysPrompt) {
  var body = _$("cy-body"); if (!body) return '';
  var ch = findCharByName(name);
  // 创建气泡容器
  var div = document.createElement("div");
  div.style.cssText = "display:flex;gap:0.5rem;margin-bottom:0.8rem;animation:fi 0.3s ease;";
  var _stAvatar = ch && ch.portrait ? '<img src="'+escHtml(ch.portrait)+'" style="width:28px;height:28px;object-fit:cover;border-radius:50%;flex-shrink:0;border:1.5px solid var(--gold-d);">' : '<div style="width:28px;height:28px;border-radius:50%;background:var(--bg-4);display:flex;align-items:center;justify-content:center;font-size:0.8rem;border:1.5px solid var(--gold-d);flex-shrink:0;">\uD83D\uDC64</div>';
  div.innerHTML = _stAvatar
    + '<div style="flex:1;min-width:0;"><div style="font-size:0.7rem;color:var(--gold);">' + escHtml(name)
    + (ch && ch.title ? ' \u00B7 ' + escHtml(ch.title) : '') + '</div>'
    + '<div class="cy-bubble" style="background:var(--bg-3);border:1px solid var(--bdr);border-radius:3px 10px 10px 10px;padding:0.4rem 0.7rem;font-size:0.85rem;line-height:1.6;color:var(--txt-d);">\u2026</div></div>';
  body.appendChild(div); body.scrollTop = body.scrollHeight;
  var bubbleEl = div.querySelector('.cy-bubble');

  CY.abortCtrl = new AbortController();
  try {
    var full = await callAIMessagesStream(
      [{ role: 'user', content: sysPrompt }], 600,
      {
        signal: CY.abortCtrl.signal,
        tier: (typeof _useSecondaryTier === 'function' && _useSecondaryTier()) ? 'secondary' : undefined,  // M3·朝议走次 API
        onChunk: function(txt) {
          if (bubbleEl) { bubbleEl.textContent = txt; bubbleEl.style.color = ''; }
          body.scrollTop = body.scrollHeight;
        }
      }
    );
    if (bubbleEl && !full) { bubbleEl.textContent = '（沉默不语）'; }
    return full || '';
  } catch (e) {
    if (bubbleEl) { bubbleEl.textContent = '（未能陈词）'; bubbleEl.style.color = 'var(--red)'; }
    return '';
  }
}

/**
 * 构建朝臣发言的prompt
 */
function _buildCYPrompt(name, roundNum) {
  var ch = findCharByName(name); if (!ch) return '';
  var capital = GM._capital || '\u4EAC\u57CE';
  var prevAll = CY.messages.map(function(m) { return m.from + ': ' + m.content; }).join('\n');
  // NPC记忆
  var memCtx = '';
  if (typeof NpcMemorySystem !== 'undefined') {
    var mem = NpcMemorySystem.getMemoryContext(name);
    if (mem) memCtx = '\n【个人记忆】' + mem;
  }
  // 文事作品——朝议时可引用自己的作品来佐证立场，也可含蓄化用
  var worksCtx = '';
  if (GM.culturalWorks && GM.culturalWorks.length > 0) {
    var _selfWorks = GM.culturalWorks.filter(function(w) { return w.author === name; }).slice(-5);
    if (_selfWorks.length) {
      worksCtx = '\n【自作文事】' + _selfWorks.map(function(w) { return '《' + w.title + '》(' + (w.subtype||w.genre||'') + (w.mood?'·'+w.mood:'') + ')'; }).join('、')
        + '——若议题相关可引用或化用自己作品';
    }
    // 知晓在场他人的作品（读书人之间互相传阅）
    var _peersWorks = [];
    CY.selected.forEach(function(other) {
      if (other === name) return;
      var _ow = GM.culturalWorks.filter(function(w) { return w.author === other && (w.isPreserved || (w.quality||0) >= 80); });
      if (_ow.length) _peersWorks.push(other + '《' + _ow[_ow.length-1].title + '》');
    });
    if (_peersWorks.length) worksCtx += '\n【同列之作】' + _peersWorks.join('、') + '——士人间知之';
  }
  // 特质
  var traitDesc = ch.personality || '';
  if (ch.traitIds && ch.traitIds.length > 0 && P.traitDefinitions) {
    traitDesc = ch.traitIds.map(function(id) { var d = P.traitDefinitions.find(function(t) { return t.id === id; }); return d ? d.name : id; }).join('、');
  }
  var opVal = (typeof OpinionSystem !== 'undefined') ? OpinionSystem.getTotal(ch, findCharByName(P.playerInfo.characterName) || { name: '玩家' }) : (ch.loyalty || 50);
  var roundTag = roundNum === 1 ? '第一轮（初陈立场）' : '第二轮（针对他人观点辩驳或补充）';

  // 背景标签
  var bgTags = '';
  if (ch.learning) bgTags += '学识:' + ch.learning + ' ';
  if (ch.faith) bgTags += '信仰:' + ch.faith + ' ';
  if (ch.ethnicity) bgTags += '民族:' + ch.ethnicity + ' ';
  if (ch.culture) bgTags += '文化:' + ch.culture + ' ';
  bgTags += '智' + (ch.intelligence || 50) + ' 武勇' + (ch.valor || 50) + ' 军事' + (ch.military || 50) + ' 政' + (ch.administration || 50) + ' 魅' + (ch.charisma || 50) + ' 交' + (ch.diplomacy || 50);

  var p = '你扮演' + ch.name + '（' + (ch.title || '臣') + '），当前在' + capital + '参加朝议。\n'
    + '【人设】特质：' + traitDesc + '，立场：' + (ch.stance || '中立') + '，对君主好感：' + opVal
    + (ch.personalGoal ? '，心中所求：' + ch.personalGoal.slice(0, 30) : '')
    + '\n【背景】' + bgTags
    + (ch.familyTier ? ' 出身:' + ({imperial:'皇族',noble:'世家',gentry:'士族',common:'寒门'}[ch.familyTier]||'') : '')
    + memCtx + worksCtx;
  // 6.4: 学识和信仰影响说话风格
  if (ch.learning) p += '\n说话风格受学识影响（' + ch.learning + '）：用词和引用应体现其学识背景。';
  if (ch.faith) p += '\n说话风格受信仰影响（' + ch.faith + '）：言语中可能体现其信仰理念。';
  if (ch.speechStyle) p += '\n个人语言风格：' + ch.speechStyle;
  // 注入此人对在场其他朝臣的印象（驱动辩论中的支持/反对）
  if (ch._impressions) {
    var _cyImpLines = [];
    CY.selected.forEach(function(otherName) {
      if (otherName === name) return;
      var imp = ch._impressions[otherName];
      if (imp && Math.abs(imp.favor) >= 10) {
        _cyImpLines.push(otherName + (imp.favor > 0 ? '(好感)' : '(嫌恶)'));
      }
    });
    if (_cyImpLines.length > 0) p += '\n【对在场朝臣态度】' + _cyImpLines.join('、') + '——好感者倾向附和，嫌恶者倾向反驳';
  }
  // 动态评估此人对议题的见识深度（经验+能力+通识，非领域隔离）
  var _topicExpertise = '';
  (function() {
    var topic = CY.topic || '';
    var reasons = [];

    // ── A. 总从政经验（在任何岗位上磨炼多年的人，对朝政全局都有见识）──
    var totalTenure = 0;
    if (ch._tenure) { for (var tk in ch._tenure) totalTenure += ch._tenure[tk]; }
    var totalYears = Math.floor(totalTenure / 4);
    if (totalYears >= 10) reasons.push('从政' + totalYears + '年的老臣——对朝政各面都有深厚的经验和直觉');
    else if (totalYears >= 5) reasons.push('从政' + totalYears + '年——有相当的实务积累');

    // ── B. 议题相关的直接经验（当前职务+曾任职务+曾经手的职能）──
    // 不按"部门名"匹配，而按"职能内容"匹配：查此人任职过的所有部门的functions
    var _directExp = [];
    if (ch._tenure && GM.officeTree) {
      // 收集此人曾任职的所有部门名
      var _pastDepts = Object.keys(ch._tenure).map(function(k) {
        // tenure key形如"兵部尚书"——提取部门名部分（去掉末尾官职名）
        var deptName = k;
        (function walk(nodes) {
          nodes.forEach(function(n) {
            if (n.positions) n.positions.forEach(function(pos) {
              if (k === (n.name||'') + (pos.name||'') || k.indexOf(n.name) === 0) deptName = n.name;
            });
            if (n.subs) walk(n.subs);
          });
        })(GM.officeTree);
        return { dept: deptName, turns: ch._tenure[k] };
      });
      // 收集这些部门曾经/现在拥有的职能
      _pastDepts.forEach(function(pd) {
        (function walk(nodes) {
          nodes.forEach(function(n) {
            if (n.name === pd.dept && n.functions) {
              n.functions.forEach(function(fn) {
                if (topic.indexOf(fn) >= 0 || fn.indexOf(topic.slice(0,4)) >= 0) {
                  var yrs = Math.floor(pd.turns / 4);
                  _directExp.push(pd.dept + '任职' + (yrs > 0 ? yrs + '年' : '') + '期间经手"' + fn + '"事务');
                }
              });
            }
            if (n.subs) walk(n.subs);
          });
        })(GM.officeTree);
      });
    }
    if (_directExp.length > 0) reasons.push('有直接经验——' + _directExp[0]);

    // 也检查当前部门职能是否对口
    if (ch.officialTitle || ch.title) {
      var _curDeptFuncs = [];
      (function walk(nodes) {
        nodes.forEach(function(n) {
          if (n.positions && n.positions.some(function(p) { return p.holder === ch.name; })) {
            _curDeptFuncs = n.functions || [];
          }
          if (n.subs) walk(n.subs);
        });
      })(GM.officeTree || []);
      var _curMatch = _curDeptFuncs.some(function(fn) { return topic.indexOf(fn) >= 0 || fn.indexOf(topic.slice(0,4)) >= 0; });
      if (_curMatch) reasons.push('现任职务直接负责相关事务');
    }

    // ── C. 通用能力底座（高智力+高政务对所有行政议题都有基础见识）──
    var intel = ch.intelligence || 50, admin = ch.administration || 50;
    var _generalCompetence = Math.max(intel, admin);
    if (_generalCompetence >= 85) reasons.push('智/政' + _generalCompetence + '——才具卓越，跨领域也能洞见本质');
    else if (_generalCompetence >= 70) reasons.push('智/政' + _generalCompetence + '——能力扎实，举一反三');

    // 军事议题额外看military值
    if (/军|兵|战|攻|守|征/.test(topic)) {
      var mil = ch.military || 50;
      if (mil >= 80) reasons.push('军事' + mil + '——深谙兵法');
      else if (mil < 35 && _directExp.length === 0) reasons.push('军事' + mil + '——缺乏军事素养');
    }

    // ── D. 学识加成（不限于对口——广博的学识本身就是见识来源）──
    if (ch.learning) reasons.push('学识：' + ch.learning);

    // ── E. 年龄/阅历（年长者见多识广）──
    if ((ch.age || 30) >= 55) reasons.push('年' + ch.age + '——阅历丰富');

    // ── 汇总——不用分数打标签，直接给AI全部信息让它自行判断 ──
    if (reasons.length > 0) {
      _topicExpertise = '\n【此人与本议题的关联】' + reasons.join('；');
      _topicExpertise += '\n  ※AI应综合以上信息判断此人发言的深度和角度——有经验者言之有物，能力强者可触类旁通，资历浅能力弱者的发言也有其价值（可能提出朴素但新颖的观点，或暴露认知局限）';
    }
  })();
  if (_topicExpertise) p += _topicExpertise;
  // 注入三元身份——势力+党派+阶层
  var _triId = [];
  if (ch.faction) _triId.push('势力:' + ch.faction);
  if (ch.party) _triId.push('党派:' + ch.party);
  if (ch.class) {
    var _clsObj = (GM.classes||[]).find(function(c){return c.name===ch.class;});
    _triId.push('阶层:' + ch.class + (_clsObj && _clsObj.demands ? '(诉求:'+_clsObj.demands.slice(0,20)+')' : ''));
  }
  if (_triId.length > 0) p += '\n【三元身份】' + _triId.join(' · ') + '——发言须符合此三重立场（阶层利益/党派议程/势力归属）';
  // 注入进行中诏令——此人若是反对派/支持者应在朝议上有所表现
  if (GM._edictLifecycle && GM._edictLifecycle.length > 0) {
    var _myEdicts = [];
    GM._edictLifecycle.forEach(function(e) {
      if (e.isCompleted) return;
      var role = null;
      if (e.oppositionLeaders && e.oppositionLeaders.indexOf(name) >= 0) role = '反对';
      else if (e.supporters && e.supporters.indexOf(name) >= 0) role = '支持';
      if (!role) return;
      var typeLabel = (typeof EDICT_TYPES !== 'undefined' && EDICT_TYPES[e.edictType]) ? EDICT_TYPES[e.edictType].label : (e.edictType || '');
      var lastStage = e.stages && e.stages.length ? e.stages[e.stages.length-1] : null;
      var stageLabel = lastStage && typeof EDICT_STAGES !== 'undefined' && EDICT_STAGES[lastStage.stage] ? EDICT_STAGES[lastStage.stage].label : '';
      _myEdicts.push('《' + typeLabel + '》(当前' + stageLabel + ')——你' + role);
    });
    if (_myEdicts.length > 0) {
      p += '\n【你与进行中诏令的立场】' + _myEdicts.join('；') + '\n  ※若议题与此类诏令相关，应据立场发言——反对者可弹劾/讽喻/阻挠，支持者可辩护/推进';
    }
  }
  p += '\n【朝议议题】' + CY.topic + '\n'
    + '【当前轮次】' + roundTag + '\n'
    + '【此前发言】\n' + (prevAll || '（尚无发言）') + '\n\n'
    + '【要求】\n'
    + '• 以' + ch.name + '的口吻陈述，体现其个人立场、知识局限和利益考量\n'
    + '• ' + (roundNum === 1
      ? '第一轮：明确表态——支持/反对/有条件支持/另有提议，给出理由'
      : '后续轮：必须针对此前发言直接回应——引用某人原话加以反驳或支持，不可重复自己第一轮的话。') + '\n'
    + '• 对抗性要求：如有人与你立场相反，必须指名道姓反驳其具体论点。如有人被皇帝褒奖则其他人倾向附和，被呵斥则可能落井下石或仗义执言。\n'
    + '• 台谏言官（御史/谏官）可在发言中穿插弹劾：如发现在场某官有不轨行为，可当庭弹劾。\n'
    + '• 【层叠差异化——读数据不猜测】：\n'
    + '  层1·此话题是否其擅长领域？谈战略用兵看军事值，谈个人搏战看武勇值，谈政务看政务值\n'
    + '    ※武勇≠军事：武勇=个人武力，军事=统兵指挥，完全不同的能力\n'
    + '    不擅长(对应能力<40)→观点可能荒谬但自己不知道——这种错误很有价值\n'
    + '  层2·学识修正：学识高的人即使不擅长也能说得很像那么回事（但可能纸上谈兵）\n'
    + '  层3·五常修正：信高+坦诚者→会说"非吾所长"；信低→掩饰无知继续侃侃而谈\n'
    + '  层5·记忆：近期遭遇决定此刻态度——刚被斥责的人可能沉默或反叛\n'
    + '• 有私心者可能借议题推进自己目的（但不明示）\n'
    + '• 动作和神态用括号标注\n'
    + '• ' + _charRangeText('cy') + '。直接输出角色发言，不要加名字前缀。\n'
    + '返回JSON：{"speech":"发言内容","stance":"支持/反对/中立/有条件","brief":"10字内观点摘要"}';
  return p;
}

/**
 * 执行一轮朝议讨论（所有朝臣依次流式发言）
 */
async function _runChaoyiRound() {
  if (!CY.open || !P.ai.key) return;
  CY.speaking = true;
  CY.round++;
  var roundTag = _$('cy-round-tag');
  if (roundTag) { roundTag.style.display = ''; roundTag.textContent = '第' + CY.round + '轮讨论'; }
  addCYBubble('\u5185\u4F8D', '── 第' + CY.round + '轮议论 ──', true);

  for (var ci = 0; ci < CY.selected.length; ci++) {
    if (!CY.open) break;
    var name = CY.selected[ci];
    // NPC沉默判定——品级低/不敢/与议题无关的人可能沉默
    var _cych = findCharByName(name);
    if (_cych && CY.round > 1) { // 第一轮不沉默（被召来了总得说话）
      var _silenceChance = 0;
      var _rl = typeof getRankLevel === 'function' ? getRankLevel(_cyGetRank(_cych)) : 99;
      if (_rl > 14) _silenceChance += 0.3; // 低品级
      if ((_cych.stress||0) > 70) _silenceChance += 0.2; // 高压力
      // 检查此人上一轮是否被皇帝呵斥
      var _wasScold = CY._playerActions.some(function(a) { return a.type === 'scold' && a.target === name; });
      if (_wasScold) _silenceChance += 0.4;
      if (Math.random() < _silenceChance) {
        addCYBubble(name, '（拱手沉默不语）');
        CY.messages.push({ from: name, content: '（沉默）' });
        CY.stances[name] = CY.stances[name] || { stance: '沉默', brief: '未发言', speech: '' };
        continue;
      }
    }
    var prompt = _buildCYPrompt(name, CY.round);
    var raw = await _streamCYSpeech(name, prompt);
    // 解析
    var speech = raw, stance = '中立', brief = '';
    var parsed = (typeof extractJSON === 'function') ? extractJSON(raw) : null;
    if (parsed && parsed.speech) {
      speech = parsed.speech;
      stance = parsed.stance || '中立';
      brief = parsed.brief || '';
    }
    CY.messages.push({ from: name, content: speech });
    CY.stances[name] = { stance: stance, brief: brief, speech: speech };
    // 记录到纪事
    GM.jishiRecords.push({ turn: GM.turn, char: name, playerSaid: '朝议(' + CY.topic + ')第' + CY.round + '轮', npcSaid: speech });
  }

  CY.speaking = false;
  // 显示底部操作区
  _showChaoyiFooter();
  if (typeof renderJishi === 'function') renderJishi();
}

/**
 * 显示朝议底部操作区（每轮讨论结束后）
 */
function _showChaoyiFooter() {
  var footer = _$('cy-footer'); if (!footer) return;
  // 指名发言下拉
  var _nameOpts = CY.selected.map(function(n) { return '<option value="' + escHtml(n) + '">' + escHtml(n) + '</option>'; }).join('');
  footer.innerHTML = '<div style="display:flex;gap:0.3rem;align-items:center;flex-wrap:wrap;">'
    + '<textarea id="cy-input" placeholder="\u5BF9\u7FA4\u81E3\u8BF4\u2026\u2026\uFF08\u53EF\u9009\uFF09" rows="1" style="flex:1;min-width:150px;resize:none;padding:0.4rem 0.6rem;font-size:0.82rem;font-family:inherit;background:var(--bg-3);border:1px solid var(--bdr);border-radius:6px;color:var(--txt);" onkeydown="if(event.key===\'Enter\'&&!event.shiftKey){event.preventDefault();_cyPlayerSpeak();}"></textarea>'
    + '<button class="bt bp bsm" onclick="_cyPlayerSpeak()" title="\u53D1\u8A00\u540E\u8FDB\u5165\u4E0B\u4E00\u8F6E">\u53D1\u8A00</button>'
    + '<button class="bt bs bsm" onclick="_cySkipToNextRound()" title="\u4E0D\u53D1\u8A00\uFF0C\u7EE7\u7EED\u8BA8\u8BBA">\u7EED\u8BAE</button>'
    + '<select id="cy-name-target" style="font-size:0.72rem;padding:2px 4px;background:var(--bg-3);border:1px solid var(--bdr);color:var(--txt);border-radius:4px;"><option value="">\u6307\u540D\u2026</option>' + _nameOpts + '</select>'
    + '<button class="bt bsm" onclick="_cyCallByName()" title="\u6307\u540D\u67D0\u4EBA\u53D1\u8A00">\u53EC</button>'
    + '<button class="bt bsm" onclick="_cyPraise()" title="\u8912\u5956\u6700\u540E\u4E00\u4F4D\u53D1\u8A00\u8005" style="color:var(--celadon-400);">\u8D5E</button>'
    + '<button class="bt bsm" onclick="_cyScold()" title="\u5475\u65A5\u6700\u540E\u4E00\u4F4D\u53D1\u8A00\u8005" style="color:var(--vermillion-400);">\u53F1</button>'
    + '<button class="bt bs bsm" onclick="_cyRequestSummary()" style="white-space:nowrap;" title="\u7740\u6709\u53F8\u6761\u9648">\u6761\u9648</button>'
    + '<button class="bt bp bsm" onclick="_cyInstantDecree()" style="white-space:nowrap;" title="\u5F53\u5EF7\u51B3\u65AD\u2014\u2014\u76F4\u63A5\u4E0B\u65E8">\u671D\u610F\u5DF2\u51B3</button>'
    + '</div>';
}

/**
 * 玩家在朝议中发言
 */
function _cyPlayerSpeak() {
  if (CY.speaking) return;
  var input = _$('cy-input');
  var msg = input ? input.value.trim() : '';
  if (!msg) { _cySkipToNextRound(); return; }
  input.value = '';
  addCYPlayerBubble(msg);
  CY.messages.push({ from: '皇帝', content: msg });
  CY._playerActions.push({ type: 'speak', content: msg, round: CY.round });
  // 每次皇帝发言后，群臣回应一轮
  _runChaoyiRebuttal(msg);
}

/**
 * 跳过发言直接进入下一轮
 */
function _cySkipToNextRound() {
  if (CY.speaking) return;
  addCYBubble('\u5185\u4F8D', '（陛下未置一词，示意群臣继续。）', true);
  _runChaoyiRound();
}

/**
 * 皇帝发言后，朝臣对皇帝旨意做简短回应（第2轮之后的追加）
 */
async function _runChaoyiRebuttal(playerMsg) {
  if (!CY.open || !P.ai.key) return;
  CY.speaking = true;
  CY.round++;
  addCYBubble('\u5185\u4F8D', '── 群臣回应圣意 ──', true);

  for (var ci = 0; ci < CY.selected.length; ci++) {
    if (!CY.open) break;
    var name = CY.selected[ci];
    var ch = findCharByName(name); if (!ch) continue;
    var prevAll = CY.messages.map(function(m) { return m.from + ': ' + m.content; }).join('\n');
    var p = '你扮演' + ch.name + '（' + (ch.title || '臣') + '），正在朝议中。皇帝刚发表了意见。\n'
      + '议题：' + CY.topic + '\n'
      + '你此前的立场：' + (CY.stances[name] ? CY.stances[name].stance + '——' + CY.stances[name].brief : '未明确') + '\n'
      + '皇帝说：' + playerMsg + '\n'
      + '此前完整讨论：\n' + prevAll + '\n\n'
      + '【要求】简短回应皇帝的指示，' + _charRangeScaled('cy', 0.5) + '。可以表示遵旨、有保留意见、或坚持进谏。\n'
      + '直接输出角色发言。';
    var reply = await _streamCYSpeech(name, p);
    CY.messages.push({ from: name, content: reply });
  }
  CY.speaking = false;
  _showChaoyiFooter();
}

/** 指名某人发言 */
async function _cyCallByName() {
  if (CY.speaking) return;
  var sel = _$('cy-name-target');
  var name = sel ? sel.value : '';
  if (!name) { toast('请选择要指名的人'); return; }
  CY.speaking = true;
  addCYPlayerBubble('朕要听' + name + '一言。');
  CY.messages.push({ from: '皇帝', content: '指名' + name + '发言' });
  CY._playerActions.push({ type: 'callByName', target: name, round: CY.round });
  var prompt = _buildCYPrompt(name, CY.round + 1);
  prompt += '\n※ 皇帝点名要你发言——你必须回应，不可沉默。';
  var raw = await _streamCYSpeech(name, prompt);
  var parsed = (typeof extractJSON === 'function') ? extractJSON(raw) : null;
  var speech = parsed && parsed.speech ? parsed.speech : raw;
  CY.messages.push({ from: name, content: speech });
  if (parsed) CY.stances[name] = { stance: parsed.stance||'中立', brief: parsed.brief||'', speech: speech };
  CY.speaking = false;
  _showChaoyiFooter();
}

/** 褒奖最后发言者 */
function _cyPraise() {
  var lastSpeaker = '';
  for (var i = CY.messages.length - 1; i >= 0; i--) {
    if (CY.messages[i].from !== '皇帝' && CY.messages[i].from !== '内侍') { lastSpeaker = CY.messages[i].from; break; }
  }
  if (!lastSpeaker) { toast('无人可褒'); return; }
  addCYPlayerBubble('（颔首赞许）卿言甚善！');
  CY.messages.push({ from: '皇帝', content: '褒奖' + lastSpeaker });
  CY._playerActions.push({ type: 'praise', target: lastSpeaker, round: CY.round });
  // 影响后续发言态度
  var ch = findCharByName(lastSpeaker);
  if (ch) ch.loyalty = Math.min(100, (ch.loyalty||50) + 2);
  if (typeof NpcMemorySystem !== 'undefined') NpcMemorySystem.remember(lastSpeaker, '朝议中发言获帝褒奖', '喜', 4, '天子');
  toast(lastSpeaker + '受到褒奖');
}

/** 呵斥最后发言者 */
function _cyScold() {
  var lastSpeaker = '';
  for (var i = CY.messages.length - 1; i >= 0; i--) {
    if (CY.messages[i].from !== '皇帝' && CY.messages[i].from !== '内侍') { lastSpeaker = CY.messages[i].from; break; }
  }
  if (!lastSpeaker) { toast('无人可斥'); return; }
  addCYPlayerBubble('（拍案怒斥）' + lastSpeaker + '，大胆！此等荒谬之论，岂敢在朝堂放肆！');
  CY.messages.push({ from: '皇帝', content: '呵斥' + lastSpeaker });
  CY._playerActions.push({ type: 'scold', target: lastSpeaker, round: CY.round });
  var ch = findCharByName(lastSpeaker);
  if (ch) {
    ch.loyalty = Math.max(0, (ch.loyalty||50) - 3);
    ch.stress = Math.min(100, (ch.stress||0) + 10);
  }
  if (typeof NpcMemorySystem !== 'undefined') NpcMemorySystem.remember(lastSpeaker, '朝议中发言被帝当众呵斥', '怨', 6, '天子');
  toast(lastSpeaker + '被呵斥');
}

/** 当庭决断——直接下旨（写入诏令） */
function _cyInstantDecree() {
  if (CY.speaking) return;
  var input = _$('cy-input');
  var decree = input ? input.value.trim() : '';
  if (!decree) { toast('请在输入框中写下旨意'); return; }
  addCYPlayerBubble('（当庭宣旨）朕意已决：' + decree);
  CY.messages.push({ from: '皇帝', content: '当庭下旨：' + decree });
  CY._playerActions.push({ type: 'decree', content: decree, round: CY.round });
  // 直接写入诏令建议库
  if (!GM._edictSuggestions) GM._edictSuggestions = [];
  GM._edictSuggestions.push({ source: '朝议', from: '当庭', content: decree, turn: GM.turn, used: false });
  if (typeof _renderEdictSuggestions === 'function') _renderEdictSuggestions();
  // 记录起居注
  var _date = typeof getTSText === 'function' ? getTSText(GM.turn) : '';
  if (GM.qijuHistory) GM.qijuHistory.unshift({ turn: GM.turn, date: _date, content: '【朝议】帝当庭决断：' + decree });
  if (input) input.value = '';
  toast('旨意已录入诏书建议库');
  // 让群臣回应
  _runChaoyiRebuttal(decree);
}

/**
 * "着有司条陈总结" —— AI生成朝议总结，玩家选择纳入诏令
 */
async function _cyRequestSummary() {
  if (CY.speaking) return;
  CY.speaking = true;
  CY.phase = 'summary';
  var footer = _$('cy-footer');
  if (footer) footer.innerHTML = '<div style="text-align:center;color:var(--txt-d);padding:0.5rem;">有司正在条陈总结……</div>';

  addCYBubble('\u5185\u4F8D', '── 有司条陈总结 ──', true);

  // 构建总结prompt
  var allSpeeches = CY.messages.filter(function(m) { return m.from !== '\u5185\u4F8D'; })
    .map(function(m) { return m.from + '：' + m.content; }).join('\n');
  var stanceList = CY.selected.map(function(n) {
    var s = CY.stances[n];
    return n + '：' + (s ? s.stance + '（' + s.brief + '）' : '未明确');
  }).join('\n');

  var summaryPrompt = '你是朝议记录官。以下是一场朝议的完整记录：\n\n'
    + '【议题】' + CY.topic + '\n'
    + '【各方立场】\n' + stanceList + '\n'
    + '【完整发言】\n' + allSpeeches + '\n\n'
    + '请条陈总结，返回JSON：\n'
    + '{"summary":"200字内的整体摘要","proposals":[{"author":"提议人姓名","content":"具体提议内容（30字内）","stance":"支持/反对/折中","reason":"简要理由"}]}\n'
    + 'proposals数组包含所有可操作的提议（通常每人一条），用于让皇帝选择采纳。只输出JSON。';

  try {
    var raw = await callAIMessagesStream(
      [{ role: 'user', content: summaryPrompt }], 1200,
      { signal: (CY.abortCtrl = new AbortController()).signal }
    );
    var data = (typeof extractJSON === 'function') ? extractJSON(raw) : null;
    if (!data || !data.proposals) {
      // 回退：直接展示原文
      data = { summary: raw, proposals: CY.selected.map(function(n) {
        var s = CY.stances[n]; return { author: n, content: s ? s.brief : '未明确', stance: s ? s.stance : '中立', reason: '' };
      })};
    }
    _renderCYSummary(data);
  } catch (e) {
    if (footer) footer.innerHTML = '<div style="color:var(--red);text-align:center;">条陈总结失败</div>';
  }
  CY.speaking = false;
}

/**
 * 渲染朝议总结 + 纳入诏令选择界面
 */
function _renderCYSummary(data) {
  var body = _$('cy-body'); if (!body) return;
  // 摘要
  var sumDiv = document.createElement('div');
  sumDiv.style.cssText = 'background:var(--bg-2);border:1px solid var(--gold-d);border-radius:8px;padding:0.8rem 1rem;margin:0.8rem 0;';
  sumDiv.innerHTML = '<div style="font-size:0.8rem;color:var(--gold);font-weight:700;margin-bottom:0.4rem;">〔 有司条陈 〕</div>'
    + '<div style="font-size:0.85rem;line-height:1.7;color:var(--txt);">' + escHtml(data.summary) + '</div>';
  body.appendChild(sumDiv);

  // 立场统计
  var _stCounts = { '\u652F\u6301': 0, '\u53CD\u5BF9': 0, '\u4E2D\u7ACB': 0, '\u6709\u6761\u4EF6': 0 };
  CY.selected.forEach(function(n) {
    var s = CY.stances[n];
    var st = s ? s.stance : '中立';
    if (st.indexOf('\u652F\u6301') >= 0) _stCounts['\u652F\u6301']++;
    else if (st.indexOf('\u53CD\u5BF9') >= 0) _stCounts['\u53CD\u5BF9']++;
    else if (st.indexOf('\u6761\u4EF6') >= 0) _stCounts['\u6709\u6761\u4EF6']++;
    else _stCounts['\u4E2D\u7ACB']++;
  });
  var stBar = document.createElement('div');
  stBar.style.cssText = 'display:flex;gap:0.8rem;justify-content:center;margin:0.5rem 0;font-size:0.78rem;';
  stBar.innerHTML = '<span style="color:var(--celadon-400);">\u652F\u6301 ' + _stCounts['\u652F\u6301'] + '</span>'
    + '<span style="color:var(--vermillion-400);">\u53CD\u5BF9 ' + _stCounts['\u53CD\u5BF9'] + '</span>'
    + '<span style="color:var(--gold-400);">\u6709\u6761\u4EF6 ' + _stCounts['\u6709\u6761\u4EF6'] + '</span>'
    + '<span style="color:var(--ink-300);">\u4E2D\u7ACB/\u6C89\u9ED8 ' + _stCounts['\u4E2D\u7ACB'] + '</span>';
  body.appendChild(stBar);

  // 各项提议——可勾选
  var propDiv = document.createElement('div');
  propDiv.id = 'cy-proposals';
  propDiv.style.cssText = 'margin:0.5rem 0;';
  var propHtml = '<div style="font-size:0.78rem;color:var(--txt-d);margin-bottom:0.4rem;">勾选采纳的提议，可纳入诏令：</div>';
  (data.proposals || []).forEach(function(pr, idx) {
    var stColor = pr.stance === '支持' ? 'var(--green)' : (pr.stance === '反对' ? 'var(--red)' : 'var(--gold)');
    propHtml += '<label style="display:flex;gap:0.5rem;align-items:flex-start;padding:0.5rem;background:var(--bg-3);border:1px solid var(--bdr);border-radius:6px;margin-bottom:0.3rem;cursor:pointer;">'
      + '<input type="checkbox" class="cy-prop-cb" data-idx="' + idx + '" style="margin-top:3px;">'
      + '<div style="flex:1;">'
      + '<div style="font-size:0.82rem;"><span style="font-weight:700;">' + escHtml(pr.author) + '</span>'
      + ' <span style="font-size:0.7rem;color:' + stColor + ';border:1px solid;padding:0 3px;border-radius:3px;">' + escHtml(pr.stance) + '</span></div>'
      + '<div style="font-size:0.85rem;margin-top:2px;">' + escHtml(pr.content) + '</div>'
      + (pr.reason ? '<div style="font-size:0.72rem;color:var(--txt-d);margin-top:2px;">理由：' + escHtml(pr.reason) + '</div>' : '')
      + '</div></label>';
  });
  propDiv.innerHTML = propHtml;
  body.appendChild(propDiv);
  body.scrollTop = body.scrollHeight;

  // 存储供后续使用
  CY._summaryData = data;

  // 底部按钮
  var footer = _$('cy-footer');
  if (footer) {
    // 散朝后单独召见——下拉选择参与者
    var _summonOpts = CY.selected.map(function(n) { return '<option value="' + escHtml(n) + '">' + escHtml(n) + '</option>'; }).join('');
    footer.innerHTML = '<div style="display:flex;gap:0.4rem;justify-content:center;flex-wrap:wrap;align-items:center;">'
      + '<button class="bt bp" onclick="_cyAdoptProposals()">\u91C7\u7EB3\u6240\u9009\uFF0C\u7EB3\u5165\u8BCF\u4EE4</button>'
      + '<button class="bt bs" onclick="_cyDismissAll()">\u6401\u7F6E\uFF0C\u6563\u671D</button>'
      + '<select id="cy-summon-after" style="font-size:0.72rem;padding:2px 4px;background:var(--bg-3);border:1px solid var(--bdr);color:var(--txt);border-radius:4px;"><option value="">\u6563\u671D\u540E\u53EC\u89C1\u2026</option>' + _summonOpts + '</select>'
      + '<button class="bt bsm" onclick="_cySummonAfter()" title="\u6563\u671D\u540E\u5355\u72EC\u53EC\u89C1\u6B64\u4EBA\u95EE\u5BF9">\u53EC</button>'
      + '</div>';
  }
}

/**
 * 采纳选中的提议纳入诏令
 */
function _cyAdoptProposals() {
  var cbs = document.querySelectorAll('.cy-prop-cb');
  var adopted = [];
  cbs.forEach(function(cb) {
    if (cb.checked) {
      var idx = parseInt(cb.getAttribute('data-idx'));
      var pr = CY._summaryData && CY._summaryData.proposals && CY._summaryData.proposals[idx];
      if (pr) adopted.push(pr);
    }
  });
  if (adopted.length === 0) { toast('未选择任何提议'); return; }

  // 纳入诏令输入框
  var edictText = '朝议决议（' + CY.topic + '）：\n' + adopted.map(function(pr) {
    return '采纳' + pr.author + '之议——' + pr.content;
  }).join('；\n');

  // 朝议决议进入诏书建议库（不直接写入诏令——诏书由皇帝自行决定）
  if (!GM._edictSuggestions) GM._edictSuggestions = [];
  adopted.forEach(function(pr) {
    GM._edictSuggestions.push({ source: '\u671D\u8BAE', from: pr.author, content: pr.content, turn: GM.turn, used: false });
  });
  toast('\u671D\u8BAE\u51B3\u8BAE\u5DF2\u5165\u8BF8\u4E66\u5EFA\u8BAE\u5E93');
  if (typeof _renderEdictSuggestions === 'function') _renderEdictSuggestions();

  // 持久化朝议记录 + NPC记忆影响
  _persistCourtRecord(adopted);
  _chaoyiMemoryEffects(adopted);

  // E5: 朝议决议追踪——决议纳入_edictTracker以便下回合AI反馈执行情况
  if (!GM._edictTracker) GM._edictTracker = [];
  adopted.forEach(function(pr, i) {
    GM._edictTracker.push({
      id: 'court_' + GM.turn + '_' + i,
      content: '朝议决议：' + pr.content,
      category: '朝议·' + (pr.author || '群臣'),
      turn: GM.turn,
      status: 'pending',
      assignee: pr.author || '',
      feedback: '',
      progressPercent: 0
    });
  });

  toast('已将' + adopted.length + '项决议纳入诏令');
  // 记录到起居注
  if (GM.qijuHistory) {
    var dateStr = (typeof getTSText === 'function') ? getTSText(GM.turn) : '';
    GM.qijuHistory.unshift({ turn: GM.turn, date: dateStr, content: '【朝议】议题"' + CY.topic + '"，采纳：' + adopted.map(function(p) { return p.author + '之议'; }).join('、') + '。' });
  }
  closeChaoyi();
}

/**
 * 搁置散朝
 */
function _cyDismissAll() {
  _persistCourtRecord([]);
  _chaoyiMemoryEffects([]);
  if (GM.qijuHistory) {
    var dateStr = (typeof getTSText === 'function') ? getTSText(GM.turn) : '';
    GM.qijuHistory.unshift({ turn: GM.turn, date: dateStr, content: '【朝议】议题"' + CY.topic + '"，陛下未采纳任何提议，群臣散去。' });
  }
  toast('散朝');
  closeChaoyi();
}

/**
 * 将朝议立场记录持久化到GM（供主叙事AI和问对引用）
 */
/** 散朝后单独召见——链接到问对系统 */
function _cySummonAfter() {
  var sel = _$('cy-summon-after');
  var name = sel ? sel.value : '';
  if (!name) { toast('请选择要召见的人'); return; }
  closeChaoyi();
  // 打开问对弹窗，预设话题为朝议议题
  if (typeof openWenduiModal === 'function') {
    openWenduiModal(name, 'formal', '方才朝议之事，朕欲与卿单独详谈。');
  } else {
    toast('问对模块未加载');
  }
}

function _persistCourtRecord(adopted) {
  if (!GM._courtRecords) GM._courtRecords = [];
  var _isPostTurnCY = !!GM._isPostTurnCourt;
  var record = {
    turn: GM.turn,
    targetTurn: _isPostTurnCY ? (GM.turn + 1) : GM.turn,
    phase: _isPostTurnCY ? 'post-turn' : 'in-turn',
    topic: CY.topic,
    mode: CY.mode || 'tinyi',
    participants: CY.selected.slice(),
    stances: {},
    adopted: adopted.map(function(p) { return { author: p.author, content: p.content, stance: p.stance }; }),
    dismissed: adopted.length === 0,
    _secret: CY.mode === 'yuqian' // 御前会议标记为密议
  };
  CY.selected.forEach(function(name) {
    var s = CY.stances[name];
    if (s) record.stances[name] = { stance: s.stance, brief: s.brief };
  });
  GM._courtRecords.push(record);
  // 只保留最近5次朝议
  if (GM._courtRecords.length > 8) GM._courtRecords.shift();
  if (typeof recordCourtHeld === 'function') recordCourtHeld({ isPostTurn: _isPostTurnCY });
}

/**
 * 朝议对参与NPC产生记忆和人际影响
 */
function _chaoyiMemoryEffects(adopted) {
  var adoptedNames = adopted.map(function(p) { return p.author; });
  CY.selected.forEach(function(name) {
    var ch = findCharByName(name); if (!ch) return;
    var wasAdopted = adoptedNames.indexOf(name) >= 0;
    var myStance = CY.stances[name];

    // NPC记忆：记住这次朝议
    if (typeof NpcMemorySystem !== 'undefined') {
      var emo = wasAdopted ? '喜' : '平';
      var memText = '朝议"' + CY.topic.slice(0, 15) + '"——' + (myStance ? myStance.brief : '参与讨论');
      if (wasAdopted) memText += '，自己的提议被采纳';
      NpcMemorySystem.remember(name, memText, emo, 6, '陛下');
    }

    // 忠诚度影响
    var loyDelta = wasAdopted ? 2 : -1;
    if (ch.loyalty !== undefined) ch.loyalty = clamp((ch.loyalty || 50) + loyDelta, 0, 100);
    if (typeof OpinionSystem !== 'undefined') {
      OpinionSystem.addEventOpinion(name, '玩家', loyDelta * 2, wasAdopted ? '朝议提议被采纳' : '朝议提议未被采纳');
    }

    // NPC之间互相影响：观点相同的互生好感，对立的互生恶感
    CY.selected.forEach(function(otherName) {
      if (otherName === name) return;
      var otherStance = CY.stances[otherName];
      if (!myStance || !otherStance) return;
      if (myStance.stance === otherStance.stance && myStance.stance !== '中立') {
        // 立场一致——互生好感
        if (typeof AffinityMap !== 'undefined') AffinityMap.adjust(name, otherName, 3);
        if (typeof NpcMemorySystem !== 'undefined') {
          NpcMemorySystem.remember(name, '朝议中与' + otherName + '观点一致', '喜', 3, otherName);
        }
      } else if ((myStance.stance === '支持' && otherStance.stance === '反对') || (myStance.stance === '反对' && otherStance.stance === '支持')) {
        // 立场对立——互生恶感
        if (typeof AffinityMap !== 'undefined') AffinityMap.adjust(name, otherName, -3);
        if (typeof NpcMemorySystem !== 'undefined') {
          NpcMemorySystem.remember(name, '朝议中与' + otherName + '激烈争论', '怒', 4, otherName);
        }
      }
    });
  });
}

