'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const acorn = require('acorn');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
let passed = 0;
function test(name, run) { run(); passed++; console.log('PASS ' + name); }
function fixture(conf = {}) {
  class Element {
    constructor(tag) { this.tagName = tag; this.children = []; this.style = {}; this.attributes = {}; this.events = {}; this.value = ''; this.classList = { remove() {} }; }
    appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
    append(...children) { children.forEach(child => this.appendChild(child)); }
    replaceChildren() { this.children.forEach(child => { child.parentNode = null; }); this.children = []; }
    setAttribute(key, value) { this.attributes[key] = String(value); }
    addEventListener(type, fn) { (this.events[type] ||= []).push(fn); }
    fire(type) { (this.events[type] || []).forEach(fn => fn({ target: this })); }
    get isConnected() { return this.connected === true || !!(this.parentNode && this.parentNode.isConnected); }
  }
  const host = new Element('div'); host.id = 's-call-budget-controls'; host.connected = true;
  const overlay = new Element('div'), storage = {}, notices = []; let saved, saveCount = 0, primaryReads = 0;
  function walk(node) { return [node, ...node.children.flatMap(walk)]; }
  const document = { createElement: tag => new Element(tag), querySelectorAll: () => [],
    getElementById: id => id === 'settings-bg' ? overlay : walk(host).find(node => node.id === id) || null };
  const c = vm.createContext({ console, document, P: { conf: JSON.parse(JSON.stringify(conf)), ai: {} },
    localStorage: { getItem: key => storage[key] || null, setItem: (key, value) => { storage[key] = value; } },
    _sDeviceSettingsReady: () => true, _sApplyPrimaryApiFields() { primaryReads++; },
    toast: text => notices.push(text), saveP() { saved = JSON.parse(JSON.stringify(c.P.conf)); saveCount++; } });
  c.window = c; c._$ = id => document.getElementById(id);
  for (const file of ['tm-call-retry-policy.js', 'tm-call-budget-settings.js']) vm.runInContext(read(file), c, { filename: file });
  for (const [file, name] of [['tm-patches.js', 'sSaveAll'], ['tm-player-settings.js', 'closeSettings']]) {
    const src = read(file), node = acorn.parse(src, { ecmaVersion: 'latest' }).body.find(n => n.type === 'FunctionDeclaration' && n.id.name === name);
    assert(node, name); vm.runInContext(src.slice(node.start, node.end), c, { filename: file });
  }
  c.TM.CallBudgetSettings.mount();
  return { c, host, walk, notices, input: () => document.getElementById('s-secondary-api-retry-count'),
    saved: () => saved, saveCount: () => saveCount, primaryReads: () => primaryReads };
}

test('performance retry section defaults to one extra attempt without mutating preferences', () => {
  const f = fixture(); assert.equal(f.input().value, '1');
  assert.equal(f.input().attributes['aria-label'], '次要 API 失败后重试次数');
  assert.equal(f.input().min, '0'); assert.equal(f.input().max, '20');
  assert.equal(f.c.P.conf.aiSecondaryRetryCount, undefined);
  assert(f.walk(f.host).some(node => node.textContent === '最多尝试 2 次'));
  assert(f.walk(f.host).some(node => node.attributes['data-call-retry-id'] === '*'));
  const source = read('tm-patches.js'), position = source.indexOf('id="s-call-budget-controls"');
  assert(source.slice(position - 160, position).includes('性能·成本控制'));
});

test('save-all commits zero and a chosen value; reopening displays the saved choice', () => {
  const f = fixture({ aiCallRetryOverrides: { sc1: 4 } });
  for (const value of [0, 7, 20]) {
    f.input().value = String(value); f.input().fire('input'); f.c.sSaveAll();
    assert.equal(f.saved().aiSecondaryRetryCount, value);
    assert.equal(f.c.P.conf.aiCallRetryOverrides.sc1, 4);
    f.c.closeSettings(); f.c.TM.CallBudgetSettings.mount(); assert.equal(f.input().value, String(value));
  }
  assert.equal(f.saveCount(), 3);
});

test('closing settings discards the draft, including a reset-to-default draft', () => {
  const f = fixture({ aiSecondaryRetryCount: 5 });
  f.input().value = '0'; f.c.closeSettings();
  assert.equal(f.c.P.conf.aiSecondaryRetryCount, 5); assert.equal(f.saveCount(), 0);
  assert.equal(f.c.TM.CallBudgetSettings.readSecondaryRetries(), null);
  f.c.TM.CallBudgetSettings.mount(); assert.equal(f.input().value, '5');
  f.walk(f.host).find(node => node.tagName === 'button' && node.textContent === '恢复默认（1 次）').fire('click');
  assert.equal(f.input().value, '1'); assert.equal(f.c.P.conf.aiSecondaryRetryCount, 5);
  f.c.sSaveAll(); assert.equal(f.saved().aiSecondaryRetryCount, 1);
});

test('invalid retry counts abort save-all before any preference or API mutation', () => {
  for (const value of ['-1', '1.5', '21', 'nope', 'Infinity']) {
    const f = fixture({ aiSecondaryRetryCount: 3, aiCallRetryOverrides: { sc1: 4 } });
    f.input().value = value; assert.equal(f.c.sSaveAll(), false);
    assert.equal(f.c.P.conf.aiSecondaryRetryCount, 3); assert.equal(f.c.P.conf.aiCallRetryOverrides.sc1, 4);
    assert.equal(f.primaryReads(), 0); assert.equal(f.saveCount(), 0); assert.match(f.notices.at(-1), /0 至 20/);
  }
});

test('blank restores one retry and detached controls cannot overwrite preferences', () => {
  const f = fixture({ aiSecondaryRetryCount: 5 }); f.input().value = ''; f.c.sSaveAll();
  assert.equal(f.saved().aiSecondaryRetryCount, 1);
  f.host.connected = false; assert.equal(f.c.TM.CallBudgetSettings.readSecondaryRetries(), null);
});

console.log(passed + ' PASS / 0 FAIL');
