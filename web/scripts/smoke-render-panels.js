#!/usr/bin/env node
// scripts/smoke-render-panels.js — 把 17 个面板的渲染函数真跑一遍
//
// 原名 render-smoke.js，只登记在已撤掉的 verify-all.js 里，没有任何自动调用。
// 2026-11-17 改名进 run-smokes 的自动发现，同时收紧：面板函数缺席、没画出东西、
// 画出 undefined/null 字面，原先只算「跳过」或「警告」，现在一律算失败。
//
// 目的·验证 17 个 panel render fn 在 mock GM 下·
//   1. 不 throw
//   2. DOM 写出 (innerHTML/textContent/children 非空) 或返回可渲染 payload
//   3. 无 'undefined'/'null'/'[object Object]' 字面
//
// 来源·web/docs/architecture-target-final.md §8.4
//
// Strategy·复用 headless-smoke pattern·boot 全 scripts (vm.runInContext)
//          → setup mock GM → 调 render fns → assert
//
// Usage·node scripts/smoke-render-panels.js [--verbose-boot]

'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);

// ─────────────────────────────────────────────
// DOM / window stub (focus·innerHTML capture)
// ─────────────────────────────────────────────
function makeStubs() {
  const elements = new Map(); // id → node·track rendered content

  function makeNode(tag) {
    const node = {
      tagName: (tag || '').toUpperCase(),
      nodeType: 1,
      children: [],
      attributes: {},
      style: {},
      dataset: {},
      classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
      _listeners: {},
      _innerHTML: '',
      _textContent: '',
      get innerHTML() { return this._innerHTML; },
      set innerHTML(v) { this._innerHTML = String(v); },
      get textContent() { return this._textContent; },
      set textContent(v) { this._textContent = String(v); },
      appendChild(c) { this.children.push(c); return c; },
      removeChild(c) { this.children = this.children.filter(x => x !== c); return c; },
      insertBefore(c) { this.children.unshift(c); return c; },
      setAttribute(k, v) {
        this.attributes[k] = v;
        if (k === 'id') elements.set(v, this);
      },
      getAttribute(k) { return this.attributes[k] || null; },
      removeAttribute(k) { delete this.attributes[k]; },
      addEventListener(ev, fn) { (this._listeners[ev] = this._listeners[ev] || []).push(fn); },
      removeEventListener() {},
      dispatchEvent() { return true; },
      querySelector() { return makeNode('sink'); },
      querySelectorAll() { return []; },
      getElementsByTagName() { return []; },
      getElementsByClassName() { return []; },
      cloneNode() { return makeNode(this.tagName); },
      remove() {},
      focus() {}, blur() {}, click() {},
      scrollIntoView() {},
      getBoundingClientRect() { return { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }; },
      insertAdjacentHTML(_, html) { this._innerHTML += String(html); },
      value: '', checked: false, disabled: false, options: [], selectedIndex: -1
    };
    return node;
  }

  const doc = makeNode('document');
  doc.body = makeNode('body');
  doc.head = makeNode('head');
  doc.documentElement = makeNode('html');
  doc.readyState = 'complete';
  doc.createElement = (tag) => makeNode(tag);
  doc.createElementNS = (_, tag) => makeNode(tag);
  doc.createTextNode = (text) => ({ nodeType: 3, textContent: String(text) });
  doc.createDocumentFragment = () => makeNode('fragment');
  doc.getElementById = function(id) {
    if (elements.has(id)) return elements.get(id);
    const n = makeNode('div');
    n.id = id;
    n.attributes.id = id;
    elements.set(id, n);
    return n;
  };
  doc.querySelector = () => makeNode('sink');
  doc.querySelectorAll = () => [];
  doc.addEventListener = function(){};
  doc.removeEventListener = function(){};

  const storage = new Map();
  const localStorage = {
    getItem: (k) => storage.has(k) ? storage.get(k) : null,
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k),
    clear: () => storage.clear(),
    get length() { return storage.size; },
    key: (i) => [...storage.keys()][i] || null
  };

  const win = {
    document: doc,
    location: { href: 'http://localhost/index.html', pathname: '/index.html', search: '', hostname: 'localhost' },
    localStorage, sessionStorage: localStorage,
    indexedDB: {
      open: () => ({
        onsuccess: null, onerror: null, onupgradeneeded: null,
        result: { transaction: () => ({ objectStore: () => ({ get: () => ({}), put: () => ({}) }) }) }
      })
    },
    setTimeout, clearTimeout, setInterval, clearInterval,
    setImmediate: typeof setImmediate === 'function' ? setImmediate : ((fn) => setTimeout(fn, 0)),
    requestAnimationFrame: (fn) => setTimeout(fn, 16),
    cancelAnimationFrame: clearTimeout,
    Promise, console, JSON, Math, Date, Number, String, Array, Object, Boolean, RegExp, Error,
    TypeError, RangeError, SyntaxError, parseFloat, parseInt, isNaN, isFinite,
    URL, URLSearchParams,
    Event: function() {}, CustomEvent: function() {}, MouseEvent: function() {},
    fetch: () => Promise.reject(new Error('fetch stub')),
    addEventListener: function(){}, removeEventListener: function(){},
    dispatchEvent: function(){ return true; },
    alert: function(){}, confirm: () => true, prompt: () => null,
    navigator: { userAgent: 'render-smoke', language: 'zh-CN', platform: 'node' },
    crypto: { getRandomValues: (arr) => { for (let i=0;i<arr.length;i++) arr[i] = Math.floor(Math.random()*256); return arr; } },
    TM: undefined, GM: undefined, P: undefined,
    _renderSmoke: { elements }
  };
  win.self = win;
  win.window = win;
  win.globalThis = win;
  doc.defaultView = win;
  return { win, doc, elements };
}

