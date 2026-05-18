// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// Module: tm-chaoyi.js — 朝议入口·共享气泡·_cc2 prompts (Phase 3 cleanup)
// Domain: 朝议·入口与共享
// Status: active · Last Updated: 2026-05-03 (Phase 3·5→4 文件·吸 v2 _cc2 prompts)
// Owner: TM 团队
// Imports: tm-utils.js (GameHooks·_$·callAI·escHtml)·tm-index-world.js (findCharByName)
// Exports: openChaoyi·closeChaoyi·_cy*·showChaoyiSetup·_cy_pickMode·addCYBubble·_cc2_buildAgendaPrompt·_cc2_fallbackAgenda
// Used by: tm-chaoyi-changchao.js·tm-chaoyi-tinyi.js·tm-chaoyi-yuqian.js
// Side effects: DOM modal (chaoyi-modal)·GM._chaoyiCount·CY 状态
// Test: web/scripts/cc3-smoke.js·boot-smoke·render-smoke
// Notes: R112 v1·Phase 3 吸 v2 _cc2 prompts (L165+)·v3 changchao 调
// 姊妹·tm-chaoyi-changchao.js·tm-chaoyi-tinyi.js·tm-chaoyi-yuqian.js
//
// R157 章节导航·§1[L20]openChaoyi·§2[L57]_cy*·§3[L83]location·§4[L100]showChaoyiSetup
//   §5[L126]_cy_pickMode·§6[L142]startChaoyiSession·§7[L144]addCYBubble·§8[L165]_cc2 prompts
// ============================================================

