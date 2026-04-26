// @ts-nocheck
'use strict';

/* ═══════════════════════════════════════════════════════════════════════
 *  tm-tinyi-v3.js — 廷议 V3·七阶段重构（波 1）
 *
 *  阶段：
 *    [波 1] §3  阶段 0 议前预审   (留中 / 私决 / 下议 / 明发)
 *    [波 2] §-  阶段 1 起议站班   (三班布局 + 潮汐条)
 *    [波 2] §-  阶段 2 分轮辩议   (主奏 / 同党附议 / 敌党驳议 / 中立权衡)
 *    [波 3] §-  阶段 3 廷推       (人事议题·钦定 / 廷推 / 暂阙)
 *    [波 1] §4  阶段 4 钦定档位   (S/A/B/C/D 流程级特权)
 *    [波 2] §-  阶段 5 草诏拟旨   (选官 + prestige/favor 反馈)
 *    [波 3] §-  阶段 6 用印颁行   (朝代差异化 + 党派阻挠)
 *    [波 4] §-  阶段 7 追责回响   (N 回合后强制复盘)
 *
 *  跨阶段：
 *    [波 1] §1  党派访问层   (GM.parties 动态层封装·剧本 + 运行时合并)
 *    [波 1] §2  实时插言     (5 选项浮层·任意时刻打断 AI 流式输出)
 *    [波 1] §5  威权阶梯     (GM.unlockedRegalia[] 永久解锁)
 *    [波 1] §6  入口路由     (_cy_pickMode 'tinyi' → _ty3_open)
 *
 *  数据契约：
 *    GM.parties[]              — 运行时党派(剧本初始化时从 P.parties copy)
 *    GM.unlockedRegalia[]      — 永久威权特权清单·跨场廷议保留
 *    GM._ccHeldItems[]         — 留中册(议前预审「留中」写入·已存在)
 *    GM._pendingTinyiTopics[]  — 待议册(已存在·议前预审「明发」从此读取)
 *    CY._ty3                   — 廷议会话状态(替代 CY._ty2 的 v3 子集)
 *    CY._ty3_archonGrade       — 当前档位(S/A/B/C/D)
 *
 *  入口：_ty3_open(seedTopic)
 *    seedTopic 可来自 GM._pendingTinyiTopics·或玩家手动新议题
 * ═══════════════════════════════════════════════════════════════════════ */

// ─── CSS 自动加载（一次性） ───
(function _ty3_loadCss() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('ty3-css')) return;
  var link = document.createElement('link');
  link.id = 'ty3-css';
  link.rel = 'stylesheet';
  link.href = 'tm-tinyi-v3.css?v=20260426y';
  document.head.appendChild(link);
})();

// ═══════════════════════════════════════════════════════════════════════
//  §1·党派访问层
// ═══════════════════════════════════════════════════════════════════════
// 设计原则：
//   - GM.parties[] 已在 tm-patches.js L1435 初始化(从 P.parties 按 sid 过滤)
//   - 推演阶段 tm-endturn-ai-infer.js 已支持 party_splinter / party_disband
//   - v3 不另设动态层·直接读 GM.parties·写也写到 GM.parties
//   - 运行时党派增删改全经此处·便于 §6 用印阻挠 / §7 追责 hook

function _ty3_getParties() {
  return Array.isArray(GM.parties) ? GM.parties : [];
}

function _ty3_getPartyObj(name) {
  if (!name) return null;
  return _ty3_getParties().find(function(p){ return p && p.name === name; }) || null;
}

function _ty3_getOpposingParties(partyName) {
  var p = _ty3_getPartyObj(partyName);
  if (!p || !Array.isArray(p.enemies)) return [];
  var ret = [];
  p.enemies.forEach(function(en) {
    var po = _ty3_getPartyObj(en);
    if (po) ret.push(po);
  });
  return ret;
}

function _ty3_getAlliedParties(partyName) {
  var p = _ty3_getPartyObj(partyName);
  if (!p || !Array.isArray(p.allies)) return [];
  var ret = [];
  p.allies.forEach(function(al) {
    var po = _ty3_getPartyObj(al);
    if (po) ret.push(po);
  });
  return ret;
}

// 党派现有成员列表(优先看 GM.chars 中 ch.party===partyName·补 P.parties.members 字符串拆分)
function _ty3_getPartyMembers(partyName) {
  if (!partyName) return [];
  var byName = {};
  // 先从 GM.chars 抓所有 ch.party === partyName
  (GM.chars||[]).forEach(function(c) {
    if (c && c.party === partyName && c.alive !== false) byName[c.name] = c;
  });
  // 再从党派对象的 members 字符串补(可能是 "魏忠贤·崔呈秀·田尔耕")
  var p = _ty3_getPartyObj(partyName);
  if (p && typeof p.members === 'string') {
    p.members.split(/[·、,，\s]+/).forEach(function(nm) {
      nm = (nm||'').trim();
      if (!nm || byName[nm]) return;
      var ch = (typeof findCharByName === 'function') ? findCharByName(nm) : null;
      if (ch && ch.alive !== false) byName[nm] = ch;
    });
  }
  return Object.values(byName);
}

// 党魁角色(优先 leader 字段·次选 leadership.chief)
function _ty3_getPartyLeader(partyName) {
  var p = _ty3_getPartyObj(partyName);
  if (!p) return null;
  var nm = p.leader || (p.leadership && p.leadership.chief) || '';
  if (!nm) return null;
  return (typeof findCharByName === 'function') ? findCharByName(nm) : null;
}

// 影响力 0-100·剧本可配·缺省 50
function _ty3_partyInfluence(partyName) {
  var p = _ty3_getPartyObj(partyName);
  if (!p) return 0;
  return parseInt(p.influence, 10) || 50;
}

// 凝聚力 0-100·缺省 50
function _ty3_partyCohesion(partyName) {
  var p = _ty3_getPartyObj(partyName);
  if (!p) return 0;
  return parseInt(p.cohesion, 10) || 50;
}

// ─── 党争描述化(史实修正：党争是状态而非数值) ───
// GM.partyStrife 后端数值保留作内部计算·UI 一律显示状态描述
function _ty3_strifeLabel(value) {
  var v = (typeof value === 'number') ? value :
          (typeof GM.partyStrife === 'number' ? GM.partyStrife : 50);
  if (v <= 20) return { state: '朝堂清明', flavor: '海晏河清·百官同心', tier: 'pristine' };
  if (v <= 40) return { state: '朝局稳健', flavor: '朝纲粗振·小有龃龉', tier: 'stable' };
  if (v <= 60) return { state: '党争寻常', flavor: '朝堂分歧·或有相讦', tier: 'normal' };
  if (v <= 80) return { state: '党争激烈', flavor: '党争已炽·相伐攻讦', tier: 'fierce' };
  return { state: '党祸滔天', flavor: '党祸已成·势同水火', tier: 'catastrophic' };
}

// 党争变化的描述化(替代 +5/-3 等)
function _ty3_strifeDelta(delta) {
  if (!delta || delta === 0) return '';
  var d = Math.abs(delta);
  if (delta > 0) {
    if (d >= 10) return '党祸大兴';
    if (d >= 6) return '相伐益深';
    if (d >= 3) return '朝堂愈裂';
    return '相讦微生';
  } else {
    if (d >= 10) return '相伐顿息';
    if (d >= 6) return '朝堂渐和';
    if (d >= 3) return '相讦稍息';
    return '朝局微敛';
  }
}

// 同时给跨阶段·若状态档位跨越则给"质变"描述
function _ty3_strifeChange(oldVal, newVal) {
  var oldL = _ty3_strifeLabel(oldVal);
  var newL = _ty3_strifeLabel(newVal);
  var deltaText = _ty3_strifeDelta(newVal - oldVal);
  if (oldL.tier !== newL.tier) {
    // 跨阶段·提示状态变迁
    return deltaText + '·朝局已转「' + newL.state + '」';
  }
  return deltaText;
}

// 党派对议题的预估倾向(读 policyStance + focal_disputes)
// 返回 'support' | 'oppose' | 'neutral'
function _ty3_partyStanceOnTopic(partyName, topicText, topicType) {
  var p = _ty3_getPartyObj(partyName);
  if (!p) return 'neutral';
  var t = (topicText || '').toLowerCase();
  var stances = (p.policyStance || []).map(function(s){return (s||'').toLowerCase();});
  // focal_disputes[].topic 命中 → 党派必然有立场
  var disputes = (p.focal_disputes || []);
  for (var i = 0; i < disputes.length; i++) {
    if (disputes[i] && disputes[i].topic && t.indexOf(disputes[i].topic.toLowerCase()) >= 0) {
      return disputes[i].stake === 'support' ? 'support' : 'oppose';
    }
  }
  // policyStance 关键字软匹配
  for (var j = 0; j < stances.length; j++) {
    var sw = stances[j];
    if (!sw) continue;
    if (t.indexOf(sw) >= 0) return 'support';
    // 反向(如 stance = "反阉" → 议题含"魏忠贤"或"阉党" 则支持)
    var negMatch = sw.match(/^反(.+)/);
    if (negMatch && t.indexOf(negMatch[1]) >= 0) return 'oppose';
  }
  return 'neutral';
}

// ═══════════════════════════════════════════════════════════════════════
//  §2·实时插言机制(5 选项浮层·跨阶段贯穿)
// ═══════════════════════════════════════════════════════════════════════
// 设计：在 chaoyi 弹窗右下角浮一枚「朕意」按钮·点击开 5 选项面板。
// 复用 v2 已有的 CY._abortChaoyi + CY._pendingPlayerLine 机制：
//   - 点「训示」 → CY._pendingPlayerLine = playerText·下一轮 AI 看到玩家话语
//   - 点「让 X 起对」 → 将 X 名字推入 _ty3_pendingPlayerSummon·下一发言者改为 X
//   - 点「另有要事」 → CY._abortChaoyi = true·中止全部循环
//   - 点「卿且退下」 → 当前发言者 favor-3·CY._abortChaoyi 当人后切下一位
//   - 点「请 Y 党党首论之」 → 党魁名推入 summon·并把议题转给该党首立场表态

var _ty3_interjectMounted = false;

function _ty3_mountInterjectButton() {
  if (_ty3_interjectMounted) return;
  if (typeof document === 'undefined') return;
  var btn = document.getElementById('ty3-interject-btn');
  if (btn) { _ty3_interjectMounted = true; return; }
  btn = document.createElement('div');
  btn.id = 'ty3-interject-btn';
  btn.title = '朕欲发言·任意时刻可打断';
  btn.innerHTML = '<span class="ty3-ij-icon">📜</span><span class="ty3-ij-text">朕意</span>';
  btn.onclick = _ty3_openInterjectPanel;
  btn.style.display = 'none';
  document.body.appendChild(btn);
  _ty3_interjectMounted = true;
}

// 在 _ty3_open 时显示·closeChaoyi 时隐藏
function _ty3_showInterjectButton() {
  _ty3_mountInterjectButton();
  var btn = document.getElementById('ty3-interject-btn');
  if (btn) btn.style.display = '';
}

function _ty3_hideInterjectButton() {
  var btn = document.getElementById('ty3-interject-btn');
  if (btn) btn.style.display = 'none';
  var pn = document.getElementById('ty3-interject-panel');
  if (pn) pn.remove();
}

function _ty3_openInterjectPanel() {
  var existing = document.getElementById('ty3-interject-panel');
  if (existing) { existing.remove(); return; }
  var pn = document.createElement('div');
  pn.id = 'ty3-interject-panel';
  pn.innerHTML =
    '<div class="ty3-ij-title">〔 朕 欲 发 言 〕</div>'
    + '<div class="ty3-ij-row" onclick="_ty3_doInterjectTrain()">📜 朕来训示<span class="ty3-ij-hint">直接键入·注入流式生成</span></div>'
    + '<div class="ty3-ij-row" onclick="_ty3_doInterjectSummon()">👁 朕欲让某人起对<span class="ty3-ij-hint">指定一员立刻发言</span></div>'
    + '<div class="ty3-ij-row" onclick="_ty3_doInterjectPartyLeader()">🪄 朕请某党党首论之<span class="ty3-ij-hint">让某党党首立刻表态</span></div>'
    + '<div class="ty3-ij-row" onclick="_ty3_doInterjectSilence()">🔇 卿且退下<span class="ty3-ij-hint">让正在说话者闭嘴·favor-3</span></div>'
    + '<div class="ty3-ij-row" onclick="_ty3_doInterjectAbort()">⚡ 朕另有要事<span class="ty3-ij-hint">中止本场廷议·议题留中</span></div>'
    + '<div class="ty3-ij-foot"><button onclick="this.closest(\'div\').remove();">退下</button></div>';
  document.body.appendChild(pn);
}

function _ty3_doInterjectTrain() {
  var pn = document.getElementById('ty3-interject-panel'); if (pn) pn.remove();
  var q = (typeof prompt === 'function') ? prompt('陛下欲训示何言？') : '';
  if (!q || !q.trim()) return;
  q = q.trim();
  // 复用 v2 的 _pendingPlayerLine 机制·下一轮 AI 看到
  if (typeof CY !== 'undefined') CY._pendingPlayerLine = q;
  // 立刻气泡显示
  if (typeof addCYBubble === 'function') addCYBubble('皇帝', q, false);
  if (typeof toast === 'function') toast('朕意已注·下一发言者将据此回应');
}

function _ty3_doInterjectSummon() {
  var pn = document.getElementById('ty3-interject-panel'); if (pn) pn.remove();
  // 列出在场可发言者
  var pool = [];
  if (CY._ty2 && Array.isArray(CY._ty2.attendees)) pool = CY._ty2.attendees.slice();
  else if (CY._ty3 && Array.isArray(CY._ty3.attendees)) pool = CY._ty3.attendees.slice();
  if (pool.length === 0) { if (typeof toast === 'function') toast('当前无在议名册'); return; }
  var name = (typeof prompt === 'function') ? prompt('指定何人起对？\n在议名册：' + pool.join('、')) : '';
  if (!name || !name.trim()) return;
  name = name.trim();
  if (pool.indexOf(name) < 0) {
    if (typeof toast === 'function') toast('「' + name + '」不在议·无法起对');
    return;
  }
  CY._ty3_pendingSummon = name;
  if (typeof addCYBubble === 'function') addCYBubble('皇帝', '——着' + name + '起对。', false);
  if (typeof toast === 'function') toast('朕已点 ' + name + ' 起对');
}

function _ty3_doInterjectPartyLeader() {
  var pn = document.getElementById('ty3-interject-panel'); if (pn) pn.remove();
  var parties = _ty3_getParties();
  if (parties.length === 0) { if (typeof toast === 'function') toast('当前无党派可召'); return; }
  var names = parties.map(function(p){ return p.name + '(' + (p.leader||'?') + ')'; }).join('、');
  var pn1 = (typeof prompt === 'function') ? prompt('召何党党首论之？\n党派：' + names + '\n请输入党派名：') : '';
  if (!pn1 || !pn1.trim()) return;
  pn1 = pn1.trim();
  var leader = _ty3_getPartyLeader(pn1);
  if (!leader) { if (typeof toast === 'function') toast('「' + pn1 + '」党首未具象化·无法召'); return; }
  CY._ty3_pendingSummon = leader.name;
  if (typeof addCYBubble === 'function') addCYBubble('皇帝', '——着' + pn1 + '党首' + leader.name + '论之。', false);
  if (typeof toast === 'function') toast('朕已召 ' + leader.name + ' 表态');
}

function _ty3_doInterjectSilence() {
  var pn = document.getElementById('ty3-interject-panel'); if (pn) pn.remove();
  // 中止当前 AI 输出·当前发言者 favor-3
  if (typeof CY !== 'undefined') {
    if (CY.abortCtrl && typeof CY.abortCtrl.abort === 'function') {
      try { CY.abortCtrl.abort(); } catch(_){}
    }
    // 找当前发言者(最近一气泡 cy-bubble 上有 name)
    var lastSpeaker = '';
    try {
      var bubbles = document.querySelectorAll('#cy-body .cy-bubble');
      if (bubbles.length > 0) {
        var last = bubbles[bubbles.length - 1];
        var head = last.parentElement && last.parentElement.querySelector('div');
        if (head) lastSpeaker = (head.textContent||'').trim();
      }
    } catch(_){}
    if (lastSpeaker) {
      var ch = (typeof findCharByName === 'function') ? findCharByName(lastSpeaker) : null;
      if (ch) {
        ch.favor = Math.max(-100, (ch.favor||0) - 3);
        // 该党 cohesion-1(公开下脸)
        if (ch.party) {
          var pp = _ty3_getPartyObj(ch.party);
          if (pp) pp.cohesion = Math.max(0, ((parseInt(pp.cohesion,10)||50) - 1));
        }
        if (typeof addCYBubble === 'function') addCYBubble('内侍', '（' + lastSpeaker + ' 触龙颜·恩眷顿损。）', true);
      }
    }
    if (typeof addCYBubble === 'function') addCYBubble('皇帝', '——卿且退下。', false);
  }
  if (typeof toast === 'function') toast('当前发言者 favor-3');
}

function _ty3_doInterjectAbort() {
  var pn = document.getElementById('ty3-interject-panel'); if (pn) pn.remove();
  if (typeof CY !== 'undefined') CY._abortChaoyi = true;
  // 议题留中
  var topic = '';
  if (CY._ty2 && CY._ty2.topic) topic = CY._ty2.topic;
  else if (CY._ty3 && CY._ty3.topic) topic = CY._ty3.topic;
  if (topic) {
    if (!GM._ccHeldItems) GM._ccHeldItems = [];
    GM._ccHeldItems.push({ topic: topic, from: '廷议中止', turn: GM.turn });
    if (typeof addCYBubble === 'function') addCYBubble('皇帝', '朕另有要事·此事留中。', false);
  }
  if (typeof toast === 'function') toast('廷议中止·议题入留中册');
}

// ═══════════════════════════════════════════════════════════════════════
//  §3·阶段 0·议前预审(留中 / 私决 / 下议 / 明发)
// ═══════════════════════════════════════════════════════════════════════
// 接 GM._pendingTinyiTopics·让玩家选择四种处置方式·避免直接进廷议无回旋

function _ty3_open(seedTopic) {
  // 入口·若有传 seedTopic 则直接进入预审·否则展示待议册让玩家选
  _ty3_showInterjectButton();
  _ty3_openPreAudit(seedTopic);
}

function _ty3_openPreAudit(seedTopic) {
  var bg = document.createElement('div');
  bg.id = 'ty3-preaudit-bg';
  bg.style.cssText = 'position:fixed;inset:0;z-index:1300;background:rgba(0,0,0,0.78);display:flex;align-items:center;justify-content:center;';

  var pending = (GM._pendingTinyiTopics || []).slice();
  var topicSeed = seedTopic || (pending.length > 0 ? pending[0] : null);
  var topicText = '';
  var topicMeta = null;
  if (topicSeed) {
    topicText = (typeof topicSeed === 'string') ? topicSeed : (topicSeed.topic || '');
    if (typeof topicSeed === 'object') topicMeta = topicSeed;
  }

  var html = '<div class="ty3-pa-modal">';
  html += '<div class="ty3-pa-title">〔 议 前 预 审 〕</div>';
  html += '<div class="ty3-pa-sub">陛下决断之前·先察议题之轻重缓急·从容择处</div>';

  // 议题输入区
  html += '<div class="ty3-pa-section"><div class="ty3-pa-label">议  题</div>';
  html += '<input id="ty3-pa-topic" placeholder="如：弹劾魏忠贤、北伐契丹、立嫡长为太子……" value="' + (topicText ? escHtml(topicText) : '') + '">';
  if (pending.length > 0) {
    html += '<select id="ty3-pa-pick" onchange="_ty3_paPickPending(this)">';
    html += '<option value="">— 从待议册选 —</option>';
    pending.forEach(function(p, i) {
      var t = (typeof p === 'string') ? p : (p.topic || '');
      var prop = (typeof p === 'object' && p.proposer) ? ' · ' + p.proposer + ' 奏' : '';
      html += '<option value="' + i + '">' + escHtml(t.slice(0, 50) + prop) + '</option>';
    });
    html += '</select>';
  }
  html += '</div>';

  // 主奏者横幅(若议题携带 proposer)
  html += '<div id="ty3-pa-proposer" class="ty3-pa-proposer" style="display:none;"></div>';

  // 弹劾疏正文(若议题来自推演弹劾·展开原疏)
  if (topicMeta && topicMeta.isAccusation && topicMeta.memorialContent) {
    html += '<div class="ty3-pa-section ty3-pa-memo">';
    html += '<div class="ty3-pa-memo-head">奏者：' + escHtml(topicMeta.accuser || '') + ' · 体裁：密揭</div>';
    html += '<div class="ty3-pa-memo-body">' + escHtml(topicMeta.memorialContent).replace(/\n/g, '<br>') + '</div>';
    html += '</div>';
  }

  // 党派形势预估
  html += '<div class="ty3-pa-section ty3-pa-forecast" id="ty3-pa-forecast"></div>';

  // 四种处置
  html += '<div class="ty3-pa-section"><div class="ty3-pa-label">陛下何如裁处</div>';
  html += '<div class="ty3-pa-options">';

  html += '<div class="ty3-pa-opt ty3-pa-hold" onclick="_ty3_paChoose(\'hold\')">'
    + '<div class="ty3-pa-opt-name">📥 留 中</div>'
    + '<div class="ty3-pa-opt-cost">皇权 -1</div>'
    + '<div class="ty3-pa-opt-desc">搁置一回合·奏者 prestige-2·世人议怠政</div>'
    + '</div>';

  html += '<div class="ty3-pa-opt ty3-pa-private" onclick="_ty3_paChoose(\'private\')">'
    + '<div class="ty3-pa-opt-name">🤐 私 决</div>'
    + '<div class="ty3-pa-opt-cost">皇威 +1</div>'
    + '<div class="ty3-pa-opt-desc">走御前奏对·与心腹密议·不公开</div>'
    + '</div>';

  html += '<div class="ty3-pa-opt ty3-pa-small" onclick="_ty3_paChoose(\'small\')">'
    + '<div class="ty3-pa-opt-name">🤝 下议·五人闭门</div>'
    + '<div class="ty3-pa-opt-cost">朝堂渐和</div>'
    + '<div class="ty3-pa-opt-desc">召三品以上 5 员·小范围议事</div>'
    + '</div>';

  html += '<div class="ty3-pa-opt ty3-pa-public" onclick="_ty3_paChoose(\'public\')">'
    + '<div class="ty3-pa-opt-name">📜 明 发·廷议</div>'
    + '<div class="ty3-pa-opt-cost">完整七阶段</div>'
    + '<div class="ty3-pa-opt-desc">召三品以上百官·四轮辩议·公开裁决</div>'
    + '</div>';

  html += '</div></div>';

  // 修·历史现实：古代无人公开结党·结党是罪名而非身份·删除"册立"按钮
  // 推演若发现 X 名望日盛·spawn 的是「弹劾结党」议题(见 §15)·
  // 玩家在该议题上准奏 → 自动触发党派 spawn(status='被劾')

  // 取消
  html += '<div class="ty3-pa-foot">';
  html += '<button class="bt" onclick="_ty3_paCancel()">罢·改日再议</button>';
  html += '</div>';
  html += '</div>';

  bg.innerHTML = html;
  document.body.appendChild(bg);
  _ty3_paUpdateForecast();
  _ty3_paUpdateProposer(topicMeta);

  // 议题修改时重算预估
  var inp = document.getElementById('ty3-pa-topic');
  if (inp) inp.oninput = _ty3_paUpdateForecast;

  // 暂存 meta
  CY._ty3_paMeta = topicMeta;
}

