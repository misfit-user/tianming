// 天启剧本·西域、东北、南洋诸势力 69 块
//   叶尔羌 7（叶尔羌城一块分两本账）、吐鲁番 6（哈密一块分两本账）、哈萨克三辖区 16、野人女真两辖区 10、
//   澳门 7（一块七本账）、大员荷兰商馆区 8、菲律宾马尼拉总督区 7。
//
// 天启七年（1627）：
//   叶尔羌汗国阿布都拉提甫汗在位，和卓家族白山、黑山两派争夺信众；吐鲁番、哈密诸伯克名义上奉汗族为主。
//   哈萨克也昔木汗都突厥斯坦，与据塔什干的图尔逊汗争雄；北方俄罗斯人已在托博尔斯克、塔拉筑城。
//   黑龙江、乌苏里江诸部渔猎采参，后金近年屡遣兵北征；明初奴儿干都司早已废弃。
//   澳门葡人天启二年击退荷兰人，城墙炮台新成，今年新设铸炮场，并为明廷铸炮、招炮手；
//   荷兰东印度公司天启四年自澎湖移至大员，筑热兰遮城；西班牙人去年自马尼拉出兵占据北台湾鸡笼。
// 人口按各地城镇、绿洲、牧场与部落大小估；剧本各省总数不动。各块沿用省里的征到比例与截留率。
// 剧本记在灾异里的「严寒歉获」「山林严寒」「白灾风险」改为正规灾异；「商路受阻」「水源争夺」「草场争夺」
// 「边牧冲突」不是灾害，写进描述。标了产区标签的块，引擎会按人口重算盐、矿、马、渔、海贸产量（见 README），
// 这里只给确有其产的块标签。
'use strict';

const { block } = require('./lib-blocks');

const unit = (name, mouths, grain, land, countyCount, extra) => Object.assign({
  name, countyCount, weights: { pop: mouths, households: mouths, grain, land },
  basis: '无本朝册籍，按城镇、绿洲、牧场与部落大小估。'
}, extra || {});

const cold = (note) => ({ type: 'cold', severity: 1, startTurn: 1, note });

// ---------------------------------------------------------------- 叶尔羌
const YARKAND = {
  faction: '叶尔羌汗国', province: '叶尔羌', fiscalRates: 'province',
  UNITS: [
    unit('叶尔羌城·原账分项', 200000, 28, 26, 1, { block: '叶尔羌城·原账分项' }),
    unit('喀什噶尔', 150000, 20, 18, 1),
    unit('和田', 130000, 17, 17, 1),
    unit('阿克苏', 90000, 12, 12, 1),
    unit('库车', 80000, 10, 11, 1),
    unit('英吉沙尔', 40000, 5, 6, 0.5),
    unit('塔里木绿洲', 70000, 6, 5, 0.5)
  ],
  BLOCKS: {
    '叶尔羌城·原账分项': block({
      name: '叶尔羌城·原账分项', terrain: '绿洲', divisionType: '城', regionType: 'foreign_khanate', officialPosition: '叶尔羌汗',
      governor: '阿布达勒拉提甫汗', specialResources: '粮·棉·丝', tags: { horseRegion: true },
      description: '叶尔羌汗国的都城，阿布都拉提甫汗在此立汗廷；和卓家族白山、黑山两派争夺信众，汗权受其掣肘，东西商路时通时阻。',
      commerce: 1.8, fishing: 0, horse: 0.1, corridor: 1.3, keju: 0,
      idx: [54, 18, 58, 58, 60, 56, 60, 49], fisc: [0.42, 0.08],
      accounts: [
        { name: '叶尔羌城', weight: 0.55, divisionType: '城', terrain: '绿洲', officialPosition: '叶尔羌汗', governor: '阿布达勒拉提甫汗',
          specialResources: '丝·棉布·商货', description: '汗廷所在的城堡与大巴扎，清真寺与经学院林立，商队云集。' },
        { name: '莎车', weight: 0.45, divisionType: '乡', terrain: '绿洲', officialPosition: '莎车伯克',
          specialResources: '粮·棉·瓜果', description: '城外叶尔羌河灌溉的绿洲村镇，种麦、棉与瓜果，供养汗廷。' }
      ],
      notes: '阿布都拉提甫汗（1618—1631 在位）。'
    }),
    喀什噶尔: block({
      name: '喀什噶尔', terrain: '绿洲', divisionType: '城', regionType: 'foreign_khanate', officialPosition: '喀什噶尔伯克', governor: '喀什噶尔伯克',
      specialResources: '商货·棉布·马', tags: { horseRegion: true },
      description: '塔里木西端的古城，汗族宗王与伯克镇守，艾提尕尔清真寺为礼拜中心；西通费尔干纳，商队往来不绝。',
      commerce: 1.8, fishing: 0, horse: 0.2, corridor: 1.3, keju: 0,
      idx: [52, 18, 58, 58, 62, 56, 62, 49], fisc: [0.42, 0.08],
      notes: '艾提尕尔清真寺。'
    }),
    和田: block({
      name: '和田', terrain: '绿洲', divisionType: '城', regionType: 'foreign_khanate', officialPosition: '和田伯克',
      specialResources: '玉·丝·地毯', tags: { mineralRegion: true, horseRegion: true },
      description: '昆仑山北麓的绿洲，玉龙喀什河出美玉，经商队远售中原；养蚕织丝与地毯亦有名。',
      commerce: 1.4, fishing: 0, mineral: 1, kuangchang: 1, horse: 0.1, corridor: 1.0, keju: 0,
      idx: [54, 18, 54, 54, 60, 56, 58, 49], fisc: [0.42, 0.08],
      notes: '和田玉。'
    }),
    阿克苏: block({
      name: '阿克苏', terrain: '绿洲', divisionType: '城', regionType: 'foreign_khanate', officialPosition: '阿克苏伯克',
      specialResources: '粮·马·棉', tags: { horseRegion: true },
      description: '天山南麓的绿洲，扼北越天山通伊犁、东去库车的道路，常受卫拉特诸部南下侵扰。',
      commerce: 1.1, fishing: 0, horse: 0.2, corridor: 1.2, keju: 0,
      idx: [50, 18, 52, 52, 66, 56, 66, 49], fisc: [0.42, 0.08],
      notes: '通伊犁之道。'
    }),
    库车: block({
      name: '库车', terrain: '绿洲', divisionType: '城', regionType: 'foreign_khanate', officialPosition: '库车伯克',
      specialResources: '粮·马·铜', tags: { horseRegion: true },
      description: '古龟兹之地，天山南路东段的绿洲重镇，与吐鲁番诸伯克接界。',
      commerce: 1.1, fishing: 0, horse: 0.15, corridor: 1.1, keju: 0,
      idx: [50, 18, 52, 52, 64, 56, 62, 49], fisc: [0.42, 0.08],
      notes: '龟兹故地。'
    }),
    英吉沙尔: block({
      name: '英吉沙尔', terrain: '绿洲', divisionType: '城', regionType: 'foreign_khanate', officialPosition: '英吉沙尔伯克',
      specialResources: '刀具·粮·瓜果', tags: { horseRegion: true },
      description: '喀什噶尔与叶尔羌之间的小绿洲，工匠以锻刀著称。',
      commerce: 1.0, fishing: 0, horse: 0.1, corridor: 1.1, keju: 0,
      idx: [52, 18, 50, 50, 62, 56, 60, 49], fisc: [0.42, 0.08],
      notes: '英吉沙小刀。'
    }),
    塔里木绿洲: block({
      name: '塔里木绿洲', terrain: '荒漠', divisionType: '乡', regionType: 'foreign_khanate', officialPosition: '塔里木伯克',
      specialResources: '胡杨·鱼·羊', tags: { horseRegion: true },
      description: '塔克拉玛干沙漠边缘沿塔里木河的零星绿洲与胡杨林，罗布人以渔猎为生，地广人稀。',
      commerce: 0.6, fishing: 0, horse: 0.15, corridor: 0.8, keju: 0,
      idx: [50, 18, 44, 44, 64, 56, 58, 49], fisc: [0.42, 0.08],
      notes: '罗布人。'
    })
  },
  regionMeans: { development: 52, unrest: 63, taxPressure: 56, armyPressure: 62, officeRisk: 49 }
};

