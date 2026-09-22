#!/usr/bin/env node
'use strict';
// Replay the real progress/loading modules with DOMTokenList's optional-force semantics.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const WEB = path.resolve(__dirname, '..');
let passed = 0;
function check(ok, label) { assert.ok(ok, label); passed++; }

function fixture() {
  let time = 0, nextTimer = 0;
  const timers = new Map(), ids = new Map();
  function node(tag) {
    const classes = new Set();
    const el = { tagName: tag, children: [], style: {setProperty(k, v) { this[k] = v; }}, textContent: '', offsetWidth: 100 };
    Object.defineProperty(el, 'id', { get() { return this._id; }, set(v) { this._id = v; ids.set(v, el); } });
    Object.defineProperty(el, 'className', { get() { return [...classes].join(' '); }, set(v) { classes.clear(); String(v).split(/\s+/).filter(Boolean).forEach(c => classes.add(c)); } });
    el.classList = {
      add(...cs) { cs.forEach(c => classes.add(c)); }, remove(...cs) { cs.forEach(c => classes.delete(c)); },
      contains(c) { return classes.has(c); },
      toggle(c, force) {
        // Passing undefined is equivalent to omitting the optional boolean argument in a browser.
        const on = force === undefined ? !classes.has(c) : !!force;
        if (on) classes.add(c); else classes.delete(c);
        return on;
      }
    };
    el.appendChild = c => { c.parentNode = el; el.children.push(c); return c; };
    el.removeChild = c => { el.children = el.children.filter(n => n !== c); c.parentNode = null; };
    Object.defineProperty(el, 'firstChild', { get() { return this.children[0]; } });
    el.querySelectorAll = selector => {
      const all = [];
      function walk(n) { for (const c of n.children) { if (selector[0] === '.' && c.classList.contains(selector.slice(1))) all.push(c); walk(c); } }
      walk(el); return all;
    };
    el.querySelector = selector => el.querySelectorAll(selector)[0] || null;
    Object.defineProperty(el, 'innerHTML', { set(html) {
      el.children = [];
      const stack = [el];
      for (const m of String(html).matchAll(/<(\/)?([a-z][\w-]*)([^>]*)>/gi)) {
        if (m[1]) { stack.pop(); continue; }
        const child = node(m[2]);
        const id = /\bid="([^"]*)"/.exec(m[3]), cls = /\bclass="([^"]*)"/.exec(m[3]);
        if (id) child.id = id[1];
        if (cls) child.className = cls[1];
        stack[stack.length - 1].appendChild(child); stack.push(child);
      }
    } });
    return el;
  }
  const document = { createElement: node, getElementById: id => ids.get(id) || null, head: node('head'), body: node('body'), hidden: false };
  for (const id of ['loading', 'loading-fill']) { const el = node('div'); el.id = id; document.body.appendChild(el); }
  function timer(fn, ms, repeat) { const id = ++nextTimer; timers.set(id, { fn, ms, repeat, at: time + ms }); return id; }
  const ctx = { document, console, Image: function() {}, matchMedia: () => ({matches:false}),
    setTimeout: (fn, ms) => timer(fn, ms, false), setInterval: (fn, ms) => timer(fn, ms, true),
    clearTimeout: id => timers.delete(id), clearInterval: id => timers.delete(id),
    _loadingMaxPct: 0, setLoadingCrawlCeil() {},
    showLoading(msg, pct) { ctx._loadingMaxPct = Math.max(ctx._loadingMaxPct, pct || 5); ids.get('loading-fill').style.width = ctx._loadingMaxPct + '%'; },
    hideLoading() { ctx._loadingMaxPct = 0; }
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const file of ['tm-endturn-progress.js', 'tm-endturn-loading.js']) vm.runInContext(fs.readFileSync(path.join(WEB, file), 'utf8'), ctx, {filename:file});
  function advance(ms) {
    const end = time + ms;
    while (true) {
      const next = [...timers].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      const [id, t] = next; time = t.at;
      if (t.repeat) t.at += t.ms; else timers.delete(id);
      t.fn();
    }
    time = end;
  }
  const root = () => ids.get('tm-etl');
  const visible = () => root().classList.contains('show') && !root().classList.contains('is-court-hidden');
  return {ctx, ids, root, visible, advance};
}

for (const [label, gm] of [
  ['absent GM', undefined], ['null GM', null], ['missing court flag', {_endTurnBusy:true}],
  ['false court flag', {_endTurnBusy:true, _isPostTurnCourt:false}],
  ['null court flag', {_endTurnBusy:true, _isPostTurnCourt:null}],
  ['zero court flag', {_endTurnBusy:true, _isPostTurnCourt:0}]
]) {
  const f = fixture(); if (gm !== undefined) f.ctx.GM = gm;
  f.ctx.showLoading('时移事去', 10);
  for (let i = 0; i < 55; i++) { f.advance(220); check(f.visible(), label + ': loading stays visible at sentinel tick ' + i); }
}

const f = fixture();
f.ctx.GM = {_endTurnBusy:true, _isPostTurnCourt:true, _pendingShijiModal:{courtDone:false}};
f.ctx.showLoading('时移事去', 10); f.advance(440);
check(!f.visible(), 'starting during court does not cover the court');
f.ctx.GM._pendingShijiModal.courtDone = true; f.advance(220);
check(f.visible(), 'court completion reveals the loading layer');
f.ctx.showLoading('AI推演中·已生成3.2k字', 52); f.advance(220);
check(f.ids.get('tm-etl-pct').textContent === '52%', 'visibility guard leaves real progress mirroring intact');
f.ctx.GM._pendingShijiModal.courtDone = false; f.advance(220);
check(!f.visible(), 'a new active court hides the layer');
f.ctx.hideLoading();
f.ctx.GM._pendingShijiModal.courtDone = true;
f.ctx.showLoading('史官成文', 67);
check(f.visible(), 'resume clears the old court-hidden class before the next timer tick');
f.ctx.GM._pendingShijiModal.courtDone = false; f.advance(220);
f.ctx.GM._endTurnBusy = false; f.ctx.hideLoading();
delete f.ctx.GM._isPostTurnCourt; f.ctx.GM._endTurnBusy = true;
f.ctx.showLoading('时移事去', 10);
check(f.visible(), 'next turn clears court visibility left by an aborted turn immediately');
f.ctx.showLoading('生成史记弹窗', 97); f.ctx.hideLoading();
check(f.ids.get('tm-etl-pct').textContent === '100%', 'normal completion still reaches 100 percent');
f.advance(700);
check(!f.root().classList.contains('show'), 'normal completion removes the layer');
check(!f.ids.get('loading').classList.contains('tm-etl-suppress'), 'normal completion releases the legacy loading layer');
console.log('[smoke-endturn-loading-visibility] PASS assertions=' + passed);
