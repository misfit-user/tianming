#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const sources = ['tm-touch-gestures.js', 'tm-pause-fab.js'].map(name => ({
  name, code: fs.readFileSync(path.join(__dirname, '..', name), 'utf8')
}));
const POS_KEY = 'tm_pause_fab_pos';

// Execute both production modules with real capture/bubble ordering and a controlled clock.
function fixture(options = {}) {
  let now = 0, timerId = 0;
  const timers = new Map(), storage = new Map();
  if (options.saved) storage.set(POS_KEY, JSON.stringify(options.saved));
  class Event {
    constructor(type, init = {}) {
      Object.assign(this, { type, bubbles: true, cancelable: true, defaultPrevented: false }, init);
    }
    preventDefault() { if (this.cancelable) this.defaultPrevented = true; }
    stopPropagation() { this.stopped = true; }
  }
  class Target {
    constructor() { this.listeners = {}; }
    addEventListener(type, fn, opts) {
      (this.listeners[type] || (this.listeners[type] = [])).push({ fn, capture: opts === true || !!(opts && opts.capture) });
    }
    removeEventListener(type, fn, opts) {
      const capture = opts === true || !!(opts && opts.capture);
      this.listeners[type] = (this.listeners[type] || []).filter(item => item.fn !== fn || item.capture !== capture);
    }
    dispatchEvent(event) {
      event.target = this;
      const chain = [];
      for (let node = this; node; node = node.parentElement) chain.push(node);
      for (const capture of [true, false]) {
        for (const target of (capture ? chain.slice().reverse() : chain)) {
          for (const item of (target.listeners[event.type] || []).slice()) {
            if (item.capture === capture) item.fn.call(target, event);
          }
          if (event.stopped) return !event.defaultPrevented;
          if (!capture && !event.bubbles) break;
        }
      }
      return !event.defaultPrevented;
    }
  }
  const screen = { width: 1000, height: 600, scale: 0.5, left: 20, top: 30 };
  function rect(left, top, width, height) { return { left, top, width, height, right: left + width, bottom: top + height }; }
  class Element extends Target {
    constructor(tag) {
      super(); this.nodeType = 1; this.tagName = tag; this.children = []; this.style = {}; this.title = '';
      const classes = new Set();
      this.classList = {
        add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name),
        toggle(name, force) { if (force === undefined ? !classes.has(name) : force) classes.add(name); else classes.delete(name); }
      };
    }
    appendChild(child) {
      if (child.parentElement) child.parentElement.children = child.parentElement.children.filter(el => el !== child);
      this.children.push(child); child.parentElement = this; return child;
    }
    setAttribute(name, value) { this[name] = value; }
    closest(selector) {
      for (let el = this; el && el.nodeType === 1; el = el.parentElement) if ('#' + el.id === selector) return el;
      return null;
    }
    get offsetParent() { return document.body; }
    get offsetWidth() { return this === document.body ? screen.width : 48; }
    get offsetHeight() { return this === document.body ? screen.height : 48; }
    getBoundingClientRect() {
      if (this === document.body) return rect(screen.left, screen.top, screen.width * screen.scale, screen.height * screen.scale);
      if (this.id === 'tmf-tb-time') return rect(screen.left + 40 * screen.scale, screen.top + 20 * screen.scale, 140 * screen.scale, 40 * screen.scale);
      return rect(screen.left + (parseFloat(this.style.left) || 0) * screen.scale,
        screen.top + (parseFloat(this.style.top) || 0) * screen.scale, 48 * screen.scale, 48 * screen.scale);
    }
    setPointerCapture(id) { this.capturedPointer = id; }
    releasePointerCapture() { this.capturedPointer = null; }
  }
  const window = new Target(), document = new Target(), viewport = new Target();
  document.children = []; document.parentElement = window;
  document.head = new Element('head'); document.body = new Element('body');
  document.head.parentElement = document; document.body.parentElement = document;
  document.children.push(document.head, document.body);
  document.readyState = 'complete';
  document.createElement = tag => new Element(tag);
  document.getElementById = id => {
    function find(node) { if (node.id === id) return node; for (const child of node.children || []) { const found = find(child); if (found) return found; } return null; }
    return find(document);
  };
  function element(id, parent = document.body) { const el = new Element('div'); el.id = id; return parent.appendChild(el); }
  const game = element('G'), time = element('tmf-tb-time', game), timeChild = element('tmf-tb-time-main', time);
  const pause = element('pause-bg'), other = element('other');
  let hit = timeChild, opens = 0, closes = 0;
  document.elementFromPoint = () => hit;
  const schedule = (fn, delay, repeat = 0) => { const id = ++timerId; timers.set(id, { fn, at: now + delay, repeat }); return id; };
  const clear = id => timers.delete(id);
  function advance(ms) {
    const end = now + ms;
    for (let i = 0; i < 10000; i++) {
      const next = [...timers.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) { now = end; return; }
      const [id, timer] = next; now = timer.at; timers.delete(id);
      if (timer.repeat) timers.set(id, { ...timer, at: now + timer.repeat });
      timer.fn();
    }
    throw new Error('timer loop');
  }
  Object.assign(viewport, { offsetLeft: 0, offsetTop: 0, width: 540, height: 360 });
  Object.assign(window, {
    window, document, console, navigator: { maxTouchPoints: options.desktop ? 0 : 1 }, MouseEvent: Event,
    innerWidth: 540, innerHeight: 360, visualViewport: options.noVisualViewport ? undefined : viewport,
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    setTimeout: (fn, ms) => schedule(fn, ms), clearTimeout: clear, setInterval: (fn, ms) => schedule(fn, ms, ms),
    requestAnimationFrame: fn => schedule(fn, 16), getComputedStyle: el => ({ display: el.style.display || 'block' }),
    MutationObserver: class { observe() {} }, GM: { running: true }, renderGameState() {},
    openPause() { opens++; pause.classList.add('show'); }, closePause() { closes++; pause.classList.remove('show'); }
  });
  const context = vm.createContext(window);
  for (const source of sources) vm.runInContext(source.code, context, { filename: source.name });
  const button = document.getElementById('tm-pause-fab');
  function fire(target, type, init) { const event = new Event(type, init); target.dispatchEvent(event); return event; }
  function point(type, x, y, extra = {}) { return fire(button, type, { clientX: x, clientY: y, pointerId: 1, button: 0, ...extra }); }
  function drag(dx, dy) { point('pointerdown', 100, 100); point('pointermove', 100 + dx, 100 + dy); point('pointerup', 100 + dx, 100 + dy); }
  function touch(type, x = 100, y = 100, count = 1) {
    return fire(timeChild, type, { touches: Array.from({ length: count }, () => ({ clientX: x, clientY: y })) });
  }
  return { window, document, viewport, screen, game, time, timeChild, other, button, storage, advance, fire, point, drag, touch, element,
    pos: () => [parseFloat(button.style.left), parseFloat(button.style.top)], saved: () => JSON.parse(storage.get(POS_KEY) || 'null'),
    counts: () => [opens, closes], hit: el => { hit = el; } };
}

