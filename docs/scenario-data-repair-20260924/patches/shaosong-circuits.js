// 绍宋剧本·宋廷补路一级（阶段二第一步）
//
// （官营织造、矿场、御窑原账乱挂，亦作废，由各路细分时逐块按史料重写。）
// 1. 大宋行政树去掉「大宋」国号节点，按地图 circuitRegistry 把各块分到路下，路为树的一级节点；树上补 factionId、factionName。
// 2. 各路总数：宋廷全国合计不动（口、户、丁、逃户、隐户、应征、实征、起运、留用、库钱粮帛、商贸、海贸、驿站、解额），
//    按 data/shaosong-sources.js 的逐块史料权重汇到路：户口按崇宁户，应征按两税、商税、盐茶酒课三项的全国构成加权，
//    商贸按熙宁十年以前商税岁额，海贸按市舶所在。田亩按元丰登记数逐块汇总（原值量纲错，不守恒）。
//    盐、矿、马、渔与皇庄田由各路细分时按引擎首回合算法落块；兼并、垦荒、清丈原值为小数碎屑，归零。
// 3. 路的比例与读数（征到比例、截留率、自治度、民心、吏治、繁荣、人口结构、承载负荷）取改前各块按人口加权的均值。
// 叶子在这一步不动，由各路数据模块逐路重写（patches/tianqi-prefectures.js --scenario 绍宋）。
//
// 用法（在仓库根目录）：node docs/scenario-data-repair-20260924/patches/shaosong-circuits.js [框架数据] [--write] [--report <文件>]
//   框架数据默认 data/shaosong-frame.js（宋廷）；外藩写 treeKey（势力 id）、idPrefix、CIRCUITS 与逐块权重函数 weights。
'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '../../..');
const SCENARIO_FILE = path.join(REPO, 'scenarios', '绍宋·建炎元年八月（官方）.json');
const DATA = path.join(__dirname, '..', 'data');
const lib = require(path.join(DATA, 'shaosong-sources.js'));
const { TAX_SCHEDULE, flatLeaves } = require(path.join(DATA, 'shaosong-common.js'));

function sum(values) { return values.reduce((a, b) => a + b, 0); }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function splitInteger(total, weights) {
  const s = sum(weights);
  if (s <= 0) throw new Error('权重全为零');
  const raw = weights.map((w) => (total * w) / s);
  const out = raw.map(Math.floor);
  let rest = total - sum(out);
  raw.map((r, i) => [r - Math.floor(r), i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]).forEach(([, i]) => {
    if (rest > 0) { out[i] += 1; rest -= 1; }
  });
  return out;
}

// "34%" → 0.34；已是数字的原样
function pct(v) {
  if (typeof v === 'number') return v;
  const m = String(v).match(/^\s*(-?\d+(?:\.\d+)?)\s*%\s*$/);
  if (!m) throw new Error('认不出的百分比：' + v);
  return Number(m[1]) / 100;
}

// 聚落比例表按对照并键（值仍是原账的百分比串或小数）；没给对照原样返回
function foldSettlement(table, keys) {
  if (!keys || !table) return table;
  const out = {};
  Object.entries(table).forEach(([k, v]) => {
    const to = keys[k] || k;
    out[to] = (out[to] || 0) + pct(v);
  });
  return out;
}

// 按人口加权的均值
function weightedMean(rows, get) {
  const w = sum(rows.map((r) => r.population));
  return sum(rows.map((r) => get(r) * r.population)) / w;
}

// 各块的比例表（键 → 占比）按人口加权合成，归一到 1
function mixRatios(rows, get) {
  const acc = {};
  rows.forEach((r) => {
    Object.entries(get(r) || {}).forEach(([k, v]) => { acc[k] = (acc[k] || 0) + pct(v) * r.population; });
  });
  const total = sum(Object.values(acc));
  const out = {};
  Object.entries(acc).forEach(([k, v]) => { out[k] = Math.round((v / total) * 1000) / 1000; });
  return out;
}

