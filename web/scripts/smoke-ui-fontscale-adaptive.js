#!/usr/bin/env node
'use strict';
/* smoke-ui-fontscale-adaptive — 界面字号自适应（2026-08-10）防腐线。
 * A1 屏幕宽定档（≥3400→1.6·≥2400→1.35·其余→1.2）两处一字不差（index.html early-apply ↔ tm-patches.js _tmUiFontScaleDefault）
 * A2 固定舞台整体放大时字号默认折算防双重放大（stg>1 才折算·APK 舞台缩小不折算）
 * A3 只生效不落盘（tm.uiFontScale 只有 _tmSetUiFontScale 一处写）
 * A4 运行中重适配（resize 去抖重算·显式选档不参与）
 * A5 四档 pills 与「屏幕宽优先于窗口宽」取值不变
 * A6 御案字号跟着开关走（美术宪法第2刀）：没显式选档不写 --tm-px（画面不变），选了档按「选档 ÷ 出厂档」写；
 *    御案五个样式文件不再写死像素字号；旧「全局字号」折进界面字号，设置与抽屉只剩一个字号开关 */
var fs = require('fs');
var path = require('path');
var ROOT = path.resolve(__dirname, '..');
var P = 0, F = 0;
function ok(c, m) { if (c) { P++; console.log('  ✓ ' + m); } else { F++; console.log('  ✗ FAIL: ' + m); } }
function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }
function has(s, sub) { return s.indexOf(sub) >= 0; }
console.log('smoke-ui-fontscale-adaptive');

var idx = read('index.html');
var pat = read('tm-patches.js');

var TIER = '(w >= 3400) ? 1.6 : (w >= 2400) ? 1.35 : 1.2';
var FITRE = "/^(\\d{3,4})x(\\d{3,4})$/";
var SCALE = 'if (stg > 1) s = Math.round(Math.min(1.6, Math.max(0.9, s / stg)) * 100) / 100;';
var SCREENW = '(window.screen && window.screen.availWidth) || window.innerWidth';

console.log('— A1 · 屏幕宽定档·两处一字不差 —');
ok(has(idx, TIER), 'index.html early-apply 含定档三元（≥3400→1.6·≥2400→1.35·其余→1.2）');
ok(has(pat, TIER), 'tm-patches.js _tmUiFontScaleDefault 含同一定档三元（一字不差）');
ok(has(pat, 'function _tmUiFontScaleDefault(){'), '出厂档函数在');

console.log('— A2 · 防双重放大 —');
ok(has(idx, FITRE) && has(pat, FITRE), '两处同读 tm.fitResolution（同一正则）');
ok(has(idx, SCALE), 'index.html 含舞台放大折算式（stg>1·夹 0.9~1.6·两位小数）');
ok(has(pat, SCALE), 'tm-patches.js 含同一折算式（一字不差）');

console.log('— A3 · 只生效不落盘 —');
ok(!has(idx, "setItem('tm.uiFontScale'"), 'index.html early-apply 不写 tm.uiFontScale');
ok((pat.split("setItem('tm.uiFontScale'").length - 1) === 1, 'tm-patches.js 全文件仅 _tmSetUiFontScale 一处写该键');

console.log('— A4 · 运行中重适配 —');
ok(has(pat, "window.addEventListener('resize'") && has(pat, '_tmFsAdaptT'), 'resize 去抖重算监听器在');
ok(has(pat, "if (localStorage.getItem('tm.uiFontScale')) return;"), '显式选过档（有存值）完全不参与重适配');
ok(has(pat, 'document.documentElement.style.fontSize = (s === 1 ?'), '重适配即时应用根字号');

console.log('— A5 · 存量契约不动 —');
ok(has(pat, "pill(0.9,'小') + pill(1,'标准') + pill(1.2,'大') + pill(1.35,'特大')"), '四档 pills 原样');
ok(has(idx, SCREENW) && has(pat, SCREENW), '两处均屏幕宽优先、窗口宽兜底');
ok(has(pat, "localStorage.setItem('tm.uiFontScale', String(v)); localStorage.removeItem('tianming_font_size')"), '_tmSetUiFontScale 写入+清旧键行为不动');

