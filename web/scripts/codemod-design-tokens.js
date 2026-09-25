#!/usr/bin/env node
// scripts/codemod-design-tokens.js — 美术宪法第1刀：把写死颜色换成令牌（只换值完全相等的，画面不变）
//
// 令牌表以 styles.css 第一层（第一个 :root）为准，只认下面 PALETTE 里列的色板令牌。
// 墨阶 --ink-50…900 不在其内：抽屉（.gs-drawer）里整段反相重定义了墨阶，按值替换会在抽屉里翻色。
//
// 换法（值必须与令牌逐位相等，透明度原样保留）：
//   #c9a85f / rgb(201,168,95) / rgba(201,168,95,1)  → var(--gold-400)
//   #c9a85f80 / rgba(201,168,95,.52)                → rgba(var(--gold-400-rgb),.52)
//   var(--x,#c9a85f)（兜底值）                        → var(--x,var(--gold-400))
// 不动：url(...) 里的内容、注释、色板令牌自己的定义、#rrggbbaa 这类带透明度的十六进制
//      （换算成小数后不一定逐位相等）、带 design-ok 的行。
//
// 用法（在 web/ 下）：
//   node scripts/codemod-design-tokens.js <文件...>           # 只报告会换什么
//   node scripts/codemod-design-tokens.js <文件...> --write   # 写回
//
// .css 文件整份处理；.js 文件逐行处理（跳过注释行），只能拿来跑「整份都是样式字符串」的注入族，
// 如 phase8-formal-bridge-styles.js。夹着画布 fillStyle、SVG 属性或颜色运算的脚本不能跑：
// 那些地方不认 var()。

'use strict';

const fs = require('fs');
const path = require('path');

const WEB = path.resolve(__dirname, '..');
const MARKER = 'design-ok';

// 宪法 v1 色板（第1刀修订）：可被替换进去的令牌
const PALETTE = [
  'gold-200', 'gold-300', 'gold-400', 'gold-450', 'gold-500', 'gold-550', 'gold-600',
  'vermillion-300', 'vermillion-400', 'vermillion-450', 'vermillion-500', 'vermillion-600',
  'celadon-300', 'celadon-350', 'celadon-400', 'celadon-500',
  'indigo-400', 'indigo-500', 'green-400', 'red-400', 'amber-400',
  'lacquer-0', 'lacquer-1', 'lacquer-2', 'lacquer-3',
  'paper-50', 'paper-100', 'paper-200', 'paper-300', 'paper-ink-900', 'paper-ink-600',
  'ink-75'
];

function hexToRgb(hex) {
  let h = hex.replace('#', '').toLowerCase();
  if (h.length === 3 || h.length === 4) h = h.split('').map((c) => c + c).join('');
  const rgb = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  const alpha = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
  return { rgb, alpha };
}

