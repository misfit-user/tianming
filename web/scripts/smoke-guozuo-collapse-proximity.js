#!/usr/bin/env node
/* eslint-env node */
// smoke-guozuo-collapse-proximity.js — D1 国祚·崩坏临近度预警条
//   聚合派生纯读现有信号(民变最高级/流寇燎原/皇权低/度支竭/民心地板)→0-100+具名档(安/隐忧/将危/濒亡)+点明杠杆。
//   守铁律:失败可读性图层·非胜利路线。承平无危则不显。抽真 rightGuozuoCard 渲染(同 smoke-c4-roving-ui 范式·闭包内部函数 sliceFn 抽源)。
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const WEB = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(WEB, 'phase8-formal-rightrail.js'), 'utf8');
function sliceFn(s, marker) { const a = s.indexOf(marker); let j = s.indexOf('{', a), d = 0; for (; j < s.length; j++) { const c = s[j]; if (c === '{') d++; else if (c === '}') { d--; if (d === 0) { j++; break; } } } return s.slice(a, j); }
const fnSrc = sliceFn(src, 'function rightGuozuoCard(');

let A = 0, F = 0;
function ok(c, m) { if (c) { A++; } else { F++; console.log('  ✗ ' + m); } }
function render(GM) {
  const ctx = { Array: Array, Number: Number, Math: Math, console: console,
    rightSocGM: function () { return GM; },
    esc: function (x) { return String(x == null ? '' : x); },
    rightArmyFmtNum: function (n) { return String(n); } };
  vm.createContext(ctx);
  vm.runInContext(fnSrc + '\nthis.go=rightGuozuoCard;', ctx);
  return ctx.go();
}

// ── ① 民变5级(改朝在即)→濒亡·满值 ──
const h5 = render({ minxin: { revolts: [{ level: 5, region: '陕西' }] } });
ok(/国祚 · 濒亡/.test(h5), '① 民变5级→国祚濒亡档');
ok(/100 \/ 100/.test(h5), '① 崩坏临近度满值 100');
ok(/民变/.test(h5) && /改朝/.test(h5) && /1 处/.test(h5), '① 杠杆点明民变·最烈「改朝」');
ok(/tmrp-card hot/.test(h5), '① 复用 hot 卡样式(不碰 styles.css)');

// ── ② 多线齐塌(起义+流寇燎原+皇权下移)→濒亡·点明三杠杆 ──
const h2 = render({ minxin: { revolts: [{ level: 4 }] }, rovingRebels: [{ strength: 300000, disbanded: false }], huangquan: { index: 20 } });
ok(/濒亡/.test(h2), '② 起义+流寇+皇权多因→濒亡');
ok(/流寇/.test(h2) && /民变/.test(h2) && /皇权/.test(h2), '② 点明多根在塌的杠杆');

// ── ③ 仅度支竭(库银10万<20万)→将危·点明度支 ──
const h3 = render({ guoku: { money: 100000 } });
ok(/将危/.test(h3) && /50 \/ 100/.test(h3), '③ 库银10万→度支 sev50→将危');
ok(/度支/.test(h3) && /库银/.test(h3), '③ 杠杆点明度支·库银');

// ── ④ 承平无危→不显(不制造无谓焦虑) ──
ok(render({ minxin: { revolts: [], trueIndex: 70 }, rovingRebels: [], huangquan: { index: 80 }, guoku: { money: 900000 } }) === '', '④ 承平(各线健康)→返空·不显');
ok(render({}) === '', '④ 空 GM→返空(回归安全)');

// ── ⑤ 档位边界:暴动(3级 sev50)→将危 ──
ok(/将危/.test(render({ minxin: { revolts: [{ level: 3 }] } })), '⑤ 暴动3级 sev50→将危档');

// ── ⑥ 多因加权抬升:聚啸(2级 sev28)独→隐忧;叠流寇→临近度升 ──
const only2 = render({ minxin: { revolts: [{ level: 2 }] } });
const plus = render({ minxin: { revolts: [{ level: 2 }] }, rovingRebels: [{ strength: 60000, disbanded: false }] });
ok(/隐忧/.test(only2), '⑥ 聚啸2级独→隐忧');
const p1 = Number((only2.match(/(\d+) \/ 100/) || [])[1]);
const p2 = Number((plus.match(/(\d+) \/ 100/) || [])[1]);
ok(p2 > p1, '⑥ 叠加流寇→崩坏临近度抬升(多线齐塌更危·' + p1 + '→' + p2 + ')');

// ── ⑦ 已镇压民变不计(不虚报) ──
ok(render({ minxin: { revolts: [{ level: 5, _suppressed: true }] } }) === '', '⑦ 已镇压民变(_suppressed)不计入');

// ── ⑦b level 越界防御(Codex 审出·clamp 1..5·防 level6 显成 安/undefined) ──
const h6 = render({ minxin: { revolts: [{ level: 6 }] } });
ok(/濒亡/.test(h6) && /改朝/.test(h6) && !/undefined/.test(h6), '⑦b level6 越界→clamp 到5(濒亡·改朝·非 安/undefined)');

console.log('[smoke-guozuo-collapse-proximity] ' + (F ? 'FAIL' : 'PASS') + ' — ' + A + ' 通过 / ' + F + ' 失败');
process.exit(F ? 1 : 0);
