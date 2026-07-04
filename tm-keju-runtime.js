// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// tm-keju-runtime.js — 科举考试运行时 (R125 从 tm-chaoyi.js L2782-end 拆出)
// 历史：此部分原在 tm-audio-theme.js·后迁入 tm-chaoyi-keju.js·R112 拆时错误留在 chaoyi 侧
// 姊妹：tm-keju.js (UI/启动) + tm-chaoyi.js (朝议)
// 包含：initKejuSystem/advanceKejuByDays/阶段切换/考官/20 答卷 AI 生成等
//
// R159 章节导航 (3200 行)：
//   §1 [L10]   initKejuSystem 入口 + 字段初始化
//   §2 [L100]  advanceKejuByDays 推进器 + 阶段切换 _finalizeStageAndAdvance
//   §3 [L500]  payKejuLocalCost / payKejuCentralCost 经费回落
//   §4 [L800]  会试题奏疏生成 (主考官 AI)
//   §5 [L1200] 殿试主持选任 + pickHistoricalCandidates AI 检索
//   §6 [L1700] 20 卷答卷 AI 生成 + 考官建议
//   §7 [L2400] 钦定三甲 UI + 进士池填缺
//   §8 [L2800] 懒加载具象化 + 阶层党派影响
// ============================================================

// ============================================================
// 科举考试系统（从 tm-audio-theme.js 移入）
// ============================================================
async function initKejuSystem(scenario) {
  var era = scenario.era || scenario.dynasty || '';

  // 初始化扩展字段
  if (!P.keju.tiers) P.keju.tiers = [];
  if (!P.keju.chiefExaminer) P.keju.chiefExaminer = '';
  if (!P.keju.alternativeSystem) P.keju.alternativeSystem = '';

  // ═══ v5·阶段时长（天数·可被剧本 override）═══
  if (!P.keju.stageDurationDays) {
    P.keju.stageDurationDays = (scenario.keju && scenario.keju.stageDurationDays) || {
      proposal:               30,   // 朝议筹办 1 月
      preliminary_local:      60,   // 童/府/院试 2 月
      preliminary_provincial: 90,   // 乡试 3 月（秋闱）
      examiner_select:        30,   // 选考官 1 月
      huishi_draft:           30,   // 主考官拟题 1 月
      huishi:                 60,   // 会试 2 月
      dianshi_draft:          15,   // 殿试拟题 半月
      dianshi:                30,   // 殿试阅卷+钦定 1 月
      finished:                0
    };
  }

  // ═══ v5·经费配置（可被剧本 override）═══
  if (!P.keju.costs) {
    P.keju.costs = (scenario.keju && scenario.keju.costs) || {
      local:      { perCounty: 80, perPrefecture: 250, perProvinceExam: 500 },
      provincial: { perProvince: 1000 },
      examiner:   500,
      huishi:     10000,
      dianshi:    4000,
      enkeMultiplier: 1.3
    };
  }

  // ═══ v5·属性加成（童生→状元 9 档·可被剧本 override）═══
  if (!P.keju.attributeBonus) {
    P.keju.attributeBonus = (scenario.keju && scenario.keju.attributeBonus) || {
      tongsheng:  { fame: 1,  virtue: 0 },  // 童生·县试通过
      xiucai:     { fame: 5,  virtue: 3 },  // 秀才·院试通过
      juren:      { fame: 10, virtue: 6 },  // 举人·乡试通过
      gongshi:    { fame: 18, virtue: 12 }, // 贡士·会试通过
      zhuangyuan: { fame: 35, virtue: 18 }, // 状元
      bangyan:    { fame: 28, virtue: 14 }, // 榜眼
      tanhua:     { fame: 22, virtue: 12 }, // 探花
      erjia:      { fame: 15, virtue: 8 },  // 二甲进士（4-20）
      sanjia:     { fame: 10, virtue: 5 }   // 三甲同进士（21+）
    };
  }

  // ═══ v5·历史名臣策略（剧本提供；默认按游戏模式自适应）═══
  if (!P.keju.historicalFigurePolicy) {
    P.keju.historicalFigurePolicy = (scenario.keju && scenario.keju.historicalFigurePolicy) || {
      enableHistorical: true,
      historicalAccuracy: 'auto',  // auto | strict | light | yanyi
      excludeIds: []
    };
  }

  // ═══ v5·跨场历史名臣去重池（运行时累积·new game 重置）═══
  if (!P.keju._historicalFiguresUsed) P.keju._historicalFiguresUsed = [];

  // v7.1\u00B7B2\u00B7preset fallback\u00B7\u82E5 scenario.keju \u7F3A\u00B7\u6309\u671D\u4EE3 default
  var preset = null;
  try { preset = (typeof _kjGetPresetByEra === 'function') ? _kjGetPresetByEra(era) : null; } catch(_) {}
  if (preset) {
    if (preset.specialExamCalendar && !P.keju.specialExamCalendar) P.keju.specialExamCalendar = preset.specialExamCalendar;
    if (preset.schoolNetworkInit && !P.keju.schoolNetworkInit) P.keju.schoolNetworkInit = preset.schoolNetworkInit;
    if (preset.eunuchInterferenceInit && !P.keju.eunuchInterferenceInit) P.keju.eunuchInterferenceInit = preset.eunuchInterferenceInit;
    if (preset.discipleGraphSeed && !P.keju.discipleGraphSeed) P.keju.discipleGraphSeed = preset.discipleGraphSeed;
  }

  // v7.1·audit P0·剧本明示 enabled (boolean) → 尊重·禁 LLM/preset 覆盖 (绍宋建炎元年八月案)
  var _scenarioEnabledExplicit = (scenario.keju && typeof scenario.keju.enabled === 'boolean');

  if (!P.ai.key) {
    P.keju.enabled = _scenarioEnabledExplicit ? scenario.keju.enabled : (preset ? preset.enabled : isKejuEra(era));
    if (P.keju.enabled) {
      P.keju.examIntervalNote = preset ? (preset.examIntervalNote || '\u672C\u671D\u4E09\u5E74\u4E00\u79D1') : '\u672C\u671D\u4E09\u5E74\u4E00\u79D1';
      P.keju.tiers = (preset && preset.tiers && preset.tiers.length) ? preset.tiers : _getDefaultTiers(era);
    }
    // v7.1\u00B7B1\u00B7tier \u5168\u5B57\u6BB5\u8865\u9F50 + \u6D3E\u751F stageDurationDays
    _kjFinalizeTiersAndDict(P.keju, scenario);
    // v7.1\u00B7C2\u00B7\u6D3E\u7CFB\u7D27\u5F20\u5EA6 namespace init
    if (typeof _kjInitFactionTension === 'function') _kjInitFactionTension();
    // v7.1\u00B7E1\u00B7mentor \u53CD\u5411\u7D22\u5F15 namespace init
    if (typeof _kjInitMentorIndex === 'function') _kjInitMentorIndex();
    if (typeof _kjInitDiscipleGraph === 'function') _kjInitDiscipleGraph();
    return;
  }

  try {
    var prompt = '\u4F60\u662F\u4E2D\u56FD\u53E4\u4EE3\u79D1\u4E3E\u5236\u5EA6\u4E13\u5BB6\u3002\u8BF7\u6839\u636E\u4EE5\u4E0B\u671D\u4EE3\u914D\u7F6E\u79D1\u4E3E\u4F53\u7CFB\u3002\n\n' +
      '\u3010\u5267\u672C\u3011\u65F6\u4EE3\uFF1A' + era + '\n\u80CC\u666F\uFF1A' + (scenario.background || '').substring(0, 200) + '\n\n' +
      '\u8FD4\u56DEJSON\uFF1A\n{\n' +
      '  "enabled": true/false,\n' +
      '  "reason": "\u539F\u56E0",\n' +
      '  "intervalNote": "\u5982\u4E09\u5E74\u4E00\u79D1",\n' +
      '  "alternativeSystem": "\u975E\u79D1\u4E3E\u671D\u4EE3\u586B\u5199\u66FF\u4EE3\u5236\u5EA6\u540D\u79F0\u5982\u5BDF\u4E3E\u5236/\u4E5D\u54C1\u4E2D\u6B63\u5236",\n' +
      '  "tiers": [\n' +
      '    {"name":"\u89E3\u8BD5/\u4E61\u8BD5","level":"local","interactive":false,"desc":"\u5730\u65B9\u9009\u62D4\uFF0C\u81EA\u52A8\u6A21\u62DF"},\n' +
      '    {"name":"\u7701\u8BD5/\u4F1A\u8BD5","level":"national","interactive":true,"desc":"\u5168\u56FD\u8003\u8BD5\uFF0C\u73A9\u5BB6\u53EF\u53C2\u4E0E\u51FA\u9898"},\n' +
      '    {"name":"\u6BBE\u8BD5","level":"imperial","interactive":true,"desc":"\u5929\u5B50\u4EB2\u7B56\uFF0C\u73A9\u5BB6\u51FA\u9898"}\n' +
      '  ],\n' +
      '  "subjects": "\u8FDB\u58EB\u79D1/\u660E\u7ECF\u79D1\u7B49",\n' +
      '  "features": "\u7279\u8272\u63CF\u8FF050\u5B57(\u5982\u7CCA\u540D\u5236\u3001\u8A8A\u5F55\u5236\u7B49)"\n' +
      '}\n\n' +
      '\u6CE8\u610F\uFF1A\n- \u5510\u4EE3\uFF1A\u89E3\u8BD5\u2192\u7701\u8BD5\u2192\u6BBE\u8BD5\uFF0C\u6BCF\u5E74\u4E00\u79D1\uFF0C\u4E0D\u7CCA\u540D\n' +
      '- \u5B8B\u4EE3\uFF1A\u89E3\u8BD5\u2192\u7701\u8BD5\u2192\u6BBE\u8BD5\uFF0C\u4E09\u5E74\u4E00\u79D1\uFF0C\u5F00\u59CB\u7CCA\u540D\n' +
      '- \u660E\u6E05\uFF1A\u53BF\u8BD5\u2192\u5E9C\u8BD5\u2192\u9662\u8BD5\u2192\u4E61\u8BD5\u2192\u4F1A\u8BD5\u2192\u6BBE\u8BD5\uFF0C\u4E09\u5E74\u4E00\u79D1\n' +
      '- \u9699\u4EE5\u524D\uFF1Aenabled=false\uFF0C\u586B\u5199alternativeSystem\n' +
      '\u53EA\u8F93\u51FAJSON\u3002';

    var result = await callAISmart(prompt, 800, {maxRetries: 2});
    var data = JSON.parse(result.replace(/```json|```/g, '').trim());

    // v7.1·audit P0·剧本明示 enabled (boolean) → 优先 (LLM 不可覆盖)
    P.keju.enabled = _scenarioEnabledExplicit ? scenario.keju.enabled : (data.enabled || false);
    P.keju.examIntervalNote = data.intervalNote || (scenario.keju && scenario.keju.examIntervalNote) || '';
    P.keju.alternativeSystem = data.alternativeSystem || '';
    if (data.tiers && Array.isArray(data.tiers)) P.keju.tiers = data.tiers;
    else P.keju.tiers = _getDefaultTiers(era);
    if (data.subjects && !P.keju.examSubjects) P.keju.examSubjects = data.subjects;
    if (data.features && !P.keju.specialRules) P.keju.specialRules = data.features;

    // v7.1\u00B7B1\u00B7tier \u5168\u5B57\u6BB5\u8865\u9F50 + \u6D3E\u751F stageDurationDays
    _kjFinalizeTiersAndDict(P.keju, scenario);
    // v7.1\u00B7C2\u00B7\u6D3E\u7CFB\u7D27\u5F20\u5EA6 namespace init
    if (typeof _kjInitFactionTension === 'function') _kjInitFactionTension();
    // v7.1\u00B7E1\u00B7mentor \u53CD\u5411\u7D22\u5F15 namespace init
    if (typeof _kjInitMentorIndex === 'function') _kjInitMentorIndex();
    if (typeof _kjInitDiscipleGraph === 'function') _kjInitDiscipleGraph();
    // Stage 2\u00B7Phase G\u00B7G1\u00B7\u7279\u79D1 calendar init (flag gate inside)
    if (typeof _kjInitSpecialExamCalendar === 'function') {
      try { _kjInitSpecialExamCalendar(); }
      catch(e) { try { console.warn('[G1] special exam calendar init failed', e); } catch(_){} }
    }
    // Stage 2\u00B7L1\u00B7KejuParadigm \u5730\u57FA init
    if (typeof _kjpInitParadigm === 'function') {
      try { _kjpInitParadigm({ initBy: 'init' }); }
      catch(e) { try { console.warn('[L1] paradigm init failed', e); } catch(_){} }
    }
    // Stage 2\u00B7L8\u00B7cross-scenario inheritance hook (\u8DE8\u4EE3\u627F\u88AD\u00B7localStorage archive)
    if (typeof _initKejuL8Hook === 'function') {
      try { _initKejuL8Hook(); }
      catch(e) { try { console.warn('[L8] init hook failed', e); } catch(_){} }
    }

    _dbg('[\u79D1\u4E3E\u5236\u5EA6] \u521D\u59CB\u5316:', data.enabled ? '\u5DF2\u542F\u7528' : '\u672A\u542F\u7528', data.reason);
    if (data.enabled) toast('\uD83D\uDCDC \u79D1\u4E3E\u5236\u5EA6\u5DF2\u542F\u7528\uFF1A' + data.intervalNote + ' ' + (P.keju.tiers.length) + '\u5C42\u8003\u8BD5');
  } catch(e) {
    console.error('[\u79D1\u4E3E] \u521D\u59CB\u5316\u5931\u8D25:', e);
    // v7.1\u00B7B2\u00B7LLM \u5931\u8D25\u00B7fallback \u4F18\u5148\u8D70 preset (\u4F46\u5267\u672C enabled \u4ECD\u4F18\u5148)
    if (preset) {
      P.keju.enabled = _scenarioEnabledExplicit ? scenario.keju.enabled : preset.enabled;
      P.keju.examIntervalNote = preset.examIntervalNote || (scenario.keju && scenario.keju.examIntervalNote) || '';
      if (preset.alternativeSystem) P.keju.alternativeSystem = preset.alternativeSystem;
      P.keju.tiers = (preset.tiers && preset.tiers.length) ? preset.tiers : _getDefaultTiers(era);
      if (preset.features && !P.keju.specialRules) P.keju.specialRules = preset.features;
    } else {
      P.keju.enabled = _scenarioEnabledExplicit ? scenario.keju.enabled : isKejuEra(era);
      P.keju.tiers = _getDefaultTiers(era);
    }
    _kjFinalizeTiersAndDict(P.keju, scenario);
    if (typeof _kjInitFactionTension === 'function') _kjInitFactionTension();
    // v7.1·E1·mentor 反向索引 namespace init
    if (typeof _kjInitMentorIndex === 'function') _kjInitMentorIndex();
    if (typeof _kjInitDiscipleGraph === 'function') _kjInitDiscipleGraph();
  }
}

/**
 * v7.1\u00B7B1\u00B7tier \u5199\u5165\u540E\u7684\u7EDF\u4E00\u6536\u53E3\u00B7
 *  (1) \u628A"\u534A tier" (LLM \u8FD4 / \u8001 default) \u8DD1\u8FC7 _kjUpgradeTier \u8865\u9F50 schema
 *  (2) \u4ECE tier.daysCost \u6D3E\u751F stageDurationDays dict (\u4FDD\u7559\u5267\u672C override\u00B7\u8865 tier \u6D3E\u751F\u503C)
 *  (3) \u5931\u8D25 try-catch \u4E0D\u7834\u574F P
 */
function _kjFinalizeTiersAndDict(kejuRoot, scenario) {
  if (!kejuRoot) return;
  try {
    if (typeof _kjUpgradeTiers === 'function' && Array.isArray(kejuRoot.tiers)) {
      kejuRoot.tiers = _kjUpgradeTiers(kejuRoot.tiers);
    }
    if (typeof _kjDeriveStageDurationDict === 'function') {
      var scenarioDict = (scenario && scenario.keju && scenario.keju.stageDurationDays) || null;
      var seed = scenarioDict ? Object.assign({}, kejuRoot.stageDurationDays, scenarioDict)
                              : kejuRoot.stageDurationDays;
      kejuRoot.stageDurationDays = _kjDeriveStageDurationDict(kejuRoot.tiers, seed);
    }
  } catch (e) {
    try { console.warn('[\u79D1\u4E3E\u00B7B1] _kjFinalizeTiersAndDict failed\u00B7err=', e && e.message); } catch(_){}
  }
}

