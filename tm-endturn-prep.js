// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// tm-endturn-prep.js — 回合前置 (R138 从 原 tm-endturn-prep.js L1699-end 精简)
// 姊妹: tm-ai-planning.js (启动 AI 规划·L1-1698)
//       tm-endturn-ai-infer.js (10k 单函数推演)
//       tm-endturn-core.js (入口)
// 包含: _generateConsortAudiences/_generateConsortLiterary (后妃请见/文苑)·
//       _endTurn_init (回合初始化)·_reactToEdicts (诏令响应)·
//       _endTurn_collectInput (收集输入)
// ============================================================

// ============================================================
//  结束回合（核心推演函数  - 单一版本）
// ============================================================
// ============================================================
// 纪传体叙事系统（借鉴晚唐风云 Chronicle System）
// 月度摘要累积 → 年度正史生成，含跨年记忆
// 适配天命全朝代设计：不硬编码任何朝代信息
// ============================================================
/**
 * 纪传体叙事系统 - 月度摘要累积→年度正史
 * @namespace
 * @property {function(number,string,string):void} addMonthDraft
 * @property {function(number):Object|null} getYearChronicle
 * @property {function():number[]} getAvailableYears
 * @property {function():Object} serialize
 * @property {function(Object):void} deserialize
 */
// ══════ ChronicleSystem 已迁移到 tm-chronicle-system.js (R89) ══════
// - var ChronicleSystem = { monthDrafts, yearChronicles, addMonthDraft, ... }
// ═══════════════════════════════════════════════════════

// ============================================================
// [MODULE: EndTurn] 子步骤函数
// ============================================================

// ============================================================
// 诏令文本自动提取（借鉴 ChongzhenSim appointmentEffects）
// 从玩家诏令中识别"任命X为Y""免去X""赐死X"并返回结构化操作
// ============================================================
/** @param {string} edictText @returns {{appointments:Array, dismissals:Array, deaths:Array}} */
// ══════ §B-1 已迁移到 tm-endturn-edict.js (R88) ══════
// - extractEdictActions / _findPositionInOfficeTree / applyEdictActions
// - extractCustomPolicies / applyCustomPolicies / getCustomPolicyContext
// ═══════════════════════════════════════════════════════

/** Step 0: 初始化 — 重置系统、构建快照 */
/**
 * 后妃请见生成器——每回合按冷落/性格/情感决定概率
 * - 默认情感私下模式（mode:'private'）
 * - 30% 概率附带留宿请求（overnight）
 */
function _generateConsortAudiences() {
  if (!GM.chars) return;
  var consorts = GM.chars.filter(function(c){ return c && c.alive !== false && c.spouse; });
  if (consorts.length === 0) return;
  if (!GM._pendingAudiences) GM._pendingAudiences = [];
  // 已在队列中的不重复加
  var already = {};
  GM._pendingAudiences.forEach(function(q){ if (q && q.isConsort && q.name) already[q.name] = true; });

  consorts.forEach(function(c){
    if (already[c.name]) return;
    // 冷落天数——上次留宿/私见记录
    var lastVisit = c._lastEmperorVisitTurn || 0;
    var neglectTurns = Math.max(0, GM.turn - lastVisit);
    // 基础概率——冷落愈久愈高
    var prob = Math.min(0.6, 0.05 + neglectTurns * 0.06);
    // 高忠诚低压力：主动请见意愿稍高；高压力则频繁请见求慰
    if ((c.stress||0) > 50) prob += 0.1;
    if ((c.loyalty||50) > 80) prob += 0.05;
    // 皇后地位高，主动请见概率略减（更矜持）
    if (c.spouseRank === 'empress') prob *= 0.7;
    // 侍妾身份主动请见概率也低
    if (c.spouseRank === 'attendant') prob *= 0.6;
    // 皇帝荒淫度高——妃嫔主动请见更活跃
    if ((GM._tyrantDecadence||0) > 40) prob += 0.1;
    if (Math.random() > prob) return;
    // 决定情绪基调
    var moods = ['企盼'];
    if (neglectTurns >= 3) moods.push('幽怨','思念','思念');
    if ((c.stress||0) > 60) moods.push('忧惧');
    if (c.children && c.children.length > 0) moods.push('喜悦');
    if ((c.ambition||50) > 70) moods.push('进言');
    // 皇后特有——报告后宫事务（其职责所在，权重较高）
    if (c.spouseRank === 'empress') {
      moods.push('宫务','宫务','宫务');  // 三倍权重，比其他情绪更常出现
    }
    var mood = moods[Math.floor(Math.random()*moods.length)];
    // 留宿概率（按亲密度 + 荒淫度）
    var overnightProb = 0.25 + Math.min(0.3, neglectTurns*0.04) + Math.min(0.2, (GM._tyrantDecadence||0)*0.003);
    if (mood === '幽怨' || mood === '忧惧') overnightProb *= 0.7;
    if (mood === '喜悦' || mood === '思念') overnightProb *= 1.3;
    var requestOvernight = Math.random() < overnightProb;
    // 请见事由
    var reason = (mood === '喜悦' ? '有喜事禀报' : mood === '幽怨' ? '久未蒙幸·心有不平' : mood === '思念' ? '思念陛下·请一叙' : mood === '忧惧' ? '宫中有事相告' : mood === '进言' ? '欲进忠言' : mood === '宫务' ? '奏禀后宫事务' : '请安问候');
    GM._pendingAudiences.push({
      name: c.name, reason: reason, turn: GM.turn,
      isConsort: true, consortMood: mood, requestOvernight: requestOvernight,
      mode: 'private'
    });
    if (typeof addEB === 'function') addEB('\u540E\u5BAB', c.name + '\u8BF7\u89C1\u00B7' + mood + (requestOvernight?'\u00B7\u542B\u7559\u5BBF\u8BF7':''));
  });
}

