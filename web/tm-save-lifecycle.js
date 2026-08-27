// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// tm-save-lifecycle.js — 存档读档生命周期 (R131 从 tm-audio-theme.js L558-1498 拆出)
// 姊妹: tm-audio-theme.js (音频+主题) + tm-office-editor.js (官制编辑器)
// 包含: _safeClone/_ensureGMDefaults/_ensurePDefaults/_prepareGMForSave/
//       _restoreSavedFields/fullLoadGame
// 这是真正的存档管道核心·与 tm-storage.js (IndexedDB) + SaveManager (UI) 三层协作
// ============================================================

// 移植 S0.4 + S1.x 纠正：存档「走不走 window.tianming IPC 磁盘路」看 IPC 桥 caps.ipc（仅 electron）。
//   存档原生分支内部直接 window.tianming.saveProject/…，capacitor 上为 null；故 capacitor 必须走 web 路。
//   electron→ipc=true（≡ 旧 isDesktop·零回归）·web→false（≡ 旧）·capacitor→false（复用 web IndexedDB）。
//   注：caps.fs（capacitor=true）代表「有原生 FS 插件」，留给 S1.2 把存档真路由进 TM.platform.saves→Filesystem 后才启用；
//       在那之前 capacitor 复用 web/IndexedDB 存储路，故这里读 ipc 不读 fs。
function _tmHasNativeFs(){
  if (window.TM && window.TM.platform && window.TM.platform.caps) return !!window.TM.platform.caps.ipc;
  return !!(window.tianming && window.tianming.isDesktop); // TM.platform 未就绪时兜底
}


// ============================================================
//  存档读档优化 + 最终查漏
// ============================================================

// 1. 存档：确保包含所有数据

// 安全深拷贝辅助
function _safeClone(obj) {
  if (!obj) return obj;
  return typeof deepClone === 'function' ? deepClone(obj) : JSON.parse(JSON.stringify(obj));
}

function _tmHasOwn(obj, key) {
  return !!obj && Object.prototype.hasOwnProperty.call(obj, key);
}

function _tmEnsureCampaignId(gm) {
  if (!gm) return '';
  var id = typeof gm._campaignId === 'string' ? gm._campaignId.trim() : '';
  if (!id || id.length > 128 || !/^[A-Za-z0-9_-]+$/.test(id)) {
    try {
      if (typeof window !== 'undefined' && typeof window._tmNewCampaignId === 'function') id = window._tmNewCampaignId();
    } catch (_) {}
    if (!id) id = 'tmc_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 14);
  }
  gm._campaignId = id;
  return id;
}

function _tmEnsureTimelineIdentity(gm) {
  if (!gm) return '';
  try {
    if (typeof window !== 'undefined' && typeof window._tmEnsureTimelineId === 'function') {
      return window._tmEnsureTimelineId(gm);
    }
  } catch (_) {}
  var id = typeof gm._timelineId === 'string' ? gm._timelineId.trim() : '';
  if (!id || id.length > 128 || !/^tml_[A-Za-z0-9_-]+$/.test(id)) {
    try {
      if (gm._campaignId && typeof window !== 'undefined' && typeof window._tmLegacyTimelineId === 'function') {
        id = window._tmLegacyTimelineId(gm._campaignId);
      }
    } catch (_) {}
    if (!id) id = 'tml_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 14);
  }
  gm._timelineId = id;
  return id;
}

function _tmForkLoadedTimeline(gm, reason) {
  if (!gm) return '';
  try {
    if (typeof window !== 'undefined' && typeof window._tmForkTimeline === 'function') {
      return window._tmForkTimeline(gm, reason || 'load');
    }
  } catch (_) {}
  var parent = _tmEnsureTimelineIdentity(gm);
  var next = 'tml_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 14);
  gm._parentTimelineId = parent;
  gm._timelineId = next;
  gm._forkTurn = Number.isSafeInteger(Number(gm.turn)) ? Number(gm.turn) : 0;
  gm._timelineForkReason = String(reason || 'load').slice(0, 80);
  return next;
}

function _tmAwaitLoadBarrier() {
  var barrier = (typeof window !== 'undefined') ? window._tmLoadBarrier : null;
  return (barrier && typeof barrier.then === 'function' ? barrier : Promise.resolve(true)).then(function(result) {
    if (result !== true) throw new Error('读档尚未完整完成，保存与过回合已阻止');
    return true;
  });
}

// 确保 GM 所有字段存在默认值（存档前/读档后统一调用）
// F2 势力活世界总闸·翻默认 ON 迁移 + 启动竞态自愈的【单一真源】规则(normalizer 与 tm:p-restored 自愈两处同调·避免逻辑分叉·Codex 二轮 B)。
//   带用户意图戳(_factionLivingWorldSetByUser) → 尊重存档值(仅异常值兜底 ON)；
//   无戳(含旧档旧 normalizer 写死的自动 false·或启动时完整 P 迟到、镜像尚未到) → 取跨局默认镜像 P.conf.factionLivingWorldDefault(是 boolean 才认)否则翻默认 ON。
function _tmReconcileFactionLivingWorld(gm, p) {
  if (!gm) return;
  if (gm._factionLivingWorldSetByUser) {
    if (typeof gm._factionLivingWorld !== 'boolean') gm._factionLivingWorld = true;   // 带戳·尊重存档值(仅异常值兜底 ON)
    return;
  }
  gm._factionLivingWorld = (p && p.conf && typeof p.conf.factionLivingWorldDefault === 'boolean') ? p.conf.factionLivingWorldDefault : true;   // 无戳→取跨局镜像·否则翻默认 ON
}

function _tmNormalizeCoreWorldCollections(gm) {
  if (!gm || typeof gm !== 'object') {
    var rootError = new Error('存档 gameState 不是可恢复的对象');
    rootError.code = 'save-core-schema-invalid';
    throw rootError;
  }
  var diagnostics = [];
  function normalizeArray(key) {
    var value = gm[key];
    if (value === undefined || value === null) {
      gm[key] = [];
      diagnostics.push({ field: key, action: 'default-array' });
      return;
    }
    if (Array.isArray(value)) return;
    if (typeof value === 'object' && Object.keys(value).length === 0) {
      gm[key] = [];
      diagnostics.push({ field: key, action: 'repair-empty-object-to-array' });
      return;
    }
    var error = new Error('存档核心集合 GM.' + key + ' 应为数组，且含有无法安全迁移的数据');
    error.code = 'save-core-schema-invalid';
    error.field = key;
    throw error;
  }
  function normalizeObject(key) {
    var value = gm[key];
    if (value === undefined || value === null) {
      gm[key] = {};
      diagnostics.push({ field: key, action: 'default-object' });
      return;
    }
    if (typeof value === 'object' && !Array.isArray(value)) return;
    if (Array.isArray(value) && value.length === 0) {
      gm[key] = {};
      diagnostics.push({ field: key, action: 'repair-empty-array-to-object' });
      return;
    }
    var error = new Error('存档核心集合 GM.' + key + ' 应为对象，且含有无法安全迁移的数据');
    error.code = 'save-core-schema-invalid';
    error.field = key;
    throw error;
  }
  normalizeObject('vars');
  normalizeObject('rels');
  normalizeArray('chars');
  normalizeArray('facs');
  normalizeArray('officeTree');
  if (diagnostics.length) {
    if (!Array.isArray(gm._schemaNormalizationDiagnostics)) gm._schemaNormalizationDiagnostics = [];
    Array.prototype.push.apply(gm._schemaNormalizationDiagnostics, diagnostics.map(function(row) {
      return { turn: Number(gm.turn) || 0, field: row.field, action: row.action };
    }));
    if (gm._schemaNormalizationDiagnostics.length > 50) {
      gm._schemaNormalizationDiagnostics = gm._schemaNormalizationDiagnostics.slice(-50);
    }
  }
  return { ok: true, diagnostics: diagnostics };
}
if (typeof window !== 'undefined') window._tmNormalizeCoreWorldCollections = _tmNormalizeCoreWorldCollections;
// 启动竞态自愈：桌面端每 5 次自动存档曾把 lite 覆写成无 conf(现已在 saveP/autoSave 两处补 conf)——历史 lite 仍可能无镜像。
//   完整 P 异步恢复晚到时 tm-utils 派 tm:p-restored·此处按同一真源用刚恢复的 P.conf.factionLivingWorldDefault 重算 GM._factionLivingWorld·
//   消除「无戳 + 启动时 GM=true 而迟到镜像=false」的永久矛盾(用户显式关闭被翻 ON)。用户本会话显式设过(带戳)则不动。
try {
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('tm:p-restored', function () {
      try { if (typeof GM !== 'undefined' && GM && !GM._factionLivingWorldSetByUser) _tmReconcileFactionLivingWorld(GM, (typeof P !== 'undefined') ? P : null); } catch (_e) {}
    });
  }
} catch (_e) {}
function _ensureGMDefaults(GM, P) {
  GM = GM || (typeof window !== 'undefined' ? window.GM : null);
  P = P || (typeof window !== 'undefined' ? window.P : null);
  if (!GM) return;
  _tmNormalizeCoreWorldCollections(GM);
  var populationSchema = typeof window !== 'undefined' && window.TM && window.TM.PopulationSchema;
  if (!populationSchema || typeof populationSchema.normalize !== 'function') {
    var populationSchemaError = new Error('人口 schema provider 未加载，拒绝规范化世界');
    populationSchemaError.code = 'population-schema-unavailable';
    throw populationSchemaError;
  }
  populationSchema.normalize(GM, {
    source: 'load-or-save-boundary',
    allowLegacyNumericStrings: true,
    p: P
  });
  _tmEnsureCampaignId(GM);
  _tmEnsureTimelineIdentity(GM);
  _tmMigrateCoreStableIds(GM);
  if (!GM.shijiHistory) GM.shijiHistory = [];
  if (!GM.allCharacters) GM.allCharacters = [];
  if (!GM.classes) GM.classes = [];
  if (!GM.parties) GM.parties = [];
  if (!GM.extForces) GM.extForces = [];
  if (!GM.techTree) GM.techTree = [];
  if (!GM.civicTree) GM.civicTree = [];
  if (!GM.memorials) GM.memorials = [];
  if (!GM.qijuHistory) GM.qijuHistory = [];
  if (!GM.jishiRecords) GM.jishiRecords = [];
  if (!GM.biannianItems) GM.biannianItems = [];
  if (!GM.officeTree) GM.officeTree = [];
  if (!GM.officeChanges) GM.officeChanges = [];
  if (!GM.wenduiHistory) GM.wenduiHistory = {};
  if (!GM.evtLog) GM.evtLog = [];
  if (!GM.conv) GM.conv = [];
  if (!GM.autoSummary) GM.autoSummary = '';
  if (!GM.summarizedTurns) GM.summarizedTurns = [];
  if (!GM.characterArcs) GM.characterArcs = {};
  if (!GM.playerDecisions) GM.playerDecisions = [];
  if (!GM.memoryArchive) GM.memoryArchive = [];
  if (!GM.renli) GM.renli = { byRegion: {}, reported: {} }; // 人力/徭役农政层（R1·tm-renli.js）
  if (!GM.chronicleAfterwords) GM.chronicleAfterwords = [];
  if (!GM.customPolicies) GM.customPolicies = [];
  if (!GM.affinityMap) GM.affinityMap = {};
  if (!GM.offendGroupScores) GM.offendGroupScores = {};
  if (!GM.activeRebounds) GM.activeRebounds = [];
  if (!GM.triggeredOffendEvents) GM.triggeredOffendEvents = {};
  if (!GM._tyrantDecadence) GM._tyrantDecadence = 0;
  if (!GM._tyrantHistory) GM._tyrantHistory = [];
  if (!GM.harem) GM.harem = { heirs: [], succession: 'eldest_legitimate', pregnancies: [] };
  if (!GM.harem.pregnancies) GM.harem.pregnancies = [];
  if (!GM.families) GM.families = {};
  if (!GM.memoryAnchors) GM.memoryAnchors = [];
  if (!GM.provinceStats) GM.provinceStats = {};
  if (!GM.eraStateHistory) GM.eraStateHistory = [];
  if (!GM.pendingConsequences) GM.pendingConsequences = [];
  if (!GM.turnChanges) GM.turnChanges = { variables: [], characters: [], factions: [], parties: [], classes: [], military: [], map: [] };
  if (!GM.historicalEvents) GM.historicalEvents = [];
  if (!GM.playerPendingTasks) GM.playerPendingTasks = [];
  if (!GM.factionRelations) GM.factionRelations = [];
  if (!GM.factionEvents) GM.factionEvents = [];
  if (!GM._factionHistory) GM._factionHistory = [];
  if (!GM._factionUndercurrents) GM._factionUndercurrents = [];
  if (!GM._factionUndercurrentsHistory) GM._factionUndercurrentsHistory = [];
  // F2 势力活世界总闸·翻默认 ON 迁移(单一真源 _tmReconcileFactionLivingWorld·启动竞态自愈两处同调·规则见函数注释)
  _tmReconcileFactionLivingWorld(GM, P);
  if (!GM._courtRecords) GM._courtRecords = [];
  // Phase 4 基建·sc28 world_snapshot 跨回合 mirror·sc1 prep 注入需要
  if (!GM._lastSc28Snapshot) GM._lastSc28Snapshot = null;
  // Phase 7 准备·成本面板 history·最近 20 回合
  if (!Array.isArray(GM._costHistory)) GM._costHistory = [];
  if (!GM.activeSchemes) GM.activeSchemes = [];
  if (!Array.isArray(GM._feudalSchemes)) GM._feudalSchemes = [];   // 刀丁2·feudal 数值 scheme 独立账本
  // 批己·谈判多轮会话（招抚/议和/势力外交共用状态机·不加 mirror 跨存档丢）
  if (!Array.isArray(GM._negotiations)) GM._negotiations = [];
  if (GM._negotiationSeq === undefined) GM._negotiationSeq = 0;
  // 方案新增字段
  if (!GM._edictTracker) GM._edictTracker = [];
  if (!GM._plotThreads) GM._plotThreads = [];
  if (!GM._decisionEchoes) GM._decisionEchoes = [];
  if (!GM._edictSuggestions) GM._edictSuggestions = [];
  if (!GM._approvedMemorials) GM._approvedMemorials = [];
  if (!GM._achievements) GM._achievements = [];
  // N4: 主角精力系统
  if (GM._energy === undefined) GM._energy = 100;
  if (GM._energyMax === undefined) GM._energyMax = 100;
  // E2: 考课历史
  if (!GM._annualReviewHistory) GM._annualReviewHistory = [];
  // P7: 科举待铨队列
  if (!GM._kejuPendingAssignment) GM._kejuPendingAssignment = [];
  // 阶段一：叙事事实可变层
  if (!GM._mutableFacts) GM._mutableFacts = [];
  // 阶段一：时代双进度条
  if (!GM.eraProgress) GM.eraProgress = { collapse: 0, restoration: 0 };
  // 阶段一：外部威胁聚合
  if (GM.borderThreat === undefined) GM.borderThreat = 0;
  if (!GM.monthlyChronicles) GM.monthlyChronicles = [];
  if (!GM.yearlyChronicles) GM.yearlyChronicles = [];
  if (!GM._aiMemorySummaries) GM._aiMemorySummaries = [];
  // 鸿雁传书系列字段——_prepareGMForSave 仅在 length>0 时才会写入 _savedXXX·
  // 若旧档/新开档此处空数组未存盘·load 后会缺字段·_settleLettersAndTravel 虽 (||[])
  // 兜底·但下游 push 路径会向 undefined 推数据→空指针。
  if (!Array.isArray(GM.letters)) GM.letters = [];
  if (!Array.isArray(GM._pendingNpcLetters)) GM._pendingNpcLetters = [];
  if (!Array.isArray(GM._letterSuspects)) GM._letterSuspects = [];
  if (!GM._courierStatus || typeof GM._courierStatus !== 'object') GM._courierStatus = {};
  if (!Array.isArray(GM._routeDisruptions)) GM._routeDisruptions = [];
  if (!Array.isArray(GM._npcCorrespondence)) GM._npcCorrespondence = [];
  if (!Array.isArray(GM._pendingNpcCorrespondence)) GM._pendingNpcCorrespondence = [];
  if (!Array.isArray(GM._npcInternalActionHistory)) GM._npcInternalActionHistory = [];
  if (!Array.isArray(GM._npcActionLedger)) GM._npcActionLedger = [];
  if (!Array.isArray(GM._npcPlans)) GM._npcPlans = [];
  if (!Array.isArray(GM._npcDecisionDiagnostics)) GM._npcDecisionDiagnostics = [];
  if (!Array.isArray(GM._pendingMemorialDeliveries)) GM._pendingMemorialDeliveries = [];
  if (!Array.isArray(GM._interceptedIntel)) GM._interceptedIntel = [];
  if (!Array.isArray(GM._undeliveredLetters)) GM._undeliveredLetters = [];
}

// 确保 P 所有字段存在默认值
// ════════════════════════════════════════════════════════════════════════
// §6.5 R3·真 Migration Framework (2026-05-22)
// 版本号 + deprecation pipeline + 日志·让存档/conf 升级有迹可循
// ════════════════════════════════════════════════════════════════════════
var SAVE_SCHEMA_VERSION = '1.3.0-ai-upgrade';
var _MIGRATIONS = [
  // 每条·{ from: '1.2.0', to: '1.3.0-ai-upgrade', migrate: function(P, GM) {...}, desc: '...' }
  { from: '*', to: '1.3.0-ai-upgrade', desc: 'Phase 0-7.5·rename consolidationEnabled→memorySynthesisEnabled', migrate: function(Pref, GMref) {
    if (Pref && Pref.conf && typeof Pref.conf.consolidationEnabled === 'boolean' && typeof Pref.conf.memorySynthesisEnabled !== 'boolean') {
      Pref.conf.memorySynthesisEnabled = Pref.conf.consolidationEnabled;
      try { delete Pref.conf.consolidationEnabled; } catch(_){}
      return ['rename·consolidationEnabled → memorySynthesisEnabled'];
    }
    return [];
  } }
];
function runMigrations(P, GM) {
  P = P || (typeof window !== 'undefined' ? window.P : null);
  GM = GM || (typeof window !== 'undefined' ? window.GM : null);
  if (!P) return [];
  if (!P.conf) P.conf = {};
  var fromVer = P.conf._saveSchemaVersion || '1.2.0';
  if (fromVer === SAVE_SCHEMA_VERSION) return [];
  var log = [];
  var failure = null;
  _MIGRATIONS.forEach(function(m) {
    if (failure) return;
    if (m.from === '*' || m.from === fromVer) {
      try {
        var diff = m.migrate(P, GM);
        if (Array.isArray(diff) && diff.length) log = log.concat(diff.map(function(x){ return m.from+'→'+m.to+': '+x; }));
      } catch(e) {
        failure = e || new Error('migration ' + m.from + '→' + m.to + ' failed');
      }
    }
  });
  if (failure) {
    try { P.conf._migrationFailure = { at: Date.now(), from: fromVer, target: SAVE_SCHEMA_VERSION, error: String(failure.message || failure) }; } catch (_) {}
    throw failure;
  }
  P.conf._saveSchemaVersion = SAVE_SCHEMA_VERSION;
  try { delete P.conf._migrationFailure; } catch (_) {}
  if (log.length > 0) {
    try {
      if (!Array.isArray(P.conf._migrationLog)) P.conf._migrationLog = [];
      P.conf._migrationLog.push({ at: Date.now(), version: SAVE_SCHEMA_VERSION, entries: log.slice(0, 20) });
      if (P.conf._migrationLog.length > 10) P.conf._migrationLog = P.conf._migrationLog.slice(-10);
      if (typeof console !== 'undefined') console.log('[migration] applied ' + log.length + ' rules·now ' + SAVE_SCHEMA_VERSION);
    } catch(_){}
  }
  return log;
}

