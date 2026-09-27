// 绍宋·淮南东路、淮南西路。户数、商税、田亩、两税权重见 shaosong-sources.js，这里写定性字段。
// 建置据《宋史·地理志》：扬州「建炎元年，陞帅府」；庐州「旧领淮南西路兵马钤辖，建炎二年兼本路安抚使」。
'use strict';

const { songBlock: block, circuitModule } = require('./shaosong-common');

// idx：[民心, 吏治(贪腐), 繁荣, 发展, 不稳, 税压, 军压, 官风险]；fisc：[征到比例, 截留率]
// 两路原版各块同值：民心 46、贪腐 34、繁荣 45，地块发展 45、不稳 24、税压 42、军压 82。
const EAST = {
  亳州: block({
    name: '亳州', divisionType: '州', officialPosition: '知亳州', terrain: '平原',
    specialResources: '绉纱·绢·粮', taxLevel: '中',
    tags: {},
    description: '谯郡，集庆军节度，七县皆望县；老子故里，卫真县太清宫为真宗亲谒之地，土贡绉纱、绢。',
    idx: [46, 34, 48, 48, 22, 44, 82, 36], fisc: [0.71, 0.08], textile: 1.2,
    notes: '鹿邑、蒙城二县已另成地块。'
  }),
  鹿邑县: block({
    name: '鹿邑县', divisionType: '县', officialPosition: '知鹿邑县', terrain: '平原',
    specialResources: '粮', taxLevel: '中',
    tags: {},
    description: '亳州西部属县，西与开封府太康相接，有郸城镇。',
    idx: [46, 34, 44, 44, 22, 42, 80, 34], fisc: [0.71, 0.08],
    notes: '九域志：六乡、郸城一镇。'
  }),
  蒙城县: block({
    name: '蒙城县', divisionType: '县', officialPosition: '知蒙城县', terrain: '平原',
    specialResources: '粮', taxLevel: '中',
    tags: {},
    description: '亳州南部属县，涡水所经，南近淮水。',
    idx: [46, 34, 44, 44, 22, 42, 80, 34], fisc: [0.71, 0.08],
    notes: '九域志：七乡。'
  }),
  宿州: block({
    name: '宿州', divisionType: '州', officialPosition: '知宿州', terrain: '平原',
    specialResources: '绢·粮·漕运', taxLevel: '中',
    tags: {},
    description: '符离郡，保静军节度，汴河纵贯州境，符离、蕲、临涣、灵璧四县，东南漕船北上必经之地。',
    idx: [46, 34, 46, 46, 22, 44, 82, 36], fisc: [0.71, 0.08], corridor: 1.4,
    notes: '汴河漕路所经，驿路系数略高。'
  }),
  泗州: block({
    name: '泗州', divisionType: '州', officialPosition: '知泗州', terrain: '水乡',
    specialResources: '漕运·鱼·粮', taxLevel: '中',
    tags: { fishingRegion: true },
    description: '临淮郡，汴河入淮之口，漕运咽喉；城中普照王寺僧伽塔香火极盛。',
    idx: [48, 34, 48, 48, 20, 44, 82, 36], fisc: [0.71, 0.08], corridor: 1.4,
    notes: '汴淮之交。'
  }),
  楚州: block({
    name: '楚州', divisionType: '州', officialPosition: '知楚州', terrain: '水乡',
    specialResources: '淮盐·漕运·鱼·粮', taxLevel: '重',
    tags: { saltRegion: true, fishingRegion: true },
    description: '山阳郡，运河与淮水交汇之处，盐城监煮海为盐，为淮东盐利所出。',
    idx: [48, 34, 50, 50, 20, 46, 82, 36], fisc: [0.71, 0.08], corridor: 1.3,
    notes: '盐城监。'
  }),
  海州: block({
    name: '海州', divisionType: '州', officialPosition: '知海州', terrain: '沿海',
    specialResources: '海盐·鱼·粮', taxLevel: '中',
    tags: { saltRegion: true, fishingRegion: true },
    description: '东海郡，朐山、怀仁、沭阳、东海四县，濒海有盐场，海道北通山东。',
    idx: [46, 34, 44, 44, 22, 42, 82, 34], fisc: [0.71, 0.08],
    notes: '志载建炎间入金、绍兴七年复，建炎元年八月仍属宋。'
  }),
  涟水军: block({
    name: '涟水军', divisionType: '军', officialPosition: '知涟水军', terrain: '水乡',
    specialResources: '海盐·粮·鱼', taxLevel: '中',
    tags: { saltRegion: true, fishingRegion: true },
    description: '泗州涟水县地，太平兴国三年建军，熙宁五年废为县，元祐二年复置；濒淮近海，米盐所出。',
    idx: [46, 34, 44, 44, 22, 42, 80, 34], fisc: [0.71, 0.08],
    notes: '志中标题安东州（后改名）。'
  }),
  高邮军: block({
    name: '高邮军', divisionType: '军', officialPosition: '知高邮军', terrain: '水乡',
    specialResources: '稻米·鱼·漕运', taxLevel: '中',
    tags: { fishingRegion: true },
    description: '扬州高邮县地，开宝四年建军，领高邮、兴化二县，运河东岸湖荡连片；秦观故里。',
    idx: [48, 34, 48, 48, 20, 44, 80, 34], fisc: [0.71, 0.08],
    notes: '熙宁五年废为县，元祐元年复为军。'
  }),
  扬州: block({
    name: '扬州', divisionType: '州', officialPosition: '知扬州', terrain: '水乡',
    specialResources: '漕运·淮盐·漆器·粮', taxLevel: '重',
    tags: { fishingRegion: true },
    description: '广陵郡，淮南节度，运河与长江交汇，东南漕运枢纽；建炎元年升帅府，淮南东路安抚使驻此。',
    idx: [50, 34, 54, 54, 18, 46, 84, 38], fisc: [0.72, 0.08], keju: 1.3, corridor: 1.5,
    notes: '一路帅府；原账误作五千余口，按崇宁户重分。'
  }),
  泰州: block({
    name: '泰州', divisionType: '州', officialPosition: '知泰州', terrain: '沿海',
    specialResources: '淮盐·粮', taxLevel: '重',
    tags: { saltRegion: true, fishingRegion: true },
    description: '海陵郡，海陵、如皋诸县濒海，盐场密布，为淮南盐课之大宗。',
    idx: [48, 34, 48, 48, 20, 46, 80, 34], fisc: [0.71, 0.08],
    notes: '淮南盐场。'
  }),
  通州: block({
    name: '通州', divisionType: '州', officialPosition: '知通州', terrain: '沿海',
    specialResources: '海盐·鱼·獐皮', taxLevel: '中',
    tags: { saltRegion: true, fishingRegion: true },
    description: '静海郡，长江入海口北岸，静海、海门二县与利丰监，煮海为盐。',
    idx: [48, 32, 44, 44, 20, 42, 78, 34], fisc: [0.71, 0.08],
    notes: '土贡獐皮、鹿皮、鳔胶。'
  }),
  真州: block({
    name: '真州', divisionType: '州', officialPosition: '知真州', terrain: '水乡',
    specialResources: '漕运·淮盐转般', taxLevel: '中',
    tags: { fishingRegion: true },
    description: '仪真郡，长江北岸，东南漕船与盐船在此转般，江淮荆浙发运司驻此，为江淮转运要地。',
    idx: [50, 36, 52, 52, 18, 46, 80, 38], fisc: [0.71, 0.09], corridor: 1.5,
    notes: '发运司所在，经手钱粮多，贪腐略高。'
  }),
  滁州: block({
    name: '滁州', divisionType: '州', officialPosition: '知滁州', terrain: '丘陵',
    specialResources: '绢·粮·茶', taxLevel: '中',
    tags: {},
    description: '永阳郡，清流、全椒、来安三县，琅琊山在境；欧阳修知滁州时作《醉翁亭记》。',
    idx: [48, 32, 44, 44, 20, 42, 78, 34], fisc: [0.71, 0.08],
    notes: '土贡绢。'
  })
};