// 默认层次配置
function _getDefaultTiers(era) {
  if (/\u660E|\u6E05/.test(era)) return [
    {name:'\u53BF\u8BD5',level:'county',interactive:false,desc:'\u53BF\u5185\u521D\u8BD5'},
    {name:'\u5E9C\u8BD5',level:'prefecture',interactive:false,desc:'\u5E9C\u57CE\u590D\u8BD5'},
    {name:'\u9662\u8BD5',level:'province_pre',interactive:false,desc:'\u5B66\u653F\u4E3B\u6301'},
    {name:'\u4E61\u8BD5',level:'province',interactive:false,desc:'\u7701\u57CE\u4E3E\u4EBA\u8003\u8BD5'},
    {name:'\u4F1A\u8BD5',level:'national',interactive:true,desc:'\u793C\u90E8\u4E3B\u6301\uFF0C\u73A9\u5BB6\u53EF\u53C2\u4E0E'},
    {name:'\u6BBE\u8BD5',level:'imperial',interactive:true,desc:'\u5929\u5B50\u4EB2\u7B56'}
  ];
  if (/\u5510|\u5B8B|\u4E94\u4EE3|\u8FBD|\u91D1|\u5143/.test(era)) return [
    {name:'\u89E3\u8BD5',level:'local',interactive:false,desc:'\u5730\u65B9\u9009\u62D4'},
    {name:'\u7701\u8BD5',level:'national',interactive:true,desc:'\u5168\u56FD\u8003\u8BD5'},
    {name:'\u6BBE\u8BD5',level:'imperial',interactive:true,desc:'\u5929\u5B50\u4EB2\u7B56'}
  ];
  return [
    {name:'\u521D\u8BD5',level:'local',interactive:false,desc:'\u5730\u65B9\u9009\u62D4'},
    {name:'\u4F1A\u8BD5',level:'national',interactive:true,desc:'\u4E2D\u592E\u8003\u8BD5'},
    {name:'\u6BBE\u8BD5',level:'imperial',interactive:true,desc:'\u5929\u5B50\u4EB2\u7B56'}
  ];
}

/**
 * 判断朝代是否属于科举时代（隋唐及之后）
 */
function isKejuEra(era) {
  var kejuDynasties = ['隋', '唐', '五代', '宋', '辽', '金', '元', '明', '清'];
  return kejuDynasties.some(function(d) { return era.includes(d); });
}

/**
 * 检查是否应该触发科举考试（在回合推演中调用）
 * 由 AI 根据当前情况判断
 */
async function checkKejuTrigger() {
  if (!P.keju.enabled || !P.ai.key) return;

  // 如果当前有科举正在进行，不触发新的
  if (P.keju.currentExam) return;

  // 【降本2026-06-19】已有待议头条 → 无需每回合重复问 LLM(礼部奏请已在·等陛下亲议)
  if (P.keju._pendingAutoOpen) return;

  // 【降本2026-06-19】廉价日期预判：固定间隔(≥2年/科)且距上次明显未到期 → 确定性跳过·免 LLM
  // (科举间隔期内每回合本会问一次 high-priority LLM·绝大多数明显"未到期"·此预判省掉间隔期内几乎全部调用·
  //  仅保留"临近/已过间隔"时让 LLM 做财政/时局微调判断·间隔 0/1(不定期/岁举)或从未办过则不预判·照旧问 LLM)
  var _kjInterval = (typeof P.keju.examInterval === 'number' && P.keju.examInterval > 0) ? P.keju.examInterval : 0;
  if (_kjInterval >= 2 && P.keju.lastExamDate && P.keju.lastExamDate.year) {
    var _kjYearsSince = (GM.year || (P.time && P.time.year) || 0) - P.keju.lastExamDate.year;
    if (_kjYearsSince >= 0 && _kjYearsSince < _kjInterval - 1) return;  // 离下次开科尚差≥2年·跳过
  }

  try {
    var currentDate = {
      year: GM.year || P.time.year,
      month: GM.month || 1,
      day: GM.day || 1
    };

    var lastExam = P.keju.lastExamDate ?
      P.keju.lastExamDate.year + '年' + P.keju.lastExamDate.month + '月' :
      '从未举办';

    var prompt = '你是朝廷礼部官员AI。请判断当前是否应该举办科举考试。\n\n' +
      '【当前时间】' + currentDate.year + '年' + currentDate.month + '月' + currentDate.day + '日\n' +
      '【上次科举】' + lastExam + '\n' +
      '【科举间隔】' + (P.keju.examIntervalNote || '三年一科') + '\n' +
      '【国库】' + (GM.vars['国库'] ? GM.vars['国库'].value : '未知') + '\n' +
      '【民心】' + (GM.vars['民心'] ? GM.vars['民心'].value : '未知') + '\n' +
      '【当前局势】' + (GM.situation || '正常') + '\n\n' +
      '【判断要求】\n' +
      '1. 根据科举间隔判断是否到期\n' +
      '2. 考虑财政状况（国库不足可能推迟）\n' +
      '3. 考虑时局（战乱、灾荒等可能推迟）\n' +
      '4. 考虑民心（民心低可能需要科举来笼络士人）\n\n' +
      '返回JSON：{"shouldTrigger":true/false,"reason":"原因"}\n\n' +
      '只输出JSON。';

    var result = await callAISmart(prompt, 300, {
      maxRetries: 1,
      priority: 'background',   // 【降本2026-06-19】开科判定非阻塞玩家操作(结果异步 spawn 头条)·无需 high 抢队列
      timeoutMs: 30000,
      fetchMaxRetries: 1
    });
    var data = JSON.parse(result.replace(/```json|```/g, '').trim());

    if (data.shouldTrigger) {
      // v7.1·B3·改路径·不再直接 startKejuExam·改 spawn 邸报头条·让议政走 keyi
      // 路径 B·LLM 自动判到期 → spawn 头条 → 玩家点头条走路径 A (proposeKejuPreparation)
      _dbg('[科举制度·B3] LLM 判到期·spawn 头条·reason:', data.reason);
      if (!P.keju._pendingAutoOpen) {
        P.keju._pendingAutoOpen = {
          reason: data.reason,
          source: 'autoTrigger',
          topicType: 'kaike',
          spawnedTurn: GM.turn,
          spawnedYear: currentDate.year,
          spawnedMonth: currentDate.month
        };
        if (typeof addEB === 'function') addEB('科举', '礼部奏·' + data.reason + '·待陛下议');
        if (typeof toast === 'function') toast('📜 礼部奏·' + data.reason + '·点科举面板议筹办');
        if (GM.qijuHistory) {
          var dateStr = (typeof getTSText === 'function') ? getTSText(GM.turn) : '';
          if (typeof TM !== 'undefined' && TM.Qiju) TM.Qiju.recordEntry({
            turn: GM.turn, date: dateStr,
            content: '【科举·自动判到期】礼部 AI 奏·' + data.reason + '·待陛下亲议。'
          });
        }
      }
      // **绝不直接 startKejuExam**·议政必走 keyi (red line·v7.1 design rule 15)
    }
  } catch(e) {
    console.error('[科举制度] 检查触发失败:', e);
  }
}

/**
 * 开始科举考试流程（v5·时间化）
 * @param {Object} opts - { type: 'zhengke' | 'enke', launchMethod: 'council'|'edict'|'defy', libuSupport: bool|null }
 */
