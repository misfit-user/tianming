// @ts-check
/// <reference path="types.d.ts" />
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
        try { _cEng.ensureCharResources(ch); } catch(_){}
        try { _cEng.updatePublicTreasuryMirror(ch); } catch(_){}
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
    if (typeof PhaseH !== 'undefined' && typeof PhaseH.init === 'function') PhaseH.init(scriptData);
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

  renderGameState();

  // 时局概览（Turn 1专属）
  if (GM.turn === 1) _showSituationOverview();

  // 触发钩子，各模块在此注入标签页/按钮
  GameHooks.run('enterGame:after');

  // 结束载入进度条（startGame/loadSave 入口若有 showLoading·此时关闭）
  if (typeof hideLoading === 'function') hideLoading();
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

// 开始游戏
// ⚠️⚠️⚠️ 警告：本函数被 tm-patches.js (line 806) startGame=async function(sid){...} 覆盖
//   要修改本函数行为·请去 tm-patches.js 改·此处仅为占位·实际运行版本在 patches 文件
function startGame(sid){
  _dbg('[startGame] 开始启动游戏，sid:', sid);
  _dbg('[startGame] P.scenarios 长度:', P.scenarios ? P.scenarios.length : 'undefined');
  _dbg('[startGame] P._indices:', P._indices);
  _dbg('[startGame] P._indices.scenarioById:', P._indices ? P._indices.scenarioById : 'undefined');

  var sc=findScenarioById(sid);
  _dbg('[startGame] findScenarioById 返回:', sc);

  if(!sc){
    console.error('[startGame] 未找到剧本，sid:', sid);
    _dbg('[startGame] P.scenarios 内容:', P.scenarios);
    toast("\u672A\u627E\u5230");
    return;
  }
  // 剧本完整性校验
  var validation = validateScenario(sc);
  if (!validation.valid) {
    toast('剧本错误: ' + validation.errors.join('; '));
    console.error('[startGame] 剧本校验失败:', validation.errors);
    return;
  }
  if (validation.warnings.length > 0) {
    console.warn('[startGame] 剧本警告:', validation.warnings);
    _dbg('[startGame] 校验警告: ' + validation.warnings.join('; '));
  }
  // M1·模型能力检查·若剧本标 modelRequirements 且当前模型能力不够·提示警告
  try {
    if (sc.modelRequirements && P.ai && P.ai.model) {
      var _req = sc.modelRequirements;
      var _warnings = [];
      var _wlCtx = (typeof _matchModelCtx === 'function') ? _matchModelCtx(P.ai.model) : 0;
      var _wlOut = (typeof _matchModelOutput === 'function') ? _matchModelOutput(P.ai.model) : 0;
      var _measCtx = P.conf._detectedContextK || _wlCtx;
      var _measOutK = P.conf._measuredMaxOutput ? Math.round(P.conf._measuredMaxOutput / 1024) : (P.conf._detectedMaxOutput ? Math.round(P.conf._detectedMaxOutput / 1024) : _wlOut);
      if (_req.minContextK && _measCtx > 0 && _measCtx < _req.minContextK) _warnings.push('上下文 ' + _measCtx + 'K < 推荐 ' + _req.minContextK + 'K');
      if (_req.minOutputK && _measOutK > 0 && _measOutK < _req.minOutputK) _warnings.push('输出 ' + _measOutK + 'K < 推荐 ' + _req.minOutputK + 'K·主推演 JSON 易被截断');
      if (_warnings.length > 0) {
        var _msg = '⚠ 本剧本推荐：' + (_req.recommendedModels||[]).join('/').slice(0,80) + '\n当前模型：' + P.ai.model + '\n\n检出问题：\n  · ' + _warnings.join('\n  · ') + '\n\n' + (_req.warningThreshold||'') + '\n\n是否仍要开始？';
        if (!confirm(_msg)) { toast('已取消·请在设置中更换模型或跑"模型能力校验"'); return; }
      }
    }
  } catch(_mrE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_mrE, 'M1 modelReq check') : console.warn('[M1 modelReq check]', _mrE); }
  _$("scn-page").classList.remove("show");
  _$("launch").style.display="none";_$("bar").style.display="flex";_$("bar-btns").innerHTML="";_$("G").style.display="grid";_$("E").style.display="none";
  _$("shiji-btn").classList.add("show");_$("save-btn").classList.add("show");
  // 进度条·消除载入期黑屏·showLoading 内部 setInterval 自动增长到 95%
  if (typeof showLoading === 'function') showLoading('\u542F\u7528\u5267\u672C\u00B7\u94FA\u9648\u5929\u4E0B\u2026', 8);

  var _prevSaveName=GM.saveName||'';GM={running:true,sid:sid,turn:1,vars:{},rels:{},chars:[],facs:[],items:[],armies:[],evtLog:[],conv:[],busy:false,memorials:[],qijuHistory:[],jishiRecords:[],biannianItems:[],officeTree:P.officeTree?deepClone(P.officeTree):[],wenduiTarget:null,wenduiHistory:{},officeChanges:[],shijiHistory:[],allCharacters:[],classes:[],parties:[],techTree:[],civicTree:[],autoSummary:"",summarizedTurns:[],currentDay:0,eraName:"",eraNames:[],eraState:sc.eraState?deepClone(sc.eraState):(P.eraState?deepClone(P.eraState):{politicalUnity:0.7,centralControl:0.6,legitimacySource:'hereditary',socialStability:0.6,economicProsperity:0.6,culturalVibrancy:0.7,bureaucracyStrength:0.6,militaryProfessionalism:0.5,landSystemType:'mixed',dynastyPhase:'peak',contextDescription:''}),taxPressure:52,playerAbilities:{management:0,military:0,scholarship:0,politics:0},currentIssues:[],pendingConsequences:[],memoryAnchors:[],provinceStats:{},playerPendingTasks:[],playerCharacterId:null,regentSignal:null,regentState:{},npcContext:null,turnChanges:{variables:[],characters:[],factions:[],parties:[],classes:[],military:[],map:[]},_listeners:{},_changeQueue:[],triggeredHistoryEvents:{},rigidTriggers:{},offendGroupScores:{},activeRebounds:[],triggeredOffendEvents:{},_indices:null,postSystem:null,mapData:null,eraStateHistory:[],culturalWorks:[],_forgottenWorks:[],factionRelationsMap:{}};if(_prevSaveName)GM.saveName=_prevSaveName;
// 行政区划：从剧本/P 深拷贝到 GM，税收级联/bridge/aggregate 都读 GM.adminHierarchy
GM.adminHierarchy = (sc && sc.adminHierarchy) ? deepClone(sc.adminHierarchy) : (P.adminHierarchy ? deepClone(P.adminHierarchy) : null);
// 勤政计数（内朝+后朝协同）
GM._courtMeter = { thisTurnCount: 0, missedStreak: 0, diligentStreak: 0, lastCourtTurn: 0 };
GM._pendingShijiModal = { aiReady: false, courtDone: true, payload: null };  // courtDone 默认 true (没开后朝时直接可弹)
GM._courtRecords = [];
// 载入剧本预设关系——角色关系网
if (sc.presetRelations && Array.isArray(sc.presetRelations.npc) && sc.presetRelations.npc.length > 0 && typeof ensureCharRelation === 'function') {
  sc.presetRelations.npc.forEach(function(rel) {
    if (!rel || !rel.charA || !rel.charB) return;
    var rAB = ensureCharRelation(rel.charA, rel.charB);
    var rBA = ensureCharRelation(rel.charB, rel.charA);
    if (!rAB || !rBA) return;
    ['affinity','trust','respect','fear','hostility','conflictLevel'].forEach(function(k) {
      if (rel[k] !== undefined) { rAB[k] = rel[k]; rBA[k] = rel[k]; }
    });
    if (Array.isArray(rel.labels) && rel.labels.length) {
      rel.labels.forEach(function(l) {
        if (rAB.labels.indexOf(l) < 0) rAB.labels.push(l);
        if (rBA.labels.indexOf(l) < 0) rBA.labels.push(l);
      });
    }
    if (Array.isArray(rel.history)) { rAB.history = rel.history.slice(); rBA.history = rel.history.slice(); }
  });
}
// 载入剧本预设关系——势力关系矩阵
if (sc.presetRelations && Array.isArray(sc.presetRelations.faction) && sc.presetRelations.faction.length > 0 && typeof ensureFactionRelation === 'function') {
  sc.presetRelations.faction.forEach(function(rel) {
    if (!rel || !rel.facA || !rel.facB) return;
    var rAB = ensureFactionRelation(rel.facA, rel.facB);
    var rBA = ensureFactionRelation(rel.facB, rel.facA);
    if (!rAB || !rBA) return;
    ['trust','hostility','economicTies','culturalAffinity','kinshipTies','territorialDispute'].forEach(function(k) {
      if (rel[k] !== undefined) { rAB[k] = rel[k]; rBA[k] = rel[k]; }
    });
    if (Array.isArray(rel.historicalEvents)) { rAB.historicalEvents = rel.historicalEvents.slice(); rBA.historicalEvents = rel.historicalEvents.slice(); }
    if (Array.isArray(rel.activeTreaties)) { rAB.activeTreaties = rel.activeTreaties.slice(); rBA.activeTreaties = rel.activeTreaties.slice(); }
  });
}

