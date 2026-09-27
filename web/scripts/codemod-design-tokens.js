#!/usr/bin/env node
// scripts/codemod-design-tokens.js — 美术宪法还账工具：把写死颜色换成令牌（默认只换逐位相等的，--tolerance 并近似色）
//
// 令牌表以 styles.css 第一层（第一个 :root）为准，只认下面 PALETTE 里列的色板令牌。
// 墨阶只收抽屉里不反相的 50/75/100/150/200/250/350：300 起的墨阶在右栏抽屉（.gs-drawer）里整段反相
// 重定义，按值替换会在抽屉里翻色。
//
// 换法（值必须与令牌逐位相等，透明度原样保留）：
//   #c9a85f / rgb(201,168,95) / rgba(201,168,95,1)  → var(--gold-400)
//   #c9a85f80 / rgba(201,168,95,.52)                → rgba(var(--gold-400-rgb),.52)
//   var(--x,#c9a85f)（兜底值）                        → var(--x,var(--gold-400))
// 不动：url(...) 里的内容、注释、色板令牌自己的定义、#rrggbbaa 这类带透明度的十六进制
//      （换算成小数后不一定逐位相等）、带 design-ok 的行。
//
// 并档（第1刀 1b 起）：--tolerance N 时，值不相等的颜色按色差并进最近的色板令牌。色差用 CIELAB ΔE76，
// 半透明的按「色差 × 不透明度」折算（叠在漆底上实际看到的差大致按不透明度缩小），折算后不超过 N 才并。
// N=0（默认）只换逐位相等的；N≈2 肉眼分不出；再大就是逐屏过目才能定的细微变化（第1刀 1b 用 5）。
// 并档时字色属性（color 等）只落到字阶和金朱青上，不并进漆、纸这类底色令牌；
// 纯黑纯白（阴影、高光）默认也按色差并进漆黑、绢白，加 --keep-neutral 则只换逐位相等的。
//
// 用法（在 web/ 下）：
//   node scripts/codemod-design-tokens.js <文件...>                    # 只报告会换什么
//   node scripts/codemod-design-tokens.js <文件...> --write            # 写回
//   node scripts/codemod-design-tokens.js <文件...> --tolerance 5      # 连同色差不超过 5 的一起并
//   node scripts/codemod-design-tokens.js <文件...> --report out.json  # 逐个写法的去向与色差
//   node scripts/codemod-design-tokens.js <文件...> --font-px --write  # 第2刀：字号改成 calc(N * var(--tm-px, 1px))，跟着字号开关走
//
// .css 文件整份处理；.js 文件逐行处理（跳过注释行），只能拿来跑「整份都是样式字符串」的注入族，
// 如 phase8-formal-bridge-styles.js。夹着画布 fillStyle、SVG 属性或颜色运算的脚本不能跑：
// 那些地方不认 var()。

'use strict';

const fs = require('fs');
const path = require('path');

const WEB = path.resolve(__dirname, '..');
const MARKER = 'design-ok';

// 宪法色板（第1刀 1b 修订）：可被替换进去的令牌
const PALETTE = [
  'gold-100', 'gold-200', 'gold-300', 'gold-400', 'gold-450', 'gold-500', 'gold-550', 'gold-600',
  'vermillion-300', 'vermillion-400', 'vermillion-450', 'vermillion-500', 'vermillion-600',
  'celadon-300', 'celadon-350', 'celadon-400', 'celadon-500',
  'indigo-400', 'indigo-500', 'green-400', 'red-400', 'amber-400',
  'lacquer-0', 'lacquer-1', 'lacquer-2', 'lacquer-3', 'lacquer-4',
  'paper-50', 'paper-100', 'paper-200', 'paper-300', 'paper-ink-900', 'paper-ink-600',
  'ink-50', 'ink-75', 'ink-100', 'ink-150', 'ink-200', 'ink-250', 'ink-350'
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
  const entries = Object.entries(table).map(([name, rgb]) => ({ name, rgb, lab: toLab(rgb) }));
  return { table, byValue, entries };
}

