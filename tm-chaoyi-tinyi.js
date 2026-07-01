// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// Module: tm-chaoyi-tinyi.js — 廷议 v2·集议大政·一议多轮·辩难立场·共识或独断
// Domain: 朝议·廷议
// Status: active · Last Updated: 2026-05-03 (Phase 3·从 tm-chaoyi-v2.js L102-874 抽出)
// Owner: TM 团队
// Imports: tm-utils.js·tm-index-world.js·tm-chaoyi.js (addCYBubble)·tm-mz (_mzShowSummary)
// Exports: _ty2_openSetup·_ty2_pickPending·_ty2_render·_ty2_makeDiv·_ty2_offerDebatePhase·_ty2_enterDecide·_ty2_countStances·_ty2_groupByStance·_ty2_finalEnd·_cy_suggestBtnHtml·_ty2_globalFooter
// Used by: tm-chaoyi.js (_cy_pickMode 调 _ty2_openSetup)
// Side effects: DOM (ty2-setup-bg)·CY 状态
// Test: web/scripts/smoke-tinyi-fix.js·smoke-tinyi-impeachment.js
// Notes: Phase 3 (2026-05-03) 5→4 文件·从 v2 抽·_cy_suggestBtnHtml 廷议+御前共用·随 tinyi.js 走
// 姊妹·tm-chaoyi.js·tm-chaoyi-changchao.js·tm-chaoyi-yuqian.js
// ============================================================

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
    html += '<label style="font-size:0.71rem;padding:2px 5px;background:rgba(184,154,83,0.1);border-radius:2px;cursor:pointer;">'
      + '<input type="checkbox" class="ty2-attendee" value="' + escHtml(c.name) + '" checked> ' + escHtml(c.name);
    if (c.officialTitle || c.title) html += '<span style="color:var(--ink-300);font-size:0.66rem;"> ' + escHtml(c.officialTitle||c.title) + '</span>';
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
      html += '<label style="font-size:0.7rem;padding:2px 5px;background:rgba(107,93,79,0.1);border-radius:2px;cursor:pointer;">'
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
  // 2026-06 faithful landing·重排为左立绘 + 右立场板版式（对齐预览）
  try { _ty2_relayout(); } catch(_tyLayoutErr) { try { window.TM && TM.errors && TM.errors.captureSilent(_tyLayoutErr, 'tinyi-relayout'); } catch(_) {} }
  // 进入初议
  _ty2_phaseInitialRound();
}

