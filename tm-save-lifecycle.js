// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// tm-save-lifecycle.js — 存档读档生命周期 (R131 从 tm-audio-theme.js L558-1498 拆出)
// 姊妹: tm-audio-theme.js (音频+主题) + tm-office-editor.js (官制编辑器)
// 包含: _safeClone/_ensureGMDefaults/_ensurePDefaults/_prepareGMForSave/
//       _restoreSavedFields/fullLoadGame
// 这是真正的存档管道核心·与 tm-storage.js (IndexedDB) + SaveManager (UI) 三层协作
// ============================================================


// ============================================================
//  存档读档优化 + 最终查漏
// ============================================================

// 1. 存档：确保包含所有数据

// 安全深拷贝辅助
function _safeClone(obj) {
  if (!obj) return obj;
  return typeof deepClone === 'function' ? deepClone(obj) : JSON.parse(JSON.stringify(obj));
}

// 确保 GM 所有字段存在默认值（存档前/读档后统一调用）
function _ensureGMDefaults() {
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
  if (!GM._courtRecords) GM._courtRecords = [];
  if (!GM.activeSchemes) GM.activeSchemes = [];
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
}

// 确保 P 所有字段存在默认值
function _ensurePDefaults() {
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
function _prepareGMForSave() {
  // 系统序列化
  // 注意：GM._chronicle是编年事件数组，不可与ChronicleSystem的月/年摘要对象混用——分开存
  GM._chronicleSysState = typeof ChronicleSystem !== 'undefined' ? ChronicleSystem.serialize() : null;
  GM._warTruces = typeof WarWeightSystem !== 'undefined' ? WarWeightSystem.serialize() : null;
  GM._rngState = typeof getRngState === 'function' ? getRngState() : null;
  // 亲疏/得罪/反弹/观感
  if (GM.affinityMap) GM._savedAffinityMap = _safeClone(GM.affinityMap);
  if (GM.offendGroupScores) GM._savedOffendScores = _safeClone(GM.offendGroupScores);
  if (GM.activeRebounds) GM._savedActiveRebounds = _safeClone(GM.activeRebounds);
  if (GM.triggeredOffendEvents) GM._savedTriggeredOffend = _safeClone(GM.triggeredOffendEvents);
  if (typeof OpinionSystem !== 'undefined' && OpinionSystem.getAllEventOpinions) GM._savedEventOpinions = OpinionSystem.getAllEventOpinions();
  // 昏君/变量映射/后宫/家族/AI记忆
  if (GM._tyrantDecadence) GM._savedTyrantDecadence = GM._tyrantDecadence;
  if (GM._tyrantHistory && GM._tyrantHistory.length > 0) GM._savedTyrantHistory = _safeClone(GM._tyrantHistory);
  if (GM._varMapping) GM._savedVarMapping = _safeClone(GM._varMapping);
  if (GM.harem) GM._savedHarem = _safeClone(GM.harem);
  if (GM.families) GM._savedFamilies = _safeClone(GM.families);
  if (GM._varFormulas && GM._varFormulas.length > 0) GM._savedVarFormulas = _safeClone(GM._varFormulas);
  if (GM._foreshadows) GM._savedForeshadows = _safeClone(GM._foreshadows);
  if (GM._aiMemory) GM._savedAiMemory = _safeClone(GM._aiMemory);
  // R103·对话完整归档（被截断/压缩的老对话原文）
  if (GM._convArchive && GM._convArchive.length > 0) GM._savedConvArchive = _safeClone(GM._convArchive);
  // 矛盾演化系统
  if (GM._contradictions && GM._contradictions.length > 0) GM._savedContradictions = _safeClone(GM._contradictions);
  // 鸿雁传书+京城
  if (GM.letters && GM.letters.length > 0) GM._savedLetters = _safeClone(GM.letters);
  if (GM._capital) GM._savedCapital = GM._capital;
  if (GM._currentTrend) GM._savedTrend = GM._currentTrend;
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
  if (GM._lastEvalTurn) GM._savedLastEvalTurn = GM._lastEvalTurn;
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
  if (GM.mapData) GM._savedMapData = _safeClone(GM.mapData);
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
  _ensureGMDefaults();
  _ensurePDefaults();
  if (typeof buildCoreMetricLabels === 'function') buildCoreMetricLabels();
}

doSaveGame=async function(){
  if(!GM.running){toast("\u8BF7\u5148\u5F00\u59CB\u6E38\u620F");return;}
  _prepareGMForSave();

  if(window.tianming&&window.tianming.isDesktop){
    // 桌面端：面板UI
    var sc=findScenarioById(GM.sid);
    var defName=GM.saveName||("T"+GM.turn+"_"+(sc?sc.name:"save"));
    var list=await window.tianming.listSaves();
    var files=list.success?list.files.filter(function(f){return f.name!=="__autosave__";}):[];
    files.sort(function(a,b){return (b.modified||0)-(a.modified||0);});
    var html='<div style="padding:1.5rem;max-width:520px;margin:auto">';
    html+='<h2 style="color:var(--gold);margin-bottom:1rem">\u4FDD\u5B58\u6E38\u620F</h2>';
    html+='<label style="display:block;margin-bottom:0.4rem;color:var(--txt-s)">\u5B58\u6863\u540D</label>';
    html+='<input id="save-name-inp" class="inp" style="width:100%;margin-bottom:0.8rem" value="'+defName+'">';
    html+='<button class="btn" style="margin-bottom:1.2rem" onclick="desktopDoSave()">\u4FDD\u5B58</button>';
    if(files.length){
      html+='<h4 style="color:var(--txt-d);margin-bottom:0.5rem">\u8986\u76D6\u73B0\u6709\u5B58\u6863</h4>';
      html+='<div style="max-height:220px;overflow-y:auto">';
      files.forEach(function(f){
        var meta=f.meta||{};
        var sub=(meta.scenario?'\u5267\u672C:'+meta.scenario+' ':'')+(meta.turn?'T'+meta.turn:'');
        html+='<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.4rem;background:var(--bg-3);border-radius:6px;padding:0.4rem 0.75rem">';
        html+='<div style="flex:1;min-width:0">';
        html+='<div style="color:var(--txt-s);font-size:0.88rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+f.name+'</div>';
        html+='<div style="color:var(--txt-d);font-size:0.72rem">'+f.modifiedStr+(sub?' &nbsp;\u00b7 '+sub:'')+'</div>';
        html+='</div>';
        html+='<button style="padding:0.15rem 0.6rem;border:none;border-radius:4px;background:var(--gold);color:#111;cursor:pointer;font-size:0.78rem;font-family:inherit" '+'onclick="_$(\"save-name-inp\").value='+JSON.stringify(f.name)+';desktopDoSave()">\u8986\u76D6</button>';
        html+='</div>';
      });
      html+='</div>';
    }
    html+='<button class="btn" style="margin-top:1rem" onclick="enterGame()">\u53D6\u6D88</button>';
    html+='</div>';
    showPanel(html);
    _$('G').style.display='none';
  }else{
    // 浏览器端：直接导出
    var sc2=findScenarioById(GM.sid);
    var name="T"+GM.turn+"_"+(sc2?sc2.name:"save")+"_"+new Date().toISOString().slice(0,10);
    var saveData2=deepClone(P);
    saveData2.gameState=deepClone(GM);
    saveData2._saveMeta={name:name,turn:GM.turn,time:getTSText(GM.turn),scenario:sc2?sc2.name:"",date:new Date().toISOString(),version:P.meta.v};
    var blob=new Blob([JSON.stringify(saveData2,null,2)],{type:"application/json"});
    var a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name+".json";a.click();
    toast("\u2705 \u5DF2\u5BFC\u51FA: "+name+".json");
  }
};

window.desktopDoSave=async function(){
  var name=(_$("save-name-inp").value||"").trim();
  if(!name){toast("\u8BF7\u8F93\u5165\u5B58\u6863\u540D");return;}
  var sc=findScenarioById(GM.sid);
  _prepareGMForSave(); // 序列化所有系统数据+确保GM/P字段默认值
  var saveData=deepClone(P);
  saveData.gameState=deepClone(GM);
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
  if (GM._savedOffendScores) { GM.offendGroupScores = GM._savedOffendScores; delete GM._savedOffendScores; }
  if (GM._savedActiveRebounds) { GM.activeRebounds = GM._savedActiveRebounds; delete GM._savedActiveRebounds; }
  if (GM._savedTriggeredOffend) { GM.triggeredOffendEvents = GM._savedTriggeredOffend; delete GM._savedTriggeredOffend; }
  if (GM._savedEventOpinions && typeof OpinionSystem !== 'undefined' && OpinionSystem.restoreEventOpinions) {
    OpinionSystem.restoreEventOpinions(GM._savedEventOpinions);
    delete GM._savedEventOpinions;
  }
  // 昏君/变量映射/后宫/家族/AI记忆
  if (GM._savedTyrantDecadence) { GM._tyrantDecadence = GM._savedTyrantDecadence; delete GM._savedTyrantDecadence; }
  if (GM._savedTyrantHistory) { GM._tyrantHistory = GM._savedTyrantHistory; delete GM._savedTyrantHistory; }
  if (GM._savedVarMapping) { GM._varMapping = GM._savedVarMapping; delete GM._savedVarMapping; }
  if (GM._savedHarem) { GM.harem = GM._savedHarem; delete GM._savedHarem; }
  if (GM._savedFamilies) { GM.families = GM._savedFamilies; delete GM._savedFamilies; }
  if (GM._savedVarFormulas) { GM._varFormulas = GM._savedVarFormulas; delete GM._savedVarFormulas; }
  if (GM._savedForeshadows) { GM._foreshadows = GM._savedForeshadows; delete GM._savedForeshadows; }
  if (GM._savedAiMemory) { GM._aiMemory = GM._savedAiMemory; delete GM._savedAiMemory; }
  // R103·对话完整归档恢复
  if (GM._savedConvArchive) { GM._convArchive = GM._savedConvArchive; delete GM._savedConvArchive; }
  if (GM._savedTrend) { GM._currentTrend = GM._savedTrend; delete GM._savedTrend; }
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
  if (GM._savedCapital) { GM._capital = GM._savedCapital; delete GM._savedCapital; }
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
  if (GM._savedLastEvalTurn) { GM._lastEvalTurn = GM._savedLastEvalTurn; delete GM._savedLastEvalTurn; }
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

function fullLoadGame(data){
  // 跨档保留 API 设置：localStorage 的 tm_api 是用户的"机器"配置·不应被存档覆盖
  var _preservedAi = null;
  try {
    var _stored = localStorage.getItem('tm_api');
    if (_stored) _preservedAi = JSON.parse(_stored);
  } catch(_) {}
  // 兼容两种存档格式：
  // 格式A (desktopDoSave/doSaveGame): data = P, data.gameState = GM
  // 格式B (SaveManager): data.gameState = {GM, P}
  if (data.gameState && data.gameState.GM && data.gameState.P) {
    // 格式B：SaveManager格式
    P = data.gameState.P;
    GM = data.gameState.GM;
  } else {
    // 格式A：标准格式
    P = data;
    if (data.gameState) {
      GM = data.gameState;
    }
  }
  // 恢复被存档冲掉的 API 配置（key/url/model 等都从 localStorage 拉回）
  if (_preservedAi && typeof _preservedAi === 'object' && (_preservedAi.key || _preservedAi.url)) {
    if (!P.ai) P.ai = {};
    Object.keys(_preservedAi).forEach(function(k) {
      // 只回填存档里没有或为空的字段·让用户最近的配置永远生效
      if (_preservedAi[k] != null && _preservedAi[k] !== '') P.ai[k] = _preservedAi[k];
    });
  }

  if(GM){
    GM.running=true;
    // 读档时强制重置busy——若存档时推演未完成（例如自动存档在endTurn中途触发），busy可能遗留为true导致"静待时变"失效
    GM.busy = false;
    GM._endTurnBusy = false;
    if(GM._rngState && typeof restoreRng === 'function') restoreRng(GM._rngState);
    // 兼容旧存档：旧版本将ChronicleSystem序列化数据错误地写入GM._chronicle（覆盖了原本的数组）——检测并迁移
    if (GM._chronicle && !Array.isArray(GM._chronicle) && typeof GM._chronicle === 'object'
        && (GM._chronicle.monthDrafts || GM._chronicle.yearChronicles)) {
      if (!GM._chronicleSysState) GM._chronicleSysState = GM._chronicle;
      GM._chronicle = [];
    }
    if(GM._chronicleSysState && typeof ChronicleSystem !== 'undefined') ChronicleSystem.deserialize(GM._chronicleSysState);
    if(GM._warTruces && typeof WarWeightSystem !== 'undefined') WarWeightSystem.deserialize(GM._warTruces);

    // 恢复所有_saved*字段
    _restoreSavedFields();

    // 一次性清理·扫除存档里历史误抓人物(强烈/连日/乌纱/平静等命中 NAME_BLACKLIST 词组)
    try {
      if (typeof purgeBlacklistedCharacters === 'function') {
        var _purged = purgeBlacklistedCharacters();
        if (_purged && (_purged.chars.length || _purged.pending.length)) {
          if (typeof addEB === 'function') addEB('清理', '清扫历史误抓人物·chars: ' + _purged.chars.length + '·pending: ' + _purged.pending.length);
        }
      }
    } catch(_purgeE) { try{ window.TM&&TM.errors&&TM.errors.captureSilent(_purgeE,'fullLoadGame·purge'); }catch(_){} }

    // 迁移官制树到双层模型
    if (typeof _offMigrateTree === 'function' && GM.officeTree) _offMigrateTree(GM.officeTree);
    // 官制officialTitle同步——确保ch.officialTitle与GM.officeTree一致
    if (GM.officeTree && GM.chars) {
      (function _syncTitles(nodes) {
        nodes.forEach(function(n) {
          (n.positions||[]).forEach(function(p) {
            if (p.holder) {
              var _sch = GM.chars.find(function(c){ return c.name === p.holder; });
              if (_sch) _sch.officialTitle = p.name;
            }
          });
          if (n.subs) _syncTitles(n.subs);
        });
      })(GM.officeTree);
    }
    // 确保所有字段有默认值
    _ensureGMDefaults();
    _ensurePDefaults();
    if (typeof buildCoreMetricLabels === 'function') buildCoreMetricLabels();

    // 角色完整字段补齐（兼容旧存档/手工导入的 JSON）
    try {
      if (typeof CharFullSchema !== 'undefined' && typeof CharFullSchema.ensureAll === 'function') {
        CharFullSchema.ensureAll(GM.chars);
      }
    } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'fullLoadGame] CharFullSchema.ensureAll 失败:') : console.error('[fullLoadGame] CharFullSchema.ensureAll 失败:', e); }

    // 重建索引
    if (typeof buildIndices === 'function') buildIndices();

    _$("launch").style.display="none";
    _$("bar").style.display="flex";
    _$("bar-btns").innerHTML="";
    _$("G").style.display="grid";
    _$("E").style.display="none";
    _$("shiji-btn").classList.add("show");
    _$("save-btn").classList.add("show");

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
      try { applyAutonomyToAllDivisions(); } catch(_autE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_autE, 'autonomy] 派生失败') : console.warn('[autonomy] 派生失败', _autE); }
    }
    // 自动分配后妃居所
    if (typeof autoAssignHaremResidences === 'function') {
      try { autoAssignHaremResidences(); } catch(_resE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_resE, 'residence] 分配失败') : console.warn('[residence] 分配失败', _resE); }
    }
    // 载入存档后：若 GM.adminHierarchy 缺失/为空（老存档），从剧本或 P 恢复
    try {
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
    } catch(_ahLE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_ahLE, 'fullLoadGame] adminHierarchy 恢复失败') : console.warn('[fullLoadGame] adminHierarchy 恢复失败', _ahLE); }

    // 老存档兼容：GM.fiscal.{royalClanPressure,huangzhuangIncome,imperialBusinesses} 缺失时从 P.fiscalConfig.neicangRules 镜像
    // tm-fiscal-fixed-expense.js:_calcRoyalStipend 等读 G.fiscal.royalClanPressure·缺则宗禄岁出 = 0
    try {
      var _scFC = (typeof findScenarioById === 'function' && GM.sid) ? findScenarioById(GM.sid) : null;
      var _fcSrc = (P.fiscalConfig && P.fiscalConfig.neicangRules)
                || (_scFC && _scFC.fiscalConfig && _scFC.fiscalConfig.neicangRules);
      if (_fcSrc) {
        GM.fiscal = GM.fiscal || {};
        if (_fcSrc.royalClanPressure && !GM.fiscal.royalClanPressure) GM.fiscal.royalClanPressure = deepClone(_fcSrc.royalClanPressure);
        if (_fcSrc.huangzhuangIncome && !GM.fiscal.huangzhuangIncome) GM.fiscal.huangzhuangIncome = deepClone(_fcSrc.huangzhuangIncome);
        if (_fcSrc.imperialBusinesses && !GM.fiscal.imperialBusinesses) GM.fiscal.imperialBusinesses = deepClone(_fcSrc.imperialBusinesses);
      }
    } catch(_fcLE) { try{window.TM&&TM.errors&&TM.errors.captureSilent(_fcLE,'fullLoadGame·fiscalConfig→GM.fiscal');}catch(_){} }

    // 集成桥梁：老存档可能缺 divisions 深化字段，init 会补齐并建立 legacy proxy
    if (typeof IntegrationBridge !== 'undefined' && typeof IntegrationBridge.init === 'function') {
      try { IntegrationBridge.init(); } catch(_ibE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_ibE, 'bridge] init 失败') : console.warn('[bridge] init 失败', _ibE); }
    }

    // 同步剧本自定义预设（HistoricalPresets 动态 getter 读取 window.scriptData.customPresets）
    try {
      if (P && P.customPresets) {
        if (!window.scriptData) window.scriptData = {};
        window.scriptData.customPresets = P.customPresets;
      }
    } catch(_cpLE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_cpLE, 'load] customPresets sync 失败') : console.warn('[load] customPresets sync 失败', _cpLE); }

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
  if(window.tianming&&window.tianming.isDesktop&&window.tianming.dialogImport){
    window.tianming.dialogImport().then(function(res){
      if(!res||res.canceled||!res.success)return;
      try{ fullLoadGame(res.data); }catch(err){ toast('\u5931\u8D25: '+err.message); }
    }).catch(function(){ toast('\u5931\u8D25'); });
    return;
  }
  // 浏览器端：文件选择器
  var inp=document.createElement("input");inp.type="file";inp.accept=".json";
  inp.onchange=function(e){
    var f=e.target.files[0];if(!f)return;
    showLoading("\u8BFB\u53D6\u6587\u4EF6...",30);
    var reader=new FileReader();
    reader.onload=function(ev){
      try{
        showLoading("\u89E3\u6790\u6570\u636E...",60);
        var data=JSON.parse(ev.target.result);
        showLoading("\u6062\u590D\u72B6\u6001...",90);
        fullLoadGame(data);
        hideLoading();
      }catch(err){hideLoading();toast("\u5931\u8D25: "+err.message);}
    };
    reader.readAsText(f);
  };
  inp.click();
};

