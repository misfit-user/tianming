#!/usr/bin/env node
// perf-startup-script-cost.js — 量 index.html 同步脚本各自的「编译 + 顶层执行」耗时（node vm + headless 桩）
//
// 不是浏览器真值（无布局/无 V8 代码缓存），但同一台机上各脚本的相对排名可信，用来挑「启动分期懒加载」的目标。
// 装载环境与 smoke-full-turn-flow.js 的 loadGame 一致：headless-smoke.js 的 makeStubs + 同一组桩，按 index.html 顺序
// 装到 tm-test-harness.js 之前为止（懒加载的剧本脚本不计）。
//
// 用法：node scripts/perf-startup-script-cost.js [--top N] [--runs N] [--json]
//   单次计时噪声很大（GC、别的进程抢 CPU，同一脚本能差 10 倍），默认跑 3 轮：执行耗时取各轮最小值；
//   编译耗时只取第 1 轮（同进程里 V8 会复用编译缓存，第 2 轮起编译几乎为零，取最小会失真）。
// 结果写法：node scripts/perf-startup-script-cost.js > ../docs/<目录>/startup-script-cost.md
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const HEADLESS = path.join(__dirname, 'headless-smoke.js');
const argv = process.argv.slice(2);
const TOP = (() => { const i = argv.indexOf('--top'); return i >= 0 ? Number(argv[i + 1]) || 30 : 30; })();
const AS_JSON = argv.includes('--json');
const RUNS = (() => { const i = argv.indexOf('--runs'); return i >= 0 ? Math.max(1, Number(argv[i + 1]) || 3) : 3; })();

