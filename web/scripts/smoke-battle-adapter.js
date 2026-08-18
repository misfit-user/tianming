#!/usr/bin/env node
'use strict';
/* smoke-battle-adapter — 御驾亲征接入 Phase1「适配器」
 *   军 units[](Phase0) → startBattle(config):兵牌映射/将领翻GM.chars/方名faction/规模压缩≤35方/御营/地形档·总数守恒·永不崩
 */
const path = require('path');
global.window = { TMArmyUnits: require(path.resolve(__dirname, '..', 'tm-army-units.js')) };
global.P = { time: { startYear: 1600, startMonth: 1, startDay: 1 } };
global._getDaysPerTurn = () => 30;
require(path.resolve(__dirname, '..', 'tm-time-utils.js'));
const ADP = require(path.resolve(__dirname, '..', 'tm-battle-adapter.js'));
let A = 0, F = 0;
function ok(c, m) { if (c) { A++; console.log('  ✓ ' + m); } else { F++; console.log('  ✗ FAIL: ' + m); } }

console.log('smoke-battle-adapter');

const GM = { chars: [{ name: '岳飞', valor: 95, military: 92, intelligence: 88 }, { name: '完颜宗弼', valor: 90, military: 88, intelligence: 80 }] };
const player = [{ id: 'pa1', name: '背嵬军', faction: '宋', commander: '岳飞', morale: 85, training: 80, supply: 84, quality: '精锐',
  composition: [{ type: '背嵬铁骑', count: 2000 }, { type: '神臂弩', count: 1200 }, { type: '长枪步人甲', count: 3000 }] }];
const enemy = [{ id: 'ea1', name: '金军', faction: '金', commander: '完颜宗弼', morale: 84, training: 82, supply: 82, quality: '精锐',
  composition: [{ type: '铁浮屠', count: 2500 }, { type: '拐子马', count: 2000 }] }];

const cfg = ADP.buildBattleConfig(player, enemy, { provinceName: '郾城', terrainTag: '平原', weather: 'clear', playerFactionName: '宋军', enemyFactionName: '金军', emperorArmyId: 'pa1', GM: GM });

/* ① 基本形状 */
ok(cfg.armies && cfg.armies.ming.length > 0 && cfg.armies.jin.length > 0, '① 双方兵牌非空');
ok(cfg.sideName.ming === '宋军' && cfg.sideName.jin === '金军', '① 方名由 faction 传入(朝代中立)');
ok(cfg.lead === '完颜宗弼', '① 敌帅=敌军主将');
ok(cfg.emperorSide === 'ming', '① emperorSide=ming(玩家方)');

/* ② 兵牌字段(原型 roster 形状) */
const t0 = cfg.armies.ming[0];
ok(t0.type && t0.sub && t0.name && t0.soldiers > 0 && t0.gen, '② 兵牌含 type/sub/name/soldiers/gen');
ok(t0.parentArmyId === 'pa1', '② parentArmyId 回填母军');

/* ③ 将领翻 GM.chars(valor/military/intelligence → valor/mil/int) */
const yf = cfg.armies.ming.find(u => u.gen && u.gen.n === '岳飞');
ok(yf && yf.gen.valor === 95 && yf.gen.mil === 92 && yf.gen.int === 88, '③ 主将岳飞 valor95/mil92/int88(翻GM.chars)');
ok(cfg.armies.ming.some(u => u.gen.n === '裨将'), '③ 麾下分队挂裨将(非全具名英雄)');

/* ④ 兵种识别(经 units[] 派生) */
ok(cfg.armies.ming.some(u => u.type === 'cav'), '④ 背嵬铁骑→cav');
ok(cfg.armies.ming.some(u => u.sub === 'crossbow'), '④ 神臂弩→crossbow');
ok(cfg.armies.ming.some(u => u.sub === 'spear'), '④ 长枪步人甲→spear');
ok(cfg.armies.jin.some(u => u.type === 'cav'), '④ 铁浮屠/拐子马→cav');

