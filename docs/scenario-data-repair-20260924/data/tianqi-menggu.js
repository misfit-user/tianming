// 天启剧本·蒙古诸部 34 块（察哈尔两辖区 10、科尔沁 6、土默特 6、喀尔喀 6、瓦剌 6）
//
// 天启七年（1627）的草原：察哈尔林丹汗受后金与东部诸部离心所迫，今年起率部西迁，攻喀喇沁、永谢布，
// 兵锋逼近归化城土默特；科尔沁奥巴等部天启四年起与后金盟誓联姻（布木布泰前年嫁皇太极），为后金左翼；
// 漠北喀尔喀土谢图、车臣、扎萨克图三汗鼎立，远离明廷；西北卫拉特四部（准噶尔、和硕特、杜尔伯特、土尔扈特）
// 与喀尔喀连年相争，土尔扈特正酝酿西徙。
// （布木布泰天命十年嫁皇太极，奥巴天命十一年受封土谢图汗。）
// 这些都是游牧部落，没有户口册，人口按各部大小与牧场优劣估；税粮即贡赋，大体随人口；田亩极少，给近边农耕区。
// 科尔沁、土默特、喀尔喀、瓦剌四处地图各只画一块，省下各叶子都是这一块的分账，数据模块按分账写。
// 各块沿用省里的征到比例与截留率（与改前各叶子相同）；聚落写比例的省份各块照抄。
// 剧本原来的官称「台吉/部酋」改为台吉，汗帐写可汗或汗；掌官只写人物表里有、且确知其牧地的人。
// 剧本记在灾异里的「部盟分化」「牧场争夺」「部盟分裂」不是灾害，写进描述。
'use strict';

const { block } = require('./lib-blocks');

const unit = (name, mouths, grain, land, countyCount, extra) => Object.assign({
  name, countyCount, weights: { pop: mouths, households: mouths, grain, land },
  basis: '游牧部落无户口册，按部众大小与牧场估。'
}, extra || {});

const CHAHAR_CORE = {
  faction: '察哈尔', province: '察哈尔漠南牧地', fiscalRates: 'province',
  UNITS: [
    unit('察哈尔本部', 90000, 9, 6, 2),
    unit('林丹汗大帐', 80000, 8, 3, 2),
    unit('宣府塞外牧地', 60000, 6, 8, 2),
    unit('西拉木伦河', 50000, 5, 6, 2),
    unit('克什克腾边地', 50000, 5, 3, 1)
  ],
  BLOCKS: {
    察哈尔本部: block({
      name: '察哈尔本部', terrain: '草原', divisionType: '部', regionType: 'jimi', officialPosition: '诺颜',
      specialResources: '马·羊·皮毛', tags: { horseRegion: true },
      description: '察哈尔八鄂托克的本营牧地，蒙古大汗直属部众所在；东部诸部纷纷离心投向后金，林丹汗以兵威强令归附，部众疲于征战。',
      commerce: 0.7, fishing: 0, horse: 0.25, corridor: 1.0, keju: 0,
      idx: [42, 34, 44, 44, 70, 49, 62, 57], fisc: [0.55, 0.12],
      notes: '察哈尔八鄂托克。'
    }),
    林丹汗大帐: block({
      name: '林丹汗大帐', terrain: '草原', divisionType: '汗帐', regionType: 'jimi', officialPosition: '可汗', governor: '林丹汗',
      specialResources: '马·金帐·经卷', tags: { horseRegion: true },
      description: '林丹汗的移动金帐，随汗西迁；汗奉萨迦派沙尔巴呼图克图为师，崇奉藏传佛教。今年起挥兵西进，攻喀喇沁、永谢布，欲重振大汗号令。',
      commerce: 1.0, fishing: 0, horse: 0.25, corridor: 1.0, keju: 0,
      idx: [46, 34, 48, 48, 66, 49, 70, 57], fisc: [0.55, 0.12],
      notes: '林丹汗（1604 年即位）。'
    }),
    宣府塞外牧地: block({
      name: '宣府塞外牧地', terrain: '草原', divisionType: '部', regionType: 'jimi', officialPosition: '诺颜',
      specialResources: '马·羊·互市货', tags: { horseRegion: true },
      description: '宣府边墙以北的坝上草原，察哈尔部众在此逐水草，每年向明廷索取抚赏，互市与扰边交替。',
      commerce: 1.0, fishing: 0, horse: 0.2, corridor: 1.1, keju: 0,
      idx: [42, 34, 44, 44, 70, 49, 60, 57], fisc: [0.55, 0.12],
      notes: '宣府抚赏。'
    }),
    西拉木伦河: block({
      name: '西拉木伦河', terrain: '草原', divisionType: '部', regionType: 'jimi', officialPosition: '诺颜',
      specialResources: '马·牛·粮', tags: { horseRegion: true },
      description: '西拉木伦河流域的巴林、翁牛特旧牧地，河谷间有零星农垦；林丹汗旧都察汉浩特在其北，今随汗西迁而渐空。',
      commerce: 0.7, fishing: 0, horse: 0.15, corridor: 0.9, keju: 0,
      idx: [40, 34, 42, 42, 72, 49, 62, 57], fisc: [0.55, 0.12],
      notes: '察汉浩特。'
    }),
    克什克腾边地: block({
      name: '克什克腾边地', terrain: '草原', divisionType: '部', regionType: 'jimi', officialPosition: '诺颜',
      specialResources: '马·羊·木材', tags: { horseRegion: true },
      description: '大兴安岭南端的克什克腾草原与林地，察哈尔东境，与科尔沁、喀尔喀五部接壤，战事频仍。',
      commerce: 0.6, fishing: 0, horse: 0.15, corridor: 0.8, keju: 0,
      idx: [40, 34, 40, 40, 72, 49, 64, 57], fisc: [0.55, 0.12],
      notes: '察哈尔东境。'
    })
  },
  regionMeans: { development: 43, unrest: 69, taxPressure: 49, armyPressure: 62, officeRisk: 57 }
};

