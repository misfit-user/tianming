#!/usr/bin/env node
'use strict';
/* smoke-armory — 军备/武库 Slice 1 数据层
 *   ① 建库(GM.guoku.armory 五类账本·幂等) ② add/spend(含 shortfall) ③ 兵种→需求(接 units sub/arm) ④ produce ⑤ supplyRatio ⑥ 永不崩
 */
const path = require('path');
global.window = {};
const AR = require(path.resolve(__dirname, '..', 'tm-armory.js'));
let A = 0, F = 0; function ok(c, m) { if (c) { A++; console.log('  ✓ ' + m); } else { F++; console.log('  ✗ FAIL: ' + m); } }
console.log('smoke-armory');

/* ① 建库 */
const GM = {};
const arm = AR.ensure(GM);
ok(GM.guoku && GM.guoku.armory === arm, '① GM.guoku.armory 建立(帑廪之下)');
ok(AR.CAT_KEYS.every(k => arm[k] && typeof arm[k].stock === 'number'), '① 五类军备账本就位(甲胄/兵刃/弓弩/火器/战马)');
ok(AR.CAT_KEYS.length === 5 && AR.CAT_KEYS.join('') === '甲胄兵刃弓弩火器战马', '① 五类齐·朝代中立类目名');
const before = JSON.stringify(GM.guoku.armory);
AR.ensure(GM);
ok(JSON.stringify(GM.guoku.armory) === before, '① ensure 幂等(再调不变)');

/* ② add / spend */
AR.add(GM, { 甲胄: 1000, 战马: 500 }, '采买');
ok(AR.stock(GM, '甲胄') === 1000 && AR.stock(GM, '战马') === 500, '② add 入账');
ok(arm['甲胄'].thisTurnIn === 1000, '② thisTurnIn 记本回合产');
const sp = AR.spend(GM, { 甲胄: 300, 战马: 200 }, '募兵');
ok(AR.stock(GM, '甲胄') === 700 && AR.stock(GM, '战马') === 300, '② spend 扣库');
ok(sp.deducted['甲胄'] === 300 && !sp.anyShort, '② 充足→无 shortfall');
ok(arm['甲胄'].thisTurnOut === 300, '② thisTurnOut 记本回合耗');
const sp2 = AR.spend(GM, { 战马: 1000 }, '募骑兵');
ok(AR.stock(GM, '战马') === 0 && sp2.shortfall['战马'] === 700 && sp2.anyShort, '② 库存不继→尽扣到0+记缺700(装备不能凭空)');

/* ③ 兵种→需求(接 units[] sub/arm) */
const n1 = AR.needForTroops('horse', 'cav', 1000);
ok(n1['战马'] === 1000 && n1['兵刃'] === 1000 && n1['甲胄'] === 1000, '③ 骑兵1000→战马1000+兵刃1000+甲胄1000');
const n2 = AR.needForTroops('musket', 'bow', 1000);
ok(n2['火器'] === 1000 && !n2['战马'] && n2['甲胄'] === 500, '③ 火器兵→火器+甲胄·不耗战马');
const n3 = AR.needForTroops('heavy', 'cav', 1000);
ok(n3['甲胄'] === 1600 && n3['战马'] === 1000, '③ 铁骑→甲胄×1.6(重甲)');
const units = [{ sub: 'spear', men: 1000 }, { sub: 'horse', men: 500 }, { sub: 'musket', men: 500 }];
const need = AR.needForUnits(units);
ok(need['兵刃'] === 1500 && need['战马'] === 500 && need['火器'] === 500, '③ 混编军 units[]→各类需求汇总(步兵刃+骑战马+铳火器)');
ok(AR.needForUnits([{ sub: '杜撰兵', men: 1000 }])['兵刃'] === 1000, '③ 未知兵种→默认需求(永不崩)');

/* ④ produce(军器局每回合) */
const GM2 = {}; AR.produce(GM2, 1);
ok(AR.stock(GM2, '甲胄') === 1200 && AR.stock(GM2, '火器') === 400, '④ produce 基础产能入库');
AR.produce(GM2, 0.5);
ok(AR.stock(GM2, '甲胄') === 1200 + 600, '④ produce scale 缩放产能(挂经费)');

