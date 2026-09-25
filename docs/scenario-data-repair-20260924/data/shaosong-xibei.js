// 绍宋·秦凤路、泾原路、环庆路、鄜延路、熙河兰湟路，与河东路、河北西路的宋有部分。
// 户数、商税、田亩、两税权重见 shaosong-sources.js，这里写定性字段。
// 陕西五路帅府据《宋史·地理志》：秦州「旧置秦凤路经略安抚使」、渭州「旧置泾原路经略、安抚使」、庆州（志题庆阳府）
// 「旧置环庆路经略、安抚使」、延安府「旧置鄜延路经略、安抚使」、熙州「初置熙河路经略、安抚使」；
// 府州「旧置麟府路军马司」。边州、堡寨多的写 frontier_defense（与天启边镇同）。
'use strict';

const { songBlock: block, circuitModule } = require('./shaosong-common');

// idx：[民心, 吏治(贪腐), 繁荣, 发展, 不稳, 税压, 军压, 官风险]；fisc：[征到比例, 截留率]
const QINFENG = {
  凤州: block({
    name: '凤州', divisionType: '州', officialPosition: '知凤州', terrain: '山地',
    specialResources: '蜜·药材·铁', taxLevel: '轻',
    tags: {},
    description: '河池郡，梁泉、河池、两当三县，秦岭西段山地，陈仓道所经，通汉中。',
    idx: [46, 34, 42, 42, 26, 52, 56, 34], fisc: [0.71, 0.08],
    notes: '户三万余。'
  }),
  成州: block({
    name: '成州', divisionType: '州', officialPosition: '知成州', terrain: '山地',
    specialResources: '蜡烛·鹿茸', taxLevel: '轻',
    tags: {},
    description: '同谷郡，同谷、栗亭二县，西汉水流域，土贡蜡烛、鹿茸。',
    idx: [46, 34, 40, 40, 26, 50, 56, 34], fisc: [0.71, 0.08],
    notes: '贡蜡烛、鹿茸。'
  }),
  阶州: block({
    name: '阶州', divisionType: '州', officialPosition: '知阶州', terrain: '山地',
    specialResources: '羚羊角·药材', taxLevel: '轻',
    tags: {},
    description: '武都郡，本唐武州，陷于西戎后收复改置，福津、将利二县，白龙江所经，西接吐蕃诸部。',
    idx: [46, 34, 38, 38, 28, 50, 58, 34], fisc: [0.71, 0.08], hide: 1.3,
    notes: '蕃汉杂处。'
  }),
  凤翔府: block({
    name: '凤翔府', divisionType: '府', officialPosition: '知凤翔府', terrain: '河谷',
    specialResources: '粮·酒·麻', taxLevel: '中',
    tags: {},
    description: '扶风郡，凤翔军节度，天兴、岐山、扶风、盩厔、郿、宝鸡等县，渭水上游平原；苏轼曾签判凤翔府。',
    idx: [48, 32, 50, 50, 24, 54, 54, 36], fisc: [0.72, 0.08], keju: 1.2,
    notes: '关中西部大府。'
  }),
  陇州: block({
    name: '陇州', divisionType: '州', officialPosition: '知陇州', terrain: '丘陵',
    specialResources: '银·席', taxLevel: '中',
    tags: { mineralRegion: true },
    description: '汧阳郡，汧源、汧阳、吴山、陇安四县，陇山东麓；汧源有古道银场，土贡席。',
    idx: [46, 34, 42, 42, 26, 52, 56, 34], fisc: [0.71, 0.08],
    notes: '古道银场。'
  }),
  秦州: block({
    name: '秦州', divisionType: '州', officialPosition: '知秦州', terrain: '河谷', regionType: 'frontier_defense',
    specialResources: '马·木材·粮', taxLevel: '中',
    tags: { horseRegion: true },
    description: '天水郡，雄武军节度，旧置秦凤路经略安抚使，统秦、陇、阶、成、凤五州；成纪、天水诸县与甘谷、定西诸城堡，西军重镇，市马于蕃部。',
    idx: [44, 34, 46, 46, 28, 52, 62, 38], fisc: [0.70, 0.08], corridor: 1.3,
    notes: '一路帅府。'
  })
};

