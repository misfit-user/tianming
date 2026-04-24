// ============================================================
// tm-keju-runtime.js — 科举考试运行时 (R125 从 tm-chaoyi.js L2782-end 拆出)
// 历史：此部分原在 tm-audio-theme.js·后迁入 tm-chaoyi-keju.js·R112 拆时错误留在 chaoyi 侧
// 姊妹：tm-keju.js (UI/启动) + tm-chaoyi.js (朝议)
// 包含：initKejuSystem/advanceKejuByDays/阶段切换/考官/20 答卷 AI 生成等
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

  if (!P.ai.key) {
    P.keju.enabled = isKejuEra(era);
    if (P.keju.enabled) {
      P.keju.examIntervalNote = '\u672C\u671D\u4E09\u5E74\u4E00\u79D1';
      P.keju.tiers = _getDefaultTiers(era);
    }
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

    P.keju.enabled = data.enabled || false;
    P.keju.examIntervalNote = data.intervalNote || '';
    P.keju.alternativeSystem = data.alternativeSystem || '';
    if (data.tiers && Array.isArray(data.tiers)) P.keju.tiers = data.tiers;
    else P.keju.tiers = _getDefaultTiers(era);
    if (data.subjects && !P.keju.examSubjects) P.keju.examSubjects = data.subjects;
    if (data.features && !P.keju.specialRules) P.keju.specialRules = data.features;

    _dbg('[\u79D1\u4E3E\u5236\u5EA6] \u521D\u59CB\u5316:', data.enabled ? '\u5DF2\u542F\u7528' : '\u672A\u542F\u7528', data.reason);
    if (data.enabled) toast('\uD83D\uDCDC \u79D1\u4E3E\u5236\u5EA6\u5DF2\u542F\u7528\uFF1A' + data.intervalNote + ' ' + (P.keju.tiers.length) + '\u5C42\u8003\u8BD5');
  } catch(e) {
    console.error('[\u79D1\u4E3E] \u521D\u59CB\u5316\u5931\u8D25:', e);
    P.keju.enabled = isKejuEra(era);
    P.keju.tiers = _getDefaultTiers(era);
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

    var result = await callAISmart(prompt, 300, {maxRetries: 1});
    var data = JSON.parse(result.replace(/```json|```/g, '').trim());

    if (data.shouldTrigger) {
      _dbg('[科举制度] 触发科举考试:', data.reason);
      startKejuExam();
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
  var _dpt2 = (P.time && P.time.daysPerTurn) || 30;
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
  }
}