// 宋廷各块的默认权重（data/shaosong-sources.js）
function songWeights(name, circuit) {
  const hh = lib.householdWeight(name);
  const comm = lib.commerceWeight(name, circuit);
  const lt = lib.landAndTaxWeight(name, circuit);
  return {
    households: hh.households, commerce: comm.value, land: lt.land, twoTax: lt.twoTax, counties: lib.countyCountOf(name),
    householdBasis: hh.basis, commerceBasis: comm.basis
  };
}

function main() {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const reportIndex = args.indexOf('--report');
  const reportFile = reportIndex >= 0 ? args[reportIndex + 1] : null;
  const framePath = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--report');
  const frame = require(framePath ? path.resolve(framePath) : path.join(DATA, 'shaosong-frame.js'));
  const { CIRCUITS } = frame;
  const PORTS = frame.PORTS || {};
  const treeKey = frame.treeKey || 'player';
  const idPrefix = frame.idPrefix || 'div_ss_';

  const raw = fs.readFileSync(SCENARIO_FILE, 'utf8');
  const scenario = JSON.parse(raw);
  if (JSON.stringify(scenario) + '\n' !== raw) throw new Error('剧本不是标准 JSON.stringify 输出，拒绝改写');
  if (JSON.stringify(scenario.map) !== JSON.stringify(scenario.mapData)) throw new Error('map 与 mapData 已不一致，先查清再改');

  const tree = scenario.adminHierarchy[treeKey];
  if (!tree || tree.divisions.length !== 1 || tree.divisions[0].type !== 'kingdom') {
    throw new Error(treeKey + ' 树已不是「国号节点 + 叶子」的原样，这个补丁只能在原版上跑（用 rebuild-shaosong.js 从原版重建）');
  }
  const kingdom = tree.divisions[0];
  // 原账的地域核算组（同一地块拆成几笔）先并成一块，见 shaosong-common.js 的 mergeAccountingGroup
  kingdom.children = flatLeaves(kingdom);
  const leaves = kingdom.children;
  // 玩家树按国号找势力；外藩树的键就是势力 id（国号节点名可能与势力名不同，如河北义军树顶叫「两河忠义寨」）
  const faction = treeKey === 'player'
    ? scenario.factions.find((f) => f.name === kingdom.name)
    : scenario.factions.find((f) => f.id === treeKey);
  if (!faction) throw new Error('势力表里没有 ' + (treeKey === 'player' ? kingdom.name : treeKey));
  if (leaves.some((l) => (l.children || []).length)) throw new Error(treeKey + ' 树有三级，须先在框架数据里写明拆法');

  const regionById = new Map(scenario.map.regions.map((r) => [r.id, r]));
  const registryByName = new Map(scenario.map.circuitRegistry.map((c) => [c.name, c]));

  // ---- 各块归路、取权重 ----
  const rows = leaves.map((leaf) => {
    const region = regionById.get(leaf.mapRegionId);
    if (!region) throw new Error(leaf.name + ' 绑定的地块 ' + leaf.mapRegionId + ' 不在地图上');
    const circuit = region.circuitName;
    const w = frame.weights ? frame.weights(leaf.name, circuit) : songWeights(leaf.name, circuit);
    return {
      leaf, region, circuit,
      households: w.households, commerce: w.commerce, land: w.land, twoTax: w.twoTax,
      counties: w.counties, port: PORTS[leaf.name] || 0,
      householdBasis: w.householdBasis, commerceBasis: w.commerceBasis,
      population: leaf.population
    };
  });
  const unknown = [...new Set(rows.map((r) => r.circuit))].filter((c) => !CIRCUITS.some((d) => d.name === c));
  if (unknown.length) throw new Error('地图上的路没有框架数据：' + unknown.join('、'));

  // ---- 全国合计（改前各块之和） ----
  const T = (get) => sum(leaves.map(get));
  const N = {
    mouths: T((l) => l.populationDetail.mouths), households: T((l) => l.populationDetail.households),
    ding: T((l) => l.populationDetail.ding), fugitives: T((l) => l.populationDetail.fugitives),
    hiddenCount: T((l) => l.populationDetail.hiddenCount),
    claimed: T((l) => l.fiscalDetail.claimedRevenue), actual: T((l) => l.fiscalDetail.actualRevenue),
    remitted: T((l) => l.fiscalDetail.remittedToCenter), retained: T((l) => l.fiscalDetail.retainedBudget),
    money: T((l) => l.publicTreasuryInit.money), grain: T((l) => l.publicTreasuryInit.grain), cloth: T((l) => l.publicTreasuryInit.cloth),
    commerce: T((l) => l.economyBase.commerceVolume),
    postRelays: T((l) => l.economyBase.postRelays), kejuQuota: T((l) => l.economyBase.kejuQuota)
  };
  // 原账商贸、海贸等带小数（如 584853.626979），全国合计取整后守恒
  const roundedFrom = {};
  Object.keys(N).forEach((k) => {
    if (!Number.isInteger(N[k])) { roundedFrom[k] = N[k]; N[k] = Math.round(N[k]); }
  });
  if (N.mouths !== T((l) => l.population)) throw new Error('改前 population 与 populationDetail.mouths 合计不符');
  // 外藩多无户口可考，框架数据的户数是相对权重（relativeHouseholds）：田亩、两税按「每户 × 率」算，
  // 先把户数权重折成绝对户数（合计 = 改前全国户数）再乘
  if (frame.relativeHouseholds) {
    const k = N.households / sum(rows.map((r) => r.households));
    rows.forEach((r) => { r.land *= k; r.twoTax *= k; });
  }
  if (N.remitted + N.retained !== N.actual) throw new Error('改前起运加留用不等于实征');

  // ---- 分路 ----
  const defs = CIRCUITS.filter((d) => rows.some((r) => r.circuit === d.name));
  const groups = defs.map((d) => rows.filter((r) => r.circuit === d.name));
  const G = (get) => groups.map((g) => sum(g.map(get)));
  const W = { households: G((r) => r.households), commerce: G((r) => r.commerce), land: G((r) => r.land), twoTax: G((r) => r.twoTax), counties: G((r) => r.counties), port: G((r) => r.port) };
  // 框架数据写 keepOriginalTotals 的路：史料不能反映开局年代（如《金史》泰和户在猛安谋克南迁之后），
  // 这些路保留原账人口合计占比，路内各块权重整体缩放，其余路按史料权重分剩下的份额
  const keep = frame.keepOriginalTotals || [];
  if (keep.length) {
    const oldPop = groups.map((g) => sum(g.map((r) => r.population)));
    const target = defs.map((d, i) => (keep.includes(d.name) ? oldPop[i] / N.mouths : null));
    const keptShare = sum(target.filter((t) => t != null));
    const freeWeight = sum(W.households.filter((w, i) => target[i] == null));
    defs.forEach((d, i) => {
      if (target[i] == null) return;
      const factor = (target[i] * freeWeight) / ((1 - keptShare) * W.households[i]);
      groups[i].forEach((r) => { r.households *= factor; r.land *= factor; r.twoTax *= factor; r.commerce *= factor; });
      ['households', 'commerce', 'land', 'twoTax'].forEach((k) => { W[k][i] *= factor; });
    });
  }
  // 战区商贸折减（shaosong-frame.js 的 trade）
  W.commerceRaw = W.commerce.slice();
  W.commerce = W.commerce.map((c, i) => c * (defs[i].trade || 1));
  const share = (arr) => arr.map((x) => x / sum(arr));

  const households = splitInteger(N.households, W.households);
  const mouths = splitInteger(N.mouths, W.households);
  const ding = splitInteger(N.ding, mouths);
  const fugitives = splitInteger(N.fugitives, mouths.map((m, i) => m * defs[i].flee));
  const hidden = splitInteger(N.hiddenCount, mouths.map((m, i) => m * defs[i].hide));

  // 应征按剧本税目表：各路每年应纳的钱 = 耕地×率 + 口数×率 + 商贸额×率（见 shaosong-common.js 的 TAX_SCHEDULE）
  const farmland = W.land.map(Math.round);
  const commerceVolume = splitInteger(N.commerce, W.commerce);
  const claimed = splitInteger(N.claimed, defs.map((d, i) => TAX_SCHEDULE.land * farmland[i] + TAX_SCHEDULE.mouths * mouths[i] + TAX_SCHEDULE.commerce * commerceVolume[i]));
  // 原账口径：实征 = 应征 × 征到比例（截留率另记）。两个率都是运行时每回合真读的（tm-fiscal-engine：
  // 实收 = 应纳 × 征到比例，再扣截留），各路取改前各块的人口加权均值，不从实征反推
  const compliance = groups.map((g) => Math.round(weightedMean(g, (r) => r.leaf.fiscalDetail.compliance) * 100) / 100);
  const skimRate = groups.map((g) => Math.round(weightedMean(g, (r) => r.leaf.fiscalDetail.skimmingRate) * 1000) / 1000);
  const actual = splitInteger(N.actual, claimed.map((c, i) => c * compliance[i]));
  const remitted = splitInteger(N.remitted, actual);
  const retained = actual.map((a, i) => a - remitted[i]);
  // 财政自主：引擎计税乘 (1 − autonomyLevel × 0.8)。原账只写了运行时不读的 autonomy（0.55），autonomyLevel 缺省时
  // 引擎取 0.3（tm-fiscal-engine _ensureRegionFiscal），原版实际按 0.3 运行、税目表也按此调定；显式写 0.3，运行时与原版一致
  const autonomy = groups.map(() => 0.3);

  const money = splitInteger(N.money, retained);
  const grain = splitInteger(N.grain, W.twoTax);
  const cloth = splitInteger(N.cloth, mouths.map((m, i) => m * defs[i].textile));
  // 海贸原值不入任何税目（绍宋市舶按商贸额征），开局即被引擎按港口口数 × 0.02 覆盖；路里先记 0，由各路细分时按引擎算法落块
  const postRelays = splitInteger(N.postRelays, W.counties);
  const kejuQuota = splitInteger(N.kejuQuota, W.households);

  // ---- 写路节点 ----
  const provinces = defs.map((d, i) => {
    const g = groups[i];
    const registry = registryByName.get(d.name);
    if (!registry) throw new Error('地图 circuitRegistry 里没有 ' + d.name);
    const capital = g.find((r) => r.leaf.name === d.capital);
    if (!capital) throw new Error(d.name + ' 的治所 ' + d.capital + ' 不在本路地块里');
    const m = mouths[i];

    const age = mixRatios(g, (r) => r.leaf.byAge);
    const ageRatios = { young: age['幼'], ding: age['青壮'], old: age['老'] };
    const ageCounts = splitInteger(m, [ageRatios.young, ageRatios.ding, ageRatios.old]);
    const maleRatio = mixRatios(g, (r) => r.leaf.byGender)['男'];
    const male = Math.round(m * maleRatio);
    // 外藩原账的聚落名目各异（村寨、牧落、猛安谋克屯寨……），框架数据的 settlementKeys 把它们并入城、镇、乡
    const settle = mixRatios(g, (r) => foldSettlement(r.leaf.bySettlement, frame.settlementKeys));
    // 城内再分坊（居住坊郭）与市（市肆行铺）：原账只分城、镇、乡，城内按六四分
    const settleCounts = splitInteger(m, [(settle['城'] || 0) * 0.6, (settle['城'] || 0) * 0.4, settle['镇'] || 0, settle['乡'] || 0]);
    const oldPop = sum(g.map((r) => r.population));
    const oldCap = sum(g.map((r) => Number(r.leaf.carryingCapacity) || 0));
    const load = Math.round(clamp(oldPop / oldCap, 0.4, 1.3) * 100) / 100;
    const cap = Math.round(m / load);

    const text = d.specialResources;
    const tags = {
      hasPort: W.port[i] > 0,
      saltRegion: /盐/.test(text),
      mineralRegion: /银|铜|铁|煤|丹砂/.test(text),
      horseRegion: /马/.test(text),
      fishingRegion: /渔|鱼/.test(text) || d.terrain === '水乡',
      imperialDomain: d.name === '京畿路'
    };
    const node = {
      id: idPrefix + registry.id.replace(/^ss-circuit-/, ''),
      name: d.name,
      level: 'province',
      officialPosition: d.officialPosition
    };
    if (d.governor) node.governor = d.governor;
    Object.assign(node, {
      description: d.description,
      regionType: 'normal',
      dejureOwner: faction.name,
      terrain: d.terrain,
      specialResources: d.specialResources,
      taxLevel: d.taxLevel,
      tags,
      capitalChildId: capital.leaf.id,
      mapRegionId: registry.id,
      regionId: registry.id,
      mappedRegions: g.map((r) => r.leaf.mapRegionId),
      population: m,
      populationDetail: { mouths: m, fugitives: fugitives[i], hiddenCount: hidden[i], households: households[i], ding: ding[i] },
      byGender: { male, female: m - male, sexRatio: Math.round((male / (m - male)) * 100) / 100 },
      byAge: {
        young: { count: ageCounts[0], ratio: ageRatios.young },
        ding: { count: ageCounts[1], ratio: ageRatios.ding },
        old: { count: ageCounts[2], ratio: ageRatios.old }
      },
      byEthnicity: mixRatios(g, (r) => r.leaf.byEthnicity),
      byFaith: mixRatios(g, (r) => r.leaf.byFaith),
      bySettlement: { fang: { mouths: settleCounts[0] }, shi: { mouths: settleCounts[1] }, zhen: { mouths: settleCounts[2] }, cun: { mouths: settleCounts[3] } },
      // 原账承载只记一个数（可养人口）；可耕、水源两项无从区分，与之同值
      carryingCapacity: { arable: cap, water: cap, climate: 1, historicalCap: cap, currentLoad: load, carryingRegime: load < 0.55 ? 'abundant' : load < 0.75 ? 'sustainable' : load < 0.97 ? 'strained' : 'overload' },
      minxinLocal: Math.round(weightedMean(g, (r) => r.leaf.minxinLocal)),
      corruptionLocal: Math.round(weightedMean(g, (r) => r.leaf.corruptionLocal)),
      prosperity: Math.round(weightedMean(g, (r) => r.leaf.prosperity)),
      fiscalDetail: {
        claimedRevenue: claimed[i], actualRevenue: actual[i], remittedToCenter: remitted[i], retainedBudget: retained[i],
        compliance: compliance[i], skimmingRate: skimRate[i], autonomyLevel: autonomy[i]
      },
      publicTreasuryInit: { money: money[i], grain: grain[i], cloth: cloth[i] },
      economyBase: {
        farmland: farmland[i],
        commerceCoefficient: Math.round(weightedMean(g, (r) => r.leaf.economyBase.commerceCoefficient) * 100) / 100,
        commerceVolume: commerceVolume[i], maritimeTradeVolume: 0,
        saltProduction: 0, mineralProduction: 0, horseProduction: 0, fishingProduction: 0, imperialFarmland: 0,
        // 官营织造、矿场、御窑原账乱挂（威州有织造、东京无绫锦院），作废；各路细分时逐块按史料重写
        imperialAssets: { zhizao: 0, kuangchang: 0, yuyao: 0 },
        postRelays: postRelays[i], kejuQuota: kejuQuota[i],
        roadQuality: Math.round(weightedMean(g, (r) => r.leaf.economyBase.roadQuality)),
        landsAnnexed: 0, landsReclaimed: 0, landsSurveyed: 0, disasterRecord: []
      },
      strategicValue: d.strategicValue,
      threats: d.threats.slice(),
      children: g.map((r) => r.leaf)
    });
    return node;
  });

  // ---- 自检：全国合计守恒 ----
  const P = (get) => sum(provinces.map(get));
  const checks = [
    ['口', N.mouths, P((p) => p.populationDetail.mouths)], ['户', N.households, P((p) => p.populationDetail.households)],
    ['丁', N.ding, P((p) => p.populationDetail.ding)], ['逃户', N.fugitives, P((p) => p.populationDetail.fugitives)],
    ['隐户', N.hiddenCount, P((p) => p.populationDetail.hiddenCount)], ['应征', N.claimed, P((p) => p.fiscalDetail.claimedRevenue)],
    ['实征', N.actual, P((p) => p.fiscalDetail.actualRevenue)], ['起运', N.remitted, P((p) => p.fiscalDetail.remittedToCenter)],
    ['留用', N.retained, P((p) => p.fiscalDetail.retainedBudget)], ['库钱', N.money, P((p) => p.publicTreasuryInit.money)],
    ['库粮', N.grain, P((p) => p.publicTreasuryInit.grain)], ['库帛', N.cloth, P((p) => p.publicTreasuryInit.cloth)],
    ['商贸', N.commerce, P((p) => p.economyBase.commerceVolume)],
    ['驿站', N.postRelays, P((p) => p.economyBase.postRelays)], ['解额', N.kejuQuota, P((p) => p.economyBase.kejuQuota)],
    ['地块数', leaves.length, P((p) => p.children.length)]
  ];
  const broken = checks.filter(([, want, got]) => want !== got);
  if (broken.length) throw new Error('全国合计不守恒：' + broken.map((c) => c.join(' ')).join('；'));

  tree.factionId = faction.id;
  tree.factionName = faction.name;
  tree.divisions = provinces;
  // 键序与天启一致：factionId、factionName、divisions
  scenario.adminHierarchy[treeKey] = { factionId: tree.factionId, factionName: tree.factionName, divisions: tree.divisions };

  // ---- 报告 ----
  const lines = [];
  lines.push('# ' + (frame.reportTitle || '绍宋·宋廷补路一级报告'), '');
  lines.push((frame.treeLabel || '大宋行政树去掉「大宋」国号节点，')  + leaves.length + ' 块分到 ' + provinces.length + ' 路下。全国合计守恒自检：' + checks.map(([k]) => k).join('、') + ' 全部与改前相等。', '');
  if (Object.keys(roundedFrom).length) {
    lines.push('原账带小数、全国合计取整后守恒的项：' + Object.entries(roundedFrom).map(([k, v]) => k + ' ' + v + ' → ' + N[k]).join('；') + '。', '');
  }
  if (treeKey === 'player') {
    lines.push('应征按剧本税目表分：各路每年应纳的钱 = 耕地 × ' + TAX_SCHEDULE.land + ' + 口数 × ' + TAX_SCHEDULE.mouths + ' + 商贸额 × ' + TAX_SCHEDULE.commerce + '，开局所见与第一回合引擎实征成比例。海贸原值 ' + Math.round(T((l) => l.economyBase.maritimeTradeVolume)) + ' 不入任何税目、开局即被引擎覆盖，不守恒，由各路按港口口数 × 0.02 写。', '');
    const { rates, southernMedian } = lib.yuanfengRates();
    lines.push('田亩：宋廷各块按元丰各路每户登记田亩汇总，合计 ' + Math.round(sum(farmland) / 1e4) + ' 万亩（改前合计 ' + T((l) => l.economyBase.farmland).toFixed(2) + '，量纲错）。梓州、利州、夔州、广南西路登记失真，每户按南方八路中位数 ' + southernMedian.toFixed(1) + ' 亩 × 0.6 估。', '');
    const disrupted = defs.map((d, i) => [d, i]).filter(([d]) => d.trade && d.trade !== 1);
    if (disrupted.length) {
      lines.push('战区商贸折减（熙宁商税额不反映靖康兵祸；京畿依建炎元年「販貨上京者與免稅」诏，其余依「殘破州縣」诏按兵祸轻重估）：' + disrupted.map(([d]) => d.name + ' × ' + d.trade).join('、') + '。', '');
    }
    lines.push('两税：元丰见催额钱粮帛草混计，每户两税封顶在十九路中位数 ' + lib.yuanfengRates().taxMedian.toFixed(2) + ' 的两倍；' +
      Object.entries(lib.yuanfengRates().rates).filter(([, r]) => r.taxCapped).map(([k, r]) => k + ' ' + r.registerTaxPerHousehold.toFixed(2) + ' → ' + r.taxPerHousehold.toFixed(2)).join('、') + '。', '');
  } else {
    (frame.reportNotes || []).forEach((line) => lines.push(line, ''));
  }
  lines.push('## 各路（改前为原各块按新路归组之和）', '');
  lines.push('| 路 | 块 | 口 | 户 | 应征 | 实征 | 商贸 | 田亩（亩） | 民心 | 吏治 | 繁荣 | 长官 |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  provinces.forEach((p, i) => {
    const g = groups[i];
    const f = (a, b) => (a === b ? String(b) : a + ' → ' + b);
    lines.push('| ' + [
      p.name, g.length,
      f(sum(g.map((r) => r.leaf.population)), p.population),
      f(sum(g.map((r) => r.leaf.populationDetail.households)), p.populationDetail.households),
      f(sum(g.map((r) => r.leaf.fiscalDetail.claimedRevenue)), p.fiscalDetail.claimedRevenue),
      f(sum(g.map((r) => r.leaf.fiscalDetail.actualRevenue)), p.fiscalDetail.actualRevenue),
      f(sum(g.map((r) => r.leaf.economyBase.commerceVolume)), p.economyBase.commerceVolume),
      p.economyBase.farmland,
      p.minxinLocal, p.corruptionLocal, p.prosperity,
      p.officialPosition + (p.governor ? '（' + p.governor + '）' : '')
    ].join(' | ') + ' |');
  });
  if (treeKey === 'player') {
    lines.push('', '## 元丰各路每户田亩与两税', '');
    lines.push('| 元丰路 | 崇宁户（志中合计） | 登记田亩（亩） | 每户田亩 | 每户两税 |');
    lines.push('| --- | --- | --- | --- | --- |');
    Object.entries(lib.yuanfengRates().rates).forEach(([k, r]) => {
      lines.push('| ' + [k, Math.round(r.households), r.landMu == null ? '（原书：田为山崖，难计顷亩）' : r.landMu, r.landPerHousehold.toFixed(1) + (r.landEstimated ? '（估）' : ''), r.taxPerHousehold.toFixed(2)].join(' | ') + ' |');
    });
  }
  lines.push('', '## 各块权重', '');
  lines.push('| 路 | 地块 | 崇宁户权重 | 商税权重（贯） | 田亩权重（亩） | 户数依据 | 商税依据 |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- |');
  rows.forEach((r) => {
    lines.push('| ' + [r.circuit, r.leaf.name, Math.round(r.households), Math.round(r.commerce), Math.round(r.land),
      r.householdBasis, r.commerceBasis].join(' | ') + ' |');
  });
  const report = lines.join('\n') + '\n';
  if (reportFile) {
    fs.mkdirSync(path.dirname(path.resolve(reportFile)), { recursive: true });
    fs.writeFileSync(reportFile, report);
  }
  console.log(lines.slice(0, 40).join('\n'));

  if (write) {
    scenario.mapData = JSON.parse(JSON.stringify(scenario.map));
    fs.writeFileSync(SCENARIO_FILE, JSON.stringify(scenario) + '\n');
    console.log('\n已写入 ' + path.relative(REPO, SCENARIO_FILE));
  } else {
    console.log('\n（试算，未写入；加 --write 写入）');
  }
}

main();
