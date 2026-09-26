#!/usr/bin/env node
// smoke-codemod-design-tokens.js — 美术宪法还账工具自测（第1刀 1b）
// 1. 逐位相等：十六进制换 var()，半透明换 rgba(var(--x-rgb),a)，透明度写法原样保留
// 2. 不许动：url() 里、色板令牌自己的定义、#rrggbbaa、带 design-ok 的行、注释行
// 3. 容差并档：色差 × 不透明度不超过容差才并；半透明的比实色更容易并
// 4. 字色不并进底色令牌：color 属性离纸色再近也不落到 --paper-*，background 照常可以
// 5. 只表状态的语义色（警 amber、讯 indigo 等）不作并档去向，逐位相等的照换
'use strict';

const assert = require('assert');
const path = require('path');
const cm = require(path.join(__dirname, 'codemod-design-tokens.js'));

// 自带一张小色板，不依赖 styles.css 当前的值
function palette(table) {
  const rgb = {};
  Object.entries(table).forEach(([name, hex]) => { rgb[name] = cm.hexToRgb(hex).rgb; });
  return {
    table: rgb,
    byValue: Object.fromEntries(Object.entries(rgb).map(([name, v]) => [v.join(','), name])),
    entries: Object.entries(rgb).map(([name, v]) => ({ name, rgb: v, lab: cm.toLab(v) }))
  };
}
const PAL = palette({ 'gold-400': '#c9a85f', 'paper-200': '#ece1c6', 'ink-150': '#e0d3ab', 'lacquer-0': '#0a0806' });
const run = (text, tolerance = 0) => cm.rewrite(text, PAL, { tolerance }).text;

// ---- 1. 逐位相等 ----
assert.strictEqual(run('.a{color:#c9a85f}'), '.a{color:var(--gold-400)}', '实色换 var()');
assert.strictEqual(run('.a{border:1px solid rgba(201,168,95,.52)}'), '.a{border:1px solid rgba(var(--gold-400-rgb),.52)}', '半透明换三元组，.52 原样');
assert.strictEqual(run('.a{color:rgba(201,168,95,1)}'), '.a{color:var(--gold-400)}', '不透明度 1 当实色');
assert.strictEqual(run('.a{color:var(--x,#c9a85f)}'), '.a{color:var(--x,var(--gold-400))}', 'var() 的兜底值也换');

// ---- 2. 不许动 ----
assert.strictEqual(run('.a{background:url("x.svg#c9a85f")}'), '.a{background:url("x.svg#c9a85f")}', 'url() 里不动');
assert.strictEqual(run(':root{--gold-400:#c9a85f}'), ':root{--gold-400:#c9a85f}', '色板令牌自己的定义不动');
assert.strictEqual(run('.a{color:#c9a85f80}'), '.a{color:#c9a85f80}', '#rrggbbaa 不动');
const file = cm.rewriteFile("var a = '.a{color:#c9a85f}'; // design-ok\n// '.b{color:#c9a85f}'\nvar c = '.c{color:#c9a85f}';", 'js', PAL).text;
assert.strictEqual(file, "var a = '.a{color:#c9a85f}'; // design-ok\n// '.b{color:#c9a85f}'\nvar c = '.c{color:var(--gold-400)}';", 'design-ok 行与注释行不动');

// ---- 3. 容差并档 ----
// #d0ac62 离 --gold-400 约 ΔE 2.4：实色容差 2 不并、容差 3 并；半透明 .5 折算约 1.2，容差 2 就并
const dE = cm.nearest([208, 172, 98], PAL.entries).dE;
assert.ok(dE > 2 && dE < 3, `样例色差应在 2 与 3 之间，实为 ${dE.toFixed(2)}`);
assert.strictEqual(run('.a{color:#d0ac62}', 2), '.a{color:#d0ac62}', '实色超容差不并');
assert.strictEqual(run('.a{color:#d0ac62}', 3), '.a{color:var(--gold-400)}', '实色在容差内并');
assert.strictEqual(run('.a{border-color:rgba(208,172,98,.5)}', 2), '.a{border-color:rgba(var(--gold-400-rgb),.5)}', '半透明按不透明度折算后并');
assert.strictEqual(run('.a{color:#d0ac62}', 0), '.a{color:#d0ac62}', '容差 0 只换逐位相等的');

// ---- 4. 字色不并进底色令牌 ----
// #eadfbd 离 --paper-200 约 ΔE 3.7、离 --ink-150 约 5.4
assert.strictEqual(run('.a{background:#eadfbd}', 4), '.a{background:var(--paper-200)}', '底色可以并进纸色');
assert.strictEqual(run('.a{color:#eadfbd}', 4), '.a{color:#eadfbd}', '字色不并进纸色，最近的字阶又超容差，就不动');
assert.strictEqual(run('.a{color:#eadfbd}', 6), '.a{color:var(--ink-150)}', '字色只在字阶里找');
assert.strictEqual(cm.propertyAt('.a{color:#fff;background:#000}', 9), 'color', '认得颜色所在的属性');

// ---- 5. 语义色不作并档去向 ----
// #cdaa50 离 --amber-400 只有 ΔE 1.5、离 --gold-400 约 8.4：装饰金线不许并进「警」色
const SEM = palette({ 'gold-400': '#c9a85f', 'amber-400': '#c9a84c' });
const sem = (text, tolerance) => cm.rewrite(text, SEM, { tolerance }).text;
assert.strictEqual(sem('.a{border-color:#cdaa50}', 5), '.a{border-color:#cdaa50}', '近似语义色不并；离金色又超容差，就不动');
assert.strictEqual(sem('.a{border-color:rgba(205,170,80,.5)}', 5), '.a{border-color:rgba(var(--gold-400-rgb),.5)}', '半透明折算后在容差内，就并进金色而不是警色');
assert.strictEqual(sem('.a{color:#c9a84c}', 0), '.a{color:var(--amber-400)}', '语义色逐位相等照换');

console.log('[smoke-codemod-design-tokens] PASS 逐位相等 4 例、不许动 4 例、容差并档 5 例、字色不并底色 4 例、语义色 3 例');
