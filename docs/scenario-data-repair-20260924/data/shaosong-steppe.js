// 绍宋·漠北与阴山七部：乃蛮、克烈、蔑儿乞、蒙兀诸部、塔塔儿、弘吉剌、阴山诸部（汪古）。
// 草原诸部无户口可考，各块按原账户数分，势力合计不动；重写路一级、官称、地形物产与描述。
// 官称与剧本人物表对得上的照人物写（游戏按官称活绑定主官）；诸部首领年代与史实的出入留到人物阶段处理。
'use strict';

const { foreignTree, block } = require('./shaosong-foreign');

const O = 'original';
// idx：[民心, 吏治(贪腐), 繁荣, 发展, 不稳, 税压, 军压, 官风险]；fisc：[征到比例, 截留率]
function nb(name, prosperity, fields) {
  return block(Object.assign({
    name, divisionType: '部', regionType: 'nomadic_confederation', taxLevel: '轻', terrain: '草原', tags: { horseRegion: true },
    idx: [44, 18, prosperity, prosperity, 24, 38, 80, 30], fisc: [0.75, 0.05]
  }, fields, { notes: fields.notes || '户数按原账（无户口可考）。' }));
}
function frame(name, officialPosition, capital, fields) {
  return Object.assign({ name, officialPosition, capital, taxLevel: '轻', terrain: '草原', threats: [], flee: 1.0, hide: 1.3, textile: 0.4 }, fields);
}
function tree(treeKey, idPrefix, faction, circuitName, circuitFrame, blocks, leaves, regionMeans, extra) {
  return foreignTree(Object.assign({
    treeKey, idPrefix, faction,
    reportNotes: ['户数：草原诸部无户口可考，按原账户数分。'],
    leaves,
    circuits: [{ name: circuitName, frame: circuitFrame, blocks, regionMeans }]
  }, extra));
}
const P = (extra) => Object.assign({ households: O, economy: 'pastoral' }, extra);

const naiman = tree('fac_caoyuan', 'div_ss_nm_', '乃蛮部', '乃蛮',
  frame('乃蛮', '乃蛮大汗', '阿尔泰东麓', {
    specialResources: '马·羊·铁·毛毡',
    description: '阿尔泰山与额尔齐斯河上游的乃蛮部，西邻高昌回鹘与喀喇汗诸部，信景教。',
    strategicValue: '漠北西部强部。', threats: ['克烈部']
  }),
  {
    额尔齐斯上游: nb('额尔齐斯上游', 24, {
      officialPosition: '乃蛮大那颜·统军', specialResources: '马·羊·鱼', tags: { horseRegion: true, fishingRegion: true },
      description: '额尔齐斯河上游河谷牧地，乃蛮西境。'
    }),
    阿尔泰东麓: nb('阿尔泰东麓', 24, {
      officialPosition: '乃蛮大汗', terrain: '山地', specialResources: '马·羊·铁',
      description: '阿尔泰山东麓，乃蛮汗帐所在，山中冶铁。', tags: { horseRegion: true, mineralRegion: true }
    }),
    杭爱西麓: nb('杭爱西麓', 22, {
      officialPosition: '乃蛮那颜·东境统兵', specialResources: '马·羊',
      description: '杭爱山西麓至科布多诸湖的牧地，乃蛮东境，与克烈相接。'
    })
  },
  { 额尔齐斯上游: P(), 阿尔泰东麓: P(), 杭爱西麓: P() },
  { development: 22.71, unrest: 24, taxBurden: 37.43, armyPressure: 88.78 });