function startKejuExam(opts) {
  opts = opts || {};
  var tiers = P.keju.tiers || _getDefaultTiers('');
  var isEnke = opts.type === 'enke';
  var examId = 'keju_' + (GM.year || P.time.year) + '_' + (isEnke ? 'en' : 'zh') + '_' + Date.now().toString(36).slice(-4);

  var examObj = {
    id: examId,
    type: isEnke ? 'enke' : 'zhengke',
    startTurn: GM.turn,
    startDate: { year: GM.year || P.time.year, month: GM.month || 1, day: GM.day || 1 },
    tiers: tiers,
    stage: 'preliminary_local',     // v5 改为按天推进·从童试起
    stageStartTurn: GM.turn,
    stageElapsedDays: 0,
    launchMethod: opts.launchMethod || 'council',    // council | edict | defy
    libuSupport: (opts.libuSupport == null) ? null : !!opts.libuSupport,

    // 下层选拔统计
    preliminaryStats: null,
    preliminaryProvincialStats: null,
    // 考官
    chiefExaminer: '',
    examinerParty: '',
    examinerStance: '',
    examinerIntelligence: 0,
    chiefExaminerMemorial: null,   // v5·主考官题本{candidates:[],reasoning,styleHint}
    subExaminers: [],              // v5·副考官列表
    // 会试
    huishiTopic: '',
    huishiTopicCandidates: [],     // v5·主考官拟的多题
    huishiPassed: [],
    huishiCandidates: [],
    // 殿试
    playerQuestion: '',
    dianshiDelegate: null,          // v5·殿试代主（皇帝不在京时）
    dianshiCandidates: [],
    dianshiResults: [],
    examinerSuggestions: {},        // v5·{考官名: [考生名排序, 理由]}
    finalRanking: null,             // v5·玩家钦定三甲
    // 经费
    costsPaid: { local: 0, provincial: 0, central: 0 },
    costShortfall: false,
    // 进士池（未具象化）
    gradPool: [],                   // v5·{name,age,origin,class,party,score,rank,allocatedOffice,_crystallized}
    historicalHits: [],             // v5·本场命中的历史名臣
    // 其他
    statistics: {},
    examOfficials: []
  };

  if (isEnke) {
    P.keju.currentEnke = examObj;
  } else {
    P.keju.currentExam = examObj;
  }

  toast((isEnke ? '\uD83C\uDF89 \u6069\u79D1' : '\uD83D\uDCDC \u79D1\u4E3E') + '\u5F00\u59CB\u7B79\u529E');
  // 纪事·AI 推演可见
  if (typeof _kejuWriteJishi === 'function') {
    _kejuWriteJishi('\u79D1\u4E3E\u5F00\u59CB', (isEnke ? '\u6069\u79D1' : '\u79D1\u4E3E') + '\u00B7\u542F\u52A8\u7B79\u529E', 'id=' + examId + '\u00B7method=' + (opts.launchMethod || 'council'));
  }
  if (typeof addEB === 'function') addEB('\u79D1\u4E3E', (isEnke ? '\u6069\u79D1' : '\u6B63\u79D1') + '\u542F\u52A8');
  // v5·不再自动弹出旧式全流程弹窗——科举按天自动推进·需要玩家互动的阶段
  // （会试拟题/殿试代主/殿试钦定）会在 _finalizeStageAndAdvance 里各自弹窗
  var totalDays = 0;
  if (P.keju.stageDurationDays) {
    ['preliminary_local','preliminary_provincial','examiner_select','huishi_draft','huishi','dianshi_draft','dianshi'].forEach(function(s){
      totalDays += (P.keju.stageDurationDays[s]||0);
    });
  }
  var _dpt2 = (typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : ((P.time && P.time.daysPerTurn) || 30);
  var _turns = Math.ceil(totalDays / Math.max(1, _dpt2));
  toast((isEnke ? '\uD83C\uDF89 \u6069\u79D1' : '\uD83D\uDCDC \u79D1\u4E3E') + '\u5F00\u59CB\u00B7\u9884\u8BA1 ' + totalDays + ' \u65E5 (\u7EA6 ' + _turns + ' \u56DE\u5408)\u00B7\u9700\u4E32\u4E8B\u7684\u6AAF\u6BB5\u4F1A\u9010\u6B21\u63D0\u8BF7\u9661\u4E0B\u5B9A\u593A');
}

/**
 * 显示科举考试界面
 */
function showKejuModal() {
  var exam = P.keju.currentExam;
  if (!exam) return;

  var modal = document.createElement('div');
  modal.className = 'modal-bg show';
  modal.id = 'keju-modal';

  var content = '<div style="background:var(--bg-1);border:1px solid var(--gold-d);border-radius:12px;width:90%;max-width:900px;max-height:85vh;display:flex;flex-direction:column;overflow:hidden;">' +
    '<div style="padding:0.8rem 1.2rem;border-bottom:1px solid var(--bdr);display:flex;justify-content:space-between;">' +
    '<div style="font-size:1.1rem;font-weight:700;color:var(--gold);">📜 科举考试</div>' +
    '<button class="bt bs bsm" onclick="closeKejuModal()">✕</button>' +
    '</div>' +
    '<div id="keju-body" style="flex:1;overflow-y:auto;padding:1.5rem;"></div>' +
    '</div>';

  modal.innerHTML = content;
  document.body.appendChild(modal);

  renderKejuStage();
}

/**
 * 渲染科举考试当前阶段
 */
function renderKejuStage() {
  // 默认渲染正科·恩科单独弹窗
  var exam = P.keju.currentExam;
  var body = document.getElementById('keju-body');
  if (!body || !exam) return;

  // v5 新阶段名→复用老 render 分支；无独立 render 的阶段走通用进度页
  var stage = exam.stage;
  if (stage === 'preliminary' || stage === 'preliminary_local' || stage === 'preliminary_provincial') {
    renderPreliminaryStage(body);
  } else if (stage === 'examiner_select') {
    renderExaminerSelectStage(body);
  } else if (stage === 'huishi_draft') {
    if (typeof renderHuishiDraftStage === 'function') renderHuishiDraftStage(body);
    else renderKejuProgressStage(body, '会试拟题中', '主考官拟定会试题目·等待玩家审阅');
  } else if (stage === 'huishi') {
    renderHuishiStage(body);
  } else if (stage === 'dianshi_draft') {
    if (typeof renderDianshiDraftStage === 'function') renderDianshiDraftStage(body);
    else renderDianshiStage(body);  // 现有 dianshi 页含拟题框
  } else if (stage === 'dianshi') {
    renderDianshiStage(body);
  } else if (stage === 'finished') {
    renderFinishedStage(body);
  }
  // v7.1·C4·所有 stage 顶部 prepend 经费行
  if (typeof _kjRenderBudgetRow === 'function' && exam) {
    try { body.innerHTML = _kjRenderBudgetRow(exam) + body.innerHTML; }
    catch(e) { console.warn('[C4] budget row 失败', e); }
  }
}

// ══════════════════════════════════════════════════════════════════
// v5·时间化推进器（按天累积）
// ══════════════════════════════════════════════════════════════════

/** 每回合 endturn 调用·给科举累计天数，达阈值则切下一阶段 */
function advanceKejuByDays(daysPassed) {
  ['currentExam', 'currentEnke'].forEach(function(slot){
    var exam = P.keju && P.keju[slot];
    if (!exam || exam.stage === 'finished') return;
    // 老存档补全字段
    _kejuUpgradeExamSchema(exam);
    exam.stageElapsedDays = (exam.stageElapsedDays || 0) + (daysPassed || 0);
    var need = (P.keju.stageDurationDays && P.keju.stageDurationDays[exam.stage]) || 30;
    if (exam.stageElapsedDays >= need) {
      _finalizeStageAndAdvance(exam, slot);
    } else {
      // 仍在阶段内·若是需玩家决策阶段且浮条不在·补弹
      var urgentStages = ['examiner_select','huishi_draft','dianshi_draft'];
      var needsNotify = urgentStages.indexOf(exam.stage) >= 0
        && !( (exam.stage === 'examiner_select' && exam.chiefExaminer)
           || (exam.stage === 'huishi_draft' && exam.huishiTopic)
           || (exam.stage === 'dianshi_draft' && exam.playerQuestion));
      if (needsNotify && !document.getElementById('keju-urgent-banner')) {
        if (typeof _kejuNotifyUrgentStage === 'function') _kejuNotifyUrgentStage(exam, exam.stage);
      }
    }
  });
}

/** 老存档 currentExam 升级到 v5 schema */
function _kejuUpgradeExamSchema(exam) {
  if (!exam) return;
  // 老 stage 名映射
  if (exam.stage === 'preliminary') exam.stage = 'preliminary_local';
  // 补默认值
  if (!exam.id) exam.id = 'keju_legacy_' + (exam.startTurn || 0);
  if (!exam.type) exam.type = 'zhengke';
  if (exam.stageElapsedDays == null) exam.stageElapsedDays = 0;
  if (exam.stageStartTurn == null) exam.stageStartTurn = exam.startTurn || GM.turn;
  if (!exam.launchMethod) exam.launchMethod = 'council';
  if (exam.libuSupport === undefined) exam.libuSupport = null;
  if (!exam.chiefExaminerMemorial) exam.chiefExaminerMemorial = null;
  if (!Array.isArray(exam.subExaminers)) exam.subExaminers = [];
  if (!Array.isArray(exam.huishiTopicCandidates)) exam.huishiTopicCandidates = [];
  if (exam.dianshiDelegate === undefined) exam.dianshiDelegate = null;
  if (!exam.costsPaid) exam.costsPaid = { local:0, provincial:0, central:0 };
  if (exam.costShortfall === undefined) exam.costShortfall = false;
  if (!Array.isArray(exam.gradPool)) exam.gradPool = [];
  if (!Array.isArray(exam.historicalHits)) exam.historicalHits = [];
  if (!exam.examinerSuggestions) exam.examinerSuggestions = {};
  if (exam.finalRanking === undefined) exam.finalRanking = null;
}

/** 通用进度页（用于 huishi_draft 等无独立 UI 的阶段） */
function renderKejuProgressStage(container, title, subtitle) {
  var exam = P.keju.currentExam;
  if (!exam) return;
  var need = (P.keju.stageDurationDays && P.keju.stageDurationDays[exam.stage]) || 30;
  var elapsed = exam.stageElapsedDays || 0;
  var pct = Math.min(100, Math.round(elapsed * 100 / need));
  container.innerHTML =
    '<div style="text-align:center;padding:3rem 1rem;">'+
    '<div style="font-size:2.5rem;margin-bottom:0.5rem;">\u23F3</div>'+
    '<h3 style="color:var(--gold);">' + escHtml(title) + '</h3>'+
    '<p style="color:var(--txt-d);font-size:0.88rem;margin:0.6rem 0 1.4rem;">' + escHtml(subtitle || '') + '</p>'+
    '<div style="max-width:420px;margin:0 auto;background:var(--bg-2);border-radius:10px;overflow:hidden;">'+
    '<div style="height:10px;background:linear-gradient(90deg,var(--gold-d),var(--gold));width:' + pct + '%;transition:width 0.4s;"></div>'+
    '</div>'+
    '<div style="color:var(--txt-d);font-size:0.78rem;margin-top:0.5rem;">\u5DF2\u8FC7 ' + elapsed + ' \u65E5 / \u5171 ' + need + ' \u65E5 (' + pct + '%)</div>'+
    '</div>';
}

// ══════════════════════════════════════════════════════════════════
// v5·阶段切换器（B2）
// ══════════════════════════════════════════════════════════════════

/** 阶段结束·执行终结动作+推进到下一阶段 */
async function _finalizeStageAndAdvance(exam, slot) {
  slot = slot || 'currentExam';
  // 重入锁(2026-07-04 审查定罪)：内部 AI 调用可长于一回合·stageElapsedDays 继续累积曾令同阶段被二次终结(经费/皇威罚/AI 各双份)
  if (!exam || exam._finalizing) return;
  exam._finalizing = true;
  // 老阶段名兼容：旧存档 stage === 'preliminary' → 视为 'preliminary_local'
  if (exam.stage === 'preliminary') exam.stage = 'preliminary_local';
  var fromStage = exam.stage;
  _dbg('[科举·B2] 终结阶段:', fromStage, 'exam.id=', exam.id);
  // 清掉旧阶段的浮条（若新阶段需要·下方各 case 会重新弹出）
  if (typeof _kejuClearUrgentBanner === 'function') _kejuClearUrgentBanner();

  try {
    switch (fromStage) {
      case 'proposal':
        // 朝议筹办期结束·进入童试
        exam.stage = 'preliminary_local';
        break;
      case 'preliminary_local':
        // 童/府/院试·扣各县/府/省公库
        if (typeof _kejuSettleLocalCosts === 'function') _kejuSettleLocalCosts(exam);
        exam.stage = 'preliminary_provincial';
        break;
      case 'preliminary_provincial':
        // 乡试·扣省级公库+生成举子数据
        if (typeof _kejuSettleProvincialCosts === 'function') _kejuSettleProvincialCosts(exam);
        if (typeof runPreliminaryExams === 'function' && !exam.preliminaryStats) {
          try { await runPreliminaryExams(); } catch(_){}
        }
        exam.stage = 'examiner_select';
        // 切入需玩家决策阶段·显著提醒
        if (typeof _kejuNotifyUrgentStage === 'function') _kejuNotifyUrgentStage(exam, 'examiner_select');
        break;
      case 'examiner_select':
        // 若玩家没选考官·AI 自动选（皇威-3）
        if (!exam.chiefExaminer && typeof _kejuAutoPickExaminer === 'function') {
          _kejuAutoPickExaminer(exam);
          _adjustHuangwei(-3, '科举·未及时选考官·AI 代选');
        }
        exam.stage = 'huishi_draft';
        if (typeof _kejuNotifyUrgentStage === 'function') _kejuNotifyUrgentStage(exam, 'huishi_draft');
        break;
      case 'huishi_draft':
        // 主考官拟题·若玩家未确认题目·采用主考官首选（皇威-2）
        if (!exam.huishiTopic && exam.huishiTopicCandidates && exam.huishiTopicCandidates.length) {
          exam.huishiTopic = exam.huishiTopicCandidates[0].topic || exam.huishiTopicCandidates[0];
          _adjustHuangwei(-2, '科举·未亲定会试题·采主考首选');
        } else if (!exam.chiefExaminerMemorial && typeof _kejuGenChiefExaminerMemorial === 'function') {
          try { await _kejuGenChiefExaminerMemorial(exam); } catch(_){}
          if (exam.huishiTopicCandidates && exam.huishiTopicCandidates.length) {
            exam.huishiTopic = exam.huishiTopicCandidates[0].topic || exam.huishiTopicCandidates[0];
          }
        }
        exam.stage = 'huishi';
        break;
      case 'huishi':
        // 会试·扣中央·AI 生成结果
        if (typeof _kejuSettleCentralCost === 'function') _kejuSettleCentralCost(exam, 'huishi');
        if (typeof generateHuishiResults === 'function' && !exam.huishiPassed.length) {
          try { await generateHuishiResults(); } catch(_){}
        }
        exam.stage = 'dianshi_draft';
        if (typeof _kejuNotifyUrgentStage === 'function') _kejuNotifyUrgentStage(exam, 'dianshi_draft');
        break;
      case 'dianshi_draft':
        // 殿试拟题·玩家未写则 AI 代拟
        if (!exam.playerQuestion && typeof generateDianshiQuestion === 'function') {
          try { await generateDianshiQuestion(); } catch(_){}
          _adjustHuangwei(-2, '科举·未亲拟殿试策问·AI 代拟');
        }
        exam.stage = 'dianshi';
        break;
      case 'dianshi':
        // 殿试·扣中央+AI 生成前 20 卷答卷+考官建议
        if (typeof _kejuSettleCentralCost === 'function') _kejuSettleCentralCost(exam, 'dianshi');
        if (typeof startDianshi === 'function' && !exam.dianshiResults.length) {
          try { await startDianshi(); } catch(_){}
        }
        // 进入 finished 前若玩家没钦定·按综合分自动排
        if (!exam.finalRanking && exam.dianshiResults && exam.dianshiResults.length >= 3) {
          exam.finalRanking = {
            zhuangyuan: exam.dianshiResults[0] && exam.dianshiResults[0].name,
            bangyan:    exam.dianshiResults[1] && exam.dianshiResults[1].name,
            tanhua:     exam.dianshiResults[2] && exam.dianshiResults[2].name,
            autoAssigned: true
          };
          _adjustHuangwei(-5, '科举·未亲钦三甲·按综合分默认');
        }
        exam.stage = 'finished';
        break;
      case 'finished':
        // 已完成·归档到 history，清 currentExam
        _kejuArchiveExam(exam, slot);
        return;
    }
    // 切换后重置 stageElapsedDays
    exam.stageStartTurn = GM.turn;
    exam.stageElapsedDays = 0;

    // 阶段切换 toast
    var stageNames = {
      preliminary_local: '童试·府试·院试',
      preliminary_provincial: '乡试',
      examiner_select: '选任考官',
      huishi_draft: '会试拟题',
      huishi: '会试',
      dianshi_draft: '殿试拟题',
      dianshi: '殿试阅卷',
      finished: '金榜题名'
    };
    toast('\uD83D\uDCDC \u79D1\u4E3E\u8FDB\u5165\u300C' + (stageNames[exam.stage] || exam.stage) + '\u300D\u9636\u6BB5');
  } catch(e) {
    console.error('[科举·B2] 阶段切换异常', fromStage, '→', exam.stage, e);
  } finally { exam._finalizing = false; }
}

/** 辅助·调整皇威（注释一直说「若引擎可用」·2026-07-04 收口才真接上写口：按源封顶+台账+phase 迁移） */
function _adjustHuangwei(delta, reason) {
  try {
    if (typeof AuthorityEngines !== 'undefined' && AuthorityEngines.adjustHuangwei) {
      AuthorityEngines.adjustHuangwei(delta > 0 ? 'culturalAchievement' : 'courtScandal', delta, reason || '科举牵动皇威');
      if (typeof addEB === 'function') addEB('皇威', (delta > 0 ? '+' : '') + delta + '·' + (reason || ''));
      return;
    }
    if (GM.huangwei && typeof GM.huangwei === 'object') { // 沙箱回退
      var old = (typeof GM.huangwei.index === 'number') ? GM.huangwei.index : (typeof GM.huangwei.value === 'number' ? GM.huangwei.value : 50);
      GM.huangwei.index = Math.max(0, Math.min(100, old + delta));
      GM.huangwei.value = GM.huangwei.index;
      if (typeof addEB === 'function') addEB('皇威', (delta > 0 ? '+' : '') + delta + '·' + (reason || ''));
    }
  } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-chaoyi-keju');}catch(_){}}
}

/** 归档本场科举到 history */
function _kejuArchiveExam(exam, slot) {
  if (!P.keju.history) P.keju.history = [];
  P.keju.history.push({
    id: exam.id,
    type: exam.type,
    turn: exam.startTurn,
    date: exam.startDate,
    results: exam.dianshiResults,
    finalRanking: exam.finalRanking,
    launchMethod: exam.launchMethod,
    costsPaid: exam.costsPaid
  });
  P.keju.lastExamDate = { year: GM.year || P.time.year, month: GM.month || 1 };
  P.keju[slot] = null;
  if (typeof toast === 'function') toast('\uD83C\uDF8C \u672C\u79D1' + (exam.type === 'enke' ? '\u6069\u79D1' : '\u79D1\u4E3E') + '\u5DF2\u5B8C\u7ED3');
}

// ── 新阶段：下层选拔模拟 ──
function renderPreliminaryStage(container) {
  // v5·时间化改造后·此阶段纯只读进度（由 advanceKejuByDays 按天推进·无需玩家按键）
  var exam = P.keju.currentExam;
  if (!exam) return;
  var isProv = exam.stage === 'preliminary_provincial';
  var title = isProv ? '\u4E61\u8BD5' : '\u7AE5\u8BD5\u00B7\u5E9C\u8BD5\u00B7\u9662\u8BD5';
  var subtitle = isProv
    ? '\u5404\u7701\u8D21\u9662\u4E61\u8BD5\u5F00\u5F04\u00B7\u4E3E\u4EBA\u540D\u5355\u9010\u7701\u62A5\u9001\u793C\u90E8\uFF0C\u7B49\u5F85\u793C\u90E8\u6C47\u603B\u540E\u8FDB\u4F1A\u8BD5'
    : '\u5404\u53BF\u5E9C\u9662\u5F00\u8003\u00B7\u751F\u5458\u9010\u5C42\u9009\u62D4\uFF0C\u8FDB\u8005\u53EF\u5165\u4E61\u8BD5';
  renderKejuProgressStage(container, title, subtitle);
}

async function runPreliminaryExams() {
  var exam = P.keju.currentExam;
  if (!exam || !P.ai.key) { exam.stage = 'examiner_select'; renderKejuStage(); return; }

  showLoading('\u5730\u65B9\u9009\u62D4\u4E2D...', 30);
  try {
    var scenario = P.scenarios ? P.scenarios.find(function(s){return s.id===GM.sid;}) : null;
    var era = scenario ? (scenario.era || scenario.dynasty || '') : '';
    var lowerTiers = (exam.tiers||[]).filter(function(t){return !t.interactive;});
    // 收集地区/阶层信息
    var regions = (GM.facs||[]).slice(0,5).map(function(f){return f.name + '(' + (f.territory||'') + ')';}).join('\u3001');
    var classes = (GM.classes||[]).map(function(c){return c.name + '(\u6EE1\u610F' + (c.satisfaction||50) + ')';}).join('\u3001');
    var parties = (GM.parties||[]).filter(function(p){return (p.influence||0)>20;}).map(function(p){return p.name;}).join('\u3001');

    var prompt = '\u4F60\u662F' + era + '\u79D1\u4E3E\u5730\u65B9\u9009\u62D4\u6A21\u62DF\u5668\u3002\u8BF7\u751F\u6210' + lowerTiers.map(function(t){return t.name;}).join('\u2192') + '\u7684\u9009\u62D4\u7ED3\u679C\u3002\n\n' +
      '\u3010\u80CC\u666F\u3011\n\u5730\u533A\uFF1A' + (regions || '\u672A\u77E5') + '\n\u9636\u5C42\uFF1A' + (classes || '\u672A\u77E5') + '\n\u515A\u6D3E\uFF1A' + (parties || '\u65E0') + '\n' +
      '\u6559\u80B2\u6C34\u5E73\uFF1A' + Math.round((GM.eraState ? GM.eraState.culturalVibrancy||0.5 : 0.5)*100) + '%\n' +
      '\u7ECF\u6D4E\u72B6\u51B5\uFF1A' + Math.round((GM.eraState ? GM.eraState.economicProsperity||0.5 : 0.5)*100) + '%\n\n' +
      '\u8FD4\u56DEJSON\uFF1A{"totalApplicants":\u62A5\u540D\u603B\u4EBA\u6570,"passedToNational":\u8FDB\u5165\u4F1A\u8BD5\u4EBA\u6570,' +
      '"regionalBreakdown":[{"region":"","\u62A5\u540D":0,"\u901A\u8FC7":0}],' +
      '"classBreakdown":{"":0.5,"":0.3},' +
      '"partyBreakdown":{"":0.4},' +
      '"narrative":"\u5730\u65B9\u9009\u62D4\u6982\u51B5\u63CF\u8FF0100\u5B57"}\n\u53EA\u8F93\u51FAJSON\u3002';

    var result = await callAISmart(prompt, 1000, {maxRetries: 2});
    var data = JSON.parse(result.replace(/```json|```/g, '').trim());
    exam.preliminaryStats = data;
    exam.stage = 'examiner_select';
    hideLoading();
    renderKejuStage();
  } catch(e) {
    console.error('[\u79D1\u4E3E] \u5730\u65B9\u9009\u62D4\u5931\u8D25:', e);
    hideLoading();
    exam.stage = 'examiner_select';
    renderKejuStage();
  }
}

// ── 新阶段：选任主考官 ──
function renderExaminerSelectStage(container) {
  var exam = P.keju.currentExam;
  var html = '<div style="text-align:center;margin-bottom:1rem;">';
  html += '<div style="font-size:2rem;margin-bottom:0.3rem;">\uD83D\uDC68\u200D\u2696\uFE0F</div>';
  html += '<h3 style="color:var(--gold);">\u9009\u4EFB\u4E3B\u8003\u5B98</h3>';
  html += '<p style="color:var(--txt-d);font-size:0.85rem;max-width:550px;margin:0.5rem auto;line-height:1.6;">';
  html += '\u4E3B\u8003\u5B98\u4E4B\u4F4D\u662F\u5404\u515A\u6D3E\u5FC5\u4E89\u4E4B\u5730\u2014\u2014\u8003\u5B98\u7684\u515A\u6D3E\u548C\u7ACB\u573A\u4F1A\u5F71\u54CD\u51FA\u9898\u65B9\u5411\u548C\u8BC4\u5224\u503E\u5411\uFF0C';
  html += '\u53D6\u58EB\u7ED3\u679C\u5C06\u5F62\u6210\u65B0\u7684\u95E8\u751F\u5173\u7CFB\u7F51\u7EDC\u3002\u4F46\u5FE0\u6B63\u4E4B\u58EB\u4E0D\u4F1A\u56E0\u5EA7\u5E08\u800C\u653E\u5F03\u539F\u5219\uFF0C\u91CE\u5FC3\u5BB6\u4E5F\u53EF\u80FD\u80CC\u53DB\u5EA7\u5E08\u3002</p>';
  html += '</div>';

  // 下层选拔结果概要
  if (exam.preliminaryStats) {
    var ps = exam.preliminaryStats;
    html += '<div style="background:var(--bg-2);padding:0.8rem;border-radius:8px;margin-bottom:1rem;font-size:0.85rem;">';
    html += '<strong style="color:var(--gold);">\u5730\u65B9\u9009\u62D4\u7ED3\u679C</strong>\uFF1A\u62A5\u540D' + (ps.totalApplicants||0) + '\u4EBA\uFF0C\u901A\u8FC7' + (ps.passedToNational||0) + '\u4EBA\u8FDB\u5165\u4F1A\u8BD5';
    if (ps.narrative) html += '<div style="color:var(--txt-d);margin-top:0.3rem;font-size:0.8rem;">' + escHtml(ps.narrative.slice(0,100)) + '</div>';
    if (ps.classBreakdown) {
      html += '<div style="margin-top:0.3rem;font-size:0.78rem;color:var(--txt-d);">\u9636\u5C42\uFF1A' + Object.entries(ps.classBreakdown).map(function(e){return e[0]+Math.round(e[1]*100)+'%';}).join(' ') + '</div>';
    }
    if (ps.partyBreakdown) {
      html += '<div style="font-size:0.78rem;color:var(--txt-d);">\u515A\u6D3E\uFF1A' + Object.entries(ps.partyBreakdown).map(function(e){return e[0]+Math.round(e[1]*100)+'%';}).join(' ') + '</div>';
    }
    html += '</div>';
  }

  // 考官选择
  html += '<div style="background:var(--bg-2);padding:1rem;border-radius:8px;margin-bottom:1rem;">';
  html += '<div style="font-size:0.9rem;font-weight:700;color:var(--gold);margin-bottom:0.5rem;">\u8BF7\u9009\u62E9\u4E3B\u8003\u5B98</div>';
  html += '<div style="max-height:250px;overflow-y:auto;">';
  // 各党派推荐情况
  var _partyRecs = {};
  (GM.parties||[]).filter(function(p){return (p.influence||0)>20;}).forEach(function(p) {
    var _best = (GM.chars||[]).filter(function(c){return c.alive!==false && !c.isPlayer && c.party===p.name && (c.intelligence||0)>=55;}).sort(function(a,b){return (b.intelligence||0)-(a.intelligence||0);})[0];
    if (_best) _partyRecs[p.name] = _best.name;
  });
  if (Object.keys(_partyRecs).length > 0) {
    html += '<div style="font-size:0.78rem;color:var(--txt-d);margin-bottom:0.5rem;background:rgba(138,109,27,0.04);padding:0.4rem 0.6rem;border-radius:4px;">\u5404\u515A\u63A8\u8350\uFF1A' +
      Object.entries(_partyRecs).map(function(e){return '<span style="color:var(--purple,#8a5cf5);">'+e[0]+'</span>\u2192'+e[1];}).join(' \u00B7 ') + '</div>';
  }
  // 候选考官——从GM.chars中选智力较高的
  var candidates = (GM.chars||[]).filter(function(c) {
    return typeof _kejuIsEligibleChiefExaminer === 'function'
      ? _kejuIsEligibleChiefExaminer(c)
      : !!(c && c.alive !== false && !c.isPlayer && (c.intelligence||0) >= 60 && (c.officialTitle || c.title));
  }).sort(function(a,b) { return (b.intelligence||0) - (a.intelligence||0); }).slice(0, 12);
  candidates.forEach(function(c) {
    var partyTag = c.party && c.party !== '\u65E0\u515A\u6D3E' ? ' <span style="font-size:0.7rem;color:var(--purple,#8a5cf5);">\u515A:' + c.party + '</span>' : '';
    var recTag = '';
    Object.entries(_partyRecs).forEach(function(e){ if(e[1]===c.name) recTag=' <span style="font-size:0.7rem;background:var(--purple,#8a5cf5);color:#fff;padding:0 3px;border-radius:2px;">'+e[0]+'\u63A8\u8350</span>'; });
    html += '<div style="display:flex;align-items:center;gap:0.5rem;padding:0.4rem 0.6rem;margin-bottom:0.3rem;background:var(--bg-3);border-radius:4px;cursor:pointer;" onclick="selectExaminer(\'' + escHtml(c.name).replace(/'/g,"\\'") + '\')">';
    html += '<strong style="flex:1;">' + escHtml(c.name) + recTag + '</strong>';
    html += '<span style="font-size:0.8rem;color:var(--txt-d);">' + (c.officialTitle||c.title||'') + ' \u667A' + (c.intelligence||0) + ' \u6CBB' + (c.administration||0) + partyTag + '</span>';
    html += '</div>';
  });
  html += '</div></div>';
  html += '<div id="examiner-info" style="display:none;background:rgba(138,109,27,0.08);padding:0.8rem;border-radius:8px;margin-bottom:1rem;border:1px solid var(--gold-d);"></div>';
  html += '<div style="text-align:center;">';
  html += '<button class="bt bp" id="btn-proceed-huishi" onclick="proceedToHuishi()" style="padding:0.7rem 2rem;display:none;">\u2192 \u8FDB\u5165\u4F1A\u8BD5\u51FA\u9898</button>';
  html += '</div>';
  container.innerHTML = html;
}

function selectExaminer(name) {
  var exam = P.keju.currentExam;
  var ch = typeof findCharByName === 'function' ? findCharByName(name) : null;
  if (!ch) return;
  if (typeof _kejuIsEligibleChiefExaminer === 'function' && !_kejuIsEligibleChiefExaminer(ch)) {
    toast('\u4e3b\u8003\u5b98\u5fc5\u987b\u4e3a\u73a9\u5bb6\u540c\u52bf\u529b\u7684\u5728\u4efb\u5b98\u5458');
    return;
  }
  if (typeof _kejuClearUrgentBanner === 'function') _kejuClearUrgentBanner();
  exam.chiefExaminer = name;
  exam.examinerParty = ch.party || '';
  exam.examinerStance = ch.stance || ch.personality || '';
  exam.examinerIntelligence = ch.intelligence || 50;

  var infoEl = document.getElementById('examiner-info');
  if (infoEl) {
    infoEl.style.display = 'block';
    infoEl.innerHTML = '<strong style="color:var(--gold);">\u5DF2\u9009\u4EFB\uFF1A' + escHtml(name) + '</strong>' +
      '<div style="font-size:0.85rem;color:var(--txt-s);margin-top:0.3rem;">' +
      (ch.officialTitle||ch.title||'') + ' \u667A\u8C0B' + (ch.intelligence||0) + ' \u6CBB\u653F' + (ch.administration||0) +
      (ch.party && ch.party !== '\u65E0\u515A\u6D3E' ? ' \u515A\u6D3E:' + ch.party : '') +
      (ch.stance ? ' \u7ACB\u573A:' + ch.stance : '') +
      '</div>' +
      '<div style="font-size:0.78rem;color:var(--txt-d);margin-top:0.2rem;">\u2139 \u8003\u5B98\u7684\u515A\u6D3E\u548C\u7ACB\u573A\u5C06\u5F71\u54CD\u51FA\u9898\u65B9\u5411\u548C\u8BC4\u5224\u503E\u5411</div>';
  }
  var btn = document.getElementById('btn-proceed-huishi');
  if (btn) btn.style.display = 'inline-block';
  addEB('\u79D1\u4E3E', '\u4EFB\u547D' + name + '\u4E3A\u672C\u79D1\u4E3B\u8003\u5B98');

  // v5·纪事 + NPC 记忆：主考官任命是重大荣誉
  if (typeof _kejuWriteJishi === 'function') _kejuWriteJishi('\u4EFB\u547D\u4E3B\u8003', name + '\u00B7' + (ch.officialTitle||ch.title||''), '\u515A:' + (ch.party||'\u65E0\u515A') + '\u00B7\u667A' + (ch.intelligence||0));
  if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
    NpcMemorySystem.remember(name, '\u8499\u7687\u5E1D\u4EFB\u547D\u4E3A\u79D1\u4E3E\u4F1A\u8BD5\u4E3B\u8003\u5B98\u00B7\u6B64\u4E3A\u6587\u81E3\u8363\u5BA0', '\u559C', 8, (P.playerInfo && P.playerInfo.characterName) || '\u9661\u4E0B');
  }
  if (typeof AffinityMap !== 'undefined' && AffinityMap.add) {
    AffinityMap.add(name, (P.playerInfo && P.playerInfo.characterName) || '\u9661\u4E0B', 5, '\u7687\u5E1D\u6388\u4E3B\u8003\u4E4B\u8363');
  }
}

function proceedToHuishi() {
  var exam = P.keju.currentExam;
  if (!exam.chiefExaminer) { toast('\u8BF7\u5148\u9009\u62E9\u4E3B\u8003\u5B98'); return; }
  exam.stage = 'huishi';
  exam.stageStartTurn = GM.turn; exam.stageElapsedDays = 0; // \u624B\u52A8\u5207\u9636\u6BB5\u540C\u6B65\u91CD\u7F6E\u8BA1\u65F6(2026-07-04 \u5BA1\u67E5\u5B9A\u7F6A:\u7EE7\u627F\u65E7\u5929\u6570\u81F4\u65B0\u9636\u6BB5\u88AB\u63D0\u524D\u7EC8\u7ED3)
  renderKejuStage();
}

/**
 * 渲染会试阶段（增强版——场景沉浸）
 */
function renderHuishiStage(container) {
  var exam = P.keju.currentExam;
  var scenario = P.scenarios ? P.scenarios.find(function(s){return s.id===GM.sid;}) : null;
  var era = scenario ? (scenario.era||scenario.dynasty||'') : '';
  var subjects = P.keju.examSubjects || '\u8FDB\u58EB\u79D1';
  var tierName = '\u4F1A\u8BD5';
  if (exam && exam.tiers) { var nt = exam.tiers.find(function(t){return t.level==='national';}); if (nt) tierName = nt.name; }

  var html = '<div style="text-align:center;margin-bottom:1rem;">';
  html += '<div style="font-size:2rem;margin-bottom:0.3rem;">\uD83C\uDFDB</div>';
  html += '<h3 style="color:var(--gold);">' + escHtml(tierName) + '</h3>';
  html += '<p style="color:var(--txt-d);font-size:0.85rem;line-height:1.7;max-width:500px;margin:0 auto;">';
  html += '\u8D21\u9662\u9501\u9662\uFF0C' + era + '\u5404\u5730\u4E3E\u5B50\u4E91\u96C6\u4EAC\u5E08\u3002';
  if (exam && exam.chiefExaminer) html += '\u4E3B\u8003\u5B98<strong style="color:var(--gold);">' + escHtml(exam.chiefExaminer) + '</strong>\u5DF2\u5165\u8D21\u9662\u4E3B\u6301\u3002';
  html += '</p></div>';
  // v7.1·C3·主考偏好 hint bar (顶部·只要选了主考即显)
  if (exam && exam.chiefExaminer && typeof _kjRenderExaminerHintBar === 'function') {
    var hintCh = typeof findCharByName === 'function' ? findCharByName(exam.chiefExaminer) : null;
    if (hintCh) html += _kjRenderExaminerHintBar(hintCh);
  }
  // 考官出题
  html += '<div style="background:linear-gradient(135deg,var(--bg-2),rgba(138,109,27,0.04));padding:1rem;border-radius:8px;border:1px solid var(--gold-d);margin-bottom:1rem;">';
  html += '<h4 style="color:var(--gold);margin-bottom:0.5rem;">\uD83D\uDCDC ' + escHtml(tierName) + '\u8BD5\u9898</h4>';
  html += '<p style="color:var(--txt-d);font-size:0.82rem;margin-bottom:0.5rem;">\u4E3B\u8003\u5B98\u62DF\u9898\u5448\u62A5\u5FA1\u89C8\u3002\u966D\u4E0B\u53EF\u4FEE\u6539\u6216\u53E6\u62DF\uFF0C\u4EA6\u53EF\u51C6\u5949\u3002</p>';
  html += '<textarea id="huishi-topic" rows="4" oninput="if(typeof _kjUpdateAlignmentUI===\'function\')_kjUpdateAlignmentUI();" style="width:100%;padding:0.6rem;background:var(--bg-1);border:1px solid var(--bdr);border-radius:4px;color:var(--txt);font-family:inherit;line-height:1.7;font-size:0.92rem;" placeholder="\u8BF7\u7B49\u5F85\u8003\u5B98\u62DF\u9898\uFF0C\u6216\u76F4\u63A5\u8F93\u5165...">' + escHtml(exam && exam.huishiTopic ? exam.huishiTopic : '') + '</textarea>';
  // v7.1\u00B7C3\u00B7alignment warning div (oninput \u66F4\u65B0)
  html += '<div id="kj-alignment-warn"></div>';
  html += '<div style="display:flex;gap:0.5rem;margin-top:0.5rem;flex-wrap:wrap;">';
  html += '<button class="bt bp" onclick="examinerProposeTopic()" style="flex:1;min-width:120px;">\uD83D\uDC68\u200D\u2696\uFE0F \u8003\u5B98\u62DF\u9898\u5448\u62A5</button>';
  html += '<button class="bt" onclick="if(typeof _kjOpenLibuKeyi===\'function\')_kjOpenLibuKeyi();" style="flex:0.8;min-width:100px;color:var(--gold);">\uD83D\uDCDC \u53EC\u793C\u90E8\u5546\u8BAE</button>';
  html += '<button class="bt bs" onclick="document.getElementById(\'huishi-topic\').value=\'\';if(typeof _kjUpdateAlignmentUI===\'function\')_kjUpdateAlignmentUI();" style="flex:0.4;">\u6E05\u7A7A</button>';
  html += '</div></div>';
  // 考试信息
  html += '<div style="background:var(--bg-2);padding:0.8rem;border-radius:8px;margin-bottom:1rem;">';
  html += '<div style="display:flex;justify-content:space-between;font-size:0.82rem;color:var(--txt-s);">';
  html += '<span>\u79D1\u76EE\uFF1A' + escHtml(subjects) + '</span>';
  if (exam && exam.chiefExaminer) html += '<span>\u4E3B\u8003\uFF1A' + escHtml(exam.chiefExaminer) + (exam.examinerParty ? '(' + exam.examinerParty + ')' : '') + '</span>';
  html += '</div>';
  if (P.keju.specialRules) html += '<div style="font-size:0.78rem;color:var(--txt-d);margin-top:0.2rem;">\u89C4\u5219\uFF1A' + escHtml(P.keju.specialRules) + '</div>';
  if (exam && exam.preliminaryStats) html += '<div style="font-size:0.78rem;color:var(--txt-d);margin-top:0.2rem;">\u5730\u65B9\u9009\u62D4\u901A\u8FC7' + (exam.preliminaryStats.passedToNational||0) + '\u4EBA\u53C2\u52A0' + escHtml(tierName) + '</div>';
  html += '</div>';
  html += '<div style="text-align:center;">';
  html += '<button class="bt bp" onclick="generateHuishiResults()" style="padding:0.8rem 2rem;font-size:1rem;">\uD83C\uDFB2 \u5F00\u699C\u2014\u2014\u6279\u5377\u5E76\u751F\u6210\u7ED3\u679C</button>';
  html += '<p style="color:var(--txt-d);font-size:0.78rem;margin-top:0.4rem;">\u8BD5\u9898\u7559\u7A7A\u5219\u8003\u5B98\u81EA\u884C\u51FA\u9898\uFF1B\u8003\u5B98\u515A\u6D3E\u548C\u7ACB\u573A\u5C06\u5F71\u54CD\u8BC4\u5224</p>';
  html += '</div>';
  container.innerHTML = html;
}

// 考官拟题
async function examinerProposeTopic() {
  var exam = P.keju.currentExam;
  if (!exam || !exam.chiefExaminer || !P.ai.key) { toast('\u8BF7\u5148\u9009\u62E9\u4E3B\u8003\u5B98'); return; }
  showLoading('\u8003\u5B98\u62DF\u9898\u4E2D...', 50);
  try {
    var ch = typeof findCharByName === 'function' ? findCharByName(exam.chiefExaminer) : null;
    var scenario = P.scenarios ? P.scenarios.find(function(s){return s.id===GM.sid;}) : null;
    var era = scenario ? (scenario.era||scenario.dynasty||'') : '';
    var prompt = '\u4F60\u662F' + era + '\u79D1\u4E3E\u4E3B\u8003\u5B98' + exam.chiefExaminer + '\u3002\n';
    if (ch) {
      prompt += '\u80CC\u666F\uFF1A' + (ch.title||'') + ' \u667A\u8C0B' + (ch.intelligence||50) + ' \u6CBB\u653F' + (ch.administration||50) + '\n';
      if (ch.party && ch.party !== '\u65E0\u515A\u6D3E') prompt += '\u515A\u6D3E\uFF1A' + ch.party + '\uFF0C\u7ACB\u573A\u4F1A\u5FAE\u5999\u5F71\u54CD\u51FA\u9898\u3002\n';
      if (ch.personality) prompt += '\u6027\u683C\uFF1A' + ch.personality + '\n';
    }
    prompt += '\n\u8BF7\u62DF\u4E00\u9053\u4F1A\u8BD5\u8BD5\u9898\uFF0C150-250\u5B57\uFF0C\u4EFF\u53E4\u6587\u7B56\u95EE\u4F53\u3002\u53CD\u6620\u4F60\u5BF9\u65F6\u5C40\u7684\u770B\u6CD5\u548C\u653F\u6CBB\u7ACB\u573A\u3002\n\u76F4\u63A5\u8F93\u51FA\u9898\u76EE\u3002';
    var topic = await callAISmart(prompt, 800, {minLength: 100, maxRetries: 2});
    topic = topic.replace(/```[\s\S]*?```/g, '').trim();
    var el = document.getElementById('huishi-topic');
    if (el) el.value = topic;
    if (exam) exam.huishiTopic = topic;
    hideLoading();
    toast('\u2705 \u8003\u5B98\u5DF2\u62DF\u9898\u5448\u62A5\uFF0C\u8BF7\u5FA1\u89C8');
  } catch(e) { hideLoading(); toast('\u274C \u62DF\u9898\u5931\u8D25'); }
}

/**
 * 生成会试结果（AI）
 */
async function generateHuishiResults() {
  var exam = P.keju.currentExam;
  if (!exam || !P.ai.key) return;

  showLoading('\u4F1A\u8BD5\u6279\u5377\u4E2D...', 30);

  try {
    // 收集治理成果——治理好的国家出好考生
    var govData = {};
    // 从变量中智能查找（不硬编码变量名）
    Object.entries(GM.vars || {}).forEach(function(e) {
      var name = e[0].toLowerCase();
      if (/国库|财政|税收|钱/.test(e[0])) govData.treasury = e[1].value;
      if (/民心|民意|人心/.test(e[0])) govData.morale = e[1].value;
      if (/教育|文教|学/.test(e[0])) govData.education = e[1].value;
      if (/经济|繁荣|商业/.test(e[0])) govData.prosperity = e[1].value;
    });
    if (!govData.treasury) govData.treasury = 50;
    if (!govData.morale) govData.morale = 50;
    if (!govData.education) govData.education = 50;
    if (!govData.prosperity) govData.prosperity = 50;

    var _kejuSubjects = P.keju.examSubjects || '';
    var _kejuRules = P.keju.specialRules || '';
    var scenario = P.scenarios ? P.scenarios.find(function(s){return s.id===GM.sid;}) : null;
    var era = scenario ? (scenario.era || scenario.dynasty || '') : '';

    // 读取会试题目（玩家可能已修改）
    var _huishiTopic = '';
    var _topicEl = document.getElementById('huishi-topic');
    if (_topicEl && _topicEl.value.trim()) { _huishiTopic = _topicEl.value.trim(); exam.huishiTopic = _huishiTopic; }
    else if (exam.huishiTopic) _huishiTopic = exam.huishiTopic;

    // 考官信息
    var _examinerCtx = '';
    if (exam.chiefExaminer) {
      _examinerCtx = '\u3010\u4E3B\u8003\u5B98\u3011' + exam.chiefExaminer;
      if (exam.examinerParty) _examinerCtx += '(\u515A\u6D3E:' + exam.examinerParty + ')';
      _examinerCtx += ' \u667A\u8C0B' + (exam.examinerIntelligence||50);
      if (exam.examinerStance) _examinerCtx += ' \u7ACB\u573A:' + exam.examinerStance.slice(0,15);
      _examinerCtx += '\n\u2192 \u8003\u5B98\u515A\u6D3E\u548C\u7ACB\u573A\u4F1A\u5FAE\u5999\u5F71\u54CD\u54EA\u7C7B\u8003\u751F\u66F4\u5BB9\u6613\u901A\u8FC7\n';
    }

    // 党派信息——影响考生成分
    var _partyCtx = '';
    if (GM.parties && GM.parties.length > 0) {
      _partyCtx = '\u3010\u671D\u4E2D\u515A\u6D3E\u3011' + GM.parties.filter(function(p){return (p.influence||0)>20;}).map(function(p){return p.name+'(\u5F71\u54CD'+p.influence+')';}).join('\u3001') + '\n';
    }

    var prompt = '\u4F60\u662F' + era + '\u79D1\u4E3E\u4F1A\u8BD5\u8BC4\u5224\u7CFB\u7EDF\u3002\u8BF7\u6839\u636E\u6CBB\u7406\u72B6\u51B5\u3001\u8003\u5B98\u504F\u597D\u3001\u793E\u4F1A\u7ED3\u6784\u751F\u6210\u4F1A\u8BD5\u7ED3\u679C\u3002\n\n' +
      '\u3010\u6CBB\u7406\u72B6\u51B5\u3011\u56FD\u5E93:' + govData.treasury + ' \u6C11\u5FC3:' + govData.morale + ' \u6559\u80B2:' + govData.education + ' \u7ECF\u6D4E:' + govData.prosperity + '\n' +
      _examinerCtx + _partyCtx +
      (_kejuSubjects ? '\u3010\u79D1\u76EE\u3011' + _kejuSubjects + '\n' : '') +
      (_kejuRules ? '\u3010\u89C4\u5219\u3011' + _kejuRules + '\n' : '') +
      (_huishiTopic ? '\u3010\u672C\u79D1\u8BD5\u9898\u3011' + _huishiTopic.slice(0,150) + '\n' : '') +
      (exam.preliminaryStats ? '\u3010\u5730\u65B9\u9009\u62D4\u3011\u62A5\u540D' + (exam.preliminaryStats.totalApplicants||0) + '\u4EBA\uFF0C\u901A\u8FC7' + (exam.preliminaryStats.passedToNational||0) + '\u4EBA\n' : '') +
      '\n\u3010\u751F\u6210\u8981\u6C42\u3011\n' +
      '1. passedCount: \u4F1A\u8BD5\u5F55\u53D6\u603B\u4EBA\u6570\uFF08\u6CBB\u7406\u597D\u2192200-300\uFF0C\u6CBB\u7406\u5DEE\u219280-150\uFF09\n' +
      '2. quality: \u8003\u751F\u6574\u4F53\u8D28\u91CF\uFF08\u4F18\u79C0/\u826F\u597D/\u4E00\u822C/\u8F83\u5DEE\uFF09\n' +
      '3. dianshiCount: \u53D6\u591A\u5C11\u540D\u8FDB\u5165\u6BBE\u8BD5\uFF0815-40\u4EBA\uFF09\n' +
      '4. ethnicRatio: \u6C11\u65CF\u5360\u6BD4\n5. classRatio: \u9636\u5C42\u5360\u6BD4\uFF08\u58EB\u65CF/\u5BD2\u95E8/\u5546\u8D3E\u7B49\uFF09\n' +
      '6. partyRatio: \u515A\u6D3E\u5360\u6BD4\uFF08\u8003\u5B98\u515A\u6D3E\u7684\u8003\u751F\u4F1A\u504F\u591A\uFF09\n' +
      '7. localEffect: \u5F55\u53D6\u8005\u5206\u914D\u5730\u65B9\u5BF9\u5409\u6CBB\u7684\u5F71\u54CD\uFF0830\u5B57\uFF09\n' +
      '8. note: \u8003\u5B98\u8BC4\u8BED\uFF0840\u5B57\uFF09\n\n' +
      '\u8FD4\u56DEJSON\u3002\u53EA\u8F93\u51FAJSON\u3002';

    var result = await callAISmart(prompt, 800, {maxRetries: 2});
    var data = JSON.parse(result.replace(/```json|```/g, '').trim());

    var passedCount = data.passedCount || 150;
    var dianshiCount = data.dianshiCount || 20;

    exam.huishiPassed = [];
    for (var i = 0; i < passedCount; i++) {
      exam.huishiPassed.push({ id: 'candidate_' + i, rank: i + 1 });
    }

    exam.statistics = {
      passedCount: passedCount,
      quality: data.quality || '\u4E00\u822C',
      ethnicRatio: data.ethnicRatio || {},
      classRatio: data.classRatio || {},
      partyRatio: data.partyRatio || {},
      note: data.note || '',
      localEffect: data.localEffect || '',
      dianshiCount: dianshiCount
    };

    exam.dianshiCandidates = exam.huishiPassed.slice(0, dianshiCount);
    // 手动开榜与 timed finalize 同责(2026-07-04 审查定罪)：结中央会试经费(settle 已按阶段幂等·不会与 finalize 双扣)
    // +重置阶段计时(旧手动路径继承上一阶段天数·新阶段曾被提前终结)
    if (typeof _kejuSettleCentralCost === 'function') { try { _kejuSettleCentralCost(exam, 'huishi'); } catch(_kc1){} }
    exam.stage = 'dianshi';
    exam.stageStartTurn = GM.turn; exam.stageElapsedDays = 0;

    // v7.1·C3·alignment event·开榜后若题目错配主考偏好·spawn warning + tension/affinity
    if (typeof _kjApplyAlignmentEvent === 'function' && exam.chiefExaminer) {
      var alignCh = (typeof findCharByName === 'function') ? findCharByName(exam.chiefExaminer) : null;
      if (alignCh) {
        try { _kjApplyAlignmentEvent(exam, alignCh); }
        catch(e) { console.warn('[C3] alignment event 失败', e); }
      }
    }

    // 会试录取者分配到地方→影响吏治（轻量机制）
    if (GM.eraState) {
      var _qualBonus = data.quality === '\u4F18\u79C0' ? 0.03 : data.quality === '\u826F\u597D' ? 0.02 : data.quality === '\u4E00\u822C' ? 0.01 : 0;
      GM.eraState.bureaucracyStrength = Math.min(1, (GM.eraState.bureaucracyStrength || 0.5) + _qualBonus);
      if (_qualBonus > 0) {
        addEB('\u79D1\u4E3E', '\u4F1A\u8BD5\u5F55\u53D6' + passedCount + '\u4EBA\u5206\u914D\u5730\u65B9\uFF0C\u5409\u6CBB\u6539\u5584(+' + Math.round(_qualBonus*100) + '%)');
      }
    }

    hideLoading();
    toast('\u2705 \u4F1A\u8BD5\u7ED3\u675F\uFF0C\u5F55\u53D6' + passedCount + '\u4EBA\uFF0C\u524D' + dianshiCount + '\u540D\u8FDB\u5165\u6BBE\u8BD5');
    // v5·纪事
    if (typeof _kejuWriteJishi === 'function') {
      _kejuWriteJishi('\u4F1A\u8BD5\u5F00\u699C', '\u5F55\u53D6' + passedCount + '\u4EBA\u00B7\u524D' + dianshiCount + '\u8FDB\u5165\u6BBE\u8BD5\u00B7\u8D28\u91CF\u300C' + (data.quality||'') + '\u300D', data.note || '');
    }
    renderKejuStage();
  } catch(e) {
    console.error('[\u79D1\u4E3E] \u751F\u6210\u4F1A\u8BD5\u7ED3\u679C\u5931\u8D25:', e);
    hideLoading();
    toast('\u274C \u751F\u6210\u5931\u8D25');
  }
}

/**
 * 渲染殿试阶段
 */
// 兼容 AI 返回的多种 ratio 形状 → 归一化为 {name: 0-1 小数}
function _normalizeRatio(raw) {
  if (!raw) return {};
  var out = {};
  if (Array.isArray(raw)) {
    // 形如 [{name, ratio}] 或 ["汉族 29%"]
    raw.forEach(function(it, idx) {
      if (!it) return;
      if (typeof it === 'string') {
        var m = it.match(/([^\d\s%·:：]+)\s*([0-9.]+)\s*%?/);
        if (m) out[m[1]] = parseFloat(m[2]);
      } else if (typeof it === 'object') {
        var nm = it.name || it.key || it.group || it.class || it.ethnicity || it.party || ('#' + idx);
        var v = it.ratio != null ? it.ratio : (it.percent != null ? it.percent : (it.value != null ? it.value : it.pct));
        if (v != null) out[nm] = v;
      }
    });
  } else if (typeof raw === 'object') {
    Object.keys(raw).forEach(function(k) {
      var v = raw[k];
      if (v == null) return;
      if (typeof v === 'object') {
        var vv = v.ratio != null ? v.ratio : (v.percent != null ? v.percent : v.value);
        if (vv != null) out[k] = vv;
      } else {
        out[k] = v;
      }
    });
  }
  // 统一到 0-1：若存在值 > 1.5，认为是百分比形式，整体 /100
  var vals = Object.keys(out).map(function(k){ return parseFloat(out[k]); }).filter(function(x){ return !isNaN(x); });
  if (vals.length && Math.max.apply(null, vals) > 1.5) {
    Object.keys(out).forEach(function(k){ out[k] = parseFloat(out[k]) / 100; });
  }
  return out;
}
function _hasRatio(raw) { return Object.keys(_normalizeRatio(raw)).length > 0; }
function _fmtRatio(raw) {
  var n = _normalizeRatio(raw);
  var keys = Object.keys(n);
  if (!keys.length) return '<span style="color:var(--txt-d);opacity:0.6;">无</span>';
  return keys.map(function(k){
    var v = parseFloat(n[k]);
    if (isNaN(v)) return '';
    return escHtml(k) + ' ' + Math.round(v * 100) + '%';
  }).filter(Boolean).join(' · ');
}

function renderDianshiStage(container) {
  var exam = P.keju.currentExam;
  var stats = exam.statistics || {};  // 防御：殿试阶段若 statistics 未填(codex 改动遗留)·下方 stats.passedCount 直读会崩"科举面板打不开"
  var dianshiCount = exam.dianshiCandidates ? exam.dianshiCandidates.length : 0;

  container.innerHTML =
    '<div style="margin-bottom:1.5rem;">' +
    // 场景描写
    '<div style="text-align:center;margin-bottom:1rem;">' +
    '<div style="font-size:2rem;margin-bottom:0.3rem;">\uD83D\uDC51</div>' +
    '<h3 style="color:var(--gold);margin-bottom:0.5rem;">\u6BBE\u8BD5</h3>' +
    '<p style="color:var(--txt-d);font-size:0.85rem;line-height:1.7;max-width:500px;margin:0 auto;">' +
    '\u4F1A\u8BD5\u5DF2\u6BD5\uFF0C\u5F55\u53D6' + (stats.passedCount||0) + '\u4EBA\u3002' +
    '\u5176\u4E2D' + dianshiCount + '\u540D\u4F73\u58EB\u5C06\u5165\u5927\u6BBF\uFF0C\u5F85\u5929\u5B50\u4EB2\u81EA\u7B56\u95EE\uFF0C\u8BD5\u5176\u6CBB\u56FD\u7ECF\u4E16\u4E4B\u624D\u3002' +
    '</p></div>' +
    // 会试统计（折叠式）
    '<details style="background:var(--bg-2);padding:0.8rem;border-radius:8px;margin-bottom:1rem;">' +
    '<summary style="color:var(--gold);font-size:0.9rem;cursor:pointer;font-weight:700;">\u4F1A\u8BD5\u7EDF\u8BA1 \u00B7 \u5F55\u53D6' + (stats.passedCount||0) + '\u4EBA \u00B7 \u8D28\u91CF\u201C' + (stats.quality||'') + '\u201D</summary>' +
    '<div style="margin-top:0.5rem;font-size:0.85rem;">' +
    '<p>\u8003\u5B98\u8BC4\u8BED\uFF1A' + (stats.note||'') + '</p>' +
    (stats.localEffect ? '<p style="color:var(--green);">\u5730\u65B9\u5409\u6CBB\u5F71\u54CD\uFF1A' + stats.localEffect + '</p>' : '') +
    '<div style="display:flex;gap:2rem;margin-top:0.5rem;flex-wrap:wrap;">' +
    '<div><span style="font-weight:700;">\u6C11\u65CF</span>: ' + _fmtRatio(stats.ethnicRatio) + '</div>' +
    '<div><span style="font-weight:700;">\u9636\u5C42</span>: ' + _fmtRatio(stats.classRatio) + '</div>' +
    (_hasRatio(stats.partyRatio) ? '<div><span style="font-weight:700;">\u515A\u6D3E</span>: ' + _fmtRatio(stats.partyRatio) + '</div>' : '') +
    '</div></div></details>' +
    // 殿试出题
    '<div style="background:linear-gradient(135deg,var(--bg-2),rgba(138,109,27,0.06));padding:1.2rem;border-radius:8px;border:1px solid var(--gold-d);">' +
    '<h4 style="color:var(--gold);font-size:1rem;margin-bottom:0.8rem;">\uD83D\uDCDC \u5929\u5B50\u7B56\u95EE</h4>' +
    '<p style="color:var(--txt-d);font-size:0.85rem;margin-bottom:0.6rem;">\u8BF7\u62DF\u5B9A\u6BBE\u8BD5\u7B56\u95EE\u9898\u76EE\u2014\u2014\u8003\u5BDF\u8003\u751F\u5BF9\u65F6\u5C40\u7684\u89C1\u89E3\u3001\u6CBB\u56FD\u7684\u65B9\u7565</p>' +
    '<textarea id="dianshi-question" rows="6" oninput="if(typeof _kjUpdateAlignmentUI===\'function\')_kjUpdateAlignmentUI();" style="width:100%;padding:0.8rem;background:var(--bg-1);border:1px solid var(--bdr);border-radius:4px;color:var(--txt);font-family:inherit;resize:vertical;line-height:1.8;font-size:0.95rem;" placeholder="\u4F8B\uFF1A\u671D\u5EF7\u79EF\u5F0A\u65E5\u6DF1\uFF0C\u5916\u60A3\u672A\u5DF2\u3002\u6614\u7BA1\u4EF2\u76F8\u9F50\uFF0C\u5C0A\u738B\u653D\u5937\uFF0C\u4E5D\u5408\u8BF8\u4FAF...\u4F55\u4EE5\u6559\u8054\uFF1F">' + escHtml(exam.playerQuestion || '') + '</textarea>' +
    '<div id="kj-alignment-warn"></div>' +
    '<div style="display:flex;gap:0.5rem;margin-top:0.6rem;">' +
    '<button class="bt bp" onclick="generateDianshiQuestion()" style="flex:1;">\uD83E\uDD16 AI\u4EE3\u62DF\u7B56\u95EE</button>' +
    '<button class="bt" onclick="if(typeof _kjOpenLibuKeyi===\'function\')_kjOpenLibuKeyi();" style="flex:0.8;color:var(--gold);">\uD83D\uDCDC \u53EC\u793C\u90E8\u5546\u8BAE</button>' +
    '<button class="bt bp" onclick="startDianshi()" style="flex:1;background:var(--gold-d);font-weight:700;">\uD83D\uDCDC \u5F00\u59CB\u6BBE\u8BD5</button>' +
    '</div>' +
    '</div>' +
    '</div>';
  // v7.1\u00B7D2\u00B7prepend \u4E3B\u8003\u504F\u597D hint bar (\u590D\u7528 C3\u00B7\u53EA\u8981\u9009\u4E86\u4E3B\u8003\u5373\u663E)
  if (exam && exam.chiefExaminer && typeof _kjRenderExaminerHintBar === 'function') {
    var hintChD = (typeof findCharByName === 'function') ? findCharByName(exam.chiefExaminer) : null;
    if (hintChD) container.innerHTML = _kjRenderExaminerHintBar(hintChD) + container.innerHTML;
  }
  // v7.1\u00B7D2\u00B7\u6E32\u67D3\u540E\u89E6\u53D1 alignment \u56DE\u6D41 (textarea \u5DF2\u6709 playerQuestion \u65F6)
  setTimeout(function(){ if (typeof _kjUpdateAlignmentUI === 'function') _kjUpdateAlignmentUI(); }, 50);
}

/**
 * AI生成殿试题目
 */
async function generateDianshiQuestion() {
  if (!P.ai.key) return;

  showLoading('生成殿试题目...', 50);

  try {
    var scenario = P.scenarios ? P.scenarios.find(function(s) { return s.id === GM.sid; }) : null;
    var era = scenario ? (scenario.era || scenario.dynasty || '') : '';
    // 收集完整游戏上下文供出题
    var ctxParts = ['\u3010\u65F6\u4EE3\u3011' + era];
    if (GM.eraState) {
      ctxParts.push('\u738B\u671D\u9636\u6BB5:' + (GM.eraState.dynastyPhase||'') + ' \u7A33\u5B9A:' + Math.round((GM.eraState.socialStability||0.5)*100) + '% \u7ECF\u6D4E:' + Math.round((GM.eraState.economicProsperity||0.5)*100) + '%');
    }
    if (GM.facs && GM.facs.length > 0) {
      ctxParts.push('\u52BF\u529B:' + GM.facs.slice(0,4).map(function(f){return f.name+'(\u5B9E\u529B'+f.strength+')';}).join('\u3001'));
    }
    if (P.keju.examSubjects) ctxParts.push('\u79D1\u76EE:' + P.keju.examSubjects);
    var _recentEvents = (GM.evtLog || []).slice(-5).map(function(e){return e.text;}).join('；');
    if (_recentEvents) ctxParts.push('\u8FD1\u671F\u4E8B\u4EF6:' + _recentEvents.slice(0, 100));

    var prompt = '\u4F60\u662F\u5F53\u671D\u5929\u5B50\uFF0C\u4EB2\u81EA\u4E3A\u6BBF\u8BD5\u51FA\u7B56\u95EE\u9898\u76EE\u3002\n\n' + ctxParts.join('\n') + '\n\n' +
      '\u3010\u9898\u76EE\u8981\u6C42\u3011\n' +
      '1. \u7B56\u95EE\u5E94\u7D27\u6263\u5F53\u524D\u65F6\u5C40\u548C\u56FD\u5BB6\u6838\u5FC3\u77DB\u76FE\n' +
      '2. \u8003\u5BDF\u8003\u751F\u7684\u6CBB\u56FD\u7406\u653F\u80FD\u529B\u548C\u5386\u53F2\u89C1\u89E3\n' +
      '3. \u9898\u76EE\u957F\u5EA6100-250\u5B57\uFF0C\u4EFF\u53E4\u6587\u7B56\u95EE\u4F53\n' +
      '4. \u7B56\u95EE\u5E94\u5F15\u7528\u5386\u53F2\u5148\u4F8B\uFF0C\u5982\u201C\u6614\u7BA1\u4EF2\u76F8\u9F50...\u201D\n' +
      '5. \u7ED3\u5C3E\u4EE5\u201C\u5B50\u5176\u8BD5\u4E3A\u8054\u5BF9\u4E4B\u201D\u6216\u201C\u4F55\u4EE5\u6559\u8054\u201D\u53E5\u5F0F\u53D1\u95EE\n\n' +
      '\u76F4\u63A5\u8F93\u51FA\u9898\u76EE\uFF0C\u4E0D\u8981JSON\u683C\u5F0F\u3002';

    var question = await callAISmart(prompt, 500, {minLength: 80, maxRetries: 2});
    var _dqEl = document.getElementById('dianshi-question');
    if (_dqEl) _dqEl.value = question; // 弹窗未开时无此元素·裸赋值曾抛错被吞→playerQuestion 永不落→整场殿试空产(2026-07-04 审查定罪)
    // v7.1·D2·AI 代拟后·写 playerQuestion + 算 alignment·错配 toast warning
    var exam = P.keju.currentExam;
    if (exam) {
      exam.playerQuestion = question;
      if (exam.chiefExaminer && typeof _kjCalcTopicAlignment === 'function' && typeof _kejuExaminerView === 'function') {
        var ch = (typeof findCharByName === 'function') ? findCharByName(exam.chiefExaminer) : null;
        if (ch) {
          var view = _kejuExaminerView(ch);
          var alignment = _kjCalcTopicAlignment(question, view);
          exam._topicAlignment = alignment;
          if (alignment < 40 && typeof toast === 'function') {
            toast('⚠ AI 代拟与主考偏好略错配·可亲笔修改');
          }
        }
      }
      if (typeof _kjUpdateAlignmentUI === 'function') _kjUpdateAlignmentUI();
    }
    hideLoading();
    toast('✅ 题目已生成');
  } catch(e) {
    console.error('[科举] 生成题目失败:', e);
    hideLoading();
    toast('❌ 生成失败');
  }
}

/**
 * 开始殿试
 */
/** 殿试进度弹窗·三次重试·实时刷新状态 */
function _kejuOpenDianshiProgress() {
  var existing = document.getElementById('dianshi-progress-modal');
  if (existing) existing.remove();
  var m = document.createElement('div');
  m.id = 'dianshi-progress-modal';
  m.className = 'modal-bg show';
  m.innerHTML =
    '<div style="background:var(--bg-1);border:1px solid var(--gold-d);border-radius:12px;width:90%;max-width:560px;padding:1.5rem 1.8rem;">'
    + '<div style="text-align:center;margin-bottom:1rem;">'
    +   '<div style="font-size:2.2rem;margin-bottom:0.3rem;">\uD83D\uDCDC</div>'
    +   '<div style="font-size:1.1rem;font-weight:700;color:var(--gold);letter-spacing:0.08em;">\u3014 \u6BBE\u8BD5 \u3015</div>'
    +   '<div id="dianshi-progress-subtitle" style="font-size:0.82rem;color:var(--txt-d);margin-top:0.3rem;">\u6574\u7406\u8003\u751F\u7B54\u5377\u4E2D\u2026</div>'
    + '</div>'
    + '<div style="background:var(--bg-2);padding:0.9rem 1rem;border-radius:8px;">'
    +   '<div style="background:var(--bg-3);border-radius:10px;height:14px;overflow:hidden;">'
    +     '<div id="dianshi-progress-bar" style="width:5%;height:100%;background:linear-gradient(90deg,var(--celadon-400),var(--gold));transition:width 0.4s;"></div>'
    +   '</div>'
    +   '<div id="dianshi-progress-status" style="font-size:0.8rem;color:var(--txt-d);margin-top:0.5rem;text-align:center;">\u2026</div>'
    + '</div>'
    + '</div>';
  document.body.appendChild(m);
}

function _kejuUpdateDianshiProgress(status, pct) {
  var bar = document.getElementById('dianshi-progress-bar');
  var st = document.getElementById('dianshi-progress-status');
  if (bar) bar.style.width = Math.max(0, Math.min(100, pct || 0)) + '%';
  if (st) st.textContent = status || '';
}

function _kejuCloseDianshiProgress() {
  var m = document.getElementById('dianshi-progress-modal');
  if (m) m.remove();
}

async function startDianshi() {
  var exam = P.keju.currentExam;
  var _dqEl = document.getElementById('dianshi-question');
  var question = _dqEl ? _dqEl.value.trim() : String((exam && exam.playerQuestion) || '').trim(); // 弹窗未开走 exam.playerQuestion(AI 代拟已落)·勿再依赖 DOM(2026-07-04 审查定罪)

  if (!question) {
    toast('请先输入殿试题目');
    return;
  }

  exam.playerQuestion = question;
  // v7.1·D3·确保 alignment 持久化 (textarea 未触发 oninput 时 fallback 派生)
  if (exam.chiefExaminer && typeof _kjCalcTopicAlignment === 'function' && typeof _kejuExaminerView === 'function') {
    try {
      var _sdCh = (typeof findCharByName === 'function') ? findCharByName(exam.chiefExaminer) : null;
      if (_sdCh) {
        var _sdView = _kejuExaminerView(_sdCh);
        if (_sdView) exam._topicAlignment = _kjCalcTopicAlignment(question, _sdView);
      }
    } catch(_){}
  }
  _kejuOpenDianshiProgress();

  var maxRetries = 3;
  var lastErr = null;
  for (var attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // generateDianshiResults 内部自行推进进度条（5→95%）·此处仅标记尝试
      _kejuUpdateDianshiProgress('\u7B2C ' + attempt + '/' + maxRetries + ' \u6B21\u5C1D\u8BD5\u00B7\u542F\u52A8\u6BBE\u8BD5\u2026', 2);
      await generateDianshiResults();
      if (!exam.dianshiResults || exam.dianshiResults.length < 3) {
        throw new Error('\u6709\u6548\u7B54\u5377\u5C11\u4E8E 3 \u5377');
      }
      _kejuUpdateDianshiProgress('\u2705 \u5171 ' + exam.dianshiResults.length + ' \u5377\u7B54\u5377\u00B7\u4E3B\u8003\u6279\u8BED\u5DF2\u62DF\u00B7\u8BF7\u94A6\u5B9A\u4E09\u7532', 100);
      await new Promise(function(r){ setTimeout(r, 700); });
      _kejuCloseDianshiProgress();
      // 手动开考与 timed finalize 同责：结殿试经费(按阶段幂等)+计时重置
      if (typeof _kejuSettleCentralCost === 'function') { try { _kejuSettleCentralCost(exam, 'dianshi'); } catch(_kc2){} }
      exam.stage = 'finished';
      exam.stageStartTurn = GM.turn; exam.stageElapsedDays = 0;
      renderKejuStage();
      return;
    } catch(e) {
      lastErr = e;
      console.error('[\u79D1\u4E3E\u00B7\u6BBE\u8BD5] \u7B2C' + attempt + '\u6B21\u5931\u8D25:', e);
      if (attempt < maxRetries) {
        _kejuUpdateDianshiProgress('\u26A0 \u7B2C ' + attempt + ' \u6B21\u5931\u8D25\u00B7' + ((e && e.message) || '\u672A\u77E5\u9519\u8BEF') + '\u00B7 2 \u79D2\u540E\u91CD\u8BD5\u2026', 50);
        await new Promise(function(r){ setTimeout(r, 2000); });
      } else {
        _kejuUpdateDianshiProgress('\u274C \u5DF2\u91CD\u8BD5 ' + maxRetries + ' \u6B21\u7686\u5931\u8D25\u00B7\u8BF7\u68C0\u67E5 AI \u914D\u7F6E\u6216\u91CD\u8BD5', 100);
        await new Promise(function(r){ setTimeout(r, 1600); });
        _kejuCloseDianshiProgress();
        toast('\u274C \u6BBE\u8BD5\u5931\u8D25\uFF08\u5DF2\u91CD\u8BD5 ' + maxRetries + ' \u6B21\uFF09\uFF1A' + ((lastErr && lastErr.message) || '\u672A\u77E5\u9519\u8BEF'));
      }
    }
  }
}

