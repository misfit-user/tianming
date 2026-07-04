// @ts-check
/* ═══════════════════════════════════════════════════════════════════════
 *  tm-keju-runtime-keyi.js — 科举·〔科议〕专属朝议+守恒上行流（2026-07-04 立项拆分·自 tm-keju-runtime.js 保序切出）
 *  内容：KEYI_STATE 状态机/科议全流程/G1+G2 finalize 三甲纳入+填缺+阶层党派吏治影响/守恒上行流
 *  注：window.* 暴露与 SettlementPipeline.register 等装载期语句随本文件在原位置照跑（after-sibling 保序）
 *  加载序：index.html 中紧挨 tm-keju-runtime.js 之后——执行顺序与拆分前逐字节等价·勿改
 * ═══════════════════════════════════════════════════════════════════════ */

// ══════════════════════════════════════════════════════════════════
// v5·〔科议〕科举专属朝议·参照廷议·全体在京文官参议
// ══════════════════════════════════════════════════════════════════

var KEYI_STATE = null;  // { attendees, speakers, round, phase:'discuss'|'vote'|'decide', speeches, stances, support, abort }

function _keyiGetActiveProposal() {
  return (KEYI_STATE && KEYI_STATE._pendingProposal) || (GM.keju && GM.keju._pendingProposal) || null;
}

function _keyiTopicTitle(pending, fallback) {
  var t = (pending && pending.topic) || fallback || '\u7B79\u529E\u79D1\u4E3E\u516C\u8BAE';
  return String(t).replace(/^\u8BAE\u00B7?/, '');
}

function _keyiTopicSubject(pending) {
  var topicType = (pending && pending.topicType) || 'kaike';
  if (topicType === 'reform') return '\u79D1\u4E3E\u6539\u9769';
  if (topicType === 'kaike') return '\u79D1\u4E3E\u7B79\u529E';
  return _keyiTopicTitle(pending, '\u79D1\u8BAE\u8BAE\u9898');
}

function _keyiMethodLabels(topicType) {
  if (topicType === 'reform') {
    return { council:'\u4F9D\u8BAE\u63A8\u884C\u6539\u9769', edict:'\u4E0B\u8BCF\u5F3A\u63A8\u6539\u9769', defy:'\u9006\u4F17\u8BAE\u5F3A\u63A8\u6539\u9769' };
  }
  return { council:'\u4F9D\u8BAE\u5F00\u79D1', edict:'\u4E0B\u8BCF\u5F3A\u63A8', defy:'\u9006\u4F17\u8BAE\u5F3A\u63A8' };
}

function _keyiDecisionContent(method, topicType) {
  if (topicType === 'reform') {
    if (method === 'council') return '\u4F9D\u8BAE\u63A8\u884C\u79D1\u4E3E\u6539\u9769\u00B7\u541B\u81E3\u5171\u8BAE';
    if (method === 'edict') return '\u4E0D\u987E\u8BAE\u51B3\u00B7\u4E0B\u8BCF\u5F3A\u63A8\u79D1\u4E3E\u6539\u9769';
    if (method === 'defy') return '\u9006\u4F17\u8BAE\u5F3A\u63A8\u00B7\u72EC\u65AD\u6539\u5236';
  }
  if (method === 'council') return '\u4F9D\u8BAE\u5F00\u79D1\u4E3E\u00B7\u541B\u81E3\u5171\u8BDB';
  if (method === 'edict') return '\u4E0D\u987E\u8BAE\u51B3\u00B7\u4E0B\u8BCF\u5F3A\u63A8\u79D1\u4E3E';
  if (method === 'defy') return '\u9006\u4F17\u8BAE\u5F3A\u63A8\u00B7\u72EC\u65AD\u5F00\u79D1';
  return '';
}

/** 入口：打开科议（v2·自动邀请·无选人页） */
function openKeyiSession(opts) {
  // v7.1·B3·接参化·支持 9 议题路由·不传 opts 时 fallback 走 kaike (向后兼容)
  opts = opts || {};
  var topicType = opts.topicType || 'kaike';
  var topicData = opts.topicData || {};
  var resolved = (typeof _kjResolveTopic === 'function')
    ? _kjResolveTopic(topicType, topicData)
    : { topicType: 'kaike', title: '筹办科举', shortLabel: '科议·筹办', threshold: 0.5, callback: null, callbackName: 'startKejuByMethod', sliceOwner: 'B3' };

  if (!GM.keju) GM.keju = {};
  var pendingProposal = {
    proposalId: 'keyi_' + (GM.turn || 0) + '_' + Date.now() + '_' + Math.floor(Math.random() * 100000),
    topic: resolved.title,
    topicType: resolved.topicType,
    topicData: topicData,
    threshold: resolved.threshold,
    callbackName: resolved.callbackName,
    sliceOwner: resolved.sliceOwner,
    proposedTurn: GM.turn,
    resolved: false
  };

  var _keyiPlayerFaction = (typeof _cc3_resolvePlayerFaction === 'function')
    ? _cc3_resolvePlayerFaction()
    : ((P.playerInfo && P.playerInfo.factionName) || '');
  var _keyiOfficialWhitelist = /尚书|侍郎|侍读|侍讲|学士|大学士|首辅|次辅|阁臣|内阁|巡抚|总督|提督|经略|督师|总兵|副将|参将|游击|守备|千户|百户|指挥使|指挥同知|指挥佥事|都督|都指挥|京卫|锦衣卫|御史|给事中|都察|科道|道御史|寺卿|少卿|寺丞|郎中|员外郎|主事|中书|翰林|通政|光禄|鸿胪|太仆|太常|太医院|太学|国子祭酒|博士|监正|监副|主簿|府尹|知府|同知|通判|推官|知州|知县|布政|参政|参议|按察|学政|提学|盐运|府丞|司礼|秉笔|掌印|总管|提督东厂|提督西厂|提督内官|镇守|戍守|经制|提刑|按抚|宣慰|宣抚|安抚使|大行|侍中|常侍|内臣|少傅|少保|少师|太傅|太保|太师/;
  var attendees = (GM.chars || []).filter(function(c){
    if (!c || c.alive === false || c.isPlayer) return false;
    if (typeof _cc3_isOwnFaction === 'function') {
      if (!_cc3_isOwnFaction(c, _keyiPlayerFaction)) return false;
    } else if (_keyiPlayerFaction && c.faction && c.faction !== _keyiPlayerFaction) {
      return false;
    }
    if (typeof _cc3_isCourtOfficial === 'function') {
      if (!_cc3_isCourtOfficial(c)) return false;
    } else {
      if (c.spouse) return false;
      var role = c.role || '';
      if (/\u540E|\u5983|\u5AD4|\u8D35\u4EBA|\u592A\u540E|\u592A\u5983|\u516C\u4E3B|\u90E1\u4E3B|\u592A\u76D1|\u5B66\u751F/.test(role)) return false;
      var t = (c.officialTitle || c.title || '');
      if (!t) return false;
      if (/\u7687\u540E|\u8D35\u5983|\u8D24\u5983|\u6DD1\u5983|\u5BB8\u5983|\u5AAC\u5983|\u5BB9\u534E|\u5145\u4EAA|\u592A\u540E|\u592A\u5983|\u516C\u4E3B|\u90E1\u4E3B|\u592A\u76D1|\u76D1\u751F$|\u79C0\u624D$|\u4E3E\u4EBA$|\u751F\u5458$|\u7AE5\u751F|\u5EB6\u5409\u58EB$|\u5E73\u6C11|\u5E03\u8863|\u8349\u6C11|\u5EB6\u4EBA|\u767E\u59D3|\u4F7F\u8282|\u5916\u4F7F|\u5546\u9986|\u6B96\u6C11/.test(t)) return false;
      if (!_keyiOfficialWhitelist.test(t)) return false;
    }
    if (typeof _cc3_classifyAbsent === 'function') {
      if (_cc3_classifyAbsent(c)) return false;
    } else {
      if (typeof _isAtCapital === 'function' && !_isAtCapital(c)) return false;
      if (c._imprisoned || c.imprisoned || c._inJail || c._jailed) return false;
      if (c._exiled || c._banished || c._retired || c._zhi_shi) return false;
      if (c._mourning || c._inMourning || c._fled || c._missing) return false;
      if (typeof c.health === 'number' && c.health <= 10) return false;
      if (c._sickLeave || c._sick || c._punished || c._restricted || c._reflecting) return false;
    }
    return true;
  });
  if (attendees.length < 3) { toast('\u4EAC\u4E2D\u5B98\u5458\u4E0D\u8DB3\u4E09\u4EBA\u00B7\u65E0\u6CD5\u5F00\u79D1\u8BAE'); return; }

  // 弹确认窗·不再挑人
  if (!confirm('\u5F00\u79D1\u8BAE\uFF1F\n\u5C06\u53EC\u96C6 ' + attendees.length + ' \u540D\u5728\u4EAC\u5B98\u5458\u8BAE\u300C' + _keyiTopicTitle(pendingProposal, '\u79D1\u8BAE\u8BAE\u9898') + '\u300D\u00B7\u8017\u7CBE\u529B 15\u3002')) return;
  if (typeof _spendEnergy === 'function' && !_spendEnergy(15, '\u79D1\u8BAE')) { toast('\u7CBE\u529B\u4E0D\u8DB3'); return; }
  GM.keju._pendingProposal = pendingProposal;

  KEYI_STATE = {
    attendees: attendees.map(function(c){ return { name: c.name, title: c.officialTitle || c.title || '', party: c.party || '', loyalty: c.loyalty || 50, _ch: c }; }),
    speakers: [],
    round: 0,
    totalRounds: 2,
    phase: 'discuss',  // discuss → vote → decide
    speeches: [],
    stances: {},
    support: 0,
    abort: false,
    _discussDone: false,
    _pendingProposal: pendingProposal,
    _topicType: resolved.topicType,
    _topicData: topicData,
    _topicTitle: resolved.title,
    _topicThreshold: resolved.threshold,
    _callbackName: resolved.callbackName,
    playerStance: null,
    playerSpeeches: []
  };

  // 挑发言人（v4·立场均衡）：礼部尚书 + 支持/反对/观望各至少 1 人 + 高智填充
  // 先预推每人立场
  KEYI_STATE.attendees.forEach(function(a){ a._prevStance = _keyiInferStance(a); });
  var libuIdx = KEYI_STATE.attendees.findIndex(function(a){ return (a.title||'').indexOf('\u793C\u90E8\u5C1A\u4E66')>=0; });
  var speakers = [];
  var picked = {};
  if (libuIdx >= 0) { speakers.push(KEYI_STATE.attendees[libuIdx]); picked[KEYI_STATE.attendees[libuIdx].name] = true; }

  function _scoreOf(a){ return ((a._ch && a._ch.intelligence)||0) + (a.loyalty||0)/2 + (a._ch && a._ch.ambition||0)/3; }
  function _pickBestByStance(stance, max){
    var cands = KEYI_STATE.attendees
      .filter(function(a){ return !picked[a.name] && a._prevStance === stance; })
      .sort(function(x,y){ return _scoreOf(y) - _scoreOf(x); });
    var n = 0;
    for (var i=0; i<cands.length && n<max; i++) { speakers.push(cands[i]); picked[cands[i].name] = true; n++; }
  }
  // 每种立场至少 1 人·反对至多 2 人·支持至多 2 人·观望 1 人
  _pickBestByStance('oppose', 2);
  _pickBestByStance('support', 2);
  _pickBestByStance('abstain', 1);
  // 不足 6 人·按综合分补齐
  var remain = KEYI_STATE.attendees
    .filter(function(a){ return !picked[a.name]; })
    .sort(function(x,y){ return _scoreOf(y) - _scoreOf(x); });
  for (var k=0; k<remain.length && speakers.length<6; k++) { speakers.push(remain[k]); picked[remain[k].name] = true; }
  KEYI_STATE.speakers = speakers.slice(0, 6);
  KEYI_STATE.round = 1;

  _renderKeyiModal();
  // v3·立刻自动跑两轮流式讨论
  _keyiRunBothRounds();
}

/** 创建 modal 容器 */
function _renderKeyiModal() {
  var existing = document.getElementById('keyi-modal'); if (existing) existing.remove();
  var modal = document.createElement('div');
  modal.className = 'modal-bg show';
  modal.id = 'keyi-modal';
  modal.innerHTML =
    '<div style="background:var(--bg-1);border:1px solid var(--gold-d);border-radius:12px;width:90%;max-width:880px;max-height:86vh;display:flex;flex-direction:column;overflow:hidden;">'+
      '<div style="padding:0.7rem 1.2rem;border-bottom:1px solid var(--bdr);display:flex;justify-content:space-between;align-items:center;">'+
        '<div style="font-size:1.05rem;font-weight:700;color:var(--gold);letter-spacing:0.08em;">\u3014 \u79D1 \u8BAE \u3015\u00B7' + _keyiTopicTitle(_keyiGetActiveProposal(), '\u7B79\u529E\u79D1\u4E3E\u516C\u8BAE') + '</div>'+
        '<button class="bt bs bsm" onclick="closeKeyi()">\u2715</button>'+
      '</div>'+
      '<div id="keyi-body" style="flex:1;overflow-y:auto;padding:1rem 1.2rem;"></div>'+
      '<div id="keyi-footer" style="padding:0.6rem 1rem;border-top:1px solid var(--bdr);"></div>'+
    '</div>';
  document.body.appendChild(modal);
  _keyiRender();
}

/** 根据 phase 分派渲染 */
function _keyiRender() {
  var body = _$('keyi-body'); var footer = _$('keyi-footer');
  if (!body) return;
  if (!KEYI_STATE) return;
  if (KEYI_STATE.phase === 'discuss') _keyiRenderDiscuss(body, footer);
  else if (KEYI_STATE.phase === 'vote') _keyiRenderVote(body, footer);
  else if (KEYI_STATE.phase === 'decide') _keyiRenderDecide(body, footer);
}

/** 发言阶段 UI（v4·初始2轮自动·后续可再议无上限·玩家插言影响倾向） */
function _keyiRenderDiscuss(body, footer) {
  var statusTxt = KEYI_STATE._busy
    ? (KEYI_STATE._busyText || '\u8BAE\u8BBA\u4E2D\u2026')
    : (KEYI_STATE._discussDone ? '\u5DF2\u7ECF\u8FC7 ' + KEYI_STATE.round + ' \u8F6E\u8BAE\u8BBA\u00B7\u53EF\u4ED8\u8868\u51B3\u6216\u518D\u8BAE' : '\u8BAE\u8BBA\u8FDB\u884C\u4E2D\u2026');
  var html = '<div style="margin-bottom:0.6rem;">'+
    '<div style="font-weight:700;color:var(--gold);">\u7B2C ' + KEYI_STATE.round + ' \u8F6E\u8BAE\u8BBA</div>'+
    '<div style="font-size:0.72rem;color:var(--txt-d);">\u00B7 ' + KEYI_STATE.speakers.length + ' \u4EBA\u4E0A\u53F0\u9648\u8BCD\u00B7' + KEYI_STATE.attendees.length + ' \u4EBA\u5728\u573A\u8BAE\u4E8B\u00B7' + statusTxt + '</div>'+
    '</div><div id="keyi-chat" style="min-height:220px;">';
  KEYI_STATE.speeches.forEach(function(sp){
    html += _keyiBubbleHtml(sp);
  });
  html += '</div>';
  body.innerHTML = html;

  // v4·始终显示玩家发言框·可多轮辩论·玩家插言即影响后续立场
  var isBusy = !!KEYI_STATE._busy;
  var hint = isBusy
    ? '\u9661\u4E0B\u5982\u6709\u5723\u8C15\u00B7\u8F93\u5165\u540E\u4F17\u81E3\u5373\u9000\u4E0B\u8FD4\u5E94\u2026'
    : '\u9661\u4E0B\u53EF\u968F\u65F6\u63D2\u8A00\u00B7\u5723\u8C15\u4F1A\u5F71\u54CD\u5927\u81E3\u7ACB\u573A\u4E0E\u6700\u7EC8\u8868\u51B3';
  var footerHtml = ''
    + '<div style="display:flex;gap:0.4rem;align-items:stretch;">'
    +   '<textarea id="keyi-player-input" rows="2" placeholder="' + hint + '" style="flex:1;background:var(--bg-2);border:1px solid var(--bdr);border-radius:4px;padding:0.4rem 0.6rem;font-size:0.82rem;color:var(--color-foreground);resize:vertical;"></textarea>'
    +   '<button class="bt bp" style="min-width:72px;" onclick="_keyiPlayerSpeak()">\u5723\u8C15</button>'
    + '</div>';
  if (KEYI_STATE._discussDone && !isBusy) {
    footerHtml += '<div style="display:flex;gap:0.5rem;justify-content:center;margin-top:0.5rem;">'
      + '<button class="bt" onclick="_keyiExtraRound()">\u518D\u8BAE\u4E00\u8F6E</button>'
      + '<button class="bt bp" onclick="_keyiProceedToVote()">\u4ED8\u8868\u51B3</button>'
      + '</div>';
  }
  footer.innerHTML = footerHtml;
  var chat = _$('keyi-chat'); if (chat) chat.scrollTop = chat.scrollHeight;
}

