// ============================================================
//  tm-desktop-update.js — 桌面端更新卡驱动（自动检查已停用）
//  2026-06-11·更新功能全面升级 S4
//
//  ★2026-07-01·桌面端取消「自动弹热更卡」(owner：桌面热更统一走「创意工坊 / 更新中心」手动检查下载)。
//    原实现在启动后自动查 feed·发现新版即弹 TMUpdateCard「发现新版本→立即更新→下载 771MB 全量包」。
//    玩家点✕收起后·后台下载的进度事件又把卡反复拽回来(且标题退回默认「检查更新」)·观感如同
//    「电脑版莫名冒出一个安卓 OTA 式的更新弹窗」。现自动检查/自愈 toast 一并停发·所有桌面更新
//    改由创意工坊(TMContentManager 更新中心/设置页的 checkHotUpdate/installHotUpdate)手动驱动。
//    新版发现不丢：新版→新 changelog→邸报自动弹+红点提示玩家去创意工坊更新。
//    下方 ①-⑦ 为停用前的历史行为·arm() 已不再排程自动检查；手动 TMDesktopUpdate.check(true)
//    (调试/联网中枢)仍可用·wireXxx 保留仅为其进度回显。
//
//  ① 仅桌面 Electron 生效（window.tianming 在）·安卓有 tm-capacitor-boot.js·在线版有
//     tm-online-update.js·三端各管各的。
//  ② 〔已停用〕启动后 8s 后台静默查 hot-latest.json → 发现新版弹更新卡（TMUpdateCard）。
//  ③ 〔已停用〕避让·邸报弹窗 / 联网中枢更新仪式开着时不弹卡·每 1.5s 复查·最多等 10 分钟。
//  ④ dev (npm start·isPackaged=false) 不自动检查·手动 TMDesktopUpdate.check(true) 仍可用。
//  ⑤ feed flags.disableAutoCheck=true → 服务器端一键静默全部自动检查（kill-switch）。
//  ⑥ 〔已停用〕周期复查·6 小时·页面隐藏/忙碌/卡可见时跳过。
//  ⑦ 〔已停用〕自愈提示·主进程报告 lastRepair → 一次性 toast 告知玩家。
// ============================================================