const JINGYUAN = {
  渭州: block({
    name: '渭州', divisionType: '州', officialPosition: '知渭州', terrain: '边塞', regionType: 'frontier_defense',
    specialResources: '马·粮', taxLevel: '中',
    tags: { horseRegion: true },
    description: '陇西郡，政和七年升平凉军节度，旧置泾原路经略安抚使，统泾、原、渭、仪四州与德顺、镇戎二军；平凉、安化、崇信、华亭诸县与靖夏城诸堡。',
    idx: [44, 34, 36, 36, 28, 50, 66, 38], fisc: [0.70, 0.08],
    notes: '一路帅府。'
  }),
  原州: block({
    name: '原州', divisionType: '州', officialPosition: '知原州', terrain: '边塞', regionType: 'frontier_defense',
    specialResources: '甘草·马', taxLevel: '轻',
    tags: { horseRegion: true },
    description: '平凉郡，临泾、彭阳二县与柳泉、西壕诸堡寨，北当西夏入寇之冲，土贡甘草。',
    idx: [44, 34, 32, 32, 30, 48, 66, 36], fisc: [0.70, 0.08],
    notes: '对夏前沿。'
  }),
  泾州: block({
    name: '泾州', divisionType: '州', officialPosition: '知泾州', terrain: '河谷',
    specialResources: '毛褐·紫茸·粮', taxLevel: '中',
    tags: {},
    description: '安定郡，彰化军节度，保定、灵台、良原、长武四县，泾水所经，土贡紫茸、毛褐。',
    idx: [48, 34, 36, 36, 24, 50, 58, 34], fisc: [0.71, 0.08],
    notes: '泾原路后方。'
  })
};

const HUANQING = {
  邠州: block({
    name: '邠州', divisionType: '州', officialPosition: '知邠州', terrain: '河谷',
    specialResources: '火筋·剪刀·粮', taxLevel: '中',
    tags: {},
    description: '新平郡，静难军节度，新平、宜禄、三水、定平、淳化五县，泾水河谷，土贡火筋、剪刀。',
    idx: [48, 34, 44, 44, 24, 52, 54, 34], fisc: [0.71, 0.08],
    notes: '志属永兴军路，地图归环庆路；永寿县已划入醴州。'
  }),
  庆州: block({
    name: '庆州', divisionType: '州', officialPosition: '知庆州', terrain: '边塞', regionType: 'frontier_defense',
    specialResources: '马·甘草', taxLevel: '轻',
    tags: { horseRegion: true },
    description: '安化郡，政和七年升庆阳军节度，旧置环庆路经略安抚使，统庆、环、邠、宁、乾五州；安化、合水、彭原三县与安疆、横山诸砦，横山以南对夏前线。',
    idx: [44, 34, 36, 36, 28, 48, 64, 38], fisc: [0.70, 0.08],
    notes: '一路帅府；志中标题庆阳府（宣和七年升）。'
  }),
  环州: block({
    name: '环州', divisionType: '州', officialPosition: '知环州', terrain: '边塞', regionType: 'frontier_defense',
    specialResources: '甘草·马', taxLevel: '轻',
    tags: { horseRegion: true },
    description: '领通远一县与兴平、安边诸城堡十余，淳化五年由通远军复为州，与西夏犬牙交错，土贡甘草。',
    idx: [42, 34, 30, 30, 30, 46, 68, 36], fisc: [0.69, 0.08], hide: 1.3,
    notes: '崇宁户七千余，堡寨为主。'
  }),
  乾州: block({
    name: '乾州', divisionType: '州', officialPosition: '知醴州', terrain: '河谷',
    specialResources: '粮', taxLevel: '中',
    tags: {},
    description: '旧乾州，熙宁五年废，奉天县还隶京兆府；政和七年复以奉天县为州，更名醴州，割京兆府醴泉、武功与邠州永寿来隶，八年割属环庆路。',
    idx: [48, 34, 42, 42, 24, 52, 54, 34], fisc: [0.71, 0.08],
    notes: '建炎元年名醴州，官称按醴州；户数从京兆府、邠州按九域志乡数切出。'
  })
};

