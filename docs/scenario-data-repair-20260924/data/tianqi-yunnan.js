// 天启剧本·云南布政使司 13 块（12 府、1 州）
//
// 《明史·地理志》只记云南全省户口。地图画了 13 块，其余府州与土司按治所坐标落块（核过）：
//   澂江、武定、寻甸三府落在云南府块；广西府、广南府落在曲靖块；姚安府落在楚雄块；
//   大理府属赵州落在蒙化块；北胜州落在丽江块；镇沅府与车里宣慰司落在景东块；孟定府落在顺宁块。
// 本省权重：
//   人口：州县单位数（《明史》卷46，缺解析的府按领州县补）× 密度。土府按实有人口估，密度压低；
//         云南府、永昌、腾越驻卫较多，密度略抬。
//   税额：民口 × 田赋轻重，土府从轻；田亩：州县数 × 地形系数。
// 剧本云南盐课为 0，黑井、安宁、云龙诸盐井只写进描述。矿课（银、铜、锡）与六处矿厂按矿场分布给临安、楚雄、
// 大理、永昌、云南府等；马政给大理、丽江、鹤庆、曲靖、永昌、蒙化。
// 丽江木氏、景东陶氏、元江那氏、蒙化左氏为世袭土知府，辖治类型记为土司。
'use strict';

const { block, unit } = require('./lib-blocks');

const UNITS = [
  unit({ name: '云南府', countyCount: 13, density: 1.3, taxIntensity: 1.0, terrainLand: 1.1, basis: '领州四县九；省会，沐府与云南诸卫驻此。' }),
  unit({ name: '澂江府', block: '云南府', countyCount: 5, density: 1.1, taxIntensity: 1.0, terrainLand: 1.0, basis: '领州二县三；府治落在云南府块。' }),
  unit({ name: '武定寻甸', block: '云南府', countyCount: 4, density: 0.6, taxIntensity: 0.6, terrainLand: 0.6, basis: '武定府（领州二县一）与寻甸府，皆改流未久；府治落在云南府块。' }),
  unit({ name: '曲靖府', countyCount: 6, density: 1.0, taxIntensity: 0.9, terrainLand: 1.0, basis: '军民府，领州四县二。' }),
  unit({ name: '广西广南', block: '曲靖府', countyCount: 6, density: 0.6, taxIntensity: 0.5, terrainLand: 0.6, basis: '广西府（领州三）与广南土府；府治落在曲靖块。' }),
  unit({ name: '楚雄府', countyCount: 7, density: 0.9, taxIntensity: 0.9, terrainLand: 0.9, basis: '领州二县五。' }),
  unit({ name: '姚安府', block: '楚雄府', countyCount: 2, density: 0.9, taxIntensity: 0.9, terrainLand: 0.8, basis: '军民府，领州一县一；府治落在楚雄块。' }),
  unit({ name: '大理府', countyCount: 5, density: 1.3, taxIntensity: 1.0, terrainLand: 1.0, basis: '领州四县三共七，扣去赵州（州一县一）。' }),
  unit({ name: '赵州', block: '蒙化府', countyCount: 2, density: 1.1, taxIntensity: 1.0, terrainLand: 1.0, basis: '大理府属州；州治落在蒙化块。' }),
  unit({ name: '临安府', countyCount: 11, density: 1.0, taxIntensity: 0.9, terrainLand: 0.9, basis: '领州六县五。' }),
  unit({ name: '永昌府', countyCount: 3, density: 1.2, taxIntensity: 0.9, terrainLand: 0.8, basis: '军民府，领州一县二；永昌诸卫屯戍。' }),
  unit({ name: '鹤庆府', countyCount: 3, density: 0.9, taxIntensity: 0.9, terrainLand: 0.9, basis: '军民府，领州二（剑川、顺州）。' }),
  unit({ name: '丽江府', countyCount: 5, density: 0.6, taxIntensity: 0.4, terrainLand: 0.5, basis: '军民府，领州四县一，木氏土知府。' }),
  unit({ name: '北胜州', block: '丽江府', countyCount: 1, density: 0.6, taxIntensity: 0.6, terrainLand: 0.6, basis: '直隶州；州治落在丽江块。' }),
  unit({ name: '景东府', countyCount: 1, density: 0.6, taxIntensity: 0.3, terrainLand: 0.5, basis: '陶氏土府。' }),
  unit({ name: '镇沅车里', block: '景东府', countyCount: 3, density: 0.4, taxIntensity: 0.1, terrainLand: 0.3, basis: '镇沅土府与车里宣慰司，贡赋甚轻；治所落在景东块。' }),
  unit({ name: '蒙化府', countyCount: 2, density: 0.9, taxIntensity: 0.6, terrainLand: 0.8, basis: '左氏土知府，流官同知佐治。' }),
  unit({ name: '顺宁府', countyCount: 2, density: 0.6, taxIntensity: 0.6, terrainLand: 0.5, basis: '领州一（云州）；万历二十五年改流。' }),
  unit({ name: '孟定府', block: '顺宁府', countyCount: 1, density: 0.4, taxIntensity: 0.1, terrainLand: 0.3, basis: '孟定土府；治所落在顺宁块。' }),
  unit({ name: '元江府', countyCount: 2, density: 0.5, taxIntensity: 0.4, terrainLand: 0.5, basis: '军民府，那氏土知府。' }),
  unit({ name: '腾越州', countyCount: 3, density: 0.6, taxIntensity: 0.6, terrainLand: 0.5, basis: '永昌府属州，连同南甸、干崖、陇川诸土司计；腾冲诸卫屯戍。' })
];

