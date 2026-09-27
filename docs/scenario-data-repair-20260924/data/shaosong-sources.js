// 绍宋·宋廷各地块的史料取数规则：每块的户数权重（崇宁户口）与商税权重（熙宁十年以前商税岁额）从哪来、怎么折。
// 分路框架（patches/shaosong-circuits.js）与各路数据模块都从这里取，保证两层用同一套权重。
//
// 史料（sources/ 下，解析脚本同目录）：
//   《宋史·地理志》卷八十五至九十：各府州军监崇宁户、属县与县等（songshi-dili-85-90.json）
//   《元丰九域志》：各州元丰主客户（jiuyuzhi-yuanfeng.json）、各县乡数（jiuyuzhi-xiang.json）
//   《文献通考·征榷考一》：熙宁十年以前诸州商税岁额八档（wenxian-tongkao-14-shangshui.json）
'use strict';

const path = require('path');
const SRC = path.join(__dirname, '..', 'sources');
const SONGSHI = require(path.join(SRC, 'songshi-dili-85-90.json'));
const SHANGSHUI = require(path.join(SRC, 'wenxian-tongkao-14-shangshui.json'));
const XIANG = require(path.join(SRC, 'jiuyuzhi-xiang.json'));

// 《宋史》只载元丰户的州（广南两路、夔州路多如此），折成崇宁口径：
// 两书都有户数的 166 州，崇宁户 ÷ 元丰户 的中位数为 1.025（四分位 0.92～1.16）
const YUANFENG_TO_CHONGNING = 1.025;

// 九域志乡数的个别讹字
const XIANG_FIXES = {
  亳州: { 谯: [10, '四库本作「一千鄉」，当为「一十鄉」之讹'] }
};

// 县等折户：宋制按户数定县等（建隆元年：四千户以上为望，三千以上为紧，二千以上为上，千户以上为中，
// 不满千户为中下，五百户以下为下）。各等取档内代表户数；赤县为京城附郭，连城内坊郭计；畿县、次畿按望县计；
// 志中没写等第的县按中县计。只在九域志没有乡数、或志中无户数的州军估户时用。
const GRADE_HOUSEHOLDS = {
  赤: 20000, 次赤: 12000, 畿: 6000, 次畿: 6000, 望: 6000, 緊: 3500, 紧: 3500,
  上: 2500, 中: 1500, 中下: 750, 下: 400, '': 1500
};

// 四蜀（成都府、潼川府〔梓州〕、利州、夔州四路）商税纳铁钱，《通考》按语：「十才及铜钱之一」
const IRON_CASH_CIRCUITS = ['成都府路', '潼川府路', '利州路', '夔州路', '三泉直隶'];
const IRON_CASH_RATE = 0.1;

// 剧本地块名 → 九域志州名（元丰时的名字，和建炎元年不同的）
const YUANFENG_NAMES = { 寿春府: '寿州', 中山府: '定州' };