/**
 * 生成殿试结果（v6·多轮分批·每卷足额字数 + 主考官批语）
 * 流程：
 *   1) meta 调用：AI 生成 20 名考生的基本档案（无 fullAnswer），保证每人都有
 *   2) 分批答卷：4 批 × 5 人 = 20 卷，每批单独 AI 调用，保证 fullAnswer 足额
 *   3) 主考官批语：一次 AI 调用为 20 卷各批一则 30-80 字"批语"
 */
async function generateDianshiResults() {
  var exam = P.keju.currentExam;
  if (!exam) throw new Error('无当前科举');
  if (!P.ai || !P.ai.key) throw new Error('未配置 AI Key');

  var _topCount = Math.min(exam.dianshiCandidates ? exam.dianshiCandidates.length : 20, 20);
  var _subjects = P.keju.examSubjects || '';
  var _rules = P.keju.specialRules || '';
  var _dyn = P.dynasty || P.era || (typeof scriptData !== 'undefined' && scriptData && scriptData.dynasty) || '';
  var _year = GM.year || (P.time && P.time.year) || 1600;

  // ═══ F2·先检索历史名臣 ═══
  if (typeof _kejuUpdateDianshiProgress === 'function') _kejuUpdateDianshiProgress('\u68C0\u7D22\u5386\u53F2\u540D\u81E3\u79CD\u5B50\u2026', 5);
  var historicalCands = await pickHistoricalCandidates(exam);
  var histNamesStr = historicalCands.length
    ? historicalCands.map(function(h){ return h.name + '(' + h.age + '\u5C81\u00B7' + h.class + '\u00B7' + (h.party||'\u65E0\u515A') + ')'; }).join('\u3001')
    : '\u65E0';

  // 已任官员名单（严禁作为考生出现）
  var _officialNames = (GM.chars || []).filter(function(c){
    return c && c.alive !== false && (c.officialTitle || c.title || c.spouse || c.isPlayer);
  }).map(function(c){ return c.name; });

  // v7.1·D3·主考偏好 + 策问契合度 context (注入 prompt·影响考生质量倾向)
  var _examinerCtx = '';
  if (exam.chiefExaminer && typeof _kejuExaminerView === 'function') {
    try {
      var _exCh = (typeof findCharByName === 'function') ? findCharByName(exam.chiefExaminer) : null;
      if (_exCh) {
        var _exView = _kejuExaminerView(_exCh);
        if (_exView) {
          _examinerCtx = '【主考偏好】' + (_exView._summary || exam.chiefExaminer) + '\n'
            + '· 偏好内容·' + (_exView.preferContent || '未知') + '\n'
            + '· 偏好籍贯·' + (_exView.preferRegion || '无') + '\n'
            + '· 严格度·' + Math.round(_exView.strictness) + '/100\n'
            + '· 派系偏向·' + _exView.factionBias.toFixed(2) + '\n';
        }
      }
    } catch(_){}
  }
  var _alignmentScore = exam._topicAlignment || 50;
  var _alignmentCtx = '【策问契合度】' + _alignmentScore + '/100\n'
    + '· 契合 >70 时·考生答卷质量整体加成 (理解策问深·应答契合)\n'
    + '· 错配 <40 时·主考评价倾向负面 (士林侧目·答卷不解题旨)\n';

  var _ctxHeader =
    '\u3010\u786C\u89C4\u5219\u3011\u8003\u751F\u5FC5\u987B\u662F\u5E03\u8863/\u76D1\u751F/\u4E3E\u4EBA/\u672A\u51FA\u4ED5\u7684\u4E66\u751F\u00B7\u7EDD\u4E0D\u53EF\u4E3A\u5DF2\u4EFB\u5B98\u8005\u3002\n'
    + (_officialNames.length ? '\u3010\u7981\u6B62\u59D3\u540D\u3011' + _officialNames.slice(0, 60).join('\u3001') + (_officialNames.length>60?'\u7B49':'') + '\n' : '')
    + '\u3010\u6BBE\u8BD5\u9898\u76EE\u3011' + (exam.playerQuestion || '(\u7A7A)') + '\n'
    + _examinerCtx + _alignmentCtx
    + (_subjects ? '\u3010\u8003\u8BD5\u79D1\u76EE\u3011' + _subjects + '\n' : '')
    + (_rules ? '\u3010\u8003\u8BD5\u89C4\u5219\u3011' + _rules + '\n' : '')
    + '\u3010\u5386\u53F2\u540D\u81E3\u79CD\u5B50\u3011' + histNamesStr + '\n'
    + (historicalCands.length ? '\u5386\u53F2\u540D\u81E3\u5E94\u5206\u5E03\u524D 20 \u540D\u5185\u00B7\u4F7F\u7528\u5176\u771F\u5B9E\u5B57\u53F7\u7C4D\u8D2F\u5E74\u9F84\u7ACB\u573A\n' : '');

  // ═══ Step 1: meta 调用 (20 人档案，无 fullAnswer) ═══
  if (typeof _kejuUpdateDianshiProgress === 'function') _kejuUpdateDianshiProgress('\u751F\u6210 ' + _topCount + ' \u540D\u8003\u751F\u6863\u6848\u2026', 15);
  var metaPrompt = '\u4F60\u662F' + _dyn + '\u79D1\u4E3E\u6BBE\u8BD5 AI\u3002\u4E3A ' + _year + ' \u5E74\u6BBE\u8BD5\u751F\u6210\u524D ' + _topCount + ' \u540D\u8003\u751F\u7684\u57FA\u672C\u6863\u6848\uFF08\u6682\u4E0D\u5199\u7B54\u5377\uFF09\u3002\n\n'
    + _ctxHeader
    + '\n\u3010\u8981\u6C42\u3011\n'
    + '1. \u5171 ' + _topCount + ' \u540D\u8003\u751F\u3002\u7B2C1=\u72B6\u5143\uFF0C2=\u699C\u773C\uFF0C3=\u63A2\u82B1\u3002\n'
    + '2. \u6BCF\u540D\uFF1Aname/age(20-55)/origin/ethnicity/class(\u58EB\u65CF|\u5BD2\u95E8|\u5546\u8D3E|\u5176\u4ED6)/party(\u53EF\u7A7A)/style(\u7B56\u8BBA/\u8BE6\u7ECF/\u660E\u7406/\u5F53\u4EE3)/personalityHint(20\u5B57)/score(0-100)/isHistorical/shiliao(\u5386\u53F2\u4EBA\u7269\u5FC5\u586B\u539F\u6587\u6458\u5F15)/nativeEra/timeAnomaly\n'
    + '3. \u59D3\u540D\u7C4D\u8D2F\u9700\u7B26\u5408\u8BE5\u671D\u4EE3\u7279\u5F81\u3002\n\n'
    + '\u8FD4\u56DE JSON \u6570\u7EC4\uFF0C\u6309 rank 1..' + _topCount + ' \u6392\u5E8F\uFF0C\u53EA\u8F93\u51FA JSON\u3002';
  var _metaTok = (P.conf && P.conf.maxOutputTokens > 0) ? P.conf.maxOutputTokens : 6000;
  var metaRaw = await callAISmart(metaPrompt, Math.min(_metaTok, 6000), { maxRetries: 2 });
  var candidates = _parseJsonArr(metaRaw);
  if (!Array.isArray(candidates) || candidates.length < 3) {
    throw new Error('AI meta \u8FD4\u56DE\u65E0\u6548·\u8003\u751F\u6863\u6848\u751F\u6210\u5931\u8D25');
  }
  // 保证 rank 字段
  candidates.forEach(function(c, i){ if (!c.rank) c.rank = i + 1; });
  candidates.sort(function(a,b){ return (a.rank||99) - (b.rank||99); });
  candidates = candidates.slice(0, _topCount);

  // 后过滤·剔除已任官员/后妃/玩家
  var _offSet = {};
  _officialNames.forEach(function(n){ _offSet[n] = true; });
  candidates = candidates.filter(function(c){
    if (!c || !c.name) return false;
    if (_offSet[c.name]) {
      console.warn('[\u6BBE\u8BD5\u00B7\u6EE4] \u4E22\u5F03\u5DF2\u4EFB\u5B98\u5019\u9009:', c.name);
      return false;
    }
    var _ech = (typeof findCharByName === 'function') ? findCharByName(c.name) : null;
    if (_ech && (_ech.officialTitle || _ech.title || _ech.spouse || _ech.isPlayer)) {
      console.warn('[\u6BBE\u8BD5\u00B7\u6EE4] \u4E22\u5F03\u5DF2\u4EFB\u5B98\u5019\u9009:', c.name);
      return false;
    }
    return true;
  });
  if (candidates.length < 3) throw new Error('AI 返回有效考生不足 3 名（剔除已任官员后）');

  // ═══ Step 2: 分批生成 fullAnswer（4 批 × 5 人 = 20） ═══
  var BATCH_SIZE = 5;
  var totalBatches = Math.ceil(candidates.length / BATCH_SIZE);
  for (var b = 0; b < totalBatches; b++) {
    var batch = candidates.slice(b*BATCH_SIZE, (b+1)*BATCH_SIZE);
    var batchPct = 25 + Math.round(((b+0.5)/totalBatches) * 50);
    if (typeof _kejuUpdateDianshiProgress === 'function') {
      _kejuUpdateDianshiProgress('\u751F\u6210\u7B2C ' + (b+1) + '/' + totalBatches + ' \u6279\u7B54\u5377\uFF08\u7B2C ' + (b*BATCH_SIZE+1) + '-' + Math.min((b+1)*BATCH_SIZE, candidates.length) + ' \u540D\uFF09\u2026', batchPct);
    }
    var batchPrompt = '\u4F60\u662F' + _dyn + '\u6BBE\u8BD5\u7B54\u5377 AI\u3002\u4E3A\u4EE5\u4E0B ' + batch.length + ' \u540D\u8003\u751F\u751F\u6210\u5B8C\u6574\u7B54\u5377\u3002\n\n'
      + '\u3010\u6BBE\u8BD5\u9898\u76EE\u3011\n' + (exam.playerQuestion || '(\u7A7A)') + '\n\n'
      + '\u3010\u8003\u751F\u540D\u5355\u3011\n'
      + batch.map(function(c){
          var h = '';
          if (c.isHistorical && c.shiliao) h = '\u2605\u5386\u53F2\u4EBA\u7269\u00B7\u53F2\u6599\uFF1A' + (c.shiliao||'').slice(0, 120);
          return '\u7B2C' + c.rank + '\u540D\uFF1A' + c.name + '\uFF08' + (c.age||30) + '\u5C81\u00B7' + (c.origin||'') + '\u00B7' + (c.class||'\u5BD2\u95E8') + '\u00B7' + (c.party||'\u65E0\u515A') + '\u00B7\u98CE\u683C' + (c.style||'') + '\u00B7\u6027\u683C' + (c.personalityHint||'') + '\u00B7\u8BC4\u5206' + (c.score||75) + '\uFF09' + h;
        }).join('\n') + '\n\n'
      + '\u3010\u8981\u6C42\u3011\n'
      + '1. \u4E3A\u6BCF\u540D\u751F\u6210 fullAnswer\uFF1A\u5B8C\u6574\u7B54\u5377 800-1500 \u5B57\uFF08\u624D\u534E\u4F73\u8005 1300-1500\uFF0C\u5BD2\u95E8\u82E6\u8BFB 1000-1200\uFF0C\u5E73\u5EB8 800-1000\uFF0C\u4F46\u4EFB\u4F55\u4EBA\u4E0D\u53EF\u77ED\u4E8E 600 \u5B57\uFF09\n'
      + '2. \u4E3A\u6BCF\u540D\u751F\u6210 evaluation\uFF1A\u8003\u5B98\u7B80\u8BC4 40-80 \u5B57\n'
      + '3. \u7B54\u5377\u987B\u53CD\u6620\u8003\u751F\u98CE\u683C/\u6027\u683C/\u7C4D\u8D2F/\u515A\u6D3E/\u8BC4\u5206\u7B49\u7EA7\n'
      + '4. \u5386\u53F2\u4EBA\u7269\u6587\u98CE\u5FC5\u7B26\u5408\u53F2\u4E66\u8BB0\u8F7D\uFF08\u5982\u9752\u7490\u521A\u76F4\u3001\u9EC4\u9053\u5468\u5B66\u8005\u6C14\uFF09\n\n'
      + '\u8FD4\u56DE JSON \u6570\u7EC4\uFF1A[{"rank":1,"name":"...","fullAnswer":"...","evaluation":"..."}, ...]\u00B7\u53EA\u8F93\u51FA JSON\u3002';
    var _batchTok = (P.conf && P.conf.maxOutputTokens > 0) ? P.conf.maxOutputTokens : 16000;
    _batchTok = Math.min(_batchTok, 16000);
    try {
      var batchRaw = await callAISmart(batchPrompt, _batchTok, { maxRetries: 2 });
      var batchArr = _parseJsonArr(batchRaw);
      if (Array.isArray(batchArr)) {
        batchArr.forEach(function(r){
          if (!r || !r.name) return;
          var tgt = candidates.find(function(c){ return c.name === r.name || c.rank === r.rank; });
          if (tgt) {
            if (r.fullAnswer) tgt.fullAnswer = r.fullAnswer;
            if (r.evaluation) tgt.evaluation = r.evaluation;
          }
        });
      }
    } catch(e) {
      console.warn('[\u6BBE\u8BD5\u00B7F3] \u7B2C ' + (b+1) + ' \u6279\u7B54\u5377\u751F\u6210\u5931\u8D25\uFF0C\u7EE7\u7EED\u4E0B\u4E00\u6279:', e.message||e);
    }
  }

  // ═══ Step 3: 主考官批语 ═══
  if (typeof _kejuUpdateDianshiProgress === 'function') _kejuUpdateDianshiProgress('\u5F85\u4E3B\u8003\u5B98\u6279\u9605\u00B7\u62DF\u5199\u6279\u8BED\u2026', 78);
  try {
    await _kejuGenChiefExaminerComments(exam, candidates);
  } catch(e) {
    console.warn('[\u6BBE\u8BD5\u00B7\u4E3B\u8003\u6279\u8BED] \u751F\u6210\u5931\u8D25:', e);
  }

  // 若有考生 fullAnswer 仍缺（某批失败）·补上占位·避免 UI 显示 undefined
  candidates.forEach(function(c){
    if (!c.fullAnswer || c.fullAnswer.length < 200) {
      c.fullAnswer = (c.fullAnswer || '') + '\n\n\uFF08\u672C\u5377\u56E0\u629E\u65E9\u6295\u5377\u0020\u6216\u7B54\u7B80\u8981\uFF0C\u539F\u6587\u4EC5\u5B58\u6458\u8981\uFF09';
    }
    if (!c.evaluation) c.evaluation = '\u6587\u8BEF\u6355\u4F7F\uFF0C\u51FA\u5165\u7ECF\u5178\u3002';
    if (!c.chiefExaminerComment) c.chiefExaminerComment = '\u6279\u66F0\uFF1A\u5370\u8BC1\u6CA1\u5199\u3002';
  });

  exam.dianshiResults = candidates;
  _dbg('[科举·F3] 生成', candidates.length, '卷答卷·历史名臣', historicalCands.length, '人');

  // v5·F4·生成考官建议（合议推荐三甲）
  if (typeof _kejuUpdateDianshiProgress === 'function') _kejuUpdateDianshiProgress('\u8BF8\u8003\u5B98\u5408\u8BAE\u63A8\u8350\u4E09\u7532\u2026', 92);
  try { await _kejuGenExaminerSuggestions(exam); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'F4] 考官建议失败') : console.warn('[F4] 考官建议失败', e); }
}

