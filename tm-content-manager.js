// Tianming desktop content manager: updates + workshop packs.
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
    catalogMessage: '',
    publishMessage: '',
    onlineApiUrl: '',
    defaultOnlineApiUrl: '',
    onlineStatus: null,
    onlineMessage: '',
    accountSession: null,
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

  function desktop() {
    return !!(window.tianming && window.tianming.isDesktop);
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
      '.tm-online-shell-bg{position:fixed;inset:0;z-index:2600;background:radial-gradient(circle at 18% 12%,rgba(174,41,33,.22),transparent 28%),rgba(3,2,1,.86);display:none;align-items:center;justify-content:center;backdrop-filter:blur(5px);}',
      '.tm-online-shell{width:min(1040px,94vw);height:min(760px,88vh);display:grid;grid-template-rows:auto 1fr;background:linear-gradient(145deg,rgba(34,20,14,.98),rgba(10,7,5,.98));border:1px solid rgba(214,177,93,.58);box-shadow:0 24px 80px rgba(0,0,0,.68),inset 0 0 0 1px rgba(255,238,184,.05);color:var(--txt,#eadfcb);overflow:hidden;}',
      '.tm-online-head{display:grid;grid-template-columns:1fr auto;gap:1rem;padding:1rem 1.1rem .9rem;border-bottom:1px solid rgba(214,177,93,.28);background:linear-gradient(90deg,rgba(90,28,19,.32),rgba(0,0,0,.08));}',
      '.tm-online-title{font-size:1.05rem;font-weight:800;color:var(--gold,#d8b56a);letter-spacing:0;}',
      '.tm-online-sub{margin-top:.25rem;font-size:.74rem;line-height:1.45;color:rgba(234,223,203,.68);}',
      '.tm-online-tabs{display:flex;gap:.35rem;align-items:flex-end;flex-wrap:wrap;padding:.75rem 1rem 0;background:rgba(0,0,0,.12);}',
      '.tm-tab{min-height:40px;padding:.5rem .85rem;border:1px solid rgba(214,177,93,.28);background:rgba(0,0,0,.2);color:rgba(234,223,203,.74);cursor:pointer;transition:background .18s ease,border-color .18s ease,color .18s ease;}',
      '.tm-tab:hover{background:rgba(214,177,93,.12);color:#f6e5b7;}',
      '.tm-tab.is-active{background:linear-gradient(180deg,rgba(142,38,28,.86),rgba(63,20,15,.92));border-color:rgba(214,177,93,.72);color:#ffe3a1;}',
      '.tm-online-shell>div:last-child{min-height:0;display:grid;grid-template-rows:auto 1fr;}',
      '.tm-online-body{min-height:0;padding:1rem;overflow:auto;}',
      '.tm-grid-2{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(280px,.9fr);gap:.8rem;}',
      '.tm-grid-3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.55rem;}',
      '.tm-panel{border:1px solid rgba(214,177,93,.25);background:linear-gradient(180deg,rgba(255,244,199,.055),rgba(0,0,0,.13));padding:.9rem;min-width:0;}',
      '.tm-panel h4{margin:0 0 .65rem;color:var(--gold,#d8b56a);font-size:.92rem;font-weight:800;}',
      '.tm-copy{font-size:.76rem;line-height:1.65;color:rgba(234,223,203,.72);}',
      '.tm-field{display:grid;gap:.28rem;margin-top:.65rem;}',
      '.tm-field label{font-size:.72rem;color:rgba(214,177,93,.92);}',
      '.tm-input{min-height:42px;width:100%;box-sizing:border-box;border:1px solid rgba(214,177,93,.32);background:rgba(0,0,0,.28);color:#f4ead6;padding:.55rem .65rem;outline:none;}',
      '.tm-input:focus{border-color:rgba(214,177,93,.82);box-shadow:0 0 0 2px rgba(214,177,93,.14);}',
      '.tm-actions{display:flex;gap:.45rem;flex-wrap:wrap;margin-top:.75rem;}',
      '.tm-action{min-height:42px;padding:.5rem .82rem;border:1px solid rgba(214,177,93,.34);background:rgba(0,0,0,.18);color:#eadfcb;cursor:pointer;transition:transform .15s ease,background .18s ease,border-color .18s ease;}',
      '.tm-action:hover{background:rgba(214,177,93,.12);border-color:rgba(214,177,93,.62);}',
      '.tm-action:active{transform:translateY(1px);}',
      '.tm-action.primary{background:linear-gradient(180deg,#b74635,#7f241d);border-color:#d9b96b;color:#fff1c2;}',
      '.tm-action.danger{background:rgba(119,29,23,.7);border-color:rgba(231,105,82,.55);color:#ffd9ce;}',
      '.tm-action.disabled,.tm-action:disabled{opacity:.46;cursor:not-allowed;}',
      '.tm-status{margin-top:.7rem;border-left:3px solid rgba(214,177,93,.7);background:rgba(214,177,93,.08);padding:.58rem .7rem;font-size:.78rem;line-height:1.6;color:#e8d49d;}',
      '.tm-status.warn{border-left-color:#d66e4d;background:rgba(173,45,30,.16);color:#ffd6c7;}',
      '.tm-kv{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.45rem;}',
      '.tm-kv div,.tm-card{border:1px solid rgba(214,177,93,.18);background:rgba(0,0,0,.18);padding:.58rem .65rem;min-width:0;}',
      '.tm-kv small{display:block;color:rgba(234,223,203,.55);font-size:.68rem;margin-bottom:.18rem;}',
      '.tm-kv b{color:#f2d487;font-size:.8rem;font-weight:700;word-break:break-all;}',
      '.tm-pill{display:inline-flex;align-items:center;min-height:24px;padding:0 .55rem;border:1px solid rgba(214,177,93,.35);background:rgba(214,177,93,.1);color:#f0d58a;font-size:.68rem;}',
      '.tm-pill.good{border-color:rgba(99,186,132,.5);background:rgba(50,128,79,.16);color:#bfe7c8;}',
      '.tm-pill.off{border-color:rgba(180,78,61,.48);background:rgba(120,31,23,.16);color:#f0b7a8;}',
      '.tm-pack-list{display:grid;gap:.55rem;margin-top:.65rem;}',
      '.tm-pack{border:1px solid rgba(214,177,93,.22);background:linear-gradient(90deg,rgba(56,26,17,.7),rgba(11,8,6,.78));padding:.72rem;display:grid;grid-template-columns:1fr auto;gap:.65rem;align-items:start;}',
      '.tm-pack-title{font-weight:800;color:#f1d58a;}',
      '.tm-pack-meta{font-size:.7rem;color:rgba(234,223,203,.58);margin-top:.16rem;}',
      '.tm-pack-desc{font-size:.76rem;line-height:1.55;color:rgba(234,223,203,.76);margin-top:.42rem;}',
      '.tm-empty{padding:1rem;border:1px dashed rgba(214,177,93,.25);color:rgba(234,223,203,.58);font-size:.78rem;text-align:center;}',
      '.tm-progress{height:7px;background:rgba(255,255,255,.08);border:1px solid rgba(214,177,93,.22);margin-top:.5rem;overflow:hidden;}',
      '.tm-progress i{display:block;height:100%;background:linear-gradient(90deg,#a92f25,#d9b96b);}',
      '.tm-account-seal{display:grid;place-items:center;min-height:138px;border:1px solid rgba(214,177,93,.22);background:radial-gradient(circle,rgba(157,39,28,.35),rgba(0,0,0,.08) 62%);color:#f0d58a;font-size:.85rem;text-align:center;padding:1rem;}',
      '.tm-update-ritual{position:fixed;inset:0;z-index:2700;display:none;align-items:center;justify-content:center;background:radial-gradient(circle at 50% 20%,rgba(154,47,34,.24),transparent 30%),rgba(2,1,1,.86);backdrop-filter:blur(5px);}',
      '.tm-update-ritual.show{display:flex;}',
      '.tm-update-box{width:min(900px,92vw);max-height:min(740px,90vh);display:grid;grid-template-rows:auto minmax(0,1fr) auto;background:linear-gradient(180deg,rgba(42,24,17,.98),rgba(10,7,5,.99));border:1px solid rgba(214,177,93,.7);box-shadow:0 28px 82px rgba(0,0,0,.72),inset 0 0 0 1px rgba(255,238,184,.07);color:#eadfcb;}',
      '.tm-update-title{padding:1rem 1.1rem;border-bottom:1px solid rgba(214,177,93,.28);display:flex;justify-content:space-between;gap:.8rem;align-items:flex-start;background:linear-gradient(90deg,rgba(138,38,28,.34),rgba(0,0,0,.08));}',
      '.tm-update-title b{display:block;color:#f2d487;font-size:1.05rem;}',
      '.tm-update-title span{display:block;margin-top:.25rem;color:rgba(234,223,203,.66);font-size:.74rem;line-height:1.45;}',
      '.tm-update-body{min-height:0;overflow:auto;padding:1rem;display:grid;gap:.8rem;}',
      '.tm-update-progress{height:11px;background:rgba(255,255,255,.08);border:1px solid rgba(214,177,93,.32);overflow:hidden;}',
      '.tm-update-progress i{display:block;height:100%;background:linear-gradient(90deg,#a83226,#d8b56a);transition:width .18s ease;}',
      '.tm-update-log{max-height:120px;overflow:auto;border:1px solid rgba(214,177,93,.18);background:rgba(0,0,0,.22);padding:.55rem .65rem;font-size:.72rem;line-height:1.55;color:rgba(234,223,203,.66);}',
      '.tm-update-foot{padding:.85rem 1rem;border-top:1px solid rgba(214,177,93,.25);display:flex;justify-content:space-between;gap:.7rem;flex-wrap:wrap;background:rgba(0,0,0,.18);}',
      '@media (max-width:860px){.tm-online-shell{height:92vh}.tm-grid-2,.tm-grid-3{grid-template-columns:1fr}.tm-pack{grid-template-columns:1fr}.tm-online-head{grid-template-columns:1fr}.tm-kv{grid-template-columns:1fr}}',
      '@media (prefers-reduced-motion:reduce){.tm-tab,.tm-action{transition:none!important}.tm-action:active{transform:none!important}}'
    ].join('\n');
    document.head.appendChild(css);
  }

  function action(label, onclick, tone, disabled) {
    return '<button class="tm-action ' + (tone || '') + (disabled ? ' disabled' : '') + '" ' + (disabled ? 'disabled ' : '') + 'onclick="' + onclick + '">' + esc(label) + '</button>';
  }

  function pill(label, cls) {
    return '<span class="tm-pill ' + (cls || '') + '">' + esc(label) + '</span>';
  }

  function renderUpdateTab() {
    var s = state.status || {};
    var url = state.feedUrl || '';
    var status = s.message || s.error || '';
    var progressHtml = '';
    var notes = releaseNotes(s.info);
    if (s.kind === 'checking') status = '正在检查更新...';
    else if (s.kind === 'available' && s.info) status = '发现新版本 ' + s.info.version + '，当前版本 ' + (s.currentVersion || '');
    else if (s.kind === 'not-available') status = '当前已是最新版本。';
    else if (s.kind === 'blocked-downgrade') status = s.message || '远端版本不高于当前版本，已拒绝下载。';
    else if (s.kind === 'download-progress' && s.progress) {
      var pct = Math.max(0, Math.min(100, Math.round(s.progress.percent || 0)));
      status = '正在下载更新 ' + pct + '%';
      progressHtml = '<div style="height:6px;background:rgba(255,255,255,.08);border:1px solid var(--bdr);margin-top:.4rem;"><div style="height:100%;width:' + pct + '%;background:var(--gold);"></div></div>';
    } else if (s.kind === 'downloaded') status = '更新已下载，可以安装并重启。';
    if (s.hasUpdate) status = '发现新版本 ' + s.remoteVersion + '，当前版本 ' + s.currentVersion;
    else if (s.blockedDowngrade) status = '远端版本 ' + s.remoteVersion + ' 不高于当前版本 ' + s.currentVersion + '，已拒绝。';
    else if (s.currentVersion && !status) status = '当前版本 ' + s.currentVersion + '，未发现新版本。';
    return '' +
      '<div class="tm-grid-2">' +
        '<section class="tm-panel">' +
          '<h4>本体在线更新</h4>' +
          '<div class="tm-copy">用于更新 Electron 外壳、主进程、preload、依赖和安装器。本体更新会下载完整安装包，安装后重启生效；低版本会被拒绝。</div>' +
          '<div class="tm-field"><label for="tm-update-feed">安装包更新源</label><input class="tm-input" id="tm-update-feed" value="' + esc(url) + '" placeholder="https://example.com/tianming/releases/win/"></div>' +
          '<div class="tm-actions">' +
            action('检查本体更新', 'TMContentManager.checkUpdate()', 'primary') +
            action('下载更新包', 'TMContentManager.downloadUpdate()') +
            action('安装并重启', 'TMContentManager.installUpdate()', 'danger') +
          '</div>' +
          '<div id="tm-update-status" class="tm-status ' + (s.error ? 'warn' : '') + '">' + esc(status || '尚未检查本体更新。') + progressHtml + '</div>' +
          (notes ? '<details class="tm-copy" style="margin-top:.7rem;"><summary style="cursor:pointer;color:var(--gold);">发布说明</summary><pre style="white-space:pre-wrap;font-family:inherit;margin:.45rem 0 0;">' + esc(notes) + '</pre></details>' : '') +
        '</section>' +
        '<aside class="tm-panel">' +
          '<h4>更新账本</h4>' +
          '<div class="tm-kv">' +
            '<div><small>当前版本</small><b>' + esc(s.currentVersion || state.status && state.status.currentVersion || '未读取') + '</b></div>' +
            '<div><small>远端版本</small><b>' + esc(s.remoteVersion || (s.info && s.info.version) || '未检查') + '</b></div>' +
            '<div><small>更新类型</small><b>本体安装包</b></div>' +
            '<div><small>安全策略</small><b>只允许升版本</b></div>' +
          '</div>' +
          '<div class="tm-status">本体更新负责“底层能力”；UI、剧本、地图、立绘、音乐等前端资源优先使用“前端热更”，速度更快，也可回滚。</div>' +
        '</div>' +
      '</div>' +
      '<section class="tm-panel" style="margin-top:.8rem;"><h4>官方内容策略</h4><div class="tm-copy">官方剧本、地图、立绘、语义检索包可以随安装包发布，也可以通过热更/官方内容包分发。玩家自制内容则进入创意工坊，避免覆盖官方资产。</div></section>';
  }

  function renderOnlineTab() {
    var h = state.onlineStatus || {};
    var features = h.features || {};
    var endpoints = h.endpoints || {};
    var msg = state.onlineMessage || (h.ok ? '在线服务可用。' : '尚未检查在线服务。');
    return '' +
      '<div class="settings-section">' +
        '<h4>游戏在线服务</h4>' +
        '<div style="font-size:.76rem;color:var(--txt-d);line-height:1.6;margin-bottom:.55rem;">这里不是让玩家跳转网页，而是游戏内联网功能的后端入口。热更新、在线工坊和未来账号系统都通过这组 API 工作；服务器不可用时，本地游戏、存档和本地工坊仍可使用。</div>' +
        '<div class="fd full"><label>在线服务地址</label><input id="tm-online-api" value="' + esc(state.onlineApiUrl || state.defaultOnlineApiUrl || '') + '" placeholder="https://api.example.com/tianming-api/"></div>' +
        '<div style="display:flex;gap:.4rem;flex-wrap:wrap;margin:.55rem 0 .7rem;">' +
          btn('检查在线服务', 'TMContentManager.checkOnlineService()', 'bt bp bsm') +
        '</div>' +
        '<div style="margin-bottom:.6rem;font-size:.78rem;color:var(--gold-d);line-height:1.6;">' + esc(msg) + '</div>' +
        '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.45rem;font-size:.76rem;color:var(--txt-d);">' +
          '<div>服务：' + esc(h.service || '未知') + '</div>' +
          '<div>版本：' + esc(h.version || '未知') + '</div>' +
          '<div>热更新：' + (features.hotUpdate ? '可用' : '未启用') + '</div>' +
          '<div>在线工坊：' + (features.workshop ? '可用' : '未启用') + '</div>' +
          '<div>账号系统：' + (features.accounts ? '可用' : '未启用') + '</div>' +
          '<div>服务器时间：' + esc(h.serverTime || '') + '</div>' +
        '</div>' +
        '<details style="margin-top:.7rem;color:var(--txt-d);font-size:.72rem;line-height:1.5;"><summary style="cursor:pointer;color:var(--gold);">联网端点</summary>' +
          '<pre style="white-space:pre-wrap;font-family:inherit;">' + esc(JSON.stringify(endpoints, null, 2)) + '</pre>' +
        '</details>' +
      '</div>';
  }

  function hotStatusText(evt) {
    if (!evt) return '';
    if (evt.kind === 'download-start') return '正在下载热更新 ' + (evt.version || '');
    if (evt.kind === 'download-progress') return '正在下载热更新 ' + Math.max(0, Math.min(100, Math.round(evt.percent || 0))) + '%';
    if (evt.kind === 'downloaded') return '热更新包已下载，正在校验。';
    if (evt.kind === 'verifying') return '正在校验热更新清单与文件哈希。';
    if (evt.kind === 'installed') return '热更新已安装，点击“立即重载前端”即可生效。';
    if (evt.kind === 'error') return '热更新失败：' + (evt.error || '未知错误');
    return evt.message || evt.error || '';
  }

  function renderHotUpdateTab() {
    var h = state.hotStatus || {};
    var url = state.hotFeedUrl || state.defaultHotFeedUrl || '';
    var enabled = h.enabled !== false;
    var mode = h.activeHot ? ('热更版 ' + (h.currentVersion || h.rendererVersion || '')) : '安装包内置前端';
    var msg = state.hotMessage || '';
    if (!msg) {
      msg = '当前加载：' + mode + '；基础版本 ' + (h.baseVersion || '') + '；前端版本 ' + (h.rendererVersion || h.baseVersion || '') + '。';
    }
    return '' +
      '<div class="settings-section">' +
        '<h4>热更新（无需安装包）</h4>' +
        '<div style="font-size:.76rem;color:var(--txt-d);line-height:1.6;margin-bottom:.55rem;">热更新会替换游戏前端 web 代码、样式、剧本、地图、立绘和音乐等静态资源。主进程、preload、Electron、原生依赖和安装器自身仍必须通过“本体在线更新”发布。</div>' +
        '<div class="fd full"><label>热更新清单地址</label><input id="tm-hot-feed" value="' + esc(url) + '" placeholder="https://example.com/tianming/hot/hot-latest.json"></div>' +
        '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.45rem;margin-top:.6rem;font-size:.76rem;color:var(--txt-d);">' +
          '<div>启用状态：<b style="color:var(--gold);">' + (enabled ? '已启用' : '已暂停') + '</b></div>' +
          '<div>当前加载：<b style="color:var(--gold);">' + esc(mode) + '</b></div>' +
          '<div>基础版本：' + esc(h.baseVersion || '') + '</div>' +
          '<div>前端版本：' + esc(h.rendererVersion || h.baseVersion || '') + '</div>' +
          '<div>上个热更：' + esc(h.previousVersion || '无') + '</div>' +
          '<div>安装时间：' + esc(h.installedAt || '无') + '</div>' +
        '</div>' +
        '<div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-top:.65rem;">' +
          btn('检查热更新', 'TMContentManager.checkHotUpdate()', 'bt bp bsm') +
          btn('下载并安装热更', 'TMContentManager.installHotUpdate()', 'bt bd bsm') +
          btn('立即重载前端', 'TMContentManager.reloadAfterHotUpdate()') +
          btn(enabled ? '暂停热更' : '启用热更', 'TMContentManager.toggleHotUpdate(' + (!enabled) + ')') +
          btn('回滚上个热更', 'TMContentManager.rollbackHotUpdate()') +
          btn('打开热更目录', 'TMContentManager.openHotUpdateDir()') +
          btn('热更包格式', 'TMContentManager.openHotFormatDoc()') +
        '</div>' +
        '<div style="margin-top:.6rem;font-size:.78rem;color:var(--gold-d);line-height:1.6;">' + esc(msg || '尚未检查热更新。') + '</div>' +
        '<div style="margin-top:.45rem;font-size:.7rem;color:var(--txt-d);line-height:1.5;">活动目录：' + esc(h.activeWebRoot || '') + '</div>' +
      '</div>';
  }

  function packRow(p) {
    var enabled = p.enabled !== false;
    var bad = !p.installed ? ' · 文件缺失' : '';
    return '<div style="border:1px solid var(--bdr);background:rgba(0,0,0,.18);padding:.65rem;margin-bottom:.5rem;">' +
      '<div style="display:flex;justify-content:space-between;gap:.6rem;align-items:flex-start;">' +
        '<div style="min-width:0;">' +
          '<div style="font-weight:700;color:var(--gold);">' + esc(p.title || p.id) + '</div>' +
          '<div style="font-size:.72rem;color:var(--txt-d);margin-top:.15rem;">' + esc(p.id) + ' · v' + esc(p.version || '1.0.0') + ' · ' + esc(p.type || 'content') + bad + '</div>' +
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
          '<div style="font-size:.72rem;color:var(--txt-d);margin-top:.15rem;">' + esc(p.id) + ' · v' + esc(p.version || '1.0.0') + ' · ' + esc(p.author || '佚名') + '</div>' +
          (p.description ? '<div style="font-size:.76rem;color:var(--txt);line-height:1.5;margin-top:.35rem;">' + esc(p.description) + '</div>' : '') +
        '</div>' +
        '<div style="display:flex;gap:.35rem;flex-wrap:wrap;justify-content:flex-end;">' +
          btn('在线安装', 'TMContentManager.installCatalogPack(\'' + esc(p.packageUrl) + '\',\'' + esc(p.sha256 || '') + '\')', 'bt bp bsm') +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function renderWorkshopTab() {
    var rows = state.packs.length ? state.packs.map(packRow).join('') : '<div style="color:var(--txt-d);padding:1rem 0;">暂无工坊包。</div>';
    var c = state.catalog || {};
    var catalogRows = c.packs && c.packs.length ? c.packs.map(catalogPackRow).join('') : '<div style="color:var(--txt-d);padding:.5rem 0;">尚未载入在线目录。</div>';
    return '<div class="settings-section">' +
      '<h4>创意工坊</h4>' +
      '<div style="font-size:.76rem;color:var(--txt-d);line-height:1.6;margin-bottom:.55rem;">支持 .tm-pack / .zip / 单个剧本 JSON。导入前会校验 manifest、路径越界、危险文件类型和大小上限；启用的剧本包会在开卷前合入剧本列表。</div>' +
      '<div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:.7rem;">' +
        btn('导入工坊包', 'TMContentManager.importPack()', 'bt bp bsm') +
        btn('刷新列表', 'TMContentManager.refreshPacks()') +
        btn('打开目录', 'TMContentManager.openWorkshopDir()') +
        btn('包格式说明', 'TMContentManager.openFormatDoc()') +
      '</div>' +
      rows +
    '</div>' +
    '<div class="settings-section">' +
      '<h4>在线工坊目录</h4>' +
      '<div style="font-size:.76rem;color:var(--txt-d);line-height:1.6;margin-bottom:.55rem;">服务器可发布 catalog.json，玩家在这里刷新后直接安装目录中的 .tm-pack。目录和包地址同样要求 HTTPS；本地调试允许 localhost HTTP。</div>' +
      '<div class="fd full"><label>工坊目录地址</label><input id="tm-workshop-catalog" value="' + esc(state.catalogUrl || state.defaultCatalogUrl || '') + '" placeholder="https://example.com/tianming/workshop/catalog.json"></div>' +
      '<div style="display:flex;gap:.4rem;flex-wrap:wrap;margin:.55rem 0 .7rem;">' +
        btn('刷新在线目录', 'TMContentManager.loadWorkshopCatalog()', 'bt bp bsm') +
      '</div>' +
      '<div style="margin-bottom:.45rem;font-size:.76rem;color:var(--gold-d);">' + esc(state.catalogMessage || (c.title ? (c.title + (c.updatedAt ? ' · ' + c.updatedAt : '')) : '')) + '</div>' +
      catalogRows +
    '</div>';
  }

  function jsArg(value) {
    return JSON.stringify(String(value == null ? '' : value)).replace(/"/g, '&quot;');
  }

  function kv(label, value) {
    return '<div><small>' + esc(label) + '</small><b>' + esc(value || '未读取') + '</b></div>';
  }

  function featureCard(title, enabled, desc) {
    return '<div class="tm-card">' +
      '<div style="display:flex;justify-content:space-between;gap:.5rem;align-items:center;margin-bottom:.35rem;">' +
        '<b style="color:#f2d487;">' + esc(title) + '</b>' +
        pill(enabled ? '可用' : '未启用', enabled ? 'good' : 'off') +
      '</div>' +
      '<div class="tm-copy">' + esc(desc) + '</div>' +
    '</div>';
  }

  function renderOnlineTabV2() {
    var h = state.onlineStatus || {};
    var features = h.features || {};
    var endpoints = h.endpoints || {};
    var ok = !!h.ok;
    var msg = state.onlineMessage || (ok ? '在线服务可用。' : '尚未检查在线服务。');
    var apiUrl = state.onlineApiUrl || state.defaultOnlineApiUrl || '';
    return '' +
      '<div class="tm-grid-2">' +
        '<section class="tm-panel">' +
          '<h4>联网总览</h4>' +
          '<div class="tm-copy">这里是游戏内的联网中枢。热更新、在线创意工坊和未来账号系统都从这里接入；网络不可用时，不影响本地开局、读档和离线游玩。</div>' +
          '<div class="tm-field"><label for="tm-online-api">在线服务地址</label><input class="tm-input" id="tm-online-api" value="' + esc(apiUrl) + '" placeholder="https://api.example.com/tianming-api/"></div>' +
          '<div class="tm-actions">' +
            action('检查在线服务', 'TMContentManager.checkOnlineService()', 'primary') +
          '</div>' +
          '<div class="tm-status ' + (ok ? '' : 'warn') + '">' + esc(msg) + '</div>' +
          '<div class="tm-grid-3" style="margin-top:.8rem;">' +
            featureCard('前端热更新', !!features.hotUpdate, '用于无安装包更新 UI、脚本、剧本、地图、立绘和音乐等前端资源。') +
            featureCard('在线创意工坊', !!features.workshop, '用于从官方目录浏览并安装玩家内容包，同时保留本地导入能力。') +
            featureCard('账号身份', !!features.accounts, '用于未来云存档、作者身份、订阅与跨设备同步；当前不会阻挡离线游戏。') +
          '</div>' +
        '</section>' +
        '<aside class="tm-panel">' +
          '<h4>服务账本</h4>' +
          '<div class="tm-kv">' +
            kv('服务', h.service || '未连接') +
            kv('接口版本', h.version || '未连接') +
            kv('服务器时间', h.serverTime || '未返回') +
            kv('离线策略', h.offlineMode || '本地游戏可离线运行') +
          '</div>' +
          '<div class="tm-status">建议玩家先看这里：若服务正常，再分别进入热更、工坊或账号页；若服务不可用，当前局和本地内容不应被锁死。</div>' +
          '<details class="tm-copy" style="margin-top:.75rem;"><summary style="cursor:pointer;color:var(--gold);">联网端点</summary><pre style="white-space:pre-wrap;font-family:inherit;margin:.45rem 0 0;">' + esc(JSON.stringify(endpoints, null, 2)) + '</pre></details>' +
        '</aside>' +
      '</div>';
  }

  function renderUpdateTabV2() {
    var s = state.status || {};
    var url = state.feedUrl || state.defaultFeedUrl || '';
    var h = state.hotStatus || {};
    var hc = state.hotCheck || {};
    var hotUrl = state.hotFeedUrl || state.defaultHotFeedUrl || '';
    var enabled = h.enabled !== false;
    var mode = h.activeHot ? ('热更版本 ' + (h.currentVersion || h.rendererVersion || '')) : '安装包内置前端';
    var status = s.message || s.error || '';
    var progressHtml = '';
    var notes = releaseNotes(s.info);
    if (s.kind === 'checking') status = '正在检查本体更新...';
    else if (s.kind === 'available' && s.info) status = '发现新版本 ' + s.info.version + '，当前版本 ' + (s.currentVersion || '');
    else if (s.kind === 'not-available') status = '当前已经是最新本体版本。';
    else if (s.kind === 'blocked-downgrade') status = s.message || '远端版本不高于当前版本，已拒绝下载。';
    else if (s.kind === 'download-progress' && s.progress) {
      var pct = Math.max(0, Math.min(100, Math.round(s.progress.percent || 0)));
      status = '正在下载本体更新 ' + pct + '%';
      progressHtml = '<div class="tm-progress"><i style="width:' + pct + '%;"></i></div>';
    } else if (s.kind === 'downloaded') status = '本体更新已下载，可以安装并重启。';
    if (s.hasUpdate) status = '发现新版本 ' + s.remoteVersion + '，当前版本 ' + s.currentVersion;
    else if (s.blockedDowngrade) status = '远端版本 ' + s.remoteVersion + ' 不高于当前版本 ' + s.currentVersion + '，已拒绝。';
    else if (s.currentVersion && !status) status = '当前版本 ' + s.currentVersion + '，尚未发现新版本。';
    var hotHasUpdate = !!hc.hasUpdate;
    var installerHasUpdate = !!s.hasUpdate;
    var hotText = state.hotMessage || (hotHasUpdate ? ('发现前端热更 ' + hc.remoteVersion + '，大小 ' + formatBytes(hc.size) + '。') : '尚未检查前端热更。');
    return '' +
      '<div class="tm-grid-2">' +
        '<section class="tm-panel">' +
          '<h4>游戏更新</h4>' +
          '<div class="tm-copy">这里把“前端热更”和“本体安装包更新”合在一起展示。普通 UI、剧本、地图、立绘、音乐和脚本优先走前端热更；Electron 外壳、preload、主进程和安装器才走本体更新。</div>' +
          '<div class="tm-grid-2" style="margin-top:.75rem;">' +
            '<div class="tm-card">' +
              '<div style="display:flex;justify-content:space-between;gap:.5rem;align-items:center;"><b style="color:#f2d487;">前端热更</b>' + pill(enabled ? '启用' : '暂停', enabled ? 'good' : 'off') + '</div>' +
              '<div class="tm-copy" style="margin-top:.35rem;">当前加载：' + esc(mode) + '</div>' +
              '<div class="tm-pack-meta">远端版本：' + esc(hc.remoteVersion || '未检查') + ' / 大小：' + esc(formatBytes(hc.size)) + '</div>' +
              '<div class="tm-status ' + (hc.success === false ? 'warn' : '') + '">' + esc(hotText) + '</div>' +
            '</div>' +
            '<div class="tm-card">' +
              '<div style="display:flex;justify-content:space-between;gap:.5rem;align-items:center;"><b style="color:#f2d487;">本体安装包</b>' + pill(installerHasUpdate ? '可下载' : '未发现', installerHasUpdate ? 'good' : '') + '</div>' +
              '<div class="tm-copy" style="margin-top:.35rem;">当前版本：' + esc(s.currentVersion || '未读取') + '</div>' +
              '<div class="tm-pack-meta">远端版本：' + esc(s.remoteVersion || (s.info && s.info.version) || '未检查') + ' / 大小：' + esc(formatBytes(s.size || updateInfoSize(s.info))) + '</div>' +
              '<div class="tm-status ' + (s.error ? 'warn' : '') + '">' + esc(status || '尚未检查本体更新。') + progressHtml + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="tm-field"><label for="tm-hot-feed">前端热更清单</label><input class="tm-input" id="tm-hot-feed" value="' + esc(hotUrl) + '" placeholder="https://example.com/tianming/hot/hot-latest.json"></div>' +
          '<div class="tm-field"><label for="tm-update-feed">安装包更新源</label><input class="tm-input" id="tm-update-feed" value="' + esc(url) + '" placeholder="https://example.com/tianming/releases/win/"></div>' +
          '<div class="tm-actions">' +
            action('检查全部更新', 'TMContentManager.checkGameUpdate()', 'primary') +
            action('下载并安装前端热更', 'TMContentManager.installHotUpdate()', '', !hotHasUpdate) +
            action('下载本体更新包', 'TMContentManager.downloadUpdate()', '', !installerHasUpdate) +
            action('安装本体并重启', 'TMContentManager.installUpdate()', 'danger') +
            action('立即重载前端', 'TMContentManager.reloadAfterHotUpdate()') +
          '</div>' +
          '<div class="tm-actions">' +
            action(enabled ? '暂停热更' : '启用热更', 'TMContentManager.toggleHotUpdate(' + (!enabled) + ')') +
            action('回滚上个热更', 'TMContentManager.rollbackHotUpdate()', 'danger') +
            action('打开热更目录', 'TMContentManager.openHotUpdateDir()') +
          '</div>' +
        '</section>' +
        '<aside class="tm-panel">' +
          '<h4>本次下载内容</h4>' +
          '<div class="tm-kv">' +
            kv('前端热更大小', formatBytes(hc.size)) +
            kv('本体更新大小', formatBytes(s.size || updateInfoSize(s.info))) +
            kv('前端版本', h.rendererVersion || h.baseVersion || '未读取') +
            kv('本体版本', s.currentVersion || '未读取') +
          '</div>' +
          '<div class="tm-status">下载前会先展示远端版本、包体大小和更新说明。若只发现前端热更，玩家无需重装；若发现本体更新，则下载完整安装包并重启安装。</div>' +
          (hc.notes ? '<details class="tm-copy" style="margin-top:.75rem;" open><summary style="cursor:pointer;color:var(--gold);">热更说明</summary><pre style="white-space:pre-wrap;font-family:inherit;margin:.45rem 0 0;">' + esc(hc.notes) + '</pre></details>' : '') +
          (notes ? '<details class="tm-copy" style="margin-top:.75rem;"><summary style="cursor:pointer;color:var(--gold);">本体发布说明</summary><pre style="white-space:pre-wrap;font-family:inherit;margin:.45rem 0 0;">' + esc(notes) + '</pre></details>' : '') +
        '</aside>' +
      '</div>' +
      '<section class="tm-panel" style="margin-top:.8rem;"><h4>游戏公告摘要</h4><div class="tm-pack-list">' + changelogSummary(3) + '</div></section>';
  }

  function renderHotUpdateTabV2() {
    var h = state.hotStatus || {};
    var url = state.hotFeedUrl || state.defaultHotFeedUrl || '';
    var enabled = h.enabled !== false;
    var mode = h.activeHot ? ('热更版本 ' + (h.currentVersion || h.rendererVersion || '')) : '安装包内置前端';
    var msg = state.hotMessage || ('当前加载：' + mode + '；基础版本 ' + (h.baseVersion || '未读取') + '；前端版本 ' + (h.rendererVersion || h.baseVersion || '未读取') + '。');
    return '' +
      '<div class="tm-grid-2">' +
        '<section class="tm-panel">' +
          '<h4>前端热更</h4>' +
          '<div class="tm-copy">热更用于替换游戏前端 web 资源，让玩家不重新下载安装包也能收到 UI、剧本、地图、立绘、音乐和规则脚本更新。每个包都需要清单与哈希校验。</div>' +
          '<div class="tm-field"><label for="tm-hot-feed">热更清单地址</label><input class="tm-input" id="tm-hot-feed" value="' + esc(url) + '" placeholder="https://example.com/tianming/hot/hot-latest.json"></div>' +
          '<div class="tm-actions">' +
            action('检查热更', 'TMContentManager.checkHotUpdate()', 'primary') +
            action('下载并安装', 'TMContentManager.installHotUpdate()') +
            action('立即重载前端', 'TMContentManager.reloadAfterHotUpdate()') +
            action(enabled ? '暂停热更' : '启用热更', 'TMContentManager.toggleHotUpdate(' + (!enabled) + ')') +
            action('回滚上个热更', 'TMContentManager.rollbackHotUpdate()', 'danger') +
          '</div>' +
          '<div class="tm-status">' + esc(msg || '尚未检查热更。') + '</div>' +
        '</section>' +
        '<aside class="tm-panel">' +
          '<h4>热更状态</h4>' +
          '<div class="tm-kv">' +
            kv('启用状态', enabled ? '已启用' : '已暂停') +
            kv('当前加载', mode) +
            kv('基础版本', h.baseVersion || '未读取') +
            kv('前端版本', h.rendererVersion || h.baseVersion || '未读取') +
            kv('上个热更', h.previousVersion || '无') +
            kv('安装时间', h.installedAt || '无') +
          '</div>' +
          '<div class="tm-actions">' +
            action('打开热更目录', 'TMContentManager.openHotUpdateDir()') +
            action('热更包格式', 'TMContentManager.openHotFormatDoc()') +
          '</div>' +
          '<div class="tm-status">活动目录：' + esc(h.activeWebRoot || '未读取') + '</div>' +
        '</aside>' +
      '</div>';
  }

  function packRowV2(p) {
    var enabled = p.enabled !== false;
    var missing = !p.installed;
    return '<div class="tm-pack">' +
      '<div>' +
        '<div class="tm-pack-title">' + esc(p.title || p.id) + '</div>' +
        '<div class="tm-pack-meta">' + esc(p.id) + ' / v' + esc(p.version || '1.0.0') + ' / ' + esc(p.type || 'content') + (missing ? ' / 文件缺失' : '') + '</div>' +
        (p.description ? '<div class="tm-pack-desc">' + esc(p.description) + '</div>' : '') +
      '</div>' +
      '<div class="tm-actions" style="margin-top:0;justify-content:flex-end;">' +
        action(enabled ? '停用' : '启用', 'TMContentManager.togglePack(' + jsArg(p.id) + ',' + (!enabled) + ')') +
        action('卸载', 'TMContentManager.uninstallPack(' + jsArg(p.id) + ')', 'danger') +
      '</div>' +
    '</div>';
  }

  function catalogPackRowV2(p) {
    var disabled = !p.packageUrl;
    return '<div class="tm-pack">' +
      '<div>' +
        '<div class="tm-pack-title">' + esc(p.title || p.id) + '</div>' +
        '<div class="tm-pack-meta">' + esc(p.id || '未命名') + ' / v' + esc(p.version || '1.0.0') + ' / 作者 ' + esc(p.author || '佚名') + '</div>' +
        (p.description ? '<div class="tm-pack-desc">' + esc(p.description) + '</div>' : '') +
      '</div>' +
      '<div class="tm-actions" style="margin-top:0;justify-content:flex-end;">' +
        action('在线安装', 'TMContentManager.installCatalogPack(' + jsArg(p.packageUrl || '') + ',' + jsArg(p.sha256 || '') + ')', 'primary', disabled) +
      '</div>' +
    '</div>';
  }

  function renderWorkshopTabV2() {
    var c = state.catalog || {};
    var user = state.accountSession && state.accountSession.user;
    var localRows = state.packs.length ? state.packs.map(packRowV2).join('') : '<div class="tm-empty">尚未安装创意工坊内容包。</div>';
    var onlineRows = c.packs && c.packs.length ? c.packs.map(catalogPackRowV2).join('') : '<div class="tm-empty">尚未载入在线目录。检查服务后，可从官方目录安装工坊包。</div>';
    return '' +
      '<div class="tm-grid-2">' +
        '<section class="tm-panel">' +
          '<h4>本地工坊</h4>' +
          '<div class="tm-copy">本地工坊承接玩家手动导入的 .tm-pack、zip 或单个剧本 JSON。启用的剧本包会在开局前并入剧本列表，停用后不再参与。</div>' +
          '<div class="tm-actions">' +
            action('导入工坊包', 'TMContentManager.importPack()', 'primary') +
            action('刷新列表', 'TMContentManager.refreshPacks()') +
            action('打开目录', 'TMContentManager.openWorkshopDir()') +
            action('包格式说明', 'TMContentManager.openFormatDoc()') +
          '</div>' +
          '<div class="tm-pack-list">' + localRows + '</div>' +
        '</section>' +
        '<section class="tm-panel">' +
          '<h4>在线工坊目录</h4>' +
          '<div class="tm-copy">在线目录由服务器发布 catalog.json。玩家可在游戏内刷新、查看并安装，不需要跳出到网页下载。</div>' +
          '<div class="tm-field"><label for="tm-workshop-catalog">工坊目录地址</label><input class="tm-input" id="tm-workshop-catalog" value="' + esc(state.catalogUrl || state.defaultCatalogUrl || '') + '" placeholder="https://example.com/tianming/workshop/catalog.json"></div>' +
          '<div class="tm-actions">' +
            action('刷新在线目录', 'TMContentManager.loadWorkshopCatalog()', 'primary') +
          '</div>' +
          '<div class="tm-status">' + esc(state.catalogMessage || (c.title ? (c.title + (c.updatedAt ? ' / ' + c.updatedAt : '')) : '尚未载入在线工坊目录。')) + '</div>' +
          '<div class="tm-pack-list">' + onlineRows + '</div>' +
        '</section>' +
      '</div>' +
      '<section class="tm-panel" style="margin-top:.8rem;">' +
        '<h4>发布到在线工坊</h4>' +
        '<div class="tm-copy">当前版本先支持“登记发布”：作者登录后，提交已经托管好的 .tm-pack 下载地址、哈希和说明，服务器会把它加入在线目录。真正的二进制上传通道可在下一步接对象存储或服务器上传接口。</div>' +
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
        '<div class="tm-status ' + (state.publishMessage && /失败|错误|请先/.test(state.publishMessage) ? 'warn' : '') + '">' + esc(state.publishMessage || (user ? '当前作者：' + (user.nickname || user.username) : '请先登录账号。')) + '</div>' +
      '</section>';
  }

  function renderAccountTabV2() {
    var h = state.onlineStatus || {};
    var accountsOn = !!(h.features && h.features.accounts);
    var session = state.accountSession || {};
    var user = session.user;
    return '' +
      '<div class="tm-grid-2">' +
        '<section class="tm-panel">' +
          '<h4>账号登录</h4>' +
          '<div class="tm-copy">账号用于在线工坊作者身份、后续云存档、订阅内容与跨设备同步。没有登录时，本地开局、读档、热更和本地工坊仍然可以使用。</div>' +
          '<div class="tm-account-seal">' +
            '<div><div style="font-size:1.25rem;font-weight:800;margin-bottom:.35rem;">' + esc(user ? (user.nickname || user.username) : (accountsOn ? '账号服务可用' : '等待连接账号服务')) + '</div><div>' + esc(user ? ('已登录：' + user.username) : '登录后可发布在线工坊内容。') + '</div></div>' +
          '</div>' +
          '<div class="tm-field"><label for="tm-account-name">账号</label><input class="tm-input" id="tm-account-name" value="" placeholder="3-24 位中文/英文/数字/下划线"></div>' +
          '<div class="tm-field"><label for="tm-account-pass">密码</label><input class="tm-input" id="tm-account-pass" type="password" value="" placeholder="至少 8 位"></div>' +
          '<div class="tm-field"><label for="tm-account-nickname">昵称（注册时可填）</label><input class="tm-input" id="tm-account-nickname" value="" placeholder="显示在工坊作者栏"></div>' +
          '<div class="tm-actions">' +
            action('登录', 'TMContentManager.accountLogin()', 'primary') +
            action('注册并登录', 'TMContentManager.accountRegister()') +
            action('刷新身份', 'TMContentManager.accountRefresh()') +
            action('退出登录', 'TMContentManager.accountLogout()', 'danger', !user) +
          '</div>' +
          '<div class="tm-status ' + (state.accountMessage && /失败|错误|至少|已存在|请/.test(state.accountMessage) ? 'warn' : '') + '">' + esc(state.accountMessage || (user ? '账号已连接。' : '尚未登录。')) + '</div>' +
        '</section>' +
        '<aside class="tm-panel">' +
          '<h4>账号权限</h4>' +
          '<div class="tm-kv">' +
            kv('工坊作者', user ? (user.nickname || user.username) : '未登录') +
            kv('注册时间', user && user.createdAt || '未登录') +
            kv('最近登录', user && user.lastLoginAt || '未登录') +
            kv('离线模式', '始终保留') +
          '</div>' +
          '<div class="tm-status">设计原则：账号是增强功能，不是启动门槛。当前已实装注册、登录、退出、身份刷新和工坊作者发布身份。</div>' +
        '</aside>' +
      '</div>';
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
    var foot = '<div class="tm-actions" style="margin-top:0;">' +
      (u.canReload ? '<button class="tm-action primary" onclick="TMContentManager.reloadAppliedUpdate()">立即重载前端</button>' : '') +
      (u.canInstall ? '<button class="tm-action danger" onclick="TMContentManager.installDownloadedUpdate()">安装本体并重启</button>' : '') +
      '<button class="tm-action" onclick="TMContentManager.closeApplyUpdate()" ' + (u.busy ? 'disabled' : '') + '>关闭</button>' +
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
      state.accountSession = status.account || state.accountSession || null;
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
      if (hot && hot.success && hot.hasUpdate) {
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

  function render() {
    var bg = ensureLayer();
    var body = state.tab === 'workshop' ? renderWorkshopTabV2() : (state.tab === 'hot' ? renderHotUpdateTabV2() : (state.tab === 'online' ? renderOnlineTabV2() : (state.tab === 'account' ? renderAccountTabV2() : renderUpdateTabV2())));
    bg.innerHTML = '<div class="tm-online-shell" role="dialog" aria-modal="true" aria-label="天命联网中枢">' +
      '<div class="tm-online-head">' +
        '<div><div class="tm-online-title">天命联网中枢</div><div class="tm-online-sub">更新、热更、在线工坊与账号入口集中在这里；服务器不可用时，本地游戏照常运行。</div></div>' +
        '<button class="tm-action" onclick="TMContentManager.close()" aria-label="关闭联网中枢">关闭</button>' +
      '</div>' +
      '<div>' +
        '<div class="tm-online-tabs" role="tablist">' +
          '<button class="tm-tab ' + (state.tab === 'online' ? 'is-active' : '') + '" onclick="TMContentManager.switchTab(\'online\')">联网总览</button>' +
          '<button class="tm-tab ' + (state.tab === 'update' ? 'is-active' : '') + '" onclick="TMContentManager.switchTab(\'update\')">游戏更新</button>' +
          '<button class="tm-tab ' + (state.tab === 'workshop' ? 'is-active' : '') + '" onclick="TMContentManager.switchTab(\'workshop\')">创意工坊</button>' +
          '<button class="tm-tab ' + (state.tab === 'account' ? 'is-active' : '') + '" onclick="TMContentManager.switchTab(\'account\')">账号登录</button>' +
        '</div>' +
        '<div class="tm-online-body">' + body + '</div>' +
      '</div>' +
    '</div>';
    bg.style.display = 'flex';
  }

  async function refreshPacks() {
    if (!desktop() || !window.tianming.listWorkshopPacks) return;
    var res = await window.tianming.listWorkshopPacks();
    if (res && res.success) state.packs = res.packs || [];
    render();
  }

  async function openContentManager() {
    state.feedUrl = loadFeedUrl();
    state.hotFeedUrl = loadHotFeedUrl();
    state.catalogUrl = loadCatalogUrl();
    state.onlineApiUrl = loadOnlineApiUrl();
    await loadChangelog();
    if (!desktop()) {
      state.status = { error: '当前是网页环境，在线更新和本地工坊安装只在桌面版启用。' };
      state.hotMessage = '当前是网页环境，热更新只在桌面版启用。';
      state.onlineMessage = '当前是网页环境，在线服务只在桌面版启用。';
      render();
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
        state.accountSession = status.account || state.accountSession || null;
        state.status = { currentVersion: status.currentVersion };
      }
    } catch(e) {
      state.status = { error: e.message };
    }
    render();
  }

  async function refreshAccountSession() {
    if (!desktop() || !window.tianming.accountSession) return null;
    var res = await window.tianming.accountSession();
    if (res && res.success) state.accountSession = res.session || null;
    return state.accountSession;
  }

  async function checkGameUpdate() {
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
    var res = await window.tianming.onlineServiceStatus(state.onlineApiUrl);
    if (res && res.success) {
      state.onlineStatus = res.health || null;
      state.onlineMessage = '在线服务连接成功。';
    } else {
      state.onlineStatus = null;
      state.onlineMessage = '在线服务不可用：' + ((res && res.error) || '未知错误') + '。离线游戏不受影响。';
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

  async function loadWorkshopCatalog() {
    var input = document.getElementById('tm-workshop-catalog');
    state.catalogUrl = input ? input.value.trim() : state.catalogUrl;
    if (!state.catalogUrl) state.catalogUrl = state.defaultCatalogUrl || '';
    saveCatalogUrl(state.catalogUrl);
    state.catalogMessage = '正在载入在线工坊目录...';
    render();
    var res = await window.tianming.loadWorkshopCatalog(state.catalogUrl);
    if (res && res.success) {
      state.catalog = res.catalog || null;
      state.catalogMessage = '已载入 ' + ((state.catalog && state.catalog.packs && state.catalog.packs.length) || 0) + ' 个在线工坊包。';
    } else {
      state.catalogMessage = '载入在线目录失败：' + ((res && res.error) || '未知错误');
    }
    render();
  }

  async function installCatalogPack(packageUrl, sha256, overwrite) {
    if (!packageUrl) return;
    state.catalogMessage = '正在下载并安装在线工坊包...';
    render();
    var res = await window.tianming.installWorkshopPackFromUrl(packageUrl, sha256 || '', !!overwrite);
    if (res && res.exists && !overwrite) {
      if (confirm(res.error + '\n是否覆盖安装？')) return installCatalogPack(packageUrl, sha256, true);
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

  async function accountRefresh() {
    if (!desktop() || !window.tianming.accountMe) return;
    state.accountMessage = '正在刷新账号身份...';
    render();
    var res = await window.tianming.accountMe(state.onlineApiUrl || state.defaultOnlineApiUrl || '');
    if (res && res.success) {
      state.accountSession = res.session || state.accountSession || null;
      state.accountMessage = (res.loggedIn || (res.user || state.accountSession && state.accountSession.user)) ? '账号身份已刷新。' : '尚未登录。';
    } else {
      state.accountMessage = '刷新账号身份失败：' + ((res && res.error) || '未知错误');
    }
    render();
  }

  async function accountLogin() {
    var name = document.getElementById('tm-account-name');
    var pass = document.getElementById('tm-account-pass');
    state.accountMessage = '正在登录...';
    render();
    var res = await window.tianming.accountLogin(state.onlineApiUrl || state.defaultOnlineApiUrl || '', name ? name.value.trim() : '', pass ? pass.value : '');
    if (res && res.success) {
      await refreshAccountSession();
      state.accountMessage = '登录成功。';
    } else {
      state.accountMessage = '登录失败：' + ((res && res.error) || '未知错误');
    }
    render();
  }

  async function accountRegister() {
    var name = document.getElementById('tm-account-name');
    var pass = document.getElementById('tm-account-pass');
    var nick = document.getElementById('tm-account-nickname');
    state.accountMessage = '正在注册...';
    render();
    var res = await window.tianming.accountRegister(state.onlineApiUrl || state.defaultOnlineApiUrl || '', name ? name.value.trim() : '', pass ? pass.value : '', nick ? nick.value.trim() : '');
    if (res && res.success) {
      await refreshAccountSession();
      state.accountMessage = '注册并登录成功。';
    } else {
      state.accountMessage = '注册失败：' + ((res && res.error) || '未知错误');
    }
    render();
  }

  async function accountLogout() {
    state.accountMessage = '正在退出登录...';
    render();
    var res = await window.tianming.accountLogout(state.onlineApiUrl || state.defaultOnlineApiUrl || '');
    state.accountSession = null;
    state.accountMessage = res && res.success ? '已退出登录。' : ('退出登录失败：' + ((res && res.error) || '未知错误'));
    render();
  }

  async function publishWorkshopPack() {
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
      single.role = data.role || '';
      single.background = data.background || data.overview || '';
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

  async function loadWorkshopScenarios(silent) {
    if (!desktop() || !window.tianming.loadEnabledWorkshopScenarios || !window.P) return;
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
    installCatalogPack: installCatalogPack,
    publishWorkshopPack: publishWorkshopPack,
    accountLogin: accountLogin,
    accountRegister: accountRegister,
    accountRefresh: accountRefresh,
    accountLogout: accountLogout,
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
        if (state.applyUpdate && state.applyUpdate.open && status) {
          if (status.kind === 'download-start') {
            updateApplyState({ progress: 18, message: '正在下载前端热更...', size: status.size || state.applyUpdate.size || 0 }, '开始下载前端热更。');
          } else if (status.kind === 'download-progress') {
            var pct = Math.max(0, Math.min(100, Math.round(status.percent || 0)));
            updateApplyState({ progress: Math.max(18, Math.min(70, pct)), message: '正在下载前端热更 ' + pct + '%', size: status.size || state.applyUpdate.size || 0 });
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
})();