// 主奏者横幅渲染(读 meta 中的 proposer/proposerTitle/proposerParty/proposerInfluence/proposerReason)
function _ty3_paUpdateProposer(meta) {
  var box = document.getElementById('ty3-pa-proposer');
  if (!box) return;
  if (!meta || !meta.proposer) {
    box.style.display = 'none';
    box.innerHTML = '';
    return;
  }
  var inflTxt = (typeof meta.proposerInfluence === 'number' && meta.proposerInfluence > 0)
    ? ' · 影响 ' + meta.proposerInfluence : '';
  var partyTxt = meta.proposerParty ? '<span class="ty3-pa-prop-party">' + escHtml(meta.proposerParty) + '</span>' : '<span class="ty3-pa-prop-noparty">无党</span>';
  var html = '<div class="ty3-pa-prop-head">主 奏</div>';
  html += '<div class="ty3-pa-prop-line">';
  html += '<span class="ty3-pa-prop-name">' + escHtml(meta.proposer) + '</span>';
  if (meta.proposerTitle) html += '<span class="ty3-pa-prop-title">' + escHtml(meta.proposerTitle) + '</span>';
  html += partyTxt;
  if (inflTxt) html += '<span class="ty3-pa-prop-infl">' + escHtml(inflTxt) + '</span>';
  html += '</div>';
  if (meta.proposerReason) {
    html += '<div class="ty3-pa-prop-reason">「' + escHtml(meta.proposerReason) + '」</div>';
  }
  if (meta.from) {
    html += '<div class="ty3-pa-prop-from">' + escHtml(meta.from) + '</div>';
  }
  box.style.display = 'block';
  box.innerHTML = html;
}

function _ty3_paPickPending(sel) {
  if (!sel) return;
  var i = parseInt(sel.value, 10);
  var pending = GM._pendingTinyiTopics || [];
  if (isNaN(i) || !pending[i]) return;
  var item = pending[i];
  var t = (typeof item === 'string') ? item : (item.topic || '');
  var inp = document.getElementById('ty3-pa-topic');
  if (inp) inp.value = t;
  CY._ty3_paMeta = (typeof item === 'object') ? item : null;
  _ty3_paUpdateForecast();
  _ty3_paUpdateProposer(CY._ty3_paMeta);
}

function _ty3_paUpdateForecast() {
  var fc = document.getElementById('ty3-pa-forecast');
  if (!fc) return;
  var inp = document.getElementById('ty3-pa-topic');
  var topic = (inp && inp.value || '').trim();
  if (!topic) { fc.innerHTML = '<div class="ty3-pa-forecast-empty">输入议题以预估党派形势</div>'; return; }

  // 计算各党立场预估
  var parties = _ty3_getParties();
  // fallback: GM.parties 为空时·按势力 GM.facs 估算(仅做粗略立场分布)
  if (parties.length === 0) {
    var facs = (GM.facs || []).filter(function(f){ return f && f.name; });
    if (facs.length === 0) {
      fc.innerHTML = '<div class="ty3-pa-forecast-empty">朝中无党无派·议题以人主奏 — 廷议将以人立论</div>';
      return;
    }
    // 简易：列出势力名作为参考
    var html0 = '<div class="ty3-pa-forecast-title">朝中势力(无党派记录·展示势力以备参)</div>';
    html0 += '<div class="ty3-pa-faction-list">';
    facs.slice(0, 6).forEach(function(f){ html0 += '<span style="color:var(--ty3-ink-mid,#4a3520);">' + escHtml(f.name) + '</span>'; });
    html0 += '</div>';
    html0 += '<div class="ty3-pa-forecast-tip" style="font-style:italic;">议题立场以个人 prestige+党派偏好综合·廷议中会逐一表态</div>';
    fc.innerHTML = html0;
    return;
  }
  var support = [], oppose = [], neutral = [];
  parties.forEach(function(p) {
    var s = _ty3_partyStanceOnTopic(p.name, topic);
    var entry = { name: p.name, infl: _ty3_partyInfluence(p.name) };
    if (s === 'support') support.push(entry);
    else if (s === 'oppose') oppose.push(entry);
    else neutral.push(entry);
  });
  var supSum = support.reduce(function(a,b){return a + b.infl;}, 0);
  var oppSum = oppose.reduce(function(a,b){return a + b.infl;}, 0);
  var nSum = neutral.reduce(function(a,b){return a + b.infl;}, 0);
  var total = supSum + oppSum + nSum;
  var ratio = total > 0 ? Math.round((supSum - oppSum) / total * 100) : 0;

  var html = '<div class="ty3-pa-forecast-title">党派形势预估</div>';
  html += '<div class="ty3-pa-forecast-bar">';
  if (total > 0) {
    var supPct = Math.round(supSum / total * 100);
    var oppPct = Math.round(oppSum / total * 100);
    var nPct = 100 - supPct - oppPct;
    html += '<div class="ty3-pa-bar-sup" style="width:' + supPct + '%">' + (supPct >= 8 ? '支 ' + supPct + '%' : '') + '</div>';
    html += '<div class="ty3-pa-bar-n" style="width:' + nPct + '%">' + (nPct >= 8 ? '中 ' + nPct + '%' : '') + '</div>';
    html += '<div class="ty3-pa-bar-opp" style="width:' + oppPct + '%">' + (oppPct >= 8 ? '反 ' + oppPct + '%' : '') + '</div>';
  }
  html += '</div>';
  html += '<div class="ty3-pa-forecast-tip">' + (ratio > 20 ? '★ 议题占优·明发可能直冲 A 档以上' : ratio < -20 ? '⚠ 反对势众·明发恐危诏激变(D 档)' : '势均力敌·结果难料') + '</div>';

  // 列各阵营党派
  var listHtml = '';
  if (support.length > 0) {
    listHtml += '<span class="ty3-pa-faction-sup">支：' + support.map(function(e){return e.name + '(' + e.infl + ')';}).join('·') + '</span>';
  }
  if (oppose.length > 0) {
    listHtml += '<span class="ty3-pa-faction-opp">反：' + oppose.map(function(e){return e.name + '(' + e.infl + ')';}).join('·') + '</span>';
  }
  if (listHtml) html += '<div class="ty3-pa-faction-list">' + listHtml + '</div>';
  fc.innerHTML = html;
}

function _ty3_paChoose(mode) {
  var inp = document.getElementById('ty3-pa-topic');
  var topic = (inp && inp.value || '').trim();
  if (!topic) { if (typeof toast === 'function') toast('请输入议题'); return; }
  var meta = CY._ty3_paMeta || null;

  // 关弹窗
  var bg = document.getElementById('ty3-preaudit-bg');
  if (bg) bg.remove();

  // 从待议册移除(若来自待议)
  if (meta && GM._pendingTinyiTopics) {
    GM._pendingTinyiTopics = GM._pendingTinyiTopics.filter(function(x){ return x !== meta; });
  }

  // 四种处置分流(去除原 spawn 分支·古代无主动册党)
  if (mode === 'hold') return _ty3_paDoHold(topic, meta);
  if (mode === 'private') return _ty3_paDoPrivate(topic, meta);
  if (mode === 'small') return _ty3_paDoSmall(topic, meta);
  if (mode === 'public') return _ty3_paDoPublic(topic, meta);
}

function _ty3_paDoHold(topic, meta) {
  // 留中：进 GM._ccHeldItems·huangquan -1·奏者 prestige-2
  if (!GM._ccHeldItems) GM._ccHeldItems = [];
  GM._ccHeldItems.push({ topic: topic, from: '议前留中', turn: GM.turn });
  // 皇权 -1
  if (GM.huangquan && typeof GM.huangquan.index === 'number') GM.huangquan.index = Math.max(0, GM.huangquan.index - 1);
  else if (GM.vars && GM.vars['皇权'] && typeof GM.vars['皇权'].value === 'number') GM.vars['皇权'].value = Math.max(0, GM.vars['皇权'].value - 1);
  // 奏者 prestige-2(若 meta 有 proposer)
  if (meta && meta.proposer) {
    var ch = (typeof findCharByName === 'function') ? findCharByName(meta.proposer) : null;
    if (ch) ch.prestige = Math.max(0, (ch.prestige||50) - 2);
  }
  if (typeof toast === 'function') toast('「' + topic.slice(0,16) + '」入留中册·皇权-1');
  if (typeof addEB === 'function') addEB('议前预审', '议题「' + topic + '」留中');
  _ty3_hideInterjectButton();
  if (typeof closeChaoyi === 'function') closeChaoyi();
}

function _ty3_paDoPrivate(topic, meta) {
  // 私决：转御前·携带议题
  if (typeof addEB === 'function') addEB('议前预审', '议题「' + topic + '」转御前密议');
  // 皇威 +1
  if (GM.huangwei && typeof GM.huangwei.index === 'number') GM.huangwei.index = Math.min(100, GM.huangwei.index + 1);
  else if (GM.vars && GM.vars['皇威'] && typeof GM.vars['皇威'].value === 'number') GM.vars['皇威'].value = Math.min(100, GM.vars['皇威'].value + 1);
  // 注入议题到御前 setup·让 _yq2_openSetup 可读
  window._yq2_seedTopic = topic;
  if (typeof _yq2_openSetup === 'function') {
    _yq2_openSetup();
    // 自动填议题
    setTimeout(function() {
      var yqInp = document.getElementById('yq2-topic');
      if (yqInp && !yqInp.value) yqInp.value = topic;
    }, 50);
  } else if (typeof toast === 'function') toast('御前模块未就绪');
}

function _ty3_paDoSmall(topic, meta) {
  // 下议·5 人闭门：调 _ty2_openSetup·限召 5 人
  if (typeof addEB === 'function') addEB('议前预审', '议题「' + topic + '」转 5 人小议');
  // 党争 -3 (内部数值·UI 描述)
  var _oldStrife = (typeof GM.partyStrife === 'number') ? GM.partyStrife : 50;
  if (typeof GM.partyStrife === 'number') GM.partyStrife = Math.max(0, GM.partyStrife - 3);
  // 注入预填
  window._ty3_smallTopic = topic;
  window._ty3_smallMeta = meta;
  if (typeof _ty2_openSetup === 'function') {
    _ty2_openSetup();
    setTimeout(function() {
      var tIn = document.getElementById('ty2-topic');
      if (tIn) tIn.value = topic;
      // 限选 5 人(取消多余 default checked)
      var att = document.querySelectorAll('.ty2-attendee:checked');
      if (att.length > 5) {
        for (var i = 5; i < att.length; i++) att[i].checked = false;
      }
      if (typeof toast === 'function') toast('已限至 5 人小议·' + _ty3_strifeChange(_oldStrife, GM.partyStrife));
    }, 80);
  }
}

function _ty3_paDoPublic(topic, meta) {
  // 明发·完整廷议·波 2+ 直接走 v3 起议站班(不再调 v2 setup)
  if (typeof addEB === 'function') addEB('议前预审', '议题「' + topic + '」明发廷议');
  window._ty3_publicTopic = topic;
  window._ty3_publicMeta = meta;
  // 阶段 1·起议站班(波 2)
  if (typeof _ty3_phase1_openSeating === 'function') {
    _ty3_phase1_openSeating(topic, meta);
  } else if (typeof _ty2_openSetup === 'function') {
    // 兜底·波 2 函数未加载时退回 v2 setup
    _ty2_openSetup();
    setTimeout(function() {
      var tIn = document.getElementById('ty2-topic');
      if (tIn) tIn.value = topic;
    }, 80);
  }
}

function _ty3_paCancel() {
  var bg = document.getElementById('ty3-preaudit-bg');
  if (bg) bg.remove();
  CY._ty3_paMeta = null;
  _ty3_hideInterjectButton();
  if (typeof closeChaoyi === 'function') closeChaoyi();
}

// ═══════════════════════════════════════════════════════════════════════
//  §4·阶段 4·钦定档位重做(S/A/B/C/D 流程级特权)
// ═══════════════════════════════════════════════════════════════════════
// 接入点：override v2 _ty2_decide 末尾·或在 _ty2_finalEnd 之前调用
// 档位规则(读 huangwei.index + huangquan.index 或 vars 兼容路径)：
//   双 70+        → S 圣旨煌煌    跳过用印 + 草诏自由 + 反对党 cohesion-10
//   单 70+        → A 凛然奉旨    草诏快通 + 反对党党首 prestige-5
//   双 50-70      → B 勉强尊行    完整流程·中性
//   双 30-50      → C 众议汹汹    诏令打折·主奏党 cohesion-8
//   <30 或双<50   → D 危诏激变    硬推/妥协 二选

function _ty3_readHuangwei() {
  if (GM.huangwei && typeof GM.huangwei.index === 'number') return GM.huangwei.index;
  if (GM.vars && GM.vars['皇威'] && typeof GM.vars['皇威'].value === 'number') return GM.vars['皇威'].value;
  return 50;
}

function _ty3_readHuangquan() {
  if (GM.huangquan && typeof GM.huangquan.index === 'number') return GM.huangquan.index;
  if (GM.vars && GM.vars['皇权'] && typeof GM.vars['皇权'].value === 'number') return GM.vars['皇权'].value;
  return 50;
}

function _ty3_computeArchonGrade() {
  var hw = _ty3_readHuangwei();
  var hq = _ty3_readHuangquan();
  var min = Math.min(hw, hq);
  var max = Math.max(hw, hq);
  if (hw >= 70 && hq >= 70) return { grade: 'S', label: '圣旨煌煌', hw: hw, hq: hq };
  if (max >= 70) return { grade: 'A', label: '凛然奉旨', hw: hw, hq: hq };
  if (min >= 50) return { grade: 'B', label: '勉强尊行', hw: hw, hq: hq };
  if (min >= 30) return { grade: 'C', label: '众议汹汹', hw: hw, hq: hq };
  return { grade: 'D', label: '危诏激变', hw: hw, hq: hq };
}

// 应用档位效果(写党派 cohesion / 党魁 prestige / 主奏党)
function _ty3_applyArchonGrade(grade, opts) {
  // opts = { proposerParty, opposingParties[], decisionMode, topic }
  if (!opts) opts = {};
  var notes = [];
  var proposerParty = opts.proposerParty || '';
  var opposingNames = opts.opposingParties || [];
  if (typeof opposingNames === 'string') opposingNames = [opposingNames];

  // 各档效果
  if (grade === 'S') {
    notes.push('圣旨煌煌·跳过用印 + 草诏自由');
    // 反对党 cohesion-10
    opposingNames.forEach(function(pn) {
      var p = _ty3_getPartyObj(pn);
      if (p) { p.cohesion = Math.max(0, (parseInt(p.cohesion,10)||50) - 10); notes.push(pn + ' 凝聚力 -10'); }
    });
    // 主奏党 cohesion+3
    if (proposerParty) {
      var pp = _ty3_getPartyObj(proposerParty);
      if (pp) { pp.cohesion = Math.min(100, (parseInt(pp.cohesion,10)||50) + 3); }
    }
  } else if (grade === 'A') {
    notes.push('凛然奉旨·草诏快通');
    // 反对党党首 prestige-5
    opposingNames.forEach(function(pn) {
      var leader = _ty3_getPartyLeader(pn);
      if (leader) { leader.prestige = Math.max(0, (leader.prestige||50) - 5); notes.push(leader.name + ' 名望 -5'); }
    });
    // 主奏党党首 favor+10
    if (proposerParty) {
      var pl = _ty3_getPartyLeader(proposerParty);
      if (pl) { pl.favor = Math.min(100, (pl.favor||0) + 10); }
    }
  } else if (grade === 'B') {
    notes.push('勉强尊行·走完整流程');
  } else if (grade === 'C') {
    notes.push('众议汹汹·诏令折损 50% 落实');
    // 主奏党 cohesion-8
    if (proposerParty) {
      var pp2 = _ty3_getPartyObj(proposerParty);
      if (pp2) { pp2.cohesion = Math.max(0, (parseInt(pp2.cohesion,10)||50) - 8); notes.push(proposerParty + ' 凝聚力 -8'); }
    }
  } else if (grade === 'D') {
    notes.push('危诏激变·诏令被阻');
    // 不直接应用·待玩家选「硬推」或「妥协」
  }

  // 党争累加(各档)·UI 用描述·后端用数值
  var strifeDelta = { S: -2, A: -1, B: 0, C: 3, D: 6 }[grade] || 0;
  if (strifeDelta !== 0 && typeof GM.partyStrife === 'number') {
    var _strifeOld = GM.partyStrife;
    GM.partyStrife = Math.max(0, Math.min(100, GM.partyStrife + strifeDelta));
    var _strifeText = _ty3_strifeChange(_strifeOld, GM.partyStrife);
    if (_strifeText) notes.push(_strifeText);
  }

  return notes;
}

// D 档·硬推/妥协二选弹窗
function _ty3_dGradeChoice(callback) {
  var bg = document.createElement('div');
  bg.id = 'ty3-dgrade-bg';
  bg.style.cssText = 'position:fixed;inset:0;z-index:1310;background:rgba(60,0,0,0.78);display:flex;align-items:center;justify-content:center;';
  var html = '<div class="ty3-dg-modal">';
  html += '<div class="ty3-dg-title">⚠ 危 诏 激 变</div>';
  html += '<div class="ty3-dg-sub">皇威皇权双低·百官跪谏·诏令几近被阻。陛下何以处之？</div>';
  html += '<div class="ty3-dg-options">';
  html += '<div class="ty3-dg-opt ty3-dg-force" onclick="_ty3_dgPick(\'force\')">'
    + '<div class="ty3-dg-opt-name">⚔ 硬 推</div>'
    + '<div class="ty3-dg-opt-cost">皇权 -8 · 朝堂愈裂</div>'
    + '<div class="ty3-dg-opt-desc">独断推行·百官记恨·或生反复</div></div>';
  html += '<div class="ty3-dg-opt ty3-dg-yield" onclick="_ty3_dgPick(\'yield\')">'
    + '<div class="ty3-dg-opt-name">🤝 妥 协</div>'
    + '<div class="ty3-dg-opt-cost">议题留中·待再议</div>'
    + '<div class="ty3-dg-opt-desc">退一步·诏令重拟·保全颜面</div></div>';
  html += '</div></div>';
  bg.innerHTML = html;
  document.body.appendChild(bg);
  CY._ty3_dgCallback = callback;
}

function _ty3_dgPick(choice) {
  var bg = document.getElementById('ty3-dgrade-bg');
  if (bg) bg.remove();
  if (choice === 'force') {
    // 皇权 -8 · 朝堂愈裂(党争数值 +5)
    if (GM.huangquan && typeof GM.huangquan.index === 'number') GM.huangquan.index = Math.max(0, GM.huangquan.index - 8);
    else if (GM.vars && GM.vars['皇权']) GM.vars['皇权'].value = Math.max(0, (GM.vars['皇权'].value||50) - 8);
    var _oldS = (typeof GM.partyStrife === 'number') ? GM.partyStrife : 50;
    if (typeof GM.partyStrife === 'number') GM.partyStrife = Math.min(100, GM.partyStrife + 5);
    if (typeof toast === 'function') toast('硬推·皇权-8·' + _ty3_strifeChange(_oldS, GM.partyStrife));
  } else if (choice === 'yield') {
    // 议题留中
    var topic = (CY._ty2 && CY._ty2.topic) || (CY._ty3 && CY._ty3.topic) || '';
    if (topic) {
      if (!GM._ccHeldItems) GM._ccHeldItems = [];
      GM._ccHeldItems.push({ topic: topic, from: '危诏妥协', turn: GM.turn });
    }
    if (typeof toast === 'function') toast('妥协·议题入留中册');
  }
  var cb = CY._ty3_dgCallback;
  CY._ty3_dgCallback = null;
  if (typeof cb === 'function') cb(choice);
}

// 入口·v2 _ty2_decide 完成后调用·展示档位 + 应用效果
function _ty3_settleArchonGrade(decision, opts) {
  var info = _ty3_computeArchonGrade();
  var notes = _ty3_applyArchonGrade(info.grade, opts || {});
  CY._ty3_archonGrade = info.grade;
  // 展示档位
  if (typeof addCYBubble === 'function') {
    addCYBubble('内侍', '〔 钦定档位·' + info.grade + ' 档 ' + info.label + ' · 皇威 ' + info.hw + ' · 皇权 ' + info.hq + ' 〕', true);
    notes.forEach(function(n){ addCYBubble('内侍', '· ' + n, true); });
  }
  // D 档须二选
  if (info.grade === 'D') {
    _ty3_dGradeChoice(function(/*choice*/) {
      _ty3_checkRegaliaUnlocks(info, opts);
    });
  } else {
    // 立刻检查威权阶梯
    _ty3_checkRegaliaUnlocks(info, opts);
  }
  return info;
}

// ═══════════════════════════════════════════════════════════════════════
//  §5·威权阶梯永久解锁(GM.unlockedRegalia[])
// ═══════════════════════════════════════════════════════════════════════
// 设计：
//   - GM.unlockedRegalia[] 持久化·跨场廷议保留(失去高位也保留)
//   - 累计巅峰条件触发解锁·解锁后玩家可在廷议/平时使用对应特权
//   - 这是「正反馈循环 A·威权阶梯」的实现

