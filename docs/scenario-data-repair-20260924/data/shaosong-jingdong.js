// 绍宋·京东西路、京东东路。户数、商税、田亩、两税权重见 shaosong-sources.js，这里写定性字段。
// 建置据《宋史·地理志》：东平府条「庆历二年初置京东西路安抚使……政和四年移安抚使于应天府」，
// 青州条「庆历二年初置京东东路安抚使」，与两路治所一致。
'use strict';

const { songBlock: block, circuitModule } = require('./shaosong-common');

// idx：[民心, 吏治(贪腐), 繁荣, 发展, 不稳, 税压, 军压, 官风险]；fisc：[征到比例, 截留率]
const WEST = {
  应天府: block({
    name: '应天府', divisionType: '府', officialPosition: '知应天府', terrain: '平原',
    specialResources: '绢·汴河漕运', taxLevel: '中',
    tags: {},
    description: '宋州旧地，太祖以归德军节度使受禅，国号由此而来；景德三年升应天府，大中祥符七年建为南京。汴河经城下，今上五月初一即位于府治。',
    idx: [52, 32, 64, 64, 16, 56, 82, 38], fisc: [0.72, 0.08], keju: 1.5, corridor: 1.4,
    notes: '政和四年京东西路安抚使移治于此；柘城县已划入拱州地块。'
  }),
  拱州: block({
    name: '拱州', divisionType: '州', officialPosition: '知拱州', terrain: '平原',
    specialResources: '粮·绢', taxLevel: '中',
    tags: {},
    description: '开封府襄邑县地，崇宁四年建州为东辅，此后屡废屡置，宣和六年后领襄邑、柘城二县。汴河、睢水经襄邑，地当京东孔道。',
    idx: [48, 34, 60, 60, 18, 56, 80, 35], fisc: [0.71, 0.08],
    notes: '崇宁元年襄邑属开封府、柘城属应天府，户数从二府切出。'
  }),
  兴仁府: block({
    name: '兴仁府', divisionType: '府', officialPosition: '知兴仁府', terrain: '平原',
    specialResources: '绢·粮·漕运', taxLevel: '中',
    tags: {},
    description: '本曹州，崇宁元年升兴仁府，曾为京畿东辅；广济河（五丈河）经其境，京东漕粮由此入京。',
    idx: [46, 34, 58, 58, 20, 55, 80, 36], fisc: [0.71, 0.08],
    notes: '领济阴、乘氏、南华三县。'
  }),
  单州: block({
    name: '单州', divisionType: '州', officialPosition: '知单州', terrain: '平原',
    specialResources: '粮·药材', taxLevel: '中',
    tags: {},
    description: '砀郡，单父、砀山、成武、鱼台四县，汴、泗之间的平原，土贡蛇床、防风。',
    idx: [48, 34, 52, 50, 20, 52, 80, 34], fisc: [0.72, 0.08],
    notes: '单父、砀山为望县。'
  }),
  济州: block({
    name: '济州', divisionType: '州', officialPosition: '知济州', terrain: '水乡',
    specialResources: '粮·阿胶·鱼', taxLevel: '中',
    tags: { fishingRegion: true },
    description: '济阳郡，巨野、任城、金乡、郓城四县皆望县，北濒梁山泊，泊中渔人聚居，宣和间宋江等曾啸聚于此一带。',
    idx: [44, 36, 54, 52, 26, 52, 80, 36], fisc: [0.70, 0.08], flee: 1.2,
    notes: '梁山泊水域，渔利与盗贼并存，不稳略高。'
  }),
  东平府: block({
    name: '东平府', divisionType: '府', officialPosition: '知东平府', terrain: '平原',
    specialResources: '绢·阿胶·鱼', taxLevel: '中',
    tags: { fishingRegion: true },
    description: '本郓州，天平军节度，庆历二年初置京东西路安抚使于此，宣和元年升东平府。地当汶、济之间，东阿出阿胶，西濒梁山泊。',
    idx: [48, 34, 58, 56, 20, 55, 80, 36], fisc: [0.71, 0.08], textile: 1.2,
    notes: '京东西路大府，户十三万。'
  }),
  徐州: block({
    name: '徐州', divisionType: '州', officialPosition: '知徐州', terrain: '平原',
    specialResources: '铁·双丝绫·绢·漕运', taxLevel: '中',
    tags: { mineralRegion: true },
    description: '彭城郡，武宁军节度，汴、泗交汇之地，东南漕运北上的要冲；州东北利国监冶铁，为北方大冶。',
    idx: [48, 34, 56, 56, 20, 55, 84, 36], fisc: [0.71, 0.08], kuangchang: 1, corridor: 1.4,
    notes: '利国监为官营铁冶，记官营矿场一处；滕县已另成地块。'
  }),
  滕县: block({
    name: '滕县', divisionType: '县', officialPosition: '知滕县', terrain: '丘陵',
    specialResources: '粮·煤', taxLevel: '中',
    tags: {},
    description: '徐州属县，古滕国之地，北接兖州山地，南为泗水平原。',
    idx: [48, 34, 50, 50, 20, 52, 80, 34], fisc: [0.71, 0.08],
    notes: '九域志：四乡，徐州五县中占五分之一。'
  }),
  袭庆府: block({
    name: '袭庆府', divisionType: '府', officialPosition: '知袭庆府', terrain: '丘陵',
    specialResources: '大花绫·墨·云母·紫石英', taxLevel: '中',
    tags: {},
    description: '本兖州，泰宁军节度，政和八年升袭庆府。孔子故里曲阜（大中祥符五年改名仙源）在焉，泰山在奉符县，真宗封禅之地。',
    idx: [50, 32, 56, 54, 18, 52, 80, 34], fisc: [0.72, 0.08], keju: 1.5,
    notes: '孔庙、岱庙所在，读书风气盛，解额权重略高。'
  }),
  濮州: block({
    name: '濮州', divisionType: '州', officialPosition: '知濮州', terrain: '平原',
    specialResources: '绢·粮', taxLevel: '中',
    tags: {},
    description: '濮阳郡，黄河南岸，鄄城、雷泽、临濮三县，平原沃野，产绢。与金兵隔河相望，河防吃紧。',
    idx: [44, 34, 52, 50, 24, 52, 86, 36], fisc: [0.70, 0.08], flee: 1.2,
    notes: '濒河前沿，军压、不稳略高。'
  })
};

