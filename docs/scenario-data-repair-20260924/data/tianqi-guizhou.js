// 天启剧本·贵州布政使司 11 块（9 府、1 卫、1 宣慰司）
//
// 《明史·地理志》只记贵州全省户口，册籍多是卫所军户与流官州县，诸长官司之民多未入籍。
// 地图边界粗略：平越府治与湄潭、瓮安、龙泉诸县的坐标落到了都匀块和四川重庆块，这里仍按府名归本府
// （行政归属优先，省界不跨）；思州府落在镇远块，普安州与安南卫落在安顺块。
// 本省权重：
//   人口：州县与长官司折算单位 × 密度 × 每县口数，另加援黔诸军与卫所驻军估数。
//   税额：民口 × 田赋轻重。水西安氏正在反叛，贡赋几近于无。田亩：单位数 × 地形系数，贵州山多田少。
// 矿课与两处矿厂给铜仁大万山、思南婺川的朱砂水银。
// 奢安之乱第七年：贵阳天启二年被围近十月，今为援黔大本营；水西安邦彦负险据守。
// 贵州诸府多是长官司林立之地，辖治类型沿用剧本原值「土司」；龙里卫是驿道上的卫城，改记为军镇。
'use strict';

const { block, unit } = require('./lib-blocks');

// 每县口数：省总人口 115 万，驻军估数共 13 万，加权单位约 43.4，(115−13)÷43.4 ≈ 2.35 万
const PER_COUNTY = 23500;
const u = (fields) => unit(Object.assign({ perCounty: PER_COUNTY }, fields));

const UNITS = [
  u({ name: '贵阳府', countyCount: 6, density: 1.0, taxIntensity: 0.8, terrainLand: 0.8, militaryMouths: 30000, basis: '军民府，领定番、广顺二州与新贵、贵定二县，另有长官司十余，折六单位；贵州诸卫与援黔客兵约 3 万口。' }),
  u({ name: '龙里卫', countyCount: 2, density: 0.8, taxIntensity: 0.4, terrainLand: 0.6, militaryMouths: 15000, basis: '龙里、新添诸卫城，屯军连同家口约 1.5 万口。' }),
  u({ name: '安顺府', countyCount: 6, density: 1.0, taxIntensity: 0.8, terrainLand: 0.8, militaryMouths: 50000, basis: '军民府，领镇宁、永宁二州，连普安州计；普定、平坝、安庄、安南、普安诸卫约 5 万口。' }),
  u({ name: '平越府', countyCount: 5, density: 0.9, taxIntensity: 0.8, terrainLand: 0.7, militaryMouths: 10000, basis: '军民府，领黄平州与湄潭、余庆、瓮安三县；平越、兴隆二卫约 1 万口。' }),
  u({ name: '都匀府', countyCount: 6, density: 0.8, taxIntensity: 0.6, terrainLand: 0.6, militaryMouths: 5000, basis: '领独山、麻哈二州与清平县，另有长官司八，折六单位；都匀卫约 5 千口。' }),
  u({ name: '思南府', countyCount: 5, density: 1.0, taxIntensity: 0.9, terrainLand: 0.8, basis: '领安化、婺川、印江三县，另有长官司，折五单位。' }),
  u({ name: '石阡府', countyCount: 3, density: 0.8, taxIntensity: 0.7, terrainLand: 0.7, basis: '领龙泉县与长官司，折三单位。' }),
  u({ name: '镇远府', countyCount: 2, density: 0.9, taxIntensity: 0.8, terrainLand: 0.7, militaryMouths: 10000, basis: '领镇远、施秉二县；镇远、偏桥二卫约 1 万口。' }),
  u({ name: '思州府', block: '镇远府', countyCount: 2, density: 0.8, taxIntensity: 0.6, terrainLand: 0.6, basis: '领长官司四，折二单位；府治落在镇远块。' }),
  u({ name: '铜仁府', countyCount: 3, density: 0.9, taxIntensity: 0.8, terrainLand: 0.7, basis: '领铜仁县与长官司五，折三单位。' }),
  u({ name: '黎平府', countyCount: 5, density: 0.8, taxIntensity: 0.6, terrainLand: 0.6, militaryMouths: 10000, basis: '领永从县与长官司十余，折五单位；五开、铜鼓二卫约 1 万口。' }),
  u({ name: '水西宣慰司', countyCount: 6, density: 0.5, taxIntensity: 0.1, terrainLand: 0.2, basis: '安氏世领，号四十八目；正在反叛，册籍无从稽考，按六单位低密度估。' })
];

