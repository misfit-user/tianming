#!/usr/bin/env node
/* eslint-env node */
// smoke-class-radical-flight.js — C2：radicalFrac→流民外流（跨接缝·2026-06-16）
// 验：乱民高的阶层经 populationKeys/resolver 找源格子，向逃户守恒失血（总数不变）；
//     低乱民不失血；率∝rf 封顶；无源格子/无逃户安全；关键词回退。
'use strict';

const path = require('path');
const WEB = path.join(__dirname, '..');
require(path.join(WEB, 'tm-engine-constants.js'));
require(path.join(WEB, 'tm-class-engine.js'));
require(path.join(WEB, 'tm-class-mobility.js'));
const PF3 = global.PhaseF3;

let passed = 0, failed = 0;
function ok(cond, msg) {
  if (cond) { passed += 1; console.log('  PASS', msg); }
  else { failed += 1; console.error('  FAIL', msg); }
}
function run(GM) { global.GM = GM; PF3._tickRadicalFlight({}, 1); return GM; }
ok(PF3 && typeof PF3._tickRadicalFlight === 'function', '导出 _tickRadicalFlight');

// ── 1. 高乱民(有 populationKeys+格子) → 失血→逃户·守恒 ──
const GM1 = { turn: 5, classes: [{ name: '农户', _radicalFrac: 0.8, populationKeys: ['peasant_self'] }],
  population: { national: { mouths: 1000000 }, byClass: { peasant_self: { mouths: 100000 } }, byLegalStatus: { taoohu: { mouths: 0 } } } };
run(GM1);
const fled1 = 100000 - GM1.population.byClass.peasant_self.mouths;
ok(fled1 > 0, '高乱民0.8→源格子失血 (fled ' + fled1 + ')');
ok(GM1.population.byLegalStatus.taoohu.mouths === fled1, '守恒·失血全入逃户');
ok(GM1.population.byClass.peasant_self.mouths + GM1.population.byLegalStatus.taoohu.mouths === 100000, '守恒·总数不变(=100000)');
ok(GM1.classes[0]._fledMouths === fled1 && GM1.classes[0]._fledTurn === 5, '挂账·_fledMouths/_fledTurn 供 C3/UI');

// ── 2. 低乱民(<0.4) → 不失血 ──
const GM2 = { turn: 5, classes: [{ name: '农户', _radicalFrac: 0.3, populationKeys: ['peasant_self'] }],
  population: { byClass: { peasant_self: { mouths: 100000 } }, byLegalStatus: { taoohu: { mouths: 0 } } } };
run(GM2);
ok(GM2.population.byClass.peasant_self.mouths === 100000 && GM2.population.byLegalStatus.taoohu.mouths === 0, '低乱民0.3<阈·不失血');

// ── 3. 失血率∝rf·封顶（rf=1.0 ≈0.72%）──
const GM3 = { turn: 5, classes: [{ name: '农户', _radicalFrac: 1.0, populationKeys: ['peasant_self'] }],
  population: { byClass: { peasant_self: { mouths: 1000000 } }, byLegalStatus: { taoohu: { mouths: 0 } } } };
run(GM3);
const fled3 = 1000000 - GM3.population.byClass.peasant_self.mouths;
ok(fled3 >= 6000 && fled3 <= 8000, 'rf=1.0 失血≈0.72%(6000-8000) (got ' + fled3 + ')');
// 对照 rf=0.8 失血更少（率∝rf）
const GM3b = { turn: 5, classes: [{ name: '农户', _radicalFrac: 0.8, populationKeys: ['peasant_self'] }],
  population: { byClass: { peasant_self: { mouths: 1000000 } }, byLegalStatus: { taoohu: { mouths: 0 } } } };
run(GM3b);
ok((1000000 - GM3b.population.byClass.peasant_self.mouths) < fled3, '率∝rf·0.8失血<1.0失血');

// ── 4. 无源格子(populationKeys 指向不存在) → 安全·不失血·不抛 ──
const GM4 = { turn: 5, classes: [{ name: '某新阶层', _radicalFrac: 0.9, populationKeys: ['nonexist_key'] }],
  population: { byClass: {}, byLegalStatus: { taoohu: { mouths: 0 } } } };
let threw4 = false; try { run(GM4); } catch (e) { threw4 = true; }
ok(!threw4 && GM4.population.byLegalStatus.taoohu.mouths === 0, '无源格子·安全·不失血');

// ── 5. taoohu 不存在 → 失血时自动建(守恒不丢) ──
const GM5 = { turn: 5, classes: [{ name: '农户', _radicalFrac: 0.8, populationKeys: ['peasant_self'] }],
  population: { byClass: { peasant_self: { mouths: 100000 } } } };
run(GM5);
ok(GM5.population.byLegalStatus && GM5.population.byLegalStatus.taoohu && GM5.population.byLegalStatus.taoohu.mouths > 0, 'taoohu 缺则自动建·守恒不丢');

// ── 6. 无 populationKeys → resolvePopulationKeys 关键词回退 ──
const GM6 = { turn: 5, classes: [{ name: '自耕农', _radicalFrac: 0.8 }],
  population: { byClass: { peasant_self: { mouths: 100000 } }, byLegalStatus: { taoohu: { mouths: 0 } } } };
run(GM6);
ok(GM6.population.byLegalStatus.taoohu.mouths > 0, '无 populationKeys·"自耕农"关键词解析→peasant_self·仍失血');

// ── 7. 源契约：tick 调用 _tickRadicalFlight ──

// ── 8. C3·财政牙齿：逃亡→population.hiddenCount（huji fugitive/hidden 压力·税基↓输入）──
ok(GM1.population.hiddenCount === fled1, 'C3·财政·population.hiddenCount += flee (got ' + GM1.population.hiddenCount + ' vs fled ' + fled1 + ')');

// ── 9. C3·督抚奏报：起义阶层流民载道入邸报；非起义静默 ──
const ebCalls = [];
global.addEB = function (cat, msg) { ebCalls.push([cat, msg]); };
const GM9 = { turn: 7, classes: [{ name: '陕西农户', _radicalFrac: 0.8, populationKeys: ['peasant_self'], revoltState: { phase: 'uprising' } }],
  population: { byClass: { peasant_self: { mouths: 200000 } }, byLegalStatus: { taoohu: { mouths: 0 } } } };
run(GM9);
ok(ebCalls.some(function (c) { return c[0] === '民变' && /流民载道/.test(c[1]); }), 'C3·起义阶层流民载道入邸报 (got ' + (ebCalls[0] ? ebCalls[0][1] : 'none') + ')');
ebCalls.length = 0;
const GM9b = { turn: 7, classes: [{ name: '农户', _radicalFrac: 0.8, populationKeys: ['peasant_self'], revoltState: { phase: 'brewing' } }],
  population: { byClass: { peasant_self: { mouths: 200000 } }, byLegalStatus: { taoohu: { mouths: 0 } } } };
run(GM9b);
ok(ebCalls.length === 0, 'C3·非起义(brewing)不报邸报·只静默失血');
delete global.addEB;

console.log('\n[smoke-class-radical-flight] ' + (failed ? 'FAIL' : 'PASS') + ' — ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