// 载入剧本预设的历史名作
if (sc.culturalConfig && sc.culturalConfig.enabled && Array.isArray(sc.culturalConfig.presetWorks) && sc.culturalConfig.presetWorks.length > 0) {
  sc.culturalConfig.presetWorks.forEach(function(w) {
    if (!w || !w.author || !w.title) return;
    GM.culturalWorks.push(Object.assign({
      id: 'preset_' + Math.random().toString(36).slice(2, 8),
      turn: 0,
      triggerCategory: 'times',
      trigger: 'preset',
      motivation: 'self_express',
      genre: 'shi',
      mood: '',
      theme: '',
      elegance: 'refined',
      dedicatedTo: [],
      quality: 85,
      politicalRisk: 'low',
      isPreserved: true,
      appreciatedBy: [],
      echoResponses: [],
      isForbidden: false
    }, w));
  });
}

  // 加载经济配置
  if (sc.economyConfig) {
    P.economyConfig = deepClone(sc.economyConfig);
  } else if (!P.economyConfig) {
    P.economyConfig = {
      redistributionRate: 0.3,
      baseIncome: 100
    };
  }

  // 加载诏令样本配置（作者预设典型诏令+风格提示）
  if (sc.edictConfig) {
    P.edictConfig = deepClone(sc.edictConfig);
  } else {
    P.edictConfig = { enabled: true, examples: [], styleNote: '' };
  }

  // 加载岗位系统配置
  if (sc.postSystem) {
    GM.postSystem = deepClone(sc.postSystem);
  } else {
    GM.postSystem = {
      enabled: false,
      posts: []
    };
  }

  var _gs=(typeof sc!=="undefined"&&sc.gameSettings)||{};
  if(_gs.eraName)GM.eraName=_gs.eraName;
  if(_gs.eraNames&&_gs.eraNames.length)GM.eraNames=_gs.eraNames.slice();

  // 加载完整的时间配置
  // 步骤1：如果剧本有time对象，用它作为基础
  if(sc.time && typeof sc.time === 'object'){
    P.time = deepClone(sc.time);
  }
  // 步骤2：gameSettings 始终覆盖（用户在编辑器里设置的优先级最高）
  if(_gs.startYear !== undefined && _gs.startYear !== null && _gs.startYear !== ''){
    P.time.year = Number(_gs.startYear);
    if(P.time.year < 0){ P.time.prefix = '公元前'; P.time.suffix = '年'; }
    else { P.time.prefix = '公元'; P.time.suffix = '年'; }
  }
  if(_gs.startMonth) P.time.startMonth = Number(_gs.startMonth);
  if(_gs.startDay) P.time.startDay = Number(_gs.startDay);
  if(_gs.startLunarMonth) P.time.startLunarMonth = Number(_gs.startLunarMonth);
  if(_gs.startLunarDay) P.time.startLunarDay = Number(_gs.startLunarDay);
  // 回合天数：统一用 daysPerTurn
  if (_gs.daysPerTurn && _gs.daysPerTurn > 0) {
    P.time.daysPerTurn = Number(_gs.daysPerTurn);
  } else if (_gs.turnUnit) {
    // 旧格式兼容
    var _dMap5 = {'\u65E5':1,'\u5468':7,'\u6708':30,'\u5B63':90,'\u5E74':365};
    P.time.daysPerTurn = (_gs.turnDuration||1) * (_dMap5[_gs.turnUnit]||30);
  }
  if (!P.time.daysPerTurn) P.time.daysPerTurn = 30;
  if (_gs.enableGanzhi !== undefined) P.time.enableGanzhi = _gs.enableGanzhi;
  if (_gs.enableGanzhiDay !== undefined) P.time.enableGanzhiDay = _gs.enableGanzhiDay;
  // 年号默认启用（若剧本 gameSettings 未显式设置或为 false，仍启用——年号由即位改元事件议定）
  P.time.enableEraName = (_gs.enableEraName === false) ? false : true;
  if (_gs.eraNames && _gs.eraNames.length > 0) {
    P.time.eraNames = deepClone(_gs.eraNames);
  }

  // 加载剧本的其他配置到 P 对象
  if(sc.military) {
    P.military = deepClone(sc.military);
    // 给 initialTroops sid-tag（编辑器新 schema·剧本注册时未打 sid）
    if (Array.isArray(P.military.initialTroops)) {
      P.military.initialTroops.forEach(function(t) {
        if (!t.sid) t.sid = sid;
        if (!t.id)  t.id  = 'troop_' + Math.random().toString(36).slice(2, 8);
      });
    }
  }
  if(sc.rules) P.rules = deepClone(sc.rules);
  if(sc.timeline) P.timeline = deepClone(sc.timeline);
  if(sc.map) P.map = deepClone(sc.map);
  if(sc.worldSettings) P.worldSettings = deepClone(sc.worldSettings);
  if(sc.government) P.government = deepClone(sc.government);
  if(sc.adminHierarchy) P.adminHierarchy = deepClone(sc.adminHierarchy);
  if(sc.officeTree) P.officeTree = deepClone(sc.officeTree);
  if(sc.officeConfig) P.officeConfig = deepClone(sc.officeConfig);
  // 剧本自定义预设（25 大徭役 / 9 迁徙 / 7 兵制 / 税种 / 制度 覆盖）
  if(sc.customPresets) P.customPresets = deepClone(sc.customPresets);
  // 同步到 window.scriptData.customPresets 供 HistoricalPresets 动态 getter 读取
  try {
    if (typeof window !== 'undefined') {
      if (!window.scriptData) window.scriptData = {};
      if (sc.customPresets) window.scriptData.customPresets = deepClone(sc.customPresets);
    }
  } catch(_cpE) {}
  if(sc.fiscalConfig) P.fiscalConfig = deepClone(sc.fiscalConfig);
  // 把 neicangRules 关键子结构镜像到 GM.fiscal·让 runtime/AI applier 可读可改
  // （tm-fiscal-fixed-expense.js:_calcRoyalStipend 等读 G.fiscal.royalClanPressure）
  try {
    if (P.fiscalConfig && P.fiscalConfig.neicangRules) {
      GM.fiscal = GM.fiscal || {};
      var _nr = P.fiscalConfig.neicangRules;
      if (_nr.royalClanPressure) GM.fiscal.royalClanPressure = deepClone(_nr.royalClanPressure);
      if (_nr.huangzhuangIncome) GM.fiscal.huangzhuangIncome = deepClone(_nr.huangzhuangIncome);
      if (_nr.imperialBusinesses) GM.fiscal.imperialBusinesses = deepClone(_nr.imperialBusinesses);
    }
  } catch(_fcE) { try{window.TM&&TM.errors&&TM.errors.captureSilent(_fcE,'game-loop·fiscalConfig→GM.fiscal');}catch(_){} }
  // 如果officeTree为空但government.nodes有数据，从government.nodes同步
  if((!P.officeTree || P.officeTree.length === 0) && P.government && P.government.nodes && P.government.nodes.length > 0) {
    P.officeTree = deepClone(P.government.nodes);
  }
  // 同步更新 GM.officeTree
  if(P.officeTree && P.officeTree.length>0) GM.officeTree = deepClone(P.officeTree);

  // 官制双向迁移（老↔新字段）——使用统一的 _offMigrateTree，避免字段不一致
  if (GM.officeTree && GM.officeTree.length > 0 && typeof _offMigrateTree === 'function') {
    // 强制重跑迁移（清除 _migrated 标记以确保新字段被同步）
    (function _clearMigrated(ns) { ns.forEach(function(n){ if(n && n.positions) n.positions.forEach(function(p){ if(p) p._migrated=false; }); if(n && n.subs) _clearMigrated(n.subs); }); })(GM.officeTree);
    _offMigrateTree(GM.officeTree);
  }
  // 官职深化字段（公库/陋规/权限/钩子）—— 新剧本首次载入时补默认
  if (GM.officeTree && GM.officeTree.length > 0 && window.TM_OfficeDeep && typeof TM_OfficeDeep.ensurePosDeep === 'function') {
    (function _fixDeep(ns) { ns.forEach(function(n){ if(n && n.positions) n.positions.forEach(function(p){ TM_OfficeDeep.ensurePosDeep(p); }); if(n && n.subs) _fixDeep(n.subs); }); })(GM.officeTree);
  }
  if(sc.techTree) P.techTree = deepClone(sc.techTree);
  if(sc.traitDefinitions && sc.traitDefinitions.length > 0) P.traitDefinitions = deepClone(sc.traitDefinitions);
  if(sc.civicTree) P.civicTree = deepClone(sc.civicTree);
  if(sc.variables) P.variables = deepClone(sc.variables);
  // 规范化：将对象格式的数据转为扁平数组，公式单独存储
  if(P.variables && !Array.isArray(P.variables)){
    var _fv=[];
    if(P.variables.base) P.variables.base.forEach(function(v){ v._category='base'; _fv.push(v); });
    if(P.variables.other) P.variables.other.forEach(function(v){ v._category='other'; _fv.push(v); });
    P._varFormulas = P.variables.formulas || [];
    P.variables=_fv;
  }
  if(P.techTree && !Array.isArray(P.techTree)){var _ft=[];if(P.techTree.military)_ft=_ft.concat(P.techTree.military);if(P.techTree.civil)_ft=_ft.concat(P.techTree.civil);P.techTree=_ft;}
  if(P.civicTree && !Array.isArray(P.civicTree)){var _fc=[];if(P.civicTree.city)_fc=_fc.concat(P.civicTree.city);if(P.civicTree.policy)_fc=_fc.concat(P.civicTree.policy);if(P.civicTree.resource)_fc=_fc.concat(P.civicTree.resource);if(P.civicTree.corruption)_fc=_fc.concat(P.civicTree.corruption);P.civicTree=_fc;}
  // rules保持对象格式{base,combat,economy,diplomacy}，不转为数组
  // (旧版兼容：如果rules已经是数组则保持数组)
  if(sc.openingText) P.openingText = sc.openingText;
  if(sc.globalRules) P.globalRules = sc.globalRules;
  if(sc.mapData) P.mapData = deepClone(sc.mapData);
  if(sc.buildingSystem) P.buildingSystem = deepClone(sc.buildingSystem);
  if(sc.vassalSystem) P.vassalSystem = deepClone(sc.vassalSystem);
  if(sc.titleSystem) P.titleSystem = deepClone(sc.titleSystem);
  if(sc.officialVassalMapping) P.officialVassalMapping = deepClone(sc.officialVassalMapping);
  if(sc.keju) P.keju = deepClone(sc.keju);
  if (sc.engineConstants) {
    GM.engineConstants = deepClone(sc.engineConstants);
    P.engineConstants = deepClone(sc.engineConstants);
  }
  if (Array.isArray(sc.influenceGroups)) {
    GM.influenceGroups = deepClone(sc.influenceGroups);
    P.influenceGroups = deepClone(sc.influenceGroups);
  }
  // 加载势力间关系
  GM.factionRelations = deepClone(sc.factionRelations || P.factionRelations || []);
  // 加载后宫配置到GM.harem
  if(sc.haremConfig) {
    if(!GM.harem) GM.harem = { heirs: [], succession: 'eldest_legitimate', pregnancies: [] };
    GM.harem = Object.assign(GM.harem, deepClone(sc.haremConfig));
  }

  // 加载剧本的角色、势力、党派、阶层等数据到 P 对象
  if(sc.characters) {
    // 移除旧的该剧本的角色，添加新的
    P.characters = (P.characters||[]).filter(function(c){return c.sid!==sid;});
    P.characters = P.characters.concat(sc.characters.map(function(c){c.sid=sid;return c;}));
  }
  if(sc.factions) {
    P.factions = (P.factions||[]).filter(function(f){return f.sid!==sid;});
    P.factions = P.factions.concat(sc.factions.map(function(f){f.sid=sid;return f;}));
  }
  if(sc.parties) {
    P.parties = (P.parties||[]).filter(function(p){return p.sid!==sid;});
    P.parties = P.parties.concat(sc.parties.map(function(p){p.sid=sid;return p;}));
  }
  if(sc.classes) {
    P.classes = (P.classes||[]).filter(function(c){return c.sid!==sid;});
    P.classes = P.classes.concat(sc.classes.map(function(c){c.sid=sid;return c;}));
  }
  if(sc.items) {
    P.items = (P.items||[]).filter(function(i){return i.sid!==sid;});
    P.items = P.items.concat(sc.items.map(function(i){i.sid=sid;return i;}));
  }
  if(sc.relations) {
    P.relations = (P.relations||[]).filter(function(r){return r.sid!==sid;});
    P.relations = P.relations.concat(sc.relations.map(function(r){r.sid=sid;return r;}));
  }

  // 加载事件数据：sc.events 是对象格式 {historical:[], random:[], ...}，需要转换为 P.events 数组格式
  if(sc.events){
    var allEvents = [];
    if(sc.events.historical) allEvents = allEvents.concat(sc.events.historical.map(function(e){e.sid=sid;e.type='historical';return e;}));
    if(sc.events.random) allEvents = allEvents.concat(sc.events.random.map(function(e){e.sid=sid;e.type='random';return e;}));
    if(sc.events.conditional) allEvents = allEvents.concat(sc.events.conditional.map(function(e){e.sid=sid;e.type='conditional';return e;}));
    if(sc.events.story) allEvents = allEvents.concat(sc.events.story.map(function(e){e.sid=sid;e.type='story';return e;}));
    if(sc.events.chain) allEvents = allEvents.concat(sc.events.chain.map(function(e){e.sid=sid;e.type='chain';return e;}));
    // 移除旧的该剧本的事件，添加新的
    P.events = (P.events||[]).filter(function(e){return e.sid!==sid;});
    P.events = P.events.concat(allEvents);
  }

  // 变量加载到GM.vars（含min/max规范化，与doActualStart一致）
  (P.variables||[]).filter(function(v){return v.sid===sid;}).forEach(function(v){
    if(!v.name) return;
    var gv=deepClone(v);
    if(gv.value===undefined) gv.value=parseFloat(gv.defaultValue)||parseFloat(gv.initial)||0;
    gv.value=parseFloat(gv.value)||0;
    if(gv.min===undefined&&gv.minimum!==undefined) gv.min=gv.minimum;
    if(gv.max===undefined&&gv.maximum!==undefined) gv.max=gv.maximum;
    if(gv.min===undefined) gv.min=0;
    if(gv.max===undefined) gv.max=Math.max(100,Math.abs(gv.value)*10);
    gv.min=parseFloat(gv.min)||0;gv.max=parseFloat(gv.max)||100;
    if(gv.max<=gv.min) gv.max=gv.min+100;
    GM.vars[gv.name]=gv;
  });
  GM._varFormulas = (P._varFormulas || []).map(function(f) {
    if (!f.type) f.type = 'income'; // 旧公式默认为收支类型
    if (!f.chains) f.chains = [];
    return f;
  });
  (P.relations||[]).filter(function(r){return r.sid===sid;}).forEach(function(r){GM.rels[r.name]=deepClone(r);});
  GM.chars=(P.characters||[]).filter(function(c){return c.sid===sid;}).map(function(c){
    var _cc = deepClone(c);
    // 兼容：老剧本/存档没有 management 字段 → 默认与 administration 同步值
    if (_cc.management === undefined || _cc.management === null) {
      _cc.management = Math.max(30, Math.min(80, Math.round((_cc.administration || 50) * 0.85 + 5)));
    }
    // 兼容：老数据 traitIds → traits
    if (!Array.isArray(_cc.traits)) {
      if (Array.isArray(_cc.traitIds)) _cc.traits = _cc.traitIds.slice();
      else if (typeof _cc.traits === 'string' && _cc.traits) _cc.traits = _cc.traits.split(/[、，,\/;；]/).map(function(s){return s.trim();}).filter(Boolean);
      else _cc.traits = [];
    }
    // 兼容：关系网 / 作品索引
    if (!_cc.relations || typeof _cc.relations !== 'object') _cc.relations = {};
    if (!Array.isArray(_cc.works)) _cc.works = [];
    if (!Array.isArray(_cc.appreciated)) _cc.appreciated = [];
    return _cc;
  });
  // 势力关系矩阵兜底
  if (!GM.factionRelationsMap || typeof GM.factionRelationsMap !== 'object') GM.factionRelationsMap = {};
  GM.facs=(P.factions||[]).filter(function(f){return f.sid===sid;}).map(function(f){
    var faction = deepClone(f);
    // 初始化封臣系统字段
    if (!faction.vassals) faction.vassals = [];
    if (!faction.liege) faction.liege = null;
    if (!faction.tributeRate) faction.tributeRate = 0.3; // 默认贡奉比例30%
    if (!faction.territories) faction.territories = [];
    return faction;
  });
  GM.items=(P.items||[]).filter(function(t){return t.sid===sid;}).map(function(t){var c=deepClone(t);c.acquired=false;return c;});
  // GM.armies：优先用 initialTroops（编辑器新 schema，完整字段），fallback 到旧 armies 字段
  // 并统一字段：soldiers/size 互相补齐，garrison/location 互相补齐
  var _initTroops = (P.military && P.military.initialTroops || []).filter(function(a){return a.sid===sid;});
  var _legacyArmies = (P.military && P.military.armies || []).filter(function(a){return a.sid===sid;});
  var _troopSrc = _initTroops.length > 0 ? _initTroops : _legacyArmies;
  GM.armies = _troopSrc.map(function(a) {
    var c = deepClone(a);
    // 字段对齐——FixedExpense 读 soldiers；渲染读 size；location/garrison 等同
    if (c.soldiers == null && c.size != null) c.soldiers = c.size;
    if (c.size == null && c.soldiers != null) c.size = c.soldiers;
    if (c.strength == null && c.soldiers != null) c.strength = c.soldiers;
    if (c.location == null && c.garrison != null) c.location = c.garrison;
    if (c.garrison == null && c.location != null) c.garrison = c.location;
    return c;
  });
  if (GM.turn === 1) console.log('[startGame] GM.armies 载入 ' + GM.armies.length + ' 支部队·总兵力=' + GM.armies.reduce(function(s,a){return s+(a.soldiers||0);},0));

  // 应用编辑器预设的封臣关系
  if (P.vassalSystem && P.vassalSystem.vassalRelations && P.vassalSystem.vassalRelations.length > 0) {
    P.vassalSystem.vassalRelations.forEach(function(rel) {
      var vassalFac = GM.facs.find(function(f) { return f.name === rel.vassal; });
      var liegeFac = GM.facs.find(function(f) { return f.name === rel.liege; });
      if (vassalFac && liegeFac) {
        vassalFac.liege = rel.liege;
        vassalFac.tributeRate = rel.tributeRate || 0.3;
        if (rel.vassalType) vassalFac.vassalType = rel.vassalType;
        if (!liegeFac.vassals) liegeFac.vassals = [];
        if (liegeFac.vassals.indexOf(rel.vassal) === -1) liegeFac.vassals.push(rel.vassal);
        // 如果有预设忠诚度，设置封臣首领的忠诚度
        if (rel.loyalty !== undefined) {
          var vRuler = GM.chars.find(function(c) { return c.faction === rel.vassal && (c.position === '\u541B\u4E3B' || c.position === '\u9996\u9886'); });
          if (vRuler) vRuler.loyalty = rel.loyalty;
        }
      }
    });
  }
  // 应用编辑器预设的角色头衔
  if (P.titleSystem && P.titleSystem.characterTitles && P.titleSystem.characterTitles.length > 0) {
    P.titleSystem.characterTitles.forEach(function(ct) {
      var ch = GM.chars.find(function(c) { return c.name === ct.character; });
      if (ch) {
        if (!ch.titles) ch.titles = [];
        ch.titles.push({
          name: ct.titleName || '', level: ct.titleLevel || 5,
          hereditary: ct.hereditary || false, privileges: ct.privileges || [],
          _suppressed: [], grantedTurn: 0, grantedBy: '\u5F00\u5C40\u9884\u8BBE'
        });
      }
    });
  }

  // 推断京城名称（玩家势力首都/剧本背景）
  var _capital = '';
  if (sc && sc.playerInfo && sc.playerInfo.capital) _capital = sc.playerInfo.capital;
  if (!_capital && P.adminHierarchy) {
    var _ahKeys = Object.keys(P.adminHierarchy);
    if (_ahKeys.length > 0) {
      var _ah = P.adminHierarchy[_ahKeys[0]];
      if (_ah && _ah.divisions && _ah.divisions[0]) _capital = _ah.divisions[0].capital || _ah.divisions[0].name || '';
    }
  }
  if (!_capital) _capital = '京城';
  GM._capital = _capital;

  // 初始化GM.letters（鸿雁传书）
  if (!GM.letters) GM.letters = [];
  if (!GM._pendingNpcLetters) GM._pendingNpcLetters = [];
  if (!GM._letterSuspects) GM._letterSuspects = [];
  if (!GM._courierStatus) GM._courierStatus = {};
  if (!GM._routeDisruptions) GM._routeDisruptions = [];
  // 载入编辑器预设的初始驿路阻断
  if (GM._routeDisruptions.length === 0 && P.conf && P.conf.initialRouteDisruptions) {
    P.conf.initialRouteDisruptions.forEach(function(d) {
      GM._routeDisruptions.push({ route: d.route||'', from: d.from||'', to: d.to||'', reason: d.reason||'', resolved: false, turn: 0 });
    });
  }
  if (!GM._npcCorrespondence) GM._npcCorrespondence = [];
  if (!GM._pendingNpcCorrespondence) GM._pendingNpcCorrespondence = [];
  if (!GM._pendingMemorialDeliveries) GM._pendingMemorialDeliveries = [];
  if (!GM._officeCollapsed) GM._officeCollapsed = {};
  if (!GM._ccHeldItems) GM._ccHeldItems = [];
  if (!GM._playerDirectives) GM._playerDirectives = [];
  if (!GM._importedMemories) GM._importedMemories = [];
  if (!GM._wentianHistory) GM._wentianHistory = [];
  if (!Array.isArray(GM._chronicle)) GM._chronicle = []; // 永久编年记录（防御非数组）
  if (!GM._pendingTinyiTopics) GM._pendingTinyiTopics = [];
  if (!GM._chaoyiCount) GM._chaoyiCount = {};
  // 迁移官制树到双层模型
  if (typeof _offMigrateTree === 'function') _offMigrateTree(GM.officeTree);

  // 自动为旧角色匹配 traitIds + 初始化所在地
  if (GM.chars) {
    GM.chars.forEach(function(c) {
      autoAssignTraitIds(c);
      validateTraits(c);
      if (typeof inferPersonalGoal === 'function') inferPersonalGoal(c);
      // 所在地标记：编辑器明确设置→_locationExplicit；未设置→临时默认京城+_locationNeedAI
      if (c.location) {
        c._locationExplicit = true;
      } else {
        c.location = _capital; // 临时默认，后续由逻辑审查AI修正
        c._locationNeedAI = true;
      }
    });
  }

  // 初始化NPC个人目标（如剧本未配置则留空，由AI后续填充）
  if (GM.chars) {
    GM.chars.forEach(function(c) {
      if (!c.personalGoal) c.personalGoal = '';
    });
  }

  // 构建索引系统（性能优化）
  buildIndices();

  // 初始化 AI 缓存系统
  initAICache();

  // 初始化 Unit 系统
  if (P.unitSystem && P.unitSystem.enabled) {
    initUnitSystem();
  }

  // 初始化补给系统
  if (P.supplySystem && P.supplySystem.enabled) {
    initSupplySystem();
  }

  // 初始化建筑系统
  if (P.buildingSystem && P.buildingSystem.enabled) {
    initBuildingSystem();
  }

  // 应用地图模式选择
  if (window._pendingUseMap === false) {
    // 玩家选择AI地理志模式——禁用地图数据
    P.map = P.map || {};
    P.map.enabled = false;
    P.map.regions = [];
    P.map.roads = [];
    GM._useAIGeo = true; // 标记：使用AI地理推断
    console.log('[startGame] AI地理志模式：已禁用地图数据');
  } else {
    GM._useAIGeo = false;
  }
  delete window._pendingUseMap;

  // 初始化地图系统（若有数据则正常初始化，无数据则跳过）
  initGameMap();

  // 初始化省级经济系统
  initProvinceEconomy();

  // 初始化得罪群体系统
  OffendGroupsSystem.initialize();

  // 初始化状态耦合系统
  StateCouplingSystem.initialize();

  // 初始化集权回拨系统
  CentralizationSystem.initialize();

  // 初始化领地产出系统
  TerritoryProductionSystem.initialize();

  // 初始化职位系统
  PositionSystem.initialize();

  // 初始化交互系统
  InteractionSystem.initialize();

  // 初始化矛盾演化系统
  if (typeof ContradictionSystem !== 'undefined') ContradictionSystem.initialize();

  // 初始化 NPC Engine
  NpcEngine.initialize();

  // 鸿雁传书+丁忧考课的 SettlementPipeline 注册已迁移至 tm-hongyan-office.js 文件末尾（top-level）·
  // 修复存档加载路径不走 startGame·导致信件永远不结算的问题。

  // 初始化确定性随机系统
  initRng(sid + '_' + Date.now());
  GM._rngState = getRngState();

  GameHooks.run('startGame:after', sid);
  enterGame();
  generateMemorials();
  toast(typeof getTSText==='function'?getTSText(1):'游戏开始');

  // 新游戏开局自动封存 slot 0，防止玩家试玩未保存即退出
  try {
    if (typeof SaveManager !== 'undefined' && SaveManager.saveToSlot) {
      setTimeout(function(){
        try {
          var _scN = (typeof findScenarioById === 'function') ? findScenarioById(sid) : null;
          var _scName = (_scN && _scN.name) || '新游戏';
          SaveManager.saveToSlot(0, '开局封存·' + _scName + '·第1回合');
        } catch(_e){ (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_e, 'startGame] 开局自动封存失败') : console.warn('[startGame] 开局自动封存失败', _e); }
      }, 1200);
    }
  } catch(_e){}

  // === 即位改元事件（游戏开始时触发） ===
  // 如果剧本没有预设年号，弹出即位改元事件让玩家议定
  if(!GM.eraNames||!GM.eraNames.length){
    setTimeout(function(){ _showEnthronementEvent(sid); }, 600);
  }
}

