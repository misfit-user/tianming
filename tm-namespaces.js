// @ts-check
/// <reference path="types.d.ts" />
/* ============================================================
 * tm-namespaces.js — 命名空间门面（真实版·R87 重建）
 *
 * 目的：为散落在 window 上的业务函数建立**经校准的门面索引**，
 *      让新代码可以用 `TM.Economy.getTributeRatio(...)` 而不是直接全局调用。
 *
 * R87 重大修正：
 *   原 R59 白名单含 21/27 个**不存在**的函数名（如 battleOutcome/moveArmy）
 *   调用 TM.Economy.moveArmy 会拿到 undefined 造成假象。
 *   本次重建：
 *     - 所有白名单来自实际 grep 源文件·必须存在才列入
 *     - 加载时自检·不存在的 console.warn 并排除
 *     - TM.namespaces.report() 返回真实状态
 *     - 加 TM.namespaces.verify() 可手动重验
 *
 * 设计：
 *   - 不修改任何原文件·不减少现有 window 污染
 *   - getter 动态引用 window 上的现有函数（自愈：即使函数重定义也跟上）
 *   - 提供"未来目标"路径：新代码走 TM.Xxx，未来迁移时只需改门面内部
 *
 * 与 DA 的关系：
 *   DA 是**数据访问**门面（GM/P 字段访问）
 *   TM.Economy/MapSystem/Lizhi/etc 是**业务函数**门面（引擎函数访问）
 *
 * 用法：
 *   TM.Economy.getTributeRatio(faction)        // 替代直接 getTributeRatio()
 *   TM.MapSystem.assignFactionColors()
 *   TM.Lizhi.getLizhiPhase()
 *   TM.HujiEngine.tick()                       // 引擎型门面直接穿透
 *   TM.namespaces.report()                     // 每个 ns 可用/缺失统计
 *   TM.namespaces.verify()                     // 立刻重验·返回警告列表
 *
 * 未来演化：
 *   阶段 1：getter 门面（当前）
 *   阶段 2：原函数定义改为 TM.Xxx.xxx = function(){}·保留 window 别名（R87 对 Lizhi 示范 3 处）
 *   阶段 3：移除 window 别名·真减全局数
 * ============================================================ */