const BLOCKS = {
  贵阳府: block({
    name: '贵阳府', terrain: '山地', regionType: 'tusi', specialResources: '稻米·茶·药材', tags: { mineralRegion: true },
    description: '贵州省会，城小而险。天启二年安邦彦围城近十个月，城中粮尽，饿死者不可胜计，至今元气未复；如今仍是援黔诸军的大本营，军饷仰给湖广、四川协济。',
    commerce: 1.4, fishing: 0, mineral: 0.1, corridor: 1.4, keju: 3.0,
    idx: [30, 66, 26, 26, 86, 52, 60, 56], fisc: [0.68, 0.20],
    notes: '天启二年二月至十二月贵阳之围。'
  }),
  龙里卫: block({
    name: '龙里卫', terrain: '山地', divisionType: '卫', regionType: 'frontier_defense', officialPosition: '指挥使', specialResources: '屯粮·木材', tags: {},
    description: '贵阳东面的卫城，扼湘黔驿道，屯军守备；贵定新县亦在左近，苗寨环伺。',
    commerce: 0.8, fishing: 0, corridor: 1.4, keju: 0.2,
    idx: [34, 66, 22, 22, 86, 50, 60, 56], fisc: [0.66, 0.20],
    notes: '湘黔驿道。'
  }),
  安顺府: block({
    name: '安顺府', terrain: '山地', regionType: 'tusi', specialResources: '马·屯粮·茶', tags: {},
    description: '滇黔驿道上的重镇，普定、安庄、安南诸卫城相连，安顺马市闻名；西面普安州与镇宁、永宁二州诸族杂处，水西兵锋屡及。',
    commerce: 1.2, fishing: 0, corridor: 1.4, keju: 1.0,
    idx: [36, 66, 30, 30, 84, 50, 50, 56], fisc: [0.68, 0.20],
    notes: '万历三十年升安顺州为军民府；普安州并入本块。'
  }),
  平越府: block({
    name: '平越府', terrain: '山地', regionType: 'tusi', specialResources: '稻米·茶·木材', tags: {},
    description: '万历二十九年平播州杨应龙后新设的军民府，黄平州与湄潭、余庆、瓮安三县由播州故地析置，屯军与苗民杂居。',
    commerce: 0.9, fishing: 0, corridor: 1.1, keju: 0.6,
    idx: [38, 64, 28, 28, 82, 48, 36, 54], fisc: [0.70, 0.19],
    notes: '播州故地。'
  }),
  都匀府: block({
    name: '都匀府', terrain: '山地', regionType: 'tusi', specialResources: '茶·木材·药材', tags: {},
    description: '黔南都匀府，辖独山、麻哈二州与清平县，诸长官司苗民聚居，山高林密，都匀茶岁贡入京。',
    commerce: 0.8, fishing: 0, corridor: 1.0, keju: 0.5,
    idx: [38, 64, 26, 26, 82, 48, 30, 54], fisc: [0.70, 0.19],
    notes: '都匀卫。'
  }),
  思南府: block({
    name: '思南府', terrain: '山地', regionType: 'tusi', specialResources: '朱砂·桐油·稻米', tags: { mineralRegion: true },
    description: '乌江中游，原为田氏思南宣慰司之地，永乐年间改设流官；乌江舟楫通四川，婺川朱砂闻名。',
    commerce: 1.0, fishing: 0, mineral: 0.3, kuangchang: 1, corridor: 1.0, keju: 0.8,
    idx: [42, 64, 32, 32, 78, 48, 24, 52], fisc: [0.72, 0.18],
    notes: '永乐十一年废思南宣慰司设府。'
  }),
  石阡府: block({
    name: '石阡府', terrain: '山地', regionType: 'tusi', specialResources: '茶·桐油·木材', tags: { mineralRegion: true },
    description: '思南以南的小府，永乐年间由思州宣慰司故地析置，苗民与汉民杂处，产茶与桐油。',
    commerce: 0.7, fishing: 0, mineral: 0.1, corridor: 0.9, keju: 0.3,
    idx: [42, 64, 28, 28, 78, 48, 24, 52], fisc: [0.72, 0.18],
    notes: '思州宣慰司故地。'
  }),
  镇远府: block({
    name: '镇远府', terrain: '河谷', regionType: 'tusi', specialResources: '转运商货·木材·桐油', tags: {},
    description: '舞阳河畔的水陆码头，湖广来船至此舍舟登陆，西行入滇，是黔东门户；东面思州府诸长官司也归此统摄。',
    commerce: 1.4, fishing: 0, corridor: 1.4, keju: 0.6,
    idx: [42, 64, 34, 34, 78, 48, 30, 52], fisc: [0.72, 0.18],
    notes: '思州府并入本块。'
  }),
  铜仁府: block({
    name: '铜仁府', terrain: '山地', regionType: 'tusi', specialResources: '朱砂·水银·木材', tags: { mineralRegion: true },
    description: '黔东锦江之畔，大万山出朱砂与水银，冠于天下；东接湖广辰州，苗疆边墙在其北境。',
    commerce: 1.0, fishing: 0, mineral: 0.4, kuangchang: 1, corridor: 1.0, keju: 0.4,
    idx: [42, 64, 32, 32, 78, 48, 26, 52], fisc: [0.72, 0.18],
    notes: '大万山朱砂；湘黔边墙。'
  }),
  黎平府: block({
    name: '黎平府', terrain: '山林', regionType: 'tusi', specialResources: '杉木·稻米·药材', tags: { mineralRegion: true },
    description: '黔东南清水江流域，侗、苗诸族聚居，杉木沿清水江放排运往湖广，称为苗木；五开卫屯军驻守。',
    commerce: 0.9, fishing: 0, mineral: 0.1, corridor: 0.9, keju: 0.3,
    idx: [40, 64, 28, 28, 80, 46, 30, 52], fisc: [0.70, 0.18],
    notes: '清水江苗木；五开卫。'
  }),
  水西宣慰司: block({
    name: '水西宣慰司', terrain: '高原', divisionType: '司', regionType: 'tusi', officialPosition: '宣慰使', specialResources: '马·毡·漆', tags: {},
    description: '乌江上游、乌蒙山东麓的安氏世领之地，水西马与毡毯闻名。天启二年宣慰同知安邦彦举兵反，与奢崇明合兵，围贵阳、败官军，至今负险据守，朝廷屡征未克。',
    commerce: 0.4, fishing: 0, corridor: 0.7, keju: 0.05, flee: 1.5,
    idx: [30, 60, 20, 20, 92, 40, 70, 60], fisc: [0.40, 0.20],
    notes: '安邦彦之乱（天启二年起）。'
  })
};

const regionMeans = { development: 28, unrest: 82, taxPressure: 49, armyPressure: 30, officeRisk: 54 };

module.exports = { province: '贵州布政使司', UNITS, BLOCKS, regionMeans };
