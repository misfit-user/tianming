/* smoke-renli-pilot-seed.js — A3a 激活·试点种子（数据驱动·中立·node 直跑）
 * 验：GM.renliPilot 驱动 endturnTick 种子（按 name 配·id≠name）→ 激活 A1 役负；byRegion key=regionIdOf(叶)防分账；
 *   幂等（已种子 re-tick 不重置 soil/棘轮）；无 renliPilot→零行为（inert·未激活）。
 * 跑：node scripts/smoke-renli-pilot-seed.js
 */
'use strict';
var pass = 0, fail = 0, fails = [];
function ok(c, m) { if (c) pass++; else { fail++; fails.push(m); console.error('  ✗ ' + m); } }

global.P = { adminHierarchy: { player: { divisions: [
  { id: 'div_sx', name: '陕西', populationDetail: { mouths: 3000000, households: 600000, ding: 900000 } }, // ★ id≠name
  { id: 'div_jn', name: '江南', populationDetail: { mouths: 4000000, households: 800000, ding: 1200000 } }  // 非试点
] } } };
global.GM = { turn: 1, sid: 'sc-x', classes: [{ name: '农户', economicRole: '生产', satisfaction: 60, regionalVariants: [] }] };
global.TM = global.TM || {}; global.TM.ClassEngine = { gateSatisfaction: function (r, c, raw) { var d = Math.max(-14, Math.min(14, raw)); c.satisfaction += d; return { approved: d }; } };

var R = require('../tm-renli.js');
R.ensureDefaults(global.GM, global.P);
var leafSX = R.leaves(global.P).filter(function (l) { return l.id === 'div_sx'; })[0];
var leafJN = R.leaves(global.P).filter(function (l) { return l.id === 'div_jn'; })[0];

// 1) 无 renliPilot → 零行为（inert·未激活）
global.GM.renliPilot = [];
R.endturnTick(global.GM, global.P);
ok(!leafSX.renliSeed, '1·无 renliPilot→陕西未种子（inert·未激活）');
ok((R.getRegion(global.GM, 'div_sx') ? R.getRegion(global.GM, 'div_sx').corveeRate : 0) === 0, '1·未种子→役负 0');

// 2) 设 renliPilot（按 name '陕西'·叶 id=div_sx）→ endturnTick 种子 + 激活
global.GM.renliPilot = [{ region: '陕西', seed: { soilBase: 68, waterworks: 50, doubleCropping: 1.0, laborMarketDepth: 0.2, registeredLand: 3000000 } }];
R.endturnTick(global.GM, global.P);
ok(!!leafSX.renliSeed, '2·renliPilot 驱动陕西已种子（按 name 配·id=div_sx）');
ok(leafSX.renliSeed.soilBase === 68, '2·种子参数来自 renliPilot（soilBase 68）');
ok(!leafJN.renliSeed, '2·非试点江南未种子');
ok(!!R.getRegion(global.GM, 'div_sx'), '2·byRegion key=div_sx（regionIdOf·与 tickLeaf 一致·防 id/name 分账）');
ok(R.getRegion(global.GM, 'div_sx').corveeRate > 0, '2·★陕西役负>0（种子→A1 标准常役激活·得 ' + R.getRegion(global.GM, 'div_sx').corveeRate + '）');
ok((R.getRegion(global.GM, 'div_jn') ? R.getRegion(global.GM, 'div_jn').corveeRate : 0) === 0, '2·江南(未种子)役负仍 0（inert 不误伤）');

// 3) 幂等：已种子地域 re-tick 不重置 soil（保运行时累积/蚀）
R.getRegion(global.GM, 'div_sx').soil = 40; // 模拟运行时地力蚀到 40
R.endturnTick(global.GM, global.P);
ok(R.getRegion(global.GM, 'div_sx').soil < 50, '3·幂等：已种子→re-tick 不重置 soil 回 68（得 ' + R.getRegion(global.GM, 'div_sx').soil + '·保运行时累积）');
ok(!!leafSX.renliSeed, '3·幂等后陕西仍种子');

// 4) 单一真相源 + 源契约
ok(R.assertNoDingInRenli(global.GM).length === 0, '4·GM.renli 无丁计数泄漏');
ok(typeof R.ensurePilotSeeds === 'function', '4·导出 ensurePilotSeeds');

