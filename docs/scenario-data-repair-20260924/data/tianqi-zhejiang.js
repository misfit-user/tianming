// 天启剧本·浙江布政使司 11 府
//
// 《明史·地理志》只记浙江全省户口，没有分府数字。本省权重：
//   人口：各府领州县数（《明史》卷44）× 密度系数。杭嘉湖宁绍平原稠密，金衢与温台次之，严处山区稀疏。
//   税额：民口 × 田赋轻重。嘉兴、湖州官田多，赋额之重仅次苏松；杭州次之；浙西南山区偏轻。
//   田亩：领州县数 × 地形系数。
// 省总数一律不动，只改分配。
'use strict';

const { block, unit } = require('./lib-blocks');

const UNITS = [
  unit({ name: '杭州府', countyCount: 9, density: 1.8, taxIntensity: 1.2, terrainLand: 1.0, basis: '领县九；省会，运河南端，人烟稠密。' }),
  unit({ name: '嘉兴府', countyCount: 7, density: 2.2, taxIntensity: 1.6, terrainLand: 1.3, basis: '领县七；太湖东南水乡，户口最稠，官田多，重赋。' }),
  unit({ name: '湖州府', countyCount: 7, density: 1.7, taxIntensity: 1.5, terrainLand: 1.1, basis: '领州一县六（安吉州领孝丰）；蚕桑之乡，官田多，重赋。' }),
  unit({ name: '绍兴府', countyCount: 8, density: 2.0, taxIntensity: 1.0, terrainLand: 1.0, basis: '领县八；山会平原人稠，科第最盛。' }),
  unit({ name: '宁波府', countyCount: 5, density: 1.5, taxIntensity: 1.0, terrainLand: 0.9, basis: '领县五；浙东海口。' }),
  unit({ name: '台州府', countyCount: 6, density: 1.4, taxIntensity: 0.9, terrainLand: 0.8, basis: '领县六；山海之间。' }),
  unit({ name: '金华府', countyCount: 8, density: 1.2, taxIntensity: 0.9, terrainLand: 1.0, basis: '领县八；金衢盆地。' }),
  unit({ name: '衢州府', countyCount: 5, density: 1.0, taxIntensity: 0.8, terrainLand: 0.8, basis: '领县五；四省通衢，山多田少。' }),
  unit({ name: '严州府', countyCount: 6, density: 0.7, taxIntensity: 0.7, terrainLand: 0.6, basis: '领县六；新安江峡谷，户口稀少。' }),
  unit({ name: '温州府', countyCount: 5, density: 1.6, taxIntensity: 0.9, terrainLand: 0.8, basis: '领县五；瓯江口，人稠地少。' }),
  unit({ name: '处州府', countyCount: 10, density: 0.55, taxIntensity: 0.6, terrainLand: 0.5, basis: '领县十；浙西南群山，户口稀少。' })
];