// ---------------------------------------------------------------- 吐鲁番
const TURFAN = {
  faction: '吐鲁番诸伯克', province: '吐鲁番', fiscalRates: 'province',
  UNITS: [
    unit('吐鲁番城', 35000, 26, 26, 1),
    unit('哈密卫故地·原账分项', 30000, 20, 20, 1, { block: '哈密卫故地·原账分项' }),
    unit('鲁克沁', 20000, 15, 16, 0.5),
    unit('鄯善', 20000, 14, 14, 1),
    unit('火州', 15000, 12, 12, 0.5),
    unit('焉耆', 15000, 13, 12, 1)
  ],
  BLOCKS: {
    吐鲁番城: block({
      name: '吐鲁番城', terrain: '绿洲', divisionType: '城', regionType: 'oasis_beglik', officialPosition: '吐鲁番伯克', governor: '吐鲁番伯克',
      specialResources: '葡萄·棉·瓜果', tags: {},
      description: '天山东部盆地中的绿洲城，坎儿井引雪水灌溉葡萄与棉田；地方伯克自治，名义上奉叶尔羌汗族为主，水源之争屡起。',
      commerce: 1.6, fishing: 0, corridor: 1.3, keju: 1,
      idx: [46, 28, 48, 48, 64, 40, 60, 42], fisc: [0.68, 0.14],
      notes: '坎儿井；剧本记吐鲁番解额一名，归吐鲁番城。'
    }),
    '哈密卫故地·原账分项': block({
      name: '哈密卫故地·原账分项', terrain: '绿洲', divisionType: '城', regionType: 'oasis_beglik', officialPosition: '哈密伯克',
      specialResources: '瓜·粮·驼', tags: {},
      description: '明初所设哈密卫的故地，正德、嘉靖间为吐鲁番所夺，明廷退守嘉峪关；今为伯克治理的绿洲，东去肃州的贡道经此。',
      commerce: 1.3, fishing: 0, corridor: 1.4, keju: 0,
      idx: [44, 28, 44, 44, 68, 40, 64, 42], fisc: [0.68, 0.14],
      accounts: [
        { name: '哈密卫故地', weight: 0.7, divisionType: '城', terrain: '绿洲', officialPosition: '哈密伯克',
          specialResources: '瓜·粮·驼', description: '哈密卫旧城，明初忠顺王所居，今城垣残破，伯克与商队驻足。' },
        { name: '库木尔', weight: 0.3, divisionType: '乡', terrain: '绿洲', officialPosition: '库木尔伯克',
          specialResources: '瓜·粮', description: '突厥语称哈密为库木尔，城外绿洲村落种瓜麦为生。' }
      ],
      notes: '哈密卫（永乐四年设）。'
    }),
    鲁克沁: block({
      name: '鲁克沁', terrain: '绿洲', divisionType: '城', regionType: 'oasis_beglik', officialPosition: '鲁克沁伯克',
      specialResources: '瓜果·棉', tags: {},
      description: '吐鲁番盆地东南的绿洲，旧为吐鲁番王族居地，产瓜果、棉花。',
      commerce: 1.0, fishing: 0, corridor: 1.0, keju: 0,
      idx: [46, 28, 44, 44, 66, 40, 60, 42], fisc: [0.68, 0.14],
      notes: '柳陈城。'
    }),
    鄯善: block({
      name: '鄯善', terrain: '绿洲', divisionType: '城', regionType: 'oasis_beglik', officialPosition: '鄯善伯克',
      specialResources: '瓜·葡萄·驼', tags: {},
      description: '盆地东部的辟展绿洲，扼通哈密的驿路，戈壁与沙山环绕。',
      commerce: 1.0, fishing: 0, corridor: 1.2, keju: 0,
      idx: [44, 28, 40, 40, 68, 40, 62, 42], fisc: [0.68, 0.14],
      notes: '辟展。'
    }),
    火州: block({
      name: '火州', terrain: '绿洲', divisionType: '州', regionType: 'oasis_beglik', officialPosition: '火州伯克',
      specialResources: '葡萄·棉', tags: {},
      description: '高昌故城所在，吐鲁番盆地的古都，残垣犹存，昔日佛寺多已改为清真寺。',
      commerce: 0.9, fishing: 0, corridor: 1.0, keju: 0,
      idx: [46, 28, 40, 40, 66, 40, 60, 42], fisc: [0.68, 0.14],
      notes: '高昌故城。'
    }),
    焉耆: block({
      name: '焉耆', terrain: '盆地', divisionType: '城', regionType: 'oasis_beglik', officialPosition: '焉耆伯克',
      specialResources: '马·鱼·粮', tags: {},
      description: '开都河畔的焉耆盆地，博斯腾湖水草丰美，蒙古与回回诸部杂居，卫拉特骑兵时来放牧。',
      commerce: 0.9, fishing: 0, corridor: 1.1, keju: 0,
      idx: [44, 28, 40, 40, 70, 40, 66, 42], fisc: [0.68, 0.14],
      notes: '博斯腾湖。'
    })
  },
  regionMeans: { development: 45, unrest: 67, taxPressure: 40, armyPressure: 62, officeRisk: 42 }
};