/* ⑤ supplyRatio(装备充裕度·供品质/UI) */
const GM3 = {}; AR.add(GM3, { 甲胄: 700, 兵刃: 500 }, 't');
const ratio = AR.supplyRatio(GM3, [{ sub: 'spear', men: 1000 }]);  // 需 甲胄700/兵刃1000·有 甲胄700/兵刃500→worst=500/1000=0.5
ok(Math.abs(ratio - 0.5) < 0.01, '⑤ supplyRatio=最缺类比例(兵刃 500/1000=0.5)');
ok(AR.supplyRatio({}, [{ sub: 'spear', men: 100 }]) === 0, '⑤ 空库→充裕度0');
ok(AR.supplyRatio(GM3, []) === 1, '⑤ 无需求→1(不崩)');

/* ⑥ 永不崩 */
ok(AR.ensure(null) === null && AR.stock(null, '甲胄') === 0, '⑥ null GM→不崩');
AR.rollTurn(GM);
ok(arm['甲胄'].lastTurnIn === 1000 && arm['甲胄'].thisTurnIn === 0, '⑥ rollTurn 翻转本回合→last');

/* ⑦ 原料库(Slice 2:铁/硝石/皮革/木) */
const GM4 = {};
const M = AR.ensureMaterials(GM4);
ok(GM4.guoku && GM4.guoku.materials === M && AR.MAT_KEYS.join('') === '铁硝石皮革木', '⑦ GM.guoku.materials 建立(铁/硝石/皮革/木)');
ok(AR.MAT_KEYS.every(k => M[k] && typeof M[k].stock === 'number'), '⑦ 四类原料账本就位');
AR.matAdd(GM4, { 铁: 5000, 硝石: 800 }, '矿冶');
ok(AR.matStock(GM4, '铁') === 5000 && AR.matStock(GM4, '硝石') === 800, '⑦ matAdd 入原料库');
const ms = AR.matSpend(GM4, { 铁: 2000, 硝石: 1000 }, '军器局');
ok(AR.matStock(GM4, '铁') === 3000 && AR.matStock(GM4, '硝石') === 0 && ms.shortfall['硝石'] === 200, '⑦ matSpend 扣库·硝石不继记缺200');

/* ⑧ 地块原料产出派生(挂 economyBase·量级标定) */
const region = { economyBase: { mineralProduction: 1000000, horseProduction: 600, farmland: 5000000 }, tags: { mineralRegion: true } };
const out = AR.regionMaterialOutput(region);
ok(out['铁'] === Math.round(1000000 * 0.0015) && out['铁'] === 1500, '⑧ 矿区→铁(矿课值×0.0015·标定数万级)');
ok(out['硝石'] === 300 && out['皮革'] > 0 && out['木'] === 100, '⑧ 硝石(矿)/皮革(牧+耕牛)/木(农林)均有产·量级合理');
ok(AR.regionMaterialOutput({}).铁 === 0, '⑧ 空区划→0(不崩)');
/* collectMaterials 汇集多区划 */
const GM5 = {}; const regions = [region, { economyBase: { mineralProduction: 400000, farmland: 2000000 }, tags: {} }];
const tot = AR.collectMaterials(GM5, regions);
ok(AR.matStock(GM5, '铁') === out['铁'] + Math.round(400000 * 0.0015) && tot['铁'] > 0, '⑧ collectMaterials 汇集各区划铁产入库');
const parentRegion = { name: '汇总省', economyBase: { mineralProduction: 1400000, horseProduction: 600, farmland: 7000000 }, children: regions };
const treeGM = { adminHierarchy: { player: { divisions: [parentRegion] } } };
const sameMaterials = (a, b) => AR.MAT_KEYS.every(k => a[k] === b[k]);
ok(sameMaterials(AR.collectMaterials(treeGM), tot), '⑧ 父节点存下属合计时，四类原料只计叶子一次');
ok(AR.playerRegions(treeGM).length === 2 && !AR.playerRegions(treeGM).includes(parentRegion), '⑧ playerRegions 只返回玩家产量叶子');
ok(sameMaterials(AR.collectMaterials({}, [parentRegion, ...regions]), tot), '⑧ 显式 regions 混入父节点和同一子节点时不重计');
ok(sameMaterials(AR.collectMaterials({}, [{ economyBase: parentRegion.economyBase, children: [parentRegion] }]), tot), '⑧ 三级树只计最末级叶子，父级无论存什么数都不入账');
ok(sameMaterials(AR.collectMaterials({ regions: [parentRegion] }), tot), '⑧ 旧存档 GM.regions 存根节点时递归到叶子');
ok(sameMaterials(AR.collectMaterials({ regions: [parentRegion, ...regions] }), tot), '⑧ 旧存档 GM.regions 已展开时同一叶子只计一次');
const provinceOnly = [
  { name: '无下级省', level: '省', economyBase: region.economyBase },
  { name: '空下级省', level: '省', children: [], econ: region.economyBase }
];
const flatGM = { adminHierarchy: { player: { divisions: provinceOnly } } };
ok(sameMaterials(AR.collectMaterials(flatGM), { 铁: 3000, 硝石: 600, 皮革: 62, 木: 200 }), '⑧ 无 children 或 children 为空的省级节点照常计入，兼容 econ');
ok(AR.playerRegions(flatGM).length === 2, '⑧ 单层自定义剧本省级节点就是叶子');
ok(Object.keys(AR.collectMaterials(treeGM, [])).length === 0, '⑧ 显式空 regions 不回退整棵树');

