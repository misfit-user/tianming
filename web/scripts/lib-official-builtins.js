'use strict';
// 三个官方剧本内建脚本（web/scenarios/*.js）在 node 里的统一装载方式。
// 脚本跑进一个 vm 上下文：上下文里没有 P 时，它们只把数据登进 TMOfficialScenarioBuiltins 注册表
// （同剧本工坊预览页）；有 P.scenarios 时则像游戏里一样注册进 P.scenarios。
// 测试与校验都从这里取数据，别再各自解析或另留一份主包。
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { ENTRIES, WEB_ROOT } = require('./sync-official-scenarios.js');

// 默认静默：内建脚本注册时会 console.log「已注册」，别让它污染把 stdout 当结果读的父进程；要看日志就在 seed 里传 console。
const quietConsole = { log() {}, info() {}, warn() {}, error() {}, debug() {} };

function createContext(seed) {
  const context = Object.assign({ console: quietConsole }, seed || {});
  context.window = context;
  context.globalThis = context;
  return vm.createContext(context);
}

// options.ids：只装其中几个剧本（省内存）；options.seed：上下文初值（如 { P: { scenarios: [] } } 走游戏注册路径）；
// options.context：复用已有上下文；options.timeout：单个脚本的 vm 超时毫秒数。
function loadBuiltins(options) {
  const opts = options || {};
  const context = opts.context || createContext(opts.seed);
  const wanted = opts.ids ? new Set(opts.ids) : null;
  ENTRIES.forEach((entry) => {
    if (wanted && !wanted.has(entry.id)) return;
    const file = path.join(WEB_ROOT, entry.builtin);
    vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file, timeout: opts.timeout || 120000 });
  });
  return context;
}

module.exports = { ENTRIES, createContext, loadBuiltins };
