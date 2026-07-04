// @ts-check
/// <reference path="types.d.ts" />
/**
 * tm-economy-engine.js — 经济引擎集合 (Phase 3 F7·2026-05-03·5 文件合 + R10b/c·2026-05-04·吸 §B/§C 纸币+粮价 + R10 fiscal compat·EconomyCore 暴露 formulaEstimateWealth)
 *
 * Status: active · Last Updated: 2026-05-04 (Phase 3 R10b/R10c·吸 tm-tax-atomic §B/§C + Codex R10 fiscal compat)
 *
 * 6 → 1 (其中 tm-economy.js 留独立·因 top-level functions 非 IIFE wrap·不混)
 *
 * 包含 5 IIFE 块·按 dep 顺序 load·variables 各 IIFE 内 isolated·
 *   §A·CurrencyUnit (utility·no deps·原 tm-currency-unit.js·~129 行)
 *   §B·CurrencyEngine (原 tm-currency-engine.js·~790 行·8 大决策·6 币种/本位/铸币/纸币/市场/海外/改革/地域差)
 *        + R10b·吸 PAPER_DATA_25 + _updatePaperStateAtomic + _checkPaperCollapseAtomic (原 tm-tax-atomic §B)
 *        + R10c·吸 _updateGrainPriceAtomic (原 tm-tax-atomic §C·市场供需粮价)
 *   §C·EnvCapacityEngine (原 tm-env-capacity-engine.js·~574 行·8 决策·5 维承载力/9 类疤痕/危机/恢复/技术/政策)
 *   §D·EconomyLinkage (原 tm-economy-linkage.js·~464 行·四子系统联动·剥夺/区域树/分账/下拨/俸禄/贪腐/抄家/事件总线)
 *   §E·EconomyGapFill (原 tm-economy-gap-fill.js·~839 行·12 项补完·购买力/19 税/地域币值/套利/递归/封建/虚报/兼并/借贷/口碑/廷议/强征)
 *        + Codex R10 fiscal compat·formulaEstimateWealth (原 tm-tax-atomic §J·暴露为 global.EconomyCore namespace)
 *
 * 总·~2880 行·5 separate IIFE 块·原 5 file 已 delete + tm-tax-atomic §B/§C/§J 已并入·
 *
 * tm-economy.js (749 行 top-level functions) 不入此 file·留独立 (因为非 IIFE wrap)·
 *
 * 对外 globals (各 IIFE 块 export)·
 *   §A·CurrencyUnit.fmt() / etc.
 *   §B·CurrencyEngine.init / tick / getInflationText / getAIContext / applyReform / issuePaper / abolishPaper / debaseCoin
 *        + PAPER_DATA_25·_updatePaperStateAtomic·_checkPaperCollapseAtomic·_updateGrainPriceAtomic (R10b/c·var-drawers L1204 引用 PAPER_DATA_25)
 *   §C·EnvCapacityEngine.* (5 决策接口)
 *   §D·(linkage 内部 hooks·event-bus 注册)·**createTransferOrder(spec)** (object 签名·与 FiscalEngine.createTransferOrder(from,toRegion,amount) 不冲)
 *   §E·EconomyGapFill·* (12 项补完入口) + global.EconomyCore.formulaEstimateWealth (Codex R10·原 §J)
 *
 * Used by: tm-game-loop·tm-endturn-systems·tm-var-drawers·tm-fiscal-engine (经济基础读取)·smoke-engine-phase0·smoke-influence-groups
 * Test: verify-all 35/35·influence-groups (91 assertions)·class-engine (78)·smoke-engine-phase0 (21)
 */