// 4. Electron读取（覆盖旧版）——统一使用卷宗UI
if(window.tianming&&window.tianming.isDesktop){
  doLoadSave=function(){
    if(typeof openSaveManager==='function'){openSaveManager();return;}
    // 降级：旧版文件列表
    (async function(){var list=await window.tianming.listSaves();
    var files=list.success?list.files.filter(function(f){return f.name!=="__autosave__";}):[];
    files.sort(function(a,b){return (b.modified||0)-(a.modified||0);});
    var html="<div style='padding:1.5rem;max-width:560px;margin:auto'>";
    html+="<h2 style='color:var(--gold);margin-bottom:1rem'>\u8BFB\u53D6\u5B58\u6863</h2>";
    if(!files.length){
      html+="<p style='color:var(--txt-d)'>\u65E0\u5B58\u6863\u3002</p>";
    }else{
      html+="<div style='max-height:340px;overflow-y:auto'>";
      files.forEach(function(f){
        var meta=f.meta||{};
        var sub=(meta.scenario?'\u5267\u672C:'+meta.scenario+' ':'')+(meta.turn?'T'+meta.turn:'');
        html+="<div style='display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;background:var(--bg-3);border-radius:6px;padding:0.5rem 0.75rem'>";
        html+="<div style='flex:1;min-width:0'>";
        html+="<div style='color:var(--txt-s);font-size:0.9rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap'>"+f.name+"</div>";
        html+="<div style='color:var(--txt-d);font-size:0.75rem'>"+(f.modifiedStr||"")+" \u00b7 "+Math.round(f.size/1024)+" KB"+(sub?" \u00b7 "+sub:"")+"</div>";
        html+="</div>";
        html+="<button style='padding:0.2rem 0.7rem;border:none;border-radius:4px;background:var(--gold);color:#111;cursor:pointer;font-size:0.8rem;font-family:inherit' "
          +"onclick='window.desktopLoadSave("+JSON.stringify(f.name)+")'>"+"\u8F7D\u5165"+"</button>";
        html+="<button style='padding:0.2rem 0.6rem;border:none;border-radius:4px;background:#5a2020;color:#eee;cursor:pointer;font-size:0.8rem;font-family:inherit' "
          +"onclick='window.desktopDeleteSave("+JSON.stringify(f.name)+")'>"+"\u5220\u9664"+"</button>";
        html+="</div>";
      });
      html+="</div>";
    }
    html+="<div style='display:flex;gap:0.8rem;margin-top:1rem'>";
    html+="<button class='btn' onclick='importSaveFile()'>\u4ECE\u6587\u4EF6\u5BFC\u5165</button>";
    html+="<button class='btn' onclick='showMain()'>\u8FD4\u56DE</button>";
    html+="</div>";
    html+="</div>";
    showPanel(html);
    _$("G").style.display="none";
  })();};

  window.desktopLoadSave=async function(name){
    showLoading("\u8BFB\u53D6\u5B58\u6863...",30);
    try{
      var r=await window.tianming.loadProject(name);
      if(r.success&&r.data){
        showLoading("\u6062\u590D...",70);
        try { fullLoadGame(r.data); }
        catch (_lpE) { console.error('[loadProject] 恢复失败', _lpE); toast('恢复失败: ' + (_lpE.message||_lpE)); }
        finally { hideLoading(); }
      }else{hideLoading();toast("\u52A0\u8F7D\u5931\u8D25");}
    }catch(e){hideLoading();toast("\u5931\u8D25: "+e.message);}
  };

  window.desktopDeleteSave=async function(name){
    if(!confirm("\u786E\u8BA4\u5220\u9664\u5B58\u6863\u300C"+name+"\u300D\uFF1F"))return;
    var r=await window.tianming.deleteSave(name);
    if(r.success){toast("\u5DF2\u5220\u9664");doLoadSave();}
    else toast("\u5220\u9664\u5931\u8D25: "+(r.error||""));
  };
}

