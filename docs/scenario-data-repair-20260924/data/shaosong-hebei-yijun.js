// 绍宋·河北义军 4 块（外藩）：分路框架与逐块数据合在一个文件。
//   补路一级：node patches/shaosong-circuits.js data/shaosong-hebei-yijun.js --write
//   逐块重写：node patches/tianqi-prefectures.js data/shaosong-hebei-yijun.js --write
// 户数、商税、田亩与大金宋地同法（取 shaosong-jin-frame.js 的 weights：磁、相二州崇宁户，赞皇县按赵州县等切出，五马山寨估）。
'use strict';

const jinFrame = require('./shaosong-jin-frame');
const { songBlock: block, circuitModule } = require('./shaosong-common');

// 地图上四块都在河北西路；树顶原名「两河忠义寨」，路一级按地图省道写河北西路
const CIRCUITS = [
  {
    name: '河北西路', officialPosition: '忠义寨首领', capital: '相州',
    terrain: '丘陵', specialResources: '粮·绢·磁石', taxLevel: '轻',
    description: '磁、相二州守城官军与乡兵仍奉宋正朔，太行东麓五马山、赞皇一带忠义山寨林立；诸寨自筹粮械，仰乡里输送，无统一府库。',
    strategicValue: '牵制金军南下，接应河北招抚司。', threats: ['金东路军', '粮械不继'],
    flee: 1.8, hide: 1.2, textile: 1.0
  }
];

// idx：[民心, 吏治(贪腐), 繁荣, 发展, 不稳, 税压, 军压, 官风险]；fisc：[征到比例, 截留率]
const BLOCKS = {
  磁州: block({
    name: '磁州', divisionType: '州', officialPosition: '知磁州', terrain: '丘陵', regionType: 'frontier_defense',
    specialResources: '磁石·瓷器·粮', taxLevel: '轻', tags: {},
    description: '滏阳郡，旧名慈州，政和三年改磁，滏阳、邯郸、武安三县，太行东麓；靖康元年宗泽知磁州，缮城募兵，金人屡攻不下。',
    idx: [64, 18, 30, 30, 26, 36, 14, 34], fisc: [0.82, 0.05],
    notes: '崇宁户三万六千余，贡磁石。'
  }),
  相州: block({
    name: '相州', divisionType: '州', officialPosition: '知相州', terrain: '平原', regionType: 'frontier_defense',
    specialResources: '暗花牡丹纱·知母·胡粉·绢', taxLevel: '轻', tags: {},
    description: '邺郡，彰德军节度，安阳、汤阴、临漳、林虑四县，洹水所经，韩琦故里；靖康以后城中军民仍奉宋守御。',
    idx: [62, 18, 32, 32, 26, 38, 12, 34], fisc: [0.82, 0.05],
    notes: '崇宁户三万六千余，望州。'
  }),
  五马山寨: block({
    name: '五马山寨', divisionType: '寨', officialPosition: '五马山寨寨主', terrain: '山地', regionType: 'frontier_defense',
    specialResources: '粮·木材', taxLevel: '轻', tags: {},
    description: '赞皇县境五马山，两河忠义聚众据山为寨，赵邦杰、马扩等主之，太行东麓抗金的据点。',
    idx: [60, 18, 20, 20, 30, 34, 16, 36], fisc: [0.82, 0.05],
    notes: '志无户数，按山寨估两千户。'
  }),
  赞皇县: block({
    name: '赞皇县', divisionType: '县', officialPosition: '知赞皇县', terrain: '山地', regionType: 'frontier_defense',
    specialResources: '粮·木材', taxLevel: '轻', tags: {},
    description: '赵州（宋宣和元年升庆源府）属县，赞皇山在境，熙宁五年省为镇、元祐元年复置，西依太行，与五马山寨相依。',
    idx: [62, 18, 24, 24, 26, 36, 14, 34], fisc: [0.82, 0.05],
    notes: '按赵州县等切出（九域志无赞皇乡数）。'
  })
};

function units() {
  return Object.keys(BLOCKS).map((name) => {
    const w = jinFrame.weights(name, '河北西路');
    return {
      name,
      block: name,
      countyCount: w.counties,
      weights: { pop: w.households, households: w.households, grain: w.twoTax, land: w.land, commerce: w.commerce },
      basis: '户数：' + w.householdBasis + '。商税：' + w.commerceBasis + '。'
    };
  });
}

const module_ = [
  circuitModule('河北西路', {
    faction: '河北义军', BLOCKS, UNITS: units(),
    regionMeans: { development: 28, unrest: 27, taxBurden: 37, armyPressure: 13 }
  })
];

// 补路一级用的框架数据挂在数组上（shaosong-circuits.js 读 treeKey、CIRCUITS、weights）
Object.assign(module_, {
  treeKey: 'fac_hebei_yijun',
  idPrefix: 'div_ss_hbyj_',
  reportTitle: '绍宋·河北义军补路一级报告',
  treeLabel: '河北义军行政树去掉「两河忠义寨」顶节点，',
  reportNotes: ['户数：磁、相二州取《宋史·地理志》崇宁户；赞皇县按赵州县等切出；五马山寨志无户数，估两千户。'],
  CIRCUITS,
  PORTS: {},
  // 原账聚落名目（城寨、避兵坞壁、山寨）并入城、镇、乡
  settlementKeys: require('./shaosong-foreign').SETTLEMENT_KEYS,
  weights: jinFrame.weights
});

module.exports = module_;
