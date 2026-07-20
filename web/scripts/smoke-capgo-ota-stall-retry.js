// smoke-capgo-ota-stall-retry.js — 安卓 Capgo OTA 下载健壮性（停滞看门狗/有界重试/busy 泄漏）
//
// 病灶(玩家真机实证·2026-07-20 1.3.4.10 发版当天)：850MB 全量包下载「卡在10%不动」——
// tm-capacitor-boot.js 原实现①无停滞侦测(插件 promise 挂住→进度卡冻结永不动)②失败文案说
// "稍后重试"但从未排程任何重试③busy 旗一挂·玩家手动「检查更新」被静默吞掉(点了没反应)。
// 修法：percent 看门狗(90s 无前进→卡面如实示「下载停滞」·恢复自动回正常态·Capgo v6 无取消
// API 故绝不假取消)+ 失败 15s/45s 退避自动重试共 3 次 + 彻底失败 10 分钟单发再查 + busy 中
// verbose 检查如实回显状态。本 smoke 用假时钟/假 DOM/mock 插件把整条链走一遍。
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.join(__dirname, '..');
var failures = [];
function assert(cond, msg) {
  if (cond) { console.log('  PASS ' + msg); }
  else { failures.push(msg); console.log('  FAIL ' + msg); }
}

// ── 假时钟（模块内 setTimeout/setInterval/Date.now 全走它·vm realm 本无 timer 全局）──
var fakeNow = 0;
var timers = [];
var tid = 1;
function addTimer(fn, ms, isInterval) {
  timers.push({ id: tid, fn: fn, at: fakeNow + (Number(ms) || 0), interval: isInterval ? Math.max(1, Number(ms) || 1) : 0 });
  return tid++;
}
function killTimer(id) {
  for (var i = timers.length - 1; i >= 0; i--) if (timers[i].id === id) timers.splice(i, 1);
}
function flush() { // 跨 realm promise 链要多轮微任务才能走完
  return new Promise(function (r) {
    var n = 0;
    (function step() { if (++n > 6) return r(); setImmediate(step); })();
  });
}
async function advance(ms) {
  var target = fakeNow + ms;
  for (;;) {
    var next = null;
    for (var i = 0; i < timers.length; i++) if (timers[i].at <= target && (!next || timers[i].at < next.at)) next = timers[i];
    if (!next) break;
    fakeNow = Math.max(fakeNow, next.at);
    if (next.interval) next.at = fakeNow + next.interval;
    else timers.splice(timers.indexOf(next), 1);
    try { next.fn(); } catch (e) { failures.push('timer fn threw: ' + e.message); }
    await flush();
  }
  fakeNow = target;
}

// ── 假 DOM（进度卡只 set 属性·stub 即可）──
function el() {
  var self = {
    style: {}, textContent: '', innerHTML: '', hidden: false, id: '', className: '',
    classList: { add: function () {}, remove: function () {}, contains: function () { return false; } },
    setAttribute: function () {}, getAttribute: function () { return null; },
    addEventListener: function () {}, appendChild: function () {}, removeChild: function () {},
    contains: function () { return true; }, parentNode: null,
    querySelector: function () { return el(); }
  };
  return self;
}

// ── mock Capgo 插件 ──
var calls = { download: 0, set: 0, notifyReady: 0 };
var pendingDl = null; // {resolve, reject, opt}
var progressCbs = [];
function emitPct(p) {
  progressCbs.slice().forEach(function (cb) { cb({ percent: p }); });
}
var U = {
  notifyAppReady: function () { calls.notifyReady++; },
  current: function () { return Promise.resolve({ bundle: { version: '1.3.4.9' } }); },
  addListener: function (_name, cb) {
    progressCbs.push(cb);
    return Promise.resolve({ remove: function () { var i = progressCbs.indexOf(cb); if (i >= 0) progressCbs.splice(i, 1); } });
  },
  download: function (opt) {
    calls.download++;
    return new Promise(function (res, rej) { pendingDl = { resolve: res, reject: rej, opt: opt }; });
  },
  set: function () { calls.set++; return Promise.resolve(); },
  reload: function () { return Promise.resolve(); }
};

