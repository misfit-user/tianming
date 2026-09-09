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
  var RIGHT_WENDUI_INITIAL_ROWS = 24;
  var _rightArmyRenderSeq = 0;
  var _rightAdminRenderSeq = 0;
  var _rightOfficeRenderSeq = 0;
  var _rightWenduiRenderSeq = 0;

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
  //>>P8RAIL-SPLIT24-PLUMBING-A-START  (巨石拆分第二十四拆 20260706·脚本生成·勿手改)
  // origin=本片(先装载)。分片 phase8-formal-rightrail-social.js 于本片【之后】装载，经共享 bucket TM.__p8RailParts 双向接线：
  // origin 于装载末尾(PLUMBING-B)把 kept 成员导出 bucket 供分片闭包捕获；分片装载后把社会层/阶层党派面板函数回填 bucket，
  // 本片下列委托 shim(函数声明·已提升到本 IIFE 顶)于调用期(renderers[kind]()/flyout/handleRightPanelAction)解析。契约见 lint-split-contracts。
  var __p8R = (function(){ var t = window.TM = window.TM || {}; return t.__p8RailParts = t.__p8RailParts || {}; })();
  function renderGangRich(){ return __p8R.renderGangRich.apply(this, arguments); }
  function renderPartyClassDebug(){ return __p8R.renderPartyClassDebug.apply(this, arguments); }
  function rightClassCharacterDelegateName(){ return __p8R.rightClassCharacterDelegateName.apply(this, arguments); }
  function rightFindSocialRow(){ return __p8R.rightFindSocialRow.apply(this, arguments); }
  function rightPcCopyDiagnostics(){ return __p8R.rightPcCopyDiagnostics.apply(this, arguments); }
  function rightSocGM(){ return __p8R.rightSocGM.apply(this, arguments); }
  function rightSocialBriefText(){ return __p8R.rightSocialBriefText.apply(this, arguments); }
  function rightSocialClassDetail(){ return __p8R.rightSocialClassDetail.apply(this, arguments); }
  function rightSocialLocalizeText(){ return __p8R.rightSocialLocalizeText.apply(this, arguments); }
  function rightSocialName(){ return __p8R.rightSocialName.apply(this, arguments); }
  function rightSocialNearCauses(){ return __p8R.rightSocialNearCauses.apply(this, arguments); }
  function rightSocialPartyDetail(){ return __p8R.rightSocialPartyDetail.apply(this, arguments); }
  function rightSocialSameName(){ return __p8R.rightSocialSameName.apply(this, arguments); }
  //>>P8RAIL-SPLIT24-PLUMBING-A-END

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
    var player = (window.TM && TM.Player && typeof TM.Player.getCharacter === 'function')
      ? TM.Player.getCharacter(window.GM)
      : (window.GM && Array.isArray(GM.chars) ? GM.chars.find(function(c){ return c && c.isPlayer === true; }) : null);
    return !!(p && (p === player || p.isPlayer || p.player || personKey(p) === 'player' || (player && p.id && p.id === player.id)));
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
    if (p._mourning || p._lastMetTurn === ((window.GM && GM.turn) || 1) || p._lastAudienceDeniedTurn === ((window.GM && GM.turn) || 1)) return false;
    // 单一真源：走 tm-wendui 的 _wdDeriveAudienceAgenda(与旧 UI【有臣求见】筛选、与本文件 rightWenduiSeekReason 同源)。
    // agenda 依赖 _npcCommitments/_wdRewardPunish/loyalty/stress 等真实处境，只挂在真身上→照 :409 取真身。
    var realCh = (typeof findCharByName === 'function' && findCharByName(p.name)) || p;
    if (typeof window !== 'undefined' && typeof window._wdDeriveAudienceAgenda === 'function') {
      var agenda = null;
      try { agenda = window._wdDeriveAudienceAgenda(realCh); } catch (_) {}
      // agenda 已内置防洪(routine/未逾期/浅离心 seek=false)，不再叠加过滤把集合改窄；未回信亲至是 agenda 之外的独立 or 条件(与旧 UI :192-194 一致)。
      return !!(agenda && agenda.seek)
        || rightWenduiHasUnansweredLetter(p.name || personKey(p));
    }
    // 回退：真源缺席(加载序未就绪/单元环境)时用旧启发式，防渲染崩。
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
      '<button type="button" class="tmrp-wd-request-main" data-right-action="wendui-queue" data-qid="' + attr(q._qid || '') + '">' +
      face +
      '<span><b>' + esc(name) + (q.isEnvoy ? '<i>使节</i>' : '') + '</b><small>' + esc(compactText(q.reason || q.fromFaction || '等待陛下决断', 72)) + '</small></span>' +
      '</button>' +
      '<button type="button" class="tmrp-wd-mini" data-right-action="wendui-dismiss" data-qid="' + attr(q._qid || '') + '">暂却</button>' +
      '</article>';
  }

  function rightWenduiGroupNew(title, note, body, emptyText){
    return '<section class="tmrp-card tmrp-wd-group"><div class="tmrp-card-title"><span>' + esc(title) + '</span><small>' + esc(note || '') + '</small></div>' +
      (body || '<div class="tmrp-empty">' + esc(emptyText || '暂无人物。') + '</div>') +
      '</section>';
  }

  // 问对名单渐进水合(2026-07-19·求见刀复审返工·防洪)：高压局求见/在京/远方名单可达数百人，
  //   一次性全渲则 DOM 线性膨胀致卡顿(极端局千人≈8000+元素)。与军队/政区名册同范式——先渲一批
  //   (RIGHT_WENDUI_INITIAL_ROWS)，余量经 setTimeout 水合补全；完整人数由分组标题 count + 「余 N 人」
  //   提示保留，绝不静默截断(区别于旧 slice(0,N) 丢人)。求见/在京/远方卡片均以稳定 data-id(personKey)标识，
  //   不涉 index，故水合安全。
  function rightScheduleWenduiHydration(token, fullHtml){
    setTimeout(function(){
      var mount = document.querySelector('[data-wd-list-token="' + token + '"]');
      if (!mount || String(mount.getAttribute('data-wd-list-token') || '') !== String(token)) return;
      mount.innerHTML = fullHtml;
    }, 0);
  }
  function rightWenduiHydratedList(cls, items, renderItem){
    var arr = Array.isArray(items) ? items : [];
    var token = 'wd-' + (++_rightWenduiRenderSeq);
    var deferred = arr.length > RIGHT_WENDUI_INITIAL_ROWS;
    var syncArr = deferred ? arr.slice(0, RIGHT_WENDUI_INITIAL_ROWS) : arr;
    if (deferred) rightScheduleWenduiHydration(token, arr.map(renderItem).join(''));
    return '<div class="' + cls + '" data-wd-list-token="' + attr(token) + '">' +
      syncArr.map(renderItem).join('') +
      (deferred ? '<div class="tmrp-meta">余 ' + (arr.length - RIGHT_WENDUI_INITIAL_ROWS) + ' 人载入中...</div>' : '') +
      '</div>';
  }

  // 名单与导航红泡共用的只读筛选；角标读取不能清洗队列、补主键或生成新的请见。
  function rightWenduiKeepPending(q){
      if (!q || !q.name) return false;
      if (!q.isConsort) {
        // 阵营闸(2026-07-04)：滤除旧版混入的明确异势力求见者(外邦君主)·使节/剧本预置/空 faction 者放行·与 tm-wendui 渲染清洗同款
        if (q.isEnvoy || q.fromFaction || q._sid || q._opening) return true;
        var pc = findPerson(q.name);
        if (!pc && typeof window.findCharByName === 'function') {
          try { pc = window.findCharByName(q.name); } catch(_) {}
        }
        if (pc && typeof window._tmIsForeignCourtChar === 'function' && window._tmIsForeignCourtChar(pc)) return false;
        return true;
      }
      var p = findPerson(q.name);
      if (!p && typeof window.findCharByName === 'function') {
        try { p = window.findCharByName(q.name); } catch(_) {}
      }
      return !!(p && rightIssueIsPlayerConsort(p));
  }

  function rightWenduiPendingState(){
    var gm = window.GM || {};
    var people = rightIssuePeople();
    var pendingAudiences = (Array.isArray(gm._pendingAudiences) ? gm._pendingAudiences : []).filter(rightWenduiKeepPending);
    var queued = new Set();
    pendingAudiences.forEach(function(q){
      var p = findPerson(q.name);
      queued.add(p ? personKey(p) : 'name:' + q.name);
    });
    var atCourt = people.filter(rightIssueAtCourt);
    var seekers = atCourt.filter(function(p){ return !queued.has(personKey(p)) && !queued.has('name:' + p.name) && rightWenduiIsSeeker(p); });
    var pending = new Set(queued);
    seekers.forEach(function(p){ pending.add(personKey(p)); });
    return {
      queue: pendingAudiences,
      seekers: seekers,
      waiting: atCourt.filter(function(p){ return !pending.has(personKey(p)) && !pending.has('name:' + p.name); }),
      away: people.filter(function(p){ return !rightIssueAtCourt(p); }),
      count: pending.size
    };
  }

  function renderRightWenduiPanel(){
    // 保留既有清洗写口及稳定 _qid；红泡与名单均由上方只读查询派生。
    if (typeof window._wdCleansePendingAudiences === 'function') {
      window._wdCleansePendingAudiences(rightWenduiKeepPending);
    }
    if (typeof window._wdEnsurePendingQids === 'function') window._wdEnsurePendingQids();   // 渲染前补 _qid(队列按钮按 _qid 定位·非 index)
    var pending = rightWenduiPendingState();
    var pendingAudiences = pending.queue, seekers = pending.seekers, waiting = pending.waiting, away = pending.away;
    var waitingBody = waiting.length ? rightWenduiHydratedList('tmrp-wd-grid', waiting, function(p){
      return rightWenduiPersonCard(p, 'wendui-pick', '');
    }) : '';
    var awayBody = away.length ? rightWenduiHydratedList('tmrp-wd-away', away, function(p){
      var loc = p.location || p.status || '远方';
      var travel = p._travelTo ? ' → ' + p._travelTo : '';
      return rightWenduiPersonCard(p, 'wendui-letter', compactText(loc + travel, 12));
    }) : '';
    var queueBody = pendingAudiences.length ? '<div class="tmrp-wd-list">' + pendingAudiences.map(rightWenduiQueueItem).join('') + '</div>' : '';
    var seekerBody = seekers.length ? rightWenduiHydratedList('tmrp-wd-list', seekers, rightWenduiRequestItem) : '';
    return '<div class="tmrp-issue-shell tmrp-wendui">' +
      '<div class="tmrp-meta" data-wendui-pending-count="' + pending.count + '" title="同一人多条来意保留，人数不重复计算">尚有 ' + pending.count + ' 人请见 · 点选下列人物接见，或暂却／不见。</div>' +
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
      { id:'tinyi', name:'廷议', sub:'集议大政', desc:'一议多轮、辩难立场、共识或乾纲独断。', meta:'15-30 人 · 精力 15', img:'chaoyi-tingyi-scene-v1.png' },
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

  // 军心缺省值对齐真源(2026-07-19)：tm-military.js MILITARY_DEFAULT_MORALE=60 + _armyMorale(morale!=null?Number:60)
  //   是单一真相源(战力/战斗/编制统一读)。右栏原用默认 50，与真源分裂(0 士气军按 50 显、缺省 50≠60)。改走
  //   window._armyMorale(typeof 守卫)；真源缺席时兜底 60(非 50)且保留 moraleValue 兼容键。morale=0 正确读作 0。
  function rightArmyMoraleValue(a){
    var v;
    if (typeof window !== 'undefined' && typeof window._armyMorale === 'function') {
      try { v = window._armyMorale(a); } catch (_) { v = null; }
    }
    if (v == null) v = (a && a.morale != null) ? a.morale : (a && a.moraleValue != null ? a.moraleValue : 60);
    var n = Number(v);
    if (!isFinite(n)) n = 60;
    return Math.max(0, Math.min(100, n));
  }

  // 补给对齐真源战力口径(2026-07-19)：calculateArmyStrength 中 supplyRatio(0-1·补给/行军系统填) 优先于
  //   supply(0-100·日常/UI)。右栏原只读 supply/supplies，行军补给态被无视。改：有 supplyRatio 时换算(×100)优先。
  function rightArmySupplyValue(a){
    if (a && a.supplyRatio !== undefined && a.supplyRatio !== null) {
      var r = Number(a.supplyRatio);
      if (isFinite(r)) return Math.max(0, Math.min(100, r * 100));
    }
    return rightArmyPercent(a, ['supply','supplies'], 70);
  }

  function rightArmySoldiers(a){
    var t = Math.max(0, Math.round(rightArmyNumRaw(a, ['soldiers','size','strength','troops','initialTroops'], 0)));
    // 失真层S5(拍板③)：名册/详情/总兵力显据奏名员=实额虚增(吃空饷·军队分部门吏治面×统帅忠诚点·
    // 直臣治军虚额少)·核饷点验揭实额·战斗引擎读GM真值零影响。
    var RV = window.TM && TM.ReportedView;
    if (!RV || !RV.active(window.P || null)) return t;
    var handler = null;
    try {
      var cn = a && (a.commander || a.commanderName || a.general);
      if (cn && typeof findCharByName === 'function') handler = findCharByName(cn);
    } catch (e) {}
    return RV.value('army', 'soldiers.' + String((a && (a.name || a.id)) || ''), t, { direction: 'good', dept: 'military', handler: handler }).shown;
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
    var morale = rightArmyMoraleValue(a);
    var training = rightArmyPercent(a, ['training','trainingValue'], 50);
    var loyalty = rightArmyPercent(a, ['loyalty','cohesion'], 50);
    var control = rightArmyPercent(a, ['control','discipline','commandControl'], 50);
    var supply = rightArmySupplyValue(a);
    var mutiny = rightArmyPercent(a, ['mutinyRisk','rebellionRisk'], 0);
    var hot = morale < 45 || supply < 35 || mutiny >= 55;
    var commander = rightArmyFirst(a, ['commander','commanderName','commanderDisplayName','commander_name','general','generalName','leader','leaderName','commandingOfficer','chiefCommander','chiefGeneral','mainGeneral'], '未置统帅');
    var location = rightArmyFirst(a, ['location','garrison','station','theater','region'], '未置驻地');
    var activity = rightArmyActivityText(rightArmyFirst(a, ['activity','state','status','currentAction'], '驻防'));
    // 行军可视化(Wave2·右栏详情卡):在途军队「当前动态」附趋向目的地+进度(取 GM.marchOrders 真进度·同朝野内情抽屉/过回合报告一致)
    try {
      var _mo = (typeof GM !== 'undefined' && GM && GM.marchOrders && GM.marchOrders.length) ? GM.marchOrders.find(function(o){ return o && o.status === 'marching' && (o.armyId === a.id || o.armyName === (a.name || '') || o.armyName === rightArmyName(a)); }) : null;
      if (_mo) { var _mt = _mo.totalTurns || 0, _mp = _mo.progress || 0; activity = '行军 · 趋' + (_mo.to || '？') + ' ' + _mp + '/' + _mt + '回合·余' + Math.max(0, _mt - _mp); }
    } catch (_me) {}
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
      (rightArmyBelongsToPlayer(a) ? '<button type="button" class="tmrp-btn" data-right-action="army-command" data-command="appoint" data-id="' + attr(armyKey) + '" title="拜将易帅·仅在世将才可受命">易将</button>' : '') +
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

  // D1 国祚·崩坏临近度（聚合派生·纯读现有信号·治「干瞪眼看数字线性往下掉」）：
  //   民变最高级(主死因链·5级=亡)/流寇燎原/皇权低(权臣篡位死因)/度支竭/民心地板 → 派生 0-100 + 具名档(安/隐忧/将危/濒亡) + 点明哪根杠杆在塌。
  //   守 owner 铁律：这是「失败的可读性图层」·非胜利路线·不加逆天手段·仅让下坡可读。承平无危则不显(不制造无谓焦虑)。
  function rightGuozuoCard(){
    var G = rightSocGM();
    var factors = [];
    var revolts = (G.minxin && Array.isArray(G.minxin.revolts)) ? G.minxin.revolts.filter(function(r){ return r && (Number(r.level)||0) > 0 && !r._suppressed; }) : [];
    var maxLv = revolts.reduce(function(m,r){ return Math.max(m, Number(r.level)||0); }, 0);
    if (maxLv > 0) { var LVCN = ['','流言','聚啸','暴动','起义','改朝']; var _lv = Math.max(1, Math.min(5, Math.round(maxLv))); factors.push({ name:'民变', sev:[0,12,28,50,78,100][_lv]||0, note: revolts.length + ' 处·最烈「' + LVCN[_lv] + '」' }); }
    var rebels = (Array.isArray(G.rovingRebels) ? G.rovingRebels : []).filter(function(r){ return r && !r.disbanded && (Number(r.strength)||0) > 0; });
    var rebStr = rebels.reduce(function(s,r){ return s + (Number(r.strength)||0); }, 0);
    if (rebStr > 0) factors.push({ name:'流寇', sev: Math.min(100, Math.round(rebStr/300000*100)), note: rebels.length + ' 股·众 ' + rightArmyFmtNum(rebStr) });
    var hq = (G.huangquan && typeof G.huangquan.index === 'number') ? G.huangquan.index : (typeof G.huangquan === 'number' ? G.huangquan : null);
    if (hq != null && hq < 45) factors.push({ name:'皇权', sev: Math.min(100, Math.round((45-hq)/45*100)), note: '皇权 ' + Math.round(hq) + '·权柄下移' });
    var money = (G.guoku && typeof G.guoku.money === 'number') ? G.guoku.money : null;
    if (money != null && money < 200000) factors.push({ name:'度支', sev: Math.min(100, Math.round((200000-money)/200000*100)), note: '库银 ' + rightArmyFmtNum(Math.max(0,money)) + '·度支将竭' });
    var mx = (G.minxin && typeof G.minxin.trueIndex === 'number') ? G.minxin.trueIndex : null;
    if (mx != null && mx < 40) factors.push({ name:'民心', sev: Math.min(100, Math.round((40-mx)/40*100)), note: '民心 ' + Math.round(mx) + '·离心' });
    // D4 补权臣因子(第七轮B·2026-07-07)：篡位死因链此前卡上只读皇权指数不读 controlLevel——权柄将逾而皇权未低时全无预警。
    var pm = (G.huangquan && G.huangquan.powerMinister) || null;
    var cl = pm ? (Number(pm.controlLevel) || 0) : 0;
    if (pm && cl > 0.75) factors.push({ name:'权臣', sev: Math.min(100, Math.round((cl - 0.5) * 160)), note: (pm.name || '权臣') + '权柄' + Math.round(cl * 100) + '分·柄移私门' });
    if (!factors.length) return '';
    factors.sort(function(a,b){ return b.sev - a.sev; });
    var rest = factors.slice(1).reduce(function(s,f){ return s + f.sev; }, 0);
    var prox = Math.min(100, Math.round(factors[0].sev + rest * 0.15));
    var TIERS = [[75,'濒亡','#8c2f26'],[50,'将危','#a85a3a'],[25,'隐忧','#a8833a'],[0,'安','#557f6f']];
    var tier = null; for (var i=0;i<TIERS.length;i++){ if (prox >= TIERS[i][0]) { tier = TIERS[i]; break; } }
    var tierName = tier[1], tierColor = tier[2], barW = Math.max(3, prox);
    var levers = factors.slice(0,3).map(function(f){ return '<div class="tmrp-step"><b>' + esc(f.name) + '</b>' + esc(f.note) + '</div>'; }).join('');
    // D4 一步之遥(第七轮B)：三处终局临界此前全静默骰点(民变4→5/篡位 cl>0.9/流寇建制)——可升级而未骰中·
    //   玩家全然不知有多险。此处读侧具名告警(带省份/权臣名/巨寇名真数据)·纯读零改判定逻辑·守「失败可读性图层」铁律。
    var junctures = [];
    if (maxLv >= 4) {
      var _lv4regs = revolts.filter(function(r){ return (Number(r.level)||0) >= 4; }).map(function(r){ return r.region || '某地'; }).slice(0, 2).join('、');
      junctures.push('民变已至「起义」' + (_lv4regs ? '（' + _lv4regs + '）' : '') + '·距改朝只欠一线——剿抚迟则天命移');
    }
    if (pm && cl > 0.9) junctures.push((pm.name || '权臣') + '权柄已逾九分·距废立篡夺只欠一线——制衡迟则神器易主');
    var _builtRebs = (Array.isArray(G._activeRevolts) ? G._activeRevolts : []).filter(function(r){ return r && r.organizationType === 'builtState'; });
    if (_builtRebs.length) junctures.push((_builtRebs[0].leaderName || _builtRebs[0].name || '巨寇') + '已成建制立国之势·问鼎只在旦夕');
    var juncHtml = junctures.slice(0, 3).map(function(t){ return '<div class="tmrp-step" style="color:#c9645a;"><b>一步之遥</b>' + esc(t) + '</div>'; }).join('');
    return '<section class="tmrp-card hot"><div class="tmrp-card-title"><span>国祚 · ' + esc(tierName) + '</span><small>王朝崩坏临近度·唯延缓·不可逆</small></div>' +
      '<div style="margin:2px 0 7px;"><div style="height:9px;border-radius:5px;background:rgba(0,0,0,.22);overflow:hidden;"><div style="height:100%;width:' + barW + '%;background:' + tierColor + ';"></div></div>' +
      '<div style="display:flex;justify-content:space-between;font-size:0.7rem;color:var(--txt-d);margin-top:2px;"><span>崩坏临近度</span><span style="color:' + tierColor + ';font-weight:600;">' + prox + ' / 100 · ' + esc(tierName) + '</span></div></div>' +
      juncHtml + levers + '</section>';
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
    var avgMorale = rows.length ? Math.round(rows.reduce(function(s, row){ return s + rightArmyMoraleValue(row.army); }, 0) / rows.length) : 0;
    var avgTraining = rows.length ? Math.round(rows.reduce(function(s, row){ return s + rightArmyPercent(row.army, ['training'], 50); }, 0) / rows.length) : 0;
    var selectedRow = rightFindArmyRow(rows, state.selectedArmy) || rows[0] || null;
    if (selectedRow) state.selectedArmy = selectedRow.key;
    var selectedKey = selectedRow ? selectedRow.key : '';
    var groups = rightBuildArmyGroups(rows);
    var listToken = 'army-' + (++_rightArmyRenderSeq);
    var armyTab = state.rightArmyTab === 'overview' ? 'overview' : 'roster';   // 页签早判·默认名册(行12=玩家找的就是名册)·概览页不渲名册不排水合
    var deferredList = rows.length > RIGHT_ARMY_INITIAL_ROWS;
    var syncGroups = deferredList ? rightSliceArmyGroups(groups, RIGHT_ARMY_INITIAL_ROWS) : groups;
    if (deferredList && armyTab === 'roster') rightScheduleArmyListHydration(listToken, groups, selectedKey);
    var armyAlerts = rows.map(function(row){
      var a = row.army;
      var morale = rightArmyMoraleValue(a);
      var supply = rightArmySupplyValue(a);
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
    // 页签分栏(2026-07-11·玩家反馈行12——名册压在概览下方要滑动·不够明显)：概览/部队名册两页·镜像 issue-tab 惯例
    var rosterCard = '<section class="tmrp-card"><div class="tmrp-card-title"><span>部队名册</span><small>点部队·左侧展开军情</small></div>' +
      (rows.length ? '<div class="tmrp-scroll compact tmrp-army-list" data-army-list-token="' + attr(listToken) + '">' + rightArmyGroupsHtml(syncGroups, selectedKey) + (deferredList ? '<div class="tmrp-meta">余下部队正在载入...</div>' : '') + '</div>' : '<div class="tmrp-empty">麾下暂无军队。</div>') +
      '</section>';
    return '<div class="tmrp-army-shell">' +
      '<div class="tmrp-summary"><div class="tmrp-stat"><b>' + esc(armies.length) + '</b><span>军队</span></div><div class="tmrp-stat"><b>' + esc(rightArmyFmtNum(total)) + '</b><span>总兵力</span></div><div class="tmrp-stat"><b>' + esc(avgMorale + '/' + avgTraining) + '</b><span>士气/训练</span></div></div>' +
      '<div class="tmrp-tabs tmrp-army-tabs">' +
      '<button type="button" class="' + (armyTab === 'roster' ? 'active' : '') + '" data-right-action="army-tab" data-tab="roster">部队名册·' + esc(armies.length) + '</button>' +
      '<button type="button" class="' + (armyTab === 'overview' ? 'active' : '') + '" data-right-action="army-tab" data-tab="overview">军情概览' + (armyAlerts.length ? '·警' + armyAlerts.length : '') + '</button>' +
      '</div>' +
      (armyTab === 'roster'
        ? rosterCard
        : rightGuozuoCard() + armyOverviewCard + rightArmoryCard() + rightRovingCard()) +
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

  // ★主官取值走真源(2026-07-19)：原先直读 d.governor||d.chief||… 是剧本静态死字段(任免/死亡不更新)，
  //   绕过了 regionBundle 的活官职绑定。此处照 liveRegionGovernor(治理官职→GM.chars 在世持有人·随任免/死亡而变)
  //   同源解析——活绑定命中优先显在世持有人；否则校静态主官是否在世，已殁/无人→返 ''(显示层落「空缺·待补」)。
  //   liveRegionGovernor 由 phase8-formal-map(origin)导出至 bridge.__p8MapParts；未载入时兜回静态值(退化不崩)。
  function rightAdminLiveGovernor(d){
    d = d || {};
    var officePos = d.officialPosition || d.office || d.position || '';
    var staticGov = d.governor || d.chief || d.holder || d.official || '';
    try {
      var mp = (bridge && bridge.__p8MapParts) || null;
      var lrg = mp && mp.liveRegionGovernor;
      if (officePos && typeof lrg === 'function') {
        var live = lrg(officePos);
        if (live && live.name) return live.name;   // 活官职持有人(权威)
      }
    } catch (_) {}
    if (staticGov) {
      var sc = (typeof window.findCharByName === 'function') ? window.findCharByName(staticGov) : null;
      if (sc && (sc.alive === false || sc.dead === true)) return '';   // 静态主官已殁→出缺(死字段曾显死人)
      return staticGov;
    }
    return '';   // 无人
  }

  function rightAdminFromDivision(d, faction){
    d = d || {};
    var popObj = (d.population && typeof d.population === 'object') ? d.population : null;
    var detail = d.populationDetail || d.population_detail || {};
    return {
      name: d.name || d.title || d.officialName || d.id || '未名区划',
      level: rightAdminLevelLabel(d.level || d.adminLevel || d.regionType || d.type || ''),
      faction: rightFactionDisplay(faction || d.dejureOwner || d.owner || d.factionName || d.faction || ''),
      governor: rightAdminLiveGovernor(d),
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
        '<div class="tmrp-mini-grid"><div><span>主官</span><b>' + esc(x.governor || '空缺·待补') + '</b></div><div><span>官职</span><b>' + esc(x.position || '未录') + '</b></div><div><span>人口</span><b>' + esc(rightAdminWan(x.pop)) + '</b></div><div><span>户数</span><b>' + esc(rightAdminWan(x.households)) + '</b></div></div>' +
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
      (crisis.length ? '<section class="tmrp-card hot"><div class="tmrp-card-title"><span>区划预警</span><small>民心低 / 腐败高</small></div>' + crisis.slice(0, 4).map(function(x){ return '<div class="tmrp-step"><b>' + esc(x.name) + '</b> 民心 ' + esc(Math.round(rightAdminNum(x.minxin, 0))) + ' · 腐败 ' + esc(Math.round(rightAdminNum(x.corruption, 0))) + ' · ' + esc(x.governor || '空缺·待补') + '</div>'; }).join('') + '</section>' : '') +
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

  // 岁入/岁出分项走 cascade 结算真源(2026-07-19)：读 GM.guoku.ledgers.{money,grain,cloth}.{sources,sinks}
  //   (本回合按税种/支类结算·与帑廪 panel 岁入岁出分项同源)。原 rightFinanceCollect 读 incomeItems/taxes 静态配置
  //   数组，与真源结算对不上；cascade 无数据时上层回落静态数组并标「(概算)」。
  //   税种/支类中文名镜像 tm-guoku-panel 的 _tagNameMap/_expLabels(跨朝代通用财政科目)。
  function rightFinanceTagNames(){
    return {
      tianfu:'田赋', tianfu_silver:'田赋折银', dingshui:'丁税', yongBu:'庸役折布', shangShui:'商税',
      yanlizhuan:'盐铁专卖', caoliang:'漕粮', shipaiShui:'市舶', quanShui:'榷税', juanNa:'捐纳',
      qita:'其他', mining:'矿冶', fishingTax:'渔课', liaoxiang:'辽饷加派', chama:'茶马司',
      chaoguan:'钞关税', guanshui:'关税(月港)', junhu:'军户屯田',
      fenglu:'俸禄', junxiang:'军饷', zhenzi:'赈济', gongcheng:'工程', jisi:'祭祀',
      shangci:'赏赐', neiting:'内廷转运'
    };
  }
  // tag→中文：静态科目表优先 → 自定义税 stats.name → 剧本 fiscalConfig.customTaxes 名(镜像 tm-guoku-panel.js
  // _resolveTagName 的剧本回落·★同步义务：panel 那段改了这里也要跟着改) → 原始 tag。
  function rightFinanceResolveTagName(tag, customStats){
    var names = rightFinanceTagNames();
    if (names[tag]) return names[tag];
    if (customStats && customStats[tag] && customStats[tag].name) return customStats[tag].name;
    try {
      var sc = (typeof findScenarioById === 'function' && window.GM && GM.sid) ? findScenarioById(GM.sid) : null;
      var cts = (sc && sc.fiscalConfig && sc.fiscalConfig.customTaxes) || [];
      for (var i = 0; i < cts.length; i++) { if (cts[i] && (cts[i].id === tag || cts[i].sourceTag === tag)) return cts[i].name || tag; }
    } catch (_) {}
    return tag;
  }
  function rightFinanceCascadeItems(kind){
    var gm = window.GM || {};
    var g = gm.guoku || (window.P && P.guoku) || {};
    var ledgers = g.ledgers || {};
    var customStats = g._customTaxStats || {};
    var mapKey = kind === 'expense' ? 'sinks' : 'sources';
    var units = [['money','钱'], ['grain','粮'], ['cloth','布']];
    var out = [];
    var seen = {};   // 已从 ledger 枚举出的 tag(去重·防自定义税重复列)
    units.forEach(function(u){
      var led = ledgers[u[0]]; if (!led) return;
      var m = led[mapKey] || {};
      Object.keys(m).forEach(function(tag){
        var v = m[tag]; if (!v) return;
        seen[tag] = true;
        out.push({ name: rightFinanceResolveTagName(tag, customStats) + '·' + u[1], amount: v, note: '本回合结算' });
      });
    });
    // 自定义税：仅补 ledger 未枚举到的(去重)·且统一本回合口径(turnAmount·非年化 amount)——
    //   producer 已把自定义税本回合值写进 ledger.sources[sourceTag]，若无条件追加 _customTaxStats.amount 会
    //   同一税列两行且口径混用(本回合 vs 年化)。realized 税已在 seen 里跳过；未 realized 者 turnAmount=0 略过。
    if (kind !== 'expense') {
      Object.keys(customStats).forEach(function(k){
        if (seen[k]) return;
        var c = customStats[k]; if (!c) return;
        var tv = (c.turnAmount != null) ? c.turnAmount : 0;
        if (!tv) return;
        out.push({ name: (c.name || k) + '·钱', amount: tv, note: '自定义税种' });
      });
    }
    return out;
  }

  function rightFinanceItemList(items, empty){
    if (!items.length) return '<div class="tmrp-empty">' + esc(empty || '暂无明细') + '</div>';
    return items.slice(0, 8).map(function(x){
      return '<div class="tmrp-fin-line"><b>' + esc(x.name || '项目') + '</b><span>' + esc(rightFinanceMoney(x.amount)) + '</span><small>' + esc(compactText(x.note || '', 46)) + '</small></div>';
    }).join('') + (items.length > 8 ? '<div class="tmrp-meta">余 ' + esc(items.length - 8) + ' 项未列。</div>' : '');
  }

  // 失真层S2·据奏取值(键名与顶栏/帑廪panel三面同一·内帑永真值不套·docs/design-reported-view-2026-07.md)
  function rightFiscalReported(key, val, dir){
    var RV = window.TM && TM.ReportedView;
    if (!RV || !RV.active(window.P || null)) return { shown: val, distorted: false };
    return RV.value('fiscal', key, val, { direction: dir, dept: 'fiscal' });
  }
  function renderFinanceRich(){
    var root = rightFinanceRoot();
    var g = root.guoku || {};
    var n = root.neitang || {};
    var f = root.fiscal || {};
    var _rvM = rightFiscalReported('guoku.money', rightFinanceFirst(g, ['stockMoney','money','balance','silver','taicangMoney'], 0), 'good');
    var money = _rvM.shown;
    var grain = rightFiscalReported('guoku.grain', rightFinanceFirst(g, ['stockGrain','grain','grainStock','food'], 0), 'good').shown;
    var cloth = rightFiscalReported('guoku.cloth', rightFinanceFirst(g, ['stockCloth','cloth','clothStock'], ''), 'good').shown;
    var neitang = rightFinanceFirst(n, ['money','balance','silver'], '');
    var income = rightFiscalReported('fiscal.turnIncome', rightFinanceFirst(g, ['turnIncome','monthlyIncome','income','lastIncome'], rightFinanceFirst(f, ['turnIncome','monthlyIncome','income'], 0)), 'good').shown;
    var expense = rightFiscalReported('fiscal.turnExpense', rightFinanceFirst(g, ['turnExpense','monthlyExpense','expense','lastExpense'], rightFinanceFirst(f, ['turnExpense','monthlyExpense','expense'], 0)), 'bad').shown;
    var net = rightAdminNum(income, 0) - rightAdminNum(expense, 0);
    var _casIncome = rightFinanceCascadeItems('income');
    var _casExpense = rightFinanceCascadeItems('expense');
    var incomeFromCascade = _casIncome.length > 0;
    var expenseFromCascade = _casExpense.length > 0;
    var incomeItems = incomeFromCascade ? _casIncome : rightFinanceCollect(['incomeItems','incomes','longTermIncome','recurringIncome','customTaxes','taxes']);
    var expenseItems = expenseFromCascade ? _casExpense : rightFinanceCollect(['expenseItems','expenses','longTermExpense','recurringExpense','fixedExpenses','spendingItems']);
    var _rvBadge = (_rvM.distorted && window.TM && TM.ReportedView) ? TM.ReportedView.badge(_rvM) : '';
    return '<div class="tmrp-finance-shell">' +
      '<div class="tmrp-summary"><div class="tmrp-stat"><b>' + esc(rightFinanceMoney(money)) + '</b><span>太仓银</span></div><div class="tmrp-stat"><b>' + esc(rightFinanceMoney(grain)) + '</b><span>太仓粮</span></div><div class="tmrp-stat"><b>' + esc(rightFinanceMoney(net)) + '</b><span>本期结余</span></div></div>' +
      '<section class="tmrp-card"><div class="tmrp-card-title"><span>库藏' + _rvBadge + '</span><small>国库 / 内帑 / 本回合</small></div>' +
      '<div class="tmrp-mini-grid"><div><span>太仓银</span><b>' + esc(rightFinanceMoney(money)) + '</b></div><div><span>太仓粮</span><b>' + esc(rightFinanceMoney(grain)) + '</b></div><div><span>库存布</span><b>' + esc(rightFinanceMoney(cloth)) + '</b></div><div><span>内帑银</span><b>' + esc(rightFinanceMoney(neitang)) + '</b></div></div></section>' +
      '<section class="tmrp-card ' + (net < 0 ? 'hot' : '') + '"><div class="tmrp-card-title"><span>本期收支</span><small>' + esc(getTurnText(window.GM && GM.turn)) + '</small></div>' +
      rightArmyRows([['本期收入', rightFinanceMoney(income)], ['本期支出', rightFinanceMoney(expense)], ['军饷', rightFinanceMoney(rightFinanceFirst(g, ['armyExpense','militaryExpense'], '待核'))], ['宗禄', rightFinanceMoney(rightFinanceFirst(g, ['royalExpense','clanExpense'], '待核'))]]) +
      '<div class="tmrp-action-row"><button type="button" class="tmrp-btn primary" data-right-action="finance-module">帑廪详情</button><button type="button" class="tmrp-btn" data-right-action="finance-old" data-method="extraTax">加派</button><button type="button" class="tmrp-btn" data-right-action="finance-old" data-method="openGranary">开仓</button><button type="button" class="tmrp-btn" data-right-action="finance-old" data-method="loan">借贷</button><button type="button" class="tmrp-btn" data-right-action="finance-old" data-method="advisor">户部参议</button><button type="button" class="tmrp-btn" data-right-action="finance-edict" data-kind="拨内帑">拨内帑</button><button type="button" class="tmrp-btn" data-right-action="finance-edict" data-kind="核饷">核饷</button><button type="button" class="tmrp-btn" data-right-action="finance-edict" data-kind="清查税粮">清查税粮</button></div></section>' +
      '<section class="tmrp-card"><div class="tmrp-card-title"><span>岁入分项</span><small>' + (incomeItems.length ? esc(incomeItems.length) + ' 项 · ' + (incomeFromCascade ? '本回合级联结算' : '盐课关税田赋等 · (概算)') : '盐课、关税、田赋等') + '</small></div>' + rightFinanceItemList(incomeItems, '暂无岁入分项。') + '</section>' +
      '<section class="tmrp-card"><div class="tmrp-card-title"><span>岁出分项</span><small>' + (expenseItems.length ? esc(expenseItems.length) + ' 项 · ' + (expenseFromCascade ? '本回合级联结算' : '军饷宗禄工程赈济 · (概算)') : '军饷、宗禄、工程、赈济等') + '</small></div>' + rightFinanceItemList(expenseItems, '暂无岁出分项。') + '</section>' +
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
      }).join('') + (filteredWorks.length > 24 ? '<div class="tmrp-meta">余 ' + (filteredWorks.length - 24) + ' 件未列。</div>' : '') + '</div>')) +
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
        '<div class="tmrp-mini-grid"><div><span>职</span><b>' + esc(rightIssuePersonTitle(p)) + '</b></div><div><span>派</span><b>' + esc(rightFactionDisplay(p.faction) || '—') + '</b></div></div></div></section>';
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
          '<div class="tmrp-card-title"><span>' + esc(p.name || key) + '</span><small><i class="tmrp-loy-tag ' + loyClass + '">' + loyTag + '</i> · ' + esc(rightIssuePersonTitle(p)) + (rightFactionDisplay(p.faction) ? ' · ' + esc(rightFactionDisplay(p.faction)) : '') + '</small></div>' +
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
    ol: '阶层与党派',
    issue: '问对与朝议',
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
    var qid = (data && data.qid) || '';   // 稳定 _qid(非 render-time index)
    if (!qid) return;
    closeDeskOverlay();
    closeModule();
    closeRightDrawer();
    if (typeof window._wdOpenAudienceQueue === 'function') {
      window._wdOpenAudienceQueue(qid);
    } else if (typeof _wdOpenAudienceQueue === 'function') {
      _wdOpenAudienceQueue(qid);
    } else {
      toast('待见流程未加载');
    }
    returnFormalHomeSoon();
  }

  function rightDismissWenduiQueue(data){
    var qid = (data && data.qid) || '';   // 稳定 _qid(非 render-time index)
    if (!qid || !window.GM) return;
    if (typeof window._wdDismissPending === 'function') {
      window._wdDismissPending(qid);
    } else if (typeof _wdDismissPending === 'function') {
      _wdDismissPending(qid);
    } else if (typeof window._wdRemovePendingAudience === 'function') {
      window._wdRemovePendingAudience(qid);   // 按 _qid 主键删·非 idx splice
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
      // 失真层S6·核饷=点验名册：揭该军实额(ttl 回合后重蒙尘)·失真层未开则纯面板跳转如旧
      try {
        var RVp = window.TM && TM.ReportedView;
        if (RVp && RVp.active(window.P || null)) {
          RVp.reveal('army', 'soldiers.' + String((army && (army.name || army.id)) || name), 'hexiang');
          toast('核饷点验：' + name + ' 实额已掀见');
          refreshArmyFlyout();
        }
      } catch (e) {}
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
    } else if (cmd === 'appoint') {
      // 易将走既有拜帅弹窗(tm-three-systems-ui·活人候选/防死人守卫)·ret 标记令确认后回刷本飞出层而非旧军务面板
      if (typeof window._tsAppointGeneral === 'function') window._tsAppointGeneral(army.name || name, { ret: 'rightrail' });
      else toast('易将组件未加载');
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
    } else if (action === 'army-tab') {
      state.rightArmyTab = data.tab === 'overview' ? 'overview' : 'roster';   // 默认名册·与 renderArmy 早判镜像
      openPanel('army');
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
        if (typeof TM !== 'undefined' && TM.Qiju) TM.Qiju.recordEntry({
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

  //>>P8RAIL-SPLIT24-PLUMBING-B-START  (reverse：origin→分片·下列 kept 成员均函数声明·已提升·分片经 bucket 捕获)
  __p8R.rightArmyBar = rightArmyBar; __p8R.rightArmyRows = rightArmyRows; __p8R.rightClassDemandByName = rightClassDemandByName; __p8R.rightFindSocialActor = rightFindSocialActor; __p8R.rightIssueNum = rightIssueNum;
  //>>P8RAIL-SPLIT24-PLUMBING-B-END
  // ── public API attach (Wave 3·rightrail panels + dispatch) ──
  bridge.rightrail = bridge.rightrail || {};
  bridge.rightrail.renderers = renderers;
  bridge.rightrail.titles = titles;
  bridge.rightrail.handleRightPanelAction = handleRightPanelAction;
  bridge.rightrail.bindRightPanelActions = bindRightPanelActions;
  bridge.rightrail.pendingAudiences = rightWenduiPendingState;
  bridge.rightrail.rightCloseArmyFlyout = rightCloseArmyFlyout;
  bridge.rightrail.rightOpenArmyFlyout = rightOpenArmyFlyout;
  bridge.rightrail.refreshArmyFlyout = typeof refreshArmyFlyout === "function" ? refreshArmyFlyout : null;
  bridge.rightrail.rightCloseSocialFlyout = rightCloseSocialFlyout;
  bridge.rightrail.rightOpenSocialFlyout = rightOpenSocialFlyout;
  bridge.rightrail.refreshSocialFlyout = typeof refreshSocialFlyout === "function" ? refreshSocialFlyout : null;
})();
