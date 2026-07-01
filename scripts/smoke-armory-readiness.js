#!/usr/bin/env node
'use strict';
/* smoke-armory-readiness — 军备研判 readinessForAI:储备 vs 全军装备总需求 → 充盈/够用/偏紧/紧缺·供 AI 推演判军事虚实。
 * 喂进 tm-ai-change-applier 的推演上下文 guoku.armoryReadiness。read-only·永不崩。 */
const path = require('path');
global.window = {};
const AR = require(path.resolve(__dirname, '..', 'tm-armory.js'));
let A = 0, F = 0; function ok(c, m) { if (c) { A++; console.log('  ✓ ' + m); } else { F++; console.log('  ✗ FAIL: ' + m); } }
console.log('smoke-armory-readiness');

/* ① 充盈:储备远超需求 */
const GM1 = { armies: [{ units: [{ sub: 'spear', men: 1000 }] }] }; // 兵刃需求1000·甲胄700
AR.ensure(GM1); AR.add(GM1, { 甲胄: 5000, 兵刃: 5000 }, 't');
const r1 = AR.readinessForAI(GM1);
ok(r1 && r1.byCategory, '① 返 {byCategory, worst, note} 结构');
ok(r1.byCategory['兵刃'].demand === 1000 && r1.byCategory['兵刃'].stock === 5000, '① 兵刃 需求1000/储5000');
ok(r1.byCategory['兵刃'].level === '充盈' && r1.byCategory['兵刃'].ratio >= 1, '① 储>>需→充盈');
ok(r1.byCategory['火器'].level === '不需' && r1.byCategory['火器'].ratio === null, '① 无火器兵→火器不需(ratio null·不误报紧缺)');

/* ② 紧缺:储备远低于需求 */
const GM2 = { armies: [{ units: [{ sub: 'musket', men: 10000 }] }] }; // musket→火器需求10000 + 甲胄5000(NEED_BY_SUB musket 甲胄0.5)
AR.ensure(GM2); AR.add(GM2, { 火器: 1000, 甲胄: 5000 }, 't'); // 火器1000/10000=0.1(紧缺)·甲胄5000/5000=1(充盈)→火器才是 worst
const r2 = AR.readinessForAI(GM2);
ok(r2.byCategory['火器'].level === '紧缺' && r2.byCategory['火器'].ratio < 0.2, '② 储1000/需10000→紧缺(ratio<0.2)');
ok(r2.worst && r2.worst.cat === '火器', '② worst=火器(最紧缺类)');
ok(/紧缺/.test(r2.note) && /火器/.test(r2.note), '② note 点名火器紧缺研判');

/* ③ 够用/偏紧 分级 */
const GM3 = { armies: [{ units: [{ sub: 'spear', men: 1000 }] }] }; // 兵刃需求1000
AR.ensure(GM3); AR.add(GM3, { 兵刃: 700 }, 't'); // 0.7→够用
ok(AR.readinessForAI(GM3).byCategory['兵刃'].level === '够用', '③ ratio 0.7→够用');
const GM4 = { armies: [{ units: [{ sub: 'spear', men: 1000 }] }] };
AR.ensure(GM4); AR.add(GM4, { 兵刃: 300 }, 't'); // 0.3→偏紧
ok(AR.readinessForAI(GM4).byCategory['兵刃'].level === '偏紧', '③ ratio 0.3→偏紧');

/* ④ 永不崩:无军队 / 空 GM */
const GM5 = {}; AR.ensure(GM5);
const r5 = AR.readinessForAI(GM5);
ok(r5 && r5.worst === null && r5.note === '无在役军队', '④ 无军队→worst null·note=无在役军队');
let threw = false; let r6;
try { r6 = AR.readinessForAI({}); } catch (e) { threw = true; }
ok(!threw && r6 && r6.byCategory, '④ 空 GM(无 guoku/armies)→不抛·返结构');

/* ⑤ read-only:不改 GM */
const GM7 = { armies: [{ units: [{ sub: 'musket', men: 500 }] }] };
AR.ensure(GM7); AR.add(GM7, { 火器: 9999 }, 't');
const snap = JSON.stringify(GM7.guoku.armory);
AR.readinessForAI(GM7);
ok(JSON.stringify(GM7.guoku.armory) === snap, '⑤ read-only·研判不改库存');

/* ⑥ 导出 + 在 API 上 */
ok(typeof AR.readinessForAI === 'function', '⑥ readinessForAI 已导出到 TMArmory API');

console.log('\nsmoke-armory-readiness ' + (F === 0 ? 'PASS' : 'FAIL') + ' ' + A + '/' + (A + F));
process.exit(F === 0 ? 0 : 1);