/* ⑤ 总数守恒(玩家 2000+1200+3000=6200·敌 2500+2000=4500) */
ok(cfg.armies.ming.reduce((s, u) => s + u.soldiers, 0) === 6200, '⑤ 我方兵牌总数守恒=6200');
ok(cfg.armies.jin.reduce((s, u) => s + u.soldiers, 0) === 4500, '⑤ 敌方兵牌总数守恒=4500');

/* ⑥ 御营标记(emperorArmyId 的军首队) */
ok(cfg.armies.ming.some(u => u.emperor === true), '⑥ 御营首队标 emperor');
ok(cfg.armies.ming.filter(u => u.emperor).length === 1, '⑥ 仅一御营队');

/* ⑦ 地形档(省标签→genMap dens/biome) + 地图种子确定性 */
ok(cfg.terrainProfile && cfg.terrainProfile.dens === 0.18 && cfg.terrainProfile.biome === 'plain', '⑦ 平原→dens0.18/plain');
ok(cfg.mapSeed === ADP.buildBattleConfig(player, enemy, { provinceName: '郾城', GM: GM }).mapSeed, '⑦ 同省名→同地图种子(确定性)');
ok(ADP.provinceSeed('郾城') !== ADP.provinceSeed('朱仙镇'), '⑦ 异省名→异种子');

/* ⑧ 规模压缩:场上≤35队/方·超出入 reserves */
const big = [{ id: 'big', name: '大军', commander: '某', morale: 70, training: 60, composition: [{ type: '步兵', count: 40000 }] }];
const bc = ADP.buildBattleConfig(big, enemy, { provinceName: 'X', GM: GM });
ok(bc.armies.ming.length === 35, '⑧ 40000人(40队)→场上封顶35队');
ok(bc.reserves.ming.length === 5, '⑧ 溢出5队入 reserves(波次)');
ok(bc.meta.mingTotal === 40, '⑧ meta 记总队数40');

/* ⑨ 永不崩 */
ok(Array.isArray(ADP.buildBattleConfig([], [], {}).armies.ming), '⑨ 空军群→不崩(空兵牌)');
ok(ADP.buildBattleConfig([{ id: 'q', commander: '无名', composition: [] }], [], { GM: GM }).armies.ming.length === 0, '⑨ 空 composition 军→0兵牌');

/* ⑩ 兵种分层取样:场上保多样性(非「按队序取前N」把骑/炮/铳挤光) */
const mix = [{ id: 'mix', name: '混编大军', commander: '某', morale: 70, training: 60, composition: [
  { type: '步兵', count: 50000 }, { type: '骑兵', count: 3000 }, { type: '火铳兵', count: 2000 }, { type: '炮兵', count: 1000 }] }];   // 56队·步兵50压顶
const mc = ADP.buildBattleConfig(mix, enemy, { provinceName: 'Y', GM: GM });
ok(mc.armies.ming.length === 35, '⑩ 混编56队→场上封顶35');
const fieldSubs = {}; mc.armies.ming.forEach(u => fieldSubs[u.sub] = 1);
ok(Object.keys(fieldSubs).length >= 4, '⑩ 场上≥4兵种(分层取样·非截断成单一步兵)·实=' + Object.keys(fieldSubs).join(','));
ok(mc.armies.ming.some(u => u.type === 'cav') && mc.armies.ming.some(u => u.type === 'art') && mc.armies.ming.some(u => u.sub === 'musket'), '⑩ 骑/炮/铳都上场(不被步兵挤光)');
ok(mc.armies.ming.filter(u => u.sub === 'sword').length > mc.armies.ming.filter(u => u.type === 'cav').length, '⑩ 仍保比例:步兵(50)上场数 > 骑兵(3)');
/* selectOnField 御营强制上场 */
const toks = []; for (let i = 0; i < 50; i++) toks.push({ sub: 'sword', men: 500 }); toks.push({ sub: 'cannon', emperor: true, men: 800 });
const sel = ADP.selectOnField(toks, 35);
ok(sel.field.length === 35 && sel.field.some(t => t.emperor), '⑩ selectOnField:御营队强制上场(不沉预备队)');
ok(ADP.selectOnField(toks, 60).reserve.length === 0, '⑩ selectOnField:总数≤cap→全上场无预备');

