// 绍宋·大金行政树的分路框架与逐块权重（外藩，用 patches/shaosong-circuits.js 本文件 运行）。
// 大金 87 块：河东、河北东西路 49 块原为宋地，户数取《宋史·地理志》崇宁户（data/shaosong-sources.js）；
// 燕云、辽东、临潢、大定、长春泰州与女真本部 38 块，取《金史·地理志》泰和户（sources/jinshi-dili-24-26.json），
// 除以两书折算比 1.73 折成崇宁口径（河北河东 42 州同时有两书户数，泰和 ÷ 崇宁 的中位数；
// 其中金吉州与宋吉州、金威州与宋威州同名异地，中位数不受影响）。势力全国合计不动。
'use strict';

const path = require('path');
const src = require('./shaosong-sources');
const JINSHI = require(path.join(__dirname, '..', 'sources', 'jinshi-dili-24-26.json'));

const TAIHE_TO_CHONGNING = 1.73;

// 北方各块 ← 《金史》府州（泰和户）；地图没有单列的金代州并入所在地块
const NORTH = {
  燕京: { jinshi: ['大兴府', '通州'], note: '燕京即金中都大兴府，通州并入' },
  涿州: { jinshi: ['涿州'] },
  易州: { jinshi: ['易州'] },
  蓟州: { jinshi: ['蓟州'] },
  顺州: { jinshi: ['顺州'], share: 0.5, note: '金省檀州入顺州（密云），顺州户与檀州块二分' },
  檀州: { jinshi: ['顺州'], share: 0.5, note: '金省檀州入顺州，取顺州户之半' },
  平州: { jinshi: ['平州', '滦州'], note: '滦州在平州块内' },
  营州: { jinshi: ['兴中府', '建州'], note: '唐营州柳城即辽兴中府（朝阳），建州并入' },
  云州: { jinshi: ['大同府'], note: '云州即辽金西京大同府' },
  应州: { jinshi: ['应州'] },
  朔州: { jinshi: ['朔州', '武州'], note: '武州并入' },
  蔚州: { jinshi: ['蔚州', '弘州'], note: '弘州（阳原）在蔚州、大同之间，并入' },
  奉圣州: { jinshi: ['德兴府'], note: '晋新州、辽奉圣州，金大安元年升德兴府' },
  燕云新州: { jinshi: ['宣德州', '抚州', '桓州', '昌州'], note: '地块在奉圣州以北、跨长城外，对应辽归化州（金宣德州）与抚、桓、昌诸州' },
  云内州: { jinshi: ['云内州', '东胜州'], note: '东胜州并入' },
  丰州天德军: { jinshi: ['丰州', '净州'], note: '净州并入' },
  辽阳府: { jinshi: ['辽阳府', '澄州'], note: '澄州（海城）并入' },
  沈州: { jinshi: ['沈州', '贵德州'], note: '贵德州（抚顺）并入' },
  辽东复州: { jinshi: ['复州'] },
  辽东辰州: { jinshi: ['盖州'], note: '辽辰州，金改盖州' },
  来州: { jinshi: ['瑞州'], note: '辽来州，金改宗州、瑞州' },
  锦州: { jinshi: ['锦州', '义州'], note: '义州（辽宜州）并入' },
  显州: { jinshi: ['广宁府', '懿州'], note: '辽显州，金升广宁府；懿州并入' },
  咸州: { jinshi: ['咸平府', '韩州'], note: '辽咸州，金升咸平府；韩州并入' },
  会宁: { jinshi: ['会宁府'], note: '金太宗建都，升会宁府' },
  出河店: { jinshi: ['肇州'], note: '《金史》肇州「旧出河店也」' },
  胡里改: { jinshi: ['胡里改路'] },
  临潢府: { jinshi: ['临潢府'] },
  契丹庆州: { jinshi: ['庆州'] },
  大定府: { jinshi: ['大定府', '利州', '兴州'], note: '利州、兴州并入' },
  长春州: { jinshi: ['泰州', '隆州', '信州'], note: '辽长春州即金承安后泰州；黄龙府（金隆州）与信州在其东，并入' },
  // 《金史》无户数或无对应州的块，按猛安谋克与部族估（泰和口径）
  按出虎水东部: { taihe: 5000, basis: '会宁府以东诸猛安谋克，志无户数，估' },
  合懒甸: { taihe: 4000, basis: '合懒路，志无户数，估' },
  曷苏馆: { taihe: 3000, basis: '曷苏馆路（熟女真），志无户数，估' },
  饶州北地: { taihe: 3000, basis: '辽饶州一带，金时废，志无户数，估' },
  临潢北境: { taihe: 2000, basis: '临潢以北部族牧地，估' },
  泰州北地: { taihe: 1500, basis: '辽旧泰州（金金安县）以北部族牧地，估' },
  兴安岭西麓: { taihe: 1000, basis: '兴安岭西麓部族牧地，估' }
};

