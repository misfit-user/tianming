// 天启剧本·山东布政使司 6 府 4 州
//
// 《明史·地理志》只记山东全省户口。地图把几个属州单独切成地块：武定州、泰安州出自济南府，
// 济宁州出自兖州府，临清州出自东昌府。本省权重：
//   人口：各块所辖州县数（《明史》卷41：「领州X县Y」合计为州县单位，切出去的属州连同其属县从本府扣除）
//         × 密度系数。运河沿线的临清、济宁城市人口多。
//   税额：民口 × 田赋轻重；田亩：州县数 × 地形系数。
// 盐课分给滨海盐场所在的武定、青州、莱州、登州、济南（滨州一带）；海贸以登莱为主（登莱海运接济东江）。
'use strict';

const { block, unit } = require('./lib-blocks');

const UNITS = [
  unit({ name: '济南府', countyCount: 22, density: 1.4, taxIntensity: 1.0, terrainLand: 1.1, basis: '领州四县二十六共三十个州县单位，扣去武定州（州一县四）、泰安州（州一县二），余二十二。' }),
  unit({ name: '青州府', countyCount: 14, density: 1.3, taxIntensity: 1.0, terrainLand: 1.0, basis: '领州一县十三。' }),
  unit({ name: '兖州府', countyCount: 23, density: 1.4, taxIntensity: 1.0, terrainLand: 1.1, basis: '领州四县二十三共二十七，扣去济宁州（州一县三），余二十三。' }),
  unit({ name: '东昌府', countyCount: 15, density: 1.3, taxIntensity: 1.0, terrainLand: 1.2, basis: '领州三县十五共十八，扣去临清州（州一县二），余十五。' }),
  unit({ name: '莱州府', countyCount: 7, density: 1.1, taxIntensity: 0.9, terrainLand: 1.0, basis: '领州二县五。' }),
  unit({ name: '登州府', countyCount: 8, density: 1.0, taxIntensity: 0.8, terrainLand: 0.8, basis: '领州一县七；半岛之端。' }),
  unit({ name: '武定州', countyCount: 5, density: 1.2, taxIntensity: 0.9, terrainLand: 1.2, basis: '济南府属州，领县四；滨海斥卤。' }),
  unit({ name: '泰安州', countyCount: 3, density: 1.1, taxIntensity: 0.9, terrainLand: 0.8, basis: '济南府属州，领县二；泰山在境。' }),
  unit({ name: '济宁州', countyCount: 4, density: 1.8, taxIntensity: 1.0, terrainLand: 1.1, basis: '兖州府属州，领县三；运河中枢，城市人口多。' }),
  unit({ name: '临清州', countyCount: 3, density: 2.0, taxIntensity: 1.0, terrainLand: 1.1, basis: '东昌府属州，领县二；运河大码头，城市人口多。' })
];

