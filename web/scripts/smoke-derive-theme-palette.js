#!/usr/bin/env node
// smoke-derive-theme-palette.js — 美术宪法第1刀 1c：主题的整套色阶由锚点推出
// 1. tm-theme-font.js 的 THEME_TOKENS 与锚点推出的值一致（改了锚点忘了跑 --write 会红）
// 2. 推法本身：色板每个值经 Lab 往返不走样；锚点与素纸相同时，推出来的就是令牌表原值
// 3. 锚点原样落回：漆上字·主（--ink-75）就是主题的字色
// 4. 各族深浅次序照素纸：每套主题里金、朱、青、漆、漆上字按明度排的次序与令牌表相同
// 5. 阴影不带色偏：漆·深（--lacquer-0，多作阴影）在各主题下彩度都低于 3
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { PALETTE, loadPalette, toLab } = require(path.join(__dirname, 'codemod-design-tokens.js'));
const derive = require(path.join(__dirname, 'derive-theme-palette.js'));

const WEB = path.resolve(__dirname, '..');
const table = loadPalette(fs.readFileSync(path.join(WEB, 'styles.css'), 'utf8')).table;
const themes = derive.loadThemes(fs.readFileSync(path.join(WEB, 'tm-theme-font.js'), 'utf8'));
const plain = themes.find((t) => t.key === 'plain');
const hex = (rgb) => '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('');
const lab = (h) => toLab([1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));

// ---- 1. 源码与锚点一致 ----
const result = derive.check();
assert.ok(result.ok, 'tm-theme-font.js 的 THEME_TOKENS 与锚点推出的值不一致；改了锚点请跑 node scripts/derive-theme-palette.js --write');

// ---- 2. 推法本身 ----
PALETTE.forEach((name) => {
  assert.strictEqual(derive.fromLab(lab(hex(table[name]))), hex(table[name]), `--${name} 经 Lab 往返走样`);
});
const same = derive.deriveTheme({ key: 'same', pal: plain.pal }, plain, table);
Object.entries(same).forEach(([name, value]) => {
  assert.strictEqual(value, hex(table[name]), `锚点与素纸相同时 --${name} 应推回令牌表原值`);
});

// ---- 3~5. 每套主题 ----
// 主题下的实值：pal 直接出的 7 个 + 推出的 22 个
function themed(theme) {
  const out = Object.assign({}, result.derived[theme.key]);
  Object.entries(derive.PAL_TOKENS).forEach(([name, field]) => { out[name] = theme.pal[field].toLowerCase(); });
  return out;
}
const byLightness = (values, names) => names.slice().sort((a, b) => lab(values[b])[0] - lab(values[a])[0]);
let families = 0;
themes.filter((t) => t.key !== 'plain').forEach((theme) => {
  const values = themed(theme);
  assert.strictEqual(values['ink-75'], theme.pal.fg.toLowerCase(), `主题 ${theme.key} 的漆上字·主应就是主题字色`);
  derive.FAMILIES.forEach((family) => {
    const names = PALETTE.filter((name) => family.members.test(name));
    const plainValues = Object.fromEntries(names.map((name) => [name, hex(table[name])]));
    assert.deepStrictEqual(byLightness(values, names), byLightness(plainValues, names), `主题 ${theme.key} 的 ${names[0].replace(/-\d+$/, '')} 族深浅次序应照素纸`);
    families++;
  });
  const [, a, b] = lab(values['lacquer-0']);
  assert.ok(Math.hypot(a, b) < 3, `主题 ${theme.key} 的漆·深（阴影）不该带明显色偏，彩度 ${Math.hypot(a, b).toFixed(1)}`);
});

console.log(`[smoke-derive-theme-palette] PASS THEME_TOKENS 与锚点一致、Lab 往返与恒等推导无走样、${families} 个色族深浅次序照素纸、阴影无色偏`);