/** 手动再议一轮（v4·无上限·类似廷议） */
async function _keyiExtraRound() {
  if (!KEYI_STATE || KEYI_STATE._busy) return;
  KEYI_STATE.round++;
  KEYI_STATE._discussDone = false;
  _keyiRender();
  await _keyiStreamRound();
  KEYI_STATE._discussDone = true;
  _keyiRender();
}

/** 从玩家圣谕文本推断立场 */
function _keyiInferPlayerStance(text) {
  if (!text) return null;
  var s = text.toLowerCase();
  // 反对类词
  if (/\u4E0D\u53EF|\u4E0D\u8A56|\u4E0D\u7528|\u6682\u7F13|\u505C|\u7F72|\u5EA2|\u4E0D\u7406|\u7F13\u884C|\u4E0D\u8FEB|\u6263\u627F|\u672A\u5FC5|\u6682\u4E0D|\u6697\u6697|\u4E0D\u59A5|\u4E0D\u5B9C/.test(s)) return 'oppose';
  // 支持类词
  if (/\u7740|\u5373\u884C|\u901F|\u4EC7|\u7545|\u5F00|\u8BB8|\u51C6|\u4F9D\u8BAE|\u8D5E|\u540C|\u53EF|\u610F|\u884C|\u8881|\u5F00\u79D1|\u4E3E\u529E|\u601D|\u771F\u597D|\u5584/.test(s)) return 'support';
  return 'abstain'; // 不明显
}

/** 玩家插言·打断当前轮·下一轮 NPC 回应陛下·立场会向陛下靠拢（v4） */
async function _keyiPlayerSpeak() {
  if (!KEYI_STATE) return;
  var inp = _$('keyi-player-input');
  var text = inp && inp.value ? inp.value.trim() : '';
  if (!text) { toast('\u8BF7\u5148\u8F93\u5165\u5723\u8C15'); return; }
  // 推断陛下立场·存入 state·影响后续发言+表决
  var playerStance = _keyiInferPlayerStance(text) || 'support';
  KEYI_STATE.playerStance = playerStance;
  if (!Array.isArray(KEYI_STATE.playerSpeeches)) KEYI_STATE.playerSpeeches = [];
  KEYI_STATE.playerSpeeches.push({ text: text, stance: playerStance, round: KEYI_STATE.round });
  // 打断当前轮
  KEYI_STATE.abort = true;
  KEYI_STATE._interrupted = true;
  // 清掉正在流式的占位气泡（没写完的）
  KEYI_STATE.speeches = KEYI_STATE.speeches.filter(function(sp){ return !sp._streaming; });
  // 推入玩家气泡·立场按推断
  KEYI_STATE.speeches.push({
    name: '\u9661\u4E0B',
    title: '\u5723\u8C15',
    stance: playerStance,
    line: text,
    _isPlayer: true
  });
  if (inp) inp.value = '';
  KEYI_STATE._discussDone = false;
  // 等当前 busy 循环真正退出
  var waitCount = 0;
  while (KEYI_STATE._busy && waitCount < 30) {
    await new Promise(function(r){ setTimeout(r, 100); });
    waitCount++;
  }
  KEYI_STATE.abort = false;
  KEYI_STATE._interrupted = false;
  // 仅跑一轮·让 NPC 回应陛下·玩家可再插言或付表决
  KEYI_STATE.round++;
  _keyiRender();
  await _keyiStreamRound();
  KEYI_STATE._discussDone = true;
  _keyiRender();
}

/** 连续跑两轮·中间无需玩家按键（v3） */
async function _keyiRunBothRounds() {
  if (!KEYI_STATE) return;
  var rounds = KEYI_STATE.totalRounds || 2;
  while (KEYI_STATE.round <= rounds) {
    await _keyiStreamRound();
    if (KEYI_STATE.abort) return; // 被玩家打断
    if (KEYI_STATE.round < rounds) {
      KEYI_STATE.round++;
    } else {
      break;
    }
  }
  KEYI_STATE._discussDone = true;
  _keyiRender();
}

/** 发言气泡 HTML */
function _keyiBubbleHtml(sp) {
  var stance = sp.stance || 'abstain';
  var typeColor = stance==='support' ? 'var(--celadon-400)' : stance==='oppose' ? 'var(--vermillion-400)' : 'var(--ink-300)';
  var typeLbl = stance==='support' ? '\u8D5E\u6210' : stance==='oppose' ? '\u53CD\u5BF9' : '\u89C2\u671B';
  if (sp._isPlayer) {
    return '<div style="background:linear-gradient(135deg,rgba(184,154,83,0.18),rgba(184,154,83,0.05));border:1px solid var(--gold-d);border-radius:10px 3px 10px 10px;padding:0.5rem 0.8rem;margin:6px 0 6px 40px;box-shadow:0 1px 3px rgba(184,154,83,0.25);">'+
      '<div style="font-size:0.72rem;color:var(--gold);"><strong>\u9661\u4E0B</strong> <span style="color:var(--txt-d);">\u00B7 \u5723\u8C15</span></div>'+
      '<div style="font-size:0.82rem;line-height:1.7;margin-top:3px;color:var(--color-foreground);">' + escHtml(sp.line || '') + '</div>'+
      '</div>';
  }
  return '<div style="background:var(--bg-3);border:1px solid var(--bdr);border-radius:3px 10px 10px 10px;padding:0.5rem 0.8rem;margin-bottom:6px;"' + (sp._streamId ? ' id="'+sp._streamId+'"' : '') + '>'+
    '<div style="font-size:0.72rem;color:var(--gold);"><strong>' + escHtml(sp.name) + '</strong>' +
    ' <span style="color:var(--txt-d);">\u00B7 ' + escHtml(sp.title||'') + '</span>' +
    (sp._streaming ? '' : ' <span style="color:'+typeColor+';">\u3014'+typeLbl+'\u3015</span>') + '</div>'+
    '<div class="keyi-bubble-text" style="font-size:0.82rem;line-height:1.7;margin-top:3px;color:var(--color-foreground);">' + escHtml(sp.line || '\u2026') + '</div>'+
    '</div>';
}

/** 流式跑一轮发言（v2·逐人流式·对齐廷议） */
async function _keyiStreamRound() {
  if (!KEYI_STATE) return;
  if (!P.ai || !P.ai.key) {
    // 无 AI·按算式模拟立场
    KEYI_STATE.speakers.forEach(function(s){
      var pro = _keyiInferStance(s);
      KEYI_STATE.speeches.push({ name: s.name, title: s.title, stance: pro, line: '(\u672A\u914D AI\u00B7\u6309\u7B97\u5F0F\u7ACB\u573A)' });
    });
    _keyiRender();
    return;
  }
  KEYI_STATE._busy = true;
  _keyiRender();
  var era = (P.dynasty || P.era || '');
  var year = GM.year || (P.time && P.time.year) || 1600;
  var guoku = Math.round(((GM.guoku && GM.guoku.money) || 0) / 10000);
  var wars = (GM.activeWars||[]).length;
  var lastExam = P.keju.lastExamDate ? (P.keju.lastExamDate.year + '\u5E74') : '\u4ECE\u672A\u4E3E\u529E';
  var ctxBase = '\u3010\u79D1\u8BAE\u80CC\u666F\u3011' + era + year + '\u5E74\u00B7\u5F00\u79D1\u4E3E\u8BAE\u00B7\u5E11\u5EAA ' + guoku + ' \u4E07\u00B7\u6218\u4E8B ' + wars + ' \u5904\u00B7\u4E0A\u79D1 ' + lastExam + '\u3002';

  for (var i=0; i<KEYI_STATE.speakers.length; i++) {
    if (KEYI_STATE.abort) break;
    var s = KEYI_STATE.speakers[i];
    var ch = s._ch || findCharByName(s.name);
    KEYI_STATE._busyText = s.name + ' \u5EAD\u524D\u9648\u8A00\u00B7\u7B2C ' + KEYI_STATE.round + ' \u8F6E';

    // 先 push 占位 speech
    var streamId = 'keyi-stream-' + Date.now() + '-' + i;
    var placeholder = { name: s.name, title: s.title, stance: 'abstain', line: '\u2026', _streamId: streamId, _streaming: true };
    KEYI_STATE.speeches.push(placeholder);
    _keyiRender();

    var prev = KEYI_STATE.speeches.slice(-8, -1).map(function(x){
      var who = x._isPlayer ? '\u9661\u4E0B(\u5723\u8C15)' : x.name;
      return who + '[' + (x.stance||'') + ']\uFF1A' + (x.line||'').slice(0,60);
    }).join('\n');
    var hasPlayerRecent = KEYI_STATE.speeches.slice(-6).some(function(x){ return x._isPlayer; });

    // L4\u00B7d\u00B7\u6309 topicType \u6D3E topicLabel + \u6CE8\u5165 reform topicData
    var _activeProposal = _keyiGetActiveProposal();
    var _topicType = (_activeProposal && _activeProposal.topicType) || 'kaike';
    var _topicData = (_activeProposal && _activeProposal.topicData) || {};
    var _topicLabel = (typeof _kjGetTopicShortLabel === 'function')
      ? _kjGetTopicShortLabel(_topicType) || '\u5F00\u79D1\u4E3E'
      : '\u5F00\u79D1\u4E3E';
    var _reformInjection = '';
    if (_topicType === 'reform' && typeof _ty3_appendReformPromptIfReform === 'function') {
      _reformInjection = _ty3_appendReformPromptIfReform('', _topicData);
    }
    var _privateAudienceHint = '';
    if (_topicType === 'reform' && typeof _kjpAppendPrivateAudienceHint === 'function') {
      _privateAudienceHint = _kjpAppendPrivateAudienceHint('', ch, _topicData);
    }
    var _ownCeduiHint = '';
    if (_topicType === 'reform' && typeof _kjpAppendOwnCeduiHint === 'function') {
      _ownCeduiHint = _kjpAppendOwnCeduiHint('', ch, _topicData);
    }
    // L5\u00B7c\u00B7NPC \u8BAE\u653F\u4E2D\u53E3\u8FF0 quote from \u81EA\u5DF1\u5199\u7684\u6539\u9769\u53CD\u5BF9\u594F\u758F\u00B7\u771F"\u6F14"\u53CD\u5BF9
    var _ownObjectionHint = '';
    if (_topicType === 'reform' && typeof _kjpAppendOwnObjectionMemorialHint === 'function') {
      _ownObjectionHint = _kjpAppendOwnObjectionMemorialHint('', ch, _topicData);
    }

    var prompt = ctxBase + '\n' +
      '\u4F60\u662F\u4E0A\u671D\u5EAD\u8BAE\u7684\u5927\u81E3 ' + s.name + '\uFF08' + (s.title||'') + '\uFF09\u3002\n' +
      '\u6027\u683C\uFF1A' + ((ch&&ch.personality)||'').slice(0,30) + '\n' +
      '\u5FE0\u8BDA ' + (s.loyalty||50) + '\u3001\u515A\u6D3E ' + (s.party||'\u65E0\u515A') + '\u3001\u8EAB\u4EFD ' + (ch && ch.class || '') + '\n' +
      _reformInjection + _privateAudienceHint + _ownCeduiHint + _ownObjectionHint +
      (prev ? '\u5DF2\u53D1\u8A00\uFF1A\n' + prev + '\n' : '') +
      (hasPlayerRecent ? '\u2605 \u9661\u4E0B\u521A\u521A\u9F99\u97F3\u5F00\u53E3\u00B7\u4F60\u5FC5\u987B\u606D\u656C\u56DE\u5E94\u5723\u8C15\u00B7\u53EF\u5927\u7EB2\u987A\u5723\u610F\u4E5F\u53EF\u59D4\u5A49\u9648\u8BF4\u96BE\u5904\uFF08\u4F46\u9700\u4FDD\u6301\u81EA\u5DF1\u672C\u6765\u7684\u515A\u6D3E\u7ACB\u573A\uFF09\u3002\n' : '') +
      '\u8BF7\u5C31\u300C' + _topicLabel + '\u300D\u7ACB\u573A\u53D1\u8868 80-160 \u5B57\u534A\u6587\u8A00\u5EAD\u8BAE\u3002\n' +
      '\u683C\u5F0F\uFF1A\u7B2C\u4E00\u884C\u4EC5\u8F93\u51FA\u7ACB\u573A\u6807\u8BB0 support\u3001oppose \u6216 abstain \u4E09\u8BCD\u4E4B\u4E00\u3002\u4ECE\u7B2C\u4E8C\u884C\u8D77\u8F93\u51FA\u53D1\u8A00\u6B63\u6587\u3002';

    var tokens = 800;
    var bubble = _$(streamId); var txt = bubble ? bubble.querySelector('.keyi-bubble-text') : null;
    var full = '';
    var _keyiTier = (typeof _useSecondaryTier === 'function' && _useSecondaryTier()) ? 'secondary' : undefined;
    try {
      if (typeof callAIMessagesStream === 'function') {
        full = await callAIMessagesStream(
          [{ role: 'user', content: prompt }], tokens,
          {
            tier: _keyiTier,
            onChunk: function(t){
              if (!txt) return;
              // 解析第一行 stance
              var lines = (t||'').split(/\r?\n/);
              var firstLine = (lines[0]||'').trim().toLowerCase();
              var body = lines.slice(1).join('\n').trim() || t;
              txt.textContent = body;
              var chat = _$('keyi-chat'); if (chat) chat.scrollTop = chat.scrollHeight;
            }
          }
        );
      } else {
        full = await callAISmart(prompt, tokens, { maxRetries: 1, tier: _keyiTier });
      }
    } catch(e) {
      console.warn('[\u79D1\u8BAE\u6D41\u5F0F] \u53D1\u8A00\u5931\u8D25', s.name, e);
      full = '';
    }

    // 解析最终
    var _lines = (full || '').split(/\r?\n/);
    var _firstRaw = (_lines[0]||'').trim().toLowerCase().replace(/[^a-z]/g, '');
    var _stance = 'abstain';
    if (/support|\u8D5E|\u540C/.test(_firstRaw) || _firstRaw === 'support') _stance = 'support';
    else if (/oppose|\u53CD|\u4E0D/.test(_firstRaw) || _firstRaw === 'oppose') _stance = 'oppose';
    else if (/abstain|\u89C2/.test(_firstRaw) || _firstRaw === 'abstain') _stance = 'abstain';
    var _body = _lines.slice(1).join('\n').trim();
    if (!_body) _body = full || '\uFF08\u6C89\u9ED8\uFF09';

    // 更新占位 speech
    placeholder.stance = _stance;
    placeholder.line = _body;
    placeholder._streaming = false;
    delete placeholder._streamId;
    _keyiRender();
  }

  KEYI_STATE._busy = false;
  KEYI_STATE._busyText = '';
  _keyiRender();
}

/** 再议一轮（v2·流式） */
async function _keyiNextRound() {
  if (!KEYI_STATE || KEYI_STATE._busy) return;
  if (KEYI_STATE.round >= 2) { toast('\u5DF2\u8BAE\u4E24\u8F6E'); return; }
  KEYI_STATE.round++;
  await _keyiStreamRound();
}

