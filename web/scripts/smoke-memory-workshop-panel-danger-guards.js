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

const guardLog = { confirms: [], prompts: [], confirmQueue: [], promptQueue: [] };
const sandbox = {
  window: {},
  document: makeDocument(),
  console,
  Date,
  Math,
  JSON,
  confirm(message) {
    guardLog.confirms.push(String(message || ''));
    return guardLog.confirmQueue.length ? guardLog.confirmQueue.shift() : true;
  },
  prompt(message, defaultValue) {
    guardLog.prompts.push({ message: String(message || ''), defaultValue: String(defaultValue || '') });
    return guardLog.promptQueue.length ? guardLog.promptQueue.shift() : 'guard reason';
  },
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
  turn: 666,
  _memoryDraftInbox: [
    {
      id: 'draft-danger',
      type: 'issue_resolution',
      body: 'Danger guarded draft',
      status: 'draft',
      reviewStatus: 'pending_review',
      supersedesRefs: [{ type: 'accepted_memory', id: 'accepted-danger-old' }],
      sourceRefs: [{ type: 'aiTurnResult', id: 'SC1', turn: 666 }],
    }
  ],
  _memoryAccepted: [
    {
      id: 'accepted-danger-new',
      type: 'issue_resolution',
      body: 'Danger guarded new memory',
      status: 'active',
      reviewStatus: 'accepted',
      supersedesRefs: [{ type: 'accepted_memory', id: 'accepted-danger-old' }],
      sourceRefs: [{ type: 'aiTurnResult', id: 'SC1', turn: 666 }],
    },
    {
      id: 'accepted-danger-old',
      type: 'issue_update',
      body: 'Danger guarded old memory',
      status: 'active',
      reviewStatus: 'accepted',
      sourceRefs: [{ type: 'aiTurnResult', id: 'SC1-old', turn: 665 }],
    }
  ],
  _memoryQuarantine: [],
  _memoryControls: {
    'accepted-danger-old': { hidden: true, reason: 'preexisting control' },
  },
  _memoryAuditEvents: [],
};
GM._memoryWriteQueue = GM._memoryDraftInbox.concat(GM._memoryQuarantine);

const panel = MW.open({ GM });
const body = panel.querySelector('.tm-mw-body');
assert(body && body.innerHTML.includes('draft-danger'), 'opened panel should render the danger fixture');

guardLog.confirmQueue.push(false);
clickPanel(panel, attrsForButton(body.innerHTML, 'mark-false-memory', 'draft-danger'));
assert.strictEqual(guardLog.confirms.length, 1, 'dangerous mark-false should ask for confirmation');
assert(!GM._memoryControls['draft-danger'], 'cancelled mark-false should not mutate controls');
assert(!GM._memoryAuditEvents.some((event) => event.id === 'draft-danger'), 'cancelled mark-false should not audit');

guardLog.confirmQueue.push(true);
guardLog.promptQueue.push(null);
clickPanel(panel, attrsForButton(body.innerHTML, 'clear-memory-control', 'accepted-danger-old'));
assert.strictEqual(guardLog.prompts.length, 1, 'confirmed clear-control should ask for a reason');
assert(GM._memoryControls['accepted-danger-old'], 'reason-cancelled clear-control should not remove control');
assert(!GM._memoryAuditEvents.some((event) => event.id === 'accepted-danger-old' && event.action === 'clear_memory_control'), 'reason-cancelled clear-control should not audit');

guardLog.confirmQueue.push(true);
guardLog.promptQueue.push('player corrected false rumor');
clickPanel(panel, attrsForButton(body.innerHTML, 'mark-false-memory', 'draft-danger'));
assert(GM._memoryControls['draft-danger'] && GM._memoryControls['draft-danger'].markedFalse === true, 'confirmed mark-false should mutate controls');
assert.strictEqual(GM._memoryControls['draft-danger'].reason, 'player corrected false rumor', 'mark-false should store the entered reason');
assert(GM._memoryAuditEvents.some((event) => event.id === 'draft-danger' && event.action === 'mark_false_memory' && event.reason === 'player corrected false rumor'), 'mark-false should audit the entered reason');

guardLog.confirmQueue.push(true);
guardLog.promptQueue.push('new decision supersedes old rumor');
clickPanel(panel, attrsForButton(body.innerHTML, 'apply-supersedes', 'accepted-danger-new'));
assert(GM._memoryControls['accepted-danger-old'] && GM._memoryControls['accepted-danger-old'].supersededBy === 'accepted-danger-new', 'confirmed apply-supersedes should mark old accepted memory');
assert.strictEqual(GM._memoryControls['accepted-danger-old'].reason, 'new decision supersedes old rumor', 'apply-supersedes should store entered reason');
assert(GM._memoryAuditEvents.some((event) => event.id === 'accepted-danger-new' && event.action === 'apply_supersedes' && event.reason === 'new decision supersedes old rumor'), 'apply-supersedes should audit the entered reason');
assert(body.innerHTML.includes('supersededBy=accepted-danger-new'), 'panel refresh should show supersededBy after guarded apply-supersedes');

console.log('smoke-memory-workshop-panel-danger-guards ok');