/** 辅助·调整皇威（若引擎可用） */
function _adjustHuangwei(delta, reason) {
  try {
    if (GM.huangwei && typeof GM.huangwei === 'object') {
      GM.huangwei.value = Math.max(0, Math.min(100, (GM.huangwei.value || 50) + delta));
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
    return c.alive !== false && !c.isPlayer && (c.intelligence||0) >= 60;
  }).sort(function(a,b) { return (b.intelligence||0) - (a.intelligence||0); }).slice(0, 12);
  candidates.forEach(function(c) {
    var partyTag = c.party && c.party !== '\u65E0\u515A\u6D3E' ? ' <span style="font-size:0.7rem;color:var(--purple,#8a5cf5);">\u515A:' + c.party + '</span>' : '';
    var recTag = '';
    Object.entries(_partyRecs).forEach(function(e){ if(e[1]===c.name) recTag=' <span style="font-size:0.65rem;background:var(--purple,#8a5cf5);color:#fff;padding:0 3px;border-radius:2px;">'+e[0]+'\u63A8\u8350</span>'; });
    html += '<div style="display:flex;align-items:center;gap:0.5rem;padding:0.4rem 0.6rem;margin-bottom:0.3rem;background:var(--bg-3);border-radius:4px;cursor:pointer;" onclick="selectExaminer(\'' + escHtml(c.name).replace(/'/g,"\\'") + '\')">';
    html += '<strong style="flex:1;">' + escHtml(c.name) + recTag + '</strong>';
    html += '<span style="font-size:0.8rem;color:var(--txt-d);">' + (c.title||'') + ' \u667A' + (c.intelligence||0) + ' \u6CBB' + (c.administration||0) + partyTag + '</span>';
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
      (ch.title||'') + ' \u667A\u8C0B' + (ch.intelligence||0) + ' \u6CBB\u653F' + (ch.administration||0) +
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
  // 考官出题
  html += '<div style="background:linear-gradient(135deg,var(--bg-2),rgba(138,109,27,0.04));padding:1rem;border-radius:8px;border:1px solid var(--gold-d);margin-bottom:1rem;">';
  html += '<h4 style="color:var(--gold);margin-bottom:0.5rem;">\uD83D\uDCDC ' + escHtml(tierName) + '\u8BD5\u9898</h4>';
  html += '<p style="color:var(--txt-d);font-size:0.82rem;margin-bottom:0.5rem;">\u4E3B\u8003\u5B98\u62DF\u9898\u5448\u62A5\u5FA1\u89C8\u3002\u966D\u4E0B\u53EF\u4FEE\u6539\u6216\u53E6\u62DF\uFF0C\u4EA6\u53EF\u51C6\u5949\u3002</p>';
  html += '<textarea id="huishi-topic" rows="4" style="width:100%;padding:0.6rem;background:var(--bg-1);border:1px solid var(--bdr);border-radius:4px;color:var(--txt);font-family:inherit;line-height:1.7;font-size:0.92rem;" placeholder="\u8BF7\u7B49\u5F85\u8003\u5B98\u62DF\u9898\uFF0C\u6216\u76F4\u63A5\u8F93\u5165...">' + escHtml(exam && exam.huishiTopic ? exam.huishiTopic : '') + '</textarea>';
  html += '<div style="display:flex;gap:0.5rem;margin-top:0.5rem;">';
  html += '<button class="bt bp" onclick="examinerProposeTopic()" style="flex:1;">\uD83D\uDC68\u200D\u2696\uFE0F \u8003\u5B98\u62DF\u9898\u5448\u62A5</button>';
  html += '<button class="bt bs" onclick="document.getElementById(\'huishi-topic\').value=\'\'" style="flex:0.5;">\u6E05\u7A7A</button>';
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
    exam.stage = 'dianshi';

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
  var stats = exam.statistics;
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
    '<textarea id="dianshi-question" rows="6" style="width:100%;padding:0.8rem;background:var(--bg-1);border:1px solid var(--bdr);border-radius:4px;color:var(--txt);font-family:inherit;resize:vertical;line-height:1.8;font-size:0.95rem;" placeholder="\u4F8B\uFF1A\u671D\u5EF7\u79EF\u5F0A\u65E5\u6DF1\uFF0C\u5916\u60A3\u672A\u5DF2\u3002\u6614\u7BA1\u4EF2\u76F8\u9F50\uFF0C\u5C0A\u738B\u653D\u5937\uFF0C\u4E5D\u5408\u8BF8\u4FAF...\u4F55\u4EE5\u6559\u8054\uFF1F">' + escHtml(exam.playerQuestion || '') + '</textarea>' +
    '<div style="display:flex;gap:0.5rem;margin-top:0.6rem;">' +
    '<button class="bt bp" onclick="generateDianshiQuestion()" style="flex:1;">\uD83E\uDD16 AI\u4EE3\u62DF\u7B56\u95EE</button>' +
    '<button class="bt bp" onclick="startDianshi()" style="flex:1;background:var(--gold-d);font-weight:700;">\uD83D\uDCDC \u5F00\u59CB\u6BBE\u8BD5</button>' +
    '</div>' +
    '</div>' +
    '</div>';
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
    document.getElementById('dianshi-question').value = question;
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
  var question = document.getElementById('dianshi-question').value.trim();

  if (!question) {
    toast('请先输入殿试题目');
    return;
  }

  exam.playerQuestion = question;
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
      exam.stage = 'finished';
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

  var _ctxHeader =
    '\u3010\u786C\u89C4\u5219\u3011\u8003\u751F\u5FC5\u987B\u662F\u5E03\u8863/\u76D1\u751F/\u4E3E\u4EBA/\u672A\u51FA\u4ED5\u7684\u4E66\u751F\u00B7\u7EDD\u4E0D\u53EF\u4E3A\u5DF2\u4EFB\u5B98\u8005\u3002\n'
    + (_officialNames.length ? '\u3010\u7981\u6B62\u59D3\u540D\u3011' + _officialNames.slice(0, 60).join('\u3001') + (_officialNames.length>60?'\u7B49':'') + '\n' : '')
    + '\u3010\u6BBE\u8BD5\u9898\u76EE\u3011' + (exam.playerQuestion || '(\u7A7A)') + '\n'
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
  try { await _kejuGenExaminerSuggestions(exam); } catch(e) { console.warn('[F4] 考官建议失败', e); }
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
    } catch(e) { console.warn('[F4] 考官 ' + ex.name + ' 意见失败', e); }
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

// ══════════════════════════════════════════════════════════════════
// v5·〔科议〕科举专属朝议·参照廷议·全体在京文官参议
// ══════════════════════════════════════════════════════════════════

var KEYI_STATE = null;  // { attendees, speakers, round, phase:'discuss'|'vote'|'decide', speeches, stances, support, abort }

/** 入口：打开科议（v2·自动邀请·无选人页） */
function openKeyiSession() {
  if (!GM.keju) GM.keju = {};
  if (!GM.keju._pendingProposal) GM.keju._pendingProposal = { topic:'筹办科举', proposedTurn: GM.turn, resolved:false };

  // 筛全体在京官员（像常朝那样·含文武·排除后妃/太后/公主/太监·玩家除外）
  var attendees = (GM.chars || []).filter(function(c){
    if (!c || c.alive === false || c.isPlayer) return false;
    if (!_isAtCapital(c)) return false;
    // 排除后妃·嫔·贵人·太后·太妃·公主/郡主
    if (c.spouse) return false;
    var role = c.role || '';
    if (/\u540E|\u5983|\u5AD4|\u8D35\u4EBA|\u592A\u540E|\u592A\u5983|\u516C\u4E3B|\u90E1\u4E3B|\u592A\u76D1|\u5B66\u751F/.test(role)) return false;
    var t = (c.officialTitle || c.title || '');
    if (/\u7687\u540E|\u8D35\u5983|\u8D24\u5983|\u6DD1\u5983|\u5BB8\u5983|\u5AAC\u5983|\u5BB9\u534E|\u5145\u4EAA|\u592A\u540E|\u592A\u5983|\u516C\u4E3B|\u90E1\u4E3B|\u592A\u76D1/.test(t)) return false;
    return true;
  });
  if (attendees.length < 3) { toast('\u4EAC\u4E2D\u5B98\u5458\u4E0D\u8DB3\u4E09\u4EBA\u00B7\u65E0\u6CD5\u5F00\u79D1\u8BAE'); return; }

  // 弹确认窗·不再挑人
  if (!confirm('\u5F00\u79D1\u8BAE\uFF1F\n\u5C06\u53EC\u96C6 ' + attendees.length + ' \u540D\u5728\u4EAC\u5B98\u5458\u8BAE\u7B79\u529E\u79D1\u4E3E\u00B7\u8017\u7CBE\u529B 15\u3002')) return;
  if (typeof _spendEnergy === 'function' && !_spendEnergy(15, '\u79D1\u8BAE')) { toast('\u7CBE\u529B\u4E0D\u8DB3'); return; }

  KEYI_STATE = {
    attendees: attendees.map(function(c){ return { name: c.name, title: c.officialTitle || c.title || '', party: c.party || '', loyalty: c.loyalty || 50, _ch: c }; }),
    speakers: [],
    round: 0,
    totalRounds: 2,
    phase: 'discuss',  // discuss → vote → decide
    speeches: [],
    stances: {},
    support: 0,
    abort: false,
    _discussDone: false,
    playerStance: null,
    playerSpeeches: []
  };

  // 挑发言人（v4·立场均衡）：礼部尚书 + 支持/反对/观望各至少 1 人 + 高智填充
  // 先预推每人立场
  KEYI_STATE.attendees.forEach(function(a){ a._prevStance = _keyiInferStance(a); });
  var libuIdx = KEYI_STATE.attendees.findIndex(function(a){ return (a.title||'').indexOf('\u793C\u90E8\u5C1A\u4E66')>=0; });
  var speakers = [];
  var picked = {};
  if (libuIdx >= 0) { speakers.push(KEYI_STATE.attendees[libuIdx]); picked[KEYI_STATE.attendees[libuIdx].name] = true; }

  function _scoreOf(a){ return ((a._ch && a._ch.intelligence)||0) + (a.loyalty||0)/2 + (a._ch && a._ch.ambition||0)/3; }
  function _pickBestByStance(stance, max){
    var cands = KEYI_STATE.attendees
      .filter(function(a){ return !picked[a.name] && a._prevStance === stance; })
      .sort(function(x,y){ return _scoreOf(y) - _scoreOf(x); });
    var n = 0;
    for (var i=0; i<cands.length && n<max; i++) { speakers.push(cands[i]); picked[cands[i].name] = true; n++; }
  }
  // 每种立场至少 1 人·反对至多 2 人·支持至多 2 人·观望 1 人
  _pickBestByStance('oppose', 2);
  _pickBestByStance('support', 2);
  _pickBestByStance('abstain', 1);
  // 不足 6 人·按综合分补齐
  var remain = KEYI_STATE.attendees
    .filter(function(a){ return !picked[a.name]; })
    .sort(function(x,y){ return _scoreOf(y) - _scoreOf(x); });
  for (var k=0; k<remain.length && speakers.length<6; k++) { speakers.push(remain[k]); picked[remain[k].name] = true; }
  KEYI_STATE.speakers = speakers.slice(0, 6);
  KEYI_STATE.round = 1;

  _renderKeyiModal();
  // v3·立刻自动跑两轮流式讨论
  _keyiRunBothRounds();
}

/** 创建 modal 容器 */
function _renderKeyiModal() {
  var existing = document.getElementById('keyi-modal'); if (existing) existing.remove();
  var modal = document.createElement('div');
  modal.className = 'modal-bg show';
  modal.id = 'keyi-modal';
  modal.innerHTML =
    '<div style="background:var(--bg-1);border:1px solid var(--gold-d);border-radius:12px;width:90%;max-width:880px;max-height:86vh;display:flex;flex-direction:column;overflow:hidden;">'+
      '<div style="padding:0.7rem 1.2rem;border-bottom:1px solid var(--bdr);display:flex;justify-content:space-between;align-items:center;">'+
        '<div style="font-size:1.05rem;font-weight:700;color:var(--gold);letter-spacing:0.08em;">\u3014 \u79D1 \u8BAE \u3015\u00B7\u7B79\u529E\u79D1\u4E3E\u516C\u8BAE</div>'+
        '<button class="bt bs bsm" onclick="closeKeyi()">\u2715</button>'+
      '</div>'+
      '<div id="keyi-body" style="flex:1;overflow-y:auto;padding:1rem 1.2rem;"></div>'+
      '<div id="keyi-footer" style="padding:0.6rem 1rem;border-top:1px solid var(--bdr);"></div>'+
    '</div>';
  document.body.appendChild(modal);
  _keyiRender();
}

/** 根据 phase 分派渲染 */
function _keyiRender() {
  var body = _$('keyi-body'); var footer = _$('keyi-footer');
  if (!body) return;
  if (!KEYI_STATE) return;
  if (KEYI_STATE.phase === 'discuss') _keyiRenderDiscuss(body, footer);
  else if (KEYI_STATE.phase === 'vote') _keyiRenderVote(body, footer);
  else if (KEYI_STATE.phase === 'decide') _keyiRenderDecide(body, footer);
}

/** 发言阶段 UI（v4·初始2轮自动·后续可再议无上限·玩家插言影响倾向） */
function _keyiRenderDiscuss(body, footer) {
  var statusTxt = KEYI_STATE._busy
    ? (KEYI_STATE._busyText || '\u8BAE\u8BBA\u4E2D\u2026')
    : (KEYI_STATE._discussDone ? '\u5DF2\u7ECF\u8FC7 ' + KEYI_STATE.round + ' \u8F6E\u8BAE\u8BBA\u00B7\u53EF\u4ED8\u8868\u51B3\u6216\u518D\u8BAE' : '\u8BAE\u8BBA\u8FDB\u884C\u4E2D\u2026');
  var html = '<div style="margin-bottom:0.6rem;">'+
    '<div style="font-weight:700;color:var(--gold);">\u7B2C ' + KEYI_STATE.round + ' \u8F6E\u8BAE\u8BBA</div>'+
    '<div style="font-size:0.72rem;color:var(--txt-d);">\u00B7 ' + KEYI_STATE.speakers.length + ' \u4EBA\u4E0A\u53F0\u9648\u8BCD\u00B7' + KEYI_STATE.attendees.length + ' \u4EBA\u5728\u573A\u8BAE\u4E8B\u00B7' + statusTxt + '</div>'+
    '</div><div id="keyi-chat" style="min-height:220px;">';
  KEYI_STATE.speeches.forEach(function(sp){
    html += _keyiBubbleHtml(sp);
  });
  html += '</div>';
  body.innerHTML = html;

  // v4·始终显示玩家发言框·可多轮辩论·玩家插言即影响后续立场
  var isBusy = !!KEYI_STATE._busy;
  var hint = isBusy
    ? '\u9661\u4E0B\u5982\u6709\u5723\u8C15\u00B7\u8F93\u5165\u540E\u4F17\u81E3\u5373\u9000\u4E0B\u8FD4\u5E94\u2026'
    : '\u9661\u4E0B\u53EF\u968F\u65F6\u63D2\u8A00\u00B7\u5723\u8C15\u4F1A\u5F71\u54CD\u5927\u81E3\u7ACB\u573A\u4E0E\u6700\u7EC8\u8868\u51B3';
  var footerHtml = ''
    + '<div style="display:flex;gap:0.4rem;align-items:stretch;">'
    +   '<textarea id="keyi-player-input" rows="2" placeholder="' + hint + '" style="flex:1;background:var(--bg-2);border:1px solid var(--bdr);border-radius:4px;padding:0.4rem 0.6rem;font-size:0.82rem;color:var(--color-foreground);resize:vertical;"></textarea>'
    +   '<button class="bt bp" style="min-width:72px;" onclick="_keyiPlayerSpeak()">\u5723\u8C15</button>'
    + '</div>';
  if (KEYI_STATE._discussDone && !isBusy) {
    footerHtml += '<div style="display:flex;gap:0.5rem;justify-content:center;margin-top:0.5rem;">'
      + '<button class="bt" onclick="_keyiExtraRound()">\u518D\u8BAE\u4E00\u8F6E</button>'
      + '<button class="bt bp" onclick="_keyiProceedToVote()">\u4ED8\u8868\u51B3</button>'
      + '</div>';
  }
  footer.innerHTML = footerHtml;
  var chat = _$('keyi-chat'); if (chat) chat.scrollTop = chat.scrollHeight;
}

/** 手动再议一轮（v4·无上限·类似廷议） */
async function _keyiExtraRound() {
  if (!KEYI_STATE || KEYI_STATE._busy) return;
  KEYI_STATE.round++;
  KEYI_STATE._discussDone = false;
  _keyiRender();
  await _keyiStreamRound();
  KEYI_STATE._discussDone = true;
  _keyiRender();
}

/** 从玩家圣谕文本推断立场 */
function _keyiInferPlayerStance(text) {
  if (!text) return null;
  var s = text.toLowerCase();
  // 反对类词
  if (/\u4E0D\u53EF|\u4E0D\u8A56|\u4E0D\u7528|\u6682\u7F13|\u505C|\u7F72|\u5EA2|\u4E0D\u7406|\u7F13\u884C|\u4E0D\u8FEB|\u6263\u627F|\u672A\u5FC5|\u6682\u4E0D|\u6697\u6697|\u4E0D\u59A5|\u4E0D\u5B9C/.test(s)) return 'oppose';
  // 支持类词
  if (/\u7740|\u5373\u884C|\u901F|\u4EC7|\u7545|\u5F00|\u8BB8|\u51C6|\u4F9D\u8BAE|\u8D5E|\u540C|\u53EF|\u610F|\u884C|\u8881|\u5F00\u79D1|\u4E3E\u529E|\u601D|\u771F\u597D|\u5584/.test(s)) return 'support';
  return 'abstain'; // 不明显
}

/** 玩家插言·打断当前轮·下一轮 NPC 回应陛下·立场会向陛下靠拢（v4） */
async function _keyiPlayerSpeak() {
  if (!KEYI_STATE) return;
  var inp = _$('keyi-player-input');
  var text = inp && inp.value ? inp.value.trim() : '';
  if (!text) { toast('\u8BF7\u5148\u8F93\u5165\u5723\u8C15'); return; }
  // 推断陛下立场·存入 state·影响后续发言+表决
  var playerStance = _keyiInferPlayerStance(text) || 'support';
  KEYI_STATE.playerStance = playerStance;
  if (!Array.isArray(KEYI_STATE.playerSpeeches)) KEYI_STATE.playerSpeeches = [];
  KEYI_STATE.playerSpeeches.push({ text: text, stance: playerStance, round: KEYI_STATE.round });
  // 打断当前轮
  KEYI_STATE.abort = true;
  KEYI_STATE._interrupted = true;
  // 清掉正在流式的占位气泡（没写完的）
  KEYI_STATE.speeches = KEYI_STATE.speeches.filter(function(sp){ return !sp._streaming; });
  // 推入玩家气泡·立场按推断
  KEYI_STATE.speeches.push({
    name: '\u9661\u4E0B',
    title: '\u5723\u8C15',
    stance: playerStance,
    line: text,
    _isPlayer: true
  });
  if (inp) inp.value = '';
  KEYI_STATE._discussDone = false;
  // 等当前 busy 循环真正退出
  var waitCount = 0;
  while (KEYI_STATE._busy && waitCount < 30) {
    await new Promise(function(r){ setTimeout(r, 100); });
    waitCount++;
  }
  KEYI_STATE.abort = false;
  KEYI_STATE._interrupted = false;
  // 仅跑一轮·让 NPC 回应陛下·玩家可再插言或付表决
  KEYI_STATE.round++;
  _keyiRender();
  await _keyiStreamRound();
  KEYI_STATE._discussDone = true;
  _keyiRender();
}

/** 连续跑两轮·中间无需玩家按键（v3） */
async function _keyiRunBothRounds() {
  if (!KEYI_STATE) return;
  var rounds = KEYI_STATE.totalRounds || 2;
  while (KEYI_STATE.round <= rounds) {
    await _keyiStreamRound();
    if (KEYI_STATE.abort) return; // 被玩家打断
    if (KEYI_STATE.round < rounds) {
      KEYI_STATE.round++;
    } else {
      break;
    }
  }
  KEYI_STATE._discussDone = true;
  _keyiRender();
}

/** 发言气泡 HTML */
function _keyiBubbleHtml(sp) {
  var stance = sp.stance || 'abstain';
  var typeColor = stance==='support' ? 'var(--celadon-400)' : stance==='oppose' ? 'var(--vermillion-400)' : 'var(--ink-300)';
  var typeLbl = stance==='support' ? '\u8D5E\u6210' : stance==='oppose' ? '\u53CD\u5BF9' : '\u89C2\u671B';
  if (sp._isPlayer) {
    return '<div style="background:linear-gradient(135deg,rgba(184,154,83,0.18),rgba(184,154,83,0.05));border:1px solid var(--gold-d);border-radius:10px 3px 10px 10px;padding:0.5rem 0.8rem;margin:6px 0 6px 40px;box-shadow:0 1px 3px rgba(184,154,83,0.25);">'+
      '<div style="font-size:0.72rem;color:var(--gold);"><strong>\u9661\u4E0B</strong> <span style="color:var(--txt-d);">\u00B7 \u5723\u8C15</span></div>'+
      '<div style="font-size:0.82rem;line-height:1.7;margin-top:3px;color:var(--color-foreground);">' + escHtml(sp.line || '') + '</div>'+
      '</div>';
  }
  return '<div style="background:var(--bg-3);border:1px solid var(--bdr);border-radius:3px 10px 10px 10px;padding:0.5rem 0.8rem;margin-bottom:6px;"' + (sp._streamId ? ' id="'+sp._streamId+'"' : '') + '>'+
    '<div style="font-size:0.72rem;color:var(--gold);"><strong>' + escHtml(sp.name) + '</strong>' +
    ' <span style="color:var(--txt-d);">\u00B7 ' + escHtml(sp.title||'') + '</span>' +
    (sp._streaming ? '' : ' <span style="color:'+typeColor+';">\u3014'+typeLbl+'\u3015</span>') + '</div>'+
    '<div class="keyi-bubble-text" style="font-size:0.82rem;line-height:1.7;margin-top:3px;color:var(--color-foreground);">' + escHtml(sp.line || '\u2026') + '</div>'+
    '</div>';
}

/** 流式跑一轮发言（v2·逐人流式·对齐廷议） */
async function _keyiStreamRound() {
  if (!KEYI_STATE) return;
  if (!P.ai || !P.ai.key) {
    // 无 AI·按算式模拟立场
    KEYI_STATE.speakers.forEach(function(s){
      var pro = _keyiInferStance(s);
      KEYI_STATE.speeches.push({ name: s.name, title: s.title, stance: pro, line: '(\u672A\u914D AI\u00B7\u6309\u7B97\u5F0F\u7ACB\u573A)' });
    });
    _keyiRender();
    return;
  }
  KEYI_STATE._busy = true;
  _keyiRender();
  var era = (P.dynasty || P.era || '');
  var year = GM.year || (P.time && P.time.year) || 1600;
  var guoku = Math.round(((GM.guoku && GM.guoku.money) || 0) / 10000);
  var wars = (GM.activeWars||[]).length;
  var lastExam = P.keju.lastExamDate ? (P.keju.lastExamDate.year + '\u5E74') : '\u4ECE\u672A\u4E3E\u529E';
  var ctxBase = '\u3010\u79D1\u8BAE\u80CC\u666F\u3011' + era + year + '\u5E74\u00B7\u5F00\u79D1\u4E3E\u8BAE\u00B7\u5E11\u5EAA ' + guoku + ' \u4E07\u00B7\u6218\u4E8B ' + wars + ' \u5904\u00B7\u4E0A\u79D1 ' + lastExam + '\u3002';

  for (var i=0; i<KEYI_STATE.speakers.length; i++) {
    if (KEYI_STATE.abort) break;
    var s = KEYI_STATE.speakers[i];
    var ch = s._ch || findCharByName(s.name);
    KEYI_STATE._busyText = s.name + ' \u5EAD\u524D\u9648\u8A00\u00B7\u7B2C ' + KEYI_STATE.round + ' \u8F6E';

    // 先 push 占位 speech
    var streamId = 'keyi-stream-' + Date.now() + '-' + i;
    var placeholder = { name: s.name, title: s.title, stance: 'abstain', line: '\u2026', _streamId: streamId, _streaming: true };
    KEYI_STATE.speeches.push(placeholder);
    _keyiRender();

    var prev = KEYI_STATE.speeches.slice(-8, -1).map(function(x){
      var who = x._isPlayer ? '\u9661\u4E0B(\u5723\u8C15)' : x.name;
      return who + '[' + (x.stance||'') + ']\uFF1A' + (x.line||'').slice(0,60);
    }).join('\n');
    var hasPlayerRecent = KEYI_STATE.speeches.slice(-6).some(function(x){ return x._isPlayer; });
    var prompt = ctxBase + '\n' +
      '\u4F60\u662F\u4E0A\u671D\u5EAD\u8BAE\u7684\u5927\u81E3 ' + s.name + '\uFF08' + (s.title||'') + '\uFF09\u3002\n' +
      '\u6027\u683C\uFF1A' + ((ch&&ch.personality)||'').slice(0,30) + '\n' +
      '\u5FE0\u8BDA ' + (s.loyalty||50) + '\u3001\u515A\u6D3E ' + (s.party||'\u65E0\u515A') + '\u3001\u8EAB\u4EFD ' + (ch && ch.class || '') + '\n' +
      (prev ? '\u5DF2\u53D1\u8A00\uFF1A\n' + prev + '\n' : '') +
      (hasPlayerRecent ? '\u2605 \u9661\u4E0B\u521A\u521A\u9F99\u97F3\u5F00\u53E3\u00B7\u4F60\u5FC5\u987B\u606D\u656C\u56DE\u5E94\u5723\u8C15\u00B7\u53EF\u5927\u7EB2\u987A\u5723\u610F\u4E5F\u53EF\u59D4\u5A49\u9648\u8BF4\u96BE\u5904\uFF08\u4F46\u9700\u4FDD\u6301\u81EA\u5DF1\u672C\u6765\u7684\u515A\u6D3E\u7ACB\u573A\uFF09\u3002\n' : '') +
      '\u8BF7\u5C31\u300C\u5F00\u79D1\u4E3E\u300D\u7ACB\u573A\u53D1\u8868 80-160 \u5B57\u534A\u6587\u8A00\u5EAD\u8BAE\u3002\n' +
      '\u683C\u5F0F\uFF1A\u7B2C\u4E00\u884C\u4EC5\u8F93\u51FA\u7ACB\u573A\u6807\u8BB0 support\u3001oppose \u6216 abstain \u4E09\u8BCD\u4E4B\u4E00\u3002\u4ECE\u7B2C\u4E8C\u884C\u8D77\u8F93\u51FA\u53D1\u8A00\u6B63\u6587\u3002';

    var tokens = 800;
    var bubble = _$(streamId); var txt = bubble ? bubble.querySelector('.keyi-bubble-text') : null;
    var full = '';
    try {
      if (typeof callAIMessagesStream === 'function') {
        full = await callAIMessagesStream(
          [{ role: 'user', content: prompt }], tokens,
          {
            onChunk: function(t){
              if (!txt) return;
              // 解析第一行 stance
              var lines = (t||'').split(/\r?\n/);
              var firstLine = (lines[0]||'').trim().toLowerCase();
              var body = lines.slice(1).join('\n').trim() || t;
              txt.textContent = body;
              var chat = _$('keyi-chat'); if (chat) chat.scrollTop = chat.scrollHeight;
            }
          }
        );
      } else {
        full = await callAISmart(prompt, tokens, { maxRetries: 1 });
      }
    } catch(e) {
      console.warn('[\u79D1\u8BAE\u6D41\u5F0F] \u53D1\u8A00\u5931\u8D25', s.name, e);
      full = '';
    }

    // 解析最终
    var _lines = (full || '').split(/\r?\n/);
    var _firstRaw = (_lines[0]||'').trim().toLowerCase().replace(/[^a-z]/g, '');
    var _stance = 'abstain';
    if (/support|\u8D5E|\u540C/.test(_firstRaw) || _firstRaw === 'support') _stance = 'support';
    else if (/oppose|\u53CD|\u4E0D/.test(_firstRaw) || _firstRaw === 'oppose') _stance = 'oppose';
    else if (/abstain|\u89C2/.test(_firstRaw) || _firstRaw === 'abstain') _stance = 'abstain';
    var _body = _lines.slice(1).join('\n').trim();
    if (!_body) _body = full || '\uFF08\u6C89\u9ED8\uFF09';

    // 更新占位 speech
    placeholder.stance = _stance;
    placeholder.line = _body;
    placeholder._streaming = false;
    delete placeholder._streamId;
    _keyiRender();
  }

  KEYI_STATE._busy = false;
  KEYI_STATE._busyText = '';
  _keyiRender();
}

/** 再议一轮（v2·流式） */
async function _keyiNextRound() {
  if (!KEYI_STATE || KEYI_STATE._busy) return;
  if (KEYI_STATE.round >= 2) { toast('\u5DF2\u8BAE\u4E24\u8F6E'); return; }
  KEYI_STATE.round++;
  await _keyiStreamRound();
}

/** 算式推断立场（无 AI 时·或 AI 失败时兜底·陛下圣谕会拉偏忠臣） */
function _keyiInferStance(a) {
  var ch = a._ch || findCharByName(a.name);
  var loy = a.loyalty || 50;
  var pro = (loy - 50) * 0.5;
  if (ch) {
    if (ch.class === '\u58EB\u65CF') pro += 15;
    if (ch.class === '\u5BD2\u95E8') pro += 10;
    if (/\u6587|\u5112|\u5B66|\u6E05\u6D41/.test((ch.personality||'') + (ch.officialTitle||'') + (ch.title||''))) pro += 10;
  }
  // 礼部/吏部/国子监·天然支持
  if (/\u793C\u90E8|\u56FD\u5B50\u76D1|\u5B66\u653F/.test(a.title||'')) pro += 20;
  // 武将/军头 → 观望（非反对）
  if (/\u5C06\u519B|\u603B\u5175|\u6307\u6325|\u603B\u7763/.test(a.title||'')) pro -= 5;
  // 帑廪空 → 反对（要花钱）
  var guoku = (GM.guoku && GM.guoku.money) || 0;
  if (guoku < 100000) pro -= 12;
  // 战事多 → 反对（资源倾斜）
  if ((GM.activeWars||[]).length >= 3) pro -= 8;
  // 陛下圣谕拉拽·按忠诚加权（忠臣跟得紧·佞臣随风倒·权臣可能逆天）
  if (KEYI_STATE && KEYI_STATE.playerStance) {
    var dir = KEYI_STATE.playerStance === 'support' ? 1 : KEYI_STATE.playerStance === 'oppose' ? -1 : 0;
    if (dir !== 0) {
      var pullStrength = (loy - 30) * 0.7; // 忠30以上被拉·以下反拉
      if (ch && ch.ambition > 70 && loy < 50) pullStrength *= -0.5; // 权臣/野心家可能逆圣意
      pro += dir * pullStrength;
    }
  }
  // 随机扰动
  pro += (Math.random() - 0.5) * 10;
  if (pro > 12) return 'support';
  if (pro < -12) return 'oppose';
  return 'abstain';
}

/** 进入表决（v3·显式进度条·完成后停留在 vote 页·等用户点继续进 decide） */
async function _keyiProceedToVote() {
  if (!KEYI_STATE) return;
  KEYI_STATE.phase = 'vote';
  KEYI_STATE._voteDone = false;
  KEYI_STATE._voteProgress = 0;
  _keyiRender();
  // 视觉进度条·异步推进到 90%·AI 返回后归 100%
  var progTicker = setInterval(function(){
    if (!KEYI_STATE) { clearInterval(progTicker); return; }
    if (KEYI_STATE._voteProgress < 90) {
      KEYI_STATE._voteProgress = Math.min(90, (KEYI_STATE._voteProgress||0) + 4 + Math.random()*5);
      _keyiRender();
    }
  }, 260);
  try {
    await _keyiGenAllStances();
  } catch(e) {
    console.warn('[\u79D1\u8BAE] \u8868\u51B3 AI \u5931\u8D25', e);
  }
  clearInterval(progTicker);
  KEYI_STATE._voteProgress = 100;
  KEYI_STATE._voteDone = true;
  _keyiRender();
}

/** AI 一次性生成所有参议大臣的立场 */
async function _keyiGenAllStances() {
  // v7·单向不变量：讨论中出现过的立场集合·才能作为最终表决立场
  //   · 若讨论无反对 → AI 就算想给某人 oppose 也降级为 abstain
  //   · AI 精修仍执行（给未发言者细腻立场 + 理由）
  if (!KEYI_STATE) return;
  KEYI_STATE.stances = {};

  // Step 1: 收集 speeches 里的立场集合
  var speechStanceMap = {};
  var seenStances = {};
  KEYI_STATE.speeches.forEach(function(sp){
    if (sp._isPlayer) return;
    if (!sp.name) return;
    speechStanceMap[sp.name] = sp.stance || 'abstain';
    seenStances[sp.stance || 'abstain'] = true;
  });
  if (Object.keys(seenStances).length === 0) seenStances['abstain'] = true;

  // Step 2: 算式预置每人立场（供 AI 失败时兜底）
  KEYI_STATE.attendees.forEach(function(a){
    if (speechStanceMap[a.name]) {
      KEYI_STATE.stances[a.name] = { stance: speechStanceMap[a.name], reason: '\u5EAD\u8BAE\u6240\u8A00' };
    } else {
      KEYI_STATE.stances[a.name] = { stance: _keyiInferStance(a), reason: '' };
    }
  });

  // Step 3: AI 精修（保留原设计——让 AI 给未发言者细腻立场）
  if (P.ai && P.ai.key) {
    KEYI_STATE._busy = true;
    KEYI_STATE._busyText = '\u767E\u5B98\u8868\u51B3\u4E2D';
    _keyiRender();
    var ctx = '\u79D1\u8BAE\u5DF2\u5386 ' + KEYI_STATE.round + ' \u8F6E\u00B7\u4E3B\u8981\u53D1\u8A00\uFF1A\n' +
      KEYI_STATE.speeches.slice(-12).map(function(sp){
        var who = sp._isPlayer ? '\u9661\u4E0B(\u5723\u8C15)' : sp.name;
        return who + '[' + sp.stance + ']\uFF1A' + (sp.line||'').slice(0, 60);
      }).join('\n') + '\n\n';
    // 约束给 AI 知晓
    var _stanceKeys = Object.keys(seenStances);
    var _stanceStr = _stanceKeys.map(function(s){
      return s === 'support' ? '\u652F\u6301' : s === 'oppose' ? '\u53CD\u5BF9' : '\u89C2\u671B';
    }).join('/');
    var list = KEYI_STATE.attendees.map(function(a){
      return a.name + '(' + (a.title||'') + '\u00B7\u515A:' + (a.party||'\u65E0') + '\u00B7\u5FE0' + (a.loyalty||50) + ')';
    }).join('\u3001');
    // 注入每位到会者的认知画像（由 sc07 生成·反映信息不对称）
    var cognitionCtx = '';
    if (typeof getNpcCognitionSnippet === 'function') {
      var _cogBits = [];
      KEYI_STATE.attendees.forEach(function(a){
        var snip = getNpcCognitionSnippet(a.name, { short: true });
        if (snip) {
          _cogBits.push(a.name + '\uFF1A' + snip.replace(/\n/g, ' ').replace(/\u3010\u8BE5\u81E3\u6B64\u65F6\u8BA4\u77E5\u3011/g, '').trim());
        }
      });
      if (_cogBits.length > 0) {
        cognitionCtx = '\n\u3010\u5404\u4F4D\u8BA4\u77E5\u753B\u50CF\uFF08\u65AD\u6848\u7ACB\u573A\u7684\u4E2A\u4EBA\u8BA4\u77E5\u57FA\u7840\uFF09\u3011\n' + _cogBits.join('\n') + '\n';
      }
    }
    var playerStanceHint = '';
    if (KEYI_STATE.playerStance) {
      var lbl = KEYI_STATE.playerStance === 'support' ? '\u503E\u5411\u652F\u6301' : KEYI_STATE.playerStance === 'oppose' ? '\u503E\u5411\u53CD\u5BF9' : '\u7ACB\u573A\u4E2D\u7ACB';
      playerStanceHint = '\u2605 \u9661\u4E0B\u5723\u8C15\u5DF2\u4E0B\uFF1A' + lbl + '\u3002\u8868\u51B3\u65F6\u5FC5\u987B\u5145\u5206\u8003\u8651\u5723\u610F\u3002\n';
    }
    var prompt = ctx + playerStanceHint + cognitionCtx +
      '\u8BF7\u4E3A\u4EE5\u4E0B ' + KEYI_STATE.attendees.length + ' \u540D\u5927\u81E3\u5404\u81EA\u5224\u5B9A\u6700\u7EC8\u7ACB\u573A\u5E76\u7ED9\u51FA 10-30 \u5B57\u7406\u7531\uFF1A\n' +
      list + '\n\n' +
      '\u3010\u786C\u89C4\u5219\u3011\u672C\u6B21\u8BAE\u8BBA\u5DF2\u51FA\u73B0\u7684\u7ACB\u573A\uFF1A' + _stanceStr + '\u3002\u53EA\u53EF\u5728\u8FD9\u4E9B\u7ACB\u573A\u4E2D\u9009\u62E9\u2014\u2014\u8BAE\u8BBA\u4E2D\u6CA1\u4EBA\u8868\u6001\u7684\u7ACB\u573A\u4E0D\u53EF\u4F7F\u7528\u3002\n' +
      '\u5DF2\u53D1\u8A00\u8005\u9700\u4F7F\u7ACB\u573A\u4E0E\u5176\u53D1\u8A00\u4E00\u81F4\u3002\u672A\u53D1\u8A00\u8005\u53EF\u5728\u5141\u8BB8\u7684\u7ACB\u573A\u96C6\u5185\u81EA\u7531\u5224\u5B9A\u3002\n' +
      '\u8FD4\u56DE JSON: [{"name":"","stance":"support|oppose|abstain","reason":""}, ...]\u00B7\u53EA\u8F93\u51FA JSON\u3002';
    try {
      var _tokBudget = (P.conf && P.conf.maxOutputTokens) || (P.conf && P.conf._detectedMaxOutput) || 4000;
      var raw = await callAISmart(prompt, _tokBudget, { maxRetries: 1 });
      var parsed = (typeof extractJSON === 'function') ? extractJSON(raw) : null;
      if (!parsed) { var m = raw.match(/\[[\s\S]*\]/); if (m) try { parsed = JSON.parse(m[0]); } catch(_){} }
      if (Array.isArray(parsed)) {
        parsed.forEach(function(r){
          if (r && r.name && KEYI_STATE.stances[r.name]) {
            KEYI_STATE.stances[r.name] = {
              stance: r.stance || KEYI_STATE.stances[r.name].stance,
              reason: r.reason || KEYI_STATE.stances[r.name].reason
            };
          }
        });
      }
    } catch(e) {
      console.warn('[\u79D1\u8BAE] AI \u8868\u51B3\u7CBE\u4FEE\u5931\u8D25\u00B7\u7528\u9884\u7F6E\u7ACB\u573A', e);
    }
  }

  // Step 4: 单向不变量后处理——降级任何未在讨论中出现的立场
  var _demoted = 0;
  Object.keys(KEYI_STATE.stances).forEach(function(name){
    var v = KEYI_STATE.stances[name];
    if (!seenStances[v.stance]) {
      var newStance;
      if (seenStances['abstain']) newStance = 'abstain';
      else newStance = Object.keys(seenStances)[0];
      v.stance = newStance;
      v.reason = (v.reason || '') + '\uFF08\u5EAD\u8BAE\u65E0\u6B64\u58F0\u00B7\u6539\u89C2\u671B\uFF09';
      _demoted++;
    }
  });
  if (_demoted > 0) console.log('[\u79D1\u8BAE] \u5355\u5411\u4E0D\u53D8\u91CF\uFF1A' + _demoted + ' \u4EBA\u7ACB\u573A\u56E0\u5EAD\u8BAE\u672A\u89C1\u800C\u964D\u7EA7');

  _keyiComputeSupport();
  KEYI_STATE._busy = false;
  KEYI_STATE._busyText = '';
}

/** 计算支持率 */
function _keyiComputeSupport() {
  if (!KEYI_STATE) return;
  var s=0, o=0, ab=0;
  Object.keys(KEYI_STATE.stances).forEach(function(k){
    var v = KEYI_STATE.stances[k].stance;
    if (v === 'support') s++;
    else if (v === 'oppose') o++;
    else ab++;
  });
  var total = s+o+ab;
  KEYI_STATE.support = total > 0 ? (s / total) : 0;
  KEYI_STATE._breakdown = { support:s, oppose:o, abstain:ab, total:total };
}

/** 表决阶段 UI（v3·先显式进度条·完成后显示结果+继续按钮） */
function _keyiRenderVote(body, footer) {
  // 未完成·显示进度条
  if (!KEYI_STATE._voteDone) {
    var prog = Math.max(0, Math.min(100, KEYI_STATE._voteProgress || 0));
    var barHtml = ''
      + '<div style="text-align:center;margin:1.2rem 0 0.8rem;">'
      +   '<div style="font-size:2rem;">\u2696</div>'
      +   '<h3 style="color:var(--gold);margin:0.4rem 0;">\u767E\u5B98\u4ED8\u8868\u51B3</h3>'
      +   '<div style="font-size:0.82rem;color:var(--txt-d);">\u6B63\u6536\u96C6\u4F17\u81E3\u7ACB\u573A\u00B7AI \u63A8\u6F14\u8868\u51B3\u8D70\u52BF\u2026</div>'
      + '</div>'
      + '<div style="background:var(--bg-2);padding:1rem 1.2rem;border-radius:6px;margin:0.8rem 0;">'
      +   '<div style="background:var(--bg-3);border-radius:12px;height:16px;position:relative;overflow:hidden;">'
      +     '<div style="width:' + Math.round(prog) + '%;height:100%;background:linear-gradient(90deg,var(--celadon-400),var(--gold));transition:width 0.3s;"></div>'
      +   '</div>'
      +   '<div style="text-align:center;font-size:0.82rem;color:var(--txt-d);margin-top:0.5rem;">' + Math.round(prog) + '% \u00B7 ' + (KEYI_STATE._busyText || '\u8868\u51B3\u8FDB\u884C\u4E2D') + '</div>'
      + '</div>';
    body.innerHTML = barHtml;
    footer.innerHTML = '<div style="text-align:center;color:var(--txt-d);font-size:0.78rem;">\u8ACB\u5019\u00B7\u8868\u51B3\u5B8C\u6BD5\u81EA\u52A8\u51FA\u7ED3\u679C\u2026</div>';
    return;
  }
  // 完成·显示结果
  var bd = KEYI_STATE._breakdown || {};
  var pct = Math.round((KEYI_STATE.support || 0) * 100);
  var libu = _kejuQueryLibuStance();
  var threshold = libu === 'support' ? 30 : libu === 'oppose' ? 70 : 50;
  var passed = pct >= threshold;
  KEYI_STATE._passed = passed;
  KEYI_STATE._threshold = threshold;

  var html = '<div style="text-align:center;margin-bottom:0.8rem;">'+
    '<div style="font-size:2rem;">\u2696</div>'+
    '<h3 style="color:var(--gold);">\u8868\u51B3\u7ED3\u679C</h3>'+
    '</div>';
  html += '<div style="background:var(--bg-2);padding:0.8rem;border-radius:6px;margin-bottom:0.6rem;">'+
    '<div style="font-size:0.85rem;margin-bottom:0.4rem;">\u652F\u6301\uFF1A<span style="color:var(--celadon-400);font-weight:700;">'+(bd.support||0)+'</span> \u4EBA\u00B7\u53CD\u5BF9\uFF1A<span style="color:var(--vermillion-400);font-weight:700;">'+(bd.oppose||0)+'</span> \u4EBA\u00B7\u89C2\u671B\uFF1A<span style="color:var(--ink-300);">'+(bd.abstain||0)+'</span> \u4EBA</div>'+
    '<div style="background:var(--bg-3);border-radius:10px;height:12px;position:relative;overflow:hidden;">'+
      '<div style="width:'+pct+'%;height:100%;background:linear-gradient(90deg,var(--celadon-400),var(--gold));transition:width 0.6s;"></div>'+
      '<div style="position:absolute;left:'+threshold+'%;top:0;bottom:0;width:2px;background:var(--vermillion-400);"></div>'+
    '</div>'+
    '<div style="font-size:0.78rem;color:var(--txt-d);margin-top:0.3rem;">\u652F\u6301\u7387 '+pct+'% / \u95E8\u69DB '+threshold+'% ('+(libu==='support'?'\u793C\u90E8\u652F\u6301':libu==='oppose'?'\u793C\u90E8\u53CD\u5BF9':'\u793C\u90E8\u65E0\u6001')+')\u00B7<span style="color:'+(passed?'var(--celadon-400)':'var(--vermillion-400)')+';font-weight:700;">'+(passed?'\u901A\u8FC7':'\u672A\u901A\u8FC7')+'</span></div>'+
    '</div>';

  // 折叠具体立场
  html += '<details style="background:var(--bg-2);border-radius:4px;padding:0.4rem 0.6rem;" open>'+
    '<summary style="cursor:pointer;color:var(--gold);font-size:0.82rem;">\u67E5\u770B\u8BE6\u7EC6\u7ACB\u573A\uFF08' + (bd.total||0) + ' \u4EBA\uFF09</summary>'+
    '<div style="margin-top:0.4rem;font-size:0.78rem;max-height:240px;overflow-y:auto;">';
  Object.keys(KEYI_STATE.stances).forEach(function(k){
    var st = KEYI_STATE.stances[k];
    var color = st.stance==='support' ? 'var(--celadon-400)' : st.stance==='oppose' ? 'var(--vermillion-400)' : 'var(--ink-300)';
    var lbl = st.stance==='support' ? '\u652F' : st.stance==='oppose' ? '\u53CD' : '\u89C2';
    html += '<div style="padding:2px 0;"><span style="color:'+color+';font-weight:700;">['+lbl+']</span> '+escHtml(k)+'\uFF1A<span style="color:var(--txt-d);">'+escHtml(st.reason||'')+'</span></div>';
  });
  html += '</div></details>';
  body.innerHTML = html;

  // 显式"继续裁决"按钮·不再自动 jump
  footer.innerHTML = '<div style="text-align:center;">'
    + '<button class="bt bp" onclick="_keyiProceedToDecide()">\u7EE7\u7EED\u88C1\u51B3</button>'
    + '</div>';
}

/** 进入裁决阶段（v3·由用户显式点击） */
function _keyiProceedToDecide() {
  if (!KEYI_STATE) return;
  KEYI_STATE.phase = 'decide';
  _keyiRender();
}

/** 阶段 3·皇帝决策 */
function _keyiRenderDecide(body, footer) {
  var passed = KEYI_STATE._passed;
  var html = '<div style="background:linear-gradient(135deg,rgba(184,154,83,0.08),transparent);border:1px solid var(--gold-d);padding:0.8rem;border-radius:6px;margin-top:0.6rem;">'+
    '<div style="font-weight:700;color:var(--gold);margin-bottom:0.5rem;">\u9661\u4E0B\u88C1\u51B3</div>'+
    '<div style="font-size:0.82rem;color:var(--txt-s);line-height:1.8;">'+
    (passed ? '\u8BAE\u5DF2\u901A\u8FC7\u00B7\u53EF\u4F9D\u8BAE\u5F00\u79D1\u3002' : '\u8BAE\u672A\u901A\u8FC7\u00B7\u82E5\u8981\u5F00\u79D1\u00B7\u9700\u4E0B\u8BCF\u5F3A\u63A8\u3002\u9038\u60E9\u7F5A\uFF1A') +
    (!passed ? '<br>\u00B7 \u4E0B\u8BCF\u5F3A\u63A8\uFF1A\u7687\u5A01-10\u00B7\u7687\u6743-5\u00B7\u53CD\u5BF9\u5927\u81E3\u597D\u611F-8' : '') +
    (!passed ? '<br>\u00B7 \u9006\u4F17\u8BAE\u5F3A\u63A8\uFF1A\u7687\u5A01-20\u00B7\u7687\u6743-10\u00B7\u6C11\u5FC3-5\u00B7\u53CD\u5BF9\u515A\u6D3E-8\u00B7\u597D\u611F-15' : '') +
    '</div></div>';
  body.innerHTML = body.innerHTML.replace(/<div style="background:linear-gradient[\s\S]*?<\/div><\/div>$/, '') + html;

  // 构建 opposingParties 和 opposingMinisters
  var opposingMinisters = [], opposingParties = {};
  Object.keys(KEYI_STATE.stances).forEach(function(k){
    if (KEYI_STATE.stances[k].stance === 'oppose') {
      opposingMinisters.push(k);
      var a = KEYI_STATE.attendees.find(function(x){ return x.name === k; });
      if (a && a.party && a.party !== '\u65E0\u515A' && a.party !== '\u65E0\u515A\u6D3E') opposingParties[a.party] = true;
    }
  });
  var opArr = Object.keys(opposingParties);

  var btns = '<div style="display:flex;gap:0.5rem;justify-content:center;flex-wrap:wrap;">';
  if (passed) {
    btns += '<button class="bt bp" onclick="_keyiConfirmStart(\'council\')">\uD83D\uDCDC \u4F9D\u8BAE\u5F00\u79D1</button>';
  } else {
    btns += '<button class="bt bp" onclick="_keyiConfirmStart(\'edict\')">\u4E0B\u8BCF\u5F3A\u63A8</button>';
    btns += '<button class="bt" style="color:var(--vermillion-400);" onclick="_keyiConfirmStart(\'defy\')">\u9006\u4F17\u8BAE\u5F3A\u63A8</button>';
  }
  btns += '<button class="bt" onclick="_keyiAbort()">\u6682\u7F13</button></div>';
  footer.innerHTML = btns;

  KEYI_STATE._opposingMinisters = opposingMinisters;
  KEYI_STATE._opposingParties = opArr;
}

/** 确认启动科举 */
function _keyiConfirmStart(method) {
  if (!KEYI_STATE) return;
  // v5·将科议结果写入 GM._courtRecords·让 AI 推演知晓
  _keyiPersistToCourtRecords(method);
  // NPC 记忆+人际影响
  _keyiMemoryEffects(method);

  startKejuByMethod(method, {
    opposingMinisters: KEYI_STATE._opposingMinisters || [],
    opposingParties: KEYI_STATE._opposingParties || []
  });
  closeKeyi();
}

/** 科议结果持久化（参照 _persistCourtRecord 格式） */
function _keyiPersistToCourtRecords(method) {
  if (!GM._courtRecords) GM._courtRecords = [];
  var methodLabel = { council:'\u4F9D\u8BAE\u5F00\u79D1', edict:'\u4E0B\u8BCF\u5F3A\u63A8', defy:'\u9006\u4F17\u8BAE\u5F3A\u63A8' }[method] || method;
  var stances = {};
  Object.keys(KEYI_STATE.stances).forEach(function(k){
    var s = KEYI_STATE.stances[k];
    stances[k] = {
      stance: s.stance === 'support' ? '\u8D5E\u6210' : s.stance === 'oppose' ? '\u53CD\u5BF9' : '\u89C2\u671B',
      brief: s.reason || ''
    };
  });
  // 皇帝最终裁决作为 "adopted"
  var adoptedArr = method === 'council' ? [{
    author: (P.playerInfo && P.playerInfo.characterName) || '\u9661\u4E0B',
    content: '\u4F9D\u8BAE\u5F00\u79D1\u4E3E\u00B7\u541B\u81E3\u5171\u8BDB',
    stance: 'support'
  }] : method === 'edict' ? [{
    author: (P.playerInfo && P.playerInfo.characterName) || '\u9661\u4E0B',
    content: '\u4E0D\u987E\u8BAE\u51B3\u00B7\u4E0B\u8BCF\u5F3A\u63A8\u79D1\u4E3E',
    stance: 'support'
  }] : method === 'defy' ? [{
    author: (P.playerInfo && P.playerInfo.characterName) || '\u9661\u4E0B',
    content: '\u9006\u4F17\u8BAE\u5F3A\u63A8\u00B7\u72EC\u65AD\u5F00\u79D1',
    stance: 'support'
  }] : [];

  var record = {
    turn: GM.turn,
    targetTurn: GM.turn,
    phase: 'in-turn',
    topic: '\u79D1\u8BAE\u00B7\u7B79\u529E' + ((P.keju.currentExam && P.keju.currentExam.type === 'enke') ? '\u6069\u79D1' : '\u79D1\u4E3E'),
    mode: 'keyi',
    participants: KEYI_STATE.attendees.filter(function(a){return !a._excluded;}).map(function(a){return a.name;}),
    stances: stances,
    adopted: adoptedArr,
    dismissed: method === null,
    _keyiMeta: {
      method: method,
      methodLabel: methodLabel,
      support: KEYI_STATE.support,
      breakdown: KEYI_STATE._breakdown,
      threshold: KEYI_STATE._threshold,
      passed: KEYI_STATE._passed,
      libuStance: _kejuQueryLibuStance(),
      opposingMinisters: KEYI_STATE._opposingMinisters || [],
      opposingParties: KEYI_STATE._opposingParties || []
    }
  };
  GM._courtRecords.push(record);
  if (GM._courtRecords.length > 8) GM._courtRecords.shift();
  if (typeof recordCourtHeld === 'function') recordCourtHeld({ isPostTurn: false });

  // 并入 _edictTracker 让 AI 下回合 edict_feedback 报告执行
  if (!GM._edictTracker) GM._edictTracker = [];
  GM._edictTracker.push({
    id: 'keyi_' + GM.turn + '_' + method,
    content: '\u79D1\u8BAE\u51B3\u8BAE\uFF1A' + methodLabel + '\u00B7\u79D1\u4E3E\u7B79\u529E',
    category: '\u79D1\u8BAE\u00B7' + methodLabel,
    turn: GM.turn,
    status: 'pending',
    assignee: (P.keju.currentExam && P.keju.currentExam.chiefExaminer) || '',
    feedback: '',
    progressPercent: 0
  });

  // 起居注
  if (GM.qijuHistory) {
    var dateStr = (typeof getTSText === 'function') ? getTSText(GM.turn) : '';
    var bd = KEYI_STATE._breakdown || {};
    GM.qijuHistory.unshift({
      turn: GM.turn, date: dateStr,
      content: '\u3010\u79D1\u8BAE\u3011\u7B79\u529E\u79D1\u4E3E\u00B7\u652F\u6301 ' + (bd.support||0) + '/\u53CD\u5BF9 ' + (bd.oppose||0) + '/\u89C2\u671B ' + (bd.abstain||0) + '\u00B7\u9661\u4E0B' + methodLabel + '\u3002'
    });
  }

  // 纪事
  var bdSum = KEYI_STATE._breakdown || {};
  var detail = '\u652F\u6301 ' + (bdSum.support||0) + '\u00B7\u53CD\u5BF9 ' + (bdSum.oppose||0) + '\u00B7\u89C2\u671B ' + (bdSum.abstain||0);
  var oppNames = (KEYI_STATE._opposingMinisters||[]).slice(0,5).join('\u3001');
  if (oppNames) detail += '\u00B7\u53CD\u5BF9\u8005\uFF1A' + oppNames;
  _kejuWriteJishi('\u79D1\u8BAE\u7B79\u529E', methodLabel, detail);

  // 事件栏
  if (typeof addEB === 'function') addEB('\u79D1\u4E3E', '\u79D1\u8BAE\u00B7' + methodLabel + '\u00B7\u652F\u6301\u7387 ' + Math.round((KEYI_STATE.support||0)*100) + '%');
}

/** 通用·写科举事件到纪事 */
function _kejuWriteJishi(kind, summary, detail) {
  if (!GM.jishiRecords) GM.jishiRecords = [];
  GM.jishiRecords.push({
    turn: GM.turn,
    char: '\u79D1\u4E3E',
    playerSaid: '\u3010' + kind + '\u3011' + summary,
    npcSaid: detail || '',
    mode: 'keju_event'
  });
}

/** 科议 NPC 记忆+人际影响 */
function _keyiMemoryEffects(method) {
  var methodLabel = { council:'\u4F9D\u8BAE', edict:'\u4E0B\u8BCF\u5F3A\u63A8', defy:'\u9006\u4F17\u8BAE\u5F3A\u63A8' }[method] || method;
  var active = KEYI_STATE.attendees.filter(function(a){ return !a._excluded; });
  var playerName = (P.playerInfo && P.playerInfo.characterName) || '\u9661\u4E0B';

  active.forEach(function(a){
    var ch = a._ch || findCharByName(a.name);
    if (!ch) return;
    var s = KEYI_STATE.stances[a.name];
    if (!s) return;

    // NPC 记忆
    if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
      var stanceLabel = s.stance === 'support' ? '\u8D5E\u6210' : s.stance === 'oppose' ? '\u53CD\u5BF9' : '\u89C2\u671B';
      var emo = '\u5E73';
      if (method === 'council') {
        emo = s.stance === 'support' ? '\u559C' : s.stance === 'oppose' ? '\u5FE7' : '\u5E73';
      } else if (method === 'edict' || method === 'defy') {
        emo = s.stance === 'oppose' ? '\u6012' : s.stance === 'support' ? '\u5E73' : '\u5FE7';
      }
      NpcMemorySystem.remember(a.name,
        '\u79D1\u8BAE\u4E2D' + stanceLabel + '\u5F00\u79D1\u00B7\u7687\u5E1D' + methodLabel + '\u00B7' + (s.reason || '').slice(0, 30),
        emo, method === 'defy' ? 8 : 6, playerName);
    }

    // AffinityMap 调整
    if (typeof AffinityMap !== 'undefined' && AffinityMap.add) {
      if (method === 'council' && s.stance === 'support') AffinityMap.add(a.name, playerName, 2, '\u79D1\u8BAE\u6240\u8D5E\u4E0E\u7687\u5E1D\u540C');
      else if (method === 'council' && s.stance === 'oppose') AffinityMap.add(a.name, playerName, -2, '\u79D1\u8BAE\u6240\u53CD\u800C\u4E0D\u5F97');
      // 逆众议强推的额外惩罚已在 startKejuByMethod 中施加
    }
  });
}

/** 缓议 */
function _keyiAbort() {
  if (GM.keju && GM.keju._pendingProposal) GM.keju._pendingProposal.resolved = true;
  toast('\u79D1\u8BAE\u6682\u7F13');
  closeKeyi();
}

/** 关闭科议 */
function closeKeyi() {
  var modal = document.getElementById('keyi-modal'); if (modal) modal.remove();
  KEYI_STATE = null;
}

// 暴露到 window
if (typeof window !== 'undefined') {
  window.openKeyiSession = openKeyiSession;
  window.closeKeyi = closeKeyi;
  // R102 删·_keyiToggleAttendee 从未定义·暴露到 window 会 ReferenceError·无调用点
  // R121 删·_keyiStartDiscuss 同样从未定义（headless smoke 发现）·无调用点
  window._keyiNextRound = _keyiNextRound;
  window._keyiProceedToVote = _keyiProceedToVote;
  window._keyiConfirmStart = _keyiConfirmStart;
  window._keyiAbort = _keyiAbort;
}

function renderFinishedStage(container) {
  var exam = P.keju.currentExam;
  var results = exam.dianshiResults || [];

  // v5·F5·若有答卷但无 finalRanking·先显示钦定 UI
  if (results.length >= 3 && !exam.finalRanking) {
    return renderDianshiDecideStage(container);
  }

  // 若玩家已钦定·按 finalRanking 重排 results
  if (exam.finalRanking && results.length >= 3) {
    var fr = exam.finalRanking;
    var reordered = [];
    [fr.zhuangyuan, fr.bangyan, fr.tanhua].forEach(function(nm){
      var idx = results.findIndex(function(r){ return r.name === nm; });
      if (idx >= 0) { reordered.push(results[idx]); results.splice(idx,1); }
    });
    results = reordered.concat(results);
    // 重排 rank
    results.forEach(function(r,i){ r.rank = i+1; });
    exam.dianshiResults = results;
  }

  var html = '<div style="margin-bottom:1.5rem;">';
  // 金榜头部——仪式感
  html += '<div style="text-align:center;margin-bottom:1.2rem;padding:1.5rem;background:linear-gradient(135deg,rgba(138,109,27,0.12),rgba(138,109,27,0.03));border:1px solid var(--gold-d);border-radius:8px;">';
  html += '<div style="font-size:2.5rem;margin-bottom:0.3rem;">\uD83C\uDFC6</div>';
  html += '<h3 style="color:var(--gold);font-size:1.3rem;letter-spacing:0.15em;margin-bottom:0.3rem;">\u91D1\u699C\u9898\u540D</h3>';
  if (results.length >= 3) {
    html += '<div style="font-size:1rem;color:var(--txt-s);">\u72B6\u5143 <span style="color:var(--gold);font-weight:900;">' + escHtml(results[0].name) + '</span>';
    html += ' \u00B7 \u699C\u773C <span style="color:var(--gold);">' + escHtml(results[1].name) + '</span>';
    html += ' \u00B7 \u63A2\u82B1 <span style="color:var(--gold);">' + escHtml(results[2].name) + '</span></div>';
  }
  html += '<div style="font-size:0.75rem;color:var(--txt-d);margin-top:0.5rem;">\u6BBE\u8BD5\u9898\u76EE\uFF1A' + escHtml((exam.playerQuestion||'').substring(0,40)) + '...</div>';
  html += '</div>';

  // 三甲——留中央任职
  html += '<div style="margin-bottom:0.8rem;font-size:0.85rem;color:var(--txt-d);border-bottom:1px solid var(--bdr);padding-bottom:0.4rem;">\u2605 \u4E09\u7532\u2014\u2014\u7559\u4E2D\u592E\u4EFB\u804C</div>';
  results.slice(0, 3).forEach(function(c, idx) {
    var rankName = idx === 0 ? '\uD83E\uDD47 \u72B6\u5143' : idx === 1 ? '\uD83E\uDD48 \u699C\u773C' : '\uD83E\uDD49 \u63A2\u82B1';
    html += '<div style="background:linear-gradient(135deg,var(--bg-2),rgba(138,109,27,0.06));padding:1rem;margin-bottom:0.5rem;border-radius:6px;border-left:3px solid var(--gold);">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.4rem;">';
    html += '<div><strong style="color:var(--gold);font-size:1.05rem;">' + rankName + '\uFF1A' + escHtml(c.name) + '</strong> ';
    html += '<span style="color:var(--txt-d);font-size:0.8rem;">' + (c.age||'') + '\u5C81 ' + escHtml(c.origin||'') + ' ' + escHtml(c.class||'') + ' \u5206' + (c.score||0) + '</span></div>';
    html += '<div style="display:flex;gap:0.3rem;">';
    html += '<button class="bt bs bsm" onclick="viewAnswer(' + idx + ')">\u67E5\u770B\u7B54\u5377</button>';
    html += '<button class="bt bp bsm" onclick="recruitCandidate(' + idx + ')">\u7EB3\u5165\u4EBA\u7269\u5FD7</button>';
    html += '<button class="bt bs bsm" onclick="assignOffice(' + idx + ')">\u6388\u4E88\u4E2D\u592E\u5B98\u804C</button>';
    html += '</div></div>';
    if (c.evaluation) html += '<p style="font-size:0.82rem;color:var(--txt-s);font-style:italic;">\u8003\u5B98\u8BC4\uFF1A' + escHtml(c.evaluation) + '</p>';
    if (c.answerSummary) html += '<p style="font-size:0.78rem;color:var(--txt-d);margin-top:0.3rem;">\u7B54\u5377\u6458\u8981\uFF1A' + escHtml(c.answerSummary.substring(0, 80)) + '...</p>';
    html += '</div>';
  });

  // 第4-20名——详细评价
  if (results.length > 3) {
    html += '<div style="margin:0.8rem 0 0.5rem;font-size:0.85rem;color:var(--txt-d);border-bottom:1px solid var(--bdr);padding-bottom:0.4rem;">\u4E8C\u7532\u53CA\u4EE5\u4E0B\u2014\u2014\u53EF\u5206\u914D\u5730\u65B9\u4EFB\u804C</div>';
    results.slice(3).forEach(function(c, _idx) {
      var idx = _idx + 3;
      html += '<div style="background:var(--bg-3);padding:0.6rem;margin-bottom:0.3rem;border-radius:4px;">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
      html += '<div><strong style="font-size:0.88rem;">\u7B2C' + c.rank + '\u540D\uFF1A' + escHtml(c.name) + '</strong> ';
      html += '<span style="color:var(--txt-d);font-size:0.75rem;">' + (c.age||'') + '\u5C81 ' + escHtml(c.origin||'') + ' ' + escHtml(c.class||'') + ' \u5206' + (c.score||0) + '</span></div>';
      html += '<div style="display:flex;gap:0.3rem;">';
      html += '<button class="bt bs bsm" onclick="viewAnswer(' + idx + ')">\u7B54\u5377</button>';
      html += '<button class="bt bp bsm" onclick="recruitCandidate(' + idx + ')">\u7EB3\u5165</button>';
      html += '</div></div>';
      if (c.evaluation) html += '<p style="font-size:0.78rem;color:var(--txt-d);margin-top:0.2rem;">' + escHtml(c.evaluation) + '</p>';
      html += '</div>';
    });
  }

  html += '<div style="text-align:center;margin-top:1rem;">' +
    '<button class="bt bp" onclick="finishKeju()" style="padding:0.7rem 2rem;font-size:1rem;">\u2705 \u5B8C\u6210\u79D1\u4E3E\u00B7\u5929\u4E0B\u6709\u6240\u77E5</button>' +
    '</div></div>';

  container.innerHTML = html;
}

/**
 * 查看考生答卷（AI生成完整答卷）
 */
async function viewAnswer(index) {
  var exam = P.keju.currentExam;
  var candidate = exam.dianshiResults[index];
  if (!candidate) return;

  // 如果已经生成过完整答卷，直接显示
  if (candidate.fullAnswer) {
    showAnswerModal(candidate);
    return;
  }

  showLoading('生成答卷中...', 50);

  try {
    var prompt = '你是考生' + candidate.name + '。请根据以下殿试题目作答。\n\n' +
      '【题目】\n' + exam.playerQuestion + '\n\n' +
      '【考生信息】\n' +
      '姓名：' + candidate.name + '\n' +
      '年龄：' + candidate.age + '\n' +
      '籍贯：' + candidate.origin + '\n' +
      '出身：' + candidate.class + '\n' +
      '排名：第' + candidate.rank + '名\n\n' +
      '【作答要求】\n' +
      '1. 答卷长度400-600字\n' +
      '2. 符合该考生的背景和水平\n' +
      '3. 体现该时代的文风\n' +
      '4. 展现治国理政见解\n\n' +
      '直接输出答卷内容，不要JSON格式。';

    var answer = await callAISmart(prompt, 1500, {minLength: 300, maxRetries: 2});
    candidate.fullAnswer = answer;
    hideLoading();
    showAnswerModal(candidate);
  } catch(e) {
    console.error('[科举] 生成答卷失败:', e);
    hideLoading();
    toast('❌ 生成失败');
  }
}

/**
 * 显示答卷弹窗
 */
function showAnswerModal(candidate) {
  var exam = P.keju.currentExam || {};
  var chiefName = exam.chiefExaminer || '\u4E3B\u8003\u5B98';
  var modal = document.createElement('div');
  modal.className = 'modal-bg show';
  var html = '<div style="background:var(--bg-1);border:1px solid var(--gold-d);border-radius:12px;width:90%;max-width:760px;max-height:84vh;display:flex;flex-direction:column;overflow:hidden;">'
    + '<div style="padding:0.8rem 1.2rem;border-bottom:1px solid var(--bdr);display:flex;justify-content:space-between;">'
    +   '<div style="font-size:1.1rem;font-weight:700;color:var(--gold);">\uD83D\uDCDC ' + escHtml(candidate.name) + ' \u7684\u7B54\u5377</div>'
    +   '<button class="bt bs bsm" onclick="this.closest(\'.modal-bg\').remove()">\u2715</button>'
    + '</div>'
    + '<div style="flex:1;overflow-y:auto;padding:1.5rem;">'
    // 考生信息
    +   '<div style="background:var(--bg-2);padding:1rem;border-radius:8px;margin-bottom:1rem;">'
    +     '<p><strong>\u8003\u751F\uFF1A</strong>' + escHtml(candidate.name) + '\uFF08' + (candidate.age||'?') + '\u5C81\uFF0C' + escHtml(candidate.origin||'') + '\uFF09</p>'
    +     '<p><strong>\u6392\u540D\uFF1A</strong>\u7B2C' + candidate.rank + '\u540D'
    +       (candidate.style ? '<span style="color:var(--txt-d);margin-left:10px;">\u98CE\u683C\uFF1A' + escHtml(candidate.style) + '</span>' : '')
    +       (candidate.personalityHint ? '<span style="color:var(--txt-d);margin-left:10px;">\u6027\u60C5\uFF1A' + escHtml(candidate.personalityHint) + '</span>' : '')
    +     '</p>'
    +     '<p><strong>\u8BC4\u5206\uFF1A</strong>' + candidate.score + '\u5206</p>'
    +   '</div>';
  // 主考官批语（红色朱笔风·印象突出）
  if (candidate.chiefExaminerComment) {
    html += '<div style="background:linear-gradient(135deg,rgba(192,64,48,0.08),rgba(140,40,30,0.04));border:1px solid rgba(192,64,48,0.35);border-left:4px solid #C04030;padding:0.9rem 1.1rem;border-radius:6px;margin-bottom:1rem;position:relative;">'
      + '<div style="font-size:0.72rem;color:#C04030;letter-spacing:0.15em;font-weight:700;margin-bottom:6px;">\u3014 \u4E3B\u8003\u6279\u8BED \u3015</div>'
      + '<div style="font-size:0.9rem;line-height:1.9;color:#D9A99B;font-style:italic;">\u201C' + escHtml(candidate.chiefExaminerComment) + '\u201D</div>'
      + '<div style="text-align:right;font-size:0.72rem;color:var(--txt-d);margin-top:6px;">\u2014\u2014 \u4E3B\u8003 ' + escHtml(chiefName) + ' \u5212\u5B9A</div>'
      + '</div>';
  }
  // 考官综合评语（较低调）
  if (candidate.evaluation) {
    html += '<div style="background:rgba(138,109,27,0.06);border-left:3px solid var(--gold-d);padding:0.7rem 1rem;border-radius:4px;margin-bottom:1rem;font-size:0.84rem;line-height:1.7;color:var(--txt-s);">'
      + '<strong style="color:var(--gold);">\u8003\u5B98\u7EFC\u8BC4\uFF1A</strong>' + escHtml(candidate.evaluation)
      + '</div>';
  }
  // 答卷正文
  html += '<div style="background:var(--bg-2);padding:1.5rem;border-radius:8px;line-height:2;white-space:pre-wrap;font-size:0.92rem;">'
    + escHtml(candidate.fullAnswer || '\uFF08\u65E0\u6587\uFF09')
    + '</div>';
  // 史料（若历史人物）
  if (candidate.isHistorical && candidate.shiliao) {
    html += '<details style="background:var(--bg-2);padding:0.6rem 1rem;border-radius:4px;margin-top:1rem;">'
      + '<summary style="color:var(--gold);cursor:pointer;font-size:0.85rem;">\u3014\u53F2\u6599\u539F\u6587\u3015</summary>'
      + '<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--txt-s);line-height:1.7;">' + escHtml(candidate.shiliao) + '</div>'
      + '</details>';
  }
  html += '</div></div>';
  modal.innerHTML = html;
  document.body.appendChild(modal);
}

/**
 * 将考生纳入人物志
 */
function recruitCandidate(index) {
  var exam = P.keju.currentExam;
  var candidate = exam.dianshiResults[index];
  if (!candidate) return;

  // 添加到人物志（完整角色数据）
  var rankTitles = {1:'\u72B6\u5143',2:'\u699C\u773C',3:'\u63A2\u82B1'};
  var rankTitle = rankTitles[candidate.rank] || '\u65B0\u79D1\u8FDB\u58EB';
  // 根据名次推算属性——状元智力更高，但不全是书呆子
  var baseInt = Math.min(98, (candidate.score || 80) + (candidate.rank <= 3 ? 5 : 0));
  var newChar = {
    id: typeof uid === 'function' ? uid() : 'keju_' + Date.now() + '_' + candidate.rank,
    name: candidate.name,
    age: candidate.age || 25,
    gender: candidate.gender || '\u7537',
    origin: candidate.origin || '',
    ethnicity: candidate.ethnicity || '',
    birthplace: candidate.origin || '',
    title: rankTitle,
    faction: P.playerInfo ? P.playerInfo.factionName || '' : '',
    party: '',
    familyTier: candidate.class === '\u58EB\u65CF' ? 'gentry' : candidate.class === '\u5BD2\u95E8' ? 'common' : 'common',
    family: candidate.name.charAt(0) + '\u6C0F',
    loyalty: 75 + (candidate.rank <= 3 ? 10 : 0),
    ambition: candidate.rank <= 3 ? 70 : 55,
    benevolence: 65,
    intelligence: baseInt,
    administration: Math.min(95, baseInt - 5 + randInt(0, 9)),
    valor: 30 + randInt(0, 19),
    charisma: 50 + randInt(0, 29),
    diplomacy: 40 + randInt(0, 29),
    morale: 85,
    stress: 0,
    personality: candidate.rank <= 3 ? '\u624D\u534E\u6A2A\u6EA2\uFF0C\u5FD7\u5728\u62A5\u56FD' : '\u52E4\u594B\u597D\u5B66\uFF0C\u604D\u5FCD\u4E0D\u62D4',
    appearance: '',
    bio: '\u7B2C' + candidate.rank + '\u540D\u8FDB\u58EB\uFF0C' + (candidate.origin || '') + '\u4EBA\u3002' + (candidate.evaluation || ''),
    description: candidate.answerSummary || '',
    faith: '',
    culture: '',
    type: 'historical',
    role: '\u65B0\u79D1\u8FDB\u58EB',
    isHistorical: false,
    recruited: true,
    recruitTurn: GM.turn,
    source: '\u79D1\u4E3E',
    alive: true,
    _eventOpinions: [],
    spouse: false,
    children: []
  };

  GM.chars.push(newChar);
  GM.allCharacters.push({
    name: newChar.name, title: newChar.title, age: newChar.age, gender: newChar.gender,
    personality: newChar.personality, desc: newChar.description, loyalty: newChar.loyalty,
    faction: newChar.faction, recruited: true, recruitTurn: GM.turn, source: '\u79D1\u4E3E'
  });

  if (typeof recordPlayerDecision === 'function') recordPlayerDecision('keju', '\u5F55\u7528' + candidate.name + '\u4E3A\u65B0\u5B98');
  if (typeof recordCharacterArc === 'function') recordCharacterArc(candidate.name, 'achievement', '\u79D1\u4E3E\u53CA\u7B2C');

  // ── 关系网络（倾向非绑定）──

  // 1. 座师关系——亲疏倾向，非强制
  var examiner = exam.chiefExaminer;
  if (examiner && typeof AffinityMap !== 'undefined') {
    // 门生对座师有好感（但非绝对忠诚——受人物性格影响）
    var _gratitude = 15; // 基础好感
    // 忠正之士不屑于门生攀附
    if (newChar.benevolence > 80 || (newChar.personality && /\u5FE0\u6B63|\u521A\u76F4|\u4E0D\u5C48/.test(newChar.personality))) _gratitude = 5;
    AffinityMap.add(candidate.name, examiner, _gratitude, '\u5EA7\u5E08\u63D0\u643A');
    AffinityMap.add(examiner, candidate.name, Math.round(_gratitude * 0.5), '\u95E8\u751F');
    if (typeof NpcMemorySystem !== 'undefined') {
      NpcMemorySystem.remember(candidate.name, '\u79D1\u4E3E\u53CA\u7B2C\uFF0C\u5EA7\u5E08\u4E3A' + examiner, '\u656C', 7, examiner);
    }
  }

  // 2. 天子门生——殿试前三名对玩家(天子)有特殊感恩
  var isTop3 = candidate.rank <= 3;
  if (isTop3 && P.playerInfo && P.playerInfo.characterName && typeof AffinityMap !== 'undefined') {
    var _playerName = P.playerInfo.characterName;
    AffinityMap.add(candidate.name, _playerName, 12, '\u5929\u5B50\u95E8\u751F\u4E4B\u6069');
    if (typeof NpcMemorySystem !== 'undefined') {
      var _rankTitle = candidate.rank === 1 ? '\u72B6\u5143' : candidate.rank === 2 ? '\u699C\u773C' : '\u63A2\u82B1';
      NpcMemorySystem.remember(candidate.name, '\u6BBE\u8BD5\u53CA\u7B2C\uFF0C\u8499\u5929\u5B50\u4EB2\u7B56\u70B9\u4E3A' + _rankTitle, '\u656C', 9, _playerName);
    }
  }

  // 3. 同年关系——同科进士互相亲近（但不是同党）
  if (typeof AffinityMap !== 'undefined' && GM.chars) {
    var _sameYear = GM.chars.filter(function(c) { return c.alive !== false && c.source === '\u79D1\u4E3E' && c.recruitTurn === GM.turn && c.name !== candidate.name; });
    _sameYear.forEach(function(peer) {
      AffinityMap.add(candidate.name, peer.name, 8, '\u540C\u5E74\u4E4B\u8C0A');
      AffinityMap.add(peer.name, candidate.name, 8, '\u540C\u5E74\u4E4B\u8C0A');
    });
  }

  // 4. 不强制入党——记录座师党派作为"倾向"标签（AI推演时参考，非硬性）
  newChar._mentorParty = '';
  if (examiner) {
    var examinerChar = typeof findCharByName === 'function' ? findCharByName(examiner) : null;
    if (examinerChar && examinerChar.party && examinerChar.party !== '\u65E0\u515A\u6D3E') {
      newChar._mentorParty = examinerChar.party; // 仅存储倾向，不直接入党
    }
  }

  toast('\u2705 ' + candidate.name + ' \u5DF2\u7EB3\u5165\u4EBA\u7269\u5FD7' + (isTop3 ? '(\u5929\u5B50\u95E8\u751F)' : '') + (examiner ? ' \u5EA7\u5E08:' + examiner : ''));
  if (typeof renderGameState === 'function') renderGameState();
}

/**
 * 为考生授予官职
 */
function assignOffice(index) {
  var exam = P.keju.currentExam;
  var candidate = exam && exam.dianshiResults ? exam.dianshiResults[index] : null;
  if (!candidate) return;

  // 确保候选人已被录入角色列表
  var ch = typeof findCharByName === 'function' ? findCharByName(candidate.name) : null;
  if (!ch) {
    toast('请先将此人纳入人物志');
    return;
  }

  // 收集可用的空缺官职
  var vacantPosts = [];
  if (GM.officeTree) {
    (function walk(nodes, prefix) {
      nodes.forEach(function(n) {
        if (n.positions) n.positions.forEach(function(p) {
          if (!p.holder) vacantPosts.push({ dept: n.name, pos: p.name, rank: p.rank || '', fullName: (prefix ? prefix + '·' : '') + n.name + p.name });
        });
        if (n.subs) walk(n.subs, (prefix ? prefix + '·' : '') + n.name);
      });
    })(GM.officeTree, '');
  }

  if (vacantPosts.length === 0) {
    toast('当前无空缺官职');
    return;
  }

  // 显示选择面板
  var html = '<div style="padding:1rem;max-width:400px;">';
  html += '<h3 style="color:var(--gold);margin-bottom:0.8rem;">授予 ' + escHtml(candidate.name) + ' 官职</h3>';
  html += '<div style="font-size:0.8rem;color:var(--txt-d);margin-bottom:0.6rem;">第' + candidate.rank + '名 · ' + (candidate.origin||'') + ' · ' + (candidate.evaluation||'').slice(0,30) + '</div>';
  html += '<div style="max-height:250px;overflow-y:auto;">';
  vacantPosts.forEach(function(vp, vi) {
    html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:0.4rem 0.6rem;margin-bottom:0.3rem;background:var(--bg-2);border-radius:4px;cursor:pointer;" onclick="_kejuAssignConfirm(' + index + ',' + vi + ')">';
    html += '<span style="font-size:0.85rem;">' + escHtml(vp.fullName) + '</span>';
    if (vp.rank) html += '<span style="font-size:0.7rem;color:var(--txt-d);">' + escHtml(vp.rank) + '</span>';
    html += '</div>';
  });
  html += '</div>';
  html += '<button class="bt bs" style="margin-top:0.6rem;" onclick="this.closest(\'.modal-bg\').remove();">取消</button>';
  html += '</div>';

  var ov = document.createElement('div');
  ov.className = 'modal-bg show';
  ov.innerHTML = '<div class="modal" style="max-width:420px;">' + html + '</div>';
  document.body.appendChild(ov);

  // 存储空缺列表供确认使用
  window._kejuVacantPosts = vacantPosts;
}

function _kejuAssignConfirm(candidateIdx, postIdx) {
  var exam = P.keju.currentExam;
  var candidate = exam && exam.dianshiResults ? exam.dianshiResults[candidateIdx] : null;
  var vp = window._kejuVacantPosts ? window._kejuVacantPosts[postIdx] : null;
  if (!candidate || !vp) return;

  // 在officeTree中找到对应职位并任命
  (function walk(nodes) {
    nodes.forEach(function(n) {
      if (n.name === vp.dept && n.positions) {
        n.positions.forEach(function(p) {
          if (p.name === vp.pos && !p.holder) {
            p.holder = candidate.name;
            addEB('\u4EFB\u547D', candidate.name + '\u4EFB' + vp.fullName + '(\u79D1\u4E3E\u6388\u804C)');
            toast('\u2705 ' + candidate.name + ' \u5DF2\u4EFB' + vp.fullName);
          }
        });
      }
      if (n.subs) walk(n.subs);
    });
  })(GM.officeTree);

  // 关闭选择面板
  var modals = document.querySelectorAll('.modal-bg');
  if (modals.length > 1) modals[modals.length - 1].remove();
  delete window._kejuVacantPosts;
}

/**
 * 完成科举
 */
function finishKeju() {
  var exam = P.keju.currentExam;
  if (!exam) return;

  var results = exam.dianshiResults || [];
  var top3 = results.slice(0, 3).map(function(c) { return c.name; });

  // 记录到历史
  P.keju.history.push({
    date: exam.startDate,
    passedCount: exam.statistics ? exam.statistics.passedCount : 0,
    quality: exam.statistics ? exam.statistics.quality : '',
    topThree: top3,
    question: (exam.playerQuestion || '').substring(0, 50),
    dianshiCount: results.length
  });

  P.keju.lastExamDate = exam.startDate;

  // 事件日志——让回合报告中能体现
  if (typeof addEB === 'function') {
    addEB('\u79D1\u4E3E', '\u79D1\u4E3E\u5B8C\u6BD5\uFF0C\u5F55\u53D6' + (exam.statistics ? exam.statistics.passedCount : 0) + '\u4EBA\u3002\u72B6\u5143' + (top3[0]||'') + '\u3001\u699C\u773C' + (top3[1]||'') + '\u3001\u63A2\u82B1' + (top3[2]||''));
  }
  if (typeof recordPlayerDecision === 'function') {
    recordPlayerDecision('keju', '\u79D1\u4E3E\u5B8C\u6210\uFF0C\u72B6\u5143' + (top3[0]||'') + '\uFF0C\u5171\u53D6' + results.length + '\u4EBA');
  }

  // NPC记忆——重要政治事件
  if (typeof NpcMemorySystem !== 'undefined' && GM.chars) {
    GM.chars.forEach(function(c) {
      if (c.alive !== false && c.source === '\u79D1\u4E3E' && c.recruitTurn === GM.turn) {
        NpcMemorySystem.remember(c.name, '\u79D1\u4E3E\u53CA\u7B2C\uFF0C\u91D1\u699C\u9898\u540D', '\u559C', 9);
      }
    });
  }

  // ── 政斗影响：科举结果→阶层满意度 ──
  var stats = exam.statistics || {};

  // 1. 阶层比例→阶层满意度影响
  if (stats.classRatio && GM.classes) {
    GM.classes.forEach(function(cls) {
      var clsName = cls.name;
      // 士族考生多→士族满意，寒门考生多→寒门满意
      Object.entries(stats.classRatio).forEach(function(e) {
        if (clsName.indexOf(e[0]) >= 0 || e[0].indexOf(clsName) >= 0) {
          var share = e[1] || 0;
          if (share > 0.4) cls.satisfaction = Math.min(100, (parseInt(cls.satisfaction)||50) + 3);
          else if (share < 0.15) cls.satisfaction = Math.max(0, (parseInt(cls.satisfaction)||50) - 2);
        }
      });
    });
  }

  // 2. 座主信息记入历史
  P.keju.history[P.keju.history.length - 1].chiefExaminer = exam.chiefExaminer || '';
  P.keju.history[P.keju.history.length - 1].examinerParty = exam.examinerParty || '';

  // v5·G1+G2·三甲自动纳入·4-20 入进士池填缺·全部算阶层党派吏治影响
  try { _kejuFinalize(exam); } catch(e) { console.warn('[科举·G] finalize 失败', e); }

  // P7: 科举入仕生命周期——未手动授官的进士进入待铨队列
  if (!GM._kejuPendingAssignment) GM._kejuPendingAssignment = [];
  results.forEach(function(c) {
    var ch = typeof findCharByName === 'function' ? findCharByName(c.name) : null;
    if (ch && !ch.officialTitle && !ch.title) {
      GM._kejuPendingAssignment.push({
        name: c.name,
        rank: c.rank,
        enrollTurn: GM.turn,
        origin: c.origin || '',
        score: c.score || 0
      });
    }
  });

  P.keju.currentExam = null;
  closeKejuModal();
  if (typeof renderGameState === 'function') renderGameState();
  toast('\uD83D\uDCDC \u79D1\u4E3E\u8003\u8BD5\u5706\u6EE1\u7ED3\u675F\uFF0C\u72B6\u5143' + (top3[0]||'') + '\u3001\u699C\u773C' + (top3[1]||'') + '\u3001\u63A2\u82B1' + (top3[2]||''));
}

// ══════════════════════════════════════════════════════════════════
// v5·G1+G2·finalize：三甲纳入+未纳入填缺+阶层党派吏治影响
// ══════════════════════════════════════════════════════════════════

/** 科举结束时的总结算 */
function _kejuFinalize(exam) {
  if (!exam) return;
  var results = exam.dianshiResults || [];
  var fr = exam.finalRanking || {};

  // 1. 前三名自动纳入人物志（若尚未纳入）
  [fr.zhuangyuan, fr.bangyan, fr.tanhua].forEach(function(name, idx){
    if (!name) return;
    var existing = (GM.chars||[]).find(function(c){ return c && c.name === name; });
    if (existing) return;  // 已存在
    // 从 results 中找对应数据
    var r = results.find(function(x){ return x.name === name; });
    if (!r) return;
    // 异步生成完整人物数据（不 await·让它在后台完成）
    _aiGenerateFullCharacter(r, idx === 0 ? 'zhuangyuan' : idx === 1 ? 'bangyan' : 'tanhua').catch(function(e){
      console.warn('[科举·G2] 三甲人物生成失败·使用模板兜底', e);
      _kejuBasicRecruit(r, idx === 0 ? '\u72B6\u5143' : idx === 1 ? '\u699C\u773C' : '\u63A2\u82B1');
    });
  });

  // 2. 4-20 名入 gradPool 并填缺
  var unPlaced = results.slice(3).map(function(c){
    return {
      name: c.name, age: c.age, origin: c.origin, class: c.class, party: c.party,
      score: c.score, rank: c.rank,
      answerSummary: (c.fullAnswer || c.answerSummary || '').slice(0, 200),
      personalityHint: c.personalityHint,
      shiliao: c.shiliao || '',
      isHistorical: !!c.isHistorical,
      allocatedOffice: null,
      _crystallized: false,
      _examId: exam.id
    };
  });
  exam.gradPool = unPlaced;
  _kejuAllocateGradsToOffices(unPlaced);

  // 3. 阶层+党派+吏治影响·全员算
  _kejuAggregateGradsEffect(results, exam);

  // v5·纪事·科举完成总结
  if (typeof _kejuWriteJishi === 'function') {
    var placed = unPlaced.filter(function(g){return g.allocatedOffice;}).length;
    var summary = '\u5171 ' + results.length + ' \u540D\u00B7\u4E09\u7532\u5165\u4EBA\u7269\u5FD7\u00B7' + placed + ' \u4EBA\u586B\u5730\u65B9\u7F3A\u989D';
    var detail = '';
    if (exam.historicalHits && exam.historicalHits.length) detail = '\u5386\u53F2\u540D\u81E3\u547D\u4E2D\uFF1A' + exam.historicalHits.join('\u3001');
    if (exam.chiefExaminer) detail += (detail ? '\u00B7' : '') + '\u4E3B\u8003\uFF1A' + exam.chiefExaminer;
    _kejuWriteJishi('\u91D1\u699C\u9898\u540D', summary, detail);
  }
  if (typeof addEB === 'function') {
    var fr2 = exam.finalRanking || {};
    addEB('\u79D1\u4E3E', '\u91D1\u699C\u00B7\u72B6\u5143' + (fr2.zhuangyuan||'?') + '\u00B7\u699C\u773C' + (fr2.bangyan||'?') + '\u00B7\u63A2\u82B1' + (fr2.tanhua||'?'));
  }
}

/** 模板兜底·只写基础字段 */
function _kejuBasicRecruit(candidate, rankTitle) {
  if (!GM.chars) GM.chars = [];
  if (GM.chars.find(function(c){ return c && c.name === candidate.name; })) return;
  var bonus = P.keju.attributeBonus || {};
  var key = rankTitle === '\u72B6\u5143' ? 'zhuangyuan' : rankTitle === '\u699C\u773C' ? 'bangyan' : 'tanhua';
  var b = bonus[key] || {};
  GM.chars.push({
    id: 'keju_' + Date.now() + '_' + candidate.rank,
    name: candidate.name,
    age: candidate.age || 25,
    origin: candidate.origin,
    ethnicity: candidate.ethnicity || '\u6C49',
    class: candidate.class || '\u5BD2\u95E8',
    title: rankTitle,
    bio: '\u672C\u79D1' + rankTitle + '\u3002' + (candidate.fullAnswer || candidate.answerSummary || '').slice(0, 100),
    historicalSource: candidate.shiliao || '',
    intelligence: Math.min(98, (candidate.score || 80) + 5),
    administration: 70,
    loyalty: 80, ambition: 70,
    resources: { fame: b.fame || 30, virtue: b.virtue || 15, privateWealth: { money:0, grain:0, cloth:0 }, publicPurse: { money:0, grain:0, cloth:0 }, health:80, stress:0 },
    alive: true,
    source: '\u79D1\u4E3E',
    recruitTurn: GM.turn,
    isHistorical: !!candidate.isHistorical
  });
}

/** G2·AI 全字段生成（含生平/外貌/家谱/史料出处段） */
async function _aiGenerateFullCharacter(candidate, rankKey) {
  if (!P.ai || !P.ai.key) { _kejuBasicRecruit(candidate, rankKey === 'zhuangyuan' ? '\u72B6\u5143' : rankKey === 'bangyan' ? '\u699C\u773C' : rankKey === 'tanhua' ? '\u63A2\u82B1' : '\u8FDB\u58EB'); return; }

  var exam = P.keju.currentExam;
  var era = P.dynasty || P.era || '';
  var year = GM.year || (P.time && P.time.year) || 1600;
  var rankLbl = rankKey === 'zhuangyuan' ? '\u72B6\u5143' : rankKey === 'bangyan' ? '\u699C\u773C' : rankKey === 'tanhua' ? '\u63A2\u82B1' : '\u8FDB\u58EB';

  var prompt = '\u4F60\u662F' + era + '\u79D1\u4E3E\u8FDB\u58EB\u6863\u6848 AI\u3002\u4E3A\u4EE5\u4E0B\u8003\u751F\u751F\u6210\u5B8C\u6574\u4EBA\u7269\u5361\u3002\n\n' +
    '\u3010\u57FA\u672C\u3011' + JSON.stringify({
      name: candidate.name, age: candidate.age, origin: candidate.origin,
      class: candidate.class, party: candidate.party,
      score: candidate.score, rank: candidate.rank,
      isHistorical: candidate.isHistorical,
      shiliao: candidate.shiliao || null,
      style: candidate.style, personalityHint: candidate.personalityHint,
      timeAnomaly: candidate._timeAnomaly
    }) + '\n' +
    '\u3010\u7B54\u5377\u6458\u8981\u3011' + (candidate.fullAnswer || '').slice(0, 300) + '\n' +
    '\u3010\u5F53\u524D\u65F6\u4EE3\u3011' + era + ' ' + year + ' \u5E74\u3002\n\n' +
    '\u751F\u6210 JSON\uFF0C\u5305\u542B\uFF1A\n' +
    '{\n' +
    '  "appearance": "\u5916\u8C8C 40-80 \u5B57",\n' +
    '  "charisma": 50-90,\n' +
    '  "bio": "\u751F\u5E73 300-600 \u5B57\u00B7\u9700\u5305\u542B\u51FA\u8EAB/\u6C0F\u65CF/\u65E9\u5E74\u6C42\u5B66/\u5E08\u627F/\u4E60\u4E1A\u00B7\u5BF9\u5386\u53F2\u540D\u81E3\u987B\u4E25\u683C\u6309\u53F2\u6599\u00B7\u672B\u6BB5\u5355\u5217\u4E00\u6BB5\u3010\u53F2\u6599\u51FA\u5904\u3011+ shiliao \u539F\u6587",\n' +
    '  "personalGoal": "\u5FD7\u5411 10-30 \u5B57",\n' +
    '  "ambition": 30-85,\n' +
    '  "intelligence": 60-95,\n' +
    '  "administration": 40-90,\n' +
    '  "valor": 20-60,\n' +
    '  "benevolence": 30-85,\n' +
    '  "loyalty": 60-95,\n' +
    '  "integrity": 30-95,\n' +
    '  "wuchang": {"ren":50,"yi":50,"li":50,"zhi":50,"xin":50},\n' +
    '  "family": "\u6C0F\u65CF\u540D (\u5982\u9648\u6C0F)",\n' +
    '  "familyTier": "gentry|common|royal",\n' +
    '  "familyMembers": [{"name":"","relation":"\u7236/\u6BCD/\u914D\u5076/\u5144/\u59D0","living":true,"officialTitle":""}],\n' +
    '  "ancestry": "\u5BB6\u8C31\u6982\u8981 3-5 \u4EE3 80-150 \u5B57",\n' +
    '  "stance": "\u7ACB\u573A 20-40 \u5B57",\n' +
    '  "hobbies": ["\u68CB","\u4E66"],\n' +
    (candidate._timeAnomaly ? '  "timeAnomaly": true\n' : '') +
    '}\n\u53EA\u8F93\u51FA JSON\u3002';

  var attempt = 0;
  while (attempt < 3) {
    attempt++;
    try {
      var raw = await callAISmart(prompt, 3000, { maxRetries: 1 });
      var data = (typeof extractJSON === 'function') ? extractJSON(raw) : null;
      if (!data) data = JSON.parse(raw.replace(/```json|```/g, '').trim());
      if (!data || typeof data !== 'object') throw new Error('\u89E3\u6790\u5931\u8D25');

      // 附加史料出处段（若有）
      var bio = data.bio || '';
      if (candidate.shiliao && bio.indexOf('\u3010\u53F2\u6599\u51FA\u5904\u3011') < 0) {
        bio += '\n\n\u3010\u53F2\u6599\u51FA\u5904\u3011\n' + candidate.shiliao;
      }
      // 演义跨朝代标签
      if (data.timeAnomaly || candidate._timeAnomaly) {
        bio += '\n\n\u3010\u5F02\u4E16\u5947\u7F18\u3011\u6B64\u4EBA\u672C\u4E3A\u5176\u672C\u671D\u4E4B\u4EBA\u00B7\u4E0D\u77E5\u56E0\u4F55\u7F18\u4EFD\u5728\u6B64\u4E16\u4E3A\u58EB\u3002';
      }

      var bonus = P.keju.attributeBonus || {};
      var bonusKey = rankKey || 'erjia';
      var b = bonus[bonusKey] || { fame: 15, virtue: 8 };

      var newChar = {
        id: 'keju_' + Date.now() + '_' + candidate.rank,
        name: candidate.name,
        age: candidate.age || 25,
        gender: '\u7537',
        ethnicity: candidate.ethnicity || '\u6C49',
        origin: candidate.origin,
        birthplace: candidate.origin,
        class: candidate.class || '\u5BD2\u95E8',
        title: rankKey === 'zhuangyuan' ? '\u72B6\u5143' : rankKey === 'bangyan' ? '\u699C\u773C' : rankKey === 'tanhua' ? '\u63A2\u82B1' : '\u8FDB\u58EB',
        // 外貌
        appearance: data.appearance || '',
        charisma: data.charisma || 60,
        // 生平（含史料段）
        bio: bio,
        historicalSource: candidate.shiliao || '',
        // 志向
        personalGoal: data.personalGoal || '',
        ambition: data.ambition || 50,
        // 能力
        intelligence: data.intelligence || 75,
        administration: data.administration || 65,
        valor: data.valor || 30,
        benevolence: data.benevolence || 60,
        loyalty: data.loyalty || 80,
        integrity: data.integrity || 70,
        wuchang: data.wuchang || { ren:60, yi:60, li:60, zhi:60, xin:60 },
        // 身世
        family: data.family || (candidate.name.charAt(0) + '\u6C0F'),
        familyTier: data.familyTier || 'common',
        familyMembers: Array.isArray(data.familyMembers) ? data.familyMembers : [],
        ancestry: data.ancestry || '',
        // 立场/爱好
        stance: data.stance || '',
        partyLean: exam && exam.chiefExaminer ? ((findCharByName(exam.chiefExaminer)||{}).party || '') : '',
        hobbies: Array.isArray(data.hobbies) ? data.hobbies : [],
        // 资源+属性加成
        resources: {
          fame: b.fame || 15,
          virtue: b.virtue || 8,
          health: 80, stress: 0,
          privateWealth: { money:0, grain:0, cloth:0 },
          publicPurse: { money:0, grain:0, cloth:0 }
        },
        // 异常标签
        _timeAnomaly: !!(data.timeAnomaly || candidate._timeAnomaly),
        // 元数据
        alive: true,
        source: '\u79D1\u4E3E',
        recruitTurn: GM.turn,
        isHistorical: !!candidate.isHistorical,
        _memorySeeds: [{
          turn: GM.turn,
          event: '\u6BBE\u8BD5\u53CA\u7B2C\u00B7\u8499' + ((P.playerInfo && P.playerInfo.characterName) || '\u5929\u5B50') + '\u4EB2\u7B56\u4E3A' + (rankKey === 'zhuangyuan' ? '\u72B6\u5143' : rankKey === 'bangyan' ? '\u699C\u773C' : rankKey === 'tanhua' ? '\u63A2\u82B1' : '\u8FDB\u58EB'),
          emotion: '\u656C'
        }]
      };

      if (!GM.chars) GM.chars = [];
      // 去重·避免已存在
      if (!GM.chars.find(function(c){ return c && c.name === newChar.name; })) {
        GM.chars.push(newChar);
      }
      return newChar;
    } catch(e) {
      console.warn('[科举·G2] 第' + attempt + '次生成失败', e);
      if (attempt >= 3) { _kejuBasicRecruit(candidate, rankKey === 'zhuangyuan' ? '\u72B6\u5143' : rankKey === 'bangyan' ? '\u699C\u773C' : rankKey === 'tanhua' ? '\u63A2\u82B1' : '\u8FDB\u58EB'); return; }
    }
  }
}

/** G1·未纳入进士填入 officeTree 空缺 */
function _kejuAllocateGradsToOffices(unsavedGrads) {
  if (!unsavedGrads || !unsavedGrads.length || !GM.officeTree) return;
  var targetTitles = ['\u77E5\u53BF', '\u4E3B\u7C3F', '\u53BF\u4E1E', '\u6559\u8C15', '\u63A8\u5B98', '\u4E3B\u7C3F', '\u5178\u53F2'];
  var vacancies = [];
  function walk(nodes) {
    nodes.forEach(function(n){
      if (!n) return;
      if (n.positions) n.positions.forEach(function(pos){
        if (!pos.holder && pos.name && targetTitles.some(function(t){ return pos.name.indexOf(t) >= 0; })) {
          vacancies.push({ dept: n.name, pos: pos });
        }
      });
      if (n.subs) walk(n.subs);
    });
  }
  walk(GM.officeTree);

  unsavedGrads.forEach(function(g){
    if (vacancies.length === 0) return;
    var v = vacancies.shift();
    v.pos.holder = g.name;
    v.pos.holderSource = '\u79D1\u4E3E\u00B7\u672A\u5177\u8C61';
    v.pos._kejuRank = g.rank;
    v.pos._kejuPoolRef = g._examId;  // 反查
    g.allocatedOffice = v.dept + '/' + v.pos.name;
  });
  if (typeof addEB === 'function') {
    var placed = unsavedGrads.filter(function(g){ return g.allocatedOffice; }).length;
    if (placed > 0) addEB('\u79D1\u4E3E', '\u65B0\u8FDB\u58EB ' + placed + ' \u4EBA\u586B\u5165\u5730\u65B9\u7F3A\u989D');
  }
}

/** G2·阶层+党派+吏治影响 */
function _kejuAggregateGradsEffect(allGrads, exam) {
  if (!allGrads || !allGrads.length) return;
  var total = allGrads.length;

  // 阶层
  var classBreakdown = {};
  allGrads.forEach(function(g){
    var cls = g.class || '\u5BD2\u95E8';
    classBreakdown[cls] = (classBreakdown[cls] || 0) + 1;
  });
  if (GM.classes) {
    Object.keys(classBreakdown).forEach(function(clsName){
      var share = classBreakdown[clsName] / total;
      var match = GM.classes.find(function(cl){ return cl.name === clsName || (cl.name.indexOf(clsName)>=0 || clsName.indexOf(cl.name)>=0); });
      if (match) {
        if (share > 0.4) match.satisfaction = Math.min(100, (match.satisfaction||50) + 3);
        else if (share < 0.15) match.satisfaction = Math.max(0, (match.satisfaction||50) - 2);
      }
    });
  }

  // 党派·主考官党派吸纳 20%
  if (exam && exam.chiefExaminer && GM.parties) {
    var examiner = findCharByName(exam.chiefExaminer);
    if (examiner && examiner.party && examiner.party !== '\u65E0\u515A\u6D3E' && examiner.party !== '\u65E0\u515A') {
      var absorbed = Math.floor(total * 0.20);
      var targetParty = GM.parties.find(function(p){ return p.name === examiner.party; });
      if (targetParty) {
        targetParty.influence = Math.min(100, (targetParty.influence||0) + Math.round(absorbed * 0.5));
        if (typeof addEB === 'function') addEB('\u79D1\u4E3E', examiner.party + ' \u5438\u7EB3\u65B0\u8FDB\u58EB ' + absorbed + ' \u4EBA\u00B7\u5F71\u54CD\u529B +' + Math.round(absorbed*0.5));
      }
    }
  }

  // 吏治·按质量调整
  var avgScore = allGrads.reduce(function(s, g){ return s + (g.score||0); }, 0) / total;
  if (GM.eraState && typeof GM.eraState.bureaucracyStrength === 'number') {
    if (avgScore > 75) GM.eraState.bureaucracyStrength = Math.min(1, GM.eraState.bureaucracyStrength + 0.03);
    else if (avgScore < 50) GM.eraState.bureaucracyStrength = Math.max(0, GM.eraState.bureaucracyStrength - 0.02);
  }
}

/** G2·懒加载具象化（玩家打开该职位详情时调用） */
async function crystallizeKejuGrad(postRef) {
  if (!postRef || !postRef._kejuRank || postRef._crystallized) return;
  // 在 history 中找对应科举记录的 gradPool
  var gradEntry = null;
  (P.keju.history || []).forEach(function(h){
    if (gradEntry) return;
    if (h.gradPool) {
      var g = h.gradPool.find(function(x){ return x.name === postRef.holder; });
      if (g) gradEntry = g;
    }
  });
  // 不在 history 里·从 postRef 本身构造 minimal candidate
  if (!gradEntry) {
    gradEntry = { name: postRef.holder, rank: postRef._kejuRank, class: '\u5BD2\u95E8', age: 25 };
  }
  var rankKey = gradEntry.rank <= 20 ? 'erjia' : 'sanjia';
  await _aiGenerateFullCharacter(gradEntry, rankKey);
  postRef._crystallized = true;
}

// 暴露到 window
if (typeof window !== 'undefined') {
  window.crystallizeKejuGrad = crystallizeKejuGrad;
}

// P7: 科举入仕自动铨选——每回合检查待铨进士，2回合后自动分配到空缺低级职位
function _kejuAutoAssign() {
  if (!GM._kejuPendingAssignment || GM._kejuPendingAssignment.length === 0) return;
  var assigned = [];
  GM._kejuPendingAssignment = GM._kejuPendingAssignment.filter(function(p) {
    // 等待2回合（模拟铨选时间）
    if (GM.turn - p.enrollTurn < 2) return true;
    var ch = typeof findCharByName === 'function' ? findCharByName(p.name) : null;
    if (!ch || ch.alive === false) return false;
    // 已有官职则移除
    if (ch.officialTitle || ch.title) return false;
    // 查找空缺低级职位
    var bestPost = null;
    if (GM.officeTree) {
      (function walk(nodes) {
        nodes.forEach(function(n) {
          if (n.positions) n.positions.forEach(function(pos) {
            if (!pos.holder) {
              var r = parseInt(pos.rank) || 9;
              if (r >= 7 && (!bestPost || r < bestPost.rank)) {
                bestPost = { dept: n.name, pos: pos.name, rank: r, ref: pos };
              }
            }
          });
          if (n.subs) walk(n.subs);
        });
      })(GM.officeTree);
    }
    if (bestPost) {
      bestPost.ref.holder = p.name;
      ch.title = bestPost.pos;
      ch.officialTitle = bestPost.dept + bestPost.pos;
      assigned.push(p.name + '任' + bestPost.dept + bestPost.pos);
      if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.addMemory) {
        NpcMemorySystem.addMemory(p.name, '科举入仕，初授' + bestPost.pos + '，踏上仕途', 7, 'career');
      }
      return false;
    }
    // 无空缺则继续等待，但超过6回合就放弃
    return GM.turn - p.enrollTurn < 6;
  });
  if (assigned.length > 0 && typeof addEB === 'function') {
    var _quanDept2 = (typeof findOfficeByFunction === 'function') ? (findOfficeByFunction('铨选') || findOfficeByFunction('吏')) : null;
    var _deptLabel = (_quanDept2 && _quanDept2.dept) ? _quanDept2.dept : '吏部';
    addEB('铨选', _deptLabel + '铨选：' + assigned.join('；'));
  }
}
if (typeof SettlementPipeline !== 'undefined') {
  SettlementPipeline.register('kejuAutoAssign', '科举铨选', _kejuAutoAssign, 55, 'perturn');
}

/**
 * 关闭科举界面
 */
function closeKejuModal() {
  var modal = document.getElementById('keju-modal');
  if (modal) modal.remove();
}

// ═══════════════════════════════════════════════════════════════════════
//  常朝 2.0——状态机驱动的朝堂流程
//  流程：筹备弹窗 → 开场 → 议程队列循环(7阶段状态机) → 退朝
//  每议程：启奏→奏报→议论(2-3轮)→裁决→回应→延续→结束
// ═══════════════════════════════════════════════════════════════════════

// ─── 阶段 1：朝前筹备弹窗 ───

