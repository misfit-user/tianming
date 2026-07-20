// ============================================================
//  tm-capacitor-boot.js — Capacitor 端启动钩子（移植 Phase 3 · 热更 + 在线）
//
//  ① Capgo 热更：app 成功加载后调 CapacitorUpdater.notifyAppReady()，
//     告诉 Capgo「这个版本是健康的」。若不调，Capgo 会在 appReadyTimeout 后
//     判定本次（下载的）更新失败并回滚到上一个可用版本——这是防止坏更新把 app
//     变砖的安全机制。所以必须在游戏界面起来后调一次。
//  ② 手动静态热更检查：GET 静态 latest.json {version,url} → 比版本 → download(zip)
//     → set（下次启动生效）。下载过程把 Capgo 的 download 进度事件接到屏幕上的
//     「下载进度卡」：百分比 + 已下载/总大小 + 实时速度 + 剩余时间，下完弹「重启生效」。
//  ③ 仅 capacitor 原生端执行；桌面/web 整模块 no-op。
//  ④ 健壮性（2026-07-20·玩家真机「卡在10%不动」实案）：停滞看门狗（长时间无进度→卡面如实
//     示「下载停滞」·进度恢复自动回正常态）+ 下载失败有界自动重试（15s/45s 退避·共 3 次）+
//     彻底失败 10 分钟后自动再查一次；下载中手动「检查更新」不再被 busy 旗静默吞掉。
//     Capgo v6 无取消下载 API·原生下载挂死时 JS 杀不掉它——故停滞只做诚实提示与恢复自愈，
//     绝不假装取消；promise 真拒绝（断网/写盘失败）才走自动重试。
// ============================================================