// ── 沙箱 ──
var sandbox = { console: console };
sandbox.window = sandbox;
sandbox.global = sandbox;
sandbox.Date = { now: function () { return fakeNow; } };
sandbox.setTimeout = function (fn, ms) { return addTimer(fn, ms, false); };
sandbox.setInterval = function (fn, ms) { return addTimer(fn, ms, true); };
sandbox.clearTimeout = killTimer;
sandbox.clearInterval = killTimer;
sandbox.document = {
  readyState: 'complete',
  head: el(), documentElement: el(), body: el(),
  getElementById: function () { return null; },
  querySelector: function () { return null; },
  createElement: function () { return el(); }
};
sandbox.fetch = function () {
  return Promise.resolve({
    ok: true,
    json: function () { return Promise.resolve({ version: '1.3.4.10', url: 'https://x/capgo/bundles/1.3.4.10.zip', size: 854845027 }); },
    headers: { get: function () { return '854845027'; } }
  });
};
sandbox.Capacitor = { isNativePlatform: function () { return true; }, Plugins: { CapacitorUpdater: U } };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-capacitor-boot.js'), 'utf8'), sandbox, { filename: 'tm-capacitor-boot.js' });

function dbg() { return sandbox.TM.capacitorUpdate._dl(); }

(async function main() {
  await flush();

  console.log('① 启动自检→发现新版→开始下载');
  await advance(5000); // arm(): notifyReady@1.8s + 自动检查@5s
  assert(calls.notifyReady === 1, 'notifyAppReady 已调用');
  assert(calls.download === 1, '发现 1.3.4.10 高于本地 1.3.4.9 → download 启动');
  assert(dbg().busy === true && dbg().active === true, '下载中 busy/active 竖旗');

  console.log('② 进度前进·无停滞误报');
  emitPct(5); await flush();
  emitPct(10); await flush();
  assert(dbg().lastPct === 10, 'percent 前进记账到 10%');
  await advance(30000);
  assert(dbg().stalled === false, '30s 未超阈值·不误报停滞');

  console.log('③ 停滞看门狗（90s 无前进→判停滞·真机「卡在10%」案）');
  await advance(95000);
  assert(dbg().stalled === true, '95s 无进度 → stalled 竖旗·卡面示「下载停滞」');

  console.log('④ busy 泄漏修复：下载中手动检查不吞·不重复起下载');
  sandbox.TM.capacitorUpdate.check(); await flush();
  assert(calls.download === 1, 'busy 中手动 check 不新起下载');
  assert(dbg().busy === true, 'busy 状态如实保持');

  console.log('⑤ 进度恢复→停滞旗自动落');
  emitPct(12); await flush();
  assert(dbg().stalled === false, '进度恢复 → stalled 自动清·回正常下载态');

  console.log('⑥ 下载失败→15s/45s 退避自动重试');
  pendingDl.reject(new Error('ENETDOWN')); pendingDl = null; await flush();
  assert(dbg().attempts === 1, '第 1 次尝试失败已记账');
  await advance(15000);
  assert(calls.download === 2, '15s 退避后自动重试（第 2 次）');
  pendingDl.reject(new Error('ENETDOWN')); pendingDl = null; await flush();
  await advance(45000);
  assert(calls.download === 3, '45s 退避后自动重试（第 3 次）');

  console.log('⑦ 三连败→彻底失败·busy 释放·10 分钟单发再查');
  pendingDl.reject(new Error('ENETDOWN')); pendingDl = null; await flush();
  assert(dbg().active === false, '三连败后下载态收旗');
  assert(dbg().busy === false, 'busy 释放·手动检查通道恢复');
  await advance(600000);
  assert(calls.download === 4, '10 分钟后自动再查 → 新一轮下载');

  console.log('⑧ 成功收尾：set 生效·busy 释放');
  pendingDl.resolve({ id: 'bundle-1' }); pendingDl = null; await flush(); await flush();
  assert(calls.set === 1, '下载成功 → set(bundle) 已调用');
  assert(dbg().busy === false && dbg().active === false, '成功后 busy/active 全收旗');
  assert(progressCbs.length === 0, '进度监听器全部摘除·无泄漏');

  console.log('');
  if (failures.length) {
    console.log('FAIL smoke-capgo-ota-stall-retry: ' + failures.length + ' 处失败');
    failures.forEach(function (f) { console.log('  - ' + f); });
    process.exit(1);
  }
  console.log('PASS smoke-capgo-ota-stall-retry (' + '停滞看门狗/有界重试/busy 泄漏' + ')');
})().catch(function (e) {
  console.error('SMOKE CRASH:', e);
  process.exit(1);
});
