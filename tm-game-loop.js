// @ts-check
/// <reference path="types.d.ts" />
// ── 章节导航（grep 小节标题跳转，行号会漂）──
//   游戏运行时生命周期（R111 从 tm-game-engine.js 拆出·姊妹 tm-launch.js / tm-player-actions.js）
//   §1 进入游戏   enterGame · startGame（注：startGame 被 tm-patches.js 覆盖）
//   §2 校验       剧本完整性校验（游戏开始前自动执行）
//   §3 外交       派遣使臣谈判（5.4）· 制度改革走变量系统（5.6）
//   §4 面板       朝政中心（2.5）· 角色交互快捷面板（2.2）
//   §5 问天       玩家与推演 AI 的元通信通道 · 移动导航 · _lookupCharDossier
// ─────────────────────────────────────────────
// ============================================================
//  tm-game-loop.js — 游戏运行时生命周期（R111 从 tm-game-engine.js L7014-end 拆出）
//  姊妹文件: tm-launch.js (L1-1140) + tm-player-actions.js (L1141-7013)
//  包含: enterGame·startGame·剧本校验·登基/外交/问天/诏政·移动导航
// ============================================================

// 进入游戏
function enterGame(){
  _$("E").style.display="none";
  _$("G").style.display="grid";

  // 为所有实体添加响应式属性
  makeEntitiesReactive();

  // 官职公库：从 publicTreasuryInit 初始化 live publicTreasury（首回合/存档加载）
  try {
    if (GM.officeTree) {
      _initOfficePublicTreasury(GM.officeTree);
      if (GM.turn === 1) console.log('[enterGame] 官职公库初始化完成');
    }
  } catch(_opE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_opE, 'enterGame] 官职公库初始化失败') : console.warn('[enterGame] 官职公库初始化失败', _opE); }

  // 角色私产：按 wealth 字符串+品级推算填入 resources.privateWealth
  try {
    _initCharacterPrivateWealth(GM.chars || []);
    if (GM.turn === 1) console.log('[enterGame] 角色私产初始化完成');
  } catch(_pwE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_pwE, 'enterGame] 角色私产初始化失败') : console.warn('[enterGame] 角色私产初始化失败', _pwE); }

  // 角色公库镜像：按 officialTitle 绑定到官职·读其 publicTreasury.money.stock
  try {
    var _cEng = (typeof CharEconEngine !== 'undefined') ? CharEconEngine : null;
    if (_cEng && typeof _cEng.updatePublicTreasuryMirror === 'function' && GM.chars) {
      GM.chars.forEach(function(ch){
        if (!ch || ch.alive === false) return;
        try { _cEng.ensureCharResources(ch); } catch(_eR){ if (window.TM && TM.errors && TM.errors.capture) TM.errors.capture(_eR, 'enterGame.ensureCharResources'); }
        try { _cEng.updatePublicTreasuryMirror(ch); } catch(_eM){ if (window.TM && TM.errors && TM.errors.capture) TM.errors.capture(_eM, 'enterGame.updatePublicTreasuryMirror'); }
      });
      if (GM.turn === 1) console.log('[enterGame] 角色公库镜像刷新完成');
    }
  } catch(_mpE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_mpE, 'enterGame] 角色公库镜像失败') : console.warn('[enterGame] 角色公库镜像失败', _mpE); }

  // 首次进入游戏（turn=1 且未初始化过腐败预设）→ 按朝代预设初始化腐败
  try {
    if (GM.turn === 1 && !GM._corruptionPresetDone && typeof CorruptionEngine !== 'undefined') {
      var sc = typeof findScenarioById === 'function' ? findScenarioById(GM.sid) : null;
      var dynasty = (sc && (sc.dynasty || sc.era)) || (GM.eraState && GM.eraState.dynasty) || '';
      var phase = (GM.eraState && GM.eraState.dynastyPhase) || 'peak';
      // 第三参数：剧本覆盖（若剧本含 sc.corruption 字段则部分覆盖预设）
      var r = CorruptionEngine.initFromDynasty(dynasty, phase, sc || {});
      GM._corruptionPresetDone = true;
      console.log('[corruption] 初始化：', r);
    }
  } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'enterGame] 腐败朝代预设失败:') : console.error('[enterGame] 腐败朝代预设失败:', e); }

  // 帑廪朝代预设
  try {
    if (GM.turn === 1 && !GM._guokuPresetDone && typeof GuokuEngine !== 'undefined') {
      var sc2 = typeof findScenarioById === 'function' ? findScenarioById(GM.sid) : null;
      var dyn = (sc2 && (sc2.dynasty || sc2.era)) || (GM.eraState && GM.eraState.dynasty) || '';
      var ph = (GM.eraState && GM.eraState.dynastyPhase) || 'peak';
      var gr = GuokuEngine.initFromDynasty(dyn, ph, sc2 || {});
      GM._guokuPresetDone = true;
      console.log('[guoku] 初始化：', gr);
    }
  } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'enterGame] 帑廪朝代预设失败:') : console.error('[enterGame] 帑廪朝代预设失败:', e); }

  // 武库/原料库朝代预设(军备/原料·从剧本 guoku.armory/materials 装初值·一次性·_armorySeeded 守·亦补老存档:不限 turn1·载入即 seed 一次)
  try {
    if (typeof window !== 'undefined' && window.TMArmory && !(GM.guoku && GM.guoku._armorySeeded)) {
      var scA = (typeof findScenarioById === 'function' && findScenarioById(GM.sid)) || null;
      window.TMArmory.seedFromScenario(GM, (scA && scA.guoku) || {});
    }
  } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'enterGame] 武库预设失败:') : console.error('[enterGame] 武库预设失败:', e); }

  // 内帑朝代预设（依赖帑廪先完成）
  try {
    if (GM.turn === 1 && !GM._neitangPresetDone && typeof NeitangEngine !== 'undefined') {
      var sc3 = typeof findScenarioById === 'function' ? findScenarioById(GM.sid) : null;
      var dyn3 = (sc3 && (sc3.dynasty || sc3.era)) || (GM.eraState && GM.eraState.dynasty) || '';
      var ph3 = (GM.eraState && GM.eraState.dynastyPhase) || 'peak';
      var nr = NeitangEngine.initFromDynasty(dyn3, ph3, sc3 || {});
      GM._neitangPresetDone = true;
      console.log('[neitang] 初始化：', nr);
    }
  } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'enterGame] 内帑朝代预设失败:') : console.error('[enterGame] 内帑朝代预设失败:', e); }

  // 经济基础项初始化（行政区划上 economyBase 7 字段 + 5 boolean tag）
  try {
    if (GM.adminHierarchy && typeof CascadeTax !== 'undefined' && typeof CascadeTax._ensureEconomyBase === 'function') {
      var _ebCount = 0;
      Object.keys(GM.adminHierarchy).forEach(function(fk) {
        var tree = GM.adminHierarchy[fk];
        function _walkEB(divs) {
          if (!Array.isArray(divs)) return;
          divs.forEach(function(d) {
            if (!d) return;
            CascadeTax._ensureEconomyBase(d);
            _ebCount++;
            if (d.children) _walkEB(d.children);
            if (d.divisions) _walkEB(d.divisions);
          });
        }
        _walkEB((tree && tree.divisions) || []);
      });
      if (GM.turn === 1) console.log('[enterGame] economyBase 初始化 ' + _ebCount + ' 个 division');
    }
  } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'enterGame] economyBase 初始化失败:') : console.error('[enterGame] economyBase 初始化失败:', e); }

  // ★ 首回合预跑 CascadeTax + FixedExpense 以填充岁入岁出初值
  // 否则首回合 UI 显示 GuokuEngine.initFromDynasty 的 80000×mult 旧公式·新校准速率不生效
  try {
    if (GM.turn === 1 && !GM._cascadePreviewDone && typeof CascadeTax !== 'undefined' && typeof CascadeTax.collect === 'function') {
      var _ctR = CascadeTax.collect();
      GM._cascadePreviewDone = true;
      if (_ctR && _ctR.ok) {
        console.log('[enterGame] CascadeTax 预跑完成·中央年化银 ' +
          Math.round((GM.guoku.annualIncome||0)/10000) + ' 万两·粮 ' +
          Math.round((GM.guoku.annualGrainIncome||0)/10000) + ' 万石');
      } else {
        console.warn('[enterGame] CascadeTax 预跑失败:', _ctR && _ctR.reason);
      }
    }
  } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'enterGame] CascadeTax 预跑失败:') : console.error('[enterGame] CascadeTax 预跑失败:', e); }

  // 同样首回合预跑 FixedExpense.preview·只算不扣·让 turnExpense/monthlyExpense 显示新校准
  try {
    if (GM.turn === 1 && !GM._fixedExpensePreviewDone && typeof FixedExpense !== 'undefined' && typeof FixedExpense.preview === 'function') {
      var _fp = FixedExpense.preview();
      GM._fixedExpensePreviewDone = true;
      if (_fp) {
        // 同步到 GM.guoku 显示字段·preview 不扣账·只填 monthly/turn 数值
        if (GM.guoku) {
          GM.guoku.monthlyExpense = Math.round(_fp.totalMoney || 0);
          GM.guoku.turnExpense = Math.round(_fp.totalMoney || 0);
          GM.guoku.turnGrainExpense = Math.round(_fp.totalGrain || 0);
          GM.guoku.turnClothExpense = Math.round(_fp.totalCloth || 0);
          GM.guoku.annualExpense = Math.round((_fp.totalMoney || 0) * 12);
        }
        GM._lastFixedExpense = _fp;
        console.log('[enterGame] FixedExpense.preview 完成(只算不扣)·本回合支出: 银 ' +
          Math.round((_fp.totalMoney||0)/10000) + ' 万 · 粮 ' +
          Math.round((_fp.totalGrain||0)/10000) + ' 万石 · 布 ' +
          Math.round((_fp.totalCloth||0)/10000) + ' 万匹');
        if (_fp.salary) console.log('  俸禄: 银 ' + Math.round((_fp.salary.money||0)/10000) + ' 万 · 米 ' + Math.round((_fp.salary.grain||0)/10000) + ' 万石');
        if (_fp.royal) console.log('  宗禄: 银 ' + Math.round((_fp.royal.money||0)/10000) + ' 万 · 米 ' + Math.round((_fp.royal.grain||0)/10000) + ' 万石');
        if (_fp.army) console.log('  军饷: 银 ' + Math.round((_fp.army.money||0)/10000) + ' 万 · 粮 ' + Math.round((_fp.army.grain||0)/10000) + ' 万石');
        if (_fp.imperial) console.log('  宫廷: 银 ' + Math.round((_fp.imperial.money||0)/10000) + ' 万');
      }
    }
  } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'enterGame] FixedExpense.preview 失败:') : console.error('[enterGame] FixedExpense.preview 失败:', e); }

  // 剧本历史人物加载（若剧本指定了 historicalChars）
  try {
    if (GM.turn === 1 && !GM._historicalCharsLoaded && typeof loadHistoricalCharsFromScenario === 'function') {
      var sc4 = typeof findScenarioById === 'function' ? findScenarioById(GM.sid) : null;
      if (sc4 && sc4.historicalChars) {
        var loaded = loadHistoricalCharsFromScenario(sc4);
        console.log('[historical] 已加载 ' + loaded + ' 位历史人物');
      }
      GM._historicalCharsLoaded = true;
    }
  } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'enterGame] 历史人物加载失败:') : console.error('[enterGame] 历史人物加载失败:', e); }

  // 统一角色字段补齐（字/性别/家族成员/仕途/内心等 UI 所需字段）
  try {
    if (typeof CharFullSchema !== 'undefined' && typeof CharFullSchema.ensureAll === 'function') {
      var _filled = CharFullSchema.ensureAll(GM.chars);
      if (GM.turn === 1) console.log('[CharFullSchema] 初始化 ' + _filled + ' 位角色完整字段');
    }
  } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'enterGame] CharFullSchema 失败:') : console.error('[enterGame] CharFullSchema 失败:', e); }

  // 货币系统初始化（币种/本位制/铸币机构/纸币预设/市场）
  try {
    if (typeof CurrencyEngine !== 'undefined' && typeof CurrencyEngine.init === 'function') {
      var _sc5 = typeof findScenarioById === 'function' ? findScenarioById(GM.sid) : null;
      CurrencyEngine.init(_sc5);
      if (GM.turn === 1) console.log('[CurrencyEngine] 初始化 朝代=' + (GM.currency && GM.currency.dynasty));
    }
  } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'enterGame] CurrencyEngine 失败:') : console.error('[enterGame] CurrencyEngine 失败:', e); }

  // 央地财政初始化（分层/分账预设/合规/监察）
  try {
    if (typeof CentralLocalEngine !== 'undefined' && typeof CentralLocalEngine.init === 'function') {
      var _sc6 = typeof findScenarioById === 'function' ? findScenarioById(GM.sid) : null;
      CentralLocalEngine.init(_sc6);
      if (GM.turn === 1) console.log('[CentralLocalEngine] 初始化 预设=' + (GM.fiscal && GM.fiscal._currentPreset));
    }
  } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'enterGame] CentralLocalEngine 失败:') : console.error('[enterGame] CentralLocalEngine 失败:', e); }

  // 经济补完模块（19 税种/四层/封建 5 类/土地兼并/借贷/口碑/廷议/强征/购买力传播）
  try {
    if (typeof EconomyGapFill !== 'undefined' && typeof EconomyGapFill.init === 'function') {
      EconomyGapFill.init();
      // 四层自适应递归
      var _sc7 = typeof findScenarioById === 'function' ? findScenarioById(GM.sid) : null;
      EconomyGapFill.buildHierarchyFromAdminDepth(_sc7);
      if (GM.turn === 1) console.log('[EconomyGapFill] 补完模块就绪（12 项）');
    }
  } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'enterGame] EconomyGapFill 失败:') : console.error('[enterGame] EconomyGapFill 失败:', e); }

  // 户口系统初始化（户/口/丁 + 色目户 + 徭役 + 兵役 + 人口动态）
  try {
    if (typeof HujiEngine !== 'undefined' && typeof HujiEngine.init === 'function') {
      var _sc8 = typeof findScenarioById === 'function' ? findScenarioById(GM.sid) : null;
      // 诊断：打印剧本 populationConfig 是否存在及 nationalMouths
      if (GM.turn === 1) {
        var _pc8 = _sc8 && _sc8.populationConfig;
        console.log('[HujiEngine] sc.populationConfig:', _pc8 ? '存在' : '缺失',
          _pc8 && _pc8.initial ? ('initial.nationalMouths=' + _pc8.initial.nationalMouths) : '(无 initial)');
      }
      HujiEngine.init(_sc8);
      if (GM.turn === 1) console.log('[HujiEngine] 初始化后 GM.population.national:', GM.population && GM.population.national);
    }
  } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'enterGame] HujiEngine 失败:') : console.error('[enterGame] HujiEngine 失败:', e); }

  // 环境承载力初始化（五维承载/疤痕/过载/危机/技术阶梯）
  try {
    if (typeof EnvCapacityEngine !== 'undefined' && typeof EnvCapacityEngine.init === 'function') {
      var _sc9 = typeof findScenarioById === 'function' ? findScenarioById(GM.sid) : null;
      EnvCapacityEngine.init(_sc9);
      if (GM.turn === 1) console.log('[EnvCapacityEngine] 初始化 技术朝代=' + (GM.environment && GM.environment.techEra));
    }
  } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'enterGame] EnvCapacityEngine 失败:') : console.error('[enterGame] EnvCapacityEngine 失败:', e); }

  // 户口深化（阶层系统/A6-A8/C2-C10/D2-D6/F30 核心）
  try {
    if (typeof HujiDeepFill !== 'undefined' && typeof HujiDeepFill.init === 'function') {
      HujiDeepFill.init();
      if (GM.turn === 1) console.log('[HujiDeepFill] 深化模块就绪（阶层+封建+F30）');
    }
  } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'enterGame] HujiDeepFill 失败:') : console.error('[enterGame] HujiDeepFill 失败:', e); }

  // 诏令补完（P1 + 反向触发 + 自动路由 + Help UI）
  try {
    if (typeof EdictComplete !== 'undefined' && typeof EdictComplete.init === 'function') {
      EdictComplete.init();
      if (GM.turn === 1) console.log('[EdictComplete] 诏令补完就绪（P1+11 反向触发）');
    }
  } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'enterGame] EdictComplete 失败:') : console.error('[enterGame] EdictComplete 失败:', e); }

  // 环境恢复政策 + §9 全联动
  try {
    if (typeof EnvRecoveryFill !== 'undefined' && typeof EnvRecoveryFill.init === 'function') {
      EnvRecoveryFill.init();
    }
  } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'enterGame] EnvRecoveryFill 失败:') : console.error('[enterGame] EnvRecoveryFill 失败:', e); }

  // 皇威/皇权/民心 三系统 + 7×6 变量联动
  try {
    if (typeof AuthorityEngines !== 'undefined' && typeof AuthorityEngines.init === 'function') {
      AuthorityEngines.init();
      if (GM.turn === 1) console.log('[AuthorityEngines] 皇威/皇权/民心 + 联动矩阵就绪');
    }
  } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'enterGame] AuthorityEngines 失败:') : console.error('[enterGame] AuthorityEngines 失败:', e); }

  // 权力系统补完（权臣/民变5级/暴君症状/失威危机/天象/四象限/联动全）
  try {
    if (typeof AuthorityComplete !== 'undefined' && typeof AuthorityComplete.init === 'function') {
      AuthorityComplete.init();
      if (GM.turn === 1) console.log('[AuthorityComplete] 补完就绪（16 项 P0+P1+P2）');
    }
  } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'enterGame] AuthorityComplete 失败:') : console.error('[enterGame] AuthorityComplete 失败:', e); }

  // 历史预设库（25 徭役 / 9 迁徙 / 7 兵制 / 8 阶层 / 65 诏令 / 30 典范 / 12 抗疏）
  try {
    if (typeof HistoricalPresets !== 'undefined' && typeof HistoricalPresets.init === 'function') {
      HistoricalPresets.init();
      if (GM.turn === 1) console.log('[HistoricalPresets] 历史数据库就绪');
    }
  } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'enterGame] HistoricalPresets 失败:') : console.error('[enterGame] HistoricalPresets 失败:', e); }

  // C/D/B/A/E/F 阶段补丁 init
  try {
    // scriptData 在此作用域解析：优先取当前剧本对象；否则取 window.scriptData；都无则空对象
    var scriptData = (typeof findScenarioById === 'function' && GM.sid) ? findScenarioById(GM.sid) : null;
    if (!scriptData) scriptData = (typeof window !== 'undefined' && window.scriptData) ? window.scriptData : {};
    if (typeof PhaseC !== 'undefined' && typeof PhaseC.init === 'function') PhaseC.init();
    if (typeof PhaseD !== 'undefined' && typeof PhaseD.init === 'function') PhaseD.init();
    if (typeof PhaseB !== 'undefined' && typeof PhaseB.init === 'function') PhaseB.init(scriptData);
    if (typeof PhaseA !== 'undefined' && typeof PhaseA.init === 'function') PhaseA.init(scriptData);
    if (typeof PhaseE !== 'undefined' && typeof PhaseE.init === 'function') PhaseE.init();
    if (typeof PhaseF1 !== 'undefined' && typeof PhaseF1.init === 'function') PhaseF1.init();
    if (typeof PhaseF2 !== 'undefined' && typeof PhaseF2.init === 'function') PhaseF2.init();
    if (typeof PhaseF3 !== 'undefined' && typeof PhaseF3.init === 'function') PhaseF3.init(scriptData);
    if (typeof PhaseF4 !== 'undefined' && typeof PhaseF4.init === 'function') PhaseF4.init();
    if (typeof PhaseF5 !== 'undefined' && typeof PhaseF5.init === 'function') PhaseF5.init();
    if (typeof PhaseF6 !== 'undefined' && typeof PhaseF6.init === 'function') PhaseF6.init();
    if (typeof PhaseG1 !== 'undefined' && typeof PhaseG1.init === 'function') PhaseG1.init();
    if (typeof PhaseG2 !== 'undefined' && typeof PhaseG2.init === 'function') PhaseG2.init(scriptData);
    if (typeof PhaseG3 !== 'undefined' && typeof PhaseG3.init === 'function') PhaseG3.init();
    if (typeof PhaseG4 !== 'undefined' && typeof PhaseG4.init === 'function') PhaseG4.init(scriptData);
    // 原 PhaseH.init 拆为 enableTaxesByDynasty + _ensureRegionFiscal (R10 collapse·delete tm-tax-atomic.js)
    if (typeof FiscalEngine !== 'undefined' && typeof FiscalEngine.enableTaxesByDynasty === 'function') FiscalEngine.enableTaxesByDynasty(GM);
    if (typeof FiscalEngine !== 'undefined' && typeof FiscalEngine._ensureRegionFiscal === 'function' && GM.regions && GM.regions.forEach) {
      GM.regions.forEach(function(r) { FiscalEngine._ensureRegionFiscal(r); });
    }
    // 融合桥接：行政区划 ↔ 七变量
    if (typeof IntegrationBridge !== 'undefined' && typeof IntegrationBridge.init === 'function') IntegrationBridge.init();
    // 帑廪/内帑 三账初始化（若剧本未配置则 ensureGuokuModel 给默认）
    if (typeof GuokuEngine !== 'undefined' && typeof GuokuEngine.ensureModel === 'function') GuokuEngine.ensureModel();
    if (typeof NeitangEngine !== 'undefined' && typeof NeitangEngine.ensureModel === 'function') NeitangEngine.ensureModel();
    // 首回合立即跑一次税收级联 + 聚合，这样 UI 启动时不会显示 0
    if (GM.turn === 1) {
      console.log('[enterGame-T1] GM.adminHierarchy 结构:',
        GM.adminHierarchy ? ('键=' + Object.keys(GM.adminHierarchy).join(',') +
          '·player.divisions 长度=' + (GM.adminHierarchy.player && GM.adminHierarchy.player.divisions ? GM.adminHierarchy.player.divisions.length : '(无 player.divisions)')) : '(空)');
    }
    if (typeof CascadeTax !== 'undefined' && typeof CascadeTax.collect === 'function') {
      try { CascadeTax.collect(); } catch(_ctInitE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_ctInitE, 'enterGame] CascadeTax.collect init') : console.warn('[enterGame] CascadeTax.collect init', _ctInitE); }
    }
    // 固定支出：俸禄+军饷+宫廷（endTurn 本来每回合跑·此处补首回合）
    if (typeof FixedExpense !== 'undefined' && typeof FixedExpense.collect === 'function') {
      try {
        var _feR = FixedExpense.collect();
        if (GM.turn === 1) console.log('[enterGame-T1] FixedExpense 首回合结算:', _feR && _feR.turnExpense);
      } catch(_feInitE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_feInitE, 'enterGame] FixedExpense.collect init') : console.warn('[enterGame] FixedExpense.collect init', _feInitE); }
    }
    if (typeof IntegrationBridge !== 'undefined' && typeof IntegrationBridge.aggregateRegionsToVariables === 'function') {
      try { IntegrationBridge.aggregateRegionsToVariables(); } catch(_agInitE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_agInitE, 'enterGame] bridge aggregate init') : console.warn('[enterGame] bridge aggregate init', _agInitE); }
    }
    if (GM.turn === 1) {
      console.log('[enterGame-T1] 聚合后 GM.population.national:', GM.population && GM.population.national);
    }

  } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'enterGame] Phase 补丁 init 失败:') : console.error('[enterGame] Phase 补丁 init 失败:', e); }

  // 兜底：Phase init 无论成败，都再做一次户口检查
  // 若 national.mouths 明显偏低（< 剧本初始 1/2），直接从剧本 populationConfig 强制写入
  try {
    var _scFb = (typeof findScenarioById === 'function' && GM.sid) ? findScenarioById(GM.sid) : null;
    var _scPopFb = _scFb && _scFb.populationConfig && _scFb.populationConfig.initial;
    if (GM.turn === 1 && _scPopFb) {
      console.log('[enterGame-兜底] 剧本 populationConfig.initial:', _scPopFb);
      console.log('[enterGame-兜底] 当前 GM.population.national:', GM.population && GM.population.national);
    }
    if (_scPopFb && _scPopFb.nationalMouths) {
      var _curM = (GM.population && GM.population.national && GM.population.national.mouths) || 0;
      if (_curM < _scPopFb.nationalMouths * 0.5) {
        if (!GM.population) GM.population = {};
        if (!GM.population.national) GM.population.national = {};
        GM.population.national.mouths = _scPopFb.nationalMouths;
        GM.population.national.households = _scPopFb.nationalHouseholds || Math.floor(_scPopFb.nationalMouths / 5.2);
        GM.population.national.ding = _scPopFb.nationalDing || Math.floor(_scPopFb.nationalMouths * 0.26);
        GM.population.fugitives = _scPopFb.nationalFugitives || 0;
        GM.population.hiddenCount = _scPopFb.hiddenPopulation || 0;
        console.warn('[enterGame] 户口聚合异常·从剧本初值兜底：mouths=' + _scPopFb.nationalMouths
          + ' (原 ' + _curM + ')');
      } else if (GM.turn === 1) {
        console.log('[enterGame-兜底] 户口正常·无需兜底 (当前 ' + _curM + ' >= 剧本 ' + _scPopFb.nationalMouths * 0.5 + ')');
      }
    } else if (GM.turn === 1) {
      console.warn('[enterGame-兜底] 剧本无 populationConfig.initial.nationalMouths·跳过兜底');
    }
  } catch(_popFbE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_popFbE, 'enterGame] 户口兜底失败') : console.warn('[enterGame] 户口兜底失败', _popFbE); }

  try {
    if (TM && TM.ClassEngine && typeof TM.ClassEngine.bootstrap === 'function') {
      TM.ClassEngine.bootstrap(GM, { turn: GM.turn, source: 'enterGame' });
    }
  } catch(_classBootE) {
    (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_classBootE, 'enterGame] 阶层桥接初始化失败') : console.warn('[enterGame] 阶层桥接初始化失败', _classBootE);
  }

  try {
    if (TM && TM.InfluenceGroups && typeof TM.InfluenceGroups.bootstrap === 'function') {
      TM.InfluenceGroups.bootstrap(GM, { turn: GM.turn, source: 'enterGame' });
    }
  } catch(_igBootE) {
    (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_igBootE, 'enterGame] influence group bootstrap failed') : console.warn('[enterGame] influence group bootstrap failed', _igBootE);
  }

  try {
    if (TM && TM.InfluenceGroups && typeof TM.InfluenceGroups.buildRegentSignal === 'function') {
      GM.regentSignal = TM.InfluenceGroups.buildRegentSignal(GM);
      GM.regentState = GM.regentState || {};
      GM.regentState.signal = GM.regentSignal;
      GM.regentState.active = !!(GM.regentSignal && GM.regentSignal.active);
      GM.regentState.hardCeiling = !!(GM.regentSignal && GM.regentSignal.hardCeiling);
      GM.regentState.lastCheckTurn = GM.turn || 0;
    }
  } catch(_regentBootE) {
    (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_regentBootE, 'enterGame] regent signal bootstrap failed') : console.warn('[enterGame] regent signal bootstrap failed', _regentBootE);
  }

  _tmRefreshFactionDerivedRuntime('enterGame');

  renderGameState();

  // 时局概览（Turn 1专属）
  if (GM.turn === 1) _showSituationOverview();

  // 触发钩子，各模块在此注入标签页/按钮
  GameHooks.run('enterGame:after');

  // 结束载入进度条（startGame/loadSave 入口若有 showLoading·此时关闭）
  if (typeof hideLoading === 'function') hideLoading();
}