function _ensurePDefaults(P, GM) {
  P = P || (typeof window !== 'undefined' ? window.P : null);
  GM = GM || (typeof window !== 'undefined' ? window.GM : null);
  if (!P) return;
  if (!P.ai) P.ai = {};
  if (!P.classes) P.classes = [];
  if (!P.externalForces) P.externalForces = [];
  if (!P.techTree) P.techTree = [];
  if (!P.civicTree) P.civicTree = [];
  if (!P.officeConfig) P.officeConfig = { costVariables: [], shortfallEffects: '' };
  if (!P.world) P.world = { history: '', politics: '', economy: '', military: '', culture: '', glossary: '', entries: [], rules: '' };
  if (!P.world.entries) P.world.entries = [];
  if (!P.officeDeptLinks) P.officeDeptLinks = [];
  if (!P.relations) P.relations = [];
  if (!P.events) P.events = [];
  if (!P.items) P.items = [];
  if (!P.characters) P.characters = [];
  if (!P.factions) P.factions = [];
  if (!P.parties) P.parties = [];
  if (!P.variables) P.variables = [];
  // 确保公式索引存在
  if (P.variables && !Array.isArray(P.variables) && P.variables.formulas) {
    P._varFormulas = P.variables.formulas;
  }
  if (!P._varFormulas) P._varFormulas = [];
  if (!P.conf) P.conf = {};
  if (!P.conf.verbosity) P.conf.verbosity = 'standard';
  // Phase 7.5·6 决定 defaults·user 可在设置面板调
  if (typeof P.conf.dialogueRecallTurns !== 'number') P.conf.dialogueRecallTurns = 3;
  if (typeof P.conf.costAlertThreshold !== 'number') P.conf.costAlertThreshold = 0.5;
  if (typeof P.conf.strictSchemaEnabled !== 'boolean') P.conf.strictSchemaEnabled = false;
  // Phase 7.5 B·rename·consolidationEnabled → memorySynthesisEnabled (sc25c 接管 sc_consolidate 后语义已变)
  // 老存档 mirror·若有旧字段·赋值新字段·再删旧
  if (typeof P.conf.memorySynthesisEnabled !== 'boolean') {
    if (typeof P.conf.consolidationEnabled === 'boolean') {
      P.conf.memorySynthesisEnabled = P.conf.consolidationEnabled;
      try { delete P.conf.consolidationEnabled; } catch(_){}
    } else {
      P.conf.memorySynthesisEnabled = true;  // 默认 ON·与 sc25cEnabled 一致
    }
  }
  // §6.5 R3·调 migration framework·版本检查 + rule apply + log
  runMigrations(P, GM);
  if (typeof P.conf.npcAiPrecision !== 'boolean') P.conf.npcAiPrecision = true;
  if (typeof P.conf.npcAiCosmeticEnrich !== 'boolean') P.conf.npcAiCosmeticEnrich = true;
  if (!P.conf.npcAiPrecisionMode) P.conf.npcAiPrecisionMode = 'eager';
  if (typeof P.conf.npcAiPrecisionMaxPerTurn !== 'number') P.conf.npcAiPrecisionMaxPerTurn = 2;
  if (typeof P.conf.npcInTurnMaxPerTurn !== 'number') P.conf.npcInTurnMaxPerTurn = 8;
  // 阶段一：mechanicsConfig默认值
  if (!P.mechanicsConfig) P.mechanicsConfig = {};
  var mc = P.mechanicsConfig;
  // 编年史白名单——默认只含朝代无关的通用事件类型
  // 朝代特有的（科举/朝议/和亲/改元等）应由编辑器在剧本中配置追加
  // 剧本编辑参考（勿机械读取——即使是唐朝帝制剧本也不应原样照搬，须按实际剧本需要取舍）：
  //   唐朝帝制剧本可追加 '科举','朝议','改元','和亲'
  if (!mc.chronicleWhitelist) mc.chronicleWhitelist = ['继承','宣战','任命','罢免','叛乱','阴谋','驾崩','灾荒','大捷'];
  // 季度议程——模板由编辑器配置，默认空（不预设任何朝代特定议题）
  // 效果由AI在推演中判断，options中不含effect字段
  if (!mc.agendaTemplates) mc.agendaTemplates = [];
  // 时代进度规则——默认空
  // 编辑器应根据剧本定义的变量配置衰退/中兴规则
  if (!mc.eraProgress) mc.eraProgress = {
    collapseRules: [],
    restorationRules: [],
    collapseThreshold: 100, restorationThreshold: 100
  };
  if (!mc.borderThreat) mc.borderThreat = { warningThreshold: 60, criticalThreshold: 80, softFloor: { threshold: 20, damping: 0.5 } };

  // 阶段二：核心机制增强默认值
  // 2.1 状态耦合规则——默认空数组，仅在编辑器明确配置时才生效
  // 不预设任何朝代特定的耦合逻辑，由AI在推演中自行判断级联效应
  if (!mc.couplingRules) mc.couplingRules = [];
  // 2.2 诏令效果完全由AI判断，不做机械关键词匹配（天命是AI游戏，非崇祯式单机）
  // 2.3 执行率管线——默认空（仅供AI参考的情境信息，不做机械折扣）
  // 编辑器应根据剧本朝代配置具体层级
  // 剧本编辑参考（勿机械读取——即使是对应朝代也不应原样照搬，须按实际官制设计调整）：
  //   唐朝：[{name:'中书门下',functionKey:'central_admin'},{name:'御史台',functionKey:'censorate'},
  //          {name:'六部',functionKey:null},{name:'地方州县',functionKey:'local_admin'}]
  //   秦汉：[{name:'丞相府',functionKey:'central_admin'},{name:'九卿',functionKey:null},
  //          {name:'郡县',functionKey:'local_admin'}]
  if (!mc.executionPipeline) mc.executionPipeline = [];
  if (mc.executionFloor === undefined) mc.executionFloor = 0.35;

  // 阶段三：深度系统重构默认值
  // 3.1 NPC行为意图分析——行为类型和配置由编辑器定义，默认空
  if (!mc.npcBehaviorTypes) mc.npcBehaviorTypes = [];
  if (!mc.npcIntentConfig) mc.npcIntentConfig = {
    highImportanceIntervalDays: 15,   // 高重要度NPC意图分析间隔（天）
    midImportanceIntervalDays: 45,    // 中重要度
    lowImportanceIntervalDays: 90     // 低重要度
  };
  // 3.2 月度编年史配置
  if (!mc.chronicleConfig) mc.chronicleConfig = {
    monthlyWordLimit: 200,
    yearlyWordLimit: 2000,
    narratorRole: '史官'
  };

  // 阶段四：生态完善默认值
  // 4.1 政策树——编辑器配置前置依赖链，效果由AI判断
  if (!mc.policyTree) mc.policyTree = [];
  // 4.3 战斗系统——兵种和阶段由编辑器配置
  if (!P.militaryConfig) P.militaryConfig = {};
  if (!P.militaryConfig.unitTypes) P.militaryConfig.unitTypes = [];
  if (!P.militaryConfig.battlePhases) P.militaryConfig.battlePhases = [
    { id: 'deploy', name: '部署' },
    { id: 'clash', name: '交锋' },
    { id: 'decisive', name: '决战' }
  ];
  if (!P.militaryConfig.momentumConfig) P.militaryConfig.momentumConfig = { winGain: 0.15, losePenalty: 0.15, max: 1.5, min: 0.6 };
  // 4.4 角色模型扩展——health/virtue/legitimacy规则由编辑器配置
  if (!mc.characterRules) mc.characterRules = {};
  if (!mc.characterRules.healthConfig) mc.characterRules.healthConfig = {
    monthlyDecay: 0.1,
    ageAccelThreshold: 60,
    ageAccelRate: 0.3
  };
  // virtue/legitimacy规则默认空——不预设任何朝代特定公式
  if (!mc.characterRules.virtueRules) mc.characterRules.virtueRules = [];
  if (!mc.characterRules.legitimacyRules) mc.characterRules.legitimacyRules = [];
  // 4.6 重大决策——编辑器配置决策类型和条件
  if (!mc.decisions) mc.decisions = [];
}

// 统一的存档前准备函数——所有存档路径都必须调用此函数
function _prepareGMForSave(GM, P) {
  var _liveGM = (typeof window !== 'undefined') ? window.GM : null;
  var _liveP = (typeof window !== 'undefined') ? window.P : null;
  GM = GM || (_liveGM ? _autoSaveSnapshotGM(_liveGM) : null);
  P = P || (_liveP ? deepClone(_liveP) : {});
  if (!GM) return null;
  try {
    if (window.TMPhase8FormalBridge && typeof window.TMPhase8FormalBridge.saveDraftsToGM === 'function') {
      window.TMPhase8FormalBridge.saveDraftsToGM(true, GM);
    }
  } catch(_phase8DraftSaveE) {
    try { window.TM && TM.errors && TM.errors.captureSilent(_phase8DraftSaveE, 'prepareGMForSave·phase8FormalDrafts'); } catch(_) {}
  }
  // 系统序列化
  // 注意：GM._chronicle是编年事件数组，不可与ChronicleSystem的月/年摘要对象混用——分开存
  // 编年状态已经属于传入的 GM 快照；不得从当前全局世界重新读取后覆盖跨档快照。
  GM._chronicleSysState = typeof ChronicleSystem !== 'undefined' ? ChronicleSystem.serialize(GM) : null;
  // 停战状态属于传入的 detached 世界；不得从当前 live world 重新覆盖跨档快照。
  GM._warTruces = typeof WarWeightSystem !== 'undefined' ? WarWeightSystem.serialize(GM) : { version: 1, truces: {} };
  GM._rngState = typeof getRngState === 'function' ? getRngState() : null;
  // 亲疏/得罪/反弹/观感
  if (GM.affinityMap) GM._savedAffinityMap = _safeClone(GM.affinityMap);
  if (GM.renli) GM._savedRenli = _safeClone(GM.renli); // 人力/徭役农政层（R1·叶子 alloc/registeredDing 随 adminHierarchy 持久）
  if (GM.offendGroupScores) GM._savedOffendScores = _safeClone(GM.offendGroupScores);
  if (GM.activeRebounds) GM._savedActiveRebounds = _safeClone(GM.activeRebounds);
  if (GM.triggeredOffendEvents) GM._savedTriggeredOffend = _safeClone(GM.triggeredOffendEvents);
  if (typeof OpinionSystem !== 'undefined' && OpinionSystem.getAllEventOpinions) GM._savedEventOpinions = OpinionSystem.getAllEventOpinions();
  // 昏君/变量映射/后宫/家族/AI记忆
  if (_tmHasOwn(GM, '_tyrantDecadence')) GM._savedTyrantDecadence = GM._tyrantDecadence;
  if (GM._tyrantHistory && GM._tyrantHistory.length > 0) GM._savedTyrantHistory = _safeClone(GM._tyrantHistory);
  if (GM._varMapping) GM._savedVarMapping = _safeClone(GM._varMapping);
  if (GM.harem) GM._savedHarem = _safeClone(GM.harem);
  if (GM.families) GM._savedFamilies = _safeClone(GM.families);
  if (GM._varFormulas && GM._varFormulas.length > 0) GM._savedVarFormulas = _safeClone(GM._varFormulas);
  if (GM._foreshadows) GM._savedForeshadows = _safeClone(GM._foreshadows);
  if (GM._aiMemory) GM._savedAiMemory = _safeClone(GM._aiMemory);
  if (GM._sagaMemory) GM._savedSagaMemory = _safeClone(GM._sagaMemory);  // agent 多回合综合脉络·跨会话持久
  if (GM._agentRecentDirectives) GM._savedAgentRecentDirectives = _safeClone(GM._agentRecentDirectives);  // agent 近回合诏书/行止·多回合读·持久(与 LLM 规则库 _playerDirectives 分开·避免冲突)
  // R103·对话完整归档（被截断/压缩的老对话原文）
  if (GM._convArchive && GM._convArchive.length > 0) GM._savedConvArchive = _safeClone(GM._convArchive);
  // 矛盾演化系统
  if (GM._contradictions && GM._contradictions.length > 0) GM._savedContradictions = _safeClone(GM._contradictions);
  // 鸿雁传书+京城
  if (GM.letters && GM.letters.length > 0) GM._savedLetters = _safeClone(GM.letters);
  if (_tmHasOwn(GM, '_capital')) GM._savedCapital = GM._capital;
  if (_tmHasOwn(GM, '_currentTrend')) GM._savedTrend = GM._currentTrend;
  // 新增：保存更多运行时系统数据
  if (GM.characterArcs && Object.keys(GM.characterArcs).length > 0) GM._savedCharacterArcs = _safeClone(GM.characterArcs);
  if (GM.playerDecisions && GM.playerDecisions.length > 0) GM._savedPlayerDecisions = _safeClone(GM.playerDecisions);
  if (GM.memoryArchive && GM.memoryArchive.length > 0) GM._savedMemoryArchive = _safeClone(GM.memoryArchive);
  if (GM.chronicleAfterwords && GM.chronicleAfterwords.length > 0) GM._savedChronicleAfterwords = _safeClone(GM.chronicleAfterwords);
  if (GM.customPolicies && GM.customPolicies.length > 0) GM._savedCustomPolicies = _safeClone(GM.customPolicies);
  if (GM.memoryAnchors && GM.memoryAnchors.length > 0) GM._savedMemoryAnchors = _safeClone(GM.memoryAnchors);
  if (GM.provinceStats && Object.keys(GM.provinceStats).length > 0) GM._savedProvinceStats = _safeClone(GM.provinceStats);
  if (GM.eraState) GM._savedEraState = _safeClone(GM.eraState);
  if (GM.eraStateHistory && GM.eraStateHistory.length > 0) GM._savedEraStateHistory = _safeClone(GM.eraStateHistory);
  if (GM.postSystem) GM._savedPostSystem = _safeClone(GM.postSystem);
  // 存档6大系统配置（P层存放但需跟随GM存盘）
  if (P.vassalSystem) GM._savedVassalSystem = _safeClone(P.vassalSystem);
  if (P.titleSystem) GM._savedTitleSystem = _safeClone(P.titleSystem);
  if (P.buildingSystem) GM._savedBuildingSystem = _safeClone(P.buildingSystem);
  if (P.adminHierarchy) GM._savedAdminHierarchy = _safeClone(P.adminHierarchy);
  if (P.keju) GM._savedKeju = _safeClone(P.keju);
  if (P.officialVassalMapping) GM._savedOfficialVassalMapping = _safeClone(P.officialVassalMapping);
  if (P.government) GM._savedGovernment = _safeClone(P.government);
  if (GM.eraNames) GM._savedEraNames = _safeClone(GM.eraNames);
  if (GM._aiScenarioDigest) GM._savedAiDigest = _safeClone(GM._aiScenarioDigest);
  // 诏令追踪
  if (GM._edictTracker) GM._savedEdictTracker = _safeClone(GM._edictTracker);
  // 诏令草稿（玩家当前 tab 输入中的文字——防止存档丢失）
  var _eDrafts = {};
  ['edict-pol','edict-mil','edict-dip','edict-eco','edict-oth','xinglu-pub'].forEach(function(id) {
    var el = typeof _$ === 'function' ? _$(id) : document.getElementById(id);
    if (el && typeof el.value === 'string' && el.value.trim()) _eDrafts[id] = el.value;
  });
  if (Object.keys(_eDrafts).length > 0) GM._savedEdictDrafts = _eDrafts;
  else delete GM._savedEdictDrafts;
  // 事件总线
  if (typeof StoryEventBus !== 'undefined') GM._savedEventBus = StoryEventBus.serialize();
  // 恩怨/门生/阴谋
  if (GM.enYuanRecords) GM._savedEnYuanRecords = _safeClone(GM.enYuanRecords);
  if (GM.patronNetwork) GM._savedPatronNetwork = _safeClone(GM.patronNetwork);
  if (GM.activeSchemes) GM._savedActiveSchemes = _safeClone(GM.activeSchemes);
  if (GM._feudalSchemes) GM._savedFeudalSchemes = _safeClone(GM._feudalSchemes);   // 刀丁2·feudal 账本 mirror
  // 批己·谈判会话 mirror
  if (GM._negotiations) GM._savedNegotiations = _safeClone(GM._negotiations);
  if (GM._negotiationSeq !== undefined) GM._savedNegotiationSeq = GM._negotiationSeq;
  if (GM.yearlyChronicles) GM._savedYearlyChronicles = _safeClone(GM.yearlyChronicles);
  if (GM.monthlyChronicles) GM._savedMonthlyChronicles = _safeClone(GM.monthlyChronicles);
  if (GM._aiMemorySummaries) GM._savedAiMemorySummaries = _safeClone(GM._aiMemorySummaries);
  if (GM.schemeCooldowns) GM._savedSchemeCooldowns = _safeClone(GM.schemeCooldowns);
  if (GM.eventCooldowns) GM._savedEventCooldowns = _safeClone(GM.eventCooldowns);
  // 战斗/行军/围城系统运行时数据
  if (GM.marchOrders) GM._savedMarchOrders = _safeClone(GM.marchOrders);
  if (GM.activeSieges) GM._savedActiveSieges = _safeClone(GM.activeSieges);
  if (GM.activeBattles) GM._savedActiveBattles = _safeClone(GM.activeBattles);
  if (GM.battleHistory) GM._savedBattleHistory = _safeClone(GM.battleHistory);
  if (GM.activeWars) GM._savedActiveWars = _safeClone(GM.activeWars);
  if (GM.treaties) GM._savedTreaties = _safeClone(GM.treaties);
  if (GM._diplomaticMissions) GM._savedDiplomaticMissions = _safeClone(GM._diplomaticMissions);
  if (GM._foreshadowings) GM._savedForeshadowings = _safeClone(GM._foreshadowings);
  if (GM._tensionHistory) GM._savedTensionHistory = _safeClone(GM._tensionHistory);
  if (GM._yearlyDigest) GM._savedYearlyDigest = _safeClone(GM._yearlyDigest);
  if (GM._metricHistory) GM._savedMetricHistory = _safeClone(GM._metricHistory);
  if (GM._militaryReform) GM._savedMilitaryReform = _safeClone(GM._militaryReform);
  if (GM._rngCheckpoints) GM._savedRngCheckpoints = _safeClone(GM._rngCheckpoints);
  // 新增系统字段保存
  if (GM._energy !== undefined) GM._savedEnergy = GM._energy;
  if (GM._energyMax !== undefined) GM._savedEnergyMax = GM._energyMax;
  if (GM._annualReviewHistory) GM._savedAnnualReviewHistory = _safeClone(GM._annualReviewHistory);
  if (GM._kejuPendingAssignment) GM._savedKejuPending = _safeClone(GM._kejuPendingAssignment);
  if (GM._successionEvent) GM._savedSuccessionEvent = _safeClone(GM._successionEvent);
  // 阶段一新字段保存
  if (GM._mutableFacts) GM._savedMutableFacts = _safeClone(GM._mutableFacts);
  if (GM._lostTerritories) GM._savedLostTerritories = _safeClone(GM._lostTerritories);
  if (GM.currentIssues) GM._savedCurrentIssues = _safeClone(GM.currentIssues);
  if (GM._aiDispatchStats) GM._savedAiDispatchStats = _safeClone(GM._aiDispatchStats);
  if (GM._npcClaims) GM._savedNpcClaims = _safeClone(GM._npcClaims);
  if (GM._eavesdroppedTopics) GM._savedEavesdroppedTopics = _safeClone(GM._eavesdroppedTopics);
  if (GM._interceptedIntel) GM._savedInterceptedIntel = _safeClone(GM._interceptedIntel);
  if (GM._undeliveredLetters) GM._savedUndeliveredLetters = _safeClone(GM._undeliveredLetters);
  if (GM._letterSuspects) GM._savedLetterSuspects = _safeClone(GM._letterSuspects);
  if (GM._courierStatus) GM._savedCourierStatus = _safeClone(GM._courierStatus);
  if (GM._pendingNpcLetters && GM._pendingNpcLetters.length > 0) GM._savedPendingNpcLetters = _safeClone(GM._pendingNpcLetters);
  if (GM._pendingMemorialDeliveries && GM._pendingMemorialDeliveries.length > 0) GM._savedPendingMemDeliveries = _safeClone(GM._pendingMemorialDeliveries);
  if (GM._pendingNpcCorrespondence && GM._pendingNpcCorrespondence.length > 0) GM._savedPendingNpcCorr = _safeClone(GM._pendingNpcCorrespondence);
  if (GM._npcInternalActionHistory && GM._npcInternalActionHistory.length > 0) GM._savedNpcInternalActionHistory = _safeClone(GM._npcInternalActionHistory);
  if (GM._npcActionLedger && GM._npcActionLedger.length > 0) GM._savedNpcActionLedger = _safeClone(GM._npcActionLedger);
  if (GM._npcPlans && GM._npcPlans.length > 0) GM._savedNpcPlans = _safeClone(GM._npcPlans);
  if (GM._npcDecisionDiagnostics && GM._npcDecisionDiagnostics.length > 0) GM._savedNpcDecisionDiagnostics = _safeClone(GM._npcDecisionDiagnostics.slice(-120));
  if (GM._npcFactionAiTurnLedger) GM._savedNpcFactionAiTurnLedger = _safeClone(GM._npcFactionAiTurnLedger);
  if (GM._npcFactionLlmLedger) GM._savedNpcFactionLlmLedger = _safeClone(GM._npcFactionLlmLedger);
  if (GM._npcFactionLlmDispatchLedger) GM._savedNpcFactionLlmDispatchLedger = _safeClone(GM._npcFactionLlmDispatchLedger);
  if (GM._sc16FactionDirectives) GM._savedSc16FactionDirectives = _safeClone(GM._sc16FactionDirectives);
  if (GM._officeCollapsed) GM._savedOfficeCollapsed = _safeClone(GM._officeCollapsed);
  if (GM._wdState && Object.keys(GM._wdState).length > 0) GM._savedWdState = _safeClone(GM._wdState);
  if (GM._playerDirectives && GM._playerDirectives.length > 0) GM._savedPlayerDirectives = _safeClone(GM._playerDirectives);
  if (GM._importedMemories && GM._importedMemories.length > 0) GM._savedImportedMemories = _safeClone(GM._importedMemories);
  if (GM._wentianHistory && GM._wentianHistory.length > 0) GM._savedWentianHistory = _safeClone(GM._wentianHistory);
  // 新增：记忆系统持久化（A1 + B2 + B1 校验器日志）
  if (GM._memoryLayers && (GM._memoryLayers.L2 && GM._memoryLayers.L2.length || GM._memoryLayers.L3 && GM._memoryLayers.L3.length)) GM._savedMemoryLayers = _safeClone(GM._memoryLayers);
  if (GM._epitaphs && GM._epitaphs.length > 0) GM._savedEpitaphs = _safeClone(GM._epitaphs);
  if (GM._fakeDeathHolding && Object.keys(GM._fakeDeathHolding).length > 0) GM._savedFakeDeathHolding = _safeClone(GM._fakeDeathHolding);
  if (GM._fiscalValidatorLog && GM._fiscalValidatorLog.length > 0) GM._savedFiscalValidatorLog = _safeClone(GM._fiscalValidatorLog);
  // M1-M4 新增字段
  // 清理 ephemeral post-turn 任务（Promise 不可序列化）
  if (GM._postTurnJobs) delete GM._postTurnJobs;
  // 无上限保护：_memoryArchiveFull 保留最近 5000 条（约 100-200 回合全记忆）
  if (GM._memoryArchiveFull && GM._memoryArchiveFull.length > 5000) {
    GM._memoryArchiveFull = GM._memoryArchiveFull.slice(-5000);
  }
  if (GM._memoryArchiveFull && GM._memoryArchiveFull.length > 0) GM._savedMemoryArchiveFull = _safeClone(GM._memoryArchiveFull);
  if (GM._causalGraph && (GM._causalGraph.nodes && GM._causalGraph.nodes.length || GM._causalGraph.edges && GM._causalGraph.edges.length)) GM._savedCausalGraph = _safeClone(GM._causalGraph);
  if (GM._factionArcs && Object.keys(GM._factionArcs).length > 0) GM._savedFactionArcs = _safeClone(GM._factionArcs);
  if (GM._aiReflections && GM._aiReflections.length > 0) GM._savedAiReflections = _safeClone(GM._aiReflections);
  if (GM._lastTurnPredictions) GM._savedLastTurnPredictions = _safeClone(GM._lastTurnPredictions);
  // per-char：arcs + relationHistory
  if (GM.chars) {
    var _charMemExt = {};
    GM.chars.forEach(function(c) {
      if (!c || !c.name) return;
      var e = {};
      if (Array.isArray(c._arcs) && c._arcs.length > 0) e.arcs = _safeClone(c._arcs);
      if (c._relationHistory && Object.keys(c._relationHistory).length > 0) e.relationHistory = _safeClone(c._relationHistory);
      if (Object.keys(e).length > 0) _charMemExt[c.name] = e;
    });
    if (Object.keys(_charMemExt).length > 0) GM._savedCharMemExt = _charMemExt;
  }
  if (GM._chronicle && GM._chronicle.length > 0) GM._savedChronicle = _safeClone(GM._chronicle);
  if (GM._wdRewardPunish && GM._wdRewardPunish.length > 0) GM._savedWdRewardPunish = _safeClone(GM._wdRewardPunish);
  if (_tmHasOwn(GM, '_lastEvalTurn')) GM._savedLastEvalTurn = GM._lastEvalTurn;
  // 角色官制字段批量保存
  if (GM.chars) {
    var _charOfficeFields = {};
    GM.chars.forEach(function(c) {
      var f = {};
      if (c._mourning) f.mourning = _safeClone(c._mourning);
      if (c._retired) f.retired = true;
      if (c._retireTurn) f.retireTurn = c._retireTurn;
      if (c._recommendedBy) f.recommendedBy = c._recommendedBy;
      if (c._recommendTurn) f.recommendTurn = c._recommendTurn;
      if (c._mourningOldPost) f.mourningOldPost = _safeClone(c._mourningOldPost);
      if (c._mourningDismissed) f.mourningDismissed = true;
      if (Object.keys(f).length > 0) _charOfficeFields[c.name] = f;
    });
    if (Object.keys(_charOfficeFields).length > 0) GM._savedCharOfficeFields = _charOfficeFields;
  }
  if (GM._routeDisruptions && GM._routeDisruptions.length > 0) GM._savedRouteDisruptions = _safeClone(GM._routeDisruptions);
  if (GM._npcCorrespondence && GM._npcCorrespondence.length > 0) GM._savedNpcCorrespondence = _safeClone(GM._npcCorrespondence);
  if (GM.eraProgress) GM._savedEraProgress = _safeClone(GM.eraProgress);
  if (GM.borderThreat !== undefined) GM._savedBorderThreat = GM.borderThreat;
  if (P.officeConfig) GM._savedOfficeConfig = _safeClone(P.officeConfig);
  // 存档建筑运行时数据（GM层）
  if (GM.buildings && GM.buildings.length > 0) GM._savedBuildings = _safeClone(GM.buildings);
  if (GM.buildingQueue && GM.buildingQueue.length > 0) GM._savedBuildingQueue = _safeClone(GM.buildingQueue);
  var _mapForSave = null;
  if (GM.mapData && GM.mapData.regions && GM.mapData.regions.length > 0) _mapForSave = GM.mapData;
  else if (typeof P !== 'undefined' && P && P.mapData && P.mapData.regions && P.mapData.regions.length > 0) _mapForSave = P.mapData;
  else if (typeof P !== 'undefined' && P && P.map && P.map.regions && P.map.regions.length > 0) _mapForSave = P.map;
  if (_mapForSave) GM._savedMapData = _safeClone(_mapForSave);
  if (GM.npcContext) GM._savedNpcContext = _safeClone(GM.npcContext);
  if (GM.pendingConsequences && GM.pendingConsequences.length > 0) GM._savedPendingConsequences = _safeClone(GM.pendingConsequences);
  if (GM.factionRelations && GM.factionRelations.length > 0) GM._savedFactionRelations = _safeClone(GM.factionRelations);
  if (GM.factionEvents && GM.factionEvents.length > 0) GM._savedFactionEvents = _safeClone(GM.factionEvents);
  if (GM._factionHistory && GM._factionHistory.length > 0) GM._savedFactionHistory = _safeClone(GM._factionHistory);
  if (GM._factionUndercurrentsHistory && GM._factionUndercurrentsHistory.length > 0) GM._savedFacUndHist = _safeClone(GM._factionUndercurrentsHistory);
  if (GM._factionUndercurrents && GM._factionUndercurrents.length > 0) GM._savedFacUndercurrents = _safeClone(GM._factionUndercurrents);
  if (GM._approvedMemorials && GM._approvedMemorials.length > 0) GM._savedApprovedMemorials = _safeClone(GM._approvedMemorials);
  if (GM._courtRecords && GM._courtRecords.length > 0) GM._savedCourtRecords = _safeClone(GM._courtRecords);
  if (GM._plotThreads && GM._plotThreads.length > 0) GM._savedPlotThreads = _safeClone(GM._plotThreads);
  if (GM._decisionEchoes && GM._decisionEchoes.length > 0) GM._savedDecisionEchoes = _safeClone(GM._decisionEchoes);
  if (GM._edictSuggestions && GM._edictSuggestions.length > 0) GM._savedEdictSuggestions = _safeClone(GM._edictSuggestions);
  // 文事系统存档
  if (GM.culturalWorks && GM.culturalWorks.length > 0) GM._savedCulturalWorks = _safeClone(GM.culturalWorks);
  if (GM._forgottenWorks && GM._forgottenWorks.length > 0) GM._savedForgottenWorks = _safeClone(GM._forgottenWorks);
  if (GM.factionRelationsMap && Object.keys(GM.factionRelationsMap).length > 0) GM._savedFactionRelationsMap = _safeClone(GM.factionRelationsMap);
  if (GM._edictLifecycle && GM._edictLifecycle.length > 0) GM._savedEdictLifecycle = _safeClone(GM._edictLifecycle);
  if (GM._activeRevolts && GM._activeRevolts.length > 0) GM._savedActiveRevolts = _safeClone(GM._activeRevolts);
  if (GM._revoltPrecursors && GM._revoltPrecursors.length > 0) GM._savedRevoltPrecursors = _safeClone(GM._revoltPrecursors);
  if (GM._npcCommitments && Object.keys(GM._npcCommitments).length > 0) GM._savedNpcCommitments = _safeClone(GM._npcCommitments);
  if (GM._secretMeetings && GM._secretMeetings.length > 0) GM._savedSecretMeetings = _safeClone(GM._secretMeetings);
  if (GM._achievements && GM._achievements.length > 0) GM._savedAchievements = _safeClone(GM._achievements);
  // 7.4: 历史索引
  if (GM._historyIndex) GM._savedHistoryIndex = _safeClone(GM._historyIndex);
  if (GM._historyIndexCursor) GM._savedHistoryIndexCursor = GM._historyIndexCursor;
  // 确保所有字段有默认值
  _ensureGMDefaults(GM, P);
  _ensurePDefaults(P, GM);
  return { GM: GM, P: P };
}

