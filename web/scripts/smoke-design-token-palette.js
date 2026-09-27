#!/usr/bin/env node
// smoke-design-token-palette.js — 美术宪法第1刀：令牌表只有一份真值
// 1. styles.css 第一层的色板令牌值互不相同，每个都有 -rgb 三元组且与十六进制一致
// 2. 四套主题（tm-theme-font.js）改到的色板令牌都同时改了 -rgb；「素纸」（默认）改的值与令牌表逐位相等，
//    即默认主题不再偷偷改令牌表（第1刀之前 --gold-400 表里写 #b89a53、运行时却是 #c9a85f）；
//    其余三套把语义色与纸以外的 29 个色板令牌全改到（第1刀 1c 之前只改 7 个，切主题时漆面和字不动）
// 3. 旧兜底（tm-shell-extras.js）与高对比主题块改色板令牌时也带着 -rgb
// 4. 常朝样式只作用在常朝舞台里：不许再写 :root 和 body（第1刀之前一进常朝就改了全局令牌与正文字体）
// 5. 御案主样式引用的 -rgb 三元组都有定义；不引用会在抽屉里反相的墨阶 --ink-300…900
//    （50/75/100/150/200/250/350 在抽屉里不反相，第1刀 1b 起作漆上字阶用）
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { PALETTE, loadPalette } = require(path.join(__dirname, 'codemod-design-tokens.js'));

const WEB = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(WEB, file), 'utf8');
const triplet = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(',');

// ---- 1. 令牌表 ----
const styles = read('styles.css');
const layer1 = /:root\s*\{([\s\S]*?)\}/.exec(styles)[1];
const decl = {};
layer1.replace(/--([\w-]+)\s*:\s*([^;]+);/g, (_, name, value) => { decl[name] = value.trim(); return ''; });
loadPalette(styles); // 缺令牌或重值会直接抛错
PALETTE.forEach((name) => {
  assert.ok(/^#[0-9a-f]{6}$/i.test(decl[name]), `--${name} 应为 6 位十六进制，实为 ${decl[name]}`);
  assert.strictEqual(decl[`${name}-rgb`], triplet(decl[name]), `--${name}-rgb 应为 ${triplet(decl[name])}`);
});

// ---- 2. 四套主题 ----
function themeCss(key) {
  const nodes = {};
  const store = {};
  const document = {
    readyState: 'complete',
    head: { appendChild: (el) => { nodes[el.id] = el; return el; } },
    getElementById: (id) => nodes[id] || null,
    createElement: () => ({ textContent: '' }),
    addEventListener: () => {}
  };
  const localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
  const window = {};
  vm.runInNewContext(read('tm-theme-font.js'), { window, document, localStorage, console }, { filename: 'tm-theme-font.js' });
  window.TMThemeFont.applyTheme(key, null, true);
  return nodes._tmThemeOverride.textContent;
}
function overrides(css) {
  const out = {};
  css.replace(/--([\w-]+)\s*:\s*([^;]+);/g, (_, name, value) => { out[name] = value.trim(); return ''; });
  return out;
}
const THEME_KEYS = ['plain', 'ink', 'vermillion', 'celadon'];
const THEMED = PALETTE.filter((name) => !/^(?:amber|indigo|green|red|paper)-/.test(name));
THEME_KEYS.forEach((key) => {
  const set = overrides(themeCss(key));
  const touched = PALETTE.filter((name) => name in set);
  if (key === 'plain') {
    assert.ok(touched.length >= 7, `默认主题应改到金、朱、青瓷七个色板令牌，实为 ${touched.length}`);
  } else {
    assert.deepStrictEqual(touched, THEMED, `主题 ${key} 应改到语义色与纸以外的全部 ${THEMED.length} 个色板令牌`);
  }
  touched.forEach((name) => {
    assert.strictEqual(set[`${name}-rgb`], triplet(set[name]), `主题 ${key} 改了 --${name} 却没同步 --${name}-rgb`);
    if (key === 'plain') {
      assert.strictEqual(set[name].toLowerCase(), decl[name].toLowerCase(), `默认主题「素纸」的 --${name} 应与令牌表一致`);
    }
  });
});

// ---- 3. 旧兜底与高对比块 ----
const shell = read('tm-shell-extras.js');
const shellApply = /window\._tmApplyTheme = function[\s\S]*?\n  \};/.exec(shell)[0];
const shellTouched = PALETTE.filter((name) => shellApply.includes(`--${name}:`));
assert.ok(shellTouched.length >= 7, `tm-shell-extras.js 兜底主题应改到七个色板令牌，实为 ${shellTouched.length}`);
shellTouched.forEach((name) => {
  assert.ok(shellApply.includes(`--${name}-rgb:`), `tm-shell-extras.js 兜底主题改 --${name} 须同步 -rgb`);
});
const hc = overrides(/\[data-theme="highcontrast"\]\s*\{([\s\S]*?)\}/.exec(styles)[1]);
PALETTE.filter((name) => name in hc).forEach((name) => {
  assert.strictEqual(hc[`${name}-rgb`], triplet(hc[name]), `高对比主题改了 --${name} 却没同步 --${name}-rgb`);
});

// ---- 4. 常朝样式不外溢 ----
const changchao = read('tm-chaoyi-changchao.css').replace(/\/\*[\s\S]*?\*\//g, '');
assert.ok(!/(^|[}\s,]):root\b/.test(changchao), 'tm-chaoyi-changchao.css 不许写 :root（令牌放在 .cy-stage 上）');
assert.ok(!/(^|[}\s,])body\s*[{,]/.test(changchao), 'tm-chaoyi-changchao.css 不许写 body（正文字体字号放在 .cy-stage 上）');
assert.ok(/\.cy-stage\s*\{[^}]*--gold-400\s*:/.test(changchao), '常朝自己的色板应挂在 .cy-stage 上');

// ---- 5. 御案主样式 ----
const formal = read('phase8-formal-bridge-styles.js');
const rgbRefs = new Set([...formal.matchAll(/var\(--([\w-]+)-rgb\)/g)].map((m) => m[1]));
rgbRefs.forEach((name) => assert.ok(decl[`${name}-rgb`], `御案主样式引用了未定义的 --${name}-rgb`));
assert.ok(!/var\(--ink-[3-9]00(?:-rgb)?\)/.test(formal), '御案主样式不该引用墨阶 --ink-300…900（右栏抽屉里整段反相）');

console.log(`[smoke-design-token-palette] PASS 色板 ${PALETTE.length} 个令牌与三元组一致、三套主题各改 ${THEMED.length} 个且默认主题与令牌表一致、常朝不外溢、御案引用 ${rgbRefs.size} 种三元组均有定义`);