/** 算式推断立场（无 AI 时·或 AI 失败时兜底·陛下圣谕会拉偏忠臣） */
function _keyiInferStance(a) {
  var ch = a._ch || findCharByName(a.name);
  var loy = a.loyalty || 50;
  var pro = (loy - 50) * 0.5;
  if (ch) {
    if (ch.class === '\u58EB\u65CF') pro += 15;
    if (ch.class === '\u5BD2\u95E8') pro += 10;
    if (/\u6587|\u5112|\u5B66|\u6E05\u6D41/.test((ch.personality||'') + (ch.officialTitle||'') + (ch.title||''))) pro += 10;
  }
  // 礼部/吏部/国子监·天然支持
  if (/\u793C\u90E8|\u56FD\u5B50\u76D1|\u5B66\u653F/.test(a.title||'')) pro += 20;
  // 武将/军头 → 观望（非反对）
  if (/\u5C06\u519B|\u603B\u5175|\u6307\u6325|\u603B\u7763/.test(a.title||'')) pro -= 5;
  // 帑廪空 → 反对（要花钱）
  var guoku = (GM.guoku && GM.guoku.money) || 0;
  if (guoku < 100000) pro -= 12;
  // 战事多 → 反对（资源倾斜）
  if ((GM.activeWars||[]).length >= 3) pro -= 8;
  // 陛下圣谕拉拽·按忠诚加权（忠臣跟得紧·佞臣随风倒·权臣可能逆天）
  if (KEYI_STATE && KEYI_STATE.playerStance) {
    var dir = KEYI_STATE.playerStance === 'support' ? 1 : KEYI_STATE.playerStance === 'oppose' ? -1 : 0;
    if (dir !== 0) {
      var pullStrength = (loy - 30) * 0.7; // 忠30以上被拉·以下反拉
      if (ch && ch.ambition > 70 && loy < 50) pullStrength *= -0.5; // 权臣/野心家可能逆圣意
      pro += dir * pullStrength;
    }
  }
  // 随机扰动
  pro += (Math.random() - 0.5) * 10;
  if (pro > 12) return 'support';
  if (pro < -12) return 'oppose';
  return 'abstain';
}

/** 进入表决（v3·显式进度条·完成后停留在 vote 页·等用户点继续进 decide） */
async function _keyiProceedToVote() {
  if (!KEYI_STATE) return;
  KEYI_STATE.phase = 'vote';
  KEYI_STATE._voteDone = false;
  KEYI_STATE._voteProgress = 0;
  _keyiRender();
  // 视觉进度条·异步推进到 90%·AI 返回后归 100%
  var progTicker = setInterval(function(){
    if (!KEYI_STATE) { clearInterval(progTicker); return; }
    if (KEYI_STATE._voteProgress < 90) {
      KEYI_STATE._voteProgress = Math.min(90, (KEYI_STATE._voteProgress||0) + 4 + Math.random()*5);
      _keyiRender();
    }
  }, 260);
  try {
    await _keyiGenAllStances();
  } catch(e) {
    console.warn('[\u79D1\u8BAE] \u8868\u51B3 AI \u5931\u8D25', e);
  }
  clearInterval(progTicker);
  KEYI_STATE._voteProgress = 100;
  KEYI_STATE._voteDone = true;
  _keyiRender();
}

/** AI 一次性生成所有参议大臣的立场 */
async function _keyiGenAllStances() {
  // v7·单向不变量：讨论中出现过的立场集合·才能作为最终表决立场
  //   · 若讨论无反对 → AI 就算想给某人 oppose 也降级为 abstain
  //   · AI 精修仍执行（给未发言者细腻立场 + 理由）
  if (!KEYI_STATE) return;
  KEYI_STATE.stances = {};

  // Step 1: 收集 speeches 里的立场集合
  var speechStanceMap = {};
  var seenStances = {};
  KEYI_STATE.speeches.forEach(function(sp){
    if (sp._isPlayer) return;
    if (!sp.name) return;
    speechStanceMap[sp.name] = sp.stance || 'abstain';
    seenStances[sp.stance || 'abstain'] = true;
  });
  if (Object.keys(seenStances).length === 0) seenStances['abstain'] = true;

  // Step 2: 算式预置每人立场（供 AI 失败时兜底）
  KEYI_STATE.attendees.forEach(function(a){
    if (speechStanceMap[a.name]) {
      KEYI_STATE.stances[a.name] = { stance: speechStanceMap[a.name], reason: '\u5EAD\u8BAE\u6240\u8A00' };
    } else {
      KEYI_STATE.stances[a.name] = { stance: _keyiInferStance(a), reason: '' };
    }
  });

  // Step 3: AI 精修（保留原设计——让 AI 给未发言者细腻立场）
  if (P.ai && P.ai.key) {
    KEYI_STATE._busy = true;
    KEYI_STATE._busyText = '\u767E\u5B98\u8868\u51B3\u4E2D';
    _keyiRender();
    var ctx = '\u79D1\u8BAE\u5DF2\u5386 ' + KEYI_STATE.round + ' \u8F6E\u00B7\u4E3B\u8981\u53D1\u8A00\uFF1A\n' +
      KEYI_STATE.speeches.slice(-12).map(function(sp){
        var who = sp._isPlayer ? '\u9661\u4E0B(\u5723\u8C15)' : sp.name;
        return who + '[' + sp.stance + ']\uFF1A' + (sp.line||'').slice(0, 60);
      }).join('\n') + '\n\n';
    // 约束给 AI 知晓
    var _stanceKeys = Object.keys(seenStances);
    var _stanceStr = _stanceKeys.map(function(s){
      return s === 'support' ? '\u652F\u6301' : s === 'oppose' ? '\u53CD\u5BF9' : '\u89C2\u671B';
    }).join('/');
    var list = KEYI_STATE.attendees.map(function(a){
      return a.name + '(' + (a.title||'') + '\u00B7\u515A:' + (a.party||'\u65E0') + '\u00B7\u5FE0' + (a.loyalty||50) + ')';
    }).join('\u3001');
    // 注入每位到会者的认知画像（由 sc07 生成·反映信息不对称）
    var cognitionCtx = '';
    if (typeof getNpcCognitionSnippet === 'function') {
      var _cogBits = [];
      KEYI_STATE.attendees.forEach(function(a){
        var snip = getNpcCognitionSnippet(a.name, { short: true });
        if (snip) {
          _cogBits.push(a.name + '\uFF1A' + snip.replace(/\n/g, ' ').replace(/\u3010\u8BE5\u81E3\u6B64\u65F6\u8BA4\u77E5\u3011/g, '').trim());
        }
      });
      if (_cogBits.length > 0) {
        cognitionCtx = '\n\u3010\u5404\u4F4D\u8BA4\u77E5\u753B\u50CF\uFF08\u65AD\u6848\u7ACB\u573A\u7684\u4E2A\u4EBA\u8BA4\u77E5\u57FA\u7840\uFF09\u3011\n' + _cogBits.join('\n') + '\n';
      }
    }
    var playerStanceHint = '';
    if (KEYI_STATE.playerStance) {
      var lbl = KEYI_STATE.playerStance === 'support' ? '\u503E\u5411\u652F\u6301' : KEYI_STATE.playerStance === 'oppose' ? '\u503E\u5411\u53CD\u5BF9' : '\u7ACB\u573A\u4E2D\u7ACB';
      playerStanceHint = '\u2605 \u9661\u4E0B\u5723\u8C15\u5DF2\u4E0B\uFF1A' + lbl + '\u3002\u8868\u51B3\u65F6\u5FC5\u987B\u5145\u5206\u8003\u8651\u5723\u610F\u3002\n';
    }
    var prompt = ctx + playerStanceHint + cognitionCtx +
      '\u8BF7\u4E3A\u4EE5\u4E0B ' + KEYI_STATE.attendees.length + ' \u540D\u5927\u81E3\u5404\u81EA\u5224\u5B9A\u6700\u7EC8\u7ACB\u573A\u5E76\u7ED9\u51FA 10-30 \u5B57\u7406\u7531\uFF1A\n' +
      list + '\n\n' +
      '\u3010\u786C\u89C4\u5219\u3011\u672C\u6B21\u8BAE\u8BBA\u5DF2\u51FA\u73B0\u7684\u7ACB\u573A\uFF1A' + _stanceStr + '\u3002\u53EA\u53EF\u5728\u8FD9\u4E9B\u7ACB\u573A\u4E2D\u9009\u62E9\u2014\u2014\u8BAE\u8BBA\u4E2D\u6CA1\u4EBA\u8868\u6001\u7684\u7ACB\u573A\u4E0D\u53EF\u4F7F\u7528\u3002\n' +
      '\u5DF2\u53D1\u8A00\u8005\u9700\u4F7F\u7ACB\u573A\u4E0E\u5176\u53D1\u8A00\u4E00\u81F4\u3002\u672A\u53D1\u8A00\u8005\u53EF\u5728\u5141\u8BB8\u7684\u7ACB\u573A\u96C6\u5185\u81EA\u7531\u5224\u5B9A\u3002\n' +
      '\u8FD4\u56DE JSON: [{"name":"","stance":"support|oppose|abstain","reason":""}, ...]\u00B7\u53EA\u8F93\u51FA JSON\u3002';
    try {
      var _tokBudget = (P.conf && P.conf.maxOutputTokens) || (P.conf && P.conf._detectedMaxOutput) || 4000;
      var _keyiVoteTier = (typeof _useSecondaryTier === 'function' && _useSecondaryTier()) ? 'secondary' : undefined;
      var raw = await callAISmart(prompt, _tokBudget, { maxRetries: 1, tier: _keyiVoteTier });
      var parsed = (typeof extractJSON === 'function') ? extractJSON(raw) : null;
      if (!parsed) { var m = raw.match(/\[[\s\S]*\]/); if (m) try { parsed = JSON.parse(m[0]); } catch(_){} }
      if (Array.isArray(parsed)) {
        parsed.forEach(function(r){
          if (r && r.name && KEYI_STATE.stances[r.name]) {
            KEYI_STATE.stances[r.name] = {
              stance: r.stance || KEYI_STATE.stances[r.name].stance,
              reason: r.reason || KEYI_STATE.stances[r.name].reason
            };
          }
        });
      }
    } catch(e) {
      console.warn('[\u79D1\u8BAE] AI \u8868\u51B3\u7CBE\u4FEE\u5931\u8D25\u00B7\u7528\u9884\u7F6E\u7ACB\u573A', e);
    }
  }

  // Step 4: 单向不变量后处理——降级任何未在讨论中出现的立场
  var _demoted = 0;
  Object.keys(KEYI_STATE.stances).forEach(function(name){
    var v = KEYI_STATE.stances[name];
    if (!seenStances[v.stance]) {
      var newStance;
      if (seenStances['abstain']) newStance = 'abstain';
      else newStance = Object.keys(seenStances)[0];
      v.stance = newStance;
      v.reason = (v.reason || '') + '\uFF08\u5EAD\u8BAE\u65E0\u6B64\u58F0\u00B7\u6539\u89C2\u671B\uFF09';
      _demoted++;
    }
  });
  if (_demoted > 0) console.log('[\u79D1\u8BAE] \u5355\u5411\u4E0D\u53D8\u91CF\uFF1A' + _demoted + ' \u4EBA\u7ACB\u573A\u56E0\u5EAD\u8BAE\u672A\u89C1\u800C\u964D\u7EA7');

  _keyiComputeSupport();
  KEYI_STATE._busy = false;
  KEYI_STATE._busyText = '';
}

/** 计算支持率 */
function _keyiComputeSupport() {
  if (!KEYI_STATE) return;
  var s=0, o=0, ab=0;
  Object.keys(KEYI_STATE.stances).forEach(function(k){
    var v = KEYI_STATE.stances[k].stance;
    if (v === 'support') s++;
    else if (v === 'oppose') o++;
    else ab++;
  });
  var total = s+o+ab;
  KEYI_STATE.support = total > 0 ? (s / total) : 0;
  KEYI_STATE._breakdown = { support:s, oppose:o, abstain:ab, total:total };
}

/** 表决阶段 UI（v3·先显式进度条·完成后显示结果+继续按钮） */
function _keyiRenderVote(body, footer) {
  // 未完成·显示进度条
  if (!KEYI_STATE._voteDone) {
    var prog = Math.max(0, Math.min(100, KEYI_STATE._voteProgress || 0));
    var barHtml = ''
      + '<div style="text-align:center;margin:1.2rem 0 0.8rem;">'
      +   '<div style="font-size:2rem;">\u2696</div>'
      +   '<h3 style="color:var(--gold);margin:0.4rem 0;">\u767E\u5B98\u4ED8\u8868\u51B3</h3>'
      +   '<div style="font-size:0.82rem;color:var(--txt-d);">\u6B63\u6536\u96C6\u4F17\u81E3\u7ACB\u573A\u00B7AI \u63A8\u6F14\u8868\u51B3\u8D70\u52BF\u2026</div>'
      + '</div>'
      + '<div style="background:var(--bg-2);padding:1rem 1.2rem;border-radius:6px;margin:0.8rem 0;">'
      +   '<div style="background:var(--bg-3);border-radius:12px;height:16px;position:relative;overflow:hidden;">'
      +     '<div style="width:' + Math.round(prog) + '%;height:100%;background:linear-gradient(90deg,var(--celadon-400),var(--gold));transition:width 0.3s;"></div>'
      +   '</div>'
      +   '<div style="text-align:center;font-size:0.82rem;color:var(--txt-d);margin-top:0.5rem;">' + Math.round(prog) + '% \u00B7 ' + (KEYI_STATE._busyText || '\u8868\u51B3\u8FDB\u884C\u4E2D') + '</div>'
      + '</div>';
    body.innerHTML = barHtml;
    footer.innerHTML = '<div style="text-align:center;color:var(--txt-d);font-size:0.78rem;">\u8ACB\u5019\u00B7\u8868\u51B3\u5B8C\u6BD5\u81EA\u52A8\u51FA\u7ED3\u679C\u2026</div>';
    return;
  }
  // 完成·显示结果
  var bd = KEYI_STATE._breakdown || {};
  var pct = Math.round((KEYI_STATE.support || 0) * 100);
  var libu = _kejuQueryLibuStance();
  var baseThreshold = Math.round((((KEYI_STATE && KEYI_STATE._topicThreshold) || 0.5) * 100));
  var threshold = libu === 'support' ? Math.max(30, baseThreshold - 20) : libu === 'oppose' ? Math.min(85, baseThreshold + 20) : baseThreshold;
  var passed = pct >= threshold;
  KEYI_STATE._passed = passed;
  KEYI_STATE._threshold = threshold;

  var html = '<div style="text-align:center;margin-bottom:0.8rem;">'+
    '<div style="font-size:2rem;">\u2696</div>'+
    '<h3 style="color:var(--gold);">\u8868\u51B3\u7ED3\u679C</h3>'+
    '</div>';
  html += '<div style="background:var(--bg-2);padding:0.8rem;border-radius:6px;margin-bottom:0.6rem;">'+
    '<div style="font-size:0.85rem;margin-bottom:0.4rem;">\u652F\u6301\uFF1A<span style="color:var(--celadon-400);font-weight:700;">'+(bd.support||0)+'</span> \u4EBA\u00B7\u53CD\u5BF9\uFF1A<span style="color:var(--vermillion-400);font-weight:700;">'+(bd.oppose||0)+'</span> \u4EBA\u00B7\u89C2\u671B\uFF1A<span style="color:var(--ink-300);">'+(bd.abstain||0)+'</span> \u4EBA</div>'+
    '<div style="background:var(--bg-3);border-radius:10px;height:12px;position:relative;overflow:hidden;">'+
      '<div style="width:'+pct+'%;height:100%;background:linear-gradient(90deg,var(--celadon-400),var(--gold));transition:width 0.6s;"></div>'+
      '<div style="position:absolute;left:'+threshold+'%;top:0;bottom:0;width:2px;background:var(--vermillion-400);"></div>'+
    '</div>'+
    '<div style="font-size:0.78rem;color:var(--txt-d);margin-top:0.3rem;">\u652F\u6301\u7387 '+pct+'% / \u95E8\u69DB '+threshold+'% ('+(libu==='support'?'\u793C\u90E8\u652F\u6301':libu==='oppose'?'\u793C\u90E8\u53CD\u5BF9':'\u793C\u90E8\u65E0\u6001')+')\u00B7<span style="color:'+(passed?'var(--celadon-400)':'var(--vermillion-400)')+';font-weight:700;">'+(passed?'\u901A\u8FC7':'\u672A\u901A\u8FC7')+'</span></div>'+
    '</div>';

  // 折叠具体立场
  html += '<details style="background:var(--bg-2);border-radius:4px;padding:0.4rem 0.6rem;" open>'+
    '<summary style="cursor:pointer;color:var(--gold);font-size:0.82rem;">\u67E5\u770B\u8BE6\u7EC6\u7ACB\u573A\uFF08' + (bd.total||0) + ' \u4EBA\uFF09</summary>'+
    '<div style="margin-top:0.4rem;font-size:0.78rem;max-height:240px;overflow-y:auto;">';
  Object.keys(KEYI_STATE.stances).forEach(function(k){
    var st = KEYI_STATE.stances[k];
    var color = st.stance==='support' ? 'var(--celadon-400)' : st.stance==='oppose' ? 'var(--vermillion-400)' : 'var(--ink-300)';
    var lbl = st.stance==='support' ? '\u652F' : st.stance==='oppose' ? '\u53CD' : '\u89C2';
    html += '<div style="padding:2px 0;"><span style="color:'+color+';font-weight:700;">['+lbl+']</span> '+escHtml(k)+'\uFF1A<span style="color:var(--txt-d);">'+escHtml(st.reason||'')+'</span></div>';
  });
  html += '</div></details>';
  body.innerHTML = html;

  // 显式"继续裁决"按钮·不再自动 jump
  footer.innerHTML = '<div style="text-align:center;">'
    + '<button class="bt bp" onclick="_keyiProceedToDecide()">\u7EE7\u7EED\u88C1\u51B3</button>'
    + '</div>';
}