// ---------------------------------------------------------------------------
// 地块取数特例。没列的地块按同名《宋史》条目取崇宁户。
//   songshi：志中标题（多为南宋定名；建炎元年仍用旧名）
//   parts：从别的府州切出的地块，每项 { from: 上级（剧本地块名，上级不在地图上的写志中名）, counties: [元丰县名] }；
//     按九域志乡数切，上级地块自动扣除。只有一个上级时可简写为 countyOf + counties。
//   grades：九域志没有这个州的乡数时，改按县等切，给出志中未载的县等
//   yuanfeng：志中无户数，用《元丰九域志》主客户
//   households + basis：史料都无户数，直接给估数并写明依据
// ---------------------------------------------------------------------------
const LEAF_SPECS = {
  // 京畿：开封府十六县，五县另成地块（杞县宋称雍丘，酸枣县政和七年改名延津）
  陈留县: { countyOf: '开封府', counties: ['陈留'] },
  杞县: { countyOf: '开封府', counties: ['雍丘'] },
  尉氏县: { countyOf: '开封府', counties: ['尉氏'] },
  酸枣县: { countyOf: '开封府', counties: ['酸枣'] },
  封丘县: { countyOf: '开封府', counties: ['封丘'] },
  // 京东
  拱州: { parts: [{ from: '开封府', counties: ['襄邑'] }, { from: '应天府', counties: ['柘城'] }], note: '宣和六年后领襄邑、柘城二县，崇宁元年二县分属开封府、应天府' },
  滕县: { countyOf: '徐州', counties: ['滕'] },
  宁海县: { countyOf: '登州', counties: ['牟平', '文登'], note: '金人后置宁海州，宋时为登州牟平、文登二县' },
  // 京西
  巩县: { countyOf: '河南府', counties: ['巩'] },
  光化军: { households: 6000, basis: '《宋史·地理志》光化军无户数，志载「縣一，乾德。望」，按望县折户' },
  汜水县: { countyOf: '孟州', counties: ['汜水'] },
  // 淮南
  鹿邑县: { countyOf: '亳州', counties: ['鹿邑'] },
  蒙城县: { countyOf: '亳州', counties: ['蒙城'] },
  涟水军: { songshi: '安东州' },
  舒州: { songshi: '安庆府' },
  六安军: { countyOf: '寿春府', counties: ['六安'], note: '政和八年以寿春府六安县建军，崇宁时仍属寿州' },
  // 江南
  宣州: { songshi: '宁国府' },
  洪州: { songshi: '隆兴府' },
  虔州: { songshi: '赣州' },
  筠州: { songshi: '瑞州' },
  // 两浙
  杭州: { songshi: '临安府' },
  秀州: { songshi: '嘉兴府' },
  越州: { songshi: '绍兴府' },
  明州: { songshi: '庆元府' },
  温州: { songshi: '瑞安府' },
  严州: { songshi: '建德府' },
  江阴军: { countyOf: '常州', counties: ['江阴'], note: '熙宁四年废军为县隶常州，建炎初复置军；崇宁户仍在常州数内' },
  昌国县: { countyOf: '明州', counties: ['昌国'] },
  // 荆湖
  鼎州: { songshi: '常德府' },
  邵州: { songshi: '宝庆府' },
  桂阳监: { songshi: '桂阳军' },
  武冈军: { countyOf: '邵州', counties: ['武冈'], note: '崇宁五年以邵州武冈县建军（后析置绥宁、临冈），崇宁元年户仍在邵州数内' },
  茶陵县: { countyOf: '衡州', counties: ['茶陵'], note: '绍兴九年方升茶陵军，建炎元年仍为衡州属县' },
  // 福建
  建州: { songshi: '建宁府' },
  长溪县: { countyOf: '福州', counties: ['长溪'] },
  // 广南
  英州: { songshi: '英德府' },
  康州: { songshi: '德庆府' },
  桂州: { songshi: '静江府' },
  宜州: { songshi: '庆远府' },
  昌化军: { songshi: '南宁军' },
  海南山峒: { households: 3000, basis: '黎峒不入版籍，志无户数；按琼州属县一县之数估' },
  // 四川
  蜀州: { songshi: '崇庆府' },
  嘉州: { songshi: '嘉定府' },
  果州: { songshi: '顺庆府' },
  广安军: { songshi: '宁西军' },
  长宁军: { households: 5000, basis: '政和四年以泸州淯井监建军，志无户数，元丰时淯井监不单列户；按下州估' },
  忠州: { songshi: '咸淳府' },
  恭州: { songshi: '重庆府' },
  黔州: { songshi: '绍庆府' },
  珍州: { households: 2000, basis: '大观间以羁縻地置州，志无户数；按下县估' },
  播州: { households: 3000, basis: '大观二年杨氏纳土置州，志无户数；按下县估' },
  思州: { households: 3000, basis: '政和八年田氏纳土置州，志无户数；按下县估' },
  南平军: { households: 12000, basis: '熙宁八年以渝州南川、隆化二县建军，志与九域志均未得户数；按二中县估' },
  剑州: { songshi: '隆庆府' },
  兴州: { songshi: '沔州' },
  三泉县: { songshi: '大安军' },
  // 陕西
  庆州: { songshi: '庆阳府' },
  乾州: { parts: [{ from: '京兆府', counties: ['奉天', '醴泉'] }, { from: '邠州', counties: ['永寿'] }], note: '政和七年以京兆府奉天县置醴州（即旧乾州），后割京兆府醴泉、武功与邠州永寿来隶；武功九域志未见乡数，不计' },
  丹州: { yuanfeng: 9835, basis: '《宋史》未单列丹州，取《元丰九域志》主户 7988、客户 1847' },
  绥德军: { households: 8000, basis: '熙宁间收复绥州，以堡寨军户为主，志无户数；按上州之半估' },
  廓州: { households: 3000, basis: '崇宁间新复蕃部，志无户数；按堡寨数估' },
  湟州: { households: 5000, basis: '崇宁二年复湟州（后改乐州），蕃汉杂处，志无户数；按堡寨数估' },
  洮州: { households: 3000, basis: '大观间新复蕃部，志无户数；按堡寨数估' },
  积石军: { households: 2000, basis: '大观二年建军，志无户数；按堡寨数估' },
  // 河北
  共城县: { countyOf: '卫州', counties: ['共城'] },
  太行陉: { households: 1000, basis: '太行八陉之一，关隘与山中堡寨，志无户数；按下县之半估' }
};