const MONAN = {
  faction: '察哈尔', province: '漠南诸部', fiscalRates: 'province',
  UNITS: [
    unit('张家口互市', 70000, 8, 5, 1),
    unit('归化城外诸营', 80000, 9, 6, 1),
    unit('鄂尔多斯东部', 90000, 9, 5, 0.5),
    unit('察哈尔边帐', 40000, 4, 2, 0.5),
    unit('大同塞外牧场', 50000, 5, 4, 0.5)
  ],
  BLOCKS: {
    张家口互市: block({
      name: '张家口互市', terrain: '草原', divisionType: '市', regionType: 'nomadic_confederation', officialPosition: '诺颜',
      specialResources: '马市·皮毛·茶布', tags: { horseRegion: true },
      description: '张家口边墙外的喀喇沁诸部营地，每年与明廷互市，以马匹、皮毛易茶叶、布帛；今年察哈尔西迁，喀喇沁首当其冲。',
      commerce: 2.2, fishing: 0, horse: 0.2, corridor: 1.2, keju: 0,
      idx: [38, 18, 42, 42, 76, 64, 62, 49], fisc: [0.42, 0.08],
      notes: '张家口马市。'
    }),
    归化城外诸营: block({
      name: '归化城外诸营', terrain: '草原', divisionType: '部', regionType: 'nomadic_confederation', officialPosition: '诺颜',
      specialResources: '马·羊·粮', tags: { horseRegion: true },
      description: '归化城外的永谢布、阿速特诸部营地，与土默特犬牙交错；察哈尔兵西来，诸部或降或走。',
      commerce: 1.2, fishing: 0, horse: 0.2, corridor: 1.0, keju: 0,
      idx: [36, 18, 38, 38, 80, 64, 62, 49], fisc: [0.42, 0.08],
      notes: '永谢布。'
    }),
    鄂尔多斯东部: block({
      name: '鄂尔多斯东部', terrain: '荒漠', divisionType: '部', regionType: 'nomadic_confederation', officialPosition: '济农',
      specialResources: '马·羊·盐', tags: { horseRegion: true },
      description: '河套以南的鄂尔多斯高原，济农统领鄂尔多斯万户，与延绥边墙相望，时入边抢掠，亦赴边市互易。',
      commerce: 0.8, fishing: 0, horse: 0.3, corridor: 0.8, keju: 0,
      idx: [38, 18, 36, 36, 78, 64, 62, 49], fisc: [0.42, 0.08],
      notes: '鄂尔多斯济农。'
    }),
    察哈尔边帐: block({
      name: '察哈尔边帐', terrain: '草原', divisionType: '部', regionType: 'nomadic_confederation', officialPosition: '诺颜',
      specialResources: '马·羊', tags: { horseRegion: true },
      description: '察哈尔西迁前锋的营帐，驻于宣大塞外，随时可南下叩边索赏。',
      commerce: 0.6, fishing: 0, horse: 0.15, corridor: 0.9, keju: 0,
      idx: [34, 18, 34, 34, 82, 64, 66, 49], fisc: [0.42, 0.08],
      notes: '西迁前锋。'
    }),
    大同塞外牧场: block({
      name: '大同塞外牧场', terrain: '草原', divisionType: '部', regionType: 'nomadic_confederation', officialPosition: '诺颜',
      specialResources: '马·羊·互市货', tags: { horseRegion: true },
      description: '大同边外的丰美牧场，诸部与大同镇互市、抚赏往来，边民私市屡禁不止。',
      commerce: 1.0, fishing: 0, horse: 0.15, corridor: 1.0, keju: 0,
      idx: [36, 18, 36, 36, 80, 64, 62, 49], fisc: [0.42, 0.08],
      notes: '大同边市。'
    })
  },
  regionMeans: { development: 37, unrest: 79, taxPressure: 64, armyPressure: 62, officeRisk: 49 }
};

