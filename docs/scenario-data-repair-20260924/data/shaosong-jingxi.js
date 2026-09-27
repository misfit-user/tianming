// 绍宋·京西北路、京西南路、永兴军路。户数、商税、田亩、两税权重见 shaosong-sources.js，这里写定性字段。
// 地图把陕、虢二州画入京西北路、金州画入永兴军路，志中分属永兴军路、京西南路，这里依地图归路。
'use strict';

const { songBlock: block, circuitModule } = require('./shaosong-common');

// idx：[民心, 吏治(贪腐), 繁荣, 发展, 不稳, 税压, 军压, 官风险]；fisc：[征到比例, 截留率]
const NORTH = {
  河南府: block({
    name: '河南府', divisionType: '府', officialPosition: '知河南府', terrain: '河谷',
    specialResources: '牡丹·蜜·蜡·瓷器', taxLevel: '中',
    tags: {},
    description: '西京洛阳，梁、晋、后唐旧都，宫阙园林甲于天下，司马光、邵雍等曾退居于此著书讲学。河南、洛阳为赤县，土贡蜜、蜡、瓷器。金兵去冬过境，洛阳残破。',
    idx: [56, 28, 44, 44, 20, 60, 76, 36], fisc: [0.76, 0.07], keju: 1.8, corridor: 1.4,
    notes: '知河南府例兼西京留守；巩县已另成地块。'
  }),
  郑州: block({
    name: '郑州', divisionType: '州', officialPosition: '知郑州', terrain: '平原',
    specialResources: '粮·驿路', taxLevel: '中',
    tags: {},
    description: '荥阳郡，奉宁军节度，东京西面门户，东西两京之间驿路所经；熙宁五年一度废州入开封府，元丰八年复置。',
    idx: [56, 28, 42, 42, 20, 60, 78, 36], fisc: [0.77, 0.07], corridor: 1.5,
    notes: '领管城、荥泽、原武、新郑、荥阳五县。'
  }),
  巩县: block({
    name: '巩县', divisionType: '县', officialPosition: '知巩县', terrain: '河谷',
    specialResources: '粮·瓷', taxLevel: '中',
    tags: {},
    description: '河南府属县，洛水入河之口；宋室诸帝陵寝在巩县、永安一带，岁时遣官奉祀。',
    idx: [58, 26, 40, 40, 20, 58, 76, 34], fisc: [0.77, 0.07],
    notes: '九域志：一乡。祖陵所在。'
  }),
  汜水县: block({
    name: '汜水县', divisionType: '县', officialPosition: '知汜水县', terrain: '河谷',
    specialResources: '粮', taxLevel: '中',
    tags: {},
    description: '孟州属县，虎牢关所在，北临黄河，扼东西两京之间的咽喉。',
    idx: [56, 28, 38, 38, 22, 58, 82, 34], fisc: [0.77, 0.07], corridor: 1.3,
    notes: '九域志：二乡。孟州其余诸县不在宋廷地块内。'
  }),
  颍昌府: block({
    name: '颍昌府', divisionType: '府', officialPosition: '知颍昌府', terrain: '平原',
    specialResources: '粮·绢', taxLevel: '中',
    tags: {},
    description: '本许州，忠武军节度，元丰三年升颍昌府；崇宁以后两度为京畿南辅，宣和二年还隶京西北路。长社、郾城、临颍诸县平原沃野。',
    idx: [58, 28, 44, 44, 18, 62, 72, 34], fisc: [0.77, 0.07], keju: 1.2,
    notes: '领长社、郾城、阳翟、长葛、临颍、舞阳、郏七县。'
  }),
  汝州: block({
    name: '汝州', divisionType: '州', officialPosition: '知汝州', terrain: '丘陵',
    specialResources: '汝瓷·绁·绢', taxLevel: '中',
    tags: {},
    description: '临汝郡，陆海军节度，梁、襄城、叶、鲁山、宝丰五县；宫中命汝州烧造青瓷，汝窑器为御用。',
    idx: [58, 28, 40, 40, 18, 60, 70, 34], fisc: [0.77, 0.07], yuyao: 1,
    notes: '御窑：叶寘《坦斋笔衡》「本朝以定州白磁器有芒，不堪用，遂命汝州造青窑器」。'
  }),
  淮宁府: block({
    name: '淮宁府', divisionType: '府', officialPosition: '知淮宁府', terrain: '平原',
    specialResources: '绢·粮', taxLevel: '中',
    tags: {},
    description: '本陈州，宣和元年升淮宁府；宛丘为古陈国都，蔡河经此通漕京城。',
    idx: [58, 28, 40, 40, 18, 60, 72, 34], fisc: [0.77, 0.07],
    notes: '领宛丘、项城、商水、西华四县。'
  }),
  蔡州: block({
    name: '蔡州', divisionType: '州', officialPosition: '知蔡州', terrain: '平原',
    specialResources: '绫·粮', taxLevel: '中',
    tags: {},
    description: '汝南郡，淮康军节度，领汝阳、上蔡等十县，淮北平原沃野；唐时吴元济据此抗命，李愬雪夜入蔡州。',
    idx: [58, 28, 40, 40, 18, 60, 72, 34], fisc: [0.77, 0.07],
    notes: '户近十万，领县最多。'
  }),
  顺昌府: block({
    name: '顺昌府', divisionType: '府', officialPosition: '知顺昌府', terrain: '水乡',
    specialResources: '绁·绵·鱼', taxLevel: '中',
    tags: { fishingRegion: true },
    description: '本颍州，政和六年升顺昌府；颍水经此入淮，汝阴西湖为欧阳修晚年居处。',
    idx: [60, 28, 42, 42, 16, 60, 70, 34], fisc: [0.77, 0.07],
    notes: '颍水、西湖渔利。'
  }),
  陕州: block({
    name: '陕州', divisionType: '州', officialPosition: '知陕州', terrain: '河谷',
    specialResources: '粮·药材', taxLevel: '中',
    tags: {},
    description: '陕郡，保平军节度，扼黄河三门之险，崤函古道东西要冲，西去潼关，为关中与西京之间的锁钥。',
    idx: [54, 28, 38, 36, 22, 58, 82, 36], fisc: [0.76, 0.07], corridor: 1.4,
    notes: '志属永兴军路，地图归京西北路。'
  }),
  虢州: block({
    name: '虢州', divisionType: '州', officialPosition: '知虢州', terrain: '山地',
    specialResources: '麝香·砚·矿冶', taxLevel: '轻',
    tags: { mineralRegion: true },
    description: '虢郡，卢氏、虢略、朱阳、栾川四县，伏牛山地，土贡麝香、地骨皮与砚；熙宁二年以伊阳县栾川冶镇来隶。',
    idx: [56, 28, 34, 32, 20, 56, 72, 34], fisc: [0.76, 0.07],
    notes: '栾川冶。志属永兴军路，地图归京西北路。'
  })
};

