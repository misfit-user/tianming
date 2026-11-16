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
      addEventListener(type, fn) { this._listeners[type] = fn; },
      setAttribute(name, value) { this.attributes[name] = String(value); },
      getAttribute(name) { return this.attributes[name] || null; },
      querySelector(selector) {
        if (selector === '.tm-mw-body') return this.children.find((child) => child && child.className === 'tm-mw-body') || null;
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
    getElementById(id) { return elements.get(id) || null; },
  };
  doc.head.appendChild = doc.body.appendChild = function appendTracked(child) {
    if (child) {
      child.parentNode = this;
      this.children.push(child);
      register(child);
    }
    return child;
  };
  return doc;
}

function clickPanel(panel, attrs) {
  const button = {
    getAttribute(name) { return attrs[name] || null; },
    closest(selector) { return selector === 'button[data-action]' ? button : null; },
  };
  assert(panel._listeners && typeof panel._listeners.click === 'function', 'Workshop panel should install a click listener');
  panel._listeners.click({ target: button });
}

function auditSection(html) {
  const text = String(html || '');
  const start = text.indexOf('data-section="audit-events"');
  if (start < 0) return '';
  const end = text.indexOf('</section>', start);
  return end >= 0 ? text.slice(start, end) : text.slice(start);
}

const sandbox = { window: {}, document: makeDocument(), console, Date, Math, JSON };
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
  turn: 901,
  _memoryDraftInbox: [
    { id: 'draft-filter-a', type: 'semantic_fact', body: 'Filter target A', status: 'draft' },
    { id: 'draft-filter-b', type: 'semantic_fact', body: 'Filter target B', status: 'draft' },
  ],
  _memoryAccepted: [
    {
      id: 'accepted-filter-new',
      type: 'issue_resolution',
      body: 'Accepted filter new',
      supersedesRefs: [{ type: 'accepted_memory', id: 'accepted-filter-old' }],
    },
    { id: 'accepted-filter-old', type: 'issue_update', body: 'Accepted filter old' },
  ],
  _memoryQuarantine: [],
  _memoryControls: {},
  _memoryAuditEvents: [],
};
GM._memoryWriteQueue = GM._memoryDraftInbox.concat(GM._memoryQuarantine);

MW.handleAction(GM, 'hide-memory', 'draft-filter-a', { reviewer: 'workshop-smoke', reason: 'hide a' });
MW.handleAction(GM, 'mark-false-memory', 'draft-filter-b', { reviewer: 'workshop-smoke', reason: 'false b' });
const falseEvent = GM._memoryAuditEvents.find((event) => event.action === 'mark_false_memory');
MW.handleAction(GM, 'undo-memory-control', falseEvent.auditId, { reviewer: 'workshop-smoke', reason: 'undo false b' });
MW.handleAction(GM, 'apply-supersedes', 'accepted-filter-new', { reviewer: 'workshop-smoke', reason: 'supersede old' });

const undoableHtml = MW.renderAuditEvents(GM, { auditFilter: 'undoable' });
assert(undoableHtml.includes('hide_memory'), 'undoable filter should include active undoable hide action');
assert(undoableHtml.includes('apply_supersedes'), 'undoable filter should include active undoable supersedes action');
assert(!undoableHtml.includes('mark_false_memory'), 'undoable filter should exclude already-undone events');
assert(!undoableHtml.includes('undo_memory_control'), 'undoable filter should exclude non-undoable follow-up events');

const activeHtml = MW.renderAuditEvents(GM, { auditFilter: 'active' });
assert(activeHtml.includes('hide_memory'), 'active filter should include non-undone events');
assert(!activeHtml.includes('mark_false_memory'), 'active filter should exclude undone original events');

const dangerHtml = MW.renderAuditEvents(GM, { auditFilter: 'danger' });
assert(dangerHtml.includes('mark_false_memory'), 'danger filter should include mark false history');
assert(dangerHtml.includes('apply_supersedes'), 'danger filter should include supersedes history');
assert(!dangerHtml.includes('hide_memory'), 'danger filter should exclude plain hide actions');

const targetHtml = MW.renderAuditEvents(GM, { auditTarget: 'draft-filter-a' });
assert(targetHtml.includes('hide_memory'), 'target filter should include matching target events');
assert(!targetHtml.includes('draft-filter-b'), 'target filter should exclude other target ids');
assert(!targetHtml.includes('accepted-filter-new'), 'target filter should exclude accepted target ids');

const panel = MW.open({ GM });
const body = panel.querySelector('.tm-mw-body');
assert(body.innerHTML.includes('data-action="set-audit-filter"'), 'panel should render audit filter buttons');
assert(body.innerHTML.includes('data-action="set-audit-target"'), 'panel should render target filter buttons');

clickPanel(panel, { 'data-action': 'set-audit-filter', 'data-audit-filter': 'danger' });
assert(body.innerHTML.includes('Audit Filter danger'), 'clicking danger filter should refresh panel filter label');
assert(auditSection(body.innerHTML).includes('mark_false_memory'), 'danger panel filter should show mark false event');
assert(!auditSection(body.innerHTML).includes('<td>hide_memory</td>'), 'danger panel filter should hide plain hide event rows');

clickPanel(panel, { 'data-action': 'set-audit-target', 'data-memory-id': 'draft-filter-a' });
assert(body.innerHTML.includes('Audit Target draft-filter-a'), 'clicking target filter should refresh panel target label');
assert(auditSection(body.innerHTML).includes('hide_memory'), 'target panel filter should show matching target event');
assert(!auditSection(body.innerHTML).includes('accepted-filter-new'), 'target panel filter should hide other targets');

clickPanel(panel, { 'data-action': 'set-audit-filter', 'data-audit-filter': 'all' });
clickPanel(panel, { 'data-action': 'clear-audit-target' });
assert(body.innerHTML.includes('Audit Filter all'), 'clicking all filter should restore all filter label');
assert(!body.innerHTML.includes('Audit Target draft-filter-a'), 'clear target should remove target filter label');

console.log('smoke-memory-workshop-audit-filters ok');
