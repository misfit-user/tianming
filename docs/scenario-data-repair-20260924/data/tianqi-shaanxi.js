// 天启剧本·陕西布政使司 8 府与 7 处军镇卫所
//
// 《明史·地理志》只记陕西全省户口。地图除八府外，另列甘肃镇的庄浪、洮州、岷州、甘州、肃州五卫，
// 以及宁夏镇、榆林镇（延绥镇）。兴安州（直隶州）落在汉中块；凉州、西宁诸卫所落在庄浪卫块；
// 府谷与靖边一带属延绥镇，计入榆林镇（按治所坐标核过）。本省权重：
//   人口：州县单位数（《明史》卷42）× 密度 × 每县口数，另加各镇卫驻军连同家口的估数。
//   税额：民口 × 田赋轻重，驻军只计一成；田亩：州县数 × 地形系数，镇卫按屯田给权重。
// 盐课给宁夏花马池、延绥盐池与巩昌漳县井盐；马政给苑马寺所在的平凉与河湟诸茶马司、边镇。
'use strict';

const { block, unit } = require('./lib-blocks');

// 每县口数：省总人口 580 万，驻军估数共 97 万，加权县数约 116.9，(580−97)÷116.9 ≈ 4.1 万
const PER_COUNTY = 41000;
const u = (fields) => unit(Object.assign({ perCounty: PER_COUNTY }, fields));

const UNITS = [
  u({ name: '西安府', countyCount: 37, density: 1.2, taxIntensity: 1.0, terrainLand: 1.1, militaryMouths: 40000, basis: '领州六县三十一；关中平原；西安诸卫与秦藩约 4 万口。' }),
  u({ name: '延安府', countyCount: 19, density: 0.8, taxIntensity: 0.8, terrainLand: 0.8, militaryMouths: 20000, basis: '领州三县十六；陕北黄土高原；延安、绥德诸卫约 2 万口。' }),
  u({ name: '凤翔府', countyCount: 8, density: 1.1, taxIntensity: 1.0, terrainLand: 1.0, basis: '领州一县七。' }),
  u({ name: '汉中府', countyCount: 9, density: 1.0, taxIntensity: 0.9, terrainLand: 0.8, basis: '领州一县八（宁羌州）。' }),
  u({ name: '兴安州', block: '汉中府', countyCount: 7, density: 0.6, taxIntensity: 0.7, terrainLand: 0.6, basis: '直隶州，领县六；州治落在汉中块。' }),
  u({ name: '平凉府', countyCount: 10, density: 0.9, taxIntensity: 0.9, terrainLand: 0.9, militaryMouths: 60000, basis: '领州三县七；固原镇与三边总督驻地，驻军连同家口约 6 万口。' }),
  u({ name: '巩昌府', countyCount: 17, density: 0.8, taxIntensity: 0.8, terrainLand: 0.8, militaryMouths: 10000, basis: '领州三县十四（秦州、阶州、徽州）。' }),
  u({ name: '庆阳府', countyCount: 5, density: 0.8, taxIntensity: 0.8, terrainLand: 0.8, basis: '领州一县四。' }),
  u({ name: '临洮府', countyCount: 5, density: 0.8, taxIntensity: 0.8, terrainLand: 0.8, militaryMouths: 30000, basis: '领州二县三（兰州、河州）；兰州、河州诸卫约 3 万口。' }),
  u({ name: '庄浪卫', countyCount: 4, density: 0.3, taxIntensity: 0.3, terrainLand: 0.8, militaryMouths: 180000, basis: '含庄浪、凉州、镇番、永昌、西宁诸卫所（甘肃镇东路），屯军与番族连同家口约 18 万口；驿站按四县计。' }),
  u({ name: '洮州卫', countyCount: 1, density: 0.3, taxIntensity: 0.3, terrainLand: 0.3, militaryMouths: 30000, basis: '洮州卫与所辖番族约 3 万口。' }),
  u({ name: '岷州卫', countyCount: 1, density: 0.3, taxIntensity: 0.3, terrainLand: 0.3, militaryMouths: 40000, basis: '岷州卫军民约 4 万口。' }),
  u({ name: '甘州卫', countyCount: 2, density: 0.3, taxIntensity: 0.3, terrainLand: 0.6, militaryMouths: 150000, basis: '甘州五卫，甘肃镇总兵与巡抚驻地，屯军连同家口约 15 万口。' }),
  u({ name: '肃州卫', countyCount: 1, density: 0.2, taxIntensity: 0.3, terrainLand: 0.4, militaryMouths: 50000, basis: '肃州卫与嘉峪关，约 5 万口。' }),
  u({ name: '宁夏镇', countyCount: 3, density: 0.5, taxIntensity: 0.5, terrainLand: 1.0, militaryMouths: 180000, basis: '宁夏诸卫与庆藩，引黄灌区屯田，驻军连同家口约 18 万口。' }),
  u({ name: '榆林镇', countyCount: 2, density: 0.3, taxIntensity: 0.4, terrainLand: 0.5, militaryMouths: 180000, basis: '延绥镇诸营堡（含府谷、神木、靖边一带），驻军连同家口约 18 万口。' })
];

