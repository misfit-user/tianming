// 绍宋·成都府路、潼川府路。户数、商税（铁钱折铜钱 × 0.1）、田亩、两税权重见 shaosong-sources.js，这里写定性字段。
// 成都府「旧领成都府路兵马钤辖，绍兴元年领成都路安抚使」；泸州「乾道六年陞本路安抚使」，此前泸南安抚司只辖沿边。
'use strict';

const { songBlock: block, circuitModule } = require('./shaosong-common');

// idx：[民心, 吏治(贪腐), 繁荣, 发展, 不稳, 税压, 军压, 官风险]；fisc：[征到比例, 截留率]
const CHENGDU = {
  成都府: block({
    name: '成都府', divisionType: '府', officialPosition: '知成都府', terrain: '盆地',
    specialResources: '蜀锦·茶·交子·药材', taxLevel: '重',
    tags: {},
    description: '蜀郡，剑南西川节度，锦官城；交子务与茶马司在此，领成都、华阳等九县。元丰六年置锦院，官织蜀锦。',
    idx: [58, 30, 80, 80, 18, 66, 36, 38], fisc: [0.77, 0.07], keju: 1.5, zhizao: 1, corridor: 1.4,
    notes: '元丰六年成都府锦院为官营织造，记一处。'
  }),
  汉州: block({
    name: '汉州', divisionType: '州', officialPosition: '知汉州', terrain: '盆地',
    specialResources: '纻布·粮', taxLevel: '中',
    tags: {},
    description: '德阳郡，雒、什邡、绵竹、德阳四县皆望县，成都平原北部，土贡纻布。',
    idx: [58, 28, 76, 76, 18, 64, 34, 34], fisc: [0.77, 0.07],
    notes: '户十二万余。'
  }),
  彭州: block({
    name: '彭州', divisionType: '州', officialPosition: '知彭州', terrain: '盆地',
    specialResources: '罗·牡丹·药材', taxLevel: '中',
    tags: {},
    description: '濛阳郡，九陇、崇宁、蒙阳三县，土贡罗；天彭牡丹名重蜀中。',
    idx: [58, 28, 74, 74, 18, 64, 34, 34], fisc: [0.77, 0.07], textile: 1.3,
    notes: '三县皆望县。'
  }),
  蜀州: block({
    name: '蜀州', divisionType: '州', officialPosition: '知蜀州', terrain: '盆地',
    specialResources: '粮·丝织', taxLevel: '中',
    tags: {},
    description: '唐安郡，晋源、新津、江原、永康四县，成都平原西南部。',
    idx: [58, 28, 74, 74, 18, 64, 34, 34], fisc: [0.77, 0.07],
    notes: '志中标题崇庆府（淳熙四年升）。'
  }),
  邛州: block({
    name: '邛州', divisionType: '州', officialPosition: '知邛州', terrain: '丘陵',
    specialResources: '井盐·丝布·茶·铁', taxLevel: '中',
    tags: { saltRegion: true, mineralRegion: true },
    description: '临邛郡，临邛、依政、安仁、大邑、蒲江、火井六县；火井县以地出火井得名，蒲江有盐井，土贡丝布。',
    idx: [58, 28, 70, 70, 18, 62, 36, 34], fisc: [0.77, 0.07],
    notes: '盐井、铁冶。'
  }),
  眉州: block({
    name: '眉州', divisionType: '州', officialPosition: '知眉州', terrain: '丘陵',
    specialResources: '麸金·巴豆·纸', taxLevel: '中',
    tags: { mineralRegion: true },
    description: '通义郡，眉山、彭山、丹棱、青神四县，三苏故里，读书之风甚盛，土贡麸金、巴豆。',
    idx: [60, 28, 72, 72, 16, 62, 34, 34], fisc: [0.77, 0.07], keju: 1.6,
    notes: '科第之乡。'
  }),
  嘉州: block({
    name: '嘉州', divisionType: '州', officialPosition: '知嘉州', terrain: '山地',
    specialResources: '井盐·茶·麸金', taxLevel: '中',
    tags: { saltRegion: true },
    description: '犍为郡，龙游、洪雅、夹江、峨眉、犍为诸县，峨眉山在境，凌云大佛临三江之会；犍为有盐井。',
    idx: [58, 28, 52, 50, 14, 56, 40, 34], fisc: [0.77, 0.07],
    notes: '志中标题嘉定府（庆元二年升）。'
  }),
  雅州: block({
    name: '雅州', divisionType: '州', officialPosition: '知雅州', terrain: '山地',
    specialResources: '茶·麸金', taxLevel: '中',
    tags: { mineralRegion: true },
    description: '卢山郡，严道、卢山、名山、荣经、百丈五县；名山县茶专供博马，西通吐蕃诸部，土贡麸金。',
    idx: [58, 28, 50, 48, 16, 56, 42, 34], fisc: [0.77, 0.07],
    notes: '茶马之茶所出。'
  }),
  黎州: block({
    name: '黎州', divisionType: '州', officialPosition: '知黎州', terrain: '山地', regionType: 'frontier_defense',
    specialResources: '红椒·马', taxLevel: '轻',
    tags: { horseRegion: true },
    description: '汉源郡，领汉源一县，大渡河外即大理与诸蛮部；太祖以玉斧划大渡河为界之说出于此，黎州市马于诸蛮。',
    idx: [56, 28, 42, 40, 18, 50, 48, 34], fisc: [0.76, 0.07], hide: 1.4,
    notes: '崇宁户仅二千余；边州，市马。'
  }),
  茂州: block({
    name: '茂州', divisionType: '州', officialPosition: '知茂州', terrain: '山地', regionType: 'frontier_defense',
    specialResources: '麝香·药材', taxLevel: '轻',
    tags: {},
    description: '通化郡，汶山、汶川二县与诸砦，岷江上游羌地，崇宁户仅五百余，土贡麝香。',
    idx: [54, 28, 40, 40, 22, 50, 46, 34], fisc: [0.74, 0.07], hide: 2.0,
    notes: '原账误作七十三万口，按志中五百余户重分；羌地隐户多。'
  }),
  威州: block({
    name: '威州', divisionType: '州', officialPosition: '知威州', terrain: '山地', regionType: 'frontier_defense',
    specialResources: '当归·羌活·麝香', taxLevel: '轻',
    tags: {},
    description: '维川郡，本维州，景祐三年以与潍州音近改名，保宁、通化二县，羌戎杂处，土贡当归、羌活。',
    idx: [54, 28, 40, 40, 22, 50, 46, 34], fisc: [0.74, 0.07], hide: 2.0,
    notes: '原账误作二百二十一万口，按志中二千余户重分。'
  }),
  永康军: block({
    name: '永康军', divisionType: '军', officialPosition: '知永康军', terrain: '山地',
    specialResources: '茶·粮·水利', taxLevel: '中',
    tags: {},
    description: '本彭州导江县灌口镇，太平兴国三年改永康军，领导江、青城二县；都江堰在灌口，青城山在境。',
    idx: [60, 28, 72, 72, 16, 62, 34, 34], fisc: [0.77, 0.07],
    notes: '志无户数，按所领二县县等估户。'
  }),
  简州: block({
    name: '简州', divisionType: '州', officialPosition: '知简州', terrain: '丘陵',
    specialResources: '绵绸·麸金', taxLevel: '中',
    tags: { mineralRegion: true },
    description: '阳安郡，阳安、平泉二县，沱江所经，土贡绵绸、麸金。',
    idx: [58, 28, 68, 68, 18, 62, 34, 34], fisc: [0.77, 0.07],
    notes: '贡麸金。'
  }),
  绵州: block({
    name: '绵州', divisionType: '州', officialPosition: '知绵州', terrain: '丘陵',
    specialResources: '井盐·粮·绸', taxLevel: '中',
    tags: { saltRegion: true },
    description: '巴西郡，巴西、彰明、魏城、罗江、盐泉五县，涪江所经；彰明为李白故里，盐泉有盐井。',
    idx: [58, 28, 72, 72, 18, 62, 36, 34], fisc: [0.77, 0.07],
    notes: '盐泉县盐井。'
  }),
  石泉军: block({
    name: '石泉军', divisionType: '军', officialPosition: '知石泉军', terrain: '山地', regionType: 'frontier_defense',
    specialResources: '药材·木材', taxLevel: '轻',
    tags: {},
    description: '本绵州石泉县，政和七年建军，宣和三年降为军使，七年复军额；岷山东麓羌地，领石泉、神泉、龙安与九堡。',
    idx: [56, 28, 50, 50, 20, 54, 44, 34], fisc: [0.76, 0.07], hide: 1.6,
    notes: '志无户数，按所领三县县等估户（崇宁时三县户在绵州、蜀州数内，未扣除）。'
  }),
  仙井监: block({
    name: '仙井监', divisionType: '监', officialPosition: '知仙井监', terrain: '丘陵',
    specialResources: '井盐·粮', taxLevel: '中',
    tags: { saltRegion: true },
    description: '本陵州，熙宁五年废为陵井监，宣和四年改名仙井监，领仁寿、井研、贵平、籍诸县；陵井为蜀中名盐井。',
    idx: [58, 28, 66, 66, 18, 62, 34, 34], fisc: [0.77, 0.07],
    notes: '以盐井置监。'
  })
};

