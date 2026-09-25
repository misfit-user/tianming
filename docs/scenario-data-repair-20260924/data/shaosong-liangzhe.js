// 绍宋·两浙路（样板）：十六块。户数、商税、田亩、两税权重见 shaosong-sources.js，这里写定性字段。
// 建炎元年仍用旧名：杭州（建炎三年升临安府）、越州（绍兴元年升绍兴府）、秀州、明州、温州、严州（宣和三年由睦州改名）；
// 苏州、润州已于政和三年升平江府、镇江府。
// 两浙路帅司分东西（越州、杭州），全路长官写转运使，见 shaosong-frame.js。
'use strict';

const { songBlock: block, circuitModule } = require('./shaosong-common');

// idx：[民心, 吏治(贪腐), 繁荣, 发展, 不稳, 税压, 军压, 官风险]；fisc：[征到比例, 截留率]
// 两浙改前各块同值：民心 58、贪腐 28、繁荣 88，地块发展 88、不稳 14、税压 72、军压 42；下列相对高低由引擎平移回这组均值。
const BLOCKS = {
  杭州: block({
    name: '杭州', divisionType: '州', officialPosition: '知杭州', terrain: '水乡',
    specialResources: '丝绸·酒·刻书·海盐·海贸', taxLevel: '重',
    tags: { hasPort: true, saltRegion: true, fishingRegion: true },
    description: '两浙首郡，钱塘江口、西湖之畔，东南第一都会，丝织、酿酒、刻书冠于诸州，设市舶司通海舶。宣和二年方腊军攻陷杭州，焚掠官舍民居，城中至今多有残破之地。',
    idx: [55, 30, 92, 92, 16, 76, 45, 40], fisc: [0.78, 0.07], textile: 1.5, keju: 1.3, flee: 1.2,
    notes: '州治钱塘，市舶司所在；沿海有仁和、盐官盐场。方腊之乱受祸最重的州之一，不稳略高。'
  }),
  平江府: block({
    name: '平江府', divisionType: '府', officialPosition: '知平江府', terrain: '水乡',
    specialResources: '稻米·丝绸·太湖鱼', taxLevel: '重',
    tags: { fishingRegion: true },
    description: '苏州，政和三年升平江府。太湖东岸，稻田连阡，「苏湖熟，天下足」；丝绸与园林甲于东南。朱勔以应奉局在此搜罗花石，民间苦之。',
    idx: [55, 28, 92, 92, 12, 80, 40, 35], fisc: [0.80, 0.06], textile: 1.5, keju: 1.2,
    notes: '太湖稻作核心，赋重；花石纲余怨，民心略低。'
  }),
  镇江府: block({
    name: '镇江府', divisionType: '府', officialPosition: '知镇江府', terrain: '丘陵',
    specialResources: '漕运·粮·江鱼', taxLevel: '中',
    tags: { fishingRegion: true },
    description: '润州，政和三年升镇江府。扼江南运河北口，与扬州瓜洲隔江相望，京口为渡江要津，漕船由此入江北上。',
    idx: [58, 28, 85, 86, 12, 72, 55, 35], fisc: [0.78, 0.07],
    notes: '宁镇丘陵；长江渡口与运河口，江防军压高。'
  }),
  湖州: block({
    name: '湖州', divisionType: '州', officialPosition: '知湖州', terrain: '水乡',
    specialResources: '湖丝·湖笔·茶·稻米', taxLevel: '重',
    tags: { fishingRegion: true },
    description: '太湖南岸，苕、霅二溪汇流，桑蚕之利冠于诸州，湖丝、湖笔闻名；长兴顾渚产茶。',
    idx: [58, 26, 88, 88, 10, 76, 38, 30], fisc: [0.79, 0.06], textile: 1.8,
    notes: '蚕桑最盛，布帛权重最高。'
  }),
  秀州: block({
    name: '秀州', divisionType: '州', officialPosition: '知秀州', terrain: '水乡',
    specialResources: '稻米·海盐·海贸', taxLevel: '重',
    tags: { hasPort: true, saltRegion: true, fishingRegion: true },
    description: '太湖之东、滨海之地，田土膏腴，华亭县有盐场；政和间于华亭置市舶务，海舶可至青龙镇。',
    idx: [60, 26, 88, 86, 10, 74, 38, 30], fisc: [0.79, 0.06], textile: 1.2,
    notes: '华亭盐场与市舶务。'
  }),
  常州: block({
    name: '常州', divisionType: '州', officialPosition: '知常州', terrain: '水乡',
    specialResources: '稻米·鱼·丝', taxLevel: '重',
    tags: { fishingRegion: true },
    description: '江南运河经其境，晋陵、武进、无锡、宜兴四县皆望县，稻米丰饶，太湖北岸渔利甚厚。',
    idx: [60, 26, 86, 86, 10, 72, 42, 30], fisc: [0.78, 0.07], textile: 1.1,
    notes: '江阴县已另成江阴军地块，常州按四县计。'
  }),
  江阴军: block({
    name: '江阴军', divisionType: '军', officialPosition: '知江阴军', terrain: '平原',
    specialResources: '江鱼·粮', taxLevel: '中',
    tags: { fishingRegion: true },
    description: '江阴县地，濒大江入海之口，熙宁四年废军为县、隶常州，建炎初复置军以备江防，扼长江下游渡口。',
    idx: [60, 26, 80, 80, 12, 66, 55, 30], fisc: [0.78, 0.07],
    notes: '一县之军，江防要地，军压高。'
  }),
  越州: block({
    name: '越州', divisionType: '州', officialPosition: '知越州', terrain: '水乡',
    specialResources: '稻米·越罗·剡纸·茶·海盐', taxLevel: '重',
    tags: { saltRegion: true, fishingRegion: true },
    description: '两浙东路帅府，鉴湖水利灌溉山阴、会稽，稻米丰饶；越罗、剡纸、日铸茶皆有名，会稽为东南文物之邦。',
    idx: [60, 28, 88, 88, 12, 72, 42, 35], fisc: [0.78, 0.07], textile: 1.4, keju: 1.3,
    notes: '浙东帅府；沿海钱清等盐场。'
  }),
  明州: block({
    name: '明州', divisionType: '州', officialPosition: '知明州', terrain: '沿海',
    specialResources: '海贸·海盐·鱼', taxLevel: '中',
    tags: { hasPort: true, saltRegion: true, fishingRegion: true },
    description: '东南海港，设市舶司，高丽使臣与商舶多由此出入；四明山与海之间盐场、渔场相望。',
    idx: [62, 28, 88, 88, 10, 70, 42, 35], fisc: [0.78, 0.07], keju: 1.2,
    notes: '市舶司所在，对高丽口岸；昌国县已另成地块。'
  }),
  昌国县: block({
    name: '昌国县', divisionType: '县', officialPosition: '知昌国县', terrain: '岛屿',
    specialResources: '海盐·鱼', taxLevel: '轻',
    tags: { saltRegion: true, fishingRegion: true },
    description: '明州海外舟山诸岛，熙宁六年置县，岛民以渔盐为业，往来高丽、日本的海舶多泊于此。',
    idx: [62, 24, 72, 70, 12, 60, 45, 30], fisc: [0.76, 0.07], textile: 0.5, keju: 0.3, hide: 1.3,
    notes: '海岛一县，人口少；隐户略多。'
  }),
  台州: block({
    name: '台州', divisionType: '州', officialPosition: '知台州', terrain: '沿海',
    specialResources: '海盐·鱼·茶', taxLevel: '中',
    tags: { saltRegion: true, fishingRegion: true },
    description: '濒海多山，天台山为佛道胜地，国清寺为天台宗祖庭；沿海盐场、渔场相接。宣和三年仙居吕师囊起兵响应方腊，州境一度残破。',
    idx: [58, 28, 80, 80, 16, 66, 40, 35], fisc: [0.77, 0.07], flee: 1.2,
    notes: '黄岩等盐场；方腊之乱波及。'
  }),
  温州: block({
    name: '温州', divisionType: '州', officialPosition: '知温州', terrain: '沿海',
    specialResources: '漆器·柑橘·蠲纸·海盐·船', taxLevel: '中',
    tags: { saltRegion: true, fishingRegion: true },
    description: '瓯江入海之口，濒海商贸发达，漆器、柑橘、蠲纸闻名，造船之业兴盛。',
    idx: [62, 26, 84, 84, 10, 66, 38, 30], fisc: [0.78, 0.07], keju: 1.2,
    notes: '沿海盐场；建炎元年尚无市舶务（绍兴初方置），不计海港。'
  }),
  处州: block({
    name: '处州', divisionType: '州', officialPosition: '知处州', terrain: '山地',
    specialResources: '青瓷·银·木材', taxLevel: '轻',
    tags: { mineralRegion: true },
    description: '万山之中、瓯江上游，龙泉窑青瓷行销海内外，山田贫瘠；宣和间方腊之乱亦遭兵祸。',
    idx: [55, 28, 72, 72, 18, 62, 36, 35], fisc: [0.76, 0.08], textile: 0.8, flee: 1.3, hide: 1.2,
    notes: '山区，有银坑；方腊所陷六州之一。'
  }),
  婺州: block({
    name: '婺州', divisionType: '州', officialPosition: '知婺州', terrain: '盆地',
    specialResources: '稻米·酒·纸', taxLevel: '中',
    tags: {},
    description: '金衢盆地东端，稻米与酿酒著称；宣和三年方腊军陷婺州，州县残破后渐次恢复。',
    idx: [55, 30, 80, 80, 18, 68, 38, 38], fisc: [0.76, 0.08], textile: 1.1, keju: 1.2, flee: 1.3,
    notes: '方腊所陷六州之一。'
  }),
  衢州: block({
    name: '衢州', divisionType: '州', officialPosition: '知衢州', terrain: '丘陵',
    specialResources: '纸·柑橘·粮', taxLevel: '中',
    tags: {},
    description: '钱塘江上游，西入江西、南下福建之要道，产纸、柑橘；宣和三年方腊军陷衢州，守臣死之。',
    idx: [55, 30, 78, 78, 18, 66, 40, 38], fisc: [0.76, 0.08], flee: 1.3,
    notes: '方腊所陷六州之一；浙赣闽三省通道，驿路系数略高。', corridor: 1.2
  }),
  严州: block({
    name: '严州', divisionType: '州', officialPosition: '知严州', terrain: '山地',
    specialResources: '茶·漆·木材', taxLevel: '轻',
    tags: {},
    description: '旧睦州，方腊起兵于青溪县帮源洞；宣和三年平定后改睦州为严州、青溪为淳安。山多田少，民以茶、漆、木材为生，乱后元气未复。',
    idx: [48, 30, 66, 66, 26, 60, 42, 40], fisc: [0.70, 0.09], textile: 0.8, flee: 1.8, hide: 1.2,
    notes: '方腊起事之地，民心最低、不稳最高。'
  })
};

module.exports = circuitModule('两浙路', {
  BLOCKS,
  regionMeans: { development: 88, unrest: 14, taxBurden: 72, armyPressure: 42 }
});
