// 天启剧本·后金三辖区 22 块（盛京辽沈 8、建州本部 6、辽东占领区 8）
//
// 天启七年即后金天聪元年：去年九月努尔哈赤死，皇太极嗣位；今年正月阿敏率军入朝鲜（丁卯之役），
// 五月攻宁远、锦州不克；六月前后辽东大饥，《清太宗实录》记「斗米价银八两，人有相食者」。
// 天命十年（1625）自辽阳迁都沈阳。辽东汉民被编入庄屯为八旗耕种，天命八年复州汉民谋逃被屠，逃人问题至今未解；
// 皇太极即位后令汉民分屯别居、另设汉官管理，稍缓民怨。
// 本省没有户口册可据，按城邑大小、平原山地与近年屠戮逃散的轻重估人口；税粮、田亩以辽河平原为重。
// 官称：天命年间八旗管兵之官称「额真」，城守称「备御」（「章京」之名天聪八年才改），剧本原写的「城守章京」改为备御；
// 各块统属旗主贝勒，沈阳为汗庭所在，掌官写皇太极（人物表里有）。
// 剧本记在建州本部的「山地寒害」改为正规灾异；辽东占领区的「战乱流离」「屯田荒芜」不是灾害，写进描述。
// 辖治类型沿用剧本原值（banner_core、banner_homeland、occupied_frontier）；征到比例与截留率各块沿用省里的（与改前各叶子相同）。
'use strict';

const { block } = require('./lib-blocks');

const unit = (name, mouths, grain, land, countyCount) => ({
  name, countyCount, weights: { pop: mouths, households: mouths, grain, land },
  basis: '按城邑大小、地形与近年屠戮逃散估人口，无册籍可据。'
});

const COLD = { type: 'cold', severity: 1, startTurn: 1, note: '山地寒害' };

