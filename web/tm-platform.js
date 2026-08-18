// ============================================================
//  tm-platform.js — 平台抽象层 TM.platform  (移植 Phase 0 · S0.2)
//
//  目的：把「Electron vs Web」这条原本散落在各处的隐式分叉
//        (window.tianming.isDesktop / desktop() / TM.env.isElectron)
//        收口成单一契约 TM.platform，为安卓 Capacitor 后端留出落点。
//
//  设计见 web/docs/mobile-port-design.md §4.1
//
//  ── 本刀 (S0.2) 的边界 ──
//   • 只新增本文件 + index.html 一行 script，不迁移任何调用点。
//   • electron 后端 = 等价转发到现有 window.tianming.*（行为零变化）。
//   • web / capacitor 后端 = 明确 stub（unavailable），留给 S0.4 / Phase 1 填。
//   ⇒ 因为没有调用点被改写，桌面/web 现状行为完全不变 = 天然零回归。
//
//  后续刀：S0.3 把 tm-content-manager.js 的 desktop() 闸改 TM.platform.caps.*；
//          S0.4 把 tm-save-lifecycle.js 的存档分叉收编进 TM.platform.saves；
//          S0.5 asset.url() 收编 tm-content:// 拼接点。
// ============================================================

(function () {
  'use strict';

  var wt = (typeof window !== 'undefined') ? window.tianming : null;

  // ── 平台种类判定（单一真相）──
  // capacitor 检测 hook 现在恒 false（插件未装），Phase 1 接 Capacitor 后自然为真。
  var isCapacitor = !!(typeof window !== 'undefined' && window.Capacitor &&
    typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform());
  var isElectron = !!(wt && wt.isDesktop);
  var kind = isCapacitor ? 'capacitor' : (isElectron ? 'electron' : 'web');

  // ── 能力位（取代散落的 isDesktop 判断；各闸改读这里）──
  // ipc：有没有 window.tianming IPC 桥（仅 electron）。在线/工坊/热更/账号/存档「走不走 IPC 磁盘路」
  //      看这个——content-manager 那些闸内部全是 `window.tianming.X`，capacitor 上为 null 会崩；
  //      capacitor/web 无 IPC → 一律走浏览器路（TM.OnlineClient + IndexedDB）+ 原生补丁（CapacitorHttp/convertFileSrc）。
  //      ⚠ S0.3 曾误把 content-manager 的 desktop() 改读 isNative（capacitor=true→撞 IPC 支崩）；Phase 1 已回正为读 ipc。
  // fs ：有没有「某种」原生文件能力（electron=IPC磁盘·capacitor=Filesystem插件）。但 Phase 1 capacitor 存储仍复用
  //      web IndexedDB，故存档闸读的是 ipc 而非 fs；fs=true 留作 S1.2 接 capacitor Filesystem 后端时的意图位。
  // web：在线/原生能力全关（= 现状，online 在 web 走 OnlineClient 而非这些 caps）。
  var CAPS = {
    electron:  { ipc: true,  fs: true,  nativeHttp: true,  hotUpdate: true,  online: true,  installerUpdate: true,  filePicker: true },
    capacitor: { ipc: false, fs: true,  nativeHttp: true,  hotUpdate: true,  online: true,  installerUpdate: false, filePicker: true },
    web:       { ipc: false, fs: false, nativeHttp: false, hotUpdate: false, online: false, installerUpdate: false, filePicker: false }
  };
  var caps = CAPS[kind];

  // ── stub：当前平台不支持该能力时的统一返回（异步，形状对齐 IPC 的 {success:false}）──
  function notAvail(feature) {
    return Promise.resolve({ success: false, unavailable: true, error: (feature || '该功能') + ' 在当前平台不可用' });
  }
  function makeUnavailableBackend(label) {
    return {
      _label: label,
      saves:     { save: f('存档保存'), load: f('存档读取'), list: f('存档列表'), remove: f('删除存档'), autoSave: f('自动存档'), loadAutoSave: f('读取自动存档') },
      scenarios: { list: f('剧本列表'), save: f('剧本保存'), load: f('剧本读取'), remove: f('删除剧本') },
      turnData:  { write: f('回合数据写入'), read: f('回合数据读取'), list: f('回合数据列表'), summary: f('回合摘要') },
      account:   { session: f('账号会话'), register: f('注册'), login: f('登录'), me: f('账号信息'), logout: f('登出') },
      workshop:  { list: f('工坊列表'), catalog: f('工坊目录'), installFromUrl: f('工坊在线安装'), import: f('工坊导入'), publish: f('工坊发布'), setEnabled: f('工坊启停'), uninstall: f('工坊卸载'), loadEnabledScenarios: f('加载工坊剧本') },
      hot:       { status: f('热更状态'), check: f('热更检查'), install: f('热更安装'), setEnabled: f('热更开关'), rollback: f('热更回退'), reload: f('热更重载'), onStatus: noop },
      installer: { check: f('安装包更新检查'), download: f('安装包下载'), install: f('安装包安装'), onStatus: noop },
      files:     { exportSave: f('导出存档'), importSave: f('导入存档'), pickImage: f('选择图片'), pickGeoJSON: f('选择地理数据') },
      info:      { getAppInfo: f('应用信息'), contentStatus: f('内容状态') },
      tools:     { openDir: f('打开目录'), quit: noop, debugLog: noop, debugLogInfo: f('日志信息') },
      events:    { onMenuAction: noop, onImportData: noop }
    };
    function f(name) { return function () { return notAvail(name); }; }
    function noop() {}
  }

  // ── electron 后端：等价转发到 window.tianming.*（保持现有签名）──
  function call(method, args) {
    if (wt && typeof wt[method] === 'function') return wt[method].apply(wt, args || []);
    return notAvail(method);
  }
  var electronBackend = {
    _label: 'electron',
    saves: {
      save:         function (name, data) { return call('saveProject', [name, data]); },
      load:         function (name)       { return call('loadProject', [name]); },
      list:         function ()           { return call('listSaves', []); },
      remove:       function (name)       { return call('deleteSave', [name]); },
      autoSave:     function (data)       { return call('autoSave', [data]); },
      loadAutoSave: function ()           { return call('loadAutoSave', []); }
    },
    scenarios: {
      list:   function ()           { return call('listScenarios', []); },
      save:   function (name, data) { return call('saveScenario', [name, data]); },
      load:   function (name)       { return call('loadScenario', [name]); },
      remove: function (name)       { return call('deleteScenario', [name]); }
    },
    turnData: {
      write:   function (saveName, turn, data)   { return call('writeTurnData', [saveName, turn, data]); },
      read:    function (saveName, turn)         { return call('readTurnData', [saveName, turn]); },
      list:    function (saveName)               { return call('listTurnData', [saveName]); },
      summary: function (saveName, from, to)     { return call('readTurnsSummary', [saveName, from, to]); }
    },
    account: {
      session:  function ()                          { return call('accountSession', []); },
      register: function (apiUrl, u, p, nick)        { return call('accountRegister', [apiUrl, u, p, nick]); },
      login:    function (apiUrl, u, p)              { return call('accountLogin', [apiUrl, u, p]); },
      me:       function (apiUrl)                    { return call('accountMe', [apiUrl]); },
      logout:   function (apiUrl)                    { return call('accountLogout', [apiUrl]); }
    },
    workshop: {
      list:                 function ()                          { return call('listWorkshopPacks', []); },
      catalog:              function (url)                       { return call('loadWorkshopCatalog', [url]); },
      installFromUrl:       function (url, sha, overwrite)       { return call('installWorkshopPackFromUrl', [url, sha, overwrite]); },
      import:               function (overwrite)                 { return call('importWorkshopPack', [overwrite]); },
      publish:              function (pack)                      { return call('publishWorkshopPack', [pack]); },
      setEnabled:           function (id, enabled)               { return call('setWorkshopPackEnabled', [id, enabled]); },
      uninstall:            function (id)                        { return call('uninstallWorkshopPack', [id]); },
      loadEnabledScenarios: function ()                          { return call('loadEnabledWorkshopScenarios', []); }
    },
    hot: {
      status:     function ()        { return call('hotUpdateStatus', []); },
      check:      function ()        { return call('checkHotUpdate', []); },
      install:    function ()        { return call('installHotUpdate', []); },
      setEnabled: function (enabled) { return call('setHotUpdateEnabled', [enabled]); },
      rollback:   function ()        { return call('rollbackHotUpdate', []); },
      reload:     function ()        { return call('reloadAfterHotUpdate', []); },
      onStatus:   function (cb)      { if (wt && wt.onHotUpdateStatus) wt.onHotUpdateStatus(cb); }
    },
    installer: {
      check:    function ()        { return call('checkForUpdate', []); },
      download: function ()        { return call('downloadUpdate', []); },
      install:  function ()        { return call('installUpdate', []); },
      onStatus: function (cb)      { if (wt && wt.onUpdateStatus) wt.onUpdateStatus(cb); }
    },
    files: {
      exportSave:  function (data) { return call('dialogExport', [data]); },
      importSave:  function ()     { return call('dialogImport', []); },
      pickImage:   function ()     { return call('dialogLoadImage', []); },
      pickGeoJSON: function ()     { return call('dialogLoadGeoJSON', []); }
    },
    info: {
      getAppInfo:    function () { return call('getAppInfo', []); },
      contentStatus: function () { return call('contentStatus', []); }
    },
    tools: {
      // which: 'save' | 'scenarios' | 'turnData' | 'workshop' | 'hotUpdate' | 'log'
      openDir: function (which) {
        var map = { save: 'openSaveDir', scenarios: 'openScenariosDir', turnData: 'openTurnDataDir',
                    workshop: 'openWorkshopDir', hotUpdate: 'openHotUpdateDir', log: 'openLogDir' };
        return call(map[which] || 'openSaveDir', []);
      },
      quit:         function ()        { return call('quitApp', []); },
      debugLog:     function (entries) { return call('debugLog', [entries]); },
      debugLogInfo: function ()        { return call('debugLogInfo', []); }
    },
    events: {
      onMenuAction: function (cb) { if (wt && wt.onMenuAction) wt.onMenuAction(cb); },
      onImportData: function (cb) { if (wt && wt.onImportData) wt.onImportData(cb); }
    }
  };

  // 后端选择。capacitor 后端在 Phase 1 落地（复用 web 路径 + 原生插件）；S0.2 暂用 unavailable stub。
  var backend =
    (kind === 'electron')  ? electronBackend :
    (kind === 'capacitor') ? makeUnavailableBackend('capacitor-stub') :
                             makeUnavailableBackend('web-stub');

  // ── 资产 URL builder（S0.5 收编 tm-content:// 拼接点；现状原样返回 = 零变化）──
  function assetUrl(logicalPath) {
    var p = String(logicalPath == null ? '' : logicalPath);
    if (kind === 'capacitor' && typeof window !== 'undefined' && window.Capacitor &&
        typeof window.Capacitor.convertFileSrc === 'function') {
      // Phase 1：本地绝对路径 → WebView 可读 URL。tm-content:// / http(s) 原样放过。
      if (/^(tm-content:|https?:|data:|blob:)/i.test(p)) return p;
      return window.Capacitor.convertFileSrc(p);
    }
    return p; // electron / web：维持现有 tm-content:// 或相对路径
  }

  // ── 导出契约 ──
  if (typeof window !== 'undefined') {
    window.TM = window.TM || {};
    window.TM.platform = {
      kind: kind,
      isNative: kind === 'electron' || kind === 'capacitor',  // 统一「有原生能力」标志（S0.3 起替代 desktop()）
      caps: caps,
      saves: backend.saves,
      scenarios: backend.scenarios,
      turnData: backend.turnData,
      account: backend.account,
      workshop: backend.workshop,
      hot: backend.hot,
      installer: backend.installer,
      files: backend.files,
      info: backend.info,
      tools: backend.tools,
      events: backend.events,
      asset: { url: assetUrl },
      describe: function () { return 'TM.platform[' + kind + '] caps=' + JSON.stringify(caps); }
    };
    try { console.log('[TM.platform] ' + window.TM.platform.describe()); } catch (_) {}
  }
})();
