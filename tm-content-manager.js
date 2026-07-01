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
          '<div class="tm-status ' + (ok ? '' : 'warn') + '" role="status" aria-live="polite">' + esc(msg) + '</div>' +
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
          '<div class="tm-status">服务正常时，进入工坊或账号页；服务不可用时，当前局与本地内容照常，不会被锁死。</div>' +
          '<div class="tm-actions">' +
            action('进入创意工坊', 'TMContentManager.switchTab(\'workshop\')', 'primary') +
            action('账号登录', 'TMContentManager.switchTab(\'account\')') +
          '</div>' +
          '<details class="tm-copy" style="margin-top:.75rem;"><summary style="cursor:pointer;color:var(--gold);">联网端点</summary><pre style="white-space:pre-wrap;font-family:inherit;margin:.45rem 0 0;">' + esc(JSON.stringify(endpoints, null, 2)) + '</pre></details>' +
        '</aside>' +
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

  function renderUpdateTabV2() {
    if (!desktop()) return renderWebUpdateNotice();
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

  function ratingStars(p) {
    var avg = Number(p.rating || 0), cnt = Number(p.ratingCount || 0);
    var full = Math.round(avg);
    var stars = '';
    for (var i = 1; i <= 5; i++) stars += (i <= full ? '★' : '☆');
    return '<span style="color:#e8c46a;font-size:.82rem;letter-spacing:1px;">' + stars + '</span>' +
      '<span style="color:rgba(234,223,203,.74);font-size:.72rem;margin-left:.35rem;">' + (cnt ? (avg.toFixed(1) + ' · ' + cnt + ' 评') : '暂无评分') + '</span>';
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
          '<span onclick="TMContentManager.loadAuthorPacks(' + jsArg(p.authorId != null ? p.authorId : '') + ',' + jsArg(p.author || '') + ')" style="color:var(--gold,#d8b56a);cursor:pointer;">' + esc(p.author || '佚名') + '</span>' +
          ' · v' + esc(p.version || '1.0.0') + (p.downloads ? ' · ↓' + p.downloads : '') + (p.endorsements ? ' · ✦' + p.endorsements : '') + (p.parentId ? ' · 改编' : '') +
        '</div>' +
        '<div style="margin-top:.28rem;">' + ratingStars(p) + '</div>' +
        (p.description ? '<div class="tm-pack-desc" style="margin-top:.35rem;">' + esc(p.description) + '</div>' : '') +
        tagHtml +
        rateControl(p) +
        '<div class="tm-actions" style="margin-top:.55rem;">' +
          action('在线安装', 'TMContentManager.installCatalogPack(' + jsArg(p.packageUrl || '') + ',' + jsArg(p.sha256 || '') + ',' + jsArg(p.id || '') + ')', 'primary', disabled) +
        '</div>' +
      '</div>' +
    '</div>';
  }

  // S2：剧本详情浮层 —— 从目录数据开局，best-effort 用 packMeta 刷新。
  function findCatalogPackById(id) {
    var packs = (state.catalog && state.catalog.packs) || [];
    for (var i = 0; i < packs.length; i++) if (String(packs[i].id) === String(id)) return packs[i];
    return state.detailPack && String(state.detailPack.id) === String(id) ? state.detailPack : null;
  }
  function openPackDetail(id) {
    var p = findCatalogPackById(id);
    if (!p) return;
    state.detailPack = p;
    state.detailOpen = true;
    state.detailComments = [];
    state.detailCommentCount = 0;
    state.detailCommentMsg = '';
    state.detailPlaying = -1;
    state.detailLineage = null;
    state.detailEndorsed = false;
    state.detailFollow = null;
    state.detailRevisions = [];
    state.revMsg = '';
    render();
    loadPackComments(id);
    loadDetailFollow(p.authorId);
    loadRevisions(id);
    try {
      if (window.TM && TM.OnlineClient && TM.OnlineClient.packMeta) {
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
    if (f) { f.isFollowing = !f.isFollowing; f.followers = Math.max(0, (f.followers || 0) + (f.isFollowing ? 1 : -1)); render(); } // 乐观
    TM.OnlineClient.follow(authorId, state.onlineApiUrl || undefined).then(function(res){
      if (res && res.success && state.detailFollow) {
        state.detailFollow.isFollowing = !!res.following;
        if (res.followers != null) state.detailFollow.followers = res.followers;
        render();
      }
    }).catch(function(){});
  }

  // S3 评论：加载 / 发表（走 TM.OnlineClient，桌面端 renderer 同样可用）。
  function loadPackComments(id) {
    try {
      if (window.TM && TM.OnlineClient && TM.OnlineClient.comments) {
        TM.OnlineClient.comments(id, state.onlineApiUrl || undefined).then(function(res){
          if (res && res.success && state.detailOpen && state.detailPack && String(state.detailPack.id) === String(id)) {
            state.detailComments = res.comments || [];
            state.detailCommentCount = res.count != null ? res.count : (res.comments || []).length;
            render();
          }
        }).catch(function(){});
      }
    } catch (e) {}
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
    if ((t === 'map' || t === 'mod') && assets.length) {
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
    return '<div class="sheet" role="dialog" aria-modal="true" aria-label="' + esc(packTypeNoun(ptype)) + '详情" onclick="if(event.target===this)TMContentManager.closePackDetail()">' +
      '<div class="sheet-box">' +
        '<div class="sh-head"><b>' + esc(packTypeNoun(ptype)) + '详情</b><button class="btn sm" style="margin-left:auto;" onclick="TMContentManager.closePackDetail()" aria-label="关闭详情">关闭</button></div>' +
        '<div class="sh-body scroll">' +
          '<div class="dhero">' + mallCover(p) +
            '<div>' +
              '<div style="font-size:11.5px;letter-spacing:2px;color:var(--gold-bright);">' + (official ? '官方' : '玩家') + esc(packTypeNoun(ptype)) + (tags.length ? ' · ' + esc(tags[0]) : '') + '</div>' +
              '<h2>' + esc(p.title || p.id) + '</h2>' +
              '<div class="dmeta">' + mallStars(p) + '<span>↓' + (p.downloads || 0) + '</span>' + (p.endorsements ? '<span>✦' + p.endorsements + '</span>' : '') + '<span>v' + esc(p.version || '1.0.0') + '</span>' + (p.size ? '<span>' + esc(formatBytes(p.size)) + '</span>' : '') + '</div>' +
              (tags.length ? '<div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:10px;">' + tags.slice(0, 6).map(function(t){ return '<span class="tag">' + esc(t) + '</span>'; }).join('') + '</div>' : '') +
              '<div class="dacts">' +
                '<button class="btn primary"' + (disabled ? ' disabled' : '') + ' onclick="TMContentManager.installCatalogPack(' + jsArg(p.packageUrl || '') + ',' + jsArg(p.sha256 || '') + ',' + jsArg(p.id || '') + ')">' + esc(packInstallLabel(ptype)) + '</button>' +
                (loggedIn ? '<span style="font-size:12px;color:var(--ink-dim);">评分 ' + rateStars + '</span>' : '') +
              '</div>' +
              '<div class="dacts" style="margin-top:8px;">' +
                '<button class="btn sm' + (isFavorite(p.id) ? ' primary' : '') + '" onclick="TMContentManager.toggleFavorite(' + jsArg(p.id || '') + ')">' + (isFavorite(p.id) ? '★ 已收藏' : '☆ 收藏') + '</button>' +
                (loggedIn ? '<button class="btn sm' + (state.detailEndorsed ? ' primary' : '') + '" onclick="TMContentManager.endorsePack()">✦ ' + (state.detailEndorsed ? '已推荐' : '推荐') + (p.endorsements ? ' ' + p.endorsements : '') + '</button>' : '') +
                (function(){
                  var df = state.detailFollow, su = (state.accountSession && state.accountSession.user);
                  var isSelf = su && su.id != null && String(su.id) === String(p.authorId);
                  if (!loggedIn || p.authorId == null || p.authorId === '' || isSelf) return '';
                  return '<button class="btn sm' + (df && df.isFollowing ? ' primary' : '') + '" onclick="TMContentManager.toggleFollow(' + jsArg(p.authorId) + ')">' + (df && df.isFollowing ? '✓ 已关注作者' : '＋ 关注作者') + (df && df.followers ? ' ' + df.followers : '') + '</button>';
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
          '<div class="dsec-h">作者</div><div><span style="color:var(--gold);cursor:pointer;text-decoration:underline;" onclick="TMContentManager.loadAuthorPacks(' + jsArg(p.authorId != null ? p.authorId : '') + ',' + jsArg(p.author || '') + ')">' + esc(p.author || '佚名') + '</span>' + (official ? ' <span class="pill good">官方认证</span>' : '') + '</div>' +
          '<div class="dsec-h">玩家评论' + (state.detailCommentCount ? ' · ' + state.detailCommentCount : '') + '</div>' +
          (loggedIn
            ? '<div class="field"><textarea id="tm-detail-comment" class="input" rows="2" placeholder="说说你的开局体验、攻略或建议…"></textarea></div><div style="margin:8px 0;"><button class="btn primary sm" onclick="TMContentManager.postPackComment()">发表评论</button></div>'
            : '<div class="dcopy">登录后可发表评论。</div>') +
          (state.detailCommentMsg ? '<div class="status" style="margin:6px 0;">' + esc(state.detailCommentMsg) + '</div>' : '') +
          ((state.detailComments && state.detailComments.length) ? state.detailComments.map(mallCommentRow).join('') : '<div class="dcopy" style="color:var(--ink-faint);">还没有评论，来做第一个。</div>') +
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
    if (!(window.TM && TM.OnlineClient && TM.OnlineClient.featured)) { render(); return; }
    TM.OnlineClient.featured(state.onlineApiUrl || undefined).then(function(res){
      state.featuredPacks = (res && res.packs) || []; render();
    }).catch(function(){ render(); });
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
    render();
    loadChronicles(sid);
  }
  function loadChronicles(sid) {
    if (!(window.TM && TM.OnlineClient && TM.OnlineClient.chronicles)) return;
    TM.OnlineClient.chronicles(sid, state.onlineApiUrl || undefined).then(function(res){
      if (res && res.success && state.chronOpen) { state.chronList = res.chronicles || []; render(); }
    }).catch(function(){});
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
    }).join('') : '<div class="empty"><div class="glyph">册</div><div class="t">还没有史册</div><div>写下第一篇结局</div></div>';
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
          '<div class="dsec-h">史册 · ' + (state.chronList || []).length + '</div>' + list +
          chain +
        '</div>' +
      '</div></div>';
  }

  // ===== M2 护城河：同台竞史(擂台) + 鉴赏家合集 =====
  var ARENA_METRIC = { years: '存续年数', territory: '疆域', minxin: '民心', huangwei: '皇威', treasury: '国库' };
  function loggedInNow() { return !!(window.TM && TM.OnlineClient && TM.OnlineClient.isLoggedIn && TM.OnlineClient.isLoggedIn()); }
  // --- 擂台 ---
  function loadArenas() {
    if (!(window.TM && TM.OnlineClient && TM.OnlineClient.arenas)) return;
    state.arenasLoading = true;
    TM.OnlineClient.arenas('', state.onlineApiUrl || undefined).then(function(res){
      state.arenaList = (res && res.arenas) || []; state.arenasLoaded = true; state.arenasLoading = false; render();
    }).catch(function(){ state.arenasLoading = false; render(); });
  }
  function openArena(id) {
    state.arenaOpen = true; state.arenaDetail = null; state.arenaMsg = ''; render();
    TM.OnlineClient.arenaDetail(id, state.onlineApiUrl || undefined).then(function(res){
      if (res && res.success && state.arenaOpen) { state.arenaDetail = res; render(); }
    }).catch(function(){});
  }
  function closeArena() { state.arenaOpen = false; state.arenaDetail = null; render(); }
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
    if (!d || !d.arena) { inner = '<div class="empty"><div class="glyph">擂</div><div class="t">正在开擂…</div></div>'; }
    else {
      var a = d.arena, board = d.leaderboard || [];
      var rows = board.length ? board.map(function(e){
        return '<div class="rk"><div class="n' + (e.rank <= 3 ? ' top' : '') + '">' + e.rank + '</div>' +
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
    if (!(window.TM && TM.OnlineClient && TM.OnlineClient.collections)) return;
    state.collectionsLoading = true;
    TM.OnlineClient.collections('', state.onlineApiUrl || undefined).then(function(res){
      state.collectionList = (res && res.collections) || []; state.collectionsLoaded = true; state.collectionsLoading = false; render();
    }).catch(function(){ state.collectionsLoading = false; render(); });
  }
  function openCollection(id) {
    state.collectionOpen = true; state.collectionDetail = null; render();
    TM.OnlineClient.collectionDetail(id, state.onlineApiUrl || undefined).then(function(res){
      if (res && res.success && state.collectionOpen) { state.collectionDetail = res; render(); }
    }).catch(function(){});
  }
  function closeCollection() { state.collectionOpen = false; state.collectionDetail = null; render(); }
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
    if (!d || !d.collection) { inner = '<div class="empty"><div class="glyph">集</div><div class="t">正在翻阅…</div></div>'; }
    else {
      var c = d.collection, packs = d.packs || [];
      inner = '<div class="dmeta"><span>策展 ' + esc(c.ownerNick) + '</span><span>' + c.count + ' 件</span></div>' +
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
    if (!state.collectionsLoaded) loadCollections(); else render();
  }
  function closeCollectionPicker() { state.colPickOpen = false; render(); }
  function pickCollection(cid) {
    var packId = state.colPickFor;
    if (!packId || !cid) return;
    TM.OnlineClient.collectionItem(cid, packId, 'add', state.onlineApiUrl || undefined).then(function(res){
      state.colPickMsg = res && res.success ? '已收入合集（' + (res.count || 0) + ' 件）。' : ('收入失败：' + ((res && res.error) || ''));
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
      return '<div class="rk" style="cursor:pointer;" onclick="TMContentManager.pickCollection(' + Number(c.id) + ')"><div class="n">集</div><div class="t"><b>' + esc(c.title) + '</b><small>' + c.count + ' 件 · ' + esc(c.ownerNick) + '</small></div><div style="color:var(--gold);">收入 ›</div></div>';
    }).join('') : '<div class="dcopy" style="color:var(--ink-faint);">还没有合集，下面新建一个。</div>';
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
    if (!(window.TM && TM.OnlineClient && TM.OnlineClient.circles)) return;
    state.circlesLoading = true;
    TM.OnlineClient.circles(state.onlineApiUrl || undefined).then(function(res){
      state.circleList = (res && res.circles) || []; state.circlesLoaded = true; state.circlesLoading = false; render();
    }).catch(function(){ state.circlesLoading = false; render(); });
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
    }).catch(function(){});
  }
  function openCircle(id) {
    state.circleOpen = true; state.circleDetailData = null; state.circleFeedData = null; state.circleMsg = ''; render();
    TM.OnlineClient.circleDetail(id, state.onlineApiUrl || undefined).then(function(res){
      if (res && res.success && state.circleOpen) { state.circleDetailData = res; render(); }
    }).catch(function(){});
    TM.OnlineClient.circleFeed(id, 1, state.onlineApiUrl || undefined).then(function(res){
      if (res && res.success && state.circleOpen) { state.circleFeedData = res.posts || []; render(); }
    }).catch(function(){});
  }
  function closeCircle() { state.circleOpen = false; state.circleDetailData = null; render(); }
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
        '<div class="au">圈主 ' + esc(c.ownerNick) + ' · ' + (c.members || 0) + ' 人</div>' +
        '<div class="rt"><span>' + (c.joined ? '已加入' : '点进去看看') + '</span><span style="color:var(--gold);">进圈 ›</span></div></div></div>';
    }).join('') : '<div class="empty"><div class="glyph">圈</div><div class="t">还没有圈子</div><div>建一个，聚同好</div></div>';
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
    if (!d || !d.circle) { inner = '<div class="empty"><div class="glyph">圈</div><div class="t">正在进圈…</div></div>'; }
    else {
      var c = d.circle;
      var isOwner = c.ownerId != null && String(c.ownerId) === String(selfId());
      var joinBtn = loggedInNow() ? (isOwner ? '<span class="tag">圈主</span>' : (c.joined ? '<button class="btn sm" onclick="TMContentManager.toggleCircleJoin(' + Number(c.id) + ',true)">退出</button>' : '<button class="btn sm primary" onclick="TMContentManager.toggleCircleJoin(' + Number(c.id) + ',false)">加入圈子</button>')) : '';
      var posts = state.circleFeedData || [];
      var feed = posts.length ? posts.map(feedCard).join('') : '<div class="empty"><div class="glyph">邸</div><div class="t">圈内还没动静</div></div>';
      var composer = (loggedInNow() && c.joined) ? '<div class="composer"><textarea id="tm-circle-post" class="input" rows="2" placeholder="在「' + esc(c.name) + '」发点什么…"></textarea><div style="display:flex;justify-content:flex-end;margin-top:8px;"><button class="btn primary sm" onclick="TMContentManager.postToCircle()">圈内发布</button></div></div>' : (loggedInNow() ? '<div class="status">加入后可在圈内发帖。</div>' : '');
      inner = '<div class="dmeta"><span>' + (c.topic ? esc(c.topic) + ' · ' : '') + '圈主 ' + esc(c.ownerNick) + '</span><span>' + (c.members || 0) + ' 人</span>' + joinBtn + '</div>' +
        (c.description ? '<div class="dcopy" style="margin-bottom:10px;">' + esc(c.description) + '</div>' : '') +
        composer + (state.circleMsg ? '<div class="status" style="margin:8px 0;">' + esc(state.circleMsg) + '</div>' : '') +
        '<div class="dsec-h">圈内动态 · ' + posts.length + '</div><div class="feed-list">' + feed + '</div>';
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
    if (!(window.TM && TM.OnlineClient && TM.OnlineClient.revisions)) return;
    TM.OnlineClient.revisions(packId, state.onlineApiUrl || undefined).then(function(res){
      if (res && res.success && state.detailOpen && state.detailPack && String(state.detailPack.id) === String(packId)) { state.detailRevisions = res.revisions || []; render(); }
    }).catch(function(){});
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
    }).catch(function(){});
  }
  function renderRevisionSection() {
    var p = state.detailPack; if (!p) return '';
    var revs = state.detailRevisions || [];
    var isAuthor = p.authorId != null && String(p.authorId) === String(selfId());
    var rows = revs.length ? revs.map(function(r){
      var st = r.status === 'accepted' ? '<span class="pill good">已采纳</span>' : (r.status === 'rejected' ? '<span class="pill bad">已婉拒</span>' : '<span class="pill">待处理</span>');
      var act = (isAuthor && r.status === 'open') ? '<div class="dacts" style="margin-top:6px;"><button class="btn sm primary" onclick="TMContentManager.respondRevisionUI(' + Number(r.id) + ',\'accept\')">采纳</button><button class="btn sm" onclick="TMContentManager.respondRevisionUI(' + Number(r.id) + ',\'reject\')">婉拒</button></div>' : '';
      return '<div class="chron"><div><b>' + esc(r.proposerNick) + '</b> ' + st + '</div><div class="dcopy" style="margin-top:4px;">' + esc(r.note) + '</div>' + act + '</div>';
    }).join('') : '<div class="dcopy" style="color:var(--ink-faint);">还没有修订提案。</div>';
    var form = loggedInNow() ? '<div class="field" style="margin-top:8px;"><textarea id="tm-rev-note" class="input" rows="2" placeholder="给作者提个修订建议（如：把某事件触发条件放宽）…"></textarea></div><div style="margin:6px 0;"><button class="btn sm" onclick="TMContentManager.proposeRevisionUI()">提交修订</button></div>' : '<div class="dcopy">登录后可提修订。</div>';
    return '<div class="dsec-h">共编修订' + (revs.length ? ' · ' + revs.length : '') + '</div>' +
      (state.revMsg ? '<div class="status" style="margin-bottom:6px;">' + esc(state.revMsg) + '</div>' : '') +
      form + rows;
  }
  // --- 约稿墙 ---
  function loadCommissions() {
    if (!(window.TM && TM.OnlineClient && TM.OnlineClient.commissions)) return;
    TM.OnlineClient.commissions(state.onlineApiUrl || undefined).then(function(res){
      state.commissionList = (res && res.commissions) || []; state.commissionsLoaded = true; render();
    }).catch(function(){});
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
    }).catch(function(){});
  }
  function renderCommissionSection() {
    if (!state.commissionsLoaded) { try { setTimeout(loadCommissions, 0); } catch (e) {} }
    var list = state.commissionList || [];
    var mine = selfId();
    var rows = list.length ? list.map(function(c){
      var canDm = loggedInNow() && String(c.requesterId) !== String(mine);
      var isMine = String(c.requesterId) === String(mine);
      return '<div class="upd-row"><div class="ic-up" style="font-family:var(--serif);">' + esc((COMM_KIND[c.kind] || '稿').charAt(0)) + '</div>' +
        '<div><b>' + esc(c.title) + ' <span class="tag">' + esc(COMM_KIND[c.kind] || c.kind) + '</span></b><small>' + esc(c.requesterNick) + (c.detail ? ' · ' + esc(c.detail) : '') + '</small></div>' +
        '<div style="display:flex;gap:6px;">' + (canDm ? '<button class="btn sm primary" onclick="TMContentManager.openDm(' + Number(c.requesterId) + ', ' + jsArg(c.requesterNick || '') + ')">接单私信</button>' : '') + (isMine ? '<button class="btn sm" onclick="TMContentManager.closeCommissionUI(' + Number(c.id) + ')">关闭</button>' : '') + '</div></div>';
    }).join('') : '<div class="empty"><div class="glyph">稿</div><div class="t">暂无约稿</div><div>发一条，求人给你的剧本配立绘/配乐</div></div>';
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
    return '<div class="tm-pack">' +
      '<div>' +
        '<div class="tm-pack-title">' + esc(rec.title || rec.packId) + badge + '</div>' +
        '<div class="tm-pack-meta">' + esc(rec.packId) + ' / v' + esc(rec.version || '1.0.0') + '</div>' +
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
  function loadFriends() {
    if (!(window.TM && TM.OnlineClient && TM.OnlineClient.isLoggedIn && TM.OnlineClient.isLoggedIn())) return;
    state.friendsLoading = true;
    Promise.all([
      TM.OnlineClient.friends(state.onlineApiUrl || undefined),
      TM.OnlineClient.friendRequests(state.onlineApiUrl || undefined)
    ]).then(function(r){
      var fr = r[0] || {}, rq = r[1] || {};
      state.friendsData = { friends: fr.friends || [], incoming: rq.incoming || [], outgoing: rq.outgoing || [] };
      state.friendsLoaded = true;
      state.friendsLoading = false;
      render();
    }).catch(function(){ state.friendsLoading = false; });
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
    }).join('') : '<div class="tm-empty">还没有好友，搜对方用户名加一个。</div>';
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
    TM.OnlineClient.requestFriend(to, state.onlineApiUrl || undefined).then(function(res){
      if (res && res.success) state.friendMessage = res.status === 'accepted' ? ('已与「' + (res.nickname || to) + '」结为好友。') : ('已向「' + (res.nickname || to) + '」发送好友申请。');
      else state.friendMessage = '申请失败：' + ((res && res.error) || '未知错误');
      state.friendsLoaded = false; loadFriends();
    }).catch(function(e){ state.friendMessage = '申请失败：' + (e && e.message || '网络错误'); render(); });
  }
  function respondFriendUI(userId, action) {
    TM.OnlineClient.respondFriend(userId, action, state.onlineApiUrl || undefined).then(function(res){
      state.friendMessage = (res && res.success) ? (action === 'accept' ? '已接受好友申请。' : '已拒绝申请。') : ('操作失败：' + ((res && res.error) || ''));
      state.friendsLoaded = false; loadFriends();
    }).catch(function(){ state.friendMessage = '操作失败。'; render(); });
  }
  function removeFriendUI(userId) {
    TM.OnlineClient.removeFriend(userId, state.onlineApiUrl || undefined).then(function(res){
      state.friendMessage = (res && res.success) ? '已删除好友。' : '操作失败。';
      state.friendsLoaded = false; loadFriends();
    }).catch(function(){ state.friendMessage = '操作失败。'; render(); });
  }

  // P2-S3 通知中心。
  function loadNotifs() {
    if (!(window.TM && TM.OnlineClient && TM.OnlineClient.isLoggedIn && TM.OnlineClient.isLoggedIn())) return;
    state.notifLoading = true;
    TM.OnlineClient.notifications(state.onlineApiUrl || undefined).then(function(res){
      state.notifData = { notifications: (res && res.notifications) || [], unread: (res && res.unread) || 0 };
      state.notifLoaded = true; state.notifLoading = false; render();
    }).catch(function(){ state.notifLoading = false; });
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
    }).join('') : '<div class="tm-empty">暂无通知。</div>';
    return '<section class="tm-panel" style="margin-top:.8rem;">' +
      '<h4>通知' + (d.unread ? ' · <span class="tm-unread">' + d.unread + ' 未读</span>' : '') + '</h4>' +
      '<div class="tm-actions" style="margin-top:.2rem;">' +
        '<button class="tm-action primary" onclick="TMContentManager.openDmInbox()">私信</button>' +
        (d.unread ? '<button class="tm-action" onclick="TMContentManager.markAllNotif()">全部已读</button>' : '') +
        '<button class="tm-action" onclick="TMContentManager.refreshNotifs()">刷新</button>' +
      '</div>' +
      '<div class="tm-notif-list">' + rows + '</div>' +
    '</section>';
  }
  function markNotif(id) {
    TM.OnlineClient.markNotificationRead(id, state.onlineApiUrl || undefined).then(function(){ state.notifLoaded = false; loadNotifs(); }).catch(function(){});
  }
  function markAllNotif() {
    TM.OnlineClient.markNotificationRead(true, state.onlineApiUrl || undefined).then(function(){ state.notifLoaded = false; loadNotifs(); }).catch(function(){});
  }
  function refreshNotifs() { state.notifLoaded = false; loadNotifs(); }

  // P2-S2 私信浮层。
  function openDmInbox() {
    state.dmOpen = true; state.dmView = 'inbox'; state.dmPeer = null; state.dmMsg = ''; render();
    TM.OnlineClient.inbox(state.onlineApiUrl || undefined).then(function(res){
      if (res && res.success) { state.dmInbox = res.conversations || []; render(); }
    }).catch(function(){});
  }
  function openDm(userId, nickname) {
    state.dmOpen = true; state.dmView = 'chat'; state.dmPeer = { id: userId, nickname: nickname }; state.dmMessages = []; state.dmMsg = ''; render();
    loadConversation(userId);
  }
  function openDmFromNotif(userId, nickname, notifId) {
    if (notifId) { TM.OnlineClient.markNotificationRead(notifId, state.onlineApiUrl || undefined).then(function(){ state.notifLoaded = false; loadNotifs(); }).catch(function(){}); }
    openDm(userId, nickname);
  }
  function loadConversation(userId) {
    TM.OnlineClient.conversation(userId, state.onlineApiUrl || undefined).then(function(res){
      if (res && res.success && state.dmOpen && state.dmPeer && Number(state.dmPeer.id) === Number(userId)) {
        state.dmMessages = res.messages || [];
        if (res.peer && res.peer.nickname) state.dmPeer.nickname = res.peer.nickname;
        render();
      }
    }).catch(function(){});
  }
  function closeDm() { state.dmOpen = false; state.dmView = 'inbox'; state.dmPeer = null; render(); }
  function sendDm() {
    var el = document.getElementById('tm-dm-input');
    var text = el ? el.value.trim() : '';
    if (!text || !state.dmPeer) return;
    state.dmMsg = '';
    TM.OnlineClient.sendMessage(state.dmPeer.id, text, state.onlineApiUrl || undefined).then(function(res){
      if (res && res.success) { loadConversation(state.dmPeer.id); }
      else { state.dmMsg = '发送失败：' + ((res && res.error) || ''); render(); }
    }).catch(function(){ state.dmMsg = '发送失败。'; render(); });
  }
  function renderDmLayer() {
    if (!state.dmOpen) return '';
    var av = function(n){ return '<div class="av seal">' + esc(String(n || '友').charAt(0)) + '</div>'; };
    var head, body;
    if (state.dmView === 'chat' && state.dmPeer) {
      var msgs = (state.dmMessages || []).length ? state.dmMessages.map(function(m){
        return '<div class="bub ' + (m.fromMe ? 'me' : 'them') + '">' + esc(m.text) + '</div>';
      }).join('') : '<div class="empty"><div class="t">还没有消息</div><div>发第一条</div></div>';
      head = '<button class="btn sm" onclick="TMContentManager.openDmInbox()">‹ 私信</button><b>' + esc(state.dmPeer.nickname || '对话') + '</b>';
      body = '<div class="dm-thread" style="height:62vh;min-height:340px;">' +
        '<div class="dm-msgs">' + msgs + '</div>' +
        (state.dmMsg ? '<div class="status">' + esc(state.dmMsg) + '</div>' : '') +
        '<div class="dm-input"><input class="input" id="tm-dm-input" placeholder="写条私信…" onkeydown="if(event.key===\'Enter\'){TMContentManager.sendDm();}"><button class="btn primary" onclick="TMContentManager.sendDm()">发送</button></div>' +
      '</div>';
    } else {
      var list = (state.dmInbox || []).length ? state.dmInbox.map(function(c){
        return '<div class="dm-c" onclick="TMContentManager.openDm(' + Number(c.userId) + ', ' + jsArg(c.nickname || '') + ')">' + av(c.nickname) +
          '<div><b>' + esc(c.nickname) + (c.unread ? ' <span class="tag">' + c.unread + '</span>' : '') + '</b><small>' + (c.fromMe ? '我：' : '') + esc(c.lastText || '') + '</small></div></div>';
      }).join('') : '<div class="empty"><div class="glyph">✉</div><div class="t">还没有私信</div><div>从好友列表点「私信」开始聊</div></div>';
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
    return '';
  }
  function packGalleryImages(p) {
    var g = p && p.galleryImages;
    return Array.isArray(g) ? g.filter(function(x){ return x && x.url; }).slice(0, 6) : [];
  }
  function mallCover(p, sizeStyle) {
    var g = mallGlyph(p);
    var tags = Array.isArray(p && p.tags) ? p.tags : [];
    var official = (p && p.author === '天命官方') || tags.indexOf('官方') >= 0;
    var ptype = String((p && p.type) || 'scenario');
    var tone = (window.TMWorkshopCovers && TMWorkshopCovers.tone) ? TMWorkshopCovers.tone(g) : 'zhu';
    var coverUrl = packCoverUrl(p);
    var inner = (window.TMWorkshopCovers && TMWorkshopCovers.coverInner)
      ? TMWorkshopCovers.coverInner(g, { official: official, type: ptype, typeLabel: ptype !== 'scenario' ? packTypeLabel(ptype) : '' })
      : ('<span class="glyph">' + esc(g) + '</span>');
    if (coverUrl) inner = '<img class="cover-img" src="' + esc(coverUrl) + '" alt="">';
    return '<div class="cover ' + tone + '"' + (sizeStyle ? ' style="' + sizeStyle + '"' : '') + '>' + inner + '</div>';
  }
  function mallStars(p) {
    var r = Number(p && p.rating) || 0;
    var full = Math.round(r);
    var s = '';
    for (var i = 1; i <= 5; i++) s += (i <= full ? '★' : '☆');
    return '<span class="stars">' + s + (r ? ' <i>' + r.toFixed(1) + '</i>' : '') + '</span>';
  }
  function mallCard(p) {
    var tags = Array.isArray(p.tags) ? p.tags.filter(Boolean).slice(0, 3) : [];
    return '<div class="card" onclick="TMContentManager.openPackDetail(' + jsArg(p.id || '') + ')">' +
      mallCover(p) +
      '<div class="pad">' +
        '<h4>' + esc(p.title || p.id) + '</h4>' +
        '<div class="au">' + esc(p.author || '佚名') + (p.parentId ? ' · 改编' : '') + '</div>' +
        '<div class="rt">' + mallStars(p) + '<span>↓' + (p.downloads || 0) + (p.endorsements ? ' · ✦' + p.endorsements : '') + '</span></div>' +
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
    var feat = '<span class="chip' + (featuredOn ? ' on' : '') + '" onclick="TMContentManager.toggleFeatured()">✦ 社区精选</span>';
    return '<div class="typebar">' + feat + PACK_TYPES.map(function(t){
      var n = t.v ? packs.filter(function(pp){ return String(pp.type || 'scenario') === t.v; }).length : packs.length;
      return '<span class="chip' + (!featuredOn && ctype === t.v ? ' on' : '') + '" onclick="TMContentManager.switchCatalogType(' + jsArg(t.v) + ')">' + esc(t.label) + (packs.length ? ' ' + n : '') + '</span>';
    }).join('') + '</div>';
  }
  function renderDiscover() {
    var packs = (state.catalog && state.catalog.packs) || [];
    if (!packs.length) {
      var heroHtml = '<div class="searchhero"><h2>访古问今 · 列朝在此</h2><p>浏览、安装其他玩家与官方的史册剧本；也可把你的剧本发布给天下人。</p>' +
        '<div class="box"><input id="tm-mall-hq" placeholder="输入朝代、事件、人物或作者…" onkeydown="if(event.key===\'Enter\')TMContentManager.mallSearch(this.value)"><button class="btn primary" onclick="TMContentManager.loadWorkshopCatalog()">载入目录</button></div></div>';
      if (state.catalogLoading) {
        return heroHtml + '<div class="sec-h"><h3>正在载入目录…</h3></div>' + mallSkeleton(8);
      }
      return heroHtml +
        '<div class="empty"><div class="glyph">坊</div><div class="t">尚未载入在线目录</div><div>点上方「载入目录」从官方目录浏览并安装。</div></div>';
    }
    var sorted = packs.slice();
    var hot = sorted.slice().sort(function(a, b){ return (b.downloads || 0) - (a.downloads || 0); });
    var feat = hot[0] || packs[0];
    var fside = hot.slice(1, 4);
    var fg = mallGlyph(feat);
    var ftone = (window.TMWorkshopCovers && TMWorkshopCovers.tone) ? TMWorkshopCovers.tone(fg) : 'zhu';
    var fscene = (window.TMWorkshopCovers && TMWorkshopCovers.sceneSVG) ? TMWorkshopCovers.sceneSVG(fg, feat.type) : '';
    var featBanner =
      '<div class="feat-main" onclick="TMContentManager.openPackDetail(' + jsArg(feat.id || '') + ')">' +
        '<div class="bg cover ' + ftone + '" style="border:none;">' + fscene + '</div>' +
        '<div class="ov">' +
          '<div class="kick">' + ((feat.author === '天命官方') ? '官方剧本 · 编辑推荐' : '编辑推荐') + '</div>' +
          '<h2>' + esc(feat.title || feat.id) + '</h2>' +
          (feat.description ? '<p>' + esc(feat.description) + '</p>' : '') +
          '<div class="row">' + mallStars(feat) + '<span style="font-size:12px;color:var(--ink-dim);">↓' + (feat.downloads || 0) + '</span>' +
            '<button class="btn primary" onclick="event.stopPropagation();TMContentManager.openPackDetail(' + jsArg(feat.id || '') + ')">查看详情</button></div>' +
        '</div>' +
      '</div>';
    var fsideHtml = fside.map(function(p){
      return '<div class="fs" onclick="TMContentManager.openPackDetail(' + jsArg(p.id || '') + ')">' + mallCover(p, 'width:62px;height:62px;font-size:26px;') +
        '<div><b>' + esc(p.title || p.id) + '</b><small>' + esc(p.author || '佚名') + ' · ↓' + (p.downloads || 0) + '</small></div></div>';
    }).join('') || '<div class="fs"><div style="color:var(--ink-faint);font-size:12px;">更多内容陆续上架</div></div>';
    var hotGrid = hot.slice(0, 8).map(mallCard).join('');
    var rail = hot.slice(0, 6).map(function(p, i){
      return '<div class="rk" onclick="TMContentManager.openPackDetail(' + jsArg(p.id || '') + ')"><div class="n' + (i < 3 ? ' top' : '') + '">' + (i + 1) + '</div>' +
        '<div class="t"><b>' + esc(p.title || p.id) + '</b><small>' + esc(p.author || '佚名') + ' · ↓' + (p.downloads || 0) + '</small></div></div>';
    }).join('');
    return '' +
      '<div class="searchhero"><h2>访古问今 · 列朝在此</h2><p>浏览、安装其他玩家与官方的史册剧本；也可把你的剧本发布给天下人。</p>' +
        '<div class="box"><input id="tm-mall-hq" value="' + esc(state.catalogQuery || '') + '" placeholder="输入朝代、事件、人物或作者…" onkeydown="if(event.key===\'Enter\')TMContentManager.mallSearch(this.value)"><button class="btn primary" onclick="TMContentManager.mallSearch(document.getElementById(\'tm-mall-hq\').value)">搜索</button></div></div>' +
      mallTypeChips() +
      '<div class="sec-h"><h3>本周精选</h3><span class="more" onclick="TMContentManager.switchPane(\'browse\')">看全部 ›</span></div>' +
      '<div class="feature">' + featBanner + '<div class="feat-side">' + fsideHtml + '</div></div>' +
      '<div class="sec-h"><h3>按类浏览</h3></div>' +
      '<div class="cats">' + PACK_TYPES.filter(function(t){ return t.v; }).map(function(t){
        var n = packs.filter(function(pp){ return String(pp.type || 'scenario') === t.v; }).length;
        return '<div class="cat" onclick="TMContentManager.switchCatalogType(' + jsArg(t.v) + ');TMContentManager.switchPane(\'browse\')"><div class="g">' + esc(t.label.charAt(0)) + '</div><b>' + esc(t.label) + '</b><small>' + n + ' 件</small></div>';
      }).join('') + '</div>' +
      '<div class="sec-h"><h3>热门下载</h3><span class="more" onclick="TMContentManager.switchPane(\'browse\')">更多 ›</span></div>' +
      '<div class="cols"><div><div class="grid">' + hotGrid + '</div></div>' +
        '<aside><div class="rail"><h4>下载榜</h4>' + rail + '</div>' +
          '<div class="becre"><b>成为创作者</b><p>登录后即可发布剧本、立绘、音乐，加入世界线与史册接龙。</p><button class="btn primary sm" onclick="TMContentManager.switchPane(\'studio\')">前往创作</button></div>' +
        '</aside></div>';
  }
  function mallFopt(label, count, active, onclick) {
    return '<div class="fopt" onclick="' + onclick + '"><span style="margin-left:0;color:' + (active ? 'var(--gold-bright)' : 'var(--ink-faint)') + ';">' + (active ? '◉' : '○') + '</span>' + esc(label) + '<span>' + (count != null ? count : '') + '</span></div>';
  }
  function renderBrowsePane() {
    var packs = (state.catalog && state.catalog.packs) || [];
    var ctype = state.catalogType || '';
    var featuredOn = !!state.featuredOn;
    var base = featuredOn ? (state.featuredPacks || []) : packs;
    var shown = (!featuredOn && ctype) ? base.filter(function(pp){ return String(pp.type || 'scenario') === ctype; }) : base;
    var grid = shown.length ? shown.map(mallCard).join('')
      : (state.catalogLoading ? mallSkeleton(8)
        : '<div class="empty"><div class="glyph">坊</div><div class="t">' + (featuredOn ? '还没有被社区推荐的内容' : (packs.length ? '此类型下暂无内容' : '尚未载入在线目录')) + '</div><div>' + (packs.length ? '换个类型或来源看看' : '点右侧「刷新」从官方目录浏览') + '</div></div>');
    var typeOpts = PACK_TYPES.map(function(t){
      var n = t.v ? packs.filter(function(pp){ return String(pp.type || 'scenario') === t.v; }).length : packs.length;
      return mallFopt(t.label, n, !featuredOn && ctype === t.v, 'TMContentManager.switchCatalogType(' + jsArg(t.v) + ')');
    }).join('');
    var authorView = state.catalogAuthorView;
    var head = authorView ? ('作者：' + authorView) : (featuredOn ? '社区精选' : (ctype ? packTypeLabel(ctype) : '全部内容'));
    return (authorView ? '<div class="status" style="margin-bottom:10px;">正在看作者「' + esc(authorView) + '」的作品 <span style="cursor:pointer;color:var(--gold);text-decoration:underline;margin-left:8px;" onclick="TMContentManager.loadWorkshopCatalog()">← 返回全部目录</span></div>' : '') +
    '<div class="browse">' +
      '<aside class="filters">' +
        '<h4>筛选</h4>' +
        '<div class="fgrp"><div class="flbl">内容类型</div>' + typeOpts + '</div>' +
        '<div class="fgrp"><div class="flbl">来源</div>' + mallFopt('✦ 社区精选', null, featuredOn, 'TMContentManager.toggleFeatured()') + '</div>' +
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
    if (!packs.length) return '<div class="sec-h"><h3>排行榜</h3></div><div class="empty"><div class="glyph">榜</div><div class="t">尚未载入目录</div></div>';
    function rankList(arr, fmt) {
      return arr.slice(0, 10).map(function(p, i){
        return '<div class="rk" onclick="TMContentManager.openPackDetail(' + jsArg(p.id || '') + ')"><div class="n' + (i < 3 ? ' top' : '') + '">' + (i + 1) + '</div>' +
          '<div class="t"><b>' + esc(p.title || p.id) + '</b><small>' + esc(p.author || '佚名') + ' · ' + fmt(p) + '</small></div></div>';
      }).join('');
    }
    var byDown = packs.slice().sort(function(a, b){ return (b.downloads || 0) - (a.downloads || 0); });
    var byRate = packs.slice().sort(function(a, b){ return (b.rating || 0) - (a.rating || 0); });
    var byEnd = packs.slice().sort(function(a, b){ return (b.endorsements || 0) - (a.endorsements || 0); });
    return '<div class="sec-h"><h3>排行榜</h3></div>' +
      '<div class="cols" style="grid-template-columns:1fr 1fr 1fr;">' +
        '<div class="rail"><h4>下载榜</h4>' + rankList(byDown, function(p){ return '↓' + (p.downloads || 0); }) + '</div>' +
        '<div class="rail"><h4>口碑榜</h4>' + rankList(byRate, function(p){ return '★' + ((p.rating || 0).toFixed ? p.rating.toFixed(1) : p.rating); }) + '</div>' +
        '<div class="rail"><h4>社区推荐榜</h4>' + rankList(byEnd, function(p){ return '✦' + (p.endorsements || 0); }) + '</div>' +
      '</div>' +
      renderArenaSection();
  }
  function renderArenaSection() {
    if (!state.arenasLoaded && !state.arenasLoading) { try { setTimeout(loadArenas, 0); } catch (e) {} }
    var arenas = state.arenaList || [];
    var cards = arenas.length ? '<div class="grid" style="grid-template-columns:repeat(2,minmax(0,1fr));">' + arenas.map(function(a){
      return '<div class="card" style="cursor:pointer;" onclick="TMContentManager.openArena(' + Number(a.id) + ')"><div class="pad">' +
        '<h4>' + esc(a.title) + '</h4><div class="au">擂主 ' + esc(a.creatorNick) + ' · 比' + esc(ARENA_METRIC[a.metric] || a.metric) + '</div>' +
        '<div class="rt"><span>' + (a.entries || 0) + ' 人上榜</span><span style="color:var(--gold);">看榜 ›</span></div></div></div>';
    }).join('') + '</div>'
      : '<div class="empty"><div class="glyph">擂</div><div class="t">还没有擂台</div><div>开一个，约人同台竞史</div></div>';
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
    var topics = [
      { glyph: '启', tone: 'zhu', title: '明末风云', sub: '天启崇祯，社稷飘摇', cls: '', onclick: 'TMContentManager.mallSearch(' + jsArg('明末') + ')' },
      { glyph: '绍', tone: 'qing', title: '南宋中兴', sub: '建炎绍兴，重整山河', cls: 'b', onclick: 'TMContentManager.mallSearch(' + jsArg('南宋') + ')' },
      { glyph: '贞', tone: 'jin', title: '盛唐气象', sub: '贞观开元，万邦来朝', cls: 'c', onclick: 'TMContentManager.mallSearch(' + jsArg('唐') + ')' }
    ];
    var plays = [
      { glyph: '绘', tone: 'jiang', type: 'portrait', title: '立绘美术', sub: '给你的剧本换张脸', cls: 'c', onclick: 'TMContentManager.switchCatalogType(\'portrait\');TMContentManager.switchPane(\'browse\')' },
      { glyph: '音', tone: 'dai', type: 'music', title: '古风配乐', sub: '朝堂边关，各得其声', cls: 'b', onclick: 'TMContentManager.switchCatalogType(\'music\');TMContentManager.switchPane(\'browse\')' },
      { glyph: '创', tone: 'zhe', title: 'AI 共创', sub: '一句话起草你的史册', cls: '', onclick: 'TMContentManager.switchPane(\'studio\')' }
    ];
    return '<div class="sec-h"><h3>专题策划</h3></div>' +
      '<div class="promos">' + topics.map(promoCard).join('') + '</div>' +
      '<div class="sec-h"><h3>玩法精选</h3></div>' +
      '<div class="promos">' + plays.map(promoCard).join('') + '</div>' +
      renderCollectionSection();
  }
  function renderCollectionSection() {
    if (!state.collectionsLoaded && !state.collectionsLoading) { try { setTimeout(loadCollections, 0); } catch (e) {} }
    var cols = state.collectionList || [];
    var cards = cols.length ? '<div class="grid" style="grid-template-columns:repeat(3,minmax(0,1fr));">' + cols.map(function(c){
      return '<div class="card" style="cursor:pointer;" onclick="TMContentManager.openCollection(' + Number(c.id) + ')"><div class="pad">' +
        '<h4>' + esc(c.title) + '</h4><div class="au">' + esc(c.ownerNick) + ' 策展 · ' + (c.count || 0) + ' 件</div>' +
        (c.description ? '<div class="rt"><span style="color:var(--ink-faint);">' + esc(c.description) + '</span></div>' : '') + '</div></div>';
    }).join('') + '</div>'
      : '<div class="empty"><div class="glyph">集</div><div class="t">还没有合集</div><div>把好作品策成一辑，分享给同好</div></div>';
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
  // ===== A 史馆动态流 =====
  var FEED_TYPE_LABEL = { highlight: '局势高光', publish: '新作发布', chronicle: '史册落成', relay: '接龙邀请', milestone: '里程碑' };
  function loadFeed() {
    if (!(window.TM && TM.OnlineClient)) return;
    var scope = state.feedScope || 'recommend';
    state.feedLoading = true;
    TM.OnlineClient.feed(scope, 1, state.onlineApiUrl || undefined).then(function(res){
      state.feedData = res && res.success ? res : { posts: [] };
      if (res && res.success === false && res.error) state.feedMsg = res.error;
      state.feedLoaded = true; state.feedLoading = false; render();
    }).catch(function(e){ state.feedLoading = false; state.feedMsg = '动态载入失败：' + (e && e.message || '未知'); render(); });
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
    if (p) { p.liked = !p.liked; p.likes = Math.max(0, (p.likes || 0) + (p.liked ? 1 : -1)); render(); } // 乐观更新
    TM.OnlineClient.likePost(id, state.onlineApiUrl || undefined).then(function(res){
      if (res && res.success && p) { p.liked = !!res.liked; if (res.likes != null) p.likes = res.likes; render(); }
    }).catch(function(){});
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
        '<span class="pa' + (liked ? ' on' : '') + '" onclick="TMContentManager.likeFeedPost(' + jsArg(post.id) + ')">♡ ' + (post.likes || 0) + '</span>' +
        '<span class="pa">评 ' + (post.commentCount || 0) + '</span>' +
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
      : (posts.length
          ? posts.map(feedCard).join('')
          : '<div class="empty"><div class="glyph">邸</div><div class="t">' + (scope === 'following' ? '关注的人还没有新动态' : '动态广场暂时安静') + '</div><div>' + (loggedIn ? '发一条今日时局，开个头。' : '登录后关注作者、发动态。') + '</div></div>');
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
    if (pane === 'topics') return renderTopicsPane();
    if (pane === 'circles') return renderCirclesPane();
    if (pane === 'studio') return renderStudioPane();
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
    var canSubmit = !!(user && publishPackageReady());
    var fork = (state.forkSource && state.forkSource.id) ? '<div class="status">改编自「' + esc(state.forkSource.title || state.forkSource.id) + '」，发布后记入它的世界线。 <span style="cursor:pointer;color:var(--gold);text-decoration:underline;" onclick="TMContentManager.clearFork()">取消改编</span></div>' : '';
    return '<div class="sec-h"><h3>创作中心 · 发布申请</h3><span class="more">资源包 + 商店信息齐备后进入审核</span></div>' +
      fork +
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
      (state.publishMessage ? '<div class="status" style="margin-top:10px;">' + esc(state.publishMessage) + '</div>' : '') +
      renderCommissionSection();
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
    }).join('') : '<div class="empty"><div class="glyph">友</div><div class="t">还没有好友</div><div>搜对方用户名加一个</div></div>';
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
      hero = '<div class="update-hero ' + (avail ? 'avail' : (checked ? 'ok' : '')) + '"><div class="uh-top">' +
          '<div class="uh-ic">⇪</div>' +
          '<div class="uh-id"><b>前端热更</b><small>不重装安装包即可收到 UI / 剧本 / 立绘 / 音乐更新</small>' + stateLine + '</div>' +
          '<div class="uh-acts">' + acts + '</div>' +
        '</div>' +
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
          '<div><b>' + esc(rec.title || rec.id) + (missing ? '<span class="upd-badge" style="border-color:rgba(231,105,82,.5);color:#f0b7a8;background:rgba(120,31,23,.2);">文件缺失</span>' : '') + (en ? '' : '<span class="upd-badge" style="border-color:var(--line);color:var(--ink-faint);background:transparent;">已停用</span>') + '</b><small>' + esc(rec.id) + ' · v' + esc(rec.version || '1.0.0') + '</small></div>' +
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
        '<div><b>' + esc(rec.title || rec.packId) + (upd ? '<span class="upd-badge">有新版 ' + esc(upd.to) + '</span>' : '') + '</b><small>' + esc(rec.packId) + ' · v' + esc(rec.version || '1.0.0') + '</small></div>' +
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
    var dl = works.reduce(function(s, p){ return s + (p.downloads || 0); }, 0);
    var en = works.reduce(function(s, p){ return s + (p.endorsements || 0); }, 0);
    var rated = works.some(function(p){ return (p.ratingCount || 0) >= 5; });
    var forked = works.some(function(p){ return p.parentId; });
    var list = [
      { g: '命', t: '入籍天命', s: '已注册账号', on: true },
      { g: '著', t: '已发布作者', s: works.length + ' 件作品', on: works.length > 0 },
      { g: '众', t: '千人传抄', s: '累计下载逾千', on: dl >= 1000 },
      { g: '荐', t: '众望所归', s: '获社区推荐', on: en > 0 },
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
  // 声望（客户端一阶估算·权重抗刷:被荐/被收藏高、下载低·服务器版后续接管为权威）
  function computeReputation(works, extra) {
    extra = extra || {};
    var dl = works.reduce(function(s, p){ return s + (p.downloads || 0); }, 0);
    var en = works.reduce(function(s, p){ return s + (p.endorsements || 0); }, 0);
    var rc = works.reduce(function(s, p){ return s + (p.ratingCount || 0); }, 0);
    return Math.round(works.length * 120 + dl * 0.6 + en * 40 + rc * 10 + (extra.friends || 0) * 15);
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
    var friendN = (state.friendsData && state.friendsData.friends) ? state.friendsData.friends.length : 0;
    var official = (user.nickname === '天命官方' || user.username === '天命官方');
    var reputation = computeReputation(works, { friends: friendN });
    var rankInfo = socialRankFor(reputation);
    try { setTimeout(syncServerFavorites, 0); setTimeout(loadMyFollow, 0); } catch (e) {}
    var mf = state.myFollow;
    var repPct = rankInfo.next ? Math.max(4, Math.round((reputation - rankInfo.cur.v) / (rankInfo.next.v - rankInfo.cur.v) * 100)) : 100;
    var heroTitles = '<span class="rank-chip">' + esc(rankInfo.cur.name) + '</span>' +
      (works.length ? '<span class="rank-chip cert">认证作者</span>' : '') +
      (official ? '<span class="rank-chip cert">官方</span>' : '');
    var card = '<div class="acct-hero"><div class="ah-wm serif">' + esc(String(user.nickname || user.username).charAt(0)) + '</div>' +
      '<div class="ah-top">' +
        '<div class="ah-seal seal serif">' + esc(String(user.nickname || user.username).charAt(0)) + '</div>' +
        '<div class="ah-id"><b>' + esc(user.nickname || user.username) + '</b>' +
          '<div class="ah-titles">' + heroTitles + '</div>' +
          '<small>@' + esc(user.username) + (user.email ? ' · ' + esc(user.email) : '') + '</small>' +
          (mf ? '<div class="ah-follow">关注 <b>' + (mf.following || 0) + '</b> · 粉丝 <b>' + (mf.followers || 0) + '</b></div>' : '') +
        '</div>' +
        '<div class="ah-acts">' +
          '<button class="btn sm primary" onclick="TMContentManager.switchPane(\'studio\')">去创作</button>' +
          '<button class="btn sm" onclick="TMContentManager.openDmInbox()">私信箱</button>' +
          '<button class="btn sm" onclick="TMContentManager.accountLogout()">退出</button>' +
        '</div>' +
      '</div>' +
      '<div class="ah-rank"><div class="ah-rank-head"><b>' + esc(rankInfo.cur.name) + (rankInfo.next ? '<span class="nxt">→ ' + esc(rankInfo.next.name) + '</span>' : '') + '</b>' +
        '<span>' + (rankInfo.next ? '声望 ' + reputation + ' / ' + rankInfo.next.v : '声望 ' + reputation + ' · 已至顶阶') + '</span></div>' +
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
      }).join('') : '<div class="empty"><div class="glyph">铃</div><div class="t">暂无通知</div></div>';
      content = '<div style="display:flex;gap:8px;margin-bottom:10px;">' + (d.unread ? '<button class="btn sm" onclick="TMContentManager.markAllNotif()">全部已读</button>' : '') + '<button class="btn sm" onclick="TMContentManager.refreshNotifs()">刷新</button></div>' + rows;
    } else if (meTab === 'installed') {
      content = renderInstalledMall();
    } else if (meTab === 'friends') {
      content = renderFriendsPaneMall();
    } else {
      var totalDl = works.reduce(function(s, p){ return s + (p.downloads || 0); }, 0);
      var totalEn = works.reduce(function(s, p){ return s + (p.endorsements || 0); }, 0);
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
          '<div><b>' + totalDl + '</b><small>累计下载</small></div>' +
          '<div><b>' + totalEn + '</b><small>社区推荐</small></div>' +
          '<div><b>' + friendN + '</b><small>好友</small></div>' +
        '</div>' +
        '<div class="sec-h"><h3>列传 · 我的发布</h3>' + (works.length ? '<span class="more" onclick="TMContentManager.switchPane(\'studio\')">发布新作 ›</span>' : '') + '</div>' + worksHtml +
        '<div class="sec-h"><h3>收藏阁' + (favWorks.length ? ' · ' + favWorks.length : '') + '</h3></div>' + favHtml +
        '<div class="sec-h"><h3>战绩 · 历代亲历</h3></div>' +
          '<div class="empty"><div class="glyph">史</div><div class="t">还没有战绩</div><div>通关后自动留痕：存续年数、疆域、结局。</div></div>' +
        '<div class="sec-h"><h3>功业 · 成就</h3></div>' + renderBadges(works) +
        '<div class="sec-h"><h3>履历 · 近况</h3></div>' + renderHeatmap(activityEvents) +
        '<div class="sec-h"><h3>题跋 · 他人评说</h3></div>' +
          '<div class="empty"><div class="glyph">跋</div><div class="t">暂无题跋</div><div>别人对你作品的评价与留言会汇集于此。</div></div>' +
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

  function render() {
    var bg = ensureLayer();
    var pane = state.pane || 'discover';
    var user = (state.accountSession || {}).user;
    var idLabel = user ? (user.nickname || user.username) : '登录';
    var notifUnread = (state.notifData && state.notifData.unread) || 0;
    var navItems = [['discover', '发现'], ['feed', '动态'], ['browse', '浏览'], ['ranks', '排行'], ['topics', '专题'], ['circles', '圈子'], ['studio', '创作'], ['friends', '好友'], ['me', '我']];
    var nav = navItems.map(function(it){ return '<a class="' + (pane === it[0] ? 'on' : '') + '" onclick="TMContentManager.switchPane(\'' + it[0] + '\')">' + it[1] + '</a>'; }).join('');
    bg.innerHTML = '<main class="tm-mall tm-mall-page" role="main" aria-label="天命创意工坊" tabindex="-1">' +
      '<div class="topbar">' +
        '<div class="brand"><div class="seal" style="width:36px;height:36px;border-radius:6px;font-size:17px;">坊</div><b>天命·创意工坊<small>SCENARIO WORKSHOP</small></b></div>' +
        '<nav class="nav">' + nav + '</nav>' +
        '<div class="gsearch"><input id="tm-mall-q" value="' + esc(state.catalogQuery || '') + '" placeholder="搜剧本、作者、朝代、标签…" onkeydown="if(event.key===\'Enter\')TMContentManager.mallSearch(this.value)"><span style="cursor:pointer;color:var(--gold);font-family:var(--serif);" onclick="TMContentManager.mallSearch(document.getElementById(\'tm-mall-q\').value)">搜</span></div>' +
        '<div class="tbright">' +
          '<div class="bell" title="更新中心" onclick="TMContentManager.switchPane(\'updates\')">⇪</div>' +
          '<div class="bell" title="私信" onclick="TMContentManager.openDmInbox()">✉</div>' +
          '<div class="bell" title="通知" onclick="TMContentManager.switchPane(\'me\')">♪' + (notifUnread ? '<span class="badge">' + notifUnread + '</span>' : '') + '</div>' +
          '<div class="idchip" onclick="TMContentManager.switchPane(\'me\')"><div class="av seal" style="width:28px;height:28px;border-radius:50%;font-size:14px;">' + esc(String(idLabel).charAt(0)) + '</div><small>' + esc(idLabel) + '</small></div>' +
          '<div class="x" onclick="TMContentManager.close()" title="关闭">✕</div>' +
        '</div>' +
      '</div>' +
      '<div class="main"><div class="scroll">' + renderMallPane(pane) + '</div></div>' +
      (state.detailOpen ? renderPackDetail() : '') + (state.dmOpen ? renderDmLayer() : '') + (state.chronOpen ? renderChroniclesLayer() : '') +
      (state.arenaOpen ? renderArenaLayer() : '') + (state.collectionOpen ? renderCollectionLayer() : '') + (state.colPickOpen ? renderCollectionPicker() : '') +
      (state.circleOpen ? renderCircleLayer() : '') +
    '</main>';
    bg.style.display = 'flex';
    try { if (window.TMWorkshopCovers) window.TMWorkshopCovers.enhance(bg); } catch (e) {}
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
      // 网页环境：本体更新 / 前端热更 / 本地落盘装包是桌面专属；但在线工坊浏览、
      // 安装（下剧本 JSON 并入剧本库）与账号走 TM.OnlineClient，照常可用。
      var webApi = (window.TM && TM.OnlineClient) ? TM.OnlineClient.getApiUrl() : (state.defaultOnlineApiUrl || '');
      state.defaultOnlineApiUrl = webApi || state.defaultOnlineApiUrl || '';
      if (!state.defaultCatalogUrl && webApi) state.defaultCatalogUrl = webApi + 'workshop/catalog';
      if (!state.onlineApiUrl) state.onlineApiUrl = loadOnlineApiUrl();
      if (!state.catalogUrl) state.catalogUrl = loadCatalogUrl();
      if (window.TM && TM.OnlineClient) state.accountSession = TM.OnlineClient.getSession();
      state.status = { error: '网页版：本体更新与本地落盘装包为桌面专属功能。' };
      state.hotMessage = '网页版：前端热更为桌面专属；网页本身始终是最新在线版本。';
      state.onlineMessage = '';
      await refreshWebInstalled();
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
        // 账号统一走 TM.OnlineClient（渲染层 localStorage）。优先它；旧 IPC session 仅作兜底。
        var ocSess = (window.TM && TM.OnlineClient) ? TM.OnlineClient.getSession() : null;
        state.accountSession = (ocSess && ocSess.token) ? ocSess : (status.account || state.accountSession || null);
        state.status = { currentVersion: status.currentVersion };
      }
    } catch(e) {
      state.status = { error: e.message };
    }
    render();
  }

  async function refreshAccountSession() {
    // 统一走 TM.OnlineClient（渲染层，桌面/网页同源）。CORS 修好后桌面 renderer 直连 API 即可。
    state.accountSession = (window.TM && TM.OnlineClient) ? TM.OnlineClient.getSession() : state.accountSession;
    return state.accountSession;
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

  async function loadWorkshopCatalog() {
    var input = document.getElementById('tm-workshop-catalog');
    state.catalogUrl = input ? input.value.trim() : state.catalogUrl;
    if (!state.catalogUrl) state.catalogUrl = state.defaultCatalogUrl || '';
    var qEl = document.getElementById('tm-workshop-q');
    var sortEl = document.getElementById('tm-workshop-sort');
    if (qEl) state.catalogQuery = qEl.value.trim();
    if (sortEl) state.catalogSort = sortEl.value || 'new';
    state.catalogAuthorView = '';
    saveCatalogUrl(state.catalogUrl);
    state.catalogMessage = '正在载入在线工坊目录...';
    state.catalogLoading = true;
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
      state.catalog = catalog || null;
      state.catalogMessage = '已载入 ' + ((catalog && catalog.packs && catalog.packs.length) || 0) + ' 个在线工坊包。' + (state.catalogQuery ? '（搜索：' + state.catalogQuery + '）' : '');
    } catch (e) {
      state.catalogMessage = '载入在线目录失败：' + (e && e.message || '未知错误');
    }
    state.catalogLoading = false;
    render();
  }

  async function ratePack(id, score) {
    if (!(window.TM && TM.OnlineClient && TM.OnlineClient.isLoggedIn())) { state.catalogMessage = '请先登录账号再评分。'; render(); return; }
    try {
      var res = await TM.OnlineClient.ratePack(id, score, state.onlineApiUrl || undefined);
      if (res && res.success) {
        state.catalogMessage = '已评分：' + score + ' 星（' + id + ' 当前 ' + (res.rating != null ? res.rating : '') + ' 分 / ' + (res.ratingCount || 0) + ' 评）。';
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
      if (!resp.ok) throw new Error('下载失败 HTTP ' + resp.status);
      var text = await resp.text();
      if (text.length > 16 * 1024 * 1024) throw new Error('剧本体积超过网页安装上限（16MB），请用桌面版安装。');
      var data;
      try { data = JSON.parse(text); }
      catch (e) { throw new Error('此工坊包为打包资源（含立绘/音频等），网页版仅支持纯文本剧本，请用桌面版安装。'); }
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
      state.catalogMessage = '网页安装失败：' + (e && e.message || '未知错误');
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
    try { state.webInstalled = await wsGetAll(); } catch (e) { state.webInstalled = state.webInstalled || []; }
  }

  // 订阅=安装：检查已装工坊包是否有新版（作者发新版 + owner 审核通过后）。
  async function checkWorkshopUpdates() {
    if (desktop()) { state.catalogMessage = '桌面端工坊更新走本体/热更通道。'; render(); return; }
    state.catalogMessage = '正在检查工坊更新...';
    render();
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
    state.catalogMessage = cnt ? ('发现 ' + cnt + ' 个工坊包有新版，可点「更新」。') : '已安装的工坊包均为最新。';
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

  async function accountRefresh() {
    state.accountMessage = '正在刷新账号身份...';
    render();
    try {
      var me = await TM.OnlineClient.me(state.onlineApiUrl || undefined);
      state.accountSession = TM.OnlineClient.getSession();
      state.accountMessage = (me && me.loggedIn) ? '账号身份已刷新。' : '尚未登录。';
    } catch (e) {
      state.accountMessage = '刷新账号身份失败：' + (e && e.message || '未知错误');
    }
    render();
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

  async function accountSetEmail() {
    var el = document.getElementById('tm-setemail');
    var email = el ? el.value.trim() : '';
    if (!email) { state.accountMessage = '请填写邮箱。'; render(); return; }
    state.accountMessage = '正在保存邮箱...';
    render();
    try {
      var res = await TM.OnlineClient.setEmail(email, state.onlineApiUrl || undefined);
      if (res && res.success) {
        state.accountSession = TM.OnlineClient.getSession();
        state.accountMessage = '邮箱已保存，可用于找回密码。';
      } else {
        state.accountMessage = '保存邮箱失败：' + ((res && res.error) || '未知错误');
      }
    } catch (e) {
      state.accountMessage = '保存邮箱失败：' + (e && e.message || '未知错误');
    }
    render();
  }

  async function accountLogout() {
    state.accountMessage = '正在退出登录...';
    state.friendsLoaded = false; state.friendsData = null; state.friendMessage = '';
    state.notifLoaded = false; state.notifData = null; state.dmOpen = false; state.dmInbox = []; state.dmMessages = [];
    render();
    try {
      await TM.OnlineClient.logout(state.onlineApiUrl || undefined);
      state.accountMessage = '已退出登录。';
    } catch (e) {
      state.accountMessage = '退出登录失败：' + (e && e.message || '未知错误');
    }
    state.accountSession = null;
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
      state.publishMessage = '正在提交发布申请...';
      render();
      var res = await TM.OnlineClient.uploadPack(meta, bytesToBase64Local(bytes), state.onlineApiUrl || undefined);
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
      var zip = TMZipStore.buildZip(entries);
      var b64 = TMZipStore.bytesToBase64(zip);
      var meta = {
        title: title, id: '',
        version: (verEl && verEl.value.trim()) || '1.0.0',
        description: (descEl && descEl.value.trim()) || '',
        type: pt,
        tags: tagsEl ? tagsEl.value : '',
        assets: assets,
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
    ratePack: ratePack,
    checkWorkshopUpdates: checkWorkshopUpdates,
    updateWorkshopPack: updateWorkshopPack,
    updateAllWorkshop: updateAllWorkshop,
    uninstallWebPack: uninstallWebPack,
    loadAuthorPacks: loadAuthorPacks,
    installCatalogPack: installCatalogPack,
    openPackDetail: openPackDetail,
    closePackDetail: closePackDetail,
    toggleFavorite: toggleFavorite,
    toggleFollow: toggleFollow,
    postPackComment: postPackComment,
    addFriend: addFriend,
    respondFriend: respondFriendUI,
    removeFriend: removeFriendUI,
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
