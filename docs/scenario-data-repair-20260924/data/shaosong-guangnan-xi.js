// 绍宋·广南西路（二十七块，含海南四州军与黎峒）。户数、商税、田亩、两税权重见 shaosong-sources.js（志中多只载元丰户），
// 这里写定性字段。桂州「大观元年，为大都督府，又升为帅府。旧领广南西路兵马钤辖，兼本路经略、安抚使」。
// 邕州横山砦置司市马在绍兴三年，建炎元年尚无，不写。
'use strict';

const { songBlock: block, circuitModule } = require('./shaosong-common');

// idx：[民心, 吏治(贪腐), 繁荣, 发展, 不稳, 税压, 军压, 官风险]；fisc：[征到比例, 截留率]
// 原版：桂邕以北诸州民心 58、贪腐 28、繁荣 52，读数发展 52、不稳 14、税压 66、军压 38；沿海与海南诸州繁荣 36、税压 55、军压 44。
function gx(name, fields) {
  return block(Object.assign({
    name, divisionType: name.endsWith('军') ? '军' : '州', officialPosition: '知' + name, taxLevel: '轻', fisc: [0.77, 0.07], hide: 1.3
  }, fields));
}

const BLOCKS = {
  桂州: gx('桂州', {
    terrain: '山地', specialResources: '银·桂·漓江舟运', taxLevel: '中', tags: { fishingRegion: true },
    description: '始安郡，静江军节度，大观元年升帅府，知州兼广南西路经略安抚使；兴安县灵渠沟通湘、漓二水，为岭南北舟运所系。',
    idx: [58, 30, 58, 58, 14, 66, 42, 38], hide: 1.1, keju: 1.3, corridor: 1.4,
    notes: '一路帅府，志中标题静江府（绍兴三年升）。'
  }),
  柳州: gx('柳州', {
    terrain: '山地', specialResources: '银·木材', tags: { mineralRegion: true },
    description: '龙城郡，马平、洛容、柳城三县，柳江所经；唐柳宗元曾刺此州，土贡银。',
    idx: [58, 28, 52, 52, 14, 66, 38, 34], notes: '贡银。'
  }),
  象州: gx('象州', {
    terrain: '丘陵', specialResources: '金·藤器', tags: { mineralRegion: true },
    description: '象郡，阳寿、来宾、武化、武仙四县，土贡金、藤器、槵子。',
    idx: [58, 28, 50, 50, 14, 64, 38, 34], notes: '贡金。'
  }),
  融州: gx('融州', {
    terrain: '山地', specialResources: '木材·银',
    tags: {},
    description: '融水郡，清远军节度，大观二年曾升帅府，次年罢；融水、怀远诸县与砦堡，北接溪峒。',
    idx: [56, 28, 46, 46, 18, 62, 44, 34], hide: 1.5, notes: '溪峒边州，隐户多。'
  }),
  昭州: gx('昭州', {
    terrain: '丘陵', specialResources: '银·茶', tags: { mineralRegion: true },
    description: '平乐郡，平乐、立山、龙平、恭城四县，桂江所经，土贡银。',
    idx: [58, 28, 52, 52, 14, 66, 38, 34], notes: '贡银。'
  }),
  贺州: gx('贺州', {
    terrain: '丘陵', specialResources: '银·锡', tags: { mineralRegion: true },
    description: '临贺郡，临贺、富川、桂岭三县；本属广南东路，大观二年割属西路，土贡银。',
    idx: [58, 28, 54, 54, 14, 66, 36, 34], notes: '志列于广南东路，建炎元年已属西路。'
  }),
  梧州: gx('梧州', {
    terrain: '河谷', specialResources: '银·白石英·舟运', tags: { mineralRegion: true, fishingRegion: true },
    description: '苍梧郡，领苍梧一县，西江与桂江交汇，舟楫所聚，土贡银、白石英。',
    idx: [58, 28, 54, 54, 14, 66, 36, 34], notes: '一县之州，扼西江水道。'
  }),
  藤州: gx('藤州', {
    terrain: '河谷', specialResources: '银·鱼', tags: { mineralRegion: true, fishingRegion: true },
    description: '感义郡，镡津、岑溪二县，浔江所经，土贡银。',
    idx: [58, 28, 50, 50, 14, 64, 36, 34], notes: '贡银。'
  }),
  容州: gx('容州', {
    terrain: '丘陵', specialResources: '银·朱砂', tags: { mineralRegion: true },
    description: '普宁郡，宁远军节度，普宁、陆川、北流三县，土贡银、朱砂。',
    idx: [58, 28, 52, 52, 14, 66, 38, 34], notes: '下都督府。'
  }),
  郁林州: gx('郁林州', {
    terrain: '丘陵', specialResources: '粮·银',
    tags: {},
    description: '郁林郡，南流、兴业二县；政和元年废白州，以博白来隶。',
    idx: [58, 28, 38, 36, 14, 56, 44, 34], notes: '地近南海，繁荣低。'
  }),
  浔州: gx('浔州', {
    terrain: '河谷', specialResources: '银·鱼', tags: { mineralRegion: true, fishingRegion: true },
    description: '浔江郡，领桂平一县，浔江所经，土贡银。',
    idx: [58, 28, 50, 50, 14, 64, 36, 34], notes: '一县之州。'
  }),
  贵州: gx('贵州', {
    terrain: '河谷', specialResources: '银·鱼', tags: { mineralRegion: true, fishingRegion: true },
    description: '怀泽郡，领郁林一县，郁江所经，土贡银。',
    idx: [58, 28, 50, 50, 14, 64, 36, 34], notes: '一县之州。'
  }),
  龚州: gx('龚州', {
    terrain: '河谷', specialResources: '粮·鱼', tags: { fishingRegion: true },
    description: '临江郡，领平南一县，浔江所经；政和元年一度废入浔州，三年复置。',
    idx: [58, 28, 48, 48, 14, 62, 36, 34], notes: '一县之州。'
  }),
  宾州: gx('宾州', {
    terrain: '山地', specialResources: '银·藤器', tags: { mineralRegion: true },
    description: '安城郡，岭方、迁江、上林三县，昆仑关在境，北通邕州；皇祐间狄青夜夺昆仑关即在此。',
    idx: [58, 28, 48, 48, 14, 62, 42, 34], notes: '邕州北面关隘。'
  }),
  横州: gx('横州', {
    terrain: '河谷', specialResources: '银·鱼', tags: { mineralRegion: true, fishingRegion: true },
    description: '宁浦郡，宁浦、永定二县，郁江所经，土贡银。',
    idx: [58, 28, 46, 46, 14, 62, 38, 34], notes: '贡银。'
  }),
  邕州: gx('邕州', {
    terrain: '丘陵', specialResources: '银·香药·木材',
    tags: {},
    description: '永宁郡，建武军节度，大观元年升望郡；控扼左右江溪峒，西南通大理，南接交趾。皇祐间侬智高曾陷此城。',
    idx: [56, 28, 48, 48, 18, 62, 50, 36], hide: 1.5, corridor: 1.3,
    notes: '边州，下辖多羁縻溪峒，隐户多、军压高。'
  }),
  宜州: gx('宜州', {
    terrain: '山地', specialResources: '木材·银',
    tags: {},
    description: '龙水郡，宣和元年赐庆远军额，龙水、天河、忻城、思恩、河池诸县并羁縻州十，溪峒杂处；黄庭坚晚年谪死于此。',
    idx: [54, 28, 44, 44, 20, 60, 46, 34], hide: 1.6, notes: '志中标题庆远府（咸淳元年升）。羁縻州多，隐户最多。'
  }),
  钦州: gx('钦州', {
    terrain: '沿海', specialResources: '海盐·高良姜·翡翠', tags: { saltRegion: true, fishingRegion: true },
    description: '宁越郡，灵山、安远二县，濒海，海道通交趾，土贡高良姜、翡翠。',
    idx: [58, 28, 38, 36, 14, 56, 46, 34], notes: '与交趾往来之口岸。'
  }),
  廉州: gx('廉州', {
    terrain: '沿海', specialResources: '珍珠·海盐·鱼', tags: { saltRegion: true, fishingRegion: true },
    description: '合浦郡，合浦、石康二县，濒海，合浦珠池自古闻名，沿海有盐场。',
    idx: [58, 28, 38, 36, 14, 56, 44, 34], notes: '合浦珠。'
  }),
  雷州: gx('雷州', {
    terrain: '沿海', specialResources: '海盐·良姜·斑竹', tags: { saltRegion: true, fishingRegion: true },
    description: '海康郡，领海康一县，雷州半岛，隔海与琼州相望，土贡良姜，元丰贡斑竹。',
    idx: [58, 28, 38, 36, 14, 56, 44, 34], notes: '渡海往琼州之口。'
  }),
  高州: gx('高州', {
    terrain: '丘陵', specialResources: '海盐·粮', tags: { saltRegion: true },
    description: '高凉郡，电白、信宜、茂名三县，景德元年一度并入窦州，三年复置。',
    idx: [58, 28, 36, 36, 14, 54, 44, 34], notes: '濒海盐场。'
  }),
  化州: gx('化州', {
    terrain: '沿海', specialResources: '银·高良姜·海盐', tags: { mineralRegion: true, saltRegion: true, fishingRegion: true },
    description: '陵水郡，本辩州，太平兴国五年改名，石龙、吴川二县，土贡银、高良姜。',
    idx: [58, 28, 36, 36, 14, 54, 44, 34], notes: '贡银。'
  }),
  琼州: gx('琼州', {
    terrain: '沿海', specialResources: '香药·槟榔·海盐', tags: { saltRegion: true, fishingRegion: true },
    description: '琼山郡，靖海军节度，琼山、澄迈、文昌、临高、乐会五县，海南岛北部，黎峒环居其南；大观元年曾以黎母山夷峒建镇州，政和元年废，以其军额来归。',
    idx: [58, 28, 40, 38, 16, 56, 46, 34], hide: 1.4, notes: '海南首州。'
  }),
  昌化军: gx('昌化军', {
    terrain: '沿海', specialResources: '香药·槟榔·海盐', tags: { saltRegion: true, fishingRegion: true },
    description: '本儋州，熙宁六年废州为军，宜伦、昌化、感恩三县；苏轼晚年谪居于此。',
    idx: [58, 28, 34, 34, 16, 54, 44, 32], hide: 1.4, notes: '志中标题南宁军（后改）。'
  }),
  万安军: gx('万安军', {
    terrain: '沿海', specialResources: '香药·槟榔', tags: { fishingRegion: true },
    description: '本万安州，熙宁七年废为军，万宁、陵水二县，海南岛东南。',
    idx: [58, 28, 32, 32, 16, 52, 44, 32], hide: 1.5, notes: '元丰户仅二百余。'
  }),
  吉阳军: gx('吉阳军', {
    terrain: '沿海', specialResources: '香药·槟榔', tags: { fishingRegion: true },
    description: '本崖州，熙宁六年废州为军，后名吉阳军，领宁远、吉阳等县，海南岛最南端。',
    idx: [58, 28, 32, 32, 16, 52, 44, 32], hide: 1.5, notes: '元丰户仅二百余。'
  }),
  海南山峒: block({
    name: '海南山峒', divisionType: '峒', officialPosition: '黎峒峒首', regionType: 'jimi', terrain: '山林',
    specialResources: '沉香·木材·山货', taxLevel: '轻', tags: {},
    description: '海南岛中部黎母山一带的黎峒，不入版籍，与四州军汉户以山货交易；大观初曾以其地建镇州，政和元年罢。',
    idx: [50, 20, 26, 26, 24, 30, 40, 30], fisc: [0.40, 0.05], hide: 2.0, keju: 0,
    notes: '黎峒不入版籍，户数为估数；羁縻，征到比例低。'
  })
};

module.exports = circuitModule('广南西路', {
  BLOCKS,
  regionMeans: { development: 49.98, unrest: 14, taxBurden: 64.61, armyPressure: 38.76 }
});
