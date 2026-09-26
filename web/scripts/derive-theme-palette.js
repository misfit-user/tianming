#!/usr/bin/env node
// scripts/derive-theme-palette.js — 美术宪法第1刀 1c：由主题锚点推出整套色阶（2026-09-26）
//
// 设置里的四套主题（tm-theme-font.js 的 THEMES）各自只定了几个锚点：底、面、字，金、朱各三档，青一档。
// 御案样式引用的色板令牌有 29 个（语义色与纸不算），主题只改锚点那 7 个的话，切主题时金线一半变一半不变，
// 漆面和字纹丝不动。这里按「素纸」各档的深浅关系把其余 22 个推出来，写进 tm-theme-font.js 的 THEME_TOKENS：
//   金、朱、青（有彩）：在 LCh 里按锚点插值，明度平移、彩度按比例、色相转角
//   漆、漆上字（近中性）：明度同上，色偏按锚点的 a/b 差整体平移；比最暗锚点还暗的按明度比例收，阴影不发蓝发红
//   锚点本身原样落回；比两端锚点更亮或更暗的，明度按比例收向 100 或 0，不越界
// 语义色（警、讯、成、败）与纸不随主题。「素纸」就是令牌表的默认值，不用推。
//
// 用法（在 web/ 下）：
//   node scripts/derive-theme-palette.js           # 列出各主题推出的值
//   node scripts/derive-theme-palette.js --check   # 核对 tm-theme-font.js 里的 THEME_TOKENS 与锚点是否一致
//   node scripts/derive-theme-palette.js --write   # 改了锚点后重写 THEME_TOKENS

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { PALETTE, loadPalette, toLab } = require('./codemod-design-tokens');

const WEB = path.resolve(__dirname, '..');
const THEME_FILE = path.join(WEB, 'tm-theme-font.js');
const BLOCK_START = '// <derive-theme-palette>';
const BLOCK_END = '// </derive-theme-palette>';
const DEFAULT_THEME = 'plain';

// applyTheme 直接从 pal 字段出的 7 个令牌（锚点），不进 THEME_TOKENS
const PAL_TOKENS = {
  'gold-500': 'gold1', 'gold-400': 'gold2', 'gold-300': 'gold3',
  'vermillion-500': 'verm1', 'vermillion-400': 'verm2', 'vermillion-300': 'verm3',
  'celadon-400': 'cela'
};
const FAMILIES = [
  { members: /^gold-\d+$/, chromatic: true, anchors: ['gold1', 'gold2', 'gold3'] },
  { members: /^vermillion-\d+$/, chromatic: true, anchors: ['verm1', 'verm2', 'verm3'] },
  { members: /^celadon-\d+$/, chromatic: true, anchors: ['cela'] },
  { members: /^lacquer-\d+$/, chromatic: false, anchors: ['bg', 'surface'] },
  { members: /^ink-\d+$/, chromatic: false, anchors: ['fg'] }
];

const toHex = (rgb) => '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('');
const hexLab = (hex) => toLab([1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)));

/** Lab → #rrggbb（D65，与 codemod-design-tokens.js 的 toLab 互逆，越界的分量截到 0…255） */
function fromLab([L, a, b]) {
  const fy = (L + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  const inv = (t) => (t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787);
  const X = inv(fx) * 0.95047;
  const Y = inv(fy);
  const Z = inv(fz) * 1.08883;
  const lin = [
    3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z,
    -0.9692660 * X + 1.8760108 * Y + 0.0415560 * Z,
    0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z
  ];
  return toHex(lin.map((c) => {
    const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    return Math.max(0, Math.min(255, Math.round(v * 255)));
  }));
}

const toLch = ([L, a, b]) => [L, Math.hypot(a, b), Math.atan2(b, a)];
const fromLch = ([L, C, h]) => [L, C * Math.cos(h), C * Math.sin(h)];
const lerp = (x, y, w) => x + (y - x) * w;
function wrapAngle(d) {
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d <= -Math.PI) d += 2 * Math.PI;
  return d;
}