/**
 * 即位改元事件 —— 新君即位，议定年号
 * 两种选择：依成制（次年改元）/ 即刻改元
 */
function _showEnthronementEvent(sid){
  var sc=findScenarioById(sid);
  var playerName=(sc&&sc.playerInfo&&sc.playerInfo.characterName)||'新君';
  var roleName=(sc&&sc.role)||'天子';
  var di=calcDateFromTurn?calcDateFromTurn(GM.turn):null;
  var curYear=di?di.adYear:(P.time.year||1);
  var curGzYear=di?di.gzYearStr:'';

  var h='<div style="position:fixed;inset:0;z-index:1300;background:rgba(0,0,0,0.9);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(5px);animation:fi 0.3s ease;" id="_enthrone-event">';
  h+='<div class="scn-preview-modal" style="max-width:560px;text-align:center;" onclick="event.stopPropagation();">';

  // 顶部装饰
  h+='<div style="height:2px;background:linear-gradient(90deg,transparent,var(--gold-500),var(--gold-400),var(--gold-500),transparent);margin-bottom:var(--space-4);"></div>';

  // 标题
  h+='<div style="font-size:var(--text-xs);color:var(--vermillion-400);letter-spacing:0.15em;margin-bottom:var(--space-1);">即位大典</div>';
  h+='<div style="font-size:var(--text-xl);font-weight:var(--weight-bold);color:var(--color-primary);letter-spacing:0.15em;">〔新君临朝·议定年号〕</div>';

  // 叙事
  h+='<div class="narrative-text" style="text-align:left;margin:var(--space-4) 0;font-size:var(--text-sm);line-height:var(--leading-loose);">';
  h+='先帝崩逝，'+escHtml(playerName)+'即'+escHtml(roleName)+'位。';
  h+='群臣伏阙，恭请圣裁：新朝肇始，当以何年号纪元？<br><br>';
  h+='<span style="color:var(--color-foreground-muted);font-size:var(--text-xs);">依古制，改元有二途：一曰"踰年改元"，遵先帝遗泽，待旧年号终了，翌年正式启用新元——此为敬天法祖之正道；';
  h+='二曰"即刻改元"，新君乾纲独断，即日废旧号、行新元——此为彰显新政之锐意。</span>';
  h+='</div>';

  // 年号输入
  h+='<div style="margin-bottom:var(--space-4);">';
  h+='<label style="font-size:var(--text-xs);color:var(--gold-400);letter-spacing:0.1em;display:block;margin-bottom:var(--space-1);">钦定年号</label>';
  h+='<input id="_era-name-input" class="edict-input" style="text-align:center;font-size:var(--text-lg);font-weight:var(--weight-bold);letter-spacing:0.2em;max-width:200px;margin:0 auto;" placeholder="如：建元、永平…">';
  h+='</div>';

  h+='<hr class="ink-divider" style="margin:var(--space-3) 0;">';

  // 两个选择
  h+='<div style="display:flex;gap:var(--space-3);margin-bottom:var(--space-3);">';

  // 依成制
  h+='<div style="flex:1;background:var(--color-surface);border:1px solid var(--color-border-subtle);border-radius:var(--radius-md);padding:var(--space-3);cursor:pointer;transition:all 0.2s;" ';
  h+='onmouseover="this.style.borderColor=\'var(--gold-500)\';this.style.boxShadow=\'var(--shadow-sm)\'" ';
  h+='onmouseout="this.style.borderColor=\'var(--color-border-subtle)\';this.style.boxShadow=\'none\'" ';
  h+='onclick="_confirmEnthronement(\'tradition\','+curYear+')">';
  h+='<div style="font-size:var(--text-base);font-weight:var(--weight-bold);color:var(--celadon-400);margin-bottom:var(--space-1);">依成制</div>';
  h+='<div style="font-size:var(--text-xs);color:var(--color-foreground-muted);line-height:var(--leading-normal);">踰年改元——待旧年号之年终了，次年正月方启新元。合乎礼法，群臣归心。</div>';
  h+='</div>';

  // 即刻改元
  h+='<div style="flex:1;background:var(--color-surface);border:1px solid var(--color-border-subtle);border-radius:var(--radius-md);padding:var(--space-3);cursor:pointer;transition:all 0.2s;" ';
  h+='onmouseover="this.style.borderColor=\'var(--vermillion-400)\';this.style.boxShadow=\'var(--shadow-sm)\'" ';
  h+='onmouseout="this.style.borderColor=\'var(--color-border-subtle)\';this.style.boxShadow=\'none\'" ';
  h+='onclick="_confirmEnthronement(\'immediate\','+curYear+')">';
  h+='<div style="font-size:var(--text-base);font-weight:var(--weight-bold);color:var(--vermillion-400);margin-bottom:var(--space-1);">即刻改元</div>';
  h+='<div style="font-size:var(--text-xs);color:var(--color-foreground-muted);line-height:var(--leading-normal);">乾纲独断——即日废旧号、启新元。彰显新政锐意，然或议者以为僭急。</div>';
  h+='</div>';

  h+='</div>';

  // 底部金线
  h+='<div style="height:1px;background:linear-gradient(90deg,transparent,var(--gold-500),transparent);"></div>';

  h+='</div></div>';
  document.body.insertAdjacentHTML('beforeend', h);
  setTimeout(function(){ var inp=document.getElementById('_era-name-input'); if(inp) inp.focus(); },300);
}