/* ⑨ seedFromScenario 优先级:剧本显式 > 按军队派生 > 平默认 */
const savedTAU = global.window.TMArmyUnits; global.window.TMArmyUnits = undefined;   // 走 a.units 回退
const GM6 = { armies: [{ id: 'a1', units: [{ sub: 'spear', men: 500000 }, { sub: 'horse', men: 50000 }] }] };
AR.seedFromScenario(GM6, {});   // 无剧本armory→按军队派生
ok(AR.stock(GM6, '甲胄') > 40000 && AR.stock(GM6, '甲胄') === Math.round(400000 * 0.35), '⑨ 无剧本→按军队规模派生武库(甲胄140000≫平默认40000)');
ok(AR.stock(GM6, '战马') === Math.round(50000 * 0.35), '⑨ 派生战马=骑兵数×0.35(接兵种构成)');
const GM7 = { armies: [{ id: 'a', units: [{ sub: 'spear', men: 500000 }] }] };
AR.seedFromScenario(GM7, { armory: { 甲胄: 5000 } });   // 剧本显式→优先
ok(AR.stock(GM7, '甲胄') === 5000 && AR.stock(GM7, '兵刃') === 50000, '⑨ 剧本显式优先于派生·缺类回退平默认');
const GM8 = {};   // 无军→平默认
AR.seedFromScenario(GM8, {});
ok(AR.stock(GM8, '甲胄') === 40000, '⑨ 无军无剧本→平默认40000');
global.window.TMArmyUnits = savedTAU;

/* ⑩ 军工建筑产能 profile(S3:关键词默认 + AI核定优先) */
ok(AR.buildingArmoryProfile({ name: '火药局' }).produce['火器'] === 800, '⑩ 火药局→产火器(耗硝石铁)');
ok(AR.buildingArmoryProfile({ name: '京营军器局' }).produce['兵刃'] === 2000, '⑩ 军器局→产兵刃+甲胄(耗铁木)');
ok(AR.buildingArmoryProfile({ name: '太仆寺马场' }) === null, '⑩ 马场→非军工建筑(战马走马政·非建筑profile)');
ok(AR.buildingArmoryProfile({ name: '苏州织造局' }) === null && !AR.isArmoryWorks({ name: '书院' }), '⑩ 非军工建筑(织造/书院)→null');
const aiB = AR.buildingArmoryProfile({ name: '自拟·龙江兵工厂', effectsStructured: { armoryProfile: { produce: { 火器: 1500, 弓弩: 500 }, consume: { 硝石: 1000, 铁: 800 }, label: 'AI定' } } });
ok(aiB.produce['火器'] === 1500 && aiB.src === 'ai', '⑩ AI核定 armoryProfile 优先于关键词(自拟营建判产出类型)');
ok(AR.isArmoryWorks({ name: '铁工坊' }) && AR.isArmoryWorks({ name: '弓弩坊' }), '⑩ isArmoryWorks 识别军工建筑');