function _tmDesktopSavePanelRoot(title, maxWidth) {
  var root = document.createElement('div');
  root.id = 'tm-desktop-save-panel';
  showPanel(root);
  root.style.cssText = 'padding:1.5rem;max-width:' + maxWidth + 'px;margin:auto';
  var heading = document.createElement('h2');
  heading.style.cssText = 'color:var(--gold);margin-bottom:1rem';
  heading.textContent = title;
  root.appendChild(heading);
  return root;
}

function _tmDesktopSaveButton(text, style, handler) {
  var button = document.createElement('button');
  button.type = 'button';
  button.textContent = text;
  button.style.cssText = style;
  button.addEventListener('click', handler);
  return button;
}

function _tmDesktopSaveSubline(file) {
  file = file || {};
  var meta = file.meta || {};
  var parts = [];
  if (file.modifiedStr) parts.push(String(file.modifiedStr));
  if (Number.isFinite(Number(file.size))) parts.push(Math.round(Number(file.size) / 1024) + ' KB');
  if (meta.scenario) parts.push('剧本:' + String(meta.scenario));
  if (meta.turn != null && meta.turn !== '') parts.push('T' + String(meta.turn));
  if (file.metadataPending) parts.push('元数据整理中');
  return parts.join(' · ');
}

function _tmAppendDesktopSaveRow(parent, file, actions) {
  file = file || {};
  actions = actions || {};
  var row = document.createElement('div');
  row.style.cssText = 'display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;background:var(--bg-3);border-radius:6px;padding:0.5rem 0.75rem';
  var copy = document.createElement('div');
  copy.style.cssText = 'flex:1;min-width:0';
  var name = document.createElement('div');
  name.style.cssText = 'color:var(--txt-s);font-size:0.9rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
  name.textContent = String(file.name || file.storageKey || '未命名存档');
  var sub = document.createElement('div');
  sub.style.cssText = 'color:var(--txt-d);font-size:0.75rem';
  sub.textContent = _tmDesktopSaveSubline(file);
  copy.appendChild(name);
  copy.appendChild(sub);
  row.appendChild(copy);
  if (typeof actions.primary === 'function') {
    row.appendChild(_tmDesktopSaveButton(actions.primaryText || '载入', 'padding:0.2rem 0.7rem;border:none;border-radius:4px;background:var(--gold);color:#111;cursor:pointer;font-size:0.8rem;font-family:inherit', function() { actions.primary(file); }));
  }
  if (typeof actions.secondary === 'function') {
    row.appendChild(_tmDesktopSaveButton(actions.secondaryText || '删除', 'padding:0.2rem 0.6rem;border:none;border-radius:4px;background:#5a2020;color:#eee;cursor:pointer;font-size:0.8rem;font-family:inherit', function() { actions.secondary(file); }));
  }
  parent.appendChild(row);
}

function _tmShowDesktopSavePanel(files, defaultName) {
  var root = _tmDesktopSavePanelRoot('保存游戏', 520);
  var label = document.createElement('label');
  label.htmlFor = 'save-name-inp';
  label.style.cssText = 'display:block;margin-bottom:0.4rem;color:var(--txt-s)';
  label.textContent = '存档名';
  root.appendChild(label);
  var input = document.createElement('input');
  input.id = 'save-name-inp';
  input.className = 'inp';
  input.style.cssText = 'width:100%;margin-bottom:0.8rem';
  input.value = String(defaultName || '');
  root.appendChild(input);
  var saveButton = _tmDesktopSaveButton('保存', 'margin-bottom:1.2rem', function() { window.desktopDoSave(); });
  saveButton.className = 'btn';
  root.appendChild(saveButton);
  if (files.length) {
    var title = document.createElement('h4');
    title.style.cssText = 'color:var(--txt-d);margin-bottom:0.5rem';
    title.textContent = '覆盖现有存档';
    root.appendChild(title);
    var list = document.createElement('div');
    list.style.cssText = 'max-height:220px;overflow-y:auto';
    files.forEach(function(file) {
      _tmAppendDesktopSaveRow(list, file, {
        primaryText: '覆盖',
        primary: function(selected) {
          input.value = String(selected.name || '');
          window.desktopDoSave();
        }
      });
    });
    root.appendChild(list);
  }
  var cancelButton = _tmDesktopSaveButton('取消', 'margin-top:1rem', function() { enterGame(); });
  cancelButton.className = 'btn';
  root.appendChild(cancelButton);
  _$("G").style.display = 'none';
}

function _tmShowDesktopLoadFallback(files) {
  var root = _tmDesktopSavePanelRoot('读取存档', 560);
  if (!files.length) {
    var empty = document.createElement('p');
    empty.style.color = 'var(--txt-d)';
    empty.textContent = '无存档。';
    root.appendChild(empty);
  } else {
    var list = document.createElement('div');
    list.style.cssText = 'max-height:340px;overflow-y:auto';
    files.forEach(function(file) {
      _tmAppendDesktopSaveRow(list, file, {
        primaryText: '载入',
        primary: function(selected) { window.desktopLoadSave({ name: selected.name, storageKey: selected.storageKey || '' }); },
        secondaryText: '删除',
        secondary: function(selected) { window.desktopDeleteSave({ name: selected.name, storageKey: selected.storageKey || '' }); }
      });
    });
    root.appendChild(list);
  }
  var actions = document.createElement('div');
  actions.style.cssText = 'display:flex;gap:0.8rem;margin-top:1rem';
  actions.appendChild(_tmDesktopSaveButton('从文件导入', '', function() { importSaveFile(); }));
  actions.lastChild.className = 'btn';
  actions.appendChild(_tmDesktopSaveButton('返回', '', function() { showMain(); }));
  actions.lastChild.className = 'btn';
  root.appendChild(actions);
  _$("G").style.display = 'none';
}

doSaveGame=async function(){
  await _tmAwaitLoadBarrier();
  if(!GM.running){toast("\u8BF7\u5148\u5F00\u59CB\u6E38\u620F");return;}
  if (typeof _awaitPostTurnJobsForSave === 'function') await _awaitPostTurnJobsForSave();

  if(_tmHasNativeFs()){
    // 桌面端：面板UI
    var sc=findScenarioById(GM.sid);
    var defName=GM.saveName||("T"+GM.turn+"_"+(sc?sc.name:"save"));
    var list=await window.tianming.listSaves();
    var files=list.success?list.files.filter(function(f){return f.name!=="__autosave__";}):[];
    files.sort(function(a,b){return (b.modified||0)-(a.modified||0);});
    _tmShowDesktopSavePanel(files, defName);
  }else{
    // 浏览器端：直接导出
    var sc2=findScenarioById(GM.sid);
    var name="T"+GM.turn+"_"+(sc2?sc2.name:"save")+"_"+new Date().toISOString().slice(0,10);
    var saveData2=_buildSaveState({format:'project'});
    saveData2._saveMeta={name:name,turn:GM.turn,time:getTSText(GM.turn),scenario:sc2?sc2.name:"",date:new Date().toISOString(),version:P.meta.v};
    var blob=new Blob([JSON.stringify(saveData2)],{type:"application/json"});// 紧凑写(存档非配置·再导入走 JSON.parse·缩进约占体积一半)
    var a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name+".json";a.click();
    toast("\u2705 \u5DF2\u5BFC\u51FA: "+name+".json");
  }
};

window.desktopDoSave=async function(){
  await _tmAwaitLoadBarrier();
  var name=(_$("save-name-inp").value||"").trim();
  if(!name){toast("\u8BF7\u8F93\u5165\u5B58\u6863\u540D");return;}
  var sc=findScenarioById(GM.sid);
  if (typeof _awaitPostTurnJobsForSave === 'function') await _awaitPostTurnJobsForSave();
  var saveData=_buildSaveState({format:'project'}); // 在隔离快照上序列化，不修改 live GM/P
  saveData._saveMeta={name:name,turn:GM.turn,time:getTSText(GM.turn),scenario:sc?sc.name:"",date:new Date().toISOString(),version:P.meta.v};
  try{
    var r=await window.tianming.saveProject(name,saveData);
    if(r.success){GM.saveName=name;toast("\u2705 \u5DF2\u4FDD\u5B58");enterGame();}
    else toast("\u5931\u8D25: "+(r.error||""));
  }catch(e){toast("\u5931\u8D25: "+e.message);}
};

// 2. 读档：完整恢复所有状态