/* ⑪ 装备态→品质降级(S6·武库供械不足→战术品质降) */
ok(ADP.degradeQualityByEquip('精锐', '简陋') === '精兵', '⑪ 简陋→降1档(精锐→精兵)');
ok(ADP.degradeQualityByEquip('精锐', '严重不足') === '普通', '⑪ 严重不足→降2档(精锐→普通)');
ok(ADP.degradeQualityByEquip('精锐', '优良') === '精锐' && ADP.degradeQualityByEquip('精锐', '') === '精锐', '⑪ 优良/空→不降');
ok(ADP.degradeQualityByEquip('新募', '严重不足') === '新募', '⑪ 已最低→不再降(地板)');
const eqArmy = [{ id: 'eq', name: '简陋军', faction: '宋', commander: '某', morale: 70, training: 60, quality: '精锐', equipmentCondition: '简陋', composition: [{ type: '长枪兵', count: 2000 }] }];
const eqCfg = ADP.buildBattleConfig(eqArmy, enemy, { GM: GM });
ok(eqCfg.armies.ming[0].quality === '精兵', '⑪ unitToToken 按 equipmentCondition 降兵牌品质(简陋·精锐→精兵)');

/* ⑫ 复合地形标签(Phase4:"平原/山地"取已知子标签 dens 均值·biome 取首个已知) */
ok(ADP.terrainProfile('山地').dens === 0.52 && ADP.terrainProfile('山地').biome === 'verdant', '⑫ 单标签 山地→dens0.52/verdant(不变)');
const cp = ADP.terrainProfile('平原/山地');
ok(cp && cp.dens === 0.35 && cp.biome === 'plain', '⑫ 复合 平原/山地→dens均值0.35·biome取首个(plain)·实=' + JSON.stringify(cp));
ok(ADP.terrainProfile('沿海/海域').dens === 0.22 && ADP.terrainProfile('沿海/海域').biome === 'verdant', '⑫ 复合 沿海/海域→忽略未知海域·取沿海0.22');
ok(ADP.terrainProfile('高原/边塞').biome === 'plain', '⑫ 复合 高原/边塞→biome取首个高原(plain)');
ok(ADP.terrainProfile('汪洋大海') === null && ADP.terrainProfile('') === null, '⑫ 全未知/空→null(原型用默认随机感)');
ok(ADP.terrainProfile('漠南草原').dens === 0.10, '⑫ 数据新标签 漠南草原→0.10');

/* ⑬ resolveTerrainTag:军队所在省 → 地形标签(读 adminHierarchy·府州继承省地形·永不崩) */
const GM3 = { adminHierarchy: { player: { factionName: '明', divisions: [
  { name: '北直隶', level: 'province', terrain: '平原', mapRegionId: 'ming-01', children: [
    { name: '蓟州', level: 'prefecture' }, { name: '顺天府', level: 'prefecture' } ] },   // 子节点无 terrain·须继承省
  { name: '云南', level: 'province', terrain: '山地', mapRegionId: 'ming-20', children: [] },
  { name: '蒙古高原', level: 'province', terrain: '草原/漠南草原', mapRegionId: 'mon-01', children: [] } ] } } };