/* ⑪ 每回合军工生产执行(S3步3:耗原料产军备·原料不足减产·战马走马政) */
const GMp = { guoku: {} };
AR.matAdd(GMp, { 铁: 100000, 硝石: 50000, 木: 50000, 皮革: 30000 }, 'seed');
const reps = AR.runArmoryProduction(GMp, {
  buildings: [
    { name: '京营军器局', level: 2, status: 'completed' },   // 产兵刃4000甲胄1600·耗铁4400木1000
    { name: '火药局', level: 1, status: 'completed' },        // 产火器800·耗硝石600铁400
    { name: '在建甲坊', level: 1, status: 'building' }         // 在建→不产
  ], efficiency: 1
});
ok(reps.works === 2, '⑪ 仅在役军工建筑生产(在建不产)');
ok(AR.stock(GMp, '兵刃') === 4000 && AR.stock(GMp, '甲胄') === 1600 && AR.stock(GMp, '火器') === 800, '⑪ 军器局2级产兵刃4000甲胄1600+火药局产火器800');
ok(AR.matStock(GMp, '铁') === 100000 - 4800 && reps.consumed['铁'] === 4800, '⑪ 耗铁汇总(军器局4400+火药局400=4800)');
/* 原料不足→按最缺类比例减产 */
const GMq = { guoku: {} };
AR.matAdd(GMq, { 铁: 1100, 木: 100000 }, 'scarce');   // 军器局2级需铁4400·只1100→scale=0.25
AR.runArmoryProduction(GMq, { buildings: [{ name: '军器局', level: 2, status: 'completed' }], efficiency: 1 });
ok(AR.stock(GMq, '兵刃') === Math.round(4000 * 0.25), '⑪ 原料不足→按最缺类比例减产(铁1100/4400=0.25→兵刃1000)');
/* 战马走马政(Σ horseProduction) */
const GMh = { guoku: {}, regions: [{ economyBase: { horseProduction: 1000000 } }] };
const reph = AR.runArmoryProduction(GMh, { buildings: [], efficiency: 1 });
ok(reph.produced['战马'] === Math.round(1000000 * 0.004) && AR.stock(GMh, '战马') === 4000, '⑪ 战马走马政(Σ horseProduction×0.004=4000)');
ok(AR.runArmoryProduction(treeGM, { buildings: [], efficiency: 1 }).produced['战马'] === 2, '⑪ 父节点有马政合计时只取叶子 600×0.004，整组最后取整');
ok(AR.runArmoryProduction({}, { regions: [parentRegion, ...regions], buildings: [], efficiency: 1 }).produced['战马'] === 2, '⑪ 显式传入父子混合列表，马政不重复');
ok(AR.runArmoryProduction({ regions: [parentRegion] }, { buildings: [], efficiency: 1 }).produced['战马'] === 2, '⑪ 旧存档 GM.regions 根节点马政取叶子');
ok(AR.runArmoryProduction(flatGM, { buildings: [], efficiency: 1 }).produced['战马'] === 5, '⑪ 单层省级与 econ 旧字段马政照常计入');
const namedGM = { playerFaction: '本朝', adminHierarchy: { 本朝: { divisions: [parentRegion] }, 邻国: { divisions: [{ economyBase: { mineralProduction: 9000000, horseProduction: 9000000 } }] } } };
ok(AR.playerRegions(namedGM).length === 2, '⑪ 势力名分支只取本方叶子');
const playerTurn = AR.runTurn(namedGM, { buildings: [], efficiency: 1 });
ok(playerTurn.produced['战马'] === 2 && sameMaterials(AR.matAllStock(namedGM), tot), '⑪ 整回合原料及马政均不计邻国或父级合计');
const unknownKeyGM = { adminHierarchy: { 旧键: { divisions: [parentRegion] } } };
ok(AR.playerRegions(unknownKeyGM).length === 2, '⑪ 无玩家键的旧存档保持原回退范围，但只收叶子');
const buildingGM = { adminHierarchy: { player: { divisions: [{
  economyBase: parentRegion.economyBase, children: regions,
  buildings: [{ name: '省级军器局', level: 1, status: 'completed' }]
}] } } };
AR.matAdd(buildingGM, { 铁: 2200, 木: 500 }, 'seed');
const parentWorks = AR.runArmoryProduction(buildingGM, { efficiency: 1, noSilver: true });
ok(parentWorks.works === 1 && parentWorks.produced['兵刃'] === 2000 && parentWorks.produced['甲胄'] === 800, '⑪ 父级军工建筑仍收集并生产，不受产量叶子筛选影响');
ok(parentWorks.produced['战马'] === 2 && AR.matStock(buildingGM, '铁') === 0, '⑪ 保留父级建筑耗料，同时排除父级马政');
/* runTurn 整回合:地块产原料→军工生产·rollTurn 翻转 */
const GMt = { guoku: {}, regions: [{ economyBase: { mineralProduction: 10000000, horseProduction: 500000 } }] };
const rept = AR.runTurn(GMt, {});
ok(AR.matStock(GMt, '铁') > 0 && reph.produced['战马'] !== undefined, '⑪ runTurn 整回合(收原料+军工+马政)');