// ---------------------------------------------------------------- 哈萨克
const KAZAKH = {
  faction: '哈萨克汗国', province: '哈萨克', fiscalRates: 'province',
  UNITS: [unit('哈萨克', 680000, 10, 10, 1, { block: 'ming-20' })],
  BLOCKS: {
    'ming-20': block({
      name: '哈萨克', terrain: '草原', divisionType: '部', regionType: 'nomadic_khanate', officialPosition: '哈萨克汗',
      specialResources: '马·羊·商货', tags: { horseRegion: true, mineralRegion: true },
      description: '锡尔河流域与七河之间的哈萨克汗国核心，也昔木汗以突厥斯坦为都，与据塔什干的图尔逊汗争雄；诸苏丹各领部众，草场争夺时起。',
      commerce: 1.0, fishing: 0, mineral: 1, kuangchang: 1, horse: 1, corridor: 1.0, keju: 0,
      idx: [39, 18, 39, 39, 78, 64, 62, 49], fisc: [0.42, 0.08],
      accounts: [
        { name: '突厥斯坦', weight: 0.2, governor: '也昔木汗', divisionType: '城', terrain: '绿洲', officialPosition: '哈萨克汗',
          specialResources: '商货·马·粮', description: '亚萨维陵所在的圣城，也昔木汗的都城，锡尔河商道上的重镇。' },
        { name: '赛兰', weight: 0.14, divisionType: '城', terrain: '绿洲', officialPosition: '苏丹',
          specialResources: '粮·瓜果·马', description: '锡尔河支流上的古城，农耕与商队并兴。' },
        { name: '塔什干边地', weight: 0.2, governor: '图尔逊穆罕默德汗', divisionType: '城', terrain: '绿洲', officialPosition: '塔什干汗',
          specialResources: '银·粮·棉', description: '塔什干一带的绿洲，图尔逊汗据此自立，与也昔木汗争夺汗位；附近伊拉克山中有银矿。' },
        { name: '楚河牧场', weight: 0.17, divisionType: '部', terrain: '草原', officialPosition: '苏丹',
          specialResources: '马·羊', description: '楚河与塔拉斯河流域的丰美牧场，大玉兹诸部冬夏转场于此。' },
        { name: '锡尔河城镇', weight: 0.15, divisionType: '镇', terrain: '绿洲', officialPosition: '苏丹',
          specialResources: '粮·商货', description: '锡尔河中下游的讹答剌、昔格纳黑、扫兰诸城，昔日商城，今归哈萨克汗国控制。' },
        { name: '萨雷苏牧地', weight: 0.14, divisionType: '部', terrain: '荒漠', officialPosition: '苏丹',
          specialResources: '马·羊·骆驼', description: '萨雷苏河流域的荒原草场，中玉兹部众游牧，地广人稀。' }
      ],
      notes: '也昔木汗（1598—1628 在位）；图尔逊汗据塔什干。'
    })
  },
  regionMeans: { development: 39, unrest: 78, taxPressure: 64, armyPressure: 62, officeRisk: 49 }
};

