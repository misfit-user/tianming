#!/usr/bin/env node
'use strict';
// Detached DOM regression: runs real modal builders, never opens a client or writes a save.
const assert = require('assert/strict'), fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const css = read('styles.css');
const formalCss = read('phase8-formal-drafts.js');
const zGeneric = Number(css.match(/\.generic-modal-overlay\{[^}]*z-index:(\d+)/)[1]);
const zFormal = Number(formalCss.match(/\.tm-bridge-overlay\{[^}]*z-index:(\d+)/)[1]);
const zRice = Number(css.match(/\.rice-paper-confirm\{[^}]*z-index:(\d+)/)[1]);
let context, document;
function style() {
  const s = {};
  Object.defineProperty(s, 'cssText', { set(v) { this._text = v; String(v).split(';').forEach(p => { const at = p.indexOf(':'); if (at < 0) return; const k = p.slice(0, at).trim().replace(/-([a-z])/g, (_, x) => x.toUpperCase()); s[k] = p.slice(at + 1).trim(); }); }, get() { return this._text || ''; } });
  return s;
}
class Element {
  constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.attrs = {}; this.style = style(); this.id = ''; this.className = ''; this.value = ''; this.listeners = {}; }
  get isConnected() { return this === document.body || !!(this.parentElement && this.parentElement.isConnected); }
  get parentNode() { return this.parentElement; }
  get firstElementChild() { return this.children[0]; }
  appendChild(n) { if (n.parentElement) n.remove(); n.parentElement = this; this.children.push(n); return n; }
  remove() { if (this.parentElement) { this.parentElement.children = this.parentElement.children.filter(x => x !== this); this.parentElement = null; } }
  contains(n) { return n === this || this.children.some(x => x.contains(n)); }
  setAttribute(k, v) { this.attrs[k] = String(v); if (k === 'id') this.id = String(v); if (k === 'class') this.className = String(v); if (k === 'value') this.value = String(v); if (k === 'style') this.style.cssText = v; }
  getAttribute(k) { return this.attrs[k]; }
  focus() { document.activeElement = this; }
  matches(selector) {
    const negative = Array.from(selector.matchAll(/:not\(([^)]+)\)/g), x => x[1]);
    if (negative.some(s => this.matches(s))) return false;
    selector = selector.replace(/:not\([^)]+\)/g, '');
    const tag = selector.match(/^[a-z][\w-]*/i); if (tag && this.tagName !== tag[0].toUpperCase()) return false;
    const id = selector.match(/#([\w-]+)/); if (id && this.id !== id[1]) return false;
    if (Array.from(selector.matchAll(/\.([\w-]+)/g), x => x[1]).some(c => !this.className.split(/\s+/).includes(c))) return false;
    for (const m of selector.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)) {
      const v = m[1] === 'tabindex' ? this.tabIndex : m[1] === 'type' ? (this.type || this.attrs.type) : this.attrs[m[1]];
      if (v == null || (m[2] != null && String(v) !== m[2])) return false;
    }
    return true;
  }
  querySelectorAll(selector) { const parts = selector.split(',').map(s => s.trim()); const out = []; const visit = n => n.children.forEach(c => { if (parts.some(s => c.matches(s))) out.push(c); visit(c); }); visit(this); return out; }
  querySelector(s) { return this.querySelectorAll(s)[0] || null; }
  addEventListener(k, fn) { (this.listeners[k] || (this.listeners[k] = [])).push(fn); }
  click() {
    this.focus();
    const event = { target: this };
    if (typeof this.onclick === 'function') this.onclick(event);
    else if (/^close(?:Generic)?Modal\(\)$/.test(this.attrs.onclick || '')) context[this.attrs.onclick.split('(')[0]]();
    (this.listeners.click || []).forEach(fn => fn(event));
  }
  set innerHTML(html) {
    this._html = String(html); this.children.forEach(c => { c.parentElement = null; }); this.children = [];
    const stack = [this];
    for (const m of String(html).matchAll(/<\/?[a-zA-Z][^>]*>/g)) {
      const token = m[0];
      if (token.startsWith('</')) { if (stack.length > 1) stack.pop(); continue; }
      const tag = token.match(/^<([\w-]+)/)[1], n = new Element(tag);
      for (const a of token.matchAll(/([\w-]+)="([^"]*)"/g)) n.setAttribute(a[1], a[2]);
      stack[stack.length - 1].appendChild(n);
      if (!/^(input|br|hr|img|meta|link)$/i.test(tag) && !token.endsWith('/>')) stack.push(n);
    }
  }
  get innerHTML() { return this._html || ''; }
}
document = { listeners: {}, createElement: tag => new Element(tag), getElementById(id) { return this.body.querySelector('#' + id); }, querySelectorAll(s) { return this.body.querySelectorAll(s); }, addEventListener(k, fn, capture) { (this.listeners[k] || (this.listeners[k] = [])).push({ fn, capture }); }, removeEventListener(k, fn) { this.listeners[k] = (this.listeners[k] || []).filter(x => x.fn !== fn); } };
document.body = new Element('body'); document.activeElement = document.body;
document.querySelector = s => document.querySelectorAll(s)[0] || null;
function computed(n) { return Object.assign({ display: 'block', visibility: 'visible', zIndex: n.className.includes('tm-bridge-overlay') ? zFormal : n.className.includes('generic-modal-overlay') ? zGeneric : n.className.includes('rice-paper-confirm') ? zRice : 'auto' }, n.style); }
let passed = 0, endCalls = 0, syncCalls = 0, legacyEsc = 0;
const sourceState = Object.freeze({ busy: false, turn: 1, memorials: [] });
context = { console, document, Number, Math, isFinite, setTimeout: fn => fn(), GM: sourceState, escHtml: s => String(s), getComputedStyle: computed, _$: id => document.getElementById(id), getTSText: () => '开成五年正月十四', endTurn: () => { endCalls++; }, TMPhase8FormalBridge: { syncEdictDraftsToLegacy: () => { syncCalls++; } }, _saveEsc: s => String(s) };
context.window = context;
vm.createContext(context);
const ui = read('tm-ui-foundation.js');
vm.runInContext(ui.slice(ui.indexOf('function gv('), ui.indexOf('/* === Source: tm-settings-ui.js === */')), context);
const office = read('tm-office-panel.js');
vm.runInContext(office.slice(office.indexOf('function confirmEndTurn(){'), office.indexOf('// Phase 3 (2026-05-03)')), context);
const utils = read('tm-utils.js');
vm.runInContext(utils.slice(utils.indexOf('function showPrompt('), utils.indexOf('// 确定性随机系统')), context);
const saves = read('tm-save-manager.js');
vm.runInContext(saves.slice(saves.indexOf('function closeSaveManager()'), saves.indexOf('// P12: 存档对比')), context);
vm.runInContext(saves.slice(saves.indexOf('function showScrollConfirm('), saves.indexOf('// 玉玺按压动画')), context);
document.addEventListener('keydown', e => { if (e.key === 'Escape') legacyEsc++; });
function key(k, shift) {
  const e = { key: k, shiftKey: !!shift, preventDefault() { this.prevented = true; }, stopImmediatePropagation() { this.stopped = true; } };
  const handlers = (document.listeners.keydown || []).slice().sort((a, b) => Number(!!b.capture) - Number(!!a.capture));
  for (const h of handlers) { h.fn(e); if (e.stopped) break; }
  return e;
}
function check(label, fn) { fn(); passed++; console.log('PASS ' + label); }
const formal = document.createElement('div'); formal.className = 'tm-desk-overlay tm-bridge-overlay show'; formal.id = 'tm-action-edict-overlay'; document.body.appendChild(formal);
const drafts = ['edict-pol','edict-mil','edict-dip'].map((id, i) => { const n = document.createElement('textarea'); n.id = id; n.value = ['候诸司会奏','详核军粮','持节修好'][i]; formal.appendChild(n); return n; });
const turnButton = document.createElement('button'); turnButton.id = 'btn-end'; formal.appendChild(turnButton);
const draftValues = drafts.map(n => n.value);
check('confirm is above formal; cancel retains draft DOM and restores invoker', () => {
  turnButton.focus(); context.confirmEndTurn(); const ok = document.getElementById('cet-ok'), modal = context._tmTopModalLayer().node;
  assert(Number(modal.style.zIndex) > zFormal); assert.equal(document.activeElement.id, 'cet-cancel');
  document.getElementById('cet-cancel').click(); assert.equal(endCalls, 0); assert(formal.isConnected); assert.equal(document.activeElement, turnButton);
  assert.deepEqual(drafts.map(n => n.value), draftValues); assert(!ok.isConnected);
});
check('confirm invokes the existing endTurn once after dismissal', () => {
  turnButton.focus(); context.confirmEndTurn(); document.getElementById('cet-ok').click(); assert.equal(endCalls, 1); assert.equal(syncCalls, 2); assert.equal(context._tmTopModalLayer(), null); assert.equal(context.GM, sourceState);
});
check('generic editor is reachable, saves its own input, and restores focus', () => {
  let saved = ''; drafts[0].focus(); context.openGenericModal('改元', '<input id="era-input" value="承和">', () => { saved = document.getElementById('era-input').value; context.closeGenericModal(); });
  const modal = context._tmTopModalLayer().node; assert(Number(modal.style.zIndex) > zFormal); assert.equal(document.activeElement.id, 'era-input');
  modal.querySelector('#gm-save-btn').click(); assert.equal(saved, '承和'); assert.equal(document.activeElement, drafts[0]);
});
check('Escape cancels only top layer; nested generic IDs do not crosswire saves', () => {
  const calls = [];
  drafts[1].focus(); context.openGenericModal('外层', '<input id="outer-input">', () => calls.push('outer')); const outer = context._tmTopModalLayer().node, input = outer.querySelector('#outer-input'); input.focus();
  context.openGenericModal('内层', '<input id="inner-input">', () => calls.push('inner')); const inner = context._tmTopModalLayer().node;
  assert(Number(inner.style.zIndex) > Number(outer.style.zIndex)); inner.querySelector('#gm-save-btn').click(); assert.deepEqual(calls, ['inner']);
  key('Escape'); assert(!inner.isConnected); assert(outer.isConnected); assert.equal(document.activeElement, input);
  outer.querySelector('#gm-save-btn').click(); assert.deepEqual(calls, ['inner', 'outer']);
  key('Escape'); assert.equal(document.activeElement, drafts[1]); assert.equal(legacyEsc, 0);
});
check('Tab and Shift-Tab remain in the modal', () => {
  context.openGenericModal('焦点', '<input id="tab-input">', () => {}); const ov = context._tmTopModalLayer().node, focusables = context._tmModalFocusables(ov); focusables[focusables.length - 1].focus(); assert(key('Tab').prevented); assert.equal(document.activeElement, focusables[0]); assert(key('Tab', true).prevented); assert.equal(document.activeElement, focusables[focusables.length - 1]); context.closeGenericModal();
});
check('showPrompt on a formal panel: cancel=null, submit=value, no delayed focus theft', () => {
  const got = []; drafts[2].focus(); context.showPrompt('御批', '原批', v => got.push(v)); const ov = context._tmTopModalLayer().node; assert(Number(ov.style.zIndex) > zFormal); assert.equal(document.activeElement.tagName, 'INPUT'); key('Escape'); assert.deepEqual(got, [null]); assert.equal(document.activeElement, drafts[2]);
  context.showPrompt('案卷命名', '新卷', v => got.push(v)); const next = context._tmTopModalLayer().node; next.querySelector('.bt.bp').click(); assert.deepEqual(got, [null, '新卷']); assert.equal(document.activeElement, drafts[2]);
});
check('save manager creation and comparison are wired to the common layer', () => {
  const open = saves.slice(saves.indexOf('function openSaveManager()'), saves.indexOf('function _renderSaveManagerUI(')); assert(open.includes('_tmPresentModal(ov, closeSaveManager)'));
  const compare = saves.slice(saves.indexOf('function openSaveCompare()'), saves.indexOf('function _doSaveCompare()')); assert(compare.includes('_tmPresentModal(ov, closeCompare)')); assert(compare.includes('_tmCloseModalLayer(ov)'));
  const save = document.createElement('div'); save.className = 'generic-modal-overlay'; save.id = 'save-manager-overlay'; document.body.appendChild(save); drafts[0].focus(); context._tmPresentModal(save, context.closeSaveManager); assert(Number(save.style.zIndex) > zFormal); key('Escape'); assert(!save.isConnected); assert.equal(document.activeElement, drafts[0]);
});
check('save confirmation uses its higher base layer and cancels once', () => {
  let cancel = 0; drafts[0].focus(); context.showScrollConfirm({ title: '请再斟酌', onCancel: () => { cancel++; } }); const modal = context._tmTopModalLayer().node; assert(Number(modal.style.zIndex) > zRice); key('Escape'); assert.equal(cancel, 1); assert.equal(document.activeElement, drafts[0]); assert.equal(legacyEsc, 0);
});
check('closing modal never closes formal surface or clears any edict category', () => {
  assert.equal(document.getElementById('tm-action-edict-overlay'), formal); assert.deepEqual(drafts.map(n => n.value), draftValues); assert.equal(context.GM, sourceState); assert.equal(context._tmModalLayers.length, 0);
});
console.log('[smoke-modal-layer-focus] PASS ' + passed + ' cases; CSS formal=' + zFormal + ', generic=' + zGeneric + '; detached DOM only');