/**
 * 后妃文苑参与生成器——高学识/智力后妃按概率作诗/词/札记投稿
 * 每回合调用一次，命中则为 GM.culturalWorks 追加作品（若存在），并在史记记录
 * 动机多样：吸引帝注意/发泄闷气/喜爱作文/借物言志/应景
 */
function _generateConsortLiterary() {
  if (!GM.chars) return;
  var spouses = GM.chars.filter(function(c){ return c && c.alive !== false && c.spouse; });
  if (spouses.length === 0) return;
  if (!GM.culturalWorks) GM.culturalWorks = [];
  var scn = typeof findScenarioById === 'function' ? findScenarioById(GM.sid) : null;
  var era = scn && (scn.era || scn.dynasty) || '';

  spouses.forEach(function(c){
    // 参与门槛：智力或学识任一 >= 65
    var intel = c.intelligence || 0;
    var hasLearning = c.learning && /(\u8BD7\u8BCD|\u6587\u5B66|\u7ECF\u5B66|\u5112|\u7406\u5B66|\u4E49\u7406|\u8BE0|\u7FB2)/.test(c.learning);
    if (intel < 65 && !hasLearning) return;
    // 基础概率
    var prob = 0.04 + (intel - 60) * 0.005;  // 智力 65 起约 6.5%，智力 90 起约 19%
    if (hasLearning) prob += 0.08;
    if ((c.stress||0) > 55) prob += 0.05;  // 压力大→发泄作文
    var neglectTurns = Math.max(0, GM.turn - (c._lastEmperorVisitTurn||0));
    if (neglectTurns >= 4) prob += 0.06;     // 冷落久→借文抒怀
    if (c.traitIds && P.traitDefinitions) {
      var tNames = c.traitIds.map(function(id){var d=P.traitDefinitions.find(function(t){return t.id===id;}); return d?d.name:'';}).join('');
      if (/\u7B14|\u6587|\u98A8\u96C5|\u624D\u5973|\u806A\u6167/.test(tNames)) prob += 0.1;
    }
    prob = Math.min(0.3, prob);
    if (Math.random() > prob) return;
    // 决定动机
    var motives = ['随心而作'];
    if (neglectTurns >= 4) { motives.push('借物言志','宫怨独吟','寄意君王'); }
    if ((c.stress||0) > 55) { motives.push('发泄幽绪'); }
    if (intel >= 85 || hasLearning) { motives.push('喜作此事','偶得佳句'); }
    if ((c.ambition||50) > 65) { motives.push('欲邀帝赏','传名宫外'); }
    if (GM._tyrantDecadence && GM._tyrantDecadence > 40) { motives.push('规劝君主'); }
    var motive = motives[Math.floor(Math.random()*motives.length)];
    // 体裁
    var genres = ['诗','词','札记','小令','赋'];
    if (/\u7ECF|\u4E49\u7406/.test(c.learning||'')) genres.push('笺释');
    var genre = genres[Math.floor(Math.random()*genres.length)];
    // 风格标签按情绪
    var mood = motive.indexOf('宫怨') >= 0 || motive.indexOf('幽') >= 0 ? '\u5E7D\u6028'
             : motive.indexOf('邀') >= 0 ? '\u7F20\u7EF5'
             : motive.indexOf('规') >= 0 ? '\u89C4\u52B8'
             : motive.indexOf('发泄') >= 0 ? '\u6115\u5F85'
             : '\u6E05\u96C5';
    var work = {
      id: 'cw_consort_' + Date.now() + '_' + Math.random().toString(36).slice(2,6),
      author: c.name,
      authorRole: c.spouseRank || 'consort',
      authorIsSpouse: true,
      title: '',  // AI 下回合可补
      genre: genre,
      subtype: genre,
      mood: mood,
      motive: motive,
      preview: '',  // AI 下回合可补
      turn: GM.turn,
      date: (typeof getTSText === 'function') ? getTSText(GM.turn) : '',
      era: era,
      _pendingAIComplete: true  // 标记·下回合 AI 据此生成题名和首句
    };
    GM.culturalWorks.push(work);
    if (typeof addEB === 'function') addEB('\u6587\u82D1', c.name + '\u4F5C\u300A' + genre + '\u300B\u4E00\u9996\u00B7' + motive);
    // 若是吸引帝意或规劝，标记以便 AI 让皇帝可能读到
    if (motive.indexOf('邀') >= 0 || motive.indexOf('寄意') >= 0 || motive.indexOf('规劝') >= 0) {
      if (!GM._consortPendingLiteraryForEmperor) GM._consortPendingLiteraryForEmperor = [];
      GM._consortPendingLiteraryForEmperor.push({ name: c.name, workId: work.id, motive: motive, turn: GM.turn });
    }
  });
}