const WHITE = cold('白灾风险');
const KAZAKH_NORTH = {
  faction: '哈萨克汗国', province: '北哈萨克', fiscalRates: 'province',
  UNITS: [unit('北哈萨克', 420000, 10, 10, 1, { block: 'ming2-27' })],
  BLOCKS: {
    'ming2-27': block({
      name: '北哈萨克', terrain: '草原', divisionType: '部', regionType: 'nomadic_khanate', officialPosition: '苏丹',
      specialResources: '马·羊·盐', tags: { horseRegion: true },
      description: '咸海以北、托博尔河与伊希姆河流域的北部草原，中玉兹诸苏丹部众游牧；北方俄罗斯人已在托博尔斯克、塔拉筑城，互市与冲突并起。',
      commerce: 0.8, fishing: 0, salt: 1, horse: 1, corridor: 0.8, keju: 0,
      idx: [34, 18, 34, 34, 81, 64, 62, 49], fisc: [0.42, 0.08],
      disasterRecord: [WHITE],
      accounts: [
        { name: '托博尔草原', weight: 0.25, divisionType: '部', terrain: '草原', officialPosition: '苏丹',
          specialResources: '马·羊', description: '托博尔河上游的草原，北接俄罗斯人所筑的秋明、托博尔斯克。' },
        { name: '伊希姆牧地', weight: 0.20, divisionType: '部', terrain: '草原', officialPosition: '苏丹',
          specialResources: '马·羊', description: '伊希姆河流域的草场，诸苏丹的夏季牧地。' },
        { name: '额尔齐斯西岸', weight: 0.19, divisionType: '部', terrain: '草原', officialPosition: '苏丹',
          specialResources: '盐·马·羊', description: '额尔齐斯河西岸，亚梅什盐湖的盐在此与俄国商人交易。' },
        { name: '库斯塔奈', weight: 0.18, divisionType: '部', terrain: '草原', officialPosition: '苏丹',
          specialResources: '马·羊', description: '托博尔河中游的平坦草原，牧民与西伯利亚鞑靼人往来。' },
        { name: '科克舍套', weight: 0.18, divisionType: '部', terrain: '林地', officialPosition: '苏丹',
          specialResources: '木材·马·羊', description: '草原北部的科克舍套丘陵林地，湖泊星布，为诸苏丹避暑之地。' }
      ],
      notes: '托博尔斯克（1587 年建）、塔拉（1594 年建）。'
    })
  },
  regionMeans: { development: 34, unrest: 81, taxPressure: 64, armyPressure: 62, officeRisk: 49 }
};

const KAZAKH_EAST = {
  faction: '哈萨克汗国', province: '东哈萨克', fiscalRates: 'province',
  UNITS: [unit('东哈萨克', 360000, 10, 10, 1, { block: 'ming2-28' })],
  BLOCKS: {
    'ming2-28': block({
      name: '东哈萨克', terrain: '草原', divisionType: '部', regionType: 'nomadic_khanate', officialPosition: '苏丹',
      specialResources: '马·羊·骆驼', tags: { horseRegion: true },
      description: '巴尔喀什湖以东、面向天山北路的东部牧地，与卫拉特诸部犬牙交错，边牧冲突多于核心草原。',
      commerce: 0.7, fishing: 0, horse: 1, corridor: 0.8, keju: 0,
      idx: [32, 18, 32, 32, 85, 64, 70, 49], fisc: [0.42, 0.08],
      accounts: [
        { name: '巴尔喀什北岸', weight: 0.25, divisionType: '部', terrain: '荒漠', officialPosition: '苏丹',
          specialResources: '马·羊·鱼', description: '巴尔喀什湖北岸的荒漠草原，诸部冬季牧场。' },
        { name: '斋桑湖', weight: 0.20, divisionType: '部', terrain: '草原', officialPosition: '苏丹',
          specialResources: '鱼·马·羊', description: '额尔齐斯河上游的斋桑湖畔，哈萨克与卫拉特牧地犬牙交错。' },
        { name: '塔尔巴哈台东麓', weight: 0.19, divisionType: '部', terrain: '草原', officialPosition: '苏丹',
          specialResources: '马·羊', description: '塔尔巴哈台山东麓，与卫拉特诸部相接，边牧冲突最多。' },
        { name: '额尔齐斯上游', weight: 0.18, divisionType: '部', terrain: '草原', officialPosition: '苏丹',
          specialResources: '马·羊', description: '额尔齐斯河上游河谷，卫拉特与哈萨克争夺的牧场。' },
        { name: '阿拉湖道', weight: 0.18, divisionType: '道', terrain: '荒漠', officialPosition: '苏丹',
          specialResources: '驼·马', description: '阿拉湖与准噶尔山口之间的通道，东西往来的要隘，大风终年不息。' }
      ],
      notes: '准噶尔山口。'
    })
  },
  regionMeans: { development: 32, unrest: 85, taxPressure: 64, armyPressure: 70, officeRisk: 49 }
};