(function(){
  'use strict';
  if (typeof window === 'undefined') return;
  window.TM = window.TM || {};

  var _loadWarnings = [];

  /** 根据白名单字段从 window 建 getter 门面·加载时自检 */
  function _buildFacade(namespace, functionNames) {
    var facade = {};
    var missing = [];
    functionNames.forEach(function(name) {
      if (typeof window[name] !== 'function') {
        missing.push(name);
      }
      Object.defineProperty(facade, name, {
        get: function() { return window[name]; },
        enumerable: true,
        configurable: false
      });
    });
    if (missing.length > 0) {
      _loadWarnings.push({
        namespace: namespace,
        total: functionNames.length,
        missing: missing
      });
    }
    facade.has = function(name) {
      return functionNames.indexOf(name) >= 0 && typeof window[name] === 'function';
    };
    facade.list = function() { return functionNames.slice(); };
    facade.listAvailable = function() {
      return functionNames.filter(function(n) { return typeof window[n] === 'function'; });
    };
    facade.listMissing = function() {
      return functionNames.filter(function(n) { return typeof window[n] !== 'function'; });
    };
    facade._namespace = namespace;
    return facade;
  }

  /** 引擎型门面：window.XxxEngine 是一个对象·透传其方法 */
  function _buildEngineFacade(namespace, windowKey) {
    var facade = {
      _namespace: namespace,
      _engineKey: windowKey,
      has: function(name) {
        var eng = window[windowKey];
        return eng && typeof eng[name] !== 'undefined';
      },
      list: function() {
        var eng = window[windowKey];
        return eng ? Object.keys(eng) : [];
      },
      isAvailable: function() {
        return !!window[windowKey];
      }
    };
    // 透传：TM.HujiEngine.tick() → window.HujiEngine.tick()
    return new Proxy(facade, {
      get: function(target, prop) {
        if (prop in target) return target[prop];
        var eng = window[windowKey];
        if (eng && prop in eng) {
          var v = eng[prop];
          return typeof v === 'function' ? v.bind(eng) : v;
        }
        return undefined;
      }
    });
  }

  // ─── TM.Economy（tm-economy-military.js · 20 个真实函数） ───
  var ECONOMY_FNS = [
    'getTributeRatio', 'calculateMonthlyIncome', 'updateEconomy',
    'recalculateEconomy', 'recalculatePowerStructure', 'triggerDynastyPhaseEvent',
    'updateFactions', 'updateParties', 'updateClasses', 'updateCharacters',
    'calculateInheritanceScore',
    'analyzeBattleStrategy', 'calculateArmyStrength', 'recommendTactics',
    'predictBattleOutcome', 'executeTactic',
    'getUnitTypes', 'initUnitSystem', 'createUnit',
    'calculateUnitCombatPower', 'calculateArmyCombatPowerByUnits'
  ];
  TM.Economy = _buildFacade('Economy', ECONOMY_FNS);

  // ─── TM.MapSystem（tm-map-system.js · 17 个真实函数） ───
  var MAP_FNS = [
    'initMapSystem', 'assignFactionColors', 'hslToRgb', 'hexToRgb',
    'initTerrainTypes', 'renderMap', 'findPath', 'buildAdjacencyGraph',
    'calculateSupplyLine', 'loadMapFromScenario', 'initGameMap',
    'openMapViewer', 'closeMapViewer', 'toggleTerrainView',
    'addCity', 'setNeighbors', 'updateCityOwner'
  ];
  TM.MapSystem = _buildFacade('MapSystem', MAP_FNS);

  // R106·统一地图入口·解决审计问题 5（双套地图系统）
  // 实际数据源不同·不能合并·但可统一编程接口
  //   mode='terrain'  → 地形/势力图（GM.mapData）·诏书决策时看局势
  //   mode='regions'  → 行政区+势力色（P.map.regions）·军事菜单/快捷面板概览
  // 未来若统一数据模型·只需在此函数内合并·调用点不变
  TM.MapSystem.open = function(mode) {
    mode = mode || 'terrain';
    if (mode === 'regions' && typeof window.showMapInGame === 'function') {
      return window.showMapInGame();
    }
    if (typeof window.openMapViewer === 'function') return window.openMapViewer();
    console.warn('[TM.MapSystem.open] 两套地图函数都不可用');
    return null;
  };

  // ─── TM.Lizhi（tm-lizhi-panel.js · 22 个真实函数） ───
  var LIZHI_FNS = [
    '_lizhiTabJump', 'renderInkDots', 'getLizhiPhase', 'getTrendSymbol',
    'getCorrVisibility', 'openCorruptionPanel', 'closeCorruptionPanel',
    'renderCorruptionPanel', 'computeTaxThreeNumber', 'renderTaxThreeNumberBlock',
    '_lizhiIntegrityBadge',
    '_lizhi_launchPurge', '_lizhi_reformSalary', '_lizhi_factionExposure',
    '_lizhi_openAppeals', '_lizhi_rotateOfficials', '_lizhi_harshRule',
    '_lizhi_secretPolice', '_lizhi_openInstitutionDesigner',
    '_lizhi_toggleJuanna', '_lizhi_toggleMapHeat', '_lizhi_dispatchCommissioner'
  ];
  TM.Lizhi = _buildFacade('Lizhi', LIZHI_FNS);

  // ─── TM.Guoku（tm-guoku-panel.js · 21 个真实函数） ───
  var GUOKU_FNS = [
    '_guokuFmt', '_guokuTabJump', 'openGuokuPanel', 'closeGuokuPanel',
    'renderGuokuPanel', '_guoku_confirm',
    '_guoku_extraTax', '_guoku_doExtraTax',
    '_guoku_openGranary', '_guoku_doOpenGranary',
    '_guoku_takeLoan', '_guoku_openLoanDialog', '_guoku_showLoans',
    '_guoku_cutOfficials', '_guoku_reduceTax',
    '_guoku_issuePaper', '_guoku_viewReform', '_guoku_doEnactReform',
    '_guoku_lightCoin', '_guoku_doLightCoin',
    '_guoku_aiDecreeOpen', '_guoku_aiDecreeExec'
  ];
  TM.Guoku = _buildFacade('Guoku', GUOKU_FNS);

  // ─── TM.Neitang（tm-neitang-panel.js · 11 个真实函数·全量） ───
  var NEITANG_FNS = [
    '_neitangFmt', '_neitangTabJump',
    'openNeitangPanel', 'closeNeitangPanel', 'renderNeitangPanel',
    '_neitang_renderTrendSection', '_neitang_transferFromGuoku',
    '_neitang_rescueGuoku', '_neitang_enableSpecial',
    '_neitang_disableSpecial', '_neitang_ceremony'
  ];
  TM.Neitang = _buildFacade('Neitang', NEITANG_FNS);

  // ─── TM.HujiEngine（引擎型·透传 window.HujiEngine 的所有方法） ───
  TM.HujiEngine = _buildEngineFacade('HujiEngine', 'HujiEngine');

  // ─── TM.GuokuEngine（引擎型·透传 window.GuokuEngine） ───
  TM.GuokuEngine = _buildEngineFacade('GuokuEngine', 'GuokuEngine');

  // ─── TM.ChangeQueue（引擎型·透传 window.ChangeQueue） ───
  TM.ChangeQueue = _buildEngineFacade('ChangeQueue', 'ChangeQueue');

  // ─── 全局汇总 ───
  function _verify() {
    var out = {};
    var warnings = [];
    var listFacades = { Economy: TM.Economy, MapSystem: TM.MapSystem,
                        Lizhi: TM.Lizhi, Guoku: TM.Guoku, Neitang: TM.Neitang };
    Object.keys(listFacades).forEach(function(ns) {
      var f = listFacades[ns];
      var all = f.list();
      var avail = f.listAvailable();
      var miss = f.listMissing();
      out[ns] = {
        type: 'whitelist',
        total: all.length,
        available: avail.length,
        missing: miss.length,
        missingNames: miss
      };
      if (miss.length > 0) warnings.push(ns + ': ' + miss.length + ' 缺失 → ' + miss.slice(0, 3).join(','));
    });
    var engineFacades = { HujiEngine: TM.HujiEngine, GuokuEngine: TM.GuokuEngine, ChangeQueue: TM.ChangeQueue };
    Object.keys(engineFacades).forEach(function(ns) {
      var f = engineFacades[ns];
      var avail = f.isAvailable();
      out[ns] = {
        type: 'engine',
        available: avail,
        methodCount: avail ? f.list().length : 0
      };
      if (!avail) warnings.push(ns + ': 引擎未加载');
    });
    return { facades: out, warnings: warnings };
  }

  TM.namespaces = {
    Economy: TM.Economy,
    MapSystem: TM.MapSystem,
    Lizhi: TM.Lizhi,
    Guoku: TM.Guoku,
    Neitang: TM.Neitang,
    HujiEngine: TM.HujiEngine,
    GuokuEngine: TM.GuokuEngine,
    ChangeQueue: TM.ChangeQueue,
    /** 诊断：返回每命名空间的可用/缺失统计 */
    report: function() { return _verify().facades; },
    /** 立即重验·返回警告列表·可在 Console 直接跑 */
    verify: function() {
      var r = _verify();
      if (r.warnings.length === 0) {
        console.log('[TM.namespaces] ✓ 全部门面完好·' + Object.keys(r.facades).length + ' 个');
      } else {
        console.warn('[TM.namespaces] ✗ ' + r.warnings.length + ' 个门面有缺失:');
        r.warnings.forEach(function(w){ console.warn('  ' + w); });
      }
      return r;
    },
    /** 加载时自检结果（同步可读） */
    loadWarnings: function() { return _loadWarnings.slice(); }
  };

  // 延迟自检：等所有模块加载后
  if (typeof document !== 'undefined') {
    var runAutoVerify = function() {
      var r = _verify();
      if (r.warnings.length > 0) {
        console.warn('[TM.namespaces] 加载后自检发现 ' + r.warnings.length + ' 个问题·跑 TM.namespaces.verify() 详查');
      }
    };
    if (document.readyState === 'complete') {
      setTimeout(runAutoVerify, 500);
    } else {
      window.addEventListener('load', function(){ setTimeout(runAutoVerify, 500); });
    }
  }
})();