function _endTurn_init() {
  _dbg('========== 回合结算开始 (T' + GM.turn + ') ==========');
  // 快照本回合结算前的经济/户口状态（供 _renderUnifiedChanges 显示增减）
  try {
    GM._prevGuoku      = GM.guoku      ? JSON.parse(JSON.stringify(GM.guoku))      : null;
    GM._prevNeitang    = GM.neitang    ? JSON.parse(JSON.stringify(GM.neitang))    : null;
    GM._prevPopulation = GM.population ? JSON.parse(JSON.stringify(GM.population)) : null;
  } catch(_snapE) { console.warn('[endTurn] snapshot failed:', _snapE); }
  // RNG检查点（支持存档重放）
  if (typeof checkpointRng === 'function') checkpointRng();
  // 角色完整字段守卫（回合中若有新角色产生，下一回合始端补齐）
  try {
    if (typeof CharFullSchema !== 'undefined' && typeof CharFullSchema.ensureAll === 'function' && Array.isArray(GM.chars)) {
      CharFullSchema.ensureAll(GM.chars);
    }
  } catch(e) { console.error('[endTurn_init] CharFullSchema.ensureAll 失败:', e); }
  // 清空本回合机械结算暂存
  GM._turnBattleResults = [];
  GM._turnRebellionResults = [];
  GM._turnSiegeResults = [];
  GM._turnSchemeResults = [];
  AccountingSystem.resetLedger();
  var queueStats = ChangeQueue.getStats();
  _dbg('[endTurn] 变动队列状态:', queueStats);
  _dbg('[endTurn] 构建 NpcContext 快照...');
  var npcContext = buildNpcContext();
  _dbg('[endTurn] NpcContext 快照构建完成:', {
    characterCount: npcContext.characters.length,
    factionCount: npcContext.factions.length,
    variableCount: Object.keys(npcContext.variables).length,
    cacheSize: Object.keys(npcContext.cache).length
  });
  return npcContext;
}