// ---------------------------------------------------------------- 野人女真
const KUYE = {
  faction: '野人女真诸部', province: '苦兀（野人女真）', fiscalRates: 'province',
  UNITS: [unit('苦兀', 45000, 10, 10, 1, { block: 'ming2-22' })],
  BLOCKS: {
    'ming2-22': block({
      name: '苦兀（野人女真）', terrain: '寒地', divisionType: '部', regionType: 'tribal_frontier', officialPosition: '部落首领',
      specialResources: '貂皮·鱼·海豹皮', tags: { hasPort: true, fishingRegion: true },
      description: '黑龙江入海口与苦兀岛（库页岛）一带，费雅喀、苦兀诸部以渔猎为生；明初奴儿干都司曾设于此，久已废弃，诸部以貂皮与虾夷地、后金往来交易。',
      commerce: 0.8, maritime: 1, salt: 1, fishing: 1, corridor: 0.5, keju: 0,
      idx: [26, 18, 26, 26, 85, 64, 75, 49], fisc: [0.42, 0.08],
      disasterRecord: [cold('严寒歉获')],
      accounts: [
        { name: '苦兀岛', weight: 0.22, divisionType: '岛', terrain: '寒地', officialPosition: '部落首领',
          specialResources: '鱼·海豹皮', description: '库页岛北部，苦兀人与费雅喀人渔猎海兽。' },
        { name: '黑龙江下游', weight: 0.22, divisionType: '部', terrain: '林地', officialPosition: '部落首领',
          specialResources: '貂皮·鲑鱼', description: '黑龙江下游的特林一带，明初奴儿干都司旧址与永宁寺碑犹存。' },
        { name: '费雅喀海岸', weight: 0.18, divisionType: '部', terrain: '寒地', officialPosition: '部落首领',
          specialResources: '鱼·海豹皮', description: '鞑靼海峡西岸，费雅喀人捕鱼、猎海豹。' },
        { name: '库页岛南部', weight: 0.2, divisionType: '部', terrain: '寒地', officialPosition: '部落首领',
          specialResources: '鱼·山丹锦', description: '库页岛南部，与虾夷地阿伊努人隔宗谷海峡往来，山丹锦由此南传。' },
        { name: '萨哈连渔猎地', weight: 0.18, divisionType: '部', terrain: '林地', officialPosition: '部落首领',
          specialResources: '鲑鱼·貂皮', description: '黑龙江口两岸的渔猎地，诸部夏捕鲑鳟、冬猎貂鼠。' }
      ],
      notes: '奴儿干都司（永乐九年设，宣德后废）；永宁寺碑。'
    })
  },
  regionMeans: { development: 26, unrest: 85, taxPressure: 64, armyPressure: 75, officeRisk: 49 }
};

const BEISHAN = {
  faction: '野人女真诸部', province: '北山女真', fiscalRates: 'province',
  UNITS: [unit('北山女真', 105000, 10, 10, 1, { block: 'ming2-31' })],
  BLOCKS: {
    'ming2-31': block({
      name: '北山女真', terrain: '林地', divisionType: '部', regionType: 'tribal_frontier', officialPosition: '部落首领',
      specialResources: '貂皮·人参·鱼', tags: { hasPort: true, fishingRegion: true },
      description: '黑龙江中游、乌苏里江与松花江下游的山林水网，虎尔哈、瓦尔喀诸部渔猎采参；后金近年屡遣兵北征，掳其丁口编入八旗。',
      commerce: 0.8, maritime: 1, salt: 1, fishing: 1, corridor: 0.6, keju: 0,
      idx: [30, 18, 30, 30, 83, 64, 75, 49], fisc: [0.42, 0.08],
      disasterRecord: [cold('山林严寒')],
      accounts: [
        { name: '黑龙江中游', weight: 0.25, governor: '黑龙江部酋', divisionType: '部', terrain: '林地', officialPosition: '部落首领',
          specialResources: '貂皮·粮·鱼', description: '黑龙江中游两岸的达斡尔、索伦诸部，农猎兼营，以貂皮为贡。' },
        { name: '乌苏里江', weight: 0.2, governor: '瓦尔喀部头目', divisionType: '部', terrain: '林地', officialPosition: '部落首领',
          specialResources: '人参·貂皮·鱼', description: '乌苏里江流域的瓦尔喀诸部，山林深密，后金屡次征讨。' },
        { name: '松花江北岸', weight: 0.2, divisionType: '部', terrain: '林地', officialPosition: '部落首领',
          specialResources: '鱼·貂皮', description: '松花江下游北岸的渔猎部落，冬季凿冰捕鱼。' },
        { name: '宁古塔旧地', weight: 0.17, divisionType: '部', terrain: '林地', officialPosition: '部落首领',
          specialResources: '人参·木材', description: '牡丹江上游的山林，诸部散居，后金兵锋北指之地。' },
        { name: '呼尔哈部', weight: 0.18, governor: '虎尔哈部酋', divisionType: '部', terrain: '林地', officialPosition: '部落首领',
          specialResources: '貂皮·鱼·人参', description: '牡丹江流域的虎尔哈部，天命、天聪间屡受后金征讨，部众多被迁往辽东。' }
      ],
      notes: '后金征虎尔哈、瓦尔喀。'
    })
  },
  regionMeans: { development: 30, unrest: 83, taxPressure: 64, armyPressure: 75, officeRisk: 49 }
};

