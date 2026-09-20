#!/usr/bin/env node
// scripts/headless-smoke.js — 零依赖 Node headless smoke runner
//
// 目的：在 Node 环境里加载 index.html 中的 <script src="..."> 脚本，用极简 DOM
//      / window / localStorage / indexedDB stub 让代码启动，然后跑 TM.test 套件。
// 不依赖 npm / jsdom / puppeteer。纯 Node 内置 vm + fs + path。
//
// 用法：
//   node scripts/headless-smoke.js              # 跑所有 TM.test suite
//   node scripts/headless-smoke.js --only E2E   # 只跑名字含 E2E 的 suite
//   node scripts/headless-smoke.js --list       # 列出 suite 名
//
// 注意：严重依赖 DOM 的代码（直接操作 DOM 渲染）会跳过；
//      Node smoke 仅覆盖"数据层/命名空间/engine/logic"这一侧。
//      UI 侧仍需要真浏览器（打开 index.html?test=1 看控制台）。

'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const flagVal = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i+1] : null; };
const bootOnly = flag('--boot-only');

// ─────────────────────────────────────────────
// 极简 DOM / window stub
// ─────────────────────────────────────────────
function makeStubs() {
  const listeners = {};
  const storage = new Map();
  const localStorage = {
    getItem: (k) => storage.has(k) ? storage.get(k) : null,
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k),
    clear: () => storage.clear(),
    get length() { return storage.size; },
    key: (i) => [...storage.keys()][i] || null
  };

  function makeCanvasContext(canvas) {
    const gradient = { addColorStop() {} };
    return {
      canvas,
      fillStyle: '#000000',
      strokeStyle: '#000000',
      lineWidth: 1,
      font: '10px sans-serif',
      textAlign: 'start',
      textBaseline: 'alphabetic',
      globalAlpha: 1,
      save() {},
      restore() {},
      translate() {},
      scale() {},
      rotate() {},
      beginPath() {},
      closePath() {},
      moveTo() {},
      lineTo() {},
      rect() {},
      arc() {},
      fill() {},
      stroke() {},
      fillRect() {},
      strokeRect() {},
      clearRect() {},
      fillText() {},
      strokeText() {},
      drawImage() {},
      setLineDash() {},
      getLineDash() { return []; },
      measureText(text) { return { width: String(text || '').length * 6 }; },
      createPattern() { return {}; },
      createLinearGradient() { return gradient; },
      createRadialGradient() { return gradient; }
    };
  }

  function makeNode(tag) {
    const node = {
      tagName: (tag || '').toUpperCase(),
      nodeType: 1,
      children: [],
      get firstChild() { return this.children[0] || null; },   // 必需:removeChild(firstChild) 修剪循环(如 tm-endturn-loading syncAnnals)·缺则 removeChild(undefined) 删不掉→死循环
      get lastChild() { return this.children[this.children.length - 1] || null; },
      attributes: {},
      style: {},
      dataset: {},
      classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
      _listeners: {},
      innerHTML: '',
      textContent: '',
      appendChild(c) { this.children.push(c); return c; },
      removeChild(c) { this.children = this.children.filter(x => x !== c); return c; },
      insertBefore(c) { this.children.unshift(c); return c; },
      insertAdjacentHTML(pos, html) { html = html || ''; if (pos === 'afterbegin') this.innerHTML = html + this.innerHTML; else this.innerHTML += html; },  // 渐进渲染(如 tm-renwu-ui pump)需要·忠实追加到 innerHTML(beforeend 默认)
      setAttribute(k, v) { this.attributes[k] = v; },
      getAttribute(k) { return this.attributes[k] || null; },
      removeAttribute(k) { delete this.attributes[k]; },
      addEventListener(ev, fn) { (this._listeners[ev] = this._listeners[ev] || []).push(fn); },
      removeEventListener(ev, fn) {
        if (!this._listeners[ev]) return;
        this._listeners[ev] = this._listeners[ev].filter(f => f !== fn);
      },
      dispatchEvent() { return true; },
      querySelector() { return null; },
      querySelectorAll() { return []; },
      getElementsByTagName() { return []; },
      getElementsByClassName() { return []; },
      cloneNode() { return makeNode(this.tagName); },
      remove() {},
      focus() {},
      blur() {},
      click() {},
      scrollIntoView() {},
      getBoundingClientRect() { return { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }; },
      // Form/input-ish
      value: '', checked: false, disabled: false,
      options: [],
      selectedIndex: -1
    };
    if (String(tag || '').toLowerCase() === 'canvas') {
      node.width = 300;
      node.height = 150;
      node.getContext = function(type) {
        if (type && type !== '2d') return null;
        if (!this._context2d) this._context2d = makeCanvasContext(this);
        return this._context2d;
      };
      node.toDataURL = function() { return 'data:image/png;base64,'; };
    }
    return node;
  }

  const doc = makeNode('document');
  doc.readyState = 'complete';
  doc.documentElement = makeNode('html');
  doc.body = makeNode('body');
  doc.head = makeNode('head');
  doc.createElement = (tag) => makeNode(tag);
  doc.createElementNS = (ns, tag) => makeNode(tag);
  doc.createTextNode = (text) => ({ nodeType: 3, textContent: String(text) });
  doc.createDocumentFragment = () => makeNode('fragment');
  // 默认返回 null (真浏览器行为) — 但诸多模块在加载期会 chain 属性，
  // 为了让模块能初始化，默认返回一个 sink node（属性读写静默）。
  // 调用 enableStrictDom() 可恢复 null 行为。
  const _sinkNode = makeNode('sink');
  _sinkNode.__sink = true;
  const _idNodes = new Map();
  // 让 style/dataset/classList 等属性 chain 读都能返回东西
  doc._strictMode = false;
  doc.getElementById = (id) => {
    if (doc._strictMode) return null;
    if (/canvas/i.test(String(id || ''))) {
      if (!_idNodes.has(id)) _idNodes.set(id, makeNode('canvas'));
      return _idNodes.get(id);
    }
    return _sinkNode;
  };
  doc.querySelector = () => doc._strictMode ? null : _sinkNode;
  doc.querySelectorAll = () => [];
  doc.getElementsByTagName = () => [];
  doc.getElementsByClassName = () => [];
  doc.addEventListener = function(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); };
  doc.removeEventListener = function(ev, fn) {
    if (!listeners[ev]) return;
    listeners[ev] = listeners[ev].filter(f => f !== fn);
  };
  doc.dispatchEvent = () => true;

  const loc = {
    href: 'http://localhost/index.html?test=1',
    pathname: '/index.html',
    search: '?test=1',
    hash: '',
    origin: 'http://localhost',
    protocol: 'http:',
    host: 'localhost',
    hostname: 'localhost',
    port: '',
    reload() {}, replace() {}, assign() {}
  };

  // ─── Stub indexedDB (仅 open 返回 null 的 request) ───
  const idb = {
    open() {
      const req = {};
      setImmediate(() => { req.onerror && req.onerror({ target: { error: new Error('stub·no-idb') } }); });
      return req;
    }
  };

  // ─── 极简 Blob / Response / CompressionStream stub ───
  class StubBlob {
    constructor(parts) { this._parts = parts || []; this.size = 0; this.type = ''; }
    text() { return Promise.resolve(this._parts.map(p => String(p)).join('')); }
    arrayBuffer() { return Promise.resolve(new ArrayBuffer(0)); }
    slice() { return new StubBlob([]); }
    stream() { return { pipeThrough() { return this; } }; }
  }

  const win = {
    // 核心
    location: loc,
    document: doc,
    localStorage: localStorage,
    sessionStorage: { ...localStorage },
    navigator: {
      userAgent: 'node-headless-smoke/1.0',
      language: 'zh-CN',
      platform: 'node',
      storage: {
        persist: () => Promise.resolve(false),
        persisted: () => Promise.resolve(false),
        estimate: () => Promise.resolve({ quota: 1e9, usage: 0 })
      }
    },
    // 日志
    console: {
      log: (...a) => { if (process.env.SMOKE_VERBOSE) process.stdout.write('[log] ' + a.join(' ') + '\n'); },
      warn: (...a) => { if (process.env.SMOKE_VERBOSE) process.stderr.write('[warn] ' + a.join(' ') + '\n'); },
      error: (...a) => { process.stderr.write('[err] ' + a.join(' ') + '\n'); },
      info: (...a) => { if (process.env.SMOKE_VERBOSE) process.stdout.write('[info] ' + a.join(' ') + '\n'); },
      debug: () => {}
    },
    // 定时器（Node 的搬过来）
    setTimeout, clearTimeout, setInterval, clearInterval, setImmediate, clearImmediate,
    queueMicrotask,
    structuredClone, // Use the native clone available in the real browser; no JSON-only test slowdown.
    // 存储/网络 stub
    indexedDB: idb,
    fetch: () => Promise.reject(new Error('stub·no-fetch')),
    // 常见 DOM 全局
    Blob: StubBlob,
    Response: class { text(){return Promise.resolve('');} blob(){return Promise.resolve(new StubBlob([]));} },
    CompressionStream: undefined,
    DecompressionStream: undefined,
    FileReader: class { readAsText(){} readAsArrayBuffer(){} },
    File: StubBlob,
    // URL
    URL: Object.assign(class extends URL {}, { createObjectURL: () => 'blob:stub', revokeObjectURL: () => {} }),
    URLSearchParams,
    // event listener 在 window 上
    addEventListener(ev, fn) { (listeners['_w_' + ev] = listeners['_w_' + ev] || []).push(fn); },
    removeEventListener(ev, fn) {
      if (!listeners['_w_' + ev]) return;
      listeners['_w_' + ev] = listeners['_w_' + ev].filter(f => f !== fn);
    },
    dispatchEvent: () => true,
    onerror: null,
    // 其他常见全局
    performance: { now: () => Date.now(), mark: () => {}, measure: () => {} },
    requestAnimationFrame: (cb) => setTimeout(cb, 16),
    cancelAnimationFrame: (id) => clearTimeout(id),
    // Math/JSON 会从 host 继承
    alert: () => {}, confirm: () => true, prompt: () => '',
    // Worker 类 stub
    Worker: class { constructor() {} postMessage(){} terminate(){} },
    // 以下 TM 挂载后可用
    TM: undefined,
    GM: undefined, P: undefined
  };
  win.self = win;
  win.window = win;
  win.globalThis = win;
  // document.defaultView
  doc.defaultView = win;
  return { win, doc, listeners };
}

