// 绍宋外藩（金以外）共用：把「每块户数估计 + 经济类型」做成补路一级的框架数据与逐块模块。
// 一棵树写成一个文件（如 data/shaosong-xixia.js），导出 foreignTree(...) 的结果：
//   它是 tianqi-prefectures.js 认的模块数组（每路一个 circuitModule），数组上同时挂着 shaosong-circuits.js 要的
//   treeKey、idPrefix、CIRCUITS、weights 等框架字段。
//
// 权重口径（外藩多无户口可考，写明依据与估法）：
//   户数：每块给 households（相对或绝对皆可，势力全国合计不动，按它分）与 basis（依据）。
//   田亩：户数 × 每户田亩。农耕区按元丰河东路每户田亩，农牧相兼按其四分之三，游牧、渔猎按其半（与大金北方同法）。
//   商贸：户数 × 大金宋地每户商税同率 × 经济类型系数（农 1、农牧 0.7、牧 0.4），都会、商道要冲可在块上写 commerceFactor。
'use strict';

const src = require('./shaosong-sources');
const jinFrame = require('./shaosong-jin-frame');
const { songBlock, circuitModule } = require('./shaosong-common');

const ECONOMY = {
  farm: { land: 1, commerce: 1, label: '农耕' },
  mixed: { land: 0.75, commerce: 0.7, label: '农牧相兼' },
  pastoral: { land: 0.5, commerce: 0.4, label: '游牧渔猎' }
};

// 原账各外藩的聚落名目并入城、镇、乡（补路一级按城、镇、乡三项分口）
const SETTLEMENT_KEYS = {
  王城: '城', 京: '城', 城寨: '城',
  市镇: '镇', 城镇: '镇', 港津: '镇', 港聚落: '镇', 港湾聚落: '镇', 边寨: '镇', 舟师营: '镇',
  牧落: '乡', 坝区乡: '乡', 绿洲乡: '乡', 乡社: '乡', 河谷村: '乡', 村寨牧帐: '乡', 牧帐: '乡', 游牧营: '乡', 寨: '乡',
  山寨: '乡', 溪洞: '乡', 避兵坞壁: '乡', 山地部落: '乡', 山海部落: '乡', 渔猎营: '乡',
  寺院庄园: '乡', 寺社庄园: '乡', 佛寺庄园: '乡'
};

// 无户口史料可考的块写 households: 'original'，按原账户数（sources/shaosong-original-foreign-leaves.json）
const ORIGINAL = require('../sources/shaosong-original-foreign-leaves.json');

function foreignTree(spec) {
  const { treeKey, idPrefix, faction, circuits } = spec;
  const leaves = {};
  Object.entries(spec.leaves).forEach(([name, leaf]) => {
    if (leaf.households !== 'original') { leaves[name] = leaf; return; }
    const o = (ORIGINAL.trees[treeKey] || {})[name];
    if (!o) throw new Error(treeKey + ' 原账里没有 ' + name);
    leaves[name] = Object.assign({}, leaf, {
      households: o.households,
      basis: (leaf.basis ? leaf.basis + '；' : '') + '无户口史料可考，按原账户数 ' + o.households + ' 分'
    });
  });
  const hedong = src.yuanfengRates().rates['河東路'];
  const perHouseholdCommerce = jinFrame.commercePerHousehold();

  function weights(name) {
    const leaf = leaves[name];
    if (!leaf) throw new Error(faction + ' 的框架数据里没有 ' + name);
    const eco = ECONOMY[leaf.economy];
    if (!eco) throw new Error(name + ' 的经济类型不认识：' + leaf.economy);
    const hh = leaf.households;
    const factor = leaf.commerceFactor || 1;
    // 田亩有史料实数的（leaf.land，单位宋亩）直接用，两税按河东路每亩两税折
    const absolute = leaf.land != null;
    return {
      households: hh,
      land: absolute ? leaf.land : hh * hedong.landPerHousehold * eco.land,
      twoTax: absolute ? leaf.land * hedong.taxPerHousehold / hedong.landPerHousehold : hh * hedong.taxPerHousehold * eco.land,
      landAbsolute: absolute,
      commerce: hh * perHouseholdCommerce * eco.commerce * factor,
      counties: leaf.counties || 1,
      householdBasis: leaf.basis,
      commerceBasis: '无商税额可考，按户数估（' + eco.label + (factor !== 1 ? '，商道都会 × ' + factor : '') + '）；' +
        (absolute ? '田亩用' + (leaf.landBasis || '史料实数') : '田亩按元丰河东路每户田亩 × ' + eco.land)
    };
  }

  const modules = circuits.map((c) => {
    const names = Object.keys(c.blocks);
    const UNITS = names.map((name) => {
      const w = weights(name);
      return {
        name,
        block: name,
        countyCount: w.counties,
        weights: { pop: w.households, households: w.households, grain: w.twoTax, land: w.land, commerce: w.commerce },
        basis: '户数：' + w.householdBasis + '。商贸：' + w.commerceBasis + '。'
      };
    });
    return circuitModule(c.name, { faction, BLOCKS: c.blocks, UNITS, regionMeans: c.regionMeans });
  });

  return Object.assign(modules, {
    treeKey,
    idPrefix,
    reportTitle: '绍宋·' + faction + '补路一级报告',
    treeLabel: spec.treeLabel || (faction + '行政树去掉国号节点，'),
    reportNotes: spec.reportNotes || [],
    CIRCUITS: circuits.map((c) => c.frame),
    keepOriginalTotals: spec.keepOriginalTotals || [],
    settlementKeys: Object.assign({}, SETTLEMENT_KEYS, spec.settlementKeys),
    PORTS: spec.PORTS || {},
    // 户数是相对权重，补路一级先折成绝对户数再算田亩
    relativeHouseholds: true,
    weights
  });
}

module.exports = { foreignTree, block: songBlock, ECONOMY, SETTLEMENT_KEYS };