{
  const f = fixture({ desktop: true });
  assert.deepStrictEqual(f.pos(), [134, 66], 'initial anchor follows the scaled time bar');
  assert(f.time.title.includes('长按'), 'time bar advertises recovery');
  f.drag(30, 15);
  assert.deepStrictEqual(f.pos(), [194, 96], 'screen deltas convert back into stage coordinates');
  const saved = f.saved();
  assert.deepStrictEqual(fixture({ saved }).pos(), [194, 96], 'drag position survives reload');
  f.fire(f.button, 'click');
  assert.deepStrictEqual(f.counts(), [0, 0], 'drag click does not open the pause menu');
  f.advance(61); f.fire(f.button, 'click'); f.fire(f.button, 'click');
  assert.deepStrictEqual(f.counts(), [1, 1], 'ordinary button clicks retain pause toggle');
  f.fire(f.timeChild, 'click');
  assert.deepStrictEqual(f.saved(), saved, 'ordinary time click does not reset');
  assert(!f.fire(f.other, 'contextmenu').defaultPrevented, 'unrelated right click is untouched');
  assert(f.fire(f.timeChild, 'contextmenu').defaultPrevented, 'nested time label right click is handled');
  assert.strictEqual(f.saved(), null, 'reset clears persistence');
  assert.deepStrictEqual(f.pos(), [134, 66]);
  assert.deepStrictEqual(fixture().pos(), f.pos(), 'reset remains at initial position after reload');
  f.game.children = [];
  const replacement = f.element('tmf-tb-time', f.game), child = f.element('new-time', replacement);
  f.drag(20, 20); f.fire(child, 'contextmenu');
  assert.strictEqual(f.saved(), null, 'delegation survives time bar rerender');
}
{
  const f = fixture();
  f.point('pointerdown', 100, 100); f.point('pointermove', 140, 120);
  const duringDrag = f.pos();
  f.advance(1600); f.window.renderGameState(); f.window.TM.pauseFab.refresh();
  assert.deepStrictEqual(f.pos(), duringDrag, 'periodic refresh/render cannot interrupt an active drag');
  f.point('pointermove', 200, 200, { pointerId: 2 });
  assert.deepStrictEqual(f.pos(), duringDrag, 'another pointer cannot move the active drag');
  f.point('pointerup', 140, 120);
  f.drag(10000, 10000); assert.deepStrictEqual(f.pos(), [948, 548], 'bottom/right drag stops inside stage');
  f.drag(-10000, -10000); assert.deepStrictEqual(f.pos(), [4, 4], 'top/left drag stops inside stage');
  f.point('pointerdown', 100, 100); f.point('pointermove', 120, 120); f.point('pointercancel', 120, 120);
  assert(!f.button.classList.contains('tm-dragging'), 'pointer cancellation releases dragging state');
  assert.deepStrictEqual(f.pos(), [44, 44]);
  f.advance(1600); assert.deepStrictEqual(f.pos(), [44, 44], 'cancelled drag remains persisted');
}
{
  const f = fixture({ saved: { fx: 2, fy: -1 } });
  assert.deepStrictEqual(f.pos(), [948, 4], 'old offscreen positions repair on load');
  assert.deepStrictEqual(f.saved(), { fx: 0.948, fy: 4 / 600 }, 'repaired position is persisted');
  assert.deepStrictEqual(fixture({ saved: { fx: '0.5', fy: null } }).pos(), [134, 66], 'malformed persistence uses default');
  f.drag(10000, 10000);
  Object.assign(f.viewport, { offsetLeft: 70, offsetTop: 40, width: 200, height: 100 });
  f.fire(f.viewport, 'resize'); f.advance(16);
  assert.deepStrictEqual(f.pos(), [448, 168], 'visual viewport shrink keeps the entire button visible');
  Object.assign(f.viewport, { offsetLeft: 250, offsetTop: 180 });
  f.fire(f.viewport, 'scroll'); f.advance(16);
  assert.deepStrictEqual(f.pos(), [464, 304], 'visual viewport offset is respected');
  const plain = fixture({ noVisualViewport: true, saved: { fx: 1, fy: 1 } });
  Object.assign(plain.screen, { width: 400, height: 200, scale: 1 });
  plain.fire(plain.window, 'resize'); plain.advance(16);
  assert.deepStrictEqual(plain.pos(), [348, 148], 'window resize clamps without visualViewport support');
}
{
  const f = fixture();
  f.drag(50, 50); f.advance(61);
  f.touch('touchstart'); f.advance(499);
  assert(f.saved(), 'long press waits the full gesture threshold');
  f.advance(1); assert.strictEqual(f.saved(), null, 'real production long press bridge resets the button');
  assert.deepStrictEqual(f.pos(), [134, 66]);
  f.touch('touchend');
  assert(f.fire(f.timeChild, 'click').defaultPrevented, 'synthetic click after long press is swallowed by the bridge');
  assert.deepStrictEqual(f.counts(), [0, 0], 'long press does not toggle pause');
  f.drag(50, 50); f.advance(61); const saved = f.saved();
  f.touch('touchstart'); f.advance(200); f.touch('touchend'); f.advance(500);
  assert.deepStrictEqual(f.saved(), saved, 'short touch leaves the position alone');
  assert(!f.fire(f.timeChild, 'click').defaultPrevented, 'ordinary time click remains available');
  f.touch('touchstart'); f.touch('touchmove', 111); f.advance(600);
  assert.deepStrictEqual(f.saved(), saved, 'scrolling cancels long press');
  f.touch('touchstart'); f.touch('touchstart', 100, 100, 2); f.advance(600);
  assert.deepStrictEqual(f.saved(), saved, 'multiple fingers cancel long press');
  f.touch('touchstart'); f.touch('touchcancel'); f.advance(600);
  assert.deepStrictEqual(f.saved(), saved, 'cancelled touch cannot reset');
  f.game.style.display = 'none';
  assert(!f.fire(f.timeChild, 'contextmenu').defaultPrevented, 'hidden game cannot reset');
  f.game.style.display = 'block'; f.window.GM.running = false;
  assert(!f.fire(f.timeChild, 'contextmenu').defaultPrevented, 'stopped game cannot reset');
  assert.deepStrictEqual(f.saved(), saved);
}
console.log('[smoke-pause-fab-reposition] PASS: scaled drag bounds, persistence, viewport recovery, desktop reset and actual touch bridge');
