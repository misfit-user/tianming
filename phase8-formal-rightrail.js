// ── 章节导航（grep 小节标题跳转，行号会漂）──
//   御案·右 rail panels + data helpers（9 dispatch renderers + handleRightPanelAction·Wave 3 从 bridge 拆出）
//   §1 alias 块       cross-closure helpers from bridge._xxx
//   §2 module body    迁入主体（body 0 改动）：右栏各面板渲染 + 问对/求见入口（_wd*）
//   §3 社会层地基     趋势/势位/近账/议程条目 helpers（2026-06-12）
//   §4 attach         public API（panels + dispatch）
// ─────────────────────────────────────────────
// phase8-formal-rightrail.js·右 rail panels + data helpers (9 dispatch renderers + handleRightPanelAction + bindRightPanelActions)
// split from phase8-formal-bridge.js·2026-05-26·Wave 3
// paradigm·head alias 块·body 0 改动·跨闭包 helper 通过 bridge._xxx + late-bound wrapper

(function(){
  'use strict';

  var bridge = window.TMPhase8FormalBridge;
  if (!bridge) {
    console.error('[phase8-formal-rightrail] TMPhase8FormalBridge not init·bridge.js 必须先 load');
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
  var getPeople = bridge._getPeople;
  var getMapData = bridge._getMapData;
  var getParties = bridge._getParties;
  var getClasses = bridge._getClasses;
  var collectRecentEvents = bridge._collectRecentEvents;
  var getTurnText = bridge._getTurnText;
  var firstArray = bridge._firstArray;
  var actionBtn = bridge._actionBtn;
  var actionChip = bridge._actionChip;
  var renderActionStats = bridge._renderActionStats;
  var compactText = bridge._compactText;
  var getMemorials = bridge._getMemorials;
  var getIssues = bridge._getIssues;
  var getActiveScenario = bridge._getActiveScenario;
  var getArmies = bridge._getArmies;
  var issueIsResolved = bridge._issueIsResolved;
  var tmfRenwuPortrait = bridge._tmfRenwuPortrait;
  var toast = bridge._toast;
  var RIGHT_ARMY_INITIAL_ROWS = 36;
  var RIGHT_ADMIN_INITIAL_ROWS = 24;
  var RIGHT_OFFICE_INITIAL_NODES = 8;
  var _rightArmyRenderSeq = 0;
  var _rightAdminRenderSeq = 0;
  var _rightOfficeRenderSeq = 0;

  // ── late-bound wrappers for orchestration calls (bridge.X / window.X) ─
  function openPanel(slot){ return bridge.openPanel(slot); }
  function openModule(kind, opts){ return bridge.openModule(kind, opts); }
  function openGuoku(){ return bridge.openGuoku(); }
  function openOfficeStandalone(){ return bridge._openOfficeStandalone(); }
  function openShiluPreviewPanel(){ return bridge._openShiluPreviewPanel(); }
  function openHongyanPreviewPanel(){ return bridge._openHongyanPreviewPanel(); }
  function closeModule(){ return bridge._closeModule(); }
  function closeDeskOverlay(id){ return bridge._closeDeskOverlay(id); }
  function closeRightDrawer(){ return bridge._closeRightDrawer(); }
  function returnFormalHomeSoon(){ return bridge._returnFormalHomeSoon(); }
  function saveFormalDraftsToGM(){ return bridge._saveFormalDraftsToGM(); }

  // ── module body (P3 Wave 3 迁入·1623 行·body 0 改动) ──────────────

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
    try {
      if (loc && typeof window._isSameLocation === 'function' && window._isSameLocation(loc, capital)) return true;
    } catch(_) {}
    if (loc && (loc.indexOf(capital) >= 0 || /京|京师|京城|北京|顺天|宫|内廷|乾清|紫禁/.test(loc))) return true;
    if (!loc && /内阁|六部|都察院|司礼监|御史|给事中|尚书|侍郎|朝|宫|内廷/.test(office + status)) return true;
    return /在京|在朝|候旨|入值|当值/.test(status + office);
  }

  function rightIssuePersonTitle(p){
    try { if (typeof window._offFormatCharTitles === 'function') { var _multi = window._offFormatCharTitles(p, { fallback: '' }); if (_multi) return _multi; } } catch(_) {}
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

  function rightArmyContext(){
    return {
      playerFactions: rightCollectPlayerFactionNames(),
      knownFactions: rightKnownFactionNames()
    };
  }

  function rightIssueContext(){
    var pinned = {};
    (state.pinnedPeople || []).forEach(function(key){
      if (key) pinned[key] = true;
    });
    return {
      playerFactions: rightCollectPlayerFactionNames(),
      knownFactions: rightKnownFactionNames(),
      pinnedPeople: pinned
    };
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

  function rightIssueIsPlayerConsort(p){
    if (typeof window._tmIsPlayerConsort === 'function') {
      try { return !!window._tmIsPlayerConsort(p); } catch(_) {}
    }
    return !!(p && p.spouse === true);
  }

  function rightIssueIsPlayerFactionPerson(p, ctx){
    if (!p || p.alive === false || p.dead || rightIssueIsPlayer(p)) return false;
    if (rightIssueIsPlayerConsort(p)) return true;
    var playerFactions = ctx && Array.isArray(ctx.playerFactions) ? ctx.playerFactions : rightCollectPlayerFactionNames();
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
    var knownFactions = ctx && Array.isArray(ctx.knownFactions) ? ctx.knownFactions : rightKnownFactionNames();
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
    var ctx = rightIssueContext();
    return getPeople().filter(function(p){
      return p && rightIssueIsPlayerFactionPerson(p, ctx);
    }).sort(function(a, b){
      var ac = rightIssueAtCourt(a) ? 1 : 0;
      var bc = rightIssueAtCourt(b) ? 1 : 0;
      if (bc !== ac) return bc - ac;
      var ap = ctx.pinnedPeople[personKey(a)] ? 1 : 0;
      var bp = ctx.pinnedPeople[personKey(b)] ? 1 : 0;
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
    var _ag = (typeof window !== 'undefined' && window._wdDeriveAudienceAgenda) ? window._wdDeriveAudienceAgenda((typeof findCharByName === 'function' ? findCharByName(p.name) : null) || p) : null;
    if (_ag && _ag.brief) return _ag.brief;
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
    if (rightIssueIsPlayerConsort(p)) return '宫眷';
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
      '<span class="main"><b>' + esc(name) + (rightIssueIsPlayerConsort(p) ? '<i>❦</i>' : '') + '</b><small>' + esc(rightIssuePersonTitle(p)) + '</small></span>' +
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
    var rawPendingAudiences = Array.isArray(gm._pendingAudiences) ? gm._pendingAudiences : [];
    var pendingAudiences = rawPendingAudiences.filter(function(q){
      if (!q || !q.name) return false;
      if (!q.isConsort) return true;
      var p = findPerson(q.name);
      if (!p && typeof window.findCharByName === 'function') {
        try { p = window.findCharByName(q.name); } catch(_) {}
      }
      return !!(p && rightIssueIsPlayerConsort(p));
    });
    if (pendingAudiences.length !== rawPendingAudiences.length) gm._pendingAudiences = pendingAudiences;
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
      '<div class="tmrp-summary cols4">' +
        '<div class="tmrp-stat"><b>' + esc(pendingAudiences.length) + '</b><span>候见</span></div>' +
        '<div class="tmrp-stat"><b>' + esc(seekers.length) + '</b><span>求见</span></div>' +
        '<div class="tmrp-stat"><b>' + esc(waiting.length) + '</b><span>在京</span></div>' +
        '<div class="tmrp-stat"><b>' + esc(away.length) + '</b><span>远方</span></div>' +
      '</div>' +
      '<details class="tmrp-card tmrp-wd-rules"><summary><span>问对须知</span><small>召见之规 · 点开</small></summary>' +
      '<div><b>主动召见</b><span>点「百官候旨」人物，择朝堂问对或私下叙谈，由陛下先发问。</span></div>' +
      '<div><b>臣下求见</b><span>点「阶下待见 / 有臣求见」接见，对方先开口陈事。</span></div>' +
      '<div><b>不可召见</b><span>远方、在途、下狱、流放、病重、丁忧、逃亡、失踪者不走问对，改走鸿雁传书。</span></div>' +
      '</details>' +
      rightWenduiGroupNew('阶下待见', '使节、外藩、求见者 · 接见后对方先开口', queueBody, '暂无阶下待见。') +
      rightWenduiGroupNew('有臣求见', '心怀积郁、忠悃过切或久候回音者 · 接见后对方先开口', seekerBody, '暂无臣下主动求见。') +
      rightWenduiGroupNew('百官候旨', '在京在朝，可由陛下主动召见', waitingBody, '暂无在京可召人物。') +
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
      '<div class="tmrp-meta tmrp-issue-foot">朝议各有精力之耗，量力择要而行；议题、奏对与裁断，临朝自见分晓。</div>';
  }

  function renderZheng(){
    var tab = state.rightIssueTab || 'wendui';
    return '<div class="tmrp-tabs tmrp-issue-tabs">' +
      '<button type="button" class="' + (tab === 'wendui' ? 'active' : '') + '" data-right-action="issue-tab" data-tab="wendui">问对</button>' +
      '<button type="button" class="' + (tab === 'chaoyi' ? 'active' : '') + '" data-right-action="issue-tab" data-tab="chaoyi">朝议</button>' +
      '</div>' +
      (tab === 'chaoyi' ? renderRightChaoyiPanel() : renderRightWenduiPanel());
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

  function rightArmyBelongsToPlayer(a, ctx){
    if (!a || a.destroyed || a.disbanded || a.active === false) return false;
    var explicit = [
      a.faction, a.factionName, a.owner, a.camp, a.force, a.realm, a.country, a.polity
    ].filter(function(x){ return x != null && String(x).trim(); });
    if (explicit.length === 0) return true;
    if (explicit.some(rightIsGenericCourtFaction)) return true;
    ctx = ctx || rightArmyContext();
    var playerFactions = ctx.playerFactions || [];
    if (!playerFactions.length) return true;
    if (explicit.some(function(x){ return rightFactionMatch(x, playerFactions); })) return true;
    var knownFactions = ctx.knownFactions || [];
    if (knownFactions.length && explicit.some(function(x){ return rightFactionMatch(x, knownFactions); })) return false;
    return true;
  }

  function rightArmyList(){
    var raw = getArmies().filter(function(a){ return a && !a.destroyed && !a.disbanded && a.active !== false; });
    var ctx = rightArmyContext();
    var mine = raw.filter(function(a){ return rightArmyBelongsToPlayer(a, ctx); });
    return mine.length || !raw.length ? mine : raw;
  }

  function rightFindArmy(key){
    var row = rightFindArmyRecord(key, false);
    return row ? row.army : null;
  }

  function rightArmyRowsForRender(armies){
    return (Array.isArray(armies) ? armies : []).map(function(a, idx){
      return {
        army: a,
        idx: idx,
        key: rightArmyKey(a, idx),
        type: rightArmyType(a),
        soldiers: rightArmySoldiers(a)
      };
    });
  }

  function rightFindArmyRow(rows, key){
    key = String(key || '');
    if (!key) return null;
    for (var i = 0; i < rows.length; i += 1) {
      var row = rows[i];
      var a = row.army;
      if (row.key === key || rightArmyName(a) === key || String((a && a.id) || '') === key) return row;
    }
    return null;
  }

  function rightFindArmyRecord(key, fallbackFirst){
    var rows = rightArmyRowsForRender(rightArmyList());
    return rightFindArmyRow(rows, key) || (fallbackFirst ? rows[0] || null : null);
  }

  function rightBuildArmyGroups(rows){
    var order = [];
    var byType = {};
    (Array.isArray(rows) ? rows : []).forEach(function(row){
      var type = row.type || '其他';
      if (!byType[type]) {
        byType[type] = [];
        order.push(type);
      }
      byType[type].push(row);
    });
    return order.map(function(type){ return { type: type, rows: byType[type] }; });
  }

  function rightSliceArmyGroups(groups, maxRows){
    var remaining = Math.max(0, Number(maxRows) || 0);
    var out = [];
    (Array.isArray(groups) ? groups : []).forEach(function(group){
      if (remaining <= 0) return;
      var rows = (group.rows || []).slice(0, remaining);
      if (!rows.length) return;
      out.push({ type: group.type, rows: rows });
      remaining -= rows.length;
    });
    return out;
  }

  function rightArmyGroupsHtml(groups, selectedKey){
    return (Array.isArray(groups) ? groups : []).map(function(group){
      var list = group.rows || [];
      var subtotal = list.reduce(function(s, row){ return s + row.soldiers; }, 0);
      return '<div class="tmrp-ledger-head"><span>' + esc(group.type) + '</span><small>' + esc(list.length) + ' 支 · ' + esc(rightArmyFmtNum(subtotal)) + ' 兵</small></div>' +
        list.map(function(row){
          var a = row.army;
          var key = row.key;
          var active = key === selectedKey;
          var commander = rightArmyFirst(a, ['commander','commanderName','commanderDisplayName','commander_name','general','generalName','leader','leaderName','commandingOfficer','chiefCommander','chiefGeneral','mainGeneral'], '未置统帅');
          var location = rightArmyFirst(a, ['location','garrison','station','theater','region'], '未置驻地');
          return '<button type="button" class="tmrp-person ' + (active ? 'active' : '') + '" data-right-action="army-select" data-id="' + attr(key) + '">' +
            '<span class="tmrp-avatar">军</span><span><b>' + esc(rightArmyName(a)) + '</b><span>' + esc(commander) + ' · ' + esc(location) + '</span></span><small>' + esc(rightArmyFmtNum(row.soldiers)) + '</small></button>';
        }).join('');
    }).join('');
  }

  function rightScheduleArmyListHydration(token, groups, selectedKey){
    setTimeout(function(){
      var mount = document.querySelector('[data-army-list-token="' + token + '"]');
      if (!mount || String(mount.getAttribute('data-army-list-token') || '') !== String(token)) return;
      mount.innerHTML = rightArmyGroupsHtml(groups, selectedKey);
    }, 0);
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

  // 御驾亲征接入 Phase0:右栏「编制（队）」按队展开。units[] 是派生视图·此处调 ensureArmyUnits 取最新
  //   →玩家扩军裁军 / AI 高自由度推演改军后·渲染即得正确队列(源签名自愈·无须埋同步钩)。
  function rightArmyTacCN(u){
    var k = (u.arm || '') + '/' + (u.sub || '');
    var M = { 'step/spear':'长枪', 'step/sword':'刀盾', 'step/halberd':'镋钯', 'bow/bow':'弓手', 'bow/crossbow':'弩手', 'bow/musket':'火铳', 'art/cannon':'火炮', 'cav/horse':'骑', 'cav/heavy':'重骑', 'cav/shock':'突骑', 'guard/guard':'亲军' };
    return M[k] || '杂兵';
  }
  function rightArmyUnitsHtml(a){
    var us = (typeof window !== 'undefined' && window.TMArmyUnits && a) ? window.TMArmyUnits.ensureArmyUnits(a) : (a && a.units) || [];
    if (!us || !us.length) return '未录';
    var groups = [], cur = null;
    for (var i = 0; i < us.length; i++) {
      var u = us[i], tac = rightArmyTacCN(u);
      if (!cur || cur.name !== u['番号'] || cur.tac !== tac) { cur = { name: u['番号'], tac: tac, sizes: [], vet: u['历练'] }; groups.push(cur); }
      cur.sizes.push(u.men);
    }
    return groups.map(function(g){
      var full = g.sizes.filter(function(s){ return s >= 1000; }).length, part = g.sizes.length - full;
      var tail = part ? ('·' + (g.sizes.length) + '队(' + g.sizes.join('/') + ')') : ('·' + g.sizes.length + '队×' + (g.sizes[0] || 0));
      return '<b>' + esc(String(g.name)) + '</b>〔' + g.tac + '〕<span style="opacity:.72">' + tail + '·历练' + Math.round(g.vet || 0) + '</span>';
    }).join('<br>');
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

  function rightArmyActivityText(value){
    var raw = String(value || '').trim();
    if (!raw) return '驻防';
    var key = raw.toLowerCase();
    var map = {
      garrison: '驻防',
      stationed: '驻防',
      idle: '待命',
      marching: '行军',
      march: '行军',
      moving: '行军',
      siege: '围城',
      sieging: '围城',
      battle: '交战',
      fighting: '交战',
      training: '操练',
      patrol: '巡防',
      routed: '溃散',
      disbanded: '裁撤'
    };
    return map[key] || raw;
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

  function renderRightArmyDetailCard(a, idx){
    if (!a) return '';
    var armyKey = rightArmyKey(a, idx == null ? 0 : idx);
    var soldiers = rightArmySoldiers(a);
    var morale = rightArmyPercent(a, ['morale','moraleValue'], 50);
    var training = rightArmyPercent(a, ['training','trainingValue'], 50);
    var loyalty = rightArmyPercent(a, ['loyalty','cohesion'], 50);
    var control = rightArmyPercent(a, ['control','discipline','commandControl'], 50);
    var supply = rightArmyPercent(a, ['supply','supplies'], 70);
    var mutiny = rightArmyPercent(a, ['mutinyRisk','rebellionRisk'], 0);
    var hot = morale < 45 || supply < 35 || mutiny >= 55;
    var commander = rightArmyFirst(a, ['commander','commanderName','commanderDisplayName','commander_name','general','generalName','leader','leaderName','commandingOfficer','chiefCommander','chiefGeneral','mainGeneral'], '未置统帅');
    var location = rightArmyFirst(a, ['location','garrison','station','theater','region'], '未置驻地');
    var activity = rightArmyActivityText(rightArmyFirst(a, ['activity','state','status','currentAction'], '驻防'));
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
      '<tr><td>编制（队）</td><td>' + rightArmyUnitsHtml(a) + '</td></tr>' +
      '<tr><td>岁饷</td><td>' + esc(rightArmyMoneyText(a)) + '</td></tr>' +
      '<tr><td>军需</td><td>' + esc(rightArmyFirst(a, ['logistics','supplyState','supplyDepotId'], '未录')) + '</td></tr>' +
      '</tbody></table>' +
      '<div class="tmrp-action-row">' +
      '<button type="button" class="tmrp-btn primary" data-right-action="army-command" data-command="orders" data-id="' + attr(armyKey) + '">查看军令</button>' +
      '<button type="button" class="tmrp-btn" data-right-action="army-command" data-command="pay" data-id="' + attr(armyKey) + '">核饷</button>' +
      '<button type="button" class="tmrp-btn" data-right-action="army-command" data-command="train" data-id="' + attr(armyKey) + '">整训</button>' +
      '<button type="button" class="tmrp-btn" data-right-action="army-command" data-command="redeploy" data-id="' + attr(armyKey) + '">调防</button>' +
      '<button type="button" class="tmrp-btn" data-right-action="army-command" data-command="chaoyi" data-id="' + attr(armyKey) + '">入朝议</button>' +
      (rightArmyBelongsToPlayer(a) ? '<button type="button" class="tmrp-btn" data-right-action="army-command" data-command="stance" data-id="' + attr(armyKey) + '" title="御驾亲征·出兵预勾(O11):此军接敌时 问我=会战阶段临场请旨 / 必亲征=免弹窗径入战术 / 必委之=径庙算">' + esc(rightArmyStanceLabel(a)) + '</button>' : '') +
      '</div>' +
      '</section>';
  }
  /* 御驾亲征·O11 出兵预勾三态(army._battleStance 持久随档·undefined=问我) */
  function rightArmyStanceLabel(a){
    var s = a && a._battleStance;
    return s === 'always' ? '若接战·必亲征' : s === 'delegate' ? '若接战·必委之' : '若接战·问我';
  }

  // C4 流寇 UI：军情面板显在场流寇威胁（众/流窜省/势头）·仅有活贼才显（同军情预警 hot 卡范式）
  function rightRovingCard(){
    var G = rightSocGM();
    var list = (Array.isArray(G.rovingRebels) ? G.rovingRebels : []).filter(function(r){ return r && !r.disbanded && (Number(r.strength) || 0) > 0; });
    if (!list.length) return '';
    var rows = list.slice(0, 6).map(function(r){
      var str = Number(r.strength) || 0;
      var regs = (r.regions && r.regions.length) ? r.regions.slice(0, 4).join('、') : '';
      var tier = str >= 100000 ? ' · 燎原' : (str >= 30000 ? ' · 势盛' : ' · 啸聚');
      return '<div class="tmrp-step"><b>' + esc(r.name || '流寇') + '</b>众 ' + esc(rightArmyFmtNum(str)) + (regs ? ' · 流窜 ' + esc(regs) : '') + tier + '</div>';
    }).join('');
    return '<section class="tmrp-card hot"><div class="tmrp-card-title"><span>流寇警报</span><small>民变啸聚成军·剿耗军饷战损/抚开赦贼恶例</small></div>' + rows + '</section>';
  }

  // 武库卡:国家军备库存(5类)+ 原料库(4类)+ 本回合产/耗(接军工供应链 S6)
  function rightArmoryCard(){
    var AR = (typeof window !== 'undefined' && window.TMArmory);
    if (!AR || typeof GM === 'undefined' || !GM || !GM.guoku) return '';
    try {
      if (typeof AR.ensure === 'function') { AR.ensure(GM); AR.ensureMaterials(GM); }
      var arm = AR.allStock(GM), mat = AR.matAllStock(GM);
      var armoryL = GM.guoku.armory || {}, matL = GM.guoku.materials || {};
      function cell(k, val, led){
        var f = '';
        if (led) { var i = Math.round(led.lastTurnIn || 0), o = Math.round(led.lastTurnOut || 0); if (i || o) f = '<span style="color:var(--txt-d);font-size:0.68rem;margin-left:4px;">' + (i ? '+' + rightArmyFmtNum(i) : '') + (o ? (' −' + rightArmyFmtNum(o)) : '') + '</span>'; }
        return '<div style="display:flex;align-items:baseline;justify-content:space-between;padding:2px 7px;background:rgba(0,0,0,.13);border-radius:4px;"><span style="color:var(--txt-s);font-size:0.78rem;">' + esc(k) + '</span><span><b>' + esc(rightArmyFmtNum(val)) + '</b>' + f + '</span></div>';
      }
      var aH = AR.CAT_KEYS.map(function(k){ return cell(k, arm[k], armoryL[k]); }).join('');
      var mH = AR.MAT_KEYS.map(function(k){ return cell(k, mat[k], matL[k]); }).join('');
      return '<section class="tmrp-card"><div class="tmrp-card-title"><span>武库</span><small>军备 · 造械之料（本回合 +产/−耗）</small></div>' +
        '<div class="tmrp-meta">军备库存（募兵支取）</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin:3px 0 7px;">' + aH + '</div>' +
        '<div class="tmrp-meta">造械之料（军工建筑耗）</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-top:3px;">' + mH + '</div>' +
        '</section>';
    } catch (e) { return ''; }
  }

  function renderArmy(){
    var armies = rightArmyList();
    var rows = rightArmyRowsForRender(armies);
    var total = rows.reduce(function(s, row){ return s + row.soldiers; }, 0);
    var avgMorale = rows.length ? Math.round(rows.reduce(function(s, row){ return s + rightArmyPercent(row.army, ['morale'], 50); }, 0) / rows.length) : 0;
    var avgTraining = rows.length ? Math.round(rows.reduce(function(s, row){ return s + rightArmyPercent(row.army, ['training'], 50); }, 0) / rows.length) : 0;
    var selectedRow = rightFindArmyRow(rows, state.selectedArmy) || rows[0] || null;
    if (selectedRow) state.selectedArmy = selectedRow.key;
    var selectedKey = selectedRow ? selectedRow.key : '';
    var groups = rightBuildArmyGroups(rows);
    var listToken = 'army-' + (++_rightArmyRenderSeq);
    var deferredList = rows.length > RIGHT_ARMY_INITIAL_ROWS;
    var syncGroups = deferredList ? rightSliceArmyGroups(groups, RIGHT_ARMY_INITIAL_ROWS) : groups;
    if (deferredList) rightScheduleArmyListHydration(listToken, groups, selectedKey);
    var armyAlerts = rows.map(function(row){
      var a = row.army;
      var morale = rightArmyPercent(a, ['morale','moraleValue'], 50);
      var supply = rightArmyPercent(a, ['supply','supplies'], 70);
      var mutiny = rightArmyPercent(a, ['mutinyRisk','rebellionRisk'], 0);
      var loyalty = rightArmyPercent(a, ['loyalty','cohesion'], 50);
      var reasons = [];
      if (morale < 45) reasons.push('士气 ' + Math.round(morale));
      if (supply < 35) reasons.push('粮饷 ' + Math.round(supply));
      if (mutiny >= 55) reasons.push('兵变险 ' + Math.round(mutiny));
      if (loyalty < 40) reasons.push('忠诚 ' + Math.round(loyalty));
      return reasons.length ? { name: rightArmyName(a), reasons: reasons } : null;
    }).filter(Boolean);
    var armyOverviewCard = armyAlerts.length
      ? '<section class="tmrp-card hot"><div class="tmrp-card-title"><span>军情预警</span><small>士气 / 粮饷 / 兵变须留意</small></div>' +
        armyAlerts.slice(0, 5).map(function(al){ return '<div class="tmrp-step"><b>' + esc(al.name) + '</b>' + esc(al.reasons.join(' · ')) + '</div>'; }).join('') +
        (armyAlerts.length > 5 ? '<div class="tmrp-meta">另有 ' + esc(armyAlerts.length - 5) + ' 部待察。</div>' : '') + '</section>'
      : '<section class="tmrp-card"><div class="tmrp-card-title"><span>军情概览</span><small>诸军态势</small></div><div class="tmrp-meta">诸军暂无士气、粮饷或兵变之虞，边防大体安稳。点名册中部队，可于左侧展开军情明细。</div></section>';
    return '<div class="tmrp-army-shell">' +
      '<div class="tmrp-summary"><div class="tmrp-stat"><b>' + esc(armies.length) + '</b><span>军队</span></div><div class="tmrp-stat"><b>' + esc(rightArmyFmtNum(total)) + '</b><span>总兵力</span></div><div class="tmrp-stat"><b>' + esc(avgMorale + '/' + avgTraining) + '</b><span>士气/训练</span></div></div>' +
      armyOverviewCard +
      rightArmoryCard() +
      rightRovingCard() +
      '<section class="tmrp-card"><div class="tmrp-card-title"><span>部队名册</span><small>点部队·左侧展开军情</small></div>' +
      (rows.length ? '<div class="tmrp-scroll compact tmrp-army-list" data-army-list-token="' + attr(listToken) + '">' + rightArmyGroupsHtml(syncGroups, selectedKey) + (deferredList ? '<div class="tmrp-meta">余下部队正在载入...</div>' : '') + '</div>' : '<div class="tmrp-empty">麾下暂无军队。</div>') +
      '</section>' +
      '</div>';
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

  // 势力 id → 中文显示名（剧本里 faction 常以拼音 id 存·UI 不该露 id）
  function rightFactionDisplay(raw){
    raw = raw == null ? '' : String(raw).trim();
    if (!raw) return '';
    var lc = raw.toLowerCase();
    try {
      if (typeof findFaction === 'function') {
        var f = findFaction(raw, raw);
        var nm = f && (f.label || f.name || f.scenarioFactionName);
        if (nm && String(nm).trim()) return String(nm).trim();
      }
    } catch (_) {}
    try {
      var gm = window.GM || {}, p = window.P || {};
      var lists = [gm.facs, p.factions, p.facs];
      for (var li = 0; li < lists.length; li += 1) {
        var list = lists[li];
        if (!Array.isArray(list)) continue;
        for (var i = 0; i < list.length; i += 1) {
          var ff = list[i]; if (!ff) continue;
          var ids = [ff.id, ff.key, ff.factionId, ff.scenarioFactionId, ff.mapFactionId];
          for (var j = 0; j < ids.length; j += 1) {
            if (ids[j] != null && String(ids[j]).toLowerCase() === lc) {
              var n2 = ff.name || ff.label || ff.scenarioFactionName;
              if (n2 && String(n2).trim()) return String(n2).trim();
            }
          }
        }
      }
    } catch (_) {}
    return raw;
  }

  // 行政层级 英文键 → 中文（跨朝代通用单位·未知保留原值）
  function rightAdminLevelLabel(v){
    var raw = String(v == null ? '' : v).trim();
    if (!raw) return '行政区';
    var map = {
      province: '省', prefecture: '府', subprefecture: '州', department: '州',
      county: '县', district: '县', circuit: '道', region: '政区',
      capital: '京畿', frontier: '边镇'
    };
    return map[raw.toLowerCase()] || raw;
  }

  function rightAdminFromDivision(d, faction){
    d = d || {};
    var popObj = (d.population && typeof d.population === 'object') ? d.population : null;
    var detail = d.populationDetail || d.population_detail || {};
    return {
      name: d.name || d.title || d.officialName || d.id || '未名区划',
      level: rightAdminLevelLabel(d.level || d.adminLevel || d.regionType || d.type || ''),
      faction: rightFactionDisplay(faction || d.dejureOwner || d.owner || d.factionName || d.faction || ''),
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
        if (Array.isArray(list) && list.length) list.forEach(function(d){ addDivision(d, root.factionName || root.name || k); });
        else addDivision(root, root.factionName || root.name || k);
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

  function rightAdminCardsHtml(items){
    return (Array.isArray(items) ? items : []).map(function(x, i){
      var hot = rightAdminNum(x.minxin, 60) < 45 || rightAdminNum(x.corruption, 0) > 55;
      return '<section class="tmrp-card tmrp-admin-card ' + (hot ? 'hot' : '') + '" style="--admin-c:' + ['#c9a84c','#70b097','#8e6aa8','#c95340','#5e8fb3'][i % 5] + '">' +
        '<div class="tmrp-admin-title"><b>' + esc(x.name) + '</b><small>' + esc(x.level) + '<br>' + esc(x.faction || '未录') + '</small></div>' +
        '<div class="tmrp-mini-grid"><div><span>主官</span><b>' + esc(x.governor || '未置') + '</b></div><div><span>官职</span><b>' + esc(x.position || '未录') + '</b></div><div><span>人口</span><b>' + esc(rightAdminWan(x.pop)) + '</b></div><div><span>户数</span><b>' + esc(rightAdminWan(x.households)) + '</b></div></div>' +
        rightArmyBar('民心', rightAdminNum(x.minxin, 50)) + rightArmyBar('繁荣', rightAdminNum(x.prosperity, 50)) + rightArmyBar('腐败', rightAdminNum(x.corruption, 0)) +
        rightArmyRows([['地形', x.terrain], ['特产', x.resources], ['税负', x.tax], ['下辖', Array.isArray(x.children) ? x.children.length + ' 处' : '未录']]) +
        '<div class="tmrp-action-row"><button type="button" class="tmrp-btn" data-right-action="admin-edict" data-kind="安民" data-name="' + attr(x.name) + '">安民</button><button type="button" class="tmrp-btn" data-right-action="admin-edict" data-kind="巡按" data-name="' + attr(x.name) + '">巡按</button><button type="button" class="tmrp-btn" data-right-action="admin-edict" data-kind="调粮" data-name="' + attr(x.name) + '">调粮</button><button type="button" class="tmrp-btn primary" data-right-action="admin-edict" data-kind="拟诏" data-name="' + attr(x.name) + '">拟诏</button></div>' +
        '</section>';
    }).join('');
  }

  function rightScheduleAdminListHydration(token, items){
    setTimeout(function(){
      var mount = document.querySelector('[data-admin-list-token="' + token + '"]');
      if (!mount || String(mount.getAttribute('data-admin-list-token') || '') !== String(token)) return;
      mount.innerHTML = rightAdminCardsHtml(items);
    }, 0);
  }

  function renderMapPanelRich(){
    var items = rightAdminItems();
    var totalPop = items.reduce(function(s, x){ return s + rightAdminNum(x.pop, 0); }, 0);
    var crisis = items.filter(function(x){ return rightAdminNum(x.minxin, 60) < 45 || rightAdminNum(x.corruption, 0) > 55; });
    var factions = [];
    items.forEach(function(x){ if (x.faction && factions.indexOf(x.faction) < 0) factions.push(x.faction); });
    var listToken = 'admin-' + (++_rightAdminRenderSeq);
    var deferredList = items.length > RIGHT_ADMIN_INITIAL_ROWS;
    var syncItems = deferredList ? items.slice(0, RIGHT_ADMIN_INITIAL_ROWS) : items;
    if (deferredList) rightScheduleAdminListHydration(listToken, items);
    return '<div class="tmrp-admin-shell">' +
      '<div class="tmrp-summary"><div class="tmrp-stat"><b>' + esc(items.length) + '</b><span>行政区</span></div><div class="tmrp-stat"><b>' + esc(rightAdminWan(totalPop)) + '</b><span>总人口</span></div><div class="tmrp-stat"><b>' + esc(crisis.length) + '</b><span>危机</span></div></div>' +
      '<section class="tmrp-card"><div class="tmrp-card-title"><span>各方据地</span><small>据有州县的诸方</small></div>' +
      (factions.length ? '<div class="tmrp-chip-list">' + factions.slice(0, 8).map(function(f){ return '<span class="tmrp-pill">' + esc(f) + '</span>'; }).join('') + (factions.length > 8 ? '<span class="tmrp-pill">…</span>' : '') + '</div>' : '<div class="tmrp-meta">疆域归属未录。</div>') + '</section>' +
      (crisis.length ? '<section class="tmrp-card hot"><div class="tmrp-card-title"><span>区划预警</span><small>民心低 / 腐败高</small></div>' + crisis.slice(0, 4).map(function(x){ return '<div class="tmrp-step"><b>' + esc(x.name) + '</b> 民心 ' + esc(Math.round(rightAdminNum(x.minxin, 0))) + ' · 腐败 ' + esc(Math.round(rightAdminNum(x.corruption, 0))) + ' · ' + esc(x.governor || '主官未录') + '</div>'; }).join('') + '</section>' : '') +
      (items.length ? '<div class="tmrp-scroll tall" data-admin-list-token="' + attr(listToken) + '">' + rightAdminCardsHtml(syncItems) + (deferredList ? '<div class="tmrp-meta">余下政区正在载入...</div>' : '') + '</div>' : '<section class="tmrp-card empty"><div class="tmrp-empty">天下州县尚未录入舆图。</div></section>') +
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
    }).join('') + (items.length > 8 ? '<div class="tmrp-meta">余 ' + esc(items.length - 8) + ' 项未列。</div>' : '');
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
      '<section class="tmrp-card"><div class="tmrp-card-title"><span>常年岁入</span><small>' + (incomeItems.length ? esc(incomeItems.length) + ' 项 · 盐课关税田赋等' : '盐课、关税、田赋等') + '</small></div>' + rightFinanceItemList(incomeItems, '暂无常年岁入。') + '</section>' +
      '<section class="tmrp-card"><div class="tmrp-card-title"><span>常年支出</span><small>' + (expenseItems.length ? esc(expenseItems.length) + ' 项 · 军饷宗禄工程赈济' : '军饷、宗禄、工程、赈济等') + '</small></div>' + rightFinanceItemList(expenseItems, '暂无常年支出。') + '</section>' +
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

  function rightWenFilterDefs(){
    return [
      { k:'all', label:'全部' }, { k:'诗', label:'诗' }, { k:'词', label:'词' }, { k:'赋', label:'赋' },
      { k:'散文', label:'散文' }, { k:'应用文', label:'应用文' }, { k:'preserved', label:'仅传世' }, { k:'hideban', label:'隐藏查禁' }
    ];
  }
  function rightWenWorkPreserved(w){ return !!(w && (w.isPreserved || w.preserved || w.status === '传世')); }
  function rightWenFilterPass(w, f){
    if (!f || f === 'all') return true;
    if (f === 'preserved') return rightWenWorkPreserved(w);
    if (f === 'hideban') return !(w && w.isForbidden);
    return rightWorkGenreLabel(w && (w.genre || w.type)) === f;
  }

  function renderWenRich(){
    var works = rightWorks();
    var curFilter = (state && state.rightWenFilter) || 'all';
    var indexedWorks = works.map(function(w, i){ return { w: w, i: i }; });
    var filteredWorks = indexedWorks.filter(function(o){ return rightWenFilterPass(o.w, curFilter); });
    var preserved = works.filter(function(w){ return w.isPreserved || w.preserved || w.status === '传世'; }).length;
    var risky = works.filter(function(w){ return /high|medium|高|中/.test(String(w.politicalRisk || w.risk || '')); }).length;
    var pk = (typeof P !== 'undefined' && P && P.keju) || {};
    var kejuEnabled = !!pk.enabled;
    var jinshiCount = (pk.history && pk.history.length) || 0;
    var kejuBadge = pk.currentExam ? '科举进行中' : (kejuEnabled ? ('进士 ' + jinshiCount + ' 名') : '未开科');
    return '<div class="tmrp-wenshi-shell">' +
      '<section class="tmrp-card tmrp-keju-hero">' +
        '<div class="tmrp-card-title"><span>科举</span><small>开科取士·贡士·殿试·授官</small></div>' +
        '<div class="tmrp-meta">' + esc(kejuBadge) + (pk.examSubjects ? ' · ' + esc(pk.examSubjects) : '') + '</div>' +
        '<div class="tmrp-action-row"><button type="button" class="tmrp-btn primary" data-right-action="keju-open">入科举主面板</button></div>' +
      '</section>' +
      '<div class="tmrp-summary"><div class="tmrp-stat"><b>' + esc(works.length) + '</b><span>总录</span></div><div class="tmrp-stat"><b>' + esc(preserved) + '</b><span>传世</span></div><div class="tmrp-stat"><b>' + esc(risky) + '</b><span>政险</span></div></div>' +
      '<section class="tmrp-card"><div class="tmrp-card-title"><span>文苑披览</span><small>作品、品评、查禁、入诏</small></div><div class="tmrp-chip-list tmrp-wen-filters">' +
      rightWenFilterDefs().map(function(ff){ return '<button type="button" class="tmrp-pill' + (curFilter === ff.k ? ' active' : '') + '" data-right-action="wen-filter" data-filter="' + attr(ff.k) + '">' + esc(ff.label) + '</button>'; }).join('') +
      '</div></section>' +
      (!works.length ? '<section class="tmrp-empty-hero"><div class="tmrp-empty-seal">文</div><div class="tmrp-empty-t">暂无文事作品</div><div class="tmrp-empty-d">人物著述、回合文事生成后，<br>诗词、奏议、著作会在此陈列，可品评、查禁、入诏。</div></section>'
        : (!filteredWorks.length ? '<section class="tmrp-card empty"><div class="tmrp-empty">此类暂无作品，换个筛选再看。</div></section>'
        : '<div class="tmrp-scroll tall">' + filteredWorks.slice(0, 24).map(function(o){
        var w = o.w, i = o.i;
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
      }).join('') + '</div>')) +
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

  function rightSocialName(row){
    return String(row && (row.name || row.label || row.id || row.className || row.partyName) || '').trim();
  }

  function rightSocialLocalizeText(value){
    if (value == null) return '';
    if (Array.isArray(value)) return value.map(rightSocialLocalizeText).filter(Boolean).join(' / ');
    if (typeof value === 'object') {
      value = value.display || value.text || value.name || value.topic || value.title || value.goalText || value.demandText ||
        value.goal || value.agenda || value.demand || value.reason || value.id || '';
    }
    var out = String(value || '').trim();
    if (!out) return '';
    [
      [/relieve tax and arrear pressure/gi, '缓解税负与积欠'],
      [/pay arrears and stabilize garrisons/gi, '清偿欠饷并安定驻军'],
      [/pay military wage arrears/gi, '清偿军饷拖欠'],
      [/reduce tax and levy pressure/gi, '减轻税赋与征派压力'],
      [/reduce tax and arrear pressure/gi, '缓解税负与积欠'],
      [/reduce emergency levy/gi, '减轻紧急征派'],
      [/force emergency levy review/gi, '推动复核紧急征派'],
      [/keep levy review moving/gi, '维持征派复核推进'],
      [/claim credit for levy review/gi, '借征派复核争取声望'],
      [/carry rural relief through court debate/gi, '经廷议推动乡里纾困'],
      [/carry rural relief/gi, '推动乡里纾困'],
      [/carry tenant relief/gi, '推动佃户纾困'],
      [/defend arrear collection/gi, '维护追征积欠'],
      [/farmer levy relief/gi, '农户征派纾困'],
      [/emergency grain levy/gi, '急征粮役'],
      [/emergency levy review/gi, '紧急征派复核'],
      [/rural relief promise/gi, '乡里纾困承诺'],
      [/responded to rural burden/gi, '回应乡里负担'],
      [/rural burden became party agenda/gi, '乡里负担转为党派议程'],
      [/high rural burden/gi, '乡里负担沉重'],
      [/memorial approval reassured tenants/gi, '奏疏准行安定佃户'],
      [/memorial approval gives party leverage/gi, '奏疏准行给予党派筹码'],
      [/approved memorial to investigate/gi, '批准奏疏查核'],
      [/party outcome changed class mood/gi, '党派结果牵动阶层情绪'],
      [/ecology signal tax linked class pressure to party agenda/gi, '税负生态信号把阶层压力牵入党派议程'],
      [/ecology signal tax linked class pressure/gi, '税负生态信号牵动阶层压力'],
      [/ecology matched/gi, '制度生态匹配'],
      [/ecology signal/gi, '生态信号'],
      [/class-minxin bridge/gi, '阶层民心桥'],
      [/social-political-signal/gi, '社会政治信号'],
      [/runtime-pressure/gi, '运行压力'],
      [/runtime-affinity/gi, '运行亲和'],
      [/runtime-estranged/gi, '运行疏离'],
      [/player-action/gi, '玩家操作'],
      [/memorial-decision-desk/gi, '奏疏批复'],
      [/petition/gi, '请愿'],
      [/memorial/gi, '上书'],
      [/propaganda/gi, '宣传'],
      [/obstruction/gi, '阻挠'],
      [/obstruct/gi, '阻挠'],
      [/funding/gi, '资助'],
      [/alliance/gi, '联盟'],
      [/split/gi, '分裂'],
      [/strike/gi, '罢工'],
      [/uprising/gi, '民变'],
      [/association/gi, '结社'],
      [/turn-result-class-evidence/gi, '回合推演·阶层证据'],
      [/turn-result-party-evidence/gi, '回合推演·党派证据'],
      [/turn-result-corruption-pressure/gi, '回合推演·贪腐压力'],
      [/turn-result-military-arrears/gi, '回合推演·军饷拖欠'],
      [/turn-result-tax-pressure/gi, '回合推演·税负压力'],
      [/turn-result-keju-pressure/gi, '回合推演·科举压力'],
      [/turn-result-local-unrest/gi, '回合推演·地方不稳'],
      [/turn-result-land-pressure/gi, '回合推演·土地压力'],
      [/turn-result/gi, '回合推演'],
      [/fiscal-peasant-burden/gi, '财政民负'],
      [/tax-pressure/gi, '税负压力'],
      [/corruption-pressure/gi, '贪腐压力'],
      [/military-arrears/gi, '军饷拖欠'],
      [/keju-pressure/gi, '科举压力'],
      [/land-pressure/gi, '土地压力'],
      [/local-unrest/gi, '地方不稳'],
      [/arrear-pressure/gi, '积欠压力'],
      [/tax pressure/gi, '税负压力'],
      [/corruption pressure/gi, '贪腐压力'],
      [/military arrears/gi, '军饷拖欠'],
      [/wage arrears/gi, '欠饷'],
      [/tenant households carrying rent arrears/gi, '承担租佃积欠的佃户'],
      [/smoke-ecology-apply-(\d+)/gi, '生态关系更新T$1'],
      [/smoke-ecology-tax-(\d+)/gi, '税负生态信号T$1'],
      [/smoke-cause-chain-turn/gi, '因果链回合证据'],
      [/smoke-cause-chain-apply/gi, '因果链应用'],
      [/smoke-turn-result-apply/gi, '回合推演应用'],
      [/smoke-turn-result/gi, '回合推演测试'],
      [/smoke-llm-calibration/gi, 'LLM校准'],
      [/confidence\s+/gi, '置信 '],
      [/affinity=(\d+)/gi, '亲和=$1'],
      [/unfulfilled/gi, '未兑现'],
      [/fulfilled/gi, '已兑现'],
      [/blocked/gi, '受阻'],
      [/issued/gi, '已明发'],
      [/reissued/gi, '再议'],
      [/resolved/gi, '已解决'],
      [/expired/gi, '已过期'],
      [/planned/gi, '筹划中'],
      [/active/gi, '活跃'],
      [/aligned/gi, '趋同'],
      [/estranged/gi, '疏离'],
      [/wavering/gi, '摇摆'],
      [/latent/gi, '潜伏'],
      [/calm/gi, '平稳'],
      [/signal/gi, '信号'],
      [/action/gi, '行动']
    ].forEach(function(pair){ out = out.replace(pair[0], pair[1]); });
    var tags = {
      fiscal: '财政', tax: '税负', land: '土地', keju: '科举', office: '官制', local: '地方',
      military: '军务', commerce: '商贸', corvee: '徭役', levy: '征派', tenant: '佃户',
      peasant: '民户', relief: '纾困', memorial: '奏疏', court: '廷议', party: '党派',
      class: '阶层', minxin: '民心', wage: '军饷', arrears: '积欠', source: '来源'
    };
    out = out.replace(/\b([a-z][a-z0-9_-]*)\b/gi, function(token){
      var key = String(token || '').toLowerCase();
      return Object.prototype.hasOwnProperty.call(tags, key) ? tags[key] : token;
    });
    return out;
  }

  function rightSocialBriefText(value){
    return rightSocialLocalizeText(rightSocialFirstText(value));
  }

  function rightSocialSameName(a, b){
    a = String(a || '').replace(/\s+/g, '').toLowerCase();
    b = String(b || '').replace(/\s+/g, '').toLowerCase();
    return !!(a && b && a === b);
  }

  function rightSocialPushCause(out, cause){
    if (!cause || !cause.text) return;
    var sig = [cause.source || '', cause.turn || '', cause.text || ''].join('|');
    if (out.some(function(x){ return [x.source || '', x.turn || '', x.text || ''].join('|') === sig; })) return;
    out.push(cause);
  }

  function rightSocialCauseTextFromChange(ch){
    if (!ch) return '';
    var field = ch.field ? rightSocialLocalizeText(ch.field) + ' ' : '';
    var delta = '';
    var oldN = Number(ch.oldValue);
    var newN = Number(ch.newValue);
    if (isFinite(oldN) && isFinite(newN) && oldN !== newN) delta = ' ' + (newN > oldN ? '+' : '') + Math.round((newN - oldN) * 100) / 100;
    return [field + delta, rightSocialLocalizeText(ch.reason)].filter(Boolean).join(' · ');
  }

  function rightSocialTurnChanges(actorType, name, out){
    var gm = window.GM || {};
    var bucket = gm.turnChanges && gm.turnChanges[actorType === 'party' ? 'parties' : 'classes'];
    (Array.isArray(bucket) ? bucket : []).forEach(function(row){
      if (!row || !rightSocialSameName(row.name, name)) return;
      (Array.isArray(row.changes) ? row.changes : []).slice(-3).forEach(function(ch){
        var text = rightSocialCauseTextFromChange(ch);
        if (text) rightSocialPushCause(out, { source: '回合变化', text: text });
      });
    });
  }

  function rightSocialClassCauses(row, out){
    (Array.isArray(row._socialPoliticalHistory) ? row._socialPoliticalHistory : []).slice(-3).forEach(function(h){
      rightSocialPushCause(out, {
        turn: h.turn,
        source: rightSocialLocalizeText(h.sourceSystem || h.source || '系统信号'),
        text: [h.kind, h.reason].map(rightSocialLocalizeText).filter(Boolean).join(' · ')
      });
    });
    (Array.isArray(row.partyOutcomeHistory) ? row.partyOutcomeHistory : []).slice(-3).forEach(function(h){
      var refs = (Array.isArray(h.refs) ? h.refs : []).map(function(r){ return r && r.partyName; }).filter(Boolean).join('/');
      rightSocialPushCause(out, {
        turn: h.turn,
        source: '廷议回响',
        text: [(refs ? refs : ''), rightSocialLocalizeText(h.outcome || h.status), h.satisfactionDelta != null ? ('满意 ' + h.satisfactionDelta) : ''].filter(Boolean).join(' · ')
      });
    });
    var gm = window.GM || {};
    (Array.isArray(gm._partyClassCourtIssueLinks) ? gm._partyClassCourtIssueLinks : []).slice(-8).forEach(function(x){
      if (!x || !rightSocialSameName(x.className, rightSocialName(row))) return;
      rightSocialPushCause(out, {
        turn: x.turn,
        source: '议题牵连',
        text: [(x.party || ''), rightSocialLocalizeText(x.topic || ''), rightSocialLocalizeText(x.goalText || '')].filter(Boolean).join(' · ')
      });
    });
  }

  function rightSocialPartyCauses(row, out){
    (Array.isArray(row._socialPoliticalHistory) ? row._socialPoliticalHistory : []).slice(-3).forEach(function(h){
      rightSocialPushCause(out, {
        turn: h.turn,
        source: rightSocialLocalizeText(h.sourceSystem || h.source || '系统信号'),
        text: [h.kind, h.reason].map(rightSocialLocalizeText).filter(Boolean).join(' · ')
      });
    });
    (Array.isArray(row.agenda_history) ? row.agenda_history : []).slice(-3).forEach(function(h){
      rightSocialPushCause(out, {
        turn: h.turn,
        source: rightSocialLocalizeText(h.source || '议程变动'),
        text: [h.reason, h.currentAgenda, h.shortGoal, h.text].map(rightSocialLocalizeText).filter(Boolean).join(' · ')
      });
    });
    var gm = window.GM || {};
    (Array.isArray(gm._partyClassCourtIssueLinks) ? gm._partyClassCourtIssueLinks : []).slice(-8).forEach(function(x){
      if (!x || !rightSocialSameName(x.party, rightSocialName(row))) return;
      rightSocialPushCause(out, {
        turn: x.turn,
        source: '议题牵连',
        text: [(x.className || ''), rightSocialLocalizeText(x.topic || ''), rightSocialLocalizeText(x.goalText || '')].filter(Boolean).join(' · ')
      });
    });
  }

  function rightSocialNearCauses(actorType, row){
    var out = [];
    var name = rightSocialName(row);
    rightSocialTurnChanges(actorType, name, out);
    if (actorType === 'party') rightSocialPartyCauses(row, out);
    else rightSocialClassCauses(row, out);
    return out.filter(function(x){ return x && x.text; }).slice(-4).reverse();
  }

  function rightSocialSignalCauses(actorType, row){
    var api = window.TM && window.TM.SocialPoliticalSignals;
    if (!api || typeof window.TM.SocialPoliticalSignals.getRecentCauses !== 'function') return [];
    try {
      return window.TM.SocialPoliticalSignals.getRecentCauses(window.GM || {}, actorType, rightSocialName(row), { limit: 4 }) || [];
    } catch (_) {
      return [];
    }
  }

  function renderRightSocialSignalCauses(actorType, row){
    var causes = rightSocialSignalCauses(actorType, row);
    if (!causes.length) return '';
    return '<div class="tmrp-social-cause tmrp-signal-cause"><b>近因</b>' + causes.map(function(c){
      var head = [(c.turn ? ('T' + c.turn) : ''), c.sourceLabel || c.sourceSystem || '信号', c.kind || ''].filter(Boolean).join(' · ');
      var detail = [c.summary || '', c.linkedIssue ? ('议题 ' + c.linkedIssue) : '', c.reason || ''].filter(Boolean).join(' · ');
      head = rightSocialLocalizeText(head);
      detail = rightSocialLocalizeText(detail);
      var title = [head, detail].filter(Boolean).join(' · ');
      return '<span class="tmrp-cause-row" title="' + attr(title) + '"><em class="tmrp-cause-source">' + esc(head) + '</em><small>' + esc(detail || '暂无细节') + '</small></span>';
    }).join('') + '</div>';
  }

  function renderRightSocialCauses(actorType, row){
    var signalHtml = renderRightSocialSignalCauses(actorType, row);
    var causes = rightSocialNearCauses(actorType, row);
    if (!causes.length) return signalHtml || '<div class="tmrp-social-cause empty"><b>近因</b><span>暂无可追溯变化</span></div>';
    return signalHtml + '<div class="tmrp-social-cause"><b>近因</b>' + causes.map(function(c){
      var text = rightSocialLocalizeText(c.text || '');
      var source = rightSocialLocalizeText(c.source || '来源');
      return '<span title="' + attr(text) + '">' + esc((c.turn ? ('T' + c.turn + ' · ') : '') + source + ' · ' + text) + '</span>';
    }).join('') + '</div>';
  }

  function rightSocialFirstText(v){
    var arr = Array.isArray(v) ? v : [v];
    for (var i = 0; i < arr.length; i += 1) {
      var x = arr[i];
      if (x == null) continue;
      if (typeof x === 'object') x = x.text || x.name || x.party || x.class || x.goal || x.agenda || x.demand || '';
      x = String(x || '').trim();
      if (x) return rightSocialLocalizeText(x);
    }
    return '';
  }

  function rightSocialClassParties(row){
    var out = [];
    function add(v){
      if (!v) return;
      if (typeof v === 'object') v = v.party || v.partyName || v.class || v.name || v.id || '';
      v = String(v || '').trim();
      if (v && out.indexOf(v) < 0) out.push(v);
    }
    [row.supportingParties, row.supporting_parties, row.parties, row.linkedParties].forEach(function(list){
      (Array.isArray(list) ? list : [list]).forEach(add);
    });
    var gm = window.GM || {};
    var idx = gm._partyGoalRelationIndex;
    var name = rightSocialName(row);
    if (idx && idx.classParties && idx.classParties[name]) (Array.isArray(idx.classParties[name]) ? idx.classParties[name] : [idx.classParties[name]]).forEach(add);
    (Array.isArray(gm._partyClassCourtIssueLinks) ? gm._partyClassCourtIssueLinks : []).forEach(function(x){
      if (x && rightSocialSameName(x.className, name)) add(x.party);
    });
    return out.slice(0, 3);
  }

  function rightSocialRelationEdges(actorType, row){
    var gm = window.GM || {};
    var name = rightSocialName(row);
    var edges = [];
    var state = gm.partyClassRelations && gm.partyClassRelations.edges;
    if (state && typeof state === 'object') {
      Object.keys(state).forEach(function(k){
        var edge = state[k];
        if (!edge) return;
        if (actorType === 'party') {
          if (!rightSocialSameName(edge.partyName, name)) return;
        } else if (!rightSocialSameName(edge.className, name)) return;
        edges.push(edge);
      });
    }
    var idx = gm._partyGoalRelationIndex;
    if (idx && Array.isArray(idx.evidence)) {
      idx.evidence.forEach(function(e){
        if (!e) return;
        if (actorType === 'party') {
          if (!rightSocialSameName(e.partyName, name)) return;
        } else if (!rightSocialSameName(e.className, name)) return;
        var exists = edges.some(function(edge){
          return rightSocialSameName(edge.className, e.className) && rightSocialSameName(edge.partyName, e.partyName);
        });
        if (!exists) edges.push({
          className: e.className,
          partyName: e.partyName,
          affinity: e.affinity,
          trust: e.trust,
          grievance: e.grievance,
          status: e.status || e.source || '',
          lastSource: e.source || '',
          lastReason: e.detail || ''
        });
      });
    }
    return edges.sort(function(a, b){
      var aa = Number(a && a.affinity);
      var bb = Number(b && b.affinity);
      if (!isFinite(aa)) aa = 0;
      if (!isFinite(bb)) bb = 0;
      return bb - aa;
    }).slice(0, 4);
  }

  function rightSocialEcologySignals(actorType, row){
    var gm = window.GM || {};
    var name = rightSocialName(row);
    var store = gm._partyClassEcology || {};
    return (Array.isArray(store.signalHistory) ? store.signalHistory : []).filter(function(s){
      if (!s) return false;
      var list = actorType === 'party' ? s.affectedParties : s.affectedClasses;
      return (Array.isArray(list) ? list : []).some(function(x){ return rightSocialSameName(x, name); });
    }).slice(-3).reverse();
  }

  function rightRelationClassRisk(className){
    var cls = rightFindSocialActor('class', className);
    return cls ? rightSocialRisk('class', cls) : '风险待察';
  }

  function rightRelationRouteForecast(edge){
    edge = edge || {};
    var className = edge.className || '';
    var partyName = edge.partyName || '';
    var demand = rightSocialLocalizeText(rightClassDemandByName(className) || '阶层诉求');
    var risk = rightRelationClassRisk(className);
    var grievance = Number(edge.grievance);
    if (!isFinite(grievance)) grievance = 45;
    var affinity = Number(edge.affinity);
    var highRisk = /民变|罢工|请愿|风险/.test(risk) || grievance >= 66 || (isFinite(affinity) && affinity < 30);
    return '预期：通过诏书/奏疏/问对/朝议/鸿雁处理「' + demand + '」会牵动' +
      (partyName || '相关党派') + '/' + (className || '相关阶层') + '关系 · 风险：' + risk +
      (highRisk ? ' · 建议廷议' : '');
  }

  function renderRightSocialEcology(actorType, row){
    var edges = rightSocialRelationEdges(actorType, row);
    var signals = rightSocialEcologySignals(actorType, row);
    if (!edges.length && !signals.length) return '';
    function edgeRow(edge){
      edge = edge || {};
      var peer = actorType === 'party' ? edge.className : edge.partyName;
      if (!peer) return '';
      var status = edge.status || 'latent';
      var statusLabel = rightSocialLocalizeText(status);
      var aff = edge.affinity != null && isFinite(Number(edge.affinity)) ? Math.round(Number(edge.affinity)) : '—';
      var trust = edge.trust != null && isFinite(Number(edge.trust)) ? Math.round(Number(edge.trust)) : '—';
      var grievance = edge.grievance != null && isFinite(Number(edge.grievance)) ? Math.round(Number(edge.grievance)) : '—';
      var source = edge.lastSource || edge.source || '';
      var reason = edge.lastReason || edge.reason || '';
      var chainKind = actorType === 'party' ? 'demand' : 'party';
      var routeForecast = rightSocialLocalizeText(rightRelationRouteForecast(edge));
      var sourceReason = rightSocialLocalizeText([source, reason].filter(Boolean).join(' · '));
      return '<div class="tmrp-ecology-edge ' + attr(String(status).toLowerCase()) + '">' +
        '<button type="button" class="tmrp-ecology-link" data-right-action="social-chain" data-chain-kind="' + attr(chainKind) + '" data-actor-type="' + attr(actorType) + '" data-name="' + attr(rightSocialName(row)) + '" data-target="' + attr(peer) + '" data-topic="' + attr(reason || peer) + '">' + esc(peer) + '</button>' +
        '<span>' + esc(statusLabel) + '</span>' +
        '<small>亲和 ' + esc(aff) + ' · 信 ' + esc(trust) + ' · 怨 ' + esc(grievance) + '</small>' +
        (sourceReason ? '<em title="' + attr(sourceReason) + '">' + esc(sourceReason) + '</em>' : '') +
        '<div class="tmrp-ecology-forecast" title="' + attr(routeForecast) + '">' + esc(routeForecast) + '</div>' +
        '</div>';
    }
    function signalRow(s){
      var cats = Array.isArray(s.categories) ? s.categories.join('/') : '';
      var kind = rightSocialLocalizeText(s.kind || 'signal');
      var sourceText = rightSocialLocalizeText([s.source || '', cats].filter(Boolean).join(' · '));
      return '<div class="tmrp-ecology-signal"><b>T' + esc(s.turn || '') + ' ' + esc(kind) + '</b><span>' + esc(sourceText) + '</span></div>';
    }
    return '<div class="tmrp-ecology"><div class="tmrp-ecology-head"><b>生态关系</b><small>' + esc(edges.length ? '动态亲和' : '信号来源') + '</small></div>' +
      (edges.length ? '<div class="tmrp-ecology-list">' + edges.map(edgeRow).filter(Boolean).join('') + '</div>' : '') +
      (signals.length ? '<div class="tmrp-ecology-signals">' + signals.map(signalRow).join('') + '</div>' : '') +
      '</div>';
  }

  function rightClassCharacterAllEdges(){
    var gm = window.GM || {};
    var store = gm.classCharacterRelations || {};
    var raw = store.edges || {};
    var rows = [];
    if (Array.isArray(raw)) rows = raw.slice();
    else Object.keys(raw).forEach(function(k){ if (raw[k]) rows.push(raw[k]); });
    return rows.filter(Boolean);
  }

  function rightClassCharacterScore(edge){
    edge = edge || {};
    return (Number(edge.affinity) || 0) + (Number(edge.legitimacy) || 0) + (Number(edge.trust) || 0) + (Number(edge.mobilization) || 0) * 0.4 - (Number(edge.grievance) || 0) * 0.7;
  }

  function rightClassCharacterEdgesForClass(row){
    var name = rightSocialName(row);
    var seen = {};
    var out = [];
    function add(edge){
      if (!edge || !rightSocialSameName(edge.className, name)) return;
      var key = String(edge.characterId || edge.characterName || '') + '|' + String(edge.role || '');
      if (!key || seen[key]) return;
      seen[key] = true;
      out.push(edge);
    }
    rightPcArray(row && row.classCharacterRelations).forEach(add);
    rightClassCharacterAllEdges().forEach(add);
    return out.sort(function(a, b){ return rightClassCharacterScore(b) - rightClassCharacterScore(a); }).slice(0, 8);
  }

  function rightClassCharacterRoleLabel(role){
    role = String(role || '').toLowerCase();
    if (role === 'patron') return '庇护';
    if (role === 'broker') return '调停';
    if (role === 'suppressor') return '压制';
    if (role === 'symbol') return '象征';
    if (role === 'debtor') return '亏欠';
    if (role === 'enemy') return '仇怨';
    return '代表';
  }

  function rightClassCharacterPct(v){
    var n = Number(v);
    if (!isFinite(n)) return '—';
    if (Math.abs(n) <= 1) n *= 100;
    return String(Math.round(Math.max(0, Math.min(100, n))));
  }

  function renderRightClassCharacterRow(edge){
    edge = edge || {};
    var name = edge.characterName || edge.characterId || '未名人物';
    var reason = rightSocialLocalizeText(rightPcArray(edge.evidence).slice(-2).join(' · ') || edge.reason || edge.source || '');
    return '<button type="button" class="tmrp-ecology-edge tmrp-class-character-edge" data-right-action="wendui-select" data-id="' + attr(edge.characterId || edge.characterName || '') + '">' +
      '<span>' + esc(name) + '</span>' +
      '<small>' + esc(rightClassCharacterRoleLabel(edge.role)) + ' · 亲 ' + esc(rightClassCharacterPct(edge.affinity)) + ' · 信 ' + esc(rightClassCharacterPct(edge.trust)) + ' · 怨 ' + esc(rightClassCharacterPct(edge.grievance)) + '</small>' +
      (reason ? '<em title="' + attr(reason) + '">近因：' + esc(rightPcText(reason, 88)) + '</em>' : '') +
      '</button>';
  }

  function renderRightClassCharacterGroup(title, rows){
    rows = rightPcArray(rows).filter(Boolean);
    if (!rows.length) return '';
    return '<details class="tmrp-class-character-group" open><summary>' + esc(title) + ' · ' + esc(rows.length) + '</summary>' + rows.map(renderRightClassCharacterRow).join('') + '</details>';
  }

  function renderRightClassCharacterLinks(row){
    var edges = rightClassCharacterEdgesForClass(row);
    if (!edges.length) return '';
    var reps = edges.filter(function(e){ return !/suppressor|enemy/i.test(String(e.role || '')) && (Number(e.grievance) || 0) < 0.45; }).slice(0, 3);
    var beneficiaries = edges.filter(function(e){ return reps.indexOf(e) < 0 && (Number(e.affinity) || 0) >= 0.45; }).slice(0, 3);
    var grudges = edges.filter(function(e){ return /suppressor|enemy/i.test(String(e.role || '')) || (Number(e.grievance) || 0) >= 0.45; }).slice(0, 3);
    return '<div class="tmrp-ecology tmrp-class-character"><div class="tmrp-ecology-head"><b>阶层人物</b><small>谁代表谁，谁欠谁</small></div><div class="tmrp-ecology-list">' +
      renderRightClassCharacterGroup('代表人物', reps) +
      renderRightClassCharacterGroup('受益人物', beneficiaries) +
      renderRightClassCharacterGroup('怨恨人物', grudges) +
      '</div></div>';
  }

  function rightClassCharacterDelegateName(row){
    var edges = rightClassCharacterEdgesForClass(row);
    for (var i = 0; i < edges.length; i += 1) {
      var e = edges[i] || {};
      if (/suppressor|enemy/i.test(String(e.role || ''))) continue;
      if ((Number(e.grievance) || 0) >= 0.55) continue;
      return e.characterId || e.characterName || '';
    }
    return '';
  }

  function rightClassMinxinKey(row){
    try {
      if (window.TM && TM.ClassMinxinBridge && typeof TM.ClassMinxinBridge._classKeyOf === 'function') {
        return TM.ClassMinxinBridge._classKeyOf(row || {});
      }
    } catch(_) {}
    var explicit = row && (row.classKey || row.key || row.id || row.classId);
    if (explicit) return String(explicit || '').replace(/\s+/g, '').toLowerCase().trim();
    return String(rightSocialName(row) || '').replace(/[\s\u3000'"`.,;:!?()[\]{}<>\/\\|_-]+/g, '').toLowerCase().trim();
  }

  function rightClassMinxinBridgeRows(row){
    var gm = window.GM || {};
    var byClass = gm.minxin && gm.minxin.byClass;
    if (!byClass || typeof byClass !== 'object') return '';
    var key = rightClassMinxinKey(row);
    var name = rightSocialName(row);
    var mx = byClass[key] || null;
    if (!mx) {
      Object.keys(byClass).some(function(k){
        var candidate = byClass[k];
        if (!candidate) return false;
        if (rightSocialSameName(candidate.className, name) || rightSocialSameName(k, key)) {
          mx = candidate;
          key = k;
          return true;
        }
        return false;
      });
    }
    var ledger = rightPcArray(gm._classMinxinBridgeLedger).filter(function(x){
      return x && (rightSocialSameName(x.classKey, key) || rightSocialSameName(x.className, name));
    }).slice(-3).reverse();
    if (!mx && !ledger.length) return '';
    var rows = '';
    if (mx) {
      var trueIdx = Number(mx.true != null ? mx.true : mx.index);
      var perceived = Number(mx.perceived != null ? mx.perceived : trueIdx);
      var phaseLabel = rightSocialLocalizeText(mx.unrestPhase || 'calm');
      var pressureReason = rightSocialLocalizeText(mx.lastPressure && mx.lastPressure.reason || '');
      rows += '<div class="tmrp-ecology-edge ' + attr(String(mx.unrestPhase || 'calm').toLowerCase()) + '">' +
        '<span>民心</span>' +
        '<small>真实 ' + esc(isFinite(trueIdx) ? Math.round(trueIdx) : '—') + ' · 感知 ' + esc(isFinite(perceived) ? Math.round(perceived) : '—') + ' · ' + esc(phaseLabel) + '</small>' +
        (pressureReason ? '<em title="' + attr(pressureReason) + '">' + esc(rightPcText(pressureReason, 90)) + '</em>' : '') +
        '</div>';
    }
    ledger.forEach(function(x){
      var regs = rightPcArray(x.appliedRegions).map(function(r){ return r && (r.region || r.name || r.id || r); }).filter(Boolean).slice(0, 3).join(' / ');
      rows += '<div class="tmrp-ecology-signal"><b>T' + esc(x.turn || '') + ' ' + esc(rightSocialLocalizeText(x.sourceSystem || 'class-minxin')) + '</b><span>' +
        esc(rightSocialLocalizeText([x.linkedIssue || '', regs || '', x.reason || ''].filter(Boolean).join(' · '))).slice(0, 160) +
        '</span></div>';
    });
    return '<div class="tmrp-ecology"><div class="tmrp-ecology-head"><b>阶层民心</b><small>民心联动</small></div><div class="tmrp-ecology-list">' + rows + '</div></div>';
  }

  function rightSocialIssueLinks(actorType, row){
    var gm = window.GM || {};
    var name = rightSocialName(row);
    var out = [];
    function add(raw, source){
      if (!raw) return;
      var topic = raw.topic || raw.title || raw.goalText || raw.reason || '';
      if (!topic) return;
      var id = raw.issueId || raw.id || raw.topicId || raw.chaoyiTrackId || topic;
      var sig = String(id || topic);
      if (out.some(function(x){ return String(x.id || x.topic) === sig; })) return;
      out.push({ id: id, topic: rightSocialLocalizeText(topic), source: rightSocialLocalizeText(source || raw.source || ''), party: raw.party || raw.sourceParty || '', className: raw.className || raw.sourceClass || '' });
    }
    (Array.isArray(gm._partyClassCourtIssueLinks) ? gm._partyClassCourtIssueLinks : []).forEach(function(x){
      if (!x) return;
      if (actorType === 'party' && rightSocialSameName(x.party, name)) add(x, 'goal-link');
      if (actorType !== 'party' && rightSocialSameName(x.className, name)) add(x, 'goal-link');
    });
    (Array.isArray(gm._pendingTinyiTopics) ? gm._pendingTinyiTopics : []).forEach(function(x){
      if (!x) return;
      if (actorType === 'party' && (rightSocialSameName(x.party, name) || rightSocialSameName(x.sourceParty, name))) add(x, 'pending');
      if (actorType !== 'party' && (rightSocialSameName(x.className, name) || rightSocialSameName(x.sourceClass, name))) add(x, 'pending');
    });
    return out.slice(0, 3);
  }

  function rightSocialRecentRuling(actorType, row, issues){
    var gm = window.GM || {};
    var name = rightSocialName(row);
    var issueTopics = (issues || []).map(function(x){ return String(x.topic || x.id || ''); });
    var rows = []
      .concat(Array.isArray(gm.tinyiSeals) ? gm.tinyiSeals : [])
      .concat(Array.isArray(gm._courtRecords) ? gm._courtRecords : []);
    for (var i = rows.length - 1; i >= 0; i -= 1) {
      var r = rows[i] || {};
      var topic = r.topic || r.title || '';
      var actorHit = actorType === 'party'
        ? (rightSocialSameName(r.sourceParty, name) || rightSocialSameName(r.party, name))
        : (rightSocialSameName(r.sourceClass, name) || rightSocialSameName(r.className, name));
      var issueHit = topic && issueTopics.some(function(t){ return t && (String(topic).indexOf(t) >= 0 || String(t).indexOf(topic) >= 0); });
      if (actorHit || issueHit) return { topic: topic, status: r.sealStatus || r.status || r.result || r.decision || '', grade: r.grade || '' };
    }
    return null;
  }

  function rightSocialRisk(actorType, row){
    if (actorType === 'party') {
      var cohesion = rightSocNum(row, ['cohesion','unity'], 50);
      var inf = rightSocNum(row, ['influence','power','weight'], 50);
      if (cohesion < 45) return '凝聚偏低，易分裂';
      if (inf > 70) return '党势偏盛，易阻挠';
      return row.shortGoal || row.currentAgenda ? '目标推进中' : '暂无明显风险';
    }
    var sat = rightSocNum(row, ['satisfaction','support','mood','loyalty'], 50);
    var unrest = row && row.unrestLevels || {};
    var strike = Number(unrest.strike || 0);
    var revolt = Number(unrest.revolt || 0);
    if (sat < 30 || revolt >= 70) return '民变苗头';
    if (strike >= 60) return '罢工/聚众风险';
    if (sat < 45) return '请愿升温';
    return '风险平稳';
  }

  function rightSocialChainButton(kind, label, target, topic, actorType, row){
    if (!label) return '';
    var displayLabel = rightSocialLocalizeText(label);
    var displayTopic = rightSocialLocalizeText(topic || label);
    return '<button type="button" class="tmrp-chain-step" data-right-action="social-chain" data-chain-kind="' + attr(kind) + '" data-actor-type="' + attr(actorType) + '" data-name="' + attr(rightSocialName(row)) + '" data-target="' + attr(target || '') + '" data-topic="' + attr(displayTopic) + '">' + esc(displayLabel) + '</button>';
  }

  function rightClassActionDelegate(row){
    var actions = rightActorActionRows('class', row);
    for (var i = 0; i < actions.length; i += 1) {
      var a = actions[i] || {};
      if (a.delegateCharacter || a.delegateCharacterId) {
        return {
          label: a.delegateCharacter || a.delegateCharacterId,
          target: a.delegateCharacterId || a.delegateCharacter,
          role: a.delegateRole || '',
          evidence: a.delegateEvidence || ''
        };
      }
    }
    var edges = rightClassCharacterEdgesForClass(row);
    for (var j = 0; j < edges.length; j += 1) {
      var e = edges[j] || {};
      if (/suppressor|enemy/i.test(String(e.role || ''))) continue;
      if ((Number(e.grievance) || 0) >= 0.5) continue;
      if (e.characterName || e.characterId) {
        return {
          label: e.characterName || e.characterId,
          target: e.characterId || e.characterName,
          role: e.role || '',
          evidence: rightPcArray(e.evidence).join(' / ')
        };
      }
    }
    return null;
  }

  function renderRightSocialChain(actorType, row){
    var name = rightSocialName(row);
    var issues = rightSocialIssueLinks(actorType, row);
    var demand = actorType === 'party'
      ? rightSocialFirstText(row.shortGoal || row.currentAgenda || row.agenda)
      : rightSocialFirstText(row.currentDemand || row.demands);
    var parties = actorType === 'party' ? [name] : rightSocialClassParties(row);
    var issue = issues[0] || null;
    var ruling = rightSocialRecentRuling(actorType, row, issues);
    var risk = rightSocialRisk(actorType, row);
    var html = '';
    html += rightSocialChainButton('demand', demand || (actorType === 'party' ? '近期目标' : '阶层诉求'), demand, issue && issue.topic, actorType, row);
    if (actorType !== 'party') {
      var delegate = rightClassActionDelegate(row);
      html += rightSocialChainButton('delegate', delegate ? delegate.label : '待定代理人物', delegate && (delegate.target || delegate.label), issue && issue.topic || demand, actorType, row);
    }
    html += rightSocialChainButton('party', parties[0] || (actorType === 'party' ? name : '待形成支持党派'), parties[0] || '', issue && issue.topic, actorType, row);
    html += rightSocialChainButton('issue', issue ? issue.topic : '待付廷议', issue && issue.id, issue && issue.topic || demand, actorType, row);
    html += rightSocialChainButton('ruling', ruling ? ((ruling.status || '裁决') + (ruling.grade ? ' ' + ruling.grade : '')) : '暂无裁决', ruling && ruling.topic, ruling && ruling.topic || demand, actorType, row);
    html += rightSocialChainButton('risk', risk, risk, issue && issue.topic || demand, actorType, row);
    return '<div class="tmrp-social-chain">' + html + '</div>';
  }

  function rightActorActionRows(actorType, row){
    var gm = window.GM || {};
    var name = rightSocialName(row);
    var source = actorType === 'party' ? gm.party_actions : gm.class_actions;
    var embedded = row && (actorType === 'party' ? row.party_actions : row.class_actions);
    var seen = {};
    return (rightPcArray(source).concat(rightPcArray(embedded))).filter(function(a){
      if (!a || a.actorType !== actorType || !rightSocialSameName(a.actorId, name)) return false;
      if (/expired|resolved|cancelled|canceled/i.test(String(a.status || ''))) return false;
      var key = a.id || [a.actorType, a.actorId, a.actionType, a.linkedIssue, a.turn].join('|');
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    }).slice(-4).reverse();
  }

  function rightActorTinyiForAction(action){
    var gm = window.GM || {};
    var key = action && (action.id || [action.actorType, action.actorId, action.actionType, action.linkedIssue, action.agenda || action.grievance, action.turn].join('|'));
    var issue = action && action.linkedIssue;
    var rows = Array.isArray(gm._pendingTinyiTopics) ? gm._pendingTinyiTopics : [];
    for (var i = 0; i < rows.length; i += 1) {
      var topic = rows[i] || {};
      var linked = Array.isArray(topic.linkedActions) ? topic.linkedActions : [];
      if (key && linked.some(function(x){ return String(x) === String(key); })) return topic;
      if (issue && String(topic.issueId || topic.id || topic.topicId || topic.linkedIssue || '') === String(issue)) return topic;
    }
    return null;
  }

  function renderRightActorActions(actorType, row){
    var actions = rightActorActionRows(actorType, row);
    if (!actions.length) return '';
    return '<div class="tmrp-actor-action"><b>正在行动</b>' + actions.map(function(a){
      var tinyi = rightActorTinyiForAction(a);
      var head = rightSocialLocalizeText(['T' + (a.turn || ''), a.actionType || 'action', a.status || 'planned'].filter(Boolean).join(' · '));
      var delegate = a.delegateCharacter ? ('代理人物：' + a.delegateCharacter + (a.delegateRole ? '（' + rightClassCharacterRoleLabel(a.delegateRole) + '）' : '')) : '';
      var delegateEvidence = a.delegateEvidence ? ('近因：' + rightSocialLocalizeText(a.delegateEvidence)) : '';
      var body = rightSocialLocalizeText([
        a.agenda || a.grievance || '',
        delegate,
        delegateEvidence,
        tinyi && tinyi.topic ? ('廷议 ' + tinyi.topic) : (a.linkedIssue ? ('议题 ' + a.linkedIssue) : ''),
        a.source || ''
      ].filter(Boolean).join(' · '));
      return '<span title="' + attr([head, body].filter(Boolean).join(' · ')) + '"><em>' + esc(head) + '</em><small>' + esc(body || '自主压力') + '</small></span>';
    }).join('') + '</div>';
  }

  function renderRightSocialActions(actorType, row){
    var name = rightSocialName(row);
    var safeName = attr(name);
    var firstLabel = actorType === 'party' ? '召党魁' : '召代表';
    var edictLabel = actorType === 'party' ? '拟平衡诏' : '拟安抚诏';
    return '<div class="tmrp-action-row tmrp-social-actions">' +
      '<button type="button" class="tmrp-btn" data-right-action="social-action" data-actor-type="' + attr(actorType) + '" data-name="' + safeName + '" data-social-command="audience">' + firstLabel + '</button>' +
      '<button type="button" class="tmrp-btn primary" data-right-action="social-action" data-actor-type="' + attr(actorType) + '" data-name="' + safeName + '" data-social-command="chaoyi">付廷议</button>' +
      '<button type="button" class="tmrp-btn" data-right-action="social-action" data-actor-type="' + attr(actorType) + '" data-name="' + safeName + '" data-social-command="edict">' + edictLabel + '</button>' +
      '</div>';
  }

  function rightPcArray(v){
    if (v === undefined || v === null || v === '') return [];
    return Array.isArray(v) ? v.slice() : [v];
  }

  function rightPcText(v, n){
    var text = '';
    if (v && typeof v === 'object') {
      text = v.text || v.reason || v.summary || v.topic || v.title || v.goalText || v.agenda || v.name || v.id || '';
    } else {
      text = v == null ? '' : String(v);
    }
    if (typeof compactText === 'function') return compactText(text, n || 140);
    text = String(text || '').replace(/\s+/g, ' ').trim();
    return text.length > (n || 140) ? text.slice(0, n || 140) : text;
  }

  function rightPcJson(v){
    try { return JSON.stringify(v || {}); } catch (_) { return ''; }
  }

  function rightPcRow(title, body, tags){
    tags = rightPcArray(tags).filter(Boolean).slice(0, 5);
    return '<div class="tmrp-pcdebug-row"><b>' + esc(title || 'entry') + '</b>' +
      '<span>' + esc(body || '') + '</span>' +
      (tags.length ? '<div class="tmrp-pcdebug-tags">' + tags.map(function(t){ return '<i class="tmrp-pcdebug-tag">' + esc(t) + '</i>'; }).join('') + '</div>' : '') +
      '</div>';
  }

  function rightPcSection(title, small, rows, emptyText){
    rows = rightPcArray(rows).filter(Boolean);
    return '<section class="tmrp-card tmrp-pcdebug-section"><div class="tmrp-card-title"><span>' + esc(title) + '</span><small>' + esc(small || '') + '</small></div>' +
      (rows.length ? '<div class="tmrp-pcdebug-list">' + rows.join('') + '</div>' : '<div class="tmrp-empty">' + esc(emptyText || '暂无记录') + '</div>') +
      '</section>';
  }

  // 状态枚举→中文(仅显示用·枚举值本身不变)
  var _PC_STAT_CN = { active:'在办', stalled:'停滞', resolved:'化解', expired:'过期', pending:'待决', escalated:'升级', applied:'已应', settled:'了结', done:'完成', failed:'失败', delayed:'延期', executing:'执行中', completed:'完成', queued:'待办', converted:'已转', drift:'漂移',
    critical:'危殆', high:'紧要', medium:'寻常', low:'轻微', watch:'观望', hot:'灼热',
    signal:'信号', commitment:'承诺', consumer:'消费端', secret:'密信', alliance:'结盟', conspiracy:'密谋', routine:'例行', report:'禀报', warning:'警讯',
    refer:'付议', annotate:'批示', reject:'驳回', hold:'留中', approve:'准奏', responded:'已应', abolished:'已废',
    issued:'颁行', sealed:'已用印', promulgated:'颁行', vetoed:'封驳', tabled:'搁置', annotated:'已批' };
  function _pcStatCn(v){ if(v==null||v==='')return ''; var s=String(v); return _PC_STAT_CN[s] || _PC_STAT_CN[s.toLowerCase()] || s; }

  function rightPcSignalRows(gm){
    return rightPcArray(gm && gm._socialPoliticalSignals && gm._socialPoliticalSignals.items).slice(-8).reverse().map(function(s){
      return rightPcRow(
        'T' + (s.turn || '') + ' ' + (s.sourceSystem || '信号') + '/' + (s.kind || ''),
        rightPcText(s.reason || '', 140),
        [
          s.linkedIssue || '',
          '强度 ' + (s.intensity != null ? s.intensity : ''),
          '置信 ' + (s.confidence != null ? s.confidence : ''),
          s.resolved ? '化解' : (s.escalated ? '升级' : (s.applied ? '已应' : '待决'))
        ]
      );
    });
  }

  function rightPcMaintenanceRows(gm){
    var signalRows = rightPcArray(gm && gm._socialPoliticalSignalMaintenance).slice(-4).reverse().map(function(x){
      return rightPcRow('T' + (x.turn || '') + ' signal maintenance', rightPcJson(x.summary), [x.source || '']);
    });
    var actorRows = rightPcArray(gm && gm._partyClassActorMaintenance).slice(-4).reverse().map(function(x){
      return rightPcRow('T' + (x.turn || '') + ' actor maintenance', rightPcJson(x.summary), [x.source || '']);
    });
    var escalationRows = rightPcArray(gm && gm._socialPoliticalSignalEscalations).slice(-5).reverse().map(function(x){
      return rightPcRow('T' + (x.turn || '') + ' 升级', rightPcText(x.reason || x.kind || '', 140), [x.linkedIssue || '', rightPcArray(x.affectedClasses).join('/'), x.kind || '']);
    });
    return signalRows.concat(actorRows).concat(escalationRows);
  }

  function rightPcActorMemoryRows(gm){
    return rightPcArray(gm && gm._partyClassActorMemory && gm._partyClassActorMemory.items).slice(-10).reverse().map(function(m){
      return rightPcRow(
        'T' + (m.turn || '') + ' ' + (m.actorType || '') + ' ' + (m.actorId || ''),
        rightPcText((m.agenda || '') + ' / ' + (m.grievance || '') + ' / ' + (m.belief || ''), 180),
        [m.source || '', m.linkedIssue || '', _pcStatCn(m.status) || (m.resolved ? '化解' : (m.expired ? '过期' : '在办')), '置信 ' + (m.confidence != null ? m.confidence : '')]
      );
    });
  }

  function rightPcActionRows(gm){
    var partyRows = rightPcArray(gm && gm.party_actions).slice(-6).reverse().map(function(a){
      return rightPcRow('党派动作 ' + (a.actorId || ''), rightPcText((a.actionType || '') + ' / ' + (a.agenda || ''), 160), [a.linkedIssue || '', _pcStatCn(a.status), 'T' + (a.turn || '')]);
    });
    var classRows = rightPcArray(gm && gm.class_actions).slice(-6).reverse().map(function(a){
      return rightPcRow('阶层动作 ' + (a.actorId || ''), rightPcText((a.actionType || '') + ' / ' + (a.agenda || ''), 160), [a.linkedIssue || '', _pcStatCn(a.status), 'T' + (a.turn || '')]);
    });
    return partyRows.concat(classRows);
  }

  function rightPcClassCharacterRows(gm){
    gm = gm || window.GM || {};
    var store = gm.classCharacterRelations || {};
    var history = rightPcArray(store.history).slice(-6).reverse().map(function(h){
      return rightPcRow(
        '阶层人物·历 ' + (h.className || '') + '/' + (h.characterName || ''),
        rightPcText(rightPcArray(h.evidence).join(' / ') || h.reason || h.source || h.type || '', 160),
        [h.role || '', h.source || '', 'T' + (h.turn || '')]
      );
    });
    var edgeRows = rightClassCharacterAllEdges().slice(0, 8).map(function(e){
      return rightPcRow(
        '阶层人物·联 ' + (e.className || '') + '/' + (e.characterName || ''),
        rightPcText(rightPcArray(e.evidence).join(' / ') || e.source || '', 160),
        [
          e.role || '',
          '信任 ' + rightClassCharacterPct(e.trust),
          '积怨 ' + rightClassCharacterPct(e.grievance),
          'T' + (e.lastTurn || '')
        ]
      );
    });
    return edgeRows.concat(history);
  }

  function rightPcTinyiRows(gm){
    var pendingRows = rightPcArray(gm && gm._pendingTinyiTopics).slice(-7).reverse().map(function(t){
      return rightPcRow('廷议队列 ' + (t.topic || t.title || ''), rightPcText((t.goalText || t.demandText || t.reason || ''), 150), [t.sourceType || t.source || '', t.party || t.sourceParty || '', t.sourceClass || t.className || '', t.issueId || t.linkedIssue || '']);
    });
    var linkRows = rightPcArray(gm && gm._partyClassCourtIssueLinks).slice(-6).reverse().map(function(l){
      return rightPcRow('议题关联 ' + (l.topic || l.issueId || ''), rightPcText(l.goalText || l.reason || '', 150), [l.party || '', l.className || '', 'T' + (l.turn || '')]);
    });
    var courtRows = rightPcArray(gm && gm._courtRecords).concat(rightPcArray(gm && gm.tinyiSeals)).slice(-8).reverse().map(function(r){
      var status = _pcStatCn(r.sealStatus || r.status || r.result || '') + (r.grade ? ' ' + r.grade : '');
      return rightPcRow('朝议记录 ' + (r.topic || r.title || ''), rightPcText(r.demandText || r.body || r.reason || '', 150), [status, r.sourceParty || r.party || '', r.sourceClass || r.className || '', r.issueId || r.chaoyiTrackId || '']);
    });
    return pendingRows.concat(linkRows).concat(courtRows);
  }

  function rightPcInstitutionLifecycleRows(gm){
    gm = gm || window.GM || {};
    var parser = window.EdictParser || null;
    var rows = [];
    rightPcArray(gm.dynamicInstitutions).slice(-8).reverse().forEach(function(inst){
      if (!inst) return;
      var view = null;
      try {
        if (parser && typeof parser.getInstitutionLifecycleView === 'function') view = parser.getInstitutionLifecycleView(inst.id);
      } catch (_) {}
      view = view || {
        id: inst.id || '',
        name: inst.name || '',
        stage: inst.stage || '',
        currentStage: inst.stage || '',
        visibleSteps: [],
        timeline: rightPcArray(inst.history),
        feedback: rightPcArray(inst.lifecycle && inst.lifecycle.feedback),
        historicalReferences: rightPcArray(inst.lifecycle && inst.lifecycle.historicalReferences)
      };
      var steps = rightPcArray(view.visibleSteps).map(function(s){
        return (s.status === 'done' ? '完成 ' : '待办 ') + (s.key || s.label || '');
      }).join(' / ');
      var feedback = rightPcArray(view.feedback).slice(-2).map(function(f){
        return f.summary || f.text || f.reason || f.note || '';
      }).filter(Boolean).join(' / ');
      var refs = rightPcArray(view.historicalReferences).slice(-2).map(function(r){
        return r.note || r.text || r.citedBy || '';
      }).filter(Boolean).join(' / ');
      var body = [
        '当前 ' + (view.currentStage || view.stage || inst.stage || ''),
        steps,
        feedback ? ('反馈 ' + feedback) : '',
        refs ? ('历 ' + refs) : ''
      ].filter(Boolean).join(' | ');
      rows.push(rightPcRow(
        'Institution Lifecycle ' + (view.name || inst.name || inst.id || ''),
        rightPcText(body, 260),
        [view.currentStage || inst.stage || '', inst.rank ? ('品级 ' + inst.rank) : '', inst.createdTurn != null ? ('T' + inst.createdTurn) : '']
      ));
    });
    rightPcArray(gm._institutionLifecycleEvents).slice(-5).reverse().forEach(function(e){
      rows.push(rightPcRow(
        '制度大事 ' + (e.name || e.id || ''),
        rightPcText([(e.phaseKey || e.action || ''), e.text || ''].filter(Boolean).join(' / '), 200),
        ['T' + (e.turn || ''), e.phaseKey || '', e.action || '']
      ));
    });
    return rows;
  }

  function rightPcClassMinxinBridge(){
    var tm = window.TM || {};
    return tm.ClassMinxinBridge || null;
  }

  function rightPcClassMinxinDiagnostics(gm){
    gm = gm || window.GM || {};
    var api = rightPcClassMinxinBridge();
    if (api && typeof api.diagnostics === 'function') {
      try { return api.diagnostics(gm, { limit: 8 }); } catch (_) {}
    }
    var mx = gm.minxin || {};
    var byClass = [];
    Object.keys(mx.byClass || {}).forEach(function(key){
      var row = mx.byClass[key] || {};
      byClass.push({
        classKey: key,
        className: row.className || key,
        true: row.true != null ? row.true : row.index,
        perceived: row.perceived,
        unrestPhase: row.unrestPhase,
        demand: row.demand,
        lastPressure: row.lastPressure
      });
    });
    return {
      audit: gm._classMinxinBridgeAudit || null,
      warnings: [],
      maintenance: gm._classMinxinBridgeMaintenance || null,
      ledger: rightPcArray(gm._classMinxinBridgeLedger).slice(-8).reverse(),
      byClass: byClass.slice(0, 8),
      courtTopics: rightPcArray(gm._pendingTinyiTopics).filter(function(t){
        return t && (t.from === 'class-minxin-bridge' || t.sourceType === 'class_pressure' || (t.origin && t.origin.sourceType === 'class_minxin_bridge'));
      }).slice(0, 8),
      uprisingCandidates: rightPcArray(mx.uprisingCandidates).slice(-8).reverse()
    };
  }

  function rightPcRegionText(row){
    var names = [];
    rightPcArray(row && row.appliedRegions).forEach(function(r){
      var name = r && (r.region || r.name || r.id || r);
      if (name && names.indexOf(String(name)) < 0) names.push(String(name));
    });
    rightPcArray(row && row.regionWeights).forEach(function(r){
      var name = r && (r.region || r.name || r.id || r);
      if (name && names.indexOf(String(name)) < 0) names.push(String(name));
    });
    return names.join('/');
  }

  function rightPcClassMinxinRows(gm){
    var diag = rightPcClassMinxinDiagnostics(gm);
    var rows = [];
    var audit = diag.audit || {};
    var counts = audit.counts || {};
    if (diag.audit) {
      rows.push(rightPcRow(
        '稽核 ' + (audit.ok ? 'OK' : 'FAIL'),
        rightPcText((diag.warnings && diag.warnings.length ? diag.warnings.join(' / ') : rightPcJson(counts)), 220),
        ['重复 ' + (counts.duplicates || 0), '漂移 ' + (counts.drifts || 0), '盲区 ' + (counts.blindRegionWrites || 0), audit.source || '']
      ));
    }
    if (diag.maintenance) {
      rows.push(rightPcRow(
        'T' + (diag.maintenance.turn || '') + ' maintenance',
        rightPcJson({ courtIssues: diag.maintenance.courtIssues || 0, uprisingCandidates: diag.maintenance.uprisingCandidates || 0, auditOk: diag.maintenance.auditOk !== false }),
        [diag.maintenance.source || '', diag.maintenance.auditOk === false ? 'audit FAIL' : 'audit OK']
      ));
    }
    rightPcArray(diag.byClass).slice(0, 6).forEach(function(c){
      var lp = c.lastPressure || {};
      rows.push(rightPcRow(
        'byClass ' + (c.className || c.classKey || ''),
        rightPcText('实情 ' + (c.true != null ? c.true : c.index) + ' 观感 ' + (c.perceived != null ? c.perceived : '') + ' / ' + (c.unrestPhase || '') + ' / ' + (lp.reason || c.demand || ''), 180),
        [c.classKey || '', lp.linkedIssue || '', lp.delta != null ? ('增减 ' + lp.delta) : '']
      ));
    });
    rightPcArray(diag.ledger).slice(0, 6).forEach(function(row){
      var regions = rightPcRegionText(row);
      rows.push(rightPcRow(
        '账目 ' + (row.className || row.classKey || ''),
        rightPcText([row.reason || row.sourceSystem || '', regions].filter(Boolean).join(' / '), 180),
        [row.linkedIssue || '', row.sourceSystem || '', row.delta != null ? ('增减 ' + row.delta) : '', regions]
      ));
    });
    rightPcArray(diag.courtTopics).slice(0, 5).forEach(function(t){
      rows.push(rightPcRow(
        'Court Topic ' + (t.topic || t.title || t.id || ''),
        rightPcText(t.demandText || t.reason || '', 160),
        [t.from || t.sourceType || '', t.sourceClass || t.className || '', t.linkedIssue || t.issueId || '']
      ));
    });
    rightPcArray(diag.uprisingCandidates).slice(0, 5).forEach(function(c){
      rows.push(rightPcRow(
        '民变候选 ' + (c.id || ''),
        rightPcText([c.cause || '', c.region || ''].filter(Boolean).join(' / '), 160),
        [c.className || c.classKey || '', c.linkedIssue || '', c.level != null ? ('级别 ' + c.level) : '', c.momentum != null ? ('势头 ' + c.momentum) : '']
      ));
    });
    return rows;
  }

  function rightPcMinxinLedgerApi(){
    var tm = window.TM || {};
    return tm.MinxinLedger || null;
  }

  function rightPcMinxinLedgerSnapshot(gm){
    gm = gm || window.GM || {};
    var api = rightPcMinxinLedgerApi();
    if (api && typeof api.snapshot === 'function') {
      try { return api.snapshot(gm, { limit: 8 }); } catch (_) {}
    }
    var ledger = gm._minxinLedger || {};
    var mx = gm.minxin || {};
    return {
      trueIndex: mx.trueIndex,
      perceivedIndex: mx.perceivedIndex,
      visibilityTier: mx.visibilityTier,
      recent: rightPcArray(ledger.items).slice(-8).reverse(),
      uprisingChain: rightPcArray(mx.uprisingChain),
      byRegion: mx.byRegion || {},
      byClass: mx.byClass || {}
    };
  }

  function rightPcMinxinLedgerRows(gm){
    var snap = rightPcMinxinLedgerSnapshot(gm);
    var rows = [];
    if (!snap) return rows;
    rows.push(rightPcRow(
      '实情 / 朝堂观感',
      rightPcText('实情 ' + (snap.trueIndex != null ? snap.trueIndex : '') + ' 观感 ' + (snap.perceivedIndex != null ? snap.perceivedIndex : '') + ' 显隐 ' + (snap.visibilityTier || ''), 180),
      ['Minxin Ledger']
    ));
    rightPcArray(snap.recent).slice(0, 6).forEach(function(row){
      var classes = rightPcArray(row.targetClasses).map(function(c){ return c.name || c.classKey || c; }).filter(Boolean).join('/');
      var regions = rightPcArray(row.targetRegions).map(function(r){ return r.region || r.name || r.id || r; }).filter(Boolean).join('/');
      rows.push(rightPcRow(
        'T' + (row.turn || '') + ' ' + (row.kind || row.sourceSystem || '信号'),
        rightPcText([row.reason || '', regions, classes].filter(Boolean).join(' / '), 190),
        [row.deltaTrue != null ? ('增减 ' + row.deltaTrue) : '', row.linkedIssue || '', row.policyActionId || row.courtIssueId || '']
      ));
    });
    Object.keys(snap.byRegion || {}).slice(0, 5).forEach(function(key){
      var r = snap.byRegion[key] || {};
      rows.push(rightPcRow(
        '地方 ' + (r.regionName || key),
        rightPcText('实情 ' + (r.true != null ? r.true : r.index) + ' 观感 ' + (r.perceived != null ? r.perceived : '') + ' 段位 ' + (r.phase || ''), 170),
        [r.visibilityTier || '', key]
      ));
    });
    Object.keys(snap.byClass || {}).slice(0, 5).forEach(function(key){
      var c = snap.byClass[key] || {};
      rows.push(rightPcRow(
        '阶层 ' + (c.className || key),
        rightPcText('实情 ' + (c.true != null ? c.true : c.index) + ' 观感 ' + (c.perceived != null ? c.perceived : '') + ' 缘由 ' + (c.lastReason || ''), 170),
        [c.linkedIssue || '', key]
      ));
    });
    rightPcArray(snap.uprisingChain).slice(0, 5).forEach(function(c){
      rows.push(rightPcRow(
        '民变链 ' + (c.region || c.regionName || c.id || ''),
        rightPcText(c.cause || c.reason || '', 170),
        [c.className || c.classKey || '', c.level != null ? ('级别 ' + c.level) : '', c.momentum != null ? ('势头 ' + c.momentum) : '']
      ));
    });
    return rows;
  }

  function rightPcMinxinLedgerCopyText(gm){
    gm = gm || window.GM || {};
    var api = rightPcMinxinLedgerApi();
    if (api && typeof api.diagnosticsText === 'function') {
      try { return api.diagnosticsText(gm, { limit: 12 }); } catch (_) {}
    }
    return '=== Minxin Ledger Diagnostics ===\n' + rightPcJson(rightPcMinxinLedgerSnapshot(gm));
  }

  function rightPcMinxinPressureRows(gm){
    gm = gm || window.GM || {};
    var api = window.TM && TM.MinxinPressureActions;
    var snap = null;
    if (api && typeof api.snapshot === 'function') {
      try { snap = api.snapshot(gm, { limit: 8 }); } catch (_) {}
    }
    if (!snap) {
      var store = gm._minxinPressureActions || {};
      snap = {
        active: rightPcArray(store.items).filter(function(x){ return x && x.status === 'active'; }).slice(-8).reverse(),
        recent: rightPcArray(store.items).slice(-8).reverse(),
        responses: rightPcArray(store.responses).slice(-8).reverse(),
        maintenance: gm._minxinPressureActionsMaintenance || null
      };
    }
    var rows = [];
    if (snap.maintenance) {
      rows.push(rightPcRow(
        '维护·第' + (snap.maintenance.turn || ''),
        rightPcText('扫描 ' + (snap.maintenance.scanned || 0) + ' 生成 ' + (snap.maintenance.spawned || 0) + ' 在办 ' + (snap.maintenance.active || 0), 160),
        [snap.maintenance.source || '']
      ));
    }
    rightPcArray(snap.active || snap.recent).slice(0, 6).forEach(function(item){
      rows.push(rightPcRow(
        '积压 ' + (item.regionName || '') + ' / ' + (item.className || ''),
        rightPcText([item.reason || '', item.demandText || ''].filter(Boolean).join(' / '), 190),
        [_pcStatCn(item.severity), item.true != null ? ('实情 ' + item.true) : '', _pcStatCn(item.status), item.id || '']
      ));
    });
    rightPcArray(snap.responses).slice(0, 5).forEach(function(r){
      rows.push(rightPcRow(
        '回应 ' + (r.channel || '') + ' / ' + (_pcStatCn(r.decision)),
        rightPcText(r.text || '', 180),
        [r.linkedIssue || '', r.deltaTrue != null ? ('增减 ' + r.deltaTrue) : '', 'T' + (r.turn || '')]
      ));
    });
    return rows;
  }

  function rightPcMinxinPressureCopyText(gm){
    gm = gm || window.GM || {};
    var api = window.TM && TM.MinxinPressureActions;
    if (api && typeof api.diagnosticsText === 'function') {
      try { return api.diagnosticsText(gm, { limit: 12 }); } catch (_) {}
    }
    return '=== Minxin Pressure Actions Diagnostics ===\n' + rightPcJson(gm._minxinPressureActions || {});
  }

  function rightPcMinxinCommitmentRows(gm){
    gm = gm || window.GM || {};
    var api = window.TM && TM.MinxinCommitmentTracker;
    var snap = null;
    if (api && typeof api.snapshot === 'function') {
      try { snap = api.snapshot(gm, { limit: 8 }); } catch (_) {}
    }
    if (!snap) {
      var store = gm._minxinCommitments || {};
      snap = {
        maintenance: gm._minxinCommitmentsMaintenance || null,
        active: rightPcArray(store.items).filter(function(x){ return x && (x.status === 'active' || x.status === 'stalled'); }).slice(-8).reverse(),
        recent: rightPcArray(store.items).slice(-8).reverse(),
        settlements: rightPcArray(store.settlements).slice(-8).reverse()
      };
    }
    var rows = [];
    if (snap.maintenance) {
      rows.push(rightPcRow(
        '维护·第' + (snap.maintenance.turn || ''),
        rightPcText('在办 ' + (snap.maintenance.active || 0) + ' 停滞 ' + (snap.maintenance.stalled || 0) + ' 化解 ' + (snap.maintenance.resolved || 0) + ' 了结 ' + (snap.maintenance.settled || 0), 180),
        [snap.maintenance.source || '']
      ));
    }
    rightPcArray(snap.active || snap.recent).slice(0, 6).forEach(function(item){
      rows.push(rightPcRow(
        '承诺 ' + (item.regionName || '') + ' / ' + (item.className || ''),
        rightPcText([item.text || '', '措置 ' + rightPcArray(item.measures).join('/')].filter(Boolean).join(' / '), 190),
        [_pcStatCn(item.status), item.progress != null ? ('进度 ' + item.progress) : '', item.dueTurn ? ('限期 ' + item.dueTurn) : '', item.id || '']
      ));
    });
    rightPcArray(snap.settlements).slice(0, 5).forEach(function(s){
      rows.push(rightPcRow(
        '结案 ' + (_pcStatCn(s.status)),
        rightPcText(s.reason || '', 190),
        [s.commitmentId || '', s.deltaTrue != null ? ('增减 ' + s.deltaTrue) : '', s.progress != null ? ('进度 ' + s.progress) : '']
      ));
    });
    return rows;
  }

  function rightPcMinxinCommitmentCopyText(gm){
    gm = gm || window.GM || {};
    var api = window.TM && TM.MinxinCommitmentTracker;
    if (api && typeof api.diagnosticsText === 'function') {
      try { return api.diagnosticsText(gm, { limit: 12 }); } catch (_) {}
    }
    return '=== Minxin Commitments Diagnostics ===\n' + rightPcJson(gm._minxinCommitments || {});
  }

  function rightPcMinxinResponsibilityRows(gm){
    gm = gm || window.GM || {};
    var api = window.TM && TM.MinxinResponsibilityChain;
    var snap = null;
    if (api && typeof api.snapshot === 'function') {
      try { snap = api.snapshot(gm, { limit: 8 }); } catch (_) {}
    }
    if (!snap) {
      var store = gm._minxinResponsibilityChain || {};
      snap = {
        maintenance: gm._minxinResponsibilityMaintenance || null,
        assignments: rightPcArray(store.assignments).slice(-8).reverse(),
        officialReports: rightPcArray(store.officialReports).slice(-8).reverse(),
        rumors: rightPcArray(store.rumors).slice(-8).reverse(),
        interventions: rightPcArray(store.interventions).slice(-8).reverse(),
        accountability: rightPcArray(store.accountability).slice(-8).reverse()
      };
    }
    var rows = [];
    if (snap.maintenance) {
      rows.push(rightPcRow(
        '维护·第' + (snap.maintenance.turn || ''),
        rightPcText('指派 ' + (snap.maintenance.assigned || 0) + ' 官报 ' + (snap.maintenance.reports || 0) + ' 风闻 ' + (snap.maintenance.rumors || 0) + ' 问责 ' + (snap.maintenance.accountability || 0), 180),
        [snap.maintenance.source || '']
      ));
    }
    rightPcArray(snap.assignments).slice(0, 5).forEach(function(a){
      rows.push(rightPcRow(
        '指派 ' + (a.regionName || '') + ' / ' + (a.className || ''),
        rightPcText('承办司 ' + (a.agency || '') + ' 承办人 ' + (a.executor && a.executor.name || ''), 190),
        [a.commitmentId || '', a.falseReportRisk != null ? ('风险 ' + a.falseReportRisk) : '']
      ));
    });
    rightPcArray(snap.officialReports).slice(0, 5).forEach(function(r){
      rows.push(rightPcRow(
        '官报·' + (r.executorName || ''),
        rightPcText((r.regionName || '') + ' / ' + (r.className || '') + ' 所报 ' + (r.reportedProgress || 0) + ' 实际 ' + (r.actualProgress || 0), 190),
        [r.commitmentId || '', r.falseReportRisk != null ? ('风险 ' + r.falseReportRisk) : '']
      ));
    });
    rightPcArray(snap.rumors).slice(0, 5).forEach(function(r){
      rows.push(rightPcRow(
        '风闻 ' + (_pcStatCn(r.severity)),
        rightPcText(r.text || '', 190),
        [r.commitmentId || '', r.falseReportRisk != null ? ('风险 ' + r.falseReportRisk) : '', r.trueProgress != null ? ('实情 ' + r.trueProgress) : '']
      ));
    });
    rightPcArray(snap.accountability).slice(0, 5).forEach(function(a){
      rows.push(rightPcRow(
        '问责',
        rightPcText(a.reason || '', 190),
        [a.commitmentId || '', a.memorialId || '', a.tinyiId || '']
      ));
    });
    return rows;
  }

  function rightPcMinxinResponsibilityCopyText(gm){
    gm = gm || window.GM || {};
    var api = window.TM && TM.MinxinResponsibilityChain;
    if (api && typeof api.diagnosticsText === 'function') {
      try { return api.diagnosticsText(gm, { limit: 12 }); } catch (_) {}
    }
    return '=== Minxin Responsibility Chain Diagnostics ===\n' + rightPcJson(gm._minxinResponsibilityChain || {});
  }

  function rightPcMinxinHardLinkRows(gm){
    gm = gm || window.GM || {};
    var api = window.TM && TM.MinxinHardLinks;
    var snap = null;
    if (api && typeof api.snapshot === 'function') {
      try { snap = api.snapshot(gm, { limit: 8 }); } catch (_) {}
    }
    if (!snap) {
      var store = gm._minxinHardLinks || {};
      snap = {
        summary: store.summary || {
          fiscal: gm.fiscal && gm.fiscal.minxinHardLinks || {},
          military: gm.military && gm.military.minxinHardLinks || {},
          hukou: gm.hukou && gm.hukou.minxinHardLinks || {},
          localExecution: gm.localExecution && gm.localExecution.minxinHardLinks || {}
        },
        regionImpacts: rightPcArray(store.regionImpacts).slice(-8).reverse(),
        ledger: rightPcArray(store.ledger).slice(-8).reverse()
      };
    }
    var rows = [];
    var summary = snap.summary || {};
    var fiscal = summary.fiscal || {};
    var military = summary.military || {};
    var hukou = summary.hukou || {};
    var local = summary.localExecution || {};
    rows.push(rightPcRow(
      'fiscal / conscription / hukou',
      rightPcText('实际 ' + (fiscal.actualRevenue || 0) + ' 申报 ' + (fiscal.claimedRevenue || 0) + ' 缺口 ' + (fiscal.revenueGap || 0) + ' 募兵 ' + (military.availableRecruits || 0), 190),
      ['隐匿 ' + (hukou.hiddenHouseholds || 0), '流民 ' + (hukou.refugees || 0), '执行 ' + (local.avgExecutionRate || 0)]
    ));
    rightPcArray(snap.regionImpacts).slice(0, 6).forEach(function(row){
      rows.push(rightPcRow(
        '硬链 ' + (row.regionName || ''),
        rightPcText('财赋 ' + ((row.fiscal && row.fiscal.actualRevenue) || 0) + '/' + ((row.fiscal && row.fiscal.claimedRevenue) || 0) + ' 征调 ' + ((row.conscription && row.conscription.recruitmentEfficiency) || 0) + ' 户籍 ' + ((row.hukou && row.hukou.hiddenHouseholds) || 0), 190),
        ['民心 ' + (row.trueMinxin || 0), '执行 ' + (row.localExecutionRate || 0), row.reason || '']
      ));
    });
    rightPcArray(snap.ledger).slice(0, 4).forEach(function(e){
      rows.push(rightPcRow(
        '强制 ' + (e.regionName || ''),
        rightPcText(e.reason || e.kind || '', 190),
        ['增减 ' + (e.deltaTrue || 0), '募兵 ' + (e.shortTermRecruits || 0), 'T' + (e.turn || '')]
      ));
    });
    return rows;
  }

  function rightPcMinxinHardLinkCopyText(gm){
    gm = gm || window.GM || {};
    var api = window.TM && TM.MinxinHardLinks;
    if (api && typeof api.diagnosticsText === 'function') {
      try { return api.diagnosticsText(gm, { limit: 12 }); } catch (_) {}
    }
    return '=== Minxin Hard Links Diagnostics ===\n' + rightPcJson(gm._minxinHardLinks || {});
  }

  function rightPcMinxinHardLinkConsumerRows(gm){
    gm = gm || window.GM || {};
    var api = window.TM && TM.MinxinHardLinkConsumers;
    var snap = null;
    if (api && typeof api.snapshot === 'function') {
      try { snap = api.snapshot(gm, { limit: 8 }); } catch (_) {}
    }
    if (!snap) {
      var store = gm._minxinHardLinkConsumers || {};
      snap = {
        summary: store.summary || {},
        events: rightPcArray(store.events).slice(-8).reverse()
      };
    }
    var rows = [];
    var summary = snap.summary || {};
    var fiscal = summary.fiscal || {};
    var military = summary.military || {};
    var hukou = summary.hukou || {};
    var execution = summary.execution || {};
    rows.push(rightPcRow(
      '消费上限',
      rightPcText('实收 ' + (fiscal.actualIncome || 0) + '/' + (fiscal.plannedIncome || 0) + ' 募兵 ' + (military.approvedRecruits || 0) + '/' + (military.requestedRecruits || 0), 190),
      ['税基 ' + (hukou.effectiveTaxHouseholds || 0), '执行 ' + (execution.effectiveExecutionRate || 0)]
    ));
    rightPcArray(snap.events).slice(0, 6).forEach(function(e){
      var p = e.payload || {};
      rows.push(rightPcRow(
        e.type || '消费端',
        rightPcText(rightPcJson(p), 190),
        ['T' + (e.turn || '')]
      ));
    });
    return rows;
  }

  function rightPcMinxinHardLinkConsumerCopyText(gm){
    gm = gm || window.GM || {};
    var api = window.TM && TM.MinxinHardLinkConsumers;
    if (api && typeof api.diagnosticsText === 'function') {
      try { return api.diagnosticsText(gm, { limit: 12 }); } catch (_) {}
    }
    return '=== Minxin Hard Link Consumers Diagnostics ===\n' + rightPcJson(gm._minxinHardLinkConsumers || {});
  }

  function rightPcHujiRuntimeBridgeRows(gm){
    gm = gm || window.GM || {};
    var api = window.TM && TM.HujiRuntimeBridge;
    var snap = null;
    if (api && typeof api.snapshot === 'function') {
      try { snap = api.snapshot(gm, { limit: 8 }); } catch (_) {}
    }
    if (!snap) {
      var store = gm._hujiRuntimeBridge || {};
      snap = store.snapshot || {};
      snap.operations = rightPcArray(store.operations).slice(-8).reverse();
    }
    var rows = [];
    var hukou = snap.hukou || {};
    var corvee = (snap.corvee && snap.corvee.summary) || {};
    var military = snap.military || {};
    var hujiHardEffects = snap.hardEffects || gm._hujiHardEffects || {};
    var hardFiscal = hujiHardEffects.fiscal || {};
    var hardMilitary = hujiHardEffects.military || {};
    var hardCorvee = hujiHardEffects.corvee || {};
    rows.push(rightPcRow(
      'hukouLedger',
      rightPcText('在籍 ' + (hukou.registeredHouseholds || 0) + ' households / ' + (hukou.registeredMouths || 0) + ' mouths / ' + (hukou.registeredDing || 0) + ' ding', 190),
      ['隐匿 ' + (hukou.hiddenCount || 0), '逃户 ' + (hukou.fugitives || 0), '税基 ' + (hukou.effectiveTaxHouseholds || 0)]
    ));
    rows.push(rightPcRow(
      'corveeLedger',
      rightPcText('诉求 ' + (corvee.totalDemandDays || 0) + ' 兑现 ' + (corvee.fulfilledDays || 0) + ' 缺口 ' + (corvee.gapDays || 0), 190),
      ['负担 ' + (corvee.burden || 0), '折银 ' + (corvee.commutationRate || 0), '地方 ' + (corvee.regionCount || 0)]
    ));
    rows.push(rightPcRow(
      'militaryServicePool',
      rightPcText('在办 ' + (military.activeSoldiers || 0) + ' 可用 ' + (military.availableRecruits || 0) + ' 请拨 ' + (military.requestedRecruits || 0), 190),
      ['合格 ' + (military.eligibleDing || 0), '亏缺 ' + (military.shortfall || 0), '实效 ' + (military.avgRecruitmentEfficiency || 0)]
    ));
    if (hujiHardEffects && (hujiHardEffects.fiscal || hujiHardEffects.military || hujiHardEffects.corvee)) {
      rows.push(rightPcRow(
        'hujiHardEffects',
        rightPcText('财赋×' + (hardFiscal.collectionMultiplier || 0) + ' 损耗 ' + (hardFiscal.revenueLoss || 0) + ' · draft shortfall ' + (hardMilitary.shortfall || 0) + ' · minxin ' + (hardCorvee.minxinDelta || 0), 190),
        ['税基 ' + (hardFiscal.taxBaseRatio || 0), 'morale -' + (hardMilitary.moralePenalty || 0), '廷议 ' + ((hujiHardEffects.tinyi && hujiHardEffects.tinyi.totalPending) || 0)]
      ));
    }
    rightPcArray(hujiHardEffects.ledger).slice(-4).reverse().forEach(function(e){
      var s = e.summary || {};
      rows.push(rightPcRow(
        'hardEffectLedger',
        rightPcText((e.stage || '') + '/' + (e.kind || '') + ' 损耗 ' + (s.revenueLoss != null ? s.revenueLoss : '') + ' 亏缺 ' + (s.shortfall != null ? s.shortfall : '') + ' 民心 ' + (s.minxinDelta != null ? s.minxinDelta : ''), 190),
        ['T' + (e.turn || ''), '调整 ' + (s.adjustment != null ? s.adjustment : ''), e.source || '']
      ));
    });
    rightPcArray(snap.operations).slice(0, 5).forEach(function(op){
      rows.push(rightPcRow(
        'playerHujiOperation',
        rightPcText(op.text || op.reason || '', 190),
        ['T' + (op.turn || ''), rightPcArray(op.tags).join('/'), op.linkedIssue || '']
      ));
    });
    return rows;
  }

  function rightPcHujiRuntimeBridgeCopyText(gm){
    gm = gm || window.GM || {};
    var api = window.TM && TM.HujiRuntimeBridge;
    if (api && typeof api.diagnosticsText === 'function') {
      try { return api.diagnosticsText(gm, { limit: 12 }); } catch (_) {}
    }
    return '=== Huji Runtime Bridge Diagnostics ===\n' + rightPcJson(gm._hujiRuntimeBridge || {});
  }

  function rightPcHujiGovernanceRows(gm){
    gm = gm || window.GM || {};
    var api = window.TM && TM.HujiGovernanceLoop;
    var snap = null;
    if (api && typeof api.snapshot === 'function') {
      try { snap = api.snapshot(gm, { limit: 8 }); } catch (_) {}
    }
    if (!snap) {
      var store = gm._hujiGovernanceLoop || {};
      snap = {
        commitments: rightPcArray(gm._hujiCommitments).slice(-8).reverse(),
        events: rightPcArray(store.events).slice(-8).reverse(),
        stats: store.stats || {}
      };
    }
    var rows = [];
    rows.push(rightPcRow(
      'governanceSummary',
      rightPcText('在办 ' + (snap.active || 0) + ' 完成 ' + (snap.completed || 0) + ' 合计 ' + (snap.count || rightPcArray(snap.commitments).length), 190),
      ['新建 ' + ((snap.stats && snap.stats.created) || 0), '计入 ' + ((snap.stats && snap.stats.ticked) || 0)]
    ));
    rightPcArray(snap.commitments).slice(0, 6).forEach(function(c){
      var executorOffice = c.executorOffice || c.executorDept || '';
      var executorHolder = c.executorHolder || '';
      var executorLabel = executorOffice + (executorHolder ? '/' + executorHolder : '');
      rows.push(rightPcRow(
        c.type || '承诺',
        rightPcText((c.status || 'active') + ' 进度 ' + (c.progress || 0) + ' 执行 ' + (c.executionRate || 0) + ' 朝堂 ' + (c.courtDecision || '-')
          + (executorLabel ? ' 承办人 ' + executorLabel : '')
          + (c.executorReliability != null ? ' 可信 ' + c.executorReliability : '')
          + ' - ' + (c.target || c.title || ''), 220),
        ['T' + (c.turn || ''), '已付 ' + (c.paidCost || 0) + '/' + (c.cost || 0), executorLabel || c.linkedIssue || '']
      ));
    });
    rightPcArray(snap.events).slice(0, 4).forEach(function(e){
      var p = e.payload || {};
      rows.push(rightPcRow(
        e.type || 'governanceEvent',
        rightPcText(rightPcJson(p), 190),
        ['T' + (e.turn || ''), e.source || '']
      ));
    });
    return rows;
  }

  function rightPcHujiGovernanceCopyText(gm){
    gm = gm || window.GM || {};
    var api = window.TM && TM.HujiGovernanceLoop;
    if (api && typeof api.diagnosticsText === 'function') {
      try { return api.diagnosticsText(gm, { limit: 12 }); } catch (_) {}
    }
    return '=== Huji Governance Loop Diagnostics ===\n' + rightPcJson({ store: gm._hujiGovernanceLoop || {}, commitments: gm._hujiCommitments || [] });
  }

  function rightPcClassMinxinCopyText(gm){
    gm = gm || window.GM || {};
    var parts = [];
    var api = rightPcClassMinxinBridge();
    if (api && typeof api.diagnosticsText === 'function') {
      try { parts.push(api.diagnosticsText(gm, { limit: 12 })); } catch (_) {}
    }
    if (!parts.length) parts.push('=== Class Minxin Bridge Diagnostics ===\n' + rightPcJson(rightPcClassMinxinDiagnostics(gm)));
    parts.push(rightPcMinxinLedgerCopyText(gm));
    parts.push(rightPcMinxinPressureCopyText(gm));
    parts.push(rightPcMinxinCommitmentCopyText(gm));
    parts.push(rightPcMinxinResponsibilityCopyText(gm));
    parts.push(rightPcMinxinHardLinkCopyText(gm));
    parts.push(rightPcMinxinHardLinkConsumerCopyText(gm));
    parts.push(rightPcHujiRuntimeBridgeCopyText(gm));
    parts.push(rightPcHujiGovernanceCopyText(gm));
    return parts.join('\n\n');
  }

  function rightPcCopyDiagnostics(gm){
    var text = rightPcClassMinxinCopyText(gm);
    window._tmLastPartyClassDebugCopy = text;
    try {
      var nav = window.navigator || (typeof navigator !== 'undefined' ? navigator : null);
      if (nav && nav.clipboard && typeof nav.clipboard.writeText === 'function') nav.clipboard.writeText(text);
    } catch (_) {}
    toast('诊断快照已复制');
    return text;
  }

  function renderPartyClassDebug(){
    var gm = window.GM || {};
    var signalCount = rightPcArray(gm._socialPoliticalSignals && gm._socialPoliticalSignals.items).length;
    var memCount = rightPcArray(gm._partyClassActorMemory && gm._partyClassActorMemory.items).length;
    var actionCount = rightPcArray(gm.party_actions).length + rightPcArray(gm.class_actions).length;
    var tinyiCount = rightPcArray(gm._pendingTinyiTopics).length;
    var ccCount = rightClassCharacterAllEdges().length;
    return '<div class="tmrp-pcdebug">' +
      '<section class="tmrp-card tmrp-pcdebug-copy"><div class="tmrp-card-title"><span>阶层民心桥</span><small>复制当前诊断快照</small></div><div class="tmrp-action-row"><button type="button" class="tmrp-btn" data-right-action="pcdebug-copy">复制诊断</button></div></section>' +
      '<div class="tmrp-summary"><div class="tmrp-stat"><b>' + esc(signalCount) + '</b><span>信号</span></div><div class="tmrp-stat"><b>' + esc(memCount) + '</b><span>记忆</span></div><div class="tmrp-stat"><b>' + esc(actionCount) + '</b><span>动作</span></div><div class="tmrp-stat"><b>' + esc(tinyiCount) + '</b><span>廷议</span></div><div class="tmrp-stat"><b>' + esc(ccCount) + '</b><span>阶层人物</span></div></div>' +
      rightPcSection('民心账目', '实情 / 观感 / 矩阵 / 民变', rightPcMinxinLedgerRows(gm), '暂无民心账目') +
      rightPcSection('民情积压·待处置', '奏疏 / 廷议 / 问对 / 鸿雁', rightPcMinxinPressureRows(gm), '暂无民情积压') +
      rightPcSection('民情承诺', '执行 / 代价 / 反弹', rightPcMinxinCommitmentRows(gm), '暂无民情承诺') +
      rightPcSection('民情责任链', '承办 / 官报 / 风闻 / 问责', rightPcMinxinResponsibilityRows(gm), '暂无民情责任链记录') +
      rightPcSection('民心硬链', '财赋 / 征调 / 户籍 / 执行', rightPcMinxinHardLinkRows(gm), '暂无民心硬链记录') +
      rightPcSection('民心硬链·消费端', '实收 / 募兵 / 税基 / 诏令上限', rightPcMinxinHardLinkConsumerRows(gm), '暂无消费端记录') +
      rightPcSection('户籍运行桥', '户籍 / 徭役 / 役源 / 玩家操作', rightPcHujiRuntimeBridgeRows(gm), '暂无户籍桥记录') +
      rightPcSection('户籍治理环', '正式操作 / 承诺 / 执行', rightPcHujiGovernanceRows(gm), '暂无户籍治理承诺') +
      rightPcSection('制度生命周期', '提案 / 廷议 / 试行 / 存档', rightPcInstitutionLifecycleRows(gm), '暂无制度生命周期记录') +
      rightPcSection('阶层民心桥', '稽核 / 账目 / 朝堂 / 民变', rightPcClassMinxinRows(gm), '暂无阶层民心桥记录') +
      rightPcSection('社会政治信号', '近期确定性证据', rightPcSignalRows(gm), '暂无信号') +
      rightPcSection('维护 / 升级', '衰减、化解、未决积压', rightPcMaintenanceRows(gm), '暂无维护记录') +
      rightPcSection('行动者记忆', '议程 / 积怨 / 信念账', rightPcActorMemoryRows(gm), '暂无行动者记忆') +
      rightPcSection('行动者动作', '党派动作 / 阶层动作', rightPcActionRows(gm), '暂无行动者动作') +
      rightPcSection('阶层人物关系', '拥护 / 怨望 / 证据', rightPcClassCharacterRows(gm), '暂无阶层人物记录') +
      rightPcSection('廷议队列 / 朝议记录', '议题关联与裁决', rightPcTinyiRows(gm), '暂无廷议/朝议记录') +
      '</div>';
  }

  // Outline keeps the observability entry visible so closed-loop evidence is easy to inspect.
  function rightIsDebug(){
    return true;
  }
  function renderGangRich(){
    var tab = state.rightOutlineTab || 'classes';
    return '<div class="tmrp-outline-shell">' +
      '<div class="tmrp-tabs"><button type="button" class="' + (tab === 'classes' ? 'active' : '') + '" data-right-action="outline-tab" data-tab="classes">阶层</button><button type="button" class="' + (tab === 'parties' ? 'active' : '') + '" data-right-action="outline-tab" data-tab="parties">党派</button></div>' +
      (rightIsDebug() ? '<section class="tmrp-card tmrp-pcdebug-entry"><div class="tmrp-action-row"><button type="button" class="tmrp-btn" data-right-action="pcdebug-open">观测账本</button></div></section>' : '') +
      (tab === 'parties' ? renderRightPartyPanel() : renderRightClassPanel()) +
      '</div>';
  }

  function rightFindSocialRow(rows, key){
    key = String(key || '');
    for (var i = 0; i < (rows || []).length; i += 1) { if (rightSocialName(rows[i]) === key) return rows[i]; }
    return null;
  }

  // ── 社会层地基（2026-06-12）：趋势/势位/近账/议程条目 helpers ──
  function rightSocGM(){ return (typeof GM === 'object' && GM) || {}; }
  function rightSatTrend(c){
    var t = 0, turn = Number(rightSocGM().turn) || 0;
    ((c && c._satLedger) || []).forEach(function(e){ if (e && e.t >= turn - 1) t += (Number(e.d) || 0); });
    return Math.round(t * 10) / 10;
  }
  function rightTrendTag(t){
    if (!t) return '';
    return '<i class="tmrp-trend ' + (t > 0 ? 'up' : 'down') + '">' + (t > 0 ? '▲' : '▼') + Math.abs(t) + '</i>';
  }
  function rightClassPressureTag(c){
    var sat = rightSocNum(c, ['satisfaction','support','mood','loyalty'], 50);
    var base = Number(c && c._structBaseline);
    if (!isFinite(base)) return '';
    if (base - sat >= 8) return '<i class="tmrp-trend up">回升中</i>';
    if (sat - base >= 8) return '<i class="tmrp-trend down">承压</i>';
    return '';
  }
  function rightClassRadicalTag(c){
    var rf = Number(c && c._radicalFrac);
    if (!isFinite(rf) || rf < 0.2) return '';
    var band = rf >= 0.6 ? '鼎沸' : (rf >= 0.4 ? '汹汹' : '不稳');
    return '<i class="tmrp-trend down" title="乱民比例·激进民情（汹涌则近民变）">乱民' + Math.round(rf * 10) + '成·' + band + '</i>';
  }
  function rightSatLedgerRows(c){
    var rows = ((c && c._satLedger) || []).slice(-4).reverse().map(function(e){
      if (!e) return '';
      var d = Number(e.d) || 0;
      return '<div class="tmrp-ledger-row"><b class="' + (d >= 0 ? 'pos' : 'neg') + '">' + (d > 0 ? '+' : '') + d + '</b><small>' + esc('T' + (e.t != null ? e.t : '?') + ' · ' + rightSocialLocalizeText(String(e.why || e.src || '')).slice(0, 44)) + '</small></div>';
    }).filter(Boolean).join('');
    if (!rows) return '';
    return '<div class="tmrp-ecology"><div class="tmrp-ecology-head"><b>满意近账</b><small>何因增减</small></div><div class="tmrp-ecology-list">' + rows + '</div></div>';
  }
  function rightAgendaChips(c){
    var items = ((c && c._agenda && c._agenda.items) || []).slice()
      .sort(function(a, b){ return (Number(b.urgency) || 1) - (Number(a.urgency) || 1); }).slice(0, 6);
    if (!items.length) return '';
    var turn = Number(rightSocGM().turn) || 0;
    var chips = items.map(function(it){
      var u = Math.max(1, Math.min(3, Number(it.urgency) || 1));
      var dur = it.sinceTurn != null ? Math.max(0, turn - it.sinceTurn) : 0;
      return '<span class="tmrp-pill tmrp-agenda u' + u + '" title="' + attr((it.kind === 'seed' ? '本位诉求' : (it.kind === 'ai' ? '时局诉求' : '结构诉求')) + (dur ? '·已持续' + dur + '回合' : '')) + '">' + esc(String(it.text || '').slice(0, 20)) + (dur >= 2 ? '<small>·' + dur + '回合</small>' : '') + '</span>';
    }).join('');
    return '<div class="tmrp-chip-list tmrp-agenda-list">' + chips + '</div>';
  }
  // 地域分账（2026-06-12）：同阶不同地境遇悬殊·取最艰 4 地
  function rightClassRegionRows(c){
    var vs = (Array.isArray(c && c.regionalVariants) ? c.regionalVariants : []).filter(function(v){ return v && v.region && isFinite(Number(v.satisfaction)); });
    if (!vs.length) return '';
    vs = vs.slice().sort(function(a, b){ return Number(a.satisfaction) - Number(b.satisfaction); }).slice(0, 4);
    var rows = vs.map(function(v){
      var sNum = Math.round(Number(v.satisfaction));
      var base = Number(v._structBaseline);
      return '<div class="tmrp-ledger-row"><b class="' + (sNum < 35 ? 'neg' : 'pos') + '">' + sNum + '</b><small>' + esc(String(v.region) + (isFinite(base) ? '（势位' + Math.round(base) + '）' : '') + (v.distinguishing ? ' · ' + String(v.distinguishing).slice(0, 22) : '')) + '</small></div>';
    }).join('');
    return '<div class="tmrp-ecology"><div class="tmrp-ecology-head"><b>地域分账</b><small>同阶不同地</small></div><div class="tmrp-ecology-list">' + rows + '</div></div>';
  }
  function rightPartyLedgerRows(p){
    var ps = rightSocGM().partyState && rightSocGM().partyState[p && p.name];
    var rows = ((ps && ps.historyLog) || []).slice(-4).reverse().map(function(e){
      if (!e) return '';
      var d = Number(e.delta != null ? e.delta : e.influenceDelta) || 0;
      if (!d && !e.reason) return '';
      var label = e.field === 'cohesion' ? '凝聚' : '影响';
      return '<div class="tmrp-ledger-row"><b class="' + (d >= 0 ? 'pos' : 'neg') + '">' + label + (d > 0 ? '+' : '') + (Math.round(d * 10) / 10) + '</b><small>' + esc('T' + (e.turn != null ? e.turn : '?') + ' · ' + rightSocialLocalizeText(String(e.reason || '')).slice(0, 44)) + '</small></div>';
    }).filter(Boolean).join('');
    if (!rows) return '';
    return '<div class="tmrp-ecology"><div class="tmrp-ecology-head"><b>党势近账</b><small>何因消长</small></div><div class="tmrp-ecology-list">' + rows + '</div></div>';
  }
  function rightPartyRelChips(p){
    var ps = rightSocGM().partyState && rightSocGM().partyState[p && p.name];
    var foes = [].concat((ps && ps.conflictWith) || p.enemies || p.rivals || []).filter(Boolean).slice(0, 3);
    var allies = [].concat((ps && ps.alliedWith) || p.allies || []).filter(Boolean).slice(0, 3);
    if (!foes.length && !allies.length) return '';
    var chips = allies.map(function(x){ return '<span class="tmrp-pill tmrp-agenda u1">盟·' + esc(String(x).slice(0, 12)) + '</span>'; })
      .concat(foes.map(function(x){ return '<span class="tmrp-pill tmrp-agenda u3">敌·' + esc(String(x).slice(0, 12)) + '</span>'; })).join('');
    return '<div class="tmrp-chip-list">' + chips + '</div>';
  }

  // 政柄徽(V3式·2026-07-03)：秉政/在野/边缘——读 p.standing(canonical)或 partyState 镜像
  function rightPartyStandingTag(p){
    var st = p && (p.standing || (rightSocGM().partyState && rightSocGM().partyState[rightSocialName(p)] && rightSocGM().partyState[rightSocialName(p)].standing));
    if (st === 'governing') return ' <span class="tmrp-pill tmrp-agenda u1">秉政</span>';
    if (st === 'marginal') return ' <span class="tmrp-pill tmrp-agenda u3">边缘</span>';
    if (st === 'opposition') return ' <span class="tmrp-pill">在野</span>';
    return '';
  }
  // 政治运动 chips(V3式)：本阶层的运动·初起/成势/鼎沸
  function rightClassMovementChips(c){
    var GMx = rightSocGM();
    if (!c || !c.name || !Array.isArray(GMx._politicalMovements)) return '';
    var mine = GMx._politicalMovements.filter(function(m){ return m && m.className === c.name; });
    if (!mine.length) return '';
    var chips = mine.slice(0, 3).map(function(m){
      var tone = Number(m.support) >= 70 ? 'u3' : (Number(m.support) >= 40 ? 'u2' : 'u1');
      return '<span class="tmrp-pill tmrp-agenda ' + tone + '">运动·' + esc(String(m.label || m.kind).slice(0, 14)) + '·' + esc(m.phase || '') + esc(Math.round(Number(m.support) || 0)) + '</span>';
    }).join('');
    return '<div class="tmrp-chip-list">' + chips + '</div>';
  }

  // 列表态·瘦卡(名+满意/影响+诉求·整卡可点进详情)
  function rightSocialClassHead(c){
    var sat = rightSocNum(c, ['satisfaction','support','mood','loyalty'], 50);
    var inf = rightSocNum(c, ['influence','power','weight'], 0);
    return '<section class="tmrp-card tmrp-social-head ' + (sat < 45 ? 'hot' : (sat > 62 ? 'ok' : '')) + '" data-right-action="outline-select" data-type="class" data-key="' + attr(rightSocialName(c)) + '">' +
      '<div class="tmrp-card-title"><span>' + esc(c.name || c.label || c.id || '未名阶层') + '</span><small>满意 ' + esc(Math.round(sat)) + rightTrendTag(rightSatTrend(c)) + rightClassPressureTag(c) + rightClassRadicalTag(c) + ' · 影响 ' + esc(Math.round(inf)) + ' ›</small></div>' +
      rightArmyBar('满意', sat) + rightArmyBar('影响', inf) +
      rightArmyRows([['诉求', rightSocialBriefText(c.demands || c.currentDemand)]]) +
      '<div class="tmrp-detail-hint">点击展开议程、近账、民心与行动链</div>' +
      '</section>';
  }

  // 详情态·全 11 层深析(置入左展 flyout·壳自带头部×与滚动)
  function rightSocialClassDetail(c){
    var sat = rightSocNum(c, ['satisfaction','support','mood','loyalty'], 50);
    var inf = rightSocNum(c, ['influence','power','weight'], 0);
    var baseRow = isFinite(Number(c._structBaseline)) ? [['势位(应然)', String(Math.round(c._structBaseline)) + (Array.isArray(c._structParts) && c._structParts.length ? ' · ' + c._structParts.slice(0, 2).join(' · ') : '')]] : [];
    var leg = rightSocGM()._legitimacy;
    var legRow = (leg && leg.flag) ? [['天命权重', '权贵满意(clout)' + leg.clout + ' / 民心(人口)' + leg.pop + ' · ' + leg.flag]] : [];
    var agendaHtml = rightAgendaChips(c);
    return '<section class="tmrp-card ' + (sat < 45 ? 'hot' : (sat > 62 ? 'ok' : '')) + '"><div class="tmrp-card-title"><span>' + esc(c.name || c.label || c.id || '未名阶层') + '</span><small>满意 ' + esc(Math.round(sat)) + rightTrendTag(rightSatTrend(c)) + rightClassPressureTag(c) + rightClassRadicalTag(c) + ' · 影响 ' + esc(Math.round(inf)) + '</small></div>' +
      rightArmyBar('满意', sat) + rightArmyBar('影响', inf) +
      rightArmyRows([['规模', rightSocialLocalizeText(c.size || c.population || c.scale)], ['经济角色', rightSocialLocalizeText(c.economicRole || c.role)], ['法律地位', rightSocialLocalizeText(c.status)], ['流动性', rightSocialLocalizeText(c.mobility)], ['特权', rightSocialLocalizeText(c.privileges)], ['义务', rightSocialLocalizeText(c.obligations)]].concat(baseRow).concat(legRow)) +
      (agendaHtml || rightArmyRows([['诉求', rightSocialBriefText(c.demands || c.currentDemand)]])) +
      rightClassMovementChips(c) +
      rightClassRegionRows(c) +
      rightSatLedgerRows(c) +
      renderRightSocialCauses('class', c) +
      rightClassMinxinBridgeRows(c) +
      renderRightSocialEcology('class', c) +
      renderRightClassCharacterLinks(c) +
      renderRightSocialChain('class', c) +
      renderRightActorActions('class', c) +
      renderRightSocialActions('class', c) +
      '<div class="tmrp-meta">' + esc(rightSocialLocalizeText(c.description || c.desc || '')) + '</div></section>';
  }

  function renderRightClassPanel(){
    var rows = getClasses();
    var avg = rows.length ? Math.round(rows.reduce(function(s, c){ return s + rightSocNum(c, ['satisfaction','support','mood','loyalty'], 50); }, 0) / rows.length) : 0;
    var maxInf = rows.reduce(function(m, c){ return Math.max(m, rightSocNum(c, ['influence','power','weight'], 0)); }, 0);
    var summary = '<div class="tmrp-summary"><div class="tmrp-stat"><b>' + esc(rows.length) + '</b><span>阶层</span></div><div class="tmrp-stat"><b>' + esc(avg) + '</b><span>平均满意</span></div><div class="tmrp-stat"><b>' + esc(maxInf) + '</b><span>最高影响</span></div></div>';
    if (!rows.length) return summary + '<section class="tmrp-card empty"><div class="tmrp-empty">暂无阶层数据。</div></section>';
    return summary + '<div class="tmrp-scroll tall">' + rows.map(rightSocialClassHead).join('') + '</div>';
  }

  function rightSocialPartyHead(p){
    var inf = rightSocNum(p, ['influence','power','weight'], 0);
    var status = p.status || p.state || '未录';
    return '<section class="tmrp-card tmrp-social-head ' + (/活跃|active/i.test(String(status)) ? 'hot' : '') + '" data-right-action="outline-select" data-type="party" data-key="' + attr(rightSocialName(p)) + '">' +
      '<div class="tmrp-card-title"><span>' + esc(p.name || p.label || p.id || '未名党派') + rightPartyStandingTag(p) + '</span><small>' + esc(rightSocialLocalizeText(status)) + ' · 影响 ' + esc(Math.round(inf)) + ' ›</small></div>' +
      rightArmyBar('影响', inf) +
      rightArmyRows([['立场', rightSocialLocalizeText(p.ideology || p.stance)], ['当前议程', rightSocialBriefText(p.currentAgenda || p.agenda || p.shortGoal)]]) +
      rightPartyRelChips(p) +
      '<div class="tmrp-detail-hint">点击展开近账、生态关系与行动链</div>' +
      '</section>';
  }

  function rightSocialPartyDetail(p){
    var inf = rightSocNum(p, ['influence','power','weight'], 0);
    var status = p.status || p.state || '未录';
    var stance = p.policyStance || p.stances || p.agenda;
    var stanceHtml = (Array.isArray(stance) ? stance : [stance]).filter(Boolean).map(function(x){ return '<span class="tmrp-pill">' + esc(rightSocialLocalizeText(x)) + '</span>'; }).join('');
    return '<section class="tmrp-card ' + (/活跃|active/i.test(String(status)) ? 'hot' : '') + '"><div class="tmrp-card-title"><span>' + esc(p.name || p.label || p.id || '未名党派') + rightPartyStandingTag(p) + '</span><small>' + esc(rightSocialLocalizeText(status)) + ' · 影响 ' + esc(Math.round(inf)) + '</small></div>' +
      rightArmyBar('影响', inf) +
      rightArmyRows([['首领', p.leader || p.head], ['立场', rightSocialLocalizeText(p.ideology || p.stance)], ['支持群体', rightSocialLocalizeText(p.base || p.supportBase)], ['核心成员', rightSocialLocalizeText(p.members)], ['当前议程', rightSocialBriefText(p.currentAgenda || p.agenda)], ['短期目标', rightSocialBriefText(p.shortGoal)], ['长期追求', rightSocialBriefText(p.longGoal)]]) +
      rightPartyRelChips(p) +
      rightPartyLedgerRows(p) +
      renderRightSocialCauses('party', p) +
      renderRightSocialEcology('party', p) +
      renderRightSocialChain('party', p) +
      renderRightActorActions('party', p) +
      renderRightSocialActions('party', p) +
      '<div class="tmrp-chip-list">' + stanceHtml + '</div></section>';
  }

  function renderRightPartyPanel(){
    var rows = getParties();
    var active = rows.filter(function(p){ return /活跃|active/i.test(String(p.status || p.state || '')); }).length;
    var maxInf = rows.reduce(function(m, p){ return Math.max(m, rightSocNum(p, ['influence','power','weight'], 0)); }, 0);
    var summary = '<div class="tmrp-summary"><div class="tmrp-stat"><b>' + esc(rows.length) + '</b><span>党派</span></div><div class="tmrp-stat"><b>' + esc(active) + '</b><span>活跃</span></div><div class="tmrp-stat"><b>' + esc(maxInf) + '</b><span>最高影响</span></div></div>';
    if (!rows.length) return summary + '<section class="tmrp-card empty"><div class="tmrp-empty">暂无党派数据。</div></section>';
    return summary + '<div class="tmrp-scroll tall">' + rows.map(rightSocialPartyHead).join('') + '</div>';
  }

  // 百官空态·幽灵预览：取数名真实臣僚灰显作示例（让玩家看懂钉选后长什么样·非死白）
  function rightPinnedGhostPreview(){
    var people = (typeof getPeople === 'function' ? getPeople() : []) || [];
    var sample = people.filter(function(p){ return p && p.name; }).slice(0, 3);
    if (!sample.length) return '';
    var cards = sample.map(function(p){
      var loy = rightIssueNum(p, ['loyalty','loyal'], 50);
      var loyClass = loy < 45 ? 'lo' : (loy >= 75 ? 'hi' : 'mid');
      var tag = '<i class="tmrp-loy-tag ' + loyClass + '">' + (loy < 45 ? '险' : (loy >= 75 ? '忠' : '稳')) + '</i>';
      return '<section class="tmrp-card tmrp-minister-card"><div class="tmrp-minister-face">' + rightIssuePortrait(p) + '</div><div class="tmrp-minister-main">' +
        '<div class="tmrp-card-title"><span>' + esc(p.name) + '</span><small>' + tag + ' · 忠 ' + esc(loy) + '</small></div>' +
        '<div class="tmrp-mini-grid"><div><span>职</span><b>' + esc(p.title || p.office || p.role || '在朝') + '</b></div><div><span>派</span><b>' + esc(p.faction || '—') + '</b></div></div></div></section>';
    }).join('');
    return '<div class="tmrp-ghost-label">— 钉选后这里将呈现 · 示例 —</div><div class="tmrp-ghost">' + cards + '</div>';
  }
  function renderPinnedPeopleRich(){
    var ids = state.pinnedPeople || [];
    var people = ids.map(findPerson).filter(Boolean);
    var atCourt = people.filter(rightIssueAtCourt).length;
    var lowLoyal = people.filter(function(p){ return rightIssueNum(p, ['loyalty','loyal'], 50) < 45; }).length;
    if (!people.length) {
      return '<div class="tmrp-minister-shell"><div class="tmrp-summary"><div class="tmrp-stat"><b>0</b><span>钉选</span></div><div class="tmrp-stat"><b>0</b><span>在京</span></div><div class="tmrp-stat"><b>0</b><span>低忠</span></div></div>' +
        '<section class="tmrp-empty-hero"><div class="tmrp-empty-seal">钉</div><div class="tmrp-empty-t">尚未钉选臣僚</div><div class="tmrp-empty-d">从人物图志或人物卡片「钉选」要员，<br>即可在此集中查看忠诚、派系与处置。</div><div class="tmrp-action-row"><button type="button" class="tmrp-btn primary" onclick="TMPhase8FormalBridge.openRenwu()">打开人物图志</button></div></section>' +
        rightPinnedGhostPreview() +
        '</div>';
    }
    return '<div class="tmrp-minister-shell"><div class="tmrp-summary"><div class="tmrp-stat"><b>' + esc(people.length) + '</b><span>钉选</span></div><div class="tmrp-stat"><b>' + esc(atCourt) + '</b><span>在京</span></div><div class="tmrp-stat"><b>' + esc(lowLoyal) + '</b><span>低忠</span></div></div>' +
      '<div class="tmrp-scroll tall">' + people.map(function(p){
        var key = personKey(p);
        var loy = rightIssueNum(p, ['loyalty','loyal'], 50);
        var loyClass = loy < 45 ? 'lo' : (loy >= 75 ? 'hi' : 'mid');
        var loyTag = loy < 45 ? '险' : (loy >= 75 ? '忠' : '稳');
        return '<section class="tmrp-card tmrp-minister-card' + (loy < 45 ? ' hot' : '') + '"><div class="tmrp-minister-face">' + rightIssuePortrait(p) + '</div><div class="tmrp-minister-main">' +
          '<div class="tmrp-card-title"><span>' + esc(p.name || key) + '</span><small><i class="tmrp-loy-tag ' + loyClass + '">' + loyTag + '</i> · ' + esc(p.title || p.office || p.role || p.faction || '未仕') + '</small></div>' +
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
    // 单一真相源:渲染前从人物 officialTitle 派生官制树任职者(状态未变则跳过)
    try { if (typeof window._offSyncHoldersFromChars === 'function') window._offSyncHoldersFromChars(((window.GM&&window.GM.chars||[]).some(function(c){return c&&c.alive!==false&&c.officialTitle;})?{ force: true }:{ ifChanged: true })); } catch (_) {}
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

  function renderRightOfficeNodeShell(n, depth){
    if (!n) return '';
    depth = depth || 0;
    var positions = Array.isArray(n.positions) ? n.positions : [];
    var children = rightOfficeChildren(n);
    return '<details class="tmrp-office-node" ' + (depth < 1 ? 'open' : '') + '>' +
      '<summary>' + esc(n.name || n.title || '未名衙门') + '<small>职位 ' + esc(positions.length) + ' · 下辖 ' + esc(children.length) + '</small></summary>' +
      '<div class="tmrp-meta">官制细目正在载入...</div>' +
      '</details>';
  }

  function rightOfficeTreeHtml(tree){
    return (Array.isArray(tree) ? tree : []).map(function(n){ return renderRightOfficeNode(n, 0); }).join('');
  }

  function rightOfficeTreeShellHtml(tree){
    return (Array.isArray(tree) ? tree : []).slice(0, RIGHT_OFFICE_INITIAL_NODES).map(function(n){ return renderRightOfficeNodeShell(n, 0); }).join('');
  }

  function rightScheduleOfficeTreeHydration(token, tree){
    setTimeout(function(){
      var mount = document.querySelector('[data-office-tree-token="' + token + '"]');
      if (!mount || String(mount.getAttribute('data-office-tree-token') || '') !== String(token)) return;
      mount.innerHTML = rightOfficeTreeHtml(tree);
    }, 0);
  }

  function renderZhiRich(){
    var tree = rightOfficeTree();
    var s = rightOfficeStats(tree);
    var treeToken = 'office-' + (++_rightOfficeRenderSeq);
    var deferredTree = s.depts > RIGHT_OFFICE_INITIAL_NODES;
    var treeHtml = deferredTree ? rightOfficeTreeShellHtml(tree) : rightOfficeTreeHtml(tree);
    if (deferredTree) rightScheduleOfficeTreeHydration(treeToken, tree);
    return '<div class="tmrp-office-shell">' +
      '<div class="tmrp-summary"><div class="tmrp-stat"><b>' + esc(s.depts) + '</b><span>衙门</span></div><div class="tmrp-stat"><b>' + esc(s.filled + '/' + s.pos) + '</b><span>在任/职位</span></div><div class="tmrp-stat"><b>' + esc(s.vacant) + '</b><span>空缺</span></div></div>' +
      '<section class="tmrp-card"><div class="tmrp-card-title"><span>官制总览</span><small>衙门、层级、职位、任职、权限、公库</small></div>' +
      '<div class="tmrp-action-row"><button type="button" class="tmrp-btn primary" data-right-action="office-standalone">进入官制衙门</button><button type="button" class="tmrp-btn" data-right-action="office-people">荐贤廷推</button><button type="button" class="tmrp-btn" data-right-action="office-edict">拟任免诏</button></div></section>' +
      (tree.length ? '<div class="tmrp-scroll tall tmrp-office-tree" data-office-tree-token="' + attr(treeToken) + '">' + treeHtml + (deferredTree ? '<div class="tmrp-meta">完整官制树正在载入...</div>' : '') + '</div>' : '<section class="tmrp-card empty"><div class="tmrp-empty">当前剧本尚未载入官制树。</div></section>') +
      '</div>';
  }

  var renderers = {
    ol: renderGangRich,
    pcdebug: renderPartyClassDebug,
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
    pcdebug: 'Party/Class Observability',
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
    // 性能·2026-06-10·写入端封顶(与 tm-wendui 主路径同口径):防长局单人问对史无界膨胀
    if (GM.wenduiHistory[name].length > 400) GM.wenduiHistory[name] = GM.wenduiHistory[name].slice(-400);
    try {
      if (window.TM && TM.MinxinPressureActions && typeof TM.MinxinPressureActions.recordPlayerResponse === 'function') {
        TM.MinxinPressureActions.recordPlayerResponse(GM, {
          channel: 'wendui',
          decision: 'queried',
          actor: name,
          target: name,
          text: text
        }, {
          turn: GM.turn || 1,
          source: 'phase8-wendui'
        });
      }
    } catch (_) {}
    try {
      if (window.TM && TM.MinxinResponsibilityChain && typeof TM.MinxinResponsibilityChain.recordPlayerIntervention === 'function') {
        TM.MinxinResponsibilityChain.recordPlayerIntervention(GM, {
          channel: 'wendui',
          target: name,
          actor: name,
          text: text
        }, {
          turn: GM.turn || 1,
          source: 'phase8-wendui'
        });
      }
    } catch (_) {}
    recordRightCrisisSurfaceResponse({
      channel: 'wendui',
      text: text,
      target: name,
      targetName: name,
      actor: name
    }, 'phase8-wendui');
  }

  function rightWenduiCeremonyLabel(kind){
    return {
      seat:'赐座', stand:'不赐座', tea:'赐茶', wine:'赐酒',
      confront:'召人对质', suggest:'摘入建议库', reward:'赏', punish:'罚'
    }[kind] || '问对动作';
  }

  function rightActionData(btn){
    var data = {};
    try {
      Object.keys(btn && btn.dataset || {}).forEach(function(k){ data[k] = btn.dataset[k]; });
    } catch (_) {}
    data.buttonText = compactText(btn && (btn.textContent || btn.value || ''), 120);
    data.ariaLabel = btn && btn.getAttribute ? (btn.getAttribute('aria-label') || btn.getAttribute('title') || '') : '';
    return data;
  }

  function emitRightPlayerActionSignal(payload){
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

  function recordRightActionSignal(action, data, extraText){
    try {
      if (!window.GM) return;
      data = data || {};
      var text = [
        state.activePanel || state.rightIssueTab || '',
        action,
        data.buttonText,
        data.ariaLabel,
        data.id,
        data.name,
        data.topic,
        data.kind,
        data.className,
        data.partyName,
        data.method,
        data.command,
        data.socialCommand,
        data.actorType,
        data.decision,
        extraText
      ].filter(Boolean).join(' ');
      var payload = {
        root: GM,
        source: 'phase8-right-rail',
        action: action || '',
        kind: action || '',
        topic: data.topic || data.kind || data.method || data.command || data.socialCommand || data.buttonText || '',
        target: data.id || data.name || '',
        targetId: data.id || data.name || '',
        text: text,
        evidence: [data.buttonText, extraText].filter(Boolean)
      };
      emitRightPlayerActionSignal(payload);
    } catch (_) {}
  }

  function recordRightCrisisSurfaceResponse(payload, source){
    try {
      if (!window.GM || !window.AuthorityComplete || typeof window.AuthorityComplete.handleCrisisSurfaceResponse !== 'function') return null;
      payload = payload || {};
      return window.AuthorityComplete.handleCrisisSurfaceResponse(payload, {
        turn: GM.turn || 1,
        source: source || 'phase8-right-rail'
      });
    } catch (_) {
      return null;
    }
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
    recordRightActionSignal('edict-suggestion', { topic: topic || '', name: from || '' }, [source, from, topic, content].filter(Boolean).join(' '));
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
    if (!rightIssueIsPlayerFactionPerson(p)) { toast('此人不属本朝可直接问对人员，请走使节或鸿雁流程'); return; }
    if (!rightIssueAtCourt(p)) { toast('此人不在御前，不能直接接见'); return; }
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
    state.letterDraft = state.letterDraft || {};
    state.letterDraft.to = name;
    saveFormalDraftsToGM(false);
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
    recordRightCrisisSurfaceResponse({
      channel: 'chaoyi',
      text: [rightChaoyiModeLabel(mode), topic, decision, text].filter(Boolean).join(' '),
      decision: decision || '',
      topic: topic,
      mode: mode
    }, 'phase8-chaoyi');
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
    var row = rightFindArmyRecord(key, true);
    var army = row && row.army;
    if (!army) { toast('暂无可查看部队'); return; }
    state.selectedArmy = row.key;
    rightCloseArmyFlyout();
    var fly = document.createElement('aside');
    fly.id = 'tm-army-detail-flyout';
    fly.className = 'tm-army-detail-flyout';
    fly.innerHTML = '<div class="tm-army-detail-head"><b>部队详情</b><button type="button" data-army-close="1">×</button></div>' + renderRightArmyDetailCard(army, row.idx);
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
      handleRightPanelAction(btn.dataset.rightAction, rightActionData(btn));
    });
    document.body.appendChild(fly);
  }

  function refreshArmyFlyout(){
    var fly = document.getElementById('tm-army-detail-flyout');
    if (!fly) return false;
    var row = rightFindArmyRecord(state.selectedArmy, true);
    var army = row && row.army;
    if (!army) {
      rightCloseArmyFlyout();
      return false;
    }
    state.selectedArmy = row.key;
    fly.innerHTML = '<div class="tm-army-detail-head"><b>部队详情</b><button type="button" data-army-close="1">×</button></div>' + renderRightArmyDetailCard(army, row.idx);
    return true;
  }

  function rightSelectArmy(data){
    var key = data && data.id;
    var row = rightFindArmyRecord(key, false);
    if (!row || !row.army) { toast('未找到该部队'); return; }
    state.selectedArmy = row.key;
    openPanel('army');
    rightOpenArmyFlyout(state.selectedArmy);
  }

  // 纲纪总览·阶层/党派详情左展 flyout（镜像军队 flyout·复用 .tm-army-detail-flyout 壳）
  function rightCloseSocialFlyout(){
    var old = document.getElementById('tm-social-detail-flyout');
    if (old) old.remove();
    state.rightOutlineSel = null;
  }

  function rightSocialFlyoutInner(actorType, row){
    var headTitle = actorType === 'party' ? '党派详情' : '阶层详情';
    var body = actorType === 'party' ? rightSocialPartyDetail(row) : rightSocialClassDetail(row);
    return '<div class="tm-army-detail-head"><b>' + headTitle + '</b><button type="button" data-social-close="1">×</button></div>' + body;
  }

  function rightOpenSocialFlyout(actorType, key){
    actorType = actorType === 'party' ? 'party' : 'class';
    var rows = actorType === 'party' ? getParties() : getClasses();
    var row = rightFindSocialRow(rows, key);
    if (!row) { toast('暂无可查看对象'); return; }
    var old = document.getElementById('tm-social-detail-flyout');
    if (old) old.remove();
    state.rightOutlineSel = { type: actorType, key: rightSocialName(row) };
    var fly = document.createElement('aside');
    fly.id = 'tm-social-detail-flyout';
    fly.className = 'tm-army-detail-flyout tm-social-detail-flyout';
    fly.innerHTML = rightSocialFlyoutInner(actorType, row);
    fly.addEventListener('click', function(e){
      var close = e.target && e.target.closest ? e.target.closest('[data-social-close]') : null;
      if (close) { e.preventDefault(); rightCloseSocialFlyout(); return; }
      var btn = e.target && e.target.closest ? e.target.closest('[data-right-action]') : null;
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      handleRightPanelAction(btn.dataset.rightAction, rightActionData(btn));
    });
    document.body.appendChild(fly);
  }

  function refreshSocialFlyout(){
    var fly = document.getElementById('tm-social-detail-flyout');
    if (!fly || !state.rightOutlineSel) return false;
    var actorType = state.rightOutlineSel.type === 'party' ? 'party' : 'class';
    var rows = actorType === 'party' ? getParties() : getClasses();
    var row = rightFindSocialRow(rows, state.rightOutlineSel.key);
    if (!row) { rightCloseSocialFlyout(); return false; }
    fly.innerHTML = rightSocialFlyoutInner(actorType, row);
    return true;
  }

  function rightArmyCommand(data){
    var row = rightFindArmyRecord((data && data.id) || state.selectedArmy, false) || rightFindArmyRecord(state.selectedArmy, false);
    var army = row && row.army;
    if (!army) { toast('暂无可处置部队'); return; }
    var name = rightArmyName(army);
    var cmd = data && data.command;
    if (cmd === 'orders') {
      rightOpenArmyFlyout(row.key);
      toast('已展开 ' + name + ' 军令详情');
    } else if (cmd === 'pay') {
      state.selectedArmy = row.key;
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
    } else if (cmd === 'stance') {
      var cur = army._battleStance;   // O11 预勾三态轮换:问我→必亲征→必委之→问我(存 live GM.armies·随档)
      army._battleStance = cur === 'always' ? 'delegate' : cur === 'delegate' ? undefined : 'always';
      toast(name + '·' + (army._battleStance === 'always' ? '若接战必御驾亲征（免临场请旨）' : army._battleStance === 'delegate' ? '若接战必委之偏裨（庙算决之）' : '若接战临场请旨（会战阶段弹窗）'));
      refreshArmyFlyout();
    }
  }

  function rightFindSocialActor(actorType, name){
    var list = actorType === 'party' ? getParties() : getClasses();
    name = String(name || '').trim();
    for (var i = 0; i < list.length; i += 1) {
      var row = list[i];
      if (row && rightSocialSameName(rightSocialName(row), name)) return row;
    }
    return null;
  }

  function rightClassDemandByName(className){
    var cls = rightFindSocialActor('class', className);
    return rightSocialBriefText(cls && (cls.currentDemand || cls.demands || cls.shortGoal || cls.currentAgenda) || '');
  }

  function rightSocialSummary(actorType, actor){
    var causes = rightSocialNearCauses(actorType, actor || {});
    var cause = causes.length ? causes[0].text : '';
    if (actorType === 'party') {
      return [rightSocialBriefText(actor && (actor.shortGoal || actor.currentAgenda || actor.agenda)), rightSocialLocalizeText(cause)].filter(Boolean).join('；');
    }
    return [rightSocialBriefText(actor && (actor.currentDemand || actor.demands)), rightSocialLocalizeText(cause)].filter(Boolean).join('；');
  }

  function rightPushSocialCourtTopic(actorType, actor){
    if (!window.GM || !actor) return false;
    if (!Array.isArray(GM._pendingTinyiTopics)) GM._pendingTinyiTopics = [];
    var name = rightSocialName(actor);
    var summary = rightSocialSummary(actorType, actor);
    var goalText = rightSocialBriefText(actor.shortGoal || actor.currentAgenda || actor.agenda || '');
    var demandText = rightSocialBriefText(actor.currentDemand || actor.demands || '');
    var delegateId = actorType === 'class' ? rightClassCharacterDelegateName(actor) : (actor.leader || actor.head || '');
    var delegate = delegateId ? findPerson(delegateId) : null;
    var delegateName = delegate ? (delegate.name || personKey(delegate)) : delegateId;
    var topic = actorType === 'party'
      ? ('党议·' + name + '·' + (goalText || '近期目标') + '·请付廷议')
      : ('民情·' + name + '·' + (demandText || '阶层诉求') + '·请付廷议');
    var item = {
      topic: topic,
      from: 'phase8-social-action',
      sourceType: actorType === 'party' ? 'party_goal' : 'class_pressure',
      turn: GM.turn || 1,
      status: 'pending',
      priority: actorType === 'party' ? 74 : 78,
      reason: rightSocialLocalizeText(summary || topic),
      delegateCharacter: delegateName || '',
      delegateCharacterId: delegate ? personKey(delegate) : delegateId || '',
      linkedCharacters: delegateName ? [delegateName] : []
    };
    if (actorType === 'party') {
      item.party = name;
      item.sourceParty = name;
      item.goalText = goalText;
      item.linkedParties = [name];
    } else {
      item.className = name;
      item.sourceClass = name;
      item.demandText = demandText;
      item.linkedClasses = [name];
    }
    GM._pendingTinyiTopics.unshift(item);
    if (GM._pendingTinyiTopics.length > 80) GM._pendingTinyiTopics = GM._pendingTinyiTopics.slice(0, 80);
    state.rightIssueTab = 'chaoyi';
    state.rightChaoyiMode = 'tinyi';
    state.rightChaoyiTopic = topic;
    openPanel('issue');
    return true;
  }

  function rightSocialEdict(actorType, actor){
    if (!actor) return false;
    var name = rightSocialName(actor);
    var summary = rightSocialSummary(actorType, actor);
    var topic = actorType === 'party' ? (name + '党势调停') : (name + '阶层安抚');
    var content = actorType === 'party'
      ? ('命内阁核议' + name + '近来议程与朋党动向，分别安抚其合理诉求、约束其过激营私，并回奏可行章程。' + (summary ? '近因：' + summary : ''))
      : ('命有司核实' + name + '近来诉求与地方影响，酌拟安抚、减负、申禁侵扰之策，并限期回奏。' + (summary ? '近因：' + summary : ''));
    return rightAddEdictSuggestion(actorType === 'party' ? '党派纲纪' : '阶层民情', name, topic, content);
  }

  function rightSocialAudience(actorType, actor){
    if (!window.GM || !actor) return false;
    var name = rightSocialName(actor);
    var target = actorType === 'party' ? (actor.leader || actor.head || '') : '';
    if (!target && actorType === 'class') target = rightClassCharacterDelegateName(actor);
    if (!target && actorType === 'party') {
      var people = getPeople();
      var hit = (Array.isArray(people) ? people : []).find(function(p){
        return p && rightSocialSameName(p.party || p.faction || p.group, name);
      });
      target = hit && (hit.name || personKey(hit));
    }
    if (!target) target = name + (actorType === 'party' ? '党中主事' : '代表');
    GM.wenduiTarget = target;
    state.rightWenduiPerson = target;
    state.rightIssueTab = 'wendui';
    openPanel('issue');
    toast('已转入问对：' + target);
    return true;
  }

  function rightHandleSocialChain(data){
    data = data || {};
    var kind = data.chainKind || data.kind || '';
    var topic = data.topic || data.target || data.name || '';
    if (kind === 'party') {
      state.rightOutlineTab = 'parties';
      openPanel('ol');
      if (data.target) toast('已跳转党派：' + data.target);
      return true;
    }
    if (kind === 'demand' || kind === 'issue') {
      state.rightIssueTab = 'chaoyi';
      state.rightChaoyiMode = 'tinyi';
      state.rightChaoyiTopic = topic || '';
      openPanel('issue');
      return true;
    }
    if (kind === 'ruling') {
      state.rightIssueTab = 'chaoyi';
      state.rightChaoyiMode = 'tinyi';
      if (topic) state.rightChaoyiTopic = topic;
      openPanel('issue');
      return true;
    }
    if (kind === 'risk') {
      state.rightIssueTab = 'chaoyi';
      state.rightChaoyiMode = 'tinyi';
      state.rightChaoyiTopic = topic || '';
      openPanel('issue');
      return true;
    }
    return false;
  }

  function rightHandleSocialAction(data){
    var actorType = data.actorType || data.type || 'class';
    actorType = actorType === 'party' ? 'party' : 'class';
    var actor = rightFindSocialActor(actorType, data.name || data.id || data.target);
    if (!actor) { toast('暂未找到该纲纪对象'); return; }
    var cmd = data.socialCommand || data.command || 'chaoyi';
    if (cmd === 'audience') {
      rightSocialAudience(actorType, actor);
    } else if (cmd === 'edict') {
      if (rightSocialEdict(actorType, actor)) toast('已纳入诏书建议：' + rightSocialName(actor));
    } else {
      if (rightPushSocialCourtTopic(actorType, actor)) toast('已付廷议：' + rightSocialName(actor));
    }
  }

  function handleRightPanelAction(action, data){
    data = data || {};
    recordRightActionSignal(action, data);
    if (action === 'pcdebug-open') {
      openPanel('pcdebug');
    } else if (action === 'pcdebug-copy') {
      rightPcCopyDiagnostics(window.GM || {});
    } else if (action === 'issue-tab') {
      state.rightIssueTab = data.tab || 'wendui';
      openPanel('issue');
    } else if (action === 'outline-tab') {
      state.rightOutlineTab = data.tab || 'classes';
      rightCloseSocialFlyout();
      openPanel('ol');
    } else if (action === 'outline-select') {
      rightOpenSocialFlyout(data.type || 'class', data.key || '');
    } else if (action === 'social-action') {
      rightHandleSocialAction(data);
    } else if (action === 'social-chain') {
      rightHandleSocialChain(data);
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
    } else if (action === 'wen-filter') {
      state.rightWenFilter = data.filter || 'all';
      openPanel('policy');
    } else if (action === 'keju-open') {
      if (typeof window.openKejuPanel === 'function') window.openKejuPanel();
      else if (typeof window.showKejuModal === 'function') window.showKejuModal();
      else toast('科举系统未加载');
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
      handleRightPanelAction(btn.dataset.rightAction, rightActionData(btn));
    });
  }

  // ── public API attach (Wave 3·rightrail panels + dispatch) ──
  bridge.rightrail = bridge.rightrail || {};
  bridge.rightrail.renderers = renderers;
  bridge.rightrail.titles = titles;
  bridge.rightrail.handleRightPanelAction = handleRightPanelAction;
  bridge.rightrail.bindRightPanelActions = bindRightPanelActions;
  bridge.rightrail.rightCloseArmyFlyout = rightCloseArmyFlyout;
  bridge.rightrail.rightOpenArmyFlyout = rightOpenArmyFlyout;
  bridge.rightrail.refreshArmyFlyout = typeof refreshArmyFlyout === "function" ? refreshArmyFlyout : null;
  bridge.rightrail.rightCloseSocialFlyout = rightCloseSocialFlyout;
  bridge.rightrail.rightOpenSocialFlyout = rightOpenSocialFlyout;
  bridge.rightrail.refreshSocialFlyout = typeof refreshSocialFlyout === "function" ? refreshSocialFlyout : null;
})();