/**
 * 确认改元选择
 * @param {string} mode - 'tradition'(踰年) 或 'immediate'(即刻)
 * @param {number} curYear - 当前公元年
 */
function _confirmEnthronement(mode, curYear){
  var nameInput=document.getElementById('_era-name-input');
  var eraName=(nameInput?nameInput.value:'').trim();
  if(!eraName){ toast('请输入年号名'); if(nameInput) nameInput.focus(); return; }

  var overlay=document.getElementById('_enthrone-event');
  if(overlay) overlay.remove();

  var di=calcDateFromTurn?calcDateFromTurn(GM.turn):null;
  var startMonth=di?(di.lunarMonth||1):1;

  if(!GM.eraNames) GM.eraNames=[];
  if(!P.time.eraNames) P.time.eraNames=[];
  // 关键：启用年号显示（否则即使 GM.eraNames 有值，calcDateFromTurn 会跳过）
  P.time.enableEraName = true;

  var narrative='';
  if(mode==='tradition'){
    // 踰年改元：次年正月生效
    var startYear=curYear+1;
    var entry={name:eraName, startYear:startYear, startMonth:1, startDay:1};
    GM.eraNames.push(entry);
    P.time.eraNames.push(entry);
    narrative='群臣山呼，议定年号"'+eraName+'"。依成制，踰年改元——待今岁终了，明年正月即为'+eraName+'元年。\n朝野称颂，以为合乎礼法。';
  } else {
    // 即刻改元：当月生效
    var entry2={name:eraName, startYear:curYear, startMonth:startMonth, startDay:1};
    GM.eraNames.push(entry2);
    P.time.eraNames.push(entry2);
    GM.eraName=eraName; // 立即设置
    narrative='圣旨下，即日改元"'+eraName+'"！新君乾纲独断，废旧号启新元。\n锐意革新之气令人振奋，然朝中亦有老臣私议，以为操之过急。';
  }

  // 记入起居注
  if(GM.qijuHistory){
    GM.qijuHistory.unshift({
      turn:GM.turn,
      date:getTSText?getTSText(GM.turn):'第1回合',
      content:'【即位改元】'+narrative
    });
  }

  // 记入编年
  if(GM.biannianItems){
    GM.biannianItems.unshift({
      turn:GM.turn,
      date:getTSText?getTSText(GM.turn):'',
      title:'新君即位·议定年号"'+eraName+'"',
      content:narrative,
      importance:'high'
    });
  }

  saveP();
  renderLeftPanel();
  toast('年号已定：'+eraName+(mode==='tradition'?' （踰年改元，明年正月生效）':' （即刻改元）'));
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
      {label:'\u5730\u65B9\u8206\u60C5', sub:'\u5404\u9053\u5DDE\u5E9C\u6C11\u60C5', action:'switchGTab(null,"gt-difang");_renderDifangPanel()', icon:'faction', ok:!!P.adminHierarchy, reason:P.adminHierarchy?'':'\u65E0\u884C\u653F\u533A\u5212'}
    ]},
    { label: '\u519B\u4E8B', icon: 'troops', color: 'var(--vermillion-400)', items: [
      {label:'\u519B\u4E8B\u8BCF\u4EE4', sub:'\u8C03\u5175\u9063\u5C06', action:'switchGTab(null,"gt-edict");var el=document.getElementById("edict-mil");if(el)el.focus()', icon:'troops', ok:true},
      {label:'\u5236\u5EA6\u6539\u9769', sub:'\u901A\u8FC7\u8BCF\u4EE4\u53D1\u8D77', action:'switchGTab(null,"gt-edict");var el=document.getElementById("edict-pol");if(el){el.focus();el.placeholder="\u5982\uFF1A\u63A8\u884C\u52DF\u5175\u5236/\u6539\u9769\u7A0E\u5236/\u5B9E\u884C\u79D1\u4E3E...";}', icon:'scroll', ok:true},
      {label:'\u5730\u56FE\u603B\u89C8', sub:'\u52BF\u529B\u5206\u5E03', action:'TM.MapSystem.open("regions")', icon:'map', ok:_canMap().ok, reason:_canMap().reason}
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
    + '<span style="margin-left:auto;font-size:0.6rem;color:var(--ink-300);">\u6307\u4EE4' + GM._playerDirectives.length + ' \u8BB0\u5FC6' + GM._importedMemories.length + '</span>'
    + '</div>'
    // 类别选择器（6 按钮·单选·默认自动）
    + '<div id="wt-cat-bar" style="display:flex;gap:4px;margin-bottom:var(--space-1);flex-wrap:wrap;">'
    + '<span style="font-size:0.6rem;color:var(--ink-300);align-self:center;margin-right:2px;">\u5206\u7C7B\uFF1A</span>'
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
    _cStyle.textContent = '.wt-cat-btn{padding:2px 8px;font-size:0.62rem;background:rgba(184,154,83,0.06);border:1px solid rgba(184,154,83,0.25);color:var(--ink-300);border-radius:3px;cursor:pointer;font-family:inherit;letter-spacing:0.05em;transition:all 0.15s;}'
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
    html += '<div style="font-size:0.65rem;color:var(--gold-400);margin-bottom:var(--space-1);">\u6D3B\u8DC3\u6307\u4EE4 (' + GM._playerDirectives.length + ')</div>';
    GM._playerDirectives.forEach(function(d, i) {
      var statusChip = '';
      if (d._lastStatus === 'followed') statusChip = '<span style="display:inline-block;padding:1px 5px;background:rgba(126,184,167,0.2);color:var(--celadon-400);border-radius:2px;font-size:0.55rem;margin-left:4px;">\u5DF2\u9075</span>';
      else if (d._lastStatus === 'partial') statusChip = '<span style="display:inline-block;padding:1px 5px;background:rgba(201,168,76,0.2);color:var(--amber-400);border-radius:2px;font-size:0.55rem;margin-left:4px;" title="' + escHtml(d._lastReason||'') + '">\u90E8\u5206</span>';
      else if (d._lastStatus === 'ignored') statusChip = '<span style="display:inline-block;padding:1px 5px;background:rgba(192,64,48,0.25);color:#fef4e8;border-radius:2px;font-size:0.55rem;margin-left:4px;" title="' + escHtml(d._lastReason||'') + '">\u2757\u5FFD\u7565\u00D7' + (d._ignoredCount||1) + '</span>';
      else if (d._lastStatus === 'unchecked') statusChip = '<span style="display:inline-block;padding:1px 5px;background:rgba(157,145,125,0.15);color:var(--ink-300);border-radius:2px;font-size:0.55rem;margin-left:4px;">\u672A\u6838</span>';
      else statusChip = '<span style="display:inline-block;padding:1px 5px;background:rgba(184,154,83,0.12);color:var(--gold-300);border-radius:2px;font-size:0.55rem;margin-left:4px;">\u65B0\u5F55</span>';
      var borderCol = d._absolute ? '#b08bc8' : d._lastStatus === 'ignored' ? 'var(--vermillion-400)' : d._lastStatus === 'partial' ? 'var(--amber-400)' : d._lastStatus === 'followed' ? 'var(--celadon-400)' : 'var(--gold-400)';
      var absChip = d._absolute ? '<span style="display:inline-block;padding:1px 6px;background:linear-gradient(135deg,#8e6aa8,#b08bc8);color:#fff;border-radius:2px;font-size:0.55rem;margin-left:4px;font-weight:700;">\u2605\u5929\u610F</span>' : '';
      html += '<div style="display:flex;justify-content:flex-end;margin-bottom:0.4rem;">';
      html += '<div style="max-width:85%;background:var(--color-accent-subtle);border-right:3px solid ' + borderCol + ';border-radius:var(--radius-md) 2px 2px var(--radius-md);padding:0.4rem 0.6rem;font-size:var(--text-xs);">';
      html += '<div style="font-size:0.6rem;color:var(--gold-400);margin-bottom:2px;">T' + (d.turn||'?') + ' ' + (d.type === 'rule' ? '\u89C4\u5219' : d.type === 'correction' ? '\u7EA0\u6B63' : d.type === 'content' ? '\u5185\u5BB9' : '\u6307\u4EE4') + absChip + statusChip + '</div>';
      html += escHtml(d.content);
      if (d.structured) {
        var sParts = [];
        if (d.structured.target) sParts.push('\u5BF9\u8C61:' + d.structured.target);
        if (d.structured.action) sParts.push('\u52A8\u4F5C:' + d.structured.action);
        if (d.structured.scope) sParts.push('\u8303\u56F4:' + d.structured.scope);
        if (d.structured.forbidden) sParts.push('\u7981:' + d.structured.forbidden);
        if (sParts.length > 0) html += '<div style="font-size:0.55rem;color:var(--ink-300);margin-top:2px;font-style:italic;">' + escHtml(sParts.join(' \u00B7 ')) + '</div>';
      }
      if (d._lastEvidence) html += '<div style="font-size:0.55rem;color:var(--celadon-400);margin-top:2px;">\u4E0A\u56DE\u5408\u6267\u884C\uFF1A' + escHtml(d._lastEvidence.slice(0, 60)) + '</div>';
      html += '<button style="font-size:0.55rem;color:var(--vermillion-400);background:none;border:none;cursor:pointer;margin-left:4px;" onclick="GM._playerDirectives.splice(' + i + ',1);_wtRenderHistory();">\u2715</button>';
      html += '</div></div>';
    });
  }
  // 已导入记忆
  if (GM._importedMemories && GM._importedMemories.length > 0) {
    html += '<div style="font-size:0.65rem;color:var(--celadon-400);margin-bottom:var(--space-1);">\u5DF2\u5BFC\u5165\u8BB0\u5FC6 (' + GM._importedMemories.length + ')</div>';
    GM._importedMemories.forEach(function(m, i) {
      html += '<div style="font-size:0.65rem;color:var(--color-foreground-muted);padding:2px 6px;background:var(--color-elevated);border-radius:3px;margin-bottom:2px;display:flex;justify-content:space-between;">';
      html += '<span>' + escHtml((m.title||'').slice(0,40) || m.content.slice(0,40)) + '\u2026</span>';
      html += '<button style="font-size:0.55rem;color:var(--vermillion-400);background:none;border:none;cursor:pointer;" onclick="GM._importedMemories.splice(' + i + ',1);_wtRenderHistory();">\u2715</button>';
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
    if (_wtForceCategory === 'edictSubstitute') forceHint += '（必填 edictText 和 edictChannel·将玩家意图改写为正式诏令措辞）';
  }
  ctx += forceHint;
  var prompt = '你是天命AI推演系统的元指令解析器。玩家刚对你说了一条指令，请：\n'
    + '1. 判断类型 type: rule(持久规则·每回合遵守) / correction(纠正·本回合调整) / content(背景/设定补充) / directive(一次性指令)\n'
    + '2. 判断分类 category（重要）：\n'
    + '   · narrative — 叙事/规则控制：让剧情走向X、让AI行为Y、保护某人、禁止某事发生（例："不要让袁崇焕被处决"、"AI多写诗词"）\n'
    + '   · setting — 世界背景/设定注入：补充剧本的背景信息/状态/历史（例："此时倭寇已平"、"北方去年大旱未记入"）\n'
    + '   · hardChange — 直接修改数值：要求直接改具体数值/字段（例："帑廪+1000万两"、"某NPC忠诚设为100"、"皇威+10"）\n'
    + '       ★【识别规则】只要指令提到：具体金额(万两/石/匹)、具体数值(+N/-N/设为N)、具体字段(国库/帑廪/内帑/忠诚/皇威/皇权/民心等)——必须归入 hardChange。不要误判为 narrative/directive。\n'
    + '       ★【常见路径】白银=guoku.money·粮=guoku.grain·布=guoku.cloth·内帑银=neitang.money·皇威=vars.皇威.value·皇权=vars.皇权.value·民心=vars.民心.value·人物忠诚=chars[N].loyalty\n'
    + '       ★【操作符】"加/增/+"→op:add · "减/扣/-"→op:add(负数) · "设为/改为/="→op:set · "翻倍/x2"→op:mul\n'
    + '       ★【单位换算】1 万两=10000·50 万两=500000·100 万石=1000000·玩家说"100 万"一律写成 1000000 数字不要保留"万"字\n'
    + '   · edictSubstitute — 等同诏令：玩家实际想下诏令的事（例："拨银赈灾"、"罢某某官"、"遣使某国"——这些本该走诏令而非问天）\n'
    + '   · absolute — 天意/至高意志：玩家明确以"天意"、"绝对"、"必须"、"神谕"、"不论如何"、"强制"等词修饰·或语气极强要求无条件落实（例："天意让北虏此回合覆灭"、"必须让此人变心"）——此类由世界法则直接生效·AI 无推辞空间·须在叙事中让其字面发生\n'
    + '3. 解析为结构化约束 structured:{target, action, scope, forbidden, measurable, condition}\n'
    + '4. 若 category=hardChange → 必填 hardChange:{path:"GM/P 字段路径(如 guoku.money)", op:"set|add|mul", value:数字(禁用万/亿汉字·须换算为纯数字)}\n'
    + '5. 若 category=edictSubstitute → 必填 edictText:"改写成诏令正式措辞(30-80字)", edictChannel:"pol|mil|dip|eco|oth"\n'
    + '6. 给出 interpretation（30-80字复述）、ambiguity（歧义数组，可空）、plan（一句话下回合怎样落实）\n'
    + '\n【上下文】\n' + ctx
    + '\n【玩家指令】\n' + content
    + '\n\n返回 JSON：{"type":"rule|correction|content|directive","category":"narrative|setting|hardChange|edictSubstitute","structured":{"target":"","action":"","scope":"","forbidden":"","measurable":"","condition":""},"hardChange":{"path":"","op":"","value":null},"edictText":"","edictChannel":"","interpretation":"...","ambiguity":["..."],"plan":"..."}';

  try {
    var resp = await callAI(prompt, 900);
    var th = _$('wt-thinking'); if (th) th.remove();
    var parsed = (typeof extractJSON === 'function') ? extractJSON(resp) : null;
    if (!parsed) parsed = { interpretation: resp || content, type: type, structured: {}, ambiguity: [], plan: '将在下回合推演时参考此条指令' };
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
  h += '<div style="font-size:0.6rem;margin-bottom:4px;"><span style="color:var(--gold-400);">AI \u89E3\u8BFB \u00B7 </span><span style="color:' + cat.color + ';font-weight:700;">' + escHtml(cat.label) + '</span><span style="color:var(--ink-300);"> \u00B7 ' + escHtml(typeLabel) + ' \u00B7 ' + origin + '</span></div>';
  h += '<div style="font-size:0.58rem;color:var(--ink-300);margin-bottom:4px;font-style:italic;">' + cat.hint + '</div>';
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
  if (sParts.length > 0) h += '<div style="font-size:0.62rem;color:var(--ink-200);padding:4px 6px;background:rgba(10,9,8,0.35);border-radius:3px;margin-bottom:4px;">' + sParts.join('\u3000') + '</div>';
  // hardChange 预览
  if (p.category === 'hardChange' && p.hardChange && p.hardChange.path) {
    var hc = p.hardChange;
    h += '<div style="font-size:0.62rem;color:var(--vermillion-300);padding:4px 6px;background:rgba(192,64,48,0.1);border:1px solid rgba(192,64,48,0.3);border-radius:3px;margin-bottom:4px;font-family:monospace;">\u2696\ufe0e <b>' + escHtml(hc.path) + '</b> <span style="color:var(--ink-200);">' + escHtml(hc.op||'set') + '</span> <b>' + escHtml(String(hc.value)) + '</b></div>';
  }
  // edictText 预览
  if (p.category === 'edictSubstitute' && p.edictText) {
    var chLabel = {pol:'\u653F\u4E8B',mil:'\u519B\u4E8B',dip:'\u5916\u4EA4',eco:'\u7ECF\u6D4E',oth:'\u5176\u4ED6'}[p.edictChannel] || '\u653F\u4E8B';
    h += '<div style="font-size:0.62rem;color:var(--amber-400);padding:4px 6px;background:rgba(201,168,76,0.1);border:1px solid rgba(201,168,76,0.3);border-radius:3px;margin-bottom:4px;">\u8BCF\u4EE4\u8349\u7A3F\u00B7' + escHtml(chLabel) + '\uFF1A<span style="color:var(--color-foreground);">\u300C' + escHtml(p.edictText) + '\u300D</span></div>';
  }
  // 歧义
  if (p.ambiguity && p.ambiguity.length > 0) {
    h += '<div style="font-size:0.62rem;color:var(--amber-400);margin-bottom:4px;">\u26A0 \u6709\u6B67\u4E49\uFF1A';
    p.ambiguity.forEach(function(q){ h += '<div>\u00B7 ' + escHtml(q) + '</div>'; });
    h += '</div>';
  }
  if (p.plan) h += '<div style="font-size:0.62rem;color:var(--celadon-400);margin-bottom:6px;font-style:italic;">\u2192 ' + escHtml(p.plan) + '</div>';
  // 按钮
  h += '<div style="display:flex;gap:6px;">';
  var confirmLbl = p.category === 'absolute' ? '\u964D \u4E0B \u5929 \u610F' : p.category === 'hardChange' ? '\u7ACB \u5373 \u5199 \u5165' : p.category === 'edictSubstitute' ? '\u586B \u5165 \u8BCF \u4EE4' : '\u786E \u8BA4 \u5165 \u5E93';
  h += '<button class="bt bp bsm" onclick="_wtConfirmPending()" style="font-size:0.65rem;' + (p.category==='absolute'?'background:linear-gradient(135deg,#8e6aa8,#b08bc8);color:#fff;':'') + '">' + confirmLbl + '</button>';
  // 手动升级到"至高"的开关（只在非 absolute 时显示）
  if (p.category !== 'absolute') {
    h += '<button class="bt bsm" onclick="_wtPromoteAbsolute()" style="font-size:0.6rem;color:#b08bc8;border-color:#8e6aa8;" title="\u6807\u4E3A\u5929\u610F\u00B7\u4E16\u754C\u6CD5\u5219\u5F3A\u5236\u751F\u6548">\u2605\u6807\u4E3A\u81F3\u9AD8</button>';
  }
  h += '<button class="bt bs bsm" onclick="_wtReviseFromPending()" style="font-size:0.65rem;">\u518D \u8BAE</button>';
  h += '<button class="bt bs bsm" onclick="_wtCancelPending()" style="font-size:0.65rem;color:var(--vermillion-400);">\u53D6 \u6D88</button>';
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

  if (p.category === 'absolute') {
    // 天意·至高意志：标记为 absolute, rule 性质（每回合生效至玩家移除）, 永不 ignore
    dir.type = 'rule';
    dir._absolute = true;
    GM._playerDirectives.push(dir);
    sysMsg = '\u2605 \u5929 \u610F \u5DF2 \u5929 \u5B9A [id=' + did + ']\u00B7\u4E16\u754C\u6CD5\u5219\u76F4\u63A5\u751F\u6548\u00B7AI \u65E0\u63A8\u8FAD';
    GM._wentianHistory.push({ role: 'system', content: sysMsg });
    toast('\u2605 \u5929\u610F\u5DF2\u964D');
  } else if (p.category === 'hardChange' && p.hardChange && p.hardChange.path) {
    // 立即写入 GM/P 数值
    var hc = p.hardChange;
    var ok = _wtApplyHardChange(hc.path, hc.op || 'set', hc.value);
    dir.hardChange = hc;
    dir._immediatelyApplied = !!ok;
    dir._lastStatus = ok ? 'followed' : 'ignored';
    dir._lastReason = ok ? '问天直改即时生效' : '路径未找到/无法修改';
    dir._lastCheckTurn = GM.turn;
    sysMsg = ok
      ? ('\u2696\ufe0e \u5DF2\u5199\u5165\uFF1A' + hc.path + ' ' + (hc.op||'set') + ' ' + hc.value + ' [id=' + did + ']')
      : ('\u26A0 \u8DEF\u5F84\u672A\u627E\u5230\uFF1A' + hc.path);
    GM._playerDirectives.push(dir);
    GM._wentianHistory.push({ role: 'system', content: sysMsg });
    toast(ok ? '\u6570\u503C\u5DF2\u76F4\u6539' : '\u76F4\u6539\u5931\u8D25');
    // 刷新顶栏等
    if (ok && typeof renderLeftPanel === 'function') { try { renderLeftPanel(); } catch(_){} }
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

/** 直接修改 GM/P 字段 */
function _wtApplyHardChange(path, op, value) {
  if (!path) return false;
  // 根据路径前缀决定 root
  var parts = String(path).split('.');
  var root;
  if (parts[0] === 'GM' || parts[0] === 'gm') { parts.shift(); root = GM; }
  else if (parts[0] === 'P' || parts[0] === 'p') { parts.shift(); root = P; }
  else root = GM;  // 默认 GM
  if (parts.length === 0) return false;
  // 导航到父对象
  var cur = root;
  for (var i = 0; i < parts.length - 1; i++) {
    var k = parts[i];
    if (cur[k] == null || typeof cur[k] !== 'object') cur[k] = {};
    cur = cur[k];
  }
  var lastKey = parts[parts.length - 1];
  var oldVal = cur[lastKey];
  if (op === 'add') {
    var delta = parseFloat(value);
    if (isNaN(delta)) return false;
    cur[lastKey] = (Number(oldVal)||0) + delta;
  } else if (op === 'mul') {
    var m = parseFloat(value);
    if (isNaN(m)) return false;
    cur[lastKey] = (Number(oldVal)||0) * m;
  } else {
    // set
    cur[lastKey] = value;
  }
  // 同步 guoku.balance
  if (root === GM && parts[0] === 'guoku' && parts[1] === 'money') {
    if (GM.guoku) GM.guoku.balance = GM.guoku.money;
  }
  // 立即刷新 UI·让玩家看到数值变化——原只刷 renderLeftPanel 不够·补全帑廪/内帑/七变量/整体
  try { if (typeof renderLeftPanel === 'function') renderLeftPanel(); } catch(_){}
  try { if (typeof renderGameState === 'function') renderGameState(); } catch(_){}
  try { if (typeof renderGuokuPanel === 'function') renderGuokuPanel(); } catch(_){}
  try { if (typeof renderNeitangPanel === 'function') renderNeitangPanel(); } catch(_){}
  try { if (typeof renderRenwu === 'function') renderRenwu(); } catch(_){}
  // 变量变化广播·供 delta panel 等监听
  try { if (typeof GM !== 'undefined' && GM._listeners && Array.isArray(GM._listeners.varChange)) {
    GM._listeners.varChange.forEach(function(fn){ try { fn(path, oldVal, cur[lastKey]); } catch(_){} });
  } } catch(_){}
  if (typeof addEB === 'function') addEB('\u95EE\u5929', '\u76F4\u6539 ' + path + ' \u00B7 ' + oldVal + '\u2192' + cur[lastKey]);
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
    html += '<div style="font-size:0.65rem;color:var(--color-foreground-muted);">任期' + _offInfo.current.tenure + '回合';
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
    html += '<div style="margin:4px 0;"><button class="bt bsm" style="font-size:0.65rem;" onclick="_offShowCareer(\'' + escHtml(charName).replace(/'/g,"\\'") + '\')">\u67E5\u770B\u5B8C\u6574\u4ED5\u9014</button></div>';
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
  setTimeout(function() {
    function _closePopup(e) {
      if (!popup.contains(e.target)) { popup.remove(); document.removeEventListener('mousedown', _closePopup); }
    }
    document.addEventListener('mousedown', _closePopup);
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
  setTimeout(function() {
    function _closePopup(e) {
      if (!popup.contains(e.target)) { popup.remove(); document.removeEventListener('mousedown', _closePopup); }
    }
    document.addEventListener('mousedown', _closePopup);
  }, 50);
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