const SHENGJING = {
  faction: '后金', province: '盛京辽沈八旗辖区', fiscalRates: 'province',
  UNITS: [
    unit('沈阳', 190000, 30, 26, 3),
    unit('辽阳', 140000, 26, 26, 2),
    unit('海州', 70000, 14, 16, 1),
    unit('盖州', 60000, 10, 10, 1),
    unit('复州', 45000, 7, 8, 1),
    unit('铁岭', 45000, 8, 10, 1),
    unit('开原', 40000, 6, 8, 1),
    unit('奉集堡', 30000, 5, 6, 0.5)
  ],
  BLOCKS: {
    沈阳: block({
      name: '沈阳', terrain: '平原', divisionType: '都城', regionType: 'banner_core', officialPosition: '后金汗', governor: '皇太极',
      specialResources: '粮·铁器·马', tags: { horseRegion: true },
      description: '天命十年努尔哈赤自辽阳迁都于此，汗宫大殿与八旗诸贝勒府第环列；去年皇太极嗣位，今年改元天聪。城中八旗与汉民杂处，汉官、工匠聚于汉军营，今夏辽东大饥，米价腾贵。',
      commerce: 1.8, fishing: 0, horse: 0.3, corridor: 1.4, keju: 0,
      idx: [56, 34, 70, 70, 42, 50, 86, 58], fisc: [0.60, 0.10],
      notes: '天命十年（1625）迁都沈阳。'
    }),
    辽阳: block({
      name: '辽阳', terrain: '平原', divisionType: '城', regionType: 'banner_core', officialPosition: '固山额真',
      specialResources: '粮·铁·棉布', tags: { mineralRegion: true },
      description: '辽东都司旧治，天命六年后金攻陷，于太子河东另筑东京城为都，天命十年又迁都沈阳；城中汉民最多，铁冶与棉布之业犹存。',
      commerce: 1.4, fishing: 0, mineral: 0.6, kuangchang: 1, corridor: 1.3, keju: 0,
      idx: [50, 34, 64, 64, 48, 50, 80, 58], fisc: [0.58, 0.10],
      notes: '东京城（天命七年筑）。'
    }),
    海州: block({
      name: '海州', terrain: '平原', divisionType: '州', regionType: 'banner_core', officialPosition: '固山额真',
      specialResources: '粮·棉·豆', tags: {},
      description: '辽河下游的旧卫城，辽南平原的粮仓；汉民被编入庄屯，为八旗耕种纳粮。',
      commerce: 1.0, fishing: 0, corridor: 1.1, keju: 0,
      idx: [54, 32, 60, 60, 44, 50, 80, 56], fisc: [0.58, 0.10],
      notes: '海州卫旧城。'
    }),
    盖州: block({
      name: '盖州', terrain: '丘陵', divisionType: '州', regionType: 'banner_core', officialPosition: '备御',
      specialResources: '粮·豆·木材', tags: {},
      description: '辽南滨海的旧卫城，天启年间东江兵屡次渡海袭扰辽南，城守严密，沿海屯庄多有逃入海岛者。',
      commerce: 0.8, fishing: 0, corridor: 1.0, keju: 0,
      idx: [52, 32, 56, 56, 48, 48, 84, 56], fisc: [0.56, 0.10],
      notes: '盖州卫旧城。'
    }),
    复州: block({
      name: '复州', terrain: '丘陵', divisionType: '州', regionType: 'banner_core', officialPosition: '备御',
      specialResources: '粮·豆·果', tags: {},
      description: '辽东半岛西岸，天命八年汉民谋逃东江，事泄遭后金屠戮，至今户口凋零、田土多荒。',
      commerce: 0.7, fishing: 0, flee: 1.5, corridor: 0.9, keju: 0,
      idx: [46, 32, 50, 50, 54, 48, 84, 56], fisc: [0.54, 0.10],
      notes: '复州之变（天命八年）。'
    }),
    铁岭: block({
      name: '铁岭', terrain: '平原', divisionType: '城', regionType: 'banner_core', officialPosition: '备御',
      specialResources: '粮·马·皮毛', tags: { horseRegion: true },
      description: '辽北重镇，李成梁家族故里；万历四十七年为努尔哈赤攻取，辽河上游平原宜耕宜牧。',
      commerce: 0.9, fishing: 0, horse: 0.3, corridor: 1.1, keju: 0,
      idx: [56, 32, 58, 58, 42, 50, 80, 56], fisc: [0.58, 0.10],
      notes: '万历四十七年陷落。'
    }),
    开原: block({
      name: '开原', terrain: '平原', divisionType: '城', regionType: 'banner_core', officialPosition: '备御',
      specialResources: '马·皮毛·人参', tags: { horseRegion: true },
      description: '辽东最北的旧城，昔日明廷与海西女真互市之所，万历四十七年陷落；北通叶赫故地。',
      commerce: 1.0, fishing: 0, horse: 0.4, corridor: 1.1, keju: 0,
      idx: [58, 30, 56, 56, 40, 50, 80, 56], fisc: [0.58, 0.10],
      notes: '开原马市。'
    }),
    奉集堡: block({
      name: '奉集堡', terrain: '丘陵', divisionType: '堡', regionType: 'banner_core', officialPosition: '备御',
      specialResources: '粮·屯田', tags: {},
      description: '沈阳东南的旧屯堡，天启元年辽沈之战时失守，今为八旗屯庄。',
      commerce: 0.6, fishing: 0, corridor: 0.9, keju: 0,
      idx: [54, 32, 54, 54, 44, 50, 82, 56], fisc: [0.58, 0.10],
      notes: '天启元年陷落。'
    })
  },
  regionMeans: { development: 62, unrest: 45, taxPressure: 49, armyPressure: 82, officeRisk: 57 }
};

