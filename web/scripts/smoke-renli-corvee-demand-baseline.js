/* smoke-renli-corvee-demand-baseline.js — A1 激活·役需接线（标准常役底盘·node 直跑）
 * 验：已种子地域诏书未设役需→取「册载丁×常役系数×征发强度乘数」标准常役→役负激活（适当）；
 *   未种子→0（inert）；征发强度 normal⟷extreme = 适当⟷过度征发；棘轮（present 缩→役负升·役额按册载丁黏滞）；
 *   诏书显式 corveeDemand 覆盖基线。
 * 跑：node scripts/smoke-renli-corvee-demand-baseline.js
 */
'use strict';
var pass = 0, fail = 0, fails = [];
function ok(c, m) { if (c) pass++; else { fail++; fails.push(m); console.error('  ✗ ' + m); } }
function near(a, b, t, m) { ok(Math.abs(a - b) <= (t || 0.005), m + ' (得 ' + a + '·期 ' + b + '±' + (t || 0.005) + ')'); }

global.P = { adminHierarchy: { player: { divisions: [
  { id: '陕西', name: '陕西', populationDetail: { mouths: 3000000, households: 600000, ding: 900000 } },       // 种子
  { id: '江南', name: '江南', populationDetail: { mouths: 4000000, households: 800000, ding: 1200000 } }       // 不种子
] } } };
global.GM = { turn: 1, classes: [{ name: '农户', economicRole: '生产', satisfaction: 60, regionalVariants: [] }] };
global.TM = global.TM || {}; global.TM.ClassEngine = { gateSatisfaction: function (root, cls, raw) { var d = Math.max(-14, Math.min(14, raw)); cls.satisfaction += d; return { approved: d }; } };

var R = require('../tm-renli.js');
R.ensureDefaults(global.GM, global.P);
R.seedRegion(global.GM, global.P, '陕西', { soilBase: 70, waterworks: 50, doubleCropping: 1.0, laborMarketDepth: 0.2, registeredLand: 3000000 });
var leafSX = R.leaves(global.P).filter(function (l) { return l.id === '陕西'; })[0];
var rSX = R.getRegion(global.GM, '陕西');

function tickSX(ding, fugitives, strength, explicitDemand) {
  leafSX.populationDetail.ding = ding;
  leafSX.populationDetail.fugitives = fugitives || 0;
  rSX.levyPolicy.strength = strength || 'normal';
  if (explicitDemand === undefined) delete rSX.levyPolicy.corveeDemand; else rSX.levyPolicy.corveeDemand = explicitDemand;
  rSX.weather = 1.0;
  R.tick(global.GM, global.P);
  return { rate: rSX.corveeRate, corvee: leafSX.populationDetail.alloc.corvee };
}

// 1) 已种子·normal·诏书未设 → 标准常役激活（适当·役负≈0.144·未过 0.20 线）
var t1 = tickSX(900000, 0, 'normal', undefined);
near(t1.corvee, 129600, 2, '1·标准常役 alloc.corvee≈129600 (册载90万×0.18×1.0=16.2万役需·折银0.2→实役12.96万)');
near(t1.rate, 0.144, 0.005, '1·役负≈0.144（适当征发·未种子时本恒0·基线已激活）');

// 2) 未种子江南 → 役需 0（inert·零行为）
var rJN = R.getRegion(global.GM, '江南');
var leafJN = R.leaves(global.P).filter(function (l) { return l.id === '江南'; })[0];
ok((leafJN.populationDetail.alloc.corvee || 0) === 0, '2·未种子江南 alloc.corvee=0（基线不及未种子·inert）');
ok((rJN.corveeRate || 0) === 0, '2·未种子江南 役负=0');

// 3) 征发强度 normal⟷extreme = 适当⟷过度征发
var t3 = tickSX(900000, 0, 'extreme', undefined);
ok(t3.rate > 0.30, '3·extreme 强度→役负 >0.30（过度征发·远超 0.20 线·得 ' + t3.rate + '）');
ok(t3.rate > t1.rate, '3·extreme 役负 > normal（征发强度驱动·得 ' + t3.rate + ' vs ' + t1.rate + '）');

// 4) 棘轮：present 缩（逃亡）→役负升（役额按册载丁黏滞·不随可征丁缩）
var t4 = tickSX(900000, 250000, 'normal', undefined); // present=65万·册载仍90万
ok(t4.rate > t1.rate, '4·棘轮：present 缩→役负升（同册载役需·分母可征丁缩·得 ' + t4.rate + ' > ' + t1.rate + '）');

// 5) 诏书显式 corveeDemand 覆盖基线
var t5a = tickSX(900000, 0, 'normal', 0);
ok((t5a.rate || 0) === 0, '5·显式 corveeDemand=0 覆盖基线→役负0（蠲免/无役）');
var t5b = tickSX(900000, 0, 'normal', 450000);
ok(t5b.rate > t1.rate, '5·显式 corveeDemand=45万 覆盖基线（>标准常役·得 ' + t5b.rate + '）');

// 6) 单一真相源 + 源契约
ok(R.assertNoDingInRenli(global.GM).length === 0, '6·GM.renli 无丁计数泄漏');

console.log('\n[smoke-renli-corvee-demand-baseline] ' + pass + ' 通过 / ' + fail + ' 失败');
if (fail) { console.error('失败项：\n - ' + fails.join('\n - ')); process.exit(1); }
process.exit(0);
