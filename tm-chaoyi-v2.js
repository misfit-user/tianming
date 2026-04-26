// @ts-check
/// <reference path="types.d.ts" />
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

// ⚠️ DEPRECATED v2 §1·常朝 v2 已被 tm-chaoyi-v3.js 替代（USE_CC3 默认 true）。
// ⚠️ v2 §1 常朝 UI/动作已物理删除（替代为 tm-chaoyi-v3.js·USE_CC3 默认 true）
// 仅保留 _cc2_buildAgendaPrompt + _cc2_fallbackAgenda 两个 prompt 函数·v3 _cc3_buildAgendaFromGM 仍调用
// 备份：tm-chaoyi-v2.js.bak（迁移完成长期稳定后可清·见 CHANGCHAO_MIGRATION_MAP.md §5）
// ============================================================

// ─── v2 §1 仅保留：议程 prompt（v3 复用） ───

function _cc2_buildAgendaPrompt() {
  var p = '你是常朝议程编撰官。请为今日常朝后台生成 5-9 条奏报事务（玩家暂不可见，将按顺序一条一条登场）。\n';
  p += '当前：' + (typeof getTSText==='function'?getTSText(GM.turn):'T'+GM.turn) + '\n';
  if (GM.currentIssues) {
    var _pi = GM.currentIssues.filter(function(i){return i.status==='pending';}).slice(0,5);
    if (_pi.length) p += '【待处理时政——须出现在议程】\n' + _pi.map(function(i){return '  '+i.title+'：'+(i.description||'').slice(0,50);}).join('\n') + '\n';
  }
  var _at = (CY && CY._cc2 && CY._cc2.attendees) || [];
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

// ─── 议程兜底：AI 调用失败/返回空时·从时政要务派生最小议程·让朝会能跑完 ───
function _cc2_fallbackAgenda() {
  var items = [];
  var pending = (GM.currentIssues || []).filter(function(i){return i.status==='pending';}).slice(0, 3);
  pending.forEach(function(iss) {
    items.push({
      presenter: '某部官员',
      dept: iss.dept || '六部',
      type: 'routine',
      urgency: 'normal',
      title: (iss.title || '时政要议').slice(0, 10),
      announceLine: '臣有一事启奏。',
      content: iss.description || (iss.title || '事宜需陛下圣裁'),
      controversial: 3,
      importance: 5,
      _fallback: true
    });
  });
  if (items.length === 0) {
    items.push({
      presenter: '内侍',
      dept: '内廷',
      type: 'routine',
      urgency: 'normal',
      title: '日常无事',
      announceLine: '今日并无紧要奏报。',
      content: '百官今日并无紧要事务奏闻陛下。',
      controversial: 0,
      importance: 1,
      _fallback: true
    });
  }
  return items;
}

// ─── 以下 §2 廷议 v2 + §3 御前 v2·USE_CC3 不影响·继续生效 ───

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
  // 收集本场廷议全部发言+玩家插言·待 phase14 写入 recentChaoyi 注入推演
  if (!Array.isArray(CY._ty2._allSpeeches)) CY._ty2._allSpeeches = [];
  if (!Array.isArray(CY._ty2._playerInterjects)) CY._ty2._playerInterjects = [];
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
        CY._ty2._playerInterjects.push({ round: _rd, text: _pl });
        try { await _ty2_playerTriggeredResponse(_pl); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-chaoyi-keju');}catch(_){}}
      }
      var nm = CY._ty2.attendees[i];
      var res = await _ty2_genOneSpeech(nm, _rd, _prevSpeeches);
      if (res) {
        _prevSpeeches.push({ name: nm, stance: res.stance, line: res.line });
        // 镜像收集到 CY._ty2._allSpeeches·后续 phase14 取用
        CY._ty2._allSpeeches.push({ round: _rd, name: nm, stance: res.stance, line: (res.line || '').slice(0, 80) });
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
  prompt += '  党派：' + (ch && ch.party || '无') + '｜势力：' + (ch && ch.faction || '?') + '｜家族：' + (ch && ch.family || '?') + '\n';
  prompt += '  数值：忠' + ((ch && ch.loyalty)||50) + '｜野' + ((ch && ch.ambition)||40) + '｜名望' + ((ch && ch.prestige)||50) + '｜恩眷' + ((ch && ch.favor)||0) + '\n';
  prompt += '  学识：' + (ch && ch.learning || '') + '\n';
  // 出身/经历(背景信息)
  if (ch && ch.background) prompt += '  生平：' + String(ch.background).slice(0, 120) + '\n';
  // 情节弧·若有当前 arc
  if (ch && ch.arc && ch.arc.title) prompt += '  当下处境：' + ch.arc.title + (ch.arc.stage ? '·阶段「' + ch.arc.stage + '」' : '') + '\n';
  // 近期记忆(扩到 5 条)
  var _memList = (ch && ch._memory || []).slice(-5).map(function(m){return (m.event||'').slice(0,40);});
  prompt += '  近期记忆：' + (_memList.join('；') || '无') + '\n';
  // 党派立场+焦点争议·让 NPC 发言契合其党派纲领
  if (ch && ch.party) {
    var _partyObj = (typeof GM !== 'undefined' && Array.isArray(GM.parties))
      ? GM.parties.find(function(p){return p && p.name === ch.party;}) : null;
    if (_partyObj) {
      var _ps = (_partyObj.policyStance || []).slice(0, 5).join('·');
      if (_ps) prompt += '  本党(' + ch.party + ')立场：' + _ps + '\n';
      var _fd = (_partyObj.focal_disputes || []).filter(function(d){return d && d.topic;}).slice(0, 3);
      if (_fd.length) {
        prompt += '  本党焦点争议：' + _fd.map(function(d){
          return d.topic + (d.rival ? '(与'+d.rival+'相争)' : '') + (d.stake || d.stakes ? '·' + (d.stake||d.stakes) : '');
        }).join('；') + '\n';
      }
    }
  }
  // 跨对话上下文·近 3 条对话历史
  try {
    var _dh = (typeof GM !== 'undefined' && GM.dialogueHistory && GM.dialogueHistory[name]) || [];
    if (_dh.length) {
      var _last = _dh.slice(-3).map(function(d){
        return '【' + (d.scene || d.context || '?') + '】' + (d.summary || (d.line||'').slice(0, 30));
      }).join('；');
      prompt += '  近期言行：' + _last + '\n';
    }
  } catch(_dhE){}
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
  } catch(_e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_e, 'tinyi] 经济改革回调失败:') : console.error('[tinyi] 经济改革回调失败:', _e); }

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
