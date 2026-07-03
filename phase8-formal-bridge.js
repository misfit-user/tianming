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

  function formalDraftStore(create){
    var gm = window.GM;
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

  function saveFormalDraftsToGM(captureOpen){
    if (state._savingFormalDrafts) return;
    var store = formalDraftStore(true);
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
      store.turn = window.GM && GM.turn || 1;
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

  function leaveFormalRuntime(){
    state.legacyView = false;
    state.runtimeChromeSig = '';
    state.runtimeRefreshSig = '';
    if (state.runtimeRefreshTimer) {
      clearTimeout(state.runtimeRefreshTimer);
      state.runtimeRefreshTimer = 0;
    }
    try { closeRightDrawer(); } catch(_) {}
    try { closeMapDossier(); } catch(_) {}
    if (document.body) {
      document.body.classList.remove('tm-phase8-game-active', 'tm-phase8-home', 'tm-phase8-legacy', 'province-panel-open');
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
    state.legacyView = false;
    clearOfficeStandaloneMode();
    document.body.classList.add('tm-phase8-home');
    document.body.classList.remove('tm-phase8-legacy');
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
    state.legacyView = true;
    document.body.classList.add('tm-phase8-legacy');
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
    'body.tm-phase8-formal #topbar .tb-chip .tb-fdeco{width:10px!important;height:10px!important;}'
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
  function openZhaoPreviewPanel(){ var d = (window.TMPhase8FormalBridge||{}).drafts; if (d && d.openZhaoPreviewPanel) return d.openZhaoPreviewPanel.apply(null, arguments); }
  function openYueZouPreviewPanel(){ var d = (window.TMPhase8FormalBridge||{}).drafts; if (d && d.openYueZouPreviewPanel) return d.openYueZouPreviewPanel.apply(null, arguments); }
  function openHongyanPreviewPanel(){ var d = (window.TMPhase8FormalBridge||{}).drafts; if (d && d.openHongyanPreviewPanel) return d.openHongyanPreviewPanel.apply(null, arguments); }
  function openShiluPreviewPanel(){ var d = (window.TMPhase8FormalBridge||{}).drafts; if (d && d.openShiluPreviewPanel) return d.openShiluPreviewPanel.apply(null, arguments); }
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

  function updateRailBadges(){
    var n = (state.pinnedPeople || []).length;
    document.querySelectorAll('[data-phase8-badge="pinned"]').forEach(function(el){
      el.textContent = n;
      el.style.display = n ? '' : 'none';
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
        : (b[3] ? '<span class="tmf-rail-count">' + esc(b[3]) + '</span>' : '');
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

    var buttons = [
      ['ol',SVG_OL,'纲纪总览','6','hot'],
      ['issue',SVG_ISSUE,'政务问对','3','hot'],
      ['policy',SVG_POLICY,'文事艺府','',''],
      ['office',SVG_OFFICE,'百官人事','pin',''],
      ['army',SVG_ARMY,'军务边防','2','hot'],
      ['map',SVG_MAP,'舆图政区','',''],
      ['finance',SVG_FINANCE,'户部财计','','ok'],
      ['archive',SVG_ARCHIVE,'官制衙门','','']
    ];
    rail.innerHTML = '<div class="tm-rc-cap" aria-hidden="true">国事</div>' + buttons.map(function(b, i){
      var badge = b[3] === 'pin'
        ? '<span class="tm-rc-count" data-phase8-badge="pinned"></span>'
        : (b[3] ? '<span class="tm-rc-count">' + esc(b[3]) + '</span>' : '');
      var divider = (i === 0 || i === 3 || i === 6) ? '<div class="tm-rc-divider" aria-hidden="true"></div>' : '';
      // b[1] 是 raw SVG·不转义
      return '<button type="button" class="tm-rc-icon ' + esc(b[4] || '') + '" aria-label="' + esc(b[2]) + '" data-slot="' + esc(b[0]) + '" data-tip="' + esc(b[2]) + '" onclick="TMPhase8FormalBridge.openPanel(\'' + esc(b[0]) + '\')">' + b[1] + badge + '</button>' + divider;
    }).join('') + '<div class="tm-rc-spacer"></div>';
    updateRailBadges();
    updateRailActive();
  }

  ensureRail = ensurePreviewRail;

  function installStyles(){
    if (document.getElementById('tm-phase8-formal-style')) return;
    var st = document.createElement('style');
    st.id = 'tm-phase8-formal-style';
    st.textContent = [
      'body.tm-phase8-formal #bar{height:78px;background:linear-gradient(180deg,rgba(25,19,13,.99),rgba(12,9,7,.97));border-bottom:1px solid rgba(184,154,83,.36);box-shadow:0 8px 24px rgba(0,0,0,.52);padding:0 18px;gap:9px;}',
      'body.tm-phase8-formal #bar:before{content:"";position:absolute;left:18px;right:18px;bottom:5px;height:1px;background:linear-gradient(90deg,transparent,rgba(201,168,95,.52),transparent);}',
      'body.tm-phase8-formal #G{margin-top:78px;height:calc(100vh - 78px);grid-template-columns:0 minmax(0,1fr) 0;background:#0c0907;position:relative;overflow:hidden;}',
      'body.tm-phase8-formal .bar-seal,body.tm-phase8-formal .bar-era-stack{display:none!important;}',
      'body.tm-phase8-formal .bar-logo{border-right:none;padding-right:0;gap:0;}',
      'body.tm-phase8-formal .bar-logo,body.tm-phase8-formal .bar-vars,body.tm-phase8-formal .bar-right-group,body.tm-phase8-formal .bar-time{filter:drop-shadow(0 2px 8px rgba(0,0,0,.35));}',
      'body.tm-phase8-formal #bar{height:54px!important;align-items:flex-start!important;padding:5px 10px 0!important;background:linear-gradient(180deg,rgba(35,26,17,.98),rgba(10,8,6,.98)),url("preview/img/topbar-material-generated-v1.png") center/cover!important;border-bottom:1px solid rgba(214,188,116,.36)!important;}',
      'body.tm-phase8-formal #G{margin-top:54px!important;height:calc(100vh - 54px)!important;}body.tm-phase8-formal .float-btn,body.tm-phase8-formal #save-btn,body.tm-phase8-formal #shiji-btn{display:none!important;}',
      'body.tm-phase8-formal #bar{display:none!important;}',
      'body.tm-phase8-formal #banner{position:fixed!important;top:66px!important;left:50%!important;transform:translateX(-50%)!important;z-index:1002!important;padding:1px 13px 2px!important;background:radial-gradient(circle at 28% 20%,rgba(255,232,174,.18),transparent 42%),linear-gradient(180deg,rgba(202,80,58,.86),rgba(133,34,26,.94))!important;color:#fff5e0!important;font:500 10.5px/14px "STKaiti","KaiTi",serif!important;letter-spacing:.18em!important;border-radius:0 0 9px 9px!important;border:1px solid rgba(244,234,221,.32)!important;border-top:0!important;box-shadow:0 2px 7px rgba(140,40,30,.38),inset 0 1px 0 rgba(255,255,255,.14)!important;text-shadow:0 1px 1px rgba(0,0,0,.4)!important;white-space:nowrap!important;cursor:pointer!important;pointer-events:auto!important;}body.tm-phase8-formal #banner:hover{filter:brightness(1.07)!important;}body.tm-phase8-formal .map-alert-strip{display:none!important;}',
      'body.tm-phase8-formal #topbar{position:fixed;left:0;right:0;top:0;z-index:1000;height:56px;display:flex;align-items:flex-start;gap:8px;padding:7px 12px 0;box-sizing:border-box;background:linear-gradient(180deg,rgba(5,4,4,.72),rgba(5,4,4,.28) 72%,rgba(5,4,4,0));border:0;box-shadow:0 8px 18px rgba(0,0,0,.24);font-family:"STKaiti","KaiTi","楷体",serif;color:#eadfbd;}',
      'body.tm-phase8-formal #topbar:before{content:"";position:absolute;left:0;right:0;top:-3px;height:62px;background:url("preview/img/topbar-imperial-rail.png") center top/100% 100% no-repeat;opacity:.78;filter:saturate(.95) contrast(1.03) brightness(.82);pointer-events:none;}body.tm-phase8-formal #topbar:after{content:"";position:absolute;left:84px;right:84px;top:53px;height:1px;background:linear-gradient(90deg,transparent,rgba(239,202,116,.44) 18%,rgba(151,48,34,.24) 50%,rgba(239,202,116,.36) 82%,transparent);box-shadow:0 0 8px rgba(214,176,90,.18);opacity:.82;pointer-events:none;}',
      'body.tm-phase8-formal .tb-left,body.tm-phase8-formal .tb-vars,body.tm-phase8-formal .tb-right{position:relative;z-index:2;}body.tm-phase8-formal .tb-left{height:42px;display:flex;align-items:center;gap:7px;padding:4px 10px 4px 8px;border:1px solid rgba(218,181,93,.42);border-left:2px solid rgba(151,48,34,.88);border-radius:4px 9px 9px 4px;background:linear-gradient(180deg,rgba(34,27,20,.82),rgba(8,7,6,.86)),radial-gradient(ellipse at 0 50%,rgba(162,50,35,.25),transparent 64%);box-shadow:inset 0 1px 0 rgba(255,238,190,.07),inset 0 -1px 0 rgba(0,0,0,.60),0 5px 12px rgba(0,0,0,.28);}',
      'body.tm-phase8-formal .tb-wentian{height:32px;min-width:62px;padding:0 10px;border:1px solid rgba(223,185,98,.48);border-radius:3px;background:linear-gradient(180deg,rgba(52,39,24,.92),rgba(10,8,6,.92)),linear-gradient(90deg,rgba(151,48,34,.24),transparent 72%);color:#efd58f;font-size:12px;letter-spacing:.14em;box-shadow:inset 0 1px 0 rgba(255,238,190,.08),inset 0 -10px 18px rgba(0,0,0,.20);cursor:pointer;font-family:inherit;}body.tm-phase8-formal .tb-wentian:hover{border-color:rgba(244,211,128,.70);box-shadow:inset 0 1px 0 rgba(255,238,190,.10),0 0 12px rgba(214,176,90,.22);}body.tm-phase8-formal .tb-weather{height:32px;display:flex;align-items:center;gap:6px;padding:0 4px 0 2px;}body.tm-phase8-formal .tb-w-seal{width:25px;height:25px;display:grid;place-items:center;border:1px solid rgba(235,198,113,.70);border-radius:50%;background:radial-gradient(circle at 36% 28%,rgba(255,221,138,.74),rgba(174,103,32,.58) 58%,rgba(65,35,14,.82));box-shadow:inset 0 1px 0 rgba(255,246,202,.35),0 0 11px rgba(224,174,80,.22);color:#271309;font-size:12px;}',
      'body.tm-phase8-formal .tb-w-info{min-width:88px;}body.tm-phase8-formal .tb-w-name{font-size:12px;color:#ecd58e;letter-spacing:.09em;white-space:nowrap;}body.tm-phase8-formal .tb-w-desc{font-size:10px;color:rgba(188,174,142,.72);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:120px;}',
      'body.tm-phase8-formal .tb-vars{flex:1 1 auto;min-width:0;height:42px;display:flex;align-items:center;padding:4px 5px;gap:0;border:1px solid rgba(203,166,88,.24);border-radius:2px;background:linear-gradient(180deg,rgba(41,32,23,.86),rgba(13,10,8,.82)),linear-gradient(90deg,rgba(94,54,27,.18),rgba(0,0,0,.04) 12%,rgba(0,0,0,.04) 88%,rgba(94,54,27,.16));box-shadow:inset 0 1px 0 rgba(255,239,196,.055),inset 0 -1px 0 rgba(0,0,0,.52),0 3px 8px rgba(0,0,0,.20);overflow:hidden;}body.tm-phase8-formal .tb-var{height:30px;display:flex;align-items:center;gap:5px;padding:2px 7px;min-width:78px;border:0;background:transparent;position:relative;}body.tm-phase8-formal .tb-var + .tb-var:before{content:"";position:absolute;left:0;top:5px;bottom:5px;width:1px;background:linear-gradient(180deg,transparent,rgba(220,184,102,.24),transparent);}body.tm-phase8-formal .tb-var:hover{background:linear-gradient(180deg,rgba(213,176,95,.10),rgba(213,176,95,.03));}',
      'body.tm-phase8-formal .tb-var.wide{flex:1 1 176px;min-width:156px;max-width:208px;display:grid;grid-template-columns:32px minmax(0,1fr);gap:7px;background:linear-gradient(180deg,rgba(63,43,24,.18),rgba(0,0,0,.02));}body.tm-phase8-formal .tb-vn{font-size:9px;letter-spacing:.12em;color:rgba(184,168,132,.72);white-space:nowrap;}body.tm-phase8-formal .tb-vv{font-size:12px;color:#e0c77e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}body.tm-phase8-formal .icn{width:18px;height:18px;display:grid;place-items:center;border:1px solid rgba(214,176,90,.36);border-radius:50%;background:radial-gradient(circle at 35% 28%,rgba(255,227,146,.18),rgba(54,32,16,.78));color:#e6cd86;font-size:10px;flex:0 0 auto;}body.tm-phase8-formal .tb-vsubs{display:flex;align-items:center;gap:5px;min-width:0;}body.tm-phase8-formal .tb-vs{display:flex;align-items:center;gap:4px;min-width:0;}body.tm-phase8-formal .tb-vs .sv{display:flex;flex-direction:column;line-height:1.05;min-width:0;}body.tm-phase8-formal .tb-vs b{font-size:12px;color:#e0c77e;white-space:nowrap;}body.tm-phase8-formal .sd{font-size:9px;color:#8dbdab;white-space:nowrap;}',
      'body.tm-phase8-formal .tb-right{height:42px;display:flex;align-items:center;gap:7px;}body.tm-phase8-formal .tb-chip{height:34px;min-width:70px;border:1px solid rgba(218,181,93,.30);border-radius:4px;background:linear-gradient(180deg,rgba(36,28,20,.82),rgba(8,7,6,.86));color:#d8c27c;font-family:inherit;letter-spacing:.14em;cursor:pointer;}body.tm-phase8-formal .tb-time{height:42px;min-width:230px;padding:6px 12px 0;border:1px solid rgba(218,181,93,.30);border-right:2px solid rgba(151,48,34,.70);border-radius:8px 4px 4px 8px;background:linear-gradient(180deg,rgba(34,27,20,.82),rgba(8,7,6,.86));box-sizing:border-box;text-align:right;}body.tm-phase8-formal .tb-time-main{color:#efd58f;font-size:13px;letter-spacing:.10em;white-space:nowrap;}body.tm-phase8-formal .tb-time-sub{margin-top:3px;color:rgba(188,174,142,.72);font-size:11px;}',
      'body.tm-phase8-formal #topbar{height:64px!important;padding:7px 12px 0!important;gap:9px!important;align-items:flex-start!important;background:transparent!important;border:0!important;box-shadow:none!important;backdrop-filter:none!important;pointer-events:none!important;}body.tm-phase8-formal #topbar:before,body.tm-phase8-formal #topbar:after{display:none!important;}body.tm-phase8-formal #G{margin-top:48px!important;height:calc(100vh - 48px)!important;}body.tm-phase8-formal .tb-left,body.tm-phase8-formal .tb-vars,body.tm-phase8-formal .tb-right{pointer-events:auto!important;flex-shrink:0!important;overflow:visible!important;}',
      'body.tm-phase8-formal .tb-left{width:205px!important;height:44px!important;margin:0 2px 0 0!important;padding:5px 13px 5px 7px!important;gap:7px!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;}body.tm-phase8-formal .tb-left:before{content:"";position:absolute;z-index:-1;inset:-12px -16px -13px -10px;background:url("preview/img/topbar-left-identity-underlay-v1.png") center/100% 100% no-repeat;opacity:.68;filter:saturate(.98) brightness(.92) contrast(1.05);pointer-events:none;}body.tm-phase8-formal .tb-left:after{display:none!important;}',
      'body.tm-phase8-formal .tb-wentian{width:36px!important;min-width:36px!important;height:34px!important;padding:0!important;border-radius:50%!important;border-color:rgba(227,187,92,.62)!important;background:radial-gradient(circle at 35% 27%,rgba(251,221,143,.30),rgba(92,54,24,.88) 58%,rgba(12,9,7,.94) 78%),linear-gradient(180deg,rgba(63,38,20,.94),rgba(12,9,7,.94))!important;color:#f0d58f!important;font-size:11px!important;letter-spacing:.06em!important;box-shadow:inset 0 1px 0 rgba(255,239,180,.14),inset 0 -8px 14px rgba(0,0,0,.32),0 2px 8px rgba(0,0,0,.40),0 0 11px rgba(205,166,82,.15)!important;}body.tm-phase8-formal .tb-weather{height:34px!important;min-width:122px!important;padding:0!important;gap:6px!important;background:transparent!important;border:0!important;box-shadow:none!important;}',
      'body.tm-phase8-formal .tb-w-seal{width:24px!important;height:24px!important;font-size:12px!important;border-color:rgba(233,196,105,.52)!important;background:radial-gradient(circle at 35% 25%,rgba(255,225,147,.24),rgba(86,52,24,.74) 58%,rgba(13,10,8,.92))!important;}body.tm-phase8-formal .tb-w-info{min-width:82px!important;}body.tm-phase8-formal .tb-w-name{max-width:104px!important;font-size:12px!important;color:#efd990!important;}body.tm-phase8-formal .tb-w-desc{font-size:10px!important;color:rgba(209,193,153,.66)!important;}',
      'body.tm-phase8-formal .tb-vars{--tm-rail-w:932px;--tm-rail-h:54px;--tm-rail-pad-x:12px;--tm-rail-pad-y:7px;--tm-rail-gap:4px;--tm-wide-cell:212px;--tm-hukou-cell:104px;--tm-lizhi-cell:110px;--tm-small-cell:82px;width:var(--tm-rail-w)!important;height:var(--tm-rail-h)!important;flex:0 0 var(--tm-rail-w)!important;max-width:none!important;padding:var(--tm-rail-pad-y) var(--tm-rail-pad-x)!important;gap:var(--tm-rail-gap)!important;border:0!important;border-radius:0!important;background:url("preview/img/topbar-resource-fieldrail-v2-wide.png") center/100% 100% no-repeat!important;box-shadow:none!important;}body.tm-phase8-formal .tb-vars:before,body.tm-phase8-formal .tb-vars:after{display:none!important;}',
      'body.tm-phase8-formal .tb-var{height:calc(var(--tm-rail-h) - (var(--tm-rail-pad-y) * 2))!important;border-color:transparent!important;background:transparent!important;box-shadow:none!important;min-width:0!important;}body.tm-phase8-formal .tb-var.wide{height:calc(var(--tm-rail-h) - (var(--tm-rail-pad-y) * 2))!important;flex:0 0 var(--tm-wide-cell)!important;width:var(--tm-wide-cell)!important;min-width:var(--tm-wide-cell)!important;max-width:var(--tm-wide-cell)!important;}body.tm-phase8-formal .tb-var:not(.wide){height:calc(var(--tm-rail-h) - (var(--tm-rail-pad-y) * 2))!important;flex:0 0 var(--tm-small-cell)!important;width:var(--tm-small-cell)!important;min-width:var(--tm-small-cell)!important;max-width:var(--tm-small-cell)!important;}body.tm-phase8-formal .tb-var[data-key="hukou"]{flex-basis:var(--tm-hukou-cell)!important;width:var(--tm-hukou-cell)!important;min-width:var(--tm-hukou-cell)!important;max-width:var(--tm-hukou-cell)!important;}body.tm-phase8-formal .tb-var[data-key="lizhi"]{flex-basis:var(--tm-lizhi-cell)!important;width:var(--tm-lizhi-cell)!important;min-width:var(--tm-lizhi-cell)!important;max-width:var(--tm-lizhi-cell)!important;}',
      'body.tm-phase8-formal .tb-right{width:340px!important;height:52px!important;flex:0 0 340px!important;background:url("preview/img/topbar-right-fieldtime-v3-wide.png") center/100% 100% no-repeat!important;border:0!important;box-shadow:none!important;padding:0 12px!important;box-sizing:border-box;}body.tm-phase8-formal .tb-right:before{display:none!important;}body.tm-phase8-formal .tb-chip{height:30px;min-width:64px;background:transparent!important;border-color:rgba(214,188,116,.16)!important;color:rgba(230,213,172,.72)!important;}body.tm-phase8-formal .tb-time{height:44px!important;min-width:194px!important;padding:7px 0 0!important;border:0!important;background:transparent!important;text-align:right!important;}body.tm-phase8-formal .tb-time-main{max-width:190px!important;font-size:12px!important;letter-spacing:.055em!important;color:#e6c878!important;}body.tm-phase8-formal .tb-time-sub{max-width:190px!important;font-size:9px!important;color:rgba(205,190,151,.68)!important;}',
      '@media(max-width:1500px){body.tm-phase8-formal .tb-vars{--tm-rail-w:800px;--tm-rail-h:50px;--tm-rail-pad-x:9px;--tm-rail-pad-y:6px;--tm-rail-gap:3px;--tm-wide-cell:188px;--tm-hukou-cell:92px;--tm-lizhi-cell:92px;--tm-small-cell:62px;background-image:url("preview/img/topbar-resource-fieldrail-v2-wide.png")!important;}body.tm-phase8-formal .tb-right{width:230px!important;height:48px!important;flex-basis:230px!important;background-image:url("preview/img/topbar-right-fieldtime-v3-compact.png")!important;}}',
      '@media(max-width:1080px){body.tm-phase8-formal .tb-vars{--tm-rail-w:626px;--tm-rail-h:50px;--tm-rail-pad-x:9px;--tm-rail-pad-y:6px;--tm-rail-gap:3px;--tm-wide-cell:126px;--tm-hukou-cell:76px;--tm-lizhi-cell:82px;--tm-small-cell:60px;background-image:url("preview/img/topbar-resource-fieldrail-v2-narrow.png")!important;}body.tm-phase8-formal .tb-right{width:154px!important;height:48px!important;flex-basis:154px!important;background-image:url("preview/img/topbar-right-fieldtime-v3-narrow.png")!important;}body.tm-phase8-formal .tb-weather,body.tm-phase8-formal .tb-chip{display:none!important;}}',
      'body.tm-phase8-formal #topbar{height:78px!important;padding-top:8px!important;}body.tm-phase8-formal .tb-left{height:52px!important;}body.tm-phase8-formal .tb-right{isolation:isolate!important;}body.tm-phase8-formal .tb-vbody{display:flex;flex-direction:column;justify-content:center;line-height:1.05;flex:1;min-width:0;overflow:hidden;}body.tm-phase8-formal .tb-vn{font-size:9px!important;letter-spacing:.18em!important;}body.tm-phase8-formal .tb-vv{font-size:12px!important;color:#e0c77e!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}body.tm-phase8-formal .tb-var.warn .tb-vv{color:#e88a78!important;}body.tm-phase8-formal .tb-var.good .tb-vv{color:#8dbdab!important;}',
      'body.tm-phase8-formal .tb-var.wide .tb-vn{width:auto!important;flex:0 0 8px!important;font-size:9px!important;line-height:1!important;margin-bottom:1px!important;padding:0!important;border-right:0!important;}body.tm-phase8-formal .tb-var.wide .tb-vsubs{display:flex!important;align-items:center!important;gap:4px!important;min-width:0!important;line-height:1.05!important;}body.tm-phase8-formal .tb-var.wide .tb-vs{height:25px!important;display:flex!important;align-items:center!important;gap:4px!important;padding:2px 3px!important;border-radius:2px;background:rgba(0,0,0,.12)!important;cursor:default;}body.tm-phase8-formal .tb-var.wide .sv{display:flex!important;flex-direction:column!important;align-items:flex-start!important;line-height:1.05!important;min-width:32px!important;}body.tm-phase8-formal .tb-var.wide .sv b{font:600 11.2px/1.12 "STSong","SimSun","Songti SC",serif!important;letter-spacing:.02em!important;color:#e0c77e!important;}body.tm-phase8-formal .tb-var.wide .sv .sd{font:500 9px/1.1 "STSong","SimSun",serif!important;letter-spacing:.02em!important;margin-top:1px!important;}body.tm-phase8-formal .sd.up{color:#8dbdab!important;}body.tm-phase8-formal .sd.dn{color:#e88a78!important;}body.tm-phase8-formal .sd.flat{color:rgba(184,168,132,.72)!important;}',
      'body.tm-phase8-formal .tb-var{cursor:pointer!important;}body.tm-phase8-formal .tb-var.wide{display:flex!important;flex-direction:column!important;align-items:stretch!important;justify-content:center!important;gap:3px!important;padding:5px 8px!important;overflow:hidden!important;}body.tm-phase8-formal .tb-var:not(.wide){display:flex!important;flex-direction:row!important;align-items:center!important;gap:5px!important;padding:5px 8px!important;overflow:hidden!important;}body.tm-phase8-formal .tb-vn:before,body.tm-phase8-formal .tb-var.wide .tb-vn:before{display:none!important;}body.tm-phase8-formal .tb-var.wide .tb-vn{flex:0 0 auto!important;min-width:0!important;max-width:none!important;padding-left:4px!important;text-align:left!important;overflow:hidden!important;text-overflow:ellipsis!important;color:rgba(221,202,155,.74)!important;}body.tm-phase8-formal .tb-vn{max-width:100%!important;overflow:hidden!important;text-overflow:ellipsis!important;}body.tm-phase8-formal .tb-var.wide .tb-vsubs{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;align-items:center!important;gap:4px!important;overflow:hidden!important;}body.tm-phase8-formal .tb-var.wide .tb-vs{min-width:0!important;overflow:hidden!important;cursor:pointer!important;}body.tm-phase8-formal .tb-var.wide .sv{min-width:0!important;flex:1 1 auto!important;overflow:hidden!important;}body.tm-phase8-formal .tb-var.wide .sv b,body.tm-phase8-formal .tb-var.wide .sv .sd{display:block!important;max-width:100%!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;}body.tm-phase8-formal .tb-vbody{gap:1px!important;}body.tm-phase8-formal .tb-right{margin-left:auto!important;}',
      'body.tm-phase8-formal .icn{width:17px!important;height:17px!important;font-size:10px!important;display:grid!important;place-items:center!important;border-radius:50%!important;box-sizing:border-box;}body.tm-phase8-formal .tb-var.wide .icn{width:16px!important;height:16px!important;font-size:9px!important;}body.tm-phase8-formal .icn-yin{color:#f3d58f!important;border-color:#a98643!important;background:radial-gradient(circle at 32% 28%,rgba(237,202,122,.56),rgba(116,73,28,.34) 60%,rgba(40,26,13,.60) 100%)!important;}body.tm-phase8-formal .icn-liang{color:#d8e0a2!important;border-color:#7f8d49!important;background:radial-gradient(circle at 32% 28%,rgba(216,224,162,.42),rgba(86,104,52,.34) 60%,rgba(26,33,18,.62) 100%)!important;}body.tm-phase8-formal .icn-bu{color:#c9d7e8!important;border-color:#6e839b!important;background:radial-gradient(circle at 32% 28%,rgba(201,215,232,.42),rgba(70,86,104,.36) 60%,rgba(24,29,36,.62) 100%)!important;}body.tm-phase8-formal .icn-zhen{color:#eed09a!important;border-color:#946b92!important;background:radial-gradient(circle at 32% 28%,rgba(238,208,154,.44),rgba(111,66,103,.38) 60%,rgba(38,23,34,.62) 100%)!important;}',
      'body.tm-phase8-formal .icn-hu{color:#ecd2a0!important;border-color:#a07c40!important;background:radial-gradient(circle at 32% 28%,rgba(232,206,160,.50),rgba(110,82,40,.32) 60%,rgba(40,28,15,.55) 100%)!important;}body.tm-phase8-formal .icn-li{color:#d7ddf0!important;border-color:#697da8!important;background:radial-gradient(circle at 32% 28%,rgba(204,218,246,.42),rgba(58,68,98,.35) 60%,rgba(22,27,42,.62) 100%)!important;}body.tm-phase8-formal .icn-min{color:#bfe6d7!important;border-color:#5b947c!important;background:radial-gradient(circle at 32% 28%,rgba(178,232,210,.40),rgba(56,105,82,.34) 60%,rgba(20,36,29,.62) 100%)!important;}body.tm-phase8-formal .icn-huang{color:#f0c46f!important;border-color:#b48536!important;background:radial-gradient(circle at 32% 28%,rgba(239,196,111,.50),rgba(128,72,24,.38) 60%,rgba(44,25,11,.64) 100%)!important;}body.tm-phase8-formal .icn-wei{color:#f3d894!important;border-color:#b49655!important;background:radial-gradient(circle at 32% 28%,rgba(243,216,148,.50),rgba(103,86,46,.38) 60%,rgba(35,30,17,.64) 100%)!important;}',
      '@media(max-width:1280px){body.tm-phase8-formal #topbar{height:70px!important;}body.tm-phase8-formal .tb-left{height:48px!important;}body.tm-phase8-formal .tb-var.wide .sd{display:none!important;}}',
      '@media(max-width:1080px){body.tm-phase8-formal #topbar{height:66px!important;}body.tm-phase8-formal .tb-var.wide .tb-vn{display:none!important;}}',
      'body.tm-phase8-formal .bar-wentian{height:40px;min-width:92px;border:1px solid rgba(201,168,95,.45)!important;background:linear-gradient(180deg,rgba(44,34,22,.90),rgba(13,10,8,.96))!important;-webkit-text-fill-color:#f0d98c;color:#f0d98c!important;border-radius:2px;letter-spacing:.34em;font-size:16px;padding-left:18px;}',
      'body.tm-phase8-formal .bar-weather{height:42px;min-width:128px;border:1px solid rgba(201,168,95,.20);border-left:none;border-right:1px solid rgba(201,168,95,.24);background:linear-gradient(90deg,rgba(201,168,95,.05),rgba(0,0,0,.10));}',
      'body.tm-phase8-formal .bar-vars{flex:1 1 auto;min-width:0;gap:5px;flex-wrap:nowrap;overflow:hidden;}',
      'body.tm-phase8-formal .bar-var{height:40px;min-width:78px;padding:4px 10px;border:1px solid rgba(201,168,95,.20);border-radius:2px;background:linear-gradient(180deg,rgba(40,31,20,.72),rgba(11,8,6,.72));box-shadow:inset 0 0 0 1px rgba(0,0,0,.35);}',
      'body.tm-phase8-formal .bar-var.wide{min-width:116px;}',
      'body.tm-phase8-formal .bar-var-name{font-size:12px;color:#bda765;letter-spacing:.16em;}',
      'body.tm-phase8-formal .bar-var-value{font-size:16px;color:var(--c,#f0d98c);}',
      'body.tm-phase8-formal .bar-var-sub-item{font-size:12px;line-height:1.05;}',
      'body.tm-phase8-formal .bar-var-sub-item .sk{font-size:11px;color:#917e57;}',
      'body.tm-phase8-formal .bar-more-vars{height:38px;border-color:rgba(201,168,95,.35)!important;background:linear-gradient(180deg,rgba(34,26,17,.86),rgba(11,8,6,.9))!important;color:#d7be73;border-radius:2px;letter-spacing:.2em;}',
      'body.tm-phase8-formal .bar-time{height:44px;min-width:196px;border:1px solid rgba(201,168,95,.32)!important;background:linear-gradient(180deg,rgba(42,32,20,.84),rgba(12,9,7,.92))!important;border-radius:2px;padding:5px 14px;}',
      'body.tm-phase8-formal .bar-time-main{font-size:15px;color:#f0d98c;letter-spacing:.16em;}',
      'body.tm-phase8-formal .bar-time-sub{font-size:12px;color:#9b8b6d;}',
      'body.tm-phase8-formal .gs-rail-left{width:0;border-right:0;background:transparent;overflow:visible;pointer-events:none;}',
      'body.tm-phase8-formal .gs-rail-left .gs-rail{display:none!important;}',
      'body.tm-phase8-formal .gs-rail-right{position:absolute;right:0;top:0;bottom:0;width:58px;background:transparent;border-left:0;overflow:visible;z-index:40;pointer-events:none;}',
      'body.tm-phase8-formal .gs-rail-right>.gs-rail{display:none!important;}body.tm-phase8-formal #tm-right-rail{position:fixed;top:50%;transform:translateY(-50%);left:calc(100vw - 58px);right:auto;z-index:9997;width:48px;display:flex;flex-direction:column;align-items:center;gap:5px;pointer-events:none;font-family:"STKaiti","KaiTi","楷体",serif;}',
      // 2026-05-27·rail chrome 印钮立体化·cap 印章牌·divider 双线+朱点·badge 朱漆方印
      'body.tm-phase8-formal .tm-rc-cap{width:44px;height:22px;display:flex;align-items:center;justify-content:center;border:1px solid rgba(218,179,93,.46);border-radius:2px;background:radial-gradient(ellipse at 50% 30%,rgba(212,68,46,.30),transparent 66%),linear-gradient(180deg,rgba(56,36,18,.94),rgba(22,15,9,.92));color:#efd58f;font:700 11px/1 "STKaiti","KaiTi",serif;letter-spacing:.32em;text-shadow:0 1px 0 rgba(0,0,0,.6);box-shadow:inset 0 1px 0 rgba(255,238,180,.20),inset 0 -1px 0 rgba(0,0,0,.42),0 2px 6px rgba(0,0,0,.36);pointer-events:auto;}',
      'body.tm-phase8-formal .tm-rc-divider{width:38px;height:7px;position:relative;background:radial-gradient(circle at 50% 50%,rgba(212,68,46,.86) 0%,rgba(212,68,46,0) 22%);pointer-events:auto;}body.tm-phase8-formal .tm-rc-divider:before,body.tm-phase8-formal .tm-rc-divider:after{content:"";position:absolute;left:2px;right:2px;height:1px;background:linear-gradient(90deg,transparent,rgba(218,179,93,.55),transparent);}body.tm-phase8-formal .tm-rc-divider:before{top:1px;}body.tm-phase8-formal .tm-rc-divider:after{bottom:1px;}',
      'body.tm-phase8-formal .tm-rc-icon{width:44px;height:46px;border:1px solid rgba(196,162,82,.36);border-radius:6px;background:linear-gradient(180deg,rgba(74,52,28,.88) 0%,rgba(48,32,16,.86) 38%,rgba(20,12,6,.88) 100%);box-shadow:inset 0 1px 0 rgba(255,238,180,.18),inset 1px 0 0 rgba(255,238,180,.06),inset -1px 0 0 rgba(0,0,0,.36),inset 0 -2px 0 rgba(0,0,0,.48),inset 0 -12px 16px rgba(0,0,0,.28),0 6px 12px rgba(0,0,0,.44),0 1px 0 rgba(255,238,180,.06);color:rgba(226,214,184,.82);font:700 15px/1 "STKaiti","KaiTi",serif;display:flex;align-items:center;justify-content:center;position:relative;cursor:pointer;pointer-events:auto;padding:0;transition:transform .12s ease,box-shadow .12s ease,border-color .12s ease;}',
      'body.tm-phase8-formal .tm-rc-icon:before{content:"";position:absolute;left:6px;right:6px;top:0;height:2px;border-radius:0 0 4px 4px;background:linear-gradient(90deg,transparent,rgba(255,238,180,.46),transparent);pointer-events:none;}',
      'body.tm-phase8-formal .tm-rc-icon:hover{border-color:rgba(238,202,118,.72);transform:translateY(-1px);box-shadow:inset 0 1px 0 rgba(255,238,180,.24),inset 1px 0 0 rgba(255,238,180,.08),inset -1px 0 0 rgba(0,0,0,.36),inset 0 -2px 0 rgba(0,0,0,.48),inset 0 -10px 14px rgba(0,0,0,.24),0 9px 16px rgba(0,0,0,.48),0 0 14px rgba(232,197,113,.22);}',
      'body.tm-phase8-formal .tm-rc-icon:active{transform:translateY(1px);box-shadow:inset 0 2px 5px rgba(0,0,0,.46),inset 0 -1px 0 rgba(0,0,0,.30),0 2px 4px rgba(0,0,0,.34);}',
      'body.tm-phase8-formal .tm-rc-icon.hot{border-color:rgba(212,80,58,.62);box-shadow:inset 0 1px 0 rgba(255,202,170,.22),inset 1px 0 0 rgba(255,180,148,.10),inset -1px 0 0 rgba(0,0,0,.38),inset 0 -2px 0 rgba(0,0,0,.48),inset 0 -12px 16px rgba(40,8,4,.34),0 6px 12px rgba(0,0,0,.46),0 0 9px rgba(192,52,38,.28);}',
      'body.tm-phase8-formal .tm-rc-icon.ok{border-color:rgba(140,196,178,.52);box-shadow:inset 0 1px 0 rgba(220,255,232,.18),inset 1px 0 0 rgba(160,220,200,.10),inset -1px 0 0 rgba(0,0,0,.38),inset 0 -2px 0 rgba(0,0,0,.48),inset 0 -12px 16px rgba(8,32,22,.30),0 6px 12px rgba(0,0,0,.44),0 0 8px rgba(96,168,140,.22);}',
      'body.tm-phase8-formal .tm-rc-icon.active{border-color:rgba(238,202,118,.92);box-shadow:inset 0 1px 0 rgba(255,238,180,.42),inset 1px 0 0 rgba(255,238,180,.12),inset -1px 0 0 rgba(0,0,0,.36),inset 0 -2px 0 rgba(0,0,0,.48),inset 0 0 0 1px rgba(232,197,113,.30),0 0 20px rgba(232,197,113,.40),0 9px 18px rgba(0,0,0,.48);}',
      'body.tm-phase8-formal .tm-rc-icon.active:before{background:linear-gradient(90deg,transparent,rgba(255,238,180,.82),transparent);}',
      'body.tm-phase8-formal .tm-rc-count{position:absolute;right:-4px;top:-5px;min-width:15px;height:15px;line-height:13px;padding:0 3px;border-radius:2px;background:linear-gradient(180deg,#c74a30,#811e10);border:1px solid rgba(245,190,122,.62);color:#ffe5c8;font:700 10px/13px "STSong","SimSun",serif;text-align:center;box-sizing:border-box;box-shadow:0 1px 4px rgba(0,0,0,.46),inset 0 1px 0 rgba(255,238,180,.20),inset 0 -1px 0 rgba(0,0,0,.34);letter-spacing:.04em;}',
      // 2026-05-27·右侧栏 SVG icon 尺寸·30px 居中·与 hover 边框反馈解耦
      'body.tm-phase8-formal .tm-rc-icon .tm-rc-svg{width:30px;height:30px;display:block;pointer-events:none;}',
      'body.tm-phase8-formal .tm-rc-icon:hover .tm-rc-svg{filter:drop-shadow(0 0 4px rgba(232,197,113,.42));}',
      'body.tm-phase8-formal .tm-rc-icon.active .tm-rc-svg{filter:drop-shadow(0 0 5px rgba(232,197,113,.58));}',
      'body.tm-phase8-formal .gs-drawer.left{left:0;}',
      'body.tm-phase8-formal .gs-drawer.right{right:58px;width:420px;background:linear-gradient(180deg,rgba(26,21,16,.98),rgba(9,8,6,.98));z-index:70;}',
      'body.tm-phase8-formal #drawerRight.gs-drawer.right:not(.open) .gs-drawer-body,body.tm-phase8-formal #drawerLeft.gs-drawer.left:not(.open) .gs-drawer-body{content-visibility:auto;}',
      'body.tm-phase8-formal #drawerRight.gs-drawer.right:not(.open) .gs-drawer-body *,body.tm-phase8-formal #drawerLeft.gs-drawer.left:not(.open) .gs-drawer-body *{animation-play-state:paused!important;}',
      'body.tm-phase8-formal #drawerRight.gs-drawer.right{position:fixed!important;right:58px!important;top:56px!important;bottom:32px!important;left:auto!important;width:390px!important;transform:translateX(calc(100% + 130px))!important;overflow:hidden!important;pointer-events:none;background:linear-gradient(180deg,rgba(26,22,18,.98),rgba(9,8,7,.985)),radial-gradient(ellipse at 0 8%,rgba(218,184,98,.11),transparent 42%)!important;border-left:1px solid rgba(229,196,116,.42)!important;box-shadow:-10px 0 24px rgba(0,0,0,.34),inset 1px 0 0 rgba(255,239,196,.08)!important;transition:transform .18s ease,box-shadow .18s ease!important;z-index:9996!important;}body.tm-phase8-formal #drawerRight.gs-drawer.right.open{transform:translateX(0)!important;overflow-y:auto!important;overflow-x:hidden!important;pointer-events:auto;box-shadow:-16px 0 34px rgba(0,0,0,.48),inset 1px 0 0 rgba(255,239,196,.10)!important;}',
      'body.tm-phase8-formal #drawerRight.gs-drawer.right.open:before{content:"";position:absolute;left:0;top:16px;bottom:16px;width:3px;background:linear-gradient(180deg,rgba(229,196,116,.76),rgba(142,44,34,.52),rgba(229,196,116,.62));box-shadow:0 0 10px rgba(229,196,116,.22);pointer-events:none;}body.tm-phase8-formal #drawerRight .gs-drawer-head{min-height:48px;padding:10px 12px 9px 16px;border-bottom:1px solid rgba(184,154,83,.20);background:linear-gradient(90deg,rgba(68,46,24,.26),rgba(0,0,0,0) 72%),linear-gradient(180deg,rgba(255,239,196,.035),rgba(0,0,0,.10));}body.tm-phase8-formal #drawerRight .gs-drawer-title{color:#f0d98c;font-size:16px;letter-spacing:.20em;font-weight:500;}body.tm-phase8-formal #drawerRight .gs-drawer-body{padding:12px 12px 18px;}',
      'body.tm-phase8-formal .gc{grid-column:2;position:relative;padding:0;box-sizing:border-box;overflow:hidden;background:#17110c;}',
      // 2026-05-27·tm-phase8-home class 漏加修复·原 selector 依赖 home class 但 race 路径下 home 未加·结果新 UI + 老 .gc tab + 老 panel 双显·改为默认隐藏·legacy 显式显示
      'body.tm-phase8-formal:not(.tm-phase8-legacy) .gc > :not(#tm-phase8-main-shell){display:none!important;}',
      'body.tm-phase8-legacy #tm-phase8-main-shell{display:none!important;}',
      'body.tm-phase8-legacy .gc{padding:16px 72px 28px 18px;overflow:auto;background:#17110c;}',
      'body.tm-phase8-legacy #tm-phase8-left-surface,body.tm-phase8-legacy #tm-phase8-action-tray{display:none!important;}',
      '#tm-phase8-main-shell{position:absolute;inset:0;overflow:hidden;color:#eadfbd;font-family:"STKaiti","KaiTi","楷体",serif;}',
      '.tmf-map-board{position:absolute;inset:0;background:#090705;overflow:hidden;}',
      '.tmf-board-bg{position:absolute;inset:0;background-image:linear-gradient(180deg,rgba(0,0,0,.05),rgba(0,0,0,.36)),url("preview/img/ancient-tabletop-board.png");background-size:cover;background-position:center;filter:saturate(.96) brightness(.72);}',
      '.tmf-map-paper{position:absolute;left:6.2%;right:7.2%;top:8.3%;bottom:7.6%;border-radius:18px;background:linear-gradient(180deg,rgba(210,176,111,.24),rgba(137,95,43,.16)),rgba(168,124,61,.20);box-shadow:inset 0 0 0 1px rgba(238,204,129,.18),inset 0 0 70px rgba(255,255,255,.08),0 18px 46px rgba(0,0,0,.56);overflow:hidden;}',
      '.tmf-map-paper:before{content:"";position:absolute;inset:0;background:radial-gradient(ellipse at 50% 50%,rgba(255,255,255,.08),transparent 60%),radial-gradient(ellipse at 0 50%,rgba(255,255,255,.24),transparent 34%),radial-gradient(ellipse at 100% 50%,rgba(255,255,255,.20),transparent 34%);mix-blend-mode:screen;pointer-events:none;z-index:6;}',
      '.tmf-map-paper:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(185,139,74,.34),rgba(185,139,74,.08) 5%,transparent 13%,transparent 87%,rgba(185,139,74,.09) 95%,rgba(185,139,74,.36)),linear-gradient(180deg,rgba(176,130,66,.30),rgba(176,130,66,.07) 6%,transparent 14%,transparent 86%,rgba(176,130,66,.08) 94%,rgba(176,130,66,.30));mix-blend-mode:multiply;pointer-events:none;z-index:7;}',
      '.tmf-map-stage{position:absolute;inset:0;z-index:2;cursor:grab;touch-action:none;contain:layout paint style;user-select:none;-webkit-user-select:none;-ms-user-select:none;}',
      '.tmf-map-stage.dragging{cursor:grabbing;}',
      'body.tm-phase8-formal #mapwrap{position:absolute;inset:0;overflow:hidden;user-select:none;-webkit-user-select:none;-ms-user-select:none;background:radial-gradient(ellipse at 52% 48%,rgba(0,0,0,.08),rgba(0,0,0,.52) 96%),url("preview/img/ancient-tabletop-board.png") center/cover no-repeat,#120a05;}',
      'body.tm-phase8-formal #mapwrap:before{content:"";position:absolute;inset:0;z-index:0;pointer-events:none;background:radial-gradient(ellipse at 50% 52%,transparent 62%,rgba(224,210,174,.06) 84%,rgba(0,0,0,.22) 100%),linear-gradient(180deg,rgba(20,10,4,.08),rgba(10,5,2,.24));}',
      'body.tm-phase8-formal #mapwrap:after{content:"";position:absolute;left:7%;right:6.5%;top:9%;bottom:7%;z-index:0;pointer-events:none;border-radius:34px;box-shadow:inset 0 0 88px rgba(255,255,255,.11),inset 0 0 0 1px rgba(119,83,38,.08),0 18px 60px rgba(0,0,0,.46);}',
      'body.tm-phase8-formal .map-bg{opacity:.10!important;background-image:repeating-linear-gradient(33deg,transparent 0,transparent 32px,rgba(184,154,83,.05) 32px,rgba(184,154,83,.05) 33px),repeating-linear-gradient(-33deg,transparent 0,transparent 32px,rgba(184,154,83,.04) 32px,rgba(184,154,83,.04) 33px),radial-gradient(circle at 10% 20%,rgba(184,154,83,.05),transparent 25%),radial-gradient(circle at 88% 78%,rgba(140,90,52,.06),transparent 22%)!important;}body.tm-phase8-formal .map-bg:after{content:"";position:absolute;inset:0;background:radial-gradient(ellipse at 50% 50%,transparent 58%,rgba(255,255,255,.07) 80%,rgba(255,255,255,.16) 100%),radial-gradient(circle at 8% 78%,rgba(255,255,255,.09),transparent 25%),radial-gradient(circle at 88% 18%,rgba(255,255,255,.08),transparent 23%);mix-blend-mode:screen;pointer-events:none;}',
      'body.tm-phase8-formal .map-board-corner,body.tm-phase8-formal .desk-prop{display:none!important;}body.tm-phase8-formal .map-zoom-tools{display:none!important;}',
      'body.tm-phase8-formal .map-bg{position:absolute;inset:0;z-index:0;background:radial-gradient(ellipse at 50% 54%,rgba(229,200,128,.10),transparent 52%);pointer-events:none;}',
      'body.tm-phase8-formal .map-bg{opacity:.10!important;background-image:repeating-linear-gradient(33deg,transparent 0,transparent 32px,rgba(184,154,83,.05) 32px,rgba(184,154,83,.05) 33px),repeating-linear-gradient(-33deg,transparent 0,transparent 32px,rgba(184,154,83,.04) 32px,rgba(184,154,83,.04) 33px),radial-gradient(circle at 10% 20%,rgba(184,154,83,.05),transparent 25%),radial-gradient(circle at 88% 78%,rgba(140,90,52,.06),transparent 22%)!important;background-color:transparent!important;}',
      'body.tm-phase8-formal .map-board-corner{position:absolute;width:38px;height:38px;z-index:6;border-color:rgba(221,188,111,.46);pointer-events:none;}body.tm-phase8-formal .map-board-corner.c1{left:6%;top:7.4%;border-left:1px solid;border-top:1px solid;}body.tm-phase8-formal .map-board-corner.c2{right:6%;top:7.4%;border-right:1px solid;border-top:1px solid;}body.tm-phase8-formal .map-board-corner.c3{left:6%;bottom:6.3%;border-left:1px solid;border-bottom:1px solid;}body.tm-phase8-formal .map-board-corner.c4{right:6%;bottom:6.3%;border-right:1px solid;border-bottom:1px solid;}',
      'body.tm-phase8-formal .desk-prop{position:absolute;z-index:5;pointer-events:none;filter:drop-shadow(0 8px 10px rgba(0,0,0,.46));}body.tm-phase8-formal .desk-prop.paperweight{right:9.5%;top:8.6%;width:58px;height:58px;border-radius:50%;background:radial-gradient(circle at 35% 28%,rgba(240,217,151,.44),rgba(66,43,22,.78) 60%,rgba(15,10,6,.92));opacity:.58;}body.tm-phase8-formal .desk-prop.counter{right:15%;bottom:8.8%;width:42px;height:42px;border-radius:50%;background:radial-gradient(circle at 38% 30%,rgba(201,168,95,.66),rgba(89,42,20,.86));opacity:.42;}body.tm-phase8-formal .desk-prop.seal{left:6%;bottom:8.5%;width:54px;height:38px;background:linear-gradient(180deg,rgba(144,41,31,.78),rgba(67,18,14,.86));border:1px solid rgba(236,191,116,.28);opacity:.46;}',
      'body.tm-phase8-formal .ming-map-layer.tmf-map-stage{inset:auto;left:6.6%;top:8.8%;width:86.4%;height:81.4%;z-index:2;overflow:hidden;cursor:grab;touch-action:none;user-select:none;-webkit-user-select:none;-ms-user-select:none;opacity:1;mix-blend-mode:normal;border-radius:0;contain:layout paint style;isolation:isolate;transform:translateZ(0);}',
      'body.tm-phase8-formal #mapwrap svg,body.tm-phase8-formal #mapwrap svg *,body.tm-phase8-formal #mapwrap text,body.tm-phase8-formal .ming-label,body.tm-phase8-formal .tmf-faction-label{user-select:none!important;-webkit-user-select:none!important;-ms-user-select:none!important;}',
      'body.tm-phase8-formal .ming-map-layer.tmf-map-stage:after{content:"";position:absolute;inset:0;z-index:5;pointer-events:none;background:linear-gradient(90deg,rgba(185,139,74,.34),rgba(185,139,74,.08) 5%,transparent 12%,transparent 88%,rgba(185,139,74,.09) 95%,rgba(185,139,74,.36)),linear-gradient(180deg,rgba(176,130,66,.3),rgba(176,130,66,.07) 6%,transparent 14%,transparent 86%,rgba(176,130,66,.08) 94%,rgba(176,130,66,.3));mix-blend-mode:multiply;}',
      'body.tm-phase8-formal .ming-map-camera{position:absolute;inset:0;}body.tm-phase8-formal .ming-map-svg{position:absolute;inset:0;width:100%;height:100%;display:block;}',
      'body.tm-phase8-formal .ming-map-wash{position:absolute;left:5.5%;top:7.5%;width:88.8%;height:84%;z-index:1;pointer-events:none;border-radius:0;mix-blend-mode:screen;background:radial-gradient(ellipse at 50% 48%,rgba(244,225,168,.12),transparent 56%),radial-gradient(ellipse at 0 48%,rgba(255,255,255,.20),transparent 34%),radial-gradient(ellipse at 100% 48%,rgba(255,255,255,.18),transparent 34%);-webkit-mask-image:radial-gradient(ellipse 78% 67% at 50% 53%,transparent 0%,rgba(0,0,0,.08) 50%,rgba(0,0,0,.7) 82%,transparent 100%);}',
      'body.tm-phase8-formal .map-zoom-tools{position:absolute;right:78px;top:112px;z-index:6;display:flex;flex-direction:column;gap:5px;}body.tm-phase8-formal .mz-btn{width:32px;height:32px;border:1px solid rgba(214,188,116,.34);background:rgba(24,19,14,.76);color:#efd58c;font:16px/1 serif;cursor:pointer;}body.tm-phase8-formal .mz-btn:hover{border-color:#f0d98c;background:rgba(72,46,20,.82);}',
      'body.tm-phase8-formal .renwu-tuzhi-entry{position:absolute;left:18px;top:18px;z-index:70;width:282px;height:94px;padding:0;border:0;background:transparent;cursor:pointer;pointer-events:auto;filter:drop-shadow(0 9px 20px rgba(0,0,0,.52));transition:filter .16s ease,transform .16s ease;}body.tm-phase8-formal .renwu-tuzhi-entry:hover{transform:translateY(-1px);filter:drop-shadow(0 11px 22px rgba(0,0,0,.58)) drop-shadow(0 0 8px rgba(212,176,92,.18));}body.tm-phase8-formal .renwu-tuzhi-img{width:100%;height:100%;display:block;object-fit:cover;border-radius:5px;}',
      'body.tm-phase8-formal .map-tools-dock{position:absolute;left:18px;top:112px;z-index:60;width:276px;pointer-events:auto;}body.tm-phase8-formal .map-tools-toggle{height:32px;min-width:118px;padding:0 10px 0 12px;border:1px solid rgba(184,154,83,.32);background:linear-gradient(180deg,rgba(36,30,24,.80),rgba(18,16,14,.66));color:#efd58c;font-family:"STKaiti","KaiTi","楷体",serif;letter-spacing:.12em;cursor:pointer;display:flex;align-items:center;gap:8px;}body.tm-phase8-formal .map-tools-mode{color:#8dbdab;font-size:12px;}body.tm-phase8-formal .map-tools-caret{margin-left:auto;transition:transform .16s;}body.tm-phase8-formal .map-tools-dock.open .map-tools-caret{transform:rotate(180deg);}body.tm-phase8-formal .map-tools-pop{display:none;margin-top:7px;width:276px;padding:8px 10px 10px;background:linear-gradient(180deg,rgba(36,30,24,.80),rgba(18,16,14,.66));border:1px solid rgba(184,154,83,.26);border-left:2px solid rgba(126,184,167,.55);box-shadow:0 8px 20px rgba(0,0,0,.34);}body.tm-phase8-formal .map-tools-dock.open .map-tools-pop{display:block;}',
      'body.tm-phase8-formal .map-layer-bar{position:static;display:flex;flex-wrap:wrap;gap:6px;margin:0 0 8px;}body.tm-phase8-formal .map-layer,body.tm-phase8-formal .mnp-row button{padding:5px 9px;border:1px solid rgba(184,154,83,.28);background:rgba(18,16,14,.54);color:#d8c27c;cursor:pointer;font:12px/1 "STKaiti","KaiTi","楷体",serif;letter-spacing:.12em;}body.tm-phase8-formal .map-layer.on,body.tm-phase8-formal .mnp-row button.on{border-color:#e5c875;color:#f2da91;background:rgba(72,46,20,.72);}body.tm-phase8-formal .map-nav-panel{padding:0;background:transparent;border:0;box-shadow:none;color:#b9aa8a;}body.tm-phase8-formal .mnp-title{color:#8dbdab;font-size:12px;letter-spacing:.18em;margin-bottom:6px;}body.tm-phase8-formal .mnp-row{display:flex;gap:6px;}body.tm-phase8-formal .mnp-note{margin-top:7px;font-size:12px;line-height:1.45;color:#8f846f;}',
      'body.tm-phase8-formal .map-alert-strip{position:absolute;left:320px;top:20px;z-index:58;display:flex;gap:7px;}body.tm-phase8-formal .map-alert{border:1px solid rgba(214,188,116,.34);background:rgba(29,22,15,.68);color:#d8c27c;font:12px/1 "STKaiti","KaiTi","楷体",serif;letter-spacing:.12em;padding:6px 10px;cursor:pointer;}body.tm-phase8-formal .map-alert.hot{color:#e5a28e;border-color:rgba(198,91,61,.55);}body.tm-phase8-formal .map-alert.ok{color:#a8d4c5;border-color:rgba(126,184,167,.45);}',
      'body.tm-phase8-formal .map-legend{position:absolute;right:118px;bottom:92px;top:auto;z-index:58;min-width:268px;padding:8px 10px 9px;background:linear-gradient(180deg,rgba(36,30,24,.76),rgba(18,16,14,.62));border:1px solid rgba(184,154,83,.24);border-left:2px solid rgba(126,184,167,.55);box-shadow:0 8px 20px rgba(0,0,0,.34);}',
      'body.tm-phase8-formal .map-hint{position:absolute;left:320px;bottom:92px;z-index:55;color:rgba(229,211,164,.72);font:12px/1.4 "STSong","SimSun",serif;letter-spacing:.08em;text-shadow:0 2px 6px #000;}',
      'body.tm-phase8-formal .map-search-row{display:flex;gap:6px;align-items:center;}body.tm-phase8-formal .map-search-label{color:#8dbdab;font:12px/1 "STKaiti","KaiTi","楷体",serif;letter-spacing:.18em;white-space:nowrap;}body.tm-phase8-formal .map-search{width:100%;height:24px;padding:0 8px;border:1px solid rgba(214,188,116,.28);border-radius:2px;background:rgba(8,7,6,.48);color:#e6d7ad;font:12px/1 "STSong","SimSun",serif;outline:none;}body.tm-phase8-formal .map-search:focus{border-color:#d6bc74;box-shadow:0 0 0 1px rgba(214,188,116,.16);}',
      'body.tm-phase8-formal .map-search-results{margin-top:7px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px;}body.tm-phase8-formal .map-search-results button{min-width:0;padding:4px 6px;border:1px solid rgba(214,188,116,.18);border-radius:2px;background:rgba(18,16,14,.48);color:#d9c893;cursor:pointer;font:12px/1.2 "STKaiti","KaiTi","楷体",serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:left;}body.tm-phase8-formal .map-search-results button:hover{color:#f0d98c;border-color:rgba(214,188,116,.45);}body.tm-phase8-formal .map-search-results b{display:block;overflow:hidden;text-overflow:ellipsis;font-weight:500;}body.tm-phase8-formal .map-search-results span{display:block;margin-top:2px;color:#8dbdab;font-size:11px;overflow:hidden;text-overflow:ellipsis;}',
      'body.tm-phase8-formal .map-legend-title{display:flex;justify-content:space-between;gap:12px;align-items:center;color:#f0d98c;font:12px/1 "STKaiti","KaiTi","楷体",serif;letter-spacing:.18em;}body.tm-phase8-formal .map-legend-mode{display:inline-flex;align-items:center;gap:6px;min-width:0;}body.tm-phase8-formal .map-legend-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}body.tm-phase8-formal .map-legend-sub{color:#9d927c;font-size:11px;letter-spacing:.08em;white-space:nowrap;}body.tm-phase8-formal .map-legend-mark{width:8px;height:8px;border-radius:50%;background:#d6b465;box-shadow:0 0 10px rgba(214,180,101,.5);}',
      'body.tm-phase8-formal .map-legend-main{margin-top:7px;}body.tm-phase8-formal .map-legend-bar{height:8px;border:1px solid rgba(0,0,0,.40);background:linear-gradient(90deg,#4f8d74,#d6b465,#b94534);box-shadow:inset 0 1px 0 rgba(255,255,255,.15);}body.tm-phase8-formal .map-legend-scale{margin-top:4px;display:flex;justify-content:space-between;color:#b9aa8a;font-size:11px;letter-spacing:.08em;}body.tm-phase8-formal .map-legend-detail{margin-top:7px;padding-top:7px;border-top:1px solid rgba(184,154,83,.16);}body.tm-phase8-formal .map-legend-note{margin:0;color:rgba(218,205,166,.58);font-size:11.5px;line-height:1.45;}',
      'body.tm-phase8-formal .map-owner-row{margin-top:7px;display:flex;align-items:center;justify-content:space-between;gap:8px;color:#b9aa8a;font-size:11.5px;}body.tm-phase8-formal .map-owner-swatch{display:inline-flex;align-items:center;gap:5px;margin-right:8px;white-space:nowrap;}body.tm-phase8-formal .map-owner-swatch i{width:10px;height:10px;border:1px solid rgba(255,240,180,.42);box-shadow:0 0 0 1px rgba(0,0,0,.35);}',
      'body.tm-phase8-formal .tmf-map-legend{right:118px;bottom:92px;width:auto;min-width:268px;z-index:58;}body.tm-phase8-formal .map-hint{left:50%;bottom:10px;transform:translateX(-50%);z-index:59;padding:6px 16px;background:linear-gradient(180deg,rgba(36,30,24,.85),rgba(18,16,14,.85));border:1px solid rgba(184,154,83,.26);border-radius:14px;color:#b9aa8a;font-size:12px;letter-spacing:.12em;text-shadow:none;}',
      'body.tm-phase8-formal .map-scale-strip{position:absolute;left:50%;top:54px;transform:translateX(-50%);z-index:58;display:flex;gap:4px;padding:3px;background:rgba(18,16,14,.56);border:1px solid rgba(184,154,83,.22);box-shadow:0 5px 14px rgba(0,0,0,.32);pointer-events:auto;}body.tm-phase8-formal .map-scale{min-width:48px;padding:4px 8px;border:1px solid transparent;border-radius:2px;color:#b9aa8a;background:transparent;cursor:pointer;font:12px/1 "STKaiti","KaiTi","楷体",serif;letter-spacing:.16em;}body.tm-phase8-formal .map-scale.on,body.tm-phase8-formal .map-scale[aria-pressed="true"]{color:#f0d98c;border-color:rgba(214,188,116,.45);background:rgba(184,154,83,.14);}',
      'body.tm-phase8-formal .map-alert-strip{left:50%;top:18px;transform:translateX(-50%);z-index:58;}body.tm-phase8-formal .map-alert{border-radius:2px;}',
      '.tmf-map-loading{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#d7be73;font-size:18px;letter-spacing:.2em;background:rgba(10,8,6,.34);}',
      '.tmf-map-basemap{position:absolute;inset:0;width:100%;height:100%;object-fit:fill;opacity:.72;mix-blend-mode:multiply;filter:saturate(.95) contrast(1.08) brightness(1.03);pointer-events:none;}',
      'body.tm-phase8-formal .generated-basemap{opacity:1;mix-blend-mode:normal;filter:none;}',
      '.tmf-map-basemap-empty{background:radial-gradient(circle at 40% 35%,rgba(217,184,116,.25),transparent 48%),linear-gradient(135deg,rgba(94,72,37,.34),rgba(31,49,46,.18));}',
      '#tmf-formal-map{position:absolute;inset:0;width:100%;height:100%;display:block;}',
      '.tmf-map-world{transform-box:fill-box;transform-origin:0 0;}',
      '.tmf-map-paper-fill{fill:rgba(204,158,84,.16);}',
      '.tmf-generated-basemap{pointer-events:none;}.ming-map-paper{fill:url(#tmf-ming-paper);opacity:.07;pointer-events:none;}.east-sea-wash{fill:url(#tmf-east-sea);opacity:.035;pointer-events:none;}',
      '.east-base-region{display:block;pointer-events:none;fill:#778060;fill-opacity:.075;stroke:none;mix-blend-mode:multiply;fill-rule:evenodd;}.east-coastline{display:block;pointer-events:none;fill:none;stroke:#4b2d16;stroke-width:.58;stroke-opacity:.18;stroke-linejoin:round;stroke-linecap:round;vector-effect:non-scaling-stroke;}',
      '.east-lake{display:none;pointer-events:none;fill:#6c9288;fill-opacity:.07;stroke:#30554f;stroke-width:.5;stroke-opacity:.14;stroke-linejoin:round;stroke-linecap:round;vector-effect:non-scaling-stroke;}.east-river{display:none;pointer-events:none;fill:none;stroke:#315f59;stroke-width:.56;stroke-opacity:.15;stroke-linejoin:round;stroke-linecap:round;vector-effect:non-scaling-stroke;}.east-river.major{stroke-width:.86;stroke-opacity:.22;}',
      '.east-geo-grid{display:none;pointer-events:none;fill:none;stroke:#6b542b;stroke-width:.42;stroke-opacity:.08;vector-effect:non-scaling-stroke;stroke-dasharray:4 14;}.east-base-label{display:none;pointer-events:none;text-anchor:middle;dominant-baseline:middle;fill:#5a4022;opacity:.18;font-size:18px;letter-spacing:.22em;font-family:"STKaiti","KaiTi","SimSun",serif;}',
      '.terrain-ridge,.terrain-hill,.terrain-river,.terrain-shore{display:none;pointer-events:none;fill:none;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke;}.terrain-ridge{stroke:#4d3820;stroke-width:1.1;stroke-opacity:.045;stroke-dasharray:13 9;}.terrain-hill{stroke:#5d4b2b;stroke-width:.82;stroke-opacity:.035;stroke-dasharray:5 8;}.terrain-river{stroke:#446b65;stroke-width:1.25;stroke-opacity:.045;}.terrain-river.major{stroke-width:1.7;stroke-opacity:.06;}.terrain-shore{stroke:#775c34;stroke-width:.66;stroke-opacity:.025;}',
      '.ming-region-wash{pointer-events:none;stroke:none;fill-opacity:.055;mix-blend-mode:multiply;fill-rule:evenodd;}.ming-region-halo{pointer-events:none;fill:none;stroke:rgba(230,193,115,.1);stroke-width:1.8;stroke-linejoin:round;stroke-linecap:round;vector-effect:non-scaling-stroke;}',
      '.tmf-map-grain{filter:url(#tmfPaperNoise);pointer-events:none;}',
      '.tmf-ocean{fill:#5f8178;fill-opacity:.26;stroke:#355a54;stroke-width:.75;stroke-opacity:.23;vector-effect:non-scaling-stroke;mix-blend-mode:multiply;}',
      '.tmf-ocean-label{pointer-events:none;text-anchor:middle;dominant-baseline:middle;fill:rgba(230,221,184,.42);font-size:16px;letter-spacing:.22em;font-weight:700;}',
      '.tmf-region{fill-opacity:.64;stroke:#2c190b;stroke-width:1.05;stroke-opacity:.76;stroke-linejoin:round;stroke-linecap:round;vector-effect:non-scaling-stroke;cursor:pointer;mix-blend-mode:multiply;transition:fill-opacity .12s,stroke-opacity .12s;}',
      'body.tm-phase8-formal .ming-region{fill-opacity:.68;stroke:rgba(36,25,14,.78);stroke-width:.92;stroke-opacity:.95;mix-blend-mode:normal;filter:drop-shadow(0 .7px .4px rgba(0,0,0,.18));}',
      '.tmf-region:hover{fill-opacity:.82;stroke:#f0d98c;stroke-opacity:.9;}',
      '.tmf-region-label{pointer-events:none;text-anchor:middle;dominant-baseline:middle;fill:#21160c;paint-order:stroke;stroke:rgba(239,214,154,.55);stroke-width:2.2;font-size:15px;font-weight:700;letter-spacing:.12em;opacity:.86;}',
      'body.tm-phase8-formal .ming-label{font-size:12px;letter-spacing:.08em;fill:#21160d;text-shadow:0 1px 0 rgba(247,226,163,.56),0 0 3px rgba(255,238,183,.28);}',
      '.tmf-map-stage.zoomed .tmf-region-label{font-size:12px;letter-spacing:.04em;}',
      '.tmf-map-tools{position:absolute;left:18px;top:18px;z-index:12;display:flex;gap:4px;padding:3px;background:rgba(18,16,14,.56);border:1px solid rgba(184,154,83,.22);box-shadow:0 5px 14px rgba(0,0,0,.32);}',
      '.tmf-map-mode{min-width:48px;padding:5px 9px;border:1px solid transparent;color:#d8c27c;background:transparent;cursor:pointer;font-family:inherit;letter-spacing:.12em;}',
      '.tmf-map-mode:hover,.tmf-map-mode.active{border-color:rgba(212,190,122,.45);background:rgba(72,46,20,.58);color:#f2d891;}',
      '.tmf-map-alerts{position:absolute;left:50%;top:18px;transform:translateX(-50%);z-index:12;display:flex;gap:8px;}',
      '.tmf-map-alerts button{padding:6px 12px;border:1px solid rgba(184,154,83,.30);background:linear-gradient(180deg,rgba(36,30,24,.78),rgba(18,16,14,.68));color:#e6cf8e;font-family:inherit;cursor:pointer;letter-spacing:.14em;}',
      '.tmf-map-legend{position:absolute;right:18px;bottom:82px;width:276px;z-index:12;background:linear-gradient(180deg,rgba(36,30,24,.78),rgba(18,16,14,.66));border:1px solid rgba(184,154,83,.26);box-shadow:0 8px 20px rgba(0,0,0,.35);padding:10px;font-family:inherit;}',
      '.tmf-legend-title{color:#d7be73;font-size:13px;letter-spacing:.18em;margin-bottom:8px;border-bottom:1px solid rgba(184,154,83,.18);padding-bottom:6px;}',
      '.tmf-legend-list{display:grid;grid-template-columns:1fr 1fr;gap:5px;}.tmf-legend-list button{display:flex;align-items:center;gap:6px;border:1px solid rgba(184,154,83,.16);background:rgba(255,255,255,.025);color:#d8cba8;font-family:inherit;font-size:12px;padding:5px;cursor:pointer;}.tmf-legend-list span{width:12px;height:12px;border:1px solid rgba(255,240,180,.4);flex-shrink:0;}',
      '.tmf-legend-ramp{display:grid;grid-template-columns:1fr 1fr 1fr;height:10px;border:1px solid rgba(255,240,180,.20);}.tmf-legend-note{margin-top:7px;color:#9f9277;font-size:12px;}',
      '.tmf-map-tip{position:fixed;z-index:9999;display:none;min-width:150px;max-width:260px;background:rgba(18,14,10,.93);border:1px solid rgba(201,168,95,.52);box-shadow:0 8px 24px rgba(0,0,0,.55);padding:8px 10px;color:#d7c49b;pointer-events:none;font-family:"STKaiti","KaiTi","楷体",serif;}',
      '.tmf-map-tip.show{display:block;}.tmf-map-tip b{display:block;color:#f0d98c;font-size:15px;letter-spacing:.14em;margin-bottom:3px;}.tmf-map-tip span{font-size:12px;color:#a99d83;}',
      /* 2026-06-11 签注（视图相关读数+判语）·哨牌·图例五档 */
      '.tmf-map-tip .tip-owner{display:block;font-size:11px;color:#9b8d70;letter-spacing:.1em;margin:-1px 0 4px;}.tmf-map-tip .tip-body{border-top:1px solid rgba(201,168,95,.22);padding-top:4px;}',
      '.tmf-map-tip .tip-row{display:flex;justify-content:space-between;gap:10px;padding:2px 0;font-size:12px;}.tmf-map-tip .tip-k{color:#a99d83;letter-spacing:.08em;flex:0 0 auto;}.tmf-map-tip .tip-v{color:#e6d4a3;font-family:"STSong","SimSun",serif;font-weight:bold;text-align:right;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:170px;}.tmf-map-tip .tip-v.zhu{color:#d98a77;}.tmf-map-tip .tip-v.jin{color:#8dbdab;}',
      '.tmf-map-tip .tip-verdict{margin-top:5px;padding:5px 8px;border-left:3px solid rgba(201,168,95,.55);background:rgba(201,168,95,.08);font-size:11.5px;line-height:1.65;color:#cdbd97;font-family:"FangSong","STFangsong","仿宋",serif;}.tmf-map-tip .tip-verdict.wei{border-left-color:#c64a3e;background:rgba(198,74,62,.10);color:#dba091;}.tmf-map-tip .tip-verdict.an{border-left-color:#6fa291;background:rgba(111,162,145,.10);color:#9fc3b4;}',
      '.tmf-map-tip .tip-foot{display:flex;justify-content:space-between;margin-top:5px;padding-top:4px;border-top:1px dashed rgba(201,168,95,.22);}.tmf-map-tip .tip-foot em{font-style:normal;font-size:10px;color:#857a62;letter-spacing:.12em;}',
      '.tmf-sentinel circle{fill:rgba(20,14,7,.78);stroke:rgba(216,185,106,.55);stroke-width:1;}.tmf-sentinel text{font-family:"STSong","SimSun",serif;font-size:11px;font-weight:bold;fill:#ecd79b;text-anchor:middle;dominant-baseline:central;}.tmf-sentinel.warn circle{stroke:#c64a3e;}.tmf-sentinel.warn text{fill:#f0b9af;}.tmf-sentinel{pointer-events:none;}',
      '.tmf-grade-bar{display:flex!important;grid-template-columns:none!important;}.tmf-grade-bar i{flex:1;height:10px;}.tmf-grade-scale{display:flex;justify-content:space-between;font-size:11px;color:#b3a482;letter-spacing:.06em;margin-top:3px;}.tmf-grade-scale span{flex:1;text-align:center;}',
      '.tmf-map-dossier{position:absolute;left:9.5%;top:9%;bottom:8%;width:min(820px,66vw);z-index:30;background:linear-gradient(180deg,rgba(28,22,16,.96),rgba(10,8,6,.97));border:1px solid rgba(201,168,95,.48);box-shadow:0 18px 58px rgba(0,0,0,.72),inset 0 0 0 1px rgba(0,0,0,.40);display:flex;flex-direction:column;}',
      '.tmf-map-dossier header{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;padding:16px 18px;border-bottom:1px solid rgba(201,168,95,.22);}.tmf-map-dossier header span{font-size:12px;color:#8dbdab;letter-spacing:.18em;}.tmf-map-dossier h3{margin:4px 0 0;color:#f0d98c;font-size:28px;letter-spacing:.20em;font-weight:500;}.tmf-map-dossier header p{margin:6px 0 0;color:#aa9c7e;font-size:13px;}.tmf-map-dossier header button{width:30px;height:30px;border:1px solid rgba(201,168,95,.28);background:rgba(255,255,255,.04);color:#d8c27c;cursor:pointer;}',
      '.tmf-map-dossier main{padding:16px 18px;overflow-y:auto;scrollbar-width:thin;scrollbar-color:rgba(201,168,95,.50) transparent;}.tmf-dossier-hero{display:grid;grid-template-columns:116px 1fr;gap:15px;align-items:stretch;margin-bottom:14px;padding:13px;border:1px solid rgba(184,154,83,.20);background:linear-gradient(90deg,rgba(201,168,95,.08),rgba(255,255,255,.02));}.tmf-map-seal{height:116px;border:1px solid rgba(201,168,95,.42);display:flex;align-items:center;justify-content:center;font-size:54px;color:#d7be73;background:radial-gradient(circle,rgba(201,168,95,.18),rgba(0,0,0,.18));}.tmf-map-seal.faction{background:radial-gradient(circle,var(--seal),rgba(0,0,0,.30));color:#fff1bc;font-size:36px;}',
      '.tmf-dossier-hero b{display:block;color:#ecd58e;font-size:20px;letter-spacing:.14em;}.tmf-dossier-hero span{display:block;margin-top:5px;color:#8dbdab;}.tmf-dossier-hero p{margin:10px 0 0;color:#c2b28f;line-height:1.7;font-size:14px;}',
      '.tmf-map-dossier h4{margin:18px 0 9px;color:#d7be73;font-size:16px;letter-spacing:.22em;font-weight:500;border-bottom:1px solid rgba(184,154,83,.18);padding-bottom:7px;}.tmf-dossier-rows{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;}.tmf-dossier-rows div{min-height:48px;background:rgba(255,255,255,.025);border:1px solid rgba(184,154,83,.14);padding:7px 8px;}.tmf-dossier-rows span{display:block;color:#8f846f;font-size:12px;}.tmf-dossier-rows b{display:block;margin-top:4px;color:#e4d4a8;font-size:15px;line-height:1.35;}',
      '.tmf-region-links{display:flex;flex-wrap:wrap;gap:6px;}.tmf-region-links button{border:1px solid rgba(184,154,83,.22);background:rgba(184,154,83,.06);color:#d8c27c;font-family:inherit;padding:5px 9px;cursor:pointer;}',
      '.tmf-map-dossier footer{display:flex;gap:8px;justify-content:flex-end;padding:12px 16px;border-top:1px solid rgba(201,168,95,.18);}.tmf-map-dossier footer button{border:1px solid rgba(184,154,83,.32);background:rgba(184,154,83,.08);color:#e6cf8e;font-family:inherit;padding:7px 12px;cursor:pointer;}',
      'body.tm-phase8-formal #mapwrap .map-alert-strip{display:flex!important;left:50%!important;top:18px!important;transform:translateX(-50%)!important;gap:7px!important;z-index:68!important;}body.tm-phase8-formal #mapwrap .map-alert{max-width:196px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}body.tm-phase8-formal.province-panel-open .renwu-tuzhi-entry,body.tm-phase8-formal.province-panel-open .map-tools-dock{opacity:0!important;pointer-events:none!important;transition:opacity .12s ease;}',
      /* ════ 方志/谱牒册页（2026-06-12·替代 codex 版 ppop 样式）════ */
      'body.tm-phase8-formal #ppop.tmf-book{position:fixed;display:none;left:16px;top:62px;bottom:14px;right:auto;z-index:130;width:392px;max-height:none;padding:0;box-sizing:border-box;border:1px solid rgba(96,68,28,.65);border-radius:3px 8px 8px 3px;background:linear-gradient(180deg,#fbf6e8,#f4ecd6 46%,#e9dcbc);box-shadow:inset 0 0 0 1px rgba(255,252,238,.55),inset 0 0 44px rgba(120,84,34,.16),8px 12px 34px rgba(0,0,0,.55);color:#262015;font-family:"STKaiti","KaiTi","楷体",serif;transition:width .38s cubic-bezier(.6,.05,.25,1);}',
      'body.tm-phase8-formal #ppop.tmf-book.show{display:block;}body.tm-phase8-formal #ppop.tmf-book::before{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;z-index:0;opacity:.7;background:radial-gradient(34% 16% at 78% 8%,rgba(190,150,80,.08),transparent 70%),repeating-linear-gradient(93deg,rgba(140,108,58,.045) 0 1px,transparent 1px 7px),repeating-linear-gradient(2deg,rgba(140,108,58,.035) 0 1px,transparent 1px 11px);}body.tm-phase8-formal #ppop.tmf-book::after{content:"";position:absolute;left:9px;top:10px;bottom:10px;width:1px;z-index:1;pointer-events:none;background:linear-gradient(180deg,transparent,rgba(124,93,33,.5) 6%,rgba(124,93,33,.5) 94%,transparent);}',
      'body.tm-phase8-formal #ppop.tmf-book.bk-folded{width:46px;overflow:hidden;}#ppop.tmf-book .bk-inner{position:relative;z-index:3;display:flex;flex-direction:column;height:100%;opacity:1;transition:opacity .18s ease .12s;}#ppop.tmf-book.bk-folded .bk-inner{opacity:0;pointer-events:none;}#ppop.tmf-book.bk-folded .bk-jianqian{opacity:0;pointer-events:none;}#ppop.tmf-book.bk-folded .bk-straddle{opacity:0;}',
      '#ppop.tmf-book .bk-spine{position:absolute;inset:0;z-index:8;display:none;flex-direction:column;align-items:center;cursor:pointer;border-radius:3px 8px 8px 3px;background:linear-gradient(90deg,#7a5a2e,#5d3f20 40%,#4a3118);box-shadow:inset 0 0 0 1px rgba(255,240,200,.14);}#ppop.tmf-book.bk-folded .bk-spine{display:flex;}#ppop.tmf-book .bk-spine .sp-seal{margin:14px 0 10px;width:26px;height:26px;border-radius:50%;border:1.5px solid rgba(198,74,62,.9);display:grid;place-items:center;color:#e8b1a8;font-size:11px;background:radial-gradient(circle,rgba(168,50,40,.5),rgba(122,32,24,.3));}#ppop.tmf-book .bk-spine .sp-label{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;writing-mode:vertical-rl;text-orientation:upright;color:#ecd79b;font-size:14px;letter-spacing:.4em;}#ppop.tmf-book .bk-spine .sp-label small{font-size:10px;color:rgba(236,215,155,.6);letter-spacing:.28em;}',
      '#ppop.tmf-book .bk-straddle{position:absolute;right:-1px;top:46%;width:22px;height:44px;z-index:6;pointer-events:none;opacity:.85;border-radius:22px 0 0 22px;border:2px solid rgba(168,50,40,.78);border-right:0;background:radial-gradient(circle at 100% 50%,rgba(198,74,62,.30),rgba(168,50,40,.16) 60%,transparent);}#ppop.tmf-book .bk-straddle i{position:absolute;left:5px;top:50%;transform:translateY(-50%);font-style:normal;writing-mode:vertical-rl;font-size:9.5px;letter-spacing:2px;color:rgba(122,32,24,.85);font-weight:bold;}',
      '#ppop.tmf-book .bk-head{flex:0 0 auto;position:relative;padding:13px 16px 9px 24px;border-bottom:1px solid rgba(124,93,33,.34);}#ppop.tmf-book .bk-kind{position:absolute;right:12px;top:11px;display:flex;align-items:center;gap:5px;z-index:4;}#ppop.tmf-book .bk-tag{font-size:10px;letter-spacing:.28em;color:#7c5d21;border:1px solid rgba(168,131,58,.45);padding:3px 6px 3px 8px;background:rgba(255,250,235,.6);}',
      '#ppop.tmf-book .bk-close{width:25px;height:25px;border-radius:50%;border:1px solid rgba(124,93,33,.5);background:rgba(255,252,240,.65);color:#7c5d21;font-size:13px;line-height:1;cursor:pointer;display:grid;place-items:center;transition:all .16s;font-family:inherit;padding:0;}#ppop.tmf-book .bk-close:hover{background:#a83228;border-color:#7a2018;color:#fff;}#ppop.tmf-book .bk-close.x:hover{transform:rotate(90deg);}',
      '#ppop.tmf-book .bk-bigseal{position:absolute;right:46px;top:12px;width:48px;height:48px;transform:rotate(9deg);pointer-events:none;opacity:.45;z-index:1;border:2.5px solid rgba(168,50,40,.75);border-radius:7px;display:grid;place-items:center;background:radial-gradient(circle at 40% 30%,rgba(198,74,62,.22),rgba(168,50,40,.1));}#ppop.tmf-book .bk-bigseal.round{border-radius:50%;}#ppop.tmf-book .bk-bigseal i{font-style:normal;font-size:14px;line-height:1.1;letter-spacing:1px;color:rgba(122,32,24,.88);font-weight:bold;writing-mode:vertical-rl;text-orientation:upright;}',
      '#ppop.tmf-book .bk-title-row{display:flex;align-items:flex-end;gap:10px;padding-right:92px;min-width:0;}#ppop.tmf-book .bk-name{font-size:27px;font-weight:bold;letter-spacing:.12em;line-height:1.05;color:#262015;white-space:nowrap;flex:0 0 auto;text-shadow:0 1px 0 rgba(255,255,255,.65),0 2px 5px rgba(140,100,40,.25);}#ppop.tmf-book .bk-name-sub{padding-bottom:4px;font-size:11.5px;color:#9a8a6a;letter-spacing:.18em;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '#ppop.tmf-book .bk-govline{margin-top:6px;display:flex;flex-wrap:wrap;align-items:center;gap:6px;}#ppop.tmf-book .bk-pill{display:inline-flex;align-items:center;gap:5px;font-size:11px;letter-spacing:.06em;color:#564732;border:1px solid rgba(168,131,58,.4);background:rgba(255,250,235,.55);padding:3px 8px;border-radius:2px;}#ppop.tmf-book .bk-pill b{color:#262015;font-weight:600;}#ppop.tmf-book .bk-pill.owner{cursor:pointer;border-color:rgba(168,50,40,.5);background:rgba(198,74,62,.1);transition:all .15s;}#ppop.tmf-book .bk-pill.owner:hover{background:#a83228;color:#fff;}#ppop.tmf-book .bk-pill.owner:hover b{color:#fff;}#ppop.tmf-book .bk-pill.owner .dot{width:7px;height:7px;border-radius:50%;background:#8a7450;}#ppop.tmf-book .bk-pill.hostile{border-color:rgba(168,50,40,.55);color:#7a2018;background:rgba(198,74,62,.08);}',
      '#ppop.tmf-book .bk-desc{margin:8px 0 0;font:12px/1.75 "FangSong","STFangsong","仿宋",serif;color:#564732;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;cursor:pointer;position:relative;}#ppop.tmf-book .bk-desc.open{display:block;-webkit-line-clamp:unset;}#ppop.tmf-book .bk-desc::after{content:"展读 ▾";position:absolute;right:0;bottom:0;padding-left:24px;font-size:10.5px;color:#7c5d21;letter-spacing:.1em;background:linear-gradient(90deg,transparent,#f4ecd6 40%);}#ppop.tmf-book .bk-desc.open::after{content:"收起 ▴";position:static;background:none;display:inline-block;margin-left:8px;padding-left:0;}',
      '#ppop.tmf-book .bk-stats{flex:0 0 auto;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:5px;padding:9px 12px 8px 22px;border-bottom:1px solid rgba(124,93,33,.3);overflow:hidden;box-sizing:border-box;max-width:100%;}#ppop.tmf-book .bk-stat{position:relative;min-width:0;padding:6px 3px 5px;text-align:center;border:1px solid rgba(150,114,52,.34);border-radius:3px;background:linear-gradient(180deg,rgba(255,253,244,.85),rgba(244,235,210,.6));box-shadow:0 1px 4px rgba(120,84,34,.14),inset 0 1px 0 rgba(255,255,255,.7);}#ppop.tmf-book .bk-stat[data-bk-cause]{cursor:pointer;}#ppop.tmf-book .bk-stat:hover{box-shadow:0 3px 8px rgba(120,84,34,.24);}#ppop.tmf-book .bk-stat .k{display:block;font-size:10px;letter-spacing:.2em;color:#7c5d21;margin-bottom:1px;}#ppop.tmf-book .bk-stat .v{display:block;font-family:"STSong","SimSun",serif;font-size:14.5px;font-weight:bold;color:#262015;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}#ppop.tmf-book .bk-stat .n{display:block;font-size:9px;color:#9a8a6a;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}#ppop.tmf-book .bk-stat.warn{border-color:rgba(168,50,40,.45);}#ppop.tmf-book .bk-stat.warn .v{color:#a83228;}#ppop.tmf-book .bk-stat[data-bk-cause] .k::after{content:"›";display:inline-block;margin-left:2px;color:#a8833a;transform:rotate(90deg);opacity:.65;}',
      '#ppop.tmf-book .bk-scroll{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;padding:2px 14px 12px 22px;scroll-behavior:smooth;scrollbar-width:thin;scrollbar-color:rgba(124,93,33,.4) transparent;}#ppop.tmf-book .bk-scroll::-webkit-scrollbar{width:5px;}#ppop.tmf-book .bk-scroll::-webkit-scrollbar-thumb{background:rgba(124,93,33,.35);border-radius:3px;}',
      '#ppop.tmf-book .bk-juan{padding:12px 0 4px;}#ppop.tmf-book .bk-juan + .bk-juan{border-top:1px dashed rgba(124,93,33,.3);}#ppop.tmf-book .bk-jt{display:flex;align-items:center;gap:8px;margin-bottom:8px;}#ppop.tmf-book .bk-jseal{width:20px;height:20px;flex:0 0 auto;display:grid;place-items:center;border-radius:3px;font-size:11px;color:#fff;background:linear-gradient(155deg,#c64a3e,#7a2018);border:1px solid rgba(122,32,24,.55);}#ppop.tmf-book .bk-jt b{font-size:14.5px;letter-spacing:.22em;color:#262015;}#ppop.tmf-book .bk-jt small{font-size:10px;color:#9a8a6a;letter-spacing:.1em;margin-left:auto;}',
      '#ppop.tmf-book .bk-lan{display:grid;grid-template-columns:1fr 1fr;gap:0 14px;}#ppop.tmf-book .bk-lan.one{grid-template-columns:1fr;}#ppop.tmf-book .bk-lr{display:flex;align-items:baseline;justify-content:space-between;gap:9px;padding:4px 1px;border-bottom:1px solid rgba(86,71,50,.13);min-width:0;}#ppop.tmf-book .bk-lr[data-bk-cause]{cursor:pointer;}#ppop.tmf-book .bk-lr[data-bk-cause]:hover{background:rgba(216,185,106,.12);}#ppop.tmf-book .bk-lr[data-bk-cause] .bk-k::after{content:"›";display:inline-block;margin-left:3px;color:#a8833a;font-size:10px;transform:rotate(90deg);opacity:.65;}#ppop.tmf-book .bk-k{flex:0 0 auto;font-size:11.5px;color:#564732;letter-spacing:.08em;}#ppop.tmf-book .bk-v{font-family:"STSong","SimSun",serif;font-size:12px;color:#262015;text-align:right;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}#ppop.tmf-book .bk-v.zhu{color:#a83228;font-weight:bold;}#ppop.tmf-book .bk-v.jin{color:#3c6353;}#ppop.tmf-book .bk-v.wrap{white-space:normal;line-height:1.6;}',
      '#ppop.tmf-book .bk-wu-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-bottom:7px;}#ppop.tmf-book .bk-wu{padding:5px 6px 4px;border:1px solid rgba(150,114,52,.3);border-radius:3px;background:rgba(255,252,240,.5);text-align:center;}#ppop.tmf-book .bk-wu .k{display:block;font-size:10px;color:#7c5d21;letter-spacing:.14em;}#ppop.tmf-book .bk-wu .v{display:block;font-family:"STSong","SimSun",serif;font-size:12px;font-weight:bold;color:#262015;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '#ppop.tmf-book .bk-chips{display:flex;flex-wrap:wrap;gap:5px;margin:6px 0 2px;}#ppop.tmf-book .bk-chip{font-size:10.5px;letter-spacing:.04em;color:#564732;border:1px solid rgba(168,131,58,.35);background:rgba(255,252,240,.55);padding:3px 8px;border-radius:2px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}#ppop.tmf-book .bk-chip b{color:#7c5d21;margin-right:4px;font-weight:600;}',
      '#ppop.tmf-book .bk-score-chips{display:inline-flex;flex-wrap:wrap;gap:4px;justify-content:flex-end;}#ppop.tmf-book .bk-score-chips em{font-style:normal;font-size:10px;letter-spacing:.04em;color:#564732;border:1px solid rgba(168,131,58,.35);background:rgba(255,252,240,.55);padding:1px 6px;border-radius:2px;white-space:nowrap;}#ppop.tmf-book .bk-score-chips em b{color:#3c6353;font-weight:700;margin-left:3px;}#ppop.tmf-book .bk-score-chips em.neg{border-color:rgba(168,50,40,.45);background:rgba(198,74,62,.08);}#ppop.tmf-book .bk-score-chips em.neg b{color:#a83228;}',
      '.tmjz-veil.modal-bg{background:radial-gradient(80% 80% at 50% 42%,rgba(20,13,5,.35),rgba(12,8,3,.66));backdrop-filter:blur(2px) sepia(.2);}.tmjz{width:min(580px,92vw);max-height:84vh;display:flex;flex-direction:column;border:1px solid rgba(96,68,28,.7);border-radius:4px;background:linear-gradient(180deg,#fbf5e6,#f4ebd2 50%,#ead9b5);box-shadow:inset 0 0 0 1px rgba(255,252,238,.55),inset 0 0 38px rgba(120,84,34,.14),0 26px 70px rgba(0,0,0,.65);font-family:"STKaiti","KaiTi","楷体",serif;color:#262015;}',
      '.tmjz-hd{display:flex;align-items:center;gap:11px;padding:13px 17px 10px;border-bottom:1px solid rgba(124,93,33,.35);}.tmjz-seal{width:36px;height:36px;flex:0 0 auto;border-radius:5px;display:grid;place-items:center;font-size:18px;color:#fff;font-weight:bold;background:linear-gradient(155deg,#c64a3e,#7a2018);border:1px solid rgba(122,32,24,.6);box-shadow:0 2px 7px rgba(122,32,24,.4);}.tmjz-ti{min-width:0;}.tmjz-ti b{font-size:17px;letter-spacing:.26em;color:#262015;display:block;}.tmjz-ti span{font-size:11px;color:#9a8a6a;letter-spacing:.1em;display:block;margin-top:2px;}.tmjz-x{margin-left:auto;flex:0 0 auto;border:1px solid rgba(150,114,52,.45);background:rgba(255,252,240,.6);color:#564732;width:26px;height:26px;border-radius:3px;cursor:pointer;font-size:15px;line-height:1;font-family:inherit;}.tmjz-x:hover{border-color:#a83228;color:#7a2018;}',
      '.tmjz-tabs{display:flex;gap:7px;padding:10px 17px 0;}.tmjz-tab{font-family:inherit;font-size:12.5px;letter-spacing:.18em;padding:6px 16px;cursor:pointer;border-radius:3px 3px 0 0;border:1px solid rgba(150,114,52,.35);border-bottom:0;background:rgba(244,235,210,.5);color:#564732;transition:all .15s;}.tmjz-tab.active{color:#fff;background:linear-gradient(160deg,#c64a3e,#7a2018);border-color:rgba(122,32,24,.6);}',
      '.tmjz-body{flex:1;min-height:0;overflow-y:auto;padding:13px 17px;border-top:1px solid rgba(124,93,33,.3);scrollbar-width:thin;}.tmjz-empty{padding:1rem;text-align:center;color:#9a8a6a;font-size:12px;}',
      '.tmjz-item{display:grid;grid-template-columns:42px 1fr auto;gap:10px;align-items:center;padding:9px 10px;margin-bottom:7px;cursor:pointer;border:1px solid rgba(150,114,52,.32);border-radius:3px;background:rgba(255,252,240,.6);transition:all .15s;}.tmjz-item:hover{border-color:#a83228;background:rgba(255,250,240,.92);transform:translateX(3px);}.tmjz-item .ji-seal{width:42px;height:42px;border-radius:4px;display:grid;place-items:center;font-size:14px;color:#fff;border:1px solid rgba(0,0,0,.18);background:linear-gradient(155deg,#a8833a,#7c5d21);}.tmjz-item .ji-seal.military{background:linear-gradient(155deg,#9d5b4b,#6e3325);}.tmjz-item .ji-seal.cultural{background:linear-gradient(155deg,#557f6f,#34564a);}.tmjz-item .ji-seal.administrative{background:linear-gradient(155deg,#4a5e8a,#2e3c5c);}.tmjz-item .ji-seal.religious{background:linear-gradient(155deg,#8e6aa8,#5d3f78);}.tmjz-item .ji-seal.infrastructure{background:linear-gradient(155deg,#7d6a48,#54452c);}',
      '.tmjz-item .ji-body{min-width:0;}.tmjz-item .ji-body b{display:block;font-size:13.5px;color:#262015;letter-spacing:.06em;}.tmjz-item .ji-body p{margin:2px 0 0;font:11px/1.6 "FangSong","STFangsong","仿宋",serif;color:#564732;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}.tmjz-item .ji-fx{margin-top:3px;display:flex;flex-wrap:wrap;gap:4px;}.tmjz-item .ji-fx em{font-style:normal;font-size:9.5px;letter-spacing:.04em;padding:1px 6px;border-radius:2px;border:1px solid rgba(85,127,111,.4);background:rgba(111,162,145,.14);color:#33564a;}.tmjz-item .ji-meta{text-align:right;font-size:10.5px;color:#9a8a6a;line-height:1.8;white-space:nowrap;}.tmjz-item .ji-meta i{font-style:normal;color:#7c5d21;font-weight:bold;}',
      '.tmjz-field{margin-bottom:10px;}.tmjz-field label{display:block;font-size:12px;color:#7c5d21;letter-spacing:.18em;margin-bottom:5px;}.tmjz-field input,.tmjz-field select,.tmjz-field textarea{width:100%;box-sizing:border-box;font-family:"FangSong","STFangsong","仿宋",serif;font-size:13px;color:#262015;border:1px solid rgba(150,114,52,.45);border-radius:3px;background:rgba(255,253,246,.85);padding:8px 10px;outline:none;}.tmjz-field input:focus,.tmjz-field select:focus,.tmjz-field textarea:focus{border-color:#a83228;box-shadow:0 0 0 2px rgba(198,74,62,.15);}.tmjz-rule{padding:8px 10px;border:1px dashed rgba(168,131,58,.5);background:rgba(255,250,228,.55);font:11px/1.7 "FangSong","STFangsong","仿宋",serif;color:#564732;}.tmjz-rule b{color:#7a2018;}',
      '.tmjz-foot{display:flex;gap:9px;justify-content:flex-end;align-items:center;padding:11px 17px 14px;border-top:1px solid rgba(124,93,33,.3);}.tmjz-note{margin-right:auto;font-size:10.5px;color:#9a8a6a;letter-spacing:.06em;max-width:55%;line-height:1.6;}.tmjz-bt{font-family:inherit;font-size:12.5px;letter-spacing:.2em;padding:8px 18px;cursor:pointer;border-radius:3px;border:1px solid rgba(150,114,52,.45);background:rgba(255,252,240,.7);color:#564732;}.tmjz-bt:hover{border-color:#a8833a;color:#262015;}.tmjz-bt.zhu{color:#fff;background:linear-gradient(160deg,#c64a3e,#7a2018);border-color:rgba(122,32,24,.6);}.tmjz-bt.zhu:hover{filter:brightness(1.08);}',
      '#ppop.tmf-book .bk-qian-links{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:6px;}#ppop.tmf-book .bk-qian{font-family:inherit;font-size:11px;letter-spacing:.08em;color:#564732;border:1px solid rgba(168,131,58,.42);background:linear-gradient(180deg,rgba(255,253,244,.9),rgba(244,235,210,.55));padding:4px 9px;border-radius:2px;cursor:pointer;transition:all .15s;}#ppop.tmf-book .bk-qian:hover{border-color:#a83228;color:#7a2018;transform:translateY(-1px);}',
      '#ppop.tmf-book .bk-ren-row{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:7px;}#ppop.tmf-book .bk-ren{display:flex;gap:8px;padding:7px 8px;border:1px solid rgba(150,114,52,.32);border-radius:3px;background:rgba(255,252,240,.55);min-width:0;}#ppop.tmf-book .bk-ren.main{grid-column:1/-1;border-color:rgba(168,50,40,.4);background:linear-gradient(180deg,rgba(255,250,240,.85),rgba(247,235,214,.6));}#ppop.tmf-book .bk-ren .r-seal{width:30px;height:30px;flex:0 0 auto;border-radius:4px;display:grid;place-items:center;font-size:14px;color:#fff;font-weight:bold;background:linear-gradient(155deg,#8a6d3b,#5d4520);border:1px solid rgba(86,60,24,.6);}#ppop.tmf-book .bk-ren.main .r-seal{background:linear-gradient(155deg,#c64a3e,#7a2018);}#ppop.tmf-book .bk-ren .r-body{min-width:0;}#ppop.tmf-book .bk-ren b{display:block;font-size:12px;letter-spacing:.06em;color:#262015;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}#ppop.tmf-book .bk-ren span{display:block;font-size:10px;color:#9a8a6a;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '#ppop.tmf-book .bk-jun-list{margin-bottom:6px;}#ppop.tmf-book .bk-jun{display:flex;align-items:baseline;gap:7px;padding:5px 2px;border-bottom:1px solid rgba(86,71,50,.13);min-width:0;}#ppop.tmf-book .bk-jun .j-ni{width:9px;height:9px;flex:0 0 auto;border-radius:50%;background:#9d5b4b;border:1.5px solid rgba(0,0,0,.18);align-self:center;}#ppop.tmf-book .bk-jun b{font-size:11.5px;letter-spacing:.05em;color:#262015;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;}#ppop.tmf-book .bk-jun .j-n{flex:0 0 auto;font-family:"STSong","SimSun",serif;font-size:12px;font-weight:bold;color:#7c5d21;}#ppop.tmf-book .bk-jun .j-cmd{flex:0 0 auto;font-size:10px;color:#564732;}#ppop.tmf-book .bk-jun .j-mor{flex:0 0 auto;margin-left:auto;font-size:9.5px;color:#3c6353;letter-spacing:.04em;}#ppop.tmf-book .bk-jun .j-mor.low{color:#a83228;}#ppop.tmf-book .bk-jun-more{padding:3px 2px;font-size:10px;color:#9a8a6a;text-align:right;}',
      '#ppop.tmf-book .bk-zt-list{display:flex;flex-direction:column;gap:6px;margin-bottom:6px;}#ppop.tmf-book .bk-zt{display:flex;gap:8px;align-items:flex-start;padding:7px 8px;border:1px solid rgba(150,114,52,.32);border-radius:3px;background:rgba(255,252,240,.55);min-width:0;}#ppop.tmf-book .bk-zt .zt-seal{width:26px;height:26px;flex:0 0 auto;border-radius:4px;display:grid;place-items:center;font-size:13px;color:#fff;font-weight:bold;background:linear-gradient(155deg,#8a6d3b,#5d4520);border:1px solid rgba(86,60,24,.5);}#ppop.tmf-book .bk-zt.wonder .zt-seal{background:linear-gradient(155deg,#b8923f,#7c5d21);}#ppop.tmf-book .bk-zt.disaster{border-color:rgba(168,50,40,.45);background:rgba(198,74,62,.07);}#ppop.tmf-book .bk-zt.disaster .zt-seal{background:linear-gradient(155deg,#c64a3e,#7a2018);}#ppop.tmf-book .bk-zt.player .zt-seal{background:linear-gradient(155deg,#4a5e8a,#2e3c5c);}#ppop.tmf-book .bk-zt.building .zt-seal{background:linear-gradient(155deg,#557f6f,#34564a);}#ppop.tmf-book .bk-zt .zt-body{min-width:0;flex:1;}#ppop.tmf-book .bk-zt b{display:block;font-size:12px;letter-spacing:.05em;color:#262015;}#ppop.tmf-book .bk-zt p{margin:2px 0 0;font:10.5px/1.55 "FangSong","STFangsong",serif;color:#564732;}#ppop.tmf-book .bk-zt .zt-fx{margin-top:3px;display:flex;flex-wrap:wrap;gap:4px;}#ppop.tmf-book .bk-zt .zt-fx em{font-style:normal;font-size:9.5px;letter-spacing:.04em;padding:1px 6px;border-radius:2px;border:1px solid rgba(85,127,111,.4);background:rgba(111,162,145,.14);color:#33564a;}#ppop.tmf-book .bk-zt .zt-fx em.neg{border-color:rgba(168,50,40,.45);background:rgba(198,74,62,.1);color:#7a2018;}#ppop.tmf-book .bk-zt .zt-term{flex:0 0 auto;font-size:9.5px;color:#9a8a6a;letter-spacing:.08em;white-space:nowrap;}#ppop.tmf-book .bk-zt-note{font-size:9.5px;color:#9a8a6a;letter-spacing:.05em;padding:2px 1px;}',
      '#ppop.tmf-book .bk-bang-list{margin-bottom:5px;}#ppop.tmf-book .bk-bang{display:flex;align-items:center;gap:8px;padding:6px 2px;border-bottom:1px solid rgba(86,71,50,.13);min-width:0;}#ppop.tmf-book .bk-bang .b-ni{width:12px;height:12px;flex:0 0 auto;border-radius:50%;border:1.5px solid rgba(0,0,0,.18);}#ppop.tmf-book .bk-bang .b-ni.di{background:#a83228;}#ppop.tmf-book .bk-bang .b-ni.meng{background:#557f6f;}#ppop.tmf-book .bk-bang .b-ni.zhong{background:#a8833a;}#ppop.tmf-book .bk-bang b{font-size:12px;letter-spacing:.08em;color:#262015;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}#ppop.tmf-book .bk-bang .b-rel{font-size:9.5px;letter-spacing:.16em;padding:2px 6px;border-radius:2px;flex:0 0 auto;}#ppop.tmf-book .bk-bang .b-rel.di{color:#fff;background:linear-gradient(155deg,#c64a3e,#7a2018);}#ppop.tmf-book .bk-bang .b-rel.meng{color:#274a3d;background:rgba(111,162,145,.3);border:1px solid rgba(85,127,111,.4);}#ppop.tmf-book .bk-bang .b-rel.zhong{color:#564732;background:rgba(150,114,52,.16);border:1px solid rgba(150,114,52,.3);}#ppop.tmf-book .bk-bang .b-note{margin-left:auto;font-size:10px;color:#9a8a6a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:42%;}',
      '#ppop.tmf-book .bk-bar-strip{margin:5px 0 7px;}#ppop.tmf-book .bk-bar-strip .bs-t{display:flex;justify-content:space-between;font-size:10.5px;color:#564732;letter-spacing:.08em;margin-bottom:4px;}#ppop.tmf-book .bk-bar{display:flex;height:10px;border-radius:2px;overflow:hidden;border:1px solid rgba(86,71,50,.3);}#ppop.tmf-book .bk-bar i{height:100%;}#ppop.tmf-book .bk-bar-legend{display:flex;flex-wrap:wrap;gap:3px 10px;margin-top:4px;font-size:10px;color:#564732;}#ppop.tmf-book .bk-bar-legend em{font-style:normal;display:inline-flex;align-items:center;gap:4px;}#ppop.tmf-book .bk-bar-legend em::before{content:"";width:8px;height:8px;border-radius:2px;background:var(--c);}',
      '#ppop.tmf-book .bk-youlie{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-bottom:6px;}#ppop.tmf-book .bk-youlie .yl{border:1px solid rgba(150,114,52,.3);border-radius:3px;padding:6px 8px;background:rgba(255,252,240,.5);}#ppop.tmf-book .bk-youlie .yl b{display:block;font-size:11px;letter-spacing:.2em;margin-bottom:4px;}#ppop.tmf-book .bk-youlie .yl.you b{color:#3c6353;}#ppop.tmf-book .bk-youlie .yl.lie b{color:#7a2018;}#ppop.tmf-book .bk-youlie .yl span{display:block;font:10.5px/1.65 "FangSong","STFangsong",serif;color:#564732;padding-left:9px;position:relative;}#ppop.tmf-book .bk-youlie .yl span::before{content:"·";position:absolute;left:1px;color:#a8833a;}',
      '#ppop.tmf-book .bk-fold{position:relative;border-left:3px solid rgba(124,93,33,.45);background:rgba(255,250,235,.55);padding:7px 9px;margin-top:3px;}#ppop.tmf-book .bk-fold pre{font:11.5px/1.75 "FangSong","STFangsong","仿宋",serif;color:#564732;white-space:pre-wrap;word-break:break-word;max-height:92px;overflow:hidden;transition:max-height .3s ease;margin:0;}#ppop.tmf-book .bk-fold.open pre{max-height:1600px;}#ppop.tmf-book .bk-fold-btn{margin-top:4px;border:0;background:none;color:#7c5d21;font-family:inherit;font-size:10.5px;letter-spacing:.14em;cursor:pointer;padding:0;}#ppop.tmf-book .bk-fold-btn:hover{color:#a83228;}',
      '#ppop.tmf-book .bk-ye{border:1px solid rgba(150,114,52,.32);border-radius:3px;background:rgba(255,252,240,.5);padding:6px 8px;margin-bottom:6px;}#ppop.tmf-book .bk-ye.nijian{border-style:dashed;border-color:rgba(168,131,58,.55);background:rgba(255,250,228,.6);}#ppop.tmf-book .bk-ye .ye-hd{display:flex;align-items:baseline;gap:7px;min-width:0;}#ppop.tmf-book .bk-ye .ye-hd b{font-size:12.5px;letter-spacing:.06em;color:#262015;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}#ppop.tmf-book .bk-ye .lv{font-size:9.5px;color:#7c5d21;border:1px solid rgba(168,131,58,.45);padding:1px 5px;border-radius:2px;letter-spacing:.08em;flex:0 0 auto;}#ppop.tmf-book .bk-ye .st{margin-left:auto;font-size:10px;letter-spacing:.12em;white-space:nowrap;flex:0 0 auto;}#ppop.tmf-book .bk-ye .st.done{color:#3c6353;}#ppop.tmf-book .bk-ye .st.doing{color:#a83228;}#ppop.tmf-book .bk-ye .st.ni{color:#7c5d21;}#ppop.tmf-book .bk-ye p{margin:3px 0 0;font:10.5px/1.6 "FangSong","STFangsong",serif;color:#564732;}',
      '#ppop.tmf-book .bk-ye .fx{display:flex;flex-wrap:wrap;gap:4px;margin-top:5px;}#ppop.tmf-book .bk-ye .fx em{font-style:normal;font-size:9.5px;letter-spacing:.04em;padding:2px 6px;border-radius:2px;border:1px solid rgba(85,127,111,.4);background:rgba(111,162,145,.16);color:#33564a;}#ppop.tmf-book .bk-ye .fx em.cost{border-color:rgba(168,131,58,.45);background:rgba(216,185,106,.16);color:#7c5d21;}#ppop.tmf-book .bk-ye .gq{margin-top:5px;display:flex;align-items:center;gap:7px;}#ppop.tmf-book .bk-ye .gq-bar{flex:1;height:7px;border-radius:4px;overflow:hidden;background:rgba(86,71,50,.16);border:1px solid rgba(86,71,50,.2);}#ppop.tmf-book .bk-ye .gq-bar i{display:block;height:100%;background:linear-gradient(90deg,#a8833a,#d8b96a);box-shadow:0 0 6px rgba(216,185,106,.5);}#ppop.tmf-book .bk-ye .gq em{font-style:normal;font-size:10px;color:#7c5d21;letter-spacing:.06em;white-space:nowrap;}#ppop.tmf-book .bk-ye-empty{font:11px/1.7 "FangSong","STFangsong",serif;color:#9a8a6a;margin:0 0 6px;}',
      '#ppop.tmf-book .bk-foot{flex:0 0 auto;display:flex;gap:7px;padding:9px 14px 11px 22px;border-top:1px solid rgba(124,93,33,.34);background:linear-gradient(180deg,rgba(244,235,210,0),rgba(233,220,188,.7));}#ppop.tmf-book .bk-act{flex:1;height:34px;border-radius:3px;cursor:pointer;font-family:inherit;font-size:12.5px;letter-spacing:.2em;border:1px solid rgba(168,131,58,.5);background:linear-gradient(180deg,rgba(255,253,244,.9),rgba(244,235,210,.7));color:#564732;box-shadow:0 2px 6px rgba(120,84,34,.16),inset 0 1px 0 rgba(255,255,255,.7);transition:all .16s;}#ppop.tmf-book .bk-act:hover{border-color:#a8833a;color:#262015;}#ppop.tmf-book .bk-act.zhu{color:#fff;border-color:#7a2018;background:linear-gradient(160deg,#c64a3e,#7a2018);box-shadow:0 3px 9px rgba(122,32,24,.4),inset 0 1px 0 rgba(255,255,255,.25);}#ppop.tmf-book .bk-act.zhu:hover{filter:brightness(1.1);}#ppop.tmf-book .bk-act.wide{width:100%;margin-top:3px;flex:none;}',
      '#ppop.tmf-book .bk-jianqian{position:absolute;right:-30px;top:52px;z-index:5;display:flex;flex-direction:column;gap:5px;transition:opacity .18s;}#ppop.tmf-book .bk-jq{position:relative;width:30px;padding:8px 0 9px;border:1px solid rgba(96,68,28,.6);border-left:0;border-radius:0 5px 5px 0;cursor:pointer;display:flex;flex-direction:column;align-items:center;background:linear-gradient(90deg,#cdb98c,#bfa978 70%,#ab9263);color:#4c3a1c;font-family:inherit;font-size:11px;line-height:1.2;box-shadow:3px 3px 9px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,250,230,.5);transition:all .18s;writing-mode:vertical-rl;text-orientation:upright;}#ppop.tmf-book .bk-jq:hover{transform:translateX(3px);}#ppop.tmf-book .bk-jq.active{color:#fff;background:linear-gradient(90deg,#c64a3e,#a83228 60%,#7a2018);border-color:rgba(122,32,24,.7);transform:translateX(4px);box-shadow:4px 4px 11px rgba(122,32,24,.4);}#ppop.tmf-book .bk-jq .jq-no{font-size:8px;opacity:.65;margin-bottom:3px;}',
      '.tmf-bk-cause{position:fixed;z-index:140;width:264px;opacity:0;pointer-events:none;transform:translateY(5px);transition:opacity .15s,transform .15s;border:1px solid rgba(96,68,28,.72);border-radius:3px;background:linear-gradient(180deg,#fbf6e8,#f4ecd6 64%,#e9dcbc);box-shadow:inset 0 0 0 1px rgba(255,252,238,.5),0 12px 30px rgba(0,0,0,.55);font-family:"STKaiti","KaiTi","楷体",serif;color:#262015;}.tmf-bk-cause.show{opacity:1;transform:none;}.tmf-bk-cause::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:#a83228;}.tmf-bk-cause .cp-hd{display:flex;align-items:center;gap:7px;padding:7px 11px 5px;border-bottom:1px solid rgba(124,93,33,.3);}.tmf-bk-cause .cp-seal{width:19px;height:19px;border-radius:3px;display:grid;place-items:center;font-size:10.5px;color:#fff;background:linear-gradient(155deg,#c64a3e,#7a2018);}.tmf-bk-cause .cp-hd b{font-size:12.5px;letter-spacing:.12em;}.tmf-bk-cause .cp-body{padding:5px 11px 4px;}.tmf-bk-cause .cp-item{display:flex;gap:7px;padding:3.5px 0;border-bottom:1px solid rgba(86,71,50,.12);font-size:11px;line-height:1.55;}.tmf-bk-cause .cp-item:last-child{border-bottom:0;}.tmf-bk-cause .ck{flex:0 0 auto;color:#7a2018;font-weight:bold;}.tmf-bk-cause .cv{color:#564732;font-family:"FangSong","STFangsong",serif;}.tmf-bk-cause .cp-ft{padding:4px 11px 7px;border-top:1px dashed rgba(124,93,33,.3);font-size:9.5px;line-height:1.55;color:#9a8a6a;letter-spacing:.04em;}',
      '.tmf-bk-cause .cp-led{padding:4px 11px 5px;border-top:1px dashed rgba(124,93,33,.3);}.tmf-bk-cause .cp-led>b{display:block;font-size:9.5px;letter-spacing:.3em;color:#7c5d21;margin-bottom:2px;}.tmf-bk-cause .cp-led-row{display:flex;gap:7px;align-items:baseline;font-size:10px;line-height:1.6;color:#564732;}.tmf-bk-cause .cp-led-row .lt{flex:0 0 auto;color:#9a8a6a;}.tmf-bk-cause .cp-led-row .ld{flex:0 0 auto;font-weight:bold;}.tmf-bk-cause .cp-led-row .ld.pos{color:#3c6353;}.tmf-bk-cause .cp-led-row .ld.neg{color:#a83228;}.tmf-bk-cause .cp-led-row .lw{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:"FangSong","STFangsong",serif;}',
      'body.tm-phase8-formal #ppop.tmf-book .bk-spine,body.tm-phase8-formal #ppop.tmf-book .bk-jianqian{font-family:"STKaiti","KaiTi","楷体",serif;}',
      '#tm-phase8-home-return{position:absolute;left:18px;top:14px;z-index:80;display:none;border:1px solid rgba(201,168,95,.42);background:linear-gradient(180deg,rgba(44,34,22,.95),rgba(12,9,7,.95));color:#f0d98c;font-family:"STKaiti","KaiTi","楷体",serif;padding:7px 13px;letter-spacing:.16em;cursor:pointer;}',
      'body.tm-phase8-legacy #tm-phase8-home-return{display:block;}',
      '#tm-phase8-formal-rail{position:absolute;right:7px;top:10px;display:flex;flex-direction:column;gap:6px;align-items:center;z-index:42;pointer-events:auto;}',
      '.tmf-rail-cap{writing-mode:vertical-rl;color:#9b8758;font-size:12px;letter-spacing:.18em;margin:0 0 2px;}',
      '.tmf-rail-btn{width:42px;height:48px;position:relative;border:1px solid rgba(184,154,83,.28);border-radius:0;background:linear-gradient(180deg,rgba(26,21,16,.92),rgba(8,7,6,.94));color:#d5bf7b;font-family:"STKaiti","KaiTi","楷体",serif;font-size:18px;letter-spacing:.12em;cursor:pointer;box-shadow:inset 0 0 0 1px rgba(0,0,0,.45),0 5px 12px rgba(0,0,0,.28);}',
      '.tmf-rail-btn span:first-child{display:block;transform:translateX(.04em);}.tmf-rail-btn:hover,.tmf-rail-btn.active{border-color:#d4be7a;color:#f0dc98;background:radial-gradient(circle at 50% 18%,rgba(201,168,95,.22),transparent 48%),linear-gradient(180deg,rgba(47,35,22,.94),rgba(12,9,7,.96));}.tmf-rail-btn.hot{color:#e4a28d;border-color:rgba(192,64,48,.45);}.tmf-rail-btn.ok{color:#a8d4c5;border-color:rgba(126,184,167,.42);}',
      '.tmf-rail-count{position:absolute;right:-5px;top:-5px;min-width:17px;height:17px;padding:0 4px;border-radius:9px;background:rgba(124,35,25,.96);border:1px solid rgba(232,160,125,.75);color:#f4eadd;font-size:12px;line-height:16px;text-align:center;letter-spacing:0;font-family:serif;}',
      '#tm-phase8-formal-panel{width:100%;min-height:100%;}.tmf-panel{display:flex;flex-direction:column;gap:10px;font-family:"STKaiti","KaiTi","楷体",serif;color:#eee0bd;}.tmf-card{border:1px solid rgba(184,154,83,.26);border-left:3px solid rgba(184,154,83,.65);background:linear-gradient(180deg,rgba(33,27,20,.84),rgba(13,11,9,.88));padding:11px 12px;box-shadow:inset 0 0 0 1px rgba(0,0,0,.28);}.tmf-card.empty{border-left-color:rgba(126,184,167,.68);}',
      '.tmf-card-title{display:flex;align-items:center;justify-content:space-between;margin-bottom:9px;color:#d7be73;font-size:17px;letter-spacing:.18em;border-bottom:1px dashed rgba(184,154,83,.22);padding-bottom:5px;}.tmf-card-title small{font-size:12px;color:#9d917d;letter-spacing:.08em;}.tmf-note,.tmf-card p{font-size:14px;line-height:1.7;color:#b9aa8a;margin:6px 0 8px;}',
      '.tmf-primary,.tmf-action,.tmf-person-actions button{font-family:inherit;cursor:pointer;border:1px solid rgba(184,154,83,.32);background:rgba(184,154,83,.08);color:#d8c27c;}.tmf-top-actions{display:grid;grid-template-columns:1fr;gap:7px;}.tmf-action{display:flex;flex-direction:column;align-items:flex-start;gap:2px;text-align:left;padding:9px 10px;}.tmf-action.main{border-color:rgba(126,184,167,.48);color:#bde6d9;background:linear-gradient(90deg,rgba(126,184,167,.10),rgba(184,154,83,.05));}.tmf-action:hover,.tmf-person-actions button:hover{border-color:#d4be7a;color:#f3df9d;background:rgba(184,154,83,.15);}.tmf-action b{font-size:15px;letter-spacing:.12em;}.tmf-action span{font-size:12px;color:#a99d83;line-height:1.5;}',
      '.tmf-minirows{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:6px 0 8px;}.tmf-minirows div{background:rgba(255,255,255,.025);border:1px solid rgba(184,154,83,.14);padding:5px 6px;}.tmf-minirows span{display:block;color:#8f846f;font-size:12px;}.tmf-minirows b{font-size:15px;color:#e4d4a8;}',
      '.tmf-person-list{display:flex;flex-direction:column;gap:9px;}.tmf-person-card{display:flex;gap:9px;border:1px solid rgba(126,184,167,.26);background:rgba(126,184,167,.05);padding:8px;}.tmf-avatar{width:48px;height:58px;border:1px solid rgba(201,168,95,.34);display:flex;align-items:center;justify-content:center;background:#19120d;color:#d4be7a;font-size:24px;flex-shrink:0;overflow:hidden;}.tmf-avatar img{width:100%;height:100%;object-fit:cover;}.tmf-person-main{flex:1;min-width:0;}.tmf-person-head{display:flex;justify-content:space-between;gap:8px;align-items:baseline;margin-bottom:4px;}.tmf-person-head b{font-size:17px;color:#f0dc98;}.tmf-person-head span{font-size:12px;color:#a8d4c5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}.tmf-person-actions{display:flex;flex-wrap:wrap;gap:4px;margin-top:7px;}.tmf-person-actions button{font-size:12px;padding:3px 7px;}.tmf-person-actions button.danger{color:#d4706a;border-color:rgba(192,64,48,.40);background:rgba(192,64,48,.08);}',
      'body.tm-phase8-formal #tm-phase8-formal-panel .tmrp{font-family:"STKaiti","KaiTi","楷体",serif;color:#eadfbd;display:flex;flex-direction:column;gap:10px;}body.tm-phase8-formal #tm-phase8-formal-panel .tmf-card{border:1px solid rgba(204,164,76,.22);border-left:3px solid rgba(204,164,76,.38);background:linear-gradient(180deg,rgba(35,27,18,.82),rgba(15,12,9,.84));box-shadow:inset 0 1px rgba(255,236,174,.05);padding:10px;position:relative;}body.tm-phase8-formal #tm-phase8-formal-panel .tmf-card.empty{border-left-color:rgba(112,176,151,.52);}',
      'body.tm-phase8-formal #tm-phase8-formal-panel .tmf-card-title{display:flex;justify-content:space-between;gap:8px;align-items:flex-start;color:#f2d98d;font-size:15px;letter-spacing:.08em;border:0;margin:0 0 8px;padding:0;}body.tm-phase8-formal #tm-phase8-formal-panel .tmf-card-title small{color:rgba(225,210,169,.58);font-size:12px;letter-spacing:.04em;font-weight:400;}body.tm-phase8-formal #tm-phase8-formal-panel .tmf-note,body.tm-phase8-formal #tm-phase8-formal-panel .tmf-card p{margin:5px 0;color:rgba(232,221,191,.66);font-size:12px;line-height:1.55;}',
      'body.tm-phase8-formal #tm-phase8-formal-panel .tmf-minirows{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin-top:7px;}body.tm-phase8-formal #tm-phase8-formal-panel .tmf-minirows div{min-height:40px;border:1px solid rgba(204,164,76,.16);background:rgba(0,0,0,.18);padding:6px 7px;}body.tm-phase8-formal #tm-phase8-formal-panel .tmf-minirows span{display:block;color:rgba(226,211,170,.52);font-size:11px;}body.tm-phase8-formal #tm-phase8-formal-panel .tmf-minirows b{display:block;color:#eadfbd;font-size:12px;margin-top:2px;overflow-wrap:anywhere;}',
      'body.tm-phase8-formal #tm-phase8-formal-panel .tmf-action,body.tm-phase8-formal #tm-phase8-formal-panel .tmf-person-actions button{border:1px solid rgba(204,164,76,.26);background:rgba(25,18,12,.88);color:#eadfbd;min-height:28px;padding:4px 9px;font-family:inherit;font-size:12px;letter-spacing:.08em;cursor:pointer;}body.tm-phase8-formal #tm-phase8-formal-panel .tmf-action.main{background:linear-gradient(180deg,rgba(128,50,35,.9),rgba(61,27,20,.92));border-color:rgba(213,103,73,.5);color:#ffe1ac;}body.tm-phase8-formal #tm-phase8-formal-panel .tmf-action:hover,body.tm-phase8-formal #tm-phase8-formal-panel .tmf-person-actions button:hover{border-color:rgba(232,197,113,.62);color:#f5dc96;}',
      'body.tm-phase8-formal #tm-phase8-formal-panel .tmf-person-card,body.tm-phase8-formal #tm-phase8-formal-panel .tmf-person-pick{display:grid;grid-template-columns:42px minmax(0,1fr);gap:8px;align-items:center;width:100%;text-align:left;border:1px solid rgba(204,164,76,.16);background:rgba(0,0,0,.20);color:#eadfbd;padding:7px;box-sizing:border-box;}body.tm-phase8-formal #tm-phase8-formal-panel .tmf-avatar{width:38px;height:38px;border:1px solid rgba(204,164,76,.35);background:radial-gradient(circle at 35% 25%,rgba(238,215,147,.24),rgba(26,18,11,.9));display:flex;align-items:center;justify-content:center;color:#f2d98d;font-size:18px;}body.tm-phase8-formal #tm-phase8-formal-panel .tmf-person-head{display:block;}body.tm-phase8-formal #tm-phase8-formal-panel .tmf-person-head b,body.tm-phase8-formal #tm-phase8-formal-panel .tmf-person-pick b{display:block;color:#f2d98d;font-size:14px;}body.tm-phase8-formal #tm-phase8-formal-panel .tmf-person-head span,body.tm-phase8-formal #tm-phase8-formal-panel .tmf-person-pick span{display:block;color:rgba(226,211,170,.55);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.tmf-chaoyi-grid{display:grid;grid-template-columns:1fr;gap:8px;}.tmf-chaoyi-grid button{height:92px;position:relative;overflow:hidden;border:1px solid rgba(184,154,83,.30);background:#15100c;color:#f1ddb0;text-align:left;padding:10px 12px;cursor:pointer;font-family:inherit;}.tmf-chaoyi-grid img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.38;filter:saturate(.85) brightness(.72);}.tmf-chaoyi-grid b,.tmf-chaoyi-grid span{position:relative;z-index:1;display:block;text-shadow:0 2px 6px #000;}.tmf-chaoyi-grid b{font-size:20px;letter-spacing:.18em;margin-top:18px;}.tmf-chaoyi-grid span{font-size:13px;color:#d7c49b;}',
      '.tmf-line{display:flex;justify-content:space-between;gap:8px;border-bottom:1px dashed rgba(184,154,83,.15);padding:7px 0;font-size:14px;}.tmf-line:last-child{border-bottom:none;}.tmf-line b{color:#e4d4a8;}.tmf-line span{color:#a99d83;text-align:right;}',
      '.tm-phase8-person-pinned{outline:1px solid rgba(126,184,167,.76)!important;box-shadow:inset 3px 0 rgba(126,184,167,.82),0 0 0 1px rgba(126,184,167,.18)!important;position:relative;}.tm-phase8-person-pinned:after{content:"钉";position:absolute;right:5px;top:4px;min-width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(126,184,167,.18);border:1px solid rgba(126,184,167,.56);color:#bfe9dc;font-size:12px;z-index:2;}',
      '#tm-phase8-left-surface{position:absolute;left:0;top:16px;bottom:208px;width:300px;z-index:24;display:flex;flex-direction:column;gap:10px;pointer-events:none;font-family:"STKaiti","KaiTi","楷体",serif;}#tm-phase8-left-surface>*{pointer-events:auto;}',
      '.tmf-renwu-entry{width:292px;height:86px;margin-left:0;border:0;background:transparent;position:relative;overflow:visible;cursor:pointer;color:#f0d98c;filter:drop-shadow(0 9px 20px rgba(0,0,0,.52));}.tmf-renwu-entry img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.92;}.tmf-renwu-entry span{position:absolute;right:18px;top:28px;font-size:22px;letter-spacing:.28em;text-shadow:0 2px 8px #000;}.tmf-renwu-entry:hover{transform:translateY(-1px);filter:drop-shadow(0 11px 22px rgba(0,0,0,.58)) drop-shadow(0 0 8px rgba(212,176,92,.18));}',
      '.tmf-event-feed{width:286px;margin-left:0;min-height:0;flex:1;display:flex;flex-direction:column;border-left:2px solid rgba(126,184,167,.58);border-top:1px solid rgba(201,168,95,.22);border-bottom:1px solid rgba(201,168,95,.18);background:linear-gradient(180deg,rgba(18,13,9,.72),rgba(8,7,6,.66));box-shadow:0 8px 24px rgba(0,0,0,.34);}.tmf-event-feed header{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 9px;border-bottom:1px solid rgba(201,168,95,.18);}.tmf-event-feed header b{display:block;color:#f0d98c;font-size:15px;letter-spacing:.22em;font-weight:500;}.tmf-event-feed header span{display:block;margin-top:2px;color:#8f846f;font-size:12px;letter-spacing:.12em;}.tmf-event-feed select{height:28px;max-width:112px;border:1px solid rgba(201,168,95,.26);background:rgba(10,8,6,.82);color:#d8c27c;font-family:inherit;font-size:12px;}',
      '.tmf-event-list{min-height:0;overflow-y:auto;scrollbar-width:thin;scrollbar-color:rgba(201,168,95,.45) transparent;padding:7px 7px 9px;display:flex;flex-direction:column;gap:6px;}.tmf-event-row{display:grid;grid-template-columns:36px minmax(0,1fr) 42px;align-items:center;gap:7px;min-height:50px;border:1px solid rgba(201,168,95,.14);background:rgba(255,255,255,.025);color:#d7c49b;text-align:left;cursor:pointer;font-family:inherit;padding:6px;}.tmf-event-row:hover{border-color:rgba(201,168,95,.42);background:rgba(201,168,95,.075);}.tmf-event-turn{color:#8dbdab;font-size:12px;letter-spacing:0;}.tmf-event-main{min-width:0;}.tmf-event-main b{display:block;color:#e6cf8e;font-size:13px;letter-spacing:.08em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}.tmf-event-main em{display:block;margin-top:3px;color:#a99d83;font-style:normal;font-size:12px;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}.tmf-event-type{justify-self:end;color:#8f846f;font-size:12px;writing-mode:vertical-rl;letter-spacing:.12em;}.tmf-event-empty{padding:18px 12px;color:#9f9277;font-size:13px;line-height:1.7;text-align:center;}',
      '#tm-phase8-action-tray{position:absolute;left:16px;bottom:26px;width:432px;height:168px;z-index:27;pointer-events:none;}#tm-phase8-action-tray .tmf-desk-action{position:absolute;width:102px;height:146px;border:0;background:transparent;padding:0;cursor:pointer;pointer-events:auto;filter:drop-shadow(0 8px 10px rgba(0,0,0,.52));font-family:"STKaiti","KaiTi","楷体",serif;color:#3a2614;}#tm-phase8-action-tray .tmf-desk-action:nth-child(1){left:0;top:7px;transform:rotate(-2deg);}#tm-phase8-action-tray .tmf-desk-action:nth-child(2){left:108px;top:0;transform:rotate(1deg);}#tm-phase8-action-tray .tmf-desk-action:nth-child(3){left:216px;top:6px;transform:rotate(-1deg);}#tm-phase8-action-tray .tmf-desk-action:nth-child(4){left:324px;top:3px;transform:rotate(1.4deg);}#tm-phase8-action-tray .tmf-desk-action:hover{transform:translateY(-5px) rotate(0deg);filter:drop-shadow(0 12px 16px rgba(0,0,0,.65));}.tmf-desk-action img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;}.tmf-desk-action span{position:absolute;left:30px;right:24px;top:28px;bottom:28px;display:flex;flex-direction:column;align-items:center;justify-content:center;writing-mode:vertical-rl;text-shadow:0 1px 0 rgba(255,248,220,.55);}.tmf-desk-action b{font-size:20px;letter-spacing:.16em;font-weight:700;}.tmf-desk-action em{margin-top:8px;font-size:12px;letter-spacing:.18em;font-style:normal;color:#8c2f22;}',
      'body.tm-phase8-formal #tm-phase8-event-notice.tm-event-notice{position:absolute;left:0;bottom:188px;width:366px;height:252px;z-index:62;padding:0;display:flex;flex-direction:column;border:0;background:linear-gradient(180deg,rgba(37,27,18,.88),rgba(15,12,9,.82));box-shadow:0 14px 32px rgba(0,0,0,.50);font-family:"STKaiti","KaiTi","楷体",serif;pointer-events:auto;}body.tm-phase8-formal .tm-event-board-head{flex:0 0 36px;display:flex;align-items:flex-start;justify-content:space-between;padding:0 8px 0 8px;border-top:1px solid rgba(201,168,95,.28);border-bottom:1px solid rgba(201,168,95,.18);background:linear-gradient(180deg,rgba(79,51,24,.60),rgba(22,16,11,.22));}body.tm-phase8-formal .tm-event-title-wrap{display:flex;align-items:center;gap:8px;min-width:0;height:36px;}body.tm-phase8-formal .tm-event-title-wrap b{color:#f0d98c;font-size:15px;letter-spacing:.18em;font-weight:500;}body.tm-phase8-formal .tm-event-kicker{color:#8dbdab;font-size:12px;letter-spacing:.18em;}body.tm-phase8-formal #tm-phase8-event-range{height:26px;margin-top:5px;max-width:92px;border:1px solid rgba(201,168,95,.30);background:#120e0b;color:#d8c27c;font-family:inherit;font-size:12px;}',
      'body.tm-phase8-formal #tm-phase8-event-notice .tmf-event-list{padding:8px 8px 10px;gap:7px;}body.tm-phase8-formal #tm-phase8-event-notice .tmf-event-row{min-height:45px;grid-template-columns:30px minmax(0,1fr) 34px;border-color:rgba(201,168,95,.18);background:linear-gradient(90deg,rgba(201,168,95,.06),rgba(0,0,0,.12));}body.tm-phase8-formal #tm-phase8-event-notice .tmf-event-main b{font-size:13px;}body.tm-phase8-formal #tm-phase8-event-notice .tmf-event-main em{-webkit-line-clamp:1;}',
      'body.tm-phase8-formal #tm-phase8-event-notice.tm-event-notice{left:0!important;bottom:188px!important;width:366px!important;height:252px!important;background:transparent!important;box-shadow:none!important;color:#e8d4a3!important;}body.tm-phase8-formal #tm-phase8-event-notice .tm-event-board-head{position:relative;z-index:2;display:flex!important;align-items:center!important;justify-content:space-between!important;flex:0 0 36px!important;padding:0 6px!important;border:0!important;background:transparent!important;}body.tm-phase8-formal .tm-event-board-title{display:flex;align-items:center;gap:6px;color:rgba(229,210,164,.58);font:700 11px/1 "STSong","SimSun",serif;letter-spacing:.12em;text-shadow:0 1px 2px rgba(0,0,0,.8);}body.tm-phase8-formal .tm-event-board-title:before{content:"";width:5px;height:5px;border-radius:50%;background:#d9b15f;box-shadow:0 0 8px rgba(217,177,95,.55);}body.tm-phase8-formal .tm-event-board-title span{min-width:20px;height:18px;display:inline-flex;align-items:center;justify-content:center;border:1px solid rgba(214,178,91,.30);border-radius:9px;background:rgba(11,9,7,.44);color:#9fd2c0;font-size:11px;letter-spacing:0;}body.tm-phase8-formal #tm-phase8-event-range{height:24px;margin:0;max-width:96px;border:1px solid rgba(214,178,91,.24);border-radius:12px;background:rgba(12,10,8,.58);color:rgba(229,210,164,.74);font:12px/1 "STSong","SimSun",serif;}',
      'body.tm-phase8-formal #tm-phase8-event-notice .tm-event-list{position:relative;z-index:1;flex:1 1 auto;min-height:0;overflow-y:auto;overflow-x:visible;display:flex;flex-direction:column;gap:6px;padding:0 8px 0 0;scrollbar-width:thin;scrollbar-color:rgba(214,178,91,.48) rgba(0,0,0,.18);}body.tm-phase8-formal .tm-event-item{position:relative;width:100%;min-height:48px;display:grid;grid-template-columns:34px minmax(0,1fr) auto;gap:7px;align-items:start;padding:7px 8px 7px 7px;border:1px solid rgba(214,178,91,.18);border-left-color:rgba(210,73,52,.38);border-radius:4px;background:linear-gradient(90deg,rgba(22,18,13,.90),rgba(22,17,12,.76) 64%,rgba(12,10,8,.40)),radial-gradient(ellipse at 0 50%,rgba(191,60,42,.18),transparent 48%);color:inherit;cursor:pointer;text-align:left;box-shadow:0 8px 18px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,238,186,.045);transition:border-color .14s ease,background .14s ease,transform .14s ease,box-shadow .14s ease;font-family:inherit;}body.tm-phase8-formal .tm-event-item:hover{border-color:rgba(238,202,118,.40);transform:translateX(3px);box-shadow:0 10px 22px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,238,186,.07);}',
      'body.tm-phase8-formal .tm-event-item .tm-event-seal{grid-row:auto;width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:50%;border:1px solid rgba(230,193,103,.42);background:radial-gradient(circle at 42% 28%,rgba(246,202,124,.22),transparent 42%),linear-gradient(180deg,rgba(83,33,23,.88),rgba(27,13,9,.94));color:#f0d083;font:700 15px/1 "STKaiti","KaiTi",serif;box-shadow:inset 0 0 0 1px rgba(0,0,0,.34),0 4px 11px rgba(0,0,0,.26);}body.tm-phase8-formal .tm-event-item .tm-event-main{min-width:0;}body.tm-phase8-formal .tm-event-item .tm-event-head{display:flex;align-items:center;gap:6px;margin:0;min-width:0;}body.tm-phase8-formal .tm-event-item .tm-event-kicker{flex:0 0 auto;color:rgba(156,205,187,.70);font:10px/1 "STSong","SimSun",serif;letter-spacing:.08em;}body.tm-phase8-formal .tm-event-item .tm-event-title{min-width:0;overflow:hidden;text-overflow:ellipsis;color:#efd58d;font:700 13px/1.15 "STKaiti","KaiTi",serif;letter-spacing:.05em;white-space:normal;}body.tm-phase8-formal .tm-event-item .tm-event-body{display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden;margin-top:3px;color:rgba(222,208,170,.66);font:11px/1.25 "STSong","SimSun",serif;letter-spacing:.04em;}body.tm-phase8-formal .tm-event-item .tm-event-tag{align-self:flex-start;min-width:30px;padding:2px 5px;text-align:center;border:1px solid rgba(214,178,91,.24);border-radius:2px;background:rgba(0,0,0,.16);color:rgba(229,210,164,.74);font:10px/1 "STSong","SimSun",serif;letter-spacing:.08em;}',
      'body.tm-phase8-formal #tm-phase8-action-tray.zb-action-tray{position:absolute;left:18px;bottom:24px;z-index:62;display:block;width:356px;height:150px;pointer-events:none;}body.tm-phase8-formal #tm-phase8-action-tray.zb-action-tray:before{content:"";position:absolute;left:-20px;right:-22px;bottom:-18px;height:62px;background:radial-gradient(ellipse at 42% 72%,rgba(0,0,0,.50),rgba(0,0,0,.22) 48%,transparent 74%);pointer-events:none;z-index:-1;}body.tm-phase8-formal .zb-action-tray .zb-img-btn{appearance:none;position:absolute!important;width:168px!important;height:70px!important;min-width:0;padding:0;border:1px solid rgba(214,188,116,.32);border-radius:5px;overflow:hidden;background:#15100b;cursor:pointer;pointer-events:auto;box-shadow:0 8px 18px rgba(0,0,0,.44),inset 0 1px 0 rgba(255,244,202,.12),inset 0 -1px 0 rgba(0,0,0,.55);filter:drop-shadow(0 8px 12px rgba(0,0,0,.34));transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease,filter .18s ease;}',
      'body.tm-phase8-formal .zb-action-tray .zb-img{width:100%;height:100%;object-fit:cover;display:block;pointer-events:none;opacity:.96;filter:saturate(.95) contrast(1.05) brightness(.96);transform:scale(1.012);transition:transform .24s ease,filter .24s ease,opacity .24s ease;}body.tm-phase8-formal .zb-action-tray .zb-img-btn:before{content:"";position:absolute;inset:0;z-index:1;background:linear-gradient(90deg,rgba(8,6,5,.72) 0%,rgba(8,6,5,.42) 36%,rgba(8,6,5,.10) 68%,rgba(8,6,5,.30) 100%),radial-gradient(ellipse at 18% 50%,rgba(223,174,82,.16),transparent 54%);pointer-events:none;transition:opacity .18s;}body.tm-phase8-formal .zb-action-tray .zb-img-btn:after{content:"";position:absolute;inset:1px;z-index:3;border-radius:5px;pointer-events:none;box-shadow:inset 0 0 0 1px rgba(244,215,136,.18),inset 0 0 18px rgba(0,0,0,.42);}body.tm-phase8-formal .zb-action-copy{position:absolute;z-index:2;left:13px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;align-items:flex-start;text-align:left;color:#f4dfaa;text-shadow:0 2px 6px #000;}body.tm-phase8-formal .zb-action-kicker{font-size:9px;letter-spacing:.22em;color:#8dbdab;margin-bottom:4px;}body.tm-phase8-formal .zb-action-copy b{font:700 17px/1 "STKaiti","KaiTi","楷体",serif;letter-spacing:.22em;}body.tm-phase8-formal #zhao-btn .zb-action-copy{left:auto;right:12px;align-items:flex-end;text-align:right;}',
      'body.tm-phase8-formal .zb-action-title{font:700 17px/1 "STKaiti","KaiTi","楷体",serif;letter-spacing:.20em;color:#f4dfaa;}body.tm-phase8-formal .zb-action-sub{margin-top:5px;color:rgba(232,218,178,.66);font:11px/1 "STSong","SimSun",serif;letter-spacing:.12em;}',
      'body.tm-phase8-formal .zb-action-tray .zb-img-btn:hover{border-color:rgba(238,203,118,.72);box-shadow:0 12px 24px rgba(0,0,0,.52),0 0 0 1px rgba(230,190,101,.15),inset 0 1px 0 rgba(255,244,202,.16),inset 0 -1px 0 rgba(0,0,0,.48);filter:drop-shadow(0 10px 16px rgba(0,0,0,.40)) brightness(1.04);transform:translateY(-4px) rotate(var(--action-tilt,0deg));}body.tm-phase8-formal .zb-action-tray .zb-img-btn:hover .zb-img{opacity:1;filter:saturate(1.02) contrast(1.08) brightness(1.02);transform:scale(1.045);}body.tm-phase8-formal .zb-action-tray #zhao-btn{left:0!important;top:2px;--action-tilt:-1.9deg;}body.tm-phase8-formal .zb-action-tray #zhao-btn-2{left:178px!important;top:5px;--action-tilt:.9deg;}body.tm-phase8-formal .zb-action-tray #zhao-btn-3{left:8px!important;top:78px;--action-tilt:-.7deg;}body.tm-phase8-formal .zb-action-tray #zhao-btn-4{left:185px!important;top:75px;--action-tilt:1.6deg;}',
      'body.tm-phase8-formal .tb-left:before{z-index:0!important;}body.tm-phase8-formal .tb-left>*{position:relative;z-index:1;}',
      'body.tm-phase8-formal #topbar{height:78px!important;padding:8px 12px 0!important;gap:9px!important;align-items:flex-start!important;background:transparent!important;border:0!important;box-shadow:none!important;backdrop-filter:none!important;pointer-events:none!important;}body.tm-phase8-formal #topbar:before,body.tm-phase8-formal #topbar:after{display:none!important;}body.tm-phase8-formal .tb-left,body.tm-phase8-formal .tb-vars,body.tm-phase8-formal .tb-right{pointer-events:auto!important;position:relative!important;z-index:2!important;flex-shrink:0!important;overflow:visible!important;}',
      'body.tm-phase8-formal .tb-left{width:205px!important;height:52px!important;margin:0 2px 0 0!important;padding:5px 13px 5px 7px!important;gap:7px!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;box-sizing:border-box!important;}body.tm-phase8-formal .tb-left:before{content:""!important;position:absolute!important;z-index:0!important;inset:-12px -16px -13px -10px!important;background:url("preview/img/topbar-left-identity-underlay-v1.png") center/100% 100% no-repeat!important;opacity:.68!important;filter:saturate(.98) brightness(.92) contrast(1.05)!important;pointer-events:none!important;}body.tm-phase8-formal .tb-left:after{display:none!important;}body.tm-phase8-formal .tb-left>*{position:relative!important;z-index:1!important;}',
      'body.tm-phase8-formal .tb-wentian{width:36px!important;min-width:36px!important;height:34px!important;padding:0!important;border:1px solid rgba(227,187,92,.62)!important;border-radius:50%!important;background:radial-gradient(circle at 35% 27%,rgba(251,221,143,.30),rgba(92,54,24,.88) 58%,rgba(12,9,7,.94) 78%),linear-gradient(180deg,rgba(63,38,20,.94),rgba(12,9,7,.94))!important;color:#f0d58f!important;font-size:11px!important;letter-spacing:.06em!important;box-shadow:inset 0 1px 0 rgba(255,239,180,.14),inset 0 -8px 14px rgba(0,0,0,.32),0 2px 8px rgba(0,0,0,.40),0 0 11px rgba(205,166,82,.15)!important;}body.tm-phase8-formal .tb-weather{height:34px!important;min-width:122px!important;padding:0!important;gap:6px!important;background:transparent!important;border:0!important;box-shadow:none!important;}body.tm-phase8-formal .tb-w-seal{width:24px!important;height:24px!important;font-size:12px!important;border-color:rgba(233,196,105,.52)!important;background:radial-gradient(circle at 35% 25%,rgba(255,225,147,.24),rgba(86,52,24,.74) 58%,rgba(13,10,8,.92))!important;}body.tm-phase8-formal .tb-w-info{min-width:82px!important;}body.tm-phase8-formal .tb-w-name{max-width:104px!important;font-size:12px!important;color:#efd990!important;}body.tm-phase8-formal .tb-w-desc{font-size:10px!important;color:rgba(209,193,153,.66)!important;}',
      'body.tm-phase8-formal .tb-vars{--tm-rail-w:932px;--tm-rail-h:54px;--tm-rail-pad-x:12px;--tm-rail-pad-y:7px;--tm-rail-gap:4px;--tm-wide-cell:212px;--tm-hukou-cell:104px;--tm-lizhi-cell:110px;--tm-small-cell:82px;width:var(--tm-rail-w)!important;height:var(--tm-rail-h)!important;flex:0 0 var(--tm-rail-w)!important;max-width:none!important;padding:var(--tm-rail-pad-y) var(--tm-rail-pad-x)!important;gap:var(--tm-rail-gap)!important;display:flex!important;align-items:center!important;border:0!important;border-radius:0!important;background:url("preview/img/topbar-resource-fieldrail-v2-wide.png") center/100% 100% no-repeat!important;box-shadow:none!important;box-sizing:border-box!important;}body.tm-phase8-formal .tb-vars:before,body.tm-phase8-formal .tb-vars:after{display:none!important;}',
      'body.tm-phase8-formal .tb-var{height:calc(var(--tm-rail-h) - (var(--tm-rail-pad-y) * 2))!important;min-width:0!important;border-color:transparent!important;background:transparent!important;box-shadow:none!important;border-radius:0!important;box-sizing:border-box!important;}body.tm-phase8-formal .tb-var:hover,body.tm-phase8-formal .tb-var.pinned{background:radial-gradient(ellipse at 50% 10%,rgba(231,190,99,.12),transparent 64%),linear-gradient(180deg,rgba(205,166,82,.075),rgba(205,166,82,.018))!important;}body.tm-phase8-formal .tb-var.wide{display:flex!important;flex-direction:column!important;align-items:stretch!important;justify-content:center!important;height:calc(var(--tm-rail-h) - (var(--tm-rail-pad-y) * 2))!important;flex:0 0 var(--tm-wide-cell)!important;width:var(--tm-wide-cell)!important;min-width:var(--tm-wide-cell)!important;max-width:var(--tm-wide-cell)!important;padding:5px 8px!important;gap:3px!important;overflow:hidden!important;}body.tm-phase8-formal .tb-var:not(.wide){display:flex!important;flex-direction:row!important;align-items:center!important;height:calc(var(--tm-rail-h) - (var(--tm-rail-pad-y) * 2))!important;flex:0 0 var(--tm-small-cell)!important;width:var(--tm-small-cell)!important;min-width:var(--tm-small-cell)!important;max-width:var(--tm-small-cell)!important;padding:5px 8px!important;gap:5px!important;overflow:hidden!important;}body.tm-phase8-formal .tb-var[data-key="hukou"]{flex-basis:var(--tm-hukou-cell)!important;width:var(--tm-hukou-cell)!important;min-width:var(--tm-hukou-cell)!important;max-width:var(--tm-hukou-cell)!important;}body.tm-phase8-formal .tb-var[data-key="lizhi"]{flex-basis:var(--tm-lizhi-cell)!important;width:var(--tm-lizhi-cell)!important;min-width:var(--tm-lizhi-cell)!important;max-width:var(--tm-lizhi-cell)!important;}',
      'body.tm-phase8-formal .tb-var.wide .tb-vn{flex:0 0 auto!important;width:auto!important;min-width:0!important;max-width:none!important;padding:0 0 0 4px!important;margin:0 0 2px!important;border-right:0!important;text-align:left!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;font-size:10px!important;line-height:1!important;letter-spacing:.18em!important;color:rgba(221,202,155,.76)!important;}body.tm-phase8-formal .tb-vn:before,body.tm-phase8-formal .tb-var.wide .tb-vn:before{display:none!important;}body.tm-phase8-formal .tb-var.wide .tb-vsubs{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;align-items:center!important;gap:4px!important;min-width:0!important;overflow:hidden!important;line-height:1.05!important;}body.tm-phase8-formal .tb-var.wide .tb-vs{height:32px!important;min-width:0!important;display:flex!important;align-items:center!important;gap:4px!important;padding:3px 3px!important;border-radius:2px!important;background:rgba(0,0,0,.12)!important;overflow:hidden!important;}body.tm-phase8-formal .tb-var.wide .icn{width:17px!important;height:17px!important;font-size:10px!important;}body.tm-phase8-formal .tb-var.wide .sv{min-width:0!important;flex:1 1 auto!important;overflow:hidden!important;line-height:1!important;}body.tm-phase8-formal .tb-var.wide .sv b{display:block!important;max-width:100%!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;font:600 12px/1.12 "STSong","SimSun","Songti SC",serif!important;color:#e0c77e!important;}body.tm-phase8-formal .tb-var.wide .sv .sd{display:block!important;max-width:100%!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;font:500 10px/1.05 "STSong","SimSun",serif!important;margin-top:1px!important;}',
      'body.tm-phase8-formal .tb-vbody{display:flex!important;flex-direction:column!important;justify-content:center!important;min-width:0!important;overflow:hidden!important;gap:1px!important;line-height:1.05!important;}body.tm-phase8-formal .tb-vn{max-width:100%!important;padding-left:0!important;margin-bottom:0!important;font-size:9px!important;line-height:1!important;letter-spacing:.18em!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;color:rgba(221,202,155,.72)!important;}body.tm-phase8-formal .tb-vv{display:block!important;max-width:100%!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;font-size:12px!important;line-height:1.05!important;color:#e0c77e!important;}body.tm-phase8-formal .tb-var.warn .tb-vv{color:#e88a78!important;}body.tm-phase8-formal .tb-var.good .tb-vv{color:#8dbdab!important;}',
      'body.tm-phase8-formal .tb-right{width:340px!important;height:52px!important;flex:0 0 340px!important;margin-left:auto!important;padding:6px 12px 6px 14px!important;gap:9px!important;display:flex!important;align-items:center!important;isolation:isolate!important;background:url("preview/img/topbar-right-fieldtime-v3-wide.png") center/100% 100% no-repeat!important;border:0!important;border-radius:4px!important;box-shadow:none!important;filter:drop-shadow(0 5px 12px rgba(0,0,0,.30))!important;box-sizing:border-box!important;}body.tm-phase8-formal .tb-right:before{display:none!important;}body.tm-phase8-formal .tb-chip{width:88px!important;min-width:88px!important;height:40px!important;padding:0 8px!important;display:flex!important;align-items:center!important;justify-content:center!important;border:0!important;background:transparent!important;box-shadow:none!important;color:rgba(237,214,151,.86)!important;text-shadow:0 1px 2px rgba(0,0,0,.75)!important;font-size:10.5px!important;}body.tm-phase8-formal .tb-time{flex:1 1 auto!important;height:40px!important;min-width:0!important;max-width:none!important;padding:6px 18px 5px 12px!important;display:flex!important;flex-direction:column!important;justify-content:center!important;align-items:flex-end!important;border:0!important;background:transparent!important;box-shadow:none!important;text-align:right!important;box-sizing:border-box!important;}body.tm-phase8-formal .tb-time-main{max-width:100%!important;font-size:12px!important;line-height:1.15!important;letter-spacing:.055em!important;color:#f1d792!important;text-shadow:0 1px 2px rgba(0,0,0,.78),0 0 8px rgba(217,177,87,.14)!important;}body.tm-phase8-formal .tb-time-sub{max-width:100%!important;font-size:10px!important;color:rgba(219,203,162,.70)!important;text-shadow:0 1px 2px rgba(0,0,0,.72)!important;}',
      '@media(max-width:1500px){body.tm-phase8-formal .tb-vars{--tm-rail-w:800px;--tm-rail-h:50px;--tm-rail-pad-x:9px;--tm-rail-pad-y:6px;--tm-rail-gap:3px;--tm-wide-cell:188px;--tm-hukou-cell:92px;--tm-lizhi-cell:92px;--tm-small-cell:62px;background-image:url("preview/img/topbar-resource-fieldrail-v2-wide.png")!important;}body.tm-phase8-formal .tb-right{width:230px!important;height:48px!important;flex-basis:230px!important;background-image:url("preview/img/topbar-right-fieldtime-v3-compact.png")!important;}}',
      '@media(max-width:1280px){body.tm-phase8-formal #topbar{height:70px!important;padding-top:7px!important;}body.tm-phase8-formal .tb-left{width:168px!important;height:48px!important;padding-right:10px!important;}body.tm-phase8-formal .tb-weather{min-width:92px!important;gap:4px!important;}body.tm-phase8-formal .tb-w-info{min-width:56px!important;}body.tm-phase8-formal .tb-w-name{max-width:72px!important;font-size:10.5px!important;}body.tm-phase8-formal .tb-w-desc{display:none!important;}body.tm-phase8-formal .tb-var.wide .sd{display:none!important;}body.tm-phase8-formal .tb-right{width:282px!important;height:48px!important;flex-basis:282px!important;padding:5px 10px 5px 11px!important;gap:7px!important;}body.tm-phase8-formal .tb-time{height:38px!important;padding-right:14px!important;}body.tm-phase8-formal .tb-time-main{font-size:11.5px!important;}body.tm-phase8-formal .tb-chip{width:72px!important;min-width:72px!important;height:38px!important;}}',
      '@media(max-width:1080px){body.tm-phase8-formal #topbar{height:66px!important;}body.tm-phase8-formal .tb-left{width:54px!important;padding-right:8px!important;}body.tm-phase8-formal .tb-weather{display:none!important;}body.tm-phase8-formal .tb-vars{--tm-rail-w:626px;--tm-rail-h:50px;--tm-rail-pad-x:9px;--tm-rail-pad-y:6px;--tm-rail-gap:3px;--tm-wide-cell:126px;--tm-hukou-cell:76px;--tm-lizhi-cell:82px;--tm-small-cell:60px;background-image:url("preview/img/topbar-resource-fieldrail-v2-narrow.png")!important;}body.tm-phase8-formal .tb-var.wide .tb-vn{display:none!important;}body.tm-phase8-formal .tb-chip{display:none!important;}body.tm-phase8-formal .tb-right{width:154px!important;height:48px!important;flex-basis:154px!important;background-image:url("preview/img/topbar-right-fieldtime-v3-narrow.png")!important;}body.tm-phase8-formal .tb-time{min-width:0!important;max-width:none!important;padding-right:12px!important;}body.tm-phase8-formal .tb-time-main{font-size:10.5px!important;}}',
      'body.tm-phase8-formal .generated-basemap{opacity:1!important;mix-blend-mode:normal!important;filter:none!important;image-rendering:auto!important;}body.tm-phase8-formal .ming-map-wash{--map-fog:.105;opacity:var(--map-fog)!important;background:radial-gradient(ellipse at 50% 48%,rgba(244,225,168,.12),transparent 56%),radial-gradient(ellipse at 0 48%,rgba(255,255,255,.20),transparent 34%),radial-gradient(ellipse at 100% 48%,rgba(255,255,255,.18),transparent 34%)!important;}',
      'body.tm-phase8-formal .map-tools-dock{z-index:4!important;}body.tm-phase8-formal .map-tools-toggle{border-left:2px solid rgba(126,184,167,.62)!important;border-radius:3px!important;background:linear-gradient(180deg,rgba(36,30,24,.78),rgba(18,16,14,.66)),radial-gradient(ellipse at 0 50%,rgba(126,184,167,.13),transparent 64%)!important;color:#f0d98c!important;box-shadow:0 8px 18px rgba(0,0,0,.38),inset 0 1px 0 rgba(255,255,255,.04)!important;}body.tm-phase8-formal .map-tools-mode{color:#8dbdab!important;font-size:11px!important;letter-spacing:.08em!important;padding-left:8px;border-left:1px solid rgba(214,188,116,.22);}body.tm-phase8-formal .map-tools-pop{border-radius:3px!important;box-shadow:0 10px 24px rgba(0,0,0,.42)!important;}',
      'body.tm-phase8-formal .map-layer,body.tm-phase8-formal .mnp-row button{border-radius:14px!important;font-size:11.5px!important;background:rgba(18,16,14,.58)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.04)!important;}body.tm-phase8-formal .map-layer:hover{color:#f0d98c!important;border-color:rgba(214,188,116,.48)!important;background:rgba(72,46,20,.72)!important;}body.tm-phase8-formal .map-layer.on,body.tm-phase8-formal .map-layer[aria-pressed="true"]{color:#f0d98c!important;border-color:rgba(214,188,116,.62)!important;background:rgba(184,154,83,.16)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 0 12px rgba(184,154,83,.12)!important;}',
      'body.tm-phase8-formal .map-alert-strip{z-index:4!important;}body.tm-phase8-formal .map-alert{padding:6px 11px!important;border-radius:3px!important;background:linear-gradient(180deg,rgba(36,30,24,.78),rgba(18,16,14,.68))!important;color:#d8cba8!important;font-size:12px!important;box-shadow:0 6px 14px rgba(0,0,0,.28)!important;}body.tm-phase8-formal .map-alert:hover{border-color:#d6bc74!important;color:#f5d995!important;background:rgba(62,38,18,.88)!important;}',
      'body.tm-phase8-formal .map-legend{right:126px!important;bottom:88px!important;width:258px!important;min-width:0!important;padding:7px 8px 6px!important;border-radius:4px!important;background:radial-gradient(ellipse at 50% 0,rgba(218,184,104,.10),transparent 64%),linear-gradient(180deg,rgba(30,24,18,.72),rgba(9,8,7,.66))!important;border:1px solid rgba(214,174,87,.28)!important;border-left:2px solid rgba(214,174,87,.46)!important;box-shadow:0 7px 18px rgba(0,0,0,.34),inset 0 1px 0 rgba(255,238,180,.055)!important;backdrop-filter:blur(5px);z-index:4!important;}body.tm-phase8-formal .map-legend-title{gap:7px!important;font-size:12px!important;letter-spacing:.10em!important;}body.tm-phase8-formal .map-legend-sub{flex:0 0 auto;padding:2px 5px;border:1px solid rgba(214,174,87,.20);border-radius:2px;background:rgba(0,0,0,.18);font-size:10px!important;}body.tm-phase8-formal .map-legend-main{display:grid!important;grid-template-columns:1fr auto;gap:8px;align-items:center;margin-top:5px!important;}body.tm-phase8-formal .map-legend-bar{height:6px!important;margin:0!important;border-radius:6px;}body.tm-phase8-formal .map-legend-detail{position:absolute;right:0;bottom:calc(100% + 8px);width:282px;margin:0!important;padding:8px 10px 10px!important;border:1px solid rgba(214,174,87,.30)!important;border-left:2px solid rgba(126,184,167,.54)!important;border-radius:4px;background:radial-gradient(ellipse at 100% 0,rgba(126,184,167,.10),transparent 58%),linear-gradient(180deg,rgba(31,25,19,.88),rgba(10,9,7,.82))!important;box-shadow:0 10px 26px rgba(0,0,0,.42),inset 0 1px 0 rgba(255,238,180,.05);opacity:0;transform:translateY(5px);pointer-events:none;transition:opacity .16s ease,transform .16s ease;}body.tm-phase8-formal .map-legend:hover .map-legend-detail,body.tm-phase8-formal .map-legend:focus-within .map-legend-detail{opacity:1;transform:translateY(0);pointer-events:auto;}',
      'body.tm-phase8-formal .ming-region{fill-opacity:.46!important;stroke:#2c1909!important;stroke-width:.9!important;stroke-opacity:.98!important;mix-blend-mode:multiply!important;filter:none!important;}body.tm-phase8-formal .ming-region:hover{fill-opacity:.48!important;stroke:#9b512c!important;stroke-width:1.46!important;}body.tm-phase8-formal .ming-region.selected{fill-opacity:.62!important;stroke:#e2b662!important;stroke-width:1.85!important;mix-blend-mode:normal!important;}body.tm-phase8-formal #mapwrap[data-map-mode="owner"] .ming-region{fill-opacity:.68!important;stroke-opacity:1!important;mix-blend-mode:normal!important;}',
      'body.tm-phase8-formal .ming-label{opacity:0;pointer-events:none;transition:opacity .18s,transform .18s;}body.tm-phase8-formal .ming-label text{text-anchor:middle;dominant-baseline:middle;fill:#f2dfad!important;stroke:none!important;paint-order:normal!important;font-family:"STKaiti","KaiTi","SimSun",serif;font-weight:700;font-size:11.5px;letter-spacing:.05em;text-shadow:none;}body.tm-phase8-formal .ming-label rect{fill:rgba(21,16,10,.58);stroke:rgba(214,188,116,.34);stroke-width:.8;rx:3;ry:3;vector-effect:non-scaling-stroke;filter:drop-shadow(0 4px 8px rgba(0,0,0,.28));}body.tm-phase8-formal #mapwrap[data-map-scale="region"] .ming-label{opacity:.92;}body.tm-phase8-formal #mapwrap[data-map-scale="realm"] .ming-label,body.tm-phase8-formal #mapwrap[data-map-scale="prefecture"] .ming-label{opacity:0;}',
      'body.tm-phase8-formal .tmf-faction-label{opacity:0;pointer-events:none;cursor:pointer;transition:opacity .18s,transform .18s;filter:drop-shadow(0 3px 3px rgba(0,0,0,.36));}body.tm-phase8-formal .tmf-faction-label rect,body.tm-phase8-formal .tmf-faction-label circle{display:none!important;}body.tm-phase8-formal .tmf-faction-label text{text-anchor:middle;dominant-baseline:middle;font-family:"STKaiti","KaiTi","SimSun",serif;font-weight:700;paint-order:stroke;stroke:rgba(24,15,6,.46);stroke-width:1.55px;}body.tm-phase8-formal .tmf-faction-label text.main{fill:rgba(246,224,166,.82)!important;font-size:var(--realm-label-size,34px)!important;letter-spacing:.34em;}body.tm-phase8-formal .tmf-faction-label text.sub{fill:rgba(224,199,129,.66)!important;font-size:11px!important;letter-spacing:.2em;stroke:rgba(24,15,6,.28);stroke-width:.55px;font-weight:500;}body.tm-phase8-formal #mapwrap[data-map-scale="realm"] .tmf-faction-label{opacity:.94;pointer-events:auto;}body.tm-phase8-formal #mapwrap[data-map-scale="region"] .tmf-faction-label,body.tm-phase8-formal #mapwrap[data-map-scale="prefecture"] .tmf-faction-label{opacity:0;}body.tm-phase8-formal .tmf-faction-label:hover text.main{fill:rgba(255,238,184,.96)!important;}',
      'body.tm-phase8-formal .tm-event-item.expanded{min-height:112px;border-color:rgba(239,200,103,.62);border-left-color:rgba(213,86,60,.90);}body.tm-phase8-formal .tm-event-time{flex:0 0 auto;color:rgba(180,160,118,.68);font:10px/1 "STSong","SimSun",serif;letter-spacing:.04em;}body.tm-phase8-formal .tm-event-item.expanded .tm-event-body{display:block;overflow:visible;-webkit-line-clamp:unset;}body.tm-phase8-formal .tm-event-detail{display:none;margin-top:7px;padding-top:7px;border-top:1px solid rgba(214,178,91,.12);color:rgba(224,211,176,.68);font:11.5px/1.45 "STSong","SimSun",serif;}body.tm-phase8-formal .tm-event-item.expanded .tm-event-detail{display:block;}body.tm-phase8-formal .tm-event-trace{display:flex;flex-wrap:wrap;gap:5px;margin-top:6px;}body.tm-phase8-formal .tm-event-trace span{padding:2px 6px;border:1px solid rgba(118,182,164,.25);border-radius:9px;color:rgba(156,205,187,.72);background:rgba(0,0,0,.16);font-size:10px;}body.tm-phase8-formal .tm-event-empty{margin:auto;color:rgba(202,186,145,.58);font:12px/1.5 "STSong","SimSun",serif;letter-spacing:.12em;}',
      'body.tm-phase8-formal .zb-action-tray #zhao-btn:before{background:linear-gradient(90deg,rgba(8,6,5,.18) 0%,rgba(8,6,5,.16) 34%,rgba(8,6,5,.45) 60%,rgba(8,6,5,.76) 100%),radial-gradient(ellipse at 76% 50%,rgba(223,174,82,.17),transparent 56%)!important;}body.tm-phase8-formal .zb-action-kicker{line-height:1!important;color:rgba(213,181,105,.72)!important;letter-spacing:0!important;}body.tm-phase8-formal .zb-action-title{line-height:1.05!important;white-space:nowrap!important;text-shadow:0 1px 1px rgba(0,0,0,.86),0 0 8px rgba(0,0,0,.62)!important;}body.tm-phase8-formal .zb-action-sub{color:rgba(232,209,150,.72)!important;white-space:nowrap!important;}',
      '.tmf-records-overlay,.tmf-event-detail{position:fixed;inset:0;z-index:9998;background:rgba(10,7,4,.78);display:flex;align-items:center;justify-content:center;font-family:"STKaiti","KaiTi","楷体",serif;}.tmf-records-dialog,.tmf-event-dialog{width:min(760px,86vw);max-height:78vh;background:linear-gradient(180deg,#211811,#100c08);border:1px solid rgba(201,168,95,.52);box-shadow:0 18px 60px rgba(0,0,0,.72);color:#eadfbd;display:flex;flex-direction:column;}.tmf-records-dialog header,.tmf-event-dialog header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 18px;border-bottom:1px solid rgba(201,168,95,.22);}.tmf-records-dialog header span,.tmf-event-dialog header span{color:#8dbdab;font-size:12px;letter-spacing:.18em;}.tmf-records-dialog h3,.tmf-event-dialog h3{margin:3px 0 0;color:#f0d98c;font-size:22px;letter-spacing:.18em;font-weight:500;}.tmf-event-dialog header p{margin:4px 0 0;color:#9f9277;font-size:12px;}.tmf-records-dialog header button,.tmf-event-dialog header button{width:28px;height:28px;border:1px solid rgba(201,168,95,.32);background:rgba(0,0,0,.18);color:#d8c27c;cursor:pointer;}.tmf-records-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:18px;}.tmf-records-grid button{min-height:118px;border:1px solid rgba(201,168,95,.28);background:linear-gradient(180deg,rgba(201,168,95,.08),rgba(0,0,0,.20));color:#eadfbd;font-family:inherit;cursor:pointer;padding:14px;text-align:left;}.tmf-records-grid b{display:block;color:#f0d98c;font-size:20px;letter-spacing:.22em;margin-bottom:12px;}.tmf-records-grid span{font-size:13px;color:#a99d83;line-height:1.55;}.tmf-event-dialog main{overflow-y:auto;white-space:pre-wrap;padding:22px 26px;font-size:16px;line-height:2;color:#d7c49b;}.tmf-event-dialog footer{display:flex;gap:8px;justify-content:flex-end;padding:12px 16px;border-top:1px solid rgba(201,168,95,.18);}.tmf-event-dialog footer button{border:1px solid rgba(201,168,95,.32);background:rgba(201,168,95,.08);color:#e6cf8e;font-family:inherit;padding:7px 12px;cursor:pointer;}',
      '.tmf-module-overlay{position:fixed;inset:0;z-index:9996;background:rgba(8,6,4,.62);display:flex;align-items:center;justify-content:center;font-family:"STKaiti","KaiTi","楷体",serif;color:#eadfbd;}',
      'body.tm-phase8-formal .renwu-card[hidden]{display:none!important;}',
      '.tmf-module{width:min(1360px,92vw);height:min(820px,84vh);display:flex;flex-direction:column;background:linear-gradient(180deg,rgba(29,22,15,.98),rgba(10,8,6,.985));border:1px solid rgba(201,168,95,.54);box-shadow:0 26px 80px rgba(0,0,0,.75),inset 0 0 0 1px rgba(0,0,0,.5);overflow:hidden;}',
      '.tmf-module>header{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;padding:16px 20px;border-bottom:1px solid rgba(201,168,95,.22);background:linear-gradient(90deg,rgba(201,168,95,.08),rgba(126,184,167,.04),transparent);}.tmf-module>header span{display:block;color:#8dbdab;font-size:12px;letter-spacing:.22em;}.tmf-module>header h2{margin:4px 0 0;color:#f0d98c;font-size:28px;font-weight:500;letter-spacing:.24em;}.tmf-module>header p{margin:6px 0 0;color:#9f9277;font-size:13px;letter-spacing:.06em;}.tmf-module>header button{width:32px;height:32px;border:1px solid rgba(201,168,95,.32);background:rgba(0,0,0,.18);color:#d8c27c;cursor:pointer;font-size:18px;}',
      '.tmf-module-body{flex:1;min-height:0;display:grid;grid-template-columns:300px minmax(0,1fr) 300px;gap:0;}.tmf-module-left,.tmf-module-right{min-height:0;overflow:hidden;padding:14px;border-right:1px solid rgba(201,168,95,.16);background:rgba(255,255,255,.018);}.tmf-module-right{border-right:0;border-left:1px solid rgba(201,168,95,.16);}.tmf-module-main{min-width:0;min-height:0;overflow-y:auto;padding:18px 20px;scrollbar-width:thin;scrollbar-color:rgba(201,168,95,.50) transparent;}',
      'body.tm-phase8-formal .tmf-module-overlay-edict .tmf-module,body.tm-phase8-formal .tmf-module-overlay-memorial .tmf-module,body.tm-phase8-formal .tmf-module-overlay-letter .tmf-module,body.tm-phase8-formal .tmf-module-overlay-records .tmf-module{width:min(1680px,98vw);height:min(980px,94vh);}body.tm-phase8-formal .tmf-module-overlay-edict .tmf-module-body,body.tm-phase8-formal .tmf-module-overlay-memorial .tmf-module-body,body.tm-phase8-formal .tmf-module-overlay-letter .tmf-module-body,body.tm-phase8-formal .tmf-module-overlay-records .tmf-module-body{grid-template-columns:340px minmax(0,1fr) 320px;}@media(max-width:1080px){body.tm-phase8-formal .tmf-module-overlay-edict .tmf-module,body.tm-phase8-formal .tmf-module-overlay-memorial .tmf-module,body.tm-phase8-formal .tmf-module-overlay-letter .tmf-module,body.tm-phase8-formal .tmf-module-overlay-records .tmf-module{width:calc(100vw - 24px);height:calc(100vh - 24px);}body.tm-phase8-formal .tmf-module-overlay-edict .tmf-module-body,body.tm-phase8-formal .tmf-module-overlay-memorial .tmf-module-body,body.tm-phase8-formal .tmf-module-overlay-letter .tmf-module-body,body.tm-phase8-formal .tmf-module-overlay-records .tmf-module-body{grid-template-columns:280px minmax(0,1fr) 240px;}}',
      '.tmf-module h3{margin:0 0 12px;color:#d7be73;font-size:18px;font-weight:500;letter-spacing:.20em;border-bottom:1px solid rgba(184,154,83,.20);padding-bottom:8px;}.tmf-module-note,.tmf-prose{color:#c7b996;font-size:15px;line-height:1.8;white-space:pre-wrap;}.tmf-module-scroll{height:calc(100% - 42px);overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding-right:3px;scrollbar-width:thin;scrollbar-color:rgba(201,168,95,.45) transparent;}.tmf-module-scroll.compact{height:auto;max-height:520px;}',
      '.tmf-module-item,.tmf-record-row{border:1px solid rgba(184,154,83,.18);background:rgba(255,255,255,.025);padding:9px 10px;color:#d8cba8;}.tmf-module-item.hot{border-left:2px solid rgba(192,64,48,.72);}.tmf-module-item b,.tmf-record-row b{display:block;color:#f0d98c;font-size:15px;letter-spacing:.08em;}.tmf-module-item span{display:block;margin-top:4px;color:#8dbdab;font-size:12px;}.tmf-module-item p,.tmf-record-row p{margin:7px 0 0;color:#a99d83;font-size:13px;line-height:1.55;}.tmf-module-item button{margin-top:8px;border:1px solid rgba(126,184,167,.42);background:rgba(126,184,167,.08);color:#bde6d9;font-family:inherit;padding:4px 9px;cursor:pointer;}',
      '.tmf-edict-paper{min-height:360px;padding:24px 30px;background:linear-gradient(180deg,#efe0b7,#d7c089);border:1px solid rgba(97,62,25,.55);box-shadow:inset 0 0 34px rgba(91,54,20,.20);color:#3f2713;font-size:20px;line-height:2;letter-spacing:.12em;}.tmf-edict-paper p{margin:0 0 10px;}.tmf-module-actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:14px;}.tmf-module-actions button,.tmf-module-stack button,.tmf-module-tabs button{border:1px solid rgba(184,154,83,.32);background:rgba(184,154,83,.08);color:#e6cf8e;font-family:inherit;padding:7px 12px;cursor:pointer;letter-spacing:.08em;}.tmf-module-actions button:hover,.tmf-module-stack button:hover,.tmf-module-tabs button:hover,.tmf-module-stack button.active,.tmf-module-tabs button.active{border-color:#d4be7a;color:#f5df9a;background:rgba(184,154,83,.15);}.tmf-module-stack{display:flex;flex-direction:column;gap:8px;}.tmf-module-tabs{display:grid;grid-template-columns:1fr 1fr;gap:8px;}',
      '.tmf-letter-editor{display:flex;flex-direction:column;gap:10px;}.tmf-letter-editor input,.tmf-letter-editor textarea,.tmf-module-search input{width:100%;box-sizing:border-box;border:1px solid rgba(184,154,83,.28);background:rgba(0,0,0,.20);color:#eadfbd;font-family:inherit;padding:9px 10px;}.tmf-letter-editor textarea{min-height:260px;line-height:1.8;resize:vertical;}.tmf-person-pick,.tmf-renwu-list-row{width:100%;display:flex;justify-content:space-between;gap:10px;align-items:center;text-align:left;border:1px solid rgba(184,154,83,.16);background:rgba(255,255,255,.022);color:#d8cba8;font-family:inherit;padding:8px 9px;cursor:pointer;}.tmf-person-pick b,.tmf-renwu-list-row b{color:#f0d98c;font-size:14px;}.tmf-person-pick span,.tmf-renwu-list-row span{color:#8f846f;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}.tmf-renwu-list-row.active{border-color:rgba(126,184,167,.56);background:rgba(126,184,167,.08);}',
      '.tmf-renwu-detail{display:grid;grid-template-columns:128px minmax(0,1fr);gap:16px;align-items:start;margin-bottom:18px;padding:14px;border:1px solid rgba(184,154,83,.20);background:rgba(255,255,255,.02);}.tmf-renwu-avatar{height:150px;border:1px solid rgba(201,168,95,.42);display:flex;align-items:center;justify-content:center;font-size:64px;color:#d7be73;background:radial-gradient(circle,rgba(201,168,95,.18),rgba(0,0,0,.22));}.tmf-renwu-detail h3{border:0;margin-bottom:6px;padding:0;font-size:26px;}.tmf-renwu-detail p{margin:6px 0;color:#c2b28f;line-height:1.7;}',
      'body.tm-phase8-formal .tmf-module-overlay-renwu{align-items:flex-start;justify-content:center;padding-top:54px;background:radial-gradient(ellipse at 50% 0,rgba(95,68,36,.22),transparent 46%),rgba(8,6,4,.78);box-sizing:border-box;}body.tm-phase8-formal .tmf-module-overlay-renwu .renwu-atlas{width:min(1180px,calc(100vw - 72px));height:calc(100vh - 96px);min-height:0;display:flex;flex-direction:column;border:1px solid rgba(201,160,69,.48);border-radius:4px;background:linear-gradient(180deg,rgba(28,22,17,.99),rgba(10,8,7,.985)),repeating-linear-gradient(90deg,rgba(255,236,170,.022) 0 1px,transparent 1px 34px);box-shadow:0 26px 80px rgba(0,0,0,.78),inset 0 0 0 1px rgba(0,0,0,.55);overflow:hidden;color:#eadfbd;font-family:"STKaiti","KaiTi","SimSun",serif;}body.tm-phase8-formal .renwu-atlas-head{flex:0 0 auto;display:flex;align-items:center;justify-content:space-between;gap:18px;padding:11px 14px;border-bottom:1px solid rgba(201,160,69,.20);background:linear-gradient(90deg,rgba(201,160,69,.08),rgba(126,184,167,.04),transparent);}body.tm-phase8-formal .renwu-titleblock{display:flex;align-items:center;gap:11px;min-width:0;}body.tm-phase8-formal .renwu-title-seal{width:38px;height:38px;display:grid;place-items:center;border-radius:3px;border:1px solid rgba(213,176,95,.52);background:radial-gradient(circle at 35% 25%,rgba(232,204,125,.24),rgba(109,39,25,.88) 62%,rgba(12,9,7,.95));color:#f2d98c;font-size:20px;letter-spacing:0;}body.tm-phase8-formal .renwu-titletext h2{margin:0;color:#f1d98d;font-size:20px;font-weight:500;letter-spacing:.16em;}body.tm-phase8-formal .renwu-titletext p{margin:4px 0 0;color:rgba(224,211,171,.58);font-size:12px;letter-spacing:.08em;}body.tm-phase8-formal .renwu-head-actions{display:flex;align-items:center;gap:7px;}body.tm-phase8-formal .renwu-head-btn{height:30px;min-width:34px;padding:0 11px;border:1px solid rgba(201,160,69,.30);border-radius:2px;background:rgba(0,0,0,.18);color:#d8c27c;font-family:inherit;cursor:pointer;}body.tm-phase8-formal .renwu-head-btn:hover{border-color:#d4be7a;color:#f4dc96;background:rgba(184,154,83,.12);}',
      'body.tm-phase8-formal .renwu-atlas-body{flex:1;min-height:0;display:grid;grid-template-columns:296px minmax(0,1fr) 242px;}body.tm-phase8-formal .renwu-roster{min-height:0;display:flex;flex-direction:column;border-right:1px solid rgba(201,160,69,.16);background:rgba(0,0,0,.10);overflow:hidden;}body.tm-phase8-formal .renwu-statbar{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;padding:9px;border-bottom:1px solid rgba(201,160,69,.12);}body.tm-phase8-formal .renwu-stat{min-width:0;padding:7px 6px;border:1px solid rgba(201,160,69,.16);border-radius:2px;background:rgba(255,245,210,.035);text-align:center;}body.tm-phase8-formal .renwu-stat b{display:block;color:#f1d98d;font-size:17px;line-height:1;}body.tm-phase8-formal .renwu-stat span{display:block;margin-top:4px;color:rgba(224,211,171,.52);font-size:11px;letter-spacing:.12em;}body.tm-phase8-formal .renwu-tools{padding:9px;border-bottom:1px solid rgba(201,160,69,.12);}body.tm-phase8-formal .renwu-tool-row{display:flex;gap:7px;}body.tm-phase8-formal .renwu-search,body.tm-phase8-formal .renwu-filter-row select{width:100%;height:28px;box-sizing:border-box;border:1px solid rgba(184,154,83,.26);border-radius:2px;background:rgba(0,0,0,.24);color:#eadfbd;font-family:inherit;font-size:12px;outline:none;}body.tm-phase8-formal .renwu-search{padding:0 9px;}body.tm-phase8-formal .renwu-filter-row{display:grid;gap:6px;margin-top:7px;}body.tm-phase8-formal .renwu-filter-row.three{grid-template-columns:repeat(3,minmax(0,1fr));}body.tm-phase8-formal .renwu-legend{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px;color:rgba(224,211,171,.58);font-size:11px;}body.tm-phase8-formal .renwu-legend span{padding:2px 6px;border:1px solid rgba(201,160,69,.13);border-radius:9px;background:rgba(0,0,0,.14);}body.tm-phase8-formal .renwu-legend b{color:#f1d98d;}body.tm-phase8-formal .renwu-roster-list{flex:1;min-height:0;overflow-y:auto;padding:8px 8px 12px;scrollbar-width:thin;scrollbar-color:rgba(201,160,69,.58) rgba(0,0,0,.25);}',
      'body.tm-phase8-formal .renwu-card{position:relative;width:100%;display:grid;grid-template-columns:44px minmax(0,1fr) 36px;gap:8px;align-items:center;margin:0 0 7px;padding:7px;border:1px solid rgba(201,160,69,.14);border-left:2px solid rgba(var(--rw-rgb,184,154,83),.55);border-radius:2px;background:linear-gradient(90deg,rgba(var(--rw-rgb,184,154,83),.055),rgba(0,0,0,.16));color:#eadfbd;font-family:inherit;text-align:left;cursor:pointer;}body.tm-phase8-formal .renwu-card:hover,body.tm-phase8-formal .renwu-card.active{border-color:rgba(var(--rw-rgb,184,154,83),.62);background:linear-gradient(90deg,rgba(var(--rw-rgb,184,154,83),.14),rgba(0,0,0,.18));}body.tm-phase8-formal .renwu-card.pinned:after{content:"钉";position:absolute;right:5px;top:4px;color:#f1d98d;font-size:11px;}body.tm-phase8-formal .renwu-thumb{width:44px;height:58px;object-fit:cover;border-radius:2px;border:1px solid rgba(201,160,69,.25);background:#17110d;}body.tm-phase8-formal .renwu-card-main{min-width:0;display:block;}body.tm-phase8-formal .renwu-card-name{display:block;color:#f2d98d;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}body.tm-phase8-formal .renwu-card-meta{display:block;margin-top:3px;color:rgba(224,211,171,.54);font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}body.tm-phase8-formal .renwu-card-tags{display:flex;flex-wrap:wrap;gap:3px;margin-top:5px;}body.tm-phase8-formal .renwu-card-tags i{font-style:normal;padding:1px 5px;border:1px solid rgba(201,160,69,.14);border-radius:8px;color:rgba(224,211,171,.64);font-size:10px;}body.tm-phase8-formal .renwu-card-bars{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;margin-top:5px;}body.tm-phase8-formal .renwu-card-bars i{display:flex;align-items:center;gap:3px;font-style:normal;color:rgba(224,211,171,.48);font-size:10px;}body.tm-phase8-formal .renwu-card-bars b{height:3px;flex:1;background:linear-gradient(90deg,var(--rw-color,#b89a53) var(--v),rgba(255,255,255,.08) 0);}body.tm-phase8-formal .renwu-loyalty{display:grid;place-items:center;align-self:stretch;border-left:1px solid rgba(201,160,69,.12);}body.tm-phase8-formal .renwu-loyalty b{color:#f2ddb0;font-size:16px;}body.tm-phase8-formal .renwu-loyalty small{color:rgba(224,211,171,.48);font-size:10px;}',
      'body.tm-phase8-formal .renwu-main{min-width:0;min-height:0;display:flex;flex-direction:column;background:radial-gradient(ellipse at 20% 0,rgba(201,160,69,.07),transparent 38%),rgba(0,0,0,.08);overflow:hidden;}body.tm-phase8-formal .renwu-focus-v5{display:grid;grid-template-columns:132px minmax(0,1fr) 190px;gap:14px;padding:14px 16px;border-bottom:1px solid rgba(201,160,69,.16);background:linear-gradient(180deg,rgba(255,245,210,.045),rgba(0,0,0,.08));}body.tm-phase8-formal .renwu-portrait-frame{position:relative;}body.tm-phase8-formal .renwu-portrait-frame:after{content:"";position:absolute;right:9px;bottom:8px;width:18px;height:18px;border:1px solid rgba(213,176,95,.50);background:rgba(108,40,24,.84);box-shadow:0 4px 9px rgba(0,0,0,.35);}body.tm-phase8-formal .renwu-portrait-large{width:122px;height:164px;object-fit:cover;border-radius:3px;border:1px solid rgba(201,160,69,.32);box-shadow:0 10px 22px rgba(0,0,0,.36);background:#17110d;}body.tm-phase8-formal .renwu-name-v5{min-width:0;}body.tm-phase8-formal .renwu-name-v5 h3{margin:0;color:#f4dc96;font-size:26px;font-weight:500;letter-spacing:.12em;}body.tm-phase8-formal .renwu-name-v5 .sub{margin-top:5px;color:rgba(224,211,171,.56);font-size:12px;letter-spacing:.08em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}body.tm-phase8-formal .renwu-pillline-v5{display:flex;flex-wrap:wrap;gap:5px;margin-top:9px;}body.tm-phase8-formal .renwu-pillline-v5 span{padding:3px 7px;border:1px solid rgba(var(--rw-rgb,184,154,83),.22);border-radius:10px;background:rgba(0,0,0,.16);color:rgba(238,227,194,.72);font-size:11px;}body.tm-phase8-formal .renwu-scoreline-v5{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin-top:12px;}body.tm-phase8-formal .renwu-score-v5{padding:7px;border:1px solid rgba(201,160,69,.14);background:rgba(0,0,0,.18);}body.tm-phase8-formal .renwu-score-v5 span{display:block;color:rgba(224,211,171,.50);font-size:11px;letter-spacing:.10em;}body.tm-phase8-formal .renwu-score-v5 b{display:block;margin-top:4px;color:#f2ddb0;font-size:17px;}body.tm-phase8-formal .renwu-judgement-v5{padding:10px;border:1px solid rgba(var(--rw-rgb,184,154,83),.26);background:linear-gradient(180deg,rgba(var(--rw-rgb,184,154,83),.08),rgba(0,0,0,.14));}body.tm-phase8-formal .renwu-judgement-v5 b{display:block;color:#f1d98d;margin-bottom:6px;font-size:12px;letter-spacing:.12em;}body.tm-phase8-formal .renwu-judgement-v5 p{margin:0;color:rgba(238,227,194,.72);font-size:12px;line-height:1.65;}body.tm-phase8-formal .renwu-action-row.v5{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;}body.tm-phase8-formal .renwu-action-row button{height:30px;padding:0 11px;border:1px solid rgba(201,160,69,.25);border-radius:2px;background:rgba(0,0,0,.18);color:#e6cf8e;font-family:inherit;cursor:pointer;}body.tm-phase8-formal .renwu-action-row button:hover{border-color:#d4be7a;color:#f4dc96;background:rgba(184,154,83,.13);}',
      'body.tm-phase8-formal .renwu-tabs{flex:0 0 auto;display:flex;gap:3px;padding:7px 16px 0;border-bottom:1px solid rgba(201,160,69,.16);}body.tm-phase8-formal .renwu-tab{height:30px;padding:0 14px;border:1px solid rgba(201,160,69,.18);border-bottom:0;border-radius:2px 2px 0 0;background:rgba(0,0,0,.12);color:rgba(224,211,171,.62);font-family:inherit;cursor:pointer;}body.tm-phase8-formal .renwu-tab.active,body.tm-phase8-formal .renwu-tab:hover{color:#f1d98d;border-color:rgba(201,160,69,.38);background:rgba(201,160,69,.08);}body.tm-phase8-formal .renwu-detail-scroll{flex:1;min-height:0;overflow-y:auto;padding:12px 16px 16px;scrollbar-width:thin;scrollbar-color:rgba(201,160,69,.58) rgba(0,0,0,.25);}body.tm-phase8-formal .renwu-grid-2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;}body.tm-phase8-formal .renwu-sec{margin-bottom:10px;border:1px solid rgba(201,160,69,.14);border-radius:2px;background:rgba(255,245,210,.028);overflow:hidden;}body.tm-phase8-formal .renwu-sec-title{padding:7px 9px;border-bottom:1px solid rgba(201,160,69,.12);color:#d7be73;font-size:12px;letter-spacing:.16em;background:rgba(0,0,0,.12);}body.tm-phase8-formal .renwu-prose{padding:9px 10px;color:rgba(238,227,194,.72);font-size:13px;line-height:1.75;white-space:pre-wrap;}body.tm-phase8-formal .renwu-list{padding:7px 9px;display:grid;gap:6px;}body.tm-phase8-formal .renwu-list-row{display:grid;grid-template-columns:74px minmax(0,1fr);gap:8px;align-items:start;padding-bottom:6px;border-bottom:1px solid rgba(201,160,69,.08);}body.tm-phase8-formal .renwu-list-row:last-child{border-bottom:0;}body.tm-phase8-formal .renwu-list-row span{color:rgba(224,211,171,.48);font-size:12px;}body.tm-phase8-formal .renwu-list-row b{color:rgba(238,227,194,.78);font-size:12.5px;font-weight:400;line-height:1.55;}body.tm-phase8-formal .renwu-ability-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;padding:9px;}body.tm-phase8-formal .renwu-ability{padding:7px;border:1px solid rgba(201,160,69,.12);background:rgba(0,0,0,.14);}body.tm-phase8-formal .renwu-ability span{color:rgba(224,211,171,.50);font-size:11px;}body.tm-phase8-formal .renwu-ability b{display:block;margin-top:3px;color:#f2ddb0;font-size:16px;}body.tm-phase8-formal .renwu-ability i{display:block;height:4px;margin-top:5px;background:linear-gradient(90deg,var(--rw-color,#b89a53) var(--v),rgba(255,255,255,.08) 0);}body.tm-phase8-formal .renwu-memory{padding:9px 10px;color:rgba(238,227,194,.72);font-size:12px;}body.tm-phase8-formal .renwu-memory summary{cursor:pointer;color:#f1d98d;letter-spacing:.10em;}body.tm-phase8-formal .renwu-memory p{margin:8px 0 0;line-height:1.65;}body.tm-phase8-formal .renwu-memory p b{display:inline-grid;place-items:center;width:18px;height:18px;margin-right:7px;border:1px solid rgba(201,160,69,.18);border-radius:50%;color:#d7be73;font-size:11px;}body.tm-phase8-formal .renwu-rel-list{display:grid;gap:7px;padding:9px;}body.tm-phase8-formal .renwu-rel-list button{display:grid;grid-template-columns:70px minmax(0,1fr) 40px;gap:8px;align-items:center;border:1px solid rgba(201,160,69,.14);background:rgba(0,0,0,.14);color:#eadfbd;font-family:inherit;padding:7px 9px;text-align:left;cursor:pointer;}body.tm-phase8-formal .renwu-rel-list span{color:#8dbdab;font-size:12px;}body.tm-phase8-formal .renwu-rel-list b{font-size:13px;color:#f2d98d;font-weight:400;}body.tm-phase8-formal .renwu-rel-list i{font-style:normal;text-align:right;color:rgba(238,227,194,.64);}body.tm-phase8-formal .renwu-timeline{padding:9px;display:grid;gap:7px;}body.tm-phase8-formal .renwu-timeline div{display:grid;grid-template-columns:70px minmax(0,1fr);gap:8px;border-bottom:1px solid rgba(201,160,69,.08);padding-bottom:7px;}body.tm-phase8-formal .renwu-timeline span{color:#8dbdab;font-size:12px;}body.tm-phase8-formal .renwu-timeline b{color:rgba(238,227,194,.74);font-size:12.5px;font-weight:400;}',
      'body.tm-phase8-formal .renwu-side{min-height:0;display:flex;flex-direction:column;border-left:1px solid rgba(201,160,69,.16);background:rgba(0,0,0,.13);overflow:hidden;}body.tm-phase8-formal .renwu-side-top{padding:12px;border-bottom:1px solid rgba(201,160,69,.13);}body.tm-phase8-formal .renwu-side-title{color:#d7be73;font-size:12px;letter-spacing:.16em;margin-bottom:8px;}body.tm-phase8-formal .renwu-mini-network{position:relative;height:180px;border:1px solid rgba(201,160,69,.14);background:radial-gradient(circle at 50% 50%,rgba(var(--rw-rgb,184,154,83),.12),transparent 52%),rgba(0,0,0,.15);overflow:hidden;}body.tm-phase8-formal .renwu-mini-network:before{content:"";position:absolute;left:16%;right:16%;top:50%;height:1px;background:rgba(201,160,69,.18);box-shadow:0 -46px 0 rgba(201,160,69,.10),0 46px 0 rgba(201,160,69,.10);transform:rotate(-18deg);}body.tm-phase8-formal .renwu-mini-node{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);max-width:74px;padding:4px 7px;border:1px solid rgba(201,160,69,.24);border-radius:12px;background:rgba(15,12,9,.86);color:#e6cf8e;font-family:inherit;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;}body.tm-phase8-formal .renwu-mini-node.self{border-color:rgba(var(--rw-rgb,184,154,83),.62);color:#f4dc96;background:rgba(var(--rw-rgb,184,154,83),.18);}body.tm-phase8-formal .renwu-side-scroll{flex:1;min-height:0;overflow-y:auto;padding:10px;scrollbar-width:thin;scrollbar-color:rgba(201,160,69,.58) rgba(0,0,0,.25);}body.tm-phase8-formal .renwu-side-card{margin-bottom:8px;padding:9px;border:1px solid rgba(201,160,69,.14);border-radius:2px;background:rgba(255,245,210,.028);}body.tm-phase8-formal .renwu-side-card b{display:block;color:#f1d98d;margin-bottom:5px;font-size:12px;letter-spacing:.12em;}body.tm-phase8-formal .renwu-side-card span{display:block;color:rgba(238,227,194,.68);font-size:12px;line-height:1.55;}@media(max-width:1180px){body.tm-phase8-formal .tmf-module-overlay-renwu .renwu-atlas{width:calc(100vw - 32px);}body.tm-phase8-formal .renwu-atlas-body{grid-template-columns:276px minmax(0,1fr);}body.tm-phase8-formal .renwu-side{display:none;}body.tm-phase8-formal .renwu-focus-v5{grid-template-columns:122px minmax(0,1fr);}body.tm-phase8-formal .renwu-judgement-v5{grid-column:1 / -1;}body.tm-phase8-formal .renwu-grid-2{grid-template-columns:1fr;}}',
      'body.tm-phase8-formal .renwu-action-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding:10px;}body.tm-phase8-formal .renwu-action-grid button{min-height:54px;padding:8px 10px;border:1px solid rgba(201,160,69,.20);border-radius:2px;background:linear-gradient(180deg,rgba(201,160,69,.06),rgba(0,0,0,.16));color:#e6cf8e;font-family:inherit;text-align:left;cursor:pointer;}body.tm-phase8-formal .renwu-action-grid button.primary{border-color:rgba(213,176,95,.50);background:linear-gradient(180deg,rgba(224,184,92,.18),rgba(97,52,22,.34));color:#f4dc96;}body.tm-phase8-formal .renwu-action-grid button:hover{border-color:#d4be7a;background:rgba(184,154,83,.14);}body.tm-phase8-formal .renwu-action-grid button span{display:block;margin-top:5px;color:rgba(238,227,194,.54);font-size:12px;line-height:1.45;}',
      'body.tm-phase8-formal .renwu-check{height:28px;display:flex;align-items:center;gap:5px;padding:0 7px;border:1px solid rgba(201,160,69,.18);border-radius:2px;background:rgba(0,0,0,.18);color:rgba(232,217,174,.66);font-size:11px;white-space:nowrap;}body.tm-phase8-formal .renwu-check input{accent-color:#c9a045;}body.tm-phase8-formal .renwu-wuchang{display:flex;flex-wrap:wrap;gap:5px;padding:9px 10px;}body.tm-phase8-formal .renwu-wuchang.compact{padding:5px 0 0;gap:3px;}body.tm-phase8-formal .renwu-wuchang span{min-width:34px;height:24px;display:flex;align-items:center;justify-content:center;gap:3px;border:1px solid rgba(201,160,69,.18);border-radius:12px;background:rgba(0,0,0,.16);color:rgba(232,217,174,.62);font-size:11px;}body.tm-phase8-formal .renwu-wuchang.compact span{min-width:22px;height:17px;font-size:10px;}body.tm-phase8-formal .renwu-wuchang span b{font-weight:500;color:inherit;}body.tm-phase8-formal .renwu-wuchang span i{font-style:normal;color:rgba(238,227,194,.58);}body.tm-phase8-formal .renwu-wuchang.compact span i{display:none;}body.tm-phase8-formal .renwu-wuchang span.hi{color:#f2d98d;border-color:rgba(242,217,141,.42);background:rgba(201,160,69,.09);}body.tm-phase8-formal .renwu-wuchang span.mid{color:#bfc9a0;}body.tm-phase8-formal .renwu-wuchang span.lo{color:#bd8a7d;border-color:rgba(189,138,125,.25);}body.tm-phase8-formal .renwu-source-list{padding:9px 10px;display:grid;gap:7px;}body.tm-phase8-formal .renwu-source-list p{margin:0;padding:7px 8px;border-left:2px solid rgba(var(--rw-rgb,184,154,83),.42);background:rgba(0,0,0,.14);color:rgba(238,227,194,.70);font-size:12px;line-height:1.65;}',
      'body.tm-phase8-formal .tmf-module-overlay-renwu{padding-top:44px;background:radial-gradient(ellipse at 28% 18%,rgba(212,190,122,.09),transparent 36%),radial-gradient(ellipse at 76% 82%,rgba(126,184,167,.07),transparent 36%),rgba(5,4,3,.68);}body.tm-phase8-formal .tmf-module-overlay-renwu .renwu-atlas{width:min(1340px,calc(100vw - 54px));height:calc(100vh - 68px);border-color:rgba(201,160,69,.43);border-radius:7px;background:linear-gradient(180deg,rgba(36,28,20,.98),rgba(12,10,8,.96)),repeating-linear-gradient(90deg,transparent 0,transparent 36px,rgba(201,160,69,.025) 36px,rgba(201,160,69,.025) 37px);box-shadow:0 26px 72px rgba(0,0,0,.64),inset 0 1px 0 rgba(255,241,190,.10);}body.tm-phase8-formal .renwu-atlas{position:relative;}body.tm-phase8-formal .renwu-atlas:before{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(90deg,rgba(149,41,31,.13),transparent 18%,transparent 82%,rgba(126,184,167,.08)),radial-gradient(ellipse at 50% 0,rgba(236,199,116,.11),transparent 48%);mix-blend-mode:screen;}body.tm-phase8-formal .renwu-atlas-head{position:relative;z-index:1;display:grid;grid-template-columns:1fr auto;gap:18px;padding:15px 17px 13px;border-bottom:1px solid rgba(201,160,69,.24);background:linear-gradient(180deg,rgba(8,7,5,.62),rgba(8,7,5,.18)),radial-gradient(ellipse at 12% 0,rgba(201,160,69,.12),transparent 46%);}body.tm-phase8-formal .renwu-titleblock{gap:13px;}body.tm-phase8-formal .renwu-title-seal{width:48px;height:48px;border-radius:50%;color:#f7e6bc;background:radial-gradient(circle at 35% 28%,#b84738,#6f2019 62%,#2a0d0a);border:1px solid rgba(244,211,139,.44);box-shadow:inset 0 0 0 2px rgba(0,0,0,.26),0 0 18px rgba(184,71,56,.26);font-family:serif;font-size:17px;letter-spacing:.06em;transform:rotate(-6deg);}body.tm-phase8-formal .renwu-titletext h2{font-family:serif;font-size:22px;font-weight:700;letter-spacing:.22em;}body.tm-phase8-formal .renwu-titletext p{font-size:12px;letter-spacing:.11em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}body.tm-phase8-formal .renwu-head-actions{gap:8px;}body.tm-phase8-formal .renwu-head-btn{height:32px;padding:0 12px;border-radius:4px;color:rgba(234,220,181,.78);background:linear-gradient(180deg,rgba(53,38,22,.64),rgba(13,10,8,.58));letter-spacing:.10em;}',
      'body.tm-phase8-formal .renwu-atlas-body{position:relative;z-index:1;display:grid;grid-template-columns:330px minmax(0,1fr) 292px;}body.tm-phase8-formal .renwu-roster{display:grid;grid-template-rows:auto auto minmax(0,1fr);background:linear-gradient(180deg,rgba(0,0,0,.18),rgba(0,0,0,.08));}body.tm-phase8-formal .renwu-statbar{gap:7px;padding:12px;}body.tm-phase8-formal .renwu-stat{padding:8px 7px;border-radius:5px;text-align:left;background:rgba(255,245,210,.04);}body.tm-phase8-formal .renwu-stat b{font-size:18px;}body.tm-phase8-formal .renwu-stat span{margin-top:3px;}body.tm-phase8-formal .renwu-tools{display:grid;gap:8px;padding:11px 12px;}body.tm-phase8-formal .renwu-tool-row{display:grid;grid-template-columns:1fr auto;gap:7px;align-items:center;}body.tm-phase8-formal .renwu-search{height:34px;border-color:rgba(201,160,69,.30);border-radius:4px;background:rgba(5,5,4,.62);color:#f2e5bf;}body.tm-phase8-formal .renwu-filter-row{gap:7px;margin-top:0;}body.tm-phase8-formal .renwu-filter-row select{height:30px;border-color:rgba(201,160,69,.24);border-radius:4px;background:#11100d;color:rgba(232,217,174,.78);}body.tm-phase8-formal .renwu-roster-list{padding:10px 10px 13px;}body.tm-phase8-formal .renwu-check{height:30px;border-radius:4px;padding:0 8px;gap:6px;}body.tm-phase8-formal .renwu-legend{padding:0;margin-top:0;}body.tm-phase8-formal .renwu-legend span{border-color:rgba(var(--rw-rgb,184,154,83),.28);border-radius:999px;color:var(--rw-color,#d4be7a);background:rgba(var(--rw-rgb,184,154,83),.07);}',
      'body.tm-phase8-formal .renwu-card{grid-template-columns:58px minmax(0,1fr) 48px;gap:9px;margin-bottom:9px;padding:8px;border-left:3px solid var(--rw-color,#b89a53);border-radius:5px;background:linear-gradient(90deg,rgba(var(--rw-rgb,184,154,83),.08),transparent 56%),rgba(255,245,210,.035);transition:transform .14s ease,border-color .14s ease,background .14s ease;}body.tm-phase8-formal .renwu-card:hover,body.tm-phase8-formal .renwu-card.active{transform:translateY(-1px);border-color:rgba(238,211,139,.48);background:linear-gradient(90deg,rgba(var(--rw-rgb,184,154,83),.16),transparent 60%),rgba(255,245,210,.055);}body.tm-phase8-formal .renwu-thumb{width:58px;height:76px;border-radius:3px;border-color:rgba(201,160,69,.32);box-shadow:inset 0 0 0 1px rgba(255,255,255,.05);}body.tm-phase8-formal .renwu-card-name{color:#f3e5bc;font-size:13px;letter-spacing:.08em;}body.tm-phase8-formal .renwu-card-meta{font-size:11.5px;line-height:1.45;white-space:normal;}body.tm-phase8-formal .renwu-card-tags{gap:4px;margin-top:6px;}body.tm-phase8-formal .renwu-card-tags i{border-radius:999px;background:rgba(0,0,0,.18);}body.tm-phase8-formal .renwu-card-bars{gap:4px;margin-top:6px;}body.tm-phase8-formal .renwu-card-bars i{display:grid;grid-template-columns:12px minmax(0,1fr);gap:3px;}body.tm-phase8-formal .renwu-card-bars b{height:3px;border-radius:4px;background:linear-gradient(90deg,var(--rw-color,#b89a53) var(--v),rgba(255,245,210,.11) 0);}body.tm-phase8-formal .renwu-loyalty{border-left:0;gap:3px;}body.tm-phase8-formal .renwu-loyalty b{color:var(--rw-color,#d4be7a);font-size:17px;}',
      'body.tm-phase8-formal .renwu-focus-v5{display:grid;grid-template-columns:190px minmax(0,1fr);gap:18px;padding:18px;border-bottom:1px solid rgba(201,160,69,.13);background:radial-gradient(ellipse at 24% 20%,rgba(var(--rw-rgb,184,154,83),.10),transparent 48%),rgba(0,0,0,.10);}body.tm-phase8-formal .renwu-portrait-frame{grid-row:1 / span 2;min-width:0;height:240px;align-self:start;}body.tm-phase8-formal .renwu-portrait-frame:before,body.tm-phase8-formal .renwu-portrait-frame:after{content:"";position:absolute;width:30px;height:30px;border-color:rgba(238,211,139,.62);background:transparent;box-shadow:none;pointer-events:none;}body.tm-phase8-formal .renwu-portrait-frame:before{left:9px;top:9px;border-left:1px solid;border-top:1px solid;}body.tm-phase8-formal .renwu-portrait-frame:after{right:19px;bottom:9px;border-right:1px solid;border-bottom:1px solid;}body.tm-phase8-formal .renwu-portrait-large{width:180px;height:240px;border-radius:5px;border-color:rgba(201,160,69,.42);box-shadow:0 14px 28px rgba(0,0,0,.38),inset 0 0 0 1px rgba(255,255,255,.05);}body.tm-phase8-formal .renwu-name-v5 h3{font-family:serif;font-size:28px;letter-spacing:.18em;line-height:1.15;}body.tm-phase8-formal .renwu-name-v5 .sub{font-size:13px;letter-spacing:.12em;}body.tm-phase8-formal .renwu-pillline-v5{gap:6px;margin-top:10px;}body.tm-phase8-formal .renwu-pillline-v5 span{border-radius:3px;font-size:12px;letter-spacing:.08em;}body.tm-phase8-formal .renwu-scoreline-v5{gap:8px;margin-top:14px;}body.tm-phase8-formal .renwu-score-v5{padding:8px;border-radius:5px;background:rgba(0,0,0,.20);}body.tm-phase8-formal .renwu-score-v5 b{font-size:17px;}body.tm-phase8-formal .renwu-judgement-v5{grid-column:2;margin-top:-2px;border-radius:5px;font-size:11.5px;line-height:1.55;}body.tm-phase8-formal .renwu-action-row.v5{gap:7px;margin-top:15px;}body.tm-phase8-formal .renwu-action-row button{min-height:30px;border-radius:4px;background:linear-gradient(180deg,rgba(53,38,22,.64),rgba(13,10,8,.58));}',
      'body.tm-phase8-formal .renwu-tabs{gap:4px;padding:9px 16px 0;}body.tm-phase8-formal .renwu-tab{height:32px;border-radius:4px 4px 0 0;letter-spacing:.08em;}body.tm-phase8-formal .renwu-detail-scroll{padding:12px 16px 16px;}body.tm-phase8-formal .renwu-grid-2{gap:12px;}body.tm-phase8-formal .renwu-sec{border-radius:5px;background:rgba(255,245,210,.034);}body.tm-phase8-formal .renwu-sec-title{padding:8px 10px;color:#f1d98d;background:rgba(0,0,0,.16);}body.tm-phase8-formal .renwu-list-row{grid-template-columns:82px minmax(0,1fr);padding-bottom:7px;}body.tm-phase8-formal .renwu-ability-grid{gap:8px;padding:10px;}body.tm-phase8-formal .renwu-ability{border-radius:5px;background:rgba(0,0,0,.18);}body.tm-phase8-formal .renwu-wuchang{gap:5px;margin-top:0;}body.tm-phase8-formal .renwu-wuchang.compact{padding:5px 0 0;gap:3px;}body.tm-phase8-formal .renwu-wuchang.compact span{width:17px;min-width:17px;height:17px;border-radius:50%;padding:0;}body.tm-phase8-formal .renwu-wuchang:not(.compact) span{min-width:42px;height:25px;border-radius:14px;}',
      'body.tm-phase8-formal .renwu-side{background:rgba(0,0,0,.13);}body.tm-phase8-formal .renwu-side-top{padding:12px;}body.tm-phase8-formal .renwu-mini-network{height:180px;}body.tm-phase8-formal .renwu-side-scroll{padding:10px;}body.tm-phase8-formal .renwu-side-card{margin-bottom:8px;padding:9px;border-radius:5px;background:rgba(255,245,210,.032);}body.tm-phase8-formal .renwu-side-card>b{font-size:12px;letter-spacing:.12em;}body.tm-phase8-formal .renwu-side-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;}body.tm-phase8-formal .renwu-side-metric{padding:7px;border:1px solid rgba(201,160,69,.12);border-radius:4px;background:rgba(0,0,0,.18);}body.tm-phase8-formal .renwu-side-metric span{font-size:11px!important;color:rgba(224,211,171,.52)!important;}body.tm-phase8-formal .renwu-side-metric b{display:block!important;margin:4px 0 0!important;color:#f3e5bc!important;font-size:15px!important;letter-spacing:0!important;}body.tm-phase8-formal .renwu-mini-list{display:grid;gap:6px;}body.tm-phase8-formal .renwu-mini-list span,body.tm-phase8-formal .renwu-mini-list button{display:grid;grid-template-columns:44px minmax(0,1fr) auto;gap:6px;align-items:center;width:100%;box-sizing:border-box;border:1px solid rgba(201,160,69,.12);border-radius:4px;background:rgba(0,0,0,.14);color:rgba(238,227,194,.70);font-family:inherit;font-size:12px;line-height:1.45;text-align:left;padding:6px 7px;}body.tm-phase8-formal .renwu-mini-list button{cursor:pointer;}body.tm-phase8-formal .renwu-mini-list i{font-style:normal;color:#8dbdab;font-size:11px;white-space:nowrap;}body.tm-phase8-formal .renwu-mini-list em{font-style:normal;color:rgba(238,227,194,.58);font-size:12px;}body.tm-phase8-formal .renwu-index-tags{display:flex;flex-wrap:wrap;gap:5px;}body.tm-phase8-formal .renwu-index-tags span{display:inline-flex!important;width:auto;padding:2px 7px;border:1px solid rgba(var(--rw-rgb,184,154,83),.28);border-radius:999px;color:var(--rw-color,#d4be7a)!important;background:rgba(var(--rw-rgb,184,154,83),.07);font-size:11px!important;line-height:1.4!important;}@media(max-width:1180px){body.tm-phase8-formal .renwu-atlas-body{grid-template-columns:300px minmax(0,1fr);}body.tm-phase8-formal .renwu-side{display:none;}body.tm-phase8-formal .renwu-focus-v5{grid-template-columns:150px minmax(0,1fr);}body.tm-phase8-formal .renwu-portrait-large{width:140px;height:186px;}body.tm-phase8-formal .renwu-judgement-v5{grid-column:1 / -1;}body.tm-phase8-formal .renwu-grid-2{grid-template-columns:1fr;}}',
      'body.tm-phase8-formal .renwu-main{display:grid!important;grid-template-rows:auto auto minmax(0,1fr)!important;background:transparent!important;}body.tm-phase8-formal .renwu-profile-head{display:grid;grid-template-columns:190px minmax(0,1fr);gap:18px;padding:18px;border-bottom:1px solid rgba(201,160,69,.13);background:radial-gradient(ellipse at 24% 20%,rgba(var(--rw-rgb,184,154,83),.10),transparent 48%),rgba(0,0,0,.10);}body.tm-phase8-formal .renwu-profile-title{min-width:0;}body.tm-phase8-formal .renwu-profile-title h3{margin:0;color:#f4dc96;font-family:serif;font-size:28px;letter-spacing:.18em;line-height:1.15;}body.tm-phase8-formal .renwu-profile-title .courtesy{color:rgba(224,211,171,.56);font-size:13px;letter-spacing:.12em;margin-top:5px;}body.tm-phase8-formal .renwu-profile-title .office{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;}body.tm-phase8-formal .renwu-pill{padding:3px 8px;border:1px solid rgba(201,160,69,.18);border-radius:3px;color:rgba(232,217,174,.74);background:rgba(0,0,0,.20);font-size:12px;letter-spacing:.08em;}body.tm-phase8-formal .renwu-pill.faction{color:var(--rw-color,#d4be7a);border-color:rgba(var(--rw-rgb,184,154,83),.38);background:rgba(var(--rw-rgb,184,154,83),.08);}body.tm-phase8-formal .renwu-portrait-frame{position:relative!important;min-width:0!important;height:240px!important;align-self:start!important;grid-row:auto!important;}body.tm-phase8-formal .renwu-portrait-frame:before,body.tm-phase8-formal .renwu-portrait-frame:after{content:""!important;position:absolute!important;width:30px!important;height:30px!important;border-color:rgba(238,211,139,.62)!important;background:transparent!important;box-shadow:none!important;pointer-events:none!important;}body.tm-phase8-formal .renwu-portrait-frame:before{left:9px!important;top:9px!important;border-left:1px solid!important;border-top:1px solid!important;}body.tm-phase8-formal .renwu-portrait-frame:after{right:19px!important;bottom:9px!important;border-right:1px solid!important;border-bottom:1px solid!important;}body.tm-phase8-formal .renwu-heart-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:14px;}body.tm-phase8-formal .renwu-heart{padding:8px;border:1px solid rgba(201,160,69,.14);border-radius:5px;background:rgba(0,0,0,.20);}body.tm-phase8-formal .renwu-heart span{display:block;color:rgba(224,211,171,.52);font-size:11px;letter-spacing:.12em;}body.tm-phase8-formal .renwu-heart b{display:block;margin-top:4px;color:#f3e5bc;font-size:17px;line-height:1;}body.tm-phase8-formal .renwu-verdict{margin-top:10px;padding:7px 9px;border:1px solid rgba(201,160,69,.16);border-radius:5px;color:rgba(238,227,194,.70);background:rgba(0,0,0,.18);font-size:11.5px;line-height:1.55;}body.tm-phase8-formal .renwu-verdict b{display:block;color:#f1d98d;margin-bottom:4px;font-size:12px;}body.tm-phase8-formal .renwu-verdict p{margin:0;}body.tm-phase8-formal .renwu-card-tags span{padding:1px 5px;border:1px solid rgba(201,160,69,.14);border-radius:999px;color:rgba(232,217,174,.64);background:rgba(0,0,0,.18);font-size:10px;}body.tm-phase8-formal .renwu-card-bar{display:grid;grid-template-columns:12px minmax(0,1fr);gap:3px;align-items:center;color:rgba(224,211,171,.48);font-size:10px;}body.tm-phase8-formal .renwu-card-bar i{display:block!important;height:3px!important;border-radius:4px;background:rgba(255,245,210,.11)!important;overflow:hidden;}body.tm-phase8-formal .renwu-card-bar i:before{content:"";display:block;width:var(--v,50%);height:100%;background:linear-gradient(90deg,var(--rw-color,#b89a53),rgba(242,217,141,.85));}body.tm-phase8-formal .renwu-ability-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding:10px;}body.tm-phase8-formal .renwu-ability{display:grid;grid-template-columns:26px minmax(0,1fr) 32px;gap:7px;align-items:center;padding:0;border:0;background:transparent;}body.tm-phase8-formal .renwu-ability .k{width:24px;height:24px;display:grid;place-items:center;border-radius:50%;color:#f1d98c;border:1px solid rgba(201,160,69,.32);background:rgba(0,0,0,.20);font-size:12px;}body.tm-phase8-formal .renwu-ability .bar{display:block;height:6px;border-radius:8px;overflow:hidden;background:rgba(255,245,210,.10);}body.tm-phase8-formal .renwu-ability .fill{display:block;height:100%;border-radius:8px;background:linear-gradient(90deg,var(--rw-color,#b89a53),#f0d68d);}body.tm-phase8-formal .renwu-ability .v{color:#f3e5bc;font-size:12px;text-align:right;}body.tm-phase8-formal .renwu-panel.active{display:block;padding-bottom:12px;}body.tm-phase8-formal .renwu-id-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;padding:10px;}body.tm-phase8-formal .renwu-id-cell{min-width:0;padding:8px;border:1px solid rgba(201,160,69,.10);border-radius:5px;background:rgba(0,0,0,.15);}body.tm-phase8-formal .renwu-id-cell span{display:block;color:rgba(224,211,171,.48);font-size:11px;letter-spacing:.12em;}body.tm-phase8-formal .renwu-id-cell b{display:block;margin-top:4px;color:rgba(242,232,202,.84);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}body.tm-phase8-formal .renwu-quality-grid,body.tm-phase8-formal .renwu-resource-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;padding:10px;}body.tm-phase8-formal .renwu-resource{padding:9px 8px;border:1px solid rgba(201,160,69,.12);border-radius:5px;background:rgba(0,0,0,.16);}body.tm-phase8-formal .renwu-resource span{display:block;color:rgba(224,211,171,.50);font-size:11px;letter-spacing:.12em;}body.tm-phase8-formal .renwu-resource b{display:block;margin-top:5px;color:#f1d98c;font-size:15px;}body.tm-phase8-formal .renwu-family-tree{padding:12px;}body.tm-phase8-formal .renwu-family-row{display:flex;justify-content:center;gap:9px;margin:8px 0;flex-wrap:wrap;}body.tm-phase8-formal .renwu-family-node{min-width:86px;padding:7px 9px;text-align:center;border:1px solid rgba(201,160,69,.20);border-radius:5px;background:rgba(0,0,0,.18);color:rgba(238,227,194,.76);font-size:12px;}body.tm-phase8-formal .renwu-family-node.self{border-color:rgba(242,217,141,.60);color:#24160c;background:linear-gradient(180deg,#f2d98c,#b9853a);font-weight:700;}body.tm-phase8-formal .renwu-family-line{height:18px;width:1px;margin:0 auto;background:linear-gradient(180deg,rgba(201,160,69,.38),rgba(201,160,69,.08));}body.tm-phase8-formal .renwu-work-card{margin:8px 10px;padding:8px 10px;border:1px solid rgba(201,160,69,.13);border-radius:5px;background:rgba(0,0,0,.18);}body.tm-phase8-formal .renwu-work-card b{display:block;color:#f1d98c;font-size:12px;margin-bottom:4px;}body.tm-phase8-formal .renwu-work-card span{display:block;color:rgba(238,227,194,.66);font-size:12px;line-height:1.55;}',
      'body.tm-phase8-formal #gs-status-bar,body.tm-phase8-formal .gs-status-bar{display:none!important;}body.tm-phase8-formal .renwu-title-line{display:flex;align-items:center;gap:10px;}body.tm-phase8-formal .renwu-title-line h2{margin:0!important;}body.tm-phase8-formal .renwu-ceming-btn{height:28px;padding:0 10px;border:1px solid rgba(201,160,69,.36);border-radius:4px;background:linear-gradient(180deg,rgba(201,160,69,.13),rgba(0,0,0,.18));color:#f1d98d;font-family:inherit;font-size:12px;letter-spacing:.12em;cursor:pointer;}body.tm-phase8-formal .renwu-ceming-btn:hover{border-color:rgba(242,217,141,.62);background:rgba(201,160,69,.18);}body.tm-phase8-formal .tmf-module-overlay-renwu{align-items:flex-start!important;justify-content:center!important;padding:0!important;overflow:hidden!important;overscroll-behavior:contain!important;}body.tm-phase8-formal .tmf-module-overlay-renwu .renwu-atlas{position:fixed!important;left:50%!important;top:44px!important;transform:translateX(-50%)!important;margin:0!important;max-height:calc(100vh - 68px)!important;}',
      '.tmf-shizheng-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;}.tmf-shizheng-grid article{border:1px solid rgba(184,154,83,.18);background:rgba(255,255,255,.025);padding:12px;min-height:132px;}.tmf-shizheng-grid b{display:block;color:#f0d98c;font-size:17px;letter-spacing:.10em;}.tmf-shizheng-grid span{display:inline-block;margin-top:6px;color:#8dbdab;font-size:12px;}.tmf-shizheng-grid p{color:#b9aa8a;font-size:13px;line-height:1.65;}.tmf-shizheng-grid button{border:1px solid rgba(126,184,167,.42);background:rgba(126,184,167,.08);color:#bde6d9;font-family:inherit;padding:5px 10px;cursor:pointer;}',
      'body.tm-phase8-formal .tmf-module-shizheng .tmf-module-body{grid-template-columns:318px minmax(0,1fr) 230px!important;}body.tm-phase8-formal .tmf-module-shizheng .tmf-module-left,body.tm-phase8-formal .tmf-module-shizheng .tmf-module-main,body.tm-phase8-formal .tmf-module-shizheng .tmf-module-right{min-height:0;}body.tm-phase8-formal .tmf-sz-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-bottom:10px;}body.tm-phase8-formal .tmf-sz-summary span{min-height:56px;display:flex;flex-direction:column;align-items:center;justify-content:center;border:1px solid rgba(201,168,95,.22);background:radial-gradient(ellipse at 50% 0,rgba(201,168,95,.12),transparent 60%),rgba(0,0,0,.16);}body.tm-phase8-formal .tmf-sz-summary i{font-style:normal;color:#8dbdab;font-size:12px;letter-spacing:.14em;}body.tm-phase8-formal .tmf-sz-summary b{margin-top:4px;color:#f0d98c;font-size:22px;line-height:1;font-weight:500;}body.tm-phase8-formal .tmf-sz-list{height:calc(100% - 66px);min-height:0;overflow:auto;display:flex;flex-direction:column;gap:8px;padding-right:4px;}',
      'body.tm-phase8-formal .tmf-sz-card{position:relative;min-height:118px;width:100%;display:block;text-align:left;padding:12px 12px 11px;border:1px solid rgba(201,168,95,.22);border-left:3px solid rgba(198,76,54,.55);background:linear-gradient(180deg,rgba(35,26,18,.86),rgba(16,12,9,.78));color:#eadfbd;font-family:inherit;cursor:pointer;box-shadow:inset 0 1px 0 rgba(255,238,186,.04),0 8px 18px rgba(0,0,0,.18);}body.tm-phase8-formal .tmf-sz-card.ok{opacity:.72;border-left-color:rgba(126,184,167,.52);background:linear-gradient(180deg,rgba(26,28,22,.78),rgba(13,12,9,.72));}body.tm-phase8-formal .tmf-sz-card.active,body.tm-phase8-formal .tmf-sz-card:hover{border-color:rgba(238,202,118,.48);box-shadow:inset 0 0 0 1px rgba(238,202,118,.10),0 10px 22px rgba(0,0,0,.26);transform:translateX(2px);}body.tm-phase8-formal .tmf-sz-card b{display:block;margin:0 54px 6px 0;color:#f0d98c;font-size:17px;line-height:1.25;letter-spacing:.08em;}body.tm-phase8-formal .tmf-sz-card em{display:block;margin-bottom:7px;color:#8dbdab;font-style:normal;font-size:12px;line-height:1.35;}body.tm-phase8-formal .tmf-sz-card p{margin:0;color:#b9aa8a;font-size:12.5px;line-height:1.55;}body.tm-phase8-formal .tmf-sz-badge{position:absolute;right:10px;top:10px;padding:2px 8px;border:1px solid rgba(201,168,95,.30);background:rgba(0,0,0,.20);color:#d8c27c;font-size:12px;letter-spacing:.12em;transform:rotate(2deg);}',
      'body.tm-phase8-formal .tmf-sz-detail{height:100%;min-height:0;overflow:auto;padding-right:6px;}body.tm-phase8-formal .tmf-sz-detail-head{text-align:center;margin-bottom:12px;padding:16px 18px 14px;border:1px solid rgba(201,168,95,.24);background:radial-gradient(ellipse at 50% 0,rgba(201,168,95,.12),transparent 62%),linear-gradient(180deg,rgba(34,25,17,.78),rgba(14,11,8,.58));}body.tm-phase8-formal .tmf-sz-detail-head.hot{border-top:3px solid rgba(198,76,54,.70);}body.tm-phase8-formal .tmf-sz-detail-head.ok{border-top:3px solid rgba(126,184,167,.62);}body.tm-phase8-formal .tmf-sz-detail-head span{display:inline-flex;margin-bottom:8px;padding:2px 10px;border:1px solid rgba(201,168,95,.25);color:#8dbdab;background:rgba(0,0,0,.14);font-size:12px;letter-spacing:.18em;}body.tm-phase8-formal .tmf-sz-detail-head h3{margin:0;color:#f1d98d;font-size:25px;line-height:1.28;letter-spacing:.12em;font-weight:500;}body.tm-phase8-formal .tmf-sz-detail-head p{margin:8px 0 0;color:#a99a74;font-size:12px;line-height:1.5;}body.tm-phase8-formal .tmf-sz-block{margin-bottom:10px;padding:12px 14px;border-left:3px solid rgba(201,168,95,.46);background:rgba(255,245,210,.035);}body.tm-phase8-formal .tmf-sz-block>b{display:block;margin-bottom:6px;color:#f0d68d;font-size:15px;letter-spacing:.12em;}body.tm-phase8-formal .tmf-sz-block p{margin:0;color:#d8cba8;font-size:14px;line-height:1.8;}',
      'body.tm-phase8-formal .tmf-sz-tags{display:flex;flex-wrap:wrap;gap:6px;}body.tm-phase8-formal .tmf-sz-tags span{padding:3px 8px;border:1px solid rgba(126,184,167,.26);border-radius:10px;background:rgba(0,0,0,.16);color:#9fd2c0;font-size:12px;letter-spacing:.08em;}body.tm-phase8-formal .tmf-sz-rows{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;}body.tm-phase8-formal .tmf-sz-rows span{display:flex;justify-content:space-between;gap:8px;border:1px solid rgba(201,168,95,.14);background:rgba(0,0,0,.14);padding:6px 8px;}body.tm-phase8-formal .tmf-sz-rows i{font-style:normal;color:#8dbdab;}body.tm-phase8-formal .tmf-sz-rows em{font-style:normal;color:#d8cba8;text-align:right;}body.tm-phase8-formal .tmf-sz-choices{display:flex;flex-direction:column;gap:8px;}body.tm-phase8-formal .tmf-sz-choice{width:100%;text-align:left;border:1px solid rgba(201,168,95,.30);background:linear-gradient(180deg,rgba(201,168,95,.075),rgba(0,0,0,.16));color:#eadfbd;font-family:inherit;padding:10px 12px;cursor:pointer;}body.tm-phase8-formal .tmf-sz-choice:hover{border-color:rgba(238,202,118,.58);background:rgba(201,168,95,.12);}body.tm-phase8-formal .tmf-sz-choice strong{display:block;color:#f0d98c;font-size:15px;letter-spacing:.08em;margin-bottom:4px;}body.tm-phase8-formal .tmf-sz-choice span{color:#b9aa8a;font-size:12px;line-height:1.55;}',
      'body.tm-phase8-formal .tmf-sz-actions{display:flex;flex-direction:column;gap:8px;}body.tm-phase8-formal .tmf-sz-action{width:100%;min-height:38px;border:1px solid rgba(201,168,95,.30);background:linear-gradient(180deg,rgba(31,25,19,.82),rgba(12,10,8,.82));color:#d8c27c;font-family:inherit;font-size:13px;letter-spacing:.10em;cursor:pointer;}body.tm-phase8-formal .tmf-sz-action.primary{border-color:rgba(238,202,118,.50);color:#f0d98c;background:radial-gradient(ellipse at 50% 0,rgba(238,202,118,.15),transparent 64%),linear-gradient(180deg,rgba(48,34,20,.86),rgba(15,11,8,.82));}body.tm-phase8-formal .tmf-sz-action:hover{border-color:rgba(238,202,118,.58);transform:translateY(-1px);}body.tm-phase8-formal .tmf-sz-hint{margin-top:12px;padding:10px 12px;border:1px solid rgba(126,184,167,.20);background:rgba(126,184,167,.055);color:#9f9277;font-size:12px;line-height:1.7;}body.tm-phase8-formal .tmf-sz-empty{height:100%;display:flex;align-items:center;justify-content:center;text-align:center;color:#9f9277;font-size:14px;line-height:1.8;border:1px dashed rgba(201,168,95,.25);background:rgba(0,0,0,.12);}',
      '.tmf-record-row{display:grid;grid-template-columns:46px minmax(0,1fr);column-gap:10px;}.tmf-record-row span{grid-row:1 / span 2;color:#8dbdab;font-size:12px;padding-top:2px;}.tmf-chaoyi-scene{height:220px;margin-bottom:14px;border:1px solid rgba(184,154,83,.22);overflow:hidden;background:#0f0c08;}.tmf-chaoyi-scene img{width:100%;height:100%;object-fit:cover;opacity:.68;}',
      'body.tm-phase8-formal #gs-shizheng-btn{bottom:8px!important;width:268px!important;height:64px!important;padding:0!important;border:0!important;background:url("preview/img/shizheng-command-plaque.png") center/contain no-repeat!important;box-shadow:none!important;filter:drop-shadow(0 8px 14px rgba(0,0,0,.44));font-size:0!important;z-index:59!important;}',
      'body.tm-phase8-formal #gs-shizheng-btn:before{content:"御案时政";position:absolute;left:0;right:0;top:18px;text-align:center;color:#6f4520;font:700 17px/1 "STKaiti","KaiTi","楷体",serif;letter-spacing:.27em;padding-left:.27em;text-shadow:0 1px 0 rgba(255,250,225,.75);}body.tm-phase8-formal #gs-shizheng-btn:after{content:"朝政中枢";position:absolute;left:0;right:0;top:38px;text-align:center;color:rgba(101,65,27,.72);font:12px/1 "STKaiti","KaiTi","楷体",serif;letter-spacing:.20em;padding-left:.20em;}',
      'body.tm-phase8-formal .gs-turn-float{right:0!important;bottom:0!important;z-index:60!important;display:flex!important;flex-direction:column;gap:0;align-items:flex-end;}body.tm-phase8-formal .gs-turn-summary{display:none!important;}body.tm-phase8-formal .gs-turn-fab-bar{display:none!important;}body.tm-phase8-formal .gs-turn-big{min-width:204px!important;padding:14px 26px!important;border:1.5px solid rgba(214,188,116,.62)!important;border-radius:4px!important;background:radial-gradient(ellipse at 50% 0%,rgba(212,90,68,.55),transparent 65%),radial-gradient(circle at 30% 30%,rgba(232,140,108,.32),transparent 50%),linear-gradient(180deg,rgba(168,52,40,.96),rgba(108,28,22,.98))!important;color:#fff5e0!important;font:600 18px/1.25 "STKaiti","KaiTi","楷体",serif!important;letter-spacing:.45em!important;text-align:center!important;box-shadow:0 0 0 1px rgba(140,40,30,.65),0 7px 22px rgba(140,40,30,.6),inset 0 0 6px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.12)!important;text-shadow:0 1px 2px rgba(0,0,0,.55),0 0 9px rgba(255,200,160,.32)!important;position:relative;transition:transform .18s,box-shadow .18s;}body.tm-phase8-formal .gs-turn-big:before,body.tm-phase8-formal .gs-turn-big:after{content:"";position:absolute;width:9px;height:9px;pointer-events:none;border-color:rgba(212,190,122,.85);}body.tm-phase8-formal .gs-turn-big:before{top:4px;left:4px;border-top:1.2px solid;border-left:1.2px solid;}body.tm-phase8-formal .gs-turn-big:after{bottom:4px;right:4px;border-bottom:1.2px solid;border-right:1.2px solid;}body.tm-phase8-formal .gs-turn-big .sub{display:block;font-size:11.5px;letter-spacing:.24em;margin-top:5px;font-style:italic;font-weight:400;color:rgba(255,240,220,.78);text-shadow:0 1px 1px rgba(0,0,0,.5);}body.tm-phase8-formal .gs-turn-big:hover{transform:translateY(-2px);box-shadow:0 0 0 1px rgba(212,190,122,.75),0 10px 26px rgba(140,40,30,.7),inset 0 0 6px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.18)!important;}body.tm-phase8-formal #shiji-btn{display:none!important;}',
      'body.tm-phase8-formal #gs-shizheng-btn,body.tm-phase8-formal .gs-turn-float{display:none!important;}',
      'body.tm-phase8-formal #shizheng-btn{position:fixed;bottom:0;left:50%;transform:translateX(-50%);z-index:60;cursor:pointer;padding:11px 56px 10px;min-width:180px;text-align:center;background:radial-gradient(ellipse at 50% 30%,rgba(255,250,232,.40),transparent 70%),linear-gradient(180deg,#f4e8cc 0%,#e8dbb4 55%,#d9c897 100%);border:1px solid #a8895a;border-radius:2px;box-shadow:0 3px 14px rgba(20,12,5,.50),inset 0 1px 0 rgba(255,245,220,.60),inset 0 -1px 2px rgba(120,80,40,.18),inset 0 0 0 .5px rgba(255,245,220,.20);font-family:"STKaiti","KaiTi","楷体",serif;color:#6f4520;}',
      'body.tm-phase8-formal #shizheng-btn:before,body.tm-phase8-formal #shizheng-btn:after{content:"";position:absolute;width:7px;height:7px;pointer-events:none;border-color:rgba(108,76,32,.70);}body.tm-phase8-formal #shizheng-btn:before{top:3px;left:3px;border-top:1.2px solid;border-left:1.2px solid;}body.tm-phase8-formal #shizheng-btn:after{bottom:3px;right:3px;border-bottom:1.2px solid;border-right:1.2px solid;}body.tm-phase8-formal #shizheng-btn:hover{transform:translateX(-50%) translateY(-3px);box-shadow:0 7px 20px rgba(20,12,5,.60),inset 0 1px 0 rgba(255,250,232,.70),inset 0 -1px 2px rgba(120,80,40,.15);}body.tm-phase8-formal .sz-title{display:block;font-weight:700;font-size:17px;line-height:1;letter-spacing:.27em;padding-left:.27em;text-shadow:0 1px 0 rgba(255,250,225,.75);}body.tm-phase8-formal .sz-sub{display:block;margin-top:5px;font-size:12px;line-height:1;letter-spacing:.20em;padding-left:.20em;color:rgba(101,65,27,.72);}',
      'body.tm-phase8-formal #shizheng-btn{bottom:8px!important;width:268px!important;height:64px!important;min-width:0!important;padding:0!important;border:0!important;border-radius:13px!important;background:url("preview/img/shizheng-command-plaque.png") center center / 100% 100% no-repeat!important;box-shadow:none!important;filter:drop-shadow(0 8px 14px rgba(0,0,0,.44))!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:2px!important;overflow:visible!important;}body.tm-phase8-formal #shizheng-btn:before{content:""!important;position:absolute!important;left:44px!important;right:44px!important;top:19px!important;bottom:17px!important;width:auto!important;height:auto!important;border:0!important;border-radius:14px!important;background:radial-gradient(ellipse at 50% 45%,rgba(255,248,214,.36),transparent 72%),linear-gradient(90deg,transparent,rgba(255,236,170,.13),transparent)!important;mix-blend-mode:screen!important;pointer-events:none!important;}body.tm-phase8-formal #shizheng-btn:after{content:""!important;position:absolute!important;left:30px!important;right:30px!important;bottom:-7px!important;width:auto!important;height:14px!important;border:0!important;background:radial-gradient(ellipse at 50% 50%,rgba(0,0,0,.42),rgba(0,0,0,.16) 48%,transparent 78%)!important;z-index:-1!important;pointer-events:none!important;}body.tm-phase8-formal #shizheng-btn .sz-title{position:relative!important;z-index:1!important;font-size:18px!important;line-height:1!important;letter-spacing:.28em!important;padding-left:.28em!important;color:#3a210f!important;text-shadow:0 1px 0 rgba(255,246,210,.42),0 0 4px rgba(101,52,18,.16)!important;}body.tm-phase8-formal #shizheng-btn .sz-sub{position:relative!important;z-index:1!important;margin-top:2px!important;font-size:10px!important;line-height:1!important;letter-spacing:.20em!important;padding-left:.20em!important;color:rgba(101,65,27,.72)!important;}body.tm-phase8-formal #shizheng-btn:hover{transform:translateX(-50%) translateY(-3px)!important;filter:drop-shadow(0 11px 18px rgba(0,0,0,.48)) brightness(1.025)!important;box-shadow:none!important;}body.tm-phase8-formal #shizheng-btn:active{transform:translateX(-50%) translateY(-1px)!important;filter:drop-shadow(0 6px 10px rgba(0,0,0,.46)) brightness(.985)!important;}',
      'body.tm-phase8-formal #endturn{position:fixed;bottom:0;right:0;z-index:60;display:flex;flex-direction:column;gap:0;align-items:flex-end;}body.tm-phase8-formal #endturn .et-big{min-width:204px;padding:14px 26px;border:1.5px solid rgba(214,188,116,.62);border-radius:4px;background:radial-gradient(ellipse at 50% 0%,rgba(212,90,68,.55),transparent 65%),radial-gradient(circle at 30% 30%,rgba(232,140,108,.32),transparent 50%),linear-gradient(180deg,rgba(168,52,40,.96),rgba(108,28,22,.98));color:#fff5e0;font:600 18px/1.25 "STKaiti","KaiTi","楷体",serif;letter-spacing:.45em;text-align:center;box-shadow:0 0 0 1px rgba(140,40,30,.65),0 7px 22px rgba(140,40,30,.60),inset 0 0 6px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.12);text-shadow:0 1px 2px rgba(0,0,0,.55),0 0 9px rgba(255,200,160,.32);position:relative;transition:transform .18s,box-shadow .18s;cursor:pointer;}body.tm-phase8-formal #endturn .et-big:before,body.tm-phase8-formal #endturn .et-big:after{content:"";position:absolute;width:9px;height:9px;pointer-events:none;border-color:rgba(212,190,122,.85);}body.tm-phase8-formal #endturn .et-big:before{top:4px;left:4px;border-top:1.2px solid;border-left:1.2px solid;}body.tm-phase8-formal #endturn .et-big:after{right:4px;bottom:4px;border-right:1.2px solid;border-bottom:1.2px solid;}body.tm-phase8-formal #endturn .sub{display:block;margin-top:5px;color:rgba(255,240,220,.78);font-size:11.5px;font-style:italic;font-weight:400;letter-spacing:.24em;text-shadow:0 1px 1px rgba(0,0,0,.50);}',
      'body.tm-phase8-formal #rpanel{position:fixed;right:48px;top:56px;bottom:32px;z-index:68;width:312px;flex:0 0 312px;transform:translateX(calc(100% + 110px));margin:0;pointer-events:none;overflow:hidden;background:linear-gradient(180deg,rgba(26,22,18,.98),rgba(9,8,7,.985)),radial-gradient(ellipse at 0 8%,rgba(218,184,98,.11),transparent 42%);border-left:1px solid rgba(229,196,116,.42);box-shadow:-10px 0 24px rgba(0,0,0,.34),inset 1px 0 0 rgba(255,239,196,.08);font-family:"STKaiti","KaiTi","楷体",serif;color:#eadfbd;transition:transform .18s ease;}body.tm-phase8-formal #rpanel.show{transform:translateX(0);overflow-y:auto;overflow-x:hidden;pointer-events:auto;box-shadow:-16px 0 34px rgba(0,0,0,.48),inset 1px 0 0 rgba(255,239,196,.10);}body.tm-phase8-formal #rpanel.show.tm-right-expanded{width:390px;flex-basis:390px;}body.tm-phase8-formal #rpanel.show:before{content:"";position:absolute;left:0;top:16px;bottom:16px;width:3px;background:linear-gradient(180deg,rgba(229,196,116,.76),rgba(142,44,34,.52),rgba(229,196,116,.62));box-shadow:0 0 10px rgba(229,196,116,.22);pointer-events:none;}',
      'body.tm-phase8-formal #rpanel .rp-head{min-height:48px;padding:10px 12px 9px 16px;border-bottom:1px solid rgba(184,154,83,.20);display:flex;align-items:center;justify-content:space-between;background:linear-gradient(90deg,rgba(68,46,24,.26),rgba(0,0,0,0) 72%),linear-gradient(180deg,rgba(255,239,196,.035),rgba(0,0,0,.10));}body.tm-phase8-formal #rpanel .rp-title{font-size:18px;font-weight:700;letter-spacing:.18em;color:#f2d98d;}body.tm-phase8-formal #rpanel .rp-close{width:28px;height:28px;border:1px solid rgba(214,188,116,.28);background:rgba(0,0,0,.22);color:#d8c27c;cursor:pointer;font-size:18px;line-height:1;}body.tm-phase8-formal #rpanel .rp-body{padding:14px 14px 18px;}',
      'body.tm-phase8-formal #tm-phase8-event-notice.tm-event-notice{position:fixed!important;left:22px!important;bottom:188px!important;z-index:63!important;width:354px!important;min-height:94px!important;height:252px!important;padding:8px 9px 8px 10px!important;display:grid!important;grid-template-columns:52px 1fr!important;grid-template-rows:auto minmax(0,1fr)!important;column-gap:9px!important;row-gap:6px!important;background:linear-gradient(180deg,rgba(24,20,16,.90),rgba(10,9,8,.78))!important;border-left:1px solid rgba(214,178,91,.28)!important;box-shadow:0 12px 28px rgba(0,0,0,.42),inset 0 1px 0 rgba(255,238,186,.05)!important;color:#e8d4a3!important;}body.tm-phase8-formal #tm-phase8-event-notice .tm-event-board-head{grid-column:1 / -1!important;display:block!important;min-height:0!important;padding:0!important;border:0!important;background:transparent!important;}body.tm-phase8-formal #tm-phase8-event-notice .tm-event-list{grid-column:1 / -1!important;padding:0!important;}',
      'body.tm-phase8-formal .tm-event-turn-button{height:31px;min-width:150px;display:inline-flex;align-items:center;gap:7px;padding:0 9px;border:1px solid rgba(214,178,91,.30);border-radius:2px;background:linear-gradient(180deg,rgba(31,25,19,.88),rgba(12,10,8,.84));color:#eadfbd;font-family:"STKaiti","KaiTi","楷体",serif;cursor:pointer;box-shadow:inset 0 1px 0 rgba(255,238,186,.05);}body.tm-phase8-formal .tm-event-turn-button span{font-size:13px;letter-spacing:.10em;color:#efd58d;}body.tm-phase8-formal .tm-event-turn-button i{min-width:20px;height:18px;display:inline-flex;align-items:center;justify-content:center;border:1px solid rgba(214,178,91,.30);border-radius:9px;background:rgba(11,9,7,.44);color:#9fd2c0;font-style:normal;font-size:11px;letter-spacing:0;}body.tm-phase8-formal .tm-event-turn-button b{color:#c8a85b;font-size:12px;}body.tm-phase8-formal .tm-event-turn-menu{position:absolute;left:10px;top:42px;z-index:66;width:170px;display:none;padding:5px;border:1px solid rgba(214,178,91,.28);background:linear-gradient(180deg,rgba(28,22,16,.98),rgba(8,7,6,.98));box-shadow:0 12px 24px rgba(0,0,0,.46);}body.tm-phase8-formal .tm-event-turn-menu.show{display:flex;flex-direction:column;gap:4px;}body.tm-phase8-formal .tm-event-turn-choice{display:flex;flex-direction:column;gap:3px;padding:7px 8px;border:1px solid transparent;background:transparent;color:#d8c27c;text-align:left;font-family:inherit;cursor:pointer;}body.tm-phase8-formal .tm-event-turn-choice.active,body.tm-phase8-formal .tm-event-turn-choice:hover{border-color:rgba(214,178,91,.38);background:rgba(214,178,91,.08);color:#f0d98c;}body.tm-phase8-formal .tm-event-turn-choice em{font-style:normal;font-size:11px;color:rgba(222,208,170,.58);}',
      'body.tm-phase8-formal #tm-phase8-event-notice.tm-event-notice{position:fixed!important;left:0!important;bottom:188px!important;width:366px!important;height:252px!important;min-height:0!important;padding:0!important;display:flex!important;flex-direction:column!important;gap:6px!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;backdrop-filter:none!important;overflow:visible!important;color:#e8d4a3!important;}body.tm-phase8-formal #tm-phase8-event-notice.tm-event-notice:before{display:none!important;}body.tm-phase8-formal #tm-phase8-event-notice .tm-event-board-head{position:relative!important;z-index:2!important;flex:0 0 36px!important;height:36px!important;display:flex!important;align-items:center!important;justify-content:flex-start!important;padding:0 6px!important;border:0!important;background:transparent!important;}body.tm-phase8-formal #tm-phase8-event-notice .tm-event-turn-button{position:relative!important;z-index:3!important;min-width:150px!important;height:31px!important;display:inline-flex!important;align-items:center!important;gap:8px!important;padding:0 9px!important;border:1px solid rgba(214,178,91,.34)!important;border-radius:16px 4px 16px 4px!important;background:radial-gradient(ellipse at 16% 0,rgba(238,202,118,.16),transparent 58%),linear-gradient(180deg,rgba(31,25,19,.92),rgba(12,10,8,.86))!important;box-shadow:0 6px 16px rgba(0,0,0,.24),inset 0 1px 0 rgba(255,238,186,.06)!important;color:#eadfbd!important;}body.tm-phase8-formal #tm-phase8-event-notice .tm-event-turn-button:before{content:""!important;width:6px!important;height:6px!important;border-radius:50%!important;background:#d9b15f!important;box-shadow:0 0 8px rgba(217,177,95,.58)!important;}body.tm-phase8-formal #tm-phase8-event-notice .tm-event-turn-button:hover,body.tm-phase8-formal #tm-phase8-event-notice .tm-event-turn-button[aria-expanded="true"]{border-color:rgba(238,202,118,.58)!important;background:radial-gradient(ellipse at 16% 0,rgba(238,202,118,.24),transparent 58%),linear-gradient(180deg,rgba(37,28,19,.96),rgba(12,10,8,.88))!important;}',
      'body.tm-phase8-formal #tm-phase8-event-notice .tm-event-turn-button span{font-size:13px!important;letter-spacing:.10em!important;color:#efd58d!important;}body.tm-phase8-formal #tm-phase8-event-notice .tm-event-turn-button i{min-width:23px!important;height:20px!important;border-radius:10px!important;border-color:rgba(214,178,91,.30)!important;background:rgba(11,9,7,.44)!important;color:#9fd2c0!important;font-style:normal!important;font-size:11px!important;}body.tm-phase8-formal #tm-phase8-event-notice .tm-event-turn-button b{margin-left:auto!important;color:rgba(232,207,140,.66)!important;font-size:12px!important;transform:translateY(-1px)!important;}body.tm-phase8-formal #tm-phase8-event-notice .tm-event-turn-menu{position:absolute!important;left:6px!important;top:34px!important;width:176px!important;z-index:70!important;display:none!important;padding:5px!important;border:1px solid rgba(214,178,91,.30)!important;border-radius:5px!important;background:linear-gradient(180deg,rgba(28,22,16,.98),rgba(8,7,6,.98))!important;box-shadow:0 12px 24px rgba(0,0,0,.46)!important;}body.tm-phase8-formal #tm-phase8-event-notice .tm-event-turn-menu.show{display:flex!important;flex-direction:column!important;gap:4px!important;}body.tm-phase8-formal #tm-phase8-event-notice .tm-event-turn-choice{height:28px!important;display:flex!important;flex-direction:row!important;align-items:center!important;justify-content:space-between!important;gap:8px!important;padding:0 8px!important;border:1px solid transparent!important;border-radius:3px!important;background:transparent!important;color:#d8c27c!important;text-align:left!important;font-family:inherit!important;cursor:pointer!important;}body.tm-phase8-formal #tm-phase8-event-notice .tm-event-turn-choice i{min-width:20px!important;height:18px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;border-radius:9px!important;background:rgba(0,0,0,.20)!important;color:#9fd2c0!important;font-style:normal!important;font-size:11px!important;}',
      'body.tm-phase8-formal #tm-phase8-event-notice .tm-event-list{position:relative!important;z-index:1!important;flex:1 1 auto!important;min-height:0!important;overflow-y:auto!important;overflow-x:visible!important;display:flex!important;flex-direction:column!important;gap:6px!important;padding:0 8px 0 0!important;scrollbar-width:thin!important;scrollbar-color:rgba(214,178,91,.48) rgba(0,0,0,.18)!important;}body.tm-phase8-formal #tm-phase8-event-notice .tm-event-item{position:relative!important;width:100%!important;min-height:48px!important;display:grid!important;grid-template-columns:34px minmax(0,1fr) auto!important;gap:7px!important;align-items:start!important;padding:7px 8px 7px 7px!important;border:1px solid rgba(214,178,91,.18)!important;border-left-color:rgba(210,73,52,.38)!important;border-radius:4px!important;background:linear-gradient(90deg,rgba(22,18,13,.90),rgba(22,17,12,.76) 64%,rgba(12,10,8,.40)),radial-gradient(ellipse at 0 50%,rgba(191,60,42,.18),transparent 48%)!important;color:inherit!important;cursor:pointer!important;text-align:left!important;box-shadow:0 8px 18px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,238,186,.045)!important;font-family:inherit!important;}body.tm-phase8-formal #tm-phase8-event-notice .tm-event-item:hover{border-color:rgba(238,202,118,.40)!important;transform:translateX(3px)!important;}body.tm-phase8-formal #tm-phase8-event-notice .tm-event-item.expanded{min-height:112px!important;border-color:rgba(239,200,103,.62)!important;border-left-color:rgba(213,86,60,.90)!important;}body.tm-phase8-formal #tm-phase8-event-notice .tm-event-item.is-new:after{content:"新"!important;position:absolute!important;right:5px!important;top:-5px!important;width:18px!important;height:18px!important;display:flex!important;align-items:center!important;justify-content:center!important;border:1px solid rgba(226,89,60,.56)!important;border-radius:50%!important;background:#5d2117!important;color:#f1c27b!important;font-size:10px!important;line-height:1!important;}',
      'body.tm-phase8-formal #tm-phase8-event-notice .tm-event-seal{width:32px!important;height:32px!important;display:flex!important;align-items:center!important;justify-content:center!important;border-radius:50%!important;border:1px solid rgba(230,193,103,.42)!important;background:radial-gradient(circle at 42% 28%,rgba(246,202,124,.22),transparent 42%),linear-gradient(180deg,rgba(83,33,23,.88),rgba(27,13,9,.94))!important;color:#f0d083!important;font:700 15px/1 "STKaiti","KaiTi",serif!important;}body.tm-phase8-formal #tm-phase8-event-notice .tm-event-head{display:flex!important;align-items:center!important;gap:6px!important;min-width:0!important;}body.tm-phase8-formal #tm-phase8-event-notice .tm-event-kicker{flex:0 0 auto!important;color:rgba(156,205,187,.70)!important;font:10px/1 "STSong","SimSun",serif!important;letter-spacing:.08em!important;}body.tm-phase8-formal #tm-phase8-event-notice .tm-event-title{min-width:0!important;overflow:hidden!important;text-overflow:ellipsis!important;color:#efd58d!important;font:700 13px/1.15 "STKaiti","KaiTi",serif!important;letter-spacing:.05em!important;white-space:normal!important;}body.tm-phase8-formal #tm-phase8-event-notice .tm-event-time{margin-left:auto!important;color:rgba(180,160,118,.68)!important;font:10px/1 "STSong","SimSun",serif!important;}body.tm-phase8-formal #tm-phase8-event-notice .tm-event-body{display:-webkit-box!important;-webkit-line-clamp:1!important;-webkit-box-orient:vertical!important;overflow:hidden!important;margin-top:3px!important;color:rgba(222,208,170,.66)!important;font:11px/1.25 "STSong","SimSun",serif!important;}body.tm-phase8-formal #tm-phase8-event-notice .tm-event-item.expanded .tm-event-body{display:block!important;overflow:visible!important;-webkit-line-clamp:unset!important;}body.tm-phase8-formal #tm-phase8-event-notice .tm-event-tag{align-self:flex-start!important;min-width:30px!important;padding:2px 5px!important;border:1px solid rgba(214,178,91,.24)!important;border-radius:2px!important;background:rgba(0,0,0,.16)!important;color:rgba(229,210,164,.74)!important;font:10px/1 "STSong","SimSun",serif!important;letter-spacing:.08em!important;}body.tm-phase8-formal #tm-phase8-event-notice .tm-event-detail{display:none!important;margin-top:7px!important;padding-top:7px!important;border-top:1px solid rgba(214,178,91,.12)!important;color:rgba(224,211,176,.68)!important;font:11.5px/1.45 "STSong","SimSun",serif!important;}body.tm-phase8-formal #tm-phase8-event-notice .tm-event-item.expanded .tm-event-detail{display:block!important;}',
      'body.tm-phase8-formal #tm-phase8-event-notice .tm-event-list{overscroll-behavior:contain!important;}body.tm-phase8-formal #tm-phase8-event-notice .tm-event-item.expanded{min-height:124px!important;max-height:170px!important;overflow:hidden!important;}body.tm-phase8-formal #tm-phase8-event-notice .tm-event-item.expanded .tm-event-body{display:block!important;max-height:34px!important;overflow:hidden!important;-webkit-line-clamp:unset!important;}body.tm-phase8-formal #tm-phase8-event-notice .tm-event-item.expanded .tm-event-detail{display:block!important;max-height:82px!important;overflow-y:auto!important;overflow-x:hidden!important;padding-right:5px!important;scrollbar-width:thin!important;scrollbar-color:rgba(214,178,91,.42) transparent!important;overscroll-behavior:contain!important;}body.tm-phase8-formal #tm-phase8-event-notice .tm-event-trace{gap:4px!important;margin-top:6px!important;}',
      'body.tm-phase8-formal #gs-shizheng-btn{display:none!important;}body.tm-phase8-formal #shizheng-btn{position:fixed!important;left:50%!important;bottom:10px!important;width:252px!important;height:46px!important;min-width:0!important;padding:0 24px!important;z-index:63!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:2px!important;color:#4a2a13!important;background:linear-gradient(180deg,rgba(248,233,187,.96),rgba(222,197,134,.95) 58%,rgba(169,126,61,.96)),radial-gradient(ellipse at 50% 0,rgba(255,251,221,.55),transparent 66%)!important;border:1px solid rgba(164,123,57,.78)!important;border-radius:3px 3px 0 0!important;cursor:pointer!important;user-select:none!important;white-space:nowrap!important;text-align:center!important;transform:translateX(-50%)!important;filter:none!important;box-shadow:inset 0 1px 0 rgba(255,250,225,.75),inset 0 -1px 0 rgba(96,61,22,.24),0 5px 12px rgba(0,0,0,.38)!important;transition:transform .18s ease,box-shadow .18s ease!important;overflow:visible!important;}body.tm-phase8-formal #shizheng-btn:before{content:""!important;position:absolute!important;inset:5px 9px 6px!important;border:1px solid rgba(111,75,31,.36)!important;border-left:0!important;border-right:0!important;border-radius:1px!important;background:linear-gradient(90deg,transparent,rgba(255,246,205,.20),transparent)!important;mix-blend-mode:normal!important;pointer-events:none!important;}body.tm-phase8-formal #shizheng-btn:after{content:""!important;position:absolute!important;left:22px!important;right:22px!important;bottom:-8px!important;height:12px!important;border:0!important;background:radial-gradient(ellipse at 50% 50%,rgba(0,0,0,.36),rgba(0,0,0,.14) 48%,transparent 78%)!important;z-index:-1!important;pointer-events:none!important;}body.tm-phase8-formal #shizheng-btn .sz-title{position:relative!important;z-index:1!important;font-size:17px!important;line-height:1!important;font-weight:700!important;letter-spacing:.26em!important;padding-left:.26em!important;color:#3f2410!important;text-shadow:0 1px 0 rgba(255,246,210,.45)!important;}body.tm-phase8-formal #shizheng-btn .sz-sub{position:relative!important;z-index:1!important;margin-top:1px!important;font-size:10px!important;line-height:1!important;letter-spacing:.20em!important;padding-left:.20em!important;color:rgba(100,66,29,.72)!important;}body.tm-phase8-formal #shizheng-btn:hover{transform:translateX(-50%) translateY(-2px)!important;filter:none!important;box-shadow:inset 0 1px 0 rgba(255,250,225,.82),inset 0 -1px 0 rgba(96,61,22,.22),0 8px 16px rgba(0,0,0,.42)!important;}body.tm-phase8-formal #shizheng-btn:active{transform:translateX(-50%)!important;filter:none!important;}',
      'body.tm-phase8-formal #shizheng-btn{bottom:8px!important;width:268px!important;height:64px!important;padding:0!important;border:0!important;border-radius:13px!important;background:url("preview/img/shizheng-command-plaque.png") center center / 100% 100% no-repeat!important;box-shadow:none!important;filter:drop-shadow(0 8px 14px rgba(0,0,0,.44))!important;}body.tm-phase8-formal #shizheng-btn:before{left:44px!important;right:44px!important;top:19px!important;bottom:17px!important;width:auto!important;height:auto!important;border:0!important;border-radius:14px!important;background:radial-gradient(ellipse at 50% 45%,rgba(255,248,214,.36),transparent 72%),linear-gradient(90deg,transparent,rgba(255,236,170,.13),transparent)!important;mix-blend-mode:screen!important;}body.tm-phase8-formal #shizheng-btn:after{left:30px!important;right:30px!important;bottom:-7px!important;width:auto!important;height:14px!important;border:0!important;background:radial-gradient(ellipse at 50% 50%,rgba(0,0,0,.42),rgba(0,0,0,.16) 48%,transparent 78%)!important;}body.tm-phase8-formal #shizheng-btn .sz-title{font-size:18px!important;letter-spacing:.28em!important;padding-left:.28em!important;color:#3a210f!important;text-shadow:0 1px 0 rgba(255,246,210,.42),0 0 4px rgba(101,52,18,.16)!important;}body.tm-phase8-formal #shizheng-btn .sz-sub{margin-top:2px!important;font-size:10px!important;color:rgba(101,65,27,.72)!important;}body.tm-phase8-formal #shizheng-btn:hover{transform:translateX(-50%) translateY(-3px)!important;filter:drop-shadow(0 11px 18px rgba(0,0,0,.48)) brightness(1.025)!important;box-shadow:none!important;}body.tm-phase8-formal #shizheng-btn:active{transform:translateX(-50%) translateY(-1px)!important;filter:drop-shadow(0 6px 10px rgba(0,0,0,.46)) brightness(.985)!important;}',
      'body.tm-phase8-formal #tm-phase8-action-tray.zb-action-tray{position:fixed!important;left:18px!important;bottom:24px!important;width:356px!important;height:150px!important;z-index:62!important;display:block!important;pointer-events:none!important;transform:translateZ(0)!important;transition:opacity .18s ease,transform .18s ease!important;}body.tm-phase8-formal #tm-phase8-action-tray.zb-action-tray:before{content:""!important;position:absolute!important;left:-20px!important;right:-22px!important;bottom:-18px!important;height:62px!important;background:radial-gradient(ellipse at 42% 72%,rgba(0,0,0,.50),rgba(0,0,0,.22) 48%,transparent 74%)!important;pointer-events:none!important;z-index:-1!important;}body.tm-phase8-formal #tm-phase8-action-tray .zb-btn.zb-img-btn{appearance:none!important;position:absolute!important;left:auto!important;right:auto!important;top:auto!important;bottom:auto!important;width:168px!important;height:70px!important;min-width:0!important;margin:0!important;padding:0!important;overflow:hidden!important;border:1px solid rgba(206,169,87,.38)!important;border-radius:6px!important;background:#120e0a!important;color:#f6e7bb!important;cursor:pointer!important;pointer-events:auto!important;isolation:isolate!important;text-align:left!important;letter-spacing:0!important;box-shadow:0 8px 17px rgba(0,0,0,.46),0 2px 4px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,244,202,.12),inset 0 -1px 0 rgba(0,0,0,.55)!important;filter:drop-shadow(0 8px 12px rgba(0,0,0,.34))!important;transform:translateY(0) rotate(var(--action-tilt,0deg))!important;transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease,filter .18s ease!important;}body.tm-phase8-formal #tm-phase8-action-tray .zb-img{width:100%!important;height:100%!important;object-fit:cover!important;display:block!important;pointer-events:none!important;opacity:.96!important;filter:saturate(.95) contrast(1.05) brightness(.96)!important;transform:scale(1.012)!important;transition:transform .24s ease,filter .24s ease,opacity .24s ease!important;}body.tm-phase8-formal #tm-phase8-action-tray .zb-img-btn:before{content:""!important;position:absolute!important;inset:0!important;z-index:1!important;background:linear-gradient(90deg,rgba(8,6,5,.72) 0%,rgba(8,6,5,.42) 36%,rgba(8,6,5,.10) 68%,rgba(8,6,5,.30) 100%),radial-gradient(ellipse at 18% 50%,rgba(223,174,82,.16),transparent 54%)!important;pointer-events:none!important;opacity:.92!important;transition:opacity .18s ease,background .18s ease!important;}body.tm-phase8-formal #tm-phase8-action-tray #zhao-btn:before{background:linear-gradient(90deg,rgba(8,6,5,.18) 0%,rgba(8,6,5,.16) 34%,rgba(8,6,5,.45) 60%,rgba(8,6,5,.76) 100%),radial-gradient(ellipse at 76% 50%,rgba(223,174,82,.17),transparent 56%)!important;}body.tm-phase8-formal #tm-phase8-action-tray .zb-img-btn:after{content:""!important;position:absolute!important;inset:1px!important;z-index:3!important;border-radius:5px!important;pointer-events:none!important;box-shadow:inset 0 0 0 1px rgba(244,215,136,.18),inset 0 0 16px rgba(0,0,0,.28)!important;background:linear-gradient(180deg,rgba(255,238,185,.08),transparent 42%),linear-gradient(90deg,rgba(201,160,69,.18),transparent 18%,transparent 82%,rgba(201,160,69,.12))!important;}body.tm-phase8-formal #tm-phase8-action-tray .zb-action-copy{position:absolute!important;z-index:2!important;left:13px!important;top:50%!important;width:92px!important;transform:translateY(-50%)!important;display:flex!important;flex-direction:column!important;align-items:flex-start!important;gap:2px!important;font-family:"STKaiti","KaiTi","楷体",serif!important;letter-spacing:0!important;pointer-events:none!important;text-align:left!important;text-shadow:0 1px 1px rgba(0,0,0,.86),0 0 8px rgba(0,0,0,.62)!important;}body.tm-phase8-formal #tm-phase8-action-tray #zhao-btn .zb-action-copy{left:auto!important;right:12px!important;align-items:flex-end!important;text-align:right!important;}body.tm-phase8-formal #tm-phase8-action-tray .zb-action-kicker{font-size:9px!important;line-height:1!important;color:rgba(213,181,105,.72)!important;letter-spacing:0!important;margin-bottom:1px!important;}body.tm-phase8-formal #tm-phase8-action-tray .zb-action-title{font:700 17px/1.05 "STKaiti","KaiTi","楷体",serif!important;color:#f7e5ad!important;letter-spacing:.04em!important;white-space:nowrap!important;}body.tm-phase8-formal #tm-phase8-action-tray .zb-action-sub{margin-top:2px!important;color:rgba(232,209,150,.72)!important;font:11px/1 "STSong","SimSun",serif!important;letter-spacing:.08em!important;white-space:nowrap!important;}body.tm-phase8-formal #tm-phase8-action-tray .zb-img-btn:hover{border-color:rgba(238,203,118,.72)!important;box-shadow:0 12px 24px rgba(0,0,0,.52),0 0 0 1px rgba(230,190,101,.15),inset 0 1px 0 rgba(255,244,202,.16),inset 0 -1px 0 rgba(0,0,0,.48)!important;filter:drop-shadow(0 10px 16px rgba(0,0,0,.40)) brightness(1.04)!important;transform:translateY(-4px) rotate(var(--action-tilt,0deg))!important;}body.tm-phase8-formal #tm-phase8-action-tray .zb-img-btn:hover .zb-img{opacity:1!important;filter:saturate(1.02) contrast(1.08) brightness(1.02)!important;transform:scale(1.045)!important;}body.tm-phase8-formal #tm-phase8-action-tray .zb-img-btn:hover:before{opacity:.72!important;}body.tm-phase8-formal #tm-phase8-action-tray .zb-img-btn:active{transform:translateY(-1px) rotate(var(--action-tilt,0deg))!important;filter:drop-shadow(0 5px 9px rgba(0,0,0,.44)) brightness(.98)!important;}body.tm-phase8-formal #tm-phase8-action-tray #zhao-btn{left:0!important;top:2px!important;--action-tilt:-1.9deg;}body.tm-phase8-formal #tm-phase8-action-tray #zhao-btn-2{left:178px!important;top:5px!important;--action-tilt:.9deg;}body.tm-phase8-formal #tm-phase8-action-tray #zhao-btn-3{left:8px!important;top:78px!important;--action-tilt:-.7deg;}body.tm-phase8-formal #tm-phase8-action-tray #zhao-btn-4{left:185px!important;top:75px!important;--action-tilt:1.6deg;}body.tm-phase8-formal.province-panel-open #tm-phase8-action-tray,body.tm-phase8-formal #mapwrap.panel-open~#tm-phase8-action-tray{opacity:0!important;pointer-events:none!important;transform:translateY(18px) scale(.96)!important;}',
      '@media(max-width:1280px){body.tm-phase8-formal #tm-phase8-action-tray.zb-action-tray{left:12px!important;bottom:20px!important;width:326px!important;height:136px!important;transform:translateZ(0)!important;}body.tm-phase8-formal #tm-phase8-action-tray .zb-btn.zb-img-btn{width:154px!important;height:64px!important;}body.tm-phase8-formal #tm-phase8-action-tray .zb-action-title{font-size:16px!important;}body.tm-phase8-formal #tm-phase8-action-tray .zb-action-sub{font-size:10.5px!important;}body.tm-phase8-formal #tm-phase8-action-tray #zhao-btn{left:0!important;top:1px!important;}body.tm-phase8-formal #tm-phase8-action-tray #zhao-btn-2{left:162px!important;top:4px!important;}body.tm-phase8-formal #tm-phase8-action-tray #zhao-btn-3{left:7px!important;top:71px!important;}body.tm-phase8-formal #tm-phase8-action-tray #zhao-btn-4{left:168px!important;top:69px!important;}}',
      '@media(max-width:1080px){body.tm-phase8-formal #tm-phase8-action-tray.zb-action-tray{width:292px!important;height:123px!important;}body.tm-phase8-formal #tm-phase8-action-tray .zb-btn.zb-img-btn{width:138px!important;height:58px!important;}body.tm-phase8-formal #tm-phase8-action-tray .zb-action-copy{left:10px!important;width:78px!important;}body.tm-phase8-formal #tm-phase8-action-tray #zhao-btn .zb-action-copy{right:10px!important;}body.tm-phase8-formal #tm-phase8-action-tray .zb-action-title{font-size:14px!important;}body.tm-phase8-formal #tm-phase8-action-tray .zb-action-sub{font-size:10px!important;}body.tm-phase8-formal #tm-phase8-action-tray .zb-action-kicker{display:none!important;}body.tm-phase8-formal #tm-phase8-action-tray #zhao-btn{left:0!important;top:1px!important;}body.tm-phase8-formal #tm-phase8-action-tray #zhao-btn-2{left:145px!important;top:3px!important;}body.tm-phase8-formal #tm-phase8-action-tray #zhao-btn-3{left:6px!important;top:65px!important;}body.tm-phase8-formal #tm-phase8-action-tray #zhao-btn-4{left:150px!important;top:63px!important;}}',
      'body.tm-phase8-formal .zb-action-badge{position:absolute!important;z-index:4!important;right:8px!important;top:7px!important;min-width:18px!important;height:18px!important;padding:0 5px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;border:1px solid rgba(238,202,118,.66)!important;border-radius:999px!important;background:linear-gradient(180deg,rgba(92,34,24,.96),rgba(36,18,12,.94))!important;color:#ffe2a8!important;font:700 11px/1 "STSong","SimSun",serif!important;letter-spacing:0!important;box-shadow:0 3px 8px rgba(0,0,0,.38),inset 0 1px 0 rgba(255,238,186,.14)!important;}body.tm-phase8-formal #zhao-btn .zb-action-badge{left:8px!important;right:auto!important;}',
      '@media(max-width:1280px){.tmf-map-paper{left:4.2%;right:5.8%;}.tmf-map-dossier{width:min(760px,72vw);}.tmf-map-legend{width:238px;}.tmf-dossier-rows{grid-template-columns:repeat(2,minmax(0,1fr));}body.tm-phase8-formal .bar-var{min-width:68px;padding-left:7px;padding-right:7px;}#tm-phase8-action-tray{transform:scale(.88);transform-origin:left bottom;}}',
      '@media(max-width:980px){#tm-phase8-left-surface{display:none;}#tm-phase8-action-tray{display:none;}.tmf-map-alerts{display:none;}.tmf-map-legend{display:none;}body.tm-phase8-formal .bar-weather{display:none;}body.tm-phase8-formal .bar-vars{overflow-x:auto;}body.tm-phase8-formal .bar-time{min-width:150px;}.tmf-map-dossier{left:12px;right:66px;width:auto;}.tmf-dossier-rows{grid-template-columns:1fr;}}',
      // ============================================
      // v3.3 邸抄 event feed·442×240·非文字透明~6%·按 turn 分组·filter/density/collapse
      // ============================================
      'body.tm-phase8-formal #tm-phase8-event-notice.tmv3-feed{position:absolute!important;left:0!important;bottom:188px!important;width:442px!important;height:240px!important;z-index:62!important;padding:0!important;display:flex!important;flex-direction:column!important;background:linear-gradient(90deg,rgba(165,52,38,.04),transparent 18%)!important;border:0!important;border-left:2px solid rgba(165,52,38,.22)!important;border-radius:0!important;box-shadow:none!important;font-family:"STKaiti","KaiTi","楷体",serif!important;color:#e8d4a3!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;overflow:visible!important;pointer-events:auto!important;}',
      'body.tm-phase8-formal #tm-phase8-event-notice.tmv3-feed:before{content:""!important;position:absolute!important;left:0!important;right:0!important;top:0!important;height:1px!important;background:linear-gradient(90deg,rgba(218,179,93,.26),rgba(218,179,93,.10) 50%,transparent)!important;pointer-events:none!important;}',
      'body.tm-phase8-formal #tm-phase8-event-notice.tmv3-feed:after{content:""!important;position:absolute!important;left:0!important;right:0!important;bottom:0!important;height:1px!important;background:linear-gradient(90deg,rgba(218,179,93,.22),rgba(218,179,93,.08) 50%,transparent)!important;pointer-events:none!important;}',
      // head·title + count + filter + density + collapse
      'body.tm-phase8-formal .tmv3-feed .tmv3-head{flex:0 0 32px;display:flex;align-items:center;gap:8px;padding:7px 10px 5px 10px;background:transparent;position:relative;}',
      'body.tm-phase8-formal .tmv3-feed .tmv3-tt{display:inline-flex;align-items:baseline;gap:6px;color:#efd58f;font:700 14px/1 "STKaiti","KaiTi",serif;letter-spacing:.28em;text-shadow:0 1px 1px rgba(0,0,0,.6);}',
      'body.tm-phase8-formal .tmv3-feed .tmv3-tt:before{content:"";display:inline-block;width:5px;height:5px;border-radius:50%;background:#c84a30;box-shadow:0 0 5px rgba(212,52,40,.55);margin-right:3px;align-self:center;}',
      'body.tm-phase8-formal .tmv3-feed .tmv3-cnt{color:rgba(214,196,148,.66);font:12px/1 "STSong","SimSun",serif;letter-spacing:.04em;}',
      'body.tm-phase8-formal .tmv3-feed .tmv3-cnt b{color:rgba(232,213,160,.92);font-weight:700;font-size:12px;}',
      'body.tm-phase8-formal .tmv3-feed .tmv3-acts{margin-left:auto;display:inline-flex;gap:6px;align-items:center;}',
      'body.tm-phase8-formal .tmv3-feed .tmv3-filters{display:inline-flex;gap:3px;}',
      'body.tm-phase8-formal .tmv3-feed .tmv3-fchip{display:inline-flex;align-items:center;justify-content:center;min-width:17px;height:18px;padding:0 5px;border-radius:9px;background:transparent;border:1px solid rgba(218,179,93,.22);color:rgba(214,196,148,.62);font:12px/1 "STSong","SimSun",serif;letter-spacing:0;cursor:pointer;transition:all .14s;}',
      'body.tm-phase8-formal .tmv3-feed .tmv3-fchip:hover{border-color:rgba(218,179,93,.46);color:rgba(232,213,160,.82);}',
      'body.tm-phase8-formal .tmv3-feed .tmv3-fchip.on{background:rgba(218,179,93,.16);border-color:rgba(218,179,93,.62);color:#f0d98c;}',
      'body.tm-phase8-formal .tmv3-feed .tmv3-density{display:inline-flex;gap:1px;padding:1px;border:1px solid rgba(218,179,93,.22);border-radius:10px;}',
      'body.tm-phase8-formal .tmv3-feed .tmv3-dbtn{min-width:19px;height:16px;padding:0 4px;border:0;background:transparent;color:rgba(214,196,148,.56);font:11.5px/1 "STSong",serif;cursor:pointer;border-radius:7px;}',
      'body.tm-phase8-formal .tmv3-feed .tmv3-dbtn.on{background:rgba(218,179,93,.22);color:#f0d98c;}',
      'body.tm-phase8-formal .tmv3-feed .tmv3-collapse{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;padding:0;margin-left:2px;border:1px solid rgba(218,179,93,.20);border-radius:9px;background:transparent;color:rgba(214,196,148,.62);cursor:pointer;transition:all .14s;}',
      'body.tm-phase8-formal .tmv3-feed .tmv3-collapse:hover{border-color:rgba(218,179,93,.48);color:#f0d98c;}',
      'body.tm-phase8-formal .tmv3-feed .tmv3-collapse-icon{font:12px/1 "STSong",serif;}',
      'body.tm-phase8-formal .tmv3-feed .tmv3-collapse-icon:before{content:"‹";}',
      'body.tm-phase8-formal .tmv3-feed.collapsed .tmv3-collapse-icon:before{content:"›";}',
      // 整栏 collapsed·缩到 28px 窄条
      'body.tm-phase8-formal #tm-phase8-event-notice.tmv3-feed.collapsed{width:28px!important;}',
      'body.tm-phase8-formal .tmv3-feed.collapsed .tmv3-head{flex-direction:column;padding:5px 0 0 0;gap:6px;align-items:center;}',
      'body.tm-phase8-formal .tmv3-feed.collapsed .tmv3-tt{writing-mode:vertical-rl;text-orientation:upright;font-size:12px;letter-spacing:.24em;color:rgba(232,213,160,.74);margin-top:4px;}',
      'body.tm-phase8-formal .tmv3-feed.collapsed .tmv3-tt:before{margin:0 0 4px 0;width:4px;height:4px;}',
      'body.tm-phase8-formal .tmv3-feed.collapsed .tmv3-cnt,body.tm-phase8-formal .tmv3-feed.collapsed .tmv3-filters,body.tm-phase8-formal .tmv3-feed.collapsed .tmv3-density{display:none!important;}',
      'body.tm-phase8-formal .tmv3-feed.collapsed .tmv3-acts{margin:0;display:block;}',
      'body.tm-phase8-formal .tmv3-feed.collapsed .tmv3-list{display:none!important;}',
      // list·scroll·稀薄 scrollbar
      'body.tm-phase8-formal .tmv3-feed .tmv3-list{flex:1 1 auto;overflow-y:auto;padding:0 4px 8px 4px;display:block;scrollbar-width:thin;scrollbar-color:rgba(218,179,93,.32) transparent;contain:content;}',
      'body.tm-phase8-formal .tmv3-feed .tmv3-list::-webkit-scrollbar{width:3px;}',
      'body.tm-phase8-formal .tmv3-feed .tmv3-list::-webkit-scrollbar-thumb{background:rgba(218,179,93,.36);}',
      'body.tm-phase8-formal .tmv3-feed .tmv3-list::-webkit-scrollbar-track{background:transparent;}',
      // turn header·sticky
      'body.tm-phase8-formal .tmv3-feed .tmv3-turnhead{position:sticky;top:0;z-index:2;display:flex;align-items:center;gap:6px;padding:5px 7px 3px 7px;background:linear-gradient(180deg,rgba(28,18,12,.88) 0%,rgba(28,18,12,.5) 70%,transparent 100%);}',
      'body.tm-phase8-formal .tmv3-feed .tmv3-turnhead b{color:rgba(232,213,160,.92);font:700 12px/1 "STSong","SimSun",serif;letter-spacing:.08em;}',
      'body.tm-phase8-formal .tmv3-feed .tmv3-turnhead small{color:rgba(214,196,148,.56);font:11.5px/1 "STSong",serif;letter-spacing:.12em;}',
      'body.tm-phase8-formal .tmv3-feed .tmv3-turnhead:after{content:"";flex:1;height:1px;background:linear-gradient(90deg,rgba(218,179,93,.32),rgba(218,179,93,.06) 64%,transparent);}',
      // item·collapsed default·22px 高·只 title 显
      'body.tm-phase8-formal .tmv3-feed .tmv3-item{position:relative;display:grid;grid-template-columns:16px minmax(0,1fr) 14px;gap:6px;align-items:center;padding:2px 6px 2px 7px;min-height:22px;cursor:pointer;color:inherit;border-left:2px solid var(--ttype-c,rgba(168,154,122,.22));transition:background .14s;}',
      'body.tm-phase8-formal .tmv3-feed .tmv3-item:hover{background:linear-gradient(90deg,rgba(218,179,93,.04),transparent 56%);}',
      // 8 type colors
      'body.tm-phase8-formal .tmv3-feed .tmv3-item.t-chao{--ttype-c:rgba(244,180,148,.86);}',
      'body.tm-phase8-formal .tmv3-feed .tmv3-item.t-army{--ttype-c:rgba(168,200,232,.86);}',
      'body.tm-phase8-formal .tmv3-feed .tmv3-item.t-faction{--ttype-c:rgba(184,196,220,.82);}',
      'body.tm-phase8-formal .tmv3-feed .tmv3-item.t-finance{--ttype-c:rgba(168,210,184,.86);}',
      'body.tm-phase8-formal .tmv3-feed .tmv3-item.t-people{--ttype-c:rgba(208,176,210,.84);}',
      'body.tm-phase8-formal .tmv3-feed .tmv3-item.t-news{--ttype-c:rgba(232,206,140,.86);}',
      'body.tm-phase8-formal .tmv3-feed .tmv3-item.t-clue{--ttype-c:rgba(220,168,156,.84);}',
      'body.tm-phase8-formal .tmv3-feed .tmv3-item.t-misc{--ttype-c:rgba(208,194,168,.68);}',
      // ttype 字头
      'body.tm-phase8-formal .tmv3-feed .tmv3-ttype{display:inline-flex;align-items:center;justify-content:center;font:700 12px/1 "STKaiti","KaiTi","STSong",serif;color:var(--ttype-c,rgba(214,196,148,.62));white-space:nowrap;letter-spacing:0;}',
      // main·flex column for stacking exp-head/sec/foot
      'body.tm-phase8-formal .tmv3-feed .tmv3-item .tmv3-main{min-width:0;display:flex;flex-direction:column;}',
      'body.tm-phase8-formal .tmv3-feed .tmv3-item .tmv3-headrow{display:contents;}',
      'body.tm-phase8-formal .tmv3-feed .tmv3-item .tmv3-title{display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:rgba(232,213,160,.94);font:14px/1.25 "STKaiti","KaiTi",serif;letter-spacing:.04em;}',
      // collapsed·hide all but title
      'body.tm-phase8-formal .tmv3-feed .tmv3-item .tmv3-turn,body.tm-phase8-formal .tmv3-feed .tmv3-item .tmv3-text,body.tm-phase8-formal .tmv3-feed .tmv3-item .tmv3-foot{display:none;}',
      // mark dot·6px·default transparent
      'body.tm-phase8-formal .tmv3-feed .tmv3-item .tmv3-mark{width:7px;height:7px;border-radius:50%;background:transparent;align-self:center;}',
      'body.tm-phase8-formal .tmv3-feed .tmv3-item.is-alert .tmv3-mark{background:radial-gradient(circle at 30% 28%,#ff9070,#a82010);box-shadow:0 0 5px rgba(232,80,52,.62);animation:tmv3-pulse 1.4s ease-in-out infinite;}',
      'body.tm-phase8-formal .tmv3-feed .tmv3-item.is-hot .tmv3-mark{background:radial-gradient(circle at 30% 28%,#ffb494,#c8281a);}',
      'body.tm-phase8-formal .tmv3-feed .tmv3-item.is-new .tmv3-mark{background:radial-gradient(circle at 30% 28%,#ffe5a8,#c89432);box-shadow:0 0 4px rgba(232,184,106,.52);}',
      '@keyframes tmv3-pulse{0%,100%{box-shadow:0 0 4px rgba(232,80,52,.42);}50%{box-shadow:0 0 9px rgba(232,80,52,.82);}}',
      // state·title color tweaks
      'body.tm-phase8-formal .tmv3-feed .tmv3-item.is-hot .tmv3-title{color:rgba(244,200,168,.98);}',
      'body.tm-phase8-formal .tmv3-feed .tmv3-item.is-new .tmv3-title{color:rgba(248,228,168,1);}',
      'body.tm-phase8-formal .tmv3-feed .tmv3-item.is-read .tmv3-title{color:rgba(212,196,156,.46);}',
      'body.tm-phase8-formal .tmv3-feed .tmv3-item.is-read .tmv3-ttype{opacity:.56;}',
      // new·top-flash line
      'body.tm-phase8-formal .tmv3-feed .tmv3-item.is-new:before{content:"";position:absolute;left:7px;right:7px;top:0;height:1px;background:linear-gradient(90deg,transparent,rgba(255,238,180,.72),transparent);opacity:.28;}',
      'body.tm-phase8-formal .tmv3-feed .tmv3-item.is-flash:before{animation:tmv3-flash 2.4s ease-in-out 3;}',
      '@keyframes tmv3-flash{0%,100%{opacity:.28;}50%{opacity:.92;}}',
      // EXPANDED·flex row layout·ttype + main 两列·main 自然增高
      'body.tm-phase8-formal .tmv3-feed .tmv3-item.expanded{display:flex!important;flex-direction:row;align-items:flex-start;gap:8px;padding:8px 10px 9px 10px;margin:4px 0;background:rgba(218,179,93,.03);border-left-width:3px;border-top:1px solid rgba(218,179,93,.14);border-right:1px solid rgba(218,179,93,.14);border-bottom:1px solid rgba(218,179,93,.14);border-radius:2px;cursor:default;box-shadow:0 2px 6px rgba(0,0,0,.18);}',
      'body.tm-phase8-formal .tmv3-feed .tmv3-item.expanded .tmv3-ttype{flex:0 0 auto;font-size:13px;padding-top:2px;color:var(--ttype-c,rgba(214,196,148,.78));}',
      'body.tm-phase8-formal .tmv3-feed .tmv3-item.expanded .tmv3-main{flex:1 1 auto;display:flex!important;flex-direction:column;}',
      'body.tm-phase8-formal .tmv3-feed .tmv3-item.expanded .tmv3-mark{display:none!important;}',
      // expanded·headrow flex·title left·turn pill right
      'body.tm-phase8-formal .tmv3-feed .tmv3-item.expanded .tmv3-headrow{display:flex!important;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:6px;padding-bottom:5px;border-bottom:1px solid rgba(218,179,93,.12);}',
      'body.tm-phase8-formal .tmv3-feed .tmv3-item.expanded .tmv3-title{flex:1 1 auto;white-space:normal;color:#f4d98a;font:700 14px/1.45 "STKaiti","KaiTi",serif;letter-spacing:.04em;}',
      'body.tm-phase8-formal .tmv3-feed .tmv3-item.expanded .tmv3-turn{display:inline-flex!important;align-items:center;flex:0 0 auto;padding:1px 6px;border:1px solid rgba(218,179,93,.16);border-radius:8px;background:transparent;color:rgba(214,196,148,.68);font:11px/1.4 "STSong",serif;letter-spacing:.1em;}',
      // expanded·text 段·display:block (no chip label)
      'body.tm-phase8-formal .tmv3-feed .tmv3-item.expanded .tmv3-text{display:block!important;color:rgba(218,202,166,.86);font:12.5px/1.6 "STSong","SimSun",serif;letter-spacing:.02em;margin:5px 0 0 0;}',
      'body.tm-phase8-formal .tmv3-feed .tmv3-item.expanded .tmv3-text.tmv3-text-detail{color:rgba(214,202,168,.72);font-size:12px;margin-top:4px;}',
      // expanded·foot·flex·meta + open btn
      'body.tm-phase8-formal .tmv3-feed .tmv3-item.expanded .tmv3-foot{display:flex!important;align-items:center;justify-content:space-between;gap:10px;margin-top:6px;padding-top:6px;border-top:1px dotted rgba(218,179,93,.14);}',
      'body.tm-phase8-formal .tmv3-feed .tmv3-item.expanded .tmv3-meta{display:flex!important;flex-wrap:wrap;gap:5px;flex:1 1 auto;min-width:0;}',
      'body.tm-phase8-formal .tmv3-feed .tmv3-item.expanded .tmv3-meta span{padding:1px 7px;border-radius:9px;border:1px solid rgba(218,179,93,.16);background:transparent;color:rgba(218,200,160,.74);font:11.5px/1.25 "STSong","SimSun",serif;letter-spacing:.04em;}',
      'body.tm-phase8-formal .tmv3-feed .tmv3-item.expanded .tmv3-open{display:inline-flex;align-items:center;gap:4px;color:var(--ttype-c,#efd58f);font:700 12px/1 "STKaiti","KaiTi",serif;letter-spacing:.14em;padding:4px 10px;border:1px solid var(--ttype-c,rgba(218,179,93,.42));border-radius:10px;background:transparent;cursor:pointer;text-decoration:none;flex:0 0 auto;white-space:nowrap;transition:all .14s;}',
      'body.tm-phase8-formal .tmv3-feed .tmv3-item.expanded .tmv3-open:hover{background:rgba(218,179,93,.06);}',
      'body.tm-phase8-formal .tmv3-feed .tmv3-item.expanded .tmv3-open em{font-style:normal;font-size:12px;opacity:.92;}',
      // density·comfortable mode
      'body.tm-phase8-formal .tmv3-feed.density-comfortable .tmv3-item{min-height:28px;padding:4px 7px 4px 8px;}',
      'body.tm-phase8-formal .tmv3-feed.density-comfortable .tmv3-item .tmv3-title{font-size:15.5px;}',
      'body.tm-phase8-formal .tmv3-feed.density-comfortable .tmv3-item .tmv3-ttype{font-size:13px;}',
      'body.tm-phase8-formal .tmv3-feed.density-comfortable .tmv3-turnhead{padding-top:8px;padding-bottom:5px;}',
      'body.tm-phase8-formal .tmv3-feed.density-comfortable .tmv3-turnhead b{font-size:13px;}',
      // empty
      'body.tm-phase8-formal .tmv3-feed .tmv3-empty{margin:auto;padding:18px 12px;text-align:center;color:rgba(202,186,145,.42);font:12px/1.6 "STSong","SimSun",serif;letter-spacing:.14em;}'
    ].join('\n');
    document.head.appendChild(st);
  }

  function installTopbarExactStyles(){
    var st = document.getElementById('tm-phase8-formal-topbar-exact-style');
    if (!st) {
      st = document.createElement('style');
      st.id = 'tm-phase8-formal-topbar-exact-style';
      document.head.appendChild(st);
    }
    var __css = [
      'body.tm-phase8-formal #bar{display:none!important;}',
      'body.tm-phase8-formal #topbar{position:fixed!important;left:0!important;right:0!important;top:0!important;z-index:1000!important;height:88px!important;display:flex!important;align-items:flex-start!important;gap:9px!important;padding:8px 12px 0!important;box-sizing:border-box!important;background:transparent!important;border:0!important;box-shadow:none!important;backdrop-filter:none!important;pointer-events:none!important;font-family:"STKaiti","KaiTi","楷体",serif!important;color:#eadfbd!important;}',
      'body.tm-phase8-formal #banner{position:fixed!important;top:76px!important;left:50%!important;transform:translateX(-50%)!important;z-index:998!important;min-width:260px!important;height:26px!important;padding:0 28px!important;display:flex!important;align-items:center!important;justify-content:center!important;border:0!important;background:url("preview/img/topbar-center-edict-plaque-v1.png") center/100% 100% no-repeat!important;color:#6f4520!important;text-shadow:0 1px 0 rgba(255,247,218,.72)!important;font:700 12px/1 "STKaiti","KaiTi","楷体",serif!important;letter-spacing:.18em!important;box-shadow:none!important;cursor:pointer!important;}',
      'body.tm-phase8-formal .tmf-topbar-pop{position:fixed!important;z-index:19000!important;display:block!important;opacity:0!important;pointer-events:none!important;transform:translateY(-6px)!important;transition:opacity .15s,transform .15s!important;padding:12px 15px!important;min-width:230px!important;max-width:320px!important;background:linear-gradient(180deg,rgba(36,30,24,.98),rgba(15,13,11,.98))!important;border:1px solid rgba(201,160,69,.58)!important;border-radius:5px!important;box-shadow:0 10px 26px rgba(0,0,0,.56),inset 0 1px 0 rgba(255,238,186,.06)!important;color:#d8cba8!important;font:12.5px/1.7 "STKaiti","KaiTi","楷体",serif!important;letter-spacing:.04em!important;}body.tm-phase8-formal .tmf-topbar-pop.show{opacity:1!important;pointer-events:auto!important;transform:translateY(0)!important;}body.tm-phase8-formal .tmf-topbar-pop.pinned{border-color:#d4be7a!important;box-shadow:0 10px 26px rgba(0,0,0,.56),0 0 0 1px rgba(201,160,69,.28)!important;}body.tm-phase8-formal .tmf-timepop{top:76px!important;right:18px!important;}body.tm-phase8-formal .tmf-weatherpop{top:76px!important;left:18px!important;}body.tm-phase8-formal .tmf-topbar-pop .tp-title{color:#f0d98c!important;font-size:15px!important;letter-spacing:.18em!important;margin-bottom:4px!important;}body.tm-phase8-formal .tmf-topbar-pop .tp-pin-hint{color:rgba(216,203,168,.58)!important;font-size:11.5px!important;margin-bottom:6px!important;}body.tm-phase8-formal .tmf-topbar-pop .tp-row{display:flex!important;justify-content:space-between!important;gap:18px!important;border-top:1px solid rgba(201,160,69,.12)!important;padding-top:4px!important;}body.tm-phase8-formal .tmf-topbar-pop .tp-k{color:#8dbdab!important;white-space:nowrap!important;}body.tm-phase8-formal .tmf-topbar-pop .tp-v{color:#eadfbd!important;text-align:right!important;}body.tm-phase8-formal .tmf-topbar-pop .wp-head{display:flex!important;align-items:center!important;gap:9px!important;margin-bottom:7px!important;}body.tm-phase8-formal .tmf-topbar-pop .wp-head span{width:28px!important;height:28px!important;display:grid!important;place-items:center!important;border:1px solid rgba(233,196,105,.58)!important;border-radius:50%!important;background:radial-gradient(circle at 35% 25%,rgba(255,225,147,.28),rgba(86,52,24,.78) 58%,rgba(13,10,8,.94))!important;color:#efd990!important;}body.tm-phase8-formal .tmf-topbar-pop .wp-head b{color:#f0d98c!important;font-size:15px!important;letter-spacing:.12em!important;}',
      'body.tm-phase8-formal #topbar:before,body.tm-phase8-formal #topbar:after{display:none!important;}',
      'body.tm-phase8-formal .tb-left,body.tm-phase8-formal .tb-vars,body.tm-phase8-formal .tb-right{position:relative!important;z-index:2!important;pointer-events:auto!important;flex-shrink:0!important;overflow:visible!important;}',
      'body.tm-phase8-formal .tb-left{width:205px!important;height:60px!important;margin:0 2px 0 0!important;padding:7px 13px 7px 7px!important;display:flex!important;align-items:center!important;gap:7px!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;box-sizing:border-box!important;}body.tm-phase8-formal .tb-left:before{content:""!important;display:block!important;position:absolute!important;z-index:0!important;inset:-12px -16px -13px -10px!important;background:url("preview/img/topbar-left-identity-underlay-v1.png") center/100% 100% no-repeat!important;opacity:.68!important;filter:saturate(.98) brightness(.92) contrast(1.05)!important;pointer-events:none!important;}body.tm-phase8-formal .tb-left:after{display:none!important;}body.tm-phase8-formal .tb-left>*{position:relative!important;z-index:1!important;}',
      'body.tm-phase8-formal .tb-wentian{width:36px!important;min-width:36px!important;height:34px!important;padding:0!important;display:flex!important;align-items:center!important;justify-content:center!important;border:1px solid rgba(227,187,92,.62)!important;border-radius:50%!important;background:radial-gradient(circle at 35% 27%,rgba(251,221,143,.30),rgba(92,54,24,.88) 58%,rgba(12,9,7,.94) 78%),linear-gradient(180deg,rgba(63,38,20,.94),rgba(12,9,7,.94))!important;color:#f0d58f!important;font-size:11px!important;letter-spacing:.06em!important;box-shadow:inset 0 1px 0 rgba(255,239,180,.14),inset 0 -8px 14px rgba(0,0,0,.32),0 2px 8px rgba(0,0,0,.40),0 0 11px rgba(205,166,82,.15)!important;}body.tm-phase8-formal .tb-wentian:before{display:none!important;}',
      'body.tm-phase8-formal .tb-weather{height:34px!important;min-width:122px!important;padding:0!important;display:flex!important;align-items:center!important;gap:6px!important;background:transparent!important;border:0!important;box-shadow:none!important;}body.tm-phase8-formal .tb-w-seal{width:24px!important;height:24px!important;display:grid!important;place-items:center!important;font-size:12px!important;border-color:rgba(233,196,105,.52)!important;background:radial-gradient(circle at 35% 25%,rgba(255,225,147,.24),rgba(86,52,24,.74) 58%,rgba(13,10,8,.92))!important;}body.tm-phase8-formal .tb-w-info{min-width:82px!important;}body.tm-phase8-formal .tb-w-name{max-width:104px!important;font-size:12px!important;color:#efd990!important;}body.tm-phase8-formal .tb-w-desc{font-size:10px!important;color:rgba(209,193,153,.66)!important;}',
      'body.tm-phase8-formal .tb-vars{--tm-rail-w:932px;--tm-rail-h:62px;--tm-rail-pad-x:12px;--tm-rail-pad-y:8px;--tm-rail-gap:4px;--tm-wide-cell:212px;--tm-hukou-cell:104px;--tm-lizhi-cell:110px;--tm-small-cell:82px;width:var(--tm-rail-w)!important;height:var(--tm-rail-h)!important;flex:0 0 var(--tm-rail-w)!important;max-width:none!important;padding:var(--tm-rail-pad-y) var(--tm-rail-pad-x)!important;display:flex!important;align-items:center!important;gap:var(--tm-rail-gap)!important;border:0!important;border-radius:0!important;background:url("preview/img/topbar-resource-fieldrail-v2-wide.png") center/100% 100% no-repeat!important;box-shadow:none!important;box-sizing:border-box!important;}body.tm-phase8-formal .tb-vars:before,body.tm-phase8-formal .tb-vars:after{display:none!important;}',
      'body.tm-phase8-formal .tb-var{height:calc(var(--tm-rail-h) - (var(--tm-rail-pad-y) * 2))!important;min-width:0!important;border-color:transparent!important;background:transparent!important;box-shadow:none!important;border-radius:0!important;box-sizing:border-box!important;cursor:pointer!important;}body.tm-phase8-formal .tb-var:hover,body.tm-phase8-formal .tb-var.pinned{background:radial-gradient(ellipse at 50% 10%,rgba(231,190,99,.12),transparent 64%),linear-gradient(180deg,rgba(205,166,82,.075),rgba(205,166,82,.018))!important;}',
      'body.tm-phase8-formal .tb-var.wide{display:flex!important;flex-direction:column!important;align-items:stretch!important;justify-content:center!important;flex:0 0 var(--tm-wide-cell)!important;width:var(--tm-wide-cell)!important;min-width:var(--tm-wide-cell)!important;max-width:var(--tm-wide-cell)!important;padding:5px 8px!important;gap:3px!important;overflow:hidden!important;}body.tm-phase8-formal .tb-var:not(.wide){display:flex!important;flex-direction:row!important;align-items:center!important;flex:0 0 var(--tm-small-cell)!important;width:var(--tm-small-cell)!important;min-width:var(--tm-small-cell)!important;max-width:var(--tm-small-cell)!important;padding:5px 8px!important;gap:5px!important;overflow:hidden!important;}body.tm-phase8-formal .tb-var[data-key="hukou"]{flex-basis:var(--tm-hukou-cell)!important;width:var(--tm-hukou-cell)!important;min-width:var(--tm-hukou-cell)!important;max-width:var(--tm-hukou-cell)!important;}body.tm-phase8-formal .tb-var[data-key="lizhi"]{flex-basis:var(--tm-lizhi-cell)!important;width:var(--tm-lizhi-cell)!important;min-width:var(--tm-lizhi-cell)!important;max-width:var(--tm-lizhi-cell)!important;}',
      'body.tm-phase8-formal .tb-var.wide .tb-vn{flex:0 0 auto!important;width:auto!important;min-width:0!important;max-width:none!important;padding:0 0 0 4px!important;margin:0 0 1px!important;border-right:0!important;text-align:left!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;font-size:9px!important;line-height:1!important;letter-spacing:.18em!important;color:rgba(221,202,155,.74)!important;}body.tm-phase8-formal .tb-vn:before,body.tm-phase8-formal .tb-var.wide .tb-vn:before{display:none!important;}body.tm-phase8-formal .tb-var.wide .tb-vsubs{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;align-items:center!important;gap:4px!important;min-width:0!important;overflow:hidden!important;line-height:1.05!important;}body.tm-phase8-formal .tb-var.wide .tb-vs{height:25px!important;min-width:0!important;display:flex!important;align-items:center!important;gap:4px!important;padding:2px 3px!important;border-radius:2px!important;background:rgba(0,0,0,.12)!important;overflow:hidden!important;}body.tm-phase8-formal .tb-var.wide .icn{width:16px!important;height:16px!important;font-size:9px!important;}body.tm-phase8-formal .tb-var.wide .sv{min-width:0!important;flex:1 1 auto!important;overflow:hidden!important;line-height:1!important;}body.tm-phase8-formal .tb-var.wide .sv b{display:block!important;max-width:100%!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;font:600 11.2px/1.12 "STSong","SimSun","Songti SC",serif!important;color:#e0c77e!important;}body.tm-phase8-formal .tb-var.wide .sv .sd{display:block!important;max-width:100%!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;font:500 9px/1 "STSong","SimSun",serif!important;margin-top:0!important;}',
      'body.tm-phase8-formal .tb-vbody{display:flex!important;flex-direction:column!important;justify-content:center!important;min-width:0!important;overflow:hidden!important;gap:1px!important;line-height:1.05!important;}body.tm-phase8-formal .tb-vn{max-width:100%!important;padding-left:0!important;margin-bottom:0!important;font-size:9px!important;line-height:1!important;letter-spacing:.18em!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;color:rgba(221,202,155,.72)!important;}body.tm-phase8-formal .tb-vv{display:block!important;max-width:100%!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;font-size:12px!important;line-height:1.05!important;color:#e0c77e!important;}body.tm-phase8-formal .tb-var.warn .tb-vv{color:#e88a78!important;}body.tm-phase8-formal .tb-var.good .tb-vv{color:#8dbdab!important;}',
      'body.tm-phase8-formal .tb-right{width:340px!important;height:60px!important;flex:0 0 340px!important;margin-left:auto!important;padding:8px 12px 8px 14px!important;display:flex!important;align-items:center!important;gap:9px!important;isolation:isolate!important;background:url("preview/img/topbar-right-fieldtime-v3-wide.png") center/100% 100% no-repeat!important;border:0!important;border-radius:4px!important;box-shadow:none!important;filter:drop-shadow(0 5px 12px rgba(0,0,0,.30))!important;box-sizing:border-box!important;}body.tm-phase8-formal .tb-right:before{display:none!important;}body.tm-phase8-formal .tb-chip{width:88px!important;min-width:88px!important;height:44px!important;padding:0 8px!important;display:flex!important;align-items:center!important;justify-content:center!important;border:0!important;background:transparent!important;box-shadow:none!important;color:rgba(237,214,151,.86)!important;text-shadow:0 1px 2px rgba(0,0,0,.75)!important;font-size:10.5px!important;}body.tm-phase8-formal .tb-time{flex:1 1 auto!important;height:44px!important;min-width:0!important;max-width:none!important;padding:7px 18px 6px 12px!important;display:flex!important;flex-direction:column!important;justify-content:center!important;align-items:flex-end!important;border:0!important;background:transparent!important;box-shadow:none!important;text-align:right!important;box-sizing:border-box!important;cursor:pointer!important;}body.tm-phase8-formal .tb-time-main{max-width:100%!important;font-size:12.5px!important;line-height:1.18!important;letter-spacing:.055em!important;color:#f1d792!important;text-shadow:0 1px 2px rgba(0,0,0,.78),0 0 8px rgba(217,177,87,.14)!important;}body.tm-phase8-formal .tb-time-sub{max-width:100%!important;font-size:10px!important;color:rgba(219,203,162,.70)!important;text-shadow:0 1px 2px rgba(0,0,0,.72)!important;}',
      '@media(max-width:1500px){body.tm-phase8-formal #topbar{height:88px!important;}body.tm-phase8-formal #banner{top:76px!important;}body.tm-phase8-formal .tb-left{height:60px!important;}body.tm-phase8-formal .tb-vars{--tm-rail-w:820px;--tm-rail-h:62px;--tm-rail-pad-x:10px;--tm-rail-pad-y:8px;--tm-rail-gap:4px;--tm-wide-cell:192px;--tm-hukou-cell:94px;--tm-lizhi-cell:94px;--tm-small-cell:64px;background-image:url("preview/img/topbar-resource-fieldrail-v2-wide.png")!important;}body.tm-phase8-formal .tb-right{width:210px!important;height:58px!important;flex-basis:210px!important;background-image:url("preview/img/topbar-right-fieldtime-v3-compact.png")!important;}body.tm-phase8-formal .tb-chip{width:62px!important;min-width:62px!important;height:44px!important;font-size:10px!important;}body.tm-phase8-formal .tb-time{height:44px!important;padding-right:12px!important;}body.tm-phase8-formal .tb-var.wide .tb-vs{height:31px!important;}body.tm-phase8-formal .tb-var.wide .sv b{font-size:12px!important;}body.tm-phase8-formal .tb-var.wide .sv .sd{display:block!important;font-size:10px!important;line-height:1.05!important;}}',
      '@media(max-width:1280px){body.tm-phase8-formal #topbar{height:84px!important;padding-top:7px!important;}body.tm-phase8-formal #banner{top:72px!important;}body.tm-phase8-formal .tb-left{width:168px!important;height:56px!important;padding-right:10px!important;}body.tm-phase8-formal .tb-weather{min-width:92px!important;gap:4px!important;}body.tm-phase8-formal .tb-w-info{min-width:56px!important;}body.tm-phase8-formal .tb-w-name{max-width:72px!important;font-size:10.5px!important;}body.tm-phase8-formal .tb-w-desc{display:none!important;}body.tm-phase8-formal .tb-vars{--tm-rail-w:742px;--tm-rail-h:60px;--tm-rail-pad-x:9px;--tm-rail-pad-y:8px;--tm-wide-cell:172px;--tm-hukou-cell:84px;--tm-lizhi-cell:88px;--tm-small-cell:58px;}body.tm-phase8-formal .tb-var.wide .tb-vs{height:29px!important;}body.tm-phase8-formal .tb-var.wide .sd{display:block!important;font-size:9px!important;line-height:1.05!important;}body.tm-phase8-formal .tb-right{width:206px!important;height:56px!important;flex-basis:206px!important;padding:6px 10px 6px 11px!important;gap:7px!important;}body.tm-phase8-formal .tb-time{height:42px!important;padding-right:12px!important;}body.tm-phase8-formal .tb-time-main{font-size:11.5px!important;}body.tm-phase8-formal .tb-chip{width:58px!important;min-width:58px!important;height:42px!important;}}',
      '@media(max-width:1080px){body.tm-phase8-formal #topbar{height:76px!important;}body.tm-phase8-formal #banner{top:64px!important;}body.tm-phase8-formal .tb-left{width:54px!important;padding-right:8px!important;}body.tm-phase8-formal .tb-weather{display:none!important;}body.tm-phase8-formal .tb-vars{--tm-rail-w:626px;--tm-rail-h:56px;--tm-rail-pad-x:9px;--tm-rail-pad-y:7px;--tm-rail-gap:3px;--tm-wide-cell:126px;--tm-hukou-cell:76px;--tm-lizhi-cell:82px;--tm-small-cell:60px;background-image:url("preview/img/topbar-resource-fieldrail-v2-narrow.png")!important;}body.tm-phase8-formal .tb-var.wide .tb-vn{display:none!important;}body.tm-phase8-formal .tb-var.wide .tb-vs{height:28px!important;}body.tm-phase8-formal .tb-var.wide .sd{display:block!important;font-size:9px!important;}body.tm-phase8-formal .tb-chip{display:none!important;}body.tm-phase8-formal .tb-right{width:154px!important;height:50px!important;flex-basis:154px!important;background-image:url("preview/img/topbar-right-fieldtime-v3-narrow.png")!important;}body.tm-phase8-formal .tb-time{min-width:0!important;max-width:none!important;height:38px!important;padding-right:12px!important;}body.tm-phase8-formal .tb-time-main{font-size:10.5px!important;}}'
    ].join('\n'); if (st.__tmCss !== __css) { st.__tmCss = __css; st.textContent = __css; }
  }

  // actionTraySpecs + renderActionTrayHtml \u5df2\u8fc1\u51fa\u00b7\u89c1 phase8-formal-topbar.js (Wave 2\u00b72026-05-26)

  function installActionEntryExactStyles(){
    var st = document.getElementById('tm-phase8-formal-action-entry-exact-style');
    if (!st) {
      st = document.createElement('style');
      st.id = 'tm-phase8-formal-action-entry-exact-style';
      document.head.appendChild(st);
    }
    var __css = [
      'body.tm-phase8-formal #tm-phase8-action-tray.zb-action-tray{position:fixed!important;left:18px!important;bottom:24px!important;z-index:62!important;display:block!important;width:356px!important;height:150px!important;pointer-events:none!important;transform:translateZ(0)!important;transition:opacity .18s ease,transform .18s ease!important;}',
      'body.tm-phase8-formal #tm-phase8-action-tray.zb-action-tray:before{content:""!important;position:absolute!important;left:-20px!important;right:-22px!important;bottom:-18px!important;height:62px!important;background:radial-gradient(ellipse at 42% 72%,rgba(0,0,0,.50),rgba(0,0,0,.22) 48%,transparent 74%)!important;pointer-events:none!important;z-index:-1!important;}',
      'body.tm-phase8-formal #tm-phase8-action-tray .zb-btn.zb-img-btn{appearance:none!important;position:absolute!important;left:auto!important;right:auto!important;top:auto!important;bottom:auto!important;width:168px!important;height:70px!important;min-width:0!important;margin:0!important;padding:0!important;overflow:hidden!important;border:1px solid rgba(206,169,87,.38)!important;border-radius:6px!important;background:#120e0a!important;color:#f6e7bb!important;cursor:pointer!important;pointer-events:auto!important;isolation:isolate!important;text-align:left!important;letter-spacing:0!important;box-shadow:0 8px 17px rgba(0,0,0,.46),0 2px 4px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,244,202,.12),inset 0 -1px 0 rgba(0,0,0,.55)!important;filter:drop-shadow(0 8px 12px rgba(0,0,0,.34))!important;transform:translateY(0) rotate(var(--action-tilt,0deg))!important;transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease,filter .18s ease!important;}',
      'body.tm-phase8-formal #tm-phase8-action-tray .zb-img{width:100%!important;height:100%!important;object-fit:cover!important;display:block!important;pointer-events:none!important;opacity:.96!important;filter:saturate(.95) contrast(1.05) brightness(.96)!important;transform:scale(1.012)!important;transition:transform .24s ease,filter .24s ease,opacity .24s ease!important;}',
      'body.tm-phase8-formal #tm-phase8-action-tray .zb-img-btn:before{content:""!important;position:absolute!important;inset:0!important;z-index:1!important;background:linear-gradient(90deg,rgba(8,6,5,.72) 0%,rgba(8,6,5,.42) 36%,rgba(8,6,5,.10) 68%,rgba(8,6,5,.30) 100%),radial-gradient(ellipse at 18% 50%,rgba(223,174,82,.16),transparent 54%)!important;pointer-events:none!important;opacity:.92!important;transition:opacity .18s ease,background .18s ease!important;}',
      'body.tm-phase8-formal #tm-phase8-action-tray #zhao-btn:before{background:linear-gradient(90deg,rgba(8,6,5,.18) 0%,rgba(8,6,5,.16) 34%,rgba(8,6,5,.45) 60%,rgba(8,6,5,.76) 100%),radial-gradient(ellipse at 76% 50%,rgba(223,174,82,.17),transparent 56%)!important;}',
      'body.tm-phase8-formal #tm-phase8-action-tray .zb-img-btn:after{content:""!important;position:absolute!important;inset:1px!important;z-index:3!important;border-radius:5px!important;pointer-events:none!important;box-shadow:inset 0 0 0 1px rgba(244,215,136,.18),inset 0 0 16px rgba(0,0,0,.28)!important;background:linear-gradient(180deg,rgba(255,238,185,.08),transparent 42%),linear-gradient(90deg,rgba(201,160,69,.18),transparent 18%,transparent 82%,rgba(201,160,69,.12))!important;}',
      'body.tm-phase8-formal #tm-phase8-action-tray .zb-action-copy{position:absolute!important;z-index:2!important;left:13px!important;top:50%!important;width:92px!important;transform:translateY(-50%)!important;display:flex!important;flex-direction:column!important;align-items:flex-start!important;gap:2px!important;font-family:"STKaiti","KaiTi","楷体",serif!important;letter-spacing:0!important;pointer-events:none!important;text-align:left!important;text-shadow:0 1px 1px rgba(0,0,0,.86),0 0 8px rgba(0,0,0,.62)!important;}',
      'body.tm-phase8-formal #tm-phase8-action-tray #zhao-btn .zb-action-copy{left:auto!important;right:12px!important;align-items:flex-end!important;text-align:right!important;}',
      'body.tm-phase8-formal #tm-phase8-action-tray .zb-action-kicker{font-size:9px!important;line-height:1!important;color:rgba(213,181,105,.72)!important;letter-spacing:0!important;margin:0!important;}',
      'body.tm-phase8-formal #tm-phase8-action-tray .zb-action-title{font-size:17px!important;line-height:1.05!important;font-weight:700!important;color:#f7e5ad!important;white-space:nowrap!important;letter-spacing:0!important;}',
      'body.tm-phase8-formal #tm-phase8-action-tray .zb-action-sub{font-size:11px!important;line-height:1!important;color:rgba(232,209,150,.72)!important;white-space:nowrap!important;letter-spacing:0!important;margin:0!important;}',
      'body.tm-phase8-formal #tm-phase8-action-tray .zb-action-badge{display:none!important;}',
      'body.tm-phase8-formal #tm-phase8-action-tray .zb-img-btn:hover{border-color:rgba(238,203,118,.72)!important;box-shadow:0 12px 24px rgba(0,0,0,.52),0 0 0 1px rgba(230,190,101,.15),inset 0 1px 0 rgba(255,244,202,.16),inset 0 -1px 0 rgba(0,0,0,.48)!important;filter:drop-shadow(0 10px 16px rgba(0,0,0,.40)) brightness(1.04)!important;transform:translateY(-4px) rotate(var(--action-tilt,0deg))!important;}',
      'body.tm-phase8-formal #tm-phase8-action-tray .zb-img-btn:hover .zb-img{opacity:1!important;filter:saturate(1.02) contrast(1.08) brightness(1.02)!important;transform:scale(1.045)!important;}',
      'body.tm-phase8-formal #tm-phase8-action-tray .zb-img-btn:hover:before{opacity:.72!important;}',
      'body.tm-phase8-formal #tm-phase8-action-tray .zb-img-btn:active{transform:translateY(-1px) rotate(var(--action-tilt,0deg))!important;filter:drop-shadow(0 5px 9px rgba(0,0,0,.44)) brightness(.98)!important;}',
      'body.tm-phase8-formal #tm-phase8-action-tray #zhao-btn{left:0!important;top:2px!important;--action-tilt:-1.9deg;}',
      'body.tm-phase8-formal #tm-phase8-action-tray #zhao-btn-2{left:178px!important;top:5px!important;--action-tilt:.9deg;}',
      'body.tm-phase8-formal #tm-phase8-action-tray #zhao-btn-3{left:8px!important;top:78px!important;--action-tilt:-.7deg;}',
      'body.tm-phase8-formal #tm-phase8-action-tray #zhao-btn-4{left:185px!important;top:75px!important;--action-tilt:1.6deg;}',
      'body.tm-phase8-formal.province-panel-open #tm-phase8-action-tray,body.tm-phase8-formal #mapwrap.panel-open~#tm-phase8-action-tray{opacity:0!important;pointer-events:none!important;transform:translateY(18px) scale(.96)!important;}',
      'body.tm-phase8-formal #gs-shizheng-btn{display:none!important;}',
      'body.tm-phase8-formal #shizheng-btn{position:fixed!important;left:50%!important;bottom:8px!important;width:268px!important;height:64px!important;min-width:0!important;padding:0!important;z-index:63!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:2px!important;color:#4a2a13!important;background:url("preview/img/shizheng-command-plaque.png") center center / 100% 100% no-repeat!important;border:0!important;border-radius:13px!important;cursor:pointer!important;user-select:none!important;white-space:nowrap!important;text-align:center!important;transform:translateX(-50%)!important;filter:drop-shadow(0 8px 14px rgba(0,0,0,.44))!important;box-shadow:none!important;transition:transform .18s ease,filter .18s ease!important;overflow:visible!important;}',
      'body.tm-phase8-formal #shizheng-btn:before{content:""!important;position:absolute!important;left:44px!important;right:44px!important;top:19px!important;bottom:17px!important;border:0!important;border-radius:14px!important;background:radial-gradient(ellipse at 50% 45%,rgba(255,248,214,.36),transparent 72%),linear-gradient(90deg,transparent,rgba(255,236,170,.13),transparent)!important;mix-blend-mode:screen!important;pointer-events:none!important;}',
      'body.tm-phase8-formal #shizheng-btn:after{content:""!important;position:absolute!important;left:30px!important;right:30px!important;bottom:-7px!important;height:14px!important;border:0!important;background:radial-gradient(ellipse at 50% 50%,rgba(0,0,0,.42),rgba(0,0,0,.16) 48%,transparent 78%)!important;z-index:-1!important;pointer-events:none!important;}',
      'body.tm-phase8-formal #shizheng-btn .sz-title{position:relative!important;z-index:1!important;font-size:18px!important;line-height:1!important;font-weight:700!important;letter-spacing:.28em!important;padding-left:.28em!important;color:#3a210f!important;text-shadow:0 1px 0 rgba(255,246,210,.42),0 0 4px rgba(101,52,18,.16)!important;}',
      'body.tm-phase8-formal #shizheng-btn .sz-sub{position:relative!important;z-index:1!important;margin-top:2px!important;font-size:10px!important;line-height:1!important;letter-spacing:.20em!important;padding-left:.20em!important;color:rgba(101,65,27,.72)!important;}',
      'body.tm-phase8-formal #shizheng-btn:hover{transform:translateX(-50%) translateY(-3px)!important;filter:drop-shadow(0 11px 18px rgba(0,0,0,.48)) brightness(1.025)!important;box-shadow:none!important;}',
      'body.tm-phase8-formal #shizheng-btn:active{transform:translateX(-50%) translateY(-1px)!important;filter:drop-shadow(0 6px 10px rgba(0,0,0,.46)) brightness(.985)!important;}',
      '@media(max-width:1280px){body.tm-phase8-formal #tm-phase8-action-tray.zb-action-tray{left:12px!important;bottom:20px!important;width:326px!important;height:136px!important;transform:translateZ(0)!important;}body.tm-phase8-formal #tm-phase8-action-tray .zb-btn.zb-img-btn{width:154px!important;height:64px!important;}body.tm-phase8-formal #tm-phase8-action-tray .zb-action-title{font-size:16px!important;}body.tm-phase8-formal #tm-phase8-action-tray .zb-action-sub{font-size:10.5px!important;}body.tm-phase8-formal #tm-phase8-action-tray #zhao-btn{left:0!important;top:1px!important;}body.tm-phase8-formal #tm-phase8-action-tray #zhao-btn-2{left:162px!important;top:4px!important;}body.tm-phase8-formal #tm-phase8-action-tray #zhao-btn-3{left:7px!important;top:71px!important;}body.tm-phase8-formal #tm-phase8-action-tray #zhao-btn-4{left:168px!important;top:69px!important;}body.tm-phase8-formal #shizheng-btn{width:238px!important;height:57px!important;}body.tm-phase8-formal #shizheng-btn .sz-title{font-size:16px!important;letter-spacing:.25em!important;padding-left:.25em!important;}body.tm-phase8-formal #shizheng-btn .sz-sub{font-size:9px!important;}}',
      '@media(max-width:1080px){body.tm-phase8-formal #tm-phase8-action-tray.zb-action-tray{width:292px!important;height:123px!important;}body.tm-phase8-formal #tm-phase8-action-tray .zb-btn.zb-img-btn{width:138px!important;height:58px!important;}body.tm-phase8-formal #tm-phase8-action-tray .zb-action-copy{left:10px!important;width:78px!important;}body.tm-phase8-formal #tm-phase8-action-tray #zhao-btn .zb-action-copy{right:10px!important;}body.tm-phase8-formal #tm-phase8-action-tray .zb-action-title{font-size:14px!important;}body.tm-phase8-formal #tm-phase8-action-tray .zb-action-sub{font-size:10px!important;}body.tm-phase8-formal #tm-phase8-action-tray .zb-action-kicker{display:none!important;}body.tm-phase8-formal #tm-phase8-action-tray #zhao-btn{left:0!important;top:1px!important;}body.tm-phase8-formal #tm-phase8-action-tray #zhao-btn-2{left:145px!important;top:3px!important;}body.tm-phase8-formal #tm-phase8-action-tray #zhao-btn-3{left:6px!important;top:65px!important;}body.tm-phase8-formal #tm-phase8-action-tray #zhao-btn-4{left:150px!important;top:63px!important;}body.tm-phase8-formal #shizheng-btn{width:218px!important;height:52px!important;}body.tm-phase8-formal #shizheng-btn .sz-title{font-size:15px!important;}body.tm-phase8-formal #shizheng-btn .sz-sub{font-size:9px!important;}}'
    ].join('\n'); if (st.__tmCss !== __css) { st.__tmCss = __css; st.textContent = __css; }
  }

  function installFormalVisibilityStyles(){
    var st = document.getElementById('tm-phase8-formal-visibility-style');
    if (!st) {
      st = document.createElement('style');
      st.id = 'tm-phase8-formal-visibility-style';
      document.head.appendChild(st);
    }
    var __css = [
      'body.tm-phase8-formal:not(.tm-phase8-game-active) #topbar,body.tm-phase8-formal:not(.tm-phase8-game-active) #banner,body.tm-phase8-formal:not(.tm-phase8-game-active) #tm-phase8-action-tray,body.tm-phase8-formal:not(.tm-phase8-game-active) #tm-phase8-event-notice,body.tm-phase8-formal:not(.tm-phase8-game-active) #shizheng-btn,body.tm-phase8-formal:not(.tm-phase8-game-active) #tm-right-rail,body.tm-phase8-formal:not(.tm-phase8-game-active) #tm-phase8-formal-rail,body.tm-phase8-formal:not(.tm-phase8-game-active) #rpanel,body.tm-phase8-formal:not(.tm-phase8-game-active) #tm-phase8-main-shell,body.tm-phase8-formal:not(.tm-phase8-game-active) #tm-phase8-home-return,body.tm-phase8-formal:not(.tm-phase8-game-active) #tm-office-single-back{display:none!important;pointer-events:none!important;}',
      'body.tm-phase8-formal:not(.tm-phase8-game-active) .tmf-topbar-pop{display:none!important;pointer-events:none!important;opacity:0!important;}'
    ].join('\n'); if (st.__tmCss !== __css) { st.__tmCss = __css; st.textContent = __css; }
  }

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
      return arr.length + ':' + (last.turn || last.t || last.raisedTurn || '') + ':' + compactText(text, 48);
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

  window.openZhao = openZhaoPreviewPanel;
  window.openYueZou = openYueZouPreviewPanel;
  window.openHongyan = openHongyanPreviewPanel;
  window.openShilu = openShiluPreviewPanel;
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
        openModule('wendui');
      } else if (action === 'letter') {
        if (window.GM) GM._pendingLetterTo = name;
        state.modulePerson = personKey(p) || id;
        openModule('letter');
      } else if (action === 'office') {
        state.modulePerson = personKey(p) || id;
        openModule('office');
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
