// @ts-check
/// <reference path="types.d.ts" />
/**
 * tm-phase-b-fills.js — B 阶段户口+军事+人口深化
 *
 * 补完：
 *  B1 region 五字段（bySettlement/byAge.decade/byGender/byEthnicity/byFaith）+ 三维承载力 + 羁縻土司/屯田军镇
 *  B2 徭役死亡率四维 + 逃役五因子 + 徭役民变三元触发
 *  B3 军种6分 + 军粮三供应 + 军队调动公式 + 马政 + 兵权归属
 *  B4 年龄金字塔十年层 + 男女比 + 迁徙通道 + 京畿虹吸四因子
 *  B5 F1 历史耦合（气候×人口/作物革命/疫病/路引/税基流失四手法）+ endturn phase 标识
 */
(function(global) {
  'use strict';

  function _flattenDivisions(nodes, out) {
    out = out || [];
    if (!Array.isArray(nodes)) return out;
    nodes.forEach(function(node) {
      if (!node || typeof node !== 'object') return;
      out.push(node);
      _flattenDivisions(node.children || node.subs || node.divisions, out);
    });
    return out;
  }

  function _getRegionsArray(G) {
    G = G || {};
    if (global.IntegrationBridge && typeof global.IntegrationBridge.getDivisionArray === 'function') {
      var bridged = global.IntegrationBridge.getDivisionArray(G);
      if (bridged && bridged.length) return bridged;
    }
    if (Array.isArray(G.regions)) return G.regions;
    if (G.regions && typeof G.regions === 'object') return Object.values(G.regions);
    if (G.adminHierarchy && typeof G.adminHierarchy === 'object') {
      var out = [];
      Object.keys(G.adminHierarchy).forEach(function(key) {
        var tree = G.adminHierarchy[key];
        if (Array.isArray(tree)) _flattenDivisions(tree, out);
        else if (tree && Array.isArray(tree.divisions)) _flattenDivisions(tree.divisions, out);
        else if (tree && Array.isArray(tree.children)) _flattenDivisions(tree.children, out);
      });
      return out;
    }
    return [];
  }

  // ═══════════════════════════════════════════════════════════════════
  //  B1 · region 五字段扩展 + 三维承载力 + 羁縻/军镇
  // ═══════════════════════════════════════════════════════════════════

  function _enrichRegion(reg) {
    if (!reg.bySettlement) reg.bySettlement = {
      fang: { mouths: Math.floor((reg.mouths || 0) * 0.08), households: Math.floor((reg.households || 0) * 0.08) },  // 坊（都市街区）
      shi:  { mouths: Math.floor((reg.mouths || 0) * 0.05), households: Math.floor((reg.households || 0) * 0.05) },  // 市（集市）
      zhen: { mouths: Math.floor((reg.mouths || 0) * 0.15), households: Math.floor((reg.households || 0) * 0.15) },  // 镇
      cun:  { mouths: Math.floor((reg.mouths || 0) * 0.72), households: Math.floor((reg.households || 0) * 0.72) }   // 村
    };
    if (!reg.byAge) {
      // 十年层金字塔（简化模型）
      var ds = { '0-9':0.22, '10-19':0.18, '20-29':0.15, '30-39':0.13, '40-49':0.11, '50-59':0.08, '60-69':0.06, '70-79':0.04, '80+':0.03 };
      reg.byAge = { decade: {} };
      Object.keys(ds).forEach(function(k) {
        reg.byAge.decade[k] = Math.floor((reg.mouths || 0) * ds[k]);
      });
    }
    if (!reg.byGender) {
      var baseRatio = 1.04;  // 男:女 默认（出生性别比）
      // 战地/边疆 → 男多；中原 → 均衡；劳役重区 → 男少（死亡率）
      var ratio = baseRatio;
      if ((reg.name || '').match(/边|塞|寨/)) ratio = 1.2;
      if ((reg.name || '').match(/苏|杭|扬/)) ratio = 1.0;
      reg.byGender = {
        male: Math.floor((reg.mouths || 0) * ratio / (1 + ratio)),
        female: Math.floor((reg.mouths || 0) / (1 + ratio)),
        sexRatio: ratio
      };
    }
    if (!reg.byEthnicity) {
      // 默认汉族为主，边地杂居
      var isBorderland = /藏|回|蒙|彝|苗|壮|滇|黔|甘|疆/.test(reg.name || '');
      if (isBorderland) {
        reg.byEthnicity = { han: 0.3, other: 0.7 };
      } else {
        reg.byEthnicity = { han: 0.98, other: 0.02 };
      }
    }
    if (!reg.byFaith) {
      reg.byFaith = {
        folk: 0.6,         // 民间信仰
        buddhist: 0.2,
        taoist: 0.15,
        islam: 0.02,
        christian: 0.01,
        other: 0.02
      };
    }
    // 三维承载力
    if (!reg.carryingCapacity) {
      reg.carryingCapacity = _computeCarryingCapacity(reg);
    }
  }

  function _computeCarryingCapacity(reg) {
    var arable = (reg.arableLand || 100000) * 0.3;  // 每亩养 0.3 口
    var waterCap = (reg.waterCapacity || 100000) * 0.8;
    // 气候 modifier
    var climateMod = 1.0;
    var G = global.GM;
    if (G && G.environment && G.environment.climatePhase === 'little_ice_age') climateMod = 0.75;
    if (G && G.environment && G.environment.climatePhase === 'medieval_warm') climateMod = 1.15;
    return {
      arable: Math.floor(arable),
      water: Math.floor(waterCap),
      climate: climateMod,
      total: Math.floor(Math.min(arable, waterCap) * climateMod)
    };
  }

  /** 羁縻府州/土司 */
  function registerJimiHolding(spec) {
    var G = global.GM;
    if (!G.population) return null;
    if (!G.population.jimiHoldings) G.population.jimiHoldings = [];
    var holding = {
      id: 'jimi_' + (G.turn || 0) + '_' + Math.floor(Math.random()*10000),
      name: spec.name || '某羁縻府',
      type: spec.type || 'tusi',  // tusi/jimi/fanbang
      region: spec.region || '',
      mouths: spec.mouths || 50000,
      households: spec.households || 10000,
      autonomy: spec.autonomy || 0.7,
      tribute: spec.tribute || { annual: 5000 },
      loyalty: spec.loyalty || 60,
      ethnicity: spec.ethnicity || 'other',
      createdTurn: G.turn || 0
    };
    G.population.jimiHoldings.push(holding);
    if (global.addEB) global.addEB('羁縻', '设 ' + holding.name);
    return holding;
  }

  /** 屯田军镇 */
  function registerMilitaryFarm(spec) {
    var G = global.GM;
    if (!G.population) return null;
    if (!G.population.militaryFarms) G.population.militaryFarms = [];
    var farm = {
      id: 'mf_' + (G.turn || 0) + '_' + Math.floor(Math.random()*10000),
      name: spec.name || '某屯',
      region: spec.region || '',
      acres: spec.acres || 200000,
      garrison: spec.garrison || 10000,
      yieldAnnual: spec.yieldAnnual || ((spec.acres || 200000) * 0.5),
      mode: spec.mode || 'military',  // military/civilian/mixed
      createdTurn: G.turn || 0
    };
    G.population.militaryFarms.push(farm);
    if (global.addEB) global.addEB('军屯', '建 ' + farm.name + '（' + farm.acres + ' 亩）');
    return farm;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  B2 · 徭役死亡率四维 + 逃役五因子 + 徭役民变
  // ═══════════════════════════════════════════════════════════════════

  var CORVEE_DEATH_WORK_MOD = {
    military:     1.5,  // 兵役死亡率最高
    great_works:  1.3,  // 大工役
    river:        1.2,  // 漕运/水利
    transport:    1.0,  // 运输
    post:         0.6,  // 驿役
    craft:        0.5,  // 工役
    salt:         1.4,  // 盐役（危险工种）
    mine:         1.6,  // 矿役
    granary:      0.7,
    general:      1.0
  };

  var CORVEE_DEATH_GEO_MOD = {
    frontier: 1.5,      // 边塞
    mountain: 1.3,
    desert: 1.6,
    riverside: 0.9,
    plain: 0.8,
    coastal: 1.0
  };

  var CORVEE_DEATH_SEASON_MOD = {
    spring: 0.8,
    summer: 1.2,   // 暑疫
    autumn: 0.9,
    winter: 1.4    // 冻饿
  };

  function computeCorveeDeathRate(project) {
    var workMod = CORVEE_DEATH_WORK_MOD[project.workType || 'general'] || 1.0;
    var geoMod = CORVEE_DEATH_GEO_MOD[project.geography || 'plain'] || 1.0;
    var seasonMod = CORVEE_DEATH_SEASON_MOD[project.season || 'spring'] || 1.0;
    var grainFactor = 1.0;
    if (project.grainSupply !== undefined) {
      if (project.grainSupply < 0.5) grainFactor = 2.0;       // 粮不继
      else if (project.grainSupply < 0.8) grainFactor = 1.3;
      else if (project.grainSupply > 1.2) grainFactor = 0.85;
    }
    var baseRate = project.baseRate || 0.05;  // 基础 5% 死亡
    return Math.min(0.6, baseRate * workMod * geoMod * seasonMod * grainFactor);
  }

  /** 逃役五因子 */
  function computeEscapeRate(project, context) {
    var r = 0;
    // 1. 距离家乡
    var distance = project.distanceFromHome || 500;  // 里
    if (distance > 2000) r += 0.15;
    else if (distance > 1000) r += 0.08;
    else if (distance > 300) r += 0.03;
    // 2. 地形险恶
    var terrainRisk = { frontier:0.12, mountain:0.06, desert:0.15, plain:0.02, coastal:0.04 };
    r += terrainRisk[project.geography || 'plain'] || 0;
    // 3. 季节
    if (project.season === 'winter') r += 0.08;
    if (project.season === 'summer') r += 0.04;
    // 4. 亲族离散（无亲族同行 + 久役）
    if (!project.familyTraveling && (project.durationMonths || 0) > 6) r += 0.08;
    // 5. 督役严酷 vs 宽松（督役 = 监工）
    var supervisionMod = { harsh: 0.05, normal: 0, lax: 0.10 };  // 严 → 反而逃多（绝望）；宽松 → 逃多（容易）
    r += supervisionMod[project.supervision || 'normal'];
    // 粮食情况
    if (project.grainSupply !== undefined && project.grainSupply < 0.6) r += 0.1;
    return Math.min(0.8, r);
  }

  /** 徭役民变三元触发：死亡率峰值 + 农民负担 + 徭役制度完整度 */
  function checkCorveeRebellionTrigger(ctx) {
    var G = global.GM;
    if (!G.population || !G.population.corvee) return { triggered: false };
    var corvee = G.population.corvee;
    var recentPeakDeaths = corvee.recentDeaths || 0;
    // peasantBurden 估算
    var landAnnexation = G.landAnnexation && G.landAnnexation.concentration || 0.3;
    var taxRate = (G.guoku && G.guoku.annualIncome || 10000000) / (G.population.national.mouths || 10000000);
    var peasantBurden = landAnnexation + (taxRate / 10);
    // 徭役制度完整度（一条鞭/摊丁入亩 → 完整度高）
    var integrity = corvee.fullyCommuted ? 0.95 : (corvee.commutationRate || 0.5);
    // 触发条件
    var triggered = false;
    if (recentPeakDeaths > 10000 && peasantBurden > 0.6 && integrity < 0.5) triggered = true;
    if (triggered) {
      if (global.addEB) global.addEB('民变', '徭役惨烈引发民变（死亡 ' + recentPeakDeaths + '；峻役未改）');
      if (G.minxin) {
        if (!G.minxin.revolts) G.minxin.revolts = [];
        G.minxin.revolts.push({
          id: 'corvee_rev_' + (ctx.turn||0) + '_' + Math.floor(Math.random()*10000),
          region: corvee.recentRegion || '某地',
          turn: ctx.turn || 0,
          cause: '徭役',
          status: 'ongoing',
          level: 2,
          scale: 5000
        });
      }
      if (global._adjAuthority) global._adjAuthority('minxin', -8);
    }
    // 清空本回合
    corvee.recentDeaths = 0;
    return { triggered: triggered, peasantBurden: peasantBurden, integrity: integrity };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  B3 · 军事系统深化
  // ═══════════════════════════════════════════════════════════════════

  var MILITARY_BRANCHES = {
    infantry:  { name:'步兵',   baseCost:100,  grainPerSoldier:0.5, effectivenessCoef: 1.0 },
    cavalry:   { name:'骑兵',   baseCost:500,  grainPerSoldier:1.2, effectivenessCoef: 2.5, requiresHorses: true },
    archer:    { name:'弓弩兵', baseCost:150,  grainPerSoldier:0.5, effectivenessCoef: 1.3 },
    navy:      { name:'水军',   baseCost:400,  grainPerSoldier:0.8, effectivenessCoef: 1.8 },
    firearms:  { name:'火器',   baseCost:800,  grainPerSoldier:0.5, effectivenessCoef: 3.0, requiresTech: 'firearms' },
    transport: { name:'辎重',   baseCost:80,   grainPerSoldier:0.3, effectivenessCoef: 0.3 }
  };

  var MILITARY_SUPPLY_MODES = {
    tuntian:   { name:'屯田',   selfSufficiency: 0.8, costToState: 0.2, moraleEffect: 0.9, description:'自耕自食' },
    caoliang:  { name:'漕粮',   selfSufficiency: 0.0, costToState: 1.0, moraleEffect: 1.0, description:'央运粮饷' },
    xiangyin:  { name:'饷银',   selfSufficiency: 0.0, costToState: 1.2, moraleEffect: 1.2, description:'月饷自买' }
  };

  /** 军队调动公式 */
  function computeMilitaryMovement(order) {
    var troops = order.troops || 10000;
    var branch = MILITARY_BRANCHES[order.branch || 'infantry'];
    var distance = order.distance || 500;  // 里
    var supplyMode = MILITARY_SUPPLY_MODES[order.supplyMode || 'caoliang'];
    // 行程：步卒 30 里/日，骑兵 80 里/日
    var pacePerDay = order.branch === 'cavalry' ? 80 : 30;
    var days = Math.ceil(distance / pacePerDay);
    // 粮耗
    var grainConsumed = troops * branch.grainPerSoldier * days;
    // 自给减免
    grainConsumed *= (1 - supplyMode.selfSufficiency);
    // 士气衰减（远征）
    var moraleDecay = Math.min(0.5, distance / 3000) * (2 - supplyMode.moraleEffect);
    // 风险（越远越险）
    var riskFactor = 1 + (distance / 5000) + (order.hostile ? 0.3 : 0);
    // 伤损
    var attrition = Math.min(0.3, 0.02 * days * riskFactor);
    return {
      troops: troops,
      days: days,
      grainConsumed: Math.floor(grainConsumed),
      moraleDecay: moraleDecay,
      attrition: attrition,
      arrivingTroops: Math.floor(troops * (1 - attrition))
    };
  }

  /** 马政 */
  function initMaZheng(G) {
    if (!G.population) return;
    if (!G.population.horses) {
      G.population.horses = {
        stateStud: 50000,       // 国家牧场（北疆/陇右）
        civilianHorses: 100000, // 民养（民间蓄马）
        teaMare: 0,              // 茶马（宋元明以茶换马）
        imported: 0,
        cavalryReserve: 30000    // 骑兵可用
      };
    }
  }

  function updateMaZheng(G, mr) {
    if (!G.population || !G.population.horses) initMaZheng(G);
    var h = G.population.horses;
    // 自然繁殖
    h.stateStud = Math.floor(h.stateStud * (1 + 0.08 * mr));
    h.civilianHorses = Math.floor(h.civilianHorses * (1 + 0.05 * mr));
    // 税马（皇威高时）
    if (G.huangwei && G.huangwei.index > 65) {
      h.cavalryReserve = Math.floor(h.stateStud * 0.3 + h.civilianHorses * 0.1);
    } else {
      h.cavalryReserve = Math.floor(h.stateStud * 0.3);
    }
  }

  /** 兵权归属判定 */
  function assessMilitaryPower(G) {
    if (!G.huangquan) return { holder: 'emperor', risk: 0 };
    var hqMil = G.huangquan.subDims && G.huangquan.subDims.military ? G.huangquan.subDims.military.value : G.huangquan.index;
    if (hqMil >= 75) return { holder: 'emperor', risk: 0, description:'兵权归于皇帝' };
    if (hqMil >= 50) return { holder: 'cabinet', risk: 0.2, description:'兵权在宰相/枢密' };
    if (G.huangquan.powerMinister) {
      return { holder: 'powerMinister', risk: 0.8, description:'兵权归权臣 ' + G.huangquan.powerMinister.name };
    }
    // 低皇权 + 地方自治 → 藩镇
    if (G.fiscal && G.fiscal.regions) {
      var autonomous = Object.keys(G.fiscal.regions).filter(function(rid) {
        return G.fiscal.regions[rid].autonomyLevel > 0.7;
      });
      if (autonomous.length > 2) return { holder: 'warlords', risk: 0.9, description: '兵权归藩镇 ' + autonomous.length + ' 处' };
    }
    return { holder: 'fragmented', risk: 0.5, description:'兵权涣散' };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  B4 · 人口流变精细化
  // ═══════════════════════════════════════════════════════════════════

  /** 年龄金字塔十年层老化 */
  function tickAgePyramid(region, mr) {
    if (!region.byAge || !region.byAge.decade) return;
    var d = region.byAge.decade;
    // 一回合 30 天 → 每 10 年相当于 120 回合。老化速率极低。
    var ageStepRate = (mr || 1) / 120;
    var decades = ['0-9','10-19','20-29','30-39','40-49','50-59','60-69','70-79','80+'];
    // 从高到低迁移避免覆盖
    for (var i = decades.length - 1; i > 0; i--) {
      var transferred = Math.floor((d[decades[i-1]] || 0) * ageStepRate);
      d[decades[i]] = (d[decades[i]] || 0) + transferred;
      d[decades[i-1]] = Math.max(0, (d[decades[i-1]] || 0) - transferred);
    }
    // 80+ 自然死亡
    d['80+'] = Math.max(0, Math.floor(d['80+'] * (1 - 0.02 * (mr || 1))));
    // 新生儿（出生率 0.035）
    var birthRate = region._birthRate || 0.035;
    var newborn = Math.floor((region.mouths || 0) * birthRate * (mr || 1) / 12);  // 每月
    d['0-9'] = (d['0-9'] || 0) + newborn;
  }

  /** 5 大迁徙通道 */
  var MIGRATION_PATHWAYS = {
    north_to_south: { name:'北人南下', from:['河北','河南','山东'], to:['苏','杭','闽','粤'], costFactor: 1.0 },
    west_to_central: { name:'西迁中原', from:['陇','甘','凉'], to:['关中','河南'], costFactor: 0.8 },
    southeast_to_coast: { name:'沿海经商', from:['江南'], to:['闽','粤','沪'], costFactor: 0.6 },
    central_to_frontier: { name:'戍边西北', from:['中原'], to:['陇','河西','西域'], costFactor: 2.0 },
    central_to_southwest: { name:'湖广填川', from:['湖广'], to:['川','黔','滇'], costFactor: 1.5 }
  };

  function migrateByPathway(pathwayId, volume, reason) {
    var G = global.GM;
    var p = MIGRATION_PATHWAYS[pathwayId];
    if (!p || !G.population || !G.population.byRegion) return { ok: false };
    // 源区减，目的区加
    var moved = 0;
    p.from.forEach(function(src) {
      var r = G.population.byRegion[src];
      if (r) {
        var take = Math.min(r.mouths || 0, Math.floor(volume / p.from.length));
        r.mouths -= take;
        moved += take;
      }
    });
    var perTarget = Math.floor(moved / p.to.length);
    var survived = Math.floor(moved * Math.max(0.5, 1 - p.costFactor * 0.1));  // 迁徙死亡
    p.to.forEach(function(tgt) {
      var r = G.population.byRegion[tgt];
      if (r) {
        r.mouths = (r.mouths || 0) + perTarget;
      }
    });
    if (global.addEB) global.addEB('迁徙', p.name + '：' + moved + ' 口，存活 ' + survived + '（' + (reason||'') + '）');
    return { ok: true, moved: moved, survived: survived };
  }

  /** 京畿虹吸四因子 */
  function computeCapitalSiphon(G) {
    if (!G._capital) return { total: 0 };
    var capitalRegion = G.population && G.population.byRegion && G.population.byRegion[G._capital];
    if (!capitalRegion) return { total: 0 };
    // 1. 科举汲引
    var kejuPull = (G._recentKeju ? 5000 : 500);
    // 2. 贵族消费
    var nobilityPull = ((capitalRegion.byClass && capitalRegion.byClass.gentry_high) || 0) * 0.1;
    // 3. 商业辐射
    var commerceLevel = G.currency && G.currency.market && G.currency.market.commerce || 0.5;
    var commercePull = commerceLevel * 3000;
    // 4. 官员员额
    var officialPull = ((G.chars || []).filter(function(c){return c.alive!==false && c.officialTitle;}).length) * 100;
    return {
      keju: kejuPull,
      nobility: nobilityPull,
      commerce: commercePull,
      officials: officialPull,
      total: Math.floor(kejuPull + nobilityPull + commercePull + officialPull)
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  B5 · F1 历史耦合
  // ═══════════════════════════════════════════════════════════════════

  /** 作物革命：玉米/红薯/土豆采纳率 */
  var NEW_WORLD_CROPS = {
    maize:  { name:'玉米',   adoption: 0, adoptionRate: 0.008, yieldBoost: 0.25, suitableFor:['山地','旱地'] },
    sweet_potato: { name:'红薯', adoption: 0, adoptionRate: 0.010, yieldBoost: 0.30, suitableFor:['丘陵','贫地'] },
    potato: { name:'马铃薯', adoption: 0, adoptionRate: 0.005, yieldBoost: 0.20, suitableFor:['高原','寒地'] }
  };

  function tickNewWorldCrops(ctx, mr) {
    var G = global.GM;
    if (!G.population) return;
    // 仅明清启用（1500+）
    if (!G.year || G.year < 1550) return;
    if (!G.population.cropAdoption) G.population.cropAdoption = { maize: 0, sweet_potato: 0, potato: 0 };
    Object.keys(NEW_WORLD_CROPS).forEach(function(crop) {
      var def = NEW_WORLD_CROPS[crop];
      G.population.cropAdoption[crop] = Math.min(1.0, (G.population.cropAdoption[crop] || 0) + def.adoptionRate * mr / 12);
    });
    // 产能 boost（全国）
    var avgBoost = 0;
    Object.keys(NEW_WORLD_CROPS).forEach(function(crop) {
      avgBoost += (G.population.cropAdoption[crop] || 0) * NEW_WORLD_CROPS[crop].yieldBoost;
    });
    G.population._cropYieldBoost = avgBoost;
  }

  /** 疫病谱 */
  var DISEASE_PROFILES = {
    smallpox:   { name:'天花',   mortality: 0.25, spread: 0.08, seasonBoost: { winter: 1.2 } },
    plague:     { name:'鼠疫',   mortality: 0.60, spread: 0.15, seasonBoost: { summer: 1.3 } },
    cholera:    { name:'霍乱',   mortality: 0.40, spread: 0.12, seasonBoost: { summer: 1.5 } },
    tuberculosis: { name:'肺痨', mortality: 0.15, spread: 0.04, seasonBoost: { winter: 1.3 } },
    malaria:    { name:'疟疾',   mortality: 0.10, spread: 0.09, seasonBoost: { summer: 1.6 } }
  };

  function tickDiseaseCycle(ctx, mr) {
    var G = global.GM;
    if (!G.population || !G.population.dynamics) return;
    var dyn = G.population.dynamics;
    if (!dyn.plagueEvents) dyn.plagueEvents = [];
    // 既有疫病演化
    dyn.plagueEvents.forEach(function(e) {
      if (e.status !== 'active') return;
      var profile = DISEASE_PROFILES[e.disease];
      if (!profile) return;
      var season = ['winter','spring','summer','autumn'][Math.floor(((G.month || 1) - 1) / 3) % 4];
      var seasonMult = (profile.seasonBoost && profile.seasonBoost[season]) || 1.0;
      e.affected = Math.floor(e.affected * (1 + profile.spread * seasonMult * mr));
      var deaths = Math.floor(e.affected * profile.mortality * 0.05 * mr);
      e.deaths = (e.deaths || 0) + deaths;
      if (G.population.national) G.population.national.mouths = Math.max(0, G.population.national.mouths - deaths);
      if ((G.turn - e.startTurn) > 24 || Math.random() < 0.02 * mr) e.status = 'ended';
    });
    // 新疫病触发（低概率）
    if (Math.random() < 0.003 * mr) {
      var diseases = Object.keys(DISEASE_PROFILES);
      var pick = diseases[Math.floor(Math.random() * diseases.length)];
      var regions = Object.keys(G.population.byRegion || {});
      var region = regions[Math.floor(Math.random() * regions.length)];
      dyn.plagueEvents.push({
        id: 'plague_' + (ctx.turn||0),
        disease: pick,
        region: region,
        startTurn: ctx.turn || 0,
        affected: Math.floor((G.population.byRegion[region] && G.population.byRegion[region].mouths || 100000) * 0.002),
        deaths: 0,
        status: 'active'
      });
      if (global.addEB) global.addEB('疫病', DISEASE_PROFILES[pick].name + ' 起于 ' + region);
    }
  }

  /** 路引制度严格度 */
  function initTravelDocs(G) {
    if (!G) return;
    if (!G.population) G.population = {};
    if (!G.population.travelDocs) {
      var strictnessByDynasty = {
        '秦': 0.9, '汉': 0.6, '唐': 0.3, '宋': 0.4, '元': 0.8, '明': 0.85, '清': 0.9
      };
      var dy = G.dynasty || '唐';
      G.population.travelDocs = {
        required: true,
        strictness: strictnessByDynasty[dy] || 0.5,
        violations: 0
      };
    }
  }

  /** 税基流失四手法 */
  var TAX_EVASION_METHODS = {
    guiji:   { name:'诡寄',   description:'寄田于官员名下避税',   cost: 0.02 },
    yingshe: { name:'影射',   description:'以假名影占税田',       cost: 0.03 },
    huafen:  { name:'花分',   description:'将一户分为多小户减税', cost: 0.015 },
    feisa:   { name:'飞洒',   description:'将己田税负飞洒于贫户', cost: 0.04 }
  };

  function computeTaxEvasion(G) {
    if (!G.landAnnexation) return 0;
    var annexation = G.landAnnexation.concentration || 0.3;
    var corruption = G.corruption && G.corruption.overall || 30;
    var auditLoose = 1 - (G.auditSystem && G.auditSystem.strength || 0.5);
    // 越兼并/贪腐/审计松，越易评估
    var evasionRate = 0;
    Object.values(TAX_EVASION_METHODS).forEach(function(m) {
      evasionRate += m.cost * annexation * (corruption / 100) * auditLoose;
    });
    if (!G.population) G.population = {};
    if (!G.population.taxEvasion) G.population.taxEvasion = {};
    G.population.taxEvasion.totalRate = Math.min(0.4, evasionRate);
    G.population.taxEvasion.methods = Object.keys(TAX_EVASION_METHODS).map(function(k) {
      var m = TAX_EVASION_METHODS[k];
      return { id: k, name: m.name, rate: m.cost * annexation * (corruption / 100) * auditLoose };
    });
    return G.population.taxEvasion.totalRate;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Tick + Init + Phase 标记
  // ═══════════════════════════════════════════════════════════════════

  function init(sc) {
    var G = global.GM;
    if (!G) return;
    // 扩 region 五字段
    _getRegionsArray(G).forEach(function(r) {
      try { _enrichRegion(r); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'phaseB] enrich:') : console.error('[phaseB] enrich:', e); }
    });
    // 若 population.byRegion 也要扩
    if (G.population && G.population.byRegion) {
      Object.keys(G.population.byRegion).forEach(function(rid) {
        try { _enrichRegion(G.population.byRegion[rid]); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-region-enrich');}catch(_){}}
      });
    }
    initMaZheng(G);
    initTravelDocs(G);
  }

  function tick(ctx) {
    ctx = ctx || {};
    var mr = ctx.monthRatio || 1;
    var G = global.GM;
    // Phase B1: 老化
    if (G.population && G.population.byRegion) {
      Object.values(G.population.byRegion).forEach(function(r) {
        try { tickAgePyramid(r, mr); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-region-enrich');}catch(_){}}
      });
    }
    // Phase B3: 马政
    try { updateMaZheng(G, mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'phaseB] maZheng:') : console.error('[phaseB] maZheng:', e); }
    // Phase B5: 作物革命/疫病/税基流失
    try { tickNewWorldCrops(ctx, mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'phaseB] crops:') : console.error('[phaseB] crops:', e); }
    try { tickDiseaseCycle(ctx, mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'phaseB] disease:') : console.error('[phaseB] disease:', e); }
    try { computeTaxEvasion(G); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'phaseB] taxEvasion:') : console.error('[phaseB] taxEvasion:', e); }
    // Phase B2: 徭役民变检查
    try { checkCorveeRebellionTrigger(ctx); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'phaseB] corveeRev:') : console.error('[phaseB] corveeRev:', e); }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  导出
  // ═══════════════════════════════════════════════════════════════════

  global.PhaseB = {
    init: init,
    tick: tick,
    enrichRegion: _enrichRegion,
    computeCarryingCapacity: _computeCarryingCapacity,
    registerJimiHolding: registerJimiHolding,
    registerMilitaryFarm: registerMilitaryFarm,
    computeCorveeDeathRate: computeCorveeDeathRate,
    computeEscapeRate: computeEscapeRate,
    checkCorveeRebellionTrigger: checkCorveeRebellionTrigger,
    computeMilitaryMovement: computeMilitaryMovement,
    assessMilitaryPower: assessMilitaryPower,
    migrateByPathway: migrateByPathway,
    computeCapitalSiphon: computeCapitalSiphon,
    tickAgePyramid: tickAgePyramid,
    MILITARY_BRANCHES: MILITARY_BRANCHES,
    MILITARY_SUPPLY_MODES: MILITARY_SUPPLY_MODES,
    MIGRATION_PATHWAYS: MIGRATION_PATHWAYS,
    NEW_WORLD_CROPS: NEW_WORLD_CROPS,
    DISEASE_PROFILES: DISEASE_PROFILES,
    TAX_EVASION_METHODS: TAX_EVASION_METHODS,
    VERSION: 1
  };

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