// 5) 配置回退：GM 无 renliPilot 但剧本模板 P.scenarios[sid].renliPilot 有 → 仍种子（绕 scenario→GM 拷贝保真·A3b 实走此路）
global.P = { scenarios: [{ id: 'sc-y', renliPilot: [{ region: '陕西', seed: { soilBase: 66, laborMarketDepth: 0.2, registeredLand: 3000000 } }] }],
  adminHierarchy: { player: { divisions: [ { id: 'div_sx2', name: '陕西', populationDetail: { mouths: 3000000, households: 600000, ding: 900000 } } ] } } };
global.GM = { turn: 1, sid: 'sc-y', classes: [{ name: '农户', economicRole: '生产', satisfaction: 60, regionalVariants: [] }] };
R.ensureDefaults(global.GM, global.P);
R.endturnTick(global.GM, global.P);
var leafSX2 = R.leaves(global.P).filter(function (l) { return l.id === 'div_sx2'; })[0];
ok(!!leafSX2.renliSeed, '5·GM 无 renliPilot·剧本 P.scenarios[sid].renliPilot 驱动种子（绕拷贝保真·A3b 路径）');
ok(leafSX2.renliSeed.soilBase === 66, '5·种子参数取自剧本 renliPilot（soilBase 66）');

// 6) ★省→府展开 + economyBase.farmland 田源（真天启结构：省非叶子·府叶田在 economyBase.farmland）
global.P = { scenarios: [], adminHierarchy: { player: { divisions: [
  { id: 'div_prov_sg', name: '陕甘布政使司', children: [
    { id: 'div_xian', name: '西安府', populationDetail: { mouths: 3000000, households: 600000, ding: 600000 }, economyBase: { farmland: 2000000 } },
    { id: 'div_yanan', name: '延安府', populationDetail: { mouths: 2000000, households: 400000, ding: 400000 }, economyBase: { farmland: 1500000 } }
  ] }
] } } };
global.GM = { turn: 1, sid: 'sc-z', renliPilot: [{ region: '陕甘布政使司', seed: { soilBase: 65, waterworks: 45, doubleCropping: 1.0, laborMarketDepth: 0.2 } }],
  classes: [{ name: '农户', economicRole: '生产', satisfaction: 60, regionalVariants: [] }] };
R.ensureDefaults(global.GM, global.P);
R.endturnTick(global.GM, global.P);
var xian = R.leaves(global.P).filter(function (l) { return l.id === 'div_xian'; })[0];
var yanan = R.leaves(global.P).filter(function (l) { return l.id === 'div_yanan'; })[0];
ok(!!xian.renliSeed && !!yanan.renliSeed, '6·省名「陕甘布政使司」→展开种其全部府叶（西安府+延安府·省非叶子）');
var rXian = R.getRegion(global.GM, 'div_xian');
ok(rXian && rXian.corveeRate > 0, '6·西安府役负>0（府叶激活）');
ok(rXian && rXian.grainOutput > 0, '6·★西安府粮产>0（economyBase.farmland 作田源→农政层真活·非半激活）');
ok(rXian && rXian.cultivatedLand > 0, '6·西安府在耕田>0（田源 economyBase.farmland 生效）');
// 6b·上溯 key（A5/B 实证修·防省/府 key 错配双产）：全府已种子的省·其「省级 key」进 seededRegionKeySet→huji(按省 key)deep-field 让出整省
var ksH = R.seededRegionKeySet(global.P);
ok(ksH['陕甘布政使司'] === true && ksH['div_prov_sg'] === true, '6b·全府种子的省→省级 key(name+id)入 seededRegionKeySet（huji 按省 key 让出·真天启省/府层级去重）');
ok(ksH['div_xian'] === true && ksH['西安府'] === true, '6b·府叶 key 仍在（西安府 name+id）');

console.log('\n[smoke-renli-pilot-seed] ' + pass + ' 通过 / ' + fail + ' 失败');
if (fail) { console.error('失败项：\n - ' + fails.join('\n - ')); process.exit(1); }
process.exit(0);