const BLOCKS = {
  西安府: block({
    name: '西安府', terrain: '平原', specialResources: '麦·棉·药材', tags: { mineralRegion: true },
    description: '关中首府，秦王封藩于此，八百里秦川沃野，商州、同州、华州诸属州环列。连年旱歉，今年三月澄城饥民王二聚众杀知县张斗耀，关中震动。',
    commerce: 1.8, fishing: 0, mineral: 0.2, corridor: 1.3, keju: 3.0,
    idx: [18, 76, 30, 30, 86, 64, 30, 62], fisc: [0.66, 0.20],
    notes: '秦王府；天启七年三月澄城王二起事。'
  }),
  延安府: block({
    name: '延安府', terrain: '高原', specialResources: '粟·羊·石油', tags: {},
    description: '陕北黄土高原，沟壑纵横，连年大旱，赤地千里，饥民剥树皮、掘草根为食；米脂、绥德、清涧一带聚众之事时有所闻。',
    commerce: 0.7, fishing: 0, corridor: 1.0, keju: 0.8, flee: 1.8,
    idx: [8, 78, 14, 14, 94, 66, 36, 64], fisc: [0.58, 0.22],
    notes: '陕北大旱；沈括《梦溪笔谈》所记延州石油即出此地。'
  }),
  凤翔府: block({
    name: '凤翔府', terrain: '平原', specialResources: '麦·酒·木材', tags: { mineralRegion: true },
    description: '关中西部，岐山、扶风周秦故地，渭水流贯，凤翔为西出陇右的门户。',
    commerce: 1.1, fishing: 0, mineral: 0.1, corridor: 1.2, keju: 1.0,
    idx: [20, 74, 30, 30, 84, 62, 26, 60], fisc: [0.66, 0.20],
    notes: '陇右门户。'
  }),
  汉中府: block({
    name: '汉中府', terrain: '盆地', specialResources: '稻米·茶·铁', tags: { mineralRegion: true },
    description: '秦岭以南的盆地，瑞王封藩于此；汉中与兴安州山区流民垦荒，稻米、茶叶自给有余，宁羌、略阳扼入蜀之道。',
    commerce: 1.1, fishing: 0, mineral: 0.3, kuangchang: 1, corridor: 1.2, keju: 0.8,
    idx: [24, 72, 32, 32, 80, 58, 26, 60], fisc: [0.68, 0.19],
    notes: '瑞王府；兴安直隶州并入本块。'
  }),
  平凉府: block({
    name: '平凉府', terrain: '高原', specialResources: '马·麦·皮毛', tags: { horseRegion: true },
    description: '韩王封藩于平凉，三边总督驻节固原，陕西苑马寺在此牧马；六盘山下黄土干旱，边饷与赋役两重负担。',
    commerce: 1.0, fishing: 0, horse: 0.25, corridor: 1.2, keju: 0.8,
    idx: [16, 76, 24, 24, 88, 62, 40, 62], fisc: [0.64, 0.21],
    notes: '韩王府；三边总督驻固原；苑马寺。'
  }),
  巩昌府: block({
    name: '巩昌府', terrain: '山地', specialResources: '井盐·药材·麦', tags: { saltRegion: true, mineralRegion: true },
    description: '陇右重镇，秦州、阶州、徽州诸属州山川阻隔，漳县井盐为陇中之利；旱灾频仍，边饷拖欠。',
    commerce: 0.9, fishing: 0, salt: 0.2, mineral: 0.2, corridor: 1.0, keju: 0.8,
    idx: [14, 76, 20, 20, 90, 62, 32, 62], fisc: [0.62, 0.21],
    notes: '漳县盐井。'
  }),
  庆阳府: block({
    name: '庆阳府', terrain: '高原', specialResources: '麦·羊', tags: {},
    description: '陇东黄土塬，董志塬沃而少雨，近年旱荒尤甚，民多逃亡。',
    commerce: 0.7, fishing: 0, corridor: 0.9, keju: 0.5, flee: 1.6,
    idx: [10, 78, 16, 16, 92, 64, 30, 62], fisc: [0.60, 0.22],
    notes: '陇东旱荒。'
  }),
  临洮府: block({
    name: '临洮府', terrain: '河谷', specialResources: '茶马·麦·皮毛', tags: { horseRegion: true, mineralRegion: true },
    description: '洮河与黄河之间，兰州扼黄河渡口，肃王府在焉；河州茶马司以官茶易番马，番汉商旅往来。',
    commerce: 1.2, fishing: 0, horse: 0.15, mineral: 0.2, corridor: 1.2, keju: 0.5,
    idx: [16, 76, 22, 22, 88, 60, 40, 62], fisc: [0.64, 0.21],
    notes: '肃王府在兰州；河州茶马司。'
  }),
  庄浪卫: block({
    name: '庄浪卫', terrain: '边塞', divisionType: '卫', officialPosition: '指挥使', specialResources: '马·屯粮·皮毛', tags: { horseRegion: true },
    description: '甘肃镇东路，庄浪、凉州、西宁诸卫所扼河西走廊东口，西宁以茶马招抚番族；屯军与番族杂处。',
    commerce: 1.0, fishing: 0, horse: 0.2, corridor: 1.3, keju: 0.2,
    idx: [16, 78, 20, 20, 88, 58, 60, 64], fisc: [0.62, 0.22],
    notes: '凉州、西宁诸卫并入本块。'
  }),
  洮州卫: block({
    name: '洮州卫', terrain: '边塞', divisionType: '卫', officialPosition: '指挥使', specialResources: '茶马·皮毛', tags: { horseRegion: true },
    description: '洮河上游的番汉交界之地，洮州茶马司以官茶易番马，卫所统辖诸番族。',
    commerce: 0.9, fishing: 0, horse: 0.1, corridor: 1.0, keju: 0.05,
    idx: [18, 76, 18, 18, 86, 56, 55, 62], fisc: [0.62, 0.22],
    notes: '洮州茶马司。'
  }),
  岷州卫: block({
    name: '岷州卫', terrain: '边塞', divisionType: '卫', officialPosition: '指挥使', specialResources: '药材·屯粮', tags: { horseRegion: true },
    description: '岷山北麓，卫城控扼番族往来之路，军民以屯田、药材为业。',
    commerce: 0.8, fishing: 0, horse: 0.05, corridor: 1.0, keju: 0.05,
    idx: [18, 76, 18, 18, 86, 56, 55, 62], fisc: [0.62, 0.22],
    notes: '岷州当归。'
  }),
  甘州卫: block({
    name: '甘州卫', terrain: '边塞', divisionType: '卫', officialPosition: '甘肃巡抚', specialResources: '屯粮·马·西域商货', tags: { horseRegion: true },
    description: '河西走廊中段，甘肃镇总兵与巡抚驻节甘州，陕西行都司在焉；屯田仰赖祁连雪水，西域贡使经此东来。',
    commerce: 1.2, fishing: 0, horse: 0.1, corridor: 1.4, keju: 0.2,
    idx: [16, 78, 22, 22, 88, 58, 70, 64], fisc: [0.62, 0.22],
    notes: '陕西行都司、甘肃镇。'
  }),
  肃州卫: block({
    name: '肃州卫', terrain: '边塞', divisionType: '卫', officialPosition: '指挥使', specialResources: '屯粮·西域贡市', tags: { horseRegion: true },
    description: '河西走廊西端，嘉峪关为天下雄关，关外即哈密、吐鲁番诸部；西域贡使与商队在此验关。',
    commerce: 1.2, fishing: 0, horse: 0.05, corridor: 1.3, keju: 0.1,
    idx: [18, 76, 20, 20, 86, 56, 65, 62], fisc: [0.62, 0.22],
    notes: '嘉峪关。'
  }),
  宁夏镇: block({
    name: '宁夏镇', terrain: '边塞', divisionType: '镇', officialPosition: '宁夏巡抚', specialResources: '引黄灌田·花马池盐·马', tags: { saltRegion: true, horseRegion: true },
    description: '黄河前套的引黄灌区，号称塞上江南，庆王封藩于此；宁夏镇兵屯驻诸卫，花马池盐课为边饷之助。',
    commerce: 1.0, fishing: 0, salt: 0.6, horse: 0.05, corridor: 1.3, keju: 0.3, yieldFactor: 0.9,
    idx: [18, 78, 26, 26, 86, 58, 70, 64], fisc: [0.62, 0.22],
    notes: '庆王府；花马池盐。'
  }),
  榆林镇: block({
    name: '榆林镇', terrain: '边塞', divisionType: '镇', officialPosition: '延绥巡抚', specialResources: '马市·盐池·屯粮', tags: { saltRegion: true, horseRegion: true },
    description: '延绥镇城榆林，长城沿线营堡相连，北临河套；连年欠饷，镇兵困苦，逃卒多有落草者。',
    commerce: 1.0, fishing: 0, salt: 0.2, horse: 0.05, corridor: 1.3, keju: 0.2, flee: 1.8,
    idx: [8, 80, 12, 12, 94, 60, 80, 66], fisc: [0.58, 0.24],
    notes: '延绥镇；逃兵日后多入民变。'
  })
};

const regionMeans = { development: 22, unrest: 89, taxPressure: 63, armyPressure: 30, officeRisk: 62 };

module.exports = { province: '陕西布政使司', UNITS, BLOCKS, regionMeans };
