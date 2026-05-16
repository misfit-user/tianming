#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function makeDocument() {
  const elements = {};

  function parseIds(html) {
    const ids = [];
    String(html || '').replace(/id="([^"]+)"/g, function(_, id) {
      ids.push(id);
      return _;
    });
    return ids;
  }

  function makeEl(tag) {
    let html = '';
    const el = {
      tagName: String(tag || 'div').toUpperCase(),
      id: '',
      className: '',
      style: {},
      children: [],
      parentNode: null,
      value: '',
      textContent: '',
      dataset: {},
      classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
      appendChild(child) {
        if (!child) return child;
        child.parentNode = this;
        this.children.push(child);
        if (child.id) elements[child.id] = child;
        parseIds(child.innerHTML).forEach(function(id) {
          if (!elements[id]) {
            const childEl = makeEl('div');
            childEl.id = id;
            elements[id] = childEl;
          }
        });
        return child;
      },
      remove() {
        if (this.id) delete elements[this.id];
      },
      querySelector() { return null; },
      querySelectorAll() { return []; },
      addEventListener() {},
      setAttribute(name, value) {
        if (name === 'id') {
          this.id = value;
          elements[value] = this;
        }
      },
      getAttribute(name) { return name === 'id' ? this.id : null; }
    };
    Object.defineProperty(el, 'innerHTML', {
      get() { return html; },
      set(v) {
        html = String(v || '');
        parseIds(html).forEach(function(id) {
          if (!elements[id]) {
            const childEl = makeEl('div');
            childEl.id = id;
            elements[id] = childEl;
          }
        });
      }
    });
    return el;
  }

  const body = makeEl('body');
  return {
    elements,
    createElement: makeEl,
    body,
    getElementById(id) { return elements[id] || null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener() {}
  };
}

const document = makeDocument();
const toasts = [];
let yuqianOpened = 0;
let tinyiOpened = 0;

const context = {
  console,
  Math,
  Date,
  JSON,
  Array,
  Object,
  String,
  Number,
  Boolean,
  RegExp,
  parseInt,
  parseFloat,
  isFinite,
  isNaN,
  setTimeout,
  clearTimeout,
  document,
  window: null,
  global: null,
  globalThis: null,
  GM: { turn: 7, _chaoyiCount: { 7: 2 } },
  P: {},
  CY: null,
  TM: { errors: { capture(){}, captureSilent(){} } },
  toast(msg) { toasts.push(String(msg || '')); },
  escHtml(s) { return String(s == null ? '' : s); },
  _$(id) { return document.getElementById(id); },
  _cc3_open() { throw new Error('changchao should remain frequency-gated'); },
  _ty2_openSetup() { tinyiOpened++; },
  _yq2_openSetup() { yuqianOpened++; }
};
context.window = context;
context.global = context;
context.globalThis = context;

vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-chaoyi.js'), 'utf8'), context, {
  filename: 'tm-chaoyi.js'
});

context.openChaoyi();
assert(document.getElementById('chaoyi-modal'), 'openChaoyi should still open picker when only limited court count is full');

context._cy_pickMode('yuqian');
assert(yuqianOpened === 1, 'yuqian meeting should bypass court frequency limit');
assert(tinyiOpened === 0, 'tinyi should not be opened by yuqian pick');

console.log('[smoke-yuqian-open-frequency] pass');
