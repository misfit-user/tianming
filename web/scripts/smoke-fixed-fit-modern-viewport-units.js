#!/usr/bin/env node
'use strict';

// Android 固定舞台防腐线：
// @supports 内的 dvh/dvw/svh/svw/lvh/lvw 也必须按虚拟舞台换算，
// 否则设备视口尺寸会在 body 整体缩放前再缩一次（主页与工坊都会只剩半屏）。
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.resolve(__dirname, '..');
var source = fs.readFileSync(path.join(ROOT, 'tm-fixed-fit.js'), 'utf8');
var index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
var passed = 0;
var failed = 0;

function check(condition, message) {
  if (condition) {
    passed += 1;
    console.log('  PASS ' + message);
  } else {
    failed += 1;
    console.error('  FAIL ' + message);
  }
}

function makeStyle(initial) {
  var values = Object.assign({}, initial || {});
  var priorities = {};
  var style = {};

  function syncIndexes() {
    var oldLength = style.length || 0;
    for (var i = 0; i < oldLength; i++) delete style[i];
    var props = Object.keys(values);
    style.length = props.length;
    props.forEach(function (prop, index) { style[index] = prop; });
  }

  style.getPropertyValue = function (prop) { return values[prop] || ''; };
  style.getPropertyPriority = function (prop) { return priorities[prop] || ''; };
  style.setProperty = function (prop, value, priority) {
    values[prop] = String(value);
    priorities[prop] = priority || '';
    syncIndexes();
  };
  Object.defineProperty(style, 'position', {
    get: function () { return values.position || ''; },
    set: function (value) { values.position = String(value); syncIndexes(); }
  });
  Object.defineProperty(style, 'cssText', {
    get: function () {
      return Object.keys(values).map(function (prop) { return prop + ':' + values[prop]; }).join(';');
    }
  });
  style._values = values;
  syncIndexes();
  return style;
}

console.log('smoke-fixed-fit-modern-viewport-units');

var topStyle = makeStyle({
  position: 'fixed',
  width: '25vw',
  height: '25vh',
  color: 'red',
  background: 'url("100dvh.png") center / 25vw auto',
  content: '"100dvh"'
});
var supportsStyle = makeStyle({
  '--tm-home-view-h': '100dvh',
  height: '100svh',
  width: '50lvw',
  'margin-left': '.5dvw'
});
var inlineStyle = makeStyle({
  position: 'fixed',
  height: '100lvh',
  width: '50dvw'
});
var maxWidthMedia = {
  type: 4,
  media: { mediaText: '(max-width: 900px)' },
  cssRules: []
};
var supportsRule = {
  type: 12,
  cssRules: [{ type: 1, style: supportsStyle }]
};
var rules = [
  maxWidthMedia,
  supportsRule,
  { type: 1, style: topStyle }
];
var sheet = {
  cssRules: rules,
  deleteRule: function (index) { rules.splice(index, 1); }
};
var viewportMeta = { setAttribute: function () {} };
var inlineElement = { nodeType: 1, style: inlineStyle, querySelectorAll: function () { return []; } };
var bodyStyle = makeStyle();
var body = {
  nodeType: 1,
  style: bodyStyle,
  querySelectorAll: function () { return [inlineElement]; }
};
var rootClassList = { add: function () {} };
var documentStub = {
  body: body,
  head: { appendChild: function () {} },
  documentElement: {
    nodeType: 1,
    classList: rootClassList,
    appendChild: function () {}
  },
  readyState: 'complete',
  styleSheets: [sheet],
  querySelector: function (selector) {
    return selector === 'meta[name="viewport"]' ? viewportMeta : null;
  },
  createElement: function () { return { setAttribute: function () {}, textContent: '' }; },
  addEventListener: function () {}
};
var sandbox = {
  document: documentStub,
  location: { search: '?fit=1' },
  localStorage: {
    getItem: function (key) { return key === 'tm.fitResolution' ? '1477x831' : null; }
  },
  innerWidth: 960,
  innerHeight: 430,
  addEventListener: function () {},
  requestAnimationFrame: function (fn) { fn(); return 1; },
  setTimeout: function () {},
  MutationObserver: function () { this.observe = function () {}; },
  console: console
};
sandbox.window = sandbox;

vm.runInNewContext(source, sandbox, { filename: 'tm-fixed-fit.js' });

check(sandbox.TM && sandbox.TM.fixedFit
  && sandbox.TM.fixedFit.VW === 1477
  && sandbox.TM.fixedFit.VH === 831,
  '测试环境启用 1477×831 固定虚拟舞台');
check(/tm-fixed-fit\.js\?v=[A-Za-z0-9_.-]+/.test(index),
  '入口缓存戳已刷新，热更客户端不会继续命中旧适配器');
check(rules.indexOf(maxWidthMedia) === -1, '原有 max-width 媒体查询删除契约保持不变');
check(topStyle._values.position === 'absolute'
  && topStyle._values.width === '369.25px'
  && topStyle._values.height === '207.75px',
  '顶层 fixed 与传统 vw/vh 继续归一到舞台');
check(supportsStyle._values['--tm-home-view-h'] === '831px'
  && supportsStyle._values.height === '831px',
  '@supports 内 dvh/svh 高度归一到完整舞台高度');
check(supportsStyle._values.width === '738.5px'
  && supportsStyle._values['margin-left'] === '7.385px',
  '@supports 内 lvw 与小数 dvw 归一到舞台宽度');
check(inlineStyle._values.position === 'absolute'
  && inlineStyle._values.height === '831px'
  && inlineStyle._values.width === '738.5px',
  '动态内联样式的现代视口单位同步归一');
check(topStyle._values.color === 'red'
  && topStyle._values.background === 'url("100dvh.png") center / 369.25px auto'
  && topStyle._values.content === '"100dvh"',
  '文件名/字符串保持原值，同行真实视口长度仍完成换算');

console.log('smoke-fixed-fit-modern-viewport-units ' + (failed ? 'FAIL' : 'PASS')
  + ' ' + passed + '/' + (passed + failed));
process.exit(failed ? 1 : 0);
