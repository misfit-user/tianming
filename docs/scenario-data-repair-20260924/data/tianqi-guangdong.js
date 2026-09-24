// 天启剧本·广东布政使司 10 府
//
// 《明史·地理志》只记广东全省户口。地图画了 10 府（澳门另成一块，不在本省），其余政区按治所坐标落块（核过）：
//   广州府属连州（连同阳山、连山）落在韶州块；罗定直隶州落在肇庆块。
// 本省权重：
//   人口：州县单位数（《明史》卷45，按天启七年建置：惠州连平州、潮州镇平县都是崇祯六年才设，不计）× 密度。
//   税额：民口 × 田赋轻重；田亩：州县数 × 地形系数。
// 海贸以广州为主（葡人赁居澳门，洋船入广州交易），潮州南澳次之；盐课按广东、海北两盐课提举司所辖盐场分布；
// 渔课按沿海各府海岸与渔场分配，明确写在各块，不用地形默认值。
'use strict';

const { block, unit } = require('./lib-blocks');

const UNITS = [
  unit({ name: '广州府', countyCount: 13, density: 1.6, taxIntensity: 1.1, terrainLand: 1.2, basis: '领州一县十五共十六，扣去连州（州一县二）；珠江三角洲。' }),
  unit({ name: '连州', block: '韶州府', countyCount: 3, density: 0.6, taxIntensity: 0.7, terrainLand: 0.6, basis: '广州府属州，领阳山、连山；州治落在韶州块。' }),
  unit({ name: '韶州府', countyCount: 6, density: 0.8, taxIntensity: 0.8, terrainLand: 0.7, basis: '领县六。' }),
  unit({ name: '南雄府', countyCount: 2, density: 0.9, taxIntensity: 0.9, terrainLand: 0.7, basis: '领县二（保昌、始兴）。' }),
  unit({ name: '惠州府', countyCount: 10, density: 0.9, taxIntensity: 0.9, terrainLand: 0.9, basis: '领县十；连平州崇祯六年方设。' }),
  unit({ name: '潮州府', countyCount: 10, density: 1.3, taxIntensity: 1.0, terrainLand: 1.0, basis: '领县十；镇平县崇祯六年方设。' }),
  unit({ name: '肇庆府', countyCount: 12, density: 1.0, taxIntensity: 1.0, terrainLand: 0.9, basis: '领州一县十一（德庆州）。' }),
  unit({ name: '罗定州', block: '肇庆府', countyCount: 3, density: 0.6, taxIntensity: 0.6, terrainLand: 0.6, basis: '直隶州，领县二，万历五年平罗旁后设；州治落在肇庆块。' }),
  unit({ name: '高州府', countyCount: 6, density: 0.9, taxIntensity: 0.9, terrainLand: 0.9, basis: '领州一县五（化州）。' }),
  unit({ name: '雷州府', countyCount: 3, density: 1.0, taxIntensity: 0.9, terrainLand: 1.0, basis: '领县三。' }),
  unit({ name: '廉州府', countyCount: 3, density: 0.8, taxIntensity: 0.8, terrainLand: 0.8, basis: '领州一县二（钦州）。' }),
  unit({ name: '琼州府', countyCount: 13, density: 0.7, taxIntensity: 0.7, terrainLand: 0.8, basis: '领州三县十（儋、万、崖）。' })
];

