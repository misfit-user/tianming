#!/usr/bin/env node
// smoke-fullscreen-toggle.js — 全屏/窗口切换:三端接线 + _tmSetFullscreen 行为
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let assertions = 0;
function assert(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); assertions++; }
const read = p => fs.readFileSync(p, 'utf8');

// ── 1) preload 暴露 setFullScreen/isFullScreen ──

// ── 2) main 有 set-fullscreen/get-fullscreen 处理器 + setFullScreen 调用 ──

// ── 3) 设置·界面显示 有 全屏/窗口 pills + 函数 ──
const patches = (read(path.join(ROOT, 'tm-patches.js')) + '\n' + read(path.join(ROOT, 'tm-patches-start.js')));
// pills 在「界面显示」section 内(在 字号/分辨率 之后、该 section return 之前)
const secStart = patches.indexOf('<h4>界面显示</h4>');
const fsPos = patches.indexOf("pillFs(true, '全屏')");
const secReturn = patches.indexOf("return h + '</div>';", secStart);
assert(secStart > 0 && fsPos > secStart && fsPos < secReturn, '全屏/窗口 pills 应在「界面显示」section 内');

// ── 4) _tmSetFullscreen 行为(抽取函数体在桩环境跑) ──
const m = patches.match(/window\._tmSetFullscreen\s*=\s*function[\s\S]*?\n\};/);
assert(m, '应能抽取 _tmSetFullscreen 函数');
const store = {};
const calls = [];
const ctx = {
  localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
  document: { documentElement: {}, fullscreenElement: null },
  window: {},
  toast: () => {},
  console
};
ctx.window.tianming = { setFullScreen: (f) => calls.push(f) };
ctx.window._tmSetFullscreen = null;
vm.createContext(ctx);
vm.runInContext(m[0], ctx, { filename: '_tmSetFullscreen' });
const fn = ctx.window._tmSetFullscreen;
assert(typeof fn === 'function', '_tmSetFullscreen 应可调用');

// 切窗口
fn(false, null);
assert(store['tm.fullscreen'] === '0', '切窗口应存 tm.fullscreen=0');
assert(calls[calls.length - 1] === false, 'Electron 走 tianming.setFullScreen(false)');
// 切全屏
fn(true, null);
assert(store['tm.fullscreen'] === '1', '切全屏应存 tm.fullscreen=1');
assert(calls[calls.length - 1] === true, 'Electron 走 tianming.setFullScreen(true)');

// 浏览器兜底(无 tianming·走 HTML5 Fullscreen API)
const calls2 = { req: 0, exit: 0 };
const ctx2 = {
  localStorage: { getItem: () => null, setItem: () => {} },
  document: { documentElement: { requestFullscreen: () => { calls2.req++; return { catch(){} }; } }, exitFullscreen: () => { calls2.exit++; }, fullscreenElement: {} },
  window: {}, toast: () => {}, console
};
ctx2.window._tmSetFullscreen = null;
vm.createContext(ctx2);
vm.runInContext(m[0], ctx2, { filename: '_tmSetFullscreen2' });
ctx2.window._tmSetFullscreen(true, null);
assert(calls2.req === 1, '无 Electron 时切全屏走 requestFullscreen');
ctx2.window._tmSetFullscreen(false, null);
assert(calls2.exit === 1, '无 Electron 时切窗口走 exitFullscreen');

console.log('[smoke-fullscreen-toggle] pass assertions=' + assertions);