// ─────────────────────────────────────────────
// 脚本加载顺序 · 照搬 index.html 的 <script src="..."> 顺序
// ─────────────────────────────────────────────
function parseIndexHtmlScripts(options) {
  options = options || {};
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const scripts = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html))) {
    const attrs = m[1] || '';
    const body = m[2] || '';
    const srcMatch = /\bsrc="([^"?]+)(?:\?[^"]*)?"/.exec(attrs);
    if (srcMatch) {
      const src = srcMatch[1];
      if (!/^https?:\/\//.test(src)) scripts.push(src);
      continue;
    }
    const dynamicSrcRe = /\bsrc\s*=\s*['"]([^'"]+\.js)(?:\?[^'"]*)?['"]/g;
    let dm;
    while ((dm = dynamicSrcRe.exec(body))) {
      const src = dm[1];
      if (!/^https?:\/\//.test(src)) scripts.push(src);
    }
  }
  // 浏览器首屏按需加载官方剧本；需要完整运行时数据的 Node smoke 仍从同一生成 manifest
  // 注入这些脚本。boot-only 明确关闭，以测量真实首屏而非测试夹具负载。
  if (options.includeLazyScenarios !== false) {
    try {
      const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'bundled-scenarios', 'manifest.json'), 'utf8'));
      const lazyScripts = (manifest.entries || []).map(e => e && (e.scriptUrl || e.builtinScript)).filter(Boolean);
      const insertAt = scripts.indexOf('tm-test-harness.js');
      scripts.splice(insertAt >= 0 ? insertAt : scripts.length, 0, ...lazyScripts.filter(src => scripts.indexOf(src) < 0));
    } catch (e) {
      throw new Error('cannot load official scenario manifest for headless smoke: ' + e.message);
    }
  }
  return scripts;
}