/** 锚点对（素纸值 → 主题值），按素纸明度排好 */
function prepareAnchors(pairs) {
  return pairs.map(([plain, themed]) => {
    const p = hexLab(plain);
    const t = hexLab(themed);
    const pc = toLch(p);
    const tc = toLch(t);
    return {
      plain: plain.toLowerCase(), themed: themed.toLowerCase(), pL: p[0], tL: t[0],
      k: tc[1] / Math.max(pc[1], 0.5), dh: wrapAngle(tc[2] - pc[2]),
      da: t[1] - p[1], db: t[2] - p[2]
    };
  }).sort((x, y) => x.pL - y.pL);
}

/** 某个量在锚点之间按素纸明度插值，两端之外取端点 */
function interpolate(L, anchors, key) {
  const lo = anchors[0];
  const hi = anchors[anchors.length - 1];
  if (L <= lo.pL) return lo[key];
  if (L >= hi.pL) return hi[key];
  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i];
    const b = anchors[i + 1];
    if (L <= b.pL) return lerp(a[key], b[key], (L - a.pL) / (b.pL - a.pL));
  }
  return hi[key];
}

/** 明度：锚点之间平移；比最暗锚点还暗的按比例收向 0，比最亮锚点还亮的按比例收向 100 */
function mapLightness(L, anchors) {
  const lo = anchors[0];
  const hi = anchors[anchors.length - 1];
  if (L <= lo.pL) return L * (lo.tL / lo.pL);
  if (L >= hi.pL) return 100 - (100 - L) * (100 - hi.tL) / (100 - hi.pL);
  return L + interpolate(L, anchors, 'tL') - interpolate(L, anchors, 'pL');
}

function deriveChromatic(hex, anchors) {
  const hit = anchors.find((a) => a.plain === hex);
  if (hit) return hit.themed;
  const [L, C, h] = toLch(hexLab(hex));
  return fromLab(fromLch([
    mapLightness(L, anchors),
    C * interpolate(L, anchors, 'k'),
    h + interpolate(L, anchors, 'dh')
  ]));
}

function deriveNeutral(hex, anchors) {
  const hit = anchors.find((a) => a.plain === hex);
  if (hit) return hit.themed;
  const [L, a, b] = hexLab(hex);
  const scale = L < anchors[0].pL ? L / anchors[0].pL : 1;
  return fromLab([
    mapLightness(L, anchors),
    a + interpolate(L, anchors, 'da') * scale,
    b + interpolate(L, anchors, 'db') * scale
  ]);
}

/**
 * 推一套主题：themes 为 THEMES（含 pal），table 为令牌表 { 'gold-100': [r,g,b] }。
 * 返回 { 令牌名: '#rrggbb' }，只含 pal 以外的 22 个，顺序同 PALETTE。
 */
function deriveTheme(theme, plain, table) {
  const out = {};
  FAMILIES.forEach((family) => {
    const anchors = prepareAnchors(family.anchors.map((field) => [plain.pal[field], theme.pal[field]]));
    PALETTE.filter((name) => family.members.test(name) && !(name in PAL_TOKENS)).forEach((name) => {
      const hex = toHex(table[name]);
      out[name] = family.chromatic ? deriveChromatic(hex, anchors) : deriveNeutral(hex, anchors);
    });
  });
  return Object.fromEntries(PALETTE.filter((name) => name in out).map((name) => [name, out[name]]));
}

/** 跑一遍 tm-theme-font.js 取主题表（与 smoke-design-token-palette.js 同一做法） */
function loadThemes(source) {
  const nodes = {};
  const document = {
    readyState: 'complete',
    head: { appendChild: (el) => { nodes[el.id] = el; return el; } },
    getElementById: (id) => nodes[id] || null,
    createElement: () => ({ textContent: '' }),
    addEventListener: () => {}
  };
  const localStorage = { getItem: () => null, setItem: () => {} };
  const window = {};
  vm.runInNewContext(source, { window, document, localStorage, console }, { filename: 'tm-theme-font.js' });
  return window.TMThemeFont.themes;
}