// 统一恢复所有_saved*字段到运行时字段
function _restoreSavedFields() {
  // 亲疏/得罪/反弹/观感
  if (GM._savedAffinityMap) { GM.affinityMap = GM._savedAffinityMap; delete GM._savedAffinityMap; }
  if (GM._savedRenli) { GM.renli = GM._savedRenli; delete GM._savedRenli; } // 人力/徭役农政层（R1）
  if (GM._savedOffendScores) { GM.offendGroupScores = GM._savedOffendScores; delete GM._savedOffendScores; }
  if (GM._savedActiveRebounds) { GM.activeRebounds = GM._savedActiveRebounds; delete GM._savedActiveRebounds; }
  if (GM._savedTriggeredOffend) { GM.triggeredOffendEvents = GM._savedTriggeredOffend; delete GM._savedTriggeredOffend; }
  if (GM._savedEventOpinions && typeof OpinionSystem !== 'undefined' && OpinionSystem.restoreEventOpinions) {
    OpinionSystem.restoreEventOpinions(GM._savedEventOpinions);
    delete GM._savedEventOpinions;
  }
  // 昏君/变量映射/后宫/家族/AI记忆
  if (_tmHasOwn(GM, '_savedTyrantDecadence')) { GM._tyrantDecadence = GM._savedTyrantDecadence; delete GM._savedTyrantDecadence; }
  if (GM._savedTyrantHistory) { GM._tyrantHistory = GM._savedTyrantHistory; delete GM._savedTyrantHistory; }
  if (GM._savedVarMapping) { GM._varMapping = GM._savedVarMapping; delete GM._savedVarMapping; }
  if (GM._savedHarem) { GM.harem = GM._savedHarem; delete GM._savedHarem; }
  if (GM._savedFamilies) { GM.families = GM._savedFamilies; delete GM._savedFamilies; }
  if (GM._savedVarFormulas) { GM._varFormulas = GM._savedVarFormulas; delete GM._savedVarFormulas; }
  if (GM._savedForeshadows) { GM._foreshadows = GM._savedForeshadows; delete GM._savedForeshadows; }
  if (GM._savedAiMemory) { GM._aiMemory = GM._savedAiMemory; delete GM._savedAiMemory; }
  if (GM._savedSagaMemory) { GM._sagaMemory = GM._savedSagaMemory; delete GM._savedSagaMemory; }  // agent 多回合综合脉络
  if (GM._savedAgentRecentDirectives) { GM._agentRecentDirectives = GM._savedAgentRecentDirectives; delete GM._savedAgentRecentDirectives; }  // agent 近回合诏书/行止(与 LLM 规则库 _playerDirectives 分开)
  // R103·对话完整归档恢复
  if (GM._savedConvArchive) { GM._convArchive = GM._savedConvArchive; delete GM._savedConvArchive; }
  if (_tmHasOwn(GM, '_savedTrend')) { GM._currentTrend = GM._savedTrend; delete GM._savedTrend; }
  // 新增的_saved*字段恢复
  if (GM._savedCharacterArcs) { GM.characterArcs = GM._savedCharacterArcs; delete GM._savedCharacterArcs; }
  if (GM._savedPlayerDecisions) { GM.playerDecisions = GM._savedPlayerDecisions; delete GM._savedPlayerDecisions; }
  if (GM._savedMemoryArchive) { GM.memoryArchive = GM._savedMemoryArchive; delete GM._savedMemoryArchive; }
  if (GM._savedChronicleAfterwords) { GM.chronicleAfterwords = GM._savedChronicleAfterwords; delete GM._savedChronicleAfterwords; }
  if (GM._savedCustomPolicies) { GM.customPolicies = GM._savedCustomPolicies; delete GM._savedCustomPolicies; }
  if (GM._savedMemoryAnchors) { GM.memoryAnchors = GM._savedMemoryAnchors; delete GM._savedMemoryAnchors; }
  if (GM._savedProvinceStats) { GM.provinceStats = GM._savedProvinceStats; delete GM._savedProvinceStats; }
  if (GM._savedEraState) { GM.eraState = GM._savedEraState; delete GM._savedEraState; }
  if (GM._savedEraStateHistory) { GM.eraStateHistory = GM._savedEraStateHistory; delete GM._savedEraStateHistory; }
  if (GM._savedPostSystem) { GM.postSystem = GM._savedPostSystem; delete GM._savedPostSystem; }
  // 恢复6大系统配置到P
  if (GM._savedVassalSystem) { P.vassalSystem = GM._savedVassalSystem; delete GM._savedVassalSystem; }
  if (GM._savedTitleSystem) { P.titleSystem = GM._savedTitleSystem; delete GM._savedTitleSystem; }
  if (GM._savedBuildingSystem) { P.buildingSystem = GM._savedBuildingSystem; delete GM._savedBuildingSystem; }
  if (GM._savedAdminHierarchy) { P.adminHierarchy = GM._savedAdminHierarchy; delete GM._savedAdminHierarchy; }
  if (GM._savedKeju) { P.keju = GM._savedKeju; delete GM._savedKeju; }
  if (GM._savedOfficialVassalMapping) { P.officialVassalMapping = GM._savedOfficialVassalMapping; delete GM._savedOfficialVassalMapping; }
  if (GM._savedGovernment) { P.government = GM._savedGovernment; delete GM._savedGovernment; }
  // 矛盾演化系统
  if (GM._savedContradictions) { GM._contradictions = GM._savedContradictions; delete GM._savedContradictions; }
  // 鸿雁传书+京城
  if (GM._savedLetters) { GM.letters = GM._savedLetters; delete GM._savedLetters; }
  if (_tmHasOwn(GM, '_savedCapital')) { GM._capital = GM._savedCapital; delete GM._savedCapital; }
  if (GM._savedEraNames) { GM.eraNames = GM._savedEraNames; delete GM._savedEraNames; }
  if (GM._savedAiDigest) { GM._aiScenarioDigest = GM._savedAiDigest; delete GM._savedAiDigest; }
  // 恢复诏令追踪字段
  if (GM._savedEdictTracker) { GM._edictTracker = GM._savedEdictTracker; delete GM._savedEdictTracker; }
  // 恢复诏令草稿到 textarea（延时执行，确保 DOM 已就绪）
  if (GM._savedEdictDrafts) {
    var _drafts = GM._savedEdictDrafts;
    delete GM._savedEdictDrafts;
    setTimeout(function() {
      Object.keys(_drafts).forEach(function(id) {
        var el = typeof _$ === 'function' ? _$(id) : document.getElementById(id);
        if (el) el.value = _drafts[id];
      });
    }, 500);
  }
  // 恢复事件总线
  if (GM._savedEventBus && typeof StoryEventBus !== 'undefined') { StoryEventBus.deserialize(GM._savedEventBus); delete GM._savedEventBus; }
  // 恢复恩怨/门生/阴谋
  if (GM._savedEnYuanRecords) { GM.enYuanRecords = GM._savedEnYuanRecords; delete GM._savedEnYuanRecords; }
  if (GM._savedPatronNetwork) { GM.patronNetwork = GM._savedPatronNetwork; delete GM._savedPatronNetwork; }
  if (GM._savedActiveSchemes) { GM.activeSchemes = GM._savedActiveSchemes; delete GM._savedActiveSchemes; }
  if (GM._savedFeudalSchemes) { GM._feudalSchemes = GM._savedFeudalSchemes; delete GM._savedFeudalSchemes; }   // 刀丁2·feudal 账本恢复
  // 批己·谈判会话恢复
  if (GM._savedNegotiations) { GM._negotiations = GM._savedNegotiations; delete GM._savedNegotiations; }
  if (GM._savedNegotiationSeq !== undefined) { GM._negotiationSeq = GM._savedNegotiationSeq; delete GM._savedNegotiationSeq; }
  if (GM._savedYearlyChronicles) { GM.yearlyChronicles = GM._savedYearlyChronicles; delete GM._savedYearlyChronicles; }
  if (GM._savedMonthlyChronicles) { GM.monthlyChronicles = GM._savedMonthlyChronicles; delete GM._savedMonthlyChronicles; }
  if (GM._savedAiMemorySummaries) { GM._aiMemorySummaries = GM._savedAiMemorySummaries; delete GM._savedAiMemorySummaries; }
  if (GM._savedSchemeCooldowns) { GM.schemeCooldowns = GM._savedSchemeCooldowns; delete GM._savedSchemeCooldowns; }
  if (GM._savedEventCooldowns) { GM.eventCooldowns = GM._savedEventCooldowns; delete GM._savedEventCooldowns; }
  // 恢复战斗/行军/围城系统运行时数据
  if (GM._savedMarchOrders) { GM.marchOrders = GM._savedMarchOrders; delete GM._savedMarchOrders; }
  if (GM._savedActiveSieges) { GM.activeSieges = GM._savedActiveSieges; delete GM._savedActiveSieges; }
  if (GM._savedActiveBattles) { GM.activeBattles = GM._savedActiveBattles; delete GM._savedActiveBattles; }
  if (GM._savedBattleHistory) { GM.battleHistory = GM._savedBattleHistory; delete GM._savedBattleHistory; }
  if (GM._savedActiveWars) { GM.activeWars = GM._savedActiveWars; delete GM._savedActiveWars; }
  if (GM._savedTreaties) { GM.treaties = GM._savedTreaties; delete GM._savedTreaties; }
  if (GM._savedDiplomaticMissions) { GM._diplomaticMissions = GM._savedDiplomaticMissions; delete GM._savedDiplomaticMissions; }
  if (GM._savedForeshadowings) { GM._foreshadowings = GM._savedForeshadowings; delete GM._savedForeshadowings; }
  if (GM._savedTensionHistory) { GM._tensionHistory = GM._savedTensionHistory; delete GM._savedTensionHistory; }
  if (GM._savedYearlyDigest) { GM._yearlyDigest = GM._savedYearlyDigest; delete GM._savedYearlyDigest; }
  if (GM._savedMetricHistory) { GM._metricHistory = GM._savedMetricHistory; delete GM._savedMetricHistory; }
  if (GM._savedMilitaryReform) { GM._militaryReform = GM._savedMilitaryReform; delete GM._savedMilitaryReform; }
  if (GM._savedRngCheckpoints) { GM._rngCheckpoints = GM._savedRngCheckpoints; delete GM._savedRngCheckpoints; }
  // 恢复新增系统字段
  if (GM._savedEnergy !== undefined) { GM._energy = GM._savedEnergy; delete GM._savedEnergy; }
  if (GM._savedEnergyMax !== undefined) { GM._energyMax = GM._savedEnergyMax; delete GM._savedEnergyMax; }
  if (GM._savedAnnualReviewHistory) { GM._annualReviewHistory = GM._savedAnnualReviewHistory; delete GM._savedAnnualReviewHistory; }
  if (GM._savedKejuPending) { GM._kejuPendingAssignment = GM._savedKejuPending; delete GM._savedKejuPending; }
  if (GM._savedSuccessionEvent) { GM._successionEvent = GM._savedSuccessionEvent; delete GM._savedSuccessionEvent; }
  // 阶段一新字段恢复
  if (GM._savedMutableFacts) { GM._mutableFacts = GM._savedMutableFacts; delete GM._savedMutableFacts; }
  if (GM._savedLostTerritories) { GM._lostTerritories = GM._savedLostTerritories; delete GM._savedLostTerritories; }
  if (GM._savedCurrentIssues) { GM.currentIssues = GM._savedCurrentIssues; delete GM._savedCurrentIssues; }
  if (GM._savedAiDispatchStats) { GM._aiDispatchStats = GM._savedAiDispatchStats; delete GM._savedAiDispatchStats; }
  if (GM._savedNpcClaims) { GM._npcClaims = GM._savedNpcClaims; delete GM._savedNpcClaims; }
  if (GM._savedEavesdroppedTopics) { GM._eavesdroppedTopics = GM._savedEavesdroppedTopics; delete GM._savedEavesdroppedTopics; }
  if (GM._savedInterceptedIntel) { GM._interceptedIntel = GM._savedInterceptedIntel; delete GM._savedInterceptedIntel; }
  if (GM._savedUndeliveredLetters) { GM._undeliveredLetters = GM._savedUndeliveredLetters; delete GM._savedUndeliveredLetters; }
  if (GM._savedLetterSuspects) { GM._letterSuspects = GM._savedLetterSuspects; delete GM._savedLetterSuspects; }
  if (GM._savedCourierStatus) { GM._courierStatus = GM._savedCourierStatus; delete GM._savedCourierStatus; }
  if (GM._savedPendingNpcLetters) { GM._pendingNpcLetters = GM._savedPendingNpcLetters; delete GM._savedPendingNpcLetters; }
  if (GM._savedPendingMemDeliveries) { GM._pendingMemorialDeliveries = GM._savedPendingMemDeliveries; delete GM._savedPendingMemDeliveries; }
  if (GM._savedPendingNpcCorr) { GM._pendingNpcCorrespondence = GM._savedPendingNpcCorr; delete GM._savedPendingNpcCorr; }
  if (GM._savedNpcInternalActionHistory) { GM._npcInternalActionHistory = GM._savedNpcInternalActionHistory; delete GM._savedNpcInternalActionHistory; }
  if (GM._savedNpcActionLedger) { GM._npcActionLedger = GM._savedNpcActionLedger; delete GM._savedNpcActionLedger; }
  if (GM._savedNpcPlans) { GM._npcPlans = GM._savedNpcPlans; delete GM._savedNpcPlans; }
  if (GM._savedNpcDecisionDiagnostics) { GM._npcDecisionDiagnostics = GM._savedNpcDecisionDiagnostics; delete GM._savedNpcDecisionDiagnostics; }
  if (GM._savedNpcFactionAiTurnLedger) { GM._npcFactionAiTurnLedger = GM._savedNpcFactionAiTurnLedger; delete GM._savedNpcFactionAiTurnLedger; }
  if (GM._savedNpcFactionLlmLedger) { GM._npcFactionLlmLedger = GM._savedNpcFactionLlmLedger; delete GM._savedNpcFactionLlmLedger; }
  if (GM._savedNpcFactionLlmDispatchLedger) { GM._npcFactionLlmDispatchLedger = GM._savedNpcFactionLlmDispatchLedger; delete GM._savedNpcFactionLlmDispatchLedger; }
  if (GM._savedSc16FactionDirectives) { GM._sc16FactionDirectives = GM._savedSc16FactionDirectives; delete GM._savedSc16FactionDirectives; }
  if (GM._savedOfficeCollapsed) { GM._officeCollapsed = GM._savedOfficeCollapsed; delete GM._savedOfficeCollapsed; }
  if (GM._savedWdState) { GM._wdState = GM._savedWdState; delete GM._savedWdState; }
  if (GM._savedPlayerDirectives) { GM._playerDirectives = GM._savedPlayerDirectives; delete GM._savedPlayerDirectives; }
  if (GM._savedImportedMemories) { GM._importedMemories = GM._savedImportedMemories; delete GM._savedImportedMemories; }
  if (GM._savedWentianHistory) { GM._wentianHistory = GM._savedWentianHistory; delete GM._savedWentianHistory; }
  // 新增：记忆系统恢复
  if (GM._savedMemoryLayers) { GM._memoryLayers = GM._savedMemoryLayers; delete GM._savedMemoryLayers; }
  if (GM._savedEpitaphs) { GM._epitaphs = GM._savedEpitaphs; delete GM._savedEpitaphs; }
  if (GM._savedFakeDeathHolding) { GM._fakeDeathHolding = GM._savedFakeDeathHolding; delete GM._savedFakeDeathHolding; }
  if (GM._savedFiscalValidatorLog) { GM._fiscalValidatorLog = GM._savedFiscalValidatorLog; delete GM._savedFiscalValidatorLog; }
  // M1-M4 新增字段
  if (GM._savedMemoryArchiveFull) { GM._memoryArchiveFull = GM._savedMemoryArchiveFull; delete GM._savedMemoryArchiveFull; }
  if (GM._savedCausalGraph) { GM._causalGraph = GM._savedCausalGraph; delete GM._savedCausalGraph; }
  if (GM._savedFactionArcs) { GM._factionArcs = GM._savedFactionArcs; delete GM._savedFactionArcs; }
  if (GM._savedAiReflections) { GM._aiReflections = GM._savedAiReflections; delete GM._savedAiReflections; }
  if (GM._savedLastTurnPredictions) { GM._lastTurnPredictions = GM._savedLastTurnPredictions; delete GM._savedLastTurnPredictions; }
  if (GM._savedCharMemExt && GM.chars) {
    GM.chars.forEach(function(c) {
      if (!c || !c.name) return;
      var e = GM._savedCharMemExt[c.name];
      if (!e) return;
      if (e.arcs) c._arcs = e.arcs;
      if (e.relationHistory) c._relationHistory = e.relationHistory;
    });
    delete GM._savedCharMemExt;
  }
  if (GM._savedChronicle) { GM._chronicle = GM._savedChronicle; delete GM._savedChronicle; }
  if (GM._savedWdRewardPunish) { GM._wdRewardPunish = GM._savedWdRewardPunish; delete GM._savedWdRewardPunish; }
  if (_tmHasOwn(GM, '_savedLastEvalTurn')) { GM._lastEvalTurn = GM._savedLastEvalTurn; delete GM._savedLastEvalTurn; }
  // 恢复角色官制字段
  if (GM._savedCharOfficeFields && GM.chars) {
    GM.chars.forEach(function(c) {
      var f = GM._savedCharOfficeFields[c.name];
      if (!f) return;
      if (f.mourning) c._mourning = f.mourning;
      if (f.retired) c._retired = true;
      if (f.retireTurn) c._retireTurn = f.retireTurn;
      if (f.recommendedBy) c._recommendedBy = f.recommendedBy;
      if (f.recommendTurn) c._recommendTurn = f.recommendTurn;
      if (f.mourningOldPost) c._mourningOldPost = f.mourningOldPost;
      if (f.mourningDismissed) c._mourningDismissed = true;
    });
    delete GM._savedCharOfficeFields;
  }
  if (GM._savedRouteDisruptions) { GM._routeDisruptions = GM._savedRouteDisruptions; delete GM._savedRouteDisruptions; }
  if (GM._savedNpcCorrespondence) { GM._npcCorrespondence = GM._savedNpcCorrespondence; delete GM._savedNpcCorrespondence; }
  if (GM._savedEraProgress) { GM.eraProgress = GM._savedEraProgress; delete GM._savedEraProgress; }
  if (GM._savedBorderThreat !== undefined) { GM.borderThreat = GM._savedBorderThreat; delete GM._savedBorderThreat; }
  if (GM._savedOfficeConfig) { P.officeConfig = GM._savedOfficeConfig; delete GM._savedOfficeConfig; }
  // 恢复建筑运行时数据
  if (GM._savedBuildings) { GM.buildings = GM._savedBuildings; delete GM._savedBuildings; }
  if (GM._savedBuildingQueue) { GM.buildingQueue = GM._savedBuildingQueue; delete GM._savedBuildingQueue; }
  if (GM._savedMapData) { GM.mapData = GM._savedMapData; delete GM._savedMapData; }
  if (GM._savedNpcContext) { GM.npcContext = GM._savedNpcContext; delete GM._savedNpcContext; }
  if (GM._savedPendingConsequences) { GM.pendingConsequences = GM._savedPendingConsequences; delete GM._savedPendingConsequences; }
  if (GM._savedFactionRelations) { GM.factionRelations = GM._savedFactionRelations; delete GM._savedFactionRelations; }
  if (GM._savedFactionEvents) { GM.factionEvents = GM._savedFactionEvents; delete GM._savedFactionEvents; }
  if (GM._savedFactionHistory) { GM._factionHistory = GM._savedFactionHistory; delete GM._savedFactionHistory; }
  if (GM._savedFacUndHist) { GM._factionUndercurrentsHistory = GM._savedFacUndHist; delete GM._savedFacUndHist; }
  if (GM._savedFacUndercurrents) { GM._factionUndercurrents = GM._savedFacUndercurrents; delete GM._savedFacUndercurrents; }
  if (GM._savedApprovedMemorials) { GM._approvedMemorials = GM._savedApprovedMemorials; delete GM._savedApprovedMemorials; }
  if (GM._savedCourtRecords) { GM._courtRecords = GM._savedCourtRecords; delete GM._savedCourtRecords; }
  if (GM._savedPlotThreads) { GM._plotThreads = GM._savedPlotThreads; delete GM._savedPlotThreads; }
  if (GM._savedDecisionEchoes) { GM._decisionEchoes = GM._savedDecisionEchoes; delete GM._savedDecisionEchoes; }
  if (GM._savedEdictSuggestions) { GM._edictSuggestions = GM._savedEdictSuggestions; delete GM._savedEdictSuggestions; }
  if (GM._savedCulturalWorks) { GM.culturalWorks = GM._savedCulturalWorks; delete GM._savedCulturalWorks; }
  if (GM._savedForgottenWorks) { GM._forgottenWorks = GM._savedForgottenWorks; delete GM._savedForgottenWorks; }
  if (GM._savedFactionRelationsMap) { GM.factionRelationsMap = GM._savedFactionRelationsMap; delete GM._savedFactionRelationsMap; }
  if (GM._savedEdictLifecycle) { GM._edictLifecycle = GM._savedEdictLifecycle; delete GM._savedEdictLifecycle; }
  if (GM._savedActiveRevolts) { GM._activeRevolts = GM._savedActiveRevolts; delete GM._savedActiveRevolts; }
  if (GM._savedRevoltPrecursors) { GM._revoltPrecursors = GM._savedRevoltPrecursors; delete GM._savedRevoltPrecursors; }
  if (GM._savedNpcCommitments) { GM._npcCommitments = GM._savedNpcCommitments; delete GM._savedNpcCommitments; }
  if (GM._savedSecretMeetings) { GM._secretMeetings = GM._savedSecretMeetings; delete GM._savedSecretMeetings; }
  if (GM._savedAchievements) { GM._achievements = GM._savedAchievements; delete GM._savedAchievements; }
  // 7.4: 历史索引恢复
  if (GM._savedHistoryIndex) { GM._historyIndex = GM._savedHistoryIndex; delete GM._savedHistoryIndex; }
  if (GM._savedHistoryIndexCursor) { GM._historyIndexCursor = GM._savedHistoryIndexCursor; delete GM._savedHistoryIndexCursor; }
}

// 机器级 AI 偏好字段·属"玩家设置"而非"局内状态"·读档时不应被存档快照覆盖(同 tm_api 保护逻辑)
// 仅含 AI 生成/记忆/模型/管线类偏好·不含 gameMode/difficulty/refText/style 等局内定义字段(那些应随存档)
var PREF_CONF_KEYS = [
  'verbosity', 'aiCallDepth',
  'maxOutputTokens', 'turnTokenBudget', 'modelTier', 'contextSizeK',
  'memoryAnchorKeep', 'memoryArchiveKeep', 'characterArcKeep',
  'playerDecisionKeep', 'chronicleKeep', 'convKeep',
  'shiluMin', 'shiluMax', 'szjMin', 'szjMax', 'hourenMin', 'hourenMax',
  'memLoyalMin', 'memLoyalMax', 'memNormalMin', 'memNormalMax',
  'memSecretMin', 'memSecretMax', 'wdMin', 'wdMax', 'cyMin', 'cyMax',
  'chronicleMin', 'chronicleMax', 'commentMin', 'commentMax',
  'qijuLookback', 'shijiLookback', 'autoSaveTurns', 'summaryRule',
  'dialogueRecallTurns', 'costAlertThreshold', 'strictSchemaEnabled', 'memorySynthesisEnabled',
  'npcAiPrecision', 'npcAiCosmeticEnrich', 'npcAiPrecisionMode', 'npcAiPrecisionMaxPerTurn', 'npcInTurnMaxPerTurn',
  'insecureTlsRelay'
];

function _tmCaptureLoadStepError(error, label, silent) {
  if (!error || (typeof error !== 'object' && typeof error !== 'function')) error = new Error(String(error));
  try { error._tmLoadStep = String(label || 'unknown'); }
  catch (tagError) {
    if (typeof console !== 'undefined' && console.warn) console.warn('[fullLoadGame] failed to tag load-step error:', tagError);
  }
  try {
    if (window.TM && TM.errors) {
      if (silent && typeof TM.errors.captureSilent === 'function') TM.errors.captureSilent(error, 'fullLoadGame·' + label);
      else if (typeof TM.errors.capture === 'function') TM.errors.capture(error, 'fullLoadGame·' + label);
    }
  } catch (captureError) {
    if (typeof console !== 'undefined' && console.warn) console.warn('[fullLoadGame] error reporter failed:', captureError, error);
  }
  return error;
}

function _tmRunCriticalLoadStep(label, fn) {
  try { return fn(); }
  catch (error) { throw _tmCaptureLoadStepError(error, label, false); }
}

function _tmRunDegradableLoadStep(label, fn) {
  try { return fn(); }
  catch (error) {
    _tmCaptureLoadStepError(error, label, true);
    return null;
  }
}

function _tmRunDegradableLoadStepAsync(label, fn) {
  return Promise.resolve().then(fn).catch(function(error) {
    _tmCaptureLoadStepError(error, label, true);
    return null;
  });
}

function _tmStripSaveTransportMetadata(target) {
  if (!target || typeof target !== 'object' || Array.isArray(target)) return target;
  Object.keys(target).forEach(function(key) {
    // Electron 文件 envelope / auto-save envelope 只属于传输层，绝不能随 P/GM
    // 进入玩法状态、快照或下一份导出档。
    if (/^__tm(?:Desktop|AutoSave)/.test(key)) delete target[key];
  });
  return target;
}

function _tmRuntimeMapSourceForWorld(targetP, targetGM) {
  var source = (targetGM && targetGM.mapData && targetGM.mapData.regions && targetGM.mapData.regions.length > 0) ? targetGM.mapData :
    (targetP && targetP.map && targetP.map.regions && targetP.map.regions.length > 0) ? targetP.map :
    (targetP && targetP.mapData && targetP.mapData.regions && targetP.mapData.regions.length > 0) ? targetP.mapData : null;
  if (!source && typeof findScenarioById === 'function' && targetGM && targetGM.sid) {
    var scenario = findScenarioById(targetGM.sid);
    var scenarioMap = scenario && ((scenario.mapData && scenario.mapData.regions && scenario.mapData.regions.length > 0) ? scenario.mapData : scenario.map);
    if (scenarioMap && scenarioMap.regions && scenarioMap.regions.length > 0) source = scenarioMap;
  }
  return source;
}

// 成功读档与失败回滚共用同一条“纯重绑定”路径。它可以补 schema、代理和
// 派生索引，但不得推进人口、腐败、财政、战争或任何其他玩法时间。
function _tmRebindRuntimeWorld(options) {
  options = options || {};
  var strict = options.strict === true;
  var targetP = options.p || P;
  var targetGM = options.gm || GM;
  if (!targetP || !targetGM || targetP !== P || targetGM !== GM) throw new Error('运行世界重绑定目标不是当前 P/GM');

  function run(label, fn) {
    if (strict) return _tmRunCriticalLoadStep(label, fn);
    return _tmRunDegradableLoadStep(label, fn);
  }

  if (options.map !== false) {
    run('runtime map rebind', function() {
      var liveMapSource = _tmRuntimeMapSourceForWorld(targetP, targetGM);
      if (liveMapSource && typeof bindRuntimeMapState === 'function') {
        bindRuntimeMapState(liveMapSource);
        targetGM._useAIGeo = false;
      } else if (liveMapSource) {
        targetGM.mapData = _safeClone(liveMapSource);
        targetGM._useAIGeo = false;
      }
    });
  }

  if (options.integration !== false && typeof IntegrationBridge !== 'undefined' && IntegrationBridge) {
    run('integration bridge pure rebind', function() {
      var rebind = typeof IntegrationBridge.migrateAndRebind === 'function'
        ? IntegrationBridge.migrateAndRebind : IntegrationBridge.init;
      if (typeof rebind === 'function') rebind.call(IntegrationBridge, { strict: strict, advanceSimulation: false });
    });
  }
  if (options.indices !== false && typeof buildIndices === 'function') {
    run('runtime indices rebind', function() { buildIndices(); });
  }
  if (options.faction !== false && window.TM && TM.FactionIndex && typeof TM.FactionIndex.rebuild === 'function') {
    run('faction index rebind', function() { TM.FactionIndex.rebuild(); });
  }
  if (options.memory !== false && window.MemTables && typeof MemTables.ensureInit === 'function') {
    run('memory tables rebind', function() { MemTables.ensureInit(); });
  }
  return true;
}

