(function(){
  'use strict';

  var STORE_KEY = 'tm_phase8_pinned_people';
  var ASSET_BASE = 'preview/img/';
  var state = window.TM_PHASE8_FORMAL = window.TM_PHASE8_FORMAL || {};

  state.pinnedPeople = Array.isArray(state.pinnedPeople) ? state.pinnedPeople : loadPinned();
  state.activeSlot = state.activeSlot || '';
  state.eventLookback = state.eventLookback || 3;
  state.eventExpandedIdx = state.eventExpandedIdx == null ? null : (Number.isFinite(Number(state.eventExpandedIdx)) ? Number(state.eventExpandedIdx) : null);
  state.mapMode = state.mapMode || 'owner';
  state.mapScale = state.mapScale || 'region';
  state.mapView = state.mapView || { scale: 1, tx: 0, ty: 0 };
  state.legacyView = false;

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
    if (window.P && Array.isArray(P.characters)) P.characters.forEach(add);
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

  function markPinnedCards(){
    document.querySelectorAll('.rw-card,.rw-card-v2,.renwu-card,.tm-person-row,.cz-person-card,.cd,[data-renwu-id],[data-person-id],.tm-desk-item[onclick*="openRenwuTuzhi"]').forEach(function(card){
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

  function showLegacy(){
    openLegacyTab('gt-zhaozheng');
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
    if (Array.isArray(gm._npcClaims)) gm._npcClaims.forEach(function(x){
      add(x, '人物承诺', {
        title: (x.from || x.name || '人物') + '之诺',
        text: x.content || x.text || '',
        meta: [x.from, x.verified ? '已验' : '待验'].filter(Boolean)
      });
    });
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
    var count = document.getElementById('tm-event-count');
    if (count) count.textContent = String(list.length);
    renderEventTurnMenu();
    if (!list.length) {
      host.innerHTML = '<div class="tm-event-empty">暂无近事。新事件会自动归入这里。</div>';
      return;
    }
    host.innerHTML = list.map(function(item, idx){
      var seal = String(item.type || item.title || '事').trim().slice(0, 1) || '事';
      var text = String(item.text || item.time || '').replace(/\s+/g, ' ').trim();
      var detail = String(item.detail || text || item.time || '').replace(/\s+/g, ' ').trim();
      var timeLabel = String(item.time || getTurnText(item.turn)).replace(/\s+/g, ' ').trim();
      var meta = Array.isArray(item.meta) ? item.meta.filter(Boolean).slice(0, 3) : [];
      var expanded = state.eventExpandedIdx === idx;
      var isNew = Number(item.turn || 0) >= Number((window.GM && GM.turn) || 1);
      return '<button type="button" class="tm-event-item' + (isNew ? ' is-new' : '') + (expanded ? ' active expanded' : '') + '" aria-expanded="' + (expanded ? 'true' : 'false') + '" data-event-idx="' + idx + '">' +
        '<span class="tm-event-seal">' + esc(seal) + '</span>' +
        '<span class="tm-event-main"><span class="tm-event-head"><span class="tm-event-kicker">' + esc(item.type) + '</span><b class="tm-event-title">' + esc(item.title) + '</b><span class="tm-event-time">' + esc(timeLabel) + '</span></span><span class="tm-event-body">' + esc(text) + '</span><span class="tm-event-detail">' + esc(detail) + '<span class="tm-event-trace">' + meta.map(function(m){ return '<span>' + esc(m) + '</span>'; }).join('') + '</span></span></span>' +
        '<span class="tm-event-tag">' + esc(item.type) + '</span>' +
        '</button>';
    }).join('');
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
    closeDeskOverlay();
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

  function pendingEdictCount(){
    var gm = window.GM || {};
    var draft = Array.isArray(state.edictDraft) ? state.edictDraft.length : 0;
    var suggestions = Array.isArray(gm._edictSuggestions) ? gm._edictSuggestions.filter(function(x){ return !x || x.used !== true; }).length : 0;
    var tracker = Array.isArray(gm._edictTracker) ? gm._edictTracker.filter(function(x){ return x && x.status !== 'completed' && x.status !== 'done'; }).length : 0;
    return draft + suggestions + tracker;
  }

  function pendingLetterCount(){
    var gm = window.GM || {};
    var letters = firstArray(gm.letters, gm.hongyanLetters, gm._letters);
    return letters.filter(function(x){
      var s = String((x && (x.status || x.state || x.phase)) || '').toLowerCase();
      return !s || /pending|draft|reply|arrived|unread|wait|travel/.test(s);
    }).length;
  }

  function recordCount(){
    var gm = window.GM || {};
    return firstArray(gm.shijiRecords, gm.qijuHistory, gm.jishiRecords, gm.biannian || gm.timeline || []).length;
  }

  function actionTraySpecs(){
    var mems = getMemorials();
    var pendingMem = mems.filter(function(x){
      var s = String((x.raw && (x.raw.status || x.raw.state)) || x.status || '').toLowerCase();
      return !s || /pending|review|draft|unread|wait/.test(s);
    }).length;
    return [
      ['zhao-btn','edict','action-edict-card.png','撰写诏书','御案','起草政令', pendingEdictCount()],
      ['zhao-btn-2','memorial','action-memorial-card.png','百官奏疏','内阁','御览奏报', pendingMem],
      ['zhao-btn-3','letter','action-letter-card.png','鸿雁传书','驿传','遣使通信', pendingLetterCount()],
      ['zhao-btn-4','records','action-annals-card.png','史官实录','史馆','回合档案', recordCount()]
    ];
  }

  function renderActionTrayHtml(){
    return actionTraySpecs().map(function(x){
      var n = Number(x[6] || 0);
      var label = x[3] + '·' + x[5];
      return '<button type="button" id="' + esc(x[0]) + '" class="zb-btn zb-img-btn' + (n > 0 ? ' has-badge' : '') + '" data-tmf-action="' + esc(x[1]) + '" data-action-role="' + esc(x[4]) + '" data-tmf-count="' + esc(n) + '" title="' + esc(label) + '" aria-label="' + esc(label) + '">' +
        '<img class="zb-img" src="' + esc(asset(x[2])) + '" alt="">' +
        '<span class="zb-action-copy"><span class="zb-action-kicker">' + esc(x[4]) + '</span><span class="zb-action-title">' + esc(x[3]) + '</span><span class="zb-action-sub">' + esc(x[5]) + '</span></span>' +
        (n > 0 ? '<span class="zb-action-badge">' + esc(n > 99 ? '99+' : n) + '</span>' : '') +
        '</button>';
    }).join('');
  }

  function ensureFormalChrome(){
    if (!syncFormalShellVisibility()) return;
    var g = document.getElementById('G');
    if (!g) return;
    ensurePreviewTopbar();
    ensurePreviewPanelHost();
    ensurePreviewBottomEntries();
    var notice = document.getElementById('tm-phase8-event-notice');
    if (!notice) {
      notice = document.createElement('section');
      notice.id = 'tm-phase8-event-notice';
      notice.className = 'tm-event-notice';
      notice.setAttribute('aria-label', '朝野近事');
      notice.innerHTML =
        '<div class="tm-event-board-head"><button type="button" class="tm-event-turn-button" id="tm-event-turn-button" aria-expanded="false" title="选择回合范围"><span id="tm-event-scope-label">最近三回合</span><i id="tm-event-count">0</i><b aria-hidden="true">▾</b></button><div class="tm-event-turn-menu" id="tm-event-turn-menu" aria-label="选择回合范围"></div></div>' +
        '<div class="tm-event-list tmf-event-list" id="tm-event-list" tabindex="0" aria-label="近事列表"></div>';
      g.appendChild(notice);
    }
    if (notice && !document.getElementById('tm-event-turn-button')) {
      notice.innerHTML =
        '<div class="tm-event-board-head"><button type="button" class="tm-event-turn-button" id="tm-event-turn-button" aria-expanded="false" title="选择回合范围"><span id="tm-event-scope-label">最近三回合</span><i id="tm-event-count">0</i><b aria-hidden="true">▾</b></button><div class="tm-event-turn-menu" id="tm-event-turn-menu" aria-label="选择回合范围"></div></div>' +
        '<div class="tm-event-list tmf-event-list" id="tm-event-list" tabindex="0" aria-label="近事列表"></div>';
    }
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
    var trayHtml = renderActionTrayHtml();
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
        var row = e.target && e.target.closest ? e.target.closest('[data-event-idx]') : null;
        if (row) {
          if (e.target && e.target.closest && e.target.closest('.tm-event-detail')) return;
          var idx = Number(row.dataset.eventIdx);
          toggleEventRow(idx, row);
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

  function formatRendererDelta(v){
    var n = Number(v || 0);
    if (!isFinite(n) || n === 0) return '\u00b10';
    var fmt = (typeof window._barFmtNum === 'function')
      ? window._barFmtNum(Math.abs(n))
      : String(Math.round(Math.abs(n)));
    return (n > 0 ? '+' : '-') + fmt;
  }

  function readRendererVarCards(){
    var configs = (window.TOP_BAR_VARS && window.TOP_BAR_VARS.length) ? window.TOP_BAR_VARS : null;
    var renderers = window._VAR_RENDERERS || null;
    if (!configs || !renderers) return null;
    var cards = [];
    configs.slice(0, 7).forEach(function(cfg){
      if (!cfg || !cfg.key || typeof renderers[cfg.key] !== 'function') return;
      try {
        var r = renderers[cfg.key]() || {};
        var subs = Array.isArray(r.subItems) ? r.subItems.map(function(s){
          return [
            s && s.k != null ? String(s.k) : '',
            s && s.v != null ? String(s.v) : '--',
            formatRendererDelta(s && s.d)
          ];
        }) : [];
        cards.push({
          key: cfg.key,
          name: cfg.name || cfg.key,
          value: r.value != null ? String(r.value) : '--',
          wide: subs.length > 0,
          subs: subs
        });
      } catch(_) {}
    });
    return cards.length ? cards : null;
  }

  function readOldVarCards(){
    var liveCards = readRendererVarCards();
    if (liveCards) return liveCards;
    var cards = Array.prototype.slice.call(document.querySelectorAll('#bar-vars .bar-var')).slice(0, 7);
    if (!cards.length) {
      return [
        { key:'guoku', name:'帑廪', value:'待核', wide:true, subs:[['银','--',''],['粮','--',''],['布','--','']] },
        { key:'neitang', name:'内帑', value:'待核', wide:true, subs:[['银','--',''],['粮','--',''],['珍','--','']] },
        { key:'hukou', name:'户口', value:'--' },
        { key:'lizhi', name:'吏治', value:'--' },
        { key:'minxin', name:'民心', value:'--' },
        { key:'huangquan', name:'皇权', value:'--' },
        { key:'huangwei', name:'皇威', value:'--' }
      ];
    }
    return cards.map(function(card){
      var name = (card.querySelector('.bar-var-name') || {}).textContent || card.getAttribute('data-var') || '变量';
      var subs = Array.prototype.slice.call(card.querySelectorAll('.bar-var-sub-item')).map(function(item){
        return [
          (item.querySelector('.sk') || {}).textContent || '',
          (item.querySelector('.sv') || {}).textContent || '',
          (item.querySelector('.sd') || {}).textContent || ''
        ];
      });
      return {
        key: card.getAttribute('data-var') || card.getAttribute('data-key') || '',
        name: name.replace(/\s+/g, ''),
        value: ((card.querySelector('.bar-var-value') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
        wide: card.classList.contains('wide') || subs.length > 1,
        subs: subs
      };
    });
  }

  function iconForVar(key, name){
    var raw = String(key || name || '');
    if (/huangwei|wei|\u7687\u5a01|\u5a01/.test(raw)) return '\u5a01';
    if (/huangquan|quan|\u7687\u6743|\u6743/.test(raw)) return '\u6743';
    if (/guoku|帑|库|银|粮/.test(raw)) return '银';
    if (/neitang|内/.test(raw)) return '帑';
    if (/hu|户/.test(raw)) return '户';
    if (/min|民/.test(raw)) return '民';
    if (/huang|权/.test(raw)) return '权';
    if (/wei|威/.test(raw)) return '威';
    if (/li|吏/.test(raw)) return '吏';
    return (String(name || '?').slice(0, 1) || '?');
  }

  function stockKey(label){
    var raw = String(label || '');
    if (/银|钱|qian|yin/.test(raw)) return 'qian';
    if (/粮|liang/.test(raw)) return 'liang';
    if (/布|bu/.test(raw)) return 'bu';
    if (/珍|zhen/.test(raw)) return 'zhen';
    return raw ? raw.replace(/\s+/g, '').slice(0, 8) : 'misc';
  }

  function iconClassFor(key, name){
    var raw = String(key || name || '');
    if (/huangwei|wei|\u7687\u5a01|\u5a01/.test(raw)) return 'icn-wei';
    if (/huangquan|quan|\u7687\u6743|\u6743/.test(raw)) return 'icn-huang';
    if (/qian|yin|银|钱/.test(raw)) return 'icn-yin';
    if (/liang|粮/.test(raw)) return 'icn-liang';
    if (/bu|布/.test(raw)) return 'icn-bu';
    if (/zhen|珍/.test(raw)) return 'icn-zhen';
    if (/hukou|hu|户/.test(raw)) return 'icn-hu';
    if (/lizhi|li|吏/.test(raw)) return 'icn-li';
    if (/minxin|min|民/.test(raw)) return 'icn-min';
    if (/huangquan|huang|权/.test(raw)) return 'icn-huang';
    if (/huangwei|wei|威/.test(raw)) return 'icn-wei';
    return '';
  }

  function trendClass(text){
    var raw = String(text || '');
    if (/[+＋▲↑升增盈]/.test(raw)) return 'up';
    if (/[-－−▼↓降减亏]/.test(raw)) return 'dn';
    return 'flat';
  }

  function topbarVarTone(v){
    var key = String((v && v.key) || '');
    var raw = String((v && v.value) || '');
    if (/lizhi/.test(key) || /弊|危|乱|低|亏|降|▼/.test(raw)) return ' warn';
    if (/huangwei/.test(key) || /好|稳|升|▲/.test(raw)) return ' good';
    return '';
  }

  function topbarTipIndex(key, fallback){
    var order = ['guoku', 'neitang', 'hukou', 'lizhi', 'minxin', 'huangquan', 'huangwei'];
    var idx = order.indexOf(String(key || ''));
    return idx >= 0 ? idx : fallback;
  }

  function renderPreviewTopbarVars(){
    return readOldVarCards().map(function(v, idx){
      var tipIdx = topbarTipIndex(v.key, idx);
      var tipAttr = tipIdx >= 0 ? ' data-tip-idx="' + attr(tipIdx) + '"' : '';
      if (v.wide) {
        var subs = (v.subs && v.subs.length ? v.subs : [['值', v.value || '--', '']]).slice(0, 3);
        return '<div class="tb-var wide' + topbarVarTone(v) + '" data-key="' + attr(v.key) + '"' + tipAttr + '><div class="tb-vn">' + esc(v.name) + '</div><div class="tb-vsubs">' +
          subs.map(function(s){
            var stock = stockKey(s[0]);
            var cls = iconClassFor(stock, s[0]);
            var tr = trendClass(s[2]);
            return '<span class="tb-vs" data-stock="' + attr(stock) + '"><span class="icn ' + esc(cls) + '">' + esc(iconForVar(s[0], s[0])) + '</span><span class="sv"><b>' + esc(s[1] || '--') + '</b><span class="sd ' + tr + '">' + esc(s[2] || '±0') + '</span></span></span>';
          }).join('') + '</div></div>';
      }
      return '<div class="tb-var' + topbarVarTone(v) + '" data-key="' + attr(v.key) + '"' + tipAttr + '><span class="icn ' + esc(iconClassFor(v.key, v.name)) + '">' + esc(iconForVar(v.key, v.name)) + '</span><div class="tb-vbody"><div class="tb-vn">' + esc(v.name) + '</div><div class="tb-vv">' + esc(v.value || '--') + '</div></div></div>';
    }).join('');
  }

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

  function renderTimePopoverHtml(){
    var main = textById('bar-time-main', textById('bar-date', ''));
    var sub = textById('bar-time-sub', textById('bar-turn-text', ''));
    var rows = [];
    rows.push('<div class="tp-title">\u65f6\u5386</div>');
    rows.push('<div class="tp-pin-hint">\u79fb\u5f00\u81ea\u52a8\u6536\u8d77 \u00b7 \u70b9\u65f6\u95f4\u533a\u9489\u4f4f</div>');
    if (main) rows.push('<div class="tp-row"><span class="tp-k">\u4e3b\u5386</span><span class="tp-v">' + esc(main) + '</span></div>');
    if (sub) rows.push('<div class="tp-row"><span class="tp-k">\u516c\u5143</span><span class="tp-v">' + esc(String(sub).replace(/^\s*\u516c\u5143\s*/, '')) + '</span></div>');
    try {
      if (typeof calcDateFromTurn === 'function' && window.GM) {
        var di = calcDateFromTurn(GM.turn || 1);
        if (di && di.gzYearStr) rows.push('<div class="tp-row"><span class="tp-k">\u5c81\u6b21</span><span class="tp-v">' + esc(di.gzYearStr) + ' \u5e74</span></div>');
        if (di && di.season) rows.push('<div class="tp-row"><span class="tp-k">\u65f6\u4ee4</span><span class="tp-v">' + esc(di.season) + '</span></div>');
        if (di && di.gzDayStr) rows.push('<div class="tp-row"><span class="tp-k">\u65e5\u8fb0</span><span class="tp-v">' + esc(di.gzDayStr) + ' \u65e5</span></div>');
      }
    } catch(_) {}
    rows.push('<div class="tp-row"><span class="tp-k">\u8282\u6c14</span><span class="tp-v">' + esc(textById('bar-weather-name', '\u8282\u5019')) + '</span></div>');
    rows.push('<div class="tp-row"><span class="tp-k">\u7269\u5019</span><span class="tp-v">' + esc(textById('bar-weather-desc', '\u7269\u5019\u672a\u8bb0')) + '</span></div>');
    rows.push('<div class="tp-row"><span class="tp-k">\u56de\u5408</span><span class="tp-v">\u7b2c ' + esc((window.GM && GM.turn) || 1) + ' \u56de\u5408</span></div>');
    return rows.join('');
  }

  function renderWeatherPopoverHtml(){
    var name = textById('bar-weather-name', '\u8282\u5019');
    var desc = textById('bar-weather-desc', '\u7269\u5019\u672a\u8bb0');
    var seal = textById('bar-weather-seal', '\u65f6').slice(0, 1);
    var disaster = '\u98ce\u8c03\u96e8\u987a';
    try {
      if (window.GM && GM.activeDisasters && GM.activeDisasters.length) {
        disaster = GM.activeDisasters[0].name || GM.activeDisasters[0].type || disaster;
      }
    } catch(_) {}
    return '<div class="wp-head"><span>' + esc(seal) + '</span><b>' + esc(name) + '</b></div>' +
      '<div class="tp-row"><span class="tp-k">\u7269\u5019</span><span class="tp-v">' + esc(desc) + '</span></div>' +
      '<div class="tp-row"><span class="tp-k">\u5929\u8c61</span><span class="tp-v">' + esc(disaster) + '</span></div>' +
      '<div class="tp-pin-hint">\u79fb\u5f00\u81ea\u52a8\u6536\u8d77 \u00b7 \u70b9\u8282\u5019\u533a\u9489\u4f4f</div>';
  }

  function showTopbarTimePop(){
    var pop = ensureTopbarPopover('tmf-timepop', 'tmf-topbar-pop tmf-timepop');
    pop.innerHTML = renderTimePopoverHtml();
    pop.classList.add('show');
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
    pop.innerHTML = renderWeatherPopoverHtml();
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

  function ensurePreviewTopbar(){
    if (!syncFormalShellVisibility()) return null;
    var top = document.getElementById('topbar');
    if (!top) {
      top = document.createElement('div');
      top.id = 'topbar';
      top.innerHTML =
        '<div class="tb-left"><button type="button" class="tb-wentian" title="问天"><span class="tb-wentian-label">问天</span></button><div class="tb-weather"><div class="tb-w-seal" id="tmf-tb-weather-seal">时</div><div class="tb-w-info"><div class="tb-w-name" id="tmf-tb-weather-name">节候</div><div class="tb-w-desc" id="tmf-tb-weather-desc">物候未记</div></div></div></div>' +
        '<div class="tb-vars" id="tmf-tb-vars"></div>' +
        '<div class="tb-right"><button type="button" class="tb-chip" title="全部变量">全部变量</button><div class="tb-time" id="tmf-tb-time"><div class="tb-time-main" id="tmf-tb-time-main"></div><div class="tb-time-sub" id="tmf-tb-time-sub"></div></div></div>';
      document.body.insertBefore(top, document.body.firstChild);
      top.querySelector('.tb-wentian').onclick = function(){
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
      vars.innerHTML = renderPreviewTopbarVars();
      if (state.topbarVarPinnedKey) {
        var pinned = vars.querySelector('.tb-var[data-key="' + cssEscape(state.topbarVarPinnedKey) + '"]');
        if (pinned) pinned.classList.add('pinned');
      }
    }
    var name = document.getElementById('tmf-tb-weather-name');
    var desc = document.getElementById('tmf-tb-weather-desc');
    var seal = document.getElementById('tmf-tb-weather-seal');
    if (name) name.textContent = textById('bar-weather-name', '节候');
    if (desc) desc.textContent = textById('bar-weather-desc', '物候未记');
    if (seal) seal.textContent = textById('bar-weather-seal', '时').slice(0, 1);
    var main = document.getElementById('tmf-tb-time-main');
    var sub = document.getElementById('tmf-tb-time-sub');
    if (main) main.textContent = textById('bar-time-main', textById('bar-date', ''));
    if (sub) sub.textContent = textById('bar-time-sub', textById('bar-turn-text', ''));
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

  function mapStage(){
    return document.getElementById('ming-map-layer') || document.getElementById('tmf-map-stage');
  }

  function ensureMainShell(){
    if (!syncFormalShellVisibility()) return null;
    var gc = document.getElementById('gc');
    if (!gc) return null;
    var shell = document.getElementById('tm-phase8-main-shell');
    if (!shell) {
      shell = document.createElement('section');
      shell.id = 'tm-phase8-main-shell';
      shell.setAttribute('aria-label', '天命 Phase 8 主界面');
      shell.innerHTML =
        '<div id="mapwrap" class="tmf-mapwrap" data-map-mode="' + esc(state.mapMode) + '" data-map-scale="' + esc(state.mapScale) + '">' +
          '<div class="map-bg"></div><div class="map-board-corner c1"></div><div class="map-board-corner c2"></div><div class="map-board-corner c3"></div><div class="map-board-corner c4"></div>' +
          '<div class="desk-prop paperweight"></div><div class="desk-prop counter"></div><div class="desk-prop seal"></div>' +
          '<div id="ming-map-layer" class="ming-map-layer tmf-map-stage" aria-label="天下舆图"></div>' +
          '<div class="map-zoom-tools" aria-label="舆图缩放"><button type="button" class="mz-btn" data-map-zoom="1.22" title="放大">+</button><button type="button" class="mz-btn reset" data-map-reset="1" title="复位">◎</button><button type="button" class="mz-btn" data-map-zoom="0.82" title="缩小">−</button></div>' +
          '<div class="ming-map-wash"></div>' +
          '<button type="button" class="renwu-tuzhi-entry" data-tmf-action="renwu" title="人物图志"><img class="renwu-tuzhi-img" src="' + esc(asset('renwu-tuzhi-card-ui.png')) + '" alt="人物图志"></button>' +
          '<div class="map-tools-dock open" id="map-tools-dock"><button type="button" class="map-tools-toggle" id="map-tools-toggle" data-map-tools-toggle="1" aria-expanded="true"><span>舆图工具</span><span class="map-tools-mode" id="map-tools-mode">势力</span><span class="map-tools-caret">▾</span></button><div class="map-tools-pop" id="map-tools-pop"><div class="map-layer-bar"><button class="map-layer" data-map-mode="mood">民情</button><button class="map-layer" data-map-mode="tax">财赋</button><button class="map-layer" data-map-mode="army">军务</button><button class="map-layer" data-map-mode="office">官守</button><button class="map-layer on" data-map-mode="owner">势力</button></div><div class="map-nav-panel"><div class="map-search-row"><span class="map-search-label">检索</span><input id="map-search" class="map-search" list="map-region-list" autocomplete="off" placeholder="地名 / 势力 / 主官"><datalist id="map-region-list"></datalist></div><div id="map-search-results" class="map-search-results"></div></div></div></div>' +
          '<div class="map-scale-strip" aria-label="舆图层级"><button type="button" class="map-scale" data-map-scale="realm" aria-pressed="false">天下</button><button type="button" class="map-scale" data-map-scale="region" aria-pressed="true">省道</button><button type="button" class="map-scale" data-map-scale="prefecture" aria-pressed="false">府州</button></div>' +
          '<div class="map-alert-strip"><button type="button" class="map-alert hot" onclick="TMPhase8FormalBridge.openModule(\'memorial\')">待批奏疏</button><button type="button" class="map-alert" onclick="TMPhase8FormalBridge.openPanel(\'issue\')">朝议待核</button><button type="button" class="map-alert ok" onclick="TMPhase8FormalBridge.openPanel(\'finance\')">财赋入库</button></div>' +
          '<div id="tmf-map-legend" class="map-legend tmf-map-legend"></div>' +
          '<div class="map-hint" id="tmf-map-hint">滚轮缩放，拖拽移图，点击地块查看档案。</div>' +
          '<div id="tmf-map-tip" class="map-tooltip tmf-map-tip"></div>' +
        '</div>';
      gc.insertBefore(shell, gc.firstChild);
    }
    var legacyStage = document.getElementById('tmf-map-stage');
    if (legacyStage && !document.getElementById('ming-map-layer')) legacyStage.id = 'ming-map-layer';
    var back = document.getElementById('tm-phase8-home-return');
    if (!back) {
      back = document.createElement('button');
      back.type = 'button';
      back.id = 'tm-phase8-home-return';
      back.textContent = '返回舆图';
      back.onclick = showHome;
      document.getElementById('G').appendChild(back);
    }
    if (state.mainShellBound !== gc) {
      state.mainShellBound = gc;
      gc.addEventListener('click', function(e){
        var toggle = e.target && e.target.closest ? e.target.closest('[data-map-tools-toggle]') : null;
        if (toggle) {
          e.preventDefault();
          e.stopPropagation();
          var dock = document.getElementById('map-tools-dock');
          if (dock) dock.classList.toggle('open');
          toggle.setAttribute('aria-expanded', String(!!(dock && dock.classList.contains('open'))));
          return;
        }
        var zoom = e.target && e.target.closest ? e.target.closest('[data-map-zoom]') : null;
        if (zoom) {
          e.preventDefault();
          e.stopPropagation();
          zoomMap(Number(zoom.dataset.mapZoom || 1));
          return;
        }
        var reset = e.target && e.target.closest ? e.target.closest('[data-map-reset]') : null;
        if (reset) {
          e.preventDefault();
          e.stopPropagation();
          resetMapView();
          return;
        }
        var mode = e.target && e.target.closest ? e.target.closest('.map-layer[data-map-mode]') : null;
        if (mode) {
          e.preventDefault();
          e.stopPropagation();
          state.mapMode = mode.dataset.mapMode || 'owner';
          state.mapPanelTab = state.mapMode;
          updateMapChrome();
          renderFormalMap();
          refreshMapPpop();
          return;
        }
        var scale = e.target && e.target.closest ? e.target.closest('.map-scale[data-map-scale]') : null;
        if (scale) {
          e.preventDefault();
          e.stopPropagation();
          state.mapScale = scale.dataset.mapScale || 'region';
          updateMapChrome();
          renderFormalMap();
          refreshMapPpop();
          return;
        }
      });
      gc.addEventListener('input', function(e){
        if (e.target && e.target.id === 'map-search') renderMapSearchResults(e.target.value || '');
      });
      gc.addEventListener('keydown', function(e){
        if (!(e.target && e.target.id === 'map-search') || e.key !== 'Enter') return;
        var first = document.querySelector('#map-search-results [data-region-id]');
        if (first) {
          e.preventDefault();
          focusRegion(first.dataset.regionId, true);
        }
      });
    }
    installMapInteraction();
    return shell;
  }

  function ensureMapDataScript(){
    return null;
  }

  function cloneMapForFormal(map){
    if (!map) return map;
    if (typeof window.deepClone === 'function') {
      try { return window.deepClone(map); } catch(_) {}
    }
    try { return JSON.parse(JSON.stringify(map)); } catch(_) { return map; }
  }

  function bindFormalMapState(sourceMap){
    if (!hasRegionMap(sourceMap)) return null;
    if (typeof window.bindRuntimeMapState === 'function') {
      try {
        var bound = window.bindRuntimeMapState(sourceMap);
        if (hasRegionMap(bound)) {
          return syncLiveMapRefs(bound);
        }
      } catch(_) {}
    }
    var live = cloneMapForFormal(sourceMap);
    return syncLiveMapRefs(live);
  }

  function syncLiveMapRefs(live){
    if (!hasRegionMap(live)) return null;
    if (window.GM) {
      window.GM.mapData = live;
      window.GM._useAIGeo = false;
    }
    if (window.P) {
      window.P.map = live;
      window.P.mapData = live;
    }
    return live;
  }

  function getMapData(){
    if (window.TMMapRuntime && typeof TMMapRuntime.getMap === 'function') {
      try {
        var live = TMMapRuntime.getMap();
        if (hasRegionMap(live)) return syncLiveMapRefs(live) || live;
      } catch(_) {}
    }
    var gm = window.GM && GM.mapData;
    if (hasRegionMap(gm)) return syncLiveMapRefs(gm) || gm;
    var pMap = window.P && P.map;
    if (hasRegionMap(pMap) && pMap.enabled !== false) return bindFormalMapState(pMap) || pMap;
    var pMapData = window.P && P.mapData;
    if (hasRegionMap(pMapData)) return bindFormalMapState(pMapData) || pMapData;
    var sm = getScenarioMapData();
    if (hasRegionMap(sm)) return bindFormalMapState(sm) || sm;
    if (Array.isArray(window.MING_MAP_REGIONS) && window.MING_MAP_REGIONS.length) {
      var sourceMeta = window.MING_MAP_SOURCE_META || window.MING_MAP_SOURCE || {};
      var sourceId = String(sourceMeta.id || sourceMeta.mapId || 'tianqi-ming2');
      // activeScenarioId is a scenario id, not a map id. Empty scenario map metadata
      // must not block the bundled Ming map fallback used by Tianqi/Chongzhen saves.
      return {
        id: sourceId,
        width: window.MING_MAP_WIDTH || 1200,
        height: window.MING_MAP_HEIGHT || 720,
        regions: window.MING_MAP_REGIONS,
        oceans: window.MING_MAP_OCEANS || [],
        factions: window.MING_MAP_FACTIONS || window.MING_OWNER_POWERS || {}
      };
    }
    ensureMapDataScript();
    return null;
  }

  function resolveBasemap(map){
    if (useGeneratedBasemap(map)) return '';
    var assets = map && map.assets;
    var source = map && map.source;
    var src = map && (map.basemap || map.baseMap || map.backgroundImage || map.background || map.previewImage);
    if (!src && assets) src = assets.basemap || assets.baseMap || assets.backgroundImage || assets.background || assets.image;
    if (!src && source) src = source.basemap || source.baseMap || source.backgroundImage || source.background || source.image;
    if (src && typeof src === 'object') src = src.src || src.url || src.path || src.href;
    if (src) return String(src);
    return '';
  }

  function useGeneratedBasemap(map){
    var base = window.EAST_ASIA_BASEMAP;
    if (!base || typeof base !== 'object' || Array.isArray(base)) return false;
    var id = String(mapIdentity(map) || '').toLowerCase();
    var source = (map && map.source) || {};
    var meta = (map && map.meta) || {};
    var name = [
      id,
      source.id,
      source.mapId,
      source.name,
      meta.id,
      meta.name,
      map && map.name
    ].filter(Boolean).join(' ').toLowerCase();
    if (name.indexOf('tianqi-ming2') >= 0 || name.indexOf('ming') >= 0) return true;
    var regions = map && Array.isArray(map.regions) ? map.regions : [];
    return regions.length > 10 && regions.slice(0, 12).every(function(r){
      return /^ming[-_]/i.test(String((r && (r.id || r.sourceId || r.mapRegionId)) || ''));
    });
  }

  function generatedBasemapLayer(map, basemapSrc){
    var width = Number((map && map.width) || 1200);
    var height = Number((map && map.height) || 720);
    if (useGeneratedBasemap(map)) {
      var base = window.EAST_ASIA_BASEMAP || {};
      var landPaths = Array.isArray(base.landPaths) ? base.landPaths : [];
      var lakePaths = Array.isArray(base.lakePaths) ? base.lakePaths : [];
      var riverPaths = Array.isArray(base.riverPaths) ? base.riverPaths : [];
      var geoLabels = Array.isArray(base.geoLabels) ? base.geoLabels : [];
      var baseImage = base.imageHref ? '<image class="generated-basemap" href="' + attr(base.imageHref) + '" x="0" y="0" width="' + attr(width) + '" height="' + attr(height) + '" preserveAspectRatio="none"></image>' : '';
      var basePaths = landPaths.map(function(d){
        return '<path class="east-base-region" d="' + attr(d) + '" fill-rule="evenodd"></path>';
      }).join('');
      var coastPaths = landPaths.map(function(d){
        return '<path class="east-coastline" d="' + attr(d) + '"></path>';
      }).join('');
      var lakes = lakePaths.map(function(d){
        return '<path class="east-lake" d="' + attr(d) + '"></path>';
      }).join('');
      var rivers = riverPaths.map(function(r){
        var d = typeof r === 'string' ? r : (r && r.d);
        if (!d) return '';
        return '<path class="east-river ' + attr(r && r.major ? 'major' : '') + '" d="' + attr(d) + '"></path>';
      }).join('');
      var grid = [260,420,580,740,900,1060].map(function(x){
        return '<path class="east-geo-grid" d="M' + x + ' 72 L' + x + ' 650"></path>';
      }).join('') + [150,285,420,555].map(function(y){
        return '<path class="east-geo-grid" d="M72 ' + y + ' L1128 ' + y + '"></path>';
      }).join('');
      var labels = geoLabels.map(function(r){
        return '<text class="east-base-label ' + attr(r && r.kind || '') + '" x="' + attr(r && r.x) + '" y="' + attr(r && r.y) + '">' + esc(r && r.text) + '</text>';
      }).join('');
      return '<g class="tmf-generated-basemap">' +
        '<g class="basemap-art">' + baseImage + '</g>' +
        '<ellipse class="ming-map-paper" cx="600" cy="370" rx="631" ry="384"></ellipse>' +
        '<ellipse class="east-sea-wash" cx="632" cy="405" rx="638" ry="380"></ellipse>' +
        '<g class="east-grid">' + grid + '</g>' +
        '<g class="east-base">' + basePaths + '</g>' +
        '<g class="east-lakes">' + lakes + '</g>' +
        '<g class="east-rivers">' + rivers + '</g>' +
        '<g class="east-coast">' + coastPaths + '</g>' +
        '<g class="terrain-under">' +
          '<path class="terrain-ridge" d="M136 390 C188 360 244 360 296 383 C344 404 394 397 440 368"></path>' +
          '<path class="terrain-ridge" d="M452 176 C520 150 586 151 651 174 C708 195 763 188 824 165"></path>' +
          '<path class="terrain-ridge" d="M455 465 C500 438 553 440 602 463 C645 482 690 476 736 452"></path>' +
          '<path class="terrain-hill" d="M290 488 C344 470 405 476 454 507"></path>' +
          '<path class="terrain-hill" d="M790 176 C840 156 897 161 945 191"></path>' +
          '<path class="terrain-shore" d="M912 248 C955 280 973 333 948 381 C923 430 945 481 1005 518"></path>' +
          '<path class="terrain-shore" d="M724 520 C778 552 840 552 890 524"></path>' +
        '</g>' +
        '<g class="east-base-labels">' + labels + '</g>' +
      '</g>';
    }
    if (!basemapSrc) return '';
    return '<image class="tmf-map-basemap" href="' + attr(basemapSrc) + '" x="0" y="0" width="' + attr(width) + '" height="' + attr(height) + '" preserveAspectRatio="none"></image>';
  }

  function pathForRegion(r){
    if (!r) return '';
    if (r.d) return r.d;
    if (r.path) return r.path;
    var pts = [];
    if (Array.isArray(r.points)) pts = r.points.map(function(p){ return Array.isArray(p) ? {x:p[0], y:p[1]} : p; });
    else if (Array.isArray(r.polygon)) pts = r.polygon;
    else if (Array.isArray(r.coords)) {
      for (var i = 0; i < r.coords.length - 1; i += 2) pts.push({ x: r.coords[i], y: r.coords[i + 1] });
    }
    pts = pts.filter(function(p){ return p && isFinite(p.x) && isFinite(p.y); });
    if (!pts.length) return '';
    return 'M' + pts.map(function(p){ return Number(p.x).toFixed(1) + ' ' + Number(p.y).toFixed(1); }).join(' L') + ' Z';
  }

  function centerForRegion(r){
    if (!r) return { x: 0, y: 0 };
    if (Array.isArray(r.center)) return { x: Number(r.center[0]) || 0, y: Number(r.center[1]) || 0 };
    if (r.centroid) return { x: Number(r.centroid.x) || 0, y: Number(r.centroid.y) || 0 };
    var pts = [];
    if (Array.isArray(r.points)) pts = r.points.map(function(p){ return Array.isArray(p) ? {x:p[0], y:p[1]} : p; });
    else if (Array.isArray(r.polygon)) pts = r.polygon;
    else if (Array.isArray(r.coords)) {
      for (var i = 0; i < r.coords.length - 1; i += 2) pts.push({ x: r.coords[i], y: r.coords[i + 1] });
    }
    pts = pts.filter(function(p){ return p && isFinite(p.x) && isFinite(p.y); });
    if (!pts.length) return { x: 0, y: 0 };
    return pts.reduce(function(acc, p){ acc.x += Number(p.x); acc.y += Number(p.y); return acc; }, { x: 0, y: 0, n: pts.length });
  }

  function pointsForRegion(r){
    var pts = [];
    if (!r) return pts;
    if (Array.isArray(r.points)) pts = r.points.map(function(p){ return Array.isArray(p) ? {x:p[0], y:p[1]} : p; });
    else if (Array.isArray(r.polygon)) pts = r.polygon;
    else if (Array.isArray(r.coords)) {
      for (var i = 0; i < r.coords.length - 1; i += 2) pts.push({ x: r.coords[i], y: r.coords[i + 1] });
    } else {
      var d = String(r.d || r.path || '');
      var nums = d.match(/-?\d+(?:\.\d+)?/g) || [];
      for (var j = 0; j < nums.length - 1; j += 2) pts.push({ x: Number(nums[j]), y: Number(nums[j + 1]) });
    }
    return pts.filter(function(p){ return p && isFinite(p.x) && isFinite(p.y); }).map(function(p){ return { x: Number(p.x), y: Number(p.y) }; });
  }

  function regionExtent(r){
    var pts = pointsForRegion(r);
    if (!pts.length) {
      var c = actualCenter(r);
      return { minX: c.x, maxX: c.x, minY: c.y, maxY: c.y, w: 0, h: 0, area: 0 };
    }
    var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    pts.forEach(function(p){
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    });
    var w = Math.max(0, maxX - minX);
    var h = Math.max(0, maxY - minY);
    return { minX: minX, maxX: maxX, minY: minY, maxY: maxY, w: w, h: h, area: w * h };
  }

  function actualCenter(r){
    var c = centerForRegion(r);
    if (c.n) return { x: c.x / c.n, y: c.y / c.n };
    return c;
  }

  function ownerKey(r){
    if (!r) return '';
    var data = Object.assign({}, r.admin || {}, r.data || {});
    return String(r.currentOwner || r.controller || r.owner || r.currentOwnerKey || r.controllerKey || r.ownerKey || r.factionId || data.factionId || data.groupKey || '');
  }

  function ownerName(r){
    if (!r) return '';
    var f = findFaction(ownerKey(r), r.factionName || r.ownerName);
    return (f && (f.label || f.name || f.scenarioFactionName)) || r.factionName || r.ownerName || ownerKey(r) || '未记';
  }

  function canonicalOwnerKey(r){
    var raw = ownerKey(r);
    var f = findFaction(raw, r && (r.factionName || r.ownerName));
    return (f && (f.stableOwnerKey || f.mapFactionId || f.id)) || raw;
  }

  function factionsMap(){
    var map = getMapData() || {};
    return map.factions || map.factionColors || {};
  }

  function normKey(v){
    return String(v === undefined || v === null ? '' : v).trim().toLowerCase();
  }

  function factionTokens(f, key, name){
    var out = [key, name];
    if (f) {
      out.push(f.id, f.sid, f.key, f.scenarioFactionId, f.runtimeFactionId, f.mapFactionId);
      out.push(f.name, f.label, f.short, f.scenarioFactionName, f.ownerKey, f.stableOwnerKey);
    }
    return out.filter(function(x){ return x !== undefined && x !== null && x !== ''; }).map(normKey);
  }

  function liveFactionList(){
    var lists = [];
    var gm = window.GM || {};
    var p = window.P || {};
    var sc = getActiveScenario();
    if (Array.isArray(gm.facs)) lists.push(gm.facs);
    if (Array.isArray(gm.factions)) lists.push(gm.factions);
    if (Array.isArray(p.factions)) lists.push(p.factions);
    if (sc && Array.isArray(sc.factions)) lists.push(sc.factions);
    var sid = activeScenarioId();
    var seen = {};
    var out = [];
    lists.forEach(function(list){
      list.forEach(function(f, i){
        if (!f || typeof f !== 'object') return;
        if (sid && f.sid && String(f.sid) !== sid) return;
        var key = String(f.id || f.sid || f.key || f.name || f.label || ('live-' + i));
        if (seen[key]) return;
        seen[key] = true;
        out.push(f);
      });
    });
    return out;
  }

  function bestLiveFaction(mapFaction, key, name){
    var want = factionTokens(mapFaction, key, name);
    var live = liveFactionList();
    var best = null;
    var bestScore = 0;
    live.forEach(function(f){
      var tokens = factionTokens(f);
      var score = 0;
      tokens.forEach(function(t){
        if (!t) return;
        if (want.indexOf(t) >= 0) score += 10;
        want.forEach(function(w){
          if (!w || w === t) return;
          if (w.length >= 2 && t.length >= 2 && (w.indexOf(t) >= 0 || t.indexOf(w) >= 0)) score += 2;
        });
      });
      if (score > bestScore) {
        bestScore = score;
        best = f;
      }
    });
    return bestScore > 0 ? best : null;
  }

  function mergeFactionData(mapFaction, liveFaction, stableKey){
    var merged = Object.assign({}, mapFaction || {}, liveFaction || {});
    var mapId = mapFaction && (mapFaction.id || mapFaction.key || stableKey);
    var liveId = liveFaction && (liveFaction.id || liveFaction.sid || liveFaction.key);
    merged.id = stableKey || mapId || liveId || merged.id || '';
    merged.mapFactionId = mapId || '';
    merged.runtimeFactionId = liveId || '';
    merged.stableOwnerKey = stableKey || mapId || merged.ownerKey || '';
    merged.label = firstValue(mapFaction && mapFaction.label, liveFaction && liveFaction.label, liveFaction && liveFaction.name, merged.label, merged.name);
    merged.name = firstValue(liveFaction && liveFaction.name, mapFaction && mapFaction.name, mapFaction && mapFaction.label, merged.name, merged.label);
    merged.short = firstValue(mapFaction && mapFaction.short, liveFaction && liveFaction.short, merged.short, merged.label, merged.name);
    merged.color = firstValue(liveFaction && liveFaction.color, mapFaction && mapFaction.color, mapFaction && mapFaction.line, merged.color);
    merged.line = firstValue(liveFaction && liveFaction.line, mapFaction && mapFaction.line, mapFaction && mapFaction.color, merged.line);
    merged._mapFaction = mapFaction || null;
    merged._runtimeFaction = liveFaction || null;
    return merged;
  }

  function findFaction(key, name){
    var fmap = factionsMap();
    var mapHit = null;
    var stableKey = key || '';
    if (key && fmap[key]) mapHit = Object.assign({ id: key }, fmap[key]);
    var vals = Object.keys(fmap).map(function(k){ return Object.assign({ id: k }, fmap[k]); });
    if (!mapHit) {
      mapHit = vals.find(function(f){
        return normKey(f.scenarioFactionId) === normKey(key) ||
          normKey(f.id) === normKey(key) ||
          normKey(f.label || f.name || f.scenarioFactionName) === normKey(name || key);
      }) || null;
      if (mapHit) stableKey = mapHit.id || stableKey;
    }
    var liveHit = bestLiveFaction(mapHit, stableKey || key, name || (mapHit && (mapHit.label || mapHit.name)));
    if (mapHit || liveHit) return mergeFactionData(mapHit, liveHit, stableKey || (mapHit && mapHit.id) || key || '');
    return null;
  }

  function heatColor(value, low, high, colors){
    var n = Number(value);
    if (!isFinite(n)) n = low;
    var t = Math.max(0, Math.min(1, (n - low) / Math.max(1, high - low)));
    return t < .34 ? colors[0] : (t < .67 ? colors[1] : colors[2]);
  }

  function regionColor(r){
    var data = Object.assign({}, (r && r.admin) || {}, (r && r.data) || {});
    if (state.mapMode === 'tax') return heatColor((data.fiscalDetail && data.fiscalDetail.actualRevenue) || r.tax || r.development, 0, 3000000, ['#6f8a72','#b8994c','#c65b3d']);
    if (state.mapMode === 'mood') return heatColor(data.minxinLocal || r.mood || r.prosperity, 20, 85, ['#b94a3c','#b69650','#6f9f88']);
    if (state.mapMode === 'army') return heatColor(r.troops || data.garrison || data.armyPressure || r.armyPressure, 0, 250000, ['#7b8467','#b98e4c','#b6533f']);
    var f = findFaction(ownerKey(r), r.factionName || r.ownerName);
    return (f && (f.color || f.line)) || r.factionColor || r.color || '#b7914f';
  }

  function ownerGroups(map){
    var groups = {};
    (map && map.regions || []).forEach(function(r){
      var key = canonicalOwnerKey(r);
      if (!key) return;
      var c = actualCenter(r);
      if (!isFinite(c.x) || !isFinite(c.y)) return;
      if (!groups[key]) {
        groups[key] = { key: key, name: ownerName(r), color: regionColor(r), x: 0, y: 0, n: 0, area: 0, minX: c.x, maxX: c.x, minY: c.y, maxY: c.y };
      }
      var g = groups[key];
      var ext = regionExtent(r);
      g.x += c.x;
      g.y += c.y;
      g.n += 1;
      g.area += Math.max(1, ext.area || 0);
      g.minX = Math.min(g.minX, ext.minX, c.x);
      g.maxX = Math.max(g.maxX, ext.maxX, c.x);
      g.minY = Math.min(g.minY, ext.minY, c.y);
      g.maxY = Math.max(g.maxY, ext.maxY, c.y);
    });
    return Object.keys(groups).map(function(k){
      var g = groups[k];
      g.x = g.x / Math.max(1, g.n);
      g.y = g.y / Math.max(1, g.n);
      g.span = Math.sqrt(Math.pow(Math.max(0, g.maxX - g.minX), 2) + Math.pow(Math.max(0, g.maxY - g.minY), 2));
      return g;
    }).sort(function(a, b){ return b.n - a.n; });
  }

  function factionLabelLayer(map){
    var groups = ownerGroups(map);
    var maxArea = Math.max.apply(null, groups.map(function(g){ return Number(g.area || 0); }).concat([1]));
    var maxN = Math.max.apply(null, groups.map(function(g){ return Number(g.n || 0); }).concat([1]));
    var maxSpan = Math.max.apply(null, groups.map(function(g){ return Number(g.span || 0); }).concat([1]));
    return groups.map(function(g){
      var name = realmFactionName(g);
      var size = realmLabelSize(g, maxArea, maxN, maxSpan, name);
      var rotate = realmLabelRotation(g.key || name);
      return '<g class="tmf-faction-label" data-faction-key="' + attr(g.key) + '" style="--realm-label-size:' + attr(size) + 'px" transform="translate(' + attr(g.x) + ' ' + attr(g.y) + ') rotate(' + attr(rotate) + ')" onclick="TMPhase8FormalBridge.openFactionByKey(\'' + attr(g.key) + '\')">' +
        '<text class="main" x="0" y="0" text-anchor="middle">' + esc(name) + '</text>' +
      '</g>';
    }).join('');
  }

  function realmLabelSize(g, maxArea, maxN, maxSpan, name){
    var areaScore = maxArea ? Math.sqrt(Math.max(0, Number(g.area || 0)) / maxArea) : 0;
    var countScore = maxN ? Math.sqrt(Math.max(0, Number(g.n || 0)) / maxN) : 0;
    var spanScore = maxSpan ? Math.sqrt(Math.max(0, Number(g.span || 0)) / maxSpan) : 0;
    var score = Math.max(0.05, areaScore * 0.56 + countScore * 0.28 + spanScore * 0.16);
    var size = 16 + score * 40;
    if (Number(g.n || 0) <= 1) size = Math.min(size, 24);
    var len = String(name || '').length;
    if (len >= 5) size *= 0.9;
    if (len >= 7) size *= 0.82;
    return Math.round(Math.max(16, Math.min(56, size)));
  }

  function realmFactionName(g){
    var raw = (g && (g.name || g.key)) || '';
    var name = cleanDisplayValue(raw);
    if (!name || name === '已记录') name = String(raw || '未记势力');
    return name.replace(/朝廷$/g, '').replace(/^大明帝国$/g, '大明');
  }

  function realmFactionSub(g){
    if (!g) return '势力范围';
    var live = null;
    try { live = bestLiveFaction(g.key, { name: g.name }); } catch (_) { live = null; }
    var stance = cleanDisplayValue(live && (live.stance || live.diplomacy || live.posture || live.type));
    if (stance && stance !== '已记录' && stance !== realmFactionName(g)) return stance + ' · ' + (g.n || 0) + '地';
    return (g.n || 0) + '地 · 势力范围';
  }

  function realmLabelRotation(seed){
    var s = String(seed || '');
    var n = 0;
    for (var i = 0; i < s.length; i += 1) n = (n + s.charCodeAt(i) * (i + 3)) % 997;
    return (n % 13) - 6;
  }

  function renderFormalMapSoon(){
    clearTimeout(state.mapRenderTimer);
    state.mapRenderTimer = setTimeout(renderFormalMap, 0);
  }

  function zoomMap(factor){
    var v = state.mapView || { scale: 1, tx: 0, ty: 0 };
    v.scale = Math.max(0.72, Math.min(4.2, Number(v.scale || 1) * (factor || 1)));
    state.mapView = v;
    applyMapTransform();
  }

  function resetMapView(){
    state.mapView = { scale: 1, tx: 0, ty: 0 };
    applyMapTransform();
  }

  function updateMapChrome(){
    var wrap = document.getElementById('mapwrap');
    if (wrap) {
      wrap.dataset.mapMode = state.mapMode || 'owner';
      wrap.dataset.mapScale = state.mapScale || 'region';
    }
    document.querySelectorAll('.map-layer').forEach(function(btn){
      var on = btn.dataset.mapMode === state.mapMode;
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-pressed', String(on));
    });
    document.querySelectorAll('[data-map-scale]').forEach(function(btn){
      if (btn.id === 'mapwrap') return;
      var on = btn.dataset.mapScale === state.mapScale;
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-pressed', String(on));
    });
    var mode = document.getElementById('map-tools-mode');
    if (mode) mode.textContent = mapModeTitle();
    var hint = document.getElementById('tmf-map-hint');
    if (hint) hint.textContent = mapScaleNote() + ' · ' + mapModeNote();
  }

  function mapScaleNote(){
    return ({ realm:'天下视域', region:'行省视域', prefecture:'府县视域' })[state.mapScale || 'region'] || '行省视域';
  }

  function mapModeNote(){
    return ({
      owner:'按势力归属着色',
      tax:'按财赋压力着色',
      mood:'按民情冷暖着色',
      army:'按军务态势着色',
      office:'按官守治理着色'
    })[state.mapMode || 'owner'] || '按势力归属着色';
  }

  function renderFormalMap(){
    var shell = document.getElementById('tm-phase8-main-shell');
    var stage = mapStage();
    if (!shell || !stage || !isGameVisible()) return;
    var map = getMapData();
    if (!map || !Array.isArray(map.regions) || !map.regions.length) {
      stage.innerHTML = '<div class="tmf-map-loading">舆图数据尚未载入</div>';
      state.mapLoadRetry = (state.mapLoadRetry || 0) + 1;
      if (state.mapLoadRetry <= 80) setTimeout(renderFormalMapSoon, state.mapLoadRetry < 12 ? 250 : 700);
      return;
    }
    state.mapLoadRetry = 0;
    var width = Number(map.width || 1200);
    var height = Number(map.height || 720);
    var oceans = Array.isArray(map.oceans) ? map.oceans : [];
    var mapId = mapIdentity(map);
    var basemap = resolveBasemap(map);
    var basemapLayer = generatedBasemapLayer(map, basemap);
    var regionWashes = map.regions.map(function(r){
      var d = pathForRegion(r);
      if (!d) return '';
      return '<path class="tmf-region-wash ming-region-wash" data-id="' + attr(r.id || r.name || '') + '" data-region-id="' + attr(r.id || r.name || '') + '" d="' + attr(d) + '" fill="' + attr(regionColor(r)) + '" fill-rule="evenodd"></path>';
    }).join('');
    var regionHalos = map.regions.map(function(r){
      var d = pathForRegion(r);
      if (!d) return '';
      return '<path class="tmf-region-halo ming-region-halo" data-id="' + attr(r.id || r.name || '') + '" data-region-id="' + attr(r.id || r.name || '') + '" d="' + attr(d) + '"></path>';
    }).join('');
    var regionPaths = map.regions.map(function(r){
      var d = pathForRegion(r);
      if (!d) return '';
      var c = actualCenter(r);
      var labelText = String(r.title || r.name || r.officialName || '');
      var labelWidth = Math.max(34, Math.min(96, labelText.length * 13 + 18));
      return '<path class="tmf-region ming-region" data-id="' + attr(r.id || r.name || '') + '" data-region-id="' + attr(r.id || r.name || '') + '" d="' + attr(d) + '" fill="' + attr(regionColor(r)) + '" fill-rule="evenodd"></path>' +
        '<g class="tmf-region-label ming-label" transform="translate(' + attr(c.x) + ' ' + attr(c.y) + ')"><rect x="' + attr(-labelWidth / 2) + '" y="-10" width="' + attr(labelWidth) + '" height="20"></rect><text x="0" y="0">' + esc(labelText) + '</text></g>';
    }).join('');
    var oceanPaths = oceans.map(function(r){
      var d = pathForRegion(r);
      if (!d) return '';
      var c = actualCenter(r);
      return '<path class="tmf-ocean ming-ocean ming-ocean-region" data-id="' + attr(r.id || r.name || '') + '" d="' + attr(d) + '" fill-rule="evenodd"></path>' +
        '<text class="tmf-ocean-label ming-ocean-label" x="' + attr(c.x) + '" y="' + attr(c.y) + '">' + esc(r.title || r.name || '') + '</text>';
    }).join('');
    stage.innerHTML =
      '<div class="ming-map-camera">' +
      '<svg id="tmf-formal-map" class="ming-map-svg" viewBox="0 0 ' + width + ' ' + height + '" role="img">' +
        '<defs>' +
          '<filter id="tmfPaperNoise"><feTurbulence type="fractalNoise" baseFrequency=".92" numOctaves="2" result="n"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 .07"/></feComponentTransfer></filter>' +
          '<radialGradient id="tmf-ming-paper" cx="52%" cy="46%" r="66%"><stop offset="0" stop-color="#e1be73" stop-opacity=".18"/><stop offset=".72" stop-color="#8b632f" stop-opacity=".06"/><stop offset="1" stop-color="#000000" stop-opacity="0"/></radialGradient>' +
          '<radialGradient id="tmf-east-sea" cx="62%" cy="52%" r="75%"><stop offset="0" stop-color="#617c6f" stop-opacity=".18"/><stop offset=".62" stop-color="#466a61" stop-opacity=".08"/><stop offset="1" stop-color="#1c2b2c" stop-opacity="0"/></radialGradient>' +
        '</defs>' +
        '<g id="tmf-map-world" class="tmf-map-world ming-map-world">' +
          '<rect class="tmf-map-paper-fill" x="0" y="0" width="' + width + '" height="' + height + '"></rect>' +
          basemapLayer +
          oceanPaths +
          '<g class="tmf-region-washes">' + regionWashes + '</g>' +
          '<g class="tmf-region-halos">' + regionHalos + '</g>' +
          '<g class="tmf-region-layer ming-admin-layer">' + regionPaths + '</g>' +
          '<g class="tmf-faction-label-layer">' + factionLabelLayer(map) + '</g>' +
          '<rect class="tmf-map-grain" x="0" y="0" width="' + width + '" height="' + height + '"></rect>' +
        '</g>' +
      '</svg></div>';
    stage.dataset.width = String(width);
    stage.dataset.height = String(height);
    stage.dataset.mapId = mapId;
    applyMapTransform();
    updateMapChrome();
    renderLegend(map);
    renderMapAlerts(map);
    syncMapSearch(map);
    bindRegionPathEvents(map);
  }

  function renderLegend(map){
    var host = document.getElementById('tmf-map-legend');
    if (!host) return;
    var regions = (map && map.regions) || [];
    var seen = {};
    var entries = [];
    regions.forEach(function(r){
      var key = canonicalOwnerKey(r);
      if (!key || seen[key]) return;
      seen[key] = true;
      entries.push({ key: key, name: ownerName(r), color: regionColor(r) });
    });
    if (state.mapMode !== 'owner') {
      host.innerHTML = '<div class="map-legend-title"><span class="map-legend-mode"><i class="map-legend-mark"></i><span class="map-legend-name">' + esc(mapModeTitle()) + '</span></span><span class="map-legend-sub">' + esc(mapScaleNote()) + '</span></div>' +
        '<div class="map-legend-main"><div class="map-legend-bar"></div><div class="map-legend-scale"><span>低</span><span>中</span><span>高</span></div></div>' +
        '<div class="map-legend-detail"><p class="map-legend-note">' + esc(mapModeNote()) + '。颜色随当前运行字段即时重绘，点击地块查看档案。</p></div>';
      return;
    }
    host.innerHTML = '<div class="map-legend-title"><span class="map-legend-mode"><i class="map-legend-mark"></i><span class="map-legend-name">势力版图</span></span><span class="map-legend-sub">' + esc(entries.length) + ' 方</span></div>' +
      '<div class="map-legend-main"><div class="map-owner-row">' + entries.slice(0, 3).map(function(e){
        return '<span class="map-owner-swatch"><i style="background:' + attr(e.color) + '"></i>' + esc(e.name) + '</span>';
      }).join('') + '</div></div>' +
      '<div class="map-legend-detail"><p class="map-legend-note">点击色块查看势力档案，右键任一地块打开所属势力。</p><div class="tmf-legend-list">' + entries.slice(0, 10).map(function(e){
        return '<button type="button" onclick="TMPhase8FormalBridge.openFactionByKey(\'' + attr(e.key) + '\')"><span style="background:' + attr(e.color) + '"></span>' + esc(e.name) + '</button>';
      }).join('') + '</div></div>';
  }

  function regionSearchText(r){
    return [r && (r.title || r.name || r.officialName), r && ownerName(r), r && (r.governor || r.official || r.office || r.capital || r.note)].filter(Boolean).join(' ');
  }

  function syncMapSearch(map){
    var list = document.getElementById('map-region-list');
    if (list && map && Array.isArray(map.regions)) {
      list.innerHTML = map.regions.map(function(r){ return '<option value="' + attr(r.title || r.name || r.officialName || '') + '"></option>'; }).join('');
    }
    var input = document.getElementById('map-search');
    if (input) renderMapSearchResults(input.value || '');
  }

  function renderMapSearchResults(q){
    var host = document.getElementById('map-search-results');
    if (!host) return;
    var map = getMapData();
    var regions = map && Array.isArray(map.regions) ? map.regions : [];
    var query = String(q || '').trim().toLowerCase();
    var rows = regions.filter(function(r){
      return !query || regionSearchText(r).toLowerCase().indexOf(query) >= 0;
    }).slice(0, 6);
    host.innerHTML = rows.map(function(r){
      return '<button type="button" data-region-id="' + attr(r.id || r.name || r.title || '') + '" onclick="TMPhase8FormalBridge.focusRegion(\'' + attr(r.id || r.name || r.title || '') + '\')"><b>' + esc(r.title || r.name || r.officialName || '未名地块') + '</b><span>' + esc(ownerName(r)) + '</span></button>';
    }).join('');
  }

  function focusRegion(id, open){
    var r = findRegion(id);
    if (!r) return;
    var map = getMapData();
    var c = actualCenter(r);
    if (map && c) {
      state.mapView.scale = Math.max(state.mapView.scale || 1, 1.45);
      state.mapView.tx = Number(map.width || 1200) * .52 - c.x * state.mapView.scale;
      state.mapView.ty = Number(map.height || 720) * .48 - c.y * state.mapView.scale;
      applyMapTransform();
    }
    var el = document.querySelector('.tmf-region[data-region-id="' + cssEscape(id) + '"]');
    document.querySelectorAll('.tmf-region.selected').forEach(function(x){ x.classList.remove('selected'); });
    if (el) el.classList.add('selected');
    if (open !== false) openRegionDossier(r);
  }

  function mapModeTitle(){
    return ({ owner:'势力', tax:'财赋', mood:'民情', army:'军务', office:'官守' })[state.mapMode] || '势力';
  }

  function applyMapTransform(){
    var world = document.getElementById('tmf-map-world');
    if (!world) return;
    var v = state.mapView || { scale: 1, tx: 0, ty: 0 };
    world.setAttribute('transform', 'translate(' + v.tx.toFixed(2) + ' ' + v.ty.toFixed(2) + ') scale(' + v.scale.toFixed(4) + ')');
    var stage = mapStage();
    if (stage) stage.classList.toggle('zoomed', v.scale > 1.35);
  }

  function regionPathFromPoint(e){
    if (!e) return null;
    var direct = e.target && e.target.closest ? e.target.closest('.tmf-region,.ming-region') : null;
    if (direct) return direct;
    var stack = document.elementsFromPoint ? document.elementsFromPoint(e.clientX, e.clientY) : [document.elementFromPoint(e.clientX, e.clientY)];
    return (stack || []).find(function(el){
      return el && el.classList && (el.classList.contains('tmf-region') || el.classList.contains('ming-region'));
    }) || null;
  }

  function bindRegionPathEvents(map){
    var regions = map && Array.isArray(map.regions) ? map.regions : [];
    document.querySelectorAll('#tmf-formal-map .tmf-region').forEach(function(el){
      if (el.__phase8RegionBound) return;
      el.__phase8RegionBound = true;
      el.addEventListener('click', function(e){
        if (state.dragSuppressClick) return;
        e.stopPropagation();
        var r = findRegion(el.dataset.regionId || el.dataset.id);
        if (r) openRegionDossier(r);
      });
      el.addEventListener('contextmenu', function(e){
        e.preventDefault();
        e.stopPropagation();
        var r = findRegion(el.dataset.regionId || el.dataset.id);
        if (r) openFactionDossier(ownerKey(r), r);
      });
    });
    if (!regions.length) return;
  }

  function installMapInteraction(){
    var stage = mapStage();
    if (!stage || stage.__phase8MapBound) return;
    stage.__phase8MapBound = true;
    function clearMapSelection(){
      try {
        var sel = window.getSelection && window.getSelection();
        if (sel && typeof sel.removeAllRanges === 'function') sel.removeAllRanges();
      } catch(_) {}
    }
    function preventMapSelection(e){
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
      clearMapSelection();
    }
    stage.addEventListener('selectstart', preventMapSelection, { passive: false });
    stage.addEventListener('dragstart', preventMapSelection, { passive: false });
    stage.addEventListener('wheel', function(e){
      e.preventDefault();
      var map = getMapData();
      if (!map) return;
      var rect = stage.getBoundingClientRect();
      var width = Number(map.width || stage.dataset.width || 1200);
      var height = Number(map.height || stage.dataset.height || 720);
      var x = (e.clientX - rect.left) / rect.width * width;
      var y = (e.clientY - rect.top) / rect.height * height;
      var old = state.mapView.scale || 1;
      var next = Math.max(.85, Math.min(3.4, old * (e.deltaY < 0 ? 1.14 : .88)));
      state.mapView.tx = x - (x - (state.mapView.tx || 0)) * (next / old);
      state.mapView.ty = y - (y - (state.mapView.ty || 0)) * (next / old);
      state.mapView.scale = next;
      applyMapTransform();
    }, { passive: false });
    stage.addEventListener('pointerdown', function(e){
      if (e.button !== 0) return;
      if (e.cancelable) e.preventDefault();
      clearMapSelection();
      state.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, tx: state.mapView.tx || 0, ty: state.mapView.ty || 0, moved: false };
      stage.setPointerCapture(e.pointerId);
      stage.classList.add('dragging');
    });
    stage.addEventListener('pointermove', function(e){
      if (!state.drag || state.drag.id !== e.pointerId) return;
      var map = getMapData();
      if (!map) return;
      var rect = stage.getBoundingClientRect();
      var dx = (e.clientX - state.drag.x) / rect.width * Number(map.width || 1200);
      var dy = (e.clientY - state.drag.y) / rect.height * Number(map.height || 720);
      if (Math.abs(dx) + Math.abs(dy) > 2) {
        state.drag.moved = true;
        clearMapSelection();
      }
      state.mapView.tx = state.drag.tx + dx;
      state.mapView.ty = state.drag.ty + dy;
      applyMapTransform();
    });
    stage.addEventListener('pointerup', function(e){
      if (state.drag && state.drag.id === e.pointerId) {
        state.dragSuppressClick = state.drag.moved;
        state.drag = null;
        stage.classList.remove('dragging');
        clearMapSelection();
        setTimeout(function(){ state.dragSuppressClick = false; }, 0);
      }
    });
    stage.addEventListener('dblclick', function(){
      state.mapView = { scale: 1, tx: 0, ty: 0 };
      applyMapTransform();
    });
    stage.addEventListener('click', function(e){
      if (state.dragSuppressClick) return;
      var path = regionPathFromPoint(e);
      if (!path) return;
      var r = findRegion(path.dataset.regionId || path.dataset.id);
      if (r) openRegionDossier(r);
    });
    stage.addEventListener('contextmenu', function(e){
      var path = regionPathFromPoint(e);
      if (!path) return;
      e.preventDefault();
      var r = findRegion(path.dataset.regionId || path.dataset.id);
      if (r) openFactionDossier(ownerKey(r), r);
    });
    stage.addEventListener('mousemove', function(e){
      var path = regionPathFromPoint(e);
      var tip = document.getElementById('tmf-map-tip');
      if (!tip) return;
      if (!path) {
        tip.classList.remove('show');
        return;
      }
      var r = findRegion(path.dataset.regionId || path.dataset.id);
      if (!r) return;
      var data = r.data || {};
      tip.innerHTML = '<b>' + esc(r.title || r.name) + '</b><span>' + esc(ownerName(r)) + ' · ' + esc(data.officialPosition || r.terrain || '未记') + '</span>';
      tip.style.left = (e.clientX + 12) + 'px';
      tip.style.top = (e.clientY + 12) + 'px';
      tip.classList.add('show');
    });
  }

  function findRegion(id){
    var map = getMapData();
    var key = String(id == null ? '' : id);
    return map && Array.isArray(map.regions) ? map.regions.find(function(r){
      return [r.id, r.name, r.title, r.officialName, r.sourceId, r.mapRegionId, r.adminBinding].some(function(v){
        return String(v == null ? '' : v) === key;
      });
    }) : null;
  }

  function metric(value, fallback){
    if (value == null || value === '') return fallback == null ? '未记' : fallback;
    return value;
  }

  function fmtNum(v, unit){
    var n = Number(v);
    if (!isFinite(n)) return metric(v);
    if (Math.abs(n) >= 10000) return Math.round(n / 10000) + '万' + (unit || '');
    return String(Math.round(n)) + (unit || '');
  }

  function dossierRows(rows){
    return '<div class="tmf-dossier-rows">' + rows.map(function(r){
      return '<div><span>' + esc(r[0]) + '</span><b>' + esc(metric(r[1])) + '</b></div>';
    }).join('') + '</div>';
  }

  function closeMapDossier(){
    var old = document.getElementById('tmf-map-dossier');
    if (old) old.remove();
  }

  function openRegionDossier(r){
    closeMapDossier();
    var data = r.data || {};
    var pop = data.populationDetail || {};
    var fiscal = data.fiscalDetail || {};
    var treasury = data.publicTreasuryInit || {};
    var children = Array.isArray(data.children) ? data.children : [];
    var box = document.createElement('section');
    box.id = 'tmf-map-dossier';
    box.className = 'tmf-map-dossier region';
    box.innerHTML =
      '<header><div><span>地区档案</span><h3>' + esc(r.title || r.name || data.name || '未名地块') + '</h3><p>' + esc(ownerName(r)) + ' · ' + esc(data.regionType || r.type || '地块') + '</p></div><button type="button" data-close="1">×</button></header>' +
      '<main>' +
        '<section class="tmf-dossier-hero"><div class="tmf-map-seal">' + esc((r.title || r.name || '?').slice(0,1)) + '</div><div>' +
          '<b>' + esc(data.officialPosition || '地方官缺') + '</b>' +
          '<span>' + esc(data.governor || '主官未任') + '</span>' +
          '<p>' + esc(data.description || r.description || '暂无地方叙述。') + '</p>' +
        '</div></section>' +
        dossierRows([
          ['行政层级', data.level || data.regionType || r.level],
          ['地势', data.terrain || r.terrain],
          ['特殊资源', data.specialResources || r.resources],
          ['法理归属', data.dejureOwner || ownerName(r)],
          ['当前控制', ownerName(r)],
          ['下辖子区', children.length ? children.length + ' 项' : '未细拆']
        ]) +
        '<h4>户口与民情</h4>' +
        dossierRows([
          ['总人口', fmtNum(data.population || pop.mouths, '口')],
          ['黄册户', fmtNum(pop.households, '户')],
          ['丁口', fmtNum(pop.ding, '丁')],
          ['逃户', fmtNum(pop.fugitives, '口')],
          ['民心', data.minxinLocal || r.mood],
          ['贪腐', data.corruptionLocal]
        ]) +
        '<h4>财政与军务</h4>' +
        dossierRows([
          ['应征', fmtNum(fiscal.claimedRevenue, '两')],
          ['实征', fmtNum(fiscal.actualRevenue, '两')],
          ['留用', fmtNum(fiscal.retainedBudget, '两')],
          ['地方银库', fmtNum(treasury.money, '两')],
          ['地方粮储', fmtNum(treasury.grain, '石')],
          ['驻军压力', r.armyPressure || data.armyPressure]
        ]) +
      '</main>' +
      '<footer><button type="button" onclick="TMPhase8FormalBridge.openPanel(\'map\')">行政区划</button><button type="button" data-close="1">收起</button></footer>';
    box.addEventListener('click', function(e){
      if (e.target && e.target.dataset && e.target.dataset.close) closeMapDossier();
    });
    document.getElementById('tm-phase8-main-shell').appendChild(box);
  }

  function openFactionDossier(key, region){
    closeMapDossier();
    var map = getMapData() || {};
    var f = findFaction(key, region && (region.factionName || region.ownerName)) || {};
    var regions = (map.regions || []).filter(function(r){ return ownerKey(r) === key; });
    var name = f.label || f.name || f.scenarioFactionName || (region && ownerName(region)) || key || '未名势力';
    var box = document.createElement('section');
    box.id = 'tmf-map-dossier';
    box.className = 'tmf-map-dossier faction';
    box.innerHTML =
      '<header><div><span>势力档案</span><h3>' + esc(name) + '</h3><p>右键任一地块打开所属势力</p></div><button type="button" data-close="1">×</button></header>' +
      '<main>' +
        '<section class="tmf-dossier-hero"><div class="tmf-map-seal faction" style="--seal:' + attr(f.color || '#b7914f') + '">' + esc((f.short || name || '?').slice(0,2)) + '</div><div>' +
          '<b>' + esc(f.type || f.factionType || '势力') + '</b>' +
          '<span>' + esc(f.leader || f.leaderName || f.scenarioFactionName || '主脑未记') + '</span>' +
          '<p>' + esc(f.note || f.description || f.desc || '暂无势力叙述。') + '</p>' +
        '</div></section>' +
        dossierRows([
          ['控制地块', regions.length + ' 块'],
          ['首府/核心', f.capital || f.home || '未记'],
          ['军事实力', f.militaryStrength || f.strength || f.score],
          ['经济能力', f.economy || f.wealth || '未记'],
          ['对朝态度', f.attitude || f.playerRelation || '未记'],
          ['长期目标', f.goal || f.longTermStrategy || '未记']
        ]) +
        '<h4>所属地块</h4>' +
        '<div class="tmf-region-links">' + regions.map(function(r){
          return '<button type="button" onclick="TMPhase8FormalBridge.openRegionById(\'' + attr(r.id || r.name) + '\')">' + esc(r.title || r.name) + '</button>';
        }).join('') + '</div>' +
      '</main>' +
      '<footer><button type="button" onclick="TMPhase8FormalBridge.openPanel(\'ol\')">纲纪总览</button><button type="button" data-close="1">收起</button></footer>';
    box.addEventListener('click', function(e){
      if (e.target && e.target.dataset && e.target.dataset.close) closeMapDossier();
    });
    document.getElementById('tm-phase8-main-shell').appendChild(box);
  }

  var MAP_REGION_TABS = [
    ['overview', '总览'],
    ['mood', '民情'],
    ['tax', '财赋'],
    ['army', '军务'],
    ['office', '官守'],
    ['owner', '势力']
  ];

  var MAP_FACTION_TABS = [
    ['records', '档案'],
    ['overview', '总览'],
    ['territory', '版图'],
    ['military', '军务'],
    ['finance', '财赋'],
    ['relations', '关系']
  ];

  MAP_FACTION_TABS.sort(function(a, b){
    var order = { overview: 1, territory: 2, military: 3, finance: 4, relations: 5, records: 6 };
    return (order[a[0]] || 99) - (order[b[0]] || 99);
  });

  var MAP_MODE_META = {
    overview: { title: '地块总览', mark: '览', note: '汇总地形、户口、财赋、军务、官守与势力归属，作为点击地块后的默认档案。' },
    owner: { title: '势力归属', mark: '势', note: '显示当前控制者、法理归属和所属势力，用来判断此地听命于谁。' },
    mood: { title: '民情冷暖', mark: '民', note: '显示民心、逃户、灾异与地方不满，用来判断此地是否容易生变。' },
    tax: { title: '财赋压力', mark: '赋', note: '显示应征、实征、留用、银粮和税负，用来判断此地能否支撑朝廷。' },
    army: { title: '军务态势', mark: '军', note: '显示驻军、城防、边警和军压，用来判断此地是否需要调兵或拨饷。' },
    office: { title: '官守治理', mark: '官', note: '显示主官、官缺、腐败和政令执行，用来判断地方治理是否失衡。' }
  };

  function firstValue(){
    for (var i = 0; i < arguments.length; i += 1) {
      var v = arguments[i];
      if (v !== undefined && v !== null && v !== '') return v;
    }
    return '';
  }

  function objectValue(o, keys){
    if (!o || typeof o !== 'object') return '';
    for (var i = 0; i < keys.length; i += 1) {
      var v = o[keys[i]];
      if (v !== undefined && v !== null && v !== '') return v;
    }
    return '';
  }

  function splitFieldWords(raw){
    return String(raw || '')
      .replace(/^_+/, '')
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/[-_]+/g, ' ')
      .split(/\s+/)
      .filter(Boolean);
  }

  function readableUnknownField(raw){
    raw = String(raw || '').trim();
    if (!raw) return '';
    var direct = {
      x: '横坐标', y: '纵坐标', d: '路径', line: '线段', path: '路径', polygon: '多边形',
      coords: '坐标', points: '坐标点', width: '宽度', height: '高度', color: '颜色',
      fac: '势力', self: '自身', to: '对方', from: '来源', old: '旧值', value: '数值',
      active: '启用', enabled: '启用', pending: '待处理', mutable: '可变'
    };
    if (direct[raw]) return direct[raw];
    if (/^fac[-_]/i.test(raw)) {
      try {
        var fac = findFaction(raw);
        if (fac) return '势力·' + (fac.label || fac.name || fac.scenarioFactionName || raw);
      } catch(_) {}
      return '势力编号·' + raw.replace(/^fac[-_]/i, '');
    }
    if (/^among[A-Z]/.test(raw)) {
      return '影响对象·' + readableUnknownField(raw.slice(5));
    }
    if (/^in[_-]/i.test(raw)) {
      return '所在范围·' + readableUnknownField(raw.replace(/^in[_-]/i, ''));
    }
    var wordMap = {
      ai: 'AI', npc: 'NPC', voc: 'VOC',
      id: '编号', sid: '剧本编号', key: '键', source: '来源', refs: '依据',
      map: '地图', runtime: '运行态', stable: '稳定', scenario: '剧本', supplement: '补充',
      faction: '势力', region: '地块', land: '陆地', ocean: '海域', owner: '归属',
      ownership: '归属', controller: '实际控制', current: '当前', initial: '初始',
      dejure: '法理', legal: '法理', core: '核心', border: '边缘',
      name: '名称', label: '称谓', short: '简称', type: '类型', sub: '子项',
      detail: '明细', profile: '画像', contract: '契约', role: '角色', style: '风格',
      leader: '首领', ruler: '君主', heir: '继嗣', chancellor: '宰辅', general: '主将',
      title: '头衔', rank: '位阶', government: '政体', posture: '姿态',
      population: '人口', mouths: '口数', households: '户数', ding: '丁口',
      registered: '在册', actual: '实数', hidden: '隐匿', fugitives: '逃户',
      male: '男丁', female: '女口', young: '少壮', old: '老弱',
      fiscal: '财政', revenue: '税额', claimed: '应征', remitted: '起运',
      retained: '留用', compliance: '合规率', skimming: '截留', autonomy: '自主',
      treasury: '府库', money: '银', grain: '粮', cloth: '布', horses: '马',
      economy: '经济', economic: '经济', commerce: '商业', volume: '额',
      coefficient: '系数', agriculture: '农业', arable: '可耕地', farmland: '耕地',
      handicraft: '手工业', mining: '矿业', trade: '贸易', routes: '路线',
      maritime: '海贸', tribute: '朝贡', currency: '货币',
      army: '军务', military: '军事', troops: '兵力', militia: '民兵',
      standing: '常备', artillery: '火炮', fleet: '舰队', fortification: '城防',
      supply: '补给', pressure: '压力', readiness: '备战度', casualties: '伤亡',
      war: '战争', front: '战线', fronts: '战线', mobilization: '动员',
      office: '官守', official: '官员', governor: '主官', position: '职名',
      vacancy: '官缺', corruption: '贪腐', execution: '执行', policy: '政策',
      local: '地方', gentry: '士绅', academies: '书院', religious: '宗教',
      sites: '场所', baojia: '保甲', jia: '甲', pai: '牌', bao: '保',
      mood: '民情', minxin: '民心', prosperity: '繁荣', carrying: '承载',
      capacity: '上限', disaster: '灾异', disasters: '灾异', unrest: '不稳',
      threats: '威胁', risk: '风险', risks: '风险', severity: '烈度',
      terrain: '地势', climate: '气候', water: '水利', roads: '道路',
      road: '道路', post: '驿递', relays: '驿站', port: '港口',
      salt: '盐课', mineral: '矿课', horse: '马政', fishing: '渔课',
      imperial: '皇室', domain: '皇庄', assets: '资产',
      culture: '文化', cultural: '文化', faith: '信仰', belief: '信仰',
      ethnicity: '族群', ethnic: '族群', ethnicities: '族群', gender: '性别',
      age: '年龄', settlement: '聚落', commoners: '平民', elite: '精英',
      relation: '关系', relations: '关系', relationship: '关系', allies: '盟友',
      enemies: '敌对', neutrals: '中立', attitude: '态度', player: '玩家',
      influence: '影响', court: '朝堂', popular: '民间', cohesion: '凝聚',
      prestige: '威望', loyalty: '忠诚', stability: '稳定', confidence: '可信度',
      strategy: '方略', strategic: '战略', priorities: '优先', goal: '目标',
      opening: '开局', problems: '问题', hints: '提示', decision: '决策',
      taboo: '禁忌', moves: '动作', counterplay: '应对', mitigations: '缓解',
      events: '事件', event: '事件', history: '历史', historical: '历史',
      notes: '备注', note: '备注', description: '叙述', desc: '叙述',
      technology: '技术', tech: '技术', learning: '学术', astronomy: '天文',
      mathematics: '算学', medicine: '医学', navigation: '航海', cartography: '舆图',
      printing: '刊印', metallurgy: '冶铁', shipbuilding: '造船',
      victory: '胜利', defeat: '失败', conditions: '条件',
      data: '数据', confidence: '可信度', readable: '可读', apply: '应用',
      function: '函数', visible: '可见', theme: '主题'
    };
    var words = splitFieldWords(raw);
    if (!words.length) return raw;
    var translated = words.map(function(w){
      var lower = w.toLowerCase();
      return wordMap[lower] || (/^[\u4e00-\u9fa5]/.test(w) ? w : '');
    }).filter(Boolean);
    if (translated.length) return translated.join('');
    return raw;
  }

  function fieldLabel(k){
    var map = {
      id: '编号', sid: '剧本编号', key: '键名', name: '名称', label: '称谓', short: '简称', type: '类型',
      factionType: '势力类型', leader: '首领', leaderName: '首领', leaderTitle: '称号', ruler: '君主',
      capital: '首府', home: '核心据点', government: '政体', rank: '位阶', desc: '说明', description: '叙述',
      note: '备注', goal: '目标', strategy: '方略', longTermStrategy: '长期方略', agenda: '议程',
      territory: '领土', resources: '资源', mainResources: '核心资源', ideology: '理念', mainstream: '主流',
      culture: '文化', personality: '性格', traits: '特质', members: '成员', history: '历史',
      historicalEvents: '历史事件', relations: '关系', allies: '盟友', enemies: '敌对', neutrals: '中立',
      attitude: '态度', attitudeDetail: '态度细节', playerRelation: '对玩家关系',
      strength: '实力', score: '评分', strengths: '优势', weaknesses: '弱点', militaryStrength: '军力',
      militaryBreakdown: '军力构成', warState: '战争状态', mobilization: '动员', manpower: '人力',
      economy: '经济', wealth: '财力', finance: '财政', treasury: '库藏', supply: '补给',
      population: '人口', actual: '实口', registered: '编户', hidden: '隐户', money: '银', grain: '粮',
      cloth: '布', horses: '马', courtInfluence: '朝堂影响', popularInfluence: '民间影响',
      prestige: '威望', cohesion: '凝聚', political: '政治', military: '军事', economic: '经济',
      cultural: '文化', ethnic: '族群', loyalty: '忠诚', succession: '继承', techLevel: '技术',
      cultureLevel: '文教', publicOpinion: '舆情', economicStructure: '经济结构', economicPolicy: '经济政策',
      internalParties: '内部派系', partyRelations: '党派关系', knownSpies: '已知间谍',
      offendThresholds: '冒犯阈值', decisionHints: '决策提示', npcDecisionHints: 'NPC 提示',
      strategicPriorities: '战略优先', openingProblems: '开局问题', tabooMoves: '禁忌动作',
      aiProfile: 'AI 画像', victoryConditions: '胜利条件', defeatConditions: '失败条件',
      mapFactionId: '地图势力编号', runtimeFactionId: '运行态编号', stableOwnerKey: '稳定归属键',
      commerceVolume: '商业额', commerceCoefficient: '商业系数', farmland: '耕地', roadQuality: '道路',
      postRelays: '驿站', saltProduction: '盐课', mineralProduction: '矿课', horseProduction: '马政',
      fishingProduction: '渔课', imperialFarmland: '皇庄'
    };
    Object.assign(map, {
      title: '题名', officialName: '官称', sourceId: '来源编号', sourceMap: '来源地图',
      sourceScenario: '来源剧本', sourceSupplement: '来源补充', generatedAt: '生成时间',
      mutableFields: '可变字段', runtimeContract: '运行契约', ownershipFields: '归属字段',
      ownershipMutable: '归属可变', liveState: '运行状态', dataConfidence: '数据可信度',
      dataConfidenceNote: '可信度说明', aiReadable: 'AI 可读', aiRole: 'AI 角色',
      aiReadFunction: 'AI 读取函数', aiApplyFunction: 'AI 应用函数',
      regionType: '地块类型', mapRegionId: '地图地块编号', center: '中心点', centroid: '几何中心',
      polygon: '边界多边形', points: '边界点', coords: '坐标', path: '路径', d: '路径',
      sourceRefs: '史料依据', notes: '备注', historicalNote: '史料备注',
      factionId: '势力编号', factionName: '势力名称', owner: '归属', ownerKey: '归属键',
      ownerName: '归属势力', currentOwner: '当前归属', currentOwnerKey: '当前归属键',
      initialOwner: '初始归属', initialOwnerKey: '初始归属键', controller: '实际控制者',
      controllerKey: '实际控制键', currentLoad: '当前负载', ownerHistory: '归属历史',
      controllerHistory: '控制历史', factionColor: '势力颜色', scenarioFactionColor: '剧本势力颜色',
      scenarioFactionId: '剧本势力编号', scenarioFactionName: '剧本势力名称',
      stableFactionId: '稳定势力编号', landRegionCount: '陆地数量', oceanRegionCount: '海域数量',
      unboundLandRegions: '未绑定陆地', affectedSubDivisions: '受影响子区',
      populationDetail: '人口明细', mouths: '口数', households: '户数', ding: '丁口',
      fugitives: '逃户', hiddenCount: '隐户数', sexRatio: '性别比例',
      byGender: '按性别', byAge: '按年龄', byEthnicity: '按族群', byFaith: '按信仰',
      bySettlement: '按聚落', actualRevenue: '实收税额', claimedRevenue: '应征税额',
      remittedToCenter: '起运中枢', retainedBudget: '留用地方', compliance: '合规率',
      skimmingRate: '截留率', autonomy: '财政自主', autonomyLevel: '自治程度',
      taxLevel: '税级', taxPressure: '税负压力', taxBurden: '税负',
      publicTreasuryInit: '地方府库', fiscalDetail: '财赋明细', economyBase: '经济基础',
      imperialAssets: '官府资产', zhizao: '织造', kuangchang: '矿厂', yuyao: '御窑',
      agriculture: '农业', arable: '可耕地', handicraft: '手工业', mining: '矿业',
      maritimeTradeVolume: '海贸额', tradeRoutes: '贸易路线', roads: '道路',
      hasPort: '港口', saltRegion: '盐区', mineralRegion: '矿区', horseRegion: '马政区',
      fishingRegion: '渔区', imperialDomain: '皇庄', armyDetail: '军务明细',
      armyPressure: '军压', troops: '驻军', garrison: '驻军', commander: '主将',
      fortification: '城防', borderRisk: '边警', warRisk: '战事风险',
      standingArmy: '常备军', militia: '民兵', artillery: '火炮', fleet: '舰队',
      activeFronts: '活跃战线', office: '官署', official: '官员', officialPosition: '主官职名',
      officialPattern: '官职模板', officeVacancy: '官缺', officeRisk: '官守风险',
      corruption: '腐败', corruptionLocal: '地方贪腐', policyExecution: '政令执行',
      localFaction: '地方派系', leadingGentry: '地方士绅', academies: '书院',
      religiousSites: '宗教场所', carryingCapacity: '承载上限', carryingRegime: '承载制度',
      minxinLocal: '地方民心', recentDisasters: '近期灾异', disasterRecord: '灾异记录',
      baojia: '保甲', baoCount: '保数', jiaCount: '甲数', paiCount: '牌数',
      specialResources: '特殊资源', specialCulture: '特殊文化', strategicValue: '战略价值',
      coreStatus: '核心/边缘', borderStatus: '边缘状态', capitalChildId: '治所子区',
      tags: '标签', neighbors: '邻接地块', climate: '气候', water: '水利',
      mainResources: '核心资源', publicOpinion: '公共舆情', decisionStyle: '决策风格',
      riskTolerance: '风险偏好', pressureVectors: '压力来源', playerCounterplay: '玩家应对',
      playerVisibleTheme: '玩家可见主题', shouldUseNamedCharacters: '需使用具名人物',
      simulationProfile: '推演画像', willSpawnIfUnanswered: '未回应将触发',
      relationshipType: '关系类型', localSupport: '地方支持', overall: '总体',
      leadership: '领导层', leaderInfo: '首领信息', leaderOriginalText: '首领原文',
      heir: '继嗣', heirInfo: '继嗣信息', designatedHeir: '指定继承人',
      regent: '摄政', chancellor: '宰辅', general: '主将', foundYear: '建立年份',
      peakYear: '鼎盛年份', historicalCap: '历史上限', vassalType: '藩属类型',
      twoBan: '两班', allyClass: '盟友类型', posture: '姿态', readiness: '备战度',
      casualties: '伤亡', fled: '逃散', starved: '饥亡', sold: '售出',
      landsSurveyed: '清丈土地', landsReclaimed: '垦复土地', landsAnnexed: '兼并土地',
      subTypes: '子类型', characterCorrections: '人物校正', isSupplement: '补充项',
      supplementId: '补充编号', supplementName: '补充名称'
    });
    var raw = String(k || '');
    if (map[raw]) return map[raw];
    if (/^[a-z][a-z0-9_-]*$/i.test(raw)) return readableUnknownField(raw);
    return raw;
  }

  function cleanDisplayValue(v){
    if (v === undefined || v === null) return '';
    var s = String(v).trim();
    if (!s) return '';
    var lower = s.toLowerCase();
    var valueMap = {
      province: '省道',
      prefecture: '府州',
      county: '县邑',
      district: '辖区',
      region: '地块',
      realm: '天下',
      frontier: '边地',
      border: '边境',
      capital: '京畿',
      commandery: '郡府',
      tribe: '部族',
      jimi: '羁縻',
      vassal: '藩属',
      tributary: '朝贡',
      sovereign: '独立势力',
      court: '朝廷',
      local: '地方',
      direct: '直辖',
      neutral: '中立',
      ally: '盟友',
      allied: '盟友',
      enemy: '敌对',
      hostile: '敌对',
      friendly: '亲善',
      tense: '紧张',
      active: '生效',
      inactive: '未启用',
      pending: '待定',
      completed: '已完成',
      done: '已完成',
      good: '良好',
      warn: '警戒',
      danger: '危急',
      crisis: '危局',
      high: '高',
      medium: '中',
      low: '低'
    };
    if (valueMap[s]) return valueMap[s];
    if (valueMap[lower]) return valueMap[lower];
    var label = fieldLabel(s);
    if (label && label !== s) return label;
    var faction = null;
    try { faction = findFaction(s); } catch (_) { faction = null; }
    if (faction) return faction.label || faction.name || faction.shortName || faction.id || s;
    if (/^[a-z][a-z0-9_-]*$/i.test(s)) return '已记录';
    return s;
  }

  function ppValue(v, fallback){
    if (v === undefined || v === null || v === '') return fallback || '未记';
    if (typeof v === 'number') return mapNum(v);
    if (Array.isArray(v)) return v.length ? v.map(function(x){ return ppValue(x, ''); }).filter(Boolean).join('、') : (fallback || '未记');
    if (typeof v === 'object') {
      var rows = Object.keys(v).slice(0, 6).map(function(k){ return fieldLabel(k) + '：' + ppValue(v[k], ''); }).filter(Boolean);
      return rows.length ? rows.join(' / ') : (fallback || '未记');
    }
    return cleanDisplayValue(v);
  }

  function mapNum(v, unit){
    var n = Number(v);
    if (!isFinite(n)) return v === undefined || v === null || v === '' ? '未记' : String(v);
    var abs = Math.abs(n);
    var text = '';
    if (abs >= 100000000) text = (n / 100000000).toFixed(abs >= 1000000000 ? 1 : 2).replace(/\.0+$/, '') + '亿';
    else if (abs >= 10000) text = (n / 10000).toFixed(abs >= 1000000 ? 0 : 1).replace(/\.0$/, '') + '万';
    else text = String(Math.round(n));
    return text + (unit || '');
  }

  function pctValue(v){
    var n = Number(v);
    if (!isFinite(n)) return ppValue(v);
    return Math.round(n <= 1 ? n * 100 : n) + '%';
  }

  function shortText(v, max){
    var s = ppValue(v, '');
    max = max || 18;
    return s.length > max ? s.slice(0, max - 1) + '…' : s;
  }

  function regionBundle(r){
    var data = Object.assign({}, (r && r.admin) || {}, (r && r.data) || {});
    var pop = data.populationDetail && typeof data.populationDetail === 'object' ? data.populationDetail : {};
    var fiscal = data.fiscalDetail && typeof data.fiscalDetail === 'object' ? data.fiscalDetail : {};
    var treasury = data.publicTreasuryInit && typeof data.publicTreasuryInit === 'object' ? data.publicTreasuryInit : {};
    var army = data.armyDetail && typeof data.armyDetail === 'object' ? data.armyDetail : {};
    return { data: data, pop: pop, fiscal: fiscal, treasury: treasury, army: army };
  }

  function regionTitle(r){
    var data = regionBundle(r).data;
    return firstValue(r && r.title, r && r.name, data.name, r && r.officialName, '未名地块');
  }

  function regionLevel(r){
    var data = regionBundle(r).data;
    return [firstValue(data.regionType, r && r.type, data.level, r && r.level, '政区'), ownerName(r)].filter(Boolean).join(' · ');
  }

  function regionIdentity(r){
    var b = regionBundle(r);
    return [
      ['层级', firstValue(b.data.level, b.data.regionType, r && r.level, r && r.type)],
      ['主官', firstValue(b.data.governor, b.data.official, r && r.governor, r && r.official)],
      ['治所', firstValue(b.data.capital, r && r.capital)],
      ['地势', firstValue(b.data.terrain, r && r.terrain)],
      ['资源', firstValue(b.data.specialResources, r && r.resources)],
      ['法理', firstValue(b.data.dejureOwner, ownerName(r))]
    ];
  }

  function modeScore(r, mode){
    var b = regionBundle(r);
    if (mode === 'mood') return firstValue(b.data.minxinLocal, r && r.mood, r && r.prosperity, 50);
    if (mode === 'tax') {
      var actual = Number(firstValue(b.fiscal.actualRevenue, r && r.tax, r && r.development, 0));
      var claimed = Number(firstValue(b.fiscal.claimedRevenue, actual || 0));
      if (claimed > 0 && actual >= 0) return Math.max(0, Math.min(100, Math.round(actual / claimed * 100)));
      return actual ? Math.min(100, Math.round(actual / 30000)) : 50;
    }
    if (mode === 'army') return firstValue(r && r.armyPressure, b.data.armyPressure, b.data.garrison, r && r.troops, 50);
    if (mode === 'office') {
      var c = Number(firstValue(b.data.corruptionLocal, b.data.corruption, 50));
      return isFinite(c) ? Math.max(0, Math.min(100, 100 - c)) : 50;
    }
    if (mode === 'owner') return ownerName(r) ? 80 : 50;
    return 60;
  }

  function riskClass(score, inverse){
    var n = Number(score);
    if (!isFinite(n)) return 'risk-mid';
    if (inverse) {
      if (n >= 66) return 'risk-low';
      if (n >= 38) return 'risk-mid';
      return 'risk-high';
    }
    if (n >= 66) return 'risk-high';
    if (n >= 38) return 'risk-mid';
    return 'risk-low';
  }

  function ppTabButtons(kind, active){
    var tabs = kind === 'faction' ? MAP_FACTION_TABS : MAP_REGION_TABS;
    return tabs.map(function(t){
      return '<button type="button" class="pp-tab ' + (t[0] === active ? 'active' : '') + '" data-pp-tab="' + attr(t[0]) + '">' + esc(t[1]) + '</button>';
    }).join('');
  }

  function ppZone(title, rows, wide){
    var html = rows.filter(function(row){ return row && row[1] !== undefined && row[1] !== null && row[1] !== ''; }).map(function(row){
      return '<div class="pp-zr"><span class="pp-zk">' + esc(row[0]) + '</span><span class="pp-zv">' + esc(ppValue(row[1])) + '</span></div>';
    }).join('');
    if (!html) html = '<div class="pp-zr"><span class="pp-zk">记录</span><span class="pp-zv">未记</span></div>';
    return '<section class="pp-zone ' + (wide ? 'wide' : '') + '"><div class="pp-zt">' + esc(title) + '</div>' + html + '</section>';
  }

  function ppModeBanner(r, active){
    var mode = MAP_MODE_META[active] ? active : 'overview';
    var meta = MAP_MODE_META[mode];
    var b = regionBundle(r);
    var value = '';
    var note = meta.note;
    if (mode === 'mood') value = firstValue(b.data.minxinLocal, r && r.mood, '未记');
    else if (mode === 'tax') value = firstValue(b.fiscal.actualRevenue, r && r.tax, '未记');
    else if (mode === 'army') value = firstValue(r && r.troops, b.data.garrison, b.data.armyPressure, '未记');
    else if (mode === 'office') value = firstValue(b.data.governor, b.data.officialPosition, b.data.corruptionLocal, '未记');
    else if (mode === 'owner') value = ownerName(r);
    else value = firstValue(regionTitle(r), ownerName(r));
    var score = mode === 'overview' ? '' : modeScore(r, mode);
    return '<div class="pp-mode-banner ' + (mode === 'overview' ? 'overview' : riskClass(score, mode === 'mood' || mode === 'tax')) + '">' +
      '<div class="pp-mode-seal">' + esc(meta.mark) + '</div>' +
      '<div class="pp-mode-copy"><div class="pp-mode-title">' + esc(meta.title) + '</div><div class="pp-mode-note">' + esc(note) + '</div></div>' +
      '<div class="pp-mode-score"><span>' + esc(mode === 'overview' ? '档案' : '读数') + '</span><b>' + esc(ppValue(value)) + '</b></div>' +
    '</div>';
  }

  function ppStatusSeal(mode, label, r){
    var score = modeScore(r, mode);
    var inverse = mode === 'mood' || mode === 'tax';
    return '<button type="button" class="pp-status-seal ' + riskClass(score, inverse) + (state.mapPanelTab === mode ? ' active' : '') + '" data-pp-tab="' + attr(mode) + '">' +
      '<span class="pp-status-k">' + esc(label) + '</span><b class="pp-status-v">' + esc(ppValue(score)) + '</b><em class="pp-status-note">' + esc(MAP_MODE_META[mode].title) + '</em>' +
    '</button>';
  }

  function ppDevTriplet(r){
    var b = regionBundle(r);
    var rows = [
      ['户', firstValue(b.data.population, b.pop.mouths, b.pop.households, r && r.population), '户口 / 丁册'],
      ['赋', firstValue(b.fiscal.actualRevenue, b.fiscal.claimedRevenue, r && r.tax), '实征 / 应征'],
      ['兵', firstValue(r && r.troops, b.data.garrison, b.army.troops), '驻军 / 军压']
    ];
    return '<div class="pp-dev-triplet">' + rows.map(function(row){
      return '<div class="pp-dev-chip"><i>' + esc(row[0]) + '</i><b>' + esc(ppValue(row[1])) + '</b><span>' + esc(row[2]) + '</span><em>读数</em></div>';
    }).join('') + '</div>';
  }

  function ppLedger(label, value, note, tone){
    return '<div class="pp-ledger-card ' + attr(tone || '') + '"><span>' + esc(label) + '</span><b>' + esc(ppValue(value)) + '</b><small>' + esc(note || '') + '</small></div>';
  }

  function ppFieldChips(rows){
    var html = rows.filter(function(row){ return row && row[1] !== undefined && row[1] !== null && row[1] !== ''; }).map(function(row){
      return '<span class="pp-field-chip"><b>' + esc(row[0]) + '</b>' + esc(ppValue(row[1])) + '</span>';
    }).join('');
    return html ? '<div class="pp-field-chips wide">' + html + '</div>' : '';
  }

  function ppTableRows(rows){
    var html = rows.filter(Boolean).map(function(row){
      return '<div class="pp-table-row"><div><b>' + esc(fieldLabel(row[0])) + '</b><span>' + esc(ppValue(row[2] || '')) + '</span></div><em>' + esc(ppValue(row[1])) + '</em></div>';
    }).join('');
    return '<div class="pp-table-list wide">' + (html || '<div class="pp-table-row"><div><b>暂无</b><span>未记录</span></div><em>-</em></div>') + '</div>';
  }

  function ppTagNames(tags){
    if (!tags || typeof tags !== 'object') return [];
    var label = { hasPort: '港口', saltRegion: '盐课', mineralRegion: '矿课', horseRegion: '马政', fishingRegion: '渔课', imperialDomain: '皇庄' };
    return Object.keys(tags).filter(function(k){ return !!tags[k]; }).map(function(k){ return label[k] || k; });
  }

  function ppIdChain(r){
    var b = regionBundle(r);
    var children = Array.isArray(b.data.children) ? b.data.children : [];
    return '<div class="pp-id-chain wide">' + [
      ['归属', ownerName(r)],
      ['官守', firstValue(b.data.officialPosition, b.data.governor, '未任')],
      ['地块 ID', firstValue(r && r.id, r && r.mapRegionId, b.data.id)],
      ['法理', firstValue(b.data.dejureOwner, ownerName(r))],
      ['首府/子区', firstValue(b.data.capitalChildId, b.data.capital, children.length ? children.length + ' 项' : '')],
      ['类型', firstValue(b.data.regionType, b.data.level, r && r.type)]
    ].map(function(row){
      return '<div class="pp-chain-item"><div class="pp-chain-k">' + esc(row[0]) + '</div><div class="pp-chain-v">' + esc(ppValue(row[1])) + '</div></div>';
    }).join('') + '</div>';
  }

  function ppFacilities(r){
    var b = regionBundle(r);
    var econ = b.data.economyBase || {};
    var assets = econ.imperialAssets || {};
    var rows = [
      ['耕地', econ.farmland], ['商贸', econ.commerceVolume], ['盐课', econ.saltProduction], ['矿课', econ.mineralProduction],
      ['马政', econ.horseProduction], ['渔课', econ.fishingProduction], ['皇庄', econ.imperialFarmland], ['织造', assets.zhizao],
      ['矿厂', assets.kuangchang], ['御窑', assets.yuyao], ['驿站', econ.postRelays], ['道路', econ.roadQuality]
    ];
    return '<section class="pp-zone pp-facilities wide"><div class="pp-zt">地方设施</div><div class="pp-facility-grid">' + rows.map(function(row){
      return '<div class="pp-facility"><span>' + esc(row[0]) + '</span><b>' + esc(ppValue(row[1])) + '</b></div>';
    }).join('') + '</div></section>';
  }

  function ppAdminExtra(r){
    var b = regionBundle(r);
    var econ = b.data.economyBase || {};
    return '<div class="pp-section-strip wide">地方底账</div>' + ppTableRows([
      ['书院', b.data.academies, '地方士林'],
      ['士绅', b.data.leadingGentry, '地方精英'],
      ['宗教场所', b.data.religiousSites, '信仰网络'],
      ['城镇聚落', b.data.bySettlement, '城乡构成'],
      ['贸易路线', b.data.tradeRoutes, '商路/漕路'],
      ['近期灾异', firstValue(b.data.recentDisasters, econ.disasterRecord), '灾害记录'],
      ['威胁', b.data.threats, '军政风险'],
      ['特殊文化', b.data.specialCulture, '地域叙述'],
      ['战略价值', b.data.strategicValue, '军政判断']
    ]);
  }

  function ppRegionTabDetail(r, active){
    var b = regionBundle(r);
    var data = b.data || {};
    var econ = data.economyBase || {};
    var children = Array.isArray(data.children) ? data.children : [];
    var tagList = ppTagNames(data.tags);
    var mode = MAP_MODE_META[active] ? active : 'overview';
    var body = '';
    if (mode === 'overview') {
      body = ppZone('行政档案', [
        ['地块名', regionTitle(r)],
        ['行政层级', firstValue(data.level, data.regionType, r && r.level, r && r.type)],
        ['官方 ID', firstValue(data.id, r && r.id, r && r.mapRegionId)],
        ['主官职名', firstValue(data.officialPosition, data.office, r && r.office)],
        ['主官', firstValue(data.governor, data.official, r && r.governor)],
        ['治所 / 核心', firstValue(data.capital, data.capitalChildId, r && r.capital)],
        ['法理归属', firstValue(data.dejureOwner, ownerName(r))],
        ['下辖子区', children.length ? children.map(function(x){ return ppValue(x.name || x.title || x.id || x); }).join('、') : '未细分']
      ], true) + ppFieldChips([
        ['地势', firstValue(data.terrain, r && r.terrain)],
        ['特殊资源', firstValue(data.specialResources, r && r.resources)],
        ['特殊文化', data.specialCulture],
        ['战略价值', data.strategicValue],
        ['标签', tagList]
      ]) + ppIdChain(r);
    } else if (mode === 'mood') {
      body = ppZone('民情与人口', [
        ['总人口', firstValue(data.population, b.pop.mouths, r && r.population)],
        ['黄册户', b.pop.households],
        ['丁口', b.pop.ding],
        ['逃户', b.pop.fugitives],
        ['隐户', b.pop.hiddenCount],
        ['民心', firstValue(data.minxinLocal, r && r.mood)],
        ['繁荣', firstValue(data.prosperity, r && r.prosperity)],
        ['承载上限', data.carryingCapacity],
        ['保甲', data.baojia],
        ['近期灾异', firstValue(data.recentDisasters, econ.disasterRecord)]
      ], true) + ppFieldChips([
        ['性别', data.byGender],
        ['年龄', data.byAge],
        ['族群', data.byEthnicity],
        ['信仰', data.byFaith],
        ['聚落', data.bySettlement],
        ['宗教场所', data.religiousSites]
      ]);
    } else if (mode === 'tax') {
      body = ppZone('财赋流水', [
        ['应征税额', b.fiscal.claimedRevenue],
        ['实收税额', b.fiscal.actualRevenue],
        ['起运中枢', b.fiscal.remittedToCenter],
        ['留用地方', b.fiscal.retainedBudget],
        ['合规率', pctValue(b.fiscal.compliance)],
        ['截留率', pctValue(b.fiscal.skimmingRate)],
        ['财政自主', b.fiscal.autonomy],
        ['税级', data.taxLevel],
        ['地方银', b.treasury.money],
        ['地方粮', b.treasury.grain],
        ['地方布', b.treasury.cloth]
      ], true) + ppFacilities(r);
    } else if (mode === 'army') {
      body = ppZone('军务态势', [
        ['驻军', firstValue(r && r.troops, data.garrison, b.army.troops)],
        ['军压', firstValue(r && r.armyPressure, data.armyPressure)],
        ['城防', firstValue(data.fortification, b.army.fortification)],
        ['主将', firstValue(data.commander, b.army.commander)],
        ['边警', firstValue(data.borderRisk, data.warRisk)],
        ['补给', firstValue(data.supply, b.army.supply)],
        ['战略价值', data.strategicValue],
        ['威胁', data.threats]
      ], true) + ppFieldChips([
        ['商路', data.tradeRoutes],
        ['道路', econ.roadQuality],
        ['驿站', econ.postRelays],
        ['马政', econ.horseProduction],
        ['水师 / 海防', firstValue(data.navy, data.coastalDefense)]
      ]);
    } else if (mode === 'office') {
      body = ppZone('官守治理', [
        ['官职', data.officialPosition],
        ['主官', firstValue(data.governor, data.official)],
        ['官缺', firstValue(data.officeVacancy, data.vacancy)],
        ['腐败', firstValue(data.corruptionLocal, data.corruption)],
        ['执行', firstValue(data.policyExecution, data.execution)],
        ['地方派系', firstValue(data.localFaction, data.party)],
        ['士绅', data.leadingGentry],
        ['书院', data.academies],
        ['税级', data.taxLevel]
      ], true) + ppFieldChips([
        ['治理标签', tagList],
        ['科举名额', econ.kejuQuota],
        ['官府资产', econ.imperialAssets],
        ['地方备注', firstValue(data.note, r && r.note)]
      ]);
    } else if (mode === 'owner') {
      var key = ownerKey(r);
      var f = findFaction(key, r && (r.factionName || r.ownerName)) || {};
      body = ppZone('势力归属', [
        ['当前控制', ownerName(r)],
        ['势力键', key],
        ['法理归属', firstValue(data.dejureOwner, ownerName(r))],
        ['实际控制键', firstValue(r && r.controllerKey, data.controllerKey, key)],
        ['地图势力 ID', firstValue(f.mapFactionId, key)],
        ['运行态势力 ID', f.runtimeFactionId],
        ['核心 / 边缘', firstValue(data.coreStatus, data.borderStatus)],
        ['归属历史', data.ownerHistory]
      ], true) + '<div class="pp-action-row wide"><button type="button" class="pp-action" onclick="TMPhase8FormalBridge.openFactionByKey(\'' + attr(key) + '\')">打开势力档案</button></div>';
    }
    return '<div class="pp-tab-detail">' + ppModeBanner(r, mode) + body + '</div>';
  }

  function ppRegionGrid(r, active){
    var b = regionBundle(r);
    var children = Array.isArray(b.data.children) ? b.data.children : [];
    var tags = [];
    if (b.data.tags && typeof b.data.tags === 'object') {
      Object.keys(b.data.tags).forEach(function(k){ if (b.data.tags[k]) tags.push(k); });
    }
    return [
      '<section class="pp-admin-brief wide"><div class="pp-admin-seal">' + esc(regionTitle(r).slice(0, 1)) + '</div><div><b>' + esc(firstValue(b.data.officialPosition, b.data.regionType, r && r.type, '地方政区')) + '</b><p class="pp-admin-desc">' + esc(firstValue(b.data.description, r && r.description, '此地尚无专门叙述，但会随剧本地图数据、地方财政、军务和人物任职动态更新。')) + '</p></div></section>',
      ppDevTriplet(r),
      '<div class="pp-seal-grid wide">' + [
        ppStatusSeal('mood', '民情', r),
        ppStatusSeal('tax', '财赋', r),
        ppStatusSeal('army', '军务', r),
        ppStatusSeal('office', '官守', r),
        ppStatusSeal('owner', '势力', r)
      ].join('') + '</div>',
      ppZone('地形 · 户口', [
        ['地势', firstValue(b.data.terrain, r && r.terrain)],
        ['总口', firstValue(b.data.population, b.pop.mouths, r && r.population)],
        ['黄册户', b.pop.households],
        ['丁口', b.pop.ding],
        ['逃户', b.pop.fugitives],
        ['族群/风俗', firstValue(b.data.ethnicity, b.data.customs)]
      ]),
      ppZone('财赋 · 库藏', [
        ['应征', b.fiscal.claimedRevenue],
        ['实征', b.fiscal.actualRevenue],
        ['留用', b.fiscal.retainedBudget],
        ['税负', firstValue(b.fiscal.taxBurden, b.data.taxBurden)],
        ['地方银', b.treasury.money],
        ['地方粮', b.treasury.grain]
      ]),
      ppZone('军务 · 城防', [
        ['驻军', firstValue(r && r.troops, b.data.garrison, b.army.troops)],
        ['军压', firstValue(r && r.armyPressure, b.data.armyPressure)],
        ['城防', firstValue(b.data.fortification, b.army.fortification)],
        ['主将', firstValue(b.data.commander, b.army.commander)],
        ['边警', firstValue(b.data.borderRisk, b.data.warRisk)],
        ['补给', firstValue(b.data.supply, b.army.supply)]
      ]),
      ppZone('官守 · 治理', [
        ['主官', firstValue(b.data.governor, b.data.official)],
        ['官职', b.data.officialPosition],
        ['官缺', firstValue(b.data.officeVacancy, b.data.vacancy)],
        ['腐败', firstValue(b.data.corruptionLocal, b.data.corruption)],
        ['执行', firstValue(b.data.policyExecution, b.data.execution)],
        ['地方派系', firstValue(b.data.localFaction, b.data.party)]
      ]),
      ppZone('势力 · 归属', [
        ['当前控制', ownerName(r)],
        ['势力键', ownerKey(r)],
        ['法理归属', firstValue(b.data.dejureOwner, ownerName(r))],
        ['核心/边缘', firstValue(b.data.coreStatus, b.data.borderStatus)],
        ['下辖子区', children.length ? children.map(function(x){ return ppValue(x.name || x.title || x); }).join('、') : '未细分'],
        ['标签', tags.length ? tags.join('、') : '未记']
      ]),
      '<div class="pp-action-row wide">' +
        '<button type="button" class="pp-action" data-pp-action="map">行政区划</button>' +
        '<button type="button" class="pp-action" data-pp-action="issue">转御案</button>' +
        '<button type="button" class="pp-action" data-pp-action="records">入史官</button>' +
      '</div>'
    ].join('');
  }

  function ppRegionGridV2(r, active){
    var b = regionBundle(r);
    var children = Array.isArray(b.data.children) ? b.data.children : [];
    var tagList = ppTagNames(b.data.tags);
    return [
      '<section class="pp-admin-brief wide"><div class="pp-admin-head"><div class="pp-admin-seal"><b>' + esc(regionTitle(r).slice(0, 1)) + '</b><span>' + esc(firstValue(b.data.level, r && r.level, '政区')) + '</span></div><div><div class="pp-admin-title"><span>' + esc(regionTitle(r)) + '</span><small>' + esc(firstValue(r && r.id, b.data.id, '未记 ID')) + '</small></div><p class="pp-admin-desc">' + esc(firstValue(b.data.description, r && r.description, '此地暂无专门叙述，但会随剧本地图数据、地方财政、军务和人物任职动态更新。')) + '</p><div class="pp-badge-row">' + [firstValue(b.data.regionType, r && r.type), firstValue(b.data.officialPosition, b.data.governor), ownerName(r)].concat(tagList).filter(Boolean).slice(0, 9).map(function(x, i){ return '<span class="' + (i === 2 ? 'good' : '') + '">' + esc(ppValue(x)) + '</span>'; }).join('') + '</div></div></div></section>',
      '<div class="pp-ledger-grid wide">' +
        ppLedger('在编人口', firstValue(b.data.population, b.pop.mouths, r && r.population), '官方剧本口径') +
        ppLedger('黄册户口', b.pop.households, '丁 ' + ppValue(b.pop.ding)) +
        ppLedger('商业额', objectValue(b.data.economyBase, ['commerceVolume']), '系数 ' + ppValue(objectValue(b.data.economyBase, ['commerceCoefficient']))) +
        ppLedger('实收税银', b.fiscal.actualRevenue, '缴纳 ' + pctValue(b.fiscal.compliance)) +
        ppLedger('民心', firstValue(b.data.minxinLocal, r && r.mood), '地方读数') +
        ppLedger('贪腐', firstValue(b.data.corruptionLocal, b.data.corruption), '截留 ' + pctValue(b.fiscal.skimmingRate)) +
        ppLedger('驿路', objectValue(b.data.economyBase, ['roadQuality']), '驿站 ' + ppValue(objectValue(b.data.economyBase, ['postRelays']))) +
        ppLedger('灾异', firstValue(b.data.recentDisasters, objectValue(b.data.economyBase, ['disasterRecord']), '未见大灾'), '近期记录') +
        ppLedger('威胁', firstValue(b.data.threats, r && r.issue), '可入近事') +
      '</div>',
      ppDevTriplet(r),
      '<div class="pp-seal-grid wide">' + [
        ppStatusSeal('mood', '民情', r),
        ppStatusSeal('tax', '财赋', r),
        ppStatusSeal('army', '军务', r),
        ppStatusSeal('office', '官守', r),
        ppStatusSeal('owner', '势力', r)
      ].join('') + '</div>',
      ppIdChain(r),
      ppZone('地形 · 户口', [
        ['地势', firstValue(b.data.terrain, r && r.terrain)],
        ['总口', firstValue(b.data.population, b.pop.mouths, r && r.population)],
        ['黄册户', b.pop.households],
        ['丁口', b.pop.ding],
        ['逃户', b.pop.fugitives],
        ['隐户', b.pop.hiddenCount],
        ['承载上限', b.data.carryingCapacity],
        ['保甲', b.data.baojia],
        ['性别 / 年龄', [b.data.byGender, b.data.byAge].filter(Boolean).map(ppValue).join(' / ')],
        ['族群 / 信仰', [b.data.byEthnicity, b.data.byFaith].filter(Boolean).map(ppValue).join(' / ')]
      ]),
      ppZone('财赋 · 库藏', [
        ['应征', b.fiscal.claimedRevenue],
        ['实征', b.fiscal.actualRevenue],
        ['起运中枢', b.fiscal.remittedToCenter],
        ['留用地方', b.fiscal.retainedBudget],
        ['合规率', pctValue(b.fiscal.compliance)],
        ['截留率', pctValue(b.fiscal.skimmingRate)],
        ['地方银', b.treasury.money],
        ['地方粮', b.treasury.grain],
        ['地方布', b.treasury.cloth],
        ['税级', b.data.taxLevel]
      ]),
      ppZone('军务 · 城防', [
        ['驻军', firstValue(r && r.troops, b.data.garrison, b.army.troops)],
        ['军压', firstValue(r && r.armyPressure, b.data.armyPressure)],
        ['城防', firstValue(b.data.fortification, b.army.fortification)],
        ['主将', firstValue(b.data.commander, b.army.commander)],
        ['边警', firstValue(b.data.borderRisk, b.data.warRisk)],
        ['补给', firstValue(b.data.supply, b.army.supply)],
        ['商路', b.data.tradeRoutes],
        ['战略价值', b.data.strategicValue]
      ]),
      ppZone('官守 · 治理', [
        ['主官', firstValue(b.data.governor, b.data.official)],
        ['官职', b.data.officialPosition],
        ['官缺', firstValue(b.data.officeVacancy, b.data.vacancy)],
        ['腐败', firstValue(b.data.corruptionLocal, b.data.corruption)],
        ['执行', firstValue(b.data.policyExecution, b.data.execution)],
        ['地方派系', firstValue(b.data.localFaction, b.data.party)],
        ['士绅', b.data.leadingGentry],
        ['书院', b.data.academies]
      ]),
      ppZone('势力 · 归属', [
        ['当前控制', ownerName(r)],
        ['势力键', ownerKey(r)],
        ['法理归属', firstValue(b.data.dejureOwner, ownerName(r))],
        ['核心/边缘', firstValue(b.data.coreStatus, b.data.borderStatus)],
        ['下辖子区', children.length ? children.map(function(x){ return ppValue(x.name || x.title || x); }).join('、') : '未细分'],
        ['标签', tagList.length ? tagList.join('、') : '未记']
      ]),
      ppFacilities(r),
      ppFieldChips([
        ['资源', firstValue(b.data.specialResources, r && r.resources)],
        ['文化', b.data.specialCulture],
        ['聚落', b.data.bySettlement],
        ['贸易', b.data.tradeRoutes],
        ['灾异', b.data.recentDisasters],
        ['威胁', b.data.threats],
        ['地方士林', b.data.leadingGentry],
        ['书院', b.data.academies],
        ['宗教场所', b.data.religiousSites]
      ]),
      ppAdminExtra(r),
      '<div class="pp-action-row wide">' +
        '<button type="button" class="pp-action" data-pp-action="map">行政区划</button>' +
        '<button type="button" class="pp-action" data-pp-action="issue">转奏档</button>' +
        '<button type="button" class="pp-action" data-pp-action="records">入史官</button>' +
      '</div>'
    ].join('');
  }

  function ensureMapPpop(){
    var pop = document.getElementById('ppop');
    if (!pop) {
      pop = document.createElement('div');
      pop.id = 'ppop';
      document.body.appendChild(pop);
    }
    if (!pop.__phase8MapBound) {
      pop.__phase8MapBound = true;
      pop.addEventListener('click', function(e){
        var close = e.target && e.target.closest ? e.target.closest('[data-pp-close]') : null;
        if (close) {
          closeMapDossier();
          return;
        }
        var tab = e.target && e.target.closest ? e.target.closest('[data-pp-tab]') : null;
        if (tab) {
          var value = tab.dataset.ppTab || 'overview';
          if (pop.dataset.panelKind === 'faction') {
            state.mapFactionTab = value;
          } else {
            state.mapPanelTab = value;
            if (MAP_MODE_META[value] && value !== 'overview') {
              state.mapMode = value;
              updateMapChrome();
              renderFormalMap();
            }
          }
          refreshMapPpop();
          return;
        }
        var action = e.target && e.target.closest ? e.target.closest('[data-pp-action]') : null;
        if (action) {
          var kind = action.dataset.ppAction;
          if (kind === 'map') openPanel('map');
          else if (kind === 'issue') openPanel('issue');
          else if (kind === 'records') openModule('records');
          else if (kind === 'finance') openPanel('finance');
        }
      });
    }
    return pop;
  }

  function markSelectedRegion(id){
    document.querySelectorAll('.tmf-region.selected').forEach(function(x){ x.classList.remove('selected'); });
    if (!id) return;
    var el = document.querySelector('.tmf-region[data-region-id="' + cssEscape(id) + '"]');
    if (el) el.classList.add('selected');
  }

  function closeMapDossier(){
    var old = document.getElementById('tmf-map-dossier');
    if (old) old.remove();
    var pop = document.getElementById('ppop');
    if (pop) {
      pop.classList.remove('show', 'region-panel', 'faction-panel');
      pop.removeAttribute('data-region-id');
      pop.removeAttribute('data-faction-key');
      pop.removeAttribute('data-panel-kind');
    }
    document.body.classList.remove('province-panel-open');
  }

  function openRegionDossier(r){
    if (!r) return;
    var id = String(r.id || r.name || r.title || '');
    state.mapPanelTab = state.mapPanelTab || 'overview';
    var active = MAP_MODE_META[state.mapPanelTab] ? state.mapPanelTab : 'overview';
    var pop = ensureMapPpop();
    pop.dataset.panelKind = 'region';
    pop.dataset.regionId = id;
    pop.className = 'tmf-map-ppop region-panel show';
    pop.innerHTML =
      '<div class="pp-top"><div class="pp-crest">' + esc(regionTitle(r).slice(0, 1)) + '</div><div class="pp-title-wrap"><div class="pp-name">' + esc(regionTitle(r)) + '</div><div class="pp-level">' + esc(regionLevel(r)) + '</div></div><span class="pp-top-mark">掌印</span><button type="button" class="pp-close" data-pp-close="1">×</button></div>' +
      '<div class="pp-tabs">' + ppTabButtons('region', active) + '</div>' +
      '<div class="pp-tab-body">' + ppRegionTabDetail(r, active) + '</div>' +
      '<div class="pp-grid">' + ppRegionGridV2(r, active) + '</div>';
    document.body.classList.add('province-panel-open');
    markSelectedRegion(id);
  }

  function factionRegions(key){
    var map = getMapData() || {};
    var f = findFaction(key);
    return (map.regions || []).filter(function(r){ return factionOwnsRegion(r, key, f); });
  }

  function factionPanelRows(f, key, region){
    var regions = factionRegions(key);
    return [
      ppZone('势力 · 总览', [
        ['首脑', firstValue(f.leader, f.leaderName, f.ruler, f.scenarioFactionName)],
        ['都城/核心', firstValue(f.capital, f.home, region && regionTitle(region))],
        ['政体', firstValue(f.government, f.type, f.factionType)],
        ['控制地块', regions.length ? regions.length + ' 块' : '未记'],
        ['对朝态度', firstValue(f.attitude, f.playerRelation, f.relation)],
        ['长期目标', firstValue(f.goal, f.longTermStrategy, f.agenda)]
      ]),
      ppZone('军务 · 财赋', [
        ['军力', firstValue(f.militaryStrength, f.strength, f.army, f.score)],
        ['经济', firstValue(f.economy, f.wealth, f.finance)],
        ['粮饷', firstValue(f.supply, f.grain, f.pay)],
        ['动员', firstValue(f.mobilization, f.manpower)],
        ['风险', firstValue(f.risk, f.risks)],
        ['近事', firstValue(f.recentEvent, f.lastEvent, f.note)]
      ]),
      '<section class="pp-zone wide"><div class="pp-zt">所属地块</div><div class="tmf-region-links">' + (regions.length ? regions.map(function(r){
        return '<button type="button" onclick="TMPhase8FormalBridge.openRegionById(\'' + attr(r.id || r.name || r.title || '') + '\')">' + esc(regionTitle(r)) + '</button>';
      }).join('') : '<span>暂无可读取地块</span>') + '</div></section>',
      '<div class="pp-action-row wide">' +
        '<button type="button" class="pp-action" data-pp-action="map">回到舆图</button>' +
        '<button type="button" class="pp-action" data-pp-action="issue">转御案</button>' +
        '<button type="button" class="pp-action" data-pp-action="finance">财赋面板</button>' +
      '</div>'
    ].join('');
  }

  function sumFactionValues(regions, pick){
    return regions.reduce(function(sum, r){
      var value = Number(pick(regionBundle(r), r));
      return sum + (isFinite(value) ? value : 0);
    }, 0);
  }

  function factionRegionTokens(r){
    var b = regionBundle(r);
    return factionTokens(null, ownerKey(r), firstValue(r && r.factionName, r && r.ownerName, b.data.factionName, b.data.ownerName, b.data.dejureOwner));
  }

  function factionOwnsRegion(r, key, f){
    var ft = factionTokens(f, key, f && (f.label || f.name || f.scenarioFactionName));
    var rt = factionRegionTokens(r);
    return rt.some(function(x){ return ft.indexOf(x) >= 0; });
  }

  function factionControlledRegions(key, f){
    var map = getMapData() || {};
    return (map.regions || []).filter(function(r){ return factionOwnsRegion(r, key, f); });
  }

  function avgFactionValue(regions, pick){
    var vals = regions.map(function(r){ return Number(pick(regionBundle(r), r)); }).filter(function(n){ return isFinite(n); });
    if (!vals.length) return '';
    return Math.round(vals.reduce(function(a, b){ return a + b; }, 0) / vals.length);
  }

  function factionProfile(f, key, region){
    f = f || {};
    key = key || f.stableOwnerKey || f.mapFactionId || f.id || '';
    var regions = factionControlledRegions(key, f);
    var sample = region || regions[0] || null;
    var pop = sumFactionValues(regions, function(b, r){ return firstValue(b.data.population, b.pop.mouths, r && r.population, 0); });
    var revenue = sumFactionValues(regions, function(b){ return firstValue(b.fiscal.actualRevenue, 0); });
    var grain = sumFactionValues(regions, function(b){ return firstValue(b.treasury.grain, 0); });
    var troops = sumFactionValues(regions, function(b, r){ return firstValue(r && r.troops, b.data.garrison, b.army.troops, 0); }) || Number(firstValue(f.militaryStrength, f.strength, 0));
    var avgMood = avgFactionValue(regions, function(b, r){ return firstValue(b.data.minxinLocal, r && r.mood); });
    var avgCorr = avgFactionValue(regions, function(b){ return firstValue(b.data.corruptionLocal, b.data.corruption); });
    var threats = [];
    var resources = [];
    regions.forEach(function(r){
      var b = regionBundle(r);
      [b.data.threats, b.data.tradeRoutes].forEach(function(v){
        if (Array.isArray(v)) v.forEach(function(x){ if (x && threats.indexOf(x) < 0) threats.push(x); });
        else if (v && threats.indexOf(v) < 0) threats.push(v);
      });
      [b.data.specialResources, r && r.resources].forEach(function(v){
        if (Array.isArray(v)) v.forEach(function(x){ if (x && resources.indexOf(x) < 0) resources.push(x); });
        else if (v && resources.indexOf(v) < 0) resources.push(v);
      });
    });
    return { f: f, key: key, regions: regions, sample: sample, pop: pop, revenue: revenue, grain: grain, troops: troops, avgMood: avgMood, avgCorr: avgCorr, threats: threats, resources: resources };
  }

  function factionLeaderCards(f){
    var rows = [];
    function push(title, person){
      if (!person) return;
      var text = typeof person === 'object' ? firstValue(person.name, person.ruler, person.general, person.chancellor, ppValue(person)) : person;
      var meta = typeof person === 'object' ? [person.title, person.role, person.age, person.personality, person.bio].filter(Boolean).join(' / ') : '';
      rows.push('<div class="pp-faction-person"><b>' + esc(title + ' · ' + ppValue(text)) + '</b><span>' + esc(meta || ppValue(person)) + '</span></div>');
    }
    push('君主', f.leaderInfo || f.leader || f.ruler);
    push('继嗣', f.heirInfo || f.heir);
    if (f.leadership && typeof f.leadership === 'object') {
      Object.keys(f.leadership).slice(0, 4).forEach(function(k){ push(fieldLabel(k), f.leadership[k]); });
    }
    return rows.length ? '<div class="pp-faction-portrait-row wide">' + rows.join('') + '</div>' : '';
  }

  function factionTabDetail(f, key, region, active){
    var p = factionProfile(f, key, region);
    var name = firstValue(f.label, f.name, f.scenarioFactionName, p.sample && ownerName(p.sample), key);
    var territoryRows = p.regions.map(function(r){
      var b = regionBundle(r);
      return [regionTitle(r), firstValue(b.data.population, b.pop.mouths, r.population), [firstValue(b.data.officialPosition, b.data.governor, '地块'), firstValue(b.data.terrain, r.terrain), firstValue(b.data.strategicValue, '')].filter(Boolean).join(' · ')];
    });
    var tab = MAP_FACTION_TABS.some(function(t){ return t[0] === active; }) ? active : 'overview';
    var hero = '<section class="pp-faction-hero wide"><div class="pp-faction-head"><div class="pp-faction-seal"><b>' + esc(shortText(f.short || name, 2)) + '</b><span>' + esc(firstValue(f.leaderTitle, f.type, '势力')) + '</span></div><div><div class="pp-faction-title"><span>' + esc(name) + '</span><small>' + esc(firstValue(f.stableOwnerKey, key, f.mapFactionId, f.runtimeFactionId)) + '</small></div><p class="pp-faction-desc">' + esc(firstValue(f.description, f.desc, f.note, '此势力档案合并地图归属与运行态势力数据；AI 推演改写 GM/P 势力后，此处会随刷新同步。')) + '</p><div class="pp-badge-row">' + [firstValue(f.type, f.factionType), firstValue(f.leaderTitle, f.rank), firstValue(f.attitude, f.playerRelation), '领地 ' + p.regions.length].filter(Boolean).map(function(x, i){ return '<span class="' + (i === 0 ? 'good' : '') + '">' + esc(ppValue(x)) + '</span>'; }).join('') + '</div></div></div></section>';
    var ledger = '<div class="pp-ledger-grid wide">' +
      ppLedger('首脑', firstValue(f.leader, f.leaderName, f.ruler, f.scenarioFactionName), '运行态势力字段') +
      ppLedger('首府', firstValue(f.capital, f.home, p.sample && regionTitle(p.sample)), '政治中心') +
      ppLedger('控制地块', p.regions.length + ' 块', p.regions.slice(0, 3).map(regionTitle).join('、')) +
      ppLedger('总人口', firstValue(f.population, p.pop), '势力/地块聚合') +
      ppLedger('总兵力', p.troops, '势力/地块聚合') +
      ppLedger('实收财赋', p.revenue, '所辖地块合计') +
      ppLedger('粮储', p.grain, '所辖地块合计') +
      ppLedger('平均民心', p.avgMood, '所辖地块均值') +
      ppLedger('平均腐败', p.avgCorr, '所辖地块均值') +
    '</div>';
    if (tab === 'overview') {
      return '<div class="pp-tab-detail">' + hero + ledger + factionLeaderCards(f) + ppZone('势力总览', [
        ['政体 / 组织', firstValue(f.government, f.type, f.factionType)],
        ['首领', firstValue(f.leader, f.leaderName, f.ruler)],
        ['称号', firstValue(f.leaderTitle, f.rank)],
        ['首府', firstValue(f.capital, f.home, p.sample && regionTitle(p.sample))],
        ['战略目标', firstValue(f.goal, f.strategy, f.longTermStrategy)],
        ['意识形态', firstValue(f.ideology, f.mainstream)],
        ['文化', f.culture],
        ['成员', f.members],
        ['开局问题', f.openingProblems]
      ], true) + '</div>';
    }
    if (tab === 'territory') {
      return '<div class="pp-tab-detail">' + ledger + ppFieldChips([['剧本领土', f.territory], ['资源', firstValue(f.resources, f.mainResources, p.resources)], ['威胁/商路', p.threats], ['地图编号', f.mapFactionId], ['运行态编号', f.runtimeFactionId]]) + ppTableRows(territoryRows.length ? territoryRows : [['暂无地块', '0', '当前地图未找到归属地块']]) + '</div>';
    }
    if (tab === 'military') {
      return '<div class="pp-tab-detail">' + ppZone('军务与战略', [
        ['总兵力', firstValue(f.militaryStrength, p.troops)],
        ['军力构成', f.militaryBreakdown],
        ['战争状态', f.warState],
        ['动员', firstValue(f.mobilization, f.manpower)],
        ['战略优先', f.strategicPriorities],
        ['决策提示', firstValue(f.decisionHints, f.npcDecisionHints)],
        ['禁忌动作', f.tabooMoves],
        ['地缘威胁', p.threats]
      ], true) + '</div>';
    }
    if (tab === 'finance') {
      return '<div class="pp-tab-detail">' + ledger + ppZone('财赋与国力', [
        ['经济', firstValue(f.economy, f.wealth, p.revenue)],
        ['库藏', firstValue(f.treasury, p.revenue)],
        ['经济结构', f.economicStructure],
        ['经济政策', f.economicPolicy],
        ['公共舆情', f.publicOpinion],
        ['科技', f.techLevel],
        ['文教', f.cultureLevel],
        ['继承', f.succession]
      ], true) + ppFieldChips([['凝聚', f.cohesion], ['优势', f.strengths], ['弱点', f.weaknesses], ['资源', firstValue(f.resources, f.mainResources, p.resources)]]) + '</div>';
    }
    if (tab === 'relations') {
      return '<div class="pp-tab-detail">' + ppTableRows([
        ['关系', f.relations, '外交'],
        ['盟友', f.allies, '阵营'],
        ['敌对', f.enemies, '敌情'],
        ['中立', f.neutrals, '外交'],
        ['态度', firstValue(f.attitudeDetail, f.attitude), '立场'],
        ['玩家关系', f.playerRelation, '关系值'],
        ['冒犯阈值', f.offendThresholds, '风险'],
        ['内部派系', f.internalParties, '内政'],
        ['党派关系', f.partyRelations, '内政'],
        ['已知间谍', f.knownSpies, '情报']
      ]) + '</div>';
    }
    return '<div class="pp-tab-detail">' + ppTableRows([
      ['势力叙事', firstValue(f.description, f.desc), '设定'],
      ['历史脉络', f.history, '设定'],
      ['历史事件', f.historicalEvents, '年表'],
      ['AI 画像', f.aiProfile, '推演'],
      ['长期战略', f.longTermStrategy, '方略'],
      ['胜利条件', f.victoryConditions, '目标'],
      ['失败条件', f.defeatConditions, '败局'],
      ['地图势力编号', f.mapFactionId, '数据链'],
      ['运行态编号', f.runtimeFactionId, '数据链']
    ]) + '</div>';
  }

  function factionPanelRowsV2(f, key, region){
    var regions = factionRegions(key);
    var sample = region || regions[0] || null;
    var pop = sumFactionValues(regions, function(b, r){ return firstValue(b.data.population, b.pop.mouths, r && r.population, 0); });
    var revenue = sumFactionValues(regions, function(b){ return firstValue(b.fiscal.actualRevenue, 0); });
    var grain = sumFactionValues(regions, function(b){ return firstValue(b.treasury.grain, 0); });
    var troops = sumFactionValues(regions, function(b, r){ return firstValue(r && r.troops, b.data.garrison, b.army.troops, 0); }) || Number(firstValue(f.militaryStrength, f.strength, 0));
    var name = firstValue(f.label, f.name, f.scenarioFactionName, sample && ownerName(sample), key);
    var territoryRows = regions.map(function(r){
      var b = regionBundle(r);
      return [
        regionTitle(r),
        firstValue(b.data.population, b.pop.mouths, r.population),
        [firstValue(b.data.officialPosition, b.data.governor, '地块'), firstValue(b.data.terrain, r.terrain), firstValue(b.data.strategicValue, '')].filter(Boolean).join(' · ')
      ];
    });
    return [
      '<section class="pp-faction-hero wide"><div class="pp-faction-head"><div class="pp-faction-seal"><b>' + esc(shortText(f.short || name, 2)) + '</b><span>' + esc(firstValue(f.leaderTitle, f.type, '势力')) + '</span></div><div><div class="pp-faction-title"><span>' + esc(name) + '</span><small>' + esc(firstValue(key, f.id, f.sid)) + '</small></div><p class="pp-faction-desc">' + esc(firstValue(f.description, f.desc, f.note, '该势力档案来自当前剧本/运行时势力数据，会随地块归属和剧本设定变化。')) + '</p><div class="pp-badge-row">' + [firstValue(f.type, f.factionType), firstValue(f.leaderTitle, f.rank), firstValue(f.attitude, f.playerRelation), '领地 ' + regions.length].filter(Boolean).map(function(x, i){ return '<span class="' + (i === 0 ? 'good' : '') + '">' + esc(ppValue(x)) + '</span>'; }).join('') + '</div></div></div></section>',
      '<div class="pp-ledger-grid wide">' +
        ppLedger('首脑', firstValue(f.leader, f.leaderName, f.ruler, f.scenarioFactionName), '势力首领') +
        ppLedger('首府', firstValue(f.capital, f.home, sample && regionTitle(sample)), '政治中心') +
        ppLedger('控制地块', regions.length + ' 块', regions.slice(0, 3).map(regionTitle).join('、')) +
        ppLedger('总人口', firstValue(f.population, pop), '剧本/地块聚合') +
        ppLedger('总兵力', troops, '剧本/地块聚合') +
        ppLedger('国势', firstValue(f.strength, f.score), '综合实力') +
        ppLedger('府库', firstValue(f.treasury, revenue), '银粮布马') +
        ppLedger('经济', firstValue(f.economy, revenue), '经济基础') +
        ppLedger('粮储', grain, '地块府库合计') +
      '</div>',
      ppFieldChips([
        ['目标', firstValue(f.goal, f.strategy, f.longTermStrategy)],
        ['资源', firstValue(f.resources, f.mainResources)],
        ['意识', firstValue(f.ideology, f.mainstream)],
        ['文化', f.culture],
        ['性格', f.personality],
        ['领土', f.territory],
        ['优势', f.strengths],
        ['弱点', f.weaknesses]
      ]),
      ppZone('势力 · 总览', [
        ['首脑', firstValue(f.leader, f.leaderName, f.ruler, f.scenarioFactionName)],
        ['称号', firstValue(f.leaderTitle, f.rank)],
        ['政体', firstValue(f.government, f.type, f.factionType)],
        ['首府/核心', firstValue(f.capital, f.home, sample && regionTitle(sample))],
        ['对朝态度', firstValue(f.attitude, f.playerRelation, f.relation)],
        ['长期目标', firstValue(f.goal, f.longTermStrategy, f.agenda)]
      ]),
      ppZone('军务 · 财赋', [
        ['军力', firstValue(f.militaryStrength, f.strength, f.army, troops)],
        ['军力分解', f.militaryBreakdown],
        ['战争状态', f.warState],
        ['经济', firstValue(f.economy, f.wealth, revenue)],
        ['经济结构', f.economicStructure],
        ['府库', firstValue(f.treasury, revenue)],
        ['动员', firstValue(f.mobilization, f.manpower)],
        ['风险', firstValue(f.openingProblems, f.risk, f.risks)]
      ]),
      ppZone('内政 · 凝聚', [
        ['朝廷影响', f.courtInfluence],
        ['民间影响', f.popularInfluence],
        ['威望', f.prestige],
        ['凝聚', f.cohesion],
        ['继承', f.succession],
        ['科技', f.techLevel],
        ['文化水平', f.cultureLevel],
        ['舆情', f.publicOpinion]
      ]),
      ppZone('外交 · 暗线', [
        ['关系', f.relations],
        ['盟友', f.allies],
        ['敌对', f.enemies],
        ['中立', f.neutrals],
        ['冒犯阈值', f.offendThresholds],
        ['已知间谍', f.knownSpies],
        ['内部党派', f.internalParties],
        ['党派关系', f.partyRelations]
      ]),
      '<div class="pp-section-strip wide">所属地块</div>',
      ppTableRows(territoryRows.length ? territoryRows : [['暂无地块', '0', '当前地图没有可读取地块']]),
      '<div class="pp-section-strip wide">史料与推演</div>',
      ppTableRows([
        ['势力叙事', firstValue(f.description, f.desc), '设定'],
        ['历史脉络', f.history, '设定'],
        ['历史事件', f.historicalEvents, '年表'],
        ['AI 姿态', f.aiProfile, '推演'],
        ['决策提示', firstValue(f.decisionHints, f.npcDecisionHints), '推演'],
        ['禁忌动作', f.tabooMoves, '风险'],
        ['胜利条件', f.victoryConditions, '目标'],
        ['失败条件', f.defeatConditions, '败局']
      ]),
      '<div class="pp-action-row wide">' +
        '<button type="button" class="pp-action" data-pp-action="map">回到舆图</button>' +
        '<button type="button" class="pp-action" data-pp-action="issue">转奏档</button>' +
        '<button type="button" class="pp-action" data-pp-action="finance">财赋面板</button>' +
      '</div>'
    ].join('');
  }

  function factionSupplementRows(f, key, region, active){
    var p = factionProfile(f || {}, key, region);
    var regions = p.regions || [];
    return [
      ppFieldChips([
        ['运行来源', f.runtimeFactionId ? 'GM/P 势力对象' : '地图势力档案'],
        ['稳定归属键', firstValue(f.stableOwnerKey, f.mapFactionId, key)],
        ['运行态编号', f.runtimeFactionId],
        ['当前标签', active],
        ['AI 可改字段', '目标、关系、军力、经济、库藏、策略、舆情、内部派系、地块归属']
      ]),
      ppZone('推演读写账本', [
        ['地图对象', 'GM.mapData / P.map / P.mapData 已统一引用'],
        ['势力对象', f.runtimeFactionId ? '已合并运行态势力' : '未找到运行态，使用地图档案'],
        ['归属重绘', '归属键改变后重绘地图颜色与天下势力名'],
        ['保存路径', '存档写入 GM._savedMapData，读档后回绑到 GM/P'],
        ['地块数', regions.length + ' 块']
      ], true),
      '<section class="pp-zone wide"><div class="pp-zt">所辖地块</div><div class="tmf-region-links">' + (regions.length ? regions.map(function(r){
        return '<button type="button" onclick="TMPhase8FormalBridge.openRegionById(\'' + attr(r.id || r.name || r.title || '') + '\')">' + esc(regionTitle(r)) + '</button>';
      }).join('') : '<span>当前地图没有读取到所辖地块</span>') + '</div></section>',
      '<div class="pp-action-row wide">' +
        '<button type="button" class="pp-action" data-pp-action="map">回到舆图</button>' +
        '<button type="button" class="pp-action" data-pp-action="issue">转御案</button>' +
        '<button type="button" class="pp-action" data-pp-action="finance">财赋面板</button>' +
      '</div>'
    ].join('');
  }

  function openFactionDossier(key, region){
    var map = getMapData() || {};
    var f = findFaction(key, region && (region.factionName || region.ownerName)) || {};
    var r = region || ((map.regions || []).find(function(x){ return ownerKey(x) === key; }) || null);
    key = key || (r && ownerKey(r)) || '';
    var name = firstValue(f.label, f.name, f.scenarioFactionName, r && ownerName(r), key, '未名势力');
    state.mapFactionTab = state.mapFactionTab || 'overview';
    var active = MAP_FACTION_TABS.some(function(t){ return t[0] === state.mapFactionTab; }) ? state.mapFactionTab : 'overview';
    var pop = ensureMapPpop();
    pop.dataset.panelKind = 'faction';
    pop.dataset.factionKey = key;
    pop.className = 'tmf-map-ppop faction-panel show';
    pop.innerHTML =
      '<div class="pp-top"><div class="pp-crest">' + esc(shortText(f.short || name, 2)) + '</div><div class="pp-title-wrap"><div class="pp-name">' + esc(name) + '</div><div class="pp-level">' + esc(firstValue(f.type, f.factionType, '势力档案')) + '</div></div><span class="pp-top-mark">势力</span><button type="button" class="pp-close" data-pp-close="1">×</button></div>' +
      '<div class="pp-tabs">' + ppTabButtons('faction', active) + '</div>' +
      '<div class="pp-tab-body">' + factionTabDetail(f, key, r, active) + '</div>' +
      '<div class="pp-tab-body"><div class="pp-faction-hero"><div class="pp-mode-seal">势</div><div><b>' + esc(firstValue(f.rank, f.type, '势力')) + '</b><p class="pp-faction-desc">' + esc(firstValue(f.note, f.description, f.desc, '该势力档案来自当前剧本/运行时势力数据，会随地块归属和剧本设定变化。')) + '</p></div></div></div>' +
      '<div class="pp-grid">' + factionSupplementRows(f, key, r, active) + '</div>';
    document.body.classList.add('province-panel-open');
  }

  function refreshMapPpop(){
    var pop = document.getElementById('ppop');
    if (!pop || !pop.classList.contains('show')) return;
    if (pop.dataset.panelKind === 'faction') {
      openFactionDossier(pop.dataset.factionKey || '');
      return;
    }
    var r = findRegion(pop.dataset.regionId || '');
    if (r) openRegionDossier(r);
  }

  function refreshMapFromRuntime(){
    getMapData();
    renderFormalMapSoon();
    setTimeout(refreshMapPpop, 0);
  }

  function installMapRefreshHooks(){
    if (state.mapRefreshHooksInstalled) return;
    state.mapRefreshHooksInstalled = true;
    ['tm-map-changed','tm:map-changed','tm-state-updated','tm:state-updated','tm-save-loaded','tm:save-loaded','tm-endturn-done','tm:endturn:done','tm:endturn:complete'].forEach(function(name){
      window.addEventListener(name, refreshMapFromRuntime);
      document.addEventListener(name, refreshMapFromRuntime);
    });
    if (window.EndTurnHooks && typeof EndTurnHooks.register === 'function') {
      try { EndTurnHooks.register('after', refreshMapFromRuntime, 'phase8-formal-map-refresh'); } catch(_) {}
    }
  }

  function renderMapAlerts(map){
    var host = document.querySelector('#mapwrap .map-alert-strip');
    if (!host) return;
    var issues = [];
    try { issues = typeof getIssues === 'function' ? getIssues() : []; } catch(_) { issues = []; }
    var urgent = issues.filter(function(x){ return x && String(x.status || 'pending') !== 'done'; }).slice(0, 2);
    var buttons = urgent.map(function(x, i){
      return '<button type="button" class="map-alert ' + (i === 0 ? 'hot' : '') + '" onclick="TMPhase8FormalBridge.openModule(\'memorial\')" title="' + attr(x.title || '') + '">' + esc(shortText(x.title || '待批奏疏', 10)) + '</button>';
    });
    if (buttons.length < 2) buttons.push('<button type="button" class="map-alert" onclick="TMPhase8FormalBridge.openPanel(\'issue\')">朝议待核</button>');
    buttons.push('<button type="button" class="map-alert ok" onclick="TMPhase8FormalBridge.openPanel(\'finance\')">财赋入库</button>');
    host.innerHTML = buttons.slice(0, 3).join('');
    var hint = document.getElementById('tmf-map-hint');
    if (hint) {
      var count = map && Array.isArray(map.regions) ? map.regions.length : 0;
      hint.textContent = mapScaleNote() + ' · ' + mapModeNote() + ' · ' + count + ' 地块 · 点击地块查看档案，右键查看势力。';
    }
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

  function closeModule(){
    var old = document.getElementById('tmf-module-overlay');
    if (old) old.remove();
  }

  function moduleShell(kind, title, sub, left, main, right){
    return '<section class="tmf-module tmf-module-' + esc(kind) + '" role="dialog" aria-label="' + esc(title) + '">' +
      '<header><div><span>Phase 8 · 正式界面</span><h2>' + esc(title) + '</h2><p>' + esc(sub || '') + '</p></div><button type="button" data-module-close="1">×</button></header>' +
      '<div class="tmf-module-body">' +
        '<aside class="tmf-module-left">' + left + '</aside>' +
        '<main class="tmf-module-main">' + main + '</main>' +
        '<aside class="tmf-module-right">' + right + '</aside>' +
      '</div>' +
      '</section>';
  }

  function openModule(kind, options){
    clearOfficeStandaloneMode();
    state.activeModule = { kind: kind, options: options || {} };
    closeModule();
    var ov = document.createElement('div');
    ov.id = 'tmf-module-overlay';
    ov.className = 'tmf-module-overlay tmf-module-overlay-' + String(kind || 'generic').replace(/[^\w-]/g, '');
    ov.innerHTML = renderModule(kind, options || {});
    ov.addEventListener('click', function(e){
      if (e.target === ov || (e.target && e.target.dataset && e.target.dataset.moduleClose)) {
        closeModule();
        return;
      }
      var btn = e.target && e.target.closest ? e.target.closest('[data-module-action]') : null;
      if (!btn) return;
      handleModuleAction(btn.dataset.moduleAction, btn.dataset);
    });
    ov.addEventListener('input', function(e){
      if (e.target && e.target.matches && e.target.matches('[data-renwu-search]')) filterRenwuOverlay(ov);
    });
    ov.addEventListener('keyup', function(e){
      if (e.target && e.target.matches && e.target.matches('[data-renwu-search]')) filterRenwuOverlay(ov);
    });
    ov.addEventListener('compositionend', function(e){
      if (e.target && e.target.matches && e.target.matches('[data-renwu-search]')) filterRenwuOverlay(ov);
    });
    ov.addEventListener('change', function(e){
      if (e.target && e.target.matches && e.target.matches('[data-renwu-filter]')) filterRenwuOverlay(ov);
    });
    document.body.appendChild(ov);
    if (ov.querySelector('[data-renwu-card]')) filterRenwuOverlay(ov);
    if (kind === 'renwu') restoreRenwuRosterScroll(ov);
  }

  function rerenderModule(options){
    if (!state.activeModule) return;
    if (state.activeModule.kind === 'renwu' && !(options && options.skipRenwuScrollRemember)) rememberRenwuRosterScroll();
    openModule(state.activeModule.kind, state.activeModule.options || {});
  }

  function handleModuleAction(action, data){
    if (action === 'add-edict') {
      var issue = getIssues().find(function(x){ return String(x.id) === String(data.id || ''); });
      if (!issue) return;
      state.edictDraft = state.edictDraft || [];
      state.edictDraft.push('就“' + issue.title + '”，着有关衙门会同详议，限期具奏。');
      rerenderModule();
    } else if (action === 'clear-edict') {
      state.edictDraft = [];
      rerenderModule();
    } else if (action === 'issue-done') {
      toast('已记录裁断：' + (data.id || '议题'));
    } else if (action === 'select-issue') {
      state.shizhengIssue = data.id || '';
      rerenderModule();
    } else if (action === 'shizheng-old' || action === 'shizheng-refresh') {
      rerenderModule();
    } else if (action === 'shizheng-choice') {
      if (typeof window._chooseIssueOption === 'function') {
        window._chooseIssueOption(data.id || '', Number(data.choice || 0));
        state.shizhengIssue = data.id || state.shizhengIssue || '';
        setTimeout(function(){
          rerenderModule();
          renderEventFeed();
        }, 0);
      } else {
        toast('裁断流程未加载');
      }
    } else if (action === 'shizheng-convene') {
      closeModule();
      if (typeof window._shizhengConvene === 'function') window._shizhengConvene(data.id || '');
      else if (typeof window.openChaoyi === 'function') window.openChaoyi();
      else openModule('chaoyi', { mode: 'tingyi' });
    } else if (action === 'shizheng-secret') {
      closeModule();
      if (typeof window._shizhengSecret === 'function') window._shizhengSecret(data.id || '');
      else if (typeof window.openMiZhaoPicker === 'function') window.openMiZhaoPicker(data.id || '');
      else openModule('wendui');
    } else if (action === 'select-person') {
      state.modulePerson = data.id || '';
      if (refreshRenwuSelection()) return;
      rerenderModule();
    } else if (action === 'pin-person') {
      pinPerson(data.id, true);
      rerenderModule();
    } else if (action === 'renwu-tab') {
      state.renwuTab = data.tab || 'overview';
      if (refreshRenwuSelection()) return;
      rerenderModule();
    } else if (action === 'renwu-reset') {
      state.renwuFilters = { q: '', group: 'all', faction: 'all', status: 'all', showDead: false };
      state.renwuRosterScroll = 0;
      rerenderModule({ skipRenwuScrollRemember: true });
    } else if (action === 'renwu-person-action') {
      if (window.TMPhase8FormalBridge && typeof window.TMPhase8FormalBridge.personAction === 'function') {
        window.TMPhase8FormalBridge.personAction(data.id, data.personAction || 'detail');
      }
    } else if (action === 'ceming-open') {
      if (window.TM && TM.ceming && typeof TM.ceming.openDialog === 'function') {
        TM.ceming.openDialog();
        var cemingOverlay = document.getElementById('ceming-overlay');
        if (cemingOverlay) cemingOverlay.style.zIndex = '10050';
      } else {
        toast('策名系统未加载');
      }
    } else if (action === 'record-tab') {
      state.recordTab = data.tab || 'shiji';
      rerenderModule();
    } else if (action === 'panel') {
      closeModule();
      openPanel(data.slot || '');
    } else if (action === 'finance-full') {
      openGuoku();
    } else if (action === 'finance-old') {
      rightOpenGuokuLegacyAction(data.method);
    } else if (action === 'toast') {
      toast(data.text || '已记录');
    }
  }

  function renderModule(kind, options){
    if (kind === 'edict') return renderEdictModule();
    if (kind === 'memorial') return renderMemorialModule();
    if (kind === 'letter') return renderLetterModule();
    if (kind === 'records') return renderRecordsModule();
    if (kind === 'renwu') return renderRenwuModule();
    if (kind === 'shizheng') return renderShizhengModule();
    if (kind === 'wendui') return renderWenduiModule();
    if (kind === 'chaoyi') return renderChaoyiModule(options || {});
    if (kind === 'keju') return renderKejuModule();
    if (kind === 'wenshi') return renderWenshiModule();
    if (kind === 'finance') return renderFinanceModule();
    if (kind === 'office') return renderOfficeModule();
    return moduleShell('generic', '国事面板', '正式页 Phase8 原生面板', '', '<p class="tmf-module-note">暂无内容。</p>', '');
  }

  function renderIssueListForEdict(){
    var issues = getIssues();
    return '<h3>议事清册</h3><div class="tmf-module-scroll">' + issues.map(function(x){
      return '<article class="tmf-module-item"><b>' + esc(x.title) + '</b><span>' + esc(x.category) + ' · ' + esc(x.severity) + ' · ' + esc(x.proposer) + '</span><p>' + esc(x.text || '无详情') + '</p><button type="button" data-module-action="add-edict" data-id="' + esc(x.id) + '">纳入</button></article>';
    }).join('') + '</div>';
  }

  function renderEdictModule(){
    var draft = state.edictDraft || [];
    if (!draft.length) draft = ['奉天承运皇帝诏曰：', '诸司各以本职详议急务，毋得互相推诿。'];
    var main = '<h3>御笔草诏</h3><div class="tmf-edict-paper">' + draft.map(function(x){ return '<p>' + esc(x) + '</p>'; }).join('') + '</div>' +
      '<div class="tmf-module-actions"><button type="button" data-module-action="toast" data-text="诏书已暂存">暂存草诏</button><button type="button" data-module-action="toast" data-text="已交内阁票拟">交内阁票拟</button><button type="button" data-module-action="clear-edict">清空草诏</button></div>';
    var right = '<h3>诏令参数</h3>' + miniRows([['类型','政务 / 军务 / 经济 / 司法 / 其他'],['主角行止','亲批、留中、召对、廷议'],['润色','明实录体 / 白话 / 严旨'],['后续','写入近事、史官实录、变量影响']]) +
      '<div class="tmf-module-stack"><button data-module-action="toast" data-text="已切换为经济诏令">经济</button><button data-module-action="toast" data-text="已切换为军务诏令">军务</button><button data-module-action="toast" data-text="已切换为其他诏令">其他</button></div>';
    return moduleShell('edict', '撰写诏书', '正式御案页：议事清册、草诏、类型、主角行止、润色与发布链', renderIssueListForEdict(), main, right);
  }

  function renderMemorialModule(){
    var mems = getMemorials();
    var selected = mems[0] || {};
    var left = '<h3>奏疏待览</h3><div class="tmf-module-scroll">' + mems.map(function(x){
      return '<article class="tmf-module-item"><b>' + esc(x.title) + '</b><span>' + esc(x.from) + ' · ' + esc(x.dept) + ' · ' + esc(x.status) + '</span></article>';
    }).join('') + '</div>';
    var main = '<h3>' + esc(selected.title || '暂无奏疏') + '</h3><div class="tmf-prose">' + esc(selected.text || '暂无正文。') + '</div>' +
      '<div class="tmf-module-actions"><button data-module-action="toast" data-text="已朱批准行">朱批准行</button><button data-module-action="toast" data-text="已留中">留中</button><button data-module-action="panel" data-slot="issue">转朝议</button></div>';
    var right = '<h3>批阅链路</h3>' + miniRows([['来源','奏疏 / 议题 / 近事'],['批复','准行、驳回、留中、转议'],['影响','变量、人物记忆、史官档案'],['待批', mems.length + ' 件']]);
    return moduleShell('memorial', '百官奏疏', '正式页内阅览、筛选、朱批与转议', left, main, right);
  }

  function renderLetterModule(){
    var people = getPeople().slice(0, 18);
    var letters = getLetters();
    var left = '<h3>收发簿</h3><div class="tmf-module-scroll">' + (letters.length ? letters.map(function(x){
      return '<article class="tmf-module-item"><b>' + esc(x.title) + '</b><span>' + esc(x.from) + ' → ' + esc(x.to) + ' · ' + esc(x.status) + '</span><p>' + esc(x.text || '') + '</p></article>';
    }).join('') : '<p class="tmf-module-note">暂无来信。可从右侧选择人物拟信。</p>') + '</div>';
    var main = '<h3>拟写书信</h3><div class="tmf-letter-editor"><input value="密谕" aria-label="书信题名"><textarea aria-label="书信正文">卿在外任，凡地方灾伤、军饷、民情，务须据实具奏，不得粉饰。</textarea></div>' +
      '<div class="tmf-module-actions"><button data-module-action="toast" data-text="已入鸿雁待发">入鸿雁待发</button><button data-module-action="toast" data-text="已存为草稿">存为草稿</button></div>';
    var right = '<h3>收信人</h3><div class="tmf-module-scroll compact">' + people.map(function(p){
      return '<button class="tmf-person-pick" data-module-action="select-person" data-id="' + esc(personKey(p)) + '"><b>' + esc(p.name || personKey(p)) + '</b><span>' + esc(p.office || p.title || p.faction || '') + '</span></button>';
    }).join('') + '</div>';
    return moduleShell('letter', '鸿雁传书', '正式页内收发、拟信、择人、草稿与驿路状态', left, main, right);
  }

  function renderRecordsModule(){
    var tab = state.recordTab || 'shiji';
    var tabs = [['shiji','史记'],['shilu','实录'],['jishi','纪事'],['biannian','编年']];
    var events = collectRecentEvents();
    var left = '<h3>史官实录</h3><div class="tmf-module-tabs">' + tabs.map(function(t){
      return '<button class="' + (tab === t[0] ? 'active' : '') + '" data-module-action="record-tab" data-tab="' + esc(t[0]) + '">' + esc(t[1]) + '</button>';
    }).join('') + '</div>';
    var main = '<h3>' + esc((tabs.find(function(t){ return t[0] === tab; }) || tabs[0])[1]) + '</h3><div class="tmf-module-scroll records">' + events.map(function(x){
      return '<article class="tmf-record-row"><span>T' + esc(x.turn) + '</span><b>' + esc(x.title) + '</b><p>' + esc(x.text || x.time || '') + '</p></article>';
    }).join('') + '</div>';
    var right = '<h3>自动来源</h3>' + miniRows([['御案时政','裁断入档'],['诏书','发布入档'],['奏疏','朱批入档'],['地图','地块事件入档']]);
    return moduleShell('records', '史官实录', '史记、实录、纪事、编年四类在正式页内切换', left, main, right);
  }

  function renderRenwuModuleLegacyV0(){
    var people = getPeople();
    var selected = findPerson(state.modulePerson) || people[0] || {};
    var left = '<h3>人物图志</h3><div class="tmf-module-search"><input placeholder="输入姓名 / 官职 / 派系"></div><div class="tmf-module-scroll">' + people.slice(0, 42).map(function(p){
      var key = personKey(p);
      return '<button class="tmf-renwu-list-row ' + (key === personKey(selected) ? 'active' : '') + '" data-module-action="select-person" data-id="' + esc(key) + '"><b>' + esc(p.name || key) + '</b><span>' + esc(p.office || p.title || p.faction || '') + '</span></button>';
    }).join('') + '</div>';
    var main = '<section class="tmf-renwu-detail"><div class="tmf-renwu-avatar">' + esc((selected.name || '?').slice(0,1)) + '</div><div><h3>' + esc(selected.name || '暂无人物') + '</h3><p>' + esc(selected.title || selected.office || selected.role || '') + '</p><p>' + esc(selected.bio || selected.description || selected.desc || '暂无传略。') + '</p></div></section>' +
      '<h3>能力与字段</h3>' + miniRows([['年龄', selected.age],['所属', selected.faction || selected.group],['忠诚', selected.loyalty || selected.loyal],['野心', selected.ambition],['智谋', selected.intelligence],['行政', selected.administration],['军务', selected.military],['压力', selected.stress]]) +
      '<div class="tmf-module-actions"><button data-module-action="pin-person" data-id="' + esc(personKey(selected)) + '">钉选到“臣”</button><button data-module-action="toast" data-text="已记录问对目标">御前问对</button><button data-module-action="toast" data-text="已转鸿雁草稿">鸿雁传书</button></div>';
    var right = '<h3>人物志职能</h3>' + miniRows([['总人数', people.length + ' 人'],['策名','统一在标题旁入口'],['家谱','字段保留'],['关系','可继续接入关系网']]) +
      '<div class="tmf-module-stack"><button data-module-action="toast" data-text="策名页面待接入">策名</button><button data-module-action="toast" data-text="家谱字段待接入">家谱</button><button data-module-action="toast" data-text="关系网待接入">关系</button></div>';
    return moduleShell('renwu', '人物图志', '正式页内人物索引、详情、字段、钉选与行动入口', left, main, right);
  }

  function tmfRenwuText(v, fallback){
    if (v == null || v === '') return fallback == null ? '未记' : fallback;
    if (Array.isArray(v)) return v.map(function(x){ return tmfRenwuText(x, ''); }).filter(Boolean).join('、') || (fallback == null ? '未记' : fallback);
    if (typeof v === 'object') {
      if (v.text || v.name || v.title || v.desc || v.description) return tmfRenwuText(v.text || v.name || v.title || v.desc || v.description, fallback);
      var parts = [];
      Object.keys(v).forEach(function(k){
        var val = v[k];
        if (val == null || val === '' || typeof val === 'function') return;
        parts.push(tmfRenwuCn(k) + '：' + tmfRenwuText(val, '未记'));
      });
      return parts.join(' · ') || (fallback == null ? '未记' : fallback);
    }
    return tmfRenwuCn(String(v));
  }

  function tmfRenwuCn(v){
    var s = String(v == null ? '' : v);
    var exact = {
      male:'男', female:'女', man:'男', woman:'女',
      true:'是', false:'否', alive:'存世', dead:'已殁',
      court:'在朝', local:'在外', inner:'内廷', outer:'外朝',
      civil:'文臣', military:'武将', official:'官员', scholar:'士人',
      imperial:'皇族', noble:'世家', gentry:'士族', common:'寒门',
      publicPurse:'公库', publicCoffers:'公库', privateWealth:'私产',
      money:'银钱', grain:'粮米', cloth:'布帛', fame:'名望',
      fameValue:'名望', virtueMerit:'贤能', virtue:'贤德',
      health:'健康', stress:'压力', ambition:'野心', loyalty:'忠诚',
      administration:'政务', intelligence:'智谋', militaryAbility:'军务',
      charisma:'魅力', diplomacy:'外交', management:'管理',
      familyTier:'门第', clanPrestige:'族望', familyPrestige:'家望',
      spouseClan:'姻亲', fatherClan:'父族', motherClan:'母族',
      personalGoal:'个人志向', innerThought:'内心独白', stressSources:'压力来源',
      traitIds:'特质', traits:'特质', resources:'资源', relations:'关系',
      impressions:'印象', memories:'记忆', history:'履历', career:'仕途',
      works:'著述', culturalWorks:'文事作品', publicAssets:'公用资源'
    };
    if (exact[s] != null) return exact[s];
    return s
      .replace(/\bmale\b/g, '男').replace(/\bfemale\b/g, '女')
      .replace(/\balive\b/g, '存世').replace(/\bdead\b/g, '已殁')
      .replace(/\bcourt\b/g, '在朝').replace(/\blocal\b/g, '在外')
      .replace(/\binner\b/g, '内廷').replace(/\bouter\b/g, '外朝')
      .replace(/\bpublicPurse\b/g, '公库').replace(/\bpublicCoffers\b/g, '公库')
      .replace(/\bprivateWealth\b/g, '私产').replace(/\bfamilyTier\b/g, '门第')
      .replace(/\bimperial\b/g, '皇族').replace(/\bnoble\b/g, '世家')
      .replace(/\bgentry\b/g, '士族').replace(/\bcommon\b/g, '寒门');
  }

  function tmfRenwuArray(v){
    if (v == null || v === '') return [];
    return Array.isArray(v) ? v : [v];
  }

  function tmfRenwuField(p, keys, fallback){
    p = p || {};
    for (var i = 0; i < keys.length; i += 1) {
      var k = keys[i];
      if (p[k] != null && p[k] !== '') return p[k];
      if (p.stats && p.stats[k] != null && p.stats[k] !== '') return p.stats[k];
      if (p.abilities && p.abilities[k] != null && p.abilities[k] !== '') return p.abilities[k];
      if (p.attributes && p.attributes[k] != null && p.attributes[k] !== '') return p.attributes[k];
    }
    return fallback;
  }

  function tmfRenwuNum(p, keys, fallback){
    var raw = tmfRenwuField(p, keys, fallback);
    var n = Number(raw);
    return Number.isFinite(n) ? n : raw;
  }

  function tmfRenwuClamp(v){
    var n = Number(v);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(100, n));
  }

  function tmfRenwuShort(v, len){
    var s = tmfRenwuText(v, '');
    len = len || 78;
    return s.length > len ? s.slice(0, len - 1) + '…' : s;
  }

  function tmfRenwuFaction(p){
    return tmfRenwuText(tmfRenwuField(p, ['faction','force','realm','camp','party','group'], ''), '未归属');
  }

  function tmfRenwuGroup(p){
    var text = [
      p && p.group, p && p.role, p && p.office, p && p.title, p && p.faction, p && p.status, p && p.location
    ].map(function(x){ return tmfRenwuText(x, ''); }).join(' ');
    if (/皇|帝|宗室|后|妃|宫|王/.test(text)) return '宫禁';
    if (/宦|阉|太监|司礼|内臣|内廷/.test(text)) return '内廷';
    if (/军|将|督|帅|兵|边|卫|镇|营/.test(text)) return '军务';
    if (/户|钱|粮|财|税|漕|库/.test(text)) return '财赋';
    if (/阁|部|卿|御史|翰林|文|学|士|书院/.test(text)) return '文臣';
    if (/商|民|绅|流民|矿|盐|海/.test(text)) return '士民';
    return tmfRenwuText(p && (p.group || p.role), '朝野');
  }

  function tmfRenwuStatusTokens(p){
    var text = [
      p && p.status, p && p.location, p && p.group, p && p.office
    ].map(function(x){ return tmfRenwuText(x, ''); }).join(' ');
    var out = [];
    if (!p || p.alive !== false) out.push('alive');
    else out.push('dead');
    if (/在朝|京|京师|宫|内阁|外朝|朝中/.test(text)) out.push('court');
    if (/地方|外任|边|辽|海|镇|督师|巡抚|总兵/.test(text)) out.push('local');
    if (/后宫|内廷|司礼|太监|内臣/.test(text)) out.push('inner');
    return out.join(' ');
  }

  function tmfRenwuStatusLabel(p){
    var tokens = tmfRenwuStatusTokens(p);
    if (tokens.indexOf('dead') >= 0) return '已殁';
    if (tokens.indexOf('inner') >= 0) return '内廷';
    if (tokens.indexOf('court') >= 0) return '在朝';
    if (tokens.indexOf('local') >= 0) return '在外';
    return tmfRenwuText(p && p.status, '存世');
  }

  function tmfRenwuPortrait(p){
    var src = tmfRenwuField(p, ['portrait','avatar','image','img','photo','fullBody','halfBody','characterImage','illustration','standingArt','cardPortrait'], '');
    if (src) {
      src = String(src);
      if (/^(https?:|data:|\/|preview\/|assets\/)/.test(src)) return src;
      if (src.indexOf('img/') === 0) return 'preview/' + src;
      if (src.indexOf('portraits/') === 0) return 'preview/img/' + src;
      return src;
    }
    var text = [
      p && p.name, p && p.gender, p && p.role, p && p.office, p && p.title, p && p.group, p && p.faction
    ].map(function(x){ return tmfRenwuText(x, ''); }).join(' ');
    if (/皇帝|天子|帝|朱由校|朱由检/.test(text)) return asset('portraits/ming-emperor-ai.png');
    if (/后|妃|嫔|夫人|女|客氏/.test(text)) return asset('portraits/ming-empress-ai.png');
    if (/宦|阉|太监|司礼|魏忠贤|内臣/.test(text)) return asset('portraits/ming-eunuch-ai.png');
    if (/将|军|帅|总兵|督师|辽东|边|镇|毛文龙|袁崇焕/.test(text)) return asset('portraits/ming-general-ai.png');
    if (/儒|士|书院|讲官|翰林|学/.test(text)) return asset('portraits/ming-scholar-ai.png');
    return asset('portraits/ming-civil-ai.png');
  }

  function tmfRenwuTone(p){
    var key = tmfRenwuFaction(p) + ' ' + tmfRenwuGroup(p);
    if (/后金|满|清|建州|女真/.test(key)) return { color:'#7eb8a7', rgb:'126,184,167' };
    if (/阉|宦|内廷|魏/.test(key)) return { color:'#b64d3c', rgb:'182,77,60' };
    if (/军|辽|边|镇|海/.test(key)) return { color:'#c28f4f', rgb:'194,143,79' };
    if (/东林|书院|士|文/.test(key)) return { color:'#d4be7a', rgb:'212,190,122' };
    if (/商|民|流|矿|盐/.test(key)) return { color:'#8fae72', rgb:'143,174,114' };
    return { color:'#b89a53', rgb:'184,154,83' };
  }

  function tmfRenwuStyle(p){
    var tone = tmfRenwuTone(p || {});
    return '--rw-color:' + tone.color + ';--rw-rgb:' + tone.rgb + ';';
  }

  function tmfRenwuFilterText(p){
    return [
      p && p.name, p && p.courtesy, p && p.office, p && p.title, p && p.role,
      p && p.faction, p && p.group, p && p.location, p && p.status, p && p.bio,
      p && p.description, p && p.innerThought
    ].map(function(x){ return tmfRenwuText(x, ''); }).join(' ').toLowerCase();
  }

  function tmfRenwuOptionValues(people, getter){
    var seen = {};
    var out = [];
    people.forEach(function(p){
      var v = tmfRenwuText(getter(p), '');
      if (!v || seen[v]) return;
      seen[v] = true;
      out.push(v);
    });
    return out.slice(0, 20);
  }

  function tmfRenwuRelations(p, people){
    var rows = [];
    var raw = p && (p.relations || p.relationships || p.impressions || p.guanxi);
    function resolveName(id){
      var hit = people.find(function(x){ return personKey(x) === String(id) || x.name === String(id); });
      return hit ? (hit.name || personKey(hit)) : String(id || '未详');
    }
    function add(id, label, score){
      id = String(id || '').trim();
      if (!id) return;
      rows.push({
        id: id,
        name: resolveName(id),
        label: tmfRenwuText(label, '关系'),
        score: score == null || score === '' ? '—' : score
      });
    }
    if (Array.isArray(raw)) {
      raw.forEach(function(x){
        if (Array.isArray(x)) add(x[0], x[1], x[2]);
        else if (x && typeof x === 'object') add(x.id || x.target || x.name || x.with || x.to || x.person, x.label || x.type || x.relation || x.kind, x.score || x.value || x.affinity || x.trust);
        else if (x) add(x, '关联', '');
      });
    } else if (raw && typeof raw === 'object') {
      Object.keys(raw).forEach(function(k){
        var v = raw[k];
        if (v && typeof v === 'object') add(k, v.label || v.type || v.relation || '关系', v.score || v.value || v.affinity || v.trust);
        else add(k, typeof v === 'string' ? v : '关系', typeof v === 'number' ? v : '');
      });
    }
    if (p && p._impressions && typeof p._impressions === 'object') {
      Object.keys(p._impressions).forEach(function(k){
        if (k === '玩家') return;
        var v = p._impressions[k] || {};
        var favor = Number(v.favor || v.score || v.value || 0);
        if (!Number.isFinite(favor) || Math.abs(favor) < 3) return;
        var label = favor >= 15 ? '感恩深厚' : (favor >= 5 ? '有好感' : (favor <= -15 ? '深怀恨意' : (favor <= -5 ? '心存不满' : '寻常')));
        add(k, label, (favor > 0 ? '+' : '') + favor);
      });
    }
    if (!rows.length) {
      var f = tmfRenwuFaction(p);
      people.filter(function(x){ return personKey(x) !== personKey(p) && tmfRenwuFaction(x) === f; }).slice(0, 5).forEach(function(x){
        add(personKey(x), '同属' + f, 0);
      });
    }
    return rows.slice(0, 10);
  }

  function tmfRenwuMemories(p){
    var out = [];
    function add(x){
      if (x == null || x === '') return;
      if (Array.isArray(x)) { x.forEach(add); return; }
      if (typeof x === 'object') {
        out.push(tmfRenwuText(x.text || x.detail || x.title || x.reason || x.memory || x.event || x, ''));
      } else {
        out.push(String(x));
      }
    }
    add(p && (p.memories || p.memory || p.memoryAnchors || p.experiences || p.history));
    var gm = window.GM || {};
    var k = personKey(p || {});
    if (gm.characterMemories && k) add(gm.characterMemories[k] || gm.characterMemories[p && p.name]);
    if (Array.isArray(gm._memoryArchiveFull) && p && p.name) {
      gm._memoryArchiveFull.forEach(function(m){
        if (!m) return;
        if (m.char && m.char !== p.name) return;
        add(m);
      });
    }
    add(p && (p._memory || p._experienceLog || p._scars));
    if (!out.length && p && p.innerThought) out.push(p.innerThought);
    return out.filter(Boolean);
  }

  function tmfRenwuListRows(rows){
    return '<div class="renwu-list">' + rows.map(function(r){
      return '<div class="renwu-list-row"><span>' + esc(r[0]) + '</span><b>' + esc(tmfRenwuText(r[1], '未记')) + '</b></div>';
    }).join('') + '</div>';
  }

  function tmfRenwuAbilityBars(p){
    var defs = [
      ['智', ['智','intelligence','wisdom','smart']],
      ['政', ['政','administration','politics','governance']],
      ['武', ['武','military','martial','war']],
      ['人', ['人','charisma','charm','diplomacy']],
      ['工', ['工','management','craft','logistics']],
      ['仁', ['仁','virtue','benevolence','morality']],
      ['野', ['野','ambition']],
      ['压', ['压','stress','pressure']]
    ];
    return '<div class="renwu-ability-grid">' + defs.map(function(d){
      var v = tmfRenwuNum(p, d[1], '—');
      return '<div class="renwu-ability"><span class="k">' + esc(d[0]) + '</span><span class="bar"><span class="fill" style="width:' + tmfRenwuClamp(v) + '%"></span></span><span class="v">' + esc(v) + '</span></div>';
    }).join('') + '</div>';
  }

  function tmfRenwuWuchangValue(p, key){
    var source = (p && (p.wuchangOverride || p.wuchang || p.fiveConstants || p.morals)) || {};
    var aliases = {
      '仁': ['仁','ren','benevolence','compassion'],
      '义': ['义','yi','righteousness','justice'],
      '礼': ['礼','li','ritual','propriety'],
      '智': ['智','zhi','wisdom','intelligence'],
      '信': ['信','xin','trust','faith']
    }[key] || [key];
    for (var i = 0; i < aliases.length; i += 1) {
      if (source[aliases[i]] != null && source[aliases[i]] !== '') return source[aliases[i]];
      if (p && p[aliases[i]] != null && p[aliases[i]] !== '') return p[aliases[i]];
      if (p && p.stats && p.stats[aliases[i]] != null && p.stats[aliases[i]] !== '') return p.stats[aliases[i]];
    }
    return '—';
  }

  function tmfRenwuWuchangHtml(p, compact){
    var keys = ['仁','义','礼','智','信'];
    return '<div class="' + (compact ? 'renwu-wuchang compact' : 'renwu-wuchang') + '">' + keys.map(function(k){
      var v = tmfRenwuWuchangValue(p, k);
      var n = Number(v);
      var cls = Number.isFinite(n) ? (n >= 70 ? 'hi' : (n >= 45 ? 'mid' : 'lo')) : '';
      return '<span class="' + cls + '" title="' + esc(k + ' ' + tmfRenwuText(v, '未记')) + '"><b>' + esc(k) + '</b><i>' + esc(v) + '</i></span>';
    }).join('') + '</div>';
  }

  function tmfRenwuSourceNotes(p){
    var raw = tmfRenwuArray(p && (p.sourceNotes || p.sources || p.historicalSources || p.notes || p.commentary));
    return raw.map(function(x){ return tmfRenwuText(x, ''); }).filter(Boolean);
  }

  function tmfRenwuSideMetric(label, value){
    return '<div class="renwu-side-metric"><span>' + esc(label) + '</span><b>' + esc(tmfRenwuText(value, '未记')) + '</b></div>';
  }

  function tmfRenwuResourceLines(p){
    var rows = [];
    var labels = {
      publicPurse: '公库',
      publicAssets: '公产',
      privateWealth: '私产',
      wealth: '私产',
      militaryPower: '兵权',
      army: '军队',
      clients: '门生',
      network: '人脉',
      silver: '银',
      grain: '粮',
      food: '粮',
      troops: '兵',
      influence: '声望',
      reputation: '声望'
    };
    function compact(value){
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return Object.keys(value).map(function(k){
          return (labels[k] || tmfRenwuCn(k)) + ':' + tmfRenwuText(value[k], '未记');
        }).join(' · ');
      }
      return tmfRenwuText(value, '');
    }
    function push(label, value){
      value = compact(value);
      if (value) rows.push([label, value]);
    }
    push('公库', p && (p.publicPurse || p.publicAssets));
    push('私产', p && (p.privateWealth || p.wealth));
    if (p && p.resources && typeof p.resources === 'object' && !Array.isArray(p.resources)) {
      push('公库', p.resources.publicPurse || p.resources.publicCoffers || p.resources.publicAssets);
      push('私产', p.resources.privateWealth || p.resources.wealth);
      push('名望', p.resources.fame != null ? p.resources.fame : p.resources.fameValue);
      push('贤能', p.resources.virtueMerit != null ? p.resources.virtueMerit : p.resources.virtue);
      push('健康', p.resources.health);
      push('压力', p.resources.stress);
    }
    push('兵权', p && (p.militaryPower || p.army));
    push('门生', p && (p.clients || p.network));
    tmfRenwuArray(p && (p.resources || p.resource)).slice(0, 5).forEach(function(x){
      if (Array.isArray(x)) push(tmfRenwuText(x[0], '资源'), x.slice(1).join(' · '));
      else if (x && typeof x === 'object') push(tmfRenwuText(x.name || x.type || x.title, '资源'), x.value || x.desc || x.detail || x.text || x);
      else push('资源', x);
    });
    return rows;
  }

  function tmfRenwuOpenFullButton(p, key){
    return '<button type="button" data-module-action="renwu-person-action" data-person-action="detail" data-id="' + attr(key || personKey(p)) + '">完整人物志<span>打开旧完整人物志，查看六页签全量档案</span></button>';
  }

  function tmfRenwuMetricValue(p, key, fallback){
    var res = (p && p.resources) || {};
    var map = {
      fame: p && (p.fame != null ? p.fame : (p.reputation != null ? p.reputation : (res.fame != null ? res.fame : res.fameValue))),
      virtue: p && (p.virtue != null ? p.virtue : (p.morality != null ? p.morality : (res.virtueMerit != null ? res.virtueMerit : res.virtue))),
      health: p && (p.health != null ? p.health : res.health),
      stress: p && (p.stress != null ? p.stress : res.stress)
    };
    return map[key] != null && map[key] !== '' ? map[key] : fallback;
  }

  function tmfRenwuExtraRows(p){
    return [
      ['职事', p.officeDuties || p.duties || '未记'],
      ['兼衔', p.concurrentTitle || '未记'],
      ['上司', p.superior || '未记'],
      ['师承', p.mentor || '未记'],
      ['好友', p.friends || '未记'],
      ['爱好', p.hobbies || '未记'],
      ['立场', p.stance || p.position || '未记'],
      ['辞令', p.diction || '未记'],
      ['与君主', p.playerRelation || '未记'],
      ['个人志向', p.personalGoal || p.goal || '未记']
    ];
  }

  function tmfRenwuArcHtml(p){
    var gm = window.GM || {};
    var arc = p && p.name && gm._charArcs ? gm._charArcs[p.name] : null;
    if (!arc) return '';
    return '<section class="renwu-sec"><div class="renwu-sec-title">情节弧</div>' + tmfRenwuListRows([
      ['当前境', arc.arcStage || '未记'],
      ['情绪', arc.emotionalState || '未记'],
      ['动机', arc.motivation || '未记'],
      ['潜动向', arc.nextCue || '未记'],
      ['进度', arc.arcProgress != null ? arc.arcProgress + '%' : '未记']
    ]) + '</section>';
  }

  function tmfRenwuExperienceHtml(p){
    var exp = p && (p._experience || p.exp);
    var recent = p && (p._experienceLog || (exp && exp.recent));
    if (!exp && !recent) return '';
    var rows = [];
    if (exp && typeof exp === 'object') {
      Object.keys(exp).forEach(function(k){
        if (k === 'recent') return;
        if (typeof exp[k] === 'number') rows.push([tmfRenwuCn(k), exp[k]]);
      });
    }
    return '<section class="renwu-sec"><div class="renwu-sec-title">人生历练</div>' +
      (rows.length ? tmfRenwuListRows(rows.slice(0, 8)) : '') +
      '<div class="renwu-source-list">' + (tmfRenwuArray(recent).slice(-5).map(function(x){ return '<p>' + esc(tmfRenwuText(x, '')) + '</p>'; }).join('') || '<p>暂无近期历练。</p>') + '</div></section>';
  }

  function tmfRenwuCareerCompatHtml(p){
    var html = '';
    if (p && p.name && typeof window._offRenderCareerHTML === 'function') {
      try {
        var career = window._offRenderCareerHTML(p.name);
        if (career) html += '<section class="renwu-sec"><div class="renwu-sec-title">官制仕途</div><div class="renwu-legacy-html">' + career + '</div></section>';
      } catch(_) {}
    }
    var faceText = '';
    try {
      if (typeof window.FaceSystem !== 'undefined' && p && p._face !== undefined && typeof FaceSystem.getFaceText === 'function') {
        faceText = FaceSystem.getFaceText(p);
      }
    } catch(_) {}
    if (p && (p._face !== undefined || p.personalGoal || p._goalSatisfaction !== undefined || faceText)) {
      html += '<section class="renwu-sec"><div class="renwu-sec-title">颜面与志向</div>' + tmfRenwuListRows([
        ['颜面', p._face !== undefined ? p._face : '未记'],
        ['颜面评语', faceText || '未记'],
        ['个人志向', p.personalGoal || p.goal || '未记'],
        ['满足度', p._goalSatisfaction !== undefined ? Math.round(p._goalSatisfaction) + '%' : '未记']
      ]) + '</section>';
    }
    return html;
  }

  function tmfRenwuIndexTags(p, people){
    var tags = [tmfRenwuFaction(p), tmfRenwuGroup(p), tmfRenwuStatusLabel(p), p && p.location, p && (p.rank || p.role), p && (p.family || p.clan)].filter(Boolean);
    var relCount = tmfRenwuRelations(p, people).length;
    var memCount = tmfRenwuMemories(p).length;
    tags.push('关系' + relCount);
    tags.push('记忆' + memCount);
    return tags.filter(function(t, i, arr){ return arr.indexOf(t) === i; }).slice(0, 10);
  }

  function tmfRenwuCard(p, selectedKey){
    var key = personKey(p);
    var stats = [
      ['智', tmfRenwuNum(p, ['智','intelligence','wisdom'], '—')],
      ['政', tmfRenwuNum(p, ['政','administration','politics'], '—')],
      ['武', tmfRenwuNum(p, ['武','military','martial'], '—')]
    ];
    var tags = [tmfRenwuFaction(p), tmfRenwuGroup(p), tmfRenwuStatusLabel(p)].filter(Boolean);
    return '<button type="button" class="renwu-card ' + (key === selectedKey ? 'active ' : '') + (isPinned(key) ? 'pinned' : '') + '" style="' + tmfRenwuStyle(p) + '" data-renwu-card="1" data-module-action="select-person" data-id="' + attr(key) + '" data-filter-text="' + attr(tmfRenwuFilterText(p)) + '" data-group="' + attr(tmfRenwuGroup(p)) + '" data-faction="' + attr(tmfRenwuFaction(p)) + '" data-status="' + attr(tmfRenwuStatusTokens(p)) + '">' +
      '<img class="renwu-thumb" src="' + attr(tmfRenwuPortrait(p)) + '" alt="">' +
      '<span class="renwu-card-main">' +
        '<span class="renwu-card-name">' + esc(p.name || key || '未名') + '</span>' +
        '<span class="renwu-card-meta">' + esc(tmfRenwuShort(tmfRenwuText(p.office || p.title || p.role, '未仕') + ' · ' + tmfRenwuFaction(p), 34)) + '</span>' +
        '<span class="renwu-card-tags">' + tags.map(function(t){ return '<span>' + esc(t) + '</span>'; }).join('') + '</span>' +
        '<span class="renwu-card-bars">' + stats.map(function(s){ return '<span class="renwu-card-bar"><span>' + esc(s[0]) + '</span><i style="--v:' + tmfRenwuClamp(s[1]) + '%"></i></span>'; }).join('') + '</span>' +
        tmfRenwuWuchangHtml(p, true) +
      '</span>' +
      '<span class="renwu-loyalty"><b>' + esc(tmfRenwuNum(p, ['loyalty','loyal','忠'], '—')) + '</b><small>忠</small></span>' +
    '</button>';
  }

  function tmfRenwuIsPlayer(p){
    var key = personKey(p || {});
    var name = String((p && p.name) || '');
    return key === 'player' || key === 'emperor' || /皇帝|帝王|天子/.test(String(p && (p.role || p.office || p.rank) || '') + name);
  }

  function tmfRenwuInCapital(p){
    return /京|宫|朝|内廷|在朝|在京/.test(String(p && (p.location || '') || '') + String(p && (p.status || '') || '') + String(p && (p.group || '') || '') + String(p && (p.office || '') || ''));
  }

  function tmfRenwuProfileHead(p, key){
    var isSelf = tmfRenwuIsPlayer(p);
    var inCapital = tmfRenwuInCapital(p);
    var primary = isSelf ? ['mind', '御览心志'] : (inCapital ? ['wendui', '召入问对'] : ['letter', '鸿雁传书']);
    var actionAttr = primary[0] === 'mind'
      ? 'data-module-action="renwu-tab" data-tab="mind"'
      : 'data-module-action="renwu-person-action" data-person-action="' + attr(primary[0]) + '" data-id="' + attr(key) + '"';
    var judgement = tmfRenwuText(p.innerThought || p.bio || p.description || p.desc || p.goal, '暂无人物判断。');
    var age = tmfRenwuText(p.age ? (p.age + '岁') : '', '年龄未详');
    var office = tmfRenwuText(p.office || p.title || p.role, '未仕');
    return '<section class="renwu-profile-head" style="' + tmfRenwuStyle(p) + '">' +
      '<div class="renwu-portrait-frame"><img class="renwu-portrait-large" src="' + attr(tmfRenwuPortrait(p)) + '" alt=""></div>' +
      '<div class="renwu-profile-title">' +
        '<h3>' + esc(p.name || key || '暂无人物') + '</h3>' +
        '<div class="courtesy">' + esc(tmfRenwuText(p.courtesy || p.zi || p.styleName, '未录字号')) + ' · ' + esc(age) + '</div>' +
        '<div class="office"><span class="renwu-pill faction">' + esc(tmfRenwuFaction(p)) + '</span><span class="renwu-pill">' + esc(tmfRenwuGroup(p)) + '</span><span class="renwu-pill">' + esc(tmfRenwuStatusLabel(p)) + '</span><span class="renwu-pill">' + esc(office) + '</span></div>' +
        '<div class="renwu-heart-grid">' +
          [['忠诚', tmfRenwuNum(p, ['loyalty','loyal','忠'], '—')], ['野心', tmfRenwuNum(p, ['ambition','野'], '—')], ['压力', tmfRenwuMetricValue(p, 'stress', tmfRenwuNum(p, ['stress','压'], '—'))], ['康健', tmfRenwuMetricValue(p, 'health', tmfRenwuNum(p, ['health','健康'], '—'))]].map(function(x){
            return '<div class="renwu-heart"><span>' + esc(x[0]) + '</span><b>' + esc(x[1]) + '</b></div>';
          }).join('') +
        '</div>' +
        '<div class="renwu-action-row"><button type="button" class="primary" ' + actionAttr + '>' + esc(primary[1]) + '</button><button type="button" data-module-action="renwu-person-action" data-person-action="detail" data-id="' + attr(key) + '">完整人物志</button><button type="button" data-module-action="renwu-person-action" data-person-action="letter" data-id="' + attr(key) + '"' + (isSelf ? ' disabled' : '') + '>鸿雁传书</button><button type="button" data-module-action="renwu-person-action" data-person-action="office" data-id="' + attr(key) + '">官制任免</button><button type="button" data-module-action="pin-person" data-id="' + attr(key) + '">钉选</button></div>' +
        '<div class="renwu-verdict"><b>人物判断</b><p>' + esc(tmfRenwuShort(judgement, 180)) + '</p></div>' +
      '</div>' +
    '</section>';
  }

  function tmfRenwuWorks(p){
    return tmfRenwuArray(p && (p.works || p.writings || p.memorials || p.documents || p.zoushu)).map(function(x){
      if (x && typeof x === 'object') return x;
      return { title: tmfRenwuText(x, '著述'), type: '记录', excerpt: tmfRenwuText(x, '') };
    });
  }

  function tmfRenwuWorkCards(p){
    var works = tmfRenwuWorks(p);
    return works.length ? works.slice(0, 8).map(function(w){
      return '<div class="renwu-work-card"><b>' + esc(tmfRenwuText(w.title || w.name, '未题')) + ' · ' + esc(tmfRenwuText(w.type || w.kind, '著述')) + '</b><span>' + esc(tmfRenwuText(w.turn || w.time || w.date, '未署')) + ' · ' + esc(tmfRenwuText(w.excerpt || w.summary || w.text || w.detail, '暂无摘录')) + '</span></div>';
    }).join('') : '<div class="renwu-prose">暂无著述奏疏。</div>';
  }

  function tmfRenwuEvents(p){
    var events = p && (p.events || p.career || p.history || []);
    return Array.isArray(events) ? events : [];
  }

  function tmfRenwuTimeline(events){
    return '<div class="renwu-timeline">' + (Array.isArray(events) && events.length ? events.slice(0, 16).map(function(x){
      var turn = Array.isArray(x) ? x[0] : (x.turn || x.time || x.year || '记');
      var text = Array.isArray(x) ? x[1] : (x.text || x.event || x.title || x);
      return '<div class="renwu-event"><span class="turn">' + esc(turn) + '</span><span class="event">' + esc(tmfRenwuText(text, '')) + '</span></div>';
    }).join('') : '<div class="renwu-prose">暂无履历节点。</div>') + '</div>';
  }

  function tmfRenwuFamilyTreeHtml(p){
    var family = tmfRenwuText(p.family || p.clan, '未录家族');
    var father = tmfRenwuText(p.father || p.fatherName || p.fatherClan, '父族未详');
    var mother = tmfRenwuText(p.mother || p.motherName || p.motherClan, '母族未详');
    var spouse = tmfRenwuText(p.spouse || p.spouseClan, '姻亲未详');
    var children = tmfRenwuArray(p.children).map(function(x){ return tmfRenwuText((x && typeof x === 'object') ? (x.name || x.relation || x) : x, '子嗣'); }).slice(0, 4);
    return '<div class="renwu-family-tree">' +
      '<div class="renwu-family-row"><div class="renwu-family-node">' + esc(father) + '</div><div class="renwu-family-node">' + esc(mother) + '</div></div>' +
      '<div class="renwu-family-line"></div><div class="renwu-family-row"><div class="renwu-family-node self">' + esc(p.name || family) + '</div><div class="renwu-family-node">' + esc(spouse) + '</div></div>' +
      '<div class="renwu-family-line"></div><div class="renwu-family-row">' + (children.length ? children.map(function(c){ return '<div class="renwu-family-node">' + esc(c) + '</div>'; }).join('') : '<div class="renwu-family-node">暂无子嗣记录</div>') + '</div>' +
    '</div>';
  }

  function tmfRenwuDetailTab(p, people){
    var tab = state.renwuTab || 'overview';
    var memories = tmfRenwuMemories(p);
    var relations = tmfRenwuRelations(p, people);
    if (tab === 'mind') {
      var stressSources = tmfRenwuArray(p.stressSources || p.pressureSources);
      var notesMind = tmfRenwuSourceNotes(p);
      return '<div class="renwu-panel active"><div class="renwu-grid-2"><section class="renwu-sec"><div class="renwu-sec-title">当前心绪</div><div class="renwu-prose">心境：' + esc(tmfRenwuText(p.mood || p.state || '未记', '未记')) + '<br><br>' + esc(tmfRenwuText(p.innerThought || p.goal, '暂无心绪记录。')) + '</div></section>' +
        '<section class="renwu-sec"><div class="renwu-sec-title">压力来源</div>' + tmfRenwuListRows(stressSources.length ? stressSources.map(function(x){ return ['来源', x]; }) : [['来源', '暂无明确记录']]) + '</section>' +
        '</div>' +
        tmfRenwuArcHtml(p) +
        tmfRenwuExperienceHtml(p) +
        '<section class="renwu-sec"><div class="renwu-sec-title">五常心性</div>' + tmfRenwuWuchangHtml(p, false) + '</section>' +
        '<section class="renwu-sec"><div class="renwu-sec-title">记忆模块</div><details class="renwu-memory" open><summary>完整记忆 · ' + memories.length + ' 条</summary>' + (memories.length ? memories.map(function(m, i){ return '<p><b>' + (i + 1) + '</b>' + esc(tmfRenwuText(m, '')) + '</p>'; }).join('') : '<p>暂无记忆记录。</p>') + '</details></section>' +
        '<section class="renwu-sec"><div class="renwu-sec-title">史料/旁注</div><div class="renwu-source-list">' + (notesMind.length ? notesMind.slice(0, 8).map(function(x){ return '<p>' + esc(x) + '</p>'; }).join('') : '<p>暂无史料旁注。</p>') + '</div></section></div>';
    }
    if (tab === 'relations') {
      return '<div class="renwu-panel active"><div class="renwu-grid-2"><section class="renwu-sec"><div class="renwu-sec-title">对玩家态度</div>' + tmfRenwuListRows([
        ['忠诚', tmfRenwuNum(p, ['loyalty','loyal','忠'], '—')],
        ['怨望', Math.max(0, 100 - Number(tmfRenwuNum(p, ['loyalty','loyal','忠'], 50)))],
        ['党派', tmfRenwuFaction(p)],
        ['关键判断', Number(tmfRenwuNum(p, ['loyalty','loyal','忠'], 50)) >= 70 ? '可托付' : (Number(tmfRenwuNum(p, ['loyalty','loyal','忠'], 50)) >= 45 ? '可接触' : '需防范')]
      ]) + '</section>' +
      '<section class="renwu-sec"><div class="renwu-sec-title">立场</div>' + tmfRenwuListRows([['所属', tmfRenwuFaction(p)], ['派系/身份', tmfRenwuGroup(p)], ['立场', p.stance || p.position || '未记'], ['党派', p.party || '未记']]) + '</section></div>' +
      '<section class="renwu-sec"><div class="renwu-sec-title">关系网络</div><div class="renwu-rel-list">' + (relations.length ? relations.map(function(r){
        return '<button type="button" data-module-action="select-person" data-id="' + attr(r.id) + '"><span>' + esc(r.label) + '</span><b>' + esc(r.name) + '</b><i>' + esc(r.score) + '</i></button>';
      }).join('') : '<p class="renwu-prose">暂无显性关系。</p>') + '</div></section>' +
      '<section class="renwu-sec"><div class="renwu-sec-title">血亲与旧属</div><div class="renwu-list">' + (tmfRenwuArray(p.familyMembers || p.relatives || p.oldFollowers).length ? tmfRenwuArray(p.familyMembers || p.relatives || p.oldFollowers).map(function(m){
        return '<div class="renwu-list-row"><span>' + esc(tmfRenwuText(m.relation || m.type, '关系')) + '</span><b>' + esc(tmfRenwuText(m.name || m, '未名')) + '</b></div>';
      }).join('') : '<div class="renwu-prose">暂无血亲旧属。</div>') + '</div></section></div>';
    }
    if (tab === 'career') {
      var events = tmfRenwuEvents(p);
      return '<div class="renwu-panel active"><div class="renwu-grid-2"><section class="renwu-sec"><div class="renwu-sec-title">仕途面板</div>' + tmfRenwuListRows([
        ['现职', p.office || p.title || '未仕'],
        ['品秩', p.rank || p.role || '未记'],
        ['入仕节点', p.joinTurn || p.entry || '未详'],
        ['可任方向', tmfRenwuText((p.role || '未记') + ' · ' + (p.stance || p.position || tmfRenwuFaction(p)), '未记')],
        ['所在', p.location || p.status || '未记'],
        ['风险', Number(tmfRenwuNum(p, ['ambition','野'], 0)) >= 70 ? '求进太急' : (Number(tmfRenwuNum(p, ['stress','压'], 0)) >= 60 ? '压力较高' : '暂无急险')]
      ]) + '</section><section class="renwu-sec"><div class="renwu-sec-title">著述奏疏</div>' + tmfRenwuWorkCards(p) + '</section></div>' +
      tmfRenwuCareerCompatHtml(p) +
      '<section class="renwu-sec"><div class="renwu-sec-title">履历与事件</div>' + tmfRenwuTimeline(events) + '</section></div>';
    }
    if (tab === 'identity') {
      var idRows = [['姓名', p.name || '未名'], ['字/号', p.courtesy || p.zi || p.styleName || '未记'], ['性别', p.gender || (p.isFemale ? 'female' : '') || '未记'], ['年龄', p.age || '未记'], ['籍贯', p.birthplace || p.hometown || p.origin || '未记'], ['族属', p.ethnicity || p.clan || p.family || '未记'], ['信仰', p.faith || '未记'], ['文化', p.culture || p.learning || '未记'], ['声望', tmfRenwuMetricValue(p, 'fame', '未记')], ['贤德', tmfRenwuMetricValue(p, 'virtue', '未记')]];
      return '<div class="renwu-panel active"><section class="renwu-sec"><div class="renwu-sec-title">身份档案</div><div class="renwu-id-grid">' + idRows.map(function(r){ return '<div class="renwu-id-cell"><span>' + esc(r[0]) + '</span><b>' + esc(tmfRenwuText(r[1], '未记')) + '</b></div>'; }).join('') + '</div></section>' +
      '<section class="renwu-sec"><div class="renwu-sec-title">公开身份</div>' + tmfRenwuListRows([
        ['官职', p.office || p.title || '未仕'],
        ['品秩', p.rank || p.role || '未记'],
        ['所属', tmfRenwuFaction(p)],
        ['门类', tmfRenwuGroup(p)],
        ['位置', p.location || '未记'],
        ['状态', tmfRenwuStatusLabel(p)]
      ]) + '</section>' +
      '<section class="renwu-sec"><div class="renwu-sec-title">公私身份对照</div>' + tmfRenwuListRows(tmfRenwuExtraRows(p)) + '</section>' +
      '<section class="renwu-sec"><div class="renwu-sec-title">形貌与传略</div><div class="renwu-prose">' + esc(tmfRenwuText(p.appearance || '', '暂无形貌记录。')) + '\n\n' + esc(tmfRenwuText(p.bio || p.description || p.desc || '', '暂无传略。')) + '</div></section></div>';
    }
    if (tab === 'family') {
      var familyMembers = tmfRenwuArray(p.familyMembers || p.relatives || p.familyTree);
      var children = tmfRenwuArray(p.children).map(function(x){ return typeof x === 'object' ? x : { name: x, relation: '子女' }; });
      return '<div class="renwu-panel active"><section class="renwu-sec"><div class="renwu-sec-title">家族谱系</div>' + tmfRenwuFamilyTreeHtml(p) + '</section>' +
      '<section class="renwu-sec"><div class="renwu-sec-title">家族总览</div>' + tmfRenwuListRows([
        ['家族', p.family || p.clan || '未记'],
        ['家格', p.familyTier || p.clanRank || '未记'],
        ['家望', p.clanPrestige || p.familyPrestige || '未记'],
        ['父族', p.fatherClan || p.family || '未记'],
        ['母族', p.motherClan || '未记'],
        ['姻亲', p.spouseClan || p.spouse || '未记']
      ]) + '</section>' +
      '<section class="renwu-sec"><div class="renwu-sec-title">亲族人物</div><div class="renwu-list">' + (familyMembers.length ? familyMembers.map(function(m){
        return '<div class="renwu-list-row"><span>' + esc(tmfRenwuText(m.relation || m.type, '亲族')) + '</span><b>' + esc(tmfRenwuText(m.name || m, '未名')) + ' · ' + esc(tmfRenwuText(m.family || m.clan || p.family, '未记')) + '</b></div>';
      }).join('') : '<div class="renwu-prose">暂无亲族记录。</div>') + '</div></section>' +
      '<section class="renwu-sec"><div class="renwu-sec-title">子嗣</div><div class="renwu-list">' + (children.length ? children.map(function(m){
        return '<div class="renwu-list-row"><span>' + esc(tmfRenwuText(m.relation || '子女', '子女')) + '</span><b>' + esc(tmfRenwuText(m.name || m, '未名')) + '</b></div>';
      }).join('') : '<div class="renwu-prose">暂无子嗣记录。</div>') + '</div></section></div>';
    }
    if (tab === 'resources') {
      var resourceLines = tmfRenwuResourceLines(p);
      return '<div class="renwu-panel active"><div class="renwu-grid-2"><section class="renwu-sec"><div class="renwu-sec-title">公用资源</div>' + tmfRenwuListRows([
        ['公库', p.publicPurse || p.publicAssets || '未记'],
        ['职权资源', resourceLines.map(function(r){ return r[0] + ':' + r[1]; }).join('；') || '未录'],
        ['所在地', p.location || '未记'],
        ['官职绑定', p.office || p.title || '未仕']
      ]) + '</section><section class="renwu-sec"><div class="renwu-sec-title">私产与声望</div><div class="renwu-resource-grid">' + [
        ['私产', p.privateWealth || p.wealth || '未记'],
        ['名望', tmfRenwuMetricValue(p, 'fame', '未记')],
        ['贤德', tmfRenwuMetricValue(p, 'virtue', '未记')],
        ['家望', p.clanPrestige || p.familyPrestige || '未记'],
        ['可动用关系', relations.length + ' 条']
      ].map(function(r){ return '<div class="renwu-resource"><span>' + esc(r[0]) + '</span><b>' + esc(tmfRenwuText(r[1], '未记')) + '</b></div>'; }).join('') + '</div></section></div>' +
      '<section class="renwu-sec"><div class="renwu-sec-title">可调动资源</div><div class="renwu-list">' + (tmfRenwuArray(p.resources || p.resource).length ? tmfRenwuArray(p.resources || p.resource).map(function(x){
        return '<div class="renwu-list-row"><span>资源</span><b>' + esc(tmfRenwuText(x, '')) + '</b></div>';
      }).join('') : '<div class="renwu-prose">暂无明确资源记录。</div>') + '</div></section>' +
      '<section class="renwu-sec"><div class="renwu-sec-title">约束</div>' + tmfRenwuListRows([
        ['风险', p.risk || p.danger || (Number(tmfRenwuNum(p, ['ambition','野'], 0)) >= 70 ? '野心偏高' : '未记')],
        ['把柄', p.leverage || p.secret || '未记'],
        ['弱点', p.weakness || '未记'],
        ['目标', p.goal || '未记']
      ]) + '</section></div>';
    }
    if (tab === 'actions') {
      var key = personKey(p);
      return '<div class="renwu-panel active"><section class="renwu-sec"><div class="renwu-sec-title">可用行动</div><div class="renwu-action-grid">' +
        '<button type="button" class="primary" data-module-action="renwu-person-action" data-person-action="wendui" data-id="' + attr(key) + '">御前问对<span>召见此人，进入问对流程</span></button>' +
        '<button type="button" data-module-action="renwu-person-action" data-person-action="letter" data-id="' + attr(key) + '">鸿雁传书<span>写信给此人或转入书信草稿</span></button>' +
        '<button type="button" data-module-action="renwu-person-action" data-person-action="office" data-id="' + attr(key) + '">官制任免<span>转入官制，处理任官调动</span></button>' +
        '<button type="button" data-module-action="pin-person" data-id="' + attr(key) + '">钉选到臣<span>放入右侧紧要之臣列表</span></button>' +
        tmfRenwuOpenFullButton(p, key) +
      '</div></section>' +
      '<section class="renwu-sec"><div class="renwu-sec-title">行动依据</div>' + tmfRenwuListRows([
        ['忠诚', tmfRenwuNum(p, ['loyalty','loyal','忠'], '—')],
        ['野心', tmfRenwuNum(p, ['ambition','野'], '—')],
        ['压力', tmfRenwuNum(p, ['stress','压'], '—')],
        ['关系', tmfRenwuRelations(p, people).slice(0, 3).map(function(r){ return r.name + '(' + r.label + ')'; })]
      ]) + '</section></div>';
    }
    return '<div class="renwu-panel active"><div class="renwu-grid-2">' +
      '<section class="renwu-sec"><div class="renwu-sec-title">人物总览</div>' + tmfRenwuListRows([
        ['姓名', p.name || '未名'],
        ['字/号', p.courtesy || p.zi || p.styleName || '未记'],
        ['官职', p.office || p.title || '未仕'],
        ['品秩', p.rank || p.role || '未记'],
        ['所属', tmfRenwuFaction(p)],
        ['门类', tmfRenwuGroup(p)],
        ['所在', p.location || '未记'],
        ['状态', tmfRenwuStatusLabel(p)],
        ['当前目标', p.goal || '未记']
      ]) + '</section>' +
      '<section class="renwu-sec"><div class="renwu-sec-title">声望与状态</div><div class="renwu-quality-grid">' + [
        ['忠诚', tmfRenwuNum(p, ['loyalty','loyal','忠'], '—')],
        ['野心', tmfRenwuNum(p, ['ambition','野'], '—')],
        ['压力', tmfRenwuMetricValue(p, 'stress', tmfRenwuNum(p, ['stress','压'], '—'))],
        ['健康', tmfRenwuMetricValue(p, 'health', tmfRenwuNum(p, ['health','健康'], '—'))],
        ['名望', tmfRenwuMetricValue(p, 'fame', '未记')],
        ['贤德', tmfRenwuMetricValue(p, 'virtue', '未记')],
        ['家望', p.clanPrestige || p.familyPrestige || '未记'],
        ['可用人物', people.filter(function(x){ return !x || x.alive !== false; }).length + ' / ' + people.length]
      ].map(function(r){ return '<div class="renwu-resource"><span>' + esc(r[0]) + '</span><b>' + esc(tmfRenwuText(r[1], '未记')) + '</b></div>'; }).join('') + '</div></section>' +
      '</div>' +
      '<section class="renwu-sec"><div class="renwu-sec-title">八维评量</div>' + tmfRenwuAbilityBars(p) + '</section>' +
      '<div class="renwu-grid-2"><section class="renwu-sec"><div class="renwu-sec-title">五常与性情</div><div class="renwu-prose">' + tmfRenwuWuchangHtml(p, false) + '<br>' + esc(tmfRenwuText(p.personality || p.innerThought || p.bio, '暂无性情记录。')) + '</div></section>' +
      '<section class="renwu-sec"><div class="renwu-sec-title">可用标签</div><div class="renwu-list">' + (tmfRenwuArray(p.traits || p.tags).length ? tmfRenwuArray(p.traits || p.tags).map(function(t){ return '<div class="renwu-list-row"><span>特质</span><b>' + esc(tmfRenwuText(t, '')) + '</b></div>'; }).join('') : '<div class="renwu-prose">暂无显性特质。</div>') + '</div></section></div></div>';
  }

  function tmfRenwuSide(p, people){
    var relations = tmfRenwuRelations(p, people).slice(0, 5);
    var memories = tmfRenwuMemories(p).slice(0, 5);
    var notes = tmfRenwuSourceNotes(p).slice(0, 3);
    var resources = tmfRenwuResourceLines(p).slice(0, 7);
    var tags = tmfRenwuIndexTags(p, people);
    var persona = tmfRenwuText(p.aiPersona || p.personality || p.behaviorModel || p.speechStyle, '');
    var pos = [[50,14],[78,34],[71,72],[25,72],[20,34]];
    return '<aside class="renwu-side" style="' + tmfRenwuStyle(p) + '">' +
      '<div class="renwu-side-top"><div class="renwu-side-title">关系小图</div><div class="renwu-mini-network">' +
      '<span class="renwu-mini-node self">' + esc(p.name || '人物') + '</span>' +
      relations.map(function(r, i){ return '<button type="button" class="renwu-mini-node" style="left:' + pos[i][0] + '%;top:' + pos[i][1] + '%" data-module-action="select-person" data-id="' + attr(r.id) + '">' + esc(tmfRenwuShort(r.name, 4)) + '</button>'; }).join('') +
      '</div></div>' +
      '<div class="renwu-side-scroll">' +
        '<div class="renwu-side-card"><b>状态</b><div class="renwu-side-metrics">' +
          tmfRenwuSideMetric('忠诚', tmfRenwuNum(p, ['loyalty','loyal','忠'], '—')) +
          tmfRenwuSideMetric('野心', tmfRenwuNum(p, ['ambition','野'], '—')) +
          tmfRenwuSideMetric('压力', tmfRenwuMetricValue(p, 'stress', tmfRenwuNum(p, ['stress','压'], '—'))) +
          tmfRenwuSideMetric('健康', tmfRenwuMetricValue(p, 'health', tmfRenwuNum(p, ['health','健康'], '—'))) +
          tmfRenwuSideMetric('名望', tmfRenwuMetricValue(p, 'fame', '未记')) +
          tmfRenwuSideMetric('贤德', tmfRenwuMetricValue(p, 'virtue', '未记')) +
        '</div></div>' +
        '<div class="renwu-side-card"><b>朝局位置</b><span>' + esc(tmfRenwuFaction(p) + ' · ' + tmfRenwuGroup(p) + ' · ' + tmfRenwuStatusLabel(p)) + '</span><span>' + esc(tmfRenwuText(p.location || p.office || p.role, '未记')) + '</span></div>' +
        '<div class="renwu-side-card"><b>五常速览</b>' + tmfRenwuWuchangHtml(p, true) + '</div>' +
        '<div class="renwu-side-card"><b>资源</b><div class="renwu-mini-list">' + (resources.length ? resources.map(function(r){ return '<span><i>' + esc(r[0]) + '</i>' + esc(tmfRenwuShort(r[1], 42)) + '</span>'; }).join('') : '<span>暂无可调动资源。</span>') + '</div></div>' +
        '<div class="renwu-side-card"><b>关系网络</b><div class="renwu-mini-list">' + (relations.length ? relations.map(function(r){ return '<button type="button" data-module-action="select-person" data-id="' + attr(r.id) + '"><i>' + esc(r.label) + '</i>' + esc(r.name) + '<em>' + esc(r.score) + '</em></button>'; }).join('') : '<span>暂无显性关系。</span>') + '</div></div>' +
        '<div class="renwu-side-card"><b>AI性格</b><span>' + esc(tmfRenwuShort(persona || '暂无性格脚本。', 72)) + '</span></div>' +
        '<div class="renwu-side-card"><b>最近记忆</b>' + (memories.length ? memories.map(function(m){ return '<span>' + esc(tmfRenwuShort(m, 54)) + '</span>'; }).join('') : '<span>暂无记忆。</span>') + '</div>' +
        '<div class="renwu-side-card"><b>史料摘录</b>' + (notes.length ? notes.map(function(x){ return '<span>' + esc(tmfRenwuShort(x, 64)) + '</span>'; }).join('') : '<span>暂无史料摘录。</span>') + '</div>' +
        '<div class="renwu-side-card"><b>索引</b><div class="renwu-index-tags">' + tags.map(function(t){ return '<span>' + esc(tmfRenwuShort(t, 8)) + '</span>'; }).join('') + '</div></div>' +
        '<div class="renwu-side-card"><b>可用操作</b><div class="renwu-mini-list"><button type="button" data-module-action="renwu-person-action" data-person-action="detail" data-id="' + attr(personKey(p)) + '"><i>全志</i>完整人物志<em>详</em></button></div></div>' +
      '</div>' +
    '</aside>';
  }

  function renwuFilterState(){
    var filters = state.renwuFilters || {};
    state.renwuFilters = filters;
    filters.q = String(filters.q || '');
    filters.group = filters.group || 'all';
    filters.faction = filters.faction || 'all';
    filters.status = filters.status || 'all';
    filters.showDead = !!filters.showDead;
    return filters;
  }

  function renwuOption(value, label, current){
    value = String(value == null ? '' : value);
    return '<option value="' + attr(value) + '"' + (String(current) === value ? ' selected' : '') + '>' + esc(label == null ? value : label) + '</option>';
  }

  function renwuRosterList(root){
    root = root || document;
    return root.querySelector ? root.querySelector('.renwu-roster-list') : null;
  }

  function rememberRenwuRosterScroll(root){
    var list = renwuRosterList(root || document.getElementById('tmf-module-overlay'));
    if (!list) return;
    state.renwuRosterScroll = Number(list.scrollTop || 0);
  }

  function restoreRenwuRosterScroll(root){
    var y = Number(state.renwuRosterScroll || 0);
    if (!y) return;
    var apply = function(){
      var list = renwuRosterList(root || document.getElementById('tmf-module-overlay'));
      if (list) list.scrollTop = y;
    };
    apply();
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(apply);
    else setTimeout(apply, 0);
  }

  function renwuTabsMarkup(){
    var tabs = [['overview','总览'],['identity','身份'],['mind','心绪'],['relations','关系'],['career','履历'],['family','家族'],['resources','资源'],['actions','行动']];
    return '<nav class="renwu-tabs">' + tabs.map(function(t){
      return '<button type="button" class="renwu-tab ' + ((state.renwuTab || 'overview') === t[0] ? 'active' : '') + '" data-module-action="renwu-tab" data-tab="' + attr(t[0]) + '">' + esc(t[1]) + '</button>';
    }).join('') + '</nav>';
  }

  function refreshRenwuSelection(root){
    root = root || document.getElementById('tmf-module-overlay');
    if (!root || !state.activeModule || state.activeModule.kind !== 'renwu') return false;
    var people = getPeople();
    var selected = findPerson(state.modulePerson) || people[0] || {};
    var selectedKey = personKey(selected);
    if (selectedKey) state.modulePerson = selectedKey;
    Array.prototype.forEach.call(root.querySelectorAll('[data-renwu-card]'), function(card){
      card.classList.toggle('active', String((card.dataset && card.dataset.id) || '') === String(selectedKey));
    });
    Array.prototype.forEach.call(root.querySelectorAll('.renwu-head-btn[data-id]'), function(btn){
      btn.setAttribute('data-id', selectedKey || '');
    });
    var main = root.querySelector('.renwu-main');
    if (main) {
      main.innerHTML = tmfRenwuProfileHead(selected, selectedKey) +
        renwuTabsMarkup() +
        '<div class="renwu-detail-scroll" style="' + tmfRenwuStyle(selected) + '">' + tmfRenwuDetailTab(selected, people) + '</div>';
    }
    var side = root.querySelector('.renwu-side');
    if (side) side.outerHTML = tmfRenwuSide(selected, people);
    return true;
  }

  function filterRenwuOverlay(root){
    root = root || document;
    var filters = renwuFilterState();
    var oldQ = filters.q;
    var oldGroup = filters.group;
    var oldFaction = filters.faction;
    var oldStatus = filters.status;
    var oldShowDead = filters.showDead;
    var q = (root.querySelector('[data-renwu-search]') || {}).value || '';
    q = q.trim().toLowerCase();
    var group = (root.querySelector('[data-renwu-group]') || {}).value || 'all';
    var faction = (root.querySelector('[data-renwu-faction]') || {}).value || 'all';
    var status = (root.querySelector('[data-renwu-status]') || {}).value || 'all';
    var showDead = !!((root.querySelector('[data-renwu-dead]') || {}).checked);
    filters.q = q;
    filters.group = group;
    filters.faction = faction;
    filters.status = status;
    filters.showDead = showDead;
    var changed = oldQ !== q || oldGroup !== group || oldFaction !== faction || oldStatus !== status || oldShowDead !== showDead;
    var shown = 0;
    root.querySelectorAll('[data-renwu-card]').forEach(function(card){
      var ok = true;
      var text = String((card.dataset && card.dataset.filterText) || card.textContent || '').toLowerCase();
      if (q && text.indexOf(q) < 0) ok = false;
      if (group !== 'all' && card.dataset.group !== group) ok = false;
      if (faction !== 'all' && card.dataset.faction !== faction) ok = false;
      if (status !== 'all' && (' ' + (card.dataset.status || '') + ' ').indexOf(' ' + status + ' ') < 0) ok = false;
      if (!showDead && status !== 'dead' && (' ' + (card.dataset.status || '') + ' ').indexOf(' dead ') >= 0) ok = false;
      card.hidden = !ok;
      card.style.display = ok ? '' : 'none';
      card.setAttribute('aria-hidden', ok ? 'false' : 'true');
      if (ok) shown += 1;
    });
    var count = root.querySelector('#renwu-visible-count');
    if (count) count.textContent = shown;
    if (changed) {
      var list = renwuRosterList(root);
      if (list) list.scrollTop = 0;
      state.renwuRosterScroll = 0;
    }
  }

  function renderRenwuModule(){
    var people = getPeople();
    var selected = findPerson(state.modulePerson) || people[0] || {};
    var selectedKey = personKey(selected);
    if (selectedKey) state.modulePerson = selectedKey;
    var alive = people.filter(function(p){ return !p || p.alive !== false; }).length;
    var factions = tmfRenwuOptionValues(people, tmfRenwuFaction);
    var groups = tmfRenwuOptionValues(people, tmfRenwuGroup);
    var pinnedCount = (state.pinnedPeople || []).length;
    var filters = renwuFilterState();
    var tabs = [['overview','总览'],['identity','身份'],['mind','心绪'],['relations','关系'],['career','履历'],['family','家族'],['resources','资源'],['actions','行动']];
    var loyalty = tmfRenwuNum(selected, ['loyalty','loyal','忠'], '—');
    var ambition = tmfRenwuNum(selected, ['ambition','野'], '—');
    var stress = tmfRenwuNum(selected, ['stress','压'], '—');
    var health = tmfRenwuNum(selected, ['health','健康'], '—');
    var judgement = tmfRenwuText(selected.innerThought || selected.bio || selected.description || selected.desc || selected.goal, '暂无人物判断。');
    return '<section class="renwu-atlas tmf-renwu-atlas" role="dialog" aria-label="人物图志">' +
      '<header class="renwu-atlas-head">' +
        '<div class="renwu-titleblock"><div class="renwu-title-seal">志</div><div class="renwu-titletext"><div class="renwu-title-line"><h2>人物图志</h2><button type="button" class="renwu-ceming-btn" data-module-action="ceming-open">策名</button></div><p>索引朝野人物、仕途、心绪、关系与可用行动</p></div></div>' +
        '<div class="renwu-head-actions"><button type="button" class="renwu-head-btn" data-module-action="renwu-person-action" data-person-action="detail" data-id="' + attr(selectedKey) + '">完整</button><button type="button" class="renwu-head-btn" data-module-action="renwu-reset">清筛</button><button type="button" class="renwu-head-btn" data-module-action="pin-person" data-id="' + attr(selectedKey) + '">钉选</button><button type="button" class="renwu-head-btn" data-module-close="1">×</button></div>' +
      '</header>' +
      '<div class="renwu-atlas-body">' +
        '<aside class="renwu-roster">' +
          '<div class="renwu-statbar"><div class="renwu-stat"><b>' + people.length + '</b><span>入志</span></div><div class="renwu-stat"><b>' + alive + '</b><span>存世</span></div><div class="renwu-stat"><b>' + pinnedCount + '</b><span>钉选</span></div></div>' +
          '<div class="renwu-tools">' +
            '<div class="renwu-tool-row"><input class="renwu-search" data-renwu-search value="' + attr(filters.q) + '" placeholder="输入姓名、官职、派系、记忆"><label class="renwu-check"><input type="checkbox" data-renwu-filter data-renwu-dead' + (filters.showDead ? ' checked' : '') + '>含已殁</label></div>' +
            '<div class="renwu-filter-row three">' +
              '<select data-renwu-filter data-renwu-group>' + renwuOption('all', '全部门类', filters.group) + groups.map(function(g){ return renwuOption(g, g, filters.group); }).join('') + '</select>' +
              '<select data-renwu-filter data-renwu-faction>' + renwuOption('all', '全部势力', filters.faction) + factions.map(function(f){ return renwuOption(f, f, filters.faction); }).join('') + '</select>' +
              '<select data-renwu-filter data-renwu-status>' + renwuOption('all', '全部状态', filters.status) + renwuOption('court', '在朝', filters.status) + renwuOption('local', '在外', filters.status) + renwuOption('inner', '内廷', filters.status) + renwuOption('dead', '已殁', filters.status) + '</select>' +
            '</div>' +
            '<div class="renwu-legend"><span>当前显示 <b id="renwu-visible-count">' + people.length + '</b> 人</span><span>点击人物切换档案</span></div>' +
          '</div>' +
          '<div class="renwu-roster-list">' + (people.length ? people.map(function(p){ return tmfRenwuCard(p, selectedKey); }).join('') : '<p class="renwu-prose">暂无人物数据。</p>') + '</div>' +
        '</aside>' +
        '<main class="renwu-main">' +
          tmfRenwuProfileHead(selected, selectedKey) +
          renwuTabsMarkup() +
          '<div class="renwu-detail-scroll" style="' + tmfRenwuStyle(selected) + '">' + tmfRenwuDetailTab(selected, people) + '</div>' +
        '</main>' +
        tmfRenwuSide(selected, people) +
      '</div>' +
    '</section>';
  }

  function renderShizhengModule(){
    var issues = getIssues();
    var sorted = issues.slice().sort(function(a, b){
      var ar = issueIsResolved(a) ? 1 : 0;
      var br = issueIsResolved(b) ? 1 : 0;
      if (ar !== br) return ar - br;
      return issueRank(b) - issueRank(a);
    });
    var selected = sorted.find(function(x){ return String(x.id) === String(state.shizhengIssue || ''); }) || sorted[0] || null;
    if (selected) state.shizhengIssue = selected.id;
    var pending = issues.filter(function(x){ return !issueIsResolved(x); });
    var resolved = issues.filter(issueIsResolved);
    var linkedCount = issues.reduce(function(sum, x){
      return sum + ((x.linkedChars || []).length) + ((x.linkedFactions || []).length);
    }, 0);
    var left = '<div class="tmf-sz-summary">' +
      '<span><i>待裁</i><b>' + esc(pending.length) + '</b></span>' +
      '<span><i>已裁</i><b>' + esc(resolved.length) + '</b></span>' +
      '<span><i>牵涉</i><b>' + esc(linkedCount) + '</b></span>' +
      '</div><div class="tmf-sz-list">' + sorted.map(function(x){ return renderIssueCard(x, selected && selected.id); }).join('') + '</div>';
    var main = renderIssueDetail(selected);
    var issueId = selected ? attr(selected.id) : '';
    var right = '<h3>联动入口</h3><div class="tmf-sz-actions">' +
      '<button type="button" class="tmf-sz-action primary" data-module-action="shizheng-refresh">刷新御案</button>' +
      '<button type="button" class="tmf-sz-action" data-module-action="shizheng-convene" data-id="' + issueId + '">御前召对群臣</button>' +
      '<button type="button" class="tmf-sz-action" data-module-action="shizheng-secret" data-id="' + issueId + '">独召密问</button>' +
      '<button type="button" class="tmf-sz-action" data-module-action="add-edict" data-id="' + issueId + '">转诏书草案</button>' +
      '<button type="button" class="tmf-sz-action" data-module-action="record-tab" data-tab="jishi">开史官实录</button>' +
      '</div><div class="tmf-sz-hint">本页只承接政务议题的读取、筛选、裁断、召对、密问与转诏入口；近事、邸报、人物和势力活动归事件栏。</div>';
    return moduleShell('shizheng', '御案时政', '时局要务、待裁议题、召对密问与裁断记录', left, main, right);
  }

  function renderWenduiModule(){
    var people = getPeople().filter(function(p){
      return /京|宫|朝|内廷|在朝|在京/.test(String(p.location || '') + String(p.status || '') + String(p.group || '') + String(p.office || ''));
    }).slice(0, 18);
    if (!people.length) people = getPeople().slice(0, 18);
    var left = '<h3>可召臣僚</h3><div class="tmf-module-scroll compact">' + people.map(function(p){
      return '<button class="tmf-person-pick" data-module-action="select-person" data-id="' + esc(personKey(p)) + '"><b>' + esc(p.name || personKey(p)) + '</b><span>' + esc(p.office || p.title || p.faction || '') + '</span></button>';
    }).join('') + '</div>';
    var main = '<h3>御前问对</h3><div class="tmf-prose">选择臣僚后，可在此记录问对主题、风险与后续旨意。正式接入时由这里生成问对上下文，而不是打开旧问对标签页。</div><div class="tmf-letter-editor"><textarea>朕欲问边饷、阉党、民变三事，卿据实陈奏。</textarea></div>';
    var right = '<h3>问对结果</h3>' + miniRows([['写入','人物记忆'],['联动','诏书 / 朝议 / 史官'],['限制','远方人物转鸿雁'],['状态','待问']]);
    return moduleShell('wendui', '政务问对', '正式页内问对面板，读取人物、在京状态、记忆与后续动作', left, main, right);
  }

  function renderChaoyiModule(options){
    var mode = options.mode || 'tingyi';
    var titles = { routine:'常朝', tingyi:'廷议', yuqian:'御前会议' };
    var issues = getIssues();
    var left = '<h3>朝议类型</h3><div class="tmf-module-stack"><button class="' + (mode === 'routine' ? 'active' : '') + '" data-module-action="toast" data-text="已选择常朝">常朝</button><button class="' + (mode === 'tingyi' ? 'active' : '') + '" data-module-action="toast" data-text="已选择廷议">廷议</button><button class="' + (mode === 'yuqian' ? 'active' : '') + '" data-module-action="toast" data-text="已选择御前会议">御前会议</button></div>';
    var main = '<h3>' + esc(titles[mode] || '廷议') + '</h3><div class="tmf-chaoyi-scene"><img src="' + esc(asset(mode === 'routine' ? 'chaoyi-changchao-scene-v1.png' : (mode === 'yuqian' ? 'chaoyi-yuqian-scene-v1.png' : 'chaoyi-tingyi-scene-v1.png'))) + '" alt=""></div><div class="tmf-module-scroll compact">' + issues.map(function(x){
      return '<article class="tmf-module-item"><b>' + esc(x.title) + '</b><span>' + esc(x.category) + ' · ' + esc(x.severity) + '</span></article>';
    }).join('') + '</div>';
    var right = '<h3>流程</h3>' + miniRows([['一','选朝议类型'],['二','择议题'],['三','臣僚发言'],['四','形成裁断']]);
    return moduleShell('chaoyi', '朝会', '常朝、廷议、御前会议三类流程在正式页内展开', left, main, right);
  }

  function renderKejuModule(){
    return moduleShell('keju', '科举', '承接旧科举标签页：贡院、会试、殿试、录取、人才入库',
      '<h3>科场</h3>' + miniRows([['本期','未开科'],['贡士','待录'],['主考','未定'],['舞弊风险','未核']]),
      '<h3>开科流程</h3><div class="tmf-shizheng-grid"><article><b>会试</b><p>定主考、定题目、纳入士子。</p><button data-module-action="toast" data-text="已记录会试筹备">筹备</button></article><article><b>殿试</b><p>皇帝亲策，按名次授官。</p><button data-module-action="toast" data-text="已记录殿试筹备">筹备</button></article></div>',
      '<h3>人才联动</h3>' + miniRows([['入人物图志','是'],['入官制','可授官'],['入史官','可归档'],['影响','文事 / 士林']])
    );
  }

  function renderWenshiModule(){
    return moduleShell('wenshi', '文事', '承接旧文事标签页：文苑、著述、士论、教化与文治影响',
      '<h3>文事门类</h3><div class="tmf-module-stack"><button>文苑</button><button>士论</button><button>教化</button></div>',
      '<h3>文治记录</h3><div class="tmf-prose">当前暂无正式文事记录。后续从科举、人物著述、诏令与奏疏中自动归档。</div>',
      '<h3>联动字段</h3>' + miniRows([['士林','待估'],['文教','待估'],['清议','待估'],['著述','自动摘入']])
    );
  }

  function renderFinanceModule(){
    var g = (window.GM && GM.guoku) || {};
    var n = (window.GM && GM.neitang) || {};
    return moduleShell('finance', '户部财计', '正式页内国库、内帑、收入支出与风险；完整账册沿用旧国库面板',
      '<h3>库藏</h3>' + miniRows([['太仓银', g.stockMoney || g.money],['太仓粮', g.stockGrain || g.grain],['内帑银', n.money || n.balance],['本回合', getTurnText(window.GM && GM.turn)]]),
      '<h3>收支</h3>' + miniRows([['本期收入', g.turnIncome || g.monthlyIncome],['本期支出', g.turnExpense || g.monthlyExpense],['军饷', g.armyExpense || '待核'],['宗禄', g.royalExpense || '待核'],['风险', g.risk || '待核'],['可支月数', g.months || '待估']]),
      '<h3>动作</h3><div class="tmf-module-stack"><button data-module-action="finance-full">打开完整帑廪</button><button data-module-action="finance-old" data-method="extraTax">加派钱粮</button><button data-module-action="finance-old" data-method="openGranary">开仓赈济</button><button data-module-action="finance-old" data-method="loan">借贷筹款</button><button data-module-action="toast" data-text="已记录拨内帑">拨内帑</button><button data-module-action="toast" data-text="已记录核饷">核饷</button><button data-module-action="toast" data-text="已转御案时政">转御案时政</button></div>'
    );
  }

  function renderOfficeModule(){
    var people = getPeople().slice(0, 16);
    return moduleShell('office', '官制衙门', '正式页内承接官制树、任免、荐贤与钉选人物',
      '<h3>职官候选</h3><div class="tmf-module-scroll compact">' + people.map(function(p){ return '<button class="tmf-person-pick" data-module-action="select-person" data-id="' + esc(personKey(p)) + '"><b>' + esc(p.name || personKey(p)) + '</b><span>' + esc(p.office || p.title || '') + '</span></button>'; }).join('') + '</div>',
      '<h3>官制操作</h3><div class="tmf-shizheng-grid"><article><b>任免</b><p>选择人物与官缺，形成任免草案。</p><button data-module-action="toast" data-text="已记录任免草案">拟任</button></article><article><b>廷推</b><p>由臣僚推荐候选，进入朝议。</p><button data-module-action="toast" data-text="已记录廷推">廷推</button></article></div>',
      '<h3>联动</h3>' + miniRows([['人物图志','候选读取'],['御案时政','人事议题'],['史官实录','任免入档'],['变量','吏治/皇权']])
    );
  }

  function installDeskPanelExactStyles(){
    var st = document.getElementById('tm-phase8-desk-panel-style');
    if (!st) {
      st = document.createElement('style');
      st.id = 'tm-phase8-desk-panel-style';
      document.head.appendChild(st);
    }
    st.textContent = [
      'body.tm-phase8-formal .tm-desk-overlay{position:fixed;inset:0;z-index:10020;background:rgba(8,6,4,.58);backdrop-filter:blur(2px);display:flex;align-items:center;justify-content:center;color:#eadfbd;font-family:"STKaiti","KaiTi","楷体",serif;}',
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
      'body.tm-phase8-formal .tm-desk-item span{display:block;margin-top:4px;color:rgba(232,220,187,.55);font-size:11px;line-height:1.45;}',
      'body.tm-phase8-formal .tm-desk-item.hot{border-color:rgba(198,78,55,.38);box-shadow:inset 3px 0 rgba(198,78,55,.36);}',
      'body.tm-phase8-formal .tm-desk-title{margin:0 0 10px;color:#f2d98d;font-size:18px;letter-spacing:.14em;}',
      'body.tm-phase8-formal .tm-desk-subtitle{margin:12px 0 7px;color:#d8bd76;font-size:13px;letter-spacing:.12em;}',
      'body.tm-phase8-formal .tm-desk-field{display:grid;grid-template-columns:76px minmax(0,1fr);gap:8px;align-items:center;margin-bottom:8px;color:rgba(232,220,187,.68);font-size:12px;}',
      'body.tm-phase8-formal .tm-desk-field input,body.tm-phase8-formal .tm-desk-field select,body.tm-phase8-formal .tm-desk-pane textarea,body.tm-phase8-formal .tm-desk-input{width:100%;box-sizing:border-box;border:1px solid rgba(201,160,69,.20);background:rgba(0,0,0,.22);color:#eadfbd;padding:8px;font-family:inherit;}',
      'body.tm-phase8-formal .tm-desk-pane textarea{min-height:170px;line-height:1.7;resize:vertical;}',
      'body.tm-phase8-formal .tm-desk-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;}',
      'body.tm-phase8-formal .tm-desk-stat{border:1px solid rgba(201,160,69,.16);background:rgba(0,0,0,.18);padding:8px;}',
      'body.tm-phase8-formal .tm-desk-stat span{display:block;color:rgba(232,220,187,.52);font-size:11px;}',
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
    ].join('\n');
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
    ov.addEventListener('click', function(e){
      if (e.target === ov || (e.target && e.target.closest && e.target.closest('[data-close-bridge]'))) {
        closeDeskOverlay();
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
        return;
      }
      var recordSearch = e.target && e.target.closest ? e.target.closest('[data-desk-record-search]') : null;
      if (recordSearch) {
        state.recordSearch = String(recordSearch.value || '');
        applyFormalRecordSearch(ov, state.recordSearch);
        return;
      }
      var draft = e.target && e.target.closest ? e.target.closest('[data-letter-draft-field]') : null;
      if (draft) {
        updateFormalLetterDraft(draft);
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
  }

  function captureDeskOverlayState(root){
    if (!root || !root.querySelectorAll) return;
    Array.prototype.forEach.call(root.querySelectorAll('[data-letter-draft-field]'), updateFormalLetterDraft);
    Array.prototype.forEach.call(root.querySelectorAll('[data-desk-edict-cat],[data-desk-edict-body],[data-desk-player-action],#edict-pol,#edict-mil,#edict-dip,#edict-eco,#edict-oth,#xinglu-pub'), updateFormalEdictDraft);
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

  function deskRecord(type, title, text, tags){
    var gm = deskGM();
    var turn = Number(gm.turn || 1);
    var date = deskDateText(turn);
    var clean = compactText(text || title || '', 240);
    if (!clean) return;
    deskArray(gm, 'qijuHistory').unshift({ turn: turn, date: date, content: '【' + type + '】' + clean });
    deskArray(gm, '_chronicle').push({
      turn: turn,
      date: date,
      type: type,
      title: title || type,
      text: clean,
      tags: tags || [type]
    });
    if (window.EB && Array.isArray(EB.items)) {
      EB.items.unshift({ turn: turn, date: date, type: type, title: title || type, text: clean });
      if (EB.items.length > 120) EB.items.length = 120;
    } else {
      try { if (typeof window.addEB === 'function') window.addEB(type, clean); } catch(_) {}
    }
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
    return true;
  }

  function deskPublishEdict(){
    var gm = deskGM();
    var body = deskEdictBodyValue();
    if (!body) { toast('请先写下诏令正文'); return; }
    state.playerAction = deskValue('#xinglu-pub', deskValue('[data-desk-player-action]', state.playerAction || '')).trim();
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
    deskDecision('edict', body, '已进入诏令追踪，后续过回合推演会读取执行与阻力');
    state.edictDraft = [];
    state.edictDrafts = {};
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
    if (decision === 'hold') {
      m.status = 'pending_review';
      m.reply = reply || '再议';
      m._commitApplied = false;
    } else if (typeof window._stageMemorialDecision === 'function') {
      window._stageMemorialDecision(m, decision, reply);
    } else {
      m.status = decision;
      m.reply = reply;
      m._commitApplied = false;
      var approved = deskArray(gm, '_approvedMemorials');
      approved.push({ from: m.from, type: m.type, content: m.content || m.text || '', turn: gm.turn || 1, reply: reply, action: decision });
      if (approved.length > 30) approved.shift();
    }
    deskRecord('朱批', (m.title || m.topic || '奏疏批复'), (m.from || '臣工') + '所奏：' + compactText(m.content || m.text || m.body || '', 100) + '。朱批：' + reply, ['奏疏','朱批']);
    deskDecision('memorial', (m.from || '臣工') + '所奏：' + (m.title || m.topic || compactText(m.content || m.text || '', 30)), '决定：' + decision + '；过回合前奏疏提交器会落实记忆与回传');
    if (decision !== 'hold') deskRemember(m.from, '奏疏已得朱批：' + reply, decision === 'rejected' ? '忧' : '敬', 5);
    deskRefreshLegacy();
    toast(decision === 'approved' ? '已准奏，过回合前生效' : decision === 'rejected' ? '已驳回，过回合前生效' : decision === 'court_debate' ? '已发交廷议' : decision === 'referred' ? '已转交有司' : decision === 'hold' ? '已留中' : '已批示');
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
    openHongyanPreviewPanel();
  }

  function deskSendLetter(draftOnly){
    var gm = deskGM();
    var to = deskValue('[data-desk-letter-to]', (gm._pendingLetterTo || '')).trim();
    if (!to) { toast('请先选择收信人'); return; }
    var selfName = (window.P && P.playerInfo && P.playerInfo.characterName) || '';
    if (selfName && to === selfName) { toast('不能自寄信函'); return; }
    var body = deskValue('[data-desk-letter-body]', '').trim();
    if (!body) { toast('请先写下书信正文'); return; }
    var letterType = deskValue('[data-desk-letter-type]', 'personal') || 'personal';
    var urgency = deskValue('[data-desk-letter-urgency]', 'normal') || 'normal';
    var cipher = deskValue('[data-desk-letter-cipher]', 'none') || 'none';
    var sendMode = deskValue('[data-desk-letter-sendmode]', 'multi_courier') || 'multi_courier';
    var capital = gm._capital || '京城';
    var ch = (typeof window.findCharByName === 'function') ? window.findCharByName(to) : findPerson(to);
    var toLoc = (ch && ch.location) || capital;
    var dpv = 30;
    try { if (typeof window._getDaysPerTurn === 'function') dpv = Math.max(1, Number(window._getDaysPerTurn()) || 30); } catch(_) {}
    var days = 5;
    try { if (typeof window.calcLetterDays === 'function') days = Math.max(1, Number(window.calcLetterDays(capital, toLoc, urgency)) || 5); } catch(_) {}
    if (sendMode === 'secret_agent') days = Math.ceil(days * 1.5);
    var deliveryTurns = Math.max(1, Math.ceil(days / dpv));
    var replyDays = days * 2 + 3;
    var replyTurns = Math.max(deliveryTurns + 1, Math.ceil(replyDays / dpv));
    var nowDay = (typeof window.getCurrentGameDay === 'function') ? window.getCurrentGameDay() : (((gm.turn || 1) - 1) * dpv);
    var typeLabel = letterTypeLabelFormal(letterType);
    var letter = {
      id: deskId(draftOnly ? 'ltr_draft' : 'ltr'),
      from: '玩家',
      to: to,
      fromLocation: capital,
      toLocation: toLoc,
      title: typeLabel + '·' + to,
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
      status: draftOnly ? 'draft' : 'traveling',
      urgency: urgency,
      letterType: letterType,
      _npcInitiated: false,
      _replyExpected: true,
      _cipher: cipher,
      _sendMode: sendMode,
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
        target: to,
        letterId: letter.id
      });
    }
    if (!draftOnly) {
      deskArray(gm, 'letters').forEach(function(l){
        if (l && l._npcInitiated && l.from === to && l._replyExpected && !l._playerReplied) {
          l._playerReplied = true;
          l._repliedTurn = gm.turn || 1;
          l._repliedByDesk = true;
        }
      });
      deskRemember(to, '收到御前鸿雁：' + compactText(body, 50), letterType === 'formal_edict' || letterType === 'military_order' ? '敬' : '平', 5);
      if (Array.isArray(gm.qijuHistory)) {
        gm.qijuHistory.unshift({ turn: gm.turn || 1, date: deskDateText(gm.turn || 1), content: '【鸿雁传书】遣' + letterUrgencyLabelFormal(urgency) + '致' + to + '（' + typeLabel + (cipher !== 'none' ? '·' + letterCipherLabelFormal(cipher) : '') + '）。内容：' + body });
      }
    }
    deskRecord('鸿雁', (draftOnly ? '草函' : '遣使') + '致' + to, body, ['鸿雁', typeLabel, letterUrgencyLabelFormal(urgency)]);
    deskDecision('letter', (draftOnly ? '草拟' : '遣使') + '致' + to + '：' + compactText(body, 80), draftOnly ? '保存为鸿雁草稿' : '进入 GM.letters，由驿递与回信系统结算');
    gm._pendingLetterTo = to;
    state.letterDraft = state.letterDraft || {};
    state.letterDraft.to = to;
    state.letterDraft.type = letterType;
    state.letterDraft.urgency = urgency;
    state.letterDraft.cipher = cipher;
    state.letterDraft.sendMode = sendMode;
    if (!draftOnly) state.letterDraft.body = '';
    deskRefreshLegacy();
    toast(draftOnly ? '鸿雁草稿已保存' : '信函已发出，驿递系统会继续结算');
    openHongyanPreviewPanel();
  }

  function deskStoreLetterMemory(){
    var gm = deskGM();
    var to = deskValue('[data-desk-letter-to]', (gm._pendingLetterTo || '')).trim();
    var body = deskValue('[data-desk-letter-body]', '').trim();
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
    } else if (action === 'memorial-filter-desk') {
      state.memorialFilter = data.filter || 'all';
      openYueZouPreviewPanel();
    } else if (action === 'memorial-decision-desk') {
      deskStageMemorial(data.id || '', data.decision || 'annotated', data.replyid || '');
    } else if (action === 'memorial-edict-desk') {
      deskMemorialToEdict(data.id || '');
    } else if (action === 'memorial-summon-desk') {
      closeDeskOverlay();
      openModule('wendui');
    } else if (action === 'letter-target-desk') {
      deskTargetLetter(data.name || data.id || '');
    } else if (action === 'letter-filter-desk') {
      state.letterFilter = data.filter || 'all';
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
        window._chooseIssueOption(data.id || '', Number(data.choice || 0));
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
    st.textContent = [
      'body.tm-phase8-formal .tm-bridge-overlay{position:fixed;inset:0;z-index:10030;display:block;background:rgba(8,6,4,.52);backdrop-filter:blur(2px);color:#eadfbd;font-family:"STKaiti","KaiTi",serif;}',
      'body.tm-phase8-formal .tm-bridge-scrim{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 20%,rgba(201,160,69,.10),transparent 44%),rgba(0,0,0,.34);}',
      'body.tm-phase8-formal .tm-bridge-panel{position:absolute;box-sizing:border-box;}',
      'body.tm-phase8-formal .tm-action-panel{left:58px;top:74px;width:min(1080px,calc(100vw - 132px));height:min(720px,calc(100vh - 118px));overflow:visible;transform:translateX(-12px);transition:transform .18s ease,opacity .18s ease;opacity:.98;}',
      'body.tm-phase8-formal .tm-bridge-overlay.show .tm-action-panel{transform:translateX(0);}',
      'body.tm-phase8-formal .tm-action-panel.edict-shell{left:50%;top:70px;width:min(1120px,calc(100vw - 166px));height:min(730px,calc(100vh - 118px));transform:translate(-50%,10px);}',
      'body.tm-phase8-formal .tm-bridge-overlay.show .tm-action-panel.edict-shell{transform:translate(-50%,0);}',
      'body.tm-phase8-formal .tm-action-panel.memorial-shell{left:92px;top:78px;width:min(1060px,calc(100vw - 154px));height:min(700px,calc(100vh - 122px));}',
      'body.tm-phase8-formal .tm-action-panel.letter-shell{left:50%;top:76px;width:min(1220px,calc(100vw - 116px));height:min(744px,calc(100vh - 118px));transform:translate(-50%,10px);}',
      'body.tm-phase8-formal .tm-bridge-overlay.show .tm-action-panel.letter-shell{transform:translate(-50%,0);}',
      'body.tm-phase8-formal .tm-action-panel.records-shell{left:64px;top:88px;width:min(1080px,calc(100vw - 132px));height:min(690px,calc(100vh - 136px));}',
      'body.tm-phase8-formal .tm-action-panel .tm-floating-close{position:absolute;right:18px;top:16px;z-index:5;width:34px;height:34px;border-radius:50%;border:1px solid rgba(201,160,69,.38);color:#f5df9d;background:linear-gradient(180deg,rgba(54,37,22,.95),rgba(12,9,7,.95));box-shadow:0 8px 22px rgba(0,0,0,.42);cursor:pointer;font-size:20px;line-height:30px;}',
      'body.tm-phase8-formal .tm-action-panel.edict-shell .tm-floating-close{top:20px;right:24px;color:#3a2818;background:linear-gradient(180deg,#f0d989,#bb873a);border-color:rgba(68,43,19,.32);}',
      'body.tm-phase8-formal .tm-action-panel>.tm-action-body{height:100%;min-height:0;}',
      'body.tm-phase8-formal .tm-action-panel.edict-shell .ed-panel-wrap{height:100%;box-sizing:border-box;overflow:auto;border:1px solid rgba(201,160,69,.28);box-shadow:0 24px 58px rgba(0,0,0,.52);}',
      'body.tm-phase8-formal .tm-action-panel.edict-shell .ed-panel-wrap>div{min-height:100%;}',
      'body.tm-phase8-formal .tm-action-panel.edict-shell .ed-action-bar{padding-bottom:14px;}',
      'body.tm-phase8-formal .tm-chip-row{display:inline-flex;align-items:center;gap:5px;flex-wrap:wrap;}',
      'body.tm-phase8-formal .tm-chip{display:inline-flex;align-items:center;justify-content:center;min-height:18px;padding:1px 7px;border:1px solid rgba(201,160,69,.18);border-radius:999px;color:rgba(240,226,184,.78);background:rgba(255,245,210,.045);font-size:10.5px;line-height:1.2;white-space:nowrap;}',
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
      'body.tm-phase8-formal .tm-stat span{display:block;color:rgba(232,220,187,.50);font-size:10.5px;}',
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
      'body.tm-phase8-formal .edict-old-card-head b{display:block;color:#f0d892;font-size:13px;} body.tm-phase8-formal .edict-old-card-head span span{display:block;margin-top:3px;color:rgba(224,211,171,.56);font-size:10.5px;}',
      'body.tm-phase8-formal .edict-old-forecast{margin-top:7px;color:rgba(232,220,187,.62);font-size:11px;line-height:1.45;}',
      'body.tm-phase8-formal .edict-old-bar{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:12px 0;padding:10px;border:1px solid rgba(201,160,69,.16);background:rgba(0,0,0,.16);}',
      'body.tm-phase8-formal .edict-xingzhi,body.tm-phase8-formal .edict-old-section{margin-top:12px;padding:10px;border:1px solid rgba(201,160,69,.16);background:rgba(0,0,0,.12);}',
      'body.tm-phase8-formal .edict-xingzhi-head b{display:block;color:#f0d892;font-size:13px;} body.tm-phase8-formal .edict-xingzhi-head span{display:block;margin:4px 0 8px;color:rgba(232,220,187,.58);font-size:11px;}',
      'body.tm-phase8-formal .edict-old-archive{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;}',
      'body.tm-phase8-formal .edict-sug-v2{display:grid;grid-template-columns:44px minmax(0,1fr);gap:9px;margin-bottom:9px;padding:9px;border:1px solid rgba(201,160,69,.16);border-radius:4px;background:linear-gradient(180deg,rgba(255,246,216,.055),rgba(255,246,216,.025)),rgba(0,0,0,.14);}',
      'body.tm-phase8-formal .edict-sug-portrait{width:42px;height:52px;object-fit:cover;border:1px solid rgba(201,160,69,.22);background:rgba(0,0,0,.20);}',
      'body.tm-phase8-formal .edict-sug-v2 b{display:block;color:#f0d892;font-size:12px;} body.tm-phase8-formal .edict-sug-v2 p{margin:5px 0 7px;color:rgba(236,226,193,.76);font-size:11.5px;line-height:1.48;}',
      'body.tm-phase8-formal .edict-sug-footer{display:flex;align-items:center;justify-content:space-between;gap:8px;} body.tm-phase8-formal .edict-sug-adopt{min-height:24px;padding:2px 9px;border:1px solid rgba(213,92,64,.34);color:#fff0c9;background:linear-gradient(180deg,#7f3528,#331612);font-family:inherit;font-size:11px;cursor:pointer;}',
      'body.tm-phase8-formal .edict-sug-delete{margin-left:5px;min-width:24px;min-height:24px;border:1px solid rgba(201,160,69,.18);color:rgba(232,220,187,.58);background:rgba(0,0,0,.20);font-family:inherit;font-size:14px;line-height:1;cursor:pointer;} body.tm-phase8-formal .edict-sug-delete:hover{color:#f0a082;border-color:rgba(213,92,64,.40);}',
      'body.tm-phase8-formal .edict-old-label{display:block;margin-bottom:4px;color:rgba(224,211,171,.62);font-size:10.5px;letter-spacing:.12em;}',
      'body.tm-phase8-formal .edict-polish-scroll{position:relative;margin-top:12px;padding:16px 92px 14px 18px;border:1px solid rgba(201,160,69,.22);background:linear-gradient(180deg,rgba(239,215,150,.10),rgba(255,245,210,.035)),rgba(0,0,0,.16);}',
      'body.tm-phase8-formal .edict-polish-title{position:absolute;right:18px;top:16px;writing-mode:vertical-rl;color:#f0d892;letter-spacing:.35em;font-size:18px;} body.tm-phase8-formal .edict-polish-text{width:100%;min-height:130px;border:0;background:transparent;color:#f5e9c6;font-family:"STKaiti","KaiTi",serif;font-size:14px;line-height:1.85;resize:vertical;}',
      'body.tm-phase8-formal .edict-polish-actions{display:flex;gap:7px;margin-top:8px;} body.tm-phase8-formal .edict-polish-seal{position:absolute;right:30px;bottom:18px;width:44px;height:44px;display:grid;place-items:center;border:1px solid rgba(213,92,64,.50);border-radius:50%;color:#d66a50;font-size:10px;opacity:.82;}',
      'body.tm-phase8-formal .edict-xingzhi-row{display:grid;grid-template-columns:72px minmax(0,1fr);gap:8px;padding:5px 0;border-top:1px solid rgba(201,160,69,.12);font-size:11.5px;}',
      'body.tm-phase8-formal .memorial-office-v4,body.tm-phase8-formal .hy-office-v4,body.tm-phase8-formal .records-cabinet-v4{height:100%;box-sizing:border-box;position:relative;overflow:hidden;}',
      'body.tm-phase8-formal .memorial-office-v4{display:grid;grid-template-columns:292px minmax(0,1fr);gap:16px;padding:18px;border:1px solid rgba(185,144,71,.42);background:radial-gradient(ellipse at 24% 0,rgba(154,47,33,.15),transparent 42%),radial-gradient(ellipse at 92% 10%,rgba(211,167,82,.10),transparent 36%),linear-gradient(135deg,rgba(42,26,18,.98),rgba(11,8,7,.96));}',
      'body.tm-phase8-formal .memorial-cases-v4,body.tm-phase8-formal .hy-roster-v4,body.tm-phase8-formal .hy-compose-v4,body.tm-phase8-formal .records-spine-v4{min-height:0;overflow:auto;scrollbar-color:rgba(201,160,69,.48) rgba(0,0,0,.22);}',
      'body.tm-phase8-formal .memorial-cases-v4{padding:12px;border:1px solid rgba(201,160,69,.18);border-left:6px solid rgba(126,31,24,.76);background:linear-gradient(180deg,rgba(0,0,0,.28),rgba(255,245,210,.035)),repeating-linear-gradient(0deg,rgba(255,255,255,.025) 0 1px,transparent 1px 34px);}',
      'body.tm-phase8-formal .tm-panel-v4-title{display:grid;grid-template-columns:42px minmax(0,1fr);gap:9px;align-items:center;margin-bottom:12px;}',
      'body.tm-phase8-formal .tm-panel-v4-title .seal{width:40px;height:40px;display:grid;place-items:center;border:1px solid rgba(211,169,82,.38);color:#f1d98d;background:radial-gradient(circle,rgba(152,45,31,.34),rgba(24,13,8,.92) 70%);font-size:20px;}',
      'body.tm-phase8-formal .tm-panel-v4-title b{display:block;color:#f2d990;font-size:19px;letter-spacing:.10em;} body.tm-phase8-formal .tm-panel-v4-title span:not(.seal){display:block;margin-top:4px;color:rgba(232,217,176,.56);font-size:11px;}',
      'body.tm-phase8-formal .memorial-filter-v4{display:grid;gap:7px;} body.tm-phase8-formal .memorial-filter-v4 button,body.tm-phase8-formal .hy-person-v4,body.tm-phase8-formal .records-tab-v4{width:100%;border:1px solid rgba(201,160,69,.16);color:#eadfbd;background:rgba(255,245,210,.035);cursor:pointer;text-align:left;font-family:inherit;}',
      'body.tm-phase8-formal .memorial-filter-v4 button{display:grid;grid-template-columns:26px minmax(0,1fr) auto;gap:8px;align-items:center;min-height:43px;padding:7px 8px;} body.tm-phase8-formal .memorial-filter-v4 button.active,body.tm-phase8-formal .hy-person-v4.active,body.tm-phase8-formal .records-tab-v4.active{border-color:rgba(239,201,116,.52);background:linear-gradient(90deg,rgba(122,45,32,.34),rgba(255,245,210,.045));box-shadow:inset 2px 0 0 rgba(214,169,82,.80);}',
      'body.tm-phase8-formal .memorial-filter-v4 i{width:24px;height:24px;display:grid;place-items:center;border-radius:50%;border:1px solid rgba(201,160,69,.24);color:#f0d892;font-style:normal;font-size:12px;}',
      'body.tm-phase8-formal .memorial-filter-v4 b,body.tm-phase8-formal .hy-person-v4 b,body.tm-phase8-formal .records-tab-v4 b{display:block;color:#f0d892;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      'body.tm-phase8-formal .memorial-filter-v4 span,body.tm-phase8-formal .hy-person-v4 span,body.tm-phase8-formal .records-tab-v4 span{display:block;margin-top:3px;color:rgba(224,211,171,.54);font-size:10px;}',
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
      'body.tm-phase8-formal .hy-region-v4{margin:10px 0 5px;color:rgba(240,214,141,.82);font-size:10.5px;letter-spacing:.14em;} body.tm-phase8-formal .hy-person-v4{display:grid;grid-template-columns:30px minmax(0,1fr) auto;gap:8px;align-items:center;min-height:45px;padding:7px 8px;margin-bottom:6px;} body.tm-phase8-formal .hy-face-v4{width:28px;height:28px;display:grid;place-items:center;border:1px solid rgba(126,184,167,.30);border-radius:50%;color:#d7f0df;background:radial-gradient(circle,rgba(126,184,167,.22),rgba(13,24,22,.92));}',
      'body.tm-phase8-formal .hy-thread-v4{min-height:0;overflow:auto;padding:12px;scrollbar-color:rgba(126,184,167,.44) rgba(0,0,0,.22);} body.tm-phase8-formal .hy-contact-head-v4{display:grid;grid-template-columns:54px minmax(0,1fr) auto;gap:10px;align-items:center;margin-bottom:10px;padding:10px;border:1px solid rgba(126,184,167,.18);background:linear-gradient(90deg,rgba(126,184,167,.12),rgba(255,245,210,.035));}',
      'body.tm-phase8-formal .hy-contact-head-v4 .portrait{width:50px;height:50px;display:grid;place-items:center;border:1px solid rgba(126,184,167,.36);color:#e8f6df;background:radial-gradient(circle,rgba(126,184,167,.28),rgba(11,19,18,.92));font-size:22px;} body.tm-phase8-formal .hy-contact-head-v4 b{color:#f0d892;font-size:15px;} body.tm-phase8-formal .hy-contact-head-v4 span{display:block;margin-top:4px;color:rgba(224,211,171,.58);font-size:11px;}',
      'body.tm-phase8-formal .hy-message-v4{margin-bottom:9px;padding:10px 11px;border:1px solid rgba(126,184,167,.16);background:rgba(255,245,210,.045);} body.tm-phase8-formal .hy-message-v4.out{margin-left:46px;border-right:2px solid rgba(126,184,167,.55);} body.tm-phase8-formal .hy-message-v4.in{margin-right:46px;border-left:2px solid rgba(213,92,64,.52);} body.tm-phase8-formal .hy-message-v4 b{display:block;color:#f0d892;font-size:12px;} body.tm-phase8-formal .hy-message-v4 p{margin:7px 0;color:rgba(238,228,197,.78);font-size:12.5px;line-height:1.58;}',
      'body.tm-phase8-formal .hy-message-v4.transit{border-color:rgba(126,184,167,.30);background:rgba(69,120,100,.10);} body.tm-phase8-formal .hy-message-v4.lost,body.tm-phase8-formal .hy-message-v4.intercepted{border-color:rgba(213,92,64,.34);background:rgba(126,31,24,.16);}',
      'body.tm-phase8-formal .hy-filterbar-v4{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px;} body.tm-phase8-formal .hy-filterbar-v4 button{min-height:26px;padding:3px 9px;border:1px solid rgba(126,184,167,.18);color:#d9eddf;background:rgba(255,245,210,.035);font-family:inherit;font-size:11px;cursor:pointer;} body.tm-phase8-formal .hy-filterbar-v4 button.active{border-color:rgba(126,184,167,.42);background:linear-gradient(180deg,rgba(58,104,86,.44),rgba(13,24,22,.66));}',
      'body.tm-phase8-formal .hy-intercept-v4{margin-top:12px;padding-top:10px;border-top:1px solid rgba(126,184,167,.18);}',
      'body.tm-phase8-formal .hy-compose-v4 label{display:block;margin-bottom:8px;} body.tm-phase8-formal .hy-compose-v4 label span{display:block;margin-bottom:4px;color:rgba(224,211,171,.58);font-size:10.5px;}',
      'body.tm-phase8-formal .hy-office-v5{height:100%;box-sizing:border-box;display:grid;grid-template-columns:286px minmax(0,1fr) 284px;gap:14px;padding:16px;border:1px solid rgba(126,184,167,.36);background:radial-gradient(ellipse at 76% 4%,rgba(126,184,167,.14),transparent 42%),radial-gradient(ellipse at 18% 0,rgba(201,160,69,.08),transparent 36%),linear-gradient(180deg,rgba(22,31,29,.98),rgba(8,10,9,.97));overflow:hidden;}',
      'body.tm-phase8-formal .hy-contact-pane-v5,body.tm-phase8-formal .hy-compose-card-v5,body.tm-phase8-formal .hy-thread-card-v5,body.tm-phase8-formal .hy-inbox-pane-v5{min-height:0;border:1px solid rgba(126,184,167,.18);background:linear-gradient(180deg,rgba(255,245,210,.045),rgba(0,0,0,.12)),rgba(0,0,0,.18);box-shadow:inset 0 1px 0 rgba(255,245,210,.05);}',
      'body.tm-phase8-formal .hy-contact-pane-v5{display:grid;grid-template-rows:auto auto minmax(0,1fr);padding:12px;overflow:hidden;}',
      'body.tm-phase8-formal .hy-search-v5{margin-bottom:10px;} body.tm-phase8-formal .hy-roster-scroll-v5{min-height:0;overflow:auto;padding-right:4px;scrollbar-color:rgba(126,184,167,.44) rgba(0,0,0,.22);} body.tm-phase8-formal .hy-region-group-v5{margin-bottom:9px;}',
      'body.tm-phase8-formal .hy-person-v5{width:100%;display:grid;grid-template-columns:48px minmax(0,1fr) auto;gap:9px;align-items:center;min-height:64px;margin-bottom:7px;padding:7px 8px;border:1px solid rgba(126,184,167,.18);color:#eadfbd;background:rgba(255,245,210,.035);cursor:pointer;text-align:left;font-family:inherit;}',
      'body.tm-phase8-formal .hy-person-v5.active{border-color:rgba(239,201,116,.52);background:linear-gradient(90deg,rgba(58,104,86,.46),rgba(255,245,210,.055));box-shadow:inset 3px 0 0 rgba(126,184,167,.82);} body.tm-phase8-formal .hy-person-v5:hover{border-color:rgba(126,184,167,.38);background:rgba(126,184,167,.075);}',
      'body.tm-phase8-formal .hy-face-v5{width:46px;height:54px;object-fit:cover;border:1px solid rgba(126,184,167,.32);background:rgba(0,0,0,.28);box-shadow:0 5px 12px rgba(0,0,0,.24);} body.tm-phase8-formal .hy-person-main-v5{min-width:0;} body.tm-phase8-formal .hy-person-main-v5 b{display:block;color:#f0d892;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;} body.tm-phase8-formal .hy-person-main-v5 span,body.tm-phase8-formal .hy-person-main-v5 i{display:block;margin-top:3px;color:rgba(232,220,187,.58);font-size:10.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-style:normal;}',
      'body.tm-phase8-formal .hy-person-counts-v5{display:flex;flex-direction:column;gap:4px;align-items:flex-end;} body.tm-phase8-formal .hy-person-counts-v5 em{min-width:20px;height:18px;display:grid;place-items:center;border:1px solid rgba(126,184,167,.24);border-radius:999px;color:#d9eddf;background:rgba(0,0,0,.18);font-size:10px;font-style:normal;} body.tm-phase8-formal .hy-person-counts-v5 em.hot{border-color:rgba(213,92,64,.38);color:#f0a082;background:rgba(126,31,24,.18);} body.tm-phase8-formal .hy-person-counts-v5 em.on{border-color:rgba(239,201,116,.42);color:#f5db96;}',
      'body.tm-phase8-formal .hy-letter-desk-v5{min-height:0;display:grid;grid-template-rows:auto minmax(0,1fr);gap:12px;overflow:hidden;}',
      'body.tm-phase8-formal .hy-compose-card-v5{padding:13px 14px;} body.tm-phase8-formal .hy-compose-card-v5>header{display:grid;grid-template-columns:64px minmax(0,1fr) auto;gap:11px;align-items:center;margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid rgba(126,184,167,.16);} body.tm-phase8-formal .hy-compose-card-v5>header img{width:60px;height:66px;object-fit:cover;border:1px solid rgba(126,184,167,.34);background:rgba(0,0,0,.25);} body.tm-phase8-formal .hy-compose-card-v5>header b{display:block;color:#f0d892;font-size:18px;} body.tm-phase8-formal .hy-compose-card-v5>header em{display:block;margin-top:4px;color:rgba(232,220,187,.60);font-size:11px;font-style:normal;}',
      'body.tm-phase8-formal .hy-route-v5{margin-bottom:10px;padding:7px 9px;border:1px solid rgba(198,139,69,.24);color:#eadbb4;background:linear-gradient(90deg,rgba(95,44,27,.34),rgba(0,0,0,.10));font-size:11.5px;line-height:1.45;}',
      'body.tm-phase8-formal .hy-compose-grid-v5{display:grid;grid-template-columns:1.1fr repeat(4,minmax(96px,.7fr));gap:8px;margin-bottom:8px;} body.tm-phase8-formal .hy-compose-grid-v5 label span{display:block;margin-bottom:4px;color:rgba(224,211,171,.58);font-size:10.5px;} body.tm-phase8-formal .hy-compose-paper-v5{min-height:104px;max-height:180px;resize:vertical;} body.tm-phase8-formal .hy-compose-actions-v5{display:flex;flex-wrap:wrap;gap:7px;align-items:center;}',
      'body.tm-phase8-formal .hy-thread-card-v5{display:grid;grid-template-rows:auto minmax(0,1fr);overflow:hidden;} body.tm-phase8-formal .hy-thread-card-v5>header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border-bottom:1px solid rgba(126,184,167,.16);background:rgba(0,0,0,.12);} body.tm-phase8-formal .hy-thread-card-v5>header b{display:block;color:#f0d892;font-size:16px;} body.tm-phase8-formal .hy-thread-card-v5>header em{display:block;margin-top:3px;color:rgba(232,220,187,.56);font-size:11px;font-style:normal;} body.tm-phase8-formal .hy-thread-scroll-v5{min-height:0;overflow:auto;padding:13px 14px 16px;scrollbar-color:rgba(126,184,167,.44) rgba(0,0,0,.22);}',
      'body.tm-phase8-formal .hy-filterbar-v5{display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end;} body.tm-phase8-formal .hy-filterbar-v5 button{min-height:26px;padding:3px 9px;border:1px solid rgba(126,184,167,.18);color:#d9eddf;background:rgba(255,245,210,.035);font-family:inherit;font-size:11px;cursor:pointer;} body.tm-phase8-formal .hy-filterbar-v5 button.active{border-color:rgba(126,184,167,.46);background:linear-gradient(180deg,rgba(58,104,86,.44),rgba(13,24,22,.66));}',
      'body.tm-phase8-formal .hy-letter-card-v5{position:relative;display:grid;grid-template-columns:42px minmax(0,1fr);gap:10px;margin-bottom:10px;padding:11px;border:1px solid rgba(126,184,167,.16);background:linear-gradient(180deg,rgba(255,245,210,.052),rgba(0,0,0,.12)),rgba(15,18,16,.74);box-shadow:0 8px 18px rgba(0,0,0,.20);} body.tm-phase8-formal .hy-letter-card-v5.out{margin-left:42px;border-right:2px solid rgba(126,184,167,.58);} body.tm-phase8-formal .hy-letter-card-v5.in{margin-right:42px;border-left:2px solid rgba(213,92,64,.48);} body.tm-phase8-formal .hy-letter-card-v5.lost,body.tm-phase8-formal .hy-letter-card-v5.intercepted{border-color:rgba(213,92,64,.38);background:rgba(126,31,24,.14);} body.tm-phase8-formal .hy-letter-card-v5.transit{border-color:rgba(126,184,167,.30);background:rgba(69,120,100,.10);}',
      'body.tm-phase8-formal .hy-letter-stamp-v5{width:38px;height:38px;display:grid;place-items:center;border:1px solid rgba(126,184,167,.32);border-radius:50%;color:#dff2e1;background:radial-gradient(circle,rgba(126,184,167,.22),rgba(13,24,22,.94));font-size:16px;} body.tm-phase8-formal .hy-letter-main-v5{min-width:0;} body.tm-phase8-formal .hy-letter-main-v5 header{display:grid;grid-template-columns:minmax(0,auto) minmax(0,1fr) auto;gap:8px;align-items:center;} body.tm-phase8-formal .hy-letter-main-v5 header b{color:#f0d892;font-size:13px;} body.tm-phase8-formal .hy-letter-main-v5 header span{color:rgba(232,220,187,.62);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;} body.tm-phase8-formal .hy-letter-main-v5 header em{color:#a8dcc5;font-size:11px;font-style:normal;}',
      'body.tm-phase8-formal .hy-letter-meta-v5{display:flex;flex-wrap:wrap;gap:5px;margin:7px 0;} body.tm-phase8-formal .hy-letter-meta-v5 span{display:inline-flex;align-items:center;min-height:18px;padding:1px 6px;border:1px solid rgba(126,184,167,.16);color:rgba(224,237,222,.72);background:rgba(255,245,210,.035);font-size:10px;} body.tm-phase8-formal .hy-letter-body-v5{white-space:pre-wrap;overflow:visible;color:rgba(242,231,202,.86);font-size:13px;line-height:1.75;padding:9px 10px;border-top:1px solid rgba(126,184,167,.12);border-bottom:1px solid rgba(126,184,167,.10);background:rgba(0,0,0,.10);} body.tm-phase8-formal .hy-letter-reply-v5{margin-top:8px;padding:9px 10px;border:1px solid rgba(201,160,69,.18);background:rgba(201,160,69,.07);} body.tm-phase8-formal .hy-letter-reply-v5 b{display:block;color:#f0d892;font-size:12px;} body.tm-phase8-formal .hy-letter-reply-v5 p{white-space:pre-wrap;margin:5px 0 0;color:rgba(242,231,202,.82);font-size:12.5px;line-height:1.65;}',
      'body.tm-phase8-formal .hy-actions-v5{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px;} body.tm-phase8-formal .hy-letter-empty-v5{padding:18px;border:1px dashed rgba(126,184,167,.24);color:rgba(232,220,187,.68);background:rgba(0,0,0,.12);} body.tm-phase8-formal .hy-letter-empty-v5 b{display:block;color:#f0d892;font-size:14px;} body.tm-phase8-formal .hy-letter-empty-v5 p{margin:7px 0 0;font-size:12.5px;line-height:1.7;}',
      'body.tm-phase8-formal .hy-inbox-pane-v5{display:grid;grid-template-rows:auto auto minmax(0,1fr);padding:12px;overflow:hidden;} body.tm-phase8-formal .hy-inbox-summary-v5{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-bottom:10px;} body.tm-phase8-formal .hy-inbox-summary-v5 span{padding:7px 8px;border:1px solid rgba(126,184,167,.14);color:rgba(232,220,187,.62);background:rgba(0,0,0,.14);font-size:11px;} body.tm-phase8-formal .hy-inbox-summary-v5 b{color:#f0d892;font-size:14px;} body.tm-phase8-formal .hy-inbox-scroll-v5{min-height:0;overflow:auto;padding-right:4px;scrollbar-color:rgba(126,184,167,.44) rgba(0,0,0,.22);}',
      'body.tm-phase8-formal .hy-inbox-item-v5{margin-bottom:10px;padding:9px;border:1px solid rgba(126,184,167,.16);background:linear-gradient(180deg,rgba(255,245,210,.050),rgba(0,0,0,.12)),rgba(10,14,13,.68);} body.tm-phase8-formal .hy-inbox-item-v5.unread{border-color:rgba(213,92,64,.32);box-shadow:inset 3px 0 0 rgba(213,92,64,.58);} body.tm-phase8-formal .hy-inbox-open-v5{width:100%;display:grid;grid-template-columns:34px minmax(0,1fr) auto;gap:8px;align-items:center;border:0;background:transparent;color:#eadfbd;text-align:left;font-family:inherit;cursor:pointer;padding:0;} body.tm-phase8-formal .hy-inbox-seal-v5{width:32px;height:32px;display:grid;place-items:center;border:1px solid rgba(126,184,167,.30);border-radius:50%;color:#dff2e1;background:radial-gradient(circle,rgba(126,184,167,.22),rgba(13,24,22,.94));} body.tm-phase8-formal .hy-inbox-open-v5 b{display:block;color:#f0d892;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;} body.tm-phase8-formal .hy-inbox-open-v5 em{display:block;margin-top:3px;color:rgba(232,220,187,.58);font-size:10.5px;font-style:normal;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;} body.tm-phase8-formal .hy-inbox-open-v5 i{padding:2px 6px;border:1px solid rgba(126,184,167,.18);border-radius:999px;color:#a8dcc5;font-size:10px;font-style:normal;background:rgba(0,0,0,.16);}',
      'body.tm-phase8-formal .hy-inbox-meta-v5{display:flex;flex-wrap:wrap;gap:5px;margin:8px 0 6px;} body.tm-phase8-formal .hy-inbox-meta-v5 span{padding:1px 6px;border:1px solid rgba(126,184,167,.14);color:rgba(224,237,222,.68);background:rgba(255,245,210,.035);font-size:10px;} body.tm-phase8-formal .hy-inbox-body-v5{white-space:pre-wrap;color:rgba(242,231,202,.80);font-size:12px;line-height:1.62;padding:7px 8px;border-top:1px solid rgba(126,184,167,.10);border-bottom:1px solid rgba(126,184,167,.08);background:rgba(0,0,0,.10);}',
      'body.tm-phase8-formal .records-cabinet-v4{display:grid;grid-template-columns:118px minmax(0,1fr);padding:16px;border:1px solid rgba(214,177,88,.36);background:radial-gradient(ellipse at 18% 0,rgba(214,177,88,.10),transparent 40%),linear-gradient(180deg,rgba(42,30,20,.98),rgba(11,9,7,.96));}',
      'body.tm-phase8-formal .records-spine-v4{padding:12px 8px;border-right:1px solid rgba(214,177,88,.22);} body.tm-phase8-formal .records-tab-v4{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px;align-items:center;min-height:82px;margin-bottom:8px;padding:8px 7px;writing-mode:vertical-rl;text-align:center;background:linear-gradient(180deg,rgba(88,55,24,.72),rgba(18,12,8,.72));}',
      'body.tm-phase8-formal .records-tab-v4 em{color:rgba(224,211,171,.48);font-style:normal;font-size:10px;} body.tm-phase8-formal .records-toolbar-v4{display:flex;align-items:center;flex-wrap:wrap;gap:7px;margin-bottom:12px;} body.tm-phase8-formal .records-grid-v4,body.tm-phase8-formal .bn-active-grid-v4{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;} body.tm-phase8-formal .records-section-v4{margin-bottom:14px;}',
      'body.tm-phase8-formal .tm-roster-group{margin:10px 0 7px;color:rgba(240,214,141,.82);font-size:11px;letter-spacing:.16em;}',
      'body.tm-phase8-formal .records-source-legend-v4{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 12px;} body.tm-phase8-formal .records-source-legend-v4 button,body.tm-phase8-formal .records-toolbar-v4 button{min-height:28px;padding:4px 10px;border:1px solid rgba(201,160,69,.20);color:#eadfbd;background:rgba(0,0,0,.18);font-family:inherit;font-size:12px;cursor:pointer;} body.tm-phase8-formal .records-source-legend-v4 button.active,body.tm-phase8-formal .records-toolbar-v4 button.active{border-color:rgba(239,201,116,.52);background:linear-gradient(180deg,rgba(122,45,32,.34),rgba(255,245,210,.045));}',
      'body.tm-phase8-formal .bn-progress-v4{height:7px;margin-top:8px;border:1px solid rgba(201,160,69,.16);background:rgba(0,0,0,.30);overflow:hidden;} body.tm-phase8-formal .bn-progress-v4 i{display:block;height:100%;background:linear-gradient(90deg,#8a3227,#dfba6f);}',
      'body.tm-phase8-formal .records-cabinet-v5{height:100%;box-sizing:border-box;display:grid;grid-template-columns:176px minmax(0,1fr) 296px;gap:14px;padding:16px;border:1px solid rgba(214,177,88,.38);background:radial-gradient(ellipse at 16% 0,rgba(214,177,88,.12),transparent 42%),radial-gradient(ellipse at 86% 8%,rgba(126,31,24,.13),transparent 36%),linear-gradient(180deg,rgba(42,30,20,.985),rgba(10,8,7,.97));overflow:hidden;}',
      'body.tm-phase8-formal .records-spine-v5,body.tm-phase8-formal .records-paper-v5,body.tm-phase8-formal .records-detail-v5{min-height:0;border:1px solid rgba(201,160,69,.18);background:linear-gradient(180deg,rgba(255,245,210,.050),rgba(0,0,0,.12)),rgba(0,0,0,.16);box-shadow:inset 0 1px 0 rgba(255,236,178,.05);}',
      'body.tm-phase8-formal .records-spine-v5{display:grid;grid-template-rows:auto minmax(0,1fr) auto auto;gap:10px;padding:12px;overflow:hidden;border-left:4px solid rgba(126,31,24,.64);}',
      'body.tm-phase8-formal .records-tab-v5{width:100%;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px;align-items:center;margin-bottom:7px;padding:9px 8px;border:1px solid rgba(201,160,69,.15);color:#eadfbd;background:linear-gradient(90deg,rgba(0,0,0,.24),rgba(255,245,210,.030));font-family:inherit;text-align:left;cursor:pointer;} body.tm-phase8-formal .records-tab-v5.active{border-color:rgba(239,201,116,.52);background:linear-gradient(90deg,rgba(126,31,24,.38),rgba(255,245,210,.055));box-shadow:inset 3px 0 0 rgba(214,169,82,.82);} body.tm-phase8-formal .records-tab-v5 b{display:block;color:#f0d892;font-size:14px;letter-spacing:.14em;} body.tm-phase8-formal .records-tab-v5 span{display:block;margin-top:3px;color:rgba(232,220,187,.55);font-size:10.5px;} body.tm-phase8-formal .records-tab-v5 em{min-width:24px;height:22px;display:grid;place-items:center;border:1px solid rgba(201,160,69,.20);border-radius:999px;color:#f2ddb0;background:rgba(0,0,0,.20);font-style:normal;font-size:10.5px;}',
      'body.tm-phase8-formal .records-spine-note-v5{padding:9px;border:1px solid rgba(201,160,69,.14);background:rgba(0,0,0,.16);} body.tm-phase8-formal .records-spine-note-v5 b{display:block;color:#f0d892;font-size:12px;} body.tm-phase8-formal .records-spine-note-v5 p{margin:5px 0 0;color:rgba(232,220,187,.62);font-size:11px;line-height:1.55;}',
      'body.tm-phase8-formal .records-paper-v5{display:grid;grid-template-rows:auto auto minmax(0,1fr);overflow:hidden;padding:16px 18px;color:#eadfbd;} body.tm-phase8-formal .records-paper-head-v5{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding-bottom:12px;margin-bottom:12px;border-bottom:1px solid rgba(201,160,69,.18);} body.tm-phase8-formal .records-paper-head-v5 h2{margin:0;color:#f1d98d;font-size:25px;letter-spacing:.10em;} body.tm-phase8-formal .records-paper-head-v5 p{margin:4px 0 0;color:rgba(232,220,187,.58);font-size:12px;line-height:1.55;}',
      'body.tm-phase8-formal .records-toolbar-v5{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;margin-bottom:12px;} body.tm-phase8-formal .records-filter-v5{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 12px;} body.tm-phase8-formal .records-filter-v5 button{min-height:27px;padding:3px 9px;border:1px solid rgba(201,160,69,.18);color:#eadfbd;background:rgba(0,0,0,.18);font-family:inherit;font-size:11.5px;cursor:pointer;} body.tm-phase8-formal .records-filter-v5 button.active{border-color:rgba(239,201,116,.52);background:linear-gradient(180deg,rgba(122,45,32,.36),rgba(255,245,210,.050));}',
      'body.tm-phase8-formal .records-scroll-v5{min-height:0;overflow:auto;padding-right:5px;scrollbar-color:rgba(201,160,69,.48) rgba(0,0,0,.24);} body.tm-phase8-formal .records-section-v5{margin-bottom:14px;} body.tm-phase8-formal .records-section-title-v5{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 8px;color:#efd58b;font-size:17px;letter-spacing:.10em;} body.tm-phase8-formal .records-section-title-v5 small{color:rgba(232,220,187,.50);font-size:10.5px;font-weight:400;letter-spacing:.08em;}',
      'body.tm-phase8-formal .records-entry-v5{position:relative;margin-bottom:10px;padding:11px;border:1px solid rgba(201,160,69,.16);background:linear-gradient(90deg,rgba(126,32,24,.09),transparent 38%),linear-gradient(180deg,rgba(255,245,210,.052),rgba(0,0,0,.14)),rgba(19,14,11,.72);box-shadow:0 8px 18px rgba(0,0,0,.20),inset 0 1px 0 rgba(255,236,178,.045);} body.tm-phase8-formal .records-entry-v5::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:rgba(126,32,24,.58);} body.tm-phase8-formal .records-entry-v5.hot::before{background:rgba(213,92,64,.82);} body.tm-phase8-formal .records-entry-v5.active{border-color:rgba(239,201,116,.42);box-shadow:inset 3px 0 0 rgba(214,169,82,.65),0 8px 18px rgba(0,0,0,.20);}',
      'body.tm-phase8-formal .records-entry-v5 header{display:grid;grid-template-columns:40px minmax(0,1fr);gap:9px;align-items:center;margin-bottom:8px;} body.tm-phase8-formal .records-seal-v5{width:36px;height:36px;display:grid;place-items:center;border:1px solid rgba(201,160,69,.30);border-radius:50%;color:#f3d98c;background:radial-gradient(circle,rgba(201,160,69,.18),rgba(50,24,16,.92) 72%);font-size:15px;} body.tm-phase8-formal .records-entry-main-v5{min-width:0;} body.tm-phase8-formal .records-entry-main-v5 b{display:block;color:#f1d98d;font-size:13.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;} body.tm-phase8-formal .records-entry-main-v5 em{display:block;margin-top:3px;color:rgba(232,220,187,.56);font-size:10.5px;font-style:normal;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      'body.tm-phase8-formal .records-entry-body-v5{white-space:pre-wrap;max-height:186px;overflow:auto;margin:8px 0;padding:9px 10px;color:rgba(242,231,202,.84);border-top:1px solid rgba(201,160,69,.12);border-bottom:1px solid rgba(201,160,69,.10);background:rgba(0,0,0,.10);font-size:12.5px;line-height:1.75;scrollbar-color:rgba(201,160,69,.42) rgba(0,0,0,.20);} body.tm-phase8-formal .records-annot-v5{margin:8px 0;padding:8px 9px;border:1px solid rgba(126,184,167,.18);background:rgba(65,111,92,.10);} body.tm-phase8-formal .records-annot-v5 b{display:block;color:#a8dcc5;font-size:12px;} body.tm-phase8-formal .records-annot-v5 p{white-space:pre-wrap;margin:4px 0 0;color:rgba(232,240,220,.78);font-size:12px;line-height:1.62;}',
      'body.tm-phase8-formal .records-detail-v5{display:grid;grid-template-rows:auto auto minmax(0,1fr) auto auto;gap:10px;padding:12px;overflow:hidden;} body.tm-phase8-formal .records-detail-v5 h3{margin:0;color:#f1d98d;font-size:17px;line-height:1.35;letter-spacing:.08em;} body.tm-phase8-formal .records-detail-text-v5{min-height:0;height:100%;resize:none;white-space:pre-wrap;line-height:1.75;} body.tm-phase8-formal .records-detail-actions-v5{display:flex;flex-wrap:wrap;gap:7px;} body.tm-phase8-formal .records-empty-v5,body.tm-phase8-formal .records-search-empty-v5{padding:20px;border:1px dashed rgba(201,160,69,.22);color:rgba(232,220,187,.66);background:rgba(0,0,0,.14);font-size:13px;}',
      'body.tm-phase8-formal .bn-active-grid-v5{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-bottom:10px;} body.tm-phase8-formal .bn-affair-v5{padding:11px;border:1px solid rgba(201,160,69,.16);background:linear-gradient(180deg,rgba(255,245,210,.052),rgba(0,0,0,.14)),rgba(19,14,11,.70);} body.tm-phase8-formal .bn-affair-v5 header{display:grid;grid-template-columns:40px minmax(0,1fr);gap:9px;align-items:center;margin-bottom:7px;} body.tm-phase8-formal .bn-affair-v5 b{display:block;color:#f1d98d;font-size:13px;} body.tm-phase8-formal .bn-affair-v5 em{display:block;margin-top:3px;color:rgba(232,220,187,.56);font-size:10.5px;font-style:normal;} body.tm-phase8-formal .bn-affair-v5 p{min-height:42px;margin:0 0 8px;color:rgba(242,231,202,.78);font-size:12px;line-height:1.6;} body.tm-phase8-formal .bn-progress-v5{height:7px;margin:7px 0;border:1px solid rgba(201,160,69,.16);background:rgba(0,0,0,.30);overflow:hidden;} body.tm-phase8-formal .bn-progress-v5 i{display:block;height:100%;background:linear-gradient(90deg,#8a3227,#dfba6f);}',
      '@media (max-width:1280px){body.tm-phase8-formal .memorial-office-v4{grid-template-columns:250px minmax(0,1fr)}body.tm-phase8-formal .hy-office-v4{grid-template-columns:220px minmax(0,1fr) 260px}body.tm-phase8-formal .hy-office-v5{grid-template-columns:258px minmax(0,1fr) 246px;gap:10px;padding:12px}body.tm-phase8-formal .hy-compose-grid-v5{grid-template-columns:repeat(3,minmax(0,1fr))}body.tm-phase8-formal .records-grid-v4,body.tm-phase8-formal .bn-active-grid-v4,body.tm-phase8-formal .bn-active-grid-v5{grid-template-columns:1fr}body.tm-phase8-formal .records-cabinet-v5{grid-template-columns:158px minmax(0,1fr) 270px;gap:10px;padding:12px}}',
      '@media (max-width:980px){body.tm-phase8-formal .tm-action-panel,body.tm-phase8-formal .tm-action-panel.edict-shell,body.tm-phase8-formal .tm-action-panel.memorial-shell,body.tm-phase8-formal .tm-action-panel.letter-shell,body.tm-phase8-formal .tm-action-panel.records-shell{left:12px;right:12px;top:64px;width:auto;height:calc(100vh - 86px);transform:none}body.tm-phase8-formal .tm-bridge-overlay.show .tm-action-panel.edict-shell,body.tm-phase8-formal .tm-bridge-overlay.show .tm-action-panel.letter-shell{transform:none}body.tm-phase8-formal .edict-old-panel,body.tm-phase8-formal .memorial-office-v4,body.tm-phase8-formal .hy-office-v4,body.tm-phase8-formal .hy-office-v5,body.tm-phase8-formal .records-cabinet-v4,body.tm-phase8-formal .records-cabinet-v5{display:block;overflow:auto}body.tm-phase8-formal .hy-letter-desk-v5{display:block;overflow:visible}body.tm-phase8-formal .hy-contact-pane-v5,body.tm-phase8-formal .hy-compose-card-v5,body.tm-phase8-formal .hy-thread-card-v5,body.tm-phase8-formal .hy-inbox-pane-v5,body.tm-phase8-formal .records-spine-v5,body.tm-phase8-formal .records-paper-v5,body.tm-phase8-formal .records-detail-v5{margin-bottom:10px}body.tm-phase8-formal .hy-compose-grid-v5{grid-template-columns:1fr}body.tm-phase8-formal .records-toolbar-v5{grid-template-columns:1fr}body.tm-phase8-formal .tm-stat-strip{grid-template-columns:repeat(2,minmax(0,1fr))}}'
    ].join('\n');
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
    var attrs = Object.keys(data).map(function(k){ return ' data-' + attr(k) + '="' + attr(data[k]) + '"'; }).join('');
    return '<button type="button" class="' + attr(cls || 'tm-mini-btn') + '" data-desk-action="' + attr(action) + '"' + attrs + '>' + esc(label) + '</button>';
  }

  function renderActionStats(rows){
    return '<div class="tm-stat-strip v4">' + rows.map(function(r){
      return '<div class="tm-stat"><span>' + esc(r[0]) + '</span><b>' + esc(r[1] == null || r[1] === '' ? '—' : r[1]) + '</b></div>';
    }).join('') + '</div>';
  }

  function getEdictArchiveRows(){
    var gm = window.GM || {};
    return firstArray(gm._edictTracker, gm.edicts, gm.edictLog, gm._issuedEdicts).slice(-8).reverse().map(function(x, i){
      return {
        title: x.title || compactText(x.content || x.text || x.body || '既有诏令', 24),
        turn: x.date || getTurnText(x.turn || ((window.GM && GM.turn) || 1)),
        status: x.status || x.result || '追踪中',
        target: x.assignee || x.target || x.receiver || '有司',
        effect: x.forecast || x.effect || x.resultText || compactText(x.content || x.text || '', 54)
      };
    });
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
        text: x.text || x.content || x.body || '',
        content: x.content || x.text || x.body || '',
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

  function getFormalEdictCategories(){
    return [
      { id:'policy', badge:'政', label:'政令', hint:'朝政、制度、地方处置', forecast:'牵动皇权、吏治、党争与地方执行。' },
      { id:'military', badge:'军', label:'军令', hint:'兵马、边镇、粮饷调度', forecast:'牵动军心、边防、国库与将领忠诚。' },
      { id:'finance', badge:'财', label:'财赋', hint:'税赋、盐引、矿关、漕运', forecast:'牵动国库、民心、商贸与地方阻力。' },
      { id:'private', badge:'密', label:'密旨', hint:'私下诏谕、试探、任免前置', forecast:'牵动人物态度、派系关系与隐秘记忆。' }
    ];
  }

  function ensureFormalEdictDrafts(){
    if (!state.edictDrafts) state.edictDrafts = {};
    if (!state.edictDrafts.policy && state.edictDraft && state.edictDraft.length) {
      state.edictDrafts.policy = state.edictDraft.join('\n');
    }
    return state.edictDrafts;
  }

  function edictPortraitForFormal(s){
    var text = [s && s.source, s && s.title, (s && s.tags || []).join(' ')].join(' ');
    if (/军|兵|边|镇|将/.test(text)) return asset('portraits/ming-general-ai.png');
    if (/内廷|司礼|东厂|宦/.test(text)) return asset('portraits/ming-eunuch-ai.png');
    if (/讲|学|礼|儒|史/.test(text)) return asset('portraits/ming-scholar-ai.png');
    return asset('portraits/ming-civil-ai.png');
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
      '<img class="edict-sug-portrait" src="' + attr(edictPortraitForFormal(x)) + '" alt="">' +
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
        var content = String(sg.content || sg.text || sg.body || '').trim();
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

  function renderFormalEdictPanel(){
    var gm = window.GM || {};
    var role = '天子';
    var sc = (typeof window.findScenarioById === 'function') ? window.findScenarioById(gm.sid) : null;
    if (sc && sc.role) role = sc.role;
    var icon = typeof window.tmIcon === 'function' ? window.tmIcon : function(){ return ''; };
    var cats = [
      {id:'edict-pol', keys:['policy','political'], label:'政 令', badge:'政', cls:'ed-c-pol', hint:'改革官制·任免官员·降旨安抚',  placeholder:'诏谕天下，如：改革官制、降旨安抚、任免官员……'},
      {id:'edict-mil', keys:['military'], label:'军 令', badge:'军', cls:'ed-c-mil', hint:'调兵遣将·加强边防·讨伐叛贼',  placeholder:'调兵遣将，如：调动军队、加强边防、讨伐叛贼……'},
      {id:'edict-dip', keys:['diplomatic','diplomacy'], label:'外 交', badge:'外', cls:'ed-c-dip', hint:'遣使和亲·结盟讨伐·册封藩属',  placeholder:'纵横捭阖，如：遣使和亲、结盟讨伐、册封藩属……'},
      {id:'edict-eco', keys:['finance','economic','economy'], label:'经 济', badge:'经', cls:'ed-c-eco', hint:'减税轻赋·开仓放粮·兴修水利',  placeholder:'经纶民生，如：减税轻赋、开仓放粮、兴修水利……'},
      {id:'edict-oth', keys:['other','private'], label:'其 他', badge:'他', cls:'ed-c-oth', hint:'大赦·科举·建造·礼仪', placeholder:'其他旨意，如：大赦天下、科举取士、建造宫殿……'}
    ];
    var suggestions = getEdictSuggestionRows();
    var html = '<section class="edict-old-panel">';
    html += '<aside class="edict-old-sug"><h3 class="edict-old-sug-title">议事清册 <small>' + esc(suggestions.length) + ' 条</small></h3><div class="edict-old-sug-list">';
    html += suggestions.map(renderEdictSuggestionItem).join('') || '<article class="edict-sug-v2"><div><b>暂无御案建议</b><p>召开朝议、问对或处理奏疏后，可摘入诏书草拟。</p></div></article>';
    html += '</div></aside>';
    html += '<main class="edict-old-main">';
    html += '<div class="ed-yubi-title">';
    html += '<div class="seal">' + esc(role) + '</div>';
    html += '<div class="main">' + esc(role) + ' 御 笔</div>';
    html += '<div class="sub">奉天承运皇帝　　诏曰</div>';
    html += '</div>';
    html += '<div class="ed-cards">';
    cats.forEach(function(cat){
      html += '<div class="ed-card ' + cat.cls + '">';
      html += '<div class="ed-card-hdr">';
      html += '<span class="ed-cat-icon">' + esc(cat.badge) + '</span>';
      html += '<span class="ed-cat-label">' + esc(cat.label) + '</span>';
      html += '<span class="ed-cat-hint">' + esc(cat.hint) + '</span>';
      html += '</div>';
      html += '<textarea id="' + attr(cat.id) + '" rows="2" class="edict-input paper-texture" data-desk-edict-cat="' + attr(cat.keys[0]) + '" data-label="' + attr(cat.label) + '" placeholder="' + attr(cat.placeholder) + '" oninput="var s=window.TM_PHASE8_FORMAL||(window.TM_PHASE8_FORMAL={});var d=s.edictDrafts||(s.edictDrafts={});d[&quot;' + attr(cat.keys[0]) + '&quot;]=this.value;if(window._edictLiveForecast)window._edictLiveForecast(&quot;' + attr(cat.id) + '&quot;)">' + esc(legacyEdictDraftValue(cat.id, cat.keys)) + '</textarea>';
      html += '<div id="' + attr(cat.id) + '-forecast" class="ed-forecast" style="display:none;"></div>';
      html += '</div>';
    });
    html += '</div>';
    html += '<div class="ed-polish-bar">';
    html += '<span class="ed-polish-label">文 风 选 择</span>';
    html += '<select id="edict-polish-style" style="font-size:12px;padding:6px 12px;background:var(--color-elevated);border:1px solid var(--color-border-subtle);color:var(--color-foreground);border-radius:2px;font-family:var(--font-serif);cursor:pointer;">';
    html += '<option value="elegant">典雅骈文</option>';
    html += '<option value="concise">简洁明快</option>';
    html += '<option value="ornate">华丽文藻</option>';
    html += '<option value="plain">白话文言</option>';
    html += '</select>';
    html += '<button class="ed-polish-btn" onclick="if(window._polishEdicts)window._polishEdicts()">有 司 润 色</button>';
    html += '</div>';
    html += '<div id="edict-polished" style="display:none;margin-top:var(--space-3);"></div>';
    html += '<div class="ed-section-divider"><span class="label">主 角 行 止</span></div>';
    html += '<div class="ed-xinglu-card">';
    html += '<div class="ed-xinglu-hdr"><span class="title">本 回 合 行 动</span><span class="desc">——你这段时间做了什么</span></div>';
    html += '<textarea id="xinglu-pub" rows="4" class="edict-input paper-texture" data-desk-player-action="1" placeholder="如：召见某臣、校阅三军、微服私访、夜读史书、祖庙祭祀、宴请群臣……" oninput="(window.TM_PHASE8_FORMAL||(window.TM_PHASE8_FORMAL={})).playerAction=this.value">' + esc(deskValue('#xinglu-pub', state.playerAction || '')) + '</textarea>';
    var recentXinglu = firstArray(gm.qijuHistory).filter(function(q){ return q && q.xinglu && Number(q.turn || 0) < Number(gm.turn || 1); }).slice(-5).reverse();
    if (recentXinglu.length) {
      html += '<details class="ed-xinglu-hist"><summary>近期行止记录 <span style="color:var(--ink-300);margin-left:6px;font-size:10px;">' + esc(recentXinglu.length) + ' 条</span></summary>';
      html += '<div style="margin-top:10px;max-height:200px;overflow-y:auto;">';
      recentXinglu.forEach(function(q){
        html += '<div class="ed-xinglu-hist-item"><span class="turn">T' + esc(q.turn) + '</span>' + esc(q.xinglu) + '</div>';
      });
      html += '</div></details>';
    }
    html += '</div>';
    html += '<div class="ed-tyrant-block">';
    html += '<div class="ed-tyrant-toggle" onclick="var p=document.getElementById(&quot;tyrant-panel&quot;);if(p){p.style.display=p.style.display===&quot;none&quot;?&quot;block&quot;:&quot;none&quot;;this.classList.toggle(&quot;open&quot;);if(p.style.display!==&quot;none&quot;&amp;&amp;window.TyrantActivitySystem)TyrantActivitySystem.renderPanel();}">';
    html += '帝 王 私 行';
    html += '<span class="sub">—— 点击展开（后妃·游猎·丹药·密访）</span>';
    html += '</div>';
    html += '<div id="tyrant-panel" style="display:none;max-height:300px;overflow-y:auto;padding:var(--space-2);margin-top:var(--space-2);"></div>';
    html += '</div>';
    if (gm._edictTracker && gm._edictTracker.length > 0) {
      var allEdicts = gm._edictTracker.filter(function(e){ return e && Number(e.turn || 0) < Number(gm.turn || 1); });
      if (allEdicts.length > 0) {
        var byTurn = {};
        allEdicts.forEach(function(e){ (byTurn[e.turn] || (byTurn[e.turn] = [])).push(e); });
        var turns = Object.keys(byTurn).sort(function(a, b){ return Number(b) - Number(a); });
        html += '<details class="ed-archive"><summary>往 期 诏 令 档 案 · ' + esc(allEdicts.length) + ' 条</summary>';
        html += '<div style="margin-top:var(--space-2);max-height:400px;overflow-y:auto;">';
        turns.forEach(function(turn){
          var turnText = typeof window.getTSText === 'function' ? window.getTSText(parseInt(turn, 10)) : 'T' + turn;
          html += '<div class="ed-archive-group"><div class="ed-archive-group-title">第' + esc(turn) + '回合 · ' + esc(turnText) + '</div>';
          byTurn[turn].forEach(function(e){
            var color = e.status === 'completed' ? 'var(--celadon-400)' : e.status === 'obstructed' ? 'var(--vermillion-400)' : e.status === 'partial' ? '#e67e22' : e.status === 'pending_delivery' ? 'var(--amber-400)' : 'var(--ink-300)';
            var mark = { completed:'✅', obstructed:'❌', partial:'⚠️', executing:'⏳', pending:'⭕', pending_delivery:'📨' }[e.status] || '';
            html += '<div style="font-size:var(--text-xs);padding:2px 0;border-bottom:1px solid var(--color-border-subtle);">';
            html += '<span style="color:' + color + ';">' + mark + '</span> ';
            html += '<span style="color:var(--color-foreground-muted);">' + esc(e.category || '') + '</span> ';
            html += esc(e.content || '');
            if (e.assignee) html += ' <span style="color:var(--ink-300);">[执行:' + esc(e.assignee) + ']</span>';
            if (e.feedback) html += '<div style="color:var(--color-foreground-secondary);padding-left:1rem;">' + esc(e.feedback) + '</div>';
            html += '</div>';
          });
          html += '</div>';
        });
        html += '</div></details>';
      }
    }
    html += '<div class="ed-action-bar">';
    html += '<button class="bt bp" id="btn-end" onclick="if(window.confirmEndTurn)window.confirmEndTurn()" style="padding:var(--space-3) var(--space-8);font-size:var(--text-md);letter-spacing:0.15em;border:2px solid var(--gold-400);box-shadow:0 2px 12px rgba(184,154,83,0.2);">' + icon('end-turn',16) + ' 诏付有司</button>';
    html += '<button class="bt" title="地形图·山川城池分布（决策辅助）·与【军事·地图总览】数据源不同" onclick="if(window.TM&amp;&amp;TM.Map&amp;&amp;TM.Map.open)TM.Map.open(&quot;terrain&quot;)" style="padding:var(--space-3) var(--space-6);font-size:var(--text-md);">' + icon('map',16) + ' 查看地图</button>';
    html += '</div>';
    html += '</main></section>';
    return html;
  }

  function memorialGroupKey(m){
    var s = String((m && m.status) || '').toLowerCase();
    if (/done|approved|rejected|annotated|referred|court_debate|已批|已决|准|驳|批示|转|廷议/.test(s)) return 'done';
    if (/pending_review|hold|held|留中/.test(s)) return 'held';
    return /急|urgent|high/.test(String((m && ((m.priority || '') + (m.status || '') + (m.title || '') + (m.text || ''))) || '')) ? 'urgent' : 'pending';
  }

  function memorialMatchesFormal(filter, m){
    if (!filter || filter === 'all') return true;
    return memorialGroupKey(m) === filter;
  }

  function renderMemorialCardV4(m){
    var key = memorialGroupKey(m);
    var cls = key === 'done' ? 'done' : key === 'held' ? 'held' : '';
    var meta = [m.from || m.sender, m.dept || m.office || m.type, m.status || '待批'].filter(Boolean).join(' · ');
    var body = m.text || m.content || m.body || m.summary || '暂无正文。';
    var reply = m.reply || '着有关衙门速核，限期具奏。';
    var mid = 'mem-formal-' + (m.rawIndex != null ? m.rawIndex : String(m.id || '').replace(/[^a-zA-Z0-9_-]/g, ''));
    var bodyHtml = body.length > 180
      ? '<div class="mem-body collapsed wd-selectable" id="' + attr(mid) + '-body">' + esc(body) + '</div><button type="button" class="mem-toggle" onclick="var b=document.getElementById(&quot;' + attr(mid) + '-body&quot;);if(b){var col=b.classList.toggle(&quot;collapsed&quot;);this.textContent=col?&quot;▼ 展开全文&quot;:&quot;▲ 收起&quot;;}">▼ 展开全文</button>'
      : '<div class="mem-body wd-selectable">' + esc(body) + '</div>';
    var replyId = mid + '-reply';
    var btnData = function(decision){ return { id:m.id || '', decision:decision, replyid:replyId }; };
    return '<article class="memorial-card-v4 ' + cls + '">' +
      '<div class="memorial-card-head-v4"><span class="memorial-avatar-v4">' + esc((m.from || m.sender || '奏').slice(0, 1)) + '</span><span><b>' + esc(m.title || m.topic || '奏疏') + '</b><span>' + esc(meta) + '</span></span><span class="tm-chip-row">' + actionChip(key === 'urgent' ? '急奏' : key === 'done' ? '已批' : key === 'held' ? '留中' : '待批', key === 'urgent' ? 'hot' : key === 'done' ? 'green' : '') + '</span></div>' +
      '<div class="memorial-body-v4">' + bodyHtml + '</div>' +
      '<div class="memorial-reply-v4"><textarea id="' + attr(replyId) + '" class="tm-textarea" data-desk-memorial-reply placeholder="朱批意见">' + esc(reply) + '</textarea><div class="memorial-actions-v4">' + actionBtn('准奏', 'memorial-decision-desk', btnData('approved'), 'tm-mini-btn green') + actionBtn('驳回', 'memorial-decision-desk', btnData('rejected'), 'tm-mini-btn hot') + actionBtn('批示', 'memorial-decision-desk', btnData('annotated'), 'tm-mini-btn') + actionBtn('转有司', 'memorial-decision-desk', btnData('referred'), 'tm-mini-btn') + actionBtn('发廷议', 'memorial-decision-desk', btnData('court_debate'), 'tm-mini-btn') + (key === 'held' ? '' : actionBtn('留中', 'memorial-decision-desk', btnData('hold'), 'tm-mini-btn')) + actionBtn('摘入', 'memorial-edict-desk', { id:m.id || '' }, 'tm-mini-btn') + actionBtn('传召问询', 'memorial-summon-desk', { id:m.id || '' }, 'tm-mini-btn') + '</div></div>' +
      '</article>';
  }

  function renderFormalMemorialTransit(){
    var gm = window.GM || {};
    var pending = Array.isArray(gm._pendingMemorialDeliveries) ? gm._pendingMemorialDeliveries.filter(function(m){ return !m || m.status === 'in_transit'; }) : [];
    var rows = firstArray(pending, gm.memorialTransit, gm._memorialTransit, gm.zoushuTransit).slice(0, 4);
    if (!rows.length) return '';
    return rows.map(function(t){
      return '<div class="memorial-side-note"><b>' + esc([t.from || t.sender || '地方', t.office || t.dept || '衙门'].filter(Boolean).join(' · ')) + '</b><p>' + esc([t.type || '奏疏', t.eta || t.due || '在途'].filter(Boolean).join(' / ')) + '<br>' + esc(compactText(t.body || t.text || t.content || '', 72)) + '</p></div>';
    }).join('');
  }

  function renderFormalMemorialPanel(){
    var mems = getMemorials();
    var filter = state.memorialFilter || 'all';
    if (filter === 'review') filter = 'all';
    var filters = [
      ['all','全部奏疏','旧奏疏总览'],
      ['urgent','急奏待批','红签优先'],
      ['pending','百官启奏','常规待批'],
      ['held','留中之折','御前暂存'],
      ['done','已批档案','朱批归档']
    ];
    var side = filters.map(function(f){
      var count = mems.filter(function(m){ return memorialMatchesFormal(f[0], m); }).length;
      return '<button type="button" class="' + (filter === f[0] ? 'active' : '') + '" data-desk-action="memorial-filter-desk" data-filter="' + attr(f[0]) + '"><i>奏</i><span><b>' + esc(f[1]) + '</b><span>' + esc(f[2]) + '</span></span>' + actionChip(String(count), count ? 'green' : '') + '</button>';
    }).join('');
    var visible = mems.filter(function(m){ return memorialMatchesFormal(filter, m); });
    var groupMeta = [
      ['urgent','急奏待批','红签急奏，优先于常规折件。'],
      ['pending','百官启奏','可准奏、驳回、批示、转交有司或发朝议。'],
      ['held','留中之折','暂不下发，保留御前判断与后续回合。'],
      ['done','已批档案','已形成朱批，可追踪回函与承办。']
    ];
    var groups = groupMeta.map(function(g){
      var key = g[0];
      var rows = visible.filter(function(m){ return memorialGroupKey(m) === key; });
      if (!rows.length) return '';
      return '<section class="memorial-group-v4"><h3 class="memorial-group-title-v4"><span>' + esc(g[1]) + '</span><small>' + esc(rows.length) + ' 件 · ' + esc(g[2]) + '</small></h3>' + rows.map(renderMemorialCardV4).join('') + '</section>';
    }).join('');
    var transit = renderFormalMemorialTransit();
    return '<section class="memorial-office-v4">' +
      '<aside class="memorial-cases-v4"><div class="tm-panel-v4-title"><span class="seal">奏</span><span><b>朱批案牍</b><span>急奏 / 留中 / 已批</span></span></div><div class="memorial-filter-v4">' + side + '</div>' + (transit ? '<h3 class="tm-roster-group" style="margin-top:12px">在途奏疏</h3>' + transit : '') + '</aside>' +
      '<main class="memorial-paper-v4"><header class="memorial-paper-head-v4"><span><h2>奏 疏 待 览</h2><p>案牍之司　　百官启奏</p></span><span class="tm-chip-row">' + actionChip('本回 ' + mems.filter(function(m){ return memorialGroupKey(m) !== 'done'; }).length + ' 件', 'green') + actionChip('急 ' + mems.filter(function(m){ return memorialGroupKey(m) === 'urgent'; }).length, 'hot') + '</span></header>' +
        (groups || '<div class="mem-empty">案牍清净　百官无事启奏</div>') +
      '</main></section>';
  }

  function normalizeLetterPeople(){
    var selfName = (window.P && P.playerInfo && P.playerInfo.characterName) || '';
    var people = getPeople().filter(function(p){
      if (!p) return false;
      if (p.alive === false) return false;
      if (p.isPlayer) return false;
      if (selfName && p.name === selfName) return false;
      return true;
    }).slice(0, 96);
    if (!people.length) people = [{ name:'臣工', office:'御前候命', faction:'京师' }];
    return people.map(function(p, i){
      var name = p.name || personKey(p) || ('人物' + (i + 1));
      return {
        id: name,
        name: name,
        role: p.officialTitle || p.office || p.title || p.role || p.faction || '臣工',
        region: letterRegionOf(p),
        location: p.location || p.region || p.faction || '京师',
        face: name.slice(0, 1),
        portrait: (typeof tmfRenwuPortrait === 'function') ? tmfRenwuPortrait(p) : '',
        faction: p.faction || p.group || '',
        raw: p
      };
    });
  }

  function letterRegionOf(p){
    var loc = String((p && (p.location || p.region)) || '');
    var title = String((p && (p.officialTitle || p.title || p.role || p.office)) || '');
    var capital = (window.GM && GM._capital) || '京城';
    if (/皇后|皇贵妃|贵妃|妃|嫔|夫人|公主|太后|太妃|内廷|司礼|东厂/.test(title + loc)) return '内廷';
    try { if (typeof window._isSameLocation === 'function' && window._isSameLocation(loc, capital)) return '在京'; } catch(_) {}
    if (/京城|京师|顺天|紫禁城|北京/.test(loc)) return '在京';
    if (/辽|宁远|锦|蓟|山海关|皮岛|沈阳|盛京/.test(loc)) return '辽东·北境';
    if (/大同|宣府|太原|山西|归化/.test(loc)) return '宣大·山西';
    if (/陕|西安|延|甘|宁夏|兰州|榆林|固原|米脂|安塞|府谷/.test(loc)) return '西陲·边镇';
    if (/四川|重庆|云|贵|蜀|巴|石柱|成都/.test(loc)) return '西南·巴蜀';
    if (/福建|广东|广西|厦门|台湾|琼|朝鲜|日本|海/.test(loc)) return '南方·海疆';
    if (/江|杭|南京|苏|湖广|浙|南直|安庆/.test(loc)) return '江南·江浙';
    if (/河南|山东|河北|北直|鲁|豫|保定|大名|商丘/.test(loc)) return '中原·鲁豫';
    return loc || '其他';
  }

  function letterStateClassFormal(stateText){
    if (/拦截|截获|失约|阻断|可疑/.test(stateText || '')) return 'lost intercepted';
    if (/在途|追回|核验|traveling|sent/i.test(stateText || '')) return 'transit';
    return '';
  }

  function letterTypeLabelFormal(type){
    var map = {
      personal: '私函',
      greeting: '问安函',
      report: '来报',
      secret_decree: '密旨',
      military_order: '征调令',
      formal_edict: '正式诏令',
      proclamation: '檄文',
      diplomatic: '外交书',
      diplomatic_dispatch: '外交书'
    };
    return map[type] || (type || '书信');
  }

  function letterUrgencyLabelFormal(v){
    return ({ normal:'普通驿递', urgent:'加急驿递', extreme:'八百里加急' })[v] || (v || '驿递');
  }

  function letterCipherLabelFormal(v){
    return ({ none:'不加密', yinfu:'阴符', yinshu:'阴书', wax_ball:'蜡丸密函', silk_sewn:'帛书缝衣' })[v] || (v || '不加密');
  }

  function letterSendModeLabelFormal(v){
    return ({ normal:'普通信使', multi_courier:'多路信使', secret_agent:'密使' })[v] || (v || '普通信使');
  }

  function letterStatusTextFormal(l){
    var s = String((l && l.status) || '');
    if (s === 'draft') return '草稿';
    if (s === 'traveling') return '信使在途';
    if (s === 'delivered') return '已送达';
    if (s === 'replying') return '回函在途';
    if (s === 'returned') return '已有回函';
    if (s === 'intercepted') return '信使失踪';
    if (s === 'intercepted_forging') return '回函在途';
    if (s === 'blocked') return '流转受阻';
    if (s === 'recalled') return '已追回';
    return s || '未阅';
  }

  function letterFilterMatchFormal(filter, l){
    var s = String((l && l.status) || '').toLowerCase();
    if (filter === 'unread') return !l.playerRead && !l.toPlayer && l.from !== '玩家';
    if (filter === 'road') return /traveling|replying|sent|delivered|intercepted_forging/.test(s);
    if (filter === 'lost') return /intercepted|blocked|lost/.test(s);
    if (filter === 'star') return !!l.starred;
    return true;
  }

  function letterTimeFormal(l){
    try { if (typeof window.getTSText === 'function') return window.getTSText(l.sentTurn || 1); } catch(_) {}
    return '第' + (l.sentTurn || 1) + '回合';
  }

  function letterPersonCounts(name, letters){
    var rows = letters.filter(function(l){ return String(l.from) === String(name) || String(l.to) === String(name); });
    var unread = rows.filter(function(l){ return l.from !== '玩家' && !l.playerRead; }).length;
    var road = rows.filter(function(l){ return /traveling|replying|delivered|intercepted_forging/.test(String(l.status || '')); }).length;
    var lost = rows.filter(function(l){ return /intercepted|blocked|lost/.test(String(l.status || '')); }).length;
    return { total: rows.length, unread: unread, road: road, lost: lost };
  }

  function formalIncomingLetters(letters){
    var rows = [];
    letters.forEach(function(l){
      if (!l) return;
      if (String(l.from) !== '玩家') {
        rows.push({
          id: l.id,
          from: l.from || '来信者',
          title: l.title || '来函',
          content: l.content || '暂无正文。',
          status: letterStatusTextFormal(l),
          time: letterTimeFormal(l),
          unread: !l.playerRead,
          reply: false,
          raw: l.raw,
          source: l
        });
      } else if (l.reply && /returned|intercepted_forging/.test(String(l.status || ''))) {
        rows.push({
          id: l.id,
          from: l.to || '回信者',
          title: '回书 · ' + (l.title || letterTypeLabelFormal(l.letterType)),
          content: l.reply,
          status: letterStatusTextFormal(l),
          time: l.replyTurn ? (function(){ try { if (typeof window.getTSText === 'function') return window.getTSText(l.replyTurn); } catch(_) {} return '第' + l.replyTurn + '回合'; })() : letterTimeFormal(l),
          unread: !l.raw || !l.raw._replyRead,
          reply: true,
          raw: l.raw,
          source: l
        });
      }
    });
    rows.sort(function(a, b){
      var at = (a.source && (a.source.replyTurn || a.source.sentTurn)) || 0;
      var bt = (b.source && (b.source.replyTurn || b.source.sentTurn)) || 0;
      if (bt !== at) return bt - at;
      return String(a.from).localeCompare(String(b.from));
    });
    return rows;
  }

  function renderFormalInboxItem(item){
    var actions = '';
    actions += actionBtn('展阅', 'letter-target-desk', { name:item.from || '' }, 'tm-mini-btn');
    actions += actionBtn('回书', 'letter-thread-action-desk', { id:item.id || '', letterAction:'reply' }, 'tm-mini-btn green');
    actions += actionBtn('摘入', 'letter-thread-action-desk', { id:item.id || '', letterAction:'excerpt' }, 'tm-mini-btn');
    return '<article class="hy-inbox-item-v5 ' + (item.unread ? 'unread' : '') + '">' +
      '<button type="button" class="hy-inbox-open-v5" data-desk-action="letter-target-desk" data-name="' + attr(item.from || '') + '">' +
        '<span class="hy-inbox-seal-v5">' + esc((item.from || '函').slice(0, 1)) + '</span>' +
        '<span><b>' + esc(item.from || '来信者') + '</b><em>' + esc(item.title || '来函') + '</em></span>' +
        (item.unread ? '<i>未阅</i>' : '<i>' + esc(item.reply ? '回书' : item.status || '来函') + '</i>') +
      '</button>' +
      '<div class="hy-inbox-meta-v5"><span>' + esc(item.time || '') + '</span><span>' + esc(item.status || '') + '</span></div>' +
      '<div class="hy-inbox-body-v5 wd-selectable">' + esc(item.content || '暂无正文。') + '</div>' +
      '<div class="hy-actions-v5">' + actions + '</div>' +
      '</article>';
  }

  function renderFormalLetterCard(l, targetName){
    var outgoing = String(l.from) === '玩家' || String(l.to) === String(targetName);
    if (!outgoing && l.raw && !l.raw._playerRead) l.raw._playerRead = true;
    var statusText = letterStatusTextFormal(l);
    var cls = outgoing ? 'out' : 'in';
    cls += ' ' + letterStateClassFormal(statusText + ' ' + l.status);
    var meta = [
      letterTypeLabelFormal(l.letterType),
      letterUrgencyLabelFormal(l.urgency),
      l.cipher && l.cipher !== 'none' ? letterCipherLabelFormal(l.cipher) : '',
      l.sendMode ? letterSendModeLabelFormal(l.sendMode) : '',
      letterTimeFormal(l)
    ].filter(Boolean);
    var actions = '';
    if (outgoing && l.raw && l.raw.status === 'traveling') actions += actionBtn('追回', 'letter-thread-action-desk', { id:l.id || '', letterAction:'recall' }, 'tm-mini-btn');
    if (outgoing && l.raw && /intercepted|blocked/.test(String(l.raw.status || ''))) {
      actions += actionBtn('重发·密使', 'letter-thread-action-desk', { id:l.id || '', letterAction:'resend-secret' }, 'tm-mini-btn');
      actions += actionBtn('重发·加急', 'letter-thread-action-desk', { id:l.id || '', letterAction:'resend-fast' }, 'tm-mini-btn hot');
    }
    if (!outgoing && l.raw && l.raw._npcInitiated) actions += actionBtn('回书', 'letter-thread-action-desk', { id:l.id || '', letterAction:'reply' }, 'tm-mini-btn green');
    actions += actionBtn('遣使核实', 'letter-thread-action-desk', { id:l.id || '', letterAction:'verify' }, 'tm-mini-btn');
    actions += actionBtn('摘入', 'letter-thread-action-desk', { id:l.id || '', letterAction:'excerpt' }, 'tm-mini-btn');
    actions += actionBtn(l.starred ? '★' : '☆', 'letter-thread-action-desk', { id:l.id || '', letterAction:'star' }, 'tm-mini-btn');
    return '<article class="hy-letter-card-v5 ' + cls + '">' +
      '<div class="hy-letter-stamp-v5">' + esc((letterTypeLabelFormal(l.letterType) || '书').slice(0, 1)) + '</div>' +
      '<div class="hy-letter-main-v5"><header><b>' + esc(outgoing ? '御前发出' : '来函上达') + '</b><span>' + esc([l.from, l.to].filter(Boolean).join(' → ')) + '</span><em>' + esc(statusText) + '</em></header>' +
      '<div class="hy-letter-meta-v5">' + meta.map(function(x){ return '<span>' + esc(x) + '</span>'; }).join('') + '</div>' +
      '<div class="hy-letter-body-v5 wd-selectable">' + esc(l.content || '暂无正文。') + '</div>' +
      (l.reply ? '<div class="hy-letter-reply-v5"><b>回书</b><p>' + esc(l.reply) + '</p></div>' : '') +
      '<div class="hy-actions-v5">' + actions + '</div></div>' +
      '</article>';
  }

  function renderFormalLetterPanel(){
    var letters = getLetters();
    var people = normalizeLetterPeople();
    var filter = state.letterFilter || 'all';
    var query = String(state.letterSearch || '').trim().toLowerCase();
    var targetName = (window.GM && GM._pendingLetterTo) || state.letterTarget || (people[0] && people[0].name) || '臣工';
    var target = people.find(function(p){ return String(p.name) === String(targetName) || String(p.id) === String(targetName); }) || people[0];
    state.letterTarget = target.name;
    var visiblePeople = people;
    var grouped = {};
    visiblePeople.forEach(function(p){ (grouped[p.region] || (grouped[p.region] = [])).push(p); });
    var regionOrder = ['内廷','在京','辽东·北境','宣大·山西','西陲·边镇','中原·鲁豫','江南·江浙','西南·巴蜀','南方·海疆','其他'];
    Object.keys(grouped).forEach(function(k){ if (regionOrder.indexOf(k) < 0) regionOrder.push(k); });
    var roster = regionOrder.map(function(region){
      if (!grouped[region] || !grouped[region].length) return '';
      return '<div class="hy-region-group-v5"><h4 class="hy-region-v4">' + esc(region) + '</h4>' + grouped[region].map(function(p){
        var active = String(p.name) === String(target.name);
        var counts = letterPersonCounts(p.name, letters);
        return '<button type="button" class="hy-person-v5 ' + (active ? 'active' : '') + '" data-desk-action="letter-target-desk" data-name="' + attr(p.name) + '" data-letter-search-text="' + attr([p.name, p.role, p.region, p.location, p.faction].join(' ')) + '"><img class="hy-face-v5" src="' + attr(p.portrait) + '" alt=""><span class="hy-person-main-v5"><b>' + esc(p.name) + '</b><span>' + esc(p.role) + '</span><i>' + esc(p.location) + '</i></span><span class="hy-person-counts-v5">' + (counts.unread ? '<em class="hot">' + esc(counts.unread) + '</em>' : '') + (counts.road ? '<em>' + esc(counts.road) + '</em>' : '') + (active ? '<em class="on">今</em>' : '') + '</span></button>';
      }).join('') + '</div>';
    }).join('') + '<div class="tm-desk-empty hy-search-empty-v5" style="display:none">没有匹配的通信对象。</div>';
    var targetLetters = letters.filter(function(l){ return String(l.from) === String(target.name) || String(l.to) === String(target.name); });
    targetLetters = targetLetters.filter(function(l){ return letterFilterMatchFormal(filter, l); });
    targetLetters.sort(function(a, b){ return (a.sentTurn || 0) - (b.sentTurn || 0); });
    var filterBtns = [['all','全部'],['unread','未读'],['road','在途'],['lost','失约/截获'],['star','星标']].map(function(f){
      return '<button type="button" class="' + (filter === f[0] ? 'active' : '') + '" data-desk-action="letter-filter-desk" data-filter="' + attr(f[0]) + '">' + esc(f[1]) + '</button>';
    }).join('');
    var gm = window.GM || {};
    var routeRows = firstArray(gm._routeDisruptions, gm.routeAlerts, gm._routeAlerts, gm.letterRouteAlerts).filter(function(r){ return !r || !r.resolved; });
    var route = routeRows.length ? routeRows.map(function(r){ return [r.route || r.region || r.to || r.place, r.reason || r.level || r.status || r.desc || r.text].filter(Boolean).join('：'); }).join('　') : '驿路平稳，暂无阻断。';
    var thread = targetLetters.length ? targetLetters.map(function(l){ return renderFormalLetterCard(l, target.name); }).join('') : '<article class="hy-letter-empty-v5"><b>尚无往来书信</b><p>选中人物后可直接拟函。信件送达、截获、逾期、回函仍写入旧鸿雁系统的 GM.letters，并随回合结算。</p></article>';
    var draft = state.letterDraft || {};
    var type = draft.type || 'personal';
    var urgency = draft.urgency || 'normal';
    var cipher = draft.cipher || 'none';
    var sendMode = draft.sendMode || 'multi_courier';
    var body = draft.body || '';
    var selectedCounts = letterPersonCounts(target.name, letters);
    var inboxRows = formalIncomingLetters(letters);
    var unreadInbox = inboxRows.filter(function(x){ return x.unread; }).length;
    var inbox = inboxRows.length ? inboxRows.slice(0, 20).map(renderFormalInboxItem).join('') : '<article class="hy-letter-empty-v5"><b>暂无来信</b><p>NPC 主动来函与已返回的回书会集中显示在这里。</p></article>';
    return '<section class="hy-office-v5">' +
      '<aside class="hy-contact-pane-v5"><div class="tm-panel-v4-title"><span class="seal">雁</span><span><b>鸿雁传书</b><span>人物 / 搜索 / 未读 / 在途</span></span></div><div class="hy-search-v5"><input class="tm-input" data-desk-letter-search value="' + attr(state.letterSearch || '') + '" placeholder="检索姓名、官职、党派、地点"></div><div class="hy-roster-scroll-v5">' + roster + '</div></aside>' +
      '<main class="hy-letter-desk-v5"><section class="hy-compose-card-v5"><header><img src="' + attr(target.portrait) + '" alt=""><span><b>致 ' + esc(target.name) + '</b><em>' + esc(target.role) + ' / ' + esc(target.location) + '</em></span><span class="tm-chip-row">' + actionChip('往来 ' + selectedCounts.total, 'green') + (selectedCounts.unread ? actionChip('未读 ' + selectedCounts.unread, 'hot') : '') + (selectedCounts.road ? actionChip('在途 ' + selectedCounts.road) : '') + '</span></header><div class="hy-route-v5">' + esc(route) + '</div><div class="hy-compose-grid-v5"><label><span>收信人</span><input class="tm-input" data-desk-letter-to data-letter-draft-field="to" value="' + attr(target.name) + '"></label><label><span>书信类型</span><select class="tm-select" data-desk-letter-type data-letter-draft-field="type"><option value="secret_decree"' + (type === 'secret_decree' ? ' selected' : '') + '>密旨</option><option value="military_order"' + (type === 'military_order' ? ' selected' : '') + '>征调令</option><option value="greeting"' + (type === 'greeting' ? ' selected' : '') + '>问安函</option><option value="personal"' + (type === 'personal' ? ' selected' : '') + '>私函</option><option value="formal_edict"' + (type === 'formal_edict' ? ' selected' : '') + '>正式诏令</option><option value="proclamation"' + (type === 'proclamation' ? ' selected' : '') + '>檄文</option></select></label><label><span>驿递缓急</span><select class="tm-select" data-desk-letter-urgency data-letter-draft-field="urgency"><option value="normal"' + (urgency === 'normal' ? ' selected' : '') + '>普通驿递</option><option value="urgent"' + (urgency === 'urgent' ? ' selected' : '') + '>加急驿递</option><option value="extreme"' + (urgency === 'extreme' ? ' selected' : '') + '>八百里加急</option></select></label><label><span>加密方式</span><select class="tm-select" data-desk-letter-cipher data-letter-draft-field="cipher"><option value="none"' + (cipher === 'none' ? ' selected' : '') + '>不加密</option><option value="yinfu"' + (cipher === 'yinfu' ? ' selected' : '') + '>阴符</option><option value="yinshu"' + (cipher === 'yinshu' ? ' selected' : '') + '>阴书</option><option value="wax_ball"' + (cipher === 'wax_ball' ? ' selected' : '') + '>蜡丸密函</option><option value="silk_sewn"' + (cipher === 'silk_sewn' ? ' selected' : '') + '>帛书缝衣</option></select></label><label><span>信使方式</span><select class="tm-select" data-desk-letter-sendmode data-letter-draft-field="sendMode"><option value="normal"' + (sendMode === 'normal' ? ' selected' : '') + '>普通信使</option><option value="multi_courier"' + (sendMode === 'multi_courier' ? ' selected' : '') + '>多路信使</option><option value="secret_agent"' + (sendMode === 'secret_agent' ? ' selected' : '') + '>密使</option></select></label></div><textarea class="tm-textarea hy-compose-paper-v5" data-desk-letter-body data-letter-draft-field="body" placeholder="致书' + attr(target.name) + '……">' + esc(body) + '</textarea><div class="hy-compose-actions-v5">' + actionBtn('遣使送出', 'letter-send-desk', {}, 'tm-action-primary') + actionBtn('存为草稿', 'letter-draft-desk', {}, 'tm-action-ghost') + actionBtn('入人物记忆', 'letter-memory-desk', {}, 'tm-action-ghost') + '</div></section>' +
      '<section class="hy-thread-card-v5"><header><span><b>往来信札</b><em>' + esc(target.name) + ' · ' + esc(filter === 'all' ? '全部' : filter) + '</em></span><div class="hy-filterbar-v5">' + filterBtns + '</div></header><div class="hy-thread-scroll-v5">' + thread + '</div></section></main>' +
      '<aside class="hy-inbox-pane-v5"><div class="tm-panel-v4-title"><span class="seal">函</span><span><b>来信</b><span>主动来函 / 回书 / 未阅</span></span></div><div class="hy-inbox-summary-v5"><span>总来信 <b>' + esc(inboxRows.length) + '</b></span><span>未阅 <b>' + esc(unreadInbox) + '</b></span></div><div class="hy-inbox-scroll-v5">' + inbox + '</div></aside>' +
      '</section>';
  }

  function formalGroupBy(rows, fn){
    return rows.reduce(function(out, row){
      var key = fn(row) || '未分组';
      (out[key] || (out[key] = [])).push(row);
      return out;
    }, {});
  }

  function formalRecordRows(){
    return collectRecentEvents(80).map(function(e, i){
      var turn = Number(e.turn || ((window.GM && GM.turn) || 1));
      var text = e.detail || e.text || e.body || e.summary || '';
      return {
        id: e.id || ('rec-' + i),
        kind: 'event',
        turn: turn,
        date: e.date || e.time || getTurnText(turn),
        type: e.type || e.category || '近事',
        title: e.title || e.name || '未题',
        text: text,
        tags: e.tags || [e.type || '近事'],
        source: e.source || e.type || '近事',
        seal: '事'
      };
    });
  }

  function formalRecordText(x){
    if (!x) return '';
    if (typeof x === 'string') return x;
    return x.zhengwen || x.content || x.text || x.detail || x.body || x.summary || x.desc || x.description || x.narrative || x.result || '';
  }

  function formalRecordDate(x, turn){
    x = x || {};
    return x.time || x.date || x.raisedDate || x.resolvedDate || x.year || getTurnText(turn || x.turn || ((window.GM && GM.turn) || 1));
  }

  function formalLooseText(x){
    return String(x || '').replace(/\s|\u3000/g, '');
  }

  function formalRowNeedle(row){
    return [row.title, row.type, row.source, row.actor, row.date, row.text, (row.tags || []).join(' '), row.status].filter(Boolean).join(' ');
  }

  function formalFilterRows(rows){
    var q = String(state.recordSearch || '').trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(function(row){ return formalRowNeedle(row).toLowerCase().indexOf(q) >= 0; });
  }

  function formalRecordSort(rows){
    return rows.sort(function(a, b){
      var dt = Number(b.turn || 0) - Number(a.turn || 0);
      if (dt) return dt;
      return Number(b.seq || 0) - Number(a.seq || 0);
    });
  }

  function formalShijiType(sj){
    var txt = [sj.shizhengji, sj.shilu, sj.szjTitle, sj.turnSummary, sj.szjSummary].join(' ');
    if (/战|兵|军|边|攻城|受陷|大捷|出师/.test(txt)) return '战事';
    if (/崩|薨|卒|病死|自尽|遇害/.test(txt)) return '人物';
    if (/旱|洪|疫|灾|异|地震|雪|蝗/.test(txt)) return '灾异';
    if (/党|弹劾|阉党|东林|朋党/.test(txt)) return '党争';
    if (/赋|税|银|钱|粮|财政|国库/.test(txt)) return '财政';
    return '时政';
  }

  function formalShijiTags(sj){
    var tags = [formalShijiType(sj)];
    var txt = [sj.shizhengji, sj.shilu, sj.szjTitle, sj.turnSummary, sj.szjSummary].join(' ');
    if (/战|兵|军|边/.test(txt)) tags.push('军务');
    if (/官|任|罢|升|贬|人物/.test(txt) || (Array.isArray(sj.personnel) && sj.personnel.length)) tags.push('人事');
    if (/灾|疫|旱|洪|蝗|异/.test(txt)) tags.push('灾异');
    if (/党|弹劾/.test(txt)) tags.push('党争');
    return tags.filter(function(t, i, arr){ return t && arr.indexOf(t) === i; });
  }

  function formalShijiRows(){
    var gm = window.GM || {};
    var rows = [];
    if (Array.isArray(gm.shijiHistory)) {
      gm.shijiHistory.forEach(function(sj, i){
        sj = sj || {};
        var turn = Number(sj.turn || (i + 1));
        var parts = [
          sj.turnSummary || sj.szjSummary || '',
          sj.shizhengji || '',
          sj.shilu || '',
          sj.shizhengji2 || '',
          sj.qijuHistory || '',
          sj.yupiHuiting || ''
        ].filter(Boolean);
        rows.push({
          id: 'shiji-' + i,
          kind: 'shiji',
          rawIndex: i,
          raw: sj,
          turn: turn,
          seq: i,
          date: formalRecordDate(sj, turn),
          type: formalShijiType(sj),
          title: sj.szjTitle || sj.turnSummary || ('第 ' + turn + ' 回合史记'),
          text: parts.join('\n\n') || formalRecordText(sj),
          tags: formalShijiTags(sj),
          source: '史记',
          seal: '史'
        });
      });
    }
    return formalRecordSort(rows);
  }

  function formalQijuNormalize(r){
    r = r || {};
    if (typeof window._qijuNormalize === 'function') {
      try {
        var old = window._qijuNormalize(r);
        if (old && old.text) return old;
      } catch(_) {}
    }
    var text = '';
    var cat = r.category || '';
    if (r.edicts) {
      var parts = [];
      if (r.edicts.political) parts.push('政：' + r.edicts.political);
      if (r.edicts.military) parts.push('军：' + r.edicts.military);
      if (r.edicts.diplomatic) parts.push('外：' + r.edicts.diplomatic);
      if (r.edicts.economic) parts.push('经：' + r.edicts.economic);
      if (r.edicts.other) parts.push('其余：' + r.edicts.other);
      if (parts.length) { text += parts.join('\n'); cat = cat || '诏令'; }
      if (r.xinglu) { text += (text ? '\n' : '') + '【行止】' + r.xinglu; cat = cat || '行止'; }
    }
    if (!text && r.zhengwen) { text = r.zhengwen; cat = cat || '叙事'; }
    if (!text) text = formalRecordText(r);
    if (!cat) {
      if (/【鸿雁|【驿递|书信/.test(text)) cat = '鸿雁';
      else if (/【朝议|【常朝|廷议|经筵/.test(text)) cat = '朝议';
      else if (/【奏疏|批复|朱批/.test(text)) cat = '奏疏';
      else if (/【诏令|【敕令|诏曰/.test(text)) cat = '诏令';
      else if (/【行止|起居/.test(text)) cat = '行止';
      else if (/【任命|【启程|【赴任|人物|召见/.test(text)) cat = '人事';
      else cat = '叙事';
    }
    return { text: text || '暂无内容', cat: cat || '叙事' };
  }

  function formalQijuRows(){
    var gm = window.GM || {};
    return formalRecordSort((Array.isArray(gm.qijuHistory) ? gm.qijuHistory : []).map(function(r, i){
      var n = formalQijuNormalize(r);
      var turn = Number(r.turn || 0);
      return {
        id: 'qiju-' + i,
        kind: 'qiju',
        rawIndex: i,
        raw: r,
        turn: turn,
        seq: i,
        date: formalRecordDate(r, turn),
        type: n.cat,
        title: n.cat + ' · 第 ' + (turn || '?') + ' 回合',
        text: n.text,
        annotation: r._annotation || '',
        tags: [n.cat].concat(r.tags || []),
        source: '起居注',
        seal: '注'
      };
    }));
  }

  function formalJishiSource(r){
    if (typeof window._jishiSource === 'function') {
      try { return window._jishiSource(r); } catch(_) {}
    }
    var mode = r && r.mode || '';
    var ps = r && r.playerSaid || '';
    if (mode === 'changchao') return { key:'changchao', label:'常朝', icon:'朝' };
    if (mode === 'yuqian') return { key:'yuqian', label:'御前会议', icon:'御' };
    if (mode === 'tinyi' || mode === 'tingyi') return { key:'tingyi', label:'廷议', icon:'廷' };
    if (mode === 'keyi') return { key:'keyi', label:'科议', icon:'科' };
    if (mode === 'jingyan') return { key:'jingyan', label:'经筵', icon:'经' };
    if (mode === 'private') return { key:'private', label:'问对·私下', icon:'私' };
    if (mode === 'formal') return { key:'formal', label:'问对·正式', icon:'殿' };
    if (/抗疏/.test(ps)) return { key:'kangshu', label:'抗疏', icon:'抗' };
    if (/奏疏/.test(ps)) return { key:'memo', label:'奏疏', icon:'奏' };
    if (/鸿雁|书函|来函|书信/.test(ps)) return { key:'letter', label:'鸿雁', icon:'雁' };
    if (/密报|东厂|侦询/.test(ps)) return { key:'mibao', label:'密报', icon:'密' };
    if (/求见/.test(ps)) return { key:'audience', label:'求见', icon:'见' };
    return { key:'record', label:'杂录', icon:'录' };
  }

  function formalJishiRows(){
    var gm = window.GM || {};
    return formalRecordSort((Array.isArray(gm.jishiRecords) ? gm.jishiRecords : []).map(function(r, i){
      r = r || {};
      var src = formalJishiSource(r);
      var turn = Number(r.turn || 0);
      var parts = [];
      if (r.topic) parts.push('议题：' + r.topic);
      if (r.playerSaid) parts.push('上：' + r.playerSaid);
      if (r.npcSaid) parts.push((r.char || '对方') + '：' + r.npcSaid);
      if (r.outcome || r.finalRuling || r.decree || r.approval) parts.push('结论：' + (r.outcome || r.finalRuling || r.decree || r.approval));
      return {
        id: 'jishi-' + i,
        kind: 'jishi',
        rawIndex: i,
        raw: r,
        turn: turn,
        seq: i,
        date: formalRecordDate(r, turn),
        type: src.label,
        title: (r.char || r.from || '纪事') + (r.topic ? ' · ' + r.topic : ''),
        text: parts.join('\n') || formalRecordText(r),
        actor: r.char || r.from || '',
        mood: r.mood || '',
        starred: !!r._starred,
        tags: [src.label].concat(r._starred ? ['要事'] : []),
        source: src.label,
        seal: src.icon || '录'
      };
    }));
  }

  function formalBiannianActiveRows(){
    var gm = window.GM || {};
    var rows = [];
    try {
      if (window.ChronicleTracker && typeof window.ChronicleTracker.getVisible === 'function') {
        rows = rows.concat((window.ChronicleTracker.getVisible() || []).map(function(t, i){
          t = t || {};
          return {
            id: t.id || ('bn-track-' + i),
            kind: 'biannian-active',
            turn: Number(t.startTurn || t.turn || 0),
            date: formalRecordDate(t, t.startTurn || t.turn),
            type: t.type || '长期事势',
            title: t.title || t.name || '长期事势',
            text: t.narrative || t.content || t.desc || '',
            actor: t.actor || t.owner || '',
            status: t.currentStage || t.stage || t.status || '推进中',
            progress: Math.max(0, Math.min(100, Number(t.progress || t.progressPercent || 0) || 0)),
            tags: [t.type || '长期事势'],
            source: '编年',
            seal: '势'
          };
        }));
      }
    } catch(_) {}
    (Array.isArray(gm.biannianItems) ? gm.biannianItems : []).forEach(function(item, i){
      item = item || {};
      var start = Number(item.startTurn || item.turn || gm.turn || 1);
      var duration = Number(item.duration || item.expectedTurns || 1) || 1;
      var elapsed = Math.max(0, Number(gm.turn || start) - start);
      if (item._resolved || item.completed || elapsed >= duration) return;
      rows.push({
        id: item.id || ('bn-active-' + i),
        kind: 'biannian-active',
        turn: start,
        date: formalRecordDate(item, start),
        type: item.type || item.category || '长期事项',
        title: item.title || item.name || '长期事项',
        text: item.content || item.desc || item.description || '',
        actor: item.actor || item.owner || item.assignee || '',
        status: item.stage || item.status || '进行中',
        progress: Math.max(0, Math.min(100, Number(item.progress || item.progressPercent || Math.round(elapsed / duration * 100)) || 0)),
        tags: [item.type || item.category || '长期事项'],
        source: '编年',
        seal: '势'
      });
    });
    return formalRecordSort(rows);
  }

  function formalBiannianRows(){
    var gm = window.GM || {};
    var rows = [];
    (Array.isArray(gm._chronicle) ? gm._chronicle : []).forEach(function(c, i){
      c = c || {};
      var turn = Number(c.turn || 0);
      rows.push({
        id: c.id || ('bn-chronicle-' + i),
        kind: 'biannian',
        raw: c,
        turn: turn,
        seq: i,
        date: formalRecordDate(c, turn),
        type: c.category || c.type || '史册',
        title: c.title || c.name || '编年条目',
        text: c.content || c.text || c.desc || '',
        tags: [c.category || c.type || '史册'],
        source: '永久编年',
        seal: '年'
      });
    });
    return formalRecordSort(rows);
  }

  function renderRecordCard(row, archiveKind){
    var id = row.id || row.title || '';
    var active = String(id) === String(state.recordId || '');
    var tags = (row.tags || []).filter(Boolean).slice(0, 6);
    var hot = /灾|败|危|急|乱|崩|战|叛|死|降/.test([row.type, row.title, row.text].join(''));
    var meta = [row.date, row.type, row.actor, row.status, row.source].filter(Boolean).join(' · ');
    var actions = actionBtn('展阅', 'select-record-desk', { id:id }, 'tm-mini-btn green');
    if (row.kind === 'shiji') actions += actionBtn('打开原卷', 'record-open-shiji-desk', { id:id }, 'tm-mini-btn');
    if (row.kind === 'qiju') actions += actionBtn('御批', 'record-annotate-desk', { id:id }, 'tm-mini-btn');
    if (row.kind === 'jishi') actions += actionBtn(row.starred ? '取消星标' : '标为要事', 'record-star-desk', { id:id }, 'tm-mini-btn');
    actions += actionBtn(archiveKind === 'jishi' ? '编入纪事' : archiveKind === 'biannian' ? '转为编年' : '收入实录', 'record-archive-desk', { record:archiveKind || 'shilu' }, 'tm-mini-btn');
    return '<article class="records-entry-v5 ' + (active ? 'active ' : '') + (hot ? 'hot' : '') + '" data-record-search-text="' + attr(formalRowNeedle(row)) + '">' +
      '<header><span class="records-seal-v5">' + esc(row.seal || '史') + '</span><span class="records-entry-main-v5"><b>' + esc(row.title || '未题') + '</b><em>' + esc(meta || '未署年月') + '</em></span></header>' +
      '<div class="records-entry-body-v5">' + esc(row.text || '暂无详情。') + '</div>' +
      (row.annotation ? '<div class="records-annot-v5"><b>御批</b><p>' + esc(row.annotation) + '</p></div>' : '') +
      (tags.length ? '<div class="tm-chip-row">' + tags.map(function(t){ return actionChip(t, /要事|灾|危|急|战|乱/.test(String(t)) ? 'hot' : ''); }).join('') + '</div>' : '') +
      '<div class="records-card-actions">' + actions + '</div></article>';
  }

  function renderRecordGroup(title, rows, archiveKind, note){
    if (!rows.length) return '';
    return '<section class="records-section-v5" data-record-group><h3 class="records-section-title-v5"><span>' + esc(title) + '</span><small>' + esc(note || (rows.length + ' 条')) + '</small></h3>' + rows.map(function(r){ return renderRecordCard(r, archiveKind); }).join('') + '</section>';
  }

  function renderRecordFilterButtons(options, key, current){
    return '<div class="records-filter-v5">' + options.map(function(t){
      return '<button type="button" class="' + (current === t ? 'active' : '') + '" data-desk-action="record-filter-desk" data-key="' + attr(key) + '" data-value="' + attr(t) + '">' + esc(t) + '</button>';
    }).join('') + '</div>';
  }

  function renderRecordExportButton(tab){
    var fn = tab === 'qiju' ? '_qijuExport' : tab === 'jishi' ? '_jishiExport' : tab === 'biannian' ? '_bnExport' : '_sjlExport';
    return '<button type="button" class="tm-mini-btn" onclick="if(window.' + fn + ')window.' + fn + '()">导出本卷</button>';
  }

  function renderFormalRecordShiji(){
    var events = formalShijiRows();
    var type = state.recordTypeFilter || '全部';
    var types = ['全部','时政','战事','党争','灾异','人物','财政'];
    var rows = formalFilterRows(events).filter(function(r){ return type === '全部' || String(r.type).indexOf(type) >= 0 || (r.tags || []).indexOf(type) >= 0; });
    var groups = formalGroupBy(rows, function(r){ return getTurnText(r.turn); });
    var body = Object.keys(groups).sort(function(a,b){ return Number((groups[b][0] || {}).turn || 0) - Number((groups[a][0] || {}).turn || 0); }).map(function(g){
      return renderRecordGroup(g, groups[g], 'shilu');
    }).join('');
    return renderActionStats([['史记回合', firstArray((window.GM || {}).shijiHistory).length], ['当前显示', rows.length], ['战事', events.filter(function(x){ return /战|军|兵|边/.test((x.type || '') + (x.tags || []).join('')); }).length], ['人事', events.filter(function(x){ return /人|官|任|升|罢/.test((x.type || '') + (x.tags || []).join('')); }).length], ['数据源', 'GM.shijiHistory']]) + renderRecordFilterButtons(types, 'recordTypeFilter', type) + (body || '<div class="records-empty-v5">无匹配史记。史记只收录过回合后的回合推演结果。</div>');
  }

  function renderFormalRecordQiju(){
    var events = formalQijuRows();
    var cats = ['全部','诏令','奏疏','朝议','鸿雁','人事','行止','叙事'];
    var cat = state.qijuCat || '全部';
    var sort = state.qijuSort || '近前';
    var annotOnly = state.qijuAnnotOnly === '只看御批';
    var rows = formalFilterRows(events).filter(function(r){ return cat === '全部' || r.type === cat || (r.tags || []).indexOf(cat) >= 0; });
    if (annotOnly) rows = rows.filter(function(r){ return !!r.annotation; });
    if (sort === '从旧到新') rows = rows.slice().reverse();
    if (sort === '御批优先') rows = rows.slice().sort(function(a, b){ return (b.annotation ? 1 : 0) - (a.annotation ? 1 : 0) || Number(b.turn || 0) - Number(a.turn || 0); });
    var groups = formalGroupBy(rows, function(r){ return '第 ' + (r.turn || '?') + ' 回合' + (r.date ? ' · ' + r.date : ''); });
    var body = Object.keys(groups).map(function(g){
      return renderRecordGroup(g, groups[g], 'shilu', '按日列注');
    }).join('');
    return renderActionStats([['起居注', events.length], ['当前显示', rows.length], ['诏令', events.filter(function(x){ return x.type === '诏令'; }).length], ['奏疏', events.filter(function(x){ return x.type === '奏疏'; }).length], ['御批', events.filter(function(x){ return x.annotation; }).length]]) + renderRecordFilterButtons(cats, 'qijuCat', cat) + renderRecordFilterButtons(['近前','从旧到新','御批优先'], 'qijuSort', sort) + renderRecordFilterButtons(['全部条目','只看御批'], 'qijuAnnotOnly', annotOnly ? '只看御批' : '全部条目') + (body || '<div class="records-empty-v5">无匹配起居注。调整筛选或搜索后再试。</div>');
  }

  function renderFormalRecordJishi(){
    var events = formalJishiRows();
    var sources = ['全部','常朝','御前会议','廷议','科议','经筵','问对·正式','问对·私下','奏疏','抗疏','鸿雁','求见','密报','杂录'];
    var source = state.jishiSource || '全部';
    var view = state.jishiView || '按时间';
    var rows = formalFilterRows(events).filter(function(r){ return source === '全部' || formalLooseText(r.source) === formalLooseText(source) || formalLooseText(r.type) === formalLooseText(source); });
    var groups = formalGroupBy(rows, function(r){
      if (view === '按人物') return r.actor || '未署人物';
      if (view === '按事类') return r.source || r.type || '杂录';
      return '第 ' + (r.turn || '?') + ' 回合' + (r.date ? ' · ' + r.date : '');
    });
    var body = Object.keys(groups).map(function(g){
      return renderRecordGroup(g, groups[g], 'jishi');
    }).join('');
    var uniqueChars = {};
    events.forEach(function(r){ if (r.actor) uniqueChars[r.actor] = 1; });
    return renderActionStats([['纪事', events.length], ['当前显示', rows.length], ['涉及人物', Object.keys(uniqueChars).length], ['星标要事', events.filter(function(x){ return x.starred; }).length], ['来源类', Object.keys(formalGroupBy(events, function(r){ return r.source; })).length]]) + renderRecordFilterButtons(['按时间','按人物','按事类'], 'jishiView', view) + renderRecordFilterButtons(sources, 'jishiSource', source) + (body || '<div class="records-empty-v5">无匹配纪事。调整来源或搜索后再试。</div>');
  }

  function renderBiannianActiveCard(row){
    var progress = Math.max(0, Math.min(100, Number(row.progress || 0) || 0));
    return '<article class="bn-affair-v5" data-record-search-text="' + attr(formalRowNeedle(row)) + '"><header><span class="records-seal-v5">' + esc(row.seal || '势') + '</span><span><b>' + esc(row.title || '长期事势') + '</b><em>' + esc([row.actor || '有司', row.status || '推进中', row.date].filter(Boolean).join(' · ')) + '</em></span></header><p>' + esc(row.text || '此事仍在推进，后续回合会继续影响朝野局势。') + '</p><div class="bn-progress-v5"><i style="width:' + progress + '%"></i></div><div class="tm-chip-row">' + actionChip('进度 ' + progress + '%', progress >= 70 ? 'green' : '') + (row.type ? actionChip(row.type) : '') + '</div></article>';
  }

  function renderFormalRecordBiannian(){
    var activeRows = formalFilterRows(formalBiannianActiveRows());
    var events = formalBiannianRows();
    var filter = state.biannianFilter || '全部';
    var filters = ['全部','进行中','已毕','长期事项','史册','朝代事件'];
    var rows = formalFilterRows(events).filter(function(r){ return filter === '全部' || String((r.tags || []).join(' ') + r.type + r.status + r.source).indexOf(filter) >= 0; });
    var activeHtml = activeRows.length ? activeRows.map(renderBiannianActiveCard).join('') : '<article class="bn-affair-v5"><header><span class="records-seal-v5">势</span><span><b>暂无进行中事势</b><em>工程、军务、财赋改革、外交、暗线会在此处延续</em></span></header><p>当诏令、奏疏、朝议或 AI 推演形成跨回合事项后，会进入编年长期追踪。</p><div class="bn-progress-v5"><i style="width:0%"></i></div></article>';
    var groups = formalGroupBy(rows, function(r){ return r.date || getTurnText(r.turn); });
    var chronicle = Object.keys(groups).map(function(g){
      return renderRecordGroup(g, groups[g], 'biannian');
    }).join('');
    return renderActionStats([['长期事势', activeRows.length], ['编年条目', events.length], ['当前显示', rows.length], ['进行中', events.filter(function(x){ return (x.tags || []).indexOf('进行中') >= 0; }).length], ['永久史册', events.filter(function(x){ return x.source === '永久编年'; }).length]]) + renderRecordFilterButtons(filters, 'biannianFilter', filter) + '<section class="records-section-v5" data-record-group><h3 class="records-section-title-v5"><span>长期事势</span><small>' + esc(activeRows.length) + ' 件</small></h3><div class="bn-active-grid-v5">' + activeHtml + '</div></section>' + (chronicle || '<div class="records-empty-v5">暂无编年条目。</div>');
  }

  function renderFormalRecordsPanel(){
    var tab = state.recordTab || 'shiji';
    if (tab === 'shilu') tab = 'qiju';
    state.recordTab = tab;
    var gm = window.GM || {};
    var rowsByTab = { shiji:formalShijiRows(), qiju:formalQijuRows(), jishi:formalJishiRows(), biannian:formalBiannianRows() };
    var tabs = [['shiji','史记','回合本纪'],['qiju','起居注','逐日实录'],['jishi','纪事','本末对话'],['biannian','编年','长期事势']];
    var currentRows = rowsByTab[tab] || rowsByTab.shiji;
    var selected = currentRows.find(function(x){ return String(x.id || x.title) === String(state.recordId || ''); }) || currentRows[0] || {};
    if (selected.id) state.recordId = selected.id;
    var counts = {
      shiji: rowsByTab.shiji.length,
      qiju: rowsByTab.qiju.length,
      jishi: rowsByTab.jishi.length,
      biannian: rowsByTab.biannian.length + formalBiannianActiveRows().length
    };
    var spine = tabs.map(function(t){
      var active = tab === t[0];
      return '<button type="button" class="records-tab-v5 ' + (active ? 'active' : '') + '" data-desk-action="record-tab-desk" data-tab="' + attr(t[0]) + '"><b>' + esc(t[1]) + '</b><span>' + esc(t[2]) + '</span><em>' + esc(counts[t[0]] || 0) + '</em></button>';
    }).join('');
    var title = (tabs.find(function(t){ return t[0] === tab; }) || tabs[0]);
    var renderer = { shiji:renderFormalRecordShiji, qiju:renderFormalRecordQiju, jishi:renderFormalRecordJishi, biannian:renderFormalRecordBiannian }[tab] || renderFormalRecordShiji;
    var selectedMeta = [selected.date, selected.type, selected.actor, selected.status, selected.source].filter(Boolean).join(' · ');
    var detailActions = actionBtn('收入实录', 'record-archive-desk', { record:'shilu' }, 'tm-mini-btn green') + actionBtn('编入纪事', 'record-archive-desk', { record:'jishi' }, 'tm-mini-btn') + actionBtn('转为编年', 'record-archive-desk', { record:'biannian' }, 'tm-mini-btn');
    if (selected.kind === 'shiji') detailActions = actionBtn('打开原卷', 'record-open-shiji-desk', { id:selected.id || '' }, 'tm-mini-btn green') + actionBtn('摘录入起居注', 'record-archive-desk', { record:'shilu' }, 'tm-mini-btn') + actionBtn('转为编年线索', 'record-archive-desk', { record:'biannian' }, 'tm-mini-btn');
    if (selected.kind === 'qiju') detailActions += actionBtn('御批', 'record-annotate-desk', { id:selected.id || '' }, 'tm-mini-btn');
    if (selected.kind === 'jishi') detailActions += actionBtn(selected.starred ? '取消星标' : '标为要事', 'record-star-desk', { id:selected.id || '' }, 'tm-mini-btn');
    return '<section class="records-cabinet-v5">' +
      '<aside class="records-spine-v5"><div class="tm-panel-v4-title"><span class="seal">史</span><span><b>史官实录</b><span>史记 / 起居注 / 纪事 / 编年</span></span></div>' + spine + '<div class="records-spine-note-v5"><b>承接旧四页</b><p>史记只读回合推演结果；近事和邸报仍归事件栏。起居注、纪事、编年分别沿用旧数据源。</p></div>' + actionBtn('关联人物', 'module-desk', { kind:'renwu' }, 'tm-mini-btn') + '</aside>' +
      '<main class="records-paper-v5"><header class="records-paper-head-v5"><span><h2>' + esc(title[1]) + '</h2><p>' + esc(title[2]) + '。本面板按旧四页真实职责收录，不把近事/邸报混入史记。</p></span><span class="tm-chip-row">' + actionChip('第 ' + esc(gm.turn || 1) + ' 回', 'green') + actionChip('可搜索') + '</span></header>' +
      '<div class="records-toolbar-v5"><input class="tm-input" data-desk-record-search value="' + attr(state.recordSearch || '') + '" placeholder="搜索日期、人物、事类、正文"><span class="tm-chip-row">' + renderRecordExportButton(tab) + actionBtn('关联人物', 'module-desk', { kind:'renwu' }, 'tm-mini-btn') + '</span></div>' +
      '<div class="records-scroll-v5">' + renderer() + '<div class="records-search-empty-v5" style="display:none">未找到匹配条目。</div></div>' +
      '</main>' +
      '<aside class="records-detail-v5"><div class="tm-panel-v4-title"><span class="seal">' + esc(selected.seal || '卷') + '</span><span><b>展卷</b><span>' + esc(selectedMeta || '未选择条目') + '</span></span></div><h3>' + esc(selected.title || '暂无档案') + '</h3><textarea class="tm-textarea records-detail-text-v5" data-desk-record-body>' + esc(selected.text || '') + '</textarea>' + (selected.annotation ? '<div class="records-annot-v5"><b>御批</b><p>' + esc(selected.annotation) + '</p></div>' : '') + '<div class="records-detail-actions-v5">' + detailActions + '</div></aside>' +
      '</section>';
  }

  function openZhaoPreviewPanel(){
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
    openDeskOverlay('tm-action-records-overlay', actionShell('records', renderFormalRecordsPanel()));
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
    openDeskOverlay('tm-shizheng-overlay', deskPanelShell('shizheng', '御案时政', '承接预览页朝政中心：待裁议题、召对密问、裁断记录', left, main, right));
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

  function rightIssueFirst(p, keys, fallback){
    for (var i = 0; i < keys.length; i += 1) {
      var v = p && p[keys[i]];
      if (v != null && v !== '') return v;
    }
    return fallback;
  }

  function rightIssueNum(p, keys, fallback){
    var v = rightIssueFirst(p, keys, null);
    var n = Number(v);
    if (!isFinite(n)) return fallback == null ? 50 : fallback;
    return Math.max(0, Math.min(100, n));
  }

  function rightIssueIsPlayer(p){
    var playerName = (window.P && P.playerInfo && P.playerInfo.characterName) || '';
    return !!(p && (p.isPlayer || p.player || personKey(p) === 'player' || (playerName && p.name === playerName)));
  }

  function rightIssueAtCourt(p){
    if (!p || p.alive === false || p.dead) return false;
    if (p._travelTo || p._enRouteToOffice || p._imprisoned || p.imprisoned || p._exiled || p.exiled || p._fled || p._missing) return false;
    if (typeof window._wdIsAtCapital === 'function') {
      try { return !!window._wdIsAtCapital(p); } catch(_) {}
    }
    var gm = window.GM || {};
    var capital = String(gm._capital || '京师').replace(/\s+/g, '');
    var loc = String(p.location || p.place || p.currentLocation || '').replace(/\s+/g, '');
    var status = String(p.status || p.state || '');
    var office = String(p.officialTitle || p.office || p.title || p.role || '');
    if (loc && (loc.indexOf(capital) >= 0 || /京|京师|京城|北京|宫|内廷|乾清|紫禁/.test(loc))) return true;
    if (!loc && /内阁|六部|都察院|司礼监|御史|给事中|尚书|侍郎|朝|宫|内廷/.test(office + status)) return true;
    return /在京|在朝|候旨|入值|当值/.test(status + office);
  }

  function rightIssuePersonTitle(p){
    return rightIssueFirst(p, ['officialTitle','office','title','role','position'], '未仕');
  }

  function rightIssueFaction(p){
    return rightIssueFirst(p, ['faction','party','class','group','camp'], '未录派系');
  }

  function rightCleanFactionName(value){
    return String(value || '')
      .replace(/[\s·\-—_]/g, '')
      .replace(/^大/, '')
      .replace(/(朝廷|王朝|政权|汗国|幕府|朝)$/g, '');
  }

  function rightCollectPlayerFactionNames(){
    var gm = window.GM || {};
    var p = window.P || {};
    var out = [];
    function add(value){
      if (!value) return;
      if (typeof value === 'object') {
        add(value.name || value.factionName || value.id || value.key);
        return;
      }
      value = String(value || '').trim();
      if (value && out.indexOf(value) < 0) out.push(value);
    }
    var pi = p.playerInfo || {};
    add(pi.factionName);
    add(pi.characterFaction);
    add(gm.playerFaction);
    var pc = Array.isArray(gm.chars) ? gm.chars.find(function(c){ return c && c.isPlayer; }) : null;
    add(pc && (pc.faction || pc.factionName));
    [gm.facs, gm.factions].forEach(function(list){
      (Array.isArray(list) ? list : []).forEach(function(f){
        if (!f) return;
        if (f.isPlayer || f.player || f.isPlayerFaction || (gm.playerFaction && f.name === gm.playerFaction)) add(f.name || f.id);
      });
    });
    var sc = getActiveScenario();
    if (sc && sc.playerInfo) add(sc.playerInfo.factionName || sc.playerInfo.characterFaction);
    return out;
  }

  function rightKnownFactionNames(){
    var gm = window.GM || {};
    var sc = getActiveScenario();
    var out = [];
    function add(value){
      value = String(value || '').trim();
      if (value && out.indexOf(value) < 0) out.push(value);
    }
    [gm.facs, gm.factions, sc && sc.factions].forEach(function(list){
      (Array.isArray(list) ? list : []).forEach(function(f){ if (f) { add(f.name); add(f.id); } });
    });
    return out;
  }

  function rightFactionMatch(value, names){
    var clean = rightCleanFactionName(value);
    if (!clean) return false;
    return (names || []).some(function(name){
      var n = rightCleanFactionName(name);
      return n && (clean === n || clean.indexOf(n) >= 0 || n.indexOf(clean) >= 0);
    });
  }

  function rightIsGenericCourtFaction(value){
    return /^(朝廷|本朝|官府|内廷|宫廷|皇室|王室|帝室|朝中|中枢)$/.test(String(value || '').trim());
  }

  function rightIssueIsPlayerFactionPerson(p){
    if (!p || p.alive === false || p.dead || rightIssueIsPlayer(p)) return false;
    if (p.spouse) return true;
    var playerFactions = rightCollectPlayerFactionNames();
    if (typeof window._isPlayerFactionChar === 'function') {
      try { if (window._isPlayerFactionChar(p)) return true; } catch(_) {}
    }
    var explicit = [
      p.faction, p.factionName, p.currentFaction, p.allegiance,
      p.country, p.polity, p.realm, p.kingdom, p.force, p.camp
    ].filter(function(x){ return x != null && String(x).trim(); });
    if (p._envoy || p.isEnvoy || p.fromFaction) {
      return !!(p.fromFaction && rightFactionMatch(p.fromFaction, playerFactions));
    }
    if (explicit.length === 0) return true;
    if (explicit.some(rightIsGenericCourtFaction)) return true;
    if (playerFactions.length && explicit.some(function(x){ return rightFactionMatch(x, playerFactions); })) return true;
    var knownFactions = rightKnownFactionNames();
    if (knownFactions.length && explicit.some(function(x){ return rightFactionMatch(x, knownFactions); })) return false;
    return true;
  }

  function rightIssueTopic(p){
    var direct = rightIssueFirst(p, ['topic','currentTopic','agenda','currentAgenda','concern','demand','wish'], '');
    if (direct) return compactText(direct, 80);
    var office = rightIssuePersonTitle(p);
    if (/兵|军|督师|总兵|经略/.test(office)) return '可问边防、军饷、调防与将帅虚实。';
    if (/户|仓|漕|盐|税|粮/.test(office)) return '可问钱粮、漕运、赋税与库藏缺口。';
    if (/吏|都察|御史|给事/.test(office)) return '可问官箴、弹劾、考成与朝局风声。';
    if (/礼|学士|文|讲官/.test(office)) return '可问礼制、士论、经筵与舆情。';
    return '可问其所掌政务、朝局见闻与个人请陈。';
  }

  function rightIssuePortrait(p){
    var img = '';
    try {
      if (p && typeof tmfRenwuPortrait === 'function') img = tmfRenwuPortrait(p);
    } catch(_) {}
    if (!img && p) {
      img = p.portrait || p.avatar || p.image || p.img || p.photo || p.fullBody || p.halfBody || p.characterImage || p.illustration || p.standingArt || p.cardPortrait || '';
    }
    if (img) {
      img = String(img);
      if (/^(https?:|data:|\/|preview\/|assets\/)/.test(img)) {}
      else if (img.indexOf('img/') === 0) img = 'preview/' + img;
      else if (img.indexOf('portraits/') === 0) img = 'preview/img/' + img;
      return '<span class="tmrp-avatar portrait"><img src="' + attr(img) + '" alt=""></span>';
    }
    return '<span class="tmrp-avatar">' + esc(String((p && p.name) || '?').slice(0, 1) || '?') + '</span>';
  }

  function rightIssuePeople(){
    return getPeople().filter(function(p){
      return p && rightIssueIsPlayerFactionPerson(p);
    }).sort(function(a, b){
      var ac = rightIssueAtCourt(a) ? 1 : 0;
      var bc = rightIssueAtCourt(b) ? 1 : 0;
      if (bc !== ac) return bc - ac;
      var ap = (state.pinnedPeople || []).indexOf(personKey(a)) >= 0 ? 1 : 0;
      var bp = (state.pinnedPeople || []).indexOf(personKey(b)) >= 0 ? 1 : 0;
      if (bp !== ap) return bp - ap;
      var aa = rightIssueNum(a, ['stress','ambition','influence'], 0);
      var bb = rightIssueNum(b, ['stress','ambition','influence'], 0);
      return bb - aa;
    });
  }

  function rightIssueRows(rows){
    return '<div class="tmrp-rows">' + rows.map(function(r){
      return '<div><span>' + esc(r[0]) + '</span><b>' + esc(r[1] == null || r[1] === '' ? '未录' : r[1]) + '</b></div>';
    }).join('') + '</div>';
  }

  function rightIssueBar(label, value){
    var n = Math.max(0, Math.min(100, Number(value) || 0));
    return '<div class="tmrp-bar"><span>' + esc(label) + '</span><i><b style="width:' + n + '%"></b></i><em>' + esc(Math.round(n)) + '</em></div>';
  }

  function rightIssuePersonButton(p, selectedKey){
    var key = personKey(p);
    var active = String(key) === String(selectedKey);
    var sub = [rightIssuePersonTitle(p), rightIssueFaction(p), p.location || p.status || ''].filter(Boolean).join(' · ');
    return '<button type="button" class="tmrp-person ' + (active ? 'active' : '') + '" data-right-action="wendui-select" data-id="' + attr(key) + '">' +
      rightIssuePortrait(p) +
      '<span><b>' + esc(p.name || key) + '</b><span>' + esc(sub) + '</span></span>' +
      '<small>' + (rightIssueAtCourt(p) ? '可召' : '传书') + '</small>' +
      '</button>';
  }

  function rightWenduiGroup(title, note, list, selectedKey){
    return '<section class="tmrp-card tmrp-group-card"><div class="tmrp-card-title"><span>' + esc(title) + '</span><small>' + esc(note || (list.length + ' 人')) + '</small></div>' +
      '<div class="tmrp-scroll compact">' +
      (list.length ? list.map(function(p){ return rightIssuePersonButton(p, selectedKey); }).join('') : '<div class="tmrp-empty">暂无记录。</div>') +
      '</div></section>';
  }

  function rightWenduiHistory(name){
    var gm = window.GM || {};
    var hist = gm.wenduiHistory && gm.wenduiHistory[name];
    return Array.isArray(hist) ? hist : [];
  }

  function rightHistoryCard(h){
    var role = h && h.role ? String(h.role) : '';
    var who = role === 'npc' ? '臣' : (role === 'player' ? '上' : '记');
    var text = typeof h === 'string' ? h : (h && (h.content || h.text || h.message || h.line || h.summary)) || '';
    var delta = h && h.loyaltyDelta != null ? ('忠诚 ' + (Number(h.loyaltyDelta) > 0 ? '+' : '') + h.loyaltyDelta) : '';
    return '<div class="tmrp-log"><b>' + esc(who) + '</b><span>' + esc(compactText(text, 110) || '无内容') + '</span>' + (delta ? '<em>' + esc(delta) + '</em>' : '') + '</div>';
  }

  function rightIssueTopicList(){
    var rows = [];
    var seen = {};
    function add(title, type, text){
      title = String(title || '').trim();
      if (!title || seen[title]) return;
      seen[title] = true;
      rows.push({ title:title, type:type || '朝政', text:text || '' });
    }
    getIssues().filter(function(x){ return !issueIsResolved(x); }).slice(0, 8).forEach(function(x){
      add(x.title, x.category || x.dept || x.severity, x.text || x.detail);
    });
    getMemorials().slice(0, 8).forEach(function(x){
      add(x.title, x.dept || x.type || '奏疏', x.text || x.content);
    });
    var gm = window.GM || {};
    (Array.isArray(gm._ccHeldItems) ? gm._ccHeldItems : []).slice(0, 5).forEach(function(x){
      add(x.title || x.topic, x.dept || x.type || '留中', x.content || x.detail);
    });
    return rows.slice(0, 10);
  }

  function rightChaoyiRecords(){
    var gm = window.GM || {};
    var out = [];
    (Array.isArray(gm.recentChaoyi) ? gm.recentChaoyi : []).forEach(function(r, i){
      r = r || {};
      out.push({ id:'recent-' + i, kind:r.kind || r.mode || '朝议', topic:r.topic || r.title || '未题', decision:r.decision || r.result || '', text:r.line || r.text || r.content || '' });
    });
    (Array.isArray(gm._courtRecords) ? gm._courtRecords : []).slice(-8).reverse().forEach(function(r, i){
      r = r || {};
      out.push({ id:'court-' + i, kind:r.mode || r.type || '朝议', topic:r.topic || r.title || '朝议记录', decision:r.finalRuling || r.decision || r.result || '', text:r.transcript || r.summary || r.content || '' });
    });
    (Array.isArray(gm.qijuHistory) ? gm.qijuHistory : []).forEach(function(r, i){
      var text = String((r && (r.content || r.text || r.zhengwen)) || '');
      if (!/朝议|常朝|廷议|御前会议|朔朝/.test(text)) return;
      out.push({ id:'qiju-' + i, kind:'起居注', topic:r.title || compactText(text, 24) || '朝议', decision:r.date || '', text:text });
    });
    return out.slice(0, 6);
  }

  function rightSelectedWenduiPerson(){
    var people = rightIssuePeople();
    var selected = findPerson(state.rightWenduiPerson);
    if (!selected || people.indexOf(selected) < 0) selected = people.filter(rightIssueAtCourt)[0] || people[0] || null;
    if (selected) state.rightWenduiPerson = personKey(selected);
    return selected;
  }

  function rightWenduiHasUnansweredLetter(name){
    var gm = window.GM || {};
    return (Array.isArray(gm.letters) ? gm.letters : []).some(function(l){
      return l && l._npcInitiated && l.from === name && l._replyExpected && !l._playerReplied && l.status === 'returned';
    });
  }

  function rightWenduiSeekReason(p){
    if (!p) return '';
    var stress = rightIssueNum(p, ['stress','pressure'], 0);
    var loyalty = rightIssueNum(p, ['loyalty','loyal'], 50);
    var ambition = rightIssueNum(p, ['ambition'], 50);
    var raw = String(p.status || '') + String(p.currentAgenda || '') + String(p.demand || '') + String(p.wish || '');
    if (rightWenduiHasUnansweredLetter(p.name || personKey(p))) return '前日来函未获回复，亲至求见。';
    if (/求见|候见|请见|请对|待对/.test(raw)) return compactText(raw, 58);
    if (stress > 60) return '面带忧色，似有为难之事。';
    if (loyalty > 90 && stress > 30) return '神色凝重，欲进忠言。';
    if (ambition > 80 && loyalty > 60) return '精神抖擞，欲呈策论。';
    return '候于殿外，请求面圣。';
  }

  function rightWenduiIsSeeker(p){
    if (!p || !rightIssueAtCourt(p)) return false;
    if (p._mourning || p._lastMetTurn === ((window.GM && GM.turn) || 1)) return false;
    var stress = rightIssueNum(p, ['stress','pressure'], 0);
    var loyalty = rightIssueNum(p, ['loyalty','loyal'], 50);
    var ambition = rightIssueNum(p, ['ambition'], 50);
    var raw = String(p.status || '') + String(p.currentAgenda || '') + String(p.demand || '') + String(p.wish || '');
    return /求见|候见|请见|请对|待对/.test(raw)
      || (loyalty > 90 && stress > 30)
      || (ambition > 80 && loyalty > 60)
      || stress > 60
      || rightWenduiHasUnansweredLetter(p.name || personKey(p));
  }

  function rightWenduiFactionTag(p){
    if (!p) return '';
    if (p.spouse) return '宫眷';
    if (p.party) return String(p.party).slice(0, 4);
    if (p.faction && p.faction !== '朝廷') return String(p.faction).slice(0, 4);
    var office = rightIssuePersonTitle(p);
    if (/将军|总兵|总督|指挥/.test(office)) return '武将';
    if (/司礼|太监|东厂/.test(office)) return '宦官';
    return '';
  }

  function rightWenduiPersonCard(p, action, note, extraAttrs){
    var key = personKey(p);
    var name = p.name || key;
    var hist = rightWenduiHistory(name);
    var loyalty = rightIssueNum(p, ['loyalty','loyal'], 50);
    var cls = loyalty >= 75 ? ' loyal-hi' : (loyalty < 45 ? ' loyal-lo' : '');
    var tag = rightWenduiFactionTag(p);
    return '<button type="button" class="tmrp-wd-person' + cls + (hist.length ? ' has-hist' : '') + '" data-right-action="' + attr(action || 'wendui-pick') + '" data-id="' + attr(key) + '"' + (extraAttrs || '') + '>' +
      rightIssuePortrait(p) +
      '<span class="main"><b>' + esc(name) + (p.spouse ? '<i>❦</i>' : '') + '</b><small>' + esc(rightIssuePersonTitle(p)) + '</small></span>' +
      '<span class="meta"><em>忠 ' + esc(Math.round(loyalty)) + '</em>' + (tag ? '<em>' + esc(tag) + '</em>' : '') + (note ? '<em>' + esc(note) + '</em>' : '') + '</span>' +
      '</button>';
  }

  function rightWenduiRequestItem(p){
    var key = personKey(p);
    var name = p.name || key;
    return '<article class="tmrp-wd-request">' +
      '<button type="button" class="tmrp-wd-request-main" data-right-action="wendui-audience" data-id="' + attr(key) + '">' +
      rightIssuePortrait(p) +
      '<span><b>' + esc(name) + '</b><small>' + esc(rightWenduiSeekReason(p)) + '</small></span>' +
      '</button>' +
      '<button type="button" class="tmrp-wd-mini danger" data-right-action="wendui-deny" data-id="' + attr(key) + '">不见</button>' +
      '</article>';
  }

  function rightWenduiQueueItem(q, idx){
    q = q || {};
    var name = q.name || '待见者';
    var initial = String(name).slice(0, 1) || '?';
    var person = findPerson(name);
    if (!person && typeof window.findCharByName === 'function') {
      try { person = window.findCharByName(name); } catch(_) {}
    }
    var face = person ? rightIssuePortrait(person) : '<span class="tmrp-avatar">' + esc(initial) + '</span>';
    return '<article class="tmrp-wd-request envoy">' +
      '<button type="button" class="tmrp-wd-request-main" data-right-action="wendui-queue" data-index="' + attr(idx) + '">' +
      face +
      '<span><b>' + esc(name) + (q.isEnvoy ? '<i>使节</i>' : '') + '</b><small>' + esc(compactText(q.reason || q.fromFaction || '等待陛下决断', 72)) + '</small></span>' +
      '</button>' +
      '<button type="button" class="tmrp-wd-mini" data-right-action="wendui-dismiss" data-index="' + attr(idx) + '">暂却</button>' +
      '</article>';
  }

  function rightWenduiGroupNew(title, note, body, emptyText){
    return '<section class="tmrp-card tmrp-wd-group"><div class="tmrp-card-title"><span>' + esc(title) + '</span><small>' + esc(note || '') + '</small></div>' +
      (body || '<div class="tmrp-empty">' + esc(emptyText || '暂无人物。') + '</div>') +
      '</section>';
  }

  function renderRightWenduiPanel(){
    var people = rightIssuePeople();
    var gm = window.GM || {};
    var pendingAudiences = Array.isArray(gm._pendingAudiences) ? gm._pendingAudiences : [];
    var atCourt = people.filter(rightIssueAtCourt);
    var seekers = atCourt.filter(rightWenduiIsSeeker);
    var waiting = atCourt.filter(function(p){ return seekers.indexOf(p) < 0; });
    var away = people.filter(function(p){ return !rightIssueAtCourt(p); });
    var waitingBody = waiting.length ? '<div class="tmrp-wd-grid">' + waiting.slice(0, 24).map(function(p){
      return rightWenduiPersonCard(p, 'wendui-pick', '');
    }).join('') + '</div>' : '';
    var awayBody = away.length ? '<div class="tmrp-wd-away">' + away.slice(0, 24).map(function(p){
      var loc = p.location || p.status || '远方';
      var travel = p._travelTo ? ' → ' + p._travelTo : '';
      return rightWenduiPersonCard(p, 'wendui-letter', compactText(loc + travel, 12));
    }).join('') + '</div>' : '';
    var queueBody = pendingAudiences.length ? '<div class="tmrp-wd-list">' + pendingAudiences.map(rightWenduiQueueItem).join('') + '</div>' : '';
    var seekerBody = seekers.length ? '<div class="tmrp-wd-list">' + seekers.slice(0, 12).map(rightWenduiRequestItem).join('') + '</div>' : '';
    return '<div class="tmrp-issue-shell tmrp-wendui">' +
      '<section class="tmrp-card tmrp-wd-rules"><div class="tmrp-card-title"><span>问对条件</span><small>旧流程原样承接</small></div>' +
      '<div><b>玩家召见</b><span>点击「百官候旨」人物，先选朝堂问对或私下叙谈。</span></div>' +
      '<div><b>臣下求见</b><span>点击「阶下待见 / 有臣求见」接见，人物先主动陈事。</span></div>' +
      '<div><b>不可召见</b><span>远方、在途、下狱、流放、病重、丁忧、逃亡、失踪等不走问对。</span></div>' +
      '</section>' +
      rightWenduiGroupNew('阶下待见', '使节、外藩、AI 推送求见 · 接见后对方先开口', queueBody, '暂无阶下待见。') +
      rightWenduiGroupNew('有臣求见', '压力高、忠诚极高、野心高或未回信者 · 接见后对方先开口', seekerBody, '暂无臣下主动求见。') +
      rightWenduiGroupNew('百官候旨', '在京在朝，可由玩家主动召见', waitingBody, '暂无在京可召人物。') +
      rightWenduiGroupNew('远方臣子', '不在陛下所在地，点击改走鸿雁传书', awayBody, '暂无远方臣子。') +
      '</div>';
  }

  function renderRightChaoyiPanel(){
    var mode = state.rightChaoyiMode || 'changchao';
    var modes = [
      { id:'changchao', name:'常朝', sub:'例行朝参', desc:'多事并奏、百官齐集、逐条裁决。', meta:'30-50 人 · 精力 10', img:'chaoyi-changchao-scene-v1.png' },
      { id:'tinyi', name:'廷议', sub:'集议大政', desc:'一议多轮、辩难立场、共识或乾纲独断。', meta:'15-30 人 · 精力 25', img:'chaoyi-tingyi-scene-v1.png' },
      { id:'yuqian', name:'御前会议', sub:'密召心腹', desc:'坦言直陈、君臣密议，可记起居注或不录。', meta:'3-8 人 · 精力 10', img:'chaoyi-yuqian-scene-v1.png' }
    ];
    return '<section class="tmrp-card">' +
      '<div class="tmrp-card-title"><span>朝议类型</span><small>点击场景图直接进入对应流程</small></div>' +
      '<div class="tmrp-chaoyi-scenes">' + modes.map(function(m){
        return '<button type="button" class="tmrp-chaoyi-card ' + (mode === m.id ? 'active' : '') + '" data-right-action="chaoyi-launch" data-mode="' + attr(m.id) + '">' +
          '<img src="' + attr(asset(m.img)) + '" alt="">' +
          '<span class="txt"><b>' + esc(m.name) + '</b><span>' + esc(m.sub + ' · ' + m.desc) + '</span><small>' + esc(m.meta) + '</small></span>' +
          '</button>';
      }).join('') + '</div>' +
      '</section>' +
      '<section class="tmrp-card">' +
      '<div class="tmrp-card-title"><span>流程承接</span><small>跳过旧版三选一中间页</small></div>' +
      '<div class="tmrp-meta">选择常朝、廷议或御前会议后，直接进入对应的筹备或朝会流程；议题、人员、奏对、记录与裁断仍由原业务逻辑处理。</div>' +
      '</section>';
  }

  function renderPinnedPeople(){
    var ids = state.pinnedPeople || [];
    var people = ids.map(findPerson).filter(Boolean);
    if (!people.length) {
      return '<section class="tmf-card empty"><div class="tmf-card-title">钉选臣僚</div><p>在人物图志或人物卡片上右键，可将人物钉选到这里。</p>' +
        actionButton('打开人物图志', '进入 Phase8 人物图志面板。', "TMPhase8FormalBridge.openModule('renwu')", 'main') +
        '</section>';
    }
    return '<section class="tmf-card"><div class="tmf-card-title">钉选臣僚 <small>' + people.length + ' 人</small></div><div class="tmf-person-list">' +
      people.map(function(p){
        var key = personKey(p);
        var img = p.avatar || p.portrait || p.image || '';
        return '<article class="tmf-person-card" data-person-id="' + esc(key) + '">' +
          '<div class="tmf-avatar">' + (img ? '<img src="' + esc(img) + '" alt="">' : esc((p.name || '?').slice(0,1))) + '</div>' +
          '<div class="tmf-person-main"><div class="tmf-person-head"><b>' + esc(p.name || key) + '</b><span>' + esc(p.title || p.office || p.role || p.faction || '') + '</span></div>' +
          miniRows([['忠', p.loyalty || p.loyal || '—'], ['智', p.intelligence || p.wisdom || '—'], ['政', p.administration || p.politics || '—'], ['军', p.military || '—']]) +
          '<div class="tmf-person-actions">' +
          '<button type="button" onclick="TMPhase8FormalBridge.personAction(\'' + esc(key) + '\',\'detail\')">详阅</button>' +
          '<button type="button" onclick="TMPhase8FormalBridge.personAction(\'' + esc(key) + '\',\'wendui\')">问对</button>' +
          '<button type="button" onclick="TMPhase8FormalBridge.personAction(\'' + esc(key) + '\',\'letter\')">传书</button>' +
          '<button type="button" onclick="TMPhase8FormalBridge.personAction(\'' + esc(key) + '\',\'office\')">官制</button>' +
          '<button type="button" class="danger" onclick="TMPhase8FormalBridge.unpin(\'' + esc(key) + '\')">移除</button>' +
          '</div></div></article>';
      }).join('') +
      '</div></section>';
  }

  function renderZheng(){
    var tab = state.rightIssueTab || 'wendui';
    return '<div class="tmrp-tabs tmrp-issue-tabs">' +
      '<button type="button" class="' + (tab === 'wendui' ? 'active' : '') + '" data-right-action="issue-tab" data-tab="wendui">问对</button>' +
      '<button type="button" class="' + (tab === 'chaoyi' ? 'active' : '') + '" data-right-action="issue-tab" data-tab="chaoyi">朝议</button>' +
      '</div>' +
      (tab === 'chaoyi' ? renderRightChaoyiPanel() : renderRightWenduiPanel());
  }

  function renderWen(){
    return '<section class="tmf-card"><div class="tmf-card-title">文事</div>' +
      '<div class="tmf-top-actions">' +
      actionButton('科举', '在新面板内处理开科、贡士、殿试与入仕。', 'TMPhase8FormalBridge.openKeju()', 'main') +
      actionButton('文事总览', '新面板承接文苑、士论、教化与著述。', "TMPhase8FormalBridge.openModule('wenshi')") +
      '</div></section>';
  }

  function renderGang(){
    var facs = (window.GM && Array.isArray(GM.facs)) ? GM.facs.slice(0, 5) : [];
    var parties = getParties().slice(0, 6);
    var classes = getClasses().slice(0, 6);
    return '<section class="tmf-card"><div class="tmf-card-title">纲纪总览</div><p class="tmf-note">此处直接渲染阶层、党派、势力数据，不再打开旧左栏。</p>' +
      '<div class="tmf-minirows">' +
      '<div><span>阶层</span><b>' + esc(classes.length || '待载') + '</b></div><div><span>党派</span><b>' + esc(parties.length || '待载') + '</b></div>' +
      '<div><span>势力</span><b>' + esc((window.GM && GM.facs && GM.facs.length) || facs.length || '待载') + '</b></div><div><span>当前</span><b>可读可查</b></div>' +
      '</div></section>' +
      '<section class="tmf-card"><div class="tmf-card-title">阶层</div>' +
      (classes.length ? classes.map(function(c){ return '<div class="tmf-line"><b>' + esc(c.name || c.label || c.id) + '</b><span>' + esc(c.influence || c.power || c.status || c.desc || '') + '</span></div>'; }).join('') : '<p class="tmf-note">暂无阶层摘录。</p>') +
      '</section>' +
      '<section class="tmf-card"><div class="tmf-card-title">党派</div>' +
      (parties.length ? parties.map(function(p){ return '<div class="tmf-line"><b>' + esc(p.name || p.label || p.id) + '</b><span>' + esc(p.leader || p.status || p.influence || p.desc || '') + '</span></div>'; }).join('') : '<p class="tmf-note">暂无党派摘录。</p>') +
      '</section>' +
      '<section class="tmf-card"><div class="tmf-card-title">势力摘录</div>' +
      (facs.length ? facs.map(function(f){ return '<div class="tmf-line"><b>' + esc(f.name || f.label || f.id) + '</b><span>' + esc(f.attitude || f.type || f.desc || '') + '</span></div>'; }).join('') : '<p class="tmf-note">暂无势力摘录。</p>') +
      '</section>';
  }

  function rightArmyFirst(a, keys, fallback){
    return rightIssueFirst(a, keys, fallback);
  }

  function rightArmyNumRaw(a, keys, fallback){
    var v = rightArmyFirst(a, keys, null);
    if (typeof v === 'string') v = v.replace(/,/g, '');
    var n = Number(v);
    return isFinite(n) ? n : (fallback == null ? 0 : fallback);
  }

  function rightArmyPercent(a, keys, fallback){
    var n = rightArmyNumRaw(a, keys, fallback == null ? 50 : fallback);
    return Math.max(0, Math.min(100, n));
  }

  function rightArmySoldiers(a){
    return Math.max(0, Math.round(rightArmyNumRaw(a, ['soldiers','size','strength','troops','initialTroops'], 0)));
  }

  function rightArmyFmtNum(n){
    n = Number(n);
    return isFinite(n) ? Math.round(n).toLocaleString() : '未录';
  }

  function rightArmyType(a){
    return rightArmyFirst(a, ['armyType','type','branch','category','kind'], '其他');
  }

  function rightArmyName(a){
    return rightArmyFirst(a, ['name','id'], '未名部队');
  }

  function rightArmyKey(a, idx){
    return String(rightArmyFirst(a, ['id','name'], 'army-' + idx));
  }

  function rightArmyFaction(a){
    return rightArmyFirst(a, ['faction','factionName','owner','camp','force','realm','country','polity'], '');
  }

  function rightArmyBelongsToPlayer(a){
    if (!a || a.destroyed || a.disbanded || a.active === false) return false;
    var explicit = [
      a.faction, a.factionName, a.owner, a.camp, a.force, a.realm, a.country, a.polity
    ].filter(function(x){ return x != null && String(x).trim(); });
    if (explicit.length === 0) return true;
    if (explicit.some(rightIsGenericCourtFaction)) return true;
    var playerFactions = rightCollectPlayerFactionNames();
    if (!playerFactions.length) return true;
    if (explicit.some(function(x){ return rightFactionMatch(x, playerFactions); })) return true;
    var knownFactions = rightKnownFactionNames();
    if (knownFactions.length && explicit.some(function(x){ return rightFactionMatch(x, knownFactions); })) return false;
    return true;
  }

  function rightArmyList(){
    var raw = getArmies().filter(function(a){ return a && !a.destroyed && !a.disbanded && a.active !== false; });
    var mine = raw.filter(rightArmyBelongsToPlayer);
    return mine.length || !raw.length ? mine : raw;
  }

  function rightFindArmy(key){
    key = String(key || '');
    var list = rightArmyList();
    return list.find(function(a, idx){
      return rightArmyKey(a, idx) === key || rightArmyName(a) === key || String(a.id || '') === key;
    }) || null;
  }

  function rightArmyCompositionText(value){
    if (Array.isArray(value)) {
      return value.map(function(x){
        if (!x) return '';
        if (typeof x === 'string') return x;
        var name = x.type || x.name || x.kind || x.unit || '兵种';
        var count = x.count || x.soldiers || x.size || x.strength || '';
        return name + (count ? ' ' + rightArmyFmtNum(count) : '');
      }).filter(Boolean).join(' / ') || '未录';
    }
    if (value && typeof value === 'object') {
      return Object.keys(value).map(function(k){ return k + ' ' + rightArmyFmtNum(value[k]); }).join(' / ') || '未录';
    }
    return value || '未录';
  }

  function rightArmyEquipmentText(a){
    var direct = rightArmyFirst(a, ['equipmentCondition','equipmentStatus','equipmentLevel'], '');
    if (direct) return direct;
    var eq = a && a.equipment;
    if (Array.isArray(eq)) {
      return eq.map(function(x){
        if (!x) return '';
        if (typeof x === 'string') return x;
        return (x.name || x.type || '装备') + (x.condition ? '·' + x.condition : '') + (x.count ? ' ' + rightArmyFmtNum(x.count) : '');
      }).filter(Boolean).join(' / ') || '未录';
    }
    return eq || '未录';
  }

  function rightArmyMoneyText(a){
    var value = rightArmyFirst(a, ['salary','annualSalary','yearlySalary','upkeep','cost','monthlyCost'], '');
    if (value && typeof value === 'object') {
      return Object.keys(value).map(function(k){ return k + ' ' + rightArmyFmtNum(value[k]); }).join(' / ');
    }
    if (value !== '') return isFinite(Number(value)) ? rightArmyFmtNum(value) : value;
    return '未录';
  }

  function rightArmyRows(rows){
    return '<div class="tmrp-rows">' + rows.map(function(r){
      return '<div><span>' + esc(r[0]) + '</span><b>' + esc(r[1] == null || r[1] === '' ? '未录' : r[1]) + '</b></div>';
    }).join('') + '</div>';
  }

  function rightArmyBar(label, value){
    var n = Math.max(0, Math.min(100, Number(value)));
    if (!isFinite(n)) n = 0;
    return '<div class="tmrp-bar"><span>' + esc(label) + '</span><i><b style="width:' + n + '%"></b></i><em>' + Math.round(n) + '</em></div>';
  }

  function renderRightArmyDetailCard(a){
    if (!a) return '';
    var armyKey = rightArmyKey(a, rightArmyList().indexOf(a));
    var soldiers = rightArmySoldiers(a);
    var morale = rightArmyPercent(a, ['morale','moraleValue'], 50);
    var training = rightArmyPercent(a, ['training','trainingValue'], 50);
    var loyalty = rightArmyPercent(a, ['loyalty','cohesion'], 50);
    var control = rightArmyPercent(a, ['control','discipline','commandControl'], 50);
    var supply = rightArmyPercent(a, ['supply','supplies'], 70);
    var mutiny = rightArmyPercent(a, ['mutinyRisk','rebellionRisk'], 0);
    var hot = morale < 45 || supply < 35 || mutiny >= 55;
    var commander = rightArmyFirst(a, ['commander','commanderName','general','leader'], '未置统帅');
    var location = rightArmyFirst(a, ['location','garrison','station','theater','region'], '未置驻地');
    var activity = rightArmyFirst(a, ['activity','state','status','currentAction'], '驻防');
    var desc = rightArmyFirst(a, ['description','desc','note','memo','reason'], '暂无军情说明');
    return '<section class="tmrp-card tmrp-army-detail ' + (hot ? 'hot' : 'ok') + '">' +
      '<div class="tmrp-card-title"><span>' + esc(rightArmyName(a)) + '</span><small>' + esc(rightArmyType(a)) + ' · ' + esc(rightArmyFmtNum(soldiers)) + ' 兵</small></div>' +
      '<div class="tmrp-mini-grid">' +
      '<div><span>统帅</span><b>' + esc(commander) + '</b></div>' +
      '<div><span>驻地</span><b>' + esc(location) + '</b></div>' +
      '<div><span>军质</span><b>' + esc(rightArmyFirst(a, ['quality','grade','eliteLevel'], '未录')) + '</b></div>' +
      '<div><span>装备</span><b>' + esc(rightArmyEquipmentText(a)) + '</b></div>' +
      '</div>' +
      rightArmyRows([['当前动态', activity], ['说明', desc], ['所属', rightArmyFaction(a) || '未录'], ['补给/兵变险', Math.round(supply) + ' / ' + Math.round(mutiny)]]) +
      rightArmyBar('士气', morale) + rightArmyBar('训练', training) + rightArmyBar('忠诚', loyalty) + rightArmyBar('控制', control) +
      '<table class="tmrp-data-table"><thead><tr><th>项目</th><th>明细</th></tr></thead><tbody>' +
      '<tr><td>兵种构成</td><td>' + esc(rightArmyCompositionText(a.composition || a.unitsComposition || a.units)) + '</td></tr>' +
      '<tr><td>岁饷</td><td>' + esc(rightArmyMoneyText(a)) + '</td></tr>' +
      '<tr><td>军需</td><td>' + esc(rightArmyFirst(a, ['logistics','supplyState','supplyDepotId'], '未录')) + '</td></tr>' +
      '</tbody></table>' +
      '<div class="tmrp-action-row">' +
      '<button type="button" class="tmrp-btn primary" data-right-action="army-command" data-command="orders" data-id="' + attr(armyKey) + '">查看军令</button>' +
      '<button type="button" class="tmrp-btn" data-right-action="army-command" data-command="pay" data-id="' + attr(armyKey) + '">核饷</button>' +
      '<button type="button" class="tmrp-btn" data-right-action="army-command" data-command="train" data-id="' + attr(armyKey) + '">整训</button>' +
      '<button type="button" class="tmrp-btn" data-right-action="army-command" data-command="redeploy" data-id="' + attr(armyKey) + '">调防</button>' +
      '<button type="button" class="tmrp-btn" data-right-action="army-command" data-command="chaoyi" data-id="' + attr(armyKey) + '">入朝议</button>' +
      '</div>' +
      '</section>';
  }

  function renderArmy(){
    var armies = rightArmyList();
    var total = armies.reduce(function(s, a){ return s + rightArmySoldiers(a); }, 0);
    var avgMorale = armies.length ? Math.round(armies.reduce(function(s, a){ return s + rightArmyPercent(a, ['morale'], 50); }, 0) / armies.length) : 0;
    var avgTraining = armies.length ? Math.round(armies.reduce(function(s, a){ return s + rightArmyPercent(a, ['training'], 50); }, 0) / armies.length) : 0;
    var selected = rightFindArmy(state.selectedArmy) || armies[0] || null;
    if (selected) state.selectedArmy = rightArmyKey(selected, armies.indexOf(selected));
    var groups = [];
    armies.forEach(function(a){
      var t = rightArmyType(a);
      if (groups.indexOf(t) < 0) groups.push(t);
    });
    return '<div class="tmrp-army-shell">' +
      '<div class="tmrp-summary"><div class="tmrp-stat"><b>' + esc(armies.length) + '</b><span>军队</span></div><div class="tmrp-stat"><b>' + esc(rightArmyFmtNum(total)) + '</b><span>总兵力</span></div><div class="tmrp-stat"><b>' + esc(avgMorale + '/' + avgTraining) + '</b><span>士气/训练</span></div></div>' +
      '<section class="tmrp-card"><div class="tmrp-card-title"><span>军务总览</span><small>承接旧军务边防数据，不另造死数据</small></div><div class="tmrp-meta">这里读取正式存档里的 GM.armies / P.armies。点击部队会按预览页方式在左侧展开详情；兵力、统帅、驻地、军质、装备、士气、训练、忠诚、控制、编制和岁饷都来自真实军队对象。</div></section>' +
      '<section class="tmrp-card"><div class="tmrp-card-title"><span>部队名册</span><small>点击左展明细</small></div>' +
      (armies.length ? '<div class="tmrp-scroll compact tmrp-army-list">' + groups.map(function(g){
        var list = armies.filter(function(a){ return rightArmyType(a) === g; });
        var subtotal = list.reduce(function(s, a){ return s + rightArmySoldiers(a); }, 0);
        return '<div class="tmrp-ledger-head"><span>' + esc(g) + '</span><small>' + esc(list.length) + ' 支 · ' + esc(rightArmyFmtNum(subtotal)) + ' 兵</small></div>' +
          list.map(function(a){
            var key = rightArmyKey(a, armies.indexOf(a));
            var active = selected && key === state.selectedArmy;
            var commander = rightArmyFirst(a, ['commander','commanderName','general','leader'], '未置统帅');
            var location = rightArmyFirst(a, ['location','garrison','station','theater','region'], '未置驻地');
            return '<button type="button" class="tmrp-person ' + (active ? 'active' : '') + '" data-right-action="army-select" data-id="' + attr(key) + '">' +
              '<span class="tmrp-avatar">军</span><span><b>' + esc(rightArmyName(a)) + '</b><span>' + esc(commander) + ' · ' + esc(location) + '</span></span><small>' + esc(rightArmyFmtNum(rightArmySoldiers(a))) + '</small></button>';
          }).join('');
      }).join('') + '</div>' : '<div class="tmrp-empty">暂无可读取的军队数据。</div>') +
      '</section>' +
      '</div>';
  }

  function renderMapPanel(){
    var map = getMapData();
    var regions = map && Array.isArray(map.regions) ? map.regions.length : 0;
    var oceans = map && Array.isArray(map.oceans) ? map.oceans.length : 0;
    return '<section class="tmf-card"><div class="tmf-card-title">舆图政区</div>' +
      miniRows([['陆地地块', regions ? regions + ' 块' : '待加载'], ['海域地块', oceans ? oceans + ' 块' : '待加载']]) +
      '<div class="tmf-top-actions">' +
      actionButton('返回舆图', '回到正式主屏地图。', 'TMPhase8FormalBridge.home()', 'main') +
      actionButton('行政区划清册', '在地图中左键地块查看地区档案。', 'TMPhase8FormalBridge.home()') +
      '</div></section>';
  }

  function renderFinance(){
    var g = (window.GM && GM.guoku) || {};
    return '<section class="tmf-card"><div class="tmf-card-title">户部财计</div>' +
      miniRows([
        ['帑银', g.stockMoney || g.money || '—'],
        ['粮', g.stockGrain || g.grain || '—'],
        ['本期入', g.turnIncome || g.monthlyIncome || '—'],
        ['本期出', g.turnExpense || g.monthlyExpense || '—']
      ]) +
      '<div class="tmf-top-actions">' +
      actionButton('帑廪详情', '打开新财计面板。', 'TMPhase8FormalBridge.openGuoku()', 'main') +
      actionButton('奏疏', '转入新奏疏面板查看户部、漕运、铸币奏报。', "TMPhase8FormalBridge.openModule('memorial')") +
      '</div></section>';
  }

  function renderZhi(){
    return '<section class="tmf-card"><div class="tmf-card-title">官制衙门</div><p class="tmf-note">新面板承接官制树、职官任免、荐贤廷推等流程。</p>' +
      actionButton('打开官制', '进入新官制面板。', "TMPhase8FormalBridge.openModule('office')", 'main') +
      '</section>';
  }

  function renderRumor(){
    var list = collectRecentEvents().slice(0, 6);
    return '<section class="tmf-card"><div class="tmf-card-title">风闻情报</div><p class="tmf-note">汇集近事快报、邸报、朝局异动与地方风声，作为右侧国事栏的“闻”印。</p>' +
      list.map(function(item){
        return '<div class="tmrp-card"><div class="tmrp-card-title"><b>' + esc(item.title || '未题') + '</b><span>' + esc(item.type || '近事') + '</span></div><p>' + esc(item.text || item.detail || item.time || '') + '</p></div>';
      }).join('') +
      actionButton('打开史官实录', '查看完整回合档案与纪事。', "TMPhase8FormalBridge.openModule('records')", 'main') +
      '</section>';
  }

  function rightAdminNum(v, fallback){
    if (v && typeof v === 'object') v = v.mouths || v.count || v.value;
    var n = Number(v);
    return isFinite(n) ? n : (fallback == null ? 0 : fallback);
  }

  function rightAdminWan(v){
    var n = rightAdminNum(v, 0);
    if (!n) return '未录';
    return n >= 10000 ? (Math.round(n / 1000) / 10) + '万' : rightArmyFmtNum(n);
  }

  function rightAdminFromDivision(d, faction){
    d = d || {};
    var popObj = (d.population && typeof d.population === 'object') ? d.population : null;
    var detail = d.populationDetail || d.population_detail || {};
    return {
      name: d.name || d.title || d.officialName || d.id || '未名区划',
      level: d.level || d.adminLevel || d.regionType || d.type || '行政区',
      faction: faction || d.dejureOwner || d.owner || d.factionName || d.faction || '',
      governor: d.governor || d.chief || d.holder || d.official || '',
      position: d.officialPosition || d.office || d.position || '',
      pop: (popObj && (popObj.mouths || popObj.population)) || d.population || detail.mouths || d.pop || 0,
      households: (popObj && popObj.households) || d.households || detail.households || 0,
      prosperity: d.prosperity || d.development || d.wealth || 0,
      minxin: d.minxinLocal || d.minxin || d.mood || d.publicOrder || 0,
      corruption: d.corruptionLocal || d.corruption || d.officeRisk || 0,
      terrain: d.terrain || d.geography || '',
      resources: d.specialResources || d.resources || d.resource || '',
      tax: d.taxLevel || d.tax || d.fiscalPolicy || '',
      children: d.children || d.divisions || d.subs || []
    };
  }

  function rightAdminItems(){
    var gm = window.GM || {};
    var p = window.P || {};
    var out = [];
    function addDivision(d, faction){
      if (!d) return;
      out.push(rightAdminFromDivision(d, faction));
    }
    var ah = (gm.adminHierarchy && Object.keys(gm.adminHierarchy).length ? gm.adminHierarchy : p.adminHierarchy) || null;
    if (Array.isArray(ah)) {
      ah.forEach(function(root){ addDivision(root, root && (root.name || root.factionName)); });
    } else if (ah && typeof ah === 'object') {
      Object.keys(ah).forEach(function(k){
        var root = ah[k] || {};
        var list = root.divisions || root.children || root.subs || [];
        if (Array.isArray(list) && list.length) list.forEach(function(d){ addDivision(d, root.name || k); });
        else addDivision(root, root.name || k);
      });
    }
    if (!out.length) {
      var map = getMapData();
      (map && Array.isArray(map.regions) ? map.regions : []).forEach(function(r){
        var admin = r.admin || {};
        addDivision(Object.assign({}, admin, {
          name: r.officialName || r.title || r.name,
          level: admin.level || r.level || r.type,
          factionName: r.factionName || r.owner || ownerName(r),
          resources: admin.specialResources || r.resources,
          terrain: admin.terrain || r.terrain
        }), r.factionName || r.owner || ownerName(r));
      });
    }
    return out.filter(function(x){ return x && x.name; });
  }

  function renderMapPanelRich(){
    var items = rightAdminItems();
    var totalPop = items.reduce(function(s, x){ return s + rightAdminNum(x.pop, 0); }, 0);
    var crisis = items.filter(function(x){ return rightAdminNum(x.minxin, 60) < 45 || rightAdminNum(x.corruption, 0) > 55; });
    var factions = [];
    items.forEach(function(x){ if (x.faction && factions.indexOf(x.faction) < 0) factions.push(x.faction); });
    return '<div class="tmrp-admin-shell">' +
      '<div class="tmrp-summary"><div class="tmrp-stat"><b>' + esc(items.length) + '</b><span>行政区</span></div><div class="tmrp-stat"><b>' + esc(rightAdminWan(totalPop)) + '</b><span>总人口</span></div><div class="tmrp-stat"><b>' + esc(crisis.length) + '</b><span>危机</span></div></div>' +
      '<section class="tmrp-card"><div class="tmrp-card-title"><span>行政区划</span><small>承接地图与行政层级真实数据</small></div>' +
      '<div class="tmrp-chip-list">' + factions.slice(0, 8).map(function(f){ return '<span class="tmrp-pill">' + esc(f) + '</span>'; }).join('') + '</div></section>' +
      (crisis.length ? '<section class="tmrp-card hot"><div class="tmrp-card-title"><span>区划预警</span><small>民心低 / 腐败高</small></div>' + crisis.slice(0, 4).map(function(x){ return '<div class="tmrp-step"><b>' + esc(x.name) + '</b> 民心 ' + esc(Math.round(rightAdminNum(x.minxin, 0))) + ' · 腐败 ' + esc(Math.round(rightAdminNum(x.corruption, 0))) + ' · ' + esc(x.governor || '主官未录') + '</div>'; }).join('') + '</section>' : '') +
      (items.length ? '<div class="tmrp-scroll tall">' + items.map(function(x, i){
        var hot = rightAdminNum(x.minxin, 60) < 45 || rightAdminNum(x.corruption, 0) > 55;
        return '<section class="tmrp-card tmrp-admin-card ' + (hot ? 'hot' : '') + '" style="--admin-c:' + ['#c9a84c','#70b097','#8e6aa8','#c95340','#5e8fb3'][i % 5] + '">' +
          '<div class="tmrp-admin-title"><b>' + esc(x.name) + '</b><small>' + esc(x.level) + '<br>' + esc(x.faction || '未录') + '</small></div>' +
          '<div class="tmrp-mini-grid"><div><span>主官</span><b>' + esc(x.governor || '未置') + '</b></div><div><span>官职</span><b>' + esc(x.position || '未录') + '</b></div><div><span>人口</span><b>' + esc(rightAdminWan(x.pop)) + '</b></div><div><span>户数</span><b>' + esc(rightAdminWan(x.households)) + '</b></div></div>' +
          rightArmyBar('民心', rightAdminNum(x.minxin, 50)) + rightArmyBar('繁荣', rightAdminNum(x.prosperity, 50)) + rightArmyBar('腐败', rightAdminNum(x.corruption, 0)) +
          rightArmyRows([['地形', x.terrain], ['特产', x.resources], ['税负', x.tax], ['下辖', Array.isArray(x.children) ? x.children.length + ' 处' : '未录']]) +
          '<div class="tmrp-action-row"><button type="button" class="tmrp-btn" data-right-action="admin-edict" data-kind="安民" data-name="' + attr(x.name) + '">安民</button><button type="button" class="tmrp-btn" data-right-action="admin-edict" data-kind="巡按" data-name="' + attr(x.name) + '">巡按</button><button type="button" class="tmrp-btn" data-right-action="admin-edict" data-kind="调粮" data-name="' + attr(x.name) + '">调粮</button><button type="button" class="tmrp-btn primary" data-right-action="admin-edict" data-kind="拟诏" data-name="' + attr(x.name) + '">拟诏</button></div>' +
          '</section>';
      }).join('') + '</div>' : '<section class="tmrp-card empty"><div class="tmrp-empty">行政区划数据尚未载入。</div></section>') +
      '</div>';
  }

  function rightFinanceRoot(){
    var gm = window.GM || {};
    var p = window.P || {};
    return {
      guoku: gm.guoku || p.guoku || {},
      neitang: gm.neitang || p.neitang || {},
      fiscal: gm.fiscal || gm.fiscalSystem || gm.fiscalConfig || p.fiscal || p.fiscalSystem || p.fiscalConfig || {}
    };
  }

  function rightFinanceFirst(obj, keys, fallback){
    for (var i = 0; i < keys.length; i += 1) {
      var v = obj && obj[keys[i]];
      if (v != null && v !== '') return v;
    }
    return fallback;
  }

  function rightFinanceMoney(v){
    if (v && typeof v === 'object') v = v.amount || v.value || v.money || v.total;
    var n = Number(v);
    if (!isFinite(n)) return v == null || v === '' ? '未录' : String(v);
    if (Math.abs(n) >= 10000) return (Math.round(n / 1000) / 10) + '万';
    return rightArmyFmtNum(n);
  }

  function rightFinanceCollect(keys){
    var root = rightFinanceRoot();
    var sources = [root.guoku, root.fiscal, root.guoku.fiscal, root.fiscal.config].filter(Boolean);
    var out = [];
    function addList(list, sourceName){
      if (!Array.isArray(list)) return;
      list.forEach(function(x){
        if (!x) return;
        if (typeof x === 'string') out.push({ name: x, amount: '', note: sourceName || '' });
        else out.push({
          name: x.name || x.title || x.type || x.category || sourceName || '项目',
          amount: x.amount || x.value || x.money || x.grain || x.total || x.monthly || x.annual || '',
          note: x.note || x.desc || x.description || x.reason || x.status || ''
        });
      });
    }
    sources.forEach(function(src){
      keys.forEach(function(k){ addList(src && src[k], k); });
    });
    return out;
  }

  function rightFinanceItemList(items, empty){
    if (!items.length) return '<div class="tmrp-empty">' + esc(empty || '暂无明细') + '</div>';
    return items.slice(0, 8).map(function(x){
      return '<div class="tmrp-fin-line"><b>' + esc(x.name || '项目') + '</b><span>' + esc(rightFinanceMoney(x.amount)) + '</span><small>' + esc(compactText(x.note || '', 46)) + '</small></div>';
    }).join('');
  }

  function renderFinanceRich(){
    var root = rightFinanceRoot();
    var g = root.guoku || {};
    var n = root.neitang || {};
    var f = root.fiscal || {};
    var money = rightFinanceFirst(g, ['stockMoney','money','balance','silver','taicangMoney'], 0);
    var grain = rightFinanceFirst(g, ['stockGrain','grain','grainStock','food'], 0);
    var cloth = rightFinanceFirst(g, ['stockCloth','cloth','clothStock'], '');
    var neitang = rightFinanceFirst(n, ['money','balance','silver'], '');
    var income = rightFinanceFirst(g, ['turnIncome','monthlyIncome','income','lastIncome'], rightFinanceFirst(f, ['turnIncome','monthlyIncome','income'], 0));
    var expense = rightFinanceFirst(g, ['turnExpense','monthlyExpense','expense','lastExpense'], rightFinanceFirst(f, ['turnExpense','monthlyExpense','expense'], 0));
    var net = rightAdminNum(income, 0) - rightAdminNum(expense, 0);
    var incomeItems = rightFinanceCollect(['incomeItems','incomes','longTermIncome','recurringIncome','customTaxes','taxes']);
    var expenseItems = rightFinanceCollect(['expenseItems','expenses','longTermExpense','recurringExpense','fixedExpenses','spendingItems']);
    return '<div class="tmrp-finance-shell">' +
      '<div class="tmrp-summary"><div class="tmrp-stat"><b>' + esc(rightFinanceMoney(money)) + '</b><span>太仓银</span></div><div class="tmrp-stat"><b>' + esc(rightFinanceMoney(grain)) + '</b><span>太仓粮</span></div><div class="tmrp-stat"><b>' + esc(rightFinanceMoney(net)) + '</b><span>本期结余</span></div></div>' +
      '<section class="tmrp-card"><div class="tmrp-card-title"><span>库藏</span><small>国库 / 内帑 / 本回合</small></div>' +
      '<div class="tmrp-mini-grid"><div><span>太仓银</span><b>' + esc(rightFinanceMoney(money)) + '</b></div><div><span>太仓粮</span><b>' + esc(rightFinanceMoney(grain)) + '</b></div><div><span>库存布</span><b>' + esc(rightFinanceMoney(cloth)) + '</b></div><div><span>内帑银</span><b>' + esc(rightFinanceMoney(neitang)) + '</b></div></div></section>' +
      '<section class="tmrp-card ' + (net < 0 ? 'hot' : '') + '"><div class="tmrp-card-title"><span>本期收支</span><small>' + esc(getTurnText(window.GM && GM.turn)) + '</small></div>' +
      rightArmyRows([['本期收入', rightFinanceMoney(income)], ['本期支出', rightFinanceMoney(expense)], ['军饷', rightFinanceMoney(rightFinanceFirst(g, ['armyExpense','militaryExpense'], '待核'))], ['宗禄', rightFinanceMoney(rightFinanceFirst(g, ['royalExpense','clanExpense'], '待核'))]]) +
      '<div class="tmrp-action-row"><button type="button" class="tmrp-btn primary" data-right-action="finance-module">帑廪详情</button><button type="button" class="tmrp-btn" data-right-action="finance-old" data-method="extraTax">加派</button><button type="button" class="tmrp-btn" data-right-action="finance-old" data-method="openGranary">开仓</button><button type="button" class="tmrp-btn" data-right-action="finance-old" data-method="loan">借贷</button><button type="button" class="tmrp-btn" data-right-action="finance-old" data-method="advisor">户部参议</button><button type="button" class="tmrp-btn" data-right-action="finance-edict" data-kind="拨内帑">拨内帑</button><button type="button" class="tmrp-btn" data-right-action="finance-edict" data-kind="核饷">核饷</button><button type="button" class="tmrp-btn" data-right-action="finance-edict" data-kind="清查税粮">清查税粮</button></div></section>' +
      '<section class="tmrp-card"><div class="tmrp-card-title"><span>长期收入</span><small>AI 和玩家操作可增删这些项</small></div>' + rightFinanceItemList(incomeItems, '暂无长期收入明细') + '</section>' +
      '<section class="tmrp-card"><div class="tmrp-card-title"><span>长期支出</span><small>军饷、宗禄、工程、赈济等</small></div>' + rightFinanceItemList(expenseItems, '暂无长期支出明细') + '</section>' +
      '</div>';
  }

  function rightWorkGenreLabel(v){
    var map = { poem:'诗', ci:'词', fu:'赋', prose:'散文', essay:'散文', memorial:'奏议', document:'应用文' };
    return map[String(v || '').toLowerCase()] || v || '未分类';
  }

  function rightWorkRiskLabel(v){
    v = String(v || '').toLowerCase();
    if (v === 'high' || v === '高') return '高风险';
    if (v === 'medium' || v === '中') return '中风险';
    if (v === 'low' || v === '低') return '低风险';
    return '未定风险';
  }

  function rightWorks(){
    var gm = window.GM || {};
    var p = window.P || {};
    var works = [];
    function push(w, author, source, sourceIndex){
      if (!w) return;
      var meta = { _source: source || '', _sourceIndex: sourceIndex == null ? -1 : sourceIndex };
      if (typeof w === 'string') {
        works.push(Object.assign({ title: w, author: author || '无名', content: '', quality: 0 }, meta));
      } else {
        works.push(Object.assign({ author: author || w.author || '无名' }, w, meta));
      }
    }
    [
      ['GM.culturalWorks', gm.culturalWorks],
      ['GM.works', gm.works],
      ['GM.wenshiWorks', gm.wenshiWorks],
      ['P.culturalWorks', p.culturalWorks],
      ['P.presetWorks', p.presetWorks],
      ['P.culturalConfig.presetWorks', p.culturalConfig && p.culturalConfig.presetWorks]
    ].forEach(function(pair){
      var source = pair[0];
      var list = Array.isArray(pair[1]) ? pair[1] : [];
      list.forEach(function(w, idx){ push(w, null, source, idx); });
    });
    if (!works.length) {
      getPeople().forEach(function(c){
        ['works','writings','documents','memorials'].forEach(function(k){
          (Array.isArray(c && c[k]) ? c[k] : []).forEach(function(w, idx){ push(w, c.name, 'person.' + (c && c.name || '') + '.' + k, idx); });
        });
      });
    }
    return works;
  }

  function renderWenRich(){
    var works = rightWorks();
    var preserved = works.filter(function(w){ return w.isPreserved || w.preserved || w.status === '传世'; }).length;
    var risky = works.filter(function(w){ return /high|medium|高|中/.test(String(w.politicalRisk || w.risk || '')); }).length;
    return '<div class="tmrp-wenshi-shell">' +
      '<div class="tmrp-summary"><div class="tmrp-stat"><b>' + esc(works.length) + '</b><span>总录</span></div><div class="tmrp-stat"><b>' + esc(preserved) + '</b><span>传世</span></div><div class="tmrp-stat"><b>' + esc(risky) + '</b><span>政险</span></div></div>' +
      '<section class="tmrp-card"><div class="tmrp-card-title"><span>文苑披览</span><small>作品、品评、查禁、入诏</small></div><div class="tmrp-chip-list">' +
      ['全部触发','诗','词','赋','散文','应用文','仅传世','隐藏查禁'].map(function(x){ return '<span class="tmrp-pill">' + esc(x) + '</span>'; }).join('') +
      '</div></section>' +
      (works.length ? '<div class="tmrp-scroll tall">' + works.slice(0, 24).map(function(w, i){
        var title = w.title || w.name || '无题';
        var author = w.author || w.creator || '无名';
        var excerpt = compactText(w.preview || w.content || w.text || w.narrativeContext || w.description || '', 150);
        var hot = /high|高/.test(String(w.politicalRisk || w.risk || '')) || w.isForbidden;
        var ok = w.isPreserved || w.preserved;
        return '<section class="tmrp-card tmrp-work-card ' + (hot ? 'hot' : (ok ? 'ok' : '')) + '">' +
          '<div class="tmrp-work-tab">' + esc(String(author).slice(0, 3)) + '</div><div>' +
          '<div class="tmrp-card-title"><span>' + esc(title) + '</span><small>' + esc(rightWorkGenreLabel(w.genre || w.type)) + ' · ' + esc(w.triggerCategory || w.category || '文苑') + '</small></div>' +
          '<div class="tmrp-meta">' + esc(author) + ' · ' + esc(w.date || ('T' + (w.turn || '?'))) + ' · ' + esc(w.location || '未录') + '</div>' +
          '<div class="tmrp-meta">' + esc(excerpt || '暂无正文') + '</div>' +
          '<div class="tmrp-chip-list"><span class="tmrp-pill">品 ' + esc(Math.round(Number(w.quality) || 0)) + '</span><span class="tmrp-pill">' + esc(rightWorkRiskLabel(w.politicalRisk || w.risk)) + '</span>' + (w.theme ? '<span class="tmrp-pill">' + esc(w.theme) + '</span>' : '') + '</div>' +
          rightArmyRows([['创作背景', w.narrativeContext || w.background], ['政治暗线', w.politicalImplication || w.implication]]) +
          '<div class="tmrp-action-row"><button type="button" class="tmrp-btn" data-right-action="work-detail" data-index="' + attr(i) + '">详情</button><button type="button" class="tmrp-btn" data-right-action="work-action" data-index="' + attr(i) + '" data-work-action="appreciate">赏析</button><button type="button" class="tmrp-btn" data-right-action="work-action" data-index="' + attr(i) + '" data-work-action="inscribe">题序</button><button type="button" class="tmrp-btn" data-right-action="work-action" data-index="' + attr(i) + '" data-work-action="echo">追和</button><button type="button" class="tmrp-btn" data-right-action="work-action" data-index="' + attr(i) + '" data-work-action="circulate">传抄</button>' + (w.isForbidden ? '<button type="button" class="tmrp-btn primary" data-right-action="work-action" data-index="' + attr(i) + '" data-work-action="unban">解禁</button>' : '<button type="button" class="tmrp-btn ' + (hot ? 'primary' : '') + '" data-right-action="work-action" data-index="' + attr(i) + '" data-work-action="ban">查禁</button>') + '</div>' +
          '</div></section>';
      }).join('') + '</div>' : '<section class="tmrp-card empty"><div class="tmrp-empty">暂无文事作品；人物著述或回合文事生成后会显示在这里。</div></section>') +
      '</div>';
  }

  function rightOpenWorkDetail(data){
    var works = rightWorks();
    var w = works[Number(data && data.index)];
    if (!w) return;
    if (w._source === 'GM.culturalWorks' && w._sourceIndex >= 0 && typeof window._showWorkDetail === 'function') {
      window._showWorkDetail(w._sourceIndex);
      return;
    }
    var title = w.title || w.name || '无题';
    var author = w.author || w.creator || '无名';
    var text = w.content || w.text || w.preview || w.narrativeContext || w.description || '暂无正文。';
    if (typeof window.openGenericModal === 'function') {
      window.openGenericModal('文苑详情', '<div style="padding:1rem;line-height:1.85;"><h3 style="margin-top:0;color:var(--gold);">' + esc(title) + '</h3><p style="color:var(--txt-s);">作者：' + esc(author) + '</p><div style="white-space:pre-wrap;">' + esc(text) + '</div></div>', null);
    } else {
      toast(title + ' · ' + compactText(text, 36));
    }
  }

  function rightHandleWorkAction(data){
    var works = rightWorks();
    var w = works[Number(data && data.index)];
    if (!w) return;
    var wa = (data && data.workAction) || 'appreciate';
    if (w._source === 'GM.culturalWorks' && w._sourceIndex >= 0 && typeof window._workAction === 'function') {
      window._workAction(w._sourceIndex, wa);
      return;
    }
    var labels = { appreciate:'赐阅赏析', inscribe:'御题赐序', echo:'追和', circulate:'传抄', ban:'查禁', unban:'解禁' };
    rightAddEdictSuggestion('文事艺府', w.author || '文苑', labels[wa] || wa, (labels[wa] || wa) + '《' + (w.title || w.name || '无题') + '》');
    toast('已纳入诏书建议库：' + (labels[wa] || wa));
  }

  function rightOpenGuokuLegacyAction(method){
    var map = {
      extraTax: '_guoku_extraTax',
      openGranary: '_guoku_openGranary',
      loan: '_guoku_takeLoan',
      loans: '_guoku_showLoans',
      advisor: '_guoku_fiscalAdvisor',
      caoyun: '_guoku_caoyunWarning',
      taxAdvisor: '_guoku_taxAdvisor'
    };
    openGuoku();
    var fnName = map[method || ''];
    if (!fnName) return;
    setTimeout(function(){
      var fn = window[fnName];
      if (typeof fn === 'function') fn();
      else toast('国库旧动作尚未载入：' + method);
    }, 80);
  }

  function rightSocNum(x, keys, fallback){
    return rightIssueNum(x, keys, fallback == null ? 50 : fallback);
  }

  function renderGangRich(){
    var tab = state.rightOutlineTab || 'classes';
    return '<div class="tmrp-outline-shell">' +
      '<div class="tmrp-tabs"><button type="button" class="' + (tab === 'classes' ? 'active' : '') + '" data-right-action="outline-tab" data-tab="classes">阶层</button><button type="button" class="' + (tab === 'parties' ? 'active' : '') + '" data-right-action="outline-tab" data-tab="parties">党派</button></div>' +
      (tab === 'parties' ? renderRightPartyPanel() : renderRightClassPanel()) +
      '</div>';
  }

  function renderRightClassPanel(){
    var rows = getClasses();
    var avg = rows.length ? Math.round(rows.reduce(function(s, c){ return s + rightSocNum(c, ['satisfaction','support','mood','loyalty'], 50); }, 0) / rows.length) : 0;
    var maxInf = rows.reduce(function(m, c){ return Math.max(m, rightSocNum(c, ['influence','power','weight'], 0)); }, 0);
    return '<div class="tmrp-summary"><div class="tmrp-stat"><b>' + esc(rows.length) + '</b><span>阶层</span></div><div class="tmrp-stat"><b>' + esc(avg) + '</b><span>平均满意</span></div><div class="tmrp-stat"><b>' + esc(maxInf) + '</b><span>最高影响</span></div></div>' +
      (rows.length ? '<div class="tmrp-scroll tall">' + rows.map(function(c){
        var sat = rightSocNum(c, ['satisfaction','support','mood','loyalty'], 50);
        var inf = rightSocNum(c, ['influence','power','weight'], 0);
        return '<section class="tmrp-card ' + (sat < 45 ? 'hot' : (sat > 62 ? 'ok' : '')) + '"><div class="tmrp-card-title"><span>' + esc(c.name || c.label || c.id || '未名阶层') + '</span><small>满意 ' + esc(Math.round(sat)) + ' · 影响 ' + esc(Math.round(inf)) + '</small></div>' +
          rightArmyBar('满意', sat) + rightArmyBar('影响', inf) +
          rightArmyRows([['规模', c.size || c.population || c.scale], ['经济角色', c.economicRole || c.role], ['法律地位', c.status], ['流动性', c.mobility], ['特权', c.privileges], ['义务', c.obligations], ['诉求', c.demands || c.currentDemand]]) +
          '<div class="tmrp-meta">' + esc(c.description || c.desc || '') + '</div></section>';
      }).join('') + '</div>' : '<section class="tmrp-card empty"><div class="tmrp-empty">暂无阶层数据。</div></section>');
  }

  function renderRightPartyPanel(){
    var rows = getParties();
    var active = rows.filter(function(p){ return /活跃|active/i.test(String(p.status || p.state || '')); }).length;
    var maxInf = rows.reduce(function(m, p){ return Math.max(m, rightSocNum(p, ['influence','power','weight'], 0)); }, 0);
    return '<div class="tmrp-summary"><div class="tmrp-stat"><b>' + esc(rows.length) + '</b><span>党派</span></div><div class="tmrp-stat"><b>' + esc(active) + '</b><span>活跃</span></div><div class="tmrp-stat"><b>' + esc(maxInf) + '</b><span>最高影响</span></div></div>' +
      (rows.length ? '<div class="tmrp-scroll tall">' + rows.map(function(p){
        var inf = rightSocNum(p, ['influence','power','weight'], 0);
        var status = p.status || p.state || '未录';
        var stance = p.policyStance || p.stances || p.agenda;
        var stanceHtml = (Array.isArray(stance) ? stance : [stance]).filter(Boolean).map(function(x){ return '<span class="tmrp-pill">' + esc(x) + '</span>'; }).join('');
        return '<section class="tmrp-card ' + (/活跃|active/i.test(String(status)) ? 'hot' : '') + '"><div class="tmrp-card-title"><span>' + esc(p.name || p.label || p.id || '未名党派') + '</span><small>' + esc(status) + ' · 影响 ' + esc(Math.round(inf)) + '</small></div>' +
          rightArmyBar('影响', inf) +
          rightArmyRows([['首领', p.leader || p.head], ['立场', p.ideology || p.stance], ['支持群体', p.base || p.supportBase], ['核心成员', p.members], ['当前议程', p.currentAgenda || p.agenda], ['短期目标', p.shortGoal], ['长期追求', p.longGoal]]) +
          '<div class="tmrp-chip-list">' + stanceHtml + '</div></section>';
      }).join('') + '</div>' : '<section class="tmrp-card empty"><div class="tmrp-empty">暂无党派数据。</div></section>');
  }

  function renderPinnedPeopleRich(){
    var ids = state.pinnedPeople || [];
    var people = ids.map(findPerson).filter(Boolean);
    var atCourt = people.filter(rightIssueAtCourt).length;
    var lowLoyal = people.filter(function(p){ return rightIssueNum(p, ['loyalty','loyal'], 50) < 45; }).length;
    if (!people.length) {
      return '<div class="tmrp-minister-shell"><div class="tmrp-summary"><div class="tmrp-stat"><b>0</b><span>钉选</span></div><div class="tmrp-stat"><b>0</b><span>在京</span></div><div class="tmrp-stat"><b>0</b><span>风险</span></div></div>' +
        '<section class="tmrp-card empty"><div class="tmrp-card-title"><span>百官人事</span><small>钉选后在此集中处置</small></div><div class="tmrp-empty">暂无钉选臣僚。可从人物图志或人物卡片钉选。</div>' +
        '<div class="tmrp-action-row"><button type="button" class="tmrp-btn primary" onclick="TMPhase8FormalBridge.openRenwu()">打开人物图志</button></div></section></div>';
    }
    return '<div class="tmrp-minister-shell"><div class="tmrp-summary"><div class="tmrp-stat"><b>' + esc(people.length) + '</b><span>钉选</span></div><div class="tmrp-stat"><b>' + esc(atCourt) + '</b><span>在京</span></div><div class="tmrp-stat"><b>' + esc(lowLoyal) + '</b><span>低忠</span></div></div>' +
      '<div class="tmrp-scroll tall">' + people.map(function(p){
        var key = personKey(p);
        return '<section class="tmrp-card tmrp-minister-card"><div class="tmrp-minister-face">' + rightIssuePortrait(p) + '</div><div class="tmrp-minister-main">' +
          '<div class="tmrp-card-title"><span>' + esc(p.name || key) + '</span><small>' + esc(p.title || p.office || p.role || p.faction || '未仕') + '</small></div>' +
          '<div class="tmrp-mini-grid"><div><span>忠</span><b>' + esc(p.loyalty || p.loyal || '未录') + '</b></div><div><span>智</span><b>' + esc(p.intelligence || p.wisdom || '未录') + '</b></div><div><span>政</span><b>' + esc(p.administration || p.politics || '未录') + '</b></div><div><span>军</span><b>' + esc(p.military || '未录') + '</b></div></div>' +
          '<div class="tmrp-action-row"><button type="button" class="tmrp-btn primary" onclick="TMPhase8FormalBridge.personAction(\'' + attr(key) + '\',\'detail\')">详阅</button><button type="button" class="tmrp-btn" onclick="TMPhase8FormalBridge.personAction(\'' + attr(key) + '\',\'wendui\')">问对</button><button type="button" class="tmrp-btn" onclick="TMPhase8FormalBridge.personAction(\'' + attr(key) + '\',\'letter\')">传书</button><button type="button" class="tmrp-btn" onclick="TMPhase8FormalBridge.personAction(\'' + attr(key) + '\',\'office\')">官制</button><button type="button" class="tmrp-btn" onclick="TMPhase8FormalBridge.unpin(\'' + attr(key) + '\')">移除</button></div>' +
          '</div></section>';
      }).join('') + '</div></div>';
  }

  function renderRumorRich(){
    var list = collectRecentEvents().slice(0, 12);
    var hot = list.filter(function(item){ return /危|乱|叛|灾|兵|饷|腐|急|警|hot|warn/i.test(String(item.type || '') + String(item.title || '') + String(item.text || '')); }).length;
    return '<div class="tmrp-rumor-shell">' +
      '<div class="tmrp-summary"><div class="tmrp-stat"><b>' + esc(list.length) + '</b><span>风闻</span></div><div class="tmrp-stat"><b>' + esc(hot) + '</b><span>待察</span></div><div class="tmrp-stat"><b>' + esc(state.eventLookback || 3) + '</b><span>回合</span></div></div>' +
      '<section class="tmrp-card"><div class="tmrp-card-title"><span>风闻情报</span><small>近事、邸报、人物与势力活动摘要</small></div><div class="tmrp-meta">这里读取事件栏同源数据，不另造静态传闻。可继续转入史官实录查看完整档案。</div></section>' +
      (list.length ? '<div class="tmrp-scroll tall">' + list.map(function(item){
        var cls = /危|乱|叛|灾|兵|饷|腐|急|警|hot|warn/i.test(String(item.type || '') + String(item.title || '') + String(item.text || '')) ? 'hot' : '';
        return '<section class="tmrp-card ' + cls + '"><div class="tmrp-card-title"><span>' + esc(item.title || '未题') + '</span><small>' + esc(item.type || '近事') + ' · T' + esc(item.turn || '') + '</small></div><div class="tmrp-meta">' + esc(item.text || item.detail || item.time || '') + '</div></section>';
      }).join('') + '</div>' : '<section class="tmrp-card empty"><div class="tmrp-empty">暂无可读取风闻。</div></section>') +
      '<section class="tmrp-card"><div class="tmrp-action-row"><button type="button" class="tmrp-btn primary" data-right-action="rumor-records">打开史官实录</button></div></section>' +
      '</div>';
  }

  function rightOfficeTree(){
    var gm = window.GM || {};
    var p = window.P || {};
    if (Array.isArray(gm.officeTree) && gm.officeTree.length) return gm.officeTree;
    if (Array.isArray(p.officeTree) && p.officeTree.length) return p.officeTree;
    if (p.government && Array.isArray(p.government.nodes) && p.government.nodes.length) return p.government.nodes;
    if (p.government && p.government.officeTree) {
      if (Array.isArray(p.government.officeTree)) return p.government.officeTree;
      if (p.government.officeTree.nodes && Array.isArray(p.government.officeTree.nodes)) return p.government.officeTree.nodes;
    }
    return [];
  }

  function rightOfficeChildren(n){
    return (n && (n.subs || n.children || n.departments || n.nodes)) || [];
  }

  function rightOfficeHolderText(p){
    if (!p) return '空缺';
    if (p.holder) return p.holder;
    if (Array.isArray(p.actualHolders)) {
      var names = p.actualHolders.map(function(h){ return h && (h.name || h.holder || h.character); }).filter(Boolean);
      if (names.length) return names.join('、');
    }
    if (Array.isArray(p.holders)) return p.holders.filter(Boolean).join('、') || '空缺';
    return '空缺';
  }

  function rightOfficeStats(nodes){
    var r = { depts: 0, pos: 0, filled: 0, vacant: 0 };
    function walk(list){
      (Array.isArray(list) ? list : []).forEach(function(n){
        if (!n) return;
        r.depts += 1;
        (Array.isArray(n.positions) ? n.positions : []).forEach(function(p){
          r.pos += 1;
          var holders = rightOfficeHolderText(p);
          if (holders && holders !== '空缺') r.filled += 1;
          else r.vacant += 1;
        });
        walk(rightOfficeChildren(n));
      });
    }
    walk(nodes);
    return r;
  }

  function rightOfficeTreasuryText(t){
    if (!t || typeof t !== 'object') return '';
    var parts = [];
    if (t.money != null) parts.push('银 ' + rightArmyFmtNum(t.money));
    if (t.grain != null) parts.push('粮 ' + rightArmyFmtNum(t.grain));
    if (t.cloth != null) parts.push('布 ' + rightArmyFmtNum(t.cloth));
    return parts.join(' / ');
  }

  function renderRightOfficeNode(n, depth){
    if (!n) return '';
    depth = depth || 0;
    var positions = Array.isArray(n.positions) ? n.positions : [];
    var children = rightOfficeChildren(n);
    var funcs = Array.isArray(n.functions) ? n.functions : [];
    return '<details class="tmrp-office-node" ' + (depth < 2 ? 'open' : '') + '>' +
      '<summary>' + esc(n.name || n.title || '未名衙门') + '<small>职位 ' + esc(positions.length) + ' · 下辖 ' + esc(children.length) + '</small></summary>' +
      (n.desc || n.description ? '<div class="tmrp-meta">' + esc(n.desc || n.description) + '</div>' : '') +
      (funcs.length ? '<div class="tmrp-chip-list">' + funcs.slice(0, 6).map(function(f){ return '<span class="tmrp-pill">' + esc(f) + '</span>'; }).join('') + '</div>' : '') +
      positions.map(function(p){
        var treasury = rightOfficeTreasuryText(p.publicTreasuryInit || p.publicTreasury || p.treasury);
        return '<div class="tmrp-office-pos"><b>' + esc(p.name || p.title || '未名官') + '</b>' +
          '<span class="tmrp-pill">' + esc(p.rank || p.grade || '未定品') + '</span>' +
          '<span class="tmrp-pill">' + esc(rightOfficeHolderText(p)) + '</span>' +
          '<div class="tmrp-meta">' + esc(p.duties || p.desc || p.description || '职责未录') + '</div>' +
          rightArmyRows([['继任', p.succession || p.appointment || '未录'], ['权限', p.authority || p.power || '未录'], ['公库', treasury || '未录']]) +
          '</div>';
      }).join('') +
      children.map(function(c){ return renderRightOfficeNode(c, depth + 1); }).join('') +
      '</details>';
  }

  function renderZhiRich(){
    var tree = rightOfficeTree();
    var s = rightOfficeStats(tree);
    return '<div class="tmrp-office-shell">' +
      '<div class="tmrp-summary"><div class="tmrp-stat"><b>' + esc(s.depts) + '</b><span>衙门</span></div><div class="tmrp-stat"><b>' + esc(s.filled + '/' + s.pos) + '</b><span>在任/职位</span></div><div class="tmrp-stat"><b>' + esc(s.vacant) + '</b><span>空缺</span></div></div>' +
      '<section class="tmrp-card"><div class="tmrp-card-title"><span>官制总览</span><small>衙门、层级、职位、任职、权限、公库</small></div>' +
      '<div class="tmrp-action-row"><button type="button" class="tmrp-btn primary" data-right-action="office-standalone">进入官制衙门</button><button type="button" class="tmrp-btn" data-right-action="office-people">荐贤廷推</button><button type="button" class="tmrp-btn" data-right-action="office-edict">拟任免诏</button></div></section>' +
      (tree.length ? '<div class="tmrp-scroll tall tmrp-office-tree">' + tree.map(function(n){ return renderRightOfficeNode(n, 0); }).join('') + '</div>' : '<section class="tmrp-card empty"><div class="tmrp-empty">当前剧本尚未载入官制树。</div></section>') +
      '</div>';
  }

  var renderers = {
    ol: renderGangRich,
    issue: renderZheng,
    policy: renderWenRich,
    office: renderPinnedPeopleRich,
    army: renderArmy,
    map: renderMapPanelRich,
    finance: renderFinanceRich,
    rumor: renderRumorRich,
    archive: renderZhiRich
  };

  var titles = {
    ol: '纲纪总览',
    issue: '政务问对',
    policy: '文事科举',
    office: '钉选臣僚',
    army: '军务边防',
    map: '舆图政区',
    finance: '户部财计',
    rumor: '风闻情报',
    archive: '官制衙门'
  };

  function rightPanelInput(id){
    var el = document.getElementById(id);
    return el ? String(el.value || '').trim() : '';
  }

  function rightChaoyiModeLabel(mode){
    return mode === 'changchao' ? '常朝' : (mode === 'yuqian' ? '御前会议' : '廷议');
  }

  function rightSelectedPersonFromData(data){
    var p = findPerson(data && data.id);
    if (!p) p = rightSelectedWenduiPerson();
    return p;
  }

  function rightAppendWenduiHistory(name, text, role){
    if (!name || !window.GM) return;
    if (!GM.wenduiHistory) GM.wenduiHistory = {};
    if (!Array.isArray(GM.wenduiHistory[name])) GM.wenduiHistory[name] = [];
    GM.wenduiHistory[name].push({
      role: role || 'system',
      content: text,
      turn: GM.turn || 1,
      source: 'phase8-right-issue'
    });
  }

  function rightWenduiCeremonyLabel(kind){
    return {
      seat:'赐座', stand:'不赐座', tea:'赐茶', wine:'赐酒',
      confront:'召人对质', suggest:'摘入建议库', reward:'赏', punish:'罚'
    }[kind] || '问对动作';
  }

  function rightAddEdictSuggestion(source, from, topic, content){
    if (!content || !window.GM) return false;
    if (!GM._edictSuggestions) GM._edictSuggestions = [];
    GM._edictSuggestions.push({
      source: source || '问对',
      from: from || '御前',
      topic: topic || '',
      content: content,
      turn: GM.turn || 1,
      used: false
    });
    try { if (typeof window._renderEdictSuggestions === 'function') window._renderEdictSuggestions(); } catch(_) {}
    return true;
  }

  function rightOpenWendui(data){
    var p = rightSelectedPersonFromData(data || {});
    if (!p) { toast('暂无可问对人物'); return; }
    if (!rightIssueAtCourt(p)) { rightOpenLetter(data); return; }
    var name = p.name || personKey(p);
    var mode = state.rightWenduiMode || 'formal';
    var prefill = rightPanelInput('tmrp-wendui-input');
    if (window.GM) {
      GM.wenduiTarget = name;
      GM._pendingWenduiChar = name;
    }
    closeDeskOverlay();
    closeModule();
    closeRightDrawer();
    if (typeof window.openWenduiModal === 'function') {
      window.openWenduiModal(name, mode, prefill);
    } else if (typeof window.openWenduiPick === 'function') {
      window.openWenduiPick(name);
    } else {
      state.modulePerson = personKey(p);
      openModule('wendui');
    }
    returnFormalHomeSoon();
  }

  function rightOpenWenduiPick(data){
    var p = rightSelectedPersonFromData(data || {});
    if (!p) { toast('暂无可问对人物'); return; }
    if (!rightIssueAtCourt(p)) { rightOpenLetter(data); return; }
    var name = p.name || personKey(p);
    if (window.GM) {
      GM.wenduiTarget = name;
      GM._pendingWenduiChar = name;
    }
    closeDeskOverlay();
    closeModule();
    closeRightDrawer();
    if (typeof window.openWenduiPick === 'function') {
      window.openWenduiPick(name);
    } else if (typeof openWenduiPick === 'function') {
      openWenduiPick(name);
    } else if (typeof window.openWenduiModal === 'function') {
      window.openWenduiModal(name, 'formal');
    } else {
      state.modulePerson = personKey(p);
      openModule('wendui');
    }
    returnFormalHomeSoon();
  }

  function rightOpenWenduiAudience(data){
    var p = rightSelectedPersonFromData(data || {});
    if (!p) { toast('暂无求见人物'); return; }
    var name = p.name || personKey(p);
    closeDeskOverlay();
    closeModule();
    closeRightDrawer();
    if (typeof window._wdOpenAudience === 'function') {
      window._wdOpenAudience(name);
    } else if (typeof _wdOpenAudience === 'function') {
      _wdOpenAudience(name);
    } else if (typeof window.openWenduiModal === 'function') {
      window.openWenduiModal(name, 'formal');
    } else {
      toast('问对流程未加载');
    }
    returnFormalHomeSoon();
  }

  function rightOpenWenduiQueue(data){
    var idx = Number(data && data.index);
    if (!Number.isFinite(idx)) return;
    closeDeskOverlay();
    closeModule();
    closeRightDrawer();
    if (typeof window._wdOpenAudienceQueue === 'function') {
      window._wdOpenAudienceQueue(idx);
    } else if (typeof _wdOpenAudienceQueue === 'function') {
      _wdOpenAudienceQueue(idx);
    } else {
      toast('待见流程未加载');
    }
    returnFormalHomeSoon();
  }

  function rightDismissWenduiQueue(data){
    var idx = Number(data && data.index);
    if (!Number.isFinite(idx) || !window.GM) return;
    if (typeof window._wdDismissPending === 'function') {
      window._wdDismissPending(idx);
    } else if (typeof _wdDismissPending === 'function') {
      _wdDismissPending(idx);
    } else if (Array.isArray(GM._pendingAudiences) && GM._pendingAudiences[idx]) {
      GM._pendingAudiences.splice(idx, 1);
      toast('已暂却待见');
    }
    openPanel('issue');
  }

  function rightDenyWenduiAudience(data){
    var p = rightSelectedPersonFromData(data || {});
    if (!p) return;
    var name = p.name || personKey(p);
    if (typeof window._wdDenyAudience === 'function') {
      window._wdDenyAudience(name);
    } else if (typeof _wdDenyAudience === 'function') {
      _wdDenyAudience(name);
    } else {
      if (window.NpcMemorySystem && typeof NpcMemorySystem.remember === 'function') {
        NpcMemorySystem.remember(name, '求见皇帝被拒于殿外', '忧', 4, '天子');
      }
      toast(name + '的求见被拒');
    }
    openPanel('issue');
  }

  function rightOpenLetter(data){
    var p = rightSelectedPersonFromData(data || {});
    if (!p) { toast('暂无传书对象'); return; }
    var name = p.name || personKey(p);
    if (window.GM) GM._pendingLetterTo = name;
    state.letterTarget = name;
    closeDeskOverlay();
    closeModule();
    closeRightDrawer();
    if (typeof openHongyanPreviewPanel === 'function') openHongyanPreviewPanel();
    else openModule('letter');
  }

  function rightRecordChaoyi(kind, decision, text){
    var gm = window.GM || {};
    if (!gm.recentChaoyi) gm.recentChaoyi = [];
    var topic = rightPanelInput('tmrp-chaoyi-topic') || state.rightChaoyiTopic || '未题';
    var mode = state.rightChaoyiMode || 'changchao';
    var date = (typeof window.getTSText === 'function') ? window.getTSText(gm.turn || 1) : ('第 ' + (gm.turn || 1) + ' 回合');
    var row = {
      turn: gm.turn || 1,
      date: date,
      kind: kind || rightChaoyiModeLabel(mode),
      mode: mode,
      topic: topic,
      decision: decision || '',
      line: text || '',
      source: 'phase8-right-issue'
    };
    gm.recentChaoyi.unshift(row);
    if (typeof window.addEB === 'function') {
      try { window.addEB('朝议', rightChaoyiModeLabel(mode) + '·' + topic + (decision ? '·' + decision : '')); } catch(_) {}
    }
    return row;
  }

  function rightOpenChaoyi(){
    var gm = window.GM || {};
    var mode = state.rightChaoyiMode || 'changchao';
    var topic = rightPanelInput('tmrp-chaoyi-topic') || state.rightChaoyiTopic || '';
    var line = rightPanelInput('tmrp-chaoyi-line');
    gm._phase8ChaoyiPrefill = { mode:mode, topic:topic, line:line, turn:gm.turn || 1 };
    if (topic) gm._pendingChaoyiTopic = topic;
    closeDeskOverlay();
    closeModule();
    closeRightDrawer();
    if (typeof window.openChaoyi === 'function') {
      var old = document.getElementById('chaoyi-modal');
      if (old) old.remove();
      window.openChaoyi();
      if (!document.getElementById('chaoyi-modal')) return;
      try {
        var pick = window._cy_pickMode;
        if (typeof pick !== 'function' && typeof _cy_pickMode === 'function') pick = _cy_pickMode;
        if (typeof pick === 'function') {
          pick(mode);
          rightApplyChaoyiPrefill(mode, topic, line);
        } else {
          var modal = document.getElementById('chaoyi-modal');
          if (modal) modal.remove();
          toast('朝议流程未加载');
        }
      } catch(e) {
        try { window.TM && TM.errors && TM.errors.captureSilent(e, 'phase8-right-chaoyi-open'); } catch(_) {}
      }
      return;
    }
    openModule('chaoyi', { mode: mode === 'changchao' ? 'routine' : mode });
  }

  function rightApplyChaoyiPrefill(mode, topic, line){
    var inp = document.getElementById('cy-player-input');
    if (inp && line) inp.value = line;
    if (!topic) return;
    var topicInput = null;
    if (mode === 'tinyi') topicInput = document.getElementById('ty2-topic');
    else if (mode === 'yuqian') topicInput = document.getElementById('yq2-topic');
    if (topicInput && !topicInput.value) topicInput.value = topic;
  }

  function rightCloseArmyFlyout(){
    var old = document.getElementById('tm-army-detail-flyout');
    if (old) old.remove();
  }

  function rightOpenArmyFlyout(key){
    var army = rightFindArmy(key) || rightArmyList()[0];
    if (!army) { toast('暂无可查看部队'); return; }
    state.selectedArmy = rightArmyKey(army, rightArmyList().indexOf(army));
    rightCloseArmyFlyout();
    var fly = document.createElement('aside');
    fly.id = 'tm-army-detail-flyout';
    fly.className = 'tm-army-detail-flyout';
    fly.innerHTML = '<div class="tm-army-detail-head"><b>部队详情</b><button type="button" data-army-close="1">×</button></div>' + renderRightArmyDetailCard(army);
    fly.addEventListener('click', function(e){
      var close = e.target && e.target.closest ? e.target.closest('[data-army-close]') : null;
      if (close) {
        e.preventDefault();
        rightCloseArmyFlyout();
        return;
      }
      var btn = e.target && e.target.closest ? e.target.closest('[data-right-action]') : null;
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      handleRightPanelAction(btn.dataset.rightAction, btn.dataset);
    });
    document.body.appendChild(fly);
  }

  function rightSelectArmy(data){
    var key = data && data.id;
    var army = rightFindArmy(key);
    if (!army) { toast('未找到该部队'); return; }
    state.selectedArmy = rightArmyKey(army, rightArmyList().indexOf(army));
    openPanel('army');
    rightOpenArmyFlyout(state.selectedArmy);
  }

  function rightArmyCommand(data){
    var army = rightFindArmy(data && data.id) || rightFindArmy(state.selectedArmy);
    if (!army) { toast('暂无可处置部队'); return; }
    var name = rightArmyName(army);
    var cmd = data && data.command;
    if (cmd === 'orders') {
      rightOpenArmyFlyout(rightArmyKey(army, rightArmyList().indexOf(army)));
      toast('已展开 ' + name + ' 军令详情');
    } else if (cmd === 'pay') {
      state.selectedArmy = rightArmyKey(army, rightArmyList().indexOf(army));
      openPanel('finance');
      toast('已转入户部财计，可核查 ' + name + ' 岁饷');
    } else if (cmd === 'train') {
      rightAddEdictSuggestion('军务边防', name, '整训军队', '命 ' + name + ' 整饬营伍、核实兵额、补足器械，并回奏训练成效。');
      toast('已纳入诏书建议库：整训 ' + name);
    } else if (cmd === 'redeploy') {
      rightAddEdictSuggestion('军务边防', name, '调防军队', '议定 ' + name + ' 调防路线、粮饷供给与接防期限，不得擅离驻地。');
      toast('已纳入诏书建议库：调防 ' + name);
    } else if (cmd === 'chaoyi') {
      state.rightIssueTab = 'chaoyi';
      state.rightChaoyiMode = 'tinyi';
      state.rightChaoyiTopic = name + ' 军务处置';
      openPanel('issue');
    }
  }

  function handleRightPanelAction(action, data){
    data = data || {};
    if (action === 'issue-tab') {
      state.rightIssueTab = data.tab || 'wendui';
      openPanel('issue');
    } else if (action === 'outline-tab') {
      state.rightOutlineTab = data.tab || 'classes';
      openPanel('ol');
    } else if (action === 'wendui-select') {
      state.rightWenduiPerson = data.id || '';
      openPanel('issue');
    } else if (action === 'wendui-mode') {
      state.rightWenduiMode = data.mode || 'formal';
      openPanel('issue');
    } else if (action === 'wendui-pick') {
      rightOpenWenduiPick(data);
    } else if (action === 'wendui-audience') {
      rightOpenWenduiAudience(data);
    } else if (action === 'wendui-queue') {
      rightOpenWenduiQueue(data);
    } else if (action === 'wendui-dismiss') {
      rightDismissWenduiQueue(data);
    } else if (action === 'wendui-deny') {
      rightDenyWenduiAudience(data);
    } else if (action === 'wendui-open') {
      rightOpenWendui(data);
    } else if (action === 'wendui-letter') {
      rightOpenLetter(data);
    } else if (action === 'wendui-note') {
      var p = rightSelectedPersonFromData(data);
      if (!p) return;
      var name = p.name || personKey(p);
      var text = rightPanelInput('tmrp-wendui-input') || ('【' + (state.rightWenduiMode === 'private' ? '私下叙谈' : '朝堂问对') + '】皇帝召问' + name + '，记其待对。');
      rightAppendWenduiHistory(name, text, 'system');
      toast('已记入问对记录');
      openPanel('issue');
    } else if (action === 'wendui-ceremony') {
      var cp = rightSelectedPersonFromData(data);
      if (!cp) return;
      var cname = cp.name || personKey(cp);
      var kind = data.kind || '';
      if (kind === 'suggest') {
        var sug = rightPanelInput('tmrp-wendui-input') || rightIssueTopic(cp);
        rightAddEdictSuggestion('问对', cname, '御前问对', sug);
        toast('已摘入诏书建议库');
      } else {
        var label = rightWenduiCeremonyLabel(kind);
        rightAppendWenduiHistory(cname, '【' + label + '】皇帝于问对中对' + cname + '行此处置。', 'system');
        toast('已记录问对动作：' + label);
      }
      openPanel('issue');
    } else if (action === 'chaoyi-mode') {
      state.rightChaoyiMode = data.mode || 'changchao';
      openPanel('issue');
    } else if (action === 'chaoyi-launch') {
      state.rightChaoyiMode = data.mode || state.rightChaoyiMode || 'changchao';
      rightOpenChaoyi();
    } else if (action === 'chaoyi-topic') {
      state.rightChaoyiTopic = data.topic || '';
      openPanel('issue');
    } else if (action === 'chaoyi-start') {
      rightOpenChaoyi();
    } else if (action === 'chaoyi-record') {
      var line = rightPanelInput('tmrp-chaoyi-line');
      var r = rightRecordChaoyi(rightChaoyiModeLabel(state.rightChaoyiMode || 'changchao'), '记起居注', line);
      if (window.GM) {
        if (!Array.isArray(GM.qijuHistory)) GM.qijuHistory = [];
        GM.qijuHistory.unshift({
          turn: GM.turn || 1,
          date: r.date,
          content: '【' + r.kind + '】议「' + r.topic + '」' + (line ? '。上谕：' + line : '。')
        });
      }
      toast('已记入起居注');
      openPanel('issue');
    } else if (action === 'chaoyi-norecord') {
      if (window.GM) GM._phase8ChaoyiNoRecord = true;
      toast('已标记本次御前议事不主动入录');
    } else if (action === 'chaoyi-quick') {
      var decision = data.decision || '已议';
      rightRecordChaoyi(rightChaoyiModeLabel(state.rightChaoyiMode || 'changchao'), decision, rightPanelInput('tmrp-chaoyi-line'));
      toast('已记录朝议预案：' + decision);
      openPanel('issue');
    } else if (action === 'army-select') {
      rightSelectArmy(data);
    } else if (action === 'army-command') {
      rightArmyCommand(data);
    } else if (action === 'office-people') {
      openPanel('office');
    } else if (action === 'office-standalone') {
      openOfficeStandalone();
    } else if (action === 'office-edict') {
      rightAddEdictSuggestion('官制衙门', '吏部', '官职任免', '请据官制空缺、臣工资望与朝议形势，拟定任免官员诏令。');
      toast('已纳入诏书建议库：官职任免');
    } else if (action === 'office-refresh') {
      openOfficeStandalone();
    } else if (action === 'admin-edict') {
      var area = data.name || '地方';
      var kind = data.kind || '处置';
      rightAddEdictSuggestion('行政区划', area, kind, '命有司就' + area + '办理' + kind + '，核实主官、钱粮、民心与地方积弊，限期回奏。');
      toast('已纳入诏书建议库：' + area + '·' + kind);
    } else if (action === 'finance-module') {
      openGuoku();
    } else if (action === 'finance-old') {
      rightOpenGuokuLegacyAction(data.method);
    } else if (action === 'finance-edict') {
      var fk = data.kind || '财计处置';
      rightAddEdictSuggestion('户部财计', '户部', fk, '命户部就' + fk + '核算太仓、内帑、收支、军饷与长期财源，列明可行方案。');
      toast('已纳入诏书建议库：' + fk);
    } else if (action === 'work-action') {
      rightHandleWorkAction(data);
    } else if (action === 'work-detail') {
      rightOpenWorkDetail(data);
    } else if (action === 'rumor-records') {
      openShiluPreviewPanel();
    }
  }

  function bindRightPanelActions(host){
    if (!host || host.__phase8RightPanelActions) return;
    host.__phase8RightPanelActions = true;
    host.addEventListener('click', function(e){
      var btn = e.target && e.target.closest ? e.target.closest('[data-right-action]') : null;
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      handleRightPanelAction(btn.dataset.rightAction, btn.dataset);
    });
  }

  function installRightIssueStyles(){
    if (document.getElementById('tm-phase8-right-issue-style')) return;
    var st = document.createElement('style');
    st.id = 'tm-phase8-right-issue-style';
    st.textContent = [
      'body.tm-phase8-formal #tm-phase8-formal-panel{scrollbar-width:thin;scrollbar-color:rgba(201,168,95,.42) transparent;}',
      'body.tm-phase8-formal .tmrp-tabs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin:0 0 10px;}body.tm-phase8-formal .tmrp-tabs button{height:32px;border:1px solid rgba(201,168,95,.22);background:rgba(0,0,0,.22);color:rgba(232,220,187,.68);font-family:inherit;letter-spacing:.18em;cursor:pointer;}body.tm-phase8-formal .tmrp-tabs button.active{border-color:rgba(213,103,73,.50);background:linear-gradient(180deg,rgba(104,42,30,.72),rgba(35,20,14,.86));color:#ffe1ac;}',
      'body.tm-phase8-formal .tmrp-issue-tabs{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:0 0 10px;}',
      'body.tm-phase8-formal .tmrp-issue-tabs button{height:32px;border:1px solid rgba(201,168,95,.22);background:rgba(0,0,0,.22);color:rgba(232,220,187,.68);font-family:inherit;letter-spacing:.18em;cursor:pointer;}',
      'body.tm-phase8-formal .tmrp-issue-tabs button.active{border-color:rgba(213,103,73,.50);background:linear-gradient(180deg,rgba(104,42,30,.72),rgba(35,20,14,.86));color:#ffe1ac;}',
      'body.tm-phase8-formal .tmrp-issue-shell{display:flex;flex-direction:column;gap:9px;color:#eadfbd;font-family:"STKaiti","KaiTi","楷体",serif;}',
      'body.tm-phase8-formal .tmrp-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;}',
      'body.tm-phase8-formal .tmrp-stat{min-height:52px;border:1px solid rgba(201,168,95,.18);background:linear-gradient(180deg,rgba(255,245,210,.045),rgba(0,0,0,.18));display:flex;flex-direction:column;align-items:center;justify-content:center;}',
      'body.tm-phase8-formal .tmrp-stat b{color:#f2d98d;font-size:19px;line-height:1;}body.tm-phase8-formal .tmrp-stat span{margin-top:5px;color:rgba(232,220,187,.56);font-size:11px;}',
      'body.tm-phase8-formal .tmrp-card{border:1px solid rgba(201,168,95,.18);background:linear-gradient(180deg,rgba(255,245,210,.045),rgba(0,0,0,.16));padding:10px;box-sizing:border-box;}',
      'body.tm-phase8-formal .tmrp-card.hot{border-color:rgba(198,78,55,.44);box-shadow:inset 3px 0 rgba(198,78,55,.32);}body.tm-phase8-formal .tmrp-card.empty{min-height:70px;display:flex;align-items:center;justify-content:center;}',
      'body.tm-phase8-formal .tmrp-card-title{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:8px;}body.tm-phase8-formal .tmrp-card-title span{color:#f2d98d;font-size:14px;letter-spacing:.14em;}body.tm-phase8-formal .tmrp-card-title small{color:rgba(232,220,187,.48);font-size:10px;text-align:right;line-height:1.35;}body.tm-phase8-formal .tmrp-card-title.slim{margin-top:10px;border-top:1px solid rgba(201,168,95,.12);padding-top:8px;}',
      'body.tm-phase8-formal .tmrp-scroll{max-height:360px;overflow:auto;scrollbar-width:thin;scrollbar-color:rgba(201,168,95,.42) transparent;}body.tm-phase8-formal .tmrp-scroll.compact{max-height:224px;display:flex;flex-direction:column;gap:6px;padding-right:2px;}body.tm-phase8-formal .tmrp-scroll.logs{max-height:180px;}',
      'body.tm-phase8-formal .tmrp-person{width:100%;display:grid;grid-template-columns:34px minmax(0,1fr) 42px;align-items:center;gap:8px;text-align:left;border:1px solid rgba(201,168,95,.16);background:rgba(0,0,0,.18);color:#eadfbd;padding:7px;cursor:pointer;font-family:inherit;}body.tm-phase8-formal .tmrp-person.active{border-color:rgba(213,103,73,.50);background:linear-gradient(90deg,rgba(114,45,31,.42),rgba(0,0,0,.16));}body.tm-phase8-formal .tmrp-person b{display:block;color:#f2d98d;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}body.tm-phase8-formal .tmrp-person span span{display:block;margin-top:2px;color:rgba(232,220,187,.52);font-size:10.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}body.tm-phase8-formal .tmrp-person small{color:rgba(141,189,171,.86);font-size:10px;text-align:right;}',
      'body.tm-phase8-formal .tmrp-avatar{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;border:1px solid rgba(201,168,95,.34);background:radial-gradient(circle at 35% 24%,rgba(255,229,153,.25),rgba(73,43,20,.80));color:#f2d98d;font-size:13px;overflow:hidden;}body.tm-phase8-formal .tmrp-avatar img{width:100%;height:100%;object-fit:cover;display:block;}',
      'body.tm-phase8-formal .tmrp-wendui .tmrp-avatar{width:38px;height:46px;border-radius:4px;border-color:rgba(201,168,95,.38);background:linear-gradient(180deg,rgba(74,44,21,.88),rgba(12,8,6,.96));}body.tm-phase8-formal .tmrp-wendui .tmrp-avatar img{object-position:50% 18%;}',
      'body.tm-phase8-formal .tmrp-wd-rules{display:grid;gap:6px;}body.tm-phase8-formal .tmrp-wd-rules div:not(.tmrp-card-title){display:grid;grid-template-columns:68px minmax(0,1fr);gap:8px;border:1px solid rgba(201,168,95,.12);background:rgba(0,0,0,.12);padding:6px 8px;}body.tm-phase8-formal .tmrp-wd-rules b{color:#f2d98d;font-size:11px;font-weight:500;}body.tm-phase8-formal .tmrp-wd-rules span{color:rgba(232,220,187,.62);font-size:11px;line-height:1.45;}',
      'body.tm-phase8-formal .tmrp-wd-group .tmrp-card-title span{letter-spacing:.18em;}body.tm-phase8-formal .tmrp-wd-list{display:flex;flex-direction:column;gap:7px;}body.tm-phase8-formal .tmrp-wd-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px;}body.tm-phase8-formal .tmrp-wd-away{display:flex;flex-direction:column;gap:6px;max-height:230px;overflow:auto;padding-right:2px;}',
      'body.tm-phase8-formal .tmrp-wd-person{min-width:0;width:100%;display:grid;grid-template-columns:42px minmax(0,1fr);grid-template-rows:auto auto;gap:5px 8px;text-align:left;border:1px solid rgba(201,168,95,.16);background:rgba(0,0,0,.18);color:#eadfbd;padding:7px;cursor:pointer;font-family:inherit;}body.tm-phase8-formal .tmrp-wd-person:hover{border-color:rgba(226,185,92,.48);background:linear-gradient(90deg,rgba(106,43,30,.30),rgba(0,0,0,.14));}body.tm-phase8-formal .tmrp-wd-person.loyal-hi{box-shadow:inset 3px 0 rgba(141,189,171,.46);}body.tm-phase8-formal .tmrp-wd-person.loyal-lo{box-shadow:inset 3px 0 rgba(198,78,55,.46);}body.tm-phase8-formal .tmrp-wd-person.has-hist:after{content:"";position:absolute;}',
      'body.tm-phase8-formal .tmrp-wd-person .tmrp-avatar{grid-row:1/3;}body.tm-phase8-formal .tmrp-wd-person .main{min-width:0;}body.tm-phase8-formal .tmrp-wd-person b{display:block;color:#f2d98d;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}body.tm-phase8-formal .tmrp-wd-person b i{font-style:normal;color:#d56b55;margin-left:3px;}body.tm-phase8-formal .tmrp-wd-person small{display:block;color:rgba(232,220,187,.50);font-size:10px;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}body.tm-phase8-formal .tmrp-wd-person .meta{grid-column:2;display:flex;gap:4px;flex-wrap:wrap;}body.tm-phase8-formal .tmrp-wd-person .meta em{font-style:normal;border:1px solid rgba(201,168,95,.14);background:rgba(201,168,95,.05);color:#d8c27c;font-size:10px;line-height:1;padding:3px 5px;}',
      'body.tm-phase8-formal .tmrp-wd-request{display:grid;grid-template-columns:minmax(0,1fr) 46px;gap:6px;align-items:stretch;border:1px solid rgba(201,168,95,.16);background:rgba(0,0,0,.16);padding:6px;}body.tm-phase8-formal .tmrp-wd-request.envoy{border-color:rgba(141,189,171,.28);}body.tm-phase8-formal .tmrp-wd-request-main{min-width:0;display:grid;grid-template-columns:42px minmax(0,1fr);gap:8px;align-items:center;text-align:left;border:0;background:transparent;color:#eadfbd;font-family:inherit;padding:0;cursor:pointer;}body.tm-phase8-formal .tmrp-wd-request-main b{display:block;color:#f2d98d;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}body.tm-phase8-formal .tmrp-wd-request-main b i{font-style:normal;color:#8dbdab;margin-left:5px;font-size:10px;}body.tm-phase8-formal .tmrp-wd-request-main small{display:block;color:rgba(232,220,187,.58);font-size:11px;line-height:1.45;margin-top:2px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}',
      'body.tm-phase8-formal .tmrp-wd-mini{border:1px solid rgba(201,168,95,.20);background:rgba(18,13,10,.74);color:#e7d39e;font-family:inherit;font-size:11px;cursor:pointer;}body.tm-phase8-formal .tmrp-wd-mini.danger{border-color:rgba(198,78,55,.30);color:#e7a38c;}',
      'body.tm-phase8-formal .tmrp-mini-grid,body.tm-phase8-formal .tmrp-rows{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;}body.tm-phase8-formal .tmrp-mini-grid div,body.tm-phase8-formal .tmrp-rows div{border:1px solid rgba(201,168,95,.12);background:rgba(0,0,0,.12);padding:7px;min-width:0;}body.tm-phase8-formal .tmrp-mini-grid span,body.tm-phase8-formal .tmrp-rows span{display:block;color:rgba(232,220,187,.48);font-size:10.5px;}body.tm-phase8-formal .tmrp-mini-grid b,body.tm-phase8-formal .tmrp-rows b{display:block;margin-top:3px;color:#eadfbd;font-size:12px;font-weight:400;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      'body.tm-phase8-formal .tmrp-meta{margin:7px 0;color:rgba(232,220,187,.66);font-size:12px;line-height:1.65;}',
      'body.tm-phase8-formal .tmrp-bar{display:grid;grid-template-columns:44px minmax(0,1fr) 30px;align-items:center;gap:7px;margin:7px 0;font-size:11px;color:rgba(232,220,187,.58);}body.tm-phase8-formal .tmrp-bar i{height:6px;background:rgba(0,0,0,.28);border:1px solid rgba(201,168,95,.12);overflow:hidden;}body.tm-phase8-formal .tmrp-bar i b{display:block;height:100%;background:linear-gradient(90deg,#8dbdab,#f2d98d,#c85e49);}body.tm-phase8-formal .tmrp-bar em{font-style:normal;text-align:right;color:#e7d39e;}',
      'body.tm-phase8-formal .tmrp-action-row{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;}body.tm-phase8-formal .tmrp-action-row.fine{gap:5px;}',
      'body.tm-phase8-formal .tmrp-btn{min-height:28px;border:1px solid rgba(201,168,95,.22);background:rgba(18,13,10,.74);color:#eadfbd;padding:5px 9px;font-family:inherit;cursor:pointer;font-size:12px;}body.tm-phase8-formal .tmrp-btn.primary{border-color:rgba(213,103,73,.52);background:linear-gradient(180deg,rgba(126,45,32,.84),rgba(58,25,18,.92));color:#ffe1ac;}body.tm-phase8-formal .tmrp-btn:disabled{opacity:.42;cursor:not-allowed;}',
      'body.tm-phase8-formal .tmrp-textarea,body.tm-phase8-formal .tmrp-input{width:100%;box-sizing:border-box;border:1px solid rgba(201,168,95,.20);background:rgba(0,0,0,.24);color:#eadfbd;padding:8px;font-family:inherit;}body.tm-phase8-formal .tmrp-textarea{min-height:82px;resize:vertical;line-height:1.65;margin-top:8px;}',
      'body.tm-phase8-formal .tmrp-mode-grid{display:grid;grid-template-columns:1fr;gap:7px;margin-top:8px;}body.tm-phase8-formal .tmrp-mode-card{text-align:left;border:1px solid rgba(201,168,95,.16);background:rgba(0,0,0,.18);color:#eadfbd;padding:9px;font-family:inherit;cursor:pointer;}body.tm-phase8-formal .tmrp-mode-card.active{border-color:rgba(213,103,73,.50);background:linear-gradient(90deg,rgba(106,43,30,.54),rgba(0,0,0,.16));}body.tm-phase8-formal .tmrp-mode-card b{display:block;color:#f2d98d;font-size:14px;}body.tm-phase8-formal .tmrp-mode-card span{display:block;margin-top:4px;color:rgba(232,220,187,.58);font-size:11px;line-height:1.45;}',
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
      'body.tm-phase8-formal .tmrp-chaoyi-card small{display:inline-flex;margin-top:7px;border:1px solid rgba(204,164,76,.28);background:rgba(0,0,0,.34);color:#f3d98d;padding:2px 7px;font-size:11px;letter-spacing:.08em;}',
      'body.tm-phase8-formal .tmrp-army-shell{display:flex;flex-direction:column;gap:9px;color:#eadfbd;font-family:"STKaiti","KaiTi","楷体",serif;}',
      'body.tm-phase8-formal .tmrp-army-list .tmrp-person{grid-template-columns:34px minmax(0,1fr) 74px;}',
      'body.tm-phase8-formal .tmrp-ledger-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:7px 0 5px;padding:5px 7px;border:1px solid rgba(201,168,95,.14);background:linear-gradient(90deg,rgba(201,168,95,.08),rgba(0,0,0,.16));}',
      'body.tm-phase8-formal .tmrp-ledger-head span{color:#f2d98d;font-size:12px;letter-spacing:.14em;}body.tm-phase8-formal .tmrp-ledger-head small{color:rgba(232,220,187,.48);font-size:10px;}',
      'body.tm-phase8-formal .tmrp-data-table{width:100%;border-collapse:collapse;margin-top:9px;font-size:11.5px;color:#eadfbd;}body.tm-phase8-formal .tmrp-data-table th,body.tm-phase8-formal .tmrp-data-table td{border:1px solid rgba(201,168,95,.14);padding:6px 7px;text-align:left;vertical-align:top;}body.tm-phase8-formal .tmrp-data-table th{color:#d8c27c;background:rgba(201,168,95,.06);font-weight:400;}body.tm-phase8-formal .tmrp-data-table td:first-child{width:72px;color:rgba(232,220,187,.56);}',
      'body.tm-phase8-formal .tm-army-detail-flyout{position:fixed;right:452px;top:188px;width:372px;max-height:calc(100vh - 220px);overflow:auto;z-index:4998;border:1px solid rgba(201,168,95,.36);background:linear-gradient(180deg,rgba(30,22,15,.98),rgba(9,7,5,.97));box-shadow:0 20px 60px rgba(0,0,0,.48),inset 0 0 0 1px rgba(255,235,173,.04);padding:10px;box-sizing:border-box;color:#eadfbd;}',
      'body.tm-phase8-formal .tm-army-detail-head{display:flex;align-items:center;justify-content:space-between;margin:-2px 0 8px;padding-bottom:8px;border-bottom:1px solid rgba(201,168,95,.18);}body.tm-phase8-formal .tm-army-detail-head b{color:#f2d98d;font-size:15px;letter-spacing:.16em;}body.tm-phase8-formal .tm-army-detail-head button{width:28px;height:28px;border:1px solid rgba(201,168,95,.22);background:rgba(0,0,0,.22);color:#eadfbd;cursor:pointer;}',
      'body.tm-phase8-formal .tmrp-office-shell{display:flex;flex-direction:column;gap:9px;color:#eadfbd;font-family:"STKaiti","KaiTi","楷体",serif;}body.tm-phase8-formal .tmrp-scroll.tall{max-height:520px;overflow:auto;padding-right:2px;}',
      'body.tm-phase8-formal .tmrp-office-node{border:1px solid rgba(201,168,95,.16);background:rgba(0,0,0,.14);margin:0 0 8px;padding:0 9px 9px;}body.tm-phase8-formal .tmrp-office-node summary{cursor:pointer;list-style:none;padding:9px 0;color:#f2d98d;font-size:13px;letter-spacing:.10em;}body.tm-phase8-formal .tmrp-office-node summary::-webkit-details-marker{display:none;}body.tm-phase8-formal .tmrp-office-node summary small{float:right;color:rgba(232,220,187,.48);font-size:10px;letter-spacing:.04em;}',
      'body.tm-phase8-formal .tmrp-office-pos{border:1px solid rgba(201,168,95,.12);background:rgba(255,245,210,.035);padding:8px;margin:7px 0;}body.tm-phase8-formal .tmrp-office-pos>b{display:block;color:#f2d98d;font-size:13px;margin-bottom:5px;}body.tm-phase8-formal .tmrp-office-pos .tmrp-pill{margin:0 4px 5px 0;}',
      'body.tm-phase8-formal .tmrp-admin-shell{display:flex;flex-direction:column;gap:9px;color:#eadfbd;font-family:"STKaiti","KaiTi","楷体",serif;}body.tm-phase8-formal .tmrp-admin-card{box-shadow:inset 3px 0 var(--admin-c,rgba(201,168,95,.42));}body.tm-phase8-formal .tmrp-admin-title{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:8px;}body.tm-phase8-formal .tmrp-admin-title b{color:#f2d98d;font-size:15px;letter-spacing:.12em;}body.tm-phase8-formal .tmrp-admin-title small{color:rgba(232,220,187,.50);font-size:10px;text-align:right;line-height:1.45;}',
      'body.tm-phase8-formal .tmrp-step{border-left:2px solid rgba(198,78,55,.55);padding:5px 0 5px 8px;margin:5px 0;color:rgba(232,220,187,.68);font-size:11.5px;line-height:1.5;}body.tm-phase8-formal .tmrp-step b{color:#f2d98d;margin-right:6px;}',
      'body.tm-phase8-formal .tmrp-finance-shell{display:flex;flex-direction:column;gap:9px;color:#eadfbd;font-family:"STKaiti","KaiTi","楷体",serif;}body.tm-phase8-formal .tmrp-fin-line{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px;border:1px solid rgba(201,168,95,.12);background:rgba(0,0,0,.14);padding:7px;margin:6px 0;}body.tm-phase8-formal .tmrp-fin-line b{min-width:0;color:#f2d98d;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}body.tm-phase8-formal .tmrp-fin-line span{color:#eadfbd;font-size:12px;}body.tm-phase8-formal .tmrp-fin-line small{grid-column:1/3;color:rgba(232,220,187,.52);font-size:10.5px;line-height:1.45;}',
      'body.tm-phase8-formal .tmrp-wenshi-shell{display:flex;flex-direction:column;gap:9px;color:#eadfbd;font-family:"STKaiti","KaiTi","楷体",serif;}body.tm-phase8-formal .tmrp-work-card{display:grid;grid-template-columns:42px minmax(0,1fr);gap:9px;}body.tm-phase8-formal .tmrp-work-tab{min-height:74px;border:1px solid rgba(201,168,95,.20);background:linear-gradient(180deg,rgba(201,168,95,.12),rgba(0,0,0,.18));color:#f2d98d;display:flex;align-items:center;justify-content:center;writing-mode:vertical-rl;letter-spacing:.12em;font-size:12px;}',
      'body.tm-phase8-formal .tmrp-minister-shell{display:flex;flex-direction:column;gap:9px;color:#eadfbd;font-family:"STKaiti","KaiTi","楷体",serif;}body.tm-phase8-formal .tmrp-minister-card{display:grid;grid-template-columns:52px minmax(0,1fr);gap:10px;}body.tm-phase8-formal .tmrp-minister-face .tmrp-avatar{width:48px;height:60px;border-radius:4px;}body.tm-phase8-formal .tmrp-minister-main{min-width:0;}',
      '@media (max-width: 980px){body.tm-phase8-formal .tm-army-detail-flyout{right:12px;left:12px;top:108px;width:auto;max-height:calc(100vh - 150px);}}',
      'body.tm-phase8-formal .tmrp-chip-list,body.tm-phase8-formal .tmrp-pill-row{display:flex;flex-wrap:wrap;gap:5px;}body.tm-phase8-formal .tmrp-pill{display:inline-flex;max-width:100%;border:1px solid rgba(201,168,95,.16);background:rgba(201,168,95,.06);color:#d8c27c;padding:4px 7px;font-size:11px;line-height:1.25;}',
      'body.tm-phase8-formal .tmrp-warning-line{margin:8px 0;padding:7px 8px;border:1px solid rgba(198,78,55,.30);background:rgba(198,78,55,.10);color:#e7b59a;font-size:12px;line-height:1.55;}',
      'body.tm-phase8-formal .tmrp-log{display:grid;grid-template-columns:26px minmax(0,1fr) auto;gap:7px;align-items:start;border:1px solid rgba(201,168,95,.12);background:rgba(0,0,0,.14);padding:7px;}body.tm-phase8-formal .tmrp-log b{width:22px;height:22px;display:grid;place-items:center;border:1px solid rgba(201,168,95,.28);border-radius:50%;color:#f2d98d;font-size:11px;}body.tm-phase8-formal .tmrp-log span{color:rgba(232,220,187,.70);font-size:11.5px;line-height:1.55;}body.tm-phase8-formal .tmrp-log strong{color:#f2d98d;font-weight:500;}body.tm-phase8-formal .tmrp-log em{font-style:normal;color:#8dbdab;font-size:10px;white-space:nowrap;}body.tm-phase8-formal .tmrp-empty{padding:14px;text-align:center;color:rgba(232,220,187,.48);font-size:12px;}'
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
    if (!renderers[slot]) return;
    clearOfficeStandaloneMode();
    if (slot !== 'army') rightCloseArmyFlyout();
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
    bindRightPanelActions(host);
    panel.classList.add('show', 'tm-right-expanded');
    var drawer = document.getElementById('drawerRight');
    if (drawer) drawer.classList.remove('open');
  }

  function closeRightDrawer(){
    rightCloseArmyFlyout();
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
      ['.gs-turn-fab-bar .gs-fab-btn:nth-child(1)', openZhaoPreviewPanel],
      ['.gs-turn-fab-bar .gs-fab-btn:nth-child(2)', openHongyanPreviewPanel],
      ['.gs-turn-fab-bar .gs-fab-btn:nth-child(3)', function(){ openModule('wendui'); }],
      ['.gs-turn-fab-bar .gs-fab-btn:nth-child(4)', function(){ openModule('chaoyi'); }],
      ['.gs-turn-fab-bar .gs-fab-btn:nth-child(5)', openYueZouPreviewPanel],
      ['.gs-turn-fab-bar .gs-fab-btn:nth-child(6)', openShiluPreviewPanel]
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
    var buttons = [
      ['ol','纲','纲纪总览','6','hot'],
      ['issue','政','政务问对','3','hot'],
      ['policy','文','文事艺府','',''],
      ['office','臣','百官人事','pin',''],
      ['army','军','军务边防','2','hot'],
      ['map','图','舆图政区','',''],
      ['finance','户','户部财计','','ok'],
      ['archive','制','官制衙门','','']
    ];
    rail.innerHTML = '<div class="tm-rc-cap" aria-hidden="true">国事</div>' + buttons.map(function(b, i){
      var badge = b[3] === 'pin'
        ? '<span class="tm-rc-count" data-phase8-badge="pinned"></span>'
        : (b[3] ? '<span class="tm-rc-count">' + esc(b[3]) + '</span>' : '');
      var divider = (i === 0 || i === 3 || i === 6) ? '<div class="tm-rc-divider" aria-hidden="true"></div>' : '';
      return '<button type="button" class="tm-rc-icon ' + esc(b[4] || '') + '" aria-label="' + esc(b[2]) + '" data-slot="' + esc(b[0]) + '" data-tip="' + esc(b[2]) + '" onclick="TMPhase8FormalBridge.openPanel(\'' + esc(b[0]) + '\')">' + esc(b[1]) + badge + '</button>' + divider;
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
      'body.tm-phase8-formal #banner{position:fixed!important;top:66px!important;left:50%!important;transform:translateX(-50%)!important;z-index:1002!important;padding:1px 13px 2px!important;background:radial-gradient(circle at 28% 20%,rgba(255,232,174,.18),transparent 42%),linear-gradient(180deg,rgba(202,80,58,.86),rgba(133,34,26,.94))!important;color:#fff5e0!important;font:500 9.5px/14px "STKaiti","KaiTi",serif!important;letter-spacing:.18em!important;border-radius:0 0 9px 9px!important;border:1px solid rgba(244,234,221,.32)!important;border-top:0!important;box-shadow:0 2px 7px rgba(140,40,30,.38),inset 0 1px 0 rgba(255,255,255,.14)!important;text-shadow:0 1px 1px rgba(0,0,0,.4)!important;white-space:nowrap!important;cursor:pointer!important;pointer-events:auto!important;}body.tm-phase8-formal #banner:hover{filter:brightness(1.07)!important;}body.tm-phase8-formal .map-alert-strip{display:none!important;}',
      'body.tm-phase8-formal #topbar{position:fixed;left:0;right:0;top:0;z-index:1000;height:56px;display:flex;align-items:flex-start;gap:8px;padding:7px 12px 0;box-sizing:border-box;background:linear-gradient(180deg,rgba(5,4,4,.72),rgba(5,4,4,.28) 72%,rgba(5,4,4,0));border:0;box-shadow:0 8px 18px rgba(0,0,0,.24);font-family:"STKaiti","KaiTi","楷体",serif;color:#eadfbd;}',
      'body.tm-phase8-formal #topbar:before{content:"";position:absolute;left:0;right:0;top:-3px;height:62px;background:url("preview/img/topbar-imperial-rail.png") center top/100% 100% no-repeat;opacity:.78;filter:saturate(.95) contrast(1.03) brightness(.82);pointer-events:none;}body.tm-phase8-formal #topbar:after{content:"";position:absolute;left:84px;right:84px;top:53px;height:1px;background:linear-gradient(90deg,transparent,rgba(239,202,116,.44) 18%,rgba(151,48,34,.24) 50%,rgba(239,202,116,.36) 82%,transparent);box-shadow:0 0 8px rgba(214,176,90,.18);opacity:.82;pointer-events:none;}',
      'body.tm-phase8-formal .tb-left,body.tm-phase8-formal .tb-vars,body.tm-phase8-formal .tb-right{position:relative;z-index:2;}body.tm-phase8-formal .tb-left{height:42px;display:flex;align-items:center;gap:7px;padding:4px 10px 4px 8px;border:1px solid rgba(218,181,93,.42);border-left:2px solid rgba(151,48,34,.88);border-radius:4px 9px 9px 4px;background:linear-gradient(180deg,rgba(34,27,20,.82),rgba(8,7,6,.86)),radial-gradient(ellipse at 0 50%,rgba(162,50,35,.25),transparent 64%);box-shadow:inset 0 1px 0 rgba(255,238,190,.07),inset 0 -1px 0 rgba(0,0,0,.60),0 5px 12px rgba(0,0,0,.28);}',
      'body.tm-phase8-formal .tb-wentian{height:32px;min-width:62px;padding:0 10px;border:1px solid rgba(223,185,98,.48);border-radius:3px;background:linear-gradient(180deg,rgba(52,39,24,.92),rgba(10,8,6,.92)),linear-gradient(90deg,rgba(151,48,34,.24),transparent 72%);color:#efd58f;font-size:12px;letter-spacing:.14em;box-shadow:inset 0 1px 0 rgba(255,238,190,.08),inset 0 -10px 18px rgba(0,0,0,.20);cursor:pointer;font-family:inherit;}body.tm-phase8-formal .tb-wentian:hover{border-color:rgba(244,211,128,.70);box-shadow:inset 0 1px 0 rgba(255,238,190,.10),0 0 12px rgba(214,176,90,.22);}body.tm-phase8-formal .tb-weather{height:32px;display:flex;align-items:center;gap:6px;padding:0 4px 0 2px;}body.tm-phase8-formal .tb-w-seal{width:25px;height:25px;display:grid;place-items:center;border:1px solid rgba(235,198,113,.70);border-radius:50%;background:radial-gradient(circle at 36% 28%,rgba(255,221,138,.74),rgba(174,103,32,.58) 58%,rgba(65,35,14,.82));box-shadow:inset 0 1px 0 rgba(255,246,202,.35),0 0 11px rgba(224,174,80,.22);color:#271309;font-size:12px;}',
      'body.tm-phase8-formal .tb-w-info{min-width:88px;}body.tm-phase8-formal .tb-w-name{font-size:11px;color:#ecd58e;letter-spacing:.09em;white-space:nowrap;}body.tm-phase8-formal .tb-w-desc{font-size:9px;color:rgba(188,174,142,.72);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:120px;}',
      'body.tm-phase8-formal .tb-vars{flex:1 1 auto;min-width:0;height:42px;display:flex;align-items:center;padding:4px 5px;gap:0;border:1px solid rgba(203,166,88,.24);border-radius:2px;background:linear-gradient(180deg,rgba(41,32,23,.86),rgba(13,10,8,.82)),linear-gradient(90deg,rgba(94,54,27,.18),rgba(0,0,0,.04) 12%,rgba(0,0,0,.04) 88%,rgba(94,54,27,.16));box-shadow:inset 0 1px 0 rgba(255,239,196,.055),inset 0 -1px 0 rgba(0,0,0,.52),0 3px 8px rgba(0,0,0,.20);overflow:hidden;}body.tm-phase8-formal .tb-var{height:30px;display:flex;align-items:center;gap:5px;padding:2px 7px;min-width:78px;border:0;background:transparent;position:relative;}body.tm-phase8-formal .tb-var + .tb-var:before{content:"";position:absolute;left:0;top:5px;bottom:5px;width:1px;background:linear-gradient(180deg,transparent,rgba(220,184,102,.24),transparent);}body.tm-phase8-formal .tb-var:hover{background:linear-gradient(180deg,rgba(213,176,95,.10),rgba(213,176,95,.03));}',
      'body.tm-phase8-formal .tb-var.wide{flex:1 1 176px;min-width:156px;max-width:208px;display:grid;grid-template-columns:32px minmax(0,1fr);gap:7px;background:linear-gradient(180deg,rgba(63,43,24,.18),rgba(0,0,0,.02));}body.tm-phase8-formal .tb-vn{font-size:8px;letter-spacing:.12em;color:rgba(184,168,132,.72);white-space:nowrap;}body.tm-phase8-formal .tb-vv{font-size:12px;color:#e0c77e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}body.tm-phase8-formal .icn{width:18px;height:18px;display:grid;place-items:center;border:1px solid rgba(214,176,90,.36);border-radius:50%;background:radial-gradient(circle at 35% 28%,rgba(255,227,146,.18),rgba(54,32,16,.78));color:#e6cd86;font-size:9px;flex:0 0 auto;}body.tm-phase8-formal .tb-vsubs{display:flex;align-items:center;gap:5px;min-width:0;}body.tm-phase8-formal .tb-vs{display:flex;align-items:center;gap:4px;min-width:0;}body.tm-phase8-formal .tb-vs .sv{display:flex;flex-direction:column;line-height:1.05;min-width:0;}body.tm-phase8-formal .tb-vs b{font-size:11px;color:#e0c77e;white-space:nowrap;}body.tm-phase8-formal .sd{font-size:8px;color:#8dbdab;white-space:nowrap;}',
      'body.tm-phase8-formal .tb-right{height:42px;display:flex;align-items:center;gap:7px;}body.tm-phase8-formal .tb-chip{height:34px;min-width:70px;border:1px solid rgba(218,181,93,.30);border-radius:4px;background:linear-gradient(180deg,rgba(36,28,20,.82),rgba(8,7,6,.86));color:#d8c27c;font-family:inherit;letter-spacing:.14em;cursor:pointer;}body.tm-phase8-formal .tb-time{height:42px;min-width:230px;padding:6px 12px 0;border:1px solid rgba(218,181,93,.30);border-right:2px solid rgba(151,48,34,.70);border-radius:8px 4px 4px 8px;background:linear-gradient(180deg,rgba(34,27,20,.82),rgba(8,7,6,.86));box-sizing:border-box;text-align:right;}body.tm-phase8-formal .tb-time-main{color:#efd58f;font-size:13px;letter-spacing:.10em;white-space:nowrap;}body.tm-phase8-formal .tb-time-sub{margin-top:3px;color:rgba(188,174,142,.72);font-size:10px;}',
      'body.tm-phase8-formal #topbar{height:64px!important;padding:7px 12px 0!important;gap:9px!important;align-items:flex-start!important;background:transparent!important;border:0!important;box-shadow:none!important;backdrop-filter:none!important;pointer-events:none!important;}body.tm-phase8-formal #topbar:before,body.tm-phase8-formal #topbar:after{display:none!important;}body.tm-phase8-formal #G{margin-top:48px!important;height:calc(100vh - 48px)!important;}body.tm-phase8-formal .tb-left,body.tm-phase8-formal .tb-vars,body.tm-phase8-formal .tb-right{pointer-events:auto!important;flex-shrink:0!important;overflow:visible!important;}',
      'body.tm-phase8-formal .tb-left{width:205px!important;height:44px!important;margin:0 2px 0 0!important;padding:5px 13px 5px 7px!important;gap:7px!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;}body.tm-phase8-formal .tb-left:before{content:"";position:absolute;z-index:-1;inset:-12px -16px -13px -10px;background:url("preview/img/topbar-left-identity-underlay-v1.png") center/100% 100% no-repeat;opacity:.68;filter:saturate(.98) brightness(.92) contrast(1.05);pointer-events:none;}body.tm-phase8-formal .tb-left:after{display:none!important;}',
      'body.tm-phase8-formal .tb-wentian{width:36px!important;min-width:36px!important;height:34px!important;padding:0!important;border-radius:50%!important;border-color:rgba(227,187,92,.62)!important;background:radial-gradient(circle at 35% 27%,rgba(251,221,143,.30),rgba(92,54,24,.88) 58%,rgba(12,9,7,.94) 78%),linear-gradient(180deg,rgba(63,38,20,.94),rgba(12,9,7,.94))!important;color:#f0d58f!important;font-size:10px!important;letter-spacing:.06em!important;box-shadow:inset 0 1px 0 rgba(255,239,180,.14),inset 0 -8px 14px rgba(0,0,0,.32),0 2px 8px rgba(0,0,0,.40),0 0 11px rgba(205,166,82,.15)!important;}body.tm-phase8-formal .tb-weather{height:34px!important;min-width:122px!important;padding:0!important;gap:6px!important;background:transparent!important;border:0!important;box-shadow:none!important;}',
      'body.tm-phase8-formal .tb-w-seal{width:24px!important;height:24px!important;font-size:11px!important;border-color:rgba(233,196,105,.52)!important;background:radial-gradient(circle at 35% 25%,rgba(255,225,147,.24),rgba(86,52,24,.74) 58%,rgba(13,10,8,.92))!important;}body.tm-phase8-formal .tb-w-info{min-width:82px!important;}body.tm-phase8-formal .tb-w-name{max-width:104px!important;font-size:10.8px!important;color:#efd990!important;}body.tm-phase8-formal .tb-w-desc{font-size:8.2px!important;color:rgba(209,193,153,.66)!important;}',
      'body.tm-phase8-formal .tb-vars{--tm-rail-w:932px;--tm-rail-h:54px;--tm-rail-pad-x:12px;--tm-rail-pad-y:7px;--tm-rail-gap:4px;--tm-wide-cell:212px;--tm-hukou-cell:104px;--tm-lizhi-cell:110px;--tm-small-cell:82px;width:var(--tm-rail-w)!important;height:var(--tm-rail-h)!important;flex:0 0 var(--tm-rail-w)!important;max-width:none!important;padding:var(--tm-rail-pad-y) var(--tm-rail-pad-x)!important;gap:var(--tm-rail-gap)!important;border:0!important;border-radius:0!important;background:url("preview/img/topbar-resource-fieldrail-v2-wide.png") center/100% 100% no-repeat!important;box-shadow:none!important;}body.tm-phase8-formal .tb-vars:before,body.tm-phase8-formal .tb-vars:after{display:none!important;}',
      'body.tm-phase8-formal .tb-var{height:calc(var(--tm-rail-h) - (var(--tm-rail-pad-y) * 2))!important;border-color:transparent!important;background:transparent!important;box-shadow:none!important;min-width:0!important;}body.tm-phase8-formal .tb-var.wide{height:calc(var(--tm-rail-h) - (var(--tm-rail-pad-y) * 2))!important;flex:0 0 var(--tm-wide-cell)!important;width:var(--tm-wide-cell)!important;min-width:var(--tm-wide-cell)!important;max-width:var(--tm-wide-cell)!important;}body.tm-phase8-formal .tb-var:not(.wide){height:calc(var(--tm-rail-h) - (var(--tm-rail-pad-y) * 2))!important;flex:0 0 var(--tm-small-cell)!important;width:var(--tm-small-cell)!important;min-width:var(--tm-small-cell)!important;max-width:var(--tm-small-cell)!important;}body.tm-phase8-formal .tb-var[data-key="hukou"]{flex-basis:var(--tm-hukou-cell)!important;width:var(--tm-hukou-cell)!important;min-width:var(--tm-hukou-cell)!important;max-width:var(--tm-hukou-cell)!important;}body.tm-phase8-formal .tb-var[data-key="lizhi"]{flex-basis:var(--tm-lizhi-cell)!important;width:var(--tm-lizhi-cell)!important;min-width:var(--tm-lizhi-cell)!important;max-width:var(--tm-lizhi-cell)!important;}',
      'body.tm-phase8-formal .tb-right{width:340px!important;height:52px!important;flex:0 0 340px!important;background:url("preview/img/topbar-right-fieldtime-v3-wide.png") center/100% 100% no-repeat!important;border:0!important;box-shadow:none!important;padding:0 12px!important;box-sizing:border-box;}body.tm-phase8-formal .tb-right:before{display:none!important;}body.tm-phase8-formal .tb-chip{height:30px;min-width:64px;background:transparent!important;border-color:rgba(214,188,116,.16)!important;color:rgba(230,213,172,.72)!important;}body.tm-phase8-formal .tb-time{height:44px!important;min-width:194px!important;padding:7px 0 0!important;border:0!important;background:transparent!important;text-align:right!important;}body.tm-phase8-formal .tb-time-main{max-width:190px!important;font-size:10.8px!important;letter-spacing:.055em!important;color:#e6c878!important;}body.tm-phase8-formal .tb-time-sub{max-width:190px!important;font-size:8px!important;color:rgba(205,190,151,.68)!important;}',
      '@media(max-width:1500px){body.tm-phase8-formal .tb-vars{--tm-rail-w:800px;--tm-rail-h:50px;--tm-rail-pad-x:9px;--tm-rail-pad-y:6px;--tm-rail-gap:3px;--tm-wide-cell:188px;--tm-hukou-cell:92px;--tm-lizhi-cell:92px;--tm-small-cell:62px;background-image:url("preview/img/topbar-resource-fieldrail-v2-wide.png")!important;}body.tm-phase8-formal .tb-right{width:230px!important;height:48px!important;flex-basis:230px!important;background-image:url("preview/img/topbar-right-fieldtime-v3-compact.png")!important;}}',
      '@media(max-width:1080px){body.tm-phase8-formal .tb-vars{--tm-rail-w:626px;--tm-rail-h:50px;--tm-rail-pad-x:9px;--tm-rail-pad-y:6px;--tm-rail-gap:3px;--tm-wide-cell:126px;--tm-hukou-cell:76px;--tm-lizhi-cell:82px;--tm-small-cell:60px;background-image:url("preview/img/topbar-resource-fieldrail-v2-narrow.png")!important;}body.tm-phase8-formal .tb-right{width:154px!important;height:48px!important;flex-basis:154px!important;background-image:url("preview/img/topbar-right-fieldtime-v3-narrow.png")!important;}body.tm-phase8-formal .tb-weather,body.tm-phase8-formal .tb-chip{display:none!important;}}',
      'body.tm-phase8-formal #topbar{height:78px!important;padding-top:8px!important;}body.tm-phase8-formal .tb-left{height:52px!important;}body.tm-phase8-formal .tb-right{isolation:isolate!important;}body.tm-phase8-formal .tb-vbody{display:flex;flex-direction:column;justify-content:center;line-height:1.05;flex:1;min-width:0;overflow:hidden;}body.tm-phase8-formal .tb-vn{font-size:7.6px!important;letter-spacing:.18em!important;}body.tm-phase8-formal .tb-vv{font-size:12px!important;color:#e0c77e!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}body.tm-phase8-formal .tb-var.warn .tb-vv{color:#e88a78!important;}body.tm-phase8-formal .tb-var.good .tb-vv{color:#8dbdab!important;}',
      'body.tm-phase8-formal .tb-var.wide .tb-vn{width:auto!important;flex:0 0 8px!important;font-size:7.9px!important;line-height:1!important;margin-bottom:1px!important;padding:0!important;border-right:0!important;}body.tm-phase8-formal .tb-var.wide .tb-vsubs{display:flex!important;align-items:center!important;gap:4px!important;min-width:0!important;line-height:1.05!important;}body.tm-phase8-formal .tb-var.wide .tb-vs{height:25px!important;display:flex!important;align-items:center!important;gap:4px!important;padding:2px 3px!important;border-radius:2px;background:rgba(0,0,0,.12)!important;cursor:default;}body.tm-phase8-formal .tb-var.wide .sv{display:flex!important;flex-direction:column!important;align-items:flex-start!important;line-height:1.05!important;min-width:32px!important;}body.tm-phase8-formal .tb-var.wide .sv b{font:600 11.2px/1.12 "STSong","SimSun","Songti SC",serif!important;letter-spacing:.02em!important;color:#e0c77e!important;}body.tm-phase8-formal .tb-var.wide .sv .sd{font:500 7px/1.1 "STSong","SimSun",serif!important;letter-spacing:.02em!important;margin-top:1px!important;}body.tm-phase8-formal .sd.up{color:#8dbdab!important;}body.tm-phase8-formal .sd.dn{color:#e88a78!important;}body.tm-phase8-formal .sd.flat{color:rgba(184,168,132,.72)!important;}',
      'body.tm-phase8-formal .tb-var{cursor:pointer!important;}body.tm-phase8-formal .tb-var.wide{display:flex!important;flex-direction:column!important;align-items:stretch!important;justify-content:center!important;gap:3px!important;padding:5px 8px!important;overflow:hidden!important;}body.tm-phase8-formal .tb-var:not(.wide){display:flex!important;flex-direction:row!important;align-items:center!important;gap:5px!important;padding:5px 8px!important;overflow:hidden!important;}body.tm-phase8-formal .tb-vn:before,body.tm-phase8-formal .tb-var.wide .tb-vn:before{display:none!important;}body.tm-phase8-formal .tb-var.wide .tb-vn{flex:0 0 auto!important;min-width:0!important;max-width:none!important;padding-left:4px!important;text-align:left!important;overflow:hidden!important;text-overflow:ellipsis!important;color:rgba(221,202,155,.74)!important;}body.tm-phase8-formal .tb-vn{max-width:100%!important;overflow:hidden!important;text-overflow:ellipsis!important;}body.tm-phase8-formal .tb-var.wide .tb-vsubs{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;align-items:center!important;gap:4px!important;overflow:hidden!important;}body.tm-phase8-formal .tb-var.wide .tb-vs{min-width:0!important;overflow:hidden!important;cursor:pointer!important;}body.tm-phase8-formal .tb-var.wide .sv{min-width:0!important;flex:1 1 auto!important;overflow:hidden!important;}body.tm-phase8-formal .tb-var.wide .sv b,body.tm-phase8-formal .tb-var.wide .sv .sd{display:block!important;max-width:100%!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;}body.tm-phase8-formal .tb-vbody{gap:1px!important;}body.tm-phase8-formal .tb-right{margin-left:auto!important;}',
      'body.tm-phase8-formal .icn{width:17px!important;height:17px!important;font-size:8.6px!important;display:grid!important;place-items:center!important;border-radius:50%!important;box-sizing:border-box;}body.tm-phase8-formal .tb-var.wide .icn{width:16px!important;height:16px!important;font-size:8px!important;}body.tm-phase8-formal .icn-yin{color:#f3d58f!important;border-color:#a98643!important;background:radial-gradient(circle at 32% 28%,rgba(237,202,122,.56),rgba(116,73,28,.34) 60%,rgba(40,26,13,.60) 100%)!important;}body.tm-phase8-formal .icn-liang{color:#d8e0a2!important;border-color:#7f8d49!important;background:radial-gradient(circle at 32% 28%,rgba(216,224,162,.42),rgba(86,104,52,.34) 60%,rgba(26,33,18,.62) 100%)!important;}body.tm-phase8-formal .icn-bu{color:#c9d7e8!important;border-color:#6e839b!important;background:radial-gradient(circle at 32% 28%,rgba(201,215,232,.42),rgba(70,86,104,.36) 60%,rgba(24,29,36,.62) 100%)!important;}body.tm-phase8-formal .icn-zhen{color:#eed09a!important;border-color:#946b92!important;background:radial-gradient(circle at 32% 28%,rgba(238,208,154,.44),rgba(111,66,103,.38) 60%,rgba(38,23,34,.62) 100%)!important;}',
      'body.tm-phase8-formal .icn-hu{color:#ecd2a0!important;border-color:#a07c40!important;background:radial-gradient(circle at 32% 28%,rgba(232,206,160,.50),rgba(110,82,40,.32) 60%,rgba(40,28,15,.55) 100%)!important;}body.tm-phase8-formal .icn-li{color:#d7ddf0!important;border-color:#697da8!important;background:radial-gradient(circle at 32% 28%,rgba(204,218,246,.42),rgba(58,68,98,.35) 60%,rgba(22,27,42,.62) 100%)!important;}body.tm-phase8-formal .icn-min{color:#bfe6d7!important;border-color:#5b947c!important;background:radial-gradient(circle at 32% 28%,rgba(178,232,210,.40),rgba(56,105,82,.34) 60%,rgba(20,36,29,.62) 100%)!important;}body.tm-phase8-formal .icn-huang{color:#f0c46f!important;border-color:#b48536!important;background:radial-gradient(circle at 32% 28%,rgba(239,196,111,.50),rgba(128,72,24,.38) 60%,rgba(44,25,11,.64) 100%)!important;}body.tm-phase8-formal .icn-wei{color:#f3d894!important;border-color:#b49655!important;background:radial-gradient(circle at 32% 28%,rgba(243,216,148,.50),rgba(103,86,46,.38) 60%,rgba(35,30,17,.64) 100%)!important;}',
      '@media(max-width:1280px){body.tm-phase8-formal #topbar{height:70px!important;}body.tm-phase8-formal .tb-left{height:48px!important;}body.tm-phase8-formal .tb-var.wide .sd{display:none!important;}}',
      '@media(max-width:1080px){body.tm-phase8-formal #topbar{height:66px!important;}body.tm-phase8-formal .tb-var.wide .tb-vn{display:none!important;}}',
      'body.tm-phase8-formal .bar-wentian{height:40px;min-width:92px;border:1px solid rgba(201,168,95,.45)!important;background:linear-gradient(180deg,rgba(44,34,22,.90),rgba(13,10,8,.96))!important;-webkit-text-fill-color:#f0d98c;color:#f0d98c!important;border-radius:2px;letter-spacing:.34em;font-size:16px;padding-left:18px;}',
      'body.tm-phase8-formal .bar-weather{height:42px;min-width:128px;border:1px solid rgba(201,168,95,.20);border-left:none;border-right:1px solid rgba(201,168,95,.24);background:linear-gradient(90deg,rgba(201,168,95,.05),rgba(0,0,0,.10));}',
      'body.tm-phase8-formal .bar-vars{flex:1 1 auto;min-width:0;gap:5px;flex-wrap:nowrap;overflow:hidden;}',
      'body.tm-phase8-formal .bar-var{height:40px;min-width:78px;padding:4px 10px;border:1px solid rgba(201,168,95,.20);border-radius:2px;background:linear-gradient(180deg,rgba(40,31,20,.72),rgba(11,8,6,.72));box-shadow:inset 0 0 0 1px rgba(0,0,0,.35);}',
      'body.tm-phase8-formal .bar-var.wide{min-width:116px;}',
      'body.tm-phase8-formal .bar-var-name{font-size:11px;color:#bda765;letter-spacing:.16em;}',
      'body.tm-phase8-formal .bar-var-value{font-size:16px;color:var(--c,#f0d98c);}',
      'body.tm-phase8-formal .bar-var-sub-item{font-size:12px;line-height:1.05;}',
      'body.tm-phase8-formal .bar-var-sub-item .sk{font-size:10px;color:#917e57;}',
      'body.tm-phase8-formal .bar-more-vars{height:38px;border-color:rgba(201,168,95,.35)!important;background:linear-gradient(180deg,rgba(34,26,17,.86),rgba(11,8,6,.9))!important;color:#d7be73;border-radius:2px;letter-spacing:.2em;}',
      'body.tm-phase8-formal .bar-time{height:44px;min-width:196px;border:1px solid rgba(201,168,95,.32)!important;background:linear-gradient(180deg,rgba(42,32,20,.84),rgba(12,9,7,.92))!important;border-radius:2px;padding:5px 14px;}',
      'body.tm-phase8-formal .bar-time-main{font-size:15px;color:#f0d98c;letter-spacing:.16em;}',
      'body.tm-phase8-formal .bar-time-sub{font-size:11px;color:#9b8b6d;}',
      'body.tm-phase8-formal .gs-rail-left{width:0;border-right:0;background:transparent;overflow:visible;pointer-events:none;}',
      'body.tm-phase8-formal .gs-rail-left .gs-rail{display:none!important;}',
      'body.tm-phase8-formal .gs-rail-right{position:absolute;right:0;top:0;bottom:0;width:58px;background:transparent;border-left:0;overflow:visible;z-index:40;pointer-events:none;}',
      'body.tm-phase8-formal .gs-rail-right>.gs-rail{display:none!important;}body.tm-phase8-formal #tm-right-rail{position:fixed;top:78px;left:calc(100vw - 58px);right:auto;z-index:9997;width:48px;display:flex;flex-direction:column;align-items:center;gap:5px;pointer-events:none;font-family:"STKaiti","KaiTi","楷体",serif;}',
      'body.tm-phase8-formal .tm-rc-cap{width:40px;height:18px;display:flex;align-items:center;justify-content:center;border:1px solid rgba(201,160,69,.28);border-radius:2px;background:linear-gradient(180deg,rgba(30,22,14,.82),rgba(10,8,6,.76));color:rgba(212,190,122,.76);font:700 9px/1 "STKaiti","KaiTi",serif;letter-spacing:.22em;pointer-events:auto;}body.tm-phase8-formal .tm-rc-divider{width:34px;height:1px;background:linear-gradient(90deg,transparent,rgba(201,160,69,.55),transparent);pointer-events:auto;}',
      'body.tm-phase8-formal .tm-rc-icon{width:42px;height:42px;border:1px solid rgba(184,154,83,.30);border-radius:5px;background:radial-gradient(ellipse at 50% 0%,rgba(228,198,111,.16),transparent 66%),linear-gradient(180deg,rgba(59,39,20,.78),rgba(13,10,8,.76));box-shadow:inset 0 1px 0 rgba(255,244,210,.08),inset 0 -8px 13px rgba(0,0,0,.24),0 5px 14px rgba(0,0,0,.34);backdrop-filter:blur(3px);color:rgba(226,214,184,.78);font:700 15px/1 "STKaiti","KaiTi",serif;display:flex;align-items:center;justify-content:center;position:relative;cursor:pointer;pointer-events:auto;padding:0;}body.tm-phase8-formal .tm-rc-icon:hover{border-color:rgba(232,197,113,.62);color:#f4d98a;transform:translateX(-1px);}',
      'body.tm-phase8-formal .tm-rc-icon.hot{border-color:rgba(192,64,48,.48);color:#e8a58f;}body.tm-phase8-formal .tm-rc-icon.ok{border-color:rgba(126,184,167,.46);color:#a8d4c5;}body.tm-phase8-formal .tm-rc-icon.active{border-color:rgba(232,197,113,.76);color:#f4d98a;box-shadow:inset 0 0 0 1px rgba(0,0,0,.28),0 0 12px rgba(217,184,99,.28),0 8px 18px rgba(0,0,0,.42);}body.tm-phase8-formal .tm-rc-count{position:absolute;right:-4px;top:-5px;min-width:14px;height:14px;line-height:13px;padding:0 3px;border-radius:8px;background:linear-gradient(180deg,#a93628,#6a150f);border:1px solid rgba(245,190,122,.55);color:#ffd9bc;font:700 8px/13px serif;text-align:center;box-sizing:border-box;}',
      'body.tm-phase8-formal .gs-drawer.left{left:0;}',
      'body.tm-phase8-formal .gs-drawer.right{right:58px;width:420px;background:linear-gradient(180deg,rgba(26,21,16,.98),rgba(9,8,6,.98));z-index:70;}',
      'body.tm-phase8-formal #drawerRight.gs-drawer.right{position:fixed!important;right:58px!important;top:56px!important;bottom:32px!important;left:auto!important;width:0!important;transform:none!important;overflow:hidden!important;pointer-events:none;background:linear-gradient(180deg,rgba(26,22,18,.98),rgba(9,8,7,.985)),radial-gradient(ellipse at 0 8%,rgba(218,184,98,.11),transparent 42%)!important;border-left:1px solid rgba(229,196,116,.42)!important;box-shadow:-10px 0 24px rgba(0,0,0,.34),inset 1px 0 0 rgba(255,239,196,.08)!important;transition:width .18s ease,box-shadow .18s ease!important;z-index:9996!important;}body.tm-phase8-formal #drawerRight.gs-drawer.right.open{width:390px!important;overflow-y:auto!important;overflow-x:hidden!important;pointer-events:auto;box-shadow:-16px 0 34px rgba(0,0,0,.48),inset 1px 0 0 rgba(255,239,196,.10)!important;}',
      'body.tm-phase8-formal #drawerRight.gs-drawer.right.open:before{content:"";position:absolute;left:0;top:16px;bottom:16px;width:3px;background:linear-gradient(180deg,rgba(229,196,116,.76),rgba(142,44,34,.52),rgba(229,196,116,.62));box-shadow:0 0 10px rgba(229,196,116,.22);pointer-events:none;}body.tm-phase8-formal #drawerRight .gs-drawer-head{min-height:48px;padding:10px 12px 9px 16px;border-bottom:1px solid rgba(184,154,83,.20);background:linear-gradient(90deg,rgba(68,46,24,.26),rgba(0,0,0,0) 72%),linear-gradient(180deg,rgba(255,239,196,.035),rgba(0,0,0,.10));}body.tm-phase8-formal #drawerRight .gs-drawer-title{color:#f0d98c;font-size:16px;letter-spacing:.20em;font-weight:500;}body.tm-phase8-formal #drawerRight .gs-drawer-body{padding:12px 12px 18px;}',
      'body.tm-phase8-formal .gc{grid-column:2;position:relative;padding:0;box-sizing:border-box;overflow:hidden;background:#17110c;}',
      'body.tm-phase8-home .gc > :not(#tm-phase8-main-shell){display:none!important;}',
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
      'body.tm-phase8-formal .map-layer-bar{position:static;display:flex;flex-wrap:wrap;gap:6px;margin:0 0 8px;}body.tm-phase8-formal .map-layer,body.tm-phase8-formal .mnp-row button{padding:5px 9px;border:1px solid rgba(184,154,83,.28);background:rgba(18,16,14,.54);color:#d8c27c;cursor:pointer;font:12px/1 "STKaiti","KaiTi","楷体",serif;letter-spacing:.12em;}body.tm-phase8-formal .map-layer.on,body.tm-phase8-formal .mnp-row button.on{border-color:#e5c875;color:#f2da91;background:rgba(72,46,20,.72);}body.tm-phase8-formal .map-nav-panel{padding:0;background:transparent;border:0;box-shadow:none;color:#b9aa8a;}body.tm-phase8-formal .mnp-title{color:#8dbdab;font-size:11px;letter-spacing:.18em;margin-bottom:6px;}body.tm-phase8-formal .mnp-row{display:flex;gap:6px;}body.tm-phase8-formal .mnp-note{margin-top:7px;font-size:11px;line-height:1.45;color:#8f846f;}',
      'body.tm-phase8-formal .map-alert-strip{position:absolute;left:320px;top:20px;z-index:58;display:flex;gap:7px;}body.tm-phase8-formal .map-alert{border:1px solid rgba(214,188,116,.34);background:rgba(29,22,15,.68);color:#d8c27c;font:12px/1 "STKaiti","KaiTi","楷体",serif;letter-spacing:.12em;padding:6px 10px;cursor:pointer;}body.tm-phase8-formal .map-alert.hot{color:#e5a28e;border-color:rgba(198,91,61,.55);}body.tm-phase8-formal .map-alert.ok{color:#a8d4c5;border-color:rgba(126,184,167,.45);}',
      'body.tm-phase8-formal .map-legend{position:absolute;right:118px;bottom:92px;top:auto;z-index:58;min-width:268px;padding:8px 10px 9px;background:linear-gradient(180deg,rgba(36,30,24,.76),rgba(18,16,14,.62));border:1px solid rgba(184,154,83,.24);border-left:2px solid rgba(126,184,167,.55);box-shadow:0 8px 20px rgba(0,0,0,.34);}',
      'body.tm-phase8-formal .map-hint{position:absolute;left:320px;bottom:92px;z-index:55;color:rgba(229,211,164,.72);font:12px/1.4 "STSong","SimSun",serif;letter-spacing:.08em;text-shadow:0 2px 6px #000;}',
      'body.tm-phase8-formal .map-search-row{display:flex;gap:6px;align-items:center;}body.tm-phase8-formal .map-search-label{color:#8dbdab;font:11px/1 "STKaiti","KaiTi","楷体",serif;letter-spacing:.18em;white-space:nowrap;}body.tm-phase8-formal .map-search{width:100%;height:24px;padding:0 8px;border:1px solid rgba(214,188,116,.28);border-radius:2px;background:rgba(8,7,6,.48);color:#e6d7ad;font:12px/1 "STSong","SimSun",serif;outline:none;}body.tm-phase8-formal .map-search:focus{border-color:#d6bc74;box-shadow:0 0 0 1px rgba(214,188,116,.16);}',
      'body.tm-phase8-formal .map-search-results{margin-top:7px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px;}body.tm-phase8-formal .map-search-results button{min-width:0;padding:4px 6px;border:1px solid rgba(214,188,116,.18);border-radius:2px;background:rgba(18,16,14,.48);color:#d9c893;cursor:pointer;font:11px/1.2 "STKaiti","KaiTi","楷体",serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:left;}body.tm-phase8-formal .map-search-results button:hover{color:#f0d98c;border-color:rgba(214,188,116,.45);}body.tm-phase8-formal .map-search-results b{display:block;overflow:hidden;text-overflow:ellipsis;font-weight:500;}body.tm-phase8-formal .map-search-results span{display:block;margin-top:2px;color:#8dbdab;font-size:10px;overflow:hidden;text-overflow:ellipsis;}',
      'body.tm-phase8-formal .map-legend-title{display:flex;justify-content:space-between;gap:12px;align-items:center;color:#f0d98c;font:12px/1 "STKaiti","KaiTi","楷体",serif;letter-spacing:.18em;}body.tm-phase8-formal .map-legend-mode{display:inline-flex;align-items:center;gap:6px;min-width:0;}body.tm-phase8-formal .map-legend-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}body.tm-phase8-formal .map-legend-sub{color:#9d927c;font-size:10px;letter-spacing:.08em;white-space:nowrap;}body.tm-phase8-formal .map-legend-mark{width:8px;height:8px;border-radius:50%;background:#d6b465;box-shadow:0 0 10px rgba(214,180,101,.5);}',
      'body.tm-phase8-formal .map-legend-main{margin-top:7px;}body.tm-phase8-formal .map-legend-bar{height:8px;border:1px solid rgba(0,0,0,.40);background:linear-gradient(90deg,#4f8d74,#d6b465,#b94534);box-shadow:inset 0 1px 0 rgba(255,255,255,.15);}body.tm-phase8-formal .map-legend-scale{margin-top:4px;display:flex;justify-content:space-between;color:#b9aa8a;font-size:10px;letter-spacing:.08em;}body.tm-phase8-formal .map-legend-detail{margin-top:7px;padding-top:7px;border-top:1px solid rgba(184,154,83,.16);}body.tm-phase8-formal .map-legend-note{margin:0;color:rgba(218,205,166,.58);font-size:10.5px;line-height:1.45;}',
      'body.tm-phase8-formal .map-owner-row{margin-top:7px;display:flex;align-items:center;justify-content:space-between;gap:8px;color:#b9aa8a;font-size:10.5px;}body.tm-phase8-formal .map-owner-swatch{display:inline-flex;align-items:center;gap:5px;margin-right:8px;white-space:nowrap;}body.tm-phase8-formal .map-owner-swatch i{width:10px;height:10px;border:1px solid rgba(255,240,180,.42);box-shadow:0 0 0 1px rgba(0,0,0,.35);}',
      'body.tm-phase8-formal .tmf-map-legend{right:118px;bottom:92px;width:auto;min-width:268px;z-index:58;}body.tm-phase8-formal .map-hint{left:50%;bottom:10px;transform:translateX(-50%);z-index:59;padding:6px 16px;background:linear-gradient(180deg,rgba(36,30,24,.85),rgba(18,16,14,.85));border:1px solid rgba(184,154,83,.26);border-radius:14px;color:#b9aa8a;font-size:11px;letter-spacing:.12em;text-shadow:none;}',
      'body.tm-phase8-formal .map-scale-strip{position:absolute;left:50%;top:54px;transform:translateX(-50%);z-index:58;display:flex;gap:4px;padding:3px;background:rgba(18,16,14,.56);border:1px solid rgba(184,154,83,.22);box-shadow:0 5px 14px rgba(0,0,0,.32);pointer-events:auto;}body.tm-phase8-formal .map-scale{min-width:48px;padding:4px 8px;border:1px solid transparent;border-radius:2px;color:#b9aa8a;background:transparent;cursor:pointer;font:11px/1 "STKaiti","KaiTi","楷体",serif;letter-spacing:.16em;}body.tm-phase8-formal .map-scale.on,body.tm-phase8-formal .map-scale[aria-pressed="true"]{color:#f0d98c;border-color:rgba(214,188,116,.45);background:rgba(184,154,83,.14);}',
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
      '.tmf-map-stage.zoomed .tmf-region-label{font-size:11px;letter-spacing:.04em;}',
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
      '.tmf-map-dossier{position:absolute;left:9.5%;top:9%;bottom:8%;width:min(820px,66vw);z-index:30;background:linear-gradient(180deg,rgba(28,22,16,.96),rgba(10,8,6,.97));border:1px solid rgba(201,168,95,.48);box-shadow:0 18px 58px rgba(0,0,0,.72),inset 0 0 0 1px rgba(0,0,0,.40);display:flex;flex-direction:column;}',
      '.tmf-map-dossier header{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;padding:16px 18px;border-bottom:1px solid rgba(201,168,95,.22);}.tmf-map-dossier header span{font-size:12px;color:#8dbdab;letter-spacing:.18em;}.tmf-map-dossier h3{margin:4px 0 0;color:#f0d98c;font-size:28px;letter-spacing:.20em;font-weight:500;}.tmf-map-dossier header p{margin:6px 0 0;color:#aa9c7e;font-size:13px;}.tmf-map-dossier header button{width:30px;height:30px;border:1px solid rgba(201,168,95,.28);background:rgba(255,255,255,.04);color:#d8c27c;cursor:pointer;}',
      '.tmf-map-dossier main{padding:16px 18px;overflow-y:auto;scrollbar-width:thin;scrollbar-color:rgba(201,168,95,.50) transparent;}.tmf-dossier-hero{display:grid;grid-template-columns:116px 1fr;gap:15px;align-items:stretch;margin-bottom:14px;padding:13px;border:1px solid rgba(184,154,83,.20);background:linear-gradient(90deg,rgba(201,168,95,.08),rgba(255,255,255,.02));}.tmf-map-seal{height:116px;border:1px solid rgba(201,168,95,.42);display:flex;align-items:center;justify-content:center;font-size:54px;color:#d7be73;background:radial-gradient(circle,rgba(201,168,95,.18),rgba(0,0,0,.18));}.tmf-map-seal.faction{background:radial-gradient(circle,var(--seal),rgba(0,0,0,.30));color:#fff1bc;font-size:36px;}',
      '.tmf-dossier-hero b{display:block;color:#ecd58e;font-size:20px;letter-spacing:.14em;}.tmf-dossier-hero span{display:block;margin-top:5px;color:#8dbdab;}.tmf-dossier-hero p{margin:10px 0 0;color:#c2b28f;line-height:1.7;font-size:14px;}',
      '.tmf-map-dossier h4{margin:18px 0 9px;color:#d7be73;font-size:16px;letter-spacing:.22em;font-weight:500;border-bottom:1px solid rgba(184,154,83,.18);padding-bottom:7px;}.tmf-dossier-rows{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;}.tmf-dossier-rows div{min-height:48px;background:rgba(255,255,255,.025);border:1px solid rgba(184,154,83,.14);padding:7px 8px;}.tmf-dossier-rows span{display:block;color:#8f846f;font-size:12px;}.tmf-dossier-rows b{display:block;margin-top:4px;color:#e4d4a8;font-size:15px;line-height:1.35;}',
      '.tmf-region-links{display:flex;flex-wrap:wrap;gap:6px;}.tmf-region-links button{border:1px solid rgba(184,154,83,.22);background:rgba(184,154,83,.06);color:#d8c27c;font-family:inherit;padding:5px 9px;cursor:pointer;}',
      '.tmf-map-dossier footer{display:flex;gap:8px;justify-content:flex-end;padding:12px 16px;border-top:1px solid rgba(201,168,95,.18);}.tmf-map-dossier footer button{border:1px solid rgba(184,154,83,.32);background:rgba(184,154,83,.08);color:#e6cf8e;font-family:inherit;padding:7px 12px;cursor:pointer;}',
      'body.tm-phase8-formal #mapwrap .map-alert-strip{display:flex!important;left:50%!important;top:18px!important;transform:translateX(-50%)!important;gap:7px!important;z-index:68!important;}body.tm-phase8-formal #mapwrap .map-alert{max-width:128px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}body.tm-phase8-formal.province-panel-open .renwu-tuzhi-entry,body.tm-phase8-formal.province-panel-open .map-tools-dock{opacity:0!important;pointer-events:none!important;transition:opacity .12s ease;}',
      'body.tm-phase8-formal #ppop.tmf-map-ppop{position:fixed;display:none;left:24px;top:74px;right:auto;bottom:auto;z-index:130;width:min(760px,calc(100vw - 112px));max-height:calc(100vh - 124px);overflow-y:auto;overflow-x:hidden;padding:38px 52px 42px;box-sizing:border-box;background:radial-gradient(ellipse at 50% 0,rgba(255,240,190,.82),rgba(238,210,144,.92) 38%,rgba(202,160,86,.88) 100%),repeating-linear-gradient(90deg,rgba(120,78,28,.08) 0 1px,transparent 1px 30px);border:1px solid rgba(116,83,36,.45);box-shadow:inset 0 0 0 1px rgba(255,246,205,.35),inset 0 0 36px rgba(90,54,20,.22);color:#1c130b;font-family:"STKaiti","KaiTi","SimSun",serif;filter:drop-shadow(0 22px 36px rgba(0,0,0,.48));scrollbar-width:thin;scrollbar-color:rgba(116,83,36,.55) rgba(0,0,0,.10);}body.tm-phase8-formal #ppop.tmf-map-ppop.show{display:block;}body.tm-phase8-formal #ppop.tmf-map-ppop.faction-panel{width:min(830px,calc(100vw - 112px));background:radial-gradient(ellipse at 50% 0,rgba(232,238,198,.86),rgba(218,207,145,.92) 40%,rgba(160,138,82,.88) 100%),repeating-linear-gradient(90deg,rgba(43,91,81,.08) 0 1px,transparent 1px 30px);}',
      'body.tm-phase8-formal #ppop.tmf-map-ppop .pp-top{position:sticky;top:-38px;z-index:3;display:grid;grid-template-columns:50px minmax(0,1fr) auto 28px;gap:9px;align-items:center;padding:8px 8px 10px;border-bottom:1px solid rgba(140,98,38,.40);background:linear-gradient(180deg,rgba(36,24,13,.92),rgba(23,16,10,.78));box-shadow:0 6px 16px rgba(50,28,11,.18);}body.tm-phase8-formal #ppop.tmf-map-ppop .pp-crest{width:42px;height:46px;border-radius:8px 8px 13px 13px;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at 35% 25%,rgba(255,232,170,.30),transparent 46%),linear-gradient(180deg,rgba(144,41,31,.88),rgba(63,25,16,.94));border:1px solid rgba(214,188,116,.42);color:#f5df9b;font-size:20px;box-shadow:inset 0 1px 0 rgba(255,255,255,.10);}body.tm-phase8-formal #ppop.tmf-map-ppop.faction-panel .pp-crest{background:radial-gradient(circle at 35% 25%,rgba(210,247,232,.22),transparent 46%),linear-gradient(180deg,rgba(42,74,71,.92),rgba(25,23,18,.94));}',
      'body.tm-phase8-formal #ppop.tmf-map-ppop .pp-name{color:#f1d891;font-size:22px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}body.tm-phase8-formal #ppop.tmf-map-ppop .pp-level{margin-top:3px;color:rgba(239,218,166,.72);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}body.tm-phase8-formal #ppop.tmf-map-ppop .pp-top-mark{border:1px solid rgba(214,188,116,.25);padding:6px 8px;background:rgba(0,0,0,.22);color:#e0c882;font-size:10px;white-space:nowrap;}body.tm-phase8-formal #ppop.tmf-map-ppop .pp-close{width:28px;height:28px;border:1px solid rgba(214,188,116,.34);background:rgba(0,0,0,.30);color:#efd58c;cursor:pointer;font-size:18px;line-height:1;}',
      'body.tm-phase8-formal #ppop.tmf-map-ppop .pp-tabs{position:sticky;top:26px;z-index:2;display:grid;grid-template-columns:repeat(6,1fr);margin:0 0 8px;border-top:1px solid rgba(214,188,116,.28);border-bottom:1px solid rgba(214,188,116,.28);background:linear-gradient(180deg,rgba(21,15,10,.86),rgba(36,24,13,.72));}body.tm-phase8-formal #ppop.tmf-map-ppop.faction-panel .pp-tabs{grid-template-columns:repeat(6,1fr);background:linear-gradient(180deg,rgba(12,25,24,.88),rgba(9,12,11,.74));border-color:rgba(126,184,167,.25);}body.tm-phase8-formal #ppop.tmf-map-ppop .pp-tab{height:34px;border:0;border-left:1px solid rgba(214,188,116,.12);background:transparent;color:rgba(239,218,166,.74);font:12px/1 "STKaiti","KaiTi","SimSun",serif;cursor:pointer;}body.tm-phase8-formal #ppop.tmf-map-ppop .pp-tab:first-child{border-left:0;}body.tm-phase8-formal #ppop.tmf-map-ppop .pp-tab.active{color:#fff0b8;background:radial-gradient(ellipse at 50% 100%,rgba(245,217,149,.22),transparent 68%),linear-gradient(180deg,rgba(184,154,83,.14),transparent);}',
      'body.tm-phase8-formal #ppop.tmf-map-ppop .pp-tab-body{margin-bottom:8px;padding:8px;border:1px solid rgba(214,188,116,.22);background:linear-gradient(180deg,rgba(18,14,9,.64),rgba(18,14,9,.32));}body.tm-phase8-formal #ppop.tmf-map-ppop .pp-tab-body + .pp-tab-body{display:none;}body.tm-phase8-formal #ppop.tmf-map-ppop .pp-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding:0;}body.tm-phase8-formal #ppop.tmf-map-ppop .wide{grid-column:1/-1;}body.tm-phase8-formal #ppop.tmf-map-ppop .pp-admin-brief,body.tm-phase8-formal #ppop.tmf-map-ppop .pp-faction-hero{display:grid;grid-template-columns:58px 1fr;gap:10px;align-items:stretch;padding:12px;border:1px solid rgba(214,188,116,.28);background:linear-gradient(180deg,rgba(248,234,190,.94),rgba(229,205,145,.82));}body.tm-phase8-formal #ppop.tmf-map-ppop .pp-admin-seal{display:flex;align-items:center;justify-content:center;border:1px solid rgba(95,63,23,.38);background:rgba(180,142,65,.22);color:#6b431b;font-size:28px;}',
      'body.tm-phase8-formal #ppop.tmf-map-ppop .pp-admin-brief b,body.tm-phase8-formal #ppop.tmf-map-ppop .pp-faction-hero b{display:block;color:#17100a;font-size:17px;font-weight:600;margin-bottom:6px;}body.tm-phase8-formal #ppop.tmf-map-ppop .pp-admin-desc,body.tm-phase8-formal #ppop.tmf-map-ppop .pp-faction-desc{margin:0;padding:8px 10px;background:rgba(255,244,205,.72);border-left:3px solid rgba(96,59,20,.48);color:#17100a;font:13.5px/1.72 "STSong","SimSun",serif;}body.tm-phase8-formal #ppop.tmf-map-ppop.faction-panel .pp-faction-desc{background:rgba(230,235,205,.76);border-left-color:rgba(43,91,81,.50);}',
      'body.tm-phase8-formal #ppop.tmf-map-ppop .pp-admin-brief.wide,body.tm-phase8-formal #ppop.tmf-map-ppop .pp-faction-hero.wide{display:grid!important;grid-template-columns:72px minmax(0,1fr)!important;min-width:0;}body.tm-phase8-formal #ppop.tmf-map-ppop .pp-admin-brief>.pp-admin-head,body.tm-phase8-formal #ppop.tmf-map-ppop .pp-faction-hero>.pp-faction-head{grid-column:1/-1;width:100%;min-width:0;}body.tm-phase8-formal #ppop.tmf-map-ppop .pp-admin-head>div,body.tm-phase8-formal #ppop.tmf-map-ppop .pp-faction-head>div{min-width:0;}body.tm-phase8-formal #ppop.tmf-map-ppop .pp-admin-title,body.tm-phase8-formal #ppop.tmf-map-ppop .pp-faction-title{min-width:0;flex-wrap:wrap;}body.tm-phase8-formal #ppop.tmf-map-ppop .pp-admin-title span,body.tm-phase8-formal #ppop.tmf-map-ppop .pp-faction-title span{min-width:0;white-space:normal;overflow-wrap:anywhere;}body.tm-phase8-formal #ppop.tmf-map-ppop .pp-admin-desc,body.tm-phase8-formal #ppop.tmf-map-ppop .pp-faction-desc{max-width:100%;box-sizing:border-box;}',
      'body.tm-phase8-formal #ppop.tmf-map-ppop .pp-mode-banner{display:grid;grid-template-columns:76px 1fr minmax(82px,auto);gap:8px;align-items:center;padding:8px 10px;border:1px solid rgba(184,154,83,.30);background:linear-gradient(180deg,rgba(248,234,190,.92),rgba(229,205,145,.80));}body.tm-phase8-formal #ppop.tmf-map-ppop .pp-mode-seal{height:54px;display:flex;align-items:center;justify-content:center;border:1px solid rgba(95,63,23,.38);background:rgba(180,142,65,.22);color:#6b431b;font-size:24px;}body.tm-phase8-formal #ppop.tmf-map-ppop .pp-mode-title{color:#6b431b;font-size:15px;font-weight:600;}body.tm-phase8-formal #ppop.tmf-map-ppop .pp-mode-note{margin-top:4px;color:#2a1b10;font:12.5px/1.55 "STSong","SimSun",serif;}body.tm-phase8-formal #ppop.tmf-map-ppop .pp-mode-score{text-align:right;color:#2a1b10;}body.tm-phase8-formal #ppop.tmf-map-ppop .pp-mode-score span{display:block;font-size:11px;color:#6b431b;}body.tm-phase8-formal #ppop.tmf-map-ppop .pp-mode-score b{display:block;max-width:150px;color:#17100a;font-size:17px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      'body.tm-phase8-formal #ppop.tmf-map-ppop .pp-dev-triplet{grid-column:1/-1;display:grid;grid-template-columns:repeat(3,1fr);gap:8px;}body.tm-phase8-formal #ppop.tmf-map-ppop .pp-dev-chip{display:grid;grid-template-columns:34px 1fr auto;grid-template-rows:auto auto;gap:2px 8px;padding:9px;border:1px solid rgba(95,63,23,.28);background:linear-gradient(180deg,rgba(248,234,190,.94),rgba(229,205,145,.82));color:#17100a;}body.tm-phase8-formal #ppop.tmf-map-ppop .pp-dev-chip i{grid-row:1/3;display:flex;align-items:center;justify-content:center;border:1px solid rgba(95,63,23,.34);background:rgba(180,142,65,.22);font-style:normal;color:#6b431b;}body.tm-phase8-formal #ppop.tmf-map-ppop .pp-dev-chip b{font-size:18px;color:#17100a;}body.tm-phase8-formal #ppop.tmf-map-ppop .pp-dev-chip span{font-size:12px;color:#2a1b10;}body.tm-phase8-formal #ppop.tmf-map-ppop .pp-dev-chip em{font-style:normal;font-size:11px;color:#6b431b;}',
      'body.tm-phase8-formal #ppop.tmf-map-ppop .pp-seal-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:7px;}body.tm-phase8-formal #ppop.tmf-map-ppop .pp-status-seal{min-height:72px;padding:8px 5px;border:1px solid rgba(95,63,23,.28);background:linear-gradient(180deg,rgba(248,234,190,.94),rgba(229,205,145,.82));color:#17100a;cursor:pointer;font-family:inherit;text-align:center;}body.tm-phase8-formal #ppop.tmf-map-ppop .pp-status-seal.active{outline:2px solid rgba(144,41,31,.46);outline-offset:-3px;}body.tm-phase8-formal #ppop.tmf-map-ppop .pp-status-k{display:block;color:#6b431b;font-size:12px;}body.tm-phase8-formal #ppop.tmf-map-ppop .pp-status-v{display:block;color:#17100a;font-size:18px;margin:4px 0;}body.tm-phase8-formal #ppop.tmf-map-ppop .pp-status-note{display:block;color:#2a1b10;font-style:normal;font-size:11px;}',
      'body.tm-phase8-formal #ppop.tmf-map-ppop .pp-zone{padding:10px;border:1px solid rgba(95,63,23,.26);background:linear-gradient(180deg,rgba(248,234,190,.94),rgba(229,205,145,.82));color:#17100a;}body.tm-phase8-formal #ppop.tmf-map-ppop .pp-zt{margin-bottom:8px;color:#6b431b;font-size:14px;font-weight:600;}body.tm-phase8-formal #ppop.tmf-map-ppop .pp-zr{display:grid;grid-template-columns:82px minmax(0,1fr);gap:8px;align-items:start;padding:5px 0;border-top:1px solid rgba(95,63,23,.12);}body.tm-phase8-formal #ppop.tmf-map-ppop .pp-zr:first-of-type{border-top:0;}body.tm-phase8-formal #ppop.tmf-map-ppop .pp-zk{color:#6b431b;font-size:12px;}body.tm-phase8-formal #ppop.tmf-map-ppop .pp-zv{min-width:0;color:#17100a;font:13.5px/1.5 "STSong","SimSun",serif;overflow-wrap:anywhere;}',
      'body.tm-phase8-formal #ppop.tmf-map-ppop .pp-admin-head,body.tm-phase8-formal #ppop.tmf-map-ppop .pp-faction-head{display:grid;grid-template-columns:72px 1fr;gap:10px;align-items:stretch;}body.tm-phase8-formal #ppop.tmf-map-ppop .pp-admin-seal,body.tm-phase8-formal #ppop.tmf-map-ppop .pp-faction-seal{display:flex;flex-direction:column;align-items:center;justify-content:center;border:1px solid rgba(95,63,23,.38);background:rgba(180,142,65,.22);color:#6b431b;min-height:72px;}body.tm-phase8-formal #ppop.tmf-map-ppop .pp-admin-seal b,body.tm-phase8-formal #ppop.tmf-map-ppop .pp-faction-seal b{font-size:28px;line-height:1;}body.tm-phase8-formal #ppop.tmf-map-ppop .pp-admin-seal span,body.tm-phase8-formal #ppop.tmf-map-ppop .pp-faction-seal span{margin-top:6px;font-size:10px;color:#7b5428;}',
      'body.tm-phase8-formal #ppop.tmf-map-ppop .pp-admin-title,body.tm-phase8-formal #ppop.tmf-map-ppop .pp-faction-title{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:6px;}body.tm-phase8-formal #ppop.tmf-map-ppop .pp-admin-title span,body.tm-phase8-formal #ppop.tmf-map-ppop .pp-faction-title span{color:#17100a;font-size:18px;font-weight:700;}body.tm-phase8-formal #ppop.tmf-map-ppop .pp-admin-title small,body.tm-phase8-formal #ppop.tmf-map-ppop .pp-faction-title small{color:#7b5428;font-size:10px;white-space:nowrap;}body.tm-phase8-formal #ppop.tmf-map-ppop .pp-badge-row{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px;}body.tm-phase8-formal #ppop.tmf-map-ppop .pp-badge-row span{padding:3px 6px;border:1px solid rgba(95,63,23,.22);background:rgba(255,246,210,.55);color:#6b431b;font-size:11px;}body.tm-phase8-formal #ppop.tmf-map-ppop .pp-badge-row .good{border-color:rgba(63,108,86,.32);color:#315942;}',
      'body.tm-phase8-formal #ppop.tmf-map-ppop .pp-ledger-grid{grid-column:1/-1;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;}body.tm-phase8-formal #ppop.tmf-map-ppop .pp-ledger-card{min-height:58px;padding:8px;border:1px solid rgba(95,63,23,.22);background:linear-gradient(180deg,rgba(255,247,211,.90),rgba(229,205,145,.76));color:#17100a;}body.tm-phase8-formal #ppop.tmf-map-ppop .pp-ledger-card span{display:block;color:#6b431b;font-size:11px;}body.tm-phase8-formal #ppop.tmf-map-ppop .pp-ledger-card b{display:block;margin-top:3px;font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}body.tm-phase8-formal #ppop.tmf-map-ppop .pp-ledger-card small{display:block;margin-top:3px;color:#7b5428;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      'body.tm-phase8-formal #ppop.tmf-map-ppop .pp-id-chain{grid-column:1/-1;display:grid;grid-template-columns:repeat(3,1fr);gap:6px;}body.tm-phase8-formal #ppop.tmf-map-ppop .pp-chain-item{padding:7px 9px;border:1px solid rgba(95,63,23,.20);background:rgba(255,246,210,.46);}body.tm-phase8-formal #ppop.tmf-map-ppop .pp-chain-k{color:#7b5428;font-size:10px;}body.tm-phase8-formal #ppop.tmf-map-ppop .pp-chain-v{margin-top:3px;color:#17100a;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      'body.tm-phase8-formal #ppop.tmf-map-ppop .pp-facilities{grid-column:1/-1;}body.tm-phase8-formal #ppop.tmf-map-ppop .pp-facility-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;}body.tm-phase8-formal #ppop.tmf-map-ppop .pp-facility{padding:6px;border:1px solid rgba(95,63,23,.16);background:rgba(255,246,210,.42);}body.tm-phase8-formal #ppop.tmf-map-ppop .pp-facility span{display:block;color:#7b5428;font-size:10px;}body.tm-phase8-formal #ppop.tmf-map-ppop .pp-facility b{display:block;margin-top:2px;color:#17100a;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      'body.tm-phase8-formal #ppop.tmf-map-ppop .pp-field-chips{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:6px;}body.tm-phase8-formal #ppop.tmf-map-ppop .pp-field-chip{display:inline-flex;gap:5px;align-items:center;max-width:100%;padding:5px 7px;border:1px solid rgba(95,63,23,.20);background:rgba(255,246,210,.48);color:#17100a;font-size:12px;overflow:hidden;}body.tm-phase8-formal #ppop.tmf-map-ppop .pp-field-chip b{color:#7b5428;font-weight:600;white-space:nowrap;}body.tm-phase8-formal #ppop.tmf-map-ppop .pp-faction-portrait-row{grid-column:1/-1;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;}body.tm-phase8-formal #ppop.tmf-map-ppop .pp-faction-person{padding:8px 9px;border:1px solid rgba(72,103,89,.24);background:rgba(230,238,208,.50);color:#17100a;}body.tm-phase8-formal #ppop.tmf-map-ppop .pp-faction-person b{display:block;color:#23483d;font-size:13px;margin-bottom:4px;}body.tm-phase8-formal #ppop.tmf-map-ppop .pp-faction-person span{display:block;color:#2a1b10;font:12px/1.55 "STSong","SimSun",serif;}body.tm-phase8-formal #ppop.tmf-map-ppop .pp-section-strip{grid-column:1/-1;display:flex;align-items:center;gap:9px;color:#6b431b;font:12px/1 "STKaiti","KaiTi",serif;letter-spacing:.22em;}body.tm-phase8-formal #ppop.tmf-map-ppop .pp-section-strip:before,body.tm-phase8-formal #ppop.tmf-map-ppop .pp-section-strip:after{content:"";height:1px;flex:1;background:linear-gradient(to right,transparent,rgba(95,63,23,.32),transparent);}',
      'body.tm-phase8-formal #ppop.tmf-map-ppop .pp-table-list{grid-column:1/-1;max-height:210px;overflow:auto;border:1px solid rgba(95,63,23,.22);background:rgba(255,246,210,.32);}body.tm-phase8-formal #ppop.tmf-map-ppop .pp-table-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(90px,auto);gap:8px;align-items:center;padding:7px 9px;border-top:1px solid rgba(95,63,23,.12);}body.tm-phase8-formal #ppop.tmf-map-ppop .pp-table-row:first-child{border-top:0;}body.tm-phase8-formal #ppop.tmf-map-ppop .pp-table-row b{display:block;color:#17100a;font-size:13px;}body.tm-phase8-formal #ppop.tmf-map-ppop .pp-table-row span{display:block;margin-top:2px;color:#7b5428;font-size:11px;overflow-wrap:anywhere;}body.tm-phase8-formal #ppop.tmf-map-ppop .pp-table-row em{color:#17100a;font-style:normal;text-align:right;font-size:12px;overflow-wrap:anywhere;}',
      'body.tm-phase8-formal #ppop.tmf-map-ppop .pp-action-row{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;}body.tm-phase8-formal #ppop.tmf-map-ppop .pp-action{padding:8px 6px;border:1px solid rgba(96,59,20,.34);border-radius:2px;background:linear-gradient(180deg,rgba(70,38,18,.58),rgba(28,18,10,.54));color:#f1d891;cursor:pointer;font:12px/1 "STKaiti","KaiTi","SimSun",serif;}body.tm-phase8-formal #ppop.tmf-map-ppop .pp-action:hover{border-color:rgba(144,41,31,.56);background:linear-gradient(180deg,rgba(105,53,24,.68),rgba(45,25,13,.64));}body.tm-phase8-formal #ppop.tmf-map-ppop .tmf-region-links{display:flex;flex-wrap:wrap;gap:6px;}body.tm-phase8-formal #ppop.tmf-map-ppop .tmf-region-links button,body.tm-phase8-formal #ppop.tmf-map-ppop .tmf-region-links span{border:1px solid rgba(95,63,23,.25);background:rgba(255,246,210,.58);color:#17100a;padding:5px 8px;font-family:inherit;cursor:pointer;}',
      '#tm-phase8-home-return{position:absolute;left:18px;top:14px;z-index:80;display:none;border:1px solid rgba(201,168,95,.42);background:linear-gradient(180deg,rgba(44,34,22,.95),rgba(12,9,7,.95));color:#f0d98c;font-family:"STKaiti","KaiTi","楷体",serif;padding:7px 13px;letter-spacing:.16em;cursor:pointer;}',
      'body.tm-phase8-legacy #tm-phase8-home-return{display:block;}',
      '#tm-phase8-formal-rail{position:absolute;right:7px;top:10px;display:flex;flex-direction:column;gap:6px;align-items:center;z-index:42;pointer-events:auto;}',
      '.tmf-rail-cap{writing-mode:vertical-rl;color:#9b8758;font-size:11px;letter-spacing:.18em;margin:0 0 2px;}',
      '.tmf-rail-btn{width:42px;height:48px;position:relative;border:1px solid rgba(184,154,83,.28);border-radius:0;background:linear-gradient(180deg,rgba(26,21,16,.92),rgba(8,7,6,.94));color:#d5bf7b;font-family:"STKaiti","KaiTi","楷体",serif;font-size:18px;letter-spacing:.12em;cursor:pointer;box-shadow:inset 0 0 0 1px rgba(0,0,0,.45),0 5px 12px rgba(0,0,0,.28);}',
      '.tmf-rail-btn span:first-child{display:block;transform:translateX(.04em);}.tmf-rail-btn:hover,.tmf-rail-btn.active{border-color:#d4be7a;color:#f0dc98;background:radial-gradient(circle at 50% 18%,rgba(201,168,95,.22),transparent 48%),linear-gradient(180deg,rgba(47,35,22,.94),rgba(12,9,7,.96));}.tmf-rail-btn.hot{color:#e4a28d;border-color:rgba(192,64,48,.45);}.tmf-rail-btn.ok{color:#a8d4c5;border-color:rgba(126,184,167,.42);}',
      '.tmf-rail-count{position:absolute;right:-5px;top:-5px;min-width:17px;height:17px;padding:0 4px;border-radius:9px;background:rgba(124,35,25,.96);border:1px solid rgba(232,160,125,.75);color:#f4eadd;font-size:11px;line-height:16px;text-align:center;letter-spacing:0;font-family:serif;}',
      '#tm-phase8-formal-panel{width:100%;min-height:100%;}.tmf-panel{display:flex;flex-direction:column;gap:10px;font-family:"STKaiti","KaiTi","楷体",serif;color:#eee0bd;}.tmf-card{border:1px solid rgba(184,154,83,.26);border-left:3px solid rgba(184,154,83,.65);background:linear-gradient(180deg,rgba(33,27,20,.84),rgba(13,11,9,.88));padding:11px 12px;box-shadow:inset 0 0 0 1px rgba(0,0,0,.28);}.tmf-card.empty{border-left-color:rgba(126,184,167,.68);}',
      '.tmf-card-title{display:flex;align-items:center;justify-content:space-between;margin-bottom:9px;color:#d7be73;font-size:17px;letter-spacing:.18em;border-bottom:1px dashed rgba(184,154,83,.22);padding-bottom:5px;}.tmf-card-title small{font-size:12px;color:#9d917d;letter-spacing:.08em;}.tmf-note,.tmf-card p{font-size:14px;line-height:1.7;color:#b9aa8a;margin:6px 0 8px;}',
      '.tmf-primary,.tmf-action,.tmf-person-actions button{font-family:inherit;cursor:pointer;border:1px solid rgba(184,154,83,.32);background:rgba(184,154,83,.08);color:#d8c27c;}.tmf-top-actions{display:grid;grid-template-columns:1fr;gap:7px;}.tmf-action{display:flex;flex-direction:column;align-items:flex-start;gap:2px;text-align:left;padding:9px 10px;}.tmf-action.main{border-color:rgba(126,184,167,.48);color:#bde6d9;background:linear-gradient(90deg,rgba(126,184,167,.10),rgba(184,154,83,.05));}.tmf-action:hover,.tmf-person-actions button:hover{border-color:#d4be7a;color:#f3df9d;background:rgba(184,154,83,.15);}.tmf-action b{font-size:15px;letter-spacing:.12em;}.tmf-action span{font-size:12px;color:#a99d83;line-height:1.5;}',
      '.tmf-minirows{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:6px 0 8px;}.tmf-minirows div{background:rgba(255,255,255,.025);border:1px solid rgba(184,154,83,.14);padding:5px 6px;}.tmf-minirows span{display:block;color:#8f846f;font-size:12px;}.tmf-minirows b{font-size:15px;color:#e4d4a8;}',
      '.tmf-person-list{display:flex;flex-direction:column;gap:9px;}.tmf-person-card{display:flex;gap:9px;border:1px solid rgba(126,184,167,.26);background:rgba(126,184,167,.05);padding:8px;}.tmf-avatar{width:48px;height:58px;border:1px solid rgba(201,168,95,.34);display:flex;align-items:center;justify-content:center;background:#19120d;color:#d4be7a;font-size:24px;flex-shrink:0;overflow:hidden;}.tmf-avatar img{width:100%;height:100%;object-fit:cover;}.tmf-person-main{flex:1;min-width:0;}.tmf-person-head{display:flex;justify-content:space-between;gap:8px;align-items:baseline;margin-bottom:4px;}.tmf-person-head b{font-size:17px;color:#f0dc98;}.tmf-person-head span{font-size:12px;color:#a8d4c5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}.tmf-person-actions{display:flex;flex-wrap:wrap;gap:4px;margin-top:7px;}.tmf-person-actions button{font-size:12px;padding:3px 7px;}.tmf-person-actions button.danger{color:#d4706a;border-color:rgba(192,64,48,.40);background:rgba(192,64,48,.08);}',
      'body.tm-phase8-formal #tm-phase8-formal-panel .tmrp{font-family:"STKaiti","KaiTi","楷体",serif;color:#eadfbd;display:flex;flex-direction:column;gap:10px;}body.tm-phase8-formal #tm-phase8-formal-panel .tmf-card{border:1px solid rgba(204,164,76,.22);border-left:3px solid rgba(204,164,76,.38);background:linear-gradient(180deg,rgba(35,27,18,.82),rgba(15,12,9,.84));box-shadow:inset 0 1px rgba(255,236,174,.05);padding:10px;position:relative;}body.tm-phase8-formal #tm-phase8-formal-panel .tmf-card.empty{border-left-color:rgba(112,176,151,.52);}',
      'body.tm-phase8-formal #tm-phase8-formal-panel .tmf-card-title{display:flex;justify-content:space-between;gap:8px;align-items:flex-start;color:#f2d98d;font-size:15px;letter-spacing:.08em;border:0;margin:0 0 8px;padding:0;}body.tm-phase8-formal #tm-phase8-formal-panel .tmf-card-title small{color:rgba(225,210,169,.58);font-size:11px;letter-spacing:.04em;font-weight:400;}body.tm-phase8-formal #tm-phase8-formal-panel .tmf-note,body.tm-phase8-formal #tm-phase8-formal-panel .tmf-card p{margin:5px 0;color:rgba(232,221,191,.66);font-size:12px;line-height:1.55;}',
      'body.tm-phase8-formal #tm-phase8-formal-panel .tmf-minirows{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin-top:7px;}body.tm-phase8-formal #tm-phase8-formal-panel .tmf-minirows div{min-height:40px;border:1px solid rgba(204,164,76,.16);background:rgba(0,0,0,.18);padding:6px 7px;}body.tm-phase8-formal #tm-phase8-formal-panel .tmf-minirows span{display:block;color:rgba(226,211,170,.52);font-size:10px;}body.tm-phase8-formal #tm-phase8-formal-panel .tmf-minirows b{display:block;color:#eadfbd;font-size:12px;margin-top:2px;overflow-wrap:anywhere;}',
      'body.tm-phase8-formal #tm-phase8-formal-panel .tmf-action,body.tm-phase8-formal #tm-phase8-formal-panel .tmf-person-actions button{border:1px solid rgba(204,164,76,.26);background:rgba(25,18,12,.88);color:#eadfbd;min-height:28px;padding:4px 9px;font-family:inherit;font-size:12px;letter-spacing:.08em;cursor:pointer;}body.tm-phase8-formal #tm-phase8-formal-panel .tmf-action.main{background:linear-gradient(180deg,rgba(128,50,35,.9),rgba(61,27,20,.92));border-color:rgba(213,103,73,.5);color:#ffe1ac;}body.tm-phase8-formal #tm-phase8-formal-panel .tmf-action:hover,body.tm-phase8-formal #tm-phase8-formal-panel .tmf-person-actions button:hover{border-color:rgba(232,197,113,.62);color:#f5dc96;}',
      'body.tm-phase8-formal #tm-phase8-formal-panel .tmf-person-card,body.tm-phase8-formal #tm-phase8-formal-panel .tmf-person-pick{display:grid;grid-template-columns:42px minmax(0,1fr);gap:8px;align-items:center;width:100%;text-align:left;border:1px solid rgba(204,164,76,.16);background:rgba(0,0,0,.20);color:#eadfbd;padding:7px;box-sizing:border-box;}body.tm-phase8-formal #tm-phase8-formal-panel .tmf-avatar{width:38px;height:38px;border:1px solid rgba(204,164,76,.35);background:radial-gradient(circle at 35% 25%,rgba(238,215,147,.24),rgba(26,18,11,.9));display:flex;align-items:center;justify-content:center;color:#f2d98d;font-size:18px;}body.tm-phase8-formal #tm-phase8-formal-panel .tmf-person-head{display:block;}body.tm-phase8-formal #tm-phase8-formal-panel .tmf-person-head b,body.tm-phase8-formal #tm-phase8-formal-panel .tmf-person-pick b{display:block;color:#f2d98d;font-size:14px;}body.tm-phase8-formal #tm-phase8-formal-panel .tmf-person-head span,body.tm-phase8-formal #tm-phase8-formal-panel .tmf-person-pick span{display:block;color:rgba(226,211,170,.55);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.tmf-chaoyi-grid{display:grid;grid-template-columns:1fr;gap:8px;}.tmf-chaoyi-grid button{height:92px;position:relative;overflow:hidden;border:1px solid rgba(184,154,83,.30);background:#15100c;color:#f1ddb0;text-align:left;padding:10px 12px;cursor:pointer;font-family:inherit;}.tmf-chaoyi-grid img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.38;filter:saturate(.85) brightness(.72);}.tmf-chaoyi-grid b,.tmf-chaoyi-grid span{position:relative;z-index:1;display:block;text-shadow:0 2px 6px #000;}.tmf-chaoyi-grid b{font-size:20px;letter-spacing:.18em;margin-top:18px;}.tmf-chaoyi-grid span{font-size:13px;color:#d7c49b;}',
      '.tmf-line{display:flex;justify-content:space-between;gap:8px;border-bottom:1px dashed rgba(184,154,83,.15);padding:7px 0;font-size:14px;}.tmf-line:last-child{border-bottom:none;}.tmf-line b{color:#e4d4a8;}.tmf-line span{color:#a99d83;text-align:right;}',
      '.tm-phase8-person-pinned{outline:1px solid rgba(126,184,167,.76)!important;box-shadow:inset 3px 0 rgba(126,184,167,.82),0 0 0 1px rgba(126,184,167,.18)!important;position:relative;}.tm-phase8-person-pinned:after{content:"钉";position:absolute;right:5px;top:4px;min-width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(126,184,167,.18);border:1px solid rgba(126,184,167,.56);color:#bfe9dc;font-size:11px;z-index:2;}',
      '#tm-phase8-left-surface{position:absolute;left:0;top:16px;bottom:208px;width:300px;z-index:24;display:flex;flex-direction:column;gap:10px;pointer-events:none;font-family:"STKaiti","KaiTi","楷体",serif;}#tm-phase8-left-surface>*{pointer-events:auto;}',
      '.tmf-renwu-entry{width:292px;height:86px;margin-left:0;border:0;background:transparent;position:relative;overflow:visible;cursor:pointer;color:#f0d98c;filter:drop-shadow(0 9px 20px rgba(0,0,0,.52));}.tmf-renwu-entry img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.92;}.tmf-renwu-entry span{position:absolute;right:18px;top:28px;font-size:22px;letter-spacing:.28em;text-shadow:0 2px 8px #000;}.tmf-renwu-entry:hover{transform:translateY(-1px);filter:drop-shadow(0 11px 22px rgba(0,0,0,.58)) drop-shadow(0 0 8px rgba(212,176,92,.18));}',
      '.tmf-event-feed{width:286px;margin-left:0;min-height:0;flex:1;display:flex;flex-direction:column;border-left:2px solid rgba(126,184,167,.58);border-top:1px solid rgba(201,168,95,.22);border-bottom:1px solid rgba(201,168,95,.18);background:linear-gradient(180deg,rgba(18,13,9,.72),rgba(8,7,6,.66));box-shadow:0 8px 24px rgba(0,0,0,.34);}.tmf-event-feed header{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 9px;border-bottom:1px solid rgba(201,168,95,.18);}.tmf-event-feed header b{display:block;color:#f0d98c;font-size:15px;letter-spacing:.22em;font-weight:500;}.tmf-event-feed header span{display:block;margin-top:2px;color:#8f846f;font-size:11px;letter-spacing:.12em;}.tmf-event-feed select{height:28px;max-width:112px;border:1px solid rgba(201,168,95,.26);background:rgba(10,8,6,.82);color:#d8c27c;font-family:inherit;font-size:12px;}',
      '.tmf-event-list{min-height:0;overflow-y:auto;scrollbar-width:thin;scrollbar-color:rgba(201,168,95,.45) transparent;padding:7px 7px 9px;display:flex;flex-direction:column;gap:6px;}.tmf-event-row{display:grid;grid-template-columns:36px minmax(0,1fr) 42px;align-items:center;gap:7px;min-height:50px;border:1px solid rgba(201,168,95,.14);background:rgba(255,255,255,.025);color:#d7c49b;text-align:left;cursor:pointer;font-family:inherit;padding:6px;}.tmf-event-row:hover{border-color:rgba(201,168,95,.42);background:rgba(201,168,95,.075);}.tmf-event-turn{color:#8dbdab;font-size:11px;letter-spacing:0;}.tmf-event-main{min-width:0;}.tmf-event-main b{display:block;color:#e6cf8e;font-size:13px;letter-spacing:.08em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}.tmf-event-main em{display:block;margin-top:3px;color:#a99d83;font-style:normal;font-size:12px;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}.tmf-event-type{justify-self:end;color:#8f846f;font-size:11px;writing-mode:vertical-rl;letter-spacing:.12em;}.tmf-event-empty{padding:18px 12px;color:#9f9277;font-size:13px;line-height:1.7;text-align:center;}',
      '#tm-phase8-action-tray{position:absolute;left:16px;bottom:26px;width:432px;height:168px;z-index:27;pointer-events:none;}#tm-phase8-action-tray .tmf-desk-action{position:absolute;width:102px;height:146px;border:0;background:transparent;padding:0;cursor:pointer;pointer-events:auto;filter:drop-shadow(0 8px 10px rgba(0,0,0,.52));font-family:"STKaiti","KaiTi","楷体",serif;color:#3a2614;}#tm-phase8-action-tray .tmf-desk-action:nth-child(1){left:0;top:7px;transform:rotate(-2deg);}#tm-phase8-action-tray .tmf-desk-action:nth-child(2){left:108px;top:0;transform:rotate(1deg);}#tm-phase8-action-tray .tmf-desk-action:nth-child(3){left:216px;top:6px;transform:rotate(-1deg);}#tm-phase8-action-tray .tmf-desk-action:nth-child(4){left:324px;top:3px;transform:rotate(1.4deg);}#tm-phase8-action-tray .tmf-desk-action:hover{transform:translateY(-5px) rotate(0deg);filter:drop-shadow(0 12px 16px rgba(0,0,0,.65));}.tmf-desk-action img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;}.tmf-desk-action span{position:absolute;left:30px;right:24px;top:28px;bottom:28px;display:flex;flex-direction:column;align-items:center;justify-content:center;writing-mode:vertical-rl;text-shadow:0 1px 0 rgba(255,248,220,.55);}.tmf-desk-action b{font-size:20px;letter-spacing:.16em;font-weight:700;}.tmf-desk-action em{margin-top:8px;font-size:11px;letter-spacing:.18em;font-style:normal;color:#8c2f22;}',
      'body.tm-phase8-formal #tm-phase8-event-notice.tm-event-notice{position:absolute;left:0;bottom:188px;width:366px;height:252px;z-index:62;padding:0;display:flex;flex-direction:column;border:0;background:linear-gradient(180deg,rgba(37,27,18,.88),rgba(15,12,9,.82));box-shadow:0 14px 32px rgba(0,0,0,.50);font-family:"STKaiti","KaiTi","楷体",serif;pointer-events:auto;}body.tm-phase8-formal .tm-event-board-head{flex:0 0 36px;display:flex;align-items:flex-start;justify-content:space-between;padding:0 8px 0 8px;border-top:1px solid rgba(201,168,95,.28);border-bottom:1px solid rgba(201,168,95,.18);background:linear-gradient(180deg,rgba(79,51,24,.60),rgba(22,16,11,.22));}body.tm-phase8-formal .tm-event-title-wrap{display:flex;align-items:center;gap:8px;min-width:0;height:36px;}body.tm-phase8-formal .tm-event-title-wrap b{color:#f0d98c;font-size:15px;letter-spacing:.18em;font-weight:500;}body.tm-phase8-formal .tm-event-kicker{color:#8dbdab;font-size:11px;letter-spacing:.18em;}body.tm-phase8-formal #tm-phase8-event-range{height:26px;margin-top:5px;max-width:92px;border:1px solid rgba(201,168,95,.30);background:#120e0b;color:#d8c27c;font-family:inherit;font-size:12px;}',
      'body.tm-phase8-formal #tm-phase8-event-notice .tmf-event-list{padding:8px 8px 10px;gap:7px;}body.tm-phase8-formal #tm-phase8-event-notice .tmf-event-row{min-height:45px;grid-template-columns:30px minmax(0,1fr) 34px;border-color:rgba(201,168,95,.18);background:linear-gradient(90deg,rgba(201,168,95,.06),rgba(0,0,0,.12));}body.tm-phase8-formal #tm-phase8-event-notice .tmf-event-main b{font-size:13px;}body.tm-phase8-formal #tm-phase8-event-notice .tmf-event-main em{-webkit-line-clamp:1;}',
      'body.tm-phase8-formal #tm-phase8-event-notice.tm-event-notice{left:0!important;bottom:188px!important;width:366px!important;height:252px!important;background:transparent!important;box-shadow:none!important;color:#e8d4a3!important;}body.tm-phase8-formal #tm-phase8-event-notice .tm-event-board-head{position:relative;z-index:2;display:flex!important;align-items:center!important;justify-content:space-between!important;flex:0 0 36px!important;padding:0 6px!important;border:0!important;background:transparent!important;}body.tm-phase8-formal .tm-event-board-title{display:flex;align-items:center;gap:6px;color:rgba(229,210,164,.58);font:700 10px/1 "STSong","SimSun",serif;letter-spacing:.12em;text-shadow:0 1px 2px rgba(0,0,0,.8);}body.tm-phase8-formal .tm-event-board-title:before{content:"";width:5px;height:5px;border-radius:50%;background:#d9b15f;box-shadow:0 0 8px rgba(217,177,95,.55);}body.tm-phase8-formal .tm-event-board-title span{min-width:20px;height:18px;display:inline-flex;align-items:center;justify-content:center;border:1px solid rgba(214,178,91,.30);border-radius:9px;background:rgba(11,9,7,.44);color:#9fd2c0;font-size:10px;letter-spacing:0;}body.tm-phase8-formal #tm-phase8-event-range{height:24px;margin:0;max-width:96px;border:1px solid rgba(214,178,91,.24);border-radius:12px;background:rgba(12,10,8,.58);color:rgba(229,210,164,.74);font:11px/1 "STSong","SimSun",serif;}',
      'body.tm-phase8-formal #tm-phase8-event-notice .tm-event-list{position:relative;z-index:1;flex:1 1 auto;min-height:0;overflow-y:auto;overflow-x:visible;display:flex;flex-direction:column;gap:6px;padding:0 8px 0 0;scrollbar-width:thin;scrollbar-color:rgba(214,178,91,.48) rgba(0,0,0,.18);}body.tm-phase8-formal .tm-event-item{position:relative;width:100%;min-height:48px;display:grid;grid-template-columns:34px minmax(0,1fr) auto;gap:7px;align-items:start;padding:7px 8px 7px 7px;border:1px solid rgba(214,178,91,.18);border-left-color:rgba(210,73,52,.38);border-radius:4px;background:linear-gradient(90deg,rgba(22,18,13,.90),rgba(22,17,12,.76) 64%,rgba(12,10,8,.40)),radial-gradient(ellipse at 0 50%,rgba(191,60,42,.18),transparent 48%);color:inherit;cursor:pointer;text-align:left;box-shadow:0 8px 18px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,238,186,.045);transition:border-color .14s ease,background .14s ease,transform .14s ease,box-shadow .14s ease;font-family:inherit;}body.tm-phase8-formal .tm-event-item:hover{border-color:rgba(238,202,118,.40);transform:translateX(3px);box-shadow:0 10px 22px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,238,186,.07);}',
      'body.tm-phase8-formal .tm-event-item .tm-event-seal{grid-row:auto;width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:50%;border:1px solid rgba(230,193,103,.42);background:radial-gradient(circle at 42% 28%,rgba(246,202,124,.22),transparent 42%),linear-gradient(180deg,rgba(83,33,23,.88),rgba(27,13,9,.94));color:#f0d083;font:700 15px/1 "STKaiti","KaiTi",serif;box-shadow:inset 0 0 0 1px rgba(0,0,0,.34),0 4px 11px rgba(0,0,0,.26);}body.tm-phase8-formal .tm-event-item .tm-event-main{min-width:0;}body.tm-phase8-formal .tm-event-item .tm-event-head{display:flex;align-items:center;gap:6px;margin:0;min-width:0;}body.tm-phase8-formal .tm-event-item .tm-event-kicker{flex:0 0 auto;color:rgba(156,205,187,.70);font:9px/1 "STSong","SimSun",serif;letter-spacing:.08em;}body.tm-phase8-formal .tm-event-item .tm-event-title{min-width:0;overflow:hidden;text-overflow:ellipsis;color:#efd58d;font:700 13px/1.15 "STKaiti","KaiTi",serif;letter-spacing:.05em;white-space:normal;}body.tm-phase8-formal .tm-event-item .tm-event-body{display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden;margin-top:3px;color:rgba(222,208,170,.66);font:10px/1.25 "STSong","SimSun",serif;letter-spacing:.04em;}body.tm-phase8-formal .tm-event-item .tm-event-tag{align-self:flex-start;min-width:30px;padding:2px 5px;text-align:center;border:1px solid rgba(214,178,91,.24);border-radius:2px;background:rgba(0,0,0,.16);color:rgba(229,210,164,.74);font:9px/1 "STSong","SimSun",serif;letter-spacing:.08em;}',
      'body.tm-phase8-formal #tm-phase8-action-tray.zb-action-tray{position:absolute;left:18px;bottom:24px;z-index:62;display:block;width:356px;height:150px;pointer-events:none;}body.tm-phase8-formal #tm-phase8-action-tray.zb-action-tray:before{content:"";position:absolute;left:-20px;right:-22px;bottom:-18px;height:62px;background:radial-gradient(ellipse at 42% 72%,rgba(0,0,0,.50),rgba(0,0,0,.22) 48%,transparent 74%);pointer-events:none;z-index:-1;}body.tm-phase8-formal .zb-action-tray .zb-img-btn{appearance:none;position:absolute!important;width:168px!important;height:70px!important;min-width:0;padding:0;border:1px solid rgba(214,188,116,.32);border-radius:5px;overflow:hidden;background:#15100b;cursor:pointer;pointer-events:auto;box-shadow:0 8px 18px rgba(0,0,0,.44),inset 0 1px 0 rgba(255,244,202,.12),inset 0 -1px 0 rgba(0,0,0,.55);filter:drop-shadow(0 8px 12px rgba(0,0,0,.34));transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease,filter .18s ease;}',
      'body.tm-phase8-formal .zb-action-tray .zb-img{width:100%;height:100%;object-fit:cover;display:block;pointer-events:none;opacity:.96;filter:saturate(.95) contrast(1.05) brightness(.96);transform:scale(1.012);transition:transform .24s ease,filter .24s ease,opacity .24s ease;}body.tm-phase8-formal .zb-action-tray .zb-img-btn:before{content:"";position:absolute;inset:0;z-index:1;background:linear-gradient(90deg,rgba(8,6,5,.72) 0%,rgba(8,6,5,.42) 36%,rgba(8,6,5,.10) 68%,rgba(8,6,5,.30) 100%),radial-gradient(ellipse at 18% 50%,rgba(223,174,82,.16),transparent 54%);pointer-events:none;transition:opacity .18s;}body.tm-phase8-formal .zb-action-tray .zb-img-btn:after{content:"";position:absolute;inset:1px;z-index:3;border-radius:5px;pointer-events:none;box-shadow:inset 0 0 0 1px rgba(244,215,136,.18),inset 0 0 18px rgba(0,0,0,.42);}body.tm-phase8-formal .zb-action-copy{position:absolute;z-index:2;left:13px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;align-items:flex-start;text-align:left;color:#f4dfaa;text-shadow:0 2px 6px #000;}body.tm-phase8-formal .zb-action-kicker{font-size:8px;letter-spacing:.22em;color:#8dbdab;margin-bottom:4px;}body.tm-phase8-formal .zb-action-copy b{font:700 17px/1 "STKaiti","KaiTi","楷体",serif;letter-spacing:.22em;}body.tm-phase8-formal #zhao-btn .zb-action-copy{left:auto;right:12px;align-items:flex-end;text-align:right;}',
      'body.tm-phase8-formal .zb-action-title{font:700 17px/1 "STKaiti","KaiTi","楷体",serif;letter-spacing:.20em;color:#f4dfaa;}body.tm-phase8-formal .zb-action-sub{margin-top:5px;color:rgba(232,218,178,.66);font:10px/1 "STSong","SimSun",serif;letter-spacing:.12em;}',
      'body.tm-phase8-formal .zb-action-tray .zb-img-btn:hover{border-color:rgba(238,203,118,.72);box-shadow:0 12px 24px rgba(0,0,0,.52),0 0 0 1px rgba(230,190,101,.15),inset 0 1px 0 rgba(255,244,202,.16),inset 0 -1px 0 rgba(0,0,0,.48);filter:drop-shadow(0 10px 16px rgba(0,0,0,.40)) brightness(1.04);transform:translateY(-4px) rotate(var(--action-tilt,0deg));}body.tm-phase8-formal .zb-action-tray .zb-img-btn:hover .zb-img{opacity:1;filter:saturate(1.02) contrast(1.08) brightness(1.02);transform:scale(1.045);}body.tm-phase8-formal .zb-action-tray #zhao-btn{left:0!important;top:2px;--action-tilt:-1.9deg;}body.tm-phase8-formal .zb-action-tray #zhao-btn-2{left:178px!important;top:5px;--action-tilt:.9deg;}body.tm-phase8-formal .zb-action-tray #zhao-btn-3{left:8px!important;top:78px;--action-tilt:-.7deg;}body.tm-phase8-formal .zb-action-tray #zhao-btn-4{left:185px!important;top:75px;--action-tilt:1.6deg;}',
      'body.tm-phase8-formal .tb-left:before{z-index:0!important;}body.tm-phase8-formal .tb-left>*{position:relative;z-index:1;}',
      'body.tm-phase8-formal #topbar{height:78px!important;padding:8px 12px 0!important;gap:9px!important;align-items:flex-start!important;background:transparent!important;border:0!important;box-shadow:none!important;backdrop-filter:none!important;pointer-events:none!important;}body.tm-phase8-formal #topbar:before,body.tm-phase8-formal #topbar:after{display:none!important;}body.tm-phase8-formal .tb-left,body.tm-phase8-formal .tb-vars,body.tm-phase8-formal .tb-right{pointer-events:auto!important;position:relative!important;z-index:2!important;flex-shrink:0!important;overflow:visible!important;}',
      'body.tm-phase8-formal .tb-left{width:205px!important;height:52px!important;margin:0 2px 0 0!important;padding:5px 13px 5px 7px!important;gap:7px!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;box-sizing:border-box!important;}body.tm-phase8-formal .tb-left:before{content:""!important;position:absolute!important;z-index:0!important;inset:-12px -16px -13px -10px!important;background:url("preview/img/topbar-left-identity-underlay-v1.png") center/100% 100% no-repeat!important;opacity:.68!important;filter:saturate(.98) brightness(.92) contrast(1.05)!important;pointer-events:none!important;}body.tm-phase8-formal .tb-left:after{display:none!important;}body.tm-phase8-formal .tb-left>*{position:relative!important;z-index:1!important;}',
      'body.tm-phase8-formal .tb-wentian{width:36px!important;min-width:36px!important;height:34px!important;padding:0!important;border:1px solid rgba(227,187,92,.62)!important;border-radius:50%!important;background:radial-gradient(circle at 35% 27%,rgba(251,221,143,.30),rgba(92,54,24,.88) 58%,rgba(12,9,7,.94) 78%),linear-gradient(180deg,rgba(63,38,20,.94),rgba(12,9,7,.94))!important;color:#f0d58f!important;font-size:10px!important;letter-spacing:.06em!important;box-shadow:inset 0 1px 0 rgba(255,239,180,.14),inset 0 -8px 14px rgba(0,0,0,.32),0 2px 8px rgba(0,0,0,.40),0 0 11px rgba(205,166,82,.15)!important;}body.tm-phase8-formal .tb-weather{height:34px!important;min-width:122px!important;padding:0!important;gap:6px!important;background:transparent!important;border:0!important;box-shadow:none!important;}body.tm-phase8-formal .tb-w-seal{width:24px!important;height:24px!important;font-size:11px!important;border-color:rgba(233,196,105,.52)!important;background:radial-gradient(circle at 35% 25%,rgba(255,225,147,.24),rgba(86,52,24,.74) 58%,rgba(13,10,8,.92))!important;}body.tm-phase8-formal .tb-w-info{min-width:82px!important;}body.tm-phase8-formal .tb-w-name{max-width:104px!important;font-size:10.8px!important;color:#efd990!important;}body.tm-phase8-formal .tb-w-desc{font-size:8.2px!important;color:rgba(209,193,153,.66)!important;}',
      'body.tm-phase8-formal .tb-vars{--tm-rail-w:932px;--tm-rail-h:54px;--tm-rail-pad-x:12px;--tm-rail-pad-y:7px;--tm-rail-gap:4px;--tm-wide-cell:212px;--tm-hukou-cell:104px;--tm-lizhi-cell:110px;--tm-small-cell:82px;width:var(--tm-rail-w)!important;height:var(--tm-rail-h)!important;flex:0 0 var(--tm-rail-w)!important;max-width:none!important;padding:var(--tm-rail-pad-y) var(--tm-rail-pad-x)!important;gap:var(--tm-rail-gap)!important;display:flex!important;align-items:center!important;border:0!important;border-radius:0!important;background:url("preview/img/topbar-resource-fieldrail-v2-wide.png") center/100% 100% no-repeat!important;box-shadow:none!important;box-sizing:border-box!important;}body.tm-phase8-formal .tb-vars:before,body.tm-phase8-formal .tb-vars:after{display:none!important;}',
      'body.tm-phase8-formal .tb-var{height:calc(var(--tm-rail-h) - (var(--tm-rail-pad-y) * 2))!important;min-width:0!important;border-color:transparent!important;background:transparent!important;box-shadow:none!important;border-radius:0!important;box-sizing:border-box!important;}body.tm-phase8-formal .tb-var:hover,body.tm-phase8-formal .tb-var.pinned{background:radial-gradient(ellipse at 50% 10%,rgba(231,190,99,.12),transparent 64%),linear-gradient(180deg,rgba(205,166,82,.075),rgba(205,166,82,.018))!important;}body.tm-phase8-formal .tb-var.wide{display:flex!important;flex-direction:column!important;align-items:stretch!important;justify-content:center!important;height:calc(var(--tm-rail-h) - (var(--tm-rail-pad-y) * 2))!important;flex:0 0 var(--tm-wide-cell)!important;width:var(--tm-wide-cell)!important;min-width:var(--tm-wide-cell)!important;max-width:var(--tm-wide-cell)!important;padding:5px 8px!important;gap:3px!important;overflow:hidden!important;}body.tm-phase8-formal .tb-var:not(.wide){display:flex!important;flex-direction:row!important;align-items:center!important;height:calc(var(--tm-rail-h) - (var(--tm-rail-pad-y) * 2))!important;flex:0 0 var(--tm-small-cell)!important;width:var(--tm-small-cell)!important;min-width:var(--tm-small-cell)!important;max-width:var(--tm-small-cell)!important;padding:5px 8px!important;gap:5px!important;overflow:hidden!important;}body.tm-phase8-formal .tb-var[data-key="hukou"]{flex-basis:var(--tm-hukou-cell)!important;width:var(--tm-hukou-cell)!important;min-width:var(--tm-hukou-cell)!important;max-width:var(--tm-hukou-cell)!important;}body.tm-phase8-formal .tb-var[data-key="lizhi"]{flex-basis:var(--tm-lizhi-cell)!important;width:var(--tm-lizhi-cell)!important;min-width:var(--tm-lizhi-cell)!important;max-width:var(--tm-lizhi-cell)!important;}',
      'body.tm-phase8-formal .tb-var.wide .tb-vn{flex:0 0 auto!important;width:auto!important;min-width:0!important;max-width:none!important;padding:0 0 0 4px!important;margin:0 0 2px!important;border-right:0!important;text-align:left!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;font-size:8.4px!important;line-height:1!important;letter-spacing:.18em!important;color:rgba(221,202,155,.76)!important;}body.tm-phase8-formal .tb-vn:before,body.tm-phase8-formal .tb-var.wide .tb-vn:before{display:none!important;}body.tm-phase8-formal .tb-var.wide .tb-vsubs{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;align-items:center!important;gap:4px!important;min-width:0!important;overflow:hidden!important;line-height:1.05!important;}body.tm-phase8-formal .tb-var.wide .tb-vs{height:32px!important;min-width:0!important;display:flex!important;align-items:center!important;gap:4px!important;padding:3px 3px!important;border-radius:2px!important;background:rgba(0,0,0,.12)!important;overflow:hidden!important;}body.tm-phase8-formal .tb-var.wide .icn{width:17px!important;height:17px!important;font-size:8.5px!important;}body.tm-phase8-formal .tb-var.wide .sv{min-width:0!important;flex:1 1 auto!important;overflow:hidden!important;line-height:1!important;}body.tm-phase8-formal .tb-var.wide .sv b{display:block!important;max-width:100%!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;font:600 12px/1.12 "STSong","SimSun","Songti SC",serif!important;color:#e0c77e!important;}body.tm-phase8-formal .tb-var.wide .sv .sd{display:block!important;max-width:100%!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;font:500 8.7px/1.05 "STSong","SimSun",serif!important;margin-top:1px!important;}',
      'body.tm-phase8-formal .tb-vbody{display:flex!important;flex-direction:column!important;justify-content:center!important;min-width:0!important;overflow:hidden!important;gap:1px!important;line-height:1.05!important;}body.tm-phase8-formal .tb-vn{max-width:100%!important;padding-left:0!important;margin-bottom:0!important;font-size:7.6px!important;line-height:1!important;letter-spacing:.18em!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;color:rgba(221,202,155,.72)!important;}body.tm-phase8-formal .tb-vv{display:block!important;max-width:100%!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;font-size:12px!important;line-height:1.05!important;color:#e0c77e!important;}body.tm-phase8-formal .tb-var.warn .tb-vv{color:#e88a78!important;}body.tm-phase8-formal .tb-var.good .tb-vv{color:#8dbdab!important;}',
      'body.tm-phase8-formal .tb-right{width:340px!important;height:52px!important;flex:0 0 340px!important;margin-left:auto!important;padding:6px 12px 6px 14px!important;gap:9px!important;display:flex!important;align-items:center!important;isolation:isolate!important;background:url("preview/img/topbar-right-fieldtime-v3-wide.png") center/100% 100% no-repeat!important;border:0!important;border-radius:4px!important;box-shadow:none!important;filter:drop-shadow(0 5px 12px rgba(0,0,0,.30))!important;box-sizing:border-box!important;}body.tm-phase8-formal .tb-right:before{display:none!important;}body.tm-phase8-formal .tb-chip{width:88px!important;min-width:88px!important;height:40px!important;padding:0 8px!important;display:flex!important;align-items:center!important;justify-content:center!important;border:0!important;background:transparent!important;box-shadow:none!important;color:rgba(237,214,151,.86)!important;text-shadow:0 1px 2px rgba(0,0,0,.75)!important;font-size:9.4px!important;}body.tm-phase8-formal .tb-time{flex:1 1 auto!important;height:40px!important;min-width:0!important;max-width:none!important;padding:6px 18px 5px 12px!important;display:flex!important;flex-direction:column!important;justify-content:center!important;align-items:flex-end!important;border:0!important;background:transparent!important;box-shadow:none!important;text-align:right!important;box-sizing:border-box!important;}body.tm-phase8-formal .tb-time-main{max-width:100%!important;font-size:12px!important;line-height:1.15!important;letter-spacing:.055em!important;color:#f1d792!important;text-shadow:0 1px 2px rgba(0,0,0,.78),0 0 8px rgba(217,177,87,.14)!important;}body.tm-phase8-formal .tb-time-sub{max-width:100%!important;font-size:8.4px!important;color:rgba(219,203,162,.70)!important;text-shadow:0 1px 2px rgba(0,0,0,.72)!important;}',
      '@media(max-width:1500px){body.tm-phase8-formal .tb-vars{--tm-rail-w:800px;--tm-rail-h:50px;--tm-rail-pad-x:9px;--tm-rail-pad-y:6px;--tm-rail-gap:3px;--tm-wide-cell:188px;--tm-hukou-cell:92px;--tm-lizhi-cell:92px;--tm-small-cell:62px;background-image:url("preview/img/topbar-resource-fieldrail-v2-wide.png")!important;}body.tm-phase8-formal .tb-right{width:230px!important;height:48px!important;flex-basis:230px!important;background-image:url("preview/img/topbar-right-fieldtime-v3-compact.png")!important;}}',
      '@media(max-width:1280px){body.tm-phase8-formal #topbar{height:70px!important;padding-top:7px!important;}body.tm-phase8-formal .tb-left{width:168px!important;height:48px!important;padding-right:10px!important;}body.tm-phase8-formal .tb-weather{min-width:92px!important;gap:4px!important;}body.tm-phase8-formal .tb-w-info{min-width:56px!important;}body.tm-phase8-formal .tb-w-name{max-width:72px!important;font-size:9.5px!important;}body.tm-phase8-formal .tb-w-desc{display:none!important;}body.tm-phase8-formal .tb-var.wide .sd{display:none!important;}body.tm-phase8-formal .tb-right{width:282px!important;height:48px!important;flex-basis:282px!important;padding:5px 10px 5px 11px!important;gap:7px!important;}body.tm-phase8-formal .tb-time{height:38px!important;padding-right:14px!important;}body.tm-phase8-formal .tb-time-main{font-size:10.4px!important;}body.tm-phase8-formal .tb-chip{width:72px!important;min-width:72px!important;height:38px!important;}}',
      '@media(max-width:1080px){body.tm-phase8-formal #topbar{height:66px!important;}body.tm-phase8-formal .tb-left{width:54px!important;padding-right:8px!important;}body.tm-phase8-formal .tb-weather{display:none!important;}body.tm-phase8-formal .tb-vars{--tm-rail-w:626px;--tm-rail-h:50px;--tm-rail-pad-x:9px;--tm-rail-pad-y:6px;--tm-rail-gap:3px;--tm-wide-cell:126px;--tm-hukou-cell:76px;--tm-lizhi-cell:82px;--tm-small-cell:60px;background-image:url("preview/img/topbar-resource-fieldrail-v2-narrow.png")!important;}body.tm-phase8-formal .tb-var.wide .tb-vn{display:none!important;}body.tm-phase8-formal .tb-chip{display:none!important;}body.tm-phase8-formal .tb-right{width:154px!important;height:48px!important;flex-basis:154px!important;background-image:url("preview/img/topbar-right-fieldtime-v3-narrow.png")!important;}body.tm-phase8-formal .tb-time{min-width:0!important;max-width:none!important;padding-right:12px!important;}body.tm-phase8-formal .tb-time-main{font-size:9.4px!important;}}',
      'body.tm-phase8-formal .generated-basemap{opacity:1!important;mix-blend-mode:normal!important;filter:none!important;image-rendering:auto!important;}body.tm-phase8-formal .ming-map-wash{--map-fog:.105;opacity:var(--map-fog)!important;background:radial-gradient(ellipse at 50% 48%,rgba(244,225,168,.12),transparent 56%),radial-gradient(ellipse at 0 48%,rgba(255,255,255,.20),transparent 34%),radial-gradient(ellipse at 100% 48%,rgba(255,255,255,.18),transparent 34%)!important;}',
      'body.tm-phase8-formal .map-tools-dock{z-index:4!important;}body.tm-phase8-formal .map-tools-toggle{border-left:2px solid rgba(126,184,167,.62)!important;border-radius:3px!important;background:linear-gradient(180deg,rgba(36,30,24,.78),rgba(18,16,14,.66)),radial-gradient(ellipse at 0 50%,rgba(126,184,167,.13),transparent 64%)!important;color:#f0d98c!important;box-shadow:0 8px 18px rgba(0,0,0,.38),inset 0 1px 0 rgba(255,255,255,.04)!important;}body.tm-phase8-formal .map-tools-mode{color:#8dbdab!important;font-size:10px!important;letter-spacing:.08em!important;padding-left:8px;border-left:1px solid rgba(214,188,116,.22);}body.tm-phase8-formal .map-tools-pop{border-radius:3px!important;box-shadow:0 10px 24px rgba(0,0,0,.42)!important;}',
      'body.tm-phase8-formal .map-layer,body.tm-phase8-formal .mnp-row button{border-radius:14px!important;font-size:10.5px!important;background:rgba(18,16,14,.58)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.04)!important;}body.tm-phase8-formal .map-layer:hover{color:#f0d98c!important;border-color:rgba(214,188,116,.48)!important;background:rgba(72,46,20,.72)!important;}body.tm-phase8-formal .map-layer.on,body.tm-phase8-formal .map-layer[aria-pressed="true"]{color:#f0d98c!important;border-color:rgba(214,188,116,.62)!important;background:rgba(184,154,83,.16)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 0 12px rgba(184,154,83,.12)!important;}',
      'body.tm-phase8-formal .map-alert-strip{z-index:4!important;}body.tm-phase8-formal .map-alert{padding:6px 11px!important;border-radius:3px!important;background:linear-gradient(180deg,rgba(36,30,24,.78),rgba(18,16,14,.68))!important;color:#d8cba8!important;font-size:11px!important;box-shadow:0 6px 14px rgba(0,0,0,.28)!important;}body.tm-phase8-formal .map-alert:hover{border-color:#d6bc74!important;color:#f5d995!important;background:rgba(62,38,18,.88)!important;}',
      'body.tm-phase8-formal .map-legend{right:126px!important;bottom:88px!important;width:258px!important;min-width:0!important;padding:7px 8px 6px!important;border-radius:4px!important;background:radial-gradient(ellipse at 50% 0,rgba(218,184,104,.10),transparent 64%),linear-gradient(180deg,rgba(30,24,18,.72),rgba(9,8,7,.66))!important;border:1px solid rgba(214,174,87,.28)!important;border-left:2px solid rgba(214,174,87,.46)!important;box-shadow:0 7px 18px rgba(0,0,0,.34),inset 0 1px 0 rgba(255,238,180,.055)!important;backdrop-filter:blur(5px);z-index:4!important;}body.tm-phase8-formal .map-legend-title{gap:7px!important;font-size:11px!important;letter-spacing:.10em!important;}body.tm-phase8-formal .map-legend-sub{flex:0 0 auto;padding:2px 5px;border:1px solid rgba(214,174,87,.20);border-radius:2px;background:rgba(0,0,0,.18);font-size:9px!important;}body.tm-phase8-formal .map-legend-main{display:grid!important;grid-template-columns:1fr auto;gap:8px;align-items:center;margin-top:5px!important;}body.tm-phase8-formal .map-legend-bar{height:6px!important;margin:0!important;border-radius:6px;}body.tm-phase8-formal .map-legend-detail{position:absolute;right:0;bottom:calc(100% + 8px);width:282px;margin:0!important;padding:8px 10px 10px!important;border:1px solid rgba(214,174,87,.30)!important;border-left:2px solid rgba(126,184,167,.54)!important;border-radius:4px;background:radial-gradient(ellipse at 100% 0,rgba(126,184,167,.10),transparent 58%),linear-gradient(180deg,rgba(31,25,19,.88),rgba(10,9,7,.82))!important;box-shadow:0 10px 26px rgba(0,0,0,.42),inset 0 1px 0 rgba(255,238,180,.05);opacity:0;transform:translateY(5px);pointer-events:none;transition:opacity .16s ease,transform .16s ease;}body.tm-phase8-formal .map-legend:hover .map-legend-detail,body.tm-phase8-formal .map-legend:focus-within .map-legend-detail{opacity:1;transform:translateY(0);pointer-events:auto;}',
      'body.tm-phase8-formal .ming-region{fill-opacity:.46!important;stroke:#2c1909!important;stroke-width:.9!important;stroke-opacity:.98!important;mix-blend-mode:multiply!important;filter:none!important;}body.tm-phase8-formal .ming-region:hover{fill-opacity:.48!important;stroke:#9b512c!important;stroke-width:1.46!important;}body.tm-phase8-formal .ming-region.selected{fill-opacity:.62!important;stroke:#e2b662!important;stroke-width:1.85!important;mix-blend-mode:normal!important;}body.tm-phase8-formal #mapwrap[data-map-mode="owner"] .ming-region{fill-opacity:.68!important;stroke-opacity:1!important;mix-blend-mode:normal!important;}',
      'body.tm-phase8-formal .ming-label{opacity:0;pointer-events:none;transition:opacity .18s,transform .18s;}body.tm-phase8-formal .ming-label text{text-anchor:middle;dominant-baseline:middle;fill:#f2dfad!important;stroke:none!important;paint-order:normal!important;font-family:"STKaiti","KaiTi","SimSun",serif;font-weight:700;font-size:10.5px;letter-spacing:.05em;text-shadow:none;}body.tm-phase8-formal .ming-label rect{fill:rgba(21,16,10,.58);stroke:rgba(214,188,116,.34);stroke-width:.8;rx:3;ry:3;vector-effect:non-scaling-stroke;filter:drop-shadow(0 4px 8px rgba(0,0,0,.28));}body.tm-phase8-formal #mapwrap[data-map-scale="region"] .ming-label{opacity:.92;}body.tm-phase8-formal #mapwrap[data-map-scale="realm"] .ming-label,body.tm-phase8-formal #mapwrap[data-map-scale="prefecture"] .ming-label{opacity:0;}',
      'body.tm-phase8-formal .tmf-faction-label{opacity:0;pointer-events:none;cursor:pointer;transition:opacity .18s,transform .18s;filter:drop-shadow(0 3px 3px rgba(0,0,0,.36));}body.tm-phase8-formal .tmf-faction-label rect,body.tm-phase8-formal .tmf-faction-label circle{display:none!important;}body.tm-phase8-formal .tmf-faction-label text{text-anchor:middle;dominant-baseline:middle;font-family:"STKaiti","KaiTi","SimSun",serif;font-weight:700;paint-order:stroke;stroke:rgba(24,15,6,.46);stroke-width:1.55px;}body.tm-phase8-formal .tmf-faction-label text.main{fill:rgba(246,224,166,.82)!important;font-size:var(--realm-label-size,34px)!important;letter-spacing:.34em;}body.tm-phase8-formal .tmf-faction-label text.sub{fill:rgba(224,199,129,.66)!important;font-size:10px!important;letter-spacing:.2em;stroke:rgba(24,15,6,.28);stroke-width:.55px;font-weight:500;}body.tm-phase8-formal #mapwrap[data-map-scale="realm"] .tmf-faction-label{opacity:.94;pointer-events:auto;}body.tm-phase8-formal #mapwrap[data-map-scale="region"] .tmf-faction-label,body.tm-phase8-formal #mapwrap[data-map-scale="prefecture"] .tmf-faction-label{opacity:0;}body.tm-phase8-formal .tmf-faction-label:hover text.main{fill:rgba(255,238,184,.96)!important;}',
      'body.tm-phase8-formal .tm-event-item.expanded{min-height:112px;border-color:rgba(239,200,103,.62);border-left-color:rgba(213,86,60,.90);}body.tm-phase8-formal .tm-event-time{flex:0 0 auto;color:rgba(180,160,118,.68);font:9px/1 "STSong","SimSun",serif;letter-spacing:.04em;}body.tm-phase8-formal .tm-event-item.expanded .tm-event-body{display:block;overflow:visible;-webkit-line-clamp:unset;}body.tm-phase8-formal .tm-event-detail{display:none;margin-top:7px;padding-top:7px;border-top:1px solid rgba(214,178,91,.12);color:rgba(224,211,176,.68);font:10.5px/1.45 "STSong","SimSun",serif;}body.tm-phase8-formal .tm-event-item.expanded .tm-event-detail{display:block;}body.tm-phase8-formal .tm-event-trace{display:flex;flex-wrap:wrap;gap:5px;margin-top:6px;}body.tm-phase8-formal .tm-event-trace span{padding:2px 6px;border:1px solid rgba(118,182,164,.25);border-radius:9px;color:rgba(156,205,187,.72);background:rgba(0,0,0,.16);font-size:9px;}body.tm-phase8-formal .tm-event-empty{margin:auto;color:rgba(202,186,145,.58);font:12px/1.5 "STSong","SimSun",serif;letter-spacing:.12em;}',
      'body.tm-phase8-formal .zb-action-tray #zhao-btn:before{background:linear-gradient(90deg,rgba(8,6,5,.18) 0%,rgba(8,6,5,.16) 34%,rgba(8,6,5,.45) 60%,rgba(8,6,5,.76) 100%),radial-gradient(ellipse at 76% 50%,rgba(223,174,82,.17),transparent 56%)!important;}body.tm-phase8-formal .zb-action-kicker{line-height:1!important;color:rgba(213,181,105,.72)!important;letter-spacing:0!important;}body.tm-phase8-formal .zb-action-title{line-height:1.05!important;white-space:nowrap!important;text-shadow:0 1px 1px rgba(0,0,0,.86),0 0 8px rgba(0,0,0,.62)!important;}body.tm-phase8-formal .zb-action-sub{color:rgba(232,209,150,.72)!important;white-space:nowrap!important;}',
      '.tmf-records-overlay,.tmf-event-detail{position:fixed;inset:0;z-index:9998;background:rgba(10,7,4,.72);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;font-family:"STKaiti","KaiTi","楷体",serif;}.tmf-records-dialog,.tmf-event-dialog{width:min(760px,86vw);max-height:78vh;background:linear-gradient(180deg,#211811,#100c08);border:1px solid rgba(201,168,95,.52);box-shadow:0 18px 60px rgba(0,0,0,.72);color:#eadfbd;display:flex;flex-direction:column;}.tmf-records-dialog header,.tmf-event-dialog header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 18px;border-bottom:1px solid rgba(201,168,95,.22);}.tmf-records-dialog header span,.tmf-event-dialog header span{color:#8dbdab;font-size:12px;letter-spacing:.18em;}.tmf-records-dialog h3,.tmf-event-dialog h3{margin:3px 0 0;color:#f0d98c;font-size:22px;letter-spacing:.18em;font-weight:500;}.tmf-event-dialog header p{margin:4px 0 0;color:#9f9277;font-size:12px;}.tmf-records-dialog header button,.tmf-event-dialog header button{width:28px;height:28px;border:1px solid rgba(201,168,95,.32);background:rgba(0,0,0,.18);color:#d8c27c;cursor:pointer;}.tmf-records-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:18px;}.tmf-records-grid button{min-height:118px;border:1px solid rgba(201,168,95,.28);background:linear-gradient(180deg,rgba(201,168,95,.08),rgba(0,0,0,.20));color:#eadfbd;font-family:inherit;cursor:pointer;padding:14px;text-align:left;}.tmf-records-grid b{display:block;color:#f0d98c;font-size:20px;letter-spacing:.22em;margin-bottom:12px;}.tmf-records-grid span{font-size:13px;color:#a99d83;line-height:1.55;}.tmf-event-dialog main{overflow-y:auto;white-space:pre-wrap;padding:22px 26px;font-size:16px;line-height:2;color:#d7c49b;}.tmf-event-dialog footer{display:flex;gap:8px;justify-content:flex-end;padding:12px 16px;border-top:1px solid rgba(201,168,95,.18);}.tmf-event-dialog footer button{border:1px solid rgba(201,168,95,.32);background:rgba(201,168,95,.08);color:#e6cf8e;font-family:inherit;padding:7px 12px;cursor:pointer;}',
      '.tmf-module-overlay{position:fixed;inset:0;z-index:9996;background:rgba(8,6,4,.55);backdrop-filter:blur(2px);display:flex;align-items:center;justify-content:center;font-family:"STKaiti","KaiTi","楷体",serif;color:#eadfbd;}',
      'body.tm-phase8-formal .renwu-card[hidden]{display:none!important;}',
      '.tmf-module{width:min(1360px,92vw);height:min(820px,84vh);display:flex;flex-direction:column;background:linear-gradient(180deg,rgba(29,22,15,.98),rgba(10,8,6,.985));border:1px solid rgba(201,168,95,.54);box-shadow:0 26px 80px rgba(0,0,0,.75),inset 0 0 0 1px rgba(0,0,0,.5);overflow:hidden;}',
      '.tmf-module>header{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;padding:16px 20px;border-bottom:1px solid rgba(201,168,95,.22);background:linear-gradient(90deg,rgba(201,168,95,.08),rgba(126,184,167,.04),transparent);}.tmf-module>header span{display:block;color:#8dbdab;font-size:12px;letter-spacing:.22em;}.tmf-module>header h2{margin:4px 0 0;color:#f0d98c;font-size:28px;font-weight:500;letter-spacing:.24em;}.tmf-module>header p{margin:6px 0 0;color:#9f9277;font-size:13px;letter-spacing:.06em;}.tmf-module>header button{width:32px;height:32px;border:1px solid rgba(201,168,95,.32);background:rgba(0,0,0,.18);color:#d8c27c;cursor:pointer;font-size:18px;}',
      '.tmf-module-body{flex:1;min-height:0;display:grid;grid-template-columns:300px minmax(0,1fr) 300px;gap:0;}.tmf-module-left,.tmf-module-right{min-height:0;overflow:hidden;padding:14px;border-right:1px solid rgba(201,168,95,.16);background:rgba(255,255,255,.018);}.tmf-module-right{border-right:0;border-left:1px solid rgba(201,168,95,.16);}.tmf-module-main{min-width:0;min-height:0;overflow-y:auto;padding:18px 20px;scrollbar-width:thin;scrollbar-color:rgba(201,168,95,.50) transparent;}',
      '.tmf-module h3{margin:0 0 12px;color:#d7be73;font-size:18px;font-weight:500;letter-spacing:.20em;border-bottom:1px solid rgba(184,154,83,.20);padding-bottom:8px;}.tmf-module-note,.tmf-prose{color:#c7b996;font-size:15px;line-height:1.8;white-space:pre-wrap;}.tmf-module-scroll{height:calc(100% - 42px);overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding-right:3px;scrollbar-width:thin;scrollbar-color:rgba(201,168,95,.45) transparent;}.tmf-module-scroll.compact{height:auto;max-height:520px;}',
      '.tmf-module-item,.tmf-record-row{border:1px solid rgba(184,154,83,.18);background:rgba(255,255,255,.025);padding:9px 10px;color:#d8cba8;}.tmf-module-item.hot{border-left:2px solid rgba(192,64,48,.72);}.tmf-module-item b,.tmf-record-row b{display:block;color:#f0d98c;font-size:15px;letter-spacing:.08em;}.tmf-module-item span{display:block;margin-top:4px;color:#8dbdab;font-size:12px;}.tmf-module-item p,.tmf-record-row p{margin:7px 0 0;color:#a99d83;font-size:13px;line-height:1.55;}.tmf-module-item button{margin-top:8px;border:1px solid rgba(126,184,167,.42);background:rgba(126,184,167,.08);color:#bde6d9;font-family:inherit;padding:4px 9px;cursor:pointer;}',
      '.tmf-edict-paper{min-height:360px;padding:24px 30px;background:linear-gradient(180deg,#efe0b7,#d7c089);border:1px solid rgba(97,62,25,.55);box-shadow:inset 0 0 34px rgba(91,54,20,.20);color:#3f2713;font-size:20px;line-height:2;letter-spacing:.12em;}.tmf-edict-paper p{margin:0 0 10px;}.tmf-module-actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:14px;}.tmf-module-actions button,.tmf-module-stack button,.tmf-module-tabs button{border:1px solid rgba(184,154,83,.32);background:rgba(184,154,83,.08);color:#e6cf8e;font-family:inherit;padding:7px 12px;cursor:pointer;letter-spacing:.08em;}.tmf-module-actions button:hover,.tmf-module-stack button:hover,.tmf-module-tabs button:hover,.tmf-module-stack button.active,.tmf-module-tabs button.active{border-color:#d4be7a;color:#f5df9a;background:rgba(184,154,83,.15);}.tmf-module-stack{display:flex;flex-direction:column;gap:8px;}.tmf-module-tabs{display:grid;grid-template-columns:1fr 1fr;gap:8px;}',
      '.tmf-letter-editor{display:flex;flex-direction:column;gap:10px;}.tmf-letter-editor input,.tmf-letter-editor textarea,.tmf-module-search input{width:100%;box-sizing:border-box;border:1px solid rgba(184,154,83,.28);background:rgba(0,0,0,.20);color:#eadfbd;font-family:inherit;padding:9px 10px;}.tmf-letter-editor textarea{min-height:260px;line-height:1.8;resize:vertical;}.tmf-person-pick,.tmf-renwu-list-row{width:100%;display:flex;justify-content:space-between;gap:10px;align-items:center;text-align:left;border:1px solid rgba(184,154,83,.16);background:rgba(255,255,255,.022);color:#d8cba8;font-family:inherit;padding:8px 9px;cursor:pointer;}.tmf-person-pick b,.tmf-renwu-list-row b{color:#f0d98c;font-size:14px;}.tmf-person-pick span,.tmf-renwu-list-row span{color:#8f846f;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}.tmf-renwu-list-row.active{border-color:rgba(126,184,167,.56);background:rgba(126,184,167,.08);}',
      '.tmf-renwu-detail{display:grid;grid-template-columns:128px minmax(0,1fr);gap:16px;align-items:start;margin-bottom:18px;padding:14px;border:1px solid rgba(184,154,83,.20);background:rgba(255,255,255,.02);}.tmf-renwu-avatar{height:150px;border:1px solid rgba(201,168,95,.42);display:flex;align-items:center;justify-content:center;font-size:64px;color:#d7be73;background:radial-gradient(circle,rgba(201,168,95,.18),rgba(0,0,0,.22));}.tmf-renwu-detail h3{border:0;margin-bottom:6px;padding:0;font-size:26px;}.tmf-renwu-detail p{margin:6px 0;color:#c2b28f;line-height:1.7;}',
      'body.tm-phase8-formal .tmf-module-overlay-renwu{align-items:flex-start;justify-content:center;padding-top:54px;background:radial-gradient(ellipse at 50% 0,rgba(95,68,36,.22),transparent 46%),rgba(8,6,4,.72);backdrop-filter:blur(3px);box-sizing:border-box;}body.tm-phase8-formal .tmf-module-overlay-renwu .renwu-atlas{width:min(1180px,calc(100vw - 72px));height:calc(100vh - 96px);min-height:0;display:flex;flex-direction:column;border:1px solid rgba(201,160,69,.48);border-radius:4px;background:linear-gradient(180deg,rgba(28,22,17,.99),rgba(10,8,7,.985)),repeating-linear-gradient(90deg,rgba(255,236,170,.022) 0 1px,transparent 1px 34px);box-shadow:0 26px 80px rgba(0,0,0,.78),inset 0 0 0 1px rgba(0,0,0,.55);overflow:hidden;color:#eadfbd;font-family:"STKaiti","KaiTi","SimSun",serif;}body.tm-phase8-formal .renwu-atlas-head{flex:0 0 auto;display:flex;align-items:center;justify-content:space-between;gap:18px;padding:11px 14px;border-bottom:1px solid rgba(201,160,69,.20);background:linear-gradient(90deg,rgba(201,160,69,.08),rgba(126,184,167,.04),transparent);}body.tm-phase8-formal .renwu-titleblock{display:flex;align-items:center;gap:11px;min-width:0;}body.tm-phase8-formal .renwu-title-seal{width:38px;height:38px;display:grid;place-items:center;border-radius:3px;border:1px solid rgba(213,176,95,.52);background:radial-gradient(circle at 35% 25%,rgba(232,204,125,.24),rgba(109,39,25,.88) 62%,rgba(12,9,7,.95));color:#f2d98c;font-size:20px;letter-spacing:0;}body.tm-phase8-formal .renwu-titletext h2{margin:0;color:#f1d98d;font-size:20px;font-weight:500;letter-spacing:.16em;}body.tm-phase8-formal .renwu-titletext p{margin:4px 0 0;color:rgba(224,211,171,.58);font-size:12px;letter-spacing:.08em;}body.tm-phase8-formal .renwu-head-actions{display:flex;align-items:center;gap:7px;}body.tm-phase8-formal .renwu-head-btn{height:30px;min-width:34px;padding:0 11px;border:1px solid rgba(201,160,69,.30);border-radius:2px;background:rgba(0,0,0,.18);color:#d8c27c;font-family:inherit;cursor:pointer;}body.tm-phase8-formal .renwu-head-btn:hover{border-color:#d4be7a;color:#f4dc96;background:rgba(184,154,83,.12);}',
      'body.tm-phase8-formal .renwu-atlas-body{flex:1;min-height:0;display:grid;grid-template-columns:296px minmax(0,1fr) 242px;}body.tm-phase8-formal .renwu-roster{min-height:0;display:flex;flex-direction:column;border-right:1px solid rgba(201,160,69,.16);background:rgba(0,0,0,.10);overflow:hidden;}body.tm-phase8-formal .renwu-statbar{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;padding:9px;border-bottom:1px solid rgba(201,160,69,.12);}body.tm-phase8-formal .renwu-stat{min-width:0;padding:7px 6px;border:1px solid rgba(201,160,69,.16);border-radius:2px;background:rgba(255,245,210,.035);text-align:center;}body.tm-phase8-formal .renwu-stat b{display:block;color:#f1d98d;font-size:17px;line-height:1;}body.tm-phase8-formal .renwu-stat span{display:block;margin-top:4px;color:rgba(224,211,171,.52);font-size:10px;letter-spacing:.12em;}body.tm-phase8-formal .renwu-tools{padding:9px;border-bottom:1px solid rgba(201,160,69,.12);}body.tm-phase8-formal .renwu-tool-row{display:flex;gap:7px;}body.tm-phase8-formal .renwu-search,body.tm-phase8-formal .renwu-filter-row select{width:100%;height:28px;box-sizing:border-box;border:1px solid rgba(184,154,83,.26);border-radius:2px;background:rgba(0,0,0,.24);color:#eadfbd;font-family:inherit;font-size:12px;outline:none;}body.tm-phase8-formal .renwu-search{padding:0 9px;}body.tm-phase8-formal .renwu-filter-row{display:grid;gap:6px;margin-top:7px;}body.tm-phase8-formal .renwu-filter-row.three{grid-template-columns:repeat(3,minmax(0,1fr));}body.tm-phase8-formal .renwu-legend{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px;color:rgba(224,211,171,.58);font-size:10px;}body.tm-phase8-formal .renwu-legend span{padding:2px 6px;border:1px solid rgba(201,160,69,.13);border-radius:9px;background:rgba(0,0,0,.14);}body.tm-phase8-formal .renwu-legend b{color:#f1d98d;}body.tm-phase8-formal .renwu-roster-list{flex:1;min-height:0;overflow-y:auto;padding:8px 8px 12px;scrollbar-width:thin;scrollbar-color:rgba(201,160,69,.58) rgba(0,0,0,.25);}',
      'body.tm-phase8-formal .renwu-card{position:relative;width:100%;display:grid;grid-template-columns:44px minmax(0,1fr) 36px;gap:8px;align-items:center;margin:0 0 7px;padding:7px;border:1px solid rgba(201,160,69,.14);border-left:2px solid rgba(var(--rw-rgb,184,154,83),.55);border-radius:2px;background:linear-gradient(90deg,rgba(var(--rw-rgb,184,154,83),.055),rgba(0,0,0,.16));color:#eadfbd;font-family:inherit;text-align:left;cursor:pointer;}body.tm-phase8-formal .renwu-card:hover,body.tm-phase8-formal .renwu-card.active{border-color:rgba(var(--rw-rgb,184,154,83),.62);background:linear-gradient(90deg,rgba(var(--rw-rgb,184,154,83),.14),rgba(0,0,0,.18));}body.tm-phase8-formal .renwu-card.pinned:after{content:"钉";position:absolute;right:5px;top:4px;color:#f1d98d;font-size:10px;}body.tm-phase8-formal .renwu-thumb{width:44px;height:58px;object-fit:cover;border-radius:2px;border:1px solid rgba(201,160,69,.25);background:#17110d;}body.tm-phase8-formal .renwu-card-main{min-width:0;display:block;}body.tm-phase8-formal .renwu-card-name{display:block;color:#f2d98d;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}body.tm-phase8-formal .renwu-card-meta{display:block;margin-top:3px;color:rgba(224,211,171,.54);font-size:10.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}body.tm-phase8-formal .renwu-card-tags{display:flex;flex-wrap:wrap;gap:3px;margin-top:5px;}body.tm-phase8-formal .renwu-card-tags i{font-style:normal;padding:1px 5px;border:1px solid rgba(201,160,69,.14);border-radius:8px;color:rgba(224,211,171,.64);font-size:9px;}body.tm-phase8-formal .renwu-card-bars{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;margin-top:5px;}body.tm-phase8-formal .renwu-card-bars i{display:flex;align-items:center;gap:3px;font-style:normal;color:rgba(224,211,171,.48);font-size:9px;}body.tm-phase8-formal .renwu-card-bars b{height:3px;flex:1;background:linear-gradient(90deg,var(--rw-color,#b89a53) var(--v),rgba(255,255,255,.08) 0);}body.tm-phase8-formal .renwu-loyalty{display:grid;place-items:center;align-self:stretch;border-left:1px solid rgba(201,160,69,.12);}body.tm-phase8-formal .renwu-loyalty b{color:#f2ddb0;font-size:16px;}body.tm-phase8-formal .renwu-loyalty small{color:rgba(224,211,171,.48);font-size:9px;}',
      'body.tm-phase8-formal .renwu-main{min-width:0;min-height:0;display:flex;flex-direction:column;background:radial-gradient(ellipse at 20% 0,rgba(201,160,69,.07),transparent 38%),rgba(0,0,0,.08);overflow:hidden;}body.tm-phase8-formal .renwu-focus-v5{display:grid;grid-template-columns:132px minmax(0,1fr) 190px;gap:14px;padding:14px 16px;border-bottom:1px solid rgba(201,160,69,.16);background:linear-gradient(180deg,rgba(255,245,210,.045),rgba(0,0,0,.08));}body.tm-phase8-formal .renwu-portrait-frame{position:relative;}body.tm-phase8-formal .renwu-portrait-frame:after{content:"";position:absolute;right:9px;bottom:8px;width:18px;height:18px;border:1px solid rgba(213,176,95,.50);background:rgba(108,40,24,.84);box-shadow:0 4px 9px rgba(0,0,0,.35);}body.tm-phase8-formal .renwu-portrait-large{width:122px;height:164px;object-fit:cover;border-radius:3px;border:1px solid rgba(201,160,69,.32);box-shadow:0 10px 22px rgba(0,0,0,.36);background:#17110d;}body.tm-phase8-formal .renwu-name-v5{min-width:0;}body.tm-phase8-formal .renwu-name-v5 h3{margin:0;color:#f4dc96;font-size:26px;font-weight:500;letter-spacing:.12em;}body.tm-phase8-formal .renwu-name-v5 .sub{margin-top:5px;color:rgba(224,211,171,.56);font-size:12px;letter-spacing:.08em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}body.tm-phase8-formal .renwu-pillline-v5{display:flex;flex-wrap:wrap;gap:5px;margin-top:9px;}body.tm-phase8-formal .renwu-pillline-v5 span{padding:3px 7px;border:1px solid rgba(var(--rw-rgb,184,154,83),.22);border-radius:10px;background:rgba(0,0,0,.16);color:rgba(238,227,194,.72);font-size:10px;}body.tm-phase8-formal .renwu-scoreline-v5{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin-top:12px;}body.tm-phase8-formal .renwu-score-v5{padding:7px;border:1px solid rgba(201,160,69,.14);background:rgba(0,0,0,.18);}body.tm-phase8-formal .renwu-score-v5 span{display:block;color:rgba(224,211,171,.50);font-size:10px;letter-spacing:.10em;}body.tm-phase8-formal .renwu-score-v5 b{display:block;margin-top:4px;color:#f2ddb0;font-size:17px;}body.tm-phase8-formal .renwu-judgement-v5{padding:10px;border:1px solid rgba(var(--rw-rgb,184,154,83),.26);background:linear-gradient(180deg,rgba(var(--rw-rgb,184,154,83),.08),rgba(0,0,0,.14));}body.tm-phase8-formal .renwu-judgement-v5 b{display:block;color:#f1d98d;margin-bottom:6px;font-size:12px;letter-spacing:.12em;}body.tm-phase8-formal .renwu-judgement-v5 p{margin:0;color:rgba(238,227,194,.72);font-size:12px;line-height:1.65;}body.tm-phase8-formal .renwu-action-row.v5{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;}body.tm-phase8-formal .renwu-action-row button{height:30px;padding:0 11px;border:1px solid rgba(201,160,69,.25);border-radius:2px;background:rgba(0,0,0,.18);color:#e6cf8e;font-family:inherit;cursor:pointer;}body.tm-phase8-formal .renwu-action-row button:hover{border-color:#d4be7a;color:#f4dc96;background:rgba(184,154,83,.13);}',
      'body.tm-phase8-formal .renwu-tabs{flex:0 0 auto;display:flex;gap:3px;padding:7px 16px 0;border-bottom:1px solid rgba(201,160,69,.16);}body.tm-phase8-formal .renwu-tab{height:30px;padding:0 14px;border:1px solid rgba(201,160,69,.18);border-bottom:0;border-radius:2px 2px 0 0;background:rgba(0,0,0,.12);color:rgba(224,211,171,.62);font-family:inherit;cursor:pointer;}body.tm-phase8-formal .renwu-tab.active,body.tm-phase8-formal .renwu-tab:hover{color:#f1d98d;border-color:rgba(201,160,69,.38);background:rgba(201,160,69,.08);}body.tm-phase8-formal .renwu-detail-scroll{flex:1;min-height:0;overflow-y:auto;padding:12px 16px 16px;scrollbar-width:thin;scrollbar-color:rgba(201,160,69,.58) rgba(0,0,0,.25);}body.tm-phase8-formal .renwu-grid-2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;}body.tm-phase8-formal .renwu-sec{margin-bottom:10px;border:1px solid rgba(201,160,69,.14);border-radius:2px;background:rgba(255,245,210,.028);overflow:hidden;}body.tm-phase8-formal .renwu-sec-title{padding:7px 9px;border-bottom:1px solid rgba(201,160,69,.12);color:#d7be73;font-size:12px;letter-spacing:.16em;background:rgba(0,0,0,.12);}body.tm-phase8-formal .renwu-prose{padding:9px 10px;color:rgba(238,227,194,.72);font-size:13px;line-height:1.75;white-space:pre-wrap;}body.tm-phase8-formal .renwu-list{padding:7px 9px;display:grid;gap:6px;}body.tm-phase8-formal .renwu-list-row{display:grid;grid-template-columns:74px minmax(0,1fr);gap:8px;align-items:start;padding-bottom:6px;border-bottom:1px solid rgba(201,160,69,.08);}body.tm-phase8-formal .renwu-list-row:last-child{border-bottom:0;}body.tm-phase8-formal .renwu-list-row span{color:rgba(224,211,171,.48);font-size:11px;}body.tm-phase8-formal .renwu-list-row b{color:rgba(238,227,194,.78);font-size:12.5px;font-weight:400;line-height:1.55;}body.tm-phase8-formal .renwu-ability-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;padding:9px;}body.tm-phase8-formal .renwu-ability{padding:7px;border:1px solid rgba(201,160,69,.12);background:rgba(0,0,0,.14);}body.tm-phase8-formal .renwu-ability span{color:rgba(224,211,171,.50);font-size:10px;}body.tm-phase8-formal .renwu-ability b{display:block;margin-top:3px;color:#f2ddb0;font-size:16px;}body.tm-phase8-formal .renwu-ability i{display:block;height:4px;margin-top:5px;background:linear-gradient(90deg,var(--rw-color,#b89a53) var(--v),rgba(255,255,255,.08) 0);}body.tm-phase8-formal .renwu-memory{padding:9px 10px;color:rgba(238,227,194,.72);font-size:12px;}body.tm-phase8-formal .renwu-memory summary{cursor:pointer;color:#f1d98d;letter-spacing:.10em;}body.tm-phase8-formal .renwu-memory p{margin:8px 0 0;line-height:1.65;}body.tm-phase8-formal .renwu-memory p b{display:inline-grid;place-items:center;width:18px;height:18px;margin-right:7px;border:1px solid rgba(201,160,69,.18);border-radius:50%;color:#d7be73;font-size:10px;}body.tm-phase8-formal .renwu-rel-list{display:grid;gap:7px;padding:9px;}body.tm-phase8-formal .renwu-rel-list button{display:grid;grid-template-columns:70px minmax(0,1fr) 40px;gap:8px;align-items:center;border:1px solid rgba(201,160,69,.14);background:rgba(0,0,0,.14);color:#eadfbd;font-family:inherit;padding:7px 9px;text-align:left;cursor:pointer;}body.tm-phase8-formal .renwu-rel-list span{color:#8dbdab;font-size:11px;}body.tm-phase8-formal .renwu-rel-list b{font-size:13px;color:#f2d98d;font-weight:400;}body.tm-phase8-formal .renwu-rel-list i{font-style:normal;text-align:right;color:rgba(238,227,194,.64);}body.tm-phase8-formal .renwu-timeline{padding:9px;display:grid;gap:7px;}body.tm-phase8-formal .renwu-timeline div{display:grid;grid-template-columns:70px minmax(0,1fr);gap:8px;border-bottom:1px solid rgba(201,160,69,.08);padding-bottom:7px;}body.tm-phase8-formal .renwu-timeline span{color:#8dbdab;font-size:11px;}body.tm-phase8-formal .renwu-timeline b{color:rgba(238,227,194,.74);font-size:12.5px;font-weight:400;}',
      'body.tm-phase8-formal .renwu-side{min-height:0;display:flex;flex-direction:column;border-left:1px solid rgba(201,160,69,.16);background:rgba(0,0,0,.13);overflow:hidden;}body.tm-phase8-formal .renwu-side-top{padding:12px;border-bottom:1px solid rgba(201,160,69,.13);}body.tm-phase8-formal .renwu-side-title{color:#d7be73;font-size:12px;letter-spacing:.16em;margin-bottom:8px;}body.tm-phase8-formal .renwu-mini-network{position:relative;height:180px;border:1px solid rgba(201,160,69,.14);background:radial-gradient(circle at 50% 50%,rgba(var(--rw-rgb,184,154,83),.12),transparent 52%),rgba(0,0,0,.15);overflow:hidden;}body.tm-phase8-formal .renwu-mini-network:before{content:"";position:absolute;left:16%;right:16%;top:50%;height:1px;background:rgba(201,160,69,.18);box-shadow:0 -46px 0 rgba(201,160,69,.10),0 46px 0 rgba(201,160,69,.10);transform:rotate(-18deg);}body.tm-phase8-formal .renwu-mini-node{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);max-width:74px;padding:4px 7px;border:1px solid rgba(201,160,69,.24);border-radius:12px;background:rgba(15,12,9,.86);color:#e6cf8e;font-family:inherit;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;}body.tm-phase8-formal .renwu-mini-node.self{border-color:rgba(var(--rw-rgb,184,154,83),.62);color:#f4dc96;background:rgba(var(--rw-rgb,184,154,83),.18);}body.tm-phase8-formal .renwu-side-scroll{flex:1;min-height:0;overflow-y:auto;padding:10px;scrollbar-width:thin;scrollbar-color:rgba(201,160,69,.58) rgba(0,0,0,.25);}body.tm-phase8-formal .renwu-side-card{margin-bottom:8px;padding:9px;border:1px solid rgba(201,160,69,.14);border-radius:2px;background:rgba(255,245,210,.028);}body.tm-phase8-formal .renwu-side-card b{display:block;color:#f1d98d;margin-bottom:5px;font-size:12px;letter-spacing:.12em;}body.tm-phase8-formal .renwu-side-card span{display:block;color:rgba(238,227,194,.68);font-size:12px;line-height:1.55;}@media(max-width:1180px){body.tm-phase8-formal .tmf-module-overlay-renwu .renwu-atlas{width:calc(100vw - 32px);}body.tm-phase8-formal .renwu-atlas-body{grid-template-columns:276px minmax(0,1fr);}body.tm-phase8-formal .renwu-side{display:none;}body.tm-phase8-formal .renwu-focus-v5{grid-template-columns:122px minmax(0,1fr);}body.tm-phase8-formal .renwu-judgement-v5{grid-column:1 / -1;}body.tm-phase8-formal .renwu-grid-2{grid-template-columns:1fr;}}',
      'body.tm-phase8-formal .renwu-action-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding:10px;}body.tm-phase8-formal .renwu-action-grid button{min-height:54px;padding:8px 10px;border:1px solid rgba(201,160,69,.20);border-radius:2px;background:linear-gradient(180deg,rgba(201,160,69,.06),rgba(0,0,0,.16));color:#e6cf8e;font-family:inherit;text-align:left;cursor:pointer;}body.tm-phase8-formal .renwu-action-grid button.primary{border-color:rgba(213,176,95,.50);background:linear-gradient(180deg,rgba(224,184,92,.18),rgba(97,52,22,.34));color:#f4dc96;}body.tm-phase8-formal .renwu-action-grid button:hover{border-color:#d4be7a;background:rgba(184,154,83,.14);}body.tm-phase8-formal .renwu-action-grid button span{display:block;margin-top:5px;color:rgba(238,227,194,.54);font-size:11px;line-height:1.45;}',
      'body.tm-phase8-formal .renwu-check{height:28px;display:flex;align-items:center;gap:5px;padding:0 7px;border:1px solid rgba(201,160,69,.18);border-radius:2px;background:rgba(0,0,0,.18);color:rgba(232,217,174,.66);font-size:10px;white-space:nowrap;}body.tm-phase8-formal .renwu-check input{accent-color:#c9a045;}body.tm-phase8-formal .renwu-wuchang{display:flex;flex-wrap:wrap;gap:5px;padding:9px 10px;}body.tm-phase8-formal .renwu-wuchang.compact{padding:5px 0 0;gap:3px;}body.tm-phase8-formal .renwu-wuchang span{min-width:34px;height:24px;display:flex;align-items:center;justify-content:center;gap:3px;border:1px solid rgba(201,160,69,.18);border-radius:12px;background:rgba(0,0,0,.16);color:rgba(232,217,174,.62);font-size:10px;}body.tm-phase8-formal .renwu-wuchang.compact span{min-width:22px;height:17px;font-size:9px;}body.tm-phase8-formal .renwu-wuchang span b{font-weight:500;color:inherit;}body.tm-phase8-formal .renwu-wuchang span i{font-style:normal;color:rgba(238,227,194,.58);}body.tm-phase8-formal .renwu-wuchang.compact span i{display:none;}body.tm-phase8-formal .renwu-wuchang span.hi{color:#f2d98d;border-color:rgba(242,217,141,.42);background:rgba(201,160,69,.09);}body.tm-phase8-formal .renwu-wuchang span.mid{color:#bfc9a0;}body.tm-phase8-formal .renwu-wuchang span.lo{color:#bd8a7d;border-color:rgba(189,138,125,.25);}body.tm-phase8-formal .renwu-source-list{padding:9px 10px;display:grid;gap:7px;}body.tm-phase8-formal .renwu-source-list p{margin:0;padding:7px 8px;border-left:2px solid rgba(var(--rw-rgb,184,154,83),.42);background:rgba(0,0,0,.14);color:rgba(238,227,194,.70);font-size:12px;line-height:1.65;}',
      'body.tm-phase8-formal .tmf-module-overlay-renwu{padding-top:58px;background:radial-gradient(ellipse at 28% 18%,rgba(212,190,122,.09),transparent 36%),radial-gradient(ellipse at 76% 82%,rgba(126,184,167,.07),transparent 36%),rgba(5,4,3,.62);backdrop-filter:blur(2px);}body.tm-phase8-formal .tmf-module-overlay-renwu .renwu-atlas{width:min(1340px,calc(100vw - 54px));height:calc(100vh - 86px);border-color:rgba(201,160,69,.43);border-radius:7px;background:linear-gradient(180deg,rgba(36,28,20,.98),rgba(12,10,8,.96)),repeating-linear-gradient(90deg,transparent 0,transparent 36px,rgba(201,160,69,.025) 36px,rgba(201,160,69,.025) 37px);box-shadow:0 26px 72px rgba(0,0,0,.64),inset 0 1px 0 rgba(255,241,190,.10);}body.tm-phase8-formal .renwu-atlas{position:relative;}body.tm-phase8-formal .renwu-atlas:before{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(90deg,rgba(149,41,31,.13),transparent 18%,transparent 82%,rgba(126,184,167,.08)),radial-gradient(ellipse at 50% 0,rgba(236,199,116,.11),transparent 48%);mix-blend-mode:screen;}body.tm-phase8-formal .renwu-atlas-head{position:relative;z-index:1;display:grid;grid-template-columns:1fr auto;gap:18px;padding:15px 17px 13px;border-bottom:1px solid rgba(201,160,69,.24);background:linear-gradient(180deg,rgba(8,7,5,.62),rgba(8,7,5,.18)),radial-gradient(ellipse at 12% 0,rgba(201,160,69,.12),transparent 46%);}body.tm-phase8-formal .renwu-titleblock{gap:13px;}body.tm-phase8-formal .renwu-title-seal{width:48px;height:48px;border-radius:50%;color:#f7e6bc;background:radial-gradient(circle at 35% 28%,#b84738,#6f2019 62%,#2a0d0a);border:1px solid rgba(244,211,139,.44);box-shadow:inset 0 0 0 2px rgba(0,0,0,.26),0 0 18px rgba(184,71,56,.26);font-family:serif;font-size:17px;letter-spacing:.06em;transform:rotate(-6deg);}body.tm-phase8-formal .renwu-titletext h2{font-family:serif;font-size:22px;font-weight:700;letter-spacing:.22em;}body.tm-phase8-formal .renwu-titletext p{font-size:11px;letter-spacing:.11em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}body.tm-phase8-formal .renwu-head-actions{gap:8px;}body.tm-phase8-formal .renwu-head-btn{height:32px;padding:0 12px;border-radius:4px;color:rgba(234,220,181,.78);background:linear-gradient(180deg,rgba(53,38,22,.64),rgba(13,10,8,.58));letter-spacing:.10em;}',
      'body.tm-phase8-formal .renwu-atlas-body{position:relative;z-index:1;display:grid;grid-template-columns:330px minmax(0,1fr) 292px;}body.tm-phase8-formal .renwu-roster{display:grid;grid-template-rows:auto auto minmax(0,1fr);background:linear-gradient(180deg,rgba(0,0,0,.18),rgba(0,0,0,.08));}body.tm-phase8-formal .renwu-statbar{gap:7px;padding:12px;}body.tm-phase8-formal .renwu-stat{padding:8px 7px;border-radius:5px;text-align:left;background:rgba(255,245,210,.04);}body.tm-phase8-formal .renwu-stat b{font-size:18px;}body.tm-phase8-formal .renwu-stat span{margin-top:3px;}body.tm-phase8-formal .renwu-tools{display:grid;gap:8px;padding:11px 12px;}body.tm-phase8-formal .renwu-tool-row{display:grid;grid-template-columns:1fr auto;gap:7px;align-items:center;}body.tm-phase8-formal .renwu-search{height:34px;border-color:rgba(201,160,69,.30);border-radius:4px;background:rgba(5,5,4,.62);color:#f2e5bf;}body.tm-phase8-formal .renwu-filter-row{gap:7px;margin-top:0;}body.tm-phase8-formal .renwu-filter-row select{height:30px;border-color:rgba(201,160,69,.24);border-radius:4px;background:#11100d;color:rgba(232,217,174,.78);}body.tm-phase8-formal .renwu-roster-list{padding:10px 10px 13px;}body.tm-phase8-formal .renwu-check{height:30px;border-radius:4px;padding:0 8px;gap:6px;}body.tm-phase8-formal .renwu-legend{padding:0;margin-top:0;}body.tm-phase8-formal .renwu-legend span{border-color:rgba(var(--rw-rgb,184,154,83),.28);border-radius:999px;color:var(--rw-color,#d4be7a);background:rgba(var(--rw-rgb,184,154,83),.07);}',
      'body.tm-phase8-formal .renwu-card{grid-template-columns:58px minmax(0,1fr) 48px;gap:9px;margin-bottom:9px;padding:8px;border-left:3px solid var(--rw-color,#b89a53);border-radius:5px;background:linear-gradient(90deg,rgba(var(--rw-rgb,184,154,83),.08),transparent 56%),rgba(255,245,210,.035);transition:transform .14s ease,border-color .14s ease,background .14s ease;}body.tm-phase8-formal .renwu-card:hover,body.tm-phase8-formal .renwu-card.active{transform:translateY(-1px);border-color:rgba(238,211,139,.48);background:linear-gradient(90deg,rgba(var(--rw-rgb,184,154,83),.16),transparent 60%),rgba(255,245,210,.055);}body.tm-phase8-formal .renwu-thumb{width:58px;height:76px;border-radius:3px;border-color:rgba(201,160,69,.32);box-shadow:inset 0 0 0 1px rgba(255,255,255,.05);}body.tm-phase8-formal .renwu-card-name{color:#f3e5bc;font-size:13px;letter-spacing:.08em;}body.tm-phase8-formal .renwu-card-meta{font-size:10.5px;line-height:1.45;white-space:normal;}body.tm-phase8-formal .renwu-card-tags{gap:4px;margin-top:6px;}body.tm-phase8-formal .renwu-card-tags i{border-radius:999px;background:rgba(0,0,0,.18);}body.tm-phase8-formal .renwu-card-bars{gap:4px;margin-top:6px;}body.tm-phase8-formal .renwu-card-bars i{display:grid;grid-template-columns:12px minmax(0,1fr);gap:3px;}body.tm-phase8-formal .renwu-card-bars b{height:3px;border-radius:4px;background:linear-gradient(90deg,var(--rw-color,#b89a53) var(--v),rgba(255,245,210,.11) 0);}body.tm-phase8-formal .renwu-loyalty{border-left:0;gap:3px;}body.tm-phase8-formal .renwu-loyalty b{color:var(--rw-color,#d4be7a);font-size:17px;}',
      'body.tm-phase8-formal .renwu-focus-v5{display:grid;grid-template-columns:190px minmax(0,1fr);gap:18px;padding:18px;border-bottom:1px solid rgba(201,160,69,.13);background:radial-gradient(ellipse at 24% 20%,rgba(var(--rw-rgb,184,154,83),.10),transparent 48%),rgba(0,0,0,.10);}body.tm-phase8-formal .renwu-portrait-frame{grid-row:1 / span 2;min-width:0;height:240px;align-self:start;}body.tm-phase8-formal .renwu-portrait-frame:before,body.tm-phase8-formal .renwu-portrait-frame:after{content:"";position:absolute;width:30px;height:30px;border-color:rgba(238,211,139,.62);background:transparent;box-shadow:none;pointer-events:none;}body.tm-phase8-formal .renwu-portrait-frame:before{left:9px;top:9px;border-left:1px solid;border-top:1px solid;}body.tm-phase8-formal .renwu-portrait-frame:after{right:19px;bottom:9px;border-right:1px solid;border-bottom:1px solid;}body.tm-phase8-formal .renwu-portrait-large{width:180px;height:240px;border-radius:5px;border-color:rgba(201,160,69,.42);box-shadow:0 14px 28px rgba(0,0,0,.38),inset 0 0 0 1px rgba(255,255,255,.05);}body.tm-phase8-formal .renwu-name-v5 h3{font-family:serif;font-size:28px;letter-spacing:.18em;line-height:1.15;}body.tm-phase8-formal .renwu-name-v5 .sub{font-size:13px;letter-spacing:.12em;}body.tm-phase8-formal .renwu-pillline-v5{gap:6px;margin-top:10px;}body.tm-phase8-formal .renwu-pillline-v5 span{border-radius:3px;font-size:11px;letter-spacing:.08em;}body.tm-phase8-formal .renwu-scoreline-v5{gap:8px;margin-top:14px;}body.tm-phase8-formal .renwu-score-v5{padding:8px;border-radius:5px;background:rgba(0,0,0,.20);}body.tm-phase8-formal .renwu-score-v5 b{font-size:17px;}body.tm-phase8-formal .renwu-judgement-v5{grid-column:2;margin-top:-2px;border-radius:5px;font-size:11.5px;line-height:1.55;}body.tm-phase8-formal .renwu-action-row.v5{gap:7px;margin-top:15px;}body.tm-phase8-formal .renwu-action-row button{min-height:30px;border-radius:4px;background:linear-gradient(180deg,rgba(53,38,22,.64),rgba(13,10,8,.58));}',
      'body.tm-phase8-formal .renwu-tabs{gap:4px;padding:9px 16px 0;}body.tm-phase8-formal .renwu-tab{height:32px;border-radius:4px 4px 0 0;letter-spacing:.08em;}body.tm-phase8-formal .renwu-detail-scroll{padding:12px 16px 16px;}body.tm-phase8-formal .renwu-grid-2{gap:12px;}body.tm-phase8-formal .renwu-sec{border-radius:5px;background:rgba(255,245,210,.034);}body.tm-phase8-formal .renwu-sec-title{padding:8px 10px;color:#f1d98d;background:rgba(0,0,0,.16);}body.tm-phase8-formal .renwu-list-row{grid-template-columns:82px minmax(0,1fr);padding-bottom:7px;}body.tm-phase8-formal .renwu-ability-grid{gap:8px;padding:10px;}body.tm-phase8-formal .renwu-ability{border-radius:5px;background:rgba(0,0,0,.18);}body.tm-phase8-formal .renwu-wuchang{gap:5px;margin-top:0;}body.tm-phase8-formal .renwu-wuchang.compact{padding:5px 0 0;gap:3px;}body.tm-phase8-formal .renwu-wuchang.compact span{width:17px;min-width:17px;height:17px;border-radius:50%;padding:0;}body.tm-phase8-formal .renwu-wuchang:not(.compact) span{min-width:42px;height:25px;border-radius:14px;}',
      'body.tm-phase8-formal .renwu-side{background:rgba(0,0,0,.13);}body.tm-phase8-formal .renwu-side-top{padding:12px;}body.tm-phase8-formal .renwu-mini-network{height:180px;}body.tm-phase8-formal .renwu-side-scroll{padding:10px;}body.tm-phase8-formal .renwu-side-card{margin-bottom:8px;padding:9px;border-radius:5px;background:rgba(255,245,210,.032);}body.tm-phase8-formal .renwu-side-card>b{font-size:12px;letter-spacing:.12em;}body.tm-phase8-formal .renwu-side-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;}body.tm-phase8-formal .renwu-side-metric{padding:7px;border:1px solid rgba(201,160,69,.12);border-radius:4px;background:rgba(0,0,0,.18);}body.tm-phase8-formal .renwu-side-metric span{font-size:10px!important;color:rgba(224,211,171,.52)!important;}body.tm-phase8-formal .renwu-side-metric b{display:block!important;margin:4px 0 0!important;color:#f3e5bc!important;font-size:15px!important;letter-spacing:0!important;}body.tm-phase8-formal .renwu-mini-list{display:grid;gap:6px;}body.tm-phase8-formal .renwu-mini-list span,body.tm-phase8-formal .renwu-mini-list button{display:grid;grid-template-columns:44px minmax(0,1fr) auto;gap:6px;align-items:center;width:100%;box-sizing:border-box;border:1px solid rgba(201,160,69,.12);border-radius:4px;background:rgba(0,0,0,.14);color:rgba(238,227,194,.70);font-family:inherit;font-size:12px;line-height:1.45;text-align:left;padding:6px 7px;}body.tm-phase8-formal .renwu-mini-list button{cursor:pointer;}body.tm-phase8-formal .renwu-mini-list i{font-style:normal;color:#8dbdab;font-size:10px;white-space:nowrap;}body.tm-phase8-formal .renwu-mini-list em{font-style:normal;color:rgba(238,227,194,.58);font-size:11px;}body.tm-phase8-formal .renwu-index-tags{display:flex;flex-wrap:wrap;gap:5px;}body.tm-phase8-formal .renwu-index-tags span{display:inline-flex!important;width:auto;padding:2px 7px;border:1px solid rgba(var(--rw-rgb,184,154,83),.28);border-radius:999px;color:var(--rw-color,#d4be7a)!important;background:rgba(var(--rw-rgb,184,154,83),.07);font-size:10px!important;line-height:1.4!important;}@media(max-width:1180px){body.tm-phase8-formal .renwu-atlas-body{grid-template-columns:300px minmax(0,1fr);}body.tm-phase8-formal .renwu-side{display:none;}body.tm-phase8-formal .renwu-focus-v5{grid-template-columns:150px minmax(0,1fr);}body.tm-phase8-formal .renwu-portrait-large{width:140px;height:186px;}body.tm-phase8-formal .renwu-judgement-v5{grid-column:1 / -1;}body.tm-phase8-formal .renwu-grid-2{grid-template-columns:1fr;}}',
      'body.tm-phase8-formal .renwu-main{display:grid!important;grid-template-rows:auto auto minmax(0,1fr)!important;background:transparent!important;}body.tm-phase8-formal .renwu-profile-head{display:grid;grid-template-columns:190px minmax(0,1fr);gap:18px;padding:18px;border-bottom:1px solid rgba(201,160,69,.13);background:radial-gradient(ellipse at 24% 20%,rgba(var(--rw-rgb,184,154,83),.10),transparent 48%),rgba(0,0,0,.10);}body.tm-phase8-formal .renwu-profile-title{min-width:0;}body.tm-phase8-formal .renwu-profile-title h3{margin:0;color:#f4dc96;font-family:serif;font-size:28px;letter-spacing:.18em;line-height:1.15;}body.tm-phase8-formal .renwu-profile-title .courtesy{color:rgba(224,211,171,.56);font-size:13px;letter-spacing:.12em;margin-top:5px;}body.tm-phase8-formal .renwu-profile-title .office{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;}body.tm-phase8-formal .renwu-pill{padding:3px 8px;border:1px solid rgba(201,160,69,.18);border-radius:3px;color:rgba(232,217,174,.74);background:rgba(0,0,0,.20);font-size:11px;letter-spacing:.08em;}body.tm-phase8-formal .renwu-pill.faction{color:var(--rw-color,#d4be7a);border-color:rgba(var(--rw-rgb,184,154,83),.38);background:rgba(var(--rw-rgb,184,154,83),.08);}body.tm-phase8-formal .renwu-portrait-frame{position:relative!important;min-width:0!important;height:240px!important;align-self:start!important;grid-row:auto!important;}body.tm-phase8-formal .renwu-portrait-frame:before,body.tm-phase8-formal .renwu-portrait-frame:after{content:""!important;position:absolute!important;width:30px!important;height:30px!important;border-color:rgba(238,211,139,.62)!important;background:transparent!important;box-shadow:none!important;pointer-events:none!important;}body.tm-phase8-formal .renwu-portrait-frame:before{left:9px!important;top:9px!important;border-left:1px solid!important;border-top:1px solid!important;}body.tm-phase8-formal .renwu-portrait-frame:after{right:19px!important;bottom:9px!important;border-right:1px solid!important;border-bottom:1px solid!important;}body.tm-phase8-formal .renwu-heart-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:14px;}body.tm-phase8-formal .renwu-heart{padding:8px;border:1px solid rgba(201,160,69,.14);border-radius:5px;background:rgba(0,0,0,.20);}body.tm-phase8-formal .renwu-heart span{display:block;color:rgba(224,211,171,.52);font-size:10px;letter-spacing:.12em;}body.tm-phase8-formal .renwu-heart b{display:block;margin-top:4px;color:#f3e5bc;font-size:17px;line-height:1;}body.tm-phase8-formal .renwu-verdict{margin-top:10px;padding:7px 9px;border:1px solid rgba(201,160,69,.16);border-radius:5px;color:rgba(238,227,194,.70);background:rgba(0,0,0,.18);font-size:11.5px;line-height:1.55;}body.tm-phase8-formal .renwu-verdict b{display:block;color:#f1d98d;margin-bottom:4px;font-size:12px;}body.tm-phase8-formal .renwu-verdict p{margin:0;}body.tm-phase8-formal .renwu-card-tags span{padding:1px 5px;border:1px solid rgba(201,160,69,.14);border-radius:999px;color:rgba(232,217,174,.64);background:rgba(0,0,0,.18);font-size:9px;}body.tm-phase8-formal .renwu-card-bar{display:grid;grid-template-columns:12px minmax(0,1fr);gap:3px;align-items:center;color:rgba(224,211,171,.48);font-size:9px;}body.tm-phase8-formal .renwu-card-bar i{display:block!important;height:3px!important;border-radius:4px;background:rgba(255,245,210,.11)!important;overflow:hidden;}body.tm-phase8-formal .renwu-card-bar i:before{content:"";display:block;width:var(--v,50%);height:100%;background:linear-gradient(90deg,var(--rw-color,#b89a53),rgba(242,217,141,.85));}body.tm-phase8-formal .renwu-ability-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding:10px;}body.tm-phase8-formal .renwu-ability{display:grid;grid-template-columns:26px minmax(0,1fr) 32px;gap:7px;align-items:center;padding:0;border:0;background:transparent;}body.tm-phase8-formal .renwu-ability .k{width:24px;height:24px;display:grid;place-items:center;border-radius:50%;color:#f1d98c;border:1px solid rgba(201,160,69,.32);background:rgba(0,0,0,.20);font-size:11px;}body.tm-phase8-formal .renwu-ability .bar{display:block;height:6px;border-radius:8px;overflow:hidden;background:rgba(255,245,210,.10);}body.tm-phase8-formal .renwu-ability .fill{display:block;height:100%;border-radius:8px;background:linear-gradient(90deg,var(--rw-color,#b89a53),#f0d68d);}body.tm-phase8-formal .renwu-ability .v{color:#f3e5bc;font-size:12px;text-align:right;}body.tm-phase8-formal .renwu-panel.active{display:block;padding-bottom:12px;}body.tm-phase8-formal .renwu-id-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;padding:10px;}body.tm-phase8-formal .renwu-id-cell{min-width:0;padding:8px;border:1px solid rgba(201,160,69,.10);border-radius:5px;background:rgba(0,0,0,.15);}body.tm-phase8-formal .renwu-id-cell span{display:block;color:rgba(224,211,171,.48);font-size:10px;letter-spacing:.12em;}body.tm-phase8-formal .renwu-id-cell b{display:block;margin-top:4px;color:rgba(242,232,202,.84);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}body.tm-phase8-formal .renwu-quality-grid,body.tm-phase8-formal .renwu-resource-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;padding:10px;}body.tm-phase8-formal .renwu-resource{padding:9px 8px;border:1px solid rgba(201,160,69,.12);border-radius:5px;background:rgba(0,0,0,.16);}body.tm-phase8-formal .renwu-resource span{display:block;color:rgba(224,211,171,.50);font-size:10px;letter-spacing:.12em;}body.tm-phase8-formal .renwu-resource b{display:block;margin-top:5px;color:#f1d98c;font-size:15px;}body.tm-phase8-formal .renwu-family-tree{padding:12px;}body.tm-phase8-formal .renwu-family-row{display:flex;justify-content:center;gap:9px;margin:8px 0;flex-wrap:wrap;}body.tm-phase8-formal .renwu-family-node{min-width:86px;padding:7px 9px;text-align:center;border:1px solid rgba(201,160,69,.20);border-radius:5px;background:rgba(0,0,0,.18);color:rgba(238,227,194,.76);font-size:11px;}body.tm-phase8-formal .renwu-family-node.self{border-color:rgba(242,217,141,.60);color:#24160c;background:linear-gradient(180deg,#f2d98c,#b9853a);font-weight:700;}body.tm-phase8-formal .renwu-family-line{height:18px;width:1px;margin:0 auto;background:linear-gradient(180deg,rgba(201,160,69,.38),rgba(201,160,69,.08));}body.tm-phase8-formal .renwu-work-card{margin:8px 10px;padding:8px 10px;border:1px solid rgba(201,160,69,.13);border-radius:5px;background:rgba(0,0,0,.18);}body.tm-phase8-formal .renwu-work-card b{display:block;color:#f1d98c;font-size:12px;margin-bottom:4px;}body.tm-phase8-formal .renwu-work-card span{display:block;color:rgba(238,227,194,.66);font-size:11px;line-height:1.55;}',
      'body.tm-phase8-formal #gs-status-bar,body.tm-phase8-formal .gs-status-bar{display:none!important;}body.tm-phase8-formal .renwu-title-line{display:flex;align-items:center;gap:10px;}body.tm-phase8-formal .renwu-title-line h2{margin:0!important;}body.tm-phase8-formal .renwu-ceming-btn{height:28px;padding:0 10px;border:1px solid rgba(201,160,69,.36);border-radius:4px;background:linear-gradient(180deg,rgba(201,160,69,.13),rgba(0,0,0,.18));color:#f1d98d;font-family:inherit;font-size:12px;letter-spacing:.12em;cursor:pointer;}body.tm-phase8-formal .renwu-ceming-btn:hover{border-color:rgba(242,217,141,.62);background:rgba(201,160,69,.18);}body.tm-phase8-formal .tmf-module-overlay-renwu{align-items:flex-start!important;justify-content:center!important;padding:0!important;overflow:hidden!important;overscroll-behavior:contain!important;}body.tm-phase8-formal .tmf-module-overlay-renwu .renwu-atlas{position:fixed!important;left:50%!important;top:58px!important;transform:translateX(-50%)!important;margin:0!important;max-height:calc(100vh - 86px)!important;}',
      '.tmf-shizheng-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;}.tmf-shizheng-grid article{border:1px solid rgba(184,154,83,.18);background:rgba(255,255,255,.025);padding:12px;min-height:132px;}.tmf-shizheng-grid b{display:block;color:#f0d98c;font-size:17px;letter-spacing:.10em;}.tmf-shizheng-grid span{display:inline-block;margin-top:6px;color:#8dbdab;font-size:12px;}.tmf-shizheng-grid p{color:#b9aa8a;font-size:13px;line-height:1.65;}.tmf-shizheng-grid button{border:1px solid rgba(126,184,167,.42);background:rgba(126,184,167,.08);color:#bde6d9;font-family:inherit;padding:5px 10px;cursor:pointer;}',
      'body.tm-phase8-formal .tmf-module-shizheng .tmf-module-body{grid-template-columns:318px minmax(0,1fr) 230px!important;}body.tm-phase8-formal .tmf-module-shizheng .tmf-module-left,body.tm-phase8-formal .tmf-module-shizheng .tmf-module-main,body.tm-phase8-formal .tmf-module-shizheng .tmf-module-right{min-height:0;}body.tm-phase8-formal .tmf-sz-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-bottom:10px;}body.tm-phase8-formal .tmf-sz-summary span{min-height:56px;display:flex;flex-direction:column;align-items:center;justify-content:center;border:1px solid rgba(201,168,95,.22);background:radial-gradient(ellipse at 50% 0,rgba(201,168,95,.12),transparent 60%),rgba(0,0,0,.16);}body.tm-phase8-formal .tmf-sz-summary i{font-style:normal;color:#8dbdab;font-size:11px;letter-spacing:.14em;}body.tm-phase8-formal .tmf-sz-summary b{margin-top:4px;color:#f0d98c;font-size:22px;line-height:1;font-weight:500;}body.tm-phase8-formal .tmf-sz-list{height:calc(100% - 66px);min-height:0;overflow:auto;display:flex;flex-direction:column;gap:8px;padding-right:4px;}',
      'body.tm-phase8-formal .tmf-sz-card{position:relative;min-height:118px;width:100%;display:block;text-align:left;padding:12px 12px 11px;border:1px solid rgba(201,168,95,.22);border-left:3px solid rgba(198,76,54,.55);background:linear-gradient(180deg,rgba(35,26,18,.86),rgba(16,12,9,.78));color:#eadfbd;font-family:inherit;cursor:pointer;box-shadow:inset 0 1px 0 rgba(255,238,186,.04),0 8px 18px rgba(0,0,0,.18);}body.tm-phase8-formal .tmf-sz-card.ok{opacity:.72;border-left-color:rgba(126,184,167,.52);background:linear-gradient(180deg,rgba(26,28,22,.78),rgba(13,12,9,.72));}body.tm-phase8-formal .tmf-sz-card.active,body.tm-phase8-formal .tmf-sz-card:hover{border-color:rgba(238,202,118,.48);box-shadow:inset 0 0 0 1px rgba(238,202,118,.10),0 10px 22px rgba(0,0,0,.26);transform:translateX(2px);}body.tm-phase8-formal .tmf-sz-card b{display:block;margin:0 54px 6px 0;color:#f0d98c;font-size:17px;line-height:1.25;letter-spacing:.08em;}body.tm-phase8-formal .tmf-sz-card em{display:block;margin-bottom:7px;color:#8dbdab;font-style:normal;font-size:11px;line-height:1.35;}body.tm-phase8-formal .tmf-sz-card p{margin:0;color:#b9aa8a;font-size:12.5px;line-height:1.55;}body.tm-phase8-formal .tmf-sz-badge{position:absolute;right:10px;top:10px;padding:2px 8px;border:1px solid rgba(201,168,95,.30);background:rgba(0,0,0,.20);color:#d8c27c;font-size:11px;letter-spacing:.12em;transform:rotate(2deg);}',
      'body.tm-phase8-formal .tmf-sz-detail{height:100%;min-height:0;overflow:auto;padding-right:6px;}body.tm-phase8-formal .tmf-sz-detail-head{text-align:center;margin-bottom:12px;padding:16px 18px 14px;border:1px solid rgba(201,168,95,.24);background:radial-gradient(ellipse at 50% 0,rgba(201,168,95,.12),transparent 62%),linear-gradient(180deg,rgba(34,25,17,.78),rgba(14,11,8,.58));}body.tm-phase8-formal .tmf-sz-detail-head.hot{border-top:3px solid rgba(198,76,54,.70);}body.tm-phase8-formal .tmf-sz-detail-head.ok{border-top:3px solid rgba(126,184,167,.62);}body.tm-phase8-formal .tmf-sz-detail-head span{display:inline-flex;margin-bottom:8px;padding:2px 10px;border:1px solid rgba(201,168,95,.25);color:#8dbdab;background:rgba(0,0,0,.14);font-size:11px;letter-spacing:.18em;}body.tm-phase8-formal .tmf-sz-detail-head h3{margin:0;color:#f1d98d;font-size:25px;line-height:1.28;letter-spacing:.12em;font-weight:500;}body.tm-phase8-formal .tmf-sz-detail-head p{margin:8px 0 0;color:#a99a74;font-size:12px;line-height:1.5;}body.tm-phase8-formal .tmf-sz-block{margin-bottom:10px;padding:12px 14px;border-left:3px solid rgba(201,168,95,.46);background:rgba(255,245,210,.035);}body.tm-phase8-formal .tmf-sz-block>b{display:block;margin-bottom:6px;color:#f0d68d;font-size:15px;letter-spacing:.12em;}body.tm-phase8-formal .tmf-sz-block p{margin:0;color:#d8cba8;font-size:14px;line-height:1.8;}',
      'body.tm-phase8-formal .tmf-sz-tags{display:flex;flex-wrap:wrap;gap:6px;}body.tm-phase8-formal .tmf-sz-tags span{padding:3px 8px;border:1px solid rgba(126,184,167,.26);border-radius:10px;background:rgba(0,0,0,.16);color:#9fd2c0;font-size:11px;letter-spacing:.08em;}body.tm-phase8-formal .tmf-sz-rows{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;}body.tm-phase8-formal .tmf-sz-rows span{display:flex;justify-content:space-between;gap:8px;border:1px solid rgba(201,168,95,.14);background:rgba(0,0,0,.14);padding:6px 8px;}body.tm-phase8-formal .tmf-sz-rows i{font-style:normal;color:#8dbdab;}body.tm-phase8-formal .tmf-sz-rows em{font-style:normal;color:#d8cba8;text-align:right;}body.tm-phase8-formal .tmf-sz-choices{display:flex;flex-direction:column;gap:8px;}body.tm-phase8-formal .tmf-sz-choice{width:100%;text-align:left;border:1px solid rgba(201,168,95,.30);background:linear-gradient(180deg,rgba(201,168,95,.075),rgba(0,0,0,.16));color:#eadfbd;font-family:inherit;padding:10px 12px;cursor:pointer;}body.tm-phase8-formal .tmf-sz-choice:hover{border-color:rgba(238,202,118,.58);background:rgba(201,168,95,.12);}body.tm-phase8-formal .tmf-sz-choice strong{display:block;color:#f0d98c;font-size:15px;letter-spacing:.08em;margin-bottom:4px;}body.tm-phase8-formal .tmf-sz-choice span{color:#b9aa8a;font-size:12px;line-height:1.55;}',
      'body.tm-phase8-formal .tmf-sz-actions{display:flex;flex-direction:column;gap:8px;}body.tm-phase8-formal .tmf-sz-action{width:100%;min-height:38px;border:1px solid rgba(201,168,95,.30);background:linear-gradient(180deg,rgba(31,25,19,.82),rgba(12,10,8,.82));color:#d8c27c;font-family:inherit;font-size:13px;letter-spacing:.10em;cursor:pointer;}body.tm-phase8-formal .tmf-sz-action.primary{border-color:rgba(238,202,118,.50);color:#f0d98c;background:radial-gradient(ellipse at 50% 0,rgba(238,202,118,.15),transparent 64%),linear-gradient(180deg,rgba(48,34,20,.86),rgba(15,11,8,.82));}body.tm-phase8-formal .tmf-sz-action:hover{border-color:rgba(238,202,118,.58);transform:translateY(-1px);}body.tm-phase8-formal .tmf-sz-hint{margin-top:12px;padding:10px 12px;border:1px solid rgba(126,184,167,.20);background:rgba(126,184,167,.055);color:#9f9277;font-size:12px;line-height:1.7;}body.tm-phase8-formal .tmf-sz-empty{height:100%;display:flex;align-items:center;justify-content:center;text-align:center;color:#9f9277;font-size:14px;line-height:1.8;border:1px dashed rgba(201,168,95,.25);background:rgba(0,0,0,.12);}',
      '.tmf-record-row{display:grid;grid-template-columns:46px minmax(0,1fr);column-gap:10px;}.tmf-record-row span{grid-row:1 / span 2;color:#8dbdab;font-size:12px;padding-top:2px;}.tmf-chaoyi-scene{height:220px;margin-bottom:14px;border:1px solid rgba(184,154,83,.22);overflow:hidden;background:#0f0c08;}.tmf-chaoyi-scene img{width:100%;height:100%;object-fit:cover;opacity:.68;}',
      'body.tm-phase8-formal #gs-shizheng-btn{bottom:8px!important;width:268px!important;height:64px!important;padding:0!important;border:0!important;background:url("preview/img/shizheng-command-plaque.png") center/contain no-repeat!important;box-shadow:none!important;filter:drop-shadow(0 8px 14px rgba(0,0,0,.44));font-size:0!important;z-index:59!important;}',
      'body.tm-phase8-formal #gs-shizheng-btn:before{content:"御案时政";position:absolute;left:0;right:0;top:18px;text-align:center;color:#6f4520;font:700 17px/1 "STKaiti","KaiTi","楷体",serif;letter-spacing:.27em;padding-left:.27em;text-shadow:0 1px 0 rgba(255,250,225,.75);}body.tm-phase8-formal #gs-shizheng-btn:after{content:"朝政中枢";position:absolute;left:0;right:0;top:38px;text-align:center;color:rgba(101,65,27,.72);font:11px/1 "STKaiti","KaiTi","楷体",serif;letter-spacing:.20em;padding-left:.20em;}',
      'body.tm-phase8-formal .gs-turn-float{right:0!important;bottom:0!important;z-index:60!important;display:flex!important;flex-direction:column;gap:0;align-items:flex-end;}body.tm-phase8-formal .gs-turn-summary{display:none!important;}body.tm-phase8-formal .gs-turn-fab-bar{display:none!important;}body.tm-phase8-formal .gs-turn-big{min-width:204px!important;padding:14px 26px!important;border:1.5px solid rgba(214,188,116,.62)!important;border-radius:4px!important;background:radial-gradient(ellipse at 50% 0%,rgba(212,90,68,.55),transparent 65%),radial-gradient(circle at 30% 30%,rgba(232,140,108,.32),transparent 50%),linear-gradient(180deg,rgba(168,52,40,.96),rgba(108,28,22,.98))!important;color:#fff5e0!important;font:600 18px/1.25 "STKaiti","KaiTi","楷体",serif!important;letter-spacing:.45em!important;text-align:center!important;box-shadow:0 0 0 1px rgba(140,40,30,.65),0 7px 22px rgba(140,40,30,.6),inset 0 0 6px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.12)!important;text-shadow:0 1px 2px rgba(0,0,0,.55),0 0 9px rgba(255,200,160,.32)!important;position:relative;transition:transform .18s,box-shadow .18s;}body.tm-phase8-formal .gs-turn-big:before,body.tm-phase8-formal .gs-turn-big:after{content:"";position:absolute;width:9px;height:9px;pointer-events:none;border-color:rgba(212,190,122,.85);}body.tm-phase8-formal .gs-turn-big:before{top:4px;left:4px;border-top:1.2px solid;border-left:1.2px solid;}body.tm-phase8-formal .gs-turn-big:after{bottom:4px;right:4px;border-bottom:1.2px solid;border-right:1.2px solid;}body.tm-phase8-formal .gs-turn-big .sub{display:block;font-size:11.5px;letter-spacing:.24em;margin-top:5px;font-style:italic;font-weight:400;color:rgba(255,240,220,.78);text-shadow:0 1px 1px rgba(0,0,0,.5);}body.tm-phase8-formal .gs-turn-big:hover{transform:translateY(-2px);box-shadow:0 0 0 1px rgba(212,190,122,.75),0 10px 26px rgba(140,40,30,.7),inset 0 0 6px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.18)!important;}body.tm-phase8-formal #shiji-btn{display:none!important;}',
      'body.tm-phase8-formal #gs-shizheng-btn,body.tm-phase8-formal .gs-turn-float{display:none!important;}',
      'body.tm-phase8-formal #shizheng-btn{position:fixed;bottom:0;left:50%;transform:translateX(-50%);z-index:60;cursor:pointer;padding:11px 56px 10px;min-width:180px;text-align:center;background:radial-gradient(ellipse at 50% 30%,rgba(255,250,232,.40),transparent 70%),linear-gradient(180deg,#f4e8cc 0%,#e8dbb4 55%,#d9c897 100%);border:1px solid #a8895a;border-radius:2px;box-shadow:0 3px 14px rgba(20,12,5,.50),inset 0 1px 0 rgba(255,245,220,.60),inset 0 -1px 2px rgba(120,80,40,.18),inset 0 0 0 .5px rgba(255,245,220,.20);font-family:"STKaiti","KaiTi","楷体",serif;color:#6f4520;}',
      'body.tm-phase8-formal #shizheng-btn:before,body.tm-phase8-formal #shizheng-btn:after{content:"";position:absolute;width:7px;height:7px;pointer-events:none;border-color:rgba(108,76,32,.70);}body.tm-phase8-formal #shizheng-btn:before{top:3px;left:3px;border-top:1.2px solid;border-left:1.2px solid;}body.tm-phase8-formal #shizheng-btn:after{bottom:3px;right:3px;border-bottom:1.2px solid;border-right:1.2px solid;}body.tm-phase8-formal #shizheng-btn:hover{transform:translateX(-50%) translateY(-3px);box-shadow:0 7px 20px rgba(20,12,5,.60),inset 0 1px 0 rgba(255,250,232,.70),inset 0 -1px 2px rgba(120,80,40,.15);}body.tm-phase8-formal .sz-title{display:block;font-weight:700;font-size:17px;line-height:1;letter-spacing:.27em;padding-left:.27em;text-shadow:0 1px 0 rgba(255,250,225,.75);}body.tm-phase8-formal .sz-sub{display:block;margin-top:5px;font-size:11px;line-height:1;letter-spacing:.20em;padding-left:.20em;color:rgba(101,65,27,.72);}',
      'body.tm-phase8-formal #shizheng-btn{bottom:8px!important;width:268px!important;height:64px!important;min-width:0!important;padding:0!important;border:0!important;border-radius:13px!important;background:url("preview/img/shizheng-command-plaque.png") center center / 100% 100% no-repeat!important;box-shadow:none!important;filter:drop-shadow(0 8px 14px rgba(0,0,0,.44))!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:2px!important;overflow:visible!important;}body.tm-phase8-formal #shizheng-btn:before{content:""!important;position:absolute!important;left:44px!important;right:44px!important;top:19px!important;bottom:17px!important;width:auto!important;height:auto!important;border:0!important;border-radius:14px!important;background:radial-gradient(ellipse at 50% 45%,rgba(255,248,214,.36),transparent 72%),linear-gradient(90deg,transparent,rgba(255,236,170,.13),transparent)!important;mix-blend-mode:screen!important;pointer-events:none!important;}body.tm-phase8-formal #shizheng-btn:after{content:""!important;position:absolute!important;left:30px!important;right:30px!important;bottom:-7px!important;width:auto!important;height:14px!important;border:0!important;background:radial-gradient(ellipse at 50% 50%,rgba(0,0,0,.42),rgba(0,0,0,.16) 48%,transparent 78%)!important;z-index:-1!important;pointer-events:none!important;}body.tm-phase8-formal #shizheng-btn .sz-title{position:relative!important;z-index:1!important;font-size:18px!important;line-height:1!important;letter-spacing:.28em!important;padding-left:.28em!important;color:#3a210f!important;text-shadow:0 1px 0 rgba(255,246,210,.42),0 0 4px rgba(101,52,18,.16)!important;}body.tm-phase8-formal #shizheng-btn .sz-sub{position:relative!important;z-index:1!important;margin-top:2px!important;font-size:8.4px!important;line-height:1!important;letter-spacing:.20em!important;padding-left:.20em!important;color:rgba(101,65,27,.72)!important;}body.tm-phase8-formal #shizheng-btn:hover{transform:translateX(-50%) translateY(-3px)!important;filter:drop-shadow(0 11px 18px rgba(0,0,0,.48)) brightness(1.025)!important;box-shadow:none!important;}body.tm-phase8-formal #shizheng-btn:active{transform:translateX(-50%) translateY(-1px)!important;filter:drop-shadow(0 6px 10px rgba(0,0,0,.46)) brightness(.985)!important;}',
      'body.tm-phase8-formal #endturn{position:fixed;bottom:0;right:0;z-index:60;display:flex;flex-direction:column;gap:0;align-items:flex-end;}body.tm-phase8-formal #endturn .et-big{min-width:204px;padding:14px 26px;border:1.5px solid rgba(214,188,116,.62);border-radius:4px;background:radial-gradient(ellipse at 50% 0%,rgba(212,90,68,.55),transparent 65%),radial-gradient(circle at 30% 30%,rgba(232,140,108,.32),transparent 50%),linear-gradient(180deg,rgba(168,52,40,.96),rgba(108,28,22,.98));color:#fff5e0;font:600 18px/1.25 "STKaiti","KaiTi","楷体",serif;letter-spacing:.45em;text-align:center;box-shadow:0 0 0 1px rgba(140,40,30,.65),0 7px 22px rgba(140,40,30,.60),inset 0 0 6px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.12);text-shadow:0 1px 2px rgba(0,0,0,.55),0 0 9px rgba(255,200,160,.32);position:relative;transition:transform .18s,box-shadow .18s;cursor:pointer;}body.tm-phase8-formal #endturn .et-big:before,body.tm-phase8-formal #endturn .et-big:after{content:"";position:absolute;width:9px;height:9px;pointer-events:none;border-color:rgba(212,190,122,.85);}body.tm-phase8-formal #endturn .et-big:before{top:4px;left:4px;border-top:1.2px solid;border-left:1.2px solid;}body.tm-phase8-formal #endturn .et-big:after{right:4px;bottom:4px;border-right:1.2px solid;border-bottom:1.2px solid;}body.tm-phase8-formal #endturn .sub{display:block;margin-top:5px;color:rgba(255,240,220,.78);font-size:11.5px;font-style:italic;font-weight:400;letter-spacing:.24em;text-shadow:0 1px 1px rgba(0,0,0,.50);}',
      'body.tm-phase8-formal #rpanel{position:fixed;right:48px;top:56px;bottom:32px;z-index:68;width:0;flex:0 0 0;margin:0;pointer-events:none;overflow:hidden;background:linear-gradient(180deg,rgba(26,22,18,.98),rgba(9,8,7,.985)),radial-gradient(ellipse at 0 8%,rgba(218,184,98,.11),transparent 42%);border-left:1px solid rgba(229,196,116,.42);box-shadow:-10px 0 24px rgba(0,0,0,.34),inset 1px 0 0 rgba(255,239,196,.08);font-family:"STKaiti","KaiTi","楷体",serif;color:#eadfbd;transition:width .18s;}body.tm-phase8-formal #rpanel.show{width:312px;flex-basis:312px;overflow-y:auto;overflow-x:hidden;pointer-events:auto;box-shadow:-16px 0 34px rgba(0,0,0,.48),inset 1px 0 0 rgba(255,239,196,.10);}body.tm-phase8-formal #rpanel.show.tm-right-expanded{width:390px;flex-basis:390px;}body.tm-phase8-formal #rpanel.show:before{content:"";position:absolute;left:0;top:16px;bottom:16px;width:3px;background:linear-gradient(180deg,rgba(229,196,116,.76),rgba(142,44,34,.52),rgba(229,196,116,.62));box-shadow:0 0 10px rgba(229,196,116,.22);pointer-events:none;}',
      'body.tm-phase8-formal #rpanel .rp-head{min-height:48px;padding:10px 12px 9px 16px;border-bottom:1px solid rgba(184,154,83,.20);display:flex;align-items:center;justify-content:space-between;background:linear-gradient(90deg,rgba(68,46,24,.26),rgba(0,0,0,0) 72%),linear-gradient(180deg,rgba(255,239,196,.035),rgba(0,0,0,.10));}body.tm-phase8-formal #rpanel .rp-title{font-size:17px;font-weight:700;letter-spacing:.16em;color:#f2d98d;}body.tm-phase8-formal #rpanel .rp-close{width:28px;height:28px;border:1px solid rgba(214,188,116,.28);background:rgba(0,0,0,.22);color:#d8c27c;cursor:pointer;font-size:18px;line-height:1;}body.tm-phase8-formal #rpanel .rp-body{padding:12px 12px 18px;}',
      'body.tm-phase8-formal #tm-phase8-event-notice.tm-event-notice{position:fixed!important;left:22px!important;bottom:188px!important;z-index:63!important;width:354px!important;min-height:94px!important;height:252px!important;padding:8px 9px 8px 10px!important;display:grid!important;grid-template-columns:52px 1fr!important;grid-template-rows:auto minmax(0,1fr)!important;column-gap:9px!important;row-gap:6px!important;background:linear-gradient(180deg,rgba(24,20,16,.90),rgba(10,9,8,.78))!important;border-left:1px solid rgba(214,178,91,.28)!important;box-shadow:0 12px 28px rgba(0,0,0,.42),inset 0 1px 0 rgba(255,238,186,.05)!important;color:#e8d4a3!important;}body.tm-phase8-formal #tm-phase8-event-notice .tm-event-board-head{grid-column:1 / -1!important;display:block!important;min-height:0!important;padding:0!important;border:0!important;background:transparent!important;}body.tm-phase8-formal #tm-phase8-event-notice .tm-event-list{grid-column:1 / -1!important;padding:0!important;}',
      'body.tm-phase8-formal .tm-event-turn-button{height:31px;min-width:150px;display:inline-flex;align-items:center;gap:7px;padding:0 9px;border:1px solid rgba(214,178,91,.30);border-radius:2px;background:linear-gradient(180deg,rgba(31,25,19,.88),rgba(12,10,8,.84));color:#eadfbd;font-family:"STKaiti","KaiTi","楷体",serif;cursor:pointer;box-shadow:inset 0 1px 0 rgba(255,238,186,.05);}body.tm-phase8-formal .tm-event-turn-button span{font-size:13px;letter-spacing:.10em;color:#efd58d;}body.tm-phase8-formal .tm-event-turn-button i{min-width:20px;height:18px;display:inline-flex;align-items:center;justify-content:center;border:1px solid rgba(214,178,91,.30);border-radius:9px;background:rgba(11,9,7,.44);color:#9fd2c0;font-style:normal;font-size:10px;letter-spacing:0;}body.tm-phase8-formal .tm-event-turn-button b{color:#c8a85b;font-size:11px;}body.tm-phase8-formal .tm-event-turn-menu{position:absolute;left:10px;top:42px;z-index:66;width:170px;display:none;padding:5px;border:1px solid rgba(214,178,91,.28);background:linear-gradient(180deg,rgba(28,22,16,.98),rgba(8,7,6,.98));box-shadow:0 12px 24px rgba(0,0,0,.46);}body.tm-phase8-formal .tm-event-turn-menu.show{display:flex;flex-direction:column;gap:4px;}body.tm-phase8-formal .tm-event-turn-choice{display:flex;flex-direction:column;gap:3px;padding:7px 8px;border:1px solid transparent;background:transparent;color:#d8c27c;text-align:left;font-family:inherit;cursor:pointer;}body.tm-phase8-formal .tm-event-turn-choice.active,body.tm-phase8-formal .tm-event-turn-choice:hover{border-color:rgba(214,178,91,.38);background:rgba(214,178,91,.08);color:#f0d98c;}body.tm-phase8-formal .tm-event-turn-choice em{font-style:normal;font-size:10px;color:rgba(222,208,170,.58);}',
      'body.tm-phase8-formal #tm-phase8-event-notice.tm-event-notice{position:fixed!important;left:0!important;bottom:188px!important;width:366px!important;height:252px!important;min-height:0!important;padding:0!important;display:flex!important;flex-direction:column!important;gap:6px!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;backdrop-filter:none!important;overflow:visible!important;color:#e8d4a3!important;}body.tm-phase8-formal #tm-phase8-event-notice.tm-event-notice:before{display:none!important;}body.tm-phase8-formal #tm-phase8-event-notice .tm-event-board-head{position:relative!important;z-index:2!important;flex:0 0 36px!important;height:36px!important;display:flex!important;align-items:center!important;justify-content:flex-start!important;padding:0 6px!important;border:0!important;background:transparent!important;}body.tm-phase8-formal #tm-phase8-event-notice .tm-event-turn-button{position:relative!important;z-index:3!important;min-width:150px!important;height:31px!important;display:inline-flex!important;align-items:center!important;gap:8px!important;padding:0 9px!important;border:1px solid rgba(214,178,91,.34)!important;border-radius:16px 4px 16px 4px!important;background:radial-gradient(ellipse at 16% 0,rgba(238,202,118,.16),transparent 58%),linear-gradient(180deg,rgba(31,25,19,.92),rgba(12,10,8,.86))!important;box-shadow:0 6px 16px rgba(0,0,0,.24),inset 0 1px 0 rgba(255,238,186,.06)!important;color:#eadfbd!important;}body.tm-phase8-formal #tm-phase8-event-notice .tm-event-turn-button:before{content:""!important;width:6px!important;height:6px!important;border-radius:50%!important;background:#d9b15f!important;box-shadow:0 0 8px rgba(217,177,95,.58)!important;}body.tm-phase8-formal #tm-phase8-event-notice .tm-event-turn-button:hover,body.tm-phase8-formal #tm-phase8-event-notice .tm-event-turn-button[aria-expanded="true"]{border-color:rgba(238,202,118,.58)!important;background:radial-gradient(ellipse at 16% 0,rgba(238,202,118,.24),transparent 58%),linear-gradient(180deg,rgba(37,28,19,.96),rgba(12,10,8,.88))!important;}',
      'body.tm-phase8-formal #tm-phase8-event-notice .tm-event-turn-button span{font-size:13px!important;letter-spacing:.10em!important;color:#efd58d!important;}body.tm-phase8-formal #tm-phase8-event-notice .tm-event-turn-button i{min-width:23px!important;height:20px!important;border-radius:10px!important;border-color:rgba(214,178,91,.30)!important;background:rgba(11,9,7,.44)!important;color:#9fd2c0!important;font-style:normal!important;font-size:10px!important;}body.tm-phase8-formal #tm-phase8-event-notice .tm-event-turn-button b{margin-left:auto!important;color:rgba(232,207,140,.66)!important;font-size:11px!important;transform:translateY(-1px)!important;}body.tm-phase8-formal #tm-phase8-event-notice .tm-event-turn-menu{position:absolute!important;left:6px!important;top:34px!important;width:176px!important;z-index:70!important;display:none!important;padding:5px!important;border:1px solid rgba(214,178,91,.30)!important;border-radius:5px!important;background:linear-gradient(180deg,rgba(28,22,16,.98),rgba(8,7,6,.98))!important;box-shadow:0 12px 24px rgba(0,0,0,.46)!important;}body.tm-phase8-formal #tm-phase8-event-notice .tm-event-turn-menu.show{display:flex!important;flex-direction:column!important;gap:4px!important;}body.tm-phase8-formal #tm-phase8-event-notice .tm-event-turn-choice{height:28px!important;display:flex!important;flex-direction:row!important;align-items:center!important;justify-content:space-between!important;gap:8px!important;padding:0 8px!important;border:1px solid transparent!important;border-radius:3px!important;background:transparent!important;color:#d8c27c!important;text-align:left!important;font-family:inherit!important;cursor:pointer!important;}body.tm-phase8-formal #tm-phase8-event-notice .tm-event-turn-choice i{min-width:20px!important;height:18px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;border-radius:9px!important;background:rgba(0,0,0,.20)!important;color:#9fd2c0!important;font-style:normal!important;font-size:10px!important;}',
      'body.tm-phase8-formal #tm-phase8-event-notice .tm-event-list{position:relative!important;z-index:1!important;flex:1 1 auto!important;min-height:0!important;overflow-y:auto!important;overflow-x:visible!important;display:flex!important;flex-direction:column!important;gap:6px!important;padding:0 8px 0 0!important;scrollbar-width:thin!important;scrollbar-color:rgba(214,178,91,.48) rgba(0,0,0,.18)!important;}body.tm-phase8-formal #tm-phase8-event-notice .tm-event-item{position:relative!important;width:100%!important;min-height:48px!important;display:grid!important;grid-template-columns:34px minmax(0,1fr) auto!important;gap:7px!important;align-items:start!important;padding:7px 8px 7px 7px!important;border:1px solid rgba(214,178,91,.18)!important;border-left-color:rgba(210,73,52,.38)!important;border-radius:4px!important;background:linear-gradient(90deg,rgba(22,18,13,.90),rgba(22,17,12,.76) 64%,rgba(12,10,8,.40)),radial-gradient(ellipse at 0 50%,rgba(191,60,42,.18),transparent 48%)!important;color:inherit!important;cursor:pointer!important;text-align:left!important;box-shadow:0 8px 18px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,238,186,.045)!important;font-family:inherit!important;}body.tm-phase8-formal #tm-phase8-event-notice .tm-event-item:hover{border-color:rgba(238,202,118,.40)!important;transform:translateX(3px)!important;}body.tm-phase8-formal #tm-phase8-event-notice .tm-event-item.expanded{min-height:112px!important;border-color:rgba(239,200,103,.62)!important;border-left-color:rgba(213,86,60,.90)!important;}body.tm-phase8-formal #tm-phase8-event-notice .tm-event-item.is-new:after{content:"新"!important;position:absolute!important;right:5px!important;top:-5px!important;width:18px!important;height:18px!important;display:flex!important;align-items:center!important;justify-content:center!important;border:1px solid rgba(226,89,60,.56)!important;border-radius:50%!important;background:#5d2117!important;color:#f1c27b!important;font-size:9px!important;line-height:1!important;}',
      'body.tm-phase8-formal #tm-phase8-event-notice .tm-event-seal{width:32px!important;height:32px!important;display:flex!important;align-items:center!important;justify-content:center!important;border-radius:50%!important;border:1px solid rgba(230,193,103,.42)!important;background:radial-gradient(circle at 42% 28%,rgba(246,202,124,.22),transparent 42%),linear-gradient(180deg,rgba(83,33,23,.88),rgba(27,13,9,.94))!important;color:#f0d083!important;font:700 15px/1 "STKaiti","KaiTi",serif!important;}body.tm-phase8-formal #tm-phase8-event-notice .tm-event-head{display:flex!important;align-items:center!important;gap:6px!important;min-width:0!important;}body.tm-phase8-formal #tm-phase8-event-notice .tm-event-kicker{flex:0 0 auto!important;color:rgba(156,205,187,.70)!important;font:9px/1 "STSong","SimSun",serif!important;letter-spacing:.08em!important;}body.tm-phase8-formal #tm-phase8-event-notice .tm-event-title{min-width:0!important;overflow:hidden!important;text-overflow:ellipsis!important;color:#efd58d!important;font:700 13px/1.15 "STKaiti","KaiTi",serif!important;letter-spacing:.05em!important;white-space:normal!important;}body.tm-phase8-formal #tm-phase8-event-notice .tm-event-time{margin-left:auto!important;color:rgba(180,160,118,.68)!important;font:9px/1 "STSong","SimSun",serif!important;}body.tm-phase8-formal #tm-phase8-event-notice .tm-event-body{display:-webkit-box!important;-webkit-line-clamp:1!important;-webkit-box-orient:vertical!important;overflow:hidden!important;margin-top:3px!important;color:rgba(222,208,170,.66)!important;font:10px/1.25 "STSong","SimSun",serif!important;}body.tm-phase8-formal #tm-phase8-event-notice .tm-event-item.expanded .tm-event-body{display:block!important;overflow:visible!important;-webkit-line-clamp:unset!important;}body.tm-phase8-formal #tm-phase8-event-notice .tm-event-tag{align-self:flex-start!important;min-width:30px!important;padding:2px 5px!important;border:1px solid rgba(214,178,91,.24)!important;border-radius:2px!important;background:rgba(0,0,0,.16)!important;color:rgba(229,210,164,.74)!important;font:9px/1 "STSong","SimSun",serif!important;letter-spacing:.08em!important;}body.tm-phase8-formal #tm-phase8-event-notice .tm-event-detail{display:none!important;margin-top:7px!important;padding-top:7px!important;border-top:1px solid rgba(214,178,91,.12)!important;color:rgba(224,211,176,.68)!important;font:10.5px/1.45 "STSong","SimSun",serif!important;}body.tm-phase8-formal #tm-phase8-event-notice .tm-event-item.expanded .tm-event-detail{display:block!important;}',
      'body.tm-phase8-formal #tm-phase8-event-notice .tm-event-list{overscroll-behavior:contain!important;}body.tm-phase8-formal #tm-phase8-event-notice .tm-event-item.expanded{min-height:124px!important;max-height:170px!important;overflow:hidden!important;}body.tm-phase8-formal #tm-phase8-event-notice .tm-event-item.expanded .tm-event-body{display:block!important;max-height:34px!important;overflow:hidden!important;-webkit-line-clamp:unset!important;}body.tm-phase8-formal #tm-phase8-event-notice .tm-event-item.expanded .tm-event-detail{display:block!important;max-height:82px!important;overflow-y:auto!important;overflow-x:hidden!important;padding-right:5px!important;scrollbar-width:thin!important;scrollbar-color:rgba(214,178,91,.42) transparent!important;overscroll-behavior:contain!important;}body.tm-phase8-formal #tm-phase8-event-notice .tm-event-trace{gap:4px!important;margin-top:6px!important;}',
      'body.tm-phase8-formal #gs-shizheng-btn{display:none!important;}body.tm-phase8-formal #shizheng-btn{position:fixed!important;left:50%!important;bottom:10px!important;width:252px!important;height:46px!important;min-width:0!important;padding:0 24px!important;z-index:63!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:2px!important;color:#4a2a13!important;background:linear-gradient(180deg,rgba(248,233,187,.96),rgba(222,197,134,.95) 58%,rgba(169,126,61,.96)),radial-gradient(ellipse at 50% 0,rgba(255,251,221,.55),transparent 66%)!important;border:1px solid rgba(164,123,57,.78)!important;border-radius:3px 3px 0 0!important;cursor:pointer!important;user-select:none!important;white-space:nowrap!important;text-align:center!important;transform:translateX(-50%)!important;filter:none!important;box-shadow:inset 0 1px 0 rgba(255,250,225,.75),inset 0 -1px 0 rgba(96,61,22,.24),0 5px 12px rgba(0,0,0,.38)!important;transition:transform .18s ease,box-shadow .18s ease!important;overflow:visible!important;}body.tm-phase8-formal #shizheng-btn:before{content:""!important;position:absolute!important;inset:5px 9px 6px!important;border:1px solid rgba(111,75,31,.36)!important;border-left:0!important;border-right:0!important;border-radius:1px!important;background:linear-gradient(90deg,transparent,rgba(255,246,205,.20),transparent)!important;mix-blend-mode:normal!important;pointer-events:none!important;}body.tm-phase8-formal #shizheng-btn:after{content:""!important;position:absolute!important;left:22px!important;right:22px!important;bottom:-8px!important;height:12px!important;border:0!important;background:radial-gradient(ellipse at 50% 50%,rgba(0,0,0,.36),rgba(0,0,0,.14) 48%,transparent 78%)!important;z-index:-1!important;pointer-events:none!important;}body.tm-phase8-formal #shizheng-btn .sz-title{position:relative!important;z-index:1!important;font-size:17px!important;line-height:1!important;font-weight:700!important;letter-spacing:.26em!important;padding-left:.26em!important;color:#3f2410!important;text-shadow:0 1px 0 rgba(255,246,210,.45)!important;}body.tm-phase8-formal #shizheng-btn .sz-sub{position:relative!important;z-index:1!important;margin-top:1px!important;font-size:8.4px!important;line-height:1!important;letter-spacing:.20em!important;padding-left:.20em!important;color:rgba(100,66,29,.72)!important;}body.tm-phase8-formal #shizheng-btn:hover{transform:translateX(-50%) translateY(-2px)!important;filter:none!important;box-shadow:inset 0 1px 0 rgba(255,250,225,.82),inset 0 -1px 0 rgba(96,61,22,.22),0 8px 16px rgba(0,0,0,.42)!important;}body.tm-phase8-formal #shizheng-btn:active{transform:translateX(-50%)!important;filter:none!important;}',
      'body.tm-phase8-formal #shizheng-btn{bottom:8px!important;width:268px!important;height:64px!important;padding:0!important;border:0!important;border-radius:13px!important;background:url("preview/img/shizheng-command-plaque.png") center center / 100% 100% no-repeat!important;box-shadow:none!important;filter:drop-shadow(0 8px 14px rgba(0,0,0,.44))!important;}body.tm-phase8-formal #shizheng-btn:before{left:44px!important;right:44px!important;top:19px!important;bottom:17px!important;width:auto!important;height:auto!important;border:0!important;border-radius:14px!important;background:radial-gradient(ellipse at 50% 45%,rgba(255,248,214,.36),transparent 72%),linear-gradient(90deg,transparent,rgba(255,236,170,.13),transparent)!important;mix-blend-mode:screen!important;}body.tm-phase8-formal #shizheng-btn:after{left:30px!important;right:30px!important;bottom:-7px!important;width:auto!important;height:14px!important;border:0!important;background:radial-gradient(ellipse at 50% 50%,rgba(0,0,0,.42),rgba(0,0,0,.16) 48%,transparent 78%)!important;}body.tm-phase8-formal #shizheng-btn .sz-title{font-size:18px!important;letter-spacing:.28em!important;padding-left:.28em!important;color:#3a210f!important;text-shadow:0 1px 0 rgba(255,246,210,.42),0 0 4px rgba(101,52,18,.16)!important;}body.tm-phase8-formal #shizheng-btn .sz-sub{margin-top:2px!important;font-size:8.4px!important;color:rgba(101,65,27,.72)!important;}body.tm-phase8-formal #shizheng-btn:hover{transform:translateX(-50%) translateY(-3px)!important;filter:drop-shadow(0 11px 18px rgba(0,0,0,.48)) brightness(1.025)!important;box-shadow:none!important;}body.tm-phase8-formal #shizheng-btn:active{transform:translateX(-50%) translateY(-1px)!important;filter:drop-shadow(0 6px 10px rgba(0,0,0,.46)) brightness(.985)!important;}',
      'body.tm-phase8-formal #tm-phase8-action-tray.zb-action-tray{position:fixed!important;left:18px!important;bottom:24px!important;width:356px!important;height:150px!important;z-index:62!important;display:block!important;pointer-events:none!important;transform:translateZ(0)!important;transition:opacity .18s ease,transform .18s ease!important;}body.tm-phase8-formal #tm-phase8-action-tray.zb-action-tray:before{content:""!important;position:absolute!important;left:-20px!important;right:-22px!important;bottom:-18px!important;height:62px!important;background:radial-gradient(ellipse at 42% 72%,rgba(0,0,0,.50),rgba(0,0,0,.22) 48%,transparent 74%)!important;pointer-events:none!important;z-index:-1!important;}body.tm-phase8-formal #tm-phase8-action-tray .zb-btn.zb-img-btn{appearance:none!important;position:absolute!important;left:auto!important;right:auto!important;top:auto!important;bottom:auto!important;width:168px!important;height:70px!important;min-width:0!important;margin:0!important;padding:0!important;overflow:hidden!important;border:1px solid rgba(206,169,87,.38)!important;border-radius:6px!important;background:#120e0a!important;color:#f6e7bb!important;cursor:pointer!important;pointer-events:auto!important;isolation:isolate!important;text-align:left!important;letter-spacing:0!important;box-shadow:0 8px 17px rgba(0,0,0,.46),0 2px 4px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,244,202,.12),inset 0 -1px 0 rgba(0,0,0,.55)!important;filter:drop-shadow(0 8px 12px rgba(0,0,0,.34))!important;transform:translateY(0) rotate(var(--action-tilt,0deg))!important;transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease,filter .18s ease!important;}body.tm-phase8-formal #tm-phase8-action-tray .zb-img{width:100%!important;height:100%!important;object-fit:cover!important;display:block!important;pointer-events:none!important;opacity:.96!important;filter:saturate(.95) contrast(1.05) brightness(.96)!important;transform:scale(1.012)!important;transition:transform .24s ease,filter .24s ease,opacity .24s ease!important;}body.tm-phase8-formal #tm-phase8-action-tray .zb-img-btn:before{content:""!important;position:absolute!important;inset:0!important;z-index:1!important;background:linear-gradient(90deg,rgba(8,6,5,.72) 0%,rgba(8,6,5,.42) 36%,rgba(8,6,5,.10) 68%,rgba(8,6,5,.30) 100%),radial-gradient(ellipse at 18% 50%,rgba(223,174,82,.16),transparent 54%)!important;pointer-events:none!important;opacity:.92!important;transition:opacity .18s ease,background .18s ease!important;}body.tm-phase8-formal #tm-phase8-action-tray #zhao-btn:before{background:linear-gradient(90deg,rgba(8,6,5,.18) 0%,rgba(8,6,5,.16) 34%,rgba(8,6,5,.45) 60%,rgba(8,6,5,.76) 100%),radial-gradient(ellipse at 76% 50%,rgba(223,174,82,.17),transparent 56%)!important;}body.tm-phase8-formal #tm-phase8-action-tray .zb-img-btn:after{content:""!important;position:absolute!important;inset:1px!important;z-index:3!important;border-radius:5px!important;pointer-events:none!important;box-shadow:inset 0 0 0 1px rgba(244,215,136,.18),inset 0 0 16px rgba(0,0,0,.28)!important;background:linear-gradient(180deg,rgba(255,238,185,.08),transparent 42%),linear-gradient(90deg,rgba(201,160,69,.18),transparent 18%,transparent 82%,rgba(201,160,69,.12))!important;}body.tm-phase8-formal #tm-phase8-action-tray .zb-action-copy{position:absolute!important;z-index:2!important;left:13px!important;top:50%!important;width:92px!important;transform:translateY(-50%)!important;display:flex!important;flex-direction:column!important;align-items:flex-start!important;gap:2px!important;font-family:"STKaiti","KaiTi","楷体",serif!important;letter-spacing:0!important;pointer-events:none!important;text-align:left!important;text-shadow:0 1px 1px rgba(0,0,0,.86),0 0 8px rgba(0,0,0,.62)!important;}body.tm-phase8-formal #tm-phase8-action-tray #zhao-btn .zb-action-copy{left:auto!important;right:12px!important;align-items:flex-end!important;text-align:right!important;}body.tm-phase8-formal #tm-phase8-action-tray .zb-action-kicker{font-size:8px!important;line-height:1!important;color:rgba(213,181,105,.72)!important;letter-spacing:0!important;margin-bottom:1px!important;}body.tm-phase8-formal #tm-phase8-action-tray .zb-action-title{font:700 17px/1.05 "STKaiti","KaiTi","楷体",serif!important;color:#f7e5ad!important;letter-spacing:.04em!important;white-space:nowrap!important;}body.tm-phase8-formal #tm-phase8-action-tray .zb-action-sub{margin-top:2px!important;color:rgba(232,209,150,.72)!important;font:10px/1 "STSong","SimSun",serif!important;letter-spacing:.08em!important;white-space:nowrap!important;}body.tm-phase8-formal #tm-phase8-action-tray .zb-img-btn:hover{border-color:rgba(238,203,118,.72)!important;box-shadow:0 12px 24px rgba(0,0,0,.52),0 0 0 1px rgba(230,190,101,.15),inset 0 1px 0 rgba(255,244,202,.16),inset 0 -1px 0 rgba(0,0,0,.48)!important;filter:drop-shadow(0 10px 16px rgba(0,0,0,.40)) brightness(1.04)!important;transform:translateY(-4px) rotate(var(--action-tilt,0deg))!important;}body.tm-phase8-formal #tm-phase8-action-tray .zb-img-btn:hover .zb-img{opacity:1!important;filter:saturate(1.02) contrast(1.08) brightness(1.02)!important;transform:scale(1.045)!important;}body.tm-phase8-formal #tm-phase8-action-tray .zb-img-btn:hover:before{opacity:.72!important;}body.tm-phase8-formal #tm-phase8-action-tray .zb-img-btn:active{transform:translateY(-1px) rotate(var(--action-tilt,0deg))!important;filter:drop-shadow(0 5px 9px rgba(0,0,0,.44)) brightness(.98)!important;}body.tm-phase8-formal #tm-phase8-action-tray #zhao-btn{left:0!important;top:2px!important;--action-tilt:-1.9deg;}body.tm-phase8-formal #tm-phase8-action-tray #zhao-btn-2{left:178px!important;top:5px!important;--action-tilt:.9deg;}body.tm-phase8-formal #tm-phase8-action-tray #zhao-btn-3{left:8px!important;top:78px!important;--action-tilt:-.7deg;}body.tm-phase8-formal #tm-phase8-action-tray #zhao-btn-4{left:185px!important;top:75px!important;--action-tilt:1.6deg;}body.tm-phase8-formal.province-panel-open #tm-phase8-action-tray,body.tm-phase8-formal #mapwrap.panel-open~#tm-phase8-action-tray{opacity:0!important;pointer-events:none!important;transform:translateY(18px) scale(.96)!important;}',
      '@media(max-width:1280px){body.tm-phase8-formal #tm-phase8-action-tray.zb-action-tray{left:12px!important;bottom:20px!important;width:326px!important;height:136px!important;transform:translateZ(0)!important;}body.tm-phase8-formal #tm-phase8-action-tray .zb-btn.zb-img-btn{width:154px!important;height:64px!important;}body.tm-phase8-formal #tm-phase8-action-tray .zb-action-title{font-size:16px!important;}body.tm-phase8-formal #tm-phase8-action-tray .zb-action-sub{font-size:9.5px!important;}body.tm-phase8-formal #tm-phase8-action-tray #zhao-btn{left:0!important;top:1px!important;}body.tm-phase8-formal #tm-phase8-action-tray #zhao-btn-2{left:162px!important;top:4px!important;}body.tm-phase8-formal #tm-phase8-action-tray #zhao-btn-3{left:7px!important;top:71px!important;}body.tm-phase8-formal #tm-phase8-action-tray #zhao-btn-4{left:168px!important;top:69px!important;}}',
      '@media(max-width:1080px){body.tm-phase8-formal #tm-phase8-action-tray.zb-action-tray{width:292px!important;height:123px!important;}body.tm-phase8-formal #tm-phase8-action-tray .zb-btn.zb-img-btn{width:138px!important;height:58px!important;}body.tm-phase8-formal #tm-phase8-action-tray .zb-action-copy{left:10px!important;width:78px!important;}body.tm-phase8-formal #tm-phase8-action-tray #zhao-btn .zb-action-copy{right:10px!important;}body.tm-phase8-formal #tm-phase8-action-tray .zb-action-title{font-size:14px!important;}body.tm-phase8-formal #tm-phase8-action-tray .zb-action-sub{font-size:9px!important;}body.tm-phase8-formal #tm-phase8-action-tray .zb-action-kicker{display:none!important;}body.tm-phase8-formal #tm-phase8-action-tray #zhao-btn{left:0!important;top:1px!important;}body.tm-phase8-formal #tm-phase8-action-tray #zhao-btn-2{left:145px!important;top:3px!important;}body.tm-phase8-formal #tm-phase8-action-tray #zhao-btn-3{left:6px!important;top:65px!important;}body.tm-phase8-formal #tm-phase8-action-tray #zhao-btn-4{left:150px!important;top:63px!important;}}',
      'body.tm-phase8-formal .zb-action-badge{position:absolute!important;z-index:4!important;right:8px!important;top:7px!important;min-width:18px!important;height:18px!important;padding:0 5px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;border:1px solid rgba(238,202,118,.66)!important;border-radius:999px!important;background:linear-gradient(180deg,rgba(92,34,24,.96),rgba(36,18,12,.94))!important;color:#ffe2a8!important;font:700 10px/1 "STSong","SimSun",serif!important;letter-spacing:0!important;box-shadow:0 3px 8px rgba(0,0,0,.38),inset 0 1px 0 rgba(255,238,186,.14)!important;}body.tm-phase8-formal #zhao-btn .zb-action-badge{left:8px!important;right:auto!important;}',
      '@media(max-width:1280px){.tmf-map-paper{left:4.2%;right:5.8%;}.tmf-map-dossier{width:min(760px,72vw);}.tmf-map-legend{width:238px;}.tmf-dossier-rows{grid-template-columns:repeat(2,minmax(0,1fr));}body.tm-phase8-formal .bar-var{min-width:68px;padding-left:7px;padding-right:7px;}#tm-phase8-action-tray{transform:scale(.88);transform-origin:left bottom;}}',
      '@media(max-width:980px){#tm-phase8-left-surface{display:none;}#tm-phase8-action-tray{display:none;}.tmf-map-alerts{display:none;}.tmf-map-legend{display:none;}body.tm-phase8-formal .bar-weather{display:none;}body.tm-phase8-formal .bar-vars{overflow-x:auto;}body.tm-phase8-formal .bar-time{min-width:150px;}.tmf-map-dossier{left:12px;right:66px;width:auto;}.tmf-dossier-rows{grid-template-columns:1fr;}}'
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
    st.textContent = [
      'body.tm-phase8-formal #bar{display:none!important;}',
      'body.tm-phase8-formal #topbar{position:fixed!important;left:0!important;right:0!important;top:0!important;z-index:1000!important;height:88px!important;display:flex!important;align-items:flex-start!important;gap:9px!important;padding:8px 12px 0!important;box-sizing:border-box!important;background:transparent!important;border:0!important;box-shadow:none!important;backdrop-filter:none!important;pointer-events:none!important;font-family:"STKaiti","KaiTi","楷体",serif!important;color:#eadfbd!important;}',
      'body.tm-phase8-formal #banner{position:fixed!important;top:76px!important;left:50%!important;transform:translateX(-50%)!important;z-index:998!important;min-width:260px!important;height:26px!important;padding:0 28px!important;display:flex!important;align-items:center!important;justify-content:center!important;border:0!important;background:url("preview/img/topbar-center-edict-plaque-v1.png") center/100% 100% no-repeat!important;color:#6f4520!important;text-shadow:0 1px 0 rgba(255,247,218,.72)!important;font:700 12px/1 "STKaiti","KaiTi","楷体",serif!important;letter-spacing:.18em!important;box-shadow:none!important;cursor:pointer!important;}',
      'body.tm-phase8-formal .tmf-topbar-pop{position:fixed!important;z-index:19000!important;display:block!important;opacity:0!important;pointer-events:none!important;transform:translateY(-6px)!important;transition:opacity .15s,transform .15s!important;padding:12px 15px!important;min-width:230px!important;max-width:320px!important;background:linear-gradient(180deg,rgba(36,30,24,.98),rgba(15,13,11,.98))!important;border:1px solid rgba(201,160,69,.58)!important;border-radius:5px!important;box-shadow:0 10px 26px rgba(0,0,0,.56),inset 0 1px 0 rgba(255,238,186,.06)!important;color:#d8cba8!important;font:12.5px/1.7 "STKaiti","KaiTi","楷体",serif!important;letter-spacing:.04em!important;}body.tm-phase8-formal .tmf-topbar-pop.show{opacity:1!important;pointer-events:auto!important;transform:translateY(0)!important;}body.tm-phase8-formal .tmf-topbar-pop.pinned{border-color:#d4be7a!important;box-shadow:0 10px 26px rgba(0,0,0,.56),0 0 0 1px rgba(201,160,69,.28)!important;}body.tm-phase8-formal .tmf-timepop{top:76px!important;right:18px!important;}body.tm-phase8-formal .tmf-weatherpop{top:76px!important;left:18px!important;}body.tm-phase8-formal .tmf-topbar-pop .tp-title{color:#f0d98c!important;font-size:15px!important;letter-spacing:.18em!important;margin-bottom:4px!important;}body.tm-phase8-formal .tmf-topbar-pop .tp-pin-hint{color:rgba(216,203,168,.58)!important;font-size:10.5px!important;margin-bottom:6px!important;}body.tm-phase8-formal .tmf-topbar-pop .tp-row{display:flex!important;justify-content:space-between!important;gap:18px!important;border-top:1px solid rgba(201,160,69,.12)!important;padding-top:4px!important;}body.tm-phase8-formal .tmf-topbar-pop .tp-k{color:#8dbdab!important;white-space:nowrap!important;}body.tm-phase8-formal .tmf-topbar-pop .tp-v{color:#eadfbd!important;text-align:right!important;}body.tm-phase8-formal .tmf-topbar-pop .wp-head{display:flex!important;align-items:center!important;gap:9px!important;margin-bottom:7px!important;}body.tm-phase8-formal .tmf-topbar-pop .wp-head span{width:28px!important;height:28px!important;display:grid!important;place-items:center!important;border:1px solid rgba(233,196,105,.58)!important;border-radius:50%!important;background:radial-gradient(circle at 35% 25%,rgba(255,225,147,.28),rgba(86,52,24,.78) 58%,rgba(13,10,8,.94))!important;color:#efd990!important;}body.tm-phase8-formal .tmf-topbar-pop .wp-head b{color:#f0d98c!important;font-size:15px!important;letter-spacing:.12em!important;}',
      'body.tm-phase8-formal #topbar:before,body.tm-phase8-formal #topbar:after{display:none!important;}',
      'body.tm-phase8-formal .tb-left,body.tm-phase8-formal .tb-vars,body.tm-phase8-formal .tb-right{position:relative!important;z-index:2!important;pointer-events:auto!important;flex-shrink:0!important;overflow:visible!important;}',
      'body.tm-phase8-formal .tb-left{width:205px!important;height:60px!important;margin:0 2px 0 0!important;padding:7px 13px 7px 7px!important;display:flex!important;align-items:center!important;gap:7px!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;box-sizing:border-box!important;}body.tm-phase8-formal .tb-left:before{content:""!important;display:block!important;position:absolute!important;z-index:0!important;inset:-12px -16px -13px -10px!important;background:url("preview/img/topbar-left-identity-underlay-v1.png") center/100% 100% no-repeat!important;opacity:.68!important;filter:saturate(.98) brightness(.92) contrast(1.05)!important;pointer-events:none!important;}body.tm-phase8-formal .tb-left:after{display:none!important;}body.tm-phase8-formal .tb-left>*{position:relative!important;z-index:1!important;}',
      'body.tm-phase8-formal .tb-wentian{width:36px!important;min-width:36px!important;height:34px!important;padding:0!important;display:flex!important;align-items:center!important;justify-content:center!important;border:1px solid rgba(227,187,92,.62)!important;border-radius:50%!important;background:radial-gradient(circle at 35% 27%,rgba(251,221,143,.30),rgba(92,54,24,.88) 58%,rgba(12,9,7,.94) 78%),linear-gradient(180deg,rgba(63,38,20,.94),rgba(12,9,7,.94))!important;color:#f0d58f!important;font-size:10px!important;letter-spacing:.06em!important;box-shadow:inset 0 1px 0 rgba(255,239,180,.14),inset 0 -8px 14px rgba(0,0,0,.32),0 2px 8px rgba(0,0,0,.40),0 0 11px rgba(205,166,82,.15)!important;}body.tm-phase8-formal .tb-wentian:before{display:none!important;}',
      'body.tm-phase8-formal .tb-weather{height:34px!important;min-width:122px!important;padding:0!important;display:flex!important;align-items:center!important;gap:6px!important;background:transparent!important;border:0!important;box-shadow:none!important;}body.tm-phase8-formal .tb-w-seal{width:24px!important;height:24px!important;display:grid!important;place-items:center!important;font-size:11px!important;border-color:rgba(233,196,105,.52)!important;background:radial-gradient(circle at 35% 25%,rgba(255,225,147,.24),rgba(86,52,24,.74) 58%,rgba(13,10,8,.92))!important;}body.tm-phase8-formal .tb-w-info{min-width:82px!important;}body.tm-phase8-formal .tb-w-name{max-width:104px!important;font-size:10.8px!important;color:#efd990!important;}body.tm-phase8-formal .tb-w-desc{font-size:8.2px!important;color:rgba(209,193,153,.66)!important;}',
      'body.tm-phase8-formal .tb-vars{--tm-rail-w:932px;--tm-rail-h:62px;--tm-rail-pad-x:12px;--tm-rail-pad-y:8px;--tm-rail-gap:4px;--tm-wide-cell:212px;--tm-hukou-cell:104px;--tm-lizhi-cell:110px;--tm-small-cell:82px;width:var(--tm-rail-w)!important;height:var(--tm-rail-h)!important;flex:0 0 var(--tm-rail-w)!important;max-width:none!important;padding:var(--tm-rail-pad-y) var(--tm-rail-pad-x)!important;display:flex!important;align-items:center!important;gap:var(--tm-rail-gap)!important;border:0!important;border-radius:0!important;background:url("preview/img/topbar-resource-fieldrail-v2-wide.png") center/100% 100% no-repeat!important;box-shadow:none!important;box-sizing:border-box!important;}body.tm-phase8-formal .tb-vars:before,body.tm-phase8-formal .tb-vars:after{display:none!important;}',
      'body.tm-phase8-formal .tb-var{height:calc(var(--tm-rail-h) - (var(--tm-rail-pad-y) * 2))!important;min-width:0!important;border-color:transparent!important;background:transparent!important;box-shadow:none!important;border-radius:0!important;box-sizing:border-box!important;cursor:pointer!important;}body.tm-phase8-formal .tb-var:hover,body.tm-phase8-formal .tb-var.pinned{background:radial-gradient(ellipse at 50% 10%,rgba(231,190,99,.12),transparent 64%),linear-gradient(180deg,rgba(205,166,82,.075),rgba(205,166,82,.018))!important;}',
      'body.tm-phase8-formal .tb-var.wide{display:flex!important;flex-direction:column!important;align-items:stretch!important;justify-content:center!important;flex:0 0 var(--tm-wide-cell)!important;width:var(--tm-wide-cell)!important;min-width:var(--tm-wide-cell)!important;max-width:var(--tm-wide-cell)!important;padding:5px 8px!important;gap:3px!important;overflow:hidden!important;}body.tm-phase8-formal .tb-var:not(.wide){display:flex!important;flex-direction:row!important;align-items:center!important;flex:0 0 var(--tm-small-cell)!important;width:var(--tm-small-cell)!important;min-width:var(--tm-small-cell)!important;max-width:var(--tm-small-cell)!important;padding:5px 8px!important;gap:5px!important;overflow:hidden!important;}body.tm-phase8-formal .tb-var[data-key="hukou"]{flex-basis:var(--tm-hukou-cell)!important;width:var(--tm-hukou-cell)!important;min-width:var(--tm-hukou-cell)!important;max-width:var(--tm-hukou-cell)!important;}body.tm-phase8-formal .tb-var[data-key="lizhi"]{flex-basis:var(--tm-lizhi-cell)!important;width:var(--tm-lizhi-cell)!important;min-width:var(--tm-lizhi-cell)!important;max-width:var(--tm-lizhi-cell)!important;}',
      'body.tm-phase8-formal .tb-var.wide .tb-vn{flex:0 0 auto!important;width:auto!important;min-width:0!important;max-width:none!important;padding:0 0 0 4px!important;margin:0 0 1px!important;border-right:0!important;text-align:left!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;font-size:7.9px!important;line-height:1!important;letter-spacing:.18em!important;color:rgba(221,202,155,.74)!important;}body.tm-phase8-formal .tb-vn:before,body.tm-phase8-formal .tb-var.wide .tb-vn:before{display:none!important;}body.tm-phase8-formal .tb-var.wide .tb-vsubs{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;align-items:center!important;gap:4px!important;min-width:0!important;overflow:hidden!important;line-height:1.05!important;}body.tm-phase8-formal .tb-var.wide .tb-vs{height:25px!important;min-width:0!important;display:flex!important;align-items:center!important;gap:4px!important;padding:2px 3px!important;border-radius:2px!important;background:rgba(0,0,0,.12)!important;overflow:hidden!important;}body.tm-phase8-formal .tb-var.wide .icn{width:16px!important;height:16px!important;font-size:8px!important;}body.tm-phase8-formal .tb-var.wide .sv{min-width:0!important;flex:1 1 auto!important;overflow:hidden!important;line-height:1!important;}body.tm-phase8-formal .tb-var.wide .sv b{display:block!important;max-width:100%!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;font:600 11.2px/1.12 "STSong","SimSun","Songti SC",serif!important;color:#e0c77e!important;}body.tm-phase8-formal .tb-var.wide .sv .sd{display:block!important;max-width:100%!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;font:500 7px/1 "STSong","SimSun",serif!important;margin-top:0!important;}',
      'body.tm-phase8-formal .tb-vbody{display:flex!important;flex-direction:column!important;justify-content:center!important;min-width:0!important;overflow:hidden!important;gap:1px!important;line-height:1.05!important;}body.tm-phase8-formal .tb-vn{max-width:100%!important;padding-left:0!important;margin-bottom:0!important;font-size:7.6px!important;line-height:1!important;letter-spacing:.18em!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;color:rgba(221,202,155,.72)!important;}body.tm-phase8-formal .tb-vv{display:block!important;max-width:100%!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;font-size:12px!important;line-height:1.05!important;color:#e0c77e!important;}body.tm-phase8-formal .tb-var.warn .tb-vv{color:#e88a78!important;}body.tm-phase8-formal .tb-var.good .tb-vv{color:#8dbdab!important;}',
      'body.tm-phase8-formal .tb-right{width:340px!important;height:60px!important;flex:0 0 340px!important;margin-left:auto!important;padding:8px 12px 8px 14px!important;display:flex!important;align-items:center!important;gap:9px!important;isolation:isolate!important;background:url("preview/img/topbar-right-fieldtime-v3-wide.png") center/100% 100% no-repeat!important;border:0!important;border-radius:4px!important;box-shadow:none!important;filter:drop-shadow(0 5px 12px rgba(0,0,0,.30))!important;box-sizing:border-box!important;}body.tm-phase8-formal .tb-right:before{display:none!important;}body.tm-phase8-formal .tb-chip{width:88px!important;min-width:88px!important;height:44px!important;padding:0 8px!important;display:flex!important;align-items:center!important;justify-content:center!important;border:0!important;background:transparent!important;box-shadow:none!important;color:rgba(237,214,151,.86)!important;text-shadow:0 1px 2px rgba(0,0,0,.75)!important;font-size:9.4px!important;}body.tm-phase8-formal .tb-time{flex:1 1 auto!important;height:44px!important;min-width:0!important;max-width:none!important;padding:7px 18px 6px 12px!important;display:flex!important;flex-direction:column!important;justify-content:center!important;align-items:flex-end!important;border:0!important;background:transparent!important;box-shadow:none!important;text-align:right!important;box-sizing:border-box!important;cursor:pointer!important;}body.tm-phase8-formal .tb-time-main{max-width:100%!important;font-size:12.5px!important;line-height:1.18!important;letter-spacing:.055em!important;color:#f1d792!important;text-shadow:0 1px 2px rgba(0,0,0,.78),0 0 8px rgba(217,177,87,.14)!important;}body.tm-phase8-formal .tb-time-sub{max-width:100%!important;font-size:9px!important;color:rgba(219,203,162,.70)!important;text-shadow:0 1px 2px rgba(0,0,0,.72)!important;}',
      '@media(max-width:1500px){body.tm-phase8-formal #topbar{height:88px!important;}body.tm-phase8-formal #banner{top:76px!important;}body.tm-phase8-formal .tb-left{height:60px!important;}body.tm-phase8-formal .tb-vars{--tm-rail-w:820px;--tm-rail-h:62px;--tm-rail-pad-x:10px;--tm-rail-pad-y:8px;--tm-rail-gap:4px;--tm-wide-cell:192px;--tm-hukou-cell:94px;--tm-lizhi-cell:94px;--tm-small-cell:64px;background-image:url("preview/img/topbar-resource-fieldrail-v2-wide.png")!important;}body.tm-phase8-formal .tb-right{width:210px!important;height:58px!important;flex-basis:210px!important;background-image:url("preview/img/topbar-right-fieldtime-v3-compact.png")!important;}body.tm-phase8-formal .tb-chip{width:62px!important;min-width:62px!important;height:44px!important;font-size:8.5px!important;}body.tm-phase8-formal .tb-time{height:44px!important;padding-right:12px!important;}body.tm-phase8-formal .tb-var.wide .tb-vs{height:31px!important;}body.tm-phase8-formal .tb-var.wide .sv b{font-size:12px!important;}body.tm-phase8-formal .tb-var.wide .sv .sd{display:block!important;font-size:8.5px!important;line-height:1.05!important;}}',
      '@media(max-width:1280px){body.tm-phase8-formal #topbar{height:84px!important;padding-top:7px!important;}body.tm-phase8-formal #banner{top:72px!important;}body.tm-phase8-formal .tb-left{width:168px!important;height:56px!important;padding-right:10px!important;}body.tm-phase8-formal .tb-weather{min-width:92px!important;gap:4px!important;}body.tm-phase8-formal .tb-w-info{min-width:56px!important;}body.tm-phase8-formal .tb-w-name{max-width:72px!important;font-size:9.5px!important;}body.tm-phase8-formal .tb-w-desc{display:none!important;}body.tm-phase8-formal .tb-vars{--tm-rail-w:742px;--tm-rail-h:60px;--tm-rail-pad-x:9px;--tm-rail-pad-y:8px;--tm-wide-cell:172px;--tm-hukou-cell:84px;--tm-lizhi-cell:88px;--tm-small-cell:58px;}body.tm-phase8-formal .tb-var.wide .tb-vs{height:29px!important;}body.tm-phase8-formal .tb-var.wide .sd{display:block!important;font-size:7.8px!important;line-height:1.05!important;}body.tm-phase8-formal .tb-right{width:206px!important;height:56px!important;flex-basis:206px!important;padding:6px 10px 6px 11px!important;gap:7px!important;}body.tm-phase8-formal .tb-time{height:42px!important;padding-right:12px!important;}body.tm-phase8-formal .tb-time-main{font-size:10.4px!important;}body.tm-phase8-formal .tb-chip{width:58px!important;min-width:58px!important;height:42px!important;}}',
      '@media(max-width:1080px){body.tm-phase8-formal #topbar{height:76px!important;}body.tm-phase8-formal #banner{top:64px!important;}body.tm-phase8-formal .tb-left{width:54px!important;padding-right:8px!important;}body.tm-phase8-formal .tb-weather{display:none!important;}body.tm-phase8-formal .tb-vars{--tm-rail-w:626px;--tm-rail-h:56px;--tm-rail-pad-x:9px;--tm-rail-pad-y:7px;--tm-rail-gap:3px;--tm-wide-cell:126px;--tm-hukou-cell:76px;--tm-lizhi-cell:82px;--tm-small-cell:60px;background-image:url("preview/img/topbar-resource-fieldrail-v2-narrow.png")!important;}body.tm-phase8-formal .tb-var.wide .tb-vn{display:none!important;}body.tm-phase8-formal .tb-var.wide .tb-vs{height:28px!important;}body.tm-phase8-formal .tb-var.wide .sd{display:block!important;font-size:7.2px!important;}body.tm-phase8-formal .tb-chip{display:none!important;}body.tm-phase8-formal .tb-right{width:154px!important;height:50px!important;flex-basis:154px!important;background-image:url("preview/img/topbar-right-fieldtime-v3-narrow.png")!important;}body.tm-phase8-formal .tb-time{min-width:0!important;max-width:none!important;height:38px!important;padding-right:12px!important;}body.tm-phase8-formal .tb-time-main{font-size:9.4px!important;}}'
    ].join('\n');
  }

  function actionTraySpecs(){
    return [
      ['zhao-btn','edict','action-edict-card.png','\u64b0\u5199\u8bcf\u4e66','\u5fa1\u6848','\u8d77\u8349\u653f\u4ee4','\u64b0\u5199\u8bcf\u4e66\u00b7\u8d77\u8349\u653f\u4ee4'],
      ['zhao-btn-2','memorial','action-memorial-card.png','\u767e\u5b98\u594f\u758f','\u5185\u9601','\u5fa1\u89c8\u594f\u62a5','\u767e\u5b98\u594f\u758f\u00b7\u5fa1\u89c8\u81e3\u5de5\u594f\u62a5'],
      ['zhao-btn-3','letter','action-letter-card.png','\u9e3f\u96c1\u4f20\u4e66','\u9a7f\u4f20','\u9063\u4f7f\u901a\u4fe1','\u9e3f\u96c1\u4f20\u4e66\u00b7\u9063\u4f7f\u901a\u4fe1'],
      ['zhao-btn-4','records','action-annals-card.png','\u53f2\u5b98\u5b9e\u5f55','\u53f2\u9986','\u56de\u5408\u6863\u6848','\u53f2\u5b98\u5b9e\u5f55\u00b7\u9605\u89c8\u56de\u5408\u6863\u6848']
    ];
  }

  function renderActionTrayHtml(){
    return actionTraySpecs().map(function(x){
      return '<button type="button" id="' + esc(x[0]) + '" class="zb-btn zb-img-btn" data-tmf-action="' + esc(x[1]) + '" title="' + esc(x[6]) + '" aria-label="' + esc(x[3]) + '">' +
        '<img class="zb-img" src="' + esc(asset(x[2])) + '" alt="">' +
        '<span class="zb-action-copy"><span class="zb-action-kicker">' + esc(x[4]) + '</span><span class="zb-action-title">' + esc(x[3]) + '</span><span class="zb-action-sub">' + esc(x[5]) + '</span></span>' +
        '</button>';
    }).join('');
  }

  function installActionEntryExactStyles(){
    var st = document.getElementById('tm-phase8-formal-action-entry-exact-style');
    if (!st) {
      st = document.createElement('style');
      st.id = 'tm-phase8-formal-action-entry-exact-style';
      document.head.appendChild(st);
    }
    st.textContent = [
      'body.tm-phase8-formal #tm-phase8-action-tray.zb-action-tray{position:fixed!important;left:18px!important;bottom:24px!important;z-index:62!important;display:block!important;width:356px!important;height:150px!important;pointer-events:none!important;transform:translateZ(0)!important;transition:opacity .18s ease,transform .18s ease!important;}',
      'body.tm-phase8-formal #tm-phase8-action-tray.zb-action-tray:before{content:""!important;position:absolute!important;left:-20px!important;right:-22px!important;bottom:-18px!important;height:62px!important;background:radial-gradient(ellipse at 42% 72%,rgba(0,0,0,.50),rgba(0,0,0,.22) 48%,transparent 74%)!important;pointer-events:none!important;z-index:-1!important;}',
      'body.tm-phase8-formal #tm-phase8-action-tray .zb-btn.zb-img-btn{appearance:none!important;position:absolute!important;left:auto!important;right:auto!important;top:auto!important;bottom:auto!important;width:168px!important;height:70px!important;min-width:0!important;margin:0!important;padding:0!important;overflow:hidden!important;border:1px solid rgba(206,169,87,.38)!important;border-radius:6px!important;background:#120e0a!important;color:#f6e7bb!important;cursor:pointer!important;pointer-events:auto!important;isolation:isolate!important;text-align:left!important;letter-spacing:0!important;box-shadow:0 8px 17px rgba(0,0,0,.46),0 2px 4px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,244,202,.12),inset 0 -1px 0 rgba(0,0,0,.55)!important;filter:drop-shadow(0 8px 12px rgba(0,0,0,.34))!important;transform:translateY(0) rotate(var(--action-tilt,0deg))!important;transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease,filter .18s ease!important;}',
      'body.tm-phase8-formal #tm-phase8-action-tray .zb-img{width:100%!important;height:100%!important;object-fit:cover!important;display:block!important;pointer-events:none!important;opacity:.96!important;filter:saturate(.95) contrast(1.05) brightness(.96)!important;transform:scale(1.012)!important;transition:transform .24s ease,filter .24s ease,opacity .24s ease!important;}',
      'body.tm-phase8-formal #tm-phase8-action-tray .zb-img-btn:before{content:""!important;position:absolute!important;inset:0!important;z-index:1!important;background:linear-gradient(90deg,rgba(8,6,5,.72) 0%,rgba(8,6,5,.42) 36%,rgba(8,6,5,.10) 68%,rgba(8,6,5,.30) 100%),radial-gradient(ellipse at 18% 50%,rgba(223,174,82,.16),transparent 54%)!important;pointer-events:none!important;opacity:.92!important;transition:opacity .18s ease,background .18s ease!important;}',
      'body.tm-phase8-formal #tm-phase8-action-tray #zhao-btn:before{background:linear-gradient(90deg,rgba(8,6,5,.18) 0%,rgba(8,6,5,.16) 34%,rgba(8,6,5,.45) 60%,rgba(8,6,5,.76) 100%),radial-gradient(ellipse at 76% 50%,rgba(223,174,82,.17),transparent 56%)!important;}',
      'body.tm-phase8-formal #tm-phase8-action-tray .zb-img-btn:after{content:""!important;position:absolute!important;inset:1px!important;z-index:3!important;border-radius:5px!important;pointer-events:none!important;box-shadow:inset 0 0 0 1px rgba(244,215,136,.18),inset 0 0 16px rgba(0,0,0,.28)!important;background:linear-gradient(180deg,rgba(255,238,185,.08),transparent 42%),linear-gradient(90deg,rgba(201,160,69,.18),transparent 18%,transparent 82%,rgba(201,160,69,.12))!important;}',
      'body.tm-phase8-formal #tm-phase8-action-tray .zb-action-copy{position:absolute!important;z-index:2!important;left:13px!important;top:50%!important;width:92px!important;transform:translateY(-50%)!important;display:flex!important;flex-direction:column!important;align-items:flex-start!important;gap:2px!important;font-family:"STKaiti","KaiTi","楷体",serif!important;letter-spacing:0!important;pointer-events:none!important;text-align:left!important;text-shadow:0 1px 1px rgba(0,0,0,.86),0 0 8px rgba(0,0,0,.62)!important;}',
      'body.tm-phase8-formal #tm-phase8-action-tray #zhao-btn .zb-action-copy{left:auto!important;right:12px!important;align-items:flex-end!important;text-align:right!important;}',
      'body.tm-phase8-formal #tm-phase8-action-tray .zb-action-kicker{font-size:8px!important;line-height:1!important;color:rgba(213,181,105,.72)!important;letter-spacing:0!important;margin:0!important;}',
      'body.tm-phase8-formal #tm-phase8-action-tray .zb-action-title{font-size:17px!important;line-height:1.05!important;font-weight:700!important;color:#f7e5ad!important;white-space:nowrap!important;letter-spacing:0!important;}',
      'body.tm-phase8-formal #tm-phase8-action-tray .zb-action-sub{font-size:10px!important;line-height:1!important;color:rgba(232,209,150,.72)!important;white-space:nowrap!important;letter-spacing:0!important;margin:0!important;}',
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
      'body.tm-phase8-formal #shizheng-btn .sz-sub{position:relative!important;z-index:1!important;margin-top:2px!important;font-size:8.4px!important;line-height:1!important;letter-spacing:.20em!important;padding-left:.20em!important;color:rgba(101,65,27,.72)!important;}',
      'body.tm-phase8-formal #shizheng-btn:hover{transform:translateX(-50%) translateY(-3px)!important;filter:drop-shadow(0 11px 18px rgba(0,0,0,.48)) brightness(1.025)!important;box-shadow:none!important;}',
      'body.tm-phase8-formal #shizheng-btn:active{transform:translateX(-50%) translateY(-1px)!important;filter:drop-shadow(0 6px 10px rgba(0,0,0,.46)) brightness(.985)!important;}',
      '@media(max-width:1280px){body.tm-phase8-formal #tm-phase8-action-tray.zb-action-tray{left:12px!important;bottom:20px!important;width:326px!important;height:136px!important;transform:translateZ(0)!important;}body.tm-phase8-formal #tm-phase8-action-tray .zb-btn.zb-img-btn{width:154px!important;height:64px!important;}body.tm-phase8-formal #tm-phase8-action-tray .zb-action-title{font-size:16px!important;}body.tm-phase8-formal #tm-phase8-action-tray .zb-action-sub{font-size:9.5px!important;}body.tm-phase8-formal #tm-phase8-action-tray #zhao-btn{left:0!important;top:1px!important;}body.tm-phase8-formal #tm-phase8-action-tray #zhao-btn-2{left:162px!important;top:4px!important;}body.tm-phase8-formal #tm-phase8-action-tray #zhao-btn-3{left:7px!important;top:71px!important;}body.tm-phase8-formal #tm-phase8-action-tray #zhao-btn-4{left:168px!important;top:69px!important;}body.tm-phase8-formal #shizheng-btn{width:238px!important;height:57px!important;}body.tm-phase8-formal #shizheng-btn .sz-title{font-size:16px!important;letter-spacing:.25em!important;padding-left:.25em!important;}body.tm-phase8-formal #shizheng-btn .sz-sub{font-size:8px!important;}}',
      '@media(max-width:1080px){body.tm-phase8-formal #tm-phase8-action-tray.zb-action-tray{width:292px!important;height:123px!important;}body.tm-phase8-formal #tm-phase8-action-tray .zb-btn.zb-img-btn{width:138px!important;height:58px!important;}body.tm-phase8-formal #tm-phase8-action-tray .zb-action-copy{left:10px!important;width:78px!important;}body.tm-phase8-formal #tm-phase8-action-tray #zhao-btn .zb-action-copy{right:10px!important;}body.tm-phase8-formal #tm-phase8-action-tray .zb-action-title{font-size:14px!important;}body.tm-phase8-formal #tm-phase8-action-tray .zb-action-sub{font-size:9px!important;}body.tm-phase8-formal #tm-phase8-action-tray .zb-action-kicker{display:none!important;}body.tm-phase8-formal #tm-phase8-action-tray #zhao-btn{left:0!important;top:1px!important;}body.tm-phase8-formal #tm-phase8-action-tray #zhao-btn-2{left:145px!important;top:3px!important;}body.tm-phase8-formal #tm-phase8-action-tray #zhao-btn-3{left:6px!important;top:65px!important;}body.tm-phase8-formal #tm-phase8-action-tray #zhao-btn-4{left:150px!important;top:63px!important;}body.tm-phase8-formal #shizheng-btn{width:218px!important;height:52px!important;}body.tm-phase8-formal #shizheng-btn .sz-title{font-size:15px!important;}body.tm-phase8-formal #shizheng-btn .sz-sub{font-size:7.8px!important;}}'
    ].join('\n');
  }

  function installFormalVisibilityStyles(){
    var st = document.getElementById('tm-phase8-formal-visibility-style');
    if (!st) {
      st = document.createElement('style');
      st.id = 'tm-phase8-formal-visibility-style';
      document.head.appendChild(st);
    }
    st.textContent = [
      'body.tm-phase8-formal:not(.tm-phase8-game-active) #topbar,body.tm-phase8-formal:not(.tm-phase8-game-active) #banner,body.tm-phase8-formal:not(.tm-phase8-game-active) #tm-phase8-action-tray,body.tm-phase8-formal:not(.tm-phase8-game-active) #tm-phase8-event-notice,body.tm-phase8-formal:not(.tm-phase8-game-active) #shizheng-btn,body.tm-phase8-formal:not(.tm-phase8-game-active) #tm-right-rail,body.tm-phase8-formal:not(.tm-phase8-game-active) #tm-phase8-formal-rail,body.tm-phase8-formal:not(.tm-phase8-game-active) #rpanel,body.tm-phase8-formal:not(.tm-phase8-game-active) #tm-phase8-main-shell,body.tm-phase8-formal:not(.tm-phase8-game-active) #tm-phase8-home-return,body.tm-phase8-formal:not(.tm-phase8-game-active) #tm-office-single-back{display:none!important;pointer-events:none!important;}',
      'body.tm-phase8-formal:not(.tm-phase8-game-active) .tmf-topbar-pop{display:none!important;pointer-events:none!important;opacity:0!important;}'
    ].join('\n');
  }

  function ensureFormalRuntimeChrome(){
    if (!syncFormalShellVisibility()) return false;
    installWenduiFormalReturnHook();
    ensureRail();
    ensureFormalChrome();
    ensureMainShell();
    bindFormalEntryRedirects();
    markPinnedCards();
    return true;
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
        ensureFormalRuntimeChrome();
      }, 1000);
    }
    installContextMenu();
    installMapRefreshHooks();
    if (!syncFormalShellVisibility()) return;
    ensureFormalRuntimeChrome();
    installContextMenu();
    installMapRefreshHooks();
    if (isGameVisible() && !state.legacyView) showHome();
  }

  function wrapRenderHooks(){
    if (window.renderRenwu && !window.renderRenwu.__phase8PinnedWrapped) {
      var oldRenwu = window.renderRenwu;
      window.renderRenwu = function(){
        var ret = oldRenwu.apply(this, arguments);
        setTimeout(markPinnedCards, 0);
        return ret;
      };
      window.renderRenwu.__phase8PinnedWrapped = true;
    }
    if (window.renderGameState && !window.renderGameState.__phase8FormalWrapped) {
      var oldRender = window.renderGameState;
      window.renderGameState = function(){
        var ret = oldRender.apply(this, arguments);
        setTimeout(function(){
          if (!ensureFormalRuntimeChrome()) return;
          renderEventFeed();
          if (!state.legacyView) showHome();
          else renderFormalMapSoon();
        }, 0);
        return ret;
      };
      window.renderGameState.__phase8FormalWrapped = true;
    }
    if (window.addEB && !window.addEB.__phase8FormalWrapped) {
      var oldAddEB = window.addEB;
      window.addEB = function(){
        var ret = oldAddEB.apply(this, arguments);
        setTimeout(renderEventFeed, 0);
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

  window.TMPhase8FormalBridge = {
    home: showHome,
    openModule: openModule,
    openPanel: openPanel,
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
    closeArmyFlyout: rightCloseArmyFlyout,
    showEdictAdoptMenu: showFormalEdictAdoptMenu,
    dismissEdictSuggestion: dismissFormalEdictSuggestion,
    openRecordsMenu: openRecordsMenu,
    renderEventFeed: renderEventFeed,
    ensureChrome: ensureFormalChrome,
    renderMap: renderFormalMap,
    refreshMapData: refreshMapFromRuntime,
    getLiveMap: getMapData,
    findFaction: findFaction,
    pin: pinPerson,
    unpin: function(id){ pinPerson(id, false); },
    openRenwu: function(){ openModule('renwu'); },
    openRegionById: function(id){
      var r = findRegion(id);
      if (r) openRegionDossier(r);
    },
    focusRegion: function(id){ focusRegion(id, true); },
    openFactionByKey: function(key){
      var map = getMapData();
      var r = map && map.regions ? map.regions.find(function(x){ return ownerKey(x) === key; }) : null;
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
      renderFormalMapSoon();
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function(){ installFormalShell(); wrapRenderHooks(); });
  } else {
    installFormalShell();
    wrapRenderHooks();
  }
  setTimeout(function(){ installFormalShell(); wrapRenderHooks(); }, 500);
})();
