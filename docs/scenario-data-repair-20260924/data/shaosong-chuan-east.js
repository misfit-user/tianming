// 绍宋·夔州路、利州路、三泉直隶。户数、商税（铁钱折铜钱 × 0.1）、田亩、两税权重见 shaosong-sources.js，这里写定性字段。
// 夔州「建炎三年，陞夔、利兵马钤辖」；兴元府「建炎二年，陞本路钤辖，四年兼本路经略、安抚使」——建炎元年两路帅司未设。
// 建置：播州大观二年建州，宣和三年废为城、隶南平军；思州政和八年建，宣和四年废为务川城、隶黔州；珍州大观二年复建。
'use strict';

const { songBlock: block, circuitModule } = require('./shaosong-common');

// idx：[民心, 吏治(贪腐), 繁荣, 发展, 不稳, 税压, 军压, 官风险]；fisc：[征到比例, 截留率]
const KUI = {
  夔州: block({
    name: '夔州', divisionType: '州', officialPosition: '知夔州', terrain: '山地',
    specialResources: '井盐·柑橘·药材', taxLevel: '轻',
    tags: { saltRegion: true },
    description: '云安郡，宁江军节度，奉节、巫山二县；州治初在白帝城，景德三年徙城东，扼瞿塘峡口，为长江入蜀门户。',
    idx: [58, 28, 42, 42, 14, 54, 46, 36], fisc: [0.77, 0.07], corridor: 1.3,
    notes: '一路治所，建炎三年方升钤辖。'
  }),
  万州: block({
    name: '万州', divisionType: '州', officialPosition: '知万州', terrain: '山地',
    specialResources: '金·药材·柑橘', taxLevel: '轻',
    tags: { mineralRegion: true },
    description: '南浦郡，南浦、武宁二县，长江所经，土贡金、木药子。',
    idx: [58, 28, 40, 40, 14, 52, 42, 34], fisc: [0.77, 0.07],
    notes: '贡金。'
  }),
  忠州: block({
    name: '忠州', divisionType: '州', officialPosition: '知忠州', terrain: '山地',
    specialResources: '绵绸·井盐·柑橘', taxLevel: '轻',
    tags: { saltRegion: true },
    description: '南宾郡，临江、垫江、南宾、龙渠诸县，长江所经，土贡绵绸。',
    idx: [58, 28, 42, 42, 14, 52, 40, 34], fisc: [0.77, 0.07],
    notes: '志中标题咸淳府（咸淳元年升）。'
  }),
  开州: block({
    name: '开州', divisionType: '州', officialPosition: '知开州', terrain: '山地',
    specialResources: '绸·车前子', taxLevel: '轻',
    tags: {},
    description: '盛山郡，开江、清水二县，土贡白绸、车前子。',
    idx: [58, 28, 38, 38, 14, 52, 40, 34], fisc: [0.77, 0.07],
    notes: '崇宁户二万五千。'
  }),
  达州: block({
    name: '达州', divisionType: '州', officialPosition: '知达州', terrain: '山地',
    specialResources: '井盐·茶·粮', taxLevel: '轻',
    tags: { saltRegion: true },
    description: '通川郡，本通州，乾德三年改名，通川、巴渠、永睦、新宁、东乡五县。',
    idx: [58, 28, 40, 40, 14, 52, 40, 34], fisc: [0.77, 0.07],
    notes: '盐井。'
  }),
  恭州: block({
    name: '恭州', divisionType: '州', officialPosition: '知恭州', terrain: '山地',
    specialResources: '粮·鱼·舟运', taxLevel: '中',
    tags: { fishingRegion: true },
    description: '巴郡，旧为渝州，崇宁元年改恭州，巴、江津、壁山三县并羁縻州一；嘉陵江与长江交汇，舟楫所聚。',
    idx: [58, 28, 46, 46, 14, 54, 42, 34], fisc: [0.77, 0.07], corridor: 1.2,
    notes: '志中标题重庆府（后升）。'
  }),
  涪州: block({
    name: '涪州', divisionType: '州', officialPosition: '知涪州', terrain: '山地',
    specialResources: '荔枝·丹砂·粮', taxLevel: '轻',
    tags: {},
    description: '涪陵郡，涪陵、乐温、武龙三县，乌江入长江之口，江心白鹤梁刻石纪水。',
    idx: [58, 28, 40, 40, 14, 52, 40, 34], fisc: [0.77, 0.07],
    notes: '乌江口。'
  }),
  黔州: block({
    name: '黔州', divisionType: '州', officialPosition: '知黔州', terrain: '山地',
    specialResources: '朱砂·蜡', taxLevel: '轻',
    tags: { mineralRegion: true },
    description: '黔中郡，武泰军节度，彭水、黔江二县，统领诸羁縻州；黄庭坚曾谪居于此。',
    idx: [56, 28, 34, 34, 18, 48, 46, 34], fisc: [0.76, 0.07], hide: 1.5,
    notes: '志中标题绍庆府（绍定元年升）。元丰户仅二千余。'
  }),
  施州: block({
    name: '施州', divisionType: '州', officialPosition: '知施州', terrain: '山地',
    specialResources: '黄连·药材', taxLevel: '轻',
    tags: {},
    description: '清江郡，清江、建始二县与广积砦，溪峒之地，土贡黄连、木药子。',
    idx: [56, 28, 34, 34, 18, 48, 44, 34], fisc: [0.76, 0.07], hide: 1.5,
    notes: '溪峒边州。'
  }),
  珍州: block({
    name: '珍州', divisionType: '州', officialPosition: '知珍州', terrain: '山地', regionType: 'jimi',
    specialResources: '木材·山货', taxLevel: '轻',
    tags: {},
    description: '唐开山洞置，唐末没于夷；大观二年大骆解上下族帅献地，复建珍州，宣和三年以绥阳县来隶。',
    idx: [54, 24, 28, 28, 22, 36, 44, 32], fisc: [0.50, 0.05], hide: 2.0, keju: 0,
    notes: '羁縻，户数为估数。'
  }),
  播州: block({
    name: '播州', divisionType: '城', officialPosition: '播州城主', regionType: 'jimi',
    terrain: '山地', specialResources: '木材·山货·马', taxLevel: '轻',
    tags: {},
    description: '大观二年南平夷人杨文贵等献地建州，宣和三年废为播州城，隶南平军；杨氏世守其地。',
    idx: [54, 24, 28, 28, 22, 34, 46, 32], fisc: [0.45, 0.05], hide: 2.0, keju: 0,
    notes: '建炎元年已降为城，杨氏世守，按羁縻；户数为估数。'
  }),
  思州: block({
    name: '思州', divisionType: '城', officialPosition: '务川城主', regionType: 'jimi',
    terrain: '山地', specialResources: '朱砂·木材', taxLevel: '轻',
    tags: { mineralRegion: true },
    description: '政和八年田氏纳土建州，领务川、邛水、安夷三县；宣和四年废州为务川城，邛水、安夷作堡，并隶黔州。田氏世守。',
    idx: [54, 24, 28, 28, 22, 34, 46, 32], fisc: [0.45, 0.05], hide: 2.0, keju: 0,
    notes: '建炎元年已降为务川城，按羁縻；户数为估数。'
  }),
  南平军: block({
    name: '南平军', divisionType: '军', officialPosition: '知南平军', terrain: '山地',
    specialResources: '木材·粮', taxLevel: '轻',
    tags: {},
    description: '熙宁八年收西南番部，以恭州南川县铜佛坝地置军，领南川、隆化二县与溱溪砦，播州城亦隶焉。',
    idx: [56, 28, 34, 34, 20, 46, 48, 34], fisc: [0.76, 0.07], hide: 1.6,
    notes: '户数为估数。'
  }),
  云安军: block({
    name: '云安军', divisionType: '军', officialPosition: '知云安军', terrain: '山地',
    specialResources: '井盐·绢', taxLevel: '轻',
    tags: { saltRegion: true },
    description: '开宝六年以夔州云安县建军，云安盐井为峡中大井，土贡绢。',
    idx: [58, 28, 40, 40, 14, 52, 40, 34], fisc: [0.77, 0.07],
    notes: '盐井。'
  }),
  梁山军: block({
    name: '梁山军', divisionType: '军', officialPosition: '知梁山军', terrain: '丘陵',
    specialResources: '粮', taxLevel: '轻',
    tags: {},
    description: '开宝二年以万州石氏屯田务置军，领梁山一县，熙宁五年析忠州桂溪地益之。',
    idx: [58, 28, 38, 38, 14, 52, 40, 34], fisc: [0.77, 0.07],
    notes: '屯田务所置。'
  }),
  大宁监: block({
    name: '大宁监', divisionType: '监', officialPosition: '知大宁监', terrain: '山地',
    specialResources: '井盐·蜡', taxLevel: '轻',
    tags: { saltRegion: true },
    description: '开宝六年以夔州大昌县盐泉所建监，领大昌一县，盐泉之利供峡路诸州。',
    idx: [58, 28, 38, 38, 14, 52, 40, 34], fisc: [0.77, 0.07],
    notes: '以盐泉置监。'
  })
};