function parseIndexHtmlScripts() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const scripts = [];
  const re = /<script\s+src="([^"?]+)(?:\?[^"]*)?"(?:\s+defer)?\s*><\/script>/g;
  let m;
  while ((m = re.exec(html))) {
    const src = m[1];
    if (/^https?:\/\//.test(src)) continue;
    scripts.push(src);
  }
  return scripts;
}

// ─────────────────────────────────────────────
// Mock GM state·v0 minimal
// ─────────────────────────────────────────────
function makeMockGM() {
  return {
    turn: 1, year: 1627, month: 9, day: 1,
    era: '熹宗·天启', dynasty: '明',
    scenario: { id: 'mock-render-smoke', name: 'mock-tianqi-7' },
    protagonist: 'c-emperor',
    busy: false,
    characters: [
      { id: 'c-emperor', name: '朱由校', occupation: '皇帝', traits: [], traitIds: [], age: 22, party: '皇党', loyalty: 100, ability: 30 },
      { id: 'c-wei', name: '魏忠贤', occupation: '阉党魁首', traits: [], traitIds: ['权奸'], age: 60, party: '阉党', loyalty: 50, ability: 75 },
      { id: 'c-ke', name: '客氏', occupation: '奉圣夫人', traits: [], traitIds: [], age: 50, party: '阉党', loyalty: 80, ability: 50 }
    ],
    variables: {
      base: { 帑廪: 100, 内帑: 100, 户口: 1000, 吏治: 50, 民心: 50, 皇权: 50, 皇威: 50 },
      other: {}
    },
    events: { historical: [], random: [], conditional: [], story: [], chain: [] },
    armies: [
      { id: 'a-jingying', name: '京营', size: 50000, morale: 60, supply: 70, location: '京师', commander: 'c-wei', payArrearsMonths: 0, mutinyRisk: 10 }
    ],
    officeTree: [],
    adminHierarchy: [],
    parties: [
      { id: 'p-yan', name: '阉党', members: ['c-wei', 'c-ke'] },
      { id: 'p-emperor', name: '皇党', members: ['c-emperor'] }
    ],
    classes: [],
    factions: [],
    relations: [],
    traitDefinitions: [
      { id: '权奸', name: '权奸', description: '弄权欺君', effect: { 皇威: -5 } }
    ],
    currentIssues: [],
    memorials: [],
    memorialQueue: [],
    techTree: [],
    civicTree: [],
    edicts: [],
    edictHistory: [],
    sideQuests: [],
    biannianEvents: []
  };
}

// ─────────────────────────────────────────────
// 17 Render targets·真实 fn 名 (grep 验证)
// ─────────────────────────────────────────────
const RENDER_TARGETS = [
  { name: '朝政中心', fn: '_renderZhaozhengCenter' },           // tm-game-loop:1300
  { name: '人物志', fn: 'renderRenwu' },                          // tm-renwu-ui:57
  { name: '地方', fn: '_renderDifangPanel' },                     // tm-player-core:614
  { name: '国库 panel', fn: 'renderGuokuPanel' },                 // tm-guoku-panel:67
  { name: '内帑 panel', fn: 'renderNeitangPanel' },               // tm-neitang-panel:53
  { name: '礼制·腐败 panel', fn: 'renderCorruptionPanel' },       // tm-lizhi-panel:105
  { name: '编年史', fn: 'renderBiannian' },                       // tm-office-panel:1111
  { name: '时机', fn: 'renderShijiList' },                        // tm-shiji-qiju-ui:23
  { name: '起居', fn: 'renderQiju' },                             // tm-shiji-qiju-ui:268
  { name: '侧栏 panels', fn: 'renderSidePanels' },                // tm-sidebar-ui:353
  { name: '科技', fn: 'renderGameTech' },                         // tm-sidebar-ui:29
  { name: '民政', fn: 'renderGameCivic' },                        // tm-sidebar-ui:50
  { name: 'topbar 国库', fn: '_renderGuoku' },                    // tm-topbar-vars:41
  { name: '官制树', fn: 'renderOfficeTree' },                     // tm-office-runtime:524
  { name: '奏疏', fn: 'renderMemorials' },                        // tm-memorials:543
  { name: '士议榜 (bench)', fn: 'renderBench' },                  // tm-chaoyi-v3:1918
  { name: '文园', fn: 'renderWenyuan' }                           // tm-player-core:385
];

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────
function nodeContentLength(node, seen) {
  if (!node || seen.has(node)) return 0;
  seen.add(node);
  let len = (node._innerHTML || '').length + (node._textContent || '').length;
  if (Array.isArray(node.children)) {
    for (const child of node.children) len += nodeContentLength(child, seen);
  }
  return len;
}

function renderedPayloadLength(value) {
  if (value == null) return 0;
  if (typeof value === 'string') return value.length;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).length;
  if (typeof value === 'object') {
    try { return JSON.stringify(value).length; }
    catch (_) { return 1; }
  }
  return 0;
}

function totalRenderedContent(elements) {
  let len = 0;
  const seen = new Set();
  for (const n of elements.values()) {
    len += nodeContentLength(n, seen);
  }
  return len;
}

function main() {
  console.log('[smoke-render-panels] v0·' + RENDER_TARGETS.length + ' panel render assertion');
  console.log('');

  const { win, elements } = makeStubs();
  const sandbox = vm.createContext(win);

  // 1. Boot
  const scripts = parseIndexHtmlScripts();
  console.log('[smoke-render-panels] boot·' + scripts.length + ' scripts loading...');
  let loaded = 0;
  const bootErrs = [];
  const bootStart = Date.now();
  for (const src of scripts) {
    const abs = path.join(ROOT, src);
    if (!fs.existsSync(abs)) { bootErrs.push({ src, msg: 'missing' }); continue; }
    try {
      const code = fs.readFileSync(abs, 'utf8');
      const script = new vm.Script(code, { filename: src });
      script.runInContext(sandbox, { displayErrors: false, timeout: 10000 });
      loaded++;
    } catch (e) {
      bootErrs.push({ src, msg: e.message.slice(0, 100) });
    }
  }
  const bootMs = Date.now() - bootStart;
  console.log('[smoke-render-panels] boot·' + loaded + '/' + scripts.length + ' loaded·' + bootMs + 'ms·' + bootErrs.length + ' errors');
  if (flag('--verbose-boot') && bootErrs.length) {
    bootErrs.slice(0, 5).forEach(e => console.log('  boot ✗ ' + e.src + ': ' + e.msg));
  }
  console.log('');

  // 2. Setup mock GM
  sandbox.GM = makeMockGM();
  if (typeof sandbox.P === 'undefined') sandbox.P = {};
  // fallback assignments
  console.log('[smoke-render-panels] mock GM·characters=' + sandbox.GM.characters.length + ' armies=' + sandbox.GM.armies.length);
  console.log('');

  // 3. Render assertion
  const results = [];
  for (const tgt of RENDER_TARGETS) {
    const fn = sandbox[tgt.fn];
    const result = { name: tgt.name, fn: tgt.fn, status: 'unknown', err: null, htmlDelta: 0 };

    if (typeof fn !== 'function') {
      result.status = 'fail-no-fn';
      result.err = 'function not defined';
      results.push(result);
      continue;
    }

    try {
      const beforeLen = totalRenderedContent(elements);
      const ret = fn.call(sandbox);
      const afterLen = totalRenderedContent(elements);
      const delta = (afterLen - beforeLen) + renderedPayloadLength(ret);
      result.htmlDelta = delta;

      // bad literal check·**仅查纯文本上下文** (排除 onclick="..." attribute 内)
      // 上下文模式·`>{bad}<` (text in tag) 或 `: bad,` (json-like) 或 `\sbad\s` (空格夹)
      // 排除·onclick="function..." / "=function" / "(function" 这些 attribute / code 写法
      let bad = null;
      const BAD_PATTERNS = [
        />(undefined|null|\[object Object\])</,             // text node·>undefined<
        /:\s*(undefined|null|\[object Object\])\s*[,<]/,    // json-like·: null,
        /\s(undefined|null|\[object Object\])(?=\s|<|$)/    // free-standing
      ];
      for (const node of elements.values()) {
        const rendered = node._innerHTML || ''; // 面板画出来的内容，不是源码
        for (const re of BAD_PATTERNS) {
          const m = rendered.match(re);
          if (m) {
            const idx = rendered.indexOf(m[0]);
            bad = rendered.substr(Math.max(0, idx - 20), 60);
            break;
          }
        }
        if (bad) break;
      }
      if (bad) {
        result.status = 'warn-bad-literal';
        result.err = bad.replace(/\s+/g, ' ').slice(0, 60);
      } else if (delta <= 0) {
        result.status = 'warn-no-html';
        result.err = 'innerHTML 未增加';
      } else {
        result.status = 'pass';
      }
    } catch (e) {
      result.status = 'fail-throw';
      result.err = (e.message || String(e)).slice(0, 100);
    }
    results.push(result);
  }

  // 4. Summary
  const counts = { pass: 0, warn: 0, fail: 0, skip: 0 };
  results.forEach(r => {
    if (r.status === 'pass') counts.pass++;
    else if (r.status.startsWith('warn')) counts.warn++;
    else if (r.status.startsWith('skip')) counts.skip++;
    else counts.fail++;
  });

  console.log('[smoke-render-panels] results·');
  results.forEach(r => {
    const icon = r.status === 'pass' ? '✓' : r.status.startsWith('warn') ? '⚠' : r.status.startsWith('skip') ? '○' : '✗';
    let line = '  ' + icon + ' ' + r.name + ' (' + r.fn + ')·' + r.status;
    if (r.err) line += ' — ' + r.err;
    if (r.htmlDelta) line += ' [+' + r.htmlDelta + ' chars]';
    console.log(line);
  });

  console.log('');
  console.log('[smoke-render-panels] summary·' + counts.pass + ' pass / ' + counts.warn + ' warn / ' + counts.skip + ' skip / ' + counts.fail + ' fail');

  if (counts.fail > 0 || counts.warn > 0 || counts.skip > 0) {
    console.log('FAIL smoke-render-panels·fail=' + counts.fail + ' warn=' + counts.warn + ' skip=' + counts.skip);
    process.exit(1);
  }
  console.log('smoke-render-panels PASS ' + counts.pass + '/' + results.length);
  process.exit(0);
}

main();
