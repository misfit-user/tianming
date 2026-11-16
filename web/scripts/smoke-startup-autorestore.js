#!/usr/bin/env node
'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');

var source = fs.readFileSync(path.join(__dirname, '..', 'tm-office-editor.js'), 'utf8');
var start = source.indexOf('(function _checkAutoRestore()');
var end = source.indexOf('\n})();', start);
var block = start >= 0 && end > start ? source.slice(start, end + '\n})();'.length) : '';
var pass = 0;
var fail = 0;

function ok(condition, message) {
  if (condition) {
    pass++;
    console.log('  ✓ ' + message);
  } else {
    fail++;
    console.error('  ✗ FAIL: ' + message);
  }
}

function run(markers) {
  var values = Object.assign({}, markers || {});
  var confirms = [];
  var removed = [];
  var timers = 0;
  var sandbox = {
    GM: { running: false },
    localStorage: {
      getItem: function (key) { return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null; },
      removeItem: function (key) { removed.push(key); delete values[key]; }
    },
    confirm: function (message) { confirms.push(String(message)); return false; },
    setTimeout: function (fn) { timers++; fn(); return timers; },
    showLoading: function () {},
    hideLoading: function () {},
    toast: function () {},
    TM_SaveDB: { load: function () { throw new Error('declined recovery must not read IndexedDB'); } },
    console: console,
    TM: { errors: { captureSilent: function () {} } }
  };
  sandbox.window = sandbox;
  vm.runInNewContext(block, sandbox, { filename: 'tm-office-editor.autorestore.js' });
  return { confirms: confirms, removed: removed, timers: timers, values: values };
}

console.log('smoke-startup-autorestore');
ok(!!block, '提取启动恢复 IIFE');

var normal = run({
  tm_autosave_mark: JSON.stringify({ scenarioName: '天启七年·九月', turn: 4, eraName: '天启' })
});
ok(normal.timers === 0 && normal.confirms.length === 0, '只有普通自动存档时启动不弹窗');
ok(normal.values.tm_autosave_mark, '取消启动弹窗不删除自动存档索引');

var stale = run({
  tm_pre_endturn_mark: JSON.stringify({ commitState: 'pending', turn: 4 }),
  tm_autosave_mark: JSON.stringify({ turn: 4 })
});
ok(stale.confirms.length === 0 && stale.removed.indexOf('tm_pre_endturn_mark') >= 0, '无效或 pending 异常标记静默清理且不误弹');

var crashed = run({
  tm_pre_endturn_mark: JSON.stringify({
    commitState: 'committed', snapshotId: 'pre-4', scenarioName: '天启七年·九月', turn: 4, eraName: '天启'
  }),
  tm_autosave_mark: JSON.stringify({ scenarioName: '天启七年·九月', turn: 4, eraName: '天启' })
});
ok(crashed.timers === 1 && crashed.confirms.length === 1 && /上次过回合推演中断/.test(crashed.confirms[0]), '真实过回合中断仍保留一次崩溃恢复提示');
ok(crashed.removed.indexOf('tm_pre_endturn_mark') >= 0 && crashed.values.tm_autosave_mark, '拒绝崩溃恢复后停在主页且普通存档仍可续卷');

console.log('\nsmoke-startup-autorestore ' + (fail ? 'FAIL' : 'PASS') + ' ' + pass + '/' + (pass + fail));
process.exit(fail ? 1 : 0);
