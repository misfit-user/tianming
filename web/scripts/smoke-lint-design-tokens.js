#!/usr/bin/env node
// smoke-lint-design-tokens.js — 美术宪法守卫自测
// 1. 计数口径：写死颜色、写死字号该计的计；令牌定义、var()、注释、design-ok 行不计
// 2. 棘轮判定：超基线或新文件带写死值即报，持平与下降不报
// 3. styles.css 的令牌表里有宪法 v1 定下的色板，值与宪法一致
// 4. 基线账本自洽：合计等于逐文件之和
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { MARKER, countText, compareToBaseline } = require(path.join(__dirname, 'lint-design-tokens.js'));

const WEB = path.resolve(__dirname, '..');

function count(text, kind) {
  const { colors, fontSizes } = countText(text, kind);
  return { colors, fontSizes };
}

// ---- 1. 计数口径 ----
const CASES = [
  ['.a{color:#fff;background:rgba(10,9,8,.5);border:1px solid var(--gold);font-size:12px}', 'css', { colors: 2, fontSizes: 1 },
    '样式表：#fff 与 rgba 数字各计 1，var() 不计，font-size:12px 计 1'],
  ['/* #ffffff font-size:12px */\n.b{color:var(--ink-200);font-size:var(--text-sm)}', 'css', { colors: 0, fontSizes: 0 },
    '样式表：注释和令牌引用都不计'],
  [':root{--gold-350:#c9a85f;--paper-100:#f6efda}\n.c{background:linear-gradient(#fff 0,#000 100%)}', 'css', { colors: 2, fontSizes: 0 },
    '令牌定义不计；渐变里的两个色各计 1'],
  ["el.style.fontSize = '13px'; el.style.color = '#c9a85f';", 'js', { colors: 1, fontSizes: 1 },
    '脚本：fontSize 赋值与颜色字符串各计 1'],
  ["// color:#fff font-size:12px\nvar x = 1; // '#fff'", 'js', { colors: 0, fontSizes: 0 },
    '脚本：注释行与行尾注释不计'],
  [`var icon = '<path fill="#a83228"/>'; // ${MARKER} 图标插画设色`, 'js', { colors: 0, fontSizes: 0 },
    '带 design-ok 的行不计'],
  ["var s = '&#123;' + 'index.html#fed' + 'hsl(40, 50%, 50%)' + 'rgba(var(--c),.5)';", 'js', { colors: 1, fontSizes: 0 },
    'HTML 实体和网址片段不算颜色；hsl 数字计 1，rgba(var()) 不计'],
  ["var css = '.d{font-size:0.75rem;color:#241d15;--silk:#f6efda}';", 'js', { colors: 1, fontSizes: 1 },
    '脚本里的样式字符串同样计数，令牌定义照旧不计']
];
CASES.forEach(([text, kind, expected, why]) => assert.deepStrictEqual(count(text, kind), expected, why));

// ---- 2. 棘轮判定 ----
const base = { 'a.js': { colors: 3, fontSizes: 2 } };
assert.deepStrictEqual(compareToBaseline(base, { 'a.js': { colors: 3, fontSizes: 2 } }), [], '持平不报');
assert.deepStrictEqual(compareToBaseline(base, { 'a.js': { colors: 1, fontSizes: 0 } }), [], '下降不报');
assert.strictEqual(compareToBaseline(base, { 'a.js': { colors: 4, fontSizes: 2 } }).length, 1, '颜色超基线报 1 条');
assert.strictEqual(compareToBaseline(base, { 'a.js': { colors: 4, fontSizes: 3 } }).length, 2, '颜色、字号都超各报 1 条');
assert.strictEqual(compareToBaseline(base, { 'new.js': { colors: 1, fontSizes: 0 } }).length, 1, '新文件带写死颜色即报');

// ---- 3. 宪法色板在 styles.css 的令牌表里 ----
const css = fs.readFileSync(path.join(WEB, 'styles.css'), 'utf8').replace(/\s+/g, '');
const PALETTE = {
  '--lacquer-0': '#0a0806', '--lacquer-1': '#1a1410', '--lacquer-2': '#241e18', '--lacquer-3': '#3d342a',
  '--paper-50': '#fffdf3', '--paper-100': '#f6efda', '--paper-200': '#ece1c6', '--paper-300': '#dcc99c',
  '--paper-ink-900': '#241d15', '--paper-ink-600': '#6e583a',
  '--gold-200': '#f0d597', '--gold-350': '#c9a85f', '--gold-450': '#a8833a',
  '--vermillion-350': '#d15c47', '--vermillion-450': '#a83228', '--vermillion-600': '#7a2018',
  '--ink-75': '#f4eadd'
};
Object.entries(PALETTE).forEach(([name, value]) => {
  assert.ok(css.includes(`${name}:${value};`), `styles.css 缺令牌 ${name}:${value}`);
});

// ---- 4. 基线账本自洽 ----
const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, 'arch-baselines', 'design-tokens.json'), 'utf8'));
const sum = Object.values(baseline.files).reduce(
  (acc, c) => ({ colors: acc.colors + c.colors, fontSizes: acc.fontSizes + c.fontSizes }),
  { colors: 0, fontSizes: 0 });
assert.deepStrictEqual(sum, baseline.totals, '基线合计应等于逐文件之和');
assert.strictEqual(baseline.config && baseline.config.marker, MARKER, '基线记录的豁免标记应与守卫一致');

console.log(`[smoke-lint-design-tokens] PASS 计数口径 ${CASES.length} 例、棘轮判定 5 例、宪法色板 ${Object.keys(PALETTE).length} 个令牌、基线合计自洽`);