const BLOCKS = {
  云南府: block({
    name: '云南府', terrain: '盆地', specialResources: '稻米·铜·井盐', tags: { mineralRegion: true },
    description: '滇池之畔的云南省会，黔国公沐氏世镇于此，沐府庄田遍布滇中；安宁井盐与易门铜矿为一方之利。南面澂江府，东北武定、寻甸两府也归此统摄。',
    commerce: 1.8, fishing: 0, mineral: 0.1, kuangchang: 1, corridor: 1.4, keju: 3.0,
    idx: [54, 56, 54, 54, 68, 50, 32, 46], fisc: [0.74, 0.17],
    notes: '沐府；澂江、武定、寻甸三府并入本块。'
  }),
  曲靖府: block({
    name: '曲靖府', terrain: '盆地', specialResources: '稻米·铜·马', tags: { mineralRegion: true, horseRegion: true },
    description: '滇东门户，曲靖扼入黔孔道，沾益、陆凉、马龙、罗平诸州与东南广西府、广南府土司相连；贵州水西之乱波及边境，军需转输频繁。',
    commerce: 1.0, fishing: 0, mineral: 0.08, horse: 0.15, corridor: 1.3, keju: 1.0,
    idx: [50, 56, 40, 40, 76, 50, 36, 46], fisc: [0.73, 0.17],
    notes: '广西府、广南府并入本块。'
  }),
  楚雄府: block({
    name: '楚雄府', terrain: '山地', specialResources: '井盐·银·稻米', tags: { mineralRegion: true },
    description: '滇中要冲，楚雄扼大理与省城之间的驿路；定远黑井盐为云南诸井之冠，南安州出银。北面姚安府也归此统摄。',
    commerce: 1.1, fishing: 0, mineral: 0.2, kuangchang: 1, corridor: 1.3, keju: 0.8,
    idx: [50, 56, 40, 40, 74, 50, 28, 46], fisc: [0.73, 0.17],
    notes: '黑盐井；姚安府并入本块。'
  }),
  大理府: block({
    name: '大理府', terrain: '盆地', specialResources: '大理石·马·茶', tags: { mineralRegion: true, horseRegion: true },
    description: '洱海之滨，苍山之下，南诏、大理国旧都；每年三月城西观音市商贾云集，大理马闻名西南，点苍山石即以大理为名。云龙州出井盐。',
    commerce: 1.4, fishing: 0, mineral: 0.12, kuangchang: 1, horse: 0.3, corridor: 1.3, keju: 1.8,
    idx: [52, 56, 48, 48, 72, 50, 28, 46], fisc: [0.74, 0.17],
    notes: '三月街；大理马；属州赵州划在蒙化块。'
  }),
  临安府: block({
    name: '临安府', terrain: '盆地', specialResources: '锡·银·稻米', tags: { mineralRegion: true },
    description: '滇南重镇，建水文庙规制宏大，文风冠于滇南；个旧、蒙自一带锡银矿场聚集四方矿丁。',
    commerce: 1.2, fishing: 0, mineral: 0.25, kuangchang: 2, corridor: 1.1, keju: 1.8,
    idx: [50, 56, 46, 46, 74, 50, 28, 46], fisc: [0.73, 0.17],
    notes: '个旧锡、蒙自银。'
  }),
  永昌府: block({
    name: '永昌府', terrain: '山地', specialResources: '银·宝石·棉花', tags: { mineralRegion: true, horseRegion: true },
    description: '滇西边郡，永昌扼通缅甸的驿路，军民屯戍。万历年间缅军屡犯边境，官军筑八关以守，西南边警未尝稍息。',
    commerce: 1.2, fishing: 0, mineral: 0.12, kuangchang: 1, horse: 0.1, corridor: 1.2, keju: 0.8,
    idx: [48, 58, 38, 38, 78, 50, 40, 48], fisc: [0.72, 0.18],
    notes: '万历二十二年筑腾冲八关。'
  }),
  鹤庆府: block({
    name: '鹤庆府', terrain: '盆地', specialResources: '稻米·木器·马', tags: { mineralRegion: true, horseRegion: true },
    description: '洱海以北的高原坝子，鹤庆、剑川一带田土肥沃，剑川木匠手艺闻名滇中。',
    commerce: 0.9, fishing: 0, mineral: 0.05, horse: 0.15, corridor: 1.0, keju: 0.6,
    idx: [50, 56, 36, 36, 76, 48, 26, 46], fisc: [0.74, 0.17],
    notes: '正统年间改设流官。'
  }),
  丽江府: block({
    name: '丽江府', terrain: '高原', regionType: 'tusi', officialPosition: '土知府', specialResources: '马·木材·砂金', tags: { mineralRegion: true, horseRegion: true },
    description: '金沙江上游，木氏土知府世守其地，素以忠顺受朝廷嘉奖；北与朵甘诸部相接，茶马往来。东面北胜州也属其境。',
    commerce: 0.8, fishing: 0, mineral: 0.03, horse: 0.2, corridor: 0.9, keju: 0.2,
    idx: [52, 54, 34, 34, 72, 44, 26, 44], fisc: [0.72, 0.16],
    notes: '木氏土府；北胜州并入本块。'
  }),
  景东府: block({
    name: '景东府', terrain: '山林', regionType: 'tusi', officialPosition: '土知府', specialResources: '茶·棉·木材', tags: {},
    description: '澜沧江与无量山之间，陶氏土知府世袭；南面镇沅府与车里宣慰司为百夷聚居之地，普茶出于其山。',
    commerce: 0.7, fishing: 0, corridor: 0.8, keju: 0.1,
    idx: [48, 54, 26, 26, 80, 44, 30, 46], fisc: [0.70, 0.16],
    notes: '陶氏土府；镇沅、车里并入本块。'
  }),
  蒙化府: block({
    name: '蒙化府', terrain: '山地', regionType: 'tusi', officialPosition: '土知府', specialResources: '稻米·茶·马', tags: { horseRegion: true },
    description: '巍山坝子，南诏发祥之地，左氏土知府世袭，流官同知佐治；北接赵州，出大理的驿路经此南下。',
    commerce: 0.8, fishing: 0, horse: 0.1, corridor: 1.0, keju: 0.5,
    idx: [50, 56, 36, 36, 76, 48, 26, 46], fisc: [0.72, 0.17],
    notes: '左氏土府；大理府属赵州并入本块。'
  }),
  顺宁府: block({
    name: '顺宁府', terrain: '山林', specialResources: '茶·木材·药材', tags: {},
    description: '澜沧江以西，万历二十五年改土归流设府，孟定诸土司在其西南；边地初开，汉民渐入垦殖。',
    commerce: 0.6, fishing: 0, corridor: 0.8, keju: 0.2,
    idx: [46, 56, 28, 28, 80, 46, 32, 46], fisc: [0.70, 0.17],
    notes: '孟定府并入本块。'
  }),
  元江府: block({
    name: '元江府', terrain: '河谷', regionType: 'tusi', officialPosition: '土知府', specialResources: '棉花·槟榔·甘蔗', tags: {},
    description: '红河上游的热坝，那氏土知府世袭，出棉花、槟榔与甘蔗；夏秋瘴疠，流官少至。',
    commerce: 0.6, fishing: 0, corridor: 0.8, keju: 0.1,
    idx: [46, 56, 26, 26, 80, 44, 30, 46], fisc: [0.70, 0.17],
    notes: '那氏土府。'
  }),
  腾越州: block({
    name: '腾越州', terrain: '山地', divisionType: '州', officialPosition: '知州', specialResources: '琥珀·玉石·宝石', tags: { mineralRegion: true },
    description: '滇西极边，腾越州城扼缅甸往来要道，南甸、干崖、陇川诸土司在其外；琥珀、玉石与宝石经此入内地。',
    commerce: 1.0, fishing: 0, mineral: 0.05, corridor: 1.0, keju: 0.3,
    idx: [48, 58, 32, 32, 80, 48, 44, 48], fisc: [0.70, 0.18],
    notes: '永昌府属州；腾冲卫。'
  })
};

const regionMeans = { development: 40, unrest: 75, taxPressure: 49, armyPressure: 30, officeRisk: 46 };

module.exports = { province: '云南布政使司', UNITS, BLOCKS, regionMeans };
