#!/usr/bin/env node
/* eslint-env node */
// smoke-c4-roving-ui.js — C4 流寇 UI（2026-06-16·b 增量）：军情面板「流寇警报」卡
//   抽真 rightRovingCard 渲染：在场流寇显名/众/流窜省/势头·已散(disbanded)/零众排除·无贼返空·注入 renderArmy 契约。
'use strict';

const fs = require('fs'), path = require('path'), vm = require('vm');
const WEB = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(WEB, 'phase8-formal-rightrail.js'), 'utf8');
function sliceFn(s, marker) { const a = s.indexOf(marker); let j = s.indexOf('{', a), d = 0; for (; j < s.length; j++) { const c = s[j]; if (c === '{') d++; else if (c === '}') { d--; if (d === 0) { j++; break; } } } return s.slice(a, j); }
const fnSrc = sliceFn(src, 'function rightRovingCard(');

let A = 0, F = 0;
function ok(c, m) { if (c) { A++; console.log('  ✓ ' + m); } else { F++; console.log('  ✗ ' + m); } }
function render(GM) {
  const ctx = { Array: Array, Number: Number, console: console,
    rightSocGM: function () { return GM; },
    esc: function (x) { return String(x == null ? '' : x); },
    rightArmyFmtNum: function (n) { return String(n); } };
  vm.createContext(ctx);
  vm.runInContext(fnSrc + '\nthis.go=rightRovingCard;', ctx);
  return ctx.go();
}

console.log('smoke-c4-roving-ui — C4 流寇 UI（军情面板流寇警报卡）');

// 1. 在场流寇 → 渲出警报卡 + 名/众/流窜/势头
const html = render({ rovingRebels: [
  { name: '陕北流寇', strength: 120000, regions: ['陕西', '山西'], disbanded: false },
  { name: '散贼', strength: 0, disbanded: true },
  { name: '余党', strength: 0, disbanded: false }
] });
ok(/流寇警报/.test(html), '渲出「流寇警报」卡');
ok(/陕北流寇/.test(html) && /120000/.test(html), '显流寇名 + 众 120000');
ok(/流窜 陕西、山西/.test(html), '显流窜省份');
ok(/燎原/.test(html), '众≥10万→势头「燎原」');
ok(!/散贼/.test(html) && !/余党/.test(html), '已散(disbanded)/零众流寇排除');
ok(/tmrp-card hot/.test(html), '复用 hot 卡样式(同军情预警·不碰 styles.css)');

// 2. 势头分级
ok(/势盛/.test(render({ rovingRebels: [{ name: 'A', strength: 50000, disbanded: false }] })), '众≥3万<10万→势盛');
ok(/啸聚/.test(render({ rovingRebels: [{ name: 'B', strength: 12000, disbanded: false }] })), '众<3万→啸聚');

// 3. 无在场流寇 → 空（卡不显·边防安稳不扰）
ok(render({ rovingRebels: [] }) === '', '无流寇→返空(不显卡)');
ok(render({}) === '', '无 rovingRebels 字段→返空(回归安全)');
ok(render({ rovingRebels: [{ strength: 0, disbanded: true }] }) === '', '仅已散流寇→返空');

console.log('\n[smoke-c4-roving-ui] ' + (F ? 'FAIL' : 'PASS') + ' — ' + A + ' 通过 / ' + F + ' 失败');
process.exit(F ? 1 : 0);