function _tmRefreshFactionDerivedRuntime(source){
  try {
    if (window.TM && TM.FactionIndex && TM.FactionIndex.rebuild) {
      TM.FactionIndex.rebuild();
      if (GM && GM.turn === 1 && GM._facIndex) {
        console.log('[startGame] _facIndex 构建完成·势力数=' + Object.keys(GM._facIndex).length + ' · source=' + (source || 'runtime'));
      }
    }
  } catch(_fxE) {
    try { console.warn('[startGame] _facIndex 构建失败', _fxE); } catch(_) {}
  }
  try {
    if (window.TM && TM.FactionDerived && TM.FactionDerived.compute) {
      TM.FactionDerived.compute();
    }
  } catch(_dhE) {
    try { console.warn('[startGame] derivedHealth 计算失败', _dhE); } catch(_) {}
  }
  try {
    if (window.TM) {
      if (TM.FactionDerivedEconomy && TM.FactionDerivedEconomy.compute) TM.FactionDerivedEconomy.compute();
      if (TM.FactionDerivedCohesion && TM.FactionDerivedCohesion.compute) TM.FactionDerivedCohesion.compute();
      if (TM.FactionDerivedStrength && TM.FactionDerivedStrength.compute) TM.FactionDerivedStrength.compute();
    }
  } catch(_dxE) {
    try { console.warn('[startGame] derivedEconomy/Cohesion/Strength 计算失败', _dxE); } catch(_) {}
  }
}

// 时局概览面板（开局展示天下大势）
function _showSituationOverview() {
  var h = '<div style="position:fixed;inset:0;z-index:1100;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;" id="_situationModal" onclick="if(event.target===this)this.remove();">';
  h += '<div style="max-width:600px;width:90%;max-height:80vh;overflow-y:auto;background:var(--bg-2);border:2px solid var(--gold);border-radius:12px;padding:2rem;" onclick="event.stopPropagation();">';
  h += '<div style="text-align:center;font-size:1.4rem;font-weight:700;color:var(--gold);letter-spacing:0.15em;margin-bottom:1rem;">\u5929\u4E0B\u5927\u52BF</div>';

  // 势力格局
  if (GM.facs && GM.facs.length > 0) {
    h += '<div style="margin-bottom:1rem;"><div style="font-size:0.8rem;color:var(--gold);font-weight:700;margin-bottom:0.5rem;">\u52BF\u529B\u683C\u5C40</div>';
    GM.facs.forEach(function(f) {
      var isPlayer = f.isPlayer ? ' \u2605' : '';
      h += '<div style="font-size:0.78rem;color:var(--txt-s);padding:3px 0;">' + f.name + isPlayer + ' \u2014 \u5B9E\u529B' + (f.strength||50) + (f.leader ? ' \u9996\u9886:' + f.leader : '') + '</div>';
    });
    h += '</div>';
  }

  // 显著矛盾
  if (P.playerInfo && P.playerInfo.coreContradictions && P.playerInfo.coreContradictions.length > 0) {
    var dimC = {political:'#6366f1',economic:'#f59e0b',military:'#ef4444',social:'#10b981'};
    h += '<div style="margin-bottom:1rem;"><div style="font-size:0.8rem;color:#a885d5;font-weight:700;margin-bottom:0.5rem;">\u26A1 \u5F53\u524D\u77DB\u76FE</div>';
    P.playerInfo.coreContradictions.forEach(function(c) {
      h += '<div style="font-size:0.78rem;color:var(--txt-s);padding:3px 0;border-left:3px solid ' + (dimC[c.dimension]||'#888') + ';padding-left:8px;">' + c.title + (c.parties ? ' (' + c.parties + ')' : '') + '</div>';
    });
    h += '</div>';
  }

  // 玩家处境
  var pi = P.playerInfo || {};
  if (pi.characterName) {
    h += '<div style="padding:0.8rem;background:rgba(120,81,169,0.1);border-radius:8px;margin-bottom:1rem;">';
    h += '<div style="font-size:0.8rem;color:#a885d5;font-weight:700;margin-bottom:0.3rem;">\u4F60\u7684\u5904\u5883</div>';
    h += '<div style="font-size:0.82rem;color:var(--txt-s);">' + pi.characterName + (pi.characterTitle ? '(' + pi.characterTitle + ')' : '') + '\uFF0C' + (pi.factionName || '') + '</div>';
    if (pi.factionGoal) h += '<div style="font-size:0.75rem;color:var(--txt-d);margin-top:3px;">\u76EE\u6807\uFF1A' + pi.factionGoal + '</div>';
    h += '</div>';
  }

  h += '<div style="text-align:center;"><button class="bt bp" onclick="document.getElementById(\'_situationModal\').remove();" style="padding:10px 40px;font-size:0.95rem;">\u5F00\u59CB\u6CBB\u56FD</button></div>';
  h += '</div></div>';
  document.body.insertAdjacentHTML('beforeend', h);
}

// ============================================================
// 剧本完整性校验（游戏开始前自动执行）
// ============================================================
function validateScenario(sc) {
  if (!sc) return { valid: false, errors: ['剧本不存在'], warnings: [] };
  var errors = [], warnings = [];

  // 必填字段
  if (!sc.name) errors.push('剧本缺少名称');
  if (!sc.era && !sc.dynasty) warnings.push('未设定朝代/时代');

  // 角色校验
  var chars = sc.characters || P.characters || [];
  if (chars.length === 0) warnings.push('无角色数据，AI将自行生成');
  var charNames = {};
  chars.forEach(function(c, i) {
    if (!c.name) errors.push('角色#' + (i+1) + '缺少名称');
    else if (charNames[c.name]) warnings.push('角色名重复: ' + c.name);
    else charNames[c.name] = true;
    // 数值范围检查
    if (c.loyalty !== undefined && (c.loyalty < 0 || c.loyalty > 100)) {
      c.loyalty = clamp(c.loyalty, 0, 100);
      warnings.push(c.name + '的忠诚度已修正到0-100范围');
    }
  });

  // 势力校验
  var facs = sc.factions || P.factions || [];
  var facNames = {};
  facs.forEach(function(f) {
    if (f.name) facNames[f.name] = true;
  });
  // 角色引用的势力是否存在
  chars.forEach(function(c) {
    if (c.faction && facs.length > 0 && !facNames[c.faction]) {
      warnings.push(c.name + '所属势力"' + c.faction + '"不存在');
    }
  });

  // 变量校验
  var vars = sc.variables || P.variables || [];
  if (Array.isArray(vars)) {
    vars.forEach(function(v) {
      if (!v.name) warnings.push('发现无名变量');
      if (v.min !== undefined && v.max !== undefined && v.min > v.max) {
        warnings.push('变量"' + v.name + '"的最小值大于最大值');
      }
    });
  }

  // 时间校验
  if (!sc.time && !P.time.year) warnings.push('未设定起始年份');

  // 关系校验
  var rels = sc.relations || P.relations || [];
  if (Array.isArray(rels)) {
    rels.forEach(function(r) {
      if (r.from && chars.length > 0 && !charNames[r.from]) warnings.push('关系引用不存在的角色: ' + r.from);
      if (r.to && chars.length > 0 && !charNames[r.to]) warnings.push('关系引用不存在的角色: ' + r.to);
    });
  }

  // 玩家信息跨系统校验
  var pi = sc.playerInfo || {};
  if (pi.factionName && facs.length > 0 && !facNames[pi.factionName]) {
    warnings.push('\u73A9\u5BB6\u52BF\u529B"' + pi.factionName + '"\u4E0D\u5728\u52BF\u529B\u5217\u8868\u4E2D\uFF0C\u5C06\u81EA\u52A8\u521B\u5EFA');
  }
  if (pi.characterName && chars.length > 0 && !charNames[pi.characterName]) {
    warnings.push('\u73A9\u5BB6\u89D2\u8272"' + pi.characterName + '"\u4E0D\u5728\u89D2\u8272\u5217\u8868\u4E2D\uFF0C\u5C06\u81EA\u52A8\u521B\u5EFA');
  }

  // 官制校验
  var gov = sc.government || {};
  if (gov.nodes && gov.nodes.length > 0) {
    (function _chkGov(nodes) {
      nodes.forEach(function(n) {
        if (n.positions) n.positions.forEach(function(p) {
          if (p.holder && chars.length > 0 && !charNames[p.holder]) {
            warnings.push('\u5B98\u5236"' + n.name + '-' + p.name + '"\u4EFB\u804C\u8005"' + p.holder + '"\u4E0D\u5728\u89D2\u8272\u5217\u8868\u4E2D');
          }
        });
        if (n.subs) _chkGov(n.subs);
      });
    })(gov.nodes);
  }

  // 军事统帅校验
  if (sc.military && sc.military.initialTroops) {
    sc.military.initialTroops.forEach(function(t) {
      if (t.commander && chars.length > 0 && !charNames[t.commander]) {
        warnings.push('\u519B\u961F"' + t.name + '"\u7EDF\u5E05"' + t.commander + '"\u4E0D\u5728\u89D2\u8272\u5217\u8868\u4E2D');
      }
    });
  }

  return { valid: errors.length === 0, errors: errors, warnings: warnings };
}

// ============================================================
// ============================================================
// 5.4: 外交谈判——派遣使臣
// ============================================================

