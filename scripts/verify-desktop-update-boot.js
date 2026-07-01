// ============================================================
//  verify-desktop-update-boot.js — S4 桌面自检模块验证
//  桩 window.tianming + TMUpdateCard 记录器 + 可控时钟·全链路事件流仿真
//  运行：node web/scripts/verify-desktop-update-boot.js
//
//  ★2026-07-01·桌面端取消「自动弹热更卡」(owner：桌面热更改到「创意工坊/更新中心」手动做)。
//    本脚本改测新契约：开局零自动检查 / 零热更卡 / 零自愈 toast；手动 TMDesktopUpdate.check(true)
//    (联网中枢/调试)仍完整可用（发现新版弹卡→下载→事件流→装完重启 / 已是最新 / 失败 / 需更新本体）。
// ============================================================
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SRC = fs.readFileSync(path.join(ROOT, 'web', 'tm-desktop-update.js'), 'utf-8');

let assertions = 0;
function assert(cond, label) {
  if (cond) { assertions++; console.log('  ok·' + label); }
  else { console.error('  FAIL·' + label); process.exit(1); }
}
const tick = () => new Promise(r => setImmediate(r));
async function flush() { for (let i = 0; i < 6; i++) await tick(); }

function load(opts) {
  opts = opts || {};
  const calls = { card: [], ipc: [] };
  const timers = [];
  let statusCb = null;
  const store = Object.assign({}, opts.localStorage || {});
  const cardRec = new Proxy({}, {
    get(_, name) {
      if (name === '_fmt') return { fmtMB: b => Math.round(b / 1048576) + ' MB' };
      if (name === 'isVisible') return () => false;
      return function () { calls.card.push({ fn: name, args: Array.from(arguments) }); };
    }
  });
  const tianming = {
    hotUpdateStatus() {
      calls.ipc.push('hotUpdateStatus');
      return Promise.resolve({ success: true, status: Object.assign({ isPackaged: true, lastRepair: null, rendererVersion: '1.3.3.5' }, opts.status || {}) });
    },
    checkHotUpdate(url) {
      calls.ipc.push('checkHotUpdate:' + url);
      return Promise.resolve(Object.assign({ success: true, hasUpdate: false, currentVersion: '1.3.3.5' }, opts.check || {}));
    },
    installHotUpdate(url) {
      calls.ipc.push('installHotUpdate:' + url);
      return opts.installResult ? Promise.resolve(opts.installResult) : new Promise(() => {});
    },
    reloadAfterHotUpdate() { calls.ipc.push('reload'); return Promise.resolve({ success: true }); },
    onHotUpdateStatus(cb) { statusCb = cb; },
    checkForUpdate(url) {
      calls.ipc.push('checkForUpdate:' + url);
      return Promise.resolve(Object.assign({ success: true, hasUpdate: false }, opts.installerCheck || {}));
    },
    downloadUpdate() {
      calls.ipc.push('downloadUpdate');
      return Promise.resolve(opts.installerDownload || { success: true });
    },
    installUpdate() { calls.ipc.push('installUpdate'); return Promise.resolve({ success: true }); },
    onUpdateStatus(cb) { updateCb = cb; }
  };
  let updateCb = null;
  const windowStub = {
    tianming,
    TMUpdateCard: cardRec,
    TM_Changelog: { show() { calls.ipc.push('changelogShow'); } },
    performance: { now: () => Date.now() },
    addEventListener() {}
  };
  let modalRounds = opts.modalRounds || 0;
  const documentStub = {
    readyState: 'complete',
    hidden: false,
    getElementById(id) {
      if (id === 'tm-changelog-ov' && modalRounds > 0) { modalRounds--; return {}; }
      return null;
    },
    querySelector() { return null; }
  };
  const localStorageStub = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); }
  };
  const setTimeoutStub = (fn, ms) => { timers.push({ fn, ms }); return timers.length; };
  const setIntervalStub = (fn, ms) => { timers.push({ fn, ms, interval: true }); return timers.length; };
  new Function('window', 'document', 'localStorage', 'setTimeout', 'setInterval', SRC)(
    windowStub, documentStub, localStorageStub, setTimeoutStub, setIntervalStub);
  return {
    calls, timers, store, windowStub,
    fire(ms) { timers.filter(t => t.ms === ms && !t.fired).forEach(t => { t.fired = true; t.fn(); }); },
    fireAll() { timers.slice().forEach(t => { if (!t.fired) { t.fired = true; try { t.fn(); } catch (_) {} } }); },
    emit(ev) { if (statusCb) statusCb(ev); },
    emitUpdate(ev) { if (updateCb) updateCb(ev); },
    cardCall(fn) { return calls.card.filter(c => c.fn === fn); }
  };
}