var _ty3_REGALIA_DEFS = [
  { id: 'jin_kou_yu_yan',  name: '金口玉言',
    cond: 'sCount>=5',
    desc: '累计 5 场 S 档·廷议玩家发言自动 +10 说服力',
    counter: 'sGradeCount' },
  { id: 'na_jian_ming_jun', name: '纳谏明君',
    cond: 'dResolved>=3',
    desc: '累计 3 场化解 D 档·D 档新增「廷议续议」三选',
    counter: 'dResolvedCount' },
  { id: 'tian_wei_hao_dang', name: '天威浩荡',
    cond: 'hwHigh>=5',
    desc: '皇威≥80 持续 5 回合·驳议党派 cohesion-2/回合',
    counter: 'hwHighStreak' },
  { id: 'qian_gang_du_yun', name: '乾纲独运',
    cond: 'hqHigh>=5',
    desc: '皇权≥80 持续 5 回合·议前预审多一选项「密发」',
    counter: 'hqHighStreak' }
];

function _ty3_initRegaliaCounters() {
  if (!GM._regaliaCounters) GM._regaliaCounters = { sGradeCount: 0, dResolvedCount: 0, hwHighStreak: 0, hqHighStreak: 0 };
  if (!GM.unlockedRegalia) GM.unlockedRegalia = [];
}

function _ty3_isRegaliaUnlocked(id) {
  if (!GM.unlockedRegalia) return false;
  return GM.unlockedRegalia.indexOf(id) >= 0;
}

function _ty3_checkRegaliaUnlocks(info, opts) {
  _ty3_initRegaliaCounters();
  var cnt = GM._regaliaCounters;
  // 累计 S 档
  if (info && info.grade === 'S') cnt.sGradeCount = (cnt.sGradeCount||0) + 1;
  // 累计化解 D 档(若是 D 且玩家选了硬推或妥协·都算"化解")
  if (info && info.grade === 'D') cnt.dResolvedCount = (cnt.dResolvedCount||0) + 1;
  // 皇威皇权连续高位(进入此函数时检查·跨回合的连续要在 endTurn hook 中累积·此处不增)
  // 检查解锁
  var newlyUnlocked = [];
  _ty3_REGALIA_DEFS.forEach(function(def) {
    if (_ty3_isRegaliaUnlocked(def.id)) return;
    var eligible = false;
    if (def.cond === 'sCount>=5') eligible = (cnt.sGradeCount||0) >= 5;
    else if (def.cond === 'dResolved>=3') eligible = (cnt.dResolvedCount||0) >= 3;
    else if (def.cond === 'hwHigh>=5') eligible = (cnt.hwHighStreak||0) >= 5;
    else if (def.cond === 'hqHigh>=5') eligible = (cnt.hqHighStreak||0) >= 5;
    if (eligible) {
      GM.unlockedRegalia.push(def.id);
      newlyUnlocked.push(def);
    }
  });
  // 通知玩家
  newlyUnlocked.forEach(function(def) {
    if (typeof addCYBubble === 'function') addCYBubble('内侍', '★ 永业解锁·【' + def.name + '】 ' + def.desc, true);
    if (typeof toast === 'function') toast('★ 解锁·' + def.name);
    if (typeof addEB === 'function') addEB('威权阶梯', '永业解锁：' + def.name + '——' + def.desc);
  });
}

// 每回合 endTurn 调用·更新连续高位计数(供 R140+ tm-endturn-* 接入)
function _ty3_tickRegaliaStreaks() {
  _ty3_initRegaliaCounters();
  var hw = _ty3_readHuangwei();
  var hq = _ty3_readHuangquan();
  var cnt = GM._regaliaCounters;
  cnt.hwHighStreak = (hw >= 80) ? (cnt.hwHighStreak||0) + 1 : 0;
  cnt.hqHighStreak = (hq >= 80) ? (cnt.hqHighStreak||0) + 1 : 0;
  // 触发解锁检查
  _ty3_checkRegaliaUnlocks(null, null);
}

// 玩家面 UI·查看已解锁的特权
function _ty3_renderRegaliaList() {
  _ty3_initRegaliaCounters();
  var cnt = GM._regaliaCounters || {};
  var html = '<div class="ty3-rg-list">';
  html += '<div class="ty3-rg-title">威 权 阶 梯·永业解锁</div>';
  _ty3_REGALIA_DEFS.forEach(function(def) {
    var u = _ty3_isRegaliaUnlocked(def.id);
    var prog = '';
    if (def.counter && cnt[def.counter] != null) {
      var need = (def.cond === 'sCount>=5') ? 5 : (def.cond === 'dResolved>=3') ? 3 : 5;
      prog = ' (' + Math.min(cnt[def.counter], need) + '/' + need + ')';
    }
    html += '<div class="ty3-rg-item ' + (u ? 'unlocked' : 'locked') + '">';
    html += '<div class="ty3-rg-icon">' + (u ? '★' : '○') + '</div>';
    html += '<div class="ty3-rg-info">';
    html += '<div class="ty3-rg-name">' + def.name + (u ? '' : prog) + '</div>';
    html += '<div class="ty3-rg-desc">' + def.desc + '</div>';
    html += '</div></div>';
  });
  html += '</div>';
  return html;
}

// ═══════════════════════════════════════════════════════════════════════
//  §6·入口·路由桥接
// ═══════════════════════════════════════════════════════════════════════
// 由 tm-chaoyi.js _cy_pickMode 'tinyi' 路由到 _ty3_open
// v2 _ty2_decide 完成后须调用 _ty3_settleArchonGrade·此处提供 hook 注入