const SOUTH = {
  邓州: block({
    name: '邓州', divisionType: '州', officialPosition: '知邓州', terrain: '盆地',
    specialResources: '粮·白菊花', taxLevel: '中',
    tags: {},
    description: '南阳郡，武胜军节度，南阳盆地腹心，白河所经；李纲等力主车驾西幸南阳、以邓州为行在，朝议未决。',
    idx: [60, 28, 48, 48, 16, 56, 66, 34], fisc: [0.77, 0.07],
    notes: '户十一万余，京西南路最大州。'
  }),
  唐州: block({
    name: '唐州', divisionType: '州', officialPosition: '知唐州', terrain: '盆地',
    specialResources: '绢·粮', taxLevel: '中',
    tags: {},
    description: '淮安郡，泌阳、湖阳、比阳、桐柏、方城五县，南阳盆地东缘，桐柏山为淮水发源之地。',
    idx: [58, 28, 44, 44, 18, 54, 64, 34], fisc: [0.77, 0.07],
    notes: '五县皆中下、下县，户近九万。'
  }),
  襄阳府: block({
    name: '襄阳府', divisionType: '府', officialPosition: '知襄阳府', terrain: '丘陵',
    specialResources: '麝香·漆器·粮', taxLevel: '中',
    tags: { fishingRegion: true },
    description: '本襄州，山南东道节度，宣和元年升府；汉水之滨，荆襄门户，城坚池深。',
    idx: [58, 28, 50, 50, 18, 56, 70, 36], fisc: [0.77, 0.07], keju: 1.2, corridor: 1.3,
    notes: '一路治所。'
  }),
  随州: block({
    name: '随州', divisionType: '州', officialPosition: '知随州', terrain: '丘陵',
    specialResources: '绢·绫·葛', taxLevel: '中',
    tags: {},
    description: '汉东郡，崇信军节度，随、唐城、枣阳三县，大洪山在境，土贡绢、绫、葛、覆盆子。',
    idx: [58, 28, 44, 44, 18, 54, 64, 34], fisc: [0.77, 0.07],
    notes: '土贡绢、绫、葛、覆盆子。'
  }),
  郢州: block({
    name: '郢州', divisionType: '州', officialPosition: '知郢州', terrain: '丘陵',
    specialResources: '白纻·粮·鱼', taxLevel: '中',
    tags: { fishingRegion: true },
    description: '富水郡，长寿、京山二县，汉水东岸，土贡白纻。',
    idx: [58, 28, 44, 44, 18, 54, 64, 34], fisc: [0.77, 0.07],
    notes: '土贡白纻；汉水渔利。'
  }),
  均州: block({
    name: '均州', divisionType: '州', officialPosition: '知均州', terrain: '山地',
    specialResources: '麝香·药材', taxLevel: '轻',
    tags: {},
    description: '武当郡，宣和元年赐武当军节度，武当山道教胜地，汉水上游，武当、郧乡二县。',
    idx: [60, 26, 40, 40, 18, 52, 60, 32], fisc: [0.77, 0.07],
    notes: '武当山道观，汉水上游。'
  }),
  房州: block({
    name: '房州', divisionType: '州', officialPosition: '知房州', terrain: '山地',
    specialResources: '麝香·纻布·钟乳石·笋', taxLevel: '轻',
    tags: {},
    description: '房陵郡，保康军节度，万山之中，房陵、竹山二县；唐中宗曾被废居于此。',
    idx: [58, 26, 36, 36, 20, 50, 60, 32], fisc: [0.76, 0.07],
    notes: '山地州，繁荣低。'
  }),
  信阳军: block({
    name: '信阳军', divisionType: '军', officialPosition: '知信阳军', terrain: '山地',
    specialResources: '纻布·茶', taxLevel: '轻',
    tags: {},
    description: '信阳、罗山二县，义阳三关扼淮南与京西之交，土贡纻布。',
    idx: [58, 28, 40, 40, 18, 52, 68, 34], fisc: [0.77, 0.07],
    notes: '志属京西北路，地图归京西南路。'
  }),
  光化军: block({
    name: '光化军', divisionType: '军', officialPosition: '知光化军', terrain: '丘陵',
    specialResources: '粮', taxLevel: '轻',
    tags: {},
    description: '本襄州阴城镇，乾德二年建军，领乾德一县；熙宁五年废军为县，元祐初复置。汉水北岸。',
    idx: [58, 28, 40, 40, 18, 52, 64, 32], fisc: [0.77, 0.07],
    notes: '志无户数，按所领一县县等估。'
  })
};