// 地块 → 《通考》商税表名（省称）的特例。没列的地块：去掉末尾的州字后同名，或全名同名。
const SHANGSHUI_NAMES = {
  开封府: ['东京', '开封'], 应天府: ['南京'], 河南府: ['西京'], 平江府: ['苏'], 镇江府: ['润'],
  济南府: ['齐'], 东平府: ['郓'], 兴仁府: ['曹'], 袭庆府: ['兖'], 颍昌府: ['许'], 淮宁府: ['陈'],
  顺昌府: ['颍'], 江宁府: ['江宁'], 襄阳府: ['襄'], 江陵府: ['江陵'], 德安府: ['安'], 寿春府: ['寿'],
  肇庆府: ['端'], 徽州: ['歙'], 严州: ['睦'], 遂宁府: ['遂'], 潼川府: ['梓'], 叙州: ['戎'], 恭州: ['渝'],
  兴元府: ['兴元'], 凤翔府: ['凤翔'], 京兆府: ['京兆'], 延安府: ['延'], 政州: ['龙'], 仙井监: ['陵井监'],
  巩州: ['通远'], 成都府: ['成都'], 涟水军: ['涟水'], 高邮军: ['高邮'], 无为军: ['无为'], 淮阳军: ['淮阳'],
  信阳军: ['信阳'], 光化军: ['光化'], 广德军: ['广德'], 南康军: ['南康'], 兴国军: ['兴国'], 临江军: ['临江'],
  建昌军: ['建昌'], 南安军: ['南安'], 江阴军: ['江阴'], 汉阳军: ['汉阳'], 荆门军: ['荆门'], 桂阳监: ['桂阳'],
  邵武军: ['邵武'], 兴化军: ['兴化'], 南剑州: ['南剑'], 南雄州: ['南雄'], 南恩州: ['南恩'], 昌化军: ['昌化'],
  万安军: ['万安'], 吉阳军: ['珠崖'], 郁林州: ['郁林'], 永康军: ['永康'], 广安军: ['广安'], 怀安军: ['怀安'],
  富顺监: ['富顺监'], 云安军: ['云安'], 梁山军: ['梁山'], 大宁监: ['大宁监'], 南平军: ['南平'], 三泉县: ['三泉县'],
  保安军: ['保安'], 绥德军: [], 积石军: [], 石泉军: [], 武冈军: [], 长宁军: []
};
// 商税表未列、也不能从上级切出的地块，按最低一档（五千贯以下）计
const SHANGSHUI_FLOOR = 3000;