const WEST = {
  寿春府: block({
    name: '寿春府', divisionType: '府', officialPosition: '知寿春府', terrain: '平原',
    specialResources: '粮·鱼·茶', taxLevel: '中',
    tags: { fishingRegion: true },
    description: '本寿州，忠正军节度，政和六年升府；淮水南岸，下蔡、安丰、霍丘、寿春四县，安丰芍陂灌溉之利由来已久。',
    idx: [48, 34, 46, 46, 22, 44, 84, 36], fisc: [0.71, 0.08],
    notes: '六安县已另成六安军地块。'
  }),
  庐州: block({
    name: '庐州', divisionType: '州', officialPosition: '知庐州', terrain: '丘陵',
    specialResources: '粮·鱼·茶', taxLevel: '中',
    tags: { fishingRegion: true },
    description: '保信军节度，巢湖之滨，合肥为淮西重镇，旧领淮南西路兵马钤辖。',
    idx: [48, 34, 48, 48, 20, 44, 84, 38], fisc: [0.71, 0.08], corridor: 1.3,
    notes: '建炎二年方兼淮南西路安抚使。'
  }),
  濠州: block({
    name: '濠州', divisionType: '州', officialPosition: '知濠州', terrain: '丘陵',
    specialResources: '绢·糟鱼·粮', taxLevel: '中',
    tags: { fishingRegion: true },
    description: '钟离郡，钟离、定远二县，淮水之南，土贡绢、糟鱼。',
    idx: [46, 34, 44, 44, 22, 42, 82, 34], fisc: [0.71, 0.08],
    notes: '淮南岸。'
  }),
  和州: block({
    name: '和州', divisionType: '州', officialPosition: '知和州', terrain: '丘陵',
    specialResources: '苎布·练布·粮', taxLevel: '中',
    tags: { fishingRegion: true },
    description: '历阳郡，历阳、含山、乌江三县，隔江与太平州、江宁府相对；乌江为项羽自刎之地。',
    idx: [48, 32, 44, 44, 20, 42, 80, 34], fisc: [0.71, 0.08],
    notes: '江防渡口。'
  }),
  舒州: block({
    name: '舒州', divisionType: '州', officialPosition: '知舒州', terrain: '山地',
    specialResources: '茶·粮', taxLevel: '中',
    tags: {},
    description: '同安郡，政和五年赐德庆军额，怀宁、桐城、宿松、望江、太湖五县，大别山南麓产茶。',
    idx: [48, 34, 44, 44, 20, 42, 76, 34], fisc: [0.71, 0.08],
    notes: '志中标题安庆府（后改名）。淮南茶场之一。'
  }),
  蕲州: block({
    name: '蕲州', divisionType: '州', officialPosition: '知蕲州', terrain: '山地',
    specialResources: '茶·苎布·竹簟', taxLevel: '中',
    tags: { fishingRegion: true },
    description: '蕲春郡，蕲春、蕲水、广济、黄梅、罗田五县，大江北岸，山场产茶，土贡苎布、竹簟。',
    idx: [48, 34, 46, 46, 22, 42, 76, 34], fisc: [0.71, 0.08],
    notes: '户十一万余。'
  }),
  黄州: block({
    name: '黄州', divisionType: '州', officialPosition: '知黄州', terrain: '丘陵',
    specialResources: '苎布·连翘·鱼', taxLevel: '中',
    tags: { fishingRegion: true },
    description: '齐安郡，黄冈、黄陂、麻城三县，大江北岸；苏轼谪居于此，作赤壁二赋。',
    idx: [48, 32, 44, 44, 20, 42, 74, 34], fisc: [0.71, 0.08],
    notes: '土贡苎布、连翘。'
  }),
  光州: block({
    name: '光州', divisionType: '州', officialPosition: '知光州', terrain: '丘陵',
    specialResources: '茶·粮', taxLevel: '中',
    tags: {},
    description: '弋阳郡，宣和元年赐光山军节度，定城、固始、光山、仙居四县，大别山北麓产茶。',
    idx: [46, 34, 42, 42, 22, 42, 78, 34], fisc: [0.71, 0.08],
    notes: '淮南茶场之一。'
  }),
  六安军: block({
    name: '六安军', divisionType: '军', officialPosition: '知六安军', terrain: '山地',
    specialResources: '茶·粮', taxLevel: '中',
    tags: {},
    description: '寿州六安县，政和八年建军；大别山北麓，茶场所在。',
    idx: [48, 34, 42, 42, 20, 42, 76, 34], fisc: [0.71, 0.08],
    notes: '九域志：六安七乡、十镇。'
  }),
  无为军: block({
    name: '无为军', divisionType: '军', officialPosition: '知无为军', terrain: '水乡',
    specialResources: '稻米·鱼', taxLevel: '中',
    tags: { fishingRegion: true },
    description: '太平兴国三年以庐州巢县无为镇建军，领无为、巢、庐江三县，濒江临湖，米谷之乡。',
    idx: [48, 32, 46, 46, 20, 42, 76, 34], fisc: [0.71, 0.08],
    notes: '濒江临巢湖。'
  })
};

module.exports = [
  circuitModule('淮南东路', { BLOCKS: EAST, regionMeans: { development: 45, unrest: 24, taxBurden: 42, armyPressure: 82 } }),
  circuitModule('淮南西路', { BLOCKS: WEST, regionMeans: { development: 45, unrest: 24, taxBurden: 42, armyPressure: 82 } })
];
