// 天启剧本·江西布政使司 13 府
//
// 《明史·地理志》只记江西全省户口。本省权重：
//   人口：各府领州县数（《明史》卷43；南昌府领州一县七、南康府领县四，解析漏项按原文补）× 密度系数。
//         赣中北鄱阳湖、赣江平原稠密，赣南山区稀疏。
//   税额：民口 × 田赋轻重。南昌、瑞州、袁州三府官田多、赋额重；赣南偏轻。
//   田亩：领州县数 × 地形系数。
// 江西省的渔课总数为 0（剧本原值），故各府渔课为 0，鄱阳湖、长江沿岸各府只在标签上标出渔业。
'use strict';

const { block, unit } = require('./lib-blocks');

const UNITS = [
  unit({ name: '南昌府', countyCount: 8, density: 1.8, taxIntensity: 1.2, terrainLand: 1.2, basis: '领州一县七（宁州）；省会，鄱阳湖南岸平原；三重赋府之一。' }),
  unit({ name: '瑞州府', countyCount: 3, density: 1.4, taxIntensity: 1.3, terrainLand: 1.0, basis: '领县三；锦江流域，三重赋府之一。' }),
  unit({ name: '袁州府', countyCount: 4, density: 1.2, taxIntensity: 1.3, terrainLand: 0.9, basis: '领县四；赣西门户，三重赋府之一。' }),
  unit({ name: '临江府', countyCount: 4, density: 1.5, taxIntensity: 1.1, terrainLand: 1.1, basis: '领县四；赣江中游。' }),
  unit({ name: '吉安府', countyCount: 9, density: 1.6, taxIntensity: 1.1, terrainLand: 1.0, basis: '领县九；吉泰盆地，人稠文盛。' }),
  unit({ name: '抚州府', countyCount: 6, density: 1.4, taxIntensity: 1.0, terrainLand: 1.0, basis: '领县六；抚河流域。' }),
  unit({ name: '建昌府', countyCount: 5, density: 1.1, taxIntensity: 0.9, terrainLand: 0.9, basis: '领县五；旴江流域，益藩所在。' }),
  unit({ name: '广信府', countyCount: 7, density: 1.1, taxIntensity: 0.9, terrainLand: 0.8, basis: '领县七；浙赣孔道，多山。' }),
  unit({ name: '饶州府', countyCount: 7, density: 1.6, taxIntensity: 1.0, terrainLand: 1.0, basis: '领县七；鄱阳湖东岸，景德镇在浮梁。' }),
  unit({ name: '南康府', countyCount: 4, density: 1.0, taxIntensity: 0.9, terrainLand: 0.9, basis: '领县四（《明史》原文作「南唐府」，系误字）；庐山之阳，湖荡多。' }),
  unit({ name: '九江府', countyCount: 5, density: 1.0, taxIntensity: 0.9, terrainLand: 0.9, basis: '领县五；江湖交汇。' }),
  unit({ name: '南安府', countyCount: 4, density: 0.7, taxIntensity: 0.7, terrainLand: 0.6, basis: '领县四；大庾岭山区。' }),
  unit({ name: '赣州府', countyCount: 12, density: 0.8, taxIntensity: 0.7, terrainLand: 0.7, basis: '领县十二；赣南山区，客民杂处。' })
];

