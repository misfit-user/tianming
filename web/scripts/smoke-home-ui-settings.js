#!/usr/bin/env node
'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');
var ROOT = path.resolve(__dirname, '..');
var pass = 0;
var fail = 0;

function read(name) { return fs.readFileSync(path.join(ROOT, name), 'utf8'); }
function ok(condition, message) {
  if (condition) { pass++; console.log('  ✓ ' + message); }
  else { fail++; console.error('  ✗ FAIL: ' + message); }
}

console.log('smoke-home-ui-settings');
var source = read('tm-home-ui.js');

console.log('— S1 · 正式加载与设置入口 —');

console.log('— S2 · 三案与统一动作契约 —');

console.log('— S3 · 偏好持久化与运行时切换 —');
var attrs = {};
var store = {};
var listeners = {};
var failImage = false;
var hangImage = false;
function FakeImage() { this.complete = false; this.naturalWidth = 0; }
Object.defineProperty(FakeImage.prototype, 'src', {
  set: function (value) {
    this._src = value;
    if (hangImage) return;
    if (failImage) { if (this.onerror) this.onerror(); return; }
    this.complete = true;
    this.naturalWidth = 3840;
    if (this.onload) this.onload();
  },
  get: function () { return this._src; }
});
var documentStub = {
  body: null,
  readyState: 'loading',
  documentElement: {
    setAttribute: function (key, value) { attrs[key] = String(value); },
    removeAttribute: function (key) { delete attrs[key]; },
    getAttribute: function (key) { return attrs[key] || null; }
  },
  addEventListener: function (name, fn) { listeners['document:' + name] = fn; },
  getElementById: function () { return null; },
  querySelector: function () { return null; },
  querySelectorAll: function () { return []; },
  createElement: function () { return {}; }
};
var sandbox = {
  document: documentStub,
  localStorage: {
    getItem: function (key) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; },
    setItem: function (key, value) { store[key] = String(value); }
  },
  Image: FakeImage,
  CustomEvent: function (name, init) { this.type = name; this.detail = init && init.detail; },
  addEventListener: function (name, fn) { listeners['window:' + name] = fn; },
  dispatchEvent: function () {},
  console: console,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout
};
sandbox.window = sandbox;
vm.runInNewContext(source, sandbox, { filename: 'tm-home-ui.js' });
ok(sandbox.TM && sandbox.TM.HomeUI, '控制器导出 TM.HomeUI');
ok(sandbox.TM.HomeUI.current() === 'desk', '未设置时默认御案待批');
ok(attrs['data-tm-home-ui'] === 'desk', '默认方案通过真实资源探测后应用');
sandbox.TM.HomeUI.set('map');
ok(store['tm.homeUI'] === 'map', '切换方案写入设备本地偏好 tm.homeUI');
ok(attrs['data-tm-home-ui'] === 'map', '切换方案即时更新根主题');
var settingsHtml = sandbox.TM.HomeUI.renderSettingsSection();
ok((settingsHtml.match(/data-home-ui-choice=/g) || []).length === 3, '设置分区恰有三种方案');
ok(/<h4>主页 UI<\/h4>/.test(settingsHtml) && /当前使用/.test(settingsHtml), '设置分区标题与当前态明确');
ok(/role="radiogroup"/.test(settingsHtml) && (settingsHtml.match(/role="radio"/g) || []).length === 3, '三案使用互斥单选组语义');
ok(/onChoiceKey\(event,this\)/.test(settingsHtml) && /loading="lazy" decoding="async"/.test(settingsHtml), '设置卡支持方向键切换与缩略图懒解码');
ok(/tm-home-ui-choice-check" aria-hidden="true"/.test(settingsHtml), '选中勾为纯装饰且不被读屏重复朗读');

var focusedChoice = '';
var radioButtons = ['desk', 'map', 'gate'].map(function (theme) {
  return {
    classList: { toggle: function () {} },
    getAttribute: function (name) { return name === 'data-home-ui-choice' ? theme : null; },
    setAttribute: function () {},
    querySelector: function () { return null; },
    focus: function () { focusedChoice = theme; }
  };
});
documentStub.querySelectorAll = function (selector) { return selector === '[data-home-ui-choice]' ? radioButtons : []; };
var prevented = false;
sandbox.TM.HomeUI.onChoiceKey({
  key: 'ArrowRight',
  preventDefault: function () { prevented = true; },
  stopPropagation: function () {}
}, radioButtons[1]);
ok(prevented && focusedChoice === 'gate' && store['tm.homeUI'] === 'gate' && attrs['data-tm-home-ui'] === 'gate', '方向键切换聚焦并持久化相邻方案');
failImage = true;
sandbox.TM.HomeUI.set('desk');
ok(store['tm.homeUI'] === 'gate' && attrs['data-tm-home-ui'] === 'gate' && attrs['data-tm-home-ui-error'] === 'desk', '方案资源失败时保留上一可用主页与偏好');
failImage = false;
hangImage = true;
sandbox.TM.HomeUI.set('desk');
ok(sandbox.TM.HomeUI.pending() === 'desk' && attrs['data-tm-home-ui-pending'] === 'desk', '未完成的资源切换明确暴露 pending 状态');
sandbox.TM.HomeUI.set('gate');
ok(sandbox.TM.HomeUI.pending() === '' && !attrs['data-tm-home-ui-pending'] && attrs['data-tm-home-ui'] === 'gate', '点回当前方案可立即撤销挂起切换');
hangImage = false;

console.log('— S4 · 比例、热区与美术资源 —');

function readVp8Size(asset) {
  var data = fs.readFileSync(asset);
  var isWebP = data.length > 30 && data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP';
  var isVp8 = isWebP && data.toString('ascii', 12, 16) === 'VP8 ' && data.toString('hex', 23, 26) === '9d012a';
  return {
    valid: isVp8,
    width: isVp8 ? data.readUInt16LE(26) & 0x3fff : 0,
    height: isVp8 ? data.readUInt16LE(28) & 0x3fff : 0
  };
}

['desk', 'map', 'gate'].forEach(function (theme) {
  var asset = path.join(ROOT, 'assets', 'ui', 'home', 'home-ui-' + theme + '-v3-4k.webp');
  if (!fs.existsSync(asset)) {
    console.log('  · SKIP: fresh checkout 未携带大媒体 ' + path.basename(asset));
    return;
  }
  var size = readVp8Size(asset);
  ok(size.valid && size.width === 3840 && size.height === 2160, theme + ' 正式母图为真正 3840×2160 WebP');
  var thumb = path.join(ROOT, 'assets', 'ui', 'home', 'home-ui-' + theme + '-v3-thumb.webp');
  var thumbSize = readVp8Size(thumb);
  ok(thumbSize.valid && thumbSize.width === 960 && thumbSize.height === 540, theme + ' 设置缩略图严格收敛为 960×540 WebP');
});

console.log('— S5 · 三案预览页移动端与失败降级 —');
var previewRoot = path.join(ROOT, 'preview', 'home-ui-concepts');
if (!fs.existsSync(previewRoot)) {
  console.log('  - SKIP: preview/home-ui-concepts absent (fresh checkout or release tree); S5 preview checks skipped');
} else {
var previewSource = fs.readFileSync(path.join(previewRoot, 'src', 'App.jsx'), 'utf8');
var previewCss = fs.readFileSync(path.join(previewRoot, 'src', 'styles.css'), 'utf8');
var previewIndex = fs.readFileSync(path.join(previewRoot, 'index.html'), 'utf8');
ok(/event\.key === 'Escape'[\s\S]{0,120}event\.stopPropagation\(\)/.test(previewSource), '弹窗 Escape 阻断同次按键穿透，不会误退回总览');
ok(/imageState === 'error'[\s\S]{0,500}重新展卷/.test(previewSource), '4K 母图加载失败时提供可感知重试入口');
ok(/fetchPriority="high"/.test(previewSource)
  && /loading=\{index === 0 \? 'eager' : 'lazy'\}/.test(previewSource)
  && /fetchPriority=\{index === 0 \? 'high' : 'auto'\}/.test(previewSource), '单案优先解码 4K，三案总览按需懒解码缩略图');
ok(/\.gallery-visual\s*\{[\s\S]{0,160}aspect-ratio:\s*16\s*\/\s*9/.test(previewCss)
  && /\.gallery-card img\s*\{[\s\S]{0,160}height:\s*100%/.test(previewCss), '移动端总览图片槽严格保持 16:9，不继承 HTML 固定高度');
ok(/\.gallery-return\s*\{[\s\S]{0,700}min-height:\s*44px/.test(previewCss)
  && /opacity:\s*0\.72/.test(previewCss), '返回总览入口常态可见且达到 44px 触控高度');
ok(/viewport-fit=cover/.test(previewIndex) && /href="\/favicon\.svg"/.test(previewIndex), '预览页适配安卓安全区且具备本地矢量站点图标');
['desk', 'map', 'gate'].forEach(function (theme) {
  var previewThumb = path.join(previewRoot, 'public', 'references', theme + '-reference-v3-thumb.webp');
  var previewThumbSize = readVp8Size(previewThumb);
  ok(previewThumbSize.valid && previewThumbSize.width === 960 && previewThumbSize.height === 540, theme + ' 预览总览缩略图为 960×540 WebP');
});
}

console.log('\nsmoke-home-ui-settings ' + (fail ? 'FAIL' : 'PASS') + ' ' + pass + '/' + (pass + fail));
process.exit(fail ? 1 : 0);