const BLOCKS = {
  杭州府: block({
    name: '杭州府', terrain: '平原', specialResources: '丝绸·茶·书籍', tags: { fishingRegion: true },
    description: '浙江省会，西湖山水甲于东南，杭州织染局为三大织造之一；运河南端商旅辐辏，丝绸、茶叶、书籍在此集散。去年巡抚潘汝桢在西湖首建魏忠贤生祠，天下纷纷效尤，士论哗然。',
    commerce: 2.2, maritime: 0.10, fishing: 1.2, imperial: 0.20, textile: 2.0, zhizao: 1, corridor: 1.3, keju: 2.2, gentry: 1.3, hide: 1.3,
    idx: [56, 72, 90, 92, 58, 60, 40, 62], fisc: [0.70, 0.20],
    notes: '杭州织染局（三大织造之一）；天启六年潘汝桢建西湖魏忠贤生祠。'
  }),
  嘉兴府: block({
    name: '嘉兴府', terrain: '水乡', specialResources: '丝绸·稻米·桑麻', tags: { hasPort: true, fishingRegion: true },
    description: '太湖东南的水乡，桑麻稻米之饶，赋额之重仅次苏松。濮院、王江泾诸镇机户云集，乍浦一口可以通海。',
    commerce: 1.8, maritime: 0.10, fishing: 1.5, imperial: 0.30, textile: 2.2, corridor: 1.3, keju: 2.0, gentry: 1.4, hide: 1.3,
    idx: [55, 68, 90, 90, 58, 66, 35, 58], fisc: [0.66, 0.18],
    notes: '嘉湖官田重赋；丝织市镇。'
  }),
  湖州府: block({
    name: '湖州府', terrain: '水乡', specialResources: '湖丝·稻米·湖笔', tags: { fishingRegion: true },
    description: '太湖南岸，蚕桑之利甲天下，湖丝行销海内外，南浔、双林诸镇丝市兴旺。缙绅之家田连阡陌，湖笔亦出于此。',
    commerce: 1.8, fishing: 2.0, imperial: 0.30, textile: 2.5, corridor: 1.0, keju: 1.6, gentry: 1.5, hide: 1.3,
    idx: [56, 68, 90, 90, 58, 64, 35, 58], fisc: [0.66, 0.18],
    notes: '湖丝；嘉湖官田重赋。'
  }),
  绍兴府: block({
    name: '绍兴府', terrain: '水乡', specialResources: '黄酒·锡箔·稻米', tags: { fishingRegion: true },
    description: '山阴、会稽文风鼎盛，科第与幕僚之名遍于天下。鉴湖水乡，酿酒、锡箔为业；余姚、上虞亦多名宦。',
    commerce: 1.3, fishing: 1.5, maritime: 0.10, imperial: 0.08, textile: 1.2, corridor: 1.1, keju: 2.5, gentry: 1.3, hide: 1.3,
    idx: [60, 64, 86, 86, 58, 55, 38, 54], fisc: [0.74, 0.17],
    notes: '浙江科第最盛。'
  }),
  宁波府: block({
    name: '宁波府', terrain: '沿海', specialResources: '海鱼·海贸·稻米', tags: { hasPort: true, fishingRegion: true },
    description: '浙东海口，定海、象山诸卫所控扼海上，市舶旧事犹在人口。舟山渔场之利与商舶往来并盛，民多习海。',
    commerce: 1.6, maritime: 0.35, fishing: 3.5, imperial: 0.04, textile: 0.8, corridor: 1.0, keju: 2.0, gentry: 1.2,
    idx: [58, 66, 84, 84, 62, 52, 55, 56], fisc: [0.74, 0.18],
    notes: '舟山渔场；定海卫。'
  }),
  台州府: block({
    name: '台州府', terrain: '沿海', specialResources: '海鱼·柑橘·稻米', tags: { hasPort: true, fishingRegion: true },
    description: '浙东山海之间，倭患虽平而卫所仍严。临海、黄岩诸县田少民勤，以渔盐柑橘为生。',
    commerce: 1.0, maritime: 0.15, fishing: 2.5, imperial: 0.02, textile: 0.8, corridor: 0.8, keju: 1.0,
    idx: [58, 64, 76, 76, 64, 50, 50, 54], fisc: [0.75, 0.17],
    notes: '嘉靖年间戚继光台州九捷之地。'
  }),
  金华府: block({
    name: '金华府', terrain: '盆地', specialResources: '火腿·酒·茶', tags: {},
    description: '婺州旧地，金衢盆地的东半，火腿、酒与茶负有盛名。义乌、东阳民风劲悍，多出兵士，昔年戚继光募义乌兵平倭。',
    commerce: 1.0, fishing: 0.5, imperial: 0.02, textile: 0.8, corridor: 1.0, keju: 1.2,
    idx: [60, 62, 80, 80, 62, 52, 40, 52], fisc: [0.76, 0.16],
    notes: '义乌兵。'
  }),
  衢州府: block({
    name: '衢州府', terrain: '丘陵', specialResources: '纸·柑橘·木材', tags: {},
    description: '四省通衢，钱塘江上游舟楫可达江西、福建、南直，过往商旅多于土著。山多田少，出纸与柑橘。',
    commerce: 1.1, fishing: 0.5, imperial: 0.02, textile: 0.8, corridor: 1.3, keju: 0.7,
    idx: [58, 64, 74, 74, 64, 50, 40, 54], fisc: [0.75, 0.17],
    notes: '浙闽赣皖交通枢纽。'
  }),
  严州府: block({
    name: '严州府', terrain: '山地', specialResources: '木材·茶·桐油', tags: {},
    description: '新安江峡谷，山多田少，民以林木、茶叶为业，赋役虽轻而生计艰难。',
    commerce: 0.7, fishing: 0.6, imperial: 0.02, textile: 0.8, corridor: 0.9, keju: 0.6, flee: 1.1,
    idx: [58, 62, 66, 66, 64, 48, 35, 52], fisc: [0.76, 0.16],
    notes: '新安江水道。'
  }),
  温州府: block({
    name: '温州府', terrain: '沿海', specialResources: '海鱼·柑橘·漆器', tags: { hasPort: true, fishingRegion: true },
    description: '浙南海滨，瓯江口外岛屿星布，民习商贩，海船往来闽浙之间。山多地少，逋赋与械斗时有所闻。',
    commerce: 1.4, maritime: 0.20, fishing: 2.5, imperial: 0.02, textile: 0.8, corridor: 0.8, keju: 0.8,
    idx: [56, 66, 76, 76, 68, 52, 50, 56], fisc: [0.72, 0.18],
    notes: '瓯江口。'
  }),
  处州府: block({
    name: '处州府', terrain: '山地', specialResources: '木材·青瓷·香菇', tags: {},
    description: '浙西南群山之中，丽水、青田、龙泉诸县出木材与青瓷，山间银坑旧为矿税所扰；户口稀少而山民强悍。',
    commerce: 0.6, fishing: 0.3, imperial: 0.02, textile: 0.6, corridor: 0.7, keju: 0.5, flee: 1.1,
    idx: [58, 62, 60, 60, 68, 46, 40, 52], fisc: [0.76, 0.16],
    notes: '龙泉窑；万历矿税曾扰处州银坑。'
  })
};

const regionMeans = { development: 84, unrest: 63, taxPressure: 55, armyPressure: 43, officeRisk: 56 };

module.exports = { province: '浙江布政使司', UNITS, BLOCKS, regionMeans };
