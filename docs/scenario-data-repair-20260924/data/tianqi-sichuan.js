// 天启剧本·四川布政使司 11 块（7 府、4 州）
//
// 《明史·地理志》只记四川全省户口。地图只画了 11 块，其余政区按治所坐标落块（核过）：
//   潼川、邛州两直隶州落在成都块；夔州府属达州落在保宁块；重庆府属忠州落在夔州块；
//   遵义府与石柱、酉阳两宣抚司落在重庆块；马湖府与东川、乌蒙、乌撒、镇雄四军民府落在叙州块；
//   永宁宣抚司落在泸州块；四川行都司（建昌诸卫）落在嘉定块；天全六番招讨司落在雅州块；松潘卫落在龙安块。
// 本省权重：
//   人口：州县单位数（《明史》卷43，属州连同属县随所在块）× 密度 × 每县口数，另加松潘、建昌与成都、重庆驻军估数。
//   税额：民口 × 田赋轻重，土司与驻军从轻；田亩：州县数 × 地形系数。
// 盐课按蜀中盐井分布：富顺（叙州）、犍为（嘉定）、大宁与云阳（夔州）、射洪与蓬溪（潼川，在成都块）、南部与西充（顺庆）、阆中（保宁）。
'use strict';

const { block, unit } = require('./lib-blocks');

// 每县口数：省总人口 340 万，驻军估数共 18 万，加权县数约 142.6，(340−18)÷142.6 ≈ 2.26 万
const PER_COUNTY = 22600;
const u = (fields) => unit(Object.assign({ perCounty: PER_COUNTY }, fields));

const UNITS = [
  u({ name: '成都府', countyCount: 31, density: 1.4, taxIntensity: 1.1, terrainLand: 1.3, militaryMouths: 30000, basis: '领州六县二十五（简、崇庆、汉、绵、茂、威）；成都平原；成都诸卫与蜀藩约 3 万口。' }),
  u({ name: '潼川州', block: '成都府', countyCount: 8, density: 1.0, taxIntensity: 1.0, terrainLand: 1.0, basis: '直隶州，领县七；州治落在成都块。' }),
  u({ name: '邛州', block: '成都府', countyCount: 3, density: 1.1, taxIntensity: 1.0, terrainLand: 1.0, basis: '直隶州，领县二；州治落在成都块。' }),
  u({ name: '保宁府', countyCount: 10, density: 0.9, taxIntensity: 0.9, terrainLand: 0.8, basis: '领州二县八（剑州、巴州）。' }),
  u({ name: '达州', block: '保宁府', countyCount: 3, density: 0.8, taxIntensity: 0.8, terrainLand: 0.7, basis: '夔州府属州，领县二；州治落在保宁块。' }),
  u({ name: '顺庆府', countyCount: 10, density: 1.1, taxIntensity: 1.0, terrainLand: 1.0, basis: '领州二县八（蓬州、广安）。' }),
  u({ name: '夔州府', countyCount: 10, density: 0.7, taxIntensity: 0.8, terrainLand: 0.6, basis: '领州一县十二共十三，扣去达州（州一县二）。' }),
  u({ name: '忠州', block: '夔州府', countyCount: 3, density: 0.9, taxIntensity: 0.9, terrainLand: 0.8, basis: '重庆府属州，领县二；州治落在夔州块。' }),
  u({ name: '重庆府', countyCount: 17, density: 1.1, taxIntensity: 1.0, terrainLand: 0.9, militaryMouths: 20000, basis: '领州三县十七共二十，扣去忠州（州一县二）；重庆卫与援黔客兵约 2 万口。' }),
  u({ name: '遵义府', block: '重庆府', countyCount: 5, density: 0.6, taxIntensity: 0.6, terrainLand: 0.6, basis: '军民府，领州一县四；播州杨氏平后所设，府治落在重庆块。' }),
  u({ name: '石柱酉阳', block: '重庆府', countyCount: 2, density: 0.4, taxIntensity: 0.2, terrainLand: 0.3, basis: '石柱、酉阳二宣抚司，土司贡赋轻；治所落在重庆块。' }),
  u({ name: '叙州府', countyCount: 10, density: 0.9, taxIntensity: 0.9, terrainLand: 0.8, militaryMouths: 10000, basis: '领州一县九；叙南卫约 1 万口。' }),
  u({ name: '马湖府', block: '叙州府', countyCount: 2, density: 0.5, taxIntensity: 0.4, terrainLand: 0.4, basis: '领县一与长官司四；府治落在叙州块。' }),
  u({ name: '东川乌蒙乌撒镇雄', block: '叙州府', countyCount: 4, density: 0.4, taxIntensity: 0.2, terrainLand: 0.3, basis: '四军民府，土官世袭，隶四川布政司；治所都落在叙州块。' }),
  u({ name: '泸州', countyCount: 4, density: 1.0, taxIntensity: 1.0, terrainLand: 0.9, basis: '直隶州，领县三。' }),
  u({ name: '永宁宣抚司', block: '泸州', countyCount: 1, density: 0.4, taxIntensity: 0.3, terrainLand: 0.3, basis: '奢氏故地，天启三年官军收复；治所落在泸州块。' }),
  u({ name: '眉州', countyCount: 4, density: 1.2, taxIntensity: 1.1, terrainLand: 1.1, basis: '直隶州，领县三。' }),
  u({ name: '嘉定州', countyCount: 7, density: 1.0, taxIntensity: 1.0, terrainLand: 0.9, basis: '直隶州，领县六。' }),
  u({ name: '四川行都司', block: '嘉定州', countyCount: 3, density: 0.2, taxIntensity: 0.3, terrainLand: 0.4, militaryMouths: 80000, basis: '建昌、宁番、越嶲、盐井、会川五卫与诸所，屯军连同家口约 8 万口；卫城落在嘉定块，驿站按三县计。' }),
  u({ name: '雅州', countyCount: 4, density: 0.7, taxIntensity: 0.8, terrainLand: 0.6, basis: '直隶州，领县三。' }),
  u({ name: '天全六番', block: '雅州', countyCount: 1, density: 0.4, taxIntensity: 0.2, terrainLand: 0.3, basis: '天全六番招讨司，土司；治所落在雅州块。' }),
  u({ name: '龙安府', countyCount: 3, density: 0.5, taxIntensity: 0.6, terrainLand: 0.5, basis: '领县三。' }),
  u({ name: '松潘卫', block: '龙安府', countyCount: 1, density: 0.2, taxIntensity: 0.2, terrainLand: 0.2, militaryMouths: 40000, basis: '松潘镇兵与卫所军户连同家口约 4 万口；卫城落在龙安块。' })
];