// 6. 自动存档（Electron）
if(window.tianming&&window.tianming.isDesktop){
  // 每60秒自动存档（始终保存P，游戏运行时附带GM） (timer-leak-ok·文件顶层一次性·桌面端生命周期)
  setInterval(async function(){
    try{
      if(GM.running && typeof _prepareGMForSave === 'function') _prepareGMForSave();
      var saveData=deepClone(P);
      if(GM.running){saveData.gameState=deepClone(GM);saveData._saveMeta={turn:GM.turn,scenario:findScenarioById(GM.sid)||{name:''},saveName:GM.saveName,date:new Date().toISOString()};}
      await window.tianming.autoSave(saveData);
      // 同时写localStorage兜底
      try{localStorage.setItem("tm_P",JSON.stringify(P));}catch(e2){}
    }catch(e){ console.warn("[catch] 静默异常:", e.message || e); }
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
            try { fullLoadGame(r.data); }
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
if(!window.tianming||!window.tianming.isDesktop){
  // timer-leak-ok·文件顶层一次性·浏览器端生命周期
  setInterval(function(){ try{saveP();}catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-audio-theme');}catch(_){}} },120000);
}
// 页面关闭/刷新时紧急保存P
window.addEventListener('beforeunload',function(){
  try{localStorage.setItem("tm_P",JSON.stringify(P));}catch(e){}
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

