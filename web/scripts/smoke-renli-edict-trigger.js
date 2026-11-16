/* smoke-renli-edict-trigger.js — R6c：诏书文本 → 变法识别触发（node 直跑）
 * 验：未种子零工作早返回(gate) / 点名单省 / id≠name 按名配 / 蠲免年数解析 / 天下结构变法全国 /
 *     未点名结构变法跳过(防血洗) / 未点名软变法全省 / 一条鞭法适配标志 / 多变法一诏 / 无变法词 null / 单源 / 源契约。
 * 跑：node scripts/smoke-renli-edict-trigger.js
 */
'use strict';
var pass = 0, fail = 0, fails = [];
function ok(c, m) { if (c) pass++; else { fail++; fails.push(m); console.error('  ✗ ' + m); } }
function eq(a, b, m) { ok(a === b, m + ' (得 ' + JSON.stringify(a) + '·期 ' + JSON.stringify(b) + ')'); }

function world() {
  global.P = { adminHierarchy: { player: { divisions: [
    { id: '陕西', name: '陕西', populationDetail: { mouths: 3000000, households: 600000, ding: 900000, fugitives: 0, hiddenCount: 0, commendedDing: 0 } },
    { id: '苏州', name: '苏州', populationDetail: { mouths: 4000000, households: 800000, ding: 1200000, fugitives: 0, hiddenCount: 0, commendedDing: 0 } },
    { id: 'div_sx', name: '山西', populationDetail: { mouths: 2000000, households: 400000, ding: 600000, fugitives: 0, hiddenCount: 0, commendedDing: 0 } } // ★ id≠name·验按 name 配文本
  ] } } };
  global.GM = { turn: 7, classes: [
    { name: '农户', economicRole: '生产', satisfaction: 58, regionalVariants: [] },
    { name: '士大夫', economicRole: '治理', satisfaction: 60, regionalVariants: [] }
  ], chars: [] };
}
function setupGate() { global.TM.ClassEngine = { gateSatisfaction: function (root, cls, raw) { var d = Math.max(-14, Math.min(14, raw)); cls.satisfaction = Math.max(0, Math.min(100, cls.satisfaction + d)); return { approved: d }; } }; }
var R = require('../tm-renli.js');
function seedAll() {
  R.seedRegion(global.GM, global.P, '陕西', { soilBase: 70, laborMarketDepth: 0.2, registeredLand: 3000000 });
  R.seedRegion(global.GM, global.P, '苏州', { soilBase: 90, doubleCropping: 1.4, laborMarketDepth: 0.8, registeredLand: 4000000 });
  R.seedRegion(global.GM, global.P, 'div_sx', { soilBase: 60, laborMarketDepth: 0.2, registeredLand: 2000000 }); // 山西·id≠name
}
function leafOf(rid) { return R.leaves(global.P).filter(function (l) { return l.id === rid; })[0]; }

// 1) GATE：未种子地域 → 零工作早返回 null（live 零风险·不扫文本）
world(); R.ensureDefaults(global.GM, global.P); setupGate();
ok(R.recognizeEdictReform(global.GM, global.P, '着陕西清丈田亩、重修黄册', {}) === null, '1·未种子→null（零工作早返回·gate）');

// 2) 点名单省：着陕西清丈田亩 → 仅陕西
world(); R.ensureDefaults(global.GM, global.P); seedAll(); setupGate();
var r2 = R.recognizeEdictReform(global.GM, global.P, '着陕西清丈田亩', {});
ok(r2 && r2.applied.length === 1 && r2.applied[0].type === 'survey' && r2.applied[0].region === '陕西', '2·点名陕西→仅陕西 survey');
eq(r2 && r2.scope, 'region', '2·scope=region');
ok(R.popOf(leafOf('陕西')).registeredLand > 3000000, '2·陕西 registeredLand 实增（applyReform 真跑）');
eq(R.popOf(leafOf('苏州')).registeredLand, 4000000, '2·苏州未动（隔离）');

// 3) id≠name 按 name 配文本（山西 id=div_sx）
world(); R.ensureDefaults(global.GM, global.P); seedAll(); setupGate();
var r3 = R.recognizeEdictReform(global.GM, global.P, '着山西重修黄册', {});
ok(r3 && r3.applied.length === 1 && r3.applied[0].type === 'reregister', '3·山西重修黄册命中');
eq(r3 && r3.applied[0].region, 'div_sx', '3·region=真 id(div_sx·按 name 配后用真 id 调 applyReform)');
eq(r3 && r3.applied[0].regionName, '山西', '3·regionName=山西');