/** 进入裁决阶段（v3·由用户显式点击） */
function _keyiProceedToDecide() {
  if (!KEYI_STATE) return;
  KEYI_STATE.phase = 'decide';
  _keyiRender();
}

/** 阶段 3·皇帝决策 */
function _keyiRenderDecide(body, footer) {
  var passed = KEYI_STATE._passed;
  var pending = _keyiGetActiveProposal();
  var topicType = (pending && pending.topicType) || 'kaike';
  var methodLabels = _keyiMethodLabels(topicType);
  var passText = topicType === 'reform'
    ? '\u8BAE\u5DF2\u901A\u8FC7\u00B7\u53EF\u4F9D\u8BAE\u63A8\u884C\u6539\u9769\u3002'
    : '\u8BAE\u5DF2\u901A\u8FC7\u00B7\u53EF\u4F9D\u8BAE\u5F00\u79D1\u3002';
  var failText = topicType === 'reform'
    ? '\u8BAE\u672A\u901A\u8FC7\u00B7\u82E5\u8981\u63A8\u884C\u6539\u9769\u00B7\u9700\u4E0B\u8BCF\u5F3A\u63A8\u3002\u9038\u60E9\u7F5A\uFF1A'
    : '\u8BAE\u672A\u901A\u8FC7\u00B7\u82E5\u8981\u5F00\u79D1\u00B7\u9700\u4E0B\u8BCF\u5F3A\u63A8\u3002\u9038\u60E9\u7F5A\uFF1A';
  var html = '<div style="background:linear-gradient(135deg,rgba(184,154,83,0.08),transparent);border:1px solid var(--gold-d);padding:0.8rem;border-radius:6px;margin-top:0.6rem;">'+
    '<div style="font-weight:700;color:var(--gold);margin-bottom:0.5rem;">\u9661\u4E0B\u88C1\u51B3</div>'+
    '<div style="font-size:0.82rem;color:var(--txt-s);line-height:1.8;">'+
    (passed ? passText : failText) +
    (!passed ? '<br>\u00B7 \u4E0B\u8BCF\u5F3A\u63A8\uFF1A\u7687\u5A01-10\u00B7\u7687\u6743-5\u00B7\u53CD\u5BF9\u5927\u81E3\u597D\u611F-8' : '') +
    (!passed ? '<br>\u00B7 \u9006\u4F17\u8BAE\u5F3A\u63A8\uFF1A\u7687\u5A01-20\u00B7\u7687\u6743-10\u00B7\u6C11\u5FC3-5\u00B7\u53CD\u5BF9\u515A\u6D3E-8\u00B7\u597D\u611F-15' : '') +
    '</div></div>';
  body.innerHTML = body.innerHTML.replace(/<div style="background:linear-gradient[\s\S]*?<\/div><\/div>$/, '') + html;

  // 构建 opposingParties 和 opposingMinisters
  var opposingMinisters = [], opposingParties = {};
  Object.keys(KEYI_STATE.stances).forEach(function(k){
    if (KEYI_STATE.stances[k].stance === 'oppose') {
      opposingMinisters.push(k);
      var a = KEYI_STATE.attendees.find(function(x){ return x.name === k; });
      if (a && a.party && a.party !== '\u65E0\u515A' && a.party !== '\u65E0\u515A\u6D3E') opposingParties[a.party] = true;
    }
  });
  var opArr = Object.keys(opposingParties);

  var btns = '<div style="display:flex;gap:0.5rem;justify-content:center;flex-wrap:wrap;">';
  if (passed) {
    btns += '<button class="bt bp" onclick="_keyiConfirmStart(\'council\')">\uD83D\uDCDC ' + methodLabels.council + '</button>';
  } else {
    btns += '<button class="bt bp" onclick="_keyiConfirmStart(\'edict\')">' + methodLabels.edict + '</button>';
    btns += '<button class="bt" style="color:var(--vermillion-400);" onclick="_keyiConfirmStart(\'defy\')">' + methodLabels.defy + '</button>';
  }
  btns += '<button class="bt" onclick="_keyiAbort()">\u6682\u7F13</button></div>';
  footer.innerHTML = btns;

  KEYI_STATE._opposingMinisters = opposingMinisters;
  KEYI_STATE._opposingParties = opArr;
}

/** 确认启动科举 (v7.1·B3·改 callback 走 topicType 路由) */
function _keyiConfirmStart(method) {
  if (!KEYI_STATE) return;
  // v5·将科议结果写入 GM._courtRecords·让 AI 推演知晓
  _keyiPersistToCourtRecords(method);
  // NPC 记忆+人际影响
  _keyiMemoryEffects(method);

  // v7.1·B3·按 topicType 调对应 callback (kaike 仍走 startKejuByMethod 现 paradigm)
  var pending = _keyiGetActiveProposal();
  var topicType = (pending && pending.topicType) || 'kaike';
  var callbackName = (pending && pending.callbackName) || 'startKejuByMethod';

  if (topicType === 'kaike') {
    // 现 paradigm·向后兼容·完全不变
    startKejuByMethod(method, {
      opposingMinisters: KEYI_STATE._opposingMinisters || [],
      opposingParties: KEYI_STATE._opposingParties || []
    });
  } else {
    // v7.1 新议题·调对应 callback (stub 时 log warn 不阻塞)
    try {
      var fn = (typeof window !== 'undefined') ? window[callbackName] : null;
      if (typeof fn === 'function') {
        fn(method, {
          topicType: topicType,
          topicData: pending && pending.topicData,
          opposingMinisters: KEYI_STATE._opposingMinisters || [],
          opposingParties: KEYI_STATE._opposingParties || [],
          breakdown: KEYI_STATE._breakdown,
          support: KEYI_STATE.support,
          passed: KEYI_STATE._passed
        });
      } else {
        console.warn('[keyi·B3] callback', callbackName, '未定义 (topicType=' + topicType + '·slice 未实现)·议政结果已持久化·不阻塞');
      }
    } catch(e) {
      console.error('[keyi·B3] callback 执行失败·topicType=' + topicType, e);
    }
  }
  if (pending) pending.resolved = true;
  closeKeyi();
}

/** 科议结果持久化（参照 _persistCourtRecord 格式） */
function _keyiPersistToCourtRecords(method) {
  if (!GM._courtRecords) GM._courtRecords = [];
  var pendingForTopic = _keyiGetActiveProposal();
  var topicTypeForRec = (pendingForTopic && pendingForTopic.topicType) || 'kaike';
  var methodLabel = (_keyiMethodLabels(topicTypeForRec)[method]) || method;
  var topicSubject = _keyiTopicSubject(pendingForTopic);
  var stances = {};
  Object.keys(KEYI_STATE.stances).forEach(function(k){
    var s = KEYI_STATE.stances[k];
    stances[k] = {
      stance: s.stance === 'support' ? '\u8D5E\u6210' : s.stance === 'oppose' ? '\u53CD\u5BF9' : '\u89C2\u671B',
      brief: s.reason || ''
    };
  });
  // 皇帝最终裁决作为 "adopted"
  var adoptedArr = method === 'council' ? [{
    author: (P.playerInfo && P.playerInfo.characterName) || '\u9661\u4E0B',
    content: _keyiDecisionContent(method, topicTypeForRec),
    stance: 'support'
  }] : method === 'edict' ? [{
    author: (P.playerInfo && P.playerInfo.characterName) || '\u9661\u4E0B',
    content: _keyiDecisionContent(method, topicTypeForRec),
    stance: 'support'
  }] : method === 'defy' ? [{
    author: (P.playerInfo && P.playerInfo.characterName) || '\u9661\u4E0B',
    content: _keyiDecisionContent(method, topicTypeForRec),
    stance: 'support'
  }] : [];

  // v7.1\u00B7B3\u00B7topic \u5B57\u6BB5\u6D3E\u751F\u00B7\u5411\u540E\u517C\u5BB9 (kaike \u65F6\u4ECD\u8D70"\u79D1\u8BAE\u00B7\u7B79\u529E..." paradigm)
  var topicLabel;
  if (topicTypeForRec === 'kaike') {
    var currentExam = P.keju && P.keju.currentExam;
    topicLabel = '\u79D1\u8BAE\u00B7\u7B79\u529E' + ((currentExam && currentExam.type === 'enke') ? '\u6069\u79D1' : '\u79D1\u4E3E');
  } else {
    topicLabel = '\u79D1\u8BAE\u00B7' + _keyiTopicTitle(pendingForTopic, topicTypeForRec);
  }

  var record = {
    turn: GM.turn,
    targetTurn: GM.turn,
    phase: 'in-turn',
    topic: topicLabel,
    topicType: topicTypeForRec,
    mode: 'keyi',
    participants: KEYI_STATE.attendees.filter(function(a){return !a._excluded;}).map(function(a){return a.name;}),
    stances: stances,
    adopted: adoptedArr,
    dismissed: method === null,
    _keyiMeta: {
      method: method,
      methodLabel: methodLabel,
      topicData: pendingForTopic && pendingForTopic.topicData,
      support: KEYI_STATE.support,
      breakdown: KEYI_STATE._breakdown,
      threshold: KEYI_STATE._threshold,
      passed: KEYI_STATE._passed,
      libuStance: _kejuQueryLibuStance(),
      opposingMinisters: KEYI_STATE._opposingMinisters || [],
      opposingParties: KEYI_STATE._opposingParties || []
    }
  };
  GM._courtRecords.push(record);
  if (GM._courtRecords.length > 8) GM._courtRecords.shift();
  if (typeof recordCourtHeld === 'function') recordCourtHeld({ isPostTurn: false });

  // 并入 _edictTracker 让 AI 下回合 edict_feedback 报告执行
  if (!GM._edictTracker) GM._edictTracker = [];
  GM._edictTracker.push({
    id: 'keyi_' + GM.turn + '_' + method,
    content: '\u79D1\u8BAE\u51B3\u8BAE\uFF1A' + methodLabel + '\u00B7' + topicSubject,
    category: '\u79D1\u8BAE\u00B7' + methodLabel,
    turn: GM.turn,
    status: 'pending',
    assignee: (topicTypeForRec === 'kaike' && P.keju && P.keju.currentExam && P.keju.currentExam.chiefExaminer) || '',
    feedback: '',
    progressPercent: 0
  });

  // 起居注
  if (GM.qijuHistory) {
    var dateStr = (typeof getTSText === 'function') ? getTSText(GM.turn) : '';
    var bd = KEYI_STATE._breakdown || {};
    if (typeof TM !== 'undefined' && TM.Qiju) TM.Qiju.recordEntry({
      turn: GM.turn, date: dateStr,
      content: '\u3010\u79D1\u8BAE\u3011' + topicSubject + '\u00B7\u652F\u6301 ' + (bd.support||0) + '/\u53CD\u5BF9 ' + (bd.oppose||0) + '/\u89C2\u671B ' + (bd.abstain||0) + '\u00B7\u9661\u4E0B' + methodLabel + '\u3002'
    });
  }

  // 纪事
  var bdSum = KEYI_STATE._breakdown || {};
  var detail = '\u652F\u6301 ' + (bdSum.support||0) + '\u00B7\u53CD\u5BF9 ' + (bdSum.oppose||0) + '\u00B7\u89C2\u671B ' + (bdSum.abstain||0);
  var oppNames = (KEYI_STATE._opposingMinisters||[]).slice(0,5).join('\u3001');
  if (oppNames) detail += '\u00B7\u53CD\u5BF9\u8005\uFF1A' + oppNames;
  _kejuWriteJishi(topicTypeForRec === 'reform' ? '\u79D1\u8BAE\u6539\u9769' : '\u79D1\u8BAE\u7B79\u529E', methodLabel, detail);

  // 事件栏
  if (typeof addEB === 'function') addEB('\u79D1\u4E3E', '\u79D1\u8BAE\u00B7' + topicSubject + '\u00B7' + methodLabel + '\u00B7\u652F\u6301\u7387 ' + Math.round((KEYI_STATE.support||0)*100) + '%');
}

/** 通用·写科举事件到纪事 */
function _kejuWriteJishi(kind, summary, detail) {
  if (!GM.jishiRecords) GM.jishiRecords = [];
  GM.jishiRecords.push({
    turn: GM.turn,
    char: '\u79D1\u4E3E',
    playerSaid: '\u3010' + kind + '\u3011' + summary,
    npcSaid: detail || '',
    mode: 'keju_event'
  });
}

/** 科议 NPC 记忆+人际影响 */
function _keyiMemoryEffects(method) {
  var pending = _keyiGetActiveProposal();
  var topicType = (pending && pending.topicType) || 'kaike';
  var methodLabel = (_keyiMethodLabels(topicType)[method]) || method;
  var topicSubject = _keyiTopicSubject(pending);
  var active = KEYI_STATE.attendees.filter(function(a){ return !a._excluded; });
  var playerName = (P.playerInfo && P.playerInfo.characterName) || '\u9661\u4E0B';

  active.forEach(function(a){
    var ch = a._ch || findCharByName(a.name);
    if (!ch) return;
    var s = KEYI_STATE.stances[a.name];
    if (!s) return;

    // NPC 记忆
    if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
      var stanceLabel = s.stance === 'support' ? '\u8D5E\u6210' : s.stance === 'oppose' ? '\u53CD\u5BF9' : '\u89C2\u671B';
      var emo = '\u5E73';
      if (method === 'council') {
        emo = s.stance === 'support' ? '\u559C' : s.stance === 'oppose' ? '\u5FE7' : '\u5E73';
      } else if (method === 'edict' || method === 'defy') {
        emo = s.stance === 'oppose' ? '\u6012' : s.stance === 'support' ? '\u5E73' : '\u5FE7';
      }
      NpcMemorySystem.remember(a.name,
        '\u79D1\u8BAE\u4E2D' + stanceLabel + topicSubject + '\u00B7\u7687\u5E1D' + methodLabel + '\u00B7' + (s.reason || '').slice(0, 30),
        emo, method === 'defy' ? 8 : 6, playerName);
    }

    // AffinityMap 调整
    if (typeof AffinityMap !== 'undefined' && AffinityMap.add) {
      if (method === 'council' && s.stance === 'support') AffinityMap.add(a.name, playerName, 2, '\u79D1\u8BAE\u6240\u8D5E\u4E0E\u7687\u5E1D\u540C');
      else if (method === 'council' && s.stance === 'oppose') AffinityMap.add(a.name, playerName, -2, '\u79D1\u8BAE\u6240\u53CD\u800C\u4E0D\u5F97');
      // 逆众议强推的额外惩罚已在 startKejuByMethod 中施加
    }
  });
}

/** 缓议 */
function _keyiAbort() {
  var pending = _keyiGetActiveProposal();
  if (pending) pending.resolved = true;
  toast('\u79D1\u8BAE\u6682\u7F13');
  closeKeyi();
}

/** 关闭科议 */
function closeKeyi() {
  var pending = _keyiGetActiveProposal();
  var modal = document.getElementById('keyi-modal'); if (modal) modal.remove();
  if (GM.keju && GM.keju._pendingProposal && pending && GM.keju._pendingProposal.proposalId === pending.proposalId) {
    delete GM.keju._pendingProposal;
  }
  KEYI_STATE = null;
}