// 宋地各块与《宋史》的对照特例（其余同名）
const SONG_SPECS = {
  沁州: { songshi: '威胜军', note: '宋威胜军，金改沁州' },
  邢州: { songshi: '信德府', note: '宋宣和元年升信德府，金复邢州' },
  赵州: { songshi: '庆源府', note: '宋宣和元年升庆源府，金复赵州（后改沃州）' }
};
Object.assign(src.LEAF_SPECS, SONG_SPECS, {
  井陉县: { countyOf: '真定府', counties: ['井陉'] },
  顺平军: { countyOf: '中山府', counties: ['北平'], note: '宋中山府北平县地，「顺平」为后世县名' },
  赞皇县: { countyOf: '赵州', counties: ['赞皇'] },
  五马山寨: { households: 2000, basis: '赞皇县五马山上的忠义山寨，志无户数，估' }
});

// 河北、河东诸府在《通考》商税表里的省称
Object.assign(src.SHANGSHUI_NAMES, {
  太原府: ['并'], 大名府: ['北京'], 河间府: ['瀛'], 中山府: ['定'], 隆德府: ['潞'], 平阳府: ['晋'], 开德府: ['澶'],
  沁州: ['威胜'], 清州: ['乾宁'], 保定军: ['保定'], 顺平军: [],
  真定府: ['真定'], 河中府: ['河中'], 保德军: ['保德'], 宁化军: ['宁化'], 火山军: ['火山'], 岢岚军: ['岢岚'],
  信安军: ['信安'], 顺安军: ['顺安'], 安肃军: ['安肃'], 广信军: ['广信']
});

function jinshiHouseholds(name) {
  const spec = NORTH[name];
  if (!spec) return null;
  if (spec.taihe) return { households: spec.taihe / TAIHE_TO_CHONGNING, counties: 1, basis: spec.basis + '，泰和口径 ' + spec.taihe + ' 户 ÷ ' + TAIHE_TO_CHONGNING };
  let total = 0;
  let counties = 0;
  const parts = spec.jinshi.map((n) => {
    const r = JINSHI.find((x) => x.nameS === n);
    if (!r || r.households == null) throw new Error('《金史》里没有 ' + n + ' 的户数');
    total += r.households;
    counties += r.countyCount || 1;
    return n + ' ' + r.households;
  });
  total *= spec.share || 1;
  return {
    households: total / TAIHE_TO_CHONGNING,
    counties: Math.max(1, Math.round(counties * (spec.share || 1))),
    basis: '《金史·地理志》' + parts.join('、') + (spec.share ? ' × ' + spec.share : '') + ' 户 ÷ ' + TAIHE_TO_CHONGNING + (spec.note ? '（' + spec.note + '）' : '')
  };
}

// 田亩：宋地按元丰各路每户田亩；燕云按河北每户田亩；辽东、大定按河东每户田亩（山地、半农半牧）；
// 临潢、长春、女真本部为渔猎游牧与屯垦之地，按河东每户田亩之半估
function landRate(circuit) {
  const r = src.yuanfengRates().rates;
  if (circuit === '燕山地区') return { rate: r['河北路'].landPerHousehold, tax: r['河北路'].taxPerHousehold, note: '按河北每户田亩' };
  if (/云中|辽东|大定/.test(circuit)) return { rate: r['河東路'].landPerHousehold, tax: r['河東路'].taxPerHousehold, note: '按河东每户田亩' };
  return { rate: r['河東路'].landPerHousehold * 0.5, tax: r['河東路'].taxPerHousehold * 0.5, note: '渔猎游牧之地，按河东每户田亩之半估' };
}

// 《宋史》保定军「析霸州文安、大城二县五百户隶军」，解析器把「县五百」读成县数；实领砦二，无属县
const COUNTY_FIXES = { 保定军: 1 };

