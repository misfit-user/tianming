// 天启剧本·北直隶 11 个地块的重写数据
//
// 北直隶在《明史·地理志》卷40 只有万历六年的分府户口（洪武时北平是布政司，只记全省），
// 《大明会典》《诸司职掌》的洪武税粮、田土也只记北平布政司总数。所以本省权重这样定：
//   人口：万历六年民籍口数（《明史》卷40），加上不入民籍的军籍人口估数——京营与京卫（顺天）、
//         蓟镇（顺天东部与永平）、居庸诸卫（延庆）、保安卫、宣府镇、天津三卫（河间）。军籍估数是按
//         明末各镇兵额连同家口的约数，写在各府州的 basis 里。
//   户数：万历册籍的口户比在北直隶是 7～15，明显失真，户数按全省口户比均摊。
//   税额：民口乘以田赋轻重（京畿优免与勋戚庄田多的顺天偏轻，边地偏轻），军籍人口只按一成计（屯粮另账）。
//   田亩：各府领州县数（《明史》卷40）乘以地形系数；宣府镇按屯田计。
// 省总数（人口 820 万等）一律不动，只改分配。
'use strict';

// 领州县数与万历六年民籍户口：《明史·地理志》卷40（见 ../sources/mingshi-dili-40-46.json）
const UNITS = [
  { name: '顺天府', countyCount: 27, wanliMouths: 706861, militaryMouths: 600000, taxIntensity: 0.7, terrainLand: 0.9,
    basis: '民籍 706861 口（万历六年）；京营、京卫军户与匠户、内廷及流寓约 60 万口不入民籍；京畿优免多、勋戚庄田侵占，田赋按七成计。' },
  { name: '保定府', countyCount: 20, wanliMouths: 525083, militaryMouths: 50000, taxIntensity: 1.0, terrainLand: 1.0,
    basis: '民籍 525083 口；紫荆关、保定诸卫军户约 5 万口。' },
  { name: '河间府', countyCount: 18, wanliMouths: 419152, militaryMouths: 80000, taxIntensity: 1.0, terrainLand: 1.1,
    basis: '民籍 419152 口；天津三卫与沧州诸所军户约 8 万口（天津卫直隶后军都督府，地在府境）。' },
  { name: '真定府', countyCount: 32, wanliMouths: 1093531, militaryMouths: 30000, taxIntensity: 1.0, terrainLand: 1.0,
    basis: '民籍 1093531 口，北直隶口数最多的府；真定、神武诸卫军户约 3 万口。' },
  { name: '顺德府', countyCount: 9, wanliMouths: 281957, militaryMouths: 0, taxIntensity: 0.9, terrainLand: 1.0,
    basis: '民籍 281957 口；西部太行山地，田赋略轻。' },
  { name: '广平府', countyCount: 9, wanliMouths: 264898, militaryMouths: 0, taxIntensity: 1.0, terrainLand: 1.1,
    basis: '民籍 264898 口；滏阳河平原。' },
  { name: '大名府', countyCount: 11, wanliMouths: 692058, militaryMouths: 0, taxIntensity: 1.1, terrainLand: 1.2,
    basis: '民籍 692058 口；卫河平原，地饶户众。' },
  { name: '永平府', countyCount: 6, wanliMouths: 255646, militaryMouths: 120000, taxIntensity: 0.8, terrainLand: 0.9,
    basis: '民籍 255646 口；山海关与蓟镇东路驻军连同家口约 12 万口；边地，田赋按八成计。' },
  { name: '延庆州', countyCount: 2, wanliMouths: 19267, militaryMouths: 60000, taxIntensity: 0.6, terrainLand: 0.5,
    basis: '民籍 19267 口；延庆、永宁、怀来、隆庆诸卫与居庸关守军连同家口约 6 万口，军户多于民户。' },
  { name: '保安州', countyCount: 1, wanliMouths: 6445, militaryMouths: 20000, taxIntensity: 0.6, terrainLand: 0.5,
    basis: '民籍 6445 口；保安卫、美峪所军户约 2 万口。' },
  { name: '宣府镇', countyCount: 8, wanliMouths: 0, militaryMouths: 450000, taxIntensity: 0, terrainLand: 0, landOverride: 5,
    basis: '九边军镇，无民籍；驿站按驿路军堡折合 8 个县计；嘉靖定额官军十五万余，天启时实额约十万，连同家口与堡寨民户估 45 万口；田亩按屯田计（折合五个县的权重），税粮只计屯粮一成。' }
].map((u) => {
  const pop = u.wanliMouths + u.militaryMouths;
  return Object.assign(u, {
    weights: {
      pop,
      households: pop,
      grain: u.wanliMouths * u.taxIntensity + u.militaryMouths * 0.1,
      land: u.landOverride != null ? u.landOverride : u.countyCount * u.terrainLand
    }
  });
});

