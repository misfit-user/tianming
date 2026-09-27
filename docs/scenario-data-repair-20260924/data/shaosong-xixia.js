// 绍宋·大夏（西夏）17 块（外藩）：分路框架与逐块数据。
// 户数权重：西夏兵民合一，《宋史·夏国传》「男年登十五为丁，率二丁取正军一人」（卷四百八十六），
//   驻兵分布即丁口分布的近似。卷四百八十五记元昊置十二监军司时各地兵数：
//   「自河北至午腊蒻山七万人，以备契丹；河南洪州、白豹、安盐州、罗落、天都、惟精山等五万人，以备环、庆、镇戎、原州；
//    左厢宥州路五万人，以备鄜、延、麟、府；右厢甘州路三万人，以备西蕃、回纥；贺兰驻兵五万、灵州五万人、兴州兴庆府七万人为镇守」。
//   各区按此分（贺兰驻兵在兴庆府西，计入兴庆府一区），区内按《新唐书·地理志》天宝口数分到州；唐无户口的州按属县折算。
//   势力全国合计不动。
'use strict';

const { foreignTree, block } = require('./shaosong-foreign');

// 天宝口数（《新唐书·地理志》卷三十七、四十）
const TIANBAO = { 夏州: 53014, 宥州: 32652, 盐州: 16665, 凉州: 120281, 甘州: 22092, 肃州: 8476, 瓜州: 4987, 沙州: 16250 };
const HEXI = TIANBAO.凉州 + TIANBAO.甘州 + TIANBAO.肃州 + TIANBAO.瓜州 + TIANBAO.沙州;
const XIAYOU = TIANBAO.夏州 + TIANBAO.宥州;
const ARMY = '《宋史·夏国传》';

// households 以「万人兵额」为单位的相对权重
const LEAVES = {
  兴庆府: { households: 12 * 3 / 5, economy: 'farm', commerceFactor: 1.5, basis: ARMY + '兴州兴庆府七万、贺兰驻兵五万，兴庆府与静州、怀州按唐怀远、保静等县折三比一比一' },
  静州: { households: 12 * 1 / 5, economy: 'farm', basis: ARMY + '兴庆府一区十二万之五分之一（唐灵州保静县地）' },
  怀州夏境: { households: 12 * 1 / 5, economy: 'farm', basis: ARMY + '兴庆府一区十二万之五分之一' },
  西平府: { households: 5 * 2 / 3, economy: 'farm', basis: ARMY + '灵州五万，西平府（唐灵州回乐、灵武二县）与鸣沙按县数二比一' },
  鸣沙县: { households: 5 * 1 / 3, economy: 'farm', basis: ARMY + '灵州五万之三分之一（唐鸣沙县）' },
  盐州: { households: 2.5, economy: 'mixed', basis: ARMY + '河南洪州、白豹、安盐州等五万，盐州与韦州（唐威州无户口）各半' },
  韦州: { households: 2.5, economy: 'mixed', basis: ARMY + '河南五万之半（静塞监军司）' },
  夏州: { households: 5 * TIANBAO.夏州 / XIAYOU, economy: 'mixed', basis: ARMY + '左厢宥州路五万，按天宝口数夏州 ' + TIANBAO.夏州 + '、宥州 ' + TIANBAO.宥州 + ' 分' },
  宥州: { households: 5 * TIANBAO.宥州 / XIAYOU, economy: 'pastoral', basis: ARMY + '左厢宥州路五万，按天宝口数分' },
  西凉府: { households: 3 * TIANBAO.凉州 / HEXI, economy: 'farm', commerceFactor: 1.5, basis: ARMY + '右厢甘州路三万，按天宝口数凉州 ' + TIANBAO.凉州 + ' 分（河西五州合 ' + HEXI + '）' },
  甘州: { households: 3 * TIANBAO.甘州 / HEXI, economy: 'farm', basis: ARMY + '右厢甘州路三万，按天宝口数甘州 ' + TIANBAO.甘州 + ' 分' },
  肃州: { households: 3 * TIANBAO.肃州 / HEXI, economy: 'farm', basis: ARMY + '右厢甘州路三万，按天宝口数肃州 ' + TIANBAO.肃州 + ' 分' },
  瓜州: { households: 3 * TIANBAO.瓜州 / HEXI, economy: 'mixed', basis: ARMY + '右厢甘州路三万，按天宝口数瓜州 ' + TIANBAO.瓜州 + ' 分' },
  沙州: { households: 3 * TIANBAO.沙州 / HEXI, economy: 'farm', basis: ARMY + '右厢甘州路三万，按天宝口数沙州 ' + TIANBAO.沙州 + ' 分' },
  兀剌海: { households: 3, economy: 'pastoral', basis: ARMY + '河北至午腊蒻山七万，兀剌海（黑山威福监军司）三、黑水城二、贺兰山西麓二' },
  黑水城: { households: 2, economy: 'mixed', basis: ARMY + '河北至午腊蒻山七万之七分之二（黑水镇燕监军司）' },
  贺兰山西麓: { households: 2, economy: 'pastoral', basis: ARMY + '河北至午腊蒻山七万之七分之二（贺兰山以西诸部）' }
};

