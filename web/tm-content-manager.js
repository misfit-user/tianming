// Tianming desktop content manager: updates + workshop packs.
// ============================================================
// ── 章节导航（§ 锚点；跳转请 grep 小节标题，行号会随改动漂移）──
//   单 IIFE。state.tab 切换在线更新 / 创意工坊各视图。
//   §1 更新中心    在线版本检查 / 热更下载 / 邸报(changelog)模态 —— 文件前半段(grep「online」「changelog」「邸报」)
//   §2 M2 护城河   同台竞史(擂台) + 鉴赏家合集 / 收入合集（grep「M2 护城河」「擂台」「合集」）
//   §3 M3 轻社交   轻圈子 + 共编(详情内修订) + 约稿墙（grep「M3」「圈子」「共编」「约稿墙」）
//   §4 全屏商城    对齐 preview-community（grep「全屏商城」）
//   §5 史馆动态流  A 史馆动态流（grep「史馆动态流」）
// ============================================================
(function(){
  'use strict';

  var state = {
    tab: 'online',
    status: null,
    packs: [],
    feedUrl: '',
    defaultFeedUrl: '',
    hotStatus: null,
    hotFeedUrl: '',
    defaultHotFeedUrl: '',
    hotMessage: '',
    hotCheck: null,
    catalogUrl: '',
    defaultCatalogUrl: '',
    catalog: null,
    catalogStatus: 'idle',
    catalogError: '',
    catalogOrigin: '',
    featuredStatus: 'idle',
    featuredError: '',
    featuredPacks: [],
    feedStatus: 'idle',
    feedError: '',
    arenaStatus: 'idle',
    arenaError: '',
    arenaDetailStatus: 'idle',
    arenaDetailError: '',
    collectionStatus: 'idle',
    collectionError: '',
    collectionDetailStatus: 'idle',
    collectionDetailError: '',
    circleStatus: 'idle',
    circleError: '',
    circleDetailStatus: 'idle',
    circleDetailError: '',
    circleFeedStatus: 'idle',
    circleFeedError: '',
    commissionStatus: 'idle',
    commissionError: '',
    friendsStatus: 'idle',
    friendsError: '',
    myCollectionsStatus: 'idle',
    myCollectionsError: '',
    notifStatus: 'idle',
    notifError: '',
    detailCommentsStatus: 'idle',
    detailCommentsError: '',
    revisionStatus: 'idle',
    revisionError: '',
    chronStatus: 'idle',
    chronError: '',
    dmLoadStatus: 'idle',
    dmLoadError: '',
    catalogMessage: '',
    publishMessage: '',
    onlineApiUrl: '',
    defaultOnlineApiUrl: '',
    onlineStatus: null,
    onlineMessage: '',
    accountSession: null,
    accountSessionEpoch: 0,
    accountMessage: '',
    changelogEntries: [],
    applyUpdate: {
      open: false,
      busy: false,
      entries: [],
      stage: 'idle',
      message: '',
      progress: 0,
      kind: '',
      size: 0,
      logs: [],
      canReload: false,
      canInstall: false
    }
  };
  //>>CM-SPLIT20-PLUMBING-A-START  (巨石拆分第二十拆 20260706·脚本生成·勿手改)
  // origin=本片(先装载)。分片 tm-content-manager-community.js 于本片【之后】装载，经共享 bucket TM.__cmParts 双向接线：
  // origin 于装载末尾把下列 kept 成员导出 bucket 供分片闭包捕获；分片装载后把 §2-§5 UI 函数回填 bucket，
  // 本片下列委托 shim（函数声明·已提升到本 IIFE 顶）于调用期（render()/导出对象/IPC 回调）解析。契约见 lint-split-contracts。
  var __cmP = (function(){ var t = window.TM = window.TM || {}; return t.__cmParts = t.__cmParts || {}; })();
  function addFriend(){ return __cmP.addFriend.apply(this, arguments); }
  function autoPostPublish(){ return __cmP.autoPostPublish.apply(this, arguments); }
  function capturePublishDraft(){ return __cmP.capturePublishDraft.apply(this, arguments); }
  function closeApplyUpdate(){ return __cmP.closeApplyUpdate.apply(this, arguments); }
  function closeArena(){ return __cmP.closeArena.apply(this, arguments); }
  function closeCircle(){ return __cmP.closeCircle.apply(this, arguments); }
  function closeCollection(){ return __cmP.closeCollection.apply(this, arguments); }
  function closeCollectionPicker(){ return __cmP.closeCollectionPicker.apply(this, arguments); }
  function closeCommissionUI(){ return __cmP.closeCommissionUI.apply(this, arguments); }
  function closeDm(){ return __cmP.closeDm.apply(this, arguments); }
  function createArenaUI(){ return __cmP.createArenaUI.apply(this, arguments); }
  function createCircleUI(){ return __cmP.createCircleUI.apply(this, arguments); }
  function createCollectionUI(){ return __cmP.createCollectionUI.apply(this, arguments); }
  function createMyCollectionUI(){ return __cmP.createMyCollectionUI.apply(this, arguments); }
  function fileLine(){ return __cmP.fileLine.apply(this, arguments); }
  function installDownloadedUpdate(){ return __cmP.installDownloadedUpdate.apply(this, arguments); }
  function isFavorite(){ return __cmP.isFavorite.apply(this, arguments); }
  function likeFeedPost(){ return __cmP.likeFeedPost.apply(this, arguments); }
  function loadFeed(){ return __cmP.loadFeed.apply(this, arguments); }
  function loadInstalled(){ return __cmP.loadInstalled.apply(this, arguments); }
  function loadRevisions(){ return __cmP.loadRevisions.apply(this, arguments); }
  function mallCard(){ return __cmP.mallCard.apply(this, arguments); }
  function mallCover(){ return __cmP.mallCover.apply(this, arguments); }
  function mallStars(){ return __cmP.mallStars.apply(this, arguments); }
  function markAllNotif(){ return __cmP.markAllNotif.apply(this, arguments); }
  function markNotif(){ return __cmP.markNotif.apply(this, arguments); }
  function openApplyUpdateFromChangelog(){ return __cmP.openApplyUpdateFromChangelog.apply(this, arguments); }
  function openArena(){ return __cmP.openArena.apply(this, arguments); }
  function openCircle(){ return __cmP.openCircle.apply(this, arguments); }
  function openCollection(){ return __cmP.openCollection.apply(this, arguments); }
  function openCollectionPicker(){ return __cmP.openCollectionPicker.apply(this, arguments); }
  function openDm(){ return __cmP.openDm.apply(this, arguments); }
  function openDmFromNotif(){ return __cmP.openDmFromNotif.apply(this, arguments); }
  function openDmInbox(){ return __cmP.openDmInbox.apply(this, arguments); }
  function packCoverUrl(){ return __cmP.packCoverUrl.apply(this, arguments); }
  function packGalleryImages(){ return __cmP.packGalleryImages.apply(this, arguments); }
  function pickCollection(){ return __cmP.pickCollection.apply(this, arguments); }
  function postCommissionUI(){ return __cmP.postCommissionUI.apply(this, arguments); }
  function postToCircle(){ return __cmP.postToCircle.apply(this, arguments); }
  function proposeRevisionUI(){ return __cmP.proposeRevisionUI.apply(this, arguments); }
  function publishDraft(){ return __cmP.publishDraft.apply(this, arguments); }
  function quickCreateCollection(){ return __cmP.quickCreateCollection.apply(this, arguments); }
  function refreshNotifs(){ return __cmP.refreshNotifs.apply(this, arguments); }
  function reloadAppliedUpdate(){ return __cmP.reloadAppliedUpdate.apply(this, arguments); }
  function removeFriendUI(){ return __cmP.removeFriendUI.apply(this, arguments); }
  function renderArenaLayer(){ return __cmP.renderArenaLayer.apply(this, arguments); }
  function renderCircleLayer(){ return __cmP.renderCircleLayer.apply(this, arguments); }
  function renderCollectionLayer(){ return __cmP.renderCollectionLayer.apply(this, arguments); }
  function renderCollectionPicker(){ return __cmP.renderCollectionPicker.apply(this, arguments); }
  function renderDmLayer(){ return __cmP.renderDmLayer.apply(this, arguments); }
  function renderMallPane(){ return __cmP.renderMallPane.apply(this, arguments); }
  function renderRevisionSection(){ return __cmP.renderRevisionSection.apply(this, arguments); }
  function respondFriendUI(){ return __cmP.respondFriendUI.apply(this, arguments); }
  function respondRevisionUI(){ return __cmP.respondRevisionUI.apply(this, arguments); }
  function sendDm(){ return __cmP.sendDm.apply(this, arguments); }
  function submitArenaUI(){ return __cmP.submitArenaUI.apply(this, arguments); }
  function submitFeedPost(){ return __cmP.submitFeedPost.apply(this, arguments); }
  function toggleCircleJoin(){ return __cmP.toggleCircleJoin.apply(this, arguments); }
  function toggleFavorite(){ return __cmP.toggleFavorite.apply(this, arguments); }
  function updateApplyState(){ return __cmP.updateApplyState.apply(this, arguments); }
  function accountRefresh(){ return __cmP.accountRefresh.apply(this, arguments); }
  function accountSetEmail(){ return __cmP.accountSetEmail.apply(this, arguments); }
  function accountLogout(){ return __cmP.accountLogout.apply(this, arguments); }
  function refreshAccountSession(){ return __cmP.refreshAccountSession.apply(this, arguments); }
  function replaceAccountSession(){ return __cmP.replaceAccountSession.apply(this, arguments); }
  function resetAccountRemoteState(){ return __cmP.resetAccountRemoteState.apply(this, arguments); }
  //>>CM-SPLIT20-PLUMBING-A-END

  function desktop() {
    // 移植 S1.x 纠正（推翻 S0.3 的 isNative）：本文件这些闸内部全是 `window.tianming.X`，
    // 真实语义是「有没有 IPC 桥」=仅 electron，而非「有没有原生能力」(isNative)。
    // S0.3 误读成 isNative → capacitor(isNative=true) 会撞进 window.tianming 支（null→崩）。
    // 回正为读 caps.ipc：
    //   • electron → ipc=true（≡ 旧 isDesktop，零回归）
    //   • web/浏览器 → false（≡ 旧，零回归）
    //   • capacitor → false ⇒ 走 else 的 TM.OnlineClient 浏览器路（= owner「在线一致」，
    //     CORS 由 CapacitorHttp 原生补丁兜；磁盘类工坊/热更的 capacitor 原生实现属 S1.4/S3）。
    if (window.TM && window.TM.platform && window.TM.platform.caps) return !!window.TM.platform.caps.ipc;
    return !!(window.tianming && window.tianming.isDesktop); // TM.platform 未就绪时兜底
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
      return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c];
    });
  }

  function say(msg) {
    try {
      if (typeof toast === 'function') toast(msg);
      else console.log('[content]', msg);
    } catch(e) {}
  }

  function loadFeedUrl() {
    try { return localStorage.getItem('tm_update_feed_url') || state.defaultFeedUrl || ''; } catch(e) { return state.defaultFeedUrl || ''; }
  }

  function saveFeedUrl(url) {
    try { localStorage.setItem('tm_update_feed_url', url || ''); } catch(e) {}
  }

  function loadHotFeedUrl() {
    try { return localStorage.getItem('tm_hot_update_feed_url') || state.defaultHotFeedUrl || ''; } catch(e) { return state.defaultHotFeedUrl || ''; }
  }

  function saveHotFeedUrl(url) {
    try { localStorage.setItem('tm_hot_update_feed_url', url || ''); } catch(e) {}
  }

  function loadCatalogUrl() {
    try { return localStorage.getItem('tm_workshop_catalog_url') || state.defaultCatalogUrl || ''; } catch(e) { return state.defaultCatalogUrl || ''; }
  }

  function saveCatalogUrl(url) {
    try { localStorage.setItem('tm_workshop_catalog_url', url || ''); } catch(e) {}
  }

  function loadOnlineApiUrl() {
    try { return localStorage.getItem('tm_online_api_url') || state.defaultOnlineApiUrl || ''; } catch(e) { return state.defaultOnlineApiUrl || ''; }
  }

  function saveOnlineApiUrl(url) {
    try { localStorage.setItem('tm_online_api_url', url || ''); } catch(e) {}
  }

  function releaseNotes(info) {
    if (!info) return '';
    var notes = info.releaseNotes || info.releaseName || info.releaseDate || '';
    if (Array.isArray(notes)) {
      notes = notes.map(function(n){ return n && (n.note || n.version || n); }).filter(Boolean).join('\n');
    }
    return String(notes || '').slice(0, 1600);
  }

  function formatBytes(bytes) {
    var n = Number(bytes || 0);
    if (!n) return '检查后显示';
    var units = ['B', 'KB', 'MB', 'GB'];
    var i = 0;
    while (n >= 1024 && i < units.length - 1) { n = n / 1024; i++; }
    return (i === 0 ? String(Math.round(n)) : n.toFixed(n >= 100 ? 0 : n >= 10 ? 1 : 2)) + ' ' + units[i];
  }

  function updateInfoSize(info) {
    if (!info) return 0;
    if (Number(info.size) > 0) return Number(info.size);
    var files = Array.isArray(info.files) ? info.files : [];
    return files.reduce(function(sum, f){ return sum + (Number(f && f.size) || 0); }, 0);
  }

  function changelogSummary(limit) {
    var entries = state.changelogEntries || [];
    if (!entries.length) return '<div class="tm-empty">尚未读取游戏公告。</div>';
    return entries.slice(0, limit || 4).map(function(entry){
      var items = Array.isArray(entry.items) ? entry.items.slice(0, 3).map(function(item){
        return typeof item === 'string' ? item : (item && item.what) || '';
      }).filter(Boolean) : [];
      return '<div class="tm-card">' +
        '<div style="color:#f2d487;font-weight:800;">' + esc(entry.title || entry.module || '更新') + '</div>' +
        '<div class="tm-pack-meta">' + esc((entry.date || '') + (entry.module ? ' / ' + entry.module : '')) + '</div>' +
        (items.length ? '<div class="tm-copy" style="margin-top:.45rem;">' + items.map(function(x){ return '· ' + esc(x); }).join('<br>') + '</div>' : '') +
      '</div>';
    }).join('');
  }

  async function loadChangelog() {
    try {
      var res = await fetch('changelog.json?ts=' + Date.now());
      var data = await res.json();
      state.changelogEntries = Array.isArray(data.entries) ? data.entries : [];
    } catch(e) {
      state.changelogEntries = [];
    }
  }

  function ensureLayer() {
    var bg = document.getElementById('tm-content-bg');
    if (bg) return bg;
    ensureStyle();
    bg = document.createElement('div');
    bg.id = 'tm-content-bg';
    bg.className = 'tm-online-shell-bg';
    document.body.appendChild(bg);
    return bg;
  }

  function btn(label, onclick, cls) {
    return '<button class="' + (cls || 'bt bs bsm') + '" onclick="' + onclick + '">' + esc(label) + '</button>';
  }

  function ensureStyle() {
    if (document.getElementById('tm-content-manager-style')) return;
    var css = document.createElement('style');
    css.id = 'tm-content-manager-style';
    css.textContent = [
      '.tm-online-shell-bg{position:fixed;inset:0;z-index:2600;background:radial-gradient(circle at 18% 12%,rgba(174,41,33,.22),transparent 28%),rgba(3,2,1,.9);display:none;align-items:center;justify-content:center;}',
      '.tm-online-shell{width:min(1040px,94vw);height:min(760px,88vh);display:grid;grid-template-rows:auto 1fr;background:linear-gradient(145deg,rgba(34,20,14,.98),rgba(10,7,5,.98));border:1px solid rgba(214,177,93,.58);box-shadow:0 24px 80px rgba(0,0,0,.68),inset 0 0 0 1px rgba(255,238,184,.05);color:var(--txt,#eadfcb);overflow:hidden;}',
      '.tm-online-head{display:grid;grid-template-columns:1fr auto;gap:1rem;padding:1rem 1.1rem .9rem;border-bottom:1px solid rgba(214,177,93,.28);background:linear-gradient(90deg,rgba(90,28,19,.32),rgba(0,0,0,.08));}',
      '.tm-online-title{font-size:1.05rem;font-weight:800;color:var(--gold,#d8b56a);letter-spacing:0;}',
      '.tm-online-sub{margin-top:.25rem;font-size:.74rem;line-height:1.45;color:rgba(234,223,203,.68);}',
      '.tm-online-tabs{display:flex;gap:.35rem;align-items:flex-end;flex-wrap:wrap;padding:.75rem 1rem 0;background:rgba(0,0,0,.12);}',
      '.tm-tab{min-height:44px;padding:.5rem .85rem;border:1px solid rgba(214,177,93,.28);background:rgba(0,0,0,.2);color:rgba(234,223,203,.82);cursor:pointer;transition:background .18s ease,border-color .18s ease,color .18s ease;}',
      '.tm-tab:hover{background:rgba(214,177,93,.12);color:#f6e5b7;}',
      '.tm-tab:focus-visible,.tm-action:focus-visible{outline:2px solid #f0d68a;outline-offset:2px;}',
      '.tm-tab.is-active{background:linear-gradient(180deg,rgba(142,38,28,.86),rgba(63,20,15,.92));border-color:rgba(214,177,93,.72);color:#ffe3a1;}',
      '.tm-online-shell>div:last-child{min-height:0;display:grid;grid-template-rows:auto 1fr;}',
      '.tm-online-body{min-height:0;padding:1rem;overflow-y:auto;overflow-x:hidden;scrollbar-width:thin;scrollbar-color:rgba(214,177,93,.4) transparent;}',
      '.tm-online-body::-webkit-scrollbar{width:9px;}',
      '.tm-online-body::-webkit-scrollbar-thumb{background:rgba(214,177,93,.32);border:2px solid transparent;background-clip:padding-box;border-radius:6px;}',
      '.tm-online-body::-webkit-scrollbar-thumb:hover{background:rgba(214,177,93,.55);background-clip:padding-box;}',
      '.tm-grid-2{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(280px,.9fr);gap:.8rem;}',
      '.tm-grid-3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.55rem;}',
      '.tm-panel{border:1px solid rgba(214,177,93,.25);background:linear-gradient(180deg,rgba(255,244,199,.055),rgba(0,0,0,.13));padding:.9rem;min-width:0;}',
      '.tm-panel h4{margin:0 0 .65rem;color:var(--gold,#d8b56a);font-size:.92rem;font-weight:800;display:flex;align-items:center;gap:.5rem;}',
      '.tm-panel h4::before{content:"";flex:0 0 auto;width:4px;height:.95rem;background:linear-gradient(180deg,#f0d68a,#a9762e);box-shadow:0 0 6px rgba(214,177,93,.4);}',
      '.tm-copy{font-size:.76rem;line-height:1.65;color:rgba(234,223,203,.72);}',
      '.tm-field{display:grid;gap:.28rem;margin-top:.65rem;}',
      '.tm-field label{font-size:.72rem;color:rgba(214,177,93,.92);}',
      '.tm-input{min-height:44px;width:100%;box-sizing:border-box;border:1px solid rgba(214,177,93,.32);background:rgba(0,0,0,.28);color:#f4ead6;padding:.55rem .65rem;outline:none;}',
      '.tm-input:focus,.tm-input:focus-visible{border-color:rgba(214,177,93,.82);box-shadow:0 0 0 2px rgba(214,177,93,.22);}',
      '.tm-input::placeholder{color:rgba(234,223,203,.5);}',
      '.tm-actions{display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.75rem;}',
      '.tm-action{min-height:44px;padding:.5rem .82rem;border:1px solid rgba(214,177,93,.34);background:rgba(0,0,0,.18);color:#eadfcb;cursor:pointer;transition:transform .15s ease,background .18s ease,border-color .18s ease;}',
      '.tm-action:hover{background:rgba(214,177,93,.12);border-color:rgba(214,177,93,.62);}',
      '.tm-action:active{transform:translateY(1px);}',
      '.tm-action.primary{background:linear-gradient(180deg,#b74635,#7f241d);border-color:#d9b96b;color:#fff1c2;}',
      '.tm-action.danger{background:rgba(119,29,23,.7);border-color:rgba(231,105,82,.55);color:#ffd9ce;}',
      '.tm-action.disabled,.tm-action:disabled{opacity:.46;cursor:not-allowed;}',
      '.tm-status{margin-top:.7rem;border-left:3px solid rgba(214,177,93,.7);background:rgba(214,177,93,.08);padding:.58rem .7rem;font-size:.78rem;line-height:1.6;color:#e8d49d;}',
      '.tm-status.warn{border-left-color:#d66e4d;background:rgba(173,45,30,.16);color:#ffd6c7;}',
      '.tm-kv{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.45rem;}',
      '.tm-kv div,.tm-card{border:1px solid rgba(214,177,93,.18);background:rgba(0,0,0,.18);padding:.58rem .65rem;min-width:0;}',
      '.tm-kv small{display:block;color:rgba(234,223,203,.72);font-size:0.71rem;margin-bottom:.18rem;}',
      '.tm-kv b{color:#f2d487;font-size:.8rem;font-weight:700;word-break:break-all;}',
      '.tm-pill{display:inline-flex;align-items:center;min-height:24px;padding:0 .55rem;border:1px solid rgba(214,177,93,.35);background:rgba(214,177,93,.1);color:#f0d58a;font-size:0.71rem;}',
      '.tm-pill.good{border-color:rgba(99,186,132,.5);background:rgba(50,128,79,.16);color:#bfe7c8;}',
      '.tm-pill.off{border-color:rgba(180,78,61,.48);background:rgba(120,31,23,.16);color:#f0b7a8;}',
      '.tm-pack-list{display:grid;gap:.55rem;margin-top:.65rem;}',
      '.tm-pack{border:1px solid rgba(214,177,93,.22);background:linear-gradient(90deg,rgba(56,26,17,.7),rgba(11,8,6,.78));padding:.72rem;display:grid;grid-template-columns:1fr auto;gap:.65rem;align-items:start;}',
      '.tm-pack-title{font-weight:800;color:#f1d58a;}',
      '.tm-pack-meta{font-size:.7rem;color:rgba(234,223,203,.74);margin-top:.16rem;}',
      '.tm-pack-desc{font-size:.76rem;line-height:1.55;color:rgba(234,223,203,.76);margin-top:.42rem;}',
      '.tm-empty{padding:1rem;border:1px dashed rgba(214,177,93,.25);color:rgba(234,223,203,.58);font-size:.78rem;text-align:center;}',
      '.tm-progress{height:7px;background:rgba(255,255,255,.08);border:1px solid rgba(214,177,93,.22);margin-top:.5rem;overflow:hidden;}',
      '.tm-progress i{display:block;height:100%;background:linear-gradient(90deg,#a92f25,#d9b96b);}',
      '.tm-account-seal{display:grid;place-items:center;min-height:138px;border:1px solid rgba(214,177,93,.22);background:radial-gradient(circle,rgba(157,39,28,.35),rgba(0,0,0,.08) 62%);color:#f0d58a;font-size:.85rem;text-align:center;padding:1rem;}',
      // 已登录身份牌
      '.tm-acct-card{display:grid;grid-template-columns:auto 1fr;gap:.85rem;align-items:center;padding:.85rem .9rem;border:1px solid rgba(214,177,93,.32);background:linear-gradient(120deg,rgba(157,39,28,.28),rgba(255,244,199,.05) 70%);}',
      '.tm-acct-seal{width:58px;height:58px;border-radius:50%;display:grid;place-items:center;border:2px solid rgba(214,177,93,.7);background:radial-gradient(circle at 50% 38%,rgba(183,70,53,.6),rgba(10,7,5,.92));color:#ffe6ad;font-size:1.6rem;font-weight:800;box-shadow:inset 0 0 10px rgba(0,0,0,.5),0 0 0 1px rgba(255,238,184,.18);text-shadow:0 1px 2px rgba(0,0,0,.6);}',
      '.tm-acct-name{font-size:1.18rem;font-weight:800;color:#f7e7b8;line-height:1.2;}',
      '.tm-acct-sub{margin-top:.25rem;font-size:.74rem;color:rgba(234,223,203,.66);word-break:break-all;}',
      '.tm-acct-badge{display:inline-flex;align-items:center;min-height:20px;padding:0 .42rem;margin-top:.4rem;border:1px solid rgba(99,186,132,.5);background:rgba(50,128,79,.16);color:#bfe7c8;font-size:0.7rem;}',
      // 登录主区（邮箱验证码）
      '.tm-loginbox{margin-top:.7rem;border:1px solid rgba(214,177,93,.34);border-left:3px solid rgba(214,177,93,.85);background:linear-gradient(180deg,rgba(255,244,199,.06),rgba(0,0,0,.16));padding:.7rem .8rem .85rem;}',
      '.tm-loginbox-h{display:flex;align-items:center;gap:.5rem;font-size:.82rem;font-weight:800;color:#f2d487;}',
      '.tm-loginbox-h .tm-tagchip{margin-left:auto;}',
      // 次要区（账号密码）
      '.tm-subform{margin-top:.7rem;border:1px dashed rgba(214,177,93,.28);background:rgba(0,0,0,.16);padding:.55rem .75rem .75rem;}',
      '.tm-subform.is-collapsed .tm-subform-body{display:none;}',
      '.tm-subform-head{display:flex;align-items:center;gap:.5rem;cursor:pointer;font-size:.76rem;color:rgba(234,223,203,.82);user-select:none;min-height:36px;}',
      '.tm-subform-head:focus-visible{outline:2px solid #f0d68a;outline-offset:2px;}',
      '.tm-subform-head .tm-caret{margin-left:auto;color:var(--gold,#d8b56a);transition:transform .18s ease;}',
      // 密码显隐切换
      '.tm-pw{position:relative;}',
      '.tm-pw .tm-input{padding-right:3.6rem;}',
      '.tm-pw-toggle{position:absolute;top:50%;right:.4rem;transform:translateY(-50%);min-height:32px;padding:0 .55rem;border:1px solid rgba(214,177,93,.32);background:rgba(0,0,0,.32);color:rgba(240,213,138,.92);font-size:0.71rem;cursor:pointer;}',
      '.tm-pw-toggle:hover{border-color:rgba(214,177,93,.62);}',
      '.tm-pw-toggle:focus-visible{outline:2px solid #f0d68a;outline-offset:1px;}',
      '.tm-subform.is-collapsed .tm-subform-head .tm-caret{transform:rotate(-90deg);}',
      // 步骤徽标
      '.tm-step{flex:0 0 auto;width:18px;height:18px;border-radius:50%;display:inline-grid;place-items:center;border:1px solid rgba(214,177,93,.6);background:rgba(214,177,93,.12);color:#f0d58a;font-size:0.7rem;font-weight:700;}',
      // 健康点
      '.tm-dot{flex:0 0 auto;width:9px;height:9px;border-radius:50%;background:#7c5a2a;box-shadow:0 0 0 2px rgba(0,0,0,.25);}',
      '.tm-dot.on{background:#6fcf97;box-shadow:0 0 7px rgba(111,207,151,.7);}',
      '.tm-dot.off{background:#c9624a;box-shadow:0 0 6px rgba(201,98,74,.5);}',
      // 标签 chip
      '.tm-tags{display:flex;flex-wrap:wrap;gap:.3rem;margin-top:.4rem;}',
      '.tm-tagchip{display:inline-flex;align-items:center;min-height:20px;padding:0 .45rem;border:1px solid rgba(214,177,93,.3);background:rgba(214,177,93,.09);color:rgba(240,213,138,.92);font-size:0.7rem;}',
      // 分隔线带字
      '.tm-or{display:flex;align-items:center;gap:.6rem;margin:.85rem 0 .15rem;color:rgba(234,223,203,.5);font-size:.7rem;}',
      '.tm-or::before,.tm-or::after{content:"";flex:1;height:1px;background:rgba(214,177,93,.22);}',
      // 总览 feature 卡
      '.tm-feat{border:1px solid rgba(214,177,93,.2);background:rgba(0,0,0,.18);padding:.6rem .65rem;}',
      '.tm-feat-h{display:flex;align-items:center;gap:.4rem;margin-bottom:.35rem;}',
      '.tm-feat-h b{color:#f2d487;font-size:.78rem;}',
      '.tm-feat-h .tm-pill{margin-left:auto;}',
      '.tm-update-ritual{position:fixed;inset:0;z-index:2700;display:none;align-items:center;justify-content:center;background:radial-gradient(circle at 50% 20%,rgba(154,47,34,.24),transparent 30%),rgba(2,1,1,.86);backdrop-filter:blur(5px);}',
      '.tm-update-ritual.show{display:flex;}',
      '.tm-update-box{width:min(900px,92vw);max-height:min(740px,90vh);display:grid;grid-template-rows:auto minmax(0,1fr) auto;background:linear-gradient(180deg,rgba(42,24,17,.98),rgba(10,7,5,.99));border:1px solid rgba(214,177,93,.7);box-shadow:0 28px 82px rgba(0,0,0,.72),inset 0 0 0 1px rgba(255,238,184,.07);color:#eadfcb;font-family:"STKaiti","KaiTi","楷体","Noto Serif SC","Songti SC",serif;}',
      // 御案化·标题楷体 + 圆形朱印（与 tm-update-card 同语·对齐 body.tm-phase8-formal）
      '.tm-update-title{padding:1rem 1.1rem;border-bottom:1px solid rgba(214,177,93,.28);display:flex;justify-content:space-between;gap:.8rem;align-items:flex-start;background:linear-gradient(90deg,rgba(138,38,28,.34),rgba(0,0,0,.08));}',
      '.tm-update-title b{display:flex;align-items:center;color:#f7dda0;font-size:1.08rem;letter-spacing:.12em;}',
      '.tm-update-title b::before{content:"\\66f4";display:grid;place-items:center;width:26px;height:26px;margin-right:.6rem;flex:0 0 auto;border-radius:50%;border:1px solid rgba(213,176,95,.55);color:#f4dca0;font-size:13px;background:radial-gradient(circle,rgba(154,47,34,.55),rgba(64,31,20,.85) 74%);box-shadow:inset 0 0 6px rgba(0,0,0,.45),0 0 6px rgba(201,160,69,.28);}',
      '.tm-update-title span{display:block;margin-top:.25rem;color:rgba(234,223,203,.66);font-size:.74rem;line-height:1.45;}',
      '.tm-update-body{min-height:0;overflow-y:auto;overflow-x:hidden;padding:1rem;display:block;}',
      '.tm-update-body>section{display:block;margin-bottom:.8rem;}',
      '.tm-update-body>section:last-child{margin-bottom:0;}',
      '.tm-update-progress{height:11px;background:rgba(255,255,255,.08);border:1px solid rgba(214,177,93,.32);overflow:hidden;}',
      '.tm-update-progress i{display:block;height:100%;background:linear-gradient(90deg,#a83226,#d8b56a);transition:width .18s ease;}',
      '.tm-update-log{max-height:120px;overflow:auto;border:1px solid rgba(214,177,93,.18);background:rgba(0,0,0,.22);padding:.55rem .65rem;font-size:.72rem;line-height:1.55;color:rgba(234,223,203,.66);}',
      '.tm-update-foot{padding:.85rem 1rem;border-top:1px solid rgba(214,177,93,.25);display:flex;justify-content:space-between;gap:.7rem;flex-wrap:wrap;background:rgba(0,0,0,.18);}',
      // 商城网格（S1 port）
      '.tm-store-bar{display:flex;gap:.55rem;align-items:center;flex-wrap:wrap;margin-top:.4rem;}',
      '.tm-store-search{flex:1;min-width:180px;}',
      '.tm-store-search .tm-input{margin:0;}',
      '.tm-cat-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:.7rem;margin-top:.7rem;}',
      '.tm-cat-card{border:1px solid rgba(214,177,93,.22);background:linear-gradient(180deg,rgba(48,24,15,.6),rgba(10,7,5,.7));display:flex;flex-direction:column;min-width:0;transition:transform .2s ease,border-color .2s ease,box-shadow .2s ease;}',
      '.tm-cat-card:hover{transform:translateY(-3px);border-color:rgba(214,177,93,.5);box-shadow:0 10px 24px rgba(0,0,0,.45);}',
      '.tm-cover{position:relative;width:100%;height:118px;overflow:hidden;display:grid;place-items:center;border-bottom:1px solid rgba(214,177,93,.22);font-family:"Noto Serif SC","Songti SC",serif;font-weight:700;color:#f4e2b6;text-shadow:0 1px 3px rgba(0,0,0,.6);box-shadow:inset 0 0 16px rgba(0,0,0,.5);}',
      '.tm-cover .scene{position:absolute;inset:0;width:100%;height:100%;z-index:0;}',
      '.tm-cover .cover-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;z-index:0;}',
      '.tm-cover::before{content:"";position:absolute;inset:0;z-index:1;background:radial-gradient(closest-side at 50% 56%,rgba(0,0,0,.32),transparent 72%);}',
      '.tm-cover-glyph{position:relative;z-index:2;font-size:2.6rem;line-height:1;}',
      '.tm-official{position:absolute;top:6px;left:6px;z-index:3;font-size:0.66rem;padding:.05rem .35rem;border:1px solid var(--gold,#d8b56a);background:rgba(0,0,0,.55);color:#f3da92;}',
      '.tm-cover.zhu{background:radial-gradient(circle at 50% 34%,#b5402f,#8c2b20);}',
      '.tm-cover.dai{background:radial-gradient(circle at 50% 34%,#2f5a58,#1f3a3a);}',
      '.tm-cover.jin{background:radial-gradient(circle at 50% 34%,#9c7a1e,#6e5212);color:#ffeec0;}',
      '.tm-cover.zhe{background:radial-gradient(circle at 50% 34%,#9a6326,#7a4a1e);}',
      '.tm-cover.mo{background:radial-gradient(circle at 50% 34%,#3a2c22,#241c16);}',
      '.tm-cover.jiang{background:radial-gradient(circle at 50% 34%,#84302a,#5e1f1a);}',
      '.tm-cover.qing{background:radial-gradient(circle at 50% 34%,#324b5c,#23323f);}',
      '.tm-cat-body{padding:.6rem .65rem .7rem;display:flex;flex-direction:column;min-width:0;}',
      '.tm-cat-title{font-weight:800;color:#f4d89a;font-size:.86rem;line-height:1.3;font-family:"Noto Serif SC","Songti SC",serif;}',
      '.tm-cat-au{font-size:0.71rem;color:rgba(234,223,203,.6);margin-top:.22rem;}',
      // P1-S1 类型筛选 + 角标
      '.tm-typebar{display:flex;gap:.4rem;flex-wrap:wrap;margin-top:.6rem;}',
      '.tm-typechip{display:inline-flex;align-items:center;min-height:30px;padding:0 .7rem;font-size:.74rem;cursor:pointer;border:1px solid rgba(214,177,93,.26);background:rgba(0,0,0,.25);color:rgba(234,223,203,.74);transition:background .18s ease,border-color .18s ease,color .18s ease;}',
      '.tm-typechip:hover{border-color:rgba(214,177,93,.6);color:#f6e5b7;}',
      '.tm-typechip.on{background:linear-gradient(180deg,rgba(150,42,30,.7),rgba(70,22,16,.6));border-color:rgba(214,177,93,.7);color:#ffe7ab;}',
      '.tm-ptype{position:absolute;top:6px;right:6px;z-index:3;font-size:0.66rem;padding:.05rem .35rem;border:1px solid rgba(214,177,93,.5);background:rgba(0,0,0,.55);color:#f0d58a;}',
      // S2 详情浮层
      '.tm-detail-layer{position:fixed;inset:0;z-index:2680;display:grid;place-items:center;background:rgba(4,2,1,.78);padding:2vh 2vw;}',
      '.tm-detail-sheet{width:min(820px,94vw);max-height:90vh;display:grid;grid-template-rows:auto 1fr;border:1px solid rgba(214,177,93,.6);background:linear-gradient(180deg,rgba(40,24,16,.99),rgba(12,8,5,.99));box-shadow:0 30px 80px rgba(0,0,0,.7);}',
      '.tm-detail-head{display:flex;align-items:center;padding:.8rem 1rem;border-bottom:1px solid rgba(214,177,93,.28);}',
      '.tm-detail-head b{color:var(--gold,#d8b56a);font-size:.95rem;}',
      '.tm-detail-head .tm-action{margin-left:auto;min-height:34px;}',
      '.tm-detail-body{min-height:0;overflow-y:auto;padding:1rem 1.1rem 1.2rem;}',
      '.tm-detail-hero{display:grid;grid-template-columns:150px 1fr;gap:1.1rem;align-items:start;}',
      '.tm-cover-lg{height:auto;aspect-ratio:3/4;border:1px solid rgba(214,177,93,.4);border-bottom:1px solid rgba(214,177,93,.4);}',
      '.tm-cover-lg .tm-cover-glyph{font-size:3.4rem;}',
      '.tm-detail-kick{font-size:.7rem;letter-spacing:2px;color:var(--gold,#d8b56a);}',
      '.tm-detail-title{font-family:"Noto Serif SC","Songti SC",serif;font-size:1.25rem;margin:.3rem 0 .5rem;color:#f6dca0;line-height:1.3;}',
      '.tm-detail-meta{font-size:.76rem;color:rgba(234,223,203,.72);}',
      '.tm-detail-rate{font-size:.74rem;color:rgba(234,223,203,.7);margin-left:.3rem;}',
      '.tm-detail-h{margin:1rem 0 .5rem;color:var(--gold,#d8b56a);font-size:.86rem;font-weight:800;}',
      '.tm-detail-author span{color:var(--gold,#d8b56a);cursor:pointer;text-decoration:underline;font-size:.82rem;}',
      '.tm-comment-list{display:grid;gap:.5rem;margin-top:.6rem;}',
      '.tm-comment{border:1px solid rgba(214,177,93,.18);background:rgba(0,0,0,.18);padding:.55rem .7rem;}',
      '.tm-comment-h{display:flex;align-items:baseline;gap:.5rem;}',
      '.tm-comment-h b{color:#f1d490;font-size:.78rem;font-family:"Noto Serif SC","Songti SC",serif;}',
      '.tm-comment-h small{color:rgba(234,223,203,.5);font-size:0.7rem;margin-left:auto;}',
      '.tm-comment-t{font-size:.78rem;line-height:1.6;color:rgba(234,223,203,.78);margin-top:.3rem;}',
      // P1-S2a 立绘画廊 / 音乐曲目
      '.tm-gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(86px,1fr));gap:.5rem;}',
      '.tm-port{aspect-ratio:3/4;border:1px solid rgba(214,177,93,.25);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.3rem;background:radial-gradient(circle at 50% 32%,rgba(150,42,30,.5),rgba(8,6,4,.92));box-shadow:inset 0 0 12px rgba(0,0,0,.5);}',
      '.tm-port-g{font-family:"Noto Serif SC","Songti SC",serif;font-size:1.7rem;color:#f4e2b6;text-shadow:0 1px 3px rgba(0,0,0,.6);}',
      '.tm-port small{font-size:0.68rem;color:rgba(234,223,203,.7);}',
      '.tm-tracklist{border:1px solid rgba(214,177,93,.2);background:rgba(0,0,0,.18);}',
      '.tm-track{display:grid;grid-template-columns:auto 1fr auto auto;gap:.7rem;align-items:center;padding:.5rem .7rem;border-bottom:1px solid rgba(214,177,93,.1);cursor:pointer;}',
      '.tm-track:last-child{border-bottom:none;}',
      '.tm-track:hover{background:rgba(214,177,93,.05);}',
      '.tm-track.playing{background:linear-gradient(90deg,rgba(150,42,30,.28),transparent);box-shadow:inset 3px 0 0 var(--gold,#d8b56a);}',
      '.tm-track-pl{width:26px;height:26px;display:grid;place-items:center;border:1px solid rgba(214,177,93,.5);border-radius:50%;color:#f3da92;font-size:0.7rem;}',
      '.tm-track b{font-family:"Noto Serif SC","Songti SC",serif;font-size:.8rem;color:#f1d490;}',
      '.tm-track small{font-size:0.7rem;color:rgba(234,223,203,.5);}',
      '.tm-track em{font-size:.7rem;color:rgba(234,223,203,.7);font-style:normal;font-variant-numeric:tabular-nums;}',
      // P2-S1 好友
      '.tm-friend-list{display:grid;gap:.4rem;margin-top:.4rem;}',
      '.tm-friend{display:flex;align-items:center;justify-content:space-between;gap:.6rem;border:1px solid rgba(214,177,93,.18);background:rgba(0,0,0,.18);padding:.45rem .6rem;}',
      '.tm-friend-id b{font-family:"Noto Serif SC","Songti SC",serif;font-size:.82rem;color:#f1d490;}',
      '.tm-friend-id small{color:rgba(234,223,203,.5);font-size:0.7rem;margin-left:.4rem;}',
      '.tm-friend .tm-action{padding:.2rem .55rem;font-size:.72rem;}',
      // P2-S3 通知
      '.tm-unread{display:inline-block;min-width:16px;padding:0 .3rem;margin-left:.4rem;font-size:0.68rem;text-align:center;color:#fff;background:#a3331f;border-radius:8px;}',
      '.tm-notif-list{display:grid;gap:.35rem;margin-top:.45rem;}',
      '.tm-notif{display:flex;align-items:center;gap:.55rem;border:1px solid rgba(214,177,93,.14);background:rgba(0,0,0,.16);padding:.45rem .6rem;}',
      '.tm-notif.unread{border-left:3px solid var(--gold,#d8b56a);background:rgba(150,42,30,.12);}',
      '.tm-notif-i{width:24px;height:24px;display:grid;place-items:center;border:1px solid rgba(214,177,93,.35);color:#f0d58a;font-size:.78rem;flex:none;}',
      '.tm-notif-b{flex:1;min-width:0;}',
      '.tm-notif-b div{font-size:.76rem;color:rgba(234,223,203,.85);overflow:hidden;text-overflow:ellipsis;}',
      '.tm-notif-b small{font-size:0.7rem;color:rgba(234,223,203,.45);}',
      '.tm-notif .tm-action{padding:.15rem .5rem;font-size:0.71rem;flex:none;}',
      // P2-S2 私信
      '.tm-convo-list{display:grid;gap:.4rem;}',
      '.tm-convo{border:1px solid rgba(214,177,93,.16);background:rgba(0,0,0,.16);padding:.5rem .65rem;cursor:pointer;}',
      '.tm-convo:hover{border-color:rgba(214,177,93,.5);}',
      '.tm-convo-id b{font-family:"Noto Serif SC","Songti SC",serif;color:#f1d490;font-size:.82rem;}',
      '.tm-convo-last{font-size:.72rem;color:rgba(234,223,203,.6);margin-top:.2rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '.tm-dm-thread{display:flex;flex-direction:column;gap:.4rem;max-height:46vh;overflow-y:auto;padding:.3rem 0;}',
      '.tm-bubble{max-width:78%;padding:.45rem .7rem;font-size:.8rem;line-height:1.5;border-radius:10px;}',
      '.tm-bubble.them{align-self:flex-start;background:rgba(40,32,24,.8);border:1px solid rgba(214,177,93,.18);color:rgba(234,223,203,.9);border-bottom-left-radius:2px;}',
      '.tm-bubble.me{align-self:flex-end;background:linear-gradient(180deg,rgba(150,42,30,.7),rgba(110,30,22,.7));border:1px solid rgba(214,177,93,.3);color:#ffe7c2;border-bottom-right-radius:2px;}',
      '.tm-dm-compose{display:flex;gap:.4rem;margin-top:.55rem;align-items:stretch;}',
      '.tm-dm-compose .tm-input{flex:1;}',
      // P3 世界线 + 史册接龙
      '.tm-fork-from{color:var(--gold,#d8b56a);cursor:pointer;text-decoration:underline;font-size:.74rem;}',
      '.tm-wtree{display:grid;gap:.3rem;margin-top:.4rem;}',
      '.tm-wnode{border:1px solid rgba(214,177,93,.16);background:rgba(0,0,0,.16);padding:.4rem .6rem;cursor:pointer;position:relative;}',
      '.tm-wnode:hover{border-color:rgba(214,177,93,.5);}',
      '.tm-wnode.cur{border-color:var(--gold,#d8b56a);background:rgba(150,42,30,.16);box-shadow:inset 2px 0 0 var(--gold,#d8b56a);}',
      '.tm-wnode b{font-family:"Noto Serif SC","Songti SC",serif;color:#f1d490;font-size:.8rem;}',
      '.tm-wnode small{color:rgba(234,223,203,.5);font-size:0.7rem;margin-left:.5rem;}',
      '.tm-chron-list{display:grid;gap:.5rem;margin-top:.4rem;}',
      '.tm-chron{border:1px solid rgba(214,177,93,.18);background:rgba(0,0,0,.18);padding:.55rem .7rem;}',
      '.tm-chron-h{display:flex;align-items:center;gap:.5rem;}',
      '.tm-chron-h b{font-family:"Noto Serif SC","Songti SC",serif;color:#f1d490;font-size:.84rem;}',
      '.tm-chron-meta{font-size:0.7rem;color:rgba(234,223,203,.5);margin-top:.2rem;}',
      '.tm-chron-sum{font-size:.76rem;line-height:1.6;color:rgba(234,223,203,.78);margin-top:.3rem;}',
      '.tm-chain{display:grid;gap:.35rem;margin-top:.3rem;}',
      '.tm-chain-node{display:flex;align-items:center;gap:.55rem;}',
      '.tm-chain-i{width:22px;height:22px;display:grid;place-items:center;border-radius:50%;border:1px solid rgba(214,177,93,.5);color:#f0d58a;font-size:.7rem;flex:none;}',
      '.tm-chain-node small{color:rgba(234,223,203,.5);font-size:0.7rem;margin-left:.4rem;}',
      // P4-S1 AI 共创
      '.tm-aicreate{border:1px solid rgba(214,177,93,.28);background:linear-gradient(180deg,rgba(40,30,52,.5),rgba(0,0,0,.2));padding:.6rem .7rem;margin-top:.6rem;}',
      '.tm-aicreate-h{font-family:"Noto Serif SC","Songti SC",serif;color:#e8c8f0;font-size:.84rem;font-weight:700;}',
      '.tm-aidraft{border:1px solid rgba(214,177,93,.3);background:rgba(0,0,0,.25);padding:.5rem .6rem;margin-top:.45rem;}',
      '.tm-aidraft b{color:#f1d490;font-family:"Noto Serif SC","Songti SC",serif;}',
      '@media (max-width:860px){.tm-online-shell{height:92vh}.tm-grid-2,.tm-grid-3{grid-template-columns:1fr}.tm-pack{grid-template-columns:1fr}.tm-online-head{grid-template-columns:1fr}.tm-kv{grid-template-columns:1fr}.tm-cat-grid{grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}}',
      '@media (prefers-reduced-motion:reduce){.tm-tab,.tm-action,.tm-caret,.tm-input{transition:none!important}.tm-action:active{transform:none!important}}'
    ].join('\n');
    document.head.appendChild(css);
  }

  function action(label, onclick, tone, disabled) {
    return '<button class="tm-action ' + (tone || '') + (disabled ? ' disabled' : '') + '" ' + (disabled ? 'disabled ' : '') + 'onclick="' + onclick + '">' + esc(label) + '</button>';
  }

  function pill(label, cls) {
    return '<span class="tm-pill ' + (cls || '') + '">' + esc(label) + '</span>';
  }

  function hotStatusText(evt) {
    if (!evt) return '';
    if (evt.kind === 'download-start') return '正在下载热更新 ' + (evt.version || '');
    if (evt.kind === 'download-progress') return '正在下载热更新 ' + Math.max(0, Math.min(100, Math.round(evt.percent || 0))) + '%';
    if (evt.kind === 'downloaded') return '热更新包已下载，正在校验。';
    if (evt.kind === 'verifying') return '正在校验热更新清单与文件哈希。';
    if (evt.kind === 'installed') return '热更新已安装，点击“立即重载前端”即可生效。';
    if (evt.kind === 'error') return '热更新失败：' + (evt.error || '未知错误');
    // 2026-07-07·增量 / 自基线重建 / 换源事件（老事件语义不动）
    if (evt.kind === 'incremental-start') return '正在读取增量更新清单...';
    if (evt.kind === 'incremental-plan') return '增量更新：共 ' + (evt.total || 0) + ' 个文件·只需下载 ' + (evt.fetch || 0) + ' 个（' + formatBytes(evt.fetchBytes || 0) + '）·其余本地复用。';
    if (evt.kind === 'incremental-progress') return '增量下载 ' + (evt.done || 0) + '/' + (evt.total || 0) + ' 个文件（' + formatBytes(evt.bytesDone || 0) + ' / ' + formatBytes(evt.fetchBytes || 0) + '）';
    if (evt.kind === 'incremental-fallback') return '增量更新不可用，转为校验本地文件补差...';
    if (evt.kind === 'rebaseline-start') return '正在校验本地文件（只补差异，无需下载整包）...';
    if (evt.kind === 'rebaseline-scan') return '校验本地文件 ' + (evt.scanned || 0) + '/' + (evt.total || 0) + '·可复用 ' + (evt.matched || 0) + ' 个';
    if (evt.kind === 'rebaseline-fallback') return '本地校验补差不可用，回退整包下载...';
    if (evt.kind === 'mirror-switch') return '主下载源失败，已切换备用下载源...';
    return evt.message || evt.error || '';
  }

  function packRow(p) {
    var enabled = p.enabled !== false;
    var bad = !p.installed ? ' · 文件缺失' : '';
    return '<div style="border:1px solid var(--bdr);background:rgba(0,0,0,.18);padding:.65rem;margin-bottom:.5rem;">' +
      '<div style="display:flex;justify-content:space-between;gap:.6rem;align-items:flex-start;">' +
        '<div style="min-width:0;">' +
          '<div style="font-weight:700;color:var(--gold);">' + esc(p.title || p.id) + '</div>' +
          '<div style="font-size:.72rem;color:var(--txt-d);margin-top:.15rem;">' + esc(p.id) + ' · ' + (p.version ? 'v' + esc(p.version) : '版本未提供') + ' · ' + esc(p.type || 'content') + bad + '</div>' +
          (p.description ? '<div style="font-size:.76rem;color:var(--txt);line-height:1.5;margin-top:.35rem;">' + esc(p.description) + '</div>' : '') +
        '</div>' +
        '<div style="display:flex;gap:.35rem;flex-wrap:wrap;justify-content:flex-end;">' +
          btn(enabled ? '停用' : '启用', 'TMContentManager.togglePack(\'' + esc(p.id) + '\',' + (!enabled) + ')') +
          btn('卸载', 'TMContentManager.uninstallPack(\'' + esc(p.id) + '\')', 'bt bd bsm') +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function catalogPackRow(p) {
    return '<div style="border:1px solid var(--bdr);background:rgba(0,0,0,.12);padding:.65rem;margin-bottom:.5rem;">' +
      '<div style="display:flex;justify-content:space-between;gap:.65rem;align-items:flex-start;">' +
        '<div style="min-width:0;">' +
          '<div style="font-weight:700;color:var(--gold);">' + esc(p.title || p.id) + '</div>' +
          '<div style="font-size:.72rem;color:var(--txt-d);margin-top:.15rem;">' + esc(p.id) + ' · ' + (p.version ? 'v' + esc(p.version) : '版本未提供') + ' · ' + esc(p.author || '未署名') + '</div>' +
          (p.description ? '<div style="font-size:.76rem;color:var(--txt);line-height:1.5;margin-top:.35rem;">' + esc(p.description) + '</div>' : '') +
        '</div>' +
        '<div style="display:flex;gap:.35rem;flex-wrap:wrap;justify-content:flex-end;">' +
          btn('在线安装', 'TMContentManager.installCatalogPack(\'' + esc(p.packageUrl) + '\',\'' + esc(p.sha256 || '') + '\')', 'bt bp bsm') +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function jsArg(value) {
    return JSON.stringify(String(value == null ? '' : value)).replace(/"/g, '&quot;');
  }

  function kv(label, value) {
    return '<div><small>' + esc(label) + '</small><b>' + esc(value || '未读取') + '</b></div>';
  }

  // 密码输入框（含显隐切换 + autocomplete），id 保持调用方约定不变。
  function pwField(id, labelText, ac, placeholder) {
    return '<div class="tm-field"><label for="' + id + '">' + esc(labelText) + '</label>' +
      '<div class="tm-pw">' +
        '<input class="tm-input" id="' + id + '" type="password" autocomplete="' + (ac || 'current-password') + '" placeholder="' + esc(placeholder || '至少 8 位') + '">' +
        '<button type="button" class="tm-pw-toggle" aria-label="显示或隐藏密码" onclick="TMContentManager.togglePw(\'' + id + '\',this)">显示</button>' +
      '</div></div>';
  }

  function featureCard(title, enabled, desc) {
    return '<div class="tm-feat">' +
      '<div class="tm-feat-h">' +
        '<span class="tm-dot ' + (enabled ? 'on' : 'off') + '"></span>' +
        '<b>' + esc(title) + '</b>' +
        pill(enabled ? '可用' : '未启用', enabled ? 'good' : 'off') +
      '</div>' +
      '<div class="tm-copy">' + esc(desc) + '</div>' +
    '</div>';
  }

  function renderWebUpdateNotice() {
    var ver = (state.onlineStatus && state.onlineStatus.version) || '';
    return '' +
      '<div class="tm-grid-2">' +
        '<section class="tm-panel">' +
          '<h4>游戏更新</h4>' +
          '<div class="tm-copy">网页版始终运行服务器上的最新在线版本，<b style="color:#f2d487;">无需手动更新</b>。前端热更新与安装包更新是桌面客户端专属功能。</div>' +
          '<div class="tm-status">想要离线游玩、自动热更、本地落盘装包，可下载桌面客户端；网页版与桌面版共用同一套在线工坊与账号体系。</div>' +
          '<div class="tm-actions">' +
            action('进入创意工坊', 'TMContentManager.switchTab(\'workshop\')', 'primary') +
            action('账号登录', 'TMContentManager.switchTab(\'account\')') +
          '</div>' +
        '</section>' +
        '<aside class="tm-panel">' +
          '<h4>版本信息</h4>' +
          '<div class="tm-kv">' +
            kv('运行模式', '网页在线版') +
            kv('更新方式', '随服务器自动最新') +
            kv('在线服务版本', ver || '未连接') +
            kv('离线策略', '本地游戏可离线运行') +
          '</div>' +
          '<div class="tm-status">公告与版本说明见「联网总览」与游戏内邸报。</div>' +
        '</aside>' +
      '</div>' +
      '<section class="tm-panel" style="margin-top:.8rem;"><h4>游戏公告摘要</h4><div class="tm-pack-list">' + changelogSummary(3) + '</div></section>';
  }

  function packRowV2(p) {
    var enabled = p.enabled !== false;
    var missing = !p.installed;
    return '<div class="tm-pack">' +
      '<div>' +
        '<div class="tm-pack-title">' + esc(p.title || p.id) + '</div>' +
        '<div class="tm-pack-meta">' + esc(p.id) + ' / ' + (p.version ? 'v' + esc(p.version) : '版本未提供') + ' / ' + esc(p.type || 'content') + (missing ? ' / 文件缺失' : '') + '</div>' +
        (p.description ? '<div class="tm-pack-desc">' + esc(p.description) + '</div>' : '') +
      '</div>' +
      '<div class="tm-actions" style="margin-top:0;justify-content:flex-end;">' +
        action(enabled ? '停用' : '启用', 'TMContentManager.togglePack(' + jsArg(p.id) + ',' + (!enabled) + ')') +
        action('卸载', 'TMContentManager.uninstallPack(' + jsArg(p.id) + ')', 'danger') +
      '</div>' +
    '</div>';
  }

  function ratingStars(p) {
    if (p.rating == null || p.ratingCount == null || !isFinite(Number(p.rating)) || !isFinite(Number(p.ratingCount)) || Number(p.ratingCount) <= 0) {
      return '<span style="color:rgba(234,223,203,.58);font-size:.72rem;">— 暂无评分</span>';
    }
    var avg = Number(p.rating), cnt = Number(p.ratingCount);
    var full = Math.round(avg);
    var stars = '';
    for (var i = 1; i <= 5; i++) stars += (i <= full ? '★' : '☆');
    return '<span style="color:#e8c46a;font-size:.82rem;letter-spacing:1px;">' + stars + '</span>' +
      '<span style="color:rgba(234,223,203,.74);font-size:.72rem;margin-left:.35rem;">' + avg.toFixed(1) + ' · ' + cnt + ' 评</span>';
  }

  function rateControl(p) {
    var loggedIn = !!(state.accountSession && state.accountSession.user) || (window.TM && TM.OnlineClient && TM.OnlineClient.isLoggedIn());
    if (!loggedIn) return '';
    var btns = '';
    for (var i = 1; i <= 5; i++) {
      btns += '<span onclick="TMContentManager.ratePack(' + jsArg(p.id || '') + ',' + i + ')" title="' + i + ' 星" style="cursor:pointer;color:#e8c46a;font-size:.95rem;padding:0 1px;">★</span>';
    }
    return '<div style="margin-top:.35rem;font-size:.72rem;color:rgba(234,223,203,.74);">我来评：' + btns + '</div>';
  }

  // 内容类型（catalog 的 pack.type）→ 中文标签。剧本是默认，不打角标。
  var PACK_TYPES = [
    { v: '', label: '全部' },
    { v: 'scenario', label: '剧本' },
    { v: 'portrait', label: '立绘' },
    { v: 'music', label: '音乐' },
    { v: 'map', label: '地图' },
    { v: 'mod', label: 'MOD' }
  ];
  function packTypeLabel(t) {
    t = String(t || 'scenario');
    for (var i = 0; i < PACK_TYPES.length; i++) if (PACK_TYPES[i].v === t) return PACK_TYPES[i].label;
    return t;
  }
  // 残局包：搭 type='mod' 载体·靠 tags 含「残局」识别（服务器不留存 packageKind·只可靠留 tags）。
  // 详见 reference_tianming_workshop_account / tm-resume-point.js。接演走下载→JSON.parse→fullLoadGame 起局。
  function isResumePack(p) {
    return !!(p && ((Array.isArray(p.tags) && p.tags.indexOf('残局') >= 0) || p.packageKind === 'resume'));
  }

  // 商城卡片（封面网格）：剪纸封面 + 标题/作者/评分/标签 + 安装；复用现成 install/rate/author 处理器。
  function catalogCardV2(p) {
    var disabled = !p.packageUrl;
    var ch = String(p.title || p.id || '坊').trim().charAt(0) || '坊';
    var ptype = String(p.type || 'scenario');
    var typeAttr = ' data-ptype="' + esc(ptype) + '"' + ((ptype && ptype !== 'scenario') ? ' data-type-label="' + esc(packTypeLabel(ptype)) + '"' : '');
    var tags = Array.isArray(p.tags) ? p.tags.filter(Boolean).slice(0, 3) : [];
    var official = (p.author === '天命官方') || tags.indexOf('官方') >= 0;
    var tagHtml = tags.length ? '<div class="tm-tags">' + tags.map(function(t){ return '<span class="tm-tagchip">' + esc(t) + '</span>'; }).join('') + '</div>' : '';
    var openDetail = 'onclick="TMContentManager.openPackDetail(' + jsArg(p.id || '') + ')"';
    var coverUrl = packCoverUrl(p);
    return '<div class="tm-cat-card">' +
      '<div class="tm-cover" data-glyph="' + esc(ch) + '"' + (official ? ' data-official="1"' : '') + typeAttr + ' style="cursor:pointer;" ' + openDetail + '>' + (coverUrl ? '<img class="cover-img" src="' + esc(coverUrl) + '" alt="">' : esc(ch)) + '</div>' +
      '<div class="tm-cat-body">' +
        '<div class="tm-cat-title" style="cursor:pointer;" ' + openDetail + '>' + esc(p.title || p.id) + '</div>' +
        '<div class="tm-cat-au">' +
          '<span onclick="TMContentManager.loadAuthorPacks(' + jsArg(p.authorId != null ? p.authorId : '') + ',' + jsArg(p.author || '') + ')" style="color:var(--gold,#d8b56a);cursor:pointer;">' + esc(p.author || '未署名') + '</span>' +
          ' · ' + (p.version ? 'v' + esc(p.version) : '版本未提供') + (p.downloads != null && isFinite(Number(p.downloads)) ? ' · ↓' + esc(String(p.downloads)) : ' · 下载量未提供') + (p.endorsements != null && isFinite(Number(p.endorsements)) ? ' · ✦' + esc(String(p.endorsements)) : '') + (p.parentId ? ' · 改编' : '') +
        '</div>' +
        '<div style="margin-top:.28rem;">' + ratingStars(p) + '</div>' +
        (p.description ? '<div class="tm-pack-desc" style="margin-top:.35rem;">' + esc(p.description) + '</div>' : '') +
        tagHtml +
        rateControl(p) +
        '<div class="tm-actions" style="margin-top:.55rem;">' +
          (isResumePack(p)
            ? action('从此接演', 'TMContentManager.resumePlay(' + jsArg(p.packageUrl || '') + ',' + jsArg(p.id || '') + ')', 'primary', disabled)
            : action('在线安装', 'TMContentManager.installCatalogPack(' + jsArg(p.packageUrl || '') + ',' + jsArg(p.sha256 || '') + ',' + jsArg(p.id || '') + ')', 'primary', disabled)) +
        '</div>' +
      '</div>' +
    '</div>';
  }

  // S2：剧本详情浮层 —— 从目录数据开局，best-effort 用 packMeta 刷新。
  function findCatalogPackById(id) {
    var packs = (state.catalog && state.catalog.packs) || [];
    for (var i = 0; i < packs.length; i++) if (String(packs[i].id) === String(id)) return packs[i];
    var featured = state.featuredPacks || [];
    for (var j = 0; j < featured.length; j++) if (String(featured[j].id) === String(id)) return featured[j];
    return state.detailPack && String(state.detailPack.id) === String(id) ? state.detailPack : null;
  }
  function openPackDetail(id) {
    var p = findCatalogPackById(id);
    if (!p) return;
    state.detailPack = p;
    state.detailOpen = true;
    state.detailComments = [];
    state.detailCommentCount = null;
    state.detailCommentMsg = '';
    state.detailCommentsStatus = 'loading';
    state.detailCommentsError = '';
    state.detailPlaying = -1;
    state.detailLineage = null;
    state.detailEndorsed = false;
    state.detailFollow = null;
    state.detailRevisions = [];
    state.revMsg = '';
    state.revisionStatus = 'loading';
    state.revisionError = '';
    render();
    loadPackComments(id);
    loadDetailFollow(p.authorId);
    loadRevisions(id);
    try {
      // F3·跳过 packMeta 富化避免官方/残局包 404 噪声：按目录行语义(isResumePack(p)·p 恒为头部命中的目录行)判定·无目录行才回落 id 前缀兜底·避免英文标题 slug 出 resume- 的真实用户包漏富化。
      if (!(String(id).indexOf('tianming-official-') === 0 || (p ? isResumePack(p) : String(id).indexOf('resume-') === 0)) && window.TM && TM.OnlineClient && TM.OnlineClient.packMeta) {
        TM.OnlineClient.packMeta(id, state.onlineApiUrl || undefined).then(function(res){
          if (res && res.success && res.pack && state.detailOpen && state.detailPack && String(state.detailPack.id) === String(id)) {
            state.detailPack = Object.assign({}, state.detailPack, res.pack);
            render();
          }
        }).catch(function(){});
      }
    } catch (e) {}
  }
  function closePackDetail() { state.detailOpen = false; state.detailPack = null; state.detailComments = []; state.detailCommentMsg = ''; render(); }

  // B 关注：载入作者的关注信息（粉丝数 + 我是否已关注）；关注/取关 toggle。
  function loadDetailFollow(authorId) {
    if (authorId == null || authorId === '' || !(window.TM && TM.OnlineClient && TM.OnlineClient.followInfo)) return;
    var self = (state.accountSession && state.accountSession.user) || null;
    if (self && self.id != null && String(self.id) === String(authorId)) return; // 自己不显关注
    TM.OnlineClient.followInfo(authorId, state.onlineApiUrl || undefined).then(function(res){
      if (res && res.success && state.detailOpen && state.detailPack && String(state.detailPack.authorId) === String(authorId)) {
        state.detailFollow = { followers: res.followers, following: res.following, isFollowing: res.isFollowing, authorId: authorId };
        render();
      }
    }).catch(function(){});
  }
  function toggleFollow(authorId) {
    if (!(window.TM && TM.OnlineClient && TM.OnlineClient.isLoggedIn())) { state.catalogMessage = '登录后可关注作者。'; render(); return; }
    if (authorId == null || authorId === '') return;
    var f = state.detailFollow;
    var prior = f ? { isFollowing: !!f.isFollowing, followers: f.followers, hadFollowers: f.followers != null && f.followers !== '' && isFinite(Number(f.followers)) } : null;
    if (f && prior.hadFollowers) { f.isFollowing = !f.isFollowing; f.followers = Math.max(0, Number(f.followers) + (f.isFollowing ? 1 : -1)); render(); } // 只对已知计数乐观更新
    TM.OnlineClient.follow(authorId, state.onlineApiUrl || undefined).then(function(res){
      if (res && res.success && state.detailFollow) {
        state.detailFollow.isFollowing = !!res.following;
        if (res.followers != null) state.detailFollow.followers = res.followers;
        render();
      }
    }).catch(function(){
      if (!f || !prior) return;
      f.isFollowing = prior.isFollowing;
      if (prior.hadFollowers) f.followers = prior.followers; else delete f.followers;
      render();
    });
  }

  // S3 评论：加载 / 发表（走 TM.OnlineClient，桌面端 renderer 同样可用）。
  function loadPackComments(id) {
    try {
      if (!(window.TM && TM.OnlineClient && TM.OnlineClient.comments)) {
        state.detailCommentsStatus = 'error'; state.detailCommentsError = '正式评论接口未加载'; render(); return;
      }
      state.detailCommentsStatus = 'loading'; state.detailCommentsError = '';
      TM.OnlineClient.comments(id, state.onlineApiUrl || undefined).then(function(res){
        if (!res || res.success === false || !Array.isArray(res.comments)) throw new Error((res && res.error) || '正式评论接口返回无效');
        if (state.detailOpen && state.detailPack && String(state.detailPack.id) === String(id)) {
          state.detailComments = res.comments;
          state.detailCommentCount = res.count != null && isFinite(Number(res.count)) ? Number(res.count) : res.comments.length;
          state.detailCommentsStatus = 'ok'; state.detailCommentsError = ''; render();
        }
      }).catch(function(error){
        if (!state.detailOpen || !state.detailPack || String(state.detailPack.id) !== String(id)) return;
        state.detailComments = []; state.detailCommentCount = null;
        state.detailCommentsStatus = 'error'; state.detailCommentsError = (error && error.message) || '正式评论接口不可用'; render();
      });
    } catch (e) {
      state.detailCommentsStatus = 'error'; state.detailCommentsError = (e && e.message) || '正式评论接口不可用'; render();
    }
  }
  function postPackComment() {
    var ta = document.getElementById('tm-detail-comment');
    var text = ta ? ta.value.trim() : '';
    var p = state.detailPack;
    if (!p) return;
    if (!(window.TM && TM.OnlineClient && TM.OnlineClient.isLoggedIn && TM.OnlineClient.isLoggedIn())) { state.detailCommentMsg = '请先登录再评论。'; render(); return; }
    if (!text) { state.detailCommentMsg = '请输入评论内容。'; render(); return; }
    state.detailCommentMsg = '正在发表…'; render();
    TM.OnlineClient.postComment(p.id, text, state.onlineApiUrl || undefined).then(function(res){
      if (res && res.success) { state.detailCommentMsg = '已发表。'; loadPackComments(p.id); }
      else { state.detailCommentMsg = '发表失败：' + ((res && res.error) || '未知错误'); render(); }
    }).catch(function(e){ state.detailCommentMsg = '发表失败：' + (e && e.message || '网络错误'); render(); });
  }

  function packTypeNoun(t) { t = String(t || 'scenario'); return ({ scenario: '剧本', portrait: '立绘包', music: '音乐包', map: '地图包', mod: 'MOD' })[t] || t; }
  function packInstallLabel(t) { t = String(t || 'scenario'); return ({ scenario: '在线安装', portrait: '安装立绘包', music: '安装音乐包', map: '安装地图包', mod: '安装 MOD' })[t] || '在线安装'; }

  // P1-S2a：类型感知详情体（立绘画廊 / 音乐曲目 / 地图·MOD 资源清单）。assets 由服务器元数据提供（S2b）。
  function renderDetailTypeBody(p) {
    var t = String(p.type || 'scenario');
    var assets = Array.isArray(p.assets) ? p.assets : [];
    if (t === 'portrait') {
      var tiles = assets.length ? assets.map(function(a){
        var g = String(a.name || '图').trim().charAt(0) || '图';
        return '<div class="port"><span>' + esc(g) + '</span><small>' + esc(a.name || '') + '</small></div>';
      }).join('') : '<div class="empty"><div class="t">立绘清单待服务器支持</div></div>';
      return '<div class="dsec-h">立绘预览' + (assets.length ? ' · ' + assets.length + ' 张' : '') + '</div><div class="gallery">' + tiles + '</div>';
    }
    if (t === 'music') {
      var rows = assets.length ? assets.map(function(a, i){
        var playing = state.detailPlaying === i;
        return '<div class="track' + (playing ? ' playing' : '') + '" onclick="TMContentManager.playTrack(' + i + ')"><span class="pl">' + (playing ? '❚❚' : '▶') + '</span><b>' + esc(a.name || '') + '</b><small>' + esc(a.mood || '') + '</small><em>' + esc(a.duration || '') + '</em></div>';
      }).join('') : '<div class="empty"><div class="t">曲目清单待服务器支持</div></div>';
      return '<div class="dsec-h">曲目' + (assets.length ? ' · ' + assets.length + ' 首' : '') + '</div><div class="tracklist">' + rows + '</div>';
    }
    if (t === 'mod') {
      var listHtml = assets.length ? '<div class="dsec-h">资源清单 · ' + assets.length + '</div><div class="dcopy">' + assets.map(function(a){ return esc(a.name || ''); }).join(' · ') + '</div>' : '';
      return '<div class="dsec-h">组合包</div><div class="dcopy">混合资产组合包：安装后包内立绘按同名自动启用、音乐并入声乐轮播，无需单独装载。</div>' + listHtml;
    }
    if (t === 'map' && assets.length) {
      return '<div class="dsec-h">资源清单 · ' + assets.length + '</div><div class="dcopy">' + assets.map(function(a){ return esc(a.name || ''); }).join(' · ') + '</div>';
    }
    return '';
  }
  function renderStoreMedia(p) {
    var shots = packGalleryImages(p);
    if (!shots.length) return '';
    return '<div class="dsec-h">商店展示图 · ' + shots.length + '</div><div class="store-shots">' +
      shots.map(function(img){
        return '<button class="store-shot" type="button"><img src="' + esc(img.url) + '" alt="' + esc(img.name || '') + '"></button>';
      }).join('') +
    '</div>';
  }
  function mallCommentRow(c) {
    return '<div class="rev"><div class="av seal">' + esc(String(c.nickname || '友').charAt(0)) + '</div>' +
      '<div><div class="hd"><b>' + esc(c.nickname || '玩家') + '</b><small>' + esc(c.createdAt || '') + '</small></div><p>' + esc(c.text || '') + '</p></div></div>';
  }

  function renderPackDetail() {
    var p = state.detailPack;
    if (!p) return '';
    var ptype = String(p.type || 'scenario');
    var ch = String(p.title || p.id || '坊').trim().charAt(0) || '坊';
    var tags = Array.isArray(p.tags) ? p.tags.filter(Boolean) : [];
    var official = (p.author === '天命官方') || tags.indexOf('官方') >= 0;
    var loggedIn = !!(state.accountSession && state.accountSession.user) || (window.TM && TM.OnlineClient && TM.OnlineClient.isLoggedIn());
    var disabled = !p.packageUrl;
    var rateStars = '';
    for (var i = 1; i <= 5; i++) rateStars += '<span onclick="TMContentManager.ratePack(' + jsArg(p.id || '') + ',' + i + ')" title="' + i + ' 星" style="cursor:pointer;color:#e8c46a;font-size:1.05rem;padding:0 1px;">★</span>';
    var related = ((state.catalog && state.catalog.packs) || []).filter(function(x){
      if (String(x.id) === String(p.id)) return false;
      return x.author === p.author || (tags.length && Array.isArray(x.tags) && x.tags.some(function(t){ return tags.indexOf(t) >= 0; }));
    }).slice(0, 4);
    var relHtml = related.length ? related.map(mallCard).join('') : '<div class="empty"><div class="t">暂无相关</div></div>';
    return '<div class="sheet tm-pack-detail-sheet" role="dialog" aria-modal="true" aria-label="' + esc(packTypeNoun(ptype)) + '详情" onclick="if(event.target===this)TMContentManager.closePackDetail()">' +
      '<div class="sheet-box">' +
        '<div class="sh-head"><b>' + esc(packTypeNoun(ptype)) + '详情</b><button class="btn sm" style="margin-left:auto;" onclick="TMContentManager.closePackDetail()" aria-label="关闭详情">关闭</button></div>' +
        '<div class="sh-body scroll">' +
          '<div class="dhero">' + mallCover(p) +
            '<div>' +
              '<div style="font-size:11.5px;letter-spacing:2px;color:var(--gold-bright);">' + (official ? '官方' : '玩家') + esc(packTypeNoun(ptype)) + (tags.length ? ' · ' + esc(tags[0]) : '') + '</div>' +
              '<h2>' + esc(p.title || p.id) + '</h2>' +
              '<div class="dmeta">' + mallStars(p) +
                '<span>' + (p.downloads != null && isFinite(Number(p.downloads)) ? '↓' + esc(String(p.downloads)) : '下载量未提供') + '</span>' +
                (p.endorsements != null && isFinite(Number(p.endorsements)) ? '<span>✦' + esc(String(p.endorsements)) + '</span>' : '') +
                '<span>' + (p.version ? 'v' + esc(p.version) : '版本未提供') + '</span>' +
                (p.size != null && isFinite(Number(p.size)) ? '<span>' + esc(formatBytes(p.size)) + '</span>' : '') + '</div>' +
              (tags.length ? '<div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:10px;">' + tags.slice(0, 6).map(function(t){ return '<span class="tag">' + esc(t) + '</span>'; }).join('') + '</div>' : '') +
              '<div class="dacts">' +
                (isResumePack(p)
                  ? '<button class="btn primary"' + (disabled ? ' disabled' : '') + ' onclick="TMContentManager.resumePlay(' + jsArg(p.packageUrl || '') + ',' + jsArg(p.id || '') + ')" title="载入这局推演进度，从此接演续写">从此接演</button>'
                  : '<button class="btn primary"' + (disabled ? ' disabled' : '') + ' onclick="TMContentManager.installCatalogPack(' + jsArg(p.packageUrl || '') + ',' + jsArg(p.sha256 || '') + ',' + jsArg(p.id || '') + ')">' + esc(packInstallLabel(ptype)) + '</button>') +
                (ptype === 'map' ? '<button class="btn" onclick="TMContentManager.openMapPackInEditor(' + jsArg(p.id || '') + ')" title="已安装后取包内图幅 JSON 递交地图编辑器">在地图编辑器中打开</button>' : '') +
                (loggedIn ? '<span style="font-size:12px;color:var(--ink-dim);">评分 ' + rateStars + '</span>' : '') +
              '</div>' +
              '<div class="dacts" style="margin-top:8px;">' +
                '<button class="btn sm' + (isFavorite(p.id) ? ' primary' : '') + '" onclick="TMContentManager.toggleFavorite(' + jsArg(p.id || '') + ')">' + (isFavorite(p.id) ? '★ 已收藏' : '☆ 收藏') + '</button>' +
                (loggedIn ? '<button class="btn sm' + (state.detailEndorsed ? ' primary' : '') + '" onclick="TMContentManager.endorsePack()">✦ ' + (state.detailEndorsed ? '已推荐' : '推荐') + (p.endorsements ? ' ' + esc(String(p.endorsements)) : '') + '</button>' : '') +
                (function(){
                  var df = state.detailFollow, su = (state.accountSession && state.accountSession.user);
                  var isSelf = su && su.id != null && String(su.id) === String(p.authorId);
                  if (!loggedIn || p.authorId == null || p.authorId === '' || isSelf) return '';
                  return '<button class="btn sm' + (df && df.isFollowing ? ' primary' : '') + '" onclick="TMContentManager.toggleFollow(' + jsArg(p.authorId) + ')">' + (df && df.isFollowing ? '✓ 已关注作者' : '＋ 关注作者') + (df && df.followers ? ' ' + esc(String(df.followers)) : '') + '</button>';
                })() +
                '<button class="btn sm" onclick="TMContentManager.loadLineage()">世界线</button>' +
                (loggedIn ? '<button class="btn sm" onclick="TMContentManager.openCollectionPicker(' + jsArg(p.id || '') + ')">收入合集</button>' : '') +
                (ptype === 'scenario' && loggedIn ? '<button class="btn sm" onclick="TMContentManager.forkPack()">改编</button>' : '') +
                (ptype === 'scenario' ? '<button class="btn sm" onclick="TMContentManager.openChronicles()">史册接龙</button>' : '') +
              '</div>' +
              (state.catalogMessage ? '<div class="status" style="margin-top:8px;">' + esc(state.catalogMessage) + '</div>' : '') +
            '</div>' +
          '</div>' +
          (p.parentId ? '<div class="dcopy" style="margin-top:10px;">改编自 <span style="color:var(--gold);cursor:pointer;text-decoration:underline;" onclick="TMContentManager.openPackDetail(' + jsArg(p.parentId) + ')">' + esc(p.parentId) + '</span></div>' : '') +
          (p.description ? '<div class="dsec-h">' + (ptype === 'scenario' ? '剧本提要' : '简介') + '</div><div class="dcopy">' + esc(p.description) + '</div>' : '') +
          renderStoreMedia(p) +
          renderDetailTypeBody(p) +
          renderLineageTree() +
          '<div class="dsec-h">作者</div><div><span style="color:var(--gold);cursor:pointer;text-decoration:underline;" onclick="TMContentManager.loadAuthorPacks(' + jsArg(p.authorId != null ? p.authorId : '') + ',' + jsArg(p.author || '') + ')">' + esc(p.author || '未署名') + '</span>' + (official ? ' <span class="pill good">官方认证</span>' : '') + '</div>' +
          '<div class="dsec-h">玩家评论' + (state.detailCommentsStatus === 'ok' ? ' · ' + esc(String(state.detailCommentCount)) : '') + '</div>' +
          (loggedIn
            ? '<div class="field"><textarea id="tm-detail-comment" class="input" rows="2" placeholder="说说你的开局体验、攻略或建议…"></textarea></div><div style="margin:8px 0;"><button class="btn primary sm" onclick="TMContentManager.postPackComment()">发表评论</button></div>'
            : '<div class="dcopy">登录后可发表评论。</div>') +
          (state.detailCommentMsg ? '<div class="status" style="margin:6px 0;">' + esc(state.detailCommentMsg) + '</div>' : '') +
          ((state.detailComments && state.detailComments.length)
            ? state.detailComments.map(mallCommentRow).join('')
            : (state.detailCommentsStatus === 'error'
              ? '<div class="dcopy" style="color:var(--ink-faint);">评论接口不可用：' + esc(state.detailCommentsError || '读取失败') + '</div>'
              : (state.detailCommentsStatus === 'loading'
                ? '<div class="dcopy" style="color:var(--ink-faint);">正在读取正式评论…</div>'
                : '<div class="dcopy" style="color:var(--ink-faint);">正式接口返回 0 条评论，来做第一个。</div>'))) +
          renderRevisionSection() +
          '<div class="dsec-h">同作者 / 同标签</div><div class="grid">' + relHtml + '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  // P3-S1 世界线树 + P4-S2 背书。
  function renderLineageTree() {
    var lin = state.detailLineage;
    if (!lin || !lin.nodes || !lin.nodes.length) return '';
    var cur = state.detailPack ? String(state.detailPack.id) : '';
    var byParent = {};
    lin.nodes.forEach(function(n){ var k = n.parentId || ''; (byParent[k] = byParent[k] || []).push(n); });
    function walk(id, depth) {
      return (byParent[id] || []).map(function(n){
        return '<div class="ln' + (String(n.id) === cur ? ' me' : '') + '" style="padding-left:' + (8 + depth * 16) + 'px;" onclick="TMContentManager.openPackDetail(' + jsArg(n.id) + ')">' + (depth ? '↳ ' : '') + esc(n.title) + '<small>' + esc(n.author || '') + '</small></div>' + walk(n.id, depth + 1);
      }).join('');
    }
    var rootNode = lin.nodes.filter(function(n){ return String(n.id) === String(lin.root); })[0];
    var html = (rootNode ? '<div class="ln' + (String(rootNode.id) === cur ? ' me' : '') + '" onclick="TMContentManager.openPackDetail(' + jsArg(rootNode.id) + ')">' + esc(rootNode.title) + '<small>' + esc(rootNode.author || '') + '</small></div>' : '') + walk(lin.root, 1);
    return '<div class="dsec-h">世界线 · ' + lin.nodes.length + ' 个版本</div><div class="lineage">' + html + '</div>';
  }
  function loadFeatured() {
    if (!(window.TM && TM.OnlineClient && TM.OnlineClient.featured)) {
      state.featuredStatus = 'error';
      state.featuredError = '正式精选接口未加载';
      state.featuredPacks = [];
      render();
      return Promise.resolve(null);
    }
    state.featuredStatus = 'loading';
    state.featuredError = '';
    render();
    return TM.OnlineClient.featured(state.onlineApiUrl || undefined).then(function(res){
      if (!res || res.success === false) throw new Error((res && res.error) || '正式精选接口返回失败');
      state.featuredPacks = Array.isArray(res.packs) ? res.packs : [];
      state.featuredStatus = 'ok';
      state.featuredError = '';
      render();
      return res;
    }).catch(function(error){
      state.featuredPacks = [];
      state.featuredStatus = 'error';
      state.featuredError = (error && error.message) || '正式精选接口不可用';
      render();
      return null;
    });
  }
  function loadLineage() {
    var p = state.detailPack; if (!p) return;
    if (!(window.TM && TM.OnlineClient && TM.OnlineClient.lineage)) return;
    TM.OnlineClient.lineage(p.id, state.onlineApiUrl || undefined).then(function(res){
      if (res && res.success && state.detailPack && String(state.detailPack.id) === String(p.id)) {
        state.detailLineage = { forId: p.id, root: res.root, nodes: res.nodes || [] }; render();
      }
    }).catch(function(){});
  }
  function endorsePack() {
    var p = state.detailPack; if (!p) return;
    if (!(window.TM && TM.OnlineClient && TM.OnlineClient.isLoggedIn && TM.OnlineClient.isLoggedIn())) { state.catalogMessage = '请先登录再推荐。'; render(); return; }
    TM.OnlineClient.endorse(p.id, state.onlineApiUrl || undefined).then(function(res){
      if (res && res.success) { p.endorsements = res.endorsements; state.detailEndorsed = res.endorsed; state.catalogMessage = res.endorsed ? '已推荐到社区精选。' : '已取消推荐。'; }
      else state.catalogMessage = '操作失败：' + ((res && res.error) || '');
      render();
    }).catch(function(){ state.catalogMessage = '操作失败。'; render(); });
  }
  function forkPack() {
    var p = state.detailPack; if (!p) return;
    state.forkSource = { id: p.id, title: p.title || p.id };
    state.pubType = 'scenario';
    state.publishMessage = '已选「' + (p.title || p.id) + '」为改编源，下方填写你的改编版本并发布。';
    state.pane = 'studio';
    state.detailOpen = false; state.detailPack = null;
    render();
  }

  // P3-S2 史册接龙浮层。
  function openChronicles(scenarioId) {
    var sid = scenarioId || (state.detailPack ? state.detailPack.id : '');
    state.chronOpen = true; state.chronScenario = sid; state.chronList = []; state.chronChain = null; state.chronMsg = ''; state.chronParent = 0;
    state.chronStatus = 'loading'; state.chronError = '';
    render();
    loadChronicles(sid);
  }
  function loadChronicles(sid) {
    if (!(window.TM && TM.OnlineClient && TM.OnlineClient.chronicles)) {
      state.chronList = []; state.chronStatus = 'error'; state.chronError = '正式史册接口未加载'; render(); return;
    }
    state.chronStatus = 'loading'; state.chronError = '';
    TM.OnlineClient.chronicles(sid, state.onlineApiUrl || undefined).then(function(res){
      if (!res || res.success === false || !Array.isArray(res.chronicles)) throw new Error((res && res.error) || '正式史册接口返回无效');
      if (state.chronOpen && String(state.chronScenario) === String(sid)) {
        state.chronList = res.chronicles; state.chronStatus = 'ok'; state.chronError = ''; render();
      }
    }).catch(function(error){
      if (!state.chronOpen || String(state.chronScenario) !== String(sid)) return;
      state.chronList = []; state.chronStatus = 'error'; state.chronError = (error && error.message) || '正式史册接口不可用'; render();
    });
  }
  function closeChronicles() { state.chronOpen = false; state.chronChain = null; render(); }
  function relayChronicle(parentId) { state.chronParent = parentId || 0; state.chronMsg = parentId ? '接龙模式：你的史册将续在所选史册之后。' : ''; render(); }
  function viewChroniclesChain(id) {
    TM.OnlineClient.chroniclesChain(id, state.onlineApiUrl || undefined).then(function(res){
      if (res && res.success) { state.chronChain = res.chain || []; render(); }
    }).catch(function(){});
  }
  function publishChronicleUI() {
    if (!(window.TM && TM.OnlineClient && TM.OnlineClient.isLoggedIn && TM.OnlineClient.isLoggedIn())) { state.chronMsg = '请先登录再发布史册。'; render(); return; }
    var t = document.getElementById('tm-chron-title');
    var s = document.getElementById('tm-chron-summary');
    var o = document.getElementById('tm-chron-outcome');
    var title = t ? t.value.trim() : '';
    if (!title) { state.chronMsg = '请填写史册标题。'; render(); return; }
    state.chronMsg = '正在发布…'; render();
    TM.OnlineClient.publishChronicle({
      scenarioId: state.chronScenario, parentId: state.chronParent || 0,
      title: title, summary: s ? s.value.trim() : '', outcome: o ? o.value : ''
    }, state.onlineApiUrl || undefined).then(function(res){
      if (res && res.success) { state.chronMsg = state.chronParent ? '已接龙发布。' : '史册已发布。'; state.chronParent = 0; loadChronicles(state.chronScenario); }
      else { state.chronMsg = '发布失败：' + ((res && res.error) || ''); render(); }
    }).catch(function(){ state.chronMsg = '发布失败。'; render(); });
  }
  function chronOutcomeBadge(o) {
    if (!o) return '';
    var cls = /中兴|大治|盛世/.test(o) ? 'good' : (/倾覆|亡|败/.test(o) ? 'bad' : '');
    return '<span class="pill ' + cls + '">' + esc(o) + '</span>';
  }
  function renderChroniclesLayer() {
    if (!state.chronOpen) return '';
    var loggedIn = !!(window.TM && TM.OnlineClient && TM.OnlineClient.isLoggedIn && TM.OnlineClient.isLoggedIn());
    var list = (state.chronList || []).length ? state.chronList.map(function(c){
      return '<div class="chron">' +
        '<div><b>' + esc(c.title) + '</b>' + chronOutcomeBadge(c.outcome) + '</div>' +
        '<div style="font-size:12px;color:var(--ink-faint);margin-top:3px;">' + esc(c.author || '') + (c.parentId ? ' · 接续 #' + c.parentId : '') + ' · ' + esc(c.createdAt || '') + '</div>' +
        (c.summary ? '<div class="dcopy" style="margin-top:5px;">' + esc(c.summary) + '</div>' : '') +
        '<div class="dacts" style="margin-top:8px;">' +
          (loggedIn ? '<button class="btn sm" onclick="TMContentManager.relayChronicle(' + Number(c.id) + ')">接龙续写</button>' : '') +
          '<button class="btn sm" onclick="TMContentManager.viewChroniclesChain(' + Number(c.id) + ')">看接龙链</button>' +
        '</div>' +
      '</div>';
    }).join('') : (state.chronStatus === 'error'
      ? '<div class="empty"><div class="glyph">册</div><div class="t">史册接口不可用</div><div>' + esc(state.chronError || '无法读取正式史册。') + '</div></div>'
      : (state.chronStatus === 'loading'
        ? '<div class="empty"><div class="glyph">册</div><div class="t">正在读取正式史册…</div></div>'
        : '<div class="empty"><div class="glyph">册</div><div class="t">还没有史册</div><div>正式接口返回 0 篇；可写下第一篇结局。</div></div>'));
    var chain = state.chronChain ? ('<div class="dsec-h">接龙链 · ' + state.chronChain.length + '</div><div class="relay-chain"><div class="relay">' + state.chronChain.map(function(c, i){
      return (i ? '<span class="rarrow">→</span>' : '') + '<div class="rnode"><b>' + esc(c.title) + '</b>' + chronOutcomeBadge(c.outcome) + '<small>' + esc(c.author || '') + '</small></div>';
    }).join('') + '</div></div>') : '';
    return '<div class="sheet" role="dialog" aria-modal="true" aria-label="史册接龙" onclick="if(event.target===this)TMContentManager.closeChronicles()">' +
      '<div class="sheet-box" style="width:min(600px,94%);">' +
        '<div class="sh-head"><b>写史阁 · 史册接龙</b><button class="btn sm" style="margin-left:auto;" onclick="TMContentManager.closeChronicles()">关闭</button></div>' +
        '<div class="sh-body scroll">' +
          (state.chronParent ? '<div class="status">接龙模式：续写 #' + state.chronParent + ' <span style="cursor:pointer;color:var(--gold);text-decoration:underline;" onclick="TMContentManager.relayChronicle(0)">取消</span></div>' : '') +
          (loggedIn
            ? '<div class="field"><label>史册标题</label><input class="input" id="tm-chron-title" placeholder="例如：天启中兴录"></div>' +
              '<div class="field"><label>结局纪要</label><textarea class="input" id="tm-chron-summary" rows="3" placeholder="这一局如何收场？写给后来的接龙者…"></textarea></div>' +
              '<div class="field"><label>结局</label><select class="input" id="tm-chron-outcome"><option value="">未定</option><option>中兴</option><option>偏安</option><option>倾覆</option><option>守成</option></select></div>' +
              '<div style="margin-top:11px;"><button class="btn primary" onclick="TMContentManager.publishChronicleUI()">' + (state.chronParent ? '接龙发布' : '发布史册') + '</button></div>'
            : '<div class="dcopy">登录后可发布史册、参与接龙。</div>') +
          (state.chronMsg ? '<div class="status" style="margin-top:8px;">' + esc(state.chronMsg) + '</div>' : '') +
          '<div class="dsec-h">史册' + (state.chronStatus === 'ok' ? ' · ' + (state.chronList || []).length : '') + '</div>' + list +
          chain +
        '</div>' +
      '</div></div>';
  }


  function workshopPaneCount(pane) {
    var catalog = state.catalog && Array.isArray(state.catalog.packs) ? state.catalog.packs : [];
    if (pane === 'browse' || pane === 'ranks') return /^(ok|fallback|stale)$/.test(state.catalogStatus) ? catalog.length : '';
    if (pane === 'feed') return state.feedLoaded ? (((state.feedData || {}).posts || []).length) : '';
    if (pane === 'arenas') return state.arenasLoaded ? (state.arenaList || []).length : '';
    if (pane === 'topics') return state.collectionsLoaded ? (state.collectionList || []).length : '';
    if (pane === 'circles') return state.circlesLoaded ? (state.circleList || []).length : '';
    if (pane === 'commissions') return state.commissionsLoaded ? (state.commissionList || []).length : '';
    if (pane === 'friends') return state.friendsLoaded ? (((state.friendsData || {}).friends || []).length) : '';
    if (pane === 'me') return (state.notifData && state.notifData.unread) || '';
    return '';
  }

  function workshopRailButton(item, pane) {
    var count = workshopPaneCount(item[0]);
    return '<button type="button" class="atelier-rail-item' + (pane === item[0] ? ' is-active' : '') + '" onclick="TMContentManager.switchPane(\'' + item[0] + '\')"' + (pane === item[0] ? ' aria-current="page"' : '') + '>' +
      '<span class="atelier-rail-glyph" aria-hidden="true">' + esc(item[2]) + '</span><span>' + esc(item[1]) + '</span>' +
      (count !== '' ? '<small>' + esc(count) + '</small>' : '') + '</button>';
  }

  function renderWorkshopSidebar(pane) {
    var groups = [
      ['寻访', [['discover', '发现', '寻'], ['feed', '动态', '记'], ['browse', '浏览', '卷'], ['ranks', '排行', '榜']]],
      ['社群', [['arenas', '擂台', '擂'], ['topics', '专题', '集'], ['circles', '圈子', '同'], ['commissions', '约稿', '求'], ['friends', '好友', '友']]],
      ['创作者', [['studio', '创作', '著'], ['me', '我', '我']]]
    ];
    var installed = desktop() ? state.packs : state.webInstalled;
    var installedCount = Array.isArray(installed) ? installed.length : '';
    var updateCount = state.workshopUpdates ? Object.keys(state.workshopUpdates).length : '';
    return '<aside class="atelier-rail" aria-label="创意工坊导航"><div class="atelier-rail-scroll">' + groups.map(function(group){
      return '<section class="atelier-rail-group"><h2>' + esc(group[0]) + '</h2>' + group[1].map(function(item){ return workshopRailButton(item, pane); }).join('') + '</section>';
    }).join('') + '</div><div class="atelier-rail-foot">' +
      '<button type="button" class="atelier-foot-item' + (pane === 'me' && state.meTab === 'installed' ? ' is-active' : '') + '" onclick="TMContentManager.switchPane(\'me\');TMContentManager.switchMeTab(\'installed\')"><span aria-hidden="true">库</span><b>已装内容</b>' + (installedCount !== '' ? '<small>' + installedCount + '</small>' : '') + '</button>' +
      '<button type="button" class="atelier-foot-item' + (pane === 'updates' ? ' is-active' : '') + '" onclick="TMContentManager.switchPane(\'updates\')"><span aria-hidden="true">更</span><b>更新中心</b>' + (updateCount !== '' ? '<small>' + updateCount + '</small>' : '') + '</button>' +
    '</div></aside>';
  }

  function workshopSourceBadge(label, status, value, title) {
    // stale=「有可用旧数据的降级态」：与 fallback 同走黄色中间态（is-fallback），绝不落 is-error 红档，
    // 否则真源条自称「不可用」会与发现/浏览页「旧数据+过期横幅」自相矛盾。
    var tone = status === 'ok' ? 'is-ok' : ((status === 'fallback' || status === 'stale') ? 'is-fallback' : (status === 'loading' ? 'is-loading' : (status === 'idle' ? 'is-idle' : 'is-error')));
    return '<span class="' + tone + '"' + (title ? ' title="' + esc(title) + '"' : '') + '><i></i><b>' + esc(label) + '</b><em>' + esc(value) + '</em></span>';
  }

  function renderWorkshopSourceStrip() {
    var packs = state.catalog && Array.isArray(state.catalog.packs) ? state.catalog.packs : [];
    var catalogValue = state.catalogStatus === 'loading' ? '读取中' : state.catalogStatus === 'ok' ? packs.length + ' 件' : state.catalogStatus === 'fallback' ? packs.length + ' 件·仓库' : state.catalogStatus === 'stale' ? packs.length + ' 件·旧目录' : state.catalogStatus === 'idle' ? '未读取' : '不可用';
    var catalogTitle = state.catalogStatus === 'stale' ? '在线目录刷新失败·当前显示旧目录：' + (state.catalogError || '未知错误') : state.catalogError;
    var featuredValue = state.featuredStatus === 'loading' ? '读取中' : state.featuredStatus === 'ok' ? (state.featuredPacks || []).length + ' 件' : state.featuredStatus === 'idle' ? '未读取' : '不可用';
    var installed = desktop() ? state.packs : state.webInstalled;
    var installedKnown = Array.isArray(installed);
    var version = currentWorkshopVersion();
    return '<div class="atelier-source-row" role="status" aria-live="polite"><div class="truth-strip">' +
      workshopSourceBadge('正式在线目录', state.catalogStatus, catalogValue, catalogTitle) +
      workshopSourceBadge('正式精选接口', state.featuredStatus, featuredValue, state.featuredError) +
      workshopSourceBadge('当前安装库', installedKnown ? 'ok' : 'error', installedKnown ? (installed.length + ' 件' + (state.workshopUpdates && Object.keys(state.workshopUpdates).length ? ' · ' + Object.keys(state.workshopUpdates).length + ' 可更新' : '')) : '不可读', '') +
      workshopSourceBadge('仓库版本', version ? 'ok' : 'error', version ? 'v' + version : '未提供', '') +
      '</div><button type="button" class="atelier-refresh" onclick="TMContentManager.refreshWorkshopSources()">刷新真源</button></div>';
  }

  function render() {
    var bg = ensureLayer();
    var pane = state.pane || 'discover';
    var user = (state.accountSession || {}).user;
    var idLabel = user ? (user.nickname || user.username) : '登录';
    var notifUnread = (state.notifData && state.notifData.unread) || 0;
    var updateCount = state.workshopUpdates ? Object.keys(state.workshopUpdates).length : 0;
    if (state.hotCheck && state.hotCheck.hasUpdate) updateCount += 1;
    // 重渲前快照壳内正被编辑的输入框（有 id 的 input/textarea）：innerHTML 重建会清掉焦点与已敲字符，重建后按 id 找回。
    var _snapAE = document.activeElement, _snap = (_snapAE && bg.contains(_snapAE) && /^(INPUT|TEXTAREA)$/.test(_snapAE.tagName) && _snapAE.id) ? { id: _snapAE.id, v: _snapAE.value, s: _snapAE.selectionStart, e: _snapAE.selectionEnd } : null;
    bg.innerHTML = '<main class="tm-mall tm-mall-page atelier-shell" role="main" aria-label="天命创意工坊" tabindex="-1">' +
      '<header class="topbar atelier-topbar">' +
        '<div class="brand atelier-brand"><div class="seal atelier-brand-seal">天<br>命</div><b>天命 · 创意工坊<small>百 工 谱 阁</small></b></div>' +
        '<label class="gsearch atelier-global-search"><span aria-hidden="true">⌕</span><input id="tm-mall-q" value="' + esc(state.catalogQuery || '') + '" placeholder="搜剧本、作者、朝代、标签…" aria-label="搜索创意工坊" onkeydown="if(event.key===\'Enter\')TMContentManager.mallSearch(this.value)"><kbd>Enter</kbd></label>' +
        '<div class="tbright atelier-top-actions">' +
          '<button type="button" class="atelier-filter" onclick="TMContentManager.switchPane(\'browse\')"><span aria-hidden="true">筛</span><b>高级筛选</b></button>' +
          '<button type="button" class="atelier-hot" onclick="TMContentManager.switchPane(\'updates\')"><span aria-hidden="true">⇩</span><b>热更</b>' + (updateCount ? '<em>' + updateCount + '</em>' : '') + '</button>' +
          '<button type="button" class="atelier-icon" title="私信" aria-label="私信" onclick="TMContentManager.openDmInbox()">函</button>' +
          '<button type="button" class="atelier-icon" title="通知" aria-label="通知" onclick="TMContentManager.switchPane(\'me\');TMContentManager.switchMeTab(\'notif\')">铃' + (notifUnread ? '<em>' + notifUnread + '</em>' : '') + '</button>' +
          '<button type="button" class="idchip atelier-profile" onclick="TMContentManager.switchPane(\'me\')"><span class="av seal">' + esc(String(idLabel).charAt(0)) + '</span><small>' + esc(idLabel) + '</small></button>' +
          '<button type="button" class="x atelier-close" onclick="TMContentManager.close()" title="关闭工坊" aria-label="关闭工坊">✕</button>' +
        '</div>' +
      '</header>' +
      '<div class="atelier-body">' + renderWorkshopSidebar(pane) +
        '<section class="main atelier-main" aria-label="工坊内容">' + renderWorkshopSourceStrip() + '<div class="scroll">' + renderMallPane(pane) + '</div></section>' +
      '</div>' +
      (state.detailOpen ? renderPackDetail() : '') + (state.dmOpen ? renderDmLayer() : '') + (state.chronOpen ? renderChroniclesLayer() : '') +
      (state.arenaOpen ? renderArenaLayer() : '') + (state.collectionOpen ? renderCollectionLayer() : '') + (state.colPickOpen ? renderCollectionPicker() : '') +
      (state.circleOpen ? renderCircleLayer() : '') +
    '</main>';
    // 仅在壳由隐藏→显示（首开/重开工坊）时自动聚焦一次；此后的重渲（搜索、切页签等）不再抢焦，
    // 否则每次 render 重建 innerHTML 都会把整壳 focus 抢回来，打断用户正在输入框里的打字。
    var wasHidden = bg.style.display !== 'flex';
    bg.style.display = 'flex';
    if (wasHidden && !bg.contains(document.activeElement)) {
      var shell = bg.querySelector('.atelier-shell');
      try { if (shell) shell.focus({ preventScroll: true }); } catch (e0) {}
    }
    // 恢复重渲前的输入焦点/光标（快照命中时）——重渲不再吞掉正在打的字。
    if (_snap) { var _rel = document.getElementById(_snap.id); if (_rel) { try { if (_snap.v != null && _rel.value !== _snap.v) _rel.value = _snap.v; _rel.focus({ preventScroll: true }); if (_snap.s != null && _rel.setSelectionRange) _rel.setSelectionRange(_snap.s, _snap.e); } catch (e1) {} } }
    try { if (window.TMWorkshopCovers) window.TMWorkshopCovers.enhance(bg); } catch (e) {}
  }

  async function refreshPacks() {
    if (!desktop() || !window.tianming.listWorkshopPacks) return;
    var res = await window.tianming.listWorkshopPacks();
    if (res && res.success) state.packs = res.packs || [];
    render();
  }

  function refreshWorkshopSources(force) {
    var tasks = [];
    if (!state.catalogLoading && (force || state.catalogStatus !== 'ok')) tasks.push(loadWorkshopCatalog());
    if (state.featuredStatus !== 'loading' && (force || state.featuredStatus !== 'ok')) tasks.push(loadFeatured());
    return Promise.all(tasks);
  }

  async function openContentManager() {
    state.feedUrl = loadFeedUrl();
    state.hotFeedUrl = loadHotFeedUrl();
    state.catalogUrl = loadCatalogUrl();
    state.onlineApiUrl = loadOnlineApiUrl();
    await loadChangelog();
    if (!desktop()) {
      // 网页环境：本体更新 / 前端热更 / 本地落盘装包是桌面专属；但在线工坊浏览、
      // 安装（下剧本 JSON 并入剧本库）与账号走 TM.OnlineClient，照常可用。
      var webApi = (window.TM && TM.OnlineClient) ? TM.OnlineClient.getApiUrl() : (state.defaultOnlineApiUrl || '');
      state.defaultOnlineApiUrl = webApi || state.defaultOnlineApiUrl || '';
      if (!state.defaultCatalogUrl && webApi) state.defaultCatalogUrl = webApi + 'workshop/catalog';
      if (!state.onlineApiUrl) state.onlineApiUrl = loadOnlineApiUrl();
      if (!state.catalogUrl) state.catalogUrl = loadCatalogUrl();
      if (window.TM && TM.OnlineClient) replaceAccountSession(TM.OnlineClient.getSession(), false);
      state.status = { error: '网页版：本体更新与本地落盘装包为桌面专属功能。' };
      state.hotMessage = '网页版：前端热更为桌面专属；网页本身始终是最新在线版本。';
      state.onlineMessage = '';
      await refreshWebInstalled();
      render();
      refreshWorkshopSources(false);
      try { if (Array.isArray(state.webInstalled) && state.webInstalled.length) checkWorkshopUpdates(true); } catch (eU) {} // 批C·静默检查更新(有已装包才跑·不弹窗·结果缀真源条/更新中心)
      return;
    }
    try {
      var status = await window.tianming.contentStatus();
      if (status && status.success) {
        state.packs = status.workshopPacks || [];
        state.defaultFeedUrl = status.defaultUpdateFeedUrl || state.defaultFeedUrl || '';
        state.defaultHotFeedUrl = status.defaultHotUpdateFeedUrl || state.defaultHotFeedUrl || '';
        state.defaultCatalogUrl = status.defaultWorkshopCatalogUrl || state.defaultCatalogUrl || '';
        state.defaultOnlineApiUrl = status.defaultOnlineApiUrl || state.defaultOnlineApiUrl || '';
        state.hotStatus = status.hotUpdate || state.hotStatus || null;
        if (!state.feedUrl) state.feedUrl = loadFeedUrl();
        if (!state.hotFeedUrl) state.hotFeedUrl = loadHotFeedUrl();
        if (!state.catalogUrl) state.catalogUrl = loadCatalogUrl();
        if (!state.onlineApiUrl) state.onlineApiUrl = loadOnlineApiUrl();
        // 账号统一走 TM.OnlineClient（渲染层 localStorage）。优先它；旧 IPC session 仅作兜底。
        var ocSess = (window.TM && TM.OnlineClient) ? TM.OnlineClient.getSession() : null;
        replaceAccountSession((ocSess && ocSess.token) ? ocSess : (status.account || state.accountSession || null), false);
        state.status = { currentVersion: status.currentVersion };
      }
    } catch(e) {
      state.status = { error: e.message };
    }
    render();
    refreshWorkshopSources(false);
  }

  async function checkGameUpdate() {
    var hotInput = document.getElementById('tm-hot-feed');
    if (hotInput) {
      var hotVal = hotInput.value.trim();
      if (hotVal) { state.hotFeedUrl = hotVal; saveHotFeedUrl(hotVal); }
    }
    var feedInput = document.getElementById('tm-update-feed');
    if (feedInput) {
      var feedVal = feedInput.value.trim();
      if (feedVal) { state.feedUrl = feedVal; saveFeedUrl(feedVal); }
    }
    await checkHotUpdate();
    await checkUpdate();
  }

  async function checkUpdate() {
    var input = document.getElementById('tm-update-feed');
    state.feedUrl = input ? input.value.trim() : state.feedUrl;
    if (!state.feedUrl) state.feedUrl = state.defaultFeedUrl || '';
    saveFeedUrl(state.feedUrl);
    state.status = { message: '正在检查更新...' };
    render();
    var res = await window.tianming.checkForUpdate(state.feedUrl);
    state.status = res || { error: '检查失败' };
    render();
  }

  async function downloadUpdate() {
    state.status = { message: '正在下载更新...' };
    render();
    var res = await window.tianming.downloadUpdate();
    state.status = res && res.success ? { message: '更新已下载，可以安装并重启。', info: res.info } : (res || { error: '下载失败' });
    render();
  }

  async function installUpdate() {
    var res = await window.tianming.installUpdate();
    if (!res || !res.success) {
      state.status = res || { error: '安装失败' };
      render();
    }
  }

  async function checkOnlineService() {
    var input = document.getElementById('tm-online-api');
    state.onlineApiUrl = input ? input.value.trim() : state.onlineApiUrl;
    if (!state.onlineApiUrl) state.onlineApiUrl = state.defaultOnlineApiUrl || '';
    saveOnlineApiUrl(state.onlineApiUrl);
    state.onlineMessage = '正在连接在线服务...';
    render();
    try {
      var health;
      if (desktop()) {
        var res = await window.tianming.onlineServiceStatus(state.onlineApiUrl);
        if (!res || !res.success) throw new Error((res && res.error) || '未知错误');
        health = res.health || null;
      } else {
        if (state.onlineApiUrl && window.TM && TM.OnlineClient) TM.OnlineClient.setApiUrl(state.onlineApiUrl);
        health = await TM.OnlineClient.health(state.onlineApiUrl || undefined);
      }
      state.onlineStatus = health || null;
      state.onlineMessage = (health && health.ok !== false) ? '在线服务连接成功。' : '在线服务返回异常。离线游戏不受影响。';
    } catch (e) {
      state.onlineStatus = null;
      state.onlineMessage = '在线服务不可用：' + (e && e.message || '未知错误') + '。离线游戏不受影响。';
    }
    render();
  }

  async function refreshHotStatus() {
    if (!desktop() || !window.tianming.hotUpdateStatus) return;
    var res = await window.tianming.hotUpdateStatus();
    if (res && res.success) state.hotStatus = res.status || null;
  }

  async function checkHotUpdate() {
    var input = document.getElementById('tm-hot-feed');
    state.hotFeedUrl = input ? input.value.trim() : state.hotFeedUrl;
    if (!state.hotFeedUrl) state.hotFeedUrl = state.defaultHotFeedUrl || '';
    saveHotFeedUrl(state.hotFeedUrl);
    state.hotMessage = '正在检查热更新...';
    render();
    var res = await window.tianming.checkHotUpdate(state.hotFeedUrl);
    state.hotCheck = res || null;
    if (res && res.success) {
      state.hotStatus = res.status || state.hotStatus;
      state.hotMessage = res.hasUpdate
        ? ('发现热更新 ' + res.remoteVersion + '，大小 ' + formatBytes(res.size) + '，当前前端版本 ' + res.currentVersion + '。')
        : (res.message || '没有可用热更新。');
    } else {
      state.hotMessage = '检查热更新失败：' + ((res && res.error) || '未知错误');
    }
    render();
  }

  async function installHotUpdate() {
    var input = document.getElementById('tm-hot-feed');
    state.hotFeedUrl = input ? input.value.trim() : state.hotFeedUrl;
    if (!state.hotFeedUrl) state.hotFeedUrl = state.defaultHotFeedUrl || '';
    saveHotFeedUrl(state.hotFeedUrl);
    state.hotMessage = '正在下载并安装热更新...';
    render();
    var res = await window.tianming.installHotUpdate(state.hotFeedUrl);
    if (res && res.success) {
      state.hotStatus = res.status || state.hotStatus;
      state.hotCheck = Object.assign({}, state.hotCheck || {}, { hasUpdate: false });
      state.hotMessage = '热更新已安装。点击“立即重载前端”后生效。';
    } else {
      state.hotStatus = res && res.status ? res.status : state.hotStatus;
      state.hotMessage = (res && (res.message || res.error)) || '热更新安装失败。';
    }
    render();
  }

  async function toggleHotUpdate(enabled) {
    var res = await window.tianming.setHotUpdateEnabled(!!enabled);
    if (res && res.success) {
      state.hotStatus = res.status || state.hotStatus;
      state.hotMessage = enabled ? '热更新已启用。点击“立即重载前端”后按热更版本载入。' : '热更新已暂停。点击“立即重载前端”后回到安装包内置前端。';
    } else {
      state.hotMessage = '切换热更新状态失败：' + ((res && res.error) || '未知错误');
    }
    render();
  }

  async function rollbackHotUpdate() {
    var res = await window.tianming.rollbackHotUpdate();
    if (res && res.success) {
      state.hotStatus = res.status || state.hotStatus;
      state.hotMessage = (res.message || '已回滚热更新。') + ' 点击“立即重载前端”后生效。';
    } else {
      state.hotMessage = '回滚失败：' + ((res && res.error) || '未知错误');
    }
    render();
  }

  async function reloadAfterHotUpdate() {
    var res = await window.tianming.reloadAfterHotUpdate();
    if (!res || !res.success) {
      state.hotMessage = '重载失败：' + ((res && res.error) || '未知错误');
      render();
    }
  }

  async function importPack(overwrite) {
    var res = await window.tianming.importWorkshopPack(!!overwrite);
    if (res && res.exists && !overwrite) {
      if (confirm(res.error + '\n是否覆盖安装？')) return importPack(true);
      return;
    }
    if (!res || !res.success) {
      if (res && !res.canceled) alert(res.error || '导入失败');
      return;
    }
    say('工坊包已导入：' + (res.pack && res.pack.title || ''));
    await refreshPacks();
    await loadWorkshopScenarios(true);
  }

  async function togglePack(id, enabled) {
    await window.tianming.setWorkshopPackEnabled(id, enabled);
    await refreshPacks();
    await loadWorkshopScenarios(true);
  }

  async function uninstallPack(id) {
    if (!confirm('卸载工坊包：' + id + '？')) return;
    await window.tianming.uninstallWorkshopPack(id);
    await refreshPacks();
    await loadWorkshopScenarios(true);
  }

  function catalogUrlWithParams() {
    var base = state.catalogUrl || state.defaultCatalogUrl || '';
    if (!base) return base;
    var parts = [];
    if (state.catalogSort && state.catalogSort !== 'new') parts.push('sort=' + encodeURIComponent(state.catalogSort));
    if (state.catalogQuery) parts.push('q=' + encodeURIComponent(state.catalogQuery));
    if (!parts.length) return base;
    return base + (base.indexOf('?') >= 0 ? '&' : '?') + parts.join('&');
  }

  function currentWorkshopVersion() {
    var fromStatus = state.status && state.status.currentVersion;
    if (fromStatus) return String(fromStatus);
    var meta = document.querySelector('meta[name="tm-version"]');
    return meta && meta.content ? String(meta.content) : '';
  }

  async function loadBundledCatalogFallback(cause) {
    try {
      var pair = await Promise.all([
        fetch('bundled-scenarios/manifest.json?ts=' + Date.now(), { cache: 'no-store' }),
        fetch('version.json?ts=' + Date.now(), { cache: 'no-store' })
      ]);
      if (!pair[0].ok) throw new Error('仓库官方剧本清单 HTTP ' + pair[0].status);
      var manifest = await pair[0].json();
      var versionData = pair[1].ok ? await pair[1].json() : null;
      var version = (versionData && versionData.version) || currentWorkshopVersion();
      var entries = Array.isArray(manifest && manifest.entries) ? manifest.entries : [];
      var packs = entries.filter(function(entry){ return entry && entry.active !== false; }).map(function(entry){
        return {
          id: String(entry.id || entry.key || ''),
          title: String(entry.name || entry.id || '未命名官方剧本'),
          author: '天命官方',
          type: 'scenario',
          version: String(version || ''),
          // background 若非字符串（数组/对象/数字）则不直接 String() 以免得到 "[object Object]"/"a,b"，
          // 退回 era·role 拼串；仅非空字符串 background 采用。
          description: String((typeof entry.background === 'string' && entry.background) || [entry.era, entry.role].filter(Boolean).join(' · ')),
          tags: [entry.era, entry.role, '官方'].filter(Boolean),
          size: Number(entry.bytes) || null,
          sha256: String(entry.sha256 || ''),
          counts: entry.counts || null,
          status: 'bundled',
          official: true,
          _truthOrigin: 'bundled-manifest'
        };
      });
      var query = String(state.catalogQuery || '').trim().toLowerCase();
      if (query) {
        packs = packs.filter(function(pack){
          return [pack.title, pack.author, pack.description].concat(pack.tags || []).join(' ').toLowerCase().indexOf(query) >= 0;
        });
      }
      state.catalog = { type: 'tianming-bundled-scenario-manifest', title: '仓库官方剧本清单', updatedAt: '', packs: packs };
      state.catalogStatus = 'fallback';
      state.catalogOrigin = 'bundled-manifest';
      state.catalogError = (cause && cause.message) || '正式在线目录不可用';
      state.catalogMessage = '正式在线目录不可用；当前展示仓库内置官方剧本 ' + packs.length + ' 件。';
      return true;
    } catch (fallbackError) {
      state.catalog = null;
      state.catalogStatus = 'error';
      state.catalogOrigin = '';
      state.catalogError = ((cause && cause.message) || '正式在线目录不可用') + '；' + ((fallbackError && fallbackError.message) || '仓库官方清单不可用');
      state.catalogMessage = '目录来源均不可用：' + state.catalogError;
      return false;
    }
  }

  async function loadWorkshopCatalog() {
    var input = document.getElementById('tm-workshop-catalog');
    state.catalogUrl = input ? input.value.trim() : state.catalogUrl;
    if (!state.catalogUrl) state.catalogUrl = state.defaultCatalogUrl || '';
    var qEl = document.getElementById('tm-workshop-q');
    var sortEl = document.getElementById('tm-workshop-sort');
    if (qEl) state.catalogQuery = qEl.value.trim();
    if (sortEl) state.catalogSort = sortEl.value || 'new';
    state.catalogAuthorView = '';
    // 记住本次刷新前是否已有可展示的目录数据：兜底彻底失败时用于「保留旧数据 + 过期横幅」(批A stale)。
    var prevCatalog = state.catalog;
    var prevOrigin = state.catalogOrigin;
    var hadOldData = !!(prevCatalog && prevCatalog.packs && prevCatalog.packs.length);
    saveCatalogUrl(state.catalogUrl);
    state.catalogMessage = '正在载入在线工坊目录...';
    state.catalogLoading = true;
    state.catalogStatus = 'loading';
    state.catalogError = null;
    state.catalogOrigin = '';
    render();
    try {
      var catalog;
      var url = catalogUrlWithParams();
      if (desktop()) {
        var res = await window.tianming.loadWorkshopCatalog(url);
        if (!res || !res.success) throw new Error((res && res.error) || '未知错误');
        catalog = res.catalog || null;
      } else {
        catalog = await TM.OnlineClient.catalog(url);
      }
      if (!catalog || !Array.isArray(catalog.packs)) throw new Error('正式在线目录结构无效');
      state.catalog = catalog || null;
      state.catalogStatus = 'ok';
      state.catalogOrigin = 'formal-api';
      state.catalogError = null;
      state.catalogMessage = '已载入 ' + ((catalog && catalog.packs && catalog.packs.length) || 0) + ' 个在线工坊包。' + (state.catalogQuery ? '（搜索：' + state.catalogQuery + '）' : '');
    } catch (e) {
      // 错误分层终局语义（拍定·勿让两套信号互踩）：
      //   ① 先走百工谱阁 bundled 官方清单兜底；兜底成功 → 清 catalogError(=null)，
      //      降级只由真源条 / _truthOrigin 表达，不再叠批A过期横幅（勿双横幅）。
      //   ② 兜底失败但仍有旧的在线目录数据 → 保留旧数据 + 置 catalogError
      //      （catalogViewState → 'stale' → 批A过期横幅，列表照常渲染）。
      //   ③ 兜底失败且无任何数据 → 置 catalogError
      //      （catalogViewState → 'error' → 批A错误卡；loadBundledCatalogFallback 已把 catalog 置 null）。
      var recovered = await loadBundledCatalogFallback(e);
      if (recovered) {
        state.catalogError = null;
      } else if (hadOldData) {
        state.catalog = prevCatalog;
        state.catalogStatus = 'stale';
        state.catalogOrigin = prevOrigin;
        // loadBundledCatalogFallback 失败已把 catalogError 置为「在线错误；兜底错误」复合串（含兜底失败原因）——
        // 保留它，别用单独在线错误覆盖；仅当其为空（如 harness 空跑 stub 未置串）时才退回在线 e.message。
        if (!state.catalogError) state.catalogError = (e && e.message) || '未知错误';
        state.catalogMessage = '在线目录刷新失败，暂显示旧目录：' + state.catalogError;
      } else {
        if (!state.catalogError) state.catalogError = (e && e.message) || '未知错误';
      }
    }
    state.catalogLoading = false;
    render();
    return state.catalog;
  }

  async function ratePack(id, score) {
    if (!(window.TM && TM.OnlineClient && TM.OnlineClient.isLoggedIn())) { state.catalogMessage = '请先登录账号再评分。'; render(); return; }
    try {
      var res = await TM.OnlineClient.ratePack(id, score, state.onlineApiUrl || undefined);
      if (res && res.success) {
        state.catalogMessage = '已评分：' + score + ' 星（' + id + ' 当前 ' + (res.rating != null ? res.rating + ' 分' : '评分未提供') + ' / ' + (res.ratingCount != null ? res.ratingCount + ' 评' : '评价数未提供') + '）。';
        await loadWorkshopCatalog();
      } else {
        state.catalogMessage = '评分失败：' + ((res && res.error) || '未知错误');
        render();
      }
    } catch (e) {
      state.catalogMessage = '评分失败：' + (e && e.message || '未知错误');
      render();
    }
  }

  // 网页工坊存储：独立 IndexedDB（不碰主存档库 / current_project，避免被启动期 saveP 覆写）。
  // 镜像桌面端「磁盘 pack 库 + 启动重新合并」范式：这里存原始剧本 JSON，开局前由
  // loadWorkshopScenarios() 重新 mergeScenarioData 并入 P.scenarios。
  var WS_DB_NAME = 'tianming_workshop', WS_STORE = 'packs', _wsDb = null;
  function wsOpen() {
    return new Promise(function(resolve, reject){
      if (_wsDb) return resolve(_wsDb);
      if (!window.indexedDB) return reject(new Error('当前环境不支持 IndexedDB'));
      var req = indexedDB.open(WS_DB_NAME, 1);
      req.onupgradeneeded = function(e){
        var db = e.target.result;
        if (!db.objectStoreNames.contains(WS_STORE)) db.createObjectStore(WS_STORE, { keyPath: 'packId' });
      };
      req.onsuccess = function(e){ _wsDb = e.target.result; resolve(_wsDb); };
      req.onerror = function(){ reject(req.error || new Error('打开网页工坊库失败')); };
    });
  }
  function wsPut(record) {
    return wsOpen().then(function(db){ return new Promise(function(res, rej){
      var tx = db.transaction(WS_STORE, 'readwrite');
      tx.objectStore(WS_STORE).put(record);
      tx.oncomplete = function(){ res(true); };
      tx.onerror = function(){ rej(tx.error); };
    }); });
  }
  function wsGetAll() {
    return wsOpen().then(function(db){ return new Promise(function(res, rej){
      var tx = db.transaction(WS_STORE, 'readonly');
      var rq = tx.objectStore(WS_STORE).getAll();
      rq.onsuccess = function(){ res(rq.result || []); };
      rq.onerror = function(){ rej(rq.error); };
    }); });
  }
  function wsDelete(packId) {
    return wsOpen().then(function(db){ return new Promise(function(res, rej){
      var tx = db.transaction(WS_STORE, 'readwrite');
      tx.objectStore(WS_STORE).delete(packId);
      tx.oncomplete = function(){ res(true); };
      tx.onerror = function(){ rej(tx.error); };
    }); });
  }

  function findCatalogPack(packId, packageUrl) {
    var packs = (state.catalog && state.catalog.packs) || [];
    for (var i = 0; i < packs.length; i++) {
      if (packId && packs[i].id === packId) return packs[i];
    }
    for (var j = 0; j < packs.length; j++) {
      if (packageUrl && packs[j].packageUrl === packageUrl) return packs[j];
    }
    return null;
  }

  // A4·配额判定（纯函数）：只认真配额错误，勿把 "Maximum call stack size exceeded" 之类误报成空间不足。
  //   命中条件 = QuotaExceededError / NS_ERROR_DOM_QUOTA_REACHED(Firefox) 名 / message 含 quota /
  //   含「存储空间」 / （storage 且 exceed|full|不足|maximum size reached|exceeded 组合，覆盖 FF「maximum
  //   size reached」·但排除「maximum size setting is malformed」等非到达语义误配）。
  function isQuotaError(e) {
    if (!e) return false;
    if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') return true;
    var msg = String(e.message || '');
    return /quota/i.test(msg) || /存储空间/.test(msg) || (/storage/i.test(msg) && /exceed|full|不足|maximum size (reached|exceeded)/i.test(msg));
  }

  // 网页安装：把工坊剧本的 JSON 直接下载并入剧本库（IndexedDB），无需本地落盘。
  // 带资源（立绘/音频）的 .tm-pack 打包文件在网页解析为 JSON 会失败，提示改用桌面版。
  async function installCatalogPackWeb(packageUrl, sha256, packId, metaOverride) {
    if (!window.P) { say('剧本库尚未就绪，请稍后再试。'); return; }
    // metaOverride 来自更新流（带权威 version/title）；普通安装则查当前 catalog。
    var meta = metaOverride || findCatalogPack(packId, packageUrl) || {};
    state.catalogMessage = '正在下载在线剧本...';
    render();
    try {
      // 相对地址按 catalog 地址解析（对齐桌面端 resolveRemoteUrl(ref, catalogUrl)）
      var resolvedUrl = packageUrl;
      try { resolvedUrl = new URL(packageUrl, state.catalogUrl || state.defaultCatalogUrl || location.href).toString(); } catch (e0) {}
      var resp = await fetch(resolvedUrl, { mode: 'cors', cache: 'no-store' });
      if (!resp.ok) throw new Error('下载失败：HTTP ' + resp.status);
      var _dlp = -1, _dlt = 0;   // 下载进度节流游标
      var rawBuf = (resp.body && resp.body.getReader && window.TM && TM.OnlineClient && TM.OnlineClient.readBytesWithProgress) ? await TM.OnlineClient.readBytesWithProgress(resp, function (loaded, total) { if (!total) return; var pct = Math.max(0, Math.min(100, Math.round(loaded / total * 100))), now = Date.now(); if (uploadProgressShouldRender(pct, _dlp, now - _dlt)) { _dlp = pct; _dlt = now; state.catalogMessage = '正在下载… ' + pct + '%'; render(); } }) : new Uint8Array(await resp.arrayBuffer());
      // 批Ⅴ(2026-07-22)·zip 资产包分支：PK 魔数→网页/安卓也能装（store zip 解包入 IDB·
      // 音乐/立绘/图幅经 TM.WorkshopAssets 生效）。压缩 zip 由 parseZip 明说拒收。
      if (rawBuf.length > 3 && rawBuf[0] === 0x50 && rawBuf[1] === 0x4b && rawBuf[2] === 0x03 && rawBuf[3] === 0x04) {
        if (rawBuf.length > 64 * 1024 * 1024) throw new Error('资产包超过网页安装上限（64MB），请用桌面版安装。');
        if (sha256 && window.crypto && crypto.subtle) {
          var dg = await crypto.subtle.digest('SHA-256', rawBuf);
          var hex = Array.prototype.map.call(new Uint8Array(dg), function(b){ return ('0' + b.toString(16)).slice(-2); }).join('');
          if (hex.toLowerCase() !== String(sha256).toLowerCase()) throw new Error('资产包 sha256 校验不符，已拒绝安装。');
        }
        if (!(window.TMZipStore && TMZipStore.parseZip)) throw new Error('解包模块未就绪。');
        var zEntries = TMZipStore.parseZip(rawBuf);
        if (zEntries.length > 500) throw new Error('资产包文件数超上限（500）。');
        var mfEntry = zEntries.find(function(e){ return e.name === 'manifest.json'; });
        if (!mfEntry) throw new Error('资产包缺少 manifest.json（旧版发布的包·请作者用新版重发）。');
        var mfObj = JSON.parse(new TextDecoder('utf-8').decode(mfEntry.data));
        var aType = String(mfObj.type || meta.type || 'mod');
        var aId = String(meta.id || packId || mfObj.id || 'asset-pack');
        await wsPut({ packId: aId, kind: 'asset', type: aType,
          title: String(meta.title || mfObj.title || aId),
          version: String(meta.version || mfObj.version || '1.0.0'),
          manifest: mfObj,
          files: zEntries.filter(function(e){ return e.name !== 'manifest.json'; }).map(function(e){ return { name: e.name, data: e.data }; }),
          enabled: true, installedAt: new Date().toISOString(),
          packageUrl: packageUrl, sha256: String(meta.sha256 || sha256 || '') });
        await refreshWebInstalled();
        try { if (TM.WorkshopAssets && TM.WorkshopAssets.warmup) TM.WorkshopAssets.warmup(); } catch (eW) {}
        state.catalogMessage = '已安装' + packTypeNoun(aType) + '：' + (meta.title || mfObj.title || aId) +
          (aType === 'music' ? '（曲目已并入声乐曲库）' : aType === 'portrait' ? '（同名人物立绘自动启用）' : aType === 'map' ? '（详情里可「在地图编辑器中打开」）' : aType === 'mod' ? '（组合包已装载：包内立绘 / 音乐将自动生效）' : '') + '。';
        say('已安装工坊' + packTypeNoun(aType) + '：' + (meta.title || mfObj.title || aId));
        render();
        return;
      }
      var text = new TextDecoder('utf-8').decode(rawBuf);
      if (text.length > 16 * 1024 * 1024) throw new Error('剧本体积超过网页安装上限（16MB），请用桌面版安装。');
      var data;
      try { data = JSON.parse(text); }
      catch (e) { throw new Error('此工坊包不是纯文本剧本也不是网页可装的 store 资产包，请用桌面版安装。'); }
      var pack = {
        id: String(meta.id || packId || data.id || 'workshop-pack'),
        title: String(meta.title || data.name || data.title || '工坊剧本'),
        assetBase: '' // 网页安装无本地资源目录；纯文本剧本不应含包内相对资源
      };
      var n = mergeScenarioData(pack, data);
      if (!n) throw new Error('没有可安装的剧本数据。');
      // 持久化到独立工坊库；开局前 loadWorkshopScenarios 会重新合并（抗启动期 P 覆写）。
      // 存 version/packageUrl 供后续「检查更新」比对（订阅=安装）。
      await wsPut({ packId: pack.id, title: pack.title, data: data, enabled: true,
        installedAt: new Date().toISOString(),
        version: String(meta.version || data.version || '1.0.0'),
        packageUrl: packageUrl, sha256: String(meta.sha256 || '') });
      await refreshWebInstalled();
      state.catalogMessage = '已安装到剧本库：' + pack.title + '（共 ' + n + ' 个剧本，可在「选择剧本」开局）。';
      say('已安装工坊剧本：' + pack.title);
      try {
        var scnPage = document.getElementById('scn-page');
        if (scnPage && scnPage.classList.contains('show') && typeof showScnSelect === 'function') showScnSelect();
      } catch (e2) {}
      render();
    } catch (e) {
      // A4：设备存储配额耗尽（IDB 写满 / 安卓 WebView 配额）给专门文案，其余保持现文案。
      var quota = isQuotaError(e);
      state.catalogMessage = quota ? '设备存储空间不足：请清理空间或卸载不用的工坊包后重试。' : ('网页安装失败：' + (e && e.message || '未知错误'));
      render();
    }
  }

  function _verParts(v) { return String(v || '0').split('.').map(function(x){ return parseInt(x, 10) || 0; }); }
  function _verGt(a, b) {
    var pa = _verParts(a), pb = _verParts(b), n = Math.max(pa.length, pb.length);
    for (var i = 0; i < n; i++) { var x = pa[i] || 0, y = pb[i] || 0; if (x !== y) return x > y; }
    return false;
  }

  async function refreshWebInstalled() {
    if (desktop()) return;
    // 批Ⅴ·kind==='handoff' 是图幅交接暂存件（编辑器取走即删）·不进已装列表
    try { state.webInstalled = (await wsGetAll()).filter(function(r){ return r && r.kind !== 'handoff'; }); } catch (e) { state.webInstalled = state.webInstalled || []; }
  }

  // ── 批Ⅴ(2026-07-22)·资产包统一取件桥 TM.WorkshopAssets ─────────────────────
  // 桌面=已装工坊目录(tm-content:// 协议)·网页/安卓=IDB 资产记录(kind==='asset')。
  // 音乐入轮播(tm-audio-theme)/立绘兜底(tm-renwu-*)/图幅进编辑器 三条生效链共用此口。
  var _waUrlCache = {};      // packId/name -> objectURL（网页水化后）
  var _waPortraitIdx = null; // 人物名(文件基名) -> url
  function waListAssetPacks() {
    if (desktop()) {
      var lp = (window.tianming && window.tianming.listWorkshopPacks) ? window.tianming.listWorkshopPacks() : Promise.resolve(null);
      return lp.then(function(res){
        var packs = (res && res.success && Array.isArray(res.packs)) ? res.packs : [];
        return packs.filter(function(p){ return p && p.type && p.type !== 'scenario' && p.enabled !== false; })
          .map(function(p){ return { id: p.id, type: p.type, title: p.title, source: 'desktop' }; });
      }).catch(function(){ return []; });
    }
    return wsGetAll().then(function(recs){
      return (recs || []).filter(function(r){ return r && r.kind === 'asset' && r.enabled !== false; })
        .map(function(r){ return { id: r.packId, type: r.type, title: r.title, manifest: r.manifest, source: 'idb' }; });
    }).catch(function(){ return []; });
  }
  function waGetManifest(pk) {
    if (pk && pk.manifest) return Promise.resolve(pk.manifest);
    if (pk && pk.source === 'desktop') {
      return fetch('tm-content://workshop/' + encodeURIComponent(pk.id) + '/manifest.json')
        .then(function(r){ return r.ok ? r.json() : null; }).catch(function(){ return null; });
    }
    return Promise.resolve(null);
  }
  function waFileUrl(pk, name) {
    if (!pk) return '';
    if (pk.source === 'desktop') return 'tm-content://workshop/' + encodeURIComponent(pk.id) + '/' + encodeURIComponent(name);
    return _waUrlCache[pk.id + '/' + name] || '';
  }
  function waHydrate(pk) {
    if (!pk || pk.source !== 'idb') return Promise.resolve(pk);
    return wsGetAll().then(function(recs){
      var rec = (recs || []).find(function(r){ return r && r.packId === pk.id && r.kind === 'asset'; });
      ((rec && rec.files) || []).forEach(function(f){
        if (!f || !f.name) return;
        var key = pk.id + '/' + f.name;
        if (_waUrlCache[key]) return;
        try { _waUrlCache[key] = URL.createObjectURL(new Blob([f.data])); } catch (e) {}
      });
      return pk;
    }).catch(function(){ return pk; });
  }
  function waPortraitFor(name) {
    if (!_waPortraitIdx || !name) return '';
    return _waPortraitIdx[String(name).trim()] || '';
  }
  // R2·纯归并（确定可复述）：把各包扫描出的 { type, order, entries } 按稳定优先级归并成立绘索引。
  //   优先级 = portrait 包先于 mod 包；同类型按 waListAssetPacks 返回列表序（order）。首见占坑（高优先级先归并）。
  //   独立纯函数便于测试——同名立绘取决于 pack 优先级而非 IDB 到达时序。
  function waMergePortraitIndex(items) {
    var prio = function(t){ return t === 'portrait' ? 0 : 1; };
    var ordered = (items || []).slice().sort(function(a, b){
      var pa = prio(a && a.type), pb = prio(b && b.type);
      if (pa !== pb) return pa - pb;
      return (a.order || 0) - (b.order || 0);
    });
    var idx = {};
    ordered.forEach(function(it){
      ((it && it.entries) || []).forEach(function(e){
        if (e && e.url && e.base && !idx[e.base]) idx[e.base] = e.url;
      });
    });
    return idx;
  }
  function waWarmup() {
    waListAssetPacks().then(function(list){
      list = list || [];
      var jobs = list.map(function(pk, i){
        var pre = pk.source === 'idb' ? waHydrate(pk) : Promise.resolve(pk);
        return pre.then(function(){ return waGetManifest(pk); }).then(function(mf){
          var out = [];
          // 批A·A3：立绘包全扫；mod=混合资产组合包·仅扫其中被识别为立绘的图片。
          var isPortraitPack = pk.type === 'portrait';
          var isModPack = pk.type === 'mod';
          if (!isPortraitPack && !isModPack) return { type: pk.type, order: i, entries: out };
          // 残局借 mod 壳（tags 含「残局」/packageKind='resume'）：不当资产扫（不影响其接演链）。
          if (isModPack && isResumePack(mf)) return { type: pk.type, order: i, entries: out };
          var files = (mf && Array.isArray(mf.files)) ? mf.files : [];
          var typed = (mf && Array.isArray(mf.assets)) ? mf.assets : [];
          files.forEach(function(f){
            var name = String(f || '');
            if (!/\.(png|jpe?g|webp|bmp)$/i.test(name)) return;
            var base = name.replace(/^.*[\/\\]/, '').replace(/\.[^.]+$/, '');
            if (isModPack) {
              // mod 立绘识别：优先 manifest 类型化声明·兜底 portraits/ 子目录约定；排除封面/截图/预览基名（勿把封面误当立绘）。
              if (/^(cover|shot|preview|screenshot)/i.test(base)) return;
              var declared = typed.some(function(a){ return a && String(a.file || a.name || '') === name && /portrait|立绘/i.test(String(a.type || a.kind || '')); });
              var inPortraitDir = /(^|[\/\\])portraits?[\/\\]/i.test(name);
              if (!declared && !inPortraitDir) return;
            }
            var u = waFileUrl(pk, name);
            if (u) out.push({ base: base, url: u });
          });
          return { type: pk.type, order: i, entries: out };
        }).catch(function(){ return { type: pk.type, order: i, entries: [] }; });
      });
      // Promise.all 结果按输入(list)序返回·与 IDB 到达时序无关；再交纯归并按优先级定夺同名占坑。
      return Promise.all(jobs).then(function(results){
        _waPortraitIdx = waMergePortraitIndex(results);
        // 音乐轮播刷新（audio 早于本桥装载时其 web 分支空转·此处回手补一遍）
        try { if (window.AudioSystem && typeof AudioSystem.loadWorkshopTracks === 'function') AudioSystem.loadWorkshopTracks(function(){}); } catch (e) {}
      });
    }).catch(function(){});
  }
  // 图幅包进地图编辑器：取 entry JSON→IDB 交接件(__me_import)→开编辑器页（editor 就绪自取自删）
  async function openMapPackInEditor(packId) {
    try {
      var list = await waListAssetPacks();
      var pk = (list || []).find(function(p){ return p && p.id === packId && p.type === 'map'; });
      if (!pk) { state.catalogMessage = '先安装此图幅包，再在编辑器中打开。'; render(); return; }
      var mf = await waGetManifest(pk);
      var entryName = (mf && mf.entry && /\.(geo)?json$/i.test(mf.entry)) ? mf.entry
        : ((mf && Array.isArray(mf.files)) ? mf.files.find(function(f){ return /\.(geo)?json$/i.test(String(f || '')); }) : '');
      if (!entryName) { state.catalogMessage = '包内没有可用的图幅 JSON。'; render(); return; }
      if (pk.source === 'idb') await waHydrate(pk);
      var url = waFileUrl(pk, String(entryName));
      if (!url) { state.catalogMessage = '取件失败：图幅文件不可读。'; render(); return; }
      var jsonText = await (await fetch(url)).text();
      await wsPut({ packId: '__me_import', kind: 'handoff', title: pk.title || packId, json: jsonText, at: new Date().toISOString() });
      window.open('map-editor.html', '_blank');
      state.catalogMessage = '已递交图幅「' + (pk.title || packId) + '」——编辑器窗口就绪后自动载入。';
      render();
    } catch (e) {
      state.catalogMessage = '打开图幅失败：' + (e && e.message || '未知错误');
      render();
    }
  }
  if (typeof window !== 'undefined') {
    window.TM = window.TM || {};
    TM.WorkshopAssets = { listAssetPacks: waListAssetPacks, getManifest: waGetManifest, fileUrl: waFileUrl, hydrate: waHydrate, portraitFor: waPortraitFor, warmup: waWarmup };
    setTimeout(function(){ try { waWarmup(); } catch (e) {} }, 2500);
  }

  // 订阅=安装：检查已装工坊包是否有新版（作者发新版 + owner 审核通过后）。
  async function checkWorkshopUpdates(silent) {
    if (desktop()) { if (!silent) { state.catalogMessage = '桌面端工坊更新走本体/热更通道。'; render(); } return; }
    if (!silent) { state.catalogMessage = '正在检查工坊更新...'; render(); }
    var recs = [];
    try { recs = await wsGetAll(); } catch (e) {}
    var updates = {};
    for (var i = 0; i < recs.length; i++) {
      var r = recs[i];
      try {
        var res = await TM.OnlineClient.packMeta(r.packId, state.onlineApiUrl || undefined);
        if (res && res.success && res.pack && _verGt(res.pack.version, r.version || '0')) {
          updates[r.packId] = { from: r.version || '?', to: res.pack.version, pack: res.pack };
        }
      } catch (e) {}
    }
    state.workshopUpdates = updates;
    await refreshWebInstalled();
    var cnt = Object.keys(updates).length;
    if (!silent) state.catalogMessage = cnt ? ('发现 ' + cnt + ' 个工坊包有新版，可点「更新」。') : '已安装的工坊包均为最新。';
    render();
  }

  async function updateWorkshopPack(packId) {
    if (desktop()) return;
    var info = (state.workshopUpdates || {})[packId];
    var pack = info && info.pack;
    if (!pack) {
      try { var res = await TM.OnlineClient.packMeta(packId, state.onlineApiUrl || undefined); pack = res && res.pack; } catch (e) {}
    }
    if (!pack || !pack.packageUrl) { state.catalogMessage = '无法获取该工坊包的最新地址。'; render(); return; }
    await installCatalogPackWeb(pack.packageUrl, pack.sha256 || '', packId, { version: pack.version, title: pack.title, sha256: pack.sha256 });
    if (state.workshopUpdates) delete state.workshopUpdates[packId];
    await refreshWebInstalled();
    render();
  }

  async function updateAllWorkshop() {
    if (desktop()) return;
    var ids = Object.keys(state.workshopUpdates || {});
    if (!ids.length) { state.catalogMessage = '没有可更新的工坊剧本。'; render(); return; }
    state.catalogMessage = '正在更新 ' + ids.length + ' 个工坊剧本...'; render();
    for (var i = 0; i < ids.length; i++) { try { await updateWorkshopPack(ids[i]); } catch (e) {} }
    state.catalogMessage = '已全部更新完成。'; render();
  }

  async function uninstallWebPack(packId) {
    if (desktop()) return;
    if (!confirm('卸载工坊剧本：' + packId + '？（会从剧本库移除）')) return;
    try {
      if (typeof clearWorkshopPack === 'function') clearWorkshopPack(packId);
      await wsDelete(packId);
      if (typeof buildIndices === 'function') buildIndices();
    } catch (e) {}
    if (state.workshopUpdates) delete state.workshopUpdates[packId];
    await refreshWebInstalled();
    state.catalogMessage = '已卸载工坊剧本：' + packId;
    try { var sp = document.getElementById('scn-page'); if (sp && sp.classList.contains('show') && typeof showScnSelect === 'function') showScnSelect(); } catch (e) {}
    render();
  }

  async function loadAuthorPacks(authorId, name) {
    state.catalogMessage = '正在载入作者作品...';
    state.catalog = null;
    state.pane = 'browse';
    state.detailOpen = false;
    render();
    try {
      var res = await TM.OnlineClient.authorPacks({ authorId: authorId, name: name }, state.onlineApiUrl || undefined);
      if (res && res.success) {
        state.catalog = { type: 'tianming-workshop-catalog', title: '作者：' + (res.author || name || ''), packs: res.packs || [], updatedAt: '' };
        state.catalogAuthorView = res.author || name || '';
        state.catalogMessage = '作者「' + (res.author || name || '') + '」共 ' + ((res.packs || []).length) + ' 个作品。';
      } else {
        state.catalogMessage = '载入作者作品失败：' + ((res && res.error) || '未知错误');
      }
    } catch (e) {
      state.catalogMessage = '载入作者作品失败：' + (e && e.message || '未知错误');
    }
    render();
  }

  async function installCatalogPack(packageUrl, sha256, packId, overwrite) {
    if (!packageUrl) return;
    if (!desktop()) return installCatalogPackWeb(packageUrl, sha256, packId);
    state.catalogMessage = '正在下载并安装在线工坊包...';
    render();
    // 桌面下载进度：installWorkshopPackFromUrl 的 IPC 暂无 main→renderer 进度回传（downloadRemoteFile 支持 onProgress 但 workshop-install-from-url 未透传）；新开 IPC 面留待发版后，网页端已流式显示百分比。
    var res = await window.tianming.installWorkshopPackFromUrl(packageUrl, sha256 || '', !!overwrite);
    if (res && res.exists && !overwrite) {
      if (confirm(res.error + '\n是否覆盖安装？')) return installCatalogPack(packageUrl, sha256, packId, true);
      state.catalogMessage = '已取消覆盖安装。';
      render();
      return;
    }
    if (res && res.success) {
      state.catalogMessage = '在线工坊包已安装：' + ((res.pack && res.pack.title) || '');
      await refreshPacks();
      await loadWorkshopScenarios(true);
    } else {
      state.catalogMessage = '在线安装失败：' + ((res && res.error) || '未知错误');
      render();
    }
  }

  // 残局接演：下载残局包（原始存档 JSON）→ TM.ResumePoint.resume 起局（fullLoadGame·覆盖当前局·保留本地 API key）。
  // 桌面/网页同路（残局是原始 JSON·非落盘装包）。跨用户真下载受审核门约束：pending 包 403·需管理员审批后可下。
  async function resumePlay(packageUrl, packId) {
    if (!packageUrl) { say('无法获取该残局的下载地址。'); return; }
    if (!(window.TM && TM.ResumePoint && TM.ResumePoint.resume)) { say('残局模块未就绪。'); return; }
    if (typeof confirm === 'function' && !confirm('从此残局接演？将载入这局的推演进度，覆盖当前进行中的局（若未封存）。')) return;
    state.catalogMessage = '正在下载残局并起局……';
    render();
    var resolvedUrl = packageUrl;
    try { resolvedUrl = new URL(packageUrl, state.catalogUrl || state.defaultCatalogUrl || location.href).toString(); } catch (e) {}
    try {
      var res = await TM.ResumePoint.resume(resolvedUrl);
      if (res && res.success) {
        state.catalogMessage = '已接演残局·第' + (res.turn || '?') + '回合，续写这段天命。';
        // fullLoadGame 已切到游戏界面·关闭工坊层
        try { var bg = document.getElementById('tm-content-bg'); if (bg) bg.style.display = 'none'; } catch (e2) {}
        say('已从残局接演·第' + (res.turn || '?') + '回合');
      } else {
        state.catalogMessage = '接演失败：' + ((res && res.error) || '未知错误');
        render();
      }
    } catch (e) {
      state.catalogMessage = '接演失败：' + (e && e.message || '未知错误');
      render();
    }
  }

  async function accountEmailCodeRequest() {
    var el = document.getElementById('tm-elogin-email');
    var email = el ? el.value.trim() : '';
    if (email) state.emailLoginAddr = email; // 记住已填邮箱，避免重渲被清空
    if (!email) { state.accountMessage = '请填写邮箱。'; render(); return; }
    state.accountMessage = '正在发送登录验证码...';
    render();
    try {
      if (state.onlineApiUrl && window.TM && TM.OnlineClient) TM.OnlineClient.setApiUrl(state.onlineApiUrl);
      var res = await TM.OnlineClient.emailCodeRequest(email, state.onlineApiUrl || undefined);
      if (res && res.success && (res.devCode || res.sent !== false)) {
        state.accountMessage = res.devCode ? ('【测试模式】登录验证码：' + res.devCode) : '验证码已发送到邮箱，请查收（含垃圾箱）。';
      } else if (res && res.success && res.sent === false) {
        // 服务器收下了请求但邮件没发出去（SMTP 未配/授权码无效）。诚实告知，引导改用账号密码。
        state.accountMessage = '邮件服务暂不可用，验证码未发出。请改用下方「账号密码」注册 / 登录（无需邮箱）。';
      } else {
        state.accountMessage = '发送失败：' + ((res && res.error) || '未知错误');
      }
    } catch (e) { state.accountMessage = '发送失败：' + (e && e.message || '未知错误'); }
    render();
  }

  async function accountEmailLogin() {
    var ee = document.getElementById('tm-elogin-email');
    var ce = document.getElementById('tm-elogin-code');
    var email = ee ? ee.value.trim() : (state.emailLoginAddr || '');
    var code = ce ? ce.value.trim() : '';
    if (!email || !code) { state.accountMessage = '请填写邮箱与验证码。'; render(); return; }
    state.accountMessage = '正在登录...';
    render();
    try {
      var res = await TM.OnlineClient.emailLogin(email, code, state.onlineApiUrl || undefined);
      if (res && res.success) {
        state.emailLoginAddr = '';
        await refreshAccountSession();
        state.accountMessage = '邮箱登录成功。';
      } else {
        state.accountMessage = '登录失败：' + ((res && res.error) || '未知错误');
      }
    } catch (e) { state.accountMessage = '登录失败：' + (e && e.message || '未知错误'); }
    render();
  }

  async function accountLogin() {
    var name = document.getElementById('tm-account-name');
    var pass = document.getElementById('tm-account-pass');
    var uname = name ? name.value.trim() : '';
    var upass = pass ? pass.value : '';
    state.accountMessage = '正在登录...';
    render();
    try {
      if (state.onlineApiUrl && window.TM && TM.OnlineClient) TM.OnlineClient.setApiUrl(state.onlineApiUrl);
      var res = await TM.OnlineClient.login({ username: uname, password: upass }, state.onlineApiUrl || undefined);
      if (res && res.success) {
        await refreshAccountSession();
        state.accountMessage = '登录成功。';
      } else {
        state.accountMessage = '登录失败：' + ((res && res.error) || '未知错误');
      }
    } catch (e) {
      state.accountMessage = '登录失败：' + (e && e.message || '未知错误');
    }
    render();
  }

  async function accountRegister() {
    var name = document.getElementById('tm-account-name');
    var pass = document.getElementById('tm-account-pass');
    var nick = document.getElementById('tm-account-nickname');
    var mail = document.getElementById('tm-account-email');
    var uname = name ? name.value.trim() : '';
    var upass = pass ? pass.value : '';
    var unick = nick ? nick.value.trim() : '';
    var umail = mail ? mail.value.trim() : '';
    state.accountMessage = '正在注册...';
    render();
    try {
      if (state.onlineApiUrl && window.TM && TM.OnlineClient) TM.OnlineClient.setApiUrl(state.onlineApiUrl);
      var res = await TM.OnlineClient.register({ username: uname, password: upass, nickname: unick, email: umail }, state.onlineApiUrl || undefined);
      if (res && res.success) {
        await refreshAccountSession();
        state.accountMessage = '注册并登录成功。' + (!umail ? '（未填邮箱，建议在「我的」里补设以便找回密码）' : '');
      } else {
        state.accountMessage = '注册失败：' + ((res && res.error) || '未知错误');
      }
    } catch (e) {
      state.accountMessage = '注册失败：' + (e && e.message || '未知错误');
    }
    render();
  }

  function toggleReset() {
    state.accountResetOpen = !state.accountResetOpen;
    if (state.accountResetOpen) state.accountResetMessage = '';
    render();
  }

  async function accountRequestReset() {
    var emailEl = document.getElementById('tm-reset-email');
    var email = emailEl ? emailEl.value.trim() : '';
    if (!email) { state.accountResetMessage = '请填写邮箱。'; render(); return; }
    state.accountResetMessage = '正在发送验证码...';
    render();
    try {
      var res = await TM.OnlineClient.requestReset(email, state.onlineApiUrl || undefined);
      if (res && res.success) {
        state.accountResetMessage = res.devCode
          ? ('【测试模式】验证码：' + res.devCode + '（服务器未配置邮件服务）')
          : '若该邮箱已注册，验证码已发送，请查收邮件（含垃圾箱）。';
      } else {
        state.accountResetMessage = '发送失败：' + ((res && res.error) || '未知错误');
      }
    } catch (e) {
      state.accountResetMessage = '发送失败：' + (e && e.message || '未知错误');
    }
    render();
  }

  async function accountReset() {
    var emailEl = document.getElementById('tm-reset-email');
    var codeEl = document.getElementById('tm-reset-code');
    var passEl = document.getElementById('tm-reset-pass');
    var email = emailEl ? emailEl.value.trim() : '';
    var code = codeEl ? codeEl.value.trim() : '';
    var pass = passEl ? passEl.value : '';
    if (!email || !code) { state.accountResetMessage = '请填写邮箱与验证码。'; render(); return; }
    if (pass.length < 8) { state.accountResetMessage = '新密码至少 8 位。'; render(); return; }
    state.accountResetMessage = '正在重置密码...';
    render();
    try {
      var res = await TM.OnlineClient.resetPassword(email, code, pass, state.onlineApiUrl || undefined);
      if (res && res.success) {
        state.accountResetMessage = '密码已重置，请用新密码登录。';
        state.accountResetOpen = false;
        state.accountMessage = '密码已重置，请用新密码登录。';
      } else {
        state.accountResetMessage = '重置失败：' + ((res && res.error) || '未知错误');
      }
    } catch (e) {
      state.accountResetMessage = '重置失败：' + (e && e.message || '未知错误');
    }
    render();
  }

  async function publishWorkshopPack() {
    if (!desktop()) {
      // 网页发布（纯文本剧本上传）属后续阶段；当前网页只读，先引导到桌面端。
      state.publishMessage = '网页版暂不支持发布工坊内容，请用桌面版发布；网页可正常浏览与安装。';
      render();
      return;
    }
    var title = document.getElementById('tm-publish-title');
    var url = document.getElementById('tm-publish-url');
    var sha = document.getElementById('tm-publish-sha');
    var version = document.getElementById('tm-publish-version');
    var tags = document.getElementById('tm-publish-tags');
    var desc = document.getElementById('tm-publish-desc');
    state.publishMessage = '正在登记到在线工坊...';
    render();
    var res = await window.tianming.publishWorkshopPack({
      title: title ? title.value.trim() : '',
      packageUrl: url ? url.value.trim() : '',
      sha256: sha ? sha.value.trim() : '',
      version: version ? version.value.trim() : '1.0.0',
      tags: tags ? tags.value.trim() : '',
      description: desc ? desc.value.trim() : '',
      type: 'scenario'
    });
    if (res && res.success) {
      state.publishMessage = '已发布到在线工坊：' + ((res.pack && res.pack.title) || '');
      await loadWorkshopCatalog();
    } else {
      state.publishMessage = '发布失败：' + ((res && res.error) || '未知错误');
      render();
    }
  }

  // 网页发布：从玩家剧本库选一个纯文本剧本，上传到 /workshop/upload（落服务器自持 -> 待审）。
  async function webPublishScenario() {
    if (!window.P || !Array.isArray(P.scenarios)) { state.publishMessage = '剧本库尚未就绪。'; render(); return; }
    if (!(window.TM && TM.OnlineClient && TM.OnlineClient.isLoggedIn())) { state.publishMessage = '请先登录账号再发布。'; render(); return; }
    var sel = document.getElementById('tm-webpub-scn');
    var titleEl = document.getElementById('tm-webpub-title');
    var verEl = document.getElementById('tm-webpub-version');
    var tagsEl = document.getElementById('tm-webpub-tags');
    var descEl = document.getElementById('tm-webpub-desc');
    var sid = sel ? sel.value : '';
    var scn = P.scenarios.filter(function(s){ return s && s.id === sid; })[0];
    if (!scn) { state.publishMessage = '请选择一个有效剧本。'; render(); return; }
    var title = (titleEl && titleEl.value.trim()) || scn.name || sid;
    // 导出干净剧本：剔除 _ 前缀的运行时 / 来源私有字段
    var clean = {};
    Object.keys(scn).forEach(function(k){ if (k.charAt(0) !== '_') clean[k] = scn[k]; });
    var meta = {
      title: title,
      id: String(scn.id || title),
      version: (verEl && verEl.value.trim()) || '1.0.0',
      description: (descEl && descEl.value.trim()) || '',
      type: 'scenario',
      tags: tagsEl ? tagsEl.value : '',
      filename: 'scenario.json'
    };
    if (state.forkSource && state.forkSource.id) meta.parentId = state.forkSource.id;
    state.publishMessage = '正在上传到工坊...';
    render();
    try {
      var res = await TM.OnlineClient.uploadScenario(meta, clean);
      if (res && res.success) {
        state.forkSource = null;
        autoPostPublish((res.pack && res.pack.title) || title, 'scenario', meta.id);
        state.publishMessage = '已提交工坊：' + ((res.pack && res.pack.title) || title) + '（待审核，通过后其他玩家可见可装）。';
      } else {
        state.publishMessage = '发布失败：' + ((res && res.error) || '未知错误');
      }
    } catch (e) {
      state.publishMessage = '发布失败：' + (e && e.message || '未知错误');
    }
    render();
  }

  // P1-S2c：选中资源文件数提示。
  function onAssetFiles(input) {
    var el = document.getElementById('tm-asset-count');
    var n = (input && input.files) ? input.files.length : 0;
    if (el) el.textContent = n ? (n + ' 个文件待打包') : '未选择文件';
  }

  function bytesToBase64Local(bytes) {
    if (window.TMZipStore && TMZipStore.bytesToBase64) return TMZipStore.bytesToBase64(bytes);
    if (typeof btoa === 'undefined' && typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
    var bin = '', chunk = 0x8000;
    for (var i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    return btoa(bin);
  }

  function fileObjectUrl(file) {
    try { return (window.URL && URL.createObjectURL && file) ? URL.createObjectURL(file) : ''; } catch (e) { return ''; }
  }

  function revokeObjectUrl(url) {
    try { if (url && window.URL && URL.revokeObjectURL) URL.revokeObjectURL(url); } catch (e) {}
  }

  function publishFileBaseName(file) {
    return String((file && file.name) || '').replace(/\.[^.]+$/, '').replace(/[_\-]+/g, ' ').trim();
  }

  function onPublishPackageFile(input) {
    capturePublishDraft();
    var file = input && input.files && input.files[0];
    if (!file) { state.publishPackageFile = null; render(); return; }
    if (!/\.(tm-pack|zip)$/i.test(file.name || '')) {
      state.publishMessage = '投稿资源必须是 .tm-pack 或 .zip 压缩包。';
      state.publishPackageFile = null;
      render();
      return;
    }
    state.publishPackageFile = file;
    var d = publishDraft();
    if (!d.title) d.title = publishFileBaseName(file);
    state.publishMessage = '已导入投稿资源：' + fileLine(file) + '。';
    render();
  }

  // ── B1（工坊全链修缮·批B）：页内打包器 ──────────────────────────────────────
  // 普通创作者不会手写 manifest.json——本处理器把散文件按「商店分类」交 TMZipStore.planLoosePack
  // 归一（纯计划·mod 组合包立绘落 portraits//音频落 music/·与批A识别约定对齐），再 buildZip
  // 打成 store-zip，包一层 .tm-pack File 喂给现有 onPublishPackageFile（复用其校验与 state 落位）。
  async function onPublishLooseFiles(input) {
    capturePublishDraft();
    var files = (input && input.files) ? Array.prototype.slice.call(input.files) : [];
    if (!files.length) return;
    if (!(window.TMZipStore && TMZipStore.buildZip && TMZipStore.planLoosePack)) { state.publishMessage = '页内打包模块未就绪。'; render(); return; }
    var pt = state.pubType || 'mod';
    var d = publishDraft();
    var title = d.title || publishFileBaseName(files[0]) || '未命名内容包';
    var metas = files.map(function (f, i) { return { name: f.name, size: f.size, index: i }; });
    var plan = TMZipStore.planLoosePack(pt, title, d.version || '1.0.0', d.desc || '', metas);
    if (!plan.targets.length) {
      state.publishMessage = '没有可打包的受支持文件（仅收图片 / 音频 / JSON 等）。' + (plan.skipped.length ? '已跳过 ' + plan.skipped.length + ' 个不支持的文件。' : '');
      render();
      return;
    }
    if (plan.totalSize > TMZipStore.LOOSE_MAX_TOTAL) {
      state.publishMessage = '⚠ 散文件总量 ' + formatBytes(plan.totalSize) + ' 超过 ' + formatBytes(TMZipStore.LOOSE_MAX_TOTAL) + '，网页安装端上限约 64MB。请拆分或压缩后再打包。';
      render();
      return;
    }
    state.publishMessage = '正在打包 ' + plan.targets.length + ' 个文件...';
    render();
    try {
      var entries = [];
      for (var i = 0; i < plan.targets.length; i++) {
        var t = plan.targets[i];
        var buf = await files[t.index].arrayBuffer();
        entries.push({ name: t.path, data: new Uint8Array(buf) });
      }
      entries.unshift({ name: 'manifest.json', data: new TextEncoder().encode(JSON.stringify(plan.manifest, null, 2)) });
      var zip = TMZipStore.buildZip(entries);
      var blob = new Blob([zip], { type: 'application/zip' });
      var packFile;
      try { packFile = new File([blob], plan.slug + '.tm-pack', { type: 'application/zip' }); }
      catch (e) { packFile = blob; try { packFile.name = plan.slug + '.tm-pack'; } catch (e2) {} }
      onPublishPackageFile({ files: [packFile] });
      var warn = plan.oversize.length ? '（含 ' + plan.oversize.length + ' 个大于 20MB 的大文件·网页安装可能较慢）' : '';
      var skip = plan.skipped.length ? '·已跳过 ' + plan.skipped.length + ' 个不支持文件' : '';
      state.publishMessage = '已打包 ' + plan.targets.length + ' 个文件为「' + packTypeLabel(pt) + '」投稿包（共 ' + formatBytes(zip.length) + '）' + warn + skip + '。填好商店信息即可提交。';
      render();
    } catch (e) {
      state.publishMessage = '打包失败：' + (e && e.message || '未知错误');
      render();
    }
  }

  function onPublishCoverFile(input) {
    capturePublishDraft();
    var file = input && input.files && input.files[0];
    revokeObjectUrl(state.publishCoverUrl);
    state.publishCoverFile = file || null;
    state.publishCoverUrl = file ? fileObjectUrl(file) : '';
    state.publishMessage = file ? ('已选择商店封面：' + fileLine(file)) : '';
    render();
  }

  function onPublishGalleryFiles(input) {
    capturePublishDraft();
    (state.publishGalleryUrls || []).forEach(revokeObjectUrl);
    var files = input && input.files ? Array.prototype.slice.call(input.files || []).filter(function(f){ return /^image\//.test(f.type || '') || /\.(png|jpe?g|webp|bmp)$/i.test(f.name || ''); }).slice(0, 6) : [];
    state.publishGalleryFiles = files;
    state.publishGalleryUrls = files.map(fileObjectUrl);
    state.publishMessage = files.length ? ('已选择展示图 ' + files.length + ' 张。') : '';
    render();
  }

  async function imagePayload(file) {
    if (!file) return null;
    var bytes = new Uint8Array(await file.arrayBuffer());
    return {
      name: String(file.name || 'image'),
      type: String(file.type || 'image/*'),
      size: Number(file.size || bytes.length || 0),
      contentBase64: bytesToBase64Local(bytes)
    };
  }

  // B2（批B）：上传进度节流判定（纯函数便于测试）——距上次重渲 ≥500ms 或 百分比变化 ≥5
  // 才重渲（防打字/滚动时高频 render 抖动）；100% 必渲（收尾态不吞）。
  function uploadProgressShouldRender(pct, lastPct, sinceMs) {
    if (pct >= 100) return true;
    return sinceMs >= 500 || Math.abs(pct - lastPct) >= 5;
  }

  async function submitWorkshopPublication() {
    var userOk = !!(window.TM && TM.OnlineClient && TM.OnlineClient.isLoggedIn && TM.OnlineClient.isLoggedIn());
    var d = capturePublishDraft();
    if (!userOk) { state.publishMessage = '请先登录账号再提交发布申请。'; render(); return; }
    if (!(window.TM && TM.OnlineClient && TM.OnlineClient.uploadPack)) { state.publishMessage = '在线工坊上传模块未就绪。'; render(); return; }
    var file = state.publishPackageFile;
    if (!file) { state.publishMessage = '请先导入 .tm-pack 或 .zip 投稿资源包。'; render(); return; }
    if (!/\.(tm-pack|zip)$/i.test(file.name || '')) { state.publishMessage = '投稿资源必须是 .tm-pack 或 .zip 压缩包。'; render(); return; }
    if (!d.title) { state.publishMessage = '请填写商店标题。'; render(); return; }
    if (!d.version) { state.publishMessage = '请填写版本号。'; render(); return; }
    if (!d.desc) { state.publishMessage = '请填写商店简介。'; render(); return; }
    state.publishMessage = '正在读取投稿资源包...';
    render();
    try {
      var bytes = new Uint8Array(await file.arrayBuffer());
      var cover = await imagePayload(state.publishCoverFile);
      var galleryFiles = (state.publishGalleryFiles || []).slice(0, 6);
      var gallery = [];
      for (var i = 0; i < galleryFiles.length; i++) gallery.push(await imagePayload(galleryFiles[i]));
      var type = state.pubType || 'mod';
      var meta = {
        title: d.title,
        id: '',
        version: d.version || '1.0.0',
        description: d.desc || '',
        type: type,
        tags: d.tags || '',
        filename: file.name || 'workshop-pack.zip',
        packageKind: 'direct-package',
        releaseNotes: d.notes || '',
        assets: [{ name: publishFileBaseName(file) || d.title }],
        coverImage: cover,
        galleryImages: gallery
      };
      if (state.forkSource && state.forkSource.id) meta.parentId = state.forkSource.id;
      // B2：大包（>30MB）提醒勿关页；上传进度经纯函数节流后回写 publishMessage。
      var bigPack = bytes.length > 30 * 1024 * 1024;
      var bigNote = bigPack ? '（大包上传可能较久，请勿关闭页面）' : '';
      state.publishMessage = '正在提交发布申请...' + bigNote;
      render();
      var lastRenderAt = 0, lastPct = -1;
      var onUploadProgress = function (p) {
        if (!p || !p.total) return;
        var pct = Math.max(0, Math.min(100, Math.round((p.loaded / p.total) * 100)));
        var now = Date.now();
        if (!uploadProgressShouldRender(pct, lastPct, now - lastRenderAt)) return;
        lastRenderAt = now; lastPct = pct;
        state.publishMessage = '正在上传投稿包… ' + pct + '%' + bigNote;
        render();
      };
      var res = await TM.OnlineClient.uploadPack(meta, bytesToBase64Local(bytes), state.onlineApiUrl || undefined, onUploadProgress);
      if (res && res.success) {
        state.forkSource = null;
        autoPostPublish((res.pack && res.pack.title) || d.title, type, res.pack && res.pack.id);
        state.publishMessage = '已提交发布申请：' + ((res.pack && res.pack.title) || d.title) + '（待审核）。';
        await loadWorkshopCatalog();
      } else {
        state.publishMessage = '提交失败：' + ((res && res.error) || '未知错误');
        render();
      }
    } catch (e) {
      state.publishMessage = '提交失败：' + (e && e.message || '读取资源包失败');
      render();
    }
  }

  function resetPublicationDraft() {
    revokeObjectUrl(state.publishCoverUrl);
    (state.publishGalleryUrls || []).forEach(revokeObjectUrl);
    state.publishDraft = { version: '1.0.0', title: '', tags: '', desc: '', notes: '' };
    state.publishPackageFile = null;
    state.publishCoverFile = null;
    state.publishCoverUrl = '';
    state.publishGalleryFiles = [];
    state.publishGalleryUrls = [];
    state.publishMessage = '';
    render();
  }

  // P1-S2c：网页发布资产包（立绘/音乐/地图/MOD）—— 浏览器内打 store-zip + assets 清单 → uploadPack。
  async function webPublishAssetPack() {
    if (!(window.TM && TM.OnlineClient && TM.OnlineClient.isLoggedIn())) { state.publishMessage = '请先登录账号再发布。'; render(); return; }
    if (!window.TMZipStore) { state.publishMessage = '打包模块未就绪。'; render(); return; }
    var pt = state.pubType || 'portrait';
    var titleEl = document.getElementById('tm-webpub-title');
    var verEl = document.getElementById('tm-webpub-version');
    var tagsEl = document.getElementById('tm-webpub-tags');
    var descEl = document.getElementById('tm-webpub-desc');
    var filesEl = document.getElementById('tm-asset-files');
    var title = titleEl ? titleEl.value.trim() : '';
    var files = filesEl ? Array.prototype.slice.call(filesEl.files || []) : [];
    if (!title) { state.publishMessage = '请填写标题。'; render(); return; }
    if (!files.length) { state.publishMessage = '请选择资源文件。'; render(); return; }
    state.publishMessage = '正在打包 ' + files.length + ' 个文件...';
    render();
    try {
      var entries = [];
      for (var i = 0; i < files.length; i++) {
        var buf = await files[i].arrayBuffer();
        entries.push({ name: files[i].name, data: new Uint8Array(buf) });
      }
      var assets = files.map(function(f){ return { name: String(f.name).replace(/\.[^.]+$/, '') }; });
      // 批Ⅱ刀A(2026-07-22)：zip 内置 manifest.json——桌面安装器 validateWorkshopPack 强制要求·
      // 旧版裸文件 zip 在桌面「工坊包缺少 manifest.json」装不上。id 与服务器同规则预生成·
      // files 带真实文件名(含扩展名·BGM 生效链靠它定位曲目)。
      var packIdSlug = String(title).trim().toLowerCase().replace(/[^a-z0-9_\-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)
        || ('pack-' + Date.now().toString(36).slice(-6));
      var manifest = {
        id: packIdSlug,
        title: title,
        type: pt,
        version: (verEl && verEl.value.trim()) || '1.0.0',
        description: (descEl && descEl.value.trim()) || '',
        entry: files[0] ? String(files[0].name) : '',
        assets: assets,
        files: files.map(function(f){ return String(f.name); })
      };
      entries.unshift({ name: 'manifest.json', data: new TextEncoder().encode(JSON.stringify(manifest, null, 2)) });
      var zip = TMZipStore.buildZip(entries);
      var b64 = TMZipStore.bytesToBase64(zip);
      var meta = {
        title: title, id: packIdSlug,
        version: (verEl && verEl.value.trim()) || '1.0.0',
        description: (descEl && descEl.value.trim()) || '',
        type: pt,
        tags: tagsEl ? tagsEl.value : '',
        assets: assets,
        packageKind: 'store-zip',
        filename: 'pack.zip'
      };
      var res = await TM.OnlineClient.uploadPack(meta, b64, state.onlineApiUrl || undefined);
      if (res && res.success) {
        autoPostPublish(title, pt, meta.id);
        state.publishMessage = '已提交「' + title + '」（待审核，含 ' + files.length + ' 个资源，共 ' + formatBytes(zip.length) + '）。';
      } else {
        state.publishMessage = '发布失败：' + ((res && res.error) || '未知错误');
      }
    } catch (e) {
      state.publishMessage = '发布失败：' + (e && e.message || '打包错误');
    }
    render();
  }

  // P3-S1：取消改编源。
  function clearFork() { state.forkSource = null; state.publishMessage = ''; render(); }

  // P4-S1 AI 共创：起草剧本骨架（外接演绎脑优先，无则本地占位起草）。
  function aiDraftFallback(prompt) {
    return {
      name: String(prompt).slice(0, 24) || 'AI 草稿',
      overview: String(prompt),
      background: String(prompt),
      characters: [{ id: 'pc', name: '主君', role: '君主' }],
      factions: [],
      _aiDraft: true
    };
  }
  async function aiDraftScenario() {
    var el = document.getElementById('tm-ai-prompt');
    var prompt = el ? el.value.trim() : '';
    if (!prompt) { state.aiDraftMsg = '请先描述你想要的剧本。'; render(); return; }
    state.aiDraftMsg = '演绎脑起草中…'; state.aiDraft = null; render();
    try {
      var draft = null;
      if (window.TM && TM.AuthoringAgent && typeof TM.AuthoringAgent.draftScenario === 'function') {
        draft = await TM.AuthoringAgent.draftScenario(prompt);
      } else {
        draft = aiDraftFallback(prompt);
      }
      if (draft && draft.name) { state.aiDraft = draft; state.aiDraftMsg = '草稿已生成，可直接发布，或先到编辑器细化。'; }
      else state.aiDraftMsg = '起草未返回有效草稿。';
    } catch (e) { state.aiDraftMsg = '起草失败：' + (e && e.message || ''); }
    render();
  }
  function useAiDraft() {
    if (!state.aiDraft) return;
    if (!window.P) window.P = {};
    if (!Array.isArray(P.scenarios)) P.scenarios = [];
    var base = String(state.aiDraft.name || 'draft').replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase().replace(/^-+|-+$/g, '') || 'draft';
    var id = 'ai-' + base + '-' + Math.floor(Math.random() * 1e6);
    var scn = Object.assign({ id: id }, state.aiDraft);
    P.scenarios.push(scn);
    var name = scn.name || '';
    state.publishMessage = 'AI 草稿已载入剧本库，确认下方信息后即可发布。';
    state.aiDraft = null; state.aiDraftMsg = '';
    render();
    setTimeout(function(){
      var sel = document.getElementById('tm-webpub-scn'); if (sel) sel.value = id;
      var t = document.getElementById('tm-webpub-title'); if (t && !t.value) t.value = name;
    }, 0);
  }

  function scenarioIdExists(id) {
    return (window.P && Array.isArray(P.scenarios)) && P.scenarios.some(function(s){ return s && s.id === id; });
  }

  function uniqueScenarioId(base, packId) {
    var id = String(base || packId || 'workshop');
    if (!scenarioIdExists(id)) return id;
    var next = packId + '-' + id;
    var i = 2;
    while (scenarioIdExists(next)) next = packId + '-' + id + '-' + (i++);
    return next;
  }

  function mergeArray(key, arr, sidMap, defaultSid, packId) {
    if (!Array.isArray(arr)) return;
    if (!Array.isArray(P[key])) P[key] = [];
    arr.forEach(function(item){
      if (!item || typeof item !== 'object') return;
      var copy = Object.assign({}, item);
      if (copy.sid && sidMap[copy.sid]) copy.sid = sidMap[copy.sid];
      else if (!copy.sid && defaultSid) copy.sid = defaultSid;
      copy._workshopPackId = packId;
      P[key].push(copy);
    });
  }

  function clearWorkshopPack(packId) {
    if (!window.P) return;
    [
      'scenarios','characters','factions','parties','classes','variables','events','relations','rules',
      'items','cities','territories','externalForces','goals'
    ].forEach(function(key){
      if (Array.isArray(P[key])) P[key] = P[key].filter(function(x){ return !x || x._workshopPackId !== packId; });
    });
  }

  function rewriteWorkshopAssets(pack, value) {
    var base = pack && pack.assetBase;
    if (!base) return value;
    if (typeof value === 'string') {
      var v = value.trim();
      var isAsset = /\.(png|jpe?g|webp|bmp|mp3|ogg|wav|geojson|json)(\?.*)?$/i.test(v);
      var isPackRelative = v.indexOf('./') === 0 || v.indexOf('@pack/') === 0 || v.indexOf('pack-assets/') === 0 || v.indexOf('workshop-assets/') === 0;
      var isExternal = /^(https?:|data:|blob:|file:|tm-content:|\/)/i.test(v);
      if (isAsset && isPackRelative && !isExternal) {
        v = v.replace(/^\.\//, '').replace(/^@pack\//, '');
        return base + v.split('/').map(encodeURIComponent).join('/');
      }
      return value;
    }
    if (Array.isArray(value)) return value.map(function(item){ return rewriteWorkshopAssets(pack, item); });
    if (value && typeof value === 'object') {
      var out = {};
      Object.keys(value).forEach(function(k){ out[k] = rewriteWorkshopAssets(pack, value[k]); });
      return out;
    }
    return value;
  }

  function mergeScenarioData(pack, data) {
    if (!window.P || !data) return 0;
    data = rewriteWorkshopAssets(pack, data);
    clearWorkshopPack(pack.id);
    var sidMap = {};
    var defaultSid = '';
    var scenarios = Array.isArray(data.scenarios) ? data.scenarios : null;
    if (!scenarios) {
      var single = Object.assign({}, data);
      single.id = data.id || pack.id;
      single.era = data.era || data.dynasty || '';
      single.name = data.name || data.title || pack.title;
      single.role = data.role || data.emperor || '';
      single.background = data.background || data.overview || '';
      single.desc = data.desc || data.overview || data.background || '';
      single.overview = data.overview || data.background || '';
      single.opening = data.opening || data.openingText || '';
      single.active = data.active !== false;
      scenarios = [single];
    }
    if (!Array.isArray(P.scenarios)) P.scenarios = [];
    scenarios.forEach(function(sc, idx){
      if (!sc || typeof sc !== 'object') return;
      var oldId = sc.id || pack.id + '-' + idx;
      var newId = uniqueScenarioId(oldId, pack.id);
      sidMap[oldId] = newId;
      if (!defaultSid) defaultSid = newId;
      var copy = Object.assign({}, sc, { id: newId, _workshopPackId: pack.id, _workshopTitle: pack.title });
      P.scenarios.push(copy);
    });
    ['characters','factions','parties','classes','variables','events','relations','rules','items','cities','territories','externalForces','goals'].forEach(function(key){
      mergeArray(key, data[key], sidMap, defaultSid, pack.id);
    });
    try { if (typeof buildIndices === 'function') buildIndices(); } catch(e) {}
    return scenarios.length;
  }

  // 网页：从独立工坊库重新合并已安装剧本到 P.scenarios（启动 + 每次开「选择剧本」前调用，
  // 抗 restoreP 等启动期对 P 的覆写）。mergeScenarioData 内含 clearWorkshopPack，幂等可重入。
  async function loadWorkshopScenariosWeb(silent) {
    if (!window.P) return;
    try {
      var records = await wsGetAll();
      var count = 0;
      (records || []).forEach(function(rec){
        if (rec && rec.enabled !== false && rec.data) {
          count += mergeScenarioData({ id: rec.packId, title: rec.title, assetBase: '' }, rec.data);
        }
      });
      if (count && !silent) say('已载入工坊剧本 ' + count + ' 个');
    } catch(e) {
      console.warn('[TMContentManager] web load workshop failed', e);
    }
  }

  async function loadWorkshopScenarios(silent) {
    if (!window.P) return;
    if (!desktop()) return loadWorkshopScenariosWeb(silent);
    if (!window.tianming.loadEnabledWorkshopScenarios) return;
    try {
      if (window.tianming.listWorkshopPacks) {
        var list = await window.tianming.listWorkshopPacks();
        if (list && list.success) state.packs = list.packs || state.packs || [];
      }
      (state.packs || []).forEach(function(pack){
        if (pack && pack.id) clearWorkshopPack(pack.id);
      });
      var res = await window.tianming.loadEnabledWorkshopScenarios();
      if (!res || !res.success) return;
      var count = 0;
      (res.scenarios || []).forEach(function(item){
        if (item && item.pack && item.data) count += mergeScenarioData(item.pack, item.data);
      });
      if (count && !silent) say('已载入工坊剧本 ' + count + ' 个');
    } catch(e) {
      console.warn('[TMContentManager] load workshop failed', e);
    }
  }

  //>>CM-SPLIT20-PLUMBING-B-START  (reverse：origin→分片·全部 kept 成员已定义于此点之前)
  __cmP.PACK_TYPES = PACK_TYPES; __cmP.action = action; __cmP.catalogCardV2 = catalogCardV2; __cmP.checkHotUpdate = checkHotUpdate; __cmP.desktop = desktop; __cmP.downloadUpdate = downloadUpdate;
  __cmP.ensureStyle = ensureStyle; __cmP.esc = esc; __cmP.formatBytes = formatBytes; __cmP.installHotUpdate = installHotUpdate; __cmP.installUpdate = installUpdate; __cmP.jsArg = jsArg;
  __cmP.kv = kv; __cmP.loadCatalogUrl = loadCatalogUrl; __cmP.loadFeedUrl = loadFeedUrl; __cmP.loadHotFeedUrl = loadHotFeedUrl; __cmP.loadOnlineApiUrl = loadOnlineApiUrl; __cmP.packRowV2 = packRowV2;
  __cmP.packTypeLabel = packTypeLabel; __cmP.packTypeNoun = packTypeNoun; __cmP.pill = pill; __cmP.pwField = pwField; __cmP.refreshWebInstalled = refreshWebInstalled; __cmP.reloadAfterHotUpdate = reloadAfterHotUpdate;
  __cmP.render = render; __cmP.state = state; __cmP.updateInfoSize = updateInfoSize;
  //>>CM-SPLIT20-PLUMBING-B-END
  window.openContentManager = openContentManager;
  window.TMContentManager = {
    open: openContentManager,
    close: function(){ var bg = document.getElementById('tm-content-bg'); if (bg) bg.style.display = 'none'; },
    switchTab: function(tab){ state.tab = tab || 'online'; render(); },
    checkOnlineService: checkOnlineService,
    checkGameUpdate: checkGameUpdate,
    checkUpdate: checkUpdate,
    downloadUpdate: downloadUpdate,
    installUpdate: installUpdate,
    refreshHotStatus: refreshHotStatus,
    checkHotUpdate: checkHotUpdate,
    installHotUpdate: installHotUpdate,
    toggleHotUpdate: toggleHotUpdate,
    rollbackHotUpdate: rollbackHotUpdate,
    reloadAfterHotUpdate: reloadAfterHotUpdate,
    refreshPacks: refreshPacks,
    importPack: importPack,
    togglePack: togglePack,
    uninstallPack: uninstallPack,
    loadWorkshopCatalog: loadWorkshopCatalog,
    refreshWorkshopSources: function(){ return refreshWorkshopSources(true); },
    ratePack: ratePack,
    checkWorkshopUpdates: checkWorkshopUpdates,
    updateWorkshopPack: updateWorkshopPack,
    openMapPackInEditor: openMapPackInEditor,
    updateAllWorkshop: updateAllWorkshop,
    uninstallWebPack: uninstallWebPack,
    loadAuthorPacks: loadAuthorPacks,
    installCatalogPack: installCatalogPack,
    resumePlay: resumePlay,
    openPackDetail: openPackDetail,
    closePackDetail: closePackDetail,
    toggleFavorite: toggleFavorite,
    toggleFollow: toggleFollow,
    postPackComment: postPackComment,
    addFriend: addFriend,
    respondFriend: respondFriendUI,
    removeFriend: removeFriendUI,
    refreshFriends: function(){ state.friendsLoaded = false; state.friendsLoading = false; loadFriends(); },
    openDmInbox: openDmInbox,
    openDm: openDm,
    openDmFromNotif: openDmFromNotif,
    closeDm: closeDm,
    sendDm: sendDm,
    markNotif: markNotif,
    markAllNotif: markAllNotif,
    refreshNotifs: refreshNotifs,
    loadLineage: loadLineage,
    endorsePack: endorsePack,
    forkPack: forkPack,
    openChronicles: openChronicles,
    closeChronicles: closeChronicles,
    relayChronicle: relayChronicle,
    viewChroniclesChain: viewChroniclesChain,
    publishChronicleUI: publishChronicleUI,
    toggleFeatured: function(){ state.featuredOn = !state.featuredOn; if (state.featuredOn) { state.pane = 'browse'; loadFeatured(); } else render(); },
    switchFeedScope: function(s){ state.feedScope = s || 'recommend'; state.feedLoaded = false; state.feedMsg = ''; loadFeed(); },
    refreshFeed: function(){ state.feedLoaded = false; state.feedMsg = ''; loadFeed(); },
    submitFeedPost: submitFeedPost,
    likeFeedPost: likeFeedPost,
    openArena: openArena,
    closeArena: closeArena,
    createArenaUI: createArenaUI,
    submitArenaUI: submitArenaUI,
    openCollection: openCollection,
    closeCollection: closeCollection,
    createCollectionUI: createCollectionUI,
    createMyCollectionUI: createMyCollectionUI,
    openCollectionPicker: openCollectionPicker,
    closeCollectionPicker: closeCollectionPicker,
    pickCollection: pickCollection,
    quickCreateCollection: quickCreateCollection,
    openCircle: openCircle,
    closeCircle: closeCircle,
    createCircleUI: createCircleUI,
    toggleCircleJoin: toggleCircleJoin,
    postToCircle: postToCircle,
    proposeRevisionUI: proposeRevisionUI,
    respondRevisionUI: respondRevisionUI,
    postCommissionUI: postCommissionUI,
    closeCommissionUI: closeCommissionUI,
    switchCatalogType: function(t){ state.catalogType = t || ''; state.featuredOn = false; render(); },
    switchPane: function(p){ state.pane = p || 'discover'; render(); },
    switchMeTab: function(t){ state.meTab = t || 'home'; render(); },
    refreshInstalled: function(){ state.installedLoaded = false; loadInstalled(); },
    mallSearch: function(q){ if (q != null) state.catalogQuery = String(q).trim(); state.pane = 'browse'; loadWorkshopCatalog(); },
    playTrack: function(i){ state.detailPlaying = (state.detailPlaying === i ? -1 : i); render(); },
    publishWorkshopPack: publishWorkshopPack,
    webPublishScenario: webPublishScenario,
    webPublishAssetPack: webPublishAssetPack,
    onAssetFiles: onAssetFiles,
    onPublishPackageFile: onPublishPackageFile,
    onPublishLooseFiles: onPublishLooseFiles,
    onPublishCoverFile: onPublishCoverFile,
    onPublishGalleryFiles: onPublishGalleryFiles,
    submitWorkshopPublication: submitWorkshopPublication,
    resetPublicationDraft: resetPublicationDraft,
    clearFork: clearFork,
    aiDraftScenario: aiDraftScenario,
    useAiDraft: useAiDraft,
    switchPubType: function(t){ capturePublishDraft(); state.pubType = t || 'mod'; state.publishMessage = ''; render(); },
    accountLogin: accountLogin,
    accountEmailCodeRequest: accountEmailCodeRequest,
    accountEmailLogin: accountEmailLogin,
    accountRegister: accountRegister,
    accountRefresh: accountRefresh,
    accountLogout: accountLogout,
    accountTogglePw: function(){ state.accountPwOpen = !state.accountPwOpen; render(); },
    togglePw: function(id, btn){ var el = document.getElementById(id); if (!el) return; var show = el.type === 'password'; el.type = show ? 'text' : 'password'; if (btn) btn.textContent = show ? '隐藏' : '显示'; },
    toggleReset: toggleReset,
    accountRequestReset: accountRequestReset,
    accountReset: accountReset,
    accountSetEmail: accountSetEmail,
    applyUpdateFromChangelog: openApplyUpdateFromChangelog,
    closeApplyUpdate: closeApplyUpdate,
    reloadAppliedUpdate: reloadAppliedUpdate,
    installDownloadedUpdate: installDownloadedUpdate,
    openHotUpdateDir: function(){ return window.tianming.openHotUpdateDir(); },
    openWorkshopDir: function(){ return window.tianming.openWorkshopDir(); },
    openFormatDoc: function(){ window.open('docs/workshop-pack-format.md', '_blank'); },
    openHotFormatDoc: function(){ window.open('docs/hot-update-format.md', '_blank'); },
    loadWorkshopScenarios: loadWorkshopScenarios
  };

  if (desktop() && window.tianming.onUpdateStatus) {
    try {
      window.tianming.onUpdateStatus(function(status){
        state.status = status || state.status;
        if (state.applyUpdate && state.applyUpdate.open && status) {
          if (status.kind === 'download-progress' && status.progress) {
            var pct = Math.max(0, Math.min(100, Math.round(status.progress.percent || 0)));
            updateApplyState({ progress: Math.max(45, pct), message: '正在下载本体更新 ' + pct + '%', size: updateInfoSize(status.info || state.status && state.status.info) || state.applyUpdate.size || 0 });
          } else if (status.kind === 'downloaded') {
            updateApplyState({ progress: 100, message: '本体更新已下载，等待安装重启。', canInstall: true, busy: false }, '本体更新下载完成。');
          } else if (status.kind === 'error') {
            updateApplyState({ stage: 'error', progress: 100, message: '本体更新失败：' + (status.error || '未知错误'), busy: false }, '本体更新失败。');
          }
        }
        var bg = document.getElementById('tm-content-bg');
        if (bg && bg.style.display !== 'none') render();
      });
    } catch(e) {}
  }

  if (desktop() && window.tianming.onHotUpdateStatus) {
    try {
      window.tianming.onHotUpdateStatus(function(status){
        state.hotMessage = hotStatusText(status) || state.hotMessage;
        if (status && status.status) state.hotStatus = status.status;
        // 2026-07-07·结构化进度·更新中心 hero 进度条用（此前只有一行文案·大包下载无进度观感差）
        if (status) {
          var pk = status.kind;
          if (pk === 'download-start') state.hotProgress = { label: '下载更新包', pct: 0 };
          else if (pk === 'download-progress') state.hotProgress = { label: '下载更新包', pct: Math.round(status.percent || 0) };
          else if (pk === 'incremental-plan') state.hotProgress = { label: '增量下载', pct: 0 };
          else if (pk === 'incremental-progress') state.hotProgress = { label: '增量下载', pct: status.fetchBytes ? Math.round((status.bytesDone || 0) * 100 / status.fetchBytes) : Math.round((status.done || 0) * 100 / Math.max(1, status.total || 1)) };
          else if (pk === 'rebaseline-start') state.hotProgress = { label: '校验本地文件', pct: 0 };
          else if (pk === 'rebaseline-scan') state.hotProgress = { label: '校验本地文件', pct: Math.round((status.scanned || 0) * 100 / Math.max(1, status.total || 1)) };
          else if (pk === 'downloaded' || pk === 'verifying') state.hotProgress = { label: '校验', pct: 96 };
          else if (pk === 'installed' || pk === 'error') state.hotProgress = null;
        }
        if (state.applyUpdate && state.applyUpdate.open && status) {
          if (status.kind === 'download-start') {
            updateApplyState({ progress: 18, message: '正在下载前端热更...', size: status.size || state.applyUpdate.size || 0 }, '开始下载前端热更。');
          } else if (status.kind === 'download-progress') {
            var pct = Math.max(0, Math.min(100, Math.round(status.percent || 0)));
            updateApplyState({ progress: Math.max(18, Math.min(70, pct)), message: '正在下载前端热更 ' + pct + '%', size: status.size || state.applyUpdate.size || 0 });
          } else if (status.kind === 'rebaseline-start' || status.kind === 'incremental-start') {
            updateApplyState({ progress: 20, message: hotStatusText(status) }, hotStatusText(status));
          } else if (status.kind === 'rebaseline-scan') {
            var spct = Math.round((status.scanned || 0) * 100 / Math.max(1, status.total || 1));
            updateApplyState({ progress: Math.max(20, Math.min(40, 20 + spct / 5)), message: '校验本地文件 ' + spct + '%（只补差异）' });
          } else if (status.kind === 'incremental-plan') {
            updateApplyState({ progress: 42, message: hotStatusText(status) }, hotStatusText(status));
          } else if (status.kind === 'incremental-progress') {
            var ipct = status.fetchBytes ? Math.round((status.bytesDone || 0) * 100 / status.fetchBytes) : 0;
            updateApplyState({ progress: Math.max(42, Math.min(70, 42 + ipct * 0.28)), message: '增量下载 ' + ipct + '%（' + (status.done || 0) + '/' + (status.total || 0) + ' 文件）' });
          } else if (status.kind === 'downloaded') {
            updateApplyState({ progress: 72, message: '热更包已下载，正在校验。' }, '热更包下载完成。');
          } else if (status.kind === 'verifying') {
            updateApplyState({ progress: 84, message: '正在校验热更文件。' }, '校验热更文件。');
          } else if (status.kind === 'installed') {
            updateApplyState({ progress: 100, message: '前端热更已安装，重载前端后生效。', busy: false, canReload: true }, '前端热更安装完成。');
          } else if (status.kind === 'error') {
            updateApplyState({ stage: 'error', progress: 100, message: '前端热更失败：' + (status.error || '未知错误'), busy: false }, '前端热更失败。');
          }
        }
        var bg = document.getElementById('tm-content-bg');
        if (bg && bg.style.display !== 'none') render();
      });
    } catch(e) {}
  }

  setTimeout(function(){
    loadWorkshopScenarios(false);
    if (typeof window.showScnSelect === 'function' && !window.showScnSelect._tmWorkshopWrapped) {
      var oldShowScnSelect = window.showScnSelect;
      window.showScnSelect = function(){
        var args = arguments;
        return Promise.resolve(loadWorkshopScenarios(true)).then(function(){
          return oldShowScnSelect.apply(window, args);
        });
      };
      window.showScnSelect._tmWorkshopWrapped = true;
    }
  }, 0);

  // 剧本工坊编辑器「创意工坊」入口(2026-07-21)：?tmOpenWorkshop=1 → 载入后自动开内容管理·在线目录页。
  // 开完即 replaceState 剥参·防之后任何刷新都再弹。任何一步失手静默(入口便利·非关键路径)。
  try {
    if (/[?&]tmOpenWorkshop=1/.test(window.location.search)) {
      window.addEventListener('load', function () {
        setTimeout(function () {
          try {
            if (window.TMContentManager && typeof TMContentManager.open === 'function') {
              TMContentManager.open();
              if (typeof TMContentManager.switchTab === 'function') TMContentManager.switchTab('online');
            }
            if (window.history && typeof history.replaceState === 'function') {
              history.replaceState(null, '', window.location.pathname + window.location.hash);
            }
          } catch (_eOW) {}
        }, 1200);
      });
    }
  } catch (_eOWq) {}
})();