function openDiplomacyPanel() {
  // 可选使臣列表（存活的非玩家角色）
  var envoys = (GM.chars||[]).filter(function(c){return c.alive!==false && !c.isPlayer;});
  var envoyOptions = envoys.map(function(c){
    return '<option value="'+c.name.replace(/"/g,'&quot;')+'">'+escHtml(c.name)+' (\u5916\u4EA4'+Math.round(c.diplomacy||50)+' \u667A'+Math.round(c.intelligence||50)+')</option>';
  }).join('');

  var factionOptions = (GM.facs||[]).filter(function(f){
    return f.name !== (P.playerInfo&&P.playerInfo.factionName||'');
  }).map(function(f){
    return '<option value="'+escHtml(f.name)+'">'+escHtml(f.name)+'</option>';
  }).join('');

  var html = '<div style="padding:1rem;">';
  html += '<div style="font-size:1rem;font-weight:700;color:var(--color-primary);margin-bottom:0.8rem;">\u9063\u4F7F\u51FA\u4F7F</div>';
  html += '<div class="form-group"><label>\u76EE\u6807\u52BF\u529B</label><select id="diplo-target">'+factionOptions+'</select></div>';
  html += '<div class="form-group"><label>\u6307\u5B9A\u4F7F\u81E3</label><select id="diplo-envoy">'+envoyOptions+'</select></div>';
  html += '<div class="form-group"><label>\u8C08\u5224\u8981\u6C42</label><textarea id="diplo-terms" rows="3" style="width:100%;" placeholder="\u5982\uFF1A\u5272\u8BA9\u6CB3\u5317\u4E09\u9547\u3001\u6BCF\u5E74\u8FDB\u8D21\u5E1B\u4E09\u4E07\u5339\u3001\u548C\u4EB2\u516C\u4E3B..."></textarea></div>';
  html += '<div class="form-group"><label>\u5E95\u7EBF</label><textarea id="diplo-bottom" rows="2" style="width:100%;" placeholder="\u53EF\u63A5\u53D7\u7684\u6700\u4F4E\u6761\u4EF6\uFF08\u4F7F\u81E3\u4F4E\u4E8E\u6B64\u5E95\u7EBF\u4E0D\u53EF\u7B54\u5E94\uFF09"></textarea></div>';
  html += '<button class="bt bp" onclick="sendDiplomaticMission()" style="width:100%;margin-top:0.5rem;">\u9063\u4F7F\u51FA\u53D1</button>';
  html += '</div>';

  showTurnResult(html);
}

function sendDiplomaticMission() {
  var target = (document.getElementById('diplo-target')||{}).value;
  var envoyName = (document.getElementById('diplo-envoy')||{}).value;
  var terms = (document.getElementById('diplo-terms')||{}).value;
  var bottom = (document.getElementById('diplo-bottom')||{}).value;
  if (!target || !envoyName || !terms) { toast('\u8BF7\u586B\u5199\u5B8C\u6574\u4FE1\u606F'); return; }

  // 存入GM待处理外交任务
  if (!GM._diplomaticMissions) GM._diplomaticMissions = [];
  GM._diplomaticMissions.push({
    target: target,
    envoy: envoyName,
    terms: terms,
    bottomLine: bottom,
    sentTurn: GM.turn,
    status: 'traveling' // traveling → negotiating → result
  });

  closeTurnResult();
  toast(envoyName + '\u5DF2\u643A\u56FD\u4E66\u51FA\u53D1\u524D\u5F80' + target);
  if (typeof addEB === 'function') addEB('\u5916\u4EA4', '\u9063' + envoyName + '\u51FA\u4F7F' + target);
}

// ============================================================
// 5.6: 制度改革——通过变量系统运作
// 玩家可通过诏令发起改革（如"推行募兵制"），AI在resource_changes中
// 动态创建/推进改革进度变量（如"募兵制改革进度"），0→100代表过渡过程。
// 不需要独立的UI面板——改革是诏令的一种，由AI自行叙事和推进。
// ============================================================

// 2.5: 朝政中心面板
// ============================================================

function _renderZhaozhengCenter() {
  var _ti = typeof tmIcon === 'function' ? tmIcon : function(){return '';};

  // 检查各操作可用性
  function _canKeju() {
    if (!P.keju || !P.keju.enabled) return {ok:false,reason:'\u672A\u5F00\u542F\u79D1\u4E3E\u5236\u5EA6'};
    if (P.keju.currentExam) return {ok:false,reason:'\u79D1\u4E3E\u8FDB\u884C\u4E2D'};
    return {ok:true};
  }
  function _canChaoyi() {
    if (typeof startChaoyiSession !== 'function') return {ok:false,reason:'\u672A\u52A0\u8F7D\u671D\u8BAE\u6A21\u5757'};
    return {ok:true};
  }
  function _canProvince() {
    if (typeof openProvinceEconomy !== 'function') return {ok:false,reason:'\u672A\u52A0\u8F7D\u7701\u4EFD\u6A21\u5757'};
    if (!GM.provinceStats || Object.keys(GM.provinceStats).length === 0) return {ok:false,reason:'\u65E0\u7701\u4EFD\u6570\u636E'};
    return {ok:true};
  }
  function _canMap() {
    return (P.map && P.map.regions && P.map.regions.length > 0) ? {ok:true} : {ok:false,reason:'\u65E0\u5730\u56FE\u6570\u636E'};
  }
  function _hasTech() { return typeof renderTechTree === 'function' && P.techTree; }
  function _hasCivic() { return typeof renderCivicTree === 'function' && P.civicTree; }

  // 操作条目结构
  var groups = [
    { label: '\u5185\u653F', icon: 'office', color: 'var(--indigo-400)', items: [
      {label:'\u4E0B\u8BCF\u4EE4', sub:'\u653F\u4EE4/\u519B\u4EE4/\u5916\u4EA4/\u7ECF\u6D4E', action:'switchGTab(null,"gt-edict")', icon:'scroll', ok:true},
      {label:'\u79D1\u4E3E\u53D6\u58EB', sub:'\u5F00\u79D1\u53D6\u58EB', action:'openKejuPanel()', icon:'scroll', ok:_canKeju().ok, reason:_canKeju().reason},
      {label:'\u5730\u65B9\u533A\u5212', sub:'\u67E5\u770B\u5730\u65B9\u884C\u653F', action:'openProvinceEconomy()', icon:'treasury', ok:_canProvince().ok, reason:_canProvince().reason},
      {label:'\u5730\u65B9\u8206\u60C5', sub:'\u5404\u9053\u5DDE\u5E9C\u6C11\u60C5', action:'switchGTab(null,"gt-difang")', icon:'faction', ok:!!P.adminHierarchy, reason:P.adminHierarchy?'':'\u65E0\u884C\u653F\u533A\u5212'}
    ]},
    { label: '\u519B\u4E8B', icon: 'troops', color: 'var(--vermillion-400)', items: [
      {label:'\u519B\u4E8B\u8BCF\u4EE4', sub:'\u8C03\u5175\u9063\u5C06', action:'switchGTab(null,"gt-edict");var el=document.getElementById("edict-mil");if(el)el.focus()', icon:'troops', ok:true},
      {label:'\u5236\u5EA6\u6539\u9769', sub:'\u901A\u8FC7\u8BCF\u4EE4\u53D1\u8D77', action:'switchGTab(null,"gt-edict");var el=document.getElementById("edict-pol");if(el){el.focus();el.placeholder="\u5982\uFF1A\u63A8\u884C\u52DF\u5175\u5236/\u6539\u9769\u7A0E\u5236/\u5B9E\u884C\u79D1\u4E3E...";}', icon:'scroll', ok:true},
      {label:'\u5730\u56FE\u603B\u89C8', sub:'\u52BF\u529B\u5206\u5E03', action:'TM.Map.open("regions")', icon:'map', ok:_canMap().ok, reason:_canMap().reason}
    ]},
    { label: '\u4EBA\u4E8B', icon: 'person', color: 'var(--gold-400)', items: [
      {label:'\u5B98\u5236\u4EFB\u514D', sub:'\u67E5\u770B\u5B98\u5236\u6811', action:'switchGTab(null,"gt-office")', icon:'office', ok:true},
      {label:'\u4EBA\u7269\u5FD7', sub:'\u67E5\u770B\u5168\u90E8\u89D2\u8272', action:'switchGTab(null,"gt-renwu")', icon:'person', ok:true},
      {label:'\u95EE\u5BF9\u81E3\u5B50', sub:'\u4E0E\u89D2\u8272\u5BF9\u8BDD', action:'switchGTab(null,"gt-wendui")', icon:'dialogue', ok:true}
    ]},
    { label: '\u5916\u4EA4', icon: 'faction', color: 'var(--celadon-400)', items: [
      {label:'\u5916\u4EA4\u8BCF\u4EE4', sub:'\u9063\u4F7F/\u548C\u4EB2/\u7ED3\u76DF', action:'switchGTab(null,"gt-edict");var el=document.getElementById("edict-dip");if(el)el.focus()', icon:'scroll', ok:true},
      {label:'\u9063\u4F7F\u51FA\u4F7F', sub:'\u6D3E\u9063\u4F7F\u81E3\u8C08\u5224', action:'openDiplomacyPanel()', icon:'faction', ok:true},
      {label:'\u9E3F\u96C1\u4F20\u4E66', sub:'\u53D1\u9001\u5BC6\u4FE1', action:'switchGTab(null,"gt-letter")', icon:'scroll', ok:true}
    ]},
    { label: '\u53D1\u5C55', icon: 'policy', color: 'var(--amber-400,#f59e0b)', items: [
      {label:'\u79D1\u6280\u6811', sub:'\u519B\u4E8B/\u6C11\u7528\u79D1\u6280', action:'switchGTab(null,"gt-tech")', icon:'policy', ok:!!_hasTech(), reason:_hasTech()?'':'\u672A\u914D\u7F6E\u79D1\u6280\u6811'},
      {label:'\u6C11\u653F\u6811', sub:'\u57CE\u5E02/\u653F\u7B56', action:'switchGTab(null,"gt-civic")', icon:'policy', ok:!!_hasCivic(), reason:_hasCivic()?'':'\u672A\u914D\u7F6E\u6C11\u653F\u6811'},
      {label:'\u671D\u8BAE', sub:'\u53EC\u5F00\u5EF7\u8BAE', action:'startChaoyiSession()', icon:'dialogue', ok:_canChaoyi().ok, reason:_canChaoyi().reason}
    ]}
  ];

  var html = '<div style="text-align:center;margin-bottom:0.8rem;"><div style="font-size:var(--text-lg,1.1rem);font-weight:700;color:var(--color-primary);letter-spacing:0.15em;">\u3014 \u671D \u653F \u4E2D \u5FC3 \u3015</div>';
  html += '<div style="font-size:var(--text-xs);color:var(--color-foreground-muted);margin-top:0.2rem;">\u7B2C' + (GM.turn||1) + '\u56DE\u5408 \u00B7 ' + (typeof getTSText==='function'?getTSText(GM.turn):'') + '</div></div>';

  groups.forEach(function(g) {
    html += '<div class="zz-group">';
    html += '<div class="zz-group-title" style="--gc:' + g.color + ';">' + _ti(g.icon,13) + ' ' + g.label + '</div>';
    html += '<div class="zz-items">';
    g.items.forEach(function(item) {
      var cls = item.ok ? 'zz-item' : 'zz-item disabled';
      var onclick = item.ok ? ' onclick="' + item.action.replace(/"/g, '&quot;') + '"' : '';
      html += '<div class="' + cls + '"' + onclick + '>';
      html += '<div class="zz-item-icon">' + _ti(item.icon, 16) + '</div>';
      html += '<div class="zz-item-text"><div class="zz-item-label">' + item.label + '</div>';
      if (item.sub) html += '<div class="zz-item-sub">' + item.sub + '</div>';
      html += '</div>';
      if (item.ok) {
        html += '<div class="zz-item-status ok">\u25CF</div>';
      } else {
        html += '<div class="zz-item-status no" title="' + escHtml(item.reason||'') + '">\u25CB ' + escHtml(item.reason||'') + '</div>';
      }
      html += '</div>';
    });
    html += '</div></div>';
  });

  // 快捷状态摘要
  html += '<div class="zz-summary">';
  var _treasury = GM.stateTreasury || 0;
  var _wars = GM.activeWars ? GM.activeWars.length : 0;
  html += '<span>\u56FD\u5E93 ' + Math.round(_treasury) + '</span>';
  if (_wars > 0) html += '<span style="color:var(--vermillion-400);">\u6218\u4E89 ' + _wars + '</span>';
  html += '</div>';

  return html;
}

// 2.8: 无障碍增强——为动态生成的UI元素补充ARIA标签
function _applyA11y() {
  // Tab栏标记为tablist
  var tabBars = document.querySelectorAll('.g-tab-btn');
  tabBars.forEach(function(btn) {
    btn.setAttribute('role', 'tab');
    if (!btn.getAttribute('aria-label')) btn.setAttribute('aria-label', btn.textContent.trim());
  });
  // 操作按钮
  document.querySelectorAll('.ngui-action').forEach(function(btn) {
    btn.setAttribute('role', 'button');
    var title = btn.querySelector('.ngui-action-title');
    if (title && !btn.getAttribute('aria-label')) btn.setAttribute('aria-label', title.textContent.trim());
  });
  // 朝政中心操作项
  document.querySelectorAll('.zz-item').forEach(function(item) {
    if (!item.classList.contains('disabled')) item.setAttribute('role', 'button');
    item.setAttribute('tabindex', '0');
    var label = item.querySelector('.zz-item-label');
    if (label) item.setAttribute('aria-label', label.textContent.trim());
    // 键盘回车触发点击
    item.addEventListener('keydown', function(e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); item.click(); } });
  });
  // 结算按钮
  var endBtn = document.getElementById('btn-end-turn');
  if (endBtn) endBtn.setAttribute('aria-label', '\u7ED3\u675F\u672C\u56DE\u5408');
}
// 首次加载后调用
setTimeout(_applyA11y, 1000);

// 2.7: 移动端底部导航栏
function _initMobileNav() {
  if (document.getElementById('mobile-nav')) return;
  if (window.innerWidth > 768) return;
  var nav = document.createElement('div');
  nav.id = 'mobile-nav';
  nav.innerHTML = '<button onclick="_toggleMobilePanel(\'left\')">\u2630 \u6982\u89C8</button>' +
    '<button onclick="switchGTab(null,\'gt-edict\')">\u270D \u8BCF\u4EE4</button>' +
    '<button onclick="confirmEndTurn()">\u23F3 \u7ED3\u7B97</button>' +
    '<button onclick="_toggleMobilePanel(\'right\')">\u2699 \u64CD\u4F5C</button>';
  document.body.appendChild(nav);
}
function _toggleMobilePanel(side) {
  if (side === 'left') {
    var lp = document.querySelector('.ngui-left');
    if (lp) lp.classList.toggle('mobile-open');
    var rp = document.querySelector('.ngui-right');
    if (rp) rp.classList.remove('mobile-open');
  } else {
    var rp2 = document.querySelector('.ngui-right');
    if (rp2) rp2.classList.toggle('mobile-open');
    var lp2 = document.querySelector('.ngui-left');
    if (lp2) lp2.classList.remove('mobile-open');
  }
}
// 监听窗口大小变化 + 启动时检查
if (typeof window !== 'undefined') {
  window.addEventListener('resize', function() {
    if (window.innerWidth <= 768) _initMobileNav();
    else { var mn = document.getElementById('mobile-nav'); if (mn) mn.remove(); }
  });
  // 启动时也检查一次
  window.addEventListener('DOMContentLoaded', function() {
    if (window.innerWidth <= 768) _initMobileNav();
  });
}

// ============================================================
// 2.2: 角色交互快捷面板
// ============================================================

/**
 * 显示角色快捷面板（点击角色名时弹出）
 * @param {string} charName - 角色名
 * @param {Event} evt - 点击事件
 */
// ============================================================
// 问天系统——玩家与推演AI的元通信通道
// ============================================================

function openWentian() {
  var old = _$('wentian-modal');
  if (old) { old.remove(); return; }

  if (!GM._playerDirectives) GM._playerDirectives = [];
  if (!GM._importedMemories) GM._importedMemories = [];
  if (!GM._wentianHistory) GM._wentianHistory = [];

  var modal = document.createElement('div');
  modal.className = 'modal-bg show';
  modal.id = 'wentian-modal';
  modal.style.cssText = '-webkit-app-region:no-drag;';
  modal.innerHTML = '<div style="background:var(--color-surface);border:1px solid var(--gold-500);border-radius:var(--radius-lg);width:95%;max-width:700px;height:80vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:var(--shadow-lg);">'
    // 头部
    + '<div style="padding:0.6rem 1rem;border-bottom:1px solid var(--color-border-subtle);display:flex;justify-content:space-between;align-items:center;">'
    + '<div style="font-size:var(--text-md);font-weight:var(--weight-bold);color:var(--gold-400);letter-spacing:0.15em;">\u95EE\u5929</div>'
    + '<div style="font-size:var(--text-xs);color:var(--color-foreground-muted);">\u4E0E\u63A8\u6F14AI\u76F4\u63A5\u5BF9\u8BDD\u2014\u2014\u4E0B\u56DE\u5408\u751F\u6548</div>'
    + '<button class="bt bsm" onclick="_$(\'wentian-modal\').remove();">\u2715</button>'
    + '</div>'
    // 对话区
    + '<div id="wt-chat" style="flex:1;overflow-y:auto;padding:0.8rem;background:var(--color-sunken);"></div>'
    // 输入区
    + '<div style="padding:0.6rem;border-top:1px solid var(--color-border-subtle);">'
    + '<div style="display:flex;gap:var(--space-1);margin-bottom:var(--space-1);">'
    + '<button class="bt bsm" onclick="_wtImportDoc()" title="\u5BFC\u5165\u6587\u6863\u4F5C\u4E3A\u63A8\u6F14\u4E0A\u4E0B\u6587">\u5BFC\u5165\u6587\u6863</button>'
    + '<button class="bt bsm" onclick="_wtImportMemory()" title="\u5BFC\u5165\u5BF9\u8BDD\u8BB0\u5F55\u4F5C\u4E3ANPC\u8BB0\u5FC6">\u6CE8\u5165\u8BB0\u5FC6</button>'
    + '<button class="bt bsm" style="color:var(--vermillion-400);" onclick="_wtClearDirectives()" title="\u6E05\u9664\u6240\u6709\u73A9\u5BB6\u6307\u4EE4">\u6E05\u9664\u6307\u4EE4</button>'
    + '<span style="margin-left:auto;font-size:0.66rem;color:var(--ink-300);">\u6307\u4EE4' + GM._playerDirectives.length + ' \u8BB0\u5FC6' + GM._importedMemories.length + '</span>'
    + '</div>'
    // 类别选择器（6 按钮·单选·默认自动）
    + '<div id="wt-cat-bar" style="display:flex;gap:4px;margin-bottom:var(--space-1);flex-wrap:wrap;">'
    + '<span style="font-size:0.66rem;color:var(--ink-300);align-self:center;margin-right:2px;">\u5206\u7C7B\uFF1A</span>'
    + '<button class="wt-cat-btn" data-cat="" onclick="_wtPickCat(\'\')" title="\u9ED8\u8BA4\u7531 AI \u81EA\u52A8\u5224\u5B9A">\u81EA\u52A8</button>'
    + '<button class="wt-cat-btn" data-cat="narrative" onclick="_wtPickCat(\'narrative\')" title="\u53D9\u4E8B\u63A7\u5236\uFF1A\u4FDD\u62A4\u67D0\u4EBA\u00B7\u4FC3\u67D0\u4E8B\u00B7AI \u884C\u4E3A\u7EA6\u675F">\u53D9\u4E8B</button>'
    + '<button class="wt-cat-btn" data-cat="setting" onclick="_wtPickCat(\'setting\')" title="\u80CC\u666F\u8BBE\u5B9A\uFF1A\u6CE8\u5165\u5267\u672C\u80CC\u666F\u6216\u72B6\u6001">\u8BBE\u5B9A</button>'
    + '<button class="wt-cat-btn" data-cat="hardChange" onclick="_wtPickCat(\'hardChange\')" title="\u76F4\u6539\u6570\u503C\uFF1A\u7ACB\u5373\u5199\u5165 GM/P \u5177\u4F53\u5B57\u6BB5">\u2696\ufe0e\u76F4\u6539</button>'
    + '<button class="wt-cat-btn" data-cat="edictSubstitute" onclick="_wtPickCat(\'edictSubstitute\')" title="\u8BE5\u8D70\u8BCF\u4EE4\uFF1A\u81EA\u52A8\u6539\u5199\u5E76\u586B\u5165\u8BCF\u4EE4\u6846">\u2709\ufe0e\u8BCF\u4EE4</button>'
    + '<button class="wt-cat-btn" data-cat="absolute" onclick="_wtPickCat(\'absolute\')" title="\u5929\u610F/\u81F3\u9AD8\uFF1A\u4E16\u754C\u6CD5\u5219\u5F3A\u5236\u751F\u6548\u00B7\u65E0\u63A8\u8FAD">\u2605\u5929\u610F</button>'
    + '</div>'
    + '<div style="display:flex;gap:var(--space-2);">'
    + '<textarea id="wt-input" placeholder="\u5BF9\u63A8\u6F14AI\u8BF4\u2026\u2026\uFF08\u7EA0\u6B63\u63A8\u6F14/\u52A0\u5165\u89C4\u5219/\u52A0\u5165\u5185\u5BB9\uFF09" rows="3" style="flex:1;resize:none;padding:0.4rem;font-size:var(--text-sm);font-family:inherit;background:var(--color-elevated);border:1px solid var(--color-border);border-radius:var(--radius-md);color:var(--color-foreground);"></textarea>'
    + '<button class="bt bp" onclick="_wtSend()" style="padding:0.4rem 1rem;align-self:flex-end;">\u95EE\u5929</button>'
    + '</div></div></div>';
  document.body.appendChild(modal);
  // 给分类按钮加样式（若无 CSS 也能显示）
  var _cStyle = document.getElementById('_wtCatStyle');
  if (!_cStyle) {
    _cStyle = document.createElement('style');
    _cStyle.id = '_wtCatStyle';
    _cStyle.textContent = '.wt-cat-btn{padding:2px 8px;font-size:0.68rem;background:rgba(184,154,83,0.06);border:1px solid rgba(184,154,83,0.25);color:var(--ink-300);border-radius:3px;cursor:pointer;font-family:inherit;letter-spacing:0.05em;transition:all 0.15s;}'
      + '.wt-cat-btn:hover{border-color:var(--gold-400);color:var(--gold-300);}'
      + '.wt-cat-btn.sel{background:linear-gradient(135deg,rgba(184,154,83,0.22),rgba(140,109,43,0.12));border-color:var(--gold-400);color:var(--gold-300);box-shadow:inset 0 0 6px rgba(184,154,83,0.15);}'
      + '.wt-cat-btn[data-cat="absolute"].sel{background:linear-gradient(135deg,#8e6aa8,#b08bc8);border-color:#b08bc8;color:#fff;}'
      + '.wt-cat-btn[data-cat="hardChange"].sel{background:linear-gradient(135deg,rgba(192,64,48,0.4),rgba(140,40,30,0.25));border-color:var(--vermillion-400);color:#fef4e8;}'
      + '.wt-cat-btn[data-cat="edictSubstitute"].sel{background:linear-gradient(135deg,rgba(201,168,76,0.35),rgba(160,130,40,0.2));border-color:var(--amber-400);color:#fef4e8;}'
      + '.wt-cat-btn[data-cat="setting"].sel{background:linear-gradient(135deg,rgba(126,184,167,0.3),rgba(90,143,127,0.18));border-color:var(--celadon-400);color:#eef5f1;}'
      + '.wt-cat-btn[data-cat="narrative"].sel{background:linear-gradient(135deg,rgba(212,190,122,0.3),rgba(184,154,83,0.2));border-color:var(--gold-300);color:#fff4d8;}';
    document.head.appendChild(_cStyle);
  }
  // 默认选中"自动"
  _wtForceCategory = '';
  setTimeout(function(){
    var autoBtn = document.querySelector('#wt-cat-bar .wt-cat-btn[data-cat=""]');
    if (autoBtn) autoBtn.classList.add('sel');
  }, 0);
  _wtRenderHistory();
}

/** 选择强制分类（为空=自动·AI 判定） */
var _wtForceCategory = '';
function _wtPickCat(cat) {
  _wtForceCategory = cat || '';
  document.querySelectorAll('#wt-cat-bar .wt-cat-btn').forEach(function(b){
    b.classList.toggle('sel', (b.dataset.cat||'') === _wtForceCategory);
  });
}