// ---------------------------------------------------------------- 澳门
const MACAU = {
  faction: '葡萄牙·澳门', province: '澳门葡人租居地', fiscalRates: 'province',
  UNITS: [unit('澳门', 13500, 10, 10, 1, { block: 'ming-31' })],
  BLOCKS: {
    'ming-31': block({
      name: '澳门（葡萄牙占）', terrain: '沿海', divisionType: '港', regionType: 'leased_port', officialPosition: '总督',
      specialResources: '生丝·白银·火炮', tags: { hasPort: true, fishingRegion: true },
      description: '香山县南端的濠镜澳，葡萄牙人自嘉靖年间租居，岁纳地租银五百两；天启二年击退荷兰人进攻，城墙炮台新成。船队往来长崎、马尼拉与果阿，以中国生丝换取白银；今年城中新设铸炮场，并为明廷铸炮、招募炮手。',
      commerce: 2.4, maritime: 1, fishing: 1, corridor: 0.8, keju: 0,
      idx: [59, 31, 59, 59, 60, 49, 75, 55], fisc: [0.55, 0.12],
      accounts: [
        { name: '澳门城', weight: 0.26, governor: '斐理伯·罗保', divisionType: '城', terrain: '沿海', officialPosition: '总督',
          specialResources: '白银·商货', description: '葡人议事会与兵头所驻的城区，城墙、炮台围护，商务由议事会掌管。' },
        { name: '三巴区', weight: 0.13, divisionType: '坊', terrain: '沿海', officialPosition: '殖民属官',
          specialResources: '书籍·天文仪器', description: '耶稣会圣保禄学院与教堂所在，教士由此入华传教，历算之学亦由此传入。' },
        { name: '内港', weight: 0.17, divisionType: '港', terrain: '沿海', officialPosition: '商馆长',
          specialResources: '生丝·火炮', description: '半岛西侧的内港，商船停泊卸货，与香山、广州往来交易；今年新设的铸炮场在此附近。' },
        { name: '妈阁', weight: 0.12, divisionType: '坊', terrain: '沿海', officialPosition: '殖民属官',
          specialResources: '鱼·香火', description: '半岛南端的妈祖阁，闽粤渔民与水手所奉，澳门之名即由此而来。' },
        { name: '氹仔', weight: 0.105, divisionType: '岛', terrain: '岛屿', officialPosition: '殖民属官',
          specialResources: '鱼·蚝', description: '澳门南面的海岛，渔户聚居，船只避风之所。' },
        { name: '路环', weight: 0.105, divisionType: '岛', terrain: '岛屿', officialPosition: '殖民属官',
          specialResources: '鱼·柴薪', description: '氹仔以南的海岛，山多田少，渔户散居，海盗时有出没。' },
        { name: '香山海道', weight: 0.11, divisionType: '道', terrain: '沿海', officialPosition: '殖民属官',
          specialResources: '粮·柴薪', description: '澳门与香山县之间的海道与关闸，明廷设关闸控制粮食与人员出入。' }
      ],
      notes: '荷兰攻澳门（天启二年）；博卡罗铸炮场（1627）；关闸（万历元年）。'
    })
  },
  regionMeans: { development: 59, unrest: 60, taxPressure: 49, armyPressure: 75, officeRisk: 55 }
};