// ─────────────────────────────────────────────
// 主流程
// ─────────────────────────────────────────────
function main() {
  if (flag('--list-scripts')) {
    const scripts = parseIndexHtmlScripts({ includeLazyScenarios: flag('--include-lazy-scenarios') });
    scripts.forEach(s => console.log(s));
    console.log(`\n${scripts.length} scripts`);
    return;
  }

  const { win } = makeStubs();
  const sandbox = vm.createContext(win);

  const scripts = parseIndexHtmlScripts({ includeLazyScenarios: !bootOnly });
  const bootCutoffName = 'tm-test-harness.js';
  const bootCutoffIndex = bootOnly ? scripts.findIndex(s => path.basename(s) === bootCutoffName) : -1;
  if (bootOnly && bootCutoffIndex < 0) {
    console.error('[boot-smoke] cannot find ' + bootCutoffName + ' in index.html script order');
    process.exit(2);
  }
  const loadScripts = bootOnly ? scripts.slice(0, bootCutoffIndex + 1) : scripts;
  console.log(`[smoke] 将加载 ${loadScripts.length} 个脚本` + (bootOnly ? ' [boot-only]' : ''));

  let loaded = 0;
  let errors = [];
  const start = Date.now();

  for (const src of loadScripts) {
    const abs = path.join(ROOT, src);
    if (!fs.existsSync(abs)) {
      errors.push({ src, stage: 'missing', msg: 'file not found' });
      continue;
    }
    let code;
    try { code = fs.readFileSync(abs, 'utf8'); }
    catch (e) { errors.push({ src, stage: 'read', msg: e.message }); continue; }

    try {
      const script = new vm.Script(code, { filename: src });
      script.runInContext(sandbox, { displayErrors: true, timeout: 10000 });
      loaded++;
    } catch (e) {
      errors.push({ src, stage: 'run', msg: e.message, stack: (e.stack || '').split('\n').slice(0, 3).join('\n') });
      if (flag('--stop-on-error')) break;
    }
  }

  const dt = Date.now() - start;
  console.log(`[smoke] ${loaded}/${loadScripts.length} 脚本加载成功 · ${dt}ms`);
  if (errors.length) {
    console.error(`[smoke] ${errors.length} 个脚本加载失败：`);
    errors.slice(0, 20).forEach(e => {
      console.error(`  ✗ ${e.src} [${e.stage}] ${e.msg}`);
      if (e.stack && flag('--verbose')) console.error('    ' + e.stack.replace(/\n/g, '\n    '));
    });
    if (errors.length > 20) console.error(`  ... 还有 ${errors.length - 20} 个未列出`);
  }

  // 尝试跑 TM.test
  const TM = sandbox.TM;
  if (flag('--diag')) {
    console.log('\n[diag] sandbox 关键字段:');
    console.log('  typeof TM:', typeof TM);
    if (TM) {
      console.log('  TM keys:', Object.keys(TM).sort().join(', '));
      ['errors','test','Storage','MapSystem','Economy','Lizhi','Guoku','Neitang','state','diff','register','guard'].forEach(k => {
        console.log('  typeof TM.' + k + ':', typeof TM[k]);
      });
    }
    console.log('  typeof ErrorMonitor:', typeof sandbox.ErrorMonitor);
    console.log('  typeof SaveManager:', typeof sandbox.SaveManager);
  }
  if (!TM || !TM.test) {
    console.error('[smoke] ✗ TM.test 未找到（tm-test-harness.js 未正确加载？）');
    process.exit(2);
  }

  if (bootOnly) {
    const bootIssues = [];
    const need = function(cond, msg) {
      if (!cond) bootIssues.push(msg);
    };
    need(typeof TM.onboard === 'function', 'TM.onboard missing');
    need(typeof TM.validateScenario === 'function', 'TM.validateScenario missing');
    need(typeof TM.version === 'object' && typeof TM.version.list === 'function', 'TM.version.list missing');
    need(typeof TM.errors === 'object', 'TM.errors missing');
    need(typeof TM.perf === 'object', 'TM.perf missing');
    need(typeof TM.Save === 'object', 'TM.Save missing');
    need(typeof TM.Map === 'object', 'TM.Map missing');
    need(typeof sandbox.startGame === 'function', 'startGame missing');
    need(typeof sandbox.fullLoadGame === 'function', 'fullLoadGame missing');
    need(typeof sandbox.renderGameState === 'function', 'renderGameState missing');
    need(typeof sandbox.endTurn === 'function', 'endTurn missing');

    try {
      var onboardNote = TM.onboard();
      if (flag('--diag')) console.log('[boot-smoke] onboard note:', JSON.stringify(onboardNote));
    } catch (e) {
      bootIssues.push('TM.onboard threw: ' + (e && e.message ? e.message : String(e)));
    }

    try {
      var vlist = TM.version.list();
      need(Array.isArray(vlist), 'TM.version.list did not return array');
    } catch (e) {
      bootIssues.push('TM.version.list threw: ' + (e && e.message ? e.message : String(e)));
    }

    try {
      var suites = TM.test.listSuites ? TM.test.listSuites() : [];
      need(Array.isArray(suites), 'TM.test.listSuites did not return array');
    } catch (e) {
      bootIssues.push('TM.test.listSuites threw: ' + (e && e.message ? e.message : String(e)));
    }

    if (bootIssues.length) {
      console.error('[boot-smoke] boot gate failed:');
      bootIssues.forEach(function(msg) { console.error('  ✗ ' + msg); });
      process.exit(1);
    }

    console.log('[boot-smoke] pass: boot chain loaded and core entrypoints are present');
    process.exit(0);
  }

  if (flag('--list')) {
    const suites = (typeof TM.test.list === 'function') ? TM.test.list() : (typeof TM.test.listSuites === 'function' ? TM.test.listSuites() : []);
    console.log('\n[smoke] Test suites:');
    suites.forEach(s => console.log(`  · ${s.name} (${s.tests} tests)`));
    return;
  }

  const only = flagVal('--only');
  const runner = only ? TM.test.runOnly.bind(TM.test, only) : TM.test.run.bind(TM.test);

  console.log('\n[smoke] 开始运行 TM.test 套件' + (only ? ` (filter: ${only})` : ''));
  Promise.resolve(runner()).then((r) => {
    const ok = (r && typeof r.failed === 'number') ? r.failed === 0 : true;
    console.log('[smoke] 测试返回值:', r ? JSON.stringify({ passed: r.passed, failed: r.failed, skipped: r.skipped }) : '(void)');
    process.exit(ok && errors.length === 0 ? 0 : 1);
  }).catch((e) => {
    console.error('[smoke] 测试运行异常:', e && e.message);
    process.exit(1);
  });
}

main();