// 4) 蠲免年数解析 + 点名
world(); R.ensureDefaults(global.GM, global.P); seedAll(); setupGate();
var r4 = R.recognizeEdictReform(global.GM, global.P, '蠲免陕西徭役三年，与民休息', {});
ok(r4 && r4.applied.some(function (a) { return a.type === 'remit' && a.region === '陕西'; }), '4·蠲免陕西命中');
eq(R.getRegion(global.GM, '陕西').levyPolicy.remitTurns, 3, '4·年数解析 三年→remitTurns=3');

// 5) 天下结构变法 → 全国（全部已种子）
world(); R.ensureDefaults(global.GM, global.P); seedAll(); setupGate();
var r5 = R.recognizeEdictReform(global.GM, global.P, '诏天下清丈田亩', {});
eq(r5 && r5.scope, 'national', '5·scope=national');
eq(r5 && r5.applied.filter(function (a) { return a.type === 'survey'; }).length, 3, '5·天下清丈→3 省全中');

// 6) 未点名结构变法·无"天下" → 跳过（防一句话血洗全国）
world(); R.ensureDefaults(global.GM, global.P); seedAll(); setupGate();
var r6 = R.recognizeEdictReform(global.GM, global.P, '宜清丈田亩以核隐占', {});
ok(r6 && r6.applied.length === 0 && r6.skipped.some(function (s) { return s.type === 'survey'; }), '6·未指地域大变法→skipped 不施行');
eq(R.popOf(leafOf('陕西')).registeredLand, 3000000, '6·陕西 registeredLand 未动（确实没血洗）');

// 7) 未点名软变法（蠲免）→ 全部已种子
world(); R.ensureDefaults(global.GM, global.P); seedAll(); setupGate();
var r7 = R.recognizeEdictReform(global.GM, global.P, '蠲免徭役以苏民困', {});
eq(r7 && r7.scope, 'soft-all', '7·软变法未点名→soft-all');
eq(r7 && r7.applied.filter(function (a) { return a.type === 'remit'; }).length, 3, '7·蠲免→3 省全中');

// 8) 一条鞭法适配标志（陕西无银=毒 / 苏州有银=顺）
world(); R.ensureDefaults(global.GM, global.P); seedAll(); setupGate();
var r8a = R.recognizeEdictReform(global.GM, global.P, '着陕西行一条鞭法', {});
ok(r8a && r8a.applied[0].type === 'whip' && r8a.applied[0].result.suited === false, '8·陕西一条鞭法 suited=false（无银之地）');
ok(/恐成扰/.test(r8a.applied[0].label), '8·陕西 label 标恐成扰');
var r8b = R.recognizeEdictReform(global.GM, global.P, '着苏州行一条鞭法', {});
ok(r8b && r8b.applied[0].result.suited === true, '8·苏州一条鞭法 suited=true（有银市场）');

// 9) 多变法一诏
world(); R.ensureDefaults(global.GM, global.P); seedAll(); setupGate();
var r9 = R.recognizeEdictReform(global.GM, global.P, '着陕西清丈田亩、重修黄册', {});
ok(r9 && r9.applied.some(function (a) { return a.type === 'survey'; }) && r9.applied.some(function (a) { return a.type === 'reregister'; }), '9·一诏两法（清丈+重修黄册）');

// 10) 无变法词 → null
world(); R.ensureDefaults(global.GM, global.P); seedAll(); setupGate();
ok(R.recognizeEdictReform(global.GM, global.P, '着户部清查钱粮、核议边饷', {}) === null, '10·无变法词→null（清查≠清丈）');

// 11) 单一真相源
ok(R.assertNoDingInRenli(global.GM).length === 0, '11·GM.renli 无丁泄漏');

// 12) 源契约：导出 + 钩子接线
ok(typeof R.recognizeEdictReform === 'function', '12·tm-renli 导出 recognizeEdictReform');

console.log('\n[smoke-renli-edict-trigger] ' + pass + ' 通过 / ' + fail + ' 失败');
if (fail) { console.error('失败项：\n - ' + fails.join('\n - ')); process.exit(1); }
process.exit(0);