const YONGXING = {
  金州: block({
    name: '金州', divisionType: '州', officialPosition: '知金州', terrain: '山地',
    specialResources: '麸金·麝香·杜仲·漆', taxLevel: '轻',
    tags: { mineralRegion: true },
    description: '安康郡，昭化军节度，汉水上游山地，西城、洵阳、汉阴、石泉、平利五县，土贡麸金、麝香、枳壳、杜仲。',
    idx: [58, 28, 40, 40, 18, 52, 48, 32], fisc: [0.77, 0.07],
    notes: '汉水沙金。志属京西南路，地图归永兴军路。'
  }),
  商州: block({
    name: '商州', divisionType: '州', officialPosition: '知商州', terrain: '山地',
    specialResources: '麝香·枳壳·药材', taxLevel: '轻',
    tags: {},
    description: '上洛郡，秦岭东段山地，商洛古道通关中与荆襄，土贡麝香、枳壳。',
    idx: [48, 32, 40, 40, 26, 50, 56, 34], fisc: [0.77, 0.07],
    notes: '商洛古道；秦岭山地，土贡麝香、枳壳。'
  }),
  京兆府: block({
    name: '京兆府', divisionType: '府', officialPosition: '知京兆府', terrain: '河谷',
    specialResources: '粮·麻·铸钱', taxLevel: '中',
    tags: {},
    description: '长安故都，永兴军节度，旧领永兴军路安抚使；宣和二年诏守臣衔称京兆府。八百里秦川，渭水横贯，关中根本。',
    idx: [48, 32, 48, 48, 26, 54, 60, 36], fisc: [0.77, 0.07], keju: 1.5, corridor: 1.5,
    notes: '一路帅府。乾州（醴州）诸县已另成地块。'
  }),
  同州: block({
    name: '同州', divisionType: '州', officialPosition: '知同州', terrain: '河谷',
    specialResources: '马·药材·粮', taxLevel: '中',
    tags: { horseRegion: true },
    description: '冯翊郡，定国军节度，洛、渭二水交汇；沙苑监在州南，为关中官马牧地。',
    idx: [46, 34, 42, 42, 26, 58, 62, 34], fisc: [0.77, 0.07],
    notes: '沙苑监牧马。'
  }),
  华州: block({
    name: '华州', divisionType: '州', officialPosition: '知华州', terrain: '河谷',
    specialResources: '茯苓·细辛·粮', taxLevel: '中',
    tags: {},
    description: '华阴郡，镇潼军节度，华山在境，东扼潼关，为关中东大门。',
    idx: [46, 34, 44, 44, 28, 52, 64, 34], fisc: [0.77, 0.07],
    notes: '潼关所在，军压略高。'
  }),
  耀州: block({
    name: '耀州', divisionType: '州', officialPosition: '知耀州', terrain: '河谷',
    specialResources: '青瓷·粮', taxLevel: '中',
    tags: {},
    description: '华原郡，感德军节度，华原、富平、三原诸县，耀州窑青瓷行销四方，土贡瓷器。',
    idx: [48, 32, 44, 44, 24, 52, 54, 34], fisc: [0.77, 0.07],
    notes: '户十万余。'
  })
};

module.exports = [
  circuitModule('京西北路', { BLOCKS: NORTH, regionMeans: { development: 40, unrest: 19, taxBurden: 61, armyPressure: 74 } }),
  circuitModule('京西南路', { BLOCKS: SOUTH, regionMeans: { development: 46, unrest: 19, taxBurden: 55, armyPressure: 66 } }),
  circuitModule('永兴军路', { BLOCKS: YONGXING, regionMeans: { development: 43.78, unrest: 23.02, taxBurden: 54.26, armyPressure: 52.45 } })
];
