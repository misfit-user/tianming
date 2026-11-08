#!/usr/bin/env node
// smoke-party-stance-string.js - 党派 policyStance 写成一句话（晚唐剧本 8/8）时，廷议两处不再抛错。
//
// 老写法把它当数组：起议站班算议题立场时 .map 抛 TypeError，整场廷议起不来；
// 生成发言提示时 .slice().join 同样抛错。数组写法（天启、绍宋）的软匹配不能变。

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

function fakeEl() {
  return {
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    style: { cssText: '' },
    appendChild(c) { return c; },
    removeChild(c) { return c; },
    insertBefore(c) { return c; },
    setAttribute() {},
    getAttribute() { return null; },
    addEventListener() {},
    removeEventListener() {},
    querySelector() { return fakeEl(); },
    querySelectorAll() { return []; },
    children: [],
    childNodes: [],
    firstChild: null,
    parentNode: null,
    innerHTML: '',
    textContent: '',
    value: '',
    dataset: {},
    remove() {}
  };
}

let passed = 0;
function assert(cond, msg) {
  if (!cond) throw new Error('[assert] ' + msg);
  passed++;
}

const SENTENCE = '主张藩镇自守，反对中央削藩，与神策军素有龃龉';
const sandbox = {
  console, setTimeout, clearTimeout, setInterval, clearInterval,
  Math, Date, JSON, RegExp, Error, Promise,
  Array, Object, String, Number, Boolean,
  parseInt, parseFloat, isNaN, isFinite,
  document: {
    getElementById: () => fakeEl(),
    querySelector: () => fakeEl(),
    querySelectorAll: () => [],
    addEventListener() {},
    createElement: () => fakeEl(),
    body: fakeEl(),
    head: fakeEl(),
    readyState: 'complete'
  },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  navigator: { userAgent: 'node' },
  performance: { now: () => Date.now() },
  fetch: () => Promise.reject(new Error('no fetch')),
  alert() {}, confirm: () => true, prompt: () => null,
  HTMLElement: function () {}, Event: function () {}, requestAnimationFrame: (cb) => setTimeout(cb, 16),
  _ty2_enterDecide() {},
  escHtml: (v) => String(v == null ? '' : v),
  addCYBubble() {}, addEB() {}, toast() {}, closeChaoyi() {}, showLoading() {}, hideLoading() {},
  GM: {
    parties: [
      { name: '句子党', policyStance: SENTENCE },
      { name: '数组党', policyStance: ['开海禁', '反加派'] },
      { name: '无纲党' },
      { name: '空串党', policyStance: '' }
    ]
  }
};
sandbox.window = sandbox;
sandbox.global = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

function load(file) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox, { filename: file });
}

load('tm-engine-constants.js');
load('tm-class-engine.js');
load('tm-party-goals.js');
load('tm-tinyi-v3-persona.js');
load('tm-tinyi-v3.js');
load('tm-tinyi-v3-edict-personnel.js');
load('tm-tinyi-v3-parties.js');

const stanceOf = sandbox._ty3_partyStanceOnTopic;
assert(typeof stanceOf === 'function', '内核缺 _ty3_partyStanceOnTopic');

// ---------- 起议站班算议题立场 ----------
assert(stanceOf('句子党', '议军饷如何筹措') === 'neutral', '一句话的立场：议题不沾边时中立，且不抛错');
assert(stanceOf('句子党', '议' + SENTENCE) === 'support', '一句话的立场：议题里出现这句话算支持');
assert(stanceOf('无纲党', '议军饷') === 'neutral', '没写立场：中立');
assert(stanceOf('空串党', '议军饷') === 'neutral', '空串立场：中立');
// 数组写法的软匹配不变
assert(stanceOf('数组党', '议开海禁之事') === 'support', '数组立场：关键字命中算支持');
assert(stanceOf('数组党', '议加派辽饷') === 'oppose', '数组立场：「反×」命中算反对');
assert(stanceOf('数组党', '议军饷') === 'neutral', '数组立场：不沾边中立');

// ---------- 生成发言提示：内核那一句单独取出来按真字节跑（整段函数要起一局才进得去） ----------
const src = fs.readFileSync(path.join(ROOT, 'tm-chaoyi-tinyi.js'), 'utf8');
const m = src.match(/var _ps = [^\n]*_partyObj\.policyStance[^\n]*;/);
assert(m, 'tm-chaoyi-tinyi.js 里找不到取党派立场的那一句');
const psOf = (party) => vm.runInNewContext(`${m[0]} _ps;`, { _partyObj: party, Array, String });
assert(psOf({ policyStance: SENTENCE }) === SENTENCE, '发言提示：一句话原样读');
assert(psOf({ policyStance: ['甲', '乙'] }) === '甲·乙', '发言提示：数组照旧连写');
assert(psOf({ policyStance: ['一', '二', '三', '四', '五', '六'] }) === '一·二·三·四·五', '发言提示：数组照旧取前五');
assert(psOf({}) === '', '发言提示：没写立场为空');

console.log(`[smoke-party-stance-string] PASS ${passed} assertions`);