const KHORCHIN = {
  faction: '科尔沁蒙古', province: '科尔沁东蒙古牧地', fiscalRates: 'province',
  UNITS: [unit('科尔沁', 280000, 10, 10, 1, { block: 'ming2-30' })],
  BLOCKS: {
    'ming2-30': block({
      name: '科尔沁', terrain: '草原', divisionType: '部', regionType: 'jimi', officialPosition: '诺颜',
      specialResources: '马·牛·羊', tags: { horseRegion: true },
      description: '嫩江与西拉木伦河之间的东蒙古草原，嫩科尔沁诸部所在。天启四年奥巴等与后金盟誓，前年寨桑之女布木布泰嫁皇太极，去年奥巴受努尔哈赤封土谢图汗，科尔沁遂为后金左翼，屡与察哈尔交兵。',
      commerce: 0.8, fishing: 0, horse: 1, corridor: 1.0, keju: 0,
      idx: [61, 27, 61, 61, 59, 49, 62, 52], fisc: [0.55, 0.12],
      accounts: [
        { name: '科尔沁左翼', weight: 0.23, governor: '寨桑台吉', terrain: '草原', divisionType: '部', officialPosition: '诺颜',
          specialResources: '马·牛·羊',
          description: '莽古思、寨桑父子一系的牧地，与后金联姻最深，哲哲、布木布泰皆出此系。' },
        { name: '科尔沁右翼', weight: 0.22, governor: '奥巴台吉', terrain: '草原', divisionType: '部', officialPosition: '诺颜',
          specialResources: '马·牛·羊',
          description: '奥巴所领诸部，去年受封土谢图汗，为科尔沁诸部之长，与后金盟誓抗察哈尔。' },
        { name: '嫩科尔沁', weight: 0.16, terrain: '草原', divisionType: '部', officialPosition: '诺颜',
          specialResources: '马·貂皮·粮',
          description: '嫩江中游的科尔沁旧部，兼营渔猎与农垦，与索伦、达斡尔诸部往来。' },
        { name: '郭尔罗斯', weight: 0.14, terrain: '草原', divisionType: '部', officialPosition: '诺颜',
          specialResources: '马·牛·羊',
          description: '松花江与嫩江交汇处的郭尔罗斯部，附科尔沁而居，草场丰美。' },
        { name: '杜尔伯特', weight: 0.13, terrain: '草原', divisionType: '部', officialPosition: '诺颜',
          specialResources: '马·羊·鱼',
          description: '嫩江下游东岸的杜尔伯特部，湖泡星罗，牧渔兼营。' },
        { name: '扎赉特', weight: 0.12, terrain: '草原', divisionType: '部', officialPosition: '诺颜',
          specialResources: '马·羊·皮毛',
          description: '嫩江西岸、大兴安岭东麓的扎赉特部，地僻人稀，随科尔沁诸部进退。' }
      ],
      notes: '科尔沁与后金盟誓（天启四年）；奥巴受封土谢图汗（天启六年）。'
    })
  },
  regionMeans: { development: 61, unrest: 59, taxPressure: 49, armyPressure: 62, officeRisk: 52 }
};

