// 天启剧本·山西布政使司 9 块（5 府、2 州、2 关）
//
// 《明史·地理志》只记山西全省户口。地图把朔州从大同府切出，另把外三关中的宁武关、偏关单列；
// 沁州、辽州两个直隶州无独立地块，州治落在潞安块（按县治坐标核过）。本省权重：
//   人口：州县单位数（《明史》卷41）× 密度系数，边镇与关城加驻军连同家口的估数。
//   税额：民口 × 田赋轻重，驻军只计一成；田亩：州县数 × 地形系数。
// 河东盐池在解州（平阳府），盐课全归平阳；矿课与矿厂给泽州、潞安、太原、平阳；马政给大同、朔州与二关。
'use strict';

const { block, unit } = require('./lib-blocks');

// 每县口数：省总人口 520 万，驻军估数共 42 万，加权县数约 113.2，(520−42)÷113.2 ≈ 4.2 万
const PER_COUNTY = 42000;

const UNITS = [
  unit({ name: '太原府', perCounty: PER_COUNTY, countyCount: 24, density: 1.2, taxIntensity: 1.0, terrainLand: 1.0, militaryMouths: 30000, basis: '领州五县二十共二十五，扣去地图划入偏关块的河曲；太原诸卫军户约 3 万口。' }),
  unit({ name: '平阳府', perCounty: PER_COUNTY, countyCount: 34, density: 1.3, taxIntensity: 1.0, terrainLand: 1.0, basis: '领州六县二十八；晋南人稠。' }),
  unit({ name: '潞安府', perCounty: PER_COUNTY, countyCount: 8, density: 1.3, taxIntensity: 1.0, terrainLand: 0.9, basis: '领县八；上党。' }),
  unit({ name: '沁州', perCounty: PER_COUNTY, block: '潞安府', countyCount: 3, density: 0.9, taxIntensity: 0.9, terrainLand: 0.8, basis: '直隶州，领县二；州治落在潞安块。' }),
  unit({ name: '辽州', perCounty: PER_COUNTY, block: '潞安府', countyCount: 3, density: 0.8, taxIntensity: 0.9, terrainLand: 0.7, basis: '直隶州，领县二；州治落在潞安块。' }),
  unit({ name: '汾州府', perCounty: PER_COUNTY, countyCount: 8, density: 1.3, taxIntensity: 1.0, terrainLand: 1.0, basis: '领州一县七（永宁州）。' }),
  unit({ name: '泽州', perCounty: PER_COUNTY, countyCount: 5, density: 1.2, taxIntensity: 1.0, terrainLand: 0.8, basis: '直隶州，领县四。' }),
  unit({ name: '大同府', perCounty: PER_COUNTY, countyCount: 9, density: 0.7, taxIntensity: 0.8, terrainLand: 0.8, militaryMouths: 250000, basis: '领州四县七共十一，扣去朔州（州一县一）；大同镇官军连同家口与代藩宗室约 25 万口。' }),
  unit({ name: '朔州', perCounty: PER_COUNTY, countyCount: 2, density: 0.6, taxIntensity: 0.8, terrainLand: 0.8, militaryMouths: 40000, basis: '大同府属州，领马邑；大同镇西路驻军连同家口约 4 万口。' }),
  unit({ name: '宁武关', perCounty: PER_COUNTY, countyCount: 1, density: 0.2, taxIntensity: 0.3, terrainLand: 0.5, militaryMouths: 60000, basis: '外三关中路，山西镇总兵驻地；驻军连同家口约 6 万口，驿站按一县计。' }),
  unit({ name: '偏关', perCounty: PER_COUNTY, countyCount: 1, density: 0.6, taxIntensity: 0.6, terrainLand: 0.6, militaryMouths: 40000, basis: '外三关西路（偏头关）；含河曲一县；驻军连同家口约 4 万口。' })
];