// ---------------------------------------------------------------- 大员
const TAYOUAN = {
  faction: '荷兰·台海(东印度公司)', province: '大员荷兰商馆区', fiscalRates: 'province',
  UNITS: [
    unit('大员', 8000, 4, 3, 1),
    unit('赤崁', 7000, 5, 30, 0.5),
    unit('北线尾', 2500, 1, 2, 0.2),
    unit('新港社', 4000, 3, 20, 0.2),
    unit('目加溜湾社', 3000, 2, 15, 0.2),
    unit('萧垄社', 4000, 3, 15, 0.2),
    unit('淡水社', 3500, 2, 10, 0.2),
    unit('鸡笼港', 3500, 2, 5, 0.5)
  ],
  BLOCKS: {
    大员: block({
      name: '大员', terrain: '沿海', divisionType: '城', regionType: 'company_colony', officialPosition: '大员长官', governor: '杰拉德·德威特',
      specialResources: '鹿皮·生丝·糖', tags: { hasPort: true, fishingRegion: true },
      description: '台江内海口外的沙洲大员，荷兰东印度公司天启四年自澎湖撤来，筑热兰遮城为商馆与要塞，收购鹿皮与中国生丝转售日本。',
      commerce: 2.2, maritime: 0.6, salt: 0.3, fishing: 0.2, corridor: 0.8, keju: 0,
      idx: [40, 34, 44, 44, 68, 49, 76, 57], fisc: [0.55, 0.12],
      notes: '热兰遮城（1624 年始筑）。'
    }),
    赤崁: block({
      name: '赤崁', terrain: '平原', divisionType: '乡', regionType: 'company_colony', officialPosition: '殖民属官',
      specialResources: '稻米·甘蔗·鹿皮', tags: { fishingRegion: true },
      description: '台江内海东岸的赤崁，闽南移民聚居垦殖，与荷兰人交易，种稻、种蔗渐多。',
      commerce: 1.4, maritime: 0.1, salt: 0.4, fishing: 0.2, corridor: 0.8, keju: 0,
      idx: [40, 34, 42, 42, 68, 49, 72, 57], fisc: [0.55, 0.12],
      notes: '汉人移民。'
    }),
    北线尾: block({
      name: '北线尾', terrain: '沿海', divisionType: '沙洲', regionType: 'company_colony', officialPosition: '殖民属官',
      specialResources: '鱼·盐', tags: { fishingRegion: true },
      description: '大员北面的沙洲，扼鹿耳门航道，渔民搭寮晒网。',
      commerce: 0.8, maritime: 0.1, salt: 0.3, fishing: 0.3, corridor: 0.6, keju: 0,
      idx: [38, 34, 36, 36, 70, 49, 76, 57], fisc: [0.55, 0.12],
      notes: '鹿耳门。'
    }),
    新港社: block({
      name: '新港社', terrain: '平原', divisionType: '社', regionType: 'company_colony', officialPosition: '头目',
      specialResources: '鹿皮·粟·稻', tags: {},
      description: '西拉雅人的新港社，与荷兰人结好；今年起有传教士来此传教、识字。',
      commerce: 0.7, fishing: 0, corridor: 0.6, keju: 0,
      idx: [40, 34, 36, 36, 68, 49, 70, 57], fisc: [0.55, 0.12],
      notes: '干治士（Candidius）1627 年至新港。'
    }),
    目加溜湾社: block({
      name: '目加溜湾社', terrain: '平原', divisionType: '社', regionType: 'company_colony', officialPosition: '头目',
      specialResources: '鹿皮·粟', tags: {},
      description: '西拉雅诸社之一，以狩鹿、耕作为生，与荷兰人时和时战。',
      commerce: 0.6, fishing: 0, corridor: 0.6, keju: 0,
      idx: [36, 34, 34, 34, 72, 49, 72, 57], fisc: [0.55, 0.12],
      notes: '西拉雅。'
    }),
    萧垄社: block({
      name: '萧垄社', terrain: '平原', divisionType: '社', regionType: 'company_colony', officialPosition: '头目',
      specialResources: '鹿皮·粟·鱼', tags: {},
      description: '西拉雅诸社中人口较多的一社，与麻豆社相邻，常为争夺猎场结怨。',
      commerce: 0.6, fishing: 0, corridor: 0.6, keju: 0,
      idx: [36, 34, 34, 34, 72, 49, 72, 57], fisc: [0.55, 0.12],
      notes: '西拉雅。'
    }),
    淡水社: block({
      name: '淡水社', terrain: '丘陵', divisionType: '社', regionType: 'company_colony', officialPosition: '头目',
      specialResources: '硫磺·鹿皮·鱼', tags: { fishingRegion: true },
      description: '北台湾淡水河口的平埔诸社，汉人渔船与商人往来，北投一带出硫磺；荷兰与西班牙人都在觊觎。',
      commerce: 0.8, maritime: 0.1, fishing: 0.15, corridor: 0.6, keju: 0,
      idx: [36, 34, 34, 34, 72, 49, 76, 57], fisc: [0.55, 0.12],
      notes: '北投硫磺。'
    }),
    鸡笼港: block({
      name: '鸡笼港', terrain: '沿海', divisionType: '港', regionType: 'company_colony', officialPosition: '商馆长',
      specialResources: '硫磺·鱼·煤', tags: { hasPort: true, fishingRegion: true },
      description: '北台湾的良港，去年西班牙人自马尼拉来据社寮岛筑城，荷兰人视为心腹之患，港口实为两国相争之地。',
      commerce: 1.0, maritime: 0.1, fishing: 0.15, corridor: 0.7, keju: 0,
      idx: [34, 34, 34, 34, 76, 49, 82, 57], fisc: [0.55, 0.12],
      notes: '西班牙据鸡笼（1626）。'
    })
  },
  regionMeans: { development: 38, unrest: 71, taxPressure: 49, armyPressure: 75, officeRisk: 57 }
};