console.log('— A6 · 御案字号跟着开关走 —');
var vm = require('vm');
var early = /<script>\s*\/\* 界面字号·早期应用[\s\S]*?<\/script>/.exec(idx);
ok(!!early, 'index.html early-apply 块在');
function runEarly(screenW, stored) {
  var props = {};
  var style = { fontSize: '', setProperty: function(k, v) { props[k] = v; }, removeProperty: function(k) { delete props[k]; } };
  var ctx = {
    window: { screen: { availWidth: screenW, availHeight: Math.round(screenW * 9 / 16) }, innerWidth: 1440, innerHeight: 900 },
    localStorage: { getItem: function(k) { return k === 'tm.uiFontScale' ? stored : null; } },
    document: { documentElement: { style: style } }
  };
  vm.runInNewContext(early[0].replace(/^<script>|<\/script>$/g, ''), ctx);
  return { root: style.fontSize, px: props['--tm-px'] };
}
[
  [1920, null, '19.2px', undefined, '1920 没选档：出厂 1.2，不写 --tm-px'],
  [1920, '1.35', '21.6px', '1.125px', '1920 选「特大」：御案 ×1.125'],
  [1920, '1.2', '19.2px', undefined, '1920 选的正好是出厂档：不写'],
  [1920, '0.9', '14.4px', '0.75px', '1920 选「小」：御案 ×0.75'],
  [2560, '1.35', '21.6px', undefined, '2K 选「特大」＝出厂档：不写']
].forEach(function(c) {
  var r = runEarly(c[0], c[1]);
  ok(r.root === c[2] && r.px === c[3], c[4] + '（根字号 ' + r.root + '，--tm-px ' + r.px + '）');
});
ok(has(pat, 'function _tmSyncUiPx(){') && has(pat, "(Math.round(v / auto * 10000) / 10000) + 'px'"), 'tm-patches.js _tmSyncUiPx 与 early-apply 同算法');
ok(/window\._tmSetUiFontScale = function\(v, btn\)\{[\s\S]{0,400}_tmSyncUiPx\(\);/.test(pat), '选档时同步 --tm-px');
ok(has(pat, 'setTimeout(_tmSyncUiPx, 300)'), '换显示器（窗口变化）时重算 --tm-px，显式选过档的也算');
['phase8-formal-bridge-styles.js', 'phase8-formal-drafts.js', 'phase8-formal-drafts-message-panels.js', 'phase8-formal-records.js', 'phase8-formal-bridge.js'].forEach(function(f) {
  var left = (read(f).match(/font-size\s*:\s*\d+(?:\.\d+)?px/g) || []).length;
  ok(left === 0, f + ' 的字号都写成 --tm-px（剩写死像素 ' + left + ' 处）');
});
var themeSrc = read('tm-theme-font.js');
function loadTheme(saved) {
  var store = Object.assign({}, saved), calls = [], nodes = {};
  var ctx = {
    console: console,
    document: { readyState: 'loading', addEventListener: function() {}, getElementById: function(id) { return nodes[id] || null; },
      createElement: function() { return { textContent: '' }; }, head: { appendChild: function(el) { nodes[el.id] = el; } } },
    localStorage: { getItem: function(k) { return k in store ? store[k] : null; }, setItem: function(k, v) { store[k] = String(v); } },
    _tmSetUiFontScale: function(v) { calls.push(v); store['tm.uiFontScale'] = String(v); },
    _tmUiFontScaleDefault: function() { return 1.2; }
  };
  ctx.window = ctx;
  vm.runInNewContext(themeSrc, ctx, { filename: 'tm-theme-font.js' });
  return { api: ctx.TMThemeFont, store: store, calls: calls, nodes: nodes };
}
var folded = loadTheme({ 'tm.fontSize': 'lg' });
folded.api.restore();
ok(folded.calls.length === 1 && folded.calls[0] === 1.37, '旧全局「大」折进界面字号：出厂 1.2 × 1.14 → 1.37（实为 ' + folded.calls.join(',') + '）');
ok(folded.store['tm.fontSize'] === 'md' && /--tm-font-global-scale:1;/.test(folded.nodes._tmSizeOverride.textContent), '折过之后全局档固定为「中」，不再与界面字号叠乘');
var fresh = loadTheme({});
fresh.api.restore();
ok(fresh.calls.length === 0, '没存过全局档的不动界面字号');
var settingsHtml = folded.api.renderControls();
var drawerHtml = folded.api.renderControls({ context: 'drawer' });
ok(!/_tmApplySize\(/.test(settingsHtml + drawerHtml), '设置与抽屉都不再出「全局字号」按钮');
ok(/_tmApplyUiScale\(1\.35, this\)/.test(drawerHtml) && !/_tmApplyUiScale\(/.test(settingsHtml), '抽屉里的字号按钮调界面字号；设置页只在「界面显示」出一处');
ok(/<details class="tm-scope-size-advanced">/.test(settingsHtml), '分区字号收在「高级」里');

console.log('\nsmoke-ui-fontscale-adaptive ' + (F === 0 ? 'PASS' : 'FAIL') + ' ' + P + '/' + (P + F));
process.exit(F === 0 ? 0 : 1);