const kereit = tree('fac_kereit', 'div_ss_kl_', '克烈部', '克烈',
  frame('克烈', '克烈·不亦鲁黑汗', '土兀剌河', {
    specialResources: '马·羊·毛毡·粮',
    description: '土兀剌河、鄂尔浑河流域的克烈部，漠北中部强部，信景教，汗帐在土兀剌河黑林。',
    strategicValue: '漠北中部。', threats: ['乃蛮', '塔塔儿', '蔑儿乞']
  }),
  {
    土兀剌河: nb('土兀剌河', 26, {
      officialPosition: '克烈·不亦鲁黑汗', specialResources: '马·羊·毛毡',
      description: '土兀剌河（土拉河）黑林，克烈汗帐所在，景教徒众多。'
    }),
    鄂尔浑河: nb('鄂尔浑河', 22, {
      officialPosition: '克烈·汗弟', terrain: '河谷', specialResources: '马·羊·粮',
      description: '鄂尔浑河上游，回鹘汗国斡耳朵八里、辽可敦城故地一带，河谷间有耕种。'
    }),
    杭爱东麓: nb('杭爱东麓', 22, {
      officialPosition: '克烈·部酋', specialResources: '马·羊',
      description: '杭爱山东麓牧地，克烈西境，与乃蛮相接。'
    })
  },
  { 土兀剌河: P(), 鄂尔浑河: P({ economy: 'mixed' }), 杭爱东麓: P() },
  { development: 23.64, unrest: 23.53, taxBurden: 38.36, armyPressure: 80.51 });

const merkit = tree('fac_merkit', 'div_ss_mk_', '蔑儿乞部', '蔑儿乞',
  frame('蔑儿乞', '蔑儿乞·别乞', '色楞格河', {
    terrain: '林地', specialResources: '马·貂皮·鱼',
    description: '色楞格河下游林木水泽之地的蔑儿乞部，兀都亦惕、兀洼思、合阿惕诸支，渔猎游牧相兼。',
    strategicValue: '漠北北部林地。', threats: ['克烈部']
  }),
  {
    色楞格河: nb('色楞格河', 20, {
      // 「蔑儿乞·别乞」同时是脱黑脱阿官衔的前缀，活绑定会歧义，写明掌官
      officialPosition: '蔑儿乞·别乞', governor: '脱脱里·别乞', terrain: '林地', specialResources: '貂皮·鱼·马', tags: { horseRegion: true, fishingRegion: true },
      description: '色楞格河下游林木水泽，蔑儿乞兀都亦惕诸部所居，渔猎游牧相兼。'
    }),
    鄂尔浑下游: nb('鄂尔浑下游', 22, {
      officialPosition: '兀洼思·那颜', specialResources: '马·羊·鱼',
      description: '鄂尔浑河与色楞格河汇流之地，蔑儿乞兀洼思部牧地。'
    })
  },
  { 色楞格河: P(), 鄂尔浑下游: P() },
  { development: 21, unrest: 24, taxBurden: 38, armyPressure: 77 });

const mongol = tree('fac_mongol', 'div_ss_mg_', '蒙兀诸部', '蒙兀',
  frame('蒙兀', '蒙兀·合不勒汗', '斡难河', {
    specialResources: '马·羊·貂皮',
    description: '斡难河、怯绿连河、土兀剌河三河之源的蒙兀诸部，合不勒统合乞颜、泰赤乌诸部称汗，与塔塔儿世仇。',
    strategicValue: '三河源头。', threats: ['塔塔儿', '金']
  }),
  {
    斡难河: nb('斡难河', 22, {
      officialPosition: '蒙兀·合不勒汗', specialResources: '马·羊',
      description: '斡难河（鄂嫩河）上游，乞颜部合不勒汗驻牧之地。'
    }),
    怯绿连河: nb('怯绿连河', 22, {
      officialPosition: '乞颜·把儿坛把阿秃儿', specialResources: '马·羊',
      description: '怯绿连河（克鲁伦河）上中游牧地，东接塔塔儿。'
    }),
    肯特山: nb('肯特山', 20, {
      officialPosition: '乞颜·忽图剌', terrain: '山林', specialResources: '马·貂皮·木材',
      description: '不儿罕山（肯特山），三河发源之地，蒙兀奉为神山；原账肯特山、三河源两笔并入。'
    })
  },
  { 斡难河: P(), 怯绿连河: P(), 肯特山: P() },
  { development: 20.6, unrest: 24, taxBurden: 38.22, armyPressure: 92 },
  { treeLabel: '蒙兀诸部行政树去掉国号节点（肯特山原账两笔核算项并回一块），' });