function loadHeadlessHelpers() {
  const source = fs.readFileSync(HEADLESS, 'utf8')
    .replace(/^#![^\n]*\n/, '')
    .replace(/\nmain\(\);\s*$/, '\nreturn { makeStubs, parseIndexHtmlScripts };');
  const factory = new Function('require', 'process', '__dirname', '__filename', 'module', 'exports', source);
  return factory(require, process, __dirname, HEADLESS, { exports: {} }, {});
}

function buildSandbox(helpers) {
  const env = helpers.makeStubs();
  const win = env.win;
  win.console = { log() {}, warn() {}, error() {}, info() {}, debug() {} };
  win.location.href = 'http://localhost/index.html';
  win.location.search = '';
  ['body', 'head', 'documentElement'].forEach((k) => { win.document[k].insertAdjacentHTML = function () {}; });
  win.AbortController = class {
    constructor() { this.signal = { aborted: false, addEventListener() {}, removeEventListener() {} }; }
    abort() { this.signal.aborted = true; }
  };
  win.fetch = function () {
    return Promise.resolve({
      ok: true, status: 200, headers: { get() { return ''; } },
      text() { return Promise.resolve('{"ok":true}'); },
      json() { return Promise.resolve({ ok: true }); }
    });
  };
  win.tianming = {
    writeTurnData() { return Promise.resolve({ ok: true }); },
    autoSave() { return Promise.resolve({ ok: true }); },
    saveGame() { return Promise.resolve({ ok: true }); }
  };
  return vm.createContext(win);
}

function phaseIndex() {
  const file = path.join(ROOT, 'startup-script-phases.json');
  if (!fs.existsSync(file)) return new Map();
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  const out = new Map();
  (manifest.scripts || []).forEach((row) => {
    const key = row.src || row.script || row.path || row.file || row.name;
    if (key) out.set(path.basename(String(key).split('?')[0]), row.phase || '?');
  });
  return out;
}

function ms(ns) { return Number(ns) / 1e6; }

function measureOnce(helpers) {
  const sandbox = buildSandbox(helpers);
  const scripts = helpers.parseIndexHtmlScripts({ includeLazyScenarios: false });
  const cutoff = scripts.findIndex((src) => path.basename(src) === 'tm-test-harness.js');
  const list = cutoff >= 0 ? scripts.slice(0, cutoff) : scripts;
  const phases = phaseIndex();
  const rows = [];
  const wallStart = process.hrtime.bigint();

  list.forEach((src, order) => {
    const abs = path.join(ROOT, src);
    const code = fs.readFileSync(abs, 'utf8');
    const scriptNode = sandbox.document.createElement('script');
    scriptNode.src = new URL(src, 'http://localhost/index.html').href;
    sandbox.document.currentScript = scriptNode;
    let compileMs = 0, runMs = 0, error = '';
    try {
      const t0 = process.hrtime.bigint();
      const script = new vm.Script(code, { filename: src });
      const t1 = process.hrtime.bigint();
      script.runInContext(sandbox, { timeout: 20000 });
      const t2 = process.hrtime.bigint();
      compileMs = ms(t1 - t0);
      runMs = ms(t2 - t1);
    } catch (e) {
      error = String(e && e.message || e).slice(0, 120);
    } finally {
      sandbox.document.currentScript = null;
    }
    rows.push({
      order, src, bytes: Buffer.byteLength(code, 'utf8'),
      phase: phases.get(path.basename(src)) || '?',
      compileMs, runMs, totalMs: compileMs + runMs, error
    });
  });

  const wallMs = ms(process.hrtime.bigint() - wallStart);
  return { rows, wallMs };
}

function main() {
  const helpers = loadHeadlessHelpers();
  const runs = [];
  for (let i = 0; i < RUNS; i++) runs.push(measureOnce(helpers));
  const walls = runs.map((r) => r.wallMs);
  const wallMs = Math.min.apply(null, walls);
  // 执行取各轮最小值（噪声只会抬高不会压低）；编译取第 1 轮冷值（后续轮次吃同进程编译缓存）
  const rows = runs[0].rows.map((row, idx) => {
    const samples = runs.map((r) => r.rows[idx]);
    const compileMs = samples[0].compileMs;
    const runMs = Math.min.apply(null, samples.map((x) => x.runMs));
    return Object.assign({}, row, { compileMs, runMs, totalMs: compileMs + runMs, error: samples.find((x) => x.error) ? samples.find((x) => x.error).error : '' });
  });
  const totalBytes = rows.reduce((s, r) => s + r.bytes, 0);
  const totalMs = rows.reduce((s, r) => s + r.totalMs, 0);
  const byPhase = {};
  rows.forEach((r) => {
    const p = byPhase[r.phase] || (byPhase[r.phase] = { scripts: 0, bytes: 0, ms: 0 });
    p.scripts++; p.bytes += r.bytes; p.ms += r.totalMs;
  });
  const sorted = rows.slice().sort((a, b) => b.totalMs - a.totalMs);
  const topRows = sorted.slice(0, TOP);
  const topMs = topRows.reduce((s, r) => s + r.totalMs, 0);
  const errors = rows.filter((r) => r.error);

  if (AS_JSON) {
    console.log(JSON.stringify({ node: process.version, runs: RUNS, wallsMs: walls, scripts: rows.length, totalBytes, totalMs, wallMs, byPhase, top: topRows, errors }, null, 2));
    return;
  }
  const fmt = (n, d) => n.toFixed(d === undefined ? 1 : d);
  console.log('# index.html 同步脚本启动成本（node ' + process.version + '·vm·headless 桩·' + new Date().toISOString().slice(0, 10) + '）');
  console.log('');
  console.log('脚本 ' + rows.length + ' 个 · ' + (totalBytes / 1048576).toFixed(1) + 'MB · 编译+顶层执行合计 ' + fmt(totalMs, 0) + 'ms（' + RUNS + ' 轮·执行取最小·编译取首轮冷值·各轮墙钟 ' + walls.map((w) => fmt(w, 0)).join('/') + 'ms）'
    + (errors.length ? ' · 装载报错 ' + errors.length : ''));
  console.log('');
  console.log('| 分期 | 脚本数 | 字节 | 耗时 ms | 占比 |');
  console.log('| --- | ---: | ---: | ---: | ---: |');
  Object.keys(byPhase).sort((a, b) => byPhase[b].ms - byPhase[a].ms).forEach((k) => {
    const p = byPhase[k];
    console.log('| ' + k + ' | ' + p.scripts + ' | ' + (p.bytes / 1024).toFixed(0) + 'KB | ' + fmt(p.ms, 0) + ' | ' + fmt(p.ms / totalMs * 100, 0) + '% |');
  });
  console.log('');
  console.log('前 ' + topRows.length + ' 个脚本合计 ' + fmt(topMs, 0) + 'ms，占 ' + fmt(topMs / totalMs * 100, 0) + '%：');
  console.log('');
  console.log('| # | 脚本 | 分期 | KB | 编译 ms | 执行 ms | 合计 ms |');
  console.log('| ---: | --- | --- | ---: | ---: | ---: | ---: |');
  topRows.forEach((r, i) => {
    console.log('| ' + (i + 1) + ' | ' + r.src + ' | ' + r.phase + ' | ' + (r.bytes / 1024).toFixed(0) + ' | ' + fmt(r.compileMs) + ' | ' + fmt(r.runMs) + ' | ' + fmt(r.totalMs) + ' |');
  });
  if (errors.length) {
    console.log('');
    console.log('装载报错（桩不全，不代表线上）：');
    errors.forEach((r) => console.log('- ' + r.src + '：' + r.error));
  }
}

main();
// 顶层执行会留下桩定时器（自动存档/轮询），不主动退出 node 会挂住。
process.exit(0);
