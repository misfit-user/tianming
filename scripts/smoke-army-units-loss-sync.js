#!/usr/bin/env node
'use strict';
/* smoke-army-units-loss-sync — units[] 反映真实兵力(整编屏刀4):
 * 战损/募兵后 army.soldiers 变·composition 未同步→deriveArmyUnits 按比例缩放→units 不陈旧(整编自动:填满+余数合并残队)。 */
const path = require('path');
global.window = {};
const AU = require(path.resolve(__dirname, '..', 'tm-army-units.js'));
let A = 0, F = 0; function ok(c, m) { if (c) { A++; console.log('  ✓ ' + m); } else { F++; console.log('  ✗ FAIL: ' + m); } }
const sum = u => u.reduce((s, x) => s + x.men, 0);
console.log('smoke-army-units-loss-sync');

/* ① 战损→units 缩到真实兵力(原 bug:仍3000) */
const a = { composition: [{ type: '长枪兵', count: 3000 }], soldiers: 3000, quality: '普通' };
AU.ensureArmyUnits(a);
ok(sum(a.units) === 3000, '① 战前 soldiers3000→units总men3000');
a.soldiers = 1500; AU.ensureArmyUnits(a);
ok(sum(a.units) === 1500, '① 战损后 soldiers1500→units总men1500(★修陈旧·原为3000)');
ok(a.units.length === 2, '① 1500→2队(整编自动:填满+余数=1000+500)');

/* ② compSum=soldiers→scale=1→零行为变更 */
const b = { composition: [{ type: '步', count: 1000 }], soldiers: 1000, quality: '普通' };
AU.ensureArmyUnits(b);
ok(sum(b.units) === 1000 && b.units.length === 1, '② compSum=soldiers→scale=1·无变化(零行为变更)');

/* ③ 募兵增长→units 随之增 */
const c = { composition: [{ type: '步', count: 2000 }], soldiers: 2000, quality: '普通' };
AU.ensureArmyUnits(c); const n0 = sum(c.units);
c.soldiers = 3500; AU.ensureArmyUnits(c);
ok(sum(c.units) === 3500 && sum(c.units) > n0, '③ 募兵 soldiers2000→3500·units随之增到3500');

/* ④ 多兵种缩放保持比例·总数守恒 */
const d = { composition: [{ type: '步', count: 3000 }, { type: '骑兵', count: 1000 }], soldiers: 4000, quality: '普通' };
AU.ensureArmyUnits(d);
d.soldiers = 2000; AU.ensureArmyUnits(d);   // 减半
const stepMen = d.units.filter(u => u.arm === 'step').reduce((s, x) => s + x.men, 0);
const cavMen = d.units.filter(u => u.arm === 'cav').reduce((s, x) => s + x.men, 0);
ok(Math.abs(sum(d.units) - 2000) <= 2, '④ 4000→2000·units总men≈2000(守恒·±舍入)');
ok(stepMen > cavMen && cavMen > 0, '④ 步:骑≈3:1 缩放后仍保持(步多骑少)');

/* ⑤ soldiers 未设→用 composition 和(向后兼容) */
const e = { composition: [{ type: '步', count: 800 }], quality: '普通' };   // 无 soldiers 字段
AU.ensureArmyUnits(e);
ok(sum(e.units) === 800, '⑤ soldiers未设→units=composition和800(向后兼容·不归零)');

/* ⑥ soldiers=0(全歼)→units 空 */
const f = { composition: [{ type: '步', count: 1000 }], soldiers: 0, quality: '普通' };
AU.ensureArmyUnits(f);
ok(Array.isArray(f.units) && f.units.length === 0, '⑥ soldiers=0(全歼)→units空(原 bug:仍派出1000)');

/* ⑦ 永不崩 */
ok(AU.deriveArmyUnits(null).length === 0, '⑦ null→[]不崩');

console.log('\nsmoke-army-units-loss-sync ' + (F === 0 ? 'PASS' : 'FAIL') + ' ' + A + '/' + (A + F));
process.exit(F === 0 ? 0 : 1);