const BLOCKS = {
  济南府: block({
    name: '济南府', terrain: '平原', specialResources: '麦·棉·海盐', tags: { saltRegion: true, fishingRegion: true },
    description: '山东省会，泉城湖光与千佛山相映，布政、按察诸司俱在；德州扼运河北端，滨州一带滨海盐场相连。',
    commerce: 1.3, salt: 0.10, fishing: 0.8, corridor: 1.2, keju: 2.0,
    idx: [46, 66, 64, 64, 62, 42, 32, 56], fisc: [0.72, 0.18],
    notes: '济南府仍辖德州、滨州二属州。'
  }),
  青州府: block({
    name: '青州府', terrain: '丘陵', specialResources: '海盐·丝·果品', tags: { hasPort: true, saltRegion: true, fishingRegion: true },
    description: '鲁中重镇，衡王封藩于此；益都、临朐山地与寿光、乐安滨海平原兼有，官台诸场产盐。',
    commerce: 1.1, maritime: 0.10, salt: 0.25, fishing: 1.5, corridor: 1.1, keju: 1.5,
    idx: [44, 64, 56, 56, 66, 42, 32, 54], fisc: [0.72, 0.17],
    notes: '衡王府。'
  }),
  兖州府: block({
    name: '兖州府', terrain: '平原', specialResources: '麦·棉·枣', tags: { fishingRegion: true },
    description: '鲁王封于兖州，曲阜孔府衍圣公世袭于此。五年前徐鸿儒以白莲教起事于郓城、邹、滕，官军平之，余党潜伏乡间未尽。',
    commerce: 1.0, fishing: 1.0, corridor: 1.2, keju: 1.8,
    idx: [40, 66, 56, 56, 74, 44, 36, 56], fisc: [0.70, 0.18],
    notes: '鲁王府；曲阜衍圣公；天启二年徐鸿儒起事。'
  }),
  东昌府: block({
    name: '东昌府', terrain: '平原', specialResources: '麦·棉·运河漕运', tags: {},
    description: '运河纵贯，聊城为府治；高唐、濮州一带平原务农，民风质朴而多盗。',
    commerce: 1.0, fishing: 0.5, corridor: 1.3, keju: 1.2,
    idx: [44, 64, 54, 54, 68, 42, 30, 54], fisc: [0.72, 0.17],
    notes: '临清州已单独成块。'
  }),
  莱州府: block({
    name: '莱州府', terrain: '丘陵', specialResources: '海盐·海鱼·滑石', tags: { hasPort: true, saltRegion: true, fishingRegion: true },
    description: '胶东半岛西部，掖县为府治，胶州湾口海舟可通淮扬；沿海盐场与鱼盐之利。',
    commerce: 1.0, maritime: 0.35, salt: 0.25, fishing: 2.5, corridor: 1.0, keju: 1.0,
    idx: [46, 62, 54, 54, 64, 40, 34, 52], fisc: [0.74, 0.17],
    notes: '胶州湾。'
  }),
  登州府: block({
    name: '登州府', terrain: '沿海', specialResources: '海鱼·海盐·海运', tags: { hasPort: true, saltRegion: true, fishingRegion: true },
    description: '半岛之端，登州水城是渡海北援辽东的门户，东江毛文龙部的粮饷由此海运皮岛；登莱巡抚驻此，兵差转输之苦日重。',
    commerce: 1.1, maritime: 0.40, salt: 0.10, fishing: 2.5, corridor: 1.0, keju: 1.0,
    idx: [42, 68, 50, 50, 68, 44, 60, 56], fisc: [0.70, 0.19],
    notes: '登莱巡抚（天启元年设）；登莱海运接济东江。'
  }),
  武定州: block({
    name: '武定州', terrain: '平原', divisionType: '州', officialPosition: '知州', specialResources: '海盐·棉·枣', tags: { hasPort: true, saltRegion: true, fishingRegion: true },
    description: '鲁北滨海，武定、阳信、海丰、乐陵、商河诸县地多斥卤，沿海盐场相望，民以煮盐为业。',
    commerce: 0.8, maritime: 0.15, salt: 0.30, fishing: 1.5, corridor: 1.0, keju: 0.6,
    idx: [44, 64, 46, 46, 66, 40, 28, 52], fisc: [0.73, 0.17],
    notes: '济南府属州。'
  }),
  泰安州: block({
    name: '泰安州', terrain: '山地', divisionType: '州', officialPosition: '知州', specialResources: '香税·铁·果品', tags: {},
    description: '泰山在境，东岳庙会香客四时不绝，碧霞元君香税是地方一大财源；莱芜、新泰山地出铁。',
    commerce: 1.0, fishing: 0.3, corridor: 1.0, keju: 0.6,
    idx: [46, 66, 52, 52, 64, 40, 28, 54], fisc: [0.73, 0.18],
    notes: '济南府属州；泰山香税。'
  }),
  济宁州: block({
    name: '济宁州', terrain: '平原', divisionType: '州', officialPosition: '知州', specialResources: '运河漕运·鱼·皮毛', tags: { fishingRegion: true },
    description: '运河中枢，总理河道驻节于此，南旺分水枢纽调度漕船；南阳、微山诸湖有渔苇之利。',
    commerce: 2.2, fishing: 1.2, corridor: 1.5, keju: 1.0,
    idx: [44, 68, 64, 64, 66, 44, 36, 58], fisc: [0.71, 0.19],
    notes: '兖州府属州；河道总督驻济宁。'
  }),
  临清州: block({
    name: '临清州', terrain: '平原', divisionType: '州', officialPosition: '知州', specialResources: '运河商货·贡砖', tags: {},
    description: '运河上最繁盛的码头，临清钞关岁征商税冠于天下诸关；城中贾客云集，砖窑为京师烧造城砖。',
    commerce: 3.0, fishing: 0.5, corridor: 1.5, keju: 0.8,
    idx: [44, 70, 70, 70, 64, 46, 36, 60], fisc: [0.70, 0.20],
    notes: '东昌府属州；临清钞关；万历二十七年民变逐税监马堂。'
  })
};

const regionMeans = { development: 56, unrest: 67, taxPressure: 41, armyPressure: 35, officeRisk: 54 };

module.exports = { province: '山东布政使司', UNITS, BLOCKS, regionMeans };