/** 渲染问天对话历史 */
function _wtRenderHistory() {
  var chat = _$('wt-chat'); if (!chat) return;
  var html = '';
  // 欢迎信息
  html += '<div style="text-align:center;font-size:0.72rem;color:var(--ink-300);padding:0.5rem;margin-bottom:0.5rem;">\u95EE\u5929\u7CFB\u7EDF\u2014\u2014AI \u4F1A\u89E3\u8BFB\u4F60\u7684\u6307\u4EE4\u00B7\u786E\u8BA4\u540E\u5165\u5E93\u00B7\u6BCF\u56DE\u5408\u56DE\u62A5\u6267\u884C\u72B6\u51B5</div>';
  // 已有指令（带状态 chip）
  if (GM._playerDirectives && GM._playerDirectives.length > 0) {
    html += '<div style="font-size:0.7rem;color:var(--gold-400);margin-bottom:var(--space-1);">\u6D3B\u8DC3\u6307\u4EE4 (' + GM._playerDirectives.length + ')</div>';
    GM._playerDirectives.forEach(function(d, i) {
      var statusChip = '';
      if (d._lastStatus === 'followed') statusChip = '<span style="display:inline-block;padding:1px 5px;background:rgba(126,184,167,0.2);color:var(--celadon-400);border-radius:2px;font-size:0.62rem;margin-left:4px;">\u5DF2\u9075</span>';
      else if (d._lastStatus === 'partial') statusChip = '<span style="display:inline-block;padding:1px 5px;background:rgba(201,168,76,0.2);color:var(--amber-400);border-radius:2px;font-size:0.62rem;margin-left:4px;" title="' + escHtml(d._lastReason||'') + '">\u90E8\u5206</span>';
      else if (d._lastStatus === 'ignored') statusChip = '<span style="display:inline-block;padding:1px 5px;background:rgba(192,64,48,0.25);color:#fef4e8;border-radius:2px;font-size:0.62rem;margin-left:4px;" title="' + escHtml(d._lastReason||'') + '">\u2757\u5FFD\u7565\u00D7' + (d._ignoredCount||1) + '</span>';
      else if (d._lastStatus === 'unchecked') statusChip = '<span style="display:inline-block;padding:1px 5px;background:rgba(157,145,125,0.15);color:var(--ink-300);border-radius:2px;font-size:0.62rem;margin-left:4px;">\u672A\u6838</span>';
      else statusChip = '<span style="display:inline-block;padding:1px 5px;background:rgba(184,154,83,0.12);color:var(--gold-300);border-radius:2px;font-size:0.62rem;margin-left:4px;">\u65B0\u5F55</span>';
      var borderCol = d._absolute ? '#b08bc8' : d._lastStatus === 'ignored' ? 'var(--vermillion-400)' : d._lastStatus === 'partial' ? 'var(--amber-400)' : d._lastStatus === 'followed' ? 'var(--celadon-400)' : 'var(--gold-400)';
      var absChip = d._absolute ? '<span style="display:inline-block;padding:1px 6px;background:linear-gradient(135deg,#8e6aa8,#b08bc8);color:#fff;border-radius:2px;font-size:0.62rem;margin-left:4px;font-weight:700;">\u2605\u5929\u610F</span>' : '';
      html += '<div style="display:flex;justify-content:flex-end;margin-bottom:0.4rem;">';
      html += '<div style="max-width:85%;background:var(--color-accent-subtle);border-right:3px solid ' + borderCol + ';border-radius:var(--radius-md) 2px 2px var(--radius-md);padding:0.4rem 0.6rem;font-size:var(--text-xs);">';
      html += '<div style="font-size:0.66rem;color:var(--gold-400);margin-bottom:2px;">T' + (d.turn||'?') + ' ' + (d.type === 'rule' ? '\u89C4\u5219' : d.type === 'correction' ? '\u7EA0\u6B63' : d.type === 'content' ? '\u5185\u5BB9' : '\u6307\u4EE4') + absChip + statusChip + '</div>';
      html += escHtml(d.content);
      if (d.structured) {
        var sParts = [];
        if (d.structured.target) sParts.push('\u5BF9\u8C61:' + d.structured.target);
        if (d.structured.action) sParts.push('\u52A8\u4F5C:' + d.structured.action);
        if (d.structured.scope) sParts.push('\u8303\u56F4:' + d.structured.scope);
        if (d.structured.forbidden) sParts.push('\u7981:' + d.structured.forbidden);
        if (sParts.length > 0) html += '<div style="font-size:0.62rem;color:var(--ink-300);margin-top:2px;font-style:italic;">' + escHtml(sParts.join(' \u00B7 ')) + '</div>';
      }
      if (d._lastEvidence) html += '<div style="font-size:0.62rem;color:var(--celadon-400);margin-top:2px;">\u4E0A\u56DE\u5408\u6267\u884C\uFF1A' + escHtml(d._lastEvidence.slice(0, 60)) + '</div>';
      html += '<button style="font-size:0.62rem;color:var(--vermillion-400);background:none;border:none;cursor:pointer;margin-left:4px;" onclick="GM._playerDirectives.splice(' + i + ',1);_wtRenderHistory();">\u2715</button>';
      html += '</div></div>';
    });
  }
  // 已导入记忆
  if (GM._importedMemories && GM._importedMemories.length > 0) {
    html += '<div style="font-size:0.7rem;color:var(--celadon-400);margin-bottom:var(--space-1);">\u5DF2\u5BFC\u5165\u8BB0\u5FC6 (' + GM._importedMemories.length + ')</div>';
    GM._importedMemories.forEach(function(m, i) {
      html += '<div style="font-size:0.7rem;color:var(--color-foreground-muted);padding:2px 6px;background:var(--color-elevated);border-radius:3px;margin-bottom:2px;display:flex;justify-content:space-between;">';
      html += '<span>' + escHtml((m.title||'').slice(0,40) || m.content.slice(0,40)) + '\u2026</span>';
      html += '<button style="font-size:0.62rem;color:var(--vermillion-400);background:none;border:none;cursor:pointer;" onclick="GM._importedMemories.splice(' + i + ',1);_wtRenderHistory();">\u2715</button>';
      html += '</div>';
    });
  }
  // 对话历史
  (GM._wentianHistory||[]).forEach(function(h) {
    if (h.role === 'player') {
      html += '<div style="display:flex;justify-content:flex-end;margin-bottom:0.4rem;"><div style="max-width:85%;background:var(--color-accent-subtle);border-right:3px solid var(--vermillion-400);border-radius:var(--radius-md) 2px 2px var(--radius-md);padding:0.4rem 0.6rem;font-size:var(--text-sm);color:var(--color-foreground);">' + escHtml(h.content) + '</div></div>';
    } else {
      html += '<div style="display:flex;margin-bottom:0.4rem;"><div style="max-width:85%;background:var(--color-elevated);border-left:3px solid var(--gold-500);border-radius:2px var(--radius-md) var(--radius-md) 2px;padding:0.4rem 0.6rem;font-size:var(--text-sm);color:var(--color-foreground-secondary);">' + escHtml(h.content) + '</div></div>';
    }
  });
  chat.innerHTML = html;
  chat.scrollTop = chat.scrollHeight;
}

/** 发送问天指令——真双向对话 + 结构化解析 + 待确认 */
var _wtPending = null;  // { raw, aiInterpret, structured, type, ambiguity }
async function _wtSend() {
  var input = _$('wt-input');
  var content = input ? input.value.trim() : '';
  if (!content) return;
  if (input) input.value = '';

  if (!GM._wentianHistory) GM._wentianHistory = [];
  GM._wentianHistory.push({ role: 'player', content: content, turn: GM.turn });

  // 本地回退判断类型
  var type = 'directive';
  if (/纠正|错了|不对|不应该|不合理/.test(content)) type = 'correction';
  else if (/规则|必须|不得|要求|禁止|总是/.test(content)) type = 'rule';
  else if (/加入|增加|设定|背景|补充/.test(content)) type = 'content';

  // 无 AI key：退回老行为
  if (!P.ai || !P.ai.key || typeof callAI !== 'function') {
    if (!GM._playerDirectives) GM._playerDirectives = [];
    var did = 'dir_' + (GM.turn||0) + '_' + Math.random().toString(36).slice(2,7);
    GM._playerDirectives.push({ id: did, content: content, type: type, turn: GM.turn });
    GM._wentianHistory.push({ role: 'system', content: '\u2705 \u5DF2\u5F55\u5165\uFF08\u65E0AI\u89E3\u8BFB\u00B7\u914D\u914D key \u540E\u53EF\u542F\u7528\u89E3\u8BFB\u4E0E\u786E\u8BA4\u6D41\u7A0B\uFF09' });
    _wtRenderHistory();
    toast('\u6307\u4EE4\u5DF2\u5F55\u5165');
    return;
  }

  // 展示"AI 解读中"气泡
  _wtRenderHistory();
  var chat = _$('wt-chat');
  if (chat) {
    var thinking = document.createElement('div');
    thinking.id = 'wt-thinking';
    thinking.style.cssText = 'display:flex;margin-bottom:0.4rem;';
    thinking.innerHTML = '<div style="max-width:85%;background:var(--color-elevated);border-left:3px solid var(--gold-500);padding:0.4rem 0.6rem;font-size:var(--text-xs);color:var(--ink-300);font-style:italic;">AI \u6B63\u5728\u89E3\u8BFB\u4F60\u7684\u6307\u4EE4\u2026</div>';
    chat.appendChild(thinking);
    chat.scrollTop = chat.scrollHeight;
  }

  // 构造解析 prompt
  var pastRules = (GM._playerDirectives||[]).filter(function(d){return d.type==='rule';}).slice(-6).map(function(d){return '- ' + d.content;}).join('\n');
  var ctx = '剧本背景：' + ((typeof findScenarioById==='function'&&GM.sid) ? ((findScenarioById(GM.sid)||{}).name||'') : '') + '\n当前第 ' + (GM.turn||0) + ' 回合\n';
  if (pastRules) ctx += '已有规则:\n' + pastRules + '\n';
  // 玩家强制分类——告知 AI 必须按此类输出对应字段
  var forceHint = '';
  if (_wtForceCategory) {
    forceHint = '\n★ 玩家已手动强制分类为：' + _wtForceCategory + '——你必须按此分类输出相应必需字段';
    if (_wtForceCategory === 'hardChange') forceHint += '（必填 hardChange:{path,op,value}·尽力从玩家文本推断具体字段路径）';
    if (_wtForceCategory === 'absolute') forceHint += '（天意档允许改任何 GM/P 字段；若玩家要求改数值或字段，仍必须填写 hardChange:{path,op,value}，确认后立即写入）';
    if (_wtForceCategory === 'edictSubstitute') forceHint += '（必填 edictText 和 edictChannel·将玩家意图改写为正式诏令措辞）';
  }
  ctx += forceHint;
  // agent 模式（2026-07-03·P.conf.wentianAgentMode!==false 默认开·设置→性能可关）：先查证后裁定——
  // AI 用只读工具（查字段/搜档案/细查实体）核实对象在档真名与现值再提交（治「凭指令文本猜路径→直改失败/改错人」）。
  // 基建缺位（无 callAIWithTools/AgentReadTools）或 agent 失败 → 自动落回下方旧单发·问天永不断。
  if (typeof TM !== 'undefined' && TM.WentianAgent && typeof TM.WentianAgent.enabled === 'function' && TM.WentianAgent.enabled()) {
    try {
      var _agRes = await TM.WentianAgent.run(content, {
        teaching: _wtParseTeachingText(),
        ctx: ctx,
        onProgress: function (toolName) {
          var tb = _$('wt-thinking');
          if (tb) tb.innerHTML = '<div style="max-width:85%;background:var(--color-elevated);border-left:3px solid var(--gold-500);padding:0.4rem 0.6rem;font-size:var(--text-xs);color:var(--ink-300);font-style:italic;">问天查证中·' + escHtml(String(toolName || '')) + '…</div>';
        }
      });
      if (_agRes && _agRes.ok && _agRes.result) {
        var _r = _agRes.result;
        var _thA = _$('wt-thinking'); if (_thA) _thA.remove();
        var _hcs = Array.isArray(_r.hardChanges) ? _r.hardChanges.filter(function (x) { return x && x.path; }) : [];
        _wtPending = {
          raw: content,
          type: _r.type || type,
          category: _wtForceCategory || _r.category || 'narrative',
          _forcedByPlayer: !!_wtForceCategory,
          structured: _r.structured || {},
          hardChange: _hcs[0] || null,
          hardChanges: _hcs.length ? _hcs : null,
          edictText: _r.edictText || '',
          edictChannel: _r.edictChannel || '',
          interpretation: _r.interpretation || '',
          ambiguity: Array.isArray(_r.ambiguity) ? _r.ambiguity : [],
          plan: _r.plan || '',
          turn: GM.turn,
          _agentTrace: Array.isArray(_agRes.trace) ? _agRes.trace : []
        };
        _wtShowPendingConfirmation();
        return;
      }
      // agent 未产出（轮尽/超时）→ 落回单发
    } catch (_agE) { try { window.TM && TM.errors && TM.errors.captureSilent(_agE, 'wentian-agent'); } catch (_) {} }
  }

  var prompt = '你是天命AI推演系统的元指令解析器。玩家刚对你说了一条指令，请：\n'
    + _wtParseTeachingText()
    + '\n【上下文】\n' + ctx
    + '\n【玩家指令】\n' + content
    + '\n\n返回 JSON：{"type":"rule|correction|content|directive","category":"narrative|setting|hardChange|edictSubstitute|absolute","structured":{"target":"","action":"","scope":"","forbidden":"","measurable":"","condition":""},"hardChange":{"path":"","op":"set|add|mul","value":null},"edictText":"","edictChannel":"","interpretation":"...","ambiguity":["..."],"plan":"..."}';

  try {
    var resp = await callAI(prompt, 900, null, (typeof _useSecondaryTier === 'function' && _useSecondaryTier()) ? 'secondary' : undefined);  // 【降本2026-06-19】指令解析(机械抽取)走次 API
    var th = _$('wt-thinking'); if (th) th.remove();
    var parsed = (typeof extractJSON === 'function') ? extractJSON(resp) : null;
    if (!parsed) parsed = { interpretation: resp || content, type: type, structured: {}, ambiguity: [], plan: '将在下回合推演时参考此条指令' };
    parsed = _wtAugmentParsedHardChange(content, parsed, _wtForceCategory);
    _wtPending = {
      raw: content,
      type: parsed.type || type,
      category: _wtForceCategory || parsed.category || 'narrative',
      _forcedByPlayer: !!_wtForceCategory,
      structured: parsed.structured || {},
      hardChange: parsed.hardChange || null,
      edictText: parsed.edictText || '',
      edictChannel: parsed.edictChannel || '',
      interpretation: parsed.interpretation || '',
      ambiguity: Array.isArray(parsed.ambiguity) ? parsed.ambiguity : [],
      plan: parsed.plan || '',
      turn: GM.turn
    };
    // 展示 AI 解读气泡 + 确认按钮
    _wtShowPendingConfirmation();
  } catch(e) {
    var th2 = _$('wt-thinking'); if (th2) th2.remove();
    // AI 失败 → 仍按老办法入库
    if (!GM._playerDirectives) GM._playerDirectives = [];
    var did2 = 'dir_' + (GM.turn||0) + '_' + Math.random().toString(36).slice(2,7);
    GM._playerDirectives.push({ id: did2, content: content, type: type, turn: GM.turn });
    GM._wentianHistory.push({ role: 'system', content: '\u26A0 AI \u89E3\u8BFB\u5931\u8D25\uFF0C\u5DF2\u6309\u539F\u6587\u5F55\u5165\uFF08\u7C7B\u578B\uFF1A' + type + '\uFF09' });
    _wtRenderHistory();
  }
}

// 解析教学核心（单发解析与 agent 模式共源·勿两处各写一份致漂移）
function _wtParseTeachingText() {
  return '1. 判断类型 type: rule(持久规则·每回合遵守) / correction(纠正·本回合调整) / content(背景/设定补充) / directive(一次性指令)\n'
    + '2. 判断分类 category（重要）：\n'
    + '   · narrative — 叙事/规则控制：让剧情走向X、让AI行为Y、保护某人、禁止某事发生（例："不要让袁崇焕被处决"、"AI多写诗词"）\n'
    + '   · setting — 世界背景/设定注入：补充剧本的背景信息/状态/历史（例："此时倭寇已平"、"北方去年大旱未记入"）\n'
    + '   · hardChange — 直接修改数值或字段：要求直接改具体数值/字段（例："帑廪+1000万两"、"某NPC忠诚设为100"、"袁崇焕所在地改为京师"、"皇威+10"）\n'
    + '       ★【识别规则】只要指令提到：具体金额(万两/石/匹)、具体数值(+N/-N/设为N)、具体字段(国库/帑廪/内帑/忠诚/所在地/位置/皇威/皇权/民心/阶层满意度/阶层影响力/区划田亩/官职公库等)——必须归入 hardChange。不要误判为 narrative/directive。\n'
    + '       ★【常见路径】白银=guoku.money·粮=guoku.grain·布=guoku.cloth·军备库甲胄=guoku.armory.甲胄.stock(兵刃/弓弩/火器/战马同式)·原料库铁=guoku.materials.铁.stock(硝石/皮革/木同式)·内帑银=neitang.money·皇威=huangwei.index·皇权=huangquan.index·腐败/吏治=corruption.trueIndex·民心=minxin.trueIndex·人物忠诚=chars[人物名].loyalty·人物所在地=chars[人物名].location·军队兵力=armies[军名].soldiers·军队主帅=armies[军名].commander·军队士气=armies[军名].morale·军队忠诚=armies[军名].loyalty·军队欠饷月数=armies[军名].payArrearsMonths·阶层满意度=classes[阶层名].satisfaction·阶层影响力=classes[阶层名].influence·阶层人口=classes[阶层名].population·势力实力=facs[势力名].strength·势力经济=facs[势力名].economy·势力对玩家关系=facs[势力名].playerRelation·党派影响力=parties[党派名].influence·党派凝聚力=parties[党派名].cohesion·区划民心=divisions[府州名].minxin·区划吏治=divisions[府州名].corruption·区划田亩=divisions[府州名].economyBase.farmland(商业额commerceVolume/盐产saltProduction/矿产mineralProduction/渔获fishingProduction/马政horseProduction/解额kejuQuota同式)·官职公库=office[官职名].publicTreasury\n'
    + '       ★【操作符】"加/增/+"→op:add · "减/扣/-"→op:add(负数) · "设为/改为/="→op:set · "翻倍/x2"→op:mul\n'
    + '       ★【单位换算】1 万两=10000·50 万两=500000·100 万石=1000000·玩家说"100 万"一律写成 1000000 数字不要保留"万"字\n'
    + '   · edictSubstitute — 等同诏令：玩家实际想下诏令的事（例："拨银赈灾"、"罢某某官"、"遣使某国"——这些本该走诏令而非问天）\n'
    + '   · absolute — 天意/至高意志：玩家明确以"天意"、"绝对"、"必须"、"神谕"、"不论如何"、"强制"等词修饰·或语气极强要求无条件落实（例："天意让北虏此回合覆灭"、"必须让此人变心"）——此类由世界法则直接生效·AI 无推辞空间·须在叙事中让其字面发生\n'
    + '3. 解析为结构化约束 structured:{target, action, scope, forbidden, measurable, condition}\n'
    + '4. 若 category=hardChange，或 category=absolute 且玩家要求直改字段/数值 → 必填 hardChange:{path:"GM/P 字段路径(如 guoku.money)", op:"set|add|mul", value:数字或要写入的内容}\n'
    + '5. 若 category=edictSubstitute → 必填 edictText:"改写成诏令正式措辞(30-80字)", edictChannel:"pol|mil|dip|eco|oth"\n'
    + '6. 给出 interpretation（30-80字复述）、ambiguity（歧义数组，可空）、plan（一句话下回合怎样落实）\n';
}