// 暴露到 window
if (typeof window !== 'undefined') {
  window.openKeyiSession = openKeyiSession;
  window.closeKeyi = closeKeyi;
  // R102 删·_keyiToggleAttendee 从未定义·暴露到 window 会 ReferenceError·无调用点
  // R121 删·_keyiStartDiscuss 同样从未定义（headless smoke 发现）·无调用点
  window._keyiNextRound = _keyiNextRound;
  window._keyiProceedToVote = _keyiProceedToVote;
  window._keyiConfirmStart = _keyiConfirmStart;
  window._keyiAbort = _keyiAbort;
}

function renderFinishedStage(container) {
  var exam = P.keju.currentExam;
  var results = exam.dianshiResults || [];

  // v5·F5·若有答卷但无 finalRanking·先显示钦定 UI
  if (results.length >= 3 && !exam.finalRanking) {
    return renderDianshiDecideStage(container);
  }

  // 若玩家已钦定·按 finalRanking 重排 results
  if (exam.finalRanking && results.length >= 3) {
    var fr = exam.finalRanking;
    var reordered = [];
    [fr.zhuangyuan, fr.bangyan, fr.tanhua].forEach(function(nm){
      var idx = results.findIndex(function(r){ return r.name === nm; });
      if (idx >= 0) { reordered.push(results[idx]); results.splice(idx,1); }
    });
    results = reordered.concat(results);
    // 重排 rank
    results.forEach(function(r,i){ r.rank = i+1; });
    exam.dianshiResults = results;
  }

  var html = '<div style="margin-bottom:1.5rem;">';
  // 金榜头部——仪式感
  html += '<div style="text-align:center;margin-bottom:1.2rem;padding:1.5rem;background:linear-gradient(135deg,rgba(138,109,27,0.12),rgba(138,109,27,0.03));border:1px solid var(--gold-d);border-radius:8px;">';
  html += '<div style="font-size:2.5rem;margin-bottom:0.3rem;">\uD83C\uDFC6</div>';
  html += '<h3 style="color:var(--gold);font-size:1.3rem;letter-spacing:0.15em;margin-bottom:0.3rem;">\u91D1\u699C\u9898\u540D</h3>';
  if (results.length >= 3) {
    html += '<div style="font-size:1rem;color:var(--txt-s);">\u72B6\u5143 <span style="color:var(--gold);font-weight:900;">' + escHtml(results[0].name) + '</span>';
    html += ' \u00B7 \u699C\u773C <span style="color:var(--gold);">' + escHtml(results[1].name) + '</span>';
    html += ' \u00B7 \u63A2\u82B1 <span style="color:var(--gold);">' + escHtml(results[2].name) + '</span></div>';
  }
  html += '<div style="font-size:0.75rem;color:var(--txt-d);margin-top:0.5rem;">\u6BBE\u8BD5\u9898\u76EE\uFF1A' + escHtml((exam.playerQuestion||'').substring(0,40)) + '...</div>';
  html += '</div>';

  // 三甲——留中央任职
  html += '<div style="margin-bottom:0.8rem;font-size:0.85rem;color:var(--txt-d);border-bottom:1px solid var(--bdr);padding-bottom:0.4rem;">\u2605 \u4E09\u7532\u2014\u2014\u7559\u4E2D\u592E\u4EFB\u804C</div>';
  results.slice(0, 3).forEach(function(c, idx) {
    var rankName = idx === 0 ? '\uD83E\uDD47 \u72B6\u5143' : idx === 1 ? '\uD83E\uDD48 \u699C\u773C' : '\uD83E\uDD49 \u63A2\u82B1';
    html += '<div style="background:linear-gradient(135deg,var(--bg-2),rgba(138,109,27,0.06));padding:1rem;margin-bottom:0.5rem;border-radius:6px;border-left:3px solid var(--gold);">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.4rem;">';
    html += '<div><strong style="color:var(--gold);font-size:1.05rem;">' + rankName + '\uFF1A' + escHtml(c.name) + '</strong> ';
    html += '<span style="color:var(--txt-d);font-size:0.8rem;">' + (c.age||'') + '\u5C81 ' + escHtml(c.origin||'') + ' ' + escHtml(c.class||'') + ' \u5206' + (c.score||0) + '</span></div>';
    html += '<div style="display:flex;gap:0.3rem;">';
    html += '<button class="bt bs bsm" onclick="viewAnswer(' + idx + ')">\u67E5\u770B\u7B54\u5377</button>';
    html += '<button class="bt bp bsm" onclick="recruitCandidate(' + idx + ')">\u7EB3\u5165\u4EBA\u7269\u5FD7</button>';
    html += '<button class="bt bs bsm" onclick="assignOffice(' + idx + ')">\u6388\u4E88\u4E2D\u592E\u5B98\u804C</button>';
    html += '</div></div>';
    if (c.evaluation) html += '<p style="font-size:0.82rem;color:var(--txt-s);font-style:italic;">\u8003\u5B98\u8BC4\uFF1A' + escHtml(c.evaluation) + '</p>';
    if (c.answerSummary) html += '<p style="font-size:0.78rem;color:var(--txt-d);margin-top:0.3rem;">\u7B54\u5377\u6458\u8981\uFF1A' + escHtml(c.answerSummary.substring(0, 80)) + '...</p>';
    html += '</div>';
  });

  // 第4-20名——详细评价
  if (results.length > 3) {
    html += '<div style="margin:0.8rem 0 0.5rem;font-size:0.85rem;color:var(--txt-d);border-bottom:1px solid var(--bdr);padding-bottom:0.4rem;">\u4E8C\u7532\u53CA\u4EE5\u4E0B\u2014\u2014\u53EF\u5206\u914D\u5730\u65B9\u4EFB\u804C</div>';
    results.slice(3).forEach(function(c, _idx) {
      var idx = _idx + 3;
      html += '<div style="background:var(--bg-3);padding:0.6rem;margin-bottom:0.3rem;border-radius:4px;">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
      html += '<div><strong style="font-size:0.88rem;">\u7B2C' + c.rank + '\u540D\uFF1A' + escHtml(c.name) + '</strong> ';
      html += '<span style="color:var(--txt-d);font-size:0.75rem;">' + (c.age||'') + '\u5C81 ' + escHtml(c.origin||'') + ' ' + escHtml(c.class||'') + ' \u5206' + (c.score||0) + '</span></div>';
      html += '<div style="display:flex;gap:0.3rem;">';
      html += '<button class="bt bs bsm" onclick="viewAnswer(' + idx + ')">\u7B54\u5377</button>';
      html += '<button class="bt bp bsm" onclick="recruitCandidate(' + idx + ')">\u7EB3\u5165</button>';
      html += '</div></div>';
      if (c.evaluation) html += '<p style="font-size:0.78rem;color:var(--txt-d);margin-top:0.2rem;">' + escHtml(c.evaluation) + '</p>';
      html += '</div>';
    });
  }

  html += '<div style="text-align:center;margin-top:1rem;">' +
    '<button class="bt bp" onclick="finishKeju()" style="padding:0.7rem 2rem;font-size:1rem;">\u2705 \u5B8C\u6210\u79D1\u4E3E\u00B7\u5929\u4E0B\u6709\u6240\u77E5</button>' +
    '</div></div>';

  container.innerHTML = html;
}

/**
 * 查看考生答卷（AI生成完整答卷）
 */
async function viewAnswer(index) {
  var exam = P.keju.currentExam;
  var candidate = exam.dianshiResults[index];
  if (!candidate) return;

  // 如果已经生成过完整答卷，直接显示
  if (candidate.fullAnswer) {
    showAnswerModal(candidate);
    return;
  }

  showLoading('生成答卷中...', 50);

  try {
    var prompt = '你是考生' + candidate.name + '。请根据以下殿试题目作答。\n\n' +
      '【题目】\n' + exam.playerQuestion + '\n\n' +
      '【考生信息】\n' +
      '姓名：' + candidate.name + '\n' +
      '年龄：' + candidate.age + '\n' +
      '籍贯：' + candidate.origin + '\n' +
      '出身：' + candidate.class + '\n' +
      '排名：第' + candidate.rank + '名\n\n' +
      '【作答要求】\n' +
      '1. 答卷长度400-600字\n' +
      '2. 符合该考生的背景和水平\n' +
      '3. 体现该时代的文风\n' +
      '4. 展现治国理政见解\n\n' +
      '直接输出答卷内容，不要JSON格式。';

    var answer = await callAISmart(prompt, 1500, {minLength: 300, maxRetries: 2});
    candidate.fullAnswer = answer;
    hideLoading();
    showAnswerModal(candidate);
  } catch(e) {
    console.error('[科举] 生成答卷失败:', e);
    hideLoading();
    toast('❌ 生成失败');
  }
}

/**
 * 显示答卷弹窗
 */
function showAnswerModal(candidate) {
  var exam = P.keju.currentExam || {};
  var chiefName = exam.chiefExaminer || '\u4E3B\u8003\u5B98';
  var modal = document.createElement('div');
  modal.className = 'modal-bg show';
  var html = '<div style="background:var(--bg-1);border:1px solid var(--gold-d);border-radius:12px;width:90%;max-width:760px;max-height:84vh;display:flex;flex-direction:column;overflow:hidden;">'
    + '<div style="padding:0.8rem 1.2rem;border-bottom:1px solid var(--bdr);display:flex;justify-content:space-between;">'
    +   '<div style="font-size:1.1rem;font-weight:700;color:var(--gold);">\uD83D\uDCDC ' + escHtml(candidate.name) + ' \u7684\u7B54\u5377</div>'
    +   '<button class="bt bs bsm" onclick="this.closest(\'.modal-bg\').remove()">\u2715</button>'
    + '</div>'
    + '<div style="flex:1;overflow-y:auto;padding:1.5rem;">'
    // 考生信息
    +   '<div style="background:var(--bg-2);padding:1rem;border-radius:8px;margin-bottom:1rem;">'
    +     '<p><strong>\u8003\u751F\uFF1A</strong>' + escHtml(candidate.name) + '\uFF08' + (candidate.age||'?') + '\u5C81\uFF0C' + escHtml(candidate.origin||'') + '\uFF09</p>'
    +     '<p><strong>\u6392\u540D\uFF1A</strong>\u7B2C' + candidate.rank + '\u540D'
    +       (candidate.style ? '<span style="color:var(--txt-d);margin-left:10px;">\u98CE\u683C\uFF1A' + escHtml(candidate.style) + '</span>' : '')
    +       (candidate.personalityHint ? '<span style="color:var(--txt-d);margin-left:10px;">\u6027\u60C5\uFF1A' + escHtml(candidate.personalityHint) + '</span>' : '')
    +     '</p>'
    +     '<p><strong>\u8BC4\u5206\uFF1A</strong>' + candidate.score + '\u5206</p>'
    +   '</div>';
  // 主考官批语（红色朱笔风·印象突出）
  if (candidate.chiefExaminerComment) {
    html += '<div style="background:linear-gradient(135deg,rgba(192,64,48,0.08),rgba(140,40,30,0.04));border:1px solid rgba(192,64,48,0.35);border-left:4px solid #C04030;padding:0.9rem 1.1rem;border-radius:6px;margin-bottom:1rem;position:relative;">'
      + '<div style="font-size:0.72rem;color:#C04030;letter-spacing:0.15em;font-weight:700;margin-bottom:6px;">\u3014 \u4E3B\u8003\u6279\u8BED \u3015</div>'
      + '<div style="font-size:0.9rem;line-height:1.9;color:#D9A99B;font-style:italic;">\u201C' + escHtml(candidate.chiefExaminerComment) + '\u201D</div>'
      + '<div style="text-align:right;font-size:0.72rem;color:var(--txt-d);margin-top:6px;">\u2014\u2014 \u4E3B\u8003 ' + escHtml(chiefName) + ' \u5212\u5B9A</div>'
      + '</div>';
  }
  // 考官综合评语（较低调）
  if (candidate.evaluation) {
    html += '<div style="background:rgba(138,109,27,0.06);border-left:3px solid var(--gold-d);padding:0.7rem 1rem;border-radius:4px;margin-bottom:1rem;font-size:0.84rem;line-height:1.7;color:var(--txt-s);">'
      + '<strong style="color:var(--gold);">\u8003\u5B98\u7EFC\u8BC4\uFF1A</strong>' + escHtml(candidate.evaluation)
      + '</div>';
  }
  // 答卷正文
  html += '<div style="background:var(--bg-2);padding:1.5rem;border-radius:8px;line-height:2;white-space:pre-wrap;font-size:0.92rem;">'
    + escHtml(candidate.fullAnswer || '\uFF08\u65E0\u6587\uFF09')
    + '</div>';
  // v7.1·D4·主考评分预测 hint (派生·非LLM·展在答卷下方)
  if (exam.chiefExaminer && typeof _kejuExaminerView === 'function') {
    var examinerCh = (typeof findCharByName === 'function') ? findCharByName(exam.chiefExaminer) : null;
    if (examinerCh) {
      try {
        var _exView = _kejuExaminerView(examinerCh);
        if (_exView) {
          var _cbp = candidate.birthplace || candidate.origin || '';
          var _bias = (_cbp && _exView.preferRegion && _cbp.indexOf(_exView.preferRegion) >= 0) ? +3 : -3;
          var _estScore = Math.max(0, Math.min(100, (candidate.score || 80) + _bias));
          html += '<div style="margin-top:0.8rem;padding:0.6rem 0.9rem;background:rgba(184,154,83,0.06);border-left:2px solid var(--gold-d);border-radius:4px;font-size:0.78rem;color:var(--txt-s);line-height:1.7;">'
            + '<strong style="color:var(--gold);">主考评分预测·</strong>' + escHtml(exam.chiefExaminer) + '（' + escHtml(_exView._summary || '') + '）·此卷估 ' + _estScore + ' 分'
            + '<br><span style="color:var(--txt-d);">理由·</span>' + (_bias > 0 ? '籍贯契合 (+3)' : '籍贯非偏好 (-3)')
            + '</div>';
        }
      } catch(e) { console.warn('[D4] examiner hint 失败', e); }
    }
  }
  // 史料（若历史人物）
  if (candidate.isHistorical && candidate.shiliao) {
    html += '<details style="background:var(--bg-2);padding:0.6rem 1rem;border-radius:4px;margin-top:1rem;">'
      + '<summary style="color:var(--gold);cursor:pointer;font-size:0.85rem;">\u3014\u53F2\u6599\u539F\u6587\u3015</summary>'
      + '<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--txt-s);line-height:1.7;">' + escHtml(candidate.shiliao) + '</div>'
      + '</details>';
  }
  html += '</div></div>';
  modal.innerHTML = html;
  document.body.appendChild(modal);
}

/**
 * 将考生纳入人物志
 */