// idx：[民心, 吏治(贪腐), 繁荣, 发展, 不稳, 税压, 军压, 官风险]；fisc：[征到比例, 截留率]
const XINGLING = {
  兴庆府: block({
    name: '兴庆府', divisionType: '府', officialPosition: '兴庆府尹', terrain: '平原', regionType: 'normal',
    specialResources: '稻麦·甘草·毡', taxLevel: '中', tags: {},
    description: '本兴州，元昊升兴庆府建都，黄河西岸、贺兰山东麓；唐来、汉源二古渠引河灌溉，岁无旱涝，宫城与十六司所在。',
    idx: [48, 28, 50, 50, 22, 46, 40, 36], fisc: [0.73, 0.07], keju: 1.5, corridor: 1.4,
    notes: '《宋史·夏国传》「兴、灵则有古渠曰唐来，曰汉源，皆支引黄河」。'
  }),
  西平府: block({
    name: '西平府', divisionType: '府', officialPosition: '西平府尹', terrain: '平原', regionType: 'normal',
    specialResources: '稻麦·印盐·甘草', taxLevel: '中', tags: { saltRegion: true },
    description: '本唐灵州灵武郡，李继迁咸平五年攻取，改西平府，一度建都；黄河东岸，引河灌田，兴庆府东南屏障。',
    idx: [46, 28, 44, 44, 22, 46, 46, 34], fisc: [0.73, 0.07],
    notes: '唐灵州贡印盐。'
  }),
  怀州夏境: block({
    name: '怀州夏境', divisionType: '州', officialPosition: '怀州刺史', terrain: '平原', regionType: 'normal',
    specialResources: '稻麦', taxLevel: '中', tags: {},
    description: '兴庆府近畿的怀州，与定州、永州同在《宋史·夏国传》「河西之州九」之列，黄河两岸渠田相接。',
    idx: [46, 28, 40, 40, 24, 44, 40, 34], fisc: [0.73, 0.07],
    notes: '兴庆府近畿屯田之地。'
  }),
  静州: block({
    name: '静州', divisionType: '州', officialPosition: '静州刺史', terrain: '平原', regionType: 'normal',
    specialResources: '稻麦', taxLevel: '中', tags: {},
    description: '唐灵州保静县地，西夏置静州，兴庆府南、黄河西岸的渠田之地。',
    idx: [46, 28, 40, 40, 24, 44, 40, 34], fisc: [0.73, 0.07],
    notes: '唐保静县。'
  }),
  韦州: block({
    name: '韦州', divisionType: '州', officialPosition: '韦州静塞监军使', terrain: '边塞', regionType: 'frontier_defense',
    specialResources: '马·粮', taxLevel: '中', tags: { horseRegion: true },
    description: '唐安乐州（后名威州）故地，西夏置韦州静塞监军司，东南对宋环庆、泾原二路，天都山在其南。',
    idx: [44, 28, 34, 34, 26, 44, 56, 36], fisc: [0.73, 0.07],
    notes: '十二监军司之「韦州静塞」。'
  }),
  鸣沙县: block({
    name: '鸣沙县', divisionType: '县', officialPosition: '鸣沙县令', terrain: '河谷', regionType: 'normal',
    specialResources: '粟·稻麦', taxLevel: '中', tags: {},
    description: '唐鸣沙县，黄河南岸鸣沙川，西夏于此窖粟积粮，为灵州以南的粮储之地。',
    idx: [46, 28, 38, 38, 24, 44, 44, 34], fisc: [0.73, 0.07],
    notes: '唐属灵州，后隶威州。'
  })
};