function openChaoyi(){
  // 频率计数初始化；具体限制在 _cy_pickMode 按模式判断，御前会议不限。
  if (!GM._chaoyiCount) GM._chaoyiCount = {};
  if (!GM._chaoyiCount[GM.turn]) GM._chaoyiCount[GM.turn] = 0;
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
  if (GM._isPostTurnCourt && GM._pendingShijiModal && GM._pendingShijiModal.courtDone === false && typeof _onPostTurnCourtEnd === 'function') {
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

function _cyRankLabels() {
  if (typeof RANK_HIERARCHY !== 'undefined' && Array.isArray(RANK_HIERARCHY) && RANK_HIERARCHY.length) {
    return RANK_HIERARCHY.map(function(r) { return r && r.label; }).filter(function(v) { return !!v; });
  }
  return [
    '\u6b63\u4e00\u54c1', '\u4ece\u4e00\u54c1', '\u6b63\u4e8c\u54c1', '\u4ece\u4e8c\u54c1',
    '\u6b63\u4e09\u54c1', '\u4ece\u4e09\u54c1', '\u6b63\u56db\u54c1', '\u4ece\u56db\u54c1',
    '\u6b63\u4e94\u54c1', '\u4ece\u4e94\u54c1', '\u6b63\u516d\u54c1', '\u4ece\u516d\u54c1',
    '\u6b63\u4e03\u54c1', '\u4ece\u4e03\u54c1', '\u6b63\u516b\u54c1', '\u4ece\u516b\u54c1',
    '\u6b63\u4e5d\u54c1', '\u4ece\u4e5d\u54c1'
  ];
}

function _cyRankLabelFromLevel(level) {
  var n = Number(level);
  if (!isFinite(n)) return '';
  if (n <= 0) n = 1;
  if (typeof RANK_HIERARCHY !== 'undefined' && Array.isArray(RANK_HIERARCHY)) {
    for (var i = 0; i < RANK_HIERARCHY.length; i++) {
      if (RANK_HIERARCHY[i] && Number(RANK_HIERARCHY[i].level) === n) return RANK_HIERARCHY[i].label || '';
    }
  }
  return _cyRankLabels()[n - 1] || '';
}

function _cyExtractRankLabel(value) {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value === 'number') return _cyRankLabelFromLevel(value);
  var text = String(value || '').trim();
  if (!text) return '';
  if (/^\d+$/.test(text)) return _cyRankLabelFromLevel(parseInt(text, 10));
  var labels = _cyRankLabels();
  for (var i = 0; i < labels.length; i++) {
    if (labels[i] && text.indexOf(labels[i]) >= 0) return labels[i];
  }
  return '';
}

function _cyRankLevelOf(rank) {
  if (!rank) return 99;
  if (typeof getRankLevel === 'function') {
    var lv = getRankLevel(rank);
    if (lv !== 99) return lv;
  }
  var labels = _cyRankLabels();
  for (var i = 0; i < labels.length; i++) {
    if (labels[i] && String(rank).indexOf(labels[i]) >= 0) return i + 1;
  }
  return 99;
}

function _cyPositionHolders(pos) {
  if (!pos) return [];
  if (typeof _offMigratePosition === 'function') {
    try { _offMigratePosition(pos); } catch(e) { try { window.TM && TM.errors && TM.errors.captureSilent(e, 'tm-chaoyi-rank'); } catch(_) {} }
  }
  if (typeof _offAllHolders === 'function') {
    try { return _offAllHolders(pos) || []; } catch(e2) { try { window.TM && TM.errors && TM.errors.captureSilent(e2, 'tm-chaoyi-rank'); } catch(_) {} }
  }
  var arr = [];
  if (pos.holder) arr.push(pos.holder);
  if (Array.isArray(pos.additionalHolders)) arr = arr.concat(pos.additionalHolders);
  if (Array.isArray(pos.actualHolders)) {
    pos.actualHolders.forEach(function(h) {
      var nm = h && (h.name || h);
      if (nm && arr.indexOf(nm) < 0) arr.push(nm);
    });
  }
  return arr;
}

function _cyFallbackRankByTitle(ch) {
  var title = [ch.officialTitle, ch.title, ch.position, ch.office, ch.role].filter(function(v) { return !!v; }).join(' ');
  if (!title) return '';
  var pairs = [
    [/(\u9996\u8f85|\u5927\u5b66\u58eb|\u5c1a\u4e66|\u603b\u7763|\u90fd\u7763|\u603b\u5175)/, '\u6b63\u4e8c\u54c1'],
    [/(\u4f8d\u90ce|\u5de1\u629a|\u526f\u5c06|\u5e03\u653f\u4f7f|\u6309\u5bdf\u4f7f)/, '\u6b63\u4e09\u54c1'],
    [/(\u5fa1\u53f2|\u7ed9\u4e8b\u4e2d|\u77e5\u5e9c|\u53c2\u5c06)/, '\u6b63\u56db\u54c1'],
    [/(\u90ce\u4e2d|\u4e3b\u4e8b|\u540c\u77e5|\u901a\u5224)/, '\u6b63\u4e94\u54c1'],
    [/(\u77e5\u53bf|\u53bf\u4ee4|\u8bad\u5bfc|\u5178\u53f2)/, '\u6b63\u4e03\u54c1']
  ];
  for (var i = 0; i < pairs.length; i++) {
    if (pairs[i][0].test(title)) return pairs[i][1];
  }
  return '';
}

// Shared rank resolver used by court/tinyi/yuqian modules.
function _cyGetRank(ch) {
  if (!ch) return '';
  if (typeof ch === 'string') ch = (typeof findCharByName === 'function' && findCharByName(ch)) || { name: ch };

  var best = '';
  function consider(value) {
    var rank = _cyExtractRankLabel(value);
    if (!rank) return;
    if (!best || _cyRankLevelOf(rank) < _cyRankLevelOf(best)) best = rank;
  }

  consider(ch.rank);
  consider(ch.officialRank);
  consider(ch.rankText);
  consider(ch.rankLabel);
  consider(ch.officeRank);
  consider(ch.rankLevel);
  if (ch.officeRef) {
    consider(ch.officeRef.rank);
    consider(ch.officeRef.rankLevel);
  }

  var name = ch.name || ch.characterName || '';
  if (name && typeof _findPositionByCharName === 'function') {
    try {
      var hit = _findPositionByCharName(name);
      if (hit && hit.pos) consider(hit.pos.rank);
    } catch(e) { try { window.TM && TM.errors && TM.errors.captureSilent(e, 'tm-chaoyi-rank'); } catch(_) {} }
  }

  if (name && typeof GM !== 'undefined' && GM && GM.officeTree) {
    (function walk(nodes) {
      if (!Array.isArray(nodes)) return;
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        if (!n) continue;
        (n.positions || []).forEach(function(pos) {
          var holders = _cyPositionHolders(pos);
          if (holders.indexOf(name) >= 0) consider(pos.rank);
        });
        if (n.subs) walk(n.subs);
      }
    })(GM.officeTree);
  }

  consider(ch.officialTitle);
  consider(ch.title);
  if (best) return best;
  return _cyFallbackRankByTitle(ch);
}

if (typeof window !== 'undefined') window._cyGetRank = _cyGetRank;

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

function _cy_isModeBlockedByFrequency(mode) {
  if (mode === 'yuqian') return false;
  if (!GM._chaoyiCount) GM._chaoyiCount = {};
  if (!GM._chaoyiCount[GM.turn]) GM._chaoyiCount[GM.turn] = 0;
  if (GM._chaoyiCount[GM.turn] < 2) return false;
  if (typeof toast === 'function') toast('今日已朝议' + GM._chaoyiCount[GM.turn] + '次，改日再议；御前会议仍可密召');
  return true;
}

function _cy_pickMode(mode) {
  CY.mode = mode;
  if (_cy_isModeBlockedByFrequency(mode)) return;
  if (mode === 'changchao') {
    // CC 迁移波 5+ → Phase 3 (2026-05-03)·v2 §1 物理删除·常朝唯一入口为 _cc3_open（tm-chaoyi-changchao.js）
    if (typeof _cc3_open === 'function') {
      _cc3_open({ isPostTurn: false, source: 'in-turn-picker' });
    } else if (typeof toast === 'function') {
      toast('常朝 v3 未加载·请刷新页面');
    }
    return;
  }
  if (mode === 'tinyi')  { _ty2_openSetup(); return; }
  if (mode === 'yuqian') { _yq2_openSetup(); return; }
}