// ═══════════════════════════════════════════════════════════════════════
//  【立项拆分 2026-07-04】§A CurrencyUnit + §B CurrencyEngine(原§36-1033·两整IIFE)
//  → tm-economy-engine-currency.js（载于本文件之前）·保序切割
// ═══════════════════════════════════════════════════════════════════════
// ───────────────────────────────────────────
// §C·EnvCapacityEngine (from tm-env-capacity-engine.js)
// ───────────────────────────────────────────
(function(global) {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════
  //  生态疤痕种类
  // ═══════════════════════════════════════════════════════════════════

  var SCAR_TYPES = [
    'deforestation','soilErosion','salinization','desertification',
    'waterTableDrop','riverSilting','biodiversityLoss','soilFertilityLoss','urbanSewageOverload'
  ];

  var SCAR_LABELS = {
    deforestation:'森林退化', soilErosion:'水土流失', salinization:'盐碱化',
    desertification:'沙漠化', waterTableDrop:'地下水位下降', riverSilting:'河道淤积',
    biodiversityLoss:'生物多样性损失', soilFertilityLoss:'地力衰退', urbanSewageOverload:'城市排污过载'
  };

  // ═══════════════════════════════════════════════════════════════════
  //  20 环境危机事件
  // ═══════════════════════════════════════════════════════════════════

  var CRISIS_EVENTS = [
    { id:'huanghe_change', name:'黄河改道',       trigger:{ riverSilting:0.7 },       severity:'catastrophic', effect:{ deathRate:0.15, farmlandLoss:0.25, unrest:+30 } },
    { id:'huaihe_flood',   name:'淮河泛滥',       trigger:{ riverSilting:0.5 },       severity:'severe',       effect:{ deathRate:0.08, farmlandLoss:0.15, unrest:+20 } },
    { id:'flood',          name:'大水',           trigger:{ waterTableDrop:0.3 },     severity:'severe',       effect:{ deathRate:0.05, farmlandLoss:0.10, unrest:+15 } },
    { id:'drought',        name:'旱灾',           trigger:{ waterTableDrop:0.5 },     severity:'severe',       effect:{ deathRate:0.06, famine:true, unrest:+15 } },
    { id:'locust',         name:'蝗灾',           trigger:{ biodiversityLoss:0.6 },   severity:'severe',       effect:{ farmlandLoss:0.20, famine:true, unrest:+25 } },
    { id:'plague',         name:'瘟疫',           trigger:{ urbanSewageOverload:0.5 },severity:'catastrophic', effect:{ deathRate:0.20, unrest:+30 } },
    { id:'famine',         name:'饥荒',           trigger:{ soilFertilityLoss:0.5 },  severity:'severe',       effect:{ deathRate:0.10, unrest:+25 } },
    { id:'wildfire',       name:'山火',           trigger:{ deforestation:0.7 },      severity:'moderate',     effect:{ deathRate:0.01, deforestationBoost:0.1 } },
    { id:'dust_storm',     name:'沙尘',           trigger:{ desertification:0.5 },    severity:'moderate',     effect:{ farmlandLoss:0.05, unrest:+5 } },
    { id:'earthquake',     name:'地震',           trigger:null,                        severity:'severe',       effect:{ deathRate:0.03, housingLoss:0.20 }, random:true, probAnnual:0.03 },
    { id:'typhoon',        name:'飓风海啸',       trigger:null,                        severity:'moderate',     effect:{ deathRate:0.02, coastalDamage:true }, random:true, probAnnual:0.05 },
    { id:'mountain_desic', name:'山林尽伐',       trigger:{ deforestation:0.85 },     severity:'moderate',     effect:{ fuelCrisis:true, floodRisk:+0.2 } },
    { id:'well_dry',       name:'井泉尽涸',       trigger:{ waterTableDrop:0.8 },     severity:'severe',       effect:{ waterCrisis:true, migration:true } },
    { id:'salt_tide',      name:'盐碱蚀田',       trigger:{ salinization:0.7 },       severity:'severe',       effect:{ farmlandLoss:0.30 } },
    { id:'desert_invade',  name:'沙侵',           trigger:{ desertification:0.7 },    severity:'moderate',     effect:{ farmlandLoss:0.15, migration:true } },
    { id:'pest_outbreak',  name:'虫害爆发',       trigger:{ biodiversityLoss:0.7 },   severity:'moderate',     effect:{ farmlandLoss:0.10 } },
    { id:'fertility_loss', name:'地力尽',         trigger:{ soilFertilityLoss:0.8 },  severity:'severe',       effect:{ farmlandLoss:0.25, migration:true } },
    { id:'urban_epidemic', name:'都市疫疠',       trigger:{ urbanSewageOverload:0.7 },severity:'severe',       effect:{ deathRate:0.15, urbanUnrest:+20 } },
    { id:'river_burst',    name:'河堤溃决',       trigger:{ riverSilting:0.8 },       severity:'catastrophic', effect:{ deathRate:0.12, farmlandLoss:0.20 } },
    { id:'winter_severe',  name:'严冬',           trigger:null,                        severity:'moderate',     effect:{ deathRate:0.04, fuelStress:+0.3 }, random:true, probAnnual:0.08 }
  ];

  // ═══════════════════════════════════════════════════════════════════
  //  技术进步阶梯（5 个技术维度 × 朝代）
  // ═══════════════════════════════════════════════════════════════════

  var TECH_TIERS = {
    agriculture: {
      levels: [
        { era:'先秦', yieldMult:0.8, unlocks:['ox_plow'] },
        { era:'汉',   yieldMult:1.0, unlocks:['iron_tools','dongting_rice'] },
        { era:'唐',   yieldMult:1.3, unlocks:['curved_plow','south_rice'] },
        { era:'宋',   yieldMult:1.6, unlocks:['champa_rice','tea_cultivation'] },
        { era:'明',   yieldMult:1.9, unlocks:['maize','sweet_potato'] },
        { era:'清',   yieldMult:2.2, unlocks:['potato','expanded_maize'] }
      ]
    },
    irrigation: {
      levels: [
        { era:'先秦', capMult:0.7, unlocks:['dujiangyan'] },
        { era:'汉',   capMult:1.0, unlocks:['waterwheel'] },
        { era:'唐',   capMult:1.3, unlocks:['dragon_pump'] },
        { era:'宋',   capMult:1.6, unlocks:['tong_river'] },
        { era:'明',   capMult:1.9, unlocks:['advanced_channels'] },
        { era:'清',   capMult:2.0, unlocks:['qinling_projects'] }
      ]
    },
    fertilizer: {
      levels: [
        { era:'先秦', fertilityDecay:0.05, unlocks:['ash'] },
        { era:'汉',   fertilityDecay:0.04, unlocks:['manure'] },
        { era:'唐',   fertilityDecay:0.03, unlocks:['crop_rotation'] },
        { era:'宋',   fertilityDecay:0.025, unlocks:['green_manure'] },
        { era:'明',   fertilityDecay:0.02, unlocks:['bean_rotation'] },
        { era:'清',   fertilityDecay:0.018, unlocks:['intensive'] }
      ]
    },
    seedSelection: {
      levels: [
        { era:'汉',   yieldMult:1.0 },
        { era:'宋',   yieldMult:1.1 },
        { era:'明',   yieldMult:1.2 },
        { era:'清',   yieldMult:1.25 }
      ]
    },
    toolImprovement: {
      levels: [
        { era:'先秦', labor:1.0 },
        { era:'汉',   labor:0.9 },
        { era:'唐',   labor:0.8 },
        { era:'宋',   labor:0.7 },
        { era:'明',   labor:0.65 },
        { era:'清',   labor:0.6 }
      ]
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  //  13 类环境政策（古语）
  // ═══════════════════════════════════════════════════════════════════

  var ENV_POLICIES = [
    { id:'feng_shan_mu',  name:'封山育木',    scarReduce:{ deforestation:0.02 },      cost:{ money:50000 } },
    { id:'jin_hu_kui',    name:'禁伐楛',      scarReduce:{ deforestation:0.015 },     cost:{ money:30000 } },
    { id:'yi_he_shui',    name:'疏浚河道',    scarReduce:{ riverSilting:0.03 },       cost:{ money:80000 } },
    { id:'ke_gao',        name:'克膏治田',    scarReduce:{ salinization:0.02 },       cost:{ money:60000 } },
    { id:'tun_tian',      name:'屯田养地',    scarReduce:{ soilFertilityLoss:0.02 },  cost:{ money:40000, grain:20000 } },
    { id:'fan_gu',        name:'反古休耕',    scarReduce:{ soilFertilityLoss:0.03 },  cost:{ money:30000 } },
    { id:'jie_yong',      name:'节用爱民',    scarReduce:{ deforestation:0.01, urbanSewageOverload:0.01 }, cost:{ money:20000 } },
    { id:'zhi_tian_yu',   name:'制田赋',      scarReduce:{ soilErosion:0.015 },       cost:{ money:35000 } },
    { id:'jin_dian_hun',  name:'禁奠琥',      scarReduce:{ biodiversityLoss:0.02 },   cost:{ money:15000 } },
    { id:'shui_li',       name:'兴水利',      scarReduce:{ waterTableDrop:0.02 },     cost:{ money:100000 } },
    { id:'ken_huang',     name:'垦荒（慎）',  effect:{ farmlandBoost:+0.05 },         cost:{ money:40000 }, risk:{ deforestation:+0.01 } },
    { id:'yu_huang',      name:'育皇林',      scarReduce:{ biodiversityLoss:0.01 },   cost:{ money:25000 } },
    { id:'jing_wei',      name:'净渭清畿',    scarReduce:{ urbanSewageOverload:0.03 },cost:{ money:50000 } },
    { id:'migration_relief', name:'迁民减压', scarReduce:{ soilErosion:0.045, deforestation:0.03, urbanSewageOverload:0.02 }, effect:{ migrateShare:0.10, loadRelief:0.10 }, cost:{ money:120000, grain:60000 }, duration:36 },
    { id:'tech_investment', name:'技术投入', scarReduce:{ waterTableDrop:0.012, riverSilting:0.012, soilFertilityLoss:0.008 }, effect:{ techBoost:{ irrigation:0.25, agriculture:0.15, fertilizer:0.12, toolImprovement:0.10 }, carryingBoost:0.03 }, cost:{ money:160000 }, duration:36 },
    { id:'disaster_recovery', name:'灾后恢复', scarReduce:{ soilErosion:0.035, riverSilting:0.025, soilFertilityLoss:0.035, salinization:0.018 }, effect:{ arableRestore:0.08, soilFertilityBoost:0.05, disasterRecovery:0.18 }, cost:{ money:140000, grain:50000 }, duration:30 }
  ];

  // ═══════════════════════════════════════════════════════════════════
  //  初始化
  // ═══════════════════════════════════════════════════════════════════

  function init(sc) {
    var G = global.GM;
    if (!G) return;
    if (G.environment && G.environment._inited) {
      if (!G.environment.byRegion) G.environment.byRegion = {};
      if (!G.environment.crisisHistory) G.environment.crisisHistory = [];
      if (!G.environment.historicalScarMap) G.environment.historicalScarMap = [];
      return;
    }

    var config = (sc && sc.environmentConfig) || {};
    var regions = (G.regions || []);

    G.environment = {
      _inited: true,
      nationalCarrying: { farmland: 0, water: 0, fuel: 0, housing: 0, sanitation: 0 },
      nationalLoad: 0.5,
      ecoDebt: 0,
      byRegion: _initRegions(regions, config),
      climatePhase: (config.climateTimeline && config.climateTimeline[0]) || 'normal',
      historicalScarMap: [],
      crisisHistory: [],
      techEra: _inferTechEra(sc),
      activePolicies: [] // 正在推行的政策列表
    };

    _recomputeNationalCarrying();
  }

  function _inferTechEra(sc) {
    if (!sc) return '唐';
    var name = (sc.name || sc.dynasty || '').toString();
    var eras = ['先秦','汉','唐','宋','元','明','清'];
    for (var i = eras.length - 1; i >= 0; i--) {
      if (name.indexOf(eras[i]) >= 0) return eras[i];
    }
    return '唐';
  }

  function _initRegions(regions, config) {
    var out = {};
    regions.forEach(function(r) {
      if (!r || !r.id) return;
      var custom = (config.initialCarrying && config.initialCarrying.byRegion && config.initialCarrying.byRegion[r.id]) || {};
      var customScars = (config.initialScars && config.initialScars.byRegion && config.initialScars.byRegion[r.id]) || {};
      out[r.id] = {
        carrying: {
          farmlandSupport: custom.farmlandSupport || 1000000,
          waterSupport:    custom.waterSupport    || 1500000,
          fuelSupport:     custom.fuelSupport     || 800000,
          housingSupport:  custom.housingSupport  || 1200000,
          sanitationSupport: custom.sanitationSupport || 1000000
        },
        carryingMax: 0,
        ecoScars: _defaultScars(customScars),
        currentLoad: 0.5,
        overloadYears: 0,
        forestArea: custom.forestArea || 500000,
        coalReserve: custom.coalReserve || 0,
        aquiferLevel: custom.aquiferLevel || 1.0,
        riverFlow: custom.riverFlow || 1.0,
        arableArea: custom.arableArea || 500000,
        soilFertility: custom.soilFertility || 0.85,
        techLevel: Object.assign({ agriculture: 1, irrigation: 1, fertilizer: 1, seedSelection: 1, toolImprovement: 1 }, custom.techLevel || {})
      };
      _recomputeRegionCarrying(r.id, out[r.id]);
    });
    return out;
  }

  function _defaultScars(custom) {
    var s = {};
    SCAR_TYPES.forEach(function(t) { s[t] = (custom && custom[t]) || 0; });
    return s;
  }

  function _recomputeRegionCarrying(rid, reg) {
    // 1) 土地支撑
    var G = global.GM;
    var techEra = G.environment ? G.environment.techEra : '唐';
    var yieldMult = _getTechEraMult('agriculture', techEra, 'yieldMult') || 1.0;
    var irrigMult = _getTechEraMult('irrigation', techEra, 'capMult') || 1.0;
    var seedMult = _getTechEraMult('seedSelection', techEra, 'yieldMult') || 1.0;
    var farmland = (reg.arableArea || 500000) * (reg.soilFertility || 0.85) * yieldMult * seedMult * irrigMult
                   - (reg.ecoScars.salinization || 0) * 200000
                   - (reg.ecoScars.soilErosion || 0) * 150000;
    reg.carrying.farmlandSupport = Math.max(100000, farmland);
    // 2) 水
    var water = (reg.aquiferLevel || 1.0) * 1500000 * (reg.riverFlow || 1.0)
                - (reg.ecoScars.waterTableDrop || 0) * 300000
                - (reg.ecoScars.riverSilting || 0) * 200000;
    reg.carrying.waterSupport = Math.max(100000, water);
    // 3) 燃料
    var fuel = (reg.forestArea || 500000) * 1.5 + (reg.coalReserve || 0) * 3
               - (reg.ecoScars.deforestation || 0) * 400000;
    reg.carrying.fuelSupport = Math.max(50000, fuel);
    // 4) 住房
    reg.carrying.housingSupport = (reg.mouths || 1200000) * 1.1; // 简化估算
    // 5) 卫生
    var sani = 1000000 - (reg.ecoScars.urbanSewageOverload || 0) * 500000;
    reg.carrying.sanitationSupport = Math.max(100000, sani);

    reg.carryingMax = Math.min(
      reg.carrying.farmlandSupport,
      reg.carrying.waterSupport,
      reg.carrying.fuelSupport,
      reg.carrying.housingSupport,
      reg.carrying.sanitationSupport
    );

    // 加载比
    var pop = global.GM.population && global.GM.population.byRegion && global.GM.population.byRegion[rid];
    var popCount = pop ? pop.mouths : 1000000;
    reg.currentLoad = popCount / Math.max(1, reg.carryingMax);
  }

  function _getTechEraMult(tech, era, key) {
    var levels = TECH_TIERS[tech] && TECH_TIERS[tech].levels;
    if (!levels) return 1.0;
    var lv = levels.find(function(l) { return l.era === era; });
    if (!lv) lv = levels[levels.length - 1];
    return lv[key] || 1.0;
  }

  function _recomputeNationalCarrying() {
    var E = global.GM.environment;
    if (!E) return;
    var totals = { farmland:0, water:0, fuel:0, housing:0, sanitation:0 };
    var loadSum = 0, n = 0;
    Object.values(E.byRegion).forEach(function(r) {
      totals.farmland += r.carrying.farmlandSupport;
      totals.water += r.carrying.waterSupport;
      totals.fuel += r.carrying.fuelSupport;
      totals.housing += r.carrying.housingSupport;
      totals.sanitation += r.carrying.sanitationSupport;
      loadSum += r.currentLoad;
      n++;
    });
    E.nationalCarrying = totals;
    E.nationalLoad = n > 0 ? loadSum / n : 0.5;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Ⅱ 生态疤痕累积 + Ⅳ 恢复
  // ═══════════════════════════════════════════════════════════════════

  function _tickScarAccumulation(ctx, mr) {
    var E = global.GM.environment;
    if (!E) return;
    var G = global.GM;
    Object.keys(E.byRegion).forEach(function(rid) {
      var reg = E.byRegion[rid];
      var pop = G.population && G.population.byRegion && G.population.byRegion[rid];
      var popCount = pop ? pop.mouths : 500000;
      var load = reg.currentLoad || 0.5;
      // 过载加速疤痕
      var overloadMult = Math.max(1.0, load);
      // 森林退化（按人口烧柴）
      reg.ecoScars.deforestation = Math.min(1, (reg.ecoScars.deforestation || 0) + 0.0005 * overloadMult * mr);
      // 水土流失
      reg.ecoScars.soilErosion = Math.min(1, (reg.ecoScars.soilErosion || 0) + 0.0003 * overloadMult * mr);
      // 地下水下降（人口密度影响）
      reg.ecoScars.waterTableDrop = Math.min(1, (reg.ecoScars.waterTableDrop || 0) + 0.0002 * overloadMult * mr);
      // 河道淤积
      reg.ecoScars.riverSilting = Math.min(1, (reg.ecoScars.riverSilting || 0) + 0.0002 * mr);
      // 地力衰退（按技术）
      var fertDecay = _getTechEraMult('fertilizer', E.techEra, 'fertilityDecay') || 0.03;
      reg.ecoScars.soilFertilityLoss = Math.min(1, (reg.ecoScars.soilFertilityLoss || 0) + fertDecay / 12 * mr);
      reg.soilFertility = Math.max(0.3, reg.soilFertility - fertDecay / 12 * mr);
      // 盐碱化（灌溉过度）
      reg.ecoScars.salinization = Math.min(1, (reg.ecoScars.salinization || 0) + 0.0001 * overloadMult * mr);
      // 沙漠化（干旱+过伐）
      if (reg.ecoScars.deforestation > 0.5) {
        reg.ecoScars.desertification = Math.min(1, (reg.ecoScars.desertification || 0) + 0.0002 * mr);
      }
      // 生物多样性损失
      reg.ecoScars.biodiversityLoss = Math.min(1, (reg.ecoScars.biodiversityLoss || 0) + 0.0001 * mr);
      // 城市排污
      if (popCount > 500000) {
        reg.ecoScars.urbanSewageOverload = Math.min(1, (reg.ecoScars.urbanSewageOverload || 0) + 0.0003 * mr);
      }
      // 过载年数
      if (load > 1.0) reg.overloadYears += mr / 12;
      else reg.overloadYears = Math.max(0, reg.overloadYears - mr / 24); // 恢复慢
      // 政策效果
      (E.activePolicies || []).forEach(function(p) {
        if (p.regionId && p.regionId !== rid && p.regionId !== 'all') return;
        var policy = ENV_POLICIES.find(function(pp) { return pp.id === p.id; });
        if (policy && policy.scarReduce) {
          Object.keys(policy.scarReduce).forEach(function(sk) {
            reg.ecoScars[sk] = Math.max(0, reg.ecoScars[sk] - policy.scarReduce[sk] * mr / 12);
          });
        }
        if (policy && policy.effect && policy.effect.loadRelief) {
          reg.currentLoad = Math.max(0.05, (reg.currentLoad || 0.5) - policy.effect.loadRelief * mr / 24);
        }
      });
      _recomputeRegionCarrying(rid, reg);
    });
    _recomputeNationalCarrying();
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Ⅲ 过载多级反馈
  // ═══════════════════════════════════════════════════════════════════

  function _tickOverloadFeedback(ctx, mr) {
    var E = global.GM.environment;
    if (!E) return;
    var G = global.GM;
    Object.keys(E.byRegion).forEach(function(rid) {
      var reg = E.byRegion[rid];
      var load = reg.currentLoad || 0.5;
      if (load < 1.0) return;
      // 级别 1: 1.0-1.2 压力
      // 级别 2: 1.2-1.5 饥荒
      // 级别 3: >1.5 崩溃
      var level = load < 1.2 ? 1 : load < 1.5 ? 2 : 3;
      var pop = G.population && G.population.byRegion && G.population.byRegion[rid];
      if (!pop) return;
      if (level === 1) {
        pop.yearlyDeaths = (pop.yearlyDeaths || 0) + pop.mouths * 0.002 * mr / 12;
        pop.mouths = Math.max(10000, pop.mouths - pop.mouths * 0.002 * mr / 12);
      } else if (level === 2) {
        pop.yearlyDeaths = (pop.yearlyDeaths || 0) + pop.mouths * 0.008 * mr / 12;
        pop.mouths = Math.max(10000, pop.mouths - pop.mouths * 0.008 * mr / 12);
        var region = (G.regions || []).find(function(r) { return r.id === rid; });
        if (region) region.unrest = Math.min(100, (region.unrest || 30) + 3 * mr);
        if (global._adjAuthority) global._adjAuthority('minxin', -0.2 * mr);
      } else {
        pop.yearlyDeaths = (pop.yearlyDeaths || 0) + pop.mouths * 0.02 * mr / 12;
        pop.mouths = Math.max(10000, pop.mouths - pop.mouths * 0.02 * mr / 12);
        var region2 = (G.regions || []).find(function(r) { return r.id === rid; });
        if (region2) { region2.unrest = Math.min(100, (region2.unrest || 30) + 8 * mr); region2.disasterLevel = Math.min(1, (region2.disasterLevel || 0) + 0.05 * mr); }
        if (global._adjAuthority) global._adjAuthority('minxin', -0.5 * mr);
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Ⅴ 危机事件触发
  // ═══════════════════════════════════════════════════════════════════

  function _tickCrisisEvents(ctx, mr) {
    var E = global.GM.environment;
    if (!E) return;
    CRISIS_EVENTS.forEach(function(ev) {
      // 触发检测——每月仅一次机会
      if (ev.random) {
        if (Math.random() < (ev.probAnnual || 0.02) * mr / 12) {
          _triggerCrisis(ev);
        }
      } else if (ev.trigger) {
        // 按 scar 触发
        Object.keys(ev.trigger).forEach(function(sk) {
          var threshold = ev.trigger[sk];
          Object.keys(E.byRegion).forEach(function(rid) {
            var reg = E.byRegion[rid];
            if (reg.ecoScars[sk] >= threshold && !reg['_crisis_' + ev.id]) {
              if (Math.random() < 0.02 * mr) {
                _triggerCrisis(ev, rid);
                reg['_crisis_' + ev.id] = ctx.turn || 0;
              }
            }
            // 冷却 5 年后可再触发
      if (reg['_crisis_' + ev.id] && (ctx.turn - reg['_crisis_' + ev.id]) > ((typeof global.turnsForMonths === 'function') ? global.turnsForMonths(60) : 60)) {
              delete reg['_crisis_' + ev.id];
            }
          });
        });
      }
    });
  }

  function _triggerCrisis(ev, rid) {
    var E = global.GM.environment;
    E.crisisHistory.push({ id: ev.id, name: ev.name, turn: global.GM.turn, regionId: rid || 'national', severity: ev.severity });
    if (E.crisisHistory.length > 60) E.crisisHistory.splice(0, E.crisisHistory.length - 60);
    // 效果
    if (ev.effect) {
      var ef = ev.effect;
      if (ef.deathRate) {
        var P = global.GM.population;
        if (P) {
          var target = rid && P.byRegion[rid] ? P.byRegion[rid] : P.national;
          var deaths = Math.round(target.mouths * ef.deathRate);
          target.mouths = Math.max(10000, target.mouths - deaths);
          if (P.national !== target) P.national.mouths = Math.max(10000, P.national.mouths - deaths);
        }
      }
      if (ef.unrest) {
        var G = global.GM;
        if (rid) {
          var reg = (G.regions || []).find(function(r) { return r.id === rid; });
          if (reg) reg.unrest = Math.min(100, (reg.unrest || 30) + ef.unrest);
        } else {
          if (typeof G.unrest === 'number') G.unrest = Math.min(100, G.unrest + ef.unrest / 2);
        }
      }
      if (ef.farmlandLoss) {
        if (rid && E.byRegion[rid]) {
          E.byRegion[rid].arableArea *= (1 - ef.farmlandLoss);
        }
      }
    }
    if (global.addEB) global.addEB('环境', ev.name + (rid ? '（' + rid + '）' : '') + ' · ' + ev.severity);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Ⅶ 玩家环境政策
  // ═══════════════════════════════════════════════════════════════════

  function _envRegionIds(regionId) {
    var E = global.GM && global.GM.environment;
    if (!E || !E.byRegion) return [];
    if (regionId && regionId !== 'all' && E.byRegion[regionId]) return [regionId];
    return Object.keys(E.byRegion);
  }

  function _findEnvReceivingRegion(fromId) {
    var E = global.GM && global.GM.environment;
    if (!E || !E.byRegion) return null;
    var best = null;
    Object.keys(E.byRegion).forEach(function(rid) {
      if (rid === fromId) return;
      var reg = E.byRegion[rid] || {};
      if (!best || (reg.currentLoad || 0.5) < (E.byRegion[best].currentLoad || 0.5)) best = rid;
    });
    return best;
  }

  function _pushEnvPolicyHistory(entry) {
    var E = global.GM && global.GM.environment;
    if (!E) return;
    if (!Array.isArray(E.policyHistory)) E.policyHistory = [];
    E.policyHistory.push(entry);
    if (E.policyHistory.length > 120) E.policyHistory.splice(0, E.policyHistory.length - 120);
  }

  function _applyPolicyImmediateEffect(policy, policyId, regionId) {
    var G = global.GM;
    var E = G && G.environment;
    if (!G || !E || !E.byRegion || !policy) return { regions: [] };
    var effect = policy.effect || {};
    var summary = { regions: [], migrated: 0, techBoosted: 0, restored: 0 };
    _envRegionIds(regionId).forEach(function(rid) {
      var reg = E.byRegion[rid];
      if (!reg) return;
      var row = { regionId: rid };

      if (effect.migrateShare && G.population && G.population.byRegion && G.population.byRegion[rid]) {
        var pop = G.population.byRegion[rid];
        var amount = Math.max(0, Math.round((pop.mouths || 0) * effect.migrateShare));
        var destId = _findEnvReceivingRegion(rid);
        if (amount > 0 && destId && G.population.byRegion[destId]) {
          pop.mouths = Math.max(0, (pop.mouths || 0) - amount);
          pop.households = Math.max(0, Math.round((pop.households || 0) - amount / 5));
          pop.ding = Math.max(0, Math.round((pop.ding || 0) - amount * 0.3));
          pop.yearlyNetMigration = (pop.yearlyNetMigration || 0) - amount;
          var dst = G.population.byRegion[destId];
          dst.mouths = (dst.mouths || 0) + amount;
          dst.households = Math.round((dst.households || 0) + amount / 5);
          dst.ding = Math.round((dst.ding || 0) + amount * 0.3);
          dst.yearlyNetMigration = (dst.yearlyNetMigration || 0) + amount;
          row.migrated = amount;
          row.toRegionId = destId;
          summary.migrated += amount;
        }
      }

      if (policy.scarReduce) {
        row.scarImmediate = {};
        Object.keys(policy.scarReduce).forEach(function(sk) {
          var beforeScar = reg.ecoScars[sk] || 0;
          reg.ecoScars[sk] = Math.max(0, beforeScar - policy.scarReduce[sk] * 0.5);
          row.scarImmediate[sk] = beforeScar - reg.ecoScars[sk];
        });
      }

      if (effect.techBoost) {
        if (!reg.techLevel) reg.techLevel = {};
        Object.keys(effect.techBoost).forEach(function(k) {
          reg.techLevel[k] = (reg.techLevel[k] || 1) + effect.techBoost[k];
          summary.techBoosted += 1;
        });
        row.techBoost = Object.assign({}, effect.techBoost);
      }

      if (effect.carryingBoost) {
        reg.arableArea = (reg.arableArea || 500000) * (1 + effect.carryingBoost);
        reg.forestArea = (reg.forestArea || 500000) * (1 + effect.carryingBoost / 2);
        row.carryingBoost = effect.carryingBoost;
      }

      if (effect.arableRestore) {
        var beforeArable = reg.arableArea || 500000;
        reg.arableArea = beforeArable * (1 + effect.arableRestore);
        row.arableRestored = Math.round(reg.arableArea - beforeArable);
        summary.restored += row.arableRestored;
      }

      if (effect.soilFertilityBoost) {
        reg.soilFertility = Math.min(1.2, (reg.soilFertility || 0.85) + effect.soilFertilityBoost);
        row.soilFertilityBoost = effect.soilFertilityBoost;
      }

      if (effect.disasterRecovery) {
        var mapRegion = (G.regions || []).find(function(r) { return r && r.id === rid; });
        if (mapRegion) {
          mapRegion.disasterLevel = Math.max(0, (mapRegion.disasterLevel || 0) - effect.disasterRecovery);
          mapRegion.unrest = Math.max(0, (mapRegion.unrest || 0) - Math.round(effect.disasterRecovery * 20));
        }
        row.disasterRecovery = effect.disasterRecovery;
      }

      if (effect.loadRelief) {
        reg.currentLoad = Math.max(0.05, (reg.currentLoad || 0.5) - effect.loadRelief);
        row.loadRelief = effect.loadRelief;
      }

      _recomputeRegionCarrying(rid, reg);
      summary.regions.push(row);
    });
    _recomputeNationalCarrying();
    _pushEnvPolicyHistory({
      turn: G.turn || 0,
      policyId: policyId,
      name: policy.name,
      regionId: regionId || 'all',
      immediate: summary,
      cost: Object.assign({}, policy.cost || {})
    });
    return summary;
  }

  function enactPolicy(policyId, regionId) {
    var policy = ENV_POLICIES.find(function(p) { return p.id === policyId; });
    if (!policy) return { ok: false, reason: 'unknown policy' };
    var E = global.GM.environment;
    if (!E) return { ok: false };
    if (!Array.isArray(E.activePolicies)) E.activePolicies = [];
    if (!Array.isArray(E.policyHistory)) E.policyHistory = [];
    // 扣钱
    var cost = policy.cost || {};
    if (cost.money && global.GM.guoku && (global.GM.guoku.money || 0) < cost.money) return { ok: false, reason: '帑廪不足' };
    // 国库支出走 FiscalEngine 真账(2026-07-04 收口)
    if ((cost.money || cost.grain) && global.FiscalEngine && global.FiscalEngine.spendFromGuoku) {
      global.FiscalEngine.spendFromGuoku({ money: cost.money || 0, grain: cost.grain || 0 }, '经济政策');
    }
    var immediate = _applyPolicyImmediateEffect(policy, policyId, regionId || 'all');
    // 加入活跃政策（默认持续 24 回合，重点政策可自定）
    E.activePolicies.push({
      id: policyId, regionId: regionId || 'all',
      name: policy.name,
      startTurn: global.GM.turn || 0, duration: policy.duration || 24,
      cost: Object.assign({}, cost),
      immediate: immediate
    });
    if (global.addEB) global.addEB('环政', '推行 ' + policy.name + (regionId ? '（' + regionId + '）' : '（全国）'));
    return { ok: true, policyId: policyId, name: policy.name, regionId: regionId || 'all', immediate: immediate };
  }

  function _cleanExpiredPolicies(ctx) {
    var E = global.GM.environment;
    if (!E || !E.activePolicies) return;
    E.activePolicies = E.activePolicies.filter(function(p) {
      return (ctx.turn - p.startTurn) < p.duration;
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Ⅷ 民心/帑廪/皇威联动
  // ═══════════════════════════════════════════════════════════════════

  function _applyMinxinCoupling(mr) {
    var E = global.GM.environment;
    if (!E) return;
    var G = global.GM;
    // 全国平均疤痕
    var avgScar = 0, n = 0;
    Object.values(E.byRegion).forEach(function(r) {
      SCAR_TYPES.forEach(function(t) { avgScar += r.ecoScars[t] || 0; });
      n += SCAR_TYPES.length;
    });
    avgScar = n > 0 ? avgScar / n : 0;
    // 疤痕高 → 民心降
    if (global._adjAuthority) {
      if (avgScar > 0.5) global._adjAuthority('minxin', -(avgScar - 0.5) * 0.5 * mr);
      else if (avgScar < 0.1) {
        var _mxV = (G.minxin && typeof G.minxin === 'object' ? G.minxin.trueIndex : G.minxin) || 60;
        if (_mxV < 80) global._adjAuthority('minxin', 0.1 * mr);
      }
    }
    // 承载力不足只通过人口、地方不稳和民心反馈，不直接改写皇权。
  }

  // ═══════════════════════════════════════════════════════════════════
  //  AI 上下文
  // ═══════════════════════════════════════════════════════════════════

  function getAIContext() {
    var E = global.GM && global.GM.environment;
    if (!E) return '';
    var lines = ['【环境承载力】'];
    lines.push('全国加载比：' + (E.nationalLoad * 100).toFixed(0) + '% · 气候：' + E.climatePhase);
    // 严重疤痕
    var worstScars = [];
    Object.keys(E.byRegion).forEach(function(rid) {
      var reg = E.byRegion[rid];
      SCAR_TYPES.forEach(function(t) {
        if (reg.ecoScars[t] > 0.5) {
          worstScars.push(rid + ' ' + SCAR_LABELS[t] + ' ' + (reg.ecoScars[t]*100).toFixed(0) + '%');
        }
      });
    });
    if (worstScars.length > 0) lines.push('严重疤痕：' + worstScars.slice(0, 5).join('；'));
    if (E.crisisHistory.length > 0) {
      var recent = E.crisisHistory.filter(function(c) { return (global.GM.turn || 0) - c.turn < ((typeof global.turnsForMonths === 'function') ? global.turnsForMonths(24) : 24); });
      if (recent.length > 0) lines.push('近年危机：' + recent.map(function(c) { return c.name; }).join('、'));
    }
    if (E.activePolicies.length > 0) {
      lines.push('在行环政：' + E.activePolicies.map(function(p) { var pp = ENV_POLICIES.find(function(x){return x.id===p.id;}); return pp ? pp.name : p.id; }).join('、'));
    }
    return lines.join('\n');
  }

  // ═══════════════════════════════════════════════════════════════════
  //  主 tick
  // ═══════════════════════════════════════════════════════════════════

  function tick(ctx) {
    ctx = ctx || {};
    if (!global.GM || !global.GM.environment) {
      var sc = (typeof global.findScenarioById === 'function') ? global.findScenarioById(global.GM.sid) : null;
      init(sc);
    }
    var mr = ctx.monthRatio || 1;
    try { _tickScarAccumulation(ctx, mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'env] scars:') : console.error('[env] scars:', e); }
    try { _tickOverloadFeedback(ctx, mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'env] overload:') : console.error('[env] overload:', e); }
    try { _tickCrisisEvents(ctx, mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'env] crises:') : console.error('[env] crises:', e); }
    try { _cleanExpiredPolicies(ctx); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-env-capacity-engine');}catch(_){}}
    try { _applyMinxinCoupling(mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'env] minxin:') : console.error('[env] minxin:', e); }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  导出
  // ═══════════════════════════════════════════════════════════════════

  global.EnvCapacityEngine = {
    init: init,
    tick: tick,
    enactPolicy: enactPolicy,
    getAIContext: getAIContext,
    SCAR_TYPES: SCAR_TYPES,
    SCAR_LABELS: SCAR_LABELS,
    CRISIS_EVENTS: CRISIS_EVENTS,
    TECH_TIERS: TECH_TIERS,
    ENV_POLICIES: ENV_POLICIES,
    VERSION: 1
  };

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));

// ───────────────────────────────────────────
// §D·EconomyLinkage (from tm-economy-linkage.js)
// ───────────────────────────────────────────
(function(global) {
  'use strict';

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function safe(v, d) { return (v === undefined || v === null) ? (d || 0) : v; }
  function getMonthRatio() {
    if (typeof _getDaysPerTurn === 'function') return _getDaysPerTurn() / 30;
    return 1;
  }

  // ═════════════════════════════════════════════════════════════
  // 1. 百姓负担层层剥夺模型
  // 设计 §A：peasantActual = nominal × (1 + Σ各级加派)
  // ═════════════════════════════════════════════════════════════

  function ensurePeasantBurden(regionId) {
    if (!GM.fiscal) GM.fiscal = {};
    if (!GM.fiscal.peasantBurden) GM.fiscal.peasantBurden = {};
    if (!GM.fiscal.peasantBurden[regionId]) {
      GM.fiscal.peasantBurden[regionId] = {
        regionId: regionId,
        nominal: 0,
        levyLevels: {
          county:    0,   // 县级加派
          prefecture:0,   // 府级加派
          province:  0,   // 路省级加派
          landlord:  0,   // 豪强吞没
          converter: 0    // 折纳价差
        },
        peasantActual: 0,      // 民间实际负担
        officialReceived: 0,   // 官府实收
        pocketedByLocal: 0,    // 胥吏私肥
        pocketedByLandlord: 0,
        pocketedByConverter: 0
      };
    }
    return GM.fiscal.peasantBurden[regionId];
  }

  function calcPeasantBurden(regionId, nominalTax, mr) {
    mr = mr || 1;
    var b = ensurePeasantBurden(regionId);
    b.nominal = nominalTax;

    // 各级加派率（来自腐败）
    var provincialCorr = safe((GM.corruption && GM.corruption.subDepts.provincial || {}).true, 0);
    var fiscalCorr = safe((GM.corruption && GM.corruption.subDepts.fiscal || {}).true, 0);

    // 层层剥夺率
    var countyLevy     = (provincialCorr / 100) * 0.08 + (GM.fiscal.floatingCollectionRate || 0) * 0.3;
    var prefectureLevy = (provincialCorr / 100) * 0.05;
    var provinceLevy   = (fiscalCorr / 100) * 0.06;
    var landlordCut    = safe((GM.minxin && GM.minxin.byClass && GM.minxin.byClass.haoqiang || {}).size, 0.01) * 4;  // 豪强比例影响
    var converterLoss  = (fiscalCorr / 100) * 0.04;  // 折纳价差

    b.levyLevels.county = countyLevy;
    b.levyLevels.prefecture = prefectureLevy;
    b.levyLevels.province = provinceLevy;
    b.levyLevels.landlord = landlordCut;
    b.levyLevels.converter = converterLoss;

    // 民间实缴 = 名义 × (1 + Σ)
    var totalLevy = countyLevy + prefectureLevy + provinceLevy + landlordCut + converterLoss;
    b.peasantActual = nominalTax * (1 + totalLevy);

    // 官府实收 = 名义 × (1 - 实征漏损)
    var leakage = (provincialCorr + fiscalCorr) / 200 * 0.5;
    b.officialReceived = nominalTax * (1 - leakage);

    // 分配被剥夺部分
    var totalPocket = b.peasantActual - b.officialReceived;
    b.pocketedByLocal = totalPocket * (countyLevy + prefectureLevy + provinceLevy) / Math.max(totalLevy, 0.01) * 0.8;
    b.pocketedByLandlord = totalPocket * landlordCut / Math.max(totalLevy, 0.01);
    b.pocketedByConverter = totalPocket * converterLoss / Math.max(totalLevy, 0.01);

    return b;
  }

  // ═════════════════════════════════════════════════════════════
  // 2. 区域财政树（region.fiscal）
  // ═════════════════════════════════════════════════════════════

  function ensureRegionFiscal(regionId) {
    if (!GM.regions) GM.regions = {};
    if (!GM.regions[regionId]) GM.regions[regionId] = {};
    var r = GM.regions[regionId];
    if (!r.fiscal) r.fiscal = {
      ledgers: {
        money: { stock: 0, lastIn: 0, lastOut: 0 },
        grain: { stock: 0, lastIn: 0, lastOut: 0 }
      },
      allocation: {
        localRetain: 0.3,    // 本级留存比
        upToParent: 0.3,     // 上供父级
        upToCenter: 0.4      // 上供中央（央地系统可覆盖）
      },
      fixed:    [],   // 固定扣项（俸禄/守军/驿站）
      discretionary: 0,  // 地方可自主支出
      imperial: [],   // 央令指派（诏修工程）
      illicit:  0,    // 挪用（入地方官 char）
      parentId: null  // 父级区域
    };
    if (!r.publicTreasury) r.publicTreasury = {
      balance: 0, handoverLog: [], handoverDeficit: 0
    };
    return r;
  }

  function allocateRegionTax(regionId, nominalTax, mr) {
    mr = mr || 1;
    var r = ensureRegionFiscal(regionId);
    var b = calcPeasantBurden(regionId, nominalTax, mr);
    var officialReceived = b.officialReceived;

    var alloc = r.fiscal.allocation;
    var localAmt  = officialReceived * alloc.localRetain;
    var parentAmt = officialReceived * alloc.upToParent;
    var centerAmt = officialReceived * alloc.upToCenter;

    // 本级入账
    r.fiscal.ledgers.money.stock += localAmt;
    r.fiscal.ledgers.money.lastIn = localAmt;

    // 公库也更新
    r.publicTreasury.balance = r.fiscal.ledgers.money.stock;

    // 上供父级
    if (parentAmt > 0 && r.fiscal.parentId) {
      var parent = ensureRegionFiscal(r.fiscal.parentId);
      parent.fiscal.ledgers.money.stock += parentAmt;
    }

    // 上供中央（依皇权可支配性 × 皇威乘数）
    if (centerAmt > 0 && GM.guoku) {
      var h = (GM.huangquan || {}).index || 50;
      var complianceMult = h < 35 ? 0.5 :
                           h < 60 ? 0.85 : 1.0;
      if (typeof FiscalEngine !== 'undefined' && FiscalEngine.addToGuoku) FiscalEngine.addToGuoku({ money: centerAmt * complianceMult }, '央解入库'); // 收口·走真账
    }

    // 记录"挪用流"到 illicit
    r.fiscal.illicit += b.pocketedByLocal * mr;

    return { localAmt: localAmt, parentAmt: parentAmt, centerAmt: centerAmt };
  }

  // ═════════════════════════════════════════════════════════════
  // 3. 下拨生命周期（transferOrder）
  // ═════════════════════════════════════════════════════════════

  function ensureTransferOrderState() {
    if (!GM.transferOrders) GM.transferOrders = [];
  }

  // 玩家诏令 / AI 建议 创建下拨
  function createTransferOrder(spec) {
    ensureTransferOrderState();
    var order = {
      id: 'to_' + GM.turn + '_' + Math.random().toString(36).slice(2, 6),
      fromAccount: spec.fromAccount || 'guoku.money',
      toRegion:    spec.toRegion || null,
      toAccount:   spec.toAccount || 'regional',
      amount:      spec.amount || 0,
      purpose:     spec.purpose || '赈济',
      status:      'pending',
      createTurn:  GM.turn,
      startTurn:   GM.turn + 1,
      expectedEndTurn: GM.turn + ((typeof global.turnsForMonths === 'function') ? global.turnsForMonths(spec.durationMonths || 3) : Math.max(1, Math.floor(spec.durationMonths || 3))),
      deliveredAmount: 0,
      lossRate:    0  // 运输损耗
    };
    GM.transferOrders.push(order);

    // 立即扣源
    if (order.fromAccount === 'guoku.money' && GM.guoku) {
      if (GM.guoku.balance < order.amount) {
        order.status = 'failed';
        order.failReason = '帑廪不足';
        return { success: false, reason: '帑廪不足' };
      }
      if (typeof FiscalEngine !== 'undefined' && FiscalEngine.spendFromGuoku) FiscalEngine.spendFromGuoku({ money: order.amount }, '银钱调度'); // 收口·走真账
    } else if (order.fromAccount === 'neitang.money' && GM.neitang) {
      if (GM.neitang.balance < order.amount) {
        order.status = 'failed';
        order.failReason = '内帑不足';
        return { success: false, reason: '内帑不足' };
      }
      if (typeof FiscalEngine !== 'undefined' && FiscalEngine.spendFromNeitang) FiscalEngine.spendFromNeitang({ money: order.amount }, '银钱调度'); // 收口·走真账
      else GM.neitang.balance -= order.amount; // 沙箱兜底
    }
    return { success: true, order: order };
  }

  function processTransferOrders(mr) {
    ensureTransferOrderState();
    var active = GM.transferOrders.filter(function(o) { return o.status === 'pending' || o.status === 'transit'; });
    active.forEach(function(o) {
      if (GM.turn < o.startTurn) {
        o.status = 'pending';
        return;
      }
      o.status = 'transit';

      // 按期发放（每回合一份）
      var totalTurns = Math.max(1, o.expectedEndTurn - o.startTurn);
      var perTurn = o.amount / totalTurns;
      // 运输损耗（腐败 + 距离）
      var corruptionLoss = safe((GM.corruption && GM.corruption.subDepts.provincial || {}).true, 0) / 100 * 0.15;
      var thisDelivery = perTurn * (1 - corruptionLoss);

      // 交付到目标
      if (o.toRegion) {
        var r = ensureRegionFiscal(o.toRegion);
        r.fiscal.ledgers.money.stock += thisDelivery;
        r.publicTreasury.balance = r.fiscal.ledgers.money.stock;
      }
      o.deliveredAmount += thisDelivery;
      o.lossRate = corruptionLoss;

      if (GM.turn >= o.expectedEndTurn) {
        o.status = 'completed';
        if (typeof addEB === 'function') {
          addEB('朝代', '拨银毕：' + o.purpose + '（' + Math.round(o.deliveredAmount / 10000) + ' 万两）',
            { credibility: 'high' });
        }
      }
    });

    // 清理超老的 completed/failed（保留最近 30）
    var completed = GM.transferOrders.filter(function(o) { return o.status === 'completed' || o.status === 'failed'; });
    if (completed.length > 30) {
      GM.transferOrders = GM.transferOrders.filter(function(o) { return o.status !== 'completed' && o.status !== 'failed'; })
        .concat(completed.slice(-30));
    }
  }

  // ═════════════════════════════════════════════════════════════
  // 4. 俸禄流（财政 → 角色）
  // ═════════════════════════════════════════════════════════════

  function paySalariesToOfficials(mr) {
    var chars = GM.chars || [];
    var totalPaid = 0;
    chars.forEach(function(ch) {
      if (!ch.officialTitle || ch.retired || ch.dead) return;
      if (typeof CharEconEngine === 'undefined') return;
      try {
        var salary = CharEconEngine.Income.salary(ch) * mr;
        if (salary <= 0) return;
        // 从对应账户扣款
        // 中央官 → 帑廪；地方官 → 地方 fiscal；皇室 → 内帑
        var paid = false;
        if (ch.department === 'imperial' && GM.neitang) {
          if (GM.neitang.balance >= salary) {
            if (typeof FiscalEngine !== 'undefined' && FiscalEngine.spendFromNeitang) FiscalEngine.spendFromNeitang({ money: salary }, '俸禄'); // 收口·走真账
            else GM.neitang.balance -= salary; // 沙箱兜底
            paid = true;
          }
        } else if (ch.currentRegion && GM.regions && GM.regions[ch.currentRegion]) {
          // 地方官从地方留存出
          var r = GM.regions[ch.currentRegion];
          if (r.fiscal && r.fiscal.ledgers.money.stock >= salary) {
            r.fiscal.ledgers.money.stock -= salary;
            r.publicTreasury.balance = r.fiscal.ledgers.money.stock;
            paid = true;
          }
        }
        if (!paid && GM.guoku && GM.guoku.balance >= salary) {
          // 俸禄双扣修(2026-07-04 审查定罪)：FixedExpense 本回合已按 officeTree 编制从国库总扣过「俸禄」——
          // 此处只记「发放到人」不再二次出账；FixedExpense 未跑的场合才走真账兜底。
          if (GM._lastFixedExpenseTurn !== GM.turn) {
            if (typeof FiscalEngine !== 'undefined' && FiscalEngine.spendFromGuoku) FiscalEngine.spendFromGuoku({ money: salary }, '俸禄'); // 收口·走真账
          }
          paid = true;
        }
        if (paid) {
          CharEconEngine.paySalary(ch, salary);
          totalPaid += salary;
        } else {
          // 欠饷 → 压力 + 腐败倾向
          ch.stress = Math.min(100, (ch.stress || 20) + 2 * mr);
          ch._unpaidMonths = (ch._unpaidMonths || 0) + mr;
          // 欠 3+ 月 → integrity 下降（被迫贪）
          if (ch._unpaidMonths > 3) {
            ch.integrity = Math.max(0, (ch.integrity || 50) - 0.5 * mr);
          }
        }
      } catch(e) {
        console.error('[linkage] paySalary:', ch.name, e);
      }
    });
    if (!GM._linkageStats) GM._linkageStats = {};
    GM._linkageStats.lastSalariesPaid = totalPaid;
  }

  // ═════════════════════════════════════════════════════════════
  // 5. 贪腐流（腐败 → 角色）
  // 在腐败 tick 后，按部门腐败强度推送 illicit 收入到相关角色
  // ═════════════════════════════════════════════════════════════

  function distributeIllicitIncome(mr) {
    if (typeof CharEconEngine === 'undefined') return;
    if (!GM.corruption) return;
    var chars = GM.chars || [];
    chars.forEach(function(ch) {
      if (!ch.officialTitle || ch.retired || ch.dead) return;
      if ((ch.integrity || 50) > 65) return;  // 清官不贪
      try {
        // 从 Income.bribes + Income.embezzle 已在 CharEconEngine 中执行
        // 这里额外添加"地方挪用"流：地方 fiscal.illicit → 地方官
        if (ch.currentRegion && GM.regions && GM.regions[ch.currentRegion]) {
          var r = GM.regions[ch.currentRegion];
          if (r.fiscal && r.fiscal.illicit > 0) {
            var share = r.fiscal.illicit * 0.1 * mr;  // 10% 本月入本官腰包
            if (share > 0) {
              CharEconEngine.addBribeIncome(ch, share, 0.5);
              r.fiscal.illicit -= share;
            }
          }
        }
      } catch(e) {
        console.error('[linkage] illicit:', ch.name, e);
      }
    });
  }

  // ═════════════════════════════════════════════════════════════
  // 6. 抄家触发（从肃贪 / 诛事件）
  // ═════════════════════════════════════════════════════════════

  function triggerConfiscationByName(charName, destination, intensity) {
    var ch = (GM.chars || []).find(function(c) { return c.name === charName; });
    if (!ch) return { success: false, reason: '无此人' };
    if (typeof CharEconEngine === 'undefined') return { success: false, reason: '引擎未就绪' };
    return CharEconEngine.confiscate(ch, {
      destination: destination || 'neitang',
      intensity: intensity !== undefined ? intensity : 0.6,
      includeClan: (intensity || 0) > 0.7
    });
  }

  // ═════════════════════════════════════════════════════════════
  // 7. 事件总线扩展（经济事件）
  // ═════════════════════════════════════════════════════════════

  var EconomyEventBus = {
    _listeners: {},
    on: function(type, handler) {
      if (!this._listeners[type]) this._listeners[type] = [];
      this._listeners[type].push(handler);
    },
    emit: function(type, data) {
      (this._listeners[type] || []).forEach(function(h) {
        try { h(data); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'EventBus') : console.error('[EventBus]', type, e); }
      });
    }
  };

  // 预定义事件类型：
  // - qianhuang (钱荒)
  // - confiscation (抄家)
  // - bankruptcy (破产)
  // - reformEnacted (改革颁行)
  // - peasantRevolt (民变)
  // - royalClanBankruptcy (宗室崩溃)

  // ═════════════════════════════════════════════════════════════
  // 8. 主 tick（每回合调用）
  // ═════════════════════════════════════════════════════════════

  function tick(context) {
    var mr = (context && context._monthRatio) || getMonthRatio();
    if (context) context._linkageMonthRatio = mr;

    // 按区域分账（对接财政）
    try {
      // 若有 mapData，按城市/区域分账
      var regions = [];
      if (GM.mapData && GM.mapData.cities) {
        regions = Object.keys(GM.mapData.cities).map(function(id) {
          return { id: id, population: GM.mapData.cities[id].population || 10000 };
        });
      }
      if (regions.length > 0 && GM.guoku) {
        var totalPop = regions.reduce(function(s, r) { return s + r.population; }, 0) || 1;
        var monthlyNominal = (GM.guoku.annualIncome || 1e6) / 12;
        regions.forEach(function(reg) {
          var share = reg.population / totalPop;
          allocateRegionTax(reg.id, monthlyNominal * share, mr);
        });
      }
    } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'linkage] regionAllocation:') : console.error('[linkage] regionAllocation:', e); }

    // 发俸禄
    try { paySalariesToOfficials(mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'linkage] salaries:') : console.error('[linkage] salaries:', e); }

    // 贪腐分配
    try { distributeIllicitIncome(mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'linkage] illicit:') : console.error('[linkage] illicit:', e); }

    // 下拨单进度
    try { processTransferOrders(mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'linkage] transfers:') : console.error('[linkage] transfers:', e); }

    // 民心反馈（基于 peasantBurden 聚合）
    try { applyBurdenToMinxin(mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'linkage] burdenMinxin:') : console.error('[linkage] burdenMinxin:', e); }
  }

  // 民心受百姓负担影响
  function applyBurdenToMinxin(mr) {
    if (!GM.minxin || !GM.fiscal || !GM.fiscal.peasantBurden) return;
    var burdens = Object.values(GM.fiscal.peasantBurden);
    if (burdens.length === 0) return;
    // 平均加派率
    var avgLevy = 0;
    burdens.forEach(function(b) {
      var total = (b.levyLevels.county || 0) + (b.levyLevels.prefecture || 0) +
                  (b.levyLevels.province || 0) + (b.levyLevels.landlord || 0) +
                  (b.levyLevels.converter || 0);
      avgLevy += total;
    });
    avgLevy /= burdens.length;

    // 加派 > 0.3 开始显著扣民心·走 MinxinLedger 总闸(2026-07-04 收口·直写 trueIndex 会被 aggregateTrue 冲掉)
    if (avgLevy > 0.3 && typeof TM !== 'undefined' && TM.MinxinLedger && TM.MinxinLedger.recordAndApply) {
      var impact = -(avgLevy - 0.3) * 4 * mr;
      try { TM.MinxinLedger.recordAndApply(GM, { sourceSystem: 'economy-engine', kind: 'taxation', delta: impact, reason: '加派沉重·民力困竭' }); } catch (_e) {}
    }
  }

  // ═════════════════════════════════════════════════════════════
  // 导出
  // ═════════════════════════════════════════════════════════════

  global.EconomyLinkage = {
    tick: tick,
    ensurePeasantBurden: ensurePeasantBurden,
    calcPeasantBurden: calcPeasantBurden,
    ensureRegionFiscal: ensureRegionFiscal,
    allocateRegionTax: allocateRegionTax,
    createTransferOrder: createTransferOrder,
    processTransferOrders: processTransferOrders,
    paySalariesToOfficials: paySalariesToOfficials,
    distributeIllicitIncome: distributeIllicitIncome,
    triggerConfiscationByName: triggerConfiscationByName,
    applyBurdenToMinxin: applyBurdenToMinxin,
    EventBus: EconomyEventBus
  };

  // 全局事件总线（其他系统也可用）
  global.EconomyEventBus = EconomyEventBus;

  console.log('[econLinkage] 已加载：层层剥夺+区域财政树+下拨生命周期+俸禄流+贪腐流+抄家触发+事件总线');

})(typeof window !== 'undefined' ? window : this);

// ───────────────────────────────────────────
// §E·EconomyGapFill (from tm-economy-gap-fill.js)
// ───────────────────────────────────────────
(function(global) {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════
  // #2 · 19 种原子税种注册表
  // ═══════════════════════════════════════════════════════════════════

  var ATOMIC_TAX_TYPES = {
    // 田赋类
    land_grain:    { name:'田赋粮', base:'farmland',   unit:'grain', defaultRate:0.10, category:'land' },
    land_money:    { name:'田赋钱', base:'farmland',   unit:'money', defaultRate:0.05, category:'land' },
    // 人口类
    head_tax:      { name:'人头税', base:'population', unit:'money', defaultRate:0.02, category:'head' },
    labor_service: { name:'徭役',   base:'population', unit:'labor', defaultRate:0.05, category:'head' },
    // 专卖类
    salt:          { name:'盐课',   base:'population', unit:'money', defaultRate:0.03, category:'monopoly' },
    iron:          { name:'铁课',   base:'trade',      unit:'money', defaultRate:0.02, category:'monopoly' },
    tea:           { name:'茶课',   base:'trade',      unit:'money', defaultRate:0.015, category:'monopoly' },
    wine:          { name:'酒课',   base:'trade',      unit:'money', defaultRate:0.02, category:'monopoly' },
    // 商税类
    commerce:      { name:'商税',   base:'tradeVolume',unit:'money', defaultRate:0.03, category:'commerce' },
    transit:       { name:'过关税', base:'tradeVolume',unit:'money', defaultRate:0.02, category:'commerce' },
    import_export: { name:'市舶',   base:'tradeVolume',unit:'money', defaultRate:0.05, category:'commerce', dynasties:['宋','元','明','清'] },
    // 政府类
    mint_seigniorage: { name:'铸币利润', base:'mint',  unit:'money', defaultRate:0,    category:'gov' },
    monopoly_profit:  { name:'专卖利润', base:'monopoly',unit:'money',defaultRate:0,    category:'gov' },
    // 特殊
    office_sale:   { name:'捐纳',    base:'event',     unit:'money', defaultRate:0,    category:'special' },
    confiscation:  { name:'抄家',    base:'event',     unit:'money', defaultRate:0,    category:'special' },
    tribute:       { name:'朝贡',    base:'event',     unit:'mixed', defaultRate:0,    category:'special' },
    military_levy: { name:'军粮征发',base:'event',     unit:'grain', defaultRate:0,    category:'special' },
    special_exaction:  { name:'特别加派', base:'farmland', unit:'money',defaultRate:0, category:'special' },
    disaster_levy: { name:'灾害特赋',base:'farmland',  unit:'money', defaultRate:0,    category:'special' }
  };

  /** 按朝代过滤可用税种 */
  function getAvailableTaxTypes(dynasty) {
    var out = [];
    Object.keys(ATOMIC_TAX_TYPES).forEach(function(id) {
      var t = ATOMIC_TAX_TYPES[id];
      if (t.dynasties && t.dynasties.indexOf(dynasty) < 0) return;
      out.push(Object.assign({ id: id }, t));
    });
    return out;
  }

  /** 计算单税种应征额 */
  function calculateTaxRevenue(taxId, regionCtx) {
    var t = ATOMIC_TAX_TYPES[taxId];
    if (!t) return 0;
    var base = 0;
    if (t.base === 'farmland') base = regionCtx.farmland || 1000000;
    else if (t.base === 'population') base = regionCtx.population || 100000;
    else if (t.base === 'trade' || t.base === 'tradeVolume') base = regionCtx.tradeVolume || 50000;
    else if (t.base === 'mint') return (regionCtx.mintSeigniorage || 0);
    else if (t.base === 'monopoly') return (regionCtx.monopolyProfit || 0);
    else return 0;
    return base * (regionCtx.rateOverride || t.defaultRate);
  }

  // ═══════════════════════════════════════════════════════════════════
  // #1 · 购买力系数传播（API 供各引擎调用）
  // ═══════════════════════════════════════════════════════════════════

  /** 返回当前主币的实际购买力系数（1.0 = 正常，<1 = 通胀/成色降级）*/
  function getPurchasingPower(coinType) {
    var C = global.GM && global.GM.currency;
    if (!C) return 1.0;
    coinType = coinType || (C.currentStandard && C.currentStandard.indexOf('silver') >= 0 ? 'silver' : 'copper');
    var l = C.coins[coinType];
    if (!l) return 1.0;
    var base = l.purchasingPowerFactor || 1.0;
    // 叠加通胀因子
    var inflation = (C.market && C.market.inflation) || 0;
    var factor = base / (1 + inflation);
    return Math.max(0.1, Math.min(2.0, factor));
  }

  /** 将名义金额换算为实际购买力 */
  function getRealValue(nominal, coinType) {
    return (nominal || 0) * getPurchasingPower(coinType);
  }

  /** 将实际购买力换算为名义金额（用于俸禄按真实需求发放）*/
  function fromRealValue(real, coinType) {
    var pp = getPurchasingPower(coinType);
    return pp > 0 ? (real / pp) : real;
  }

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

  function _getRegionsArray(source) {
    source = source || {};
    if (global.IntegrationBridge && typeof global.IntegrationBridge.getDivisionArray === 'function') {
      var bridged = global.IntegrationBridge.getDivisionArray(source);
      if (bridged && bridged.length) return bridged;
    }
    if (Array.isArray(source.regions)) return source.regions;
    if (source.regions && typeof source.regions === 'object') return Object.values(source.regions);
    if (source.adminHierarchy && typeof source.adminHierarchy === 'object') {
      var out = [];
      Object.keys(source.adminHierarchy).forEach(function(key) {
        var tree = source.adminHierarchy[key];
        if (Array.isArray(tree)) _flattenDivisions(tree, out);
        else if (tree && Array.isArray(tree.divisions)) _flattenDivisions(tree.divisions, out);
        else if (tree && Array.isArray(tree.children)) _flattenDivisions(tree.children, out);
      });
      return out;
    }
    return [];
  }

  // ═══════════════════════════════════════════════════════════════════
  // #3 · 地域币值每回合动态（纸币接受度）
  // ═══════════════════════════════════════════════════════════════════

  function tickRegionalAcceptance(ctx, mr) {
    var C = global.GM && global.GM.currency;
    if (!C || !C.paper || !C.paper.issuances) return;
    C.paper.issuances.forEach(function(iss) {
      if (iss.state === 'abolish' || iss.state === 'collapse') return;
      var byReg = iss.acceptanceByRegion || (iss.acceptanceByRegion = {});
      // 对每个区域微调
      var regions = _getRegionsArray(global.GM);
      regions.forEach(function(reg) {
        if (!reg || !reg.id) return;
        var a = byReg[reg.id];
        if (a === undefined) a = (reg.id === (global.GM._capital || '京城')) ? 1.0 : 0.7;
        // 纸币状态坏 → 接受度降；准备金高 → 升
        if (iss.state === 'depreciate') a -= 0.02 * mr;
        else if (iss.state === 'overissue') a -= 0.01 * mr;
        else if (iss.reserveRatio > 0.3) a += 0.005 * mr;
        // 距京师远近（用 region.distanceFromCapital 若有）
        if (reg.distanceFromCapital > 2000) a -= 0.002 * mr;
        // unrest/战乱拒用
        if (reg.unrest > 70) a -= 0.01 * mr;
        byReg[reg.id] = Math.max(0, Math.min(1, a));
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // #4 · 地域价差套利（商贸流）
  // ═══════════════════════════════════════════════════════════════════

  function tickTradeArbitrage(ctx, mr) {
    var C = global.GM && global.GM.currency;
    if (!C || !C.market) return;
    var regions = _getRegionsArray(global.GM);
    if (!regions || !Array.isArray(regions) || regions.length < 2) return;
    // 每区生成本地粮价（若无）
    var rp = C.market.regionalPrices || (C.market.regionalPrices = {});
    regions.forEach(function(r) {
      if (!r || !r.id) return;
      if (!rp[r.id]) rp[r.id] = { grain: C.market.grainPrice, cloth: C.market.clothPrice, salt: C.market.saltPrice, iron: C.market.ironPrice, coinPremium: { gold:1.0, silver:1.0, copper:1.0, iron:1.0, paper:1.0 } };
      // 本地价格浮动（年景 × 灾害 × 军需）
      var local = rp[r.id];
      var localFactor = 1.0;
      if (r.disasterLevel > 0.2) localFactor *= (1 + r.disasterLevel * 0.5);
      if (r.unrest > 60) localFactor *= 1.1;
      if (r.warThreat > 0.3) localFactor *= (1 + r.warThreat * 0.3);
      if (r.grainSurplus > 0) localFactor *= 0.9; // 丰产地
      local.grain = C.market.grainPrice * localFactor;
    });
    // 两区套利（简化：价差 > 成本 → 流）
    if (regions.length > 10) return; // 大规模场景简化跳过
    for (var i = 0; i < regions.length; i++) {
      for (var j = i + 1; j < regions.length; j++) {
        var r1 = regions[i], r2 = regions[j];
        if (!rp[r1.id] || !rp[r2.id]) continue;
        var p1 = rp[r1.id].grain, p2 = rp[r2.id].grain;
        var gap = Math.abs(p2 - p1);
        var transportCost = (50 + (r1.distance && r2.distance ? Math.abs(r1.distance - r2.distance) * 0.1 : 20)) * (1 + (r1.banditry || 0));
        if (gap > transportCost * 2) {
          // 商贸自动流动：低价→高价
          var flowFactor = (gap - transportCost) / gap * 0.05 * mr;
          var src = p1 < p2 ? r1 : r2;
          var dst = p1 < p2 ? r2 : r1;
          // 价差缩窄
          rp[src.id].grain = p1 < p2 ? p1 + gap * 0.02 * mr : p2 + gap * 0.02 * mr;
          rp[dst.id].grain = p1 < p2 ? p2 - gap * 0.02 * mr : p1 - gap * 0.02 * mr;
          // 商税入帑廪
          if (global.FiscalEngine && global.FiscalEngine.addToGuoku) {
            var tax = flowFactor * 100;
            global.FiscalEngine.addToGuoku({ money: tax }, '商税'); // 收口·走真账
          }
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // #5 · 四层自适应递归生成
  // ═══════════════════════════════════════════════════════════════════

  function buildHierarchyFromAdminDepth(sc) {
    if (!sc) return null;
    var depth = (sc.adminHierarchy && sc.adminHierarchy.depth) || 3;
    var levelNames = (sc.adminHierarchy && sc.adminHierarchy.levelNames) || ['道','州','县'];
    var regions = _getRegionsArray(sc);
    if (!regions.length && global.GM) regions = _getRegionsArray(global.GM);
    // 建立 id → level 映射
    var byId = {};
    regions.forEach(function(r) { if (r && r.id) byId[r.id] = r; });
    // 递归补 level
    regions.forEach(function(r) {
      if (r.level === undefined) {
        var lv = 0;
        var cur = r;
        while (cur && cur.parentId && byId[cur.parentId]) {
          lv++;
          cur = byId[cur.parentId];
          if (lv > 6) break;
        }
        r.level = lv;
      }
    });
    return { depth: depth, levelNames: levelNames, byId: byId };
  }

  // ═══════════════════════════════════════════════════════════════════
  // #6 · 封建财政 5 类完整实现
  // ═══════════════════════════════════════════════════════════════════

  function _isYearBoundaryTurn(turn) {
    if (typeof global.isYearBoundary === 'function') return global.isYearBoundary(turn);
    var dpv = (typeof global._getDaysPerTurn === 'function') ? global._getDaysPerTurn() : 30;
    if (dpv >= 365) return true;
    turn = Number(turn || 0);
    return turn > 0 && Math.floor(turn * dpv / 365) > Math.floor((turn - 1) * dpv / 365);
  }

  function _yearFromTurn(turn) {
    if (typeof global.calcDateFromTurn === 'function') return global.calcDateFromTurn(turn || 1).adYear;
    if (typeof global.getCurrentYear === 'function') return global.getCurrentYear();
    var dpv = (typeof global._getDaysPerTurn === 'function') ? global._getDaysPerTurn() : 30;
    var baseYear = (global.P && global.P.time && typeof global.P.time.year === 'number') ? global.P.time.year : 0;
    return baseYear + Math.floor(((turn || 1) - 1) * dpv / 365);
  }

  var FEUDAL_TYPES = {
    vassal_prince: {
      name: '诸侯王',
      description: '汉初分封王国，自有军队、财政，可铸钱',
      rules: {
        centralShare: 0.10,     // 上缴中央比例
        canMintCoin: true,
        canRaiseArmy: true,
        autonomyLevel: 0.75,
        inheritable: true,
        reducesBy: 'tuien_ling'  // 推恩令削弱
      },
      tick: function(holding, mr) {
        var annual = (holding.annualRevenue || 100000) * mr / 12;
        // 中央只拿 10%
        if (global.FiscalEngine && global.FiscalEngine.addToGuoku) global.FiscalEngine.addToGuoku({ money: annual * 0.10 }, '庄田央解'); // 收口·走真账
        // 其余入王府
        holding.vassalWealth = (holding.vassalWealth || 0) + annual * 0.90;
      }
    },
    tusi: {
      name: '土司',
      description: '西南世袭土官，朝贡代税',
      rules: {
        centralShare: 0.05,
        tributeAnnual: true,
        canMintCoin: false,
        canRaiseArmy: true,
        autonomyLevel: 0.85,
        inheritable: true,
        reducesBy: 'gaitu_guiliu'
      },
      tick: function(holding, mr) {
        var tribute = (holding.tributeValue || 20000) * mr / 12;
        if (global.FiscalEngine && global.FiscalEngine.addToGuoku) {
          global.FiscalEngine.addToGuoku({ money: tribute * 0.3, grain: tribute * 0.5 }, '藩贡'); // 收口·走真账
        }
      }
    },
    fan_vassal: {
      name: '外藩',
      description: '朝鲜/越南/琉球等属国，仅朝贡',
      rules: {
        centralShare: 0,
        tributeAnnual: true,
        canMintCoin: true,
        canRaiseArmy: true,
        autonomyLevel: 1.0,
        inheritable: true
      },
      tick: function(holding, mr) {
        // 一年一贡
        if (!_isYearBoundaryTurn(global.GM.turn || 0)) return;
        var tribute = holding.tributeValue || 50000;
        if (global.FiscalEngine && global.FiscalEngine.addToGuoku) global.FiscalEngine.addToGuoku({ money: tribute }, '外藩年贡'); // 收口·走真账
        if (global.addEB) global.addEB('外藩', (holding.name || '外藩') + ' 来朝进贡 ' + tribute + ' 两');
      }
    },
    religious: {
      name: '寺院庄园',
      description: '佛寺道观免税产业',
      rules: {
        centralShare: 0,
        taxExempt: true,
        canMintCoin: false,
        canRaiseArmy: false,
        autonomyLevel: 0.5,
        inheritable: false,
        reducesBy: 'huichang_miefo' // 会昌灭佛
      },
      tick: function(holding, mr) {
        holding.templeWealth = (holding.templeWealth || 0) + (holding.annualRevenue || 30000) * mr / 12;
        // 过度积累 → 朝廷警觉
        if (holding.templeWealth > 5000000) {
          holding._triggered = true;
        }
      }
    },
    fief: {
      name: '食邑',
      description: '功臣食邑，按户赐予',
      rules: {
        centralShare: 0.80,    // 大部分仍归中央
        taxExempt: false,      // 税依然交，只是税后分一部分给受封者
        canMintCoin: false,
        canRaiseArmy: false,
        autonomyLevel: 0.1,
        inheritable: true
      },
      tick: function(holding, mr) {
        var revenue = (holding.householdCount || 1000) * 2 * mr / 12; // 每户每年 2 两
        if (global.FiscalEngine && global.FiscalEngine.addToGuoku) global.FiscalEngine.addToGuoku({ money: revenue * 0.8 }, '食邑税入'); // 收口·走真账
        // 受封者所得——记入角色 privateWealth
        if (holding.holderName && global.GM.chars) {
          var ch = global.GM.chars.find(function(c) { return c.name === holding.holderName; });
          if (ch && ch.resources && ch.resources.privateWealth) {
            ch.resources.privateWealth.cash = (ch.resources.privateWealth.cash || 0) + revenue * 0.2;
          }
        }
      }
    }
  };

  function tickFeudalHoldings(ctx, mr) {
    var G = global.GM;
    if (!G || !G.fiscal || !G.fiscal.feudalHoldings) return;
    G.fiscal.feudalHoldings.forEach(function(holding) {
      var type = FEUDAL_TYPES[holding.type];
      if (!type || !type.tick) return;
      try { type.tick(holding, mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'feudal') : console.error('[feudal]', holding.type, e); }
    });
  }

  function createFeudalHolding(spec) {
    var G = global.GM;
    if (!G.fiscal) G.fiscal = {};
    if (!G.fiscal.feudalHoldings) G.fiscal.feudalHoldings = [];
    var type = FEUDAL_TYPES[spec.type];
    if (!type) return null;
    var holding = Object.assign({
      id: 'feudal_' + (G.turn||0) + '_' + Math.floor(Math.random()*10000),
      createdAt: G.turn || 0
    }, spec);
    G.fiscal.feudalHoldings.push(holding);
    if (global.addEB) global.addEB('封建', '新封 ' + type.name + '：' + (spec.name || '无名'));
    return holding;
  }

  // ═══════════════════════════════════════════════════════════════════
  // #7 · 虚报差额（revenueClaimed vs revenueActual）
  // ═══════════════════════════════════════════════════════════════════

  function tickOverstatement(ctx, mr) {
    var G = global.GM;
    if (!G || !G.fiscal || !G.fiscal.regions) return;
    Object.keys(G.fiscal.regions).forEach(function(rid) {
      var rf = G.fiscal.regions[rid];
      if (!rf) return;
      if (!rf.annualReport) rf.annualReport = { revenueClaimed: 0, revenueActual: 0, collected: 0 };
      if (!rf.annualReport.revenueClaimed) rf.annualReport.revenueClaimed = 0;
      if (!rf.annualReport.revenueActual) rf.annualReport.revenueActual = 0;
      if (typeof rf.overstatement !== 'number') rf.overstatement = 0;
      // 虚报——每回合按 overstatement 虚增已征数字（上报）
      var actual = rf.annualReport.collected || 0;
      var claimed = actual * (1 + rf.overstatement);
      rf.annualReport.revenueActual = actual;
      rf.annualReport.revenueClaimed = claimed;
      // overstatement 动态（官员弱势 → 不敢虚报；官员强势 → 敢虚报）
      var official = rf.governingOfficial && G.chars ? G.chars.find(function(c) { return c.name === rf.governingOfficial; }) : null;
      if (official) {
        var integrity = official.integrity || 60;
        if (integrity > 70) rf.overstatement = Math.max(0, rf.overstatement - 0.005 * mr);
        else if (integrity < 40) rf.overstatement = Math.min(0.3, rf.overstatement + 0.01 * mr);
      }
      // 监察查出 → 重置
      var lastAudit = G.fiscal.auditSystem && G.fiscal.auditSystem.lastAuditedByRegion[rid] || -999;
      if (G.turn - lastAudit < ((typeof global.turnsForMonths === 'function') ? global.turnsForMonths(3) : 3)) rf.overstatement = Math.max(0, rf.overstatement - 0.03);
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // #8 · 土地兼并动态事件
  // ═══════════════════════════════════════════════════════════════════

  function tickLandAnnexation(ctx, mr) {
    var G = global.GM;
    if (!G) return;
    if (!G.landAnnexation) {
      G.landAnnexation = { concentration: 0.3, trend: 0, crisisLevel: 0, history: [] };
    }
    var la = G.landAnnexation;
    var pop = (G.vars && G.vars.pop) || 1000000;
    var farmland = (G.vars && G.vars.farmland) || 10000000;
    // 贪官/权贵兼并
    var greedyOfficials = (G.chars || []).filter(function(c) {
      if (c.alive === false) return false;
      if (!c.resources) return false;
      var landVal = c.resources.privateWealth && c.resources.privateWealth.land || 0;
      return landVal > 100000;
    }).length;
    // 兼并率增长
    var growth = greedyOfficials / Math.max(1, (G.chars || []).length) * 0.005 * mr;
    // 政策压制
    if (G.policies && G.policies.landReform) growth -= 0.01 * mr;
    var _hqG = (G.huangquan && typeof G.huangquan === 'object') ? (G.huangquan.index || 50) : (G.huangquan || 50);
    if (_hqG > 70) growth -= 0.005 * mr;
    la.trend = growth;
    la.concentration = Math.max(0.1, Math.min(0.95, la.concentration + growth));
    // 危机等级
    var newCrisis = 0;
    if (la.concentration > 0.75) newCrisis = 3; // 严重
    else if (la.concentration > 0.6) newCrisis = 2; // 显著
    else if (la.concentration > 0.45) newCrisis = 1; // 轻度
    // 状态跃迁 → 事件
    if (newCrisis > la.crisisLevel) {
      _emitLandEvent(newCrisis);
    }
    la.crisisLevel = newCrisis;
    // 影响：兼并高 → 税基缩水、民变风险
    if (la.concentration > 0.6) {
      // 税基缩水：自耕农比例降
      if (G.vars) G.vars.effectiveTaxBase = farmland * (1 - la.concentration * 0.5);
      // 民心降
      if (global._adjAuthority) global._adjAuthority('minxin', -0.2 * mr);
      // 起义风险
      if (typeof G.rebellionRisk === 'number') G.rebellionRisk += la.concentration * 0.3 * mr;
    }
    // 历史
    if (_isYearBoundaryTurn(ctx.turn || G.turn || 0)) {
      la.history.push({ year: G.year || _yearFromTurn(ctx.turn || G.turn || 1), concentration: +la.concentration.toFixed(3) });
      if (la.history.length > 30) la.history.splice(0, la.history.length - 30);
    }
  }

  function _emitLandEvent(level) {
    var msg = level === 3 ? '土地兼并极为严重，大量自耕农沦为佃户流民'
            : level === 2 ? '土地兼并加剧，地方豪强坐大'
            : '土地兼并初显征兆，贫富分化渐深';
    if (global.addEB) global.addEB('土地', msg);
    if (global.EconomyEventBus && typeof global.EconomyEventBus.emit === 'function') {
      global.EconomyEventBus.emit('fiscal.land_annexation', { level: level });
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // #9 · 借贷捐输系统
  // ═══════════════════════════════════════════════════════════════════

  function initLendingSystem() {
    var G = global.GM;
    if (!G.fiscal) G.fiscal = {};
    if (!G.fiscal.loans) G.fiscal.loans = { outstanding: [], history: [], totalPrincipal: 0, totalInterestPaid: 0 };
    if (!G.fiscal.donations) G.fiscal.donations = { history: [], totalReceived: 0 };
  }

  /** 发起借贷（向商人/宗室/家族借钱）*/
  function borrowFrom(source, amount, termMonths, interestRate) {
    initLendingSystem();
    var G = global.GM;
    var loan = {
      id: 'loan_' + (G.turn||0) + '_' + Math.floor(Math.random()*10000),
      source: source || '商人联保',
      principal: amount,
      remaining: amount,
      interestRate: interestRate !== undefined ? interestRate : 0.05, // 月利
      termMonths: termMonths || 12,
      startTurn: G.turn || 0,
      paid: 0,
      defaulted: false
    };
    G.fiscal.loans.outstanding.push(loan);
    G.fiscal.loans.totalPrincipal += amount;
    // 入帑廪
    if (G.guoku) G.guoku.money = (G.guoku.money || 0) + amount;
    if (global.addEB) global.addEB('借贷', '向 ' + loan.source + ' 借 ' + _fmtNum(amount) + ' 贯，月息 ' + (loan.interestRate*100).toFixed(1) + '%');
    return loan;
  }

  /** 接受捐输 */
  function acceptDonation(donor, amount, category) {
    initLendingSystem();
    var G = global.GM;
    var don = {
      id: 'don_' + (G.turn||0) + '_' + Math.floor(Math.random()*10000),
      donor: donor || '无名',
      amount: amount,
      category: category || 'general',
      turn: G.turn || 0
    };
    G.fiscal.donations.history.push(don);
    G.fiscal.donations.totalReceived += amount;
    if (G.guoku) G.guoku.money = (G.guoku.money || 0) + amount;
    // 捐输者名望增
    if (global.GM.chars) {
      var ch = global.GM.chars.find(function(c) { return c.name === donor; });
      if (ch && typeof global.CharEconEngine !== 'undefined' && global.CharEconEngine.adjustFame) {
        global.CharEconEngine.adjustFame(ch, Math.min(10, amount / 10000), '捐输国库');
      }
    }
    if (global.addEB) global.addEB('捐输', (donor||'义民') + ' 捐 ' + _fmtNum(amount) + ' 贯');
    return don;
  }

  /** 每回合还贷 */
  function tickLoans(ctx, mr) {
    initLendingSystem();
    var G = global.GM;
    var repaid = [];
    G.fiscal.loans.outstanding.forEach(function(loan) {
      if (loan.defaulted) return;
      var monthInterest = loan.remaining * loan.interestRate * mr;
      var elapsedTurns = (G.turn || 0) - loan.startTurn;
      var dpt = (typeof global._getDaysPerTurn === 'function') ? global._getDaysPerTurn() : 30;
      var monthsElapsed = elapsedTurns * dpt / 30;
      var monthsLeft = loan.termMonths - monthsElapsed;
      var principalPay = monthsLeft > 0 ? (loan.remaining / monthsLeft) * mr : loan.remaining;
      var totalPay = monthInterest + principalPay;
      // 帑廪不足 → 违约
      if (!G.guoku || (G.guoku.money || 0) < totalPay) {
        loan.defaulted = true;
        if (global.addEB) global.addEB('借贷', '违约：' + loan.source + ' 借款（尚欠 ' + _fmtNum(loan.remaining) + '）');
        // 触发事件
        if (global.EconomyEventBus && typeof global.EconomyEventBus.emit === 'function') {
          global.EconomyEventBus.emit('fiscal.loan_default', { loan: loan });
        }
        // 违约 → 皇威降
        if (global._adjAuthority) global._adjAuthority('huangwei', -5);
        return;
      }
      G.guoku.money -= totalPay;
      loan.paid += totalPay;
      loan.remaining -= principalPay;
      G.fiscal.loans.totalInterestPaid += monthInterest;
      if (loan.remaining < 0.01) {
        repaid.push(loan.id);
        if (global.addEB) global.addEB('借贷', '已偿：' + loan.source + ' 借款（付息共 ' + _fmtNum(loan.paid - loan.principal) + '）');
      }
    });
    // 移除已还贷
    G.fiscal.loans.outstanding = G.fiscal.loans.outstanding.filter(function(l) { return repaid.indexOf(l.id) < 0 && !l.defaulted; });
  }

  // ═══════════════════════════════════════════════════════════════════
  // #10 · 官员为政口碑累计（char.governance）
  // ═══════════════════════════════════════════════════════════════════

  function ensureGovernance(ch) {
    if (!ch.governance) {
      ch.governance = {
        regionHeld: null,
        tenureStart: null,
        tenureEnd: null,
        publicWorksContrib: 0,
        disasterReliefContrib: 0,
        educationContrib: 0,
        militaryPrepContrib: 0,
        embezzlementTotal: 0,
        reputationLocal: 0.5,
        reputationCentral: 0.5,
        performanceScore: 0
      };
    }
    return ch.governance;
  }

  /** 把一笔支出累计到官员口碑 */
  function attributeExpenditure(ch, expenditureType, amount) {
    if (!ch) return;
    var g = ensureGovernance(ch);
    var typeMap = {
      disaster_relief: 'disasterReliefContrib',
      public_works_water: 'publicWorksContrib',
      public_works_road: 'publicWorksContrib',
      public_works_wall: 'publicWorksContrib',
      education: 'educationContrib',
      military_prep: 'militaryPrepContrib',
      embezzlement: 'embezzlementTotal'
    };
    var key = typeMap[expenditureType];
    if (key) {
      g[key] = (g[key] || 0) + amount;
    }
    // 口碑演化
    if (expenditureType === 'embezzlement') {
      g.reputationLocal = Math.max(0, g.reputationLocal - amount / 200000);
      g.reputationCentral = Math.max(0, g.reputationCentral - amount / 300000);
    } else if (expenditureType === 'disaster_relief' || expenditureType === 'public_works_water') {
      g.reputationLocal = Math.min(1, g.reputationLocal + amount / 300000);
    } else if (expenditureType === 'courtship_capital') {
      g.reputationCentral = Math.min(1, g.reputationCentral + amount / 150000);
    }
    // 绩效综合分
    g.performanceScore = Math.round(
      (g.publicWorksContrib + g.disasterReliefContrib + g.educationContrib + g.militaryPrepContrib) / 10000
      - g.embezzlementTotal / 5000
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // #11 · 廷议 2.0 改革联动
  // ═══════════════════════════════════════════════════════════════════

  /** 将货币或央地改革发起为廷议题目 */
  function submitReformToTinyi(reformType, reformId, description) {
    var G = global.GM;
    if (!G._pendingTinyiTopics) G._pendingTinyiTopics = [];
    var presetName = '';
    if (reformType === 'currency' && global.CurrencyEngine) {
      var p = (global.CurrencyEngine.REFORM_PRESETS || []).find(function(r) { return r.id === reformId; });
      if (p) presetName = p.name;
    } else if (reformType === 'central_local' && global.CentralLocalEngine) {
      var p2 = (global.CentralLocalEngine.REFORM_PRESETS || []).find(function(r) { return r.id === reformId; });
      if (p2) presetName = p2.name;
    }
    var topic = '【' + (reformType === 'currency' ? '货币改革' : '央地改革') + '】' + (presetName || reformId) + (description ? '：' + description : '');
    G._pendingTinyiTopics.push({
      topic: topic,
      from: '财政改革',
      turn: G.turn || 0,
      reformType: reformType,
      reformId: reformId,
      _economyReform: true
    });
    if (global.addEB) global.addEB('廷议', '已付廷议：' + (presetName || reformId));
    if (global.toast) global.toast('改革议案已入廷议待议');
    return true;
  }

  /** 廷议表决完成后的回调（若廷议系统已钩子） */
  function onTinyiDecision(topicItem, decision) {
    if (!topicItem || !topicItem._economyReform) return;
    var approved = decision === 'approve';
    if (topicItem.reformType === 'currency' && global.CurrencyEngine) {
      global.CurrencyEngine.applyReform(topicItem.reformId, { forceSuccess: approved });
    } else if (topicItem.reformType === 'central_local' && global.CentralLocalEngine) {
      global.CentralLocalEngine.applyReform(topicItem.reformId, { forceSuccess: approved });
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // #12 · 强征 compliance 惩罚
  // ═══════════════════════════════════════════════════════════════════

  /** 向某区域强征（严厉下拨逆向）*/
  function forceLevy(regionId, amount, reason) {
    var G = global.GM;
    if (!G || !G.fiscal || !G.fiscal.regions) return { ok: false };
    var rf = G.fiscal.regions[regionId];
    if (!rf) return { ok: false };
    var region = _getRegionsArray(G).find(function(r) { return r.id === regionId; });
    var realAmount = Math.min(amount, (rf.ledgers.money || 0) + amount * 0.5); // 最多搜刮到本地留存 + 强拿 50%
    rf.ledgers.money = Math.max(0, rf.ledgers.money - realAmount);
    if (G.guoku) G.guoku.money = (G.guoku.money || 0) + realAmount * 0.8; // 20% 损耗
    // 合规率重挫
    rf.compliance = Math.max(0.05, rf.compliance - 0.2);
    // 连续强征计数
    rf._recentForceLevyCount = (rf._recentForceLevyCount || 0) + 1;
    if (rf._recentForceLevyCount >= 2) {
      rf.compliance = Math.max(0.05, rf.compliance - 0.2); // 追加 -0.2
      rf.autonomyLevel = Math.min(1.0, rf.autonomyLevel + 0.15);
    }
    // 区域 unrest 大涨
    if (region) {
      region.unrest = Math.min(100, (region.unrest || 30) + 15);
      region.disasterLevel = Math.min(1, (region.disasterLevel || 0) + 0.05); // 准灾
    }
    // 民心降
    if (global._adjAuthority) global._adjAuthority('minxin', -3);
    if (global.addEB) global.addEB('强征', (regionId||'某地') + ' 强征 ' + _fmtNum(realAmount) + ' 贯' + (reason ? '（' + reason + '）' : ''));
    if (global.EconomyEventBus && typeof global.EconomyEventBus.emit === 'function') {
      global.EconomyEventBus.emit('central_local.force_levy', { regionId: regionId, amount: realAmount, newCompliance: rf.compliance });
    }
    return { ok: true, actualAmount: realAmount, newCompliance: rf.compliance };
  }

  /** 每年重置 recent force levy 计数 */
  function _resetForceLevyCounts() {
    var G = global.GM;
    if (!G || !G.fiscal || !G.fiscal.regions) return;
    Object.keys(G.fiscal.regions).forEach(function(rid) {
      G.fiscal.regions[rid]._recentForceLevyCount = 0;
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  主 tick（插入 endTurn 经济阶段末尾）
  // ═══════════════════════════════════════════════════════════════════

  function tick(ctx) {
    ctx = ctx || {};
    var mr = ctx.monthRatio || 1;
    try { tickRegionalAcceptance(ctx, mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'gapfill] regAcc:') : console.error('[gapfill] regAcc:', e); }
    try { tickTradeArbitrage(ctx, mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'gapfill] arb:') : console.error('[gapfill] arb:', e); }
    try { tickFeudalHoldings(ctx, mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'gapfill] feudal:') : console.error('[gapfill] feudal:', e); }
    try { tickOverstatement(ctx, mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'gapfill] overstatement:') : console.error('[gapfill] overstatement:', e); }
    try { tickLandAnnexation(ctx, mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'gapfill] land:') : console.error('[gapfill] land:', e); }
    try { tickLoans(ctx, mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'gapfill] loans:') : console.error('[gapfill] loans:', e); }
    // 年度重置
    var isNewYear = _isYearBoundaryTurn(global.GM.turn || 0);
    if (isNewYear) { try { _resetForceLevyCounts(); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-economy-gap-fill');}catch(_){}} }
  }

  function _fmtNum(v) {
    v = Math.abs(v || 0);
    if (v >= 10000) return (v/10000).toFixed(1) + '万';
    return Math.round(v).toLocaleString();
  }

  // ═══════════════════════════════════════════════════════════════════
  //  钩入央地 executeLocalActions 以触发 governance 累计
  // ═══════════════════════════════════════════════════════════════════

  function _patchCentralLocalForGovernance() {
    if (typeof global.CentralLocalEngine === 'undefined') return;
    if (global.CentralLocalEngine._gapfillPatched) return;
    var origExec = global.CentralLocalEngine.executeLocalActions;
    if (typeof origExec !== 'function') return;
    global.CentralLocalEngine.executeLocalActions = function(las) {
      origExec(las);
      // 累计到官员 governance
      (las || []).forEach(function(la) {
        var G = global.GM;
        var rf = G.fiscal && G.fiscal.regions[la.regionId];
        if (!rf) return;
        var officialName = la.proposer || rf.governingOfficial;
        var ch = (G.chars || []).find(function(c) { return c.name === officialName; });
        if (!ch) return;
        ensureGovernance(ch);
        ch.governance.regionHeld = la.regionId;
        if (!ch.governance.tenureStart) ch.governance.tenureStart = G.turn || 0;
        la.actions.forEach(function(act) {
          attributeExpenditure(ch, act.type, act.amount);
        });
      });
    };
    global.CentralLocalEngine._gapfillPatched = true;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  钩入 paySalary 以应用购买力系数（实值 vs 名义）
  // ═══════════════════════════════════════════════════════════════════

  function _patchPaySalaryForPurchasingPower() {
    if (typeof global.CharEconEngine === 'undefined') return;
    if (global.CharEconEngine._gapfillPatched) return;
    var orig = global.CharEconEngine.paySalary;
    if (typeof orig !== 'function') return;
    global.CharEconEngine.paySalary = function(ch, nominal) {
      // 实值 = 名义 × 购买力系数
      var pp = getPurchasingPower();
      var real = (nominal || 0) * pp;
      // 记录通胀损失
      if (ch && ch.resources) {
        ch.resources._recentSalaryReal = real;
        ch.resources._recentSalaryNominal = nominal;
        ch.resources._purchasingPowerLoss = (ch.resources._purchasingPowerLoss || 0) + Math.max(0, (nominal - real));
      }
      return orig(ch, nominal);
    };
    global.CharEconEngine._gapfillPatched = true;
  }

  // 初始化阶段自动应用补丁
  function init() {
    _patchCentralLocalForGovernance();
    _patchPaySalaryForPurchasingPower();
    initLendingSystem();
  }

  // ═══════════════════════════════════════════════════════════════════
  //  导出
  // ═══════════════════════════════════════════════════════════════════

  function formulaEstimateWealth(dynasty, classKey, rank) {
    var basePool = {
      imperial:        { cash: 1000000, land: 200000, treasure: 100000, slaves: 1000 },
      noble:           { cash: 200000,  land: 50000,  treasure: 20000,  slaves: 100 },
      civilOfficial:   { cash: 50000,   land: 10000,  treasure: 5000,   slaves: 20 },
      militaryOfficial:{ cash: 30000,   land: 20000,  treasure: 3000,   slaves: 30 },
      merchant:        { cash: 300000,  land: 5000,   treasure: 30000,  slaves: 10 },
      landlord:        { cash: 20000,   land: 30000,  treasure: 2000,   slaves: 50 },
      clergy:          { cash: 5000,    land: 5000,   treasure: 1000,   slaves: 5 },
      commoner:        { cash: 500,     land: 50,     treasure: 0,      slaves: 0 }
    };
    var base = basePool[classKey] || basePool.commoner;
    var dyn = String(dynasty || '');
    var dm = 1.0;
    if (dyn.indexOf('秦') >= 0 || dyn.indexOf('周') >= 0) dm = 0.5;
    else if (dyn.indexOf('汉') >= 0) dm = 0.6;
    else if (dyn.indexOf('魏') >= 0 || dyn.indexOf('晋') >= 0 || dyn.indexOf('唐') >= 0) dm = 0.8;
    else if (dyn.indexOf('宋') >= 0 || dyn.indexOf('元') >= 0) dm = 1.0;
    else if (dyn.indexOf('明') >= 0) dm = 1.3;
    else if (dyn.indexOf('清') >= 0) dm = 1.8;
    var rankMult = Math.max(0.3, (7 - (rank || 5)) / 4);
    return {
      cash: Math.floor(base.cash * dm * rankMult),
      land: Math.floor(base.land * dm * rankMult),
      treasure: Math.floor(base.treasure * dm * rankMult),
      slaves: Math.floor(base.slaves * rankMult),
      commerce: Math.floor(base.cash * 0.3 * dm * rankMult)
    };
  }

  global.EconomyGapFill = {
    init: init,
    tick: tick,
    // 税种
    ATOMIC_TAX_TYPES: ATOMIC_TAX_TYPES,
    getAvailableTaxTypes: getAvailableTaxTypes,
    calculateTaxRevenue: calculateTaxRevenue,
    // 购买力
    getPurchasingPower: getPurchasingPower,
    getRealValue: getRealValue,
    fromRealValue: fromRealValue,
    formulaEstimateWealth: formulaEstimateWealth,
    // 四层
    buildHierarchyFromAdminDepth: buildHierarchyFromAdminDepth,
    // 封建
    FEUDAL_TYPES: FEUDAL_TYPES,
    createFeudalHolding: createFeudalHolding,
    // 借贷
    borrowFrom: borrowFrom,
    acceptDonation: acceptDonation,
    // 口碑
    ensureGovernance: ensureGovernance,
    attributeExpenditure: attributeExpenditure,
    // 廷议
    submitReformToTinyi: submitReformToTinyi,
    onTinyiDecision: onTinyiDecision,
    // 强征
    forceLevy: forceLevy,
    VERSION: 1
  };

  global.EconomyCore = {
    formulaEstimateWealth: formulaEstimateWealth,
    VERSION: 1
  };

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