ok(ADP.resolveTerrainTag(GM3, { mapRegionId: 'ming-20' }) === '山地', '⑬ regionId 直配→山地');
ok(ADP.resolveTerrainTag(GM3, { location: '云南' }) === '山地', '⑬ location 全等省名→山地');
ok(ADP.resolveTerrainTag(GM3, { location: '蓟州/丰润', garrison: '蓟州' }) === '平原', '⑬ 军驻府州(蓟州)→继承省(北直隶)平原');
ok(ADP.resolveTerrainTag(GM3, { location: '不存在之地' }) === '', '⑬ 无匹配→\'\'(原型用默认)');
ok(ADP.resolveTerrainTag({}, { location: '云南' }) === '' && ADP.resolveTerrainTag(GM3, null) === '', '⑬ 无 adminHierarchy/无军→\'\'(永不崩)');
ok(ADP.resolveTerrainTag(GM3, { regionHint: '蒙古高原' }) === '草原/漠南草原', '⑬ regionHint→复合标签原样返回(交 terrainProfile 拆)');
ok(ADP.resolveTerrainTag(GM3, { location: '蓟州-遵化' }) === '平原', '⑬ 连字符位置(蓟州-遵化)→拆出蓟州→省平原(真数据"宁远-锦州"式)');
ok(ADP.resolveTerrainTag(GM3, { location: '北直·通州' }) === '平原', '⑬ 间隔号位置(北直·通州)→北直含于北直隶→平原(真数据式)');
ok(ADP.resolveTerrainTag(GM3, { location: '福建沿海' }) === '沿海', '⑬ 末级兜底:无省匹配→位置文本含地形词(沿海)直接采用(真数据水师式)');
ok(ADP.resolveTerrainTag(GM3, { location: '某地漠南草原' }) === '漠南草原', '⑬ 地形词兜底:长词优先(漠南草原 先于 草原)');
ok(ADP.resolveTerrainTag(GM3, { location: '全国 329 卫' }) === '', '⑬ 无省无地形词(全国聚合军)→\'\'(优雅回退默认地形)');

/* ⑭ deriveWeather / seasonOf:统一历法日期→季节→天候(确定性·冬→雪) */
ok(ADP.seasonOf({ turn: 1 }) === '冬' && ADP.seasonOf({ turn: 3 }) === '春', '⑭ 回合按统一历法日期判季节，不再四回合硬轮转');
ok(ADP.deriveWeather({ turn: 12 }) === 'snow' && ADP.deriveWeather({ turn: 6 }) === 'clear', '⑭ 冬→snow·夏→clear');
ok(ADP.seasonOf({ dateText: '天启七年腊月' }) === '冬' && ADP.deriveWeather({ dateText: '天启七年腊月' }) === 'snow', '⑭ 纪年文本 腊月→冬→snow(优先月份)');
ok(ADP.seasonOf({ time: '崇祯二年九月' }) === '秋' && ADP.seasonOf({ turn: 99, monthText: '三月' }) === '春', '⑭ 九月→秋·三月→春(月份优先于turn)');
ok(ADP.deriveWeather({}) === 'snow' && ADP.deriveWeather(null) === 'snow', '⑭ 无回合时按统一历法起始日判季节且不崩');

/* ⑮ buildBattleConfig 自解析:未显式传 terrainTag/weather → 由 GM+主军所在省/季节推导 */
const winterArmy = [{ id: 'wa', name: '蓟镇军', faction: '明', commander: '某', morale: 70, training: 60, location: '蓟州', composition: [{ type: '长枪兵', count: 2000 }] }];
const acfg = ADP.buildBattleConfig(winterArmy, enemy, { GM: GM3, playerFactionName: '明军' });   // 无 terrainTag/weather/provinceName
ok(acfg.terrainProfile && acfg.terrainProfile.dens === 0.18, '⑮ 自解析:蓟州→省平原→dens0.18(未显式传 terrainTag)');
ok(acfg.meta.terrainTag === '平原', '⑮ meta 记解析出的 terrainTag=平原');
ok(acfg.mapSeed === ADP.provinceSeed('蓟州'), '⑮ 自解析:provinceName 缺→取主军 location(蓟州)当种子');
const acfg2 = ADP.buildBattleConfig(winterArmy, enemy, { GM: { turn: 12 }, terrainTag: '草原' });   // 显式 terrainTag 覆盖·GM 冬
ok(acfg2.terrainProfile.biome === 'plain' && acfg2.weather === 'snow', '⑮ 显式 terrainTag 优先·weather 仍由冬季自解析→snow');