function recruitCandidate(index) {
  var exam = P.keju.currentExam;
  var candidate = exam.dianshiResults[index];
  if (!candidate) return;

  // 添加到人物志（完整角色数据）
  var rankTitles = {1:'\u72B6\u5143',2:'\u699C\u773C',3:'\u63A2\u82B1'};
  var rankTitle = rankTitles[candidate.rank] || '\u65B0\u79D1\u8FDB\u58EB';
  // 根据名次推算属性——状元智力更高，但不全是书呆子
  var baseInt = Math.min(98, (candidate.score || 80) + (candidate.rank <= 3 ? 5 : 0));
  var newChar = {
    id: typeof uid === 'function' ? uid() : 'keju_' + Date.now() + '_' + candidate.rank,
    name: candidate.name,
    age: candidate.age || 25,
    gender: candidate.gender || '\u7537',
    origin: candidate.origin || '',
    ethnicity: candidate.ethnicity || '',
    birthplace: candidate.origin || '',
    title: rankTitle,
    faction: P.playerInfo ? P.playerInfo.factionName || '' : '',
    party: '',
    familyTier: candidate.class === '\u58EB\u65CF' ? 'gentry' : candidate.class === '\u5BD2\u95E8' ? 'common' : 'common',
    family: candidate.name.charAt(0) + '\u6C0F',
    loyalty: 75 + (candidate.rank <= 3 ? 10 : 0),
    ambition: candidate.rank <= 3 ? 70 : 55,
    benevolence: 65,
    intelligence: baseInt,
    administration: Math.min(95, baseInt - 5 + randInt(0, 9)),
    valor: 30 + randInt(0, 19),
    charisma: 50 + randInt(0, 29),
    diplomacy: 40 + randInt(0, 29),
    morale: 85,
    stress: 0,
    personality: candidate.rank <= 3 ? '\u624D\u534E\u6A2A\u6EA2\uFF0C\u5FD7\u5728\u62A5\u56FD' : '\u52E4\u594B\u597D\u5B66\uFF0C\u604D\u5FCD\u4E0D\u62D4',
    appearance: '',
    bio: '\u7B2C' + candidate.rank + '\u540D\u8FDB\u58EB\uFF0C' + (candidate.origin || '') + '\u4EBA\u3002' + (candidate.evaluation || ''),
    description: candidate.answerSummary || '',
    faith: '',
    culture: '',
    type: 'historical',
    role: '\u65B0\u79D1\u8FDB\u58EB',
    isHistorical: false,
    recruited: true,
    recruitTurn: GM.turn,
    source: '\u79D1\u4E3E',
    alive: true,
    _eventOpinions: [],
    spouse: false,
    children: []
  };

  (typeof TM !== 'undefined' && TM.Roster ? TM.Roster.addChar : function(_c){ GM.chars.push(_c); })(newChar);
  GM.allCharacters.push({
    name: newChar.name, title: newChar.title, age: newChar.age, gender: newChar.gender,
    personality: newChar.personality, desc: newChar.description, loyalty: newChar.loyalty,
    faction: newChar.faction, recruited: true, recruitTurn: GM.turn, source: '\u79D1\u4E3E'
  });

  if (typeof recordPlayerDecision === 'function') recordPlayerDecision('keju', '\u5F55\u7528' + candidate.name + '\u4E3A\u65B0\u5B98');
  if (typeof recordCharacterArc === 'function') recordCharacterArc(candidate.name, 'achievement', '\u79D1\u4E3E\u53CA\u7B2C');

  // ── 关系网络（倾向非绑定）──

  // 1. 座师关系——亲疏倾向，非强制
  var examiner = exam.chiefExaminer;
  if (examiner && typeof AffinityMap !== 'undefined') {
    // 门生对座师有好感（但非绝对忠诚——受人物性格影响）
    var _gratitude = 15; // 基础好感
    // 忠正之士不屑于门生攀附
    if (newChar.benevolence > 80 || (newChar.personality && /\u5FE0\u6B63|\u521A\u76F4|\u4E0D\u5C48/.test(newChar.personality))) _gratitude = 5;
    AffinityMap.add(candidate.name, examiner, _gratitude, '\u5EA7\u5E08\u63D0\u643A');
    AffinityMap.add(examiner, candidate.name, Math.round(_gratitude * 0.5), '\u95E8\u751F');
    if (typeof NpcMemorySystem !== 'undefined') {
      NpcMemorySystem.remember(candidate.name, '\u79D1\u4E3E\u53CA\u7B2C\uFF0C\u5EA7\u5E08\u4E3A' + examiner, '\u656C', 7, examiner);
    }
  }

  // 2. 天子门生——殿试前三名对玩家(天子)有特殊感恩
  var isTop3 = candidate.rank <= 3;
  if (isTop3 && P.playerInfo && P.playerInfo.characterName && typeof AffinityMap !== 'undefined') {
    var _playerName = P.playerInfo.characterName;
    AffinityMap.add(candidate.name, _playerName, 12, '\u5929\u5B50\u95E8\u751F\u4E4B\u6069');
    if (typeof NpcMemorySystem !== 'undefined') {
      var _rankTitle = candidate.rank === 1 ? '\u72B6\u5143' : candidate.rank === 2 ? '\u699C\u773C' : '\u63A2\u82B1';
      NpcMemorySystem.remember(candidate.name, '\u6BBE\u8BD5\u53CA\u7B2C\uFF0C\u8499\u5929\u5B50\u4EB2\u7B56\u70B9\u4E3A' + _rankTitle, '\u656C', 9, _playerName);
    }
  }

  // 3. 同年关系——同科进士互相亲近（但不是同党）
  if (typeof AffinityMap !== 'undefined' && GM.chars) {
    var _sameYear = GM.chars.filter(function(c) { return c.alive !== false && c.source === '\u79D1\u4E3E' && c.recruitTurn === GM.turn && c.name !== candidate.name; });
    _sameYear.forEach(function(peer) {
      AffinityMap.add(candidate.name, peer.name, 8, '\u540C\u5E74\u4E4B\u8C0A');
      AffinityMap.add(peer.name, candidate.name, 8, '\u540C\u5E74\u4E4B\u8C0A');
    });
  }

  // 4. 不强制入党——记录座师党派作为"倾向"标签（AI推演时参考，非硬性）
  newChar._mentorParty = '';
  if (examiner) {
    var examinerChar = typeof findCharByName === 'function' ? findCharByName(examiner) : null;
    if (examinerChar && examinerChar.party && examinerChar.party !== '\u65E0\u515A\u6D3E') {
      newChar._mentorParty = examinerChar.party; // 仅存储倾向，不直接入党
    }
  }

  toast('\u2705 ' + candidate.name + ' \u5DF2\u7EB3\u5165\u4EBA\u7269\u5FD7' + (isTop3 ? '(\u5929\u5B50\u95E8\u751F)' : '') + (examiner ? ' \u5EA7\u5E08:' + examiner : ''));
  if (typeof renderGameState === 'function') renderGameState();
}

/**
 * 为考生授予官职
 */
function assignOffice(index) {
  var exam = P.keju.currentExam;
  var candidate = exam && exam.dianshiResults ? exam.dianshiResults[index] : null;
  if (!candidate) return;

  // 确保候选人已被录入角色列表
  var ch = typeof findCharByName === 'function' ? findCharByName(candidate.name) : null;
  if (!ch) {
    toast('请先将此人纳入人物志');
    return;
  }

  // 收集可用的空缺官职
  var vacantPosts = [];
  if (GM.officeTree) {
    (function walk(nodes, prefix) {
      nodes.forEach(function(n) {
        if (n.positions) n.positions.forEach(function(p) {
          if (!p.holder) vacantPosts.push({ dept: n.name, pos: p.name, rank: p.rank || '', fullName: (prefix ? prefix + '·' : '') + n.name + p.name });
        });
        if (n.subs) walk(n.subs, (prefix ? prefix + '·' : '') + n.name);
      });
    })(GM.officeTree, '');
  }

  if (vacantPosts.length === 0) {
    toast('当前无空缺官职');
    return;
  }

  // 显示选择面板
  var html = '<div style="padding:1rem;max-width:400px;">';
  html += '<h3 style="color:var(--gold);margin-bottom:0.8rem;">授予 ' + escHtml(candidate.name) + ' 官职</h3>';
  html += '<div style="font-size:0.8rem;color:var(--txt-d);margin-bottom:0.6rem;">第' + candidate.rank + '名 · ' + (candidate.origin||'') + ' · ' + (candidate.evaluation||'').slice(0,30) + '</div>';
  html += '<div style="max-height:250px;overflow-y:auto;">';
  vacantPosts.forEach(function(vp, vi) {
    html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:0.4rem 0.6rem;margin-bottom:0.3rem;background:var(--bg-2);border-radius:4px;cursor:pointer;" onclick="_kejuAssignConfirm(' + index + ',' + vi + ')">';
    html += '<span style="font-size:0.85rem;">' + escHtml(vp.fullName) + '</span>';
    if (vp.rank) html += '<span style="font-size:0.7rem;color:var(--txt-d);">' + escHtml(vp.rank) + '</span>';
    html += '</div>';
  });
  html += '</div>';
  html += '<button class="bt bs" style="margin-top:0.6rem;" onclick="this.closest(\'.modal-bg\').remove();">取消</button>';
  html += '</div>';

  var ov = document.createElement('div');
  ov.className = 'modal-bg show';
  ov.innerHTML = '<div class="modal" style="max-width:420px;">' + html + '</div>';
  document.body.appendChild(ov);

  // 存储空缺列表供确认使用
  window._kejuVacantPosts = vacantPosts;
}

function _kejuAssignConfirm(candidateIdx, postIdx) {
  var exam = P.keju.currentExam;
  var candidate = exam && exam.dianshiResults ? exam.dianshiResults[candidateIdx] : null;
  var vp = window._kejuVacantPosts ? window._kejuVacantPosts[postIdx] : null;
  if (!candidate || !vp) return;

  // 在officeTree中找到对应职位并任命
  (function walk(nodes) {
    nodes.forEach(function(n) {
      if (n.name === vp.dept && n.positions) {
        n.positions.forEach(function(p) {
          if (p.name === vp.pos && !p.holder) {
            p.holder = candidate.name;
            addEB('\u4EFB\u547D', candidate.name + '\u4EFB' + vp.fullName + '(\u79D1\u4E3E\u6388\u804C)');
            toast('\u2705 ' + candidate.name + ' \u5DF2\u4EFB' + vp.fullName);
          }
        });
      }
      if (n.subs) walk(n.subs);
    });
  })(GM.officeTree);

  // 关闭选择面板
  var modals = document.querySelectorAll('.modal-bg');
  if (modals.length > 1) modals[modals.length - 1].remove();
  delete window._kejuVacantPosts;
}

/**
 * 完成科举
 */
function finishKeju() {
  var exam = P.keju.currentExam;
  if (!exam) return;

  var results = exam.dianshiResults || [];
  var top3 = results.slice(0, 3).map(function(c) { return c.name; });

  // 记录到历史
  P.keju.history.push({
    date: exam.startDate,
    passedCount: exam.statistics ? exam.statistics.passedCount : 0,
    quality: exam.statistics ? exam.statistics.quality : '',
    topThree: top3,
    question: (exam.playerQuestion || '').substring(0, 50),
    dianshiCount: results.length
  });

  P.keju.lastExamDate = exam.startDate;

  // 事件日志——让回合报告中能体现
  if (typeof addEB === 'function') {
    addEB('\u79D1\u4E3E', '\u79D1\u4E3E\u5B8C\u6BD5\uFF0C\u5F55\u53D6' + (exam.statistics ? exam.statistics.passedCount : 0) + '\u4EBA\u3002\u72B6\u5143' + (top3[0]||'') + '\u3001\u699C\u773C' + (top3[1]||'') + '\u3001\u63A2\u82B1' + (top3[2]||''));
  }
  if (typeof recordPlayerDecision === 'function') {
    recordPlayerDecision('keju', '\u79D1\u4E3E\u5B8C\u6210\uFF0C\u72B6\u5143' + (top3[0]||'') + '\uFF0C\u5171\u53D6' + results.length + '\u4EBA');
  }

  // NPC记忆——重要政治事件
  if (typeof NpcMemorySystem !== 'undefined' && GM.chars) {
    GM.chars.forEach(function(c) {
      if (c.alive !== false && c.source === '\u79D1\u4E3E' && c.recruitTurn === GM.turn) {
        NpcMemorySystem.remember(c.name, '\u79D1\u4E3E\u53CA\u7B2C\uFF0C\u91D1\u699C\u9898\u540D', '\u559C', 9);
      }
    });
  }

  // ── 政斗影响：科举结果→阶层满意度 ──
  var stats = exam.statistics || {};

  // 1. 阶层比例→阶层满意度影响
  if (stats.classRatio && GM.classes) {
    GM.classes.forEach(function(cls) {
      var clsName = cls.name;
      // 士族考生多→士族满意，寒门考生多→寒门满意
      Object.entries(stats.classRatio).forEach(function(e) {
        if (clsName.indexOf(e[0]) >= 0 || e[0].indexOf(clsName) >= 0) {
          var share = e[1] || 0;
          var _krGate = (typeof TM !== 'undefined' && TM.ClassEngine && typeof TM.ClassEngine.gateSatisfaction === 'function');
          if (share > 0.4) {
            if (_krGate) TM.ClassEngine.gateSatisfaction(GM, cls, 3, { turn: GM.turn, source: 'keju', reason: '本阶层考生占比厚' });
            else cls.satisfaction = Math.min(100, (parseInt(cls.satisfaction)||50) + 3);
          } else if (share < 0.15) {
            if (_krGate) TM.ClassEngine.gateSatisfaction(GM, cls, -2, { turn: GM.turn, source: 'keju', reason: '本阶层考生占比薄' });
            else cls.satisfaction = Math.max(0, (parseInt(cls.satisfaction)||50) - 2);
          }
        }
      });
    });
  }

  // G·科举守恒上行流（2026-06-16）：寒门上行受阻→士人激进(范进式怨望) + 寒门登科守恒人口上行流
  try { _kejuMobilityFlow(exam, stats, results); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, '科举·G 上行流') : console.warn('[科举·G] 上行流失败', e); }

  // 2. 座主信息记入历史
  P.keju.history[P.keju.history.length - 1].chiefExaminer = exam.chiefExaminer || '';
  P.keju.history[P.keju.history.length - 1].examinerParty = exam.examinerParty || '';

  // v5·G1+G2·三甲自动纳入·4-20 入进士池填缺·全部算阶层党派吏治影响
  try { _kejuFinalize(exam); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, '科举·G] finalize 失败') : console.warn('[科举·G] finalize 失败', e); }

  // P7: 科举入仕生命周期——未手动授官的进士进入待铨队列
  if (!GM._kejuPendingAssignment) GM._kejuPendingAssignment = [];
  results.forEach(function(c) {
    var ch = typeof findCharByName === 'function' ? findCharByName(c.name) : null;
    if (ch && !ch.officialTitle && !ch.title) {
      GM._kejuPendingAssignment.push({
        name: c.name,
        rank: c.rank,
        enrollTurn: GM.turn,
        origin: c.origin || '',
        score: c.score || 0
      });
    }
  });

  P.keju.currentExam = null;
  closeKejuModal();
  if (typeof renderGameState === 'function') renderGameState();
  toast('\uD83D\uDCDC \u79D1\u4E3E\u8003\u8BD5\u5706\u6EE1\u7ED3\u675F\uFF0C\u72B6\u5143' + (top3[0]||'') + '\u3001\u699C\u773C' + (top3[1]||'') + '\u3001\u63A2\u82B1' + (top3[2]||''));
}