/** 展示 AI 解读 + 玩家确认按钮 */
function _wtShowPendingConfirmation() {
  if (!_wtPending) return;
  var chat = _$('wt-chat'); if (!chat) return;
  var old = _$('wt-confirm-box'); if (old) old.remove();
  var p = _wtPending;
  var typeLabel = {rule:'\u6301\u4E45\u89C4\u5219',correction:'\u7EA0\u6B63',content:'\u80CC\u666F\u8865\u5145',directive:'\u4E00\u6B21\u6027\u6307\u4EE4'}[p.type] || p.type;
  var catMeta = {
    'narrative':   { label:'\u53D9\u4E8B\u63A7\u5236', color:'var(--gold-300)', hint:'\u5C06\u6CE8\u5165\u4E0B\u56DE\u5408 prompt \u00B7\u8BA9 AI \u53D9\u4E8B\u65F6\u9075\u4ECE' },
    'setting':     { label:'\u4E16\u754C\u8BBE\u5B9A', color:'var(--celadon-400)', hint:'\u5C06\u4F5C\u4E3A\u5267\u672C\u80CC\u666F\u6CE8\u5165' },
    'hardChange':  { label:'\u2696\ufe0e\u76F4\u6539\u6570\u503C', color:'var(--vermillion-400)', hint:'\u5C06\u7ACB\u5373\u5199\u5165 GM/P \u5177\u4F53\u5B57\u6BB5' },
    'edictSubstitute': { label:'\u8BE5\u8D70\u8BCF\u4EE4', color:'var(--amber-400)', hint:'AI \u5DF2\u6539\u5199\u4E3A\u8BCF\u4EE4\u8349\u7A3F\u00B7\u70B9\u786E\u8BA4\u5373\u586B\u5165\u8BCF\u4EE4\u8F93\u5165\u6846' },
    'absolute':    { label:'\u2605 \u5929 \u610F \u00B7 \u81F3 \u9AD8 \u2605', color:'#b08bc8', hint:'\u4E16\u754C\u6CD5\u5219\u76F4\u63A5\u751F\u6548\u00B7AI \u65E0\u63A8\u8FAD\u00B7\u5FC5\u5B57\u9762\u8001\u5B9E\u843D\u5B9E' }
  };
  var cat = catMeta[p.category] || catMeta['narrative'];
  var box = document.createElement('div');
  box.id = 'wt-confirm-box';
  box.style.cssText = 'display:flex;margin-bottom:0.5rem;';
  var h = '<div style="max-width:90%;background:linear-gradient(135deg,rgba(184,154,83,0.08),var(--color-elevated));border-left:3px solid ' + cat.color + ';border-radius:2px var(--radius-md) var(--radius-md) 2px;padding:0.5rem 0.7rem;font-size:var(--text-xs);">';
  var origin = p._forcedByPlayer ? '\u73A9\u5BB6\u6307\u5B9A' : 'AI\u81EA\u52A8';
  h += '<div style="font-size:0.66rem;margin-bottom:4px;"><span style="color:var(--gold-400);">AI \u89E3\u8BFB \u00B7 </span><span style="color:' + cat.color + ';font-weight:700;">' + escHtml(cat.label) + '</span><span style="color:var(--ink-300);"> \u00B7 ' + escHtml(typeLabel) + ' \u00B7 ' + origin + '</span></div>';
  h += '<div style="font-size:0.64rem;color:var(--ink-300);margin-bottom:4px;font-style:italic;">' + cat.hint + '</div>';
  h += '<div style="color:var(--color-foreground);margin-bottom:6px;">' + escHtml(p.interpretation) + '</div>';
  // 结构化
  var sParts = [];
  if (p.structured) {
    if (p.structured.target) sParts.push('<b>\u5BF9\u8C61</b>\uFF1A' + escHtml(p.structured.target));
    if (p.structured.action) sParts.push('<b>\u52A8\u4F5C</b>\uFF1A' + escHtml(p.structured.action));
    if (p.structured.scope) sParts.push('<b>\u8303\u56F4</b>\uFF1A' + escHtml(p.structured.scope));
    if (p.structured.forbidden) sParts.push('<b>\u7981</b>\uFF1A' + escHtml(p.structured.forbidden));
    if (p.structured.measurable) sParts.push('<b>\u8BC4\u5224</b>\uFF1A' + escHtml(p.structured.measurable));
    if (p.structured.condition) sParts.push('<b>\u6761\u4EF6</b>\uFF1A' + escHtml(p.structured.condition));
  }
  if (sParts.length > 0) h += '<div style="font-size:0.68rem;color:var(--ink-200);padding:4px 6px;background:rgba(10,9,8,0.35);border-radius:3px;margin-bottom:4px;">' + sParts.join('\u3000') + '</div>';
  // hardChange 预览
  if (p.category === 'hardChange' || p.category === 'absolute') {
    var _hcList = (p.hardChanges && p.hardChanges.length) ? p.hardChanges : (p.hardChange && p.hardChange.path ? [p.hardChange] : []);
    _hcList.forEach(function (hc) {
      if (!hc || !hc.path) return;
      h += '<div style="font-size:0.68rem;color:var(--vermillion-300);padding:4px 6px;background:rgba(192,64,48,0.1);border:1px solid rgba(192,64,48,0.3);border-radius:3px;margin-bottom:4px;font-family:monospace;">\u2696\ufe0e <b>' + escHtml(hc.path) + '</b> <span style="color:var(--ink-200);">' + escHtml(hc.op||'set') + '</span> <b>' + escHtml(String(hc.value)) + '</b>' + (hc.note ? ' <span style="color:var(--ink-300);font-family:inherit;">\u00b7' + escHtml(String(hc.note).slice(0, 30)) + '</span>' : '') + '</div>';
    });
    if (p._agentTrace && p._agentTrace.length) {
      h += '<div style="font-size:0.62rem;color:var(--celadon-400);margin-bottom:4px;">\u2634 \u5df2\u67e5\u8bc1\uff1a' + escHtml(p._agentTrace.join(' \u2192 ')) + '</div>';
    }
  }
  // edictText 预览
  if (p.category === 'edictSubstitute' && p.edictText) {
    var chLabel = {pol:'\u653F\u4E8B',mil:'\u519B\u4E8B',dip:'\u5916\u4EA4',eco:'\u7ECF\u6D4E',oth:'\u5176\u4ED6'}[p.edictChannel] || '\u653F\u4E8B';
    h += '<div style="font-size:0.68rem;color:var(--amber-400);padding:4px 6px;background:rgba(201,168,76,0.1);border:1px solid rgba(201,168,76,0.3);border-radius:3px;margin-bottom:4px;">\u8BCF\u4EE4\u8349\u7A3F\u00B7' + escHtml(chLabel) + '\uFF1A<span style="color:var(--color-foreground);">\u300C' + escHtml(p.edictText) + '\u300D</span></div>';
  }
  // 歧义
  if (p.ambiguity && p.ambiguity.length > 0) {
    h += '<div style="font-size:0.68rem;color:var(--amber-400);margin-bottom:4px;">\u26A0 \u6709\u6B67\u4E49\uFF1A';
    p.ambiguity.forEach(function(q){ h += '<div>\u00B7 ' + escHtml(q) + '</div>'; });
    h += '</div>';
  }
  if (p.plan) h += '<div style="font-size:0.68rem;color:var(--celadon-400);margin-bottom:6px;font-style:italic;">\u2192 ' + escHtml(p.plan) + '</div>';
  // 按钮
  h += '<div style="display:flex;gap:6px;">';
  var confirmLbl = p.category === 'absolute' ? '\u964D \u4E0B \u5929 \u610F' : p.category === 'hardChange' ? '\u7ACB \u5373 \u5199 \u5165' : p.category === 'edictSubstitute' ? '\u586B \u5165 \u8BCF \u4EE4' : '\u786E \u8BA4 \u5165 \u5E93';
  h += '<button class="bt bp bsm" onclick="_wtConfirmPending()" style="font-size:0.7rem;' + (p.category==='absolute'?'background:linear-gradient(135deg,#8e6aa8,#b08bc8);color:#fff;':'') + '">' + confirmLbl + '</button>';
  // 手动升级到"至高"的开关（只在非 absolute 时显示）
  if (p.category !== 'absolute') {
    h += '<button class="bt bsm" onclick="_wtPromoteAbsolute()" style="font-size:0.66rem;color:#b08bc8;border-color:#8e6aa8;" title="\u6807\u4E3A\u5929\u610F\u00B7\u4E16\u754C\u6CD5\u5219\u5F3A\u5236\u751F\u6548">\u2605\u6807\u4E3A\u81F3\u9AD8</button>';
  }
  h += '<button class="bt bs bsm" onclick="_wtReviseFromPending()" style="font-size:0.7rem;">\u518D \u8BAE</button>';
  h += '<button class="bt bs bsm" onclick="_wtCancelPending()" style="font-size:0.7rem;color:var(--vermillion-400);">\u53D6 \u6D88</button>';
  h += '</div></div>';
  box.innerHTML = h;
  chat.appendChild(box);
  chat.scrollTop = chat.scrollHeight;
}

/** 手动把待确认的 directive 升级为 absolute */
function _wtPromoteAbsolute() {
  if (!_wtPending) return;
  _wtPending.category = 'absolute';
  var cb = _$('wt-confirm-box'); if (cb) cb.remove();
  _wtShowPendingConfirmation();
}

function _wtConfirmPending() {
  var p = _wtPending; if (!p) return;
  if (!GM._playerDirectives) GM._playerDirectives = [];
  if (!GM._wentianHistory) GM._wentianHistory = [];
  var did = 'dir_' + (GM.turn||0) + '_' + Math.random().toString(36).slice(2,7);
  var dir = {
    id: did, content: p.raw, type: p.type, turn: p.turn,
    category: p.category,
    structured: p.structured, interpretation: p.interpretation, plan: p.plan
  };
  var sysMsg = '';

  // 多改批量（agent 模式可提交多条 hardChanges·单条契约照旧）
  var _wtHcList = (p.hardChanges && p.hardChanges.length) ? p.hardChanges : ((p.hardChange && p.hardChange.path) ? [p.hardChange] : []);

  if (p.category === 'absolute') {
    // 天意·至高意志：标记为 absolute, rule 性质（每回合生效至玩家移除）, 永不 ignore
    dir.type = 'rule';
    dir._absolute = true;
    if (_wtHcList.length) {
      var aOkN = 0;
      var aDone = _wtHcList.map(function (ahc) {
        var aPath1 = _wtNormalizeHardChangePath(ahc.path);
        var aok1 = _wtApplyHardChange(ahc.path, ahc.op || 'set', ahc.value);
        if (aok1) aOkN++;
        return Object.assign({}, ahc, { path: aPath1, _applied: !!aok1 });
      });
      dir.hardChange = aDone[0] || null;
      if (aDone.length > 1) dir.hardChanges = aDone;
      dir._immediatelyApplied = aOkN > 0;
      dir._lastStatus = aOkN > 0 ? 'followed' : 'ignored';
      dir._lastReason = aOkN === aDone.length ? '天意直改即时生效' : (aOkN > 0 ? '天意直改部分生效(' + aOkN + '/' + aDone.length + ')' : '天意直改路径未找到/无法修改');
      dir._lastCheckTurn = GM.turn;
      sysMsg = aOkN === aDone.length
        ? ('★ 天 意 已 降 并 写 入 ' + aOkN + ' 笔：' + aDone.map(function (x) { return x.path + ' ' + (x.op || 'set') + ' ' + x.value; }).join('；') + ' [id=' + did + ']')
        : ('★ 天 意 已 入 库·直改 ' + aOkN + '/' + aDone.length + ' 笔生效：' + aDone.map(function (x) { return (x._applied ? '✓' : '✗') + x.path; }).join('；') + ' [id=' + did + ']');
    } else {
      sysMsg = '\u2605 \u5929 \u610F \u5DF2 \u5929 \u5B9A [id=' + did + ']\u00B7\u4E16\u754C\u6CD5\u5219\u76F4\u63A5\u751F\u6548\u00B7AI \u65E0\u63A8\u8FAD';
    }
    GM._playerDirectives.push(dir);
    GM._wentianHistory.push({ role: 'system', content: sysMsg });
    toast(dir._immediatelyApplied ? '★ 天意已写入' : '\u2605 \u5929\u610F\u5DF2\u964D');
  } else if (p.category === 'hardChange' && _wtHcList.length) {
    // 立即写入 GM/P 数值（agent 模式可多笔·hc/ok 沿旧语义=首笔·多笔另补一条批量汇总历史行）
    var hOkN = 0;
    var hDone = _wtHcList.map(function (hc1) {
      var ok1 = _wtApplyHardChange(hc1.path, hc1.op || 'set', hc1.value);
      if (ok1) hOkN++;
      return Object.assign({}, hc1, { _applied: !!ok1 });
    });
    var hc = hDone[0] || {};
    var ok = !!(hDone[0] && hDone[0]._applied);
    dir.hardChange = hDone[0] || null;
    if (hDone.length > 1) {
      dir.hardChanges = hDone;
      GM._wentianHistory.push({ role: 'system', content: '⚖︎ 批量直改 ' + hOkN + '/' + hDone.length + ' 笔：' + hDone.map(function (x) { return (x._applied ? '✓' : '✗') + x.path; }).join('；') });
    }
    dir._immediatelyApplied = hOkN > 0;
    dir._lastStatus = hOkN > 0 ? 'followed' : 'ignored';
    dir._lastReason = hOkN === hDone.length ? '问天直改即时生效' : (hOkN > 0 ? '部分生效(' + hOkN + '/' + hDone.length + ')' : '路径未找到/无法修改');
    dir._lastCheckTurn = GM.turn;
    sysMsg = ok
      ? ('\u2696\ufe0e \u5DF2\u5199\u5165\uFF1A' + hc.path + ' ' + (hc.op||'set') + ' ' + hc.value + ' [id=' + did + ']')
      : ('\u26A0 \u8DEF\u5F84\u672A\u627E\u5230\uFF1A' + hc.path);
    GM._playerDirectives.push(dir);
    GM._wentianHistory.push({ role: 'system', content: sysMsg });
    toast(ok ? '\u6570\u503C\u5DF2\u76F4\u6539' : '\u76F4\u6539\u5931\u8D25');
    // UI refresh is coalesced by _wtAfterHardChange.
  } else if (p.category === 'edictSubstitute' && p.edictText) {
    // 填入诏令输入框
    var ch = p.edictChannel || 'pol';
    var ta = _$('edict-' + ch);
    if (!ta) ta = _$('edict-pol');
    if (ta) {
      var cur = (ta.value || '').trim();
      ta.value = cur ? (cur + '\n' + p.edictText) : p.edictText;
      sysMsg = '\u8BCF \u4EE4 \u5DF2 \u586B \u5165 ' + ({pol:'\u653F\u4E8B',mil:'\u519B\u4E8B',dip:'\u5916\u4EA4',eco:'\u7ECF\u6D4E',oth:'\u5176\u4ED6'}[ch]||'\u653F\u4E8B') + ' \u680F';
      toast('\u8BCF\u4EE4\u8349\u7A3F\u5DF2\u586B\u5165');
      // 不入 _playerDirectives（诏令会走 edict 系统自行记录）
      GM._wentianHistory.push({ role: 'system', content: '\u2709\ufe0e ' + sysMsg + '\uFF1A\u300C' + p.edictText + '\u300D' });
    } else {
      // 回落：当普通 directive 入库
      GM._playerDirectives.push(dir);
      GM._wentianHistory.push({ role: 'system', content: '\u26A0 \u8BCF\u4EE4\u8F93\u5165\u6846\u4E0D\u5728\u89C6\u91CC\u00B7\u5DF2\u8F6C\u4E3A\u5E38\u89C4 directive\u5165\u5E93' });
    }
  } else {
    // narrative / setting → 正常 directive 入库
    GM._playerDirectives.push(dir);
    sysMsg = '\u2705 \u5DF2\u5165\u5E93 [id=' + did + ']\u00B7' + (p.category==='setting'?'\u4E0B\u56DE\u5408\u4F5C\u80CC\u666F\u6CE8\u5165':'\u4E0B\u56DE\u5408\u63A8\u6F14\u5F3A\u5236\u53C2\u7167\u00B7\u56DE\u62A5\u6267\u884C\u72B6\u51B5');
    GM._wentianHistory.push({ role: 'system', content: sysMsg });
    toast('\u6307\u4EE4\u5DF2\u5165\u5E93');
  }
  _wtPending = null;
  var cb = _$('wt-confirm-box'); if (cb) cb.remove();
  _wtRenderHistory();
}

function _wtNormalizeHardChangePath(path) {
  var p = String(path || '').trim().replace(/\s+/g, '');
  p = p.replace(/\[([^\]]+)\]/g, '.$1');   // 支持 [名字] 形式·如 armies[天龙军]/chars[袁崇焕] → .名字（原仅支持 [数字]）
  var root = '';
  var m = p.match(/^(GM|gm|P|p)\.(.+)$/);
  if (m) {
    root = (/^p$/i.test(m[1])) ? 'P.' : '';
    p = m[2];
  }
  p = p.replace(/^(vars|variables|var|变量|變量|七变量|七變量)\./i, '');
  var charPath = _wtNormalizeCharacterHardChangePath(p);
  if (charPath) return root + charPath;

  var aliases = {
    '帑廪': 'guoku.money',
    '帑廪.value': 'guoku.money',
    '帑廪.money': 'guoku.money',
    '帑廩': 'guoku.money',
    '国库': 'guoku.money',
    '國庫': 'guoku.money',
    '白银': 'guoku.money',
    '银两': 'guoku.money',
    '银': 'guoku.money',
    'guoku.balance': 'guoku.money',
    '粮': 'guoku.grain',
    '粮食': 'guoku.grain',
    '布': 'guoku.cloth',
    '布匹': 'guoku.cloth',
    '甲胄': 'guoku.armory.甲胄.stock',
    '兵刃': 'guoku.armory.兵刃.stock',
    '弓弩': 'guoku.armory.弓弩.stock',
    '火器': 'guoku.armory.火器.stock',
    '战马': 'guoku.armory.战马.stock',
    '戰馬': 'guoku.armory.战马.stock',
    '铁': 'guoku.materials.铁.stock',
    '鐵': 'guoku.materials.铁.stock',
    '硝石': 'guoku.materials.硝石.stock',
    '皮革': 'guoku.materials.皮革.stock',
    '木料': 'guoku.materials.木.stock',
    '木材': 'guoku.materials.木.stock',
    '内帑': 'neitang.money',
    '内帑.value': 'neitang.money',
    '内帑.money': 'neitang.money',
    '內帑': 'neitang.money',
    '內帑.value': 'neitang.money',
    '內帑.money': 'neitang.money',
    '内藏': 'neitang.money',
    '內藏': 'neitang.money',
    'neicang': 'neitang.money',
    'neicang.money': 'neitang.money',
    'neicang.balance': 'neitang.money',
    'neitang.balance': 'neitang.money',
    '皇权': 'huangquan.index',
    '皇权.value': 'huangquan.index',
    '皇权.index': 'huangquan.index',
    '皇權': 'huangquan.index',
    '皇權.value': 'huangquan.index',
    '皇權.index': 'huangquan.index',
    '皇威': 'huangwei.index',
    '皇威.value': 'huangwei.index',
    '皇威.index': 'huangwei.index',
    '民心': 'minxin.trueIndex',
    '民心.value': 'minxin.trueIndex',
    '民心.index': 'minxin.trueIndex',
    '吏治': 'corruption.trueIndex',
    '吏治.value': 'corruption.trueIndex',
    '吏治.index': 'corruption.trueIndex',
    '腐败': 'corruption.trueIndex',
    '腐败.value': 'corruption.trueIndex',
    '腐败.index': 'corruption.trueIndex',
    '腐败.overall': 'corruption.trueIndex',
    '腐敗': 'corruption.trueIndex',
    '腐敗.value': 'corruption.trueIndex',
    '腐敗.index': 'corruption.trueIndex',
    'corruption.index': 'corruption.trueIndex',
    'corruption.value': 'corruption.trueIndex',
    'corruption.overall': 'corruption.trueIndex',
    'huangquan.value': 'huangquan.index',
    'huangwei.value': 'huangwei.index',
    'minxin.index': 'minxin.trueIndex',
    'minxin.value': 'minxin.trueIndex'
  };
  return root + (aliases[p] || p);
}

function _wtNormalizeCharacterHardChangePath(path) {
  var p = String(path || '').trim().replace(/\s+/g, '');
  p = p.replace(/\[(\d+)\]/g, '.$1');
  var directLoc = p.match(/^(?:人物所在地|角色所在地|NPC所在地|npc所在地)\.(.+)$/);
  if (directLoc) return 'chars.' + directLoc[1] + '.location';
  var directLoyalty = p.match(/^(?:人物忠诚|人物忠诚度|角色忠诚|角色忠诚度|NPC忠诚|NPC忠诚度|npc忠诚|npc忠诚度)\.(.+)$/);
  if (directLoyalty) return 'chars.' + directLoyalty[1] + '.loyalty';
  var m = p.match(/^(?:chars|characters|character|allCharacters|人物|角色|NPC|npc)\.(.+)\.([^.]+)$/);
  if (!m) return '';
  var field = _wtCanonicalCharacterHardChangeField(m[2]);
  if (!field) return '';
  return 'chars.' + m[1] + '.' + field;
}

function _wtCanonicalCharacterHardChangeField(field) {
  var f = String(field || '').trim().replace(/\s+/g, '');
  var aliases = {
    '所在地': 'location',
    '所在': 'location',
    '位置': 'location',
    '地点': 'location',
    '地點': 'location',
    '当前所在地': 'location',
    '目前所在地': 'location',
    'currentLocation': 'location',
    'place': 'location',
    'loc': 'location',
    'location': 'location',
    '忠诚': 'loyalty',
    '忠诚度': 'loyalty',
    '忠誠': 'loyalty',
    '忠誠度': 'loyalty',
    'loyalty': 'loyalty'
  };
  return aliases[f] || f;
}

function _wtHardChangeCharacterLists() {
  var lists = [];
  try {
    if (typeof GM !== 'undefined' && GM && Array.isArray(GM.chars)) lists.push({ name: 'chars', list: GM.chars });
    if (typeof GM !== 'undefined' && GM && Array.isArray(GM.allCharacters) && GM.allCharacters !== GM.chars) lists.push({ name: 'allCharacters', list: GM.allCharacters });
  } catch(_) {}
  return lists;
}

