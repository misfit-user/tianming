// ============================================================
// tm-chaoyi-v2.js — 朝议 v2·常朝/廷议/御前新版 (R129 从 tm-keju-runtime.js L3198-end 拆出)
//
// 历史：这 2530 行原在 tm-audio-theme.js → tm-chaoyi-keju.js → tm-chaoyi.js → R125 误留 keju-runtime
// 本次 R129 纠正归类·纯朝议系统 v2 升级版
//
// 姊妹：tm-chaoyi.js (常朝 v1)
//       tm-chaoyi-misc.js (朝议杂务)
// 包含：_cc2_* (常朝 v2 ~1670 行)+_ty2_* (廷议 v2 ~372 行)+_yq2_* (御前 v2 ~483 行)
// ============================================================

function _cc2_openPrepareDialog() {
  var capital = GM._capital || _getPlayerLocation() || '京城';
  // 本地存储筹备状态
  CY._cc2Prepare = {
    capital: capital,
    extraSummons: [],       // 额外召人清单
    regularAttendees: [],   // 常规应到者
    absent: []              // 缺朝
  };

  var _allInKy = (GM.chars||[]).filter(function(c) { return c.alive !== false && _isAtCapital(c) && !c.isPlayer && _isPlayerFactionChar(c); });
  _allInKy.forEach(function(ch) {
    var _absent = false, _reason = '';
    if (ch._mourning) { _absent = true; _reason = '丁忧'; }
    else if ((ch.stress||0) > 85 && Math.random() < 0.5) { _absent = true; _reason = '称病'; }
    else if ((ch.loyalty||50) < 15 && Math.random() < 0.3) { _absent = true; _reason = '称病'; }
    else if (ch._retired) { _absent = true; _reason = '致仕'; }
    // 无官职者与后妃/宦官默认不上朝（需传召才入朝）
    else if (!ch.officialTitle && !ch.title) { _absent = true; _reason = '无朝职'; }
    else if (ch.spouse) { _absent = true; _reason = '后妃不临朝'; }
    if (_absent) CY._cc2Prepare.absent.push({ name: ch.name, reason: _reason, ch: ch });
    else CY._cc2Prepare.regularAttendees.push(ch);
  });

  var bg = document.createElement('div');
  bg.id = 'cc2-prepare-bg';
  bg.style.cssText = 'position:fixed;inset:0;z-index:1300;background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;';
  var html = '<div style="background:var(--color-surface);border:1px solid var(--gold-500);border-radius:var(--radius-lg);padding:1.5rem 2rem;max-width:520px;width:90%;">';
  html += '<div style="font-size:var(--text-md);color:var(--gold-400);letter-spacing:0.12em;margin-bottom:0.8rem;text-align:center;">〔 今 日 常 朝 · 筹 备 〕</div>';
  html += '<div style="font-size:var(--text-xs);color:var(--color-foreground-muted);line-height:1.6;margin-bottom:1rem;">';
  html += '应到：' + CY._cc2Prepare.regularAttendees.length + ' 人｜缺朝/不临朝：' + CY._cc2Prepare.absent.length + ' 人<br/>';
  html += '驻跸之地：' + escHtml(capital);
  html += '</div>';
  html += '<div id="cc2-prepare-summary" style="font-size:0.7rem;color:var(--ink-300);margin-bottom:0.8rem;min-height:1.2em;"></div>';
  html += '<div style="display:flex;flex-direction:column;gap:var(--space-2);">';
  html += '<button class="bt bp" onclick="_cc2_openExtraSummons()">📋 额外召人参加</button>';
  html += '<button class="bt bp" onclick="_cc2_startCourtSession()">⚡ 直接开始</button>';
  html += '<button class="bt" onclick="_cc2_cancelPrepare()">✕ 取消</button>';
  html += '</div></div>';
  bg.innerHTML = html;
  document.body.appendChild(bg);
}

function _cc2_cancelPrepare() {
  var bg = _$('cc2-prepare-bg'); if (bg) bg.remove();
  if (typeof closeChaoyi === 'function') closeChaoyi();
}

