// ── 章节导航（grep 小节标题跳转，行号会漂）──
//   御案正式界面·总线（split paradigm 的 hub·state=window.TM_PHASE8_FORMAL·暴露 ~46 渲染入口）
//   §1 状态/基建   STORE_KEY 钉人 · 邸抄 event feed helpers（v3.3）
//   §2 已迁出      中央地图→phase8-formal-map.js · 起草/预览面板→-drafts.js
//                  module dispatch/人物图志→-modules.js · 右 rail panels→-rightrail.js
//   §3 共享导出    shared helper exposure（供 phase8-formal-{module}.js late-bind 用）
//   注：这是 2026-05-26 Wave 拆分的主壳·各 wave 子文件靠 bridge._xxx + late-bound wrapper 回调
// ─────────────────────────────────────────────
(function(){
  'use strict';

  var STORE_KEY = 'tm_phase8_pinned_people';
  var ASSET_BASE = 'preview/img/';
  var state = window.TM_PHASE8_FORMAL = window.TM_PHASE8_FORMAL || {};

  state.pinnedPeople = Array.isArray(state.pinnedPeople) ? state.pinnedPeople : loadPinned();
  state.activeSlot = state.activeSlot || '';
  state.eventLookback = state.eventLookback || 3;
  state.eventExpandedIdx = state.eventExpandedIdx == null ? null : (Number.isFinite(Number(state.eventExpandedIdx)) ? Number(state.eventExpandedIdx) : null);
  // v3.3 邸抄·filter/density/collapse
  state.eventFilter = state.eventFilter || 'all';
  state.eventDensity = state.eventDensity || 'compact';
  state.eventCollapsed = state.eventCollapsed === true;
  state.mapMode = state.mapMode || 'owner';
  state.mapScale = state.mapScale || 'region';
  state.mapView = state.mapView || { scale: 1, tx: 0, ty: 0 };
  state.legacyView = false;
  state.runtimeChromeSig = state.runtimeChromeSig || '';

  function cloneDraftValue(value){
    if (value == null) return value;
    try { return JSON.parse(JSON.stringify(value)); }
    catch(_) {
      if (Array.isArray(value)) return value.slice();
      if (typeof value === 'object') {
        var out = {};
        Object.keys(value).forEach(function(k){ out[k] = value[k]; });
        return out;
      }
      return value;
    }
  }

  function formalDraftStore(create, targetGM){
    var gm = targetGM || window.GM;
    if (!gm || typeof gm !== 'object') return null;
    if (!gm._phase8FormalDrafts || typeof gm._phase8FormalDrafts !== 'object' || Array.isArray(gm._phase8FormalDrafts)) {
      if (!create) return null;
      gm._phase8FormalDrafts = {};
    }
    return gm._phase8FormalDrafts;
  }

  function clearFormalDraftRuntimeState(){
    state.edictDraft = [];
    state.edictDrafts = {};
    state.playerAction = '';
    state.letterDraft = {};
    state.letterTarget = '';
    state.letterFilter = 'all';
    state.letterSearch = '';
    state.memorialReplies = {};
  }

  function saveFormalDraftsToGM(captureOpen, targetGM){
    if (state._savingFormalDrafts) return;
    var store = formalDraftStore(true, targetGM);
    if (!store) return;
    state._savingFormalDrafts = true;
    try {
      if (captureOpen && typeof document !== 'undefined' && document.querySelectorAll) {
        Array.prototype.forEach.call(document.querySelectorAll('.tm-desk-overlay'), function(root){
          if (window.TMPhase8FormalBridge && TMPhase8FormalBridge.drafts && TMPhase8FormalBridge.drafts.captureDeskOverlayState) TMPhase8FormalBridge.drafts.captureDeskOverlayState(root);
        });
      }
      store.edictDraft = Array.isArray(state.edictDraft) ? state.edictDraft.slice() : [];
      store.edictDrafts = cloneDraftValue(state.edictDrafts || {});
      store.playerAction = String(state.playerAction || '');
      store.letterDraft = cloneDraftValue(state.letterDraft || {});
      store.letterTarget = String(state.letterTarget || '');
      store.letterFilter = String(state.letterFilter || 'all');
      store.letterSearch = String(state.letterSearch || '');
      store.memorialReplies = cloneDraftValue(state.memorialReplies || {});
      store.turn = (targetGM && targetGM.turn) || (window.GM && GM.turn) || 1;
      store.updatedAt = Date.now();
      store.version = 1;
    } finally {
      state._savingFormalDrafts = false;
    }
  }

  function restoreFormalDraftsFromGM(force){
    var store = formalDraftStore(false);
    if (!store) {
      if (force) clearFormalDraftRuntimeState();
      return;
    }
    if (Array.isArray(store.edictDraft) || force) state.edictDraft = Array.isArray(store.edictDraft) ? store.edictDraft.slice() : [];
    if (store.edictDrafts || force) state.edictDrafts = cloneDraftValue(store.edictDrafts || {});
    if (store.playerAction || force) state.playerAction = String(store.playerAction || '');
    if (store.letterDraft || force) state.letterDraft = cloneDraftValue(store.letterDraft || {});
    if (store.letterTarget || force) state.letterTarget = String(store.letterTarget || '');
    if (store.letterFilter || force) state.letterFilter = String(store.letterFilter || 'all');
    if (store.letterSearch || force) state.letterSearch = String(store.letterSearch || '');
    if (store.memorialReplies || force) state.memorialReplies = cloneDraftValue(store.memorialReplies || {});
  }

  function clearFormalDraftStore(keys){
    var store = formalDraftStore(false);
    if (!store) return;
    keys.forEach(function(k){ delete store[k]; });
    store.updatedAt = Date.now();
  }

  function esc(v){
    return String(v == null ? '' : v).replace(/[&<>"']/g, function(ch){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch];
    });
  }

  function attr(v){
    return esc(v).replace(/`/g, '&#96;');
  }

  function cssEscape(v){
    if (window.CSS && typeof CSS.escape === 'function') return CSS.escape(String(v == null ? '' : v));
    return String(v == null ? '' : v).replace(/["\\]/g, '\\$&');
  }

  function asset(name){
    return ASSET_BASE + name;
  }

  function toast(text){
    if (typeof window.toast === 'function') window.toast(text);
    else console.log('[Phase8 formal]', text);
  }

  function loadPinned(){
    try {
      var raw = localStorage.getItem(STORE_KEY);
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list.filter(Boolean) : [];
    } catch(_) {
      return [];
    }
  }

  function savePinned(){
    state.pinnedPeople = Array.from(new Set((state.pinnedPeople || []).filter(Boolean)));
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state.pinnedPeople)); } catch(_) {}
    updateRailBadges();
    markPinnedCards();
    if (state.activeSlot === 'office') openPanel('office');
  }

  function isStubNode(node){
    return !!(node && node.__sink);
  }

  function isGameVisible(){
    var g = document.getElementById('G');
    if (!g) return false;
    if (typeof getComputedStyle !== 'function') return g.style.display !== 'none';
    return getComputedStyle(g).display !== 'none';
  }

  function setFormalGameActive(active){
    active = !!active;
    if (document.body) {
      document.body.classList.toggle('tm-phase8-game-active', active);
      document.body.classList.toggle('tm-phase8-outgame', !active);
    }
    return active;
  }

  function syncFormalShellVisibility(){
    return setFormalGameActive(isGameVisible());
  }

  // 单一 setter 收敛·JS flag(state.legacyView) 与 body class(tm-phase8-legacy) 成对切换·避免旧手动分置两处的双显 race
  function setLegacyView(v){
    state.legacyView = !!v;
    if (document.body) document.body.classList.toggle('tm-phase8-legacy', !!v);
  }

  function leaveFormalRuntime(){
    setLegacyView(false);
    state.runtimeChromeSig = '';
    state.runtimeRefreshSig = '';
    if (state.runtimeRefreshTimer) {
      clearTimeout(state.runtimeRefreshTimer);
      state.runtimeRefreshTimer = 0;
    }
    try { closeRightDrawer(); } catch(_) {}
    try { closeMapDossier(); } catch(_) {}
    if (document.body) {
      document.body.classList.remove('tm-phase8-game-active', 'tm-phase8-home', 'province-panel-open');
      document.body.classList.add('tm-phase8-outgame');
    }
  }

  function hasRegionMap(map){
    return !!(map && Array.isArray(map.regions) && map.regions.length);
  }

  function mapIdentity(map){
    if (!map) return '';
    var source = map.source || {};
    var meta = map.meta || {};
    return String(map.id || map.mapId || source.id || source.mapId || meta.id || '');
  }

  function activeScenarioId(){
    var gm = window.GM || {};
    var p = window.P || {};
    return String(gm.sid || gm.scenarioId || p.currentScenarioId || p.sid || '');
  }

  function getActiveScenario(){
    var sid = activeScenarioId();
    if (sid && typeof window.findScenarioById === 'function') {
      try {
        var found = window.findScenarioById(sid);
        if (found) return found;
      } catch(_) {}
    }
    var list = window.P && Array.isArray(P.scenarios) ? P.scenarios : [];
    if (sid) {
      for (var i = 0; i < list.length; i += 1) {
        if (list[i] && String(list[i].id || list[i].sid || list[i].key || '') === sid) return list[i];
      }
    }
    return list.length === 1 ? list[0] : null;
  }

  function getScenarioMapData(){
    var sc = getActiveScenario();
    var map = sc && (sc.mapData || sc.map);
    return hasRegionMap(map) ? map : null;
  }

  function personKey(p){
    return String((p && (p.id || p.name || p.charId || p.key)) || '');
  }

  function personNameKey(p){
    return String((p && p.name) || '').replace(/\s+/g, '').trim();
  }

  function getPeople(){
    var seenKey = {};
    var seenName = {};
    var out = [];
    function add(p){
      if (!p) return;
      var k = personKey(p);
      var n = personNameKey(p);
      if ((!k && !n) || (k && seenKey[k]) || (n && seenName[n])) return;
      if (k) seenKey[k] = true;
      if (n) seenName[n] = true;
      out.push(p);
    }
    var gm = window.GM || {};
    if (Array.isArray(gm.chars)) gm.chars.forEach(add);
    // 防串台：只补当前激活剧本的 P.characters（否则官方天启/上一局人物会漏进当前局名册）
    if (window.P && Array.isArray(P.characters)) (typeof _tmActiveScenarioRows==='function'?_tmActiveScenarioRows(P.characters):P.characters).forEach(add);
    if (typeof window.renwuAllChars === 'function') {
      try { (window.renwuAllChars() || []).forEach(add); } catch(_) {}
    }
    if (typeof window.tmCleanPreviewRenwuChars === 'function') {
      try { (window.tmCleanPreviewRenwuChars() || []).forEach(add); } catch(_) {}
    }
    if (Array.isArray(window.RENWU_ATLAS_CHARS)) window.RENWU_ATLAS_CHARS.forEach(add);
    if (Array.isArray(gm.allCharacters)) gm.allCharacters.forEach(add);
    return out;
  }

  function findPerson(idOrName){
    var key = String(idOrName || '');
    return getPeople().find(function(p){ return personKey(p) === key || p.name === key; }) || null;
  }

  function isPinned(idOrName){
    var p = findPerson(idOrName);
    var key = p ? personKey(p) : String(idOrName || '');
    return (state.pinnedPeople || []).indexOf(key) >= 0;
  }

  function pinPerson(idOrName, force){
    var p = findPerson(idOrName);
    var key = p ? personKey(p) : String(idOrName || '');
    if (!key) return;
    var list = state.pinnedPeople || [];
    var idx = list.indexOf(key);
    var next = force;
    if (next == null) next = idx < 0;
    if (next && idx < 0) list.push(key);
    if (!next && idx >= 0) list.splice(idx, 1);
    state.pinnedPeople = list;
    savePinned();
    toast((p && p.name ? p.name : key) + (next ? ' 已钉选到右侧“臣”' : ' 已取消钉选'));
  }

  function extractPersonId(el){
    if (!el) return '';
    if (el.dataset && (el.dataset.personId || el.dataset.renwuId || el.dataset.id || el.dataset.name)) {
      return el.dataset.personId || el.dataset.renwuId || el.dataset.id || el.dataset.name;
    }
    var on = el.getAttribute && (el.getAttribute('onclick') || '');
    var m = on.match(/(?:openCharRenwuPage|viewRenwu|openCharDetail)\(['"]([^'"]+)['"]\)/);
    if (m) return m[1];
    m = on.match(/openRenwuTuzhi\(\{\s*selected\s*:\s*['"]([^'"]+)['"]/);
    if (m) return m[1];
    var nameEl = el.querySelector && (el.querySelector('.rw-name') || el.querySelector('strong') || el.querySelector('b'));
    var raw = nameEl ? (nameEl.textContent || '') : (el.textContent || '');
    raw = raw.replace(/[【（(].*$/,'').replace(/\s+/g,'').trim();
    return raw.slice(0, 12);
  }

  function personCardFromTarget(target){
    if (!target || !target.closest) return null;
    var card = target.closest('.rw-card,.rw-card-v2,.renwu-card,.tm-person-row,.cz-person-card,.cd,[data-renwu-id],[data-person-id],.tm-desk-item[onclick*="openRenwuTuzhi"]');
    if (card) return card;
    var btn = target.closest('button');
    if (!btn) return null;
    var text = btn.textContent || '';
    var p = getPeople().find(function(person){ return person && person.name && text.indexOf(person.name) >= 0; });
    if (!p) return null;
    btn.dataset.personId = personKey(p);
    return btn;
  }

  function markPinnedCards(root){
    root = root || document;
    if (!root || !root.querySelectorAll) return;
    root.querySelectorAll('.rw-card,.rw-card-v2,.renwu-card,.tm-person-row,.cz-person-card,.cd,[data-renwu-id],[data-person-id],.tm-desk-item[onclick*="openRenwuTuzhi"]').forEach(function(card){
      var id = extractPersonId(card);
      if (!id) return;
      var pinned = isPinned(id);
      card.classList.toggle('tm-phase8-person-pinned', pinned);
      card.title = pinned ? '右键取消钉选' : '右键钉选到右侧“臣”';
    });
  }

  function installContextMenu(){
    if (state.contextMenuInstalled) return;
    state.contextMenuInstalled = true;
    function handle(e, fromMouseDown){
      var card = personCardFromTarget(e.target);
      if (!card) return;
      var id = extractPersonId(card);
      if (!id || !findPerson(id)) return;
      e.preventDefault();
      e.stopPropagation();
      var now = Date.now();
      if (!fromMouseDown && state.lastPinGesture && state.lastPinGesture.id === id && now - state.lastPinGesture.time < 700) return;
      state.lastPinGesture = { id: id, time: now };
      pinPerson(id);
    }
    document.addEventListener('mousedown', function(e){
      if (e.button === 2) handle(e, true);
    }, true);
    document.addEventListener('contextmenu', function(e){ handle(e, false); }, true);
  }

  function showHome(){
    setLegacyView(false);
    clearOfficeStandaloneMode();
    document.body.classList.add('tm-phase8-home');
    dismissLegacyIntro();
    closeRightDrawer();
    ensureMainShell();
    renderFormalMapSoon();
  }

  function returnFormalHomeSoon(){
    if (typeof setTimeout !== 'function') return;
    setTimeout(function(){
      if (!document.body || !document.body.classList.contains('tm-phase8-formal')) return;
      if (state.legacyView || !isGameVisible()) return;
      showHome();
    }, 0);
  }

  function runLegacyTabRefresh(tabId){
    setTimeout(function(){
      try {
        if (tabId === 'gt-edict' && typeof window._renderEdictSuggestions === 'function') window._renderEdictSuggestions();
        if (tabId === 'gt-memorial' && typeof window.renderMemorials === 'function') window.renderMemorials();
        if (tabId === 'gt-letter' && typeof window.renderLetterPanel === 'function') window.renderLetterPanel();
        if (tabId === 'gt-office' && typeof window.renderOfficeTree === 'function') window.renderOfficeTree();
        if (tabId === 'gt-biannian' && typeof window.renderBiannian === 'function') window.renderBiannian();
        if (tabId === 'gt-jishi' && typeof window.renderJishi === 'function') window.renderJishi();
        if (tabId === 'gt-qiju' && typeof window.renderQiju === 'function') window.renderQiju();
        if (tabId === 'gt-shiji' && typeof window.renderShijiList === 'function') window.renderShijiList();
      } catch(e) {
        if (window.TM && TM.errors && TM.errors.capture) TM.errors.capture(e, 'phase8-open-legacy-tab');
      }
    }, 30);
  }

  function hasLegacyTabPanel(tabId){
    if (!tabId) return false;
    var panel = document.getElementById(tabId);
    if (!panel) return false;
    if (tabId === 'gt-office') return !!document.getElementById('office-tree');
    return true;
  }

  function ensureLegacyTabPanel(tabId){
    if (hasLegacyTabPanel(tabId)) return true;
    if (typeof window.renderGameState !== 'function') return false;
    try {
      window.renderGameState();
    } catch(e) {
      if (window.TM && TM.errors && TM.errors.capture) TM.errors.capture(e, 'phase8-ensure-legacy-tab');
      return false;
    }
    return hasLegacyTabPanel(tabId);
  }

  function openLegacyTab(tabId){
    if (!tabId) return false;
    closeModule();
    closeRightDrawer();
    if (tabId !== 'gt-office') clearOfficeStandaloneMode();
    dismissLegacyIntro();
    ensureMainShell();
    setLegacyView(true);
    document.body.classList.remove('tm-phase8-home');
    if (!ensureLegacyTabPanel(tabId)) return false;
    if (window.TM && TM.UI && TM.UI.tabs && typeof TM.UI.tabs.switchGameTab === 'function') {
      TM.UI.tabs.switchGameTab(null, tabId);
      runLegacyTabRefresh(tabId);
      return true;
    }
    if (typeof window.switchGTab === 'function') {
      window.switchGTab(null, tabId);
      runLegacyTabRefresh(tabId);
      return true;
    }
    return false;
  }

  function dismissLegacyIntro(){
    var modal = document.getElementById('_situationModal');
    if (modal) modal.remove();
  }

  function jump(tabId){
    if (!tabId) return;
    if (tabId === 'gt-guoku') { openGuoku(); return; }
    if (tabId === 'gt-office') { openOfficeStandalone(); return; }
    if (tabId === 'gt-wenshi' || tabId === 'gt-wenyuan') { openPanel('policy'); return; }
    var legacyTabs = {};
    if (legacyTabs[tabId] && openLegacyTab(tabId)) return;
    var modules = {
      'gt-edict': 'edict',
      'gt-memorial': 'memorial',
      'gt-letter': 'letter',
      'gt-wendui': 'wendui',
      'gt-chaoyi': 'chaoyi',
      'gt-jishi': 'records',
      'gt-shiji': 'records',
      'gt-qiju': 'records',
      'gt-biannian': 'records',
      'gt-keju': 'keju',
      'gt-guoku': 'finance',
      'gt-office': 'office',
      'gt-wenshi': 'wenshi'
    };
    var panels = {
      'gt-map': 'map',
      'gt-fin': 'finance',
      'gt-army': 'army',
      'gt-issue': 'issue',
      'gt-policy': 'policy'
    };
    if (modules[tabId]) openModule(modules[tabId]);
    else if (panels[tabId]) openPanel(panels[tabId]);
    else toast('正式界面暂未接入：' + tabId);
  }

  function openLeft(key){
    if (window.TM && TM.UI && TM.UI.shell && typeof TM.UI.shell.openSideDrawer === 'function') {
      TM.UI.shell.openSideDrawer('left', key);
    } else if (typeof window.openSideDrawer === 'function') {
      window.openSideDrawer('left', key);
    }
  }

  function openGuoku(){
    closeRightDrawer();
    closeModule();
    clearOfficeStandaloneMode();
    if (typeof window.openGuokuPanel === 'function') {
      window.openGuokuPanel();
      toast('已打开帑廪完整账册');
      return;
    }
    openModule('finance');
  }

  function clearOfficeStandaloneMode(){
    document.body.classList.remove('tm-phase8-office-single');
    var back = document.getElementById('tm-office-single-back');
    if (back) back.remove();
  }

  function installOfficeStandaloneStyles(){
    if (document.getElementById('tm-office-standalone-style')) return;
    var st = document.createElement('style');
    st.id = 'tm-office-standalone-style';
    st.textContent = [
      'body.tm-phase8-office-single .gs-breadcrumb,body.tm-phase8-office-single .gs-tab-bar{display:none!important;}',
      'body.tm-phase8-office-single .g-tab-panel{display:none!important;}',
      'body.tm-phase8-office-single #gt-office{display:block!important;position:absolute!important;inset:0!important;overflow-y:auto!important;padding:0!important;background:linear-gradient(180deg,rgba(18,13,9,.98),rgba(7,6,5,.99))!important;}',
      'body.tm-phase8-office-single #gc{position:relative!important;overflow:hidden!important;}',
      'body.tm-phase8-office-single #tm-phase8-action-tray,body.tm-phase8-office-single #shizheng-btn{display:none!important;}',
      'body.tm-phase8-office-single #tm-phase8-event-notice{display:none!important;}',
      'body.tm-phase8-formal.tm-phase8-office-single #tm-phase8-event-notice.tm-event-notice,body.tm-phase8-formal.tm-phase8-office-single #tm-phase8-event-notice.tmv3-feed{display:none!important;}',
      'body.tm-phase8-office-single [id^=zhao-btn]{display:none!important;}',
      '#tm-office-single-back{position:fixed;right:24px;top:96px;z-index:19020;height:32px;padding:0 14px;border:1px solid rgba(201,168,95,.46);border-radius:3px;background:linear-gradient(180deg,rgba(39,30,22,.96),rgba(12,9,7,.96));color:#eadfbd;font:13px/1 "STKaiti","KaiTi","SimSun",serif;letter-spacing:.14em;cursor:pointer;box-shadow:0 8px 22px rgba(0,0,0,.45);}',
      '#tm-office-single-back:hover{border-color:#e0c27a;color:#fff0bd;background:linear-gradient(180deg,rgba(68,46,24,.96),rgba(18,12,8,.98));}'
    ].join('\n');
    document.head.appendChild(st);
  }

  function ensureOfficeStandaloneBack(){
    var back = document.getElementById('tm-office-single-back');
    if (!back) {
      back = document.createElement('button');
      back.id = 'tm-office-single-back';
      back.type = 'button';
      back.textContent = '返回天下';
      back.onclick = showHome;
      document.body.appendChild(back);
    }
    return back;
  }

  function openOfficeStandalone(){
    installOfficeStandaloneStyles();
    var ok = openLegacyTab('gt-office');
    if (!ok) {
      openModule('office');
      return;
    }
    document.body.classList.add('tm-phase8-office-single');
    state.activeSlot = 'archive';
    updateRailActive();
    ensureOfficeStandaloneBack();
    setTimeout(function(){
      try {
        if (typeof window.renderOfficeTree === 'function') window.renderOfficeTree();
      } catch(e) {
        if (window.TM && TM.errors && TM.errors.capture) TM.errors.capture(e, 'phase8-office-standalone');
      }
    }, 60);
  }

  function openKeju(){
    openModule('keju');
  }

  function openChaoyiMode(mode){
    openModule('chaoyi', { mode: mode || 'tingyi' });
  }

  function getTurnText(turn){
    try {
      if (typeof window.getTSText === 'function') return window.getTSText(turn);
    } catch(_) {}
    return '第 ' + (turn || 1) + ' 回合';
  }

  // ====== v3.3 邸抄·event feed helpers ======
  function _eventTypeInfo(type) {
    var t = String(type || '');
    if (/朝议|廷议|朝政|奏疏|内阁|台谏/.test(t)) return ['t-chao', '议'];
    if (/军务|军|宣府|边关|战|总兵/.test(t)) return ['t-army', '军'];
    if (/势力|外族|外|蒙|鞑|瓦剌|羌|金/.test(t)) return ['t-faction', '势'];
    if (/财|户|赋|盐课|岁入|漕|银/.test(t)) return ['t-finance', '财'];
    if (/人物|科举|官|文苑|经历|承诺|动向|宦|侍郎|尚书|学士/.test(t)) return ['t-people', '人'];
    if (/邸报|近事|事件|纪事|消息|新闻/.test(t)) return ['t-news', '报'];
    if (/线索|御案|谜|疑/.test(t)) return ['t-clue', '索'];
    return ['t-misc', '杂'];
  }
  function _seasonChar(turn, timeStr) {
    var s = String(timeStr || '');
    var monthMatch = s.match(/[一二三四五六七八九十]+月/);
    if (monthMatch) {
      var map = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10, 十一: 11, 十二: 12 };
      var month = map[monthMatch[0].replace('月', '')] || 0;
      if (month >= 1 && month <= 3) return '春';
      if (month >= 4 && month <= 6) return '夏';
      if (month >= 7 && month <= 9) return '秋';
      if (month >= 10) return '冬';
    }
    var seasons = ['春', '夏', '秋', '冬'];
    return seasons[((Number(turn) || 1) - 1) % 4] || '春';
  }
  function _isItemAlert(item) {
    var sev = String((item && (item.severity || item.level)) || '').toLowerCase();
    return /alert|crit|急|critical|emergency/.test(sev);
  }
  function _isItemHot(item) {
    var sev = String((item && (item.severity || item.level)) || '').toLowerCase();
    if (/hot|warn|warning/.test(sev)) return true;
    var t = String(item && item.type || '');
    return /军务|战|急/.test(t) || _isItemAlert(item);
  }

  function collectRecentEvents(lookback){
    var gm = window.GM || {};
    var turn = Number(gm.turn || 1);
    var scope = Number(lookback == null ? (state.eventLookback || 3) : lookback);
    if (!isFinite(scope) || scope <= 0) scope = 3;
    var minTurn = Math.max(1, turn - scope + 1);
    var rows = [];
    var seen = {};
    var seq = 0;
    function eventTurn(item, fallback){
      var t = Number(item && (item.turn || item.t || item.raisedTurn || item.resolvedTurn || item.yearTurn));
      return isFinite(t) && t > 0 ? t : (fallback || turn);
    }
    function pushRow(row){
      row._seq = seq++;
      var key = [
        row.turn || '',
        row.type || '',
        row.title || '',
        compactText(row.text || row.detail || '', 90)
      ].join('|');
      if (seen[key]) return;
      seen[key] = true;
      rows.push(row);
    }
    function add(item, type, opts){
      if (!item) return;
      opts = opts || {};
      var t = eventTurn(item, opts.turn || turn);
      if (scope < 999 && t < minTurn) return;
      pushRow({
        turn: t,
        type: opts.type || type || item.type || item.kind || '近事',
        title: opts.title || item.title || item.name || item.topic || item.head || item.kind || '未题',
        text: opts.text || item.text || item.desc || item.description || item.content || item.summary || item.body || item.narrative || '',
        time: opts.time || item.time || item.date || item.raisedDate || item.resolvedDate || getTurnText(t),
        detail: opts.detail || item.detail || item.impact || item.note || item.result || item.narrative || item.description || item.content || item.summary || item.body || '',
        meta: (opts.meta || [item.category, item.status, item.severity || item.level, item.affectedRegion || item.region, item.source, item.actor, item.target]).filter(Boolean)
      });
    }
    [
      ['evtLog','事件'],
      ['eventLog','事件'],
      ['events','近事'],
      ['recentEvents','近事'],
      ['news','近事'],
      ['recentNews','近事'],
      ['history','近事'],
      ['annals','近事']
    ].forEach(function(pair){
      var k = pair[0];
      if (Array.isArray(gm[k])) gm[k].forEach(function(x){ add(x, pair[1]); });
    });
    if (window.EB && Array.isArray(EB.items)) EB.items.forEach(function(x){ add(x, '邸报'); });
    if (Array.isArray(gm.currentIssues)) gm.currentIssues.slice(0, 8).forEach(function(x){
      var issueEvent = Object.assign({}, x);
      if (!issueEvent.turn && !issueEvent.t && !issueEvent.raisedTurn && !issueEvent.resolvedTurn) issueEvent.turn = turn;
      add(issueEvent, '御案线索');
    });
    if (Array.isArray(gm.factionEvents)) gm.factionEvents.forEach(function(x){
      add(x, '势力动态', {
        title: x.title || x.actor || x.faction || '势力动态',
        text: [x.actor, x.target ? '→' + x.target : '', x.action || x.text || x.desc || '', x.result ? '→' + x.result : ''].filter(Boolean).join(' '),
        detail: x.detail || x.result || x.reason || x.action || '',
        meta: [x.actor, x.target, x.action].filter(Boolean)
      });
    });
    if (Array.isArray(gm._turnReport)) gm._turnReport.forEach(function(x){
      var name = x.char || x.charName || x.entity || x.armyName || x.name || x.region || x.subject || '';
      var title = name ? (name + ' · ' + (x.event || x.action || x.type || '回合变化')) : (x.title || x.type || '回合变化');
      var text = x.text || x.reason || x.evidence || x.event || x.result || x.status || x.action || '';
      if (x.type === 'travel') text = (x.char || '人物') + '自' + (x.from || '原地') + '赴' + (x.to || '他处') + (x.days ? '，预计' + x.days + '日' : '') + (x.reason ? '：' + x.reason : '');
      add(x, /travel|career|appointment|relation|personnel/i.test(String(x.type || '')) ? '人物动向' : '回合变更', {
        title: title,
        text: text,
        detail: x.detail || x.note || text,
        meta: [x.type, x.source, x.field].filter(Boolean)
      });
    });
    if (gm.characterArcs && typeof gm.characterArcs === 'object') {
      Object.keys(gm.characterArcs).forEach(function(name){
        var arcs = Array.isArray(gm.characterArcs[name]) ? gm.characterArcs[name] : [];
        arcs.forEach(function(a){
          add(a, '人物经历', {
            title: name + ' · ' + (a.title || a.type || '近事'),
            text: a.desc || a.text || a.description || '',
            meta: [name, a.type].filter(Boolean)
          });
        });
      });
    }
    if (gm._npcCommitments && typeof gm._npcCommitments === 'object') {
      Object.keys(gm._npcCommitments).forEach(function(_nm){
        (gm._npcCommitments[_nm] || []).forEach(function(c){
          if (!c || !c.task) return;
          var _stLabel = ({pending:'待办',executing:'执行中',completed:'已履',failed:'失诺',delayed:'延宕'})[c.status] || c.status || '待办';
          add({ turn: c.assignedTurn || turn }, '人物承诺', {
            title: _nm + '之诺',
            text: c.task + (c.npcPromise ? '——“' + c.npcPromise + '”' : ''),
            meta: [_nm, _stLabel].filter(Boolean)
          });
        });
      });
    }
    if (gm._npcCognition && typeof gm._npcCognition === 'object') {
      Object.keys(gm._npcCognition).slice(0, 24).forEach(function(name){
        var cog = gm._npcCognition[name] || {};
        var focus = cog.currentFocus || cog.unspokenConcern || cog.worldviewShift || '';
        if (!focus) return;
        add({ turn: cog.turn || cog.updatedTurn || turn }, '人物心绪', {
          title: name + '近况',
          text: focus,
          detail: [cog.attitudeTowardsPlayer, cog.recentMood].filter(Boolean).join('；') || focus,
          meta: [name, cog.recentMood].filter(Boolean)
        });
      });
    }
    rows.sort(function(a,b){
      var dt = (b.turn || 0) - (a.turn || 0);
      return dt || ((b._seq || 0) - (a._seq || 0));
    });
    return rows.slice(0, 120);
  }

  function eventScopeLabel(){
    var n = Number(state.eventLookback || 3);
    if (n >= 999) return '全部事件';
    if (n >= 6) return '最近六回合';
    return '最近三回合';
  }

  function closeEventTurnMenu(){
    var menu = document.getElementById('tm-event-turn-menu');
    var btn = document.getElementById('tm-event-turn-button');
    if (menu) menu.classList.remove('show');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }

  function renderEventTurnMenu(){
    var menu = document.getElementById('tm-event-turn-menu');
    var label = document.getElementById('tm-event-scope-label');
    if (label) label.textContent = eventScopeLabel();
    if (!menu) return;
    var current = Number(state.eventLookback || 3);
    var scopes = [
      [3, '最近三回合'],
      [6, '最近六回合'],
      [999, '全部事件']
    ];
    menu.innerHTML = scopes.map(function(scope){
      var on = current === scope[0] || (current >= 999 && scope[0] >= 999);
      var count = collectRecentEvents(scope[0]).length;
      return '<button type="button" class="tm-event-turn-choice ' + (on ? 'active' : '') + '" data-event-lookback="' + esc(scope[0]) + '">' +
        '<span>' + esc(scope[1]) + '</span><i>' + esc(count) + '</i>' +
        '</button>';
    }).join('');
  }

  function renderEventFeed(){
    var host = document.getElementById('tm-event-list') || document.getElementById('tm-phase8-event-list');
    if (!host) return;
    var list = collectRecentEvents();
    state.eventCache = list;

    // v3.3 filter
    var filter = state.eventFilter || 'all';
    var filteredList = list;
    if (filter !== 'all' && filter !== 'more') {
      filteredList = list.filter(function(item){
        return _eventTypeInfo(item.type)[0] === ('t-' + filter);
      });
    }

    var count = document.getElementById('tm-event-count');
    if (count) count.textContent = String(list.length);
    renderEventTurnMenu();

    if (!filteredList.length) {
      host.innerHTML = '<div class="tmv3-empty">' + (filter === 'all' ? '暂无近事。新事件会自动归入此处。' : '此类暂无近事。') + '</div>';
      return;
    }

    var currentTurn = Number((window.GM && GM.turn) || 1);
    var html = '';
    var lastTurn = null; var newFlashCount = 0;
    filteredList.forEach(function(item, idx){
      var typeInfo = _eventTypeInfo(item.type);
      var typeClass = typeInfo[0];
      var typeChar = typeInfo[1];
      var turn = Number(item.turn || currentTurn);
      var seasonChar = _seasonChar(turn, item.time);

      if (turn !== lastTurn) {
        lastTurn = turn;
        html += '<div class="tmv3-turnhead"><b>T ' + esc(turn) + '</b> <small>' + esc(seasonChar) + '</small></div>';
      }

      var text = String(item.text || '').replace(/\s+/g, ' ').trim();
      var detail = String(item.detail || '').replace(/\s+/g, ' ').trim();
      var meta = Array.isArray(item.meta) ? item.meta.filter(Boolean).slice(0, 4) : [];

      var classes = ['tmv3-item', typeClass];
      if (_isItemAlert(item)) classes.push('is-alert');
      if (_isItemHot(item)) classes.push('is-hot');
      if (turn >= currentTurn) {
        classes.push('is-new');
        if (newFlashCount < 4) { classes.push('is-flash'); newFlashCount++; }
      }
      else if (turn < currentTurn - 1) classes.push('is-read');
      if (state.eventExpandedIdx === idx) classes.push('expanded');

      html += '<div class="' + classes.join(' ') + '" data-event-idx="' + idx + '">' +
        '<span class="tmv3-ttype">' + esc(typeChar) + '</span>' +
        '<div class="tmv3-main">' +
          '<div class="tmv3-headrow">' +
            '<span class="tmv3-title">' + esc(item.title || '未题') + '</span>' +
            '<span class="tmv3-turn">T ' + esc(turn) + '·' + esc(seasonChar) + '</span>' +
          '</div>' +
          (text ? '<span class="tmv3-text">' + esc(text) + '</span>' : '') +
          (detail && detail !== text ? '<span class="tmv3-text tmv3-text-detail">' + esc(detail) + '</span>' : '') +
          '<div class="tmv3-foot">' +
            '<div class="tmv3-meta">' + meta.map(function(m){ return '<span>' + esc(m) + '</span>'; }).join('') + '</div>' +
            '<a class="tmv3-open" data-event-idx="' + idx + '" tabindex="0">进入详情 <em>↗</em></a>' +
          '</div>' +
        '</div>' +
        '<div class="tmv3-mark"></div>' +
        '</div>';
    });
    host.innerHTML = html;
  }

  function toggleEventRow(idx, row){
    var host = document.getElementById('tm-event-list') || document.getElementById('tm-phase8-event-list');
    var beforeScroll = host ? host.scrollTop : 0;
    var beforeTop = row && row.getBoundingClientRect ? row.getBoundingClientRect().top : null;
    state.eventExpandedIdx = state.eventExpandedIdx === idx ? null : idx;
    renderEventFeed();
    var nextHost = document.getElementById('tm-event-list') || document.getElementById('tm-phase8-event-list');
    if (!nextHost) return;
    nextHost.scrollTop = beforeScroll;
    if (beforeTop != null) {
      var nextRow = nextHost.querySelector('[data-event-idx="' + attr(idx) + '"]');
      if (nextRow && nextRow.getBoundingClientRect) {
        nextHost.scrollTop += nextRow.getBoundingClientRect().top - beforeTop;
      }
    }
  }

  function openEventDetail(idx){
    var item = state.eventCache && state.eventCache[idx];
    if (!item) return;
    var old = document.getElementById('tm-phase8-event-detail');
    if (old) old.remove();
    var ov = document.createElement('div');
    ov.id = 'tm-phase8-event-detail';
    ov.className = 'tmf-event-detail';
    ov.innerHTML = '<section class="tmf-event-dialog" role="dialog" aria-label="近事详情">' +
      '<header><div><span>' + esc(item.type) + ' · T' + esc(item.turn) + '</span><h3>' + esc(item.title || '近事') + '</h3><p>' + esc(item.time || getTurnText(item.turn)) + '</p></div><button type="button" data-close="1">×</button></header>' +
      '<main>' + esc(item.text || '暂无详情。') + '</main>' +
      '<footer><button type="button" data-close="1">收起</button></footer>' +
      '</section>';
    ov.addEventListener('click', function(e){
      if (e.target === ov || (e.target && e.target.dataset && e.target.dataset.close)) ov.remove();
    });
    document.body.appendChild(ov);
  }

  function ensurePreviewPanelHost(){
    if (!syncFormalShellVisibility()) return null;
    var panel = document.getElementById('rpanel');
    if (!panel) {
      panel = document.createElement('aside');
      panel.id = 'rpanel';
      panel.innerHTML =
        '<div class="rp-head"><span class="rp-title" id="rp-title">国事</span><button type="button" class="rp-close" aria-label="关闭">×</button></div>' +
        '<div class="rp-body" id="tm-phase8-formal-panel"><div class="rp-mark">纲</div><div class="rp-section"><div class="rp-section-title">国事总览</div><div class="rp-row warn"><div class="rp-row-title"><span>点击右侧印钮</span><span class="rp-row-badge">启</span></div><div class="rp-row-meta">展开御案、国策、百官、军务与风闻摘要</div></div></div></div>';
      document.body.appendChild(panel);
    }
    var close = panel.querySelector('.rp-close');
    if (close && !close.__phase8CloseBound) {
      close.__phase8CloseBound = true;
      close.onclick = function(ev){
        if (ev) ev.preventDefault();
        closeRightDrawer();
      };
    }
    return panel;
  }

  function openShizhengLegacyFlow(){
    var dr = (window.TMPhase8FormalBridge || {}).drafts;
    if (dr && typeof dr.closeDeskOverlay === 'function') dr.closeDeskOverlay();
    closeModule();
    if (typeof window.openShizhengTasks === 'function') {
      window.openShizhengTasks();
      return;
    }
    openShizhengPreviewPanel();
  }

  function ensurePreviewBottomEntries(){
    var shizheng = document.getElementById('shizheng-btn');
    if (!shizheng) {
      shizheng = document.createElement('div');
      shizheng.id = 'shizheng-btn';
      shizheng.title = '御案时政·朝政中心';
      shizheng.innerHTML = '<span class="sz-title">御案时政</span><span class="sz-sub">朝政中枢</span>';
      document.body.appendChild(shizheng);
    }
    if (!shizheng.querySelector || !shizheng.querySelector('.sz-title')) {
      shizheng.innerHTML = '<span class="sz-title">御案时政</span><span class="sz-sub">朝政中枢</span>';
    }
    shizheng.__phase8FormalRedirect = true;
    shizheng.onclick = function(ev){
      if (ev) {
        ev.preventDefault();
        ev.stopPropagation();
      }
      openShizhengLegacyFlow();
      return false;
    };

    var endturn = document.getElementById('endturn');
    if (!endturn) {
      endturn = document.createElement('div');
      endturn.id = 'endturn';
      endturn.innerHTML = '<button type="button" class="et-big">诏　付　有　司<span class="sub">联志已决　付之有司</span></button>';
      document.body.appendChild(endturn);
    }
    var btn = endturn.querySelector('.et-big');
    if (btn && !btn.__phase8EndturnBound) {
      btn.__phase8EndturnBound = true;
      btn.onclick = function(ev){
        if (ev) {
          ev.preventDefault();
          ev.stopPropagation();
        }
        if (window.TM && window.TM.Endturn && window.TM.Endturn.run && typeof window.TM.Endturn.run.confirmEndTurn === 'function') {
          window.TM.Endturn.run.confirmEndTurn();
          return false;
        }
        var old = document.querySelector('.gs-turn-big');
        if (old && typeof old.click === 'function') old.click();
        return false;
      };
    }
  }

  // TM_RETENTION_GUARD: phase8-topbar-fallback-api.
  // Kept so the formal shell still has a minimal topbar API if
  // phase8-formal-topbar.js is missing, late, or partially loaded.
  var fallbackTopbarApi = null;

  function fallbackActionTraySpecs(){
    return [
      ['zhao-btn','edict','action-edict-card.png','Edict','Desk','Draft command','Draft command'],
      ['zhao-btn-2','memorial','action-memorial-card.png','Memorials','Cabinet','Review reports','Review reports'],
      ['zhao-btn-3','letter','action-letter-card.png','Letters','Relay','Manage letters','Manage letters'],
      ['zhao-btn-4','records','action-annals-card.png','Records','Archive','Turn archive','Turn archive']
    ];
  }

  function renderFallbackActionTrayHtml(){
    return fallbackActionTraySpecs().map(function(x){
      return '<button type="button" id="' + esc(x[0]) + '" class="zb-btn zb-img-btn" data-tmf-action="' + esc(x[1]) + '" title="' + esc(x[6]) + '" aria-label="' + esc(x[3]) + '">' +
        '<img class="zb-img" src="' + esc(asset(x[2])) + '" alt="">' +
        '<span class="zb-action-copy"><span class="zb-action-kicker">' + esc(x[4]) + '</span><span class="zb-action-title">' + esc(x[3]) + '</span><span class="zb-action-sub">' + esc(x[5]) + '</span></span>' +
        '</button>';
    }).join('');
  }

  function renderFallbackPreviewTopbarVars(){
    var cards = [
      ['guoku', 'Treasury', '--'],
      ['neitang', 'Inner', '--'],
      ['hukou', 'Households', '--'],
      ['lizhi', 'Order', '--'],
      ['minxin', 'People', '--'],
      ['huangquan', 'Mandate', '--'],
      ['huangwei', 'Majesty', '--']
    ];
    return cards.map(function(v, idx){
      return '<div class="tb-var" data-key="' + esc(v[0]) + '" data-tip-idx="' + idx + '"><span class="icn"></span><div class="tb-vbody"><div class="tb-vn">' + esc(v[1]) + '</div><div class="tb-vv">' + esc(v[2]) + '</div></div></div>';
    }).join('');
  }

  function renderFallbackTimePopoverHtml(){
    return '<div class="tp-title">Time</div><div class="tp-row"><span class="tp-k">Turn</span><span class="tp-v">' + esc((window.GM && GM.turn) || 1) + '</span></div>';
  }

  function renderFallbackWeatherPopoverHtml(){
    return '<div class="wp-head"><span></span><b>Weather</b></div><div class="tp-row"><span class="tp-k">State</span><span class="tp-v">Pending</span></div>';
  }

  function topbarApi(){
    if (!fallbackTopbarApi) {
      fallbackTopbarApi = {
        renderPreviewTopbarVars: renderFallbackPreviewTopbarVars,
        renderTimePopoverHtml: renderFallbackTimePopoverHtml,
        renderWeatherPopoverHtml: renderFallbackWeatherPopoverHtml,
        actionTraySpecs: fallbackActionTraySpecs,
        renderActionTrayHtml: renderFallbackActionTrayHtml
      };
    }
    var bridge = window.TMPhase8FormalBridge;
    var api = bridge && bridge.topbar ? bridge.topbar : fallbackTopbarApi;
    Object.keys(fallbackTopbarApi).forEach(function(k){
      if (typeof api[k] !== 'function') api[k] = fallbackTopbarApi[k];
    });
    if (bridge) bridge.topbar = api;
    return api;
  }

  // dead V0 actionTraySpecs 已删·see Wave 2 (winner moved to topbar.js)

  function ensureFormalChrome(){
    if (!syncFormalShellVisibility()) return;
    var g = document.getElementById('G');
    if (!g) return;
    ensurePreviewTopbar();
    ensurePreviewPanelHost();
    ensurePreviewBottomEntries();
    var notice = document.getElementById('tm-phase8-event-notice');
    var v33Html =
      '<div class="tmv3-head">' +
        '<span class="tmv3-tt">邸报</span>' +
        '<span class="tmv3-cnt"><b id="tm-event-count">0</b>条</span>' +
        '<span class="tmv3-acts">' +
          '<span class="tmv3-filters">' +
            '<button type="button" class="tmv3-fchip on" data-event-filter="all">全</button>' +
            '<button type="button" class="tmv3-fchip" data-event-filter="chao">朝</button>' +
            '<button type="button" class="tmv3-fchip" data-event-filter="army">军</button>' +
            '<button type="button" class="tmv3-fchip" data-event-filter="news">报</button>' +
            '<button type="button" class="tmv3-fchip" data-event-filter="more">⋯</button>' +
          '</span>' +
          '<span class="tmv3-density">' +
            '<button type="button" class="tmv3-dbtn on" data-event-density="compact">紧</button>' +
            '<button type="button" class="tmv3-dbtn" data-event-density="comfortable">宽</button>' +
          '</span>' +
          '<button type="button" class="tmv3-collapse" aria-label="收起/展开"><span class="tmv3-collapse-icon"></span></button>' +
        '</span>' +
      '</div>' +
      '<div class="tmv3-list" id="tm-event-list" tabindex="0" aria-label="近事列表"></div>';
    if (!notice) {
      notice = document.createElement('section');
      notice.id = 'tm-phase8-event-notice';
      notice.className = 'tmv3-feed';
      notice.setAttribute('aria-label', '朝野近事');
      notice.innerHTML = v33Html;
      g.appendChild(notice);
    }
    // v3.3 升级·若是老结构 (有 tm-event-turn-button / tm-event-board-head)·重建为 tmv3
    if (notice && (!notice.querySelector('.tmv3-head') || notice.querySelector('.tm-event-board-head'))) {
      notice.className = 'tmv3-feed';
      notice.innerHTML = v33Html;
    }
    // 应用持久化 state
    if (state.eventCollapsed) notice.classList.add('collapsed');
    else notice.classList.remove('collapsed');
    notice.classList.toggle('density-comfortable', state.eventDensity === 'comfortable');
    var activeFilter = state.eventFilter || 'all';
    notice.querySelectorAll('.tmv3-fchip').forEach(function(b){
      b.classList.toggle('on', b.dataset.eventFilter === activeFilter);
    });
    var activeDensity = state.eventDensity || 'compact';
    notice.querySelectorAll('.tmv3-dbtn').forEach(function(b){
      b.classList.toggle('on', b.dataset.eventDensity === activeDensity);
    });
    var tray = document.getElementById('tm-phase8-action-tray');
    if (!tray) {
      tray = document.createElement('div');
      tray.id = 'tm-phase8-action-tray';
      tray.className = 'zb-action-tray';
      tray.setAttribute('aria-label', '御案行动');
      document.body.appendChild(tray);
    }
    if (tray.parentNode !== document.body) {
      document.body.appendChild(tray);
    }
    tray.setAttribute('aria-label', '御案行动');
    var trayHtml = topbarApi().renderActionTrayHtml();
    if (tray.__phase8TrayHtml !== trayHtml) {
      tray.innerHTML = trayHtml;
      tray.__phase8TrayHtml = trayHtml;
    }
    if (!tray.__phase8ActionBound) {
      tray.__phase8ActionBound = true;
      tray.addEventListener('click', function(e){
        var action = e.target && e.target.closest ? e.target.closest('[data-tmf-action]') : null;
        if (!action) return;
        openAction(action.dataset.tmfAction);
      });
    }
    if (!state.chromeBound) {
      state.chromeBound = true;
      g.addEventListener('click', function(e){
        var action = e.target && e.target.closest ? e.target.closest('[data-tmf-action]') : null;
        if (!action) return;
        openAction(action.dataset.tmfAction);
      });
      g.addEventListener('change', function(e){
        if (e.target && e.target.id === 'tm-phase8-event-range') {
          state.eventLookback = Number(e.target.value || 3);
          renderEventFeed();
        }
      });
      g.addEventListener('click', function(e){
        // v3.3 邸抄 handlers
        var openLink = e.target && e.target.closest ? e.target.closest('.tmv3-open') : null;
        if (openLink) {
          e.preventDefault();
          e.stopPropagation();
          openEventDetail(Number(openLink.dataset.eventIdx));
          return;
        }
        var fchip = e.target && e.target.closest ? e.target.closest('.tmv3-fchip') : null;
        if (fchip) {
          e.preventDefault();
          e.stopPropagation();
          var f = fchip.dataset.eventFilter || 'all';
          if (f === 'more') {
            var pool = ['all', 'chao', 'army', 'news', 'faction', 'finance', 'people', 'clue', 'misc'];
            var cur = pool.indexOf(state.eventFilter || 'all');
            f = pool[(cur + 1) % pool.length];
          }
          state.eventFilter = f;
          state.eventExpandedIdx = null;
          var feedF = fchip.closest('.tmv3-feed');
          if (feedF) feedF.querySelectorAll('.tmv3-fchip').forEach(function(b){
            b.classList.toggle('on', b.dataset.eventFilter === f);
          });
          renderEventFeed();
          return;
        }
        var dbtn = e.target && e.target.closest ? e.target.closest('.tmv3-dbtn') : null;
        if (dbtn) {
          e.preventDefault();
          e.stopPropagation();
          var d = dbtn.dataset.eventDensity || 'compact';
          state.eventDensity = d;
          var feedD = dbtn.closest('.tmv3-feed');
          if (feedD) {
            feedD.classList.toggle('density-comfortable', d === 'comfortable');
            feedD.querySelectorAll('.tmv3-dbtn').forEach(function(b){
              b.classList.toggle('on', b.dataset.eventDensity === d);
            });
          }
          return;
        }
        var cbtn = e.target && e.target.closest ? e.target.closest('.tmv3-collapse') : null;
        if (cbtn) {
          e.preventDefault();
          e.stopPropagation();
          var feedC = cbtn.closest('.tmv3-feed');
          if (feedC) {
            feedC.classList.toggle('collapsed');
            state.eventCollapsed = feedC.classList.contains('collapsed');
          }
          return;
        }
        var tmv3Item = e.target && e.target.closest ? e.target.closest('.tmv3-item') : null;
        if (tmv3Item) {
          if (tmv3Item.classList.contains('expanded')) {
            var t = e.target;
            if (t.closest('.tmv3-text') || t.closest('.tmv3-meta') || t.closest('.tmv3-turn')) return;
          }
          e.preventDefault();
          var idx = Number(tmv3Item.dataset.eventIdx);
          toggleEventRow(idx, tmv3Item);
          return;
        }

        // legacy fallback (old turn dropdown·若残留)
        var turnBtn = e.target && e.target.closest ? e.target.closest('#tm-event-turn-button') : null;
        if (turnBtn) {
          e.preventDefault();
          e.stopPropagation();
          renderEventTurnMenu();
          var menu = document.getElementById('tm-event-turn-menu');
          var open = menu && !menu.classList.contains('show');
          if (menu) menu.classList.toggle('show', !!open);
          turnBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
          return;
        }
        var scope = e.target && e.target.closest ? e.target.closest('[data-event-lookback]') : null;
        if (scope) {
          e.preventDefault();
          e.stopPropagation();
          state.eventLookback = Number(scope.dataset.eventLookback || 3);
          state.eventExpandedIdx = null;
          closeEventTurnMenu();
          renderEventFeed();
          return;
        }
      });
      document.addEventListener('click', function(e){
        var inside = e.target && e.target.closest ? e.target.closest('#tm-phase8-event-notice') : null;
        if (!inside) closeEventTurnMenu();
      });
    }
    var sel = document.getElementById('tm-phase8-event-range');
    if (sel && !isStubNode(sel)) sel.value = String(state.eventLookback || 3);
    renderEventFeed();
  }

  function textById(id, fallback){
    var el = document.getElementById(id);
    var text = el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '';
    return text || fallback || '';
  }

  // formatRendererDelta + readRendererVarCards + readOldVarCards 已迁出·见 phase8-formal-topbar.js (Wave 2)

  // iconForVar + stockKey 已迁出·见 phase8-formal-topbar.js (Wave 2)

  // iconClassFor 已迁出·见 phase8-formal-topbar.js (Wave 2)

  function ensureTopbarPopover(id, className){
    var pop = document.getElementById(id);
    if (!pop) {
      pop = document.createElement('div');
      pop.id = id;
      pop.className = className || 'tmf-topbar-pop';
      document.body.appendChild(pop);
    }
    return pop;
  }

  // renderTimePopoverHtml + renderWeatherPopoverHtml \u5df2\u8fc1\u51fa\u00b7\u89c1 phase8-formal-topbar.js (Wave 2\u00b72026-05-26)

  function showTopbarTimePop(){
    var pop = ensureTopbarPopover('tmf-timepop', 'tmf-topbar-pop tmf-timepop');
    pop.innerHTML = topbarApi().renderTimePopoverHtml();
    pop.classList.add('show');
    // 时历移到左身份簇后·悬停框贴着时间元素弹出(非固定屏幕最右)
    try {
      var t = document.querySelector('#topbar .tb-time');
      if (t) {
        var r = t.getBoundingClientRect();
        pop.style.setProperty('position', 'fixed', 'important');
        pop.style.setProperty('left', Math.round(r.left) + 'px', 'important');
        pop.style.setProperty('right', 'auto', 'important');
        pop.style.setProperty('top', Math.round(r.bottom + 8) + 'px', 'important');
      }
    } catch(_tp) {}
  }

  function scheduleTopbarTimeHide(){
    if (state.topbarTimePinned) return;
    clearTimeout(state.topbarTimeTimer);
    state.topbarTimeTimer = setTimeout(function(){
      var pop = document.getElementById('tmf-timepop');
      if (pop) pop.classList.remove('show');
    }, 180);
  }

  function showTopbarWeatherPop(){
    var pop = ensureTopbarPopover('tmf-weatherpop', 'tmf-topbar-pop tmf-weatherpop');
    pop.innerHTML = topbarApi().renderWeatherPopoverHtml();
    pop.classList.add('show');
  }

  function scheduleTopbarWeatherHide(){
    if (state.topbarWeatherPinned) return;
    clearTimeout(state.topbarWeatherTimer);
    state.topbarWeatherTimer = setTimeout(function(){
      var pop = document.getElementById('tmf-weatherpop');
      if (pop) pop.classList.remove('show');
    }, 180);
  }

  function clearTopbarVarPin(){
    state.topbarVarPinnedKey = '';
    document.querySelectorAll('body.tm-phase8-formal .tb-var.pinned').forEach(function(el){ el.classList.remove('pinned'); });
    if (typeof window._hideBarVarTip === 'function') window._hideBarVarTip();
  }

  function showTopbarVarTip(e, item){
    if (!item || typeof window._showBarVarTip !== 'function') return;
    var idx = Number(item.getAttribute('data-tip-idx'));
    if (Number.isFinite(idx)) window._showBarVarTip(e, idx);
  }

  function bindTopbarAuxInteractions(top){
    if (!top || top.__phase8AuxBound) return;
    top.__phase8AuxBound = true;

    var time = top.querySelector('.tb-time');
    if (time) {
      var timePop = ensureTopbarPopover('tmf-timepop', 'tmf-topbar-pop tmf-timepop');
      time.addEventListener('mouseenter', showTopbarTimePop);
      time.addEventListener('mouseleave', scheduleTopbarTimeHide);
      time.addEventListener('click', function(e){
        e.stopPropagation();
        state.topbarTimePinned = !state.topbarTimePinned;
        time.classList.toggle('pinned', !!state.topbarTimePinned);
        timePop.classList.toggle('pinned', !!state.topbarTimePinned);
        if (state.topbarTimePinned) showTopbarTimePop();
        else scheduleTopbarTimeHide();
      });
      timePop.addEventListener('mouseenter', showTopbarTimePop);
      timePop.addEventListener('mouseleave', scheduleTopbarTimeHide);
    }

    var weather = top.querySelector('.tb-weather');
    if (weather) {
      var weatherPop = ensureTopbarPopover('tmf-weatherpop', 'tmf-topbar-pop tmf-weatherpop');
      weather.addEventListener('mouseenter', showTopbarWeatherPop);
      weather.addEventListener('mouseleave', scheduleTopbarWeatherHide);
      weather.addEventListener('click', function(e){
        e.stopPropagation();
        state.topbarWeatherPinned = !state.topbarWeatherPinned;
        weather.classList.toggle('pinned', !!state.topbarWeatherPinned);
        weatherPop.classList.toggle('pinned', !!state.topbarWeatherPinned);
        if (state.topbarWeatherPinned) showTopbarWeatherPop();
        else scheduleTopbarWeatherHide();
      });
      weatherPop.addEventListener('mouseenter', showTopbarWeatherPop);
      weatherPop.addEventListener('mouseleave', scheduleTopbarWeatherHide);
    }

    document.addEventListener('click', function(e){
      if (state.topbarTimePinned && time && !time.contains(e.target)) {
        var tp = document.getElementById('tmf-timepop');
        if (!tp || !tp.contains(e.target)) {
          state.topbarTimePinned = false;
          time.classList.remove('pinned');
          if (tp) tp.classList.remove('pinned', 'show');
        }
      }
      if (state.topbarWeatherPinned && weather && !weather.contains(e.target)) {
        var wp = document.getElementById('tmf-weatherpop');
        if (!wp || !wp.contains(e.target)) {
          state.topbarWeatherPinned = false;
          weather.classList.remove('pinned');
          if (wp) wp.classList.remove('pinned', 'show');
        }
      }
      var vars = document.getElementById('tmf-tb-vars');
      if (state.topbarVarPinnedKey && vars && !vars.contains(e.target)) clearTopbarVarPin();
    });
  }

  // 2026-06·顶栏纯 CSS 玄金重设计·override 旧图片底版(#topbar 提权+!important·旧 .tb-* 图片规则失活)
  var TOPBAR_REDESIGN_CSS = [
    'body.tm-phase8-formal #topbar{height:66px!important;display:flex!important;align-items:center!important;justify-content:flex-start!important;gap:10px!important;padding:0 14px!important;background:none!important;border:0!important;box-shadow:none!important;pointer-events:none!important;z-index:300!important;}',
    'body.tm-phase8-formal #topbar:before,body.tm-phase8-formal #topbar:after{display:none!important;}',
    'body.tm-phase8-formal.tm-phase8-ingame{overflow:hidden!important;}',
    'body.tm-phase8-formal #tmf-map-hint{display:none!important;}',
    'body.tm-phase8-formal #G{margin-top:48px!important;height:calc(100vh - 48px)!important;}',
    'body.tm-phase8-formal #topbar .tb-left{flex:0 0 auto!important;width:auto!important;height:58px!important;display:flex!important;align-items:center!important;gap:11px!important;margin:0!important;padding:4px 15px!important;border:1px solid rgba(201,168,95,.32)!important;border-radius:3px!important;background:linear-gradient(180deg,rgba(27,22,16,.95),rgba(10,8,6,.96))!important;box-shadow:0 4px 14px rgba(0,0,0,.45)!important;pointer-events:auto!important;}',
    'body.tm-phase8-formal #topbar .tb-left:before,body.tm-phase8-formal #topbar .tb-left:after{display:none!important;}',
    'body.tm-phase8-formal #topbar .tb-seal{width:48px!important;height:48px!important;padding:0!important;cursor:pointer!important;display:grid!important;place-items:center!important;border-radius:4px!important;border:1.6px solid #e7c97c!important;background:linear-gradient(180deg,#b3342b,#7e1f18)!important;color:#fbf0d6!important;font:33px/1 "Ma Shan Zheng","STKaiti","KaiTi",serif!important;box-shadow:inset 0 0 0 3px rgba(246,227,176,.16)!important;transition:box-shadow .15s,border-color .15s,transform .12s!important;}',
    'body.tm-phase8-formal #topbar .tb-seal:hover{border-color:#fbf0d6!important;box-shadow:inset 0 0 0 3px rgba(246,227,176,.28),0 0 14px rgba(231,201,124,.45)!important;transform:translateY(-1px)!important;}',
    'body.tm-phase8-formal #topbar .tb-idtext{display:flex!important;flex-direction:column!important;gap:2px!important;}',
    'body.tm-phase8-formal #topbar .tb-dyn{font:23px/1.05 "Ma Shan Zheng","STKaiti","KaiTi",serif!important;background:linear-gradient(135deg,#f6eccf,#e7c97c 50%,#b8924e)!important;-webkit-background-clip:text!important;background-clip:text!important;-webkit-text-fill-color:transparent!important;}',
    'body.tm-phase8-formal #topbar .tb-ruler{font:11px/1.2 "ZCOOL XiaoWei","STKaiti",serif!important;color:#8f8568!important;letter-spacing:.05em!important;max-width:128px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;}',
    'body.tm-phase8-formal #topbar .tb-left .tb-time{flex:0 0 auto!important;width:auto!important;min-width:0!important;height:auto!important;margin:0 0 0 2px!important;padding:0 0 0 10px!important;border:0!important;border-left:1px solid rgba(90,74,40,.55)!important;border-radius:0!important;background:none!important;text-align:left!important;display:flex!important;flex-direction:column!important;justify-content:center!important;}',
    'body.tm-phase8-formal #topbar .tb-time-main{max-width:none!important;font:19px/1.15 "Ma Shan Zheng","STKaiti","KaiTi",serif!important;color:#f0ead8!important;letter-spacing:.02em!important;white-space:nowrap!important;}',
    'body.tm-phase8-formal #topbar .tb-time-sub{max-width:none!important;margin-top:2px!important;font:11px/1.2 "ZCOOL XiaoWei",serif!important;color:#9a9072!important;letter-spacing:.03em!important;}',
    'body.tm-phase8-formal #topbar .tb-vars{flex:0 0 auto!important;width:auto!important;max-width:none!important;height:58px!important;display:flex!important;align-items:center!important;gap:0!important;margin:0 0 0 auto!important;padding:0 5px!important;border:1px solid rgba(201,168,95,.32)!important;border-radius:3px!important;background:linear-gradient(180deg,rgba(27,22,16,.95),rgba(10,8,6,.96))!important;box-shadow:0 4px 14px rgba(0,0,0,.45)!important;overflow:visible!important;pointer-events:auto!important;}',
    'body.tm-phase8-formal #topbar .tb-vars:before,body.tm-phase8-formal #topbar .tb-vars:after{display:none!important;}',
    'body.tm-phase8-formal #topbar .tb-var{height:52px!important;width:auto!important;min-width:0!important;max-width:none!important;flex:0 0 auto!important;border:0!important;border-radius:0!important;background:none!important;box-shadow:none!important;cursor:pointer!important;padding:0 10px!important;position:relative!important;}',
    'body.tm-phase8-formal #topbar .tb-var + .tb-var:before{content:""!important;display:block!important;position:absolute!important;left:0!important;top:8px!important;bottom:8px!important;width:1px!important;background:linear-gradient(180deg,transparent,rgba(201,168,95,.22),transparent)!important;}',
    'body.tm-phase8-formal #topbar .tb-var:hover{background:rgba(213,176,95,.10)!important;}',
    'body.tm-phase8-formal #topbar .tb-var.wide{display:flex!important;flex-direction:column!important;justify-content:center!important;gap:3px!important;padding:5px 11px!important;}',
    'body.tm-phase8-formal #topbar .tb-var.wide .tb-vn{display:block!important;flex:none!important;max-width:none!important;padding:0!important;font:11px/1 "ZCOOL XiaoWei",serif!important;color:#c2a463!important;letter-spacing:.1em!important;text-align:left!important;}',
    'body.tm-phase8-formal #topbar .tb-var.wide .tb-vsubs{display:flex!important;grid-template-columns:none!important;gap:11px!important;align-items:center!important;}',
    'body.tm-phase8-formal #topbar .tb-var.wide .tb-vs{display:flex!important;align-items:center!important;gap:4px!important;background:none!important;padding:0!important;}',
    'body.tm-phase8-formal #topbar .tb-var.wide .icn{width:15px!important;height:15px!important;border:0!important;background:none!important;box-shadow:none!important;}',
    'body.tm-phase8-formal #topbar .tb-stk-svg{width:15px!important;height:15px!important;display:block!important;}',
    'body.tm-phase8-formal #topbar .tb-var.wide .sv{display:flex!important;flex-direction:column!important;}',
    'body.tm-phase8-formal #topbar .tb-var.wide .sv b{display:block!important;font:600 14px/1.15 "Ma Shan Zheng","STSong","SimSun",serif!important;color:#f4ede0!important;}',
    'body.tm-phase8-formal #topbar .tb-var.wide .sv .sd{display:block!important;font:10px/1 "ZCOOL XiaoWei",serif!important;margin-top:1px!important;}',
    'body.tm-phase8-formal #topbar .tb-var:not(.wide){display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:1px!important;min-width:56px!important;padding:4px 8px!important;}',
    'body.tm-phase8-formal #topbar .tb-var:not(.wide) .tb-vbody{display:flex!important;flex-direction:column!important;align-items:center!important;gap:0!important;}',
    'body.tm-phase8-formal #topbar .tb-var:not(.wide) .tb-vn{display:block!important;font:11px/1.2 "ZCOOL XiaoWei",serif!important;color:#7d6c49!important;letter-spacing:.06em!important;}',
    'body.tm-phase8-formal #topbar .tb-var:not(.wide) .tb-vv{font:13px/1.15 "Ma Shan Zheng","STSong",serif!important;color:#cdb06a!important;}',
    'body.tm-phase8-formal #topbar .tb-var.warn .tb-vv{color:#e8554a!important;}',
    /* 四官印·方印 + 真伪双值条（吏紫/民权威告警色）·只作用于四个权力变量 */
    'body.tm-phase8-formal #topbar .tb-var.tb-seal-idx{display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:1px!important;min-width:46px!important;width:auto!important;height:48px!important;margin:0 2px!important;padding:0 6px!important;border:1.1px solid #8a6d34!important;border-radius:2px!important;background:linear-gradient(180deg,#1c1408,#100a04)!important;box-shadow:inset 0 0 0 .6px rgba(201,168,95,.16)!important;}',
    'body.tm-phase8-formal #topbar .tb-var.tb-seal-idx:before{display:none!important;}',
    'body.tm-phase8-formal #topbar .tb-seal-idx .tsi-ch{font:18px/1 "Ma Shan Zheng","STSong","SimSun",serif!important;color:#d8bd78!important;}',
    'body.tm-phase8-formal #topbar .tb-seal-idx .tsi-val{font:10px/1 "ZCOOL XiaoWei",serif!important;color:#b6a06a!important;letter-spacing:.02em!important;}',
    'body.tm-phase8-formal #topbar .tb-seal-idx .tsi-bar{position:relative!important;display:block!important;width:28px!important;height:4px!important;margin-top:2px!important;border-radius:2px!important;background:#241a0e!important;border:.6px solid #463718!important;overflow:visible!important;}',
    'body.tm-phase8-formal #topbar .tb-seal-idx .tsi-true{position:absolute!important;left:0!important;top:0!important;bottom:0!important;border-radius:2px!important;background:linear-gradient(90deg,#7a6a3a,#caa85f)!important;}',
    'body.tm-phase8-formal #topbar .tb-seal-idx .tsi-seen{position:absolute!important;top:-1.5px!important;bottom:-1.5px!important;width:1.6px!important;background:#d7e6f0!important;box-shadow:0 0 2px rgba(215,230,240,.85)!important;}',
    'body.tm-phase8-formal #topbar .tb-seal-idx.tone-purple{background:linear-gradient(180deg,#241634,#140c20)!important;border-color:#9b7bc4!important;}',
    'body.tm-phase8-formal #topbar .tb-seal-idx.tone-purple .tsi-ch{color:#cbb3e8!important;}',
    'body.tm-phase8-formal #topbar .tb-seal-idx.tone-purple .tsi-true{background:linear-gradient(90deg,#5a3f86,#a987d8)!important;}',
    'body.tm-phase8-formal #topbar .tb-seal-idx.tone-amber{background:linear-gradient(180deg,#2a1d08,#160f04)!important;border-color:#e0a23f!important;}',
    'body.tm-phase8-formal #topbar .tb-seal-idx.tone-amber .tsi-ch{color:#f0c97a!important;}',
    'body.tm-phase8-formal #topbar .tb-seal-idx.tone-amber .tsi-true{background:linear-gradient(90deg,#8a5a12,#e0a23f)!important;}',
    'body.tm-phase8-formal #topbar .tb-seal-idx.tone-red{background:linear-gradient(180deg,#2a0f0c,#160706)!important;border-color:#e8554a!important;}',
    'body.tm-phase8-formal #topbar .tb-seal-idx.tone-red .tsi-ch{color:#f0867c!important;}',
    'body.tm-phase8-formal #topbar .tb-seal-idx.tone-red .tsi-true{background:linear-gradient(90deg,#7e1f18,#e8554a)!important;}',
    'body.tm-phase8-formal #topbar .tb-right{flex:0 0 auto!important;width:auto!important;height:auto!important;display:flex!important;align-items:center!important;gap:8px!important;margin:0!important;padding:0!important;border:0!important;background:none!important;box-shadow:none!important;pointer-events:auto!important;}',
    'body.tm-phase8-formal #topbar .tb-right:before,body.tm-phase8-formal #topbar .tb-right:after{display:none!important;}',
    'body.tm-phase8-formal #topbar .tb-chip{display:flex!important;align-items:center!important;width:auto!important;height:58px!important;min-width:48px!important;padding:0 13px!important;border:1px solid rgba(201,168,95,.32)!important;border-radius:3px!important;background:linear-gradient(180deg,rgba(27,22,16,.95),rgba(10,8,6,.96))!important;color:#cdb06a!important;font:12.5px/1.2 "ZCOOL XiaoWei",serif!important;letter-spacing:.12em!important;box-shadow:0 4px 14px rgba(0,0,0,.45)!important;}',
    'body.tm-phase8-formal #topbar .tb-chip:hover{border-color:#e7c97c!important;color:#f0d98c!important;}',
    'body.tm-phase8-formal #topbar .tb-wentian{display:flex!important;align-items:center!important;justify-content:center!important;width:auto!important;min-width:78px!important;height:44px!important;padding:0 16px!important;border:1.2px solid rgba(201,168,95,.6)!important;border-radius:3px!important;background:linear-gradient(180deg,rgba(44,34,22,.96),rgba(13,10,8,.97))!important;color:#f0d98c!important;font:20px/1 "Ma Shan Zheng","STKaiti",serif!important;letter-spacing:.34em!important;box-shadow:0 4px 14px rgba(0,0,0,.45)!important;}',
    'body.tm-phase8-formal #topbar .tb-wentian:hover{border-color:#e7c97c!important;box-shadow:0 0 12px rgba(201,168,95,.22)!important;}',
    'body.tm-phase8-formal #topbar .tb-wentian .tb-wentian-label{padding-left:.34em!important;}',
    /* ═══ 顶栏精炼·御宝鎏金·素雅（落运行时·只动样式·加性 override）═══ */
    'body.tm-phase8-formal #topbar .tb-left,body.tm-phase8-formal #topbar .tb-vars{background:linear-gradient(180deg,rgba(255,236,200,.05),transparent 22%),linear-gradient(178deg,#211910,#160f09 56%,#0d0905)!important;box-shadow:inset 0 1px 0 rgba(240,213,151,.32),inset 0 -10px 22px rgba(0,0,0,.26),0 8px 26px rgba(0,0,0,.5)!important;}',
    'body.tm-phase8-formal #topbar .tb-chip{background:linear-gradient(180deg,rgba(255,236,200,.05),transparent 26%),linear-gradient(178deg,rgba(31,24,16,.96),rgba(10,8,6,.97))!important;}',
    'body.tm-phase8-formal #topbar .tb-var.wide .sv b{font-family:"Songti SC","STSong","SimSun",serif!important;font-variant-numeric:tabular-nums!important;color:#f4eddf!important;}',
    'body.tm-phase8-formal #topbar .tb-var:not(.wide) .tb-vv{font-family:"Songti SC","STSong","SimSun",serif!important;font-variant-numeric:tabular-nums!important;}',
    'body.tm-phase8-formal #topbar .tb-seal-idx .tsi-val{font-family:"Songti SC","STSong","SimSun",serif!important;font-variant-numeric:tabular-nums!important;}',
    'body.tm-phase8-formal #topbar .tb-seal{position:relative!important;background:radial-gradient(125% 125% at 30% 22%,#c14034,#a8312a 44%,#76190f)!important;box-shadow:inset 0 0 0 1px rgba(247,228,180,.34),inset 0 2px 5px rgba(255,206,160,.22),inset 0 -5px 9px rgba(60,10,8,.55),0 3px 10px rgba(110,28,20,.42)!important;}',
    'body.tm-phase8-formal #topbar .tb-seal::after{content:"\\53E9\\554F\\5929\\610F";position:absolute;left:50%;top:calc(100% + 9px);transform:translateX(-50%) translateY(-4px);font:10px/1 "ZCOOL XiaoWei",serif;letter-spacing:.2em;text-indent:.2em;color:#f0d597;white-space:nowrap;padding:4px 9px;border-radius:2px;border:1px solid rgba(207,173,101,.42);background:linear-gradient(178deg,#1e160d,#0e0a06);box-shadow:0 8px 18px rgba(0,0,0,.55);opacity:0;pointer-events:none;transition:opacity .16s ease,transform .16s ease;z-index:40;}',
    'body.tm-phase8-formal #topbar .tb-seal:hover::after,body.tm-phase8-formal #topbar .tb-seal.pinned::after{opacity:1!important;transform:translateX(-50%) translateY(0)!important;}',
    'body.tm-phase8-formal #topbar .tb-var.pinned{background:radial-gradient(135% 95% at 50% 0%,rgba(207,173,101,.13),transparent 78%)!important;}',
    'body.tm-phase8-formal #topbar .tb-var.wide.pinned::after,body.tm-phase8-formal #topbar .tb-var:not(.wide):not(.tb-seal-idx).pinned::after{content:"";position:absolute;left:12px;right:12px;top:6px;height:2px;border-radius:2px;background:linear-gradient(90deg,transparent,#f0d597 28%,#f0d597 72%,transparent);}',
    'body.tm-phase8-formal #topbar .tb-seal-idx.pinned{border-color:#f0d597!important;box-shadow:inset 0 0 0 1px rgba(240,213,151,.3),0 0 0 1px #f0d597,0 0 13px rgba(207,173,101,.4)!important;}',
    /* ═══ 优化版落地·分组 / 户口丁 / 钱为财首 / 材质升级（2026-06-21）═══ */
    'body.tm-phase8-formal #topbar .tb-vars .tb-vgrp{display:flex!important;align-items:center!important;height:100%!important;}',
    'body.tm-phase8-formal #topbar .tb-vars .tb-vgrp .tb-var + .tb-var:before{display:none!important;}',
    'body.tm-phase8-formal #topbar .tb-vars .tb-gsep{align-self:center!important;display:block!important;flex:none!important;width:1px!important;height:62%!important;margin:0 11px!important;background:linear-gradient(180deg,transparent,rgba(214,182,108,.5) 15%,rgba(214,182,108,.5) 85%,transparent)!important;}',
    'body.tm-phase8-formal #topbar .tb-vding{font:11px/1 "Songti SC","STSong","SimSun",serif!important;color:#9a8a66!important;margin-top:3px!important;font-variant-numeric:tabular-nums!important;}',
    'body.tm-phase8-formal #topbar .tb-vding .k{color:#a98f55!important;margin-right:3px!important;font-family:"ZCOOL XiaoWei",serif!important;}',
    /* 户口卡显示不全修复：隐藏与名重复的 icn「户」字（腾出 body 高度）+ 口值/丁数横排一行（名独占上行）·避免四行竖排把名/值压扁截断 */
    'body.tm-phase8-formal #topbar .tb-var[data-key="hukou"] .icn{display:none!important;}',
    'body.tm-phase8-formal #topbar .tb-var[data-key="hukou"] .tb-vbody{display:block!important;text-align:center!important;white-space:nowrap!important;}',
    'body.tm-phase8-formal #topbar .tb-var[data-key="hukou"] .tb-vn{display:block!important;margin-bottom:1px!important;}',
    'body.tm-phase8-formal #topbar .tb-var[data-key="hukou"] .tb-vv{display:inline-block!important;vertical-align:middle!important;}',
    'body.tm-phase8-formal #topbar .tb-var[data-key="hukou"] .tb-vding{display:inline-block!important;vertical-align:middle!important;margin-top:0!important;margin-left:6px!important;}',
    'body.tm-phase8-formal #topbar .tb-var.wide .tb-vs:first-child .sv b{color:#f9f2e4!important;}',
    'body.tm-phase8-formal #topbar .tb-var.wide .tb-vs:not(:first-child) .sv b{color:#dacfb8!important;}',
    'body.tm-phase8-formal #topbar .tb-seal{background:radial-gradient(38% 30% at 30% 22%,rgba(255,184,152,.5),transparent 62%),radial-gradient(128% 128% at 32% 24%,#c64a3c,#a8312a 44%,#6e1810 100%)!important;box-shadow:inset 0 0 0 1px rgba(247,228,180,.42),inset 0 3px 6px rgba(255,212,172,.28),inset 0 -6px 11px rgba(48,8,6,.6),0 3px 12px rgba(110,28,20,.5)!important;}',
    'body.tm-phase8-formal #topbar .tb-left,body.tm-phase8-formal #topbar .tb-vars{background:linear-gradient(180deg,rgba(255,238,205,.07),transparent 20%),linear-gradient(178deg,#241c12 0%,#1a120b 52%,#0e0a06 100%)!important;box-shadow:inset 0 1px 0 rgba(244,219,158,.42),inset 0 -12px 26px rgba(0,0,0,.30),inset 0 0 0 1px rgba(0,0,0,.30),0 10px 30px rgba(0,0,0,.55),0 2px 12px rgba(120,70,30,.13)!important;}',
    /* ═══ 牌匾装饰落地：四角回纹角花 + 描金双线内框 + 顶心云头冠 ═══ */
    'body.tm-phase8-formal #topbar .tb-left,body.tm-phase8-formal #topbar .tb-vars,body.tm-phase8-formal #topbar .tb-chip{position:relative!important;}',
    'body.tm-phase8-formal #topbar .tb-finner{position:absolute!important;inset:3.5px!important;border:1px solid rgba(207,173,101,.15)!important;border-radius:2px!important;pointer-events:none!important;z-index:1!important;}',
    'body.tm-phase8-formal #topbar .tb-fdeco{position:absolute!important;width:12px!important;height:12px!important;line-height:0!important;opacity:.9!important;pointer-events:none!important;z-index:3!important;}',
    'body.tm-phase8-formal #topbar .tb-fdeco svg{width:100%!important;height:100%!important;display:block!important;}',
    'body.tm-phase8-formal #topbar .tb-fdeco.tb-tl{top:3.5px!important;left:3.5px!important;}',
    'body.tm-phase8-formal #topbar .tb-fdeco.tb-tr{top:3.5px!important;right:3.5px!important;transform:scaleX(-1)!important;}',
    'body.tm-phase8-formal #topbar .tb-fdeco.tb-bl{bottom:3.5px!important;left:3.5px!important;transform:scaleY(-1)!important;}',
    'body.tm-phase8-formal #topbar .tb-fdeco.tb-br{bottom:3.5px!important;right:3.5px!important;transform:scale(-1,-1)!important;}',
    'body.tm-phase8-formal #topbar .tb-crest{position:absolute!important;top:-3px!important;left:50%!important;transform:translateX(-50%)!important;width:32px!important;height:12px!important;line-height:0!important;opacity:.9!important;pointer-events:none!important;z-index:4!important;}',
    'body.tm-phase8-formal #topbar .tb-crest svg{width:100%!important;height:100%!important;display:block!important;}',
    'body.tm-phase8-formal #topbar .tb-chip .tb-fdeco{width:10px!important;height:10px!important;}',
    /* ═══ 窄舞台自适应紧凑（JS fitTopbar 按需加 .tm-tb-fit1/2·media-query-free）═══
       固定虚拟舞台(tm-fixed-fit) normalizeStage 会删掉所有 max-width 媒体查询、且 @media 看的是设备宽而非舞台 VW，
       故顶栏溢出只能靠 JS 读 #topbar scrollWidth vs clientWidth 分级收缩：
       fit1=收 padding/gap + 隐增减小字(信息仍在「全部变量」与钉住悬浮)·不缩正文字号；
       fit2=再降字号/印记尺寸。宽舞台(1600/1920)两 class 皆不加→原设计零退化。 */
    'body.tm-phase8-formal #topbar.tm-tb-fit1{gap:6px!important;padding:0 8px!important;}',
    'body.tm-phase8-formal #topbar.tm-tb-fit1 .tb-left{padding:4px 10px!important;gap:7px!important;}',
    'body.tm-phase8-formal #topbar.tm-tb-fit1 .tb-vars{padding:0 3px!important;}',
    'body.tm-phase8-formal #topbar.tm-tb-fit1 .tb-var{padding:0 6px!important;}',
    'body.tm-phase8-formal #topbar.tm-tb-fit1 .tb-var.wide{padding:5px 7px!important;}',
    'body.tm-phase8-formal #topbar.tm-tb-fit1 .tb-var.wide .tb-vsubs{gap:6px!important;}',
    'body.tm-phase8-formal #topbar.tm-tb-fit1 .tb-var.wide .sv .sd{display:none!important;}',
    'body.tm-phase8-formal #topbar.tm-tb-fit1 .tb-var:not(.wide){min-width:46px!important;padding:4px 5px!important;}',
    'body.tm-phase8-formal #topbar.tm-tb-fit1 .tb-var.tb-seal-idx{min-width:38px!important;padding:0 4px!important;margin:0 1px!important;}',
    'body.tm-phase8-formal #topbar.tm-tb-fit1 .tb-vars .tb-gsep{margin:0 5px!important;}',
    'body.tm-phase8-formal #topbar.tm-tb-fit1 .tb-chip{padding:0 9px!important;min-width:auto!important;}',
    'body.tm-phase8-formal #topbar.tm-tb-fit2 .tb-left{padding:4px 8px!important;gap:6px!important;}',
    'body.tm-phase8-formal #topbar.tm-tb-fit2 .tb-dyn{font-size:19px!important;}',
    'body.tm-phase8-formal #topbar.tm-tb-fit2 .tb-time-main{font-size:16px!important;}',
    'body.tm-phase8-formal #topbar.tm-tb-fit2 .tb-ruler{max-width:88px!important;}',
    'body.tm-phase8-formal #topbar.tm-tb-fit2 .tb-var.wide .sv b{font-size:12.5px!important;}',
    'body.tm-phase8-formal #topbar.tm-tb-fit2 .tb-var.wide .tb-vn{font-size:9.5px!important;letter-spacing:.04em!important;}',
    'body.tm-phase8-formal #topbar.tm-tb-fit2 .tb-var.wide .icn,body.tm-phase8-formal #topbar.tm-tb-fit2 .tb-var.wide .tb-stk-svg{width:13px!important;height:13px!important;}',
    'body.tm-phase8-formal #topbar.tm-tb-fit2 .tb-var.wide .tb-vsubs{gap:4px!important;}',
    'body.tm-phase8-formal #topbar.tm-tb-fit2 .tb-var:not(.wide) .tb-vv{font-size:12px!important;}',
    'body.tm-phase8-formal #topbar.tm-tb-fit2 .tb-var:not(.wide) .tb-vn{font-size:10px!important;}',
    'body.tm-phase8-formal #topbar.tm-tb-fit2 .tb-var.tb-seal-idx{min-width:33px!important;padding:0 3px!important;}',
    'body.tm-phase8-formal #topbar.tm-tb-fit2 .tb-seal-idx .tsi-ch{font-size:15px!important;}',
    'body.tm-phase8-formal #topbar.tm-tb-fit2 .tb-seal-idx .tsi-val{font-size:9px!important;}',
    'body.tm-phase8-formal #topbar.tm-tb-fit2 .tb-seal-idx .tsi-bar{width:22px!important;}',
    'body.tm-phase8-formal #topbar.tm-tb-fit2 .tb-vars .tb-gsep{margin:0 3px!important;}'
  ];
  function installTopbarRedesignStyle(){
    if (document.getElementById('tm-topbar-redesign')) return;
    ['ma-shan-zheng','zcool-xiaowei'].forEach(function(f){
      var l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = 'https://cdn.jsdelivr.net/npm/@fontsource/' + f + '/index.css';
      document.head.appendChild(l);
    });
    var st = document.createElement('style');
    st.id = 'tm-topbar-redesign';
    st.textContent = TOPBAR_REDESIGN_CSS.join('\n');
    document.head.appendChild(st);
  }
  // 顶栏窄舞台自适应：读真实内容宽(scrollWidth) vs 舞台宽(clientWidth)·分级加 fit1/fit2 收缩。
  // media-query-free（fixed-fit 会删 max-width @media·且 @media 看设备宽非舞台 VW）→ 唯一可靠信号是真实布局宽。
  // 读 scrollWidth 会强制同步 reflow·故加 class 后即刻复量能拿到新宽·逐级判定。
  var _tbFitRaf = 0;
  function fitTopbar(){
    var top = document.getElementById('topbar');
    if (!top || !top.clientWidth) return;
    top.classList.remove('tm-tb-fit1', 'tm-tb-fit2');       // 先卸紧凑·按满设计量真实需求
    // 严格比较(不留 +1 容差)：内容拟合时 scrollWidth 会被 clamp 到 clientWidth→测不出余量·只能测真溢出；
    // +1 容差会漏掉亚像素级溢出(实测大额值 1281.3px 溢出被当放得下)→改严格 > 才触发紧凑。
    if (top.scrollWidth <= top.clientWidth) return;          // 宽舞台放得下→原设计零退化
    top.classList.add('tm-tb-fit1');                         // 收 padding/gap + 隐增减小字
    if (top.scrollWidth <= top.clientWidth) return;
    top.classList.add('tm-tb-fit2');                         // 再降字号/印记尺寸
    // 仍溢出（极窄）→ 已尽力·保留 fit2（绝不出横向滚动·不砍官印/全部变量）
  }
  function scheduleFitTopbar(){
    if (_tbFitRaf) return;
    var raf = window.requestAnimationFrame || function(cb){ return setTimeout(cb, 16); };
    _tbFitRaf = raf(function(){ _tbFitRaf = 0; try { fitTopbar(); } catch(_) {} });
  }
  function _tbPanelDeco(withCrest){
    var corner = '<svg viewBox="0 0 16 16" fill="none" stroke="#d6b66c" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"><path d="M2 14 V5 Q2 2 5 2 H14"/><path d="M6 14 V9 Q6 8 7 8 H11"/><circle cx="2" cy="14" r="1" fill="#d6b66c" stroke="none"/><circle cx="14" cy="2" r="1" fill="#d6b66c" stroke="none"/></svg>';
    var crest = withCrest ? '<i class="tb-crest" aria-hidden="true"><svg viewBox="0 0 30 11" fill="none" stroke="#d8b86a" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="M15 8.6 C11.7 8.6 10 6.4 10 4.6 C10 3 11.8 1.9 15 1.9 C18.2 1.9 20 3 20 4.6 C20 6.4 18.3 8.6 15 8.6Z"/><path d="M10 5 C6.3 5 4.4 6.6 1 6.1"/><path d="M20 5 C23.7 5 25.6 6.6 29 6.1"/><circle cx="1" cy="6.1" r="1" fill="#d8b86a" stroke="none"/><circle cx="29" cy="6.1" r="1" fill="#d8b86a" stroke="none"/></svg></i>' : '';
    return '<i class="tb-finner" aria-hidden="true"></i><i class="tb-fdeco tb-tl" aria-hidden="true">' + corner + '</i><i class="tb-fdeco tb-tr" aria-hidden="true">' + corner + '</i><i class="tb-fdeco tb-bl" aria-hidden="true">' + corner + '</i><i class="tb-fdeco tb-br" aria-hidden="true">' + corner + '</i>' + crest;
  }
  function ensurePreviewTopbar(){
    if (!syncFormalShellVisibility()) return null;
    installTopbarRedesignStyle();
    var top = document.getElementById('topbar');
    if (!top) {
      top = document.createElement('div');
      top.id = 'topbar';
      top.innerHTML =
        '<div class="tb-left">' + _tbPanelDeco(true) +
          '<button type="button" class="tb-seal" id="tmf-tb-seal" title="问天 · 叩问天意">—</button>' +
          '<div class="tb-idtext"><div class="tb-dyn" id="tmf-tb-dyn"></div><div class="tb-ruler" id="tmf-tb-ruler"></div></div>' +
          '<div class="tb-time" id="tmf-tb-time"><div class="tb-time-main" id="tmf-tb-time-main"></div><div class="tb-time-sub" id="tmf-tb-time-sub"></div></div>' +
        '</div>' +
        '<div class="tb-vars" id="tmf-tb-vars"></div>' +
        '<div class="tb-right"><button type="button" class="tb-chip" title="全部变量">' + _tbPanelDeco(false) + '<span class="tb-chip-label">全部变量</span></button></div>';
      document.body.insertBefore(top, document.body.firstChild);
      var sealBtn = top.querySelector('.tb-seal');
      if (sealBtn) sealBtn.onclick = function(){
        if (typeof window.openWentian === 'function') window.openWentian();
      };
      top.querySelector('.tb-chip').onclick = function(){
        if (window.TM && TM.UI && TM.UI.topbar && typeof TM.UI.topbar.openAllVarsModal === 'function') TM.UI.topbar.openAllVarsModal();
      };
      // 窄舞台自适应：窗口/舞台变化 + 字体沉降后重算顶栏紧凑级（只绑一次）
      if (!window.__tmTopbarFitBound) {
        window.__tmTopbarFitBound = true;
        try { window.addEventListener('resize', scheduleFitTopbar); } catch(_) {}
        try { if (document.fonts && document.fonts.ready) document.fonts.ready.then(scheduleFitTopbar); } catch(_) {}
      }
    }
    var vars = document.getElementById('tmf-tb-vars');
    if (vars && !vars.__phase8TopbarVarBound) {
      vars.__phase8TopbarVarBound = true;
      vars.addEventListener('click', function(e){
        var item = e.target && e.target.closest ? e.target.closest('.tb-var[data-key]') : null;
        if (!item) return;
        var key = item.getAttribute('data-key');
        e.stopPropagation();
        if (state.topbarVarPinnedKey === key) {
          clearTopbarVarPin();
          return;
        }
        clearTopbarVarPin();
        state.topbarVarPinnedKey = key;
        item.classList.add('pinned');
        showTopbarVarTip(e, item);
      });
      vars.addEventListener('dblclick', function(e){
        var item = e.target && e.target.closest ? e.target.closest('.tb-var[data-key]') : null;
        if (!item) return;
        var key = item.getAttribute('data-key');
        clearTopbarVarPin();
        if (key && typeof window._handleBarVarClick === 'function') window._handleBarVarClick(key);
      });
      vars.addEventListener('contextmenu', function(e){
        var item = e.target && e.target.closest ? e.target.closest('.tb-var[data-key]') : null;
        if (!item) return;
        e.preventDefault();
        var key = item.getAttribute('data-key');
        clearTopbarVarPin();
        if (key && typeof window._handleBarVarClick === 'function') window._handleBarVarClick(key);
      });
      vars.addEventListener('mouseover', function(e){
        var item = e.target && e.target.closest ? e.target.closest('.tb-var[data-tip-idx]') : null;
        if (!item || typeof window._showBarVarTip !== 'function') return;
        if (state.topbarVarPinnedKey && state.topbarVarPinnedKey !== item.getAttribute('data-key')) return;
        showTopbarVarTip(e, item);
      });
      vars.addEventListener('mouseout', function(e){
        var item = e.target && e.target.closest ? e.target.closest('.tb-var[data-tip-idx]') : null;
        if (!item) return;
        if (state.topbarVarPinnedKey) return;
        var related = e.relatedTarget;
        if (related && vars.contains(related)) return;
        if (typeof window._hideBarVarTip === 'function') window._hideBarVarTip();
      });
      vars.addEventListener('mousemove', function(e){
        if (typeof window._moveBarVarTip === 'function') window._moveBarVarTip(e);
      });
    }
    bindTopbarAuxInteractions(top);
    if (vars) {
      vars.innerHTML = topbarApi().renderPreviewTopbarVars();
      if (state.topbarVarPinnedKey) {
        var pinned = vars.querySelector('.tb-var[data-key="' + cssEscape(state.topbarVarPinnedKey) + '"]');
        if (pinned) pinned.classList.add('pinned');
      }
    }
    // 身份簇：朝代印 + 大+朝代 + 君主（数据驱动·非死字段；findScenarioById(GM.sid) → sc.dynasty/sc.emperor，P.dynasty 兜底）
    var _sc = null;
    try { if (typeof findScenarioById === 'function' && window.GM && GM.sid) _sc = findScenarioById(GM.sid); } catch(_e0) {}
    var _dyn = (_sc && _sc.dynasty) || (window.P && P.dynasty) || '';
    var _ruler = (_sc && _sc.emperor) || '';
    var sealEl = document.getElementById('tmf-tb-seal');
    var dynEl = document.getElementById('tmf-tb-dyn');
    var rulerEl = document.getElementById('tmf-tb-ruler');
    if (sealEl) sealEl.textContent = _dyn ? String(_dyn).slice(0, 1) : '—';
    if (dynEl) dynEl.textContent = _dyn ? ('大' + String(_dyn).replace(/^大/, '')) : '本朝';
    if (rulerEl) rulerEl.textContent = _ruler || '';
    // 合一时历：主历串（已含年号·季·月·干支日）+ 节气并入 sub（撤掉独立节候）
    var main = document.getElementById('tmf-tb-time-main');
    var sub = document.getElementById('tmf-tb-time-sub');
    var _jieqi = textById('bar-weather-name', '');
    var _sub0 = textById('bar-time-sub', textById('bar-turn-text', ''));
    if (main) main.textContent = textById('bar-time-main', textById('bar-date', ''));
    if (sub) sub.textContent = [((_jieqi && _jieqi !== '节候') ? _jieqi : ''), _sub0].filter(Boolean).join(' · ');
    ensureTopbarBanner();
    scheduleFitTopbar();   // 值/文案更新后按舞台宽重算紧凑级（每回合值变宽→可能跨阈值）
  }

  function topbarBannerText(){
    var scenarioName = '';
    try {
      if (typeof findScenarioById === 'function' && window.GM && GM.sid) {
        var sc = findScenarioById(GM.sid);
        scenarioName = sc && (sc.name || sc.era) ? (sc.name || sc.era) : '';
      }
    } catch(_) {}
    scenarioName = String(scenarioName || '天命').replace(/（官方）|\(官方\)/g, '').split(/[—\-]/)[0].trim();
    if (scenarioName.length > 10) scenarioName = scenarioName.slice(0, 10);
    var turn = (window.GM && GM.turn) ? ('第' + GM.turn + '回') : '';
    return ['天命 shell v2', scenarioName, turn].filter(Boolean).join(' · ');
  }

  function ensureTopbarBanner(){
    var banner = document.getElementById('banner');
    if (banner) banner.remove();
  }

  // ── 中央地图 + region/faction dossier + alerts·121 函数 已迁出·见 phase8-formal-map.js (Wave 6·2026-05-26·2606 行) ──
  // wrapper·让 bridge.js IIFE 内现存 X() callsite 0 改动·真函数由 map.js 在 bridge.map.X 上挂回·这里早期 stub 先占位
  function ensureMainShell(){ var m = (window.TMPhase8FormalBridge||{}).map; if (m && m.ensureMainShell) return m.ensureMainShell(); }
  function getMapData(){ var m = (window.TMPhase8FormalBridge||{}).map; return m && m.getMapData ? m.getMapData() : null; }
  function ownerKey(r){ var m = (window.TMPhase8FormalBridge||{}).map; return m && m.ownerKey ? m.ownerKey(r) : ''; }
  function ownerName(r){ var m = (window.TMPhase8FormalBridge||{}).map; return m && m.ownerName ? m.ownerName(r) : ''; }
  function findFaction(key, name){ var m = (window.TMPhase8FormalBridge||{}).map; return m && m.findFaction ? m.findFaction(key, name) : null; }
  function renderFormalMapSoon(){ var m = (window.TMPhase8FormalBridge||{}).map; if (m && m.renderFormalMapSoon) return m.renderFormalMapSoon(); }
  function focusRegion(id, open){ var m = (window.TMPhase8FormalBridge||{}).map; if (m && m.focusRegion) return m.focusRegion(id, open); }
  function findRegion(id){ var m = (window.TMPhase8FormalBridge||{}).map; return m && m.findRegion ? m.findRegion(id) : null; }
  function openRegionDossier(r){ var m = (window.TMPhase8FormalBridge||{}).map; if (m && m.openRegionDossier) return m.openRegionDossier(r); }
  function openFactionDossier(key, region){ var m = (window.TMPhase8FormalBridge||{}).map; if (m && m.openFactionDossier) return m.openFactionDossier(key, region); }
  function factionOwnsRegion(r, key, f){ var m = (window.TMPhase8FormalBridge||{}).map; return m && m.factionOwnsRegion ? m.factionOwnsRegion(r, key, f) : false; }
  function installMapRefreshHooks(){ var m = (window.TMPhase8FormalBridge||{}).map; if (m && m.installMapRefreshHooks) return m.installMapRefreshHooks(); }
  function renderFormalMap(){ var m = (window.TMPhase8FormalBridge||{}).map; if (m && m.renderFormalMap) return m.renderFormalMap(); }
  function dossierRows(rows){ var m = (window.TMPhase8FormalBridge||{}).map; return m && m.dossierRows ? m.dossierRows(rows) : ''; }
  function fmtNum(v, unit){ var m = (window.TMPhase8FormalBridge||{}).map; return m && m.fmtNum ? m.fmtNum(v, unit) : ''; }

  // 2026-05-27·拆分 wave 4 遗留·9 个 drafts 函数迁出 bridge 后裸引用未 wrap·导致 IIFE crash·全 UI 失效
  // 与 ensureMainShell / renderFormalMap 同 paradigm·lazy 走 bridge.drafts.X
  // 降级·drafts 未装载时(资源部分装载场景) toast 提示 + 回退 openModule 对应 mockup 模块·避免死按钮(无面板无 toast 无回退)
  function openZhaoPreviewPanel(){ var d = (window.TMPhase8FormalBridge||{}).drafts; if (d && d.openZhaoPreviewPanel) return d.openZhaoPreviewPanel.apply(null, arguments); toast('御笔面板未就绪，暂用简版'); return openModule('edict'); }
  function openYueZouPreviewPanel(){ var d = (window.TMPhase8FormalBridge||{}).drafts; if (d && d.openYueZouPreviewPanel) return d.openYueZouPreviewPanel.apply(null, arguments); toast('朱批面板未就绪，暂用简版'); return openModule('memorial'); }
  function openHongyanPreviewPanel(){ var d = (window.TMPhase8FormalBridge||{}).drafts; if (d && d.openHongyanPreviewPanel) return d.openHongyanPreviewPanel.apply(null, arguments); toast('鸿雁面板未就绪，暂用简版'); return openModule('letter'); }
  function openShiluPreviewPanel(){ var d = (window.TMPhase8FormalBridge||{}).drafts; if (d && d.openShiluPreviewPanel) return d.openShiluPreviewPanel.apply(null, arguments); toast('实录面板未就绪，暂用简版'); return openModule('records'); }
  function syncFormalEdictDraftsToLegacyInputs(){ var d = (window.TMPhase8FormalBridge||{}).drafts; if (d && d.syncFormalEdictDraftsToLegacyInputs) return d.syncFormalEdictDraftsToLegacyInputs.apply(null, arguments); }
  function getFormalEdictDraftSnapshot(){ var d = (window.TMPhase8FormalBridge||{}).drafts; if (d && d.getFormalEdictDraftSnapshot) return d.getFormalEdictDraftSnapshot.apply(null, arguments); }
  function clearFormalEdictDrafts(){ var d = (window.TMPhase8FormalBridge||{}).drafts; if (d && d.clearFormalEdictDrafts) return d.clearFormalEdictDrafts.apply(null, arguments); }
  function showFormalEdictAdoptMenu(){ var d = (window.TMPhase8FormalBridge||{}).drafts; if (d && d.showFormalEdictAdoptMenu) return d.showFormalEdictAdoptMenu.apply(null, arguments); }
  function dismissFormalEdictSuggestion(){ var d = (window.TMPhase8FormalBridge||{}).drafts; if (d && d.dismissFormalEdictSuggestion) return d.dismissFormalEdictSuggestion.apply(null, arguments); }
  function actionBtn(){ var d = (window.TMPhase8FormalBridge||{}).drafts; return d && d.actionBtn ? d.actionBtn.apply(null, arguments) : ''; }
  function actionChip(){ var d = (window.TMPhase8FormalBridge||{}).drafts; return d && d.actionChip ? d.actionChip.apply(null, arguments) : ''; }
  function renderActionStats(){ var d = (window.TMPhase8FormalBridge||{}).drafts; return d && d.renderActionStats ? d.renderActionStats.apply(null, arguments) : ''; }
  function refreshMapFromRuntime(){ var m = (window.TMPhase8FormalBridge||{}).map; if (m && m.refreshMapFromRuntime) return m.refreshMapFromRuntime.apply(null, arguments); }

  function validRegionMapTab(tab){
    return ['overview', 'mood', 'classPressure', 'tax', 'army', 'office', 'owner'].indexOf(String(tab || '')) >= 0;
  }

  function validFactionMapTab(tab){
    return ['overview', 'territory', 'military', 'finance', 'relations', 'records'].indexOf(String(tab || '')) >= 0;
  }

  function openRecordsMenu(){
    openModule('records');
  }

  function firstArray(){
    for (var i = 0; i < arguments.length; i += 1) {
      if (Array.isArray(arguments[i]) && arguments[i].length) return arguments[i];
    }
    return [];
  }

  function getIssues(){
    var gm = window.GM || {};
    var issues = [];
    var seen = {};
    ['currentIssues','issues','pendingIssues','shizhengIssues'].forEach(function(k){
      if (!Array.isArray(gm[k])) return;
      gm[k].forEach(function(x, idx){
        if (!x) return;
        var key = String(x.id || x.key || (x.title || x.name || x.topic || '') + '|' + (x.raisedTurn || x.turn || idx));
        if (seen[key]) return;
        seen[key] = true;
        issues.push(x);
      });
    });
    var out = issues.map(function(x, i){
      var status = x.status || 'pending';
      return {
        raw: x,
        id: x.id || x.key || ('issue-' + i),
        title: x.title || x.name || x.topic || ('议题 ' + (i + 1)),
        category: x.category || x.type || x.kind || '朝政',
        severity: x.severity || x.urgency || x.level || '待处置',
        proposer: x.proposer || x.from || x.raisedBy || x.source || '内阁',
        dept: x.dept || x.department || x.category || '御前',
        text: x.description || x.desc || x.text || x.summary || x.narrative || '',
        narrative: x.narrative || '',
        detail: x.detail || x.impact || x.note || x.result || '',
        affectedRegion: x.affectedRegion || x.region || x.place || '',
        linkedChars: Array.isArray(x.linkedChars) ? x.linkedChars : (Array.isArray(x.characters) ? x.characters : []),
        linkedFactions: Array.isArray(x.linkedFactions) ? x.linkedFactions : (Array.isArray(x.factions) ? x.factions : []),
        longTermConsequences: x.longTermConsequences || x.consequences || null,
        historicalNote: x.historicalNote || x.historyNote || x.noteHistorical || '',
        chosenText: x.chosenText || x.resolution || x.resultText || '',
        choices: Array.isArray(x.choices) ? x.choices : [],
        raisedTurn: Number(x.raisedTurn || x.turn || (gm.turn || 1)),
        raisedDate: x.raisedDate || x.date || '',
        resolvedTurn: x.resolvedTurn || null,
        resolvedDate: x.resolvedDate || '',
        status: status
      };
    });
    return out;
  }

  function compactText(s, limit){
    var text = String(s || '').replace(/\s+/g, ' ').trim();
    if (!limit || text.length <= limit) return text;
    return text.slice(0, Math.max(0, limit - 1)) + '…';
  }

  function fullHongyanText(s, fallback, cls){
    var text = String(s == null ? '' : s).replace(/\r\n/g, '\n').trim();
    if (!text) text = String(fallback || '');
    return '<span class="hy-fulltext-v5 ' + attr(cls || '') + '">' + esc(text) + '</span>';
  }

  function issueIsResolved(issue){
    var s = String(issue && issue.status || '').toLowerCase();
    return s === 'resolved' || s === 'done' || s === 'closed' || s === '已解决' || s === '已决' || s === '已裁';
  }

  function issueStatusText(issue){
    return issueIsResolved(issue) ? '已裁' : '待裁';
  }

  function issueDateText(issue){
    if (!issue) return '';
    return issue.raisedDate || getTurnText(issue.raisedTurn || ((window.GM && GM.turn) || 1));
  }

  function issueRank(issue){
    return Number((issue && (issue.resolvedTurn || issue.raisedTurn)) || 0);
  }

  function issueTagList(issue, limit){
    var tags = [];
    if (!issue) return tags;
    [issue.category, issue.dept, issue.affectedRegion, issue.severity].forEach(function(x){
      if (x && tags.indexOf(String(x)) < 0) tags.push(String(x));
    });
    (issue.linkedFactions || []).forEach(function(x){
      var name = typeof x === 'string' ? x : (x && (x.name || x.label || x.id));
      if (name && tags.indexOf(String(name)) < 0) tags.push(String(name));
    });
    return tags.slice(0, limit || 6);
  }

  function renderIssueTags(issue){
    var tags = issueTagList(issue, 8);
    if (!tags.length) return '';
    return '<div class="tmf-sz-tags">' + tags.map(function(x){ return '<span>' + esc(x) + '</span>'; }).join('') + '</div>';
  }

  function renderIssueCard(issue, selectedId){
    var resolved = issueIsResolved(issue);
    var active = String(issue.id) === String(selectedId || '');
    var meta = [issueDateText(issue), issue.category, issue.affectedRegion, issue.severity].filter(Boolean).join(' · ');
    return '<button type="button" class="tmf-sz-card ' + (resolved ? 'ok' : 'hot') + (active ? ' active' : '') + '" data-module-action="select-issue" data-id="' + attr(issue.id) + '">' +
      '<span class="tmf-sz-badge">' + esc(issueStatusText(issue)) + '</span>' +
      '<b>' + esc(issue.title || '未详议题') + '</b>' +
      '<em>' + esc(meta || '御前待核') + '</em>' +
      '<p>' + esc(compactText(issue.text || issue.narrative || issue.detail || '待详议。', 84)) + '</p>' +
      '</button>';
  }

  function renderIssueConsequences(issue){
    var obj = issue && issue.longTermConsequences;
    if (!obj || typeof obj !== 'object') return '';
    var rows = Object.keys(obj).filter(function(k){ return obj[k] != null && obj[k] !== ''; }).slice(0, 8);
    if (!rows.length) return '';
    return '<section class="tmf-sz-block"><b>长期牵连</b><div class="tmf-sz-rows">' + rows.map(function(k){
      return '<span><i>' + esc(k) + '</i><em>' + esc(String(obj[k])) + '</em></span>';
    }).join('') + '</div></section>';
  }

  function renderIssueChoices(issue){
    if (!issue || issueIsResolved(issue) || !Array.isArray(issue.choices) || !issue.choices.length) return '';
    // label/consequence → text/desc 兼容归一(绍宋剧本 choices 用 label·否则回落占位符「选项N」)
    if (typeof window !== 'undefined' && typeof window._tmNormIssueChoices === 'function') window._tmNormIssueChoices(issue);
    else issue.choices.forEach(function(ch){ if(ch&&typeof ch==='object'){ if((ch.text==null||ch.text==='')&&ch.label)ch.text=ch.label; if((ch.desc==null||ch.desc==='')&&ch.consequence)ch.desc=ch.consequence; } });
    return '<section class="tmf-sz-block"><b>可裁断</b><div class="tmf-sz-choices">' + issue.choices.map(function(ch, idx){
      return '<button type="button" class="tmf-sz-choice" data-module-action="shizheng-choice" data-id="' + attr(issue.id) + '" data-choice="' + attr(idx) + '">' +
        '<strong>' + esc(ch.text || ch.title || ('选项 ' + (idx + 1))) + '</strong>' +
        '<span>' + esc(ch.desc || ch.description || ch.effect || '按此裁断并写入时政结果。') + '</span>' +
        '</button>';
    }).join('') + '</div></section>';
  }

  function renderIssueDetail(issue){
    if (!issue) return '<div class="tmf-sz-empty">暂无御案时政。此处只显示待裁或已裁的政务议题；近事、邸报和人物势力活动归事件栏。</div>';
    var linkedChars = (issue.linkedChars || []).map(function(x){ return typeof x === 'string' ? x : (x && (x.name || x.id || x.label)); }).filter(Boolean);
    var linkedFactions = (issue.linkedFactions || []).map(function(x){ return typeof x === 'string' ? x : (x && (x.name || x.id || x.label)); }).filter(Boolean);
    var meta = [issueDateText(issue), issue.category, issue.affectedRegion, issue.severity, issueStatusText(issue)].filter(Boolean).join(' · ');
    var resolved = issueIsResolved(issue);
    var tagsHtml = renderIssueTags(issue);
    return '<div class="tmf-sz-detail">' +
      '<div class="tmf-sz-detail-head ' + (resolved ? 'ok' : 'hot') + '"><span>' + esc(issueStatusText(issue)) + '</span><h3>' + esc(issue.title || '时政议题') + '</h3><p>' + esc(meta) + '</p></div>' +
      '<section class="tmf-sz-block"><b>事由</b><p>' + esc(issue.text || issue.narrative || issue.detail || '此议题尚无详细事由。') + '</p></section>' +
      (issue.narrative && issue.narrative !== issue.text ? '<section class="tmf-sz-block"><b>叙事脉络</b><p>' + esc(issue.narrative) + '</p></section>' : '') +
      (issue.detail ? '<section class="tmf-sz-block"><b>影响记录</b><p>' + esc(issue.detail) + '</p></section>' : '') +
      (linkedChars.length || linkedFactions.length ? '<section class="tmf-sz-block"><b>牵涉对象</b><div class="tmf-sz-tags">' + linkedChars.concat(linkedFactions).slice(0, 12).map(function(x){ return '<span>' + esc(x) + '</span>'; }).join('') + '</div></section>' : (tagsHtml ? '<section class="tmf-sz-block"><b>标签</b>' + tagsHtml + '</section>' : '')) +
      renderIssueConsequences(issue) +
      (issue.historicalNote ? '<section class="tmf-sz-block"><b>史备注</b><p>' + esc(issue.historicalNote) + '</p></section>' : '') +
      (resolved && issue.chosenText ? '<section class="tmf-sz-block"><b>既裁</b><p>' + esc(issue.chosenText) + '</p></section>' : '') +
      renderIssueChoices(issue) +
      '</div>';
  }

  function getMemorials(){
    var gm = window.GM || {};
    var list = firstArray(gm.memorials, gm.zoushu, gm.memorialQueue, gm.petitions, gm.recentMemorials);
    if (!list.length) return [];
    return list.filter(function(x){
      if (!x) return false;
      if (isPhase8FallbackMemorial(x)) return false;
      var status = String(x.status || 'pending');
      return Number(x.turn || gm.turn || 1) === Number(gm.turn || 1) || status === 'pending' || status === 'pending_review';
    }).map(function(x, i){
      return {
        id: x.id || ('mem-' + list.indexOf(x)),
        rawIndex: list.indexOf(x),
        title: x.title || x.topic || x.name || ('奏疏 ' + (i + 1)),
        from: x.from || x.author || x.proposer || x.official || '臣工',
        dept: x.dept || x.department || x.category || x.type || '通政司',
        type: x.type || x.category || '奏疏',
        subtype: x.subtype || '',
        text: x.text || x.body || x.content || x.desc || x.summary || '',
        content: x.content || x.text || x.body || x.desc || x.summary || '',
        status: x.status || 'pending',
        priority: x.priority || '',
        reliability: x.reliability || '',
        reply: x.reply || '',
        turn: x.turn || gm.turn || 1,
        raw: x
      };
    });
  }

  function isPhase8FallbackMemorial(x){
    var title = String((x && (x.title || x.topic || x.name)) || '');
    var text = String((x && (x.text || x.body || x.content || x.desc || x.summary || x.narrative)) || '');
    if (title === '陕西饥荒告急' && /延绥饥民流离/.test(text)) return true;
    if (title === '辽东督师空悬，关宁饷饥' && /关宁诸镇请饷/.test(text)) return true;
    if (title === '魏忠贤阉党亟待决断' && /司礼监与东厂权柄未去/.test(text)) return true;
    return false;
  }

  function getLetters(){
    var gm = window.GM || {};
    return firstArray(gm.letters, gm.hongyan, gm.mail, gm.messages, gm.inbox).map(function(x, i){
      var text = x.content || x.text || x.body || x.desc || x.summary || '';
      return {
        id: x.id || ('letter-' + i),
        title: x.title || x.topic || x.subject || x.subjectLine || ('书信 ' + (i + 1)),
        from: x.from || x.sender || x.author || '来信者',
        to: x.to || x.recipient || '御前',
        text: text,
        content: text,
        reply: x.reply || '',
        status: x.status || '未阅',
        sentTurn: x.sentTurn || x.turn || x.createdTurn || 1,
        deliveryTurn: x.deliveryTurn || null,
        replyTurn: x.replyTurn || null,
        letterType: x.letterType || x.type || 'personal',
        urgency: x.urgency || 'normal',
        cipher: x._cipher || x.cipher || 'none',
        sendMode: x._sendMode || x.sendMode || '',
        npcInitiated: !!x._npcInitiated,
        playerRead: !!x._playerRead,
        starred: !!(x._starred || x.star),
        raw: x
      };
    });
  }

  function getFactions(){
    return firstArray(window.GM && GM.facs, window.P && P.factions, window.P && P.facs);
  }

  function getParties(){
    return firstArray(window.GM && GM.parties, window.P && P.parties);
  }

  function getClasses(){
    return firstArray(window.GM && GM.classes, window.P && P.classes, window.P && P.socialClasses);
  }

  function getArmies(){
    return firstArray(window.GM && GM.armies, window.P && P.armies);
  }

  // ── module dispatch + render*Module + tmfRenwu* 已迁出·见 phase8-formal-modules.js (Wave 5·2026-05-26·1241 行) ──
  // 保留 wrapper·让 bridge.js IIFE 内现存 closeModule()/openModule()/moduleShell()/handleModuleAction() 直接调用照常工作
  function closeModule(){ var m = (window.TMPhase8FormalBridge||{}).modules; if (m && m.closeModule) return m.closeModule(); }
  function openModule(kind, options){ var m = (window.TMPhase8FormalBridge||{}).modules; if (m && m.openModule) return m.openModule(kind, options); }
  function moduleShell(kind, title, sub, left, main, right){ var m = (window.TMPhase8FormalBridge||{}).modules; return m && m.moduleShell ? m.moduleShell(kind, title, sub, left, main, right) : ''; }
  function handleModuleAction(action, data){ var m = (window.TMPhase8FormalBridge||{}).modules; if (m && m.handleModuleAction) return m.handleModuleAction(action, data); }
  function tmfRenwuPortrait(p){ var m = (window.TMPhase8FormalBridge||{}).modules; return m && m.tmfRenwuPortrait ? m.tmfRenwuPortrait(p) : ''; }

  // ── desk overlay + 起草面板 + 预览面板 已迁出·见 phase8-formal-drafts.js (Wave 4·2026-05-26·1959 行) ──

  function openShizhengPreviewPanel(){
    var issues = getIssues();
    var pending = issues.filter(function(x){ return !issueIsResolved(x); });
    var resolved = issues.filter(issueIsResolved);
    var filter = state.shizhengDeskFilter || 'pending';
    var visible = filter === 'resolved' ? resolved : (filter === 'all' ? issues : pending);
    visible = visible.slice().sort(function(a, b){
      var ar = issueIsResolved(a) ? 1 : 0;
      var br = issueIsResolved(b) ? 1 : 0;
      if (ar !== br) return ar - br;
      return issueRank(b) - issueRank(a);
    });
    var selected = visible.find(function(x){ return String(x.id) === String(state.shizhengIssue || ''); }) || visible[0] || issues.find(function(x){ return String(x.id) === String(state.shizhengIssue || ''); }) || null;
    if (selected) state.shizhengIssue = selected.id;
    var filterBar = '<div class="tm-desk-tabs">' +
      [['pending','待裁'],['resolved','已裁'],['all','全部']].map(function(t){
        return '<button type="button" class="tm-desk-tab ' + (filter === t[0] ? 'active' : '') + '" data-desk-action="shizheng-filter-desk" data-filter="' + attr(t[0]) + '">' + esc(t[1]) + '</button>';
      }).join('') + '</div>';
    var left = filterBar + deskList(visible.map(function(x){
      return { id: x.id, title: x.title, meta: [issueStatusText(x), x.category, x.severity].filter(Boolean).join(' · '), text: x.text, hot: String(x.id) === String(selected && selected.id) };
    }), filter === 'resolved' ? '暂无已裁议题。' : (filter === 'all' ? '暂无御案时政。' : '暂无待裁议题。'), { action:'select-issue-desk' });
    var linkedChars = selected ? (selected.linkedChars || []).map(function(x){ return typeof x === 'string' ? x : (x && (x.name || x.id || x.label)); }).filter(Boolean) : [];
    var linkedFactions = selected ? (selected.linkedFactions || []).map(function(x){ return typeof x === 'string' ? x : (x && (x.name || x.id || x.label)); }).filter(Boolean) : [];
    var consequenceText = '';
    if (selected && selected.longTermConsequences && typeof selected.longTermConsequences === 'object') {
      consequenceText = Object.keys(selected.longTermConsequences).filter(function(k){ return selected.longTermConsequences[k] != null && selected.longTermConsequences[k] !== ''; }).map(function(k){
        return k + '：' + selected.longTermConsequences[k];
      }).join('\n');
    }
    var main = selected ? '<h3 class="tm-desk-title">' + esc(selected.title || '御案时政') + '</h3>' +
      deskRows([['状态', issueStatusText(selected)], ['提出', selected.proposer || '内阁'], ['分类', selected.category || '朝政'], ['日期', issueDateText(selected)], ['关涉人物', linkedChars.length ? linkedChars.join('、') : '未记'], ['牵动势力', linkedFactions.length ? linkedFactions.join('、') : '未记']]) +
      deskCard('事由', selected.text || selected.narrative || selected.detail || '暂无详细事由。') +
      (selected.narrative && selected.narrative !== selected.text ? deskCard('叙事脉络', selected.narrative) : '') +
      (selected.detail ? deskCard('影响记录', selected.detail) : '') +
      (consequenceText ? deskCard('风势推演', consequenceText) : '') +
      (selected.historicalNote ? deskCard('史馆旧案', selected.historicalNote) : '') +
      (selected.chosenText ? deskCard('陛下已断', selected.chosenText) : '') +
      renderIssueChoices(selected).replace(/data-module-action="shizheng-choice"/g, 'data-desk-action="shizheng-choice-desk"') +
      '<div class="tm-desk-actions">' + deskAction('御前召对群臣','shizheng-convene-desk',{ id:selected.id }, true) + deskAction('独召密问','shizheng-secret-desk',{ id:selected.id }) + deskAction('转诏书草案','add-edict-desk',{ id:selected.id }) + deskAction('打开史官实录','module-desk',{ kind:'records' }) + '</div>' : '<div class="tm-desk-empty">暂无御案时政。此处只承接 GM.currentIssues 等政务议题；近事、邸报、NPC 活动请看事件栏。</div>';
    var linkedCharTotal = issues.reduce(function(sum, x){ return sum + ((x.linkedChars || []).length); }, 0);
    var linkedFactionTotal = issues.reduce(function(sum, x){ return sum + ((x.linkedFactions || []).length); }, 0);
    var right = '<h4 class="tm-desk-subtitle">御案总览</h4>' + deskStats([
      ['待裁', pending.length + ' 项'],
      ['已裁', resolved.length + ' 项'],
      ['关涉人物', linkedCharTotal + ' 人次'],
      ['牵动势力', linkedFactionTotal + ' 项'],
      ['本回合', getTurnText(window.GM && GM.turn)]
    ]) + deskCard('收录范围', '御案时政只收录需要玩家裁断或已经裁断的政务议题，包括事由、关涉人物、牵动势力、长期后果、史料注和裁断选项。') +
      deskCard('不收录', '近事、邸报、势力动态、人物 NPC 活动归事件栏；史记、起居注、纪事、编年归史官实录。');
    if (window.TMPhase8FormalBridge && TMPhase8FormalBridge.drafts) TMPhase8FormalBridge.drafts.openDeskOverlay('tm-shizheng-overlay', deskPanelShell('shizheng', '御案时政', '承接预览页朝政中心：待裁议题、召对密问、裁断记录', left, main, right));
  }

  function openAction(kind){
    if (kind === 'edict') {
      openZhaoPreviewPanel();
    } else if (kind === 'memorial') {
      openYueZouPreviewPanel();
    } else if (kind === 'letter') {
      openHongyanPreviewPanel();
    } else if (kind === 'records') {
      openShiluPreviewPanel();
    }
    else if (kind === 'renwu') openModule('renwu');
    else if (kind === 'shizheng') openShizhengLegacyFlow();
  }

  function miniRows(rows){
    return '<div class="tmf-minirows">' + rows.map(function(r){
      return '<div><span>' + esc(r[0]) + '</span><b>' + esc(r[1] == null || r[1] === '' ? '未记' : r[1]) + '</b></div>';
    }).join('') + '</div>';
  }

  function actionButton(label, sub, onClick, cls){
    return '<button type="button" class="tmf-action ' + (cls || '') + '" onclick="' + onClick + '"><b>' + esc(label) + '</b><span>' + esc(sub || '') + '</span></button>';
  }

  // ── 右 rail panels + handlers 已迁出·见 phase8-formal-rightrail.js (Wave 3·2026-05-26·1623 行) ──

  function installRightIssueStyles(){
    if (document.getElementById('tm-phase8-right-issue-style')) return;
    var st = document.createElement('style');
    st.id = 'tm-phase8-right-issue-style';
    st.textContent = [
      'body.tm-phase8-formal #tm-phase8-formal-panel{scrollbar-width:thin;scrollbar-color:rgba(201,168,95,.42) transparent;}',
      'body.tm-phase8-formal .tmrp-tabs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin:0 0 14px;}body.tm-phase8-formal .tmrp-tabs button{height:34px;border:1px solid rgba(201,168,95,.22);border-radius:2px;background:rgba(0,0,0,.22);color:rgba(232,220,187,.68);font-family:inherit;font-size:13px;letter-spacing:.18em;cursor:pointer;transition:color .18s,border-color .18s;}body.tm-phase8-formal .tmrp-tabs button:hover{color:#e7d39e;}body.tm-phase8-formal .tmrp-tabs button.active{border-color:rgba(213,103,73,.50);background:linear-gradient(180deg,rgba(104,42,30,.72),rgba(35,20,14,.86));color:#ffe1ac;}',
      'body.tm-phase8-formal .tmrp-issue-tabs{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:0 0 10px;}',
      'body.tm-phase8-formal .tmrp-issue-tabs button{height:32px;border:1px solid rgba(201,168,95,.22);background:rgba(0,0,0,.22);color:rgba(232,220,187,.68);font-family:inherit;letter-spacing:.18em;cursor:pointer;}',
      'body.tm-phase8-formal .tmrp-issue-tabs button.active{border-color:rgba(213,103,73,.50);background:linear-gradient(180deg,rgba(104,42,30,.72),rgba(35,20,14,.86));color:#ffe1ac;}',
      'body.tm-phase8-formal .tmrp-issue-shell{display:flex;flex-direction:column;gap:13px;color:#eadfbd;font-family:"STKaiti","KaiTi","楷体",serif;}',
      'body.tm-phase8-formal .tmrp-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));position:relative;border:1px solid rgba(201,168,95,.22);background:linear-gradient(180deg,rgba(255,245,210,.06),rgba(0,0,0,.22));overflow:hidden;}body.tm-phase8-formal .tmrp-summary:before,body.tm-phase8-formal .tmrp-summary:after{content:"";position:absolute;left:8px;right:8px;height:1px;background:linear-gradient(90deg,transparent,rgba(201,168,95,.45),transparent);}body.tm-phase8-formal .tmrp-summary:before{top:0;}body.tm-phase8-formal .tmrp-summary:after{bottom:0;}body.tm-phase8-formal .tmrp-summary.cols4{grid-template-columns:repeat(4,minmax(0,1fr));}',
      'body.tm-phase8-formal .tmrp-stat{min-height:60px;position:relative;border:0;background:transparent;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:14px 4px 13px;}body.tm-phase8-formal .tmrp-stat+.tmrp-stat:before{content:"";position:absolute;left:0;top:22%;bottom:22%;width:1px;background:linear-gradient(180deg,transparent,rgba(201,168,95,.28),transparent);}',
      'body.tm-phase8-formal .tmrp-stat b{color:#f2d98d;font-size:20px;line-height:1;font-variant-numeric:tabular-nums;letter-spacing:.02em;white-space:nowrap;text-shadow:0 1px 4px rgba(0,0,0,.5);}body.tm-phase8-formal .tmrp-stat span{margin-top:7px;color:rgba(232,220,187,.52);font-size:12px;letter-spacing:.12em;}',
      'body.tm-phase8-formal .tmrp-card{border:1px solid rgba(201,168,95,.18);background:linear-gradient(180deg,rgba(255,245,210,.05),rgba(0,0,0,.18));padding:12px;box-sizing:border-box;box-shadow:inset 0 1px 0 rgba(255,238,186,.04);}',
      'body.tm-phase8-formal .tmrp-card.hot{border-color:rgba(198,78,55,.44);box-shadow:inset 3px 0 rgba(198,78,55,.32);}body.tm-phase8-formal .tmrp-card.empty{min-height:70px;display:flex;align-items:center;justify-content:center;}',
      'body.tm-phase8-formal .tmrp-card-title{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:10px;}body.tm-phase8-formal .tmrp-card-title>span:first-child:before{content:"";display:inline-block;width:5px;height:5px;margin-right:7px;background:#c85e49;transform:rotate(45deg);vertical-align:middle;box-shadow:0 0 5px rgba(200,94,73,.5);}body.tm-phase8-formal .tmrp-card-title span{color:#f2d98d;font-size:14px;letter-spacing:.14em;}body.tm-phase8-formal .tmrp-card-title small{color:rgba(232,220,187,.48);font-size:11px;text-align:right;line-height:1.35;}body.tm-phase8-formal .tmrp-card-title.slim{margin-top:10px;border-top:1px solid rgba(201,168,95,.12);padding-top:8px;}',
      'body.tm-phase8-formal .tmrp-scroll{max-height:360px;overflow:auto;scrollbar-width:thin;scrollbar-color:rgba(201,168,95,.42) transparent;}body.tm-phase8-formal .tmrp-scroll.compact{max-height:224px;display:flex;flex-direction:column;gap:6px;padding-right:2px;}body.tm-phase8-formal .tmrp-scroll.logs{max-height:180px;}',
      'body.tm-phase8-formal .tmrp-person{width:100%;display:grid;grid-template-columns:34px minmax(0,1fr) 42px;align-items:center;gap:8px;text-align:left;border:1px solid rgba(201,168,95,.16);background:rgba(0,0,0,.18);color:#eadfbd;padding:7px;cursor:pointer;font-family:inherit;}body.tm-phase8-formal .tmrp-person.active{border-color:rgba(213,103,73,.50);background:linear-gradient(90deg,rgba(114,45,31,.42),rgba(0,0,0,.16));}body.tm-phase8-formal .tmrp-person b{display:block;color:#f2d98d;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}body.tm-phase8-formal .tmrp-person span span{display:block;margin-top:2px;color:rgba(232,220,187,.52);font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}body.tm-phase8-formal .tmrp-person small{color:rgba(141,189,171,.86);font-size:11px;text-align:right;}',
      'body.tm-phase8-formal .tmrp-avatar{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;border:1px solid rgba(201,168,95,.34);background:radial-gradient(circle at 35% 24%,rgba(255,229,153,.25),rgba(73,43,20,.80));color:#f2d98d;font-size:13px;overflow:hidden;}body.tm-phase8-formal .tmrp-avatar img{width:100%;height:100%;object-fit:cover;display:block;}',
      'body.tm-phase8-formal .tmrp-wendui .tmrp-avatar{width:38px;height:46px;border-radius:4px;border-color:rgba(201,168,95,.38);background:linear-gradient(180deg,rgba(74,44,21,.88),rgba(12,8,6,.96));}body.tm-phase8-formal .tmrp-wendui .tmrp-avatar img{object-position:50% 18%;}',
      'body.tm-phase8-formal .tmrp-wd-rules{display:grid;gap:6px;}body.tm-phase8-formal .tmrp-wd-rules div:not(.tmrp-card-title){display:grid;grid-template-columns:68px minmax(0,1fr);gap:8px;border:1px solid rgba(201,168,95,.12);background:rgba(0,0,0,.12);padding:6px 8px;}body.tm-phase8-formal .tmrp-wd-rules b{color:#f2d98d;font-size:12px;font-weight:500;}body.tm-phase8-formal .tmrp-wd-rules span{color:rgba(232,220,187,.62);font-size:12px;line-height:1.45;}body.tm-phase8-formal .tmrp-wd-rules>summary{list-style:none;cursor:pointer;display:flex;align-items:baseline;justify-content:space-between;gap:8px;}body.tm-phase8-formal .tmrp-wd-rules>summary::-webkit-details-marker{display:none;}body.tm-phase8-formal .tmrp-wd-rules>summary span{color:#f2d98d;font-size:13px;letter-spacing:.14em;}body.tm-phase8-formal .tmrp-wd-rules>summary span:before{content:"\\203B";margin-right:7px;color:rgba(213,103,73,.78);font-size:12px;}body.tm-phase8-formal .tmrp-wd-rules>summary small{color:rgba(232,220,187,.46);font-size:11px;letter-spacing:.02em;}body.tm-phase8-formal .tmrp-wd-rules[open]>summary{margin-bottom:2px;}body.tm-phase8-formal .tmrp-issue-foot{text-align:center;opacity:.78;font-size:11.5px;letter-spacing:.06em;}',
      'body.tm-phase8-formal .tmrp-wd-group .tmrp-card-title span{letter-spacing:.18em;}body.tm-phase8-formal .tmrp-wd-list{display:flex;flex-direction:column;gap:7px;}body.tm-phase8-formal .tmrp-wd-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px;}body.tm-phase8-formal .tmrp-wd-away{display:flex;flex-direction:column;gap:6px;max-height:230px;overflow:auto;padding-right:2px;}',
      'body.tm-phase8-formal .tmrp-wd-person{min-width:0;width:100%;display:grid;grid-template-columns:42px minmax(0,1fr);grid-template-rows:auto auto;gap:5px 8px;text-align:left;border:1px solid rgba(201,168,95,.16);background:rgba(0,0,0,.18);color:#eadfbd;padding:7px;cursor:pointer;font-family:inherit;}body.tm-phase8-formal .tmrp-wd-person:hover{border-color:rgba(226,185,92,.48);background:linear-gradient(90deg,rgba(106,43,30,.30),rgba(0,0,0,.14));}body.tm-phase8-formal .tmrp-wd-person.loyal-hi{box-shadow:inset 3px 0 rgba(141,189,171,.46);}body.tm-phase8-formal .tmrp-wd-person.loyal-lo{box-shadow:inset 3px 0 rgba(198,78,55,.46);}body.tm-phase8-formal .tmrp-wd-person.has-hist:after{content:"";position:absolute;}',
      'body.tm-phase8-formal .tmrp-wd-person .tmrp-avatar{grid-row:1/3;}body.tm-phase8-formal .tmrp-wd-person .main{min-width:0;}body.tm-phase8-formal .tmrp-wd-person b{display:block;color:#f2d98d;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}body.tm-phase8-formal .tmrp-wd-person b i{font-style:normal;color:#d56b55;margin-left:3px;}body.tm-phase8-formal .tmrp-wd-person small{display:block;color:rgba(232,220,187,.50);font-size:11px;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}body.tm-phase8-formal .tmrp-wd-person .meta{grid-column:2;display:flex;gap:4px;flex-wrap:wrap;}body.tm-phase8-formal .tmrp-wd-person .meta em{font-style:normal;border:1px solid rgba(201,168,95,.14);background:rgba(201,168,95,.05);color:#d8c27c;font-size:11px;line-height:1;padding:3px 5px;}',
      'body.tm-phase8-formal .tmrp-wd-request{display:grid;grid-template-columns:minmax(0,1fr) 46px;gap:6px;align-items:stretch;border:1px solid rgba(201,168,95,.16);background:rgba(0,0,0,.16);padding:6px;}body.tm-phase8-formal .tmrp-wd-request.envoy{border-color:rgba(141,189,171,.28);}body.tm-phase8-formal .tmrp-wd-request-main{min-width:0;display:grid;grid-template-columns:42px minmax(0,1fr);gap:8px;align-items:center;text-align:left;border:0;background:transparent;color:#eadfbd;font-family:inherit;padding:0;cursor:pointer;}body.tm-phase8-formal .tmrp-wd-request-main b{display:block;color:#f2d98d;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}body.tm-phase8-formal .tmrp-wd-request-main b i{font-style:normal;color:#8dbdab;margin-left:5px;font-size:11px;}body.tm-phase8-formal .tmrp-wd-request-main small{display:block;color:rgba(232,220,187,.58);font-size:12px;line-height:1.45;margin-top:2px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}',
      'body.tm-phase8-formal .tmrp-wd-mini{border:1px solid rgba(201,168,95,.20);background:rgba(18,13,10,.74);color:#e7d39e;font-family:inherit;font-size:12px;cursor:pointer;}body.tm-phase8-formal .tmrp-wd-mini.danger{border-color:rgba(198,78,55,.30);color:#e7a38c;}',
      'body.tm-phase8-formal .tmrp-mini-grid,body.tm-phase8-formal .tmrp-rows{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;}body.tm-phase8-formal .tmrp-mini-grid div,body.tm-phase8-formal .tmrp-rows div{border:1px solid rgba(201,168,95,.12);background:rgba(0,0,0,.12);padding:7px;min-width:0;}body.tm-phase8-formal .tmrp-mini-grid span,body.tm-phase8-formal .tmrp-rows span{display:block;color:rgba(232,220,187,.48);font-size:11.5px;}body.tm-phase8-formal .tmrp-mini-grid b,body.tm-phase8-formal .tmrp-rows b{display:block;margin-top:3px;color:#eadfbd;font-size:12px;font-weight:400;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      'body.tm-phase8-formal .tmrp-meta{margin:7px 0;color:rgba(232,220,187,.66);font-size:12px;line-height:1.65;}',
      'body.tm-phase8-formal .tmrp-social-head{cursor:pointer;}body.tm-phase8-formal .tmrp-social-head:hover{border-color:rgba(226,185,92,.42);background:linear-gradient(180deg,rgba(96,44,30,.34),rgba(0,0,0,.16));}body.tm-phase8-formal .tmrp-detail-hint{margin-top:8px;border-top:1px solid rgba(201,168,95,.12);padding-top:7px;color:rgba(141,189,171,.78);font-size:12px;letter-spacing:.04em;}body.tm-phase8-formal .tm-social-detail-flyout{width:396px;}',
      'body.tm-phase8-formal .tmrp-social-cause{display:grid;gap:5px;margin:8px 0;padding:7px 8px;border:1px solid rgba(201,168,95,.12);background:rgba(0,0,0,.14);min-width:0;}body.tm-phase8-formal .tmrp-social-cause b{color:#f2d98d;font-size:12px;font-weight:500;letter-spacing:.08em;}body.tm-phase8-formal .tmrp-social-cause span{display:block;color:rgba(232,220,187,.66);font-size:12px;line-height:1.45;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}body.tm-phase8-formal .tmrp-social-cause.empty span{color:rgba(232,220,187,.42);}',
      'body.tm-phase8-formal .tmrp-signal-cause .tmrp-cause-row{display:grid;grid-template-columns:auto minmax(0,1fr);gap:6px;align-items:center;}body.tm-phase8-formal .tmrp-signal-cause .tmrp-cause-source{color:#f2d98d;font-style:normal;font-size:11.5px;white-space:nowrap;}body.tm-phase8-formal .tmrp-signal-cause small{min-width:0;color:rgba(232,220,187,.66);font-size:12px;line-height:1.45;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      'body.tm-phase8-formal .tmrp-ecology{display:grid;gap:6px;margin:8px 0;padding:7px 8px;border:1px solid rgba(141,189,171,.18);background:linear-gradient(180deg,rgba(141,189,171,.055),rgba(0,0,0,.14));min-width:0;}body.tm-phase8-formal .tmrp-ecology-head{display:flex;align-items:center;justify-content:space-between;gap:8px;}body.tm-phase8-formal .tmrp-ecology-head b{color:#f2d98d;font-size:12px;font-weight:500;letter-spacing:.08em;}body.tm-phase8-formal .tmrp-ecology-head small{color:rgba(141,189,171,.72);font-size:11px;}body.tm-phase8-formal .tmrp-ecology-list,body.tm-phase8-formal .tmrp-ecology-signals{display:grid;gap:5px;min-width:0;}body.tm-phase8-formal .tmrp-ecology-edge{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:3px 6px;border:1px solid rgba(201,168,95,.12);background:rgba(0,0,0,.16);padding:6px;min-width:0;}body.tm-phase8-formal .tmrp-ecology-edge.estranged{border-color:rgba(198,78,55,.26);box-shadow:inset 2px 0 rgba(198,78,55,.32);}body.tm-phase8-formal .tmrp-ecology-link{min-width:0;border:0;background:transparent;color:#ffe1ac;text-align:left;font-family:inherit;font-size:11.5px;padding:0;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}body.tm-phase8-formal .tmrp-ecology-edge span{color:rgba(141,189,171,.86);font-size:11px;text-align:right;white-space:nowrap;}body.tm-phase8-formal .tmrp-ecology-edge small{grid-column:1/3;color:rgba(232,220,187,.64);font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}body.tm-phase8-formal .tmrp-ecology-edge em{grid-column:1/3;color:rgba(232,220,187,.45);font-style:normal;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}body.tm-phase8-formal .tmrp-ecology-forecast{grid-column:1/3;color:rgba(232,220,187,.70);font-size:11.5px;line-height:1.45;border-left:2px solid rgba(141,189,171,.42);padding-left:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}body.tm-phase8-formal .tmrp-ecology-signal{display:grid;grid-template-columns:auto minmax(0,1fr);gap:6px;align-items:center;color:rgba(232,220,187,.58);font-size:11.5px;min-width:0;}body.tm-phase8-formal .tmrp-ecology-signal b{color:#d8c27c;font-weight:400;white-space:nowrap;}body.tm-phase8-formal .tmrp-ecology-signal span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      'body.tm-phase8-formal .tmrp-social-chain{display:flex;flex-wrap:wrap;gap:5px;margin:7px 0 2px;min-width:0;}body.tm-phase8-formal .tmrp-chain-step{max-width:100%;min-height:24px;border:1px solid rgba(201,168,95,.16);background:rgba(201,168,95,.055);color:rgba(232,220,187,.72);padding:3px 6px;font-family:inherit;font-size:11.5px;line-height:1.25;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}body.tm-phase8-formal .tmrp-chain-step:hover{border-color:rgba(226,185,92,.42);background:rgba(126,45,32,.24);color:#ffe1ac;}',
      'body.tm-phase8-formal .tmrp-actor-action{display:grid;gap:5px;margin:8px 0;padding:7px 8px;border:1px solid rgba(141,189,171,.18);background:rgba(141,189,171,.055);min-width:0;}body.tm-phase8-formal .tmrp-actor-action b{color:#8dbdab;font-size:12px;font-weight:500;letter-spacing:.08em;}body.tm-phase8-formal .tmrp-actor-action span{display:grid;grid-template-columns:auto minmax(0,1fr);gap:6px;align-items:center;min-width:0;}body.tm-phase8-formal .tmrp-actor-action em{color:#f2d98d;font-style:normal;font-size:11.5px;white-space:nowrap;}body.tm-phase8-formal .tmrp-actor-action small{min-width:0;color:rgba(232,220,187,.66);font-size:12px;line-height:1.45;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      'body.tm-phase8-formal .tmrp-pcdebug{display:grid;gap:8px;}body.tm-phase8-formal .tmrp-pcdebug-section{min-width:0;}body.tm-phase8-formal .tmrp-pcdebug-list{display:grid;gap:6px;max-height:230px;overflow:auto;padding-right:2px;}body.tm-phase8-formal .tmrp-pcdebug-row{display:grid;gap:4px;border:1px solid rgba(201,168,95,.12);background:rgba(0,0,0,.16);padding:7px;min-width:0;}body.tm-phase8-formal .tmrp-pcdebug-row b{color:#f2d98d;font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}body.tm-phase8-formal .tmrp-pcdebug-row span{color:rgba(232,220,187,.66);font-size:12px;line-height:1.45;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}body.tm-phase8-formal .tmrp-pcdebug-tags{display:flex;flex-wrap:wrap;gap:4px;min-width:0;}body.tm-phase8-formal .tmrp-pcdebug-tag{font-style:normal;border:1px solid rgba(201,168,95,.14);background:rgba(201,168,95,.05);color:#d8c27c;font-size:11px;line-height:1;padding:3px 5px;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}body.tm-phase8-formal .tmrp-pcdebug-entry{margin:6px 0;}body.tm-phase8-formal .tmrp-pcdebug-copy{border-color:rgba(141,189,171,.22);background:rgba(141,189,171,.055);}body.tm-phase8-formal .tmrp-pcdebug-copy .tmrp-action-row{margin-top:0;}body.tm-phase8-formal .tmrp-pcdebug-copy small{color:rgba(232,220,187,.58);}',
      'body.tm-phase8-formal .tmrp-bar{display:grid;grid-template-columns:58px minmax(0,1fr) 32px;align-items:center;gap:9px;margin:9px 0;font-size:11.5px;color:rgba(232,220,187,.66);}body.tm-phase8-formal .tmrp-bar i{height:7px;border-radius:4px;background:rgba(0,0,0,.34);border:1px solid rgba(201,168,95,.14);overflow:hidden;}body.tm-phase8-formal .tmrp-bar i b{display:block;height:100%;border-radius:4px;background:linear-gradient(90deg,#8dbdab,#f2d98d 60%,#c85e49);}body.tm-phase8-formal .tmrp-bar em{font-style:normal;text-align:right;color:#e7d39e;font-variant-numeric:tabular-nums;}',
      'body.tm-phase8-formal .tmrp-action-row{display:flex;flex-wrap:wrap;gap:7px;margin-top:11px;}body.tm-phase8-formal .tmrp-action-row.fine{gap:6px;}',
      'body.tm-phase8-formal .tmrp-social-actions{margin-top:7px;}body.tm-phase8-formal .tmrp-social-actions .tmrp-btn{font-size:12px;min-height:27px;padding:5px 7px;}',
      'body.tm-phase8-formal .tmrp-btn{min-height:32px;border:1px solid rgba(201,168,95,.24);border-radius:2px;background:rgba(18,13,10,.74);color:#eadfbd;padding:6px 11px;font-family:inherit;cursor:pointer;font-size:12.5px;letter-spacing:.04em;transition:border-color .18s,color .18s,background .18s;}body.tm-phase8-formal .tmrp-btn:hover{border-color:rgba(226,185,92,.5);color:#f2d98d;}body.tm-phase8-formal .tmrp-btn.primary{border-color:rgba(213,103,73,.52);background:linear-gradient(180deg,rgba(126,45,32,.84),rgba(58,25,18,.92));color:#ffe1ac;}body.tm-phase8-formal .tmrp-btn.primary:hover{border-color:rgba(232,140,110,.7);color:#ffe7c8;}body.tm-phase8-formal .tmrp-btn:disabled{opacity:.42;cursor:not-allowed;}',
      'body.tm-phase8-formal .tmrp-textarea,body.tm-phase8-formal .tmrp-input{width:100%;box-sizing:border-box;border:1px solid rgba(201,168,95,.20);background:rgba(0,0,0,.24);color:#eadfbd;padding:8px;font-family:inherit;}body.tm-phase8-formal .tmrp-textarea{min-height:82px;resize:vertical;line-height:1.65;margin-top:8px;}',
      'body.tm-phase8-formal .tmrp-mode-grid{display:grid;grid-template-columns:1fr;gap:7px;margin-top:8px;}body.tm-phase8-formal .tmrp-mode-card{text-align:left;border:1px solid rgba(201,168,95,.16);background:rgba(0,0,0,.18);color:#eadfbd;padding:9px;font-family:inherit;cursor:pointer;}body.tm-phase8-formal .tmrp-mode-card.active{border-color:rgba(213,103,73,.50);background:linear-gradient(90deg,rgba(106,43,30,.54),rgba(0,0,0,.16));}body.tm-phase8-formal .tmrp-mode-card b{display:block;color:#f2d98d;font-size:14px;}body.tm-phase8-formal .tmrp-mode-card span{display:block;margin-top:4px;color:rgba(232,220,187,.58);font-size:12px;line-height:1.45;}',
      'body.tm-phase8-formal .tmrp-chaoyi-scenes{display:grid;grid-template-rows:repeat(3,minmax(112px,1fr));gap:8px;margin-top:8px;}',
      'body.tm-phase8-formal .tmrp-chaoyi-card{position:relative;min-height:116px;border:1px solid rgba(204,164,76,.24);background:#111;overflow:hidden;text-align:left;color:#eadfbd;cursor:pointer;font-family:inherit;padding:0;}',
      'body.tm-phase8-formal .tmrp-chaoyi-card img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:saturate(.92) contrast(1.04) brightness(.72);transform:scale(1.015);transition:transform .18s ease,filter .18s ease;}',
      'body.tm-phase8-formal .tmrp-chaoyi-card:before{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(7,5,4,.88),rgba(18,11,7,.46) 48%,rgba(7,5,4,.20));}',
      'body.tm-phase8-formal .tmrp-chaoyi-card:after{content:"";position:absolute;inset:5px;border:1px solid rgba(238,210,134,.18);pointer-events:none;}',
      'body.tm-phase8-formal .tmrp-chaoyi-card:hover img,body.tm-phase8-formal .tmrp-chaoyi-card.active img{filter:saturate(1.02) contrast(1.08) brightness(.86);transform:scale(1.045);}',
      'body.tm-phase8-formal .tmrp-chaoyi-card.active{border-color:rgba(226,185,92,.62);box-shadow:0 0 0 1px rgba(226,185,92,.16),inset 0 0 22px rgba(213,103,73,.14);}',
      'body.tm-phase8-formal .tmrp-chaoyi-card .txt{position:relative;z-index:1;display:block;padding:13px 14px;width:68%;box-sizing:border-box;}',
      'body.tm-phase8-formal .tmrp-chaoyi-card b{display:block;color:#ffe0a0;font-size:21px;letter-spacing:.18em;text-shadow:0 1px 4px rgba(0,0,0,.75);}',
      'body.tm-phase8-formal .tmrp-chaoyi-card span span{display:block;margin-top:5px;color:rgba(243,229,194,.78);font-size:12px;line-height:1.55;}',
      'body.tm-phase8-formal .tmrp-chaoyi-card small{display:inline-flex;margin-top:7px;border:1px solid rgba(204,164,76,.28);background:rgba(0,0,0,.34);color:#f3d98d;padding:2px 7px;font-size:12px;letter-spacing:.08em;}',
      'body.tm-phase8-formal .tmrp-army-shell{display:flex;flex-direction:column;gap:13px;color:#eadfbd;font-family:"STKaiti","KaiTi","楷体",serif;}',
      'body.tm-phase8-formal .tmrp-army-list .tmrp-person{grid-template-columns:34px minmax(0,1fr) 74px;}',
      'body.tm-phase8-formal .tmrp-ledger-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:7px 0 5px;padding:5px 7px;border:1px solid rgba(201,168,95,.14);background:linear-gradient(90deg,rgba(201,168,95,.08),rgba(0,0,0,.16));}',
      'body.tm-phase8-formal .tmrp-ledger-head span{color:#f2d98d;font-size:12px;letter-spacing:.14em;}body.tm-phase8-formal .tmrp-ledger-head small{color:rgba(232,220,187,.48);font-size:11px;}',
      'body.tm-phase8-formal .tmrp-data-table{width:100%;border-collapse:collapse;margin-top:9px;font-size:11.5px;color:#eadfbd;}body.tm-phase8-formal .tmrp-data-table th,body.tm-phase8-formal .tmrp-data-table td{border:1px solid rgba(201,168,95,.14);padding:6px 7px;text-align:left;vertical-align:top;}body.tm-phase8-formal .tmrp-data-table th{color:#d8c27c;background:rgba(201,168,95,.06);font-weight:400;}body.tm-phase8-formal .tmrp-data-table td:first-child{width:72px;color:rgba(232,220,187,.56);}',
      'body.tm-phase8-formal .tm-army-detail-flyout{position:fixed;right:452px;top:188px;width:372px;max-height:calc(100vh - 220px);overflow:auto;z-index:4998;border:1px solid rgba(201,168,95,.36);background:linear-gradient(180deg,rgba(30,22,15,.98),rgba(9,7,5,.97));box-shadow:0 20px 60px rgba(0,0,0,.48),inset 0 0 0 1px rgba(255,235,173,.04);padding:10px;box-sizing:border-box;color:#eadfbd;}',
      'body.tm-phase8-formal .tm-army-detail-head{display:flex;align-items:center;justify-content:space-between;margin:-2px 0 8px;padding-bottom:8px;border-bottom:1px solid rgba(201,168,95,.18);}body.tm-phase8-formal .tm-army-detail-head b{color:#f2d98d;font-size:15px;letter-spacing:.16em;}body.tm-phase8-formal .tm-army-detail-head button{width:28px;height:28px;border:1px solid rgba(201,168,95,.22);background:rgba(0,0,0,.22);color:#eadfbd;cursor:pointer;}',
      'body.tm-phase8-formal .tmrp-office-shell{display:flex;flex-direction:column;gap:13px;color:#eadfbd;font-family:"STKaiti","KaiTi","楷体",serif;}body.tm-phase8-formal .tmrp-scroll.tall{max-height:520px;overflow:auto;padding-right:2px;}',
      'body.tm-phase8-formal .tmrp-office-node{border:1px solid rgba(201,168,95,.16);background:rgba(0,0,0,.14);margin:0 0 8px;padding:0 9px 9px;}body.tm-phase8-formal .tmrp-office-node summary{cursor:pointer;list-style:none;padding:9px 0;color:#f2d98d;font-size:13px;letter-spacing:.10em;}body.tm-phase8-formal .tmrp-office-node summary::-webkit-details-marker{display:none;}body.tm-phase8-formal .tmrp-office-node summary small{float:right;color:rgba(232,220,187,.48);font-size:11px;letter-spacing:.04em;}',
      'body.tm-phase8-formal .tmrp-office-pos{border:1px solid rgba(201,168,95,.12);background:rgba(255,245,210,.035);padding:8px;margin:7px 0;}body.tm-phase8-formal .tmrp-office-pos>b{display:block;color:#f2d98d;font-size:13px;margin-bottom:5px;}body.tm-phase8-formal .tmrp-office-pos .tmrp-pill{margin:0 4px 5px 0;}',
      'body.tm-phase8-formal .tmrp-admin-shell{display:flex;flex-direction:column;gap:13px;color:#eadfbd;font-family:"STKaiti","KaiTi","楷体",serif;}body.tm-phase8-formal .tmrp-admin-card{box-shadow:inset 3px 0 var(--admin-c,rgba(201,168,95,.42));}body.tm-phase8-formal .tmrp-admin-title{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:8px;}body.tm-phase8-formal .tmrp-admin-title b{color:#f2d98d;font-size:15px;letter-spacing:.12em;}body.tm-phase8-formal .tmrp-admin-title small{color:rgba(232,220,187,.50);font-size:11px;text-align:right;line-height:1.45;}',
      'body.tm-phase8-formal .tmrp-step{border-left:2px solid rgba(198,78,55,.55);padding:5px 0 5px 8px;margin:5px 0;color:rgba(232,220,187,.68);font-size:11.5px;line-height:1.5;}body.tm-phase8-formal .tmrp-step b{color:#f2d98d;margin-right:6px;}',
      'body.tm-phase8-formal .tmrp-finance-shell{display:flex;flex-direction:column;gap:13px;color:#eadfbd;font-family:"STKaiti","KaiTi","楷体",serif;}body.tm-phase8-formal .tmrp-fin-line{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px;border:1px solid rgba(201,168,95,.12);background:rgba(0,0,0,.14);padding:7px;margin:6px 0;}body.tm-phase8-formal .tmrp-fin-line b{min-width:0;color:#f2d98d;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}body.tm-phase8-formal .tmrp-fin-line span{color:#eadfbd;font-size:12px;}body.tm-phase8-formal .tmrp-fin-line small{grid-column:1/3;color:rgba(232,220,187,.52);font-size:11.5px;line-height:1.45;}',
      'body.tm-phase8-formal .tmrp-wenshi-shell{display:flex;flex-direction:column;gap:13px;color:#eadfbd;font-family:"STKaiti","KaiTi","楷体",serif;}body.tm-phase8-formal .tmrp-work-card{display:grid;grid-template-columns:42px minmax(0,1fr);gap:9px;}body.tm-phase8-formal .tmrp-work-tab{min-height:74px;border:1px solid rgba(201,168,95,.20);background:linear-gradient(180deg,rgba(201,168,95,.12),rgba(0,0,0,.18));color:#f2d98d;display:flex;align-items:center;justify-content:center;writing-mode:vertical-rl;letter-spacing:.12em;font-size:12px;}body.tm-phase8-formal .tmrp-keju-hero{background:linear-gradient(135deg,rgba(206,169,87,.18),rgba(80,40,20,.12));border-color:rgba(206,169,87,.45);}body.tm-phase8-formal .tmrp-wen-filters .tmrp-pill{cursor:pointer;font-family:inherit;letter-spacing:.04em;transition:border-color .15s,color .15s,background .15s;}body.tm-phase8-formal .tmrp-wen-filters .tmrp-pill:hover{border-color:rgba(226,185,92,.42);color:#f2d98d;}body.tm-phase8-formal .tmrp-pill.active{border-color:rgba(213,103,73,.55);background:linear-gradient(180deg,rgba(126,45,32,.6),rgba(40,20,14,.5));color:#ffe1ac;}',
      'body.tm-phase8-formal .tmrp-minister-shell{display:flex;flex-direction:column;gap:13px;color:#eadfbd;font-family:"STKaiti","KaiTi","楷体",serif;}body.tm-phase8-formal .tmrp-minister-card{display:grid;grid-template-columns:52px minmax(0,1fr);gap:10px;}body.tm-phase8-formal .tmrp-minister-face .tmrp-avatar{width:48px;height:60px;border-radius:4px;}body.tm-phase8-formal .tmrp-minister-main{min-width:0;}body.tm-phase8-formal .tmrp-loy-tag{font-style:normal;font-weight:600;}body.tm-phase8-formal .tmrp-loy-tag.lo{color:#d56b55;}body.tm-phase8-formal .tmrp-loy-tag.mid{color:#d8c27c;}body.tm-phase8-formal .tmrp-loy-tag.hi{color:#8dbdab;}',
      '@media (max-width: 980px){body.tm-phase8-formal .tm-army-detail-flyout{right:12px;left:12px;top:108px;width:auto;max-height:calc(100vh - 150px);}}',
      'body.tm-phase8-formal .tmrp-chip-list,body.tm-phase8-formal .tmrp-pill-row{display:flex;flex-wrap:wrap;gap:5px;}body.tm-phase8-formal .tmrp-pill{display:inline-flex;max-width:100%;border:1px solid rgba(201,168,95,.16);background:rgba(201,168,95,.06);color:#d8c27c;padding:4px 7px;font-size:12px;line-height:1.25;}',
      // 社会层地基（2026-06-12）：满意趋势徽 + 议程急缓徽 + 满意/党势近账行
      'body.tm-phase8-formal .tmrp-trend{display:inline-block;margin-left:4px;font-style:normal;font-size:11px;padding:0 4px;border:1px solid rgba(201,168,95,.18);border-radius:2px;}body.tm-phase8-formal .tmrp-trend.up{color:#9fd08a;}body.tm-phase8-formal .tmrp-trend.down{color:#e08585;}',
      'body.tm-phase8-formal .tmrp-pill.tmrp-agenda.u2{border-color:rgba(240,200,120,.45);color:#f2d98d;}body.tm-phase8-formal .tmrp-pill.tmrp-agenda.u3{border-color:rgba(224,133,133,.55);color:#e08585;}body.tm-phase8-formal .tmrp-pill.tmrp-agenda small{margin-left:3px;opacity:.7;font-size:10.5px;}',
      'body.tm-phase8-formal .tmrp-ledger-row{display:flex;gap:7px;align-items:baseline;font-size:12px;line-height:1.6;min-width:0;}body.tm-phase8-formal .tmrp-ledger-row b{font-weight:600;min-width:40px;text-align:right;flex:none;}body.tm-phase8-formal .tmrp-ledger-row b.pos{color:#9fd08a;}body.tm-phase8-formal .tmrp-ledger-row b.neg{color:#e08585;}body.tm-phase8-formal .tmrp-ledger-row small{color:rgba(232,220,187,.66);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;}',
      'body.tm-phase8-formal .tmrp-warning-line{margin:8px 0;padding:7px 8px;border:1px solid rgba(198,78,55,.30);background:rgba(198,78,55,.10);color:#e7b59a;font-size:12px;line-height:1.55;}',
      'body.tm-phase8-formal .tmrp-log{display:grid;grid-template-columns:26px minmax(0,1fr) auto;gap:7px;align-items:start;border:1px solid rgba(201,168,95,.12);background:rgba(0,0,0,.14);padding:7px;}body.tm-phase8-formal .tmrp-log b{width:22px;height:22px;display:grid;place-items:center;border:1px solid rgba(201,168,95,.28);border-radius:50%;color:#f2d98d;font-size:12px;}body.tm-phase8-formal .tmrp-log span{color:rgba(232,220,187,.70);font-size:11.5px;line-height:1.55;}body.tm-phase8-formal .tmrp-log strong{color:#f2d98d;font-weight:500;}body.tm-phase8-formal .tmrp-log em{font-style:normal;color:#8dbdab;font-size:11px;white-space:nowrap;}body.tm-phase8-formal .tmrp-empty{padding:22px 16px;text-align:center;color:rgba(232,220,187,.48);font-size:12px;line-height:1.75;letter-spacing:.04em;}',
      'body.tm-phase8-formal .tmrp-empty-hero{text-align:center;padding:24px 16px 18px;border:1px dashed rgba(201,168,95,.26);border-radius:3px;background:radial-gradient(140px 90px at 50% 30%,rgba(201,168,95,.06),transparent);margin-bottom:14px;}body.tm-phase8-formal .tmrp-empty-seal{width:56px;height:56px;margin:0 auto 13px;display:grid;place-items:center;border:1.5px solid rgba(201,168,95,.34);border-radius:50%;color:#d8c27c;font-size:25px;font-family:"STKaiti","KaiTi","楷体",serif;background:radial-gradient(circle at 36% 26%,rgba(255,229,153,.16),rgba(30,22,12,.6));}body.tm-phase8-formal .tmrp-empty-t{color:#e7d39e;font-size:14px;letter-spacing:.1em;}body.tm-phase8-formal .tmrp-empty-d{margin-top:8px;color:rgba(232,220,187,.5);font-size:11.5px;line-height:1.8;}body.tm-phase8-formal .tmrp-empty-hero .tmrp-action-row{justify-content:center;margin-top:15px;}',
      'body.tm-phase8-formal .tmrp-ghost-label{text-align:center;color:rgba(232,220,187,.42);font-size:11.5px;letter-spacing:.16em;margin:2px 0 9px;}body.tm-phase8-formal .tmrp-ghost{opacity:.42;filter:grayscale(.25);pointer-events:none;display:flex;flex-direction:column;gap:8px;}'
    ].join('\n');
    document.head.appendChild(st);
  }

  function panelHost(){
    var panel = ensurePreviewPanelHost();
    if (!panel) return null;
    var host = panel.querySelector('#tm-phase8-formal-panel');
    if (!host) {
      host = document.createElement('div');
      host.id = 'tm-phase8-formal-panel';
      host.className = 'rp-body';
      panel.appendChild(host);
    }
    return host;
  }

  function openPanel(slot){
    if (!syncFormalShellVisibility()) return;
    if (slot === 'archive') {
      openOfficeStandalone();
      return;
    }
    var rr = (window.TMPhase8FormalBridge && TMPhase8FormalBridge.rightrail) || {};
    var renderers = rr.renderers || {};
    var titles = rr.titles || {};
    if (!renderers[slot]) return;
    clearOfficeStandaloneMode();
    if (slot !== 'army' && rr.rightCloseArmyFlyout) rr.rightCloseArmyFlyout();
    if (slot !== 'ol' && rr.rightCloseSocialFlyout) rr.rightCloseSocialFlyout();
    state.activeSlot = slot;
    installStyles();
    installRightIssueStyles();
    ensureRail();
    updateRailActive();
    var host = panelHost();
    var panel = document.getElementById('rpanel');
    if (!panel || !host) return;
    var title = panel.querySelector('#rp-title');
    if (title) title.textContent = titles[slot] || '国事';
    host.innerHTML = '<div class="tmrp tmrp-formal tmf-panel" data-panel="' + esc(slot) + '">' + renderers[slot]() + '</div>';
    if (rr.bindRightPanelActions) rr.bindRightPanelActions(host);
    panel.classList.add('show', 'tm-right-expanded');
    var drawer = document.getElementById('drawerRight');
    if (drawer) drawer.classList.remove('open');
  }

  function refreshActivePanel(){
    var slot = state.activeSlot;
    var rr = (window.TMPhase8FormalBridge && TMPhase8FormalBridge.rightrail) || {};
    var renderers = rr.renderers || {};
    var titles = rr.titles || {};
    if (!slot || !renderers[slot]) return false;
    var panel = document.getElementById('rpanel');
    if (!panel || !panel.classList.contains('show')) return false;
    var host = panelHost();
    if (!host) return false;
    var title = panel.querySelector('#rp-title');
    if (title) title.textContent = titles[slot] || '国事';
    host.innerHTML = '<div class="tmrp tmrp-formal tmf-panel" data-panel="' + esc(slot) + '">' + renderers[slot]() + '</div>';
    if (rr.bindRightPanelActions) rr.bindRightPanelActions(host);
    if (slot === 'army' && rr.refreshArmyFlyout) rr.refreshArmyFlyout();
    if (slot === 'ol' && rr.refreshSocialFlyout) rr.refreshSocialFlyout();
    return true;
  }

  function closeRightDrawer(){
    var rr = (window.TMPhase8FormalBridge && TMPhase8FormalBridge.rightrail) || {};
    if (rr.rightCloseArmyFlyout) rr.rightCloseArmyFlyout();
    if (rr.rightCloseSocialFlyout) rr.rightCloseSocialFlyout();
    var panel = document.getElementById('rpanel');
    if (panel) panel.classList.remove('show', 'tm-right-expanded');
    var drawer = document.getElementById('drawerRight');
    if (drawer) drawer.classList.remove('open');
    state.activeSlot = '';
    updateRailActive();
  }

  function updateRailActive(){
    document.querySelectorAll('#tm-phase8-formal-rail .tmf-rail-btn,#tm-right-rail .tm-rc-icon').forEach(function(btn){
      btn.classList.toggle('active', btn.dataset.slot === state.activeSlot);
    });
  }

  // 右栏徽标动态计数槽·经 updateRailBadges 填真值(廉价标量·待批奏疏/未决议题/军情预警/近事)·非此列表的槽保持静态或无数字
  var RAIL_DYNAMIC_BADGE_SLOTS = { ol:1, issue:1, army:1, rumor:1 };
  function railDynamicBadgeCount(slot){
    try {
      if (slot === 'ol') return getMemorials().filter(function(m){ return !m.status || m.status === 'pending'; }).length;
      if (slot === 'issue') return getIssues().filter(function(x){ return !issueIsResolved(x); }).length;
      if (slot === 'army') { var g = window.GM || {}; return Array.isArray(g._junqingBrief) ? g._junqingBrief.length : 0; }
      if (slot === 'rumor') return collectRecentEvents().length;
    } catch(_) {}
    return 0;
  }
  function updateRailBadges(){
    var n = (state.pinnedPeople || []).length;
    document.querySelectorAll('[data-phase8-badge="pinned"]').forEach(function(el){
      el.textContent = n;
      el.style.display = n ? '' : 'none';
    });
    ['ol','issue','army','rumor'].forEach(function(slot){
      var c = railDynamicBadgeCount(slot);
      document.querySelectorAll('[data-phase8-badge="' + slot + '"]').forEach(function(el){
        el.textContent = c;
        el.style.display = c ? '' : 'none';
      });
    });
  }

  function bindFormalEntryRedirects(){
    var routes = [
      ['#gs-shizheng-btn', openShizhengLegacyFlow],
      ['.gs-turn-fab-bar .gs-fab-btn:nth-child(1)', function(){ var dr=(window.TMPhase8FormalBridge||{}).drafts; if (dr) dr.openZhaoPreviewPanel(); }],
      ['.gs-turn-fab-bar .gs-fab-btn:nth-child(2)', function(){ var dr=(window.TMPhase8FormalBridge||{}).drafts; if (dr) dr.openHongyanPreviewPanel(); }],
      ['.gs-turn-fab-bar .gs-fab-btn:nth-child(3)', function(){ openModule('wendui'); }],
      ['.gs-turn-fab-bar .gs-fab-btn:nth-child(4)', function(){ openModule('chaoyi'); }],
      ['.gs-turn-fab-bar .gs-fab-btn:nth-child(5)', function(){ var dr=(window.TMPhase8FormalBridge||{}).drafts; if (dr) dr.openYueZouPreviewPanel(); }],
      ['.gs-turn-fab-bar .gs-fab-btn:nth-child(6)', function(){ var dr=(window.TMPhase8FormalBridge||{}).drafts; if (dr) dr.openShiluPreviewPanel(); }]
    ];
    routes.forEach(function(route){
      document.querySelectorAll(route[0]).forEach(function(el){
        if (el.__phase8FormalRedirect) return;
        el.__phase8FormalRedirect = true;
        el.onclick = function(ev){
          if (ev) {
            ev.preventDefault();
            ev.stopPropagation();
          }
          route[1]();
          return false;
        };
      });
    });
  }

  function ensureRail(){
    if (!syncFormalShellVisibility()) return;
    var root = document.querySelector('.gs-rail-right');
    if (!root) return;
    var old = root.querySelector('.gs-rail');
    if (old) old.style.display = 'none';
    var rail = document.getElementById('tm-phase8-formal-rail');
    if (!rail) {
      rail = document.createElement('div');
      rail.id = 'tm-phase8-formal-rail';
      root.appendChild(rail);
    }
    var buttons = [
      ['ol','纲','纲纪总览','6','hot'],
      ['issue','政','问对与朝会','3','hot'],
      ['policy','文','文事与科举','',''],
      ['office','臣','钉选臣僚','pin',''],
      ['army','军','军务边防','2','hot'],
      ['map','图','舆图政区','',''],
      ['finance','户','户部财计','','ok'],
      ['rumor','闻','风闻情报','4',''],
      ['archive','制','官制衙门','','']
    ];
    rail.innerHTML = '<div class="tmf-rail-cap">国事</div>' + buttons.map(function(b){
      var badge = b[3] === 'pin'
        ? '<span class="tmf-rail-count" data-phase8-badge="pinned"></span>'
        : (RAIL_DYNAMIC_BADGE_SLOTS[b[0]] ? '<span class="tmf-rail-count" data-phase8-badge="' + esc(b[0]) + '"></span>'
        : (b[3] ? '<span class="tmf-rail-count">' + esc(b[3]) + '</span>' : ''));
      return '<button type="button" class="tmf-rail-btn ' + esc(b[4] || '') + '" data-slot="' + esc(b[0]) + '" title="' + esc(b[2]) + '" onclick="TMPhase8FormalBridge.openPanel(\'' + esc(b[0]) + '\')"><span>' + esc(b[1]) + '</span>' + badge + '</button>';
    }).join('');
    updateRailBadges();
    updateRailActive();
  }

  function ensurePreviewRail(){
    var root = document.querySelector('.gs-rail-right');
    if (!root) return;
    var old = root.querySelector('.gs-rail');
    if (old) old.style.display = 'none';
    var oldFormal = document.getElementById('tm-phase8-formal-rail');
    if (oldFormal) oldFormal.remove();
    var rail = document.getElementById('tm-right-rail');
    if (!rail) {
      rail = document.createElement('div');
      rail.id = 'tm-right-rail';
      rail.setAttribute('aria-label', '国事侧栏');
      root.appendChild(rail);
    }
    // 2026-05-27·右侧栏图标 SVG 化·参见 web/preview/right-rail-icons-preview.html v4
    // 立意·司南罗盘 / 衙门殿宇 / 竹简卷 / 朝班一品紫 / 双半合符 / 鱼鳞图册 / 算盘 / 官制树
    // 第 2 参从汉字字符改 SVG raw string·esc(b[1]) 改 raw b[1]·不转义
    var SVG_OL = '<svg class="tm-rc-svg" viewBox="0 0 48 48"><rect x="5" y="5" width="38" height="38" rx="1" fill="none" stroke="#d4be7a" stroke-width="1.4"/><circle cx="24" cy="24" r="14" fill="rgba(60,42,24,.45)" stroke="#d4be7a" stroke-width=".9"/><g stroke="#d4be7a" stroke-width=".9"><line x1="24" y1="10" x2="24" y2="13"/><line x1="24" y1="35" x2="24" y2="38"/><line x1="10" y1="24" x2="13" y2="24"/><line x1="35" y1="24" x2="38" y2="24"/></g><ellipse cx="22" cy="26" rx="6.5" ry="3" fill="#d4be7a" transform="rotate(-32 22 26)"/><circle cx="24" cy="24" r="1.2" fill="#1c1914"/></svg>';
    var SVG_ISSUE = '<svg class="tm-rc-svg" viewBox="0 0 48 48"><path d="M14 12 L34 12" stroke="#6b5010" stroke-width="1.6"/><path d="M14 12 Q12 9 13 6" stroke="#6b5010" stroke-width="1.4" fill="none"/><path d="M34 12 Q36 9 35 6" stroke="#6b5010" stroke-width="1.4" fill="none"/><path d="M14 12 L4 22 Q3 23 4 24 L44 24 Q45 23 44 22 L34 12 Z" fill="#d4be7a" stroke="#6b5010" stroke-width=".8"/><g fill="#8b2e25"><rect x="9" y="24" width="2.5" height="14"/><rect x="36.5" y="24" width="2.5" height="14"/><rect x="17" y="24" width="2.5" height="14"/><rect x="28.5" y="24" width="2.5" height="14"/></g><rect x="16" y="25" width="16" height="2.5" fill="#1c1914" stroke="#d4be7a" stroke-width=".4"/><path d="M20 38 L20 30 L28 30 L28 38" fill="#a32312"/><rect x="6" y="38" width="36" height="1.6" fill="#9d917d"/><rect x="4" y="40" width="40" height="1.6" fill="#9d917d"/></svg>';
    var SVG_POLICY = '<svg class="tm-rc-svg" viewBox="0 0 48 48"><g fill="#d4be7a" stroke="#6b5010" stroke-width=".4"><rect x="6.4" y="7" width="3.4" height="34" rx=".4"/><rect x="10.6" y="7" width="3.4" height="34" rx=".4"/><rect x="14.8" y="7" width="3.4" height="34" rx=".4"/><rect x="19" y="7" width="3.4" height="34" rx=".4"/><rect x="23.2" y="7" width="3.4" height="34" rx=".4"/><rect x="27.4" y="7" width="3.4" height="34" rx=".4"/><rect x="31.6" y="7" width="3.4" height="34" rx=".4"/><path d="M35.8 7 Q39 8 41 10 Q42 12 40 14 Q41 18 41 22 Q41 28 41 34 Q42 38 40 40 Q39 41 35.8 41 Z"/></g><rect x="4" y="9.5" width="38" height="2" fill="#a32312"/><rect x="4" y="37" width="38" height="2" fill="#a32312"/></svg>';
    var SVG_OFFICE = '<svg class="tm-rc-svg" viewBox="0 0 48 48"><rect x="2" y="42" width="44" height="2" fill="#3a3530"/><g opacity=".88"><path d="M5.5 42 L5 22 Q5 18 6 16 Q7 14 9.5 14 L10.5 14 Q13 14 14 16 Q15 18 15 22 L14.5 42 Z" fill="#5a8f7f"/><ellipse cx="10" cy="12" rx="2.6" ry="3" fill="#ede5d0"/><path d="M6.5 9.5 Q6.5 6 10 5 Q13.5 6 13.5 9.5 Z" fill="#1c1914"/><ellipse cx="4.5" cy="9" rx="2" ry=".8" fill="#1c1914"/><ellipse cx="15.5" cy="9" rx="2" ry=".8" fill="#1c1914"/></g><path d="M18 43 L17.5 21 Q17.5 17 18.5 14 Q19.5 11 23 11 L25 11 Q28.5 11 29.5 14 Q30.5 17 30.5 21 L30 43 Z" fill="#8e44ad"/><rect x="18" y="29" width="12" height="2.4" fill="#6b5010"/><ellipse cx="24" cy="9" rx="3" ry="3.4" fill="#f4ecd4"/><path d="M19 6 Q19 1.5 24 0.5 Q29 1.5 29 6 L29 7 L19 7 Z" fill="#1c1914"/><ellipse cx="13" cy="5.5" rx="3.5" ry="1.2" fill="#1c1914"/><ellipse cx="35" cy="5.5" rx="3.5" ry="1.2" fill="#1c1914"/><path d="M22.5 14 L25.5 14 L25.5 30 Q25 31 24 31 Q23 31 22.5 30 Z" fill="#f8f3e8"/><g opacity=".92"><path d="M33.5 42 L33 22 Q33 18 34 16 Q35 14 37.5 14 L38.5 14 Q41 14 42 16 Q43 18 43 22 L42.5 42 Z" fill="#8b2e25"/><ellipse cx="38" cy="12" rx="2.6" ry="3" fill="#ede5d0"/><path d="M34.5 9.5 Q34.5 6 38 5 Q41.5 6 41.5 9.5 Z" fill="#1c1914"/><ellipse cx="32.5" cy="9" rx="2" ry=".8" fill="#1c1914"/><ellipse cx="43.5" cy="9" rx="2" ry=".8" fill="#1c1914"/></g></svg>';
    var SVG_ARMY = '<svg class="tm-rc-svg" viewBox="0 0 48 48"><path d="M3 25 Q3 21 7 20 L13 18 Q18 16 22 17 Q23 18 23 21 L23 33 Q22 35 18 35 Q12 35 8 33 Q4 32 3 29 Z" fill="#caa05a" stroke="#2a1808" stroke-width=".7"/><path d="M25 17 Q26 16 30 17 L36 18 Q41 19 43 22 Q45 25 45 28 Q45 32 42 33 L36 35 Q30 35 27 33 Q25 32 25 30 Z" fill="#8a6d2b" stroke="#2a1808" stroke-width=".7"/><g stroke="#1c1914" stroke-width=".7" fill="none"><path d="M9 19 Q9 25 9 32"/><path d="M14 18 Q14 25 14 33"/><path d="M19 17 Q19 25 19 33"/><path d="M28 18 Q28 25 28 33"/><path d="M33 18 Q33 25 33 33"/><path d="M38 18 Q38 25 38 32"/></g><line x1="24" y1="14" x2="24" y2="35" stroke="#a32312" stroke-width=".8" stroke-dasharray="1.5,1.2"/><circle cx="24" cy="26" r=".9" fill="#a32312"/></svg>';
    var SVG_MAP = '<svg class="tm-rc-svg" viewBox="0 0 48 48"><path d="M8 6 L40 4 L41 41 L9 43 Z" fill="#caa05a" stroke="#1c1408" stroke-width=".7"/><rect x="16" y="9" width="14" height="6" fill="#a32312" stroke="#1c1408" stroke-width=".4"/><line x1="18" y1="11" x2="28" y2="11" stroke="#f4ecd4" stroke-width=".4"/><line x1="18" y1="13" x2="28" y2="13" stroke="#f4ecd4" stroke-width=".4"/><g stroke="#1c1408" stroke-width=".3" fill="rgba(247,234,212,.15)"><path d="M14 19 L20 19 L17 21 Z"/><path d="M20 19 L26 19 L23 21 Z"/><path d="M26 19 L32 19 L29 21 Z"/><path d="M32 19 L38 19 L35 21 Z"/><path d="M14 23 L20 23 L17 25 Z"/><path d="M20 23 L26 23 L23 25 Z"/><path d="M26 23 L32 23 L29 25 Z"/><path d="M32 23 L38 23 L35 25 Z"/><path d="M14 27 L20 27 L17 29 Z"/><path d="M20 27 L26 27 L23 29 Z"/><path d="M26 27 L32 27 L29 29 Z"/><path d="M32 27 L38 27 L35 29 Z"/><path d="M14 31 L20 31 L17 33 Z"/><path d="M20 31 L26 31 L23 33 Z"/><path d="M26 31 L32 31 L29 33 Z"/><path d="M32 31 L38 31 L35 33 Z"/></g></svg>';
    var SVG_FINANCE = '<svg class="tm-rc-svg" viewBox="0 0 48 48"><rect x="6" y="8" width="36" height="32" fill="none" stroke="#8a6d2b" stroke-width="2.5" rx="1"/><rect x="6" y="20" width="36" height="2" fill="#6b5010"/><g stroke="#6b5010" stroke-width=".7"><line x1="10" y1="10" x2="10" y2="38"/><line x1="14.5" y1="10" x2="14.5" y2="38"/><line x1="19" y1="10" x2="19" y2="38"/><line x1="24" y1="10" x2="24" y2="38"/><line x1="29" y1="10" x2="29" y2="38"/><line x1="33.5" y1="10" x2="33.5" y2="38"/><line x1="38" y1="10" x2="38" y2="38"/></g><g fill="#d4be7a"><rect x="8.4" y="13" width="3.2" height="2.4" rx=".8"/><rect x="17.4" y="13" width="3.2" height="2.4" rx=".8"/><rect x="27.4" y="13" width="3.2" height="2.4" rx=".8"/><rect x="36.4" y="13" width="3.2" height="2.4" rx=".8"/><rect x="8.4" y="32" width="3.2" height="2.4" rx=".8"/><rect x="17.4" y="32" width="3.2" height="2.4" rx=".8"/><rect x="27.4" y="32" width="3.2" height="2.4" rx=".8"/><rect x="36.4" y="32" width="3.2" height="2.4" rx=".8"/></g></svg>';
    var SVG_ARCHIVE = '<svg class="tm-rc-svg" viewBox="0 0 48 48"><rect x="19" y="4" width="10" height="6.5" rx=".8" fill="#c04030" stroke="#d4be7a" stroke-width=".7"/><line x1="24" y1="10.5" x2="24" y2="14.5" stroke="#d4be7a" stroke-width=".9"/><line x1="9" y1="14.5" x2="39" y2="14.5" stroke="#d4be7a" stroke-width=".8"/><g fill="#d4be7a" stroke="#6b5010" stroke-width=".5"><rect x="7" y="16.5" width="8" height="5.5" rx=".6"/><rect x="20" y="16.5" width="8" height="5.5" rx=".6"/><rect x="33" y="16.5" width="8" height="5.5" rx=".6"/></g><line x1="4" y1="25" x2="44" y2="25" stroke="#d4be7a" stroke-width=".6"/><g fill="#8a6d2b"><rect x="3.5" y="25" width="6" height="4" rx=".4"/><rect x="10.5" y="25" width="6" height="4" rx=".4"/><rect x="17.5" y="25" width="6" height="4" rx=".4"/><rect x="24.5" y="25" width="6" height="4" rx=".4"/><rect x="31.5" y="25" width="6" height="4" rx=".4"/><rect x="38.5" y="25" width="6" height="4" rx=".4"/></g><g fill="#d4be7a"><circle cx="6.5" cy="35" r="1.1"/><circle cx="13.5" cy="35" r="1.1"/><circle cx="20.5" cy="35" r="1.1"/><circle cx="27.5" cy="35" r="1.1"/><circle cx="34.5" cy="35" r="1.1"/><circle cx="41.5" cy="35" r="1.1"/></g></svg>';

    // 风闻情报·闻(生效 rail 原缺此槽·致 updateRailBadges 算闻计数却更新空 NodeList)·openPanel('rumor')→rightrail.renderRumorRich
    var SVG_RUMOR = '<svg class="tm-rc-svg" viewBox="0 0 48 48"><path d="M17 40 Q13 40 12 34 Q11 29 11 23 Q11 11 22 11 Q33 11 33 22 Q33 28 27 29 Q24 30 24 33 Q24 37 20 39 Q18 40 17 40 Z" fill="none" stroke="#d4be7a" stroke-width="1.6"/><path d="M17 22 Q17 17 22 17 Q27 17 27 22" fill="none" stroke="#d4be7a" stroke-width="1.3"/><g stroke="#c04030" stroke-width="1.2" fill="none"><path d="M36 15 Q39 20 39 24 Q39 28 36 33"/><path d="M40 11 Q45 18 45 24 Q45 30 40 37"/></g></svg>';
    var buttons = [
      ['ol',SVG_OL,'纲纪总览','6','hot'],
      ['issue',SVG_ISSUE,'政务问对','3','hot'],
      ['policy',SVG_POLICY,'文事艺府','',''],
      ['office',SVG_OFFICE,'百官人事','pin',''],
      ['army',SVG_ARMY,'军务边防','2','hot'],
      ['map',SVG_MAP,'舆图政区','',''],
      ['finance',SVG_FINANCE,'户部财计','','ok'],
      ['rumor',SVG_RUMOR,'风闻情报','',''],
      ['archive',SVG_ARCHIVE,'官制衙门','','']
    ];
    rail.innerHTML = '<div class="tm-rc-cap" aria-hidden="true">国事</div>' + buttons.map(function(b, i){
      var badge = b[3] === 'pin'
        ? '<span class="tm-rc-count" data-phase8-badge="pinned"></span>'
        : (RAIL_DYNAMIC_BADGE_SLOTS[b[0]] ? '<span class="tm-rc-count" data-phase8-badge="' + esc(b[0]) + '"></span>'
        : (b[3] ? '<span class="tm-rc-count">' + esc(b[3]) + '</span>' : ''));
      var divider = (i === 0 || i === 3 || i === 6) ? '<div class="tm-rc-divider" aria-hidden="true"></div>' : '';
      // b[1] 是 raw SVG·不转义
      return '<button type="button" class="tm-rc-icon ' + esc(b[4] || '') + '" aria-label="' + esc(b[2]) + '" data-slot="' + esc(b[0]) + '" data-tip="' + esc(b[2]) + '" onclick="TMPhase8FormalBridge.openPanel(\'' + esc(b[0]) + '\')">' + b[1] + badge + '</button>' + divider;
    }).join('') + '<div class="tm-rc-spacer"></div>';
    updateRailBadges();
    updateRailActive();
  }

  ensureRail = ensurePreviewRail;

  // ── 第二十七拆(②a alias/bucket)：installStyles / installTopbarExactStyles /
  //    installActionEntryExactStyles / installFormalVisibilityStyles 四样式注入函数迁出至
  //    phase8-formal-bridge-styles.js（装载于本文件【之前】·装载期填 bucket TM.__p8BridgeParts）。
  //    此处 alias 回绑闭包本地名·契约见 scripts/lint-split-contracts.js。
  var __p8bp = (window.TM && window.TM.__p8BridgeParts) || {};
  var installStyles = __p8bp.installStyles;
  var installTopbarExactStyles = __p8bp.installTopbarExactStyles;
  var installActionEntryExactStyles = __p8bp.installActionEntryExactStyles;
  var installFormalVisibilityStyles = __p8bp.installFormalVisibilityStyles;

  function formalRuntimeChromeSignature(){
    var body = document.body;
    var visible = isGameVisible();
    var active = !!(body && body.classList.contains('tm-phase8-game-active'));
    var formal = !!(body && body.classList.contains('tm-phase8-formal'));
    var running = !!(window.GM && GM.running);
    var rail = !!(document.getElementById('tm-right-rail') || document.getElementById('tm-phase8-formal-rail'));
    var shell = !!document.getElementById('tm-phase8-main-shell');
    var tray = !!document.getElementById('tm-phase8-action-tray');
    var shizheng = !!document.getElementById('shizheng-btn');
    return [
      visible ? 1 : 0,
      active ? 1 : 0,
      formal ? 1 : 0,
      running ? 1 : 0,
      rail ? 1 : 0,
      shell ? 1 : 0,
      tray ? 1 : 0,
      shizheng ? 1 : 0,
      state.activeSlot || '',
      state.legacyView ? 1 : 0
    ].join('|');
  }

  function ensureFormalRuntimeChrome(force){
    var sig = formalRuntimeChromeSignature();
    if (!force && state.runtimeChromeSig === sig) {
      return !!(document.body && document.body.classList.contains('tm-phase8-game-active'));
    }
    if (!syncFormalShellVisibility()) {
      state.runtimeChromeSig = formalRuntimeChromeSignature();
      return false;
    }
    installWenduiFormalReturnHook();
    ensureRail();
    ensureFormalChrome();
    ensureMainShell();
    bindFormalEntryRedirects();
    markPinnedCards();
    state.runtimeChromeSig = formalRuntimeChromeSignature();
    return true;
  }

  function formalRuntimeRefreshSignature(){
    var gm = window.GM || {};
    var eb = window.EB || {};
    function listSig(arr){
      if (!Array.isArray(arr)) return '0';
      var last = arr[arr.length - 1] || {};
      var text = last.title || last.name || last.topic || last.text || last.desc || last.type || last.kind || '';
      // 状态摘要·并入各 status 计数分布(有界·任意条 status 原地变→分布串变→签名变)·无 status 数组=空串(零回归)
      var _stc = {};
      for (var _i = 0; _i < arr.length; _i++){ var _s = arr[_i] && arr[_i].status; if (_s != null && _s !== '') _stc[_s] = (_stc[_s] || 0) + 1; }
      var _stSig = Object.keys(_stc).sort().map(function(k){ return k + _stc[k]; }).join(',');
      return arr.length + ':' + (last.turn || last.t || last.raisedTurn || '') + ':' + compactText(text, 48) + (_stSig ? ':' + _stSig : '');
    }
    return [
      formalRuntimeChromeSignature(),
      Number(gm.turn || 0),
      gm.running ? 1 : 0,
      state.eventLookback || 3,
      state.activeSlot || '',
      state.legacyView ? 1 : 0,
      listSig(gm.evtLog),
      listSig(gm.eventLog),
      listSig(gm.events),
      listSig(gm.recentEvents),
      listSig(gm.currentIssues),
      listSig(gm.memorials),
      (Array.isArray(gm._pendingAudiences) ? gm._pendingAudiences.length : 0),
      listSig(gm._turnReport),
      listSig(eb.items)
    ].join('|');
  }

  function scheduleFormalRuntimeRefresh(reason, options){
    options = options || {};
    if (state.runtimeRefreshTimer) clearTimeout(state.runtimeRefreshTimer);
    state.runtimeRefreshTimer = setTimeout(function(){
      state.runtimeRefreshTimer = 0;
      if (!ensureFormalRuntimeChrome(!!options.forceChrome)) return;
      var sig = formalRuntimeRefreshSignature();
      if (!options.force && state.runtimeRefreshSig === sig) return;
      state.runtimeRefreshSig = sig;
      try { renderEventFeed(); } catch(e){ console.warn('[renderEventFeed-err]', e && e.message); }
      try {
        if (!state.legacyView) showHome();
        else renderFormalMapSoon();
      } catch(e){ console.warn('[showHome-or-mapRender-err]', e && e.message); }
    }, options.delay == null ? 80 : options.delay);
  }

  function installWenduiFormalReturnHook(){
    if (!window.closeWenduiModal || window.closeWenduiModal.__phase8FormalReturn) return;
    var original = window.closeWenduiModal;
    window.closeWenduiModal = function(){
      var ret = original.apply(this, arguments);
      returnFormalHomeSoon();
      return ret;
    };
    window.closeWenduiModal.__phase8FormalReturn = true;
  }

  function installFormalShell(){
    document.body.classList.add('tm-phase8-formal');
    installStyles();
    installTopbarExactStyles();
    installActionEntryExactStyles();
    installFormalVisibilityStyles();
    installWenduiFormalReturnHook();
    if (!state.topbarSyncTimer && typeof setInterval === 'function') {
      state.topbarSyncTimer = setInterval(function(){
        try { ensureFormalRuntimeChrome(false); } catch(_){}
        // 2026-05-27 defensive·若 #ming-map-layer 内没 SVG (wrap miss / 数据迟到)·尝试重渲染
        try {
          var stage = document.getElementById('ming-map-layer');
          if (stage && isGameVisible() && !state.legacyView && stage.children.length === 0) {
            renderFormalMapSoon();
          }
        } catch(_){}
      }, 3000);
    }
    installContextMenu();
    installMapRefreshHooks();
    if (!syncFormalShellVisibility()) return;
    ensureFormalRuntimeChrome(true);
    installContextMenu();
    installMapRefreshHooks();
    if (isGameVisible() && !state.legacyView) showHome();
  }

  function wrapRenderHooks(){
    if (window.renderRenwu && !window.renderRenwu.__phase8PinnedWrapped) {
      var oldRenwu = window.renderRenwu;
      window.renderRenwu = function(){
        var ret = oldRenwu.apply(this, arguments);
        setTimeout(function(){
          markPinnedCards(document.getElementById('renwu-wrap') || document.getElementById('renwu') || document);
        }, 0);
        return ret;
      };
      window.renderRenwu.__phase8PinnedWrapped = true;
    }
    if (window.renderGameState && !window.renderGameState.__phase8FormalWrapped) {
      var oldRender = window.renderGameState;
      window.renderGameState = function(){
        var ret = oldRender.apply(this, arguments);
        scheduleFormalRuntimeRefresh('renderGameState', { forceChrome: true });
        return ret;
      };
      window.renderGameState.__phase8FormalWrapped = true;
    }
    if (window.addEB && !window.addEB.__phase8FormalWrapped) {
      var oldAddEB = window.addEB;
      window.addEB = function(){
        var ret = oldAddEB.apply(this, arguments);
        scheduleFormalRuntimeRefresh('addEB');
        return ret;
      };
      window.addEB.__phase8FormalWrapped = true;
    }
  }

  // 单点导出收口·window.openZhao/openYueZou/openHongyan/openShilu 的【唯一 owner】= phase8-formal-drafts.js
  //   (drafts 装载于本文件之后·真源实现在彼处)·此处不再重复 window.* 赋值(旧双设=drafts 夺舍 bridge·徒增竞态)
  //   bridge 内部仍经 bridge.openZhao/openYueZou/... 命名空间导出(见下方对象字面量)
  window.openShizheng = openShizhengLegacyFlow;
  window.syncPhase8FormalEdictDrafts = syncFormalEdictDraftsToLegacyInputs;
  window.getPhase8FormalEdictDraftSnapshot = getFormalEdictDraftSnapshot;
  window.savePhase8FormalDraftsToGM = saveFormalDraftsToGM;
  window.restorePhase8FormalDraftsFromGM = restoreFormalDraftsFromGM;

  window.TMPhase8FormalBridge = {
    home: showHome,
    leaveRuntime: leaveFormalRuntime,
    backToLaunch: leaveFormalRuntime,
    resetOutgame: leaveFormalRuntime,
    openModule: openModule,
    openPanel: openPanel,
    topbar: topbarApi(),
    closePanel: closeRightDrawer,
    jump: jump,
    openLeft: openLeft,
    openGuoku: openGuoku,
    openOffice: openOfficeStandalone,
    openKeju: openKeju,
    openChaoyi: openChaoyiMode,
    openAction: openAction,
    openZhao: openZhaoPreviewPanel,
    openYueZou: openYueZouPreviewPanel,
    openHongyan: openHongyanPreviewPanel,
    openShilu: openShiluPreviewPanel,
    openShizheng: openShizhengLegacyFlow,
    syncEdictDraftsToLegacy: syncFormalEdictDraftsToLegacyInputs,
    getEdictDraftSnapshot: getFormalEdictDraftSnapshot,
    clearEdictDrafts: clearFormalEdictDrafts,
    saveDraftsToGM: saveFormalDraftsToGM,
    restoreDraftsFromGM: restoreFormalDraftsFromGM,
    closeArmyFlyout: function(){
      var rr = (window.TMPhase8FormalBridge && TMPhase8FormalBridge.rightrail) || {};
      if (rr.rightCloseArmyFlyout) rr.rightCloseArmyFlyout();
    if (rr.rightCloseSocialFlyout) rr.rightCloseSocialFlyout();
    },
    showEdictAdoptMenu: showFormalEdictAdoptMenu,
    dismissEdictSuggestion: dismissFormalEdictSuggestion,
    openRecordsMenu: openRecordsMenu,
    renderEventFeed: renderEventFeed,
    ensureChrome: ensureFormalChrome,
    renderMap: renderFormalMap,
    refreshMapData: refreshMapFromRuntime,
    refreshPanel: refreshActivePanel,
    getLiveMap: getMapData,
    findFaction: findFaction,
    pin: pinPerson,
    unpin: function(id){ pinPerson(id, false); },
    openRenwu: function(){ openModule('renwu'); },
    openRegionById: function(id){
      var r = findRegion(id);
      if (r) openRegionDossier(r);
    },
    openRegionTab: function(id, tab){
      var value = validRegionMapTab(tab) ? tab : 'overview';
      state.mapPanelTab = value;
      if (value !== 'overview') state.mapMode = value;
      var r = findRegion(id);
      if (r) openRegionDossier(r);
    },
    focusRegion: function(id){ focusRegion(id, true); },
    openFactionByKey: function(key){
      var map = getMapData();
      var f = findFaction(key);
      var r = map && map.regions ? (map.regions.find(function(x){ return factionOwnsRegion(x, key, f); }) || map.regions.find(function(x){ return ownerKey(x) === key; })) : null;
      openFactionDossier(key, r);
    },
    openFactionTab: function(key, tab){
      state.mapFactionTab = validFactionMapTab(tab) ? tab : 'overview';
      var map = getMapData();
      var f = findFaction(key);
      var r = map && map.regions ? (map.regions.find(function(x){ return factionOwnsRegion(x, key, f); }) || map.regions.find(function(x){ return ownerKey(x) === key; })) : null;
      openFactionDossier(key, r);
    },
    personAction: function(id, action){
      var p = findPerson(id);
      var name = p && p.name ? p.name : id;
      if (action === 'wendui') {
        if (window.GM) { GM.wenduiTarget = name; GM._pendingWenduiChar = name; }
        state.modulePerson = personKey(p) || id;
        // 真问对·调 window.openWenduiModal(name,'formal')(与右栏 rightrail 同款)·避免落 openModule('wendui') 的 mockup textarea
        if (typeof window.openWenduiModal === 'function') { closeModule(); closeRightDrawer(); window.openWenduiModal(name, 'formal'); returnFormalHomeSoon(); }
        else openModule('wendui');
      } else if (action === 'letter') {
        if (window.GM) GM._pendingLetterTo = name;
        state.modulePerson = personKey(p) || id;
        // 真鸿雁·openHongyanPreviewPanel 消费上面已置的 GM._pendingLetterTo 预填收信人(旧 openModule('letter') 落 mockup)
        openHongyanPreviewPanel();
      } else if (action === 'office') {
        state.modulePerson = personKey(p) || id;
        // 真官制树·openOfficeStandalone(bridge 真官制面板)·旧 openModule('office') 落 mockup
        openOfficeStandalone();
      } else if (action === 'detail') {
        state.modulePerson = personKey(p) || id;
        if (typeof window.openCharRenwuPage === 'function') window.openCharRenwuPage(name);
        else if (typeof window.viewRenwu === 'function') window.viewRenwu(name);
        else openModule('renwu');
      }
    },
    refresh: function(){
      if (!syncFormalShellVisibility()) return;
      ensureRail();
      ensureFormalChrome();
      ensureMainShell();
      bindFormalEntryRedirects();
      markPinnedCards();
      updateRailBadges();
      renderEventFeed();
      refreshActivePanel();
      renderFormalMapSoon();
    },

    // ── shared helper exposure·供 phase8-formal-{module}.js 用 (split paradigm·2026-05-26) ──
    _esc: esc,
    _attr: attr,
    _asset: asset,
    _fmtNum: fmtNum,
    _miniRows: miniRows,
    _actionButton: actionButton,
    _moduleShell: moduleShell,
    _dossierRows: dossierRows,
    _ownerKey: ownerKey,
    _ownerName: ownerName,
    _findFaction: findFaction,
    _findPerson: findPerson,
    _personKey: personKey,
    _getPeople: getPeople,
    _getMapData: getMapData,
    _getParties: getParties,
    _getClasses: getClasses,
    _collectRecentEvents: collectRecentEvents,
    _getTurnText: getTurnText,
    _firstArray: firstArray,
    _actionBtn: actionBtn,
    _actionChip: actionChip,
    _renderActionStats: renderActionStats,
    _textById: textById,
    _compactText: compactText,
    _getMemorials: getMemorials,
    _getIssues: getIssues,
    _getActiveScenario: getActiveScenario,
    _getArmies: getArmies,
    _issueIsResolved: issueIsResolved,
    _tmfRenwuPortrait: tmfRenwuPortrait,
    _returnFormalHomeSoon: returnFormalHomeSoon,
    _saveFormalDraftsToGM: saveFormalDraftsToGM,
    _closeModule: closeModule,
    _closeDeskOverlay: function(id){ var dr=(window.TMPhase8FormalBridge||{}).drafts; if (dr) return dr.closeDeskOverlay(id); },
    _closeRightDrawer: closeRightDrawer,
    _openOfficeStandalone: openOfficeStandalone,
    _restoreFormalDraftsFromGM: restoreFormalDraftsFromGM,
    _toast: toast,
    _cssEscape: cssEscape,
    _getLetters: getLetters,
    _openShizhengPreviewPanel: openShizhengPreviewPanel,
    _handleModuleAction: handleModuleAction,
    _updateRailBadges: updateRailBadges,
    _renderEventFeed: renderEventFeed,
    _openChaoyiMode: openChaoyiMode,
    _personNameKey: personNameKey,
    _clearFormalDraftStore: clearFormalDraftStore,
    _fullHongyanText: fullHongyanText,
    _syncFormalShellVisibility: syncFormalShellVisibility,
    _hasRegionMap: hasRegionMap,
    _getScenarioMapData: getScenarioMapData,
    _activeScenarioId: activeScenarioId,
    _mapIdentity: mapIdentity,
    _isGameVisible: isGameVisible,
    _showHome: showHome,
    _isPinned: isPinned,
    _issueRank: issueRank,
    _renderIssueCard: renderIssueCard,
    _renderIssueDetail: renderIssueDetail,
    _state: state
  };

  try { restoreFormalDraftsFromGM(false); } catch(_) {}

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function(){ installFormalShell(); wrapRenderHooks(); });
  } else {
    installFormalShell();
    wrapRenderHooks();
  }
  setTimeout(function(){ installFormalShell(); wrapRenderHooks(); }, 500);
})();