(function _ty3_installSettleHook() {
  if (typeof window === 'undefined') return;
  // 等 _ty2_decide 加载后包裹
  var attempts = 0;
  function tryHook() {
    if (attempts++ > 20) return;
    if (typeof window._ty2_decide !== 'function') {
      setTimeout(tryHook, 200);
      return;
    }
    if (window._ty2_decide._ty3Hooked) return;
    var orig = window._ty2_decide;
    window._ty2_decide = async function(mode) {
      // 调原裁决(它会写 GM._edictTracker / addEB / addCYBubble 等)
      try { await orig.call(this, mode); } catch(e) { try { window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-tinyi-v3'); } catch(_){} }
      // 仅在非"留待再议"时应用档位
      if (mode === 'defer') return;
      // 弹劾结党议题准奏 → 自动 spawn 党(status='被劾')
      try {
        var meta = (window._ty3_publicMeta) || (CY._ty3 && CY._ty3.meta);
        if (meta && meta.isAccusation && meta.accusationType === 'clique' && meta.accused) {
          // mode==='majority' 且众议偏向支持·或 mode==='override' 且皇帝裁决支持·视为准奏
          var counts = (typeof _ty2_countStances === 'function') ? _ty2_countStances() : { support:0, oppose:0 };
          var wasApproved = false;
          if (mode === 'majority') wasApproved = counts.support >= counts.oppose;
          else if (mode === 'override') wasApproved = counts.support < counts.oppose; // 帝逆众议 = 帝独断准奏
          else if (mode === 'mediation') wasApproved = false; // 折中 = 既不立党也不全否
          // 找到关联弹劾疏(若有)·结束其待批状态
          var accuMemo = null;
          if (meta.memorialId && Array.isArray(GM._pendingMemorials)) {
            accuMemo = GM._pendingMemorials.find(function(m){ return m && m.id === meta.memorialId; });
          }
          if (wasApproved) {
            var accusedList = Array.isArray(meta.accused) ? meta.accused : [meta.accused];
            // 加入推演中可能涉及的同伙(取其同党 cohesion<30 的成员)
            try {
              var firstCh = (typeof findCharByName === 'function') ? findCharByName(accusedList[0]) : null;
              if (firstCh && firstCh.party) {
                var origP = _ty3_getPartyObj(firstCh.party);
                if (origP && (parseInt(origP.cohesion,10)||50) < 30) {
                  _ty3_getPartyMembers(firstCh.party).slice(0, 3).forEach(function(m){
                    if (m.name !== accusedList[0] && accusedList.indexOf(m.name) < 0) accusedList.push(m.name);
                  });
                }
              }
            } catch(_){}
            _ty3_phase12_onAccusationApproved(meta.topic || (CY._ty2 && CY._ty2.topic), accusedList, meta.accuser);
            if (accuMemo) { accuMemo.status = 'approved'; accuMemo.reply = '准奏·结党之罪坐实'; }
          } else {
            // 弹劾驳回·反弹劾者(言官)名声受损
            if (meta.accuser) {
              var accCh = (typeof findCharByName === 'function') ? findCharByName(meta.accuser) : null;
              if (accCh) {
                accCh.prestige = Math.max(0, (accCh.prestige||50) - 5);
                if (typeof addCYBubble === 'function') addCYBubble('内侍', '〔 弹劾不立·' + meta.accuser + '名望受挫 〕', true);
              }
            }
            // 被劾者反获声望
            var accCh2 = (typeof findCharByName === 'function') ? findCharByName(meta.accused) : null;
            if (accCh2) accCh2.prestige = Math.min(100, (accCh2.prestige||50) + 3);
            if (accuMemo) { accuMemo.status = 'rejected'; accuMemo.reply = '驳回·弹劾不立'; }
          }
        }
      } catch(_e) { try{window.TM&&TM.errors&&TM.errors.captureSilent(_e,'tm-tinyi-v3·弹劾');}catch(__){} }
      // 推断主奏党(若 _ty2 缺省·从 attendees 中找 prestige 最高且 party 非空者)
      var proposerParty = '';
      if (CY._ty2 && CY._ty2._publicMeta && CY._ty2._publicMeta.proposer) {
        var ch1 = (typeof findCharByName === 'function') ? findCharByName(CY._ty2._publicMeta.proposer) : null;
        if (ch1 && ch1.party) proposerParty = ch1.party;
      }
      if (!proposerParty && window._ty3_publicMeta && window._ty3_publicMeta.proposerParty) {
        proposerParty = window._ty3_publicMeta.proposerParty;
      }
      if (!proposerParty && CY._ty2 && Array.isArray(CY._ty2.attendees) && CY._ty2.attendees.length > 0) {
        var maxP = -1;
        CY._ty2.attendees.forEach(function(nm) {
          var c = (typeof findCharByName === 'function') ? findCharByName(nm) : null;
          if (c && c.party && (c.prestige||50) > maxP) { maxP = c.prestige||50; proposerParty = c.party; }
        });
      }
      // 反对党·从主奏党的 enemies 取
      var opposingParties = [];
      if (proposerParty) {
        var enemies = _ty3_getOpposingParties(proposerParty);
        opposingParties = enemies.map(function(e){return e.name;});
      }
      // 应用档位
      _ty3_settleArchonGrade(
        { mode: mode, decision: (CY._ty2||{}).decision },
        {
          proposerParty: proposerParty,
          opposingParties: opposingParties,
          decisionMode: mode,
          topic: (CY._ty2||{}).topic
        }
      );
    };
    window._ty2_decide._ty3Hooked = true;
  }
  tryHook();
})();

// 路由覆盖·让 _cy_pickMode('tinyi') 走 v3
(function _ty3_overrideTinyiRoute() {
  if (typeof window === 'undefined') return;
  var attempts = 0;
  function tryOverride() {
    if (attempts++ > 20) return;
    if (typeof window._cy_pickMode !== 'function') {
      setTimeout(tryOverride, 200);
      return;
    }
    if (window._cy_pickMode._ty3Override) return;
    var orig = window._cy_pickMode;
    window._cy_pickMode = function(mode) {
      if (mode === 'tinyi') {
        if (typeof CY !== 'undefined') CY.mode = mode;
        _ty3_open();
        return;
      }
      return orig.apply(this, arguments);
    };
    window._cy_pickMode._ty3Override = true;
  }
  tryOverride();
})();

// 暴露 API 到 window·便于控制台调试 + R118 register 检索
if (typeof window !== 'undefined') {
  window._ty3_open = _ty3_open;
  window._ty3_openPreAudit = _ty3_openPreAudit;
  window._ty3_paPickPending = _ty3_paPickPending;
  window._ty3_paUpdateProposer = _ty3_paUpdateProposer;
  window._ty3_paChoose = _ty3_paChoose;
  window._ty3_paCancel = _ty3_paCancel;
  window._ty3_paUpdateForecast = _ty3_paUpdateForecast;
  window._ty3_doInterjectTrain = _ty3_doInterjectTrain;
  window._ty3_doInterjectSummon = _ty3_doInterjectSummon;
  window._ty3_doInterjectPartyLeader = _ty3_doInterjectPartyLeader;
  window._ty3_doInterjectSilence = _ty3_doInterjectSilence;
  window._ty3_doInterjectAbort = _ty3_doInterjectAbort;
  window._ty3_dgPick = _ty3_dgPick;
  window._ty3_settleArchonGrade = _ty3_settleArchonGrade;
  window._ty3_computeArchonGrade = _ty3_computeArchonGrade;
  window._ty3_tickRegaliaStreaks = _ty3_tickRegaliaStreaks;
  window._ty3_renderRegaliaList = _ty3_renderRegaliaList;
  window._ty3_isRegaliaUnlocked = _ty3_isRegaliaUnlocked;
  window._ty3_getPartyObj = _ty3_getPartyObj;
  window._ty3_getPartyMembers = _ty3_getPartyMembers;
  window._ty3_getPartyLeader = _ty3_getPartyLeader;
  window._ty3_partyStanceOnTopic = _ty3_partyStanceOnTopic;
  // 党争描述化辅助·供 抽屉 / 史记 / 邸报 调用
  window._ty3_strifeLabel = _ty3_strifeLabel;
  window._ty3_strifeDelta = _ty3_strifeDelta;
  window._ty3_strifeChange = _ty3_strifeChange;
}

// R118 命名空间注册(若有)
try {
  if (typeof TM !== 'undefined' && TM.register) {
    TM.register('TinyiV3', {
      open: _ty3_open,
      computeGrade: _ty3_computeArchonGrade,
      settle: _ty3_settleArchonGrade,
      tickStreaks: _ty3_tickRegaliaStreaks,
      isUnlocked: _ty3_isRegaliaUnlocked,
      regaliaList: _ty3_renderRegaliaList,
      getPartyObj: _ty3_getPartyObj,
      getPartyMembers: _ty3_getPartyMembers,
      strifeLabel: _ty3_strifeLabel,
      strifeDelta: _ty3_strifeDelta,
      strifeChange: _ty3_strifeChange
    });
  }
} catch(_) {}

// ═══════════════════════════════════════════════════════════════════════
//  §7·阶段 1·起议站班(三班布局 + 潮汐条) — 波 2
// ═══════════════════════════════════════════════════════════════════════
// 接 §3 议前预审「明发」分支·按党派立场+党魁/盟敌关系自动分三班·
// 显示左班(支持/同盟方) / 右班(反对方) / 中班(中立·分化) + 潮汐条·
// 玩家点「开议」进入 §8 分轮辩议

function _ty3_phase1_openSeating(topic, meta) {
  if (!topic) return;
  // 自动识别主奏者(meta.proposer 或文本提及·或 attendees 第一人)
  var proposerName = (meta && meta.proposer) || '';
  var proposerCh = proposerName ? (typeof findCharByName === 'function' ? findCharByName(proposerName) : null) : null;
  var proposerParty = proposerCh && proposerCh.party ? proposerCh.party : '';

  // 召集所有在京 + 同势力 + 三品以上 + 非缺席
  var capital = GM._capital || '京城';
  var attendees = (GM.chars||[]).filter(function(c){
    if (!c || c.alive === false || c.isPlayer) return false;
    if (c._imprisoned || c._exiled || c._retired || c._fled || c._mourning) return false;
    if (c._sick && (c.health||50) <= 20) return false;
    if (typeof _isAtCapital === 'function' && !_isAtCapital(c)) return false;
    if (typeof _isPlayerFactionChar === 'function' && !_isPlayerFactionChar(c)) return false;
    var rankLv = (typeof getRankLevel === 'function' && typeof _cyGetRank === 'function')
      ? getRankLevel(_cyGetRank(c)) : 99;
    return rankLv <= 12;
  });
  if (attendees.length < 5) {
    // 放宽到五品
    attendees = (GM.chars||[]).filter(function(c){
      if (!c || c.alive === false || c.isPlayer) return false;
      if (typeof _isAtCapital === 'function' && !_isAtCapital(c)) return false;
      if (typeof _isPlayerFactionChar === 'function' && !_isPlayerFactionChar(c)) return false;
      var rankLv = (typeof getRankLevel === 'function' && typeof _cyGetRank === 'function')
        ? getRankLevel(_cyGetRank(c)) : 99;
      return rankLv <= 14;
    });
  }
  // 二次兜底：去掉 _isPlayerFactionChar / _isAtCapital 过滤·只剩存活+非玩家+合理品级
  if (attendees.length === 0) {
    attendees = (GM.chars||[]).filter(function(c){
      if (!c || c.alive === false || c.isPlayer) return false;
      if (c._imprisoned || c._exiled || c._fled) return false;
      var rankLv = (typeof getRankLevel === 'function' && typeof _cyGetRank === 'function')
        ? getRankLevel(_cyGetRank(c)) : 99;
      return rankLv <= 16; // 七品之内皆可
    });
  }
  // 三次兜底：极端情况·任何活人 NPC
  if (attendees.length === 0) {
    attendees = (GM.chars||[]).filter(function(c){
      return c && c.alive !== false && !c.isPlayer;
    }).slice(0, 12);
  }
  if (attendees.length === 0) {
    if (typeof toast === 'function') toast('朝中无人·廷议无法召开');
    var bg0 = document.getElementById('ty3-preaudit-bg'); if (bg0) bg0.remove();
    return;
  }

  // 若无主奏者·从 attendees 中按 prestige + 同党 优先选
  if (!proposerName) {
    proposerCh = attendees.slice().sort(function(a,b){return (b.prestige||50)-(a.prestige||50);})[0];
    proposerName = proposerCh ? proposerCh.name : '';
    proposerParty = proposerCh && proposerCh.party ? proposerCh.party : '';
  }

  // 按党派分三班
  // 左班 = 主奏党 + allies + policyStance/focal_disputes 与议题倾向 support
  // 右班 = 主奏党 enemies + 倾向 oppose
  // 中班 = 其余
  var alliesPN = [];
  var enemiesPN = [];
  if (proposerParty) {
    alliesPN = [proposerParty].concat((_ty3_getPartyObj(proposerParty)?.allies)||[]);
    enemiesPN = (_ty3_getPartyObj(proposerParty)?.enemies)||[];
  }

  var bench = { left: [], center: [], right: [] };
  attendees.forEach(function(c) {
    var partyName = c.party || '';
    var sideByParty = '';
    if (partyName) {
      if (alliesPN.indexOf(partyName) >= 0) sideByParty = 'left';
      else if (enemiesPN.indexOf(partyName) >= 0) sideByParty = 'right';
    }
    if (!sideByParty && partyName) {
      // 没明确 ally/enemy·按议题立场推断
      var s = _ty3_partyStanceOnTopic(partyName, topic);
      if (s === 'support') sideByParty = 'left';
      else if (s === 'oppose') sideByParty = 'right';
    }
    if (!sideByParty) sideByParty = 'center';
    bench[sideByParty].push({ name: c.name, party: partyName, prestige: c.prestige||50, ch: c });
  });

  // 计算潮汐(主奏方影响力 - 反对方)
  var leftSum = 0, rightSum = 0, centerSum = 0;
  bench.left.forEach(function(x){ leftSum += x.party ? _ty3_partyInfluence(x.party) : 30; });
  bench.right.forEach(function(x){ rightSum += x.party ? _ty3_partyInfluence(x.party) : 30; });
  bench.center.forEach(function(x){ centerSum += x.party ? _ty3_partyInfluence(x.party) : 30; });
  var totalSum = leftSum + rightSum + centerSum;
  var leftPct = totalSum > 0 ? Math.round(leftSum/totalSum*100) : 0;
  var rightPct = totalSum > 0 ? Math.round(rightSum/totalSum*100) : 0;
  var centerPct = 100 - leftPct - rightPct;

  // 渲染
  var bg = document.createElement('div');
  bg.id = 'ty3-seating-bg';
  bg.style.cssText = 'position:fixed;inset:0;z-index:1300;background:rgba(0,0,0,0.78);display:flex;align-items:center;justify-content:center;';
  var html = '<div class="ty3-st-modal">';
  html += '<div class="ty3-st-title">〔 起 议 站 班 〕</div>';
  html += '<div class="ty3-st-topic">议  题：' + escHtml(topic) + '</div>';
  if (proposerName) html += '<div class="ty3-st-proposer">主奏者：' + escHtml(proposerName) + (proposerParty ? '（' + escHtml(proposerParty) + '·影响力 ' + _ty3_partyInfluence(proposerParty) + '）' : '') + '</div>';
  html += '<div class="ty3-st-tide">';
  html += '<div class="ty3-st-tide-label">朝堂潮汐</div>';
  html += '<div class="ty3-st-tide-bar">';
  if (totalSum > 0) {
    html += '<div class="ty3-st-tide-l" style="width:' + leftPct + '%">' + (leftPct >= 8 ? '同 ' + leftPct + '%' : '') + '</div>';
    html += '<div class="ty3-st-tide-c" style="width:' + centerPct + '%">' + (centerPct >= 8 ? '中 ' + centerPct + '%' : '') + '</div>';
    html += '<div class="ty3-st-tide-r" style="width:' + rightPct + '%">' + (rightPct >= 8 ? '反 ' + rightPct + '%' : '') + '</div>';
  }
  html += '</div></div>';

  // 三班布局
  html += '<div class="ty3-st-benches">';
  html += _ty3_renderBench('left', '左班·同' + (proposerParty?'·'+proposerParty+'+盟':''), bench.left, leftSum);
  html += _ty3_renderBench('center', '中班·中立', bench.center, centerSum);
  html += _ty3_renderBench('right', '右班·异', bench.right, rightSum);
  html += '</div>';

  html += '<div class="ty3-st-foot">';
  html += '<button class="bt bp" onclick="_ty3_phase1_startDebate()">⚔ 开 议</button>';
  html += '<button class="bt" onclick="_ty3_phase1_cancel()">罢·改日再议</button>';
  html += '</div>';
  html += '</div>';

  bg.innerHTML = html;
  document.body.appendChild(bg);

  // 暂存到 CY._ty3 等待 §8 用
  if (typeof CY !== 'undefined') {
    CY._ty3 = {
      topic: topic,
      meta: meta,
      proposer: proposerName,
      proposerParty: proposerParty,
      attendees: attendees.map(function(c){return c.name;}),
      bench: bench,
      tide: { left: leftPct, center: centerPct, right: rightPct },
      stances: {},
      currentRound: 0
    };
    attendees.forEach(function(c) {
      CY._ty3.stances[c.name] = { current: '待定', confidence: 0 };
    });
  }
}

function _ty3_renderBench(side, label, items, sumInfl) {
  var html = '<div class="ty3-st-bench ty3-st-bench-' + side + '">';
  html += '<div class="ty3-st-bench-head">' + label + '<span class="ty3-st-bench-count">' + items.length + ' 人 · 影响力合计 ' + sumInfl + '</span></div>';
  if (items.length === 0) {
    html += '<div class="ty3-st-bench-empty">（无人）</div>';
  } else {
    // 按党派分组
    var byParty = {};
    items.forEach(function(it) {
      var k = it.party || '无党';
      if (!byParty[k]) byParty[k] = [];
      byParty[k].push(it);
    });
    Object.keys(byParty).forEach(function(pn) {
      var infl = pn === '无党' ? 0 : _ty3_partyInfluence(pn);
      var coh = pn === '无党' ? 0 : _ty3_partyCohesion(pn);
      html += '<div class="ty3-st-party">';
      html += '<div class="ty3-st-party-head">' + escHtml(pn);
      if (pn !== '无党') html += '<span class="ty3-st-party-meta"> 影响力 ' + infl + ' · 凝聚 ' + coh + '</span>';
      html += '</div>';
      html += '<div class="ty3-st-party-mems">';
      byParty[pn].forEach(function(it) {
        html += '<span class="ty3-st-mem">' + escHtml(it.name) + '</span>';
      });
      html += '</div></div>';
    });
  }
  html += '</div>';
  return html;
}

function _ty3_phase1_cancel() {
  var bg = document.getElementById('ty3-seating-bg');
  if (bg) bg.remove();
  if (typeof CY !== 'undefined') CY._ty3 = null;
  _ty3_hideInterjectButton();
  if (typeof closeChaoyi === 'function') closeChaoyi();
}

function _ty3_phase1_startDebate() {
  var bg = document.getElementById('ty3-seating-bg');
  if (bg) bg.remove();
  if (!CY._ty3) return;
  // 桥接 v2 的 CY._ty2 结构以复用 _ty2_genOneSpeech 等 helper
  CY._ty2 = {
    topic: CY._ty3.topic,
    topicType: (CY._ty3.meta && CY._ty3.meta.topicType) || 'other',
    topicCustom: '',
    attendees: CY._ty3.attendees.slice(),
    stances: {},
    stanceHistory: [],
    roundNum: 0,
    currentPhase: 'opening',
    decision: null,
    _publicMeta: { proposer: CY._ty3.proposer, proposerParty: CY._ty3.proposerParty },
    _economyReform: CY._ty3.meta && CY._ty3.meta._economyReform,
    _reformType: CY._ty3.meta && CY._ty3.meta.reformType,
    _reformId: CY._ty3.meta && CY._ty3.meta.reformId
  };
  CY._ty3.attendees.forEach(function(n){ CY._ty2.stances[n] = { current: '待定', initial: '待定', locked: false, confidence: 0 }; });
  CY.phase = 'tinyi3';
  // 检查 chaoyi modal 是否已打开·未打开则触发
  if (typeof showChaoyiSetup === 'function' && !document.getElementById('cy-body')) {
    showChaoyiSetup();
    setTimeout(function(){ _ty3_phase2_run(); }, 50);
  } else {
    _ty3_phase2_run();
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  §8·阶段 2·分轮辩议(四轮 + 实时插言贯穿) — 波 2
// ═══════════════════════════════════════════════════════════════════════
// 四轮：
//   第一轮·主奏陈情(主奏者发言)
//   第二轮·同党附议(主奏党 + allies·按 cohesion 决定附议人数)
//   第三轮·敌党驳议(主奏党 enemies)
//   第四轮·中立权衡(中班 + prestige>=70 老臣)
// 每轮完成后 _ty2_render 更新立场板·所有发言通过 _ty2_genOneSpeech 调 AI

async function _ty3_phase2_run() {
  if (!CY._ty3 || !CY._ty2) return;
  var body = (typeof _$ === 'function') ? _$('cy-body') : document.getElementById('cy-body');
  if (body) body.innerHTML = '';
  var topicEl = (typeof _$ === 'function') ? _$('cy-topic') : document.getElementById('cy-topic');
  if (topicEl) { topicEl.style.display = 'block'; topicEl.innerHTML = '🏛 廷议·' + escHtml(CY._ty3.topic); }

  if (typeof addCYBubble === 'function') {
    addCYBubble('内侍', '（百官按党派分班·三班拱立。'
      + '左 ' + (CY._ty3.bench.left.length) + '人 · 中 ' + (CY._ty3.bench.center.length) + '人 · 右 ' + (CY._ty3.bench.right.length) + '人）', true);
    addCYBubble('皇帝', '今日议——' + CY._ty3.topic + '。诸卿可循序陈奏。', false);
  }

  CY._abortChaoyi = false;
  CY._pendingPlayerLine = null;
  CY._ty3_pendingSummon = null;
  if (typeof _cyShowInputRow === 'function') _cyShowInputRow(true);
  if (typeof _ty2_render === 'function') _ty2_render();

  var prevSpeeches = [];

  // ─── 第一轮·主奏陈情 ───
  CY._ty2.roundNum = 1;
  if (typeof addCYBubble === 'function') addCYBubble('内侍', '〔 第一轮·主奏陈情 〕', true);
  if (CY._ty3.proposer && typeof _ty2_genOneSpeech === 'function') {
    var r1 = await _ty3_safeGenSpeech(CY._ty3.proposer, 1, prevSpeeches);
    if (r1) prevSpeeches.push({ name: CY._ty3.proposer, stance: r1.stance, line: r1.line });
  }
  if (CY._abortChaoyi) return _ty3_phase2_finalize(prevSpeeches);

  // ─── 第二轮·同党附议 ───
  CY._ty2.roundNum = 2;
  if (typeof _ty2_render === 'function') _ty2_render();
  if (typeof addCYBubble === 'function') addCYBubble('内侍', '〔 第二轮·同党附议 〕', true);
  var alliedSpeakers = _ty3_pickAlliedSpeakers();
  for (var i = 0; i < alliedSpeakers.length; i++) {
    if (CY._abortChaoyi) break;
    if (await _ty3_handlePlayerInterject(prevSpeeches)) {/* 插言已处理 */}
    var nm = CY._ty3_pendingSummon || alliedSpeakers[i];
    CY._ty3_pendingSummon = null;
    var r2 = await _ty3_safeGenSpeech(nm, 2, prevSpeeches);
    if (r2) prevSpeeches.push({ name: nm, stance: r2.stance, line: r2.line });
  }
  if (CY._abortChaoyi) return _ty3_phase2_finalize(prevSpeeches);

  // ─── 第三轮·敌党驳议 ───
  CY._ty2.roundNum = 3;
  if (typeof _ty2_render === 'function') _ty2_render();
  if (typeof addCYBubble === 'function') addCYBubble('内侍', '〔 第三轮·敌党驳议 〕', true);
  var enemySpeakers = _ty3_pickEnemySpeakers();
  for (var j = 0; j < enemySpeakers.length; j++) {
    if (CY._abortChaoyi) break;
    if (await _ty3_handlePlayerInterject(prevSpeeches)) {/* 插言已处理 */}
    var em = CY._ty3_pendingSummon || enemySpeakers[j];
    CY._ty3_pendingSummon = null;
    var r3 = await _ty3_safeGenSpeech(em, 3, prevSpeeches);
    if (r3) prevSpeeches.push({ name: em, stance: r3.stance, line: r3.line });
  }
  if (CY._abortChaoyi) return _ty3_phase2_finalize(prevSpeeches);

  // ─── 第四轮·中立权衡 ───
  CY._ty2.roundNum = 4;
  if (typeof _ty2_render === 'function') _ty2_render();
  if (typeof addCYBubble === 'function') addCYBubble('内侍', '〔 第四轮·中立权衡 〕', true);
  var arbiterSpeakers = _ty3_pickArbiterSpeakers();
  for (var k = 0; k < arbiterSpeakers.length; k++) {
    if (CY._abortChaoyi) break;
    if (await _ty3_handlePlayerInterject(prevSpeeches)) {/* 插言已处理 */}
    var ab = CY._ty3_pendingSummon || arbiterSpeakers[k];
    CY._ty3_pendingSummon = null;
    var r4 = await _ty3_safeGenSpeech(ab, 4, prevSpeeches);
    if (r4) prevSpeeches.push({ name: ab, stance: r4.stance, line: r4.line });
  }
  return _ty3_phase2_finalize(prevSpeeches);
}

async function _ty3_safeGenSpeech(name, roundNum, prevSpeeches) {
  if (!name) return null;
  if (typeof _ty2_genOneSpeech !== 'function') return null;
  try {
    var r = await _ty2_genOneSpeech(name, roundNum, prevSpeeches);
    if (r && r.stance && CY._ty2 && CY._ty2.stances && CY._ty2.stances[name]) {
      CY._ty2.stances[name].current = r.stance;
      if (r.confidence != null) CY._ty2.stances[name].confidence = r.confidence;
    }
    if (typeof _ty2_render === 'function') _ty2_render();
    return r;
  } catch(e) {
    try { window.TM && TM.errors && TM.errors.captureSilent(e, 'tm-tinyi-v3'); } catch(_) {}
    return null;
  }
}

async function _ty3_handlePlayerInterject(prevSpeeches) {
  if (!CY || !CY._pendingPlayerLine) return false;
  var line = CY._pendingPlayerLine;
  CY._pendingPlayerLine = null;
  if (typeof _ty2_playerTriggeredResponse === 'function') {
    try { await _ty2_playerTriggeredResponse(line); } catch(_){}
  }
  return true;
}

function _ty3_pickAlliedSpeakers() {
  if (!CY._ty3) return [];
  var bench = CY._ty3.bench || { left:[] };
  // 去掉主奏者
  var pool = bench.left.filter(function(x){ return x.name !== CY._ty3.proposer; });
  // 按 cohesion 决定附议人数(最多 3 人)
  var coh = CY._ty3.proposerParty ? _ty3_partyCohesion(CY._ty3.proposerParty) : 50;
  var n = coh >= 70 ? 3 : coh >= 50 ? 2 : 1;
  // 优先党魁 + 高 prestige
  pool.sort(function(a, b) {
    var aLeader = (a.party && _ty3_getPartyObj(a.party)?.leader === a.name) ? 1 : 0;
    var bLeader = (b.party && _ty3_getPartyObj(b.party)?.leader === b.name) ? 1 : 0;
    if (aLeader !== bLeader) return bLeader - aLeader;
    return (b.prestige||0) - (a.prestige||0);
  });
  return pool.slice(0, n).map(function(x){return x.name;});
}

function _ty3_pickEnemySpeakers() {
  if (!CY._ty3) return [];
  var bench = CY._ty3.bench || { right:[] };
  // 取右班·优先党魁 + 高 prestige
  var pool = bench.right.slice();
  pool.sort(function(a, b) {
    var aLeader = (a.party && _ty3_getPartyObj(a.party)?.leader === a.name) ? 1 : 0;
    var bLeader = (b.party && _ty3_getPartyObj(b.party)?.leader === b.name) ? 1 : 0;
    if (aLeader !== bLeader) return bLeader - aLeader;
    return (b.prestige||0) - (a.prestige||0);
  });
  // loyalty<60 者也加入(强反对)
  var lowLoyal = (GM.chars||[]).filter(function(c){
    if (c.alive===false || c.isPlayer) return false;
    if ((c.loyalty||50) >= 60) return false;
    if (CY._ty3.attendees.indexOf(c.name) < 0) return false;
    if (pool.some(function(x){return x.name===c.name;})) return false;
    return true;
  });
  pool = pool.slice(0, 2);
  if (lowLoyal.length > 0) pool.push({ name: lowLoyal[0].name, party: lowLoyal[0].party, prestige: lowLoyal[0].prestige });
  return pool.slice(0, 3).map(function(x){return x.name;});
}

function _ty3_pickArbiterSpeakers() {
  if (!CY._ty3) return [];
  var bench = CY._ty3.bench || { center:[] };
  // 中班党魁 + 任意 prestige>=70 老臣
  var byParty = {};
  bench.center.forEach(function(x) {
    if (x.party && !byParty[x.party]) byParty[x.party] = x;
  });
  var arbs = Object.values(byParty);
  // 加 prestige>=70 老臣(任意班次)
  var senior = (GM.chars||[]).filter(function(c){
    if (!c || c.alive===false || c.isPlayer) return false;
    if (CY._ty3.attendees.indexOf(c.name) < 0) return false;
    if ((c.prestige||50) < 70) return false;
    if (arbs.some(function(x){return x.name===c.name;})) return false;
    return true;
  }).sort(function(a,b){return (b.prestige||0)-(a.prestige||0);}).slice(0, 1);
  arbs = arbs.concat(senior.map(function(c){return { name: c.name, party: c.party, prestige: c.prestige };}));
  return arbs.slice(0, 3).map(function(x){return x.name;});
}

function _ty3_phase2_finalize(prevSpeeches) {
  CY._abortChaoyi = false;
  // 修复 2·人事议题先进廷推·再进决议
  var topic = (CY._ty3 && CY._ty3.topic) || (CY._ty2 && CY._ty2.topic) || '';
  var meta = (CY._ty3 && CY._ty3.meta) || null;
  if (typeof _ty3_phase3_isPersonnelTopic === 'function' && _ty3_phase3_isPersonnelTopic(topic, meta)) {
    if (typeof addCYBubble === 'function') addCYBubble('内侍', '〔 议毕·进廷推候选 〕', true);
    setTimeout(function() {
      _ty3_phase3_open(topic, function(result) {
        // 廷推结果记入 CY._ty2.decision·让后续 settle 可访问
        if (result && CY._ty2) {
          CY._ty2._tuijianResult = result;
        }
        // 进决议
        if (typeof _ty2_enterDecide === 'function') {
          if (typeof addCYBubble === 'function') addCYBubble('内侍', '〔 廷推毕·请陛下圣裁 〕', true);
          _ty2_enterDecide();
        }
        _ty3_checkConsensusEvent();
      });
    }, 400);
    return;
  }
  // 非人事议题·直接进决议
  if (typeof _ty2_enterDecide === 'function') {
    if (typeof addCYBubble === 'function') addCYBubble('内侍', '〔 四轮辩议毕·请陛下圣裁 〕', true);
    _ty2_enterDecide();
  }
  _ty3_checkConsensusEvent();
}

// 共识检测：若第二轮同党附议 + 第三轮敌党中过半被说服(立场转 mediate 或 support)·触发"和衷共济"
function _ty3_checkConsensusEvent() {
  if (!CY._ty2 || !CY._ty2.stances) return;
  var counts = (typeof _ty2_countStances === 'function') ? _ty2_countStances() : null;
  if (!counts) return;
  var total = counts.support + counts.oppose + counts.neutral + counts.mediate;
  if (total === 0) return;
  if ((counts.support + counts.mediate) / total >= 0.7) {
    // 70%+ 倾向支持·触发和衷共济·朝堂渐和(党争-5)
    if (typeof addCYBubble === 'function') addCYBubble('内侍', '★ 朝野同心·百官多附议·此为「和衷共济」之兆。', true);
    var _hsOld = (typeof GM.partyStrife === 'number') ? GM.partyStrife : 50;
    if (typeof GM.partyStrife === 'number') GM.partyStrife = Math.max(0, GM.partyStrife - 5);
    var _hsText = _ty3_strifeChange(_hsOld, GM.partyStrife);
    if (typeof toast === 'function') toast('和衷共济·' + _hsText);
    if (typeof addEB === 'function') addEB('廷议', '朝野同心·和衷共济·' + _hsText);
    // 主奏党 cohesion +3
    if (CY._ty3 && CY._ty3.proposerParty) {
      var pp = _ty3_getPartyObj(CY._ty3.proposerParty);
      if (pp) pp.cohesion = Math.min(100, (parseInt(pp.cohesion,10)||50) + 3);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  §9·阶段 5·草诏拟旨(选官 modal + prestige+favor 反馈) — 波 2
// ═══════════════════════════════════════════════════════════════════════
// 接 §4 档位应用之后(在 _ty3_settleArchonGrade 完成后)·
// 决议非「留待再议」时弹出草诏官选择 modal·
// 一般档位按 prestige 筛选·S 档可越级钦点

function _ty3_phase5_openDraftPicker(decision, archonGrade, opts) {
  if (!opts) opts = {};
  if (!decision || decision.mode === 'defer') return; // 留待再议无草诏
  var topic = (CY._ty2 && CY._ty2.topic) || '';
  if (!topic) return;
  var attendees = (CY._ty2 && CY._ty2.attendees) || [];

  // 候选池
  var allChars = (GM.chars||[]).filter(function(c){
    if (!c || c.alive===false || c.isPlayer) return false;
    return true;
  });

  // 一般规则：在场 + prestige>=50·允许中书科/翰林背景
  var normalCandidates = allChars.filter(function(c) {
    if (attendees.indexOf(c.name) < 0) return false;
    if ((c.prestige||50) < 50) return false;
    return true;
  });
  // 按惯例：中书/翰林/学士官职优先
  var conventional = normalCandidates.filter(function(c) {
    var t = c.officialTitle || c.title || '';
    return /中书|翰林|学士|侍读|侍讲|起居/.test(t);
  });
  // 主奏方
  var proposerParty = (opts.proposerParty || (CY._ty3 && CY._ty3.proposerParty) || '');
  var proposerSide = normalCandidates.filter(function(c){ return c.party === proposerParty && c.party; });

  // S 档专属：全任意官员(不限品级·不限 prestige)
  var isS = (archonGrade === 'S');
  var sFreeCandidates = isS ? allChars.slice() : [];

  var bg = document.createElement('div');
  bg.id = 'ty3-draft-bg';
  bg.style.cssText = 'position:fixed;inset:0;z-index:1310;background:rgba(0,0,0,0.78);display:flex;align-items:center;justify-content:center;';
  var html = '<div class="ty3-dr-modal">';
  html += '<div class="ty3-dr-title">〔 草 诏 拟 旨 〕</div>';
  html += '<div class="ty3-dr-sub">议题「' + escHtml(topic) + '」议毕·钦点草诏官</div>';

  // 按惯例
  if (conventional.length > 0) {
    html += '<div class="ty3-dr-section"><div class="ty3-dr-sec-label">按惯例·中书翰林</div>';
    html += '<div class="ty3-dr-cands">';
    conventional.slice(0, 4).forEach(function(c) {
      html += '<div class="ty3-dr-cand" onclick="_ty3_phase5_pick(\'' + escAttr(c.name) + '\', \'conventional\')">';
      html += '<span class="ty3-dr-cand-name">' + escHtml(c.name) + '</span>';
      html += '<span class="ty3-dr-cand-meta">' + escHtml(c.officialTitle||c.title||'') + ' · 名望 ' + (c.prestige||50) + (c.party ? ' · ' + escHtml(c.party) : '') + '</span>';
      html += '</div>';
    });
    html += '</div></div>';
  }

  // 主奏方
  if (proposerSide.length > 0) {
    html += '<div class="ty3-dr-section"><div class="ty3-dr-sec-label">主奏方·' + escHtml(proposerParty) + '</div>';
    html += '<div class="ty3-dr-cands">';
    proposerSide.slice(0, 3).forEach(function(c) {
      html += '<div class="ty3-dr-cand" onclick="_ty3_phase5_pick(\'' + escAttr(c.name) + '\', \'proposer\')">';
      html += '<span class="ty3-dr-cand-name">' + escHtml(c.name) + '</span>';
      html += '<span class="ty3-dr-cand-meta">' + escHtml(c.officialTitle||c.title||'') + ' · 名望 ' + (c.prestige||50) + '</span>';
      html += '</div>';
    });
    html += '</div></div>';
  }

  // S 档·任意官员
  if (isS) {
    html += '<div class="ty3-dr-section ty3-dr-s-priv"><div class="ty3-dr-sec-label">★ S 档特权·钦点任意官员</div>';
    html += '<input id="ty3-dr-free-name" placeholder="键入任意在朝官员之名……" class="ty3-dr-free-input">';
    html += '<button class="bt bp ty3-dr-free-btn" onclick="_ty3_phase5_pickFree()">钦 定</button>';
    html += '</div>';
  }

  html += '<div class="ty3-dr-foot">';
  html += '<button class="bt" onclick="_ty3_phase5_skip()">免·循文牍流程</button>';
  html += '</div>';
  html += '</div>';

  bg.innerHTML = html;
  document.body.appendChild(bg);
}

function _ty3_phase5_pick(name, source) {
  var bg = document.getElementById('ty3-draft-bg');
  if (bg) bg.remove();
  if (!name) return;
  var ch = (typeof findCharByName === 'function') ? findCharByName(name) : null;
  if (!ch) { if (typeof toast === 'function') toast('查无此人'); return; }
  // 应用奖励
  ch.prestige = Math.min(100, (ch.prestige||50) + 3);
  ch.favor = Math.min(100, (ch.favor||0) + 5);
  if (ch.party) {
    var pp = _ty3_getPartyObj(ch.party);
    if (pp) pp.cohesion = Math.min(100, (parseInt(pp.cohesion,10)||50) + 3);
  }
  if (typeof addCYBubble === 'function') {
    var src = (source==='conventional') ? '惯例' : (source==='proposer') ? '主奏方' : (source==='s_free') ? 'S档钦定' : '钦定';
    addCYBubble('皇帝', '——着' + name + '草诏。（' + src + '·名望+3·恩眷+5）', false);
  }
  if (typeof toast === 'function') toast(name + ' 草诏·名望+3 恩眷+5');
  if (typeof addEB === 'function') addEB('草诏', name + ' 草诏 · ' + ((CY._ty2&&CY._ty2.topic)||''));
  // NPC 记忆
  try {
    if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
      NpcMemorySystem.remember(name, '陛下钦点臣草诏「' + ((CY._ty2&&CY._ty2.topic)||'').slice(0,20) + '」·荣宠所至', '喜', 6);
    }
  } catch(_){}
  // 修复 1·链到下一阶段(用印)
  _ty3_advanceToSeal();
}

function _ty3_phase5_pickFree() {
  var inp = document.getElementById('ty3-dr-free-name');
  var name = inp && inp.value && inp.value.trim();
  if (!name) { if (typeof toast === 'function') toast('请输入官员之名'); return; }
  var ch = (typeof findCharByName === 'function') ? findCharByName(name) : null;
  if (!ch || ch.alive === false) { if (typeof toast === 'function') toast('查无此人或已殁'); return; }
  _ty3_phase5_pick(name, 's_free');
}

function _ty3_phase5_skip() {
  var bg = document.getElementById('ty3-draft-bg');
  if (bg) bg.remove();
  if (typeof addCYBubble === 'function') addCYBubble('内侍', '（陛下不点·诏命循文牍流程·中书科自办。）', true);
  // 修复 1·链到下一阶段(用印)
  _ty3_advanceToSeal();
}

// 修复 1·阶段链推进器·草诏完毕 → 用印颁行
function _ty3_advanceToSeal() {
  var ctx = CY._ty3_settleCtx;
  if (!ctx || !ctx.grade) return;
  // S 档 跳过用印
  if (ctx.grade === 'S') {
    if (typeof addCYBubble === 'function') addCYBubble('内侍', '★ S 档·圣旨煌煌·跳过用印阶段·诏命直颁。', true);
    CY._ty3_settleCtx = null;
    return;
  }
  // D 档·用户须先选硬推/妥协·若 force 则用印·yield 则不用印
  if (ctx.grade === 'D' && ctx.dChoice !== 'force') {
    CY._ty3_settleCtx = null;
    return;
  }
  setTimeout(function() {
    _ty3_phase6_open(ctx.decision, ctx.grade, ctx.opts);
    // 用印完成后清 context(seal 是终态·不再链)
    CY._ty3_settleCtx = null;
  }, 200);
}

// 修复 1·钩入 _ty3_settleArchonGrade·只触发草诏 picker(由 picker 链向用印)
(function _ty3_installDraftHook() {
  if (typeof window === 'undefined') return;
  var attempts = 0;
  function tryHook() {
    if (attempts++ > 20) return;
    if (typeof window._ty3_settleArchonGrade !== 'function') {
      setTimeout(tryHook, 200);
      return;
    }
    if (window._ty3_settleArchonGrade._draftHooked) return;
    var orig = window._ty3_settleArchonGrade;
    window._ty3_settleArchonGrade = function(decision, opts) {
      var info = orig.apply(this, arguments);
      // 暂存 context 给 _ty3_advanceToSeal 用
      if (info && info.grade && decision && decision.mode !== 'defer') {
        CY._ty3_settleCtx = { grade: info.grade, decision: decision, opts: opts };
      }
      // D 档：等用户选 force/yield 后由 _ty3_dgPick 触发链
      // 非 D 档：进草诏 picker(picker 完成后链向用印)
      // S 档：跳草诏(直接进 _ty3_advanceToSeal)
      if (info && info.grade && decision && decision.mode !== 'defer') {
        if (info.grade === 'D') {
          // 等待 _ty3_dgPick 触发(下面 §11 的 force 路径会调 advanceToSeal)
        } else if (info.grade === 'S') {
          // S 档·草诏 picker 仍开(玩家可越级钦点亲信)·picker 完后跳用印
          setTimeout(function(){ _ty3_phase5_openDraftPicker(decision, info.grade, opts); }, 250);
        } else {
          setTimeout(function(){ _ty3_phase5_openDraftPicker(decision, info.grade, opts); }, 250);
        }
      }
      return info;
    };
    window._ty3_settleArchonGrade._draftHooked = true;
  }
  tryHook();
})();

// 暴露波 2 API
if (typeof window !== 'undefined') {
  window._ty3_phase1_openSeating = _ty3_phase1_openSeating;
  window._ty3_phase1_startDebate = _ty3_phase1_startDebate;
  window._ty3_phase1_cancel = _ty3_phase1_cancel;
  window._ty3_phase2_run = _ty3_phase2_run;
  window._ty3_phase5_openDraftPicker = _ty3_phase5_openDraftPicker;
  window._ty3_phase5_pick = _ty3_phase5_pick;
  window._ty3_phase5_pickFree = _ty3_phase5_pickFree;
  window._ty3_phase5_skip = _ty3_phase5_skip;
}

// escAttr 兜底(若全局无)
if (typeof escAttr !== 'function') {
  window.escAttr = function(s) { return (s||'').replace(/'/g,"\\'").replace(/"/g,'&quot;'); };
}

// ═══════════════════════════════════════════════════════════════════════
//  §10·阶段 3·廷推(人事议题·钦定 / 廷推 / 暂阙) — 波 3
// ═══════════════════════════════════════════════════════════════════════
// 人事议题(meta.topicType==='appointment' 或 议题文本含「任命/罢免/起复/廷推」)
// 在阶段 4 钦定档位之前进入·让玩家选取候选并决定方式
// 候选生成：各党派从 members + officePositions 中推举 prestige 最高且未殁者
// 钦定 = 玩家自选(huangquan-1 顺势·-3 违逆 influence 大党)
// 廷推 = 按 influence 加权抽签(党争 -3·被推者 loyalty+5)
// 暂阙 = 不补·该位空缺 N 回合

function _ty3_phase3_isPersonnelTopic(topic, meta) {
  if (meta && (meta.topicType === 'appointment' || meta.isPersonnel)) return true;
  if (!topic) return false;
  return /任命|罢免|起复|廷推|罢黜|擢拔|举荐|出任|进位|拜相|入阁|致仕/.test(topic);
}

function _ty3_phase3_buildCandidates(targetOffice) {
  // 各党派党魁/高 prestige 候选
  var byParty = {};
  var parties = _ty3_getParties();
  parties.forEach(function(p) {
    if (!p || !p.name) return;
    var leader = _ty3_getPartyLeader(p.name);
    var members = _ty3_getPartyMembers(p.name);
    members.sort(function(a,b){return (b.prestige||50)-(a.prestige||50);});
    // 取 1-2 名作为该党推荐
    var top = members.slice(0, 2);
    if (top.length > 0) {
      byParty[p.name] = {
        party: p,
        candidates: top.map(function(c){
          return {
            name: c.name,
            ch: c,
            prestige: c.prestige||50,
            officialTitle: c.officialTitle||c.title||'',
            isLeader: leader && leader.name === c.name
          };
        })
      };
    }
  });
  // 中立·无党高 prestige
  var neutralPool = (GM.chars||[]).filter(function(c){
    if (!c || c.alive===false || c.isPlayer) return false;
    if (c.party) return false;
    if ((c.prestige||50) < 65) return false;
    return true;
  }).sort(function(a,b){return (b.prestige||50)-(a.prestige||50);}).slice(0, 3);
  if (neutralPool.length > 0) {
    byParty['__neutral__'] = {
      party: { name: '中立·无党', influence: 30, cohesion: 50 },
      candidates: neutralPool.map(function(c){
        return { name: c.name, ch: c, prestige: c.prestige||50, officialTitle: c.officialTitle||c.title||'', isLeader: false };
      })
    };
  }
  return byParty;
}

function _ty3_phase3_open(targetOffice, callback) {
  var byParty = _ty3_phase3_buildCandidates(targetOffice);
  var entries = Object.entries(byParty);
  if (entries.length === 0) {
    if (typeof toast === 'function') toast('无可廷推候选');
    if (typeof callback === 'function') callback(null);
    return;
  }
  var bg = document.createElement('div');
  bg.id = 'ty3-tuijian-bg';
  bg.style.cssText = 'position:fixed;inset:0;z-index:1310;background:rgba(0,0,0,0.78);display:flex;align-items:center;justify-content:center;';
  var html = '<div class="ty3-tj-modal">';
  html += '<div class="ty3-tj-title">〔 廷 推 候 选 〕</div>';
  if (targetOffice) html += '<div class="ty3-tj-target">拟补：' + escHtml(targetOffice) + '</div>';
  html += '<div class="ty3-tj-cands">';
  entries.forEach(function(pair) {
    var pName = pair[0];
    var info = pair[1];
    var p = info.party;
    var label = (pName === '__neutral__') ? '中立·无党' : pName;
    html += '<div class="ty3-tj-party-block">';
    html += '<div class="ty3-tj-party-head">' + escHtml(label);
    if (pName !== '__neutral__') html += '<span class="ty3-tj-party-meta">影响力 ' + (p.influence||50) + ' · 凝聚 ' + (p.cohesion||50) + '</span>';
    html += '</div>';
    info.candidates.forEach(function(c) {
      var winRate = _ty3_phase3_estimateWinRate(p.influence||50, c.prestige);
      html += '<div class="ty3-tj-cand" onclick="_ty3_phase3_qinDing(\'' + escAttr(c.name) + '\',\'' + escAttr(pName) + '\')">';
      html += '<div class="ty3-tj-cand-name">' + escHtml(c.name) + (c.isLeader ? '★' : '') + '</div>';
      html += '<div class="ty3-tj-cand-meta">' + escHtml(c.officialTitle||'白身') + ' · 名望 ' + c.prestige + ' · 当选率 ' + winRate + '%</div>';
      html += '</div>';
    });
    html += '</div>';
  });
  html += '</div>';
  html += '<div class="ty3-tj-foot">';
  html += '<button class="bt bp" onclick="_ty3_phase3_doPublicVote()">⚖ 让百官公推</button>';
  html += '<button class="bt" onclick="_ty3_phase3_skip()">📜 暂 阙·此位空缺</button>';
  html += '</div></div>';
  bg.innerHTML = html;
  document.body.appendChild(bg);
  CY._ty3_phase3_callback = callback;
  CY._ty3_phase3_byParty = byParty;
}

function _ty3_phase3_estimateWinRate(influence, prestige) {
  // 当选率粗略估算：影响力 60% + 名望 40%
  var raw = (influence||50) * 0.6 + (prestige||50) * 0.4;
  return Math.round(raw);
}

function _ty3_phase3_qinDing(name, partyKey) {
  var bg = document.getElementById('ty3-tuijian-bg');
  if (bg) bg.remove();
  if (!name) return;
  var ch = (typeof findCharByName === 'function') ? findCharByName(name) : null;
  if (!ch) return;
  // 钦定违逆 influence 大党时·huangquan -3·否则 -1
  var biggestParty = '';
  var biggestInfl = 0;
  _ty3_getParties().forEach(function(p) {
    var infl = parseInt(p.influence,10) || 0;
    if (infl > biggestInfl) { biggestInfl = infl; biggestParty = p.name; }
  });
  var pickedParty = ch.party || '';
  var contested = (biggestParty && biggestParty !== pickedParty && biggestInfl >= 60);
  var hqDelta = contested ? -3 : -1;
  if (GM.huangquan && typeof GM.huangquan.index === 'number') GM.huangquan.index = Math.max(0, GM.huangquan.index + hqDelta);
  else if (GM.vars && GM.vars['皇权']) GM.vars['皇权'].value = Math.max(0, (GM.vars['皇权'].value||50) + hqDelta);
  // 被点者 loyalty+3 favor+5 prestige+2
  ch.loyalty = Math.min(100, (ch.loyalty||50) + 3);
  ch.favor = Math.min(100, (ch.favor||0) + 5);
  ch.prestige = Math.min(100, (ch.prestige||50) + 2);
  // 反对党 cohesion-3
  if (contested) {
    var bp = _ty3_getPartyObj(biggestParty);
    if (bp) bp.cohesion = Math.max(0, (parseInt(bp.cohesion,10)||50) - 3);
  }
  if (typeof addCYBubble === 'function') addCYBubble('皇帝', '——朕钦定' + name + '。' + (contested ? '（违逆' + biggestParty + '·皇权-3）' : '（皇权-1）'), false);
  if (typeof addEB === 'function') addEB('廷推', '钦定·' + name + ((CY._ty2&&CY._ty2.topic)?' · '+CY._ty2.topic:''));
  // 回调
  var cb = CY._ty3_phase3_callback;
  CY._ty3_phase3_callback = null;
  if (typeof cb === 'function') cb({ winner: name, mode: 'qinding', contested: contested });
}

function _ty3_phase3_doPublicVote() {
  var bg = document.getElementById('ty3-tuijian-bg');
  if (bg) bg.remove();
  // 影响力加权抽签
  var pool = [];
  Object.values(CY._ty3_phase3_byParty || {}).forEach(function(info) {
    info.candidates.forEach(function(c) {
      var weight = (info.party.influence||50) + (c.prestige||50) * 0.5;
      pool.push({ name: c.name, party: info.party.name, weight: weight });
    });
  });
  if (pool.length === 0) {
    if (typeof toast === 'function') toast('无候选可公推');
    return;
  }
  var totalW = pool.reduce(function(a,b){return a + b.weight;}, 0);
  var r = Math.random() * totalW;
  var chosen = pool[0];
  for (var i = 0, acc = 0; i < pool.length; i++) {
    acc += pool[i].weight;
    if (r <= acc) { chosen = pool[i]; break; }
  }
  // 应用
  var ch = (typeof findCharByName === 'function') ? findCharByName(chosen.name) : null;
  if (ch) {
    ch.loyalty = Math.min(100, (ch.loyalty||50) + 5);
    ch.favor = Math.min(100, (ch.favor||0) + 3);
    ch.prestige = Math.min(100, (ch.prestige||50) + 2);
  }
  var _ttOld = (typeof GM.partyStrife === 'number') ? GM.partyStrife : 50;
  if (typeof GM.partyStrife === 'number') GM.partyStrife = Math.max(0, GM.partyStrife - 3);
  var _ttText = _ty3_strifeChange(_ttOld, GM.partyStrife);
  if (typeof addCYBubble === 'function') addCYBubble('内侍', '〔 廷推结果 〕百官公推 ' + chosen.name + (chosen.party ? '（' + chosen.party + '）' : '') + '·' + _ttText, true);
  if (typeof addEB === 'function') addEB('廷推', '公推·' + chosen.name);
  var cb = CY._ty3_phase3_callback;
  CY._ty3_phase3_callback = null;
  if (typeof cb === 'function') cb({ winner: chosen.name, mode: 'public_vote', party: chosen.party });
}

function _ty3_phase3_skip() {
  var bg = document.getElementById('ty3-tuijian-bg');
  if (bg) bg.remove();
  if (typeof addCYBubble === 'function') addCYBubble('皇帝', '——此位暂阙·容朕思量。', false);
  if (typeof addEB === 'function') addEB('廷推', '暂阙·此位空缺');
  var cb = CY._ty3_phase3_callback;
  CY._ty3_phase3_callback = null;
  if (typeof cb === 'function') cb({ winner: null, mode: 'skip' });
}

// ═══════════════════════════════════════════════════════════════════════
//  §11·阶段 6·用印颁行(朝代差异化 + 党派 officePositions 阻挠) — 波 3
// ═══════════════════════════════════════════════════════════════════════
// 决议非「留待再议」 + 非 S 档(S 档跳过)·进入用印阶段。
// 朝代分流：
//   唐宋 (scenario.dynastyType==='tang'/'song' 或 startYear<1368) → 政事堂副署 → 玉玺
//   明 (scenario.dynastyType==='ming' 或 1368<=startYear<1644)   → 内阁票拟 → 司礼监批红 → 玉玺
//   清 (scenario.dynastyType==='qing' 或 startYear>=1644)        → 军机处直递 → 朱批
// 党派阻挠：若决议不利于某党 + 该党 influence>50 + 控制相应"用印"官职
//   留中概率 = (该党 influence - 50) / 50

function _ty3_phase6_resolveDynasty() {
  var sc = (typeof P !== 'undefined' && P.scenario) || P || {};
  if (sc.dynastyType) return sc.dynastyType;
  var year = parseInt(sc.startYear, 10) || 1628;
  if (year < 907) return 'tang';
  if (year < 1279) return 'song';
  if (year < 1644) return 'ming';
  return 'qing';
}

function _ty3_phase6_open(decision, archonGrade, opts) {
  if (!decision || decision.mode === 'defer') return;
  if (archonGrade === 'S') {
    // S 档跳过用印
    if (typeof addCYBubble === 'function') addCYBubble('内侍', '★ S 档·圣旨煌煌·跳过用印阶段·诏命直颁。', true);
    return;
  }
  var dynasty = _ty3_phase6_resolveDynasty();
  // 寻找最有阻挠能力的党派
  var hostile = _ty3_phase6_findHostileSealHolder(decision, opts);
  // 渲染 modal
  var bg = document.createElement('div');
  bg.id = 'ty3-seal-bg';
  bg.style.cssText = 'position:fixed;inset:0;z-index:1310;background:rgba(0,0,0,0.78);display:flex;align-items:center;justify-content:center;';
  var dynastyLabel = { tang: '唐', song: '宋', ming: '明', qing: '清' }[dynasty] || '古';
  var flowDesc = '';
  if (dynasty === 'tang' || dynasty === 'song') flowDesc = '政事堂副署 → 玉玺';
  else if (dynasty === 'ming') flowDesc = '内阁票拟 → 司礼监批红 → 玉玺';
  else if (dynasty === 'qing') flowDesc = '军机处直递 → 朱批';

  var html = '<div class="ty3-sl-modal">';
  html += '<div class="ty3-sl-title">〔 用 印 颁 行·' + dynastyLabel + '制 〕</div>';
  html += '<div class="ty3-sl-flow">' + escHtml(flowDesc) + '</div>';

  if (hostile) {
    var prob = Math.round(hostile.holdProb * 100);
    html += '<div class="ty3-sl-warn">';
    html += '⚠ <b>' + escHtml(hostile.partyName) + '</b> 影响力 ' + hostile.influence + '·控制 <b>' + escHtml(hostile.officePos) + '</b>';
    html += '<br>有 ' + prob + '% 概率「留中不发」 — ';
    html += '<button class="bt bsm" onclick="_ty3_phase6_doSeal(true)">⚔ 强行用印（皇权-5）</button>';
    html += ' <button class="bt bsm" onclick="_ty3_phase6_doSeal(false)">🎲 听天由命</button>';
    html += '</div>';
    CY._ty3_seal_hostile = hostile;
  } else {
    html += '<div class="ty3-sl-ok">无党派阻挠·诏命可顺利用印颁行</div>';
    html += '<div class="ty3-sl-foot"><button class="bt bp" onclick="_ty3_phase6_doSeal(false)">📜 用 印</button></div>';
    CY._ty3_seal_hostile = null;
  }
  html += '</div>';
  bg.innerHTML = html;
  document.body.appendChild(bg);
}

function _ty3_phase6_findHostileSealHolder(decision, opts) {
  // 寻找控制用印官职的反对方党派
  var dynasty = _ty3_phase6_resolveDynasty();
  var sealKeywords = [];
  if (dynasty === 'tang' || dynasty === 'song') sealKeywords = ['政事堂', '中书令', '门下省', '同平章事', '尚书左仆射'];
  else if (dynasty === 'ming') sealKeywords = ['司礼监掌印', '司礼监秉笔', '内阁首辅', '内阁次辅'];
  else if (dynasty === 'qing') sealKeywords = ['军机大臣', '军机处'];

  var proposerParty = (opts && opts.proposerParty) || '';
  var enemyParties = proposerParty ? _ty3_getOpposingParties(proposerParty) : _ty3_getParties().filter(function(p){return _ty3_partyInfluence(p.name) >= 50;});

  var best = null;
  enemyParties.forEach(function(p) {
    var infl = _ty3_partyInfluence(p.name);
    if (infl < 50) return;
    var positions = p.officePositions || [];
    var matched = '';
    for (var i = 0; i < positions.length; i++) {
      for (var j = 0; j < sealKeywords.length; j++) {
        if (positions[i] && positions[i].indexOf(sealKeywords[j]) >= 0) {
          matched = positions[i];
          break;
        }
      }
      if (matched) break;
    }
    if (!matched) return;
    var prob = Math.max(0, Math.min(0.95, (infl - 50) / 50));
    if (!best || prob > best.holdProb) {
      best = { partyName: p.name, influence: infl, officePos: matched, holdProb: prob };
    }
  });
  return best;
}

function _ty3_phase6_doSeal(force) {
  var bg = document.getElementById('ty3-seal-bg');
  if (bg) bg.remove();
  var hostile = CY._ty3_seal_hostile;
  CY._ty3_seal_hostile = null;
  if (force && hostile) {
    if (GM.huangquan && typeof GM.huangquan.index === 'number') GM.huangquan.index = Math.max(0, GM.huangquan.index - 5);
    else if (GM.vars && GM.vars['皇权']) GM.vars['皇权'].value = Math.max(0, (GM.vars['皇权'].value||50) - 5);
    if (typeof addCYBubble === 'function') addCYBubble('内侍', '〔 强行用印 〕诏命颁行·皇权-5·' + hostile.partyName + ' 怀恨于心', true);
    var ph = _ty3_getPartyObj(hostile.partyName);
    if (ph) ph.cohesion = Math.min(100, (parseInt(ph.cohesion,10)||50) + 3); // 反派被压·内部反而更团结(常见史实)
    var _siOld = (typeof GM.partyStrife === 'number') ? GM.partyStrife : 50;
    if (typeof GM.partyStrife === 'number') GM.partyStrife = Math.min(100, GM.partyStrife + 4);
    if (typeof addEB === 'function') addEB('用印', '强行用印·' + hostile.partyName + ' 怀恨·' + _ty3_strifeChange(_siOld, GM.partyStrife));
    return;
  }
  if (hostile) {
    var roll = Math.random();
    if (roll < hostile.holdProb) {
      // 留中
      if (typeof addCYBubble === 'function') addCYBubble('内侍', '〔 留中不发 〕' + hostile.partyName + ' 凭 ' + hostile.officePos + ' 之权·诏命暂搁', true);
      var topic = (CY._ty2 && CY._ty2.topic) || '';
      if (topic) {
        if (!GM._ccHeldItems) GM._ccHeldItems = [];
        GM._ccHeldItems.push({ topic: topic, from: '用印阻挠', turn: GM.turn, blockedBy: hostile.partyName });
      }
      if (typeof addEB === 'function') addEB('用印', '诏命被 ' + hostile.partyName + ' 留中');
      return;
    }
  }
  // 顺利用印
  if (typeof addCYBubble === 'function') addCYBubble('内侍', '〔 用印颁行 〕诏命已下·六部奉行', true);
  if (typeof addEB === 'function') addEB('用印', '诏命颁行');
  // 弹"圣意补述"·让玩家可选填本次裁决的实际意图(让 AI 推演明白部分采纳/角度切换)
  setTimeout(function(){ _ty3_phase6_offerVerdictNote(); }, 250);
}

// 用印后可选弹窗·让玩家用 1-2 句话写下"朕实际想做什么"·进 CY._ty3._playerVerdictNote
// 设计意图：议题原文 + AI 草诏 ≠ 玩家心意。玩家此处补一句·直接喂给推演 prompt
function _ty3_phase6_offerVerdictNote() {
  if (!CY._ty3) return;
  var bg = document.createElement('div');
  bg.id = 'ty3-verdict-bg';
  bg.style.cssText = 'position:fixed;inset:0;z-index:1320;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;';
  var html = '<div class="ty3-vd-modal" style="background:linear-gradient(180deg,#ead7b3,#dcc591);border:1px solid #8c7654;border-radius:4px;padding:1.6rem 1.8rem;max-width:540px;width:90%;color:#2a1a10;font-family:STSong,SimSun,serif;box-shadow:0 12px 40px rgba(0,0,0,0.7);">';
  html += '<div style="font-family:STKaiti,KaiTi,serif;font-size:1.25rem;letter-spacing:0.4em;padding-left:0.4em;text-align:center;margin-bottom:0.5rem;color:#14090b;">〔 圣 意 补 述 〕</div>';
  html += '<div style="text-align:center;font-size:0.78rem;color:#6d5a3e;letter-spacing:0.2em;padding-left:0.2em;margin-bottom:1.2rem;">诏书已颁·然圣心未尽·若有它意·亲笔记之</div>';
  html += '<div style="font-size:0.78rem;color:#4a3520;line-height:1.65;margin-bottom:0.7rem;font-family:STZhongsong,FangSong,serif;">';
  html += '此栏可选填·若朕之裁决与廷议原议有所偏离(只采一部·或换一角度·或意在他事)·写下二三句·让史官与百官会其圣意。';
  html += '</div>';
  html += '<textarea id="ty3-vd-input" placeholder="如：议虽如此·然朕意只在江南三省试行·北方暂缓……" style="width:100%;min-height:90px;padding:10px 12px;background:rgba(255,255,255,0.5);border:1px solid rgba(140,118,84,0.5);border-radius:2px;font-family:STKaiti,KaiTi,serif;font-size:0.92rem;color:#14090b;line-height:1.7;resize:vertical;"></textarea>';
  html += '<div style="text-align:right;margin-top:1rem;display:flex;gap:0.6rem;justify-content:flex-end;">';
  html += '<button onclick="_ty3_phase6_skipVerdictNote()" style="padding:7px 18px;background:transparent;border:1px solid #8c7654;color:#6d5a3e;border-radius:2px;font-family:STZhongsong,FangSong,serif;font-size:0.82rem;letter-spacing:0.18em;padding-left:calc(18px + 0.18em);cursor:pointer;">不必·诏书已足</button>';
  html += '<button onclick="_ty3_phase6_saveVerdictNote()" style="padding:7px 22px;background:#b8392c;border:1px solid #7a2418;color:#fff;border-radius:2px;font-family:STZhongsong,FangSong,serif;font-size:0.82rem;letter-spacing:0.18em;padding-left:calc(22px + 0.18em);cursor:pointer;">朱 笔 留 之</button>';
  html += '</div></div>';
  bg.innerHTML = html;
  document.body.appendChild(bg);
  setTimeout(function(){ var ta = document.getElementById('ty3-vd-input'); if (ta) ta.focus(); }, 100);
}

function _ty3_phase6_skipVerdictNote() {
  var bg = document.getElementById('ty3-verdict-bg'); if (bg) bg.remove();
}

function _ty3_phase6_saveVerdictNote() {
  var ta = document.getElementById('ty3-vd-input');
  var txt = (ta && ta.value || '').trim();
  if (txt) {
    if (!CY._ty3) CY._ty3 = {};
    CY._ty3._playerVerdictNote = txt.slice(0, 240);
    // 同步 patch 到最近的 recentChaoyi(因为 phase14 已先执行)
    if (Array.isArray(GM.recentChaoyi) && GM.recentChaoyi[0]) {
      GM.recentChaoyi[0].playerVerdictNote = CY._ty3._playerVerdictNote;
    }
    if (typeof addEB === 'function') addEB('圣意', '朱批: ' + txt.slice(0, 24));
  }
  var bg = document.getElementById('ty3-verdict-bg'); if (bg) bg.remove();
}

// 修复 1·删除独立 seal hook(已合并到草诏 picker pick/skip 的回调链)
// D 档 force 路径补：在 _ty3_dgPick 触发用印
(function _ty3_installDChainHook() {
  if (typeof window === 'undefined') return;
  var attempts = 0;
  function tryHook() {
    if (attempts++ > 30) return;
    if (typeof window._ty3_dgPick !== 'function') {
      setTimeout(tryHook, 200);
      return;
    }
    if (window._ty3_dgPick._chainHooked) return;
    var orig = window._ty3_dgPick;
    window._ty3_dgPick = function(choice) {
      orig.apply(this, arguments);
      if (CY._ty3_settleCtx) CY._ty3_settleCtx.dChoice = choice;
      if (choice === 'force') {
        // D + 硬推 → 仍走草诏 picker → 用印
        var ctx = CY._ty3_settleCtx;
        if (ctx) setTimeout(function(){ _ty3_phase5_openDraftPicker(ctx.decision, 'D', ctx.opts); }, 300);
      } else if (choice === 'yield') {
        // 妥协 → 不进草诏不用印
        CY._ty3_settleCtx = null;
      }
    };
    window._ty3_dgPick._chainHooked = true;
  }
  tryHook();
})();

// ═══════════════════════════════════════════════════════════════════════
//  §12·新党派系统(分裂 / 私下结社 / 弹劾结党 / 消亡) — 波 3·历史修正版
// ═══════════════════════════════════════════════════════════════════════
// 史实约束：中国古代结党是罪名(结党营私)·非自愿身份·无人公开宣称。
// 党派之名常由敌人/史官追加·而非当事人自称。
// 接现有 GM.parties[] 动态层。新党诞生三种现实路径：
//   1·分裂        — 旧党 cohesion<20 持续 3 回合 → 拆为 2 个新党
//                   (后人/敌人将分裂者另立别名·status='分化')
//   2·私下结社    — 某官 prestige>80 + favor>70 + 当前党 cohesion<30
//                   → 私下结社·status='隐党'·非公开·无明确宣称
//   3·弹劾结党    — 玩家在廷议中准奏「X 等结党」之议
//                   → 该群被定性为新党·status='被劾'·成员名声受损
// 消亡：cohesion<10 + influence<5 + members<3 → 自然消亡

function _ty3_partySpawn(opts) {
  // opts = { name, leaderName, founders[], parentParty, policyStances[], reason }
  if (!opts || !opts.name) return null;
  if (!Array.isArray(GM.parties)) GM.parties = [];
  // 重名检查
  if (GM.parties.some(function(p){return p && p.name === opts.name;})) {
    if (typeof toast === 'function') toast('「' + opts.name + '」已存在·无法新设');
    return null;
  }
  var newParty = {
    name: opts.name,
    leader: opts.leaderName || (opts.founders && opts.founders[0]) || '',
    faction: opts.faction || (GM.player && GM.player.faction) || '',
    crossFaction: false,
    influence: opts.initialInfluence || 8,
    cohesion: opts.initialCohesion || 75,
    satisfaction: 70,
    status: '新生',
    memberCount: (opts.founders||[]).length || 1,
    ideology: opts.ideology || '',
    members: (opts.founders||[]).join('·'),
    policyStance: opts.policyStances || [],
    enemies: [],
    allies: [],
    foundYear: GM.year || 0,
    foundTurn: GM.turn || 0,
    splinterFrom: opts.parentParty || null,
    history: '建于 ' + (GM.year||'?') + '·' + (opts.reason||'缘由不详'),
    desc: opts.desc || ('新生党派·' + (opts.reason||'')),
    currentAgenda: opts.agenda || '稳固党势'
  };
  GM.parties.push(newParty);
  // 国史级事件·入编年
  if (!Array.isArray(GM._chronicle)) GM._chronicle = [];
  GM._chronicle.push({
    turn: GM.turn || 1,
    date: GM._gameDate || (typeof getTSText === 'function' ? getTSText(GM.turn) : ''),
    type: '党祸·新党生',
    text: '世人始以「' + newParty.name + '」目' + (newParty.leader||'其党魁') + '一系·' + (opts.reason||'缘由不详'),
    tags: ['党派', '新党', newParty.name],
    partyName: newParty.name,
    parentParty: opts.parentParty || ''
  });
  if (typeof toast === 'function') toast('★ 新党派·' + newParty.name);
  // 创始成员 ch.party 写入
  (opts.founders||[]).forEach(function(nm) {
    var ch = (typeof findCharByName === 'function') ? findCharByName(nm) : null;
    if (ch) {
      ch._previousParty = ch.party || '';
      ch.party = newParty.name;
    }
  });
  return newParty;
}

function _ty3_partyDispose(partyName, reason) {
  if (!Array.isArray(GM.parties)) return false;
  var idx = GM.parties.findIndex(function(p){return p && p.name === partyName;});
  if (idx < 0) return false;
  var p = GM.parties[idx];
  // 标记湮灭(不 splice·保留 status='湮灭' 供史记查询)
  p.status = '湮灭';
  p.disposedTurn = GM.turn;
  p.disposedReason = reason || '式微无继';
  // 成员 ch.party 清空
  (GM.chars||[]).forEach(function(c) {
    if (c && c.party === partyName) c.party = '';
  });
  // 国史级事件·入编年
  if (!Array.isArray(GM._chronicle)) GM._chronicle = [];
  GM._chronicle.push({
    turn: GM.turn || 1,
    date: GM._gameDate || (typeof getTSText === 'function' ? getTSText(GM.turn) : ''),
    type: '党祸·党亡',
    text: '「' + partyName + '」' + (reason||'式微无继') + '·遂湮灭于朝',
    tags: ['党派', '党灭', partyName],
    partyName: partyName
  });
  return true;
}

// 注：原"玩家主动册封新党"机制已删除。
// 史实约束：中国古代结党是罪名·无人公开宣称·亦无君主"册党"之礼制。
// 替代路径：弹劾结党(见 _ty3_phase12_onAccusationApproved)
// 保留 stub 防止旧存档/旧调用崩溃·调用即提示
function _ty3_phase3b_openSpawnDialog() {
  if (typeof toast === 'function') toast('史制无君上册党之例·请改走弹劾结党路径');
}
function _ty3_phase3b_doSpawn() { _ty3_phase3b_openSpawnDialog(); }

// 弹劾结党议题准奏 → 自动 spawn 党(status='被劾')
// 由 _ty2_decide hook 在 mode!=='defer' 且议题含"结党/朋党/党羽" + decision 倾向 approve 时调用
function _ty3_phase12_onAccusationApproved(topic, accusedNames, accuser) {
  if (!topic || !accusedNames || accusedNames.length === 0) return null;
  // 党名由敌方/史官命名·常以「X 党」「Y 一系」「某某之徒」呼之
  var leaderName = accusedNames[0];
  var newName = leaderName + '党'; // 后人定性·非自称
  var idx = 1;
  while ((GM.parties||[]).some(function(p){return p && p.name === newName;})) {
    newName = leaderName + '党·' + idx;
    idx++;
  }
  var p = _ty3_partySpawn({
    name: newName,
    leaderName: leaderName,
    founders: accusedNames,
    initialInfluence: 12,
    initialCohesion: 65,
    ideology: '被劾结党营私·尚未自承',
    reason: '弹劾定性',
    agenda: '辨诬自保'
  });
  if (p) {
    p.status = '被劾';
    p.accusedBy = accuser || '言官';
    p.accusedTurn = GM.turn;
    // 被指控者名声受损
    accusedNames.forEach(function(nm) {
      var ch = (typeof findCharByName === 'function') ? findCharByName(nm) : null;
      if (ch) {
        ch.prestige = Math.max(0, (ch.prestige||50) - 8);
        ch.stress = Math.min(100, (ch.stress||0) + 15);
        if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
          NpcMemorySystem.remember(nm, '被劾「结党」·名声大损·心怀不平', '怒', 8);
        }
      }
    });
    if (typeof addCYBubble === 'function') {
      addCYBubble('内侍', '〔 「' + newName + '」之名遂为公议所传 〕', true);
    }
    // 国史级事件·入编年(非时政提醒)
    if (!Array.isArray(GM._chronicle)) GM._chronicle = [];
    GM._chronicle.push({
      turn: GM.turn || 1,
      date: GM._gameDate || (typeof getTSText === 'function' ? getTSText(GM.turn) : ''),
      type: '党祸·被劾结党',
      text: accuser + '劾「' + accusedNames.join('、') + '」结党营私·准奏定性·世人遂以「' + newName + '」呼之·名声大损',
      tags: ['党派', '弹劾', '结党', newName],
      partyName: newName,
      accuser: accuser,
      accused: accusedNames.slice()
    });
  }
  return p;
}

// endTurn 钩子·每回合扫描自然演化
function _ty3_partyEvolutionTick() {
  if (!Array.isArray(GM.parties) || GM.parties.length === 0) return;
  if (!GM._partyEvolutionState) GM._partyEvolutionState = {};
  var state = GM._partyEvolutionState;

  GM.parties.forEach(function(p) {
    if (!p || !p.name || p.status === '湮灭') return;
    var coh = parseInt(p.cohesion, 10) || 50;
    var infl = parseInt(p.influence, 10) || 50;
    var members = _ty3_getPartyMembers(p.name);

    // 1·消亡检查(cohesion<10 + influence<5 + members<3)
    if (coh < 10 && infl < 5 && members.length < 3) {
      _ty3_partyDispose(p.name, '式微·凝聚瓦解·影响湮没');
      return;
    }

    // 2·分裂检查(cohesion<20 持续 3 回合)
    if (coh < 20) {
      state[p.name] = state[p.name] || { lowCohStreak: 0 };
      state[p.name].lowCohStreak = (state[p.name].lowCohStreak||0) + 1;
      if (state[p.name].lowCohStreak >= 3 && members.length >= 4) {
        // 拆党：取一半 prestige 高者另立
        members.sort(function(a,b){return (b.prestige||50)-(a.prestige||50);});
        var splitters = members.slice(0, Math.ceil(members.length/2));
        var newName = '新' + p.name;
        // 重名检查·后缀加序号
        var idx = 1;
        while (GM.parties.some(function(x){return x && x.name === newName;})) { newName = '新' + p.name + idx; idx++; }
        _ty3_partySpawn({
          name: newName,
          leaderName: splitters[0].name,
          founders: splitters.map(function(c){return c.name;}),
          parentParty: p.name,
          ideology: '原' + p.name + '分裂·别树一帜',
          initialInfluence: Math.round(infl * 0.4),
          initialCohesion: 70,
          reason: '凝聚瓦解·分而新立'
        });
        // 旧党 influence 减半
        p.influence = Math.round(infl * 0.6);
        p.status = '分化';
        state[p.name].lowCohStreak = 0;
        // 触发议题(让玩家干预)
        if (!GM._pendingTinyiTopics) GM._pendingTinyiTopics = [];
        GM._pendingTinyiTopics.push({
          topic: '议处' + p.name + '分化·新党' + newName + '何以善后',
          from: '党派分化',
          turn: GM.turn,
          isPersonnel: false,
          parentParty: p.name,
          newParty: newName
        });
      }
    } else {
      if (state[p.name]) state[p.name].lowCohStreak = 0;
    }

    // 3·私下结社(史实修正：不可公开自立·只能私下·被发现才显形)
    //    党魁外有人 prestige>80 + favor>70 + 当前党 coh<30 → status='隐党'
    //    隐党暂不公开·待玩家在廷议中弹劾结党·或推演事件揭发后才显
    if (coh < 30) {
      var leaderName = p.leader;
      var defectors = members.filter(function(c){
        if (c.name === leaderName) return false;
        return (c.prestige||0) > 80 && (c.favor||0) > 70;
      });
      if (defectors.length > 0) {
        var founder = defectors[0];
        var hiddenName = founder.name + '门人'; // 史官用语·"门人""一系"非自称
        if (!GM.parties.some(function(x){return x && x.name === hiddenName;})) {
          var hp = _ty3_partySpawn({
            name: hiddenName,
            leaderName: founder.name,
            founders: [founder.name],
            parentParty: p.name,
            ideology: '私下结社·尚未公开',
            initialInfluence: 5, // 隐党影响低·尚未公开
            initialCohesion: 70,
            reason: '名望日盛·私下笼络党羽'
          });
          if (hp) {
            hp.status = '隐党';
            hp._hidden = true;
            hp._foundedSecretlyTurn = GM.turn;
          }
          // 不显式扣旧党·因尚未公开
        }
      }
    }
  });
}

// 暴露波 3 API
if (typeof window !== 'undefined') {
  window._ty3_phase3_open = _ty3_phase3_open;
  window._ty3_phase3_qinDing = _ty3_phase3_qinDing;
  window._ty3_phase3_doPublicVote = _ty3_phase3_doPublicVote;
  window._ty3_phase3_skip = _ty3_phase3_skip;
  window._ty3_phase3_isPersonnelTopic = _ty3_phase3_isPersonnelTopic;
  window._ty3_phase6_open = _ty3_phase6_open;
  window._ty3_tickChronicleTracks = _ty3_tickChronicleTracks;
  // 玩家终结长期工程入口·console 可调·UI 后续接入
  // 用法: terminateChronicleTrack('track_T15_xxx', '帝意决意废之')
  window.terminateChronicleTrack = function(id, reason) {
    if (typeof ChronicleTracker === 'undefined' || !ChronicleTracker.terminate) return false;
    var ok = ChronicleTracker.terminate(id, 'player', reason || '帝意中辍');
    if (ok && typeof toast === 'function') toast('〔已中辍〕长期工程已废止·后果已应用');
    else if (!ok && typeof toast === 'function') toast('〔不可中辍〕该项不可终结·或已结案');
    return ok;
  };
  // 列出所有 terminable 的长期工程·便于玩家在控制台看
  window.listTerminableTracks = function() {
    if (!Array.isArray(GM._chronicleTracks)) return [];
    return GM._chronicleTracks.filter(function(t){
      return t && t.status === 'active' && t.terminable !== false;
    }).map(function(t){
      return { id: t.id, title: t.title, progress: t.progress, short: t.shortTermBalance, long: t.longTermBalance, termCost: t.terminationCost && t.terminationCost.narrative };
    });
  };
  window._ty3_phase6_offerVerdictNote = _ty3_phase6_offerVerdictNote;
  window._ty3_phase6_skipVerdictNote = _ty3_phase6_skipVerdictNote;
  window._ty3_phase6_saveVerdictNote = _ty3_phase6_saveVerdictNote;
  window._ty3_phase6_doSeal = _ty3_phase6_doSeal;
  // 注：_ty3_phase3b_* 保留 stub 兼容旧代码·历史制度无君上册党
  window._ty3_phase3b_openSpawnDialog = _ty3_phase3b_openSpawnDialog;
  window._ty3_phase3b_doSpawn = _ty3_phase3b_doSpawn;
  // 弹劾结党准奏 → spawn 党(status='被劾')
  window._ty3_phase12_onAccusationApproved = _ty3_phase12_onAccusationApproved;
  window._ty3_partySpawn = _ty3_partySpawn;
  window._ty3_partyDispose = _ty3_partyDispose;
  window._ty3_partyEvolutionTick = _ty3_partyEvolutionTick;
}

// ═══════════════════════════════════════════════════════════════════════
//  §13·阶段 7·追责回响(N 回合后强制复盘) — 波 4
// ═══════════════════════════════════════════════════════════════════════
// 接 GM._edictTracker[] (源 source==='tinyi2' 或 'ty3' / category 含'廷议')
// 复盘条件：edict.turn + reviewDelay (默认 3 回合) <= GM.turn 且 status≠'reviewed'
// 落实判定：
//   progressPercent>=80 → 充分落实
//   progressPercent>=40 → 部分落实
//   progressPercent<40 或 status==='blocked' → 未落实
//   status==='backfire' / feedback含'反效果/民变/失利' → 反效果

var _TY3_REVIEW_DELAY = 3; // 默认 N 回合后复盘

// 追责回响纳入范围：所有玩家正式裁决产生的诏令(_edictTracker 中)
//   廷议:  source='tinyi2' / 'ty3' (V3 廷议) / category 含'廷议'
//   常朝:  source='changchao' (准奏/改批) / 'changchao_decree' (亲诏) / category 含'常朝'
//   御前:  source='yuqian2' (密议·虽不公开仍是诏命) / category 含'御前'
//   不含: 留中(GM._ccHeldItems)·部议(GM.deptTasks)·驳奏(无持久)·下廷议(转待议册无诏令)
function _ty3_isReviewableEdict(e) {
  if (!e) return false;
  var sources = ['tinyi2', 'ty3', 'changchao', 'changchao_decree', 'yuqian2'];
  if (sources.indexOf(e.source) >= 0) return true;
  if (/廷议|常朝|御前/.test(e.category || '')) return true;
  return false;
}

function _ty3_phase7_runReview() {
  if (!Array.isArray(GM._edictTracker)) return;
  var matured = GM._edictTracker.filter(function(e) {
    if (!e || e._ty3Reviewed) return false;
    if (!_ty3_isReviewableEdict(e)) return false;
    return ((e.turn||0) + _TY3_REVIEW_DELAY) <= (GM.turn||0);
  });
  if (matured.length === 0) return;
  // 准备 prompt 注入队列(供 AI 推演读取·非数值修改)
  if (!Array.isArray(GM._ty3_pendingReviewForPrompt)) GM._ty3_pendingReviewForPrompt = [];
  matured.forEach(function(edict) {
    var summary = _ty3_phase7_reviewOne(edict);
    edict._ty3Reviewed = true;
    edict._ty3ReviewedAt = GM.turn;
    if (summary) GM._ty3_pendingReviewForPrompt.push(summary);
  });
}

// 改造·只判定 outcome + 写编年 + 写 _turnReport 史记弹窗 + 给 prompt 留种子
//        不再做党派 cohesion / influence / prestige / partyStrife 数值变化
//        让 AI 据此自由演绎社会反响(narrative + npc_actions + events)
function _ty3_phase7_reviewOne(edict) {
  if (!edict) return null;
  // 推断主奏方
  var proposerParty = edict.proposerParty || (edict._publicMeta && edict._publicMeta.proposerParty) || '';
  if (!proposerParty && edict.assignee) {
    var ch = (typeof findCharByName === 'function') ? findCharByName(edict.assignee) : null;
    if (ch && ch.party) proposerParty = ch.party;
  }
  // 落实判定
  var pct = parseInt(edict.progressPercent, 10);
  if (isNaN(pct)) pct = (edict.status === 'completed') ? 80 : (edict.status === 'blocked' || edict.status === 'failed') ? 20 : 50;
  var fb = (edict.feedback || '');
  var isBackfire = /反效果|民变|失利|溃败|动摇|大乱|凋敝/.test(fb) || edict.status === 'backfire';
  var outcome;
  if (isBackfire) outcome = 'backfire';
  else if (pct >= 80) outcome = 'fulfilled';
  else if (pct >= 40) outcome = 'partial';
  else outcome = 'unfulfilled';

  var partyObj = proposerParty ? _ty3_getPartyObj(proposerParty) : null;
  var leader = proposerParty ? _ty3_getPartyLeader(proposerParty) : null;
  var assigneeCh = edict.assignee ? ((typeof findCharByName === 'function') ? findCharByName(edict.assignee) : null) : null;

  // 诏令性质·影响 AI 反响演绎
  var venueType = '';
  if (edict.source === 'tinyi2' || edict.source === 'ty3' || /廷议/.test(edict.category||'')) venueType = '廷议';
  else if (edict.source === 'yuqian2' || /御前/.test(edict.category||'')) venueType = '御前';
  else if (edict.source === 'changchao' || edict.source === 'changchao_decree' || /常朝/.test(edict.category||'')) {
    venueType = (edict.source === 'changchao_decree') ? '亲诏' : '常朝';
  }

  // 史官措辞
  var label = { fulfilled: '充分落实', partial: '部分落实', unfulfilled: '未落实', backfire: '反效果' }[outcome];
  var histLabel = { fulfilled: '准奏果验', partial: '行而未尽', unfulfilled: '奉行不力', backfire: '适得其反' }[outcome] || label;

  // 写编年(国史级记录)
  if (!Array.isArray(GM._chronicle)) GM._chronicle = [];
  var histTags = [venueType || '诏命', '追责回响', label];
  if (proposerParty) histTags.push(proposerParty);
  // 编年类型按诏令性质区分
  var chronType = venueType ? (venueType + '追责') : '诏命追责';
  GM._chronicle.push({
    turn: GM.turn || 1,
    date: GM._gameDate || (typeof getTSText === 'function' ? getTSText(GM.turn) : ''),
    type: chronType,
    text: '前' + (venueType||'议') + '「' + (edict.content||'').slice(0, 40) + '」' +
          (proposerParty ? '·' + proposerParty + '所主' : '') +
          '·三回合后' + histLabel,
    tags: histTags,
    edictId: edict.id,
    outcome: outcome,
    venueType: venueType,
    relatedParty: proposerParty || '',
    relatedChars: [leader && leader.name, assigneeCh && assigneeCh.name].filter(Boolean)
  });

  // 写 _turnReport 让史记弹窗显示(就地展示·无需另开 modal)
  if (!GM._turnReport) GM._turnReport = [];
  GM._turnReport.push({
    type: 'tinyi_review',
    turn: GM.turn || 0,
    edictContent: (edict.content || '').slice(0, 80),
    edictId: edict.id,
    outcome: outcome,
    label: label,
    histLabel: histLabel,
    venueType: venueType,
    proposerParty: proposerParty || '',
    leaderName: leader ? leader.name : '',
    assigneeName: assigneeCh ? assigneeCh.name : '',
    delayTurns: (GM.turn||0) - (edict.turn||0)
  });

  // NPC 记忆(只此一项轻量记忆·非数值修改)
  try {
    if (assigneeCh && typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
      var moodMap = { fulfilled: '喜', partial: '平', unfulfilled: '忧', backfire: '恨' };
      NpcMemorySystem.remember(assigneeCh.name,
        '议「' + (edict.content||'').slice(0,15) + '」' + label,
        moodMap[outcome] || '平', outcome === 'fulfilled' ? 6 : outcome === 'backfire' ? 8 : 5);
    }
  } catch(_){}

  // 返回 summary 供 AI prompt 注入(让 AI 演绎反响而非系统修改数值)
  return {
    edictId: edict.id,
    content: edict.content || '',
    venueType: venueType,
    proposerParty: proposerParty || '',
    leaderName: leader ? leader.name : '',
    assigneeName: assigneeCh ? assigneeCh.name : '',
    outcome: outcome,
    label: label,
    histLabel: histLabel,
    turn: edict.turn,
    reviewedTurn: GM.turn,
    delayTurns: (GM.turn||0) - (edict.turn||0)
  };
}

// ═══════════════════════════════════════════════════════════════════════
//  §14·廷议 → 推演(GM.recentChaoyi[] 注入 prompt) — 波 4
// ═══════════════════════════════════════════════════════════════════════
// 廷议结算时写入 GM.recentChaoyi[]·tm-endturn-ai-infer.js 的 prompt 构建
// 已注入此队列的最近 5 条·让 AI 知晓玩家近期廷议倾向

function _ty3_phase14_recordChaoyiSummary(decision, opts) {
  if (!opts) opts = {};
  if (!Array.isArray(GM.recentChaoyi)) GM.recentChaoyi = [];
  var topic = (CY._ty2 && CY._ty2.topic) || (CY._ty3 && CY._ty3.topic) || '';
  if (!topic) return;
  var counts = (typeof _ty2_countStances === 'function') ? _ty2_countStances() : null;

  // 收集议题原始诉求(议前预审 meta 中的 proposerReason / accusationContent / focal_disputes 提示)
  var meta = (CY._ty3 && CY._ty3.meta) || (window._ty3_publicMeta) || {};
  var originalGist = meta.proposerReason || meta.memorialContent || (meta.from || '') || '';
  if (originalGist.length > 100) originalGist = originalGist.slice(0, 100) + '…';

  // 收集各 NPC 关键发言(取每位发言者最后一轮·按 stance 极端性排序前 6 条)
  var keyMoments = [];
  try {
    var allSpeeches = (CY._ty2 && CY._ty2._allSpeeches) || [];
    if (allSpeeches.length > 0) {
      // 取每个发言者最后一轮 + line
      var byName = {};
      allSpeeches.forEach(function(s) { byName[s.name] = s; });
      var picks = Object.values(byName);
      // 按立场极端性排序(极力支持/反对优先)
      var stanceWeight = { '极力支持':3, '极力反对':3, '支持':2, '反对':2, '另提议':2, '折中':1, '倾向支持':1, '倾向反对':1, '中立':0 };
      picks.sort(function(a,b){ return (stanceWeight[b.stance]||0) - (stanceWeight[a.stance]||0); });
      keyMoments = picks.slice(0, 6).map(function(s){
        return { name: s.name, stance: s.stance, gist: s.line.slice(0, 50) };
      });
    }
  } catch(_kmE){}

  // 收集玩家插言(朕意训示)原文
  var playerInterjects = [];
  try {
    var pi = (CY._ty2 && CY._ty2._playerInterjects) || [];
    playerInterjects = pi.slice(0, 4).map(function(p){
      return { round: p.round, text: (p.text || '').slice(0, 60) };
    });
  } catch(_piE){}

  // 收集草诏 & 用印阶段最终颁布的诏书文本(若已存)
  var draftedEdict = '';
  var sealedEdict = '';
  try {
    if (CY._ty3 && CY._ty3._draftedEdict) draftedEdict = String(CY._ty3._draftedEdict).slice(0, 200);
    if (CY._ty3 && CY._ty3._sealedEdict) sealedEdict = String(CY._ty3._sealedEdict).slice(0, 200);
    // 兜底·从 GM._edictTracker 拿最近一条廷议诏书(source='tinyi'/'tinyi2'/'ty3')
    if (!sealedEdict && Array.isArray(GM._edictTracker)) {
      var lastEd = GM._edictTracker.slice().reverse().find(function(e){
        return e && e.turn === GM.turn && /tinyi/i.test(e.source || '');
      });
      if (lastEd) sealedEdict = String(lastEd.content || lastEd.text || '').slice(0, 200);
    }
  } catch(_edE){}

  // 玩家裁决与议题原始诉求的关系判定(简易语义比对)
  // 若 sealedEdict 命中议题主关键词 → full
  // 若 sealedEdict 含议题部分关键词 → partial
  // 若 sealedEdict 仅提议题但走不同方向 → angle-shift
  // 若 decision === 'defer' → reject
  var alignment = 'full';
  try {
    if ((decision && decision.mode) === 'defer') alignment = 'reject';
    else if (sealedEdict && originalGist) {
      var topicCore = topic.replace(/[·议处之策疏弹劾恐有结党之嫌。、，·]/g, '').slice(0, 6);
      var hits = 0;
      for (var i = 0; i < topicCore.length; i++) {
        if (sealedEdict.indexOf(topicCore.charAt(i)) >= 0) hits++;
      }
      var ratio = topicCore.length > 0 ? hits / topicCore.length : 0;
      if (ratio >= 0.7) alignment = 'full';
      else if (ratio >= 0.3) alignment = 'partial';
      else alignment = 'angle-shift';
    } else if (!sealedEdict) {
      alignment = 'unsealed'; // 未到用印阶段
    }
  } catch(_alE){}

  var entry = {
    turn: GM.turn || 0,
    topic: topic,
    proposer: opts.proposer || (CY._ty3 && CY._ty3.proposer) || '',
    proposerParty: opts.proposerParty || '',
    decision: (decision && decision.mode) || 'unknown',
    archonGrade: CY._ty3_archonGrade || '',
    counts: counts,
    opposingParties: opts.opposingParties || [],
    // 新增·完整议事链路
    originalGist: originalGist,
    keyMoments: keyMoments,
    playerInterjects: playerInterjects,
    sealedEdict: sealedEdict,
    alignment: alignment,
    playerVerdictNote: (CY._ty3 && CY._ty3._playerVerdictNote) || '' // 玩家圣意补述(可选)
  };
  GM.recentChaoyi.unshift(entry);
  if (GM.recentChaoyi.length > 8) GM.recentChaoyi.length = 8;

  // 同时把完整 entry 进 GM._chronicle (国史级)·让史官记此事的全本
  try {
    if (alignment === 'angle-shift' || alignment === 'partial' || (playerInterjects && playerInterjects.length > 0)) {
      if (!Array.isArray(GM._chronicle)) GM._chronicle = [];
      GM._chronicle.push({
        turn: GM.turn || 0,
        date: GM._gameDate || (typeof getTSText === 'function' ? getTSText(GM.turn) : ''),
        category: '廷议·圣裁',
        title: topic.slice(0, 18) + '·' + (alignment === 'angle-shift' ? '换角度裁' : alignment === 'partial' ? '部分采纳' : '帝亲断'),
        content: '〔议题〕' + topic + '\n〔原议〕' + originalGist + '\n〔圣裁〕' + (sealedEdict || '(未颁明诏)') + (entry.playerVerdictNote ? '\n〔圣意〕' + entry.playerVerdictNote : ''),
        tags: ['廷议', alignment]
      });
    }
  } catch(_chE){}

  // 长期落实型廷议·挂入 ChronicleTracker·让"纪事"标签页跟踪进度·AI 推演每回合可见
  // 判定：议题文本/诏书内容含"清查/屯田/开海/变法/赈/修河/塞外/边备/科举改/盐法/茶法/钱法/榷/河漕/督师/经略/募兵/裁汰/察吏/京察/大计/封贡/和亲/筑城/营造"等长期工程关键词
  try {
    var _LONG_TERM_KW = /清查|屯田|开海|变法|赈|修河|河漕|塞外|边备|科举改|盐法|盐课|盐运|茶法|茶马|钱法|榷|督师|经略|募兵|裁汰|察吏|京察|大计|封贡|和亲|筑城|营造|开矿|铸钱|抚|平定|教化|兴学|兴修|疏浚|徭役|垦荒|安插|安抚|镇抚|征讨|经营/;
    var combined = topic + '·' + (sealedEdict || '') + '·' + (entry.playerVerdictNote || '');
    var isLongTerm = _LONG_TERM_KW.test(combined);
    var hasEdict = !!sealedEdict;
    // 留待再议(defer) 不挂跟踪·部分/完全/换角度 + 已颁诏 → 挂跟踪
    if (isLongTerm && hasEdict && alignment !== 'reject') {
      if (typeof ChronicleTracker !== 'undefined' && ChronicleTracker.upsert) {
        var trackTitle = topic.length > 24 ? topic.slice(0, 22) + '…' : topic;
        var trackId = 'tinyi_' + (GM.turn || 0) + '_' + topic.slice(0, 6).replace(/\s/g, '');
        var stakeholders = [];
        if (opts.proposer) stakeholders.push(opts.proposer);
        if (opts.proposerParty) stakeholders.push(opts.proposerParty);
        // 估计完成所需回合数(用 ChronicleTracker.estimateExpectedTurns·按剧本 daysPerTurn 自动换算)
        var subkind = '默认';
        if (/变法|科举改/.test(combined)) subkind = '变法';
        else if (/盐法|茶法|钱法/.test(combined)) subkind = '盐茶钱法';
        else if (/塞外|经略|督师/.test(combined)) subkind = '塞外经略';
        else if (/筑城|营造/.test(combined)) subkind = '筑城营造';
        else if (/河漕|修河/.test(combined)) subkind = '河漕修河';
        else if (/赈|抚|镇抚/.test(combined)) subkind = '赈抚';
        else if (/察吏|京察|大计/.test(combined)) subkind = '京察';
        else if (/清查/.test(combined)) subkind = '清查';
        var expectedTurns = (typeof ChronicleTracker !== 'undefined' && ChronicleTracker.estimateExpectedTurns)
          ? ChronicleTracker.estimateExpectedTurns({ kind: '廷议', subkind: subkind, difficulty: (alignment === 'angle-shift' || alignment === 'partial') ? 'high' : 'medium' })
          : 12;
        var _profileT = (typeof ChronicleTracker !== 'undefined' && ChronicleTracker.estimateEffectProfile)
          ? ChronicleTracker.estimateEffectProfile({ kind: '廷议', subkind: subkind })
          : null;
        ChronicleTracker.upsert({
          id: trackId,
          type: 'tingyi_pending',
          category: '廷议待落实',
          title: trackTitle,
          narrative: '〔原议〕' + (originalGist || '').slice(0, 60) + '\n〔诏书〕' + sealedEdict.slice(0, 80) + (entry.playerVerdictNote ? '\n〔圣意〕' + entry.playerVerdictNote : ''),
          actor: opts.proposer || '',
          stakeholders: stakeholders,
          startTurn: GM.turn || 1,
          expectedEndTurn: (GM.turn || 1) + expectedTurns,
          currentStage: '颁诏起手',
          progress: 5,
          priority: (alignment === 'angle-shift' || alignment === 'partial') ? 'high' : 'medium',
          sourceType: 'tinyi',
          sourceId: trackId,
          status: 'active',
          // 效果模型·短期 vs 长期张力 + 玩家可终结
          perTurnEffect: _profileT && _profileT.perTurnEffect,
          finalEffect: _profileT && _profileT.finalEffect,
          shortTermBalance: _profileT && _profileT.shortTermBalance,
          longTermBalance: _profileT && _profileT.longTermBalance,
          terminable: _profileT ? _profileT.terminable : true,
          terminationCost: _profileT && _profileT.terminationCost
        });
        if (typeof addEB === 'function') addEB('编年', '〔长期落实〕' + trackTitle + ' — 已入纪事·跟踪进度');
      }
    }
  } catch(_ctE){ try{ window.TM&&TM.errors&&TM.errors.captureSilent(_ctE,'ty3·ChronicleTrack'); }catch(_){} }
}

// 钩入 _ty3_settleArchonGrade·写 recentChaoyi
(function _ty3_installRecentChaoyiHook() {
  if (typeof window === 'undefined') return;
  var attempts = 0;
  function tryHook() {
    if (attempts++ > 40) return;
    if (typeof window._ty3_settleArchonGrade !== 'function') {
      setTimeout(tryHook, 200);
      return;
    }
    if (window._ty3_settleArchonGrade._recentHooked) return;
    var orig = window._ty3_settleArchonGrade;
    window._ty3_settleArchonGrade = function(decision, opts) {
      var info = orig.apply(this, arguments);
      try { _ty3_phase14_recordChaoyiSummary(decision, opts || {}); } catch(_){}
      return info;
    };
    window._ty3_settleArchonGrade._recentHooked = true;
  }
  tryHook();
})();

// ═══════════════════════════════════════════════════════════════════════
//  §15·推演 → 廷议(自动 spawn 议题·6 类) — 波 4
// ═══════════════════════════════════════════════════════════════════════
// 在 endTurn 'before' 阶段·扫描 GM 状态·写入 GM._pendingTinyiTopics·
// 玩家下一回合开早朝时看到这些议题

// 推演主奏者拾取·按 keyword 匹配官职/势力/党派属性·选 prestige 最高者
// criteria: { titleRegex, party, faction, fallbackTitle }
function _ty3_pickProposer(criteria) {
  if (!criteria) criteria = {};
  var pool = (GM.chars || []).filter(function(c){
    if (!c || c.alive === false || c.isPlayer) return false;
    var t = c.officialTitle || c.title || '';
    if (criteria.titleRegex && !criteria.titleRegex.test(t)) return false;
    if (criteria.party && c.party !== criteria.party) return false;
    if (criteria.faction && c.faction !== criteria.faction) return false;
    return true;
  });
  pool.sort(function(a,b){ return (b.prestige||0) - (a.prestige||0); });
  if (pool.length > 0) return pool[0];
  // 兜底：高名望者
  if (criteria.fallbackTitle) {
    var fb = (GM.chars || []).filter(function(c){
      if (!c || c.alive === false || c.isPlayer) return false;
      return new RegExp(criteria.fallbackTitle).test(c.officialTitle || c.title || '');
    });
    fb.sort(function(a,b){ return (b.prestige||0) - (a.prestige||0); });
    if (fb.length > 0) return fb[0];
  }
  return null;
}

// 给议题对象补 proposer/proposerParty/proposerTitle 字段
function _ty3_attachProposer(topicObj, ch, reason) {
  if (!topicObj || !ch) return topicObj;
  topicObj.proposer = ch.name;
  topicObj.proposerTitle = ch.officialTitle || ch.title || '';
  topicObj.proposerParty = ch.party || '';
  topicObj.proposerInfluence = (typeof _ty3_partyInfluence === 'function' && ch.party) ? _ty3_partyInfluence(ch.party) : 0;
  if (reason) topicObj.proposerReason = reason;
  return topicObj;
}

function _ty3_phase15_scanAndSpawnTopics() {
  if (!Array.isArray(GM._pendingTinyiTopics)) GM._pendingTinyiTopics = [];
  var spawned = [];

  // 1·党争激烈(partyStrife >= 70)·阁老/言官调停
  if (typeof GM.partyStrife === 'number' && GM.partyStrife >= 70) {
    if (!_ty3_alreadyHasTopic('党争议处')) {
      var topic1 = '党争激烈·议处朝堂调和之策';
      var prop1 = _ty3_pickProposer({ titleRegex: /阁|首辅|大学士|内阁|都察/, fallbackTitle: '阁|尚书' });
      var t1 = { topic: topic1, from: '推演 spawn·党争', turn: GM.turn };
      _ty3_attachProposer(t1, prop1, '调停党争·恐生大变');
      GM._pendingTinyiTopics.push(t1);
      spawned.push(topic1);
    }
  }

  // 2·党派分化(任一党 cohesion<10·将湮)·该党党魁主奏自救
  (GM.parties||[]).forEach(function(p) {
    if (!p || p.status === '湮灭') return;
    var coh = parseInt(p.cohesion,10) || 50;
    if (coh < 10 && !_ty3_alreadyHasTopic(p.name + '分化')) {
      var topic2 = p.name + '分化已极·议处去就';
      var leader2 = (typeof _ty3_getPartyLeader === 'function') ? _ty3_getPartyLeader(p.name) : null;
      var t2 = { topic: topic2, from: '推演 spawn·党派分化', turn: GM.turn, party: p.name };
      if (leader2) _ty3_attachProposer(t2, leader2, '本党人心涣散·恳请陛下主持公道');
      GM._pendingTinyiTopics.push(t2);
      spawned.push(topic2);
    }
  });

  // 3·民变(民心 <= 30)·户部/督抚奏请赈抚
  var minXin = GM.minxin && GM.minxin.value;
  if (typeof minXin === 'number' && minXin <= 30) {
    if (!_ty3_alreadyHasTopic('民变议处')) {
      var topic3 = '民心已殇·议处镇民变之策';
      var prop3 = _ty3_pickProposer({ titleRegex: /户部|抚|按察|总督/, fallbackTitle: '尚书|阁' });
      var t3 = { topic: topic3, from: '推演 spawn·民变', turn: GM.turn };
      _ty3_attachProposer(t3, prop3, '地方告急·官民相疑');
      GM._pendingTinyiTopics.push(t3);
      spawned.push(topic3);
    }
  }

  // 4·党魁死亡·继任议处·副贰主奏
  if (!Array.isArray(GM._recentDeaths)) GM._recentDeaths = [];
  (GM._recentDeaths || []).forEach(function(d) {
    if (!d || !d.name) return;
    var p = (GM.parties||[]).find(function(pp){return pp && pp.leader === d.name && pp.status !== '湮灭';});
    if (p && !_ty3_alreadyHasTopic(p.name + '继任')) {
      var topic4 = p.name + '党魁' + d.name + '殁·议处继任';
      var prop4 = _ty3_pickProposer({ party: p.name, fallbackTitle: '阁|尚书|侍郎' });
      var t4 = { topic: topic4, from: '推演 spawn·党魁继任', turn: GM.turn, party: p.name, isPersonnel: true };
      if (prop4) _ty3_attachProposer(t4, prop4, '党魁猝薨·人心未定·乞早定继统');
      GM._pendingTinyiTopics.push(t4);
      spawned.push(topic4);
    }
  });

  // 5·战事失利·兵部尚书/武将主奏
  (GM.activeWars || []).forEach(function(w) {
    if (!w) return;
    if (w.status === 'losing' && !_ty3_alreadyHasTopic((w.name || '前线') + '方略')) {
      var topic5 = (w.name || '前线') + '失利·议处方略';
      var prop5 = _ty3_pickProposer({ titleRegex: /兵部|总兵|经略|督师|提督/, fallbackTitle: '尚书|阁' });
      var t5 = { topic: topic5, from: '推演 spawn·战事', turn: GM.turn, war: w.name };
      _ty3_attachProposer(t5, prop5, '前线告急·非速决不能止溃');
      GM._pendingTinyiTopics.push(t5);
      spawned.push(topic5);
    }
  });

  // 6·财政赤字·户部尚书主奏
  var fiscal = GM.fiscal || GM.economy;
  var deficit = false;
  if (fiscal && typeof fiscal.deficitRatio === 'number' && fiscal.deficitRatio >= 0.3) deficit = true;
  if (GM.tanglian && typeof GM.tanglian.silver === 'number' && GM.tanglian.silver < 0) deficit = true;
  if (deficit && !_ty3_alreadyHasTopic('国用议处')) {
    var topic6 = '国库赤字·议处国用之策';
    var prop6 = _ty3_pickProposer({ titleRegex: /户部|度支|盐运|司农/, fallbackTitle: '尚书|阁' });
    var t6 = { topic: topic6, from: '推演 spawn·财政', turn: GM.turn };
    _ty3_attachProposer(t6, prop6, '帑廪空虚·官俸军饷皆不能继');
    GM._pendingTinyiTopics.push(t6);
    spawned.push(topic6);
  }

  // 7·朝中名望日盛者·言官弹劾结党(古代政治现实：名声大者必遭朋党之劾)
  // 由言官/政敌发起·并非当事人意愿·议题性质为弹劾
  // 同时生成完整弹劾疏 → 入奏疏堆(GM._pendingMemorials) + 议题(_pendingTinyiTopics)
  (GM.chars||[]).forEach(function(c) {
    if (!c || c.alive === false || c.isPlayer) return;
    if ((c.prestige||0) < 80) return;
    if (c._accusedClique) return;
    var partyObj = c.party ? _ty3_getPartyObj(c.party) : null;
    var coh = partyObj ? (parseInt(partyObj.cohesion,10) || 50) : 0;
    // 触发条件：名望高 + (无党 OR 当前党摇摇欲坠)·言官最易盯上
    if (!c.party || coh < 30) {
      if (!_ty3_alreadyHasTopic(c.name + '·结党')) {
        // 寻一名言官作为"奏者"·若无则御史中丞
        var accuser = '';
        var accuserCh = (GM.chars||[]).find(function(x){
          if (!x || x.alive===false || x.isPlayer) return false;
          if (x.name === c.name) return false;
          var t = x.officialTitle || x.title || '';
          return /都察院|御史|给事中|监察|掌道/.test(t);
        });
        accuser = accuserCh ? accuserCh.name : '御史台';
        var topic7 = '弹劾·' + c.name + '名望素著·恐有结党之嫌';
        // 生成弹劾疏 content
        var accuMem = _ty3_buildAccusationMemorial(accuser, accuserCh, c, topic7);
        // 入奏疏堆
        if (accuMem) {
          if (!GM._pendingMemorials) GM._pendingMemorials = [];
          GM._pendingMemorials.push(accuMem);
          if (!GM.memorials) GM.memorials = [];
          GM.memorials.push(accuMem);
        }
        // 入待议册(携带 memorialId 引用)·proposer = 弹劾发起者
        var t7 = {
          topic: topic7,
          from: '推演 spawn·言官疑党',
          turn: GM.turn,
          accused: c.name,
          accuser: accuser,
          isAccusation: true,
          accusationType: 'clique',
          memorialId: accuMem ? accuMem.id : null,
          memorialContent: accuMem ? accuMem.content : ''
        };
        if (accuserCh) _ty3_attachProposer(t7, accuserCh, '风闻其势日盛·恐生朋党之患');
        else { t7.proposer = accuser; t7.proposerTitle = '都察院'; t7.proposerReason = '风闻其势日盛·恐生朋党之患'; }
        GM._pendingTinyiTopics.push(t7);
        spawned.push(topic7);
        c._accusedClique = true;
      }
    }
  });

  // ─── 新三类 spawn 源(御案时政 / 党派短期诉求 / 推演事件) ───
  // 共同的 allocatedTo 标记机制·避免常朝抓走同样的题(常朝侧已 filter)

  // 9·御案时政·国事级议题(GM.currentIssues 中未分配的高烈度项)
  // 国事级判定：category 含 '天灾/边报/外交/变法/灾异/异象/兵革/民变/党争' 或 priority='high'
  try {
    var _NATIONAL_KW = /天灾|边报|外交|变法|灾异|异象|兵革|民变|党争|户口|科举|盐|漕|河|河患|战|寇|流贼|虏|蛮|夷/;
    var nationalIssues = (GM.currentIssues || []).filter(function(iss) {
      if (!iss || iss.status === 'resolved') return false;
      if (iss.allocatedTo) return false; // 已分配给常朝/廷议
      var cat = String(iss.category || '');
      var ttl = String(iss.title || '');
      var desc = String(iss.description || '');
      if (iss.priority === 'high' || iss.priority === 'urgent') return true;
      return _NATIONAL_KW.test(cat) || _NATIONAL_KW.test(ttl) || _NATIONAL_KW.test(desc);
    });
    nationalIssues.slice(0, 2).forEach(function(iss) {
      var key = '时政·' + (iss.title || '').slice(0, 8);
      if (_ty3_alreadyHasTopic(key.slice(2))) return;
      var topicTxt = (iss.title || '时政要议') + '·' + (iss.description || '议处之策').slice(0, 16);
      var deptStr = iss.dept || '';
      var prop9 = _ty3_pickProposer({ titleRegex: deptStr ? new RegExp(deptStr.slice(0, 2)) : /阁|尚书|侍郎/, fallbackTitle: '阁|尚书' });
      var t9 = { topic: topicTxt, from: '推演 spawn·御案时政', turn: GM.turn, issueId: iss.id };
      if (prop9) _ty3_attachProposer(t9, prop9, '臣等议此事·非廷议无以决');
      GM._pendingTinyiTopics.push(t9);
      // 标记 issue 已分配给廷议·避免常朝重复抓
      iss.allocatedTo = 'tinyi';
      iss.allocatedTurn = GM.turn;
      spawned.push(topicTxt);
    });
  } catch(_e9) { try{ window.TM&&TM.errors&&TM.errors.captureSilent(_e9,'ty3·issues spawn'); }catch(_){} }

  // 10·党派短期诉求·从 focal_disputes 推主张(党魁主奏)
  try {
    (GM.parties || []).forEach(function(p) {
      if (!p || p.status === '湮灭') return;
      var coh = parseInt(p.cohesion, 10) || 50;
      if (coh < 30) return; // 凝聚力过低·党魁无力主奏
      var leader = (typeof _ty3_getPartyLeader === 'function') ? _ty3_getPartyLeader(p.name) : null;
      if (!leader) return;
      var disputes = Array.isArray(p.focal_disputes) ? p.focal_disputes : [];
      // 选第一个未推进的争议(stake='high' 优先)
      var pick = disputes.find(function(d){ return d && d.topic && (d.stake === 'high' || d.stakes === 'high'); }) || disputes[0];
      if (!pick || !pick.topic) return;
      var disputeKey = pick.topic.slice(0, 8);
      if (_ty3_alreadyHasTopic(disputeKey)) return;
      // 限频：每党每 3 回合至多 spawn 一次 focal_dispute
      if (p._lastFocalSpawnTurn && (GM.turn - p._lastFocalSpawnTurn) < 3) return;
      var stancePrefix = (pick.stake === 'oppose' || pick.stakes === 'oppose') ? '反' : '议';
      var topicTxt10 = stancePrefix + (pick.topic.indexOf('议') === 0 ? pick.topic.slice(1) : pick.topic);
      if (pick.rival) topicTxt10 += '·与' + pick.rival + '相争';
      var t10 = {
        topic: topicTxt10,
        from: '推演 spawn·' + p.name + '·短期诉求',
        turn: GM.turn,
        party: p.name
      };
      _ty3_attachProposer(t10, leader, p.name + '本党之争·愿陛下察之');
      GM._pendingTinyiTopics.push(t10);
      p._lastFocalSpawnTurn = GM.turn;
      spawned.push(topicTxt10);
    });
  } catch(_e10) { try{ window.TM&&TM.errors&&TM.errors.captureSilent(_e10,'ty3·focal spawn'); }catch(_){} }

  // 11·推演事件·近回合 evtLog 中国事级未议处项
  try {
    var _EVT_BIG = /天灾|地震|大水|大旱|蝗|疫|瘟|彗|地方告急|边报|入寇|失陷|城陷|大败|入境|奏捷|变法|蛮|夷|外使|来朝|岁币|册封|流贼|民变/;
    var recentEvts = (GM.evtLog || []).slice(-15).filter(function(e) {
      if (!e || e._tinyiSpawned) return false;
      var hay = (e.cat || '') + '·' + (e.title || '') + '·' + (e.text || '');
      return _EVT_BIG.test(hay);
    });
    recentEvts.slice(0, 1).forEach(function(e) {
      var key11 = (e.title || e.cat || '').slice(0, 6);
      if (!key11) return;
      if (_ty3_alreadyHasTopic(key11)) return;
      var topicTxt11 = '议处' + (e.title || e.cat || '近事');
      var prop11 = _ty3_pickProposer({ titleRegex: /阁|尚书|侍郎|都御史/, fallbackTitle: '阁|尚书' });
      var t11 = { topic: topicTxt11, from: '推演 spawn·近事议处', turn: GM.turn };
      if (prop11) _ty3_attachProposer(t11, prop11, '近事大变·非廷议无以决');
      GM._pendingTinyiTopics.push(t11);
      e._tinyiSpawned = true; // 标记此事件已推到廷议
      spawned.push(topicTxt11);
    });
  } catch(_e11) { try{ window.TM&&TM.errors&&TM.errors.captureSilent(_e11,'ty3·evt spawn'); }catch(_){} }

  // 8·NPC 例行献策(每 2 回合·若待议册空·随机抽一名高名望 NPC 主动提议)
  // 让玩家始终能看到"有人主动提议"·而非只在剧烈情境下才有议题
  if ((GM.turn || 0) % 2 === 0 && GM._pendingTinyiTopics.length === 0) {
    try {
      var routineCandidates = (GM.chars || []).filter(function(c) {
        if (!c || c.alive === false || c.isPlayer) return false;
        if ((c.prestige || 0) < 60) return false;
        var t = c.officialTitle || c.title || '';
        return /阁|尚书|侍郎|都御史|总督|巡抚|总兵|经略|学士|给事中/.test(t);
      });
      routineCandidates.sort(function(a,b){ return (b.prestige||0) - (a.prestige||0); });
      var picked = routineCandidates[Math.floor(Math.random() * Math.min(routineCandidates.length, 5))];
      if (picked) {
        var titleStr = picked.officialTitle || picked.title || '';
        var routineTopic = '';
        var routineReason = '';
        if (/兵部|总兵|经略|总督|提督/.test(titleStr)) {
          routineTopic = '议九边粮饷·恐冬关将士寒馁';
          routineReason = '边备空虚·非急筹不能保关防';
        } else if (/户部|度支|司农|盐运/.test(titleStr)) {
          routineTopic = '议盐铁榷税·补帑廪空虚';
          routineReason = '帑廪日竭·新岁恐难支用';
        } else if (/吏部|考功|铨叙/.test(titleStr)) {
          routineTopic = '议京察大计·黜陟天下守令';
          routineReason = '吏治日弛·非整饬不可挽颓';
        } else if (/礼部|翰林|国子|学士/.test(titleStr)) {
          routineTopic = '议科举三场·正士子之趋向';
          routineReason = '士风颓靡·当以经术振之';
        } else if (/刑部|大理|都察|按察|监察/.test(titleStr)) {
          routineTopic = '议清狱讼·宽天下冤滞';
          routineReason = '刑狱积久·民有不平之鸣';
        } else if (/工部|河漕|盐运/.test(titleStr)) {
          routineTopic = '议黄河漕运·治水利民';
          routineReason = '河患日深·漕运几为之断';
        } else {
          // 阁臣·谏言宏观
          var bigPicks = ['议屯田实边·养兵息民', '议诏贤良·咨方略于野', '议节宫廷用度·示天下之俭', '议巡按州郡·察民疾苦'];
          routineTopic = bigPicks[Math.floor(Math.random() * bigPicks.length)];
          routineReason = '臣感时事日变·愿为陛下陈一得之愚';
        }
        if (!_ty3_alreadyHasTopic(routineTopic.slice(0, 6))) {
          var t8 = { topic: routineTopic, from: '推演 spawn·' + (titleStr || '阁臣') + '献策', turn: GM.turn };
          _ty3_attachProposer(t8, picked, routineReason);
          GM._pendingTinyiTopics.push(t8);
          spawned.push(routineTopic);
          // 给玩家明显反馈
          if (typeof addEB === 'function') addEB('推演', picked.name + '(' + (titleStr || '') + ') 上疏请下廷议：' + routineTopic.slice(0, 18));
        }
      }
    } catch(_e8) { try{ window.TM&&TM.errors&&TM.errors.captureSilent(_e8,'ty3·routine spawn'); }catch(_){} }
  }

  if (spawned.length > 0) {
    if (typeof addEB === 'function') addEB('推演', '推演自动议程：' + spawned.length + ' 项·' + spawned.slice(0,2).map(function(t){return t.slice(0,12);}).join('；'));
  }
  return spawned;
}

function _ty3_alreadyHasTopic(keyword) {
  return (GM._pendingTinyiTopics || []).some(function(t) {
    var text = (typeof t === 'string') ? t : (t.topic || '');
    return text.indexOf(keyword) >= 0;
  });
}

// 推演生成弹劾结党疏(模板·非 AI)·后续玩家批阅时若需润色再调 AI
// 生成的奏疏含完整文体·进 GM._pendingMemorials 让玩家在奏疏堆见到
function _ty3_buildAccusationMemorial(accuserName, accuserCh, accusedCh, topic) {
  if (!accusedCh || !accusedCh.name) return null;
  var accusedTitle = accusedCh.officialTitle || accusedCh.title || '';
  var accuserTitle = (accuserCh && (accuserCh.officialTitle || accuserCh.title)) || '都察院';
  var prestige = accusedCh.prestige || 80;
  var party = accusedCh.party || '无党';
  // 罪状条目·按被劾者属性生成 3-5 条
  var charges = [];
  if (prestige >= 85) charges.push('名望素著·门生故旧遍朝中·进退相约');
  charges.push('与同乡同年私第宴聚·品评朝政·相为唇齿');
  if (accusedCh.ambition && accusedCh.ambition >= 70) charges.push('议论朝局动辄称"天下士"·自任清流之名');
  if ((accusedCh.favor || 0) >= 70) charges.push('蒙圣眷渥·然不思孤臣自处·反聚同心');
  if (party && party !== '无党') charges.push('挂' + party + '之名·然实自结一党·进者必其门人·退者必其异己');
  else charges.push('虽未挂党名·然结纳之状·士大夫间已有「' + accusedCh.name + '一系」之议');
  // 弹劾疏全文
  var content = '';
  content += '臣' + (accuserCh ? accuserCh.name : '某') + '诚惶诚恐、稽首顿首，谨上疏曰：\n';
  content += '伏察' + accusedTitle + accusedCh.name + '者，';
  content += '本以才德进身、清议所归，然臣窃观其行有不可不察者数端：\n';
  charges.forEach(function(ch, i) {
    var idx = ['一','二','三','四','五'][i] || (i+1);
    content += '其' + idx + '·' + ch + '；\n';
  });
  content += '\n臣闻昔朱熹有言：「君子之交淡如水，结党营私者，败国亡家之始也。」\n';
  content += '本朝立国之初，太祖高皇帝深察前代党锢、牛李之祸，故设《禁党律》以警臣工。\n';
  content += '今' + accusedCh.name + '名望日盛而结纳日深，其党羽暗结于私第，其声气共鸣于馆阁；\n';
  content += '陛下若不察，恐其势日大、其根日固，他日必为社稷之忧，重蹈唐宋党争之覆辙。\n';
  content += '\n伏望陛下俯准臣议：\n';
  content += '一·下三法司勘验所参各端，验其实虚；\n';
  content += '二·暂罢' + accusedCh.name + '京职，或调外任，以观后效；\n';
  content += '三·凡其门生故旧聚会之私第，命厂卫察访以儆效尤。\n';
  content += '\n臣职在风宪、责在弹纠，不敢以私谊废公义，谨具本密揭，伏候圣鉴。\n';
  content += '臣' + (accuserCh ? accuserCh.name : '某') + '诚惶诚恐、激切屏营之至。';

  var mem = {
    id: 'accu_' + (typeof uid === 'function' ? uid() : Date.now()) + '_' + Math.random().toString(36).slice(2,6),
    from: accuserName,
    title: accuserTitle,
    type: '人事',
    subtype: '密揭',
    content: content,
    status: 'drafted',
    turn: GM.turn,
    reply: '',
    reliability: 'medium',
    bias: 'factional',
    priority: 'urgent',
    isAccusation: true,
    accusationType: 'clique',
    accused: accusedCh.name,
    accuser: accuserName,
    _ty3Generated: true
  };
  return mem;
}

// ═══════════════════════════════════════════════════════════════════════
//  §16·EndTurn 接入(注册 before/after 钩子) — 波 4
// ═══════════════════════════════════════════════════════════════════════

// 长期工程进度推进 tick·按 expectedEndTurn 线性算·配合阶段切换
// 同时处理廷议(sourceType='tinyi')和常朝(sourceType='changchao')来源
// 真实大幅进度 / 失败 / 成功 由 AI 推演输出 chronicleTrack 字段调整(if any)
// 此处只做"自然推进"——避免长期工程在 AI 不主动 update 时静止
function _ty3_tickChronicleTracks() {
  if (typeof ChronicleTracker === 'undefined') return;
  if (!Array.isArray(GM._chronicleTracks)) return;
  GM._chronicleTracks.forEach(function(t) {
    if (!t || t.status !== 'active') return;
    // 廷议+常朝来源都 tick·其它(科举/edict/scheme/project)由各自系统 tick
    if (t.sourceType !== 'tinyi' && t.sourceType !== 'changchao') return;

    // ★ 每回合应用 perTurnEffect (短期当下持续作用·非到点触发)
    try {
      if (typeof ChronicleTracker.applyPerTurnEffect === 'function') {
        var perTurnNarr = ChronicleTracker.applyPerTurnEffect(t);
        if (perTurnNarr && typeof addEB === 'function') {
          // 每回合 narrative 不直接进事件 bar(避免刷屏)·而是写入 GM._chronicleTickNarratives 供 AI 推演 prompt 引用
          if (!Array.isArray(GM._chronicleTickNarratives)) GM._chronicleTickNarratives = [];
          GM._chronicleTickNarratives.push({
            turn: GM.turn,
            trackId: t.id,
            title: t.title,
            short: t.shortTermBalance,
            long: t.longTermBalance,
            narrative: perTurnNarr
          });
          // 限长 30 条·避免无限累积
          if (GM._chronicleTickNarratives.length > 30) GM._chronicleTickNarratives = GM._chronicleTickNarratives.slice(-30);
        }
      }
    } catch(_pteE){}

    var startTurn = t.startTurn || GM.turn;
    var expectedEnd = t.expectedEndTurn || (startTurn + 12);
    var totalTurns = Math.max(1, expectedEnd - startTurn);
    var elapsed = (GM.turn || startTurn) - startTurn;
    var naturalProgress = Math.min(99, Math.round(elapsed / totalTurns * 90) + 5);
    // 仅当自然进度 > 当前进度时才推进(避免 AI 已设更高时退步)
    if (naturalProgress > (t.progress || 0)) {
      var newStage = t.currentStage;
      // 阶段切换·按进度阶梯
      if (naturalProgress >= 80 && t.currentStage !== '验收待复' && t.currentStage !== '完结') newStage = '验收待复';
      else if (naturalProgress >= 50 && t.currentStage === '执行中') newStage = '推行已半';
      else if (naturalProgress >= 20 && t.currentStage === '颁诏起手') newStage = '执行中';
      ChronicleTracker.update(t.id, {
        progress: naturalProgress,
        currentStage: newStage,
        stageNote: newStage !== t.currentStage ? '回合 ' + GM.turn + '·自然推进' : ''
      });
      // ★ 进度到 100% (实际 99% 触发·避免恰好 cap)·应用 finalEffect 并 complete
      if (naturalProgress >= 99 && t.progress < 100) {
        try {
          ChronicleTracker.complete(t.id, '功成');
        } catch(_compE){}
      }
      // 进度满 95%·提示玩家可议验收·spawn 复核议题进待议册
      if (naturalProgress >= 95 && !t._verifyPrompted) {
        t._verifyPrompted = true;
        var srcLbl = t.sourceType === 'changchao' ? '常朝事' : '廷议事';
        if (typeof addEB === 'function') addEB('编年', '〔可议验收〕' + srcLbl + '「' + (t.title || '').slice(0, 14) + '」推行将竣·宜召廷议复核');
        if (Array.isArray(GM._pendingTinyiTopics) && !_ty3_alreadyHasTopic((t.title||'').slice(0, 6) + '·复')) {
          GM._pendingTinyiTopics.push({
            topic: '议复·' + (t.title || '前案') + '·历' + elapsed + '回合·将竣·验收议处',
            from: '编年自动·' + srcLbl + '将竣',
            turn: GM.turn,
            trackId: t.id
          });
        }
      }
    }
  });
}

(function _ty3_installEndTurnHooks() {
  if (typeof window === 'undefined') return;
  var attempts = 0;
  function tryRegister() {
    if (attempts++ > 30) return;
    if (typeof window.EndTurnHooks === 'undefined' || typeof window.EndTurnHooks.register !== 'function') {
      setTimeout(tryRegister, 200);
      return;
    }
    if (window._ty3_endTurnHooksRegistered) return;
    // before·扫描 spawn 议题 + 追责回响(放 before·让 AI 推演读得到)
    EndTurnHooks.register('before', function() {
      try { _ty3_phase15_scanAndSpawnTopics(); } catch(e){ try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-tinyi-v3·spawn');}catch(_){} }
      try { _ty3_phase7_runReview(); } catch(e){ try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-tinyi-v3·review');}catch(_){} }
    }, 'ty3·before-prep');
    // after·党派演化 + 威权阶梯 + 廷议长期工程进度推进
    EndTurnHooks.register('after', function() {
      try { _ty3_partyEvolutionTick(); } catch(e){ try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-tinyi-v3·evolution');}catch(_){} }
      try { _ty3_tickRegaliaStreaks(); } catch(e){ try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-tinyi-v3·streaks');}catch(_){} }
      try { _ty3_tickChronicleTracks(); } catch(e){ try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-tinyi-v3·tracks');}catch(_){} }
      // 清理 prompt 队列(AI 已读完)
      GM._ty3_pendingReviewForPrompt = [];
    }, 'ty3·after-evolution');
    window._ty3_endTurnHooksRegistered = true;
  }
  tryRegister();
})();

// 暴露波 4 API(取消独立 review modal·改入史记弹窗)
if (typeof window !== 'undefined') {
  window._ty3_phase7_runReview = _ty3_phase7_runReview;
  window._ty3_phase14_recordChaoyiSummary = _ty3_phase14_recordChaoyiSummary;
  window._ty3_phase15_scanAndSpawnTopics = _ty3_phase15_scanAndSpawnTopics;
}
