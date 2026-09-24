// 天启剧本·河南布政使司 8 府 3 州
//
// 《明史·地理志》只记河南全省户口。地图把禹州从开封府、陕州从河南府切出。本省权重：
//   人口：州县单位数（《明史》卷42，切出的属州连同属县从本府扣除）× 密度系数。豫东豫北平原稠密，豫西山区稀疏。
//   税额：民口 × 田赋轻重；田亩：州县数 × 地形系数。
// 剧本里河南的「皇庄」田亩按王府庄田分布分配：福王（河南府）最多，周王（开封）、潞王（卫辉）、唐王（南阳）、
// 郑王（怀庆）、赵王（彰德）、崇王（汝宁）次之。
'use strict';

const { block, unit } = require('./lib-blocks');

const UNITS = [
  unit({ name: '开封府', countyCount: 32, density: 1.3, taxIntensity: 1.0, terrainLand: 1.2, basis: '领州四县三十共三十四，扣去禹州（州一县一）。' }),
  unit({ name: '归德府', countyCount: 9, density: 1.3, taxIntensity: 1.0, terrainLand: 1.2, basis: '领州一县八（睢州）。' }),
  unit({ name: '彰德府', countyCount: 7, density: 1.2, taxIntensity: 1.0, terrainLand: 1.0, basis: '领州一县六（磁州）。' }),
  unit({ name: '卫辉府', countyCount: 6, density: 1.2, taxIntensity: 1.0, terrainLand: 1.1, basis: '领县六。' }),
  unit({ name: '怀庆府', countyCount: 6, density: 1.3, taxIntensity: 1.0, terrainLand: 1.1, basis: '领县六。' }),
  unit({ name: '河南府', countyCount: 11, density: 1.1, taxIntensity: 1.0, terrainLand: 0.9, basis: '领州一县十三共十四，扣去陕州（州一县二）。' }),
  unit({ name: '汝宁府', countyCount: 14, density: 1.0, taxIntensity: 1.0, terrainLand: 1.1, basis: '领州二县十二（信阳、光州）。' }),
  unit({ name: '南阳府', countyCount: 13, density: 0.8, taxIntensity: 0.8, terrainLand: 1.0, basis: '领州二县十一（邓州、裕州）；地广人稀。' }),
  unit({ name: '汝州', countyCount: 5, density: 0.8, taxIntensity: 0.8, terrainLand: 0.8, basis: '直隶州，领县四。' }),
  unit({ name: '陕州', countyCount: 3, density: 0.7, taxIntensity: 0.8, terrainLand: 0.6, basis: '河南府属州，领县二（灵宝、阌乡）。' }),
  unit({ name: '禹州', countyCount: 2, density: 1.1, taxIntensity: 1.0, terrainLand: 1.0, basis: '开封府属州，领县一（密县）。' })
];

