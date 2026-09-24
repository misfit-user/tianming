// 天启剧本·福建布政使司 8 府 1 州
//
// 《明史·地理志》只记福建全省户口。本省权重：
//   人口：各府州领州县数（《明史》卷45）× 密度系数。沿海福、兴、泉、漳稠密（兴化二县尤甚），闽北闽西山区稀疏。
//   税额：民口 × 田赋轻重；汀州山区偏轻。
//   田亩：领州县数 × 地形系数（福建山多田少，系数普遍偏低）。
// 盐课分给沿海盐场所在的泉、兴、福、漳、福宁；海贸以漳州月港为最（隆庆开海后唯一准许商船出洋之口）。
'use strict';

const { block, unit } = require('./lib-blocks');

const UNITS = [
  unit({ name: '福州府', countyCount: 9, density: 1.6, taxIntensity: 1.0, terrainLand: 0.8, basis: '领县九；省会。' }),
  unit({ name: '兴化府', countyCount: 2, density: 3.0, taxIntensity: 1.1, terrainLand: 0.9, basis: '领县二（莆田、仙游）；地狭人稠。' }),
  unit({ name: '泉州府', countyCount: 7, density: 2.0, taxIntensity: 1.0, terrainLand: 0.8, basis: '领县七；海商之乡。' }),
  unit({ name: '漳州府', countyCount: 10, density: 1.4, taxIntensity: 0.9, terrainLand: 0.8, basis: '领县十；月港所在。' }),
  unit({ name: '延平府', countyCount: 7, density: 0.9, taxIntensity: 0.9, terrainLand: 0.6, basis: '领县七；闽江上游山区。' }),
  unit({ name: '建宁府', countyCount: 8, density: 1.0, taxIntensity: 1.0, terrainLand: 0.7, basis: '领县八；闽北。' }),
  unit({ name: '邵武府', countyCount: 4, density: 0.8, taxIntensity: 0.9, terrainLand: 0.6, basis: '领县四；闽西北山区。' }),
  unit({ name: '汀州府', countyCount: 8, density: 0.8, taxIntensity: 0.7, terrainLand: 0.5, basis: '领县八；闽西山区，客民聚居。' }),
  unit({ name: '福宁州', countyCount: 3, density: 1.0, taxIntensity: 0.8, terrainLand: 0.6, basis: '直隶州，领县二（福安、宁德）。' })
];