/** 解析 AI 返回的 JSON 数组·多级降级 */
function _parseJsonArr(raw) {
  if (!raw) return null;
  try {
    var parsed = (typeof extractJSON === 'function') ? extractJSON(raw) : null;
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.candidates)) return parsed.candidates;
    if (parsed && Array.isArray(parsed.results)) return parsed.results;
  } catch(_){}
  var cleaned = raw.replace(/```json|```/g, '').trim();
  var jm = cleaned.match(/\[[\s\S]*\]/);
  if (jm) {
    try { return JSON.parse(jm[0]); } catch(_){
      try { return JSON.parse(jm[0].replace(/,\s*\]/g,']').replace(/,\s*\}/g,'}')); } catch(_){}
    }
  }
  return null;
}

/** 主考官逐卷批语（一次 AI 调用生成所有卷的批语） */
async function _kejuGenChiefExaminerComments(exam, candidates) {
  if (!exam.chiefExaminer || !P.ai || !P.ai.key) return;
  var chief = (typeof findCharByName === 'function') ? findCharByName(exam.chiefExaminer) : null;
  var chiefInfo = chief
    ? (chief.name + '\uFF08' + (chief.officialTitle||chief.title||'') + '\u00B7\u515A' + (chief.party||'\u65E0\u515A') + '\u00B7\u6027\u683C' + (chief.personality||'').slice(0,20) + '\u00B7\u7ACB\u573A' + (chief.stance||'').slice(0,20) + '\uFF09')
    : exam.chiefExaminer;
  var listStr = candidates.map(function(c){
    return '\u7B2C' + c.rank + '\u540D ' + c.name + '\u00B7\u98CE\u683C' + (c.style||'') + '\u00B7\u7B54\u5377\u5F00\u5934\uFF1A' + (c.fullAnswer||'').slice(0, 80).replace(/\n/g,' ');
  }).join('\n');
  var prompt = '\u4F60\u4EE5\u4E3B\u8003\u5B98 ' + chiefInfo + ' \u7684\u53E3\u543B\uFF0C\u4E3A\u4EE5\u4E0B ' + candidates.length + ' \u540D\u8003\u751F\u7684\u6BBF\u8BD5\u7B54\u5377\u5404\u5199\u4E00\u5219\u300C\u4E3B\u8003\u6279\u8BED\u300D\u3002\n\n'
    + '\u6BBE\u8BD5\u9898\uFF1A' + (exam.playerQuestion||'').slice(0,150) + '\n\n'
    + '\u5377\u4ECE\uFF1A\n' + listStr + '\n\n'
    + '\u8981\u6C42\uFF1A\n'
    + '1. \u6BCF\u5219\u6279\u8BED 40-100 \u5B57\uFF0C\u4EFF\u53E4\u4EE3\u4E3B\u8003\u5B98\u8BED\u6C14\uFF08\u201C\u7B56\u8BBA\u5BCF\u6377\u201D\u300C\u6587\u91CC\u6709\u675F\u300D\u300C\u8BED\u591A\u514F\u4E2D\u201D\u300C\u6C14\u6025\u672A\u7EAF\u201D\u7B49\uFF09\n'
    + '2. \u6279\u8BED\u5FC5\u987B\u53CD\u6620\u4E3B\u8003\u672C\u4EBA\u7684\u515A\u6D3E\u4E0E\u6027\u683C\uFF08\u5982\u4E1C\u6797\u6E05\u6D41\u591A\u8D5E\u8BBA\u6587\u00B7\u9605\u515A\u8D2C\u6DF1\u6587\u00B7\u6B66\u5C06\u51FA\u8EAB\u4E0D\u61C2\u6587\u4F46\u79F0\u8D5E\u5FD7\u8282\uFF09\n'
    + '3. \u6279\u8BED\u53EF\u5BBD\u53EF\u4E25\u00B7\u4F46\u5FC5\u987B\u5177\u4F53\u6307\u51FA\u4F18\u70B9\u6216\u7F3A\u5931\n'
    + '\u8FD4\u56DE JSON\uFF1A[{"rank":1,"name":"...","chiefExaminerComment":"..."}, ...]\u00B7\u53EA\u8F93\u51FA JSON\u3002';
  var _tokC = (P.conf && P.conf.maxOutputTokens > 0) ? P.conf.maxOutputTokens : 8000;
  _tokC = Math.min(_tokC, 8000);
  var rawC = await callAISmart(prompt, _tokC, { maxRetries: 2 });
  var arr = _parseJsonArr(rawC);
  if (!Array.isArray(arr)) return;
  arr.forEach(function(r){
    if (!r) return;
    var tgt = candidates.find(function(c){ return (r.name && c.name === r.name) || (r.rank && c.rank === r.rank); });
    if (tgt && r.chiefExaminerComment) tgt.chiefExaminerComment = r.chiefExaminerComment;
  });
}