// 老版进入函数——若旧代码路径仍调用，重导向到 showChaoyiSetup
function startChaoyiSession(){ showChaoyiSetup(); }

// ─── 共享气泡组件（v1 删除后唯一保留的 UI 工具·tm-chaoyi-v2.js 大量调用） ───
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

// ─── §8·v2 _cc2 prompts (Phase 3 吸·tm-chaoyi-changchao.js 调) ───
// 来源：原 tm-chaoyi-v2.js L20-99·v2 §1 常朝已物理删除·只 prompts 复用
// changchao (v3) _cc3_buildAgendaFromGM 调 _cc2_buildAgendaPrompt + _cc2_fallbackAgenda

function _cc2_cleanAgendaText(v, n) {
  var s = String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
  if (!n || s.length <= n) return s;
  return s.slice(0, n);
}

function _cc2_agendaStatusOpen(status) {
  var s = String(status == null ? 'pending' : status).toLowerCase();
  if (!s) return true;
  if (/resolved|approved|rejected|completed|complete|done|closed|cancel/.test(s)) return false;
  return /pending|review|new|submit|traveling|returned|arrived|unread|open|hold|defer/.test(s) || s === 'normal';
}

function _cc2_agendaDedupKey(row) {
  return _cc2_cleanAgendaText((row.title || '') + '|' + (row.detail || row.content || ''), 80).replace(/\s+/g, '');
}

function _cc2_pushAgendaSource(out, seen, row) {
  if (!row) return;
  var title = _cc2_cleanAgendaText(row.title || row.topic || row.subject || row.name || '', 24);
  var detail = _cc2_cleanAgendaText(row.detail || row.content || row.text || row.summary || row.description || row.narrative || '', 120);
  if (!title && detail) title = _cc2_cleanAgendaText(detail, 12);
  if (!title && !detail) return;
  var source = _cc2_cleanAgendaText(row.source || '朝政', 12) || '朝政';
  var key = _cc2_agendaDedupKey({ title: title, detail: detail || source });
  if (key && seen[key]) return;
  if (key) seen[key] = 1;
  out.push({
    source: source,
    title: title || '未名事务',
    dept: _cc2_cleanAgendaText(row.dept || row.department || row.category || row.type || '', 16),
    presenter: _cc2_cleanAgendaText(row.presenter || row.from || row.author || row.proposer || '', 16),
    detail: detail || '请有司据实核奏。',
    urgency: _cc2_cleanAgendaText(row.urgency || row.priority || '', 12),
    type: _cc2_cleanAgendaText(row.agendaType || row.kind || row.type || '', 18),
    importance: typeof row.importance === 'number' ? row.importance : (row.urgency === 'urgent' || row.priority === 'urgent' ? 8 : 5),
    controversial: typeof row.controversial === 'number' ? row.controversial : 4,
    ref: row.ref || ''
  });
}

