// 绍宋各路数据模块共用的设置：剧本、要删的旧字段、地块读数层、应征构成，以及按史料权重生成 UNITS。
'use strict';

const { block } = require('./lib-blocks');
const sources = require('./shaosong-sources');

const SCENARIO = '绍宋·建炎元年八月（官方）.json';

// 叶子与地块 data 上的旧字段：
//   type、desc：由 divisionType、description 取代
//   controlLevel 等归属字段：归属以地图地块为准（天启叶子也不写）
//   troops、armyDetail、军压、月军费、净留用：拆账拆出来的派生数；征兵数引擎按丁数自算，军压等每回合由 tm-border-risk 按驻军重算
//   taxBurden、unrest：地块读数层另有，叶子上不重复
//   aliases（全空）、accountingNote、accountingLeafIds、accountingLeafNames：源账拆分的旁注
const DROP_KEYS = [
  'type', 'desc', 'controlLevel', 'controller', 'currentOwner', 'owner', 'controllerFactionId', 'ownerFactionId', 'factionId',
  'troops', 'armyDetail', 'militaryRecruits', 'recruits', 'levyPool', 'militaryDetail', 'armyPressure', 'localMilitaryCost', 'retainedNet',
  'taxBurden', 'unrest', 'aliases', 'accountingNote', 'accountingLeafIds', 'accountingLeafNames'
];

// 绍宋地块的读数层：税压叫 taxBurden（数据块统一写 taxPressure），没有官风险
const REGION_KEYS = ['development', 'unrest', 'taxBurden', 'armyPressure'];
const REGION_KEY_FROM = { taxBurden: 'taxPressure' };

// 应征按剧本自己的税目表（fiscalConfig.taxList）分：各块应征 ∝ 该块每年应纳的钱，
// 开局所见与第一回合引擎实征成比例。钱类税目按税基合并（税率 × 税基系数）：
//   耕地（亩）：田赋·折钱 0.012
//   口数：身丁钱 0.008 + 盐课 0.06 + 茶课 0.025 + 酒课 0.04 = 0.133
//   商贸额：商税 0.03 + 市舶 0.05×0.3 + 坑冶 0.04×0.15 + 经总制钱 0.04 + 月桩钱 0.025×0.6 + 免役钱 0.02×0.5 + 和买 0.015×0.4 = 0.122
// 田赋·两税粮（耕地 × 0.13 × 0.3）入粮，不计入钱。两个田赋税率正与元丰两税相符：
//   两税钱 558 万贯 ÷ 民田 4.6 亿亩 ≈ 0.012，两税斛斗 1788 万石 ÷ 4.6 亿亩 ≈ 0.039。
const TAX_SCHEDULE = { land: 0.012, mouths: 0.133, commerce: 0.122 };

// 一个路的 UNITS：每块一个单位，权重全部取自 shaosong-sources.js
function unitsFor(circuit, leafNames) {
  return leafNames.map((name) => {
    const hh = sources.householdWeight(name);
    const comm = sources.commerceWeight(name, circuit);
    const lt = sources.landAndTaxWeight(name, circuit);
    return {
      name,
      block: name,
      countyCount: sources.countyCountOf(name),
      weights: { pop: hh.households, households: hh.households, grain: lt.twoTax, land: lt.land, commerce: comm.value },
      basis: '户数：' + hh.basis + '。商税：' + comm.basis + '。田亩、两税：' + lt.basis + '。'
    };
  });
}

// 绍宋的数据块：lib-blocks 的 block()。海贸按引擎算法（港口口数 × 0.02）落块，数据块只需在 tags 里标 hasPort
function songBlock(fields) {
  return block(fields);
}

function circuitModule(circuit, fields) {
  return Object.assign({
    scenario: SCENARIO,
    province: circuit,
    leafIdentity: true,
    dropKeys: DROP_KEYS,
    regionKeys: REGION_KEYS,
    regionKeyFrom: REGION_KEY_FROM,
    regionCartography: 'keep',
    productionRule: 'engine',
    taxSchedule: TAX_SCHEDULE,
    fiscalRates: 'compliance',
    UNITS: fields.UNITS || unitsFor(circuit, Object.keys(fields.BLOCKS))
  }, fields);
}