// ══════════════════════════════════════════════════════════════════
// v5·F4·考官建议 AI 生成
// ══════════════════════════════════════════════════════════════════

async function _kejuGenExaminerSuggestions(exam) {
  if (!exam || !exam.dianshiResults || !exam.dianshiResults.length) return;
  if (!P.ai || !P.ai.key) return;

  // 考官池：主考官 + 副考官 + 礼部评卷综合
  var examiners = [];
  if (exam.chiefExaminer) {
    var chief = findCharByName(exam.chiefExaminer);
    if (chief) examiners.push(chief);
  }
  (exam.subExaminers || []).forEach(function(n){
    var c = findCharByName(n);
    if (c) examiners.push(c);
  });
  // 若无副考官·从党派/翰林院选 2 位
  if (examiners.length < 2) {
    var extras = (GM.chars||[]).filter(function(c){
      if (!c || c.alive === false || !_isAtCapital(c) || examiners.indexOf(c) >= 0) return false;
      var t = c.officialTitle || c.title || '';
      return /\u7FF0\u6797|\u793C\u90E8|\u56FD\u5B50\u76D1|\u5927\u5B66\u58EB/.test(t);
    }).slice(0, 3 - examiners.length);
    examiners = examiners.concat(extras);
  }

  if (!examiners.length) {
    exam.examinerSuggestions = { '\u793C\u90E8\u7EFC\u5408': exam.dianshiResults.map(function(c){ return { name: c.name, reason: '\u6309\u7EFC\u5408\u5206' }; }) };
    return;
  }

  var candidateInfo = exam.dianshiResults.slice(0, 20).map(function(c, i){
    return (i+1) + '. ' + c.name + '(' + (c.class||'?') + ',' + (c.party||'\u65E0\u515A') + ',\u5206' + (c.score||0) + ',\u98CE\u683C:' + (c.style||'?') + ')';
  }).join('\n');

  var suggestions = {};
  for (var i=0; i<examiners.length; i++) {
    var ex = examiners[i];
    var prompt = '\u4F60\u662F\u6BBE\u8BD5\u9605\u5377\u5B98 ' + ex.name + '\uFF08' + (ex.officialTitle||ex.title||'') +
      '\u00B7\u515A\u6D3E:' + (ex.party||'\u65E0\u515A') + '\u00B7\u7ACB\u573A:' + (ex.stance||ex.personality||'') + '\u667A' + (ex.intelligence||70) + '\uFF09\u3002\n\n' +
      '\u3010\u6BBE\u8BD5\u9898\u76EE\u3011' + (exam.playerQuestion||'').slice(0,200) + '\n\n' +
      '\u3010\u524D 20 \u540D\u8003\u751F\u3011\n' + candidateInfo + '\n\n' +
      '\u8BF7\u7ED9\u51FA\u4F60\u5BF9\u524D 20 \u540D\u7684\u6392\u5E8F\u5EFA\u8BAE\uFF08\u53D7\u81EA\u8EAB\u515A\u6D3E/\u7ACB\u573A/\u80FD\u529B\u504F\u5FC3\u5F71\u54CD\uFF0C\u4E0D\u4E00\u5B9A\u4F9D\u7EFC\u5408\u5206\uFF09\u3002\n' +
      '\u8FD4\u56DE JSON\uFF1A[{"name":"\u59D3\u540D","reason":"\u63A8\u8350\u7406\u7531 30-50 \u5B57"}, ...] \u00B7 \u5171 20 \u9879 \u00B7 \u53EA\u8F93\u51FA JSON\u3002';
    try {
      var raw = await callAISmart(prompt, 3000, { maxRetries: 1 });
      var parsed = (typeof extractJSON === 'function') ? extractJSON(raw) : null;
      if (!parsed) { var m = raw.match(/\[[\s\S]*\]/); if (m) try { parsed = JSON.parse(m[0]); } catch(_){} }
      if (Array.isArray(parsed)) {
        suggestions[ex.name + '(' + (ex.party||'\u65E0\u515A') + ')'] = parsed;
      }
    } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'F4') : console.warn('[F4] 考官 ' + ex.name + ' 意见失败', e); }
  }

  // 礼部综合分排序
  suggestions['\u793C\u90E8\u7EFC\u5408'] = exam.dianshiResults.slice().sort(function(a,b){
    return (b.score||0) - (a.score||0);
  }).map(function(c){ return { name: c.name, reason: '\u7EFC\u5408\u5206 ' + (c.score||0) }; });

  exam.examinerSuggestions = suggestions;
}