function _wtNormalizeCharacterLookupToken(v) {
  return String(v || '').trim().replace(/\s+/g, '').replace(/[「」『』《》【】\[\]（）()"'“”]/g, '');
}

function _wtFindCharacterHardChangeTarget(target) {
  var t = _wtNormalizeCharacterLookupToken(target);
  if (!t) return null;
  var lists = _wtHardChangeCharacterLists();
  var loose = [];
  for (var li = 0; li < lists.length; li++) {
    var list = lists[li].list;
    for (var i = 0; i < list.length; i++) {
      var ch = list[i];
      if (!ch) continue;
      var keys = [ch.name, ch.id, ch.displayName, ch.fullName, ch.title].map(_wtNormalizeCharacterLookupToken).filter(Boolean);
      if (keys.indexOf(t) >= 0) return { ch: ch, index: i, listName: lists[li].name };
      if (keys.some(function(k){ return k && (k.indexOf(t) >= 0 || t.indexOf(k) >= 0); })) loose.push({ ch: ch, index: i, listName: lists[li].name });
    }
  }
  return loose.length === 1 ? loose[0] : null;
}

function _wtResolveCharacterHardChange(parts) {
  if (!parts || parts.length < 3) return null;
  var rootKey = String(parts[0] || '');
  if (!/^(chars|characters|character|allCharacters|人物|角色|NPC|npc)$/i.test(rootKey)) return null;
  var target = parts[1];
  var field = _wtCanonicalCharacterHardChangeField(parts.slice(2).join('.'));
  if (!field) return null;
  var hit = null;
  var lists = _wtHardChangeCharacterLists();
  if (/^\d+$/.test(String(target || ''))) {
    var idx = parseInt(target, 10);
    var primary = (typeof GM !== 'undefined' && GM && Array.isArray(GM.chars)) ? GM.chars : null;
    if (primary && primary[idx]) hit = { ch: primary[idx], index: idx, listName: 'chars' };
    else if (lists.length && lists[0].list[idx]) hit = { ch: lists[0].list[idx], index: idx, listName: lists[0].name };
  } else {
    hit = _wtFindCharacterHardChangeTarget(target);
  }
  if (!hit || !hit.ch) return null;
  return { ch: hit.ch, index: hit.index, listName: hit.listName, field: field };
}

function _wtMirrorCharacterHardChange(name, fields, deleteKeys) {
  var key = _wtNormalizeCharacterLookupToken(name);
  if (!key) return;
  fields = fields || {};
  deleteKeys = deleteKeys || [];
  _wtHardChangeCharacterLists().forEach(function(entry) {
    entry.list.forEach(function(item) {
      if (!item || _wtNormalizeCharacterLookupToken(item.name) !== key) return;
      Object.keys(fields).forEach(function(k) { item[k] = fields[k]; });
      deleteKeys.forEach(function(k) { try { delete item[k]; } catch(_) {} });
    });
  });
}

function _wtSetCharacterLocationHardChange(ch, value) {
  if (!ch) return;
  var loc = String(value == null ? '' : value).trim();
  ch.location = loc;
  ch.place = loc;
  ch.currentLocation = loc;
  ch.loc = loc;
  var clearTravel = [
    '_travelTo',
    '_travelFrom',
    '_travelStartTurn',
    '_travelRemainingDays',
    '_travelArrival',
    '_travelReason',
    '_travelAssignPost',
    '_travelAssignConcurrent'
  ];
  clearTravel.forEach(function(k) { try { delete ch[k]; } catch(_) {} });
  _wtMirrorCharacterHardChange(ch.name, { location: loc, place: loc, currentLocation: loc, loc: loc }, clearTravel);
}

function _wtApplyScalarHardChange(oldVal, op, value) {
  if (op === 'add') {
    var delta = parseFloat(value);
    if (isNaN(delta)) return { ok: false };
    return { ok: true, value: (Number(oldVal) || 0) + delta };
  }
  if (op === 'mul') {
    var m = parseFloat(value);
    if (isNaN(m)) return { ok: false };
    return { ok: true, value: (Number(oldVal) || 0) * m };
  }
  if (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value.trim())) return { ok: true, value: parseFloat(value) };
  return { ok: true, value: value };
}

var _wtHardChangeRefreshTimer = 0;
var _wtHardChangeDirty = null;

function _wtIsTypingNow() {
  try {
    var el = document && document.activeElement;
    if (!el) return false;
    var tag = String(el.tagName || '').toLowerCase();
    return tag === 'textarea' || tag === 'input' || el.isContentEditable === true;
  } catch (_) { return false; }
}

function _wtIsVisible(id) {
  try {
    var el = document.getElementById(id);
    if (!el) return false;
    var st = window.getComputedStyle ? window.getComputedStyle(el) : null;
    return !st || (st.display !== 'none' && st.visibility !== 'hidden');
  } catch (_) { return false; }
}

function _wtRunIdle(fn, delay) {
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(fn, { timeout: delay || 700 });
  } else {
    setTimeout(fn, delay || 120);
  }
}

function _wtHardChangeImpact(path) {
  var p = String(path || '').replace(/^(GM|gm|P|p)\./, '');
  var d = { left: true, guoku: false, neitang: false, renwu: false, wendui: false, shizheng: false, full: false };
  if (/^guoku\./.test(p)) d.guoku = true;
  else if (/^neitang\./.test(p)) d.neitang = true;
  else if (/^(chars|allCharacters)\./.test(p)) { d.renwu = true; d.wendui = true; }
  else if (/^armies\./.test(p)) d.shizheng = true;
  else if (/^(huangquan|huangwei|minxin|corruption)\./.test(p)) d.shizheng = true;
  else d.full = true;
  return d;
}

function _wtScheduleFullRefreshWhenIdle(retry) {
  retry = retry || 0;
  _wtRunIdle(function() {
    if (_wtIsTypingNow() && retry < 6) {
      setTimeout(function(){ _wtScheduleFullRefreshWhenIdle(retry + 1); }, 600);
      return;
    }
    try { if (typeof renderGameState === 'function') renderGameState(); } catch(_){}
  }, 500);
}

function _wtFlushHardChangeRefresh() {
  var dirty = _wtHardChangeDirty;
  _wtHardChangeDirty = null;
  _wtHardChangeRefreshTimer = 0;
  if (!dirty) return;
  try { if (dirty.left && typeof renderLeftPanel === 'function') renderLeftPanel(); } catch(_){}
  try { if (dirty.guoku && typeof renderGuokuPanel === 'function') renderGuokuPanel(); } catch(_){}
  try { if (dirty.neitang && typeof renderNeitangPanel === 'function') renderNeitangPanel(); } catch(_){}
  try { if (dirty.renwu && typeof renderRenwu === 'function') renderRenwu(); } catch(_){}
  try {
    if (dirty.wendui && _wtIsVisible('gt-wendui') && typeof renderWenduiPanel === 'function') renderWenduiPanel();
  } catch(_){}
  try {
    if (dirty.shizheng && _wtIsVisible('gt-shizheng') && typeof renderShizhengPanel === 'function') renderShizhengPanel();
  } catch(_){}
  try {
    if (typeof GM !== 'undefined' && GM._listeners && Array.isArray(GM._listeners.varChange)) {
      (dirty.events || []).forEach(function(ev) {
        GM._listeners.varChange.forEach(function(fn){ try { fn(ev.path, ev.oldVal, ev.newVal); } catch(_){} });
      });
    }
  } catch(_){}
  if (dirty.full) _wtScheduleFullRefreshWhenIdle(0);
}

function _wtScheduleHardChangeRefresh(normalizedPath, oldVal, newVal) {
  var impact = _wtHardChangeImpact(normalizedPath);
  if (!_wtHardChangeDirty) {
    _wtHardChangeDirty = {
      left: false, guoku: false, neitang: false, renwu: false, wendui: false, shizheng: false, full: false,
      events: []
    };
  }
  Object.keys(impact).forEach(function(k){ if (impact[k]) _wtHardChangeDirty[k] = true; });
  _wtHardChangeDirty.events.push({ path: normalizedPath, oldVal: oldVal, newVal: newVal });
  if (_wtHardChangeRefreshTimer) clearTimeout(_wtHardChangeRefreshTimer);
  _wtHardChangeRefreshTimer = setTimeout(_wtFlushHardChangeRefresh, _wtIsTypingNow() ? 420 : 160);
}

function _wtAfterHardChange(normalizedPath, oldVal, newVal) {
  _wtScheduleHardChangeRefresh(normalizedPath, oldVal, newVal);
  if (typeof addEB === 'function') addEB('\u95EE\u5929', '\u76F4\u6539 ' + normalizedPath + ' \u00B7 ' + oldVal + '\u2192' + newVal);
}