function weights(name, circuit) {
  const north = jinshiHouseholds(name);
  if (north) {
    const lr = landRate(circuit);
    // 辽地无商税额可考，商贸按户数与大金宋地部分每户商税同率估（见 commercePerHousehold）
    return {
      households: north.households, commerce: north.households * commercePerHousehold(), land: north.households * lr.rate,
      twoTax: north.households * lr.tax, counties: north.counties,
      householdBasis: north.basis, commerceBasis: '辽地无商税额可考，按户数同率估；田亩' + lr.note
    };
  }
  const hh = src.householdWeight(name);
  const comm = src.commerceWeight(name, circuit);
  const lt = src.landAndTaxWeight(name, circuit);
  return {
    households: hh.households, commerce: comm.value, land: lt.land, twoTax: lt.twoTax, counties: COUNTY_FIXES[name] || src.countyCountOf(name),
    householdBasis: hh.basis, commerceBasis: comm.basis
  };
}

// 大金宋地（河东、河北东西路）每崇宁户商税权重，用于辽地估商贸
const SONG_LAND_BLOCKS = [
  '太原府', '隆德府', '泽州', '平阳府', '绛州', '解州', '河中府', '辽州', '沁州', '汾州', '石州', '隰州', '忻州', '代州', '岚州',
  '保德军', '宁化军', '火山军', '岢岚军', '大名府', '开德府', '沧州', '冀州', '河间府', '博州', '棣州', '德州', '滨州', '恩州',
  '清州', '莫州', '雄州', '霸州', '保定军', '信安军', '永静军', '真定府', '中山府', '洺州', '邢州', '赵州', '深州', '祁州',
  '保州', '顺安军', '安肃军', '广信军', '顺平军', '井陉县'
];
let cpCache = null;
function commercePerHousehold() {
  if (cpCache == null) {
    let c = 0;
    let h = 0;
    SONG_LAND_BLOCKS.forEach((n) => {
      const circuit = /太原|隆德|泽州|平阳|绛州|解州|河中|辽州|沁州|汾州|石州|隰州|忻州|代州|岚州|保德|宁化|火山|岢岚/.test(n) ? '河东路' : '河北路';
      c += src.commerceWeight(n, circuit).value;
      h += src.householdWeight(n).households;
    });
    cpCache = c / h;
  }
  return cpCache;
}