function _tmStableIdMissing(value) {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

function _tmStableIdHash(text) {
  var hash = 2166136261;
  text = String(text || '');
  for (var i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = typeof Math.imul === 'function' ? Math.imul(hash, 16777619) : hash * 16777619;
  }
  return ('00000000' + (hash >>> 0).toString(16)).slice(-8);
}

function _tmStableIdentityParts(kind, item) {
  item = item || {};
  var sourceIdentity = [item.sourceId, item.sourceKey, item.uuid, item.legacyId, item.originalId]
    .map(function(value) { return value === undefined || value === null ? '' : String(value).trim(); })
    .filter(Boolean);
  // 显式来源身份单独构成种子；若再拼入可改名的显示字段，同一 sourceId
  // 在旧档分支改名后仍会生成不同 ID。
  if (sourceIdentity.length) return ['source'].concat(sourceIdentity);
  var semanticIdentity;
  if (kind === 'char') {
    semanticIdentity = [item.sid, item.key, item.name, item.zi, item.courtesyName, item.birthDate, item.birthYear, item.birthplace, item.gender];
  } else if (kind === 'faction') {
    semanticIdentity = [item.sid, item.key, item.name, item.foundedYear, item.dynasty, item.culture, item.faith];
  } else if (kind === 'army') {
    semanticIdentity = [item.sid, item.key, item.name, item.createdTurn, item.foundedYear, item.homeRegionId, item.homeRegion];
  } else if (kind === 'region' || kind === 'division') {
    semanticIdentity = [item.sid, item.key, item.mapRegionId, item.regionId, item.name, item.level, item.parentId, item.longitude, item.latitude];
  } else {
    semanticIdentity = [item.name, item.title, item.type, item.kind];
  }
  // Only immutable/source-like attributes participate. Faction, owner,
  // location, commander and composition are gameplay state and would make a
  // legacy entity change identity across save branches.
  return semanticIdentity.map(function(value) {
    if (value === undefined || value === null) return '';
    if (typeof value === 'object') {
      try { return JSON.stringify(value); } catch (_) { return ''; }
    }
    return String(value).trim();
  }).filter(Boolean);
}

function _tmCollectAdminDivisionEntries(targetGM) {
  var out = [];
  var hierarchy = targetGM && targetGM.adminHierarchy;
  if (!hierarchy || typeof hierarchy !== 'object') return out;
  var visited = typeof WeakSet === 'function' ? new WeakSet() : null;
  function walk(nodes, path, identityPath) {
    (Array.isArray(nodes) ? nodes : []).forEach(function(node, index) {
      if (!node || typeof node !== 'object') return;
      if (visited) {
        if (visited.has(node)) return;
        visited.add(node);
      }
      var nodePath = path + '/' + index;
      var identityToken = _tmStableIdentityParts('division', node).join('|') || ('index:' + index);
      var nodeIdentityPath = identityPath + '/' + identityToken;
      out.push({ item: node, path: nodePath, identityPath: nodeIdentityPath });
      [node.children, node.divisions, node.subdivisions, node.subs].forEach(function(children) {
        if (Array.isArray(children)) walk(children, nodePath, nodeIdentityPath);
      });
    });
  }
  if (Array.isArray(hierarchy.divisions)) {
    walk(hierarchy.divisions, 'admin/player', 'admin/player');
  } else {
    Object.keys(hierarchy).sort().forEach(function(factionKey) {
      var branch = hierarchy[factionKey];
      var roots = Array.isArray(branch) ? branch : (branch && branch.divisions);
      walk(roots, 'admin/' + factionKey, 'admin/' + factionKey);
    });
  }
  return out;
}

function _tmAssignMissingStableIds(targetGM, kind, entries) {
  entries = Array.isArray(entries) ? entries : [];
  var unresolvedFingerprints = Object.create(null);
  entries.forEach(function(entry, index) {
    var item = entry && entry.item;
    if (!item || !_tmStableIdMissing(item.id)) return;
    var parts = _tmStableIdentityParts(kind, item);
    if (!parts.length) return;
    var parentIdentity = '';
    if (kind === 'division' && entry.identityPath) {
      var identitySegments = String(entry.identityPath).split('/');
      identitySegments.pop();
      parentIdentity = identitySegments.join('/');
    }
    var fingerprint = parts.join('|') + (parentIdentity ? '|parent:' + parentIdentity : '');
    if (_tmHasOwn(unresolvedFingerprints, fingerprint)) {
      throw new Error('旧存档 ' + kind + ' 身份歧义：' + String(unresolvedFingerprints[fingerprint]) + ' 与 ' + String(entry.path || index) + ' 缺少可区分的稳定来源字段');
    }
    unresolvedFingerprints[fingerprint] = entry.path || index;
  });
  var used = Object.create(null);
  entries.forEach(function(entry) {
    var item = entry && entry.item;
    if (!item || _tmStableIdMissing(item.id)) return;
    used[String(item.id).trim()] = true;
  });
  var assigned = 0;
  entries.forEach(function(entry, index) {
    var item = entry && entry.item;
    if (!item || !_tmStableIdMissing(item.id)) return;
    var path = String(entry.path || index);
    var identityParts = _tmStableIdentityParts(kind, item);
    // 数组位置只在实体完全没有语义身份，或同指纹碰撞时作最后消歧；
    // 常规人物/势力/军队/地区在重排、删除前置项后仍生成同一 ID。
    var semanticIdentity = identityParts.length ? identityParts.join('|') : String(entry.identityPath || path);
    var seed = [targetGM && (targetGM.sid || targetGM._campaignId) || '', kind, semanticIdentity].join('|');
    var base = 'tmlegacy_' + kind + '_' + _tmStableIdHash(seed) + _tmStableIdHash(seed.split('').reverse().join(''));
    var candidate = base;
    if (used[candidate]) {
      var disambiguator = String(entry.identityPath || path);
      candidate = base + '_' + _tmStableIdHash(seed + '|collision|' + disambiguator);
      var suffix = 2;
      while (used[candidate]) candidate = base + '_' + _tmStableIdHash(seed + '|collision|' + disambiguator) + '_' + suffix++;
    }
    item.id = candidate; // arch-ok: 旧存档核心实体稳定 ID 的确定性 schema 迁移
    used[candidate] = true;
    assigned++;
  });
  return assigned;
}

function _tmUniqueEntityIdByName(list) {
  var map = Object.create(null);
  (Array.isArray(list) ? list : []).forEach(function(item) {
    if (!item || _tmStableIdMissing(item.id) || !String(item.name || '').trim()) return;
    var name = String(item.name).trim();
    if (_tmHasOwn(map, name)) map[name] = null;
    else map[name] = item.id;
  });
  return map;
}

function _tmEntityIdSet(list) {
  var set = Object.create(null);
  (Array.isArray(list) ? list : []).forEach(function(item) {
    if (!item || _tmStableIdMissing(item.id)) return;
    set[String(item.id).trim()] = true;
  });
  return set;
}

function _tmBackfillStableForeignKeys(targetGM) {
  var factionByName = _tmUniqueEntityIdByName(targetGM.facs);
  var charByName = _tmUniqueEntityIdByName(targetGM.chars);
  var factionIds = _tmEntityIdSet(targetGM.facs);
  var charIds = _tmEntityIdSet(targetGM.chars);
  function repairNamedRef(owner, idField, nameValue, idSet, nameMap) {
    if (!owner || (!_tmStableIdMissing(owner[idField]) && idSet[String(owner[idField]).trim()])) return;
    var name = typeof nameValue === 'string' ? nameValue.trim() : '';
    var id = name && nameMap[name];
    if (id != null) owner[idField] = id; // arch-ok: 旧名称外键迁移到稳定实体 ID
  }
  function repairNamedRefArray(owner, field, idSet, nameMap) {
    if (!owner || !Array.isArray(owner[field])) return;
    owner[field] = owner[field].map(function(value) {
      var key = typeof value === 'string' ? value.trim() : '';
      if (!key || idSet[key]) return value;
      return nameMap[key] != null ? nameMap[key] : value; // arch-ok: 旧姓名数组外键仅在唯一可解析时迁移
    });
  }
  (targetGM.chars || []).forEach(function(ch) {
    if (!ch) return;
    repairNamedRef(ch, 'factionId', ch.faction, factionIds, factionByName);
    repairNamedRef(ch, 'fatherId', ch.father, charIds, charByName);
    repairNamedRef(ch, 'motherId', ch.mother, charIds, charByName);
    repairNamedRef(ch, 'spouseId', ch.spouse, charIds, charByName);
    repairNamedRef(ch, 'mentorId', ch.mentor, charIds, charByName);
    repairNamedRef(ch, 'designatedHeirId', ch.designatedHeir || ch.designatedHeirId, charIds, charByName);
    ['childrenIds', 'studentIds', 'studentsIds', 'relativeIds'].forEach(function(field) {
      repairNamedRefArray(ch, field, charIds, charByName);
    });
    (Array.isArray(ch.familyMembers) ? ch.familyMembers : []).forEach(function(member) {
      if (!member || typeof member !== 'object') return;
      repairNamedRef(member, 'characterId', member.name, charIds, charByName);
      repairNamedRef(member, 'personId', member.name, charIds, charByName);
    });
  });
  if (targetGM.harem && typeof targetGM.harem === 'object') {
    repairNamedRef(targetGM.harem, 'crownPrinceId', targetGM.harem.crownPrince || targetGM.harem.crownPrinceId, charIds, charByName);
  }
  (targetGM.facs || []).forEach(function(fac) {
    if (!fac) return;
    repairNamedRef(fac, 'leaderId', fac.leader, charIds, charByName);
    repairNamedRef(fac, 'coLeaderId', fac.coLeader, charIds, charByName);
    repairNamedRef(fac, 'heirId', fac.heir, charIds, charByName);
  });
  (targetGM.armies || []).forEach(function(army) {
    if (!army) return;
    var commanderName = typeof army.commander === 'string' ? army.commander : (army.commanderName || army.general || army.leader || '');
    repairNamedRef(army, 'commanderId', commanderName, charIds, charByName);
    repairNamedRef(army, 'factionId', army.faction || army.factionName || army.owner || '', factionIds, factionByName);
  });
  var regions = targetGM.mapData && targetGM.mapData.regions;
  (Array.isArray(regions) ? regions : []).forEach(function(region) {
    if (!region) return;
    var ownerName = region.currentOwner || region.owner || region.controller || region.factionName || region.ownerName || '';
    repairNamedRef(region, 'factionId', ownerName, factionIds, factionByName);
    repairNamedRef(region, 'governorId', region.governor, charIds, charByName);
  });
  _tmCollectAdminDivisionEntries(targetGM).forEach(function(entry) {
    var division = entry && entry.item;
    if (division) repairNamedRef(division, 'governorId', division.governor, charIds, charByName);
  });
  (function walkOffices(nodes) {
    (Array.isArray(nodes) ? nodes : []).forEach(function(node) {
      (Array.isArray(node && node.positions) ? node.positions : []).forEach(function(position) {
        if (!position) return;
        repairNamedRef(position, 'holderId', position.holder, charIds, charByName);
        (Array.isArray(position.actualHolders) ? position.actualHolders : []).forEach(function(holder) {
          if (!holder || typeof holder !== 'object') return;
          repairNamedRef(holder, 'characterId', holder.name, charIds, charByName);
          repairNamedRef(holder, 'personId', holder.name, charIds, charByName);
          repairNamedRef(holder, 'holderId', holder.name, charIds, charByName);
        });
      });
      var subs = Array.isArray(node && node.subs) ? node.subs : [];
      var children = Array.isArray(node && node.children) && node.children !== subs ? node.children : [];
      walkOffices(subs);
      walkOffices(children);
    });
  })(targetGM.officeTree);
}

function _tmMigrateCoreStableIds(targetGM) {
  if (!targetGM || typeof targetGM !== 'object') return { total: 0, byType: {} };
  var groups = {
    char: (targetGM.chars || []).map(function(item, index) { return { item: item, path: 'chars/' + index }; }),
    faction: (targetGM.facs || []).map(function(item, index) { return { item: item, path: 'facs/' + index }; }),
    army: (targetGM.armies || []).map(function(item, index) { return { item: item, path: 'armies/' + index }; }),
    region: ((targetGM.mapData && targetGM.mapData.regions) || []).map(function(item, index) { return { item: item, path: 'mapData/regions/' + index }; }),
    division: _tmCollectAdminDivisionEntries(targetGM)
  };
  var result = { total: 0, byType: {} };
  Object.keys(groups).forEach(function(kind) {
    var count = _tmAssignMissingStableIds(targetGM, kind, groups[kind]);
    result.byType[kind] = count;
    result.total += count;
  });
  _tmBackfillStableForeignKeys(targetGM);
  if (result.total > 0) {
    if (!targetGM._stableIdMigration || typeof targetGM._stableIdMigration !== 'object') {
      targetGM._stableIdMigration = { version: 3, totalAssigned: 0, byType: {} }; // arch-ok: schema 迁移收据
    }
    targetGM._stableIdMigration.version = 3;
    targetGM._stableIdMigration.totalAssigned = Number(targetGM._stableIdMigration.totalAssigned || 0) + result.total;
    Object.keys(result.byType).forEach(function(kind) {
      targetGM._stableIdMigration.byType[kind] = Number(targetGM._stableIdMigration.byType[kind] || 0) + result.byType[kind];
    });
  }
  return result;
}

function _tmValidateUniqueStableIds(label, list) {
  if (!Array.isArray(list)) return;
  var seen = Object.create(null);
  list.forEach(function(item, index) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error(label + ' 第 ' + index + ' 项不是合法对象');
    if (_tmStableIdMissing(item.id)) throw new Error(label + ' 缺少稳定 id（索引 ' + index + '）');
    var raw = item.id;
    if (typeof raw !== 'string' && !(typeof raw === 'number' && Number.isSafeInteger(raw) && raw >= 0)) {
      throw new Error(label + ' id 类型非法（索引 ' + index + '）');
    }
    var id = String(raw).trim();
    if (!id || id.length > 256 || /[\u0000-\u001f\u007f]/.test(id)) throw new Error(label + ' id 格式非法（索引 ' + index + '）');
    if (seen[id] !== undefined) throw new Error(label + ' 存在重复 id: ' + id + '（索引 ' + seen[id] + ' / ' + index + '）');
    seen[id] = index;
  });
}

function _tmValidateStableForeignKeys(targetGM) {
  var factionIds = _tmEntityIdSet(targetGM.facs);
  var charIds = _tmEntityIdSet(targetGM.chars);
  function requireExisting(label, value, set) {
    if (_tmStableIdMissing(value)) return;
    var key = String(value).trim();
    if (!set[key]) throw new Error(label + ' 指向不存在的稳定 id: ' + key);
  }
  (targetGM.chars || []).forEach(function(ch, index) {
    if (!ch) return;
    requireExisting('人物[' + index + '].factionId', ch.factionId, factionIds);
    ['fatherId', 'motherId', 'spouseId', 'mentorId', 'designatedHeirId'].forEach(function(field) {
      requireExisting('人物[' + index + '].' + field, ch[field], charIds);
    });
    ['childrenIds', 'studentIds', 'studentsIds', 'relativeIds'].forEach(function(field) {
      (Array.isArray(ch[field]) ? ch[field] : []).forEach(function(id, refIndex) {
        requireExisting('人物[' + index + '].' + field + '[' + refIndex + ']', id, charIds);
      });
    });
    (Array.isArray(ch.familyMembers) ? ch.familyMembers : []).forEach(function(member, memberIndex) {
      if (!member || typeof member !== 'object') return;
      requireExisting('人物[' + index + '].familyMembers[' + memberIndex + '].characterId', member.characterId, charIds);
      requireExisting('人物[' + index + '].familyMembers[' + memberIndex + '].personId', member.personId, charIds);
    });
  });
  if (targetGM.harem && typeof targetGM.harem === 'object') {
    requireExisting('后宫.crownPrinceId', targetGM.harem.crownPrinceId, charIds);
  }
  (targetGM.facs || []).forEach(function(faction, index) {
    if (!faction) return;
    requireExisting('势力[' + index + '].leaderId', faction.leaderId, charIds);
    requireExisting('势力[' + index + '].coLeaderId', faction.coLeaderId, charIds);
    requireExisting('势力[' + index + '].heirId', faction.heirId, charIds);
    (Array.isArray(faction.memberIds) ? faction.memberIds : []).forEach(function(id, memberIndex) {
      requireExisting('势力[' + index + '].memberIds[' + memberIndex + ']', id, charIds);
    });
  });
  (targetGM.armies || []).forEach(function(army, index) {
    if (!army) return;
    requireExisting('军队[' + index + '].commanderId', army.commanderId, charIds);
    requireExisting('军队[' + index + '].factionId', army.factionId, factionIds);
  });
  var regions = targetGM.mapData && targetGM.mapData.regions;
  (Array.isArray(regions) ? regions : []).forEach(function(region, index) {
    if (!region) return;
    requireExisting('地图地区[' + index + '].factionId', region.factionId, factionIds);
    requireExisting('地图地区[' + index + '].governorId', region.governorId, charIds);
  });
  _tmCollectAdminDivisionEntries(targetGM).forEach(function(entry, index) {
    if (entry && entry.item) requireExisting('行政区划[' + index + '].governorId', entry.item.governorId, charIds);
  });
  (function walkOffices(nodes, path) {
    (Array.isArray(nodes) ? nodes : []).forEach(function(node, nodeIndex) {
      var nodePath = path + '[' + nodeIndex + ']';
      (Array.isArray(node && node.positions) ? node.positions : []).forEach(function(position, positionIndex) {
        if (!position) return;
        var positionPath = nodePath + '.positions[' + positionIndex + ']';
        requireExisting(positionPath + '.holderId', position.holderId, charIds);
        (Array.isArray(position.actualHolders) ? position.actualHolders : []).forEach(function(holder, holderIndex) {
          if (!holder || typeof holder !== 'object') return;
          requireExisting(positionPath + '.actualHolders[' + holderIndex + '].characterId', holder.characterId, charIds);
          requireExisting(positionPath + '.actualHolders[' + holderIndex + '].personId', holder.personId, charIds);
          requireExisting(positionPath + '.actualHolders[' + holderIndex + '].holderId', holder.holderId, charIds);
        });
      });
      var subs = Array.isArray(node && node.subs) ? node.subs : [];
      var children = Array.isArray(node && node.children) && node.children !== subs ? node.children : [];
      walkOffices(subs, nodePath + '.subs');
      walkOffices(children, nodePath + '.children');
    });
  })(targetGM.officeTree, 'officeTree');
}

function _tmValidateFiniteWorldNumbers(root, label) {
  var stack = [{ value: root, path: label }];
  var seen = typeof WeakSet === 'function' ? new WeakSet() : null;
  while (stack.length) {
    var current = stack.pop();
    var value = current.value;
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw new Error('存档数值非法: ' + current.path);
      continue;
    }
    if (!value || typeof value !== 'object') continue;
    if (seen) {
      if (seen.has(value)) continue;
      seen.add(value);
    }
    // Map/Set/Blob 等运行时派生容器不属于 JSON 世界正文；其内部由各自重建器负责。
    var keys = Object.keys(value);
    for (var i = 0; i < keys.length; i++) {
      stack.push({ value: value[keys[i]], path: current.path + '.' + keys[i] });
    }
  }
}

function _tmValidateLoadedWorld(targetP, targetGM) {
  if (!targetP || typeof targetP !== 'object' || Array.isArray(targetP)) throw new Error('存档 P 不是合法对象');
  if (!targetGM || typeof targetGM !== 'object' || Array.isArray(targetGM)) throw new Error('存档 GM 不是合法对象');
  var turn = Number(targetGM.turn);
  if (!Number.isSafeInteger(turn) || turn < 0) throw new Error('存档回合号非法');
  if (!String(targetGM._campaignId || '')) throw new Error('存档缺少 campaignId');
  if (!_tmEnsureTimelineIdentity(targetGM)) throw new Error('存档缺少 timelineId');
  [['chars', targetGM.chars], ['facs', targetGM.facs], ['armies', targetGM.armies], ['officeTree', targetGM.officeTree]].forEach(function(pair) {
    if (pair[1] != null && !Array.isArray(pair[1])) throw new Error('存档字段 ' + pair[0] + ' 必须为数组');
  });
  if (targetGM.mapData != null) {
    if (typeof targetGM.mapData !== 'object' || Array.isArray(targetGM.mapData)) throw new Error('运行地图结构非法');
    if (targetGM.mapData.regions != null && !Array.isArray(targetGM.mapData.regions)) throw new Error('运行地图地区必须为数组');
    if (targetP.map === targetGM.mapData || targetP.mapData === targetGM.mapData) throw new Error('运行地图与剧本模板仍共享引用');
  }
  if (targetGM._chronicleSysState != null && (typeof targetGM._chronicleSysState !== 'object' || Array.isArray(targetGM._chronicleSysState))) {
    throw new Error('编年状态结构非法');
  }
  _tmValidateUniqueStableIds('人物', targetGM.chars);
  _tmValidateUniqueStableIds('势力', targetGM.facs);
  _tmValidateUniqueStableIds('军队', targetGM.armies);
  _tmValidateUniqueStableIds('地图地区', targetGM.mapData && targetGM.mapData.regions);
  _tmValidateUniqueStableIds('行政区划', _tmCollectAdminDivisionEntries(targetGM).map(function(entry) { return entry.item; }));
  _tmValidateStableForeignKeys(targetGM);
  _tmValidateFiniteWorldNumbers(targetP, 'P');
  _tmValidateFiniteWorldNumbers(targetGM, 'GM');
  return true;
}

function _recoverPendingTurnDataPublish() {
  if (!(GM && window.tianming && typeof window.tianming.recoverTurnData === 'function')) return Promise.resolve({ ok: true, skipped: true });
  var targetGM = GM;
  var targetP = P;
  var targetLoadGen = (typeof window !== 'undefined' && window._tmLoadGen) || 0;
  var campaignId = String((GM && GM._campaignId) || '');
  var timelineId = String((GM && GM._timelineId) || '');
  function baseRecoveryLeaseCurrent() {
    return GM === targetGM && P === targetP &&
      (((typeof window !== 'undefined' && window._tmLoadGen) || 0) === targetLoadGen) &&
      String((GM && GM._campaignId) || '') === campaignId &&
      String((GM && GM._timelineId) || '') === timelineId;
  }

  return Promise.resolve().then(async function() {
    // v4 以前的存档把 marker 烘进两个大世界正文；仅在兼容迁移时做一次全量清理。
    if (targetGM._pendingTurnDataPublish) {
      var legacyMarker = deepClone(targetGM._pendingTurnDataPublish);
      function legacyLeaseCurrent() {
        return baseRecoveryLeaseCurrent() && !!targetGM._pendingTurnDataPublish &&
          targetGM._pendingTurnDataPublish.transactionId === legacyMarker.transactionId;
      }
      var legacyResult = await window.tianming.recoverTurnData(legacyMarker);
      if (!legacyLeaseCurrent()) return;
      if (!(legacyResult && legacyResult.success === true)) throw new Error(legacyResult && legacyResult.error || '旧回合分卷恢复失败');
      if (!(typeof TM_SaveDB !== 'undefined' && typeof TM_SaveDB.clearPendingTurnDataPublishAtomic === 'function')) {
        throw new Error('旧回合分卷 marker 迁移接口缺失');
      }
      var legacyCleared = await TM_SaveDB.clearPendingTurnDataPublishAtomic(['autosave', 'slot_0'], legacyMarker.transactionId, { writeGuard: legacyLeaseCurrent });
      if (legacyCleared !== true || !legacyLeaseCurrent()) throw new Error('旧回合分卷已恢复，但 canonical marker 清理失败');
      delete targetGM._pendingTurnDataPublish;
    }

    if (!baseRecoveryLeaseCurrent()) return;
    if (!(typeof TM_SaveDB !== 'undefined' && TM_SaveDB &&
      typeof TM_SaveDB.listTurnPublishReceipts === 'function' && typeof TM_SaveDB.deleteTurnPublishReceipt === 'function')) return;
    var receipts = await TM_SaveDB.listTurnPublishReceipts(campaignId, timelineId, 'world-committed');
    receipts = (receipts || []).slice().sort(function(a, b) {
      return Number(a && a.turn || 0) - Number(b && b.turn || 0) || Number(a && a.createdAt || 0) - Number(b && b.createdAt || 0);
    });
    for (var i = 0; i < receipts.length; i++) {
      if (!baseRecoveryLeaseCurrent()) return;
      var marker = receipts[i];
      if (!marker || String(marker.timelineId || '') !== timelineId || Number(marker.turn) > Number(targetGM.turn || 0)) continue;
      var result = await window.tianming.recoverTurnData(marker);
      if (!baseRecoveryLeaseCurrent()) return;
      if (!(result && result.success === true)) throw new Error(result && result.error || '回合分卷恢复失败');
      var deleted = await TM_SaveDB.deleteTurnPublishReceipt(marker, { writeGuard: baseRecoveryLeaseCurrent });
      if (deleted !== true || !baseRecoveryLeaseCurrent()) throw new Error('回合分卷已恢复，但 receipt 清理失败');
    }
    return { ok: true, recovered: receipts.length };
  }).catch(function(error) {
    if (GM !== targetGM) return;
    try { if (window.TM && TM.errors && TM.errors.capture) TM.errors.capture(error, 'fullLoadGame] recover turn-data'); } catch (_) {}
    try { if (typeof toast === 'function') toast('回合分卷恢复失败，正在恢复读档前世界；请排除磁盘问题后重试。'); } catch (_) {}
    return { ok: false, error: error };
  });
}

function _tmCaptureLoadTransaction() {
  var oldP = (typeof P !== 'undefined') ? P : null;
  var oldGM = (typeof GM !== 'undefined') ? GM : null;
  var presets = null;
  var backgroundJobs = [];
  try {
    presets = window.scriptData && window.scriptData.customPresets;
  } catch (_) {}
  try {
    if (typeof ChronicleSystem !== 'undefined' && ChronicleSystem && typeof ChronicleSystem.capturePendingWorldJobs === 'function') {
      backgroundJobs = ChronicleSystem.capturePendingWorldJobs(oldGM);
    }
  } catch (_) {}
  return {
    id: 'load-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12),
    P: oldP,
    GM: oldGM,
    gmBusy: oldGM && oldGM.busy,
    hydrationPending: oldGM && oldGM._loadHydrationPending,
    autoSaveSessionToken: (typeof _tmGetDesktopAutoSaveSessionToken === 'function') ? _tmGetDesktopAutoSaveSessionToken() : '',
    customPresets: presets,
    backgroundJobs: backgroundJobs
  };
}