/* ⑯ 修饰位 flags 透传(§3 v2 LLM直出flag拼装):队 flags→token flags(白名单滤)·无 flags 不加字段 */
const tokF = ADP.unitToToken({ id: 'q1', arm: 'cav', sub: 'shock', '番号': '象兵', men: 600, '历练': 40, flags: ['scare', 'slow', 'shock', 'miscellaneous', 'bogus'] }, { id: 'a9', morale: 70 }, null);
ok(JSON.stringify(tokF.flags) === '["scare","slow","shock"]', '⑯ token flags 白名单透传(miscellaneous/bogus 滤除)');
const tokN = ADP.unitToToken({ id: 'q2', arm: 'step', sub: 'spear', '番号': '长枪', men: 800, '历练': 30 }, { id: 'a9', morale: 70 }, null);
ok(!('flags' in tokN), '⑯ 无 flags 队→token 不加字段(原型 hasFlag 恒 false·哈希不扰)');

/* ⑰ 地形词表扩表:全部观测词覆盖(无分隔复合词经 _matchMorphemes 拆解·不再落默认 dens0.3) */
const OBSERVED = ['山地', '平原', '沿海', '丘陵', '平原/山地', '山地海岸', '草原', '高原山地', '草原河套', '绿洲盆地', '盆地绿洲', '草原荒漠', '山地草原', '寒地岛屿林海', '寒地山林海岸', '北方草原', '山前草原', '寒地林海', '沿海/群岛', '红河与中南半岛山河', '漠南草原', '漠北草原', '山地平原海岸', '山地/沿海', '沿海/海域'];   // tianqi-ming2 实测 25 种
const uncovered = OBSERVED.filter(t => ADP.terrainProfile(t) === null);
ok(uncovered.length === 0, '⑰ 25 观测词全覆盖(0 落默认)·未覆盖=' + JSON.stringify(uncovered));
ok(ADP.terrainProfile('山地海岸').dens === 0.38 && ADP.terrainProfile('山地海岸').coast === true, '⑰ 无分隔复合 山地海岸→拆山地0.52+海岸0.24=0.38·coast');
ok(ADP.terrainProfile('高原山地').biome === 'plain' && ADP.terrainProfile('高原山地').dens === 0.39, '⑰ 无分隔复合 高原山地→biome首个高原(plain)·dens均值0.39');
ok(ADP.terrainProfile('寒地岛屿林海').biome === 'snow' && ADP.terrainProfile('寒地岛屿林海').island === true, '⑰ 寒地岛屿林海→snow·island');
ok(ADP.terrainProfile('漠北草原').dens === 0.10 && ADP.terrainProfile('漠北草原').biome === 'plain', '⑰ 漠北草原(非直配)→扫出草原0.10/plain');

/* ⑱ 语义位 {coast/island/desert/wetland/fort}:复合标签提取不再丢弃·并取 */
ok(ADP.terrainProfile('沿海').coast === true, '⑱ 沿海→coast');
ok(ADP.terrainProfile('沿海/群岛').coast === true && ADP.terrainProfile('沿海/群岛').island === true, '⑱ 沿海/群岛→coast+island');
ok(ADP.terrainProfile('草原荒漠').desert === true, '⑱ 草原荒漠→desert');
ok(ADP.terrainProfile('绿洲盆地').desert === true && ADP.terrainProfile('绿洲盆地').biome === 'desert', '⑱ 绿洲盆地→desert 位+desert biome(新主题可达)');
ok(ADP.terrainProfile('草原河套').wetland === true, '⑱ 草原河套→wetland');
ok(ADP.terrainProfile('边塞').fort === true && ADP.terrainProfile('边堡').fort === true, '⑱ 边塞/边堡→fort');
ok(ADP.terrainProfile('水乡').biome === 'wetland' && ADP.terrainProfile('水乡').wetland === true, '⑱ 水乡→wetland biome+wetland 位');
ok(!ADP.terrainProfile('山地').coast && !ADP.terrainProfile('平原').fort, '⑱ 无语义位地貌不误报(山地非coast·平原非fort)');

