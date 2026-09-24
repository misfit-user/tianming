// 天启剧本·广西布政使司 11 块（9 府、2 土州）
//
// 《明史·地理志》只记广西全省户口，桂西大片是土司地，册籍户口远少于实有人口。
// 地图画的边界与明代府界不全重合，属州与土司按治所坐标落块（核过）：
//   梧州府属郁林州（连同博白、北流、陆川、兴业）落在浔州块；柳州府属宾州（连同迁江、上林）落在思恩块；
//   庆远府属南丹、东兰、那地三土州与西隆州落在泗城块；南宁府属新宁、上思二州与思明府、龙州落在太平块；
//   镇安府与归顺、向武、奉议诸州落在田州块。
// 本省权重：
//   人口：州县单位数 × 密度。流官府县按册籍密度；土州土府按实有人口估，密度压低。
//   税额：民口 × 田赋轻重，土司贡赋轻；田亩：州县数 × 地形系数，土司地的田土多未入册，系数压低。
// 矿课与矿厂给南丹锡（泗城块）与贺县、富川锡（平乐）；河池锡银在庆远。
// 田州、泗城州为岑氏世袭土州，辖治类型记为土司。
'use strict';

const { block, unit } = require('./lib-blocks');

const UNITS = [
  unit({ name: '桂林府', countyCount: 9, density: 1.3, taxIntensity: 1.0, terrainLand: 1.0, basis: '领州二县七（全州、永宁州）；省会。' }),
  unit({ name: '平乐府', countyCount: 8, density: 1.0, taxIntensity: 0.9, terrainLand: 0.9, basis: '领州一县七（永安州）。' }),
  unit({ name: '梧州府', countyCount: 5, density: 1.1, taxIntensity: 1.0, terrainLand: 0.9, basis: '领州一县九共十，扣去郁林州（州一县四）。' }),
  unit({ name: '郁林州', block: '浔州府', countyCount: 5, density: 1.0, taxIntensity: 0.9, terrainLand: 1.0, basis: '梧州府属州，领博白、北流、陆川、兴业；州治落在浔州块。' }),
  unit({ name: '浔州府', countyCount: 3, density: 1.1, taxIntensity: 1.0, terrainLand: 1.1, basis: '领县三（桂平、平南、贵县）。' }),
  unit({ name: '柳州府', countyCount: 9, density: 0.9, taxIntensity: 0.8, terrainLand: 0.9, basis: '领州二县十共十二，扣去宾州（州一县二）。' }),
  unit({ name: '宾州', block: '思恩府', countyCount: 3, density: 0.9, taxIntensity: 0.8, terrainLand: 0.9, basis: '柳州府属州，领迁江、上林；州治落在思恩块。' }),
  unit({ name: '庆远府', countyCount: 6, density: 0.6, taxIntensity: 0.6, terrainLand: 0.6, basis: '领州四县五共九，扣去南丹、东兰、那地三土州。' }),
  unit({ name: '南丹东兰那地', block: '泗城州', countyCount: 3, density: 0.5, taxIntensity: 0.2, terrainLand: 0.25, basis: '庆远府属三土州；治所落在泗城块。' }),
  unit({ name: '南宁府', countyCount: 5, density: 1.1, taxIntensity: 0.9, terrainLand: 1.0, basis: '领州四县三共七，扣去新宁、上思二州。' }),
  unit({ name: '新宁上思', block: '太平府', countyCount: 2, density: 0.7, taxIntensity: 0.6, terrainLand: 0.7, basis: '南宁府属二州；治所落在太平块。' }),
  unit({ name: '太平府', countyCount: 17, density: 0.25, taxIntensity: 0.3, terrainLand: 0.25, basis: '领州十七，多为土州，土官各统其民。' }),
  unit({ name: '思明龙州', block: '太平府', countyCount: 4, density: 0.3, taxIntensity: 0.2, terrainLand: 0.25, basis: '思明土府与龙州；治所落在太平块。' }),
  unit({ name: '思恩府', countyCount: 5, density: 0.4, taxIntensity: 0.4, terrainLand: 0.6, basis: '军民府，辖九土巡检司，按五单位计。' }),
  unit({ name: '田州', countyCount: 3, density: 0.5, taxIntensity: 0.2, terrainLand: 0.4, basis: '岑氏土州，辖地连同上林、阳万诸峒。' }),
  unit({ name: '镇安归顺', block: '田州', countyCount: 4, density: 0.35, taxIntensity: 0.2, terrainLand: 0.25, basis: '镇安土府与归顺、向武、奉议诸州；治所落在田州块。' }),
  unit({ name: '泗城州', countyCount: 3, density: 0.5, taxIntensity: 0.2, terrainLand: 0.4, basis: '岑氏土州，辖地辽阔。' }),
  unit({ name: '西隆安隆', block: '泗城州', countyCount: 2, density: 0.3, taxIntensity: 0.2, terrainLand: 0.25, basis: '西隆州与安隆长官司；治所落在泗城块。' })
];

