#!/usr/bin/env node
/* eslint-env node */
// smoke-guozuo-collapse-proximity.js — D1 国祚·崩坏临近度预警条
//   聚合派生纯读现有信号(民变股数众数/皇权低/度支竭/民心地板)→0-100+具名档(安/隐忧/将危/濒亡)+点明杠杆。
//   守铁律:失败可读性图层·非胜利路线。承平无危则不显。抽真 rightGuozuoCard 渲染(闭包内部函数 sliceFn 抽源)。
//   11-21 删旧：民变不再按五级梯定危度（梯删了），按在的股数、众数算（众三十万记满，起码 12）；流寇一项随流寇池删了。
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
function band(n, extra) { return Object.assign({ source: 'revolt-cases', status: 'ongoing', level: 2, followers: n, scale: n, region: '延安府' }, extra || {}); }
function prox(h) { return Number((h.match(/(\d+) \/ 100/) || [])[1]); }

// ── ① 民变众三十万（满）→濒亡·满值，杠杆点明股数与众数 ──
const h1 = render({ minxin: { revolts: [band(120000), band(100000, { region: '西安府' }), band(80000, { region: '汉中府' })] } });
ok(/国祚 · 濒亡/.test(h1), '① 众三十万→国祚濒亡档');
ok(/100 \/ 100/.test(h1), '① 崩坏临近度满值 100');
ok(/民变/.test(h1) && /3 股/.test(h1) && /众约 300000/.test(h1), '① 杠杆点明民变：几股、众多少');
ok(/tmrp-card hot/.test(h1), '① 复用 hot 卡样式(不碰 styles.css)');
ok(!/改朝|流言|聚啸|暴动|起义/.test(h1), '① 不再用五级名号');

// ── ② 多线齐塌(民变+皇权下移)→点明多根杠杆 ──
const h2 = render({ minxin: { revolts: [band(150000)] }, huangquan: { index: 20 } });
ok(/民变/.test(h2) && /皇权/.test(h2), '② 点明多根在塌的杠杆');
ok(prox(h2) > prox(render({ minxin: { revolts: [band(150000)] } })), '② 叠加皇权下移→崩坏临近度抬升');

// ── ③ 仅度支竭(库银10万<20万)→将危·点明度支 ──
const h3 = render({ guoku: { money: 100000 } });
ok(/将危/.test(h3) && /50 \/ 100/.test(h3), '③ 库银10万→度支 sev50→将危');
ok(/度支/.test(h3) && /库银/.test(h3), '③ 杠杆点明度支·库银');

// ── ④ 承平无危→不显(不制造无谓焦虑) ──
ok(render({ minxin: { revolts: [], trueIndex: 70 }, huangquan: { index: 80 }, guoku: { money: 900000 } }) === '', '④ 承平(各线健康)→返空·不显');
ok(render({}) === '', '④ 空 GM→返空(回归安全)');

// ── ⑤ 一股小民变也上卡（起码 12，安档），人多了往上走 ──
const small = render({ minxin: { revolts: [band(6000)] } });
ok(/民变/.test(small) && prox(small) === 12 && /国祚 · 安/.test(small), '⑤ 一股六千人：上卡、起码 12（安档）（实得 ' + prox(small) + '）');
const mid = render({ minxin: { revolts: [band(60000), band(30000, { region: '庆阳府' })] } });
ok(prox(mid) === 30 && /隐忧/.test(mid), '⑤ 两股九万：30（隐忧）（实得 ' + prox(mid) + '）');

// ── ⑥ 只算在的：了结的（剿平、受抚、成势）不计（不虚报） ──
ok(render({ minxin: { revolts: [band(200000, { status: 'suppressed' }), band(50000, { status: 'established' })] } }) === '', '⑥ 了结的民变不计入');

// ── ⑦ 旧档里的流寇池、旧账不再上卡（随删旧删了） ──
ok(render({ rovingRebels: [{ strength: 300000, disbanded: false }], _activeRevolts: [{ organizationType: 'builtState', leaderName: '李自成' }] }) === '', '⑦ 流寇池、旧账不上卡');

console.log('[smoke-guozuo-collapse-proximity] ' + (F ? 'FAIL' : 'PASS') + ' — ' + A + ' 通过 / ' + F + ' 失败');
process.exit(F ? 1 : 0);