const TUMED = {
  faction: '土默特蒙古', province: '鞑靼土默特部', fiscalRates: 'province',
  UNITS: [unit('土默特', 260000, 10, 10, 1, { block: 'ming-16' })],
  BLOCKS: {
    'ming-16': block({
      name: '鞑靼土默特部', terrain: '草原', divisionType: '部', regionType: 'nomadic_confederation', officialPosition: '顺义王',
      specialResources: '马·羊·粮', tags: { horseRegion: true },
      description: '阴山之南、黄河之北的土默川，隆庆封贡后俺答汗子孙世袭顺义王，筑归化城，引汉民开垦板升，与明廷互市数十年。今年察哈尔林丹汗西迁压境，顺义王卜失兔势孤，诸台吉各自保营。',
      commerce: 1.2, fishing: 0, salt: 1, horse: 1, corridor: 1.0, keju: 0,
      idx: [42, 18, 42, 42, 77, 64, 62, 49], fisc: [0.42, 0.08],
      accounts: [
        { name: '归化城', weight: 0.23, governor: '卜失兔汗', terrain: '草原', divisionType: '城', officialPosition: '顺义王',
          specialResources: '马·寺院·互市货',
          description: '俺答汗所筑的库库和屯，明廷赐名归化；大召寺等寺院香火最盛，汉商与蒙古部众在此交易。' },
        { name: '土默川', weight: 0.21, terrain: '草原', divisionType: '部', officialPosition: '诺颜',
          specialResources: '粮·马·羊',
          description: '大黑河两岸的平川，汉民板升村落与蒙古营帐错落，农牧兼营。' },
        { name: '丰州滩', weight: 0.15, terrain: '草原', divisionType: '部', officialPosition: '诺颜',
          specialResources: '粮·马',
          description: '古丰州故地的平滩，逃入塞外的汉民在此垦种，号为板升。' },
        { name: '河套牧地', weight: 0.17, terrain: '草原', divisionType: '部', officialPosition: '诺颜',
          specialResources: '马·羊·盐',
          description: '黄河拐弯处的前套草场，水草丰美，诸部争牧；湖泊产盐。' },
        { name: '大青山前', weight: 0.12, governor: '素囊台吉', terrain: '山地', divisionType: '部', officialPosition: '诺颜',
          specialResources: '木材·马·羊',
          description: '大青山南麓的山前营地，素囊台吉所部驻牧，扼归化城北路。' },
        { name: '杀虎口互市', weight: 0.12, terrain: '草原', divisionType: '市', officialPosition: '诺颜',
          specialResources: '马市·茶布·皮毛',
          description: '大同右卫边外的杀虎口，与明互市的要口，茶布与马匹往来不绝。' }
      ],
      notes: '隆庆五年封贡；归化城（万历三年赐名）。'
    })
  },
  regionMeans: { development: 42, unrest: 77, taxPressure: 64, armyPressure: 62, officeRisk: 49 }
};

const KHALKHA = {
  faction: '喀尔喀蒙古', province: '喀尔喀蒙古', fiscalRates: 'province',
  UNITS: [unit('喀尔喀', 410000, 10, 10, 1, { block: 'ming2-35' })],
  BLOCKS: {
    'ming2-35': block({
      name: '喀尔喀蒙古', terrain: '草原', divisionType: '部', regionType: 'nomadic_confederation', officialPosition: '诸汗',
      specialResources: '马·羊·骆驼', tags: { horseRegion: true },
      description: '大漠以北的喀尔喀七鄂托克，土谢图、车臣、扎萨克图三汗鼎立，各统部众；额尔德尼召为漠北佛法中心。西与卫拉特连年相争，南与察哈尔若即若离，与明廷少有往来。',
      commerce: 0.7, fishing: 0, horse: 1, corridor: 0.8, keju: 0,
      idx: [34, 18, 34, 34, 81, 64, 62, 49], fisc: [0.42, 0.08],
      accounts: [
        { name: '土谢图汗部', weight: 0.24, governor: '土谢图汗衮布', terrain: '草原', divisionType: '部', officialPosition: '喀尔喀土谢图汗',
          specialResources: '马·羊·骆驼',
          description: '土拉河与鄂尔浑河之间的中路喀尔喀，土谢图汗衮布所领，为漠北诸部之首。' },
        { name: '车臣汗部', weight: 0.21, governor: '车臣汗硕垒', terrain: '草原', divisionType: '部', officialPosition: '喀尔喀车臣汗',
          specialResources: '马·羊·皮毛',
          description: '克鲁伦河以东的左翼喀尔喀，硕垒所领，东接呼伦贝尔与科尔沁。' },
        { name: '扎萨克图汗部', weight: 0.19, governor: '素巴第', terrain: '草原', divisionType: '部', officialPosition: '札萨克图汗',
          specialResources: '马·羊·骆驼',
          description: '杭爱山以西的右翼喀尔喀，素巴第所领，西与卫拉特相接，冲突最多。' },
        { name: '赛音诺颜部', weight: 0.12, terrain: '草原', divisionType: '部', officialPosition: '诺颜',
          specialResources: '马·羊',
          description: '杭爱山南北的诸台吉牧地，此时尚隶土谢图汗部，诸台吉各自游牧。' },
        { name: '鄂尔浑河谷', weight: 0.14, terrain: '草原', divisionType: '部', officialPosition: '诺颜',
          specialResources: '马·羊·寺院供养',
          description: '鄂尔浑河上游的哈剌和林故地，阿巴岱汗万历十三年在此建额尔德尼召，漠北佛法由此兴盛。' },
        { name: '克鲁伦河谷', weight: 0.10, terrain: '草原', divisionType: '部', officialPosition: '诺颜',
          specialResources: '马·羊·鱼',
          description: '克鲁伦河中游的河谷草场，成吉思汗兴起之地，今为喀尔喀诸台吉分牧。' }
      ],
      notes: '额尔德尼召（万历十三年建）。'
    })
  },
  regionMeans: { development: 34, unrest: 81, taxPressure: 64, armyPressure: 62, officeRisk: 49 }
};