// 原账「地域核算组」：同一地块在原账上拆成几笔核算项（如「高昌·西州核算项」与「高昌·高昌核算项」本是一地，
// 「疏勒·据史德核算项」是并进疏勒地块的旧账），名目是拼账留下的，不是行政区划。并成一块：
// 可加的数相加，比例与读数按口数加权，其余字段取口数最多的一笔；id、名字、绑定地块用组节点的。
const GROUP_SUM = [
  'population', 'populationDetail.mouths', 'populationDetail.households', 'populationDetail.ding',
  'populationDetail.fugitives', 'populationDetail.hiddenCount',
  'fiscalDetail.claimedRevenue', 'fiscalDetail.actualRevenue', 'fiscalDetail.remittedToCenter', 'fiscalDetail.retainedBudget',
  'publicTreasuryInit.money', 'publicTreasuryInit.grain', 'publicTreasuryInit.cloth',
  'economyBase.farmland', 'economyBase.commerceVolume', 'economyBase.maritimeTradeVolume',
  'economyBase.postRelays', 'economyBase.kejuQuota', 'carryingCapacity'
];
// [路径, 小数位]
const GROUP_MEAN = [
  ['prosperity', 0], ['minxinLocal', 0], ['corruptionLocal', 0], ['taxBurden', 0], ['unrest', 0],
  ['fiscalDetail.compliance', 2], ['fiscalDetail.skimmingRate', 3], ['economyBase.roadQuality', 0], ['economyBase.commerceCoefficient', 2]
];
const GROUP_MIX = ['byAge', 'byGender', 'byEthnicity', 'byFaith', 'bySettlement'];

function getPath(obj, p) { return p.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj); }
function setPath(obj, p, value) {
  const keys = p.split('.');
  const last = keys.pop();
  const parent = keys.reduce((o, k) => (o == null ? undefined : o[k]), obj);
  if (parent != null) parent[last] = value;
}
function toRatio(v) {
  if (typeof v === 'number') return v;
  const m = String(v).match(/^\s*(-?\d+(?:\.\d+)?)\s*%\s*$/);
  if (!m) throw new Error('认不出的百分比：' + v);
  return Number(m[1]) / 100;
}

function mergeAccountingGroup(group) {
  const kids = group.children || [];
  if (!kids.length || kids.some((k) => k.mapRegionId !== group.mapRegionId || (k.children || []).length)) {
    throw new Error(group.name + ' 不是同一地块的核算组，不能合并');
  }
  const pop = kids.reduce((a, k) => a + k.population, 0);
  const base = kids.reduce((a, k) => (k.population > a.population ? k : a));
  const out = JSON.parse(JSON.stringify(base));
  out.id = group.id;
  out.name = group.name;
  out.mapRegionId = group.mapRegionId;
  if (group.mapAccounting) out.mapAccounting = { schema: group.mapAccounting.schema, logicalRegionId: group.mapRegionId, weight: 1 };
  GROUP_SUM.forEach((p) => {
    const vals = kids.map((k) => getPath(k, p));
    if (vals.every((v) => typeof v === 'number')) setPath(out, p, Math.round(vals.reduce((a, v) => a + v, 0) * 1e6) / 1e6);
  });
  GROUP_MEAN.forEach(([p, digits]) => {
    const vals = kids.map((k) => getPath(k, p));
    if (!vals.every((v) => typeof v === 'number')) return;
    const f = Math.pow(10, digits);
    setPath(out, p, Math.round(kids.reduce((a, k, i) => a + vals[i] * k.population, 0) / pop * f) / f);
  });
  GROUP_MIX.forEach((key) => {
    if (!kids.every((k) => k[key] && typeof k[key] === 'object')) return;
    const acc = {};
    kids.forEach((k) => Object.entries(k[key]).forEach(([n, v]) => { acc[n] = (acc[n] || 0) + toRatio(v) * k.population; }));
    const total = Object.values(acc).reduce((a, v) => a + v, 0);
    out[key] = {};
    Object.entries(acc).forEach(([n, v]) => { out[key][n] = Math.round((v / total) * 1000) / 1000; });
  });
  return out;
}

// 国号节点下的叶子：核算组并成一块，其余原样
function flatLeaves(kingdom) {
  return kingdom.children.map((c) => (c.type === '地域核算组' ? mergeAccountingGroup(c) : c));
}

module.exports = { SCENARIO, DROP_KEYS, REGION_KEYS, TAX_SCHEDULE, unitsFor, songBlock, circuitModule, mergeAccountingGroup, flatLeaves };