/* ⑲ deriveWeather 加雾:春秋按省址+回合确定性小概率雾(非 Math.random)·冬雪优先·空省名不起雾 */
ok(ADP.deriveWeather({ turn: 3 }, '开封') === 'fog', '⑲ 春·开封→fog(确定性派生)');
ok(ADP.deriveWeather({ turn: 3 }, '开封') === ADP.deriveWeather({ turn: 3 }, '开封'), '⑲ 同省+同回合→恒一致(确定性·非随机)');
ok(ADP.deriveWeather({ turn: 3 }, '蓟州') === 'clear', '⑲ 春·蓟州→clear(未中雾概率)');
ok(ADP.deriveWeather({ turn: 12 }, '开封') === 'snow', '⑲ 冬雪优先于雾(即便省址会起雾)');
ok(ADP.deriveWeather({ turn: 6 }, '开封') === 'clear', '⑲ 夏无雾(仅春秋)');
ok(ADP.deriveWeather({ turn: 3 }) === 'clear' && ADP.deriveWeather({ turn: 9 }) === 'clear', '⑲ 裸调无省名→不起雾(需真实战场上下文)');
ok(ADP.deriveWeather({ turn: 9 }, '   ') === 'clear' && ADP.deriveWeather({ turn: 3 }, '\t ') === 'clear', '⑲ 纯空白省名(trim后空)→不起雾(边界)');
ok(ADP.deriveWeather({ turn: 9 }, ' 开封 ') === ADP.deriveWeather({ turn: 9 }, '开封'), '⑲ 首尾空格 trim 标准化(" 开封 "≡"开封")');
const fogScan = ['宁远', '广州', '南京', '开封', '兰州', '昆明', '长沙', '蓟州', '大同', '福州'].map(p => ADP.deriveWeather({ turn: 9 }, p));
ok(fogScan.includes('fog') && fogScan.includes('clear'), '⑲ 秋季省份雾/晴皆可达(概率roll生效·非全雾/全晴)');
/* buildBattleConfig 端到端:春季军队→terrainProfile 带语义位透传 config */
const seaArmy = [{ id: 'sea', name: '水师', faction: '明', commander: '某', morale: 70, training: 60, composition: [{ type: '水兵', count: 2000 }] }];
const seaCfg = ADP.buildBattleConfig(seaArmy, enemy, { GM: GM, terrainTag: '沿海/群岛' });
ok(seaCfg.terrainProfile.coast === true && seaCfg.terrainProfile.island === true, '⑲ buildBattleConfig 透传语义位(沿海/群岛→coast+island 入 config.terrainProfile)');

