// 绍宋·广南东路。户数、商税、田亩、两税权重见 shaosong-sources.js（本路志中只载元丰户，× 1.025 折崇宁），这里写定性字段。
// 广州「大观元年，升为帅府。旧领广南东路兵马钤辖，兼本路经略、安抚使」。
'use strict';

const { songBlock: block, circuitModule } = require('./shaosong-common');

// idx：[民心, 吏治(贪腐), 繁荣, 发展, 不稳, 税压, 军压, 官风险]；fisc：[征到比例, 截留率]
// 原版各块同值：民心 58、贪腐 28、繁荣 68，地块发展 68、不稳 14、税压 63、军压 30。
const BLOCKS = {
  广州: block({
    name: '广州', divisionType: '州', officialPosition: '知广州', terrain: '沿海',
    specialResources: '海贸·香药·珠宝·海盐', taxLevel: '中',
    tags: { hasPort: true, saltRegion: true, fishingRegion: true },
    description: '南海郡，清海军节度，大观元年升帅府，知州兼广南东路经略安抚使；设市舶司，番商云集，香药珠宝经此入中国，城西有蕃坊。',
    idx: [58, 32, 78, 78, 14, 66, 34, 40], fisc: [0.77, 0.08], keju: 1.3, corridor: 1.3,
    notes: '一路帅府，市舶司所在，经手财货多，贪腐略高。'
  }),
  韶州: block({
    name: '韶州', divisionType: '州', officialPosition: '知韶州', terrain: '山地',
    specialResources: '铜·绢·钟乳', taxLevel: '中',
    tags: { mineralRegion: true },
    description: '始兴郡，曲江、翁源、乐昌诸县，北接湖南、江西两道；岑水场产铜，为东南铜冶大宗，土贡绢、钟乳。',
    idx: [58, 28, 66, 66, 14, 62, 30, 34], fisc: [0.77, 0.07], kuangchang: 1, corridor: 1.3,
    notes: '岑水场为官营铜场，记官营矿场一处。'
  }),
  循州: block({
    name: '循州', divisionType: '州', officialPosition: '知循州', terrain: '山地',
    specialResources: '绢·藤器', taxLevel: '轻',
    tags: {},
    description: '海丰郡，龙川、兴宁、长乐三县，山多田少，土贡绢、藤盘。',
    idx: [58, 28, 60, 60, 16, 60, 30, 34], fisc: [0.77, 0.07], hide: 1.2,
    notes: '山多田少，隐户略多。'
  }),
  惠州: block({
    name: '惠州', divisionType: '州', officialPosition: '知惠州', terrain: '沿海',
    specialResources: '海盐·甲香·藤箱', taxLevel: '轻',
    tags: { saltRegion: true, fishingRegion: true },
    description: '宣和二年赐郡名博罗，归善、海丰、河源、博罗四县，罗浮山在博罗；苏轼晚年谪居于此。',
    idx: [58, 28, 64, 64, 14, 60, 30, 34], fisc: [0.77, 0.07],
    notes: '濒海盐场。'
  }),
  潮州: block({
    name: '潮州', divisionType: '州', officialPosition: '知潮州', terrain: '沿海',
    specialResources: '海盐·蕉布·甲香·鲛鱼皮', taxLevel: '轻',
    tags: { saltRegion: true, fishingRegion: true },
    description: '潮阳郡，海阳、潮阳、揭阳三县，濒海；唐韩愈贬刺史于此，土贡蕉布、甲香、鲛鱼皮。',
    idx: [58, 28, 66, 66, 14, 62, 30, 34], fisc: [0.77, 0.07], keju: 1.2,
    notes: '濒海盐场。'
  }),
  梅州: block({
    name: '梅州', divisionType: '州', officialPosition: '知梅州', terrain: '山地',
    specialResources: '木材·纸', taxLevel: '轻',
    tags: {},
    description: '本潮州程乡县，熙宁六年废州、元丰五年复置，宣和二年赐郡名义安，领程乡一县。',
    idx: [58, 28, 58, 58, 16, 58, 30, 34], fisc: [0.77, 0.07], hide: 1.2,
    notes: '一县之州。'
  }),
  南雄州: block({
    name: '南雄州', divisionType: '州', officialPosition: '知南雄州', terrain: '山地',
    specialResources: '绢·驿路', taxLevel: '轻',
    tags: {},
    description: '本雄州，开宝四年加「南」字，保昌、始兴二县；大庾岭梅关南口，岭南北往来要道。',
    idx: [58, 28, 62, 62, 14, 60, 32, 34], fisc: [0.77, 0.07], corridor: 1.5,
    notes: '梅关驿路。'
  }),
  英州: block({
    name: '英州', divisionType: '州', officialPosition: '知英州', terrain: '山地',
    specialResources: '英石·纻布', taxLevel: '轻',
    tags: {},
    description: '宣和二年赐郡名真阳，真阳、浛光二县，北江所经，英石以奇峭闻名。',
    idx: [58, 28, 58, 58, 14, 58, 30, 32], fisc: [0.77, 0.07],
    notes: '志中标题英德府（庆元元年升）；元丰户仅三千余。'
  }),
  连州: block({
    name: '连州', divisionType: '州', officialPosition: '知连州', terrain: '山地',
    specialResources: '苎布·官桂·钟乳', taxLevel: '轻',
    tags: {},
    description: '连山郡，桂阳、阳山、连山三县，北接湖南，土贡苎布、官桂，元丰贡钟乳。',
    idx: [58, 28, 60, 60, 14, 60, 30, 34], fisc: [0.77, 0.07], hide: 1.2,
    notes: '山区，隐户略多。'
  }),
  肇庆府: block({
    name: '肇庆府', divisionType: '府', officialPosition: '知肇庆府', terrain: '河谷',
    specialResources: '端砚·鱼', taxLevel: '中',
    tags: { fishingRegion: true },
    description: '本端州，重和元年赐肇庆府名，高要、四会二县，西江所经；端溪砚石天下第一。',
    idx: [58, 28, 66, 66, 14, 62, 30, 34], fisc: [0.77, 0.07],
    notes: '西江渔利。'
  }),
  新州: block({
    name: '新州', divisionType: '州', officialPosition: '知新州', terrain: '丘陵',
    specialResources: '银', taxLevel: '轻',
    tags: { mineralRegion: true },
    description: '新兴郡，领新兴一县，土贡银。',
    idx: [58, 28, 58, 58, 14, 58, 30, 32], fisc: [0.77, 0.07],
    notes: '一县之州。'
  }),
  封州: block({
    name: '封州', divisionType: '州', officialPosition: '知封州', terrain: '河谷',
    specialResources: '银·鱼', taxLevel: '轻',
    tags: { mineralRegion: true, fishingRegion: true },
    description: '临封郡，封川、开建二县，西江所经，土贡银；大观元年升望郡。',
    idx: [58, 28, 56, 56, 14, 58, 30, 32], fisc: [0.77, 0.07],
    notes: '元丰户仅二千余。'
  }),
  康州: block({
    name: '康州', divisionType: '州', officialPosition: '知康州', terrain: '河谷',
    specialResources: '鱼·粮', taxLevel: '轻',
    tags: { fishingRegion: true },
    description: '晋康郡，端溪、泷水二县，西江所经；大观四年升望郡。',
    idx: [58, 28, 56, 56, 14, 58, 30, 32], fisc: [0.77, 0.07],
    notes: '志中标题德庆府（后升）。'
  }),
  南恩州: block({
    name: '南恩州', divisionType: '州', officialPosition: '知南恩州', terrain: '沿海',
    specialResources: '海盐·鱼', taxLevel: '轻',
    tags: { saltRegion: true, fishingRegion: true },
    description: '恩平郡，阳江、阳春二县，濒海；庆历八年以河北路已有恩州，加「南」字以别。',
    idx: [58, 28, 58, 58, 14, 58, 30, 32], fisc: [0.77, 0.07],
    notes: '濒海盐场。'
  })
};

module.exports = circuitModule('广南东路', {
  BLOCKS,
  regionMeans: { development: 68, unrest: 14, taxBurden: 63, armyPressure: 30 }
});