const BLOCKS = {
  成都府: block({
    name: '成都府', terrain: '平原', specialResources: '稻米·蜀锦·茶', tags: { mineralRegion: true, saltRegion: true },
    description: '蜀中首府，蜀王封藩于此，都江堰灌溉成都平原，稻田连陌，蜀锦名闻天下。天启元年奢崇明叛兵围城百余日，城中至今心有余悸；西北茂州、威州羌番杂处；潼川州的盐井与邛州的铁冶也归此统摄。',
    commerce: 1.8, fishing: 0, salt: 0.15, mineral: 0.2, corridor: 1.4, keju: 3.0,
    idx: [50, 60, 70, 70, 60, 44, 32, 50], fisc: [0.74, 0.17],
    notes: '蜀王府；天启元年成都被围一百零二日；潼川、邛州两直隶州并入本块。'
  }),
  保宁府: block({
    name: '保宁府', terrain: '丘陵', specialResources: '丝·茶·药材', tags: { saltRegion: true },
    description: '阆中为川北重镇，北倚剑门天险，扼秦蜀栈道；巴州、达州深入大巴山区，山民种茶采药。',
    commerce: 1.0, fishing: 0, salt: 0.05, corridor: 1.3, keju: 1.0,
    idx: [48, 56, 52, 52, 66, 40, 28, 48], fisc: [0.74, 0.17],
    notes: '剑门关；夔州府属达州并入本块。'
  }),
  顺庆府: block({
    name: '顺庆府', terrain: '丘陵', specialResources: '丝·稻米·井盐', tags: { saltRegion: true },
    description: '嘉陵江中游，南充、蓬州、广安一带丘陵起伏，户口稠密，蚕桑与井盐兼营。',
    commerce: 1.1, fishing: 0, salt: 0.1, corridor: 1.0, keju: 1.2,
    idx: [50, 56, 58, 58, 64, 42, 24, 48], fisc: [0.75, 0.16],
    notes: '南部、西充盐井。'
  }),
  夔州府: block({
    name: '夔州府', terrain: '山地', specialResources: '井盐·柑橘·桐油', tags: { saltRegion: true },
    description: '瞿塘峡口，夔门天下雄，川江舟楫出入必经；大宁、云阳盐泉煮盐，东销荆楚。西面忠州一带也入其境。',
    commerce: 1.2, fishing: 0, salt: 0.2, corridor: 1.2, keju: 0.6,
    idx: [46, 58, 46, 46, 68, 38, 28, 48], fisc: [0.74, 0.17],
    notes: '大宁盐场；重庆府属忠州并入本块。'
  }),
  重庆府: block({
    name: '重庆府', terrain: '丘陵', specialResources: '商货·稻米·桐油', tags: { mineralRegion: true },
    description: '长江与嘉陵江交汇处的山城，川东水陆码头。天启元年奢崇明部将据城杀巡抚徐可求，次年官军收复；南面遵义府是二十余年前平定的播州杨氏故地，东境石柱宣抚使秦良玉的白杆兵以善战闻名。',
    commerce: 1.6, fishing: 0, mineral: 0.1, corridor: 1.3, keju: 1.2, flee: 1.3,
    idx: [44, 58, 56, 56, 72, 42, 40, 50], fisc: [0.72, 0.18],
    notes: '天启元年九月重庆陷，二年五月收复；遵义府、石柱与酉阳宣抚司并入本块。'
  }),
  叙州府: block({
    name: '叙州府', terrain: '山地', specialResources: '井盐·铜·荔枝', tags: { saltRegion: true, mineralRegion: true },
    description: '岷江与金沙江在宜宾汇为长江，富顺自流井为蜀中盐井之冠。南面马湖府与东川、乌蒙、乌撒、镇雄四军民府，土官世袭，部民依山而居，东川、乌蒙出铜。',
    commerce: 1.2, fishing: 0, salt: 0.25, mineral: 0.25, corridor: 1.1, keju: 0.8,
    idx: [46, 58, 52, 52, 70, 40, 34, 50], fisc: [0.73, 0.17],
    notes: '富顺自流井；马湖府与四军民府并入本块。'
  }),
  泸州: block({
    name: '泸州', terrain: '丘陵', divisionType: '州', officialPosition: '知州', specialResources: '酒·稻米·桐油', tags: {},
    description: '沱江入长江处，泸州为川南水路要冲，酿酒之业兴盛。南面永宁宣抚司即奢崇明故地，天启三年官军收复，奢氏遁入水西与安邦彦合兵，战事至今未平，泸州首当其冲。',
    commerce: 1.3, fishing: 0, corridor: 1.2, keju: 0.6, flee: 1.3,
    idx: [42, 58, 52, 52, 74, 42, 40, 50], fisc: [0.72, 0.18],
    notes: '直隶州；永宁宣抚司并入本块。'
  }),
  眉州: block({
    name: '眉州', terrain: '平原', divisionType: '州', officialPosition: '知州', specialResources: '稻米·蚕丝·药材', tags: {},
    description: '岷江之畔的平原小州，三苏故里，稻田蚕桑，文风素盛。',
    commerce: 1.0, fishing: 0, corridor: 1.0, keju: 0.8,
    idx: [52, 56, 62, 62, 60, 44, 22, 46], fisc: [0.76, 0.16],
    notes: '直隶州。'
  }),
  嘉定州: block({
    name: '嘉定州', terrain: '山地', divisionType: '州', officialPosition: '知州', specialResources: '井盐·铜·茶', tags: { saltRegion: true, mineralRegion: true },
    description: '岷江、大渡河、青衣江三水汇流，凌云山大佛临江，峨眉山在其西；犍为盐井与峨眉茶为一方之利。西南建昌诸卫为四川行都司所辖，屯军守大凉山，会川一带产铜。',
    commerce: 1.1, fishing: 0, salt: 0.25, mineral: 0.35, kuangchang: 1, corridor: 1.2, keju: 0.6,
    idx: [48, 58, 54, 54, 68, 40, 32, 50], fisc: [0.74, 0.17],
    notes: '直隶州；四川行都司并入本块；矿厂给会川铜。'
  }),
  雅州: block({
    name: '雅州', terrain: '山地', divisionType: '州', officialPosition: '知州', specialResources: '边茶·药材·木材', tags: { mineralRegion: true },
    description: '青衣江上游，汉番交界，雅州边茶经碉门、黎州运往朵甘与乌思藏；天全六番招讨司土兵戍守西境。',
    commerce: 1.1, fishing: 0, mineral: 0.1, corridor: 1.1, keju: 0.3,
    idx: [48, 58, 46, 46, 66, 38, 30, 48], fisc: [0.74, 0.17],
    notes: '直隶州；碉门茶马；天全六番招讨司并入本块。'
  }),
  龙安府: block({
    name: '龙安府', terrain: '山林', specialResources: '木材·药材·麝香', tags: {},
    description: '涪江上游的山地小府，北接松潘卫。松潘为川西北屏障，镇兵防守诸番部落，以茶易马。',
    commerce: 0.7, fishing: 0, corridor: 1.0, keju: 0.3,
    idx: [46, 58, 40, 40, 68, 36, 40, 50], fisc: [0.74, 0.17],
    notes: '嘉靖四十五年升龙州为龙安府；松潘卫并入本块。'
  })
};

const regionMeans = { development: 58, unrest: 67, taxPressure: 41, armyPressure: 30, officeRisk: 49 };

module.exports = { province: '四川布政使司', UNITS, BLOCKS, regionMeans };