/** 读 styles.css 第一层令牌：{ 'gold-400': [201,168,95], ... }，只收 PALETTE 里的 */
function loadPalette(stylesText) {
  const first = /:root\s*\{([\s\S]*?)\}/.exec(stylesText);
  if (!first) throw new Error('styles.css 里找不到第一层 :root');
  const table = {};
  const re = /--([\w-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/g;
  let m;
  while ((m = re.exec(first[1]))) {
    if (PALETTE.includes(m[1])) table[m[1]] = hexToRgb(m[2]).rgb;
  }
  const missing = PALETTE.filter((name) => !table[name]);
  if (missing.length) throw new Error('styles.css 第一层缺令牌：' + missing.join(', '));
  const byValue = {};
  Object.entries(table).forEach(([name, rgb]) => {
    const key = rgb.join(',');
    if (byValue[key]) throw new Error(`色板重值：--${byValue[key]} 与 --${name} 同为 rgb(${key})`);
    byValue[key] = name;
  });
  return { table, byValue };
}

// 一个颜色写法：#hex（前面须是分隔符）或 rgb()/rgba() 里直接写数字
const COLOR_RE = /(?<=^|[\s:,(='"`])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![0-9a-zA-Z_-])|\brgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([\d.]+%?)\s*)?\)/g;
const URL_RE = /url\((?:"[^"]*"|'[^']*'|[^)]*)\)/g;
// 色板令牌自己的定义不能换（会变成自引用）；组件级令牌（--rw-color: #b89a53 这类）照换
const PALETTE_DEF_RE = new RegExp(`--(?:${PALETTE.join('|')})(?:-rgb)?\\s*:[^;{}'"]*`, 'g');

/** 把一段样式文本里能换的颜色换掉；返回新文本与明细 */
function rewrite(text, byValue) {
  // 不许动的区间：url(...)、色板令牌定义
  const guarded = [];
  [URL_RE, PALETTE_DEF_RE].forEach((re) => {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text))) guarded.push([m.index, m.index + m[0].length]);
  });
  const inGuard = (i) => guarded.some(([a, b]) => i >= a && i < b);
  const hits = [];
  const out = text.replace(COLOR_RE, (match, r, g, b, a, offset) => {
    if (inGuard(offset)) return match;
    let rgb;
    let alphaText = null;
    if (match[0] === '#') {
      const parsed = hexToRgb(match);
      rgb = parsed.rgb;
      if (parsed.alpha !== 1) alphaText = String(Math.round(parsed.alpha * 1000) / 1000);
    } else {
      rgb = [+r, +g, +b];
      if (a != null) {
        const value = a.endsWith('%') ? parseFloat(a) / 100 : parseFloat(a);
        if (value !== 1) alphaText = a; // 原样保留写法（.52 / 0.52 / 52%）
      }
    }
    const name = byValue[rgb.join(',')];
    if (!name) return match;
    // #rgba/#rrggbbaa 的透明度换算成小数后不一定逐位相等（1/255 的步长），这类不换
    if (match[0] === '#' && alphaText !== null) return match;
    const replacement = alphaText === null ? `var(--${name})` : `rgba(var(--${name}-rgb),${alphaText})`;
    hits.push({ from: match, to: replacement });
    return replacement;
  });
  return { text: out, hits };
}

/** 逐行处理：跳过注释行和 design-ok 行；样式表先把块注释整段保护起来 */
function rewriteFile(fileText, kind, byValue) {
  const allHits = [];
  if (kind === 'css') {
    const parts = fileText.split(/(\/\*[\s\S]*?\*\/)/);
    const rebuilt = parts.map((part) => {
      if (part.startsWith('/*')) return part;
      return part.split(/(\r?\n)/).map((line) => {
        if (/\r?\n/.test(line) || line.indexOf(MARKER) !== -1) return line;
        const r = rewrite(line, byValue);
        allHits.push(...r.hits);
        return r.text;
      }).join('');
    }).join('');
    return { text: rebuilt, hits: allHits };
  }
  const rebuilt = fileText.split(/(\r?\n)/).map((line) => {
    if (/\r?\n/.test(line) || line.indexOf(MARKER) !== -1) return line;
    if (/^\s*(\/\/|\/\*|\*)/.test(line)) return line;
    const r = rewrite(line, byValue);
    allHits.push(...r.hits);
    return r.text;
  }).join('');
  return { text: rebuilt, hits: allHits };
}

function main() {
  const args = process.argv.slice(2);
  const WRITE = args.includes('--write');
  const files = args.filter((a) => !a.startsWith('--'));
  if (!files.length) {
    console.error('用法：node scripts/codemod-design-tokens.js <文件...> [--write]');
    process.exit(1);
  }
  const { byValue } = loadPalette(fs.readFileSync(path.join(WEB, 'styles.css'), 'utf8'));
  files.forEach((rel) => {
    const abs = path.resolve(WEB, rel);
    const before = fs.readFileSync(abs, 'utf8');
    const kind = abs.endsWith('.css') ? 'css' : 'js';
    const { text, hits } = rewriteFile(before, kind, byValue);
    const byToken = {};
    hits.forEach((h) => {
      const token = /--([\w-]+?)(?:-rgb)?\)/.exec(h.to)[1];
      byToken[token] = (byToken[token] || 0) + 1;
    });
    console.log(`${rel}: 换 ${hits.length} 处 · ${Object.entries(byToken).sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t}×${n}`).join(' ')}`);
    if (WRITE && text !== before) fs.writeFileSync(abs, text);
  });
}

if (require.main === module) main();

module.exports = { PALETTE, loadPalette, rewrite, rewriteFile, hexToRgb };