// ══════════════════════════════════════════════════════════════════
// v5·G1+G2·finalize：三甲纳入+未纳入填缺+阶层党派吏治影响
// ══════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════
// G·科举守恒上行流（2026-06-16·未 ship 未 commit）
//   ① 上行受阻→士人激进：读已算的 stats.classRatio（寒门占比·AI 提供）判通道开闭，
//      寒门占比低=避途被门阀把持→士大夫阶层 _aspirationBlock↑（tickClassRadical 第⑤项·范进式怨望·持久衰减）；占比高=泄压。
//   ② 守恒上行人口流：寒门登科者按占比估算，自耕→士绅人口格子守恒迁移（best-effort·仅当两格子已存在·不创建·无则 no-op）。
//   纯增量·朝代中立（读阶层名/占比·不写死专名）·失败静默兜底。
function _kejuMobilityFlow(exam, stats, results) {
  if (typeof GM === 'undefined' || !GM || !Array.isArray(GM.classes)) return;
  function _cl(x, lo, hi) { x = Number(x); if (!isFinite(x)) x = 0; return x < lo ? lo : (x > hi ? hi : x); }
  function _r2(x) { return Math.round(Number(x) * 100) / 100; }
  var ratio = (stats && stats.classRatio) || {};
  var hanmen = 0, hasRatio = false;
  Object.keys(ratio).forEach(function(k) {
    var v = Number(ratio[k]); if (!isFinite(v)) return; hasRatio = true;
    if (/寒|庶|平民|布衣|自耕|农|贫/.test(k)) hanmen += v;   // 寒门/平民通道占比
  });
  // 士人阶层（科举上行通道之身·范进式怨望载体）：优先「士大夫」，否则名含 士/读书/生员/绅
  var scholar = GM.classes.filter(function(c) { return c && /士大夫/.test(c.name || ''); })[0]
             || GM.classes.filter(function(c) { return c && /士|读书|生员|绅/.test(c.name || ''); })[0];
  // ① 上行受阻→士人激进（寒门避途 ④名额收紧 合成）
  if (scholar && hasRatio) {
    var openness = _cl(hanmen, 0, 1);                      // 寒门占比即通道开放度
    var shareBlock = _cl((0.30 - openness) / 0.30, 0, 1);  // <30% 视为受阻·线性到 0
    // ④·名额显式 throttle：名额较基线收紧→士人额外受阻(范进式)；放宽→泄压。基线懒设首见名额(初始 change=0)·向当前缓移(change vs 近期常态)。
    var _q = Number((typeof P !== 'undefined' && P && P.keju) ? P.keju.quotaPerExam : NaN), qBlock = 0;
    if (isFinite(_q) && _q > 0) {
      if (P.keju._quotaBaseline == null) P.keju._quotaBaseline = _q;
      var _qb = Number(P.keju._quotaBaseline) || _q;
      if (_q < _qb) qBlock = _cl((_qb - _q) / _qb, 0, 0.5);   // 名额收紧→受阻↑
      P.keju._quotaBaseline = _r2(_qb + (_q - _qb) * 0.25);   // 基线向当前缓移
      scholar._kejuQuota = _q;                                // 透明字段供 UI/prompt
    }
    var block = _cl(shareBlock + qBlock, 0, 1);            // 寒门避途 + 名额收紧 合成受阻
    if (block > 0) {
      scholar._aspirationBlock = _r2(_cl(Math.max(Number(scholar._aspirationBlock) || 0, 0.45 * block), 0, 0.5));
      if (block > 0.5 && typeof addEB === 'function') addEB('科举', '寒门上行道塞，士林怨望渐深');  // 寒门上行道塞，士林怨望渐深
    } else if (scholar._aspirationBlock) {
      scholar._aspirationBlock = _r2(Math.max(0, (Number(scholar._aspirationBlock) || 0) - 0.15));   // 通道宽·士人得遂所愿·泄压
    }
    scholar._kejuOpenness = _r2(openness);                 // 透明字段供 UI/prompt
  }
  // ② 守恒上行人口流（best-effort·不创建格子）
  var pop = GM.population && GM.population.byClass;
  if (pop && hasRatio) {
    var hanmenGrads = Math.round(((results && results.length) || 0) * _cl(hanmen, 0, 1));
    if (hanmenGrads > 0) {
      var CE = (typeof TM !== 'undefined' && TM.ClassEngine && TM.ClassEngine.resolvePopulationKeys) ? TM.ClassEngine : null;
      var srcCls = GM.classes.filter(function(c) { return c && /自耕|编户/.test(c.name || ''); })[0];
      var dstCls = GM.classes.filter(function(c) { return c && /缙绅|士绅|士大夫/.test(c.name || ''); })[0];
      var srcKeys = (CE && srcCls) ? CE.resolvePopulationKeys(srcCls, GM) : (srcCls ? ['peasant_self', 'bianhu'] : []);
      var dstKeys = ((CE && dstCls) ? CE.resolvePopulationKeys(dstCls, GM) : []).concat(['gentry_low', 'gentry_high']);  // 兜底常见士绅人口键·仅当已存在才用
      var srcKey = (srcKeys || []).filter(function(k) { return pop[k] && isFinite(Number(pop[k].mouths)); })[0];
      var dstKey = (dstKeys || []).filter(function(k) { return pop[k] && isFinite(Number(pop[k].mouths)); })[0];
      if (srcKey && dstKey && srcKey !== dstKey) {
        var move = Math.min(hanmenGrads * 8, Math.floor(Number(pop[srcKey].mouths) * 0.02));  // 一名进士擢升其门户(×8)·守恒·封顶 2% 源格子
        if (move > 0) { pop[srcKey].mouths -= move; pop[dstKey].mouths += move; }
      }
    }
  }
}

/** 科举结束时的总结算 */
function _kejuFinalize(exam) {
  if (!exam) return;
  var results = exam.dianshiResults || [];
  var fr = exam.finalRanking || {};

  // 1. 前三名自动纳入人物志（若尚未纳入）
  [fr.zhuangyuan, fr.bangyan, fr.tanhua].forEach(function(name, idx){
    if (!name) return;
    var existing = (GM.chars||[]).find(function(c){ return c && c.name === name; });
    if (existing) return;  // 已存在
    // 从 results 中找对应数据
    var r = results.find(function(x){ return x.name === name; });
    if (!r) return;
    // 异步生成完整人物数据（不 await·让它在后台完成）
    _aiGenerateFullCharacter(r, idx === 0 ? 'zhuangyuan' : idx === 1 ? 'bangyan' : 'tanhua').catch(function(e){
      (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, '科举·G2') : console.warn('[科举·G2] 三甲人物生成失败·使用模板兜底', e);
      _kejuBasicRecruit(r, idx === 0 ? '\u72B6\u5143' : idx === 1 ? '\u699C\u773C' : '\u63A2\u82B1');
    });
  });

  // v7.1·D5·4-20 名也 eager 入 GM.chars (删 lazy 分支·原 _crystallized 不再用)
  var unPlaced = results.slice(3).map(function(c){
    return {
      name: c.name, age: c.age, origin: c.origin, class: c.class, party: c.party,
      score: c.score, rank: c.rank,
      answerSummary: (c.fullAnswer || c.answerSummary || '').slice(0, 200),
      personalityHint: c.personalityHint,
      shiliao: c.shiliao || '',
      isHistorical: !!c.isHistorical,
      allocatedOffice: null,
      _crystallized: true,  // v7.1·D5·eager 已生成·lazy 函数不再触发
      _examId: exam.id
    };
  });
  exam.gradPool = unPlaced;

  // v7.1·D5·eager 4-20 名·后台异步生成完整 char (不阻塞 UI)
  unPlaced.forEach(function(g) {
    var existing = (GM.chars||[]).find(function(c){ return c && c.name === g.name; });
    if (existing) return;
    var rankKey = (g.rank && g.rank <= 20) ? 'erjia' : 'sanjia';
    _aiGenerateFullCharacter(g, rankKey).catch(function(e){
      console.warn('[科举·D5] 4-20 名 eager 生成失败·fallback basic·name=' + g.name, e && e.message);
      _kejuBasicRecruit(g, '进士');
    });
  });

  _kejuAllocateGradsToOffices(unPlaced);

  // 3. 阶层+党派+吏治影响·全员算
  _kejuAggregateGradsEffect(results, exam);

  // v5·纪事·科举完成总结
  if (typeof _kejuWriteJishi === 'function') {
    var placed = unPlaced.filter(function(g){return g.allocatedOffice;}).length;
    var summary = '\u5171 ' + results.length + ' \u540D\u00B7\u4E09\u7532\u5165\u4EBA\u7269\u5FD7\u00B7' + placed + ' \u4EBA\u586B\u5730\u65B9\u7F3A\u989D';
    var detail = '';
    if (exam.historicalHits && exam.historicalHits.length) detail = '\u5386\u53F2\u540D\u81E3\u547D\u4E2D\uFF1A' + exam.historicalHits.join('\u3001');
    if (exam.chiefExaminer) detail += (detail ? '\u00B7' : '') + '\u4E3B\u8003\uFF1A' + exam.chiefExaminer;
    _kejuWriteJishi('\u91D1\u699C\u9898\u540D', summary, detail);
  }
  if (typeof addEB === 'function') {
    var fr2 = exam.finalRanking || {};
    addEB('\u79D1\u4E3E', '\u91D1\u699C\u00B7\u72B6\u5143' + (fr2.zhuangyuan||'?') + '\u00B7\u699C\u773C' + (fr2.bangyan||'?') + '\u00B7\u63A2\u82B1' + (fr2.tanhua||'?'));
  }

  // v7.1\u00B7E1\u00B7mentor \u53CD\u5411\u7D22\u5F15\u00B7D5 eager \u5F02\u6B65\u00B7\u5EF6\u8FDF 3s \u5168\u91CF rebuild\u00B7\u8986\u76D6\u6240\u6709\u65B0\u8FDB\u58EB _mentorRef/_cohortYear
  if (typeof _kjBuildMentorIndex === 'function') {
    setTimeout(function(){
      try { _kjBuildMentorIndex(); } catch(e) { console.warn('[\u79D1\u4E3E\u00B7E1] _kjBuildMentorIndex \u5931\u8D25', e && e.message); }
    }, 3000);
  }
}

/** 模板兜底·只写基础字段 */
function _kejuBasicRecruit(candidate, rankTitle) {
  if (!GM.chars) GM.chars = [];
  if (GM.chars.find(function(c){ return c && c.name === candidate.name; })) return;
  var bonus = P.keju.attributeBonus || {};
  var key = rankTitle === '\u72B6\u5143' ? 'zhuangyuan' : rankTitle === '\u699C\u773C' ? 'bangyan' : 'tanhua';
  var b = bonus[key] || {};
  (typeof TM !== 'undefined' && TM.Roster ? TM.Roster.addChar : function(_c){ GM.chars.push(_c); })({
    id: 'keju_' + Date.now() + '_' + candidate.rank,
    name: candidate.name,
    age: candidate.age || 25,
    origin: candidate.origin,
    ethnicity: candidate.ethnicity || '\u6C49',
    class: candidate.class || '\u5BD2\u95E8',
    title: rankTitle,
    bio: '\u672C\u79D1' + rankTitle + '\u3002' + (candidate.fullAnswer || candidate.answerSummary || '').slice(0, 100),
    historicalSource: candidate.shiliao || '',
    intelligence: Math.min(98, (candidate.score || 80) + 5),
    administration: 70,
    loyalty: 80, ambition: 70,
    resources: { fame: b.fame || 30, virtue: b.virtue || 15, privateWealth: { money:0, grain:0, cloth:0 }, publicPurse: { money:0, grain:0, cloth:0 }, health:80, stress:0 },
    alive: true,
    source: '\u79D1\u4E3E',
    recruitTurn: GM.turn,
    isHistorical: !!candidate.isHistorical,
    // v7.1\u00B7E2\u00B7fallback \u6A21\u677F\u4EA6 100% \u5199 party\u00B7candidate.party \u4F18\u5148\u00B7examiner.party fallback\u00B7\u4E2D\u7ACB fallback
    party: candidate.party || (function(){
      if (!P.keju || !P.keju.currentExam || !P.keju.currentExam.chiefExaminer) return '\u4E2D\u7ACB';
      var ex = (typeof findCharByName === 'function') ? findCharByName(P.keju.currentExam.chiefExaminer) : null;
      if (!ex || !ex.party || ex.party === '\u4E2D\u7ACB' || ex.party === '\u65E0\u515A' || ex.party === '\u65E0\u515A\u6D3E') return '\u4E2D\u7ACB';
      return ex.party;
    })(),
    // v7.1\u00B7D5\u00B74 \u7EF4\u5EA6\u5B57\u6BB5\u00B7fallback \u6A21\u677F\u4EA6\u4FDD
    _mentorRef: (P.keju && P.keju.currentExam && P.keju.currentExam.chiefExaminer) || null,
    _cohortYear: GM.year || (P.time && P.time.year) || 1600,
    _specialExamType: (P.keju && P.keju.currentExam && P.keju.currentExam.type === 'enke') ? 'enke' : null,
    _schoolAffiliation: null
  });
}