const FUYAN = {
  鄜州: block({
    name: '鄜州', divisionType: '州', officialPosition: '知鄜州', terrain: '丘陵',
    specialResources: '蜡烛·粮', taxLevel: '中',
    tags: {},
    description: '洛交郡，保大军节度，洛水上游，土贡蜡烛（旧贡麝香）。',
    idx: [46, 34, 42, 42, 26, 58, 58, 34], fisc: [0.71, 0.08],
    notes: '一县之州。'
  }),
  延安府: block({
    name: '延安府', divisionType: '府', officialPosition: '知延安府', terrain: '边塞', regionType: 'frontier_defense',
    specialResources: '石油·马·粮', taxLevel: '中',
    tags: { horseRegion: true },
    description: '本延州，彰武军节度，元祐四年升府，旧置鄜延路经略安抚使；肤施、延川、延长等七县与青涧城、塞门诸砦，范仲淹曾经略于此，沈括记延境石油。',
    idx: [44, 34, 44, 44, 28, 58, 64, 38], fisc: [0.70, 0.08], keju: 1.1,
    notes: '一路帅府。'
  }),
  绥德军: block({
    name: '绥德军', divisionType: '军', officialPosition: '知绥德军', terrain: '边塞', regionType: 'frontier_defense',
    specialResources: '马·粮', taxLevel: '轻',
    tags: { horseRegion: true },
    description: '唐绥州，熙宁二年收复为城，后建军，领米脂、义合、怀宁、克戎诸砦与青涧城、永宁关，横山东麓前线。',
    idx: [42, 34, 36, 36, 30, 56, 68, 36], fisc: [0.69, 0.08], hide: 1.3,
    notes: '志无户数，为估数。'
  }),
  丹州: block({
    name: '丹州', divisionType: '州', officialPosition: '知丹州', terrain: '丘陵',
    specialResources: '麝香·粮', taxLevel: '轻',
    tags: {},
    description: '咸宁郡，治宜川，北濒黄河，东与河东隰州隔河相望，属鄜延路。',
    idx: [46, 34, 38, 38, 26, 56, 60, 34], fisc: [0.71, 0.08],
    notes: '《宋史》未单列，据《元丰九域志》；九域志土贡麝。'
  }),
  保安军: block({
    name: '保安军', divisionType: '军', officialPosition: '知保安军', terrain: '边塞', regionType: 'frontier_defense',
    specialResources: '毛段·苁蓉·马', taxLevel: '轻',
    tags: { horseRegion: true },
    description: '领德靖、顺宁二砦与金汤城，西接庆州，北对西夏，宋夏榷场旧设于此，土贡毛段、苁蓉。',
    idx: [44, 34, 36, 36, 28, 54, 66, 36], fisc: [0.70, 0.08], hide: 1.2,
    notes: '崇宁户二千余。'
  })
};

