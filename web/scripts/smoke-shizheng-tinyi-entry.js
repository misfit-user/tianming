'use strict';
// Offline regression: real entry/session/energy functions; AI and layout are isolated.
const fs = require('fs'), path = require('path'), vm = require('vm');
const assert = require('node:assert/strict');
const ROOT = path.resolve(__dirname, '..');
function fixture() {
  const nodes = new Set(), notices = [], errors = [], timers = [], calls = { initial: 0, spend: 0 };
  function element(tag = 'div') {
    const n = { tagName: tag.toUpperCase(), id: '', className: '', style: {}, children: [], parentNode: null,
      value: '', checked: false, name: '', dataset: {}, disabled: false, textContent: '',
      appendChild(c) { c.remove(); this.children.push(c); c.parentNode = this; return c; },
      insertBefore(c, before) { c.remove(); const i = this.children.indexOf(before); this.children.splice(i < 0 ? 0 : i, 0, c); c.parentNode = this; return c; },
      remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(c => c !== this); this.parentNode = null; },
      contains(c) { return c === this || this.children.some(x => x.contains(c)); },
      addEventListener() {}, setAttribute(k, v) { this[k] = v; }, focus() {},
      querySelectorAll(q) { return [...nodes].filter(x => x !== this && this.contains(x) && matches(x, q)); },
      querySelector(q) { return this.querySelectorAll(q)[0] || null; },
      getClientRects() { return this.isConnected && this.style.display !== 'none' ? [{}] : []; }
    };
    n.classList = { add(...v) { n.className += ' ' + v.join(' '); }, contains(v) { return n.className.split(/\s+/).includes(v); }, remove(v) { n.className = n.className.split(/\s+/).filter(x => x !== v).join(' '); } };
    let html = '';
    Object.defineProperties(n, {
      isConnected: { get: () => n === body || !!(n.parentNode && n.parentNode.isConnected) },
      firstChild: { get: () => n.children[0] || null }, firstElementChild: { get: () => n.children[0] || null },
      innerHTML: { get: () => html, set(v) {
        html = String(v); n.children.forEach(c => { c.parentNode = null; }); n.children = [];
        for (const m of html.matchAll(/<([a-z][\w-]*)\b([^>]*)>/gi)) {
          const attrs = m[2]; if (!/\bid=|\bclass=|\bname=/.test(attrs)) continue;
          const c = element(m[1]); for (const a of attrs.matchAll(/\b(id|class|name|value)=["']([^"']*)["']/g)) c[a[1] === 'class' ? 'className' : a[1]] = a[2];
          c.checked = /\bchecked\b/.test(attrs); n.appendChild(c);
        }
      } }
    }); nodes.add(n); return n;
  }
  function matches(n, q) {
    if (q.includes(':checked') && !n.checked) return false;
    const id = q.match(/^#([\w-]+)/); if (id && n.id !== id[1]) return false;
    const cls = q.match(/^\.([\w-]+)/); if (cls && !n.classList.contains(cls[1])) return false;
    if (q.startsWith('input') && n.tagName !== 'INPUT') return false;
    const name = q.match(/\[name=["']([^"']+)["']\]/); if (name && n.name !== name[1]) return false;
    return true;
  }
  const body = element('body'), document = { body, createElement: element,
    getElementById: id => [...nodes].find(n => n.id === id && n.isConnected) || null,
    querySelectorAll: q => body.querySelectorAll(q), querySelector: q => body.querySelector(q), addEventListener() {} };
  const ctx = { document, console, Promise, setTimeout(fn) { timers.push(fn); }, clearTimeout() {},
    GM: { turn: 1, _energy: 100, _capital: '京城', chars: [{ name: '甲臣' }, { name: '乙臣' }], currentIssues: [{ id: 'issue', title: '试议', description: '待决政务' }] },
    P: { conf: {} }, CY: { open: false, phase: 'setup' },
    toast: s => notices.push(s), _dbg() {}, getRankLevel: () => 2, _isPlayerFactionChar: () => true,
    escHtml: s => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'),
    TM: { errors: { captureSilent: e => errors.push(e.message), capture: e => errors.push(e.message) } },
    getComputedStyle: n => ({ display: 'block', visibility: 'visible', ...n.style }) };
  ctx.window = ctx; ctx._$ = document.getElementById; ctx.findCharByName = name => ctx.GM.chars.find(c => c.name === name);
  vm.createContext(ctx);
  for (const file of ['tm-chaoyi.js', 'tm-chaoyi-tinyi.js', 'tm-shizheng-panel.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), ctx, { filename: file });
  const launch = fs.readFileSync(path.join(ROOT, 'tm-launch.js'), 'utf8');
  vm.runInContext(launch.slice(launch.indexOf('function _renderEnergyBar()'), launch.indexOf('function _cleanupOverlays()')), ctx);
  const spend = ctx._spendEnergy; ctx._spendEnergy = (...a) => { calls.spend++; return spend(...a); };
  ctx._ty2_relayout = () => {}; ctx._ty2_phaseInitialRound = async () => { calls.initial++; };
  return { ctx, document, calls, notices, errors, nodes,
    open() { ctx._shizhengConvene('issue'); timers.splice(0).forEach(fn => fn()); },
    queued() { return Array.from(ctx.GM._pendingTinyiTopics || []); } };
}
const tests = [];
const test = (name, run) => tests.push({ name, run });
test('direct entry mounts court and synchronously carries its queued topic', () => {
  const f = fixture(); f.ctx._shizhengConvene('issue');
  assert(f.document.getElementById('chaoyi-modal')); assert(f.document.getElementById('cy-body'));
  assert.equal(f.ctx.CY.open, true); assert.equal(f.ctx.CY.mode, 'tinyi');
  assert.match(f.document.getElementById('ty2-topic').value, /试议/);
  assert.equal(f.ctx._ty2_pendingMeta, f.queued()[0]); assert.equal(f.ctx.GM._energy, 100);
});
test('successful start charges exactly once and consumes only its topic', async () => {
  const f = fixture(); f.open(); const other = { topic: '另一题' }; f.ctx.GM._pendingTinyiTopics.push(other);
  await Promise.all([f.ctx._ty2_startSession(), f.ctx._ty2_startSession()]);
  assert.equal(f.ctx.GM._energy, 85); assert.equal(f.calls.spend, 1); assert.equal(f.calls.initial, 1);
  assert.equal(f.ctx.CY.phase, 'tinyi2'); assert(!f.document.getElementById('ty2-setup-bg'));
  assert.deepEqual(f.queued(), [other]); assert.equal(f.ctx._ty2_pendingMeta, null);
});
for (const missing of ['chaoyi-modal', 'cy-body', 'cy-footer', 'cy-topic', 'cy-input-row']) {
  test('missing ' + missing + ' keeps energy, setup and queue', async () => {
    const f = fixture(); f.open(); const q = f.queued(), meta = f.ctx._ty2_pendingMeta;
    const node = f.document.getElementById(missing); if (node) node.remove();
    await f.ctx._ty2_startSession(); assert.equal(f.ctx.GM._energy, 100); assert.equal(f.calls.spend, 0);
    assert(f.document.getElementById('ty2-setup-bg')); assert.deepEqual(f.queued(), q);
    assert.equal(f.ctx._ty2_pendingMeta, meta); assert.equal(f.calls.initial, 0); assert(f.notices.length);
  });
}
test('hidden court cannot charge', async () => {
  const f = fixture(); f.open(); const modal = f.document.getElementById('chaoyi-modal');
  if (modal) modal.style.display = 'none'; await f.ctx._ty2_startSession();
  assert.equal(f.ctx.GM._energy, 100); assert.equal(f.calls.spend, 0);
});
test('insufficient energy preserves form and metadata for retry', async () => {
  const f = fixture(); f.open(); f.ctx.GM._energy = 14; const q = f.queued(), meta = f.ctx._ty2_pendingMeta;
  await f.ctx._ty2_startSession(); assert.equal(f.ctx.GM._energy, 14);
  assert(f.document.getElementById('ty2-setup-bg')); assert.deepEqual(f.queued(), q); assert.equal(f.ctx._ty2_pendingMeta, meta);
  f.ctx.GM._energy = 100; await f.ctx._ty2_startSession(); assert.equal(f.ctx.GM._energy, 85); assert.equal(f.calls.initial, 1);
});
test('render failure keeps preparation; second attempt succeeds', async () => {
  const f = fixture(); f.open(); const render = f.ctx._ty2_render, q = f.queued();
  f.ctx._ty2_render = () => { throw Error('injected render failure'); };
  await f.ctx._ty2_startSession(); assert.equal(f.ctx.GM._energy, 100); assert.equal(f.calls.spend, 0);
  assert(f.document.getElementById('ty2-setup-bg')); assert.deepEqual(f.queued(), q); assert.equal(f.ctx.CY.phase, 'setup');
  f.ctx._ty2_render = render; await f.ctx._ty2_startSession(); assert.equal(f.ctx.GM._energy, 85); assert.equal(f.calls.initial, 1);
});
test('energy writer throwing after debit restores exact energy', async () => {
  const f = fixture(); f.open(); const spend = f.ctx._spendEnergy, q = f.queued();
  f.ctx._spendEnergy = (...a) => { spend(...a); throw Error('injected post-debit error'); };
  await f.ctx._ty2_startSession(); assert.equal(f.ctx.GM._energy, 100); assert.deepEqual(f.queued(), q);
  assert(f.document.getElementById('ty2-setup-bg')); assert.equal(f.calls.initial, 0);
});
test('validation keeps pending metadata and never charges', async () => {
  const f = fixture(); f.open(); const meta = f.ctx._ty2_pendingMeta;
  f.document.getElementById('ty2-topic').value = ''; await f.ctx._ty2_startSession();
  assert.equal(f.ctx._ty2_pendingMeta, meta); assert.equal(f.calls.spend, 0);
});
test('reopening setup does not duplicate either modal', () => {
  const f = fixture(); f.open(); f.open();
  for (const id of ['chaoyi-modal', 'ty2-setup-bg']) assert.equal([...f.nodes].filter(n => n.id === id && n.isConnected).length, 1);
  assert.equal(f.queued().length, 1); assert.equal(f.calls.spend, 0);
});
test('missing bootstrap leaves source overlay open and reports failure', () => {
  const f = fixture(); f.ctx.openChaoyi = undefined;
  const ov = f.document.createElement('div'); ov.id = 'shizheng-tasks-overlay'; f.document.body.appendChild(ov);
  f.open(); assert.equal(f.document.getElementById(ov.id), ov); assert(!f.document.getElementById('ty2-setup-bg'));
  assert.equal(f.calls.spend, 0); assert(f.notices.length);
});
test('missing setup on stale click cannot spend', async () => {
  const f = fixture(); await f.ctx._ty2_startSession(); assert.equal(f.calls.spend, 0);
});
test('frequency limit blocks direct entry', () => {
  const f = fixture(); f.ctx.GM._chaoyiCount = { 1: 2 }; f.open();
  assert(!f.document.getElementById('ty2-setup-bg')); assert.equal(f.calls.spend, 0);
});
async function main() {
  let failed = 0;
  for (const t of tests) { try { await t.run(); console.log('PASS ' + t.name); }
    catch (e) { failed++; console.error('FAIL ' + t.name + '\n' + e.stack); } }
  console.log(JSON.stringify({ suite: 'shizheng-tinyi-entry', total: tests.length, passed: tests.length - failed, failed }));
  if (failed) process.exitCode = 1;
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
module.exports = { fixture, main };
