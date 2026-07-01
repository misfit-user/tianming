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
 *   阶段 1：getter 门面（R87-R143 完成）
 *   阶段 2：原函数定义改为 TM.Xxx.xxx = function(){}·保留 window 别名（R87 对 Lizhi 示范 3 处）（Phase 5）
 *   阶段 3：移除 window 别名·真减全局数（Phase 6）
 *
 * R200·Phase 5 P5-α reconcile (2026-05-04·与 Codex 共识)：
 *   - 24 canonical namespaces·此 slice 只建顶层容器·后续 P5 sub-slice 填
 *   - rename：TM.MapSystem → TM.Map·TM.Storage → TM.Save (alias 留 Phase 5 全程)
 *   - 14 新容器：Chaoyi/Wendui/Endturn(.AI)/Military/Fiscal/Office/Authority/
 *               Corruption/Keju/Edict/NPC/Char/UI/Editor/Memory/Player·Diagnostics meta
 *   - legacy：TM.Lizhi 保留为 facade·Phase 6 决定移到 TM.Office.Lizhi 或 TM.UI.Lizhi
 *
 * R201·Phase 5 P5-β NPC/Char (2026-05-04·Codex)：
 *   - TM.NPC: engine·interactions·decision·behaviors·personality·legacy
 *   - TM.Char: schema·economy·arcs·autogen·historical·ui
 *   - CentralizationSystem / TerritoryProductionSystem 不入 NPC (fiscal/territory 责)
 *   - historical wave 12 文件·只 profiles 共享表·无独 facade
 *
 * R202·Phase 5 P5-γ Edict (2026-05-04·Claude)：
 *   - TM.Edict: parser (R12b v2)·complete (v1)·lifecycle·thresholds·legacy
 *   - parser.EDICT_TYPES (17 详定义) 与 lifecycle.EDICT_TYPES (11 大类) 不同对象·sub-ns 强隔离
 *   - HTML inline-callable 留 window (openEdictHelp 等)·Phase 6 才动
 *
 * R203·Phase 5 P5-δ Fiscal/Economy/Guoku/Neitang (2026-05-04·Claude)：
 *   - TM.Fiscal: engine (R10)·cascade (v2)·fixedExpense (v2)·legacy{PhaseH}
 *   - TM.Economy 顶层 R87 facade 留·上挂 7 sub-engine (core·linkage·currency·
 *               currencyUnit·envCapacity·eventBus·gapFill) + 4 alias (sum·getDiv·
 *               topContributors·triggerSurvey·R10 dead code rescue)
 *   - TM.Guoku 顶层 R87 panel facade 留·挂 .engine·与 TM.GuokuEngine 同源
 *   - TM.Neitang 顶层 R87 panel facade 留·挂 .engine
 *   - tm-fiscal-engine.js L1746-1751 删·原直写 TM.Economy.sum 实际 dead code
 *
 * R204·Phase 5 P5-ε Authority/Office/Keju/Corruption (2026-05-04·Claude)：
 *   - TM.Authority: engines (R12c v1)·complete·legacy{PhaseF1/F4/G1}
 *   - TM.Corruption: engine (R9 p2/p4 merged·v1)
 *   - TM.Office: system (R6 carve)·legacy (4 aiGen 主入口)·余 HTML inline 留 window
 *   - TM.Keju: runtime (9 主入口)·余 HTML inline 留 window
 *   - TM.Lizhi 不重建·R87 22 fn whitelist 留 legacy (Codex Q1 决议·非 24 canonical)
 *
 * R205·Phase 5 P5-ζ Map/UI (2026-05-04·Codex)：
 *   - TM.Map: keep R87 MapSystem alias, add system/converter/integration/display/recognition.
 *   - TM.UI: foundation/cheatsheet/shell/topbar/varDrawers public facades.
 *   - HTML inline-callable globals stay on window until Phase 6.
 *
 * R206·Phase 5 P5-η Endturn (2026-05-04·Codex)：
 *   - TM.Endturn: run/province/qiaozhi public entrypoint facades only.
 *   - tm-endturn-ai-infer.js internals stay black-boxed; diagnostics stay on TM.lastPromptTokens.
 *   - province inline helpers such as _peLijuanPick/_peLijuanClear stay window-only.
 *
 * R207·Phase 5 P5-θ Editor (2026-05-04·Codex)：
 *   - TM.Editor: core/crud/ai/forms/domain/schema/map entrypoint facades.
 *   - Office-owned aiGenChr/aiGenFac/aiGenFullScenario/execFullGen stay in TM.Office.legacy.
 *   - editor-map.js belongs to TM.Editor.map; standalone map editor HTML tools stay outside 24 ns.
 * ============================================================ */
