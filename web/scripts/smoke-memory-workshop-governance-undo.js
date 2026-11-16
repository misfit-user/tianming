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
assert.strictEqual(typeof MW.handleAction, 'function', 'MemoryWorkshop should expose handleAction');
assert.strictEqual(typeof MW.renderAuditEvents, 'function', 'MemoryWorkshop should expose audit event renderer');

const GM = {
  turn: 777,
  _memoryDraftInbox: [
    {
      id: 'draft-undo',
      type: 'semantic_fact',
      body: 'Undo guarded draft',
      status: 'draft',
      reviewStatus: 'pending_review',
      sourceRefs: [{ type: 'aiTurnResult', id: 'SC1', turn: 777 }],
    }
  ],
  _memoryAccepted: [
    {
      id: 'accepted-undo-new',
      type: 'issue_resolution',
      body: 'New accepted memory for undo',
      status: 'active',
      reviewStatus: 'accepted',
      supersedesRefs: [{ type: 'accepted_memory', id: 'accepted-undo-old' }],
      sourceRefs: [{ type: 'aiTurnResult', id: 'SC1', turn: 777 }],
    },
    {
      id: 'accepted-undo-old',
      type: 'issue_update',
      body: 'Old accepted memory for undo',
      status: 'active',
      reviewStatus: 'accepted',
      sourceRefs: [{ type: 'aiTurnResult', id: 'SC1-old', turn: 776 }],
    }
  ],
  _memoryQuarantine: [],
  _memoryControls: {
    'accepted-undo-old': { hidden: true, reason: 'preexisting old control' },
  },
  _memEdges: [
    { id: 'edge-unrelated', type: 'related', src: 'a', dst: 'b' },
  ],
  _memoryAuditEvents: [],
};
GM._memoryWriteQueue = GM._memoryDraftInbox.concat(GM._memoryQuarantine);

MW.handleAction(GM, 'apply-supersedes', 'accepted-undo-new', {
  reviewer: 'workshop-smoke',
  reason: 'manual supersedes before undo'
});
const applyEvent = GM._memoryAuditEvents.find((event) => event.action === 'apply_supersedes');
assert(applyEvent && applyEvent.auditId, 'apply-supersedes audit should include a stable auditId');
assert(applyEvent.undoable === true, 'apply-supersedes audit should be undoable');
assert(applyEvent.undo && Array.isArray(applyEvent.undo.controls), 'apply-supersedes audit should carry undo control state');
assert(applyEvent.undo.controls.some((entry) => entry.key === 'accepted-undo-old' && entry.before && entry.before.hidden === true), 'undo payload should keep the previous old-memory control');
assert(Array.isArray(applyEvent.undo.edgesBefore) && applyEvent.undo.edgesBefore.length === 1, 'undo payload should keep previous edge list');
assert(GM._memoryControls['accepted-undo-old'].supersededBy === 'accepted-undo-new', 'apply-supersedes should mutate old memory before undo');
assert(GM._memEdges.some((edge) => edge.type === 'supersedes' && edge.src === 'accepted-undo-new' && edge.dst === 'accepted-undo-old'), 'apply-supersedes should create an edge before undo');

const auditHtml = MW.renderAuditEvents(GM, { playerSafe: true });
assert(auditHtml.includes('data-action="undo-memory-control"'), 'audit renderer should expose undo action buttons');
assert(auditHtml.includes(`data-memory-id="${applyEvent.auditId}"`), 'undo button should target the auditId');

const undone = MW.handleAction(GM, 'undo-memory-control', applyEvent.auditId, {
  reviewer: 'workshop-smoke',
  reason: 'undo bad supersedes'
});
assert(undone && undone.undone === true, 'undo-memory-control should undo the target audit event');
assert.strictEqual(GM._memoryControls['accepted-undo-old'].hidden, true, 'undo should restore preexisting control hidden flag');
assert.strictEqual(GM._memoryControls['accepted-undo-old'].reason, 'preexisting old control', 'undo should restore preexisting control reason');
assert(!GM._memoryControls['accepted-undo-old'].supersededBy, 'undo should remove supersededBy written by apply-supersedes');
assert.deepStrictEqual(GM._memEdges, [{ id: 'edge-unrelated', type: 'related', src: 'a', dst: 'b' }], 'undo should restore the edge list');
assert(applyEvent.undone === true, 'undo should mark the original audit event as undone');
assert(GM._memoryAuditEvents.some((event) => event.action === 'undo_memory_control' && event.targetAuditId === applyEvent.auditId), 'undo should append a follow-up audit event');

MW.handleAction(GM, 'mark-false-memory', 'draft-undo', {
  reviewer: 'workshop-smoke',
  reason: 'manual false before panel undo'
});
const markEvent = GM._memoryAuditEvents.find((event) => event.action === 'mark_false_memory');
assert(markEvent && markEvent.auditId, 'mark-false audit should include auditId');
assert(GM._memoryControls['draft-undo'] && GM._memoryControls['draft-undo'].markedFalse === true, 'mark-false should create control before panel undo');

const panel = MW.open({ GM });
const body = panel.querySelector('.tm-mw-body');
assert(body.innerHTML.includes('Governance Audit'), 'Workshop panel should render governance audit section');
clickPanel(panel, attrsForButton(body.innerHTML, 'undo-memory-control', markEvent.auditId));
assert(!GM._memoryControls['draft-undo'], 'panel Undo should remove a control created by the undone event');
assert(markEvent.undone === true, 'panel Undo should mark the audit event as undone');
assert(body.innerHTML.includes('undone'), 'panel refresh should show undone audit status');

console.log('smoke-memory-workshop-governance-undo ok');
