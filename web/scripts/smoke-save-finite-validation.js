'use strict';
// 读档数值校验：新写法（不逐值拼路径、坐标类小数组就地检查、Set 去重）与旧写法逐项等价。
// 旧写法原样嵌在这里当参照：随机结构下两版必须同样通过，或报出完全相同的非法路径。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'tm-save-world-validation.js'), 'utf8');
function slice(text, marker) {
  const start = text.indexOf(marker);
  assert(start >= 0, 'missing ' + marker);
  let at = text.indexOf('{', start), depth = 0;
  for (; at < text.length; at++) {
    if (text[at] === '{') depth++;
    else if (text[at] === '}' && --depth === 0) return text.slice(start, at + 1);
  }
  throw new Error('unterminated ' + marker);
}
const REFERENCE = `function _tmValidateFiniteWorldNumbers(root, label) {
  var stack = [{ value: root, path: label }];
  var seen = typeof WeakSet === 'function' ? new WeakSet() : null;
  while (stack.length) {
    var current = stack.pop();
    var value = current.value;
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw new Error('存档数值非法: ' + current.path);
      continue;
    }
    if (!value || typeof value !== 'object') continue;
    if (seen) { if (seen.has(value)) continue; seen.add(value); }
    var keys = Object.keys(value);
    for (var i = 0; i < keys.length; i++) stack.push({ value: value[keys[i]], path: current.path + '.' + keys[i] });
  }
}`;
function load(code) {
  // 与 smoke-runtime-save-consistency 相同的最小沙箱
  const ctx = { Number, Object, Array, String, Error, WeakSet, JSON };
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  return ctx._tmValidateFiniteWorldNumbers;
}
const current = load(slice(source, 'function _tmValidateFiniteWorldNumbers('));
const reference = load(REFERENCE);
function outcome(fn, value) {
  try { fn(value, 'GM'); return 'ok'; } catch (e) { return e.message; }
}

// 可复现的伪随机数
let seed = 20260924;
function rand() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
const BAD = [NaN, Infinity, -Infinity];
function build(depth, pool) {
  const r = rand();
  if (depth <= 0 || r < 0.25) {
    const s = rand();
    if (s < 0.6) return rand() < 0.02 ? BAD[Math.floor(rand() * 3)] : Math.round(rand() * 1e6) / 100;
    if (s < 0.75) return '名' + Math.floor(rand() * 100);
    if (s < 0.85) return null;
    return rand() < 0.5;
  }
  if (r < 0.45) {   // 坐标对/小数组
    return Array.from({ length: 1 + Math.floor(rand() * 4) }, () => (rand() < 0.03 ? BAD[Math.floor(rand() * 3)] : rand() * 100));
  }
  if (r < 0.55 && pool.length) return pool[Math.floor(rand() * pool.length)];   // 共享引用
  const node = r < 0.75 ? [] : {};
  pool.push(node);
  const n = 1 + Math.floor(rand() * 5);
  for (let i = 0; i < n; i++) {
    const child = build(depth - 1, pool);
    if (Array.isArray(node)) node.push(child); else node['k' + i] = child;
  }
  if (rand() < 0.05 && pool.length > 1) {   // 循环引用
    const back = pool[Math.floor(rand() * pool.length)];
    if (Array.isArray(node)) node.push(back); else node.back = back;
  }
  return node;
}

let cases = 0, failures = 0, clean = 0;
for (let i = 0; i < 4000; i++) {
  const value = build(6, []);
  const expected = outcome(reference, value);
  const actual = outcome(current, value);
  cases++;
  if (expected === 'ok') clean++;
  if (expected !== actual) {
    failures++;
    if (failures <= 3) console.error('MISMATCH #' + i + '\n  reference: ' + expected + '\n  current:   ' + actual);
  }
}
assert.equal(failures, 0, failures + ' / ' + cases + ' 个随机结构的结果与旧写法不一致');
assert(clean > 400 && cases - clean > 400, '随机样本须同时覆盖通过与报错：通过 ' + clean + ' / ' + cases);

// 几个典型场景
assert.equal(outcome(current, { mapData: { regions: [{ polygons: [[[1, 2], [3, NaN]]] }] } }), '存档数值非法: GM.mapData.regions.0.polygons.0.1.1');
assert.equal(outcome(current, { a: 1, b: [Infinity, 2], c: { d: -Infinity } }), outcome(reference, { a: 1, b: [Infinity, 2], c: { d: -Infinity } }));
const shared = [1, 2, NaN];
assert.equal(outcome(current, { x: shared, y: { z: shared } }), outcome(reference, { x: shared, y: { z: shared } }));
const loop = { n: 1 }; loop.self = loop;
assert.equal(outcome(current, loop), 'ok');

console.log('PASS cases=' + cases + ' clean=' + clean + ' rejected=' + (cases - clean));