function _tmRestoreLoadTransaction(txn) {
  if (!txn) throw new Error('读档回滚缺少事务快照');
  P = txn.P;
  GM = txn.GM;
  if (typeof window !== 'undefined') {
    window.P = P;
    window.GM = GM;
    // load generation 必须单调增加；倒退会让旧 AI/存储租约重新变成有效。
    window._tmLoadGen = Number(window._tmLoadGen || 0) + 1;
  }
  if (GM) {
    GM.busy = txn.gmBusy;
    if (txn.hydrationPending === undefined) delete GM._loadHydrationPending;
    else GM._loadHydrationPending = txn.hydrationPending;
  }
  if (typeof _tmInstallScenarioGetter === 'function') _tmInstallScenarioGetter();
  if (typeof ChronicleSystem !== 'undefined' && ChronicleSystem && typeof ChronicleSystem.deserialize === 'function') {
    ChronicleSystem.deserialize(GM && GM._chronicleSysState || null, GM);
  }
  if (typeof WarWeightSystem !== 'undefined' && WarWeightSystem && typeof WarWeightSystem.deserialize === 'function') {
    WarWeightSystem.deserialize(GM && GM._warTruces || null, GM);
  }
  if (GM && GM._rngState && typeof restoreRng === 'function') restoreRng(GM._rngState);
  if (typeof _tmRotateDesktopAutoSaveSession === 'function') {
    var rollbackSessionToken = txn.autoSaveSessionToken;
    if (!rollbackSessionToken && typeof _tmNewDesktopAutoSaveSessionToken === 'function') {
      rollbackSessionToken = _tmNewDesktopAutoSaveSessionToken();
    }
    if (rollbackSessionToken) _tmRotateDesktopAutoSaveSession('load-rollback', rollbackSessionToken);
  }
  try {
    if (window.scriptData) window.scriptData.customPresets = txn.customPresets;
  } catch (_) {}
  // 首屏尚无旧世界时，失败读档只能恢复到启动态；不要把“没有可重绑的世界”
  // 误判成回滚自身失败。已有世界则必须完整重绑所有 singleton/索引。
  if (P && GM) _tmRebindRuntimeWorld({ strict: true });
  try {
    if (window.TMPhase8FormalBridge && typeof window.TMPhase8FormalBridge.restoreDraftsFromGM === 'function') {
      window.TMPhase8FormalBridge.restoreDraftsFromGM(true);
    }
  } catch (_) {}
  if (GM && GM.running) {
    ['renderGameState', 'renderOfficeTree', 'renderBiannian', 'renderMemorials', 'renderJishi',
      'renderShijiList', 'renderGameTech', 'renderGameCivic', 'renderRenwu', 'renderSidePanels'].forEach(function(name) {
      try { if (typeof window[name] === 'function') window[name](); } catch (_) {}
    });
  }
  try {
    if (GM && P && txn.backgroundJobs && txn.backgroundJobs.length && typeof ChronicleSystem !== 'undefined' &&
      ChronicleSystem && typeof ChronicleSystem.rearmWorldJobs === 'function') {
      Promise.resolve(ChronicleSystem.rearmWorldJobs(GM, P, txn.backgroundJobs)).catch(function(error) {
        _tmCaptureLoadStepError(error, 'background rearm after rollback', true);
      });
    }
  } catch (rearmError) {
    _tmCaptureLoadStepError(rearmError, 'background rearm after rollback', true);
  }
  return true;
}

function fullLoadGame(data, loadOptions) {
  if (typeof window !== 'undefined' && window._tmActiveLoadTransaction) {
    return Promise.reject(new Error('已有读档正在完成，请稍候再切换存档'));
  }
  var promise = _fullLoadGameImpl(data, loadOptions);
  var barrier = promise.then(function() { return true; });
  barrier.catch(function() {}); // barrier 本身保持 rejected；这里只防止无人等待时产生 unhandled rejection。
  try {
    if (typeof window !== 'undefined') {
      window._tmLoadBarrier = barrier;
      promise.then(function() {
        if (window._tmLoadBarrier === barrier) window._tmLoadBarrier = Promise.resolve(true);
      }, function(error) {
        // 成功恢复旧世界后允许继续保存旧局；回滚失败则保留 rejected barrier，绝不把
        // 半载入世界伪装成 Promise.resolve(false) 后交给忽略返回值的调用方。
        if (window._tmLoadBarrier === barrier && error && error._tmLoadRollbackComplete === true) {
          window._tmLoadBarrier = Promise.resolve(true);
        }
      });
    }
  } catch (_) {}
  return promise;
}

async function _fullLoadGameImpl(data, loadOptions){
  var _loadTxn = _tmCaptureLoadTransaction();
  if (typeof window !== 'undefined') window._tmActiveLoadTransaction = _loadTxn;
  try {
    await _fullLoadGameApplyImpl(data, loadOptions, _loadTxn);
    if (typeof window !== 'undefined' && window._tmActiveLoadTransaction === _loadTxn) {
      window._tmActiveLoadTransaction = null;
    }
    try {
      if (typeof window !== 'undefined' && window._tmWorldRollbackActive && window._tmWorldRollbackActive.failed) {
        window._tmWorldRollbackActive = null;
      }
      if (typeof _tmCaptureCommittedWorldSnapshotFromLive === 'function') {
        _tmCaptureCommittedWorldSnapshotFromLive('load-complete');
      }
      if (typeof _tmFlushDeferredDesktopAutoSave === 'function') _tmFlushDeferredDesktopAutoSave('load-complete');
    } catch (snapshotError) {
      _tmCaptureLoadStepError(snapshotError, 'desktop autosave committed baseline after load', true);
    }
  } catch (error) {
    if (!error || (typeof error !== 'object' && typeof error !== 'function')) error = new Error(String(error));
    if (typeof window !== 'undefined' && window._tmActiveLoadTransaction === _loadTxn) {
      var _loadRollbackLease = { kind: 'load', transactionId: _loadTxn.id, startedAt: Date.now() };
      window._tmWorldRollbackActive = _loadRollbackLease;
      try {
        _tmRestoreLoadTransaction(_loadTxn);
        error._tmLoadRollbackComplete = true;
      } catch (rollbackError) {
        error._tmLoadRollbackError = rollbackError;
      }
      window._tmActiveLoadTransaction = null;
      if (error._tmLoadRollbackComplete === true) {
        if (window._tmWorldRollbackActive === _loadRollbackLease) window._tmWorldRollbackActive = null;
        if (typeof _tmRequestDeferredDesktopAutoSaveFlush === 'function') {
          _tmRequestDeferredDesktopAutoSaveFlush('load-rollback');
        }
      } else {
        window._tmWorldRollbackActive = {
          kind: 'load',
          transactionId: _loadTxn.id,
          failed: true,
          startedAt: _loadRollbackLease.startedAt
        };
      }
    }
    throw error;
  }
}

async function _fullLoadGameApplyImpl(data, loadOptions, _loadTxn){
  loadOptions = loadOptions || {};
  // 跨档保留 API 设置：localStorage 的 tm_api 是用户的"机器"配置·不应被存档覆盖
  var _preservedAi = null;
  try {
    var _stored = localStorage.getItem('tm_api');
    if (_stored) _preservedAi = JSON.parse(_stored);
  } catch(_) {}
  // 跨档保留机器级 AI 偏好(生成字数/推演深度/记忆容量等)·捕获当前内存中的玩家设置·读档后回填
  var _preservedConf = {};
  try {
    if (typeof P !== 'undefined' && P && P.conf) {
      PREF_CONF_KEYS.forEach(function(k) { if (P.conf[k] !== undefined) _preservedConf[k] = P.conf[k]; });
    }
  } catch(_) {}
  // 兼容两种存档格式：
  // 格式A (desktopDoSave/doSaveGame): data = P, data.gameState = GM
  // 格式B (SaveManager): data.gameState = {GM, P}
  var _incomingP, _incomingGM;
  if (data.gameState && data.gameState.GM && data.gameState.P) {
    // 格式B：SaveManager格式
    _incomingP = data.gameState.P;
    _incomingGM = data.gameState.GM;
  } else {
    // 格式A：标准格式
    _incomingP = Object.assign({}, data);
    _incomingGM = data.gameState;
  }
  if (!_incomingP || !_incomingGM) throw new Error('存档结构不完整：缺少 P/GM');
  if (_incomingP && _incomingP.gameState) delete _incomingP.gameState;
  _tmStripSaveTransportMetadata(_incomingP);
  _tmStripSaveTransportMetadata(_incomingGM);
  // 迁移和默认值先在尚未发布的 incoming 对象上完成；失败时 live P/GM 保持原局，
  // 且版本戳不会前移，下一次仍可安全重试。
  _ensurePDefaults(_incomingP, _incomingGM);
  _ensureGMDefaults(_incomingGM, _incomingP);
  P = _incomingP;
  GM = _incomingGM;
  if (P && P.gameState) delete P.gameState; // 格式A 外壳/旧嵌套僵尸一并斩；GM 已持引用
  if (GM) GM._isFreshNewGame = false;
  if (typeof _tmInstallScenarioGetter === 'function') _tmInstallScenarioGetter(); // P 整体重赋值后重装 P.scenario 派生 getter
  try { if (typeof window !== 'undefined') window._tmLoadGen = (window._tmLoadGen || 0) + 1; } catch (_lg) {} // 读档代际++·按GM.turn失效的模块级缓存(officeIndex/memCache)读同turn档曾泄漏旧局数据(2026-07-04 审查定罪)
  var _loadLeaseP = P;
  var _loadLeaseGM = GM;
  var _loadLeaseGen = (typeof window !== 'undefined') ? Number(window._tmLoadGen || 0) : 0;
  function _assertLoadLeaseCurrent() {
    var current = (typeof window === 'undefined') || (window._tmActiveLoadTransaction === _loadTxn
      && window.P === _loadLeaseP && window.GM === _loadLeaseGM && Number(window._tmLoadGen || 0) === _loadLeaseGen);
    if (!current) throw new Error('读档请求已被更新的世界切换取代');
  }
  // 同步通知主进程切换 canonical auto-save session。旧 IPC 即使正在 writeFile，rename 前也会因 token 失效被拒；
  // 从 canonical 自动档恢复时沿用其 token，普通案卷/残局读档则创建新 token。
  _tmRunCriticalLoadStep('auto-save session rotate', function() {
    if (typeof _tmRotateDesktopAutoSaveSession === 'function') {
      _tmRotateDesktopAutoSaveSession('full-load', loadOptions.autoSaveSessionToken || '');
    }
  });
  // 恢复被存档冲掉的 API 配置（key/url/model 等都从 localStorage 拉回）
  if (_preservedAi && typeof _preservedAi === 'object' && (_preservedAi.key || _preservedAi.url)) {
    if (!P.ai) P.ai = {};
    Object.keys(_preservedAi).forEach(function(k) {
      // 只回填存档里没有或为空的字段·让用户最近的配置永远生效
      if (_preservedAi[k] != null && _preservedAi[k] !== '') P.ai[k] = _preservedAi[k];
    });
  }
  // 回填机器级 AI 偏好·让玩家最近的设置永远生效·不被存档快照(可能是旧值/默认)覆盖
  try {
    if (!P.conf) P.conf = {};
    Object.keys(_preservedConf).forEach(function(k) { P.conf[k] = _preservedConf[k]; });
  } catch(_) {}

  if(GM){
    GM.running=true;
    // 旧档可能没有或带着陈旧 GM.year/month/day；读档后按 turn + P.time 重新派生。
    _tmRunCriticalLoadStep('calendar sync', function() {
      if (typeof _tmSyncGMCalendar === 'function') _tmSyncGMCalendar(GM, GM.turn || 1);
    });
    // 必需 hydration/receipt 恢复完成前保持 busy，旧界面残留按钮也不能提前过回合。
    GM.busy = true;
    GM._loadHydrationPending = true;
    GM._endTurnBusy = false;
    if(GM._rngState && typeof restoreRng === 'function') restoreRng(GM._rngState);
    // 兼容旧存档：旧版本将ChronicleSystem序列化数据错误地写入GM._chronicle（覆盖了原本的数组）——检测并迁移
    if (GM._chronicle && !Array.isArray(GM._chronicle) && typeof GM._chronicle === 'object'
        && (GM._chronicle.monthDrafts || GM._chronicle.yearChronicles)) {
      if (!GM._chronicleSysState) GM._chronicleSysState = GM._chronicle;
      GM._chronicle = [];
    }
    // 每次读档都绑定（包括没有旧字段的空档），避免沿用上一战役的进程级单例残留。
    if(typeof ChronicleSystem !== 'undefined') {
      ChronicleSystem.deserialize(GM._chronicleSysState || null, GM);
    }
    if(typeof WarWeightSystem !== 'undefined') WarWeightSystem.deserialize(GM._warTruces || null, GM);

    // 恢复所有_saved*字段
    _restoreSavedFields();
    // Stage 2·L1·KejuParadigm migrate·旧存档自动 init paradigm·version-aware
    _tmRunCriticalLoadStep('kjpMigrate', function() {
      if (typeof _kjpMigrate === 'function') _kjpMigrate();
    });
    _tmRunCriticalLoadStep('phase8 formal drafts', function() {
      if (window.TMPhase8FormalBridge && typeof window.TMPhase8FormalBridge.restoreDraftsFromGM === 'function') {
        window.TMPhase8FormalBridge.restoreDraftsFromGM(true);
      } else if (typeof window.restorePhase8FormalDraftsFromGM === 'function') {
        window.restorePhase8FormalDraftsFromGM(true);
      }
    });
    // 部分旧迁移读取 GM.mapData；先走统一纯重绑定入口中的 map-only 阶段。
    _tmRebindRuntimeWorld({ strict: true, integration: false, indices: false, faction: false, memory: false });

    // 一次性清理·扫除存档里历史误抓人物(强烈/连日/乌纱/平静等命中 NAME_BLACKLIST 词组)
    _tmRunCriticalLoadStep('blacklisted character purge', function() {
      if (typeof purgeBlacklistedCharacters === 'function') {
        var _purged = purgeBlacklistedCharacters();
        if (_purged && (_purged.chars.length || _purged.pending.length)) {
          if (typeof addEB === 'function') addEB('清理', '清扫历史误抓人物·chars: ' + _purged.chars.length + '·pending: ' + _purged.pending.length);
        }
      }
    });

    // 迁移官制树到双层模型
    if (typeof _offMigrateTree === 'function' && GM.officeTree) _offMigrateTree(GM.officeTree);
    // 单一真相源:读档时去重人物+从树回填officialTitle+派生任职者(治双源漂移/布衣/重复人物)
    _tmRunCriticalLoadStep('office holder synchronization', function() {
      if (typeof _offSyncHoldersFromChars === 'function') _offSyncHoldersFromChars({ importSeats: true, dedupChars: true, force: true });
    });
    // 官制officialTitle同步——确保ch.officialTitle与GM.officeTree一致
    if (GM.officeTree && GM.chars) {
      (function _syncTitles(nodes) {
        nodes.forEach(function(n) {
          (n.positions||[]).forEach(function(p) {
            var _names = [];
            if (typeof _offAllHolders === 'function') {
              _names = _tmRunCriticalLoadStep('office holder enumeration', function() { return _offAllHolders(p) || []; });
            }
            if (!_names.length && p.holder) _names = [p.holder];
            _names.forEach(function(_nm, _idx) {
              var _sch = GM.chars.find(function(c){ return c.name === _nm; });
              if (!_sch) return;
              if (typeof _offAddCharOfficeTitle === 'function') _offAddCharOfficeTitle(_sch, p.name, { concurrent: _idx > 0 || !!_sch.officialTitle });
              else if (!_sch.officialTitle) _sch.officialTitle = p.name;
            });
          });
          if (n.subs) _syncTitles(n.subs);
        });
      })(GM.officeTree);
    }
    // 确保所有字段有默认值
    _ensureGMDefaults();
    _ensurePDefaults();
    _tmRunCriticalLoadStep('army structure migration', function() {
      if (typeof TMArmyUnits !== 'undefined') TMArmyUnits.ensureAllArmies(GM);
    });   // 御驾亲征接入 Phase0:army.composition→units[] 编制地基(载入一次性·幂等·不改 composition)
    _tmRunDegradableLoadStep('core metric labels', function() {
      if (typeof buildCoreMetricLabels === 'function') buildCoreMetricLabels();
    });

    // 角色完整字段补齐（兼容旧存档/手工导入的 JSON）
    _tmRunCriticalLoadStep('character schema migration', function() {
      if (typeof CharFullSchema !== 'undefined' && typeof CharFullSchema.ensureAll === 'function') {
        CharFullSchema.ensureAll(GM.chars);
      }
    });

    _tmRunCriticalLoadStep('engine migration', function() {
      if (typeof EngineMigration !== 'undefined' && typeof EngineMigration.run === 'function') {
        EngineMigration.run(GM);
      }
    });

    _tmRunCriticalLoadStep('relationship reference migration', function() {
      if (typeof RelGraph !== 'undefined' && typeof RelGraph.syncCharRefs === 'function' && Array.isArray(GM.chars)) {
        GM.chars.forEach(function(ch) {
          RelGraph.syncCharRefs(ch, GM);
        });
      }
    });

    // 影子条目存量清障(2026-07-04)：历史版本 AI 落建造在 BUILDING_TYPES 反查失败时铸的「未知建筑」
    // 死条目(无描述/无 status/无效果)随档累积·且按 territory|type 键位把营造志真记录挤出合并清单
    // (地块面板全显「未知建筑·完好」病根之一)。读档一次性清·随后 buildIndices 重建索引保持一致。
    _tmRunCriticalLoadStep('shadow building purge', function() {
      if (Array.isArray(GM.buildings) && typeof BUILDING_TYPES !== 'undefined') {
        var _shadowN = GM.buildings.length;
        GM.buildings = GM.buildings.filter(function(b){ return b && !(b.name === '未知建筑' && !BUILDING_TYPES[b.type]); });   // arch-ok:读档迁移·影子死账一次性清障(非游戏内业务直写)
        _shadowN -= GM.buildings.length;
        if (_shadowN > 0) console.log('[fullLoadGame] 清除「未知建筑」影子条目 ' + _shadowN + ' 条(历史AI落建造反查失败所铸)');
      }
    });
    // P6.3 修：老存档加载后·若 _memTables 缺失或仅有空 schema·自动反向重建以保留历史
    _tmRunCriticalLoadStep('memory tables migration', function() {
      if (window.MemTables && MemTables.ensureInit) {
        MemTables.ensureInit();
        var _eh = MemTables.getSheet('eventHistory');
        var _curS = MemTables.getSheet('curStatus');
        // 判断是否需要重建：(a) 完全无表 (b) 表存在但回合 > 1 而事件历史为空
        var _needRebuild = !GM._memTables ||
                           (GM.turn > 1 && _eh && _eh.rows.length === 0 && Array.isArray(GM.evtLog) && GM.evtLog.length > 0);
        if (_needRebuild && MemTables.rebuildFromHistory) {
          var _rb = MemTables.rebuildFromHistory({ clear: true });
          if (_rb.ok && _rb.totalRows > 0) {
            console.log('[fullLoadGame] 12 表自动反向重建：当前局势 ' + _rb.stats.curStatus + ' 行·事件历史 ' + _rb.stats.eventHistory + ' 行·大事记 ' + _rb.stats.majorEventsBrief + ' 行');
            if (typeof toast === 'function') toast('记忆表已从历史反向重建·' + _rb.totalRows + ' 行');
          }
        }
      }
    });

    _tmRunCriticalLoadStep('memory turn backfill', function() {
      if (window.TM && TM.MemoryTurnBackfill && typeof TM.MemoryTurnBackfill.ensureBackfilled === 'function') {
        var _memSpine = TM.MemoryTurnBackfill.ensureBackfilled(GM, { turn: GM.turn, archiveCap: 80 });
        if (_memSpine && (_memSpine.rebuilt || _memSpine.reason === 'rollup_rebuilt_from_existing_archive')) {
          console.log('[fullLoadGame] memory spine backfill: ' + (_memSpine.legacyBundles || 0) + ' bundles');
        }
      }
    });

    // ── 管辖层级/封建字段迁移（老存档兼容）──
    if (GM.facs && GM.facs.length > 0) {
      GM.facs.forEach(function(f) {
        if (!f) return;
        if (f.liege) {
          if (!f.relationType) f.relationType = 'vassal';          // 默认封臣
          if (f.loyaltyToLiege === undefined) f.loyaltyToLiege = 60;
          if (f.rebellionRisk === undefined) f.rebellionRisk = 20;
        }
      });
    }
    // 派生所有区划 autonomy（首次载入/老存档）
    if (typeof applyAutonomyToAllDivisions === 'function') {
      _tmRunCriticalLoadStep('division autonomy migration', function() { applyAutonomyToAllDivisions(); });
    }
    // 自动分配后妃居所
    if (typeof autoAssignHaremResidences === 'function') {
      _tmRunCriticalLoadStep('harem residence migration', function() { autoAssignHaremResidences(); });
    }
    // 载入存档后：若 GM.adminHierarchy 缺失/为空（老存档），从剧本或 P 恢复
    _tmRunCriticalLoadStep('admin hierarchy migration', function() {
      var _ahEmpty = !GM.adminHierarchy ||
                     typeof GM.adminHierarchy !== 'object' ||
                     Object.keys(GM.adminHierarchy).length === 0;
      if (_ahEmpty) {
        var _scAh = (typeof findScenarioById === 'function' && GM.sid) ? findScenarioById(GM.sid) : null;
        if (_scAh && _scAh.adminHierarchy) {
          GM.adminHierarchy = deepClone(_scAh.adminHierarchy);
          console.log('[fullLoadGame] GM.adminHierarchy 从 scenario 恢复·keys=' + Object.keys(GM.adminHierarchy).join(','));
        } else if (P.adminHierarchy) {
          GM.adminHierarchy = deepClone(P.adminHierarchy);
          console.log('[fullLoadGame] GM.adminHierarchy 从 P 恢复·keys=' + Object.keys(GM.adminHierarchy).join(','));
        }
      }
    });

    // 老存档兼容：GM.fiscal.{royalClanPressure,huangzhuangIncome,imperialBusinesses} 缺失时从 P.fiscalConfig.neicangRules 镜像
    // tm-fiscal-fixed-expense.js:_calcRoyalStipend 等读 G.fiscal.royalClanPressure·缺则宗禄岁出 = 0
    // Old-save compatibility: mirror explicit scenario constants/groups into GM and P.
    _tmRunCriticalLoadStep('engine constants migration', function() {
      var _scEC = (typeof findScenarioById === 'function' && GM.sid) ? findScenarioById(GM.sid) : null;
      if (_scEC) {
        if (!GM.engineConstants && _scEC.engineConstants) {
          GM.engineConstants = deepClone(_scEC.engineConstants);
          console.log('[fullLoadGame] GM.engineConstants restored from scenario');
        }
        if ((!Array.isArray(GM.influenceGroups) || GM.influenceGroups.length === 0) && Array.isArray(_scEC.influenceGroups)) {
          GM.influenceGroups = deepClone(_scEC.influenceGroups);
          console.log('[fullLoadGame] GM.influenceGroups restored from scenario');
        }
        if (P && typeof P === 'object') {
          if (!P.engineConstants && _scEC.engineConstants) P.engineConstants = deepClone(_scEC.engineConstants);
          if ((!Array.isArray(P.influenceGroups) || P.influenceGroups.length === 0) && Array.isArray(_scEC.influenceGroups)) {
            P.influenceGroups = deepClone(_scEC.influenceGroups);
          }
        }
      }
    });

    _tmRunCriticalLoadStep('fiscal configuration migration', function() {
      var _scFC = (typeof findScenarioById === 'function' && GM.sid) ? findScenarioById(GM.sid) : null;
      var _fcSrc = (P.fiscalConfig && P.fiscalConfig.neicangRules)
                || (_scFC && _scFC.fiscalConfig && _scFC.fiscalConfig.neicangRules);
      if (_fcSrc) {
        GM.fiscal = GM.fiscal || {};
        if (_fcSrc.royalClanPressure && !GM.fiscal.royalClanPressure) GM.fiscal.royalClanPressure = deepClone(_fcSrc.royalClanPressure);
        if (_fcSrc.huangzhuangIncome && !GM.fiscal.huangzhuangIncome) GM.fiscal.huangzhuangIncome = deepClone(_fcSrc.huangzhuangIncome);
        if (_fcSrc.imperialBusinesses && !GM.fiscal.imperialBusinesses) GM.fiscal.imperialBusinesses = deepClone(_fcSrc.imperialBusinesses);
      }
    });

    // 全部 schema 迁移完成后，用成功/回滚共享的纯入口重建代理和派生索引。
    _tmRebindRuntimeWorld({ strict: true, map: false });

    // 同步剧本自定义预设（HistoricalPresets 动态 getter 读取 window.scriptData.customPresets）
    _tmRunCriticalLoadStep('custom presets synchronization', function() {
      if (P && P.customPresets) {
        if (!window.scriptData) window.scriptData = {};
        window.scriptData.customPresets = P.customPresets;
      }
    });

    _tmRunCriticalLoadStep('loaded world validation', function() { return _tmValidateLoadedWorld(P, GM); });

    // 读档完成屏障：先合并当前父时间线的有效辅助记录和可恢复分卷，再开放任何玩法操作。
    if (typeof ChronicleSystem !== 'undefined' && typeof ChronicleSystem.hydrateDurableRecords === 'function') {
      await ChronicleSystem.hydrateDurableRecords(GM, P);
      _assertLoadLeaseCurrent();
    }
    var _turnDataRecovery = await _recoverPendingTurnDataPublish();
    if (_turnDataRecovery && _turnDataRecovery.ok === false) {
      throw (_turnDataRecovery.error || new Error('回合分卷恢复失败'));
    }
    _assertLoadLeaseCurrent();
    // 每次从快照继续都建立子时间线；失败回滚可显式 preserveTimeline 复原原身份。
    if (!loadOptions.preserveTimeline) _tmForkLoadedTimeline(GM, loadOptions.source || 'load');
    if (typeof StateSnapshot !== 'undefined' && StateSnapshot && typeof StateSnapshot.recordTimeline === 'function') {
      await _tmRunDegradableLoadStepAsync('timeline lineage persistence', function() {
        return StateSnapshot.recordTimeline(GM);
      });
      _assertLoadLeaseCurrent();
    }
    GM._loadHydrationPending = false;
    GM.busy = false;

    // hydration 完成前保持加载遮罩与旧界面隔离；此处才真正开放新世界 UI。
    _$("launch").style.display="none";
    _$("bar").style.display="flex";
    _$("bar-btns").innerHTML="";
    _$("G").style.display="grid";
    _$("E").style.display="none";
    _$("shiji-btn").classList.add("show");
    _$("save-btn").classList.add("show");

    enterGame();
    renderGameState();
    renderOfficeTree();
    renderBiannian();
    renderMemorials();
    renderJishi();
    if(typeof renderShijiList==="function")renderShijiList();
    if(typeof renderGameTech==="function")renderGameTech();
    if(typeof renderGameCivic==="function")renderGameCivic();
    if(typeof renderRenwu==="function")renderRenwu();
    if(typeof renderSidePanels==="function")renderSidePanels();

    toast("\u2705 \u5DF2\u52A0\u8F7D: T"+GM.turn+" "+getTSText(GM.turn));
  }else{
    loadT();
    toast("\u9879\u76EE\u5DF2\u52A0\u8F7D\uFF0C\u8BF7\u9009\u62E9\u5267\u672C");
    _$("launch").style.display="none";
    showScnManage();
  }
}