const XIAYOUYAN = {
  夏州: block({
    name: '夏州', divisionType: '州', officialPosition: '夏州刺史', terrain: '边塞', regionType: 'frontier_defense',
    specialResources: '毡·角弓·酥', taxLevel: '中', tags: { horseRegion: true },
    description: '朔方郡，赫连勃勃统万城故址；拓跋氏自唐末世为定难军节度，李氏兴起之地，地当毛乌素沙地南缘。',
    idx: [46, 28, 32, 32, 24, 46, 52, 36], fisc: [0.73, 0.07],
    notes: '唐夏州贡毡、角弓、酥。'
  }),
  宥州: block({
    name: '宥州', divisionType: '州', officialPosition: '宥州嘉宁监军使', terrain: '草原', regionType: 'frontier_defense',
    specialResources: '马·羊·毡', taxLevel: '轻', tags: { horseRegion: true },
    description: '宁朔郡，唐安置六胡州降户之地；西夏置宥州嘉宁监军司，左厢宥州路统兵于此，东南对宋鄜延、麟府。',
    idx: [46, 28, 28, 28, 24, 44, 52, 36], fisc: [0.73, 0.07],
    notes: '十二监军司之「宥州嘉宁」。'
  }),
  盐州: block({
    name: '盐州', divisionType: '州', officialPosition: '盐州刺史', terrain: '草原', regionType: 'frontier_defense',
    specialResources: '青白盐·马', taxLevel: '中', tags: { saltRegion: true, horseRegion: true },
    description: '五原郡，乌池、白池诸盐池所在，青白盐为西夏大利，宋屡禁其入境；南对宋环庆路。',
    idx: [46, 28, 32, 32, 24, 46, 50, 36], fisc: [0.73, 0.07],
    notes: '青白盐。'
  })
};

const HEXI_BLOCKS = {
  西凉府: block({
    name: '西凉府', divisionType: '府', officialPosition: '西凉府尹', terrain: '绿洲', regionType: 'normal',
    specialResources: '龙须席·毯·马', taxLevel: '中', tags: {},
    description: '唐凉州武威郡，河西都会，西夏升西凉府为辅郡；护国寺感通塔天祐民安五年重修立碑，西夏文、汉文合璧。',
    idx: [46, 28, 36, 36, 22, 42, 34, 34], fisc: [0.73, 0.07], keju: 1.2,
    notes: '唐凉州贡龙须席、毯。'
  }),
  甘州: block({
    name: '甘州', divisionType: '州', officialPosition: '甘州甘肃监军使', terrain: '绿洲', regionType: 'normal',
    specialResources: '麝香·冬柰·枸杞', taxLevel: '中', tags: {},
    description: '张掖郡，唐末甘州回鹘牙帐所在；西夏置甘州甘肃监军司，右厢甘州路统兵于此，以诸河溉田。',
    idx: [46, 28, 32, 32, 22, 42, 36, 34], fisc: [0.73, 0.07],
    notes: '十二监军司之「甘州甘肃」。'
  }),
  肃州: block({
    name: '肃州', divisionType: '州', officialPosition: '肃州刺史', terrain: '绿洲', regionType: 'normal',
    specialResources: '麸金·苁蓉', taxLevel: '中', tags: { mineralRegion: true },
    description: '酒泉郡，河西西段绿洲；景祐三年元昊与瓜、沙二州同取之。',
    idx: [46, 28, 28, 28, 22, 42, 36, 34], fisc: [0.73, 0.07],
    notes: '唐肃州贡麸金、苁蓉。'
  }),
  瓜州: block({
    name: '瓜州', divisionType: '州', officialPosition: '瓜州西平监军使', terrain: '绿洲', regionType: 'normal',
    specialResources: '黄矾·绛矾·胡桐律', taxLevel: '中', tags: { mineralRegion: true },
    description: '晋昌郡，西夏置瓜州西平监军司；榆林窟在其南，西通沙州。',
    idx: [46, 28, 26, 26, 22, 42, 38, 34], fisc: [0.73, 0.07],
    notes: '十二监军司之「瓜州西平」；唐瓜州贡黄矾、绛矾。'
  }),
  沙州: block({
    name: '沙州', divisionType: '州', officialPosition: '沙州刺史', terrain: '绿洲', regionType: 'normal',
    specialResources: '黄矾·石膏·棋子', taxLevel: '中', tags: { mineralRegion: true },
    description: '敦煌郡，归义军旧地；景祐三年元昊取瓜、沙、肃三州。莫高窟在鸣沙山东麓，西夏时续有开凿。',
    idx: [46, 28, 30, 30, 22, 42, 34, 34], fisc: [0.73, 0.07],
    notes: '唐沙州贡棋子、黄矾、石膏。'
  })
};