// ---------------------------------------------------------------------------
function pickSongshi(name) {
  const hits = SONGSHI.filter((r) => r.nameS === name);
  if (!hits.length) return null;
  // 同名多条（金州、凤州在京西、利州两处出现）取有户数的那条
  return hits.find((r) => r.chongning) || hits.find((r) => r.otherCensus) || hits[0];
}

function songshiNameOf(leafName) {
  return (LEAF_SPECS[leafName] && LEAF_SPECS[leafName].songshi) || leafName;
}

function censusOf(entry) {
  if (!entry) return null;
  if (entry.chongning) {
    return { households: entry.chongning.households, basis: '《宋史·地理志》' + entry.nameS + (entry.chongning.unlabeled ? '户（未冠年号，志中户口通为崇宁数）' : '崇宁户') };
  }
  if (entry.otherCensus && entry.otherCensus.era === '元豐') {
    return {
      households: Math.round(entry.otherCensus.households * YUANFENG_TO_CHONGNING),
      basis: '《宋史·地理志》' + entry.nameS + '只载元丰户 ' + entry.otherCensus.households + '，× ' + YUANFENG_TO_CHONGNING + ' 折崇宁'
    };
  }
  return null;
}

// 某州的乡数表（已按讹字表更正）
function xiangOf(fromName) {
  const table = XIANG[YUANFENG_NAMES[fromName] || fromName];
  if (!table) return null;
  const fixed = Object.assign({}, table);
  Object.entries(XIANG_FIXES[YUANFENG_NAMES[fromName] || fromName] || {}).forEach(([c, [n]]) => { fixed[c] = n; });
  return fixed;
}

function partsOf(spec) {
  if (spec.parts) return spec.parts;
  if (spec.countyOf) return [{ from: spec.countyOf, counties: spec.counties }];
  return [];
}

// 一项切分在上级里占多少：九域志有乡数按乡数，否则按《宋史》县等
function partShare(part, grades) {
  const table = xiangOf(part.from);
  // 九域志没有此州乡数，或所切的县元丰时已省为镇（如赞皇熙宁五年并入高邑），退回按《宋史》县等切
  const complete = table && part.counties.every((c) => table[c] != null);
  if (complete) {
    const whole = Object.values(table).reduce((a, n) => a + n, 0);
    const got = part.counties.reduce((a, c) => a + table[c], 0);
    return { share: got / whole, how: '九域志乡数 ' + got + '/' + whole };
  }
  const entry = pickSongshi(songshiNameOf(part.from));
  if (!entry) throw new Error('《宋史》里没有 ' + part.from);
  const w = (c) => {
    const i = entry.countiesS.indexOf(c);
    const g = grades && grades[c] != null ? grades[c] : (i >= 0 ? entry.countyGrades[i] : null);
    if (g == null) throw new Error(part.from + ' 下找不到县 ' + c + '，须在 grades 里给出等第');
    return GRADE_HOUSEHOLDS[g];
  };
  const got = part.counties.reduce((a, c) => a + w(c), 0);
  const whole = entry.countiesS.reduce((a, c) => a + w(c), 0);
  return { share: got / whole, how: '县等折户 ' + got + '/' + whole };
}

// 某上级地块被切走的份额合计
function carvedShare(parentName) {
  let total = 0;
  Object.values(LEAF_SPECS).forEach((spec) => {
    partsOf(spec).forEach((part) => { if (part.from === parentName) total += partShare(part, spec.grades).share; });
  });
  return total;
}