/* ⑫ 募兵消耗武库 + 缺装备惩罚(S5·node 无 TMArmyUnits→走 a.units) */
const GMr = { guoku: {} };
AR.add(GMr, { 甲胄: 100000, 兵刃: 100000, 战马: 50000 }, 'seed');
const eq1 = AR.consumeForRecruit(GMr, { name: '京营', soldiers: 10000, units: [{ sub: 'spear', men: 10000 }] }, 10000);
ok(AR.stock(GMr, '甲胄') === 100000 - 7000 && AR.stock(GMr, '兵刃') === 100000 - 10000, '⑫ 募兵从武库扣装备(步兵甲胄7000兵刃10000)');
ok(!eq1.anyShort && eq1.condition === null, '⑫ 武库充足→无缺口·不降装备');
AR.add(GMr, { 甲胄: 100000, 兵刃: 100000 }, 'refill');
const before甲 = AR.stock(GMr, '甲胄');
AR.consumeForRecruit(GMr, { name: '边军', soldiers: 10000, units: [{ sub: 'spear', men: 10000 }] }, 5000);   // 增量5000/总10000→frac0.5
ok(before甲 - AR.stock(GMr, '甲胄') === 3500, '⑫ 增量按比例取新卒需求(5000/10000→半需求甲胄3500)');
const GMs = { guoku: {} };
AR.add(GMs, { 甲胄: 1000 }, 'scarce');   // 仅甲胄1000·无兵刃
const eq3 = AR.consumeForRecruit(GMs, { name: '新军', soldiers: 10000, units: [{ sub: 'spear', men: 10000 }] }, 10000);
ok(eq3.anyShort && eq3.condition && eq3.moralePenalty > 0, '⑫ 武库不继→缺装备(简陋/不足)+士气罚');
ok(eq3.shortRatio > 0.5 && eq3.condition === '严重不足', '⑫ 缺口>50%→严重不足');
ok(AR.stock(GMs, '甲胄') === 0, '⑫ 武库尽扣(甲胄1000→0)');
const eq4 = AR.consumeForRecruit({ guoku: {} }, { name: '无units军', soldiers: 5000 }, 5000);   // 无units→按兵力估
ok(eq4.need['甲胄'] === 3000 && eq4.need['兵刃'] === 5000, '⑫ 无units→按兵力估(甲胄0.6兵刃1)');

/* ⑬ 军工效率(工部主官×腐败)+ 经费(银) */
const GMe1 = { guoku: {}, chars: [{ name: '良工', officialTitle: '工部尚书', intelligence: 90 }], corruption: { trueIndex: 0 } };
AR.matAdd(GMe1, { 铁: 1000000, 木: 1000000 }, 's');
const re1 = AR.runArmoryProduction(GMe1, { buildings: [{ name: '军器局', level: 1, status: 'completed' }], noSilver: true });
ok(re1.efficiency > 1.0, '⑬ 良工部尚书(智90)+无腐败→效率>1(实=' + re1.efficiency + ')');
const GMe2 = { guoku: {}, chars: [], corruption: { trueIndex: 80 } };
AR.matAdd(GMe2, { 铁: 1000000, 木: 1000000 }, 's');
const re2 = AR.runArmoryProduction(GMe2, { buildings: [{ name: '军器局', level: 1, status: 'completed' }], noSilver: true });
ok(re2.efficiency < 0.7, '⑬ 无主官+重腐败(80)→效率<0.7(实=' + re2.efficiency + '·腐败截留军工)');
ok(re1.produced['兵刃'] > re2.produced['兵刃'], '⑬ 高效率产更多(' + re1.produced['兵刃'] + '>' + re2.produced['兵刃'] + ')');
ok(re1.silverCost > 0, '⑬ 军工耗银经费(silverCost=' + re1.silverCost + ')');

