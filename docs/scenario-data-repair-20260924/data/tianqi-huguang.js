// 天启剧本·湖广布政使司 15 府
//
// 《明史·地理志》只记湖广全省户口。本省权重：
//   人口：各府州县单位数（《明史》卷44，「领州X县Y」合计，属州归本府）× 密度系数。
//         地图上没有自己地块的郴州（直隶州）并入衡州块、靖州（直隶州）并入永州块、
//         永顺保靖二宣慰司与施州卫并入辰州块（按县治坐标落块核过）。
//   税额：民口 × 田赋轻重；江汉、洞庭平原偏重，山区偏轻。田亩：州县数 × 地形系数。
// 湖广省的渔课总数为 0（剧本原值），只在洞庭、江汉诸府的标签上标出渔业。
'use strict';

const { block, unit } = require('./lib-blocks');

const UNITS = [
  unit({ name: '武昌府', countyCount: 10, density: 1.4, taxIntensity: 1.1, terrainLand: 1.0, basis: '领州一县九（兴国州）；省会。' }),
  unit({ name: '汉阳府', countyCount: 2, density: 2.0, taxIntensity: 1.1, terrainLand: 1.2, basis: '领县二；汉口镇人烟稠密。' }),
  unit({ name: '黄州府', countyCount: 9, density: 1.3, taxIntensity: 1.0, terrainLand: 1.0, basis: '领州一县八（蕲州）。' }),
  unit({ name: '承天府', countyCount: 7, density: 1.3, taxIntensity: 1.1, terrainLand: 1.2, basis: '领州二县五（荆门、沔阳）；江汉平原。' }),
  unit({ name: '德安府', countyCount: 6, density: 1.0, taxIntensity: 1.0, terrainLand: 1.0, basis: '领州一县五（随州）。' }),
  unit({ name: '岳州府', countyCount: 8, density: 1.1, taxIntensity: 1.0, terrainLand: 1.2, basis: '领州一县七（澧州）；洞庭湖区。' }),
  unit({ name: '荆州府', countyCount: 13, density: 1.3, taxIntensity: 1.1, terrainLand: 1.3, basis: '领州二县十一（夷陵、归州）；江陵平原。' }),
  unit({ name: '襄阳府', countyCount: 7, density: 1.1, taxIntensity: 1.0, terrainLand: 1.0, basis: '领州一县六。' }),
  unit({ name: '郧阳府', countyCount: 7, density: 0.6, taxIntensity: 0.7, terrainLand: 0.5, basis: '领县七；荆襄山区，成化间为安置流民设府。' }),
  unit({ name: '长沙府', countyCount: 12, density: 1.4, taxIntensity: 1.0, terrainLand: 1.1, basis: '领州一县十一。' }),
  unit({ name: '常德府', countyCount: 4, density: 1.2, taxIntensity: 1.0, terrainLand: 1.2, basis: '领县四；沅水入湖处。' }),
  unit({ name: '衡州府', countyCount: 10, density: 1.2, taxIntensity: 0.9, terrainLand: 0.9, basis: '领州一县九（桂阳州）。' }),
  unit({ name: '永州府', countyCount: 8, density: 0.9, taxIntensity: 0.8, terrainLand: 0.7, basis: '领州一县七（道州）。' }),
  unit({ name: '宝庆府', countyCount: 5, density: 1.0, taxIntensity: 0.8, terrainLand: 0.7, basis: '领州一县四（武冈州）。' }),
  unit({ name: '辰州府', countyCount: 7, density: 0.6, taxIntensity: 0.7, terrainLand: 0.5, basis: '领州一县六（沅州）；湘西山区。' }),
  unit({ name: '郴州', block: '衡州府', countyCount: 6, density: 0.8, taxIntensity: 0.8, terrainLand: 0.6, basis: '直隶州，领县五；地图无独立地块，县治落在衡州块。' }),
  unit({ name: '靖州', block: '永州府', countyCount: 5, density: 0.5, taxIntensity: 0.6, terrainLand: 0.4, basis: '直隶州，领县四，苗疆；地图无独立地块，州治落在永州块。' }),
  unit({ name: '永顺保靖施州', block: '辰州府', countyCount: 3, density: 0.5, taxIntensity: 0.3, terrainLand: 0.4, basis: '永顺、保靖二宣慰司与施州卫，土司与卫所，贡赋轻；治所落在辰州块。' })
];