// 路一级：地图省道登记的名字；燕云以北诸组是「区域级制图编组」，长官写该地主城在天会五年（建炎元年）的官
// 《金史·地理志》辽阳府、大同府「旧置兵马都部署司」，天德二年后才改都总管府、留守司，天会五年写兵马都部署
const CIRCUITS = [
  {
    name: '河东路', officialPosition: '河东路兵马都总管', capital: '太原府',
    terrain: '山地', specialResources: '铁·煤·盐·马', taxLevel: '中',
    description: '靖康元年九月金西路军破太原，河东州县相继陷落，宗翰置帅于云中节制之；泽、潞以南与麟、府以西尚有宋军与义兵坚守，太行山中忠义寨林立。',
    strategicValue: '金西路军南下关陕、东出河北的根据地。', threats: ['太行忠义民兵', '宋将坚守孤城'],
    flee: 1.6, hide: 1.2, textile: 0.8
  },
  {
    name: '河北东路', officialPosition: '河北东路兵马都总管', capital: '河间府',
    terrain: '平原', specialResources: '绢·盐·粮', taxLevel: '中',
    description: '河北东路诸州多已为金东路军所得，河间、大名一带城池或降或守，民间结寨自保，与宋河北招抚司暗通声气。',
    strategicValue: '金东路军南下黄河的前进基地。', threats: ['河北忠义民兵', '宋军渡河反攻'],
    flee: 1.8, hide: 1.2, textile: 1.2
  },
  {
    name: '河北西路', officialPosition: '河北西路兵马都总管', capital: '真定府',
    terrain: '平原', specialResources: '绢·瓷·煤铁', taxLevel: '中',
    description: '真定、中山、邢、洺诸州已入金，然太行东麓山寨与五马山义军时出袭扰；金人于真定置帅府，镇抚新附州县。',
    strategicValue: '控太行东麓，扼宋人北复之路。', threats: ['五马山、八字军等忠义民兵'],
    flee: 1.8, hide: 1.2, textile: 1.2
  },
  {
    name: '燕山地区', officialPosition: '燕京留守', governor: '时立爱', capital: '燕京',
    terrain: '平原', specialResources: '粮·盐·马', taxLevel: '中',
    description: '辽南京析津府故地，宣和间宋人赎还燕京，靖康前又为金人所夺；燕京为金东路军根本，枢密院与留守司设于此，汉人官吏多为辽旧臣。',
    strategicValue: '金经略中原的前沿都会。', threats: ['汉人叛服不常', '契丹余众'],
    flee: 1.1, hide: 1.1, textile: 1.0
  },
  {
    name: '云中地区', officialPosition: '西京兵马都部署', capital: '云州',
    terrain: '边塞', specialResources: '马·羊·煤·铁', taxLevel: '轻',
    description: '辽西京大同府故地，金西路军元帅府驻云中，宗翰以此节制河东诸军；蔚、应、朔诸州汉民与契丹、奚部杂处。',
    strategicValue: '金西路军的大本营。', threats: ['契丹、奚部离心', '西夏'],
    flee: 1.0, hide: 1.1, textile: 0.7
  },
  {
    name: '辽东地区', officialPosition: '东京兵马都部署', capital: '辽阳府',
    terrain: '平原', specialResources: '粮·鱼·盐·参', taxLevel: '轻',
    description: '辽东京道故地，渤海遗民与汉人、女真杂居，天辅初即入金，置兵马都部署司；辽西诸州为北上燕京的走廊。',
    strategicValue: '金国粮仓与入关孔道。', threats: ['渤海遗民', '高丽'],
    flee: 1.0, hide: 1.0, textile: 0.8
  },
  {
    name: '女真本部', officialPosition: '会宁府尹', capital: '会宁',
    terrain: '寒地', specialResources: '马·貂皮·人参·珠', taxLevel: '轻',
    description: '按出虎水流域，金朝兴起之地，太宗吴乞买建都会宁；诸猛安谋克聚居，渔猎耕牧相兼，宋二帝北狩亦将迁置于此。',
    strategicValue: '金朝根本，兵源所出。', threats: [],
    flee: 1.0, hide: 1.0, textile: 0.5
  },
  {
    name: '临潢地区', officialPosition: '临潢府尹', capital: '临潢府',
    terrain: '草原', specialResources: '马·羊·皮毛', taxLevel: '轻',
    description: '辽上京临潢府故地，契丹祖陵与宫帐所在，辽亡后契丹诸部散处其间，耶律大石北走可敦城后，余众时有离心。',
    strategicValue: '控扼契丹故地与漠南诸部。', threats: ['契丹余众', '漠北诸部'],
    flee: 1.0, hide: 1.3, textile: 0.5
  },
  {
    name: '大定地区', officialPosition: '大定府尹', capital: '大定府',
    terrain: '丘陵', specialResources: '粮·马·羊', taxLevel: '轻',
    description: '辽中京大定府故地，奚人与汉人杂居，地当燕京、临潢、辽东之间。',
    strategicValue: '燕京与辽东、临潢之间的枢纽。', threats: ['奚部离心'],
    flee: 1.0, hide: 1.1, textile: 0.6
  },
  {
    name: '长春—泰州', officialPosition: '长春州节度使', capital: '长春州',
    terrain: '草原', specialResources: '马·牛羊·鱼', taxLevel: '轻',
    description: '辽长春州、泰州故地，契丹诸部牧地与黄龙府（金隆州）屯垦之地相接，辽帝春捺钵曾驻于此。',
    strategicValue: '女真本部西面屏障。', threats: ['漠北诸部'],
    flee: 1.0, hide: 1.3, textile: 0.5
  }
];

module.exports = {
  treeKey: 'fac_jin',
  idPrefix: 'div_ss_jin_',
  reportTitle: '绍宋·大金补路一级报告',
  treeLabel: '大金行政树去掉「大金」国号节点，',
  reportNotes: [
    '户数：宋地（河东、河北东西路）取《宋史·地理志》崇宁户；北方取《金史·地理志》泰和户，除以两书折算比 ' + TAIHE_TO_CHONGNING + '（河北河东 42 州配对中位数）。',
    '女真本部、临潢、长春泰州：泰和户在猛安谋克南迁之后，不能反映天会五年，保留原账人口合计，组内按泰和户分。',
    '田亩：宋地按元丰各路每户田亩；燕云按河北、辽东与云中大定按河东每户田亩，临潢、长春、女真本部按河东之半估。商贸：辽地无商税额可考，按户数与大金宋地部分每户商税同率估。'
  ],
  CIRCUITS,
  // 泰和户在猛安谋克南迁之后，女真故地与契丹牧地远少于天会五年；这三组保留原账人口合计，组内按泰和户分
  keepOriginalTotals: ['女真本部', '临潢地区', '长春—泰州'],
  // 原账大金的乡村名目：村寨、牧落、猛安谋克屯寨都是城镇以外的居住，并入「乡」
  settlementKeys: { 村寨: '乡', 牧落: '乡', 猛安谋克屯寨: '乡' },
  PORTS: {},
  weights,
  TAIHE_TO_CHONGNING,
  NORTH
};