// 3. 文件读取（保留Electron桌面端支持）
importSaveFile=function(){
  // Electron桌面端：使用原生文件对话框
  if(_tmHasNativeFs()&&window.tianming&&window.tianming.dialogImport){
    window.tianming.dialogImport().then(async function(res){
      if(!res||res.canceled||!res.success)return;
      try{ await fullLoadGame(res.data, { source: 'desktop-import' }); }catch(err){ toast('\u5931\u8D25: '+err.message); }
    }).catch(function(){ toast('\u5931\u8D25'); });
    return;
  }
  // 浏览器端：文件选择器
  var inp=document.createElement("input");inp.type="file";inp.accept=".json";
  inp.onchange=function(e){
    var f=e.target.files[0];if(!f)return;
    showLoading("\u8BFB\u53D6\u6587\u4EF6...",30);
    var reader=new FileReader();
    reader.onload=async function(ev){
      try{
        showLoading("\u89E3\u6790\u6570\u636E...",60);
        var data=JSON.parse(ev.target.result);
        showLoading("\u6062\u590D\u72B6\u6001...",90);
        await fullLoadGame(data, { source: 'file-import' });
        hideLoading();
      }catch(err){hideLoading();toast("\u5931\u8D25: "+err.message);}
    };
    reader.readAsText(f);
  };
  inp.click();
};

// 4. Electron读取（覆盖旧版）——统一使用卷宗UI
if(_tmHasNativeFs()){
  doLoadSave=function(){
    if(typeof openSaveManager==='function'){openSaveManager();return;}
    // 降级：旧版文件列表
    (async function(){var list=await window.tianming.listSaves();
    var files=list.success?list.files.filter(function(f){return f.name!=="__autosave__";}):[];
    files.sort(function(a,b){return (b.modified||0)-(a.modified||0);});
    _tmShowDesktopLoadFallback(files);
  })();};

  window.desktopLoadSave=async function(name){
    showLoading("\u8BFB\u53D6\u5B58\u6863...",30);
    try{
      var r=await window.tianming.loadProject(name);
      if(r.success&&r.data){
        showLoading("\u6062\u590D...",70);
        try { await fullLoadGame(r.data, { source: 'desktop-save' }); }
        catch (_lpE) { console.error('[loadProject] 恢复失败', _lpE); toast('恢复失败: ' + (_lpE.message||_lpE)); }
        finally { hideLoading(); }
      }else{hideLoading();toast("\u52A0\u8F7D\u5931\u8D25");}
    }catch(e){hideLoading();toast("\u5931\u8D25: "+e.message);}
  };

  window.desktopDeleteSave=async function(ref){
    var displayName=(ref&&typeof ref==='object')?ref.name:ref;
    if(!confirm("\u786E\u8BA4\u5220\u9664\u5B58\u6863\u300C"+displayName+"\u300D\uFF1F"))return;
    var r=await window.tianming.deleteSave(ref);
    if(r.success){toast("\u5DF2\u5220\u9664");doLoadSave();}
    else toast("\u5220\u9664\u5931\u8D25: "+(r.error||""));
  };
}

// 6. 自动存档（Electron）·2026-05-22 C2+C3 fix·2026-05-23 A-1 fix·
// C2·加 _autoSaveInFlight 锁防 60s 重入互踩 (await 过程中 setInterval 可能再触发)
// C3·tm_P_lite 不必每 60s 写·改成每 5 次 (即 5 分钟) 写一次·节约 100-500ms × 4 次
// A-1·选择性 clone·deepClone(GM) 全量 500-2000ms 主线程同步·拆 mutable / append-only
//   · mutable 必拷·chars/facs/armies/eraState/vars/parties/turnChanges/_indices 等
//   · append-only 引用·qijuHistory/jishiRecords/shijiHistory/evtLog/biannianItems/officeChanges/eraStateHistory
//   · skip·_aiTelemetry 类 debug snapshot (崩溃恢复不需)·_subcallTimings·_aiDispatchStats.errorLog
//   预期·1500ms → 400-600ms·砍 60-70%·user 报"问对打字卡 3 秒"对应这条
// C (2026-05-23)·叠在 A-1 之上·5s 内有用户输入则 defer 整个 60s tick·避开打字 / 点击窗口
//   兜底·距上次成功保存超 3 分钟·强制保存 (避免连续打字 5 分钟没存档)
var _autoSaveInFlight=false;
var _autoSaveInFlightPromise=null;
var _autoSaveSkipCount=0;
var _autoSaveLiteTick=0;
var _autoSaveLastInputMs=0;   // C·最后一次用户输入时间
var _autoSaveLastDoneMs=0;     // C·最后一次 autoSave 成功时间
var _autoSaveDeferStreak=0;    // C·连续 defer 次数·用于日志
// D (2026-05-28)·闲置跳存·防 renderer OOM
// 闲置时 defer 永不触发 (无输入→_sinceInput 恒>5000)·autoSave 反而每 60s 满血跑一次 (比活跃游玩 3 分钟一次频繁 3 倍)·
// 每次全量 deepClone(P)+_autoSaveSnapshotGM()(~1s·数百 MB 瞬时分配)+IPC structuredClone·
// 闲置 10 分钟累积 ~10 次峰值→堆耗尽→Render process gone 黑屏。
// 而闲置时 GM 完全冻结·这些存档是把盘上同一份数据反复重写·纯浪费。
// 故:真闲置 (自上次成功存档以来无输入 且 turn 未变) 时跳过·盘上副本已是最新。
var _autoSaveLastSavedTurn=-1; // D·上次成功存档时的 GM.turn
var _autoSaveIdleSkipStreak=0; // D·连续闲置跳过次数·用于日志
var _autoSaveDeferred=false;
var _autoSaveFlushTimer=null;
// 桌面 60s 自动档只能消费这一份已脱离 live GM/P 的稳定快照。
// 它由新局/读档完成、pre_endturn 提交或 canonical 双槽提交这些明确边界更新；
// timer 本身绝不从正在变化的世界临时抓取一份“看起来完整”的状态。
var lastCommittedSnapshot=null;
var lastCommittedTurn=-1;
var lastCommittedTransactionId='';
var _lastCommittedSnapshotIdentity=null;
// Background AI summaries are deliberately outside the critical end-turn path.  Once they
// mutate the still-current world they request one coalesced canonical save here instead of
// calling a storage primitive from independent promise callbacks.
var _backgroundSavePending=null;
var _backgroundSaveInFlight=null;
var _backgroundSaveTimer=null;
var _backgroundSaveSequence=0;
var _BACKGROUND_SAVE_MAX_ATTEMPTS=2;

function _tmReportDesktopAutoSaveBoundaryError(error, label){
  var normalized = (error && (typeof error === 'object' || typeof error === 'function')) ? error : new Error(String(error));
  var reported = false;
  try {
    if (typeof window !== 'undefined' && window.TM && TM.errors) {
      if (typeof TM.errors.captureSilent === 'function') {
        TM.errors.captureSilent(normalized, String(label || 'desktop autosave boundary'));
        reported = true;
      } else if (typeof TM.errors.capture === 'function') {
        TM.errors.capture(normalized, String(label || 'desktop autosave boundary'));
        reported = true;
      }
    }
  } catch (captureError) {
    if (typeof console !== 'undefined' && console.warn) console.warn('[autoSave] diagnostic reporter failed:', captureError);
  }
  if (!reported && typeof console !== 'undefined' && console.warn) {
    console.warn('[autoSave] ' + String(label || 'desktop autosave boundary') + ':', normalized);
  }
  return normalized;
}

function _tmDesktopAutoSaveResultOk(result){
  return result === true || !!(result && result.success === true);
}
function _tmDesktopAutoSaveFailure(result){
  return new Error('桌面自动存档未落盘' + (result && result.error ? '：' + result.error : ''));
}

function isWorldTransactionActive(){
  var liveGM = (typeof GM !== 'undefined') ? GM : null;
  var root = (typeof window !== 'undefined') ? window : null;
  return !!(
    (liveGM && (liveGM.busy || liveGM._endTurnBusy || liveGM._endTurnCommitPending || liveGM._loadHydrationPending)) ||
    (root && (root._tmActiveLoadTransaction || root._tmWorldRollbackActive || root._tmActiveTimeTravelTransaction)) ||
    (typeof endTurn !== 'undefined' && endTurn && endTurn._preSubmitInFlight)
  );
}

function _tmBackgroundSaveLeaseCurrent(request){
  if (!request || !request.lease) return false;
  if (typeof _tmWorldLeaseCurrent === 'function') return _tmWorldLeaseCurrent(request.lease);
  var lease=request.lease;
  return typeof GM !== 'undefined' && typeof P !== 'undefined'
    && GM===lease.gmRef && P===lease.pRef
    && String((GM&&GM._campaignId)||'')===String(lease.campaignId||'')
    && String((GM&&GM.sid)||'')===String(lease.sid||'')
    && Number((GM&&GM.turn)||0)===Number(lease.turn||0)
    && (((typeof window!=='undefined'&&window._tmLoadGen)||0)===Number(lease.loadGen||0));
}

function _tmBackgroundSaveLeaseSame(a,b){
  return !!(a&&b)
    && a.gmRef===b.gmRef && a.pRef===b.pRef
    && String(a.campaignId||'')===String(b.campaignId||'')
    && String(a.sid||'')===String(b.sid||'')
    && Number(a.turn||0)===Number(b.turn||0)
    && Number(a.loadGen||0)===Number(b.loadGen||0);
}

function _tmBackgroundSaveMeta(request){
  var scenario=null;
  try {
    scenario=typeof findScenarioById==='function'?findScenarioById(GM.sid):null;
  } catch (error) {
    if (typeof console!=='undefined'&&console.warn) console.warn('[background-save] scenario metadata lookup failed',error);
  }
  return {
    name:'自动封存·'+(typeof getTSText==='function'?getTSText(GM.turn):'T'+GM.turn),
    type:'auto',
    turn:Number(GM.turn),
    scenarioName:scenario?String(scenario.name||''):'',
    eraName:String(GM.eraName||''),
    backgroundReasons:Array.from(request.reasons).slice(0,8)
  };
}

function _tmReportBackgroundSaveFailure(error, request){
  var normalized=_tmReportDesktopAutoSaveBoundaryError(error,'background canonical save · '+Array.from(request.reasons).join(','));
  try {
    if (!Array.isArray(GM._backgroundSaveFailures)) GM._backgroundSaveFailures=[];
    GM._backgroundSaveFailures.push({
      turn:Number(GM.turn)||0,
      reasons:Array.from(request.reasons).slice(0,8),
      attempts:Number(request.attempts)||0,
      message:String(normalized&&normalized.message||normalized).slice(0,500),
      at:Date.now()
    });
    if (GM._backgroundSaveFailures.length>20) GM._backgroundSaveFailures=GM._backgroundSaveFailures.slice(-20);
  } catch (diagnosticError) {
    if (typeof console!=='undefined'&&console.warn) console.warn('[background-save] failure diagnostic could not be persisted',diagnosticError);
  }
  return normalized;
}

async function _tmCommitBackgroundWorld(request){
  if (!_tmBackgroundSaveLeaseCurrent(request)) return {ok:false,stale:true,reason:'world-lease-stale'};
  if (isWorldTransactionActive()) return {ok:false,deferred:true,reason:'world-transaction-active'};
  if (!(typeof TM_SaveDB!=='undefined'&&TM_SaveDB&&typeof TM_SaveDB.saveManyAtomic==='function')) {
    throw new Error('background canonical save unavailable');
  }
  var writeGuard=function(){
    return _tmBackgroundSaveLeaseCurrent(request)&&!isWorldTransactionActive();
  };
  var state=_buildSaveState({format:'idb',detach:true,gm:request.lease.gmRef,p:request.lease.pRef});
  if (!state||!state.GM||!state.P) throw new Error('background canonical state build failed');
  if (!writeGuard()) return {ok:false,stale:true,reason:'world-changed-during-build'};
  var transactionId='background:'+String(state.GM._campaignId||'')+':'+String(state.GM._timelineId||'')+':'+String(state.GM.turn||0)+':'+String(++_backgroundSaveSequence);
  var identity={
    campaignId:String(state.GM._campaignId||''),
    timelineId:String(state.GM._timelineId||''),
    turn:Number(state.GM.turn)||0,
    transactionId:transactionId,
    schemaVersion:1
  };
  var payload=typeof TM_SaveDB.createCanonicalPayload==='function'
    ?await TM_SaveDB.createCanonicalPayload(state,identity)
    :null;
  if (!writeGuard()) return {ok:false,stale:true,reason:'world-changed-before-write'};
  var meta=_tmBackgroundSaveMeta(request);
  var saved=await TM_SaveDB.saveManyAtomic([
    {id:'autosave',gameState:state,canonicalPayload:payload,meta:meta},
    {id:'slot_0',gameState:state,canonicalPayload:payload,meta:meta}
  ],{transactionId:transactionId,writeGuard:writeGuard});
  if (saved!==true) throw new Error('background canonical slots were not committed atomically');
  if (!writeGuard()) return {ok:false,stale:true,reason:'world-changed-after-write'};
  if (!_tmAdoptCommittedWorldSnapshot(state,{turn:state.GM.turn,transactionId:transactionId,takeOwnership:true})) {
    throw new Error('background committed snapshot adoption failed');
  }
  _autoSaveDeferred=true;
  _tmRequestDeferredDesktopAutoSaveFlush('background-canonical-save');
  return {ok:true,turn:Number(state.GM.turn)||0,transactionId:transactionId,reasons:Array.from(request.reasons)};
}

function _tmScheduleBackgroundSave(delay){
  if (_backgroundSaveTimer||_backgroundSaveInFlight) return;
  _backgroundSaveTimer=setTimeout(function(){
    _backgroundSaveTimer=null;
    _tmDrainBackgroundAutosaves().catch(function(error){
      if (_backgroundSavePending) _tmReportBackgroundSaveFailure(error,_backgroundSavePending);
    });
  },Math.max(0,Number(delay)||0));
}

async function _tmDrainBackgroundAutosaves(){
  if (_backgroundSaveInFlight) return _backgroundSaveInFlight;
  if (!_backgroundSavePending) return {ok:false,skipped:true,reason:'no-background-save'};
  var request=_backgroundSavePending;
  _backgroundSavePending=null;
  _backgroundSaveInFlight=(async function(){
    if (!_tmBackgroundSaveLeaseCurrent(request)) return {ok:false,stale:true,reason:'world-lease-stale'};
    if (isWorldTransactionActive()) {
      _backgroundSavePending=request;
      _tmScheduleBackgroundSave(50);
      return {ok:false,deferred:true,reason:'world-transaction-active'};
    }
    request.attempts++;
    try {
      return await _tmCommitBackgroundWorld(request);
    } catch (error) {
      if (_tmBackgroundSaveLeaseCurrent(request)&&request.attempts<_BACKGROUND_SAVE_MAX_ATTEMPTS) {
        _backgroundSavePending=request;
        _tmScheduleBackgroundSave(100);
      } else {
        _tmReportBackgroundSaveFailure(error,request);
      }
      return {ok:false,error:error,attempts:request.attempts};
    }
  })();
  try { return await _backgroundSaveInFlight; }
  finally {
    _backgroundSaveInFlight=null;
    if (_backgroundSavePending) _tmScheduleBackgroundSave(0);
  }
}

function requestBackgroundAutosave(options){
  options=options||{};
  var lease=options.expectedWorldLease;
  if (!lease&&typeof _tmCaptureWorldLease==='function') lease=_tmCaptureWorldLease();
  if (!lease) return Promise.resolve({ok:false,skipped:true,reason:'world-lease-unavailable'});
  if (options.expectedTurn!==undefined&&options.expectedTurn!==null
    && Number(options.expectedTurn)!==Number(lease.turn)) {
    return Promise.resolve({ok:false,stale:true,reason:'background-turn-mismatch'});
  }
  var request={
    lease:lease,
    reasons:new Set([String(options.reason||'background-state-change')]),
    attempts:0,
    requestedAt:Date.now()
  };
  if (!_tmBackgroundSaveLeaseCurrent(request)) return Promise.resolve({ok:false,stale:true,reason:'world-lease-stale'});
  if (_backgroundSavePending&&_tmBackgroundSaveLeaseSame(_backgroundSavePending.lease,lease)) {
    request.reasons.forEach(function(reason){_backgroundSavePending.reasons.add(reason);});
  } else if (!_backgroundSavePending) {
    _backgroundSavePending=request;
  } else {
    // A pending request for an obsolete world must never be retargeted to the live world.
    if (!_tmBackgroundSaveLeaseCurrent(_backgroundSavePending)) _backgroundSavePending=request;
    else return Promise.resolve({ok:false,skipped:true,reason:'different-world-save-pending'});
  }
  _tmScheduleBackgroundSave(options.immediate===true?0:25);
  return Promise.resolve({ok:true,scheduled:true,reasons:Array.from(_backgroundSavePending.reasons)});
}

async function _tmAwaitBackgroundAutosaves(){
  if (_backgroundSaveTimer) {
    clearTimeout(_backgroundSaveTimer);
    _backgroundSaveTimer=null;
  }
  var result={ok:false,skipped:true,reason:'no-background-save'};
  var drains=0;
  while (_backgroundSavePending||_backgroundSaveInFlight) {
    if (_backgroundSaveTimer) {
      clearTimeout(_backgroundSaveTimer);
      _backgroundSaveTimer=null;
    }
    result=_backgroundSaveInFlight
      ? await _backgroundSaveInFlight
      : await _tmDrainBackgroundAutosaves();
    drains++;
    // A world transaction cannot be waited out from a close handshake. Keep the
    // request pending and let the main process cancel this close attempt.
    if (result&&result.deferred) return result;
    if (drains>_BACKGROUND_SAVE_MAX_ATTEMPTS+1) {
      return {ok:false,error:new Error('background save drain exceeded retry limit'),attempts:drains};
    }
  }
  return result;
}

function _tmNewDesktopAutoSaveSessionToken(){
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch (_) {}
  return 'tm_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 14) + '_' + Math.random().toString(36).slice(2, 10);
}

function _tmGetDesktopAutoSaveSessionToken(){
  try {
    if (typeof window !== 'undefined' && window.tianming && typeof window.tianming.getAutoSaveSessionToken === 'function') {
      var bridgeToken = String(window.tianming.getAutoSaveSessionToken() || '');
      if (bridgeToken) window._tmAutoSaveSessionToken = bridgeToken;
    }
  } catch (_) {}
  return (typeof window !== 'undefined' && window._tmAutoSaveSessionToken) ? String(window._tmAutoSaveSessionToken) : '';
}

function _tmRotateDesktopAutoSaveSession(reason, preferredToken){
  if (!_tmHasNativeFs()) return '';
  var token = String(preferredToken || '') || _tmNewDesktopAutoSaveSessionToken();
  if (!(window.tianming && typeof window.tianming.rotateAutoSaveSession === 'function')) return _tmGetDesktopAutoSaveSessionToken();
  var result = window.tianming.rotateAutoSaveSession(token);
  if (!(result && result.success === true && result.token)) {
    throw new Error('auto-save session rotate failed' + (result && result.error ? '：' + result.error : '') + (reason ? ' [' + reason + ']' : ''));
  }
  window._tmAutoSaveSessionToken = String(result.token);
  return window._tmAutoSaveSessionToken;
}
if (typeof window !== 'undefined') {
  window._tmGetDesktopAutoSaveSessionToken = _tmGetDesktopAutoSaveSessionToken;
  window._tmRotateDesktopAutoSaveSession = _tmRotateDesktopAutoSaveSession;
}

// C·document 级监听·任何键盘/指点/IME composition 都算 active input·5s 内 autoSave 跳过
if (typeof document !== 'undefined'){
  var _aSBumpInput=function(){ _autoSaveLastInputMs=Date.now(); };
  ['keydown','pointerdown','compositionupdate','input'].forEach(function(ev){
    try{ document.addEventListener(ev, _aSBumpInput, { capture:true, passive:true }); }catch(_){}
  });
}

