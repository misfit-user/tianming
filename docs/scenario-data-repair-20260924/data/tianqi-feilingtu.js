// 天启剧本·四家非领土账 23 块（播州余裔山寨 5、郑氏台海商路 6、陕北饥民流动区 6、奢安水西永宁山地 6）
//
// 这四家不是地图上的政权，剧本把它们的据点、商路、饥区记成挂在一个伪地块下的几本账（有意不绑地图）。
// 这里只重写行政树里的各账：按据点大小分人口与钱粮，逐账写描述、地形、官称；地图不动。
// 天启七年：播州杨氏平后二十七年，余部潜藏山寨；郑芝龙去年起纵横闽海，今年攻掠中左所（厦门）；
// 陕北连年大旱，饥民、逃卒、驿卒聚散无常，明年王嘉胤将在府谷起事；奢崇明、安邦彦据水西负险，奢安之乱第七年。
// 掌官只写人物表里有、且确知其所在的人；陕北诸人尚未起事，只把后来起事地的首领写上。
// 各账沿用省里的征到比例与截留率。陕北饥区补上与陕西诸府一致的大旱记录。
// 这几家没有地图地块，regionMeans 只为满足补丁引擎的格式，写进去的地块读数不落回剧本。
'use strict';

const { block } = require('./lib-blocks');

const unit = (name, block) => ({ name, block, countyCount: 1, weights: { pop: 1, households: 1, grain: 1, land: 1 }, basis: '非领土账，整省一块，按据点大小拆账。' });

const DROUGHT = { type: 'drought', severity: 3, startTurn: 1, note: '陕北连年大旱，赤地千里' };

const BOZHOU = {
  faction: '播州土司·杨氏(余裔)', province: '播州余裔山寨', fiscalRates: 'province', nonTerritorial: true,
  UNITS: [unit('播州余裔', 'div_mp3yvbbucgxfr')],
  BLOCKS: {
    div_mp3yvbbucgxfr: block({
      name: '播州余裔山寨', terrain: '山地', divisionType: '寨', regionType: 'tusi', officialPosition: '寨主',
      specialResources: '木材·朱砂·山寨粮', tags: { mineralRegion: true },
      description: '万历二十八年平播之后，杨氏亲族与旧部潜藏遵义山中的残余山寨，并非正式政权；时出劫掠，官府屡剿未尽。',
      commerce: 0.5, fishing: 0, mineral: 1, kuangchang: 1, horse: 1, corridor: 0.6, keju: 0,
      idx: [40, 35, 30, 30, 80, 49, 70, 55], fisc: [0.55, 0.12],
      accounts: [
        { name: '海龙屯故地', weight: 0.18, divisionType: '屯', terrain: '山地', officialPosition: '寨主',
          specialResources: '木材·山寨粮', description: '杨应龙据守的海龙屯旧址，万历二十八年官军四面合攻，屯破而杨氏亡；残垣关隘犹在，余党时来聚议。' },
        { name: '娄山关', weight: 0.12, divisionType: '关', terrain: '山地', officialPosition: '寨主',
          specialResources: '木材·山寨粮', description: '大娄山中的险关，扼遵义通重庆的驿道，平播时两军在此血战，今有旧寨兵出没。' },
        { name: '遵义旧治', weight: 0.31, divisionType: '寨', terrain: '山地', officialPosition: '寨主',
          specialResources: '粮·木材', description: '播州杨氏旧治所在，平播后改设遵义府；城外山中仍有杨氏亲族与旧部潜藏耕猎。' },
        { name: '草塘寨', weight: 0.2, divisionType: '寨', terrain: '山地', officialPosition: '寨主',
          specialResources: '朱砂·木材', description: '播州东境的草塘旧安抚司之地，山寨林立，旧土兵散处，采砂为生。' },
        { name: '真安州旧地', weight: 0.19, divisionType: '寨', terrain: '山地', officialPosition: '寨主',
          specialResources: '朱砂·粮', description: '播州北境的真安州旧地，平播后改名正安，北接四川綦江，流亡寨兵出没。' }
      ],
      notes: '平播之役（万历二十八年）。'
    })
  },
  regionMeans: { development: 30, unrest: 80, taxPressure: 49, armyPressure: 70, officeRisk: 55 }
};