const TONGCHUAN = {
  潼川府: block({
    name: '潼川府', divisionType: '府', officialPosition: '知潼川府', terrain: '丘陵',
    specialResources: '井盐·绫·麻布', taxLevel: '中',
    tags: { saltRegion: true },
    description: '本梓州，剑南东川节度，重和元年升潼川府，领郪、中江、涪城、射洪、盐亭等十县，井盐遍布州境。',
    idx: [58, 28, 56, 56, 14, 58, 32, 36], fisc: [0.77, 0.07], keju: 1.3,
    notes: '一路治所，户十万余。'
  }),
  遂宁府: block({
    name: '遂宁府', divisionType: '府', officialPosition: '知遂宁府', terrain: '丘陵',
    specialResources: '糖霜·井盐·绸', taxLevel: '中',
    tags: { saltRegion: true },
    description: '本遂州，武信军节度，政和五年升府；小溪、蓬溪诸县，糖霜为天下之冠。',
    idx: [58, 28, 58, 58, 14, 58, 32, 34], fisc: [0.77, 0.07],
    notes: '遂宁糖霜。'
  }),
  果州: block({
    name: '果州', divisionType: '州', officialPosition: '知果州', terrain: '丘陵',
    specialResources: '丝绸·粮', taxLevel: '中',
    tags: {},
    description: '南充郡，南充、西充、流溪三县，嘉陵江中游，丝织兴盛。',
    idx: [58, 28, 54, 54, 14, 58, 32, 34], fisc: [0.77, 0.07], textile: 1.3,
    notes: '志中标题顺庆府（宝庆三年升）。'
  }),
  资州: block({
    name: '资州', divisionType: '州', officialPosition: '知资州', terrain: '丘陵',
    specialResources: '井盐·糖·粮', taxLevel: '中',
    tags: { saltRegion: true },
    description: '资阳郡，磐石、资阳、龙水、内江四县，沱江所经，盐井与蔗糖之利。',
    idx: [58, 28, 52, 52, 14, 56, 32, 34], fisc: [0.77, 0.07],
    notes: '盐井。'
  }),
  普州: block({
    name: '普州', divisionType: '州', officialPosition: '知普州', terrain: '丘陵',
    specialResources: '粮·井盐', taxLevel: '中',
    tags: { saltRegion: true },
    description: '安岳郡，安岳、安居、乐至三县，川中丘陵。',
    idx: [58, 28, 50, 50, 14, 56, 30, 34], fisc: [0.77, 0.07],
    notes: '川中丘陵。'
  }),
  泸州: block({
    name: '泸州', divisionType: '州', officialPosition: '知泸州', terrain: '丘陵', regionType: 'frontier_defense',
    specialResources: '井盐·荔枝·粮', taxLevel: '中',
    tags: { saltRegion: true, fishingRegion: true },
    description: '泸川郡，宣和元年赐泸川军额，泸川、江安、合江诸县与众多砦堡，泸南夷人杂居，泸南沿边安抚司驻此镇抚。',
    idx: [56, 28, 50, 50, 18, 54, 44, 36], fisc: [0.76, 0.07], hide: 1.3,
    notes: '沿边砦堡多，军压高。'
  }),
  叙州: block({
    name: '叙州', divisionType: '州', officialPosition: '知叙州', terrain: '山地', regionType: 'frontier_defense',
    specialResources: '荔枝·井盐·木材', taxLevel: '轻',
    tags: { saltRegion: true },
    description: '本戎州，政和四年改名叙州，宜宾、南溪、宣化、庆符诸县，岷江与金沙江合流之处，西南诸夷往来之地。',
    idx: [56, 28, 46, 46, 18, 52, 42, 34], fisc: [0.76, 0.07], hide: 1.4,
    notes: '西南夷往来之口。'
  }),
  荣州: block({
    name: '荣州', divisionType: '州', officialPosition: '知荣州', terrain: '丘陵',
    specialResources: '井盐·斑布', taxLevel: '中',
    tags: { saltRegion: true },
    description: '和义郡，荣德、威远、资官、应灵四县，盐井之利，土贡斑布。',
    idx: [58, 28, 48, 48, 14, 54, 30, 34], fisc: [0.77, 0.07],
    notes: '盐井。'
  }),
  昌州: block({
    name: '昌州', divisionType: '州', officialPosition: '知昌州', terrain: '丘陵',
    specialResources: '麸金·绢', taxLevel: '中',
    tags: { mineralRegion: true },
    description: '昌元郡，大足、昌元、永川三县，大足北山佛龛造像相连，土贡麸金、绢。',
    idx: [58, 28, 50, 50, 14, 56, 30, 34], fisc: [0.77, 0.07],
    notes: '贡麸金。'
  }),
  合州: block({
    name: '合州', divisionType: '州', officialPosition: '知合州', terrain: '丘陵',
    specialResources: '药材·鱼·粮', taxLevel: '中',
    tags: { fishingRegion: true },
    description: '巴川郡，嘉陵江、渠江、涪江三江汇流，领石照、汉初、巴川、赤水、铜梁五县，土贡牡丹皮、白药子。',
    idx: [58, 28, 52, 52, 14, 56, 32, 34], fisc: [0.77, 0.07],
    notes: '三江之会。'
  }),
  渠州: block({
    name: '渠州', divisionType: '州', officialPosition: '知渠州', terrain: '丘陵',
    specialResources: '绵绸·粮', taxLevel: '中',
    tags: {},
    description: '邻山郡，流江、邻水、邻山三县，渠江所经，土贡绵绸。',
    idx: [58, 28, 48, 48, 14, 54, 30, 34], fisc: [0.77, 0.07],
    notes: '贡绵绸。'
  }),
  广安军: block({
    name: '广安军', divisionType: '军', officialPosition: '知广安军', terrain: '丘陵',
    specialResources: '粮·井盐', taxLevel: '中',
    tags: { saltRegion: true },
    description: '开宝二年以合州浓洄、渠州新明二镇建军，领渠江、岳池、新明三县。',
    idx: [58, 28, 50, 50, 14, 56, 30, 34], fisc: [0.77, 0.07],
    notes: '志中标题宁西军（后改）。'
  }),
  怀安军: block({
    name: '怀安军', divisionType: '军', officialPosition: '知怀安军', terrain: '丘陵',
    specialResources: '粮·绸', taxLevel: '中',
    tags: {},
    description: '乾德五年以简州金水县建军，领金水、金堂二县，沱江上游，近成都。',
    idx: [58, 28, 56, 56, 14, 58, 30, 34], fisc: [0.77, 0.07],
    notes: '二县皆望县。'
  }),
  富顺监: block({
    name: '富顺监', divisionType: '监', officialPosition: '知富顺监', terrain: '丘陵',
    specialResources: '井盐', taxLevel: '中',
    tags: { saltRegion: true },
    description: '本泸州富义县，掌煎盐，太平兴国元年改富顺监；井盐为蜀中大宗。',
    idx: [58, 28, 54, 54, 14, 58, 30, 34], fisc: [0.77, 0.07],
    notes: '以盐井置监。'
  }),
  长宁军: block({
    name: '长宁军', divisionType: '军', officialPosition: '知长宁军', terrain: '山地', regionType: 'frontier_defense',
    specialResources: '井盐·木材', taxLevel: '轻',
    tags: { saltRegion: true },
    description: '政和四年以泸州淯井监建军，淯井产盐，地接夷蛮诸部。',
    idx: [56, 28, 44, 44, 20, 50, 46, 34], fisc: [0.76, 0.07], hide: 1.5,
    notes: '志无户数，为估数。'
  })
};

module.exports = [
  circuitModule('成都府路', { BLOCKS: CHENGDU, regionMeans: { development: 69.22, unrest: 18.08, taxBurden: 63.34, armyPressure: 35.1 } }),
  circuitModule('潼川府路', { BLOCKS: TONGCHUAN, regionMeans: { development: 52, unrest: 14, taxBurden: 57, armyPressure: 32 } })
];