const XIHE = {
  巩州: block({
    name: '巩州', divisionType: '州', officialPosition: '知巩州', terrain: '边塞', regionType: 'frontier_defense',
    specialResources: '马·粮', taxLevel: '轻',
    tags: { horseRegion: true },
    description: '本秦州古渭砦，熙宁五年建通远军，崇宁三年升巩州；陇西、通渭诸县与熟羊、三岔诸城堡，蕃汉杂处。',
    idx: [44, 34, 34, 34, 22, 50, 58, 36], fisc: [0.70, 0.08], hide: 1.4,
    notes: '蕃汉杂处。'
  }),
  熙州: block({
    name: '熙州', divisionType: '州', officialPosition: '知熙州', terrain: '高原', regionType: 'frontier_defense',
    specialResources: '马·青盐', taxLevel: '轻',
    tags: { horseRegion: true, saltRegion: true },
    description: '临洮郡，镇洮军节度，熙宁五年王韶收复，初置熙河路经略安抚使于此；狄道、通谷与安羌城诸堡，茶马互市之地。',
    idx: [44, 34, 36, 36, 20, 50, 60, 38], fisc: [0.70, 0.08], hide: 1.4,
    notes: '一路帅府。'
  }),
  河州: block({
    name: '河州', divisionType: '州', officialPosition: '知河州', terrain: '高原', regionType: 'frontier_defense',
    specialResources: '麝香·马', taxLevel: '轻',
    tags: { horseRegion: true },
    description: '安乡郡，熙宁六年收复，领宁河县与循化、大通、来羌诸城堡，黄河以南吐蕃旧地，崇宁户仅千余，土贡麝香。',
    idx: [44, 34, 32, 32, 22, 48, 60, 36], fisc: [0.69, 0.08], hide: 1.6,
    notes: '蕃部为主，隐户多。'
  }),
  兰州: block({
    name: '兰州', divisionType: '州', officialPosition: '知兰州', terrain: '高原', regionType: 'frontier_defense',
    specialResources: '甘草·马', taxLevel: '轻',
    tags: { horseRegion: true },
    description: '金城郡，元丰四年收复，领兰泉县与龛谷、定远城及金城关、京玉关，黄河渡口，北对西夏。',
    idx: [42, 34, 32, 32, 24, 48, 64, 36], fisc: [0.69, 0.08], hide: 1.5,
    notes: '崇宁户仅三百余，堡寨为主。'
  }),
  廓州: block({
    name: '廓州', divisionType: '州', officialPosition: '知廓州', terrain: '高原', regionType: 'frontier_defense',
    specialResources: '马·畜产', taxLevel: '轻',
    tags: { horseRegion: true },
    description: '元符二年以廓州为宁塞城，崇宁三年弃而复取，仍为廓州，黄河上游吐蕃之地，领绥平、米川诸城堡。',
    idx: [42, 32, 28, 28, 24, 44, 60, 36], fisc: [0.68, 0.08], hide: 1.8,
    notes: '志无户数，为估数。'
  }),
  湟州: block({
    name: '湟州', divisionType: '州', officialPosition: '知湟州', terrain: '高原', regionType: 'frontier_defense',
    specialResources: '马·畜产', taxLevel: '轻',
    tags: { horseRegion: true },
    description: '旧邈川城，元符二年收复建湟州，建中靖国元年弃之，崇宁二年又复，湟水河谷，吐蕃唃厮啰旧地。',
    idx: [42, 32, 28, 28, 24, 44, 60, 36], fisc: [0.68, 0.08], hide: 1.8,
    notes: '志中标题乐州（后改）；无户数，为估数。'
  }),
  洮州: block({
    name: '洮州', divisionType: '州', officialPosition: '知洮州', terrain: '高原', regionType: 'frontier_defense',
    specialResources: '马·畜产', taxLevel: '轻',
    tags: { horseRegion: true },
    description: '唐末陷于吐蕃，号临洮城；元符二年得而复弃，大观间复取，洮水上游蕃部之地。',
    idx: [42, 32, 28, 28, 24, 44, 60, 36], fisc: [0.68, 0.08], hide: 1.8,
    notes: '志无户数，为估数。'
  }),
  岷州: block({
    name: '岷州', divisionType: '州', officialPosition: '知岷州', terrain: '高原', regionType: 'frontier_defense',
    specialResources: '甘草·马·铁', taxLevel: '轻',
    tags: { horseRegion: true },
    description: '和政郡，熙宁六年收复，祐川、大潭诸县与遮羊、铁城诸堡，洮水以东，崇宁户四万余，土贡甘草。',
    idx: [44, 34, 36, 36, 20, 50, 56, 36], fisc: [0.70, 0.08], hide: 1.3,
    notes: '熙河路户数最多的州。'
  }),
  积石军: block({
    name: '积石军', divisionType: '军', officialPosition: '知积石军', terrain: '高原', regionType: 'frontier_defense',
    specialResources: '马·畜产', taxLevel: '轻',
    tags: { horseRegion: true },
    description: '本溪哥城，元符间为吐蕃溪巴温所据，大观二年臧征扑哥以城降，即其地建军，领顺通、临松二堡。',
    idx: [42, 32, 26, 26, 24, 42, 60, 36], fisc: [0.68, 0.08], hide: 1.8,
    notes: '志无户数，为估数。'
  })
};