const BLOCKS = {
  太原府: block({
    name: '太原府', terrain: '盆地', specialResources: '麦·煤·铁', tags: { mineralRegion: true },
    description: '山西省会，晋王封藩于此，汾河谷地为三晋腹心；北部忻、代二州连接三关，平定一带出铁与煤。',
    commerce: 1.3, mineral: 0.25, kuangchang: 1, fishing: 0, corridor: 1.3, keju: 1.8,
    idx: [42, 68, 56, 56, 68, 42, 30, 56], fisc: [0.72, 0.18],
    notes: '晋王府；平定铁。'
  }),
  平阳府: block({
    name: '平阳府', terrain: '盆地', specialResources: '河东盐·麦·棉', tags: { saltRegion: true, mineralRegion: true },
    description: '晋南重镇，尧都故地。解州河东盐池为天下盐利之一，蒲州、解州商人贩盐起家，晋商由此发迹。',
    commerce: 1.6, salt: 1.0, mineral: 0.15, kuangchang: 1, fishing: 0, corridor: 1.2, keju: 1.8,
    idx: [42, 66, 58, 58, 68, 42, 24, 54], fisc: [0.72, 0.17],
    notes: '河东盐池在解州。'
  }),
  潞安府: block({
    name: '潞安府', terrain: '高原', specialResources: '潞绸·铁器·煤', tags: { mineralRegion: true },
    description: '上党高原，沈王封藩于此，潞绸与铁器行销四方；嘉靖间平青羊山之乱后升州为府。北部沁州、辽州山地也归此统摄。',
    commerce: 1.4, mineral: 0.2, kuangchang: 1, fishing: 0, corridor: 1.0, keju: 1.0,
    idx: [42, 66, 54, 54, 68, 42, 24, 54], fisc: [0.72, 0.17],
    notes: '沈王府；嘉靖八年升潞州为潞安府；沁、辽二直隶州并入本块。'
  }),
  汾州府: block({
    name: '汾州府', terrain: '盆地', specialResources: '麦·酒·布', tags: {},
    description: '汾阳、介休、平遥一带，商人外出经营盐、粮、布、茶，晋商足迹遍于天下；晋藩宗室支庶聚居，禄米负担沉重。',
    commerce: 1.5, fishing: 0, corridor: 1.1, keju: 1.0,
    idx: [42, 64, 56, 56, 68, 40, 24, 54], fisc: [0.72, 0.17],
    notes: '晋商乡里。'
  }),
  泽州: block({
    name: '泽州', terrain: '山地', divisionType: '州', officialPosition: '知州', specialResources: '铁·煤·丝', tags: { mineralRegion: true },
    description: '太行之南，阳城、高平一带冶铁与煤炭之利甲于三晋，铁器沿太行陉南输中原。',
    commerce: 1.2, mineral: 0.3, kuangchang: 1, fishing: 0, corridor: 1.0, keju: 1.0,
    idx: [40, 66, 50, 50, 70, 40, 24, 54], fisc: [0.72, 0.17],
    notes: '直隶州；阳城冶铁。'
  }),
  大同府: block({
    name: '大同府', terrain: '边塞', specialResources: '马市·煤·屯粮', tags: { mineralRegion: true, horseRegion: true },
    description: '九边重镇，大同镇城与代王府并在，镇兵屯驻诸堡，马市互市时开时闭。今年察哈尔林丹汗西迁，兵锋逼近归化城，宣大边警日急。',
    commerce: 1.2, mineral: 0.1, horse: 0.5, fishing: 0, corridor: 1.4, keju: 0.5,
    idx: [36, 74, 40, 40, 80, 38, 70, 60], fisc: [0.64, 0.22],
    notes: '代王府；大同镇；天启七年林丹汗西迁攻土默特。'
  }),
  朔州: block({
    name: '朔州', terrain: '边塞', divisionType: '州', officialPosition: '知州', specialResources: '屯粮·马', tags: { horseRegion: true },
    description: '桑干河上游，朔州、马邑为大同镇西路屯守之地，地寒霜早，军民杂居，以屯田为业。',
    commerce: 0.8, horse: 0.1, fishing: 0, corridor: 1.2, keju: 0.2,
    idx: [36, 70, 34, 34, 78, 36, 60, 58], fisc: [0.64, 0.20],
    notes: '大同府属州。'
  }),
  宁武关: block({
    name: '宁武关', terrain: '边塞', divisionType: '关', officialPosition: '山西镇总兵官', specialResources: '屯粮·马', tags: { horseRegion: true },
    description: '外三关之中路，山西镇总兵驻节于此；恒山余脉与汾河源头之间关城相望，屯兵以防河套与土默特之骑。',
    commerce: 0.7, horse: 0.2, fishing: 0, corridor: 1.3, keju: 0.1,
    idx: [36, 72, 30, 30, 76, 36, 75, 58], fisc: [0.62, 0.22],
    notes: '山西镇总兵嘉靖间移驻宁武关。'
  }),
  偏关: block({
    name: '偏关', terrain: '边塞', divisionType: '关', officialPosition: '偏头关守将', specialResources: '屯粮·马', tags: { horseRegion: true },
    description: '外三关之西路，偏头关临黄河东岸，冬季敌骑可踏冰而渡，守军岁岁防冬；河曲一带地瘠民贫。',
    commerce: 0.7, horse: 0.2, fishing: 0, corridor: 1.2, keju: 0.1,
    idx: [34, 72, 28, 28, 78, 36, 75, 58], fisc: [0.62, 0.22],
    notes: '偏头关。'
  })
};

const regionMeans = { development: 48, unrest: 72, taxPressure: 41, armyPressure: 30, officeRisk: 56 };

module.exports = { province: '山西布政使司', UNITS, BLOCKS, regionMeans };
