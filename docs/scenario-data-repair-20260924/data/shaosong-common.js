// 绍宋各路数据模块共用的设置：剧本、要删的旧字段、地块读数层、应征构成，以及按史料权重生成 UNITS。
'use strict';

const { block } = require('./lib-blocks');
const sources = require('./shaosong-sources');
const { PORTS } = require('./shaosong-frame');

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

// 应征构成：原账全国两税 7,379,680、商税 21,646,927、盐茶酒课 475,065（与分路框架同一口径）
const FISCAL_MIX = { grain: 7379680 / 29501672, commerce: 21646927 / 29501672, households: 475065 / 29501672 };

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

// 绍宋的数据块：lib-blocks 的 block()，海贸权重取市舶表
function songBlock(fields) {
  return block(Object.assign({ maritime: PORTS[fields.name] || 0 }, fields));
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
    fiscalMix: FISCAL_MIX,
    fiscalRates: 'compliance',
    UNITS: unitsFor(circuit, Object.keys(fields.BLOCKS))
  }, fields);
}

module.exports = { SCENARIO, DROP_KEYS, REGION_KEYS, FISCAL_MIX, unitsFor, songBlock, circuitModule };
