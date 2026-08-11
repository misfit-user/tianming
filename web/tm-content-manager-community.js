// @ts-check
// ═══════════════════════════════════════════════════════════════════════
//  tm-content-manager-community.js — 创意工坊「社区/商城」UI 分片
//  （巨石拆分第二十拆·20260706·自 tm-content-manager.js 行 1222-3112 迁出）
//  内容：§2 M2 护城河(擂台/合集) + §3 M3 轻社交(圈子/共编/约稿/好友/私信/通知) +
//        §4 全屏商城 + §5 史馆动态流 + 账号/创作(发布)/应用更新 弹层 + 「我」页。共 136 个成员。
//
//  【装载序·硬约束】须在 tm-content-manager.js（origin）【之后】装载（index.html 中紧随其后）：
//    origin 装载期已向 bucket TM.__cmParts 导出本片闭包捕获的 origin 成员（下方 var 捕获行·state/render/esc/...），
//    本片再把 §2-§5 函数回填 bucket 供 origin 委托 shim 于调用期解析。
//    错序 = 捕获到 undefined（bucket 未就位）→ 立崩。装载序契约见 scripts/lint-split-contracts.js。
//  onclick 处理器一律经全局 window.TMContentManager（origin 持有的导出对象）路由·与本片闭包无耦合。
// ═══════════════════════════════════════════════════════════════════════
(function(){
  'use strict';
  var __cmP = (function(){ var t = window.TM = window.TM || {}; return t.__cmParts = t.__cmParts || {}; })();
  // ── reverse 捕获：origin 成员（origin 装载期已 __cmP.X=X 导出；本地名与迁出体一致·体内 0 改字节）──
  var PACK_TYPES = __cmP.PACK_TYPES, action = __cmP.action, catalogCardV2 = __cmP.catalogCardV2, checkHotUpdate = __cmP.checkHotUpdate, desktop = __cmP.desktop;
  var downloadUpdate = __cmP.downloadUpdate, ensureStyle = __cmP.ensureStyle, esc = __cmP.esc, formatBytes = __cmP.formatBytes, installHotUpdate = __cmP.installHotUpdate;
  var installUpdate = __cmP.installUpdate, jsArg = __cmP.jsArg, kv = __cmP.kv, loadCatalogUrl = __cmP.loadCatalogUrl, loadFeedUrl = __cmP.loadFeedUrl;
  var loadHotFeedUrl = __cmP.loadHotFeedUrl, loadOnlineApiUrl = __cmP.loadOnlineApiUrl, packRowV2 = __cmP.packRowV2, packTypeLabel = __cmP.packTypeLabel, packTypeNoun = __cmP.packTypeNoun;
  var pill = __cmP.pill, pwField = __cmP.pwField, refreshWebInstalled = __cmP.refreshWebInstalled, reloadAfterHotUpdate = __cmP.reloadAfterHotUpdate, render = __cmP.render;
  var state = __cmP.state, updateInfoSize = __cmP.updateInfoSize;
  //>>CM-SPLIT20-BODY-START
  // ===== M2 护城河：同台竞史(擂台) + 鉴赏家合集 =====
  var ARENA_METRIC = { years: '存续年数', territory: '疆域', minxin: '民心', huangwei: '皇威', treasury: '国库' };
  function loggedInNow() { return !!(window.TM && TM.OnlineClient && TM.OnlineClient.isLoggedIn && TM.OnlineClient.isLoggedIn()); }
  // --- 擂台 ---
  function loadArenas() {
    if (!(window.TM && TM.OnlineClient && TM.OnlineClient.arenas)) {
      state.arenaList = []; state.arenasLoaded = true; state.arenasLoading = false;
      state.arenaStatus = 'error'; state.arenaError = '正式擂台接口未加载'; render(); return;
    }
    state.arenasLoading = true;
    state.arenaStatus = 'loading'; state.arenaError = '';
    TM.OnlineClient.arenas('', state.onlineApiUrl || undefined).then(function(res){
      if (!res || res.success === false) throw new Error((res && res.error) || '正式擂台接口返回失败');
      state.arenaList = Array.isArray(res.arenas) ? res.arenas : []; state.arenasLoaded = true; state.arenasLoading = false;
      state.arenaStatus = 'ok'; state.arenaError = ''; render();
    }).catch(function(error){
      state.arenaList = []; state.arenasLoaded = true; state.arenasLoading = false;
      state.arenaStatus = 'error'; state.arenaError = (error && error.message) || '正式擂台接口不可用'; render();
    });
  }
  function openArena(id) {
    state.arenaOpen = true; state.arenaOpenId = String(id); state.arenaDetail = null; state.arenaMsg = '';
    state.arenaDetailStatus = 'loading'; state.arenaDetailError = ''; render();
    TM.OnlineClient.arenaDetail(id, state.onlineApiUrl || undefined).then(function(res){
      if (!res || res.success === false || !res.arena) throw new Error((res && res.error) || '擂台详情返回无效');
      if (state.arenaOpen && state.arenaOpenId === String(id)) {
        state.arenaDetail = res; state.arenaDetailStatus = 'ok'; state.arenaDetailError = ''; render();
      }
    }).catch(function(error){
      if (!state.arenaOpen || state.arenaOpenId !== String(id)) return;
      state.arenaDetailStatus = 'error'; state.arenaDetailError = (error && error.message) || '擂台详情接口不可用'; render();
    });
  }
  function closeArena() { state.arenaOpen = false; state.arenaOpenId = ''; state.arenaDetail = null; render(); }
  function createArenaUI() {
    if (!loggedInNow()) { state.arenasMsg = '登录后可开擂台。'; render(); return; }
    var t = document.getElementById('tm-arena-title'), m = document.getElementById('tm-arena-metric'), s = document.getElementById('tm-arena-scn');
    var title = t ? t.value.trim() : '';
    if (!title) { state.arenasMsg = '请填写擂台标题。'; render(); return; }
    TM.OnlineClient.createArena({ title: title, metric: m ? m.value : 'years', scenarioId: s ? s.value.trim() : '' }, state.onlineApiUrl || undefined).then(function(res){
      if (res && res.success) { state.arenasMsg = '擂台已开。'; loadArenas(); }
      else { state.arenasMsg = '开擂台失败：' + ((res && res.error) || ''); render(); }
    }).catch(function(){ state.arenasMsg = '开擂台失败。'; render(); });
  }
  function submitArenaUI() {
    if (!loggedInNow()) { state.arenaMsg = '登录后可提交战绩。'; render(); return; }
    var a = state.arenaDetail && state.arenaDetail.arena;
    if (!a) return;
    var sc = document.getElementById('tm-arena-score'), oc = document.getElementById('tm-arena-outcome'), sm = document.getElementById('tm-arena-summary');
    var score = sc ? Number(sc.value) : NaN;
    if (isNaN(score) || (sc && sc.value.trim() === '')) { state.arenaMsg = '请填写成绩数值。'; render(); return; }
    state.arenaMsg = '正在提交…'; render();
    TM.OnlineClient.submitArena({ arenaId: a.id, score: score, outcome: oc ? oc.value.trim() : '', summary: sm ? sm.value.trim() : '' }, state.onlineApiUrl || undefined).then(function(res){
      if (res && res.success) { state.arenaMsg = '战绩已上榜（名次 ' + (res.myRank || '-') + '）。'; openArena(a.id); }
      else { state.arenaMsg = '提交失败：' + ((res && res.error) || ''); render(); }
    }).catch(function(){ state.arenaMsg = '提交失败。'; render(); });
  }
  function renderArenaLayer() {
    if (!state.arenaOpen) return '';
    var d = state.arenaDetail;
    var inner;
    if (!d || !d.arena) {
      inner = state.arenaDetailStatus === 'error'
        ? truthEmpty('擂', '擂台详情不可用', state.arenaDetailError || '无法读取正式擂台详情。')
        : '<div class="empty"><div class="glyph">擂</div><div class="t">正在开擂…</div></div>';
    }
    else {
      var a = d.arena, board = d.leaderboard || [];
      var rows = board.length ? board.map(function(e){
        return '<div class="rk"><div class="n' + (e.rank <= 3 ? ' top' : '') + '">' + esc(String(e.rank)) + '</div>' +
          '<div class="t"><b>' + esc(e.userNick) + (e.outcome ? ' · ' + esc(e.outcome) : '') + '</b>' + (e.summary ? '<small>' + esc(e.summary) + '</small>' : '') + '</div>' +
          '<div style="font-family:var(--serif);color:#f2d487;font-size:15px;">' + esc(String(e.score)) + '</div></div>';
      }).join('') : '<div class="empty"><div class="glyph">擂</div><div class="t">虚位以待</div><div>来交第一份战绩</div></div>';
      inner = '<div class="dmeta"><span>同台竞史 · 比 ' + esc(ARENA_METRIC[a.metric] || a.metric) + '</span>' + (a.scenarioId ? '<span>剧本 ' + esc(a.scenarioId) + '</span>' : '') + '<span>擂主 ' + esc(a.creatorNick) + '</span></div>' +
        (loggedInNow()
          ? '<div class="composer"><div style="display:flex;gap:8px;flex-wrap:wrap;"><input id="tm-arena-score" class="input" style="width:120px;" inputmode="numeric" placeholder="我的成绩"><input id="tm-arena-outcome" class="input" style="width:120px;" placeholder="结局(中兴…)"><input id="tm-arena-summary" class="input" style="flex:1;min-width:160px;" placeholder="一句战报(可选)"></div><div style="display:flex;justify-content:flex-end;margin-top:8px;"><button class="btn primary sm" onclick="TMContentManager.submitArenaUI()">提交战绩</button></div></div>'
          : '<div class="status">登录后可上榜较量。</div>') +
        (state.arenaMsg ? '<div class="status" style="margin:8px 0;">' + esc(state.arenaMsg) + '</div>' : '') +
        '<div class="dsec-h">擂台榜 · ' + board.length + '</div><div class="rail" style="background:rgba(0,0,0,.12);">' + rows + '</div>';
    }
    var atitle = d && d.arena ? d.arena.title : '擂台';
    return '<div class="sheet" role="dialog" aria-modal="true" aria-label="同台竞史" onclick="if(event.target===this)TMContentManager.closeArena()">' +
      '<div class="sheet-box" style="width:min(640px,94%);">' +
        '<div class="sh-head"><b>' + esc(atitle) + '</b><button class="btn sm" style="margin-left:auto;" onclick="TMContentManager.closeArena()">关闭</button></div>' +
        '<div class="sh-body scroll">' + inner + '</div>' +
      '</div></div>';
  }
  // --- 合集 ---
  function loadCollections() {
    if (!(window.TM && TM.OnlineClient && TM.OnlineClient.collections)) {
      state.collectionList = []; state.collectionsLoaded = true; state.collectionsLoading = false;
      state.collectionStatus = 'error'; state.collectionError = '正式合集接口未加载'; render(); return;
    }
    state.collectionsLoading = true;
    state.collectionStatus = 'loading'; state.collectionError = '';
    TM.OnlineClient.collections('', state.onlineApiUrl || undefined).then(function(res){
      if (!res || res.success === false) throw new Error((res && res.error) || '正式合集接口返回失败');
      state.collectionList = Array.isArray(res.collections) ? res.collections : []; state.collectionsLoaded = true; state.collectionsLoading = false;
      state.collectionStatus = 'ok'; state.collectionError = ''; render();
    }).catch(function(error){
      state.collectionList = []; state.collectionsLoaded = true; state.collectionsLoading = false;
      state.collectionStatus = 'error'; state.collectionError = (error && error.message) || '正式合集接口不可用'; render();
    });
  }
  function openCollection(id) {
    state.collectionOpen = true; state.collectionOpenId = String(id); state.collectionDetail = null;
    state.collectionDetailStatus = 'loading'; state.collectionDetailError = ''; render();
    TM.OnlineClient.collectionDetail(id, state.onlineApiUrl || undefined).then(function(res){
      if (!res || res.success === false || !res.collection) throw new Error((res && res.error) || '合集详情返回无效');
      if (state.collectionOpen && state.collectionOpenId === String(id)) {
        state.collectionDetail = res; state.collectionDetailStatus = 'ok'; state.collectionDetailError = ''; render();
      }
    }).catch(function(error){
      if (!state.collectionOpen || state.collectionOpenId !== String(id)) return;
      state.collectionDetailStatus = 'error'; state.collectionDetailError = (error && error.message) || '合集详情接口不可用'; render();
    });
  }
  function closeCollection() { state.collectionOpen = false; state.collectionOpenId = ''; state.collectionDetail = null; render(); }
  function createCollectionUI() {
    if (!loggedInNow()) { state.collectionsMsg = '登录后可建合集。'; render(); return; }
    var t = document.getElementById('tm-col-title'), d = document.getElementById('tm-col-desc');
    var title = t ? t.value.trim() : '';
    if (!title) { state.collectionsMsg = '请填写合集标题。'; render(); return; }
    TM.OnlineClient.createCollection({ title: title, description: d ? d.value.trim() : '' }, state.onlineApiUrl || undefined).then(function(res){
      if (res && res.success) { state.collectionsMsg = '合集已建。'; loadCollections(); }
      else { state.collectionsMsg = '建合集失败：' + ((res && res.error) || ''); render(); }
    }).catch(function(){ state.collectionsMsg = '建合集失败。'; render(); });
  }
  function renderCollectionLayer() {
    if (!state.collectionOpen) return '';
    var d = state.collectionDetail;
    var inner;
    if (!d || !d.collection) {
      inner = state.collectionDetailStatus === 'error'
        ? truthEmpty('集', '合集详情不可用', state.collectionDetailError || '无法读取正式合集详情。')
        : '<div class="empty"><div class="glyph">集</div><div class="t">正在翻阅…</div></div>';
    }
    else {
      var c = d.collection, packs = Array.isArray(d.packs) ? d.packs : [];
      inner = '<div class="dmeta"><span>策展 ' + esc(c.ownerNick || '未署名') + '</span><span>' + (hasMetric(c, 'count') ? esc(String(c.count)) + ' 件' : '件数未提供') + '</span></div>' +
        (c.description ? '<div class="dcopy" style="margin-bottom:10px;">' + esc(c.description) + '</div>' : '') +
        (packs.length ? '<div class="grid">' + packs.map(mallCard).join('') + '</div>' : '<div class="empty"><div class="glyph">集</div><div class="t">合集还空着</div><div>在作品详情点「收入合集」往里加</div></div>');
    }
    var ctitle = d && d.collection ? d.collection.title : '合集';
    return '<div class="sheet" role="dialog" aria-modal="true" aria-label="鉴赏家合集" onclick="if(event.target===this)TMContentManager.closeCollection()">' +
      '<div class="sheet-box" style="width:min(820px,94%);">' +
        '<div class="sh-head"><b>' + esc(ctitle) + '</b><button class="btn sm" style="margin-left:auto;" onclick="TMContentManager.closeCollection()">关闭</button></div>' +
        '<div class="sh-body scroll">' + inner + '</div>' +
      '</div></div>';
  }
  // --- 收入合集（详情入口）---
  function openCollectionPicker(packId) {
    if (!loggedInNow()) { state.catalogMessage = '登录后可收入合集。'; render(); return; }
    state.colPickFor = packId; state.colPickOpen = true; state.colPickMsg = '';
    render();
    if (!state.collectionsLoaded) loadCollections();
  }
  function closeCollectionPicker() { state.colPickOpen = false; render(); }
  function pickCollection(cid) {
    var packId = state.colPickFor;
    if (!packId || !cid) return;
    TM.OnlineClient.collectionItem(cid, packId, 'add', state.onlineApiUrl || undefined).then(function(res){
      state.colPickMsg = res && res.success
        ? ('已收入合集' + (hasMetric(res, 'count') ? '（' + esc(String(res.count)) + ' 件）' : '') + '。')
        : ('收入失败：' + ((res && res.error) || ''));
      render();
    }).catch(function(){ state.colPickMsg = '收入失败。'; render(); });
  }
  function quickCreateCollection() {
    var t = document.getElementById('tm-colpick-new');
    var title = t ? t.value.trim() : '';
    if (!title) { state.colPickMsg = '填个合集名。'; render(); return; }
    TM.OnlineClient.createCollection({ title: title }, state.onlineApiUrl || undefined).then(function(res){
      if (res && res.success && res.collection) { state.collectionsLoaded = false; loadCollections(); pickCollection(res.collection.id); }
      else { state.colPickMsg = '建合集失败。'; render(); }
    }).catch(function(){ state.colPickMsg = '建合集失败。'; render(); });
  }
  function renderCollectionPicker() {
    if (!state.colPickOpen) return '';
    var mine = (state.collectionList || []);
    var rows = mine.length ? mine.map(function(c){
      return '<div class="rk" style="cursor:pointer;" onclick="TMContentManager.pickCollection(' + Number(c.id) + ')"><div class="n">集</div><div class="t"><b>' + esc(c.title || '未命名合集') + '</b><small>' + (hasMetric(c, 'count') ? esc(String(c.count)) + ' 件' : '件数未提供') + ' · ' + esc(c.ownerNick || '未署名') + '</small></div><div style="color:var(--gold);">收入 ›</div></div>';
    }).join('') : (state.collectionsLoading
      ? '<div class="dcopy" style="color:var(--ink-faint);">正在读取正式合集…</div>'
      : (state.collectionStatus === 'error'
        ? '<div class="dcopy" style="color:var(--ink-faint);">合集接口不可用：' + esc(state.collectionError || '读取失败') + '</div>'
        : '<div class="dcopy" style="color:var(--ink-faint);">正式接口返回 0 个合集，可在下面新建一个。</div>'));
    return '<div class="sheet" role="dialog" aria-modal="true" aria-label="收入合集" onclick="if(event.target===this)TMContentManager.closeCollectionPicker()">' +
      '<div class="sheet-box" style="width:min(460px,94%);">' +
        '<div class="sh-head"><b>收入合集</b><button class="btn sm" style="margin-left:auto;" onclick="TMContentManager.closeCollectionPicker()">关闭</button></div>' +
        '<div class="sh-body scroll">' +
          '<div class="rail" style="background:rgba(0,0,0,.12);">' + rows + '</div>' +
          '<div class="orline">或 新建合集</div>' +
          '<div style="display:flex;gap:8px;"><input id="tm-colpick-new" class="input" placeholder="合集名，如「明末入坑五部曲」"><button class="btn primary" onclick="TMContentManager.quickCreateCollection()">建并收入</button></div>' +
          (state.colPickMsg ? '<div class="status" style="margin-top:8px;">' + esc(state.colPickMsg) + '</div>' : '') +
        '</div>' +
      '</div></div>';
  }

  // ===== M3：轻圈子 + 共编 + 约稿 =====
  function selfId() { var u = (state.accountSession && state.accountSession.user); return u && u.id != null ? u.id : null; }
  var COMM_KIND = { portrait: '立绘', music: '配乐', scenario: '剧本', other: '其他' };
  // --- 圈子 ---
  function loadCircles() {
    if (!(window.TM && TM.OnlineClient && TM.OnlineClient.circles)) {
      state.circleList = []; state.circlesLoaded = true; state.circlesLoading = false;
      state.circleStatus = 'error'; state.circleError = '正式圈子接口未加载'; render(); return;
    }
    state.circlesLoading = true;
    state.circleStatus = 'loading'; state.circleError = '';
    TM.OnlineClient.circles(state.onlineApiUrl || undefined).then(function(res){
      if (!res || res.success === false) throw new Error((res && res.error) || '正式圈子接口返回失败');
      state.circleList = Array.isArray(res.circles) ? res.circles : []; state.circlesLoaded = true; state.circlesLoading = false;
      state.circleStatus = 'ok'; state.circleError = ''; render();
    }).catch(function(error){
      state.circleList = []; state.circlesLoaded = true; state.circlesLoading = false;
      state.circleStatus = 'error'; state.circleError = (error && error.message) || '正式圈子接口不可用'; render();
    });
  }
  function createCircleUI() {
    if (!loggedInNow()) { state.circlesMsg = '登录后可建圈。'; render(); return; }
    var n = document.getElementById('tm-circle-name'), tp = document.getElementById('tm-circle-topic');
    var name = n ? n.value.trim() : '';
    if (!name) { state.circlesMsg = '请填圈名。'; render(); return; }
    TM.OnlineClient.createCircle({ name: name, topic: tp ? tp.value.trim() : '' }, state.onlineApiUrl || undefined).then(function(res){
      if (res && res.success) { state.circlesMsg = '圈子已建。'; state.circlesLoaded = false; loadCircles(); }
      else { state.circlesMsg = '建圈失败：' + ((res && res.error) || ''); render(); }
    }).catch(function(){ state.circlesMsg = '建圈失败。'; render(); });
  }
  function toggleCircleJoin(cid, leave) {
    if (!loggedInNow()) { state.circleMsg = '登录后可加入。'; render(); return; }
    TM.OnlineClient.joinCircle(cid, leave ? 'leave' : 'join', state.onlineApiUrl || undefined).then(function(res){
      if (res && res.success) { state.circlesLoaded = false; loadCircles(); if (state.circleOpen) openCircle(cid); }
      else { state.circleMsg = (res && res.error) || '操作失败'; render(); }
    }).catch(function(e){ state.circleMsg = '操作失败：' + (e && e.message || '网络错误'); render(); });
  }
  function openCircle(id) {
    state.circleOpen = true; state.circleOpenId = String(id); state.circleDetailData = null; state.circleFeedData = null; state.circleMsg = '';
    state.circleDetailStatus = 'loading'; state.circleDetailError = '';
    state.circleFeedStatus = 'loading'; state.circleFeedError = ''; render();
    TM.OnlineClient.circleDetail(id, state.onlineApiUrl || undefined).then(function(res){
      if (!res || res.success === false || !res.circle) throw new Error((res && res.error) || '圈子详情返回无效');
      if (state.circleOpen && state.circleOpenId === String(id)) { state.circleDetailData = res; state.circleDetailStatus = 'ok'; state.circleDetailError = ''; render(); }
    }).catch(function(error){
      if (!state.circleOpen || state.circleOpenId !== String(id)) return;
      state.circleDetailStatus = 'error'; state.circleDetailError = (error && error.message) || '圈子详情接口不可用'; render();
    });
    TM.OnlineClient.circleFeed(id, 1, state.onlineApiUrl || undefined).then(function(res){
      if (!res || res.success === false) throw new Error((res && res.error) || '圈内动态返回无效');
      if (state.circleOpen && state.circleOpenId === String(id)) { state.circleFeedData = Array.isArray(res.posts) ? res.posts : []; state.circleFeedStatus = 'ok'; state.circleFeedError = ''; render(); }
    }).catch(function(error){
      if (!state.circleOpen || state.circleOpenId !== String(id)) return;
      state.circleFeedStatus = 'error'; state.circleFeedError = (error && error.message) || '圈内动态接口不可用'; render();
    });
  }
  function closeCircle() { state.circleOpen = false; state.circleOpenId = ''; state.circleDetailData = null; render(); }
  function postToCircle() {
    var c = state.circleDetailData && state.circleDetailData.circle;
    if (!c) return;
    if (!loggedInNow()) { state.circleMsg = '登录后可发帖。'; render(); return; }
    var ta = document.getElementById('tm-circle-post');
    var body = ta ? ta.value.trim() : '';
    if (!body) { state.circleMsg = '写点什么。'; render(); return; }
    state.circleMsg = '正在发布…'; render();
    TM.OnlineClient.postFeed({ type: 'highlight', body: body, circleId: c.id }, state.onlineApiUrl || undefined).then(function(res){
      if (res && res.success) { state.circleMsg = '已在圈内发布。'; openCircle(c.id); }
      else { state.circleMsg = '发布失败：' + ((res && res.error) || ''); render(); }
    }).catch(function(){ state.circleMsg = '发布失败。'; render(); });
  }
  function renderCirclesPane() {
    if (!state.circlesLoaded && !state.circlesLoading) { try { setTimeout(loadCircles, 0); } catch (e) {} }
    var cols = state.circleList || [];
    var cards = cols.length ? cols.map(function(c){
      return '<div class="card" style="cursor:pointer;" onclick="TMContentManager.openCircle(' + Number(c.id) + ')"><div class="pad">' +
        '<h4>' + esc(c.name) + (c.topic ? ' <span class="tag">' + esc(c.topic) + '</span>' : '') + '</h4>' +
        '<div class="au">圈主 ' + esc(c.ownerNick || '未署名') + ' · ' + (hasMetric(c, 'members') ? esc(String(c.members)) + ' 人' : '人数未提供') + '</div>' +
        '<div class="rt"><span>' + (c.joined ? '已加入' : '点进去看看') + '</span><span style="color:var(--gold);">进圈 ›</span></div></div></div>';
    }).join('') : (state.circlesLoading ? mallSkeleton(3) : (state.circleStatus === 'error'
      ? truthEmpty('圈', '正式圈子接口不可用', state.circleError || '无法读取正式圈子。')
      : truthEmpty('圈', '正式圈子当前为空', '接口返回 0 个圈子；可登录后创建第一个。')));
    var creator = loggedInNow()
      ? '<div class="composer" style="margin-bottom:14px;"><div style="display:flex;gap:8px;flex-wrap:wrap;">' +
          '<input id="tm-circle-name" class="input" style="flex:1;min-width:160px;" placeholder="圈名，如「明末研究会」">' +
          '<input id="tm-circle-topic" class="input" style="width:130px;" placeholder="话题(可选)">' +
          '<button class="btn primary sm" onclick="TMContentManager.createCircleUI()">建圈</button></div></div>'
      : '<div class="status" style="margin-bottom:12px;">登录后可建圈、加入、圈内发帖。到「我」登录。</div>';
    return '<div class="sec-h"><h3>同好圈子</h3></div>' +
      (state.circlesMsg ? '<div class="status" style="margin-bottom:10px;">' + esc(state.circlesMsg) + '</div>' : '') +
      creator + '<div class="grid" style="grid-template-columns:repeat(3,minmax(0,1fr));">' + cards + '</div>';
  }
  function renderCircleLayer() {
    if (!state.circleOpen) return '';
    var d = state.circleDetailData, inner;
    if (!d || !d.circle) {
      inner = state.circleDetailStatus === 'error'
        ? truthEmpty('圈', '圈子详情不可用', state.circleDetailError || '无法读取正式圈子详情。')
        : '<div class="empty"><div class="glyph">圈</div><div class="t">正在进圈…</div></div>';
    }
    else {
      var c = d.circle;
      var isOwner = c.ownerId != null && String(c.ownerId) === String(selfId());
      var joinBtn = loggedInNow() ? (isOwner ? '<span class="tag">圈主</span>' : (c.joined ? '<button class="btn sm" onclick="TMContentManager.toggleCircleJoin(' + Number(c.id) + ',true)">退出</button>' : '<button class="btn sm primary" onclick="TMContentManager.toggleCircleJoin(' + Number(c.id) + ',false)">加入圈子</button>')) : '';
      var posts = state.circleFeedData || [];
      var feed = posts.length ? posts.map(feedCard).join('') : (state.circleFeedStatus === 'error'
        ? truthEmpty('邸', '圈内动态不可用', state.circleFeedError || '无法读取正式圈内动态。')
        : (state.circleFeedStatus === 'loading'
          ? '<div class="empty"><div class="glyph">邸</div><div class="t">正在读取圈内动态…</div></div>'
          : truthEmpty('邸', '圈内还没动静', '正式接口返回 0 条圈内动态。')));
      var composer = (loggedInNow() && c.joined) ? '<div class="composer"><textarea id="tm-circle-post" class="input" rows="2" placeholder="在「' + esc(c.name) + '」发点什么…"></textarea><div style="display:flex;justify-content:flex-end;margin-top:8px;"><button class="btn primary sm" onclick="TMContentManager.postToCircle()">圈内发布</button></div></div>' : (loggedInNow() ? '<div class="status">加入后可在圈内发帖。</div>' : '');
      inner = '<div class="dmeta"><span>' + (c.topic ? esc(c.topic) + ' · ' : '') + '圈主 ' + esc(c.ownerNick || '未署名') + '</span><span>' + (hasMetric(c, 'members') ? esc(String(c.members)) + ' 人' : '人数未提供') + '</span>' + joinBtn + '</div>' +
        (c.description ? '<div class="dcopy" style="margin-bottom:10px;">' + esc(c.description) + '</div>' : '') +
        composer + (state.circleMsg ? '<div class="status" style="margin:8px 0;">' + esc(state.circleMsg) + '</div>' : '') +
        '<div class="dsec-h">圈内动态' + (state.circleFeedStatus === 'ok' ? ' · ' + posts.length : '') + '</div><div class="feed-list">' + feed + '</div>';
    }
    var ctitle = d && d.circle ? d.circle.name : '圈子';
    return '<div class="sheet" role="dialog" aria-modal="true" aria-label="同好圈子" onclick="if(event.target===this)TMContentManager.closeCircle()">' +
      '<div class="sheet-box" style="width:min(680px,94%);">' +
        '<div class="sh-head"><b>' + esc(ctitle) + '</b><button class="btn sm" style="margin-left:auto;" onclick="TMContentManager.closeCircle()">关闭</button></div>' +
        '<div class="sh-body scroll">' + inner + '</div>' +
      '</div></div>';
  }
  // --- 共编（详情内修订）---
  function loadRevisions(packId) {
    if (!(window.TM && TM.OnlineClient && TM.OnlineClient.revisions)) {
      state.detailRevisions = []; state.revisionStatus = 'error'; state.revisionError = '正式修订接口未加载'; render(); return;
    }
    state.revisionStatus = 'loading'; state.revisionError = '';
    TM.OnlineClient.revisions(packId, state.onlineApiUrl || undefined).then(function(res){
      if (!res || res.success === false || !Array.isArray(res.revisions)) throw new Error((res && res.error) || '正式修订接口返回无效');
      if (state.detailOpen && state.detailPack && String(state.detailPack.id) === String(packId)) {
        state.detailRevisions = res.revisions; state.revisionStatus = 'ok'; state.revisionError = ''; render();
      }
    }).catch(function(error){
      if (!state.detailOpen || !state.detailPack || String(state.detailPack.id) !== String(packId)) return;
      state.detailRevisions = []; state.revisionStatus = 'error'; state.revisionError = (error && error.message) || '正式修订接口不可用'; render();
    });
  }
  function proposeRevisionUI() {
    if (!loggedInNow()) { state.revMsg = '登录后可提修订。'; render(); return; }
    var p = state.detailPack; if (!p) return;
    var ta = document.getElementById('tm-rev-note');
    var note = ta ? ta.value.trim() : '';
    if (!note) { state.revMsg = '写下修订建议。'; render(); return; }
    state.revMsg = '正在提交…'; render();
    TM.OnlineClient.proposeRevision({ packId: p.id, note: note }, state.onlineApiUrl || undefined).then(function(res){
      if (res && res.success) { state.revMsg = '修订已提交，等作者处理。'; loadRevisions(p.id); }
      else { state.revMsg = '提交失败：' + ((res && res.error) || ''); render(); }
    }).catch(function(){ state.revMsg = '提交失败。'; render(); });
  }
  function respondRevisionUI(rid, action) {
    TM.OnlineClient.respondRevision(rid, action, state.onlineApiUrl || undefined).then(function(res){
      if (res && res.success && state.detailPack) { state.revMsg = action === 'accept' ? '已采纳此修订。' : '已婉拒此修订。'; loadRevisions(state.detailPack.id); }
      else { state.revMsg = (res && res.error) || '操作失败'; render(); }
    }).catch(function(e){ state.revMsg = '操作失败：' + (e && e.message || '网络错误'); render(); });
  }
  function renderRevisionSection() {
    var p = state.detailPack; if (!p) return '';
    var revs = state.detailRevisions || [];
    var isAuthor = p.authorId != null && String(p.authorId) === String(selfId());
    var rows = revs.length ? revs.map(function(r){
      var st = r.status === 'accepted' ? '<span class="pill good">已采纳</span>' : (r.status === 'rejected' ? '<span class="pill bad">已婉拒</span>' : '<span class="pill">待处理</span>');
      var act = (isAuthor && r.status === 'open') ? '<div class="dacts" style="margin-top:6px;"><button class="btn sm primary" onclick="TMContentManager.respondRevisionUI(' + Number(r.id) + ',\'accept\')">采纳</button><button class="btn sm" onclick="TMContentManager.respondRevisionUI(' + Number(r.id) + ',\'reject\')">婉拒</button></div>' : '';
      return '<div class="chron"><div><b>' + esc(r.proposerNick) + '</b> ' + st + '</div><div class="dcopy" style="margin-top:4px;">' + esc(r.note) + '</div>' + act + '</div>';
    }).join('') : (state.revisionStatus === 'error'
      ? '<div class="dcopy" style="color:var(--ink-faint);">修订接口不可用：' + esc(state.revisionError || '读取失败') + '</div>'
      : (state.revisionStatus === 'loading'
        ? '<div class="dcopy" style="color:var(--ink-faint);">正在读取正式修订…</div>'
        : '<div class="dcopy" style="color:var(--ink-faint);">正式接口返回 0 条修订提案。</div>'));
    var form = loggedInNow() ? '<div class="field" style="margin-top:8px;"><textarea id="tm-rev-note" class="input" rows="2" placeholder="给作者提个修订建议（如：把某事件触发条件放宽）…"></textarea></div><div style="margin:6px 0;"><button class="btn sm" onclick="TMContentManager.proposeRevisionUI()">提交修订</button></div>' : '<div class="dcopy">登录后可提修订。</div>';
    return '<div class="dsec-h">共编修订' + (state.revisionStatus === 'ok' ? ' · ' + revs.length : '') + '</div>' +
      (state.revMsg ? '<div class="status" style="margin-bottom:6px;">' + esc(state.revMsg) + '</div>' : '') +
      form + rows;
  }
  // --- 约稿墙 ---
  function loadCommissions() {
    if (!(window.TM && TM.OnlineClient && TM.OnlineClient.commissions)) {
      state.commissionList = []; state.commissionsLoaded = true; state.commissionsLoading = false;
      state.commissionStatus = 'error'; state.commissionError = '正式约稿接口未加载'; render(); return;
    }
    state.commissionsLoading = true;
    state.commissionStatus = 'loading'; state.commissionError = '';
    TM.OnlineClient.commissions(state.onlineApiUrl || undefined).then(function(res){
      if (!res || res.success === false) throw new Error((res && res.error) || '正式约稿接口返回失败');
      state.commissionList = Array.isArray(res.commissions) ? res.commissions : []; state.commissionsLoaded = true; state.commissionsLoading = false;
      state.commissionStatus = 'ok'; state.commissionError = ''; render();
    }).catch(function(error){
      state.commissionList = []; state.commissionsLoaded = true; state.commissionsLoading = false;
      state.commissionStatus = 'error'; state.commissionError = (error && error.message) || '正式约稿接口不可用'; render();
    });
  }
  function postCommissionUI() {
    if (!loggedInNow()) { state.commMsg = '登录后可发约稿。'; render(); return; }
    var t = document.getElementById('tm-comm-title'), k = document.getElementById('tm-comm-kind'), d = document.getElementById('tm-comm-detail');
    var title = t ? t.value.trim() : '';
    if (!title) { state.commMsg = '填个约稿标题。'; render(); return; }
    TM.OnlineClient.postCommission({ title: title, kind: k ? k.value : 'portrait', detail: d ? d.value.trim() : '' }, state.onlineApiUrl || undefined).then(function(res){
      if (res && res.success) { state.commMsg = '约稿已发布。'; loadCommissions(); }
      else { state.commMsg = '发布失败：' + ((res && res.error) || ''); render(); }
    }).catch(function(){ state.commMsg = '发布失败。'; render(); });
  }
  function closeCommissionUI(id) {
    TM.OnlineClient.closeCommission(id, state.onlineApiUrl || undefined).then(function(res){
      if (res && res.success) { state.commMsg = '已关闭约稿。'; loadCommissions(); } else { render(); }
    }).catch(function(e){ state.commMsg = '操作失败：' + (e && e.message || '网络错误'); render(); });
  }
  function renderCommissionSection() {
    if (!state.commissionsLoaded && !state.commissionsLoading) { try { setTimeout(loadCommissions, 0); } catch (e) {} }
    var list = state.commissionList || [];
    var mine = selfId();
    var rows = list.length ? list.map(function(c){
      var canDm = loggedInNow() && String(c.requesterId) !== String(mine);
      var isMine = String(c.requesterId) === String(mine);
      return '<div class="upd-row"><div class="ic-up" style="font-family:var(--serif);">' + esc((COMM_KIND[c.kind] || '稿').charAt(0)) + '</div>' +
        '<div><b>' + esc(c.title) + ' <span class="tag">' + esc(COMM_KIND[c.kind] || c.kind) + '</span></b><small>' + esc(c.requesterNick) + (c.detail ? ' · ' + esc(c.detail) : '') + '</small></div>' +
        '<div style="display:flex;gap:6px;">' + (canDm ? '<button class="btn sm primary" onclick="TMContentManager.openDm(' + Number(c.requesterId) + ', ' + jsArg(c.requesterNick || '') + ')">接单私信</button>' : '') + (isMine ? '<button class="btn sm" onclick="TMContentManager.closeCommissionUI(' + Number(c.id) + ')">关闭</button>' : '') + '</div></div>';
    }).join('') : (state.commissionsLoading ? mallSkeleton(3) : (state.commissionStatus === 'error'
      ? truthEmpty('稿', '正式约稿接口不可用', state.commissionError || '无法读取正式约稿。')
      : truthEmpty('稿', '正式约稿当前为空', '接口返回 0 条约稿；可登录后发布第一条。')));
    var form = loggedInNow()
      ? '<div class="composer" style="margin-bottom:14px;"><div style="display:flex;gap:8px;flex-wrap:wrap;">' +
          '<input id="tm-comm-title" class="input" style="flex:1;min-width:180px;" placeholder="约稿标题，如「求一套崇祯朝立绘」">' +
          '<select id="tm-comm-kind" class="input" style="width:110px;">' + Object.keys(COMM_KIND).map(function(k){ return '<option value="' + k + '">' + COMM_KIND[k] + '</option>'; }).join('') + '</select>' +
          '<input id="tm-comm-detail" class="input" style="flex:1;min-width:160px;" placeholder="需求细节(可选)">' +
          '<button class="btn primary sm" onclick="TMContentManager.postCommissionUI()">发约稿</button></div></div>'
      : '';
    return '<div class="sec-h"><h3>约稿墙 · 求贤</h3><span class="more">只撮合 · 私信接单</span></div>' +
      (state.commMsg ? '<div class="status" style="margin-bottom:10px;">' + esc(state.commMsg) + '</div>' : '') +
      form + rows;
  }

  function webInstalledRow(rec) {
    var upd = (state.workshopUpdates || {})[rec.packId];
    var badge = upd ? '<span style="border:1px solid #7ec98b;color:#7ec98b;font-size:0.7rem;padding:.05rem .3rem;margin-left:.4rem;">有新版 ' + esc(upd.to) + '</span>' : '';
    // 批Ⅴ·资产包记录带类型签（音乐/立绘/地图等·与剧本同列管理·同卸载同更新）
    if (rec.kind === 'asset') badge = '<span style="border:1px solid var(--gold-d,#8a6d2b);color:var(--gold,#c9a85f);font-size:0.7rem;padding:.05rem .3rem;margin-left:.4rem;">' + esc(({ portrait: '立绘包', music: '音乐包', map: '地图包', mod: 'MOD' })[rec.type] || rec.type || '资产包') + '</span>' + badge;
    return '<div class="tm-pack">' +
      '<div>' +
        '<div class="tm-pack-title">' + esc(rec.title || rec.packId) + badge + '</div>' +
        '<div class="tm-pack-meta">' + esc(rec.packId) + ' / ' + (rec.version ? 'v' + esc(rec.version) : '版本未提供') + '</div>' +
      '</div>' +
      '<div class="tm-actions" style="margin-top:0;justify-content:flex-end;">' +
        (upd ? action('更新到 ' + upd.to, 'TMContentManager.updateWorkshopPack(' + jsArg(rec.packId) + ')', 'primary') : '') +
        action('卸载', 'TMContentManager.uninstallWebPack(' + jsArg(rec.packId) + ')', 'danger') +
      '</div>' +
    '</div>';
  }

  function renderLocalWorkshopSection() {
    if (desktop()) {
      var localRows = state.packs.length ? state.packs.map(packRowV2).join('') : '<div class="tm-empty">尚未安装创意工坊内容包。</div>';
      return '<section class="tm-panel" style="margin-top:.8rem;">' +
        '<h4>本地工坊</h4>' +
        '<div class="tm-copy">本地工坊承接玩家手动导入的 .tm-pack、zip 或单个剧本 JSON。启用的剧本包会在开局前并入剧本列表，停用后不再参与。</div>' +
        '<div class="tm-actions">' +
          action('导入工坊包', 'TMContentManager.importPack()', 'primary') +
          action('刷新列表', 'TMContentManager.refreshPacks()') +
          action('打开目录', 'TMContentManager.openWorkshopDir()') +
          action('包格式说明', 'TMContentManager.openFormatDoc()') +
        '</div>' +
        '<div class="tm-pack-list">' + localRows + '</div>' +
      '</section>';
    }
    var recs = state.webInstalled || [];
    var rows = recs.length ? recs.map(webInstalledRow).join('') : '<div class="tm-empty">尚未安装工坊剧本。从右侧在线目录安装。</div>';
    return '<section class="tm-panel" style="margin-top:.8rem;">' +
      '<h4>已装工坊剧本</h4>' +
      '<div class="tm-copy">从在线工坊安装的剧本（存于浏览器，开局前并入剧本列表）。点「检查更新」可在作者发布新版后更新到最新。</div>' +
      '<div class="tm-actions">' +
        action('检查更新', 'TMContentManager.checkWorkshopUpdates()', 'primary') +
      '</div>' +
      '<div class="tm-pack-list">' + rows + '</div>' +
    '</section>';
  }

  function renderWorkshopTabV2() {
    var c = state.catalog || {};
    var user = state.accountSession && state.accountSession.user;
    var authorBack = state.catalogAuthorView ? '<div style="margin:.2rem 0 .5rem;"><span onclick="TMContentManager.loadWorkshopCatalog()" style="color:var(--gold,#d8b56a);cursor:pointer;text-decoration:underline;font-size:.78rem;">← 返回全部目录</span></div>' : '';
    var allPacks = c.packs || [];
    var ctype = state.catalogType || '';
    var featuredOn = !!state.featuredOn;
    var basePacks = featuredOn ? (state.featuredPacks || []) : allPacks;
    var shown = (!featuredOn && ctype) ? basePacks.filter(function(pp){ return String(pp.type || 'scenario') === ctype; }) : basePacks;
    var cards = shown.length ? shown.map(catalogCardV2).join('')
      : (featuredOn ? '<div class="tm-empty" style="grid-column:1/-1;">还没有被社区推荐的内容。在详情页点「✦ 推荐」即可助其入选。</div>'
        : (allPacks.length ? '<div class="tm-empty" style="grid-column:1/-1;">此类型下暂无内容。</div>'
          : '<div class="tm-empty" style="grid-column:1/-1;">尚未载入在线目录。点「刷新 / 搜索」从官方目录浏览并安装。</div>'));
    var featuredChip = '<span class="tm-typechip' + (featuredOn ? ' on' : '') + '" onclick="TMContentManager.toggleFeatured()">✦ 社区精选</span>';
    var typeChips = featuredChip + PACK_TYPES.map(function(t){
      var n = t.v ? allPacks.filter(function(pp){ return String(pp.type || 'scenario') === t.v; }).length : allPacks.length;
      return '<span class="tm-typechip' + (!featuredOn && ctype === t.v ? ' on' : '') + '" onclick="TMContentManager.switchCatalogType(' + jsArg(t.v) + ')">' + esc(t.label) + (allPacks.length ? ' ' + n : '') + '</span>';
    }).join('');
    var sortSel = '<select class="tm-input" id="tm-workshop-sort" style="width:auto;min-width:118px;" onchange="TMContentManager.loadWorkshopCatalog()">' +
      '<option value="new"' + (state.catalogSort === 'new' || !state.catalogSort ? ' selected' : '') + '>最新</option>' +
      '<option value="hot"' + (state.catalogSort === 'hot' ? ' selected' : '') + '>最热（下载）</option>' +
      '<option value="rating"' + (state.catalogSort === 'rating' ? ' selected' : '') + '>评分最高</option>' +
    '</select>';
    return '' +
      '<section class="tm-panel">' +
        '<h4>创意工坊 · 在线目录</h4>' +
        '<div class="tm-store-bar">' +
          '<div class="tm-store-search"><input class="tm-input" id="tm-workshop-q" value="' + esc(state.catalogQuery || '') + '" placeholder="搜剧本 / 作者 / 标签…" onkeydown="if(event.key===\'Enter\')TMContentManager.loadWorkshopCatalog()"></div>' +
          sortSel +
          action('刷新 / 搜索', 'TMContentManager.loadWorkshopCatalog()', 'primary') +
        '</div>' +
        '<details class="tm-copy" style="margin-top:.5rem;"><summary style="cursor:pointer;color:var(--gold);font-size:.72rem;">目录地址（高级）</summary><div class="tm-field" style="margin-top:.4rem;"><input class="tm-input" id="tm-workshop-catalog" value="' + esc(state.catalogUrl || state.defaultCatalogUrl || '') + '" placeholder="https://example.com/tianming/workshop/catalog.json"></div></details>' +
        '<div class="tm-status" role="status" aria-live="polite">' + esc(state.catalogMessage || (c.title ? (c.title + (c.updatedAt ? ' / ' + c.updatedAt : '')) : '尚未载入在线工坊目录。')) + '</div>' +
        '<div class="tm-typebar">' + typeChips + '</div>' +
        authorBack +
        '<div class="tm-cat-grid">' + cards + '</div>' +
      '</section>' +
      renderLocalWorkshopSection() +
      (desktop() ? renderUrlPublishSection(user) : renderWebPublishSection(user));
  }

  function publishStatusHtml(user) {
    return '<div class="tm-status ' + (state.publishMessage && /失败|错误|请先/.test(state.publishMessage) ? 'warn' : '') + '" role="status" aria-live="polite">' + esc(state.publishMessage || (user ? '当前作者：' + (user.nickname || user.username) : '请先登录账号。')) + '</div>';
  }

  // 桌面端：登记一个已自托管的 .tm-pack URL（服务器只存元数据 + 地址）。
  function renderUrlPublishSection(user) {
    return '' +
      '<section class="tm-panel" style="margin-top:.8rem;">' +
        '<h4>发布到在线工坊</h4>' +
        '<div class="tm-copy">登记发布：作者登录后，提交已经托管好的 .tm-pack 下载地址、哈希和说明，服务器会登记到在线目录（经审核后上架）。</div>' +
        '<div class="tm-grid-2" style="margin-top:.7rem;">' +
          '<div>' +
            '<div class="tm-field"><label for="tm-publish-title">标题</label><input class="tm-input" id="tm-publish-title" placeholder="例如：天启朝边镇扩展包"></div>' +
            '<div class="tm-field"><label for="tm-publish-url">工坊包 HTTPS 地址</label><input class="tm-input" id="tm-publish-url" placeholder="https://.../example.tm-pack"></div>' +
            '<div class="tm-field"><label for="tm-publish-sha">SHA256（可选但建议填写）</label><input class="tm-input" id="tm-publish-sha" placeholder="用于玩家下载后校验"></div>' +
          '</div>' +
          '<div>' +
            '<div class="tm-field"><label for="tm-publish-version">版本</label><input class="tm-input" id="tm-publish-version" value="1.0.0"></div>' +
            '<div class="tm-field"><label for="tm-publish-tags">标签</label><input class="tm-input" id="tm-publish-tags" placeholder="剧本 明末 地图"></div>' +
            '<div class="tm-field"><label for="tm-publish-desc">简介</label><input class="tm-input" id="tm-publish-desc" placeholder="给玩家看的简短说明"></div>' +
          '</div>' +
        '</div>' +
        '<div class="tm-actions">' +
          action(user ? '登记发布' : '登录后发布', 'TMContentManager.publishWorkshopPack()', 'primary', !user) +
          action('刷新在线目录', 'TMContentManager.loadWorkshopCatalog()') +
        '</div>' +
        publishStatusHtml(user) +
      '</section>';
  }

  // 网页：从玩家自己的剧本库选一个纯文本剧本，上传到工坊（服务器自持 -> 待审）。
  function renderWebPublishSection(user) {
    var pt = state.pubType || 'scenario';
    var scns = (window.P && Array.isArray(P.scenarios)) ? P.scenarios : [];
    var opts = scns.map(function(s){
      return '<option value="' + esc(s.id) + '">' + esc((s.name || s.id) + (s.era ? '（' + s.era + '）' : '')) + '</option>';
    }).join('') || '<option value="">（剧本库为空）</option>';
    var typeSel = '<div class="tm-field"><label for="tm-pub-type">内容类型</label><select class="tm-input" id="tm-pub-type" onchange="TMContentManager.switchPubType(this.value)">' +
      PACK_TYPES.filter(function(t){ return t.v; }).map(function(t){ return '<option value="' + t.v + '"' + (pt === t.v ? ' selected' : '') + '>' + esc(t.label) + '</option>'; }).join('') +
    '</select></div>';
    var isScn = pt === 'scenario';
    var copy = isScn
      ? '从你的剧本库选择一个剧本上传（纯文本 JSON）。审核通过后，其他玩家即可浏览安装。'
      : '选择多个' + (pt === 'portrait' ? '立绘图片（PNG）' : (pt === 'music' ? '音频文件（OGG/MP3）' : '资源文件')) + '，浏览器内打包成 zip 上传，审核通过后上架。含真人 / 版权素材将被驳回。';
    var leftBody = isScn
      ? '<div class="tm-field"><label for="tm-webpub-scn">选择剧本</label><select class="tm-input" id="tm-webpub-scn">' + opts + '</select></div>'
      : '<div class="tm-field"><label for="tm-asset-files">资源文件（可多选）</label><input class="tm-input" type="file" id="tm-asset-files" multiple accept="' + (pt === 'portrait' ? 'image/*' : (pt === 'music' ? 'audio/*' : '*/*')) + '" onchange="TMContentManager.onAssetFiles(this)"><div class="tm-pack-meta" id="tm-asset-count">未选择文件</div></div>';
    var submitCall = isScn ? 'TMContentManager.webPublishScenario()' : 'TMContentManager.webPublishAssetPack()';
    return '' +
      '<section class="tm-panel" style="margin-top:.8rem;">' +
        '<h4>发布到在线工坊</h4>' +
        '<div class="tm-copy">' + copy + '</div>' +
        (isScn && state.forkSource && state.forkSource.id
          ? '<div class="tm-status" role="status">改编自「' + esc(state.forkSource.title || state.forkSource.id) + '」，发布后会记入它的世界线。 <span class="tm-fork-from" onclick="TMContentManager.clearFork()">取消改编</span></div>'
          : '') +
        (isScn
          ? '<div class="tm-aicreate">' +
              '<div class="tm-aicreate-h">✨ AI 共创起草</div>' +
              '<div class="tm-copy">一句话描述你想要的剧本，让演绎脑起草骨架；生成后载入剧本库，确认即可发布。</div>' +
              '<div class="tm-field" style="margin-top:.4rem;"><textarea class="tm-input" id="tm-ai-prompt" rows="2" placeholder="例如：靖康之变后，赵构在临安重建朝廷，权臣环伺、金兵压境…"></textarea></div>' +
              '<div class="tm-actions"><button class="tm-action primary" onclick="TMContentManager.aiDraftScenario()">生成草稿</button></div>' +
              (state.aiDraftMsg ? '<div class="tm-status ' + (/失败|未|请/.test(state.aiDraftMsg) ? 'warn' : '') + '" role="status" aria-live="polite">' + esc(state.aiDraftMsg) + '</div>' : '') +
              (state.aiDraft ? '<div class="tm-aidraft"><b>' + esc(state.aiDraft.name || '草稿') + '</b><div class="tm-copy" style="margin-top:.2rem;">' + esc(state.aiDraft.overview || state.aiDraft.background || '') + '</div><div class="tm-actions"><button class="tm-action primary" onclick="TMContentManager.useAiDraft()">用此草稿发布</button></div></div>' : '') +
            '</div>'
          : '') +
        '<div class="tm-grid-2" style="margin-top:.7rem;">' +
          '<div>' +
            typeSel +
            leftBody +
            '<div class="tm-field"><label for="tm-webpub-title">标题</label><input class="tm-input" id="tm-webpub-title" placeholder="' + (isScn ? '留空则用剧本名' : '例如：盛唐人物·立绘包') + '"></div>' +
          '</div>' +
          '<div>' +
            '<div class="tm-field"><label for="tm-webpub-version">版本</label><input class="tm-input" id="tm-webpub-version" value="1.0.0"></div>' +
            '<div class="tm-field"><label for="tm-webpub-tags">标签</label><input class="tm-input" id="tm-webpub-tags" placeholder="' + (isScn ? '剧本 明末' : '立绘 唐 通用') + '"></div>' +
            '<div class="tm-field"><label for="tm-webpub-desc">简介</label><input class="tm-input" id="tm-webpub-desc" placeholder="给玩家看的简短说明"></div>' +
          '</div>' +
        '</div>' +
        '<div class="tm-actions">' +
          action(user ? '提交发布（待审核）' : '登录后发布', submitCall, 'primary', !user) +
          action('刷新在线目录', 'TMContentManager.loadWorkshopCatalog()') +
        '</div>' +
        publishStatusHtml(user) +
      '</section>';
  }

  function renderResetPanel(recoveryOn) {
    if (!state.accountResetOpen) return '';
    return '' +
      '<section class="tm-panel" style="margin-top:.8rem;">' +
        '<h4>找回密码</h4>' +
        '<div class="tm-copy">输入注册时填写的邮箱，收到验证码后重置密码。' + (recoveryOn ? '' : '（服务器尚未配置邮件服务，找回暂不可用。）') + '</div>' +
        '<div class="tm-grid-2" style="margin-top:.6rem;">' +
          '<div class="tm-field"><label for="tm-reset-email">邮箱</label><input class="tm-input" id="tm-reset-email" type="email" autocomplete="email" placeholder="注册时填写的邮箱"></div>' +
          '<div class="tm-field"><label for="tm-reset-code">验证码</label><input class="tm-input" id="tm-reset-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="邮件里的 6 位验证码"></div>' +
        '</div>' +
        pwField('tm-reset-pass', '新密码', 'new-password', '至少 8 位') +
        '<div class="tm-actions">' +
          action('发送验证码', 'TMContentManager.accountRequestReset()', 'primary') +
          action('重置密码', 'TMContentManager.accountReset()') +
          action('收起', 'TMContentManager.toggleReset()') +
        '</div>' +
        '<div class="tm-status ' + (state.accountResetMessage && /失败|错误|无效|至少|缺少|不正确/.test(state.accountResetMessage) ? 'warn' : '') + '" role="status" aria-live="polite">' + esc(state.accountResetMessage || '') + '</div>' +
      '</section>';
  }

  function accountSeal(user) {
    var nm = (user && (user.nickname || user.username)) || '';
    var ch = nm ? Array.from(nm)[0] : '宾';
    return '<div class="tm-acct-seal">' + esc(ch) + '</div>';
  }

  function renderAccountAside(user) {
    return '<aside class="tm-panel">' +
      '<h4>账号权限</h4>' +
      '<div class="tm-kv">' +
        kv('工坊作者', user ? (user.nickname || user.username) : '未登录') +
        kv('注册时间', user && user.createdAt || '未登录') +
        kv('最近登录', user && user.lastLoginAt || '未登录') +
        kv('找回邮箱', user ? (user.email || '未设置') : '未登录') +
      '</div>' +
      '<div class="tm-status">账号是增强功能，不是启动门槛。设置找回邮箱后，忘记密码也能找回；云存档与跨设备同步将基于此账号。</div>' +
    '</aside>';
  }

  function renderAccountLoggedIn(user, recoveryOn) {
    var noEmail = !user.email;
    var warn = state.accountMessage && /失败|错误|至少|已存在|请|不正确/.test(state.accountMessage);
    return '' +
      '<div class="tm-grid-2">' +
        '<section class="tm-panel">' +
          '<h4>账号</h4>' +
          '<div class="tm-acct-card">' +
            accountSeal(user) +
            '<div><div class="tm-acct-name">' + esc(user.nickname || user.username) + '</div>' +
              '<div class="tm-acct-sub">@' + esc(user.username) + (user.email ? ' · ' + esc(user.email) : '') + '</div>' +
              '<span class="tm-acct-badge">● 已登录</span></div>' +
          '</div>' +
          (noEmail
            ? '<div class="tm-loginbox" style="border-left-color:#d6a14a;margin-top:.7rem;">' +
              '<div class="tm-loginbox-h">补设找回邮箱</div>' +
              '<div class="tm-copy" style="margin:.3rem 0 .1rem;">尚未设置邮箱，忘记密码时将无法找回，建议现在补设。</div>' +
              '<div class="tm-field"><label for="tm-setemail">邮箱</label><input class="tm-input" id="tm-setemail" type="email" autocomplete="email" placeholder="your@example.com"></div>' +
              '<div class="tm-actions">' + action('保存邮箱', 'TMContentManager.accountSetEmail()', 'primary') + '</div></div>'
            : '') +
          '<div class="tm-actions">' +
            action('刷新身份', 'TMContentManager.accountRefresh()', 'primary') +
            action('退出登录', 'TMContentManager.accountLogout()', 'danger') +
          '</div>' +
          '<div class="tm-status ' + (warn ? 'warn' : '') + '" role="status" aria-live="polite">' + esc(state.accountMessage || '账号已连接，可在创意工坊以作者身份发布、评分。') + '</div>' +
        '</section>' +
        renderAccountAside(user) +
      '</div>' +
      renderFriendsSection(user) +
      renderNotifSection(user) +
      renderResetPanel(recoveryOn);
  }

  // P2-S1 好友区（poll-based）：加好友 + 收到的申请 + 我的好友。
  function resetAccountRemoteState() {
    // 使旧身份发出的未决请求失效；异步回调只可写回启动时的同一 epoch。
    state.accountSessionEpoch = (Number(state.accountSessionEpoch) || 0) + 1;
    state.friendsLoaded = false; state.friendsLoading = false; state.friendsStatus = 'idle'; state.friendsError = ''; state.friendsData = null; state.friendMessage = '';
    state.notifLoaded = false; state.notifLoading = false; state.notifStatus = 'idle'; state.notifError = ''; state.notifData = null; state.notifMsg = '';
    state.dmOpen = false; state.dmView = 'inbox'; state.dmPeer = null; state.dmInbox = []; state.dmMessages = []; state.dmLoadStatus = 'idle'; state.dmLoadError = ''; state.dmMsg = '';
  }
  function accountSessionIdentity(session) {
    if (!session) return '';
    if (session.token) return 'token:' + String(session.token);
    var user = session.user || session;
    var userKey = user && user.id != null ? user.id : (user && user.username);
    return 'user:' + String(userKey == null ? '' : userKey);
  }
  function replaceAccountSession(session, forceReset) {
    var next = session || null;
    var changed = accountSessionIdentity(state.accountSession) !== accountSessionIdentity(next);
    state.accountSession = next;
    if (forceReset || changed) resetAccountRemoteState();
    return state.accountSession;
  }
  function invalidateAccountSession(message) {
    try { if (window.TM && TM.OnlineClient && TM.OnlineClient.clearSession) TM.OnlineClient.clearSession(); } catch (_) {}
    state.accountSession = null;
    resetAccountRemoteState();
    state.accountMessage = message || '登录已失效，请重新登录。';
  }
  async function refreshAccountSession() {
    var session = (window.TM && TM.OnlineClient) ? TM.OnlineClient.getSession() : state.accountSession;
    session = session && session.token ? session : null;
    return replaceAccountSession(session, true);
  }
  async function accountRefresh() {
    state.accountMessage = '正在刷新账号身份...'; render();
    var requestEpoch = _accountEpoch();
    try {
      var me = await TM.OnlineClient.me(state.onlineApiUrl || undefined);
      if (!_sameAccountEpoch(requestEpoch)) return;
      if (me && me.loggedIn) { await refreshAccountSession(); state.accountMessage = '账号身份已刷新。'; }
      else invalidateAccountSession('登录已失效，请重新登录。');
    } catch (e) {
      if (!_sameAccountEpoch(requestEpoch)) return;
      var msg = String((e && e.message) || '未知错误');
      var status = Number(e && (e.status || e.statusCode || e.httpStatus));
      if (status === 401 || _sessionExpiredError(e)) invalidateAccountSession('登录已失效，请重新登录。');
      else state.accountMessage = '刷新账号身份失败：' + msg;
    }
    render();
  }
  async function accountSetEmail() {
    var el = document.getElementById('tm-setemail');
    var email = el ? el.value.trim() : '';
    if (!email) { state.accountMessage = '请填写邮箱。'; render(); return; }
    state.accountMessage = '正在保存邮箱...'; render();
    var requestEpoch = _accountEpoch();
    try {
      var res = await TM.OnlineClient.setEmail(email, state.onlineApiUrl || undefined);
      if (!_sameAccountEpoch(requestEpoch)) return;
      if (res && res.success) {
        replaceAccountSession(TM.OnlineClient.getSession(), false);
        state.accountMessage = '邮箱已保存，可用于找回密码。';
      } else if (_sessionExpiredError(res)) {
        invalidateAccountSession('登录已失效，请重新登录。');
      } else {
        state.accountMessage = '保存邮箱失败：' + ((res && res.error) || '未知错误');
      }
    } catch (e) {
      if (!_sameAccountEpoch(requestEpoch)) return;
      if (_sessionExpiredError(e)) invalidateAccountSession('登录已失效，请重新登录。');
      else state.accountMessage = '保存邮箱失败：' + (e && e.message || '未知错误');
    }
    render();
  }
  async function accountLogout() {
    var logoutIdentity = accountSessionIdentity(state.accountSession);
    state.accountMessage = '正在退出登录...';
    resetAccountRemoteState();
    var logoutEpoch = _accountEpoch();
    render();
    var warning = '';
    try {
      var res = await TM.OnlineClient.logout(state.onlineApiUrl || undefined);
      warning = String((res && res.warning) || '');
    } catch (e) {
      warning = String((e && e.message) || '网络错误');
    }
    if (!_sameAccountEpoch(logoutEpoch)) return;
    var currentSession = TM.OnlineClient.getSession ? TM.OnlineClient.getSession() : null;
    if (currentSession && currentSession.token && accountSessionIdentity(currentSession) !== logoutIdentity) {
      replaceAccountSession(currentSession, false);
      state.accountMessage = '账号已在退出期间切换，已保留新的登录。';
      render();
      return;
    }
    replaceAccountSession(null, false);
    state.accountMessage = warning ? ('已退出登录（服务器通知失败：' + warning + '）。') : '已退出登录。';
    render();
  }
  function _sessionExpiredError(error) {
    var status = Number(error && (error.status || error.statusCode || error.httpStatus));
    var msg = String((error && (error.message || error.error)) || '');
    return status === 401 || /(?:^|\D)401(?:\D|$)|登录.*(?:失效|过期)|请先登录|未授权|unauthori[sz]ed|authentication\s+required|invalid\s*token|token.*expired/i.test(msg);
  }
  function _accountEpoch() { return Number(state.accountSessionEpoch) || 0; }
  function _sameAccountEpoch(epoch) { return _accountEpoch() === epoch; }
  function _invalidateExpiredAtEpoch(error, epoch) {
    if (!_sameAccountEpoch(epoch) || !_sessionExpiredError(error)) return false;
    invalidateAccountSession('登录已失效，请重新登录。');
    render();
    return true;
  }
  function loadFriends() {
    if (!(window.TM && TM.OnlineClient && TM.OnlineClient.isLoggedIn && TM.OnlineClient.isLoggedIn())) {
      state.friendsLoading = false; state.friendsStatus = 'idle'; state.friendsError = ''; return;
    }
    state.friendsLoading = true;
    state.friendsStatus = 'loading'; state.friendsError = '';
    var requestEpoch = _accountEpoch();
    Promise.all([
      TM.OnlineClient.friends(state.onlineApiUrl || undefined),
      TM.OnlineClient.friendRequests(state.onlineApiUrl || undefined)
    ]).then(function(r){
      if (!_sameAccountEpoch(requestEpoch)) return;
      var fr = r[0] || {}, rq = r[1] || {};
      if (fr.success === false || rq.success === false) throw new Error(fr.error || rq.error || '正式好友接口返回失败');
      state.friendsData = { friends: fr.friends || [], incoming: rq.incoming || [], outgoing: rq.outgoing || [] };
      state.friendsLoaded = true;
      state.friendsLoading = false;
      state.friendsStatus = 'ok'; state.friendsError = '';
      render();
    }).catch(function(error){
      if (!_sameAccountEpoch(requestEpoch)) return;
      if (_sessionExpiredError(error)) {
        if (typeof invalidateAccountSession === 'function') invalidateAccountSession('登录已失效，请重新登录。');
        render(); return;
      }
      state.friendsData = { friends: [], incoming: [], outgoing: [] }; state.friendsLoaded = true; state.friendsLoading = false;
      state.friendsStatus = 'error'; state.friendsError = (error && error.message) || '正式好友接口不可用'; render();
    });
  }
  function renderFriendsSection(user) {
    var d = state.friendsData || { friends: [], incoming: [], outgoing: [] };
    if (!state.friendsLoaded && !state.friendsLoading) { try { setTimeout(loadFriends, 0); } catch (e) {} }
    var warn = state.friendMessage && /失败|错误|请|不能/.test(state.friendMessage);
    var incoming = d.incoming.map(function(rq){
      return '<div class="tm-friend"><div class="tm-friend-id"><b>' + esc(rq.nickname) + '</b><small>@' + esc(rq.username) + '</small></div>' +
        '<div class="tm-actions" style="margin:0;">' +
          '<button class="tm-action primary" onclick="TMContentManager.respondFriend(' + Number(rq.userId) + ', \'accept\')">接受</button>' +
          '<button class="tm-action" onclick="TMContentManager.respondFriend(' + Number(rq.userId) + ', \'reject\')">拒绝</button>' +
        '</div></div>';
    }).join('');
    var friendRows = d.friends.length ? d.friends.map(function(f){
      return '<div class="tm-friend"><div class="tm-friend-id"><b>' + esc(f.nickname) + '</b><small>@' + esc(f.username) + '</small></div>' +
        '<div class="tm-actions" style="margin:0;">' +
          '<button class="tm-action" onclick="TMContentManager.openDm(' + Number(f.id) + ', ' + jsArg(f.nickname || '') + ')">私信</button>' +
          '<button class="tm-action danger" onclick="TMContentManager.removeFriend(' + Number(f.id) + ')">删除</button>' +
        '</div></div>';
    }).join('') : (state.friendsLoading ? '<div class="tm-empty">正在读取正式好友列表…</div>' : (state.friendsStatus === 'error'
      ? '<div class="tm-empty">好友接口不可用：' + esc(state.friendsError || '读取失败') + ' <button class="tm-action" onclick="TMContentManager.refreshFriends()">重试</button></div>'
      : '<div class="tm-empty">好友列表为空，可按用户名发送申请。</div>'));
    return '<section class="tm-panel" style="margin-top:.8rem;">' +
      '<h4>好友' + (d.friends.length ? ' · ' + d.friends.length : '') + '</h4>' +
      '<div class="tm-field" style="margin-top:.2rem;"><label for="tm-friend-add">添加好友（用户名）</label>' +
        '<div style="display:flex;gap:.4rem;align-items:stretch;"><input class="tm-input" id="tm-friend-add" placeholder="对方的用户名" style="flex:1;">' +
        '<button class="tm-action primary" onclick="TMContentManager.addFriend()">申请</button></div></div>' +
      (state.friendMessage ? '<div class="tm-status ' + (warn ? 'warn' : '') + '" role="status" aria-live="polite">' + esc(state.friendMessage) + '</div>' : '') +
      (incoming ? '<h4 class="tm-detail-h">收到的申请 · ' + d.incoming.length + '</h4><div class="tm-friend-list">' + incoming + '</div>' : '') +
      (d.outgoing.length ? '<div class="tm-pack-meta" style="margin-top:.45rem;">已发出 ' + d.outgoing.length + ' 个申请，等待对方通过。</div>' : '') +
      '<h4 class="tm-detail-h">我的好友</h4><div class="tm-friend-list">' + friendRows + '</div>' +
    '</section>';
  }
  function addFriend() {
    var el = document.getElementById('tm-friend-add');
    var to = el ? el.value.trim() : '';
    if (!(window.TM && TM.OnlineClient && TM.OnlineClient.isLoggedIn())) { state.friendMessage = '请先登录。'; render(); return; }
    if (!to) { state.friendMessage = '请输入对方用户名。'; render(); return; }
    state.friendMessage = '正在发送申请...'; render();
    var requestEpoch = _accountEpoch();
    TM.OnlineClient.requestFriend(to, state.onlineApiUrl || undefined).then(function(res){
      if (!_sameAccountEpoch(requestEpoch)) return;
      if (res && res.success) state.friendMessage = res.status === 'accepted' ? ('已与「' + (res.nickname || to) + '」结为好友。') : ('已向「' + (res.nickname || to) + '」发送好友申请。');
      else if (_invalidateExpiredAtEpoch(res, requestEpoch)) return;
      else state.friendMessage = '申请失败：' + ((res && res.error) || '未知错误');
      state.friendsLoaded = false; loadFriends();
    }).catch(function(e){ if (_invalidateExpiredAtEpoch(e, requestEpoch) || !_sameAccountEpoch(requestEpoch)) return; state.friendMessage = '申请失败：' + (e && e.message || '网络错误'); render(); });
  }
  function respondFriendUI(userId, action) {
    var requestEpoch = _accountEpoch();
    TM.OnlineClient.respondFriend(userId, action, state.onlineApiUrl || undefined).then(function(res){
      if (!_sameAccountEpoch(requestEpoch)) return;
      if (res && res.success === false && _invalidateExpiredAtEpoch(res, requestEpoch)) return;
      state.friendMessage = (res && res.success) ? (action === 'accept' ? '已接受好友申请。' : '已拒绝申请。') : ('操作失败：' + ((res && res.error) || ''));
      state.friendsLoaded = false; loadFriends();
    }).catch(function(e){ if (_invalidateExpiredAtEpoch(e, requestEpoch) || !_sameAccountEpoch(requestEpoch)) return; state.friendMessage = '操作失败。'; render(); });
  }
  function removeFriendUI(userId) {
    var requestEpoch = _accountEpoch();
    TM.OnlineClient.removeFriend(userId, state.onlineApiUrl || undefined).then(function(res){
      if (!_sameAccountEpoch(requestEpoch)) return;
      if (res && res.success === false && _invalidateExpiredAtEpoch(res, requestEpoch)) return;
      state.friendMessage = (res && res.success) ? '已删除好友。' : '操作失败。';
      state.friendsLoaded = false; loadFriends();
    }).catch(function(e){ if (_invalidateExpiredAtEpoch(e, requestEpoch) || !_sameAccountEpoch(requestEpoch)) return; state.friendMessage = '操作失败。'; render(); });
  }

  // P2-S3 通知中心。
  function loadNotifs() {
    if (!(window.TM && TM.OnlineClient && TM.OnlineClient.isLoggedIn && TM.OnlineClient.isLoggedIn())) {
      state.notifLoading = false; state.notifStatus = 'idle'; return;
    }
    if (!(TM.OnlineClient && TM.OnlineClient.notifications)) {
      state.notifData = { notifications: [], unread: null }; state.notifLoaded = true; state.notifLoading = false;
      state.notifStatus = 'error'; state.notifError = '正式通知接口未加载'; render(); return;
    }
    state.notifLoading = true;
    state.notifStatus = 'loading'; state.notifError = '';
    var requestEpoch = _accountEpoch();
    TM.OnlineClient.notifications(state.onlineApiUrl || undefined).then(function(res){
      if (!_sameAccountEpoch(requestEpoch)) return;
      if (!res || res.success === false || !Array.isArray(res.notifications)) throw new Error((res && res.error) || '正式通知接口返回无效');
      var unread = hasMetric(res, 'unread') ? Number(res.unread) : res.notifications.filter(function(n){ return !n.read; }).length;
      state.notifData = { notifications: res.notifications, unread: unread };
      state.notifLoaded = true; state.notifLoading = false; state.notifStatus = 'ok'; state.notifError = ''; render();
    }).catch(function(error){
      if (!_sameAccountEpoch(requestEpoch)) return;
      if (_sessionExpiredError(error)) {
        if (typeof invalidateAccountSession === 'function') invalidateAccountSession('登录已失效，请重新登录。');
        render(); return;
      }
      state.notifData = { notifications: [], unread: null }; state.notifLoaded = true; state.notifLoading = false;
      state.notifStatus = 'error'; state.notifError = (error && error.message) || '正式通知接口不可用'; render();
    });
  }
  function notifIcon(t) { return ({ comment: '✎', friend_request: '＋', friend_accept: '✓', message: '✉', moderation: '⚖' })[t] || '●'; }
  function notifText(n) {
    var who = n.actorNick || '有人';
    if (n.type === 'comment') return who + ' 评论了你的作品：' + (n.text || '');
    if (n.type === 'friend_request') return who + ' 申请加你为好友';
    if (n.type === 'friend_accept') return who + ' 通过了你的好友申请';
    if (n.type === 'message') return who + ' 给你发了私信：' + (n.text || '');
    if (n.type === 'moderation') return n.text || '你的作品审核状态有更新';
    return n.text || '新通知';
  }
  function renderNotifSection(user) {
    if (!state.notifLoaded && !state.notifLoading) { try { setTimeout(loadNotifs, 0); } catch (e) {} }
    var d = state.notifData || { notifications: [], unread: 0 };
    var rows = d.notifications.length ? d.notifications.map(function(n){
      var clickable = n.type === 'message' && n.actorId;
      var click = clickable ? ' onclick="TMContentManager.openDmFromNotif(' + Number(n.actorId) + ', ' + jsArg(n.actorNick || '') + ', ' + Number(n.id) + ')" style="cursor:pointer;"' : '';
      return '<div class="tm-notif' + (n.read ? '' : ' unread') + '"' + click + '>' +
        '<span class="tm-notif-i">' + notifIcon(n.type) + '</span>' +
        '<div class="tm-notif-b"><div>' + esc(notifText(n)) + '</div><small>' + esc(n.createdAt || '') + '</small></div>' +
        (n.read ? '' : '<button class="tm-action" onclick="event.stopPropagation();TMContentManager.markNotif(' + Number(n.id) + ')">已读</button>') +
      '</div>';
    }).join('') : (state.notifLoading
      ? '<div class="tm-empty">正在读取正式通知…</div>'
      : (state.notifStatus === 'error'
        ? '<div class="tm-empty">通知接口不可用：' + esc(state.notifError || '读取失败') + '</div>'
        : '<div class="tm-empty">正式接口返回 0 条通知。</div>'));
    return '<section class="tm-panel" style="margin-top:.8rem;">' +
      '<h4>通知' + (d.unread ? ' · <span class="tm-unread">' + esc(String(d.unread)) + ' 未读</span>' : '') + '</h4>' +
      '<div class="tm-actions" style="margin-top:.2rem;">' +
        '<button class="tm-action primary" onclick="TMContentManager.openDmInbox()">私信</button>' +
        (d.unread ? '<button class="tm-action" onclick="TMContentManager.markAllNotif()">全部已读</button>' : '') +
        '<button class="tm-action" onclick="TMContentManager.refreshNotifs()">刷新</button>' +
      '</div>' +
      (state.notifMsg ? '<div class="tm-empty">' + esc(state.notifMsg) + '</div>' : '') +
      '<div class="tm-notif-list">' + rows + '</div>' +
    '</section>';
  }
  function markNotif(id) {
    var requestEpoch = _accountEpoch();
    TM.OnlineClient.markNotificationRead(id, state.onlineApiUrl || undefined).then(function(res){ if (!_sameAccountEpoch(requestEpoch)) return; if (res && res.success === false && _invalidateExpiredAtEpoch(res, requestEpoch)) return; state.notifMsg = ''; state.notifLoaded = false; loadNotifs(); }).catch(function(e){ if (_invalidateExpiredAtEpoch(e, requestEpoch) || !_sameAccountEpoch(requestEpoch)) return; state.notifMsg = '操作失败：' + (e && e.message || '网络错误'); render(); });
  }
  function markAllNotif() {
    var requestEpoch = _accountEpoch();
    TM.OnlineClient.markNotificationRead(true, state.onlineApiUrl || undefined).then(function(res){ if (!_sameAccountEpoch(requestEpoch)) return; if (res && res.success === false && _invalidateExpiredAtEpoch(res, requestEpoch)) return; state.notifMsg = ''; state.notifLoaded = false; loadNotifs(); }).catch(function(e){ if (_invalidateExpiredAtEpoch(e, requestEpoch) || !_sameAccountEpoch(requestEpoch)) return; state.notifMsg = '操作失败：' + (e && e.message || '网络错误'); render(); });
  }
  function refreshNotifs() { state.notifLoaded = false; loadNotifs(); }

  // P2-S2 私信浮层。
  function openDmInbox() {
    state.dmOpen = true; state.dmView = 'inbox'; state.dmPeer = null; state.dmInbox = []; state.dmMsg = '';
    state.dmLoadStatus = 'loading'; state.dmLoadError = ''; render();
    if (!(window.TM && TM.OnlineClient && TM.OnlineClient.inbox)) {
      state.dmLoadStatus = 'error'; state.dmLoadError = '正式私信接口未加载'; render(); return;
    }
    var requestEpoch = _accountEpoch();
    TM.OnlineClient.inbox(state.onlineApiUrl || undefined).then(function(res){
      if (!_sameAccountEpoch(requestEpoch)) return;
      if (!res || res.success === false || !Array.isArray(res.conversations)) throw new Error((res && res.error) || '正式私信接口返回无效');
      if (state.dmOpen && state.dmView === 'inbox') {
        state.dmInbox = res.conversations; state.dmLoadStatus = 'ok'; state.dmLoadError = ''; render();
      }
    }).catch(function(error){
      if (!_sameAccountEpoch(requestEpoch)) return;
      if (_sessionExpiredError(error)) {
        if (typeof invalidateAccountSession === 'function') invalidateAccountSession('登录已失效，请重新登录。');
        render(); return;
      }
      if (!state.dmOpen || state.dmView !== 'inbox') return;
      state.dmInbox = []; state.dmLoadStatus = 'error'; state.dmLoadError = (error && error.message) || '正式私信接口不可用'; render();
    });
  }
  function openDm(userId, nickname) {
    state.dmOpen = true; state.dmView = 'chat'; state.dmPeer = { id: userId, nickname: nickname }; state.dmMessages = []; state.dmMsg = '';
    state.dmLoadStatus = 'loading'; state.dmLoadError = ''; render();
    loadConversation(userId);
  }
  function openDmFromNotif(userId, nickname, notifId) {
    if (notifId) {
      var requestEpoch = _accountEpoch();
      TM.OnlineClient.markNotificationRead(notifId, state.onlineApiUrl || undefined).then(function(res){ if (!_sameAccountEpoch(requestEpoch)) return; if (res && res.success === false && _invalidateExpiredAtEpoch(res, requestEpoch)) return; state.notifLoaded = false; loadNotifs(); }).catch(function(e){ _invalidateExpiredAtEpoch(e, requestEpoch); });
    }
    openDm(userId, nickname);
  }
  function loadConversation(userId) {
    if (!(window.TM && TM.OnlineClient && TM.OnlineClient.conversation)) {
      state.dmLoadStatus = 'error'; state.dmLoadError = '正式对话接口未加载'; render(); return;
    }
    state.dmLoadStatus = 'loading'; state.dmLoadError = '';
    var requestEpoch = _accountEpoch();
    TM.OnlineClient.conversation(userId, state.onlineApiUrl || undefined).then(function(res){
      if (!_sameAccountEpoch(requestEpoch)) return;
      if (!res || res.success === false || !Array.isArray(res.messages)) throw new Error((res && res.error) || '正式对话接口返回无效');
      if (state.dmOpen && state.dmPeer && Number(state.dmPeer.id) === Number(userId)) {
        state.dmMessages = res.messages;
        if (res.peer && res.peer.nickname) state.dmPeer.nickname = res.peer.nickname;
        state.dmLoadStatus = 'ok'; state.dmLoadError = '';
        render();
      }
    }).catch(function(error){
      if (!_sameAccountEpoch(requestEpoch)) return;
      if (_sessionExpiredError(error)) {
        if (typeof invalidateAccountSession === 'function') invalidateAccountSession('登录已失效，请重新登录。');
        render(); return;
      }
      if (!state.dmOpen || !state.dmPeer || Number(state.dmPeer.id) !== Number(userId)) return;
      state.dmMessages = []; state.dmLoadStatus = 'error'; state.dmLoadError = (error && error.message) || '正式对话接口不可用'; render();
    });
  }
  function closeDm() { state.dmOpen = false; state.dmView = 'inbox'; state.dmPeer = null; render(); }
  function sendDm() {
    var el = document.getElementById('tm-dm-input');
    var text = el ? el.value.trim() : '';
    if (!text || !state.dmPeer) return;
    var requestEpoch = _accountEpoch();
    var peerId = state.dmPeer.id;
    if (el && el.blur) el.blur();   // F1·发送即失焦：sendDm 后经两跳异步才 render·失焦令重渲快照不命中该框→已发文本不被回填盖回（清空保留·不再误重发）。
    state.dmMsg = '';
    TM.OnlineClient.sendMessage(peerId, text, state.onlineApiUrl || undefined).then(function(res){
      if (!_sameAccountEpoch(requestEpoch)) return;
      if (res && res.success) { loadConversation(peerId); }
      else if (_invalidateExpiredAtEpoch(res, requestEpoch)) return;
      else { state.dmMsg = '发送失败：' + ((res && res.error) || ''); render(); }
    }).catch(function(e){ if (_invalidateExpiredAtEpoch(e, requestEpoch) || !_sameAccountEpoch(requestEpoch)) return; state.dmMsg = '发送失败。'; render(); });
  }
  function renderDmLayer() {
    if (!state.dmOpen) return '';
    var av = function(n){ return '<div class="av seal">' + esc(String(n || '友').charAt(0)) + '</div>'; };
    var head, body;
    if (state.dmView === 'chat' && state.dmPeer) {
      var msgs = (state.dmMessages || []).length ? state.dmMessages.map(function(m){
        return '<div class="bub ' + (m.fromMe ? 'me' : 'them') + '">' + esc(m.text) + '</div>';
      }).join('') : (state.dmLoadStatus === 'error'
        ? truthEmpty('信', '对话接口不可用', state.dmLoadError || '无法读取正式对话。')
        : (state.dmLoadStatus === 'loading'
          ? truthEmpty('信', '正在读取正式对话', '请稍候。')
          : truthEmpty('信', '还没有消息', '正式接口返回 0 条消息；可发送第一条。')));
      head = '<button class="btn sm" onclick="TMContentManager.openDmInbox()">‹ 私信</button><b>' + esc(state.dmPeer.nickname || '对话') + '</b>';
      body = '<div class="dm-thread" style="height:62vh;min-height:340px;">' +
        '<div class="dm-msgs">' + msgs + '</div>' +
        (state.dmMsg ? '<div class="status">' + esc(state.dmMsg) + '</div>' : '') +
        '<div class="dm-input"><input class="input" id="tm-dm-input" placeholder="写条私信…" onkeydown="if(event.key===\'Enter\'){TMContentManager.sendDm();}"><button class="btn primary" onclick="TMContentManager.sendDm()">发送</button></div>' +
      '</div>';
    } else {
      var list = (state.dmInbox || []).length ? state.dmInbox.map(function(c){
        return '<div class="dm-c" onclick="TMContentManager.openDm(' + Number(c.userId) + ', ' + jsArg(c.nickname || '') + ')">' + av(c.nickname) +
          '<div><b>' + esc(c.nickname) + (c.unread ? ' <span class="tag">' + esc(String(c.unread)) + '</span>' : '') + '</b><small>' + (c.fromMe ? '我：' : '') + esc(c.lastText || '') + '</small></div></div>';
      }).join('') : (state.dmLoadStatus === 'error'
        ? truthEmpty('信', '私信接口不可用', state.dmLoadError || '无法读取正式私信。')
        : (state.dmLoadStatus === 'loading'
          ? truthEmpty('信', '正在读取正式私信', '请稍候。')
          : truthEmpty('信', '还没有私信', '正式接口返回 0 个会话；可从好友列表开始聊天。')));
      head = '<b>私信</b>';
      body = '<div class="dm-list" style="border:1px solid var(--line);">' + list + '</div>';
    }
    return '<div class="sheet" role="dialog" aria-modal="true" aria-label="私信" onclick="if(event.target===this)TMContentManager.closeDm()">' +
      '<div class="sheet-box" style="width:min(560px,94%);">' +
        '<div class="sh-head" style="gap:8px;">' + head + '<button class="btn sm" style="margin-left:auto;" onclick="TMContentManager.closeDm()" aria-label="关闭私信">关闭</button></div>' +
        '<div class="sh-body">' + body + '</div>' +
      '</div></div>';
  }

  function renderAccountLoggedOut(accountsOn, recoveryOn) {
    var pwOpen = !!state.accountPwOpen;
    var warn = state.accountMessage && /失败|错误|至少|已存在|请|不正确/.test(state.accountMessage);
    return '' +
      '<div class="tm-grid-2">' +
        '<section class="tm-panel">' +
          '<h4>账号登录</h4>' +
          '<div class="tm-copy">账号用于工坊作者身份、评分、订阅与跨设备同步。' + (accountsOn ? '' : '（账号服务连接中……）') + '离线开局、读档与本地工坊始终不受影响。</div>' +
          '<div class="tm-loginbox">' +
            '<div class="tm-loginbox-h"><span class="tm-dot on"></span>邮箱验证码登录<span class="tm-tagchip">推荐 · 免密</span></div>' +
            '<div class="tm-field"><label for="tm-elogin-email"><span class="tm-step">1</span> 邮箱（新邮箱自动注册）</label><input class="tm-input" id="tm-elogin-email" type="email" autocomplete="email" value="' + esc(state.emailLoginAddr || '') + '" placeholder="输入邮箱，点发送验证码"></div>' +
            '<div class="tm-field"><label for="tm-elogin-code"><span class="tm-step">2</span> 验证码</label><input class="tm-input" id="tm-elogin-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="邮件里的 6 位验证码"></div>' +
            '<div class="tm-actions">' +
              action('发送验证码', 'TMContentManager.accountEmailCodeRequest()', 'primary') +
              action('登录', 'TMContentManager.accountEmailLogin()') +
            '</div>' +
          '</div>' +
          '<div class="tm-subform ' + (pwOpen ? '' : 'is-collapsed') + '">' +
            '<div class="tm-subform-head" role="button" tabindex="0" aria-expanded="' + (pwOpen ? 'true' : 'false') + '" onclick="TMContentManager.accountTogglePw()" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();TMContentManager.accountTogglePw();}">' +
              '<span>或：账号密码登录 / 注册</span><span class="tm-caret">▾</span>' +
            '</div>' +
            '<div class="tm-subform-body">' +
              '<div class="tm-field"><label for="tm-account-name">账号</label><input class="tm-input" id="tm-account-name" autocomplete="username" placeholder="3-24 位中文/英文/数字/下划线"></div>' +
              pwField('tm-account-pass', '密码', 'current-password', '至少 8 位') +
              '<div class="tm-field"><label for="tm-account-nickname">昵称（注册时可填）</label><input class="tm-input" id="tm-account-nickname" autocomplete="nickname" placeholder="显示在工坊作者栏"></div>' +
              '<div class="tm-field"><label for="tm-account-email">邮箱（注册时填，用于找回密码）</label><input class="tm-input" id="tm-account-email" type="email" autocomplete="email" placeholder="建议填写，否则无法找回密码"></div>' +
              '<div class="tm-actions">' +
                action('登录', 'TMContentManager.accountLogin()', 'primary') +
                action('注册并登录', 'TMContentManager.accountRegister()') +
              '</div>' +
              '<div style="margin-top:.45rem;"><span onclick="TMContentManager.toggleReset()" style="color:var(--gold,#d8b56a);font-size:.76rem;cursor:pointer;text-decoration:underline;">忘记密码？</span></div>' +
            '</div>' +
          '</div>' +
          '<div class="tm-status ' + (warn ? 'warn' : '') + '" role="status" aria-live="polite">' + esc(state.accountMessage || '尚未登录。') + '</div>' +
        '</section>' +
        renderAccountAside(null) +
      '</div>' +
      renderResetPanel(recoveryOn);
  }

  function renderAccountTabV2() {
    var h = state.onlineStatus || {};
    var accountsOn = !!(h.features && h.features.accounts);
    var recoveryOn = !!(h.features && h.features.accountRecovery);
    var user = (state.accountSession || {}).user;
    return user ? renderAccountLoggedIn(user, recoveryOn) : renderAccountLoggedOut(accountsOn, recoveryOn);
  }

  function renderApplyEntries(entries) {
    entries = Array.isArray(entries) && entries.length ? entries : (state.changelogEntries || []).slice(0, 3);
    if (!entries.length) return '<div class="tm-empty">暂无可展示的游戏公告内容。</div>';
    return entries.slice(0, 4).map(function(entry){
      var items = Array.isArray(entry.items) ? entry.items.slice(0, 4).map(function(item){
        return typeof item === 'string' ? item : (item && (item.what || item.text)) || '';
      }).filter(Boolean) : [];
      return '<div class="tm-card">' +
        '<div style="color:#f2d487;font-weight:800;">' + esc(entry.title || entry.module || '更新') + '</div>' +
        '<div class="tm-pack-meta">' + esc((entry.date || '') + (entry.module ? ' / ' + entry.module : '')) + '</div>' +
        (items.length ? '<div class="tm-copy" style="margin-top:.45rem;">' + items.map(function(x){ return '· ' + esc(x); }).join('<br>') + '</div>' : '') +
      '</div>';
    }).join('');
  }

  function ensureApplyLayer() {
    ensureStyle();
    var layer = document.getElementById('tm-update-apply-ov');
    if (layer) return layer;
    layer = document.createElement('div');
    layer.id = 'tm-update-apply-ov';
    layer.className = 'tm-update-ritual';
    document.body.appendChild(layer);
    return layer;
  }

  function applyLog(line) {
    var u = state.applyUpdate;
    u.logs = Array.isArray(u.logs) ? u.logs : [];
    u.logs.push(line);
    if (u.logs.length > 10) u.logs = u.logs.slice(-10);
  }

  function updateApplyState(patch, logLine) {
    Object.assign(state.applyUpdate, patch || {});
    if (logLine) applyLog(logLine);
    renderApplyUpdateModal();
  }

  function renderApplyUpdateModal() {
    var layer = ensureApplyLayer();
    var u = state.applyUpdate || {};
    if (!u.open) {
      layer.className = 'tm-update-ritual';
      layer.innerHTML = '';
      return;
    }
    var pct = Math.max(0, Math.min(100, Math.round(u.progress || 0)));
    var sizeText = formatBytes(u.size || 0);
    var kindText = u.kind === 'installer' ? '本体安装包' : (u.kind === 'hot' ? '前端热更' : '自动判定');
    var logs = (u.logs || []).map(function(x){ return '<div>' + esc(x) + '</div>'; }).join('') || '<div>等待开始...</div>';
    var closeOnclick = u.busy
      ? "if(confirm('更新正在进行中，确定关闭？关闭后下载将在后台继续进行。')){TMContentManager.closeApplyUpdate();}"
      : 'TMContentManager.closeApplyUpdate()';
    var foot = '<div class="tm-actions" style="margin-top:0;">' +
      (u.canReload ? '<button class="tm-action primary" onclick="TMContentManager.reloadAppliedUpdate()">立即重载前端</button>' : '') +
      (u.canInstall ? '<button class="tm-action danger" onclick="TMContentManager.installDownloadedUpdate()">安装本体并重启</button>' : '') +
      '<button class="tm-action" onclick="' + closeOnclick + '">关闭</button>' +
    '</div>';
    layer.className = 'tm-update-ritual show';
    layer.innerHTML = '<div class="tm-update-box" role="dialog" aria-modal="true" aria-label="应用更新">' +
      '<div class="tm-update-title">' +
        '<div><b>应用更新</b><span>由邸报触发：先读取本次游戏公告，再自动检查并安装可用更新。</span></div>' +
        '<div style="text-align:right;">' + pill(kindText, u.kind ? 'good' : '') + '<div class="tm-pack-meta" style="margin-top:.35rem;">' + esc(sizeText) + '</div></div>' +
      '</div>' +
      '<div class="tm-update-body">' +
        '<section class="tm-panel"><h4>本次公告内容</h4><div class="tm-pack-list">' + renderApplyEntries(u.entries) + '</div></section>' +
        '<section class="tm-panel"><h4>更新进度</h4>' +
          '<div class="tm-status ' + (u.stage === 'error' ? 'warn' : '') + '">' + esc(u.message || '准备检查更新...') + '</div>' +
          '<div class="tm-update-progress"><i style="width:' + pct + '%;"></i></div>' +
          '<div class="tm-pack-meta" style="margin-top:.45rem;">' + pct + '% · ' + esc(u.stage || 'idle') + '</div>' +
          '<div class="tm-update-log">' + logs + '</div>' +
        '</section>' +
      '</div>' +
      '<div class="tm-update-foot"><div class="tm-copy">前端热更完成后重载前端即可生效；本体更新下载完成后需要安装并重启。</div>' + foot + '</div>' +
    '</div>';
  }

  async function prepareOnlineDefaults() {
    state.feedUrl = loadFeedUrl();
    state.hotFeedUrl = loadHotFeedUrl();
    state.catalogUrl = loadCatalogUrl();
    state.onlineApiUrl = loadOnlineApiUrl();
    if (!desktop() || !window.tianming.contentStatus) return;
    var status = await window.tianming.contentStatus();
    if (status && status.success) {
      state.defaultFeedUrl = status.defaultUpdateFeedUrl || state.defaultFeedUrl || '';
      state.defaultHotFeedUrl = status.defaultHotUpdateFeedUrl || state.defaultHotFeedUrl || '';
      state.defaultCatalogUrl = status.defaultWorkshopCatalogUrl || state.defaultCatalogUrl || '';
      state.defaultOnlineApiUrl = status.defaultOnlineApiUrl || state.defaultOnlineApiUrl || '';
      state.hotStatus = status.hotUpdate || state.hotStatus || null;
      var onlineSession = (window.TM && TM.OnlineClient) ? TM.OnlineClient.getSession() : null;
      replaceAccountSession((onlineSession && onlineSession.token) ? onlineSession : (status.account || state.accountSession || null), false);
      if (!state.feedUrl) state.feedUrl = loadFeedUrl();
      if (!state.hotFeedUrl) state.hotFeedUrl = loadHotFeedUrl();
      if (!state.catalogUrl) state.catalogUrl = loadCatalogUrl();
      if (!state.onlineApiUrl) state.onlineApiUrl = loadOnlineApiUrl();
      state.status = Object.assign({}, state.status || {}, { currentVersion: status.currentVersion });
    }
  }

  function openApplyUpdateFromChangelog(entries) {
    state.applyUpdate = {
      open: true,
      busy: true,
      entries: Array.isArray(entries) ? entries : [],
      stage: 'checking',
      message: '正在读取更新源...',
      progress: 3,
      kind: '',
      size: 0,
      logs: ['收到邸报更新请求。'],
      canReload: false,
      canInstall: false
    };
    renderApplyUpdateModal();
    runApplyUpdateFlow();
  }

  async function runApplyUpdateFlow() {
    try {
      if (!desktop()) {
        updateApplyState({ busy: false, stage: 'error', message: '当前不是桌面版，不能在游戏内应用更新。', progress: 100 }, '网页环境不支持桌面更新。');
        return;
      }
      await prepareOnlineDefaults();
      updateApplyState({ stage: 'checking-hot', message: '正在检查前端热更...', progress: 10 }, '检查前端热更清单。');
      var hot = await window.tianming.checkHotUpdate(state.hotFeedUrl || state.defaultHotFeedUrl || '');
      state.hotCheck = hot || null;
      // 2026-06-11·needsInstaller=热更要求更高本体版本·别在注定失败的热更上空转·直落本体安装包分支
      if (hot && hot.success && hot.hasUpdate && !hot.needsInstaller) {
        updateApplyState({
          stage: 'downloading-hot',
          kind: 'hot',
          size: hot.size || 0,
          message: '发现前端热更 ' + hot.remoteVersion + '，开始下载。',
          progress: 18
        }, '前端热更：' + hot.currentVersion + ' → ' + hot.remoteVersion + '，大小 ' + formatBytes(hot.size));
        var installed = await window.tianming.installHotUpdate(state.hotFeedUrl || state.defaultHotFeedUrl || '');
        if (installed && installed.success) {
          state.hotStatus = installed.status || state.hotStatus;
          updateApplyState({ busy: false, stage: 'installed-hot', message: '前端热更已安装，重载前端后生效。', progress: 100, canReload: true }, '前端热更安装完成。');
        } else {
          updateApplyState({ busy: false, stage: 'error', message: '前端热更失败：' + ((installed && installed.error) || '未知错误'), progress: 100 }, '热更失败。');
        }
        return;
      }

      updateApplyState({ stage: 'checking-installer', message: '未发现可用前端热更，正在检查本体安装包...', progress: 35 }, hot && hot.message ? hot.message : '前端热更未命中。');
      var installer = await window.tianming.checkForUpdate(state.feedUrl || state.defaultFeedUrl || '');
      state.status = installer || state.status;
      if (installer && installer.success && installer.hasUpdate) {
        updateApplyState({
          stage: 'downloading-installer',
          kind: 'installer',
          size: installer.size || updateInfoSize(installer.info),
          message: '发现本体更新 ' + installer.remoteVersion + '，开始下载安装包。',
          progress: 45
        }, '本体安装包：' + installer.currentVersion + ' → ' + installer.remoteVersion + '，大小 ' + formatBytes(installer.size || updateInfoSize(installer.info)));
        var dl = await window.tianming.downloadUpdate();
        if (dl && dl.success) {
          updateApplyState({ busy: false, stage: 'downloaded-installer', message: '本体更新包已下载，点击安装并重启完成更新。', progress: 100, canInstall: true }, '本体安装包下载完成。');
        } else {
          updateApplyState({ busy: false, stage: 'error', message: '本体更新下载失败：' + ((dl && dl.error) || '未知错误'), progress: 100 }, '本体下载失败。');
        }
        return;
      }
      updateApplyState({ busy: false, stage: 'none', message: '没有检测到可应用的在线更新。', progress: 100 }, installer && installer.message ? installer.message : '未发现可应用更新。');
    } catch (e) {
      updateApplyState({ busy: false, stage: 'error', message: '应用更新失败：' + (e && e.message || e), progress: 100 }, '更新流程异常。');
    }
  }

  function closeApplyUpdate() {
    state.applyUpdate.open = false;
    renderApplyUpdateModal();
  }

  async function reloadAppliedUpdate() {
    updateApplyState({ busy: true, message: '正在重载前端...', progress: 100 }, '重载前端。');
    var res = await window.tianming.reloadAfterHotUpdate();
    if (!res || !res.success) {
      updateApplyState({ busy: false, stage: 'error', message: '重载失败：' + ((res && res.error) || '未知错误') }, '重载失败。');
    }
  }

  async function installDownloadedUpdate() {
    updateApplyState({ busy: true, message: '正在交给安装器重启安装...', progress: 100 }, '启动安装器。');
    var res = await window.tianming.installUpdate();
    if (!res || !res.success) {
      updateApplyState({ busy: false, stage: 'error', message: '安装失败：' + ((res && res.error) || '未知错误') }, '安装器启动失败。');
    }
  }

  // ===== 全屏商城（对齐 preview-community）=====
  function mallGlyph(p) { return String((p && (p.title || p.id)) || '坊').trim().charAt(0) || '坊'; }
  function packCoverUrl(p) {
    var c = p && p.coverImage;
    if (c && typeof c === 'object' && c.url) return String(c.url);
    if (c && typeof c === 'string') return c;
    if (p && typeof p.coverUrl === 'string' && p.coverUrl) return p.coverUrl;
    return '';
  }
  function packGalleryImages(p) {
    var g = p && p.galleryImages;
    return Array.isArray(g) ? g.filter(function(x){ return x && x.url; }).slice(0, 6) : [];
  }
  function hasMetric(record, key) {
    return !!record && record[key] != null && record[key] !== '' && isFinite(Number(record[key]));
  }
  function metricText(record, key, prefix, suffix) {
    return hasMetric(record, key) ? String(prefix || '') + esc(String(record[key])) + String(suffix || '') : '未提供';
  }
  function aggregateMetric(records, key) {
    var list = Array.isArray(records) ? records : [];
    var known = list.filter(function(record){ return hasMetric(record, key); });
    return {
      value: known.reduce(function(sum, record){ return sum + Number(record[key]); }, 0),
      known: known.length,
      total: list.length,
      complete: known.length === list.length
    };
  }
  function aggregateMetricText(aggregate) {
    if (!aggregate || aggregate.known === 0) return aggregate && aggregate.total === 0 ? '0' : '—';
    return String(aggregate.value) + (aggregate.complete ? '' : '+');
  }
  function runtimeFallbackCover(p) {
    var tags = Array.isArray(p && p.tags) ? p.tags.join(' ') : '';
    var text = [p && p.title, p && p.description, p && p.type, tags].filter(Boolean).join(' ');
    if (/绍宋|建炎|南宋|江南/.test(text)) return 'assets/ui/workshop/cover-jiangnan.webp';
    if (/天启|明末|崇祯/.test(text)) return 'assets/ui/workshop/hero-jianyan.webp';
    if (/武将|立绘|portrait/.test(text)) return 'assets/ui/workshop/cover-general.webp';
    return 'assets/ui/workshop/cover-yanmen.webp';
  }
  // actionHtml 是唯一不经 esc() 的原始 HTML 注入口（sink）：只允许传入静态字面量（如固定的重试按钮），
  // 严禁把用户/接口数据拼进来——glyph/title/copy 走 esc() 转义，actionHtml 由调用方自负其为可信静态串。
  function truthEmpty(glyph, title, copy, actionHtml) {
    return '<div class="empty truth-empty"><div class="glyph">' + esc(glyph) + '</div><div><div class="t">' + esc(title) + '</div><p>' + esc(copy) + '</p>' + (actionHtml || '') + '</div></div>';
  }
  function mallCover(p, sizeStyle) {
    var g = mallGlyph(p);
    var tags = Array.isArray(p && p.tags) ? p.tags : [];
    var official = (p && p.author === '天命官方') || tags.indexOf('官方') >= 0;
    var ptype = String((p && p.type) || 'scenario');
    var tone = (window.TMWorkshopCovers && TMWorkshopCovers.tone) ? TMWorkshopCovers.tone(g) : 'zhu';
    var coverUrl = packCoverUrl(p);
    var resolvedCover = coverUrl || runtimeFallbackCover(p);
    var inner = (window.TMWorkshopCovers && TMWorkshopCovers.coverInner)
      ? TMWorkshopCovers.coverInner(g, { official: official, type: ptype, typeLabel: ptype !== 'scenario' ? packTypeLabel(ptype) : '' })
      : ('<span class="glyph">' + esc(g) + '</span>');
    inner = inner + '<img class="cover-img" src="' + esc(resolvedCover) + '" alt="" loading="lazy" decoding="async" onerror="this.remove()">' +
      '<span class="cover-provenance' + (coverUrl ? '' : ' truth-cover-fallback') + '">' + (coverUrl ? '投稿封面' : '题材底图 · 非投稿封面') + '</span>';
    return '<div class="cover ' + tone + '"' + (sizeStyle ? ' style="' + sizeStyle + '"' : '') + '>' + inner + '</div>';
  }
  function mallStars(p) {
    if (!hasMetric(p, 'rating') || !hasMetric(p, 'ratingCount') || Number(p.ratingCount) <= 0) {
      return '<span class="stars is-missing">— 暂无评分</span>';
    }
    var r = Number(p.rating);
    var full = Math.round(r);
    var s = '';
    for (var i = 1; i <= 5; i++) s += (i <= full ? '★' : '☆');
    return '<span class="stars">' + s + ' <i>' + r.toFixed(1) + ' · ' + esc(String(p.ratingCount)) + ' 人</i></span>';
  }
  function mallCard(p) {
    var tags = Array.isArray(p.tags) ? p.tags.filter(Boolean).slice(0, 3) : [];
    return '<div class="card" onclick="TMContentManager.openPackDetail(' + jsArg(p.id || '') + ')">' +
      mallCover(p) +
      '<div class="pad">' +
        '<h4>' + esc(p.title || p.id) + '</h4>' +
        '<div class="au">' + esc(p.author || '未署名') + (p.parentId ? ' · 改编' : '') + '</div>' +
        '<div class="rt">' + mallStars(p) + '<span>' + (hasMetric(p, 'downloads') ? '↓' + esc(String(p.downloads)) : '下载量未提供') + (hasMetric(p, 'endorsements') ? ' · ✦' + esc(String(p.endorsements)) : '') + '</span></div>' +
        (tags.length ? '<div class="tg">' + tags.map(function(t){ return '<span class="tag">' + esc(t) + '</span>'; }).join('') + '</div>' : '') +
      '</div>' +
    '</div>';
  }
  function mallSkeleton(n) {
    var cells = '';
    for (var i = 0; i < (n || 8); i++) {
      cells += '<div class="skel"><div class="sk-cover sk-shimmer"></div><div class="sk-pad"><div class="sk-line sk-shimmer" style="width:82%;"></div><div class="sk-line sk-shimmer" style="width:54%;height:9px;"></div><div class="sk-line sk-shimmer" style="width:40%;height:9px;"></div></div></div>';
    }
    return '<div class="skel-grid">' + cells + '</div>';
  }
  function mallTypeChips() {
    var ctype = state.catalogType || '';
    var featuredOn = !!state.featuredOn;
    var packs = (state.catalog && state.catalog.packs) || [];
    var feat = '<span class="chip' + (featuredOn ? ' on' : '') + '" onclick="TMContentManager.toggleFeatured()">✦ 正式精选</span>';
    return '<div class="typebar">' + feat + PACK_TYPES.map(function(t){
      var n = t.v ? packs.filter(function(pp){ return String(pp.type || 'scenario') === t.v; }).length : packs.length;
      return '<span class="chip' + (!featuredOn && ctype === t.v ? ' on' : '') + '" onclick="TMContentManager.switchCatalogType(' + jsArg(t.v) + ')">' + esc(t.label) + (packs.length ? ' ' + n : '') + '</span>';
    }).join('') + '</div>';
  }
  // ── R1·目录视图态（纯推导·全走 state 标记·绝不靠文案串匹配判断态）─────────────
  //   'error' 出错且无旧数据 → 错误卡（⚠+HTTP码+重试）
  //   'stale' 出错但有旧数据 → 列表上方横条 banner（列表照常渲染·提示当前可能是过期目录）
  //   'empty' 无错误无数据   → 真空卡
  //   'list'  无错误有数据   → 列表
  //   browse 与 discover 两处页面统一走此判定 + 下方两个卡/条 helper。
  function catalogViewState(state) {
    var hasData = !!(state && state.catalog && state.catalog.packs && state.catalog.packs.length);
    var hasError = !!(state && state.catalogError);
    if (hasError) return hasData ? 'stale' : 'error';
    return hasData ? 'list' : 'empty';
  }
  function catalogErrorCardHtml(st) {
    return '<div class="empty err"><div class="glyph">⚠</div><div class="t">在线目录加载出错</div><div>' + esc((st && st.catalogError) || '未知错误') + '</div><button class="btn sm primary" style="margin-top:10px;" onclick="TMContentManager.loadWorkshopCatalog()">重试</button></div>';
  }
  function catalogStaleBannerHtml(st) {
    return '<div class="status err" style="margin-bottom:10px;">⚠ 目录刷新失败（' + esc((st && st.catalogError) || '未知错误') + '）· 当前显示的可能是过期目录 <span style="cursor:pointer;color:var(--gold);text-decoration:underline;margin-left:8px;" onclick="TMContentManager.loadWorkshopCatalog()">重试</span></div>';
  }
  function renderDiscover() {
    var packs = (state.catalog && state.catalog.packs) || [];
    var vs = catalogViewState(state);
    var catalogReady = vs === 'list' || vs === 'stale' || state.catalogStatus === 'ok' || state.catalogStatus === 'fallback';
    var officialCount = packs.filter(function(p){
      return !!p.official || p.author === '天命官方' || (Array.isArray(p.tags) && p.tags.indexOf('官方') >= 0);
    }).length;
    var versionMeta = document.querySelector('meta[name="tm-version"]');
    var version = (state.status && state.status.currentVersion) || (versionMeta && versionMeta.content) || '';
    var originLabel = state.catalogStatus === 'fallback' ? '仓库内置官方清单' : '正式在线目录';
    var updatedAt = state.catalog && state.catalog.updatedAt ? String(state.catalog.updatedAt) : '更新时间未提供';
    var heroHtml = '<div class="searchhero atelier-discovery-lead"><div class="atelier-lead-copy"><small>CATALOGUE STATUS · ' + esc(originLabel) + '</small>' +
      '<h2>' + packs.length + ' 件真实收录</h2><p>未返回的评分、下载量、版本与素材字段统一显示“未提供”，不会用样例或零值补齐。' + (updatedAt ? ' · ' + esc(updatedAt) : '') + '</p></div>' +
      '<dl class="atelier-catalog-facts"><div><dt>' + packs.length + '</dt><dd>目录总数</dd></div><div><dt>' + officialCount + '</dt><dd>官方内容</dd></div><div><dt>' + (packs.length - officialCount) + '</dt><dd>社区内容</dd></div><div><dt>' + esc(version || '—') + '</dt><dd>仓库版本</dd></div></dl>' +
      '<div class="box"><input id="tm-mall-hq" value="' + esc(state.catalogQuery || '') + '" placeholder="输入朝代、事件、人物或作者…" onkeydown="if(event.key===\'Enter\')TMContentManager.mallSearch(this.value)"><button class="btn primary" onclick="TMContentManager.mallSearch(document.getElementById(\'tm-mall-hq\').value)">搜索真源</button></div></div>';

    if (state.catalogLoading || state.catalogStatus === 'loading') {
      return heroHtml + '<div class="sec-h"><h3>正在读取正式目录</h3></div>' + mallSkeleton(8);
    }
    if (!catalogReady) {
      return heroHtml + (vs === 'error'
        ? catalogErrorCardHtml(state)
        : truthEmpty('检', '目录来源不可用', state.catalogError || '正式目录与仓库清单均未能读取。', '<button class="btn primary sm" onclick="TMContentManager.refreshWorkshopSources()">重试真源</button>'));
    }

    var formalFeatured = state.featuredStatus === 'ok' && Array.isArray(state.featuredPacks) ? state.featuredPacks : [];
    var feat = formalFeatured[0] || null;
    var fside = formalFeatured.slice(1, 4);
    var featuredHtml;
    if (feat) {
      var featBanner = '<div class="feat-main" onclick="TMContentManager.openPackDetail(' + jsArg(feat.id || '') + ')">' +
        mallCover(feat, 'position:absolute;inset:0;width:100%;height:100%;border:none;') +
        '<div class="ov"><div class="kick">正式精选接口返回 · ' + (packCoverUrl(feat) ? '投稿封面' : '题材底图非投稿封面') + '</div>' +
          '<h2>' + esc(feat.title || feat.id) + '</h2><p>' + esc(feat.description || '发布者未填写简介。') + '</p>' +
          '<div class="row">' + mallStars(feat) + '<span class="atelier-feature-metric">' + metricText(feat, 'downloads', '↓', '') + '</span>' +
            '<button class="btn primary" onclick="event.stopPropagation();TMContentManager.openPackDetail(' + jsArg(feat.id || '') + ')">展开真实卷宗</button></div></div></div>';
      var fsideHtml = fside.map(function(p){
        return '<div class="fs" onclick="TMContentManager.openPackDetail(' + jsArg(p.id || '') + ')">' + mallCover(p, 'width:62px;height:62px;font-size:26px;') +
          '<div><b>' + esc(p.title || p.id) + '</b><small>' + esc(p.author || '未署名') + ' · ' + metricText(p, 'downloads', '↓', '') + '</small></div></div>';
      }).join('') || '<div class="fs is-empty"><div><b>仅返回 1 件精选</b><small>未伪造其他推荐位</small></div></div>';
      featuredHtml = '<div class="feature truth-feature">' + featBanner + '<div class="feat-side">' + fsideHtml + '</div></div>';
    } else if (state.featuredStatus === 'loading') {
      featuredHtml = mallSkeleton(2);
    } else if (state.featuredStatus === 'ok') {
      featuredHtml = truthEmpty('精', '正式精选当前为空', '精选接口返回 0 件内容；这里不拿普通目录记录伪装精选。');
    } else {
      featuredHtml = truthEmpty('精', '正式精选接口不可用', state.featuredError || '无法读取正式精选。');
    }

    var hot = packs.filter(function(p){ return hasMetric(p, 'downloads'); }).sort(function(a, b){ return Number(b.downloads) - Number(a.downloads); });
    var hotSection;
    if (hot.length) {
      var hotGrid = hot.slice(0, 8).map(mallCard).join('');
      var rail = hot.slice(0, 6).map(function(p, i){
        return '<div class="rk" onclick="TMContentManager.openPackDetail(' + jsArg(p.id || '') + ')"><div class="n' + (i < 3 ? ' top' : '') + '">' + (i + 1) + '</div>' +
          '<div class="t"><b>' + esc(p.title || p.id) + '</b><small>' + esc(p.author || '未署名') + ' · ↓' + esc(String(p.downloads)) + '</small></div></div>';
      }).join('');
      hotSection = '<div class="cols"><div><div class="grid">' + hotGrid + '</div></div><aside><div class="rail"><h4>下载榜</h4>' + rail + '</div>' +
        '<div class="becre"><b>成为创作者</b><p>登录后可发布真实剧本与素材包，并进入现有审核流程。</p><button class="btn primary sm" onclick="TMContentManager.switchPane(\'studio\')">前往创作</button></div></aside></div>';
    } else {
      hotSection = truthEmpty('榜', '暂无可排行下载量', '当前正式目录没有返回下载量字段，作品不会被按零下载伪排序。');
    }

    return heroHtml + (vs === 'stale' ? catalogStaleBannerHtml(state) : '') + (state.catalogStatus === 'fallback' ? '<div class="status atelier-fallback-note">正式在线目录不可用；当前只展示仓库内置官方清单。</div>' : '') +
      mallTypeChips() +
      '<div class="sec-h"><h3>正式精选</h3><span class="more" onclick="TMContentManager.toggleFeatured()">查看精选目录 ›</span></div>' + featuredHtml +
      '<div class="sec-h"><h3>按类浏览</h3></div><div class="cats">' + PACK_TYPES.filter(function(t){ return t.v; }).map(function(t){
        var n = packs.filter(function(pp){ return String(pp.type || 'scenario') === t.v; }).length;
        return '<div class="cat" onclick="TMContentManager.switchCatalogType(' + jsArg(t.v) + ');TMContentManager.switchPane(\'browse\')"><div class="g">' + esc(t.label.charAt(0)) + '</div><b>' + esc(t.label) + '</b><small>' + n + ' 件</small></div>';
      }).join('') + '</div>' +
      '<div class="sec-h"><h3>热门下载</h3><span class="more" onclick="TMContentManager.switchPane(\'ranks\')">完整榜单 ›</span></div>' + hotSection;
  }
  function mallFopt(label, count, active, onclick) {
    return '<div class="fopt" onclick="' + onclick + '"><span style="margin-left:0;color:' + (active ? 'var(--gold-bright)' : 'var(--ink-faint)') + ';">' + (active ? '◉' : '○') + '</span>' + esc(label) + '<span>' + (count != null ? count : '') + '</span></div>';
  }
  function renderBrowsePane() {
    var packs = (state.catalog && state.catalog.packs) || [];
    var vs = catalogViewState(state);
    var ctype = state.catalogType || '';
    var featuredOn = !!state.featuredOn;
    var base = featuredOn ? (state.featuredPacks || []) : packs;
    var shown = (!featuredOn && ctype) ? base.filter(function(pp){ return String(pp.type || 'scenario') === ctype; }) : base;
    var grid;
    if (shown.length) grid = shown.map(mallCard).join('');
    else if (state.catalogLoading || (featuredOn && state.featuredStatus === 'loading')) grid = mallSkeleton(8);
    else if (featuredOn && state.featuredStatus === 'error') grid = truthEmpty('精', '正式精选接口不可用', state.featuredError || '无法读取正式精选。');
    else if (featuredOn) grid = truthEmpty('精', '正式精选当前为空', '精选接口返回 0 件内容；不会拿普通目录记录补位。');
    else if (vs === 'error') grid = catalogErrorCardHtml(state);
    else if (state.catalogStatus === 'error') grid = truthEmpty('检', '目录来源不可用', state.catalogError || '无法读取正式目录。');
    else grid = truthEmpty('坊', packs.length ? '此类型下暂无内容' : '正式目录当前为空', packs.length ? '换个类型或来源看看。' : '目录返回 0 件内容。');
    var typeOpts = PACK_TYPES.map(function(t){
      var n = t.v ? packs.filter(function(pp){ return String(pp.type || 'scenario') === t.v; }).length : packs.length;
      return mallFopt(t.label, n, !featuredOn && ctype === t.v, 'TMContentManager.switchCatalogType(' + jsArg(t.v) + ')');
    }).join('');
    var authorView = state.catalogAuthorView;
    var head = authorView ? ('作者：' + authorView) : (featuredOn ? '正式精选' : (ctype ? packTypeLabel(ctype) : '全部内容'));
    return (authorView ? '<div class="status" style="margin-bottom:10px;">正在看作者「' + esc(authorView) + '」的作品 <span style="cursor:pointer;color:var(--gold);text-decoration:underline;margin-left:8px;" onclick="TMContentManager.loadWorkshopCatalog()">← 返回全部目录</span></div>' : '') +
    (vs === 'stale' ? catalogStaleBannerHtml(state) : '') +
    '<div class="browse">' +
      '<aside class="filters">' +
        '<h4>筛选</h4>' +
        '<div class="fgrp"><div class="flbl">内容类型</div>' + typeOpts + '</div>' +
        '<div class="fgrp"><div class="flbl">来源</div>' + mallFopt('✦ 正式精选', null, featuredOn, 'TMContentManager.toggleFeatured()') + '</div>' +
        '<div class="fgrp"><div class="flbl">排序</div><select id="tm-workshop-sort" class="sortsel" style="width:100%;" onchange="TMContentManager.loadWorkshopCatalog()">' +
          '<option value="new"' + (!state.catalogSort || state.catalogSort === 'new' ? ' selected' : '') + '>最新</option>' +
          '<option value="hot"' + (state.catalogSort === 'hot' ? ' selected' : '') + '>最热（下载）</option>' +
          '<option value="rating"' + (state.catalogSort === 'rating' ? ' selected' : '') + '>评分最高</option>' +
        '</select></div>' +
        '<div class="fgrp"><button class="btn sm" style="width:100%;" onclick="TMContentManager.loadWorkshopCatalog()">刷新目录</button></div>' +
      '</aside>' +
      '<div><div class="browse-head"><b>' + esc(head) + '</b><small>' + shown.length + ' 件</small></div>' +
        '<div class="grid">' + grid + '</div></div>' +
    '</div>';
  }
  function renderRanksPane() {
    var packs = ((state.catalog && state.catalog.packs) || []).slice();
    if (state.catalogStatus === 'loading') return '<div class="sec-h"><h3>百工榜</h3></div>' + mallSkeleton(6);
    if (state.catalogStatus === 'error') return '<div class="sec-h"><h3>百工榜</h3></div>' + truthEmpty('榜', '目录来源不可用', state.catalogError || '无法读取正式目录。');
    function rankList(arr, fmt, emptyCopy) {
      if (!arr.length) return '<div class="rank-empty">' + esc(emptyCopy) + '</div>';
      return arr.slice(0, 10).map(function(p, i){
        return '<div class="rk" onclick="TMContentManager.openPackDetail(' + jsArg(p.id || '') + ')"><div class="n' + (i < 3 ? ' top' : '') + '">' + (i + 1) + '</div>' +
          '<div class="t"><b>' + esc(p.title || p.id) + '</b><small>' + esc(p.author || '未署名') + ' · ' + fmt(p) + '</small></div></div>';
      }).join('');
    }
    var byDown = packs.filter(function(p){ return hasMetric(p, 'downloads'); }).sort(function(a, b){ return Number(b.downloads) - Number(a.downloads); });
    var byRate = packs.filter(function(p){ return hasMetric(p, 'rating') && hasMetric(p, 'ratingCount') && Number(p.ratingCount) > 0; }).sort(function(a, b){ return Number(b.rating) - Number(a.rating); });
    var byEnd = packs.filter(function(p){ return hasMetric(p, 'endorsements'); }).sort(function(a, b){ return Number(b.endorsements) - Number(a.endorsements); });
    return '<div class="sec-h"><h3>百工榜</h3><span class="more">只按正式目录实际字段排序</span></div>' +
      '<div class="cols atelier-rank-columns" style="grid-template-columns:1fr 1fr 1fr;">' +
        '<div class="rail"><h4>下载榜</h4>' + rankList(byDown, function(p){ return '↓' + esc(String(p.downloads)); }, '正式目录没有返回下载量字段。') + '</div>' +
        '<div class="rail"><h4>口碑榜</h4>' + rankList(byRate, function(p){ return '★' + Number(p.rating).toFixed(1) + ' · ' + esc(String(p.ratingCount)) + ' 人'; }, '暂无有效评分——首个评分从你开始。') + '</div>' +
        '<div class="rail"><h4>社区推荐榜</h4>' + rankList(byEnd, function(p){ return '✦' + esc(String(p.endorsements)); }, '正式目录没有返回推荐量字段。') + '</div>' +
      '</div>';
  }
  function renderArenaSection() {
    if (!state.arenasLoaded && !state.arenasLoading) { try { setTimeout(loadArenas, 0); } catch (e) {} }
    var arenas = state.arenaList || [];
    var cards = arenas.length ? '<div class="grid" style="grid-template-columns:repeat(2,minmax(0,1fr));">' + arenas.map(function(a){
      return '<div class="card" style="cursor:pointer;" onclick="TMContentManager.openArena(' + Number(a.id) + ')"><div class="pad">' +
        '<h4>' + esc(a.title || '未命名擂台') + '</h4><div class="au">擂主 ' + esc(a.creatorNick || '未署名') + ' · ' + (a.metric ? '比' + esc(ARENA_METRIC[a.metric] || a.metric) : '指标未提供') + '</div>' +
        '<div class="rt"><span>' + (hasMetric(a, 'entries') ? esc(String(a.entries)) + ' 人上榜' : '战绩数未提供') + '</span><span style="color:var(--gold);">看榜 ›</span></div></div></div>';
    }).join('') + '</div>'
      : (state.arenasLoading ? mallSkeleton(4) : (state.arenaStatus === 'error'
        ? truthEmpty('擂', '正式擂台接口不可用', state.arenaError || '无法读取正式擂台。')
        : truthEmpty('擂', '正式擂台当前为空', '接口返回 0 个擂台；可登录后开第一擂。')));
    var creator = loggedInNow()
      ? '<div class="composer" style="margin-bottom:14px;"><div style="display:flex;gap:8px;flex-wrap:wrap;">' +
          '<input id="tm-arena-title" class="input" style="flex:1;min-width:200px;" placeholder="擂台标题，如「天启七年·看谁的崇祯活最久」">' +
          '<input id="tm-arena-scn" class="input" style="width:150px;" placeholder="剧本ID(可选)">' +
          '<select id="tm-arena-metric" class="input" style="width:130px;">' + Object.keys(ARENA_METRIC).map(function(k){ return '<option value="' + k + '">比' + ARENA_METRIC[k] + '</option>'; }).join('') + '</select>' +
          '<button class="btn primary sm" onclick="TMContentManager.createArenaUI()">开擂台</button></div></div>'
      : '';
    return '<div class="sec-h"><h3>擂台 · 同台竞史</h3></div>' +
      (state.arenasMsg ? '<div class="status" style="margin-bottom:10px;">' + esc(state.arenasMsg) + '</div>' : '') +
      creator + cards;
  }
  function promoScene(glyph, type) {
    return (window.TMWorkshopCovers && TMWorkshopCovers.sceneSVG) ? TMWorkshopCovers.sceneSVG(glyph, type) : '';
  }
  function promoCard(o) {
    return '<div class="promo ' + (o.cls || '') + '" onclick="' + o.onclick + '">' +
      '<div class="pscene cover ' + (o.tone || 'zhu') + '" style="border:none;">' + promoScene(o.glyph, o.type) + '</div>' +
      '<span class="pseal serif">' + esc(o.glyph) + '</span>' +
      '<div class="t"><b>' + esc(o.title) + '</b><small>' + esc(o.sub) + '</small></div></div>';
  }
  function renderTopicsPane() {
    var plays = [
      { glyph: '卷', tone: 'zhu', type: 'scenario', title: '剧本卷宗', sub: '筛选正式目录中的剧本记录', cls: '', onclick: 'TMContentManager.switchCatalogType(\'scenario\');TMContentManager.switchPane(\'browse\')' },
      { glyph: '绘', tone: 'jiang', type: 'portrait', title: '立绘素材', sub: '筛选正式目录中的立绘包', cls: 'c', onclick: 'TMContentManager.switchCatalogType(\'portrait\');TMContentManager.switchPane(\'browse\')' },
      { glyph: '音', tone: 'dai', type: 'music', title: '音乐素材', sub: '筛选正式目录中的音乐包', cls: 'b', onclick: 'TMContentManager.switchCatalogType(\'music\');TMContentManager.switchPane(\'browse\')' }
    ];
    return '<div class="sec-h"><h3>内容门类 · 目录筛选</h3><span class="more">导航入口，不冒充策展专题</span></div>' +
      '<div class="promos">' + plays.map(promoCard).join('') + '</div>' +
      renderCollectionSection();
  }
  function renderCollectionSection() {
    if (!state.collectionsLoaded && !state.collectionsLoading) { try { setTimeout(loadCollections, 0); } catch (e) {} }
    var cols = state.collectionList || [];
    var cards = cols.length ? '<div class="grid" style="grid-template-columns:repeat(3,minmax(0,1fr));">' + cols.map(function(c){
      return '<div class="card" style="cursor:pointer;" onclick="TMContentManager.openCollection(' + Number(c.id) + ')"><div class="pad">' +
        '<h4>' + esc(c.title || '未命名合集') + '</h4><div class="au">' + esc(c.ownerNick || '未署名') + ' 策展 · ' + (hasMetric(c, 'count') ? esc(String(c.count)) + ' 件' : '件数未提供') + '</div>' +
        (c.description ? '<div class="rt"><span style="color:var(--ink-faint);">' + esc(c.description) + '</span></div>' : '') + '</div></div>';
    }).join('') + '</div>'
      : (state.collectionsLoading ? mallSkeleton(3) : (state.collectionStatus === 'error'
        ? truthEmpty('集', '正式合集接口不可用', state.collectionError || '无法读取正式合集。')
        : truthEmpty('集', '正式合集当前为空', '接口返回 0 个合集；可登录后创建第一辑。')));
    var creator = loggedInNow()
      ? '<div class="composer" style="margin-bottom:14px;"><div style="display:flex;gap:8px;flex-wrap:wrap;">' +
          '<input id="tm-col-title" class="input" style="flex:1;min-width:180px;" placeholder="合集标题，如「明末入坑五部曲」">' +
          '<input id="tm-col-desc" class="input" style="flex:1;min-width:160px;" placeholder="一句策展语(可选)">' +
          '<button class="btn primary sm" onclick="TMContentManager.createCollectionUI()">建合集</button></div></div>'
      : '';
    return '<div class="sec-h"><h3>鉴赏家合集</h3></div>' +
      (state.collectionsMsg ? '<div class="status" style="margin-bottom:10px;">' + esc(state.collectionsMsg) + '</div>' : '') +
      creator + cards;
  }
  // ===== 我的合集（「我」页策展·服务端 collections(?ownerId) 按主人筛，非 nick 匹配） =====
  function loadMyCollections() {
    var uid = selfId();
    if (uid == null || !(window.TM && TM.OnlineClient && TM.OnlineClient.collections)) {
      state.myCollectionList = []; state.myCollectionsLoaded = true; state.myCollectionsLoading = false;
      state.myCollectionsStatus = 'error'; state.myCollectionsError = '正式合集接口未加载'; render(); return;
    }
    state.myCollectionsLoading = true;
    state.myCollectionsStatus = 'loading'; state.myCollectionsError = '';
    TM.OnlineClient.collections(uid, state.onlineApiUrl || undefined).then(function(res){
      if (!res || res.success === false) throw new Error((res && res.error) || '正式合集接口返回失败');
      state.myCollectionList = Array.isArray(res.collections) ? res.collections : [];
      state.myCollectionsLoaded = true; state.myCollectionsLoading = false;
      state.myCollectionsStatus = 'ok'; state.myCollectionsError = ''; render();
    }).catch(function(error){
      state.myCollectionList = []; state.myCollectionsLoaded = true; state.myCollectionsLoading = false;
      state.myCollectionsStatus = 'error'; state.myCollectionsError = (error && error.message) || '正式合集接口不可用'; render();
    });
  }
  function createMyCollectionUI() {
    var t = document.getElementById('tm-mycol-title'), d = document.getElementById('tm-mycol-desc');
    var title = t ? t.value.trim() : '';
    if (!title) { state.myCollectionsMsg = '请填写合集标题。'; render(); return; }
    TM.OnlineClient.createCollection({ title: title, description: d ? d.value.trim() : '' }, state.onlineApiUrl || undefined).then(function(res){
      if (res && res.success) { state.myCollectionsMsg = '合集已建。'; state.myCollectionsLoaded = false; loadMyCollections(); }
      else { state.myCollectionsMsg = '建合集失败：' + ((res && res.error) || ''); render(); }
    }).catch(function(){ state.myCollectionsMsg = '建合集失败。'; render(); });
  }
  function renderMyCollections() {
    if (!state.myCollectionsLoaded && !state.myCollectionsLoading) { try { setTimeout(loadMyCollections, 0); } catch (e) {} }
    var cols = state.myCollectionList || [];
    var cards = cols.length ? '<div class="grid" style="grid-template-columns:repeat(3,minmax(0,1fr));">' + cols.map(function(c){
      return '<div class="card" style="cursor:pointer;" onclick="TMContentManager.openCollection(' + Number(c.id) + ')"><div class="pad"><h4>' + esc(c.title || '未命名合集') + '</h4><div class="au">' + (hasMetric(c, 'count') ? esc(String(c.count)) + ' 件' : '件数未提供') + '</div>' + (c.description ? '<div class="rt"><span style="color:var(--ink-faint);">' + esc(c.description) + '</span></div>' : '') + '</div></div>';
    }).join('') + '</div>' : (state.myCollectionsLoading ? mallSkeleton(3) : (state.myCollectionsStatus === 'error'
      ? truthEmpty('集', '我的合集接口不可用', state.myCollectionsError || '无法读取正式合集。')
      : truthEmpty('集', '还没有合集', '正式接口返回 0 个合集；把好作品策成一辑，分享给同好。')));
    var creator = '<div class="composer" style="margin:10px 0 4px;"><div style="display:flex;gap:8px;flex-wrap:wrap;"><input id="tm-mycol-title" class="input" style="flex:1;min-width:180px;" placeholder="合集标题，如「明末入坑五部曲」"><input id="tm-mycol-desc" class="input" style="flex:1;min-width:160px;" placeholder="一句策展语(可选)"><button class="btn primary sm" onclick="TMContentManager.createMyCollectionUI()">建合集</button></div></div>';
    return (state.myCollectionsMsg ? '<div class="status" style="margin-bottom:10px;">' + esc(state.myCollectionsMsg) + '</div>' : '') + creator + cards;
  }
  // ===== A 史馆动态流 =====
  var FEED_TYPE_LABEL = { highlight: '局势高光', publish: '新作发布', chronicle: '史册落成', relay: '接龙邀请', milestone: '里程碑' };
  function loadFeed() {
    if (!(window.TM && TM.OnlineClient && TM.OnlineClient.feed)) {
      state.feedData = { posts: [] }; state.feedLoaded = true; state.feedLoading = false;
      state.feedStatus = 'error'; state.feedError = '正式动态接口未加载'; render(); return;
    }
    var scope = state.feedScope || 'recommend';
    state.feedLoading = true;
    state.feedStatus = 'loading'; state.feedError = '';
    TM.OnlineClient.feed(scope, 1, state.onlineApiUrl || undefined).then(function(res){
      if ((state.feedScope || 'recommend') !== scope) return;
      if (!res || res.success === false) throw new Error((res && res.error) || '正式动态接口返回失败');
      state.feedData = Object.assign({}, res, { posts: Array.isArray(res.posts) ? res.posts : [] });
      state.feedLoaded = true; state.feedLoading = false; state.feedStatus = 'ok'; state.feedError = ''; render();
    }).catch(function(e){
      if ((state.feedScope || 'recommend') !== scope) return;   // F2·与 .then 同守卫：旧 scope 请求网络层 reject 晚到不再把错误态盖到当前页。
      state.feedData = { posts: [] }; state.feedLoaded = true; state.feedLoading = false;
      state.feedStatus = 'error'; state.feedError = (e && e.message) || '正式动态接口不可用';
      state.feedMsg = '动态载入失败：' + state.feedError; render();
    });
  }
  function submitFeedPost() {
    if (!(window.TM && TM.OnlineClient && TM.OnlineClient.isLoggedIn())) { state.feedMsg = '请先登录再发动态。'; render(); return; }
    var bodyEl = document.getElementById('tm-feed-body');
    var metEl = document.getElementById('tm-feed-metrics');
    var body = bodyEl ? bodyEl.value.trim() : '';
    var metricsRaw = metEl ? metEl.value.trim() : '';
    if (!body && !metricsRaw) { state.feedMsg = '写点什么再发吧。'; render(); return; }
    var metrics = metricsRaw ? metricsRaw.split(/[\s,，]+/).filter(Boolean).slice(0, 12) : [];
    state.feedMsg = '正在发布…'; render();
    TM.OnlineClient.postFeed({ type: 'highlight', body: body, metrics: metrics }, state.onlineApiUrl || undefined).then(function(res){
      if (res && res.success) { state.feedMsg = '动态已发布。'; state.feedScope = 'recommend'; state.feedLoaded = false; loadFeed(); }
      else { state.feedMsg = '发布失败：' + ((res && res.error) || '未知错误'); render(); }
    }).catch(function(e){ state.feedMsg = '发布失败：' + (e && e.message || '未知'); render(); });
  }
  // 发布作品后自动发一条「新作发布」动态（fire-and-forget，不阻塞发布流，失败静默）
  function autoPostPublish(title, ptype, packId) {
    try {
      if (!(window.TM && TM.OnlineClient && TM.OnlineClient.isLoggedIn())) return;
      var noun = packTypeNoun(ptype || 'scenario');
      TM.OnlineClient.postFeed({
        type: 'publish',
        body: '发布了' + noun + '《' + title + '》。',
        refs: { packId: packId || '', packTitle: title }
      }, state.onlineApiUrl || undefined).catch(function(){});
    } catch (e) {}
  }
  function likeFeedPost(id) {
    if (!(window.TM && TM.OnlineClient && TM.OnlineClient.isLoggedIn())) { state.feedMsg = '登录后可点赞。'; render(); return; }
    var posts = (state.feedData && state.feedData.posts) || [];
    var p = null; for (var i = 0; i < posts.length; i++) { if (String(posts[i].id) === String(id)) { p = posts[i]; break; } }
    var prior = p ? { liked: !!p.liked, likes: p.likes, hadLikes: hasMetric(p, 'likes') } : null;
    if (p && prior.hadLikes) { p.liked = !p.liked; p.likes = Math.max(0, Number(p.likes) + (p.liked ? 1 : -1)); render(); } // 只对已知计数乐观更新
    TM.OnlineClient.likePost(id, state.onlineApiUrl || undefined).then(function(res){
      if (res && res.success && p) { p.liked = !!res.liked; if (res.likes != null) p.likes = res.likes; render(); }
    }).catch(function(){
      if (!p || !prior) return;
      p.liked = prior.liked;
      if (prior.hadLikes) p.likes = prior.likes; else delete p.likes;
      render();
    });
  }
  function feedMetricChips(metrics) {
    if (!Array.isArray(metrics) || !metrics.length) return '';
    return '<div class="post-metrics">' + metrics.map(function(m){
      var s = (typeof m === 'string') ? m : ((m.label || '') + ' ' + (m.value != null ? m.value : (m.delta != null ? m.delta : '')));
      return '<span class="pm">' + esc(String(s).trim()) + '</span>';
    }).join('') + '</div>';
  }
  function feedCard(post) {
    post = post || {};
    var nick = post.authorNick || post.author || '佚名';
    var av = '<div class="av seal">' + esc(String(nick).charAt(0)) + '</div>';
    var rank = post.authorRank ? '<span class="rank-chip">' + esc(post.authorRank) + '</span>' : '';
    var typeLabel = FEED_TYPE_LABEL[post.type] || '动态';
    var when = esc(post.createdAt || '');
    var ref = post.refs || {};
    var refLink = (ref.packId) ? '<div class="post-ref" onclick="TMContentManager.openPackDetail(' + jsArg(ref.packId) + ')">› ' + esc(ref.packTitle || ref.packId) + '</div>' : '';
    var img = post.imageRef ? '<div class="post-img"><span>' + esc(String(post.title || nick).charAt(0)) + '</span></div>' : '';
    var liked = !!post.liked;
    return '<div class="post">' +
      '<div class="post-head">' + av + '<div class="ph-id"><b>' + esc(nick) + '</b>' + rank + '<small>' + when + ' · ' + esc(typeLabel) + '</small></div></div>' +
      (post.title ? '<div class="post-title">' + esc(post.title) + '</div>' : '') +
      (post.body ? '<div class="post-body">' + esc(post.body) + '</div>' : '') +
      img + feedMetricChips(post.metrics) + refLink +
      '<div class="post-acts">' +
        '<span class="pa' + (liked ? ' on' : '') + '" onclick="TMContentManager.likeFeedPost(' + jsArg(post.id) + ')">♡ ' + (hasMetric(post, 'likes') ? esc(String(post.likes)) : '未提供') + '</span>' +
        '<span class="pa">评 ' + (hasMetric(post, 'commentCount') ? esc(String(post.commentCount)) : '未提供') + '</span>' +
        (ref.scenarioId ? '<span class="pa" onclick="TMContentManager.openChronicles(' + jsArg(ref.scenarioId) + ')">↪ 引用接龙</span>' : '') +
      '</div>' +
    '</div>';
  }
  function renderFeedPane() {
    var loggedIn = !!(state.accountSession && state.accountSession.user) || (window.TM && TM.OnlineClient && TM.OnlineClient.isLoggedIn());
    var scope = state.feedScope || 'recommend';
    if (!state.feedLoaded && !state.feedLoading) { try { setTimeout(loadFeed, 0); } catch (e) {} }
    var posts = (state.feedData && state.feedData.posts) || [];
    var tabs = '<div class="subnav">' +
      '<a class="' + (scope === 'following' ? 'on' : '') + '" onclick="TMContentManager.switchFeedScope(\'following\')">关注</a>' +
      '<a class="' + (scope === 'recommend' ? 'on' : '') + '" onclick="TMContentManager.switchFeedScope(\'recommend\')">推荐</a>' +
    '</div>';
    var composer = loggedIn
      ? '<div class="composer">' +
          '<textarea id="tm-feed-body" class="input" rows="2" placeholder="记一笔今日时局——史笔留痕，如：天启七年冬，陕西民变平，三月血战终立皇威。"></textarea>' +
          '<input id="tm-feed-metrics" class="input" placeholder="数值变化（可选，空格分隔，如：皇威+12 民心38→61 存续3年）">' +
          '<div style="display:flex;justify-content:flex-end;margin-top:8px;"><button class="btn primary sm" onclick="TMContentManager.submitFeedPost()">发布动态</button></div>' +
        '</div>'
      : '<div class="status" style="margin-bottom:12px;">登录后可发动态、关注作者、点赞。到「我」登录。</div>';
    var body = state.feedLoading
      ? '<div class="empty"><div class="glyph">邸</div><div class="t">正在汇集动态…</div></div>'
      : (state.feedStatus === 'error'
          ? truthEmpty('邸', '正式动态接口不可用', state.feedError || '无法读取正式动态。')
      : (posts.length
          ? posts.map(feedCard).join('')
          : truthEmpty('邸', scope === 'following' ? '关注的人还没有新动态' : '正式动态当前为空', loggedIn ? '接口返回 0 条记录；可发布第一条今日时局。' : '接口返回 0 条记录；登录后可关注作者或发布动态。')));
    return '<div class="sec-h"><h3>史馆动态</h3><span class="more" onclick="TMContentManager.refreshFeed()">刷新 ›</span></div>' +
      tabs + composer +
      (state.feedMsg ? '<div class="status" style="margin-bottom:10px;">' + esc(state.feedMsg) + '</div>' : '') +
      '<div class="feed-list">' + body + '</div>';
  }

  function renderMallPane(pane) {
    if (pane === 'discover') return renderDiscover();
    if (pane === 'feed') return renderFeedPane();
    if (pane === 'browse') return renderBrowsePane();
    if (pane === 'ranks') return renderRanksPane();
    if (pane === 'arenas') return renderArenaSection();
    if (pane === 'topics') return renderTopicsPane();
    if (pane === 'circles') return renderCirclesPane();
    if (pane === 'studio') return renderStudioPane();
    if (pane === 'commissions') return renderCommissionSection();
    if (pane === 'friends') return renderFriendsPaneMall();
    if (pane === 'updates') return renderUpdatesPaneMall();
    if (pane === 'me') return renderMePane();
    return renderDiscover();
  }

  // 创作中心（发布 + AI 共创）—— 桌面/网页同一套：从剧本库选剧本上传，或多文件打包资源。
  function publishDraft() {
    if (!state.publishDraft) state.publishDraft = { version: '1.0.0', title: '', tags: '', desc: '', notes: '' };
    if (!state.publishDraft.version) state.publishDraft.version = '1.0.0';
    return state.publishDraft;
  }

  function capturePublishDraft() {
    var d = publishDraft();
    var title = document.getElementById('tm-webpub-title');
    var version = document.getElementById('tm-webpub-version');
    var tags = document.getElementById('tm-webpub-tags');
    var desc = document.getElementById('tm-webpub-desc');
    var notes = document.getElementById('tm-webpub-notes');
    var type = document.getElementById('tm-pub-type');
    if (title) d.title = title.value.trim();
    if (version) d.version = version.value.trim();
    if (tags) d.tags = tags.value.trim();
    if (desc) d.desc = desc.value.trim();
    if (notes) d.notes = notes.value.trim();
    if (type) state.pubType = type.value || state.pubType;
    return d;
  }

  function fileLine(file, fallback) {
    if (!file) return fallback || '未选择';
    return file.name + ' · ' + formatBytes(file.size || 0);
  }

  function publishStep(label, done) {
    return '<div class="pub-step ' + (done ? 'done' : '') + '"><span>' + (done ? '✓' : '·') + '</span><b>' + esc(label) + '</b></div>';
  }

  function publishStoreReady() {
    var d = publishDraft();
    return !!(d.title && d.version && d.desc);
  }

  function publishPackageReady() {
    return !!state.publishPackageFile;
  }

  function publishCoverHtml() {
    var url = state.publishCoverUrl || '';
    if (url) return '<img src="' + esc(url) + '" alt="">';
    return '<div class="up-empty"><div class="up-ic">图</div><b>上传封面</b><small>建议 16:9 或 4:3，用于商店卡片和详情页头图</small></div>';
  }

  function publishGalleryHtml() {
    var files = state.publishGalleryFiles || [];
    if (!files.length) return '<div class="pub-shot empty">展示图</div>';
    return files.slice(0, 4).map(function(file, i){
      var urls = state.publishGalleryUrls || [];
      var url = urls[i] || '';
      return '<div class="pub-shot">' + (url ? '<img src="' + esc(url) + '" alt="">' : '<span>' + esc(String(file.name || '').charAt(0) || '图') + '</span>') + '</div>';
    }).join('');
  }

  function renderStudioPane() {
    var user = (state.accountSession || {}).user;
    var pt = state.pubType || 'mod';
    state.pubType = pt;
    var d = publishDraft();
    var typeSel = '<select id="tm-pub-type" class="input" onchange="TMContentManager.switchPubType(this.value)">' + PACK_TYPES.filter(function(t){ return t.v; }).map(function(t){ return '<option value="' + t.v + '"' + (pt === t.v ? ' selected' : '') + '>' + esc(t.label) + '</option>'; }).join('') + '</select>';
    // B1：页内打包器 accept——随「商店分类」过滤散文件类型（组合类 mod 收全部三类）。
    var looseAccept = pt === 'portrait' ? 'image/*,.png,.jpg,.jpeg,.webp,.bmp'
      : pt === 'music' ? 'audio/*,.mp3,.ogg,.wav'
      : pt === 'map' ? '.json,.geojson,application/json,application/geo+json'
      : pt === 'scenario' ? '.json,application/json'
      : 'image/*,audio/*,.png,.jpg,.jpeg,.webp,.bmp,.mp3,.ogg,.wav,.json,.geojson';
    var canSubmit = !!(user && publishPackageReady());
    var fork = (state.forkSource && state.forkSource.id) ? '<div class="status">改编自「' + esc(state.forkSource.title || state.forkSource.id) + '」，发布后记入它的世界线。 <span style="cursor:pointer;color:var(--gold);text-decoration:underline;" onclick="TMContentManager.clearFork()">取消改编</span></div>' : '';
    return '<div class="sec-h"><h3>创作中心 · 发布申请</h3><span class="more">资源包 + 商店信息齐备后进入审核</span></div>' +
      fork +
      (desktop() ? '' : '<div class="status" style="margin:0 0 10px;">网页版可浏览与安装；发布投稿请使用桌面版。</div>') +
      '<div class="pub-flow">' +
        '<div class="pub-steps">' +
          publishStep('投稿资源包', publishPackageReady()) +
          publishStep('商店信息', publishStoreReady()) +
          publishStep('提交审核', canSubmit && publishStoreReady()) +
        '</div>' +
        '<div class="pub-grid pub-grid-v2">' +
          '<section class="pub-card pub-resource">' +
            '<div class="pub-card-head"><span>1</span><div><b>导入投稿资源</b><small>直接选择创作者已经打好的 .tm-pack 或 .zip；页面不再负责制作内容本体</small></div></div>' +
            '<div class="uploader pub-drop" onclick="var f=document.getElementById(\'tm-publish-package-file\');if(f)f.click();">' +
              '<div class="up-empty"><div class="up-ic">包</div><b>' + esc(state.publishPackageFile ? '已选择资源包' : '选择资源包') + '</b><small id="tm-package-file-name">' + esc(fileLine(state.publishPackageFile, '支持 .tm-pack / .zip，建议包含 manifest.json')) + '</small></div>' +
            '</div>' +
            '<input id="tm-publish-package-file" type="file" accept=".tm-pack,.zip,application/zip,application/x-zip-compressed" style="display:none;" onchange="TMContentManager.onPublishPackageFile(this)">' +
            '<div class="pub-loose" style="margin-top:8px;padding-top:8px;border-top:1px dashed var(--line,rgba(201,160,69,.25));">' +
              '<button class="btn sm" type="button" onclick="var f=document.getElementById(\'tm-publish-loose-files\');if(f)f.click();">没有现成包？选散文件，我来打包</button>' +
              '<small style="display:block;margin-top:6px;color:var(--ink-faint,#9a8f7d);">按当前商店分类挑选图片 / 音频 / JSON，页面自动生成 manifest 并打成 .tm-pack；组合类内容会按类归档（立绘入 portraits/、音乐入 music/）。</small>' +
              '<input id="tm-publish-loose-files" type="file" multiple accept="' + esc(looseAccept) + '" style="display:none;" onchange="TMContentManager.onPublishLooseFiles(this)">' +
            '</div>' +
            '<div class="pub-note">资源包会作为审核资源上传；包内 manifest、路径安全、资源类型由导入/审核链路校验。</div>' +
          '</section>' +
          '<section class="pub-card pub-store">' +
            '<div class="pub-card-head"><span>2</span><div><b>编辑商店信息</b><small>这些内容决定玩家在工坊里看到什么</small></div></div>' +
            '<div class="pub-store-grid">' +
              '<div class="field"><label>商店分类</label>' + typeSel + '</div>' +
              '<div class="field"><label>版本</label><input id="tm-webpub-version" class="input" value="' + esc(d.version || '1.0.0') + '" placeholder="1.0.0"></div>' +
              '<div class="field span2"><label>标题</label><input id="tm-webpub-title" class="input" value="' + esc(d.title || '') + '" placeholder="例如：天启朝边镇扩展包"></div>' +
              '<div class="field span2"><label>标签</label><input id="tm-webpub-tags" class="input" value="' + esc(d.tags || '') + '" placeholder="剧本 明末 地图 立绘"></div>' +
              '<div class="field span2"><label>简介</label><textarea id="tm-webpub-desc" class="input" rows="3" placeholder="写给玩家看的短说明：内容范围、玩法变化、兼容说明。">' + esc(d.desc || '') + '</textarea></div>' +
              '<div class="field span2"><label>更新 / 申请说明</label><textarea id="tm-webpub-notes" class="input" rows="2" placeholder="给审核者看的补充说明，可写素材来源、授权情况、兼容版本。">' + esc(d.notes || '') + '</textarea></div>' +
            '</div>' +
          '</section>' +
          '<section class="pub-card pub-media">' +
            '<div class="pub-card-head"><span>3</span><div><b>商店素材</b><small>封面必填建议，展示图可多张</small></div></div>' +
            '<div class="pub-media-grid">' +
              '<div class="uploader pub-cover" onclick="var f=document.getElementById(\'tm-publish-cover-file\');if(f)f.click();">' + publishCoverHtml() + '</div>' +
              '<div class="pub-gallery" onclick="var f=document.getElementById(\'tm-publish-gallery-files\');if(f)f.click();">' + publishGalleryHtml() + '</div>' +
            '</div>' +
            '<input id="tm-publish-cover-file" type="file" accept="image/*" style="display:none;" onchange="TMContentManager.onPublishCoverFile(this)">' +
            '<input id="tm-publish-gallery-files" type="file" accept="image/*" multiple style="display:none;" onchange="TMContentManager.onPublishGalleryFiles(this)">' +
            '<div class="pub-note">' + esc(state.publishCoverFile ? ('封面：' + fileLine(state.publishCoverFile)) : '尚未选择封面。') + (state.publishGalleryFiles && state.publishGalleryFiles.length ? ' · 展示图 ' + state.publishGalleryFiles.length + ' 张' : '') + '</div>' +
          '</section>' +
          '<section class="pub-card pub-submit">' +
            '<div class="pub-card-head"><span>审</span><div><b>提交发布申请</b><small>提交后进入待审核状态，通过后才会进入在线目录</small></div></div>' +
            '<div class="pub-checks">' +
              '<div class="' + (user ? 'ok' : 'bad') + '">账号身份：' + esc(user ? (user.nickname || user.username) : '未登录') + '</div>' +
              '<div class="' + (publishPackageReady() ? 'ok' : 'bad') + '">投稿资源：' + esc(publishPackageReady() ? state.publishPackageFile.name : '未导入') + '</div>' +
              '<div class="' + (publishStoreReady() ? 'ok' : 'bad') + '">商店信息：' + esc(publishStoreReady() ? '已填写' : '缺少标题 / 版本 / 简介') + '</div>' +
            '</div>' +
            '<div class="pub-actions">' +
              '<button class="btn primary" onclick="TMContentManager.submitWorkshopPublication()"' + (canSubmit ? '' : ' disabled') + '>' + esc(user ? (publishPackageReady() ? '提交发布申请' : '等待资源包') : '登录后提交') + '</button>' +
              '<button class="btn" onclick="TMContentManager.resetPublicationDraft()">清空申请</button>' +
              '<button class="btn" onclick="TMContentManager.loadWorkshopCatalog()">刷新目录</button>' +
            '</div>' +
          '</section>' +
        '</div>' +
      '</div>' +
      (state.publishMessage ? '<div class="status" style="margin-top:10px;">' + esc(state.publishMessage) + '</div>' : '');
  }

  // 好友（mall）
  function renderFriendsPaneMall() {
    var user = (state.accountSession || {}).user;
    if (!user) return '<div class="sec-h"><h3>好友</h3></div><div class="empty"><div class="glyph">友</div><div class="t">登录后可加好友、私信</div><div>到「我」登录后再来</div></div>';
    if (!state.friendsLoaded && !state.friendsLoading) { try { setTimeout(loadFriends, 0); } catch (e) {} }
    var d = state.friendsData || { friends: [], incoming: [], outgoing: [] };
    var av = function(n){ return '<div class="av seal">' + esc(String(n || '友').charAt(0)) + '</div>'; };
    var reqs = d.incoming.map(function(r){
      return '<div class="friend req">' + av(r.nickname) + '<div><b>' + esc(r.nickname) + '</b><small>@' + esc(r.username) + ' · 申请加你为好友</small></div>' +
        '<div style="display:flex;gap:6px;"><button class="btn sm primary" onclick="TMContentManager.respondFriend(' + Number(r.userId) + ', \'accept\')">接受</button><button class="btn sm" onclick="TMContentManager.respondFriend(' + Number(r.userId) + ', \'reject\')">拒绝</button></div></div>';
    }).join('');
    var friends = d.friends.length ? d.friends.map(function(f){
      return '<div class="friend">' + av(f.nickname) + '<div><b>' + esc(f.nickname) + '</b><small>@' + esc(f.username) + '</small></div>' +
        '<div style="display:flex;gap:6px;"><button class="btn sm" onclick="TMContentManager.openDm(' + Number(f.id) + ', ' + jsArg(f.nickname || '') + ')">私信</button><button class="btn sm" onclick="TMContentManager.removeFriend(' + Number(f.id) + ')">删除</button></div></div>';
    }).join('') : (state.friendsLoading ? mallSkeleton(3) : (state.friendsStatus === 'error'
      ? truthEmpty('友', '正式好友接口不可用', state.friendsError || '无法读取好友列表。', '<button class="btn primary sm" onclick="TMContentManager.refreshFriends()">重试好友接口</button>')
      : truthEmpty('友', '好友列表当前为空', '正式接口返回 0 位好友；可按用户名发送申请。')));
    return '<div class="sec-h"><h3>好友' + (d.friends.length ? ' · ' + d.friends.length : '') + '</h3><span class="more" onclick="TMContentManager.openDmInbox()">私信箱 ›</span></div>' +
      '<div style="display:flex;gap:8px;max-width:480px;"><input id="tm-friend-add" class="input" placeholder="对方用户名"><button class="btn primary" onclick="TMContentManager.addFriend()">申请</button></div>' +
      (state.friendMessage ? '<div class="status" style="margin-top:8px;">' + esc(state.friendMessage) + '</div>' : '') +
      (reqs ? '<div class="sec-h"><h3>收到的申请 · ' + d.incoming.length + '</h3></div>' + reqs : '') +
      (d.outgoing.length ? '<div style="font-size:12px;color:var(--ink-faint);margin-top:10px;">已发出 ' + d.outgoing.length + ' 个申请，等待对方通过。</div>' : '') +
      '<div class="sec-h"><h3>我的好友</h3></div>' + friends;
  }

  // 更新中心（mall）
  function renderUpdatesPaneMall() {
    var h = state.hotStatus || {};
    var chk = state.hotCheck || null;
    var loaded = h.activeHot ? ('热更 ' + (h.currentVersion || '')) : '安装包内置前端';
    var base = h.baseVersion || '未读取';
    var hero;
    if (!desktop()) {
      hero = '<div class="update-hero ok"><div class="uh-top">' +
          '<div class="uh-ic">✓</div>' +
          '<div class="uh-id"><b>网页版始终最新</b><small>刷新即得最新前端，无需手动更新；安装包 / 安卓端通过热更收到更新。</small><div class="uh-state ok">✓ 已是最新</div></div>' +
        '</div></div>';
    } else {
      var avail = !!(chk && chk.hasUpdate);
      var checked = !!chk;
      var stateLine = avail
        ? '<div class="uh-state avail">⇪ 有新版 ' + esc(chk.remoteVersion || '') + ' 可装' + (chk.size ? ' · ' + esc(formatBytes(chk.size)) : '') + '</div>'
        : (checked ? '<div class="uh-state ok">✓ 已是最新</div>' : '<div class="uh-state" style="color:var(--ink-faint);">点「检查热更」看是否有新版</div>');
      var acts = avail
        ? '<button class="btn primary sm" onclick="TMContentManager.installHotUpdate()">下载并安装</button><button class="btn sm" onclick="TMContentManager.checkHotUpdate()">重新检查</button>'
        : '<button class="btn primary sm" onclick="TMContentManager.checkHotUpdate()">检查热更</button>';
      // 2026-07-07·实时进度条（下载整包/增量/校验本地）·御案锚金里透朱·此前大包下载只有一行文案
      var prog = state.hotProgress;
      var progPct = prog ? Math.max(0, Math.min(100, Math.round(prog.pct || 0))) : 0;
      var progHtml = prog
        ? '<div class="uh-prog" style="margin:10px 0 2px;">' +
            '<div style="display:flex;justify-content:space-between;font-size:.72rem;color:var(--ink-faint,#9a8f7d);margin-bottom:4px;"><span>' + esc(prog.label || '更新中') + '</span><span>' + progPct + '%</span></div>' +
            '<div style="height:6px;border:1px solid rgba(201,160,69,.35);background:rgba(0,0,0,.28);border-radius:3px;overflow:hidden;">' +
              '<div style="height:100%;width:' + progPct + '%;background:linear-gradient(90deg,rgba(201,160,69,.85),rgba(150,59,41,.92));transition:width .2s;"></div>' +
            '</div>' +
          '</div>'
        : '';
      hero = '<div class="update-hero ' + (avail ? 'avail' : (checked ? 'ok' : '')) + '"><div class="uh-top">' +
          '<div class="uh-ic">⇪</div>' +
          '<div class="uh-id"><b>前端热更</b><small>不重装安装包即可收到 UI / 剧本 / 立绘 / 音乐更新</small>' + stateLine + '</div>' +
          '<div class="uh-acts">' + acts + '</div>' +
        '</div>' + progHtml +
        '<div class="uh-sub"><span>当前加载 <b>' + esc(loaded) + '</b></span><span>基础版 <b>' + esc(base) + '</b></span>' +
          '<span class="s-spacer" style="flex:1;"></span>' +
          '<span class="lk" style="color:var(--gold);" onclick="TMContentManager.reloadAfterHotUpdate()">立即重载</span>' +
          '<span class="lk" onclick="TMContentManager.rollbackHotUpdate()">回滚</span>' +
        '</div></div>';
    }
    var list = state.changelogEntries || [];
    var entries = list.length
      ? '<div class="dibao">' + list.slice(0, 8).map(function(e){
          return '<div class="dt-item"><div class="dt-date">' + esc(e.date || '') + '</div><b>' + esc(e.title || e.module || '更新') + '</b>' + (e.module ? '<span class="dt-tag">' + esc(e.module) + '</span>' : '') + '</div>';
        }).join('') + '</div>'
      : '<div class="empty"><div class="glyph">邸</div><div class="t">暂无公告</div></div>';
    return '<div class="sec-h"><h3>更新中心</h3></div>' + hero +
      (state.hotMessage ? '<div class="status" style="margin:-8px 0 14px;">' + esc(state.hotMessage) + '</div>' : '') +
      '<div class="sec-h"><h3>游戏邸报</h3></div>' + entries;
  }

  function loadInstalled() {
    if (desktop()) return;
    state.installedLoading = true;
    refreshWebInstalled().then(function(){ state.installedLoaded = true; state.installedLoading = false; render(); });
  }
  function instCover(title, id, type) {
    return mallCover({ title: title, id: id, type: type || 'scenario' }, 'width:48px;height:48px;font-size:22px;');
  }
  function renderInstalledMall() {
    if (desktop()) {
      var packs = state.packs || [];
      var dRows = packs.length ? packs.map(function(rec){
        var en = rec.enabled !== false; var missing = !rec.installed;
        return '<div class="inst-card">' + instCover(rec.title || rec.id, rec.id, rec.type) +
          '<div><b>' + esc(rec.title || rec.id) + (missing ? '<span class="upd-badge" style="border-color:rgba(231,105,82,.5);color:#f0b7a8;background:rgba(120,31,23,.2);">文件缺失</span>' : '') + (en ? '' : '<span class="upd-badge" style="border-color:var(--line);color:var(--ink-faint);background:transparent;">已停用</span>') + '</b><small>' + esc(rec.id) + ' · ' + (rec.version ? 'v' + esc(rec.version) : '版本未提供') + '</small></div>' +
          '<div class="acts"><button class="btn sm" onclick="TMContentManager.togglePack(' + jsArg(rec.id) + ',' + (!en) + ')">' + (en ? '停用' : '启用') + '</button><button class="btn sm" onclick="TMContentManager.uninstallPack(' + jsArg(rec.id) + ')">卸载</button></div></div>';
      }).join('') : '<div class="empty"><div class="glyph">坊</div><div class="t">尚未安装内容包</div></div>';
      return '<div class="inst-summary"><span class="s-stat"><b>' + packs.length + '</b>件已装</span><span class="s-spacer"></span>' +
        '<button class="btn sm primary" onclick="TMContentManager.importPack()">导入工坊包</button><button class="btn sm" onclick="TMContentManager.refreshPacks()">刷新</button><button class="btn sm" onclick="TMContentManager.openWorkshopDir()">打开目录</button></div>' + dRows;
    }
    if (!state.installedLoaded && !state.installedLoading) { try { setTimeout(loadInstalled, 0); } catch (e) {} }
    var recs = state.webInstalled || [];
    var updates = state.workshopUpdates || {};
    var updN = recs.filter(function(r){ return updates[r.packId]; }).length;
    var rows = recs.length ? recs.map(function(rec){
      var upd = updates[rec.packId];
      return '<div class="inst-card">' + instCover(rec.title || rec.packId, rec.packId, rec.type) +
        '<div><b>' + esc(rec.title || rec.packId) + (upd ? '<span class="upd-badge">有新版 ' + esc(upd.to) + '</span>' : '') + '</b><small>' + esc(rec.packId) + ' · ' + (rec.version ? 'v' + esc(rec.version) : '版本未提供') + '</small></div>' +
        '<div class="acts">' + (upd ? '<button class="btn sm primary" onclick="TMContentManager.updateWorkshopPack(' + jsArg(rec.packId) + ')">更新</button>' : '') + '<button class="btn sm" onclick="TMContentManager.uninstallWebPack(' + jsArg(rec.packId) + ')">卸载</button></div></div>';
    }).join('') : '<div class="empty"><div class="glyph">坊</div><div class="t">尚未安装工坊剧本</div><div>到「发现」浏览并安装</div></div>';
    return '<div class="inst-summary"><span class="s-stat"><b>' + recs.length + '</b>件已装</span>' +
        (updN ? '<span class="s-stat"><b style="color:#bfe7c8;">' + updN + '</b><span style="color:#9fe0b4;">个可更新</span></span>' : '') +
        '<span class="s-spacer"></span>' +
        (updN ? '<button class="btn sm primary" onclick="TMContentManager.updateAllWorkshop()">全部更新</button>' : '') +
        '<button class="btn sm" onclick="TMContentManager.checkWorkshopUpdates()">检查更新</button><button class="btn sm" onclick="TMContentManager.refreshInstalled()">刷新</button></div>' +
      (state.catalogMessage && /更新|检查|安装|卸载/.test(state.catalogMessage) ? '<div class="status" style="margin-bottom:10px;">' + esc(state.catalogMessage) + '</div>' : '') + rows;
  }

  // B 我的关注/粉丝计数（名册头）
  function loadMyFollow() {
    var self = (state.accountSession && state.accountSession.user) || null;
    if (!self || self.id == null || state.myFollowLoaded) return;
    if (!(window.TM && TM.OnlineClient && TM.OnlineClient.followInfo)) return;
    state.myFollowLoaded = true;
    TM.OnlineClient.followInfo(self.id, state.onlineApiUrl || undefined).then(function(res){
      if (res && res.success) { state.myFollow = { followers: res.followers, following: res.following }; render(); }
    }).catch(function(){});
  }

  // 我名下已发布作品（按作者名 / authorId 匹配在线目录）
  function myPublishedPacks(user) {
    var packs = (state.catalog && state.catalog.packs) || [];
    if (!user) return [];
    var names = [user.nickname, user.username].filter(Boolean);
    return packs.filter(function(p){
      if (user.id != null && p.authorId != null && String(p.authorId) === String(user.id)) return true;
      return names.indexOf(p.author) >= 0;
    });
  }
  // 成就徽章：earned 高亮、locked 暗显（接现成 .badges-wall/.bdg）
  function renderBadges(works) {
    var dlMetric = aggregateMetric(works, 'downloads');
    var endorsementMetric = aggregateMetric(works, 'endorsements');
    var dl = dlMetric.value;
    var en = endorsementMetric.value;
    var rated = works.some(function(p){ return hasMetric(p, 'ratingCount') && Number(p.ratingCount) >= 5; });
    var forked = works.some(function(p){ return p.parentId; });
    var list = [
      { g: '命', t: '入籍天命', s: '已注册账号', on: true },
      { g: '著', t: '已发布作者', s: works.length + ' 件作品', on: works.length > 0 },
      { g: '众', t: '千人传抄', s: dlMetric.known ? '已提供下载累计逾千' : '下载量尚未提供', on: dl >= 1000 },
      { g: '荐', t: '众望所归', s: endorsementMetric.known ? '获社区推荐' : '推荐量尚未提供', on: en > 0 },
      { g: '评', t: '口碑之作', s: '单作评价满五', on: rated },
      { g: '脉', t: '世界线开创', s: '改编自他人之作', on: forked }
    ];
    return '<div class="badges-wall">' + list.map(function(b){
      return '<div class="bdg' + (b.on ? '' : ' dim') + '"><div class="bi">' + esc(b.g) + '</div><b>' + esc(b.t) + '</b><small>' + esc(b.s) + '</small></div>';
    }).join('') + '</div>';
  }

  // 社区品级（账号层 social 声望·科举味·跨朝代·与角色功名 virtueMerit 不混账）
  var SOCIAL_RANKS = [
    { v: 0, name: '白身' }, { v: 50, name: '童生' }, { v: 200, name: '生员' },
    { v: 800, name: '举人' }, { v: 2000, name: '贡士' }, { v: 6000, name: '进士' },
    { v: 15000, name: '翰林' }, { v: 40000, name: '史官' }
  ];
  function socialRankFor(rep) {
    var cur = SOCIAL_RANKS[0], next = null;
    for (var i = 0; i < SOCIAL_RANKS.length; i++) {
      if (rep >= SOCIAL_RANKS[i].v) cur = SOCIAL_RANKS[i];
      else { next = SOCIAL_RANKS[i]; break; }
    }
    return { cur: cur, next: next };
  }
  // 声望仅为明确标注的客户端估算；缺失指标不补零展示，服务器版后续接管为权威。
  function computeReputation(works, extra) {
    extra = extra || {};
    var dl = aggregateMetric(works, 'downloads').value;
    var en = aggregateMetric(works, 'endorsements').value;
    var rc = aggregateMetric(works, 'ratingCount').value;
    var friends = hasMetric(extra, 'friends') ? Number(extra.friends) : 0;
    return Math.round(works.length * 120 + dl * 0.6 + en * 40 + rc * 10 + friends * 15);
  }

  // 收藏阁：客户端本地收藏（localStorage·服务器版 collections 后续接管同步）
  var FAV_KEY = 'tm_workshop_favorites';
  function loadFavorites() { try { var a = JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function isFavorite(id) { id = String(id || ''); return loadFavorites().some(function(f){ return String(f.id) === id; }); }
  function toggleFavorite(id) {
    id = String(id || ''); if (!id) return;
    var list = loadFavorites();
    var i = -1; for (var k = 0; k < list.length; k++) { if (String(list[k].id) === id) { i = k; break; } }
    if (i >= 0) list.splice(i, 1); else list.push({ id: id, at: Date.now() });
    try { localStorage.setItem(FAV_KEY, JSON.stringify(list)); } catch (e) {}
    // 登录态镜像到服务器（计数 + 跨端同步），fire-and-forget。
    if (window.TM && TM.OnlineClient && TM.OnlineClient.isLoggedIn() && TM.OnlineClient.favorite) {
      try { TM.OnlineClient.favorite(id, state.onlineApiUrl || undefined).catch(function(){}); } catch (e) {}
    }
    render();
  }
  // 登录后把服务器收藏并入本地缓存（跨端收藏可见）；只增不删，MVP 容许轻微漂移。
  function syncServerFavorites() {
    if (state.favSynced || !(window.TM && TM.OnlineClient && TM.OnlineClient.isLoggedIn() && TM.OnlineClient.favoritesList)) return;
    state.favSynced = true;
    TM.OnlineClient.favoritesList(state.onlineApiUrl || undefined).then(function(res){
      if (!res || !res.success || !Array.isArray(res.favorites)) return;
      var list = loadFavorites(); var known = {}; list.forEach(function(f){ known[String(f.id)] = true; });
      var added = false;
      res.favorites.forEach(function(f){ if (f && f.id != null && !known[String(f.id)]) { list.push({ id: String(f.id), at: Date.parse(f.at) || Date.now() }); added = true; } });
      if (added) { try { localStorage.setItem(FAV_KEY, JSON.stringify(list)); } catch (e) {} render(); }
    }).catch(function(){});
  }
  function favoritePacks() {
    var packs = (state.catalog && state.catalog.packs) || [];
    return loadFavorites().map(function(f){
      for (var i = 0; i < packs.length; i++) if (String(packs[i].id) === String(f.id)) return packs[i];
      return null;
    }).filter(Boolean);
  }
  // 履历热力图：近 18 周活跃留痕（发布/收藏时间戳·真值，无数据则淡格如实呈现）
  // A1·战绩·历代亲历：读本地 tm_playHistory(终局屏 _recordPlaythrough 写·一局一记)·渲染每局存续/疆域/结局/胜败·无则诚实空态
  function renderWarRecords() {
    var arr = [];
    try { arr = JSON.parse(localStorage.getItem('tm_playHistory') || '[]'); if (!Array.isArray(arr)) arr = []; } catch (e) { arr = []; }
    if (!arr.length) return '<div class="empty"><div class="glyph">史</div><div class="t">还没有战绩</div><div>通关后自动留痕：存续年数、疆域、结局。</div></div>';
    var rows = arr.slice(0, 30).map(function (r) {
      r = r || {};
      var vic = !!r.victory;
      var mark = vic ? '天命已成' : '天命已绝';
      var markColor = vic ? 'var(--gold-400,#d6b15d)' : 'var(--vermillion-400,#c0563a)';
      var when = '';
      try { if (r.ts) { var d = new Date(r.ts); when = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); } } catch (e2) {}
      var meta = [];
      if (r.era) meta.push(esc(String(r.era)));
      if (r.turns) meta.push('存续 ' + r.turns + ' 回合');
      if (r.territory) meta.push('疆域 ' + r.territory + ' 城');
      return '<div class="tm-war-row" style="display:flex;justify-content:space-between;gap:10px;padding:.5rem .1rem;border-bottom:1px solid rgba(214,177,93,.12);">' +
        '<div style="min-width:0;flex:1;">' +
          '<div style="font-size:.82rem;color:var(--gold-300,#c9a96e);">' + esc(String(r.scenario || '未名局')) + '</div>' +
          '<div style="font-size:.72rem;color:rgba(234,223,203,.6);margin-top:2px;">' + meta.join(' · ') + '</div>' +
          (r.outcome ? '<div style="font-size:.72rem;color:rgba(234,223,203,.5);margin-top:1px;">' + esc(String(r.outcome)) + '</div>' : '') +
        '</div>' +
        '<div style="text-align:right;flex-shrink:0;"><span style="font-size:.74rem;color:' + markColor + ';font-weight:600;">' + mark + '</span>' +
          (when ? '<div style="font-size:.66rem;color:rgba(234,223,203,.4);margin-top:2px;">' + when + '</div>' : '') + '</div>' +
        '</div>';
    }).join('');
    return '<div class="tm-war-records">' + rows + '</div>';
  }

  function renderHeatmap(events) {
    var DAY = 86400000, WEEKS = 18;
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var end = today.getTime();
    var counts = {};
    (events || []).forEach(function(t){
      var n = Number(t); if (!n || isNaN(n)) return;
      var d = new Date(n); d.setHours(0, 0, 0, 0);
      counts[d.getTime()] = (counts[d.getTime()] || 0) + 1;
    });
    var start = new Date(end - (WEEKS * 7 - 1) * DAY); start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - start.getDay()); // 回退到周日，列对齐为「周」
    var max = 1; for (var key in counts) if (counts[key] > max) max = counts[key];
    var cells = '', cur = start.getTime();
    while (cur <= end) {
      var c = counts[cur] || 0;
      var lvl = c === 0 ? 0 : (c >= max ? 4 : (c >= max * 0.66 ? 3 : (c >= max * 0.33 ? 2 : 1)));
      cells += '<i class="hm-c hm-l' + lvl + '"></i>';
      cur += DAY;
    }
    return '<div class="heatmap">' + cells + '</div><div class="hm-foot">近 18 周 · 发布与收藏留痕</div>';
  }

  // 我（账号 + 子页签）
  function renderMePane() {
    var user = (state.accountSession || {}).user;
    var h = state.onlineStatus || {};
    var recoveryOn = !!(h.features && h.features.accountRecovery);
    if (!user) {
      var benefits = [['著', '作者身份'], ['评', '评分评论'], ['友', '好友私信'], ['册', '跨端同步']];
      var resetPanel = state.accountResetOpen
        ? '<div class="login-card" style="margin-top:14px;border-left:3px solid #d6a14a;">' +
            '<div class="lc-h">找回密码</div>' +
            '<div class="lc-sub">输入注册邮箱，收到验证码后重置密码。' + (recoveryOn ? '' : '（服务器未配邮件服务，暂不可用。）') + '</div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;"><input id="tm-reset-email" class="input" type="email" placeholder="注册邮箱"><input id="tm-reset-code" class="input" inputmode="numeric" maxlength="6" placeholder="6 位验证码"></div>' +
            '<div class="field"><label>新密码</label><input id="tm-reset-pass" class="input" type="password" placeholder="至少 8 位"></div>' +
            '<div style="display:flex;gap:8px;margin-top:12px;"><button class="btn" onclick="TMContentManager.accountRequestReset()">发送验证码</button><button class="btn primary" style="flex:1;" onclick="TMContentManager.accountReset()">重置密码</button></div>' +
            (state.accountResetMessage ? '<div class="status" style="margin-top:8px;">' + esc(state.accountResetMessage) + '</div>' : '') +
          '</div>'
        : '';
      return '<div class="login-hero"><div class="lh-seal seal serif">坊</div>' +
          '<h2>登籍天命 · 入坊</h2>' +
          '<p>登录后即可以作者身份发布作品、参与社区往来。离线开局始终不受影响。</p>' +
          '<div class="benefit-pills">' + benefits.map(function(bn){ return '<span class="bp"><i>' + bn[0] + '</i>' + bn[1] + '</span>'; }).join('') + '</div>' +
        '</div>' +
        '<div class="login-grid">' +
          '<div class="login-card primary"><span class="ribbon">免密 · 推荐</span>' +
            '<div class="lc-h"><span class="step">★</span>邮箱验证码登录</div>' +
            '<div class="lc-sub">新邮箱自动注册，不必记密码。</div>' +
            '<div class="field"><label><span class="step">1</span> 邮箱</label><input id="tm-elogin-email" class="input" type="email" value="' + esc(state.emailLoginAddr || '') + '" placeholder="输入邮箱，点发送验证码"></div>' +
            '<div class="field"><label><span class="step">2</span> 验证码</label><input id="tm-elogin-code" class="input" inputmode="numeric" maxlength="6" placeholder="邮件里的 6 位验证码"></div>' +
            '<div style="display:flex;gap:8px;margin-top:14px;"><button class="btn" onclick="TMContentManager.accountEmailCodeRequest()">发送验证码</button><button class="btn primary" style="flex:1;" onclick="TMContentManager.accountEmailLogin()">登录 / 注册</button></div>' +
          '</div>' +
          '<div class="login-card">' +
            '<div class="lc-h">账号密码登录</div>' +
            '<div class="lc-sub">老用户或习惯账密的同好。</div>' +
            '<div class="field"><label>账号</label><input id="tm-account-name" class="input" placeholder="3-24 位中文/英文/数字/下划线"></div>' +
            '<div class="field"><label>密码</label><input id="tm-account-pass" class="input" type="password" placeholder="至少 8 位"></div>' +
            '<div style="display:flex;gap:8px;margin-top:14px;"><button class="btn primary" style="flex:1;" onclick="TMContentManager.accountLogin()">登录</button><button class="btn" onclick="TMContentManager.accountRegister()">注册</button></div>' +
            '<div class="reg-extra"><div class="rx-lbl">注册附加 · 选填</div>' +
              '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;"><input id="tm-account-nickname" class="input" placeholder="昵称（作者栏显示）"><input id="tm-account-email" class="input" type="email" placeholder="找回邮箱"></div></div>' +
            '<div class="lc-foot"><span style="color:var(--gold);cursor:pointer;text-decoration:underline;" onclick="TMContentManager.toggleReset()">忘记密码？</span></div>' +
          '</div>' +
        '</div>' + resetPanel +
        '<div class="status" style="margin-top:14px;">' + esc(state.accountMessage || '账号用于工坊作者身份、评分、好友与私信。离线开局始终不受影响。') + '</div>';
    }
    var meTab = state.meTab || 'home';
    var sub = [['home', '我的'], ['installed', '已装'], ['notif', '通知'], ['friends', '好友']].map(function(it){
      var badge = (it[0] === 'notif' && state.notifData && state.notifData.unread) ? ' (' + state.notifData.unread + ')' : '';
      return '<a class="' + (meTab === it[0] ? 'on' : '') + '" onclick="TMContentManager.switchMeTab(\'' + it[0] + '\')">' + it[1] + badge + '</a>';
    }).join('');
    // 个人资料库脊梁：作品 / 声望 / 社区品级（一次算，名册头与「我的」共用）
    var works = myPublishedPacks(user);
    var friendsKnown = state.friendsStatus === 'ok' && state.friendsData && Array.isArray(state.friendsData.friends);
    var friendN = friendsKnown ? state.friendsData.friends.length : null;
    var official = (user.nickname === '天命官方' || user.username === '天命官方');
    var reputation = computeReputation(works, { friends: friendN });
    var reputationIncomplete = !friendsKnown || works.some(function(p){
      return !hasMetric(p, 'downloads') || !hasMetric(p, 'endorsements') || !hasMetric(p, 'ratingCount');
    });
    var rankInfo = socialRankFor(reputation);
    try {
      setTimeout(syncServerFavorites, 0); setTimeout(loadMyFollow, 0);
      if (!state.friendsLoaded && !state.friendsLoading) setTimeout(loadFriends, 0);
    } catch (e) {}
    var mf = state.myFollow;
    var repPct = rankInfo.next ? Math.max(4, Math.round((reputation - rankInfo.cur.v) / (rankInfo.next.v - rankInfo.cur.v) * 100)) : 100;
    var heroTitles = '<span class="rank-chip" title="由当前已载入的正式目录指标在本机推导，不是服务器授予品级">估算 · ' + esc(rankInfo.cur.name) + '</span>' +
      (works.length ? '<span class="rank-chip cert">认证作者</span>' : '') +
      (official ? '<span class="rank-chip cert">官方</span>' : '');
    var card = '<div class="acct-hero"><div class="ah-wm serif">' + esc(String(user.nickname || user.username).charAt(0)) + '</div>' +
      '<div class="ah-top">' +
        '<div class="ah-seal seal serif">' + esc(String(user.nickname || user.username).charAt(0)) + '</div>' +
        '<div class="ah-id"><b>' + esc(user.nickname || user.username) + '</b>' +
          '<div class="ah-titles">' + heroTitles + '</div>' +
          '<small>@' + esc(user.username) + (user.email ? ' · ' + esc(user.email) : '') + '</small>' +
          (mf ? '<div class="ah-follow">关注 <b>' + metricText(mf, 'following', '', '') + '</b> · 粉丝 <b>' + metricText(mf, 'followers', '', '') + '</b></div>' : '') +
        '</div>' +
        '<div class="ah-acts">' +
          '<button class="btn sm primary" onclick="TMContentManager.switchPane(\'studio\')">去创作</button>' +
          '<button class="btn sm" onclick="TMContentManager.openDmInbox()">私信箱</button>' +
          '<button class="btn sm" onclick="TMContentManager.accountLogout()">退出</button>' +
        '</div>' +
      '</div>' +
      '<div class="ah-rank"><div class="ah-rank-head"><b>' + esc(rankInfo.cur.name) + (rankInfo.next ? '<span class="nxt">→ ' + esc(rankInfo.next.name) + '</span>' : '') + '</b>' +
        '<span>' + (rankInfo.next ? '本地估算声望 ' + reputation + ' / ' + rankInfo.next.v : '本地估算声望 ' + reputation + ' · 已至顶阶') + (reputationIncomplete ? ' · 数据未全' : '') + '</span></div>' +
        '<div class="ah-rank-bar"><i style="width:' + repPct + '%;"></i></div></div>' +
    '</div>';
    var content;
    if (meTab === 'notif') {
      if (!state.notifLoaded && !state.notifLoading) { try { setTimeout(loadNotifs, 0); } catch (e) {} }
      var d = state.notifData || { notifications: [], unread: 0 };
      var rows = d.notifications.length ? d.notifications.map(function(n){
        var clickable = n.type === 'message' && n.actorId;
        var click = clickable ? ' style="cursor:pointer;" onclick="TMContentManager.openDmFromNotif(' + Number(n.actorId) + ', ' + jsArg(n.actorNick || '') + ', ' + Number(n.id) + ')"' : '';
        return '<div class="notif' + (n.read ? '' : ' unread') + '"' + click + '><div class="ic">' + notifIcon(n.type) + '</div>' +
          '<div><b>' + esc(notifText(n)) + '</b><p>' + esc(n.createdAt || '') + '</p></div>' +
          (n.read ? '<span></span>' : '<button class="btn sm" onclick="event.stopPropagation();TMContentManager.markNotif(' + Number(n.id) + ')">已读</button>') + '</div>';
      }).join('') : (state.notifLoading
        ? truthEmpty('铃', '正在读取正式通知', '正在连接正式通知接口。')
        : (state.notifStatus === 'error'
          ? truthEmpty('铃', '通知接口不可用', state.notifError || '无法读取正式通知。')
          : truthEmpty('铃', '暂无通知', '正式接口返回 0 条通知。')));
      content = '<div style="display:flex;gap:8px;margin-bottom:10px;">' + (d.unread ? '<button class="btn sm" onclick="TMContentManager.markAllNotif()">全部已读</button>' : '') + '<button class="btn sm" onclick="TMContentManager.refreshNotifs()">刷新</button></div>' + rows;
    } else if (meTab === 'installed') {
      content = renderInstalledMall();
    } else if (meTab === 'friends') {
      content = renderFriendsPaneMall();
    } else {
      var totalDl = aggregateMetric(works, 'downloads');
      var totalEn = aggregateMetric(works, 'endorsements');
      var worksHtml = works.length
        ? '<div class="grid">' + works.map(mallCard).join('') + '</div>'
        : '<div class="empty"><div class="glyph">著</div><div class="t">还没有发布作品</div><div>把你的剧本、立绘或配乐发布给天下人。</div><button class="btn primary sm" style="margin-top:4px;" onclick="TMContentManager.switchPane(\'studio\')">前往创作</button></div>';
      var favWorks = favoritePacks();
      var favHtml = favWorks.length
        ? '<div class="grid">' + favWorks.map(mallCard).join('') + '</div>'
        : '<div class="empty"><div class="glyph">藏</div><div class="t">收藏阁空空</div><div>在剧本 / 资源详情里点「☆ 收藏」，收进这里。</div></div>';
      // 履历活跃留痕：作品的发布/更新时间 + 本地收藏时间（真值；无则淡格如实）
      var activityEvents = [];
      works.forEach(function(p){ var t = Date.parse(p.updatedAt || p.createdAt || ''); if (!isNaN(t)) activityEvents.push(t); });
      loadFavorites().forEach(function(f){ if (f && f.at) activityEvents.push(f.at); });
      content = (!user.email
          ? '<div class="loginbox" style="margin-bottom:14px;border-left-color:#d6a14a;"><h4>补设找回邮箱</h4>' +
            '<div class="dcopy" style="margin:4px 0 6px;">尚未设置邮箱，忘记密码时无法找回，建议现在补设。</div>' +
            '<div style="display:flex;gap:8px;"><input id="tm-setemail" class="input" type="email" placeholder="your@example.com"><button class="btn primary" onclick="TMContentManager.accountSetEmail()">保存邮箱</button></div></div>'
          : '') +
        '<div class="statbar">' +
          '<div><b>' + works.length + '</b><small>发布作品</small></div>' +
          '<div><b>' + aggregateMetricText(totalDl) + '</b><small>' + (totalDl.complete ? '累计下载' : (totalDl.known ? '已提供下载' : '累计下载未提供')) + '</small></div>' +
          '<div><b>' + aggregateMetricText(totalEn) + '</b><small>' + (totalEn.complete ? '社区推荐' : (totalEn.known ? '已提供推荐' : '推荐量未提供')) + '</small></div>' +
          '<div><b>' + (friendsKnown ? friendN : '—') + '</b><small>' + (friendsKnown ? '好友' : '好友数未载入') + '</small></div>' +
        '</div>' +
        '<div class="sec-h"><h3>列传 · 我的发布</h3>' + (works.length ? '<span class="more" onclick="TMContentManager.switchPane(\'studio\')">发布新作 ›</span>' : '') + '</div>' + worksHtml +
        '<div class="sec-h"><h3>收藏阁' + (favWorks.length ? ' · ' + favWorks.length : '') + '</h3></div>' + favHtml +
        '<div class="sec-h"><h3>策展 · 我的合集</h3></div>' + renderMyCollections() +
        '<div class="sec-h"><h3>战绩 · 历代亲历</h3></div>' + renderWarRecords() +
        '<div class="sec-h"><h3>功业 · 成就</h3></div>' + renderBadges(works) +
        '<div class="sec-h"><h3>履历 · 近况</h3></div>' + renderHeatmap(activityEvents) +
        '<div class="sec-h"><h3>账号设置</h3></div>' +
        '<div class="kv" style="margin-bottom:12px;">' +
          '<div><small>身份</small><b>' + (works.length ? '已发布作者' : '已登录') + '</b></div>' +
          '<div><small>邮箱</small><b>' + esc(user.email || '未设置') + '</b></div>' +
        '</div>' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap;">' +
          '<button class="btn sm" onclick="TMContentManager.accountRefresh()">刷新身份</button>' +
          '<button class="btn sm" onclick="TMContentManager.accountLogout()">退出登录</button>' +
        '</div>' +
        (state.accountMessage ? '<div class="status" style="margin-top:11px;">' + esc(state.accountMessage) + '</div>' : '');
    }
    return card + '<div class="subnav" style="margin-top:14px;">' + sub + '</div>' + content;
  }
  //>>CM-SPLIT20-BODY-END
  // ── forward 回填：本片 §2-§5 成员 → bucket（origin 委托 shim 调用期解析）──
  __cmP.ARENA_METRIC = ARENA_METRIC; __cmP.COMM_KIND = COMM_KIND; __cmP.FAV_KEY = FAV_KEY; __cmP.FEED_TYPE_LABEL = FEED_TYPE_LABEL; __cmP.SOCIAL_RANKS = SOCIAL_RANKS; __cmP.accountLogout = accountLogout; __cmP.accountRefresh = accountRefresh; __cmP.accountSeal = accountSeal; __cmP.accountSetEmail = accountSetEmail;
  __cmP.addFriend = addFriend; __cmP.applyLog = applyLog; __cmP.autoPostPublish = autoPostPublish; __cmP.capturePublishDraft = capturePublishDraft; __cmP.closeApplyUpdate = closeApplyUpdate; __cmP.closeArena = closeArena;
  __cmP.closeCircle = closeCircle; __cmP.closeCollection = closeCollection; __cmP.closeCollectionPicker = closeCollectionPicker; __cmP.closeCommissionUI = closeCommissionUI; __cmP.closeDm = closeDm; __cmP.computeReputation = computeReputation;
  __cmP.createArenaUI = createArenaUI; __cmP.createCircleUI = createCircleUI; __cmP.createCollectionUI = createCollectionUI; __cmP.createMyCollectionUI = createMyCollectionUI; __cmP.ensureApplyLayer = ensureApplyLayer; __cmP.favoritePacks = favoritePacks;
  __cmP.feedCard = feedCard; __cmP.feedMetricChips = feedMetricChips; __cmP.fileLine = fileLine; __cmP.instCover = instCover; __cmP.installDownloadedUpdate = installDownloadedUpdate; __cmP.isFavorite = isFavorite;
  __cmP.likeFeedPost = likeFeedPost; __cmP.loadArenas = loadArenas; __cmP.loadCircles = loadCircles; __cmP.loadCollections = loadCollections; __cmP.loadCommissions = loadCommissions; __cmP.loadConversation = loadConversation;
  __cmP.loadFavorites = loadFavorites; __cmP.loadFeed = loadFeed; __cmP.loadFriends = loadFriends; __cmP.loadInstalled = loadInstalled; __cmP.loadMyCollections = loadMyCollections; __cmP.loadMyFollow = loadMyFollow;
  __cmP.loadNotifs = loadNotifs; __cmP.loadRevisions = loadRevisions; __cmP.loggedInNow = loggedInNow; __cmP.mallCard = mallCard; __cmP.mallCover = mallCover; __cmP.mallFopt = mallFopt;
  __cmP.mallGlyph = mallGlyph; __cmP.mallSkeleton = mallSkeleton; __cmP.mallStars = mallStars; __cmP.mallTypeChips = mallTypeChips; __cmP.markAllNotif = markAllNotif; __cmP.markNotif = markNotif;
  __cmP.myPublishedPacks = myPublishedPacks; __cmP.notifIcon = notifIcon; __cmP.notifText = notifText; __cmP.openApplyUpdateFromChangelog = openApplyUpdateFromChangelog; __cmP.openArena = openArena; __cmP.openCircle = openCircle;
  __cmP.openCollection = openCollection; __cmP.openCollectionPicker = openCollectionPicker; __cmP.openDm = openDm; __cmP.openDmFromNotif = openDmFromNotif; __cmP.openDmInbox = openDmInbox; __cmP.packCoverUrl = packCoverUrl;
  __cmP.packGalleryImages = packGalleryImages; __cmP.pickCollection = pickCollection; __cmP.postCommissionUI = postCommissionUI; __cmP.postToCircle = postToCircle; __cmP.prepareOnlineDefaults = prepareOnlineDefaults; __cmP.promoCard = promoCard;
  __cmP.promoScene = promoScene; __cmP.proposeRevisionUI = proposeRevisionUI; __cmP.publishCoverHtml = publishCoverHtml; __cmP.publishDraft = publishDraft; __cmP.publishGalleryHtml = publishGalleryHtml; __cmP.publishPackageReady = publishPackageReady;
  __cmP.publishStatusHtml = publishStatusHtml; __cmP.publishStep = publishStep; __cmP.publishStoreReady = publishStoreReady; __cmP.quickCreateCollection = quickCreateCollection; __cmP.refreshAccountSession = refreshAccountSession; __cmP.refreshNotifs = refreshNotifs; __cmP.reloadAppliedUpdate = reloadAppliedUpdate;
  __cmP.removeFriendUI = removeFriendUI; __cmP.renderAccountAside = renderAccountAside; __cmP.renderAccountLoggedIn = renderAccountLoggedIn; __cmP.renderAccountLoggedOut = renderAccountLoggedOut; __cmP.renderAccountTabV2 = renderAccountTabV2; __cmP.renderApplyEntries = renderApplyEntries;
  __cmP.renderApplyUpdateModal = renderApplyUpdateModal; __cmP.renderArenaLayer = renderArenaLayer; __cmP.renderArenaSection = renderArenaSection; __cmP.renderBadges = renderBadges; __cmP.renderBrowsePane = renderBrowsePane; __cmP.renderCircleLayer = renderCircleLayer;
  __cmP.renderCirclesPane = renderCirclesPane; __cmP.renderCollectionLayer = renderCollectionLayer; __cmP.renderCollectionPicker = renderCollectionPicker; __cmP.renderCollectionSection = renderCollectionSection; __cmP.renderCommissionSection = renderCommissionSection; __cmP.renderDiscover = renderDiscover;
  __cmP.renderDmLayer = renderDmLayer; __cmP.renderFeedPane = renderFeedPane; __cmP.renderFriendsPaneMall = renderFriendsPaneMall; __cmP.renderFriendsSection = renderFriendsSection; __cmP.renderHeatmap = renderHeatmap; __cmP.renderInstalledMall = renderInstalledMall;
  __cmP.renderLocalWorkshopSection = renderLocalWorkshopSection; __cmP.renderMallPane = renderMallPane; __cmP.renderMePane = renderMePane; __cmP.renderMyCollections = renderMyCollections; __cmP.renderNotifSection = renderNotifSection; __cmP.renderRanksPane = renderRanksPane;
  __cmP.renderResetPanel = renderResetPanel; __cmP.renderRevisionSection = renderRevisionSection; __cmP.renderStudioPane = renderStudioPane; __cmP.renderTopicsPane = renderTopicsPane; __cmP.renderUpdatesPaneMall = renderUpdatesPaneMall; __cmP.renderUrlPublishSection = renderUrlPublishSection;
  __cmP.renderWarRecords = renderWarRecords; __cmP.renderWebPublishSection = renderWebPublishSection; __cmP.renderWorkshopTabV2 = renderWorkshopTabV2; __cmP.respondFriendUI = respondFriendUI; __cmP.respondRevisionUI = respondRevisionUI; __cmP.runApplyUpdateFlow = runApplyUpdateFlow;
  __cmP.replaceAccountSession = replaceAccountSession; __cmP.resetAccountRemoteState = resetAccountRemoteState; __cmP.selfId = selfId; __cmP.sendDm = sendDm; __cmP.socialRankFor = socialRankFor; __cmP.submitArenaUI = submitArenaUI; __cmP.submitFeedPost = submitFeedPost; __cmP.syncServerFavorites = syncServerFavorites;
  __cmP.toggleCircleJoin = toggleCircleJoin; __cmP.toggleFavorite = toggleFavorite; __cmP.updateApplyState = updateApplyState; __cmP.webInstalledRow = webInstalledRow;
})();
