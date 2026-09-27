#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
let passed = 0;
function assert(cond, msg) {
  if (!cond) throw new Error('[smoke-desktop-back-to-start-panel] ' + msg);
  passed++;
}

const toasts = [];
const elements = Object.create(null);
const createdTags = [];
let htmlWrites = 0;

function makeNode(tag) {
  let nodeId = '';
  let text = '';
  const node = {
    nodeType: 1,
    tagName: String(tag || 'div').toUpperCase(),
    children: [],
    parentNode: null,
    style: {},
    dataset: {},
    attributes: Object.create(null),
    setAttribute(name,value) { this.attributes[name]=String(value); },
    getAttribute(name) { return this.attributes[name] ?? null; },
    removeAttribute(name) { delete this.attributes[name]; },
    className: '',
    value: '',
    listeners: Object.create(null),
    appendChild(child) {
      this.children.push(child);
      if (child && typeof child === 'object') child.parentNode = this;
      return child;
    },
    replaceChildren(...children) {
      this.children.forEach((child) => { if (child && typeof child === 'object') child.parentNode = null; });
      this.children = [];
      children.forEach((child) => this.appendChild(child));
    },
    addEventListener(type, handler) {
      if (!this.listeners[type]) this.listeners[type] = [];
      this.listeners[type].push(handler);
    },
    click() { (this.listeners.click || []).forEach((handler) => handler({ currentTarget: this, target: this })); },
    classList: { add() {}, remove() {}, contains() { return false; } }
  };
  Object.defineProperty(node, 'firstElementChild', {
    get() { return node.children.find((child) => child && child.nodeType === 1) || null; }
  });
  Object.defineProperty(node, 'id', {
    get() { return nodeId; },
    set(value) { nodeId = String(value || ''); if (nodeId) elements[nodeId] = node; }
  });
  Object.defineProperty(node, 'textContent', {
    get() { return text + node.children.map((child) => child && child.textContent || '').join(''); },
    set(value) { text = String(value == null ? '' : value); if (text === '') node.children = []; }
  });
  Object.defineProperty(node, 'innerHTML', {
    get() { return ''; },
    set() { htmlWrites++; }
  });
  createdTags.push(node.tagName);
  return node;
}

function findNodes(root, predicate, out = []) {
  if (!root) return out;
  if (predicate(root)) out.push(root);
  (root.children || []).forEach((child) => findNodes(child, predicate, out));
  return out;
}

elements['main-view'] = makeNode('main');
elements.launch = makeNode('section');

const ctx = {
  console,
  setTimeout,
  clearTimeout,
  Date,
  JSON,
  Promise,
  fetch: async () => ({ ok: false }),
  confirm: () => true,
  P: { scenarios: [{ id: 'proj-1', name: '测试正式库剧本', era: '测试纪元', role: '测试帝' }], conf: {}, _indices: {} },
  GM: {},
  toast: (message) => toasts.push(String(message)),
  _dbg: () => {},
  _$: (id) => elements[id] || null,
  buildIndices: () => { ctx.P._indices = { scenarioById: {} }; },
  findScenarioById: (id) => ctx.P.scenarios.find((scenario) => scenario && scenario.id === id) || null,
  startGame: () => { ctx.__started = true; },
  document: {
    getElementById: (id) => elements[id] || null,
    querySelector: () => null,
    addEventListener: () => {},
    createElement: makeNode,
    createTextNode(value) { const node = makeNode('#text'); node.nodeType = 3; node.textContent = value; return node; }
  }
};
ctx.window = ctx;
ctx.window.tianming = {
  isDesktop: true,
  listScenarios: async () => ({ success: true, files: [] }),
  loadScenario: async (name) => { ctx.__diskLoadAttempts = (ctx.__diskLoadAttempts || 0) + 1; return { success: false, error: 'no such file: ' + name }; },
  saveScenario: async () => ({ success: true }),
  deleteScenario: async () => ({ success: true })
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-electron.js'), 'utf8'), ctx, { filename: 'tm-electron.js', timeout: 10000 });

assert(typeof ctx.desktopStartProjectScn === 'function', 'desktopStartProjectScn should exist');
assert(typeof ctx.desktopBackToStartPanel === 'function', 'desktopBackToStartPanel should exist');
ctx.desktopStartProjectScn('proj-1');
assert(elements['start-save-name'] && elements['start-save-name'].tagName === 'INPUT', 'project scenario should render a real save-name input');
assert(ctx._pendingStartPayload && ctx._pendingStartPayload.scn.id === 'proj-1', 'pending payload should hold the project scenario');

elements['start-save-name'].value = '测试存档';
ctx.desktopConfirmStart();
const modePanel = elements['main-view'].children[0];
const backButtons = findNodes(modePanel, (node) => node.tagName === 'BUTTON' && node.textContent === '返回');
assert(backButtons.length === 1, 'mode panel should contain one return button');
assert((backButtons[0].listeners.click || []).length === 1, 'return button uses one closure event listener');
assert(!Object.prototype.hasOwnProperty.call(backButtons[0], 'onclick'), 'return button does not use an inline onclick property');

const diskBefore = ctx.__diskLoadAttempts || 0;
backButtons[0].click();
assert(elements['start-save-name'] && elements['start-save-name'].value.indexOf('测试正式库剧本_') === 0, 'back should rebuild the save-name panel from memory');
assert((ctx.__diskLoadAttempts || 0) === diskBefore, 'back must not attempt disk load');
assert(!toasts.some((message) => message.includes('加载失败')), 'back must not report disk load failure');

ctx._pendingStartPayload = null;
ctx.desktopBackToStartPanel();
assert(elements['main-view'].children[0].getAttribute('aria-busy')==='true', 'missing payload fallback opens a busy scenario-selection panel');
assert(htmlWrites === 0, 'desktop flow never writes innerHTML');
assert(!createdTags.includes('SCRIPT') && !createdTags.includes('IMG'), 'desktop flow does not create injected active tags');

console.log('smoke-desktop-back-to-start-panel OK: ' + passed + ' assertions');