/** sRGB → CIELAB（D65） */
function toLab(rgb) {
  const lin = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  const x = (lin[0] * 0.4124 + lin[1] * 0.3576 + lin[2] * 0.1805) / 0.95047;
  const y = lin[0] * 0.2126 + lin[1] * 0.7152 + lin[2] * 0.0722;
  const z = (lin[0] * 0.0193 + lin[1] * 0.1192 + lin[2] * 0.9505) / 1.08883;
  const f = (v) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

function deltaE(labA, labB) {
  return Math.hypot(labA[0] - labB[0], labA[1] - labB[1], labA[2] - labB[2]);
}

// 字色属性不并进底色令牌（漆、纸是面，字色该落到字阶或金朱青上，否则主题换色时字会跟着面走）
const TEXT_PROPS = /^(?:color|-webkit-text-fill-color|caret-color|text-decoration-color|-webkit-text-stroke-color)$/;
const SURFACE_TOKEN = /^(?:lacquer|paper)-\d+$/;

/** 某个颜色所在声明的属性名（往回找到 ; { 或行首为止） */
function propertyAt(text, offset) {
  const start = Math.max(text.lastIndexOf(';', offset), text.lastIndexOf('{', offset)) + 1;
  const m = /^\s*([-\w]+)\s*:/.exec(text.slice(start, offset));
  return m ? m[1].toLowerCase() : '';
}

// 只表状态的语义色（警、讯、安定之绿、危之红）不作并档去向：宪法规定语义色不作装饰，
// 近似的装饰金线并进 --amber-400，主题一改「警」色就会跟着变。逐位相等的照换。
const SEMANTIC_ONLY = /^(?:amber|indigo|green|red)-\d+$/;

/** 最近的色板令牌（并档用）；跳过只表状态的语义色，prop 为字色属性时再跳过底色令牌 */
function nearest(rgb, entries, prop = '') {
  const lab = toLab(rgb);
  const textRole = TEXT_PROPS.test(prop);
  let best = null;
  entries.forEach((e) => {
    if (SEMANTIC_ONLY.test(e.name)) return;
    if (textRole && SURFACE_TOKEN.test(e.name)) return;
    const d = deltaE(lab, e.lab);
    if (!best || d < best.dE) best = { name: e.name, dE: d };
  });
  return best;
}

// 一个颜色写法：#hex（前面须是分隔符）或 rgb()/rgba() 里直接写数字
const COLOR_RE = /(?<=^|[\s:,(='"`])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![0-9a-zA-Z_-])|\brgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([\d.]+%?)\s*)?\)/g;
const URL_RE = /url\((?:"[^"]*"|'[^']*'|[^)]*)\)/g;
// 色板令牌自己的定义不能换（会变成自引用）；组件级令牌（--rw-color: #b89a53 这类）照换
const PALETTE_DEF_RE = new RegExp(`--(?:${PALETTE.join('|')})(?:-rgb)?\\s*:[^;{}'"]*`, 'g');

/** 把一段样式文本里能换的颜色换掉；返回新文本与明细。palette 为 loadPalette 的返回值 */
function rewrite(text, palette, options = {}) {
  const tolerance = options.tolerance || 0;
  const { byValue, entries } = palette;
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
    // #rgba/#rrggbbaa 的透明度换算成小数后不一定逐位相等（1/255 的步长），这类不换
    if (match[0] === '#' && alphaText !== null) return match;
    let name = byValue[rgb.join(',')];
    let dE = 0;
    // 纯黑纯白（阴影、高光）是否并进漆黑、绢白由调用方决定：并了整屏暗部会整体偏暖一两级
    const neutral = /^(0,0,0|255,255,255)$/.test(rgb.join(','));
    if (!name && tolerance > 0 && !(neutral && options.keepNeutral)) {
      const alpha = alphaText === null ? 1 : (alphaText.endsWith('%') ? parseFloat(alphaText) / 100 : parseFloat(alphaText));
      const best = nearest(rgb, entries, propertyAt(text, offset));
      if (best.dE * alpha <= tolerance) {
        name = best.name;
        dE = best.dE;
      }
    }
    if (!name) return match;
    const replacement = alphaText === null ? `var(--${name})` : `rgba(var(--${name}-rgb),${alphaText})`;
    hits.push({ from: match, to: replacement, token: name, dE, alpha: alphaText === null ? 1 : alphaText });
    return replacement;
  });
  return { text: out, hits };
}

// 字号改成跟着字号开关走的像素（第2刀）：font-size:13px、font:700 13px/1 里的 13px → calc(13 * var(--tm-px, 1px))。
// --tm-px 由界面字号开关写在根上；没显式选档时不写，回落 1px，画面不变
const FONT_SIZE_PX_RE = /(font-size\s*:\s*)(\d+(?:\.\d+)?)px\b/gi;
const FONT_SHORTHAND_PX_RE = /(\bfont\s*:\s*(?:(?:\d{3}|bold|normal|italic|oblique)\s+)*)(\d+(?:\.\d+)?)px(?=\s*\/|\s)/gi;

function rewriteFontSizes(text) {
  const hits = [];
  const swap = (whole, head, num) => {
    const to = `${head}calc(${num} * var(--tm-px, 1px))`;
    hits.push({ from: whole, to });
    return to;
  };
  return { text: text.replace(FONT_SIZE_PX_RE, swap).replace(FONT_SHORTHAND_PX_RE, swap), hits };
}

/** 逐行处理：跳过注释行和 design-ok 行；样式表先把块注释整段保护起来。options.fontPx 时只换字号 */
function rewriteFile(fileText, kind, palette, options = {}) {
  const rewriteLine = options.fontPx ? (line) => rewriteFontSizes(line) : (line) => rewrite(line, palette, options);
  const allHits = [];
  if (kind === 'css') {
    const parts = fileText.split(/(\/\*[\s\S]*?\*\/)/);
    const rebuilt = parts.map((part) => {
      if (part.startsWith('/*')) return part;
      return part.split(/(\r?\n)/).map((line) => {
        if (/\r?\n/.test(line) || line.indexOf(MARKER) !== -1) return line;
        const r = rewriteLine(line);
        allHits.push(...r.hits);
        return r.text;
      }).join('');
    }).join('');
    return { text: rebuilt, hits: allHits };
  }
  const rebuilt = fileText.split(/(\r?\n)/).map((line) => {
    if (/\r?\n/.test(line) || line.indexOf(MARKER) !== -1) return line;
    if (/^\s*(\/\/|\/\*|\*)/.test(line)) return line;
    const r = rewriteLine(line);
    allHits.push(...r.hits);
    return r.text;
  }).join('');
  return { text: rebuilt, hits: allHits };
}

function main() {
  const args = process.argv.slice(2);
  const WRITE = args.includes('--write');
  const tolIdx = args.indexOf('--tolerance');
  const tolerance = tolIdx !== -1 ? parseFloat(args[tolIdx + 1]) || 0 : 0;
  const repIdx = args.indexOf('--report');
  const REPORT = repIdx !== -1 ? args[repIdx + 1] : '';
  const skip = new Set([tolIdx + 1, repIdx + 1].filter((i) => i > 0));
  const files = args.filter((a, i) => !a.startsWith('--') && !skip.has(i));
  if (!files.length) {
    console.error('用法：node scripts/codemod-design-tokens.js <文件...> [--write]');
    process.exit(1);
  }
  const palette = loadPalette(fs.readFileSync(path.join(WEB, 'styles.css'), 'utf8'));
  const fontPx = args.includes('--font-px');
  const report = {};
  files.forEach((rel) => {
    const abs = path.resolve(WEB, rel);
    const before = fs.readFileSync(abs, 'utf8');
    const kind = abs.endsWith('.css') ? 'css' : 'js';
    const { text, hits } = rewriteFile(before, kind, palette, { tolerance, keepNeutral: args.includes('--keep-neutral'), fontPx });
    report[rel] = hits;
    if (fontPx) {
      console.log(`${rel}: 字号换 ${hits.length} 处`);
      if (WRITE && text !== before) fs.writeFileSync(abs, text);
      return;
    }
    const byToken = {};
    hits.forEach((h) => {
      const token = /--([\w-]+?)(?:-rgb)?\)/.exec(h.to)[1];
      byToken[token] = (byToken[token] || 0) + 1;
    });
    console.log(`${rel}: 换 ${hits.length} 处 · ${Object.entries(byToken).sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t}×${n}`).join(' ')}`);
    if (WRITE && text !== before) fs.writeFileSync(abs, text);
  });
  if (REPORT) fs.writeFileSync(REPORT, JSON.stringify(report, null, 1));
}

if (require.main === module) main();

module.exports = { PALETTE, loadPalette, rewrite, rewriteFile, rewriteFontSizes, hexToRgb, toLab, deltaE, nearest, propertyAt };