(function () {
  'use strict';
  if (typeof window === 'undefined') return;
  if (!window.tianming || typeof window.tianming.checkHotUpdate !== 'function') return; // 仅桌面端

  var CHECK_DELAY_MS = 8000;            // 启动后首查延时·让位启动关键路径与邸报
  var RECHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;  // 周期复查·6h
  var AVOID_POLL_MS = 1500;             // 弹窗避让轮询
  var AVOID_MAX_MS = 10 * 60 * 1000;    // 避让上限·10min 后本轮放弃（周期复查兜底）
  var REPAIR_SEEN_KEY = 'tm.update.lastRepairSeen';

  var _busy = false;              // 一次只跑一个检查/安装流程
  var _sessionActive = false;     // 本模块发起的安装会话（区分联网中枢发起的安装）
  var _offeredVersion = '';       // 本会话已弹过卡的版本·玩家关掉后不再骚扰
  var _verbose = false;
  var _fetchTotalBytes = 0;       // 增量计划总字节·算百分比/速度用
  var _samples = [];              // 速度采样（滚动 2.5s 窗·与安卓卡同算法）

  function card() { return window.TMUpdateCard || null; }
  function nowMs() {
    try { return (window.performance && performance.now) ? performance.now() : Date.now(); }
    catch (_) { return Date.now(); }
  }
  function pushSample(bytes) {
    var t = nowMs();
    _samples.push({ t: t, b: bytes });
    while (_samples.length > 2 && (t - _samples[0].t) > 2500) _samples.shift();
  }
  function speed() {
    if (_samples.length < 2) return 0;
    var a = _samples[0], z = _samples[_samples.length - 1];
    var dt = (z.t - a.t) / 1000;
    return dt > 0 ? Math.max(0, (z.b - a.b) / dt) : 0;
  }
  function feedUrl() {
    try { return localStorage.getItem('tm_hot_update_feed_url') || ''; } catch (_) { return ''; }
  }
  function modalInWay() {
    try {
      return !!(document.getElementById('tm-changelog-ov')
        || document.querySelector('.tm-update-ritual.show'));
    } catch (_) { return false; }
  }

  // ── 自愈一次性提示 ──────────────────────────────────────────────────────
  function maybeShowRepairNotice(status) {
    try {
      var rep = status && status.lastRepair;
      if (!rep || !rep.at) return;
      var seen = '';
      try { seen = localStorage.getItem(REPAIR_SEEN_KEY) || ''; } catch (_) {}
      if (seen === rep.at) return;
      try { localStorage.setItem(REPAIR_SEEN_KEY, rep.at); } catch (_) {}
      var c = card();
      if (c) c.toast('更新已自动恢复至可用版本', status.rendererVersion || '', 6000);
    } catch (_) {}
  }

  // ── 安装流程（本模块发起）────────────────────────────────────────────────
  function startInstall(check) {
    var c = card();
    if (!c) return;
    _sessionActive = true;
    _samples = [];
    _fetchTotalBytes = 0;
    c.show({ title: '正在下载更新', version: check.remoteVersion });
    c.progress({ percent: 0, doneBytes: 0, totalBytes: check.size || 0, bps: 0 });
    window.tianming.installHotUpdate(feedUrl()).then(function (res) {
      if (res && res.success) return; // 'installed' 事件已接管 UI
      _sessionActive = false;
      _busy = false;
      var msg = (res && (res.message || res.error)) || '安装失败';
      if (res && res.blockedDowngrade) { c.toast('已是最新版', res.currentVersion || '', 3200); return; }
      c.fail(msg, 8000);
    }).catch(function (e) {
      _sessionActive = false;
      _busy = false;
      c.fail((e && e.message) || '安装失败', 8000);
    });
  }

  function offerUpdate(check) {
    var c = card();
    if (!c) { _busy = false; return; }
    _offeredVersion = check.remoteVersion || '';
    var sizeNote = check.size ? ('更新包约 ' + (c._fmt ? c._fmt.fmtMB(check.size) : Math.round(check.size / 1048576) + ' MB') + '·增量下载通常更小') : '';
    c.show({ title: '发现新版本', version: check.remoteVersion, subtitle: '' });
    c.progress({ percent: 0, doneBytes: 0, totalBytes: 0, bps: 0, label: sizeNote });
    c.setActions([
      { label: '立即更新', primary: true, onClick: function () { startInstall(check); } },
      { label: '查看更新内容', onClick: function () { try { if (window.TM_Changelog) window.TM_Changelog.show(); } catch (_) {} } }
    ]);
    _busy = false; // 等玩家决定·不占锁（startInstall 自己管）
  }

  // ── 本体安装包流程（S5·热更 feed 标 minAppVersion 高于当前本体时走这条）──────
  var INSTALLER_NOTICE_KEY = 'tm.update.installerNoticeVer';
  var _installerActive = false;

  function installerFeedUrl() {
    try { return localStorage.getItem('tm_update_feed_url') || ''; } catch (_) { return ''; }
  }
  function fmtMB(c, bytes) {
    try { return c._fmt ? c._fmt.fmtMB(bytes) : Math.round(bytes / 1048576) + ' MB'; } catch (_) { return ''; }
  }

  function startInstallerDownload(res) {
    var c = card();
    if (!c) return;
    _installerActive = true;
    _samples = [];
    c.show({ title: '正在下载本体安装包', version: res.remoteVersion });
    c.progress({ percent: 0, doneBytes: 0, totalBytes: res.size || 0, bps: 0 });
    window.tianming.downloadUpdate().then(function (dl) {
      _installerActive = false;
      if (dl && dl.success) {
        c.done({
          title: '安装包已就绪',
          version: res.remoteVersion,
          subtitle: '下载完成',
          note: '安装时应用会自动重启',
          actions: [{
            label: '安装并重启', primary: true,
            onClick: function () { try { window.tianming.installUpdate(); } catch (_) {} }
          }]
        });
      } else {
        c.fail((dl && (dl.message || dl.error)) || '安装包下载失败', 8000);
      }
    }).catch(function (e) {
      _installerActive = false;
      c.fail((e && e.message) || '安装包下载失败', 8000);
    });
  }

  function installerFlow(check) {
    var c = card();
    if (!c) { _busy = false; return; }
    window.tianming.checkForUpdate(installerFeedUrl()).then(function (res) {
      if (!res || !res.success || !res.hasUpdate) {
        _busy = false;
        // 热更已出但安装包还没放上服务器·一版只提示一次（手动检查不受限）
        var seen = '';
        try { seen = localStorage.getItem(INSTALLER_NOTICE_KEY) || ''; } catch (_) {}
        if (_verbose || seen !== check.remoteVersion) {
          try { localStorage.setItem(INSTALLER_NOTICE_KEY, check.remoteVersion); } catch (_) {}
          c.toast('新版本 v' + check.remoteVersion + ' 需更新本体·安装包稍后开放下载', '', 6000);
        }
        return;
      }
      _offeredVersion = check.remoteVersion || '';
      c.show({ title: '发现新版本·需更新本体', version: res.remoteVersion });
      c.progress({ percent: 0, doneBytes: 0, totalBytes: 0, bps: 0, label: res.size ? ('本体安装包约 ' + fmtMB(c, res.size)) : '' });
      c.setActions([
        { label: '下载安装包', primary: true, onClick: function () { startInstallerDownload(res); } },
        { label: '查看更新内容', onClick: function () { try { if (window.TM_Changelog) window.TM_Changelog.show(); } catch (_) {} } }
      ]);
      _busy = false;
    }).catch(function (e) {
      _busy = false;
      try { console.warn('[tm-desktop-update] 本体检查失败', e); } catch (_) {}
      if (_verbose) c.fail('网络异常，稍后自动重试');
    });
  }

  // electron-updater 事件 → 卡片进度（仅本模块发起的安装包下载会话）
  function wireInstallerEvents() {
    if (typeof window.tianming.onUpdateStatus !== 'function') return;
    window.tianming.onUpdateStatus(function (st) {
      if (!_installerActive || !st || !st.kind) return;
      var c = card();
      if (!c) return;
      try {
        if (st.kind === 'download-progress' && st.progress) {
          c.progress({
            percent: st.progress.percent || 0,
            doneBytes: st.progress.transferred || 0,
            totalBytes: st.progress.total || 0,
            bps: st.progress.bytesPerSecond || 0
          });
        } else if (st.kind === 'error') {
          _installerActive = false;
          c.fail((st.error || '安装包下载失败') + '', 8000);
        }
      } catch (_) {}
    });
  }

  // ── 主进程事件 → 卡片进度 ────────────────────────────────────────────────
  function wireStatusEvents() {
    if (typeof window.tianming.onHotUpdateStatus !== 'function') return;
    window.tianming.onHotUpdateStatus(function (st) {
      if (!_sessionActive || !st || !st.kind) return;
      var c = card();
      if (!c) return;
      try {
        switch (st.kind) {
          case 'incremental-start':
            c.show({ title: '正在下载更新', version: st.version });
            break;
          case 'incremental-plan':
            _fetchTotalBytes = st.fetchBytes || 0;
            _samples = [];
            c.progress({ percent: 0, doneBytes: 0, totalBytes: _fetchTotalBytes, bps: 0, label: '0/' + (st.fetch || 0) + ' 文件' });
            break;
          case 'incremental-progress': {
            var totalB = st.fetchBytes || _fetchTotalBytes || 0;
            var doneB = st.bytesDone || 0;
            if (totalB) pushSample(doneB);
            var pct = totalB ? (doneB / totalB * 100)
              : (st.total ? (st.done / st.total * 100) : 0);
            c.progress({
              percent: pct, doneBytes: doneB, totalBytes: totalB,
              bps: totalB ? speed() : 0,
              label: (st.done || 0) + '/' + (st.total || 0) + ' 文件'
            });
            break;
          }
          case 'incremental-fallback':
            _samples = [];
            c.show({ title: '正在下载完整更新包', version: st.version });
            break;
          case 'download-start':
            _samples = [];
            c.show({ title: '正在下载更新', version: st.version });
            break;
          case 'download-progress': {
            var t = st.size || 0, d = st.transferred || 0;
            if (t) pushSample(d);
            c.progress({ percent: st.percent || (t ? d / t * 100 : 0), doneBytes: d, totalBytes: t, bps: t ? speed() : 0 });
            break;
          }
          case 'downloaded':
          case 'verifying':
            c.progress({ percent: 100, doneBytes: st.size || 0, totalBytes: st.size || 0, bps: 0, label: '正在校验' });
            break;
          case 'installed':
            _sessionActive = false;
            _busy = false;
            c.done({
              version: st.version,
              note: '重启后生效',
              actions: [{
                label: '立即重启生效', primary: true,
                onClick: function () { try { window.tianming.reloadAfterHotUpdate(); } catch (_) {} }
              }]
            });
            break;
          case 'error':
            _sessionActive = false;
            _busy = false;
            c.fail((st.error || '更新失败') + '', 8000);
            break;
        }
      } catch (e) {
        try { console.warn('[tm-desktop-update] 状态事件处理失败', e); } catch (_) {}
      }
    });
  }

  // ── 检查主流程 ───────────────────────────────────────────────────────────
  function runCheck(verbose) {
    if (_busy) return Promise.resolve();
    _busy = true;
    _verbose = !!verbose;
    return window.tianming.hotUpdateStatus().then(function (stRes) {
      var status = (stRes && stRes.success && stRes.status) ? stRes.status : null;
      if (status) maybeShowRepairNotice(status);
      // dev (npm start) 不自动检查·手动 verbose 检查放行
      if (!_verbose && status && status.isPackaged === false) {
        _busy = false;
        try { console.log('[tm-desktop-update] dev 模式·跳过自动检查（TMDesktopUpdate.check(true) 可手动）'); } catch (_) {}
        return;
      }
      return window.tianming.checkHotUpdate(feedUrl()).then(function (check) {
        if (!check || !check.success) {
          _busy = false;
          if (_verbose) { var c0 = card(); if (c0) c0.fail((check && check.error) || '网络异常，稍后自动重试'); }
          return;
        }
        var flags = check.flags || {};
        if (!_verbose && flags.disableAutoCheck) { _busy = false; return; }
        if (!check.hasUpdate) {
          _busy = false;
          if (_verbose) { var c1 = card(); if (c1) c1.toast('已是最新版', check.currentVersion || '', 3200); }
          return;
        }
        // 需要先升本体（needsInstaller）→ 走安装包流程
        if (check.needsInstaller) {
          if (!_verbose && _offeredVersion === check.remoteVersion) { _busy = false; return; }
          installerFlow(check);
          return;
        }
        // 同版本本会话弹过且玩家关掉了 → 静默（verbose 手动检查除外）
        if (!_verbose && _offeredVersion === check.remoteVersion) { _busy = false; return; }
        offerUpdate(check);
      });
    }).catch(function (e) {
      _busy = false;
      try { console.warn('[tm-desktop-update] 检查失败', e); } catch (_) {}
      if (_verbose) { var c = card(); if (c) c.fail('网络异常，稍后自动重试'); }
    });
  }

  // 弹窗避让·邸报/联网中枢仪式开着就等
  function checkWhenClear(verbose, waitedMs) {
    waitedMs = waitedMs || 0;
    if (modalInWay()) {
      if (waitedMs >= AVOID_MAX_MS) return;
      setTimeout(function () { checkWhenClear(verbose, waitedMs + AVOID_POLL_MS); }, AVOID_POLL_MS);
      return;
    }
    runCheck(verbose);
  }

  function arm() {
    // wireXxx 保留：手动 TMDesktopUpdate.check(true) 发起的安装会话仍需进度回显。
    wireStatusEvents();
    wireInstallerEvents();
    // ★2026-07-01·桌面端不再自动检查/自动弹热更卡（owner：桌面热更改到「创意工坊 / 更新中心」手动做）。
    //   原「启动 8s 首查 + 6h 周期复查」会自动 offerUpdate/installerFlow 弹 TMUpdateCard·已整段移除。
    //   → 桌面开局零更新卡；新版仍靠邸报(有未读 changelog 自动弹+红点)提示玩家去创意工坊更新。
    //   checkWhenClear / CHECK_DELAY_MS / RECHECK_INTERVAL_MS / AVOID_* 现仅供手动路径与历史参考。
  }
  if (document.readyState === 'complete') arm();
  else window.addEventListener('load', arm);

  // 手动入口（联网中枢/控制台/调试用）
  window.TMDesktopUpdate = {
    check: function (verbose) { return runCheck(verbose !== false); },
    state: function () {
      return { busy: _busy, sessionActive: _sessionActive, installerActive: _installerActive, offeredVersion: _offeredVersion };
    }
  };
})();