const HEISHUI = {
  黑水城: block({
    name: '黑水城', divisionType: '城', officialPosition: '黑水镇燕监军使', terrain: '绿洲', regionType: 'frontier_defense',
    specialResources: '粟·马', taxLevel: '中', tags: { horseRegion: true },
    description: '居延海南、黑水（额济纳河）下游的黑水城，西夏置黑水镇燕监军司，引河屯田，北控漠北诸部。',
    idx: [46, 28, 32, 32, 24, 44, 42, 34], fisc: [0.73, 0.07],
    notes: '十二监军司之「黑水镇燕」。'
  }),
  兀剌海: block({
    name: '兀剌海', divisionType: '城', officialPosition: '黑山威福监军使', terrain: '草原', regionType: 'frontier_defense',
    specialResources: '马·羊·驼', taxLevel: '轻', tags: { horseRegion: true },
    description: '阴山以西、狼山（午腊蒻山）一带，西夏置黑山威福监军司，北备辽金，党项与阻卜诸部游牧其间。',
    idx: [46, 28, 30, 30, 24, 42, 44, 34], fisc: [0.73, 0.07],
    notes: '十二监军司之「黑山威福」。'
  }),
  贺兰山西麓: block({
    name: '贺兰山西麓', divisionType: '部', officialPosition: '右厢朝顺监军使', terrain: '荒漠', regionType: 'tribal_frontier',
    specialResources: '马·羊·驼', taxLevel: '轻', tags: { horseRegion: true },
    description: '贺兰山以西、腾格里沙漠东缘的牧地，诸部游牧；右厢朝顺监军司驻贺兰山，扼兴庆府西路。',
    idx: [46, 28, 30, 30, 24, 42, 40, 34], fisc: [0.73, 0.07],
    notes: '十二监军司之「右厢朝顺」。'
  })
};

module.exports = foreignTree({
  treeKey: 'fac_xixia',
  idPrefix: 'div_ss_xx_',
  faction: '大夏',
  treeLabel: '大夏行政树去掉「大夏」国号节点（甘、肃、瓜三州原账各拆两笔核算项，并回一块），',
  reportNotes: [
    '户数：西夏兵民合一（《宋史·夏国传》「率二丁取正军一人」），按卷四百八十五元昊时各地兵额分区，区内按《新唐书·地理志》天宝口数分州；势力全国合计不动。'
  ],
  leaves: LEAVES,
  circuits: [
    {
      name: '兴灵地区',
      frame: {
        name: '兴灵地区', officialPosition: '兴庆府尹', capital: '兴庆府',
        terrain: '平原', specialResources: '稻麦·盐·甘草', taxLevel: '中',
        description: '西夏根本之地，兴庆府与西平府（灵州）夹河相望，唐来、汉源诸渠灌田，京畿屯田与宿卫诸军皆在于此。',
        strategicValue: '国都所在，粮赋与宿卫兵源所出。', threats: ['宋泾原路出兵北上'],
        flee: 1.0, hide: 1.0, textile: 0.8
      },
      blocks: XINGLING,
      regionMeans: { development: 42.55, unrest: 24, taxBurden: 44.49, armyPressure: 44.85 }
    },
    {
      name: '夏宥盐州',
      frame: {
        name: '夏宥盐州', officialPosition: '左厢宥州路统军', capital: '夏州',
        terrain: '草原', specialResources: '青白盐·马·毡', taxLevel: '中',
        description: '横山以北、毛乌素沙地南缘的夏、宥、盐三州，拓跋李氏故地；左厢宥州路兵备宋鄜延、麟府，盐州青白盐为国之大利。',
        strategicValue: '对宋东南一线，横山之争的后方。', threats: ['宋鄜延、环庆二路'],
        flee: 1.0, hide: 1.1, textile: 0.6
      },
      blocks: XIAYOUYAN,
      regionMeans: { development: 30.61, unrest: 24, taxBurden: 45.31, armyPressure: 51 }
    },
    {
      name: '河西走廊',
      frame: {
        name: '河西走廊', officialPosition: '右厢甘州路统军', capital: '西凉府',
        terrain: '绿洲', specialResources: '麝香·矾·马', taxLevel: '中',
        description: '凉、甘、肃、瓜、沙五州绿洲相连，景祐间元昊逐回鹘、归义军余部而有之；右厢甘州路兵备西蕃、回鹘。',
        strategicValue: '东西商道所经，西夏之右臂。', threats: ['西州回鹘', '青唐吐蕃'],
        flee: 1.0, hide: 1.1, textile: 0.7
      },
      blocks: HEXI_BLOCKS,
      regionMeans: { development: 30.73, unrest: 21.73, taxBurden: 42.03, armyPressure: 35.17 }
    },
    {
      name: '黑水—贺兰',
      frame: {
        name: '黑水—贺兰', officialPosition: '黑水镇燕监军使', capital: '黑水城',
        terrain: '荒漠', specialResources: '马·驼·羊', taxLevel: '轻',
        description: '贺兰山以西、阴山以西至居延海的漠南之地，黑水镇燕、黑山威福诸监军司分驻，以备辽金与漠北诸部。',
        strategicValue: '北面屏障。', threats: ['金', '漠北诸部'],
        flee: 1.0, hide: 1.3, textile: 0.5
      },
      blocks: HEISHUI,
      regionMeans: { development: 31.15, unrest: 24, taxBurden: 43.24, armyPressure: 41.92 }
    }
  ]
});