const BLOCKS = {
  开封府: block({
    name: '开封府', terrain: '平原', specialResources: '麦·棉·芝麻', tags: { imperialDomain: true },
    description: '中州首府，周王封藩于此，大梁城高池深；黄河自西北绕城而过，堤防稍懈即有决溢之忧。许州、郑州、陈州诸属州平原千里，务麦棉。',
    commerce: 1.6, fishing: 0, imperial: 0.15, corridor: 1.3, keju: 2.0,
    idx: [38, 74, 52, 52, 76, 64, 24, 60], fisc: [0.70, 0.19],
    notes: '周王府。'
  }),
  归德府: block({
    name: '归德府', terrain: '平原', specialResources: '麦·棉·枣', tags: {},
    description: '商丘故地，豫东平原，黄河故道横贯，沙碱与水患并存；睢州、宁陵一带多出士绅。',
    commerce: 1.1, fishing: 0, imperial: 0.02, corridor: 1.1, keju: 1.2,
    idx: [36, 72, 44, 44, 80, 64, 20, 58], fisc: [0.70, 0.19],
    notes: '黄河故道。'
  }),
  彰德府: block({
    name: '彰德府', terrain: '平原', specialResources: '麦·瓷器·煤铁', tags: { imperialDomain: true },
    description: '安阳殷墟故地，赵王封藩于此；西倚太行，磁州出瓷器与煤铁。',
    commerce: 1.0, fishing: 0, imperial: 0.05, corridor: 1.2, keju: 1.0,
    idx: [40, 70, 46, 46, 76, 62, 20, 58], fisc: [0.71, 0.18],
    notes: '赵王府；磁州窑。'
  }),
  卫辉府: block({
    name: '卫辉府', terrain: '平原', specialResources: '麦·棉·卫河漕运', tags: { imperialDomain: true },
    description: '卫河源头，潞王封藩于此，王府庄田遍布数府；汲县、新乡一带漕粮沿卫河北上。',
    commerce: 1.1, fishing: 0, imperial: 0.15, corridor: 1.2, keju: 0.9,
    idx: [36, 74, 44, 44, 80, 66, 20, 60], fisc: [0.68, 0.20],
    notes: '潞王府。'
  }),
  怀庆府: block({
    name: '怀庆府', terrain: '平原', specialResources: '怀药·麦·棉', tags: { imperialDomain: true },
    description: '太行之南、黄河之北，郑王封藩于此；沁河流域盛产山药、地黄等“怀药”，行销四方。',
    commerce: 1.1, fishing: 0, imperial: 0.10, corridor: 1.0, keju: 0.9,
    idx: [38, 72, 46, 46, 78, 64, 20, 58], fisc: [0.70, 0.19],
    notes: '郑王府；四大怀药。'
  }),
  河南府: block({
    name: '河南府', terrain: '盆地', specialResources: '麦·牡丹·瓷器', tags: { imperialDomain: true },
    description: '洛阳故都，福王封藩于此，所得庄田二万顷散在河南、山东、湖广，催租之人扰遍乡里，百姓怨声载道；龙门、邙山之间形胜犹存。',
    commerce: 1.3, fishing: 0, imperial: 0.35, corridor: 1.2, keju: 1.3,
    idx: [32, 76, 42, 42, 84, 68, 24, 62], fisc: [0.64, 0.21],
    notes: '福王府（万历四十二年就藩）；庄田二万顷。'
  }),
  汝宁府: block({
    name: '汝宁府', terrain: '平原', specialResources: '麦·稻·茶', tags: { imperialDomain: true },
    description: '淮河上游，崇王封藩于汝宁；信阳、光州南接大别山，北部平原麦稻兼作。',
    commerce: 0.9, fishing: 0, imperial: 0.05, corridor: 1.1, keju: 1.0,
    idx: [40, 70, 42, 42, 78, 62, 20, 58], fisc: [0.71, 0.18],
    notes: '崇王府；信阳茶。'
  }),
  南阳府: block({
    name: '南阳府', terrain: '盆地', specialResources: '麦·药材·丝', tags: { imperialDomain: true },
    description: '南阳盆地，唐王封藩于此；邓州、裕州一带地广人稀，荆襄流民往来，垦殖未尽。',
    commerce: 1.0, fishing: 0, imperial: 0.10, corridor: 1.1, keju: 0.8, flee: 1.2,
    idx: [40, 70, 38, 38, 80, 58, 22, 58], fisc: [0.70, 0.18],
    notes: '唐王府。'
  }),
  汝州: block({
    name: '汝州', terrain: '丘陵', divisionType: '州', officialPosition: '知州', specialResources: '麦·瓷器·煤', tags: {},
    description: '伏牛山东麓，汝州与鲁山、郏县、宝丰、伊阳诸县山多田少，汝窑旧迹犹存。',
    commerce: 0.7, fishing: 0, imperial: 0.01, corridor: 0.9, keju: 0.4,
    idx: [40, 70, 36, 36, 80, 60, 20, 58], fisc: [0.70, 0.18],
    notes: '直隶州。'
  }),
  陕州: block({
    name: '陕州', terrain: '丘陵', divisionType: '州', officialPosition: '知州', specialResources: '麦·枣·木材', tags: {},
    description: '崤函古道，黄河三门之险在焉，陕州与灵宝、阌乡扼关中入中原的咽喉，兵马往来频繁。',
    commerce: 0.8, fishing: 0, imperial: 0.01, corridor: 1.4, keju: 0.3,
    idx: [38, 70, 34, 34, 82, 60, 28, 58], fisc: [0.70, 0.18],
    notes: '河南府属州。'
  }),
  禹州: block({
    name: '禹州', terrain: '丘陵', divisionType: '州', officialPosition: '知州', specialResources: '麦·瓷器·药材', tags: {},
    description: '颍水上游，钧窑故地，禹州与密县一带务农兼制陶瓷，药材商人往来聚集。',
    commerce: 1.0, fishing: 0, imperial: 0.01, corridor: 1.0, keju: 0.3,
    idx: [40, 70, 42, 42, 78, 62, 20, 58], fisc: [0.70, 0.18],
    notes: '开封府属州；钧窑。'
  })
};

const regionMeans = { development: 44, unrest: 79, taxPressure: 63, armyPressure: 22, officeRisk: 59 };

module.exports = { province: '河南布政使司', UNITS, BLOCKS, regionMeans };