function _cc2_collectAgendaSources(opts) {
  opts = opts || {};
  var max = opts.max || 18;
  var out = [], seen = {};
  var g = (typeof GM !== 'undefined' && GM) ? GM : {};
  var playerFac = (typeof P !== 'undefined' && P && P.playerInfo && P.playerInfo.factionName) || '';
  function _recentRows(arr, n) {
    return Array.isArray(arr) ? arr.slice(-Math.max(1, n || 4)).reverse() : [];
  }
  function _rowDetail(o) {
    if (!o || typeof o !== 'object') return '';
    var keys = ['summary','content','text','detail','description','reason','result','ruling','reply','trigger','policy','action','intent','topic'];
    for (var i = 0; i < keys.length; i++) {
      if (o[keys[i]]) return o[keys[i]];
    }
    if (o.effects && typeof o.effects === 'object') return Object.keys(o.effects).slice(0, 4).map(function(k){ return k + ':' + JSON.stringify(o.effects[k]); }).join('；');
    if (o.effect && typeof o.effect === 'object') return Object.keys(o.effect).slice(0, 4).map(function(k){ return k + ':' + JSON.stringify(o.effect[k]); }).join('；');
    return '';
  }

  if (opts.includeHeld !== false && Array.isArray(g._ccHeldItems)) {
    g._ccHeldItems.slice(0, 5).forEach(function(h) {
      _cc2_pushAgendaSource(out, seen, {
        source: '留中续议',
        title: h.title || h.topic,
        dept: h.dept || h.department || h.type,
        presenter: h.presenter || h.from || '上次常朝',
        detail: h.content || h.detail || h.summary,
        agendaType: h.type || 'request',
        importance: 8,
        controversial: h.controversial || 5,
        ref: 'ccHeld'
      });
    });
  }

  if (Array.isArray(g._pendingTinyiTopics)) {
    g._pendingTinyiTopics.slice(0, 4).forEach(function(t) {
      _cc2_pushAgendaSource(out, seen, {
        source: '廷议待议',
        title: t.title || t.topic || '廷议未决',
        dept: t.dept || '朝议',
        presenter: t.from || '廷议',
        detail: t.detail || t.content || t.topic,
        agendaType: 'request',
        importance: 7,
        controversial: 6,
        ref: 'pendingTinyi'
      });
    });
  }

  _recentRows(g._edictTracker, 6).filter(function(e) {
    return e && _cc2_agendaStatusOpen(e.status || 'pending');
  }).forEach(function(e) {
    var stat = e.status ? '状态 ' + e.status + '。' : '';
    var fb = e.feedback ? '反馈：' + e.feedback + '。' : '';
    _cc2_pushAgendaSource(out, seen, {
      source: '陛下诏令',
      title: e.title || e.category || '本朝诏令',
      dept: e.category || e.assignee || '御前',
      presenter: '御前',
      detail: stat + _cc2_cleanAgendaText(e.content || e.text || '', 110) + (fb ? '；' + fb : ''),
      agendaType: e._crossFaction || e._diplomaticMsg ? 'warning' : 'request',
      importance: e.status === 'obstructed' || e.status === 'partial' ? 8 : 6,
      controversial: /严办|罢|诛|抄|征|税|党|弹劾|外交|攻|讨/.test(String(e.content || '')) ? 7 : 4,
      ref: e.id || ''
    });
  });

  _recentRows(g._approvedMemorials, 6).forEach(function(m) {
    if (!m) return;
    var actionText = m.action || m.status || '已批';
    _cc2_pushAgendaSource(out, seen, {
      source: '朱批奏疏',
      title: (m.from || '臣工') + '所奏',
      dept: m.type || m.referredTo || '奏疏',
      presenter: m.from || '臣工',
      detail: '陛下已作“' + actionText + '”批复；奏由：' + _cc2_cleanAgendaText(m.content || m.text || '', 72) + (m.reply ? '；朱批：' + _cc2_cleanAgendaText(m.reply, 48) : ''),
      agendaType: actionText === 'rejected' ? 'confrontation' : 'request',
      importance: actionText === 'court_debate' || actionText === 'referred' ? 8 : 5,
      controversial: /rejected|驳|弹劾|劾|罪|贪|党/.test(actionText + String(m.content || '') + String(m.reply || '')) ? 7 : 4,
      ref: 'approvedMemorial'
    });
  });

  _recentRows(g.playerDecisions, 6).forEach(function(d) {
    if (!d) return;
    _cc2_pushAgendaSource(out, seen, {
      source: d.category === 'edict' ? '陛下诏令' : '主角行止',
      title: d.category || '玩家决策',
      dept: '御前',
      presenter: '陛下',
      detail: (d.desc || d.description || '') + (d.consequences ? '；后果：' + d.consequences : ''),
      agendaType: d.category === 'appointment' ? 'personnel' : 'routine',
      importance: 6,
      controversial: /严办|诛|罢|抄|弹劾|战|税|党/.test(String(d.desc || d.description || '')) ? 7 : 3,
      ref: 'playerDecisions'
    });
  });

  try {
    var liveAction = (typeof window !== 'undefined' && window.TM_PHASE8_FORMAL && window.TM_PHASE8_FORMAL.playerAction) ? window.TM_PHASE8_FORMAL.playerAction : '';
    if (liveAction) {
      _cc2_pushAgendaSource(out, seen, {
        source: '主角行止',
        title: '本回合行止',
        dept: '御前',
        presenter: '陛下',
        detail: liveAction,
        agendaType: 'routine',
        importance: 5,
        controversial: /召见|校阅|宴|祭|巡|严办|抄|诛|微服/.test(String(liveAction)) ? 5 : 2,
        ref: 'phase8PlayerAction'
      });
    }
  } catch (_) {}

  var mems = [];
  if (Array.isArray(g.memorials)) mems = mems.concat(g.memorials);
  if (Array.isArray(g.zoushuPool)) mems = mems.concat(g.zoushuPool);
  mems.filter(function(m) {
    return m && _cc2_agendaStatusOpen(m.status) && !m._commitApplied && !m._phase8Fallback;
  }).slice(0, 8).forEach(function(m) {
    _cc2_pushAgendaSource(out, seen, {
      source: '百官奏疏',
      title: m.title || m.topic || m.subject || ((m.from || m.author || '臣工') + '奏事'),
      dept: m.dept || m.department || m.type || m.category || '通政司',
      presenter: m.from || m.author || m.proposer || m.official || '',
      detail: m.content || m.text || m.body || m.desc || m.summary,
      urgency: m.urgency || m.priority,
      agendaType: m.subtype || m.type || 'request',
      importance: m.priority === 'urgent' ? 8 : 6,
      controversial: /弹劾|劾|争|党|罪|贪|叛/.test(String(m.title || m.content || '')) ? 8 : 4,
      ref: m.id || ''
    });
  });

  (g.currentIssues || []).filter(function(i) {
    return i && i.status === 'pending' && i.allocatedTo !== 'tinyi';
  }).slice(0, 6).forEach(function(i) {
    _cc2_pushAgendaSource(out, seen, {
      source: '御案时政',
      title: i.title || i.topic,
      dept: i.dept || i.category || '时政',
      presenter: i.proposer || i.from || '通政司',
      detail: i.description || i.summary || i.brief || i.narrative || i.text || i.detail,
      urgency: i.urgency || i.severity,
      agendaType: 'routine',
      importance: i.severity === 'urgent' ? 8 : 6,
      controversial: i.controversial || 5,
      ref: i.id || ''
    });
  });

  var letters = [];
  if (Array.isArray(g.letters)) letters = letters.concat(g.letters);
  if (Array.isArray(g._pendingNpcLetters)) letters = letters.concat(g._pendingNpcLetters);
  letters.filter(function(l) {
    if (!l) return false;
    if (l._npcInitiated === false && !l.from) return false;
    return _cc2_agendaStatusOpen(l.status || 'pending') && !l._cc2AgendaUsed;
  }).slice(-5).forEach(function(l) {
    _cc2_pushAgendaSource(out, seen, {
      source: '鸿雁来书',
      title: l.title || l.subject || l.subjectLine || ((l.from || l.sender || '远臣') + '来书'),
      dept: l.dept || l.letterType || l.type || '传书',
      presenter: l.from || l.sender || l.author || '',
      detail: l.content || l.text || l.body || l.summary || l.suggestion,
      urgency: l.urgency,
      agendaType: l.type || l.letterType || 'request',
      importance: l.urgency === 'urgent' || l.urgency === 'extreme' ? 8 : 5,
      controversial: /弹劾|密|急|军|叛|乱/.test(String(l.content || l.title || '')) ? 7 : 3,
      ref: l.id || ''
    });
  });

  _recentRows(g._npcInternalActionHistory, 8).forEach(function(a) {
    if (!a) return;
    var raw = [a.kind, a.from, a.to, a.intent, a.visibility].join(' ');
    if (!/impeach|slander|expose|frame|clique|petition|弹劾|诽谤|揭发|构陷|结党|朋党|党/.test(raw)) return;
    _cc2_pushAgendaSource(out, seen, {
      source: '政斗弹劾',
      title: (a.from || '某臣') + (a.to ? '涉' + a.to : '政争'),
      dept: '都察院',
      presenter: a.from || '科道',
      detail: a.intent || a.visibility || a.kind || '朝中政争已露端倪。',
      agendaType: 'confrontation',
      importance: 7,
      controversial: 9,
      ref: a.actionId || ''
    });
  });

  if (Array.isArray(g.parties)) {
    g.parties.slice(0, 8).forEach(function(party) {
      if (!party) return;
      var agenda = party.currentAgenda || party.shortGoal || party.longGoal || '';
      if (!agenda && !(party.rivalParty || party.status)) return;
      _cc2_pushAgendaSource(out, seen, {
        source: '政斗弹劾',
        title: (party.name || '党派') + '议程',
        dept: '都察院',
        presenter: party.leader || '言官',
        detail: '党派状态：' + (party.status || '活跃') + '；诉求：' + agenda + (party.rivalParty ? '；主要对手：' + party.rivalParty : ''),
        agendaType: /弹劾|攻讦|倒/.test(agenda) ? 'confrontation' : 'routine',
        importance: Math.max(4, Number(party.influence || 0) / 12),
        controversial: /弹劾|阉党|东林|攻讦|清流|朋党/.test((party.name || '') + agenda) ? 8 : 5,
        ref: party.name || ''
      });
    });
  }

  if (Array.isArray(g.qijuHistory)) {
    g.qijuHistory.slice(0, 6).forEach(function(q) {
      _cc2_pushAgendaSource(out, seen, {
        source: '近事起居',
        title: q.title || _cc2_cleanAgendaText(q.content || q.text || '起居近事', 18),
        dept: q.type || '起居注',
        presenter: q.from || '起居注',
        detail: q.content || q.text || q.summary,
        agendaType: 'routine',
        importance: 4,
        controversial: /弹劾|争|罪|贪|乱|军|饷/.test(String(q.content || '')) ? 6 : 2,
        ref: 'qiju'
      });
    });
  }

  if (Array.isArray(g.evtLog)) {
    g.evtLog.slice(-10).reverse().forEach(function(e) {
      _cc2_pushAgendaSource(out, seen, {
        source: '事件栏',
        title: e.title || e.type || '近事',
        dept: e.type || '近事',
        presenter: e.from || '有司',
        detail: e.text || e.content || e.summary || e.detail,
        agendaType: 'routine',
        importance: /战争|军|叛|乱|灾|死|任免|财政/.test(String(e.type || e.text || '')) ? 7 : 4,
        controversial: /弹劾|贪|党|罢|罪/.test(String(e.text || '')) ? 7 : 3,
        ref: 'evtLog'
      });
    });
  }

  if (g._eventBus && Array.isArray(g._eventBus.items)) {
    g._eventBus.items.slice(-6).reverse().forEach(function(e) {
      _cc2_pushAgendaSource(out, seen, {
        source: '事件栏',
        title: e.title || e.type || '事件',
        dept: e.type || e.category || '近事',
        presenter: e.from || '有司',
        detail: e.text || e.content || e.summary || e.detail,
        importance: 4,
        controversial: 3,
        ref: 'eventBus'
      });
    });
  }

  var facs = [];
  if (Array.isArray(g.facs)) facs = facs.concat(g.facs);
  if (Array.isArray(g.factions)) facs = facs.concat(g.factions);
  if (typeof P !== 'undefined' && P && Array.isArray(P.factions)) facs = facs.concat(P.factions);
  var facSeen = {};
  facs.filter(function(f) {
    if (!f || !f.name || facSeen[f.name]) return false;
    facSeen[f.name] = 1;
    return !playerFac || f.name !== playerFac;
  }).slice(0, 12).forEach(function(fac) {
    [
      ['npcMilitaryActions', '外部势力军政', '兵部'],
      ['npcDiplomacyActions', '外部势力外交', '礼部'],
      ['npcProvincePolicies', '外部势力内政', '户部'],
      ['npcFiscalActions', '外部势力内政', '户部'],
      ['npcFiscalLedger', '外部势力内政', '户部'],
      ['npcIntrigueActions', '外部势力外交', '礼部'],
      ['npcRebellionPolicies', '外部势力军政', '兵部'],
      ['npcChaoyi', '外部势力朝议', '通政司'],
      ['npcEdicts', '外部势力朝议', '通政司'],
      ['npcOfficeActions', '外部势力内政', '吏部'],
      ['npcMemorials', '外部势力朝议', '通政司']
    ].forEach(function(def) {
      _recentRows(fac[def[0]], 2).forEach(function(a) {
        var detail = _rowDetail(a);
        _cc2_pushAgendaSource(out, seen, {
          source: def[1],
          title: fac.name + '·' + (a.title || a.type || a.action || a.kind || def[0].replace(/^npc/, '')),
          dept: def[2],
          presenter: fac.leader || fac.ruler || fac.name,
          detail: detail || (fac.name + '近期有' + def[1] + '动向。'),
          agendaType: /Intrigue|Rebellion|Military|impeach|slander|叛|乱|攻/.test(def[0] + detail) ? 'warning' : 'routine',
          importance: /Military|Diplomacy|Rebellion|Intrigue/.test(def[0]) ? 7 : 5,
          controversial: /Intrigue|impeach|slander|叛|乱|攻|盟|外交/.test(def[0] + detail) ? 7 : 4,
          ref: fac.name + ':' + def[0]
        });
      });
    });
  });

  var externalForces = [];
  if (Array.isArray(g.extForces)) externalForces = externalForces.concat(g.extForces);
  if (Array.isArray(g.externalForces)) externalForces = externalForces.concat(g.externalForces);
  if (typeof P !== 'undefined' && P && Array.isArray(P.externalForces)) externalForces = externalForces.concat(P.externalForces);
  externalForces.slice(0, 8).forEach(function(x) {
    if (!x || !x.name) return;
    var rel = typeof x.relation === 'number' ? x.relation : null;
    if (rel != null && rel > 20 && !/敌|中立|叛|侵|窥|不稳/.test(String(x.attitude || x.description || ''))) return;
    _cc2_pushAgendaSource(out, seen, {
      source: '外部势力态势',
      title: x.name + '动向',
      dept: '礼部',
      presenter: '礼部',
      detail: '关系 ' + (rel == null ? '未详' : rel) + '；态度 ' + (x.attitude || '未详') + '；实力 ' + (x.strength || '') + '；' + (x.description || x.territory || ''),
      agendaType: rel != null && rel < -20 ? 'warning' : 'routine',
      importance: rel != null && rel < -40 ? 8 : 5,
      controversial: rel != null && rel < -30 ? 6 : 3,
      ref: x.name
    });
  });

  if (Array.isArray(g.deptTasks)) {
    _recentRows(g.deptTasks.filter(function(t){ return t && _cc2_agendaStatusOpen(t.status || 'pending'); }), 5).forEach(function(t) {
      _cc2_pushAgendaSource(out, seen, {
        source: '内政事务',
        title: t.task || t.title || '部议任务',
        dept: t.dept || '六部',
        presenter: t.dept || '有司',
        detail: t.detail || t.content || t.reason || '部议任务尚待推进。',
        agendaType: 'request',
        importance: t.dueIn != null && t.dueIn <= 1 ? 7 : 5,
        controversial: /阻|争|弹劾|钱|粮|军/.test(String(t.detail || t.task || '')) ? 6 : 3,
        ref: 'deptTasks'
      });
    });
  }

  if (Array.isArray(g.officeChanges)) {
    _recentRows(g.officeChanges, 5).forEach(function(o) {
      var oText = [o && o.title, o && o.name, o && o.charName, o && o.from, o && o.to, o && o.reason, o && o.action].filter(Boolean).join(' ');
      _cc2_pushAgendaSource(out, seen, {
        source: '官制人事',
        title: o.title || o.name || o.charName || '人事变动',
        dept: o.dept || o.office || '吏部',
        presenter: '吏部',
        detail: _rowDetail(o) || [o.from, o.to, o.reason].filter(Boolean).join(' → '),
        agendaType: 'personnel',
        importance: 5,
        controversial: /罢|黜|弹劾|争|党|贬/.test(oText) ? 7 : 4,
        ref: 'officeChanges'
      });
    });
  }

  if (g.provinceStats && typeof g.provinceStats === 'object') {
    Object.keys(g.provinceStats).slice(0, 12).forEach(function(k) {
      var ps = g.provinceStats[k] || {};
      var unrest = Number(ps.unrest || ps.revoltRisk || ps.instability || 0);
      var tax = Number(ps.taxPressure || ps.tax || 0);
      if (unrest < 60 && tax < 70 && !ps.crisis && !ps.famine) return;
      _cc2_pushAgendaSource(out, seen, {
        source: '地方民情',
        title: k + '民情',
        dept: '户部',
        presenter: '户部',
        detail: '地方指标异常：民变/不稳 ' + unrest + '，税压 ' + tax + (ps.crisis ? '；危机 ' + ps.crisis : '') + (ps.famine ? '；饥荒' : ''),
        agendaType: 'warning',
        importance: 7,
        controversial: 5,
        ref: k
      });
    });
  }

  if (Array.isArray(g.activeWars) && g.activeWars.length) {
    g.activeWars.slice(0, 3).forEach(function(w) {
      _cc2_pushAgendaSource(out, seen, {
        source: '军务战事',
        title: (w.frontline || w.location || w.enemy || '边镇') + '军情',
        dept: '兵部',
        presenter: '兵部',
        detail: '战事对手 ' + (w.enemy || w.opponent || '未详') + '；状态 ' + (w.status || '相持') + '；请议粮饷、援兵与主将调度。',
        agendaType: 'warning',
        urgency: 'urgent',
        importance: 9,
        controversial: 6,
        ref: 'activeWars'
      });
    });
  }

  var meters = [];
  if (typeof g.unrest === 'number' && g.unrest >= 60) meters.push({ source:'民情财赋', title:'民变指数偏高', dept:'户部', detail:'民变指数已至 ' + Math.round(g.unrest) + '，有司须议赈济、蠲免与安抚。', importance:7, controversial:5 });
  if (typeof g.partyStrife === 'number' && g.partyStrife >= 60) meters.push({ source:'官守党争', title:'党争日炽', dept:'都察院', detail:'党争指数已至 ' + Math.round(g.partyStrife) + '，科道与内阁须议弹章、考核与廷推秩序。', importance:6, controversial:8 });
  var corr = null;
  if (typeof g.corruption === 'number') corr = g.corruption;
  else if (g.corruption && typeof g.corruption.trueIndex === 'number') corr = g.corruption.trueIndex;
  else if (g.corruption && typeof g.corruption.overall === 'number') corr = g.corruption.overall;
  else if (g.corruption && typeof g.corruption.index === 'number') corr = g.corruption.index;
  if (corr != null && corr >= 60) meters.push({ source:'官守党争', title:'贪墨渐重', dept:'都察院', detail:'腐败指数已至 ' + Math.round(corr) + '，宜议清查、考成与抚按稽核。', importance:6, controversial:7 });
  meters.forEach(function(m) { _cc2_pushAgendaSource(out, seen, m); });

  return (typeof _cc2_pickAgendaSourcesForCourt === 'function') ? _cc2_pickAgendaSourcesForCourt(out, max) : out.slice(0, max);
}