(async function main() {
  // ── 0·本次修复核心·桌面开局零自动检查 / 零热更卡 ──
  {
    const env = load({ check: { hasUpdate: true, remoteVersion: '9.9.9.9', size: 50e6, flags: {} } });
    assert(!env.timers.some(t => t.ms === 8000), '0·启动首查未排程（自动检查已停用）');
    assert(!env.timers.some(t => t.interval), '0·周期复查未排程（无 setInterval）');
    // 就算强推任何遗留计时器·也绝不该自动查 feed / 自动弹卡
    env.fireAll();
    await flush();
    assert(!env.calls.ipc.some(c => c.indexOf('checkHotUpdate:') === 0), '0·未自动查热更 feed');
    assert(env.cardCall('show').length === 0, '0·未自动弹更新卡');
    assert(env.cardCall('toast').length === 0, '0·未自动弹提示 toast');
  }

  // ── 1·自愈 toast 也随自动检查一并停发（开局不弹金卡） ──
  {
    const env = load({ status: { lastRepair: { at: '2026-06-11T00:00:00Z', reasons: ['boot-crash-loop'] } } });
    env.fireAll();
    await flush();
    assert(env.cardCall('toast').length === 0, '1·启动不再自动弹自愈 toast');
    assert(env.cardCall('show').length === 0, '1·启动零卡');
  }

  // ── 2·手动入口仍在·完整链路（联网中枢/调试用 TMDesktopUpdate.check）──
  {
    const env = load({ check: { hasUpdate: true, remoteVersion: '9.9.9.9', size: 50e6, flags: {} } });
    assert(typeof env.windowStub.TMDesktopUpdate.check === 'function', '2·TMDesktopUpdate.check 手动入口在');
    await env.windowStub.TMDesktopUpdate.check(false);
    await flush();
    assert(env.calls.ipc.indexOf('hotUpdateStatus') !== -1, '2·手动检查先查状态');
    assert(env.calls.ipc.some(c => c.indexOf('checkHotUpdate:') === 0), '2·后查 feed');
    const shows = env.cardCall('show');
    assert(shows.length === 1 && shows[0].args[0].title === '发现新版本' && shows[0].args[0].version === '9.9.9.9', '2·弹「发现新版本」卡');
    const acts = env.cardCall('setActions');
    assert(acts.length === 1 && acts[0].args[0].length === 2 && acts[0].args[0][0].label === '立即更新', '2·按钮=立即更新+查看更新内容');
    acts[0].args[0][1].onClick();
    assert(env.calls.ipc.indexOf('changelogShow') !== -1, '2·查看更新内容 → 邸报');
    acts[0].args[0][0].onClick();
    await flush();
    assert(env.calls.ipc.some(c => c.indexOf('installHotUpdate:') === 0), '2·立即更新 → 安装 IPC');
    env.emit({ kind: 'incremental-plan', version: '9.9.9.9', total: 100, fetch: 5, reuse: 95, fetchBytes: 1000 });
    env.emit({ kind: 'incremental-progress', version: '9.9.9.9', done: 2, total: 5, bytesDone: 400, fetchBytes: 1000 });
    const prog = env.cardCall('progress');
    const last = prog[prog.length - 1].args[0];
    assert(Math.round(last.percent) === 40 && last.label === '2/5 文件', '2·进度事件 → 40%·2/5 文件');
    env.emit({ kind: 'installed', version: '9.9.9.9' });
    const dones = env.cardCall('done');
    assert(dones.length === 1 && dones[0].args[0].actions[0].label === '立即重启生效', '2·installed → 一键重启卡');
    dones[0].args[0].actions[0].onClick();
    assert(env.calls.ipc.indexOf('reload') !== -1, '2·重启按钮 → reloadAfterHotUpdate');
  }

  // ── 3·手动检查·已是最新 → toast ──
  {
    const env = load({ check: { hasUpdate: false, currentVersion: '1.3.3.5' } });
    await env.windowStub.TMDesktopUpdate.check(true);
    await flush();
    assert(env.cardCall('toast').some(c => c.args[0] === '已是最新版'), '3·手动检查无更新 → 已是最新版');
  }

  // ── 4·手动检查失败·可见 ──
  {
    const env = load({ check: { success: false, error: '网络炸了' } });
    await env.windowStub.TMDesktopUpdate.check(true);
    await flush();
    assert(env.cardCall('fail').length === 1, '4·手动检查失败 → fail 卡');
  }

  // ── 5·手动检查·needsInstaller → 本体安装包流程 ──
  {
    const env = load({
      check: { hasUpdate: true, remoteVersion: '9.9.9.9', needsInstaller: true, flags: {} },
      installerCheck: { hasUpdate: true, remoteVersion: '2.0.0', size: 443e6 }
    });
    await env.windowStub.TMDesktopUpdate.check(false);
    await flush();
    assert(env.calls.ipc.some(c => c.indexOf('checkForUpdate:') === 0), '5·needsInstaller → 查本体 feed');
    const shows = env.cardCall('show');
    assert(shows.some(s => s.args[0].title === '发现新版本·需更新本体'), '5·弹「需更新本体」卡');
    const acts = env.cardCall('setActions');
    assert(acts[0].args[0][0].label === '下载安装包', '5·主按钮=下载安装包');
  }

  console.log('PASS assertions=' + assertions);
})().catch(e => {
  console.error('VERIFY FAILED·', e && e.stack || e);
  process.exit(1);
});