// 地块的户数权重（崇宁口径）与依据
function householdWeight(leafName) {
  const spec = LEAF_SPECS[leafName] || {};
  const parts = partsOf(spec);
  if (parts.length) {
    let households = 0;
    const notes = parts.map((part) => {
      const census = censusOf(pickSongshi(songshiNameOf(part.from)));
      if (!census) throw new Error(part.from + ' 无户数，不能切分');
      const { share, how } = partShare(part, spec.grades);
      households += census.households * share;
      return census.basis + ' ' + census.households + ' 户中切出' + part.counties.join('、') + '（' + how + '）';
    });
    return { households, basis: notes.join('；') + (spec.note ? '。' + spec.note : '') };
  }
  if (spec.households) return { households: spec.households, basis: spec.basis };
  if (spec.yuanfeng) return { households: Math.round(spec.yuanfeng * YUANFENG_TO_CHONGNING), basis: spec.basis + '，× ' + YUANFENG_TO_CHONGNING + ' 折崇宁' };
  const entry = pickSongshi(songshiNameOf(leafName));
  let census = censusOf(entry);
  if (!census && entry) {
    const est = entry.countiesS.reduce((a, c, i) => a + GRADE_HOUSEHOLDS[entry.countyGrades[i] || ''], 0);
    census = { households: est, basis: '《宋史·地理志》' + entry.nameS + '无户数，按所领' + entry.countiesS.join('、') + '县等估' };
  }
  if (!census) throw new Error('地块 ' + leafName + ' 在《宋史》里找不到，须在 LEAF_SPECS 里写明');
  const carved = carvedShare(leafName);
  if (carved > 0) {
    return { households: census.households * (1 - carved), basis: census.basis + ' ' + census.households + ' 户，扣除另成地块的属县（' + (carved * 100).toFixed(1) + '%）' };
  }
  return { households: census.households, basis: census.basis + ' ' + census.households + ' 户' };
}

// 地块的商税权重（贯，铜钱口径）与依据
function shangshuiRows(name) {
  const names = SHANGSHUI_NAMES[name] || [name.replace(/州$/, ''), name];
  const rows = [];
  names.forEach((n) => SHANGSHUI.filter((r) => r.nameS === n).forEach((r) => { if (!rows.includes(r)) rows.push(r); }));
  return rows;
}

function commerceWeight(leafName, circuitName) {
  const rate = IRON_CASH_CIRCUITS.includes(circuitName) ? IRON_CASH_RATE : 1;
  const rateNote = rate < 1 ? '，四蜀铁钱折铜钱 × ' + IRON_CASH_RATE : '';
  const spec = LEAF_SPECS[leafName] || {};
  const parts = partsOf(spec);
  if (parts.length) {
    // 切出的地块：取上级的府界商税（开封取「开封」不取「东京」城内）按同一份额切
    let value = 0;
    const notes = parts.map((part) => {
      const rows = shangshuiRows(part.from).filter((r) => r.nameS !== '东京');
      const { share } = partShare(part, spec.grades);
      if (!rows.length) { value += SHANGSHUI_FLOOR * share; return part.from + '商税表未列，按最低一档切'; }
      value += rows.reduce((a, r) => a + r.quota, 0) * share;
      return part.from + '「' + rows[0].bracket + '」切出 ' + (share * 100).toFixed(1) + '%';
    });
    return { value: value * rate, basis: '《通考》' + notes.join('；') + rateNote };
  }
  const rows = shangshuiRows(leafName);
  if (!rows.length) return { value: SHANGSHUI_FLOOR * rate, basis: '《通考》商税表未列，按最低一档（五千贯以下）计' + rateNote };
  let total = rows.reduce((a, r) => a + r.quota, 0);
  let note = rows.map((r) => r.nameS + '「' + r.bracket + '」').join('、');
  const carved = carvedShare(leafName);
  if (carved > 0) {
    const cityPart = rows.filter((r) => r.nameS === '东京').reduce((a, r) => a + r.quota, 0);
    total = cityPart + (total - cityPart) * (1 - carved);
    note += '，扣除另成地块的属县';
  }
  return { value: total * rate, basis: '《通考》' + note + rateNote };
}