const OIRAT = {
  faction: '瓦刺诸部', province: '瓦刺', fiscalRates: 'province',
  UNITS: [unit('瓦剌', 520000, 10, 10, 1, { block: 'ming-21' })],
  BLOCKS: {
    'ming-21': block({
      name: '瓦刺', terrain: '草原', divisionType: '部', regionType: 'nomadic_confederation', officialPosition: '诺颜',
      specialResources: '马·羊·骆驼', tags: { horseRegion: true, mineralRegion: true },
      description: '天山以北的卫拉特四部——准噶尔、和硕特、杜尔伯特、土尔扈特——各据牧地，推和硕特拜巴噶斯为盟长，近年皈依格鲁派；与喀尔喀连年交兵，土尔扈特部众正酝酿西徙伏尔加河。',
      commerce: 0.7, fishing: 0, mineral: 1, kuangchang: 1, horse: 1, corridor: 0.8, keju: 0,
      idx: [35, 18, 35, 35, 83, 64, 70, 49], fisc: [0.42, 0.08],
      accounts: [
        { name: '准噶尔盆地', weight: 0.25, governor: '哈喇忽剌', terrain: '荒漠', divisionType: '部', officialPosition: '诺颜',
          specialResources: '马·羊·骆驼',
          description: '准噶尔部的本营，哈喇忽剌统领，部众日盛，已隐然为四部中最强。' },
        { name: '伊犁河谷', weight: 0.17, terrain: '草原', divisionType: '部', officialPosition: '诺颜',
          specialResources: '马·粮·羊',
          description: '天山北麓最丰美的河谷草原，可耕可牧，卫拉特诸部争相驻牧。' },
        { name: '塔尔巴哈台', weight: 0.16, terrain: '草原', divisionType: '部', officialPosition: '诺颜',
          specialResources: '马·羊',
          description: '塔尔巴哈台山前的牧地，杜尔伯特、和硕特诸部往来游牧。' },
        { name: '阿尔泰山', weight: 0.14, terrain: '山地', divisionType: '部', officialPosition: '诺颜',
          specialResources: '金·马·皮毛',
          description: '阿尔泰山南麓的金山牧地，出砂金与貂皮，与喀尔喀扎萨克图汗部隔山相争。' },
        { name: '额尔齐斯上游', weight: 0.15, terrain: '草原', divisionType: '部', officialPosition: '诺颜',
          specialResources: '马·羊·鱼',
          description: '额尔齐斯河上游的草原，土尔扈特部故牧之地，部众近年多随和鄂尔勒克西去。' },
        { name: '巴尔喀什西岸', weight: 0.13, terrain: '荒漠', divisionType: '部', officialPosition: '诺颜',
          specialResources: '马·羊·盐',
          description: '巴尔喀什湖西南的荒原，卫拉特与哈萨克诸部交界，时有劫掠。' }
      ],
      notes: '卫拉特盟长拜巴噶斯；土尔扈特西徙（约崇祯元年起）。'
    })
  },
  regionMeans: { development: 35, unrest: 83, taxPressure: 64, armyPressure: 70, officeRisk: 49 }
};

module.exports = [CHAHAR_CORE, MONAN, KHORCHIN, TUMED, KHALKHA, OIRAT];