const BLOCKS = {
  广州府: block({
    name: '广州府', terrain: '水乡', specialResources: '丝·铁器·海货', tags: { hasPort: true, saltRegion: true, fishingRegion: true },
    description: '岭南首府，珠江三角洲河网纵横。葡萄牙人赁居香山澳，洋船按期入广州交易，商贾云集；佛山冶铁、顺德蚕桑、东莞莞香各擅其利，东莞、香山、新会沿海盐场相望。',
    commerce: 2.6, maritime: 0.70, salt: 0.22, fishing: 0.22, corridor: 1.4, keju: 3.0,
    idx: [58, 64, 82, 82, 56, 44, 34, 52], fisc: [0.72, 0.18],
    notes: '澳门另成一块；佛山冶铁。'
  }),
  韶州府: block({
    name: '韶州府', terrain: '山地', specialResources: '稻米·木材·茶', tags: {},
    description: '北江上游，南岭脚下，韶州为粤北重镇，曹溪南华寺是禅宗六祖道场；北上湖广、江西的商旅经此换舟。西北连州一带瑶民聚居山中。',
    commerce: 1.0, fishing: 0, corridor: 1.3, keju: 0.8,
    idx: [54, 58, 56, 56, 62, 40, 28, 48], fisc: [0.74, 0.17],
    notes: '广州府属连州并入本块。'
  }),
  南雄府: block({
    name: '南雄府', terrain: '山地', specialResources: '转运商货·稻米·木材', tags: {},
    description: '大庾岭梅关之南，江西货物翻越梅岭至此下北江，挑夫络绎不绝，是岭南的北大门。',
    commerce: 1.4, fishing: 0, corridor: 1.5, keju: 0.4,
    idx: [54, 58, 52, 52, 60, 40, 26, 48], fisc: [0.74, 0.17],
    notes: '梅关古道。'
  }),
  惠州府: block({
    name: '惠州府', terrain: '丘陵', specialResources: '稻米·盐·荔枝', tags: { saltRegion: true, fishingRegion: true },
    description: '东江流域，归善、博罗一带稻田与盐场相间，罗浮山荔枝名于岭南；海丰、归善沿海渔盐为业。',
    commerce: 1.0, maritime: 0.04, salt: 0.15, fishing: 0.12, corridor: 1.1, keju: 1.0,
    idx: [56, 58, 62, 62, 60, 40, 30, 48], fisc: [0.74, 0.17],
    notes: '淡水、石桥盐场。'
  }),
  潮州府: block({
    name: '潮州府', terrain: '沿海', specialResources: '蔗糖·盐·海货', tags: { hasPort: true, saltRegion: true, fishingRegion: true },
    description: '韩江三角洲，潮人善经商，蔗糖、盐与海货远贩闽浙；近海寇商时时出没，南澳岛为闽粤海防要冲。',
    commerce: 1.8, maritime: 0.12, salt: 0.20, fishing: 0.18, corridor: 1.1, keju: 1.3,
    idx: [54, 60, 70, 70, 64, 42, 40, 52], fisc: [0.72, 0.18],
    notes: '南澳副总兵；招收、小江、隆井盐场。'
  }),
  肇庆府: block({
    name: '肇庆府', terrain: '丘陵', specialResources: '端砚·稻米·木材', tags: { saltRegion: true, fishingRegion: true },
    description: '西江之畔，两广总督开府于此，节制两省兵马；端溪砚石天下第一。德庆州沿江，阳江滨海，西面罗定州是万历初年平定罗旁瑶乱后新设。',
    commerce: 1.2, salt: 0.03, fishing: 0.05, corridor: 1.3, keju: 1.2,
    idx: [56, 60, 64, 64, 58, 42, 38, 50], fisc: [0.73, 0.17],
    notes: '两广总督驻肇庆；阳江双恩盐场；罗定直隶州并入本块。'
  }),
  高州府: block({
    name: '高州府', terrain: '丘陵', specialResources: '稻米·盐·荔枝', tags: { saltRegion: true, fishingRegion: true },
    description: '粤西高凉故地，冼夫人遗泽犹存；稻田、盐场与荔枝园相间，化州出橘红，电白沿海有博茂盐场。',
    commerce: 0.9, maritime: 0.03, salt: 0.08, fishing: 0.10, corridor: 1.0, keju: 0.8,
    idx: [54, 58, 52, 52, 62, 40, 32, 48], fisc: [0.74, 0.17],
    notes: '化州橘红。'
  }),
  雷州府: block({
    name: '雷州府', terrain: '沿海', specialResources: '盐·蔗糖·稻米', tags: { saltRegion: true, fishingRegion: true },
    description: '雷州半岛三面环海，台风时至，地多红土，民以晒盐、种蔗为业；南渡海峡即琼州。',
    commerce: 0.9, maritime: 0.03, salt: 0.10, fishing: 0.10, corridor: 0.9, keju: 0.5,
    idx: [54, 58, 48, 48, 60, 40, 32, 48], fisc: [0.74, 0.17],
    notes: '雷州半岛。'
  }),
  廉州府: block({
    name: '廉州府', terrain: '沿海', specialResources: '珍珠·盐·海货', tags: { saltRegion: true, fishingRegion: true },
    description: '北部湾畔，合浦珠池出南珠，历朝采珠之役劳民伤财；海北盐课提举司驻此，钦州西接安南，边海多事。',
    commerce: 1.0, maritime: 0.03, salt: 0.12, fishing: 0.10, corridor: 0.9, keju: 0.3,
    idx: [52, 60, 46, 46, 62, 40, 36, 50], fisc: [0.73, 0.18],
    notes: '合浦珠池；海北盐课提举司。'
  }),
  琼州府: block({
    name: '琼州府', terrain: '岛屿', specialResources: '槟榔·沉香·椰子', tags: { hasPort: true, saltRegion: true, fishingRegion: true },
    description: '孤悬海外的琼州岛，环岛十余州县，中部五指山为黎峒所居；槟榔、沉香、椰子为土产，海口与崖州为南海航路泊船之所。',
    commerce: 0.9, maritime: 0.05, salt: 0.10, fishing: 0.13, corridor: 0.8, keju: 0.8,
    idx: [54, 58, 48, 48, 62, 38, 34, 48], fisc: [0.74, 0.17],
    notes: '儋、万、崖三州。'
  })
};

const regionMeans = { development: 66, unrest: 60, taxPressure: 41, armyPressure: 35, officeRisk: 50 };

module.exports = { province: '广东布政使司', UNITS, BLOCKS, regionMeans };