/**
 * 渲染考试结束阶段
 */
// ══════════════════════════════════════════════════════════════════
// v5·F5·殿试钦定三甲 UI
// ══════════════════════════════════════════════════════════════════

/** 钦定面板·考官意见全列+左侧卷号右侧拖拽/钦点 */
function renderDianshiDecideStage(container) {
  var exam = P.keju.currentExam;
  var results = exam.dianshiResults || [];
  if (!exam._pendingRanking) exam._pendingRanking = { zhuangyuan: null, bangyan: null, tanhua: null };
  var pr = exam._pendingRanking;

  var html = '<div style="margin-bottom:1.2rem;text-align:center;">'+
    '<div style="font-size:2rem;">\uD83D\uDCDC</div>'+
    '<h3 style="color:var(--gold);">\u6BBE\u8BD5\u8BFB\u5377\u00B7\u9661\u4E0B\u94A6\u5B9A\u4E09\u7532</h3>'+
    '<p style="color:var(--txt-d);font-size:0.8rem;">\u6BBE\u8BD5\u9898\u76EE\uFF1A' + escHtml((exam.playerQuestion||'').slice(0,60)) + '...</p></div>';

  // 考官意见
  var sugs = exam.examinerSuggestions || {};
  var sugKeys = Object.keys(sugs);
  if (sugKeys.length) {
    html += '<details style="background:var(--bg-2);border-radius:6px;padding:0.6rem 0.8rem;margin-bottom:0.8rem;" open>'+
      '<summary style="color:var(--gold);font-weight:700;cursor:pointer;">\u8003\u5B98\u5EFA\u8BAE\uFF08\u5168\u5217\uFF09</summary>'+
      '<div style="margin-top:0.4rem;font-size:0.8rem;">';
    sugKeys.forEach(function(k){
      var list = sugs[k] || [];
      var top5 = list.slice(0,5).map(function(s,i){ return (i+1)+'.'+s.name; }).join(' &gt; ');
      html += '<div style="padding:3px 0;border-bottom:1px dotted var(--bdr);">'+
        '<span style="color:var(--celadon-400);">\u2500 '+escHtml(k)+'\uFF1A</span>'+
        '<span style="color:var(--txt-s);">'+escHtml(top5)+'...</span>'+
        '</div>';
    });
    html += '</div></details>';
  }

  // 当前钦定
  html += '<div style="background:linear-gradient(135deg,rgba(184,154,83,0.1),transparent);padding:0.8rem;border:1px solid var(--gold-d);border-radius:6px;margin-bottom:0.8rem;">'+
    '<div style="font-weight:700;color:var(--gold);margin-bottom:0.4rem;">\u5F53\u524D\u94A6\u5B9A</div>'+
    '<div style="font-size:0.88rem;line-height:1.9;">'+
    '\uD83E\uDD47 \u72B6\u5143\uFF1A<span style="color:var(--gold);">' + (pr.zhuangyuan ? escHtml(pr.zhuangyuan) : '???') + '</span><br>'+
    '\uD83E\uDD48 \u699C\u773C\uFF1A<span style="color:var(--gold);">' + (pr.bangyan ? escHtml(pr.bangyan) : '???') + '</span><br>'+
    '\uD83E\uDD49 \u63A2\u82B1\uFF1A<span style="color:var(--gold);">' + (pr.tanhua ? escHtml(pr.tanhua) : '???') + '</span>'+
    '</div>'+
    '</div>';

  // 20 卷列表
  html += '<div style="font-size:0.85rem;color:var(--txt-d);margin-bottom:0.4rem;">\u00B7 20 \u5377\u8BFB\u5377\u5019\u6765\uFF08\u70B9\u51FB\u7B54\u5377\u00B7\u94A6\u70B9\u4F4D\u6B21\uFF09</div>';
  results.forEach(function(c, i){
    var slotTaken = pr.zhuangyuan === c.name ? '\uD83E\uDD47\u72B6\u5143' : pr.bangyan === c.name ? '\uD83E\uDD48\u699C\u773C' : pr.tanhua === c.name ? '\uD83E\uDD49\u63A2\u82B1' : '';
    var histMark = c.isHistorical ? ' <span style="color:var(--amber-400);font-size:0.7rem;">\u53F2</span>' : '';
    html += '<div style="background:'+(slotTaken?'rgba(184,154,83,0.12)':'var(--bg-3)')+';padding:0.5rem 0.7rem;margin-bottom:3px;border-radius:4px;">'+
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">'+
      '<div style="flex:1;">'+
      '<strong style="font-size:0.9rem;">\u7B2C'+(i+1)+'\u540D\uFF1A'+escHtml(c.name)+'</strong>'+histMark+
      ' <span style="font-size:0.72rem;color:var(--txt-d);">' + (c.age||'?') + '\u5C81 ' + escHtml(c.origin||'') + ' ' + escHtml(c.class||'') + ' \u5206'+(c.score||0)+'</span>'+
      (slotTaken ? ' <span style="color:var(--gold);font-size:0.72rem;">'+slotTaken+'</span>' : '')+
      '</div>'+
      '<div style="display:flex;gap:3px;">'+
      '<button class="bt bs bsm" onclick="viewAnswer('+i+')" style="font-size:0.72rem;padding:2px 6px;">\u7B54\u5377</button>'+
      '<button class="bt bp bsm" onclick="_qinDianPick(\''+escHtml(c.name).replace(/\'/g,"\\'")+'\',\'zhuangyuan\')" style="font-size:0.72rem;padding:2px 6px;background:var(--gold);">\u72B6\u5143</button>'+
      '<button class="bt bp bsm" onclick="_qinDianPick(\''+escHtml(c.name).replace(/\'/g,"\\'")+'\',\'bangyan\')" style="font-size:0.72rem;padding:2px 6px;">\u699C\u773C</button>'+
      '<button class="bt bp bsm" onclick="_qinDianPick(\''+escHtml(c.name).replace(/\'/g,"\\'")+'\',\'tanhua\')" style="font-size:0.72rem;padding:2px 6px;">\u63A2\u82B1</button>'+
      '</div></div></div>';
  });

  // 钦定按钮
  var ready = pr.zhuangyuan && pr.bangyan && pr.tanhua;
  html += '<div style="text-align:center;margin-top:0.8rem;">'+
    '<button class="bt bp" '+(ready?'':'disabled')+' onclick="confirmFinalRanking()" style="padding:0.7rem 2.4rem;font-size:0.95rem;background:'+(ready?'var(--gold-d)':'var(--bg-3)')+';">\uD83D\uDCDC \u94A6\u5B9A\u00B7\u5F20\u699C\u5929\u4E0B</button>'+
    '</div>';

  container.innerHTML = html;
}

/** 点击钦定位次 */
function _qinDianPick(name, slot) {
  var exam = P.keju.currentExam;
  if (!exam) return;
  if (!exam._pendingRanking) exam._pendingRanking = {};
  // 若该名字已在其他位次·先清除
  ['zhuangyuan','bangyan','tanhua'].forEach(function(k){
    if (exam._pendingRanking[k] === name) exam._pendingRanking[k] = null;
  });
  exam._pendingRanking[slot] = name;
  renderKejuStage();
}

/** 确认钦定·触发后续 */
function confirmFinalRanking() {
  var exam = P.keju.currentExam;
  if (!exam || !exam._pendingRanking) return;
  var pr = exam._pendingRanking;
  if (!pr.zhuangyuan || !pr.bangyan || !pr.tanhua) { toast('\u9700\u94A6\u5B9A\u4E09\u7532'); return; }

  exam.finalRanking = {
    zhuangyuan: pr.zhuangyuan,
    bangyan: pr.bangyan,
    tanhua: pr.tanhua,
    autoAssigned: false
  };

  // 与考官意见对比·若违背多数·党争扰动
  _kejuJudgeRankingControversy(exam);

  // v7.1·D4·跑党争 + 寒门 + 失败 UX events (剧本无关化·读 GM.parties + GM.classes 动态)
  if (typeof _kjConfirmRankingEffects === 'function') {
    try { _kjConfirmRankingEffects(exam.finalRanking, exam); }
    catch(e) { console.warn('[D4] confirm ranking effects 失败', e); }
  }

  // v5·纪事 + 三甲 NPC 记忆
  if (typeof _kejuWriteJishi === 'function') {
    _kejuWriteJishi('\u6BBE\u8BD5\u94A6\u5B9A\u4E09\u7532', pr.zhuangyuan + '/' + pr.bangyan + '/' + pr.tanhua, '\u9661\u4E0B\u4EB2\u5B9A\u72B6\u5143\u3001\u699C\u773C\u3001\u63A2\u82B1');
  }
  if (typeof addEB === 'function') addEB('\u79D1\u4E3E', '\u94A6\u5B9A\u4E09\u7532\u00B7\u72B6\u5143' + pr.zhuangyuan + '\u00B7\u699C\u773C' + pr.bangyan + '\u00B7\u63A2\u82B1' + pr.tanhua);
  if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
    var playerName = (P.playerInfo && P.playerInfo.characterName) || '\u9661\u4E0B';
    [pr.zhuangyuan, pr.bangyan, pr.tanhua].forEach(function(name, idx){
      var rankLbl = ['\u72B6\u5143','\u699C\u773C','\u63A2\u82B1'][idx];
      NpcMemorySystem.remember(name, '\u6BBE\u8BD5\u53CA\u7B2C\u00B7\u8499' + playerName + '\u4EB2\u7B56\u94A6\u70B9\u4E3A' + rankLbl + '\u00B7\u5929\u5B50\u95E8\u751F\u4E4B\u8363', '\u656C', 9, playerName);
    });
  }

  delete exam._pendingRanking;
  exam.stage = 'finished';
  toast('\uD83D\uDCDC \u94A6\u5B9A\u5DF2\u5B9A\u00B7\u91D1\u699C\u5C06\u5F20');
  renderKejuStage();
}

/** 判定钦定与考官意见的分歧 */
function _kejuJudgeRankingControversy(exam) {
  var sugs = exam.examinerSuggestions || {};
  var playerTop3 = [exam.finalRanking.zhuangyuan, exam.finalRanking.bangyan, exam.finalRanking.tanhua];
  var agreementCount = 0;
  var disagreeExaminers = [];
  Object.keys(sugs).forEach(function(k){
    if (k === '\u793C\u90E8\u7EFC\u5408') return;
    var list = sugs[k] || [];
    var top3 = list.slice(0,3).map(function(s){return s.name;});
    // 状元一致算高分·前 3 名集合一致算中分
    var agree = playerTop3.filter(function(n){ return top3.indexOf(n) >= 0; }).length;
    if (agree === 3) agreementCount++;
    else if (agree <= 1) {
      // 提取考官名（去掉括号部分）
      var nm = k.replace(/\(.*?\)/g, '').trim();
      disagreeExaminers.push(nm);
    }
  });
  // 超半数考官反对 → 党争扰动
  var totalEx = Object.keys(sugs).length - 1; // 扣除礼部综合
  if (totalEx > 0 && disagreeExaminers.length >= Math.ceil(totalEx / 2)) {
    disagreeExaminers.forEach(function(nm){
      if (typeof AffinityMap !== 'undefined' && AffinityMap.add) {
        AffinityMap.add(nm, (P.playerInfo && P.playerInfo.characterName) || '\u9661\u4E0B', -15, '\u6BBE\u8BD5\u94A6\u5B9A\u8FDD\u80CC\u5176\u610F');
      }
    });
    _adjustHuangwei(-3, '\u72EC\u65AD\u94A6\u5B9A\u00B7\u8003\u5B98\u8865\u3D02');
    if (typeof addEB === 'function') addEB('\u79D1\u4E3E', '\u94A6\u5B9A\u8FDD\u591A\u6570\u8003\u5B98\u610F\u89C1\u00B7' + disagreeExaminers.slice(0,3).join('\u3001') + ' \u597D\u611F-15');
  }
}

// 暴露到 window
if (typeof window !== 'undefined') {
  window._qinDianPick = _qinDianPick;
  window.confirmFinalRanking = confirmFinalRanking;
}
// ═══════════════════════════════════════════════════════════════════════
//  【立项拆分 2026-07-04】〔科议〕专属朝议+守恒上行流(原§1770-末) → tm-keju-runtime-keyi.js
//  （载于本文件之后）·保序切割·全局名跨文件解析
// ═══════════════════════════════════════════════════════════════════════