function _cc2_formatAgendaSourcesForPrompt(list, max) {
  list = (list || []).slice(0, max || 18);
  if (!list.length) return '';
  return list.map(function(s, idx) {
    var meta = [s.source, s.dept, s.presenter].filter(Boolean).join('·');
    return '  ' + (idx + 1) + '. 【' + meta + '】' + s.title + '：' + _cc2_cleanAgendaText(s.detail, 86);
  }).join('\n');
}

function _cc2_pickAgendaSourcesForCourt(pool, max) {
  pool = pool || [];
  max = max || 6;
  var picked = [], used = {};
  var order = ['留中续议', '陛下诏令', '朱批奏疏', '主角行止', '百官奏疏', '政斗弹劾', '外部势力军政', '外部势力外交', '外部势力内政', '外部势力朝议', '外部势力态势', '鸿雁来书', '近事起居', '事件栏', '军务战事', '地方民情', '内政事务', '官制人事', '民情财赋', '官守党争', '廷议待议', '御案时政'];
  order.forEach(function(src) {
    if (picked.length >= max) return;
    var row = pool.find(function(x) { return x && x.source === src && !used[_cc2_agendaDedupKey(x)]; });
    if (row) {
      used[_cc2_agendaDedupKey(row)] = 1;
      picked.push(row);
    }
  });
  pool.forEach(function(row) {
    if (picked.length >= max || !row) return;
    var key = _cc2_agendaDedupKey(row);
    if (used[key]) return;
    used[key] = 1;
    picked.push(row);
  });
  return picked;
}