function _wtCleanHardChangeToken(v) {
  return String(v || '').trim()
    .replace(/^[\s，。；、：:,.!?！？"'“”「」『』《》【】\[\]（）()]+/, '')
    .replace(/[\s，。；、：:,.!?！？"'“”「」『』《》【】\[\]（）()]+$/, '');
}

function _wtCanonicalLocationHardChangeValue(v) {
  var loc = _wtCleanHardChangeToken(v);
  if (!loc) return '';
  if (/^(京|京城|在京|入京|赴京)$/.test(loc)) {
    try { return (GM && GM._capital) || '京师'; } catch(_) { return '京师'; }
  }
  return loc;
}

function _wtInferCharacterLocationHardChange(raw) {
  var text = String(raw || '');
  if (!/(所在地|所在|位置|地点|地點|迁|遷|移|抵达|抵達|到达|到達|入京|赴京|召.*京)/.test(text)) return null;
  var chars = [];
  _wtHardChangeCharacterLists().forEach(function(entry) {
    entry.list.forEach(function(ch) {
      if (ch && ch.name) chars.push(ch);
    });
  });
  chars.sort(function(a, b){ return String(b.name || '').length - String(a.name || '').length; });
  for (var i = 0; i < chars.length; i++) {
    var name = String(chars[i].name || '');
    var at = name ? text.indexOf(name) : -1;
    if (at < 0) continue;
    var after = text.slice(at + name.length);
    var m = after.match(/(?:所在地|所在|位置|地点|地點|当前所在地|目前所在地)(?:设为|设置为|改为|改到|改至|变为|變為|为|為|=|：|:)([^，。；、\s]{1,20})/);
    if (!m) m = after.match(/(?:迁到|迁至|遷到|遷至|移到|移至|抵达|抵達|到达|到達|赴|去|入|到|至)([^，。；、\s]{1,20})/);
    var target = m ? _wtCanonicalLocationHardChangeValue(m[1]) : '';
    if (!target && /(入京|赴京|召.*入京|召.*赴京)/.test(text)) target = _wtCanonicalLocationHardChangeValue('京');
    if (target) return { path: 'chars.' + name + '.location', op: 'set', value: target };
  }
  return null;
}

function _wtAugmentParsedHardChange(raw, parsed, forcedCategory) {
  parsed = parsed || {};
  var cat = forcedCategory || parsed.category || '';
  if (cat !== 'hardChange' && cat !== 'absolute') return parsed;
  if (parsed.hardChange && parsed.hardChange.path) return parsed;
  var inferred = _wtInferCharacterLocationHardChange(raw);
  if (!inferred) return parsed;
  parsed.hardChange = inferred;
  if (!parsed.structured) parsed.structured = {};
  parsed.structured.target = parsed.structured.target || String(inferred.path).split('.')[1] || '';
  parsed.structured.action = parsed.structured.action || '修改人物所在地';
  parsed.structured.scope = parsed.structured.scope || 'GM.chars';
  parsed.interpretation = parsed.interpretation || ('将' + parsed.structured.target + '的所在地直接改为' + inferred.value);
  parsed.plan = parsed.plan || '确认后立即写入人物所在地，并清理旧在途状态';
  return parsed;
}

function _wtSetNumericIfPossible(obj, key, value) {
  if (!obj) return;
  var n = Number(value);
  obj[key] = isNaN(n) ? value : n;
}

function _wtSyncHardChangeSideEffects(parts, newVal) {
  var key = parts.join('.');
  var numeric = Number(newVal);
  var hasNumber = !isNaN(numeric);
  function syncCorruptionDeptIndex() {
    if (!GM.corruption || typeof GM.corruption !== 'object') return;
    if (typeof CorruptionEngine !== 'undefined' && CorruptionEngine && typeof CorruptionEngine.syncIndexFromSubDepts === 'function') {
      try { CorruptionEngine.syncIndexFromSubDepts('问天·腐败部门调整'); return; } catch(_) {}
    }
    var vals = [];
    Object.keys(GM.corruption.subDepts || {}).forEach(function(k) {
      var d = GM.corruption.subDepts[k];
      var v = d && typeof d === 'object' ? d.true : d;
      if (typeof v === 'number' && isFinite(v)) vals.push(v);
    });
    if (!vals.length) return;
    var sum = vals.reduce(function(a, b){ return a + b; }, 0);
    GM.corruption.trueIndex = sum / vals.length;
    GM.corruption.overall = GM.corruption.trueIndex;
  }
  if (key === 'guoku.money' && GM.guoku) {
    GM.guoku.balance = GM.guoku.money;
    if (GM.guoku.ledgers && GM.guoku.ledgers.money) GM.guoku.ledgers.money.stock = GM.guoku.money;
  }
  if (key === 'neitang.money' && GM.neitang) {
    GM.neitang.balance = GM.neitang.money;
    if (GM.neitang.ledgers && GM.neitang.ledgers.money) GM.neitang.ledgers.money.stock = GM.neitang.money;
  }
  if (key === 'huangquan.index' && GM.huangquan && typeof GM.huangquan === 'object') {
    _wtSetNumericIfPossible(GM.huangquan, 'index', GM.huangquan.index);
  }
  if (key === 'huangwei.index' && GM.huangwei && typeof GM.huangwei === 'object') {
    _wtSetNumericIfPossible(GM.huangwei, 'index', GM.huangwei.index);
    if (GM.huangwei.subDims && hasNumber) {
      Object.keys(GM.huangwei.subDims).forEach(function(k){
        var d = GM.huangwei.subDims[k];
        if (d && typeof d === 'object' && d.value !== undefined) d.value = numeric;
      });
    }
  }
  if (key === 'minxin.trueIndex' && GM.minxin && typeof GM.minxin === 'object') {
    _wtSetNumericIfPossible(GM.minxin, 'trueIndex', GM.minxin.trueIndex);
    if (GM.minxin.perceivedIndex === undefined && hasNumber) GM.minxin.perceivedIndex = numeric;
  }
  if (key === 'corruption.trueIndex' && GM.corruption && typeof GM.corruption === 'object' && hasNumber) {
    GM.corruption.trueIndex = numeric;
    GM.corruption.overall = numeric;
    if (GM.corruption.perceivedIndex === undefined) GM.corruption.perceivedIndex = numeric;
    if (GM.corruption.subDepts) {
      Object.keys(GM.corruption.subDepts).forEach(function(k){
        var d = GM.corruption.subDepts[k];
        if (d && typeof d === 'object') {
          d.true = numeric;
          if (d.perceived === undefined) d.perceived = numeric;
        }
      });
    }
  }
  var subDeptMatch = key.match(/^corruption\.subDepts\.([^.]+)\.true$/);
  if (subDeptMatch && GM.corruption && typeof GM.corruption === 'object' && hasNumber) {
    var subDept = subDeptMatch[1];
    var byDeptMirror = { imperial: 'palace' }[subDept] || subDept;
    if (!GM.corruption.byDept) GM.corruption.byDept = {};
    GM.corruption.byDept[byDeptMirror] = numeric;
    syncCorruptionDeptIndex();
  }
  var byDeptMatch = key.match(/^corruption\.byDept\.([^.]+)$/);
  if (byDeptMatch && GM.corruption && typeof GM.corruption === 'object' && hasNumber) {
    var byDept = byDeptMatch[1];
    var subDeptMirror = { palace: 'imperial' }[byDept] || byDept;
    if (!GM.corruption.subDepts) GM.corruption.subDepts = {};
    if (!GM.corruption.subDepts[subDeptMirror]) GM.corruption.subDepts[subDeptMirror] = {};
    GM.corruption.subDepts[subDeptMirror].true = numeric;
    syncCorruptionDeptIndex();
  }
}

/** 直接修改 GM/P 字段 */
function _wtCanonicalArmyHardChangeField(field) {
  var f = String(field || '').trim().replace(/\s+/g, '');
  var aliases = {
    '兵力':'soldiers','兵员':'soldiers','兵員':'soldiers','军额':'soldiers','軍額':'soldiers','人数':'soldiers','人數':'soldiers','兵数':'soldiers','兵數':'soldiers','兵':'soldiers','size':'soldiers','strength':'soldiers','soldiers':'soldiers',
    '主帅':'commander','主帥':'commander','统帅':'commander','統帥':'commander','主将':'commander','主將':'commander','将领':'commander','將領':'commander','将帅':'commander','將帥':'commander','commander':'commander','general':'commander','leader':'commander',
    '士气':'morale','士氣':'morale','军心':'morale','軍心':'morale','morale':'morale',
    '训练':'training','訓練':'training','操练':'training','操練':'training','训练度':'training','training':'training',
    '补给':'supply','補給':'supply','粮饷':'supply','糧餉':'supply','供给':'supply','供給':'supply','supply':'supply',
    '忠诚':'loyalty','忠誠':'loyalty','军忠':'loyalty','忠诚度':'loyalty','忠誠度':'loyalty','loyalty':'loyalty',
    '控制':'control','控制度':'control','军纪':'control','軍紀':'control','掌控':'control','control':'control','controlLevel':'control',
    '兵变险':'mutinyRisk','兵變險':'mutinyRisk','兵变风险':'mutinyRisk','兵變風險':'mutinyRisk','mutinyRisk':'mutinyRisk',
    '欠饷':'payArrearsMonths','欠餉':'payArrearsMonths','欠饷月数':'payArrearsMonths','欠餉月數':'payArrearsMonths','payArrearsMonths':'payArrearsMonths'
  };
  return aliases[f] || f;
}

function _wtFindArmyHardChangeTarget(name, allowFuzzy) {
  if (typeof GM === 'undefined' || !GM || !Array.isArray(GM.armies) || !name) return null;
  var t = _wtNormalizeCharacterLookupToken(name);
  if (!t) return null;
  var loose = [];
  for (var i = 0; i < GM.armies.length; i++) {
    var a = GM.armies[i];
    if (!a) continue;
    var keys = [a.name, a.id, a.title].map(_wtNormalizeCharacterLookupToken).filter(Boolean);
    if (keys.indexOf(t) >= 0) return { army: a, index: i };
    if (allowFuzzy && keys.some(function(k){ return k && (k.indexOf(t) >= 0 || t.indexOf(k) >= 0); })) loose.push({ army: a, index: i });
  }
  return (allowFuzzy && loose.length === 1) ? loose[0] : null;
}

// 解析军队 hardChange 路径：armies/军/部队 前缀（允许模糊匹配军名）或 裸军名（只认精确·防误伤 guoku/民心 等 GM 字段路径）
function _wtResolveArmyHardChange(parts) {
  if (!parts || parts.length < 2) return null;
  var prefixes = /^(armies|army|军|軍|军队|軍隊|部队|部隊)$/i;
  var name, field, allowFuzzy;
  if (prefixes.test(String(parts[0] || ''))) {
    if (parts.length < 3) return null;
    name = parts[1];
    field = _wtCanonicalArmyHardChangeField(parts.slice(2).join('.'));
    allowFuzzy = true;
  } else {
    name = parts[0];
    field = _wtCanonicalArmyHardChangeField(parts.slice(1).join('.'));
    allowFuzzy = false;
  }
  if (!name || !field) return null;
  var hit = _wtFindArmyHardChangeTarget(name, allowFuzzy);
  if (!hit || !hit.army) return null;
  return { army: hit.army, index: hit.index, field: field };
}

// 阶层 hardChange 字段规范化（满意度/影响力等中文/英文别名 → 真实字段名）
function _wtCanonicalClassHardChangeField(field) {
  var f = String(field || '').trim().replace(/\s+/g, '');
  var aliases = {
    '满意度':'satisfaction','滿意度':'satisfaction','满意':'satisfaction','滿意':'satisfaction','支持度':'satisfaction','满意度值':'satisfaction','satisfaction':'satisfaction',
    '影响力':'influence','影響力':'influence','影响':'influence','影響':'influence','话语权':'influence','話語權':'influence','影响力值':'influence','influence':'influence',
    '人口':'population','人口数':'population','population':'population',
    '凝聚力':'cohesion','凝聚':'cohesion','cohesion':'cohesion'
  };
  return aliases[f] || f;
}

// 按名查阶层（GM.classes / GM.socialClasses·精确优先·唯一模糊命中兜底·镜像军队查找）
function _wtFindClassHardChangeTarget(name) {
  var lists = [];
  if (typeof GM !== 'undefined' && GM) {
    if (Array.isArray(GM.classes)) lists.push({ list: GM.classes, name: 'classes' });
    if (Array.isArray(GM.socialClasses)) lists.push({ list: GM.socialClasses, name: 'socialClasses' });
  }
  if (!lists.length || !name) return null;
  var t = _wtNormalizeCharacterLookupToken(name);
  if (!t) return null;
  var loose = null, looseCount = 0;
  for (var li = 0; li < lists.length; li++) {
    var arr = lists[li].list;
    for (var i = 0; i < arr.length; i++) {
      var c = arr[i];
      if (!c) continue;
      var keys = [c.name, c.className, c.id].map(_wtNormalizeCharacterLookupToken).filter(Boolean);
      if (keys.indexOf(t) >= 0) return { cls: c, index: i, listName: lists[li].name };
      if (keys.some(function(k){ return k && (k.indexOf(t) >= 0 || t.indexOf(k) >= 0); })) { loose = { cls: c, index: i, listName: lists[li].name }; looseCount++; }
    }
  }
  return (looseCount === 1) ? loose : null;
}

// 解析阶层 hardChange 路径：classes/阶层 前缀，或裸阶层名（裸名须命中真实 class 字段·防误伤 GM 字段路径）
// 治"问天直改 classes[农户].满意度 → 通用导航写到数组幽灵属性 GM.classes['农户']、真阶层不动"的静默失败。
function _wtResolveClassHardChange(parts) {
  if (!parts || parts.length < 2) return null;
  var prefixes = /^(classes|socialClasses|socialClass|class|阶层|階層|阶级|階級|社会阶层|社會階層)$/i;
  var name, field;
  if (prefixes.test(String(parts[0] || ''))) {
    if (parts.length < 3) return null;
    name = parts[1];
    field = _wtCanonicalClassHardChangeField(parts.slice(2).join('.'));
  } else {
    name = parts[0];
    field = _wtCanonicalClassHardChangeField(parts.slice(1).join('.'));
  }
  if (!name || !field) return null;
  if (['satisfaction','influence','population','cohesion'].indexOf(field) < 0) return null; // 只认 class 真实字段·避免裸名误伤
  var hit = _wtFindClassHardChangeTarget(name);
  if (!hit || !hit.cls) return null;
  return { cls: hit.cls, index: hit.index, listName: hit.listName, field: field };
}

// 势力 hardChange 字段规范化（实力/经济/对玩家关系 中英别名 → 真实字段名）
function _wtCanonicalFacHardChangeField(field) {
  var f = String(field || '').trim().replace(/\s+/g, '');
  var aliases = {
    '实力':'strength','實力':'strength','国力':'strength','國力':'strength','兵力':'strength','军力':'strength','軍力':'strength','武力':'strength','strength':'strength','power':'strength',
    '经济':'economy','經濟':'economy','财力':'economy','財力':'economy','富庶':'economy','economy':'economy',
    '对玩家关系':'playerRelation','對玩家關係':'playerRelation','玩家关系':'playerRelation','玩家關係':'playerRelation','关系':'playerRelation','關係':'playerRelation','邦交':'playerRelation','好感':'playerRelation','亲疏':'playerRelation','親疏':'playerRelation','playerRelation':'playerRelation','relation':'playerRelation'
  };
  return aliases[f] || f;
}

// 按名查势力（GM.facs·精确优先·唯一模糊命中兜底·镜像阶层/军队查找）
function _wtFindFacHardChangeTarget(name) {
  if (typeof GM === 'undefined' || !GM || !Array.isArray(GM.facs) || !name) return null;
  var t = _wtNormalizeCharacterLookupToken(name);
  if (!t) return null;
  var loose = null, looseCount = 0;
  for (var i = 0; i < GM.facs.length; i++) {
    var f = GM.facs[i];
    if (!f) continue;
    var keys = [f.name, f.id, f.shortName, f.title].map(_wtNormalizeCharacterLookupToken).filter(Boolean);
    if (keys.indexOf(t) >= 0) return { fac: f, index: i };
    if (keys.some(function(k){ return k && (k.indexOf(t) >= 0 || t.indexOf(k) >= 0); })) { loose = { fac: f, index: i }; looseCount++; }
  }
  return (looseCount === 1) ? loose : null;
}

// 解析势力 hardChange 路径：facs/势力/外邦 前缀，或裸势力名（裸名须命中真实 fac 字段·防误伤 GM 字段路径）
// 治"问天改 facs[后金].实力 → 通用导航写到数组幽灵属性 GM.facs['后金']、真势力不动"的静默失败（与阶层/军队同根）。
function _wtResolveFacHardChange(parts) {
  if (!parts || parts.length < 2) return null;
  var prefixes = /^(facs|faction|factions|fac|势力|勢力|外邦|邦国|邦國|藩镇|藩鎮)$/i;
  var name, field;
  if (prefixes.test(String(parts[0] || ''))) {
    if (parts.length < 3) return null;
    name = parts[1];
    field = _wtCanonicalFacHardChangeField(parts.slice(2).join('.'));
  } else {
    name = parts[0];
    field = _wtCanonicalFacHardChangeField(parts.slice(1).join('.'));
  }
  if (!name || !field) return null;
  if (['strength','economy','playerRelation'].indexOf(field) < 0) return null; // 只认 fac 真实字段·避免裸名误伤
  var hit = _wtFindFacHardChangeTarget(name);
  if (!hit || !hit.fac) return null;
  return { fac: hit.fac, index: hit.index, field: field };
}

// 党派 hardChange 字段规范化（影响力/凝聚力 中英别名 → 真实字段名）
function _wtCanonicalPartyHardChangeField(field) {
  var f = String(field || '').trim().replace(/\s+/g, '');
  var aliases = {
    '影响力':'influence','影響力':'influence','影响':'influence','影響':'influence','话语权':'influence','話語權':'influence','声势':'influence','聲勢':'influence','influence':'influence',
    '凝聚力':'cohesion','凝聚':'cohesion','团结':'cohesion','團結':'cohesion','向心力':'cohesion','cohesion':'cohesion'
  };
  return aliases[f] || f;
}

// 按名查党派（GM.parties·精确优先·唯一模糊命中兜底·镜像势力查找）
function _wtFindPartyHardChangeTarget(name) {
  if (typeof GM === 'undefined' || !GM || !Array.isArray(GM.parties) || !name) return null;
  var t = _wtNormalizeCharacterLookupToken(name);
  if (!t) return null;
  var loose = null, looseCount = 0;
  for (var i = 0; i < GM.parties.length; i++) {
    var p = GM.parties[i];
    if (!p) continue;
    var keys = [p.name, p.id, p.shortName].map(_wtNormalizeCharacterLookupToken).filter(Boolean);
    if (keys.indexOf(t) >= 0) return { party: p, index: i };
    if (keys.some(function(k){ return k && (k.indexOf(t) >= 0 || t.indexOf(k) >= 0); })) { loose = { party: p, index: i }; looseCount++; }
  }
  return (looseCount === 1) ? loose : null;
}

// 解析党派 hardChange 路径：parties/党派/朋党 前缀，或裸党派名（裸名须命中真实 party 字段·防误伤）
function _wtResolvePartyHardChange(parts) {
  if (!parts || parts.length < 2) return null;
  var prefixes = /^(parties|party|党派|黨派|党|黨|朋党|朋黨)$/i;
  var name, field;
  if (prefixes.test(String(parts[0] || ''))) {
    if (parts.length < 3) return null;
    name = parts[1];
    field = _wtCanonicalPartyHardChangeField(parts.slice(2).join('.'));
  } else {
    name = parts[0];
    field = _wtCanonicalPartyHardChangeField(parts.slice(1).join('.'));
  }
  if (!name || !field) return null;
  if (['influence','cohesion'].indexOf(field) < 0) return null; // 只认 party 真实字段·避免裸名误伤
  var hit = _wtFindPartyHardChangeTarget(name);
  if (!hit || !hit.party) return null;
  return { party: hit.party, index: hit.index, field: field };
}

// 区划 hardChange 字段规范化（民心/吏治/田亩/商业/盐矿渔马/解额等 中文别名 → 真实字段路径）
function _wtCanonicalDivisionHardChangeField(field) {
  var f = String(field || '').trim().replace(/\s+/g, '');
  var aliases = {
    '民心': 'minxin', 'minxin': 'minxin',
    '吏治': 'corruption', '腐败': 'corruption', '腐敗': 'corruption', 'corruption': 'corruption',
    '募兵': 'militaryRecruits', '募兵上限': 'militaryRecruits', 'militaryRecruits': 'militaryRecruits',
    '田亩': 'economyBase.farmland', '田畝': 'economyBase.farmland', '耕地': 'economyBase.farmland', 'farmland': 'economyBase.farmland',
    '商业': 'economyBase.commerceVolume', '商業': 'economyBase.commerceVolume', '商业额': 'economyBase.commerceVolume', '商業額': 'economyBase.commerceVolume', 'commerceVolume': 'economyBase.commerceVolume',
    '盐产': 'economyBase.saltProduction', '鹽產': 'economyBase.saltProduction', 'saltProduction': 'economyBase.saltProduction',
    '矿产': 'economyBase.mineralProduction', '礦產': 'economyBase.mineralProduction', 'mineralProduction': 'economyBase.mineralProduction',
    '渔获': 'economyBase.fishingProduction', '漁獲': 'economyBase.fishingProduction', 'fishingProduction': 'economyBase.fishingProduction',
    '马政': 'economyBase.horseProduction', '馬政': 'economyBase.horseProduction', 'horseProduction': 'economyBase.horseProduction',
    '解额': 'economyBase.kejuQuota', '解額': 'economyBase.kejuQuota', 'kejuQuota': 'economyBase.kejuQuota',
    '驿站': 'economyBase.postRelays', '驛站': 'economyBase.postRelays', 'postRelays': 'economyBase.postRelays',
    '道路': 'economyBase.roadQuality', 'roadQuality': 'economyBase.roadQuality'
  };
  if (aliases[f]) return aliases[f];
  if (/^economyBase\./.test(f)) return f;
  return f;
}

// 按名查区划（GM.adminHierarchy 全势力树·精确优先·唯一模糊命中兜底·镜像人物/军队/党派查找范式）
function _wtFindDivisionHardChangeTarget(name) {
  if (typeof GM === 'undefined' || !GM || !GM.adminHierarchy || typeof GM.adminHierarchy !== 'object' || !name) return null;
  var t = _wtNormalizeCharacterLookupToken(name);
  if (!t) return null;
  var exact = null, loose = null, looseCount = 0;
  Object.keys(GM.adminHierarchy).forEach(function (fk) {
    var rootNode = GM.adminHierarchy[fk];
    (function walk(list) {
      if (!Array.isArray(list)) return;
      list.forEach(function (d) {
        if (!d || typeof d !== 'object') return;
        var k = _wtNormalizeCharacterLookupToken(d.name);
        if (k) {
          if (k === t) { if (!exact) exact = d; }
          else if (k.indexOf(t) >= 0 || t.indexOf(k) >= 0) { loose = d; looseCount++; }
        }
        walk(d.divisions || d.children);
      });
    })((rootNode && (rootNode.divisions || rootNode.children)) || []);
  });
  if (exact) return { div: exact };
  return (looseCount === 1) ? { div: loose } : null;
}

// 解析区划 hardChange 路径：divisions/区划/州府 前缀【必须带前缀·区划名太杂不做裸名接管】。
// 治"问天改 divisions[顺天府].economyBase.farmland → 通用导航写 GM.economyBase 幽灵对象、真区划不动"
// 的静默失败（与人物/军队/阶层/势力/党派同根·区划一直是缺口）。
function _wtResolveDivisionHardChange(parts) {
  if (!parts || parts.length < 3) return null;
  var prefixes = /^(divisions|division|区划|區劃|州府|府州|府县|府縣|地方|辖区|轄區)$/i;
  if (!prefixes.test(String(parts[0] || ''))) return null;
  var name = parts[1];
  var field = _wtCanonicalDivisionHardChangeField(parts.slice(2).join('.'));
  if (!name || !field) return null;
  var okField = (field === 'minxin' || field === 'corruption' || field === 'militaryRecruits' || /^economyBase\.[A-Za-z]+$/.test(field));
  if (!okField) return null;
  var hit = _wtFindDivisionHardChangeTarget(name);
  if (!hit || !hit.div) return null;
  return { div: hit.div, field: field };
}

// 按名查官职席位（GM.officeTree·递归 positions·精确优先·唯一模糊兜底）
function _wtFindOfficeHardChangeTarget(name) {
  if (typeof GM === 'undefined' || !GM || !Array.isArray(GM.officeTree) || !name) return null;
  var t = _wtNormalizeCharacterLookupToken(name);
  if (!t) return null;
  var exact = null, loose = null, looseCount = 0;
  (function walk(nodes) {
    if (!Array.isArray(nodes)) return;
    nodes.forEach(function (n) {
      if (!n) return;
      (n.positions || []).forEach(function (pos) {
        if (!pos || !pos.name) return;
        var k = _wtNormalizeCharacterLookupToken(pos.name);
        if (!k) return;
        if (k === t) { if (!exact) exact = pos; }
        else if (k.indexOf(t) >= 0 || t.indexOf(k) >= 0) { loose = pos; looseCount++; }
      });
      walk(n.subs);
    });
  })(GM.officeTree);
  if (exact) return { pos: exact };
  return (looseCount === 1) ? { pos: loose } : null;
}

// 解析官职 hardChange 路径：office/官职 前缀·只认公库 publicTreasury（任免走官制系统·不在问天直改）
function _wtResolveOfficeHardChange(parts) {
  if (!parts || parts.length < 3) return null;
  var prefixes = /^(office|offices|officeTree|官职|官職|职官|職官)$/i;
  if (!prefixes.test(String(parts[0] || ''))) return null;
  var fld = String(parts.slice(2).join('.') || '').trim();
  if (!/^(publicTreasury|公库|公庫)$/.test(fld)) return null;
  var hit = _wtFindOfficeHardChangeTarget(parts[1]);
  if (!hit || !hit.pos) return null;
  return { pos: hit.pos };
}

function _wtApplyHardChange(path, op, value) {
  if (!path) return false;
  // 根据路径前缀决定 root
  var normalizedPath = _wtNormalizeHardChangePath(path);
  var parts = String(normalizedPath).split('.');
  var root;
  if (parts[0] === 'GM' || parts[0] === 'gm') { parts.shift(); root = GM; }
  else if (parts[0] === 'P' || parts[0] === 'p') { parts.shift(); root = P; }
  else root = GM;  // 默认 GM
  if (parts.length === 0) return false;
  if (root === GM) {
    var charChange = _wtResolveCharacterHardChange(parts);
    if (charChange && charChange.ch) {
      var charPath = (charChange.listName || 'chars') + '.' + charChange.index + '.' + charChange.field;
      var oldCharVal = (charChange.field === 'location')
        ? (charChange.ch.location || charChange.ch.place || charChange.ch.currentLocation || charChange.ch.loc || '')
        : charChange.ch[charChange.field];
      var scalar = _wtApplyScalarHardChange(oldCharVal, op || 'set', value);
      if (!scalar.ok) return false;
      if (charChange.field === 'location') _wtSetCharacterLocationHardChange(charChange.ch, scalar.value);
      else {
        charChange.ch[charChange.field] = scalar.value;
        var mirror = {};
        mirror[charChange.field] = scalar.value;
        _wtMirrorCharacterHardChange(charChange.ch.name, mirror, []);
      }
      _wtAfterHardChange(charPath, oldCharVal, scalar.value);
      return true;
    }
    // 军队按名解析（镜像人物处理·治"问天直改军队写到数组幽灵属性 armies['天龙军']、真军不动"的静默失败）
    var armyChange = _wtResolveArmyHardChange(parts);
    if (armyChange && armyChange.army) {
      var _a = armyChange.army, _f = armyChange.field;
      var _armyPath = 'armies.' + armyChange.index + '.' + _f;
      if (_f === 'commander') {
        var _cmdVal = String(value == null ? '' : value).trim();
        try {
          if (typeof TM !== 'undefined' && TM.AIChange && TM.AIChange.Army && typeof TM.AIChange.Army.applyAIArmyChange === 'function') {
            TM.AIChange.Army.applyAIArmyChange({ armyName: _a.name, commander: _cmdVal, reason: '问天直改主帅' }, { source: 'wentian.hardChange' });
          } else { _a.commander = _cmdVal; }
        } catch (_wtCmdE) { _a.commander = _cmdVal; }
        _wtAfterHardChange(_armyPath, '', _cmdVal);
        return true;
      }
      var _oldA = _a[_f];
      var _ascalar = _wtApplyScalarHardChange(_oldA, op || 'set', value);
      if (!_ascalar.ok) return false;
      var _numFields = { soldiers:1, morale:1, training:1, supply:1, loyalty:1, control:1, mutinyRisk:1, payArrearsMonths:1 };
      var _nv = _ascalar.value;
      if (_numFields[_f]) {
        _nv = Math.round(Number(_nv) || 0);
        if (_f === 'morale' || _f === 'training' || _f === 'supply' || _f === 'loyalty' || _f === 'control' || _f === 'mutinyRisk') _nv = Math.max(0, Math.min(100, _nv));
        else _nv = Math.max(0, _nv);
      }
      _a[_f] = _nv;
      if (_f === 'soldiers') { _a.size = _nv; _a.strength = _nv; }   // 与 applier 同口径同步别名
      if (_f === 'control') { _a.controlLevel = _nv; }
      try { if (typeof TM !== 'undefined' && TM.AIChange && TM.AIChange.Army && TM.AIChange.Army.refreshMilitaryViews) TM.AIChange.Army.refreshMilitaryViews(GM); } catch (_wtRmvE) {}
      _wtAfterHardChange(_armyPath, _oldA, _nv);
      return true;
    }
    // 阶层按名解析（镜像军队/人物）·治"问天改 classes[农户].满意度 写到数组幽灵属性、真阶层不动"的静默失败。
    // 问天=god-mode 直改·满意度/影响力直写真阶层对象(0-100 夹取)·不走 gateSatisfaction 总闸(那是每回合信号预算·此处是显式覆盖)。
    var classChange = _wtResolveClassHardChange(parts);
    if (classChange && classChange.cls) {
      var _cls = classChange.cls, _cf = classChange.field;
      var _classPath = classChange.listName + '.' + classChange.index + '.' + _cf;
      var _oldC = _cls[_cf];
      var _cscalar = _wtApplyScalarHardChange(_oldC, op || 'set', value);
      if (!_cscalar.ok) return false;
      var _cnv = Math.round(Number(_cscalar.value) || 0);
      if (_cf === 'population') _cnv = Math.max(0, _cnv);
      else _cnv = Math.max(0, Math.min(100, _cnv)); // satisfaction/influence/cohesion 0-100
      _cls[_cf] = _cnv;
      try { if (typeof TM !== 'undefined' && TM.ClassEngine && typeof TM.ClassEngine.refreshClassPhase === 'function') TM.ClassEngine.refreshClassPhase(GM, _cls); } catch (_wtClsE) {}
      _wtAfterHardChange(_classPath, _oldC, _cnv);
      return true;
    }
    // 势力按名解析（镜像阶层/军队·治"问天改 facs[后金].实力 写到数组幽灵属性、真势力不动"的静默失败）。
    // 问天=god-mode 直改·实力/经济/对玩家关系直写真势力对象（strength/economy 0-100·playerRelation -100..100 夹取）。
    var facChange = _wtResolveFacHardChange(parts);
    if (facChange && facChange.fac) {
      var _fac = facChange.fac, _ff = facChange.field;
      var _facPath = 'facs.' + facChange.index + '.' + _ff;
      var _oldF = _fac[_ff];
      var _fscalar = _wtApplyScalarHardChange(_oldF, op || 'set', value);
      if (!_fscalar.ok) return false;
      var _fnv = Math.round(Number(_fscalar.value) || 0);
      if (_ff === 'playerRelation') _fnv = Math.max(-100, Math.min(100, _fnv));
      else _fnv = Math.max(0, Math.min(100, _fnv)); // strength/economy 0-100
      _fac[_ff] = _fnv;
      _wtAfterHardChange(_facPath, _oldF, _fnv);
      return true;
    }
    // 党派按名解析（镜像势力·治"问天改 parties[东林党].影响力 写到数组幽灵属性、真党派不动"的静默失败）。
    var partyChange = _wtResolvePartyHardChange(parts);
    if (partyChange && partyChange.party) {
      var _pty = partyChange.party, _pf = partyChange.field;
      var _ptyPath = 'parties.' + partyChange.index + '.' + _pf;
      var _oldP = _pty[_pf];
      var _pscalar = _wtApplyScalarHardChange(_oldP, op || 'set', value);
      if (!_pscalar.ok) return false;
      var _pnv = Math.max(0, Math.min(100, Math.round(Number(_pscalar.value) || 0))); // influence/cohesion 0-100
      _pty[_pf] = _pnv;
      _wtAfterHardChange(_ptyPath, _oldP, _pnv);
      return true;
    }
    // 区划按名解析（治"问天改 divisions[顺天府].economyBase.farmland → 通用导航写 GM.economyBase 幽灵对象、真区划不动"）
    var divChange = _wtResolveDivisionHardChange(parts);
    if (divChange && divChange.div) {
      var _dvo = divChange.div, _dfp = divChange.field.split('.');
      var _dCur = _dvo;
      for (var _di = 0; _di < _dfp.length - 1; _di++) {
        var _dk = _dfp[_di];
        if (_dCur[_dk] == null || typeof _dCur[_dk] !== 'object') _dCur[_dk] = {};
        _dCur = _dCur[_dk];
      }
      var _dLast = _dfp[_dfp.length - 1];
      var _dOld = _dCur[_dLast];
      var _dscalar = _wtApplyScalarHardChange(_dOld, op || 'set', value);
      if (!_dscalar.ok) return false;
      var _dnv = _dscalar.value;
      if (divChange.field === 'minxin' || divChange.field === 'corruption') _dnv = Math.max(0, Math.min(100, Math.round(Number(_dnv) || 0)));
      else if (isFinite(Number(_dnv))) _dnv = Math.max(0, Math.round(Number(_dnv) || 0));
      _dCur[_dLast] = _dnv;
      _wtAfterHardChange('divisions.' + (_dvo.name || '') + '.' + divChange.field, _dOld, _dnv);
      return true;
    }
    // 官职公库按名解析（officeTree 按职名找席位·只认 publicTreasury·任免归官制系统）
    var offChange = _wtResolveOfficeHardChange(parts);
    if (offChange && offChange.pos) {
      var _opos = offChange.pos;
      var _oOld = Number(_opos.publicTreasury) || 0;
      var _oscalar = _wtApplyScalarHardChange(_oOld, op || 'set', value);
      if (!_oscalar.ok) return false;
      var _onv = Math.max(0, Math.round(Number(_oscalar.value) || 0));
      _opos.publicTreasury = _onv;
      _wtAfterHardChange('officeTree.' + (_opos.name || '') + '.publicTreasury', _oOld, _onv);
      return true;
    }
    // 人力/徭役农政 god-mode（R5·镜像阶层/军队·治"问天改丁/田/役写数组幽灵属性、真账不动"静默失败·逻辑在 tm-renli）
    try { if (typeof TM !== 'undefined' && TM.Renli && typeof TM.Renli.wtHardChange === 'function' && TM.Renli.wtHardChange(GM, (typeof P !== 'undefined' ? P : null), parts, op, value, _wtAfterHardChange)) return true; } catch (_wtRlE) {}
  }
  // 导航到父对象
  var cur = root;
  for (var i = 0; i < parts.length - 1; i++) {
    var k = parts[i];
    if (cur[k] == null || typeof cur[k] !== 'object') cur[k] = {};
    cur = cur[k];
  }
  var lastKey = parts[parts.length - 1];
  var oldVal = cur[lastKey];
  var applied = _wtApplyScalarHardChange(oldVal, op || 'set', value);
  if (!applied.ok) return false;
  cur[lastKey] = applied.value;
  if (root === GM) _wtSyncHardChangeSideEffects(parts, cur[lastKey]);
  // 立即刷新 UI·让玩家看到数值变化——原只刷 renderLeftPanel 不够·补全帑廪/内帑/七变量/整体
  _wtAfterHardChange(normalizedPath, oldVal, cur[lastKey]);
  return true;
}

function _wtReviseFromPending() {
  var p = _wtPending; if (!p) return;
  var inp = _$('wt-input');
  if (inp) {
    inp.value = p.raw + '\n\n（补充澄清：）';
    inp.focus();
    // 移光标到末尾
    inp.setSelectionRange(inp.value.length, inp.value.length);
  }
  var cb = _$('wt-confirm-box'); if (cb) cb.remove();
  GM._wentianHistory.push({ role: 'system', content: '\u26B2 \u8BF7\u8865\u5145\u6F84\u6E05\u540E\u518D\u53D1' });
  _wtPending = null;
  _wtRenderHistory();
}

function _wtCancelPending() {
  _wtPending = null;
  var cb = _$('wt-confirm-box'); if (cb) cb.remove();
  GM._wentianHistory.push({ role: 'system', content: '\u274C \u5DF2\u53D6\u6D88\u5F55\u5165' });
  _wtRenderHistory();
}

/** 导入文档 */
function _wtImportDoc() {
  var fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.txt,.md,.json,.log';
  fileInput.onchange = function() {
    var file = fileInput.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(e) {
      var text = e.target.result;
      if (!GM._importedMemories) GM._importedMemories = [];
      GM._importedMemories.push({ title: file.name, content: text, type: 'document', turn: GM.turn });
      if (!GM._wentianHistory) GM._wentianHistory = [];
      GM._wentianHistory.push({ role: 'player', content: '\u3010\u5BFC\u5165\u6587\u6863\u3011' + file.name + ' (' + Math.round(text.length/1000) + 'KB)', turn: GM.turn });
      GM._wentianHistory.push({ role: 'system', content: '\u2705 \u6587\u6863\u5DF2\u5BFC\u5165\u4E3A\u63A8\u6F14\u4E0A\u4E0B\u6587\u3002AI\u5C06\u5728\u63A8\u6F14\u65F6\u53C2\u8003\u6B64\u6587\u6863\u5185\u5BB9\u3002' });
      _wtRenderHistory();
      toast('\u6587\u6863\u5DF2\u5BFC\u5165\uFF1A' + file.name);
    };
    reader.readAsText(file);
  };
  fileInput.click();
}

/** 导入对话记录作为NPC记忆 */
function _wtImportMemory() {
  var bg = document.createElement('div');
  bg.style.cssText = 'position:fixed;inset:0;z-index:1300;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;';
  bg.innerHTML = '<div style="background:var(--color-surface);border:1px solid var(--gold-500);border-radius:var(--radius-lg);padding:1.2rem;max-width:500px;width:95%;">'
    + '<div style="font-size:var(--text-sm);color:var(--gold-400);margin-bottom:var(--space-2);">\u6CE8\u5165\u8BB0\u5FC6</div>'
    + '<div style="font-size:var(--text-xs);color:var(--color-foreground-muted);margin-bottom:var(--space-2);">\u7C98\u8D34\u5BF9\u8BDD\u8BB0\u5F55\u6216\u6587\u5B57\uFF0C\u4F5C\u4E3ANPC\u8BB0\u5FC6\u6216\u5168\u5C40\u80CC\u666F\u6CE8\u5165\u63A8\u6F14</div>'
    + '<div style="margin-bottom:var(--space-2);"><label style="font-size:var(--text-xs);color:var(--color-foreground-muted);">\u76EE\u6807NPC\uFF08\u7559\u7A7A=\u5168\u5C40\u80CC\u666F\uFF09</label>'
    + '<input id="wt-mem-target" placeholder="\u89D2\u8272\u540D\uFF08\u53EF\u7559\u7A7A\uFF09" style="width:100%;padding:3px 6px;font-size:var(--text-xs);background:var(--color-elevated);border:1px solid var(--color-border);border-radius:var(--radius-sm);color:var(--color-foreground);font-family:inherit;margin-top:2px;"></div>'
    + '<div style="margin-bottom:var(--space-2);"><label style="font-size:var(--text-xs);color:var(--color-foreground-muted);">\u8BB0\u5FC6\u5185\u5BB9</label>'
    + '<textarea id="wt-mem-content" rows="8" placeholder="\u7C98\u8D34\u5BF9\u8BDD\u8BB0\u5F55\u6216\u80CC\u666F\u6587\u5B57\u2026" style="width:100%;padding:0.4rem;font-size:var(--text-xs);font-family:inherit;background:var(--color-elevated);border:1px solid var(--color-border);border-radius:var(--radius-md);color:var(--color-foreground);margin-top:2px;resize:vertical;"></textarea></div>'
    + '<div style="display:flex;gap:var(--space-2);justify-content:flex-end;">'
    + '<button class="bt bp" onclick="_wtDoImportMemory();this.closest(\'div[style*=fixed]\').remove();">\u6CE8\u5165</button>'
    + '<button class="bt" onclick="this.closest(\'div[style*=fixed]\').remove();">\u53D6\u6D88</button>'
    + '</div></div>';
  document.body.appendChild(bg);
}

function _wtDoImportMemory() {
  var target = (_$('wt-mem-target')||{}).value || '';
  var content = (_$('wt-mem-content')||{}).value || '';
  if (!content.trim()) { toast('\u8BF7\u8F93\u5165\u8BB0\u5FC6\u5185\u5BB9'); return; }

  if (target.trim()) {
    // 写入特定NPC记忆
    if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
      NpcMemorySystem.remember(target.trim(), content.trim(), '\u5E73', 8, '\u5916\u90E8\u5BFC\u5165');
      toast('\u5DF2\u6CE8\u5165' + target + '\u7684\u8BB0\u5FC6');
    }
  }
  // 同时存入全局imported memories（供AI推演参考）
  if (!GM._importedMemories) GM._importedMemories = [];
  GM._importedMemories.push({ title: target ? '\u8BB0\u5FC6\u6CE8\u5165\u2192' + target : '\u5168\u5C40\u80CC\u666F', content: content.trim(), type: 'memory', target: target.trim(), turn: GM.turn });
  if (!GM._wentianHistory) GM._wentianHistory = [];
  GM._wentianHistory.push({ role: 'player', content: '\u3010\u8BB0\u5FC6\u6CE8\u5165\u3011' + (target ? target + '\uFF1A' : '\u5168\u5C40\uFF1A') + content.trim().slice(0,50) + '\u2026', turn: GM.turn });
  GM._wentianHistory.push({ role: 'system', content: '\u2705 \u8BB0\u5FC6\u5DF2\u6CE8\u5165\u3002' + (target ? target + '\u5C06\u8BB0\u4F4F\u6B64\u5185\u5BB9\u3002' : '\u5DF2\u4F5C\u4E3A\u5168\u5C40\u63A8\u6F14\u80CC\u666F\u3002') });
  _wtRenderHistory();
}

/** 清除所有玩家指令 */
function _wtClearDirectives() {
  if (!confirm('\u786E\u5B9A\u6E05\u9664\u6240\u6709\u7384\u5929\u6307\u4EE4\uFF1F')) return;
  GM._playerDirectives = [];
  if (!GM._wentianHistory) GM._wentianHistory = [];
  GM._wentianHistory.push({ role: 'system', content: '\u6240\u6709\u6307\u4EE4\u5DF2\u6E05\u9664\u3002' });
  _wtRenderHistory();
  toast('\u6307\u4EE4\u5DF2\u6E05\u9664');
}

function showCharPopup(charName, evt) {
  // 移除已有的popup
  var old = document.querySelector('.char-popup');
  if (old) old.remove();

  var ch = findCharByName(charName);
  if (!ch) {
    // 未找到·显示"查找档案"弹窗·触发 crystallizePendingCharacter
    _showCharNotFoundPopup(charName, evt);
    return;
  }

  // 构建面板内容
  var html = '<div class="char-popup-header" style="display:flex;gap:8px;align-items:flex-start;">';
  // 立绘头像
  if (ch.portrait) {
    html += '<img src="' + escHtml(ch.portrait) + '" style="width:48px;height:48px;object-fit:cover;border-radius:6px;flex-shrink:0;">';
  }
  html += '<div>';
  var facColor = '#888';
  (GM.facs || []).forEach(function(f) { if (f.name === ch.faction && f.color) facColor = f.color; });
  html += '<div class="char-popup-name" style="color:' + facColor + ';">' + escHtml(ch.name) + '</div>';
  if (ch.title) html += '<div class="char-popup-title">' + escHtml(ch.title) + '</div>';
  if (ch.faction) html += '<div class="char-popup-faction" style="border-color:' + facColor + ';">' + escHtml(ch.faction) + '</div>';
  html += '</div></div>';

  // 核心属性
  html += '<div class="char-popup-stats">';
  var _stats = [
    {label:'忠诚', val:ch.loyalty, max:100, color:(ch.loyalty||50)>60?'var(--celadon-400)':'var(--vermillion-400)'},
    {label:'能力', val:ch.ability||ch.competence||50, max:100, color:'var(--gold-400)'},
    {label:'野心', val:ch.ambition||50, max:100, color:(ch.ambition||50)>70?'var(--vermillion-400)':'var(--color-foreground-muted)'},
    {label:'外交', val:ch.diplomacy||50, max:100, color:'var(--gold-400)'},
    {label:'压力', val:ch.stress||0, max:100, color:(ch.stress||0)>60?'var(--vermillion-400)':'var(--celadon-400)'}
  ];
  _stats.forEach(function(s) {
    var pct = Math.round((s.val || 0) / s.max * 100);
    html += '<div class="char-popup-stat"><span class="stat-label">' + s.label + '</span>';
    html += '<div class="stat-bar"><div class="stat-fill" style="width:' + pct + '%;background:' + s.color + ';"></div></div>';
    html += '<span class="stat-val">' + Math.round(s.val || 0) + '</span></div>';
  });
  html += '</div>';

  // 官职（从官制树提取完整信息）
  var _offInfo = typeof _offGetCharInfo === 'function' ? _offGetCharInfo(charName) : null;
  if (_offInfo && _offInfo.current) {
    var _rkI = typeof getRankInfo === 'function' ? getRankInfo(_offInfo.current.rank) : null;
    html += '<div class="char-popup-info" style="border-left:3px solid var(--gold-400);padding-left:6px;">';
    html += '<div style="font-size:0.78rem;color:var(--gold-400);font-weight:700;">' + escHtml(_offInfo.current.dept) + ' · ' + escHtml(_offInfo.current.pos);
    if (_offInfo.current.rank) html += ' <span style="color:' + (_rkI ? _rkI.color : 'var(--ink-300)') + ';">（' + escHtml(_offInfo.current.rank) + '）</span>';
    html += '</div>';
    html += '<div style="font-size:0.7rem;color:var(--color-foreground-muted);">任期' + _offInfo.current.tenure + '回合';
    if (_offInfo.lastEval) html += ' · 考评：' + escHtml(_offInfo.lastEval.grade||'');
    if (_offInfo.satisfaction) html += ' · ' + escHtml(_offInfo.satisfaction.label);
    html += '</div>';
    html += '</div>';
  } else if (_offInfo && _offInfo.mourning) {
    html += '<div class="char-popup-info" style="color:var(--ink-300);font-size:0.75rem;">丁忧守丧中（因' + escHtml(_offInfo.mourning.parent||'') + '去世）</div>';
  } else if (ch.office || ch.position || ch.officialTitle) {
    html += '<div class="char-popup-info">' + escHtml(ch.officialTitle || ch.office || ch.position) + '</div>';
  }
  // 仕途按钮
  if (_offInfo && _offInfo.career.length > 0) {
    html += '<div style="margin:4px 0;"><button class="bt bsm" style="font-size:0.7rem;" onclick="_offShowCareer(\'' + escHtml(charName).replace(/'/g,"\\'") + '\')">\u67E5\u770B\u5B8C\u6574\u4ED5\u9014</button></div>';
  }
  // 所在地
  if (ch.location) {
    if (ch._travelTo) {
      var _remD = (typeof ch._travelRemainingDays === 'number' && ch._travelRemainingDays > 0) ? ch._travelRemainingDays : 0;
      var _fromL = ch._travelFrom || ch.location;
      html += '<div class="char-popup-info" style="font-size:0.7rem;color:var(--gold-400);">\u5728\u9014\uFF1A' + escHtml(_fromL) + ' \u2192 ' + escHtml(ch._travelTo) + (_remD > 0 ? '\uFF08\u8FD8\u9700 ' + _remD + ' \u65E5\uFF09' : '') + '</div>';
    } else {
      html += '<div class="char-popup-info" style="font-size:0.7rem;">所在：' + escHtml(ch.location) + '</div>';
    }
  }

  // 关系网
  var _rels = [];
  if (GM.rels) {
    Object.keys(GM.rels).forEach(function(k) {
      if (k.indexOf(ch.name) >= 0) {
        var other = k.replace(ch.name, '').replace(/[→←↔\-_]/g, '').trim();
        if (other && GM.rels[k].value !== 0) _rels.push({name: other, val: GM.rels[k].value});
      }
    });
  }
  if (ch.affinities) {
    Object.keys(ch.affinities).forEach(function(k) {
      if (!_rels.find(function(r){return r.name===k;})) {
        _rels.push({name: k, val: ch.affinities[k]});
      }
    });
  }
  if (_rels.length > 0) {
    _rels.sort(function(a,b){return Math.abs(b.val)-Math.abs(a.val);});
    html += '<div class="char-popup-section"><div class="char-popup-section-title">\u5173\u7CFB</div>';
    _rels.slice(0, 4).forEach(function(r) {
      var col = r.val > 0 ? 'var(--celadon-400)' : 'var(--vermillion-400)';
      var icon = r.val > 20 ? '\u2665' : r.val < -20 ? '\u2694' : '\u00B7';
      html += '<div style="font-size:0.72rem;display:flex;justify-content:space-between;"><span>' + icon + ' ' + escHtml(r.name) + '</span><span style="color:' + col + ';">' + (r.val > 0 ? '+' : '') + Math.round(r.val) + '</span></div>';
    });
    html += '</div>';
  }

  // 操作按钮
  html += '<div class="char-popup-actions">';
  if (!ch.isPlayer) {
    html += '<button class="char-popup-btn" onclick="document.querySelector(\'.char-popup\').remove();switchGTab(null,\'gt-wendui\');GM._pendingWenduiChar=\'' + ch.name.replace(/'/g,"\\'") + '\';">\u95EE\u5BF9</button>';
  }
  if (typeof openAppointModal === 'function' && !ch.isPlayer) {
    html += '<button class="char-popup-btn" onclick="document.querySelector(\'.char-popup\').remove();openAppointModal(\'' + ch.name.replace(/'/g,"\\'") + '\');">\u4EFB\u547D</button>';
  }
  html += '<button class="char-popup-btn" onclick="document.querySelector(\'.char-popup\').remove();if(typeof openCharDetail===\'function\')openCharDetail(\'' + ch.name.replace(/'/g,"\\'") + '\');else if(typeof showCharDetail===\'function\')showCharDetail(\'' + ch.name.replace(/'/g,"\\'") + '\');else switchGTab(null,\'gt-renwu\');">\u8BE6\u60C5</button>';
  html += '</div>';

  // 创建popup元素
  var popup = document.createElement('div');
  popup.className = 'char-popup';
  popup.innerHTML = html;
  // 预设 max-height 以便真正超出屏幕时可滚动
  popup.style.maxHeight = 'calc(100vh - 24px)';
  popup.style.overflowY = 'auto';
  popup.style.maxWidth = Math.min(380, window.innerWidth - 24) + 'px';
  document.body.appendChild(popup);

  // 定位·考虑全屏边界·不能超出
  _positionCharPopup(popup, evt);

  // 点击外部关闭
  _installCharPopupOutsideClose(popup);
}

function _installCharPopupOutsideClose(popup) {
  setTimeout(function() {
    function closePopup(e) {
      if (!popup.contains(e.target)) { popup.remove(); document.removeEventListener('mousedown', closePopup); }
    }
    document.addEventListener('mousedown', closePopup);
  }, 50);
}

/** 人物卡片定位·自动适配屏幕·避免溢出 */
function _positionCharPopup(popup, evt) {
  var rect = popup.getBoundingClientRect();
  var _evt = evt || (typeof window !== 'undefined' ? window.event : null);
  var margin = 12;
  var w = rect.width, h = rect.height;
  var vw = window.innerWidth, vh = window.innerHeight;
  var x, y;
  if (_evt && typeof _evt.clientX === 'number' && typeof _evt.clientY === 'number') {
    // 优先右下·若挤边则翻到左边或上方
    x = _evt.clientX + 10;
    y = _evt.clientY + 10;
    // 右边溢出·改放鼠标左侧
    if (x + w > vw - margin) x = Math.max(margin, _evt.clientX - w - 10);
    // 下边溢出·改放鼠标上方
    if (y + h > vh - margin) y = Math.max(margin, _evt.clientY - h - 10);
  } else {
    // 无 evt 信息·居中
    x = Math.max(margin, (vw - w) / 2);
    y = Math.max(margin, (vh - h) / 2);
  }
  // 最终保险·仍溢出时钳制
  if (x + w > vw - margin) x = Math.max(margin, vw - w - margin);
  if (y + h > vh - margin) y = Math.max(margin, vh - h - margin);
  if (x < margin) x = margin;
  if (y < margin) y = margin;
  popup.style.left = x + 'px';
  popup.style.top = y + 'px';
}

/** 未找到人物·弹"查找档案"提示卡·点击按钮调 crystallize 触发详细生成 */
function _showCharNotFoundPopup(charName, evt) {
  var old = document.querySelector('.char-popup');
  if (old) old.remove();
  var popup = document.createElement('div');
  popup.className = 'char-popup';
  var safeName = (charName||'').replace(/'/g, "\\'");
  popup.innerHTML = ''
    + '<div class="char-popup-header" style="display:flex;gap:8px;align-items:flex-start;">'
    +   '<div>'
    +     '<div class="char-popup-name" style="color:var(--amber-400);">' + escHtml(charName) + '</div>'
    +     '<div class="char-popup-title" style="color:var(--ink-300);">\u6863\u6848\u672A\u5F55</div>'
    +   '</div>'
    + '</div>'
    + '<div class="char-popup-info" style="font-size:0.78rem;line-height:1.7;color:var(--color-foreground-muted);margin-top:4px;">'
    +   '\u6B64\u4EBA\u5C1A\u672A\u5F55\u5165\u4EBA\u7269\u5FD7\u3002\u94E8\u66F9\u53EF\u67E5\u627E\u5176\u6765\u5386\u00B7\u5982\u7CFB\u53F2\u5B9E\u4EBA\u7269\u5219\u91C7\u53F2\u4E66\u7ACB\u4F20\u00B7\u5982\u867A\u6784\u5219\u6784\u5176\u8EAB\u4E16\u3002'
    + '</div>'
    + '<div class="char-popup-actions" style="margin-top:8px;">'
    +   '<button class="char-popup-btn" onclick="document.querySelector(\'.char-popup\').remove();_lookupCharDossier(\'' + safeName + '\');">\uD83D\uDCDA \u67E5\u627E\u6863\u6848</button>'
    +   '<button class="char-popup-btn" onclick="document.querySelector(\'.char-popup\').remove();">\u6682\u7F13</button>'
    + '</div>';
  popup.style.maxHeight = 'calc(100vh - 24px)';
  popup.style.overflowY = 'auto';
  popup.style.maxWidth = Math.min(340, window.innerWidth - 24) + 'px';
  document.body.appendChild(popup);
  _positionCharPopup(popup, evt);
  _installCharPopupOutsideClose(popup);
}

/** 查找档案·调 crystallizePendingCharacter·成功后自动弹出 showCharPopup */
async function _lookupCharDossier(charName) {
  if (!charName) return;
  if (typeof findCharByName === 'function' && findCharByName(charName)) {
    showCharPopup(charName);
    return;
  }
  if (typeof crystallizePendingCharacter !== 'function') {
    if (typeof toast === 'function') toast('\u89D2\u8272\u751F\u6210\u6A21\u5757\u672A\u52A0\u8F7D');
    return;
  }
  try {
    // crystallizePendingCharacter 自带"整理档案中"进度条·内部判断史实/虚构
    await crystallizePendingCharacter(charName, { reason: '\u73A9\u5BB6\u67E5\u627E\u6863\u6848' });
    // 成功后展示其卡片
    if (typeof findCharByName === 'function' && findCharByName(charName)) {
      setTimeout(function(){ showCharPopup(charName); }, 300);
    }
  } catch(e) {
    console.warn('[\u67E5\u627E\u6863\u6848] \u5931\u8D25', e);
    if (typeof toast === 'function') toast('\u67E5\u627E\u5931\u8D25\uFF1A' + (e.message || e));
  }
}

if (typeof window !== 'undefined') {
  window._lookupCharDossier = _lookupCharDossier;
  window._showCharNotFoundPopup = _showCharNotFoundPopup;
}

// ============================================================