/* ⑬ 会战缴获(双向) */
global.window.P = { playerInfo: { factionName: '明' } };
const GMb = { guoku: {}, armies: [{ id: 'p1', faction: '明', soldiers: 5000, units: [{ sub: 'spear', men: 5000 }] }, { id: 'e1', faction: '后金', soldiers: 5000, units: [{ sub: 'spear', men: 5000 }] }] };
const spw = AR.battleSpoils(GMb, { winnerFactionId: '明', affectedArmies: [{ armyId: 'p1', loss: 500, faction: '明' }, { armyId: 'e1', loss: 2000, faction: '后金' }] }, '明');
ok(spw.playerWon && spw.anyCaptured && AR.stock(GMb, '兵刃') === Math.round(1 * 2000 * 0.3), '⑬ 玩家胜→从败敌(后金损2000)缴获兵刃600入武库');
ok(AR.stock(GMb, '甲胄') === Math.round(0.7 * 2000 * 0.3), '⑬ 缴获按败军兵种(枪兵甲胄0.7→420)');
const GMb2 = { guoku: {}, armies: [{ id: 'p2', faction: '明', soldiers: 5000, equipmentCondition: '一般', units: [{ sub: 'spear', men: 5000 }] }] };
AR.battleSpoils(GMb2, { winnerFactionId: '后金', affectedArmies: [{ armyId: 'p2', loss: 2000, faction: '明' }] }, '明');
ok(GMb2.armies[0].equipmentCondition === '简陋', '⑬ 玩家败→败军装备折损(一般→简陋)');
ok(AR.battleSpoils(GMb, { affectedArmies: [] }, '明') === null, '⑬ 空战果→null(不崩)');
ok(AR.battleSpoils(GMb, { winnerFactionId: '后金', affectedArmies: [{ armyId: 'x', loss: 100, faction: '蒙古' }] }, '明').playerWon === false, '⑬ 非玩家战(明未参/未胜)→不入我武库');
global.window.P = undefined;

/* ⑭ 采买(银→军备·市价溢价·国库不继按可负担减采·node 无 FiscalEngine→不扣银只验量) */
const GMpr = { guoku: { money: 100000 } };
const pr1 = AR.procure(GMpr, '火器', 300, {});
ok(AR.stock(GMpr, '火器') === 300 && pr1.cost === 1200, '⑭ 采买火器300→入武库·费银1200(市价4)');
const pr2 = AR.procure(GMpr, '战马', 500, {});
ok(AR.stock(GMpr, '战马') === 500 && pr2.cost === 6000, '⑭ 采买战马500·费银6000(马贵·买比造贵)');
const GMpoor = { guoku: { money: 600 } };
const pr3 = AR.procure(GMpoor, '火器', 1000, {});   // 需4000银·只600→afford0.15→买150
ok(pr3.realQty === Math.round(1000 * 600 / 4000) && pr3.afford < 1, '⑭ 国库不继→按可负担减采(600/4000→买150)');
const GMmat = { guoku: { money: 100000 } };
AR.procure(GMmat, '硝石', 1000, {});
ok(AR.matStock(GMmat, '硝石') === 1000, '⑭ 采买原料(硝石→入原料库)');
ok(AR.procure(GMpr, '杜撰兵器', 100) === null && AR.procure(GMpr, '火器', 0) === null, '⑭ 无效类目/0量→null(不崩)');
ok(AR.procure({ guoku: { money: 100000 } }, '甲胄', 100, { unitPrice: 2 }).cost === 200, '⑭ opts.unitPrice 覆盖市价');

console.log('\n结果: ' + A + ' 通过 / ' + F + ' 失败');
process.exit(F ? 1 : 0);