const tatar = tree('fac_tatar', 'div_ss_tt_', '塔塔儿联盟', '塔塔儿',
  frame('塔塔儿', '塔塔儿·诸部盟主', '捕鱼儿海子', {
    specialResources: '马·羊·鱼·盐',
    description: '捕鱼儿海（贝尔湖）、阔连海（呼伦湖）一带的塔塔儿诸部，依附金朝，受其封号，与蒙兀世仇。',
    strategicValue: '金北边的藩屏。', threats: ['蒙兀诸部']
  }),
  {
    捕鱼儿海子: nb('捕鱼儿海子', 20, {
      officialPosition: '塔塔儿·诸部盟主', specialResources: '马·羊·鱼', tags: { horseRegion: true, fishingRegion: true },
      description: '捕鱼儿海（贝尔湖）一带，塔塔儿诸部盟主驻牧；原账塔塔儿南缘、捕鱼儿湖东部两笔并入。'
    }),
    答兰捏木儿: nb('答兰捏木儿', 18, {
      officialPosition: '塔塔儿·都塔兀惕支那颜', specialResources: '马·羊',
      description: '答兰捏木儿格思之地，塔塔儿东部牧场。'
    }),
    克鲁伦下游: nb('克鲁伦下游', 18, {
      officialPosition: '塔塔儿·阿勒赤支那颜', specialResources: '马·鱼·湖盐·羊', tags: { horseRegion: true, fishingRegion: true, saltRegion: true },
      description: '怯绿连河下游至阔连海（呼伦湖），塔塔儿西部；原账塔塔儿西部、捕鱼儿湖西部两笔并入。'
    })
  },
  { 捕鱼儿海子: P(), 答兰捏木儿: P(), 克鲁伦下游: P() },
  { development: 18.47, unrest: 24, taxBurden: 38.76, armyPressure: 77 },
  { treeLabel: '塔塔儿联盟行政树去掉国号节点（捕鱼儿海子、克鲁伦下游原账各两笔核算项，并回一块），' });

const qongirat = tree('fac_qongirat', 'div_ss_hj_', '弘吉剌部', '弘吉剌',
  frame('弘吉剌', '弘吉剌部·诸部大那颜', '额尔古纳南岸', {
    specialResources: '马·羊·鱼·貂皮',
    description: '额尔古纳河与呼伦湖东南的弘吉剌部，以与诸部结亲著称，南接金界。',
    strategicValue: '', threats: ['塔塔儿']
  }),
  {
    额尔古纳南岸: nb('额尔古纳南岸', 20, {
      officialPosition: '弘吉剌部·诸部大那颜', specialResources: '马·羊·鱼', tags: { horseRegion: true, fishingRegion: true },
      description: '额尔古纳河南岸与呼伦湖东，弘吉剌大营所在。'
    }),
    兴安岭北麓: nb('兴安岭北麓', 20, {
      officialPosition: '弘吉剌东营那颜', terrain: '林地', specialResources: '马·貂皮·木材',
      description: '大兴安岭北麓的林缘牧地，弘吉剌东部分支所居。'
    })
  },
  { 额尔古纳南岸: P(), 兴安岭北麓: P() },
  { development: 20, unrest: 24, taxBurden: 37.47, armyPressure: 77 });

const ongud = tree('fac_ongud', 'div_ss_ys_', '阴山诸部', '阴山',
  frame('阴山', '汪古西部那颜', '阴山西部', {
    specialResources: '马·羊·毛毡·粮',
    description: '阴山以北的汪古等诸部，信景教，为金守北边，互市于天德军、云内州。',
    strategicValue: '金西北边的藩屏。', threats: ['漠北诸部'], hide: 1.1
  }),
  {
    阴山西部: nb('阴山西部', 20, {
      officialPosition: '汪古西部那颜', regionType: 'tribal_frontier', specialResources: '马·羊·毛毡',
      description: '阴山西段以北，汪古诸部牧地，北望漠北。'
    }),
    阴山东部: nb('阴山东部', 20, {
      officialPosition: '汪古东部那颜', regionType: 'tribal_frontier', specialResources: '马·羊·粮',
      description: '阴山东段以北，近金西北路边帐，诸部于天德军互市。'
    })
  },
  { 阴山西部: P({ economy: 'mixed' }), 阴山东部: P({ economy: 'mixed' }) },
  { development: 20, unrest: 24, taxBurden: 35, armyPressure: 92 });

module.exports = { trees: [naiman, kereit, merkit, mongol, tatar, qongirat, ongud] };