// ---------------------------------------------------------------------------
// 田亩与两税：元丰《中书备对》只有路一级数（sources/wenxian-tongkao-4-yuanfeng.json）。
// 先算每个元丰路「每崇宁户田亩」「每崇宁户两税」，再乘各块的崇宁户权重，落到块上。
// ---------------------------------------------------------------------------
const YUANFENG = require(path.join(SRC, 'wenxian-tongkao-4-yuanfeng.json'));

// 《宋史》路 → 元丰路（江南、荆湖两路按东西、南北子路分）
function yuanfengCircuitOfEntry(entry) {
  const top = entry.circuitS;
  const sub = entry.subCircuitS;
  const direct = {
    京畿路: '開封府界', 京东路: '京東路', 京西路: '京西路', 河北路: '河北路', 河东路: '河東路', 陕西路: '陜府西路',
    两浙路: '兩浙路', 淮南路: '淮南路', 福建路: '福建路', 成都府路: '成都路', 潼川府路: '梓州路', 利州路: '利州路',
    夔州路: '夔州路', 广南东路: '廣南東路', 广南西路: '廣南西路'
  };
  if (direct[top]) return direct[top];
  const bySub = { 江南东路: '江南東路', 江南西路: '江南西路', 荆湖南路: '荊湖南路', 荆湖北路: '荊湖北路' };
  if (bySub[sub]) return bySub[sub];
  return null;
}

// 地图上的路 → 元丰路：志中找不到条目的估数地块用
const MAP_CIRCUIT_TO_YUANFENG = {
  京畿路: '開封府界', 京东东路: '京東路', 京东西路: '京東路', 京西南路: '京西路', 京西北路: '京西路',
  永兴军路: '陜府西路', 秦凤路: '陜府西路', 泾原路: '陜府西路', 环庆路: '陜府西路', 鄜延路: '陜府西路', 熙河兰湟路: '陜府西路',
  三泉直隶: '利州路', 淮南东路: '淮南路', 淮南西路: '淮南路', 江南东路: '江南東路', 江南西路: '江南西路', 两浙路: '兩浙路',
  荆湖北路: '荊湖北路', 荆湖南路: '荊湖南路', 福建路: '福建路', 广南东路: '廣南東路', 广南西路: '廣南西路',
  成都府路: '成都路', 潼川府路: '梓州路', 夔州路: '夔州路', 利州路: '利州路', 河东路: '河東路', 河北西路: '河北路'
};

// 登记数失真的路：梓州路「田为山崖，难计顷亩」，利州、夔州、广南西路登记田亩每户不足五亩。
// 按南方八路（两浙、江东、江西、湖南、湖北、福建、成都、广东）每户登记田亩的中位数，乘山地折算 0.6 估
const LAND_REGISTER_UNRELIABLE = ['梓州路', '利州路', '夔州路', '廣南西路'];
const SOUTHERN_REFERENCE = ['兩浙路', '江南東路', '江南西路', '荊湖南路', '荊湖北路', '福建路', '成都路', '廣南東路'];
const MOUNTAIN_LAND_FACTOR = 0.6;
const TAX_CAP_FACTOR = 2;

function entryHouseholds(entry) {
  const census = censusOf(entry);
  if (census) return census.households;
  return entry.countiesS.reduce((a, c, i) => a + GRADE_HOUSEHOLDS[entry.countyGrades[i] || ''], 0);
}