/** NPC 对玩家诏令的即时反应 */
function _reactToEdicts(actions) {
  if (!GM.chars) return;

  // 任命反应：同势力/同党派的竞争者可能嫉妒
  actions.appointments.forEach(function(a) {
    var appointed = findCharByName(a.character);
    if (!appointed) return;
    GM.chars.forEach(function(rival) {
      if (rival.name === a.character || rival.isPlayer || rival.alive === false) return;
      // 同势力且野心高的角色嫉妒
      if (rival.faction && rival.faction === appointed.faction && (rival.ambition || 50) > 65) {
        rival.loyalty = Math.max(0, (rival.loyalty || 50) - 3);
        if (typeof AffinityMap !== 'undefined') AffinityMap.add(rival.name, a.character, -5, '嫉妒其升迁');
        if (typeof StressSystem !== 'undefined') StressSystem.checkStress(rival, '屈居人下');
      }
      // 对立势力的角色可能不满
      if (rival.faction && rival.faction !== appointed.faction && (rival.loyalty || 50) < 40) {
        rival.loyalty = Math.max(0, (rival.loyalty || 50) - 2);
      }
    });
  });

  // 赐死反应：死者同党派/同势力的人忠诚下降
  actions.deaths.forEach(function(a) {
    var dead = findCharByName(a.character);
    if (!dead) return;
    GM.chars.forEach(function(c) {
      if (c.name === a.character || c.isPlayer || c.alive === false) return;
      if (c.faction && dead.faction && c.faction === dead.faction) {
        c.loyalty = Math.max(0, (c.loyalty || 50) - 5);
        if (typeof StressSystem !== 'undefined') StressSystem.checkStress(c, '同僚被诛');
      }
    });
  });
}

// ============================================================
// 2.3: 执行率情境分析（仅供AI prompt参考，不做机械折扣）
// 分析官僚体系各层级的执行能力，注入AI prompt让AI自行判断执行程度
// 阶段数和结构由 P.mechanicsConfig.executionPipeline 定义（编辑器可配）
// ============================================================
// ══════ §B-2 已迁移到 tm-endturn-edict.js (R88) ══════
// - computeExecutionPipeline / processEdictEffects
// ═══════════════════════════════════════════════════════