const EAST = {
  沂州: block({
    name: '沂州', divisionType: '州', officialPosition: '知沂州', terrain: '丘陵',
    specialResources: '药材·紫石英·钟乳石', taxLevel: '中',
    tags: {},
    description: '琅琊郡，沂蒙山地，临沂、承、沂水、费四县皆望县，土贡仙灵脾、紫石英、茯苓、钟乳石。',
    idx: [48, 34, 46, 44, 22, 42, 80, 34], fisc: [0.71, 0.08],
    notes: '山地州，繁荣略低。'
  }),
  密州: block({
    name: '密州', divisionType: '州', officialPosition: '知密州', terrain: '沿海',
    specialResources: '海贸·绢·海盐', taxLevel: '中',
    tags: { hasPort: true, saltRegion: true, fishingRegion: true },
    description: '高密郡，安化军节度，濒海之州。胶西县板桥镇元祐三年置市舶司，南北海舶在此交易；苏轼曾知密州。',
    idx: [50, 34, 50, 48, 20, 44, 80, 36], fisc: [0.71, 0.08],
    notes: '户十四万余，京东东路户数最多的州；板桥市舶。'
  }),
  青州: block({
    name: '青州', divisionType: '州', officialPosition: '知青州', terrain: '平原',
    specialResources: '仙纹绫·梨·枣', taxLevel: '中',
    tags: {},
    description: '北海郡，镇海军节度，庆历二年初置京东东路安抚使于此，为一路帅府。范仲淹、富弼、欧阳修皆曾知青州，土贡仙纹绫与梨枣。',
    idx: [48, 32, 50, 48, 20, 44, 84, 36], fisc: [0.72, 0.08], textile: 1.3, keju: 1.3,
    notes: '京东东路帅府。'
  }),
  淄州: block({
    name: '淄州', divisionType: '州', officialPosition: '知淄州', terrain: '丘陵',
    specialResources: '绫·药材·煤', taxLevel: '中',
    tags: {},
    description: '淄川郡，淄水所经，淄川、长山、邹平、高苑四县，产绫与防风，山中有石炭。',
    idx: [48, 34, 44, 42, 22, 42, 80, 34], fisc: [0.71, 0.08],
    notes: '土贡绫、防风、长理石；丘陵州，繁荣略低。'
  }),
  济南府: block({
    name: '济南府', divisionType: '府', officialPosition: '知济南府', terrain: '平原',
    specialResources: '绢·绵·阳起石', taxLevel: '中',
    tags: { fishingRegion: true },
    description: '本齐州，政和六年升济南府。城中泉水众多，北有大明湖；曾巩尝知齐州，浚湖筑堤。',
    idx: [48, 32, 50, 48, 20, 44, 82, 36], fisc: [0.72, 0.08], keju: 1.2,
    notes: '户十三万余。'
  }),
  莱州: block({
    name: '莱州', divisionType: '州', officialPosition: '知莱州', terrain: '沿海',
    specialResources: '海盐·金·海藻·牡蛎·石器', taxLevel: '中',
    tags: { saltRegion: true, mineralRegion: true, fishingRegion: true },
    description: '东莱郡，掖、莱阳、胶水、即墨四县，濒海有盐场，登、莱山中采金，土贡海藻、牡蛎与石器。',
    idx: [48, 34, 44, 42, 22, 42, 82, 34], fisc: [0.71, 0.08],
    notes: '登莱金坑。'
  }),
  登州: block({
    name: '登州', divisionType: '州', officialPosition: '知登州', terrain: '沿海',
    specialResources: '金·海盐·牛黄·石器', taxLevel: '中',
    tags: { saltRegion: true, mineralRegion: true, fishingRegion: true },
    description: '东牟郡，蓬莱、黄县濒海，北望辽东；宣和间朝廷遣使由登州渡海与金人订约。土贡金、牛黄。',
    idx: [46, 34, 44, 42, 22, 42, 86, 36], fisc: [0.71, 0.08],
    notes: '海上之盟使者出发之地；牟平、文登二县已另成宁海县地块。'
  }),
  宁海县: block({
    name: '宁海县', divisionType: '县', officialPosition: '知牟平县', terrain: '沿海',
    specialResources: '海盐·鱼', taxLevel: '轻',
    tags: { saltRegion: true, fishingRegion: true },
    description: '登州牟平、文登二县之地，东临大海，民以渔盐为业；宁海之名为金人后置州时所用。',
    idx: [48, 32, 40, 38, 20, 40, 80, 32], fisc: [0.71, 0.08],
    notes: '宋时为二县，官称取牟平县。'
  }),
  潍州: block({
    name: '潍州', divisionType: '州', officialPosition: '知潍州', terrain: '平原',
    specialResources: '丝·绢·海盐', taxLevel: '中',
    tags: { saltRegion: true },
    description: '北海郡，建隆三年以青州北海县建北海军，乾德三年升州，领北海、昌邑、昌乐三县，土贡综丝素絁，北濒海有盐场。',
    idx: [48, 34, 46, 44, 20, 42, 80, 34], fisc: [0.71, 0.08], textile: 1.3,
    notes: '土贡综丝素絁，布帛权重略高。'
  })
};

module.exports = [
  circuitModule('京东西路', { BLOCKS: WEST, regionMeans: { development: 58.76, unrest: 19.95, taxBurden: 54.95, armyPressure: 80.38 } }),
  circuitModule('京东东路', { BLOCKS: EAST, regionMeans: { development: 45, unrest: 24, taxBurden: 42, armyPressure: 82 } })
];
