// 绍宋·江南东路、江南西路。户数、商税、田亩、两税权重见 shaosong-sources.js，这里写定性字段。
// 建置据《宋史·地理志》：江宁府「旧领江南东路兵马钤辖，建炎元年，为帅府」；洪州「旧领江南西路兵马钤辖」，安抚在绍兴后；
// 江州「旧隶江南东路，建炎元年，陞定江军节度」（地图归江南西路，依地图）。
'use strict';

const { songBlock: block, circuitModule } = require('./shaosong-common');

// idx：[民心, 吏治(贪腐), 繁荣, 发展, 不稳, 税压, 军压, 官风险]；fisc：[征到比例, 截留率]
const EAST = {
  江宁府: block({
    name: '江宁府', divisionType: '府', officialPosition: '知江宁府', terrain: '丘陵',
    specialResources: '稻米·丝织·漕运', taxLevel: '重',
    tags: { fishingRegion: true },
    description: '六朝旧都，天禧二年升建康军节度；建炎元年为帅府，江南东路安抚使驻此。上元、江宁二县附郭，扼长江下游。',
    idx: [56, 28, 74, 74, 20, 72, 56, 38], fisc: [0.77, 0.07], keju: 1.3, corridor: 1.4,
    notes: '一路帅府；建炎三年方改建康府。'
  }),
  宣州: block({
    name: '宣州', divisionType: '州', officialPosition: '知宣州', terrain: '丘陵',
    specialResources: '宣纸·笔·纻布·稻米', taxLevel: '中',
    tags: {},
    description: '宣城郡，宁国军节度，宣城、南陵、宁国、旌德、太平、泾六县，造纸制笔闻名，土贡纻布、黄连笔。',
    idx: [58, 28, 72, 72, 18, 72, 48, 34], fisc: [0.77, 0.07], textile: 1.2,
    notes: '志中标题宁国府（乾道二年升）。户十四万余。'
  }),
  太平州: block({
    name: '太平州', divisionType: '州', officialPosition: '知太平州', terrain: '水乡',
    specialResources: '稻米·纱·鱼', taxLevel: '中',
    tags: { fishingRegion: true },
    description: '当涂、芜湖、繁昌三县，采石矶在当涂，为长江渡口要地；土贡纱。',
    idx: [58, 28, 70, 70, 18, 70, 56, 34], fisc: [0.77, 0.07],
    notes: '采石渡口，江防军压略高。'
  }),
  池州: block({
    name: '池州', divisionType: '州', officialPosition: '知池州', terrain: '山地',
    specialResources: '铸钱·茶·纸', taxLevel: '中',
    tags: { mineralRegion: true, fishingRegion: true },
    description: '池阳郡，贵池、青阳、建德、石埭、东流诸县，九华山在青阳；永丰监铸钱。',
    idx: [58, 28, 66, 66, 18, 70, 48, 34], fisc: [0.77, 0.07],
    notes: '永丰监为铸钱监，不记官营矿场。'
  }),
  饶州: block({
    name: '饶州', divisionType: '州', officialPosition: '知饶州', terrain: '丘陵',
    specialResources: '瓷器·银·铜·麸金·竹簟', taxLevel: '中',
    tags: { mineralRegion: true, fishingRegion: true },
    description: '鄱阳郡，鄱阳湖东岸，七县；浮梁县景德镇烧瓷，德兴产银铜，永平监铸钱，土贡麸金、竹簟。',
    idx: [58, 28, 72, 72, 18, 72, 48, 36], fisc: [0.77, 0.07], kuangchang: 1,
    notes: '德兴银铜场为官营坑冶，记官营矿场一处。户十八万余，江东最多。'
  }),
  信州: block({
    name: '信州', divisionType: '州', officialPosition: '知信州', terrain: '丘陵',
    specialResources: '铜·蜜·葛粉·水晶器', taxLevel: '中',
    tags: { mineralRegion: true },
    description: '上饶郡，上饶、玉山、弋阳、贵溪、铅山、永丰六县；铅山场以胆水浸铁取铜，产铜为东南之冠，土贡蜜、葛粉、水晶器。',
    idx: [58, 28, 70, 70, 18, 70, 46, 34], fisc: [0.77, 0.07], kuangchang: 1,
    notes: '铅山场胆铜，记官营矿场一处。'
  }),
  徽州: block({
    name: '徽州', divisionType: '州', officialPosition: '知徽州', terrain: '山地',
    specialResources: '歙砚·徽墨·纸·茶·漆', taxLevel: '中',
    tags: {},
    description: '旧歙州，宣和三年平方腊后改名徽州；六县皆山，歙砚、徽墨、澄心堂纸闻名。方腊之乱曾陷歙州。',
    idx: [54, 28, 64, 64, 22, 68, 46, 34], fisc: [0.76, 0.07], keju: 1.2, flee: 1.3,
    notes: '方腊所陷六州之一。'
  }),
  广德军: block({
    name: '广德军', divisionType: '军', officialPosition: '知广德军', terrain: '丘陵',
    specialResources: '茶·粮', taxLevel: '中',
    tags: {},
    description: '太平兴国四年以宣州广德县建军，领广德、建平二县，土贡茶芽。',
    idx: [58, 28, 66, 66, 18, 68, 46, 32], fisc: [0.77, 0.07],
    notes: '二县皆望县。'
  }),
  南康军: block({
    name: '南康军', divisionType: '军', officialPosition: '知南康军', terrain: '水乡',
    specialResources: '茶·鱼·粮', taxLevel: '中',
    tags: { fishingRegion: true },
    description: '太平兴国七年以江州星子县建军，领星子、都昌、建昌三县，庐山在境，濒鄱阳湖；土贡茶芽。',
    idx: [58, 28, 66, 66, 18, 68, 48, 32], fisc: [0.77, 0.07],
    notes: '志载本隶西路，绍兴初来属；地图归江南东路。'
  })
};