const HEDONG = {
  麟州: block({
    name: '麟州', divisionType: '州', officialPosition: '知麟州', terrain: '边塞', regionType: 'frontier_defense',
    specialResources: '马·盐', taxLevel: '轻',
    tags: { horseRegion: true },
    description: '新秦郡，镇西军节度，黄河以西的河外之州，领新秦县与大和砦，北邻西夏，东隔河即河东。',
    idx: [44, 34, 26, 26, 24, 44, 72, 36], fisc: [0.70, 0.08],
    notes: '崇宁户三千余。'
  }),
  府州: block({
    name: '府州', divisionType: '州', officialPosition: '知府州', governor: '折可求', terrain: '边塞', regionType: 'frontier_defense',
    specialResources: '马·盐', taxLevel: '轻',
    tags: { horseRegion: true },
    description: '靖康军节度，崇宁元年改军额，政和五年赐郡名荣河；府谷县与宁川、宁边诸堡寨，麟府路军马司所在，折氏世守其地。',
    idx: [46, 32, 26, 26, 22, 44, 72, 38], fisc: [0.70, 0.08],
    notes: '折可求知府州兼麟府路兵马钤辖，写 governor。'
  }),
  丰州: block({
    name: '丰州', divisionType: '州', officialPosition: '知丰州', terrain: '边塞', regionType: 'frontier_defense',
    specialResources: '马', taxLevel: '轻',
    tags: { horseRegion: true },
    description: '庆历元年为元昊攻陷，嘉祐七年以府州萝泊川掌地复建，政和五年赐郡名宁丰，孤悬河外。',
    idx: [42, 34, 24, 24, 26, 42, 72, 36], fisc: [0.69, 0.08],
    notes: '元丰户仅百余。'
  })
};

const HEBEI = {
  共城县: block({
    name: '共城县', divisionType: '县', officialPosition: '知共城县', terrain: '丘陵', regionType: 'frontier_defense',
    specialResources: '粮·银锡', taxLevel: '中',
    tags: { mineralRegion: true },
    description: '卫州属县，太行南麓，百门泉、苏门山在境，邵雍曾居此讲学；王彦八字军屯于县西太行山中。',
    idx: [46, 34, 56, 56, 22, 56, 84, 36], fisc: [0.70, 0.08],
    notes: '九域志：三乡，银锡一场。'
  }),
  卫州: block({
    name: '卫州', divisionType: '州', officialPosition: '知卫州', terrain: '平原', regionType: 'frontier_defense',
    specialResources: '绢·绵·粮', taxLevel: '中',
    tags: {},
    description: '汲郡，防御州，汲、新乡诸县，御河所经，北接金人所陷的相州、浚州，土贡绢、绵。',
    idx: [46, 34, 60, 60, 22, 58, 82, 36], fisc: [0.70, 0.08],
    notes: '共城县已另成地块。'
  }),
  怀州: block({
    name: '怀州', divisionType: '州', officialPosition: '知怀州', terrain: '平原', regionType: 'frontier_defense',
    specialResources: '牛膝·地黄·粮', taxLevel: '中',
    tags: {},
    description: '河内郡，防御州，河内、修武、武陟三县，太行之南、黄河之北，土贡牛膝，地黄等药材驰名。',
    idx: [52, 30, 48, 48, 20, 60, 78, 36], fisc: [0.74, 0.07],
    notes: '土贡牛膝。'
  }),
  太行陉: block({
    name: '太行陉', divisionType: '关', officialPosition: '太行陉巡检', terrain: '山地', regionType: 'frontier_defense',
    specialResources: '关隘·山货', taxLevel: '轻',
    tags: {},
    description: '太行八陉之一，自怀州北上泽州的关道，山中堡寨与义军往来其间。',
    idx: [50, 28, 34, 34, 24, 50, 80, 34], fisc: [0.70, 0.07], keju: 0,
    notes: '关隘地块，户数为估数。'
  })
};

module.exports = [
  circuitModule('秦凤路', { BLOCKS: QINFENG, regionMeans: { development: 44, unrest: 27, taxBurden: 52, armyPressure: 56 } }),
  circuitModule('泾原路', { BLOCKS: JINGYUAN, regionMeans: { development: 34, unrest: 27, taxBurden: 49, armyPressure: 62 } }),
  circuitModule('环庆路', { BLOCKS: HUANQING, regionMeans: { development: 38.08, unrest: 27, taxBurden: 50.22, armyPressure: 59.55 } }),
  circuitModule('鄜延路', { BLOCKS: FUYAN, regionMeans: { development: 42, unrest: 27, taxBurden: 59, armyPressure: 60 } }),
  circuitModule('熙河兰湟路', { BLOCKS: XIHE, regionMeans: { development: 34, unrest: 19, taxBurden: 50, armyPressure: 58 } }),
  circuitModule('河东路', { BLOCKS: HEDONG, regionMeans: { development: 26, unrest: 24, taxBurden: 43, armyPressure: 70 } }),
  circuitModule('河北西路', { BLOCKS: HEBEI, regionMeans: { development: 60.34, unrest: 19, taxBurden: 58.23, armyPressure: 79.55 } })
];