const BLOCKS = {
  'ming-01-p01': {
    name: '顺天府', divisionType: '府', officialPosition: '顺天府尹', terrain: '平原',
    specialResources: '漕运·煤·京师百货', taxLevel: '中', regionType: 'normal',
    tags: { hasPort: false, saltRegion: true, mineralRegion: true, horseRegion: false, fishingRegion: true, imperialDomain: true },
    description: '京师所在，九门之内坊市辐辏，通州为漕运尽头，天下百货由此入京。城外皇庄与勋戚庄田连片，西山产煤；蓟州、遵化以东属蓟镇防区。去年五月王恭厂火药局大爆炸，西南城坊死伤枕藉，人心至今惶惶。',
    commerce: 4.0, urban: { fang: 0.35, shi: 0.10, zhen: 0.12, cun: 0.43 }, maritime: 0.3, fishing: 2.0, salt: 0.15, mineral: 0.6, horse: 0,
    imperial: 0.45, textile: 1.0, zhizao: 1, kuangchang: 1,
    corridor: 1.6, keju: 3.5, gentry: 1.4, hide: 1.3, flee: 1.0, yieldFactor: 1.0, roadQuality: 72, commerceCoefficient: 2.2,
    minxin: 42, corruption: 82, prosperity: 76, development: 80, unrest: 60, taxPressure: 50, armyPressure: 40, officeRisk: 72, compliance: 0.66, skimmingRate: 0.22,
    notes: '京师；西山煤窑与遵化铁冶为本省矿课所出；王恭厂大爆炸在天启六年五月初六。'
  },
  'ming-01-p02': {
    name: '保定府', divisionType: '府', officialPosition: '知府', terrain: '平原',
    specialResources: '麦·棉·白洋淀渔苇', taxLevel: '中', regionType: 'normal',
    tags: { hasPort: false, saltRegion: false, mineralRegion: false, horseRegion: false, fishingRegion: true, imperialDomain: true },
    description: '畿南首府，保定巡抚驻节于此，西有紫荆关控扼太行诸口。平原宜麦棉，东部白洋淀一带水乡有渔苇之利；近畿皇庄侵占民田，佃户多有怨言。',
    commerce: 1.0, urban: { fang: 0.08, shi: 0.06, zhen: 0.14, cun: 0.72 }, maritime: 0, fishing: 1.5, salt: 0, mineral: 0.05, horse: 0,
    imperial: 0.15, textile: 1.0,
    corridor: 1.3, keju: 1.5, gentry: 1.2, hide: 1.1, flee: 1.0, yieldFactor: 1.0, roadQuality: 64, commerceCoefficient: 1.2,
    minxin: 47, corruption: 72, prosperity: 62, development: 62, unrest: 64, taxPressure: 58, armyPressure: 30, officeRisk: 58, compliance: 0.72, skimmingRate: 0.18,
    notes: '保定巡抚驻地；紫荆关。'
  },
  'ming-01-p03': {
    name: '河间府', divisionType: '府', officialPosition: '知府', terrain: '平原',
    specialResources: '长芦盐·漕运·枣', taxLevel: '中', regionType: 'normal',
    tags: { hasPort: true, saltRegion: true, mineralRegion: false, horseRegion: false, fishingRegion: true, imperialDomain: true },
    description: '运河纵贯，长芦都转运盐使司驻沧州，沿海盐场相连；天津三卫扼海河入海之口，漕船与辽东海运在此转输。',
    commerce: 1.5, urban: { fang: 0.07, shi: 0.07, zhen: 0.14, cun: 0.72 }, maritime: 0.5, fishing: 3.0, salt: 0.65, mineral: 0, horse: 0,
    imperial: 0.20, textile: 1.0,
    corridor: 1.2, keju: 1.2, gentry: 1.1, hide: 1.0, flee: 1.1, yieldFactor: 0.95, roadQuality: 62, commerceCoefficient: 1.5,
    minxin: 46, corruption: 74, prosperity: 62, development: 62, unrest: 64, taxPressure: 60, armyPressure: 30, officeRisk: 60, compliance: 0.72, skimmingRate: 0.18,
    notes: '长芦运司在沧州（清代始移天津）；天津三卫。'
  },
  'ming-01-p04': {
    name: '真定府', divisionType: '府', officialPosition: '知府', terrain: '平原',
    specialResources: '麦·棉·井陉煤', taxLevel: '中', regionType: 'normal',
    tags: { hasPort: false, saltRegion: false, mineralRegion: true, horseRegion: false, fishingRegion: false, imperialDomain: false },
    description: '畿南大府，领五州二十七县，滹沱河贯境。西出井陉可通山西，为晋冀要道；冀、深、赵诸州平原沃衍，麦棉之饶甲于北直。',
    commerce: 1.0, urban: { fang: 0.07, shi: 0.06, zhen: 0.13, cun: 0.74 }, maritime: 0, fishing: 0.5, salt: 0, mineral: 0.05, horse: 0,
    imperial: 0.10, textile: 1.2,
    corridor: 1.3, keju: 1.8, gentry: 1.0, hide: 1.0, flee: 1.0, yieldFactor: 1.05, roadQuality: 62, commerceCoefficient: 1.2,
    minxin: 50, corruption: 70, prosperity: 66, development: 66, unrest: 60, taxPressure: 58, armyPressure: 25, officeRisk: 56, compliance: 0.75, skimmingRate: 0.17,
    notes: '北直隶最大的府；井陉煤。'
  },
  'ming-01-p05': {
    name: '大名府', divisionType: '府', officialPosition: '知府', terrain: '平原',
    specialResources: '麦·棉·卫河漕运', taxLevel: '中', regionType: 'normal',
    tags: { hasPort: false, saltRegion: false, mineralRegion: false, horseRegion: false, fishingRegion: true, imperialDomain: false },
    description: '北直最南，与山东、河南三省交界，卫河通漕。地饶户众，然黄河故道多沙碱之地；三省交界处盗警时闻。',
    commerce: 1.2, urban: { fang: 0.07, shi: 0.07, zhen: 0.13, cun: 0.73 }, maritime: 0, fishing: 0.8, salt: 0, mineral: 0, horse: 0,
    imperial: 0.03, textile: 1.1,
    corridor: 1.0, keju: 1.2, gentry: 1.0, hide: 1.0, flee: 1.2, yieldFactor: 1.0, roadQuality: 58, commerceCoefficient: 1.3,
    minxin: 45, corruption: 72, prosperity: 64, development: 64, unrest: 72, taxPressure: 58, armyPressure: 25, officeRisk: 58, compliance: 0.74, skimmingRate: 0.18,
    notes: '三省交界，盗警多。'
  },
  'ming-01-p06': {
    name: '永平府', divisionType: '府', officialPosition: '知府', terrain: '丘陵',
    specialResources: '长芦盐·煤·鱼', taxLevel: '中', regionType: 'normal',
    tags: { hasPort: true, saltRegion: true, mineralRegion: true, horseRegion: false, fishingRegion: true, imperialDomain: false },
    description: '东有山海关为辽东咽喉，关宁军饷与援辽兵马皆由此出；北倚长城，蓟镇东路诸营驻守。沿海滦州、乐亭有长芦盐场，兵差转输之苦甲于畿辅。',
    commerce: 0.8, urban: { fang: 0.06, shi: 0.05, zhen: 0.12, cun: 0.77 }, maritime: 0.2, fishing: 2.0, salt: 0.20, mineral: 0.15, horse: 0,
    imperial: 0.02, textile: 0.6,
    corridor: 1.3, keju: 0.6, gentry: 1.0, hide: 1.0, flee: 1.4, yieldFactor: 0.85, roadQuality: 60, commerceCoefficient: 1.0,
    minxin: 40, corruption: 76, prosperity: 52, development: 55, unrest: 72, taxPressure: 66, armyPressure: 70, officeRisk: 62, compliance: 0.66, skimmingRate: 0.20,
    notes: '山海关；辽饷与兵差负担最重；滦州一带开平煤。'
  },
  'ming-01-p07': {
    name: '顺德府', divisionType: '府', officialPosition: '知府', terrain: '平原',
    specialResources: '麦·棉·煤铁', taxLevel: '中', regionType: 'normal',
    tags: { hasPort: false, saltRegion: false, mineralRegion: false, horseRegion: false, fishingRegion: false, imperialDomain: false },
    description: '太行东麓，府治邢台为古邢国故地。地狭县少，西山产煤铁，东部平原务麦棉。',
    commerce: 0.8, urban: { fang: 0.07, shi: 0.06, zhen: 0.12, cun: 0.75 }, maritime: 0, fishing: 0.3, salt: 0, mineral: 0, horse: 0,
    imperial: 0.02, textile: 1.0,
    corridor: 1.1, keju: 0.6, gentry: 1.0, hide: 1.0, flee: 1.0, yieldFactor: 0.95, roadQuality: 58, commerceCoefficient: 1.0,
    minxin: 49, corruption: 70, prosperity: 58, development: 58, unrest: 62, taxPressure: 55, armyPressure: 20, officeRisk: 55, compliance: 0.74, skimmingRate: 0.17,
    notes: '邢台；西部山区。'
  },
  'ming-01-p08': {
    name: '广平府', divisionType: '府', officialPosition: '知府', terrain: '平原',
    specialResources: '麦·棉·滏阳河漕', taxLevel: '中', regionType: 'normal',
    tags: { hasPort: false, saltRegion: false, mineralRegion: false, horseRegion: false, fishingRegion: true, imperialDomain: false },
    description: '滏阳河流贯，府治永年，古都邯郸在境。北直南部腹地，平原沃野，民风淳朴而赋役颇重。',
    commerce: 0.8, urban: { fang: 0.07, shi: 0.06, zhen: 0.12, cun: 0.75 }, maritime: 0, fishing: 0.5, salt: 0, mineral: 0, horse: 0,
    imperial: 0.02, textile: 1.0,
    corridor: 1.1, keju: 0.8, gentry: 1.0, hide: 1.0, flee: 1.0, yieldFactor: 1.0, roadQuality: 58, commerceCoefficient: 1.0,
    minxin: 49, corruption: 70, prosperity: 60, development: 60, unrest: 62, taxPressure: 58, armyPressure: 20, officeRisk: 55, compliance: 0.74, skimmingRate: 0.17,
    notes: '永年、邯郸。'
  },
  'ming-01-p09': {
    name: '延庆州', divisionType: '州', officialPosition: '知州', terrain: '山地',
    specialResources: '马·皮毛·居庸关商道', taxLevel: '轻', regionType: 'normal',
    tags: { hasPort: false, saltRegion: false, mineralRegion: false, horseRegion: true, fishingRegion: false, imperialDomain: false },
    description: '居庸关外、长城之内的山间盆地，州城东北有永宁卫。京师西北门户，诸陵的外屏；户口稀少，军户多于民户。',
    commerce: 0.5, urban: { fang: 0.10, shi: 0.04, zhen: 0.10, cun: 0.76 }, maritime: 0, fishing: 0.2, salt: 0, mineral: 0, horse: 0.5,
    imperial: 0.005, textile: 0.4,
    corridor: 1.3, keju: 0.1, gentry: 1.0, hide: 0.8, flee: 1.3, yieldFactor: 0.6, roadQuality: 50, commerceCoefficient: 0.8,
    minxin: 45, corruption: 72, prosperity: 42, development: 45, unrest: 66, taxPressure: 45, armyPressure: 60, officeRisk: 58, compliance: 0.70, skimmingRate: 0.18,
    notes: '本名隆庆州，隆庆元年避讳改延庆州；居庸关。'
  },
  'ming-01-p10': {
    name: '保安州', divisionType: '州', officialPosition: '知州', terrain: '山地',
    specialResources: '马·皮毛', taxLevel: '轻', regionType: 'normal',
    tags: { hasPort: false, saltRegion: false, mineralRegion: false, horseRegion: true, fishingRegion: false, imperialDomain: false },
    description: '桑干河谷，东接延庆、西邻宣府，州城小而地瘠，民户寥寥，与保安卫军户杂处。',
    commerce: 0.5, urban: { fang: 0.10, shi: 0.04, zhen: 0.10, cun: 0.76 }, maritime: 0, fishing: 0.2, salt: 0, mineral: 0, horse: 0.5,
    imperial: 0.005, textile: 0.4,
    corridor: 1.0, keju: 0.1, gentry: 1.0, hide: 0.8, flee: 1.3, yieldFactor: 0.6, roadQuality: 45, commerceCoefficient: 0.7,
    minxin: 44, corruption: 72, prosperity: 40, development: 42, unrest: 66, taxPressure: 45, armyPressure: 55, officeRisk: 58, compliance: 0.70, skimmingRate: 0.18,
    notes: '保安卫。'
  },
  'ming-01-p11': {
    name: '宣府镇', divisionType: '镇', officialPosition: '宣府巡抚', terrain: '边塞',
    specialResources: '马市·屯田·煤铁', taxLevel: '轻', regionType: 'normal',
    tags: { hasPort: false, saltRegion: false, mineralRegion: true, horseRegion: true, fishingRegion: false, imperialDomain: false },
    description: '九边之首，宣府镇城与张家口堡相望，北御察哈尔。张家口马市互市不绝；镇兵十余万分驻诸堡，屯田军户多于民户，粮饷仰给京运，欠饷之怨时起。',
    commerce: 1.2, urban: { fang: 0.15, shi: 0.08, zhen: 0.20, cun: 0.57 }, maritime: 0, fishing: 0.2, salt: 0, mineral: 0.15, horse: 3.0,
    imperial: 0.005, textile: 0.4, kuangchang: 1,
    corridor: 1.5, keju: 0.2, gentry: 0.6, hide: 0.8, flee: 1.5, yieldFactor: 0.6, roadQuality: 55, commerceCoefficient: 1.3,
    minxin: 40, corruption: 80, prosperity: 50, development: 52, unrest: 78, taxPressure: 40, armyPressure: 85, officeRisk: 66, compliance: 0.60, skimmingRate: 0.25,
    notes: '宣府镇（九边之一）；张家口马市；地形取引擎的「边塞」，战场按边堡地貌生成。'
  }
};

// 地块读数层改之前 11 块同值
const regionMeans = { development: 62, unrest: 67, taxPressure: 55, armyPressure: 35, officeRisk: 60 };

module.exports = { province: '北直隶', UNITS, BLOCKS, regionMeans };