// A-1·snapshot helper·浅拷顶 + 选择性深拷·明示 mutable / appendOnly / skip
// 注·top-level function decl 通过 hoisting 自动 attach 到 window (sloppy mode)·无需占位
function _autoSaveSnapshotGM(sourceGM, options){
  options = options || {};
  var _snapshotGM = sourceGM || (typeof GM !== 'undefined' ? GM : null);
  if (!_snapshotGM) return null;
  // append-only 字段·上层只 push·不改老元素·直接引用 (无 deepClone 成本)
  var APPEND_ONLY = {
    qijuHistory:1, jishiRecords:1, shijiHistory:1, evtLog:1, biannianItems:1,
    officeChanges:1, eraStateHistory:1, conv:1, _chronicle:1, _chronicleTracks:1,
    _turnReport:1, _foreshadows:1, allCharacters:1, summarizedTurns:1, _convArchive:1,
    recentChaoyi:1, _ccHeldItems:1, _aiDispatchStats:1, _subcallTimings:1,
    _pendingMartyrEvents:1, _pendingTinyiActions:1, _pendingTinyiTopics:1,
    triggeredHistoryEvents:1, triggeredOffendEvents:1, rigidTriggers:1,
    // L3·R5·改革召对历史·cap 50·append-only·不深拷
    _kjpPrivateAudienceLog:1
  };
  // skip·debug-only·崩溃恢复用不上·清掉省 100-300ms
  // 2026-06-10 追加三个纯冗余大块(真存档实测计 5.5MB+):
  //   _facIndex·派生反向索引·序列化后是与 chars 脱钩的死拷贝·读档即 rebuild(fullLoadGame)+每回合 render-finalize 重建
  //   _savedMapData / _savedAdminHierarchy·_prepareGMForSave 每次从工作数据克隆的备份·
  //     与文件里 gameState.mapData / P.adminHierarchy 逐字节相同·_restoreSavedFields 是条件式恢复·缺席时工作数据原样生效
  // 2026-07-16·案二·_saved* 镜像去重(承上两键的同款判断·真档 T54 实测再省 ~4.8MB):
  //   下列 _saved* 均是 _prepareGMForSave 以 _safeClone(GM.<活字段>) 克隆的镜像·与文件里的活字段(gameState.GM.<活字段>)
  //   逐字节全同(measure 实证 IDENTICAL)·_restoreSavedFields 的恢复是条件式 `if(GM._savedX){GM.x=GM._savedX;...}`·
  //   缺席时活字段(fullLoadGame:822/828 直接从档载入·恢复前不被重置)原样生效·故只落活字段一份即可。
  //   ★安全边界(白名单法·多列一个只是多存·漏列一个不丢数据)：只纳入「活字段=GM.x·恢复写回 GM.x·非切片」者。
  //   刻意排除：子系统序列化态(_savedEventOpinions/_savedEventBus·经 OpinionSystem/StoryEventBus 反序列化·无活字段孪生)、
  //   DOM 草稿(_savedEdictDrafts)、逐角色聚合(_savedCharMemExt/_savedCharOfficeFields)、
  //   P 层孪生(_savedVassalSystem/_savedTitleSystem/_savedBuildingSystem/_savedKeju/_savedOfficialVassalMapping/_savedGovernment/_savedOfficeConfig·跨 GM/P)、
  //   截断切片(_savedNpcDecisionDiagnostics=slice(-120)·镜像≠活字段)、_savedRenli(并行线在飞·避让)。
  var SKIP = {
    _aiTelemetry:1, _debugSnapshots:1, _aiBranchDiag:1, _aiDiag:1,
    _sysCacheMode:1, _sysCacheLen:1, _saveMeta:1,
    // Promise/lease jobs may retain gmRef and form cycles; they are runtime coordination, never world state.
    _postTurnJobs:1, _postTurnDetachedJobs:1,
    _facIndex:1, _savedMapData:1, _savedAdminHierarchy:1,
    // ── 案二·GM 活字段的冗余 _saved* 镜像(按 T54 体积降序·活字段孪生已入档) ──
    _savedConvArchive:1, _savedMemoryArchiveFull:1, _savedLetters:1,
    _savedEdictTracker:1, _savedEdictSuggestions:1, _savedNpcActionLedger:1,
    _savedChronicle:1, _savedCulturalWorks:1, _savedProvinceStats:1,
    _savedHistoryIndex:1, _savedFactionRelationsMap:1, _savedNpcCommitments:1,
    _savedCharacterArcs:1, _savedEdictLifecycle:1, _savedCourtRecords:1,
    _savedNpcFactionAiTurnLedger:1, _savedFamilies:1, _savedCausalGraph:1,
    _savedMemoryLayers:1, _savedBattleHistory:1, _savedFactionArcs:1,
    // 刀C返工三轮(2026-07-19)·写端来源判据的派生记忆化缓存(allNames/朝议拼接文本+其签名)·非游戏态·不入档
    //   (随通用快照持久化会致读档命中旧局缓存·已并 loadGen 入键作二保险)。
    _wgAllNamesCache:1, _wgAllNamesSigVal:1, _wgCourtTextCache:1, _wgCourtTextSigVal:1
  };
  var out = {};
  for (var k in _snapshotGM) {
    if (!_snapshotGM.hasOwnProperty(k)) continue;
    if (typeof TM !== 'undefined' && TM.perf && typeof TM.perf.count === 'function') {
      TM.perf.count('world.persistenceVisitedNodes', 1);
    }
    if (SKIP[k]) continue;
    // _prepareGMForSave 刚以 _safeClone 建的 _saved* 镜像·写后只读不再变动·此处引用即可
    // (原落入下方 deepClone 分支被二次深拷·每60s 自动存档对~130 个大块多拷一遍·此优化砍掉冗余那遍·序列化输出逐字节不变)
    if (k.slice(0, 6) === '_saved') {
      var savedValue = _snapshotGM[k];
      if (options.detach && !options.reuseMutable && savedValue !== null && typeof savedValue === 'object') out[k] = deepClone(savedValue);
      else out[k] = savedValue;
      continue;
    }
    if (APPEND_ONLY[k]) {
      // 普通手动快照仍可复用 append-only；提交给后台 timer 的稳定快照必须一次性脱离 live。
      var appendValue = _snapshotGM[k];
      out[k] = (options.detach && !options.reuseMutable && appendValue !== null && typeof appendValue === 'object') ? deepClone(appendValue) : appendValue;
      continue;
    }
    var v = _snapshotGM[k];
    // 函数·跳·先于 primitive 检查 (typeof function 不是 'object'·会误入 primitive 分支)
    if (typeof v === 'function') continue;
    // 原始 / null·直接赋
    if (v === null || typeof v !== 'object') { out[k] = v; continue; }
    // mutable·首次快照深拷；对已经脱离 live GM 的工作副本可安全复用，
    // 让准备后的第二遍过滤不再重复深拷整个世界。
    try { out[k] = options.reuseMutable ? v : deepClone(v); }
    catch (_cE) {
      // detach 快照一旦回退到引用，就重新暴露半回合写盘风险；必须明确失败。
      if (options.detach) throw _cE;
      out[k] = v;
    }
  }
  return out;
}
if (typeof window !== 'undefined') window._autoSaveSnapshotGM = _autoSaveSnapshotGM;

// 存档快照唯一构造口：所有可持久化写口都复用同一份 selective GM snapshot，
// 并保持两种既有外壳格式不变：
//   idb     -> { GM, P }（TM_SaveDB / slot / pre_endturn）
//   project -> P 克隆本体 + gameState（桌面存档 / 浏览器导出 / Electron autosave）
// 调用方须在需要时先 await 后台任务；prepare 默认开启，传 prepare:false 可避免同一写口重复序列化。
function _buildSaveState(options){
  options = options || {};
  if (typeof TM !== 'undefined' && TM.perf && typeof TM.perf.count === 'function') {
    TM.perf.count('world.persistenceBuild.count', 1);
  }
  var liveGM = (typeof GM !== 'undefined' ? GM : null);
  var sourceGM = options.gm || liveGM;
  var sourceP = options.p || (typeof P !== 'undefined' ? P : {});
  if (!sourceGM) return null;
  var gmSnapshot = _autoSaveSnapshotGM(sourceGM, { detach: options.detach === true });
  var pWorking = deepClone(sourceP || {});
  if (options.prepare !== false && typeof _prepareGMForSave === 'function') {
    var prepared = _prepareGMForSave(gmSnapshot, pWorking);
    if (!prepared) return null;
    gmSnapshot = _autoSaveSnapshotGM(prepared.GM, {
      reuseMutable: true,
      detach: options.detach === true
    });
    pWorking = prepared.P;
  }
  var pSnapshot = _tmStripAiKeyInPlace(pWorking);
  // P.gameState 只允许出现在 project 外壳的最外层；清掉旧读档遗留的嵌套僵尸再装当前快照。
  try { if (pSnapshot && pSnapshot.gameState) delete pSnapshot.gameState; } catch (_) {}
  if (options.format === 'project') {
    pSnapshot.gameState = gmSnapshot;
    return pSnapshot;
  }
  return { GM: gmSnapshot, P: pSnapshot };
}
if (typeof window !== 'undefined') window._buildSaveState = _buildSaveState;

function _tmCommittedSnapshotIdentityFor(state, meta){
  var snapshotGM = state && state.GM;
  if (!snapshotGM || !state.P) return null;
  meta = meta || {};
  var turn = Number(meta.turn !== undefined ? meta.turn : snapshotGM.turn);
  if (!Number.isFinite(turn)) return null;
  var loadGenerationRaw = (typeof window !== 'undefined') ? window._tmLoadGen : 0;
  if (loadGenerationRaw === undefined || loadGenerationRaw === null) loadGenerationRaw = 0;
  if (typeof loadGenerationRaw === 'string' && !loadGenerationRaw.trim()) return null;
  var loadGeneration = Number(loadGenerationRaw);
  if (!Number.isFinite(loadGeneration) || loadGeneration < 0) return null;
  return {
    campaignId: String(snapshotGM._campaignId || ''),
    timelineId: String(snapshotGM._timelineId || ''),
    sessionToken: String(meta.sessionToken || _tmGetDesktopAutoSaveSessionToken() || ''),
    loadGeneration: loadGeneration,
    turn: turn,
    transactionId: String(meta.transactionId || '')
  };
}

function _tmAdoptCommittedWorldSnapshot(state, meta){
  meta = meta || {};
  var identity = _tmCommittedSnapshotIdentityFor(state, meta);
  if (!identity) return false;
  // 默认防御性克隆，保证调用方随后修改入参也不会改变已提交基线。
  // canonical/pre_endturn 已用 detach:true 构造时可显式移交所有权，避免第二份完整世界峰值。
  var ownedState = meta.takeOwnership === true ? state : deepClone(state);
  if (!ownedState || !ownedState.GM || !ownedState.P) return false;
  lastCommittedSnapshot = ownedState;
  lastCommittedTurn = identity.turn;
  lastCommittedTransactionId = identity.transactionId;
  _lastCommittedSnapshotIdentity = identity;
  return true;
}

function _tmInvalidateCommittedWorldSnapshot(reason){
  lastCommittedSnapshot = null;
  lastCommittedTurn = -1;
  lastCommittedTransactionId = '';
  _lastCommittedSnapshotIdentity = null;
  if (reason && typeof console !== 'undefined' && console.warn) {
    console.warn('[autoSave] 已提交世界基线失效:', String(reason));
  }
  return true;
}

function _tmCaptureCommittedWorldSnapshotFromLive(reason){
  if (!GM || !P || !GM.running || isWorldTransactionActive()) return false;
  var state = _buildSaveState({ format: 'idb', detach: true, gm: GM, p: P });
  if (!state) return false;
  return _tmAdoptCommittedWorldSnapshot(state, {
    turn: GM.turn,
    transactionId: String(reason || 'stable-world-boundary'),
    takeOwnership: true
  });
}

function _tmCommittedSnapshotMatchesLive(){
  if (!lastCommittedSnapshot || !_lastCommittedSnapshotIdentity || !GM || !P) return false;
  return String(GM._campaignId || '') === _lastCommittedSnapshotIdentity.campaignId
    && String(GM._timelineId || '') === _lastCommittedSnapshotIdentity.timelineId
    && String(_tmGetDesktopAutoSaveSessionToken() || '') === _lastCommittedSnapshotIdentity.sessionToken;
}

function _tmCommittedSnapshotProjectEnvelope(){
  if (!lastCommittedSnapshot || !lastCommittedSnapshot.GM || !lastCommittedSnapshot.P) return null;
  // 只新建轻量根对象；嵌套对象属于不可变 committed snapshot，IPC structured clone 会复制到主进程。
  var payload = Object.assign({}, lastCommittedSnapshot.P);
  if (Object.prototype.hasOwnProperty.call(payload, 'gameState')) delete payload.gameState;
  payload.gameState = lastCommittedSnapshot.GM;
  var snapshotGM = lastCommittedSnapshot.GM;
  var scenario = typeof findScenarioById === 'function' ? findScenarioById(snapshotGM.sid) : null;
  payload._saveMeta = {
    turn: lastCommittedTurn,
    scenario: (scenario && scenario.name) || '',
    saveName: snapshotGM.saveName,
    date: new Date().toISOString(),
    transactionId: lastCommittedTransactionId
  };
  return payload;
}

async function _tmRunDesktopAutoSaveTick(options){
  options = options || {};
  if (!GM || !GM.running) return { ok: false, skipped: true, reason: 'not-running' };
  if (isWorldTransactionActive()) {
    _autoSaveDeferred = true;
    return { ok: false, deferred: true, reason: 'world-transaction-active' };
  }
  if (_autoSaveInFlightPromise||_autoSaveInFlight) {
    _autoSaveSkipCount++;
    if (_autoSaveSkipCount === 5) console.warn('[autoSave] 连续 5 次被跳·上一次 IPC 尚未完成');
    return { ok: false, skipped: true, reason: 'in-flight' };
  }
  if (!_tmCommittedSnapshotMatchesLive()) {
    return { ok: false, skipped: true, reason: 'no-committed-snapshot' };
  }

  var now = Date.now();
  var sinceInput = now - _autoSaveLastInputMs;
  var sinceSave = now - _autoSaveLastDoneMs;
  if (options.force !== true && sinceInput < 5000 && sinceSave < 180000) {
    _autoSaveDeferStreak++;
    return { ok: false, skipped: true, reason: 'recent-input' };
  }
  if (_autoSaveDeferStreak > 0) _autoSaveDeferStreak = 0;
  if (options.force !== true && _autoSaveLastDoneMs > 0
      && _autoSaveLastInputMs <= _autoSaveLastDoneMs
      && lastCommittedTurn === _autoSaveLastSavedTurn) {
    _autoSaveIdleSkipStreak++;
    return { ok: false, skipped: true, reason: 'idle-unchanged' };
  }
  _autoSaveIdleSkipStreak = 0;

  var sourceSnapshot = lastCommittedSnapshot;
  var sourceIdentity = _lastCommittedSnapshotIdentity;
  var saveData = _tmCommittedSnapshotProjectEnvelope();
  if (!saveData) return { ok: false, skipped: true, reason: 'snapshot-unavailable' };
  _autoSaveInFlight = true;
  var operation=Promise.resolve().then(async function(){
    try {
      _autoSaveSkipCount = 0;
      var result = await window.tianming.autoSave(saveData);
      if (!_tmDesktopAutoSaveResultOk(result)) throw _tmDesktopAutoSaveFailure(result);
      if (lastCommittedSnapshot !== sourceSnapshot || _lastCommittedSnapshotIdentity !== sourceIdentity
          || !_tmCommittedSnapshotMatchesLive()) {
        console.warn('[autoSave] 已提交快照在 IPC 期间推进或跨档·本次落盘有效但不推进当前局闲置基线');
        return { ok: true, stale: true, turn: Number(saveData._saveMeta.turn) };
      }
      _autoSaveLastDoneMs = Date.now();
      _autoSaveLastSavedTurn = Number(saveData._saveMeta.turn);
      _autoSaveLiteTick++;
      if (_autoSaveLiteTick >= 5) {
        _autoSaveLiteTick = 0;
        try {
          var committedP = lastCommittedSnapshot.P || {};
          localStorage.removeItem('tm_P');
          localStorage.setItem('tm_P_lite', JSON.stringify(_tmStripAiKeyView({
            scenarios: (committedP.scenarios || []).map(function(s){ return {id:s.id,name:s.name,era:s.era,role:s.role}; }),
            ai: committedP.ai,
            conf: _tmLiteSafeConf(committedP.conf),
            _hasFullData: true
          })));
        } catch (liteError) {
          _tmReportDesktopAutoSaveBoundaryError(liteError, 'desktop autosave lite');
        }
      }
      return { ok: true, turn: _autoSaveLastSavedTurn, transactionId: lastCommittedTransactionId };
    } catch (error) {
      console.warn('[autoSave] 桌面自动存档失败:', error && (error.message || error));
      return { ok: false, error: error };
    } finally {
      _autoSaveInFlight = false;
      if (_autoSaveInFlightPromise===operation) _autoSaveInFlightPromise=null;
    }
  });
  _autoSaveInFlightPromise=operation;
  return operation;
}

function _tmFlushDeferredDesktopAutoSave(reason, options){
  options = options || {};
  if (!_autoSaveDeferred) return Promise.resolve({ ok: false, skipped: true, reason: 'not-deferred' });
  if (isWorldTransactionActive()) return Promise.resolve({ ok: false, deferred: true, reason: 'world-transaction-active' });
  if (options.immediate === true) {
    _autoSaveDeferred = false;
    return _tmRunDesktopAutoSaveTick({ force: true, reason: reason || 'deferred' });
  }
  if (_autoSaveFlushTimer) return Promise.resolve({ ok: false, scheduled: true, reason: 'already-scheduled' });
  _autoSaveFlushTimer = setTimeout(function(){
    _autoSaveFlushTimer = null;
    if (!_autoSaveDeferred) return;
    if (isWorldTransactionActive()) return;
    _autoSaveDeferred = false;
    _tmRunDesktopAutoSaveTick({ force: true, reason: reason || 'deferred' }).catch(function(error){
      console.warn('[autoSave] deferred flush failed:', error && (error.message || error));
    });
  }, 0);
  return Promise.resolve({ ok: false, scheduled: true, reason: reason || 'deferred' });
}

function _tmRequestDeferredDesktopAutoSaveFlush(reason, options){
  if (typeof _tmFlushDeferredDesktopAutoSave !== 'function') {
    return Promise.resolve({ ok: false, skipped: true, reason: 'flush-unavailable' });
  }
  var pending;
  try {
    pending = _tmFlushDeferredDesktopAutoSave(reason, options);
  } catch (error) {
    var syncError = _tmReportDesktopAutoSaveBoundaryError(error, 'deferred desktop autosave flush · ' + String(reason || 'unknown'));
    return Promise.resolve({ ok: false, error: syncError });
  }
  return Promise.resolve(pending).catch(function(error){
    var asyncError = _tmReportDesktopAutoSaveBoundaryError(error, 'deferred desktop autosave flush · ' + String(reason || 'unknown'));
    return { ok: false, error: asyncError };
  });
}

if (typeof window !== 'undefined') {
  window.isWorldTransactionActive = isWorldTransactionActive;
  window._tmAdoptCommittedWorldSnapshot = _tmAdoptCommittedWorldSnapshot;
  window._tmInvalidateCommittedWorldSnapshot = _tmInvalidateCommittedWorldSnapshot;
  window._tmCaptureCommittedWorldSnapshotFromLive = _tmCaptureCommittedWorldSnapshotFromLive;
  window._tmRunDesktopAutoSaveTick = _tmRunDesktopAutoSaveTick;
  window._tmFlushDeferredDesktopAutoSave = _tmFlushDeferredDesktopAutoSave;
  window.requestBackgroundAutosave = requestBackgroundAutosave;
  window._tmDrainBackgroundAutosaves = _tmDrainBackgroundAutosaves;
  window._tmAwaitBackgroundAutosaves = _tmAwaitBackgroundAutosaves;
}
if(_tmHasNativeFs()){
  // 每60秒自动存档（仅完整运行局；纯 P 由 project IDB + lite 保存） (timer-leak-ok·文件顶层一次性·桌面端生命周期)
  setInterval(function(){
    _tmRunDesktopAutoSaveTick().catch(function(error){
      console.warn('[autoSave] timer failed:', error && (error.message || error));
    });
  },60000);

  // 启动时检测自动存档
  (async function(){
    try{
      var r=await window.tianming.loadAutoSave();
      if(r.success&&r.data){
        if(r.data.gameState&&r.data.gameState.running){
          // 有运行中的游戏——提示恢复
          if(confirm("\u68C0\u6D4B\u5230\u81EA\u52A8\u5B58\u6863 (T"+(r.data.gameState.turn||1)+")\uFF0C\u662F\u5426\u6062\u590D\uFF1F")){
            showLoading("\u6062\u590D...",50);
            try { await fullLoadGame(r.data, { autoSaveSessionToken: r.sessionToken || '', source: 'desktop-autosave' }); }
            catch (_restE) { console.error('[autoRestore] 恢复失败', _restE); toast('恢复失败: ' + (_restE.message||_restE)); }
            finally { hideLoading(); }
          }
        } else if(r.data.scenarios&&r.data.scenarios.length>0){
          // 没有运行中的游戏但有剧本数据——静默恢复P结构
          var data=r.data;
          for(var key in data){
            if(data.hasOwnProperty(key)&&key!=='gameState'&&key!=='_saveMeta'){
              P[key]=data[key];
            }
          }
          console.log('[desktop] 已从autoSave恢复P（无游戏状态），scenarios:',P.scenarios.length);
        }
      }
    }catch(e){ console.warn("[catch] 静默异常:", e.message || e); }
  })();
}

// 6b. 浏览器端定期保存P + 页面关闭时保存
if(!_tmHasNativeFs()){
  // timer-leak-ok·文件顶层一次性·浏览器端生命周期
  setInterval(function(){ try{saveP();}catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-audio-theme');}catch(_){}} },120000);
}
// 页面关闭/刷新时紧急保存P
window.addEventListener('beforeunload',function(event){
  try{
    if ((_backgroundSavePending||_backgroundSaveInFlight)&&event) {
      // Browsers/Electron decide the wording; this explicit prompt is preferable to silently
      // discarding an already generated background chronicle on immediate exit.
      event.preventDefault();
      event.returnValue='';
    }
    if(_tmHasNativeFs()) localStorage.removeItem("tm_P");
    else{
      localStorage.removeItem("tm_P");
      if(!(typeof _tmIsIncompleteOfficialProject==="function"&&_tmIsIncompleteOfficialProject(P))){
        localStorage.setItem("tm_P",JSON.stringify(_tmStripAiKeyView(P)));
      }
    }
  }catch(e){}
});

// 7. 查漏：推演时奏议数量使用设置中的值
var _origGenMem=generateMemorials;
generateMemorials=function(){
  // 同步界面上的值到P.conf
  var minEl=_$("memorial-min");var maxEl=_$("memorial-max");
  if(minEl)P.conf.memorialMin=+minEl.value;
  if(maxEl)P.conf.memorialMax=+maxEl.value;
  _origGenMem();
};

// 8. 查漏：近N回合起居注完整内容打包
// 注意：此包装层已废弃，功能已迁移到 EndTurnHooks 系统（钩子5）

// 9. 查漏：游戏规则注入推演
// 注意：此包装层已废弃，功能已迁移到 EndTurnHooks 系统（钩子7）

// 10. 查漏：游戏模式（史实检查）
// 注意：此包装层已废弃，功能已迁移到 EndTurnHooks 系统（钩子9）