const LI = {
  兴元府: block({
    name: '兴元府', divisionType: '府', officialPosition: '知兴元府', terrain: '盆地',
    specialResources: '茶·粮·药材', taxLevel: '中',
    tags: {},
    description: '汉中郡，山南西道节度，旧兼提举利州路兵马巡检事；汉中盆地，南郑、城固、褒城诸县，有茶场。',
    idx: [58, 28, 48, 48, 18, 56, 50, 36], fisc: [0.77, 0.07], keju: 1.2, corridor: 1.3,
    notes: '一路治所，建炎二年方升钤辖。'
  }),
  洋州: block({
    name: '洋州', divisionType: '州', officialPosition: '知洋州', terrain: '山地',
    specialResources: '茶·竹', taxLevel: '中',
    tags: {},
    description: '洋川郡，武康军节度，兴道、西乡、真符三县，西乡产茶；文同知洋州时作筼筜谷诗。',
    idx: [58, 28, 44, 44, 18, 56, 46, 34], fisc: [0.77, 0.07],
    notes: '西乡茶。'
  }),
  利州: block({
    name: '利州', divisionType: '州', officialPosition: '知利州', terrain: '山地',
    specialResources: '粮·舟运', taxLevel: '中',
    tags: {},
    description: '益川郡，宁武军节度，绵谷、葭萌、嘉川、昭化四县，嘉陵江与金牛道所经，入蜀咽喉。',
    idx: [58, 28, 42, 42, 20, 60, 48, 34], fisc: [0.77, 0.07], corridor: 1.4,
    notes: '金牛道。'
  }),
  剑州: block({
    name: '剑州', divisionType: '州', officialPosition: '知剑州', terrain: '山地',
    specialResources: '粮·药材', taxLevel: '中',
    tags: {},
    description: '普安郡，普安、梓潼、阴平、武连、普成、剑门六县；剑门关天险在境。',
    idx: [58, 28, 42, 42, 18, 60, 50, 34], fisc: [0.77, 0.07], corridor: 1.3,
    notes: '志中标题隆庆府（绍熙元年升）。'
  }),
  阆州: block({
    name: '阆州', divisionType: '州', officialPosition: '知阆州', terrain: '山地',
    specialResources: '绸·井盐·粮', taxLevel: '中',
    tags: { saltRegion: true },
    description: '阆中郡，安德军节度，嘉陵江中游，阆中、苍溪、南部、新井等七县，新井有盐井。',
    idx: [58, 28, 44, 44, 18, 60, 44, 34], fisc: [0.77, 0.07],
    notes: '新井盐井。'
  }),
  巴州: block({
    name: '巴州', divisionType: '州', officialPosition: '知巴州', terrain: '山地',
    specialResources: '粮·药材', taxLevel: '轻',
    tags: {},
    description: '清化郡，化城、难江、恩锡、曾口、通江五县，米仓山下，米仓道北通汉中。',
    idx: [58, 28, 40, 40, 18, 58, 44, 34], fisc: [0.77, 0.07],
    notes: '米仓道。'
  }),
  蓬州: block({
    name: '蓬州', divisionType: '州', officialPosition: '知蓬州', terrain: '山地',
    specialResources: '粮·绸', taxLevel: '轻',
    tags: {},
    description: '咸安郡，蓬池、仪陇、营山、伏虞、相如诸县，川北丘陵。',
    idx: [58, 28, 40, 40, 18, 58, 44, 34], fisc: [0.77, 0.07],
    notes: '川北丘陵。'
  }),
  政州: block({
    name: '政州', divisionType: '州', officialPosition: '知政州', terrain: '山地',
    specialResources: '药材·木材', taxLevel: '轻',
    tags: {},
    description: '江油郡，本龙州，政和五年改名政州，江油、清川二县，阴平古道所经。',
    idx: [58, 28, 38, 38, 18, 56, 48, 34], fisc: [0.77, 0.07],
    notes: '绍兴元年复名龙州。'
  }),
  兴州: block({
    name: '兴州', divisionType: '州', officialPosition: '知兴州', terrain: '山地',
    specialResources: '铁·铸钱·木材', taxLevel: '轻',
    tags: { mineralRegion: true },
    description: '顺政郡，顺政、长举二县与济众监，嘉陵江上游，济众监鼓铸铁钱。',
    idx: [58, 28, 42, 42, 18, 56, 50, 34], fisc: [0.77, 0.07],
    notes: '志中标题沔州（开禧后改）。'
  }),
  文州: block({
    name: '文州', divisionType: '州', officialPosition: '知文州', terrain: '山地', regionType: 'frontier_defense',
    specialResources: '麝香·药材·马', taxLevel: '轻',
    tags: { horseRegion: true },
    description: '阴平郡，领曲水一县，西接吐蕃诸部，蕃汉杂处。',
    idx: [56, 28, 36, 36, 20, 54, 52, 34], fisc: [0.76, 0.07], hide: 1.5,
    notes: '边州。'
  })
};

const SANQUAN = {
  三泉县: block({
    name: '三泉县', divisionType: '县', officialPosition: '知三泉县', terrain: '山地',
    specialResources: '漕运·茶', taxLevel: '中',
    tags: {},
    description: '本兴元府属县，乾德三年平蜀后直属京师；至道二年一度建大安军，次年罢，县仍直隶。嘉陵江上游，金牛道所经。',
    idx: [58, 28, 42, 42, 19, 62, 46, 34], fisc: [0.77, 0.07], corridor: 1.4,
    notes: '一县直隶，户数取志中大安军条。'
  })
};

module.exports = [
  circuitModule('夔州路', { BLOCKS: KUI, regionMeans: { development: 38, unrest: 14, taxBurden: 52, armyPressure: 42 } }),
  circuitModule('利州路', { BLOCKS: LI, regionMeans: { development: 42.75, unrest: 19, taxBurden: 59.37, armyPressure: 46.75 } }),
  circuitModule('三泉直隶', { BLOCKS: SANQUAN, regionMeans: { development: 42, unrest: 19, taxBurden: 62, armyPressure: 46 } })
];
