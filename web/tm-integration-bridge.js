// @ts-check
/// <reference path="types.d.ts" />
/**
 * tm-integration-bridge.js — 新旧系统真融合桥接
 *
 * 核心哲学：
 *   · 行政区划（scriptData.adminHierarchy）是数据根源
 *   · 七变量（户口/民心/吏治/帑廪）是区划数据的聚合展示
 *   · 推演 AI 改变区划数据 → 聚合 → 自动体现在七变量
 *   · 旧有"空壳"系统被替换为真实数据
 *
 * 本文件职责：
 *   1. 初始化：把各 division 节点填充 population/minxin/corruption/fiscal/environment 字段
 *   2. 每回合 endTurn 末期：聚合各 division 的数据 → 七变量
 *   3. 反向：当 AI 改 byRegion.<rid> 时也同步到 division（通过 _resolveBinding）
 *   4. 历代预设作为编辑器默认值和 AI 参考，不再作硬编码硬触发
 */
(function(global) {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════
  //  行政区划扁平化（遍历多层树，返回所有叶子/中间节点）
  // ═══════════════════════════════════════════════════════════════════

  function _walkAdminDivisions(nodes, visitor, opts, parent, depth) {
    opts = opts || {};
    nodes = nodes || [];
    depth = depth || 0;
    for (var i = 0; i < nodes.length; i++) {
      var d = nodes[i];
      if (!d) continue;
      visitor(d, parent || null, depth);
      var children = d.children && d.children.length
        ? d.children
        : (opts.followDivisions && d.divisions && d.divisions.length ? d.divisions : null);
      if (children) _walkAdminDivisions(children, visitor, opts, d, depth + 1);
    }
  }

  function flattenDivisions(adminHierarchy) {
    if (!adminHierarchy) return [];
    var result = [];
    Object.keys(adminHierarchy).forEach(function(facId) {
      var fh = adminHierarchy[facId];
      if (!fh) return;
      _walkAdminDivisions(fh.divisions || [], function(d, parent, depth) {
        result.push({ node: d, parent: parent, depth: depth });
      }, { followDivisions: true }, null, 0);
    });
    return result;
  }

  // 顶级区划（第一层，如"江南省/河北省"）
  function getTopLevelDivisions(adminHierarchy, factionId) {
    if (!adminHierarchy) return [];
    if (Array.isArray(adminHierarchy.divisions)) return adminHierarchy.divisions;
    var requested = factionId || 'player';
    var fac = adminHierarchy[requested] || null;
    if (fac && !Array.isArray(fac) && !Array.isArray(fac.divisions)) fac = null;
    if (!fac && requested === 'player' && typeof _tmResolvePlayerAdminKey === 'function') {
      var resolved = _tmResolvePlayerAdminKey(adminHierarchy, null, { allowSoleBranchFallback:false });
      if (resolved) fac = adminHierarchy[resolved];
    }
    if (Array.isArray(fac)) return fac;
    if (!fac || !Array.isArray(fac.divisions)) return [];
    return fac.divisions;
  }

  function _bridgeFiniteNumber(value, fallback) {
    if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) return fallback;
    var n = Number(value);
    return isFinite(n) ? n : fallback;
  }

  function _hasAuthoritativePopulationDetail(detail) {
    return !!(detail && typeof detail === 'object' && [detail.mouths, detail.households, detail.ding]
      .some(function(value) { return _bridgeFiniteNumber(value, null) !== null; }));
  }

  function _divisionPopulationWeight(div) {
    var pd = div && div.populationDetail;
    if (_hasAuthoritativePopulationDetail(pd)) return _bridgeFiniteNumber(pd.mouths, 0);
    var pop = div && div.population;
    if (pop && typeof pop === 'object') return Number(pop.mouths) || 0;
    if (typeof pop === 'number') return pop;
    return 1;
  }

  // 所有叶子区划（递归 —— 无 children 或 children 空）
  function getLeafDivisions(adminHierarchy, factionId) {
    var tops = getTopLevelDivisions(adminHierarchy, factionId);
    var leaves = [];
    _walkAdminDivisions(tops, function(n) {
      if (!n.children || n.children.length === 0) leaves.push(n);
    });
    return leaves;
  }

  // 所有区划（递归 —— 含内部节点，用于某些需要所有节点的聚合）
  function getAllDivisions(adminHierarchy, factionId) {
    var tops = getTopLevelDivisions(adminHierarchy, factionId);
    var out = [];
    _walkAdminDivisions(tops, function(n) {
      out.push(n);
    });
    return out;
  }

  // Unified admin/fiscal division reader. Use this for population, fiscal,
  // minxin, corruption, and local-governance systems. Map code should keep
  // using P.map.regions instead.
  function getDivisionArray(source, opts) {
    opts = opts || {};
    if (!source) return [];
    if (Array.isArray(source)) return source.slice();
    var adminHierarchy = source.adminHierarchy || source;
    if (adminHierarchy && typeof adminHierarchy === 'object' && !Array.isArray(adminHierarchy)) {
      if (Array.isArray(adminHierarchy.divisions)) {
        var wrapped = { player: adminHierarchy };
        if (opts.mode === 'top') return getTopLevelDivisions(wrapped, 'player').slice();
        if (opts.mode === 'leaf') return getLeafDivisions(wrapped, 'player').slice();
        return flattenDivisions(wrapped).map(function(x) { return x.node; });
      }
      var hasHierarchy = Object.keys(adminHierarchy).some(function(k) {
        var fac = adminHierarchy[k];
        return fac && Array.isArray(fac.divisions);
      });
      if (hasHierarchy) {
        if (opts.mode === 'top') return getTopLevelDivisions(adminHierarchy, opts.factionId || 'player').slice();
        if (opts.mode === 'leaf') return getLeafDivisions(adminHierarchy, opts.factionId || 'player').slice();
        return flattenDivisions(adminHierarchy).map(function(x) { return x.node; });
      }
    }
    if (Array.isArray(source.regions)) return source.regions.slice();
    if (source.regions && typeof source.regions === 'object') return Object.values(source.regions);
    return [];
  }

  // ═══════════════════════════════════════════════════════════════════
  //  每个区划补齐真数据字段
  // ═══════════════════════════════════════════════════════════════════

  function _ensureDivisionData(div, defaultsFromParent) {
    if (!div) return;
    // ── 编辑器深化字段优先 —— populationDetail 覆盖旧 population（数字或空） ──
    if (div.populationDetail && (!div.population || typeof div.population === 'number')) {
      div.population = null;  // 让下面的块重建
    }
    // ── 兼容：旧剧本/AI 生成的 div.population 是数字 → 转为对象 ──
    if (typeof div.population === 'number') {
      var legacy = div.population;
      div.population = {
        total: legacy,
        mouths: legacy,
        households: Math.floor(legacy / 5),
        ding: Math.floor(legacy * 0.25),
        fugitives: 0,
        hiddenCount: 0,
        byCategory: {}
      };
    }

    // ── 编辑器深化字段桥接 —— 若剧本编辑器已填好（populationDetail/fiscalDetail/publicTreasuryInit/carryingCapacity），则优先采用 ──
    if (div.populationDetail && !div.population) {
      div.population = {
        households: div.populationDetail.households || 0,
        mouths:     div.populationDetail.mouths || 0,
        ding:       div.populationDetail.ding || 0,
        fugitives:  div.populationDetail.fugitives || 0,
        hiddenCount:div.populationDetail.hiddenCount || 0,
        byCategory: {}
      };
    }
    if (div.fiscalDetail && !div.fiscal) {
      div.fiscal = Object.assign({}, div.fiscalDetail);
      ['compliance','skimmingRate','autonomyLevel'].forEach(function(key,i) {
        div.fiscal[key] = Math.max(0, Math.min(1, _bridgeFiniteNumber(div.fiscalDetail[key], [0.7,0.1,0.3][i])));
      });
      if (!div.fiscal.peasantBurden) div.fiscal.peasantBurden = { claimed: 0, actual: 0 };
      if (div.fiscal.annualTax === undefined) div.fiscal.annualTax = div.fiscalDetail.actualRevenue || 0;
    }
    if (div.publicTreasuryInit && !div.publicTreasury) {
      div.publicTreasury = {
        money: { stock: div.publicTreasuryInit.money||0, quota:0, used:0, available: div.publicTreasuryInit.money||0, deficit:0 },
        grain: { stock: div.publicTreasuryInit.grain||0, quota:0, used:0, available: div.publicTreasuryInit.grain||0, deficit:0 },
        cloth: { stock: div.publicTreasuryInit.cloth||0, quota:0, used:0, available: div.publicTreasuryInit.cloth||0, deficit:0 },
        currentHead:null, previousHead:null, handoverLog:[]
      };
    }
    if (div.carryingCapacity && !div.environment) {
      div.environment = {
        carrying: {
          farmland: (div.carryingCapacity.arable||0) / Math.max(1, div.populationDetail && div.populationDetail.mouths || 1),
          water:    (div.carryingCapacity.water||0) / Math.max(1, div.populationDetail && div.populationDetail.mouths || 1),
          fuel: 1.0, housing: 1.0, sanitation: 1.0
        },
        ecoScars: {},
        currentLoad: div.carryingCapacity.currentLoad || 0.5,
        arableLand: div.carryingCapacity.arable || 0,
        waterCapacity: div.carryingCapacity.water || 0,
        carryingRegime: div.carryingCapacity.carryingRegime || 'balanced'
      };
    }
    var localMx = _bridgeFiniteNumber(div.minxinLocal, null);
    var localCorr = _bridgeFiniteNumber(div.corruptionLocal, null);
    if (_bridgeFiniteNumber(div.minxin, null) === null && localMx !== null) div.minxin = localMx;
    if (_bridgeFiniteNumber(div.corruption, null) === null && localCorr !== null) div.corruption = localCorr;
    // 户口
    if (!div.population) {
      div.population = {
        households: (defaultsFromParent && defaultsFromParent.hh) || 0,
        mouths:     (defaultsFromParent && defaultsFromParent.mo) || 0,
        ding:       (defaultsFromParent && defaultsFromParent.dd) || 0,
        fugitives:  0,
        hiddenCount:0,
        byCategory: {}
      };
    }
    // 民心
    if (_bridgeFiniteNumber(div.minxin, null) === null) {
      div.minxin = _bridgeFiniteNumber(defaultsFromParent && defaultsFromParent.mx, 60);
    }
    if (!div.minxinDetails) div.minxinDetails = { trueIndex: div.minxin, perceivedIndex: div.minxin, trend: 'stable' };
    // 腐败（地方吏治）
    if (_bridgeFiniteNumber(div.corruption, null) === null) div.corruption = 30;
    // 财政（公库）
    if (!div.publicTreasury) {
      div.publicTreasury = {
        money: { stock: 0, quota: 0, used: 0, available: 0, deficit: 0 },
        grain: { stock: 0, quota: 0, used: 0, available: 0, deficit: 0 },
        cloth: { stock: 0, quota: 0, used: 0, available: 0, deficit: 0 },
        currentHead: null, previousHead: null, handoverLog: []
      };
    }
    // 本区域赋税账本（对接帑廪岁入）
    if (!div.fiscal) {
      div.fiscal = {
        claimedRevenue: 0,    // 名义
        actualRevenue: 0,     // 实征
        remittedToCenter: 0,  // 起运中央
        retainedBudget: 0,    // 地方留存
        compliance: 0.7,      // 合规率（与七变量联动）
        skimmingRate: 0.1,    // 漂没率
        autonomyLevel: 0.3,
        annualTax: 0,         // 年税（等同旧 byRegion 的 income）
        peasantBurden: { claimed: 0, actual: 0 }
      };
    }
    // 环境（承载力）
    if (!div.environment) {
      div.environment = {
        carrying: { farmland: 1.0, water: 1.0, fuel: 1.0, housing: 1.0, sanitation: 1.0 },
        ecoScars: {},
        currentLoad: 0.5,
        arableLand: 0, waterCapacity: 0
      };
    }
    // region 五字段（bySettlement/byAge/byGender/byEthnicity/byFaith）
    if (!div.bySettlement) {
      var m = div.population.mouths || 0;
      var h = div.population.households || 0;
      div.bySettlement = {
        fang: { mouths: Math.floor(m*0.08), households: Math.floor(h*0.08) },
        shi:  { mouths: Math.floor(m*0.05), households: Math.floor(h*0.05) },
        zhen: { mouths: Math.floor(m*0.15), households: Math.floor(h*0.15) },
        cun:  { mouths: Math.floor(m*0.72), households: Math.floor(h*0.72) }
      };
    }
    if (!div.byGender) {
      var m2 = div.population.mouths || 0;
      var ratio = 1.04;
      div.byGender = {
        male: Math.floor(m2 * ratio / (1+ratio)),
        female: Math.floor(m2 / (1+ratio)),
        sexRatio: ratio
      };
    }
    if (!div.byAge) {
      var ds = { '0-9':0.22, '10-19':0.18, '20-29':0.15, '30-39':0.13, '40-49':0.11, '50-59':0.08, '60-69':0.06, '70-79':0.04, '80+':0.03 };
      var decade = {};
      Object.keys(ds).forEach(function(k){ decade[k] = Math.floor((div.population.mouths||0) * ds[k]); });
      div.byAge = { decade: decade };
    }
    if (!div.byEthnicity) {
      div.byEthnicity = { han: 0.95, other: 0.05 };
    }
    if (!div.byFaith) {
      div.byFaith = { folk: 0.6, buddhist: 0.2, taoist: 0.15, other: 0.05 };
    }
    // 主官（NPC 名字）
    if (!div.currentHead) div.currentHead = null;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  初始化：从旧的 GM.population.byRegion / GM.minxin.byRegion / GM.fiscal.regions 迁移
  // ═══════════════════════════════════════════════════════════════════

  function initializeFromLegacy() {
    var G = global.GM;
    if (!G) return;
    // 优先级（2026-04 bug 修）：
    //   1. GM.adminHierarchy（doActualStart 已从剧本 sc.adminHierarchy 深拷贝·运行时 live 数据）
    //   2. P.adminHierarchy（剧本静态副本）
    //   3. global.scriptData.adminHierarchy（编辑器模板·可能为空或遗留数据）
    //   4. _bootstrapFromLegacy（8 大区保底）
    // 原先把 scriptData.adminHierarchy 放最高优先级·编辑器模板会覆盖剧本真值
    var _hasValidHierarchy = function(ah) {
      if (!ah || typeof ah !== 'object') return false;
      var keys = Object.keys(ah);
      if (keys.length === 0) return false;
      for (var i = 0; i < keys.length; i++) {
        var fac = ah[keys[i]];
        if (fac && Array.isArray(fac.divisions) && fac.divisions.length > 0) return true;
      }
      return false;
    };
    var adminHierarchy = null;
    if (_hasValidHierarchy(G.adminHierarchy)) {
      adminHierarchy = G.adminHierarchy;
    } else if (global.P && _hasValidHierarchy(global.P.adminHierarchy)) {
      adminHierarchy = global.P.adminHierarchy;
      console.log('[bridge] GM.adminHierarchy \u7A7A·\u4ECE P.adminHierarchy \u6062\u590D');
    } else if (global.scriptData && _hasValidHierarchy(global.scriptData.adminHierarchy)) {
      adminHierarchy = global.scriptData.adminHierarchy;
      console.log('[bridge] GM/P adminHierarchy \u7A7A·\u4ECE scriptData \u6062\u590D\uFF08\u7F16\u8F91\u5668\u6A21\u677F\uFF09');
    } else {
      console.warn('[bridge] adminHierarchy \u5168\u94FE\u7A7A·\u542F\u7528 8 \u5927\u533A\u4FDD\u5E95');
      adminHierarchy = _bootstrapFromLegacy(G);
    }
    G.adminHierarchy = adminHierarchy;

    // 为每个顶级区划确保数据字段
    var topLevel = getTopLevelDivisions(adminHierarchy, 'player');
    var nationalMouths = _bridgeFiniteNumber(G.population && G.population.national && G.population.national.mouths, 50000000);
    var nationalHouseholds = _bridgeFiniteNumber(G.population && G.population.national && G.population.national.households, 10000000);
    var avgMx = G.minxin && typeof G.minxin.trueIndex === 'number' ? G.minxin.trueIndex : 60;
    var avgCorrRaw = G.corruption && (typeof G.corruption === 'object'
      ? (typeof G.corruption.trueIndex === 'number' ? G.corruption.trueIndex : G.corruption.overall)
      : G.corruption);
    var avgCorr = typeof avgCorrRaw === 'number' && isFinite(avgCorrRaw) ? avgCorrRaw : 30;

    // 首次均分（若区划没初始值）
    topLevel.forEach(function(div, idx) {
      if (!div.id) div.id = 'div_' + idx;
      var divCount = topLevel.length;
      _ensureDivisionData(div, {
        hh: Math.floor(nationalHouseholds / divCount),
        mo: Math.floor(nationalMouths / divCount),
        dd: Math.floor(nationalMouths / divCount * 0.25),
        mx: avgMx
      });
      // 顶级人口代理已从叶级 byRegion 拆到 byProvince；旧档仍兼容读取 byRegion。
      var provincePopulation = G.population && (G.population.byProvince || G.population.byRegion);
      var legacyPop = provincePopulation && (provincePopulation[div.id] || provincePopulation[div.name]);
      if (legacyPop && _bridgeFiniteNumber(legacyPop.mouths, null) !== null && !div._migrated) {
        div.population.mouths = _bridgeFiniteNumber(legacyPop.mouths, 0);
        div.population.households = _bridgeFiniteNumber(legacyPop.households, Math.floor(div.population.mouths / 5));
        div.population.ding = _bridgeFiniteNumber(legacyPop.ding, Math.floor(div.population.mouths * 0.25));
        div._migrated = true;
      }
      // 旧 GM.minxin.byRegion
      var legacyMx = G.minxin && G.minxin.byRegion && (G.minxin.byRegion[div.id] || G.minxin.byRegion[div.name]);
      var explicitAuthority = global.AuthorityEngines && global.AuthorityEngines.isIndependentAuthorityLedger && global.AuthorityEngines.isIndependentAuthorityLedger();
      if (legacyMx && legacyMx.index !== undefined && !explicitAuthority) {
        div.minxin = legacyMx.index;
        div.minxinDetails = legacyMx;
      }
      // 旧 GM.fiscal.regions
      var legacyFiscal = G.fiscal && G.fiscal.regions && (G.fiscal.regions[div.id] || G.fiscal.regions[div.name]);
      if (legacyFiscal) {
        div.fiscal = Object.assign(div.fiscal || {}, legacyFiscal);
      }
      // 旧 GM.environment.byRegion
      var legacyEnv = G.environment && G.environment.byRegion && (G.environment.byRegion[div.id] || G.environment.byRegion[div.name]);
      if (legacyEnv) {
        div.environment = Object.assign(div.environment || {}, legacyEnv);
      }
    });

    // 旧的 byRegion 转为 division 的 view
    _updateLegacyProxies(G);
  }

  function _bootstrapFromLegacy(G) {
    var regions = (G.regions || G.regionList || []).slice();
    if (regions.length === 0) {
      // 默认 8 大区
      regions = ['京畿','江南','河北','山东','湖广','川蜀','陕甘','岭南'].map(function(n,i){return{id:n,name:n};});
    }
    var divisions = regions.map(function(r, i) {
      return {
        id: r.id || r.name || ('div_' + i),
        name: r.name || r.id || ('区划' + (i+1)),
        type: r.type || 'province'
      };
    });
    return {
      player: {
        name: '本朝行政区划',
        description: '初始化自默认/旧 regions',
        divisions: divisions
      }
    };
  }

  function _updateLegacyProxies(G) {
    // population.byRegion 永久保持叶级粒度并与 populationDetail 同一引用；
    // 顶级省/路代理独立放在 byProvince，不能再让一个字段在两种形状间切换。
    // 必须每次构造新表并原子替换；在旧对象上增量写会让已删除、合并或改 ID
    // 的区划继续作为“幽灵地区”参与后续户籍与财政结算。
    var topLevel = getTopLevelDivisions(G.adminHierarchy, 'player');
    var leaves = getLeafDivisions(G.adminHierarchy, 'player');
    if (!G.population) G.population = {};
    if (!G.minxin) G.minxin = {};
    if (!G.fiscal) G.fiscal = {};
    if (!G.environment) G.environment = {};
    var nextLeafPopulation = {};
    var nextProvincePopulation = {};
    var nextMinxin = {};
    var nextFiscal = {};
    var nextEnvironment = {};
    var nextRegionMap = {};

    topLevel.forEach(function(div) {
      var id = String(div.id);
      nextProvincePopulation[id] = div.population;
      // minxin byRegion 必须包含 .index（热力图读此字段）
      if (div.minxinDetails) {
        if (div.minxinDetails.index === undefined) {
          div.minxinDetails.index = _bridgeFiniteNumber(div.minxinDetails.trueIndex, _bridgeFiniteNumber(div.minxin, 60));
        }
      } else {
        var initialMx = _bridgeFiniteNumber(div.minxin, _bridgeFiniteNumber(div.minxinLocal, 60));
        div.minxinDetails = { index: initialMx, trueIndex: initialMx, perceivedIndex: initialMx, trend: 'stable' };
      }
      nextMinxin[id] = div.minxinDetails;
      nextFiscal[id] = div.fiscal;
      nextEnvironment[id] = div.environment;
      nextRegionMap[id] = div;
    });

    leaves.forEach(function(div, index) {
      var id = String(div.id || div.name || ('region-' + index));
      var detail = div.populationDetail && typeof div.populationDetail === 'object'
        ? div.populationDetail
        : (div.population && typeof div.population === 'object' ? div.population : {});
      if (!detail || typeof detail !== 'object') detail = {};
      if (!isFinite(Number(detail.mouths))) {
        detail.mouths = typeof div.population === 'number' ? Number(div.population) || 0 : Number(div.mouths) || 0;
      }
      if (!isFinite(Number(detail.households))) detail.households = Math.round((Number(detail.mouths) || 0) / 5);
      if (!isFinite(Number(detail.ding))) detail.ding = Math.round((Number(detail.mouths) || 0) * 0.25);
      detail.id = id;
      detail.name = div.name || id;
      detail.regionType = div.regionType || div.type || div.kind || detail.regionType || '';
      detail.hiddenCount = Math.max(0, Math.round(Number(detail.hiddenCount != null ? detail.hiddenCount : detail.hidden) || 0));
      detail.hidden = detail.hiddenCount;
      detail.fugitives = Math.max(0, Math.round(Number(detail.fugitives) || 0));
      div.populationDetail = detail;
      nextLeafPopulation[id] = detail;
    });

    G.population.byLeafRegion = nextLeafPopulation;
    G.population.byRegion = nextLeafPopulation;
    G.population.byProvince = nextProvincePopulation;
    G.minxin.byRegion = nextMinxin;
    G.fiscal.regions = nextFiscal;
    G.environment.byRegion = nextEnvironment;
    G.regionMap = nextRegionMap; // 公库绑定解析用
  }

  // ═══════════════════════════════════════════════════════════════════
  //  聚合：各区划 → 七变量
  // ═══════════════════════════════════════════════════════════════════

  // 父节点数据 = 子叶之和（递归）——"父 >= 子之和"约束在实践中退化为等号
  function _reconcileParentToChildren(nodes) {
    (nodes || []).forEach(function(n) {
      if (!n || !n.children || n.children.length === 0) return;
      // 先递归下级
      _reconcileParentToChildren(n.children);
      // 聚合子节点到父
      var hh=0, mo=0, ding=0, fug=0, hid=0;
      var mxW=0, cxW=0, wSum=0;
      var claimed=0, actual=0, remit=0, retain=0;
      var pubM=0, pubG=0, pubC=0;
      n.children.forEach(function(c) {
        if (_hasAuthoritativePopulationDetail(c.populationDetail)) {
          hh += _bridgeFiniteNumber(c.populationDetail.households, 0);
          mo += _bridgeFiniteNumber(c.populationDetail.mouths, 0);
          ding += _bridgeFiniteNumber(c.populationDetail.ding, 0);
          fug += _bridgeFiniteNumber(c.populationDetail.fugitives, 0);
          hid += _bridgeFiniteNumber(c.populationDetail.hiddenCount, 0);
        } else if (c.population && typeof c.population === 'object') {
          hh += c.population.households || 0;
          mo += c.population.mouths || 0;
          ding += c.population.ding || 0;
          fug += c.population.fugitives || 0;
          hid += c.population.hiddenCount || 0;
        } else if (typeof c.population === 'number') {
          mo += c.population;
          hh += Math.floor(c.population / 5);
          ding += Math.floor(c.population * 0.25);
        }
        var w = _divisionPopulationWeight(c);
        mxW += _bridgeFiniteNumber(c.minxin, _bridgeFiniteNumber(c.minxinLocal, 60)) * w;
        cxW += _bridgeFiniteNumber(c.corruption, _bridgeFiniteNumber(c.corruptionLocal, 30)) * w;
        wSum += w;
        if (c.fiscal) {
          claimed += c.fiscal.claimedRevenue || 0;
          actual  += c.fiscal.actualRevenue || 0;
          remit   += c.fiscal.remittedToCenter || 0;
          retain  += c.fiscal.retainedBudget || 0;
        }
        if (c.publicTreasury) {
          pubM += (c.publicTreasury.money && c.publicTreasury.money.stock) || 0;
          pubG += (c.publicTreasury.grain && c.publicTreasury.grain.stock) || 0;
          pubC += (c.publicTreasury.cloth && c.publicTreasury.cloth.stock) || 0;
        }
      });
      // 写回父
      n.population = n.population && typeof n.population === 'object' ? n.population : {};
      n.population.households = hh;
      n.population.mouths = mo;
      n.population.ding = ding;
      n.population.fugitives = fug;
      n.population.hiddenCount = hid;
      if (wSum > 0) {
        n.minxin = Math.round(mxW / wSum);
        n.corruption = Math.round(cxW / wSum);
      }
      n.fiscal = n.fiscal || {};
      n.fiscal.claimedRevenue = claimed;
      n.fiscal.actualRevenue = actual;
      n.fiscal.remittedToCenter = remit;
      n.fiscal.retainedBudget = retain;
      if (n.publicTreasury) {
        if (n.publicTreasury.money) n.publicTreasury.money.stock = pubM;
        if (n.publicTreasury.grain) n.publicTreasury.grain.stock = pubG;
        if (n.publicTreasury.cloth) n.publicTreasury.cloth.stock = pubC;
      }
    });
  }

  function aggregateRegionsToVariables(options) {
    options = options || {};
    var strict = options.strict === true;
    // 融合桥只做幂等 schema/代理/派生汇总。人口时间推进唯一归 HujiEngine，
    // 腐败时间推进唯一归 CorruptionEngine；否则同一回合会出现双生产者，且
    // 融合桥旧固定步长还会无视 daysPerTurn。
    var G = global.GM;
    if (!G) return;

    var topLevel = getTopLevelDivisions(G.adminHierarchy, 'player');
    if (topLevel.length === 0) return;
    // 改用叶子聚合（修父子不对齐问题）——若无子则顶层即叶子
    var leaves = getLeafDivisions(G.adminHierarchy, 'player');
    if (leaves.length === 0) leaves = topLevel;
    // 同时把顶层节点的 population 同步为其叶子之和（"父 = 子之和"约束）
    _reconcileParentToChildren(topLevel);

    // 1. 户口 = 所有叶子户口总和；本回合变化 = 各顶级区划变化之和
    // 兼容三种形式：population 对象/数字；populationDetail 对象（剧本 buildAdminHierarchy 用此）
    var totalHH = 0, totalMouths = 0, totalDing = 0, totalFug = 0, totalHidden = 0;
    leaves.forEach(function(div) {
      // 优先读 populationDetail（剧本规范字段）
      var pd = div.populationDetail;
      if (_hasAuthoritativePopulationDetail(pd)) {
        totalHH += _bridgeFiniteNumber(pd.households, 0);
        totalMouths += _bridgeFiniteNumber(pd.mouths, 0);
        totalDing += _bridgeFiniteNumber(pd.ding, 0);
        totalFug += _bridgeFiniteNumber(pd.fugitives, 0);
        totalHidden += _bridgeFiniteNumber(pd.hiddenCount, 0);
        return;
      }
      if (div.population && typeof div.population === 'object') {
        totalHH += div.population.households || 0;
        totalMouths += div.population.mouths || 0;
        totalDing += div.population.ding || 0;
        totalFug += div.population.fugitives || 0;
        totalHidden += div.population.hiddenCount || 0;
      } else if (typeof div.population === 'number') {
        totalMouths += div.population;
        totalHH += Math.floor(div.population / 5);
        totalDing += Math.floor(div.population * 0.25);
      }
    });
    // 变化量 = 顶级变化之和（记快照供下回合对比）
    if (!G._popSnapshot) G._popSnapshot = { turn: -1, topMouths: {}, totalMouths: 0 };
    if (G._popSnapshot.turn !== G.turn) {
      var deltaMouths = 0;
      topLevel.forEach(function(d) {
        var now = (d.population && typeof d.population === 'object') ? (d.population.mouths||0) : (typeof d.population==='number'?d.population:0);
        var prev = G._popSnapshot.topMouths[d.id || d.name];
        if (prev !== undefined) deltaMouths += now - prev;
        G._popSnapshot.topMouths[d.id || d.name] = now;
      });
      if (!G.population) G.population = {};
      G.population.lastDelta = deltaMouths;
      G._popSnapshot.turn = G.turn;
      G._popSnapshot.totalMouths = totalMouths;
    }
    if (!G.population) G.population = {};
    if (!G.population.national) G.population.national = {};
    G.population.national.households = totalHH;
    G.population.national.mouths = totalMouths;
    G.population.national.ding = totalDing;
    G.population.fugitives = totalFug;
    G.population.hiddenCount = totalHidden;

    // 2. 民心 = 叶子按人口加权平均
    var weightedMx = 0;
    leaves.forEach(function(div) {
      var w = _divisionPopulationWeight(div);
      var localMx = _bridgeFiniteNumber(div.minxin, _bridgeFiniteNumber(div.minxinLocal, 60));
      weightedMx += localMx * w;
    });
    if (totalMouths > 0) {
      var avgMx = weightedMx / totalMouths;
      if (!G.minxin) G.minxin = {};
      if (typeof G.minxin === 'object') {
        G.minxin.trueIndex = avgMx;
        // 感知值按腐败粉饰
        var corrForPercRaw = (typeof G.corruption === 'object'
          ? (typeof G.corruption.trueIndex === 'number' ? G.corruption.trueIndex : G.corruption.overall)
          : G.corruption);
        var corrForPerc = typeof corrForPercRaw === 'number' && isFinite(corrForPercRaw) ? corrForPercRaw : 30;
        G.minxin.perceivedIndex = Math.min(100, avgMx + (corrForPerc / 100) * 10);
        // aggregate 写了 trueIndex(avgMx) → 同步重算段位 phase（否则 phase 缓存滞留·面板段位与民心值脱节，如 98 却显示「揭竿」）
        if (global.AuthorityEngines && typeof global.AuthorityEngines._getMinxinPhase === 'function') {
          G.minxin.phase = global.AuthorityEngines._getMinxinPhase(avgMx);
        }
      }
    }

    // Explicit six-department accounts are aggregated by their existing owner.
    // This bridge must not create another set of default departments or overwrite saves.
    var declaredCorruption = global.CorruptionEngine && global.CorruptionEngine.isDeclaredLedger && global.CorruptionEngine.isDeclaredLedger();
    if (declaredCorruption) {
      global.CorruptionEngine.syncIndexFromSubDepts('', { record:false, preserveTrend:true });
    } else {
    // 3. 吏治 = 叶子按人口加权平均地方腐败 + 中央/县/军/内廷/技术五部门（6 部门融合）
    var weightedCorr = 0;
    leaves.forEach(function(div) {
      var w = _divisionPopulationWeight(div);
      weightedCorr += _bridgeFiniteNumber(div.corruption, _bridgeFiniteNumber(div.corruptionLocal, 30)) * w;
    });
    if (totalMouths > 0) {
      var avgProvCorr = weightedCorr / totalMouths;
      if (!G.corruption) G.corruption = { overall: 30, byDept: {} };
      if (typeof G.corruption === 'object') {
        if (!G.corruption.byDept) G.corruption.byDept = {};
        G.corruption.byDept.provincial = avgProvCorr;
        if (!G.corruption.subDepts) G.corruption.subDepts = {};
        if (!G.corruption.subDepts.provincial) G.corruption.subDepts.provincial = {};
        G.corruption.subDepts.provincial.true = avgProvCorr;
        // 其他 5 部门：若首次则按基线初始化，之后由事件/AI 推演修改
        if (G.corruption.byDept.central === undefined)   G.corruption.byDept.central   = Math.round(avgProvCorr * 0.85);
        if (G.corruption.byDept.county === undefined)    G.corruption.byDept.county    = Math.round(avgProvCorr * 1.15);
        if (G.corruption.byDept.military === undefined)  G.corruption.byDept.military  = Math.round(avgProvCorr * 0.95);
        if (G.corruption.byDept.palace === undefined)    G.corruption.byDept.palace    = Math.round(avgProvCorr * 1.10);
        if (G.corruption.byDept.technical === undefined) G.corruption.byDept.technical = Math.round(avgProvCorr * 0.55);
        // overall = 6 部门平均
        var deptSum = 0, deptCnt = 0;
        Object.keys(G.corruption.byDept || {}).forEach(function(d) {
          var deptVal = G.corruption.byDept[d];
          var v = typeof deptVal === 'object'
            ? (typeof deptVal.true === 'number' ? deptVal.true : deptVal.overall)
            : deptVal;
          if (v !== undefined && !isNaN(v)) { deptSum += v; deptCnt++; }
        });
        G.corruption.trueIndex = deptCnt > 0 ? deptSum / deptCnt : avgProvCorr;
        G.corruption.overall = G.corruption.trueIndex;
      }
    }

    }

    // 4. 帑廪岁入摘要 = 叶子聚合（展示用；若 CascadeTax 已结算就不再覆写 guoku.monthlyIncome）
    var totalClaimed = 0, totalActual = 0, totalRemitted = 0, totalRetained = 0;
    leaves.forEach(function(div) {
      if (div.fiscal) {
        totalClaimed += div.fiscal.claimedRevenue || 0;
        totalActual += div.fiscal.actualRevenue || 0;
        totalRemitted += div.fiscal.remittedToCenter || 0;
        totalRetained += div.fiscal.retainedBudget || 0;
      }
    });
    if (!G.guoku) G.guoku = {};
    G.guoku._divisionsAggregate = {
      totalClaimed: totalClaimed,
      totalActual: totalActual,
      totalRemitted: totalRemitted,
      totalRetained: totalRetained
    };
    // CascadeTax 已在前一步单独写入了 guoku.ledgers/money/grain/cloth/monthlyIncome，
    // 此处不再覆写，避免双计。仅在 cascade 未跑（如剧本没税制）时兜底。
    if (!G._lastCascadeSummary && totalRemitted > 0) {
      G.guoku.annualIncome = totalRemitted;
      G.guoku.monthlyIncome = Math.round(totalRemitted / 12);
    }

    // 5. 环境承载力 = 叶子平均
    if (!G.environment) G.environment = {};
    var loadSum = 0, loadCnt = 0;
    leaves.forEach(function(div) {
      if (div.environment && div.environment.currentLoad !== undefined) {
        loadSum += div.environment.currentLoad;
        loadCnt++;
      }
    });
    if (loadCnt > 0) G.environment.nationalLoad = loadSum / loadCnt;

    // P-UIMX·回合末把各省 minxinDetails.index（UI「天下民情图」热力图读此字段·var-drawers r.index）刷成该省叶子的人口加权 div.minxin。
    //   治本 adjustMinxin 摊的是叶子 div.minxin、聚合 trueIndex 也读叶子(本函数上方)，但 byRegion 上挂的顶层省 minxinDetails.index
    //   只在 init/_updateLegacyProxies 当 .index===undefined 时写过一次、之后从不刷新 → 滞留开局值（玩家看到各省四五十、实际已治到八九十）。
    //   与段位 phase 滞留同病同治：真值变了、UI 读的派生缓存得跟上。flat（省即叶子）与嵌套（省下府县）都走加权 walk。
    try {
      topLevel.forEach(function(prov) {
        var _num = 0, _den = 0;
        (function walk(node) {
          if (!node) return;
          if (!node.children || node.children.length === 0) {
            var w = _divisionPopulationWeight(node);
            _num += _bridgeFiniteNumber(node.minxin, _bridgeFiniteNumber(node.minxinLocal, 60)) * w; _den += w;
          } else { node.children.forEach(walk); }
        })(prov);
        var _v = _den > 0 ? _num / _den : _bridgeFiniteNumber(prov.minxin, _bridgeFiniteNumber(prov.minxinLocal, 60));
        if (!prov.minxinDetails) prov.minxinDetails = {};
        prov.minxinDetails.index = _v;
        prov.minxinDetails.trueIndex = _v;
      });
    } catch (_uiMxSyncE) {
      (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_uiMxSyncE, 'bridge] uiMinxinSync') : console.error('[bridge] uiMinxinSync', _uiMxSyncE);
      if (strict) throw _uiMxSyncE;
    }

    // P-DZ·回合末数值定型后，统一把 minxin/huangwei/huangquan 的 phase 段位 + 皇威 tyrant/失威状态
    //   重算对齐当前数值（minxin.trueIndex 此处刚由聚合写定、huangwei.index 由 _tickHuangwei 衰减写定）——
    //   修「数值变了但段位/暴君标记滞留」：面板段位错位 + authority-complete 等按 phase 触发的后果被带偏。
    try { if (global.AuthorityEngines && typeof global.AuthorityEngines.syncAuthorityPhases === 'function') global.AuthorityEngines.syncAuthorityPhases(); } catch (_syncPhaseE) {
      (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_syncPhaseE, 'bridge] syncAuthorityPhases') : console.error('[bridge] syncAuthorityPhases', _syncPhaseE);
      if (strict) throw _syncPhaseE;
    }
    _updateLegacyProxies(G);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  反向：AI 改区域代理 → 同步到 division
  // ═══════════════════════════════════════════════════════════════════

  function syncDivisionFromByRegion(rid) {
    var G = global.GM;
    if (!G || !G.adminHierarchy) return;
    var topLevel = getTopLevelDivisions(G.adminHierarchy, 'player');
    var div = topLevel.find(function(d) { return d.id === rid || d.name === rid; });
    if (!div) return;
    if (G.population && G.population.byProvince && G.population.byProvince[rid] && div.population !== G.population.byProvince[rid]) {
      div.population = G.population.byProvince[rid];
    }
    if (G.minxin && G.minxin.byRegion && G.minxin.byRegion[rid]) {
      div.minxinDetails = G.minxin.byRegion[rid];
      if (G.minxin.byRegion[rid].index !== undefined) div.minxin = G.minxin.byRegion[rid].index;
    }
    if (G.fiscal && G.fiscal.regions && G.fiscal.regions[rid]) {
      div.fiscal = G.fiscal.regions[rid];
    }
    if (G.environment && G.environment.byRegion && G.environment.byRegion[rid]) {
      div.environment = G.environment.byRegion[rid];
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  tick + init
  // ═══════════════════════════════════════════════════════════════════

  function tick(options) {
    options = options || {};
    // tick 是关键账本步骤：默认向事务边界传播异常。只有显式 strict:false
    // 的兼容调用才允许记录后降级。
    var strict = options.strict !== false;
    try {
      return aggregateRegionsToVariables({ strict: strict });
    } catch(e) {
      (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'bridge] aggregate:') : console.error('[bridge] aggregate:', e);
      if (strict) throw e;
      return null;
    }
  }

  function migrateAndRebind(options) {
    options = options || {};
    if (options.strict === true) {
      initializeFromLegacy();
      aggregateRegionsToVariables({ strict: true });
      return true;
    }
    try { initializeFromLegacy(); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'bridge] init:') : console.error('[bridge] init:', e); }
    // 首次聚合/读档重绑定只对齐 schema、代理与派生汇总，不推进玩法时间。
    try { aggregateRegionsToVariables({ strict: false }); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-integration-bridge');}catch(_){}}
    return true;
  }

  function init(options) {
    return migrateAndRebind(options);
  }

  global.IntegrationBridge = {
    init: init,
    migrateAndRebind: migrateAndRebind,
    tick: tick,
    flattenDivisions: flattenDivisions,
    getTopLevelDivisions: getTopLevelDivisions,
    getLeafDivisions: getLeafDivisions,
    getAllDivisions: getAllDivisions,
    getDivisionArray: getDivisionArray,
    ensureDivisionData: _ensureDivisionData,
    aggregateRegionsToVariables: aggregateRegionsToVariables,
    syncDivisionFromByRegion: syncDivisionFromByRegion,
    VERSION: 1
  };

  global.aggregateRegionsToVariables = aggregateRegionsToVariables;

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