function _cc2_agendaSourceToItem(src, idx) {
  src = src || {};
  var source = src.source || '朝政';
  var title = _cc2_cleanAgendaText(src.title || '朝政议题', 10) || '朝政议题';
  var dept = src.dept || (source === '百官奏疏' ? '通政司' : source === '军务战事' ? '兵部' : source === '民情财赋' ? '户部' : source === '官守党争' ? '都察院' : '六部');
  var raw = _cc2_cleanAgendaText(src.detail || '请有司据实核奏。', 90) || '请有司据实核奏。';
  var type = src.type || (source === '军务战事' ? 'warning' : source === '百官奏疏' || source === '鸿雁来书' ? 'request' : source === '官守党争' ? 'confrontation' : 'routine');
  var urgent = src.urgency === 'urgent' || src.urgency === 'extreme' || source === '军务战事';
  return {
    presenter: src.presenter || '某部官员',
    dept: dept,
    type: type,
    urgency: urgent ? 'urgent' : 'normal',
    title: title,
    announceLine: dept + '据' + source + '奏称：“' + title + '”须请旨裁断。',
    content: (src.presenter ? src.presenter + '所陈' : dept + '奏称') + '：据' + source + '，“' + title + '”一事已见端倪。' + raw + '。乞敕有司核明情由，酌定处分。',
    detail: source + '线索：' + src.title + '；要点：' + raw + '。',
    controversial: src.controversial || (/confrontation|弹劾|党争|贪/.test(type + raw) ? 7 : 4),
    importance: src.importance || (urgent ? 8 : 5),
    relatedDepts: dept ? [dept] : [],
    relatedPeople: src.presenter ? [src.presenter] : [],
    _fallback: true,
    _source: source,
    _sourceRef: src.ref || ''
  };
}