const BLOCKS = {
  南昌府: block({
    name: '南昌府', terrain: '平原', specialResources: '稻米·纸·瓷器转贩', tags: { fishingRegion: true },
    description: '江西省会，鄱阳湖南岸平原沃衍，赣江舟楫汇聚于此。宁王宸濠之乱已逾百年，宗藩旧府余迹犹存；城中商贾以米、纸、瓷转贩四方。',
    commerce: 1.6, corridor: 1.3, keju: 2.2, mineral: 0, gentry: 1.2,
    idx: [52, 66, 78, 78, 62, 44, 32, 54], fisc: [0.72, 0.18],
    notes: '江西三重赋府之一（南昌、瑞州、袁州）。'
  }),
  瑞州府: block({
    name: '瑞州府', terrain: '丘陵', specialResources: '稻米·夏布', tags: {},
    description: '锦江流域，高安、上高诸县田土肥沃而赋额素重；民间织夏布为业，读书人亦多。',
    commerce: 1.0, corridor: 1.0, keju: 1.0, mineral: 0.05,
    idx: [52, 60, 66, 66, 64, 46, 26, 50], fisc: [0.72, 0.17],
    notes: '三重赋府之一。'
  }),
  袁州府: block({
    name: '袁州府', terrain: '丘陵', specialResources: '夏布·煤·稻米', tags: {},
    description: '赣西门户，宜春、萍乡与湖广接壤，湘赣商道由此而过。袁州赋重，与瑞州、南昌并称江西三重赋之府；萍乡山中产煤。',
    commerce: 1.0, corridor: 1.1, keju: 0.9, mineral: 0,
    idx: [50, 62, 62, 62, 66, 48, 28, 50], fisc: [0.70, 0.17],
    notes: '三重赋府之一；湘赣通道。'
  }),
  临江府: block({
    name: '临江府', terrain: '平原', specialResources: '药材·稻米', tags: {},
    description: '赣江中游，樟树镇药材集散甲于江南，清江、新淦诸县舟车辐辏。',
    commerce: 1.5, corridor: 1.2, keju: 1.2,
    idx: [54, 60, 72, 72, 62, 42, 26, 50], fisc: [0.76, 0.16],
    notes: '樟树药市。'
  }),
  吉安府: block({
    name: '吉安府', terrain: '盆地', specialResources: '稻米·纸·书籍', tags: {},
    description: '庐陵故地，文章节义之乡，解元、进士之盛冠于江西；吉水、泰和、安福诸县书院林立，而地狭人稠，民多外出为商。',
    commerce: 1.2, corridor: 1.2, keju: 3.0, mineral: 0.05, gentry: 1.1,
    idx: [54, 60, 74, 74, 62, 42, 26, 50], fisc: [0.76, 0.16],
    notes: '江西科第之首。'
  }),
  抚州府: block({
    name: '抚州府', terrain: '丘陵', specialResources: '稻米·纸·夏布', tags: {},
    description: '临川才子之乡，汤显祖谢世十余年，所作《牡丹亭》已传遍大江南北；抚河流域田土平衍。',
    commerce: 1.1, corridor: 1.0, keju: 2.0,
    idx: [54, 60, 70, 70, 64, 42, 26, 50], fisc: [0.76, 0.16],
    notes: '汤显祖卒于万历四十四年。'
  }),
  建昌府: block({
    name: '建昌府', terrain: '丘陵', specialResources: '药材·纸·稻米', tags: {},
    description: '旴江流域，府治南城为益王封藩之地。地接闽中，药材与纸张转贩闽粤，藩府庄田侵占民业，乡里多有怨言。',
    commerce: 1.0, corridor: 1.0, keju: 1.0, mineral: 0.05, gentry: 1.1,
    idx: [54, 62, 64, 64, 64, 40, 26, 50], fisc: [0.75, 0.17],
    notes: '益王府在南城。'
  }),
  广信府: block({
    name: '广信府', terrain: '丘陵', specialResources: '纸·茶·铜铅', tags: { mineralRegion: true },
    description: '浙赣孔道，玉山、上饶一线商旅不绝；铅山河口镇为纸、茶大市，铜铅矿徒聚散无常。',
    commerce: 1.3, corridor: 1.2, keju: 1.2, mineral: 0.35, kuangchang: 1,
    idx: [52, 62, 66, 66, 68, 40, 30, 52], fisc: [0.74, 0.17],
    notes: '铅山铜铅矿；河口镇纸茶市。'
  }),
  饶州府: block({
    name: '饶州府', terrain: '平原', specialResources: '瓷器·铜·稻米', tags: { mineralRegion: true, fishingRegion: true },
    description: '鄱阳湖东岸，浮梁景德镇御器厂烧造官瓷，窑火昼夜不息，窑工数以万计；德兴出铜，矿徒与窑工皆难约束。',
    commerce: 1.8, corridor: 1.0, keju: 1.5, mineral: 0.35, kuangchang: 1, yuyao: 1,
    idx: [50, 66, 74, 74, 68, 44, 28, 54], fisc: [0.72, 0.18],
    notes: '景德镇御器厂（御窑）；德兴铜矿。'
  }),
  南康府: block({
    name: '南康府', terrain: '丘陵', specialResources: '鱼·茶·竹木', tags: { fishingRegion: true },
    description: '庐山之阳，星子、都昌滨临鄱阳湖，白鹿洞书院在焉。地狭而多湖荡，渔樵为业。',
    commerce: 0.9, corridor: 1.0, keju: 0.7,
    idx: [54, 60, 60, 60, 64, 40, 28, 50], fisc: [0.76, 0.16],
    notes: '白鹿洞书院。'
  }),
  九江府: block({
    name: '九江府', terrain: '平原', specialResources: '茶·鱼·长江商货', tags: { fishingRegion: true },
    description: '长江与鄱阳湖交汇的咽喉，九江钞关商船辐辏；湖口、彭泽为江防要地。',
    commerce: 1.6, corridor: 1.3, keju: 0.8,
    idx: [52, 64, 68, 68, 64, 40, 34, 52], fisc: [0.74, 0.18],
    notes: '九江钞关。'
  }),
  南安府: block({
    name: '南安府', terrain: '山地', specialResources: '木材·广货转运', tags: {},
    description: '赣南极南，大庾岭梅关是广货北上的孔道，岭南商货经此入赣江；山多田少，客民杂处。',
    commerce: 1.2, corridor: 1.4, keju: 0.5,
    idx: [50, 62, 54, 54, 70, 38, 36, 52], fisc: [0.74, 0.17],
    notes: '梅关古道。'
  }),
  赣州府: block({
    name: '赣州府', terrain: '山地', specialResources: '木材·银·赣关商税', tags: { mineralRegion: true },
    description: '赣南重镇，南赣巡抚驻节于此，统辖四省交界山区；十二县山深林密，流民与盗贼时起，赣关抽分过往商税。',
    commerce: 1.3, corridor: 1.4, keju: 0.9, mineral: 0.15, flee: 1.2,
    idx: [48, 64, 58, 58, 72, 38, 40, 54], fisc: [0.72, 0.18],
    notes: '南赣巡抚驻地；赣关。'
  })
};

const regionMeans = { development: 68, unrest: 66, taxPressure: 41, armyPressure: 30, officeRisk: 51 };

module.exports = { province: '江西布政使司', UNITS, BLOCKS, regionMeans };