/** 渲染立场板（七档光谱·真立绘缩略·立场迁移↗↘·魂）—— 2026-06 faithful landing 对齐 preview/tingyi-preview.html */
function _ty2_render() {
  var body = _$('cy-body');
  // 清除旧立场板
  var old = document.getElementById('ty2-stance-board');
  if (old) old.remove();
  if (!CY._ty2) return;
  var stances = CY._ty2.stances || {};
  // 七档光谱（青·灰·朱）
  var cols = [
    { key:'极力支持', zone:'sup' }, { key:'支持', zone:'sup' }, { key:'倾向支持', zone:'sup' },
    { key:'中立', zone:'neu' },
    { key:'倾向反对', zone:'opp' }, { key:'反对', zone:'opp' }, { key:'极力反对', zone:'opp' }
  ];
  var order = { '极力支持':0,'支持':1,'倾向支持':2,'中立':3,'待定':3,'倾向反对':4,'反对':5,'极力反对':6 };
  var counts = _ty2_countStances();   // {support, oppose, neutral, mediate}
  // 立场迁移：本人 initial→current 跨档位（↗趋支持 / ↘趋反对）
  function _mv(n) {
    var st = stances[n] || {};
    var ci = order[st.current], ii = order[st.initial];
    if (st.initial && st.initial !== '待定' && typeof ci === 'number' && typeof ii === 'number' && ci !== ii) {
      return ci < ii ? 'up' : 'down';
    }
    return '';
  }
  function _chip(n, zone) {
    var ch = (typeof findCharByName === 'function' ? findCharByName(n) : null) || {};
    var mv = _mv(n);
    var mvHtml = mv ? '<span class="ty-mv ' + mv + '">' + (mv === 'up' ? '↗' : '↘') + '</span>' : '';
    var pic = ch.portrait
      ? '<img src="' + escHtml(ch.portrait) + '" loading="lazy" onerror="this.style.display=\'none\'">'
      : '<span class="ty-sf-ph">' + escHtml(String(n).charAt(0)) + '</span>';
    return '<div class="ty-schip z-' + zone + (mv ? ' moved' : '') + '" data-name="' + escHtml(n) + '" '
      + 'onclick="_ty2_setSpeaker(\'' + escHtml(n).replace(/'/g, "\\'") + '\')">'
      + mvHtml + '<div class="ty-sf">' + pic + '</div><div class="ty-sn">' + escHtml(n) + '</div></div>';
  }
  // 按 current 立场归档（待定并入中立列）
  var byStance = {};
  (CY._ty2.attendees || []).forEach(function(n) {
    var s = (stances[n] || {}).current || '待定';
    if (s === '待定') s = '中立';
    (byStance[s] = byStance[s] || []).push(n);
  });
  var html = '<div id="ty2-stance-board" class="ty-board">';
  html += '<div class="ty-board-h"><span class="ty-bt">〔 立 场 板 〕</span>'
    + '<span class="ty-rd">第 ' + (CY._ty2.roundNum||0) + ' 轮 · ' + (CY._ty2.attendees||[]).length + ' 员与议</span>'
    + '<span class="ty-tally"><span class="sup">支持 ' + counts.support + '</span><span class="neu">中立 ' + counts.neutral + '</span>'
    + '<span class="opp">反对 ' + counts.oppose + '</span>' + (counts.mediate ? '<span class="med">折中 ' + counts.mediate + '</span>' : '') + '</span></div>';
  html += '<div class="ty-spectrum">';
  cols.forEach(function(c) {
    var chips = (byStance[c.key] || []).map(function(n) { return _chip(n, c.zone); }).join('');
    html += '<div class="ty-spec-col z-' + c.zone + '"><div class="ty-cl">' + c.key + '</div><div class="ty-spec-chips">' + chips + '</div></div>';
  });
  html += '</div>';
  // 折中 / 另提议（侧栏）
  var med = byStance['折中'] || [], alt = byStance['另提议'] || [];
  if (med.length || alt.length) {
    html += '<div class="ty-aux-row">';
    if (med.length) html += '<div class="ty-aux-col med"><span class="ty-al">折中</span><div class="ty-achips">' + med.map(function(n){return _chip(n,'med');}).join('') + '</div></div>';
    if (alt.length) html += '<div class="ty-aux-col alt"><span class="ty-al">另提议</span><div class="ty-achips">' + alt.map(function(n){return _chip(n,'alt');}).join('') + '</div></div>';
    html += '</div>';
  }
  html += '</div>';
  if (body && body.firstChild) body.insertBefore(_ty2_makeDiv(html), body.firstChild);
  else if (body) body.innerHTML = html + body.innerHTML;
}

function _ty2_makeDiv(html) { var d = document.createElement('div'); d.innerHTML = html; return d.firstElementChild || d; }

// 2026-06 faithful landing·廷议版式重排（左陈词者立绘 + 右立场板/辩论/裁决·对齐 preview/tingyi-preview.html）
// 渲染后 DOM 重排（保留全部 id/onclick/handler·只搬位置）+ scoped CSS（styles.css #chaoyi-modal.cy-mode-tinyi）
function _ty2_relayout() {
  var modal = document.getElementById('chaoyi-modal');
  if (!modal) return;
  modal.classList.add('cy-mode-tinyi');
  if (document.getElementById('ty-actor')) return;   // 已重排过
  var frame = modal.firstElementChild;
  var body = document.getElementById('cy-body');
  if (!frame || !body) return;
  var topic = document.getElementById('cy-topic');
  var inputRow = document.getElementById('cy-input-row');
  var footer = document.getElementById('cy-footer');
  var header = frame.firstElementChild;   // 顶栏（cy-mode-label + cy-round-tag + 退朝）
  // 左·当前陈词者立绘
  var actor = document.createElement('div'); actor.id = 'ty-actor'; actor.className = 'ty-actor';
  actor.innerHTML = '<div class="ty-actor-stage"><img class="ty-portrait" id="ty-portrait" alt="" style="display:none">'
    + '<div class="ty-actor-vig"></div><div class="ty-actor-frame"></div>'
    + '<span class="ty-actor-tag" id="ty-actor-tag">待陈词</span></div>'
    + '<div class="ty-actor-plate"><div><span class="ty-actor-nm" id="ty-actor-nm">廷议</span>'
    + '<span class="ty-stance-pill" id="ty-actor-pill"></span></div>'
    + '<div class="ty-actor-sub" id="ty-actor-sub">精英集议 · 三品以上 · 一议多轮辩难</div>'
    + '<div class="ty-acts">'
    +   '<button class="ty-bt key" onclick="if(typeof _ty2_enterDecide===\'function\')_ty2_enterDecide()">进入裁决 ▾</button>'
    +   '<button class="ty-bt" onclick="if(typeof _ty2_startDebate===\'function\')_ty2_startDebate()">展开辩论</button>'
    +   '<button class="ty-bt" onclick="if(typeof _ty2_offerMediation===\'function\')_ty2_offerMediation()">召折中</button>'
    +   '<button class="ty-bt" onclick="var i=document.getElementById(\'cy-player-input\');if(i)i.focus()">指名诘问</button>'
    +   '<button class="ty-bt" onclick="var i=document.getElementById(\'cy-player-input\');if(i)i.focus()">插言</button>'
    + '</div></div>';
  // 右·主体（议题 + 立场板/辩论流body + 输入 + 裁决footer 全部移入）
  var main = document.createElement('div'); main.className = 'ty-main';
  var row = document.createElement('div'); row.className = 'ty-row';
  [topic, body, inputRow, footer].forEach(function(el) { if (el) main.appendChild(el); });
  row.appendChild(actor); row.appendChild(main);
  if (header && header.nextSibling) frame.insertBefore(row, header.nextSibling);
  else frame.appendChild(row);
  // 顶栏：议印 + 廷议 + 议题 + 类型 chip（内联一行·对齐预览）
  var ttypeLbl = { war:'⚔️ 战和',succession:'👑 立储',reform:'📜 变法',judgment:'⚖️ 重案',finance:'💰 财赋',relief:'🌾 灾赈',appointment:'👔 廷推',other:'❓ 其他' }[CY._ty2 && CY._ty2.topicType] || '';
  var label = document.getElementById('cy-mode-label');
  if (label) label.innerHTML = '<span class="ty-seal">议</span><span class="ty-htitle">廷议</span>'
    + '<span class="ty-dlg-topic"><span class="ty-topic-lab">议题</span> · <b>' + escHtml((CY._ty2 && CY._ty2.topic) || '') + '</b></span>'
    + (ttypeLbl ? '<span class="ty-ttype">' + ttypeLbl + '</span>' : '');
  // 轮次入右侧（退朝按钮左）
  var rtag = document.getElementById('cy-round-tag');
  if (rtag) { rtag.style.display = 'inline-block'; rtag.className = 'ty-round-tag'; rtag.innerHTML = '第 <b>' + ((CY._ty2 && CY._ty2.roundNum) || 1) + '</b> 轮 · 辩论'; }
  // 独立议题行隐藏（已内联顶栏）
  if (topic) topic.style.display = 'none';
}

// 当前陈词者立绘随发言切换（谁陈词则谁立绘 + 立场板 chip 高亮）
function _ty2_setSpeaker(name) {
  if (!name || !CY._ty2) return;
  var ch = (typeof findCharByName === 'function' ? findCharByName(name) : null) || {};
  var st = (CY._ty2.stances && CY._ty2.stances[name]) || {};
  var stance = st.current || '待定';
  var img = document.getElementById('ty-portrait');
  if (img) {
    if (ch.portrait) { img.src = ch.portrait; img.style.display = ''; }
    else { img.removeAttribute('src'); img.style.display = 'none'; }
    img.alt = name;
  }
  var tag = document.getElementById('ty-actor-tag'); if (tag) tag.textContent = '当前陈词 · ' + name;
  var nm = document.getElementById('ty-actor-nm'); if (nm) nm.textContent = name;
  var sub = document.getElementById('ty-actor-sub');
  if (sub) sub.textContent = (ch.officialTitle || ch.title || '与议') + (ch.party ? ' · ' + ch.party : '');
  var pill = document.getElementById('ty-actor-pill');
  if (pill) {
    var z = /支持/.test(stance) ? 'high' : /反对/.test(stance) ? 'opp' : (stance === '折中' ? 'med' : 'neu');
    pill.textContent = stance; pill.className = 'ty-stance-pill ' + z;
  }
  Array.prototype.forEach.call(document.querySelectorAll('#chaoyi-modal .ty-schip'), function(el) {
    el.classList.toggle('speaking', el.getAttribute('data-name') === name);
  });
}

// 给辩论气泡标注立场（彩色左边框 data-stance + name 行立场标签·对齐预览 fb sup/opp/med）
function _ty2_tagBubbleStance(div, stance) {
  if (!div || !stance) return;
  var zone = /支持/.test(stance) ? 'sup' : /反对/.test(stance) ? 'opp' : (stance === '折中' ? 'med' : stance === '另提议' ? 'alt' : 'neu');
  try {
    div.setAttribute('data-stance', zone);
    var nmDiv = div.querySelector('div:last-child > div:first-child');
    if (nmDiv && !nmDiv.querySelector('.ty-fb-sp')) {
      var sp = document.createElement('span');
      sp.className = 'ty-fb-sp ' + zone;
      sp.textContent = stance;
      nmDiv.appendChild(sp);
    }
  } catch (_e) {}
}
if (typeof window !== 'undefined') { window._ty2_setSpeaker = _ty2_setSpeaker; window._ty2_relayout = _ty2_relayout; window._ty2_tagBubbleStance = _ty2_tagBubbleStance; }

/** 阶段：初议 + 补议（每位与议者按品级依次陈述，默认 2 轮，玩家可插言/打断） */
// 朝堂博弈 S2·从与议者里挑立场对立的核心代表(支持2+反对2+中立1)·让第2轮深辩集中·控延迟
function _ty2_pickCoreDebaters(attendees, stances, maxN) {
  var groups = { support: [], oppose: [], neutral: [] };
  (attendees || []).forEach(function(nm) {
    var st = stances && stances[nm];
    var s = (st && st.current) || '';
    var conf = (st && typeof st.confidence === 'number') ? st.confidence : 50;
    var camp = /支持/.test(s) ? 'support' : /反对/.test(s) ? 'oppose' : 'neutral';
    groups[camp].push({ nm: nm, conf: conf });
  });
  var core = [];
  [['support', 2], ['oppose', 2], ['neutral', 1]].forEach(function(pair) {
    groups[pair[0]].sort(function(a, b) { return b.conf - a.conf; });
    groups[pair[0]].slice(0, pair[1]).forEach(function(x) { core.push(x.nm); });
  });
  // 立场一边倒(对立不足)时补全·至少 3 人交锋
  if (core.length < 3) {
    (attendees || []).forEach(function(nm) { if (core.indexOf(nm) < 0 && core.length < 3) core.push(nm); });
  }
  return core.slice(0, maxN || 5);
}

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
    // 朝堂博弈 S2·核心参与者收敛：第2轮起·开关开时只让立场对立的核心代表深辩(控延迟+集中交锋)·关时全员(现状)
    var _roundList = ((typeof agentFlagOn==='function' ? agentFlagOn('courtDebateEnabled') : (P.conf && P.conf.courtDebateEnabled)) && _rd >= 2 && Array.isArray(CY._ty2._coreDebaters) && CY._ty2._coreDebaters.length)
      ? CY._ty2._coreDebaters : CY._ty2.attendees;
    if (_rd === 2) addCYBubble('内侍', (_roundList !== CY._ty2.attendees ? '（党争核心者再议·诸卿据他官之言交锋。）' : '（再议一轮，诸卿可据他官之言修订立场。）'), true);
    for (var i = 0; i < _roundList.length; i++) {
      if (CY._abortChaoyi) { CY._abortChaoyi=false; break; }
      // 玩家中途插言
      if (CY._pendingPlayerLine) {
        var _pl = CY._pendingPlayerLine; CY._pendingPlayerLine = null;
        addCYBubble('皇帝', _pl, false);
        _cy_jishiAdd('tinyi', CY._ty2.topic, '皇帝', _pl, { round: _rd, playerInterject: true });
        CY._ty2._playerInterjects.push({ round: _rd, text: _pl });
        try { await _ty2_playerTriggeredResponse(_pl); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-chaoyi-keju');}catch(_){}}
      }
      var nm = _roundList[i];
      var res = await _ty2_genOneSpeech(nm, _rd, _prevSpeeches);
      if (res) {
        // v2.6 Slice 7·confront mode auto trigger·若 NPC reason 含 "点名 X"·启 chain
        try {
          if (res.line && typeof _ty3_startConfrontChain === 'function' && !(CY._ty3 && CY._ty3._confrontChain && CY._ty3._confrontChain.active)) {
            // 简单 heuristic·若 line 含 "X 公此论" / "X 公方才" / "敢请 X 公" 等 confront 模板 opens·启 chain
            var confrontMatch = res.line.match(/([一-龥]{2,4})\s*公\s*(此论|方才|此说|此言|此议|论)/);
            if (confrontMatch) {
              var targetName = confrontMatch[1];
              if (CY._ty2.attendees.indexOf(targetName) >= 0 && targetName !== nm) {
                _ty3_startConfrontChain(nm, targetName, { maxRound: 2, triggeredBy: 'auto-line-match' });
              }
            }
          }
        } catch (_confrontE) {}
        // v2.6 polish·Round 4·affinity 双向累加·rebut -3 / second +3 / soften +1 (跟常朝 paradigm 对齐)
        try {
          if (typeof _ty3_addAffinity === 'function' && _prevSpeeches.length > 0) {
            var _prev = _prevSpeeches[_prevSpeeches.length - 1];
            if (_prev && _prev.name && _prev.name !== nm) {
              var _myS = res.stance || '';
              var _otherS = _prev.stance || '';
              var _bothSupport = /支持/.test(_myS) && /支持/.test(_otherS);
              var _bothOppose = /反对/.test(_myS) && /反对/.test(_otherS);
              var _sameDir = _bothSupport || _bothOppose;
              var _oppDir = (/支持/.test(_myS) && /反对/.test(_otherS)) || (/反对/.test(_myS) && /支持/.test(_otherS));
              if (_sameDir) _ty3_addAffinity(nm, _prev.name, +3);     // second·同附议
              else if (_oppDir) _ty3_addAffinity(nm, _prev.name, -3); // rebut·相左
              // soften·中立 + 弱反·+1 (softening 缓和)
              else if (/中立/.test(_myS) && (/反对/.test(_otherS) || /支持/.test(_otherS))) _ty3_addAffinity(nm, _prev.name, +1);
            }
          }
        } catch (_affE) {}
        _prevSpeeches.push({ name: nm, stance: res.stance, line: res.line });
        // 镜像收集到 CY._ty2._allSpeeches·后续 phase14 取用
        CY._ty2._allSpeeches.push({ round: _rd, name: nm, stance: res.stance, line: (res.line || '').slice(0, 80) });
        // 朝堂博弈 S3·辩论轨迹可观测：消费 S1 的 respondTo / stanceShiftReason（开关控制·关时 S1 不输出这俩字段·自然跳过）
        if ((typeof agentFlagOn==='function' ? agentFlagOn('courtDebateEnabled') : (P.conf && P.conf.courtDebateEnabled)) && res) {
          var _lastSp = CY._ty2._allSpeeches[CY._ty2._allSpeeches.length - 1];
          if (res.respondTo && String(res.respondTo).trim()) _lastSp.respondTo = String(res.respondTo).slice(0, 20);
          if (res.stanceShiftReason && String(res.stanceShiftReason).trim()) {
            _lastSp.stanceShiftReason = String(res.stanceShiftReason).slice(0, 80);
            if (!Array.isArray(CY._ty2.stanceHistory)) CY._ty2.stanceHistory = [];
            CY._ty2.stanceHistory.push({ round: _rd, name: nm, to: res.stance, reason: String(res.stanceShiftReason).slice(0, 80), source: 'self-reported' });
            addCYBubble('内侍', '（' + nm + ' 闻同僚之论·立场有动：' + String(res.stanceShiftReason).slice(0, 40) + '）', true);
          }
        }
        var _stEntry = CY._ty2.stances[nm] || (CY._ty2.stances[nm] = {});
        // v2.6 Slice 3·hybrid stance·initial 锁 (dims-initial 时不 overwrite)·current 可变
        var _hybridLocked = _stEntry.source === 'dims-initial';
        if (_rd === 1 && res.stance && !_hybridLocked) _stEntry.initial = res.stance;  // v2 paradigm·LLM 锚 initial
        if (res.stance) _stEntry.current = res.stance;
        if (res.confidence != null) _stEntry.confidence = res.confidence;
        // v2.6 history audit (hybrid 时·若 current != initial·必含 reason)
        _stEntry.history = _stEntry.history || [];
        _stEntry.history.push({ round: _rd, stance: res.stance, reason: res.reason || '', t: Date.now() });
        if (_hybridLocked && res.stance && res.stance !== _stEntry.initial) {
          _stEntry.source = 'llm-adjusted';
        }
      }
      _ty2_render();
    }
    // 朝堂博弈 S2·第1轮后算核心代表(立场对立者)供第2轮收敛
    if (_rd === 1 && (typeof agentFlagOn==='function' ? agentFlagOn('courtDebateEnabled') : (P.conf && P.conf.courtDebateEnabled)) && typeof _ty2_pickCoreDebaters === 'function') {
      try { CY._ty2._coreDebaters = _ty2_pickCoreDebaters(CY._ty2.attendees, CY._ty2.stances, 5); } catch(_pcdE) { CY._ty2._coreDebaters = null; }
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
  if (typeof _sovereignLanguagePromptLine === 'function') prompt += _sovereignLanguagePromptLine(typeof GM !== 'undefined' ? GM : null);
  prompt += '议题：' + CY._ty2.topic + '\n';
  if (CY._ty2.topicCustom) prompt += '说明：' + CY._ty2.topicCustom + '\n';
  prompt += '你扮演' + name + '（' + (ch && ch.officialTitle || '') + '，' + (ch && _cyGetRank(ch) || '') + '）：\n';
  // v2.6 Slice 4·Section A·复用 PromptComposer.buildAiPersonaText·若无 aiPersonaText 字段·fallback personality
  var _pcExists = (typeof window !== 'undefined' && window.TM && TM.PromptComposer);
  if (_pcExists && ch && ch.aiPersonaText && typeof TM.PromptComposer.buildAiPersonaText === 'function') {
    prompt += TM.PromptComposer.buildAiPersonaText(ch, { maxLen: 200 });  // 内省段
  } else {
    prompt += '  性格：' + (ch && ch.personality || '') + '\n';
  }
  prompt += '  党派：' + (ch && ch.party || '无') + '｜势力：' + (ch && ch.faction || '?') + '｜家族：' + (ch && ch.family || '?') + '\n';
  prompt += '  数值：忠' + ((ch && ch.loyalty)||50) + '｜野' + ((ch && ch.ambition)||40) + '｜名望' + ((ch && ch.prestige)||50) + '｜恩眷' + ((ch && ch.favor)||0) + '\n';
  prompt += '  学识：' + (ch && ch.learning || '') + '\n';  // Section D learning·v2 已注入
  // v2.6 Slice 4·Section C·新加·皇威 / 皇权·NPC 看见 hq<30 → confront/martyr 倾向
  if (typeof GM !== 'undefined') {
    var _hw = (GM.huangwei && typeof GM.huangwei.index === 'number') ? GM.huangwei.index : 50;
    var _hq = (GM.huangquan && typeof GM.huangquan.index === 'number') ? GM.huangquan.index : 50;
    prompt += '  当前皇威：' + Math.round(_hw) + '·皇权：' + Math.round(_hq);
    if (_hq < 30) prompt += '（皇权弱·谏言可肆）';
    else if (_hq > 70) prompt += '（皇权盛·宜谨言）';
    prompt += '\n';
  }
  // 出身/经历(背景信息)
  if (ch && ch.background) prompt += '  生平：' + String(ch.background).slice(0, 120) + '\n';
  // 情节弧·若有当前 arc
  if (ch && ch.arc && ch.arc.title) prompt += '  当下处境：' + ch.arc.title + (ch.arc.stage ? '·阶段「' + ch.arc.stage + '」' : '') + '\n';
  // v2.6 Slice 4·Section B·recognitionState·若有则用 PromptComposer.buildRecognitionState
  if (_pcExists && ch && ch.recognitionState && typeof TM.PromptComposer.buildRecognitionState === 'function') {
    prompt += TM.PromptComposer.buildRecognitionState(ch);
  }
  // v7.1·F4b·言官 attribution 注入·若 ch 是言官·补 mentor/cohort/strength prompt 块
  if (typeof _kjYanguanPromptHint === 'function' && ch) {
    try {
      var _yh = _kjYanguanPromptHint(ch);
      if (_yh) prompt += _yh + '\n';
    } catch(_yhE) {}
  }
  // ★2026-07-01 S2治「跨界面人格分裂」:改用统一 getMemoryContext(与问对/奏疏同源·含心绪/人生底色/要事/印象/伤疤)·
  //   而非浅切片(_memory.slice(-5))——同一人在廷议/问对/奏疏读到同一份记忆与心性·人格一致。缓存·token 可控·无则回退。
  var _unifiedMem = '';
  try { if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.getMemoryContext) _unifiedMem = NpcMemorySystem.getMemoryContext(name) || ''; } catch (_umE) {}
  if (_unifiedMem) {
    prompt += '  【此人记忆与心性】' + _unifiedMem + '\n';
  } else {
    var _memList = (ch && ch._memory || []).slice(-5).map(function(m){return (m.event||'').slice(0,40);});
    prompt += '  近期记忆：' + (_memList.join('；') || '无') + '\n';
  }
  // 党派立场+焦点争议·让 NPC 发言契合其党派纲领
  if (ch && ch.party) {
    var _partyObj = (typeof GM !== 'undefined' && Array.isArray(GM.parties))
      ? GM.parties.find(function(p){return p && p.name === ch.party;}) : null;
    if (_partyObj) {
      var _ps = (_partyObj.policyStance || []).slice(0, 5).join('·');
      if (_ps) prompt += '  本党(' + ch.party + ')立场：' + _ps + '\n';
      var _partyAgendaText = function(v) {
        if (!v) return '';
        if (Array.isArray(v)) return v.map(_partyAgendaText).filter(Boolean).slice(0, 3).join(' / ');
        if (typeof v === 'object') v = v.topic || v.title || v.text || v.agenda || v.goal || v.summary || '';
        return String(v || '').replace(/\s+/g, ' ').trim().slice(0, 80);
      };
      var _agendaBits = [];
      var _currentAgenda = _partyAgendaText(_partyObj.currentAgenda);
      var _shortGoal = _partyAgendaText(_partyObj.shortGoal);
      if (_currentAgenda) _agendaBits.push('当前议程：' + _currentAgenda);
      if (_shortGoal) _agendaBits.push('短期目标：' + _shortGoal);
      if (_agendaBits.length) prompt += '  本党近期议程：' + _agendaBits.join('；') + '\n';
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
  // v2.6 Slice 3·hybrid stance·prompt 按 roundNum 分·initial (Round 1 dims 锚) 不变·current (Round 2+ LLM 可调)
  var _hybridSt = CY._ty2 && CY._ty2.stances && CY._ty2.stances[name];
  var _myInitial = _hybridSt && _hybridSt.initial;
  var _myCurrent = _hybridSt && (_hybridSt.current || _hybridSt.initial);
  if (_myInitial) {
    if (roundNum === 1) {
      prompt += '\n你的 initial 立场（按性格 8D 算）：' + _myInitial;
      prompt += '\n第一轮发言·尽量遵循 initial·若强反对·reason 必含原因';
    } else {
      prompt += '\n你的 initial 立场 (Round 1 dims 锚定·不可变)：' + _myInitial;
      prompt += '\n当前 current：' + (_myCurrent || _myInitial);
      prompt += '\n本轮可保 current·或看前发言/cue/党争 调·若调 reason 必含';
    }
    // v2.6 Slice 6 接入·_ty3_modulateModeByPersona·RULES + trait bias 决定 mode·prompt 注入 mode template hint
    try {
      if (typeof _ty3_modulateModeByPersona === 'function' && typeof _ty3_getDims === 'function') {
        var _modeDims = _ty3_getDims(ch);
        var _modeTags = (typeof _ty3_inferTopicTags === 'function')
          ? _ty3_inferTopicTags(CY._ty2 && CY._ty2.topicType, CY._ty2 && CY._ty2.topic)
          : [];
        var _baseMode = roundNum === 1 ? 'lead' : (prevSpeeches && prevSpeeches.length ? 'second' : 'lead');
        // v2.6 polish·真填 sameModeCount + sameStanceCount + npcInDominantCamp·让 4 anti-塌缩 都 active
        var _sameMode = 0, _sameStance = 0, _myCurrent = (_hybridSt && _hybridSt.current) || 'neutral';
        var _stanceTally = { support: 0, oppose: 0, neutral: 0 };
        try {
          (prevSpeeches || []).forEach(function(sp) {
            if (sp.mode && sp.mode === (_hybridSt && _hybridSt._lastMode)) _sameMode++;
          });
          Object.keys((CY._ty2 && CY._ty2.stances) || {}).forEach(function(_nn) {
            var _ns = CY._ty2.stances[_nn] && CY._ty2.stances[_nn].current;
            if (!_ns) return;
            if (/支持/.test(_ns)) _stanceTally.support++;
            else if (/反对/.test(_ns)) _stanceTally.oppose++;
            else _stanceTally.neutral++;
          });
          var _myCamp = /支持/.test(_myCurrent) ? 'support' : /反对/.test(_myCurrent) ? 'oppose' : 'neutral';
          _sameStance = _stanceTally[_myCamp] || 0;
        } catch (_tallyE) {}
        var _dominantCamp = (_stanceTally.support > _stanceTally.oppose) ? 'support'
                          : (_stanceTally.oppose > _stanceTally.support) ? 'oppose' : 'neutral';
        var _ctx = {
          sameModeCount: _sameMode,
          sameStanceCount: _sameStance,
          npcInDominantCamp: (
            (_dominantCamp === 'support' && /支持/.test(_myCurrent)) ||
            (_dominantCamp === 'oppose' && /反对/.test(_myCurrent))
          ),
          confrontJustUsed: !!(CY._ty3 && CY._ty3._confrontChain && CY._ty3._confrontChain.active),
          martyrUsedThisTopic: !!(CY._ty3 && CY._ty3._martyrUsedThisTopic)
        };
        var _finalMode = _ty3_modulateModeByPersona(ch, _modeDims, _modeTags, _baseMode, _ctx);
        if (_finalMode) prompt += '\n你的发言 mode：' + _finalMode + '·按廷议特化口吻 (见 MODES_TEMPLATE)';
        // mark martyr 用过·1 议题 1 次
        if (_finalMode === 'martyr' && CY._ty3) CY._ty3._martyrUsedThisTopic = true;
        // v2.6 polish·记 _lastMode·让下轮 sameModeCount 真累计
        if (_finalMode && _hybridSt) _hybridSt._lastMode = _finalMode;
      }
      // v2.6 Slice 6 tone hint·5 class × tone·prompt 段注入
      if (typeof _ty3_buildToneHint === 'function') {
        var _tone = _ty3_buildToneHint(ch);
        if (_tone) prompt += _tone;
      }
      // v2.6 Slice 10b clientelism check·若有 mentor 关系·调 _ty3_clientelismCheck
      if (typeof _ty3_clientelismCheck === 'function' && ch && ch.mentor && CY._ty2.stances) {
        var _mentorSt = CY._ty2.stances[ch.mentor];
        var _mySt = _hybridSt && _hybridSt.current;
        if (_mentorSt && _mentorSt.current && _mySt) {
          var _client = _ty3_clientelismCheck(ch, _mentorSt.current, _mySt);
          if (_client && _client.source === 'mentor-same-dir') {
            prompt += '\n师承提示·先师 ' + ch.mentor + ' 立场 ' + _mentorSt.current + '·你倾向附议师';
          } else if (_client && _client.source === 'mentor-cancel') {
            prompt += '\n师承提示·先师 ' + ch.mentor + ' 立场 ' + _mentorSt.current + '·跟你 dims 相反·宜沉默 / 折中';
          }
        }
      }
    } catch (_modulateE) {}
  }
  // 朝堂博弈 S1·真辩论：有他官已发言时·强制针对性回应而非各说各话（开关 P.conf.courtDebateEnabled·默认关·关=prompt 逐字节等同现状）
  var _debateOn = !!((typeof agentFlagOn==='function' ? agentFlagOn('courtDebateEnabled') : (P.conf && P.conf.courtDebateEnabled)) && prevSpeeches && prevSpeeches.length);
  if (_debateOn) {
    prompt += '\n【廷议交锋·重要】本轮已有同僚发言(见上「本轮已发言」)。你不可自说自话——发言须针对性回应：\n'
           + '  · 有人立场与你相左→点名反驳其具体论点(引其言而驳之·非泛泛而谈)；\n'
           + '  · 有人立场与你相同→附议并补强或递进·勿简单重复；\n'
           + '  · 你若被某人论点说服而改立场→reason 写明被谁何语打动。\n'
           + '  发言要像真朝堂辩论·有来有往。';
  }
  prompt += '\n请根据以上推断你对本议题的立场（不给预设选项，自行判断），写发言（文言/半文言，符合身份）。' + (typeof _aiDialogueWordHint === 'function' ? _aiDialogueWordHint() : '') + '\n';
  prompt += '返回 JSON：{"stance":"极力支持/支持/倾向支持/中立/倾向反对/反对/极力反对/折中/另提议","confidence":0-100,"line":"发言内容","reason":"内在动机"' + (_debateOn ? ',"respondTo":"你主要回应或反驳的同僚名(无则空字符串)","stanceShiftReason":"若因他人论点改立场·写明被谁何语打动(无则空)"' : '') + '}';

  // A1: 流式化——先建占位气泡·onChunk 用 regex 渐进显示 "line" 字段
  var _tyDiv = addCYBubble(name, '\u2026', false);
  try { _ty2_setSpeaker(name); } catch(_tySpErr) {}   // \u8c01\u9648\u8bcd\u5219\u8c01\u7acb\u7ed8
  var _tyBubble = _tyDiv && _tyDiv.querySelector ? _tyDiv.querySelector('.cy-bubble') : null;
  var _tyRaf = false;
  var _tyRendered = false;  // 1.2.4.3·气泡已成功渲染则禁止 catch 覆写「未能陈词」
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
      if (_tyBubble) { _tyBubble.innerHTML = '\u3014' + (obj.stance||'\u4E2D\u7ACB') + '\u3015<span style="color:' + c + ';">' + escHtml(obj.line) + '</span>'; _tyRendered = true; try { _ty2_tagBubbleStance(_tyDiv, obj.stance); } catch(_tg) {} }
      try { _cy_jishiAdd('tinyi', CY._ty2 && CY._ty2.topic, name, obj.line, { round: roundNum, stance: obj.stance }); } catch(_je){ try{window.TM&&TM.errors&&TM.errors.captureSilent(_je,'tinyi-jishi');}catch(_){} }
      try { if (typeof NpcMemorySystem !== 'undefined') NpcMemorySystem.remember(name, '廷议「' + (CY._ty2 && CY._ty2.topic ? String(CY._ty2.topic).slice(0,20) : '') + '」持' + (obj.stance||'中立') + '：' + String(obj.line).slice(0,40), '平', 5); } catch(_me){ try{window.TM&&TM.errors&&TM.errors.captureSilent(_me,'tinyi-mem');}catch(_){} }
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
        _tyRendered = true;
        try { _ty2_tagBubbleStance(_tyDiv, _rescuedStance); } catch(_tg2) {}
        try { _cy_jishiAdd('tinyi', CY._ty2 && CY._ty2.topic, name, _rescuedLine, { round: roundNum, stance: _rescuedStance, rescued: true }); } catch(_je2){ try{window.TM&&TM.errors&&TM.errors.captureSilent(_je2,'tinyi-jishi-rescue');}catch(_){} }
        return { stance: _rescuedStance || '中立', line: _rescuedLine, confidence: 50, _rescued: true };
      }
      // 最后兜底·去 JSON 符号展示完整 raw (不 slice 200)
      var _clean = raw.replace(/^\s*\{[\s\S]*?"line"\s*:\s*"?|"\s*,?\s*"(?:stance|confidence|reason)"[\s\S]*?\}\s*$/g, '').replace(/^[\s"{]+|[\s"}]+$/g,'').trim();
      _tyBubble.textContent = _clean || raw;
      if (_clean || raw) _tyRendered = true;
    }
  } catch(e){
    try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tinyi-bubble');}catch(_){}
    // 1.2.4.3\u00B7\u53EA\u5728\u672A\u6E32\u67D3\u8FC7\u4EFB\u4F55\u5185\u5BB9\u65F6\u624D\u8986\u5199\u300C\u672A\u80FD\u9648\u8BCD\u300D\u00B7\u907F\u514D\u6210\u529F\u540E\u88AB\u5F02\u5E38\u526F\u4F5C\u7528\u6253\u56DE\u7EA2\u5B57
    if (_tyBubble && !_tyRendered) { _tyBubble.textContent = '\uFF08\u672A\u80FD\u9648\u8BCD\uFF09'; _tyBubble.style.color = 'var(--red)'; }
  }
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
      var raw = await callAI(prompt, (typeof _aiDialogueTok==='function'?_aiDialogueTok("cy", 1):400), null, (typeof _useSecondaryTier === 'function' && _useSecondaryTier()) ? 'secondary' : undefined);  // 廷议走次 API
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
    var raw = await callAI(prompt, 700, null, (typeof _useSecondaryTier === 'function' && _useSecondaryTier()) ? 'secondary' : undefined);  // 廷议走次 API
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
    var raw = await callAI(prompt, (typeof _aiDialogueTok==='function'?_aiDialogueTok("cy", 1):500), null, (typeof _useSecondaryTier === 'function' && _useSecondaryTier()) ? 'secondary' : undefined);  // 廷议走次 API
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

