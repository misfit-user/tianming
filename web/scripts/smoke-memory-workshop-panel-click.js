#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

function makeClassList() {
  const values = new Set();
  return {
    add(value) { values.add(String(value)); },
    remove(value) { values.delete(String(value)); },
    contains(value) { return values.has(String(value)); },
  };
}

function makeDocument() {
  const elements = new Map();

  function register(node) {
    if (node && node.id) elements.set(node.id, node);
    return node;
  }

  function makeElement(tag) {
    const node = {
      tagName: String(tag || 'div').toUpperCase(),
      id: '',
      className: '',
      children: [],
      parentNode: null,
      style: {},
      attributes: {},
      classList: makeClassList(),
      _innerHTML: '',
      _listeners: {},
      appendChild(child) {
        if (child) {
          child.parentNode = this;
          this.children.push(child);
          register(child);
        }
        return child;
      },
      addEventListener(type, fn) {
        this._listeners[type] = fn;
      },
      setAttribute(name, value) {
        this.attributes[name] = String(value);
      },
      getAttribute(name) {
        return this.attributes[name] || null;
      },
      querySelector(selector) {
        if (selector === '.tm-mw-body') {
          return this.children.find((child) => child && child.className === 'tm-mw-body') || null;
        }
        return null;
      },
    };
    Object.defineProperty(node, 'innerHTML', {
      get() { return this._innerHTML; },
      set(html) {
        this._innerHTML = String(html || '');
        if (this.id === 'tm-memory-workshop' && this._innerHTML.includes('class="tm-mw-body"')) {
          const body = makeElement('div');
          body.className = 'tm-mw-body';
          this.appendChild(body);
        }
      },
    });
    return node;
  }

  const doc = {
    head: makeElement('head'),
    body: makeElement('body'),
    createElement: makeElement,
    getElementById(id) {
      return elements.get(id) || null;
    },
  };
  doc.head.appendChild = function appendHead(child) {
    if (child) {
      child.parentNode = this;
      this.children.push(child);
      register(child);
    }
    return child;
  };
  doc.body.appendChild = function appendBody(child) {
    if (child) {
      child.parentNode = this;
      this.children.push(child);
      register(child);
    }
    return child;
  };
  return doc;
}

function attrsForButton(html, action, memoryId) {
  const escapedAction = action.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedId = memoryId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = String(html || '').match(new RegExp(`<button[^>]*data-action="${escapedAction}"[^>]*data-memory-id="${escapedId}"[^>]*>`, 'i'));
  assert(match, `button ${action}/${memoryId} should be rendered`);
  const attrs = {};
  match[0].replace(/\s(data-[a-z0-9-]+)="([^"]*)"/gi, (_, key, value) => {
    attrs[key] = value;
    return '';
  });
  return attrs;
}

function clickPanel(panel, attrs) {
  const button = {
    getAttribute(name) {
      return attrs[name] || null;
    },
    closest(selector) {
      return selector === 'button[data-action]' ? button : null;
    },
  };
  assert(panel._listeners && typeof panel._listeners.click === 'function', 'Workshop panel should install a click listener');
  panel._listeners.click({ target: button });
}

const sandbox = {
  window: {},
  document: makeDocument(),
  console,
  Date,
  Math,
  JSON,
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

[
  'tm-memory-envelope.js',
  'tm-memory-controls.js',
  'tm-memory-workshop.js'
].forEach((file) => {
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox, { filename: file });
});

const MW = sandbox.TM && sandbox.TM.MemoryWorkshop;
assert(MW, 'MemoryWorkshop should be exported');

const GM = {
  turn: 555,
  _memoryDraftInbox: [
    {
      id: 'draft-click',
      type: 'issue_resolution',
      body: 'Click path draft memory',
      status: 'draft',
      reviewStatus: 'pending_review',
      supersedesRefs: [{ type: 'accepted_memory', id: 'accepted-click-old' }],
      sourceRefs: [{ type: 'aiTurnResult', id: 'SC1', turn: 555 }],
    }
  ],
  _memoryAccepted: [
    {
      id: 'accepted-click-new',
      type: 'issue_resolution',
      body: 'New accepted memory',
      status: 'active',
      reviewStatus: 'accepted',
      supersedesRefs: [{ type: 'accepted_memory', id: 'accepted-click-old' }],
      sourceRefs: [{ type: 'aiTurnResult', id: 'SC1', turn: 555 }],
    },
    {
      id: 'accepted-click-old',
      type: 'issue_update',
      body: 'Old accepted memory',
      status: 'active',
      reviewStatus: 'accepted',
      sourceRefs: [{ type: 'aiTurnResult', id: 'SC1-old', turn: 554 }],
    }
  ],
  _memoryQuarantine: [],
  _memoryControls: {},
  _memoryAuditEvents: [],
};
GM._memoryWriteQueue = GM._memoryDraftInbox.concat(GM._memoryQuarantine);

const panel = MW.open({ GM });
assert(panel && panel.classList.contains('open'), 'MW.open({ GM }) should open the panel');
const body = panel.querySelector('.tm-mw-body');
assert(body && body.innerHTML.includes('draft-click'), 'opened panel should render the passed GM');

clickPanel(panel, attrsForButton(body.innerHTML, 'hide-memory', 'draft-click'));
assert(GM._memoryControls['draft-click'] && GM._memoryControls['draft-click'].hidden === true, 'clicking Hide should update the GM passed to open()');
assert(GM._memoryAuditEvents.some((event) => event.id === 'draft-click' && event.action === 'hide_memory'), 'clicking Hide should audit through panel listener');
assert(body.innerHTML.includes('Memory Controls') && body.innerHTML.includes('hidden'), 'panel should refresh and show hidden control state after click');

clickPanel(panel, attrsForButton(body.innerHTML, 'cooldown-memory', 'draft-click'));
assert.strictEqual(GM._memoryControls['draft-click'].cooldownUntilTurn, 561, 'clicking Cooldown should use rendered data-cooldown-turns');
assert(body.innerHTML.includes('cooldown=561'), 'panel refresh should show the cooldown governance marker');

clickPanel(panel, attrsForButton(body.innerHTML, 'apply-supersedes', 'accepted-click-new'));
assert(Array.isArray(GM._memEdges) && GM._memEdges.some((edge) => edge.type === 'supersedes' && edge.src === 'accepted-click-new' && edge.dst === 'accepted-click-old'), 'clicking Apply Supersedes should create a supersedes edge');
assert(GM._memoryControls['accepted-click-old'] && GM._memoryControls['accepted-click-old'].supersededBy === 'accepted-click-new', 'clicking Apply Supersedes should mark the old accepted memory');
assert(body.innerHTML.includes('supersededBy=accepted-click-new'), 'panel refresh should show supersededBy after click');

console.log('smoke-memory-workshop-panel-click ok');