/* ⑳ provinceMeta 省实况桥(梯队三E:读 GM.mapData.regions/oceans → capitalName/resources/oceanSide/neighborDir·确定性·拿不到省略) */
const MDGM = { chars: GM.chars, mapData: {
  oceans: [{ name: '渤海', center: [781, 314.6] }, { name: '黄海', center: [792.5, 341.9] }, { name: '东海', center: [814.6, 425.4] }, { name: '台湾海峡', center: [757.3, 488.6] }, { name: '南海', center: [697.3, 552] }],   // 真实洋中心(福建最近=台湾海峡·在东)
  regions: [
    { id: 'ming-01', name: '北直隶', center: [721.1, 321.5], terrain: '平原', resources: ['漕运', '煤', '铁', '海盐(长芦)'], data: { officialPosition: '顺天巡抚' } },   // 内陆·官职派生 顺天府
    { id: 'ming-fj', name: '福建', center: [751.8, 470], terrain: '沿海', resources: ['海贸', '茶', '海船'], data: { officialPosition: '福建巡抚' } },               // 沿海·东临黄海
    { id: 'ming-sd', name: '山东', center: [760, 330], terrain: '平原', resources: ['盐', '麦'], data: { officialPosition: '山东巡抚', capitalChildId: 'c1', children: [{ id: 'c1', name: '济南府' }, { id: 'c2', name: '兖州府' }] } },   // children+capitalChildId
    { id: 'ming-gd', name: '广东', center: [682.4, 500], terrain: '沿海', resources: ['海贸', '盐', '铁'], data: { officialPosition: '广东巡抚' } }
  ]
} };
const pmA = [{ id: 'pmA', name: '京营', faction: '明', commander: '岳飞', location: '北直隶', composition: [{ type: '长枪兵', count: 3000 }] }];
const pmE = [{ id: 'pmE', name: '敌军', faction: '金', commander: '完颜宗弼', location: '山东', composition: [{ type: '骑兵', count: 2000 }] }];   // 山东在北直隶之东
const pm1 = ADP.buildBattleConfig(pmA, pmE, { GM: MDGM });
ok(pm1.terrainProfile && pm1.terrainProfile.provinceMeta, '⑳ terrainProfile 挂 provinceMeta');
ok(pm1.terrainProfile.provinceMeta.capitalName === '顺天府', '⑳ 北直隶→省会顺天府(officialPosition 顺天巡抚派生·前缀≠省名)·实=' + pm1.terrainProfile.provinceMeta.capitalName);
ok(JSON.stringify(pm1.terrainProfile.provinceMeta.resources) === '["漕运","煤"]', '⑳ 资源截前2军政风物·实=' + JSON.stringify(pm1.terrainProfile.provinceMeta.resources));
ok(pm1.terrainProfile.provinceMeta.neighborDir === 'E', '⑳ 敌驻山东(东)→neighborDir=E·实=' + pm1.terrainProfile.provinceMeta.neighborDir);
ok(!pm1.terrainProfile.provinceMeta.oceanSide, '⑳ 北直隶非沿海→无 oceanSide(仅沿海省有)');
/* 沿海省:oceanSide + 敌自北 */
const fjA = [{ id: 'fjA', name: '闽军', faction: '明', commander: '某', location: '福建', composition: [{ type: '水兵', count: 2000 }] }];
const fjE = [{ id: 'fjE', name: '敌', faction: '金', commander: '某', location: '北直隶', composition: [{ type: '步兵', count: 1500 }] }];   // 北直隶在福建之北
const pm2 = ADP.buildBattleConfig(fjA, fjE, { GM: MDGM, terrainTag: '沿海' });
ok(pm2.terrainProfile.provinceMeta.oceanSide === 'right', '⑳ 福建沿海·最近洋在东→oceanSide=right·实=' + pm2.terrainProfile.provinceMeta.oceanSide);
ok(pm2.terrainProfile.provinceMeta.neighborDir === 'N', '⑳ 敌自北直隶(北)→neighborDir=N·实=' + pm2.terrainProfile.provinceMeta.neighborDir);
/* children+capitalChildId 主路径 */
const sdA = [{ id: 'sdA', name: '鲁军', faction: '明', commander: '某', location: '山东', composition: [{ type: '步兵', count: 2000 }] }];
const pm3 = ADP.buildBattleConfig(sdA, pmE, { GM: MDGM });
ok(pm3.terrainProfile.provinceMeta.capitalName === '济南府', '⑳ 山东→省会济南府(children+capitalChildId 主路径)·实=' + pm3.terrainProfile.provinceMeta.capitalName);
/* 无 mapData → provinceMeta 省略(不崩·terrainProfile 不含 meta) */
const pm4 = ADP.buildBattleConfig(pmA, pmE, { GM: { chars: GM.chars } });
ok(!pm4.terrainProfile || !pm4.terrainProfile.provinceMeta, '⑳ 无 mapData→无 provinceMeta(优雅省略)');
ok(ADP.provinceMeta({}, pmA[0], pmE[0], '北直隶', '平原') === null, '⑳ provinceMeta 直调无 mapData→null');

console.log('\n结果: ' + A + ' 通过 / ' + F + ' 失败');
process.exit(F ? 1 : 0);