const ZHENG = {
  faction: '郑氏海商', province: '郑氏台海商路', fiscalRates: 'province', nonTerritorial: true,
  UNITS: [unit('郑氏', 'div_mp3yvbbuomlca')],
  BLOCKS: {
    div_mp3yvbbuomlca: block({
      name: '郑氏台海商路', terrain: '沿海', divisionType: '商路', regionType: 'maritime', officialPosition: '船主',
      specialResources: '海船·日本银·鹿皮', tags: { hasPort: true, fishingRegion: true },
      description: '郑芝龙兄弟统领的海商船队与据点，往来闽海、台湾与日本平户之间，亦商亦盗；去年起纵横闽海，今年攻掠中左所，官军水师屡败。',
      commerce: 2.0, maritime: 1, salt: 1, fishing: 1, corridor: 0.8, keju: 0,
      idx: [56, 40, 50, 50, 72, 49, 80, 55], fisc: [0.55, 0.12],
      accounts: [
        { name: '厦门', weight: 0.22, divisionType: '所', terrain: '岛屿', officialPosition: '船主',
          specialResources: '海船·商货', description: '同安县海中的中左所城，今年郑芝龙船队攻掠此地，官军水师屡败，商民或附或逃。' },
        { name: '金门', weight: 0.18, divisionType: '所', terrain: '岛屿', officialPosition: '船主',
          specialResources: '盐·鱼·海船', description: '厦门东面的海岛，守御千户所与浯洲盐场所在，郑氏船队往来补给之地。' },
        { name: '澎湖', weight: 0.12, divisionType: '岛', terrain: '岛屿', officialPosition: '船主',
          specialResources: '鱼·淡水', description: '台湾海峡中的群岛，天启四年逐走荷兰人后明廷复设游兵，海商与渔民往来歇泊。' },
        { name: '月港', weight: 0.16, divisionType: '港', terrain: '沿海', officialPosition: '船主',
          specialResources: '洋货·白银', description: '漳州海澄的月港，隆庆开海后准贩东西洋的港口，郑氏船队向出洋商船索取报水。' },
        { name: '海澄', weight: 0.17, divisionType: '县', terrain: '沿海', officialPosition: '船主',
          specialResources: '商货·丝·糖', description: '月港所在的海澄县城，商贾辐辏，督饷馆在此征收洋税。' },
        { name: '安平海道', weight: 0.15, governor: '郑芝龙', divisionType: '道', terrain: '沿海', officialPosition: '船主',
          specialResources: '海船·日本银', description: '泉州晋江安平镇与外海航道，郑芝龙的故乡与根基，船队由此出入台湾海峡。' }
      ],
      notes: '郑芝龙（天启六年起纵横闽海，崇祯元年受抚）。'
    })
  },
  regionMeans: { development: 50, unrest: 72, taxPressure: 49, armyPressure: 80, officeRisk: 55 }
};

const SHANBEI = {
  faction: '陕北饥民(将起)', province: '陕北饥民流动区', fiscalRates: 'province', nonTerritorial: true,
  UNITS: [unit('陕北饥民', 'div_mp3yvbbu0vhct')],
  BLOCKS: {
    div_mp3yvbbu0vhct: block({
      name: '陕北饥民流动区', terrain: '高原', divisionType: '饥区', regionType: 'disaster_zone', officialPosition: '首领',
      specialResources: '饥民·逃卒·残粮', tags: { horseRegion: true },
      description: '延安、榆林一带连年大旱，饥民、逃卒、欠饷的边兵与驿卒聚散无常，尚无统一的首领；官府仍催科不止，一点火星即可燎原。',
      commerce: 0.3, fishing: 0, salt: 1, horse: 1, corridor: 0.8, keju: 0, flee: 2.0,
      idx: [8, 70, 10, 10, 96, 49, 60, 60], fisc: [0.55, 0.12],
      disasterRecord: [DROUGHT],
      accounts: [
        { name: '米脂', weight: 0.2, divisionType: '县', terrain: '高原', officialPosition: '首领',
          specialResources: '饥民·残粮', description: '无定河畔的米脂，连年大旱颗粒无收，饥民剥树皮、掘观音土为食；银川驿的驿卒亦欠饷困顿。' },
        { name: '延安', weight: 0.19, divisionType: '城', terrain: '高原', officialPosition: '首领',
          specialResources: '逃卒·饥民', description: '延安府城内外，逃兵与饥民混杂，官府催科不止，卫所军卒欠饷数月。' },
        { name: '绥德', weight: 0.17, divisionType: '州', terrain: '高原', officialPosition: '首领',
          specialResources: '饥民·残粮', description: '无定河下游的绥德州，饥民啸聚山中，富户闭粜，抢粮之事屡见。' },
        { name: '清涧', weight: 0.14, divisionType: '县', terrain: '高原', officialPosition: '首领',
          specialResources: '饥民', description: '黄河西岸的清涧县，土地瘠薄，逃亡户十去其半。' },
        { name: '安塞', weight: 0.16, governor: '高迎祥', divisionType: '县', terrain: '高原', officialPosition: '首领',
          specialResources: '马·饥民', description: '延河上游的安塞，贩马为生者多，马贩与逃卒结伙，出没于山谷之间。' },
        { name: '府谷', weight: 0.15, governor: '王嘉胤', divisionType: '县', terrain: '边塞', officialPosition: '首领',
          specialResources: '逃卒·马', description: '黄河边的府谷县，紧邻延绥边墙，逃亡边卒与饥民相聚，已有人暗中聚众。' }
      ],
      notes: '王嘉胤府谷起事（崇祯元年）。'
    })
  },
  regionMeans: { development: 10, unrest: 96, taxPressure: 49, armyPressure: 60, officeRisk: 60 }
};

