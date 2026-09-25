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

module.exports = { SCENARIO, DROP_KEYS, REGION_KEYS, TAX_SCHEDULE, unitsFor, songBlock, circuitModule };