// ---------------------------------------------------------------- 马尼拉
const MANILA = {
  faction: '西班牙·马尼拉', province: '菲律宾马尼拉总督区', fiscalRates: 'province',
  UNITS: [
    unit('马尼拉', 100000, 10, 3, 1),
    unit('甲米地', 45000, 5, 5, 0.5),
    unit('拉古纳', 70000, 16, 20, 0.5),
    unit('邦板牙', 80000, 20, 25, 0.5),
    unit('伊罗戈', 80000, 15, 15, 0.5),
    unit('卡加延', 60000, 12, 12, 0.5),
    unit('邦阿西楠', 64500, 16, 20, 0.5)
  ],
  BLOCKS: {
    马尼拉: block({
      name: '马尼拉', terrain: '沿海', divisionType: '城', regionType: 'colonial_governorate', officialPosition: '总督',
      governor: '胡安·尼尼奥·德塔沃拉', specialResources: '白银·丝绸·瓷器', tags: { hasPort: true, fishingRegion: true },
      description: '西班牙在东方的首府，王城内有总督府与教堂，城外八连住着两万余华商；大帆船每年载中国丝绸瓷器驶往阿卡普尔科，换回美洲白银。',
      commerce: 2.6, maritime: 0.6, fishing: 0.2, corridor: 1.2, keju: 0,
      idx: [38, 49, 44, 44, 70, 49, 74, 68], fisc: [0.55, 0.12],
      notes: '马尼拉大帆船；八连（Parián）。'
    }),
    甲米地: block({
      name: '甲米地', terrain: '沿海', divisionType: '港', regionType: 'colonial_governorate', officialPosition: '总督属官',
      specialResources: '船材·商货·鱼', tags: { hasPort: true, fishingRegion: true },
      description: '马尼拉湾南岸的港口与船厂，大帆船在此修造出航；去年远征北台湾鸡笼的船队即由此启航。',
      commerce: 1.6, maritime: 0.3, fishing: 0.15, corridor: 1.0, keju: 0,
      idx: [36, 49, 36, 36, 72, 49, 78, 68], fisc: [0.55, 0.12],
      notes: '甲米地船厂。'
    }),
    拉古纳: block({
      name: '拉古纳', terrain: '水乡', divisionType: '省', regionType: 'colonial_governorate', officialPosition: '总督属官',
      specialResources: '稻米·椰子·鱼', tags: { fishingRegion: true },
      description: '马尼拉东南的湖区，方济各会的传教村落环湖而建，稻米、椰子丰饶。',
      commerce: 0.9, maritime: 0.02, fishing: 0.2, corridor: 0.9, keju: 0,
      idx: [34, 49, 32, 32, 74, 49, 74, 68], fisc: [0.55, 0.12],
      notes: '方济各会。'
    }),
    邦板牙: block({
      name: '邦板牙', terrain: '平原', divisionType: '省', regionType: 'colonial_governorate', officialPosition: '总督属官',
      specialResources: '稻米·木材', tags: { fishingRegion: true },
      description: '吕宋中部的稻米之乡，邦板牙人多应募为西班牙兵，是殖民政府最倚重的属民。',
      commerce: 0.9, maritime: 0.02, fishing: 0.1, corridor: 0.9, keju: 0,
      idx: [36, 49, 34, 34, 72, 49, 74, 68], fisc: [0.55, 0.12],
      notes: '邦板牙兵。'
    }),
    伊罗戈: block({
      name: '伊罗戈', terrain: '沿海', divisionType: '省', regionType: 'colonial_governorate', officialPosition: '总督属官',
      specialResources: '棉布·金·稻米', tags: { mineralRegion: true, fishingRegion: true },
      description: '吕宋西北沿海，奥斯定会传教；山中伊哥洛特人采金，下山交易。',
      commerce: 0.8, maritime: 0.02, mineral: 0.5, kuangchang: 1, fishing: 0.1, corridor: 0.8, keju: 0,
      idx: [32, 49, 30, 30, 76, 49, 74, 68], fisc: [0.55, 0.12],
      notes: '伊哥洛特金矿。'
    }),
    卡加延: block({
      name: '卡加延', terrain: '河谷', divisionType: '省', regionType: 'colonial_governorate', officialPosition: '总督属官',
      specialResources: '烟草·稻米·木材', tags: { mineralRegion: true, fishingRegion: true },
      description: '吕宋东北的卡加延河谷，新塞哥维亚主教驻此，多明我会传教，山民时有反抗。',
      commerce: 0.7, maritime: 0.02, mineral: 0.2, fishing: 0.1, corridor: 0.7, keju: 0,
      idx: [30, 49, 28, 28, 78, 49, 76, 68], fisc: [0.55, 0.12],
      notes: '新塞哥维亚。'
    }),
    邦阿西楠: block({
      name: '邦阿西楠', terrain: '平原', divisionType: '省', regionType: 'colonial_governorate', officialPosition: '总督属官',
      specialResources: '稻米·盐·金', tags: { mineralRegion: true, fishingRegion: true },
      description: '林加延湾畔的邦阿西楠，盛产稻米与盐，多明我会传教。',
      commerce: 0.8, maritime: 0.02, mineral: 0.3, fishing: 0.15, corridor: 0.8, keju: 0,
      idx: [32, 49, 30, 30, 76, 49, 74, 68], fisc: [0.55, 0.12],
      notes: '林加延湾。'
    })
  },
  regionMeans: { development: 34, unrest: 74, taxPressure: 49, armyPressure: 75, officeRisk: 68 }
};

module.exports = [YARKAND, TURFAN, KAZAKH, KAZAKH_NORTH, KAZAKH_EAST, KUYE, BEISHAN, MACAU, TAYOUAN, MANILA];