function _cc2_openExtraSummons() {
  var pool = CY._cc2Prepare.absent.concat((GM.chars||[]).filter(function(c) {
    return c.alive !== false && !c.isPlayer && !_isAtCapital(c) && !c._retired;
  }).slice(0, 40).map(function(c) {
    return { name: c.name, reason: '远地(' + (c.location||'?') + ')', ch: c, isRemote: true };
  }));
  // 也要把身在京城但默认不临朝的（后妃/宦官/布衣）都纳入（上面 absent 已包含无朝职者）

  // 分组
  var groups = { '缺朝官员': [], '后妃': [], '宦官': [], '布衣': [], '远地官员': [] };
  pool.forEach(function(p) {
    var ch = p.ch;
    if (p.isRemote) groups['远地官员'].push(p);
    else if (ch.spouse) groups['后妃'].push(p);
    else if ((ch.title||'').indexOf('太监')>=0 || (ch.title||'').indexOf('内侍')>=0 || (ch.officialTitle||'').indexOf('司礼')>=0 || (ch.officialTitle||'').indexOf('监')>=0 && (ch.title||'').indexOf('国子')<0) groups['宦官'].push(p);
    else if (!ch.officialTitle && !ch.title) groups['布衣'].push(p);
    else groups['缺朝官员'].push(p);
  });

  var bg = _$('cc2-prepare-bg');
  if (!bg) { _cc2_openPrepareDialog(); return; }
  var html = '<div style="background:var(--color-surface);border:1px solid var(--gold-500);border-radius:var(--radius-lg);padding:1.5rem 2rem;max-width:620px;width:92%;max-height:85vh;overflow-y:auto;">';
  html += '<div style="font-size:var(--text-md);color:var(--gold-400);letter-spacing:0.12em;margin-bottom:0.8rem;text-align:center;">〔 额 外 召 人 〕</div>';
  html += '<div style="font-size:0.68rem;color:var(--ink-300);margin-bottom:0.8rem;line-height:1.6;">勾选欲额外召入之人。召何种人、何种后果，由朝会推演自行判定——可能平静入朝，也可能立招御史谏劾或老臣抗争。</div>';

  Object.keys(groups).forEach(function(gn) {
    var list = groups[gn];
    if (list.length === 0) return;
    html += '<div style="margin-bottom:0.7rem;">';
    html += '<div style="font-size:0.75rem;color:var(--gold-l);font-weight:700;margin-bottom:0.3rem;">' + gn + '（' + list.length + '）</div>';
    html += '<div style="display:flex;flex-direction:column;gap:3px;">';
    list.forEach(function(p) {
      var idStr = escHtml(p.name).replace(/"/g,'&quot;');
      html += '<label style="display:flex;align-items:center;gap:6px;font-size:0.75rem;color:var(--color-foreground-secondary);cursor:pointer;padding:2px 6px;border-radius:3px;" onmouseover="this.style.background=\'var(--color-elevated)\'" onmouseout="this.style.background=\'\'">';
      html += '<input type="checkbox" class="cc2-extra-cb" value="' + idStr + '">';
      html += '<span>' + escHtml(p.name) + '</span>';
      html += '<span style="color:var(--ink-300);font-size:0.65rem;">' + escHtml((p.ch.officialTitle||p.ch.title||'') + ' · ' + (p.reason||'')) + '</span>';
      html += '</label>';
    });
    html += '</div></div>';
  });

  html += '<div style="display:flex;gap:var(--space-2);margin-top:1rem;justify-content:center;">';
  html += '<button class="bt bp" onclick="_cc2_confirmExtraSummons()">确认召入所选</button>';
  html += '<button class="bt" onclick="_cc2_openPrepareDialog()">返回</button>';
  html += '</div></div>';
  bg.innerHTML = html;
}

function _cc2_confirmExtraSummons() {
  var chks = document.querySelectorAll('.cc2-extra-cb:checked');
  var names = [];
  chks.forEach(function(c) { if (c.value) names.push(c.value); });
  CY._cc2Prepare.extraSummons = names;
  // 回到主筹备页
  _cc2_openPrepareDialog();
  var sum = _$('cc2-prepare-summary');
  if (sum && names.length > 0) sum.textContent = '已选额外召入 ' + names.length + ' 人：' + names.slice(0, 6).join('、') + (names.length > 6 ? '…' : '');
}

async function _cc2_startCourtSession() {
  var bg = _$('cc2-prepare-bg'); if (bg) bg.remove();

  var body = _$('cy-body'); var footer = _$('cy-footer');
  if (!body) return;
  body.innerHTML = '';
  CY.phase = 'changchao';
  CY._abortChaoyi = false; CY._pendingPlayerLine = null;
  if (typeof _cyShowInputRow === 'function') _cyShowInputRow(true);
  CY._cc2 = {
    state: 'opening',
    queue: [],            // 议程队列
    currentIdx: -1,       // 当前议程在 queue 中的 index
    currentPhase: null,   // 7 阶段之一
    roundNum: 0,          // 议论轮次
    chaos: false,
    decisions: [],        // 所有裁决记录
    attendees: [],        // 实际在场
    extraSummons: (CY._cc2Prepare && CY._cc2Prepare.extraSummons) || [],
    urgentSeen: false,    // 玩家是否已见过急奏
    playerInitiated: []   // 玩家主动议程计数
  };

  // 实际在场 = 常规应到 + 额外召入
  var regular = CY._cc2Prepare.regularAttendees || [];
  regular.forEach(function(ch) {
    CY._cc2.attendees.push({ name: ch.name, title: ch.officialTitle||ch.title||'', faction: ch.faction||'', party: ch.party||'' });
  });
  (CY._cc2.extraSummons||[]).forEach(function(nm) {
    var ch = findCharByName(nm);
    if (ch) CY._cc2.attendees.push({ name: ch.name, title: ch.officialTitle||ch.title||(ch.spouse?'后妃':'布衣'), faction: ch.faction||'', party: ch.party||'', special: true });
  });

  addCYBubble('内侍', '（鸣鞭三声，百官列班就位。）', true);
  if (CY._cc2Prepare.absent.length > 0) {
    var _absLst = CY._cc2Prepare.absent.filter(function(a){ return !CY._cc2.extraSummons.includes(a.name); });
    if (_absLst.length > 0) addCYBubble('内侍', '（缺朝：' + _absLst.slice(0,6).map(function(a){return a.name+'('+a.reason+')';}).join('、') + (_absLst.length>6?'…等':'') + '）', true);
  }
  addCYBubble('内侍', '（出席 ' + CY._cc2.attendees.length + ' 人，皇帝御殿。）', true);

  // 若有额外召入——立即先触发"召入议程"（每人一条）
  if (CY._cc2.extraSummons.length > 0) {
    CY._cc2.extraSummons.forEach(function(nm) {
      CY._cc2.queue.push({
        _type: 'summon_arrival',
        summonedName: nm,
        title: '传召 ' + nm + ' 入朝',
        content: '陛下召' + nm + '入殿。',
        dept: '内侍',
        presenter: '内侍',
        type: 'announcement',
        _prePlanned: true
      });
    });
  }

  // 开场气氛（非阻塞）
  _ccGenOpeningAtmosphere();

  // 后台生成议程队列
  footer.innerHTML = '<div style="text-align:center;color:var(--color-foreground-muted);padding:0.6rem;font-size:0.78rem;">百官整理奏牍中……</div>';
  try {
    var agendaPrompt = _cc2_buildAgendaPrompt();
    // token 预算按朝议字数 × 最多 9 条议程估算（约汉字数 × 2.5 + JSON wrapper），不低于 5000
    var _agendaTok = (typeof _aiDialogueTok === 'function') ? Math.max(5000, _aiDialogueTok('cy', 9)) : 8000;
    var raw = await callAI(agendaPrompt, _agendaTok);
    var items = (typeof extractJSON === 'function') ? extractJSON(raw) : null;
    if (!Array.isArray(items)) items = [];
    items.forEach(function(it){ CY._cc2.queue.push(it); });
    // 紧急事件插队
    var _emg = _genEmergencyItem();
    if (_emg) CY._cc2.queue.unshift(_emg);
  } catch(e) { _dbg && _dbg('[CC2] 议程生成失败', e); }

  // 开始主循环
  _cc2_advance();
}

function _cc2_buildAgendaPrompt() {
  var p = '你是常朝议程编撰官。请为今日常朝后台生成 5-9 条奏报事务（玩家暂不可见，将按顺序一条一条登场）。\n';
  p += '当前：' + (typeof getTSText==='function'?getTSText(GM.turn):'T'+GM.turn) + '\n';
  if (GM.currentIssues) {
    var _pi = GM.currentIssues.filter(function(i){return i.status==='pending';}).slice(0,5);
    if (_pi.length) p += '【待处理时政——须出现在议程】\n' + _pi.map(function(i){return '  '+i.title+'：'+(i.description||'').slice(0,50);}).join('\n') + '\n';
  }
  var _at = CY._cc2.attendees || [];
  if (_at.length) {
    p += '【在场官员】\n' + _at.slice(0,20).map(function(a){
      var ch = findCharByName(a.name);
      return '  ' + a.name + (a.title?'('+a.title+')':'') + (a.faction?' 属'+a.faction:'') + (a.party?' 党'+a.party:'') + (ch&&ch.personality?' 性:'+ch.personality.slice(0,16):'');
    }).join('\n') + '\n';
  }
  if (GM._ccHeldItems && GM._ccHeldItems.length) {
    p += '【上次留中事务——须再次出现】\n';
    GM._ccHeldItems.forEach(function(h){p+='  '+(h.dept||'')+'：'+(h.title||'')+'——'+(h.content||'')+'\n';});
    GM._ccHeldItems = [];
  }
  p += '\n每条议程格式：\n{\n';
  p += '  "presenter":"奏报者姓名(从在场官员挑)",\n';
  p += '  "dept":"所属部门",\n';
  p += '  "type":"routine日常/request请旨/warning预警/emergency紧急/personnel人事/confrontation对质弹劾/joint_petition联名/personal_plea个人请旨",\n';
  p += '  "urgency":"normal/urgent(仅紧急/涉变事用)",\n';
  p += '  "title":"10字内标题",\n';
  p += '  "announceLine":"启奏台词·15-30字·如\'臣户部尚书张某有贺表及岁贡呈奏\'——这一句可以简略",\n';
  p += '  "content":"奏报正文·半文言·此为\\"奏报\\"阶段气泡内容·须达到朝议字数范围' + (typeof _aiDialogueWordHint === 'function' ? _aiDialogueWordHint('cy').replace(/^（|）$/g,'') : '约 150-300 字') + '·不得短于此下限",\n';
  p += '  "controversial":0-10(争议度——涉党争/既得利益冲突时高),\n';
  p += '  "importance":0-10(重要度——涉边防/财政危机时高),\n';
  p += '  "relatedDepts":["兵部","户部"](除奏报部门外，议题涉及的其他部门),\n';
  p += '  "relatedPeople":["X","Y"](议题直接涉及的人名，如弹劾target/举荐人等)\n';
  p += '}\n';
  p += '要求：\n';
  p += '· 至少 1 条 urgent 紧急事务\n';
  p += '· 至少 1 条 confrontation（官员对质/弹劾，须有明确 target）\n';
  p += '· 议程类型多样，不要全是 routine\n';
  p += '· 高 controversial 的议题会引发 2-3 轮朝堂交锋\n';
  p += '· 关联本回合的 currentIssues\n';
  p += '· content 字段必须遵守朝议字数（仅 announceLine 可简略），百官奏报须行文详尽\n';
  p += '返回 JSON 数组。';
  return p;
}

// ─── 主循环：推进到下一议程 ───

function _cc2_advance() {
  if (!CY._cc2) return;
  CY._cc2.currentIdx++;
  var q = CY._cc2.queue;
  if (CY._cc2.currentIdx >= q.length) {
    return _cc2_closeSession();
  }
  var cur = q[CY._cc2.currentIdx];
  CY._cc2.currentPhase = 'announce';
  CY._cc2.roundNum = 0;
  CY._cc2.chaos = false;
  _cc2_phaseAnnounce(cur);
}

// ─── 阶段 ① 启奏 ───

function _cc2_phaseAnnounce(item) {
  var presenter = item.presenter || '百官';
  // 特殊议程：传召到达
  if (item._type === 'summon_arrival') {
    addCYBubble('内侍', '（' + item.summonedName + '奉召入殿。）', true);
    // 由 AI 判定百官反应——结合记忆/背景/党派/该人身份/当前朝局
    _cc2_judgeSummonReaction(item);
    return;
  }

  var urgTag = item.urgency === 'urgent' ? '⚡ ' : '';
  var line = item.announceLine || (presenter + '：臣有事启奏');
  addCYBubble(presenter, urgTag + line, false);

  // 急奏首次视觉提示
  if (item.urgency === 'urgent' && !CY._cc2.urgentSeen) {
    CY._cc2.urgentSeen = true;
    addCYBubble('内侍', '（此为急奏，陛下是否先听？）', true);
  }

  // 玩家选项
  var footer = _$('cy-footer');
  var _buttons = '<div style="display:flex;gap:var(--space-1);flex-wrap:wrap;justify-content:center;">';
  _buttons += '<button class="bt bp bsm" onclick="_cc2_allowReport()">' + (item.urgency === 'urgent' ? '允其奏' : '奏来') + '</button>';
  if (item.urgency !== 'urgent') _buttons += '<button class="bt bsm" onclick="_cc2_deferReport()">稍后再奏</button>';
  _buttons += '<button class="bt bsm" onclick="_cc2_askBrief()">所奏何事？</button>';
  _buttons += '</div>' + _cc2_globalButtons();
  footer.innerHTML = _buttons;
}

function _cc2_allowReport() {
  var cur = _cc2_curItem();
  if (!cur) return;
  CY._cc2.currentPhase = 'report';
  _cc2_phaseReport(cur);
}

function _cc2_deferReport() {
  var cur = _cc2_curItem();
  if (!cur) return;
  // 移到队尾
  CY._cc2.queue.push(cur);
  CY._cc2.queue.splice(CY._cc2.currentIdx, 1);
  CY._cc2.currentIdx--;
  addCYBubble('内侍', '（陛下令' + (cur.presenter||'') + '稍后再奏。）', true);
  _cc2_advance();
}

function _cc2_askBrief() {
  var cur = _cc2_curItem();
  if (!cur) return;
  addCYBubble(cur.presenter || '臣', '臣所奏：' + (cur.title||'') + '——' + (cur.content||'').slice(0, 40) + '……', false);
  // 继续选择
  var footer = _$('cy-footer');
  footer.innerHTML = '<div style="display:flex;gap:var(--space-1);justify-content:center;">'
    + '<button class="bt bp bsm" onclick="_cc2_allowReport()">奏来</button>'
    + '<button class="bt bsm" onclick="_cc2_deferReport()">稍后</button>'
    + '</div>' + _cc2_globalButtons();
}

// ─── 阶段 ② 奏报 ───

function _cc2_phaseReport(item) {
  var presenter = item.presenter || '臣';
  var typeColors = { routine:'', request:'color:var(--amber-400);', warning:'color:var(--vermillion-400);', emergency:'color:var(--vermillion-400);font-weight:bold;', personnel:'color:var(--indigo-400);', confrontation:'color:var(--vermillion-400);', joint_petition:'color:var(--gold-400);', personal_plea:'color:var(--purple,#9b59b6);' };
  var style = typeColors[item.type] || '';
  addCYBubble(presenter, '<span style="' + style + '">' + escHtml(item.content||item.title||'') + '</span>', false, true);

  // 进入议论阶段——先判断是否一轮都无人应答（简单 routine 可跳过议论）
  CY._cc2.currentPhase = 'debate';
  CY._cc2.roundNum = 1;
  // 100ms 后开始议论（视觉节奏）
  setTimeout(function() { _cc2_phaseDebate(item); }, 600);
}

// ─── 阶段 ③ 议论（多轮，带嘈杂判定） ───

async function _cc2_phaseDebate(item) {
  var attendees = CY._cc2.attendees || [];
  // 计算参与者分值
  var excludeNames = [item.presenter];
  var ranked = _cc2_judgeParticipants(item, attendees, excludeNames);

  // 无人上榜 → 跳过议论
  if (ranked.length === 0) {
    return _cc2_enterDecide(item);
  }

  // AI 判定本议程是否会嘈杂（结合 controversial/党争/性格）
  var chaosVerdict = await _cc2_judgeChaosOnset(item, ranked);
  CY._cc2.chaos = chaosVerdict.chaos;

  // 本轮生成 1-4 条发言
  var picks = ranked.slice(0, chaosVerdict.chaos ? Math.min(5, ranked.length) : Math.min(Math.floor(Math.random()*2)+2, ranked.length));
  await _cc2_genRoundSpeeches(item, picks, CY._cc2.roundNum);

  // 嘈杂表现：内侍注解
  if (CY._cc2.chaos) {
    addCYBubble('内侍', '（殿中喧哗，几人同声相应。）', true);
    _cc2_setChaosBg(true);
  }

  // 决定是否再轮
  CY._cc2.roundNum++;
  var footer = _$('cy-footer');
  var _moreBtns = '';
  if (CY._cc2.roundNum <= 3 && ranked.length > picks.length) {
    _moreBtns += '<button class="bt bsm" onclick="_cc2_continueDebate()">再听一轮</button>';
  }
  if (CY._cc2.chaos) {
    _moreBtns += '<button class="bt bsm" onclick="_cc2_callSilence()">🔔 肃静</button>';
    _moreBtns += '<button class="bt bsm" onclick="_cc2_openReprimand()">⚡ 呵斥某人</button>';
  }
  _moreBtns += '<button class="bt bp bsm" onclick="_cc2_enterDecide()">裁决</button>';
  footer.innerHTML = '<div style="display:flex;gap:var(--space-1);justify-content:center;flex-wrap:wrap;">' + _moreBtns + '</div>' + _cc2_globalButtons();
}

async function _cc2_continueDebate() {
  var cur = _cc2_curItem();
  if (!cur) return;
  // 再议一轮，换人
  var attendees = CY._cc2.attendees || [];
  var already = _cc2_getAlreadySpoken();
  var excludeNames = [cur.presenter].concat(already);
  var ranked = _cc2_judgeParticipants(cur, attendees, excludeNames);
  if (ranked.length === 0) { return _cc2_enterDecide(cur); }
  var picks = ranked.slice(0, Math.min(2, ranked.length));
  await _cc2_genRoundSpeeches(cur, picks, CY._cc2.roundNum);
  CY._cc2.roundNum++;
  var footer = _$('cy-footer');
  var _btns = '<button class="bt bp bsm" onclick="_cc2_enterDecide()">裁决</button>';
  if (CY._cc2.roundNum <= 4 && ranked.length > picks.length) _btns = '<button class="bt bsm" onclick="_cc2_continueDebate()">再听</button>' + _btns;
  if (CY._cc2.chaos) _btns += '<button class="bt bsm" onclick="_cc2_callSilence()">🔔 肃静</button>';
  footer.innerHTML = '<div style="display:flex;gap:var(--space-1);justify-content:center;flex-wrap:wrap;">' + _btns + '</div>' + _cc2_globalButtons();
}

function _cc2_callSilence() {
  addCYBubble('内侍', '（鸣磬肃静，百官噤声。）', true);
  CY._cc2.chaos = false;
  _cc2_setChaosBg(false);
  _cc2_enterDecide();
}

function _cc2_setChaosBg(on) {
  var body = _$('cy-body');
  if (!body) return;
  body.style.background = on ? 'linear-gradient(to bottom, rgba(192,57,43,0.04), rgba(0,0,0,0))' : '';
}

// ─── 嘈杂判定（AI） ───

async function _cc2_judgeChaosOnset(item, rankedParticipants) {
  var ctrs = parseInt(item.controversial, 10) || 0;
  var imp = parseInt(item.importance, 10) || 0;
  // 简化启发式：若议题低争议且人少 → 不嘈杂，省一次 AI 调用
  if (ctrs < 4 && imp < 5) return { chaos: false };
  if (rankedParticipants.length < 3) return { chaos: false };

  // 有对立倾向的参与者对数
  var factionsPresent = {};
  rankedParticipants.forEach(function(p){
    var ch = findCharByName(p.a.name);
    if (ch && ch.party) factionsPresent[ch.party] = (factionsPresent[ch.party]||0)+1;
  });
  if (Object.keys(factionsPresent).length < 2 && ctrs < 7) return { chaos: false };

  // AI 判定
  if (!P.ai || !P.ai.key) {
    return { chaos: (ctrs >= 6 && Object.keys(factionsPresent).length >= 2) };
  }
  try {
    var prompt = '朝会议程：' + (item.title||'') + '——' + (item.content||'').slice(0, 80) + '\n';
    prompt += '议题争议度:' + ctrs + '/10，重要度:' + imp + '/10\n';
    prompt += '可能发言者：' + rankedParticipants.slice(0,5).map(function(p){
      var ch = findCharByName(p.a.name);
      return p.a.name + '('+(p.a.party||'')+(ch&&ch.personality?'·'+ch.personality.slice(0,10):'')+')';
    }).join('、') + '\n';
    prompt += '按党派立场/人物性格/议题性质，本议程朝堂讨论是否会演变为群臣争辩喧哗？\n';
    prompt += '返回 JSON：{"chaos":true/false,"reason":"简述"}';
    var raw = await callAI(prompt, 200);
    var obj = (typeof extractJSON === 'function') ? extractJSON(raw) : null;
    if (obj && typeof obj.chaos === 'boolean') return obj;
  } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-chaoyi-keju');}catch(_){}}
  return { chaos: ctrs >= 7 };
}

// ─── 参与者智能判定（12 维加权） ───

function _cc2_scoreParticipant(npc, item, roundNum) {
  var ch = findCharByName(npc.name);
  if (!ch) return 0;
  var score = 0;

  // 1 本部门
  if (item.dept && (ch.officialTitle||ch.title||'').indexOf(item.dept) >= 0) score += 20;
  // 2 相关部门
  if (Array.isArray(item.relatedDepts)) item.relatedDepts.forEach(function(d){
    if ((ch.officialTitle||ch.title||'').indexOf(d) >= 0) score += 10;
  });
  // 3 品级权重
  var rank = (typeof getRankLevel === 'function') ? getRankLevel(ch.officialTitle||'') : 10;
  score += Math.max(0, (10 - Math.min(rank, 10)) * 2);
  // 4 对立派系
  var presenterCh = findCharByName(item.presenter);
  if (presenterCh && ch.party && presenterCh.party) {
    if (ch.party !== presenterCh.party) score += 15;
    else score += 8; // 同党附议
  }
  // 5 御史谏官
  if (/御史|谏|给事中|侍御|拾遗|补阙/.test(ch.officialTitle||ch.title||'')) score += 12;
  // 6 议题涉及其家族/门生/故吏
  if (Array.isArray(item.relatedPeople)) {
    item.relatedPeople.forEach(function(pn) {
      var rel = findCharByName(pn);
      if (rel) {
        if (rel.family === ch.family && ch.family) score += 10;
        if (rel._recommendedBy === ch.name) score += 8; // 举主
        if (ch._recommendedBy === rel.name) score += 8; // 被举荐人
      }
    });
  }
  // 7 政敌宿仇
  if (typeof AffinityMap !== 'undefined' && presenterCh) {
    var aff = AffinityMap.getValue ? AffinityMap.getValue(ch.name, presenterCh.name) : 0;
    if (aff < -40) score += 12;
  }
  // 8 性格加成
  var traits = (ch.traits || []).concat(ch.traitIds||[]);
  if (traits.indexOf('zealous') >= 0 || traits.indexOf('brave') >= 0 || traits.indexOf('arrogant') >= 0) score += 15;
  if (traits.indexOf('cautious_leader') >= 0 || traits.indexOf('shy') >= 0 || traits.indexOf('craven') >= 0) score -= 10;
  if (traits.indexOf('deceitful') >= 0) score += Math.random() < 0.4 ? 8 : -5;
  // 9 情绪状态
  if ((ch.stress||0) > 60) score += 5;
  if ((ch.loyalty||50) < 30) score += 5;
  // 10 近期记忆相关
  if (ch._memory && Array.isArray(ch._memory)) {
    var recent = ch._memory.slice(-8);
    var relates = recent.filter(function(m){
      var ev = (m.event||'').toString();
      return ev.indexOf(item.title||'!!') >= 0 || (Array.isArray(item.relatedPeople) && item.relatedPeople.some(function(p){return ev.indexOf(p)>=0;}));
    });
    score += Math.min(8, relates.length * 3);
  }
  // 11 轮次降权（已说过的本轮降分）
  if (roundNum > 1) score -= 5;
  // 12 被特殊召入的——后妃/布衣议题旁观为主
  if (npc.special) score -= 8;

  // 随机噪声
  score += Math.random() * 5;
  return score;
}

function _cc2_judgeParticipants(item, attendees, excludeNames) {
  var THRESHOLD = 18; // 低于此分不发言
  return attendees
    .filter(function(a){ return !excludeNames.includes(a.name); })
    .map(function(a){ return { a: a, score: _cc2_scoreParticipant(a, item, CY._cc2.roundNum||1) }; })
    .filter(function(x){ return x.score >= THRESHOLD; })
    .sort(function(x,y){ return y.score - x.score; });
}

function _cc2_getAlreadySpoken() {
  return (CY._cc2._spokenThisAgenda || []);
}

// ─── 生成 1 轮发言 ───

async function _cc2_genRoundSpeeches(item, picks, roundNum) {
  if (!picks || !picks.length) return;
  if (!CY._cc2._spokenThisAgenda) CY._cc2._spokenThisAgenda = [];

  if (!P.ai || !P.ai.key) {
    // 无 AI：简单占位
    picks.forEach(function(p){
      addCYBubble(p.a.name, '（臣以为……）', false);
      CY._cc2._spokenThisAgenda.push(p.a.name);
    });
    return;
  }

  var attendeeList = (CY._cc2.attendees||[]).map(function(a){return a.name;}).join('、');
  var speechHistoryThisRound = []; // 本轮前面 NPC 的发言·供后发言者引用

  // 逐个 NPC·流式·同步阻塞（一个说完再下一个）
  for (var i = 0; i < picks.length; i++) {
    if (CY._abortChaoyi) break; // 玩家打断
    // 玩家插言：上一人说完、下一人未开口时消费
    if (CY._pendingPlayerLine) {
      var _pline = CY._pendingPlayerLine;
      CY._pendingPlayerLine = null;
      var _pName = (P.playerInfo && P.playerInfo.characterName) || '陛下';
      try { addCYBubble(_pName, _pline, true); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-chaoyi-keju');}catch(_){}}
      speechHistoryThisRound.push({ name: _pName, type: '陛下口谕', line: _pline });
    }
    var p = picks[i];
    var name = p.a.name;
    var ch = findCharByName(name);
    if (!ch) continue;

    // 1) 先添加空气泡，准备接收流式文本
    var body = _$('cy-body'); if (!body) return;
    var div = document.createElement('div');
    div.style.cssText = 'display:flex;gap:0.5rem;margin-bottom:0.8rem;animation:fi 0.3s ease;';
    var avatar = ch.portrait ? '<img src="' + escHtml(ch.portrait) + '" style="width:28px;height:28px;object-fit:cover;border-radius:50%;flex-shrink:0;border:1.5px solid var(--gold-d);">'
                             : '<div style="width:28px;height:28px;border-radius:50%;background:var(--bg-4);display:flex;align-items:center;justify-content:center;font-size:0.8rem;border:1.5px solid var(--gold-d);flex-shrink:0;">\uD83D\uDC64</div>';
    div.innerHTML = avatar
      + '<div style="flex:1;min-width:0;"><div style="font-size:0.7rem;color:var(--gold);">' + escHtml(name)
      + (ch.title ? ' \u00B7 ' + escHtml(ch.title) : '') + '</div>'
      + '<div class="cy-bubble cc2-stream-bubble" style="background:var(--bg-3);border:1px solid var(--bdr);border-radius:3px 10px 10px 10px;padding:0.4rem 0.7rem;font-size:0.85rem;line-height:1.6;color:var(--txt-d);">\u2026</div>'
      + '<div class="cc2-stream-type-tag" style="font-size:0.64rem;color:var(--txt-d);margin-top:2px;display:none;"></div></div>';
    body.appendChild(div); body.scrollTop = body.scrollHeight;
    var bubbleEl = div.querySelector('.cy-bubble');
    var typeTagEl = div.querySelector('.cc2-stream-type-tag');

    // 2) 构建本 NPC 专属 prompt（带前文+本轮已发言）
    var prompt = '朝会议论·第 ' + roundNum + ' 轮\u3002\n';
    prompt += '议程：' + (item.title||'') + '——' + (item.content||'') + '\n';
    prompt += '奏报者：' + (item.presenter||'') + '\n';
    prompt += '在场官员：' + attendeeList + '\n';
    if (CY._cc2._spokenThisAgenda.length) prompt += '本议程已发言者：' + CY._cc2._spokenThisAgenda.join('、') + '\n';
    if (speechHistoryThisRound.length) {
      prompt += '\n【本轮前面同僚发言（你应针对性回应或立场分野）】\n';
      speechHistoryThisRound.forEach(function(s) {
        prompt += '  ' + s.name + '〔' + s.type + '〕：' + s.line.slice(0, 80) + '\n';
      });
    }
    prompt += '\n请为 ' + name + ' 生成一条朝堂发言：\n';
    prompt += '身份：' + (p.a.title||'') + (p.a.party?'·'+p.a.party:'') + '\n';
    prompt += '性格：' + (ch.personality||'').slice(0, 30) + '\n';
    prompt += '忠诚：' + Math.round(ch.loyalty||50) + '，整廉：' + Math.round(ch.integrity||50) + '\n';
    if (typeof NpcMemorySystem !== 'undefined') {
      var mem = NpcMemorySystem.getMemoryContext(name);
      if (mem) prompt += '个人记忆：' + mem.slice(0, 150) + '\n';
    }
    prompt += '\n发言类型（首行输出）：附议/反驳/弹劾/劝谏/讽喻/请旨/折中/冷眼\n';
    prompt += '格式：第一行仅输出【类型】二字（如"附议"），从第二行起输出发言正文。\n';
    prompt += (typeof _aiDialogueWordHint === 'function' ? _aiDialogueWordHint('cy') + '\n' : '（发言约 150-300 字）\n');
    prompt += '文言/半文言·符合身份·针对前文·不空话套话。';

    // 3) 流式生成·A3: onChunk 经 requestAnimationFrame 节流·减少 DOM 抖动
    var tokens = (typeof _aiDialogueTok==='function' ? _aiDialogueTok("cy", 1) : 500);
    CY.abortCtrl = new AbortController();
    var full = '';
    var _ccRaf = false;
    try {
      full = await callAIMessagesStream(
        [{ role: 'user', content: prompt }], tokens,
        {
          signal: CY.abortCtrl.signal,
          tier: (typeof _useSecondaryTier === 'function' && _useSecondaryTier()) ? 'secondary' : undefined,  // M3·常朝走次 API
          onChunk: function(txt) {
            if (!bubbleEl || _ccRaf) return;
            _ccRaf = true;
            requestAnimationFrame(function() {
              _ccRaf = false;
              // 解析第一行类型
              var lines = (txt||'').split(/\r?\n/);
              var typeVal = (lines[0]||'').trim().replace(/[【】\[\]〔〕·:：\s]/g, '').slice(0, 4);
              var bodyTxt = lines.slice(1).join('\n').trim() || txt;
              var typeColors = { '附议':'var(--celadon-400)','反驳':'var(--vermillion-400)','弹劾':'var(--vermillion-400)','劝谏':'var(--amber-400)','讽喻':'var(--indigo-400)','请旨':'var(--gold-400)','折中':'var(--color-foreground)','冷眼':'var(--ink-300)' };
              if (typeColors[typeVal]) {
                if (typeTagEl) { typeTagEl.textContent = '〔' + typeVal + '〕'; typeTagEl.style.color = typeColors[typeVal]; typeTagEl.style.display = 'inline-block'; }
                bubbleEl.textContent = bodyTxt;
                bubbleEl.style.color = typeColors[typeVal];
              } else {
                bubbleEl.textContent = txt;
                bubbleEl.style.color = '';
              }
              body.scrollTop = body.scrollHeight;
            });
          }
        }
      );
    } catch(e) {
      console.warn('[cc2 speech stream]', name, e);
      if (bubbleEl) { bubbleEl.textContent = '（未能陈词）'; bubbleEl.style.color = 'var(--red)'; }
      continue;
    }
    if (!full) { if (bubbleEl) bubbleEl.textContent = '（沉默不语）'; continue; }

    // 4) 最终解析类型+正文
    var _lines = full.split(/\r?\n/);
    var _type = (_lines[0]||'').trim().replace(/[【】\[\]〔〕·:：\s]/g, '').slice(0, 4);
    var _line = _lines.slice(1).join('\n').trim();
    if (!_line) _line = full;
    // A3 修·RAF 尾帧丢失保护：强制最终更新 bubble（RAF pending 时 await 已完成、下一人循环立即覆盖）
    if (bubbleEl) {
      var _typeColorsFinal = { '附议':'var(--celadon-400)','反驳':'var(--vermillion-400)','弹劾':'var(--vermillion-400)','劝谏':'var(--amber-400)','讽喻':'var(--indigo-400)','请旨':'var(--gold-400)','折中':'var(--color-foreground)','冷眼':'var(--ink-300)' };
      if (_typeColorsFinal[_type]) {
        if (typeTagEl) { typeTagEl.textContent = '〔' + _type + '〕'; typeTagEl.style.color = _typeColorsFinal[_type]; typeTagEl.style.display = 'inline-block'; }
        bubbleEl.textContent = _line;
        bubbleEl.style.color = _typeColorsFinal[_type];
      } else {
        bubbleEl.textContent = _line || full;
        bubbleEl.style.color = '';
      }
    }
    CY._cc2._spokenThisAgenda.push(name);
    speechHistoryThisRound.push({ name: name, type: _type || '发言', line: _line });

    // NPC 记忆
    if (typeof NpcMemorySystem !== 'undefined') {
      var emo = _type === '附议' ? '喜' : (_type === '反驳' || _type === '弹劾') ? '怒' : (_type === '劝谏' ? '忧' : '平');
      try { NpcMemorySystem.remember(name, '常朝就「' + (item.title||'') + '」' + (_type||'发言') + '：' + _line.slice(0,40), emo, 4); } catch(_){}
    }

  }

  // 末尾：最后一人发完后玩家若仍有插言，立即落地显示
  if (CY._pendingPlayerLine) {
    var _tailLine = CY._pendingPlayerLine;
    CY._pendingPlayerLine = null;
    var _tailName = (P.playerInfo && P.playerInfo.characterName) || '陛下';
    try { addCYBubble(_tailName, _tailLine, true); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-chaoyi-keju');}catch(_){}}
    speechHistoryThisRound.push({ name: _tailName, type: '陛下口谕', line: _tailLine });
  }
}

// ─── 阶段 ④ 裁决 ───

function _cc2_enterDecide(item) {
  item = item || _cc2_curItem();
  if (!item) return;
  CY._cc2.currentPhase = 'decide';
  _cc2_setChaosBg(false);

  var footer = _$('cy-footer');
  var isConfrontation = item.type === 'confrontation';
  var btns = '<div style="display:flex;gap:var(--space-1);justify-content:center;flex-wrap:wrap;">';
  if (isConfrontation) {
    btns += '<button class="bt bp bsm" onclick="_cc2_decide(\'approve\')">查办</button>';
    btns += '<button class="bt bsm" style="color:var(--vermillion-400);" onclick="_cc2_decide(\'reject\')">驳回弹劾</button>';
  } else {
    btns += '<button class="bt bp bsm" onclick="_cc2_decide(\'approve\')">✅ 准</button>';
    btns += '<button class="bt bsm" style="color:var(--vermillion-400);" onclick="_cc2_decide(\'reject\')">❌ 驳</button>';
  }
  btns += '<button class="bt bsm" onclick="_cc2_decide(\'discuss\')">⚖️ 付廷议</button>';
  btns += '<button class="bt bsm" onclick="_cc2_decide(\'hold\')">🕯️ 留中</button>';
  btns += '</div>' + _cc2_globalButtons();
  footer.innerHTML = btns;
}

function _cc2_decide(action) {
  var item = _cc2_curItem();
  if (!item) return;
  CY._cc2.decisions.push({ item: item, action: action, turn: GM.turn });
  _cc2_setChaosBg(false);

  var _actionLbl = { approve:'准', reject:'驳', discuss:'付廷议', hold:'留中' }[action];
  addCYBubble('皇帝', '朕意：' + _actionLbl + '。' + (item.title||''), false);

  // 关键议程写入纪事（confrontation/emergency/personnel/或 approve 重要诏令）
  var _shouldJishi = action === 'approve' || item.type === 'confrontation' || item.type === 'emergency' || item.type === 'personnel' || item.type === 'joint_petition';
  if (_shouldJishi) {
    _cy_jishiAdd('changchao', item.title||'', item.presenter||'', (item.content||''), { action: action, dept: item.dept||'' });
  }

  // 落入实际机制
  var date = typeof getTSText==='function' ? getTSText(GM.turn) : '';
  if (action === 'approve') {
    if (!GM._edictTracker) GM._edictTracker = [];
    GM._edictTracker.push({ id: (typeof uid === 'function' ? uid() : 'cc_' + Date.now()), content: item.title + '：' + item.content, category: item.dept||'常朝', turn: GM.turn, status: 'pending', assignee: item.presenter||'', feedback: '', progressPercent: 0, source: 'changchao2' });
    if (typeof addEB === 'function') addEB('常朝', '准：' + item.title);
  } else if (action === 'reject') {
    if (typeof addEB === 'function') addEB('常朝', '驳：' + item.title);
    if (item.presenter && typeof NpcMemorySystem !== 'undefined') {
      NpcMemorySystem.remember(item.presenter, '常朝所奏「' + item.title + '」被驳回', '忧', 5);
    }
  } else if (action === 'discuss') {
    if (!GM._pendingTinyiTopics) GM._pendingTinyiTopics = [];
    GM._pendingTinyiTopics.push({ topic: item.title + '：' + item.content, from: item.presenter, turn: GM.turn });
    if (typeof addEB === 'function') addEB('常朝', '转廷议：' + item.title);
  } else if (action === 'hold') {
    if (!GM._ccHeldItems) GM._ccHeldItems = [];
    GM._ccHeldItems.push(item);
  }

  CY._cc2.currentPhase = 'react';
  _cc2_phaseReact(item, action);
}

// ─── 阶段 ⑤ 回应 ───

async function _cc2_phaseReact(item, action) {
  // AI 判定即时回应
  if (!P.ai || !P.ai.key) {
    CY._cc2._lastReactions = [];
    return _cc2_phaseContinue(item, action);
  }
  var prompt = '朝会裁决回应——皇帝刚对「' + (item.title||'') + '」（' + (item.presenter||'') + '所奏）裁决：' + action + '（准/驳/议/留）。\n';
  prompt += '议程争议度：' + (item.controversial||0) + '，重要度：' + (item.importance||0) + '\n';
  prompt += '奏报者：' + (item.presenter||'') + '\n';
  prompt += '在场官员：' + (CY._cc2.attendees||[]).slice(0,12).map(function(a){return a.name+(a.party?'('+a.party+')':'');}).join('、') + '\n';
  prompt += '本议程已参与者：' + _cc2_getAlreadySpoken().join('、') + '\n';
  prompt += '请生成 0-3 位在场官员的即时反应（结合其党派、性格、前述立场、记忆）：\n';
  prompt += '类型：圣明/不可/谢恩/黯然/抗辩/冷眼/附和\n';
  prompt += '若有"不可/抗辩"——此为强烈反对，玩家可选择听抗辩或强行通过。\n';
  prompt += (typeof _aiDialogueWordHint === 'function' ? _aiDialogueWordHint() + '（line 遵循此字数）\n' : '');
  prompt += '返回 JSON：[{"name":"","type":"圣明/不可/谢恩/黯然/抗辩/冷眼/附和","line":"内容"}]';

  try {
    var raw = await callAI(prompt, (typeof _aiDialogueTok==='function'?_aiDialogueTok("cy", 1):700));
    var arr = (typeof extractJSON === 'function') ? extractJSON(raw) : null;
    if (!Array.isArray(arr)) arr = [];
    CY._cc2._lastReactions = arr;
    arr.forEach(function(r) {
      if (!r || !r.name || !r.line) return;
      var tcolor = { '圣明':'var(--gold-400)','不可':'var(--vermillion-400)','抗辩':'var(--vermillion-400)','谢恩':'var(--celadon-400)','附和':'var(--celadon-400)','黯然':'var(--ink-300)','冷眼':'var(--ink-300)' }[r.type] || '';
      addCYBubble(r.name, '〔' + (r.type||'') + '〕<span style="color:' + tcolor + ';">' + escHtml(r.line) + '</span>', false);
    });
    return _cc2_phaseContinue(item, action);
  } catch(e) {
    return _cc2_phaseContinue(item, action);
  }
}

// ─── 阶段 ⑥ 延续（有强反对时给玩家机会） ───

function _cc2_phaseContinue(item, action) {
  CY._cc2.currentPhase = 'continue';
  var reactions = CY._cc2._lastReactions || [];
  var hasObjection = reactions.some(function(r){ return r && (r.type === '不可' || r.type === '抗辩'); });

  var footer = _$('cy-footer');
  if (hasObjection) {
    var dissenter = reactions.find(function(r){return r.type==='抗辩'||r.type==='不可';});
    var btns = '<div style="font-size:0.7rem;color:var(--amber-400);text-align:center;margin-bottom:6px;">' + (dissenter?dissenter.name+'强烈反对':'有反对声音') + '</div>';
    btns += '<div style="display:flex;gap:var(--space-1);justify-content:center;flex-wrap:wrap;">';
    btns += '<button class="bt bsm" onclick="_cc2_listenDissent()">🎤 听其抗辩</button>';
    btns += '<button class="bt bp bsm" onclick="_cc2_endAgenda()">🛡️ 朕意已决</button>';
    btns += '<button class="bt bsm" style="color:var(--vermillion-400);" onclick="_cc2_openReprimand()">⚡ 严斥</button>';
    btns += '</div>' + _cc2_globalButtons();
    footer.innerHTML = btns;
  } else {
    _cc2_endAgenda();
  }
}

async function _cc2_listenDissent() {
  var item = _cc2_curItem();
  var reactions = CY._cc2._lastReactions || [];
  var dissenters = reactions.filter(function(r){ return r.type === '抗辩' || r.type === '不可'; });
  if (dissenters.length === 0) return _cc2_endAgenda();
  // AI 生成抗辩详述
  var prompt = '皇帝应允' + dissenters.map(function(d){return d.name;}).join('、') + '抗辩。请为每人生成一段深入抗辩（文言，援引史例/祖制/民生）。\n';
  prompt += (typeof _aiDialogueWordHint === 'function' ? _aiDialogueWordHint() + '\n' : '');
  prompt += '议程：' + (item.title||'') + '——' + (item.content||'') + '\n';
  prompt += '裁决：' + (CY._cc2.decisions[CY._cc2.decisions.length-1]||{}).action + '\n';
  prompt += '返回 JSON：[{"name":"","line":""}]';
  try {
    var raw = await callAI(prompt, (typeof _aiDialogueTok==='function'?_aiDialogueTok("cy", dissenters.length):900));
    var arr = (typeof extractJSON === 'function') ? extractJSON(raw) : null;
    if (Array.isArray(arr)) arr.forEach(function(r){ if (r && r.name && r.line) addCYBubble(r.name, '〔抗辩〕' + r.line, false, true); });
  } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-chaoyi-keju');}catch(_){}}

  // 玩家二选一：改判 或 朕意已决
  var footer = _$('cy-footer');
  footer.innerHTML = '<div style="display:flex;gap:var(--space-1);justify-content:center;flex-wrap:wrap;">'
    + '<button class="bt bsm" onclick="_cc2_reverseDecision()">📝 从其议</button>'
    + '<button class="bt bp bsm" onclick="_cc2_endAgenda()">🛡️ 朕意已决</button>'
    + '</div>' + _cc2_globalButtons();
}

function _cc2_reverseDecision() {
  var last = CY._cc2.decisions[CY._cc2.decisions.length-1];
  if (last) {
    last.action = last.action === 'approve' ? 'reject' : 'approve';
    addCYBubble('皇帝', '（从卿等所议，改为：' + last.action + '）', false);
  }
  _cc2_endAgenda();
}

function _cc2_openReprimand() {
  var reactions = CY._cc2._lastReactions || _cc2_getAlreadySpoken().map(function(n){return{name:n};});
  var candidates = [];
  reactions.forEach(function(r){ if (r && r.name) candidates.push(r.name); });
  if (candidates.length === 0) candidates = _cc2_getAlreadySpoken();
  if (candidates.length === 0) return _cc2_endAgenda();

  var bg = document.createElement('div');
  bg.style.cssText = 'position:fixed;inset:0;z-index:1350;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;';
  var html = '<div style="background:var(--color-surface);border:1px solid var(--vermillion-400);border-radius:var(--radius-lg);padding:1rem 1.5rem;max-width:400px;">';
  html += '<div style="color:var(--vermillion-400);font-weight:bold;margin-bottom:0.6rem;">严斥何人？</div>';
  html += '<div style="display:flex;flex-direction:column;gap:4px;">';
  candidates.forEach(function(nm) {
    html += '<button class="bt bsm" onclick="_cc2_doReprimand(\'' + escHtml(nm).replace(/\'/g,"\\'") + '\');this.closest(\'div[style*=fixed]\').remove();">' + escHtml(nm) + '</button>';
  });
  html += '</div>';
  html += '<div style="text-align:center;margin-top:0.6rem;"><button class="bt" onclick="this.closest(\'div[style*=fixed]\').remove();">取消</button></div>';
  html += '</div>';
  bg.innerHTML = html;
  document.body.appendChild(bg);
}

async function _cc2_doReprimand(name) {
  var ch = findCharByName(name);
  if (!ch) return;
  addCYBubble('皇帝', '（厉声）' + name + '，你好大胆！', false);
  // AI 判定该人连锁后果（结合性格/党派/记忆/当前情况）
  if (P.ai && P.ai.key) {
    var prompt = name + '在常朝上被皇帝严斥。\n';
    prompt += '此人性格：' + (ch.personality||'') + '，党派：' + (ch.party||'无') + '，忠诚：' + (ch.loyalty||50) + '，野心：' + (ch.ambition||40) + '\n';
    prompt += '近期记忆（关键事件）：\n';
    var mem = (ch._memory||[]).slice(-6).map(function(m){return '  · '+(m.event||'').slice(0,50);}).join('\n');
    if (mem) prompt += mem + '\n';
    prompt += '请判定此人最可能的反应：\n';
    prompt += '选一种：public_submit当场叩首认错/secret_resent暗中怀恨/resign_request请辞乞骸/secret_plot密结同党图之/public_refute当场抗辩不服\n';
    prompt += (typeof _aiDialogueWordHint === 'function' ? _aiDialogueWordHint() + '（line 字段遵循此字数）\n' : '');
    prompt += '返回 JSON：{"reaction":"...","line":"该人当场回应的一句话","consequence":"具体后果描述","loyaltyDelta":-15到+5,"stressDelta":+5到+30,"ambitionDelta":-5到+15}';
    try {
      var raw = await callAI(prompt, (typeof _aiDialogueTok==='function'?_aiDialogueTok("cy", 1):500));
      var obj = (typeof extractJSON === 'function') ? extractJSON(raw) : null;
      if (obj) {
        if (obj.line) addCYBubble(name, '〔' + (obj.reaction||'') + '〕' + obj.line, false);
        ch.loyalty = Math.max(0, Math.min(100, (ch.loyalty||50) + (parseInt(obj.loyaltyDelta,10)||0)));
        ch.stress = Math.max(0, Math.min(100, (ch.stress||0) + (parseInt(obj.stressDelta,10)||0)));
        ch.ambition = Math.max(0, Math.min(100, (ch.ambition||40) + (parseInt(obj.ambitionDelta,10)||0)));
        if (typeof NpcMemorySystem !== 'undefined') {
          NpcMemorySystem.remember(name, '常朝上被皇帝当众严斥——' + (obj.consequence||''), '恨', 8);
        }
        // 连锁：请辞 / 暗结党
        if (obj.reaction === 'resign_request') {
          addCYBubble('内侍', '（' + name + '伏阙请辞。）', true);
          if (typeof addEB === 'function') addEB('人事', name + '被斥后请辞');
        } else if (obj.reaction === 'secret_plot' || obj.reaction === 'secret_resent') {
          if (!GM.activeSchemes) GM.activeSchemes = [];
          GM.activeSchemes.push({ schemer: name, target: P.playerInfo&&P.playerInfo.characterName||'玩家', plan: '因被严斥而生怨，暗中串联同党', progress: '酝酿中', allies: '', startTurn: GM.turn, lastTurn: GM.turn });
          if (typeof addEB === 'function') addEB('暗流', name + '被斥后心生怨怼');
        }
      }
    } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-chaoyi-keju');}catch(_){}}
  } else {
    ch.loyalty = Math.max(0, (ch.loyalty||50) - 10);
    ch.stress = Math.min(100, (ch.stress||0) + 15);
  }
  _cc2_endAgenda();
}

// ─── 阶段 ⑦ 结束 ───

function _cc2_endAgenda() {
  addCYBubble('内侍', '（此事已决，可还有奏报？）', true);
  CY._cc2._spokenThisAgenda = [];
  CY._cc2._lastReactions = null;
  CY._cc2.currentPhase = null;
  // 短暂延时再推进
  setTimeout(function(){ _cc2_advance(); }, 300);
}

// ─── 退朝 ───

function _cc2_closeSession() {
  var hasUnprocessed = false; // 本 2.0 版所有议程按序处理
  addCYBubble('内侍', '（百官奏事已毕。陛下是否退朝？）', true);
  var footer = _$('cy-footer');
  footer.innerHTML = '<div style="text-align:center;display:flex;gap:var(--space-1);justify-content:center;">'
    + '<button class="bt bp" onclick="_cc2_finalEnd()">卷帘退朝</button>'
    + '<button class="bt" onclick="_cc2_playerRaiseAgenda()">📣 朕尚有话</button>'
    + '</div>';
}

function _cc2_finalEnd() {
  // 汇总
  var dec = CY._cc2.decisions || [];
  var _ac = dec.filter(function(d){return d.action==='approve';}).length;
  var _rc = dec.filter(function(d){return d.action==='reject';}).length;
  var _dis = dec.filter(function(d){return d.action==='discuss';}).length;
  var _hl = dec.filter(function(d){return d.action==='hold';}).length;
  GM._lastChangchaoDecisions = dec;
  if (typeof addEB === 'function') addEB('常朝', '退朝：准' + _ac + ' 驳' + _rc + ' 议' + _dis + ' 留' + _hl);
  if (GM.qijuHistory) GM.qijuHistory.unshift({ turn: GM.turn, date: typeof getTSText==='function'?getTSText(GM.turn):'', content: '常朝裁决：准'+_ac+'驳'+_rc+'议'+_dis+'留'+_hl });
  addCYBubble('内侍', '（鸣鞭，退朝。）', true);
  if (typeof closeChaoyi === 'function') setTimeout(closeChaoyi, 800);
}

// ─── 全局按钮（朝会 footer 恒有） ───

function _cc2_globalButtons() {
  return '<div style="margin-top:var(--space-2);padding-top:var(--space-2);border-top:1px solid var(--color-border-subtle);display:flex;gap:3px;justify-content:center;flex-wrap:wrap;font-size:0.65rem;">'
    + '<button class="bt" style="font-size:0.65rem;" onclick="_cc2_playerAskOfficial()">📣 朕有话问</button>'
    + '<button class="bt" style="font-size:0.65rem;" onclick="_cc2_playerRaiseAgenda()">🎯 挑议题</button>'
    + '<button class="bt" style="font-size:0.65rem;" onclick="_cc2_playerProclaim()">📜 宣制</button>'
    + '<button class="bt" style="font-size:0.65rem;" onclick="_cc2_openSummonPicker()">🚪 传召</button>'
    + _cy_suggestBtnHtml('常朝')
    + '<button class="bt" style="font-size:0.65rem;color:var(--vermillion-400);" onclick="_cc2_earlyEnd()">🔚 卷帘退朝</button>'
    + '</div>';
}

function _cc2_earlyEnd() {
  // 未处理议程——让玩家选留中或舍
  var remaining = CY._cc2.queue.slice(CY._cc2.currentIdx + 1);
  if (remaining.length === 0) return _cc2_finalEnd();
  var bg = document.createElement('div');
  bg.style.cssText = 'position:fixed;inset:0;z-index:1400;background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;';
  var html = '<div style="background:var(--color-surface);border:1px solid var(--gold-500);border-radius:var(--radius-lg);padding:1.2rem 1.5rem;max-width:440px;">';
  html += '<div style="color:var(--gold-400);margin-bottom:0.8rem;">尚有 ' + remaining.length + ' 条未奏。如何处置？</div>';
  html += '<div style="display:flex;flex-direction:column;gap:var(--space-2);">';
  html += '<button class="bt bp bsm" onclick="_cc2_allHoldAndEnd();this.closest(\'div[style*=fixed]\').remove();">全部留中（下次再奏）</button>';
  html += '<button class="bt bsm" onclick="_cc2_dismissAllAndEnd();this.closest(\'div[style*=fixed]\').remove();">置之不问</button>';
  html += '<button class="bt bsm" onclick="this.closest(\'div[style*=fixed]\').remove();">取消</button>';
  html += '</div></div>';
  bg.innerHTML = html;
  document.body.appendChild(bg);
}

function _cc2_allHoldAndEnd() {
  var remaining = CY._cc2.queue.slice(CY._cc2.currentIdx + 1);
  if (!GM._ccHeldItems) GM._ccHeldItems = [];
  remaining.forEach(function(it){ GM._ccHeldItems.push(it); });
  _cc2_finalEnd();
}

function _cc2_dismissAllAndEnd() { _cc2_finalEnd(); }

// ─── 玩家主动行为 ───

function _cc2_playerAskOfficial() {
  var at = CY._cc2.attendees || [];
  if (at.length === 0) { toast('无人可问'); return; }
  var bg = document.createElement('div');
  bg.style.cssText = 'position:fixed;inset:0;z-index:1350;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;';
  var html = '<div style="background:var(--color-surface);border:1px solid var(--gold-500);border-radius:var(--radius-lg);padding:1rem 1.5rem;max-width:480px;width:90%;">';
  html += '<div style="color:var(--gold-400);margin-bottom:0.6rem;">朕有话问——选一人并输入问题</div>';
  html += '<select id="cc2-ask-sel" style="width:100%;padding:4px;margin-bottom:8px;background:var(--bg-3);color:var(--txt);border:1px solid var(--bdr);border-radius:3px;">';
  at.forEach(function(a){ html += '<option value="' + escHtml(a.name) + '">' + escHtml(a.name) + (a.title?'('+a.title+')':'') + '</option>'; });
  html += '</select>';
  html += '<input id="cc2-ask-input" placeholder="问题……" style="width:100%;padding:4px;margin-bottom:8px;background:var(--bg-3);color:var(--txt);border:1px solid var(--bdr);border-radius:3px;">';
  html += '<div style="display:flex;gap:6px;justify-content:center;">';
  html += '<button class="bt bp bsm" onclick="_cc2_doAskOfficial();this.closest(\'div[style*=fixed]\').remove();">问</button>';
  html += '<button class="bt bsm" onclick="this.closest(\'div[style*=fixed]\').remove();">取消</button>';
  html += '</div></div>';
  bg.innerHTML = html;
  document.body.appendChild(bg);
}

async function _cc2_doAskOfficial() {
  var nm = _$('cc2-ask-sel').value;
  var q = _$('cc2-ask-input').value.trim();
  if (!nm || !q) return;
  addCYBubble('皇帝', '问' + nm + '：' + q, false);
  var ch = findCharByName(nm);
  var prompt = '你扮演' + nm + '（' + (ch && ch.officialTitle || '') + '），性格:' + (ch && ch.personality || '') + '\n';
  prompt += '皇帝在朝堂上当众问你：' + q + '\n';
  prompt += '按身份立场答复（文言/半文言，可含推诿、直言、谏言）。' + (typeof _aiDialogueWordHint === 'function' ? _aiDialogueWordHint() : '') + '\n返回纯文本。';
  try {
    var raw = await callAI(prompt, (typeof _aiDialogueTok==='function'?_aiDialogueTok("cy", 1):400));
    addCYBubble(nm, raw.trim(), false, true);
  } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-chaoyi-keju');}catch(_){}}
}

function _cc2_playerRaiseAgenda() {
  var bg = document.createElement('div');
  bg.style.cssText = 'position:fixed;inset:0;z-index:1350;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;';
  var html = '<div style="background:var(--color-surface);border:1px solid var(--gold-500);border-radius:var(--radius-lg);padding:1rem 1.5rem;max-width:480px;width:90%;">';
  html += '<div style="color:var(--gold-400);margin-bottom:0.6rem;">陛下主动挑起议题</div>';
  html += '<input id="cc2-topic-input" placeholder="朕今日欲议……" style="width:100%;padding:4px;margin-bottom:8px;background:var(--bg-3);color:var(--txt);border:1px solid var(--bdr);border-radius:3px;">';
  html += '<div style="display:flex;gap:6px;justify-content:center;">';
  html += '<button class="bt bp bsm" onclick="_cc2_doRaiseAgenda();this.closest(\'div[style*=fixed]\').remove();">开议</button>';
  html += '<button class="bt bsm" onclick="this.closest(\'div[style*=fixed]\').remove();">取消</button>';
  html += '</div></div>';
  bg.innerHTML = html;
  document.body.appendChild(bg);
}

function _cc2_doRaiseAgenda() {
  var topic = _$('cc2-topic-input').value.trim();
  if (!topic) return;
  var playerName = (P.playerInfo && P.playerInfo.characterName) || '皇帝';
  // 插入到当前议程之后
  var newItem = {
    _type: 'player_raised',
    presenter: playerName,
    dept: '御前',
    type: 'request',
    title: topic.slice(0, 20),
    content: topic,
    urgency: 'normal',
    controversial: 6,
    importance: 6,
    relatedDepts: [],
    relatedPeople: [],
    announceLine: playerName + '：朕有话说'
  };
  CY._cc2.queue.splice(CY._cc2.currentIdx + 1, 0, newItem);
  addCYBubble('皇帝', '朕议：' + topic, false);
  _cc2_advance();
}

async function _cc2_playerProclaim() {
  var bg = document.createElement('div');
  bg.style.cssText = 'position:fixed;inset:0;z-index:1350;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;';
  var html = '<div style="background:var(--color-surface);border:1px solid var(--gold-500);border-radius:var(--radius-lg);padding:1rem 1.5rem;max-width:480px;width:90%;">';
  html += '<div style="color:var(--gold-400);margin-bottom:0.6rem;">宣制——宣读旨意</div>';
  html += '<textarea id="cc2-proclaim-input" rows="3" placeholder="奉天承运皇帝制曰……" style="width:100%;padding:4px;margin-bottom:8px;background:var(--bg-3);color:var(--txt);border:1px solid var(--bdr);border-radius:3px;"></textarea>';
  html += '<div style="display:flex;gap:6px;justify-content:center;">';
  html += '<button class="bt bp bsm" onclick="_cc2_doProclaim();this.closest(\'div[style*=fixed]\').remove();">宣</button>';
  html += '<button class="bt bsm" onclick="this.closest(\'div[style*=fixed]\').remove();">取消</button>';
  html += '</div></div>';
  bg.innerHTML = html;
  document.body.appendChild(bg);
}

function _cc2_doProclaim() {
  var txt = _$('cc2-proclaim-input').value.trim();
  if (!txt) return;
  addCYBubble('内侍', '（内侍高声宣制）', true);
  addCYBubble('皇帝', '制曰：' + txt, false, true);
  addCYBubble('百官', '陛下圣明！（山呼）', true);
  if (typeof addEB === 'function') addEB('宣制', txt.slice(0, 40));
  if (GM.qijuHistory) GM.qijuHistory.unshift({ turn: GM.turn, date: typeof getTSText==='function'?getTSText(GM.turn):'', content: '常朝宣制：' + txt });
  _cy_jishiAdd('changchao', '宣制', '皇帝', txt, { proclaim: true });
}

// ─── 朝中传召——所有在京非在场者 ───

function _cc2_openSummonPicker() {
  var candidates = (GM.chars||[]).filter(function(c) {
    return c.alive !== false && !c.isPlayer
      && _isAtCapital(c)
      && !(CY._cc2.attendees||[]).some(function(a){return a.name === c.name;});
  });
  if (candidates.length === 0) { toast('在京无可传召之人'); return; }

  var bg = document.createElement('div');
  bg.style.cssText = 'position:fixed;inset:0;z-index:1350;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;';
  var html = '<div style="background:var(--color-surface);border:1px solid var(--gold-500);border-radius:var(--radius-lg);padding:1rem 1.5rem;max-width:500px;width:92%;max-height:80vh;overflow-y:auto;">';
  html += '<div style="color:var(--gold-400);margin-bottom:0.6rem;">传召何人？（朝中即时召入）</div>';
  html += '<div style="font-size:0.68rem;color:var(--ink-300);margin-bottom:0.6rem;">召后妃/宦官/布衣或其他人是否引朝堂抗议，由朝会推演视当前朝局自行判定。</div>';
  html += '<div style="display:flex;flex-direction:column;gap:3px;">';
  candidates.forEach(function(c) {
    var _lbl = c.officialTitle || c.title || (c.spouse?'后妃':'无职');
    html += '<button class="bt bsm" style="text-align:left;font-size:0.72rem;" onclick="_cc2_doSummonIn(\'' + escHtml(c.name).replace(/\'/g,"\\'") + '\');this.closest(\'div[style*=fixed]\').remove();">';
    html += escHtml(c.name) + ' <span style="color:var(--ink-300);">' + escHtml(_lbl) + '</span>';
    html += '</button>';
  });
  html += '</div>';
  html += '<div style="text-align:center;margin-top:0.6rem;"><button class="bt" onclick="this.closest(\'div[style*=fixed]\').remove();">取消</button></div>';
  html += '</div>';
  bg.innerHTML = html;
  document.body.appendChild(bg);
}

function _cc2_doSummonIn(name) {
  var ch = findCharByName(name);
  if (!ch) return;
  // 入场
  CY._cc2.attendees.push({ name: ch.name, title: ch.officialTitle||ch.title||(ch.spouse?'后妃':'布衣'), faction: ch.faction||'', party: ch.party||'', special: true });
  // 插入召入议程到当前之后
  CY._cc2.queue.splice(CY._cc2.currentIdx + 1, 0, {
    _type: 'summon_arrival',
    summonedName: name,
    title: '传召 ' + name + ' 入朝',
    content: '陛下临朝召' + name + '入殿。',
    dept: '内侍',
    presenter: '内侍',
    type: 'announcement'
  });
  addCYBubble('内侍', '（陛下传召' + name + '。）', true);
  // 立即推进到该议程（由 _cc2_advance 在当前议程结束时自然到达）
  // 如果玩家在 global 按钮时点了传召——当前议程已结束，此时直接跳
  if (!CY._cc2.currentPhase) {
    _cc2_advance();
  } else {
    toast('传召已安排，本议程结束后立即召入');
  }
}

// ─── 传召到达议程（AI 完全自主判定反应） ───

async function _cc2_judgeSummonReaction(item) {
  var name = item.summonedName;
  var ch = findCharByName(name);
  if (!ch) { _cc2_advance(); return; }

  addCYBubble(name, '（' + name + '入殿，俯首候旨。）', false);

  if (!P.ai || !P.ai.key) {
    _cc2_enterDecide(item);
    return;
  }

  var playerName = (P.playerInfo && P.playerInfo.characterName) || '皇帝';
  var prompt = '朝会中皇帝传召以下人物入朝，由你判定朝堂反应（须结合当前具体情境，不得一律抗议或一律平静——由以下信息综合推断）：\n';
  prompt += '被召者：' + name + '\n';
  prompt += '  身份：' + (ch.officialTitle||ch.title||'无官职') + (ch.spouse?'（后妃）':'') + '\n';
  prompt += '  家族：' + (ch.family||'?') + '，民族：' + (ch.ethnicity||'?') + '\n';
  prompt += '  性格：' + (ch.personality||'') + '\n';
  prompt += '  忠诚：' + Math.round(ch.loyalty||50) + '，野心：' + Math.round(ch.ambition||40) + '\n';
  prompt += '  近事：' + ((ch._memory||[]).slice(-3).map(function(m){return (m.event||'').slice(0,40);}).join('；') || '无') + '\n';
  var _at = CY._cc2.attendees.slice(0, 15).map(function(a){
    var c = findCharByName(a.name);
    return a.name + (a.party?'('+a.party+')':'') + (c&&c.personality?'·'+c.personality.slice(0,10):'');
  }).join('、');
  prompt += '在场官员：' + _at + '\n';
  if (GM.activeWars && GM.activeWars.length) prompt += '战事：' + GM.activeWars.length + ' 处\n';
  prompt += '\n综合判断：此次传召在当前情境下会否引发抗议？谁会抗议？抗议内容？或有人支持？\n';
  prompt += '注意：身份特殊不一定必遭反对（例如女皇已临朝可召皇妃毫无问题；国危之时召隐士布衣反得百官称颂；已有传召先例则无大惊）。\n';
  prompt += (typeof _aiDialogueWordHint === 'function' ? _aiDialogueWordHint() + '（line 字段遵循此字数）\n' : '');
  prompt += '返回 JSON：\n';
  prompt += '{\n  "reactions":[{"name":"官员名","type":"劝谏/弹劾/附议/冷眼/称善","line":"发言"}],\n';
  prompt += '  "overallTone":"平静/微议/激烈抗议/赞誉"\n}';

  // 先一次性判定谁会抗议+整体氛围（schedule·非流式）·然后流式逐个生成发言
  try {
    var raw = await callAI(prompt, 400);
    var obj = (typeof extractJSON === 'function') ? extractJSON(raw) : null;
    var overallTone = (obj && obj.overallTone) || '平静';
    addCYBubble('内侍', '（朝堂' + overallTone + '。）', true);
    if (obj && Array.isArray(obj.reactions)) {
      // 改为逐人流式生成（每人单独 AI call）
      for (var ri = 0; ri < obj.reactions.length; ri++) {
        if (CY._abortChaoyi) break;
        // 玩家插言：上一人说完、下一人未开口时消费
        if (CY._pendingPlayerLine) {
          var _sline = CY._pendingPlayerLine;
          CY._pendingPlayerLine = null;
          var _sName = (P.playerInfo && P.playerInfo.characterName) || '陛下';
          try { addCYBubble(_sName, _sline, true); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-chaoyi-keju');}catch(_){}}
        }
        var r0 = obj.reactions[ri];
        if (!r0 || !r0.name) continue;
        var reactor = findCharByName(r0.name);
        if (!reactor) continue;
        var _body = _$('cy-body'); if (!_body) break;
        var _div = document.createElement('div');
        _div.style.cssText = 'display:flex;gap:0.5rem;margin-bottom:0.8rem;animation:fi 0.3s ease;';
        var _av = reactor.portrait ? '<img src="' + escHtml(reactor.portrait) + '" style="width:28px;height:28px;object-fit:cover;border-radius:50%;flex-shrink:0;border:1.5px solid var(--gold-d);">'
                                   : '<div style="width:28px;height:28px;border-radius:50%;background:var(--bg-4);display:flex;align-items:center;justify-content:center;font-size:0.8rem;border:1.5px solid var(--gold-d);flex-shrink:0;">\uD83D\uDC64</div>';
        var _tcolor = { '劝谏':'var(--amber-400)','弹劾':'var(--vermillion-400)','附议':'var(--celadon-400)','冷眼':'var(--ink-300)','称善':'var(--gold-400)' }[r0.type] || 'var(--color-foreground)';
        _div.innerHTML = _av + '<div style="flex:1;min-width:0;"><div style="font-size:0.7rem;color:var(--gold);">' + escHtml(r0.name)
          + ' <span style="color:' + _tcolor + ';font-size:0.64rem;">〔' + escHtml(r0.type||'发言') + '〕</span></div>'
          + '<div class="cy-bubble cc2-react-bubble" style="background:var(--bg-3);border:1px solid var(--bdr);border-radius:3px 10px 10px 10px;padding:0.4rem 0.7rem;font-size:0.85rem;line-height:1.6;color:' + _tcolor + ';">\u2026</div></div>';
        _body.appendChild(_div); _body.scrollTop = _body.scrollHeight;
        var _bubEl = _div.querySelector('.cy-bubble');

        // 单人流式 AI：让 NPC 就传召 name 事件·按已判定的类型发言（约 40-100 字）
        var _pp = '朝会中皇帝传召 ' + name + '（' + (ch.officialTitle||'') + '）入朝。\n';
        _pp += '你是 ' + r0.name + '（' + (reactor.officialTitle||reactor.title||'') + '，性格' + (reactor.personality||'').slice(0,20) + '，忠' + Math.round(reactor.loyalty||50) + '），';
        _pp += '你的立场倾向：' + (r0.type||'发言') + '。\n';
        _pp += '请用文言/半文言生成一条 40-100 字的朝堂发言·直接输出发言正文·不要加类型标签。';
        CY.abortCtrl = new AbortController();
        try {
          await callAIMessagesStream([{role:'user',content:_pp}], 250, {
            signal: CY.abortCtrl.signal,
            onChunk: function(t){ if (_bubEl) _bubEl.textContent = t; _body.scrollTop = _body.scrollHeight; }
          });
        } catch(_se){ if (_bubEl) _bubEl.textContent = r0.line || '（未能陈词）'; }
        if (typeof NpcMemorySystem !== 'undefined') {
          NpcMemorySystem.remember(r0.name, '皇帝传召' + name + '——' + (r0.type||'发言'), '平', 4);
        }
      }
    }
  } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-chaoyi-keju');}catch(_){}}

  // 进入 ask 环节：皇帝问被召者所为何事
  var footer = _$('cy-footer');
  footer.innerHTML = '<div style="display:flex;gap:var(--space-1);justify-content:center;flex-wrap:wrap;">'
    + '<button class="bt bp bsm" onclick="_cc2_askSummoned(\'' + escHtml(name).replace(/\'/g,"\\'") + '\')">朕问' + escHtml(name) + '</button>'
    + '<button class="bt bsm" onclick="_cc2_endAgenda()">令其退下</button>'
    + '</div>' + _cc2_globalButtons();
}

function _cc2_askSummoned(name) {
  // 复用 playerAskOfficial 弹窗逻辑
  var bg = document.createElement('div');
  bg.style.cssText = 'position:fixed;inset:0;z-index:1350;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;';
  var html = '<div style="background:var(--color-surface);border:1px solid var(--gold-500);border-radius:var(--radius-lg);padding:1rem 1.5rem;max-width:440px;">';
  html += '<div style="color:var(--gold-400);margin-bottom:0.6rem;">朕问' + escHtml(name) + '</div>';
  html += '<input id="cc2-summon-q" placeholder="问题……" style="width:100%;padding:4px;margin-bottom:8px;background:var(--bg-3);color:var(--txt);border:1px solid var(--bdr);border-radius:3px;">';
  html += '<div style="display:flex;gap:6px;justify-content:center;">';
  html += '<button class="bt bp bsm" onclick="_cc2_doAskSummoned(\'' + escHtml(name).replace(/\'/g,"\\'") + '\');this.closest(\'div[style*=fixed]\').remove();">问</button>';
  html += '<button class="bt bsm" onclick="this.closest(\'div[style*=fixed]\').remove();">取消</button>';
  html += '</div></div>';
  bg.innerHTML = html;
  document.body.appendChild(bg);
}

async function _cc2_doAskSummoned(name) {
  var q = _$('cc2-summon-q').value.trim();
  if (!q) return;
  addCYBubble('皇帝', '问' + name + '：' + q, false);
  var ch = findCharByName(name);
  var prompt = '你扮演' + name + '（' + (ch && ch.officialTitle || ch && ch.title || '') + '，性格' + (ch && ch.personality || '') + '，忠' + ((ch && ch.loyalty) || 50) + '），被皇帝当庭召入，皇帝问你：' + q + '\n答复文言/半文言。' + (typeof _aiDialogueWordHint === 'function' ? _aiDialogueWordHint() : '');
  try {
    var raw = await callAI(prompt, (typeof _aiDialogueTok==='function'?_aiDialogueTok("cy", 1):400));
    addCYBubble(name, raw.trim(), false, true);
  } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-chaoyi-keju');}catch(_){}}
  // 提供下一步
  var footer = _$('cy-footer');
  footer.innerHTML = '<div style="display:flex;gap:var(--space-1);justify-content:center;">'
    + '<button class="bt bsm" onclick="_cc2_askSummoned(\'' + escHtml(name).replace(/\'/g,"\\'") + '\')">再问</button>'
    + '<button class="bt bp bsm" onclick="_cc2_endAgenda()">令其退下</button>'
    + '</div>' + _cc2_globalButtons();
}

// ─── 辅助 ───

function _cc2_curItem() {
  if (!CY._cc2) return null;
  return CY._cc2.queue[CY._cc2.currentIdx] || null;
}

// ═══════════════════════════════════════════════════════════════════════
//  朝议共用：诏书建议库摘入 + 纪事档案写入
// ═══════════════════════════════════════════════════════════════════════

/** 读取 cy-body 中用户划选的文字，摘入诏书建议库（自动捕获当前议题作为 topic） */
function _cy_suggestAdd(sourceLabel) {
  var sel = window.getSelection();
  var text = sel ? sel.toString().trim() : '';
  if (!text) { toast('请先在大臣发言中划选文字'); return; }
  if (text.length > 800) text = text.slice(0, 800);
  if (!GM._edictSuggestions) GM._edictSuggestions = [];
  // 识别发言者
  var fromName = '';
  try {
    var anc = sel.anchorNode;
    while (anc && anc.nodeType !== 1) anc = anc.parentNode;
    var bubble = anc && anc.closest ? anc.closest('.chaoyi-bubble, .cy-bubble, [data-cy-speaker]') : null;
    if (bubble) {
      fromName = bubble.getAttribute('data-cy-speaker') || (bubble.querySelector('.speaker-name') && bubble.querySelector('.speaker-name').textContent) || '';
    }
  } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-chaoyi-keju');}catch(_){}}
  // 自动抓取 topic——当前议题或议程
  var topic = '';
  if (sourceLabel === '廷议' && CY._ty2 && CY._ty2.topic) topic = '廷议·' + CY._ty2.topic;
  else if (sourceLabel === '御前会议' && CY._yq2 && CY._yq2.topic) topic = '御前·' + CY._yq2.topic;
  else if (sourceLabel === '常朝' && CY._cc2 && typeof _cc2_curItem === 'function') {
    var cur = _cc2_curItem();
    if (cur) topic = '常朝·' + (cur.title || cur.content || '').slice(0, 30);
  }
  GM._edictSuggestions.push({
    source: sourceLabel || '朝议',
    from: fromName,
    topic: topic,
    content: text,
    turn: GM.turn,
    used: false
  });
  toast('已摘入诏书建议库' + (topic ? '（' + topic + '）' : ''));
}

/** 统一生成"摘入建议库"按钮（朝议三端共用） */
function _cy_suggestBtnHtml(sourceLabel) {
  var s = escHtml(sourceLabel||'朝议').replace(/'/g,"\\'");
  return '<button class="bt" style="font-size:0.62rem;" onclick="_cy_suggestAdd(\'' + s + '\')" title="先划选大臣发言中的文字，再点此按钮">📋 摘入建议库</button>';
}

/** 写入纪事档案 */
function _cy_jishiAdd(mode, topic, speakerName, speech, extra) {
  if (!GM.jishiRecords) GM.jishiRecords = [];
  var record = {
    turn: GM.turn,
    char: speakerName || '',
    playerSaid: '【' + ({changchao:'常朝',tinyi:'廷议',yuqian:'御前会议'}[mode]||mode) + (topic?'·'+topic:'') + '】',
    npcSaid: speech || '',
    mode: mode
  };
  if (extra) Object.assign(record, extra);
  GM.jishiRecords.push(record);
}

// ═══════════════════════════════════════════════════════════════════════
//  廷议 2.0——议题深度辩论，立场追踪，遗祸机制
//  议题类型：战和/立储/变法/重案/财赋/灾赈/其他
//  流程：命题 → 众议初轮(按品级) → 辩论多轮 → 立场迁移 → 折中？ → 裁决 → 遗祸
// ═══════════════════════════════════════════════════════════════════════

function _ty2_openSetup() {
  var bg = document.createElement('div');
  bg.id = 'ty2-setup-bg';
  bg.style.cssText = 'position:fixed;inset:0;z-index:1300;background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;';
  var capital = GM._capital || '京城';
  // 过滤·不得与议者：已死/下狱/流放/病重/致仕/逃亡/丁忧/失踪
  function _cannotAttend(c) {
    if (!c) return true;
    if (c.alive === false || c.dead) return true;
    if (c.isPlayer) return true;
    if (c._imprisoned || c.imprisoned || c._inPrison) return true;
    if (c._exiled || c.exiled || c._banished) return true;
    if (c._status === 'imprisoned' || c._status === 'exiled' || c._status === 'fled' || c._status === 'retired' || c._status === 'mourning' || c._status === 'sick_grave') return true;
    if (c._retired || c.retired) return true;  // 致仕
    if (c._fled || c.fled) return true;          // 逃亡
    if (c._mourning) return true;                // 丁忧
    if (c._missing) return true;                 // 失踪
    if (c._graveIll || (typeof c.health === 'number' && c.health <= 10)) return true;  // 病危
    if (c.health === 'dead' || c.health === 'imprisoned') return true;
    return false;
  }
  // 廷议仅限同势力 & 在玩家所在地（首都或行在）· 且非下狱/流放等
  var defaultAttendees = (GM.chars||[]).filter(function(c){
    if (_cannotAttend(c)) return false;
    if (!_isAtCapital(c) || !_isPlayerFactionChar(c)) return false;
    var rankLv = typeof getRankLevel === 'function' ? getRankLevel(_cyGetRank(c)) : 99;
    return rankLv <= 12; // 从三品以上（18 级制，12 = 正五品, 6 = 从三品）
  });
  // 若三品以上人数不足——放宽到五品
  if (defaultAttendees.length < 5) {
    defaultAttendees = (GM.chars||[]).filter(function(c){
      if (_cannotAttend(c)) return false;
      if (!_isAtCapital(c) || !_isPlayerFactionChar(c)) return false;
      var rankLv = typeof getRankLevel === 'function' ? getRankLevel(_cyGetRank(c)) : 99;
      return rankLv <= 14;
    });
  }

  var html = '<div style="background:var(--color-surface);border:1px solid var(--gold-500);border-radius:var(--radius-lg);padding:1.3rem 1.7rem;max-width:560px;width:92%;max-height:85vh;overflow-y:auto;">';
  html += '<div style="text-align:center;font-size:var(--text-md);color:var(--gold-400);letter-spacing:0.12em;margin-bottom:0.9rem;">〔 廷 议 筹 备 〕</div>';
  // 议题输入
  html += '<div class="fd" style="margin-bottom:0.7rem;"><label style="font-size:0.72rem;color:var(--color-foreground-secondary);">议题（单一重大议题）</label>';
  html += '<input id="ty2-topic" placeholder="如：北伐契丹、改科举取士法、立嫡长为太子……" style="width:100%;padding:5px 8px;font-size:0.85rem;background:var(--color-elevated);border:1px solid var(--color-border);border-radius:var(--radius-sm);color:var(--color-foreground);">';
  // 待议题目下拉（含经济改革）
  if (GM._pendingTinyiTopics && GM._pendingTinyiTopics.length > 0) {
    html += '<div style="margin-top:0.3rem;">';
    html += '<select id="ty2-pending-pick" style="width:100%;padding:4px 6px;font-size:0.72rem;background:var(--color-elevated);border:1px solid var(--color-border);color:var(--color-foreground);border-radius:3px;" onchange="_ty2_pickPending(this)">';
    html += '<option value="">-- 从待议题目选择 --</option>';
    GM._pendingTinyiTopics.forEach(function(p, i) {
      html += '<option value="' + i + '">' + escHtml((p.topic||'').slice(0, 60)) + '</option>';
    });
    html += '</select></div>';
  }
  html += '</div>';
  // 议题类型
  html += '<div style="font-size:0.7rem;color:var(--color-foreground-muted);margin-bottom:0.35rem;">议题类型</div>';
  html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-bottom:0.8rem;">';
  [['war','⚔️ 战和'],['succession','👑 立储'],['reform','📜 变法'],['judgment','⚖️ 重案'],['finance','💰 财赋'],['relief','🌾 灾赈'],['appointment','👔 廷推'],['other','❓ 其他']].forEach(function(t) {
    html += '<label style="display:flex;align-items:center;gap:3px;padding:4px 6px;background:var(--color-elevated);border-radius:3px;font-size:0.7rem;cursor:pointer;">';
    html += '<input type="radio" name="ty2-type" value="' + t[0] + '"' + (t[0]==='other'?'':(t[0]==='war'?' checked':'')) + '>' + t[1];
    html += '</label>';
  });
  html += '</div>';
  // 自定义类型输入
  html += '<input id="ty2-type-custom" placeholder="若选其他，在此描述议题性质……" style="width:100%;padding:5px 8px;margin-bottom:0.8rem;display:none;font-size:0.78rem;background:var(--color-elevated);border:1px solid var(--color-border);border-radius:var(--radius-sm);color:var(--color-foreground);">';
  // 应召官员
  html += '<div style="font-size:0.7rem;color:var(--color-foreground-muted);margin-bottom:0.35rem;">应召官员（三品以上自动）—— ' + defaultAttendees.length + ' 人</div>';
  html += '<div id="ty2-attendees" style="max-height:160px;overflow-y:auto;padding:6px;background:var(--color-elevated);border-radius:3px;margin-bottom:0.7rem;display:flex;flex-wrap:wrap;gap:3px;">';
  defaultAttendees.forEach(function(c) {
    html += '<label style="font-size:0.68rem;padding:2px 5px;background:rgba(184,154,83,0.1);border-radius:2px;cursor:pointer;">'
      + '<input type="checkbox" class="ty2-attendee" value="' + escHtml(c.name) + '" checked> ' + escHtml(c.name);
    if (c.officialTitle || c.title) html += '<span style="color:var(--ink-300);font-size:0.6rem;"> ' + escHtml(c.officialTitle||c.title) + '</span>';
    html += '</label>';
  });
  html += '</div>';
  // 额外召人：仅同势力 & 在玩家所在地（外邦使臣/远地官员不入廷议）
  var extraPool = (GM.chars||[]).filter(function(c){
    if (c.alive === false || c.isPlayer) return false;
    if (!_isAtCapital(c) || !_isPlayerFactionChar(c)) return false;
    if (defaultAttendees.some(function(d){return d.name===c.name;})) return false;
    return true;
  });
  if (extraPool.length > 0) {
    html += '<details style="margin-bottom:0.8rem;font-size:0.72rem;"><summary style="cursor:pointer;color:var(--ink-300);">其他可召人员（' + extraPool.length + '，可多选）</summary>';
    html += '<div style="max-height:120px;overflow-y:auto;padding:6px;background:var(--color-elevated);border-radius:3px;margin-top:4px;display:flex;flex-wrap:wrap;gap:3px;">';
    extraPool.slice(0, 40).forEach(function(c) {
      html += '<label style="font-size:0.66rem;padding:2px 5px;background:rgba(107,93,79,0.1);border-radius:2px;cursor:pointer;">'
        + '<input type="checkbox" class="ty2-extra" value="' + escHtml(c.name) + '"> ' + escHtml(c.name) + '</label>';
    });
    html += '</div></details>';
  }
  html += '<div style="text-align:center;display:flex;gap:var(--space-2);justify-content:center;">';
  html += '<button class="bt bp" onclick="_ty2_startSession()">开议</button>';
  html += '<button class="bt" onclick="this.closest(\'div[style*=fixed]\').remove();">取消</button>';
  html += '</div></div>';
  bg.innerHTML = html;
  document.body.appendChild(bg);

  // 类型选择联动显示自定义输入
  bg.querySelectorAll('input[name="ty2-type"]').forEach(function(r) {
    r.addEventListener('change', function() {
      var cust = _$('ty2-type-custom');
      if (cust) cust.style.display = this.value === 'other' ? 'block' : 'none';
    });
  });
}

function _ty2_pickPending(sel) {
  if (!sel || !GM._pendingTinyiTopics) return;
  var i = parseInt(sel.value);
  if (isNaN(i) || !GM._pendingTinyiTopics[i]) return;
  var p = GM._pendingTinyiTopics[i];
  var input = _$('ty2-topic'); if (input) input.value = p.topic || '';
  // 携带经济改革元数据到下一步
  window._ty2_pendingMeta = p;
  // 若是经济改革，自动选"finance"类型
  if (p._economyReform) {
    var r = document.querySelector('input[name="ty2-type"][value="finance"]');
    if (r) r.checked = true;
  }
}

async function _ty2_startSession() {
  var topic = (_$('ty2-topic')||{}).value || '';
  topic = topic.trim();
  if (!topic) { toast('请输入议题'); return; }
  var pendingMeta = window._ty2_pendingMeta || null;
  window._ty2_pendingMeta = null;
  var typeR = document.querySelector('input[name="ty2-type"]:checked');
  var ttype = typeR ? typeR.value : 'other';
  var tcustom = (_$('ty2-type-custom')||{}).value || '';
  var selected = [];
  document.querySelectorAll('.ty2-attendee:checked').forEach(function(c){ selected.push(c.value); });
  document.querySelectorAll('.ty2-extra:checked').forEach(function(c){ selected.push(c.value); });
  if (selected.length < 2) { toast('至少召集 2 人议事'); return; }

  // 能量消耗
  if (typeof _spendEnergy === 'function' && !_spendEnergy(25, '廷议')) return;

  var bg = _$('ty2-setup-bg'); if (bg) bg.remove();

  // 按品级排序与议者
  selected.sort(function(a,b) {
    var ra = typeof getRankLevel === 'function' ? getRankLevel(_cyGetRank(findCharByName(a)||{})) : 99;
    var rb = typeof getRankLevel === 'function' ? getRankLevel(_cyGetRank(findCharByName(b)||{})) : 99;
    return ra - rb;
  });

  CY.phase = 'tinyi2';
  CY._ty2 = {
    topic: topic,
    topicType: ttype,
    topicCustom: tcustom,
    attendees: selected,
    stances: {},          // name → {current, initial, locked, confidence}
    stanceHistory: [],
    roundNum: 0,
    currentPhase: 'opening',
    decision: null,
    _dispatched: {},      // 本次已发言者
    _lastRoundSpeeches: [],
    // 经济改革元数据（从 _pendingTinyiTopics 携带）
    _economyReform: pendingMeta && pendingMeta._economyReform,
    _reformType: pendingMeta && pendingMeta.reformType,
    _reformId: pendingMeta && pendingMeta.reformId
  };
  // 从待议题目列表中移除
  if (pendingMeta && GM._pendingTinyiTopics) {
    GM._pendingTinyiTopics = GM._pendingTinyiTopics.filter(function(x) { return x !== pendingMeta; });
  }
  selected.forEach(function(n) { CY._ty2.stances[n] = { current: '待定', initial: '待定', locked: false, confidence: 0 }; });

  var body = _$('cy-body');
  body.innerHTML = '';
  var topicEl = _$('cy-topic');
  if (topicEl) { topicEl.style.display = 'block'; topicEl.innerHTML = '🏛 廷议·' + escHtml(topic); }

  addCYBubble('内侍', '（召集三品以上' + selected.length + '员入殿议政。）', true);
  addCYBubble('皇帝', '今日特召卿等商议——' + topic + '。诸卿各陈己见。', false);

  CY._abortChaoyi = false; CY._pendingPlayerLine = null;
  if (typeof _cyShowInputRow === 'function') _cyShowInputRow(true);

  // 渲染立场板 + footer
  _ty2_render();
  // 进入初议
  _ty2_phaseInitialRound();
}

/** 渲染立场板（可视化百官立场） */
function _ty2_render() {
  var body = _$('cy-body');
  // 清除旧立场板
  var old = document.getElementById('ty2-stance-board');
  if (old) old.remove();
  if (!CY._ty2) return;
  var stances = CY._ty2.stances || {};
  var html = '<div id="ty2-stance-board" style="position:sticky;top:0;z-index:10;background:var(--color-elevated);border:1px solid var(--color-border-subtle);border-radius:var(--radius-sm);padding:6px 10px;margin-bottom:6px;font-size:0.68rem;">';
  html += '<div style="color:var(--gold-400);margin-bottom:3px;">〔 立 场 板 〕 第 ' + (CY._ty2.roundNum||0) + ' 轮</div>';
  // 聚合
  var counts = {};
  Object.keys(stances).forEach(function(n) {
    var s = stances[n].current;
    counts[s] = (counts[s]||0) + 1;
  });
  var colors = { '极力支持':'var(--celadon-400)','支持':'var(--celadon-400)','倾向支持':'var(--celadon-400)','中立':'var(--ink-300)','待定':'var(--ink-300)','倾向反对':'var(--vermillion-400)','反对':'var(--vermillion-400)','极力反对':'var(--vermillion-400)','折中':'var(--amber-400)','另提议':'var(--indigo-400)' };
  html += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:4px;">';
  Object.keys(counts).forEach(function(s) {
    html += '<span style="color:' + (colors[s]||'') + ';">' + s + ' ' + counts[s] + '</span>';
  });
  html += '</div>';
  // 每人简列
  html += '<div style="display:flex;flex-wrap:wrap;gap:4px;">';
  CY._ty2.attendees.forEach(function(n) {
    var st = stances[n] || {current:'待定'};
    var c = colors[st.current] || 'var(--ink-300)';
    html += '<span style="padding:1px 5px;background:rgba(255,255,255,0.04);border-left:2px solid ' + c + ';font-size:0.62rem;">' + escHtml(n) + '<span style="color:' + c + ';"> ' + st.current + '</span></span>';
  });
  html += '</div>';
  html += '</div>';
  if (body && body.firstChild) body.insertBefore(_ty2_makeDiv(html), body.firstChild);
  else if (body) body.innerHTML = html + body.innerHTML;
}

function _ty2_makeDiv(html) { var d = document.createElement('div'); d.innerHTML = html; return d.firstElementChild || d; }

/** 阶段：初议 + 补议（每位与议者按品级依次陈述，默认 2 轮，玩家可插言/打断） */
async function _ty2_phaseInitialRound() {
  if (!CY._ty2) return;
  CY._ty2.currentPhase = 'initial';
  _ty2_render();

  var footer = _$('cy-footer');
  footer.innerHTML = '<div style="text-align:center;color:var(--color-foreground-muted);font-size:0.72rem;padding:0.4rem;">百官依品级次第陈议……（可在下方输入框插言或打断）</div>';

  addCYBubble('内侍', '（百官按品级次第发言。）', true);

  var _prevSpeeches = [];
  for (var _rd = 1; _rd <= 2; _rd++) {
    CY._ty2.roundNum = _rd;
    _ty2_render();
    if (_rd === 2) addCYBubble('内侍', '（再议一轮，诸卿可据他官之言修订立场。）', true);
    for (var i = 0; i < CY._ty2.attendees.length; i++) {
      if (CY._abortChaoyi) { CY._abortChaoyi=false; break; }
      // 玩家中途插言
      if (CY._pendingPlayerLine) {
        var _pl = CY._pendingPlayerLine; CY._pendingPlayerLine = null;
        addCYBubble('皇帝', _pl, false);
        _cy_jishiAdd('tinyi', CY._ty2.topic, '皇帝', _pl, { round: _rd, playerInterject: true });
        try { await _ty2_playerTriggeredResponse(_pl); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-chaoyi-keju');}catch(_){}}
      }
      var nm = CY._ty2.attendees[i];
      var res = await _ty2_genOneSpeech(nm, _rd, _prevSpeeches);
      if (res) {
        _prevSpeeches.push({ name: nm, stance: res.stance, line: res.line });
        if (_rd === 1 && res.stance) CY._ty2.stances[nm].initial = res.stance;
        if (res.stance) CY._ty2.stances[nm].current = res.stance;
        if (res.confidence != null) CY._ty2.stances[nm].confidence = res.confidence;
      }
      _ty2_render();
    }
    if (CY._abortChaoyi) { CY._abortChaoyi=false; break; }
  }

  // 两轮完毕——进入辩论/裁决阶段
  _ty2_offerDebatePhase();
}

/** 生成一位与议者的一轮发言 */
async function _ty2_genOneSpeech(name, roundNum, prevSpeeches) {
  if (!P.ai || !P.ai.key) {
    addCYBubble(name, '（臣以为……）', false);
    _cy_jishiAdd('tinyi', CY._ty2.topic, name, '（臣以为……）', { round: roundNum });
    return { stance: '中立' };
  }
  var ch = findCharByName(name);
  var ttypeLbl = { war:'战和',succession:'立储',reform:'变法',judgment:'重案',finance:'财赋',relief:'灾赈',appointment:'廷推',other:'其他' }[CY._ty2.topicType] || '';
  var prompt = '廷议·第 ' + roundNum + ' 轮。议题类型：' + ttypeLbl + '\n';
  prompt += '议题：' + CY._ty2.topic + '\n';
  if (CY._ty2.topicCustom) prompt += '说明：' + CY._ty2.topicCustom + '\n';
  prompt += '你扮演' + name + '（' + (ch && ch.officialTitle || '') + '，' + (ch && _cyGetRank(ch) || '') + '）：\n';
  prompt += '  性格：' + (ch && ch.personality || '') + '\n';
  prompt += '  党派：' + (ch && ch.party || '无') + '｜家族：' + (ch && ch.family || '?') + '｜忠' + ((ch && ch.loyalty)||50) + '｜野' + ((ch && ch.ambition)||40) + '\n';
  prompt += '  学识：' + (ch && ch.learning || '') + '｜近期记忆：' + ((ch && ch._memory || []).slice(-3).map(function(m){return (m.event||'').slice(0,30);}).join('；') || '无') + '\n';
  // 其它与议者当前立场
  var otherStances = Object.keys(CY._ty2.stances).filter(function(n){return n!==name;}).map(function(n) {
    return n + ':' + CY._ty2.stances[n].current;
  }).slice(0, 15).join('，');
  if (otherStances) prompt += '\n他官立场：' + otherStances + '\n';
  if (prevSpeeches && prevSpeeches.length) {
    prompt += '\n本轮已发言：\n' + prevSpeeches.slice(-3).map(function(s){return '  '+s.name+'('+s.stance+')：'+s.line.slice(0,60);}).join('\n') + '\n';
  }
  prompt += '\n请根据以上推断你对本议题的立场（不给预设选项，自行判断），写发言（文言/半文言，符合身份）。' + (typeof _aiDialogueWordHint === 'function' ? _aiDialogueWordHint() : '') + '\n';
  prompt += '返回 JSON：{"stance":"极力支持/支持/倾向支持/中立/倾向反对/反对/极力反对/折中/另提议","confidence":0-100,"line":"发言内容","reason":"内在动机"}';

  // A1: 流式化——先建占位气泡·onChunk 用 regex 渐进显示 "line" 字段
  var _tyDiv = addCYBubble(name, '\u2026', false);
  var _tyBubble = _tyDiv && _tyDiv.querySelector ? _tyDiv.querySelector('.cy-bubble') : null;
  var _tyRaf = false;
  CY.abortCtrl = new AbortController();  // 每次新建·避免前次 abort 污染
  try {
    var raw = await callAIMessagesStream(
      [{role:'user', content: prompt}],
      (typeof _aiDialogueTok==='function'?_aiDialogueTok("cy", 1):600),
      { signal: CY.abortCtrl.signal,
        tier: (typeof _useSecondaryTier === 'function' && _useSecondaryTier()) ? 'secondary' : undefined,  // M3·廷议走次 API
        onChunk: function(txt) {
          if (!_tyBubble || _tyRaf) return;
          _tyRaf = true;
          requestAnimationFrame(function() {
            _tyRaf = false;
            var m = (txt||'').match(/"line"\s*:\s*"((?:[^"\\]|\\.)*)/);
            if (m && m[1]) {
              _tyBubble.textContent = m[1].replace(/\\n/g,'\n').replace(/\\"/g,'"').replace(/\\\\/g,'\\');
              _tyBubble.style.color = '';
            }
          });
      } }
    );
    var obj = (typeof extractJSON === 'function') ? extractJSON(raw) : null;
    if (obj && obj.line) {
      var colors = { '极力支持':'var(--celadon-400)','支持':'var(--celadon-400)','倾向支持':'var(--celadon-400)','中立':'var(--ink-300)','倾向反对':'var(--vermillion-400)','反对':'var(--vermillion-400)','极力反对':'var(--vermillion-400)','折中':'var(--amber-400)','另提议':'var(--indigo-400)' };
      var c = colors[obj.stance] || '';
      if (_tyBubble) _tyBubble.innerHTML = '\u3014' + (obj.stance||'\u4E2D\u7ACB') + '\u3015<span style="color:' + c + ';">' + escHtml(obj.line) + '</span>';
      _cy_jishiAdd('tinyi', CY._ty2.topic, name, obj.line, { round: roundNum, stance: obj.stance });
      if (typeof NpcMemorySystem !== 'undefined') NpcMemorySystem.remember(name, '廷议「' + CY._ty2.topic.slice(0,20) + '」持' + (obj.stance||'中立') + '：' + obj.line.slice(0,40), '平', 5);
      return obj;
    } else if (_tyBubble && raw) {
      // extractJSON 失败兜底·尽力救出 line 字段(可能 JSON 未完全闭合)·否则展示完整 raw(去 JSON 符号)
      var _rescuedLine = '';
      var _rescuedStance = '';
      try {
        // 贪婪抓 "line":"..." 直至下一个未转义 "·支持多行
        var _lm = raw.match(/"line"\s*:\s*"((?:[^"\\]|\\.)*)"/);
        if (!_lm) _lm = raw.match(/"line"\s*:\s*"((?:[^"\\]|\\.)*)/);  // 不闭合兜底
        if (_lm && _lm[1]) _rescuedLine = _lm[1].replace(/\\n/g,'\n').replace(/\\"/g,'"').replace(/\\\\/g,'\\');
        var _sm = raw.match(/"stance"\s*:\s*"([^"]+)"/);
        if (_sm) _rescuedStance = _sm[1];
      } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-chaoyi-keju');}catch(_){}}
      if (_rescuedLine) {
        var _c2 = { '极力支持':'var(--celadon-400)','支持':'var(--celadon-400)','倾向支持':'var(--celadon-400)','中立':'var(--ink-300)','倾向反对':'var(--vermillion-400)','反对':'var(--vermillion-400)','极力反对':'var(--vermillion-400)','折中':'var(--amber-400)','另提议':'var(--indigo-400)' }[_rescuedStance] || '';
        _tyBubble.innerHTML = '\u3014' + (_rescuedStance||'\u4E2D\u7ACB') + '\u3015<span style="color:' + _c2 + ';">' + escHtml(_rescuedLine) + '</span>';
        _cy_jishiAdd('tinyi', CY._ty2.topic, name, _rescuedLine, { round: roundNum, stance: _rescuedStance, rescued: true });
        return { stance: _rescuedStance || '中立', line: _rescuedLine, confidence: 50, _rescued: true };
      }
      // 最后兜底·去 JSON 符号展示完整 raw (不 slice 200)
      var _clean = raw.replace(/^\s*\{[\s\S]*?"line"\s*:\s*"?|"\s*,?\s*"(?:stance|confidence|reason)"[\s\S]*?\}\s*$/g, '').replace(/^[\s"{]+|[\s"}]+$/g,'').trim();
      _tyBubble.textContent = _clean || raw;
    }
  } catch(e){ if (_tyBubble) { _tyBubble.textContent = '\uFF08\u672A\u80FD\u9648\u8BCD\uFF09'; _tyBubble.style.color = 'var(--red)'; } }
  return null;
}

/** 初议后——邀请玩家决定是否开始辩论 */
function _ty2_offerDebatePhase() {
  var footer = _$('cy-footer');
  var counts = _ty2_countStances();
  var disagreement = counts.support + counts.oppose; // 非中立总数
  var ambig = counts.neutral;

  footer.innerHTML = '<div style="display:flex;gap:var(--space-1);justify-content:center;flex-wrap:wrap;">'
    + '<button class="bt bp bsm" onclick="_ty2_startDebate()">🔥 展开辩论</button>'
    + '<button class="bt bsm" onclick="_ty2_offerMediation()">⚖️ 召调和派议折中</button>'
    + '<button class="bt bsm" onclick="_ty2_enterDecide()">🗳 直接裁决</button>'
    + '<button class="bt bsm" onclick="_ty2_playerInterjectEarly()">📣 朕欲先言</button>'
    + '</div>' + _ty2_globalFooter();
}

async function _ty2_playerInterjectEarly() {
  var q = prompt('陛下欲先言何事？（直接输入发言内容）');
  if (!q || !q.trim()) return;
  addCYBubble('皇帝', q.trim(), false);
  _cy_jishiAdd('tinyi', CY._ty2.topic, '皇帝', q.trim(), { round: CY._ty2.roundNum, playerInterject: true });
  // 让百官回应皇帝发言——触发一轮
  await _ty2_playerTriggeredResponse(q.trim());
  _ty2_offerDebatePhase();
}

async function _ty2_playerTriggeredResponse(playerText) {
  if (!CY._ty2) return;
  // 挑 2-3 人回应
  var responders = CY._ty2.attendees.slice().sort(function(){return Math.random()-0.5;}).slice(0, Math.min(3, CY._ty2.attendees.length));
  var prevSpeeches = [];
  for (var i = 0; i < responders.length; i++) {
    var prompt = '皇帝在廷议中插言：「' + playerText + '」\n';
    prompt += '议题：' + CY._ty2.topic + '\n';
    var ch = findCharByName(responders[i]);
    prompt += '你扮演' + responders[i] + '（' + (ch && ch.officialTitle || '') + '），当前立场:' + CY._ty2.stances[responders[i]].current + '\n';
    prompt += '性格：' + (ch && ch.personality || '') + '，忠' + ((ch && ch.loyalty)||50) + '\n';
    prompt += '请回应皇帝此言，可能：顺帝意/进谏/转移话题/重申立场' + (typeof _aiDialogueWordHint === 'function' ? _aiDialogueWordHint() : '') + '\n';
    prompt += '返回 JSON：{"newStance":"...(可能因此轮变化)","line":"..."}';
    try {
      var raw = await callAI(prompt, (typeof _aiDialogueTok==='function'?_aiDialogueTok("cy", 1):400));
      var obj = (typeof extractJSON === 'function') ? extractJSON(raw) : null;
      if (obj && obj.line) {
        addCYBubble(responders[i], '〔回言〕' + escHtml(obj.line), false, true);
        if (obj.newStance && CY._ty2.stances[responders[i]]) {
          CY._ty2.stances[responders[i]].current = obj.newStance;
        }
        _cy_jishiAdd('tinyi', CY._ty2.topic, responders[i], obj.line, { round: CY._ty2.roundNum });
      }
    } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-chaoyi-keju');}catch(_){}}
  }
  _ty2_render();
}

async function _ty2_startDebate() {
  CY._ty2.currentPhase = 'debate';
  CY._ty2.roundNum++;
  _ty2_render();
  addCYBubble('内侍', '（百官唇枪舌剑，辩之不休。）', true);

  // 挑选辩论主力：各立场派前 2 名（confidence 高者）
  var factions = _ty2_groupByStance();
  var speakers = [];
  Object.keys(factions).forEach(function(k) {
    factions[k].sort(function(a,b){return (CY._ty2.stances[b.name].confidence||0)-(CY._ty2.stances[a.name].confidence||0);});
    factions[k].slice(0, 2).forEach(function(s){ speakers.push(s.name); });
  });
  speakers = speakers.slice(0, 5);

  var prevSpeeches = [];
  for (var i = 0; i < speakers.length; i++) {
    var r = await _ty2_genOneSpeech(speakers[i], CY._ty2.roundNum, prevSpeeches);
    if (r) prevSpeeches.push({ name: speakers[i], stance: r.stance, line: r.line });
  }

  // 立场迁移判定
  await _ty2_judgeStanceShifts(prevSpeeches);
  _ty2_render();

  // 继续？
  var footer = _$('cy-footer');
  var btns = '<div style="display:flex;gap:var(--space-1);justify-content:center;flex-wrap:wrap;">';
  if (CY._ty2.roundNum < 4) btns += '<button class="bt bsm" onclick="_ty2_startDebate()">🔥 再辩一轮</button>';
  btns += '<button class="bt bsm" onclick="_ty2_offerMediation()">⚖️ 召折中</button>';
  btns += '<button class="bt bp bsm" onclick="_ty2_enterDecide()">🗳 进入裁决</button>';
  btns += '<button class="bt bsm" onclick="_ty2_playerInterjectEarly()">📣 朕再插言</button>';
  btns += '</div>';
  footer.innerHTML = btns + _ty2_globalFooter();
}

/** 立场迁移（AI 判定谁在本轮被说服） */
async function _ty2_judgeStanceShifts(speechesThisRound) {
  if (!P.ai || !P.ai.key) return;
  var prompt = '廷议立场迁移判定。议题：' + CY._ty2.topic + '\n';
  prompt += '本轮发言：\n';
  speechesThisRound.forEach(function(s){ prompt += '  ' + s.name + '(' + s.stance + ')：' + s.line.slice(0, 80) + '\n'; });
  prompt += '\n当前全体立场：\n';
  Object.keys(CY._ty2.stances).forEach(function(n) {
    var st = CY._ty2.stances[n];
    prompt += '  ' + n + '：' + st.current + '（confidence ' + (st.confidence||0) + '）';
    var ch = findCharByName(n);
    if (ch) prompt += ' 性:' + (ch.personality||'').slice(0,12) + ' 党:' + (ch.party||'无');
    prompt += '\n';
  });
  prompt += '\n根据本轮发言的说服力、人物性格（顽固者难变；趋附者易变；deceitful 随风倒）、党派、利害，判断哪些人本轮立场发生变化。\n';
  prompt += '只返回确实变化的。返回 JSON：[{"name":"","newStance":"","confidenceDelta":-20到+20,"reason":"简述"}]';
  try {
    var raw = await callAI(prompt, 700);
    var arr = (typeof extractJSON === 'function') ? extractJSON(raw) : null;
    if (Array.isArray(arr)) {
      arr.forEach(function(sh) {
        if (!sh || !sh.name || !CY._ty2.stances[sh.name]) return;
        var old = CY._ty2.stances[sh.name].current;
        if (sh.newStance && sh.newStance !== old) {
          CY._ty2.stances[sh.name].current = sh.newStance;
          CY._ty2.stances[sh.name].confidence = Math.max(0, Math.min(100, (CY._ty2.stances[sh.name].confidence||0) + (parseInt(sh.confidenceDelta,10)||0)));
          addCYBubble('内侍', '（' + sh.name + ' 立场由「' + old + '」转为「' + sh.newStance + '」）', true);
          CY._ty2.stanceHistory.push({ round: CY._ty2.roundNum, name: sh.name, from: old, to: sh.newStance, reason: sh.reason });
        }
      });
    }
  } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-chaoyi-keju');}catch(_){}}
}

async function _ty2_offerMediation() {
  if (!CY._ty2) return;
  addCYBubble('内侍', '（陛下令调和派陈折中之议。）', true);
  // 挑一位调和派（折中 stance）或高 diplomacy/benevolence 者
  var mediator = null;
  var mediStance = CY._ty2.attendees.find(function(n) { return CY._ty2.stances[n].current === '折中'; });
  if (mediStance) mediator = mediStance;
  else {
    var sorted = CY._ty2.attendees.slice().sort(function(a,b) {
      var ca = findCharByName(a)||{}, cb = findCharByName(b)||{};
      return ((cb.diplomacy||50)+(cb.benevolence||50)) - ((ca.diplomacy||50)+(ca.benevolence||50));
    });
    mediator = sorted[0];
  }
  if (!mediator) return _ty2_enterDecide();
  var prompt = '你扮演' + mediator + '，廷议议题：' + CY._ty2.topic + '\n';
  prompt += '当前立场分布：\n';
  Object.keys(CY._ty2.stances).forEach(function(n){ prompt += '  ' + n + '：' + CY._ty2.stances[n].current + '\n'; });
  prompt += '请提出一个折中方案（文言/半文言）——兼顾各方、可操作。' + (typeof _aiDialogueWordHint === 'function' ? _aiDialogueWordHint() : '') + '\n返回纯文本。';
  try {
    var raw = await callAI(prompt, (typeof _aiDialogueTok==='function'?_aiDialogueTok("cy", 1):500));
    addCYBubble(mediator, '〔折中〕' + escHtml(raw.trim()), false, true);
    _cy_jishiAdd('tinyi', CY._ty2.topic, mediator, raw.trim(), { round: CY._ty2.roundNum, mediation: true });
    CY._ty2._mediation = { author: mediator, content: raw.trim() };
  } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-chaoyi-keju');}catch(_){}}
  _ty2_enterDecide();
}

function _ty2_enterDecide() {
  CY._ty2.currentPhase = 'decide';
  var footer = _$('cy-footer');
  var counts = _ty2_countStances();
  var line = '裁决——当前：支持 ' + counts.support + ' / 反对 ' + counts.oppose + ' / 中立 ' + counts.neutral + (counts.mediate?' / 折中 '+counts.mediate:'');
  var html = '<div style="text-align:center;font-size:0.72rem;color:var(--gold-400);margin-bottom:6px;">' + line + '</div>';
  html += '<div style="display:flex;gap:var(--space-1);justify-content:center;flex-wrap:wrap;">';
  html += '<button class="bt bp bsm" onclick="_ty2_decide(\'majority\')">从众议</button>';
  html += '<button class="bt bsm" style="color:var(--vermillion-400);" onclick="_ty2_decide(\'override\')">乾纲独断</button>';
  if (CY._ty2._mediation) html += '<button class="bt bsm" onclick="_ty2_decide(\'mediation\')">采折中</button>';
  html += '<button class="bt bsm" onclick="_ty2_decide(\'defer\')">留待再议</button>';
  html += '<button class="bt bsm" onclick="_ty2_playerInterjectMidDecide()">📣 朕欲插言续议</button>';
  html += '</div>';
  footer.innerHTML = html + _ty2_globalFooter();
}

async function _ty2_playerInterjectMidDecide() {
  var q = prompt('陛下欲言何事？');
  if (!q || !q.trim()) return;
  addCYBubble('皇帝', q.trim(), false);
  _cy_jishiAdd('tinyi', CY._ty2.topic, '皇帝', q.trim(), { round: CY._ty2.roundNum, playerInterject: true });
  await _ty2_playerTriggeredResponse(q.trim());
  _ty2_enterDecide();
}

function _ty2_countStances() {
  var c = { support: 0, oppose: 0, neutral: 0, mediate: 0 };
  Object.keys(CY._ty2.stances).forEach(function(n) {
    var s = CY._ty2.stances[n].current;
    if (s==='极力支持'||s==='支持'||s==='倾向支持') c.support++;
    else if (s==='极力反对'||s==='反对'||s==='倾向反对') c.oppose++;
    else if (s==='折中') c.mediate++;
    else c.neutral++;
  });
  return c;
}

function _ty2_groupByStance() {
  var groups = { support: [], oppose: [], neutral: [], mediate: [] };
  Object.keys(CY._ty2.stances).forEach(function(n) {
    var s = CY._ty2.stances[n].current;
    var entry = { name: n, stance: s };
    if (s==='极力支持'||s==='支持'||s==='倾向支持') groups.support.push(entry);
    else if (s==='极力反对'||s==='反对'||s==='倾向反对') groups.oppose.push(entry);
    else if (s==='折中') groups.mediate.push(entry);
    else groups.neutral.push(entry);
  });
  return groups;
}

async function _ty2_decide(mode) {
  if (!CY._ty2) return;
  var counts = _ty2_countStances();
  var groups = _ty2_groupByStance();
  var decision = { mode: mode, counts: counts };
  var actualDirection = '';

  if (mode === 'majority') {
    if (counts.support > counts.oppose) actualDirection = '允行';
    else if (counts.oppose > counts.support) actualDirection = '否决';
    else actualDirection = '折中观望';
    decision.direction = actualDirection;
    decision.followedMajority = true;
    addCYBubble('皇帝', '朕从公议：' + actualDirection + '。', false);
  } else if (mode === 'override') {
    var majDir = counts.support > counts.oppose ? '允行' : '否决';
    actualDirection = majDir === '允行' ? '否决' : '允行';
    decision.direction = actualDirection;
    decision.followedMajority = false;
    addCYBubble('皇帝', '众意未必至理。朕决：' + actualDirection + '。', false);
    // 触发遗祸
    setTimeout(function() { _ty2_afterOverride(groups, actualDirection); }, 500);
  } else if (mode === 'mediation') {
    actualDirection = '从折中';
    decision.direction = actualDirection;
    decision.mediation = CY._ty2._mediation;
    addCYBubble('皇帝', '卿等所议，折中为宜：' + (CY._ty2._mediation.content||'').slice(0, 60) + '……', false);
  } else if (mode === 'defer') {
    actualDirection = '留待再议';
    decision.direction = actualDirection;
    addCYBubble('皇帝', '此事兹事体大，留待再议。', false);
    if (!GM._pendingTinyiTopics) GM._pendingTinyiTopics = [];
    GM._pendingTinyiTopics.push({ topic: CY._ty2.topic, from: '廷议延议', turn: GM.turn });
  }

  CY._ty2.decision = decision;
  _cy_jishiAdd('tinyi', CY._ty2.topic, '皇帝', '裁决：' + actualDirection, { final: true, stances: counts });

  // 经济改革廷议回调——若题目是经济改革（EconomyGapFill 提交的），根据皇帝裁决应用
  try {
    if (CY._ty2._economyReform && typeof EconomyGapFill !== 'undefined' && typeof EconomyGapFill.onTinyiDecision === 'function') {
      var approveFlag = (actualDirection === '准奏' || actualDirection === '依议');
      EconomyGapFill.onTinyiDecision({
        _economyReform: true,
        reformType: CY._ty2._reformType,
        reformId: CY._ty2._reformId
      }, approveFlag ? 'approve' : 'reject');
    }
  } catch(_e) { console.error('[tinyi] 经济改革回调失败:', _e); }

  // 写入 courtRecords
  if (!GM._courtRecords) GM._courtRecords = [];
  var _isPostTurnTy = !!GM._isPostTurnCourt;
  GM._courtRecords.push({
    turn: GM.turn,
    targetTurn: _isPostTurnTy ? (GM.turn + 1) : GM.turn,
    phase: _isPostTurnTy ? 'post-turn' : 'in-turn',
    topic: CY._ty2.topic, mode: 'tinyi',
    topicType: CY._ty2.topicType, participants: CY._ty2.attendees,
    stances: CY._ty2.stances, decision: decision, stanceHistory: CY._ty2.stanceHistory
  });
  if (GM._courtRecords.length > 8) GM._courtRecords.shift();
  // 事件板
  if (typeof addEB === 'function') addEB('廷议', CY._ty2.topic + '：' + actualDirection);
  if (GM.qijuHistory) GM.qijuHistory.unshift({ turn: GM.turn, date: typeof getTSText==='function'?getTSText(GM.turn):'', content: '【廷议】' + CY._ty2.topic + '——' + actualDirection });

  // ★ 将廷议裁决转为诏令进入 _edictTracker，驱动后续推演
  if (mode !== 'defer') {
    if (!GM._edictTracker) GM._edictTracker = [];
    var _ttLbl = { war:'战和',succession:'立储',reform:'变法',judgment:'重案',finance:'财赋',relief:'灾赈',appointment:'廷推',other:'' }[CY._ty2.topicType] || '';
    var edictContent = '';
    if (mode === 'mediation' && CY._ty2._mediation) {
      edictContent = '廷议折中：' + CY._ty2._mediation.content;
    } else {
      edictContent = '廷议议定「' + CY._ty2.topic + '」，裁决：' + actualDirection;
      if (mode === 'override') edictContent += '（逆众议而行）';
    }
    // 推导 assignee（相关部门主官）
    var _assignee = '';
    if (CY._ty2.topicType === 'war') _assignee = (CY._ty2.attendees||[]).find(function(n){var c=findCharByName(n);return c&&/兵部|枢密|大将军/.test(c.officialTitle||'');}) || '';
    else if (CY._ty2.topicType === 'finance') _assignee = (CY._ty2.attendees||[]).find(function(n){var c=findCharByName(n);return c&&/户部|度支/.test(c.officialTitle||'');}) || '';
    else if (CY._ty2.topicType === 'judgment') _assignee = (CY._ty2.attendees||[]).find(function(n){var c=findCharByName(n);return c&&/刑部|大理|御史/.test(c.officialTitle||'');}) || '';
    else if (CY._ty2.topicType === 'appointment') _assignee = (CY._ty2.attendees||[]).find(function(n){var c=findCharByName(n);return c&&/吏部/.test(c.officialTitle||'');}) || '';

    GM._edictTracker.push({
      id: (typeof uid === 'function' ? uid() : 'ty_' + Date.now()),
      content: edictContent,
      category: '廷议诏令' + (_ttLbl?'·'+_ttLbl:''),
      turn: GM.turn,
      status: 'pending',
      assignee: _assignee,
      feedback: '',
      progressPercent: 0,
      source: 'tinyi2',
      topicType: CY._ty2.topicType,
      followedMajority: decision.followedMajority !== false,
      stanceCounts: counts,
      minorityDissent: mode === 'override' ? _ty2_groupByStance()[counts.support > counts.oppose ? 'oppose' : 'support'].map(function(g){return g.name;}) : []
    });
  }

  // 结束
  setTimeout(function() {
    var footer = _$('cy-footer');
    footer.innerHTML = '<div style="text-align:center;"><button class="bt bp" onclick="_ty2_finalEnd()">卷帘退朝</button></div>';
  }, 800);
}

async function _ty2_afterOverride(groups, direction) {
  addCYBubble('内侍', '（少数派中颇有权重者愤然低语，或有余怒。）', true);
  // AI 判定遗祸
  var minority = direction === '允行' ? groups.oppose : groups.support;
  if (!minority || minority.length === 0) return;
  if (!P.ai || !P.ai.key) return;
  var prompt = '廷议结束。议题：' + CY._ty2.topic + '\n';
  prompt += '皇帝逆众议而行。少数派（被压制者）：\n';
  minority.forEach(function(m) {
    var ch = findCharByName(m.name);
    prompt += '  ' + m.name + (ch&&ch.officialTitle?'('+ch.officialTitle+')':'') + ' 党:' + (ch&&ch.party||'无') + ' 忠' + ((ch&&ch.loyalty)||50) + ' 野' + ((ch&&ch.ambition)||40) + '\n';
  });
  prompt += '\n判定：哪些人会有后续反应？类型：\n';
  prompt += '· resign 请辞 · sick 称病不朝 · plot 密结同党 · leak 散布不满 · accept 勉强受命 · confront 持续抗诤\n';
  prompt += (typeof _aiDialogueWordHint === 'function' ? _aiDialogueWordHint() + '（line 字段遵循此字数）\n' : '');
  prompt += '返回 JSON：[{"name":"","type":"...","line":"该人内心独白或背后之语","consequence":"具体影响(loyalty/stress/ambition)"}]';
  try {
    var raw = await callAI(prompt, (typeof _aiDialogueTok==='function'?_aiDialogueTok("cy", minority.length):700));
    var arr = (typeof extractJSON === 'function') ? extractJSON(raw) : null;
    if (Array.isArray(arr)) {
      arr.forEach(function(r) {
        if (!r || !r.name) return;
        var ch = findCharByName(r.name);
        if (!ch) return;
        if (r.line) addCYBubble(r.name, '〔' + (r.type||'') + '〕' + escHtml(r.line), false);
        if (r.type === 'resign') {
          if (typeof addEB === 'function') addEB('人事', r.name + '因廷议逆意而请辞');
          ch.loyalty = Math.max(0, (ch.loyalty||50) - 15);
        } else if (r.type === 'sick') {
          ch._mourning = false;
          ch.stress = Math.min(100, (ch.stress||0) + 20);
        } else if (r.type === 'plot') {
          if (!GM.activeSchemes) GM.activeSchemes = [];
          GM.activeSchemes.push({ schemer: r.name, target: '皇帝', plan: '因廷议被压制而暗结同党', progress: '酝酿中', allies: '', startTurn: GM.turn, lastTurn: GM.turn });
          ch.loyalty = Math.max(0, (ch.loyalty||50) - 10);
          ch.ambition = Math.min(100, (ch.ambition||40) + 5);
        } else if (r.type === 'leak') {
          if (typeof NpcMemorySystem !== 'undefined') NpcMemorySystem.remember(r.name, '廷议被压制，背后散布不满', '怒', 6);
        } else if (r.type === 'confront') {
          ch.stress = Math.min(100, (ch.stress||0) + 10);
        }
        if (typeof NpcMemorySystem !== 'undefined') {
          NpcMemorySystem.remember(r.name, '廷议「' + CY._ty2.topic.slice(0,20) + '」被皇帝逆众议——心怀' + (r.type||''), '恨', 7);
        }
      });
    }
  } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-chaoyi-keju');}catch(_){}}
}

function _ty2_finalEnd() {
  CY._ty2 = null;
  if (typeof closeChaoyi === 'function') closeChaoyi();
}

function _ty2_globalFooter() {
  return '<div style="margin-top:var(--space-2);padding-top:var(--space-2);border-top:1px solid var(--color-border-subtle);display:flex;gap:3px;justify-content:center;flex-wrap:wrap;">'
    + _cy_suggestBtnHtml('廷议')
    + '</div>';
}

// ═══════════════════════════════════════════════════════════════════════
//  御前会议 2.0——密召心腹，坦言直陈，可不录
//  议题类型：诛戮/托孤/军机/罢相/宫禁/人事/其他
//  流程：屏退宫人 → 帝出疑问 → 逐人问对 → 密谈 → 决断与保密
// ═══════════════════════════════════════════════════════════════════════

function _yq2_openSetup() {
  var bg = document.createElement('div');
  bg.id = 'yq2-setup-bg';
  bg.style.cssText = 'position:fixed;inset:0;z-index:1300;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;';
  // 候选：同势力 + 高忠诚 + 在玩家所在地（御前密议·异族不入）
  var candidates = (GM.chars||[]).filter(function(c) {
    if (c.alive === false || c.isPlayer || !_isAtCapital(c) || !_isPlayerFactionChar(c)) return false;
    return (c.loyalty||50) >= 50; // 至少中等忠诚可入密议
  }).sort(function(a,b) {
    // 按"机密适合度"排序：忠*0.5 + 品*0.3 + 恩遇*0.2
    var sa = (a.loyalty||50) * 0.5 + (110 - (typeof getRankLevel === 'function' ? getRankLevel(_cyGetRank(a)) : 99)) * 0.5;
    var sb = (b.loyalty||50) * 0.5 + (110 - (typeof getRankLevel === 'function' ? getRankLevel(_cyGetRank(b)) : 99)) * 0.5;
    return sb - sa;
  }).slice(0, 25);
  var autoSelect = candidates.slice(0, 4).map(function(c){return c.name;});

  var html = '<div style="background:var(--color-surface);border:1px solid var(--gold-500);border-radius:var(--radius-lg);padding:1.3rem 1.7rem;max-width:540px;width:92%;max-height:85vh;overflow-y:auto;">';
  html += '<div style="text-align:center;font-size:var(--text-md);color:var(--gold-400);letter-spacing:0.12em;margin-bottom:0.9rem;">〔 御 前 会 议 · 筹 备 〕</div>';
  html += '<div style="font-size:0.68rem;color:var(--ink-300);text-align:center;margin-bottom:0.8rem;">屏退宫人，与心腹重臣密议机要。</div>';
  // 议题
  html += '<div class="fd" style="margin-bottom:0.7rem;"><label style="font-size:0.72rem;">议题（机密事项）</label>';
  html += '<input id="yq2-topic" placeholder="如：废太子议、罢某相、诛权阉、出兵略西域……" style="width:100%;padding:5px 8px;background:var(--color-elevated);border:1px solid var(--color-border);border-radius:var(--radius-sm);color:var(--color-foreground);">';
  html += '</div>';
  // 议题类型
  html += '<div style="font-size:0.7rem;color:var(--color-foreground-muted);margin-bottom:0.35rem;">议题类型</div>';
  html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-bottom:0.8rem;">';
  [['execution','🗡️ 诛戮'],['succession','👑 托孤废立'],['military','🎯 军机'],['removal','🎭 罢相'],['palace','🏯 宫禁'],['appointment','💼 人事'],['plot','🕵️ 密谋'],['other','❓ 其他']].forEach(function(t) {
    html += '<label style="display:flex;align-items:center;gap:3px;padding:4px 6px;background:var(--color-elevated);border-radius:3px;font-size:0.7rem;cursor:pointer;">';
    html += '<input type="radio" name="yq2-type" value="' + t[0] + '"' + (t[0]==='execution'?' checked':'') + '>' + t[1];
    html += '</label>';
  });
  html += '</div>';
  html += '<input id="yq2-type-custom" placeholder="若选其他，描述议题性质……" style="width:100%;padding:5px 8px;margin-bottom:0.8rem;display:none;font-size:0.78rem;background:var(--color-elevated);border:1px solid var(--color-border);border-radius:var(--radius-sm);color:var(--color-foreground);">';
  // 心腹候选
  html += '<div style="font-size:0.7rem;color:var(--color-foreground-muted);margin-bottom:0.35rem;">心腹候选（按忠诚+品级排序，至多 8 人）</div>';
  html += '<div style="max-height:220px;overflow-y:auto;padding:6px;background:var(--color-elevated);border-radius:3px;margin-bottom:0.7rem;">';
  candidates.forEach(function(c) {
    var auto = autoSelect.indexOf(c.name) >= 0;
    html += '<label style="display:flex;align-items:center;gap:5px;padding:3px 5px;font-size:0.7rem;cursor:pointer;">';
    html += '<input type="checkbox" class="yq2-advisor" value="' + escHtml(c.name) + '"' + (auto?' checked':'') + '>';
    html += '<span>' + escHtml(c.name) + '</span>';
    html += '<span style="color:var(--ink-300);font-size:0.62rem;">' + escHtml(c.officialTitle||c.title||'') + ' 忠' + (typeof _fmtNum1==='function'?_fmtNum1(c.loyalty||50):(c.loyalty||50)) + ' 野' + (typeof _fmtNum1==='function'?_fmtNum1(c.ambition||40):(c.ambition||40)) + '</span>';
    html += '</label>';
  });
  html += '</div>';
  // 记录选项
  html += '<div style="font-size:0.7rem;color:var(--color-foreground-muted);margin-bottom:0.35rem;">起居注记录</div>';
  html += '<div style="display:flex;gap:1rem;margin-bottom:0.8rem;">';
  html += '<label style="font-size:0.72rem;"><input type="radio" name="yq2-record" value="keep" checked> 📜 记起居注（正常）</label>';
  html += '<label style="font-size:0.72rem;color:var(--vermillion-400);"><input type="radio" name="yq2-record" value="secret"> 🤐 不录（密议——泄密风险）</label>';
  html += '</div>';
  html += '<div style="font-size:0.62rem;color:var(--ink-300);margin-bottom:0.8rem;">· 不录者：议事不入起居注/纪事；若事后泄密，则成大丑闻</div>';
  html += '<div style="text-align:center;display:flex;gap:var(--space-2);justify-content:center;">';
  html += '<button class="bt bp" onclick="_yq2_startSession()">开议</button>';
  html += '<button class="bt" onclick="this.closest(\'div[style*=fixed]\').remove();">取消</button>';
  html += '</div></div>';
  bg.innerHTML = html;
  document.body.appendChild(bg);

  // 类型"其他"联动
  bg.querySelectorAll('input[name="yq2-type"]').forEach(function(r){
    r.addEventListener('change', function(){
      var cust = _$('yq2-type-custom');
      if (cust) cust.style.display = this.value==='other' ? 'block' : 'none';
    });
  });
  // 选人上限 8
  bg.querySelectorAll('.yq2-advisor').forEach(function(cb){
    cb.addEventListener('change', function(){
      var checked = bg.querySelectorAll('.yq2-advisor:checked').length;
      if (checked > 8) { this.checked = false; toast('至多 8 人'); }
    });
  });
}

async function _yq2_startSession() {
  var topic = (_$('yq2-topic')||{}).value || '';
  topic = topic.trim();
  if (!topic) { toast('请输入议题'); return; }
  var typeR = document.querySelector('input[name="yq2-type"]:checked');
  var ttype = typeR ? typeR.value : 'other';
  var tcustom = (_$('yq2-type-custom')||{}).value || '';
  var recordR = document.querySelector('input[name="yq2-record"]:checked');
  var record = recordR ? recordR.value : 'keep';
  var advisors = [];
  document.querySelectorAll('.yq2-advisor:checked').forEach(function(c){ advisors.push(c.value); });
  if (advisors.length < 1) { toast('至少召 1 位心腹'); return; }
  if (advisors.length > 8) { toast('至多 8 位'); return; }

  if (typeof _spendEnergy === 'function' && !_spendEnergy(10, '御前会议')) return;

  var bg = _$('yq2-setup-bg'); if (bg) bg.remove();

  CY.phase = 'yuqian2';
  CY._yq2 = {
    topic: topic,
    topicType: ttype,
    topicCustom: tcustom,
    advisors: advisors,
    record: record,
    opinions: {},          // name → {line, candor}
    summonedAdvisor: null,
    currentPhase: 'retreating',
    leakRisk: 0,
    excluded: [],         // 被排除的重臣（有资格但未被召）
    candorMap: {}         // B3·预计算 candor·避免 _yq2_oneAdvisorSpeak 每次重算
  };
  // B3·坦白度预计算（一次性为所有心腹算好）
  advisors.forEach(function(_nm) {
    var _ch = findCharByName(_nm); if (!_ch) return;
    var _de = 0;
    var _tids = (_ch.traits||[]).concat(_ch.traitIds||[]);
    if (_tids.indexOf('deceitful') >= 0) _de = 30;
    if (_tids.indexOf('honest') >= 0) _de = -20;
    var _cd = Math.max(0, Math.min(100, (_ch.loyalty||50) * 0.5 + (100 - _de) * 0.3 + 20));
    CY._yq2.candorMap[_nm] = { candor: _cd, level: _cd > 80 ? '\u63A8\u5FC3\u7F6E\u8179' : _cd > 50 ? '\u5927\u81F4\u5766\u8A00' : '\u63E3\u6469\u5723\u610F' };
  });
  // 计算被排除者——资格达标但未被召
  (GM.chars||[]).forEach(function(c) {
    if (c.alive === false || c.isPlayer || !_isAtCapital(c)) return;
    if (advisors.indexOf(c.name) >= 0) return;
    if ((c.loyalty||50) >= 70 && (typeof getRankLevel === 'function' ? getRankLevel(_cyGetRank(c)) : 99) <= 6) {
      CY._yq2.excluded.push(c.name);
    }
  });

  var body = _$('cy-body');
  body.innerHTML = '';
  var topicEl = _$('cy-topic');
  if (topicEl) { topicEl.style.display = 'block'; topicEl.innerHTML = '👑 御前会议·' + escHtml(topic) + (record === 'secret' ? ' <span style="color:var(--vermillion-400);font-size:0.7rem;">[密议不录]</span>' : ''); }

  addCYBubble('内侍', '（陛下入御书房。内侍、宫娥尽皆屏退。）', true);
  addCYBubble('内侍', '（殿中仅余陛下与 ' + advisors.length + ' 员心腹。）', true);

  CY._abortChaoyi = false; CY._pendingPlayerLine = null;
  if (typeof _cyShowInputRow === 'function') _cyShowInputRow(true);

  // 记录被排除感（立即触发，用自然逻辑）
  _yq2_triggerExcludedFeelings();

  // 帝出疑问——等玩家输入具体问题（可用议题作为默认）
  _yq2_phaseQuestion();
}

function _yq2_triggerExcludedFeelings() {
  if (!CY._yq2 || !CY._yq2.excluded.length) return;
  CY._yq2.excluded.forEach(function(nm) {
    var ch = findCharByName(nm);
    if (!ch) return;
    // 每次被排除 -3 loyalty (轻)
    ch.loyalty = Math.max(0, (ch.loyalty||50) - 3);
    if (typeof NpcMemorySystem !== 'undefined') {
      NpcMemorySystem.remember(nm, '陛下未召我议密事（' + CY._yq2.topic.slice(0,15) + '）——疑心中有他意', '忧', 4);
    }
  });
}

function _yq2_phaseQuestion() {
  CY._yq2.currentPhase = 'question';
  addCYBubble('皇帝', '朕有一事难决，诸卿可直言——' + CY._yq2.topic, false);
  var footer = _$('cy-footer');
  footer.innerHTML = '<div style="display:flex;gap:var(--space-1);justify-content:center;flex-wrap:wrap;">'
    + '<button class="bt bp bsm" onclick="_yq2_startRoundQuery()">📣 令众人直陈</button>'
    + '<button class="bt bsm" onclick="_yq2_pickAdvisor()">👤 单独问某人</button>'
    + '</div>' + _yq2_globalFooter();
}

async function _yq2_startRoundQuery() {
  CY._yq2.currentPhase = 'roundQuery';
  var footer = _$('cy-footer');
  footer.innerHTML = '<div style="text-align:center;color:var(--color-foreground-muted);font-size:0.72rem;padding:0.4rem;">心腹依次直言……（可在下方输入框插言或打断）</div>';
  addCYBubble('内侍', '（诸卿依次直陈其议。）', true);

  CY._yq2._transcript = '';
  for (var _rd = 1; _rd <= 2; _rd++) {
    if (_rd === 2) addCYBubble('内侍', '（帝意未决，再令诸卿各抒所见。）', true);
    for (var i = 0; i < CY._yq2.advisors.length; i++) {
      if (CY._abortChaoyi) { CY._abortChaoyi=false; break; }
      // 玩家中途插言
      if (CY._pendingPlayerLine) {
        var _pl = CY._pendingPlayerLine; CY._pendingPlayerLine = null;
        addCYBubble('皇帝', _pl, false);
        if (CY._yq2.record !== 'secret') _cy_jishiAdd('yuqian', CY._yq2.topic, '皇帝', _pl, { playerInterject: true, round: _rd });
        CY._yq2._transcript += '\n皇帝：' + _pl;
      }
      var nm = CY._yq2.advisors[i];
      await _yq2_oneAdvisorSpeak(nm, _rd);
    }
    if (CY._abortChaoyi) { CY._abortChaoyi=false; break; }
  }

  _yq2_offerFollowUp();
}

async function _yq2_oneAdvisorSpeak(name, roundNum) {
  roundNum = roundNum || 1;
  var ch = findCharByName(name);
  if (!ch) return;
  // B3·坦白度从预计算表取·无则兜底
  var _cachedCand = (CY._yq2 && CY._yq2.candorMap && CY._yq2.candorMap[name]) || null;
  var candor, candorLevel;
  if (_cachedCand) {
    candor = _cachedCand.candor; candorLevel = _cachedCand.level;
  } else {
    var deceit = 0;
    var tids = (ch.traits||[]).concat(ch.traitIds||[]);
    if (tids.indexOf('deceitful') >= 0) deceit = 30;
    if (tids.indexOf('honest') >= 0) deceit = -20;
    candor = Math.max(0, Math.min(100, (ch.loyalty||50) * 0.5 + (100 - deceit) * 0.3 + 20));
    candorLevel = candor > 80 ? '推心置腹' : candor > 50 ? '大致坦言' : '揣摩圣意';
  }

  if (!P.ai || !P.ai.key) {
    addCYBubble(name, '（臣以为……）', false);
    CY._yq2.opinions[name] = { line: '(无 AI)', candor: candor };
    return;
  }

  var prompt = '御前会议·坦言直陈（第 ' + roundNum + ' 轮）。议题：' + CY._yq2.topic + '\n';
  prompt += '你扮演' + name + '（' + (ch.officialTitle||ch.title||'') + '）。\n';
  prompt += '性格：' + (ch.personality||'') + '\n';
  prompt += '忠' + (ch.loyalty||50) + ' 野' + (ch.ambition||40) + ' 学识:' + (ch.learning||'') + ' 党:' + (ch.party||'无') + '\n';
  prompt += '近期记忆：' + ((ch._memory||[]).slice(-3).map(function(m){return (m.event||'').slice(0,30);}).join('；')||'无') + '\n';
  prompt += '你的坦白度：' + candor + '/100（' + candorLevel + '·\u8D8A\u9AD8\u8D8A\u76F4\u8A00\u00B7\u8D8A\u4F4E\u8D8A\u8FCE\u5408\uFF09\n';
  if (CY._yq2._transcript) {
    prompt += '\n已有对话（仅供参考，你可附议/反驳/补充/转圜）：\n' + CY._yq2._transcript.slice(-1600) + '\n';
  } else {
    prompt += '\n当前无他人先言，你是直接受问。';
  }
  if (roundNum >= 2 && CY._yq2.opinions[name] && CY._yq2.opinions[name].line) {
    prompt += '\n你上轮已陈言：' + CY._yq2.opinions[name].line.slice(0, 120) + '\n此轮可据他人之言修订或坚持。';
  }
  prompt += '\n请给出你的答复（文言/半文言）。' + (typeof _aiDialogueWordHint === 'function' ? _aiDialogueWordHint('cy') + '（发言必须达到此字数范围）' : '') + '\n';
  prompt += '返回 JSON：{"line":"...","stance":"支持/反对/保留/另提/推诿","inwardThought":"真实内心(10-30字)"}';

  // A2: 流式化——建占位气泡·onChunk 渐进显示 "line" 字段
  var _yqDiv = addCYBubble(name, '\u2026', false);
  var _yqBubble = _yqDiv && _yqDiv.querySelector ? _yqDiv.querySelector('.cy-bubble') : null;
  var _yqRaf = false;
  CY.abortCtrl = new AbortController();  // 每次新建·避免前次 abort 污染
  try {
    var raw = await callAIMessagesStream(
      [{role:'user', content: prompt}],
      (typeof _aiDialogueTok==='function'?_aiDialogueTok("cy", 1):700),
      { signal: CY.abortCtrl.signal,
        tier: (typeof _useSecondaryTier === 'function' && _useSecondaryTier()) ? 'secondary' : undefined,  // M3·御前走次 API
        onChunk: function(txt) {
          if (!_yqBubble || _yqRaf) return;
          _yqRaf = true;
          requestAnimationFrame(function() {
            _yqRaf = false;
            var m = (txt||'').match(/"line"\s*:\s*"((?:[^"\\]|\\.)*)/);
            if (m && m[1]) {
              _yqBubble.textContent = m[1].replace(/\\n/g,'\n').replace(/\\"/g,'"').replace(/\\\\/g,'\\');
              _yqBubble.style.color = '';
            }
          });
      } }
    );
    var obj = (typeof extractJSON === 'function') ? extractJSON(raw) : null;
    if (obj && obj.line) {
      if (_yqBubble) _yqBubble.innerHTML = '\u3014' + candorLevel + '\u00B7\u7B2C' + roundNum + '\u8F6E\u3015' + escHtml(obj.line);
      CY._yq2.opinions[name] = { line: obj.line, candor: candor, stance: obj.stance, inward: obj.inwardThought, round: roundNum };
      if (CY._yq2._transcript != null) CY._yq2._transcript += '\n' + name + '：' + obj.line;
      if (CY._yq2.record !== 'secret') {
        _cy_jishiAdd('yuqian', CY._yq2.topic, name, obj.line, { candor: candor, stance: obj.stance, round: roundNum });
      }
      if (typeof NpcMemorySystem !== 'undefined') {
        NpcMemorySystem.remember(name, '御前密议「' + CY._yq2.topic.slice(0,20) + '」第' + roundNum + '轮陈言——' + (obj.stance||''), '平', 5);
      }
    } else if (_yqBubble && raw) { _yqBubble.textContent = raw.slice(0, 200); }
  } catch(e){ if (_yqBubble) { _yqBubble.textContent = '\uFF08\u672A\u80FD\u9648\u8BCD\uFF09'; _yqBubble.style.color = 'var(--red)'; } }
}

function _yq2_offerFollowUp() {
  var footer = _$('cy-footer');
  footer.innerHTML = '<div style="display:flex;gap:var(--space-1);justify-content:center;flex-wrap:wrap;">'
    + '<button class="bt bsm" onclick="_yq2_pickAdvisor()">🎯 点某人深问</button>'
    + '<button class="bt bp bsm" onclick="_yq2_enterDecide()">⚖️ 决断</button>'
    + '</div>' + _yq2_globalFooter();
}

function _yq2_pickAdvisor() {
  var bg = document.createElement('div');
  bg.style.cssText = 'position:fixed;inset:0;z-index:1350;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;';
  var html = '<div style="background:var(--color-surface);border:1px solid var(--gold-500);border-radius:var(--radius-lg);padding:1rem 1.5rem;max-width:400px;">';
  html += '<div style="color:var(--gold-400);margin-bottom:0.6rem;">深问何人？</div>';
  html += '<div style="display:flex;flex-direction:column;gap:4px;">';
  CY._yq2.advisors.forEach(function(nm) {
    var op = CY._yq2.opinions[nm];
    html += '<button class="bt bsm" style="text-align:left;" onclick="_yq2_askAdvisor(\'' + escHtml(nm).replace(/\'/g,"\\'") + '\');this.closest(\'div[style*=fixed]\').remove();">' + escHtml(nm);
    if (op) html += ' <span style="color:var(--ink-300);font-size:0.65rem;">(坦'+Math.round(op.candor)+')</span>';
    html += '</button>';
  });
  html += '</div>';
  html += '<div style="text-align:center;margin-top:0.6rem;"><button class="bt" onclick="this.closest(\'div[style*=fixed]\').remove();">取消</button></div>';
  html += '</div>';
  bg.innerHTML = html;
  document.body.appendChild(bg);
}

function _yq2_askAdvisor(name) {
  var q = prompt('陛下欲问 ' + name + ' 何事？');
  if (!q || !q.trim()) return;
  _yq2_doAskAdvisor(name, q.trim());
}

async function _yq2_doAskAdvisor(name, question) {
  addCYBubble('皇帝', '问' + name + '：' + question, false);
  var ch = findCharByName(name);
  if (!ch) return;
  var candor = (CY._yq2.opinions[name] && CY._yq2.opinions[name].candor) || 70;
  var prompt = '御前密议·深入问答。议题：' + CY._yq2.topic + '\n';
  prompt += '你扮演' + name + '（' + (ch.officialTitle||ch.title||'') + '，性格' + (ch.personality||'') + '，忠' + (ch.loyalty||50) + '）\n';
  prompt += '之前你已陈言：' + ((CY._yq2.opinions[name]&&CY._yq2.opinions[name].line) || '尚未发言') + '\n';
  prompt += '皇帝再深问：' + question + '\n';
  prompt += '坦白度:' + candor + '，' + (candor>80?'推心置腹':candor>50?'大致坦言':'揣摩圣意') + '\n';
  prompt += '请答，可比前言更直率（密谈氛围）。' + (typeof _aiDialogueWordHint === 'function' ? _aiDialogueWordHint() : '') + '\n返回纯文本。';
  try {
    var raw = await callAI(prompt, (typeof _aiDialogueTok==='function'?_aiDialogueTok("cy", 1):500));
    var line = raw.trim();
    addCYBubble(name, '〔深言〕' + escHtml(line), false, true);
    if (CY._yq2.record !== 'secret') _cy_jishiAdd('yuqian', CY._yq2.topic, name, line, { deep: true });
  } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-chaoyi-keju');}catch(_){}}
  _yq2_offerFollowUp();
}

function _yq2_enterDecide() {
  CY._yq2.currentPhase = 'decide';
  var footer = _$('cy-footer');
  footer.innerHTML = '<div style="display:flex;gap:var(--space-1);justify-content:center;flex-wrap:wrap;">'
    + '<button class="bt bp bsm" onclick="_yq2_decide(\'approve\')">准行</button>'
    + '<button class="bt bsm" style="color:var(--vermillion-400);" onclick="_yq2_decide(\'reject\')">驳否</button>'
    + '<button class="bt bsm" onclick="_yq2_decide(\'defer\')">再议</button>'
    + '<button class="bt bsm" onclick="_yq2_decide(\'custom\')">自定</button>'
    + '</div>' + _yq2_globalFooter();
}

function _yq2_decide(mode) {
  var actualDir = mode;
  var customText = '';
  if (mode === 'custom') {
    customText = prompt('陛下定夺（自述）：');
    if (!customText) return;
  }
  var line = mode === 'approve' ? '准此事' : mode === 'reject' ? '此事勿议' : mode === 'defer' ? '再议' : customText;
  addCYBubble('皇帝', '朕决：' + line, false);
  CY._yq2.decision = { mode: mode, custom: customText };

  // 保密等级写入
  if (CY._yq2.record === 'keep') {
    _cy_jishiAdd('yuqian', CY._yq2.topic, '皇帝', '决：' + line, { final: true, secret: false });
  } else {
    // 不录：单独存 GM._secretMeetings
    if (!GM._secretMeetings) GM._secretMeetings = [];
    GM._secretMeetings.push({
      turn: GM.turn, topic: CY._yq2.topic, advisors: CY._yq2.advisors,
      opinions: CY._yq2.opinions, decision: CY._yq2.decision,
      leaked: false
    });
  }

  // ★ 御前决断 → 后续推演对接（按议题类型区分明诏/密谋）
  if (mode !== 'reject' && mode !== 'defer') {
    var decisionLine = mode === 'approve' ? ('准行此事：' + CY._yq2.topic) : customText;
    // 敏感议题（诛戮/密谋）走 activeSchemes（暗中推进）
    var _isSecretAction = (CY._yq2.topicType === 'execution' || CY._yq2.topicType === 'plot' || CY._yq2.record === 'secret');
    if (_isSecretAction) {
      if (!GM.activeSchemes) GM.activeSchemes = [];
      GM.activeSchemes.push({
        schemer: (P.playerInfo && P.playerInfo.characterName) || '皇帝',
        target: '',
        plan: '【御前密议决】' + CY._yq2.topic + '——' + decisionLine,
        progress: '酝酿中',
        allies: CY._yq2.advisors.join('、'),
        startTurn: GM.turn,
        lastTurn: GM.turn,
        source: 'yuqian2',
        secret: CY._yq2.record === 'secret'
      });
      addEB('密谋', '【御前】' + CY._yq2.topic + '——暗中推进');
    } else {
      // 公开议题 → 诏令
      if (!GM._edictTracker) GM._edictTracker = [];
      var ytLbl = { execution:'诛戮',succession:'立储',military:'军机',removal:'罢相',palace:'宫禁',appointment:'人事',plot:'密谋',other:'' }[CY._yq2.topicType] || '';
      GM._edictTracker.push({
        id: (typeof uid === 'function' ? uid() : 'yq_' + Date.now()),
        content: '御前议决：' + CY._yq2.topic + '——' + decisionLine,
        category: '御前诏令' + (ytLbl?'·'+ytLbl:''),
        turn: GM.turn,
        status: 'pending',
        assignee: CY._yq2.advisors[0] || '',
        feedback: '',
        progressPercent: 0,
        source: 'yuqian2',
        topicType: CY._yq2.topicType,
        secretOrigin: CY._yq2.record === 'secret'
      });
      addEB('御前', CY._yq2.topic + '：' + decisionLine);
    }
  }

  // 给心腹写入机密记忆
  if (typeof NpcMemorySystem !== 'undefined') {
    CY._yq2.advisors.forEach(function(nm) {
      NpcMemorySystem.remember(nm, '【机密】御前议「' + CY._yq2.topic.slice(0,15) + '」——决:' + line.slice(0,30), '重', 8);
    });
  }

  // 泄密判定
  setTimeout(function(){ _yq2_evaluateLeak(); }, 500);
}

async function _yq2_evaluateLeak() {
  var advisors = CY._yq2.advisors;
  if (!advisors.length) return _yq2_finalEnd();
  // 计算平均坦白度（反向——坦白度低者其实更可能揣摩圣意而非坦白，但坦白度高也意味他说得更真，更可能激动泄密）
  // 更准确：按忠诚+deceit判定
  var totalRisk = 0;
  advisors.forEach(function(nm) {
    var ch = findCharByName(nm);
    if (!ch) return;
    var tids = (ch.traits||[]).concat(ch.traitIds||[]);
    var risk = Math.max(0, 100 - (ch.loyalty||50));
    if (tids.indexOf('deceitful') >= 0) risk += 15;
    if (tids.indexOf('gregarious') >= 0) risk += 10; // 话多
    if ((ch.ambition||40) > 70) risk += 10;
    if ((ch.stress||0) > 70) risk += 5;
    totalRisk += risk;
  });
  var avgRisk = totalRisk / advisors.length;
  var leakProb = (avgRisk / 100) * (CY._yq2.record === 'secret' ? 0.5 : 1.2); // 不录反而减小（大家自觉保密）
  // 玩家可以看到的风险提示
  var riskLevel = avgRisk > 60 ? '高' : avgRisk > 35 ? '中' : '低';
  addCYBubble('内侍', '（密议既散。' + (CY._yq2.record === 'secret' ? '不录起居注。' : '已录入起居注。') + ' 泄密风险：' + riskLevel + '。）', true);
  CY._yq2.leakRisk = avgRisk;

  var actuallyLeaks = Math.random() < (leakProb * 0.4); // 实际泄密概率较低
  if (actuallyLeaks && P.ai && P.ai.key) {
    // AI 决定谁泄密、怎么泄
    var prompt = '御前密议结束。议题：' + CY._yq2.topic + '\n';
    prompt += '与会者：' + advisors.join('、') + '\n';
    prompt += '议事结论：' + (CY._yq2.decision && (CY._yq2.decision.mode||'') + (CY._yq2.decision.custom||'')) + '\n';
    prompt += '判定：此次议事已发生泄密。选一人作为泄密者（最可能的），描述泄密方式与严重程度。\n';
    prompt += '返回 JSON：{"leaker":"人名","channel":"枕边风/门生告密/酒后失言/密书外传","severity":"light轻/moderate中/severe重","knownTo":["外界得知者"],"consequence":"后续影响"}';
    try {
      var raw = await callAI(prompt, 500);
      var obj = (typeof extractJSON === 'function') ? extractJSON(raw) : null;
      if (obj && obj.leaker) {
        addCYBubble('内侍', '（机密外泄——' + obj.leaker + ' 经 ' + obj.channel + ' 传出。）', true);
        if (typeof addEB === 'function') addEB('机密', '御前密议外泄：' + obj.leaker);
        // 若之前密议选择"不录"，此时反而入纪事（丑闻）
        if (CY._yq2.record === 'secret') {
          _cy_jishiAdd('yuqian', CY._yq2.topic, obj.leaker, '【泄密】' + (obj.channel||'') + '：' + (obj.consequence||''), { secret: true, leaked: true });
        }
        if (typeof NpcMemorySystem !== 'undefined' && Array.isArray(obj.knownTo)) {
          obj.knownTo.forEach(function(n){
            NpcMemorySystem.remember(n, '获悉御前密议「' + CY._yq2.topic.slice(0,15) + '」内情', '重', 7);
          });
        }
      }
    } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-chaoyi-keju');}catch(_){}}
  }

  setTimeout(_yq2_finalEnd, 800);
}

function _yq2_finalEnd() {
  var footer = _$('cy-footer');
  footer.innerHTML = '<div style="text-align:center;"><button class="bt bp" onclick="_yq2_doCloseSession()">退</button></div>';
}

function _yq2_doCloseSession() {
  CY._yq2 = null;
  if (typeof closeChaoyi === 'function') closeChaoyi();
}

function _yq2_globalFooter() {
  return '<div style="margin-top:var(--space-2);padding-top:var(--space-2);border-top:1px solid var(--color-border-subtle);display:flex;gap:3px;justify-content:center;flex-wrap:wrap;">'
    + _cy_suggestBtnHtml('御前会议')
    + '</div>';
}

// R112 显式暴露 advanceKejuByDays (被 tm-keju.js 和 tm-endturn-core.js 引用)
if (typeof window !== 'undefined') window.advanceKejuByDays = advanceKejuByDays;
