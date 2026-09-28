// 天启剧本·朵甘思宣慰司 7 块（羁縻，康区）
//
// 明廷在康区设朵甘思宣慰司、长河西鱼通宁远宣慰司、董卜韩胡宣慰司等，实际由寺院与土司头人分治，
// 靠茶马互市与册封朝贡维系。剧本这一省原是外藩格式（聚落写比例、没有保甲与承载），并入明廷行政树后沿用。
// 本省权重：没有册籍，按各地农牧轻重估人口——昌都本部与打箭炉一带最盛，嘉绒诸部次之，理塘、巴塘地广人稀。
// 税粮（贡赋）大体随人口，打箭炉互市稍重；田亩以巴塘、长河西、董卜韩胡等河谷为多，高原牧区极少。
// 商贸以打箭炉茶马互市为最；马匹出自高原牧区。聚落比例各块照抄省里（寺院庄园、牧帐、山谷村寨）。
// 各块沿用省里的征到比例与截留率。剧本记的「高寒歉收」改成正规灾异记录，落到高原牧区四块。
// 马政产区标签沿用剧本原值（七块都是）。
'use strict';

const { block } = require('./lib-blocks');

const COLD = { type: 'cold', severity: 1, startTurn: 1, note: '高寒歉收' };

const unit = (name, mouths, grain, land, basis) => ({ name, countyCount: 1, weights: { pop: mouths, households: mouths, grain, land }, basis });

const UNITS = [
  unit('朵甘思宣慰司', 90000, 9, 3, '昌都一带寺院与部落，按九万口估。'),
  unit('长河西宣慰司', 70000, 9, 5, '打箭炉互市所在，按七万口估。'),
  unit('董卜韩胡宣慰司', 60000, 6, 5, '嘉绒诸寨，按六万口估。'),
  unit('白利土司', 50000, 5, 2, '甘孜牧区，按五万口估。'),
  unit('德格土司', 50000, 5, 2, '金沙江东岸，按五万口估。'),
  unit('理塘土司', 30000, 3, 1.2, '高原牧场，按三万口估。'),
  unit('巴塘土司', 30000, 3, 4, '金沙江河谷，按三万口估。')
];

const BLOCKS = {
  朵甘思宣慰司: block({
    name: '朵甘思宣慰司', terrain: '高原', divisionType: '司', regionType: 'jimi', officialPosition: '宣慰使',
    specialResources: '马·麝香·酥油', tags: { horseRegion: true },
    description: '澜沧江上游的昌都一带，昌都寺、类乌齐寺为康区大寺，寺院与部落头人分治其地；川藏茶道在此分途，茶商马帮往来。明廷所设朵甘思宣慰司徒有名号。',
    commerce: 1.0, fishing: 0, horse: 0.25, corridor: 1.2, keju: 0,
    idx: [38, 18, 38, 38, 82, 64, 70, 45], fisc: [0.42, 0.08],
    disasterRecord: [COLD],
    notes: '昌都寺（正统二年建，格鲁派）；类乌齐寺（达隆噶举）。'
  }),
  长河西宣慰司: block({
    name: '长河西宣慰司', terrain: '山地', divisionType: '司', regionType: 'jimi', officialPosition: '宣慰使',
    specialResources: '茶马互市·麝香·药材', tags: { horseRegion: true },
    description: '大渡河上游，长河西鱼通宁远宣慰司世守其地；打箭炉为汉番互市之所，雅州边茶由此入康，马匹、麝香、药材东来。',
    commerce: 2.4, fishing: 0, horse: 0.05, corridor: 1.4, keju: 0,
    idx: [42, 20, 46, 46, 78, 66, 66, 45], fisc: [0.42, 0.08],
    notes: '打箭炉茶马互市。'
  }),
  董卜韩胡宣慰司: block({
    name: '董卜韩胡宣慰司', terrain: '山地', divisionType: '司', regionType: 'jimi', officialPosition: '宣慰使',
    specialResources: '药材·木材·麝香', tags: { horseRegion: true },
    description: '邛崃山以西的嘉绒诸部，董卜韩胡宣慰司永乐、宣德间曾雄踞一方，其后渐衰；诸寨碉楼林立，土司之间争战不息。',
    commerce: 0.8, fishing: 0, horse: 0.05, corridor: 0.8, keju: 0,
    idx: [36, 18, 34, 34, 86, 62, 74, 46], fisc: [0.42, 0.08],
    notes: '嘉绒碉楼。'
  }),
  白利土司: block({
    name: '白利土司', terrain: '高原', divisionType: '土司', regionType: 'jimi', officialPosition: '土司',
    specialResources: '马·羊毛·酥油', tags: { horseRegion: true },
    description: '雅砻江上游的甘孜一带，白利土司近年势力日张，崇奉苯教，与各派寺院不睦。',
    commerce: 0.7, fishing: 0, horse: 0.2, corridor: 0.8, keju: 0,
    idx: [34, 18, 34, 34, 86, 62, 74, 46], fisc: [0.42, 0.08],
    disasterRecord: [COLD],
    notes: '白利土司。'
  }),
  德格土司: block({
    name: '德格土司', terrain: '高原', divisionType: '土司', regionType: 'jimi', officialPosition: '土司',
    specialResources: '马·羊毛·铜器', tags: { horseRegion: true },
    description: '金沙江东岸，德格家族在更庆一带渐兴，世为萨迦派更庆寺的施主；工匠擅制铜器。',
    commerce: 0.8, fishing: 0, horse: 0.2, corridor: 0.8, keju: 0,
    idx: [40, 18, 38, 38, 80, 62, 68, 44], fisc: [0.42, 0.08],
    disasterRecord: [COLD],
    notes: '更庆寺（萨迦派）。'
  }),
  理塘土司: block({
    name: '理塘土司', terrain: '高原', divisionType: '土司', regionType: 'jimi', officialPosition: '土司',
    specialResources: '马·牦牛·酥油', tags: { horseRegion: true },
    description: '地势极高的理塘草原，三世达赖万历八年在此建理塘寺，格鲁派由此在康南立足；牧民逐水草而居。',
    commerce: 0.7, fishing: 0, horse: 0.2, corridor: 1.0, keju: 0,
    idx: [38, 18, 34, 34, 82, 62, 70, 44], fisc: [0.42, 0.08],
    disasterRecord: [COLD],
    notes: '理塘寺（万历八年建）。'
  }),
  巴塘土司: block({
    name: '巴塘土司', terrain: '河谷', divisionType: '土司', regionType: 'jimi', officialPosition: '土司',
    specialResources: '青稞·果木·马', tags: { horseRegion: true },
    description: '金沙江东岸的河谷坝子，气候较暖，农牧兼营，为川藏道上的要站。',
    commerce: 0.9, fishing: 0, horse: 0.05, corridor: 1.1, keju: 0,
    idx: [40, 18, 38, 38, 80, 64, 68, 44], fisc: [0.42, 0.08],
    notes: '川藏道。'
  })
};

const regionMeans = { development: 38, unrest: 82, taxPressure: 64, armyPressure: 70, officeRisk: 45 };

module.exports = { province: '朵甘思宣慰司', UNITS, BLOCKS, regionMeans, fiscalRates: 'province' };
