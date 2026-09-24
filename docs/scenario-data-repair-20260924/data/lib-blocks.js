// 各省数据模块共用的小工具：地块按地形取默认分档，只写与默认不同的项；
// 没有分府户口的省份，用「领州县数 × 密度系数」等给出府州权重。
'use strict';

// 按地形的默认分档（商贸强度、城镇比例先验、渔业、产出、道路、商贸系数、驿路、缙绅兼并）
const PRESETS = {
  平原: { commerce: 1.0, urban: { fang: 0.07, shi: 0.06, zhen: 0.13, cun: 0.74 }, fishing: 0.8, yieldFactor: 1.0, roadQuality: 58, commerceCoefficient: 1.1, corridor: 1.1, gentry: 1.0 },
  水乡: { commerce: 1.4, urban: { fang: 0.09, shi: 0.09, zhen: 0.22, cun: 0.60 }, fishing: 2.0, yieldFactor: 1.2, roadQuality: 60, commerceCoefficient: 1.6, corridor: 1.1, gentry: 1.2 },
  丘陵: { commerce: 0.9, urban: { fang: 0.06, shi: 0.06, zhen: 0.12, cun: 0.76 }, fishing: 0.8, yieldFactor: 0.9, roadQuality: 50, commerceCoefficient: 1.0, corridor: 1.0, gentry: 1.0 },
  盆地: { commerce: 1.0, urban: { fang: 0.07, shi: 0.06, zhen: 0.13, cun: 0.74 }, fishing: 0.6, yieldFactor: 1.05, roadQuality: 50, commerceCoefficient: 1.1, corridor: 1.0, gentry: 1.0 },
  河谷: { commerce: 0.9, urban: { fang: 0.06, shi: 0.06, zhen: 0.12, cun: 0.76 }, fishing: 0.8, yieldFactor: 0.9, roadQuality: 48, commerceCoefficient: 1.0, corridor: 1.1, gentry: 0.9 },
  山地: { commerce: 0.6, urban: { fang: 0.05, shi: 0.05, zhen: 0.10, cun: 0.80 }, fishing: 0.3, yieldFactor: 0.7, roadQuality: 40, commerceCoefficient: 0.8, corridor: 0.8, gentry: 0.9 },
  山林: { commerce: 0.5, urban: { fang: 0.04, shi: 0.04, zhen: 0.08, cun: 0.84 }, fishing: 0.3, yieldFactor: 0.6, roadQuality: 35, commerceCoefficient: 0.7, corridor: 0.7, gentry: 0.8 },
  高原: { commerce: 0.6, urban: { fang: 0.06, shi: 0.05, zhen: 0.10, cun: 0.79 }, fishing: 0.2, yieldFactor: 0.6, roadQuality: 38, commerceCoefficient: 0.8, corridor: 0.9, gentry: 0.8 },
  沿海: { commerce: 1.3, urban: { fang: 0.08, shi: 0.08, zhen: 0.18, cun: 0.66 }, fishing: 2.5, yieldFactor: 0.95, roadQuality: 55, commerceCoefficient: 1.5, corridor: 1.0, gentry: 1.0 },
  边塞: { commerce: 0.8, urban: { fang: 0.12, shi: 0.06, zhen: 0.18, cun: 0.64 }, fishing: 0.2, yieldFactor: 0.55, roadQuality: 50, commerceCoefficient: 0.9, corridor: 1.3, gentry: 0.6 },
  岛屿: { commerce: 1.0, urban: { fang: 0.06, shi: 0.08, zhen: 0.16, cun: 0.70 }, fishing: 3.0, yieldFactor: 0.7, roadQuality: 40, commerceCoefficient: 1.2, corridor: 0.5, gentry: 0.8 }
};

const DEFAULTS = {
  divisionType: '府', officialPosition: '知府', taxLevel: '中', regionType: 'normal',
  maritime: 0, salt: 0, mineral: 0, horse: 0, imperial: 0.01, textile: 1.0,
  zhizao: 0, kuangchang: 0, yuyao: 0, keju: 1.0, hide: 1.0, flee: 1.0
};
const TAG_KEYS = ['hasPort', 'saltRegion', 'mineralRegion', 'horseRegion', 'fishingRegion', 'imperialDomain'];

// idx：[民心, 吏治(贪腐), 繁荣, 发展, 不稳, 税压, 军压, 官风险]；fisc：[征到比例, 截留率]
function block(fields) {
  const preset = PRESETS[fields.terrain];
  if (!preset) throw new Error('未知地形：' + fields.terrain + '（' + fields.name + '）');
  const out = Object.assign({}, DEFAULTS, preset, fields);
  const tags = {};
  TAG_KEYS.forEach((k) => { tags[k] = !!(fields.tags && fields.tags[k]); });
  out.tags = tags;
  if (Array.isArray(fields.idx)) {
    const [minxin, corruption, prosperity, development, unrest, taxPressure, armyPressure, officeRisk] = fields.idx;
    Object.assign(out, { minxin, corruption, prosperity, development, unrest, taxPressure, armyPressure, officeRisk });
    delete out.idx;
  }
  if (Array.isArray(fields.fisc)) {
    out.compliance = fields.fisc[0];
    out.skimmingRate = fields.fisc[1];
    delete out.fisc;
  }
  ['name', 'specialResources', 'description', 'notes', 'minxin', 'corruption', 'prosperity', 'development', 'unrest',
    'taxPressure', 'armyPressure', 'officeRisk', 'compliance', 'skimmingRate'].forEach((k) => {
    if (out[k] === undefined || out[k] === '') throw new Error(fields.name + ' 缺 ' + k);
  });
  return out;
}

// 没有分府户口的省份：人口 = 领州县数 × 密度 × 每县口数 + 军籍估数；税粮 = 民口 × 田赋轻重 + 军籍一成；
// 田亩 = 领州县数 × 地形系数（或直接给 landOverride）。
// 每县口数 perCounty 默认 1 万（纯相对权重）；省里有驻军估数时必须给实数（约为「省总人口 − 驻军」÷ 加权县数），
// 否则归一时驻军会被一并放大。
function unit(u) {
  const civil = u.countyCount * u.density * (u.perCounty || 10000);
  const military = u.militaryMouths || 0;
  const pop = civil + military;
  return Object.assign({}, u, {
    weights: {
      pop,
      households: pop,
      grain: civil * u.taxIntensity + military * 0.1,
      land: u.landOverride != null ? u.landOverride : u.countyCount * u.terrainLand
    }
  });
}

module.exports = { PRESETS, block, unit };
