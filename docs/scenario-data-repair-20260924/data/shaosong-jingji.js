// 绍宋·京畿路：开封府与另成地块的五个畿县。户数、商税、田亩、两税权重见 shaosong-sources.js，这里写定性字段。
// 五县宋时名：陈留、雍丘（地块名杞县为金人后改）、尉氏、延津（政和七年由酸枣改名）、封丘；镇市山川据《元丰九域志》。
'use strict';

const { songBlock: block, circuitModule } = require('./shaosong-common');

// idx：[民心, 吏治(贪腐), 繁荣, 发展, 不稳, 税压, 军压, 官风险]；fisc：[征到比例, 截留率]
// 原版各块同值：民心 46、贪腐 34、繁荣 62，地块发展 62、不稳 19、税压 58、军压 80。
const BLOCKS = {
  开封府: block({
    name: '开封府', divisionType: '府', officialPosition: '开封府尹', governor: '宗泽', terrain: '平原',
    specialResources: '汴河漕运·京师百货·方纹绫', taxLevel: '中',
    tags: { imperialDomain: true },
    description: '东京城所在，汴河、蔡河、五丈河、金水河四渠通漕，昔为天下商旅辐辏之地。靖康二年城破，金人括取金帛、掳二帝与宗室北去，城中饥疫相继；宗泽以东京留守兼开封尹修城募兵，招集流散。',
    idx: [42, 32, 60, 62, 22, 55, 88, 40], fisc: [0.70, 0.08], keju: 2.0, corridor: 1.6, flee: 1.4,
    notes: '赤县开封、祥符并京城，陈桥驿在祥符。兵祸之后贩货入京免税，税级不作重。绫锦院工匠靖康二年多为金人掳去，官营织造不记。宗泽为东京留守兼开封尹，写 governor。'
  }),
  陈留县: block({
    name: '陈留县', divisionType: '县', officialPosition: '知陈留县', terrain: '平原',
    specialResources: '粮·汴河漕运', taxLevel: '中',
    tags: {},
    description: '开封以东五十二里，汴河、睢沟所经，东出京城第一县，县境有北南、城西、城南、城东、河口、萧馆等七镇。',
    idx: [46, 34, 60, 60, 20, 58, 80, 35], fisc: [0.71, 0.08],
    notes: '九域志：四乡、七镇，有皇柏山、狼丘、汴河、睢沟。'
  }),
  杞县: block({
    name: '杞县', divisionType: '县', officialPosition: '知雍丘县', terrain: '平原',
    specialResources: '粮·汴河漕运', taxLevel: '中',
    tags: {},
    description: '宋称雍丘县，古杞国之地，开封以东八十七里，汴河所经，有圉城镇。',
    idx: [48, 34, 60, 60, 18, 58, 78, 35], fisc: [0.71, 0.08],
    notes: '地块名杞县为金人后改；宋时县名雍丘，官称按宋制写知雍丘县。九域志：七乡。'
  }),
  尉氏县: block({
    name: '尉氏县', divisionType: '县', officialPosition: '知尉氏县', terrain: '平原',
    specialResources: '粮·惠民河漕运', taxLevel: '中',
    tags: {},
    description: '开封以南九十里，惠民河所经，有朱家曲、宋楼、卢馆三镇，南通颍昌、蔡州。',
    idx: [48, 34, 62, 62, 18, 58, 76, 35], fisc: [0.71, 0.08],
    notes: '九域志：八乡，畿县中乡数最多者之一。'
  }),
  酸枣县: block({
    name: '酸枣县', divisionType: '县', officialPosition: '知延津县', terrain: '平原',
    specialResources: '粮·酸枣仁', taxLevel: '中',
    tags: {},
    description: '旧酸枣县，政和七年改名延津，开封西北九十里，南临黄河，金堤在境，为京城北面河防所系。',
    idx: [45, 34, 56, 58, 22, 56, 84, 35], fisc: [0.71, 0.08],
    notes: '九域志：五乡，有土山、黄河、金堤；开封府土贡酸枣仁即出此。官称按政和后县名。'
  }),
  封丘县: block({
    name: '封丘县', divisionType: '县', officialPosition: '知封丘县', terrain: '平原',
    specialResources: '粮', taxLevel: '中',
    tags: {},
    description: '开封以北六十里，南临黄河，有黑山、白沟河与黄池，为京城北渡黄河的门户之一。',
    idx: [45, 34, 58, 58, 22, 56, 84, 35], fisc: [0.71, 0.08],
    notes: '九域志：六乡，有黑山、白沟河、黄池、封丘台。'
  })
};

module.exports = circuitModule('京畿路', {
  BLOCKS,
  regionMeans: { development: 62, unrest: 19, taxBurden: 58, armyPressure: 80 }
});