(function(){
  'use strict';
  if (typeof window === 'undefined') return;
  window.TM = window.TM || {};

  var _loadWarnings = [];
  var _scriptEl = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript : null;
  var _skipAutoVerify = !!(_scriptEl && _scriptEl.getAttribute &&
    _scriptEl.getAttribute('data-tm-no-auto-verify') === '1');

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

  /** P5 namespace group: expose existing window globals through stable nested getters. */
  function _buildWindowRefGroup(namespace, refs) {
    var group = {
      _namespace: namespace,
      has: function(name) {
        return Object.prototype.hasOwnProperty.call(refs, name) &&
          typeof window[refs[name]] !== 'undefined';
      },
      list: function() { return Object.keys(refs); },
      listAvailable: function() {
        return Object.keys(refs).filter(function(name) {
          return typeof window[refs[name]] !== 'undefined';
        });
      },
      listMissing: function() {
        return Object.keys(refs).filter(function(name) {
          return typeof window[refs[name]] === 'undefined';
        });
      }
    };
    Object.keys(refs).forEach(function(name) {
      Object.defineProperty(group, name, {
        get: function() { return window[refs[name]]; },
        enumerable: true,
        configurable: false
      });
    });
    return group;
  }

  /** Direct object alias while keeping the legacy window global as the owner. */
  function _defineWindowAlias(target, prop, windowKey) {
    Object.defineProperty(target, prop, {
      get: function() { return window[windowKey]; },
      set: function(value) { window[windowKey] = value; },
      enumerable: true,
      configurable: true
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

  // ─── TM.Map（tm-map-system.js · 17 个真实函数·R208 P6-α: rename from TM.MapSystem） ───
  var MAP_FNS = [
    'initMapSystem', 'assignFactionColors', 'hslToRgb', 'hexToRgb',
    'initTerrainTypes', 'renderMap', 'findPath', 'buildAdjacencyGraph',
    'calculateSupplyLine', 'loadMapFromScenario', 'initGameMap',
    'openMapViewer', 'closeMapViewer', 'toggleTerrainView',
    'addCity', 'setNeighbors', 'updateCityOwner'
  ];
  TM.Map = _buildFacade('Map', MAP_FNS);

  // R106·统一地图入口·解决审计问题 5（双套地图系统）
  // 实际数据源不同·不能合并·但可统一编程接口
  //   mode='terrain'  → 地形/势力图（GM.mapData）·诏书决策时看局势
  //   mode='regions'  → 行政区+势力色（P.map.regions）·军事菜单/快捷面板概览
  // 未来若统一数据模型·只需在此函数内合并·调用点不变
  TM.Map.open = function(mode) {
    mode = mode || 'terrain';
    if (mode === 'regions' && typeof window.showMapInGame === 'function') {
      return window.showMapInGame();
    }
    if (typeof window.openMapViewer === 'function') return window.openMapViewer();
    console.warn('[TM.Map.open] 两套地图函数都不可用');
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

  // ─── TM.register (R118·命名空间闸门) — R143 删除 ───
  // 历史：R118 设计为"主动登记 window 全局"·但实际 0 业务代码使用·只在自测用过
  // R143 决定：未启用的设计不留死信。如未来需要重启·可从 git history 取回。
  // (R118 旧 API: TM.register/registered/registeredModules/registryReport)
  TM.registryReport = function() {
    var by = (TM._registry && TM._registry.byModule) || {};
    return Object.keys(by).sort().map(function(m){
      return { module: m, count: by[m].length, names: by[m].slice() };
    });
  };

  // ─── TM.Save（R113·存档门面·统一 UI/存储契约·R208 P6-α: rename from TM.Storage） ───
  // SaveManager 是纯 UI 协调层·内部已走 TM_SaveDB (IndexedDB+gzip)
  // 新代码应通过 TM.Save.* 访问·旧代码的直接 SaveManager/TM_SaveDB 调用保留兼容
  TM.Save = {
    // UI 层·打开案卷目录/读档对话框等
    openManager:  function() { return (typeof window.openSaveManager === 'function') ? window.openSaveManager() : null; },
    closeManager: function() { return (typeof window.closeSaveManager === 'function') ? window.closeSaveManager() : null; },
    // 槽位读写·委托 SaveManager（它会调 TM_SaveDB）
    saveSlot:     function(slotId, name) { return window.SaveManager ? window.SaveManager.saveToSlot(slotId, name) : false; },
    loadSlot:     function(slotId) { return window.SaveManager ? window.SaveManager.loadFromSlot(slotId) : false; },
    deleteSlot:   function(slotId) { return window.SaveManager ? window.SaveManager.deleteSlot(slotId) : false; },
    listSlots:    function() { return window.SaveManager ? window.SaveManager.getAllSaves() : []; },
    exportSlot:   function(slotId) { return window.SaveManager ? window.SaveManager.exportSave(slotId) : false; },
    importSlot:   function(file, slotId) { return window.SaveManager ? window.SaveManager.importSave(file, slotId) : false; },
    // 底层·直接访问 IndexedDB 门（项目存档/诊断用）
    db: {
      isAvailable: function() { return window.TM_SaveDB ? window.TM_SaveDB.isAvailable() : false; },
      estimate:    function() { return window.TM_SaveDB ? window.TM_SaveDB.estimate() : Promise.resolve({}); },
      persistent:  function() { return window.TM_SaveDB ? window.TM_SaveDB.requestPersistent() : Promise.resolve({ supported: false }); }
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // R200·Phase 5 P5-α reconcile (2026-05-04·Claude)
  //   24 canonical namespaces (与 Codex 共识)·此 slice 只建顶层容器
  //   后续 P5 sub-slice (β/γ/δ/ε/ζ/η/θ) 按 owner 表填充内容
  //
  //   rename (R208 P6-α 退役·原 R200 alias 已删·canonical 直接定义在 R87 段·见 L223/L300)·
  //     TM.MapSystem → TM.Map  (R208 删 alias·canonical = TM.Map)
  //     TM.Storage   → TM.Save (R208 删 alias·canonical = TM.Save)
  //
  //   legacy·TM.Lizhi 不入 24 canonical·Phase 6 决定移到 TM.Office.Lizhi 或 TM.UI.Lizhi
  //
  //   container 待填·P5-β NPC/Char·P5-γ Edict·P5-δ Fiscal/Economy/Guoku/Neitang
  //                  P5-ε Authority/Office/Keju/Corruption/Lizhi
  //                  P5-ζ Map/UI·P5-η Endturn·P5-θ Editor·P5-α Diagnostics meta-add
  // ═══════════════════════════════════════════════════════════════════

  // ─── R208 P6-α (2026-05-04·Claude)·rename alias 退役 ───
  //   原 R200·TM.Map = TM.MapSystem·TM.Save = TM.Storage·alias 期保旧名
  //   现 R208·canonical 直接定义在 R87 段 (L223 / L300)·删 alias·调用方必走新名
  //   production call sites 已改 (tm-game-loop / tm-hongyan-office / test-harness / smokes)

  // ─── 14 个新 canonical 容器·P5-α 只建·后续 sub-slice 填 ───
  TM.Chaoyi     = TM.Chaoyi     || {};  // P5-ε·朝议/廷议/御前
  TM.Wendui     = TM.Wendui     || {};  // P5-ε·问对 (不在 chaoyi-keju 文件·待 audit)
  TM.Endturn    = TM.Endturn    || {};  // P5-η·endTurn pipeline (scope 收窄·只 entrypoint)
  TM.Endturn.AI = TM.Endturn.AI || {};  // P5-η sub·AI 推演
  TM.Military   = TM.Military   || {};  // (待定 owner·tm-military-* / tm-economy-military)
  TM.Fiscal     = TM.Fiscal     || {};  // P5-δ·财政 (R10 后聚)
  TM.Office     = TM.Office     || {};  // P5-ε·官制
  TM.Authority  = TM.Authority  || {};  // P5-ε·权威 (24 ns 新加)
  TM.Corruption = TM.Corruption || {};  // P5-ε·腐败 (24 ns 新加)
  TM.Keju       = TM.Keju       || {};  // P5-ε·科举
  TM.Edict      = TM.Edict      || {};  // P5-γ·诏令 (R12 后)
  TM.NPC        = TM.NPC        || {};  // P5-β·NPC engine/decision (Codex audit·sub-ns 由 β 填)
  TM.Char       = TM.Char       || {};  // P5-β·角色 schema/data (sub-ns 由 β 填)
  TM.UI         = TM.UI         || {};  // P5-ζ·UI 公共 (modal/icons/overlay·P4-β-1 已铺)
  TM.Editor     = TM.Editor     || {};  // P5-θ·编辑器 (sub-ns cluster)
  TM.Memory     = TM.Memory     || {};  // (待定 owner·待 audit)
  TM.Player     = TM.Player     || {};  // (待定 owner·待 audit·tm-player-core 等)
  TM.Diagnostics = TM.Diagnostics || {}; // P4-β-2 已建·此处仅声明 fallback (避免 load 顺序问题)

  // ═══════════════════════════════════════════════════════════════════
  // R201·Phase 5 P5-β NPC/Char facade fill (2026-05-04·Codex)
  //   - 只建立 TM.NPC / TM.Char 分层引用门面，不移动实现，不删除 window alias
  //   - tm-npc-engine.js 内的 CentralizationSystem / TerritoryProductionSystem
  //     属于 fiscal/territory 责任，不纳入 TM.NPC
  //   - _charConfiscate / _charInspect 保留 window inline onclick 兼容，同时挂到 TM.Char.ui
  // ═══════════════════════════════════════════════════════════════════
  _defineWindowAlias(TM.NPC, 'behaviors', 'NpcBehaviorRegistry');
  TM.NPC.decision = _buildWindowRefGroup('NPC.decision', {
    executeNpcBehaviors: 'executeNpcBehaviors',
    batchNpcDecisions: 'batchNpcDecisions',
    npcDecisionLayer: 'npcDecisionLayer',
    buildNpcDecisionPrompt: 'buildNpcDecisionPrompt',
    buildNpcBehaviorContext: 'buildNpcBehaviorContext',
    selectImportantNpcs: 'selectImportantNpcs',
    findNpcOffice: 'findNpcOffice',
    hasOffice: 'hasOffice'
  });
  TM.NPC.personality = _buildWindowRefGroup('NPC.personality', {
    getCharacterPersonalityBrief: 'getCharacterPersonalityBrief',
    getNpcPersonalityInjection: 'getNpcPersonalityInjection'
  });
  _defineWindowAlias(TM.Char, 'schema', 'CharFullSchema');
  _defineWindowAlias(TM.Char, 'economy', 'CharEconEngine');
  _defineWindowAlias(TM.Char, 'arcs', 'CharArcs');
  TM.Char.autogen = _buildWindowRefGroup('Char.autogen', {
    aiGenerateCompleteCharacter: 'aiGenerateCompleteCharacter',
    edictRecruitCharacter: 'edictRecruitCharacter',
    parseEdictRecruitPatterns: 'parseEdictRecruitPatterns',
    handleEdictTextForRecruit: 'handleEdictTextForRecruit',
    crystallizePendingCharacter: 'crystallizePendingCharacter',
    addPendingCharacter: 'addPendingCharacter',
    scanMentionedCharacters: 'scanMentionedCharacters',
    wrapPendingName: 'wrapPendingName',
    decoratePendingInDom: 'decoratePendingInDom',
    purgeBlacklistedCharacters: 'purgeBlacklistedCharacters'
  });
  TM.Char.historical = _buildWindowRefGroup('Char.historical', {
    profiles: 'HISTORICAL_CHAR_PROFILES',
    listByDynasty: 'listProfilesByDynasty',
    listByRole: 'listProfilesByRole',
    createFromProfile: 'createCharFromProfile',
    loadFromScenario: 'loadHistoricalCharsFromScenario'
  });
  TM.Char.ui = _buildWindowRefGroup('Char.ui', {
    renderResourcesSection: 'renderCharResourcesSection',
    confiscate: '_charConfiscate',
    inspect: '_charInspect'
  });

  // ═══════════════════════════════════════════════════════════════════
  // R202·Phase 5 P5-γ Edict facade fill (2026-05-04·Claude)
  //   - 4 sub-ns·parser (R12b inline 后 v2)·complete (v1)·lifecycle·thresholds
  //   - sub-ns 强隔离·EDICT_TYPES 两版本不同 (parser 17 详定义 / lifecycle 11 大类)
  //   - HTML inline-callable (openEdictHelp/openMemorialsPanel/openFuyiSchemeComparison
  //     /_processAbduction/classifyEdict 等) 留 window·Phase 6 才动 (Q4 决议)
  //   - tm-edict-thresholds 历史命名 PhaseG3·alias 入 .thresholds·命名清晰
  // ═══════════════════════════════════════════════════════════════════
  _defineWindowAlias(TM.Edict, 'parser', 'EdictParser');
  _defineWindowAlias(TM.Edict, 'complete', 'EdictComplete');
  _defineWindowAlias(TM.Edict, 'thresholds', 'PhaseG3');
  TM.Edict.lifecycle = _buildWindowRefGroup('Edict.lifecycle', {
    EDICT_TYPES: 'EDICT_TYPES',                // 11 大类·与 parser.EDICT_TYPES (17 详定义) 是不同对象
    EDICT_STAGES: 'EDICT_STAGES',
    REFORM_PHASES: 'REFORM_PHASES',
    RESISTANCE_SOURCES: 'RESISTANCE_SOURCES',
    classifyEdict: 'classifyEdict',
    calcEdictMultiplier: 'calcEdictMultiplier',
    estimateResistance: 'estimateResistance',
    generateEdictForecast: 'generateEdictForecast',
    daysToTurns: 'daysToTurns',
    getEdictLifecycleTurns: 'getEdictLifecycleTurns',
    getReformPhaseTurns: 'getReformPhaseTurns',
    formatLifecycleForScript: 'formatLifecycleForScript'
  });
  TM.Edict.legacy = _buildWindowRefGroup('Edict.legacy', {
    PhaseC: 'PhaseC',                          // R12b defensive shim·init 是 no-op
    TM_THRESHOLDS: 'TM_THRESHOLDS'             // scenario JSON config·留 window 也保 alias
  });

  // ═══════════════════════════════════════════════════════════════════
  // R203·Phase 5 P5-δ Fiscal/Economy/Guoku/Neitang facade fill (2026-05-04·Claude)
  //   - 4 canonical namespace 一并填·因 fiscal/economy/guoku/neitang 跨域耦合
  //   - **TM.Fiscal**·R10 redistribute 后主财政·.engine .cascade .fixedExpense .legacy
  //   - **TM.Economy** R87 facade 上挂 7 sub·.core .linkage .currency .currencyUnit
  //                   .envCapacity .eventBus .gapFill (顶层 R87 whitelist 留)
  //   - **TM.Guoku** R87 panel facade 上挂 .engine sub (双向 alias 与 TM.GuokuEngine)
  //   - **TM.Neitang** R87 panel facade 上挂 .engine sub
  //   - reconcile·tm-fiscal-engine.js L1746-1751 dead code 已删 (R87 facade overwrite)
  //                Economy.sum 等 4 alias 改在此处接 CascadeTax 透传·保 changelog 契约
  //   - 命名冲突·tick 跨 11 个 engine·sub-ns 强隔离 (smoke 显式 assert)
  // ═══════════════════════════════════════════════════════════════════

  // ─── TM.Fiscal·R10 redistribute 后主财政 ───
  _defineWindowAlias(TM.Fiscal, 'engine',       'FiscalEngine');     // R10·12+ keys api
  _defineWindowAlias(TM.Fiscal, 'cascade',      'CascadeTax');       // v2·12 keys·级联税
  _defineWindowAlias(TM.Fiscal, 'fixedExpense', 'FixedExpense');     // v2·6 keys·固定支出
  TM.Fiscal.legacy = _buildWindowRefGroup('Fiscal.legacy', {
    PhaseH: 'PhaseH'                                                  // R10 历史 phase-h 命名 alias
  });

  // ─── TM.Economy·R87 facade 上挂 7 sub-engine ───
  // (R87 _buildFacade 用 Object.defineProperty 但 object 仍 extensible·新 key 可加)
  _defineWindowAlias(TM.Economy, 'core',         'EconomyCore');      // formulaEstimateWealth·v1
  _defineWindowAlias(TM.Economy, 'linkage',      'EconomyLinkage');   // borrow/donate/forceLevy/governance·v1
  _defineWindowAlias(TM.Economy, 'currency',     'CurrencyEngine');   // 25 纸币·R10b·v1
  _defineWindowAlias(TM.Economy, 'currencyUnit', 'CurrencyUnit');     // unit conversion·R10b
  _defineWindowAlias(TM.Economy, 'envCapacity',  'EnvCapacityEngine');// SCAR/CRISIS/POLICY·v1
  _defineWindowAlias(TM.Economy, 'eventBus',     'EconomyEventBus');
  _defineWindowAlias(TM.Economy, 'gapFill',      'EconomyGapFill');   // R7 collapse·v1
  // ─── R10 dead-code rescue·changelog 契约保 ───
  // CascadeTax 已暴露 sumEconomyBase/getDivEconomy/getTopContributors/triggerSurvey
  // 这里 alias 绑·TM.Economy.sum 即 TM.Fiscal.cascade.sumEconomyBase·alias 期保
  Object.defineProperty(TM.Economy, 'sum', {
    get: function() { return window.CascadeTax && window.CascadeTax.sumEconomyBase; },
    enumerable: true, configurable: true
  });
  Object.defineProperty(TM.Economy, 'getDiv', {
    get: function() { return window.CascadeTax && window.CascadeTax.getDivEconomy; },
    enumerable: true, configurable: true
  });
  Object.defineProperty(TM.Economy, 'topContributors', {
    get: function() { return window.CascadeTax && window.CascadeTax.getTopContributors; },
    enumerable: true, configurable: true
  });
  Object.defineProperty(TM.Economy, 'triggerSurvey', {
    get: function() { return window.CascadeTax && window.CascadeTax.triggerSurvey; },
    enumerable: true, configurable: true
  });

  // ─── TM.Guoku·R87 panel facade 上挂 .engine sub·与 TM.GuokuEngine 双向 alias ───
  _defineWindowAlias(TM.Guoku, 'engine', 'GuokuEngine');
  // TM.GuokuEngine (R87 engine proxy) 仍保·两者通过 window.GuokuEngine 同源

  // ─── TM.Neitang·R87 panel facade 上挂 .engine sub ───
  _defineWindowAlias(TM.Neitang, 'engine', 'NeitangEngine');

  // ═══════════════════════════════════════════════════════════════════
  // R204·Phase 5 P5-ε Authority/Office/Keju/Corruption (2026-05-04·Claude)
  //   - **TM.Authority**·.engines (R12c phase-f1 inline)·.complete·.legacy{PhaseF1,F4,G1}
  //   - **TM.Corruption**·.engine (R9 p2/p4 merged·v1)
  //   - **TM.Office**·.system (R6 hongyan-office carve)·runtime/editor/panel HTML inline 留 window
  //   - **TM.Keju**·.runtime (主入口·HTML inline 留 window 大部分)
  //   - **TM.Lizhi 保 R87 legacy facade·不入 24 canonical** (Codex Q1 决议)
  //   - HTML inline-callable 全部留 window (open*Inspection/_keyi*/aiGen* 等·Q4)
  // ═══════════════════════════════════════════════════════════════════

  // ─── TM.Authority·R12c 后聚集·main engines ───
  _defineWindowAlias(TM.Authority, 'engines',  'AuthorityEngines');   // v1·24 keys·R12c phase-f1 inline
  _defineWindowAlias(TM.Authority, 'complete', 'AuthorityComplete');
  TM.Authority.legacy = _buildWindowRefGroup('Authority.legacy', {
    PhaseF1: 'PhaseF1',                                                // R12c historical alias
    PhaseF4: 'PhaseF4',                                                // tm-authority-deep
    PhaseG1: 'PhaseG1',                                                // tm-authority-ui
    _adjAuthority: '_adjAuthority',                                    // helper alias
    applyTyrantExecutionAmplification: 'applyTyrantExecutionAmplification',
    filterQueryOptionsByPhase: 'filterQueryOptionsByPhase',
    checkDecreeRealtime: 'checkDecreeRealtime'
  });

  // ─── TM.Corruption·R9 p2/p4 merged·single engine ───
  _defineWindowAlias(TM.Corruption, 'engine', 'CorruptionEngine');    // v1·16 keys

  // ─── TM.Office·R6 hongyan-office carve + 4 大文件 HTML inline 主导 ───
  // tm-office-system (741) 是 R6 carve 出的 office API·sub-ns 入
  // tm-office-runtime/editor/panel 全 HTML inline (_off*/aiGen*/canPerformAction)·留 window
  TM.Office.system = _buildWindowRefGroup('Office.system', {
    canPerformAction: 'canPerformAction',
    findPositionByCharName: '_findPositionByCharName'
  });
  // sub-ns·HTML inline 主入口 (Phase 6 才动)
  TM.Office.legacy = _buildWindowRefGroup('Office.legacy', {
    aiGenChr: 'aiGenChr',                                              // tm-office-editor·HTML inline
    aiGenFac: 'aiGenFac',
    aiGenFullScenario: 'aiGenFullScenario',
    execFullGen: 'execFullGen'
  });

  // ─── TM.Keju·HTML inline 主导·主入口 alias ───
  TM.Keju.runtime = _buildWindowRefGroup('Keju.runtime', {
    startKejuByMethod: 'startKejuByMethod',                            // tm-keju.js
    resolveKejuCouncilResult: 'resolveKejuCouncilResult',
    kejuConsultCourtier: 'kejuConsultCourtier',
    kejuConsultGuanGe: 'kejuConsultGuanGe',
    openDianshiDelegatePicker: 'openDianshiDelegatePicker',
    confirmFinalRanking: 'confirmFinalRanking',                        // tm-keju-runtime.js
    crystallizeKejuGrad: 'crystallizeKejuGrad',
    openKeyiSession: 'openKeyiSession',
    closeKeyi: 'closeKeyi'
  });

  // ─── TM.Lizhi·legacy facade 不重建·R87 已建 22 fn whitelist ───
  // Codex Q1 决议·Lizhi 不入 24 canonical·Phase 6 决定移到 TM.Office.Lizhi 或 TM.UI.Lizhi
  // 此处 nothing 改·R87 facade 自然留·调用方 TM.Lizhi.X 仍 valid

  // ═══════════════════════════════════════════════════════════════════
  // R205·Phase 5 P5-ζ Map/UI facade fill (2026-05-04·Codex)
  //   - TM.Map remains the canonical alias of R87 TM.MapSystem.
  //   - Map helper internals such as _mapCfg/_miFindPath/floodFill stay private globals.
  //   - TM.UI exposes shared UI infrastructure only; business panels stay in their domain facades.
  //   - TM.Lizhi is intentionally not nested under TM.UI in Phase 5.
  // ═══════════════════════════════════════════════════════════════════

  // ─── TM.Map·system + map toolchain ───
  // R208 P6-α: TM.MapSystem alias 已退役·.system 直指 R87 facade (TM.Map 自身·见 L223)
  TM.Map.system = TM.Map;
  TM.Map.converter = _buildWindowRefGroup('Map.converter', {
    convertLeafletToGame: 'convertLeafletToGame',
    convertGameToGeoJSON: 'convertGameToGeoJSON',
    convertVoronoiToGame: 'convertVoronoiToGame',
    convertGeoJSONToGame: 'convertGeoJSONToGame',
    loadMapToScriptData: 'loadMapToScriptData',
    loadMapToGame: 'loadMapToGame',
    loadMapFromURL: 'loadMapFromURL',
    validateMapData: 'validateMapData'
  });
  TM.Map.integration = _buildWindowRefGroup('Map.integration', {
    generateMapContextForAI: 'generateMapContextForAI',
    findBorderConflicts: 'findBorderConflicts',
    generateProvinceContextForAI: 'generateProvinceContextForAI',
    calculateStrategicValue: 'calculateStrategicValue',
    getTerrainName: 'getTerrainName',
    getTerrainCombatModifier: 'getTerrainCombatModifier',
    calculateDistance: 'calculateDistance',
    calculateMovementCost: 'calculateMovementCost',
    canSupply: 'canSupply',
    applyAIMapChanges: 'applyAIMapChanges',
    getMapInfluenceRules: 'getMapInfluenceRules'
  });
  TM.Map.display = _buildWindowRefGroup('Map.display', {
    renderGameMap: 'renderGameMap',
    showMapInGame: 'showMapInGame',
    closeGameMap: 'closeGameMap',
    showProvinceDetails: 'showProvinceDetails'
  });
  TM.Map.recognition = _buildWindowRefGroup('Map.recognition', {
    recognizeMapRegions: 'recognizeMapRegions',
    loadAndRecognizeMap: 'loadAndRecognizeMap',
    showRecognitionProgress: 'showRecognitionProgress',
    hideRecognitionProgress: 'hideRecognitionProgress',
    recognizeMapByBorders: 'recognizeMapByBorders',
    smartRecognizeMap: 'smartRecognizeMap',
    loadAndRecognizeMapByBorders: 'loadAndRecognizeMapByBorders',
    recognizeMapByBordersFast: 'recognizeMapByBordersFast',
    loadAndRecognizeMapByBordersFast: 'loadAndRecognizeMapByBordersFast',
    recognizeMapByBordersImproved: 'recognizeMapByBordersImproved',
    loadAndRecognizeMapByBordersImproved: 'loadAndRecognizeMapByBordersImproved',
    recognizeMapEU4Style: 'recognizeMapEU4Style',
    loadAndRecognizeMapEU4Style: 'loadAndRecognizeMapEU4Style'
  });

  // ─── TM.UI·public UI entrypoints ───
  TM.UI.foundation = _buildWindowRefGroup('UI.foundation', {
    TM_ICONS: 'TM_ICONS',
    tmIcon: 'tmIcon',
    gv: 'gv',
    openGenericModal: 'openGenericModal',
    closeGenericModal: 'closeGenericModal',
    showModal: 'showModal',
    closeModal: 'closeModal'
  });
  Object.defineProperty(TM.UI, 'cheatsheet', {
    get: function() { return TM.cheatsheet; },
    set: function(value) { TM.cheatsheet = value; },
    enumerable: true,
    configurable: true
  });
  TM.UI.shell = _buildWindowRefGroup('UI.shell', {
    openSideDrawer: 'openSideDrawer',
    closeSideDrawer: 'closeSideDrawer',
    renderLeft: '_renderShellExtrasLeft',
    renderRight: '_renderShellExtrasRight',
    applyTheme: '_tmApplyTheme',
    applySize: '_tmApplySize',
    applyBodyFont: '_tmApplyBodyFont',
    applyTitleFont: '_tmApplyTitleFont'
  });
  TM.UI.topbar = _buildWindowRefGroup('UI.topbar', {
    vars: 'TOP_BAR_VARS',
    render: 'renderTopBarVars',
    openAllVarsModal: 'openAllVarsModal',
    closeAllVarsModal: 'closeAllVarsModal'
  });
  TM.UI.varDrawers = _buildWindowRefGroup('UI.varDrawers', {
    openHukouPanel: 'openHukouPanel',
    closeHukouPanel: 'closeHukouPanel',
    renderHukouPanel: 'renderHukouPanel',
    openMinxinPanel: 'openMinxinPanel',
    closeMinxinPanel: 'closeMinxinPanel',
    renderMinxinPanel: 'renderMinxinPanel',
    openHuangquanPanel: 'openHuangquanPanel',
    closeHuangquanPanel: 'closeHuangquanPanel',
    renderHuangquanPanel: 'renderHuangquanPanel',
    openHuangweiPanel: 'openHuangweiPanel',
    closeHuangweiPanel: 'closeHuangweiPanel',
    renderHuangweiPanel: 'renderHuangweiPanel',
    final: 'VarDrawersFinal'
  });
  TM.UI.tabs = _buildWindowRefGroup('UI.tabs', {
    switchGameTab: 'switchGTab'
  });
  TM.UI.turnResult = _buildWindowRefGroup('UI.turnResult', {
    closeTurnResult: 'closeTurnResult',
    navTurn: '_trNavTurn',
    exportCurrent: '_trExportCurrent'
  });

  // ═══════════════════════════════════════════════════════════════════
  // R206·Phase 5 P5-η Endturn facade fill (2026-05-04·Codex)
  //   - Endturn is mostly an internal pipeline; expose only stable public entrypoints.
  //   - AI infer/subcall internals stay private and are not mirrored under TM.Endturn.AI.
  //   - HTML inline province helpers stay on window until Phase 6 audit.
  // ═══════════════════════════════════════════════════════════════════

  TM.Endturn.run = _buildWindowRefGroup('Endturn.run', {
    endTurn: 'endTurn',
    confirmEndTurn: 'confirmEndTurn'
  });
  TM.Endturn.province = _buildWindowRefGroup('Endturn.province', {
    openProvinceEconomy: 'openProvinceEconomy',
    openDivisionDetail: 'openDivisionDetail'
  });
  TM.Endturn.qiaozhi = _buildWindowRefGroup('Endturn.qiaozhi', {
    openQiaozhiPanel: 'openQiaozhiPanel',
    doQiaozhi: 'doQiaozhi',
    restoreQiaozhiDivision: 'restoreQiaozhiDivision'
  });

  // ═══════════════════════════════════════════════════════════════════
  // R207·Phase 5 P5-θ Editor facade fill (2026-05-04·Codex)
  //   - Editor remains HTML-inline heavy; this facade groups stable entrypoints only.
  //   - Office-owned AI generators stay in TM.Office.legacy to avoid duplicate domain ownership.
  //   - editor-map.js is editor tooling and is intentionally separate from runtime TM.Map.
  // ═══════════════════════════════════════════════════════════════════

  TM.Editor.core = _buildWindowRefGroup('Editor.core', {
    openEditorModal: 'openEditorModal',
    closeEditorModal: 'closeEditorModal',
    openGenericModal: 'openGenericModal',
    closeGenericModal: 'closeGenericModal',
    openFullGenModal: 'openFullGenModal',
    closeFullGenModal: 'closeFullGenModal',
    saveScript: 'saveScript',
    loadScript: 'loadScript',
    renderAll: 'renderAll',
    cloneScript: 'cloneScript',
    quickTestScenario: 'quickTestScenario'
  });
  TM.Editor.crud = _buildWindowRefGroup('Editor.crud', {
    editChr: 'editChr',
    saveChrEdit: 'saveChrEdit',
    renderItmTab: 'renderItmTab',
    editItm: 'editItm',
    renderRulTab: 'renderRulTab',
    renderEvtTab: 'renderEvtTab',
    renderFacTab: 'renderFacTab',
    renderClassTab: 'renderClassTab',
    editClass2: 'editClass2',
    renderWldTab: 'renderWldTab',
    renderTechTab: 'renderTechTab',
    editTech2: 'editTech2',
    openTraitSelectorModal: 'openTraitSelectorModal'
  });
  TM.Editor.ai = _buildWindowRefGroup('Editor.ai', {
    openAIGenModal: 'openAIGenModal',
    closeAIGenModal: 'closeAIGenModal',
    doAIGenerate: 'doAIGenerate',
    aiGeneratePlayerFaction: 'aiGeneratePlayerFaction',
    aiGeneratePlayerCharacter: 'aiGeneratePlayerCharacter',
    callAIEditor: 'callAIEditor',
    callAIEditorSmart: 'callAIEditorSmart',
    aiGenItems: 'aiGenItems',
    aiGenRules: 'aiGenRules',
    aiGenEvents: 'aiGenEvents',
    aiGenClasses: 'aiGenClasses',
    aiGenWorld: 'aiGenWorld',
    aiGenTech: 'aiGenTech',
    aiGenFiscalConfig: 'aiGenFiscalConfig',
    aiGenPopulationConfig: 'aiGenPopulationConfig',
    aiGenEnvironmentConfig: 'aiGenEnvironmentConfig',
    aiGenAuthorityConfig: 'aiGenAuthorityConfig',
    aiGenFactionRelations: 'aiGenFactionRelations',
    aiPolishStructuredField: 'aiPolishStructuredField',
    aiPolishCharFamilyMembers: 'aiPolishCharFamilyMembers',
    aiPolishRegionOverrides: 'aiPolishRegionOverrides',
    aiPolishCustomTaxes: 'aiPolishCustomTaxes',
    aiGenerateGoals: 'aiGenerateGoals',
    aiGenerateOffendGroups: 'aiGenerateOffendGroups',
    aiGenerateEconomyConfig: 'aiGenerateEconomyConfig',
    aiGenerateAdminHierarchy: 'aiGenerateAdminHierarchy',
    aiExpandAdminChildren: 'aiExpandAdminChildren',
    aiGenDivisionDeep: 'aiGenDivisionDeep'
  });
  TM.Editor.forms = _buildWindowRefGroup('Editor.forms', {
    renderImperialEdictsList: 'renderImperialEdictsList',
    addImperialEdictEntry: 'addImperialEdictEntry',
    editImperialEdictEntry: 'editImperialEdictEntry',
    deleteImperialEdictEntry: 'deleteImperialEdictEntry',
    renderGoalsList: 'renderGoalsList',
    addGoalEntry: 'addGoalEntry',
    editGoalEntry: 'editGoalEntry',
    deleteGoalEntry: 'deleteGoalEntry',
    renderInfluenceGroupsList: 'renderInfluenceGroupsList',
    addInfluenceGroupEntry: 'addInfluenceGroupEntry',
    editInfluenceGroup: 'editInfluenceGroup',
    deleteInfluenceGroup: 'deleteInfluenceGroup',
    renderOffendGroupsList: 'renderOffendGroupsList',
    addOffendGroupEntry: 'addOffendGroupEntry',
    editOffendGroup: 'editOffendGroup',
    deleteOffendGroup: 'deleteOffendGroup',
    renderTimeline: 'renderTimeline',
    addTimeline: 'addTimeline'
  });
  TM.Editor.domain = _buildWindowRefGroup('Editor.domain', {
    renderEconomyConfig: 'renderEconomyConfig',
    updateEconomyConfig: 'updateEconomyConfig',
    renderPostSystem: 'renderPostSystem',
    updatePostSystemConfig: 'updatePostSystemConfig',
    renderVassalSystem: 'renderVassalSystem',
    updateVassalSystemConfig: 'updateVassalSystemConfig',
    renderTitleSystem: 'renderTitleSystem',
    updateTitleSystemConfig: 'updateTitleSystemConfig',
    renderBuildingSystem: 'renderBuildingSystem',
    updateBuildingSystemConfig: 'updateBuildingSystemConfig',
    getCurrentAdminHierarchy: 'getCurrentAdminHierarchy',
    initAdministrationPanel: 'initAdministrationPanel',
    renderAdminTree: 'renderAdminTree',
    addAdminDivision: 'addAdminDivision',
    editAdminDivision: 'editAdminDivision',
    deleteAdminDivision: 'deleteAdminDivision',
    renderMappingList: 'renderMappingList',
    autoMapDivisions: 'autoMapDivisions',
    clearAllMappings: 'clearAllMappings',
    renderOfficeConfig: 'renderOfficeConfig',
    openFiscalConfigEditor: 'openFiscalConfigEditor',
    openCorruptionConfigEditor: 'openCorruptionConfigEditor',
    renderMilitary: 'renderMilitary',
    renderMilitaryNew: 'renderMilitaryNew',
    renderHaremConfig: 'renderHaremConfig',
    renderPalaceSystem: 'renderPalaceSystem',
    renderContradictions: 'renderContradictions',
    renderWarConfig: 'renderWarConfig',
    renderDiplomacyConfig: 'renderDiplomacyConfig',
    renderDecisionConfig: 'renderDecisionConfig',
    renderNpcBehaviors: 'renderNpcBehaviors',
    officeDeep: 'TM_OfficeDeep',
    renderDivisionDeepFieldsHTML: 'renderDivisionDeepFieldsHTML',
    collectDivisionDeepFromForm: 'collectDivisionDeepFromForm'
  });
  TM.Editor.schema = _buildWindowRefGroup('Editor.schema', {
    renderOfficeSubtabs: 'renderOfficeSubtabs',
    addOfficeSubtab: 'addOfficeSubtab',
    editOfficeSubtab: 'editOfficeSubtab',
    deleteOfficeSubtab: 'deleteOfficeSubtab',
    renderOfficeClassifierPatterns: 'renderOfficeClassifierPatterns',
    addOfficeClassifierPattern: 'addOfficeClassifierPattern',
    editOfficeClassifierPattern: 'editOfficeClassifierPattern',
    deleteOfficeClassifierPattern: 'deleteOfficeClassifierPattern',
    renderOfficialRanks: 'renderOfficialRanks',
    saveOfficialRanksFromTextarea: 'saveOfficialRanksFromTextarea',
    renderConcurrentTitleCatalog: 'renderConcurrentTitleCatalog',
    addConcurrentTitle: 'addConcurrentTitle',
    editConcurrentTitle: 'editConcurrentTitle',
    deleteConcurrentTitle: 'deleteConcurrentTitle',
    renderInquiryBodyCatalog: 'renderInquiryBodyCatalog',
    addInquiryBody: 'addInquiryBody',
    editInquiryBody: 'editInquiryBody',
    deleteInquiryBody: 'deleteInquiryBody',
    renderModelRequirements: 'renderModelRequirements',
    saveModelRequirements: 'saveModelRequirements'
  });
  _defineWindowAlias(TM.Editor.schema, 'adapter', 'SchemaAdapter');
  TM.Editor.map = _buildWindowRefGroup('Editor.map', {
    renderMapSystem: 'renderMapSystem',
    updateMapSystemConfig: 'updateMapSystemConfig',
    addMapCity: 'addMapCity',
    editMapCity: 'editMapCity',
    deleteMapCity: 'deleteMapCity',
    exportMapData: 'exportMapData',
    importMapData: 'importMapData',
    renderMapEditorPreview: 'renderMapEditorPreview',
    generateVoronoiMapInEditor: 'generateVoronoiMapInEditor',
    editPolygonVertices: 'editPolygonVertices'
  });

  // ═══════════════════════════════════════════════════════════════════
  // R200 end
  // ═══════════════════════════════════════════════════════════════════

  // ─── 全局汇总 ───
  function _verify() {
    var out = {};
    var warnings = [];
    var listFacades = { Economy: TM.Economy, Map: TM.Map,
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
    // ─── R87 whitelist facades (R208 P6-α: MapSystem alias 退役·canonical = Map) ───
    Economy: TM.Economy,
    Map: TM.Map,                // R87 facade·rename in-place from TM.MapSystem (R208)
    Lizhi: TM.Lizhi,            // legacy·Phase 7 决定移 TM.Office.Lizhi 或 TM.UI.Lizhi
    Guoku: TM.Guoku,
    Neitang: TM.Neitang,
    // ─── R87 engine proxies (留) ───
    HujiEngine: TM.HujiEngine,
    GuokuEngine: TM.GuokuEngine,
    ChangeQueue: TM.ChangeQueue,
    // ─── R113 Save (R208 P6-α: Storage alias 退役·canonical = Save) ───
    Save: TM.Save,              // R113 storage facade·rename in-place from TM.Storage (R208)
    // ─── R200·14 新 canonical 容器 (P5-α 建·后续 sub-slice 填) ───
    Chaoyi: TM.Chaoyi,
    Wendui: TM.Wendui,
    Endturn: TM.Endturn,
    Military: TM.Military,
    Fiscal: TM.Fiscal,
    Office: TM.Office,
    Authority: TM.Authority,
    Corruption: TM.Corruption,
    Keju: TM.Keju,
    Edict: TM.Edict,
    NPC: TM.NPC,
    Char: TM.Char,
    UI: TM.UI,
    Editor: TM.Editor,
    Memory: TM.Memory,
    Player: TM.Player,
    Diagnostics: TM.Diagnostics, // P4-β-2 建·R200 加入 meta
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
  if (typeof document !== 'undefined' && !_skipAutoVerify) {
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