const JIANZHOU = {
  faction: '后金', province: '建州本部八旗辖区', fiscalRates: 'province',
  UNITS: [
    unit('赫图阿拉旧城', 90000, 10, 8, 2),
    unit('苏子河谷', 70000, 9, 8, 1),
    unit('浑江谷地', 50000, 6, 5, 1),
    unit('抚顺东路', 60000, 7, 6, 1),
    unit('鸭绿江北岸', 40000, 4, 3, 1),
    unit('建州三卫', 50000, 5, 4, 1)
  ],
  BLOCKS: {
    赫图阿拉旧城: block({
      name: '赫图阿拉旧城', terrain: '河谷', divisionType: '城', regionType: 'banner_homeland', officialPosition: '固山额真',
      specialResources: '人参·貂皮·铁', tags: { mineralRegion: true, horseRegion: true },
      description: '苏子河畔的建州故都，万历四十四年努尔哈赤在此称汗、建号大金；宗室祖陵所在，八旗根本之地。',
      commerce: 1.0, fishing: 0, mineral: 0.6, horse: 0.35, corridor: 1.2, keju: 0,
      idx: [70, 20, 56, 56, 30, 50, 82, 58], fisc: [0.52, 0.06],
      disasterRecord: [COLD],
      notes: '万历四十四年建元天命。'
    }),
    苏子河谷: block({
      name: '苏子河谷', terrain: '河谷', divisionType: '部', regionType: 'banner_homeland', officialPosition: '牛录额真',
      specialResources: '粮·人参·木材', tags: {},
      description: '赫图阿拉周围的苏子河谷，建州女真世居农猎之地，诸旗屯庄错落。',
      commerce: 0.7, fishing: 0, corridor: 1.0, keju: 0,
      idx: [68, 20, 54, 54, 32, 50, 82, 56], fisc: [0.52, 0.06],
      disasterRecord: [COLD],
      notes: '建州故地。'
    }),
    浑江谷地: block({
      name: '浑江谷地', terrain: '山林', divisionType: '部', regionType: 'banner_homeland', officialPosition: '牛录额真',
      specialResources: '人参·木材·皮毛', tags: {},
      description: '浑江流域的山谷，采参、围猎为业，八旗兵丁多出于此。',
      commerce: 0.6, fishing: 0, corridor: 0.9, keju: 0,
      idx: [66, 20, 48, 48, 34, 48, 82, 56], fisc: [0.50, 0.06],
      disasterRecord: [COLD],
      notes: '采参之地。'
    }),
    抚顺东路: block({
      name: '抚顺东路', terrain: '山地', divisionType: '部', regionType: 'banner_homeland', officialPosition: '牛录额真',
      specialResources: '人参·木材·铁', tags: { mineralRegion: true },
      description: '抚顺关以东的萨尔浒、界凡一带，万历四十七年萨尔浒之战，明军四路覆没于此。',
      commerce: 0.7, fishing: 0, mineral: 0.4, corridor: 1.1, keju: 0,
      idx: [66, 20, 50, 50, 34, 50, 82, 56], fisc: [0.52, 0.06],
      notes: '萨尔浒之战（万历四十七年）。'
    }),
    鸭绿江北岸: block({
      name: '鸭绿江北岸', terrain: '山林', divisionType: '部', regionType: 'banner_homeland', officialPosition: '牛录额真',
      specialResources: '人参·木材·貂皮', tags: {},
      description: '鸭绿江右岸的长白山林，采参、猎貂之地，隔江与朝鲜相望；今年正月阿敏率军渡鸭绿江入朝鲜。',
      commerce: 0.6, fishing: 0, corridor: 0.9, keju: 0,
      idx: [64, 20, 46, 46, 36, 48, 84, 56], fisc: [0.50, 0.06],
      disasterRecord: [COLD],
      notes: '丁卯之役（天启七年正月）。'
    }),
    建州三卫: block({
      name: '建州三卫', terrain: '山林', divisionType: '部', regionType: 'banner_homeland', officialPosition: '牛录额真',
      specialResources: '貂皮·东珠·马', tags: { horseRegion: true },
      description: '明初建州三卫初设的图们江、敦化一带，后为辉发、乌拉等海西女真所居，先后为努尔哈赤所并；松花江的东珠、貂皮由此进贡汗庭。',
      commerce: 0.6, fishing: 0, horse: 0.65, corridor: 0.9, keju: 0,
      idx: [66, 20, 46, 46, 34, 48, 80, 58], fisc: [0.50, 0.06],
      disasterRecord: [COLD],
      notes: '辉发（万历三十五年灭）、乌拉（万历四十一年灭）。'
    })
  },
  regionMeans: { development: 52, unrest: 33, taxPressure: 49, armyPressure: 82, officeRisk: 57 }
};