(function () {
  'use strict';
  if (typeof window === 'undefined') return;
  var Cap = window.Capacitor;
  if (!Cap || typeof Cap.isNativePlatform !== 'function' || !Cap.isNativePlatform()) return; // 仅原生端

  var BASE = 'https://api.themisfitserspeople.top/tianming/capgo';
  var LATEST_URL = BASE + '/latest.json';

  function updater() {
    return (Cap.Plugins && Cap.Plugins.CapacitorUpdater) || null;
  }
  function now() {
    try { return (window.performance && performance.now) ? performance.now() : Date.now(); }
    catch (_) { return Date.now(); }
  }

  // ── 版本比较（与桌面端 tm-online-update.js 同算法）──────────────────────────
  // 本地有效版本：优先「当前运行 web」的 <meta name="tm-version">（热更替换整包时会随之更新·即正在运行的版本），
  // 兜底 footer #tm-foot-ver 文本。用它和服务器 latest.version 做 semver 比较，只在服务器「严格更高」时才更新。
  function _localVersion() {
    try {
      var meta = document.querySelector('meta[name="tm-version"]');
      var v = meta && meta.getAttribute('content');
      if (v && /^\d+(\.\d+){1,3}$/.test(String(v).trim())) return String(v).trim();
    } catch (_) {}
    try {
      var el = document.getElementById('tm-foot-ver') || document.querySelector('.f-ver');
      var m = el && String(el.textContent || '').match(/\d+(\.\d+){1,3}/);
      if (m) return m[0];
    } catch (_) {}
    return '';
  }
  function _compareVer(a, b) {   // a>b → 1 · a<b → -1 · 相等 → 0
    var aa = String(a || '0').split(/[.+-]/).map(function (n) { var v = parseInt(n, 10); return isFinite(v) ? v : 0; });
    var bb = String(b || '0').split(/[.+-]/).map(function (n) { var v = parseInt(n, 10); return isFinite(v) ? v : 0; });
    var n = Math.max(aa.length, bb.length, 4);
    for (var i = 0; i < n; i++) { var av = aa[i] || 0, bv = bb[i] || 0; if (av > bv) return 1; if (av < bv) return -1; }
    return 0;
  }

  function notifyReady() {
    var U = updater();
    if (U && typeof U.notifyAppReady === 'function') {
      try {
        U.notifyAppReady();
        try { console.log('[tm-capacitor-boot] CapacitorUpdater.notifyAppReady() 已调用'); } catch (_) {}
      } catch (e) {
        try { console.warn('[tm-capacitor-boot] notifyAppReady 失败', e); } catch (_) {}
      }
    }
  }

  // ── 格式化 ───────────────────────────────────────────────────────────────
  function fmtMB(bytes) {
    if (!bytes || bytes < 0) return '0 MB';
    var mb = bytes / 1048576;
    return (mb >= 100 ? Math.round(mb) : mb.toFixed(1)) + ' MB';
  }
  function fmtSpeed(bps) {
    if (!bps || bps <= 0) return '—';
    if (bps >= 1048576) return (bps / 1048576).toFixed(1) + ' MB/s';
    return Math.max(1, Math.round(bps / 1024)) + ' KB/s';
  }
  function fmtEta(sec) {
    if (!isFinite(sec) || sec <= 0) return '';
    sec = Math.round(sec);
    if (sec < 60) return '剩余 ' + sec + ' 秒';
    var m = Math.floor(sec / 60), s = sec % 60;
    return '剩余 ' + m + ' 分' + (s ? s + ' 秒' : '');
  }

  // ── 下载进度卡 UI（自包含·只在原生端创建）────────────────────────────────
  var ui = (function () {
    var root = null, fill = null, pctEl = null, szEl = null, spdEl = null, etaEl = null;
    var titleEl = null, verEl = null, actEl = null, restartBtn = null;
    var dismissTimer = null;

    function injectStyle() {
      if (document.getElementById('tm-ota-style')) return;
      var st = document.createElement('style');
      st.id = 'tm-ota-style';
      st.textContent =
        // ── 卡身：漆面 + 顶部暖光 + 描金发丝边 + 绢纹肌理 ──
        '#tm-ota-card{' +
          '--gold-hi:#f6e6b4;--gold:#d8b566;--gold-mid:#c4a45a;--paper:#ecd9b0;--paper-dim:#b6a378;' +
          'position:absolute;left:50%;bottom:34px;transform:translateX(-50%) translateY(16px);' +
          'width:600px;max-width:92%;box-sizing:border-box;padding:17px 22px 19px;z-index:2147483600;' +
          'color:var(--paper);font-family:"Noto Serif SC","Songti SC","Source Han Serif SC","STSong",serif;' +
          'border-radius:14px;border:1px solid rgba(214,181,102,0.32);' +
          'background:radial-gradient(125% 135% at 50% -25%,rgba(214,181,102,0.12),rgba(214,181,102,0) 55%),' +
          'linear-gradient(168deg,rgba(44,35,23,0.975),rgba(20,15,10,0.985));' +
          'box-shadow:0 22px 52px -14px rgba(0,0,0,0.72),0 2px 0 rgba(0,0,0,0.45),' +
          'inset 0 1px 0 rgba(246,230,180,0.13),inset 0 0 22px rgba(0,0,0,0.35);' +
          'opacity:0;overflow:hidden;transition:opacity .5s ease,transform .5s cubic-bezier(.16,.84,.24,1);}' +
        '#tm-ota-card::before{content:"";position:absolute;inset:0;pointer-events:none;border-radius:14px;' +
          'background:repeating-linear-gradient(135deg,rgba(246,230,180,0.022) 0 1px,rgba(0,0,0,0) 1px 5px);}' +
        '#tm-ota-card.tm-ota-show{opacity:1;transform:translateX(-50%) translateY(0);}' +
        '#tm-ota-card .tm-ota-glow{position:absolute;left:50%;top:-40%;width:70%;height:90%;pointer-events:none;' +
          'transform:translateX(-50%);border-radius:50%;opacity:.5;transition:opacity .6s ease;' +
          'background:radial-gradient(closest-side,rgba(214,181,102,0.16),rgba(214,181,102,0) 70%);}' +
        '#tm-ota-card.tm-ota-done .tm-ota-glow{opacity:1;animation:tm-ota-pulse 1.6s ease;}' +
        // ── 抬头：御印菱点 + 标题 + 朱印版本徽 + 关闭 + 描金分隔 ──
        '#tm-ota-card .tm-ota-head{position:relative;display:flex;align-items:center;gap:10px;' +
          'padding-bottom:13px;margin-bottom:3px;border-bottom:1px solid rgba(214,181,102,0.15);}' +
        '#tm-ota-card .tm-ota-head::after{content:"";position:absolute;left:0;bottom:-1px;width:48px;height:1px;' +
          'background:linear-gradient(90deg,var(--gold),rgba(214,181,102,0));}' +
        '#tm-ota-card .tm-ota-title{display:flex;align-items:center;font-size:15.5px;font-weight:600;' +
          'letter-spacing:3px;color:var(--gold-hi);text-shadow:0 1px 2px rgba(0,0,0,0.55);}' +
        '#tm-ota-card .tm-ota-title::before{content:"";width:7px;height:7px;margin-right:10px;transform:rotate(45deg);' +
          'background:linear-gradient(135deg,var(--gold-hi),var(--gold-mid));box-shadow:0 0 7px rgba(214,181,102,0.6);}' +
        '#tm-ota-card .tm-ota-ver{font-size:12px;letter-spacing:1px;color:#f6ddcf;font-variant-numeric:tabular-nums;' +
          'background:linear-gradient(180deg,rgba(178,59,46,0.92),rgba(132,36,28,0.94));' +
          'border:1px solid rgba(216,88,74,0.5);border-radius:5px;padding:2px 9px;' +
          'box-shadow:0 1px 3px rgba(0,0,0,0.45),inset 0 1px 0 rgba(255,255,255,0.14);}' +
        '#tm-ota-card .tm-ota-x{margin-left:auto;background:none;border:none;color:var(--paper-dim);font-size:17px;' +
          'cursor:pointer;line-height:1;padding:2px 4px;opacity:.55;transition:.2s;}' +
        '#tm-ota-card .tm-ota-x:hover{opacity:1;color:var(--gold-hi);}' +
        // ── 进度行：发丝凹槽轨 + 鎏金填充 + 流动扫光 + 鎏金大字百分比 ──
        '#tm-ota-card .tm-ota-progress{display:flex;align-items:center;gap:16px;margin-top:15px;}' +
        '#tm-ota-card .tm-ota-bar{position:relative;flex:1;height:10px;border-radius:7px;overflow:hidden;' +
          'background:linear-gradient(180deg,rgba(0,0,0,0.5),rgba(0,0,0,0.3));' +
          'box-shadow:inset 0 1px 3px rgba(0,0,0,0.7),inset 0 0 0 1px rgba(214,181,102,0.13);}' +
        '#tm-ota-card .tm-ota-fill{position:absolute;top:0;left:0;height:100%;width:0%;border-radius:7px;overflow:hidden;' +
          'background:linear-gradient(180deg,#f1da90 0%,#d8b566 45%,#a9842f 100%);' +
          'box-shadow:0 0 10px rgba(214,181,102,0.5),inset 0 1px 0 rgba(255,248,220,0.55);' +
          'transition:width .3s cubic-bezier(.3,.8,.3,1);}' +
        '#tm-ota-card .tm-ota-sheen{position:absolute;inset:0;transform:translateX(-100%);' +
          'background:linear-gradient(100deg,rgba(255,248,220,0) 25%,rgba(255,250,232,0.6) 50%,rgba(255,248,220,0) 75%);' +
          'animation:tm-ota-sweep 1.5s linear infinite;}' +
        '#tm-ota-card.tm-ota-settled .tm-ota-sheen{animation:none;opacity:0;}' +
        '#tm-ota-card .tm-ota-pct{min-width:60px;text-align:right;font-size:25px;font-weight:700;line-height:1;' +
          'letter-spacing:.5px;font-variant-numeric:tabular-nums;color:transparent;' +
          'background:linear-gradient(180deg,#f6e6b4,#d8b566 58%,#b58c3a);-webkit-background-clip:text;background-clip:text;' +
          'filter:drop-shadow(0 1px 1px rgba(0,0,0,0.45));}' +
        // ── 元信息行：大小 · 速度 · 剩余时间（圆点分隔）──
        '#tm-ota-card .tm-ota-meta{display:flex;align-items:center;gap:11px;margin-top:13px;font-size:13px;' +
          'letter-spacing:.3px;color:var(--paper-dim);font-variant-numeric:tabular-nums;}' +
        '#tm-ota-card .tm-ota-sz{color:#d9c79b;}' +
        '#tm-ota-card .tm-ota-spd{color:var(--gold);}' +
        '#tm-ota-card .tm-ota-spd:not(:empty)::before{content:"";display:inline-block;width:3px;height:3px;' +
          'border-radius:50%;background:rgba(214,181,102,0.55);margin-right:11px;vertical-align:middle;}' +
        '#tm-ota-card .tm-ota-eta{margin-left:auto;color:var(--paper-dim);}' +
        // ── 完成态金按钮：描金 + 一道掠光 ──
        '#tm-ota-card .tm-ota-actions{margin-top:16px;display:flex;gap:10px;animation:tm-ota-rise .42s ease both;}' +
        // 作者 display:flex 优先级盖过 UA [hidden]{display:none}·须显式补 [hidden] 隐藏（下载中按钮不该露）
        '#tm-ota-card .tm-ota-actions[hidden]{display:none;}' +
        '#tm-ota-card .tm-ota-restart{position:relative;overflow:hidden;flex:1;padding:11px 16px;border-radius:9px;' +
          'cursor:pointer;font-family:inherit;font-size:15px;font-weight:700;letter-spacing:3px;color:#2a1e0c;' +
          'border:1px solid #f0d98e;background:linear-gradient(180deg,#f5e09c,#d8b566 55%,#bb9038);' +
          'box-shadow:0 5px 16px -5px rgba(214,181,102,0.6),inset 0 1px 0 rgba(255,255,255,0.55),' +
          'inset 0 -2px 5px rgba(120,90,40,0.4);text-shadow:0 1px 0 rgba(255,248,220,0.5);}' +
        '#tm-ota-card .tm-ota-restart::after{content:"";position:absolute;top:0;left:-65%;width:45%;height:100%;' +
          'transform:skewX(-18deg);background:linear-gradient(100deg,rgba(255,255,255,0),rgba(255,255,255,0.65),rgba(255,255,255,0));' +
          'animation:tm-ota-btnsheen 2.8s ease-in-out infinite;}' +
        '#tm-ota-card .tm-ota-restart:active{transform:translateY(1px);' +
          'box-shadow:0 2px 8px -4px rgba(214,181,102,0.5),inset 0 1px 3px rgba(120,90,40,0.5);}' +
        // ── 动效关键帧 + 降级 ──
        '@keyframes tm-ota-sweep{to{transform:translateX(220%);}}' +
        '@keyframes tm-ota-rise{from{opacity:0;transform:translateY(9px);}to{opacity:1;transform:none;}}' +
        '@keyframes tm-ota-btnsheen{0%{left:-65%;}45%{left:135%;}100%{left:135%;}}' +
        '@keyframes tm-ota-pulse{0%{opacity:.5;}40%{opacity:1;}100%{opacity:.6;}}' +
        '@media (prefers-reduced-motion:reduce){#tm-ota-card,#tm-ota-card *{animation:none!important;' +
          'transition:opacity .2s ease!important;}}';
      (document.head || document.documentElement).appendChild(st);
    }

    function ensure() {
      if (root && document.body && document.body.contains(root)) return root;
      injectStyle();
      root = document.createElement('div');
      root.id = 'tm-ota-card';
      root.innerHTML =
        '<div class="tm-ota-glow"></div>' +
        '<div class="tm-ota-head">' +
          '<span class="tm-ota-title">检查更新</span>' +
          '<span class="tm-ota-ver" hidden></span>' +
          '<button class="tm-ota-x" title="收起">✕</button>' +
        '</div>' +
        '<div class="tm-ota-progress">' +
          '<div class="tm-ota-bar"><div class="tm-ota-fill"><span class="tm-ota-sheen"></span></div></div>' +
          '<span class="tm-ota-pct">0%</span>' +
        '</div>' +
        '<div class="tm-ota-meta">' +
          '<span class="tm-ota-sz"></span>' +
          '<span class="tm-ota-spd"></span>' +
          '<span class="tm-ota-eta"></span>' +
        '</div>' +
        '<div class="tm-ota-actions" hidden>' +
          '<button class="tm-ota-restart">立即重启生效</button>' +
        '</div>';
      (document.body || document.documentElement).appendChild(root);
      fill = root.querySelector('.tm-ota-fill');
      pctEl = root.querySelector('.tm-ota-pct');
      szEl = root.querySelector('.tm-ota-sz');
      spdEl = root.querySelector('.tm-ota-spd');
      etaEl = root.querySelector('.tm-ota-eta');
      titleEl = root.querySelector('.tm-ota-title');
      verEl = root.querySelector('.tm-ota-ver');
      actEl = root.querySelector('.tm-ota-actions');
      restartBtn = root.querySelector('.tm-ota-restart');
      root.querySelector('.tm-ota-x').addEventListener('click', hide);
      restartBtn.addEventListener('click', function () {
        var U = updater();
        try { if (U && U.reload) U.reload(); } catch (_) {}
      });
      // 入场动画
      setTimeout(function () { if (root) root.classList.add('tm-ota-show'); }, 20);
      return root;
    }

    function clearDismiss() { if (dismissTimer) { clearTimeout(dismissTimer); dismissTimer = null; } }

    function show(title, ver) {
      clearDismiss();
      ensure();
      root.classList.remove('tm-ota-settled', 'tm-ota-done'); // 进入活动态：扫光跑起来
      titleEl.textContent = title || '检查更新';
      if (ver) { verEl.textContent = 'v' + ver; verEl.hidden = false; } else { verEl.hidden = true; }
      actEl.hidden = true;
    }
    function progress(pct, doneBytes, totalBytes, bps) {
      ensure();
      pct = Math.max(0, Math.min(100, pct || 0));
      fill.style.width = pct.toFixed(0) + '%';
      pctEl.textContent = pct.toFixed(0) + '%';
      szEl.textContent = totalBytes ? (fmtMB(doneBytes) + ' / ' + fmtMB(totalBytes)) : '';
      spdEl.textContent = bps ? fmtSpeed(bps) : '';
      var eta = (bps && totalBytes) ? (totalBytes - doneBytes) / bps : 0;
      etaEl.textContent = eta ? fmtEta(eta) : '';
    }
    function stalled(pct, sec) {
      ensure();
      root.classList.remove('tm-ota-done');
      root.classList.add('tm-ota-settled'); // 停扫光·别再假装在动
      titleEl.textContent = '下载停滞';
      spdEl.textContent = '已停滞 ' + Math.max(0, sec || 0) + ' 秒';
      etaEl.textContent = '网络无响应·恢复后自动继续';
      // 百分比与已下大小保留不清——诚实呈现卡在哪
    }
    function done(ver) {
      clearDismiss();
      ensure();
      root.classList.add('tm-ota-settled', 'tm-ota-done'); // 停扫光 + 柔光脉冲一次
      titleEl.textContent = '更新已就绪';
      if (ver) { verEl.textContent = 'v' + ver; verEl.hidden = false; }
      fill.style.width = '100%';
      pctEl.textContent = '100%';
      szEl.textContent = '下载完成';
      spdEl.textContent = '';
      etaEl.textContent = '重启后生效';
      actEl.hidden = false;
    }
    function toast(title, ver, autoHideMs) {
      show(title, ver);
      root.classList.add('tm-ota-settled'); // 静态满条（如「已是最新」）·不扫光
      fill.style.width = '100%';
      pctEl.textContent = '';
      szEl.textContent = '';
      spdEl.textContent = '';
      etaEl.textContent = '';
      if (autoHideMs) { clearDismiss(); dismissTimer = setTimeout(hide, autoHideMs); }
    }
    function fail(msg) {
      show('更新检查失败');
      root.classList.add('tm-ota-settled');
      fill.style.width = '0%';
      pctEl.textContent = '';
      szEl.textContent = msg || '稍后自动重试';
      spdEl.textContent = '';
      etaEl.textContent = '';
      clearDismiss();
      dismissTimer = setTimeout(hide, 6000);
    }
    function hide() {
      clearDismiss();
      if (!root) return;
      root.classList.remove('tm-ota-show');
      setTimeout(function () { if (root && root.parentNode) { root.parentNode.removeChild(root); } root = null; }, 380);
    }

    return { show: show, progress: progress, stalled: stalled, done: done, toast: toast, fail: fail, hide: hide };
  })();

  // ── 拿 zip 总大小（算速度/ETA 用）：优先 latest.size，否则 HEAD content-length ──
  function resolveTotal(latest) {
    if (latest && typeof latest.size === 'number' && latest.size > 0) return Promise.resolve(latest.size);
    var url = latest && latest.url;
    if (!url || typeof fetch !== 'function') return Promise.resolve(0);
    return fetch(url, { method: 'HEAD', cache: 'no-store' }).then(function (r) {
      var n = parseInt(r.headers.get('content-length') || '0', 10);
      return (isFinite(n) && n > 0) ? n : 0;
    }).catch(function () { return 0; });
  }

  // ── 停滞侦测 + 有界自动重试（2026-07-20·玩家「卡在10%不动」实案）──────────
  var STALL_MS = 90000;               // 90s 无进度前进→判停滞（850MB 级大包·percent 事件粒度粗·阈值放宽防慢网误报）
  var STALL_POLL_MS = 5000;
  var MAX_ATTEMPTS = 3;               // 首次 + 自动重试 2 次
  var RETRY_DELAY_MS = [15000, 45000];
  var RECHECK_AFTER_FAIL_MS = 600000; // 彻底失败后 10 分钟整体再查一次（单发·不无限轮询）

  var dl = { active: false, stalled: false, attempts: 0, lastPct: 0, lastAdvanceAt: 0, version: '' };
  var recheckArmed = false;
  function scheduleRecheck() {
    if (recheckArmed) return;
    recheckArmed = true;
    setTimeout(function () { recheckArmed = false; runCheck(false); }, RECHECK_AFTER_FAIL_MS);
  }

  // ── 主流程：检查 → （有更新则）可视化下载 → set ───────────────────────────
  var busy = false;
  function runCheck(verbose) {
    var U = updater();
    if (!U || typeof U.download !== 'function') {
      if (verbose) ui.fail('更新组件不可用');
      return Promise.resolve();
    }
    if (busy) {
      // busy 泄漏修复：下载进行中玩家手动点「检查更新」不再被静默吞掉——把卡重新亮出来·如实反映状态
      if (verbose) {
        if (dl.active && dl.stalled) ui.stalled(dl.lastPct, Math.round((now() - dl.lastAdvanceAt) / 1000));
        else if (dl.active) ui.show('正在下载更新', dl.version);
        else ui.toast('正在检查更新…', '', 2500);
      }
      return Promise.resolve();
    }
    if (typeof fetch !== 'function') return Promise.resolve();
    busy = true;
    if (verbose) ui.show('正在检查更新…');

    return fetch(LATEST_URL, { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (latest) {
        if (!latest || !latest.version || !latest.url) {
          if (verbose) ui.fail('未取到版本信息');
          return;
        }
        return Promise.resolve(U.current ? U.current() : null).then(function (cur) {
          var curVer = (cur && cur.bundle && cur.bundle.version) || '';
          // 本地有效版本：当前运行 web 的 meta 版本（权威）优先，兜底 Capgo 当前 bundle 版本。
          var localVer = _localVersion() || curVer;
          // ★只有服务器版本「严格高于」本地才更新。
          //   原逻辑 `latest.version !== curVer` 的坑：① 玩家装了比服务器更新的 APK（本地版本更高）→ 不等 → 被强制下载（降级）；
          //   ② 全新装时 Capgo current 是 "builtin" 而非语义版本 → 永远 !== latest → 即使内容一致也强制下载。
          //   改用 semver 比较根治：localVer ≥ latest 一律不更新。
          if (_compareVer(latest.version, localVer) <= 0) {
            if (verbose) ui.toast('已是最新版', localVer || latest.version, 3200);
            return;
          }
          try { console.log('[tm-capacitor-boot] 发现热更 ' + latest.version + '（本地 ' + (localVer || '?') + '）' + (latest.manifest ? '·差量' : '·全包') + '·下载中…'); } catch (_) {}
          return startDownload(U, latest);
        });
      })
      .catch(function () { if (verbose) ui.fail('网络异常'); })
      .then(function () { busy = false; });
  }

  function startDownload(U, latest) {
    ui.show('正在下载更新', latest.version);
    dl.active = true; dl.stalled = false; dl.attempts = 0;
    dl.lastPct = 0; dl.lastAdvanceAt = now(); dl.version = latest.version;
    return resolveTotal(latest).then(function (total) {
      // 速度采样（滚动 2.5s 窗口）
      var samples = [];
      function pushSample(bytes) {
        var t = now();
        samples.push({ t: t, b: bytes });
        while (samples.length > 2 && (t - samples[0].t) > 2500) samples.shift();
      }
      function speed() {
        if (samples.length < 2) return 0;
        var a = samples[0], z = samples[samples.length - 1];
        var dt = (z.t - a.t) / 1000;
        return dt > 0 ? Math.max(0, (z.b - a.b) / dt) : 0;
      }
      var lastPaint = 0;
      function onPercent(pct) {
        pct = Math.max(0, Math.min(100, pct || 0));
        if (pct > dl.lastPct) {              // 只认真前进·停滞计时随之清零
          dl.lastPct = pct; dl.lastAdvanceAt = now();
          if (dl.stalled) { dl.stalled = false; ui.show('正在下载更新', latest.version); } // 停滞恢复→回正常态
        }
        var bytes = total ? total * pct / 100 : 0;
        if (total) pushSample(bytes);
        var t = now();
        if (t - lastPaint < 200 && pct < 100) return;   // 限频，避免过度重绘
        lastPaint = t;
        if (!dl.stalled) ui.progress(pct, bytes, total, total ? speed() : 0);
      }

      var opt = { version: latest.version, url: latest.url || '' };
      if (latest.manifest && latest.manifest.length) opt.manifest = latest.manifest;

      function attempt() {
        dl.attempts++;
        dl.stalled = false; dl.lastAdvanceAt = now();
        // 接 download 进度事件（每次尝试各自挂/摘·避免旧监听器窜台）
        var handle = null;
        try {
          if (typeof U.addListener === 'function') {
            handle = U.addListener('download', function (e) {
              onPercent(e && typeof e.percent === 'number' ? e.percent : 0);
            });
          }
        } catch (_) {}
        function removeListener() {
          try { Promise.resolve(handle).then(function (h) { if (h && h.remove) h.remove(); }); } catch (_) {}
        }
        // 停滞看门狗：percent 长时间不前进→卡面如实亮「下载停滞」·进度一恢复自动回正常态
        var watchdog = setInterval(function () {
          if (!dl.active) return;
          var idle = now() - dl.lastAdvanceAt;
          if (idle > STALL_MS) {
            if (!dl.stalled) {
              dl.stalled = true;
              try { console.warn('[tm-capacitor-boot] 下载停滞 ' + Math.round(idle / 1000) + 's @' + dl.lastPct + '%'); } catch (_) {}
            }
            ui.stalled(dl.lastPct, Math.round(idle / 1000));
          }
        }, STALL_POLL_MS);
        function cleanup() {
          removeListener();
          try { clearInterval(watchdog); } catch (_) {}
        }

        ui.progress(dl.lastPct, total ? total * dl.lastPct / 100 : 0, total, 0);
        return Promise.resolve(U.download(opt)).then(function (b) {
          cleanup(); dl.active = false; dl.stalled = false;
          if (b && b.id && U.set) {
            return Promise.resolve(U.set({ id: b.id })).then(function () { ui.done(latest.version); });
          }
          ui.done(latest.version);
        }).catch(function (err) {
          cleanup();
          try { console.warn('[tm-capacitor-boot] 下载失败(第' + dl.attempts + '/' + MAX_ATTEMPTS + '次)', err); } catch (_) {}
          if (dl.attempts < MAX_ATTEMPTS) {
            var wait = RETRY_DELAY_MS[dl.attempts - 1] || 45000;
            ui.toast('下载失败·' + Math.round(wait / 1000) + ' 秒后自动重试（第 ' + (dl.attempts + 1) + '/' + MAX_ATTEMPTS + ' 次）', latest.version, 0);
            return new Promise(function (res) {
              setTimeout(function () { ui.show('正在下载更新', latest.version); res(attempt()); }, wait);
            });
          }
          dl.active = false; dl.stalled = false;
          ui.fail('下载失败·10 分钟后自动再查·也可在设置里手动检查');
          scheduleRecheck();
        });
      }
      return attempt();
    });
  }

  // 等主界面起来再确认健康（给游戏 boot 一点时间，避免起得太早 Capgo 误判），随后查热更
  function arm() {
    setTimeout(notifyReady, 1800);
    setTimeout(function () { runCheck(false); }, 5000); // 自动检查：无更新则静默，有更新弹进度卡
  }
  if (document.readyState === 'complete') arm();
  else window.addEventListener('load', arm);

  // 暴露给 TM.platform：手动「检查热更新」入口（capacitor 端）
  try {
    window.TM = window.TM || {};
    window.TM.capacitorUpdate = {
      // 手动检查：有更新→可视化下载；无更新→「已是最新」提示（verbose）
      check: function () { return runCheck(true); },
      current: function () {
        var U = updater();
        if (U && typeof U.current === 'function') return U.current();
        return Promise.resolve(null);
      },
      reload: function () {
        var U = updater();
        if (U && typeof U.reload === 'function') return U.reload();
        return Promise.resolve();
      },
      // 调试/测试探针：下载状态快照（smoke 与真机排查用·非游戏 API）
      _dl: function () {
        return { busy: busy, active: dl.active, stalled: dl.stalled, attempts: dl.attempts, lastPct: dl.lastPct, version: dl.version };
      }
    };
  } catch (_) {}
})();