const WEST = {
  洪州: block({
    name: '洪州', divisionType: '州', officialPosition: '知洪州', terrain: '水乡',
    specialResources: '稻米·纸·茶', taxLevel: '中',
    tags: { fishingRegion: true },
    description: '豫章郡，镇南军节度，旧领江南西路兵马钤辖；赣江下游，南昌、新建附郭，领八县。',
    idx: [58, 28, 66, 66, 14, 62, 48, 36], fisc: [0.77, 0.07], keju: 1.2, corridor: 1.3,
    notes: '志中标题隆兴府（隆兴三年升）。一路治所。'
  }),
  江州: block({
    name: '江州', divisionType: '州', officialPosition: '知江州', terrain: '丘陵',
    specialResources: '稻米·茶·鱼', taxLevel: '中',
    tags: { fishingRegion: true },
    description: '浔阳郡，建炎元年升定江军节度；长江与鄱阳湖交汇，湖口为江防要地，庐山北麓。',
    idx: [58, 28, 64, 64, 14, 60, 54, 34], fisc: [0.77, 0.07],
    notes: '江湖之交，军压略高。'
  }),
  抚州: block({
    name: '抚州', divisionType: '州', officialPosition: '知抚州', terrain: '丘陵',
    specialResources: '稻米·葛·纸', taxLevel: '中',
    tags: {},
    description: '临川郡，临川、崇仁、宜黄、金溪、乐安诸县，王安石、晏殊故里，土贡葛。',
    idx: [60, 28, 64, 64, 12, 62, 44, 34], fisc: [0.77, 0.07], keju: 1.3,
    notes: '科第之乡，解额权重略高。'
  }),
  袁州: block({
    name: '袁州', divisionType: '州', officialPosition: '知袁州', terrain: '丘陵',
    specialResources: '纻布·稻米', taxLevel: '中',
    tags: {},
    description: '宜春郡，宜春、分宜、萍乡、万载四县，袁水所经，土贡纻布。',
    idx: [60, 28, 60, 60, 14, 60, 44, 34], fisc: [0.77, 0.07],
    notes: '四县，萍乡通湖南。'
  }),
  吉州: block({
    name: '吉州', divisionType: '州', officialPosition: '知吉州', terrain: '丘陵',
    specialResources: '稻米·纻布·葛·纸', taxLevel: '中',
    tags: {},
    description: '庐陵郡，八县皆望县，户三十三万余为江西之冠；欧阳修故里，读书科第之风甚盛。',
    idx: [60, 28, 66, 66, 12, 62, 44, 34], fisc: [0.77, 0.07], keju: 1.5,
    notes: '户数江西第一。'
  }),
  虔州: block({
    name: '虔州', divisionType: '州', officialPosition: '知虔州', terrain: '山地',
    specialResources: '稻米·木材·银', taxLevel: '中',
    tags: {},
    description: '南康郡，昭信军节度，十县，赣江上游，山深林密，私盐贩与盗寇出没，号称难治。',
    idx: [52, 30, 56, 56, 22, 58, 48, 38], fisc: [0.74, 0.08], flee: 1.3, hide: 1.3,
    notes: '志中标题赣州（绍兴二十三年改）。盐寇难治，不稳、隐户略高。'
  }),
  筠州: block({
    name: '筠州', divisionType: '州', officialPosition: '知筠州', terrain: '丘陵',
    specialResources: '稻米·纻布', taxLevel: '中',
    tags: {},
    description: '高安、上高、新昌三县，锦江所经，土贡纻。',
    idx: [60, 28, 60, 60, 14, 60, 44, 34], fisc: [0.77, 0.07],
    notes: '志中标题瑞州（宝庆元年改）。'
  }),
  兴国军: block({
    name: '兴国军', divisionType: '军', officialPosition: '知兴国军', terrain: '丘陵',
    specialResources: '铁·铜·纻布', taxLevel: '中',
    tags: { mineralRegion: true, fishingRegion: true },
    description: '太平兴国二年以鄂州永兴县建军，领永兴、大冶、通山三县，濒大江；大冶产铁铜。',
    idx: [58, 28, 58, 58, 14, 60, 48, 34], fisc: [0.77, 0.07],
    notes: '大冶铁冶。'
  }),
  临江军: block({
    name: '临江军', divisionType: '军', officialPosition: '知临江军', terrain: '丘陵',
    specialResources: '稻米·绢', taxLevel: '中',
    tags: {},
    description: '淳化三年以筠州清江县建军，领清江、新淦、新喻三县，赣江与袁水交汇，土贡绢。',
    idx: [60, 28, 62, 62, 12, 60, 44, 34], fisc: [0.77, 0.07],
    notes: '赣袁交汇。'
  }),
  建昌军: block({
    name: '建昌军', divisionType: '军', officialPosition: '知建昌军', terrain: '丘陵',
    specialResources: '稻米·绢', taxLevel: '中',
    tags: {},
    description: '旧建武军，太平兴国四年改名，领南城、南丰等县；曾巩、李觏故里。',
    idx: [60, 28, 62, 62, 12, 60, 44, 34], fisc: [0.77, 0.07], keju: 1.3,
    notes: '户十一万余。'
  }),
  南安军: block({
    name: '南安军', divisionType: '军', officialPosition: '知南安军', terrain: '山地',
    specialResources: '纻布·木材', taxLevel: '轻',
    tags: {},
    description: '淳化元年以虔州大庾县建军，领南康、大庾、上犹三县；大庾岭梅关为岭南入江西之要道。',
    idx: [58, 28, 54, 54, 16, 56, 48, 34], fisc: [0.77, 0.07], corridor: 1.3,
    notes: '岭南北上驿路。'
  })
};

module.exports = [
  circuitModule('江南东路', { BLOCKS: EAST, regionMeans: { development: 70, unrest: 19, taxBurden: 71, armyPressure: 50 } }),
  circuitModule('江南西路', { BLOCKS: WEST, regionMeans: { development: 62, unrest: 14, taxBurden: 61, armyPressure: 46 } })
];