// B方案(真multi-agent)S1·从廷议结束态生成「博弈摘要」(含党派立场分布)·供势力决策跨场景感知
function _ty2_buildDebateMemory(direction, counts) {
  if (!CY._ty2) return null;
  var partyTally = {};
  (CY._ty2.attendees || []).forEach(function(nm) {
    var ch = (typeof findCharByName === 'function') ? findCharByName(nm) : null;
    var party = (ch && ch.party) || '无党';
    var st = (CY._ty2.stances && CY._ty2.stances[nm] && CY._ty2.stances[nm].current) || '';
    if (!partyTally[party]) partyTally[party] = { support: 0, oppose: 0, neutral: 0 };
    if (/支持/.test(st)) partyTally[party].support++;
    else if (/反对/.test(st)) partyTally[party].oppose++;
    else partyTally[party].neutral++;
  });
  var partyAlignment = {};
  Object.keys(partyTally).forEach(function(p) {
    var t = partyTally[p];
    partyAlignment[p] = (t.support > t.oppose) ? 'support' : (t.oppose > t.support) ? 'oppose' : 'neutral';
  });
  return {
    turn: (typeof GM !== 'undefined' && GM.turn) || 0,
    topic: CY._ty2.topic,
    topicType: CY._ty2.topicType,
    decision: direction,
    counts: counts || {},
    partyAlignment: partyAlignment,
    coreDebaters: (CY._ty2._coreDebaters || []).slice(0, 5)
  };
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
  var _tyOutcome = (mode === 'majority') ? ('廷议·从众议：' + actualDirection + '（支持 ' + (counts.support || 0) + ' · 反对 ' + (counts.oppose || 0) + '）')
    : (mode === 'override') ? ('廷议·乾纲独断：' + actualDirection + '（逆众议）')
    : (mode === 'mediation') ? ('廷议·采折中：' + String((CY._ty2._mediation && CY._ty2._mediation.content) || '').slice(0, 40))
    : (mode === 'defer') ? '廷议·延议，留待再议'
    : ('廷议：' + actualDirection);
  _cy_jishiAdd('tinyi', CY._ty2.topic, '皇帝', '裁决：' + actualDirection, { final: true, stances: counts, outcome: _tyOutcome });
  // B方案 S1·廷议博弈摘要沉淀到跨场景记忆 GM._chaoyiMemory（开关控制·供 S2 势力决策读·保留最近 8 条）
  if ((typeof agentFlagOn==='function' ? agentFlagOn('courtDebateEnabled') : (P.conf && P.conf.courtDebateEnabled)) && typeof _ty2_buildDebateMemory === 'function') {
    try {
      var _dm = _ty2_buildDebateMemory(actualDirection, counts);
      if (_dm) {
        if (!Array.isArray(GM._chaoyiMemory)) GM._chaoyiMemory = [];
        GM._chaoyiMemory.push(_dm);
        if (GM._chaoyiMemory.length > 8) GM._chaoyiMemory = GM._chaoyiMemory.slice(-8);
      }
    } catch (_dmE) {}
  }

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
    stances: CY._ty2.stances || {}, decision: decision, stanceHistory: CY._ty2.stanceHistory
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

  // v2.6 Slice 0.0b·v2 path 后处理集成·跟 v3 phase14 parity
  // Patch 1·ChronicleTracker 桥接·写"廷议待落实"卡 (v3 phase14 L3648 已有同等调用)
  try {
    if (typeof ChronicleTracker !== 'undefined' && typeof ChronicleTracker.upsert === 'function' && mode !== 'defer') {
      var _tyChrTrackId = JSON.stringify(['tinyi2', GM.turn || 0, String(CY._ty2.topic || ''), String(actualDirection || '')]);
      ChronicleTracker.upsert({
        type: 'tingyi_pending',         // v2.7 注·tingyi (廷议)·非 chaoyi (朝议)
        sourceType: 'tingyi_pending',
        sourceId: _tyChrTrackId,
        title: String(CY._ty2.topic || '').slice(0, 60),
        actor: '',
        stakeholders: (CY._ty2.attendees || []).slice(0, 8),
        currentStage: '裁决',  // 裁决
        progress: 50,
        narrative: ('廷议「' + CY._ty2.topic + '」裁决：' + actualDirection).slice(0, 160),
        startTurn: GM.turn || 0,
        expectedEndTurn: (GM.turn || 0) + 6,
        hidden: false,
        priority: mode === 'override' ? 'high' : 'medium',
        status: 'active',
        sealStatus: actualDirection,
        shortTermBalance: '廷议新决·待落实',
        longTermBalance: CY._ty2.topic
      });
    }
  } catch (_chrE) { try { window.TM && TM.errors && TM.errors.captureSilent(_chrE, 'v2-tinyi-chronicle'); } catch (_) {} }

  // Patch 2·ClassEngine 集成·class 层传播 (v3 phase6_recordSeal L2818 同等调用)
  try {
    if (typeof TM !== 'undefined' && TM.ClassEngine && typeof TM.ClassEngine.applyPartyOutcomeToClasses === 'function' && mode !== 'defer') {
      // v2 没有 proposerParty 字段·从 attendees 第 1 个推断·或留 null
      var _v2Proposer = (CY._ty2.attendees || [])[0];
      var _v2ProposerCh = _v2Proposer ? findCharByName(_v2Proposer) : null;
      var _v2ProposerParty = _v2ProposerCh ? (_v2ProposerCh.party || '') : '';
      var _v2OutcomeMap = { 'majority':'fulfilled', 'override':'contested', 'mediation':'partial', 'defer':'pending' };
      var _v2Outcome = _v2OutcomeMap[mode] || 'partial';
      TM.ClassEngine.applyPartyOutcomeToClasses(GM, {
        sealStatus: actualDirection,
        outcome: _v2Outcome,
        grade: mode === 'majority' ? 'B' : (mode === 'override' ? 'D' : 'C'),  // v2 无 archon grade·按 mode 推
        sourceParty: _v2ProposerParty,
        opposingParties: [],
        blockerParty: ''
      }, { turn: GM.turn || 0, source: 'tinyi2-decide' });
    }
  } catch (_clsE) { try { window.TM && TM.errors && TM.errors.captureSilent(_clsE, 'v2-tinyi-classengine'); } catch (_) {} }

  // Patch 3·partyStrife update·v3 phase7 同等
  try {
    if (mode !== 'defer' && typeof GM.partyStrife === 'number') {
      // v2 outcome → partyStrife delta (按 v3 paradigm·majority -1·override +2·mediation +1)
      var _strifeDelta = { 'majority': -1, 'override': +2, 'mediation': +1 }[mode] || 0;
      GM.partyStrife = Math.max(0, Math.min(100, GM.partyStrife + _strifeDelta));
    }
  } catch (_strE) { try { window.TM && TM.errors && TM.errors.captureSilent(_strE, 'v2-tinyi-strife'); } catch (_) {} }

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
    var raw = await callAI(prompt, (typeof _aiDialogueTok==='function'?_aiDialogueTok("cy", minority.length):700), null, (typeof _useSecondaryTier === 'function' && _useSecondaryTier()) ? 'secondary' : undefined);  // 廷议走次 API
    var arr = (typeof extractJSON === 'function') ? extractJSON(raw) : null;
    if (Array.isArray(arr)) {
      arr.forEach(function(r) {
        if (!r || !r.name) return;
        var ch = findCharByName(r.name);
        if (!ch) return;
        if (r.line) addCYBubble(r.name, '〔' + (r.type||'') + '〕' + escHtml(r.line), false);
        if (r.type === 'resign') {
          if (typeof addEB === 'function') addEB('人事', r.name + '因廷议逆意而请辞');
          if (typeof adjustCharacterLoyalty === 'function') adjustCharacterLoyalty(ch, -15, '\u5EF7\u8BAE\u9006\u610F\u800C\u8BF7\u8F9E\uFF1A' + CY._ty2.topic, { source:'tinyi-minority-resign' });
          else ch.loyalty = Math.max(0, ((typeof ch.loyalty === 'number' && isFinite(ch.loyalty)) ? ch.loyalty : 50) - 15);
        } else if (r.type === 'sick') {
          ch._mourning = false;
          ch.stress = Math.min(100, (ch.stress||0) + 20);
        } else if (r.type === 'plot') {
          if (!GM.activeSchemes) GM.activeSchemes = [];
          GM.activeSchemes.push({ schemer: r.name, target: '皇帝', plan: '因廷议被压制而暗结同党', progress: '酝酿中', allies: '', startTurn: GM.turn, lastTurn: GM.turn });
          if (typeof adjustCharacterLoyalty === 'function') adjustCharacterLoyalty(ch, -10, '\u5EF7\u8BAE\u88AB\u538B\u5236\u800C\u5BC6\u7ED3\u540C\u515A\uFF1A' + CY._ty2.topic, { source:'tinyi-minority-plot' });
          else ch.loyalty = Math.max(0, ((typeof ch.loyalty === 'number' && isFinite(ch.loyalty)) ? ch.loyalty : 50) - 10);
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

// 通用：建言要点按钮（廷议/御前会议共用）；定义缺失会导致裁决阶段抛 ReferenceError
function _cy_suggestBtnHtml(category) {
  try {
    if (typeof _mzShowSummary !== 'function') return '';
    var label = (category === '御前会议') ? '密 议 要 点' : '建 言 要 点';
    var tip = '由 AI 归总此' + (category||'议') + '中各家主张，便于裁断。';
    return '<button onclick="if(typeof _mzShowSummary===&quot;function&quot;)_mzShowSummary();" title="' + tip + '" '
         + 'style="padding:4px 10px;font-size:12px;background:transparent;border:1px solid var(--color-border-subtle);'
         + 'color:var(--ink-500);border-radius:var(--radius-sm);cursor:pointer;letter-spacing:0.05em;">'
         + label + '</button>';
  } catch(_) { return ''; }
}

function _ty2_globalFooter() {
  return '<div style="margin-top:var(--space-2);padding-top:var(--space-2);border-top:1px solid var(--color-border-subtle);display:flex;gap:3px;justify-content:center;flex-wrap:wrap;">'
    + _cy_suggestBtnHtml('廷议')
    + '</div>';
}