const OCCUPIED = {
  faction: '后金', province: '辽东占领区八旗辖区', fiscalRates: 'province',
  UNITS: [
    unit('广宁旧城', 90000, 14, 14, 2),
    unit('义州', 50000, 6, 8, 1),
    unit('懿路', 45000, 9, 10, 1),
    unit('蒲河', 45000, 9, 10, 1),
    unit('抚顺', 60000, 9, 8, 1),
    unit('辽河西岸', 60000, 8, 10, 1),
    unit('大凌河东', 40000, 5, 7, 0.5),
    unit('小凌河东', 40000, 5, 7, 0.5)
  ],
  BLOCKS: {
    广宁旧城: block({
      name: '广宁旧城', terrain: '平原', divisionType: '城', regionType: 'occupied_frontier', officialPosition: '备御',
      specialResources: '粮·马·棉', tags: { horseRegion: true },
      description: '医巫闾山下的旧广宁卫城，天启二年巡抚王化贞弃城溃逃，后金入据；随后把辽西军民驱往辽河以东，城中残民无几，田土多荒。',
      commerce: 0.9, fishing: 0, horse: 0.4, corridor: 1.2, keju: 0, flee: 1.3,
      idx: [34, 38, 46, 46, 66, 50, 84, 56], fisc: [0.44, 0.14],
      notes: '广宁之战（天启二年正月）。'
    }),
    义州: block({
      name: '义州', terrain: '丘陵', divisionType: '州', regionType: 'occupied_frontier', officialPosition: '备御',
      specialResources: '马·粮·皮毛', tags: { horseRegion: true },
      description: '广宁西北的旧卫城，毗邻蒙古诸部牧地，互市与劫掠并存，地多荒弃。',
      commerce: 0.7, fishing: 0, horse: 0.3, corridor: 1.0, keju: 0, flee: 1.3,
      idx: [34, 38, 40, 40, 68, 48, 84, 56], fisc: [0.44, 0.14],
      notes: '接蒙古牧地。'
    }),
    懿路: block({
      name: '懿路', terrain: '平原', divisionType: '城', regionType: 'occupied_frontier', officialPosition: '备御',
      specialResources: '粮·豆', tags: {},
      description: '沈阳以北的旧屯城，辽河东岸平原，汉民编庄耕种，逃人时有。',
      commerce: 0.7, fishing: 0, corridor: 1.0, keju: 0,
      idx: [38, 38, 48, 48, 60, 50, 80, 56], fisc: [0.46, 0.14],
      notes: '懿路城。'
    }),
    蒲河: block({
      name: '蒲河', terrain: '平原', divisionType: '城', regionType: 'occupied_frontier', officialPosition: '备御',
      specialResources: '粮·豆', tags: {},
      description: '沈阳西北的蒲河旧所，河网平原，屯庄相望，汉民负担最重。',
      commerce: 0.7, fishing: 0, corridor: 1.0, keju: 0,
      idx: [38, 38, 48, 48, 60, 50, 80, 56], fisc: [0.46, 0.14],
      notes: '蒲河所。'
    }),
    抚顺: block({
      name: '抚顺', terrain: '丘陵', divisionType: '城', regionType: 'occupied_frontier', officialPosition: '备御',
      specialResources: '煤·铁·粮', tags: { mineralRegion: true },
      description: '浑河谷口的抚顺旧城，万历四十六年守将李永芳举城降，开后金攻明之端；城东产煤，铁冶亦兴。',
      commerce: 0.9, fishing: 0, mineral: 1.0, kuangchang: 1, corridor: 1.1, keju: 0,
      idx: [40, 38, 50, 50, 58, 50, 80, 56], fisc: [0.46, 0.14],
      notes: '抚顺之战（万历四十六年）。'
    }),
    辽河西岸: block({
      name: '辽河西岸', terrain: '平原', divisionType: '部', regionType: 'occupied_frontier', officialPosition: '备御',
      specialResources: '粮·芦苇·盐', tags: {},
      description: '辽河下游西岸的低洼平原，沼泽芦荡连片，古称辽泽；如今是后金与明军斥候往来的缓冲地带。',
      commerce: 0.6, fishing: 0, salt: 0.6, corridor: 0.9, keju: 0, flee: 1.3,
      idx: [34, 38, 42, 42, 66, 48, 86, 56], fisc: [0.44, 0.14],
      notes: '辽泽。'
    }),
    大凌河东: block({
      name: '大凌河东', terrain: '平原', divisionType: '部', regionType: 'occupied_frontier', officialPosition: '备御',
      specialResources: '粮·屯田', tags: {},
      description: '大凌河以东、广宁以南的旧屯地，天启初孙承宗曾遣兵屯驻，今为荒弃的缓冲地带。',
      commerce: 0.5, fishing: 0, corridor: 0.9, keju: 0, flee: 1.3,
      idx: [32, 38, 40, 40, 68, 48, 88, 56], fisc: [0.44, 0.14],
      notes: '孙承宗经略辽东（天启二年至五年）。'
    }),
    小凌河东: block({
      name: '小凌河东', terrain: '平原', divisionType: '部', regionType: 'occupied_frontier', officialPosition: '备御',
      specialResources: '粮·盐·屯田', tags: {},
      description: '小凌河下游、锦州城东北的旧屯地，与明军锦州守兵隔河对峙，屯田多荒。',
      commerce: 0.5, fishing: 0, salt: 0.4, corridor: 0.9, keju: 0, flee: 1.3,
      idx: [32, 38, 40, 40, 68, 48, 88, 56], fisc: [0.44, 0.14],
      notes: '对峙锦州。'
    })
  },
  regionMeans: { development: 44, unrest: 64, taxPressure: 49, armyPressure: 83, officeRisk: 56 }
};

module.exports = [SHENGJING, JIANZHOU, OCCUPIED];
