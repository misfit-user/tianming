// ── 章节导航（grep 小节标题跳转，行号会漂）──
//   御案·起草面板 + desk overlay + 诏书/奏疏/书信/记录/朝政时政预览面板（Wave 4·从 bridge 拆出）
//   §1 alias 块       cross-closure helpers from bridge._xxx
//   §2 late-bound     wrappers（orchestration calls into bridge）
//   §3 module body    迁入主体（body 0 改动）：拟诏/主角行止 tab · 三栏主体
//   §4 御案 CSS       纳入选类菜单/有司润色卡/议事清册卡 优先级修正 + footer 布局修
//   §5 attach         public API + re-attach bridge.X / window.* 导出
// ─────────────────────────────────────────────
// phase8-formal-drafts.js·起草面板·desk overlay·CSS·诏书/奏疏/书信/记录/朝政时政预览面板
// split from phase8-formal-bridge.js·2026-05-26·Wave 4
// paradigm·head alias 块·body 0 改动·跨闭包 helper 通过 bridge._xxx + late-bound wrapper

(function(){
  'use strict';

  var bridge = window.TMPhase8FormalBridge;
  if (!bridge) {
    console.error('[phase8-formal-drafts] TMPhase8FormalBridge not init·bridge.js 必须先 load');
    return;
  }

  var state = bridge._state || window.TM_PHASE8_FORMAL;

  // ── alias 块 (cross-closure helpers from bridge._xxx) ──────────────
  var esc = bridge._esc;
  var attr = bridge._attr;
  var asset = bridge._asset;
  var fmtNum = bridge._fmtNum;
  var miniRows = bridge._miniRows;
  var actionButton = bridge._actionButton;
  var moduleShell = bridge._moduleShell;
  var dossierRows = bridge._dossierRows;
  var ownerKey = bridge._ownerKey;
  var ownerName = bridge._ownerName;
  var findFaction = bridge._findFaction;
  var findPerson = bridge._findPerson;
  var personKey = bridge._personKey;
  var personNameKey = bridge._personNameKey;
  var getPeople = bridge._getPeople;
  var getMapData = bridge._getMapData;
  var getParties = bridge._getParties;
  var getClasses = bridge._getClasses;
  var collectRecentEvents = bridge._collectRecentEvents;
  var getTurnText = bridge._getTurnText;
  var firstArray = bridge._firstArray;
  // actionBtn/actionChip/renderActionStats 用本文件内的本地 function 实现 (见下文)·
  // 不再引 bridge._* shim——该 shim 委托 bridge.drafts.* 而此导出此前缺失·导致全家返回空串·
  // 遣使送出/准奏/留中等按钮渲染空 (修复 2026-05-29)·本地实现末尾导出到 bridge.drafts 供 records/rightrail/bridge 的 shim 解析
  var compactText = bridge._compactText;
  var getMemorials = bridge._getMemorials;
  var getIssues = bridge._getIssues;
  var getLetters = bridge._getLetters;
  var getActiveScenario = bridge._getActiveScenario;
  var getArmies = bridge._getArmies;
  var issueIsResolved = bridge._issueIsResolved;
  var tmfRenwuPortrait = bridge._tmfRenwuPortrait;
  var fullHongyanText = bridge._fullHongyanText;
  var toast = bridge._toast;
  var cssEscape = bridge._cssEscape;
  var clearFormalDraftStore = bridge._clearFormalDraftStore;

  // ── late-bound wrappers (orchestration calls into bridge) ──────────
  function openPanel(slot){ return bridge.openPanel(slot); }
  function openModule(kind, opts){ return bridge.openModule(kind, opts); }
  function openGuoku(){ return bridge.openGuoku(); }
  function openChaoyiMode(mode){ return bridge._openChaoyiMode(mode); }
  function openShizhengPreviewPanel(){ return bridge._openShizhengPreviewPanel(); }
  function closeModule(){ return bridge._closeModule(); }
  function returnFormalHomeSoon(){ return bridge._returnFormalHomeSoon(); }
  var deskDraftCaptureDepth = 0;
  function saveFormalDraftsToGM(captureOpen){
    if (deskDraftCaptureDepth) return;
    return bridge._saveFormalDraftsToGM(captureOpen);
  }
  function restoreFormalDraftsFromGM(force){ return bridge._restoreFormalDraftsFromGM(force); }
  function handleModuleAction(action, data){ return bridge._handleModuleAction(action, data); }
  function updateRailBadges(){ return bridge._updateRailBadges(); }
  function renderEventFeed(){ return bridge._renderEventFeed(); }

  // ── module body (P3 Wave 4 迁入·1959 行·body 0 改动) ─────────────

  function installDeskPanelExactStyles(){
    var st = document.getElementById('tm-phase8-desk-panel-style');
    if (!st) {
      st = document.createElement('style');
      st.id = 'tm-phase8-desk-panel-style';
      document.head.appendChild(st);
    }
    var __css = [
      'body.tm-phase8-formal .tm-desk-overlay{position:fixed;inset:0;z-index:10020;background:rgba(8,6,4,.65);display:flex;align-items:center;justify-content:center;color:#eadfbd;font-family:"STKaiti","KaiTi","楷体",serif;}',
      'body.tm-phase8-formal .tm-desk-panel{width:min(1120px,92vw);height:min(780px,86vh);display:flex;flex-direction:column;border:1px solid rgba(201,160,69,.46);background:linear-gradient(180deg,rgba(28,21,15,.98),rgba(9,7,6,.98));box-shadow:0 22px 80px rgba(0,0,0,.72);color:#eadfbd;overflow:hidden;}',
      'body.tm-phase8-formal .tm-desk-head{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:12px 16px;border-bottom:1px solid rgba(201,160,69,.22);background:rgba(0,0,0,.24);}',
      'body.tm-phase8-formal .tm-desk-head h2{margin:0;color:#f2d98d;font-size:22px;letter-spacing:.20em;font-weight:500;}',
      'body.tm-phase8-formal .tm-desk-head p{margin:4px 0 0;color:rgba(232,220,187,.55);font-size:12px;letter-spacing:.08em;}',
      'body.tm-phase8-formal .tm-desk-close{width:34px;height:34px;border:1px solid rgba(201,160,69,.34);background:rgba(0,0,0,.28);color:#eadfbd;cursor:pointer;}',
      'body.tm-phase8-formal .tm-desk-body{flex:1;min-height:0;display:grid;grid-template-columns:260px minmax(0,1fr) 300px;gap:12px;padding:12px;overflow:hidden;}',
      'body.tm-phase8-formal .tm-desk-pane{min-height:0;border:1px solid rgba(201,160,69,.18);background:linear-gradient(180deg,rgba(255,245,210,.045),rgba(0,0,0,.16));overflow:auto;scrollbar-color:rgba(201,160,69,.48) rgba(0,0,0,.24);}',
      'body.tm-phase8-formal .tm-desk-pane.pad{padding:12px;}',
      'body.tm-phase8-formal .tm-desk-tabs{display:flex;gap:6px;padding:8px;border-bottom:1px solid rgba(201,160,69,.16);background:rgba(0,0,0,.18);}',
      'body.tm-phase8-formal .tm-desk-tab{border:1px solid rgba(201,160,69,.20);background:rgba(0,0,0,.20);color:rgba(235,222,188,.72);height:30px;padding:0 10px;cursor:pointer;font-family:inherit;}',
      'body.tm-phase8-formal .tm-desk-tab.active{color:#f7dda0;border-color:rgba(213,103,73,.46);background:linear-gradient(180deg,rgba(106,43,30,.70),rgba(35,20,14,.82));}',
      'body.tm-phase8-formal .tm-desk-list{display:flex;flex-direction:column;gap:7px;padding:10px;}',
      'body.tm-phase8-formal .tm-desk-item{width:100%;text-align:left;border:1px solid rgba(201,160,69,.16);background:rgba(0,0,0,.18);color:#eadfbd;padding:9px 10px;cursor:pointer;font-family:inherit;}',
      'body.tm-phase8-formal .tm-desk-item b{display:block;color:#f2d98d;font-size:14px;letter-spacing:.08em;}',
      'body.tm-phase8-formal .tm-desk-item span{display:block;margin-top:4px;color:rgba(232,220,187,.55);font-size:12px;line-height:1.45;}',
      'body.tm-phase8-formal .tm-desk-item.hot{border-color:rgba(198,78,55,.38);box-shadow:inset 3px 0 rgba(198,78,55,.36);}',
      'body.tm-phase8-formal .tm-desk-title{margin:0 0 10px;color:#f2d98d;font-size:18px;letter-spacing:.14em;}',
      'body.tm-phase8-formal .tm-desk-subtitle{margin:12px 0 7px;color:#d8bd76;font-size:13px;letter-spacing:.12em;}',
      'body.tm-phase8-formal .tm-desk-field{display:grid;grid-template-columns:76px minmax(0,1fr);gap:8px;align-items:center;margin-bottom:8px;color:rgba(232,220,187,.68);font-size:12px;}',
      'body.tm-phase8-formal .tm-desk-field input,body.tm-phase8-formal .tm-desk-field select,body.tm-phase8-formal .tm-desk-pane textarea,body.tm-phase8-formal .tm-desk-input{width:100%;box-sizing:border-box;border:1px solid rgba(201,160,69,.20);background:rgba(0,0,0,.22);color:#eadfbd;padding:8px;font-family:inherit;}',
      'body.tm-phase8-formal .tm-desk-pane textarea{min-height:170px;line-height:1.7;resize:vertical;}',
      'body.tm-phase8-formal .tm-desk-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;}',
      'body.tm-phase8-formal .tm-desk-stat{border:1px solid rgba(201,160,69,.16);background:rgba(0,0,0,.18);padding:8px;}',
      'body.tm-phase8-formal .tm-desk-stat span{display:block;color:rgba(232,220,187,.52);font-size:12px;}',
      'body.tm-phase8-formal .tm-desk-stat b{display:block;color:#f2d98d;font-size:15px;margin-top:3px;}',
      'body.tm-phase8-formal .tm-desk-row{display:grid;grid-template-columns:88px minmax(0,1fr);gap:8px;padding:7px 0;border-bottom:1px solid rgba(201,160,69,.10);font-size:12px;}',
      'body.tm-phase8-formal .tm-desk-row span{color:rgba(232,220,187,.50);}',
      'body.tm-phase8-formal .tm-desk-row b{color:#eadfbd;font-weight:400;}',
      'body.tm-phase8-formal .tm-desk-actions{display:flex;flex-wrap:wrap;gap:7px;margin-top:10px;}',
      'body.tm-phase8-formal .tm-desk-btn{min-height:30px;border:1px solid rgba(201,160,69,.24);background:rgba(18,13,10,.78);color:#eadfbd;padding:5px 10px;cursor:pointer;font-family:inherit;letter-spacing:.06em;}',
      'body.tm-phase8-formal .tm-desk-btn.primary{border-color:rgba(213,103,73,.52);background:linear-gradient(180deg,rgba(126,45,32,.86),rgba(58,25,18,.92));color:#ffe1ac;}',
      'body.tm-phase8-formal .tm-desk-card{border:1px solid rgba(201,160,69,.16);background:rgba(0,0,0,.15);padding:9px 10px;margin-bottom:8px;}',
      'body.tm-phase8-formal .tm-desk-card b{display:block;color:#f2d98d;font-size:13px;}',
      'body.tm-phase8-formal .tm-desk-card p{margin:6px 0 0;color:rgba(232,220,187,.68);font-size:12px;line-height:1.6;}',
      'body.tm-phase8-formal .tm-desk-table{width:100%;border-collapse:collapse;font-size:12px;}',
      'body.tm-phase8-formal .tm-desk-table th,body.tm-phase8-formal .tm-desk-table td{border:1px solid rgba(201,160,69,.13);padding:7px 8px;text-align:left;}',
      'body.tm-phase8-formal .tm-desk-table th{color:#f2d98d;background:rgba(0,0,0,.22);font-weight:400;}',
      'body.tm-phase8-formal .tm-desk-empty{padding:14px;color:rgba(232,220,187,.55);font-size:12px;line-height:1.7;}',
      'body.tm-phase8-formal .tm-desk-panel[data-kind="records"] .tm-desk-body{grid-template-columns:230px minmax(0,1fr) 320px;}',
      '@media (max-width:1200px){body.tm-phase8-formal .tm-desk-body{grid-template-columns:220px minmax(0,1fr)}body.tm-phase8-formal .tm-desk-pane.side{display:none;}}'
    ].join('\n'); if (st.__tmCss !== __css) { st.__tmCss = __css; st.textContent = __css; }
  }

  function closeDeskOverlay(){
    var nodes = document.querySelectorAll('.tm-desk-overlay');
    Array.prototype.forEach.call(nodes, function(n){
      captureDeskOverlayState(n);
      n.remove();
    });
  }

  function deskPanelShell(kind, title, sub, left, main, right){
    installDeskPanelExactStyles();
    return '<section class="tm-desk-panel" data-kind="' + attr(kind) + '" role="dialog" aria-label="' + attr(title) + '">' +
      '<header class="tm-desk-head"><div><h2>' + esc(title) + '</h2><p>' + esc(sub || '') + '</p></div><button type="button" class="tm-desk-close" data-close-bridge="1">×</button></header>' +
      '<div class="tm-desk-body"><aside class="tm-desk-pane">' + left + '</aside><main class="tm-desk-pane pad">' + main + '</main><aside class="tm-desk-pane pad side">' + right + '</aside></div>' +
      '</section>';
  }

  function openDeskOverlay(id, html){
    closeModule();
    closeDeskOverlay();
    var ov = document.createElement('div');
    ov.id = id;
    ov.className = 'tm-desk-overlay tm-bridge-overlay show';
    ov.innerHTML = '<div class="tm-bridge-scrim" data-close-bridge="1"></div>' + html;
    var overlayWorld = window.GM;
    ov.addEventListener('click', function(e){
      if (e.target === ov || (e.target && e.target.closest && e.target.closest('[data-close-bridge]'))) {
        closeDeskOverlay();
        return;
      }
      if (e.target && e.target.closest && e.target.closest('[data-desk-edict-archive]')) {
        if (window.GM !== overlayWorld) return;
        var archive = ov.querySelector('.arc-modal');
        var archiveBody = ov.querySelector('.arc-body');
        if (archive && archiveBody) {
          var archiveScroll = archiveBody.scrollTop;
          archiveBody.innerHTML = renderFormalEdictArchive();
          archive.classList.add('show');
          archiveBody.scrollTop = archiveScroll;
        }
        return;
      }
      var btn = e.target && e.target.closest ? e.target.closest('[data-desk-action],[data-module-action]') : null;
      if (!btn) return;
      handleDeskAction(btn.dataset.deskAction || btn.dataset.moduleAction, btn.dataset, id);
    });
    ov.addEventListener('input', function(e){
      var search = e.target && e.target.closest ? e.target.closest('[data-desk-letter-search]') : null;
      if (search) {
        state.letterSearch = String(search.value || '');
        applyFormalLetterSearch(ov, state.letterSearch);
        saveFormalDraftsToGM(false);
        return;
      }
      var recordSearch = e.target && e.target.closest ? e.target.closest('[data-desk-record-search]') : null;
      if (recordSearch) {
        state.recordSearch = String(recordSearch.value || '');
        if (e && e.isComposing) return; // 输入法合成中·待 compositionend 再检索·避免打断中文输入
        clearTimeout(window._tmShiSearchTimer);
        window._tmShiSearchTimer = setTimeout(function(){
          openShiluPreviewPanel(); // v4 跨库检索：重渲整面板（shiMain 按 recordSearch 走 shiSearchView 遍检四库）
          try { var inp = document.querySelector('#tm-action-records-overlay [data-desk-record-search]'); if (inp) { inp.focus(); var v = inp.value || ''; inp.setSelectionRange(v.length, v.length); } } catch(_) {}
        }, 200);
        return;
      }
      var draft = e.target && e.target.closest ? e.target.closest('[data-letter-draft-field]') : null;
      if (draft) {
        updateFormalLetterDraft(draft);
        return;
      }
      var memorialReply = e.target && e.target.closest ? e.target.closest('[data-desk-memorial-reply]') : null;
      if (memorialReply) {
        updateFormalMemorialReply(memorialReply);
        return;
      }
      var edict = e.target && e.target.closest ? e.target.closest('[data-desk-edict-cat],[data-desk-edict-body],[data-desk-player-action],#edict-pol,#edict-mil,#edict-dip,#edict-eco,#edict-oth,#xinglu-pub') : null;
      if (edict) updateFormalEdictDraft(edict);
    });
    ov.addEventListener('change', function(e){
      var draft = e.target && e.target.closest ? e.target.closest('[data-letter-draft-field]') : null;
      if (draft) {
        updateFormalLetterDraft(draft);
        return;
      }
      var memorialReply = e.target && e.target.closest ? e.target.closest('[data-desk-memorial-reply]') : null;
      if (memorialReply) {
        updateFormalMemorialReply(memorialReply);
        return;
      }
      var edict = e.target && e.target.closest ? e.target.closest('[data-desk-edict-cat],[data-desk-edict-body],[data-desk-player-action],#edict-pol,#edict-mil,#edict-dip,#edict-eco,#edict-oth,#xinglu-pub') : null;
      if (edict) updateFormalEdictDraft(edict);
    });
    document.body.appendChild(ov);
    if (id === 'tm-action-letter-overlay') applyFormalLetterSearch(ov, state.letterSearch || '');
    if (id === 'tm-action-records-overlay') applyFormalRecordSearch(ov, state.recordSearch || '');
  }

  function deskGM(){
    if (!window.GM) window.GM = {};
    return window.GM;
  }

  function deskArray(obj, key){
    if (!obj[key] || !Array.isArray(obj[key])) obj[key] = [];
    return obj[key];
  }

  function deskValue(selector, fallback){
    var root = document.querySelector('.tm-desk-overlay');
    var el = root && root.querySelector(selector);
    if (!el) return fallback || '';
    return String(el.value == null ? (fallback || '') : el.value).trim();
  }

  function updateFormalLetterDraft(el){
    if (!el || !el.dataset) return;
    var key = el.dataset.letterDraftField;
    if (!key) return;
    var draft = state.letterDraft || {};
    draft[key] = String(el.value == null ? '' : el.value);
    state.letterDraft = draft;
    saveFormalDraftsToGM(false);
  }

  function updateFormalMemorialReply(el){
    if (!el) return;
    var key = (el.getAttribute && (el.getAttribute('data-memorial-reply-id') || el.getAttribute('id'))) || '';
    if (!key) return;
    state.memorialReplies = state.memorialReplies || {};
    state.memorialReplies[key] = String(el.value == null ? '' : el.value);
    saveFormalDraftsToGM(false);
  }

  function updateFormalEdictDraft(el){
    if (!el) return;
    var value = String(el.value == null ? '' : el.value);
    if (el.id && /^edict-/.test(el.id)) {
      syncFormalEdictDraft(el.id, value);
    }
    var cat = el.getAttribute && el.getAttribute('data-desk-edict-cat');
    if (cat) {
      state.edictDrafts = state.edictDrafts || {};
      state.edictDrafts[cat] = value;
      if (cat === 'finance') state.edictDrafts.economic = value;
      if (cat === 'other') state.edictDrafts.private = value;
    }
    if ((el.id === 'xinglu-pub') || (el.hasAttribute && el.hasAttribute('data-desk-player-action'))) {
      state.playerAction = value;
    }
    if (el.hasAttribute && el.hasAttribute('data-desk-edict-body')) {
      state.edictDraft = value.split(/\n+/).map(function(x){ return x.trim(); }).filter(Boolean);
    }
    saveFormalDraftsToGM(false);
  }

  function captureDeskOverlayState(root){
    if (!root || !root.querySelectorAll) return;
    // Collect all fields before cloning/publishing the same aggregate once.
    // Ordinary input/change still persists immediately; nesting and errors must
    // not leave later input trapped in a suspended-persistence state.
    deskDraftCaptureDepth++;
    try {
      Array.prototype.forEach.call(root.querySelectorAll('[data-letter-draft-field]'), updateFormalLetterDraft);
      Array.prototype.forEach.call(root.querySelectorAll('[data-desk-memorial-reply]'), updateFormalMemorialReply);
      Array.prototype.forEach.call(root.querySelectorAll('[data-desk-edict-cat],[data-desk-edict-body],[data-desk-player-action],#edict-pol,#edict-mil,#edict-dip,#edict-eco,#edict-oth,#xinglu-pub'), updateFormalEdictDraft);
    } finally {
      deskDraftCaptureDepth--;
    }
    saveFormalDraftsToGM(false);
  }

  function applyFormalLetterSearch(root, value){
    root = root || document;
    var q = String(value || '').trim().toLowerCase();
    var any = false;
    Array.prototype.forEach.call(root.querySelectorAll('[data-letter-search-text]'), function(row){
      var hay = String(row.getAttribute('data-letter-search-text') || '').toLowerCase();
      var show = !q || hay.indexOf(q) >= 0;
      row.style.display = show ? '' : 'none';
      if (show) any = true;
    });
    Array.prototype.forEach.call(root.querySelectorAll('.hy-region-group-v5'), function(group){
      var has = false;
      Array.prototype.forEach.call(group.querySelectorAll('[data-letter-search-text]'), function(row){
        if (row.style.display !== 'none') has = true;
      });
      group.style.display = has ? '' : 'none';
    });
    var empty = root.querySelector('.hy-search-empty-v5');
    if (empty) empty.style.display = any ? 'none' : '';
  }

  function applyFormalRecordSearch(root, value){
    // openDeskOverlay 重建 DOM 后调用以恢复搜索态。v4 史册库的跨库检索由 renderFormalRecordsPanel 按 state.recordSearch 重渲实现，
    // 此处仅作旧式局部过滤兜底（对 v4 新 DOM 无匹配元素即 no-op）。严禁在此触发重渲——会与 openDeskOverlay 形成无限递归。
    root = root || document;
    var q = String(value || '').trim().toLowerCase();
    var any = false;
    Array.prototype.forEach.call(root.querySelectorAll('[data-record-search-text]'), function(row){
      var hay = String(row.getAttribute('data-record-search-text') || '').toLowerCase();
      var show = !q || hay.indexOf(q) >= 0;
      row.style.display = show ? '' : 'none';
      if (show) any = true;
    });
    Array.prototype.forEach.call(root.querySelectorAll('[data-record-group]'), function(group){
      var has = false;
      Array.prototype.forEach.call(group.querySelectorAll('[data-record-search-text]'), function(row){
        if (row.style.display !== 'none') has = true;
      });
      group.style.display = has ? '' : 'none';
    });
    var empty = root.querySelector('.records-search-empty-v5');
    if (empty) empty.style.display = any ? 'none' : '';
  }

  function deskDateText(turn){
    try {
      if (typeof window.getTSText === 'function') return window.getTSText(turn || (window.GM && GM.turn) || 1);
    } catch(_) {}
    return getTurnText(turn || (window.GM && GM.turn) || 1);
  }

  function deskId(prefix){
    try {
      if (typeof window.uid === 'function') return window.uid();
    } catch(_) {}
    return prefix + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  }

  function deskRefreshLegacy(){
    ['renderMemorials','renderLetterPanel','renderJishi','renderQiju','renderBiannian','renderGameState'].forEach(function(name){
      try { if (typeof window[name] === 'function') window[name](); } catch(_) {}
    });
    try { renderEventFeed(); } catch(_) {}
    try { updateRailBadges(); } catch(_) {}
  }

  function deskRemember(name, text, emotion, importance){
    if (!name || !text) return;
    try {
      if (window.NpcMemorySystem && typeof NpcMemorySystem.remember === 'function') {
        NpcMemorySystem.remember(name, text, emotion || '平', importance || 5, (window.P && P.playerInfo && P.playerInfo.characterName) || '陛下');
      }
    } catch(_) {}
  }

  function deskDecision(category, desc, consequence){
    try {
      if (typeof window.recordPlayerDecision === 'function') {
        window.recordPlayerDecision(category, desc, consequence || '');
      }
    } catch(_) {}
  }

  function emitDeskPlayerActionSignal(payload){
    var recorded = false;
    try {
      if (window.TM && TM.PlayerActionSignals && typeof TM.PlayerActionSignals.record === 'function') {
        TM.PlayerActionSignals.record(GM, payload);
        recorded = true;
      }
    } catch (_) {}
    try {
      if (window.TM && TM.PartyClassLlmCalibrator && typeof TM.PartyClassLlmCalibrator.notifyPlayerAction === 'function') {
        TM.PartyClassLlmCalibrator.notifyPlayerAction(Object.assign({}, payload, { skipSignalRecord: recorded }));
      }
    } catch (_) {}
  }

  function recordDeskActionSignal(action, data, extraText, options){
    try {
      if (!window.GM) return null;
      data = data || {};
      options = options || {};
      var text = [
        'formal-desk',
        action,
        extraText,
        data.buttonText,
        data.ariaLabel,
        data.id,
        data.decision,
        data.choice,
        data.topic,
        data.target,
        data.name,
        data.letterType,
        data.urgency,
        data.sendMode
      ].filter(Boolean).join(' ');
      var payload = {
        root: GM,
        source: 'phase8-desk',
        action: action || '',
        kind: options.kind || data.kind || action || '',
        topic: options.topic || data.topic || data.title || data.buttonText || '',
        target: options.target || data.target || data.name || '',
        targetId: options.targetId || data.targetId || data.id || data.name || '',
        decision: options.decision || data.decision || '',
        linkedIssue: options.linkedIssue || data.linkedIssue || data.issueId || data.chaoyiTrackId || '',
        text: text,
        intensity: options.intensity,
        policyTags: options.policyTags || null,
        evidence: [data.buttonText, data.ariaLabel, options.evidence, extraText].filter(Boolean),
        mirrorSocialPolitical: options.mirrorSocialPolitical
      };
      emitDeskPlayerActionSignal(payload);
      return payload;
    } catch (_) {
      return null;
    }
  }

  function recordDeskCrisisSurfaceResponse(payload, source){
    try {
      if (!window.GM || !window.AuthorityComplete || typeof window.AuthorityComplete.handleCrisisSurfaceResponse !== 'function') return null;
      payload = payload || {};
      return window.AuthorityComplete.handleCrisisSurfaceResponse(payload, {
        turn: GM.turn || 1,
        source: source || 'phase8-desk'
      });
    } catch (_) {
      return null;
    }
  }

  function deskRecord(type, title, text, tags){
    var gm = deskGM();
    var turn = Number(gm.turn || 1);
    var date = deskDateText(turn);
    var full = String(text || title || '').replace(/\r\n/g, '\n').trim();
    var summary = compactText(full || title || '', 240);
    if (!full && !summary) return;
    deskArray(gm, 'qijuHistory').unshift({
      turn: turn,
      date: date,
      content: '【' + type + '】' + full,
      text: '【' + type + '】' + full,
      fullText: '【' + type + '】' + full,
      rawText: full,
      summary: '【' + type + '】' + summary,
      category: type,
      tags: tags || [type]
    });
    deskArray(gm, '_chronicle').push({
      turn: turn,
      date: date,
      type: type,
      title: title || type,
      text: full,
      content: full,
      fullText: full,
      summary: summary,
      tags: tags || [type]
    });
    if (window.EB && Array.isArray(EB.items)) {
      EB.items.unshift({ turn: turn, date: date, type: type, title: title || type, text: summary, summary: summary, detail: full, content: full, fullText: full });
      if (EB.items.length > 120) EB.items.length = 120;
    } else {
      try { if (typeof window.addEB === 'function') window.addEB(type, summary); } catch(_) {}
    }
  }

  function recordDeskPlayerActionHistory(gm, text, options){
    gm = gm || deskGM();
    options = options || {};
    var actionText = String(text || '').replace(/\r\n/g, '\n').trim();
    if (!actionText) return null;
    var turn = Number(gm.turn || 1);
    var date = deskDateText(turn);
    var tags = ['主角行止', '行止'].concat(options.tags || []);
    var summary = compactText(actionText, 240);
    var entry = {
      turn: turn,
      date: date,
      content: '【主角行止】' + actionText,
      text: '【主角行止】' + actionText,
      fullText: '【主角行止】' + actionText,
      rawText: actionText,
      summary: '【主角行止】' + summary,
      category: '行止',
      tags: tags,
      xinglu: actionText,
      source: 'phase8-desk'
    };
    deskArray(gm, 'qijuHistory').unshift(entry);
    if (gm.qijuHistory.length > 240) gm.qijuHistory.length = 240;
    deskArray(gm, '_chronicle').push({
      turn: turn,
      date: date,
      type: '行止',
      title: '主角行止',
      text: actionText,
      content: actionText,
      fullText: actionText,
      summary: summary,
      tags: tags,
      xinglu: actionText,
      source: 'phase8-desk'
    });
    if (window.EB && Array.isArray(EB.items)) {
      EB.items.unshift({ turn: turn, date: date, type: '行止', title: '主角行止', text: summary, summary: summary, detail: actionText, content: actionText, fullText: actionText });
      if (EB.items.length > 120) EB.items.length = 120;
    } else {
      try { if (typeof window.addEB === 'function') window.addEB('行止', summary); } catch(_) {}
    }
    return entry;
  }

  function deskPublishPlayerActionOnly(gm, actionText){
    actionText = String(actionText || '').trim();
    if (!actionText) return false;
    recordDeskPlayerActionHistory(gm, actionText);
    deskDecision('player_action', actionText, '已记入主角行止，过回合推演会读取其人物、皇威、民心影响');
    recordDeskActionSignal('player-action-desk', {
      id: 'xinglu-' + (gm.turn || 1),
      topic: '主角行止',
      target: '起居注',
      targetId: 'xinglu-' + (gm.turn || 1),
      kind: 'player_action'
    }, actionText, {
      kind: 'player_action',
      topic: '主角行止',
      target: '起居注',
      targetId: 'xinglu-' + (gm.turn || 1),
      intensity: 0.72,
      policyTags: ['xinglu', 'player-action']
    });
    recordDeskCrisisSurfaceResponse({
      channel: 'player_action',
      text: actionText,
      topic: 'player action',
      targetId: 'xinglu-' + (gm.turn || 1)
    }, 'phase8-player-action');
    state.playerAction = '';
    clearFormalDraftStore(['playerAction']);
    deskRefreshLegacy();
    toast('主角行止已记入起居注，过回合会读取其人物、皇威、民心影响');
    openZhaoPreviewPanel();
    return true;
  }

  function deskEdictBodyValue(){
    var legacyCats = [
      { id:'edict-pol', key:'policy', label:'政令' },
      { id:'edict-mil', key:'military', label:'军令' },
      { id:'edict-dip', key:'diplomatic', label:'外交' },
      { id:'edict-eco', key:'finance', label:'经济' },
      { id:'edict-oth', key:'other', label:'其他' }
    ];
    var legacyParts = legacyCats.map(function(cat){
      var el = document.getElementById(cat.id);
      var body = el ? String(el.value || '').trim() : '';
      if (!state.edictDrafts) state.edictDrafts = {};
      state.edictDrafts[cat.key] = body;
      if (cat.id === 'edict-eco') state.edictDrafts.economic = body;
      if (cat.id === 'edict-oth') state.edictDrafts.private = body;
      if (!body) return '';
      return '【' + cat.label + '】\n' + body;
    }).filter(Boolean);
    if (legacyParts.length) return legacyParts.join('\n\n');
    var categoryRows = Array.prototype.slice.call(document.querySelectorAll('[data-desk-edict-cat]'));
    if (categoryRows.length) {
      var parts = categoryRows.map(function(el){
        var body = String(el.value || '').trim();
        if (!state.edictDrafts) state.edictDrafts = {};
        state.edictDrafts[el.getAttribute('data-desk-edict-cat') || 'policy'] = body;
        if (!body) return '';
        var label = el.getAttribute('data-label') || '诏令';
        return '【' + label + '】\n' + body;
      }).filter(Boolean);
      if (parts.length) return parts.join('\n\n');
    }
    return deskValue('[data-desk-edict-body]', '').trim();
  }

  function deskSaveEdictDraft(){
    var gm = deskGM();
    var body = deskEdictBodyValue();
    if (!body) { toast('请先写下诏令正文'); return false; }
    state.edictDraft = body.split(/\n+/).map(function(x){ return x.trim(); }).filter(Boolean);
    state.playerAction = deskValue('#xinglu-pub', deskValue('[data-desk-player-action]', state.playerAction || '')).trim();
    deskArray(gm, '_edictSuggestions').push({
      source: '御案草诏',
      from: (window.P && P.playerInfo && P.playerInfo.characterName) || '陛下',
      content: body,
      turn: gm.turn || 1,
      used: false
    });
    deskRecord('草诏', '御案草诏暂存', body, ['诏书','草稿']);
    deskDecision('edict', body, '暂存为诏书建议，待后续颁行或票拟');
    deskRefreshLegacy();
    toast('诏令已存入草诏与建议库');
    saveFormalDraftsToGM(true);
    return true;
  }

  function deskPublishEdict(){
    var gm = deskGM();
    var body = deskEdictBodyValue();
    state.playerAction = deskValue('#xinglu-pub', deskValue('[data-desk-player-action]', state.playerAction || '')).trim();
    if (!body) {
      if (deskPublishPlayerActionOnly(gm, state.playerAction)) return;
      toast('请先写下诏令正文');
      return;
    }
    var edictType = 'policy';
    try { if (typeof window.classifyEdict === 'function') edictType = window.classifyEdict(body) || edictType; } catch(_) {}
    var typeText = deskValue('[data-desk-edict-type]', '诏令') || '诏令';
    var receiver = deskValue('[data-desk-edict-receiver]', '内阁、六部、都察院') || '内阁、六部、都察院';
    var title = compactText(body.replace(/\s+/g, ' '), 32) || '御前诏令';
    var forecast = null;
    try { if (typeof window.generateEdictForecast === 'function') forecast = window.generateEdictForecast(edictType); } catch(_) {}
    var entry = {
      id: deskId('edict'),
      content: body,
      title: title,
      category: typeText,
      type: edictType,
      turn: gm.turn || 1,
      date: deskDateText(gm.turn || 1),
      status: 'pending',
      assignee: receiver,
      feedback: '',
      progressPercent: 0,
      source: 'phase8-desk',
      forecast: forecast && forecast.forecast ? forecast.forecast : ''
    };
    deskArray(gm, '_edictTracker').push(entry);
    deskRecord('诏令', title, body, ['诏书', typeText, edictType]);
    if (state.playerAction) {
      recordDeskPlayerActionHistory(gm, state.playerAction);
      recordDeskActionSignal('player-action-desk', {
        id: 'xinglu-' + entry.id,
        topic: '主角行止',
        target: '起居注',
        targetId: 'xinglu-' + entry.id,
        kind: 'player_action'
      }, state.playerAction, {
        kind: 'player_action',
        topic: '主角行止',
        target: '起居注',
        targetId: 'xinglu-' + entry.id,
        intensity: 0.72,
        policyTags: ['xinglu', 'player-action']
      });
      recordDeskCrisisSurfaceResponse({
        channel: 'player_action',
        text: state.playerAction,
        topic: 'player action',
        targetId: 'xinglu-' + entry.id
      }, 'phase8-edict-player-action');
    }
    deskDecision('edict', body, '已进入诏令追踪，后续过回合推演会读取执行与阻力');
    recordDeskActionSignal('publish-edict-desk', {
      id: entry.id,
      topic: title,
      target: receiver,
      targetId: entry.id
    }, [typeText, edictType, receiver, body, state.playerAction].filter(Boolean).join(' '), {
      kind: 'edict',
      topic: title,
      target: receiver,
      targetId: entry.id,
      intensity: 0.78,
      policyTags: ['edict']
    });
    recordDeskCrisisSurfaceResponse({
      channel: 'edict',
      text: [typeText, edictType, receiver, body, state.playerAction].filter(Boolean).join(' '),
      topic: title,
      target: receiver,
      targetId: entry.id
    }, 'phase8-publish-edict');
    state.edictDraft = [];
    state.edictDrafts = {};
    state.playerAction = '';
    clearFormalDraftStore(['edictDraft', 'edictDrafts', 'playerAction']);
    deskRefreshLegacy();
    toast('诏令已颁行，过回合会进入执行推演');
    openZhaoPreviewPanel();
  }

  function deskFindRawMemorial(id){
    var gm = deskGM();
    var list = firstArray(gm.memorials, gm.zoushu, gm.memorialQueue, gm.petitions, gm.recentMemorials);
    var sid = String(id || '');
    var parsed = /^mem-(\d+)$/.exec(sid);
    if (parsed && list[Number(parsed[1])]) return { raw: list[Number(parsed[1])], index: Number(parsed[1]), list: list };
    for (var i = 0; i < list.length; i++) {
      var x = list[i];
      if (!x) continue;
      var xid = String(x.id || ('mem-' + i));
      if (xid === sid) return { raw: x, index: i, list: list };
    }
    var issueMatch = /^issue-mem-(\d+)$/.exec(sid);
    if (issueMatch) {
      var issue = getIssues()[Number(issueMatch[1])];
      if (issue) {
        var created = {
          id: deskId('mem'),
          title: issue.title || '御案转奏',
          from: issue.proposer || '通政司',
          dept: issue.category || '御案时政',
          type: issue.category || '议题',
          content: issue.text || issue.narrative || issue.detail || '',
          text: issue.text || issue.narrative || issue.detail || '',
          status: 'pending',
          turn: (gm.turn || 1),
          _fromIssueId: issue.id || ''
        };
        var mems = deskArray(gm, 'memorials');
        mems.push(created);
        return { raw: created, index: mems.length - 1, list: mems };
      }
    }
    return null;
  }

  function deskStageMemorial(id, decision, replyId){
    var gm = deskGM();
    var found = deskFindRawMemorial(id);
    if (!found || !found.raw) { toast('未找到原奏疏记录'); return; }
    var m = found.raw;
    var replyEl = replyId ? document.getElementById(replyId) : null;
    var reply = (replyEl ? String(replyEl.value || '') : deskValue('[data-desk-memorial-reply]', '')) || '着有关衙门速核，限期具册。';
    if ((!replyEl || !String(replyEl.value || '').trim()) && replyId && state.memorialReplies && Object.prototype.hasOwnProperty.call(state.memorialReplies, replyId) && String(state.memorialReplies[replyId] || '').trim()) {
      reply = String(state.memorialReplies[replyId] || '').trim();
    }
    if (decision === 'hold') {
      m.status = 'pending_review';
      m.reply = reply || '再议';
      m._commitApplied = false;
    } else if (typeof window._stageMemorialDecision === 'function') {
      window._stageMemorialDecision(m, decision, reply);
    } else {
      // 批红通道未就绪(缺 _stageMemorialDecision mutator)·不裸写 m.status——旧直写丢皇权/EB/回传副作用·反致假批复
      toast('批红通道未就绪，暂无法批红');
      return;
    }
    // 发廷议·真接入廷议待议队列（旧行为：只设 status+toast，奏疏从不真付公议——此处补接，复用 _pendingTinyiTopics）
    try {
      if (!Array.isArray(gm._pendingTinyiTopics)) gm._pendingTinyiTopics = [];
      if (m._tinyiQueuedId) { // 改主意：此前已排廷议、现改别的决定 → 撤回队列项，避免陈旧议题滞留
        gm._pendingTinyiTopics = gm._pendingTinyiTopics.filter(function(x){ return !x || x._memTinyiId !== m._tinyiQueuedId; });
        m._tinyiQueuedId = '';
      }
      if (decision === 'court_debate') {
        var _qid = 'mem_' + (m.id || id || (m.from || '')) + '_' + (gm.turn || 0);
        if (!gm._pendingTinyiTopics.some(function(x){ return x && x._memTinyiId === _qid; })) {
          gm._pendingTinyiTopics.unshift({
            topic: '奏疏议题·' + (m.from || '臣工') + '：' + compactText(m.content || m.text || m.body || m.title || '', 120),
            from: '奏疏发廷议', sourceType: 'memorial', turn: gm.turn || 1, status: 'pending', priority: 72,
            reason: reply || '着廷议', delegateCharacter: m.from || '', delegateCharacterId: m.from || '',
            linkedCharacters: m.from ? [m.from] : [], _memTinyiId: _qid, _memId: m.id || id || ''
          });
          if (gm._pendingTinyiTopics.length > 80) gm._pendingTinyiTopics = gm._pendingTinyiTopics.slice(0, 80);
          m._tinyiQueuedId = _qid;
        }
      }
    } catch(_memTinyiE) {}
    deskRecord('朱批', (m.title || m.topic || '奏疏批复'), (m.from || '臣工') + '所奏：' + compactText(m.content || m.text || m.body || '', 100) + '。朱批：' + reply, ['奏疏','朱批']);
    deskDecision('memorial', (m.from || '臣工') + '所奏：' + (m.title || m.topic || compactText(m.content || m.text || '', 30)), '决定：' + decision + '；过回合前奏疏提交器会落实记忆与回传');
    if (decision !== 'hold') deskRemember(m.from, '奏疏已得朱批：' + reply, decision === 'rejected' ? '忧' : '敬', 5);
    deskRefreshLegacy();
    toast(decision === 'approved' ? '已准奏，过回合前生效' : decision === 'rejected' ? '已驳回，过回合前生效' : decision === 'court_debate' ? '已发交廷议·候朝议公议' : decision === 'referred' ? '已转交有司' : decision === 'hold' ? '已留中' : '已批示');
    recordDeskActionSignal('memorial-decision-desk', {
      id: m.id || id || '',
      decision: decision || '',
      topic: m.title || m.topic || '',
      target: m.from || m.sender || '',
      targetId: m.id || id || '',
      linkedIssue: m._fromIssueId || m.issueId || m.linkedIssue || ''
    }, [reply, m.title, m.topic, m.from, m.sender, m.dept, m.office, m.type, m.content, m.text, m.body].filter(Boolean).join(' '), {
      kind: 'memorial',
      topic: m.title || m.topic || '',
      target: m.from || m.sender || '',
      targetId: m.id || id || '',
      linkedIssue: m._fromIssueId || m.issueId || m.linkedIssue || '',
      decision: decision || '',
      intensity: decision === 'hold' ? 0.35 : 0.74,
      policyTags: ['memorial', 'court']
    });
    try {
      if (window.TM && TM.MinxinPressureActions && typeof TM.MinxinPressureActions.recordPlayerResponse === 'function') {
        TM.MinxinPressureActions.recordPlayerResponse(gm, {
          channel: 'memorial',
          decision: decision || '',
          linkedIssue: m._minxinPressureActionId || m.linkedIssue || m.issueId || m._fromIssueId || '',
          actor: 'player',
          target: m.from || m.sender || '',
          text: [reply, m.title, m.topic, m.content, m.text, m.body].filter(Boolean).join(' ')
        }, {
          turn: gm.turn || 1,
          source: 'phase8-memorial-decision'
        });
      }
    } catch (_) {}
    recordDeskCrisisSurfaceResponse({
      channel: 'memorial',
      text: [reply, m.title, m.topic, m.content, m.text, m.body].filter(Boolean).join(' '),
      decision: decision || '',
      memoId: m.id || id || '',
      target: m.from || m.sender || '',
      targetName: m.targetName || m.target || '',
      caseId: m.caseId || '',
      revoltId: m.revoltId || '',
      troops: m.troops || m.strength || 0,
      crisisAction: m.crisisAction || m.authorityCrisisAction || null
    }, 'phase8-memorial-decision');
    if (replyId && state.memorialReplies) delete state.memorialReplies[replyId];
    saveFormalDraftsToGM(false);
    openYueZouPreviewPanel();
  }

  function deskMemorialToEdict(id){
    var found = deskFindRawMemorial(id);
    if (!found || !found.raw) { toast('未找到原奏疏记录'); return; }
    var m = found.raw;
    var selected = '';
    try { selected = String(window.getSelection ? window.getSelection().toString() : '').trim(); } catch(_) {}
    if (!selected) { toast('请先在奏疏正文中划选要摘入的文字'); return; }
    var gm = deskGM();
    deskArray(gm, '_edictSuggestions').push({
      source: '奏疏',
      from: m.from || '臣工',
      topic: m.title || m.topic || '',
      content: selected,
      turn: gm.turn || 1,
      used: false
    });
    toast('已摘入诏书建议库');
  }

  function deskTargetLetter(name){
    if (!name) return;
    var gm = deskGM();
    gm._pendingLetterTo = name;
    state.letterTarget = name;
    state.letterDraft = state.letterDraft || {};
    state.letterDraft.to = name;
    saveFormalDraftsToGM(false);
    openHongyanPreviewPanel();
  }

  function deskSendLetter(draftOnly){
    var gm = deskGM();
    Array.prototype.forEach.call(document.querySelectorAll('.tm-desk-overlay'), captureDeskOverlayState);
    var letterDraft = state.letterDraft || {};
    var singleTo = deskValue('[data-desk-letter-to]', (letterDraft.to || gm._pendingLetterTo || '')).trim();
    var selfName = (window.P && P.playerInfo && P.playerInfo.characterName) || '';
    // 群发·多收件人 (承接旧 _ltMultiMode/_ltMultiTargets)·群发态逐人各发一函·草稿态不群发·剔除自己
    var multiOn = !draftOnly && !!state.letterMultiMode && Array.isArray(state.letterMultiTargets) && state.letterMultiTargets.length > 0;
    var toList = (multiOn ? state.letterMultiTargets.slice() : [singleTo]).filter(function(n){ return n && !(selfName && n === selfName); });
    if (!toList.length) { toast(multiOn ? '群发名单为空（自己已剔除）' : (selfName && singleTo === selfName ? '不能自寄信函' : '请先选择收信人')); return; }
    var body = deskValue('[data-desk-letter-body]', letterDraft.body || '').trim();
    if (!body) { toast('请先写下书信正文'); return; }
    var letterType = deskValue('[data-desk-letter-type]', letterDraft.type || 'personal') || 'personal';
    var urgency = deskValue('[data-desk-letter-urgency]', letterDraft.urgency || 'normal') || 'normal';
    var cipher = deskValue('[data-desk-letter-cipher]', letterDraft.cipher || 'none') || 'none';
    var sendMode = deskValue('[data-desk-letter-sendmode]', letterDraft.sendMode || 'multi_courier') || 'multi_courier';
    // 信物/令牌校验·承接旧 sendLetter (征调令需虎符·密旨/正诏需玺印)·
    // 结算引擎按 letterType→needsToken + _tokenUsed 判"无符不从"(tm-hongyan-office.js _settleLettersAndTravel)·
    // 此前 desk 流程从不写 _tokenUsed → 征调令对忠诚<60 者永远被抗命且玩家无感知 (修复 2026-05-29)
    var LT_TYPES = window.LETTER_TYPES || {};
    var LT_TOKENS = window.LETTER_TOKENS || {};
    var tokenNeeded = (LT_TYPES[letterType] || {}).needsToken;
    var tokenUsed = '';
    if (tokenNeeded && typeof tokenNeeded === 'string') {
      var heldToken = (gm.items || []).some(function(it){ return it && (it.type === tokenNeeded || it.name === ((LT_TOKENS[tokenNeeded] || {}).label)); });
      if (heldToken) tokenUsed = tokenNeeded;
      else if (!draftOnly) toast('⚠ 未持有' + ((LT_TOKENS[tokenNeeded] || {}).label || '凭证') + '——对方可能疑诏不从');
    }
    // 正式诏令(征调令/正诏等)经中书门下·权臣(忠诚<30 且 野心>70)可阻挠·承接旧 sendLetter·status→blocked·卡片可"绕封锁·改密旨"破局
    var formalBlocked = false;
    if (!draftOnly && (LT_TYPES[letterType] || {}).formal && typeof window._ltFindPrimeMinister === 'function') {
      try {
        var primeMin = window._ltFindPrimeMinister();
        if (primeMin && (primeMin.loyalty || 50) < 30 && (primeMin.ambition || 50) > 70) {
          formalBlocked = true;
          toast('⚠ ' + (primeMin.name || '权臣') + '阻挠此诏令流转——可改用密旨绕过');
        }
      } catch(_) {}
    }
    var capital = gm._capital || '京城';
    var dpv = 30;
    try { if (typeof window._getDaysPerTurn === 'function') dpv = Math.max(1, Number(window._getDaysPerTurn()) || 30); } catch(_) {}
    var nowDay = (typeof window.getCurrentGameDay === 'function') ? window.getCurrentGameDay() : (((gm.turn || 1) - 1) * dpv);
    var typeLabel = letterTypeLabelFormal(letterType);
    var multiCount = toList.length > 1 ? toList.length : 0;
    toList.forEach(function(curTo){
      var ch = (typeof window.findCharByName === 'function') ? window.findCharByName(curTo) : findPerson(curTo);
      var toLoc = (ch && ch.location) || capital;
      var days = 5;
      try { if (typeof window.calcLetterDays === 'function') days = Math.max(1, Number(window.calcLetterDays(capital, toLoc, urgency)) || 5); } catch(_) {}
      if (sendMode === 'secret_agent') days = Math.ceil(days * 1.5);
      var deliveryTurns = Math.max(1, Math.ceil(days / dpv));
      var replyDays = days * 2 + 3;
      var replyTurns = Math.max(deliveryTurns + 1, Math.ceil(replyDays / dpv));
      var letter = {
        id: deskId(draftOnly ? 'ltr_draft' : 'ltr'),
        from: '玩家',
        to: curTo,
        fromLocation: capital,
        toLocation: toLoc,
        title: typeLabel + '·' + curTo,
        subjectLine: typeLabel,
        content: body,
        body: body,
        sentTurn: gm.turn || 1,
        deliveryTurn: draftOnly ? null : (gm.turn || 1) + deliveryTurns,
        replyTurn: draftOnly ? null : (gm.turn || 1) + replyTurns,
        _sentDay: nowDay,
        _deliveryDay: draftOnly ? null : nowDay + days,
        _replyDay: draftOnly ? null : nowDay + replyDays,
        _travelDays: draftOnly ? 0 : days,
        reply: '',
        status: draftOnly ? 'draft' : (formalBlocked ? 'blocked' : 'traveling'),
        urgency: urgency,
        letterType: letterType,
        _npcInitiated: false,
        _replyExpected: true,
        _cipher: cipher,
        _sendMode: sendMode,
        _tokenUsed: tokenUsed,
        _multiRecipients: multiCount || undefined,
        _source: 'phase8-desk'
      };
      deskArray(gm, 'letters').push(letter);
      if (!draftOnly && (letterType === 'military_order' || letterType === 'secret_decree' || letterType === 'formal_edict')) {
        deskArray(gm, '_edictTracker').push({
          content: body,
          category: letterType === 'military_order' ? '军令' : '政令',
          turn: gm.turn || 1,
          status: 'pending',
          source: 'letter',
          target: curTo,
          letterId: letter.id
        });
      }
      if (!draftOnly) {
        deskArray(gm, 'letters').forEach(function(l){
          if (l && l._npcInitiated && l.from === curTo && l._replyExpected && !l._playerReplied) {
            l._playerReplied = true;
            l._repliedTurn = gm.turn || 1;
            l._repliedByDesk = true;
          }
        });
        deskRemember(curTo, '收到御前鸿雁：' + compactText(body, 50), letterType === 'formal_edict' || letterType === 'military_order' ? '敬' : '平', 5);
      }
    });
    var toNames = toList.join('、');
    if (!draftOnly) {
      recordDeskActionSignal('letter-send-desk', {
        target: toNames,
        targetId: toNames,
        topic: typeLabel,
        letterType: letterType,
        urgency: urgency,
        sendMode: sendMode,
        cipher: cipher
      }, [toNames, typeLabel, letterUrgencyLabelFormal(urgency), letterCipherLabelFormal(cipher), letterSendModeLabelFormal(sendMode), body].filter(Boolean).join(' '), {
        kind: 'letter',
        topic: typeLabel,
        target: toNames,
        targetId: toNames,
        intensity: urgency === 'extreme' ? 0.82 : urgency === 'urgent' ? 0.7 : 0.56,
        policyTags: ['letter']
      });
      try {
        if (window.TM && TM.MinxinPressureActions && typeof TM.MinxinPressureActions.recordPlayerResponse === 'function') {
          TM.MinxinPressureActions.recordPlayerResponse(gm, {
            channel: 'hongyan',
            decision: 'sent',
            actor: 'player',
            target: toNames,
            to: toNames,
            text: [toNames, typeLabel, body].filter(Boolean).join(' ')
          }, {
            turn: gm.turn || 1,
            source: 'phase8-letter-send'
          });
        }
      } catch (_) {}
      try {
        if (window.TM && TM.MinxinResponsibilityChain && typeof TM.MinxinResponsibilityChain.recordPlayerIntervention === 'function') {
          TM.MinxinResponsibilityChain.recordPlayerIntervention(gm, {
            channel: 'hongyan',
            target: toNames,
            to: toNames,
            text: [toNames, typeLabel, body].filter(Boolean).join(' ')
          }, {
            turn: gm.turn || 1,
            source: 'phase8-letter-send'
          });
        }
      } catch (_) {}
      recordDeskCrisisSurfaceResponse({
        channel: 'hongyan',
        text: [toNames, typeLabel, letterUrgencyLabelFormal(urgency), letterCipherLabelFormal(cipher), letterSendModeLabelFormal(sendMode), body].filter(Boolean).join(' '),
        target: toNames,
        to: toNames,
        letterType: letterType,
        urgency: urgency,
        sendMode: sendMode,
        cipher: cipher,
        revoltId: letterDraft.revoltId || '',
        troops: letterDraft.troops || letterDraft.strength || 0,
        crisisAction: letterDraft.crisisAction || letterDraft.authorityCrisisAction || null
      }, 'phase8-letter-send');
    }
    if (!draftOnly && Array.isArray(gm.qijuHistory)) {
      gm.qijuHistory.unshift({ turn: gm.turn || 1, date: deskDateText(gm.turn || 1), content: '【鸿雁传书】遣' + letterUrgencyLabelFormal(urgency) + '致' + toNames + '（' + typeLabel + (cipher !== 'none' ? '·' + letterCipherLabelFormal(cipher) : '') + (multiCount ? '·群发' + multiCount + '函' : '') + '）。内容：' + body });
    }
    deskRecord('鸿雁', (draftOnly ? '草函' : '遣使') + '致' + toNames, body, ['鸿雁', typeLabel, letterUrgencyLabelFormal(urgency)]);
    deskDecision('letter', (draftOnly ? '草拟' : '遣使') + '致' + toNames + '：' + compactText(body, 80), draftOnly ? '保存为鸿雁草稿' : '进入 GM.letters，由驿递与回信系统结算');
    gm._pendingLetterTo = toList[0];
    state.letterDraft = state.letterDraft || {};
    state.letterDraft.to = toList[0];
    state.letterDraft.type = letterType;
    state.letterDraft.urgency = urgency;
    state.letterDraft.cipher = cipher;
    state.letterDraft.sendMode = sendMode;
    if (!draftOnly) state.letterDraft.body = '';
    if (multiOn) { state.letterMultiMode = false; state.letterMultiTargets = []; }
    saveFormalDraftsToGM(false);
    deskRefreshLegacy();
    toast(multiCount ? ('已群发 ' + multiCount + ' 函') : (draftOnly ? '鸿雁草稿已保存' : '信函已发出，驿递系统会继续结算'));
    openHongyanPreviewPanel();
  }

  function deskStoreLetterMemory(){
    var gm = deskGM();
    Array.prototype.forEach.call(document.querySelectorAll('.tm-desk-overlay'), captureDeskOverlayState);
    var letterDraft = state.letterDraft || {};
    var to = deskValue('[data-desk-letter-to]', (letterDraft.to || gm._pendingLetterTo || '')).trim();
    var body = deskValue('[data-desk-letter-body]', letterDraft.body || '').trim();
    if (!to || !body) { toast('请先写明人物与内容'); return; }
    deskRemember(to, '御前留记：' + compactText(body, 80), '平', 4);
    deskRecord('人物记忆', to, body, ['鸿雁','人物记忆']);
    deskRefreshLegacy();
    toast('已写入人物记忆');
  }

  function deskSelectRecord(id){
    state.recordId = id || '';
    openShiluPreviewPanel();
  }

  function deskArchiveRecord(kind){
    var gm = deskGM();
    var body = deskValue('[data-desk-record-body]', '').trim();
    if (!body) { toast('暂无可归档内容'); return; }
    var turn = gm.turn || 1;
    if (kind === 'jishi') {
      deskArray(gm, 'jishiRecords').push({ turn: turn, char: '史官', playerSaid: '收入纪事', npcSaid: body, mode: 'record', source: 'phase8-desk' });
    }
    deskRecord(kind === 'jishi' ? '纪事' : kind === 'biannian' ? '编年' : '实录', '史官归档', body, ['史官实录', kind]);
    deskDecision('event', '史官归档：' + compactText(body, 100), '进入' + (kind === 'jishi' ? '纪事' : kind === 'biannian' ? '编年' : '实录'));
    deskRefreshLegacy();
    toast(kind === 'jishi' ? '已编入纪事' : kind === 'biannian' ? '已转为编年' : '已收入实录');
    openShiluPreviewPanel();
  }

  function deskAnnotateRecord(id){
    var gm = deskGM();
    var m = String(id || '').match(/^qiju-(\d+)$/);
    if (!m || !Array.isArray(gm.qijuHistory) || !gm.qijuHistory[Number(m[1])]) {
      toast('只能给起居注条目添加御批');
      return;
    }
    var item = gm.qijuHistory[Number(m[1])];
    var done = function(text){
      if (text == null) return;
      item._annotation = String(text || '').trim();
      deskRefreshLegacy();
      toast(item._annotation ? '御批已写入起居注' : '御批已清空');
      openShiluPreviewPanel();
    };
    if (typeof window.showPrompt === 'function') {
      window.showPrompt('御批：', item._annotation || '', done);
    } else {
      done(window.prompt('御批：', item._annotation || ''));
    }
  }

  function deskToggleRecordStar(id){
    var gm = deskGM();
    var m = String(id || '').match(/^jishi-(\d+)$/);
    if (!m || !Array.isArray(gm.jishiRecords) || !gm.jishiRecords[Number(m[1])]) {
      toast('只能星标纪事条目');
      return;
    }
    var item = gm.jishiRecords[Number(m[1])];
    item._starred = !item._starred;
    deskRefreshLegacy();
    toast(item._starred ? '已标为要事' : '已取消星标');
    openShiluPreviewPanel();
  }

  function deskOpenShijiResult(id){
    var gm = deskGM();
    var m = String(id || '').match(/^shiji-(\d+)$/);
    var idx = m ? Number(m[1]) : -1;
    var sj = idx >= 0 && Array.isArray(gm.shijiHistory) ? gm.shijiHistory[idx] : null;
    if (!sj) {
      toast('未找到对应史记原卷');
      return;
    }
    if (typeof window.showTurnResult === 'function') {
      window.showTurnResult(sj.html || ('<div style="white-space:pre-wrap;line-height:1.8;">' + esc(sj.shizhengji || sj.turnSummary || '') + '</div>'), idx);
    } else {
      state.recordId = id || '';
      openShiluPreviewPanel();
    }
  }

  function handleDeskAction(action, data){
    if (action === 'close') {
      closeDeskOverlay();
    } else if (action === 'select-issue-desk') {
      state.shizhengIssue = data.id || '';
      openShizhengPreviewPanel();
    } else if (action === 'shizheng-filter-desk') {
      state.shizhengDeskFilter = data.filter || 'pending';
      state.shizhengIssue = '';
      openShizhengPreviewPanel();
    } else if (action === 'add-edict-desk') {
      var issue = getIssues().find(function(x){ return String(x.id) === String(data.id || ''); });
      if (!issue) return;
      state.edictDraft = state.edictDraft || [];
      state.edictDraft.push('就“' + issue.title + '”，着有关衙门会同详议，限期具奏。');
      openZhaoPreviewPanel();
    } else if (action === 'adopt-edict-suggestion-desk') {
      var suggestions = getEdictSuggestionRows();
      var pick = suggestions.find(function(x){ return String(x.id || '') === String(data.id || ''); }) || suggestions[Number(data.index || 0)];
      if (!pick) return;
      state.edictDrafts = state.edictDrafts || {};
      state.edictDrafts.policy = (state.edictDrafts.policy ? state.edictDrafts.policy + '\n\n' : '') + '【' + (pick.source || '御案') + (pick.title ? ' · ' + pick.title : '') + '】\n' + (pick.text || '');
      toast('已纳入政令草诏');
      openZhaoPreviewPanel();
    } else if (action === 'clear-edict-desk') {
      state.edictDraft = [];
      state.edictDrafts = {};
      openZhaoPreviewPanel();
    } else if (action === 'save-edict-desk') {
      deskSaveEdictDraft();
      openZhaoPreviewPanel();
    } else if (action === 'publish-edict-desk') {
      deskPublishEdict();
    } else if (action === 'select-memorial-desk') {
      state.memorialId = data.id || '';
      openYueZouPreviewPanel();
    } else if (action === 'memorial-unseal-desk') {
      state.memorialOpened = state.memorialOpened || {};
      if (data.id) state.memorialOpened[data.id] = true;
      openYueZouPreviewPanel();
    } else if (action === 'memorial-filter-desk') {
      state.memorialFilter = data.filter || 'all';
      openYueZouPreviewPanel();
    } else if (action === 'memorial-decision-desk') {
      deskStageMemorial(data.id || '', data.decision || 'annotated', data.replyid || '');
    } else if (action === 'memorial-edict-desk') {
      deskMemorialToEdict(data.id || '');
    } else if (action === 'memorial-qiaozhi-desk') {
      var qzFound = deskFindRawMemorial(data.id || '');
      var qzTarget = qzFound && qzFound.raw && qzFound.raw._qiaozhiTarget;
      if (qzTarget && typeof window.openQiaozhiPanel === 'function') {
        closeDeskOverlay();
        window.openQiaozhiPanel(qzTarget);
      } else {
        toast('未找到可侨置的失地记录');
      }
    } else if (action === 'memorial-summon-desk') {
      closeDeskOverlay();
      openModule('wendui');
    } else if (action === 'edict-prom-revoke-desk') {
      // 撤回本回合已颁行诏书:status→draft(不再作为本回合 decree 整体推演)·全文放回「政令」草拟供改拟
      var _rvId = data.id || '';
      var _gmr = deskGM();
      var _rec = (Array.isArray(_gmr.edicts) ? _gmr.edicts : []).filter(function(x){ return x && String(x.id) === String(_rvId); })[0];
      if (_rec) {
        _rec.status = 'draft';
        syncFormalEdictDraft('edict-pol', _rec.text || '');
        writeFormalEdictDraftInput('edict-pol', _rec.text || '');
        saveFormalDraftsToGM(true);
        syncFormalEdictDraftsToLegacyInputs();
        if (typeof toast === 'function') toast('已撤回该诏书·全文已放回「政令」草拟·可改拟后重新润色颁行');
      }
      openZhaoPreviewPanel();
    } else if (action === 'letter-target-desk') {
      var ltName = data.name || data.id || '';
      if (state.letterMultiMode) {
        // 群发态·点名册切换选中 (不切换单 target)
        if (!Array.isArray(state.letterMultiTargets)) state.letterMultiTargets = [];
        var mi = state.letterMultiTargets.indexOf(ltName);
        if (mi >= 0) state.letterMultiTargets.splice(mi, 1);
        else if (ltName) state.letterMultiTargets.push(ltName);
        openHongyanPreviewPanel();
      } else {
        deskTargetLetter(ltName);
      }
    } else if (action === 'letter-read-desk') {
      // 展阅:弹大居中阅览浮层看全文(替代旧的右栏就地展开·窄列挤成一小块)
      var lrId = data.id || data.name || '';
      var lrLetter = null;
      try {
        var lrRows = (typeof formalIncomingLetters === 'function') ? formalIncomingLetters(getLetters()) : [];
        lrLetter = lrRows.filter(function(x){ return String(x.id || '') === String(lrId); })[0] || null;
        if (!lrLetter) {
          var lrAll = getLetters().filter(function(x){ return String(x.id || '') === String(lrId); })[0];
          if (lrAll) lrLetter = { id:lrAll.id, from:lrAll.from, title:lrAll.title, content:lrAll.content, reply:lrAll.reply, time:(typeof letterTimeFormal === 'function' ? letterTimeFormal(lrAll) : ''), source:lrAll };
        }
      } catch(_) {}
      if (lrLetter) {
        // #3 修复:展阅即标「已读」。收件未阅判定读 playerRead(回书读 _replyRead)，
        //   而此前「展阅」只开弹窗、从不置位 → 永远显示未阅。在源头 GM.letters 上按 id
        //   置位(playerRead/_playerRead/_replyRead 全覆盖·兼容历史字段)+ 持久化 + 刷新徽标。
        try {
          // ★2026-07-01 修复「展阅后仍显未阅」:旧码只按 GM.letters.find(id===lrId) 置位·但无 id 的来函其 wrapper 用了
          //   合成 id「letter-N」(见 getLetters:1840)·在 GM.letters(raw)上按此合成 id 永远 find 不到 → 置位落空 → 一直未阅。
          //   改为直接在该行的 raw 对象(即 GM.letters 那封信本体·getLetters 的 raw:x 是引用)上置位·不依赖 id 匹配。
          var _raw = lrLetter.raw || (lrLetter.source && lrLetter.source.raw) || lrLetter.source || null;
          if (_raw && typeof _raw === 'object') { _raw.playerRead = true; _raw._playerRead = true; _raw._replyRead = true; }
          var _gmL = (typeof GM !== 'undefined' && GM) ? GM : (window.GM || null);
          if (_gmL && Array.isArray(_gmL.letters) && lrId) {
            var _realL = _gmL.letters.find(function(x){ return x && String(x.id || '') === String(lrId); });
            if (_realL) { _realL.playerRead = true; _realL._playerRead = true; _realL._replyRead = true; }
          }
        } catch(_e2) {}
        try { saveFormalDraftsToGM(false); } catch(_e3) {}
        try { openHongyanPreviewPanel(); } catch(_e4) {}
        openLetterReadOverlay(lrLetter);
      }
    } else if (action === 'letter-multi-toggle-desk') {
      state.letterMultiMode = !state.letterMultiMode;
      state.letterMultiTargets = state.letterMultiMode && Array.isArray(state.letterMultiTargets) ? state.letterMultiTargets : [];
      openHongyanPreviewPanel();
    } else if (action === 'letter-filter-desk') {
      state.letterFilter = data.filter || 'all';
      saveFormalDraftsToGM(false);
      openHongyanPreviewPanel();
    } else if (action === 'letter-thread-action-desk') {
      var letter = getLetters().find(function(x){ return String(x.id || '') === String(data.id || ''); });
      var rawLetter = letter && letter.raw;
      if (data.letterAction === 'recall' && rawLetter && typeof window._ltRecall === 'function') {
        window._ltRecall(rawLetter.id);
      } else if (data.letterAction === 'resend-secret' && rawLetter && typeof window._ltResend === 'function') {
        window._ltResend(rawLetter.id, 'secret_agent');
      } else if (data.letterAction === 'resend-fast' && rawLetter && typeof window._ltResend === 'function') {
        window._ltResend(rawLetter.id, 'multi_courier');
      } else if (data.letterAction === 'verify' && rawLetter && typeof window._ltVerify === 'function') {
        window._ltVerify(rawLetter.id);
      } else if (data.letterAction === 'reply' && rawLetter) {
        if (rawLetter._npcInitiated && typeof window._ltReplyToNpc === 'function') {
          try { window._ltReplyToNpc(rawLetter.id); } catch(_) {}
        }
        var replyTarget = rawLetter._npcInitiated ? (rawLetter.from || letter.from) : (rawLetter.to || letter.to || rawLetter.from || letter.from);
        if (window.GM) GM._pendingLetterTo = replyTarget || state.letterTarget;
        state.letterTarget = (replyTarget || state.letterTarget || '');
        state.letterDraft = state.letterDraft || {};
        state.letterDraft.to = state.letterTarget;
        saveFormalDraftsToGM(false);
      } else if (data.letterAction === 'star' && rawLetter) {
        if (typeof window._ltStar === 'function') {
          window._ltStar(rawLetter.id);
        } else {
          rawLetter._starred = !rawLetter._starred;
        }
      } else if (data.letterAction === 'excerpt') {
        if (rawLetter && typeof window._ltExcerptToEdict === 'function') {
          try { window._ltExcerptToEdict(rawLetter.id); } catch(_) {}
        }
        state.edictDrafts = state.edictDrafts || {};
        state.edictDrafts.private = (state.edictDrafts.private ? state.edictDrafts.private + '\n\n' : '') + '摘录鸿雁通信，着密察其情。';
        toast('已摘入密旨草诏');
      } else if (data.letterAction === 'bypass' && rawLetter && typeof window._ltBypassBlock === 'function') {
        window._ltBypassBlock(rawLetter.id);
      } else {
        toast('已记录鸿雁动作：' + (data.letterAction || '核实'));
      }
      openHongyanPreviewPanel();
    } else if (action === 'letter-send-desk') {
      deskSendLetter(false);
    } else if (action === 'letter-draft-desk') {
      deskSendLetter(true);
    } else if (action === 'letter-memory-desk') {
      deskStoreLetterMemory();
    } else if (action === 'select-record-desk') {
      deskSelectRecord(data.id || '');
    } else if (action === 'record-tab-desk') {
      state.recordTab = data.tab || 'shiji';
      state.recordView = 'library';
      state.recordFacet = {};
      state.recordId = '';
      openShiluPreviewPanel();
    } else if (action === 'record-filter-desk') {
      if (data.key) state[data.key] = data.value || '全部';
      openShiluPreviewPanel();
    } else if (action === 'record-archive-desk') {
      deskArchiveRecord(data.record || 'shilu');
    } else if (action === 'record-annotate-desk') {
      deskAnnotateRecord(data.id || state.recordId || '');
    } else if (action === 'record-star-desk') {
      deskToggleRecordStar(data.id || state.recordId || '');
    } else if (action === 'record-view-desk') {
      state.recordView = data.view || 'library';
      state.recordId = '';
      state.recordPerson = '';
      state.recordRealm = '';
      state.recordSearch = '';
      openShiluPreviewPanel();
    } else if (action === 'record-facet-desk') {
      state.recordFacet = state.recordFacet || {};
      if (data.dim) {
        var _recFacetArr = state.recordFacet[data.dim] || (state.recordFacet[data.dim] = []);
        var _recFacetIdx = _recFacetArr.indexOf(data.val);
        if (_recFacetIdx >= 0) _recFacetArr.splice(_recFacetIdx, 1); else _recFacetArr.push(data.val);
      }
      openShiluPreviewPanel();
    } else if (action === 'record-sort-desk') {
      state.recordSort = data.sort || 'era';
      openShiluPreviewPanel();
    } else if (action === 'record-person-desk') {
      state.recordView = 'persons';
      state.recordPerson = data.person || '';
      state.recordId = '';
      state.recordSearch = '';
      openShiluPreviewPanel();
    } else if (action === 'record-realm-desk') {
      state.recordView = 'realms';
      state.recordRealm = data.realm || '';
      state.recordId = '';
      state.recordSearch = '';
      openShiluPreviewPanel();
    } else if (action === 'record-back-desk') {
      if (data.back === 'person') state.recordPerson = '';
      else if (data.back === 'realm') state.recordRealm = '';
      openShiluPreviewPanel();
    } else if (action === 'record-xref-desk') {
      state.recordView = 'library';
      if (data.cat) state.recordTab = data.cat;
      state.recordFacet = {};
      state.recordSearch = '';
      state.recordId = data.id || '';
      openShiluPreviewPanel();
    } else if (action === 'record-open-shiji-desk') {
      deskOpenShijiResult(data.id || state.recordId || '');
    } else if (action === 'shizheng-convene-desk') {
      closeDeskOverlay();
      if (typeof window._shizhengConvene === 'function') window._shizhengConvene(data.id || '');
      else openChaoyiMode('tingyi');
    } else if (action === 'shizheng-secret-desk') {
      closeDeskOverlay();
      if (typeof window._shizhengSecret === 'function') window._shizhengSecret(data.id || '');
      else openModule('wendui');
    } else if (action === 'shizheng-choice-desk') {
      if (typeof window._chooseIssueOption === 'function') {
        var choiceIssue = getIssues().find(function(x){ return String(x.id || '') === String(data.id || ''); });
        var choiceIndex = Number(data.choice || 0);
        var choiceRow = choiceIssue && Array.isArray(choiceIssue.choices) ? choiceIssue.choices[choiceIndex] : null;
        recordDeskActionSignal('shizheng-choice-desk', {
          id: data.id || '',
          choice: String(choiceIndex),
          topic: (choiceIssue && (choiceIssue.title || choiceIssue.topic)) || '',
          target: (choiceIssue && (choiceIssue.title || choiceIssue.topic)) || '',
          linkedIssue: data.id || ''
        }, [
          choiceIssue && (choiceIssue.title || choiceIssue.topic),
          choiceIssue && (choiceIssue.text || choiceIssue.narrative || choiceIssue.detail),
          choiceRow && (choiceRow.text || choiceRow.title || choiceRow.label),
          choiceRow && (choiceRow.desc || choiceRow.description || choiceRow.effect)
        ].filter(Boolean).join(' '), {
          kind: 'court',
          topic: (choiceIssue && (choiceIssue.title || choiceIssue.topic)) || '',
          target: (choiceIssue && (choiceIssue.title || choiceIssue.topic)) || '',
          linkedIssue: data.id || '',
          intensity: 0.7,
          policyTags: ['court']
        });
        window._chooseIssueOption(data.id || '', choiceIndex);
        state.shizhengIssue = data.id || state.shizhengIssue || '';
        setTimeout(openShizhengPreviewPanel, 0);
      } else {
        toast('裁断流程未加载');
      }
    } else if (action === 'panel-desk') {
      closeDeskOverlay();
      openPanel(data.slot || '');
    } else if (action === 'module-desk') {
      var kind = data.kind || '';
      if (kind === 'edict') openZhaoPreviewPanel();
      else if (kind === 'memorial') openYueZouPreviewPanel();
      else if (kind === 'letter') openHongyanPreviewPanel();
      else if (kind === 'records') openShiluPreviewPanel();
      else {
        closeDeskOverlay();
        openModule(kind);
      }
    } else if (action === 'toast') {
      toast(data.text || '已记录');
    } else {
      handleModuleAction(action, data || {});
    }
  }

  function deskTabs(names, active){
    return '<div class="tm-desk-tabs">' + names.map(function(n, i){
      return '<button type="button" class="tm-desk-tab ' + (i === active ? 'active' : '') + '">' + esc(n) + '</button>';
    }).join('') + '</div>';
  }

  function deskRows(rows){
    return rows.map(function(r){
      return '<div class="tm-desk-row"><span>' + esc(r[0]) + '</span><b>' + esc(r[1] == null || r[1] === '' ? '未记' : r[1]) + '</b></div>';
    }).join('');
  }

  function deskStats(rows){
    return '<div class="tm-desk-grid">' + rows.map(function(r){
      return '<div class="tm-desk-stat"><span>' + esc(r[0]) + '</span><b>' + esc(r[1] == null || r[1] === '' ? '—' : r[1]) + '</b></div>';
    }).join('') + '</div>';
  }

  function deskList(items, emptyText, opts){
    opts = opts || {};
    if (!items || !items.length) return '<div class="tm-desk-empty">' + esc(emptyText || '暂无条目。') + '</div>';
    var hasHot = items.some(function(x){ return x && x.hot; });
    return '<div class="tm-desk-list">' + items.map(function(x, i){
      var cls = (x.hot || (!hasHot && i === 0)) ? ' hot' : '';
      var action = opts.action ? ' data-desk-action="' + attr(opts.action) + '" data-id="' + attr(x.id || '') + '"' : '';
      return '<button type="button" class="tm-desk-item' + cls + '"' + action + '><b>' + esc(x.title || x.name || '未题') + '</b><span>' + esc(x.meta || x.sub || x.text || '') + '</span></button>';
    }).join('') + '</div>';
  }

  function deskCard(title, body){
    return '<div class="tm-desk-card"><b>' + esc(title) + '</b><p>' + esc(body || '暂无详情。') + '</p></div>';
  }

  function deskAction(label, action, data, primary){
    data = data || {};
    var attrs = Object.keys(data).map(function(k){ return ' data-' + attr(k) + '="' + attr(data[k]) + '"'; }).join('');
    return '<button type="button" class="tm-desk-btn ' + (primary ? 'primary' : '') + '" data-desk-action="' + attr(action) + '"' + attrs + '>' + esc(label) + '</button>';
  }

  function installActionPanelExactStyles(){
    var st = document.getElementById('tm-phase8-action-panel-style');
    if (!st) {
      st = document.createElement('style');
      st.id = 'tm-phase8-action-panel-style';
      document.head.appendChild(st);
    }
    var __css = [
      'body.tm-phase8-formal .tm-bridge-overlay{position:fixed;inset:0;z-index:10030;display:block;background:rgba(8,6,4,.6);color:#eadfbd;font-family:"STKaiti","KaiTi",serif;}',
      'body.tm-phase8-formal .tm-bridge-scrim{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 20%,rgba(201,160,69,.10),transparent 44%),rgba(0,0,0,.34);}',
      'body.tm-phase8-formal .tm-bridge-panel{position:absolute;box-sizing:border-box;}',
      'body.tm-phase8-formal .tm-action-panel{left:58px;top:74px;width:min(1080px,calc(100vw - 132px));height:min(720px,calc(100vh - 118px));overflow:visible;transform:translateX(-12px);transition:transform .18s ease,opacity .18s ease;opacity:.98;}',
      'body.tm-phase8-formal .tm-bridge-overlay.show .tm-action-panel{transform:translateX(0);}',
      'body.tm-phase8-formal .tm-action-panel.edict-shell{left:50%;top:54px;width:calc(100vw - 130px);height:calc(100vh - 104px);transform:translate(-50%,10px);}',
      'body.tm-phase8-formal .tm-bridge-overlay.show .tm-action-panel.edict-shell{transform:translate(-50%,0);}',
      'body.tm-phase8-formal .tm-action-panel.memorial-shell{left:40px;right:40px;top:64px;width:auto;height:min(820px,calc(100vh - 94px));transform:none;}',
      'body.tm-phase8-formal .tm-bridge-overlay.show .tm-action-panel.memorial-shell{transform:none;}',
      'body.tm-phase8-formal .tm-action-panel.letter-shell{left:50%;top:60px;width:min(1440px,calc(100vw - 64px));height:min(860px,calc(100vh - 90px));transform:translate(-50%,10px);}',
      'body.tm-phase8-formal .tm-bridge-overlay.show .tm-action-panel.letter-shell{transform:translate(-50%,0);}',
      'body.tm-phase8-formal .tm-action-panel.records-shell{left:40px;right:40px;top:64px;width:auto;height:min(830px,calc(100vh - 96px));transform:none;}',
      'body.tm-phase8-formal .tm-bridge-overlay.show .tm-action-panel.records-shell{transform:none;}',
      'body.tm-phase8-formal .tm-action-panel .tm-floating-close{position:absolute;right:18px;top:16px;z-index:5;width:34px;height:34px;border-radius:50%;border:1px solid rgba(201,160,69,.38);color:#f5df9d;background:linear-gradient(180deg,rgba(54,37,22,.95),rgba(12,9,7,.95));box-shadow:0 8px 22px rgba(0,0,0,.42);cursor:pointer;font-size:20px;line-height:30px;}',
      'body.tm-phase8-formal .tm-action-panel.edict-shell .tm-floating-close{top:20px;right:24px;color:#3a2818;background:linear-gradient(180deg,#f0d989,#bb873a);border-color:rgba(68,43,19,.32);}',
      'body.tm-phase8-formal .tm-action-panel>.tm-action-body{height:100%;min-height:0;}',
      'body.tm-phase8-formal .tm-action-panel.edict-shell .ed-panel-wrap{height:100%;box-sizing:border-box;overflow:auto;border:1px solid rgba(201,160,69,.28);box-shadow:0 24px 58px rgba(0,0,0,.52);}',
      'body.tm-phase8-formal .tm-action-panel.edict-shell .ed-panel-wrap>div{min-height:100%;}',
      'body.tm-phase8-formal .tm-action-panel.edict-shell .ed-action-bar{padding-bottom:14px;}',
      'body.tm-phase8-formal .tm-chip-row{display:inline-flex;align-items:center;gap:5px;flex-wrap:wrap;}',
      'body.tm-phase8-formal .tm-chip{display:inline-flex;align-items:center;justify-content:center;min-height:18px;padding:1px 7px;border:1px solid rgba(201,160,69,.18);border-radius:999px;color:rgba(240,226,184,.78);background:rgba(255,245,210,.045);font-size:11.5px;line-height:1.2;white-space:nowrap;}',
      'body.tm-phase8-formal .tm-chip.green{border-color:rgba(126,184,167,.34);color:#a8dcc5;background:rgba(65,111,92,.14);}',
      'body.tm-phase8-formal .tm-chip.hot{border-color:rgba(213,92,64,.40);color:#f0a082;background:rgba(126,31,24,.20);}',
      'body.tm-phase8-formal .tm-mini-btn,body.tm-phase8-formal .tm-action-primary,body.tm-phase8-formal .tm-action-ghost{min-height:28px;border:1px solid rgba(201,160,69,.22);color:#eadfbd;background:rgba(0,0,0,.22);cursor:pointer;font-family:inherit;font-size:12px;padding:4px 10px;}',
      'body.tm-phase8-formal .tm-mini-btn.green,body.tm-phase8-formal .tm-action-primary{color:#fff0c9;border-color:rgba(213,92,64,.42);background:linear-gradient(180deg,#7f3528,#331612);}',
      'body.tm-phase8-formal .tm-mini-btn.hot{color:#fff0c9;border-color:rgba(213,92,64,.50);background:linear-gradient(180deg,#963b29,#421712);}',
      'body.tm-phase8-formal .tm-row-actions{display:flex;flex-wrap:wrap;gap:7px;align-items:center;}',
      'body.tm-phase8-formal .tm-input,body.tm-phase8-formal .tm-select,body.tm-phase8-formal .tm-textarea{box-sizing:border-box;width:100%;border:1px solid rgba(201,160,69,.22);background:rgba(0,0,0,.20);color:#eadfbd;font-family:inherit;font-size:12px;padding:7px 8px;}',
      'body.tm-phase8-formal .tm-textarea{min-height:86px;line-height:1.65;resize:vertical;}',
      'body.tm-phase8-formal .tm-stat-strip{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin-bottom:12px;}',
      'body.tm-phase8-formal .tm-stat{padding:8px;border:1px solid rgba(201,160,69,.16);background:linear-gradient(180deg,rgba(255,245,210,.065),rgba(0,0,0,.18)),rgba(18,13,10,.62);}',
      'body.tm-phase8-formal .tm-stat span{display:block;color:rgba(232,220,187,.50);font-size:11.5px;}',
      'body.tm-phase8-formal .tm-stat b{display:block;margin-top:3px;color:#f2ddb0;font-size:15px;}',
      'body.tm-phase8-formal .edict-old-panel{height:100%;box-sizing:border-box;display:grid;grid-template-columns:260px minmax(0,1fr);gap:18px;padding:18px 22px;border:1px solid rgba(201,160,69,.38);border-radius:7px;background:radial-gradient(ellipse at 50% 0,rgba(232,196,111,.10),transparent 34%),linear-gradient(180deg,rgba(36,28,20,.98),rgba(13,10,8,.97));box-shadow:0 24px 58px rgba(0,0,0,.52),inset 0 1px 0 rgba(255,242,185,.10);color:#eadfbd;}',
      'body.tm-phase8-formal .edict-old-sug{min-height:0;display:grid;grid-template-rows:auto minmax(0,1fr);gap:10px;padding:12px 10px 12px 12px;border:1px solid rgba(201,160,69,.20);border-left:3px solid rgba(180,54,37,.68);border-radius:5px;background:linear-gradient(90deg,rgba(0,0,0,.28),rgba(0,0,0,.06)),rgba(255,245,210,.035);}',
      'body.tm-phase8-formal .edict-old-sug-title,body.tm-phase8-formal .edict-old-section-title{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0;color:#f0d68d;font-family:"STKaiti","KaiTi",serif;font-size:14px;letter-spacing:.18em;}',
      'body.tm-phase8-formal .edict-old-sug-list,body.tm-phase8-formal .edict-old-main{min-height:0;overflow:auto;scrollbar-color:rgba(201,160,69,.48) rgba(0,0,0,.22);}',
      'body.tm-phase8-formal .edict-old-sug-item{margin-bottom:8px;padding:9px;border:1px solid rgba(201,160,69,.16);border-radius:4px;background:linear-gradient(180deg,rgba(255,246,216,.055),rgba(255,246,216,.025)),rgba(0,0,0,.14);}',
      'body.tm-phase8-formal .edict-old-sug-item b{display:block;color:#f0d892;font-size:12px;} body.tm-phase8-formal .edict-old-sug-item p{margin:5px 0 7px;color:rgba(236,226,193,.76);font-size:11.5px;line-height:1.48;}',
      'body.tm-phase8-formal .edict-old-title{display:grid;grid-template-columns:58px minmax(0,1fr);gap:12px;align-items:center;margin:0 0 14px;padding:13px 14px;border:1px solid rgba(201,160,69,.22);border-radius:5px;background:linear-gradient(90deg,rgba(139,38,28,.16),transparent 38%),rgba(255,245,210,.045);}',
      'body.tm-phase8-formal .edict-old-seal{width:50px;height:50px;display:grid;place-items:center;border:1px solid rgba(213,176,95,.48);border-radius:50%;color:#f2d98d;background:radial-gradient(circle,rgba(201,160,69,.20),rgba(64,31,20,.80) 72%);font-size:18px;}',
      'body.tm-phase8-formal .edict-old-title strong{display:block;color:#f5dc96;font-size:22px;letter-spacing:.22em;} body.tm-phase8-formal .edict-old-title span{display:block;margin-top:4px;color:rgba(232,218,178,.64);font-size:12px;letter-spacing:.14em;}',
      'body.tm-phase8-formal .edict-old-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;}',
      'body.tm-phase8-formal .edict-old-card,body.tm-phase8-formal .edict-old-archive-card{min-width:0;padding:10px;border:1px solid rgba(201,160,69,.18);border-radius:5px;background:linear-gradient(180deg,rgba(255,246,216,.060),rgba(255,246,216,.030)),rgba(0,0,0,.12);}',
      'body.tm-phase8-formal .edict-old-card-head{display:grid;grid-template-columns:34px minmax(0,1fr);gap:8px;align-items:center;margin-bottom:7px;}',
      'body.tm-phase8-formal .edict-old-badge{width:30px;height:30px;display:grid;place-items:center;border:1px solid rgba(201,160,69,.30);border-radius:50%;color:#f2d98d;background:rgba(0,0,0,.22);}',
      'body.tm-phase8-formal .edict-old-card-head b{display:block;color:#f0d892;font-size:13px;} body.tm-phase8-formal .edict-old-card-head span span{display:block;margin-top:3px;color:rgba(224,211,171,.56);font-size:11.5px;}',
      'body.tm-phase8-formal .edict-old-forecast{margin-top:7px;color:rgba(232,220,187,.62);font-size:12px;line-height:1.45;}',
      'body.tm-phase8-formal .edict-old-bar{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:12px 0;padding:10px;border:1px solid rgba(201,160,69,.16);background:rgba(0,0,0,.16);}',
      'body.tm-phase8-formal .edict-xingzhi,body.tm-phase8-formal .edict-old-section{margin-top:12px;padding:10px;border:1px solid rgba(201,160,69,.16);background:rgba(0,0,0,.12);}',
      'body.tm-phase8-formal .edict-xingzhi-head b{display:block;color:#f0d892;font-size:13px;} body.tm-phase8-formal .edict-xingzhi-head span{display:block;margin:4px 0 8px;color:rgba(232,220,187,.58);font-size:12px;}',
      'body.tm-phase8-formal .edict-old-archive{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;}',
      'body.tm-phase8-formal .edict-sug-v2{display:grid;grid-template-columns:44px minmax(0,1fr);gap:9px;margin-bottom:9px;padding:9px;border:1px solid rgba(201,160,69,.16);border-radius:4px;background:linear-gradient(180deg,rgba(255,246,216,.055),rgba(255,246,216,.025)),rgba(0,0,0,.14);}',
      /* 空态无立绘列：单列铺满·治「暂无御案建议」落进 44px 头像列被竖挤成一字一行（2026-07-04）*/
      'body.tm-phase8-formal .edict-sug-v2.edict-sug-empty{grid-template-columns:minmax(0,1fr)!important;}',
      'body.tm-phase8-formal .edict-sug-portrait-wrap{width:42px;height:52px;display:grid;place-items:center;position:relative;overflow:hidden;border:1px solid rgba(201,160,69,.22);background:radial-gradient(circle at 50% 28%,rgba(201,160,69,.20),rgba(0,0,0,.26));color:#efd990;font-size:18px;}',
      'body.tm-phase8-formal .edict-sug-portrait-wrap:after{content:attr(data-glyph);display:none;font-family:"STKaiti","KaiTi",serif;text-shadow:0 1px 8px rgba(0,0,0,.55);}',
      'body.tm-phase8-formal .edict-sug-portrait-wrap.fallback:after{display:block;}',
      'body.tm-phase8-formal .edict-sug-portrait{width:100%;height:100%;object-fit:cover;display:block;}',
      'body.tm-phase8-formal .edict-sug-v2 b{display:block;color:#f0d892;font-size:12px;} body.tm-phase8-formal .edict-sug-v2 p{margin:5px 0 7px;color:rgba(236,226,193,.76);font-size:11.5px;line-height:1.48;}',
      'body.tm-phase8-formal .edict-sug-footer{display:flex;align-items:center;justify-content:space-between;gap:8px;} body.tm-phase8-formal .edict-sug-adopt{min-height:24px;padding:2px 9px;border:1px solid rgba(213,92,64,.34);color:#fff0c9;background:linear-gradient(180deg,#7f3528,#331612);font-family:inherit;font-size:12px;cursor:pointer;}',
      'body.tm-phase8-formal .edict-sug-delete{margin-left:5px;min-width:24px;min-height:24px;border:1px solid rgba(201,160,69,.18);color:rgba(232,220,187,.58);background:rgba(0,0,0,.20);font-family:inherit;font-size:14px;line-height:1;cursor:pointer;} body.tm-phase8-formal .edict-sug-delete:hover{color:#f0a082;border-color:rgba(213,92,64,.40);}',
      'body.tm-phase8-formal .edict-old-label{display:block;margin-bottom:4px;color:rgba(224,211,171,.62);font-size:11.5px;letter-spacing:.12em;}',
      'body.tm-phase8-formal .edict-polish-scroll{position:relative;margin-top:12px;padding:16px 92px 14px 18px;border:1px solid rgba(201,160,69,.22);background:linear-gradient(180deg,rgba(239,215,150,.10),rgba(255,245,210,.035)),rgba(0,0,0,.16);}',
      'body.tm-phase8-formal .edict-polish-title{position:absolute;right:18px;top:16px;writing-mode:vertical-rl;color:#f0d892;letter-spacing:.35em;font-size:18px;} body.tm-phase8-formal .edict-polish-text{width:100%;min-height:130px;border:0;background:transparent;color:#f5e9c6;font-family:"STKaiti","KaiTi",serif;font-size:14px;line-height:1.85;resize:vertical;}',
      'body.tm-phase8-formal .edict-polish-actions{display:flex;gap:7px;margin-top:8px;} body.tm-phase8-formal .edict-polish-seal{position:absolute;right:30px;bottom:18px;width:44px;height:44px;display:grid;place-items:center;border:1px solid rgba(213,92,64,.50);border-radius:50%;color:#d66a50;font-size:11px;opacity:.82;}',
      'body.tm-phase8-formal .edict-xingzhi-row{display:grid;grid-template-columns:72px minmax(0,1fr);gap:8px;padding:5px 0;border-top:1px solid rgba(201,160,69,.12);font-size:11.5px;}',
      'body.tm-phase8-formal .memorial-office-v4,body.tm-phase8-formal .hy-office-v4,body.tm-phase8-formal .records-cabinet-v4{height:100%;box-sizing:border-box;position:relative;overflow:hidden;}',
      'body.tm-phase8-formal .memorial-office-v4{display:grid;grid-template-columns:292px minmax(0,1fr);gap:16px;padding:18px;border:1px solid rgba(185,144,71,.42);background:radial-gradient(ellipse at 24% 0,rgba(154,47,33,.15),transparent 42%),radial-gradient(ellipse at 92% 10%,rgba(211,167,82,.10),transparent 36%),linear-gradient(135deg,rgba(42,26,18,.98),rgba(11,8,7,.96));}',
      'body.tm-phase8-formal .memorial-cases-v4,body.tm-phase8-formal .hy-roster-v4,body.tm-phase8-formal .hy-compose-v4,body.tm-phase8-formal .records-spine-v4{min-height:0;overflow:auto;scrollbar-color:rgba(201,160,69,.48) rgba(0,0,0,.22);}',
      'body.tm-phase8-formal .memorial-cases-v4{padding:12px;border:1px solid rgba(201,160,69,.18);border-left:6px solid rgba(126,31,24,.76);background:linear-gradient(180deg,rgba(0,0,0,.28),rgba(255,245,210,.035)),repeating-linear-gradient(0deg,rgba(255,255,255,.025) 0 1px,transparent 1px 34px);}',
      'body.tm-phase8-formal .tm-panel-v4-title{display:grid;grid-template-columns:42px minmax(0,1fr);gap:9px;align-items:center;margin-bottom:12px;}',
      'body.tm-phase8-formal .tm-panel-v4-title .seal{width:40px;height:40px;display:grid;place-items:center;border:1px solid rgba(211,169,82,.38);color:#f1d98d;background:radial-gradient(circle,rgba(152,45,31,.34),rgba(24,13,8,.92) 70%);font-size:20px;}',
      'body.tm-phase8-formal .tm-panel-v4-title b{display:block;color:#f2d990;font-size:19px;letter-spacing:.10em;} body.tm-phase8-formal .tm-panel-v4-title span:not(.seal){display:block;margin-top:4px;color:rgba(232,217,176,.56);font-size:12px;}',
      'body.tm-phase8-formal .memorial-filter-v4{display:grid;gap:7px;} body.tm-phase8-formal .memorial-filter-v4 button,body.tm-phase8-formal .hy-person-v4,body.tm-phase8-formal .records-tab-v4{width:100%;border:1px solid rgba(201,160,69,.16);color:#eadfbd;background:rgba(255,245,210,.035);cursor:pointer;text-align:left;font-family:inherit;}',
      'body.tm-phase8-formal .memorial-filter-v4 button{display:grid;grid-template-columns:26px minmax(0,1fr) auto;gap:8px;align-items:center;min-height:43px;padding:7px 8px;} body.tm-phase8-formal .memorial-filter-v4 button.active,body.tm-phase8-formal .hy-person-v4.active,body.tm-phase8-formal .records-tab-v4.active{border-color:rgba(239,201,116,.52);background:linear-gradient(90deg,rgba(122,45,32,.34),rgba(255,245,210,.045));box-shadow:inset 2px 0 0 rgba(214,169,82,.80);}',
      'body.tm-phase8-formal .memorial-filter-v4 i{width:24px;height:24px;display:grid;place-items:center;border-radius:50%;border:1px solid rgba(201,160,69,.24);color:#f0d892;font-style:normal;font-size:12px;}',
      'body.tm-phase8-formal .memorial-filter-v4 b,body.tm-phase8-formal .hy-person-v4 b,body.tm-phase8-formal .records-tab-v4 b{display:block;color:#f0d892;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      'body.tm-phase8-formal .memorial-filter-v4 span,body.tm-phase8-formal .hy-person-v4 span,body.tm-phase8-formal .records-tab-v4 span{display:block;margin-top:3px;color:rgba(224,211,171,.54);font-size:11px;}',
      'body.tm-phase8-formal .memorial-side-note{margin-top:12px;padding:10px;border:1px solid rgba(201,160,69,.14);background:rgba(0,0,0,.18);} body.tm-phase8-formal .memorial-side-note b{display:block;margin-bottom:5px;color:#f0d892;font-size:12px;} body.tm-phase8-formal .memorial-side-note p{margin:0;color:rgba(232,220,187,.66);font-size:11.5px;line-height:1.55;}',
      'body.tm-phase8-formal .memorial-paper-v4,body.tm-phase8-formal .records-paper-v4{min-height:0;overflow:auto;padding:18px 20px;color:#eadfbd;border:1px solid rgba(201,160,69,.26);background:radial-gradient(ellipse at 18% 0,rgba(143,43,30,.16),transparent 38%),radial-gradient(ellipse at 88% 18%,rgba(81,126,104,.10),transparent 36%),repeating-linear-gradient(90deg,rgba(255,236,170,.025) 0 1px,transparent 1px 34px),linear-gradient(180deg,rgba(31,24,18,.98),rgba(12,9,7,.98));box-shadow:inset 0 1px 0 rgba(255,236,178,.08),0 18px 38px rgba(0,0,0,.38);scrollbar-color:rgba(201,160,69,.48) rgba(0,0,0,.26);}',
      'body.tm-phase8-formal .memorial-paper-head-v4,body.tm-phase8-formal .records-paper-head-v4{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding-bottom:12px;margin-bottom:12px;border-bottom:1px solid rgba(201,160,69,.20);} body.tm-phase8-formal .memorial-paper-head-v4 h2,body.tm-phase8-formal .records-paper-head-v4 h2{margin:0;color:#f1d98d;font-size:26px;letter-spacing:.08em;} body.tm-phase8-formal .memorial-paper-head-v4 p,body.tm-phase8-formal .records-paper-head-v4 p{margin:4px 0 0;color:rgba(232,220,187,.58);font-size:12px;}',
      'body.tm-phase8-formal .memorial-group-v4{margin-top:14px;} body.tm-phase8-formal .memorial-group-title-v4,body.tm-phase8-formal .records-section-title-v4{display:flex;align-items:center;justify-content:space-between;margin:0 0 8px;color:#efd58b;font-size:18px;letter-spacing:.08em;}',
      'body.tm-phase8-formal .memorial-card-v4,body.tm-phase8-formal .records-card-v4,body.tm-phase8-formal .bn-affair-v4{position:relative;margin-bottom:10px;padding:12px;border:1px solid rgba(201,160,69,.18);background:linear-gradient(90deg,rgba(126,32,24,.09),transparent 38%),linear-gradient(180deg,rgba(255,245,210,.055),rgba(0,0,0,.16)),rgba(19,14,11,.72);box-shadow:0 8px 18px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,236,178,.045);}',
      'body.tm-phase8-formal .memorial-card-v4::before,body.tm-phase8-formal .records-card-v4::before,body.tm-phase8-formal .bn-affair-v4::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:rgba(126,32,24,.58);}',
      'body.tm-phase8-formal .memorial-card-v4.done::before{background:rgba(60,107,83,.62);} body.tm-phase8-formal .memorial-card-v4.held::before{background:rgba(118,82,44,.58);} body.tm-phase8-formal .memorial-card-v4.review::before{background:rgba(176,113,51,.68);}',
      'body.tm-phase8-formal .memorial-card-head-v4{display:grid;grid-template-columns:46px minmax(0,1fr) auto;gap:10px;align-items:center;} body.tm-phase8-formal .memorial-avatar-v4{width:42px;height:42px;display:grid;place-items:center;border:1px solid rgba(201,160,69,.35);border-radius:50%;color:#f6e5ad;background:radial-gradient(circle,rgba(201,160,69,.28),rgba(38,21,13,.95) 70%);font-size:18px;}',
      'body.tm-phase8-formal .memorial-card-head-v4 b,body.tm-phase8-formal .records-card-v4 b,body.tm-phase8-formal .bn-affair-v4 b{display:block;color:#f1d98d;font-size:13px;} body.tm-phase8-formal .memorial-card-head-v4 span,body.tm-phase8-formal .records-card-v4 p,body.tm-phase8-formal .bn-affair-v4 p{color:rgba(232,220,187,.70);font-size:12px;line-height:1.55;}',
      'body.tm-phase8-formal .memorial-body-v4{margin:10px 0 9px;padding:10px 12px;color:rgba(242,231,202,.82);background:linear-gradient(180deg,rgba(255,245,210,.045),rgba(0,0,0,.10));border-top:1px solid rgba(201,160,69,.13);border-bottom:1px solid rgba(201,160,69,.10);font-size:13px;line-height:1.65;}',
      'body.tm-phase8-formal .memorial-reply-v4{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:9px;align-items:end;} body.tm-phase8-formal .memorial-actions-v4,body.tm-phase8-formal .hy-actions-v4,body.tm-phase8-formal .records-card-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px;}',
      'body.tm-phase8-formal .hy-office-v4{display:grid;grid-template-columns:252px minmax(0,1fr) 302px;gap:14px;padding:16px;border:1px solid rgba(126,184,167,.36);background:radial-gradient(ellipse at 70% 8%,rgba(126,184,167,.13),transparent 40%),linear-gradient(180deg,rgba(23,31,29,.98),rgba(9,10,9,.96));}',
      'body.tm-phase8-formal .hy-roster-v4,body.tm-phase8-formal .hy-thread-v4,body.tm-phase8-formal .hy-compose-v4{border:1px solid rgba(126,184,167,.18);background:rgba(0,0,0,.18);} body.tm-phase8-formal .hy-roster-v4,body.tm-phase8-formal .hy-compose-v4{padding:12px;}',
      'body.tm-phase8-formal .hy-route-v4{margin-bottom:10px;padding:9px 10px;border:1px solid rgba(198,139,69,.24);color:#eadbb4;background:linear-gradient(90deg,rgba(95,44,27,.40),rgba(0,0,0,.12));font-size:11.5px;line-height:1.45;}',
      'body.tm-phase8-formal .hy-region-v4{margin:10px 0 5px;color:rgba(240,214,141,.82);font-size:11.5px;letter-spacing:.14em;} body.tm-phase8-formal .hy-person-v4{display:grid;grid-template-columns:30px minmax(0,1fr) auto;gap:8px;align-items:center;min-height:45px;padding:7px 8px;margin-bottom:6px;} body.tm-phase8-formal .hy-face-v4{width:28px;height:28px;display:grid;place-items:center;border:1px solid rgba(126,184,167,.30);border-radius:50%;color:#d7f0df;background:radial-gradient(circle,rgba(126,184,167,.22),rgba(13,24,22,.92));}',
      'body.tm-phase8-formal .hy-thread-v4{min-height:0;overflow:auto;padding:12px;scrollbar-color:rgba(126,184,167,.44) rgba(0,0,0,.22);} body.tm-phase8-formal .hy-contact-head-v4{display:grid;grid-template-columns:54px minmax(0,1fr) auto;gap:10px;align-items:center;margin-bottom:10px;padding:10px;border:1px solid rgba(126,184,167,.18);background:linear-gradient(90deg,rgba(126,184,167,.12),rgba(255,245,210,.035));}',
      'body.tm-phase8-formal .hy-contact-head-v4 .portrait{width:50px;height:50px;display:grid;place-items:center;border:1px solid rgba(126,184,167,.36);color:#e8f6df;background:radial-gradient(circle,rgba(126,184,167,.28),rgba(11,19,18,.92));font-size:22px;} body.tm-phase8-formal .hy-contact-head-v4 b{color:#f0d892;font-size:15px;} body.tm-phase8-formal .hy-contact-head-v4 span{display:block;margin-top:4px;color:rgba(224,211,171,.58);font-size:12px;}',
      'body.tm-phase8-formal .hy-message-v4{margin-bottom:9px;padding:10px 11px;border:1px solid rgba(126,184,167,.16);background:rgba(255,245,210,.045);} body.tm-phase8-formal .hy-message-v4.out{margin-left:46px;border-right:2px solid rgba(126,184,167,.55);} body.tm-phase8-formal .hy-message-v4.in{margin-right:46px;border-left:2px solid rgba(213,92,64,.52);} body.tm-phase8-formal .hy-message-v4 b{display:block;color:#f0d892;font-size:12px;} body.tm-phase8-formal .hy-message-v4 p{margin:7px 0;color:rgba(238,228,197,.78);font-size:12.5px;line-height:1.58;}',
      'body.tm-phase8-formal .hy-message-v4.transit{border-color:rgba(126,184,167,.30);background:rgba(69,120,100,.10);} body.tm-phase8-formal .hy-message-v4.lost,body.tm-phase8-formal .hy-message-v4.intercepted{border-color:rgba(213,92,64,.34);background:rgba(126,31,24,.16);}',
      'body.tm-phase8-formal .hy-filterbar-v4{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px;} body.tm-phase8-formal .hy-filterbar-v4 button{min-height:26px;padding:3px 9px;border:1px solid rgba(126,184,167,.18);color:#d9eddf;background:rgba(255,245,210,.035);font-family:inherit;font-size:12px;cursor:pointer;} body.tm-phase8-formal .hy-filterbar-v4 button.active{border-color:rgba(126,184,167,.42);background:linear-gradient(180deg,rgba(58,104,86,.44),rgba(13,24,22,.66));}',
      'body.tm-phase8-formal .hy-intercept-v4{margin-top:12px;padding-top:10px;border-top:1px solid rgba(126,184,167,.18);}',
      'body.tm-phase8-formal .hy-compose-v4 label{display:block;margin-bottom:8px;} body.tm-phase8-formal .hy-compose-v4 label span{display:block;margin-bottom:4px;color:rgba(224,211,171,.58);font-size:11.5px;}',
      'body.tm-phase8-formal .hy-office-v5{height:100%;box-sizing:border-box;display:grid;grid-template-columns:286px minmax(0,1fr) 284px;gap:14px;padding:16px;border:1px solid rgba(126,184,167,.36);background:radial-gradient(ellipse at 76% 4%,rgba(126,184,167,.14),transparent 42%),radial-gradient(ellipse at 18% 0,rgba(201,160,69,.08),transparent 36%),linear-gradient(180deg,rgba(22,31,29,.98),rgba(8,10,9,.97));overflow:hidden;}',
      'body.tm-phase8-formal .hy-contact-pane-v5,body.tm-phase8-formal .hy-compose-card-v5,body.tm-phase8-formal .hy-thread-card-v5,body.tm-phase8-formal .hy-inbox-pane-v5{min-height:0;border:1px solid rgba(126,184,167,.18);background:linear-gradient(180deg,rgba(255,245,210,.045),rgba(0,0,0,.12)),rgba(0,0,0,.18);box-shadow:inset 0 1px 0 rgba(255,245,210,.05);}',
      'body.tm-phase8-formal .hy-contact-pane-v5{display:grid;grid-template-rows:auto auto minmax(0,1fr);padding:12px;overflow:hidden;}',
      'body.tm-phase8-formal .hy-search-v5{margin-bottom:10px;} body.tm-phase8-formal .hy-roster-scroll-v5{min-height:0;overflow:auto;padding-right:4px;scrollbar-color:rgba(126,184,167,.44) rgba(0,0,0,.22);} body.tm-phase8-formal .hy-region-group-v5{margin-bottom:9px;}',
      'body.tm-phase8-formal .hy-person-v5{width:100%;display:grid;grid-template-columns:48px minmax(0,1fr) auto;gap:9px;align-items:center;min-height:64px;margin-bottom:7px;padding:7px 8px;border:1px solid rgba(126,184,167,.18);color:#eadfbd;background:rgba(255,245,210,.035);cursor:pointer;text-align:left;font-family:inherit;}',
      'body.tm-phase8-formal .hy-person-v5.active{border-color:rgba(239,201,116,.52);background:linear-gradient(90deg,rgba(58,104,86,.46),rgba(255,245,210,.055));box-shadow:inset 3px 0 0 rgba(126,184,167,.82);} body.tm-phase8-formal .hy-person-v5:hover{border-color:rgba(126,184,167,.38);background:rgba(126,184,167,.075);}',
      // 群发·多选 (A·2026-05-29)
      'body.tm-phase8-formal .hy-multi-bar-v5{display:flex;align-items:center;gap:8px;margin-top:8px;flex-wrap:wrap;} body.tm-phase8-formal .hy-multi-toggle-v5{letter-spacing:.06em;}',
      'body.tm-phase8-formal .hy-multi-hint-v5{flex:1;min-width:96px;font-size:11px;line-height:1.45;color:rgba(232,220,187,.52);}',
      'body.tm-phase8-formal .hy-person-v5.multi-sel{border-color:rgba(239,201,116,.62);background:linear-gradient(90deg,rgba(120,90,30,.40),rgba(255,245,210,.05));box-shadow:inset 3px 0 0 rgba(239,201,116,.9);}',
      'body.tm-phase8-formal .hy-person-counts-v5 em.msel{font-style:normal;font-size:15px;line-height:1;color:rgba(232,220,187,.40);} body.tm-phase8-formal .hy-person-counts-v5 em.msel.on{color:#f2d98d;}',
      'body.tm-phase8-formal .hy-multi-banner-v5{margin:0 0 10px;padding:8px 10px;border:1px solid rgba(239,201,116,.35);background:rgba(120,90,30,.18);color:#eadfbd;font-size:12px;line-height:1.5;} body.tm-phase8-formal .hy-multi-banner-v5 b{color:#f2d98d;margin-right:4px;} body.tm-phase8-formal .hy-multi-banner-v5 small{display:block;margin-top:3px;font-size:11.5px;color:rgba(232,220,187,.55);}',
      'body.tm-phase8-formal .hy-face-v5{width:46px;height:54px;object-fit:cover;border:1px solid rgba(126,184,167,.32);background:rgba(0,0,0,.28);box-shadow:0 5px 12px rgba(0,0,0,.24);} body.tm-phase8-formal .hy-person-main-v5{min-width:0;} body.tm-phase8-formal .hy-person-main-v5 b{display:block;color:#f0d892;font-size:13px;white-space:normal;overflow:visible;text-overflow:clip;line-height:1.35;} body.tm-phase8-formal .hy-person-main-v5 span,body.tm-phase8-formal .hy-person-main-v5 i{display:block;margin-top:3px;color:rgba(232,220,187,.58);font-size:11.5px;white-space:normal;overflow:visible;text-overflow:clip;font-style:normal;line-height:1.35;}',
      'body.tm-phase8-formal .hy-person-counts-v5{display:flex;flex-direction:column;gap:4px;align-items:flex-end;} body.tm-phase8-formal .hy-person-counts-v5 em{min-width:20px;height:18px;display:grid;place-items:center;border:1px solid rgba(126,184,167,.24);border-radius:999px;color:#d9eddf;background:rgba(0,0,0,.18);font-size:11px;font-style:normal;} body.tm-phase8-formal .hy-person-counts-v5 em.hot{border-color:rgba(213,92,64,.38);color:#f0a082;background:rgba(126,31,24,.18);} body.tm-phase8-formal .hy-person-counts-v5 em.on{border-color:rgba(239,201,116,.42);color:#f5db96;}',
      'body.tm-phase8-formal .hy-letter-desk-v5{min-height:0;display:grid;grid-template-rows:auto minmax(0,1fr);gap:12px;overflow:hidden;}',
      'body.tm-phase8-formal .hy-compose-card-v5{padding:13px 14px;} body.tm-phase8-formal .hy-compose-card-v5>header{display:grid;grid-template-columns:64px minmax(0,1fr) auto;gap:11px;align-items:center;margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid rgba(126,184,167,.16);} body.tm-phase8-formal .hy-compose-card-v5>header img{width:60px;height:66px;object-fit:cover;border:1px solid rgba(126,184,167,.34);background:rgba(0,0,0,.25);} body.tm-phase8-formal .hy-compose-card-v5>header b{display:block;color:#f0d892;font-size:18px;} body.tm-phase8-formal .hy-compose-card-v5>header em{display:block;margin-top:4px;color:rgba(232,220,187,.60);font-size:12px;font-style:normal;}',
      'body.tm-phase8-formal .hy-route-v5{margin-bottom:10px;padding:7px 9px;border:1px solid rgba(198,139,69,.24);color:#eadbb4;background:linear-gradient(90deg,rgba(95,44,27,.34),rgba(0,0,0,.10));font-size:11.5px;line-height:1.45;} body.tm-phase8-formal .hy-route-warning-v5 b{display:block;margin-bottom:5px;color:#f0d892;font-size:12px;} body.tm-phase8-formal .hy-route-full-v5{margin-top:4px;color:#f0d0a2;line-height:1.55;} body.tm-phase8-formal .hy-route-note-full-v5{color:inherit;}',
      'body.tm-phase8-formal .hy-compose-grid-v5{display:grid;grid-template-columns:1.1fr repeat(4,minmax(96px,.7fr));gap:8px;margin-bottom:8px;} body.tm-phase8-formal .hy-compose-grid-v5 label span{display:block;margin-bottom:4px;color:rgba(232,220,187,.80);font-size:12px;letter-spacing:.05em;} body.tm-phase8-formal .hy-compose-paper-v5{min-height:104px;max-height:180px;resize:vertical;} body.tm-phase8-formal .hy-compose-actions-v5{display:flex;flex-wrap:wrap;gap:7px;align-items:center;}',
      'body.tm-phase8-formal .hy-thread-card-v5{display:grid;grid-template-rows:auto minmax(0,1fr);overflow:hidden;} body.tm-phase8-formal .hy-thread-card-v5>header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border-bottom:1px solid rgba(126,184,167,.16);background:rgba(0,0,0,.12);} body.tm-phase8-formal .hy-thread-card-v5>header b{display:block;color:#f0d892;font-size:16px;} body.tm-phase8-formal .hy-thread-card-v5>header em{display:block;margin-top:3px;color:rgba(232,220,187,.56);font-size:12px;font-style:normal;} body.tm-phase8-formal .hy-thread-scroll-v5{min-height:0;overflow:auto;padding:13px 14px 16px;scrollbar-color:rgba(126,184,167,.44) rgba(0,0,0,.22);}',
      'body.tm-phase8-formal .hy-filterbar-v5{display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end;} body.tm-phase8-formal .hy-filterbar-v5 button{min-height:26px;padding:3px 9px;border:1px solid rgba(126,184,167,.18);color:#d9eddf;background:rgba(255,245,210,.035);font-family:inherit;font-size:12px;cursor:pointer;} body.tm-phase8-formal .hy-filterbar-v5 button.active{border-color:rgba(126,184,167,.46);background:linear-gradient(180deg,rgba(58,104,86,.44),rgba(13,24,22,.66));}',
      'body.tm-phase8-formal .hy-letter-card-v5{position:relative;display:grid;grid-template-columns:42px minmax(0,1fr);gap:10px;margin-bottom:10px;padding:11px;border:1px solid rgba(126,184,167,.16);background:linear-gradient(180deg,rgba(255,245,210,.052),rgba(0,0,0,.12)),rgba(15,18,16,.74);box-shadow:0 8px 18px rgba(0,0,0,.20);} body.tm-phase8-formal .hy-letter-card-v5.out{margin-left:42px;border-right:2px solid rgba(126,184,167,.58);} body.tm-phase8-formal .hy-letter-card-v5.in{margin-right:42px;border-left:2px solid rgba(213,92,64,.48);} body.tm-phase8-formal .hy-letter-card-v5.lost,body.tm-phase8-formal .hy-letter-card-v5.intercepted{border-color:rgba(213,92,64,.38);background:rgba(126,31,24,.14);} body.tm-phase8-formal .hy-letter-card-v5.transit{border-color:rgba(126,184,167,.30);background:rgba(69,120,100,.10);}',
      'body.tm-phase8-formal .hy-letter-stamp-v5{width:38px;height:38px;display:grid;place-items:center;border:1px solid rgba(126,184,167,.32);border-radius:50%;color:#dff2e1;background:radial-gradient(circle,rgba(126,184,167,.22),rgba(13,24,22,.94));font-size:16px;} body.tm-phase8-formal .hy-letter-main-v5{min-width:0;} body.tm-phase8-formal .hy-letter-main-v5 header{display:grid;grid-template-columns:minmax(0,auto) minmax(0,1fr) auto;gap:8px;align-items:start;} body.tm-phase8-formal .hy-letter-main-v5 header b{color:#f0d892;font-size:13px;} body.tm-phase8-formal .hy-letter-main-v5 header span{color:rgba(232,220,187,.62);font-size:12px;white-space:normal;overflow:visible;text-overflow:clip;line-height:1.35;} body.tm-phase8-formal .hy-letter-main-v5 header em{color:#a8dcc5;font-size:12px;font-style:normal;}',
      'body.tm-phase8-formal .hy-letter-meta-v5{display:flex;flex-wrap:wrap;gap:5px;margin:7px 0;} body.tm-phase8-formal .hy-letter-meta-v5 span{display:inline-flex;align-items:center;min-height:18px;padding:1px 6px;border:1px solid rgba(126,184,167,.16);color:rgba(224,237,222,.72);background:rgba(255,245,210,.035);font-size:11px;} body.tm-phase8-formal .hy-fulltext-v5{display:block;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;max-width:100%;} body.tm-phase8-formal .hy-letter-body-v5{white-space:pre-wrap;overflow:visible;color:rgba(242,231,202,.93);font-size:13px;line-height:1.8;padding:9px 10px;border-top:1px solid rgba(126,184,167,.12);border-bottom:1px solid rgba(126,184,167,.10);background:rgba(0,0,0,.10);} body.tm-phase8-formal .hy-letter-reply-v5{margin-top:8px;padding:9px 10px;border:1px solid rgba(201,160,69,.18);background:rgba(201,160,69,.07);} body.tm-phase8-formal .hy-letter-reply-v5 b{display:block;color:#f0d892;font-size:12px;} body.tm-phase8-formal .hy-letter-reply-v5 p{white-space:pre-wrap;margin:5px 0 0;color:rgba(242,231,202,.82);font-size:12.5px;line-height:1.65;}',
      'body.tm-phase8-formal .hy-actions-v5{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px;} body.tm-phase8-formal .hy-letter-empty-v5{padding:20px 18px;border:1px dashed rgba(126,184,167,.36);color:rgba(232,220,187,.78);background:rgba(0,0,0,.12);text-align:center;} body.tm-phase8-formal .hy-letter-empty-v5 b{display:block;color:#f4dc97;font-size:15px;letter-spacing:.06em;} body.tm-phase8-formal .hy-letter-empty-v5 p{margin:7px 0 0;font-size:12.5px;line-height:1.7;}',
      'body.tm-phase8-formal .hy-inbox-pane-v5{display:grid;grid-template-rows:auto auto minmax(0,1fr);padding:12px;overflow:hidden;} body.tm-phase8-formal .hy-inbox-summary-v5{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-bottom:10px;} body.tm-phase8-formal .hy-inbox-summary-v5 span{padding:7px 8px;border:1px solid rgba(126,184,167,.14);color:rgba(232,220,187,.62);background:rgba(0,0,0,.14);font-size:12px;} body.tm-phase8-formal .hy-inbox-summary-v5 b{color:#f0d892;font-size:14px;} body.tm-phase8-formal .hy-inbox-scroll-v5{min-height:0;overflow:auto;padding-right:4px;scrollbar-color:rgba(126,184,167,.44) rgba(0,0,0,.22);}',
      'body.tm-phase8-formal .hy-inbox-item-v5{margin-bottom:10px;padding:9px;border:1px solid rgba(126,184,167,.16);background:linear-gradient(180deg,rgba(255,245,210,.050),rgba(0,0,0,.12)),rgba(10,14,13,.68);} body.tm-phase8-formal .hy-inbox-item-v5.unread{border-color:rgba(213,92,64,.32);box-shadow:inset 3px 0 0 rgba(213,92,64,.58);} body.tm-phase8-formal .hy-inbox-open-v5{width:100%;display:grid;grid-template-columns:34px minmax(0,1fr) auto;gap:8px;align-items:start;border:0;background:transparent;color:#eadfbd;text-align:left;font-family:inherit;cursor:pointer;padding:0;} body.tm-phase8-formal .hy-inbox-seal-v5{width:32px;height:32px;display:grid;place-items:center;border:1px solid rgba(126,184,167,.30);border-radius:50%;color:#dff2e1;background:radial-gradient(circle,rgba(126,184,167,.22),rgba(13,24,22,.94));} body.tm-phase8-formal .hy-inbox-open-v5 b{display:block;color:#f0d892;font-size:12.5px;white-space:normal;overflow:visible;text-overflow:clip;line-height:1.35;} body.tm-phase8-formal .hy-inbox-open-v5 em{display:block;margin-top:3px;color:rgba(232,220,187,.58);font-size:11.5px;font-style:normal;white-space:normal;overflow:visible;text-overflow:clip;line-height:1.35;} body.tm-phase8-formal .hy-inbox-open-v5 i{padding:2px 6px;border:1px solid rgba(126,184,167,.18);border-radius:999px;color:#a8dcc5;font-size:11px;font-style:normal;background:rgba(0,0,0,.16);}',
      'body.tm-phase8-formal .hy-inbox-meta-v5{display:flex;flex-wrap:wrap;gap:5px;margin:8px 0 6px;} body.tm-phase8-formal .hy-inbox-meta-v5 span{padding:1px 6px;border:1px solid rgba(126,184,167,.14);color:rgba(224,237,222,.68);background:rgba(255,245,210,.035);font-size:11px;} body.tm-phase8-formal .hy-inbox-body-v5{white-space:pre-wrap;color:rgba(242,231,202,.90);font-size:12px;line-height:1.7;padding:7px 8px;border-top:1px solid rgba(126,184,167,.10);border-bottom:1px solid rgba(126,184,167,.08);background:rgba(0,0,0,.10);}',
      'body.tm-phase8-formal .records-cabinet-v4{display:grid;grid-template-columns:118px minmax(0,1fr);padding:16px;border:1px solid rgba(214,177,88,.36);background:radial-gradient(ellipse at 18% 0,rgba(214,177,88,.10),transparent 40%),linear-gradient(180deg,rgba(42,30,20,.98),rgba(11,9,7,.96));}',
      'body.tm-phase8-formal .records-spine-v4{padding:12px 8px;border-right:1px solid rgba(214,177,88,.22);} body.tm-phase8-formal .records-tab-v4{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px;align-items:center;min-height:82px;margin-bottom:8px;padding:8px 7px;writing-mode:vertical-rl;text-align:center;background:linear-gradient(180deg,rgba(88,55,24,.72),rgba(18,12,8,.72));}',
      'body.tm-phase8-formal .records-tab-v4 em{color:rgba(224,211,171,.48);font-style:normal;font-size:11px;} body.tm-phase8-formal .records-toolbar-v4{display:flex;align-items:center;flex-wrap:wrap;gap:7px;margin-bottom:12px;} body.tm-phase8-formal .records-grid-v4,body.tm-phase8-formal .bn-active-grid-v4{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;} body.tm-phase8-formal .records-section-v4{margin-bottom:14px;}',
      'body.tm-phase8-formal .tm-roster-group{margin:10px 0 7px;color:rgba(240,214,141,.82);font-size:12px;letter-spacing:.16em;}',
      'body.tm-phase8-formal .records-source-legend-v4{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 12px;} body.tm-phase8-formal .records-source-legend-v4 button,body.tm-phase8-formal .records-toolbar-v4 button{min-height:28px;padding:4px 10px;border:1px solid rgba(201,160,69,.20);color:#eadfbd;background:rgba(0,0,0,.18);font-family:inherit;font-size:12px;cursor:pointer;} body.tm-phase8-formal .records-source-legend-v4 button.active,body.tm-phase8-formal .records-toolbar-v4 button.active{border-color:rgba(239,201,116,.52);background:linear-gradient(180deg,rgba(122,45,32,.34),rgba(255,245,210,.045));}',
      'body.tm-phase8-formal .bn-progress-v4{height:7px;margin-top:8px;border:1px solid rgba(201,160,69,.16);background:rgba(0,0,0,.30);overflow:hidden;} body.tm-phase8-formal .bn-progress-v4 i{display:block;height:100%;background:linear-gradient(90deg,#8a3227,#dfba6f);}',
      'body.tm-phase8-formal .records-cabinet-v5{height:100%;box-sizing:border-box;display:grid;grid-template-columns:176px minmax(0,1fr) 296px;gap:14px;padding:16px;border:1px solid rgba(214,177,88,.38);background:radial-gradient(ellipse at 16% 0,rgba(214,177,88,.12),transparent 42%),radial-gradient(ellipse at 86% 8%,rgba(126,31,24,.13),transparent 36%),linear-gradient(180deg,rgba(42,30,20,.985),rgba(10,8,7,.97));overflow:hidden;}',
      'body.tm-phase8-formal .records-spine-v5,body.tm-phase8-formal .records-paper-v5,body.tm-phase8-formal .records-detail-v5{min-height:0;border:1px solid rgba(201,160,69,.18);background:linear-gradient(180deg,rgba(255,245,210,.050),rgba(0,0,0,.12)),rgba(0,0,0,.16);box-shadow:inset 0 1px 0 rgba(255,236,178,.05);}',
      'body.tm-phase8-formal .records-spine-v5{display:grid;grid-template-rows:auto minmax(0,1fr) auto auto;gap:10px;padding:12px;overflow:hidden;border-left:4px solid rgba(126,31,24,.64);}',
      'body.tm-phase8-formal .records-tab-v5{width:100%;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px;align-items:center;margin-bottom:7px;padding:9px 8px;border:1px solid rgba(201,160,69,.15);color:#eadfbd;background:linear-gradient(90deg,rgba(0,0,0,.24),rgba(255,245,210,.030));font-family:inherit;text-align:left;cursor:pointer;} body.tm-phase8-formal .records-tab-v5.active{border-color:rgba(239,201,116,.52);background:linear-gradient(90deg,rgba(126,31,24,.38),rgba(255,245,210,.055));box-shadow:inset 3px 0 0 rgba(214,169,82,.82);} body.tm-phase8-formal .records-tab-v5 b{display:block;color:#f0d892;font-size:14px;letter-spacing:.14em;} body.tm-phase8-formal .records-tab-v5 span{display:block;margin-top:3px;color:rgba(232,220,187,.55);font-size:11.5px;} body.tm-phase8-formal .records-tab-v5 em{min-width:24px;height:22px;display:grid;place-items:center;border:1px solid rgba(201,160,69,.20);border-radius:999px;color:#f2ddb0;background:rgba(0,0,0,.20);font-style:normal;font-size:11.5px;}',
      'body.tm-phase8-formal .records-spine-note-v5{padding:9px;border:1px solid rgba(201,160,69,.14);background:rgba(0,0,0,.16);} body.tm-phase8-formal .records-spine-note-v5 b{display:block;color:#f0d892;font-size:12px;} body.tm-phase8-formal .records-spine-note-v5 p{margin:5px 0 0;color:rgba(232,220,187,.62);font-size:12px;line-height:1.55;}',
      'body.tm-phase8-formal .records-paper-v5{display:grid;grid-template-rows:auto auto minmax(0,1fr);overflow:hidden;padding:16px 18px;color:#eadfbd;} body.tm-phase8-formal .records-paper-head-v5{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding-bottom:12px;margin-bottom:12px;border-bottom:1px solid rgba(201,160,69,.18);} body.tm-phase8-formal .records-paper-head-v5 h2{margin:0;color:#f1d98d;font-size:25px;letter-spacing:.10em;} body.tm-phase8-formal .records-paper-head-v5 p{margin:4px 0 0;color:rgba(232,220,187,.58);font-size:12px;line-height:1.55;}',
      'body.tm-phase8-formal .records-toolbar-v5{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;margin-bottom:12px;} body.tm-phase8-formal .records-filter-v5{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 12px;} body.tm-phase8-formal .records-filter-v5 button{min-height:27px;padding:3px 9px;border:1px solid rgba(201,160,69,.18);color:#eadfbd;background:rgba(0,0,0,.18);font-family:inherit;font-size:11.5px;cursor:pointer;} body.tm-phase8-formal .records-filter-v5 button.active{border-color:rgba(239,201,116,.52);background:linear-gradient(180deg,rgba(122,45,32,.36),rgba(255,245,210,.050));}',
      'body.tm-phase8-formal .records-scroll-v5{min-height:0;overflow:auto;padding-right:5px;scrollbar-color:rgba(201,160,69,.48) rgba(0,0,0,.24);} body.tm-phase8-formal .records-section-v5{margin-bottom:14px;} body.tm-phase8-formal .records-section-title-v5{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 8px;color:#efd58b;font-size:17px;letter-spacing:.10em;} body.tm-phase8-formal .records-section-title-v5 small{color:rgba(232,220,187,.50);font-size:11.5px;font-weight:400;letter-spacing:.08em;}',
      'body.tm-phase8-formal .records-entry-v5{position:relative;margin-bottom:10px;padding:11px;border:1px solid rgba(201,160,69,.16);background:linear-gradient(90deg,rgba(126,32,24,.09),transparent 38%),linear-gradient(180deg,rgba(255,245,210,.052),rgba(0,0,0,.14)),rgba(19,14,11,.72);box-shadow:0 8px 18px rgba(0,0,0,.20),inset 0 1px 0 rgba(255,236,178,.045);} body.tm-phase8-formal .records-entry-v5::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:rgba(126,32,24,.58);} body.tm-phase8-formal .records-entry-v5.hot::before{background:rgba(213,92,64,.82);} body.tm-phase8-formal .records-entry-v5.active{border-color:rgba(239,201,116,.42);box-shadow:inset 3px 0 0 rgba(214,169,82,.65),0 8px 18px rgba(0,0,0,.20);}',
      'body.tm-phase8-formal .records-entry-v5 header{display:grid;grid-template-columns:40px minmax(0,1fr);gap:9px;align-items:start;margin-bottom:8px;} body.tm-phase8-formal .records-seal-v5{width:36px;height:36px;display:grid;place-items:center;border:1px solid rgba(201,160,69,.30);border-radius:50%;color:#f3d98c;background:radial-gradient(circle,rgba(201,160,69,.18),rgba(50,24,16,.92) 72%);font-size:15px;} body.tm-phase8-formal .records-entry-main-v5{min-width:0;} body.tm-phase8-formal .records-entry-main-v5 b{display:block;color:#f1d98d;font-size:13.5px;white-space:normal;overflow:visible;text-overflow:clip;line-height:1.45;} body.tm-phase8-formal .records-entry-main-v5 em{display:block;margin-top:3px;color:rgba(232,220,187,.56);font-size:11.5px;font-style:normal;white-space:normal;overflow:visible;text-overflow:clip;line-height:1.4;}',
      'body.tm-phase8-formal .records-fulltext-v5{display:block;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;max-width:100%;} body.tm-phase8-formal .records-entry-body-v5{white-space:pre-wrap;overflow:visible;margin:8px 0;padding:9px 10px;color:rgba(242,231,202,.84);border-top:1px solid rgba(201,160,69,.12);border-bottom:1px solid rgba(201,160,69,.10);background:rgba(0,0,0,.10);font-size:12.5px;line-height:1.75;} body.tm-phase8-formal .records-annot-v5{margin:8px 0;padding:8px 9px;border:1px solid rgba(126,184,167,.18);background:rgba(65,111,92,.10);} body.tm-phase8-formal .records-annot-v5 b{display:block;color:#a8dcc5;font-size:12px;} body.tm-phase8-formal .records-annot-v5 p{white-space:pre-wrap;margin:4px 0 0;color:rgba(232,240,220,.78);font-size:12px;line-height:1.62;}',
      'body.tm-phase8-formal .records-detail-v5{display:grid;grid-template-rows:auto auto minmax(180px,1fr) auto auto;gap:10px;padding:12px;overflow:auto;scrollbar-color:rgba(201,160,69,.48) rgba(0,0,0,.24);} body.tm-phase8-formal .records-detail-v5 h3{margin:0;color:#f1d98d;font-size:17px;line-height:1.35;letter-spacing:.08em;} body.tm-phase8-formal .records-detail-text-v5{min-height:180px;white-space:pre-wrap;overflow:auto;padding:10px;border:1px solid rgba(201,160,69,.16);background:rgba(0,0,0,.14);color:rgba(242,231,202,.86);font-size:12.5px;line-height:1.75;scrollbar-color:rgba(201,160,69,.42) rgba(0,0,0,.20);} body.tm-phase8-formal .records-detail-source-v5{display:none;} body.tm-phase8-formal .records-detail-actions-v5{display:flex;flex-wrap:wrap;gap:7px;} body.tm-phase8-formal .records-empty-v5,body.tm-phase8-formal .records-search-empty-v5{padding:20px;border:1px dashed rgba(201,160,69,.22);color:rgba(232,220,187,.66);background:rgba(0,0,0,.14);font-size:13px;}',
      'body.tm-phase8-formal .bn-active-grid-v5{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-bottom:10px;} body.tm-phase8-formal .bn-affair-v5{padding:11px;border:1px solid rgba(201,160,69,.16);background:linear-gradient(180deg,rgba(255,245,210,.052),rgba(0,0,0,.14)),rgba(19,14,11,.70);} body.tm-phase8-formal .bn-affair-v5 header{display:grid;grid-template-columns:40px minmax(0,1fr);gap:9px;align-items:start;margin-bottom:7px;} body.tm-phase8-formal .bn-affair-v5 b{display:block;color:#f1d98d;font-size:13px;line-height:1.45;} body.tm-phase8-formal .bn-affair-v5 em{display:block;margin-top:3px;color:rgba(232,220,187,.56);font-size:11.5px;font-style:normal;line-height:1.4;} body.tm-phase8-formal .bn-affair-v5 p{min-height:42px;margin:0 0 8px;color:rgba(242,231,202,.78);font-size:12px;line-height:1.6;} body.tm-phase8-formal .bn-progress-v5{height:7px;margin:7px 0;border:1px solid rgba(201,160,69,.16);background:rgba(0,0,0,.30);overflow:hidden;} body.tm-phase8-formal .bn-progress-v5 i{display:block;height:100%;background:linear-gradient(90deg,#8a3227,#dfba6f);}',
      '@media (max-width:1280px){body.tm-phase8-formal .memorial-office-v4{grid-template-columns:250px minmax(0,1fr)}body.tm-phase8-formal .hy-office-v4{grid-template-columns:220px minmax(0,1fr) 260px}body.tm-phase8-formal .hy-office-v5{grid-template-columns:258px minmax(0,1fr) 246px;gap:10px;padding:12px}body.tm-phase8-formal .hy-compose-grid-v5{grid-template-columns:repeat(3,minmax(0,1fr))}body.tm-phase8-formal .records-grid-v4,body.tm-phase8-formal .bn-active-grid-v4,body.tm-phase8-formal .bn-active-grid-v5{grid-template-columns:1fr}body.tm-phase8-formal .records-cabinet-v5{grid-template-columns:158px minmax(0,1fr) 270px;gap:10px;padding:12px}}',
      '@media (max-width:980px){body.tm-phase8-formal .tm-action-panel,body.tm-phase8-formal .tm-action-panel.edict-shell,body.tm-phase8-formal .tm-action-panel.memorial-shell,body.tm-phase8-formal .tm-action-panel.letter-shell,body.tm-phase8-formal .tm-action-panel.records-shell{left:12px;right:12px;top:64px;width:auto;height:calc(100vh - 86px);transform:none}body.tm-phase8-formal .tm-bridge-overlay.show .tm-action-panel.edict-shell,body.tm-phase8-formal .tm-bridge-overlay.show .tm-action-panel.letter-shell{transform:none}body.tm-phase8-formal .edict-old-panel,body.tm-phase8-formal .memorial-office-v4,body.tm-phase8-formal .hy-office-v4,body.tm-phase8-formal .hy-office-v5,body.tm-phase8-formal .records-cabinet-v4,body.tm-phase8-formal .records-cabinet-v5{display:block;overflow:auto}body.tm-phase8-formal .hy-letter-desk-v5{display:block;overflow:visible}body.tm-phase8-formal .hy-contact-pane-v5,body.tm-phase8-formal .hy-compose-card-v5,body.tm-phase8-formal .hy-thread-card-v5,body.tm-phase8-formal .hy-inbox-pane-v5,body.tm-phase8-formal .records-spine-v5,body.tm-phase8-formal .records-paper-v5,body.tm-phase8-formal .records-detail-v5{margin-bottom:10px}body.tm-phase8-formal .hy-compose-grid-v5{grid-template-columns:1fr}body.tm-phase8-formal .records-toolbar-v5{grid-template-columns:1fr}body.tm-phase8-formal .tm-stat-strip{grid-template-columns:repeat(2,minmax(0,1fr))}}'
    ].join('\n'); if (st.__tmCss !== __css) { st.__tmCss = __css; st.textContent = __css; }
  }

  function actionShell(kind, body){
    installActionPanelExactStyles();
    return '<section class="tm-bridge-panel tm-action-panel ' + attr(kind) + '-shell" role="dialog" aria-modal="true">' +
      '<button type="button" class="tm-action-close tm-floating-close" data-close-bridge="1" title="关闭">×</button>' +
      '<div class="tm-action-body ' + attr(kind) + '">' + body + '</div>' +
      '</section>';
  }

  function actionChip(text, cls){
    return '<span class="tm-chip ' + attr(cls || '') + '">' + esc(text == null || text === '' ? '未记' : text) + '</span>';
  }

  function actionBtn(label, action, data, cls){
    data = data || {};
    var attrs = Object.keys(data).map(function(k){
      // camelCase key → kebab data 属性·使 el.dataset 读回同名驼峰 (letterAction→data-letter-action→dataset.letterAction)·
      // 否则 HTML 会把 data-letterAction 小写成 data-letteraction → dataset.letterAction 为 undefined·
      // handleDeskAction 的 data.letterAction 判定全落空·往来信札动作(追回/重发/核实/回书/摘入/星标/绕封锁)点了不执行 (修复 2026-05-29)
      var kebab = k.replace(/[A-Z]/g, function(m){ return '-' + m.toLowerCase(); });
      return ' data-' + attr(kebab) + '="' + attr(data[k]) + '"';
    }).join('');
    return '<button type="button" class="' + attr(cls || 'tm-mini-btn') + '" data-desk-action="' + attr(action) + '"' + attrs + '>' + esc(label) + '</button>';
  }

  function renderActionStats(rows){
    return '<div class="tm-stat-strip v4">' + rows.map(function(r){
      return '<div class="tm-stat"><span>' + esc(r[0]) + '</span><b>' + esc(r[1] == null || r[1] === '' ? '—' : r[1]) + '</b></div>';
    }).join('') + '</div>';
  }

  function getEdictSuggestionRows(){
    var gm = window.GM || {};
    var list = Array.isArray(gm._edictSuggestions) ? gm._edictSuggestions : (Array.isArray(gm.edictSuggestions) ? gm.edictSuggestions : []);
    return list.map(function(x, i){
      x = x || {};
      return {
        id: x.id || ('edict-sug-' + i),
        realIndex: i,
        title: x.title || x.topic || x.source || '草诏建议',
        source: x.source || '御案',
        from: x.from || x.proposer || '',
        topic: x.topic || x.title || '',
        text: x.draftText || x.text || x.content || x.body || '',
        content: x.draftText || x.content || x.text || x.body || '',
        portrait: x.portrait || x.avatar || x.image || x.img || x.photo || x.characterImage || '',
        tags: x.tags || [],
        turn: x.turn || 0,
        used: !!x.used
      };
    }).filter(function(x){ return !x.used; }).sort(function(a, b){
      var ta = Number(a.turn || 0);
      var tb = Number(b.turn || 0);
      if (tb !== ta) return tb - ta;
      return a.realIndex - b.realIndex;
    });
  }

  function ensureFormalEdictDrafts(){
    if (!state.edictDrafts) state.edictDrafts = {};
    if (!state.edictDrafts.policy && state.edictDraft && state.edictDraft.length) {
      state.edictDrafts.policy = state.edictDraft.join('\n');
    }
    return state.edictDrafts;
  }

  function normalizeFormalImageSrc(src){
    src = String(src || '').trim();
    if (!src || src === '[IMG]') return '';
    if (/^(https?:|data:|blob:|\/|preview\/|assets\/)/.test(src)) return src;
    if (src.indexOf('img/') === 0) return 'preview/' + src;
    if (src.indexOf('portraits/') === 0) return 'preview/img/' + src;
    return src;
  }

  function formalEdictSourceName(value){
    var raw = String(value || '').trim();
    if (!raw) return '';
    return raw
      .replace(/^[\s\[]+|[\s\]]+$/g, '')
      .split(/[：:，,。.；;、（）()【】\[\]「」『』·\s]/)[0]
      .trim();
  }

  function findFormalEdictPerson(name){
    var raw = String(name || '').trim();
    if (!raw) return null;
    var clean = formalEdictSourceName(raw) || raw;
    var candidates = [raw, clean].filter(Boolean);
    if (typeof window.findCharByName === 'function') {
      for (var i = 0; i < candidates.length; i += 1) {
        try {
          var found = window.findCharByName(candidates[i]);
          if (found) return found;
        } catch(_) {}
      }
    }
    var people = getPeople();
    for (var p = 0; p < people.length; p += 1) {
      var person = people[p];
      if (!person) continue;
      var key = personKey(person);
      var pname = String(person.name || '');
      var compactName = personNameKey(person);
      for (var c = 0; c < candidates.length; c += 1) {
        var cand = String(candidates[c] || '');
        var compactCand = cand.replace(/\s+/g, '');
        if (key === cand || pname === cand || compactName === compactCand) return person;
        if (compactName && compactCand && (compactCand.indexOf(compactName) >= 0 || compactName.indexOf(compactCand) >= 0)) return person;
      }
    }
    return null;
  }

  function edictPortraitForFormal(s){
    var direct = normalizeFormalImageSrc(s && (s.portrait || s.avatar || s.image || s.img || s.photo || s.characterImage));
    if (direct) return direct;
    var person = findFormalEdictPerson(s && s.from);
    if (person && typeof tmfRenwuPortrait === 'function') {
      try {
        var portrait = normalizeFormalImageSrc(tmfRenwuPortrait(person));
        if (portrait) return portrait;
      } catch(_) {}
    }
    var text = [s && s.source, s && s.title, (s && s.tags || []).join(' ')].join(' ');
    if (/军|兵|边|镇|将/.test(text)) return asset('portraits/ming-general-ai.png');
    if (/内廷|司礼|东厂|宦/.test(text)) return asset('portraits/ming-eunuch-ai.png');
    if (/讲|学|礼|儒|史/.test(text)) return asset('portraits/ming-scholar-ai.png');
    return asset('portraits/ming-civil-ai.png');
  }

  function edictSuggestionPortraitHtml(x){
    var name = formalEdictSourceName((x && (x.from || x.source || x.title)) || '') || '\u81e3';
    var glyph = name.slice(0, 1) || '\u81e3';
    return '<span class="edict-sug-portrait-wrap" data-glyph="' + attr(glyph) + '">' +
      '<img class="edict-sug-portrait" loading="lazy" decoding="async" src="' + attr(edictPortraitForFormal(x)) + '" alt="" onerror="this.style.display=\'none\';this.parentNode.classList.add(\'fallback\');">' +
      '</span>';
  }

  function legacyEdictDraftValue(id, keys){
    var root = document.querySelector('.tm-desk-overlay');
    var live = root && root.querySelector ? root.querySelector('#' + cssEscape(id)) : null;
    if (live && typeof live.value === 'string') return live.value;
    var drafts = ensureFormalEdictDrafts();
    for (var i = 0; i < keys.length; i++) {
      if (drafts[keys[i]]) return drafts[keys[i]];
    }
    if (id === 'edict-pol' && state.edictDraft && state.edictDraft.length) return state.edictDraft.join('\n');
    return '';
  }

  function renderEdictSuggestionItem(x, index){
    var realIndex = x.realIndex == null ? index : x.realIndex;
    return '<article class="edict-sug-v2">' +
      edictSuggestionPortraitHtml(x) +
      '<div><b>【' + esc(x.source || '御案') + (x.from ? ' · ' + esc(x.from) : '') + '】</b>' +
      (x.topic ? '<p style="margin-bottom:2px;color:#c9a045;font-style:italic;">〔' + esc(x.topic) + '〕</p>' : '') +
      '<p>' + esc(compactText(x.text || x.content || '可纳入诏令草拟。', 92)) + '</p>' +
      '<div class="edict-sug-footer"><span class="tm-chip-row">' + actionChip(getTurnText((window.GM && GM.turn) || 1), 'green') + (x.tags || []).slice(0, 2).map(function(t){ return actionChip(t, /急|军|危/.test(String(t)) ? 'hot' : ''); }).join('') + '</span>' +
      '<span><button type="button" class="edict-sug-adopt" onclick="if(window.TMPhase8FormalBridge)TMPhase8FormalBridge.showEdictAdoptMenu(event,' + attr(realIndex) + ');return false;">纳 入</button>' +
      '<button type="button" class="edict-sug-delete" title="删除" onclick="if(window.TMPhase8FormalBridge)TMPhase8FormalBridge.dismissEdictSuggestion(' + attr(realIndex) + ');return false;">×</button></span></div></div></article>';
  }

  function formalEdictSuggestionList(){
    var gm = window.GM || {};
    return Array.isArray(gm._edictSuggestions) ? gm._edictSuggestions : (Array.isArray(gm.edictSuggestions) ? gm.edictSuggestions : []);
  }

  function formalEdictDraftKeys(catId){
    var keyMap = {
      'edict-pol':['policy','political'],
      'edict-mil':['military'],
      'edict-dip':['diplomatic','diplomacy'],
      'edict-eco':['finance','economic','economy'],
      'edict-oth':['other','private']
    };
    return keyMap[catId] || ['policy'];
  }

  function findFormalEdictDraftInput(catId, root){
    var selector = '#' + cssEscape(catId);
    var scoped = root && root.closest ? root.closest('.tm-desk-overlay') : root;
    if (scoped && scoped.querySelector) {
      var scopedEl = scoped.querySelector(selector);
      if (scopedEl) return scopedEl;
    }
    var actionOverlay = document.getElementById('tm-action-edict-overlay');
    if (actionOverlay && actionOverlay.querySelector) {
      var actionEl = actionOverlay.querySelector(selector);
      if (actionEl) return actionEl;
    }
    var currentOverlay = document.querySelector('.tm-desk-overlay');
    if (currentOverlay && currentOverlay.querySelector) {
      var currentEl = currentOverlay.querySelector(selector);
      if (currentEl) return currentEl;
    }
    return null;
  }

  function syncFormalEdictDraft(catId, value){
    state.edictDrafts = state.edictDrafts || {};
    formalEdictDraftKeys(catId).forEach(function(key){
      state.edictDrafts[key] = value || '';
    });
  }

  function writeFormalEdictDraftInput(catId, value){
    var ta = findFormalEdictDraftInput(catId);
    if (!ta) return false;
    ta.value = value || '';
    try {
      var row = ta.closest && ta.closest('.erow');
      if (row) {
        var seal = row.querySelector('.cell-seal');
        if (seal) seal.classList.toggle('inked', !!String(value || '').trim());
      }
    } catch(_) {}
    try {
      if (typeof window._edictLiveForecast === 'function') window._edictLiveForecast(catId);
    } catch(_) {}
    return true;
  }

  function applyFormalPolishedEdict(text, mode){
    text = String(text || '').trim();
    if (!text || mode !== 'replace') return false;
    // 整体颁行（颁行天下）：润色稿是各类草拟「合并润色成的一道完整诏书」，已由 _applyPolishedEdict
    // 写入 GM.edicts(status=promulgated)。回合推演把这道诏书全文当作「一道诏书」整体处理
    //（见 tm-endturn-prep 注入 edicts.decree）。故此处清空五类草拟，避免诏书内容被误标为政令、
    // 或与分类草拟重复推演。留档(手稿入档,mode!=='replace')不走此路·分类草拟保留。
    ['edict-pol', 'edict-mil', 'edict-dip', 'edict-eco', 'edict-oth'].forEach(function(id){
      syncFormalEdictDraft(id, '');
      writeFormalEdictDraftInput(id, '');
    });
    saveFormalDraftsToGM(true);
    syncFormalEdictDraftsToLegacyInputs();
    // 2026-06-11·治「颁行后诏书直接消失」:清空五类草拟后·重渲拟诏面板以显示「本回合已颁行诏书」整块(见 renderFormalEdictPanel)。
    //   延后一帧:本函数由 _applyPolishedEdict 在 push GM.edicts(status=promulgated) 之前调用·setTimeout 确保 push 完成后再渲染才读得到该诏书。
    if (typeof openZhaoPreviewPanel === 'function') setTimeout(openZhaoPreviewPanel, 0);
    return true;
  }

  function formalEdictDraftValue(keys){
    var drafts = ensureFormalEdictDrafts();
    for (var i = 0; i < keys.length; i += 1) {
      var value = String(drafts[keys[i]] || '').trim();
      if (value) return value;
    }
    return '';
  }

  function getFormalEdictDraftSnapshot(){
    Array.prototype.forEach.call(document.querySelectorAll('.tm-desk-overlay'), captureDeskOverlayState);
    return {
      political: formalEdictDraftValue(['policy','political']),
      military: formalEdictDraftValue(['military']),
      diplomatic: formalEdictDraftValue(['diplomatic','diplomacy']),
      economic: formalEdictDraftValue(['finance','economic','economy']),
      other: formalEdictDraftValue(['other','private']),
      xingluPub: String(state.playerAction || '').trim()
    };
  }

  function removeFormalEdictHiddenInputs(){
    Array.prototype.forEach.call(document.querySelectorAll('[data-phase8-edict-bridge="1"]'), function(el){
      el.remove();
    });
  }

  function ensureFormalEdictBridgeInput(id, value){
    value = String(value || '');
    var el = document.getElementById(id);
    if (el && (!el.getAttribute || el.getAttribute('data-phase8-edict-bridge') !== '1')) {
      if (value && 'value' in el) el.value = value;
      return el;
    }
    if (!el) {
      if (!value) return null;
      el = document.createElement('textarea');
      el.id = id;
      el.setAttribute('data-phase8-edict-bridge', '1');
      el.setAttribute('aria-hidden', 'true');
      el.tabIndex = -1;
      el.style.cssText = 'position:absolute;left:-99999px;top:-99999px;width:1px;height:1px;opacity:0;pointer-events:none;';
      document.body.appendChild(el);
    }
    if ('value' in el) el.value = value;
    return el;
  }

  function syncFormalEdictDraftsToLegacyInputs(){
    var snap = getFormalEdictDraftSnapshot();
    [
      ['edict-pol', snap.political],
      ['edict-mil', snap.military],
      ['edict-dip', snap.diplomatic],
      ['edict-eco', snap.economic],
      ['edict-oth', snap.other],
      ['xinglu-pub', snap.xingluPub]
    ].forEach(function(pair){
      ensureFormalEdictBridgeInput(pair[0], pair[1]);
    });
    return snap;
  }

  function clearFormalEdictDrafts(){
    var errors = [];
    // 先清内存真值；即使后续 localStorage/DOM 清理失败，也不能让已提交诏令再次回灌下一回合。
    state.edictDraft = [];
    state.edictDrafts = {};
    state.playerAction = '';
    try { clearFormalDraftStore(['edictDraft', 'edictDrafts', 'playerAction']); }
    catch (storeError) { errors.push(storeError); }
    try { removeFormalEdictHiddenInputs(); }
    catch (domError) { errors.push(domError); }
    return { ok: errors.length === 0, committed: true, errors: errors };
  }

  function appendFormalEdictDraft(catId, block, root){
    block = String(block || '').trim();
    if (!block) return { ok:false, live:false };
    state.edictDrafts = state.edictDrafts || {};
    var keys = formalEdictDraftKeys(catId);
    var primary = keys[0] || 'policy';
    var ta = findFormalEdictDraftInput(catId, root);
    var base = ta && typeof ta.value === 'string' ? ta.value : (state.edictDrafts[primary] || '');
    var next = (base ? String(base).replace(/\s+$/, '') + '\n\n' : '') + block;
    syncFormalEdictDraft(catId, next);
    if (ta) {
      ta.value = next;
      try { if (typeof window._edictLiveForecast === 'function') window._edictLiveForecast(catId); } catch(_) {}
      try { ta.focus(); } catch(_) {}
    }
    return { ok:true, live:!!ta };
  }

  function dismissFormalEdictSuggestion(realIndex){
    var list = formalEdictSuggestionList();
    if (list[realIndex]) list[realIndex].used = true;
    openZhaoPreviewPanel();
  }

  function showFormalEdictAdoptMenu(evt, realIndex){
    if (evt) { evt.preventDefault(); evt.stopPropagation(); }
    var old = document.getElementById('_edictAdoptMenu');
    if (old) old.remove();
    var list = formalEdictSuggestionList();
    var sg = list[realIndex];
    if (!sg) return;
    var anchor = evt && (evt.currentTarget || evt.target);
    var adoptRoot = anchor && anchor.closest ? anchor.closest('.tm-desk-overlay') : null;
    var rect = anchor && anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : { left: 80, right: 160, top: 120, bottom: 150 };
    var cats = [
      {id:'edict-pol', label:'政 令', color:'var(--indigo-400)'},
      {id:'edict-mil', label:'军 令', color:'var(--vermillion-400)'},
      {id:'edict-dip', label:'外 交', color:'var(--celadon-400)'},
      {id:'edict-eco', label:'经 济', color:'var(--gold-400)'},
      {id:'edict-oth', label:'其 他', color:'var(--ink-300)'}
    ];
    var menu = document.createElement('div');
    menu.id = '_edictAdoptMenu';
    var menuH = cats.length * 30 + 8;
    var top = rect.bottom + 4;
    if (top + menuH > window.innerHeight - 10) top = Math.max(10, rect.top - menuH - 4);
    menu.style.cssText = 'position:fixed;left:' + Math.max(10, rect.left) + 'px;top:' + top + 'px;z-index:10080;background:var(--color-elevated,#1a1a2e);border:1px solid var(--color-border-subtle,#444);border-radius:6px;box-shadow:0 8px 24px rgba(0,0,0,0.5);min-width:96px;padding:3px 0;font-family:var(--font-serif);';
    cats.forEach(function(cat){
      var item = document.createElement('button');
      item.type = 'button';
      item.textContent = cat.label;
      item.style.cssText = 'display:block;width:100%;padding:6px 12px;border:0;background:transparent;text-align:left;font-size:0.8rem;cursor:pointer;color:' + cat.color + ';font-family:inherit;';
      item.onmouseover = function(){ this.style.background = 'var(--color-surface,rgba(255,255,255,0.06))'; };
      item.onmouseout = function(){ this.style.background = 'transparent'; };
      item.onclick = function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        var content = String(sg.draftText || sg.text || sg.content || sg.body || '').trim();
        var prefix = '';
        if (sg.topic || sg.title) prefix += '〔' + (sg.topic || sg.title) + '〕';
        if (sg.from) prefix += '（' + sg.from + '言）';
        var block = (prefix ? prefix + '\n' : '') + content;
        var write = appendFormalEdictDraft(cat.id, block, adoptRoot);
        if (write.ok) {
          if (typeof window.toast === 'function') window.toast('已纳入' + cat.label + (prefix ? '（含问题背景）' : ''));
          if (!write.live) setTimeout(openZhaoPreviewPanel, 0);
        } else if (typeof window.toast === 'function') {
          window.toast('建议为空，未纳入');
        }
        menu.remove();
      };
      menu.appendChild(item);
    });
    document.body.appendChild(menu);
    setTimeout(function(){
      function close(e){
        if (!menu.contains(e.target)) {
          menu.remove();
          document.removeEventListener('click', close);
        }
      }
      document.addEventListener('click', close);
    }, 0);
  }

  function installEdictYuanStyles(){
    var st = document.getElementById('tm-edict-yuan-style');
    if (!st) { st = document.createElement('style'); st.id = 'tm-edict-yuan-style'; document.head.appendChild(st); }
    var __css = ''
+ '.ed-yuan{--silk-hi:#fffdf3;--silk:#f6efda;--silk-lo:#ece1c6;--silk-edge:#dcc99c;--silk-shadow:rgba(120,90,36,0.1);--ink:#241d15;--ink-soft:#574733;--ink-faint:#9c8b6b;--gold-hi:#d8b96a;--gold:#a8833a;--gold-d:#7d5e22;--cinnabar:#a83228;--cinnabar-hi:#c64a3e;--cinnabar-d:#7a2018;--wood-1:#6b4a28;--wood-edge:#2a1b0c;--knob:#241810;--jade:#557f6f;--jade-hi:#6fa291;--font:"STKaiti","KaiTi","楷体","Noto Serif SC","Source Han Serif CN","STSong",serif;'
+ 'position:relative;height:100%;box-sizing:border-box;display:flex;flex-direction:column;padding:24px 26px;overflow:hidden;color:var(--ink);font-family:var(--font);border-radius:7px;'
+ 'background:radial-gradient(46% 34% at 50% -4%,rgba(255,238,196,0.5),transparent 70%),radial-gradient(60% 50% at 20% 26%,rgba(120,100,70,0.13),transparent 60%),radial-gradient(52% 60% at 84% 74%,rgba(80,60,40,0.16),transparent 55%),radial-gradient(120% 120% at 50% 28%,#dccca6,#c6b083 54%,#a78f68 100%);}'
+ '.ed-yuan *{box-sizing:border-box;}'
+ '.ed-yuan::before{content:"";position:absolute;inset:0;pointer-events:none;z-index:0;opacity:0.6;background:radial-gradient(60% 42% at 50% 0%,rgba(255,236,188,0.34),transparent 66%),radial-gradient(150% 120% at 50% 42%,transparent 54%,rgba(58,42,22,0.5) 100%),repeating-linear-gradient(91deg,rgba(92,68,40,0.05) 0 2px,transparent 2px 7px);}'
+ '.ed-yuan .scroll-wrap{position:relative;z-index:1;flex:1;min-height:0;display:flex;align-items:stretch;justify-content:center;}'
+ '.ed-yuan .roller-v{flex:0 0 30px;align-self:stretch;position:relative;border-radius:16px;z-index:3;background:linear-gradient(90deg,rgba(255,240,200,0) 38%,rgba(255,240,200,0.22) 47%,rgba(255,240,200,0) 56%),url("data:image/svg+xml,%3Csvg xmlns=\'' + _edictYuanSvgNs() + '\' width=\'44\' height=\'260\'%3E%3Cfilter id=\'wd\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.6 0.015\' numOctaves=\'3\' seed=\'4\' stitchTiles=\'stitch\'/%3E%3CfeColorMatrix type=\'saturate\' values=\'0\'/%3E%3CfeComponentTransfer%3E%3CfeFuncA type=\'linear\' slope=\'0.4\'/%3E%3C/feComponentTransfer%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23wd)\'/%3E%3C/svg%3E"),linear-gradient(90deg,var(--wood-edge) 0%,var(--wood-1) 26%,#8c6234 48%,var(--wood-1) 70%,var(--wood-edge) 100%),repeating-linear-gradient(90deg,rgba(0,0,0,0.14) 0 1px,transparent 1px 6px);background-size:auto,44px 260px,auto,auto;background-blend-mode:screen,multiply,normal,normal;box-shadow:inset 2px 0 1px rgba(255,225,165,0.2),inset -3px 0 6px rgba(0,0,0,0.45),0 12px 28px rgba(50,32,14,0.45);animation:edy-rollerSettle .5s cubic-bezier(.2,.7,.3,1) both;}'
+ '.ed-yuan .roller-v::before,.ed-yuan .roller-v::after{content:"";position:absolute;left:-5px;right:-5px;height:28px;border-radius:9px;z-index:1;background:radial-gradient(ellipse at 40% 32%,#4a3826,var(--knob) 55%,#0f0a05 100%);box-shadow:0 4px 12px rgba(0,0,0,0.55),inset 0 2px 0 rgba(190,150,95,0.4),inset 0 -3px 4px rgba(0,0,0,0.5);}'
+ '.ed-yuan .roller-v::before{top:-16px;}.ed-yuan .roller-v::after{bottom:-16px;}'
+ '.ed-yuan .silk{flex:1;min-height:0;position:relative;z-index:1;display:flex;flex-direction:column;margin:0 -4px;background:radial-gradient(80% 26% at 50% 0%,rgba(255,255,255,0.62),transparent 62%),radial-gradient(40% 52% at 17% 28%,rgba(198,162,98,0.10),transparent 70%),radial-gradient(46% 56% at 84% 74%,rgba(150,116,60,0.11),transparent 72%),linear-gradient(90deg,transparent calc(33.3% - 1.2px),rgba(110,82,38,0.08) calc(33.3% - 0.4px),rgba(255,252,240,0.5) calc(33.3% + 0.4px),transparent calc(33.3% + 1.2px)),linear-gradient(90deg,transparent calc(66.6% - 1.2px),rgba(110,82,38,0.08) calc(66.6% - 0.4px),rgba(255,252,240,0.5) calc(66.6% + 0.4px),transparent calc(66.6% + 1.2px)),linear-gradient(180deg,var(--silk-hi),var(--silk) 36%,var(--silk-lo) 100%);border-left:1px solid var(--silk-edge);border-right:1px solid var(--silk-edge);box-shadow:0 18px 48px rgba(50,32,14,0.34),inset 0 1px 0 rgba(255,255,255,0.55),inset 6px 0 16px -8px rgba(70,48,20,0.4),inset -6px 0 16px -8px rgba(70,48,20,0.4),inset 0 0 120px var(--silk-shadow);padding:16px 30px 16px;transform-origin:center;animation:edy-unroll .62s cubic-bezier(.2,.72,.28,1) both;overflow:hidden;}'
+ '.ed-yuan .silk::before{content:"";position:absolute;inset:0;pointer-events:none;opacity:0.5;mix-blend-mode:multiply;background-image:url("data:image/svg+xml,%3Csvg xmlns=\'' + _edictYuanSvgNs() + '\' width=\'240\' height=\'240\'%3E%3Cfilter id=\'fib\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.012 0.55\' numOctaves=\'3\' seed=\'7\' stitchTiles=\'stitch\'/%3E%3CfeColorMatrix type=\'saturate\' values=\'0\'/%3E%3CfeComponentTransfer%3E%3CfeFuncA type=\'linear\' slope=\'0.55\'/%3E%3C/feComponentTransfer%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23fib)\'/%3E%3C/svg%3E"),repeating-linear-gradient(0deg,rgba(120,90,40,0.045) 0 1px,transparent 1px 4px);background-size:240px 240px,auto;}'
+ '.ed-yuan .silk::after{content:"";position:absolute;inset:0;pointer-events:none;z-index:0;opacity:0.5;background-image:url("data:image/svg+xml,%3Csvg xmlns=\'' + _edictYuanSvgNs() + '\' width=\'96\' height=\'96\'%3E%3Cg fill=\'%23b8923f\'%3E%3Ccircle cx=\'12\' cy=\'18\' r=\'1.4\' fill-opacity=\'0.5\'/%3E%3Ccircle cx=\'46\' cy=\'9\' r=\'1\' fill-opacity=\'0.4\'/%3E%3Ccircle cx=\'73\' cy=\'26\' r=\'1.7\' fill-opacity=\'0.45\'/%3E%3Ccircle cx=\'60\' cy=\'54\' r=\'1.3\' fill-opacity=\'0.5\'/%3E%3Ccircle cx=\'17\' cy=\'75\' r=\'1.5\' fill-opacity=\'0.45\'/%3E%3Ccircle cx=\'84\' cy=\'69\' r=\'1\' fill-opacity=\'0.4\'/%3E%3C/g%3E%3C/svg%3E");background-size:96px 96px;animation:edy-fleck 9s ease-in-out infinite alternate;}'
+ '.ed-yuan .silk>*{position:relative;z-index:1;}'
+ '.ed-yuan .silk-head{flex:0 0 auto;position:relative;display:flex;align-items:center;min-height:44px;padding-bottom:10px;margin-bottom:10px;border-bottom:1px solid rgba(168,131,58,0.4);animation:edy-headDrop .55s ease .3s both;}'
+ '.ed-yuan .silk-head::after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:1px;background:linear-gradient(90deg,transparent,rgba(216,185,106,0.7) 22%,rgba(216,185,106,0.7) 78%,transparent);}'
+ '.ed-yuan .head-center{position:absolute;left:50%;top:0;transform:translateX(-50%);text-align:center;pointer-events:none;}'
+ '.ed-yuan .head-center::before{content:"";position:absolute;left:50%;top:50%;width:88px;height:88px;transform:translate(-50%,-54%);pointer-events:none;z-index:0;opacity:0.5;background:no-repeat center/contain;background-image:url("data:image/svg+xml,%3Csvg xmlns=\'' + _edictYuanSvgNs() + '\' viewBox=\'0 0 100 100\'%3E%3Cg fill=\'none\' stroke=\'%23a8833a\'%3E%3Ccircle cx=\'50\' cy=\'50\' r=\'44\' stroke-width=\'1.4\' stroke-opacity=\'0.5\'/%3E%3Ccircle cx=\'50\' cy=\'50\' r=\'37\' stroke-width=\'2.6\' stroke-opacity=\'0.34\'/%3E%3Ccircle cx=\'50\' cy=\'50\' r=\'30\' stroke-width=\'1\' stroke-opacity=\'0.4\' stroke-dasharray=\'2 4\'/%3E%3C/g%3E%3C/svg%3E");}'
+ '.ed-yuan .head-center .hc-main{position:relative;z-index:1;font-size:25px;font-weight:bold;color:var(--ink);letter-spacing:0.18em;line-height:1.05;text-shadow:0 1px 0 rgba(255,255,255,0.7),0 -1px 0 rgba(120,90,36,0.3),0 2px 4px rgba(120,90,36,0.28),0 0 16px rgba(216,185,106,0.26);}'
+ '.ed-yuan .head-center .hc-main .hc-sep{display:inline-block;width:0.9em;}'
+ '.ed-yuan .head-center .hc-main::before,.ed-yuan .head-center .hc-main::after{content:"";display:inline-block;width:22px;height:1px;vertical-align:0.34em;margin:0 13px;background:linear-gradient(90deg,transparent,var(--gold));}'
+ '.ed-yuan .head-center .hc-main::after{background:linear-gradient(90deg,var(--gold),transparent);}'
+ '.ed-yuan .head-center .hc-sub{font-size:12px;color:var(--ink-faint);letter-spacing:0.32em;margin-top:3px;}'
+ '.ed-yuan .tab-switch{position:relative;z-index:2;display:inline-flex;border:1px solid var(--gold-d);border-radius:6px;overflow:hidden;background:rgba(255,253,243,0.6);box-shadow:0 1px 4px rgba(80,56,24,0.12);}'
+ '.ed-yuan .ed-tab{font-family:var(--font);font-size:13px;letter-spacing:0.1em;color:var(--ink-soft);cursor:pointer;padding:7px 15px;transition:all .15s;border:0;background:transparent;}'
+ '.ed-yuan .ed-tab.active{color:#fff;background:linear-gradient(160deg,var(--cinnabar),var(--cinnabar-d));}'
+ '.ed-yuan .ed-tab:not(.active):hover{color:var(--ink);background:rgba(168,131,58,0.12);}'
+ '.ed-yuan .head-right{position:relative;z-index:2;margin-left:auto;}'
+ '.ed-yuan .link-btn{font-family:var(--font);font-size:12.5px;letter-spacing:0.06em;cursor:pointer;padding:7px 13px;border-radius:5px;border:1px solid var(--gold-d);background:#fbf4e2;color:var(--gold-d);transition:all .15s;display:inline-flex;align-items:center;gap:6px;box-shadow:0 1px 3px rgba(80,56,24,0.12);}'
+ '.ed-yuan .link-btn:hover{background:#fff;border-color:var(--gold);color:var(--ink);}'
+ '.ed-yuan .silk-body{flex:1;min-height:0;display:flex;gap:18px;}'
+ '.ed-yuan .col-sug{flex:0 0 226px;min-height:0;position:relative;display:flex;flex-direction:column;border:1px solid rgba(168,131,58,0.35);border-radius:5px;background:rgba(255,253,243,0.45);padding:11px 12px 12px;overflow:hidden;box-shadow:inset 0 1px 0 rgba(255,255,255,0.5),0 2px 10px rgba(80,56,24,0.07);animation:edy-colInL .55s cubic-bezier(.2,.7,.3,1) .44s both;}'
+ '.ed-yuan[data-tab="xinglu"] .col-sug{display:none;}'
+ '.ed-yuan .col-sug-t{flex:0 0 auto;position:relative;z-index:1;font-size:15px;color:var(--cinnabar-d);letter-spacing:0.18em;font-weight:bold;margin-bottom:9px;}'
+ '.ed-yuan .col-sug-t small{font-size:12px;color:var(--ink-faint);letter-spacing:0.04em;font-weight:normal;margin-left:6px;}'
+ '.ed-yuan .sug-list{flex:1;min-height:0;overflow-y:auto;position:relative;z-index:1;scrollbar-width:none;-ms-overflow-style:none;padding-right:2px;}'
+ '.ed-yuan .sug-list::-webkit-scrollbar{width:0;height:0;display:none;}'
+ '.ed-yuan .col-sug::after{content:"";position:absolute;left:1px;right:1px;bottom:1px;height:24px;pointer-events:none;z-index:2;border-radius:0 0 5px 5px;background:linear-gradient(180deg,rgba(255,253,243,0) 0%,rgba(250,243,224,0.92) 78%);}'
+ '.ed-yuan .edict-sug-v2{position:relative;display:grid;grid-template-columns:46px minmax(0,1fr);gap:11px;margin-bottom:9px;padding:10px 11px 10px 12px;border:1px solid rgba(168,131,58,0.24);border-radius:5px;color:var(--ink);background:linear-gradient(165deg,#fffefa,#fbf4e1);box-shadow:0 1px 2px rgba(80,56,24,0.07);transition:transform .18s,box-shadow .18s,border-color .18s;}'
+ '.ed-yuan .edict-sug-v2::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;border-radius:5px 0 0 5px;opacity:0.7;background:linear-gradient(180deg,var(--jade-hi),var(--jade));}'
+ '.ed-yuan .edict-sug-v2:hover{border-color:rgba(168,131,58,0.55);box-shadow:0 6px 16px rgba(80,56,24,0.16);transform:translateY(-2px);}'
+ '.ed-yuan .edict-sug-portrait-wrap{width:46px;height:56px;position:relative;overflow:hidden;border-radius:3px;border:1px solid var(--gold-d);background:radial-gradient(circle at 50% 28%,rgba(201,160,69,0.2),#e7d6ad 70%);color:var(--gold-d);font-size:18px;display:grid;place-items:center;box-shadow:0 2px 5px rgba(80,56,24,0.24),inset 0 0 0 2px rgba(255,253,243,0.55);}'
+ '.ed-yuan .edict-sug-portrait-wrap:after{content:attr(data-glyph);display:none;font-family:var(--font);}'
+ '.ed-yuan .edict-sug-portrait-wrap.fallback:after{display:block;}'
+ '.ed-yuan .edict-sug-portrait{width:100%;height:100%;object-fit:cover;object-position:center top;display:block;}'
+ '.ed-yuan .edict-sug-v2 b{display:block;color:var(--jade);font-size:12px;letter-spacing:0.08em;margin-bottom:3px;font-weight:normal;}'
+ '.ed-yuan .edict-sug-v2 p{margin:0 0 4px;color:var(--ink-soft);font-size:12px;line-height:1.55;}'
+ '.ed-yuan .edict-sug-footer{display:flex;align-items:center;justify-content:space-between;gap:7px;margin-top:7px;}'
+ '.ed-yuan .edict-sug-adopt{flex:1;position:relative;overflow:hidden;font-family:var(--font);font-size:12.5px;letter-spacing:0.2em;cursor:pointer;padding:6px 10px;border-radius:3px;color:#fff;border:1px solid var(--gold-d);background:linear-gradient(160deg,var(--cinnabar-hi),var(--cinnabar) 55%,var(--cinnabar-d));box-shadow:inset 0 1px 0 rgba(255,255,255,0.22),inset 0 0 0 1px rgba(216,185,106,0.32),0 2px 5px rgba(122,32,24,0.32);}'
+ '.ed-yuan .edict-sug-adopt:hover{box-shadow:inset 0 1px 0 rgba(255,255,255,0.3),inset 0 0 0 1px rgba(216,185,106,0.6),0 4px 11px rgba(122,32,24,0.42);}'
+ '.ed-yuan .edict-sug-delete{flex:0 0 auto;width:26px;height:26px;cursor:pointer;font-family:var(--font);font-size:15px;line-height:1;border:1px solid rgba(140,124,96,0.5);background:transparent;color:var(--ink-faint);border-radius:4px;transition:all .15s;}'
+ '.ed-yuan .edict-sug-delete:hover{border-color:var(--cinnabar);color:var(--cinnabar);background:rgba(168,50,40,0.08);}'
+ '.ed-yuan .tm-chip{display:inline-flex;align-items:center;min-height:18px;padding:1px 7px;border:1px solid rgba(85,127,111,0.4);border-radius:999px;color:var(--jade);background:transparent;font-size:11.5px;}'
+ '.ed-yuan .tm-chip.hot{color:var(--cinnabar);border-color:rgba(168,50,40,0.45);background:rgba(168,50,40,0.05);}'
+ '.ed-yuan .tm-chip.green{color:var(--jade);border-color:rgba(85,127,111,0.4);}'
+ '.ed-yuan .col-main{flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden;position:relative;}'
+ '.ed-yuan .ed-tab-panel{flex:1;min-height:0;display:none;flex-direction:column;}'
+ '.ed-yuan[data-tab="edict"] .ed-tab-panel.edict{display:flex;}'
+ '.ed-yuan[data-tab="xinglu"] .ed-tab-panel.xinglu{display:flex;}'
+ '.ed-yuan .edict-col{flex:1;min-height:0;display:flex;flex-direction:column;}'
+ '.ed-yuan .edict-prom-card{flex:0 0 auto;margin:0 2px 12px;padding:13px 15px;border-radius:8px;border:1px solid rgba(168,50,40,0.32);background:linear-gradient(180deg,rgba(255,247,235,0.92),rgba(250,235,220,0.72));box-shadow:0 8px 20px -12px rgba(122,32,24,0.3),inset 0 0 0 1px rgba(168,131,58,0.12);}'
+ '.ed-yuan .edict-prom-card .epc-hd{display:flex;align-items:center;gap:9px;margin-bottom:9px;}'
+ '.ed-yuan .edict-prom-card .epc-seal{width:26px;height:26px;flex:0 0 auto;display:grid;place-items:center;border-radius:5px;font-size:14px;font-weight:bold;color:#fff;background:linear-gradient(150deg,#c64a3e,#7a2018);box-shadow:0 1px 4px rgba(122,32,24,0.4);}'
+ '.ed-yuan .edict-prom-card .epc-hd b{font-size:14.5px;letter-spacing:0.1em;color:#7a2018;}'
+ '.ed-yuan .edict-prom-card .epc-hd em{font-style:normal;font-size:11.5px;color:#9c8b6b;letter-spacing:0.02em;margin-left:auto;}'
+ '.ed-yuan .edict-prom-card .epc-body{font-family:"FangSong","STFangsong","\\4EFF\\5B8B",serif;font-size:14px;line-height:1.9;color:#241d15;letter-spacing:0.01em;white-space:pre-wrap;text-align:justify;max-height:240px;overflow-y:auto;padding:10px 12px;border-radius:5px;background:rgba(255,255,255,0.5);border:1px solid rgba(168,131,58,0.16);}'
+ '.ed-yuan .edict-prom-card .epc-acts{display:flex;align-items:center;gap:10px;margin-top:9px;flex-wrap:wrap;}'
+ '.ed-yuan .edict-prom-card .epc-btn{font-family:inherit;font-size:12px;letter-spacing:0.04em;cursor:pointer;padding:5px 14px;border-radius:6px;border:1px solid rgba(168,131,58,0.4);background:rgba(255,252,243,0.6);color:#574733;transition:all .14s;}'
+ '.ed-yuan .edict-prom-card .epc-btn:hover{background:#fffdf6;border-color:#a8833a;color:#241d15;}'
+ '.ed-yuan .edict-prom-card .epc-note{font-size:11px;color:#9c8b6b;letter-spacing:0.02em;}'
+ '.ed-yuan .erow{flex:1;min-height:0;position:relative;display:flex;gap:14px;padding:7px 6px 9px 10px;border-radius:6px;opacity:0;animation:edy-catIn .42s ease forwards;transition:background .22s ease;}'
+ '.ed-yuan .erow[data-cat="政"]{--sc:#5a6fae;--sc-glow:rgba(90,111,174,0.16);}.ed-yuan .erow[data-cat="军"]{--sc:#a83228;--sc-glow:rgba(168,50,40,0.16);}.ed-yuan .erow[data-cat="外"]{--sc:#3f7a68;--sc-glow:rgba(63,122,104,0.16);}.ed-yuan .erow[data-cat="经"]{--sc:#9a7730;--sc-glow:rgba(154,119,48,0.18);}.ed-yuan .erow[data-cat="他"]{--sc:#7a6a52;--sc-glow:rgba(122,106,82,0.14);}'
+ '.ed-yuan .erow::before{content:"";position:absolute;left:0;top:9px;bottom:9px;width:3px;border-radius:2px;background:var(--sc,var(--gold));opacity:0;transform:scaleY(0.35);transform-origin:center;transition:opacity .22s,transform .22s;}'
+ '.ed-yuan .erow:focus-within::before{opacity:0.82;transform:scaleY(1);}'
+ '.ed-yuan .erow:focus-within{background:radial-gradient(135% 135% at 0% 50%,var(--sc-glow,rgba(168,131,58,0.08)),transparent 70%);}'
+ '.ed-yuan .erow:not(:last-child)::after{content:"";position:absolute;left:78px;right:8px;bottom:0;height:1px;background:linear-gradient(90deg,transparent,rgba(168,131,58,0.28) 12%,rgba(168,131,58,0.28) 88%,transparent);}'
+ '.ed-yuan .seal-col{flex:0 0 auto;display:flex;flex-direction:column;align-items:center;gap:4px;margin-top:2px;width:52px;}'
+ '.ed-yuan .seal-hint{font-size:10.5px;line-height:1.3;color:var(--ink-faint);text-align:center;opacity:0.78;transition:color .2s,opacity .2s;}'
+ '.ed-yuan .erow:focus-within .seal-hint{color:var(--sc);opacity:1;}'
+ '.ed-yuan .cell-seal{flex:0 0 auto;position:relative;width:50px;height:50px;}'
+ '.ed-yuan .cell-seal::before{content:"";position:absolute;inset:4px;border:1.5px solid var(--sc,var(--gold-d));border-radius:4px;transform:rotate(45deg);background:rgba(255,253,243,0.4);box-shadow:inset 0 0 0 3px rgba(255,255,255,0.45),0 1px 2px rgba(80,56,24,0.18),0 0 10px var(--sc-glow,transparent);}'
+ '.ed-yuan .cell-seal .cs-1{position:absolute;top:6px;left:7px;font-size:23px;line-height:1;color:var(--sc,var(--gold-d));font-weight:bold;text-shadow:0 1px 0 rgba(255,255,255,0.5);}'
+ '.ed-yuan .cell-seal .cs-2{position:absolute;bottom:6px;right:7px;font-size:13px;line-height:1;color:var(--sc,var(--gold-d));font-weight:bold;opacity:0.92;}'
+ '.ed-yuan .erow:focus-within .cell-seal::before{box-shadow:inset 0 0 0 3px rgba(255,255,255,0.5),0 1px 2px rgba(80,56,24,0.18),0 0 16px var(--sc-glow,transparent);}'
+ '.ed-yuan .cell-seal.inked::before{background:var(--sc,var(--gold-d));border-radius:4px 5px 4px 5px;background-image:url("data:image/svg+xml,%3Csvg xmlns=\'' + _edictYuanSvgNs() + '\' width=\'40\' height=\'40\'%3E%3Cfilter id=\'ik\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\' numOctaves=\'2\' seed=\'3\'/%3E%3CfeColorMatrix type=\'saturate\' values=\'0\'/%3E%3CfeComponentTransfer%3E%3CfeFuncA type=\'linear\' slope=\'0.45\'/%3E%3C/feComponentTransfer%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23ik)\'/%3E%3C/svg%3E");background-size:30px 30px;background-blend-mode:soft-light;box-shadow:inset 0 0 0 3px rgba(255,255,255,0.32),0 1px 4px rgba(80,56,24,0.32),0 0 14px var(--sc-glow,transparent);}'
+ '.ed-yuan .cell-seal.inked .cs-1,.ed-yuan .cell-seal.inked .cs-2{color:#fff;text-shadow:0 1px 2px rgba(0,0,0,0.32);}'
+ '.ed-yuan .erow-body{flex:1;min-height:0;display:flex;flex-direction:column;}'
+ '.ed-yuan .cat-field{flex:1;min-height:44px;width:100%;font-family:var(--font);font-size:16px;line-height:1.95;color:var(--ink);background-color:#faf4e6;background-image:repeating-linear-gradient(180deg,rgba(0,0,0,0) 0 29px,rgba(168,131,58,0.10) 29px 30px);background-position:0 9px;border:none;border-radius:3px;padding:3px 7px;resize:none;outline:none;overflow-y:auto;scrollbar-width:none;transition:background .18s;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;text-rendering:optimizeLegibility;}'
+ '.ed-yuan .cat-field::-webkit-scrollbar{width:0;height:0;display:none;}'
+ '.ed-yuan .cat-field::placeholder{color:rgba(120,104,76,0.62);line-height:1.6;}'
+ '.ed-yuan .cat-field:focus{background-color:#fffdf6;}'
+ '.ed-yuan .ed-forecast{flex:0 0 auto;position:relative;font-size:11.5px;line-height:1.45;color:#3c6053;letter-spacing:0.02em;padding:3px 6px 0 16px;}'
+ '.ed-yuan .ed-forecast::before{content:"批";position:absolute;left:0;top:3px;font-size:10px;color:var(--cinnabar);border:1px solid var(--cinnabar);border-radius:2px;padding:0 1px;line-height:1.3;opacity:0.78;transform:rotate(-6deg);}'
+ '.ed-yuan .ed-polish-bar{flex:0 0 auto;display:flex;align-items:center;gap:10px;margin:8px 2px 6px;}'
+ '.ed-yuan .ed-polish-bar .lbl{font-size:12.5px;color:var(--ink-soft);letter-spacing:0.14em;}'
+ '.ed-yuan .ed-polish-bar select{appearance:none;-webkit-appearance:none;font-family:var(--font);font-size:12.5px;padding:6px 28px 6px 12px;color:var(--ink);border:1px solid var(--gold-d);border-radius:5px;cursor:pointer;background:linear-gradient(180deg,#fffdf3,#f6edd6),url("data:image/svg+xml,%3Csvg xmlns=\'' + _edictYuanSvgNs() + '\' width=\'10\' height=\'7\'%3E%3Cpath d=\'M1 1l4 4 4-4\' fill=\'none\' stroke=\'%237d5e22\' stroke-width=\'1.6\' stroke-linecap=\'round\'/%3E%3C/svg%3E") no-repeat;background-position:0 0,right 10px center;box-shadow:inset 0 1px 0 rgba(255,255,255,0.6);}'
+ '.ed-yuan #edict-polished{position:absolute;inset:14px;z-index:18;display:none;align-items:center;justify-content:center;pointer-events:none;}'
+ '.ed-yuan #edict-polished.show{display:flex !important;pointer-events:auto;}'
+ '.ed-yuan #edict-polished::before{content:"";position:absolute;inset:0;border-radius:10px;background:rgba(40,28,14,0.42);backdrop-filter:blur(1px);}'
+ '.ed-yuan .ed-tab-panel.xinglu{gap:16px;flex-direction:row;}'
+ '.ed-yuan .xinglu-main{flex:1.7;min-height:0;display:flex;flex-direction:column;}'
+ '.ed-yuan .xinglu-main .xm-hd{flex:0 0 auto;display:flex;align-items:baseline;gap:10px;margin-bottom:10px;}'
+ '.ed-yuan .xinglu-main .xm-title{font-size:17px;color:var(--ink);letter-spacing:0.18em;}'
+ '.ed-yuan .xinglu-main .xm-desc{font-size:12px;color:var(--ink-faint);}'
+ '.ed-yuan .x-field{flex:1;min-height:0;width:100%;font-family:var(--font);font-size:15px;line-height:2;color:var(--ink);background:repeating-linear-gradient(180deg,transparent 0 33px,rgba(120,90,36,0.08) 33px 34px);background-position:0 6px;border:none;border-radius:2px;padding:4px 8px;resize:none;outline:none;overflow-y:auto;scrollbar-width:none;}'
+ '.ed-yuan .x-field::-webkit-scrollbar{width:0;display:none;}'
+ '.ed-yuan .x-field::placeholder{color:rgba(140,124,96,0.6);}'
+ '.ed-yuan .x-field:focus{background-color:rgba(255,255,255,0.4);}'
+ '.ed-yuan .xinglu-hist{flex:1;min-height:0;display:flex;flex-direction:column;border-left:1px solid rgba(168,131,58,0.32);padding-left:16px;}'
+ '.ed-yuan .xinglu-hist .xh-t{flex:0 0 auto;font-size:14px;color:var(--gold-d);letter-spacing:0.16em;margin-bottom:8px;}'
+ '.ed-yuan .xinglu-hist .xh-list{flex:1;min-height:0;overflow-y:auto;scrollbar-width:thin;}'
+ '.ed-yuan .x-hist-item{font-size:13px;color:var(--ink-soft);padding:8px 0;border-bottom:1px dotted rgba(140,124,96,0.35);line-height:1.7;}'
+ '.ed-yuan .x-hist-item .t{color:var(--cinnabar);margin-right:8px;font-size:12px;}'
+ '.ed-yuan .col-actions{flex:0 0 84px;min-height:0;display:flex;flex-direction:column;align-items:stretch;gap:10px;animation:edy-colInR .55s cubic-bezier(.2,.7,.3,1) .52s both;}'
+ '.ed-yuan .act-polish{flex:0 0 auto;position:relative;overflow:hidden;font-family:var(--font);font-size:15px;letter-spacing:0.18em;line-height:1.6;cursor:pointer;padding:34px 7px 14px;border-radius:9px;border:1px solid var(--gold-d);color:var(--gold-d);transition:color .2s,box-shadow .2s,transform .1s;background:linear-gradient(162deg,#fefaef,#f1e2bd),repeating-linear-gradient(92deg,rgba(168,131,58,0.05) 0 2px,transparent 2px 7px);box-shadow:0 2px 7px rgba(80,56,24,0.16),inset 0 1px 0 rgba(255,255,255,0.7),inset 0 0 0 1px rgba(216,185,106,0.3);}'
+ '.ed-yuan .act-polish::before{content:"";position:absolute;left:0;right:0;bottom:0;height:0;z-index:0;pointer-events:none;transition:height .26s cubic-bezier(.3,.7,.3,1);background:linear-gradient(180deg,var(--gold-hi),var(--gold) 60%,var(--gold-d));}'
+ '.ed-yuan .act-polish::after{content:"";position:absolute;top:8px;left:50%;transform:translateX(-50%);width:13px;height:21px;z-index:1;background:linear-gradient(180deg,#6b4a28 0 32%,#2f2113 33%,#1c130a);clip-path:polygon(50% 0,100% 18%,72% 100%,50% 86%,28% 100%,0 18%);box-shadow:0 1px 3px rgba(40,24,10,0.4);}'
+ '.ed-yuan .act-polish .al{position:relative;z-index:1;display:block;}'
+ '.ed-yuan .act-polish:hover{color:#fff8e6;box-shadow:0 6px 16px rgba(168,131,58,0.42),inset 0 1px 0 rgba(255,255,255,0.4);}'
+ '.ed-yuan .act-polish:hover::before{height:100%;}'
+ '.ed-yuan .act-polish:active{transform:translateY(1px);}'
+ '.ed-yuan[data-tab="xinglu"] .act-polish{display:none;}'
+ '.ed-yuan .act-spacer{flex:1;min-height:0;position:relative;}'
+ '.ed-yuan .act-spacer::before{content:"";position:absolute;left:50%;top:4px;bottom:4px;width:3px;transform:translateX(-50%);border-radius:2px;opacity:0.55;background:linear-gradient(180deg,rgba(168,50,40,0) 0%,var(--cinnabar) 16%,var(--cinnabar-d) 84%,rgba(168,50,40,0) 100%);}'
+ '.ed-yuan .act-spacer::after{content:"";position:absolute;left:50%;top:50%;width:16px;height:16px;transform:translate(-50%,-50%) rotate(45deg);border-radius:3px;background:radial-gradient(circle at 34% 28%,var(--jade-hi),var(--jade) 70%,#3d5d51);border:1px solid rgba(255,255,255,0.35);box-shadow:0 2px 7px rgba(40,24,10,0.35),inset 0 0 0 3px rgba(255,255,255,0.12),inset 0 -2px 4px rgba(0,0,0,0.25);}'
+ '.ed-yuan .act-seal{flex:0 0 auto;position:relative;overflow:hidden;font-family:var(--font);font-size:19px;letter-spacing:0.2em;line-height:1.55;cursor:pointer;padding:36px 7px 16px;border-radius:9px;color:var(--gold-hi);border:1px solid #14110a;transition:filter .15s,transform .1s,box-shadow .2s;background:linear-gradient(160deg,#46301a,#241810 60%,#191007),repeating-linear-gradient(0deg,rgba(0,0,0,0.16) 0 1px,transparent 1px 6px),repeating-linear-gradient(90deg,rgba(0,0,0,0.10) 0 1px,transparent 1px 9px);box-shadow:0 6px 18px rgba(40,24,10,0.55),inset 0 1px 0 rgba(206,166,108,0.4),inset 0 0 0 1px rgba(125,94,34,0.5),inset 0 0 0 4px rgba(40,28,14,0.55),inset 0 0 0 5px rgba(168,131,58,0.28);}'
+ '.ed-yuan .act-seal .al{position:relative;z-index:1;display:block;text-shadow:0 1px 3px rgba(0,0,0,0.55),0 0 10px rgba(168,131,58,0.22);}'
+ '.ed-yuan .act-seal::after{content:"印";position:absolute;top:9px;left:50%;transform:translateX(-50%) rotate(-2deg);width:25px;height:25px;z-index:2;display:flex;align-items:center;justify-content:center;font-family:var(--font);font-size:13px;color:#fff5ec;border-radius:4px 5px 4px 5px;background:url("data:image/svg+xml,%3Csvg xmlns=\'' + _edictYuanSvgNs() + '\' width=\'40\' height=\'40\'%3E%3Cfilter id=\'cz\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'2\' seed=\'9\'/%3E%3CfeColorMatrix type=\'saturate\' values=\'0\'/%3E%3CfeComponentTransfer%3E%3CfeFuncA type=\'linear\' slope=\'0.5\'/%3E%3C/feComponentTransfer%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23cz)\'/%3E%3C/svg%3E"),radial-gradient(circle at 36% 28%,var(--cinnabar-hi),var(--cinnabar) 58%,var(--cinnabar-d));background-size:40px 40px,auto;background-blend-mode:soft-light,normal;box-shadow:inset 0 1px 0 rgba(255,255,255,0.42),inset 0 -2px 3px rgba(90,16,10,0.6),0 2px 5px rgba(0,0,0,0.45),0 0 0 1px rgba(216,185,106,0.4);}'
+ '.ed-yuan .act-seal::before{content:"";position:absolute;top:30px;left:50%;width:80px;height:80px;transform:translate(-50%,0) scale(0.2);border-radius:50%;z-index:0;opacity:0;pointer-events:none;background:radial-gradient(circle,rgba(200,74,62,0.5),rgba(168,50,40,0.26) 46%,transparent 70%);}'
+ '.ed-yuan .act-seal:hover{filter:brightness(1.1);box-shadow:0 8px 22px rgba(40,24,10,0.6),inset 0 1px 0 rgba(206,166,108,0.5),inset 0 0 0 1px rgba(125,94,34,0.6),inset 0 0 0 4px rgba(40,28,14,0.55),inset 0 0 0 5px rgba(168,131,58,0.46);}'
+ '.ed-yuan .act-seal:active{transform:translateY(1px);}'
+ '.ed-yuan .act-seal.stamped{animation:edy-stampPulse .5s ease;}'
+ '.ed-yuan .act-seal.stamped::before{animation:edy-inkBloom .6s ease-out;}'
+ '.ed-yuan .arc-modal{position:absolute;inset:0;z-index:20;display:none;align-items:center;justify-content:center;}'
+ '.ed-yuan .arc-modal.show{display:flex;animation:edy-fadeIn .2s ease;}'
+ '.ed-yuan .arc-scrim{position:absolute;inset:0;background:rgba(40,28,14,0.5);}'
+ '.ed-yuan .arc-card{position:relative;z-index:1;width:min(88%,620px);max-height:84%;display:flex;flex-direction:column;border-radius:6px;background:linear-gradient(180deg,#fffdf3,#f1e6cc);border:1px solid var(--gold);box-shadow:0 24px 70px rgba(40,24,10,0.5);animation:edy-popIn .25s ease;}'
+ '.ed-yuan .arc-card-hd{flex:0 0 auto;display:flex;align-items:center;justify-content:space-between;padding:14px 22px 12px;border-bottom:1px solid rgba(168,131,58,0.3);font-size:18px;color:var(--ink);letter-spacing:0.22em;}'
+ '.ed-yuan .arc-card-hd .ah-l{display:flex;align-items:center;gap:11px;}'
+ '.ed-yuan .arc-card-hd .ah-seal{width:28px;height:28px;display:flex;align-items:center;justify-content:center;background:linear-gradient(145deg,var(--cinnabar-hi),var(--cinnabar-d));color:#fff;font-size:15px;border-radius:4px;}'
+ '.ed-yuan .arc-x{cursor:pointer;color:var(--ink-faint);font-size:22px;line-height:1;width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:50%;transition:all .15s;}'
+ '.ed-yuan .arc-x:hover{background:var(--cinnabar);color:#fff;}'
+ '.ed-yuan .arc-body{flex:1;min-height:0;overflow-y:auto;padding:14px 24px 20px;}'
+ '.ed-yuan .arc-turn{font-size:13.5px;color:var(--cinnabar-d);letter-spacing:0.1em;margin:13px 0 8px;font-weight:bold;}'
+ '.ed-yuan .arc-turn:first-child{margin-top:0;}'
+ '.ed-yuan .arc-item{position:relative;font-size:13.5px;line-height:1.65;color:var(--ink-soft);padding:8px 10px 8px 18px;margin-left:6px;border-left:1px solid rgba(168,131,58,0.25);}'
+ '.ed-yuan .arc-item::before{content:"";position:absolute;left:-5px;top:13px;width:9px;height:9px;border-radius:50%;background:var(--st-c,var(--ink-faint));box-shadow:0 0 6px var(--st-c,transparent);}'
+ '.ed-yuan .arc-item .a-cat{color:var(--ink-faint);font-size:12px;letter-spacing:0.08em;}'
+ '.ed-yuan .arc-item .a-mark{margin-right:5px;}'
+ '.ed-yuan .arc-item .a-assignee{color:var(--jade);font-size:12px;}'
+ '.ed-yuan .arc-item .a-fb{color:var(--ink-faint);font-size:12.5px;font-style:italic;margin-top:4px;padding-left:4px;}'
+ '@keyframes edy-unroll{0%{opacity:0;transform:scaleX(0.62);filter:brightness(1.12);}60%{opacity:1;}100%{opacity:1;transform:scaleX(1);filter:none;}}'
+ '@keyframes edy-rollerSettle{0%{opacity:0;transform:translateY(-10px) scaleY(0.9);}100%{opacity:1;transform:none;}}'
+ '@keyframes edy-headDrop{from{opacity:0;transform:translateY(-12px);}to{opacity:1;transform:none;}}'
+ '@keyframes edy-colInL{from{opacity:0;transform:translateX(-22px);}to{opacity:1;transform:none;}}'
+ '@keyframes edy-colInR{from{opacity:0;transform:translateX(22px);}to{opacity:1;transform:none;}}'
+ '@keyframes edy-fleck{0%{opacity:0.38;background-position:0 0;}100%{opacity:0.55;background-position:18px 26px;}}'
+ '@keyframes edy-catIn{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:none;}}'
+ '@keyframes edy-stampPulse{0%{transform:scale(1);}40%{transform:scale(0.97);}100%{transform:scale(1);}}'
+ '@keyframes edy-inkBloom{0%{opacity:0;transform:translate(-50%,0) scale(0.2);}28%{opacity:1;}100%{opacity:0;transform:translate(-50%,0) scale(1.3);}}'
+ '@keyframes edy-fadeIn{from{opacity:0;}to{opacity:1;}}'
+ '@keyframes edy-popIn{from{opacity:0;transform:scale(0.95) translateY(8px);}to{opacity:1;transform:none;}}'
+ '@media (max-width:980px){.ed-yuan{padding:14px 12px;}.ed-yuan .roller-v{display:none;}.ed-yuan .silk{margin:0;}.ed-yuan .silk-body{flex-direction:column;}.ed-yuan .col-sug{flex:0 0 auto;max-height:200px;}.ed-yuan .col-actions{flex-direction:row;flex:0 0 auto;}.ed-yuan .act-spacer{display:none;}.ed-yuan .ed-tab-panel.xinglu{flex-direction:column;}}'
// ── 纳入选类菜单·御案米金覆盖 (真实 showFormalEdictAdoptMenu 建 #_edictAdoptMenu·内联深色 var(--color-elevated)+5 个无类 button·!important 翻浅底+nth-child 分色) ──
+ '#_edictAdoptMenu{background:linear-gradient(180deg,#fffdf3,#f6edd6) !important;border:1px solid #7d5e22 !important;border-radius:6px !important;box-shadow:0 14px 34px rgba(40,24,10,0.42) !important;padding:5px !important;min-width:120px !important;font-family:"STKaiti","KaiTi","楷体",serif !important;animation:edy-popIn .16s ease;}'
+ '#_edictAdoptMenu button{position:relative;display:flex !important;align-items:center;gap:9px;width:100% !important;margin-bottom:3px;padding:8px 12px 8px 26px !important;border:1px solid rgba(168,131,58,0.2) !important;border-radius:4px !important;background:#fffefa !important;color:#241d15 !important;font-family:inherit !important;font-size:13.5px !important;letter-spacing:0.1em;text-align:left;cursor:pointer;transition:background .12s,border-color .12s;}'
+ '#_edictAdoptMenu button:last-child{margin-bottom:0;}'
+ '#_edictAdoptMenu button:hover{background:rgba(168,131,58,0.13) !important;border-color:rgba(168,131,58,0.5) !important;}'
+ '#_edictAdoptMenu button::before{content:"";position:absolute;left:11px;top:50%;width:8px;height:8px;border-radius:2px;transform:translateY(-50%) rotate(45deg);box-shadow:0 1px 2px rgba(40,24,10,0.25);}'
+ '#_edictAdoptMenu button:nth-child(1)::before{background:#5a6fae;}'
+ '#_edictAdoptMenu button:nth-child(2)::before{background:#a83228;}'
+ '#_edictAdoptMenu button:nth-child(3)::before{background:#3f7a68;}'
+ '#_edictAdoptMenu button:nth-child(4)::before{background:#9a7730;}'
+ '#_edictAdoptMenu button:nth-child(5)::before{background:#7a6a52;}'
// ── 有司润色卡·御案米金 (真实 _renderPolishedEdict 写 #edict-polished 内 .ed-scroll*·原无 CSS·从零给浅绢主题) ──
+ '.ed-yuan #edict-polished.show{display:flex !important;}'
+ '.ed-yuan .ed-polish-card{position:relative;z-index:1;width:min(780px,calc(100% - 36px));max-height:calc(100% - 36px);display:flex;flex-direction:column;padding:16px;border-radius:8px;border:1px solid var(--gold);background:linear-gradient(180deg,#fffdf3,#f2e5c7);box-shadow:0 24px 70px rgba(40,24,10,0.5),inset 0 0 0 1px rgba(255,255,255,0.55);animation:edy-popIn .22s ease;}'
+ '.ed-yuan .ed-polish-card.loading{min-height:150px;align-items:center;justify-content:center;color:var(--ink-soft);font-size:15px;letter-spacing:0.08em;}'
+ '.ed-yuan .ed-scroll{position:relative;flex:1;min-height:0;display:flex;flex-direction:column;padding:16px 96px 14px 18px;border-radius:5px;border:1px solid var(--gold);background:linear-gradient(180deg,#fffefa,#f3e8cc);box-shadow:inset 0 0 0 1px rgba(255,255,255,0.5),inset 0 0 0 4px rgba(168,131,58,0.13);}'
+ '.ed-yuan .ed-scroll-title{position:absolute;right:18px;top:16px;writing-mode:vertical-rl;color:#7d5e22;letter-spacing:0.35em;font-size:18px;text-shadow:0 1px 0 rgba(255,255,255,0.6);}'
+ '.ed-yuan .ed-scroll-text{width:100%;min-height:150px;border:1px solid rgba(168,131,58,0.25);border-radius:4px;background:linear-gradient(180deg,rgba(255,255,255,0.55),rgba(246,239,218,0.45));color:#241d15;font-family:"STKaiti","KaiTi","楷体",serif;font-size:15px;line-height:2;padding:12px 14px;resize:vertical;box-shadow:inset 0 1px 0 rgba(255,255,255,0.5);text-indent:2em;}'
+ '.ed-yuan .ed-scroll-text:focus{outline:none;background:rgba(255,255,255,0.6);}'
+ '.ed-yuan .ed-scroll-seal{position:absolute;right:26px;bottom:54px;width:46px;height:46px;display:grid;place-items:center;align-content:center;border-radius:5px;border:1px solid rgba(168,50,40,0.55);color:#fff5ec;font-size:12px;line-height:1.2;text-align:center;background:radial-gradient(circle at 36% 28%,var(--cinnabar-hi),var(--cinnabar) 58%,var(--cinnabar-d));box-shadow:inset 0 1px 0 rgba(255,255,255,0.3),0 2px 6px rgba(90,16,10,0.4);}'
+ '.ed-yuan .ed-scroll-seal .main{font-size:13px;font-weight:bold;letter-spacing:0.06em;}'
+ '.ed-yuan .ed-scroll-actions{flex:0 0 auto;display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;}'
+ '.ed-yuan .ed-scroll-btn{font-family:"STKaiti","KaiTi","楷体",serif;font-size:13px;letter-spacing:0.12em;cursor:pointer;padding:7px 15px;border-radius:5px;border:1px solid var(--gold-d);background:#fbf4e2;color:var(--gold-d);transition:all .15s;}'
+ '.ed-yuan .ed-scroll-btn:hover{background:#fff;color:var(--ink);border-color:var(--gold);}'
+ '.ed-yuan .ed-scroll-btn.primary{color:#fff8e6;border-color:var(--gold-d);background:linear-gradient(160deg,var(--gold-hi),var(--gold) 55%,var(--gold-d));box-shadow:inset 0 1px 0 rgba(255,255,255,0.35),0 2px 5px rgba(125,94,34,0.3);}'
+ '.ed-yuan .ed-scroll-btn.primary:hover{filter:brightness(1.07);color:#fff;}'
// ── 议事清册卡·优先级修正 (renderEdictSuggestionItem 吐 .edict-sug-* · installActionPanelExactStyles 的 body.tm-phase8-formal .edict-sug-* (0,2,2) 浅字盖过我的 .ed-yuan (0,2,1) → 浅底浅字看不清 · 用 body.tm-phase8-formal .ed-yuan (0,3,x)+!important 强制浅底深字) ──
+ 'body.tm-phase8-formal .ed-yuan .edict-sug-v2{background:linear-gradient(165deg,#fffefa,#fbf4e1) !important;border:1px solid rgba(168,131,58,0.24) !important;border-radius:5px !important;}'
+ 'body.tm-phase8-formal .ed-yuan .edict-sug-v2 b{color:#3c6053 !important;font-weight:normal;}'
+ 'body.tm-phase8-formal .ed-yuan .edict-sug-v2 p{color:#574733 !important;}'
+ 'body.tm-phase8-formal .ed-yuan .edict-sug-v2 p:first-of-type{color:#7d5e22 !important;}'
+ 'body.tm-phase8-formal .ed-yuan .edict-sug-portrait-wrap{border:1px solid #7d5e22 !important;background:radial-gradient(circle at 50% 28%,rgba(201,160,69,.2),#e7d6ad 70%) !important;color:#7d5e22 !important;}'
+ 'body.tm-phase8-formal .ed-yuan .tm-chip{color:#3c6053 !important;border:1px solid rgba(85,127,111,0.4) !important;background:rgba(85,127,111,0.06) !important;}'
+ 'body.tm-phase8-formal .ed-yuan .tm-chip.hot{color:#a83228 !important;border-color:rgba(168,50,40,0.45) !important;background:rgba(168,50,40,0.06) !important;}'
+ 'body.tm-phase8-formal .ed-yuan .edict-sug-adopt{min-height:30px !important;padding:6px 14px !important;color:#fff8e6 !important;border:1px solid #7d5e22 !important;border-radius:4px !important;font-size:12.5px !important;letter-spacing:0.18em;background:linear-gradient(160deg,#c64a3e,#a83228 55%,#7a2018) !important;box-shadow:inset 0 1px 0 rgba(255,255,255,0.22),inset 0 0 0 1px rgba(216,185,106,0.32),0 2px 5px rgba(122,32,24,0.3) !important;cursor:pointer;}'
+ 'body.tm-phase8-formal .ed-yuan .edict-sug-adopt:hover{box-shadow:inset 0 1px 0 rgba(255,255,255,0.3),inset 0 0 0 1px rgba(216,185,106,0.6),0 4px 11px rgba(122,32,24,0.42) !important;}'
+ 'body.tm-phase8-formal .ed-yuan .edict-sug-delete{min-width:28px !important;min-height:28px !important;color:#9c8b6b !important;border:1px solid rgba(140,124,96,0.5) !important;border-radius:4px !important;background:transparent !important;font-size:15px !important;cursor:pointer;}'
+ 'body.tm-phase8-formal .ed-yuan .edict-sug-delete:hover{color:#a83228 !important;border-color:#a83228 !important;background:rgba(168,50,40,0.08) !important;}'
// ── footer 布局修 (renderEdictSuggestionItem 用裸 <span> 包按钮·display:inline → 内含 block 按钮塌成 w0·看不见。强制 footer flex + 按钮 span flex + 按钮 inline-flex 自然撑开) ──
+ 'body.tm-phase8-formal .ed-yuan .edict-sug-footer{display:flex !important;flex-wrap:wrap !important;align-items:center;justify-content:flex-start;gap:8px;margin-top:8px;}'
+ 'body.tm-phase8-formal .ed-yuan .edict-sug-footer>.tm-chip-row{display:flex !important;flex-wrap:wrap;align-items:center;gap:5px;min-width:0;flex:1 1 auto;}'
+ 'body.tm-phase8-formal .ed-yuan .edict-sug-footer>span:last-of-type{display:flex !important;align-items:center;gap:7px;flex:0 0 auto;margin-left:auto;}'
+ 'body.tm-phase8-formal .ed-yuan .edict-sug-adopt{display:inline-flex !important;align-items:center;justify-content:center;flex:0 0 auto !important;width:auto !important;white-space:nowrap;}'
+ 'body.tm-phase8-formal .ed-yuan .edict-sug-delete{display:inline-flex !important;align-items:center;justify-content:center;flex:0 0 auto;width:28px !important;white-space:nowrap;}'; if (st.__tmCss !== __css) { st.__tmCss = __css; st.textContent = __css; }
  }

  function renderFormalEdictArchive(){
    var gm = window.GM || {};
    var archiveHtml = '';
    if (gm._edictTracker && gm._edictTracker.length > 0) {
      var allEdicts = gm._edictTracker.filter(function(e){ return e && Number(e.turn || 0) < Number(gm.turn || 1); });
      if (allEdicts.length > 0) {
        var byTurn = {};
        allEdicts.forEach(function(e){ (byTurn[e.turn] || (byTurn[e.turn] = [])).push(e); });
        var turns = Object.keys(byTurn).sort(function(a, b){ return Number(b) - Number(a); });
        turns.forEach(function(turn){
          var turnText = typeof window.getTSText === 'function' ? window.getTSText(parseInt(turn, 10)) : 'T' + turn;
          archiveHtml += '<div class="arc-turn">第 ' + esc(turn) + ' 回合 · ' + esc(turnText) + '</div>';
          byTurn[turn].forEach(function(e){
            var color = e.status === 'completed' ? '#557f6f' : e.status === 'obstructed' ? '#a83228' : e.status === 'partial' ? '#c67e22' : e.status === 'pending_delivery' ? '#b58324' : '#9c8b6b';
            var mark = { completed:'✅', obstructed:'❌', partial:'⚠️', executing:'⏳', pending:'⭕', pending_delivery:'📨' }[e.status] || '·';
            archiveHtml += '<div class="arc-item" style="--st-c:' + color + ';"><span class="a-mark">' + mark + '</span><span class="a-cat">' + esc(e.category || '') + '</span> ' + esc(e.content || '');
            if (e.assignee) archiveHtml += ' <span class="a-assignee">[执行:' + esc(e.assignee) + ']</span>';
            if (e.feedback) archiveHtml += '<div class="a-fb">' + esc(e.feedback) + '</div>';
            archiveHtml += '</div>';
          });
        });
      }
    }
    if (!archiveHtml) archiveHtml = '<div class="arc-turn">尚无往期诏令</div><div class="arc-item" style="--st-c:#9c8b6b;">诏付有司、过回合后，历次诏令的承办与回执将归档于此。</div>';
    return archiveHtml;
  }

  function renderFormalEdictPanel(){
    restoreFormalDraftsFromGM(false);
    installEdictYuanStyles();
    var gm = window.GM || {};
    var role = '天子';
    var sc = (typeof window.findScenarioById === 'function') ? window.findScenarioById(gm.sid) : null;
    if (sc && sc.role) role = sc.role;
    var icon = typeof window.tmIcon === 'function' ? window.tmIcon : function(){ return ''; };
    var cats = [
      {id:'edict-pol', keys:['policy','political'], cat:'政', cs1:'政', cs2:'令', hint:'朝政·吏治', placeholder:'请输入政令诏书内容……\n例如：着吏部澄清铨选、起复废籍贤良、纠劾贪墨之吏，以正朝纲。'},
      {id:'edict-mil', keys:['military'], cat:'军', cs1:'军', cs2:'令', hint:'边镇·粮饷', placeholder:'请输入军令诏书内容……\n例如：诏蓟辽督师整饬关宁防务、缮治城堡、核实兵额，毋得虚冒。'},
      {id:'edict-dip', keys:['diplomatic','diplomacy'], cat:'外', cs1:'外', cs2:'交', hint:'藩属·和战', placeholder:'请输入外交诏书内容……\n例如：谕宣大抚镇羁縻插汉诸部、慎启边衅，以市赏怀远人。'},
      {id:'edict-eco', keys:['finance','economic','economy'], cat:'经', cs1:'经', cs2:'济', hint:'税赋·漕运', placeholder:'请输入经济诏书内容……\n例如：诏免被灾州县积逋钱粮、开常平仓平粜、停不急之征。'},
      {id:'edict-oth', keys:['other','private'], cat:'他', cs1:'其', cs2:'他', hint:'礼制·恩典', placeholder:'请输入其他诏书内容……\n例如：诏修两朝实录、旌表忠孝节义、蠲免逋负、肆赦天下。'}
    ];
    var suggestions = getEdictSuggestionRows();
    var nf = '奉天承运皇帝<i class="hc-sep"></i>诏曰：';
    var subDate = (typeof window.getTSText === 'function') ? window.getTSText(Number(gm.turn || 1)) : ('第 ' + (gm.turn || 1) + ' 回合');
    // Hidden history only needs a count here. Build its complete original markup
    // on the explicit archive action, using current data rather than a stale cache.
    var archiveCount = 0;
    if (gm._edictTracker && gm._edictTracker.length > 0) {
      archiveCount = gm._edictTracker.filter(function(e){ return e && Number(e.turn || 0) < Number(gm.turn || 1); }).length;
    }

    var html = '<section class="ed-yuan" data-tab="edict">';
    html += '<div class="scroll-wrap"><div class="roller-v"></div>';
    html += '<div class="silk">';
    // ── 抬头：拟诏/主角行止 tab · 居中御笔 · 历史诏书入口 ──
    html += '<div class="silk-head">';
    html += '<div class="tab-switch">';
    html += '<button type="button" class="ed-tab active" data-tab="edict" onclick="var p=this.closest(&quot;.ed-yuan&quot;);p.setAttribute(&quot;data-tab&quot;,&quot;edict&quot;);p.querySelectorAll(&quot;.ed-tab&quot;).forEach(function(t){t.classList.toggle(&quot;active&quot;,t.getAttribute(&quot;data-tab&quot;)===&quot;edict&quot;);});">拟诏</button>';
    html += '<button type="button" class="ed-tab" data-tab="xinglu" onclick="var p=this.closest(&quot;.ed-yuan&quot;);p.setAttribute(&quot;data-tab&quot;,&quot;xinglu&quot;);p.querySelectorAll(&quot;.ed-tab&quot;).forEach(function(t){t.classList.toggle(&quot;active&quot;,t.getAttribute(&quot;data-tab&quot;)===&quot;xinglu&quot;);});">主角行止</button>';
    html += '</div>';
    html += '<div class="head-center"><div class="hc-main">' + nf + '</div><div class="hc-sub">' + esc(subDate) + '</div></div>';
    html += '<div class="head-right"><button type="button" class="link-btn" data-desk-edict-archive="1"><span>🗞</span>历史诏书<span class="n">' + esc(archiveCount) + '</span></button></div>';
    html += '</div>';
    // ── 三栏主体 ──
    html += '<div class="silk-body">';
    // 左：议事清册 (常驻·复用 renderEdictSuggestionItem·含立绘/纳入选类/删除)
    html += '<aside class="col-sug"><div class="col-sug-t">议 事 清 册 <small>' + esc(suggestions.length) + ' 条</small></div><div class="sug-list">';
    html += suggestions.map(renderEdictSuggestionItem).join('') || '<article class="edict-sug-v2 edict-sug-empty"><div><b>暂无御案建议</b><p>召开朝议、问对或处理奏疏后，可摘入诏书草拟。</p></div></article>';
    html += '</div></aside>';
    // 中：拟诏 / 主角行止
    html += '<div class="col-main">';
    // 拟诏 tab
    html += '<div class="ed-tab-panel edict"><div class="edict-col">';
    // 2026-06-11·治「整体颁行后诏书凭空消失」:整体颁行把各类草拟合并成一道诏书存入 GM.edicts(status=promulgated·清空五类),
    //   此处把本回合已颁行的完整诏书整块显示出来(否则草拟清空+无显示=像消失·比旧版塞政令更糟)。每回合至多一道(见 _applyPolishedEdict)。
    var _promThisTurn = (Array.isArray(gm.edicts) ? gm.edicts : []).filter(function(e){
      return e && e.status === 'promulgated' && Number(e.turn || 0) === Number(gm.turn || 1) && String(e.text || '').trim();
    });
    if (_promThisTurn.length) {
      html += '<div class="edict-prom-card">';
      html += '<div class="epc-hd"><span class="epc-seal">颁</span><b>本回合已颁行诏书</b><em>已合并各类旨意 · 将作为一道完整诏书整体推演</em></div>';
      _promThisTurn.forEach(function(e){
        html += '<div class="epc-body wd-selectable">' + fullHongyanText(e.text, '（空）', 'epc-text') + '</div>';
        html += '<div class="epc-acts">' + actionBtn('撤回改拟', 'edict-prom-revoke-desk', { id:e.id || '' }, 'epc-btn') + '<span class="epc-note">如需修改·撤回后全文放回「政令」草拟·可重新润色颁行</span></div>';
      });
      html += '</div>';
    }
    cats.forEach(function(cat, i){
      var v0 = legacyEdictDraftValue(cat.id, cat.keys);
      var inked = String(v0 || '').trim() ? ' inked' : '';
      html += '<div class="erow" data-cat="' + attr(cat.cat) + '" style="animation-delay:' + (0.06 * (i + 1)).toFixed(2) + 's">';
      html += '<div class="seal-col"><div class="cell-seal' + inked + '" data-cat="' + attr(cat.cat) + '"><span class="cs-1">' + esc(cat.cs1) + '</span><span class="cs-2">' + esc(cat.cs2) + '</span></div><span class="seal-hint">' + esc(cat.hint) + '</span></div>';
      html += '<div class="erow-body">';
      html += '<textarea id="' + attr(cat.id) + '" class="cat-field" data-cat="' + attr(cat.cat) + '" data-desk-edict-cat="' + attr(cat.keys[0]) + '" data-label="' + attr(cat.cat) + '" placeholder="' + attr(cat.placeholder) + '" oninput="var s=window.TM_PHASE8_FORMAL||(window.TM_PHASE8_FORMAL={});var d=s.edictDrafts||(s.edictDrafts={});d[&quot;' + attr(cat.keys[0]) + '&quot;]=this.value;if(window._edictLiveForecast)window._edictLiveForecast(&quot;' + attr(cat.id) + '&quot;);var er=this.closest(&quot;.erow&quot;);if(er){var sl=er.querySelector(&quot;.cell-seal&quot;);if(sl)sl.classList.toggle(&quot;inked&quot;,!!this.value.trim());}">' + esc(v0) + '</textarea>';
      html += '<div id="' + attr(cat.id) + '-forecast" class="ed-forecast" style="display:none;"></div>';
      html += '</div></div>';
    });
    // 文风选择 (保留 #edict-polish-style 供 _polishEdicts 读) + 润色结果容器
    html += '<div class="ed-polish-bar"><span class="lbl">文 风</span>';
    html += '<select id="edict-polish-style"><option value="elegant">典雅骈文</option><option value="concise">简洁明快</option><option value="ornate">华丽文藻</option><option value="plain">白话文言</option></select></div>';
    html += '</div></div>';
    // 主角行止 tab
    html += '<div class="ed-tab-panel xinglu">';
    html += '<div class="xinglu-main"><div class="xm-hd"><span class="xm-title">本 回 合 行 动</span><span class="xm-desc">—— 私事不入诏书·仅影响人物·皇威·民心</span></div>';
    html += '<textarea id="xinglu-pub" class="x-field" data-desk-player-action="1" placeholder="如：召见某臣、校阅三军、微服私访、夜读史书、祖庙祭祀、宴请群臣、命人查办旧案……" oninput="(window.TM_PHASE8_FORMAL||(window.TM_PHASE8_FORMAL={})).playerAction=this.value">' + esc(deskValue('#xinglu-pub', state.playerAction || '')) + '</textarea></div>';
    var recentXinglu = firstArray(gm.qijuHistory).filter(function(q){ return q && q.xinglu && Number(q.turn || 0) < Number(gm.turn || 1); }).slice(0, 6); // qijuHistory 已 newest-first·头 6 条即最近·无需再 reverse
    html += '<div class="xinglu-hist"><div class="xh-t">近 期 行 止 记 录 · ' + esc(recentXinglu.length) + ' 条</div><div class="xh-list">';
    if (recentXinglu.length) {
      recentXinglu.forEach(function(q){ html += '<div class="x-hist-item"><span class="t">T' + esc(q.turn) + '</span>' + esc(q.xinglu) + '</div>'; });
    } else {
      html += '<div class="x-hist-item">暂无近期行止记录。</div>';
    }
    html += '</div></div>';
    html += '</div>';
    html += '<div id="edict-polished" class="ed-polish-float" aria-live="polite"></div>';
    html += '</div>';
    // 右：竖排操作 有司润色 / 诏付有司
    html += '<div class="col-actions">';
    html += '<button type="button" class="act-polish" onclick="if(window._polishEdicts)window._polishEdicts();else if(window.toast)toast(\'诏书润色模块尚未载入\')"><span class="al">有<br>司<br>润<br>色</span></button>';
    html += '<div class="act-spacer"></div>';
    html += '<button type="button" class="act-seal" id="btn-end" onclick="var b=this;b.classList.remove(&quot;stamped&quot;);void b.offsetWidth;b.classList.add(&quot;stamped&quot;);if(window.confirmEndTurn)window.confirmEndTurn();"><span class="al">诏<br>付<br>有<br>司</span></button>';
    html += '</div>';
    html += '</div>';     // /silk-body
    // 历史诏书弹窗
    html += '<div class="arc-modal"><div class="arc-scrim" onclick="this.closest(&quot;.arc-modal&quot;).classList.remove(&quot;show&quot;);"></div>';
    html += '<div class="arc-card"><div class="arc-card-hd"><span class="ah-l"><span class="ah-seal">史</span>历 史 诏 书</span><span class="arc-x" onclick="this.closest(&quot;.arc-modal&quot;).classList.remove(&quot;show&quot;);">×</span></div>';
    html += '<div class="arc-body"></div></div></div>';
    html += '</div>';     // /silk
    html += '<div class="roller-v"></div></div>';     // /scroll-wrap
    html += '</section>';
    return html;
  }

  // <SPLIT26-SCAFFOLD> 第二十六拆·御案奏疏(zou-yuan)+鸿雁(yan-yuan)面板迁出 → phase8-formal-drafts-message-panels.js
  //   范式②b origin-first 双向 bucket(window.TM.__p8DraftsMsgPanels)·sibling 装载于 origin【之后】·勿动装载位置
  //   origin 向 bucket 导出被迁出段捕获的 18 个成员；sibling 回填 origin 仍按名调用的 9 个函数(下方 forward shim)
  var __p8mp = (function(){ var t = window.TM = window.TM || {}; return t.__p8DraftsMsgPanels = t.__p8DraftsMsgPanels || {}; })();
  __p8mp.bridge = bridge; __p8mp.state = state; __p8mp.esc = esc; __p8mp.attr = attr;
  __p8mp.personKey = personKey; __p8mp.getPeople = getPeople; __p8mp.firstArray = firstArray;
  __p8mp.compactText = compactText; __p8mp.getMemorials = getMemorials; __p8mp.getLetters = getLetters;
  __p8mp.tmfRenwuPortrait = tmfRenwuPortrait; __p8mp.fullHongyanText = fullHongyanText;
  __p8mp.restoreFormalDraftsFromGM = restoreFormalDraftsFromGM; __p8mp.handleModuleAction = handleModuleAction;
  __p8mp.openDeskOverlay = openDeskOverlay; __p8mp.actionChip = actionChip; __p8mp.actionBtn = actionBtn;
  __p8mp.openHongyanPreviewPanel = openHongyanPreviewPanel;
  function renderFormalMemorialPanel(){ return __p8mp.renderFormalMemorialPanel.apply(this, arguments); }
  function renderFormalLetterPanel(){ return __p8mp.renderFormalLetterPanel.apply(this, arguments); }
  function letterTypeLabelFormal(){ return __p8mp.letterTypeLabelFormal.apply(this, arguments); }
  function letterUrgencyLabelFormal(){ return __p8mp.letterUrgencyLabelFormal.apply(this, arguments); }
  function letterCipherLabelFormal(){ return __p8mp.letterCipherLabelFormal.apply(this, arguments); }
  function letterSendModeLabelFormal(){ return __p8mp.letterSendModeLabelFormal.apply(this, arguments); }
  function letterTimeFormal(){ return __p8mp.letterTimeFormal.apply(this, arguments); }
  function formalIncomingLetters(){ return __p8mp.formalIncomingLetters.apply(this, arguments); }
  function openLetterReadOverlay(){ return __p8mp.openLetterReadOverlay.apply(this, arguments); }
  // </SPLIT26-SCAFFOLD>

  function openZhaoPreviewPanel(){
    removeFormalEdictHiddenInputs();
    openDeskOverlay('tm-action-edict-overlay', actionShell('edict', renderFormalEdictPanel()));
    setTimeout(function(){
      if (typeof window._edictLiveForecast === 'function') {
        ['edict-pol','edict-mil','edict-dip','edict-eco','edict-oth'].forEach(function(id){
          try { window._edictLiveForecast(id); } catch(_) {}
        });
      }
    }, 0);
    return;
    var issues = getIssues().slice(0, 10);
    var draft = state.edictDraft && state.edictDraft.length ? state.edictDraft : ['奉天承运皇帝诏曰：', '诸司各以本职详议急务，毋得互相推诿。'];
    var issueItems = issues.map(function(x){
      return { id: x.id, title: x.title, meta: [x.category, x.severity, x.proposer].filter(Boolean).join(' · ') || compactText(x.text, 36) };
    });
    var left = deskTabs(['诏令','草稿','旧诏'], 0) + deskList(issueItems, '暂无可纳入诏令的御案议题。', { action:'add-edict-desk' });
    var main = '<h3 class="tm-desk-title">诏令草拟</h3>' +
      '<div class="tm-desk-field"><span>诏令类型</span><select data-desk-edict-type><option>敕令</option><option>谕旨</option><option>诰命</option><option>手诏</option><option>密旨</option></select></div>' +
      '<div class="tm-desk-field"><span>收受衙门</span><input data-desk-edict-receiver value="内阁、六部、都察院"></div>' +
      '<div class="tm-desk-field"><span>关联议题</span><input data-desk-edict-issue value="' + attr((issues[0] && issues[0].title) || '御案待裁') + '"></div>' +
      '<textarea aria-label="诏令正文" data-desk-edict-body>' + esc(draft.join('\n')) + '</textarea>' +
      '<div class="tm-desk-actions">' + deskAction('颁行诏令','publish-edict-desk',{}, true) + deskAction('交内阁票拟','save-edict-desk',{ stage:'review' }) + deskAction('存为草稿','save-edict-desk',{ stage:'draft' }) + deskAction('清空草诏','clear-edict-desk') + '</div>' +
      '<h4 class="tm-desk-subtitle">旧诏令页职能</h4>' +
      '<table class="tm-desk-table"><tr><th>项目</th><th>承接内容</th></tr><tr><td>合法性</td><td>校验皇权、诏令通过率、衙门承接能力</td></tr><tr><td>执行链</td><td>皇帝 → 内阁/司礼监 → 六部 → 地方/军镇</td></tr><tr><td>结果</td><td>写入近事、史官实录、变量影响与人物态度</td></tr></table>';
    var right = '<h4 class="tm-desk-subtitle">诏令影响预估</h4>' + deskStats([
      ['待纳议题', issues.length + ' 件'],
      ['草诏段落', draft.length + ' 条'],
      ['本回合', getTurnText(window.GM && GM.turn)],
      ['后续归档', '近事 / 实录']
    ]) + '<h4 class="tm-desk-subtitle">风险</h4>' +
      deskCard('票拟阻滞', '诏令过宽或财源不明时，内阁、户部、兵部可能推诿或要求复议。') +
      deskCard('可联动', '可从此处转入朝议、奏疏批复、史官实录与人物记忆。');
    openDeskOverlay('tm-zhao-overlay', deskPanelShell('edict', '撰写诏书', '承接旧 UI「诏令」标签页：草拟、校验、下发、留档', left, main, right));
  }

  function openYueZouPreviewPanel(){
    openDeskOverlay('tm-action-memorial-overlay', actionShell('memorial', renderFormalMemorialPanel()));
    return;
    var mems = getMemorials();
    var selected = mems.find(function(x){ return String(x.id) === String(state.memorialId || ''); }) || mems[0] || {};
    if (selected.id) state.memorialId = selected.id;
    var items = mems.map(function(x){
      return { id: x.id, title: x.title, meta: [x.from, x.dept, x.status].filter(Boolean).join(' · '), hot: String(x.id) === String(selected.id || '') };
    });
    var left = deskTabs(['待批','已批','钉选'], 0) + deskList(items, '暂无奏疏；御案议题与近事会补入此处。', { action:'select-memorial-desk' });
    var main = '<h3 class="tm-desk-title">奏疏批阅</h3>' +
      deskRows([['题名', selected.title || '暂无奏疏'], ['具奏', selected.from || '臣工'], ['衙门', selected.dept || '通政司'], ['状态', selected.status || '待批']]) +
      deskCard('奏疏正文', selected.text || '暂无正文。') +
      '<h4 class="tm-desk-subtitle">朱批</h4><textarea aria-label="朱批" data-desk-memorial-reply>着有关衙门速核，限期具册。若事涉军国钱粮，令内阁会同户部、兵部并议。</textarea>' +
      '<div class="tm-desk-actions">' + deskAction('准奏','memorial-decision-desk',{ id:selected.id || '', decision:'approved' }, true) + deskAction('驳回','memorial-decision-desk',{ id:selected.id || '', decision:'rejected' }) + deskAction('批示','memorial-decision-desk',{ id:selected.id || '', decision:'annotated' }) + deskAction('留中','memorial-decision-desk',{ id:selected.id || '', decision:'hold' }) + deskAction('转朝议','memorial-decision-desk',{ id:selected.id || '', decision:'court_debate' }) + deskAction('拟诏','memorial-edict-desk',{ id:selected.id || '' }) + '</div>';
    var right = '<h4 class="tm-desk-subtitle">旧奏疏页侧栏</h4>' + deskStats([
      ['待批', mems.length + ' 件'],
      ['急件', mems.filter(function(x){ return /急|urgent|high/i.test(String(x.status) + String(x.title)); }).length + ' 件'],
      ['可转议', getIssues().length + ' 项'],
      ['归档', '史官 / 近事']
    ]) + deskCard('筛选', '按急缓、衙门、人物、地区、变量、是否已批分类。') +
      deskCard('批复后', '写入近事、御案时政、人物记忆与史官档案。');
    openDeskOverlay('tm-zoushu-overlay', deskPanelShell('memorial', '百官奏疏', '承接旧 UI「奏疏」标签页：筛选、阅览、朱批、转议', left, main, right));
  }

  function openHongyanPreviewPanel(){
    openDeskOverlay('tm-action-letter-overlay', actionShell('letter', renderFormalLetterPanel()));
    return;
    var letters = getLetters();
    var people = getPeople().slice(0, 10);
    var target = (window.GM && GM._pendingLetterTo) || (people[0] && (people[0].name || personKey(people[0]))) || '臣工';
    var items = letters.map(function(x){
      return { id: x.id, title: x.title, meta: [x.from, '→ ' + x.to, x.status].filter(Boolean).join(' · '), text: x.text };
    });
    var left = deskTabs(['来信','发信','驿路'], 0) + deskList(items, '暂无来信。可从右侧人物图志或此处直接拟信。');
    var main = '<h3 class="tm-desk-title">鸿雁传书</h3>' +
      '<div class="tm-desk-field"><span>收信人</span><input data-desk-letter-to value="' + attr(target) + '"></div>' +
      '<div class="tm-desk-field"><span>驿路</span><select data-desk-letter-route><option>急递</option><option>常递</option><option>密递</option></select></div>' +
      '<div class="tm-desk-field"><span>语气</span><select data-desk-letter-tone><option>慰问</option><option>申饬</option><option>密询</option><option>嘉奖</option></select></div>' +
      '<textarea aria-label="书信正文" data-desk-letter-body>卿在外任，凡地方灾伤、军饷、民情，务须据实具奏，不得粉饰。</textarea>' +
      '<div class="tm-desk-actions">' + deskAction('遣使送出','letter-send-desk',{}, true) + deskAction('存为草稿','letter-draft-desk') + deskAction('转问对','module-desk',{ kind:'wendui' }) + deskAction('入人物记忆','letter-memory-desk') + '</div>' +
      '<h4 class="tm-desk-subtitle">通信记录</h4>' +
      (items.length ? items.slice(0, 2).map(function(x){ return deskCard(x.title, x.text || x.meta); }).join('') : deskCard('暂无通信', '远方人物、军镇、地方官可通过鸿雁传书建立联系。'));
    var right = '<h4 class="tm-desk-subtitle">旧鸿雁页职能</h4>' +
      deskRows([['远方臣子','不在京人物默认走传书'], ['耗时','随距离与驿路等级变化'], ['结果','改变人物态度、触发回复、写入近事']]) +
      '<h4 class="tm-desk-subtitle">可选收信人</h4>' +
      (people.length ? '<div class="tm-desk-list">' + people.map(function(p){ var nm = p.name || personKey(p); return '<button type="button" class="tm-desk-item" data-desk-action="letter-target-desk" data-name="' + attr(nm) + '"><b>' + esc(nm) + '</b><span>' + esc(p.office || p.title || p.faction || '人物图志') + '</span></button>'; }).join('') + '</div>' : deskCard('人物未载入', '人物数据载入后可从这里选定收信人。'));
    openDeskOverlay('tm-hongyan-overlay', deskPanelShell('letter', '鸿雁传书', '承接旧 UI「鸿雁传书」标签页：来信、发信、驿路、回信', left, main, right));
  }

  function openShiluPreviewPanel(){
    // renderFormalRecordsPanel split out·2026-05-26·Wave 1 → phase8-formal-records.js
    var recordsPanel = (window.TMPhase8FormalBridge && TMPhase8FormalBridge.records && TMPhase8FormalBridge.records.renderFormalRecordsPanel)
      ? TMPhase8FormalBridge.records.renderFormalRecordsPanel()
      : '<div class="tm-desk-empty">records module not loaded</div>';
    openDeskOverlay('tm-action-records-overlay', actionShell('records', recordsPanel));
    return;
    var tab = state.recordTab || 'shiji';
    var tabs = [['shiji','史记'],['shilu','实录'],['jishi','纪事'],['biannian','编年']];
    var events = collectRecentEvents(12);
    var selected = events.find(function(x){ return String(x.id || x.title) === String(state.recordId || ''); }) || events[0] || {};
    if (selected.id || selected.title) state.recordId = selected.id || selected.title;
    var left = '<div class="tm-desk-tabs">' + tabs.map(function(t){
      return '<button type="button" class="tm-desk-tab ' + (tab === t[0] ? 'active' : '') + '" data-desk-action="record-tab-desk" data-tab="' + attr(t[0]) + '">' + esc(t[1]) + '</button>';
    }).join('') + '</div>' + deskList(events.slice(0, 12).map(function(x){
      return { id: x.id || x.title, title: x.title, meta: ['T' + (x.turn || ''), x.type, x.time].filter(Boolean).join(' · '), text: x.text, hot: String(x.id || x.title) === String(state.recordId || '') };
    }), '暂无回合档案。', { action:'select-record-desk' });
    var main = '<h3 class="tm-desk-title">史官实录</h3>' +
      deskCard(selected.title || '暂无档案', selected.text || selected.detail || '过回合、诏令、问对、朝议、奏疏与地块事件会自动归档。') +
      '<table class="tm-desk-table"><tr><th>类目</th><th>承接旧 UI 内容</th></tr><tr><td>史记</td><td>按人物、地区、势力与大事归档</td></tr><tr><td>实录</td><td>保留诏令、问对、朝议、奏疏的逐条记录</td></tr><tr><td>纪事</td><td>把连续事件串为本末线索</td></tr><tr><td>编年</td><td>按回合与日期排序，自动纳入近事</td></tr></table>' +
      '<h4 class="tm-desk-subtitle">摘录</h4><textarea aria-label="史官摘录" data-desk-record-body>' + esc(selected.detail || selected.text || '') + '</textarea>' +
      '<div class="tm-desk-actions">' + deskAction('收入实录','record-archive-desk',{ record:'shilu' }, true) + deskAction('编入纪事','record-archive-desk',{ record:'jishi' }) + deskAction('转为编年','record-archive-desk',{ record:'biannian' }) + deskAction('关联人物','module-desk',{ kind:'renwu' }) + '</div>';
    var right = '<h4 class="tm-desk-subtitle">归档状态</h4>' + deskStats([
      ['本回近事', events.filter(function(x){ return Number(x.turn || 0) === Number((window.GM && GM.turn) || 1); }).length + ' 条'],
      ['近期待归档', events.length + ' 条'],
      ['当前类目', (tabs.find(function(t){ return t[0] === tab; }) || tabs[0])[1]],
      ['人物摘录', getPeople().length + ' 人']
    ]) + deskCard('自动来源', '御案时政、问对、朝议、奏疏、鸿雁、地图事件与过回合史记弹窗。');
    openDeskOverlay('tm-shilu-overlay', deskPanelShell('records', '史官实录', '承接旧 UI「史记 / 实录 / 纪事 / 编年」四类档案', left, main, right));
  }

  // ── public API attach (Wave 4·drafts) ─────────────────────────────
  bridge.drafts = bridge.drafts || {};
  // 导出本地 helper 实现·让 bridge._actionBtn/_actionChip/_renderActionStats 的 shim (及 records/rightrail 的别名) 真正解析到实现·
  // 此前缺失 → shim 返回空串 → 御案面板按钮/印记/统计条集体不渲染 (修复 2026-05-29)
  bridge.drafts.actionBtn = actionBtn;
  bridge.drafts.actionChip = actionChip;
  bridge.drafts.renderActionStats = renderActionStats;
  bridge.drafts.installDeskPanelExactStyles = installDeskPanelExactStyles;
  bridge.drafts.installActionPanelExactStyles = installActionPanelExactStyles;
  bridge.drafts.closeDeskOverlay = closeDeskOverlay;
  bridge.drafts.openDeskOverlay = openDeskOverlay;
  bridge.drafts.captureDeskOverlayState = captureDeskOverlayState;
  bridge.drafts.openZhaoPreviewPanel = openZhaoPreviewPanel;
  bridge.drafts.openYueZouPreviewPanel = openYueZouPreviewPanel;
  bridge.drafts.openHongyanPreviewPanel = openHongyanPreviewPanel;
  bridge.drafts.openShiluPreviewPanel = openShiluPreviewPanel;
  bridge.drafts.handleDeskAction = handleDeskAction;
  bridge.drafts.recordDeskActionSignal = recordDeskActionSignal;
  bridge.drafts.showFormalEdictAdoptMenu = showFormalEdictAdoptMenu;
  bridge.drafts.dismissFormalEdictSuggestion = dismissFormalEdictSuggestion;
  bridge.drafts.getFormalEdictDraftSnapshot = getFormalEdictDraftSnapshot;
  bridge.drafts.clearFormalEdictDrafts = clearFormalEdictDrafts;
  bridge.drafts.syncFormalEdictDraftsToLegacyInputs = syncFormalEdictDraftsToLegacyInputs;
  bridge.drafts.applyPolishedEdict = applyFormalPolishedEdict;

  // ── re-attach bridge.X exports that previously came from bridge.js ──
  bridge.openZhao = openZhaoPreviewPanel;
  bridge.openYueZou = openYueZouPreviewPanel;
  bridge.openHongyan = openHongyanPreviewPanel;
  bridge.openShilu = openShiluPreviewPanel;
  bridge.showEdictAdoptMenu = showFormalEdictAdoptMenu;
  bridge.dismissEdictSuggestion = dismissFormalEdictSuggestion;
  bridge.getEdictDraftSnapshot = getFormalEdictDraftSnapshot;
  bridge.clearEdictDrafts = clearFormalEdictDrafts;
  bridge.syncEdictDraftsToLegacy = syncFormalEdictDraftsToLegacyInputs;
  bridge.applyPolishedEdict = applyFormalPolishedEdict;
  bridge._openHongyanPreviewPanel = openHongyanPreviewPanel;
  bridge._openShiluPreviewPanel = openShiluPreviewPanel;

  // ── re-attach window.* exports ────────────────────────────────────
  window.openZhao = openZhaoPreviewPanel;
  window.openYueZou = openYueZouPreviewPanel;
  window.openHongyan = openHongyanPreviewPanel;
  window.openShilu = openShiluPreviewPanel;
  window.syncPhase8FormalEdictDrafts = syncFormalEdictDraftsToLegacyInputs;
  window.getPhase8FormalEdictDraftSnapshot = getFormalEdictDraftSnapshot;
  window.applyPhase8FormalPolishedEdict = applyFormalPolishedEdict;

  // N4 nesting knife: single-point collapse of the SVG xmlns URL used in the
  // data-URI CSS strings of installEdictYuanStyles (byte-equivalent concatenation).
  function _edictYuanSvgNs(){
    return 'http://www.w3.org/2000/svg';
  }

})();