/** Step 1: 收集玩家输入 */
function _endTurn_collectInput() {
  var edicts={political:(_$("edict-pol")?_$("edict-pol").value:"").trim(),military:(_$("edict-mil")?_$("edict-mil").value:"").trim(),diplomatic:(_$("edict-dip")?_$("edict-dip").value:"").trim(),economic:(_$("edict-eco")?_$("edict-eco").value:"").trim(),other:(_$("edict-oth")?_$("edict-oth").value:"").trim()};
  // 记录玩家决策
  if (edicts.political) recordPlayerDecision('edict', '政令:' + edicts.political.substring(0, 80));
  if (edicts.military) recordPlayerDecision('edict', '军令:' + edicts.military.substring(0, 80));
  if (edicts.diplomatic) recordPlayerDecision('edict', '外交:' + edicts.diplomatic.substring(0, 80));
  if (edicts.economic) recordPlayerDecision('edict', '经济:' + edicts.economic.substring(0, 80));
  // 1.1: 诏令执行追踪——记录本回合所有诏令·同 content 未完成诏令去重
  if (!GM._edictTracker) GM._edictTracker = [];
  var _edictCats = [{key:'political',label:'政令'},{key:'military',label:'军令'},{key:'diplomatic',label:'外交'},{key:'economic',label:'经济'},{key:'other',label:'其他'}];
  _edictCats.forEach(function(cat) {
    if (!edicts[cat.key]) return;
    var _content = edicts[cat.key];
    var _dup = GM._edictTracker.some(function(t) {
      if (!t || t.content !== _content) return false;
      return t.status === 'pending' || t.status === 'executing' || t.status === 'partial' || t.status === 'obstructed' || t.status === 'pending_delivery';
    });
    if (!_dup) {
      GM._edictTracker.push({ id: uid(), content: _content, category: cat.label, turn: GM.turn, status: 'pending', assignee: '', feedback: '', progressPercent: 0 });
    }
  });
  // 清理超过10回合的旧追踪记录
  // 保留：本回合全部 + 未完成诏令（跨回合追踪·无年限）+ 已完成/受阻者 24 回合
  GM._edictTracker = GM._edictTracker.filter(function(e) {
    if (e.turn === GM.turn) return true;  // 本回合全部保留
    if (e.status === 'executing' || e.status === 'pending' || e.status === 'partial' || e.status === 'obstructed' || e.status === 'pending_delivery') return true;
    return GM.turn - e.turn < 24;  // 已完成/失败·保留两年
  });

  // 1.15: 跨势力识别——检测诏令目标中的非玩家势力（人/势力名）
  // 若涉及，标记为外交文书·AI 须以外交方式处理（对方可接受/拒绝/敷衍/反击）
  var _playerFac = (P.playerInfo && P.playerInfo.factionName) || '';
  var _allFactions = (GM.facs || []).filter(function(f){ return f && f.name && f.name !== _playerFac; });
  GM._edictTracker.forEach(function(et) {
    if (et.turn !== GM.turn || et._crossFactionChecked) return;
    et._crossFactionChecked = true;
    var _targetFacs = [], _targetNpcs = [];
    // 1) 势力名命中
    _allFactions.forEach(function(f) {
      var _nm = f.name || '';
      if (!_nm) return;
      if (et.content.indexOf(_nm) >= 0) _targetFacs.push(_nm);
      // alias/variant 检测（略·仅首名命中即可）
    });
    // 2) 非玩家势力人物名命中
    (GM.chars||[]).forEach(function(c) {
      if (c.alive === false || c.isPlayer) return;
      if (!c.name || c.name.length < 2) return;
      if (c.faction && c.faction !== _playerFac && et.content.indexOf(c.name) >= 0) {
        _targetNpcs.push({ name: c.name, faction: c.faction });
        if (_targetFacs.indexOf(c.faction) < 0) _targetFacs.push(c.faction);
      }
    });
    if (_targetFacs.length > 0) {
      et._crossFaction = true;
      et._targetFactions = _targetFacs;
      et._targetNpcs = _targetNpcs.map(function(t){ return t.name; });
      et._diplomaticMsg = true; // 标志此条为外交文书
      et.category = (et.category === '外交' ? '外交文书' : (et.category + '·外交文书'));
    }
  });

  // 1.2: 诏令分流——检测涉及远方NPC的诏令，自动转为信件传递
  var _capital = GM._capital || '京城';
  GM._edictTracker.forEach(function(et) {
    if (et.turn !== GM.turn || et._deliveryChecked) return;
    et._deliveryChecked = true;
    // 扫描诏令文本中提及的NPC名
    var _remoteTargets = [];
    (GM.chars||[]).forEach(function(c) {
      if (c.alive === false || c.isPlayer) return;
      if (c.location && c.location !== _capital && et.content.indexOf(c.name) >= 0) {
        _remoteTargets.push(c);
      }
    });
    if (_remoteTargets.length > 0) {
      // 此诏令涉及远方NPC——标记为待送达，生成信件
      et._remoteTargets = _remoteTargets.map(function(c){ return c.name; });
      et._deliveryStatus = 'sending'; // sending/delivered/lost
      et._letterIds = [];
      // 跨势力诏令·letterType 为外交文书·否则走原路径
      var _ltType = et._crossFaction ? 'diplomatic_dispatch' :
                    (et.category === '军令' ? 'military_order' : 'formal_edict');
      var _urgency = et.category === '军令' ? 'urgent' : 'normal';
      _remoteTargets.forEach(function(ch) {
        var toLoc = ch.location || _capital;
        var days = (typeof calcLetterDays === 'function') ? calcLetterDays(_capital, toLoc, _urgency) : 5;
        var dpv = (typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : 15;
        var deliveryTurns = Math.max(1, Math.ceil(days / dpv));
        var letter = {
          id: (typeof uid === 'function') ? uid() : 'lt_' + Date.now() + '_' + Math.random(),
          from: '玩家', to: ch.name,
          fromLocation: _capital, toLocation: toLoc,
          content: '【' + et.category + '】' + et.content,
          sentTurn: GM.turn,
          deliveryTurn: GM.turn + deliveryTurns,
          replyTurn: GM.turn + deliveryTurns + Math.max(1, Math.ceil(days / dpv)),
          reply: '', status: 'traveling',
          urgency: _urgency,
          letterType: _ltType,
          _edictId: et.id, // 关联诏令
          _autoFromEdict: true // 标记为诏令自动生成
        };
        if (!GM.letters) GM.letters = [];
        GM.letters.push(letter);
        et._letterIds.push(letter.id);
        if (typeof addEB === 'function') addEB('诏令传书', '诏令「' + et.content.slice(0,20) + '…」已遣使致' + ch.name + '（' + toLoc + '）');
      });
    } else {
      // 诏令目标全部在京城，立即可执行
      et._deliveryStatus = 'local';
    }
  });

  // 主角行止（单一输入框）
  var xinglu = (_$("xinglu-pub") ? _$("xinglu-pub").value : "").trim() || (_$("xinglu") ? _$("xinglu").value : "").trim();
  // 行止记入玩家角色记忆
  if (xinglu && typeof NpcMemorySystem !== 'undefined' && P.playerInfo && P.playerInfo.characterName) {
    NpcMemorySystem.remember(P.playerInfo.characterName, xinglu, '\u5E73', 5);
  }
  var memRes=GM.memorials.map(function(m){return{from:m.from,type:m.type,status:m.status,reply:m.reply};});
  // 判定本回合 edicts 来源：已颁行润色稿 / 玩家原文（不含润色）
  var _thisTurnPromulgated = (GM.edicts||[]).filter(function(e){ return e && typeof e === 'object' && e.turn === GM.turn && e.status === 'promulgated'; });
  var _edictsSource = _thisTurnPromulgated.length > 0 ? 'promulgated' : 'original';
  GM.qijuHistory.push({turn:GM.turn,time:getTSText(GM.turn),edicts:edicts,xinglu:xinglu,memorials:memRes,edictsSource:_edictsSource});
  resetTurnChanges();
  // 注意：不在此处清空 _couplingReport/_edictExecutionReport/_buildingOutputReport/_npcIntents/_healthAlerts/_decisionAlerts
  // 这些字段由上一回合的 SettlementPipeline 设置，在本回合 AI prompt 中读取（"上回合发生了什么"）
  // 它们会在本回合的 SettlementPipeline 中被覆盖为新值
  var oldVars={};Object.entries(GM.vars).forEach(function(e){oldVars[e[0]]=e[1].value;});
  var input = {edicts:edicts,xinglu:xinglu,memRes:memRes,oldVars:oldVars,edictActions:null};
  // 宰相建议（供 AI prompt 参考）
  var chancellorSuggestions = generateChancellorSuggestions();
  if (chancellorSuggestions.length > 0) {
    input.suggestions = chancellorSuggestions;
  }

  // 从诏令文本中提取结构化操作（记录供AI推演参考，由AI决定执行效果）
  var allEdictText = [edicts.political, edicts.military, edicts.diplomatic, edicts.economic, edicts.other].join(' ');

  // 2.2→2.3: 收集执行管线信息注入AI prompt（不做机械效果，效果完全由AI判断）
  if (typeof processEdictEffects === 'function' && allEdictText.trim()) {
    var _edictCategory = edicts.political ? '政令' : edicts.military ? '军令' : edicts.diplomatic ? '外交' : edicts.economic ? '经济' : '';
    processEdictEffects(allEdictText, _edictCategory);
  }

  var edictActions = extractEdictActions(allEdictText);
  // 跨势力过滤：对非玩家势力 NPC 的任命/免职/赐死改为外交意图·不做内政执行
  var _pFacDip = (P.playerInfo && P.playerInfo.factionName) || '';
  ['appointments','dismissals','deaths'].forEach(function(k) {
    if (!Array.isArray(edictActions[k])) return;
    edictActions[k] = edictActions[k].filter(function(a) {
      var nm = a.character || a.name || '';
      if (!nm) return true;
      var ch = (typeof findCharByName === 'function') ? findCharByName(nm) : null;
      if (!ch || ch.isPlayer) return true;
      if (ch.faction && ch.faction !== _pFacDip) {
        var _opLabel = k === 'appointments' ? '\u4EFB\u547D' : k === 'dismissals' ? '\u7F62\u9EDC' : '\u8D50\u6B7B';
        if (typeof addEB === 'function') addEB('\u5916\u4EA4\u6587\u4E66', '\u5BF9' + ch.faction + '\u2022' + nm + '\u4E4B' + _opLabel + '\u00B7\u975E\u5185\u653F\u8BCF\u4EE4\u00B7\u7531AI\u63A8\u6F14\u88C1\u5B9A');
        return false;
      }
      return true;
    });
  });
  // 不再在AI推演前直接执行——改为将操作意图传给AI，由AI在推演中决定结果
  // AI推演后，npc_actions中会包含对这些操作的执行/抵制/变通
  if (edictActions.appointments.length || edictActions.dismissals.length || edictActions.deaths.length) {
    // 仅记录到事件日志供AI读取，不直接执行
    edictActions.appointments.forEach(function(a) { addEB('诏令意图', '欲任命' + a.character + '为' + a.position); });
    edictActions.dismissals.forEach(function(a) { addEB('诏令意图', '欲免职' + a.character); });
    edictActions.deaths.forEach(function(a) { addEB('诏令意图', '欲赐死' + a.character); });
  }

  // 从诏令中提取并存储自定义国策
  var customPols = extractCustomPolicies(allEdictText);
  if (customPols.length > 0) applyCustomPolicies(customPols);

  // NPC 对玩家诏令的即时反应（在 AI 推演前执行，让 AI 看到反应）
  if (edictActions.appointments.length > 0 || edictActions.dismissals.length > 0 || edictActions.deaths.length > 0) {
    _reactToEdicts(edictActions);
  }
  input.edictActions = edictActions;

  // 收集昏君活动
  if (typeof TyrantActivitySystem !== 'undefined') {
    input.tyrantActivities = TyrantActivitySystem.collectActivities();
  }

  // 勤政之苦 vs 怠政之乐——核心机制
  var _virtuousKeywords = /改革|整饬|肃清|减税|轻赋|赈灾|兴修|操练|整顿|巡查|督办|革弊|惩贪|开仓|抚民|科举|选贤|严查|问责|清查/;
  var _edictWordCount = allEdictText.length;
  if (P.playerInfo && P.playerInfo.characterName) {
    var _pCh = findCharByName(P.playerInfo.characterName);
    if (_pCh) {
      if (_edictWordCount > 30 && _virtuousKeywords.test(allEdictText)) {
        // 写了大量勤政诏令→压力增加（操心的代价）
        var _stressGain = Math.min(8, Math.floor(_edictWordCount / 30));
        _pCh.stress = clamp((_pCh.stress || 0) + _stressGain, 0, 100);
        _dbg('[勤政之苦] 诏令' + _edictWordCount + '字，压力+' + _stressGain);
      } else if (_edictWordCount < 5 && (!input.tyrantActivities || input.tyrantActivities.length === 0)) {
        // 什么都没做→轻微减压（偷懒的快乐）
        if ((_pCh.stress || 0) > 5) {
          _pCh.stress = clamp((_pCh.stress || 0) - 3, 0, 100);
          _dbg('[怠政之乐] 无所事事，压力-3');
        }
      }
    }
  }

  // 检测私人行动中的后宫互动——可能触发怀孕
  // 行止已统一为单输入框(xinglu-pub/xinglu)，不再区分public/private——直接扫描xinglu全文
  if (xinglu && GM.chars && typeof HaremSettlement !== 'undefined') {
    var _visitPattern = /幸(\S{1,4})|宠幸(\S{1,4})|召(\S{1,4})侍寝|与(\S{1,4})共度/;
    var _visitMatch = xinglu.match(_visitPattern);
    if (_visitMatch) {
      var _visitName = _visitMatch[1] || _visitMatch[2] || _visitMatch[3] || _visitMatch[4];
      var _visitCh = findCharByName(_visitName);
      if (_visitCh && _visitCh.spouse && _visitCh.alive !== false) {
        // 增加亲疏度
        if (typeof AffinityMap !== 'undefined' && P.playerInfo) {
          AffinityMap.add(P.playerInfo.characterName, _visitCh.name, 5, '\u5BA0\u5E78');
          // 其他妃嫔的嫉妒
          GM.chars.forEach(function(other) {
            if (other.spouse && other.alive !== false && other.name !== _visitCh.name) {
              AffinityMap.add(other.name, _visitCh.name, -3, '\u5AC9\u5992');
              if ((other.loyalty || 50) < 50) AffinityMap.add(other.name, P.playerInfo.characterName, -2, '\u88AB\u51B7\u843D');
            }
          });
        }
        // 小概率触发怀孕（未在孕期中）
        var _alreadyPreg = GM.harem && GM.harem.pregnancies && GM.harem.pregnancies.find(function(p) { return p.motherName === _visitCh.name; });
        if (!_alreadyPreg && random() < 0.15) {
          HaremSettlement.registerPregnancy(_visitCh.name);
        }
      }
    }
  }

  return input;
}

/** Step 2: AI 推演 — 调用 AI 生成时政记/正文/数值变化 */