let rateCache = null;
function yuanfengRates() {
  if (rateCache) return rateCache;
  const households = {};
  SONGSHI.forEach((entry) => {
    const yf = yuanfengCircuitOfEntry(entry);
    if (yf) households[yf] = (households[yf] || 0) + entryHouseholds(entry);
  });
  const rates = {};
  YUANFENG.forEach((r) => {
    const h = households[r.name];
    rates[r.name] = { households: h, landPerHousehold: r.landMu != null ? r.landMu / h : null, taxPerHousehold: r.twoTaxQuota / h, landMu: r.landMu, twoTax: r.twoTaxQuota };
  });
  // 两税见催额是钱、粮、帛、草等混计（原书「贯、石、匹、束、量……」），开封府界、河北草束尤多，
  // 每户两税远高于他路；封顶在十九路每户两税中位数的两倍
  const taxRates = Object.values(rates).map((r) => r.taxPerHousehold).sort((a, b) => a - b);
  const taxMedian = taxRates[(taxRates.length - 1) / 2];
  Object.values(rates).forEach((r) => {
    if (r.taxPerHousehold > TAX_CAP_FACTOR * taxMedian) {
      r.registerTaxPerHousehold = r.taxPerHousehold;
      r.taxPerHousehold = TAX_CAP_FACTOR * taxMedian;
      r.taxCapped = true;
    }
  });
  const ref = SOUTHERN_REFERENCE.map((k) => rates[k].landPerHousehold).sort((a, b) => a - b);
  const median = (ref[ref.length / 2 - 1] + ref[ref.length / 2]) / 2;
  LAND_REGISTER_UNRELIABLE.forEach((k) => {
    rates[k].registerLandPerHousehold = rates[k].landPerHousehold;
    rates[k].landPerHousehold = median * MOUNTAIN_LAND_FACTOR;
    rates[k].landEstimated = true;
  });
  rateCache = { rates, southernMedian: median, taxMedian };
  return rateCache;
}

// 地块所属元丰路：有志中条目的按条目，切出的地块按上级，估数地块按地图上的路
function yuanfengCircuitOf(leafName, mapCircuit) {
  const spec = LEAF_SPECS[leafName] || {};
  const parts = partsOf(spec);
  const entry = parts.length ? pickSongshi(songshiNameOf(parts[0].from)) : (spec.households || spec.yuanfeng ? null : pickSongshi(songshiNameOf(leafName)));
  const yf = entry ? yuanfengCircuitOfEntry(entry) : MAP_CIRCUIT_TO_YUANFENG[mapCircuit];
  if (!yf) throw new Error(leafName + ' 找不到所属元丰路');
  return yf;
}

// 地块的田亩（亩）与两税（贯石匹混计）权重
function landAndTaxWeight(leafName, mapCircuit) {
  const { households } = householdWeight(leafName);
  const yf = yuanfengCircuitOf(leafName, mapCircuit);
  const r = yuanfengRates().rates[yf];
  return {
    yuanfeng: yf,
    land: households * r.landPerHousehold,
    twoTax: households * r.taxPerHousehold,
    basis: '元丰' + yf + (r.landEstimated ? '登记田亩失真，每户按 ' + r.landPerHousehold.toFixed(1) + ' 亩估' : '每户田亩 ' + r.landPerHousehold.toFixed(1)) +
      '、每户两税 ' + r.taxPerHousehold.toFixed(2) + (r.taxCapped ? '（原 ' + r.registerTaxPerHousehold.toFixed(2) + '，草束混计，封顶）' : '')
  };
}

// 地块领县数（驿站按它分）：切出的地块按切出的县数，估数地块计一县，其余按志中属县数减去被切走的县
function countyCountOf(leafName) {
  const spec = LEAF_SPECS[leafName] || {};
  const parts = partsOf(spec);
  if (parts.length) return parts.reduce((a, p) => a + p.counties.length, 0);
  if (spec.households || spec.yuanfeng) return 1;
  const entry = pickSongshi(songshiNameOf(leafName));
  let carved = 0;
  Object.values(LEAF_SPECS).forEach((s) => partsOf(s).forEach((p) => { if (p.from === leafName) carved += p.counties.length; }));
  return Math.max(1, (entry.countyCount || entry.countiesS.length || 1) - carved);
}

module.exports = {
  YUANFENG_TO_CHONGNING, GRADE_HOUSEHOLDS, IRON_CASH_CIRCUITS, IRON_CASH_RATE, LEAF_SPECS, SHANGSHUI_NAMES,
  MAP_CIRCUIT_TO_YUANFENG, pickSongshi, householdWeight, commerceWeight, landAndTaxWeight, yuanfengRates, countyCountOf
};