/** v7.1·D5·AI 全字段生成 (eager·含生平/外貌/家谱/史料出处段 + examiner 4 属性 hint + 4 维度) */
async function _aiGenerateFullCharacter(candidate, rankKey) {
  if (!P.ai || !P.ai.key) { _kejuBasicRecruit(candidate, rankKey === 'zhuangyuan' ? '\u72B6\u5143' : rankKey === 'bangyan' ? '\u699C\u773C' : rankKey === 'tanhua' ? '\u63A2\u82B1' : '\u8FDB\u58EB'); return; }

  var exam = P.keju.currentExam;
  var era = P.dynasty || P.era || '';
  var year = GM.year || (P.time && P.time.year) || 1600;
  var rankLbl = rankKey === 'zhuangyuan' ? '\u72B6\u5143' : rankKey === 'bangyan' ? '\u699C\u773C' : rankKey === 'tanhua' ? '\u63A2\u82B1' : '\u8FDB\u58EB';

  // v7.1\u00B7D5\u00B7examiner 4 \u5C5E\u6027 hint (\u6D3E\u751F\u00B7\u975E\u65B0\u5B57\u6BB5\u00B7\u8BA9 LLM \u987A\u4E3B\u8003\u503E\u5411\u00B7\u5F71\u54CD wuchang / personality)
  var _examinerHint = '';
  if (exam && exam.chiefExaminer && typeof _kejuExaminerView === 'function') {
    try {
      var _exCh = (typeof findCharByName === 'function') ? findCharByName(exam.chiefExaminer) : null;
      if (_exCh) {
        var _exView = _kejuExaminerView(_exCh);
        if (_exView) {
          _examinerHint = '\u3010\u4E3B\u8003\u504F\u597D\u3011' + (_exView._summary || exam.chiefExaminer) + '\n'
            + '\u00B7 \u4E3B\u8003\u504F\u597D\u5185\u5BB9\u00B7' + (_exView.preferContent || '\u672A\u77E5') + '\u00B7\u8FDB\u58EB\u4EF7\u503C\u89C2\u53EF\u987A\u4E3B\u8003\u503E\u5411 (\u4F46\u4E0D\u5F3A\u5236)\n'
            + '\u00B7 \u4E3B\u8003\u504F\u597D\u7C4D\u8D2F\u00B7' + (_exView.preferRegion || '\u65E0') + '\n'
            + '\u00B7 \u4E3B\u8003\u4E25\u683C\u5EA6\u00B7' + Math.round(_exView.strictness) + '/100\u00B7\u5F71\u54CD\u57FA\u7840\u5C5E\u6027\u6863\u6B21\n';
        }
      }
    } catch(_){}
  }

  var prompt = '\u4F60\u662F' + era + '\u79D1\u4E3E\u8FDB\u58EB\u6863\u6848 AI\u3002\u4E3A\u4EE5\u4E0B\u8003\u751F\u751F\u6210\u5B8C\u6574\u4EBA\u7269\u5361\u3002\n\n' +
    _examinerHint +
    '\u3010\u57FA\u672C\u3011' + JSON.stringify({
      name: candidate.name, age: candidate.age, origin: candidate.origin,
      class: candidate.class, party: candidate.party,
      score: candidate.score, rank: candidate.rank,
      isHistorical: candidate.isHistorical,
      shiliao: candidate.shiliao || null,
      style: candidate.style, personalityHint: candidate.personalityHint,
      timeAnomaly: candidate._timeAnomaly
    }) + '\n' +
    '\u3010\u7B54\u5377\u6458\u8981\u3011' + (candidate.fullAnswer || '').slice(0, 300) + '\n' +
    '\u3010\u5F53\u524D\u65F6\u4EE3\u3011' + era + ' ' + year + ' \u5E74\u3002\n\n' +
    '\u751F\u6210 JSON\uFF0C\u5305\u542B\uFF1A\n' +
    '{\n' +
    '  "appearance": "\u5916\u8C8C 40-80 \u5B57",\n' +
    '  "charisma": 50-90,\n' +
    '  "bio": "\u751F\u5E73 300-600 \u5B57\u00B7\u9700\u5305\u542B\u51FA\u8EAB/\u6C0F\u65CF/\u65E9\u5E74\u6C42\u5B66/\u5E08\u627F/\u4E60\u4E1A\u00B7\u5BF9\u5386\u53F2\u540D\u81E3\u987B\u4E25\u683C\u6309\u53F2\u6599\u00B7\u672B\u6BB5\u5355\u5217\u4E00\u6BB5\u3010\u53F2\u6599\u51FA\u5904\u3011+ shiliao \u539F\u6587",\n' +
    '  "personalGoal": "\u5FD7\u5411 10-30 \u5B57",\n' +
    '  "ambition": 30-85,\n' +
    '  "intelligence": 60-95,\n' +
    '  "administration": 40-90,\n' +
    '  "valor": 20-60,\n' +
    '  "benevolence": 30-85,\n' +
    '  "loyalty": 60-95,\n' +
    '  "integrity": 30-95,\n' +
    '  "wuchang": {"ren":50,"yi":50,"li":50,"zhi":50,"xin":50},\n' +
    '  "family": "\u6C0F\u65CF\u540D (\u5982\u9648\u6C0F)",\n' +
    '  "familyTier": "gentry|common|royal",\n' +
    '  "familyMembers": [{"name":"","relation":"\u7236/\u6BCD/\u914D\u5076/\u5144/\u59D0","living":true,"officialTitle":""}],\n' +
    '  "ancestry": "\u5BB6\u8C31\u6982\u8981 3-5 \u4EE3 80-150 \u5B57",\n' +
    '  "stance": "\u7ACB\u573A 20-40 \u5B57",\n' +
    '  "hobbies": ["\u68CB","\u4E66"],\n' +
    (candidate._timeAnomaly ? '  "timeAnomaly": true\n' : '') +
    '}\n\u53EA\u8F93\u51FA JSON\u3002';

  var attempt = 0;
  while (attempt < 3) {
    attempt++;
    try {
      var raw = await callAISmart(prompt, 3000, { maxRetries: 1 });
      var data = (typeof extractJSON === 'function') ? extractJSON(raw) : null;
      if (!data) data = JSON.parse(raw.replace(/```json|```/g, '').trim());
      if (!data || typeof data !== 'object') throw new Error('\u89E3\u6790\u5931\u8D25');

      // 附加史料出处段（若有）
      var bio = data.bio || '';
      if (candidate.shiliao && bio.indexOf('\u3010\u53F2\u6599\u51FA\u5904\u3011') < 0) {
        bio += '\n\n\u3010\u53F2\u6599\u51FA\u5904\u3011\n' + candidate.shiliao;
      }
      // 演义跨朝代标签
      if (data.timeAnomaly || candidate._timeAnomaly) {
        bio += '\n\n\u3010\u5F02\u4E16\u5947\u7F18\u3011\u6B64\u4EBA\u672C\u4E3A\u5176\u672C\u671D\u4E4B\u4EBA\u00B7\u4E0D\u77E5\u56E0\u4F55\u7F18\u4EFD\u5728\u6B64\u4E16\u4E3A\u58EB\u3002';
      }

      var bonus = P.keju.attributeBonus || {};
      var bonusKey = rankKey || 'erjia';
      var b = bonus[bonusKey] || { fame: 15, virtue: 8 };

      // v7.1·D5·GM._runId 防撞 seed (重启游戏不重名)
      if (!GM._runId) GM._runId = 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2,6);

      var newChar = {
        id: 'keju_' + GM._runId + '_' + (exam ? exam.id : 'noexam') + '_' + candidate.rank + '_' + (candidate.name || 'anon'),
        name: candidate.name,
        age: candidate.age || 25,
        gender: '\u7537',
        ethnicity: candidate.ethnicity || '\u6C49',
        origin: candidate.origin,
        birthplace: candidate.origin,
        class: candidate.class || '\u5BD2\u95E8',
        title: rankKey === 'zhuangyuan' ? '\u72B6\u5143' : rankKey === 'bangyan' ? '\u699C\u773C' : rankKey === 'tanhua' ? '\u63A2\u82B1' : '\u8FDB\u58EB',
        // 外貌
        appearance: data.appearance || '',
        charisma: data.charisma || 60,
        // 生平（含史料段）
        bio: bio,
        historicalSource: candidate.shiliao || '',
        // 志向
        personalGoal: data.personalGoal || '',
        ambition: data.ambition || 50,
        // 能力
        intelligence: data.intelligence || 75,
        administration: data.administration || 65,
        valor: data.valor || 30,
        benevolence: data.benevolence || 60,
        loyalty: data.loyalty || 80,
        integrity: data.integrity || 70,
        wuchang: data.wuchang || { ren:60, yi:60, li:60, zhi:60, xin:60 },
        // 身世
        family: data.family || (candidate.name.charAt(0) + '\u6C0F'),
        familyTier: data.familyTier || 'common',
        familyMembers: Array.isArray(data.familyMembers) ? data.familyMembers : [],
        ancestry: data.ancestry || '',
        // 立场/爱好
        stance: data.stance || '',
        partyLean: exam && exam.chiefExaminer ? ((findCharByName(exam.chiefExaminer)||{}).party || '') : '',
        // v7.1·E2·进士 ch.party 100% 写入·candidate.party 优先 (历史 hit)·examiner.party fallback·中立 fallback
        party: candidate.party || (function(){
          if (!exam || !exam.chiefExaminer) return '中立';
          var ex = (typeof findCharByName === 'function') ? findCharByName(exam.chiefExaminer) : null;
          if (!ex || !ex.party || ex.party === '中立' || ex.party === '无党' || ex.party === '无党派') return '中立';
          return ex.party;
        })(),
        hobbies: Array.isArray(data.hobbies) ? data.hobbies : [],
        // 资源+属性加成
        resources: {
          fame: b.fame || 15,
          virtue: b.virtue || 8,
          health: 80, stress: 0,
          privateWealth: { money:0, grain:0, cloth:0 },
          publicPurse: { money:0, grain:0, cloth:0 }
        },
        // 异常标签
        _timeAnomaly: !!(data.timeAnomaly || candidate._timeAnomaly),
        // v7.1·D5·4 维度字段
        _mentorRef: (exam && exam.chiefExaminer) ? exam.chiefExaminer : null,
        _cohortYear: year,
        _specialExamType: (exam && exam.type === 'enke') ? 'enke' : null,
        _schoolAffiliation: null,
        // 元数据
        alive: true,
        source: '\u79D1\u4E3E',
        recruitTurn: GM.turn,
        isHistorical: !!candidate.isHistorical,
        _memorySeeds: [{
          turn: GM.turn,
          event: '\u6BBE\u8BD5\u53CA\u7B2C\u00B7\u8499' + ((P.playerInfo && P.playerInfo.characterName) || '\u5929\u5B50') + '\u4EB2\u7B56\u4E3A' + (rankKey === 'zhuangyuan' ? '\u72B6\u5143' : rankKey === 'bangyan' ? '\u699C\u773C' : rankKey === 'tanhua' ? '\u63A2\u82B1' : '\u8FDB\u58EB'),
          emotion: '\u656C'
        }]
      };

      if (!GM.chars) GM.chars = [];
      // 去重·避免已存在
      if (!GM.chars.find(function(c){ return c && c.name === newChar.name; })) {
        (typeof TM !== 'undefined' && TM.Roster ? TM.Roster.addChar : function(_c){ GM.chars.push(_c); })(newChar);
      }
      return newChar;
    } catch(e) {
      console.warn('[科举·G2] 第' + attempt + '次生成失败', e);
      if (attempt >= 3) { _kejuBasicRecruit(candidate, rankKey === 'zhuangyuan' ? '\u72B6\u5143' : rankKey === 'bangyan' ? '\u699C\u773C' : rankKey === 'tanhua' ? '\u63A2\u82B1' : '\u8FDB\u58EB'); return; }
    }
  }
}

/** G1·未纳入进士填入 officeTree 空缺 */
function _kejuAllocateGradsToOffices(unsavedGrads) {
  if (!unsavedGrads || !unsavedGrads.length || !GM.officeTree) return;
  var targetTitles = ['\u77E5\u53BF', '\u4E3B\u7C3F', '\u53BF\u4E1E', '\u6559\u8C15', '\u63A8\u5B98', '\u4E3B\u7C3F', '\u5178\u53F2'];
  var vacancies = [];
  function walk(nodes) {
    nodes.forEach(function(n){
      if (!n) return;
      if (n.positions) n.positions.forEach(function(pos){
        if (!pos.holder && pos.name && targetTitles.some(function(t){ return pos.name.indexOf(t) >= 0; })) {
          vacancies.push({ dept: n.name, pos: pos });
        }
      });
      if (n.subs) walk(n.subs);
    });
  }
  walk(GM.officeTree);

  unsavedGrads.forEach(function(g){
    if (vacancies.length === 0) return;
    var v = vacancies.shift();
    v.pos.holder = g.name;
    v.pos.holderSource = '\u79D1\u4E3E\u00B7\u672A\u5177\u8C61';
    v.pos._kejuRank = g.rank;
    v.pos._kejuPoolRef = g._examId;  // 反查
    g.allocatedOffice = v.dept + '/' + v.pos.name;
  });
  if (typeof addEB === 'function') {
    var placed = unsavedGrads.filter(function(g){ return g.allocatedOffice; }).length;
    if (placed > 0) addEB('\u79D1\u4E3E', '\u65B0\u8FDB\u58EB ' + placed + ' \u4EBA\u586B\u5165\u5730\u65B9\u7F3A\u989D');
  }
}

/** G2·阶层+党派+吏治影响 */
function _kejuAggregateGradsEffect(allGrads, exam) {
  if (!allGrads || !allGrads.length) return;
  var total = allGrads.length;

  // 阶层
  var classBreakdown = {};
  allGrads.forEach(function(g){
    var cls = g.class || '\u5BD2\u95E8';
    classBreakdown[cls] = (classBreakdown[cls] || 0) + 1;
  });
  if (GM.classes) {
    Object.keys(classBreakdown).forEach(function(clsName){
      var share = classBreakdown[clsName] / total;
      var match = GM.classes.find(function(cl){ return cl.name === clsName || (cl.name.indexOf(clsName)>=0 || clsName.indexOf(cl.name)>=0); });
      if (match) {
        var _kgGate = (typeof TM !== 'undefined' && TM.ClassEngine && typeof TM.ClassEngine.gateSatisfaction === 'function');
        if (share > 0.4) {
          if (_kgGate) TM.ClassEngine.gateSatisfaction(GM, match, 3, { turn: GM.turn, source: 'keju', reason: '登科同侪占比厚' });
          else match.satisfaction = Math.min(100, (match.satisfaction||50) + 3);
        } else if (share < 0.15) {
          if (_kgGate) TM.ClassEngine.gateSatisfaction(GM, match, -2, { turn: GM.turn, source: 'keju', reason: '登科同侪占比薄' });
          else match.satisfaction = Math.max(0, (match.satisfaction||50) - 2);
        }
      }
    });
  }

  // 党派·主考官党派吸纳 20%
  if (exam && exam.chiefExaminer && GM.parties) {
    var examiner = findCharByName(exam.chiefExaminer);
    if (examiner && examiner.party && examiner.party !== '\u65E0\u515A\u6D3E' && examiner.party !== '\u65E0\u515A') {
      // v7.1\u00B7E2\u00B7\u8FDB\u58EB ch.party \u5DF2 100% \u5199\u5165 (\u5728 _aiGenerateFullCharacter / _kejuBasicRecruit \u65F6 examiner.party fallback)
      // \u6B64\u5904 GM.parties.influence \u4ECD\u6309 20% \u7B97\u00B7\u907F\u514D\u515A\u6D3E\u5931\u8861 (red line\u00B7\u4FDD\u6301\u539F\u7B97\u6CD5\u4E0D\u53D8)
      var absorbed = Math.floor(total * 0.20);  // red line\u00B7\u4FDD\u6301 20%\u00B7avoid \u515A unbalanced
      var targetParty = GM.parties.find(function(p){ return p.name === examiner.party; });
      if (targetParty) {
        targetParty.influence = Math.min(100, (targetParty.influence||0) + Math.round(absorbed * 0.5));
        if (typeof addEB === 'function') addEB('\u79D1\u4E3E', examiner.party + ' \u5438\u7EB3\u65B0\u8FDB\u58EB ' + absorbed + ' \u4EBA\u00B7\u5F71\u54CD\u529B +' + Math.round(absorbed*0.5));
      }
    }
  }

  // 吏治·按质量调整
  var avgScore = allGrads.reduce(function(s, g){ return s + (g.score||0); }, 0) / total;
  if (GM.eraState && typeof GM.eraState.bureaucracyStrength === 'number') {
    if (avgScore > 75) GM.eraState.bureaucracyStrength = Math.min(1, GM.eraState.bureaucracyStrength + 0.03);
    else if (avgScore < 50) GM.eraState.bureaucracyStrength = Math.max(0, GM.eraState.bureaucracyStrength - 0.02);
  }
}

/** v7.1·D5·deprecated·eager 已在 _kejuFinalize 全跑·此 fn 保 backwards-compat (老存档 / 外部 caller) */
async function crystallizeKejuGrad(postRef) {
  if (!postRef || !postRef._kejuRank || postRef._crystallized) return;
  if (!crystallizeKejuGrad._warned) {
    console.info('[科举·D5] crystallizeKejuGrad deprecated·v7.1 eager 已在 _kejuFinalize 全跑·本次为 backwards-compat fallback');
    crystallizeKejuGrad._warned = true;
  }
  // 在 history 中找对应科举记录的 gradPool
  var gradEntry = null;
  (P.keju.history || []).forEach(function(h){
    if (gradEntry) return;
    if (h.gradPool) {
      var g = h.gradPool.find(function(x){ return x.name === postRef.holder; });
      if (g) gradEntry = g;
    }
  });
  // 不在 history 里·从 postRef 本身构造 minimal candidate
  if (!gradEntry) {
    gradEntry = { name: postRef.holder, rank: postRef._kejuRank, class: '\u5BD2\u95E8', age: 25 };
  }
  var rankKey = gradEntry.rank <= 20 ? 'erjia' : 'sanjia';
  await _aiGenerateFullCharacter(gradEntry, rankKey);
  postRef._crystallized = true;
}

// 暴露到 window
if (typeof window !== 'undefined') {
  window.crystallizeKejuGrad = crystallizeKejuGrad;
}

// P7: 科举入仕自动铨选——每回合检查待铨进士，2回合后自动分配到空缺低级职位
function _kejuAutoAssign() {
  if (!GM._kejuPendingAssignment || GM._kejuPendingAssignment.length === 0) return;
  var assigned = [];
  var assignmentWaitTurns = (typeof turnsForMonths === 'function') ? turnsForMonths(2) : 2;
  var assignmentExpireTurns = (typeof turnsForMonths === 'function') ? turnsForMonths(6) : 6;
  GM._kejuPendingAssignment = GM._kejuPendingAssignment.filter(function(p) {
    // 等待约2个月（模拟铨选时间）
    if (GM.turn - p.enrollTurn < assignmentWaitTurns) return true;
    var ch = typeof findCharByName === 'function' ? findCharByName(p.name) : null;
    if (!ch || ch.alive === false) return false;
    // 已有官职则移除
    if (ch.officialTitle || ch.title) return false;
    // 查找空缺低级职位
    var bestPost = null;
    if (GM.officeTree) {
      (function walk(nodes) {
        nodes.forEach(function(n) {
          if (n.positions) n.positions.forEach(function(pos) {
            if (!pos.holder) {
              var r = parseInt(pos.rank) || 9;
              if (r >= 7 && (!bestPost || r < bestPost.rank)) {
                bestPost = { dept: n.name, pos: pos.name, rank: r, ref: pos };
              }
            }
          });
          if (n.subs) walk(n.subs);
        });
      })(GM.officeTree);
    }
    if (bestPost) {
      if (typeof _offSeatPersonInPosition === 'function') {
        _offSeatPersonInPosition(bestPost.ref, p.name, { replace: false });
      } else if (typeof _offAppointPerson === 'function') {
        _offAppointPerson(bestPost.ref, p.name);
      } else {
        bestPost.ref.holder = p.name;
      }
      ch.title = bestPost.pos;
      ch.officialTitle = bestPost.dept + bestPost.pos;
      assigned.push(p.name + '任' + bestPost.dept + bestPost.pos);
      if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.addMemory) {
        NpcMemorySystem.addMemory(p.name, '科举入仕，初授' + bestPost.pos + '，踏上仕途', 7, 'career');
      }
      return false;
    }
    // 无空缺则继续等待，但超过约6个月就放弃
    return GM.turn - p.enrollTurn < assignmentExpireTurns;
  });
  if (assigned.length > 0 && typeof addEB === 'function') {
    var _quanDept2 = (typeof findOfficeByFunction === 'function') ? (findOfficeByFunction('铨选') || findOfficeByFunction('吏')) : null;
    var _deptLabel = (_quanDept2 && _quanDept2.dept) ? _quanDept2.dept : '吏部';
    addEB('铨选', _deptLabel + '铨选：' + assigned.join('；'));
  }
}
if (typeof SettlementPipeline !== 'undefined') {
  SettlementPipeline.register('kejuAutoAssign', '科举铨选', _kejuAutoAssign, 55, 'perturn');
}

/**
 * 关闭科举界面
 */
function closeKejuModal() {
  var modal = document.getElementById('keju-modal');
  if (modal) modal.remove();
}

// ═══════════════════════════════════════════════════════════════════════
//  常朝 2.0——状态机驱动的朝堂流程
//  流程：筹备弹窗 → 开场 → 议程队列循环(7阶段状态机) → 退朝
//  每议程：启奏→奏报→议论(2-3轮)→裁决→回应→延续→结束
// ═══════════════════════════════════════════════════════════════════════

// ─── 阶段 1：朝前筹备弹窗 ───