const BLOCKS = {
  桂林府: block({
    name: '桂林府', terrain: '丘陵', specialResources: '稻米·竹木·茶', tags: { mineralRegion: true },
    description: '广西省会，靖江王封藩于此，城外奇峰林立，漓江清浅；北经兴安灵渠通湘江，为湘桂孔道。全州、永宁州也属其境。',
    commerce: 1.4, fishing: 0, mineral: 0.1, corridor: 1.4, keju: 2.5,
    idx: [48, 58, 50, 50, 70, 50, 30, 48], fisc: [0.72, 0.18],
    notes: '靖江王府；灵渠。'
  }),
  平乐府: block({
    name: '平乐府', terrain: '丘陵', specialResources: '锡·稻米·木材', tags: { mineralRegion: true },
    description: '漓江下游，平乐、荔浦、恭城一带山多田少；东部贺县、富川出锡，瑶民居于山中。',
    commerce: 1.0, fishing: 0, mineral: 0.25, kuangchang: 1, corridor: 1.1, keju: 1.0,
    idx: [46, 58, 42, 42, 74, 48, 28, 48], fisc: [0.72, 0.18],
    notes: '贺县锡。'
  }),
  梧州府: block({
    name: '梧州府', terrain: '河谷', specialResources: '桂皮·八角·商货', tags: { mineralRegion: true },
    description: '三江汇流之处，西江门户，广西土货由此下广州，盐船由此上溯；成化年间两广总督初开府于此。',
    commerce: 1.8, fishing: 0, mineral: 0.1, corridor: 1.4, keju: 1.0,
    idx: [48, 60, 50, 50, 72, 50, 32, 50], fisc: [0.72, 0.18],
    notes: '成化五年设两广总督府于梧州，嘉靖末移驻肇庆。'
  }),
  浔州府: block({
    name: '浔州府', terrain: '河谷', specialResources: '桂皮·稻米·蓝靛', tags: {},
    description: '浔江两岸，桂平、平南一带即大藤峡所在，成化、嘉靖间瑶民屡起，官军数度征剿；南部郁林州沃野宜稻。',
    commerce: 1.1, fishing: 0, corridor: 1.2, keju: 0.8,
    idx: [44, 58, 42, 42, 80, 50, 34, 50], fisc: [0.71, 0.18],
    notes: '大藤峡；梧州府属郁林州并入本块。'
  }),
  柳州府: block({
    name: '柳州府', terrain: '丘陵', specialResources: '木材·稻米·药材', tags: {},
    description: '柳江流域，柳宗元旧治，山峒之中壮、瑶杂居；融县、罗城北接黔楚苗疆。',
    commerce: 1.0, fishing: 0, corridor: 1.1, keju: 0.8,
    idx: [44, 58, 38, 38, 80, 48, 30, 48], fisc: [0.72, 0.18],
    notes: '柳宗元曾任柳州刺史。'
  }),
  思恩府: block({
    name: '思恩府', terrain: '山地', specialResources: '药材·木材·稻米', tags: {},
    description: '弘治末年改设流官的军民府，府治屡迁；所辖八寨山峒险峻，嘉靖初王守仁曾率兵平定。东部宾州、上林、迁江平川稍广。',
    commerce: 0.7, fishing: 0, corridor: 0.9, keju: 0.4,
    idx: [40, 58, 30, 30, 84, 46, 32, 50], fisc: [0.70, 0.18],
    notes: '八寨；柳州府属宾州并入本块。'
  }),
  庆远府: block({
    name: '庆远府', terrain: '山地', specialResources: '锡·银·药材', tags: { mineralRegion: true },
    description: '龙江流域，宜山为府治，河池一带出锡与银；忻城土官与流官并治，山峒之民多未入籍。',
    commerce: 0.8, fishing: 0, mineral: 0.2, corridor: 0.9, keju: 0.4,
    idx: [40, 58, 30, 30, 84, 46, 30, 50], fisc: [0.70, 0.18],
    notes: '河池锡银。'
  }),
  南宁府: block({
    name: '南宁府', terrain: '盆地', specialResources: '稻米·甘蔗·药材', tags: {},
    description: '邕江之畔，左右两江在此汇合，为桂西南重镇；横州、永淳一带稻田沿江。',
    commerce: 1.2, fishing: 0, corridor: 1.2, keju: 0.8,
    idx: [46, 58, 42, 42, 76, 48, 30, 48], fisc: [0.72, 0.18],
    notes: '左右江汇流。'
  }),
  太平府: block({
    name: '太平府', terrain: '丘陵', specialResources: '八角·蓝靛·稻米', tags: {},
    description: '左江流域，太平府下十余土州，土官各统其民，贡赋轻微；思明府、龙州与安南接壤，边关互市与纷争并存。',
    commerce: 0.8, fishing: 0, corridor: 1.0, keju: 0.2,
    idx: [44, 56, 30, 30, 78, 40, 36, 48], fisc: [0.70, 0.17],
    notes: '南宁府属新宁、上思二州与思明府、龙州并入本块。'
  }),
  田州: block({
    name: '田州', terrain: '河谷', divisionType: '州', regionType: 'tusi', officialPosition: '土知州', specialResources: '稻米·药材·木材', tags: {},
    description: '右江上游，田州岑氏世袭土官，狼兵骁勇，嘉靖年间瓦氏夫人曾率之抗倭，此后屡被朝廷征调；镇安府、归顺州诸土司分布左近。',
    commerce: 0.6, fishing: 0, corridor: 0.9, keju: 0.1,
    idx: [40, 56, 26, 26, 84, 40, 32, 50], fisc: [0.68, 0.17],
    notes: '岑氏土州；镇安府与归顺诸州并入本块。'
  }),
  泗城州: block({
    name: '泗城州', terrain: '山地', divisionType: '州', regionType: 'tusi', officialPosition: '土知州', specialResources: '锡·药材·马', tags: { mineralRegion: true },
    description: '红水河上游，泗城州岑氏土官辖地辽阔，西接云贵；南丹、东兰、那地诸土州杂处其间，南丹锡矿闻名。',
    commerce: 0.6, fishing: 0, mineral: 0.35, kuangchang: 1, corridor: 0.8, keju: 0.1,
    idx: [40, 56, 26, 26, 84, 40, 30, 50], fisc: [0.68, 0.17],
    notes: '岑氏土州；南丹锡矿；南丹、东兰、那地与西隆并入本块。'
  })
};

const regionMeans = { development: 38, unrest: 78, taxPressure: 49, armyPressure: 30, officeRisk: 49 };

module.exports = { province: '广西布政使司', UNITS, BLOCKS, regionMeans };
