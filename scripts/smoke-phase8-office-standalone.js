#!/usr/bin/env node
/* eslint-env node */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const HEADLESS = path.join(__dirname, 'headless-smoke.js');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function loadHeadlessHelpers() {
  const source = fs.readFileSync(HEADLESS, 'utf8')
    .replace(/^#![^\n]*\n/, '')
    .replace(/\nmain\(\);\s*$/, '\nreturn { makeStubs, parseIndexHtmlScripts };');
  const factory = new Function('require', 'process', '__dirname', '__filename', 'module', 'exports', source);
  return factory(require, process, __dirname, HEADLESS, { exports: {} }, {});
}

const helpers = loadHeadlessHelpers();

function installNodeExtras(win) {
  win.location.href = 'http://localhost/index.html';
  win.location.search = '';
  win.AbortController = class {
    constructor() {
      this.signal = { aborted: false, addEventListener() {}, removeEventListener() {} };
    }
    abort() { this.signal.aborted = true; }
  };
  win.fetch = function () {
    return Promise.resolve({
      ok: true,
      status: 200,
      headers: { get() { return ''; } },
      text() { return Promise.resolve('{}'); },
      json() { return Promise.resolve({ ok: true }); }
    });
  };
}

function loadGame() {
  const env = helpers.makeStubs();
  installNodeExtras(env.win);
  const sandbox = vm.createContext(env.win);
  const scripts = helpers.parseIndexHtmlScripts();
  const loadScripts = scripts.filter((src) => path.basename(src) !== 'tm-test-harness.js');

  loadScripts.forEach((src) => {
    const abs = path.join(ROOT, src);
    assert(fs.existsSync(abs), 'script missing: ' + src);
    const code = fs.readFileSync(abs, 'utf8');
    vm.runInContext(code, sandbox, { filename: src, displayErrors: true, timeout: 10000 });
  });

  return sandbox;
}

function makeClassList() {
  const values = new Set();
  return {
    add() { Array.from(arguments).forEach((v) => values.add(String(v))); },
    remove() { Array.from(arguments).forEach((v) => values.delete(String(v))); },
    contains(v) { return values.has(String(v)); },
    toggle(v, force) {
      if (force === true) { values.add(String(v)); return true; }
      if (force === false) { values.delete(String(v)); return false; }
      if (values.has(String(v))) { values.delete(String(v)); return false; }
      values.add(String(v)); return true;
    },
    toString() { return Array.from(values).join(' '); }
  };
}

function installTrackedDom(sandbox) {
  const doc = sandbox.document;
  const baseCreate = doc.createElement.bind(doc);
  const registry = Object.create(null);

  function register(node) {
    if (node && node.id) registry[node.id] = node;
    return node;
  }

  function makeNode(tag, id) {
    const node = baseCreate(tag || 'div');
    node.id = id || '';
    node.children = [];
    node.style = {};
    node.dataset = {};
    node.classList = makeClassList();
    node.appendChild = function (child) {
      this.children.push(child);
      if (child && child.id) registry[child.id] = child;
      return child;
    };
    node.removeChild = function (child) {
      this.children = this.children.filter((x) => x !== child);
      if (child && child.id && registry[child.id] === child) delete registry[child.id];
      return child;
    };
    node.insertBefore = function (child) {
      this.children.unshift(child);
      if (child && child.id) registry[child.id] = child;
      return child;
    };
    node.remove = function () {
      if (node.id && registry[node.id] === node) delete registry[node.id];
    };
    node.querySelector = function (sel) {
      if (typeof sel === 'string' && sel.charAt(0) === '#') return registry[sel.slice(1)] || null;
      if (typeof sel === 'string' && sel.charAt(0) === '.') {
        this.__queryStubs = this.__queryStubs || Object.create(null);
        if (!this.__queryStubs[sel]) this.__queryStubs[sel] = makeNode('button');
        return this.__queryStubs[sel];
      }
      return null;
    };
    node.querySelectorAll = function () { return []; };
    node.addEventListener = function () {};
    node.removeEventListener = function () {};
    node.setAttribute = function (key, value) { this.attributes = this.attributes || {}; this.attributes[key] = String(value); };
    node.getAttribute = function (key) { return this.attributes && this.attributes[key] || null; };
    return register(node);
  }

  doc.createElement = function (tag) { return makeNode(tag); };
  doc.createElementNS = function (_ns, tag) { return makeNode(tag); };
  doc.getElementById = function (id) { return registry[id] || null; };
  doc.querySelector = function (sel) {
    if (typeof sel === 'string' && sel.charAt(0) === '#') return registry[sel.slice(1)] || null;
    return null;
  };
  doc.querySelectorAll = function () { return []; };
  doc.body = makeNode('body');
  doc.head = makeNode('head');
  doc.documentElement = makeNode('html');
  const game = makeNode('div', 'G');
  doc.body.appendChild(game);
  const gc = makeNode('div', 'gc');
  doc.body.appendChild(gc);

  return { registry, makeNode };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

(async function main() {
  const sandbox = loadGame();
  const dom = installTrackedDom(sandbox);

  sandbox.GM = sandbox.GM || {};
  sandbox.P = sandbox.P || {};
  sandbox.GM.officeTree = [{ id: 'root', name: '内阁' }];
  sandbox.P.officeTree = [{ id: 'root', name: '内阁' }];
  sandbox.__renderGameStateCalls = 0;
  sandbox.__officeRenderCalls = 0;
  sandbox.__switchedTab = '';

  sandbox.renderGameState = function () {
    sandbox.__renderGameStateCalls += 1;
    const gc = sandbox.document.getElementById('gc');
    const panel = dom.makeNode('div', 'gt-office');
    panel.className = 'g-tab-panel';
    const tree = dom.makeNode('div', 'office-tree');
    panel.appendChild(tree);
    gc.appendChild(panel);
  };
  sandbox.window.renderGameState = sandbox.renderGameState;

  sandbox.renderOfficeTree = function () {
    sandbox.__officeRenderCalls += 1;
    const tree = sandbox.document.getElementById('office-tree');
    if (tree) tree.innerHTML = '<section>官制内容已渲染</section>';
  };
  sandbox.window.renderOfficeTree = sandbox.renderOfficeTree;

  sandbox.switchGTab = function (_btn, panelId) {
    sandbox.__switchedTab = panelId;
    const panel = sandbox.document.getElementById(panelId);
    if (panel) panel.style.display = 'block';
    if (panelId === 'gt-office') sandbox.renderOfficeTree();
  };
  sandbox.window.switchGTab = sandbox.switchGTab;
  sandbox.TM = sandbox.TM || {};
  sandbox.TM.UI = sandbox.TM.UI || {};
  sandbox.TM.UI.tabs = {};

  assert(sandbox.TMPhase8FormalBridge, 'TMPhase8FormalBridge missing');
  assert(typeof sandbox.TMPhase8FormalBridge.openPanel === 'function', 'openPanel missing');
  sandbox.TMPhase8FormalBridge.openPanel('archive');
  await delay(90);

  const officePanel = sandbox.document.getElementById('gt-office');
  const officeTree = sandbox.document.getElementById('office-tree');
  assert(sandbox.__renderGameStateCalls === 1, 'legacy game state was not rebuilt before opening office');
  assert(sandbox.__switchedTab === 'gt-office', 'office legacy tab was not selected');
  assert(officePanel, 'gt-office panel missing');
  assert(officeTree, 'office-tree container missing');
  assert(/官制内容已渲染/.test(officeTree.innerHTML || ''), 'office tree was not rendered');
  assert(sandbox.document.body.classList.contains('tm-phase8-office-single'), 'office standalone mode not enabled');

  console.log('[smoke-phase8-office-standalone] PASS ' + JSON.stringify({
    renderGameStateCalls: sandbox.__renderGameStateCalls,
    officeRenderCalls: sandbox.__officeRenderCalls,
    switchedTab: sandbox.__switchedTab
  }));
  process.exit(0);
})().catch((e) => {
  console.error('[smoke-phase8-office-standalone] FAIL ' + (e && e.message || e));
  if (e && e.stack) console.error(e.stack.split('\n').slice(1, 8).join('\n'));
  process.exit(1);
});