const BLOCKS = {
  武昌府: block({
    name: '武昌府', terrain: '丘陵', specialResources: '茶·铁·稻米', tags: { fishingRegion: true },
    description: '湖广省会，楚王封藩于此，黄鹤楼下江汉交汇；武昌、兴国一带山水相间，有冶铁与茶叶之利。',
    commerce: 1.6, corridor: 1.3, keju: 1.8,
    idx: [50, 64, 78, 78, 60, 44, 26, 54], fisc: [0.72, 0.18],
    notes: '楚王府。'
  }),
  汉阳府: block({
    name: '汉阳府', terrain: '水乡', specialResources: '转运商货·淮盐·湖米', tags: { fishingRegion: true },
    description: '汉水入江之口，汉口镇商船蚁聚，为天下四大名镇之一，淮盐、川货、湖米在此转输。',
    commerce: 2.8, corridor: 1.4, keju: 0.8,
    idx: [50, 66, 84, 84, 60, 44, 20, 54], fisc: [0.72, 0.19],
    notes: '汉口镇。'
  }),
  黄州府: block({
    name: '黄州府', terrain: '丘陵', specialResources: '稻米·药材·茶', tags: {},
    description: '大别山南麓，黄冈、麻城一带文风颇盛，麻城多出科第与富商；蕲州出艾草药材，李时珍故里在焉。',
    commerce: 1.0, corridor: 1.0, keju: 2.0,
    idx: [50, 60, 72, 72, 62, 42, 20, 50], fisc: [0.74, 0.17],
    notes: '蕲州李时珍故里。'
  }),
  承天府: block({
    name: '承天府', terrain: '平原', specialResources: '稻米·棉', tags: { imperialDomain: true },
    description: '世宗兴献王旧邸所在，显陵在钟祥，因此升州为府；江汉平原沃野，稻米丰饶，守陵役重。',
    commerce: 1.0, corridor: 1.0, keju: 1.2,
    idx: [48, 62, 76, 76, 62, 46, 22, 52], fisc: [0.72, 0.17],
    notes: '嘉靖十年升安陆州为承天府；显陵。'
  }),
  德安府: block({
    name: '德安府', terrain: '平原', specialResources: '稻米·麦', tags: {},
    description: '汉北平原与大洪山交错，安陆、随州一带务农为本，户口中等。',
    commerce: 0.8, corridor: 1.1, keju: 0.8,
    idx: [52, 58, 68, 68, 60, 40, 20, 48], fisc: [0.76, 0.16],
    notes: '随州属德安府。'
  }),
  岳州府: block({
    name: '岳州府', terrain: '水乡', specialResources: '稻米·鱼·茶', tags: { fishingRegion: true },
    description: '洞庭湖东岸，巴陵为府治，岳阳楼下舟船辐辏；北部澧州亦属其境，湖区圩田连片。',
    commerce: 1.2, corridor: 1.2, keju: 1.0,
    idx: [52, 58, 74, 74, 60, 40, 20, 48], fisc: [0.76, 0.16],
    notes: '洞庭湖区。'
  }),
  荆州府: block({
    name: '荆州府', terrain: '平原', specialResources: '稻米·棉·沙市商货', tags: { fishingRegion: true },
    description: '长江中游重镇，荆州城为亲王藩府所在，沙市为商埠；江陵平原稻米丰饶，所谓“湖广熟，天下足”；夷陵、归州扼三峡东口。',
    commerce: 1.4, corridor: 1.3, keju: 1.5,
    idx: [50, 62, 80, 80, 60, 44, 24, 52], fisc: [0.72, 0.18],
    notes: '江陵平原。'
  }),
  襄阳府: block({
    name: '襄阳府', terrain: '河谷', specialResources: '稻麦·棉·商货', tags: {},
    description: '汉水中游，襄阳与樊城隔江相望，是南北交通的枢纽，襄王封藩于此；山水形胜，兵家必争。',
    commerce: 1.3, corridor: 1.4, keju: 0.8,
    idx: [50, 60, 70, 70, 62, 40, 26, 50], fisc: [0.74, 0.17],
    notes: '襄王府。'
  }),
  郧阳府: block({
    name: '郧阳府', terrain: '山地', specialResources: '木材·药材·漆', tags: {},
    description: '荆襄山区，成化年间为安置流民而设府，郧阳抚治驻此；山深林密，流民聚散无常。',
    commerce: 0.6, corridor: 0.8, keju: 0.3, flee: 1.3,
    idx: [46, 60, 52, 52, 72, 36, 30, 50], fisc: [0.72, 0.17],
    notes: '郧阳抚治。'
  }),
  长沙府: block({
    name: '长沙府', terrain: '丘陵', specialResources: '稻米·茶·湘绣', tags: {},
    description: '湘江下游，吉王封藩于此，长沙、湘潭为湖南米谷与商货集散之地；岳麓书院传朱张遗绪。',
    commerce: 1.3, corridor: 1.2, keju: 1.3,
    idx: [52, 60, 76, 76, 60, 42, 20, 50], fisc: [0.75, 0.17],
    notes: '吉王府；湘潭米市。'
  }),
  常德府: block({
    name: '常德府', terrain: '平原', specialResources: '稻米·桐油·木材', tags: { fishingRegion: true },
    description: '沅水入洞庭之处，荣王封藩于常德；湖区稻米丰饶，西通辰沅，为湘西门户。',
    commerce: 1.1, corridor: 1.0, keju: 0.8,
    idx: [52, 58, 74, 74, 60, 40, 20, 48], fisc: [0.76, 0.16],
    notes: '荣王府。'
  }),
  衡州府: block({
    name: '衡州府', terrain: '丘陵', specialResources: '稻米·铅锡·茶', tags: {},
    description: '南岳衡山所在，衡阳扼湘桂孔道；南部郴州、桂阳一带山区出铅锡，矿徒易聚。',
    commerce: 1.1, corridor: 1.2, keju: 1.0,
    idx: [50, 60, 68, 68, 64, 40, 22, 50], fisc: [0.74, 0.17],
    notes: '郴州直隶州并入本块。'
  }),
  永州府: block({
    name: '永州府', terrain: '丘陵', specialResources: '稻米·木材·药材', tags: {},
    description: '潇湘之源，零陵、道州山水清奇而地瘠民贫；西部靖州一带苗疆，卫所与土司杂处。',
    commerce: 0.8, corridor: 1.1, keju: 0.6,
    idx: [50, 58, 58, 58, 66, 38, 24, 48], fisc: [0.75, 0.16],
    notes: '靖州直隶州并入本块。'
  }),
  宝庆府: block({
    name: '宝庆府', terrain: '丘陵', specialResources: '稻米·木材·煤', tags: {},
    description: '资水流域，邵阳为府治，武冈州有岷王封藩；山多田少，民性劲悍。',
    commerce: 0.8, corridor: 0.9, keju: 0.6,
    idx: [50, 58, 60, 60, 66, 38, 24, 48], fisc: [0.75, 0.16],
    notes: '岷王府在武冈。'
  }),
  辰州府: block({
    name: '辰州府', terrain: '山地', specialResources: '朱砂·木材·桐油', tags: {},
    description: '湘西沅水流域，辰州朱砂天下闻名；永顺、保靖二宣慰司土兵善战，施州卫扼川鄂之交，苗峒与汉民杂处。',
    commerce: 0.8, corridor: 1.0, keju: 0.3,
    idx: [48, 60, 52, 52, 70, 36, 32, 50], fisc: [0.74, 0.17],
    notes: '永顺保靖土兵曾援辽。'
  })
};

const regionMeans = { development: 72, unrest: 63, taxPressure: 41, armyPressure: 22, officeRisk: 50 };

module.exports = { province: '湖广布政使司', UNITS, BLOCKS, regionMeans };
