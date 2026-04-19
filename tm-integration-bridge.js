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

  function flattenDivisions(adminHierarchy) {
    if (!adminHierarchy) return [];
    var result = [];
    function walk(nodes, parent, depth) {
      (nodes || []).forEach(function(d) {
        if (!d) return;
        result.push({ node: d, parent: parent, depth: depth });
        if (d.children && d.children.length) walk(d.children, d, depth + 1);
        else if (d.divisions && d.divisions.length) walk(d.divisions, d, depth + 1);
      });
    }
    Object.keys(adminHierarchy).forEach(function(facId) {
      var fh = adminHierarchy[facId];
      if (!fh) return;
      walk(fh.divisions || [], null, 0);
    });
    return result;
  }

  // 顶级区划（第一层，如"江南省/河北省"）
  function getTopLevelDivisions(adminHierarchy, factionId) {
    if (!adminHierarchy) return [];
    var fac = adminHierarchy[factionId || 'player'] || Object.values(adminHierarchy)[0];
    if (!fac || !fac.divisions) return [];
    return fac.divisions;
  }

  // 所有叶子区划（递归 —— 无 children 或 children 空）
  function getLeafDivisions(adminHierarchy, factionId) {
    var tops = getTopLevelDivisions(adminHierarchy, factionId);
    var leaves = [];
    function walk(nodes) {
      (nodes || []).forEach(function(n) {
        if (!n) return;
        if (!n.children || n.children.length === 0) {
          leaves.push(n);
        } else {
          walk(n.children);
        }
      });
    }
    walk(tops);
    return leaves;
  }

  // 所有区划（递归 —— 含内部节点，用于某些需要所有节点的聚合）
  function getAllDivisions(adminHierarchy, factionId) {
    var tops = getTopLevelDivisions(adminHierarchy, factionId);
    var out = [];
    function walk(nodes) {
      (nodes || []).forEach(function(n) {
        if (!n) return;
        out.push(n);
        if (n.children) walk(n.children);
      });
    }
    walk(tops);
    return out;
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
    if (div.minxinLocal !== undefined && div.minxin === undefined) div.minxin = div.minxinLocal;
    if (div.corruptionLocal !== undefined && div.corruption === undefined) div.corruption = div.corruptionLocal;
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
    if (div.minxin === undefined) {
      div.minxin = (defaultsFromParent && defaultsFromParent.mx) || 60;
    }
    if (!div.minxinDetails) div.minxinDetails = { trueIndex: div.minxin, perceivedIndex: div.minxin, trend: 'stable' };
    // 腐败（地方吏治）
    if (div.corruption === undefined) div.corruption = 30;
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
    var nationalMouths = G.population && G.population.national && G.population.national.mouths || 50000000;
    var nationalHouseholds = G.population && G.population.national && G.population.national.households || 10000000;
    var avgMx = G.minxin && G.minxin.trueIndex || 60;
    var avgCorr = G.corruption && (typeof G.corruption === 'object' ? G.corruption.overall : G.corruption) || 30;

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
      // 尝试从旧 GM.population.byRegion[div.id 或 div.name] 迁移
      var legacyPop = G.population && G.population.byRegion && (G.population.byRegion[div.id] || G.population.byRegion[div.name]);
      if (legacyPop && legacyPop.mouths && !div._migrated) {
        div.population.mouths = legacyPop.mouths;
        div.population.households = legacyPop.households || Math.floor(legacyPop.mouths / 5);
        div.population.ding = legacyPop.ding || Math.floor(legacyPop.mouths * 0.25);
        div._migrated = true;
      }
      // 旧 GM.minxin.byRegion
      var legacyMx = G.minxin && G.minxin.byRegion && (G.minxin.byRegion[div.id] || G.minxin.byRegion[div.name]);
      if (legacyMx && legacyMx.index !== undefined) {
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
    // 为旧代码兼容，把 byRegion 对象定义为 division 的代理
    var topLevel = getTopLevelDivisions(G.adminHierarchy, 'player');
    if (!G.population) G.population = {};
    if (!G.population.byRegion) G.population.byRegion = {};
    if (!G.minxin) G.minxin = {};
    if (!G.minxin.byRegion) G.minxin.byRegion = {};
    if (!G.fiscal) G.fiscal = {};
    if (!G.fiscal.regions) G.fiscal.regions = {};
    if (!G.environment) G.environment = {};
    if (!G.environment.byRegion) G.environment.byRegion = {};

    topLevel.forEach(function(div) {
      // byRegion.<id> 指向 division
      G.population.byRegion[div.id] = div.population;
      // minxin byRegion 必须包含 .index（热力图读此字段）
      if (div.minxinDetails) {
        if (div.minxinDetails.index === undefined) {
          div.minxinDetails.index = div.minxinDetails.trueIndex !== undefined ? div.minxinDetails.trueIndex : (div.minxin || 60);
        }
      } else {
        div.minxinDetails = { index: div.minxin || 60, trueIndex: div.minxin || 60, perceivedIndex: div.minxin || 60, trend: 'stable' };
      }
      G.minxin.byRegion[div.id] = div.minxinDetails;
      G.fiscal.regions[div.id] = div.fiscal;
      G.environment.byRegion[div.id] = div.environment;
    });

    // regionMap（公库绑定解析用）
    if (!G.regionMap) G.regionMap = {};
    topLevel.forEach(function(div) { G.regionMap[div.id] = div; });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  聚合：各区划 → 七变量
  // ═══════════════════════════════════════════════════════════════════

  // NPC 腐败传导：按职位归部门，按私产/integrity 反推
  function _accumulateCorruptionFromNpcs(G) {
    if (!Array.isArray(G.chars)) return;
    var buckets = { central:[], provincial:[], county:[], military:[], palace:[], technical:[] };
    G.chars.forEach(function(c) {
      if (!c || c.alive === false || !c.officialTitle) return;
      var title = c.officialTitle;
      var dept;
      if (/节度|布政|巡抚|总督|观察/.test(title)) dept = 'provincial';
      else if (/知府|知州|通判/.test(title)) dept = 'provincial';
      else if (/知县|县令|县丞|主簿/.test(title)) dept = 'county';
      else if (/将军|都督|提督|总兵|副将|参将|游击|守备/.test(title)) dept = 'military';
      else if (/内.*(监|府|侍)|大内|奉宸|御前|掌印/.test(title)) dept = 'palace';
      else if (/翰林|钦天|太医|司天|太史|学士/.test(title)) dept = 'technical';
      else dept = 'central';
      if (buckets[dept]) buckets[dept].push(c);
    });
    // 每部门根据成员 integrity 反推：低 integrity + 高私产 = 腐败 +
    Object.keys(buckets).forEach(function(d) {
      var arr = buckets[d];
      if (arr.length === 0) return;
      var sumDelta = 0;
      arr.forEach(function(c) {
        var integ = c.integrity != null ? c.integrity : 50;
        var wealthScore = c.resources && c.resources.private ? ((c.resources.private.money||0) / 100000) : 0;
        // integrity 50 为中位，+1 偏离 → +1 腐败
        sumDelta += (50 - integ) * 0.02 + Math.min(5, wealthScore) * 0.4;
      });
      var avgDelta = sumDelta / arr.length;
      var current = G.corruption.byDept[d];
      current = typeof current === 'object' ? (current.true || current.overall || 30) : (current || 30);
      // 缓慢朝目标靠拢（0.05/tick）
      G.corruption.byDept[d] = Math.max(0, Math.min(100, current + avgDelta * 0.05));
    });
  }

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
        if (c.population && typeof c.population === 'object') {
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
        var w = (c.population && c.population.mouths) || (typeof c.population === 'number' ? c.population : 1);
        mxW += (typeof c.minxin === 'number' ? c.minxin : 60) * w;
        cxW += (typeof c.corruption === 'number' ? c.corruption : 30) * w;
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

  // 人口自然增长（每回合月度漂移；战争/瘟疫/灾荒由 AI 叠加）
  function _naturalPopulationGrowth() {
    var G = global.GM;
    if (!G || !G.adminHierarchy) return;
    // 月度增长率 ~0.08%（年 ~1%）—— 取决于民心/腐败/环境负载
    Object.keys(G.adminHierarchy).forEach(function(fk) {
      var divs = G.adminHierarchy[fk] && G.adminHierarchy[fk].divisions || [];
      divs.forEach(function(div) {
        if (!div.population || typeof div.population !== 'object') return;
        var base = 0.0008;  // 0.08% / 月
        var mx = (typeof div.minxin === 'number') ? div.minxin : 60;
        var cr = (typeof div.corruption === 'number') ? div.corruption : 30;
        var load = div.environment && typeof div.environment.currentLoad === 'number' ? div.environment.currentLoad : 0.5;
        // 民心高 +0.0004，腐败高 -0.0003，负载 >0.9 -0.0005
        var adj = (mx - 50) / 100 * 0.0004 - (cr - 30) / 100 * 0.0003 - (load > 0.9 ? 0.0005 : 0);
        var rate = Math.max(-0.003, Math.min(0.003, base + adj));
        if (div.population.mouths > 0) {
          var dm = Math.round(div.population.mouths * rate);
          div.population.mouths += dm;
          div.population.households = Math.max(0, Math.round(div.population.mouths / 5));
          div.population.ding = Math.max(0, Math.round(div.population.mouths * 0.25));
        }
      });
    });
  }

  function aggregateRegionsToVariables() {
    var G = global.GM;
    if (!G) return;

    // 0. 人口自然漂移（在汇总之前）
    try { _naturalPopulationGrowth(); } catch(_e) { console.warn('[bridge] natPopGrowth', _e); }

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
      if (pd && typeof pd === 'object' && (pd.mouths || pd.households)) {
        totalHH += pd.households || 0;
        totalMouths += pd.mouths || 0;
        totalDing += pd.ding || 0;
        totalFug += pd.fugitives || 0;
        totalHidden += pd.hiddenCount || 0;
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
      var w = (div.population && div.population.mouths) || (typeof div.population === 'number' ? div.population : 1);
      weightedMx += (div.minxin || 60) * w;
    });
    if (totalMouths > 0) {
      var avgMx = weightedMx / totalMouths;
      if (!G.minxin) G.minxin = {};
      if (typeof G.minxin === 'object') {
        G.minxin.trueIndex = avgMx;
        // 感知值按腐败粉饰
        var corrForPerc = (typeof G.corruption === 'object' ? G.corruption.overall : G.corruption) || 30;
        G.minxin.perceivedIndex = Math.min(100, avgMx + (corrForPerc / 100) * 10);
      }
    }

    // 3. 吏治 = 叶子按人口加权平均地方腐败 + 中央/县/军/内廷/技术五部门（6 部门融合）
    var weightedCorr = 0;
    leaves.forEach(function(div) {
      var w = (div.population && div.population.mouths) || (typeof div.population === 'number' ? div.population : 1);
      weightedCorr += (div.corruption || 30) * w;
    });
    if (totalMouths > 0) {
      var avgProvCorr = weightedCorr / totalMouths;
      if (!G.corruption) G.corruption = { overall: 30, byDept: {} };
      if (typeof G.corruption === 'object') {
        if (!G.corruption.byDept) G.corruption.byDept = {};
        G.corruption.byDept.provincial = avgProvCorr;
        // 其他 5 部门：若首次则按基线初始化，之后由事件/AI 推演修改
        if (G.corruption.byDept.central === undefined)   G.corruption.byDept.central   = Math.round(avgProvCorr * 0.85);
        if (G.corruption.byDept.county === undefined)    G.corruption.byDept.county    = Math.round(avgProvCorr * 1.15);
        if (G.corruption.byDept.military === undefined)  G.corruption.byDept.military  = Math.round(avgProvCorr * 0.95);
        if (G.corruption.byDept.palace === undefined)    G.corruption.byDept.palace    = Math.round(avgProvCorr * 1.10);
        if (G.corruption.byDept.technical === undefined) G.corruption.byDept.technical = Math.round(avgProvCorr * 0.55);
        // 按 NPC 派系/私产向上推高技术官外各部门（每周期）
        try { _accumulateCorruptionFromNpcs(G); } catch(_e) {}
        // overall = 6 部门平均
        var deptSum = 0, deptCnt = 0;
        Object.keys(G.corruption.byDept || {}).forEach(function(d) {
          var v = typeof G.corruption.byDept[d] === 'object' ? (G.corruption.byDept[d].true || G.corruption.byDept[d].overall) : G.corruption.byDept[d];
          if (v !== undefined && !isNaN(v)) { deptSum += v; deptCnt++; }
        });
        G.corruption.overall = deptCnt > 0 ? deptSum / deptCnt : avgProvCorr;
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
  }

  // ═══════════════════════════════════════════════════════════════════
  //  反向：AI 改 byRegion → 同步到 division
  // ═══════════════════════════════════════════════════════════════════

  function syncDivisionFromByRegion(rid) {
    var G = global.GM;
    if (!G || !G.adminHierarchy) return;
    var topLevel = getTopLevelDivisions(G.adminHierarchy, 'player');
    var div = topLevel.find(function(d) { return d.id === rid || d.name === rid; });
    if (!div) return;
    if (G.population && G.population.byRegion && G.population.byRegion[rid] && div.population !== G.population.byRegion[rid]) {
      // 已经是同一引用（代理），无需复制
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

  function tick(ctx) {
    try { aggregateRegionsToVariables(); } catch(e) { console.error('[bridge] aggregate:', e); }
  }

  function init() {
    try { initializeFromLegacy(); } catch(e) { console.error('[bridge] init:', e); }
    // 首次聚合
    try { aggregateRegionsToVariables(); } catch(e) {}
  }

  global.IntegrationBridge = {
    init: init,
    tick: tick,
    flattenDivisions: flattenDivisions,
    getTopLevelDivisions: getTopLevelDivisions,
    ensureDivisionData: _ensureDivisionData,
    aggregateRegionsToVariables: aggregateRegionsToVariables,
    syncDivisionFromByRegion: syncDivisionFromByRegion,
    VERSION: 1
  };

  global.aggregateRegionsToVariables = aggregateRegionsToVariables;

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