const BLOCKS = {
  福州府: block({
    name: '福州府', terrain: '沿海', specialResources: '海鱼·海盐·荔枝', tags: { hasPort: true, saltRegion: true, fishingRegion: true },
    description: '福建省会，闽江入海之口，琉球贡使由此登岸。城中科第之盛甲于全闽；近年红毛夷船屡窥闽海，天启四年方从澎湖逐走。',
    commerce: 1.6, maritime: 0.15, salt: 0.25, fishing: 2.5, corridor: 1.2, keju: 3.0,
    idx: [56, 64, 74, 74, 58, 42, 40, 54], fisc: [0.74, 0.17],
    notes: '琉球贡道；天启四年荷兰人撤出澎湖。'
  }),
  兴化府: block({
    name: '兴化府', terrain: '沿海', specialResources: '海盐·荔枝·龙眼', tags: { hasPort: true, saltRegion: true, fishingRegion: true },
    description: '莆田、仙游二县地狭人稠，科第之盛为天下所称；沿海盐场与荔枝龙眼之利并举，民多出洋谋生。',
    commerce: 1.2, maritime: 0.05, salt: 0.25, fishing: 2.0, corridor: 1.0, keju: 2.5,
    idx: [58, 60, 70, 70, 58, 44, 34, 50], fisc: [0.76, 0.16],
    notes: '莆田科第；上里盐场。'
  }),
  泉州府: block({
    name: '泉州府', terrain: '沿海', specialResources: '海贸·海盐·糖', tags: { hasPort: true, saltRegion: true, fishingRegion: true },
    description: '刺桐古港，宋元海贸之盛已成旧梦，而晋江、南安海商仍遍布东西洋。今年海寇郑芝龙聚众袭扰厦门中左所与沿海诸所，官军屡败，海上商民多有附之者。',
    commerce: 1.8, maritime: 0.25, salt: 0.35, fishing: 2.5, corridor: 1.0, keju: 2.5,
    idx: [52, 66, 72, 72, 66, 40, 48, 54], fisc: [0.72, 0.18],
    notes: '天启七年郑芝龙犯厦门中左所，总兵俞咨皋败；次年受抚。'
  }),
  漳州府: block({
    name: '漳州府', terrain: '沿海', specialResources: '海贸·海盐·糖', tags: { hasPort: true, saltRegion: true, fishingRegion: true },
    description: '海澄月港是朝廷准许商船出洋的唯一口岸，每岁发给船引，舟往东西洋，督饷馆征收番货之税；铜山、玄钟诸所防守海上。',
    commerce: 2.0, maritime: 0.45, salt: 0.10, fishing: 2.5, corridor: 1.0, keju: 1.5,
    idx: [52, 68, 72, 72, 66, 40, 46, 56], fisc: [0.72, 0.19],
    notes: '月港（隆庆元年开海）；督饷馆。'
  }),
  延平府: block({
    name: '延平府', terrain: '山地', specialResources: '木材·纸·茶', tags: {},
    description: '闽江上游三溪汇流之地，南平扼闽北入省之路；山多田少，出木材、纸与茶。',
    commerce: 0.9, fishing: 0.3, corridor: 1.1, keju: 0.8,
    idx: [56, 60, 56, 56, 60, 40, 28, 50], fisc: [0.76, 0.16],
    notes: '闽江上游。'
  }),
  建宁府: block({
    name: '建宁府', terrain: '山地', specialResources: '书籍·茶·纸', tags: {},
    description: '闽北武夷山下，建阳麻沙书坊刻书行销天下，武夷茶渐有盛名；地近浙赣，商路所经。',
    commerce: 1.2, fishing: 0.3, corridor: 1.0, keju: 1.2,
    idx: [56, 60, 62, 62, 58, 42, 28, 50], fisc: [0.76, 0.16],
    notes: '建阳书坊。'
  }),
  邵武府: block({
    name: '邵武府', terrain: '山地', specialResources: '纸·木材', tags: {},
    description: '闽西北山区，邵武、光泽与江西接壤，出纸与木材；户口稀少，民风朴实。',
    commerce: 0.8, fishing: 0.3, corridor: 0.9, keju: 0.6,
    idx: [56, 58, 54, 54, 60, 38, 26, 48], fisc: [0.76, 0.16],
    notes: '闽赣交界。'
  }),
  汀州府: block({
    name: '汀州府', terrain: '山地', specialResources: '纸·木材·铁', tags: {},
    description: '闽西山区，客家聚居，汀江南下可达潮州；山多田少，流民与矿徒时聚时散。',
    commerce: 0.8, fishing: 0.3, corridor: 0.9, keju: 0.6, flee: 1.2,
    idx: [50, 60, 50, 50, 68, 36, 32, 50], fisc: [0.74, 0.17],
    notes: '闽粤赣交界山区。'
  }),
  福宁州: block({
    name: '福宁州', terrain: '沿海', divisionType: '州', officialPosition: '知州', specialResources: '海鱼·茶', tags: { hasPort: true, saltRegion: true, fishingRegion: true },
    description: '闽东北海滨，福安、宁德与浙江温州相接，山海之间地瘠民贫；沿海卫所防倭。',
    commerce: 0.9, maritime: 0.05, salt: 0.05, fishing: 2.5, corridor: 0.9, keju: 0.4,
    idx: [54, 60, 54, 54, 62, 38, 40, 50], fisc: [0.75, 0.17],
    notes: '直隶州。'
  })
};

const regionMeans = { development: 64, unrest: 62, taxPressure: 41, armyPressure: 35, officeRisk: 52 };

module.exports = { province: '福建布政使司', UNITS, BLOCKS, regionMeans };