function _cc2_buildAgendaPrompt() {
  var p = '你是常朝议程编撰官。请为今日常朝后台生成 5-9 条奏报事务（玩家暂不可见，将按顺序一条一条登场）。\n';
  p += '当前：' + (typeof getTSText==='function'?getTSText(GM.turn):'T'+GM.turn) + '\n';
  var _agendaSources = (typeof _cc2_collectAgendaSources === 'function') ? _cc2_collectAgendaSources({ max: 18, includeHeld: false }) : [];
  if (_agendaSources.length) {
    p += '【常朝候选来源池——只作议题线索，禁止原文照搬为奏报正文】\n' + _cc2_formatAgendaSourcesForPrompt(_agendaSources, 18) + '\n';
  } else if (GM.currentIssues) {
    var _pi = GM.currentIssues.filter(function(i){return i.status==='pending';}).slice(0,5);
    if (_pi.length) p += '【待处理时政——只作议题线索，禁止原文照搬为奏报正文】\n' + _pi.map(function(i){return '  '+i.title+'：要点 '+(i.description||i.summary||i.brief||'').slice(0,42)+'；须改写为有司奏称';}).join('\n') + '\n';
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
  p += '· 从“常朝候选来源池”多源轮换取材；若候选池有三类以上来源，议程至少覆盖三类，不得全部来自御案时政\n';
  p += '· 百官奏疏、朱批奏疏、陛下诏令、主角行止、近事起居、鸿雁来书、政斗弹劾、外部势力、内政事务、留中续议有具体条目时，优先穿插取材\n';
  p += '· currentIssues 只是“御案时政”来源之一；不得把御案时政当作常朝唯一议题池\n';
  p += '· content 字段必须遵守朝议字数（仅 announceLine 可简略），百官奏报须行文详尽\n';
  p += '返回 JSON 数组。';
  return p;
}

// ─── 议程兜底·AI 调用失败/返回空时·从时政要务派生最小议程·让朝会能跑完 ───
function _cc2_fallbackAgenda() {
  var items = [];
  var pool = (typeof _cc2_collectAgendaSources === 'function') ? _cc2_collectAgendaSources({ max: 12, includeHeld: true }) : [];
  var picked = (typeof _cc2_pickAgendaSourcesForCourt === 'function') ? _cc2_pickAgendaSourcesForCourt(pool, 5) : pool.slice(0, 5);
  picked.forEach(function(src, idx) { items.push(_cc2_agendaSourceToItem(src, idx)); });
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