const SHEAN = {
  faction: '奢安之乱联军', province: '奢安水西永宁山地', fiscalRates: 'province', nonTerritorial: true,
  UNITS: [unit('奢安', 'div_mp3yvbbusohkn')],
  BLOCKS: {
    div_mp3yvbbusohkn: block({
      name: '奢安水西永宁山地', terrain: '山地', divisionType: '土司', regionType: 'tusi', officialPosition: '宣慰使',
      specialResources: '山寨粮·朱砂·水西马', tags: { mineralRegion: true, horseRegion: true },
      description: '奢崇明与安邦彦的叛军所据川黔交界山地。天启元年奢崇明起兵陷重庆、围成都，二年安邦彦应之围贵阳，此后官军屡进屡退；如今叛军负险据守水西，战事已入第七年。',
      commerce: 0.4, fishing: 0, mineral: 1, kuangchang: 1, horse: 1, corridor: 0.6, keju: 0, flee: 1.5,
      idx: [39, 37, 24, 24, 90, 49, 90, 58], fisc: [0.55, 0.12],
      accounts: [
        { name: '永宁宣抚司', weight: 0.18, governor: '奢崇明', divisionType: '司', terrain: '山地', officialPosition: '宣抚使',
          specialResources: '山寨粮·木材', description: '奢氏世领的永宁宣抚司，天启三年官军收复永宁城，奢崇明率余部退入山中与水西合兵，旧部仍据险寨。' },
        { name: '水西四十八目', weight: 0.3, governor: '安位', divisionType: '司', terrain: '高原', officialPosition: '宣慰使',
          specialResources: '水西马·朱砂·毡', description: '乌江上游的水西安氏世领之地，分四十八目管辖；宣慰使安位年幼，权臣安邦彦主兵，负险据守。' },
        { name: '乌撒', weight: 0.16, divisionType: '府', terrain: '高原', officialPosition: '土知府',
          specialResources: '马·铅·羊', description: '乌撒一带，与水西安氏世为姻亲，土兵骁勇，为叛军西翼。' },
        { name: '赤水', weight: 0.11, divisionType: '道', terrain: '河谷', officialPosition: '头目',
          specialResources: '山寨粮·盐运', description: '赤水河谷，川黔交界的山道，叛军往来转运之路。' },
        { name: '毕节', weight: 0.14, divisionType: '卫', terrain: '山地', officialPosition: '头目',
          specialResources: '粮·木材', description: '毕节卫一带，官军与水西兵反复争夺的据点，卫城残破。' },
        { name: '叙永山道', weight: 0.13, divisionType: '道', terrain: '山地', officialPosition: '头目',
          specialResources: '木材·山寨粮', description: '永宁通赤水、毕节的山道，险隘相接，叛军据此出没川南。' }
      ],
      notes: '奢安之乱（天启元年至崇祯二年）。'
    })
  },
  regionMeans: { development: 24, unrest: 90, taxPressure: 49, armyPressure: 90, officeRisk: 58 }
};

module.exports = [BOZHOU, ZHENG, SHANBEI, SHEAN];