function deriveAll(themes, table) {
  const plain = themes.find((t) => t.key === DEFAULT_THEME);
  const out = {};
  themes.filter((t) => t.key !== DEFAULT_THEME).forEach((t) => { out[t.key] = deriveTheme(t, plain, table); });
  return out;
}

/** THEME_TOKENS 的源码：每套主题按族分行，写成令牌定义的样子 */
function renderBlock(derived, indent) {
  const lines = [`${indent}var THEME_TOKENS = {`];
  const keys = Object.keys(derived);
  keys.forEach((key, i) => {
    lines.push(`${indent}  ${key}: ''`);
    FAMILIES.forEach((family) => {
      const decl = Object.entries(derived[key]).filter(([name]) => family.members.test(name)).map(([name, hex]) => `--${name}:${hex};`).join('');
      if (decl) lines.push(`${indent}    + '${decl}'`);
    });
    lines[lines.length - 1] += i < keys.length - 1 ? ',' : '';
  });
  lines.push(`${indent}};`);
  return lines;
}

/** 找出源码里 THEME_TOKENS 所在的行段（标记行之间，不含标记行） */
function locateBlock(lines) {
  const start = lines.findIndex((l) => l.includes(BLOCK_START));
  const end = lines.findIndex((l) => l.includes(BLOCK_END));
  if (start < 0 || end < 0 || end <= start) throw new Error(`tm-theme-font.js 里找不到 ${BLOCK_START} … ${BLOCK_END} 标记`);
  return { start, end, indent: /^\s*/.exec(lines[start])[0] };
}

/** 核对：返回 { ok, expected, actual }，expected/actual 为行段文本 */
function check(source = fs.readFileSync(THEME_FILE, 'utf8'), stylesText = fs.readFileSync(path.join(WEB, 'styles.css'), 'utf8')) {
  const derived = deriveAll(loadThemes(source), loadPalette(stylesText).table);
  const lines = source.split('\n');
  const { start, end, indent } = locateBlock(lines);
  const expected = renderBlock(derived, indent).join('\n');
  const actual = lines.slice(start + 1, end).join('\n');
  return { ok: expected === actual, expected, actual, derived };
}

function main() {
  const args = process.argv.slice(2);
  const source = fs.readFileSync(THEME_FILE, 'utf8');
  const result = check(source);
  if (args.includes('--write')) {
    if (result.ok) {
      console.log('[derive-theme-palette] THEME_TOKENS 已与锚点一致，无需重写');
      return;
    }
    const lines = source.split('\n');
    const { start, end } = locateBlock(lines);
    const next = lines.slice(0, start + 1).concat(result.expected.split('\n'), lines.slice(end)).join('\n');
    fs.writeFileSync(THEME_FILE, next);
    console.log(`[derive-theme-palette] 已重写 tm-theme-font.js 的 THEME_TOKENS（${Object.keys(result.derived).join('、')}）`);
    return;
  }
  if (args.includes('--check')) {
    if (!result.ok) {
      console.error('[derive-theme-palette] FAIL tm-theme-font.js 的 THEME_TOKENS 与锚点推出的值不一致；改了锚点请跑 --write');
      console.error('--- 应为 ---\n' + result.expected + '\n--- 实为 ---\n' + result.actual);
      process.exit(1);
    }
    console.log('[derive-theme-palette] PASS THEME_TOKENS 与锚点一致');
    return;
  }
  Object.entries(result.derived).forEach(([key, tokens]) => {
    console.log(`== ${key}`);
    Object.entries(tokens).forEach(([name, hex]) => console.log(`  --${name.padEnd(15)} ${hex}`));
  });
  console.log(result.ok ? '（与 tm-theme-font.js 一致）' : '（与 tm-theme-font.js 不一致，--write 可重写）');
}

if (require.main === module) main();

module.exports = { PAL_TOKENS, FAMILIES, fromLab, deriveTheme, deriveAll, loadThemes, check };
