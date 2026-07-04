// @ts-check
/* ═══════════════════════════════════════════════════════════════════════
 *  tm-npc-decision-ai-driven.js — NPC 行为系统·AI 驱动批量推演（2026-07-04 立项拆分·自 tm-npc-decision.js 保序切出）
 *  内容：主 NPC 行为推演入口(endTurn 批量)/AI 提示词构建/结果应用/request_funds 等
 *  尾段零装载期执行语句(已核)·全局名跨文件解析
 *  加载序：index.html 中紧挨 tm-npc-decision.js 之后——执行顺序与拆分前逐字节等价·勿改
 * ═══════════════════════════════════════════════════════════════════════ */
// ============================================================
// NPC 行为系统 - AI 驱动
// ============================================================

/** 主NPC行为推演入口（endTurn中调用）— 批量化版本 */
/**
 * 校验 NPC 行为是否与性格特质一致
 * @param {Object} npc - 角色
 * @param {Object} decision - 决策
 * @returns {boolean} true=一致可执行，false=矛盾应阻止
 */
function _validatePersonalityConsistency(npc, decision) {
  if (!npc.traitIds || !P.traitDefinitions || !decision.behaviorType) return true;
  var bt = decision.behaviorType;

  // 构建人格维度总和
  var dims = {};
  npc.traitIds.forEach(function(tid) {
    var def = P.traitDefinitions.find(function(t) { return t.id === tid; });
    if (!def || !def.dims) return;
    Object.keys(def.dims).forEach(function(k) { dims[k] = (dims[k] || 0) + def.dims[k]; });
  });

  // 校验规则
  // 怯懦者（boldness < -0.3）不应主动宣战
  if (bt === 'declare_war' && (dims.boldness || 0) < -0.3) {
    _dbg('[NPC Validate] ' + npc.name + ' boldness=' + (dims.boldness||0).toFixed(2) + ' 太低，阻止宣战');
    return false;
  }
  // 仁慈者（compassion > 0.3）不应主动惩罚
  if (bt === 'punish' && (dims.compassion || 0) > 0.3) {
    _dbg('[NPC Validate] ' + npc.name + ' compassion=' + (dims.compassion||0).toFixed(2) + ' 太高，阻止惩罚');
    return false;
  }
  // 忠诚者（honor > 0.3 且 loyalty > 70）不应叛变/宣战领主
  if (bt === 'declare_war' && (dims.honor || 0) > 0.3 && (npc.loyalty || 50) > 70) {
    _dbg('[NPC Validate] ' + npc.name + ' honor高且忠诚，阻止对领主宣战');
    return false;
  }
  // 懒惰者（energy < -0.2）不应主动改革
  if (bt === 'reform' && (dims.energy || 0) < -0.2) {
    _dbg('[NPC Validate] ' + npc.name + ' energy太低，阻止主动改革');
    return false;
  }
  // 贪婪者（greed > 0.3）不应主动赏赐
  if (bt === 'reward' && (dims.greed || 0) > 0.3) {
    _dbg('[NPC Validate] ' + npc.name + ' greed太高，阻止主动赏赐');
    return false;
  }

  return true; // 默认通过
}

function _normalizeNpcBehaviorType(type) {
  var raw = String(type == null ? '' : type).trim();
  if (!raw) return 'none';
  var key = raw.replace(/[\s-]+/g, '_');
  var map = {
    declareWar: 'declare_war',
    declare_war: 'declare_war',
    requestLoyalty: 'request_loyalty',
    request_loyalty: 'request_loyalty',
    trainTroops: 'train_troops',
    train_troops: 'train_troops',
    sendLetter: 'send_letter',
    send_letter: 'send_letter',
    privateCorrespondence: 'private_correspondence',
    private_correspondence: 'private_correspondence',
    npcCorrespondence: 'private_correspondence',
    npc_correspondence: 'private_correspondence',
    seekAudience: 'seek_audience',
    seek_audience: 'seek_audience',
    requestFunds: 'request_funds',
    request_funds: 'request_funds',
    buildNetwork: 'build_network',
    build_network: 'build_network',
    developLocal: 'develop_local',
    develop_local: 'develop_local',
    officeDuty: 'office_duty',
    office_duty: 'office_duty',
    privateLife: 'private_life',
    private_life: 'private_life',
    palaceIntrigue: 'palace_intrigue',
    palace_intrigue: 'palace_intrigue',
    courtPolitics: 'court_politics',
    court_politics: 'court_politics',
    giftPresent: 'gift_present',
    gift_present: 'gift_present',
    none: 'none'
  };
  return map[raw] || map[key] || key;
}

function _normalizeNpcDecision(raw, fallbackName, context) {
  if (!raw) return null;
  var rawBehaviorType = raw.behaviorType || raw.behavior_type || raw.action_type || raw.type;
  var behaviorType = _normalizeNpcBehaviorType(rawBehaviorType);
  var decision = {};
  Object.keys(raw).forEach(function(k) { decision[k] = raw[k]; });
  decision.name = raw.name || raw.actor || raw.character || raw.npc || fallbackName || '';
  var candidate = null;
  if ((!rawBehaviorType || behaviorType === 'none') && raw.actionId && decision.name) {
    candidate = _resolveNpcActionCandidate(raw, findCharByName(decision.name), context);
    if (candidate) behaviorType = candidate.behaviorType;
  }
  decision.behaviorType = behaviorType;
  decision.target = raw.target || raw.to || raw.object || raw.targetName || (candidate && candidate.target) || '';
  decision.intent = raw.intent || raw.action || raw.description || raw.reason || raw.reasoning || raw.publicReason || (candidate && candidate.intent) || behaviorType;
  decision.actionId = raw.actionId || raw.cardId || (candidate && candidate.id) || decision.actionId || '';
  if (candidate) {
    decision.abilityFit = candidate.abilityFit;
    decision.wuchangFit = candidate.wuchangFit;
    decision.economyFit = candidate.economyFit;
    decision.familyFit = candidate.familyFit;
    decision.tierFit = candidate.tierFit;
    decision.actionScore = candidate.score;
    decision.motive = decision.motive || candidate.motive || '';
  } else {
    if (raw.abilityFit != null) decision.abilityFit = Number(raw.abilityFit) || 0;
    if (raw.wuchangFit != null) decision.wuchangFit = Number(raw.wuchangFit) || 0;
    if (raw.economyFit != null) decision.economyFit = Number(raw.economyFit) || 0;
    if (raw.familyFit != null) decision.familyFit = Number(raw.familyFit) || 0;
    if (raw.tierFit != null) decision.tierFit = Number(raw.tierFit) || 0;
  }
  if (typeof raw.shouldExecute === 'boolean') {
    decision.shouldExecute = raw.shouldExecute;
  } else {
    decision.shouldExecute = behaviorType !== 'none' && !!NpcBehaviorRegistry._behaviors[behaviorType];
  }
  return decision;
}

function _getNpcDecisionHandledNames() {
  if (typeof TM !== 'undefined' && TM.NPC && TM.NPC.ActionLedger && TM.NPC.ActionLedger.getHandledNames) {
    return TM.NPC.ActionLedger.getHandledNames(GM);
  }
  if (!GM._turnContext) GM._turnContext = {};
  if (!Array.isArray(GM._turnContext.npcActionsThisTurn)) GM._turnContext.npcActionsThisTurn = [];
  return GM._turnContext.npcActionsThisTurn;
}

function _markNpcDecisionHandled(name) {
  if (!name) return;
  if (typeof TM !== 'undefined' && TM.NPC && TM.NPC.ActionLedger && TM.NPC.ActionLedger.markHandled) {
    TM.NPC.ActionLedger.markHandled(name, GM);
    return;
  }
  var handled = _getNpcDecisionHandledNames();
  if (handled.indexOf(name) < 0) handled.push(name);
}

function _recordNpcDecisionDiagnostic(raw, status, reason) {
  raw = raw || {};
  if (typeof TM !== 'undefined' && TM.NPC && TM.NPC.ActionLedger && TM.NPC.ActionLedger.recordConsideration) {
    return TM.NPC.ActionLedger.recordConsideration({
      actor: raw.actor || raw.name,
      behaviorType: raw.behaviorType || raw.type,
      target: raw.target || raw.to || '',
      status: status || raw.status || 'considered',
      reason: reason || raw.reason || raw.intent || raw.action || '',
      score: raw.score,
      motive: raw.motive,
      source: raw.source || 'npc-autonomy'
    }, { GM: GM });
  }
  if (!Array.isArray(GM._npcDecisionDiagnostics)) GM._npcDecisionDiagnostics = [];
  GM._npcDecisionDiagnostics.push({
    turn: GM.turn || 0,
    actor: raw.actor || raw.name || '',
    behaviorType: raw.behaviorType || raw.type || '',
    target: raw.target || raw.to || '',
    status: status || 'considered',
    reason: reason || raw.reason || raw.intent || raw.action || '',
    source: raw.source || 'npc-autonomy'
  });
  if (GM._npcDecisionDiagnostics.length > 240) GM._npcDecisionDiagnostics.splice(0, GM._npcDecisionDiagnostics.length - 240);
  return GM._npcDecisionDiagnostics[GM._npcDecisionDiagnostics.length - 1];
}

function _isNpcIdleBehaviorAllowed(type) {
  var allowed = {
    petition: true,
    recommend: true,
    impeach: true,
    conspire: true,
    build_network: true,
    train_troops: true,
    patrol: true,
    fortify: true,
    send_letter: true,
    private_correspondence: true,
    seek_audience: true,
    request_funds: true,
    develop_local: true,
    relief: true,
    office_duty: true,
    private_life: true,
    palace_intrigue: true,
    court_politics: true,
    obstruct: true,
    slander: true,
    none: true
  };
  return !!allowed[type];
}

function _executeNormalizedNpcDecision(rawDecision, fallbackNpc, context, options) {
  options = options || {};
  var decision = _normalizeNpcDecision(rawDecision, fallbackNpc && fallbackNpc.name, context);
  if (!decision || !decision.name || !decision.shouldExecute || decision.behaviorType === 'none') {
    _recordNpcDecisionDiagnostic(decision || rawDecision || {}, 'skipped', 'no executable decision');
    return false;
  }
  if (options.idle && !_isNpcIdleBehaviorAllowed(decision.behaviorType)) {
    _recordNpcDecisionDiagnostic(decision, 'skipped', 'idle autonomy blocks major action');
    return false;
  }
  if (!NpcBehaviorRegistry._behaviors[decision.behaviorType]) {
    _recordNpcDecisionDiagnostic(decision, 'skipped', 'unregistered behavior');
    return false;
  }
  var npc = fallbackNpc && fallbackNpc.name === decision.name ? fallbackNpc : findCharByName(decision.name);
  if (!npc) {
    _recordNpcDecisionDiagnostic(decision, 'blocked', 'unknown actor');
    return false;
  }
  if (typeof TM !== 'undefined' && TM.NPC && TM.NPC.ActionLedger && TM.NPC.ActionLedger.preflight) {
    var pf = TM.NPC.ActionLedger.preflight({
      actor: npc.name,
      behaviorType: decision.behaviorType,
      target: decision.target || '',
      source: 'npc-autonomy'
    }, GM);
    if (!pf.ok) {
      _recordNpcDecisionDiagnostic(decision, 'blocked', pf.errors.join(','));
      return false;
    }
  } else if (npc.alive === false || npc.isPlayer) {
    _recordNpcDecisionDiagnostic(decision, 'blocked', npc.alive === false ? 'dead actor' : 'player actor');
    return false;
  }
  if (!_validatePersonalityConsistency(npc, decision)) {
    _dbg('[NPC] ' + npc.name + ' 行为 ' + decision.behaviorType + ' 与性格矛盾，降级为观望');
    _recordNpcDecisionDiagnostic(decision, 'skipped', 'personality mismatch');
    return false;
  }
  if (_isNpcActionCoolingDown(npc, decision.behaviorType, decision.target, context, decision.actionId)) {
    _dbg('[NPC] ' + npc.name + ' 行为 ' + decision.behaviorType + ' 正在冷却，跳过重复执行');
    _recordNpcDecisionDiagnostic(decision, 'skipped', 'cooldown');
    return false;
  }
  _npcEnsureExecutionFactors(npc, decision.behaviorType, context, decision);
  NpcBehaviorRegistry.execute(npc, decision, context);
  if (!decision._executionResult) {
    _npcPushExecutionResult(npc, decision, { outcome: 'applied' });
  }
  _recordNpcActionLedger(npc, decision);
  addEB('NPC行为', npc.name + '：' + decision.intent);
  _recordNpcDecisionDiagnostic(decision, 'executed', decision.intent || decision.behaviorType);
  _markNpcDecisionHandled(npc.name);
  return true;
}

function _getNpcIdleAutonomyConfig(opts) {
  opts = opts || {};
  var conf = (typeof P !== 'undefined' && P && P.conf) ? P.conf : {};
  var delayMs = Number(opts.delayMs != null ? opts.delayMs : conf.npcIdleAutonomyDelayMs);
  if (!isFinite(delayMs) || delayMs <= 0) delayMs = 30000;
  var maxRounds = Number(opts.maxRounds != null ? opts.maxRounds : conf.npcIdleAutonomyMaxRounds);
  if (!isFinite(maxRounds) || maxRounds < 0) maxRounds = 3;
  var maxTokens = Number(opts.maxTokens != null ? opts.maxTokens : conf.npcIdleAutonomyMaxTokens);
  if (!isFinite(maxTokens) || maxTokens <= 0) maxTokens = 1400;
  return {
    enabled: opts.enabled !== false && conf.npcIdleAutonomy !== false,
    delayMs: delayMs,
    maxRounds: Math.floor(maxRounds),
    maxTokens: Math.floor(maxTokens)
  };
}

function _cancelNpcIdleAutonomyLoop(reason) {
  try {
    if (!GM || !GM._npcIdleAutonomy) return false;
    var state = GM._npcIdleAutonomy;
    state.stopped = true;
    state.stopReason = reason || 'cancelled';
    if (state.timerId) {
      clearTimeout(state.timerId);
      state.timerId = null;
    }
    return true;
  } catch(_) {
    return false;
  }
}

function _canRunNpcIdleAutonomy(state) {
  if (!state || state.stopped) return false;
  if (typeof P === 'undefined' || !P || !P.ai || !P.ai.key) return false;
  if (typeof GM === 'undefined' || !GM || !GM.running) return false;
  if (GM.turn !== state.turn) return false;
  if (GM.busy || GM._endTurnBusy) return false;
  if (state.running) return false;
  if (state.rounds >= state.maxRounds) return false;
  return true;
}

function _queueNpcIdleAutonomyNext(state) {
  if (!state || state.stopped) return false;
  if (state.rounds >= state.maxRounds) {
    state.stopped = true;
    state.stopReason = 'max_rounds';
    return false;
  }
  if (state.timerId) clearTimeout(state.timerId);
  state.timerId = setTimeout(function() {
    return _runNpcIdleAutonomyRound(state);
  }, state.delayMs);
  return true;
}

async function _runNpcIdleAutonomyRound(state) {
  if (!GM || GM._npcIdleAutonomy !== state) return false;
  state.timerId = null;
  if (!_canRunNpcIdleAutonomy(state)) {
    state.stopped = true;
    state.stopReason = state.stopReason || 'inactive';
    return false;
  }
  state.running = true;
  try {
    state.rounds += 1;
    state.lastRunAt = Date.now();
    var summary = await executeNpcBehaviors({
      idle: true,
      source: 'npc_idle_autonomy',
      tier: 'secondary',
      maxTokens: state.maxTokens
    });
    state.lastSummary = summary || null;
    if (summary && summary.skipped === 'no_candidates') {
      state.stopped = true;
      state.stopReason = 'no_candidates';
      return false;
    }
  } catch(e) {
    state.lastError = String(e && (e.message || e) || '');
    state.stopped = true;
    state.stopReason = 'error';
    try { console.warn('[NPC idle] round failed', e); } catch(_) {}
    return false;
  } finally {
    state.running = false;
  }
  if (!_canRunNpcIdleAutonomy(state)) {
    state.stopped = true;
    state.stopReason = state.stopReason || 'inactive';
    return false;
  }
  return _queueNpcIdleAutonomyNext(state);
}

function _scheduleNpcIdleAutonomyLoop(opts) {
  opts = opts || {};
  var cfg = _getNpcIdleAutonomyConfig(opts);
  if (!cfg.enabled || cfg.maxRounds <= 0) return false;
  if (typeof P === 'undefined' || !P || !P.ai || !P.ai.key) return false;
  if (typeof GM === 'undefined' || !GM || !GM.running) return false;
  _cancelNpcIdleAutonomyLoop('rescheduled');
  GM._npcIdleAutonomy = {
    turn: GM.turn || 0,
    rounds: 0,
    maxRounds: cfg.maxRounds,
    delayMs: cfg.delayMs,
    maxTokens: cfg.maxTokens,
    source: opts.source || 'post_render',
    startedAt: Date.now(),
    running: false,
    stopped: false,
    timerId: null
  };
  return _queueNpcIdleAutonomyNext(GM._npcIdleAutonomy);
}

async function executeNpcBehaviors(options) {
  options = options || {};
  if (!P.ai.key) return { skipped: 'missing_ai_key' };
  if (!GM.chars || GM.chars.length === 0) return { skipped: 'no_chars' };
  if (typeof AICache === 'undefined') { _dbg('[NPC] AICache 未初始化，跳过'); return { skipped: 'missing_cache' }; }

  AICache.cleanup();

  var npcs = GM.chars.filter(function(c) { return c.alive !== false && !c.isPlayer; });
  if (npcs.length === 0) return { skipped: 'no_npcs' };

  var context = buildNpcBehaviorContext();
  var importantNpcs = selectImportantNpcs(npcs);
  if (importantNpcs.length === 0) return { skipped: 'no_important_npcs' };

  // 去重：跳过本回合 AI 已决定行动的 NPC
  var aiHandled = _getNpcDecisionHandledNames();
  var toDecide = importantNpcs.filter(function(npc) {
    return aiHandled.indexOf(npc.name) < 0;
  });

  if (toDecide.length === 0) {
    _dbg('[NPC] 所有重要NPC已由AI推演处理，跳过独立决策');
    return { skipped: 'no_candidates', considered: 0, decisions: 0, executed: 0, idle: !!options.idle };
  }

  // 批量决策：一次 API 调用为所有 NPC 生成行为
  try {
    var batchDecisions = await batchNpcDecisions(toDecide, context, {
      idle: !!options.idle,
      tier: options.tier || (options.idle ? 'secondary' : null),
      maxTokens: options.maxTokens || (options.idle ? 1400 : 2500),
      timeoutMs: options.timeoutMs || 60000,
      priority: options.priority || 'background'
    });
    var executed = 0;
    batchDecisions.forEach(function(rawDecision) {
      if (_executeNormalizedNpcDecision(rawDecision, null, context, { idle: !!options.idle })) executed += 1;
    });
    return { considered: toDecide.length, decisions: batchDecisions.length, executed: executed, idle: !!options.idle };
  } catch(e) {
    console.error('[NPC] 批量决策失败，回退逐个处理:', e);
    // 回退：逐个处理前3个最重要的NPC
    var fallbackExecuted = 0;
    for (var i = 0; i < Math.min(3, toDecide.length); i++) {
      try {
        var dec = await npcDecisionLayer(toDecide[i], context);
        if (_executeNormalizedNpcDecision(dec, toDecide[i], context, { idle: !!options.idle })) fallbackExecuted += 1;
      } catch(e2) { _dbg('[NPC] 个别决策失败:', toDecide[i].name, e2); }
    }
    return { considered: toDecide.length, decisions: 0, executed: fallbackExecuted, idle: !!options.idle, fallback: true };
  }
}

/**
 * 批量 NPC 决策（1 次 API 调用替代 N 次）
 * @param {Array} npcs - 待决策的 NPC 列表
 * @param {Object} context - NPC 上下文
 * @returns {Promise<Array>} 决策结果数组
 */
async function batchNpcDecisions(npcs, context, options) {
  options = options || {};
  if (!npcs || npcs.length === 0) return [];
  var batchPersonaMaxLen = _getNpcDecisionBatchPersonaMaxLen();

  // 构建批量 prompt
  var turnCtx = GM._turnContext || {};
  var prompt = '你是历史模拟AI。以下是' + npcs.length + '个NPC角色，请为每人决定本回合行为。\n\n';
  if (options.idle) {
    prompt += 'IDLE_SUPPLEMENT: This is an after-render idle autonomy round. Prefer office_duty, private_life, palace_intrigue, court_politics, letters, memorials, audiences, local work, patrols, relief, private correspondence, and hidden political moves. Avoid regime-breaking actions such as war, sweeping appointments, mass dismissals, or major reforms unless already forced by context.\n';
  }

  // 注入当前回合上下文（玩家诏令 + AI叙事摘要）
  if (turnCtx.edicts) {
    var edictParts = [];
    if (turnCtx.edicts.political) edictParts.push('政:' + turnCtx.edicts.political);
    if (turnCtx.edicts.military) edictParts.push('军:' + turnCtx.edicts.military);
    if (turnCtx.edicts.diplomatic) edictParts.push('外:' + turnCtx.edicts.diplomatic);
    if (turnCtx.edicts.economic) edictParts.push('经:' + turnCtx.edicts.economic);
    if (edictParts.length) prompt += '【本回合诏令】' + edictParts.join('；') + '\n';
  }
  if (turnCtx.shizhengji) prompt += '【本回合时政】' + turnCtx.shizhengji + '\n';

  // 世界状态简要
  if (GM.eraState) {
    prompt += '时代:' + (GM.eraState.dynastyPhase || '') + ' 集权:' + Math.round((GM.eraState.centralControl || 0.5) * 100) + '% 稳定:' + Math.round((GM.eraState.socialStability || 0.5) * 100) + '%\n';
  }
  // 空缺要职（让NPC知道可以争抢什么职位）
  var _vacantPosts = [];
  if (GM.officeTree) {
    (function _vp(nodes) { nodes.forEach(function(n) { if (n.positions) n.positions.forEach(function(p) { if (!p.holder) _vacantPosts.push(n.name + p.name); }); if (n.subs) _vp(n.subs); }); })(GM.officeTree);
  }
  if (_vacantPosts.length > 0) prompt += '\u7A7A\u7F3A\u5B98\u804C:' + _vacantPosts.slice(0, 5).join('\u3001') + '\n';

  // 可用新进士（科举产出的人才）
  if (GM.chars) {
    var _jinshi = GM.chars.filter(function(c) { return c.alive !== false && c.source === '\u79D1\u4E3E' && c.recruitTurn >= GM.turn - 5; });
    if (_jinshi.length > 0) {
      prompt += '\u65B0\u79D1\u8FDB\u58EB\u53EF\u7528:' + _jinshi.slice(0, 3).map(function(j) { return j.name + '(\u667A' + (j.intelligence||0) + ')'; }).join('\u3001') + '\n';
    }
  }

  // 岗位继任方式（让NPC尊重规则）
  if (P.postSystem && P.postSystem.postRules && P.postSystem.postRules.length > 0) {
    var _sucRules = P.postSystem.postRules.filter(function(r) { return r.succession === 'hereditary' || r.hasAppointmentRight; });
    if (_sucRules.length > 0) {
      prompt += '\u5C97\u4F4D\u89C4\u5219:' + _sucRules.slice(0, 3).map(function(r) { return (r.positionName||'') + '=' + (r.succession==='hereditary'?'\u4E16\u88AD':'\u6D41\u5B98') + (r.hasAppointmentRight?'+\u8F9F\u7F72\u6743':''); }).join(';') + '\n';
    }
  }

  // 帝王荒淫程度（影响NPC行为判断）
  var _tyHistLen = GM._tyrantHistory ? GM._tyrantHistory.length : 0;
  if (_tyHistLen > 2) {
    if (_tyHistLen > 10) {
      prompt += '\u5E1D\u738B\u957F\u671F\u653E\u7EB5\u4EAB\u4E50\uFF0C\u660F\u5EB8\u4E4B\u540D\u5DF2\u5E7F\u4F20\u3002\n';
      prompt += 'NPC\u53CD\u5E94\u6307\u5357\uFF1A\u5FE0\u8BDA>70\u7684\u521A\u76F4\u4E4B\u81E3\u5E94\u6B7B\u8C0F/\u8F9E\u5B98\uFF1B\u5FE0\u8BDA40-70\u7684\u5EB8\u81E3\u89C2\u671B\u4E0D\u8BED\uFF1B';
      prompt += '\u5FE0\u8BDA<40\u7684\u91CE\u5FC3\u5BB6\u5E94\u6697\u4E2D\u4E32\u8054/\u56FE\u8C0B\uFF1B\u4F5E\u81E3\u5E94\u732E\u5A9A/\u8FDB\u8D21\u73CD\u5B9D\n';
    } else if (_tyHistLen > 6) {
      prompt += '\u5E1D\u738B\u6709\u653E\u7EB5\u4E4B\u540D\uFF0C\u5FE0\u81E3\u5B9C\u59D4\u5A49\u8FDB\u8C0F\uFF0C\u4F5E\u81E3\u5F53\u8D81\u673A\u732E\u5A9A\n';
    } else {
      prompt += '\u5E1D\u738B\u5076\u6709\u653E\u7EB5\uFF0C\u5C1A\u53EF\u5BB9\u5FCD\n';
    }
    prompt += '\n';
    // 最近一次昏君活动（让NPC知道发生了什么）
    if (GM._tyrantHistory && GM._tyrantHistory.length > 0) {
      var _lastTy = GM._tyrantHistory[GM._tyrantHistory.length - 1];
      if (_lastTy.turn >= GM.turn - 1) {
        var _lastActs = _lastTy.acts.map(function(id) {
          var a = typeof TYRANT_ACTIVITIES !== 'undefined' ? TYRANT_ACTIVITIES.find(function(x) { return x.id === id; }) : null;
          return a ? a.name : id;
        });
        prompt += '上回合帝王:' + _lastActs.join('、') + '\n';
      }
    }
  }

  if (context.courtWorkload) {
    prompt += '\nCourtWorkload(JSON):' + JSON.stringify(context.courtWorkload) + '\n';
  }
  if (context.characterEconomy && context.characterEconomy.length) {
    prompt += 'CharacterEconomy(JSON):' + JSON.stringify(context.characterEconomy.slice(0, 12)).slice(0, 1800) + '\n';
  }
  if (context.npcInternalActions && context.npcInternalActions.length) {
    prompt += 'NpcInternalActions(JSON):' + JSON.stringify(context.npcInternalActions).slice(0, 900) + '\n';
  }

  // 每个 NPC 简要信息
  prompt += '\n角色列表：\n';
  npcs.forEach(function(npc, idx) {
    var traitText = '';
    if (npc.traitIds && npc.traitIds.length > 0 && P.traitDefinitions) {
      var hints = [];
      npc.traitIds.forEach(function(tid) {
        var def = P.traitDefinitions.find(function(t) { return t.id === tid; });
        if (def) { traitText += def.name + ' '; if (def.aiHint) hints.push(def.aiHint); }
      });
      if (hints.length) traitText += '(' + hints.join(';').substring(0, 60) + ')';
    } else {
      traitText = npc.personality || '';
    }
    var goal = npc.personalGoal ? '目标:' + npc.personalGoal.substring(0, 30) : '';
    var office = findNpcOffice(npc.name);
    var officeText = office ? office.deptName + office.posName : '无官职';
    var affRels = (typeof AffinityMap !== 'undefined') ? AffinityMap.getRelations(npc.name).slice(0, 2) : [];
    var affText = affRels.length ? '亲疏:' + affRels.map(function(r) { return r.name + (r.value > 0 ? '+' : '') + r.value; }).join(',') : '';

    // 角色近期经历（自我记忆）
    var arcText = '';
    if (GM.characterArcs && GM.characterArcs[npc.name]) {
      var recentArcs = GM.characterArcs[npc.name].slice(-3);
      if (recentArcs.length > 0) {
        arcText = '经历:' + recentArcs.map(function(a) { return 'T' + a.turn + a.desc; }).join(';');
      }
    }

    var stressNote = (npc.stress && npc.stress > 40) ? ' 压力' + npc.stress : '';
    var ambNote = (npc.ambition || 50) > 70 ? ' 野心勃勃' : '';
    // NPC个人记忆（内心世界）
    var memText = '';
    if (typeof NpcMemorySystem !== 'undefined') {
      var _mc = NpcMemorySystem.getMemoryContext(npc.name);
      if (_mc) memText = ' 内心:' + _mc.slice(0, 80);
    }
    // 人生阅历
    var expText = '';
    if (npc._lifeExp && npc._lifeExp.length > 0) {
      expText = ' 阅历:' + npc._lifeExp.slice(-2).map(function(e) { return e.desc; }).join(';').slice(0, 50);
    }
    // 后宫/家庭身份标注
    var spouseText = '';
    if (_npcIsPlayerConsort(npc)) {
      spouseText = ' [\u540E\u5BAB:' + (typeof getHaremRankName === 'function' ? getHaremRankName(npc.spouseRank) : (npc.spouseRank || '\u59BB\u5BA4'));
      if (npc.motherClan) spouseText += ',\u6BCD\u65CF' + npc.motherClan;
      if (npc.children && npc.children.length > 0) spouseText += ',\u5B50' + npc.children.join('/');
      spouseText += ']';
    }
    if (npc.parentOf) spouseText += ' [\u7687\u5B50/\u7687\u5973,\u7236:' + npc.parentOf + ']';
    var familyText = '';
    if (npc.family) {
      var _famObj = GM.families ? GM.families[npc.family] : null;
      familyText = ' \u65CF:' + npc.family;
      if (_famObj) familyText += '(\u58F0\u671B' + Math.round(_famObj.renown || 0) + ')';
      // 添加血亲信息
      if (typeof getBloodRelatives === 'function') {
        var _brels = getBloodRelatives(npc.name).slice(0, 3);
        if (_brels.length > 0) familyText += ' \u8840\u4EB2:' + _brels.map(function(r) { return r.name + '(' + r.relation + ')'; }).join(',');
      }
    }
    var charismaText = (npc.charisma || 0) > 75 ? ' \u9B45\u529B\u51FA\u4F17' : '';
    // B3: 注入党派上下文
    var partyText = '';
    if (npc.party && npc.party !== '\u65E0\u515A\u6D3E' && npc.party !== '') {
      var _npcParty = GM.parties ? GM.parties.find(function(pp) { return pp.name === npc.party; }) : null;
      partyText = ' \u515A:' + npc.party;
      if (_npcParty) {
        if (_npcParty.currentAgenda) partyText += '(\u8BAE\u7A0B:' + _npcParty.currentAgenda.slice(0, 15) + ')';
        if (_npcParty.status === '\u88AB\u538B\u5236') partyText += '[\u88AB\u538B\u5236]';
      }
    }
    // 科举出身+座主+同年+天子门生
    var kejuText = '';
    if (npc.source === '\u79D1\u4E3E') {
      kejuText = ' [\u79D1\u4E3E]';
      if (npc._mentorParty) kejuText += '[\u5EA7\u5E08\u503E\u5411' + npc._mentorParty + ']';
      // 查找座主
      if (P.keju && P.keju.history) {
        P.keju.history.forEach(function(h) {
          if (h.topThree && h.topThree.indexOf(npc.name) >= 0) {
            if (h.chiefExaminer) kejuText += '[\u5EA7\u5E08:' + h.chiefExaminer + ']';
            kejuText += '[\u5929\u5B50\u95E8\u751F]';
          }
        });
      }
      // 同年
      var _sameYear = (GM.chars||[]).filter(function(c){return c.alive!==false && c.source==='\u79D1\u4E3E' && c.recruitTurn===npc.recruitTurn && c.name!==npc.name;});
      if (_sameYear.length > 0) kejuText += '[\u540C\u5E74:' + _sameYear.slice(0,2).map(function(c){return c.name;}).join(',') + ']';
    }
    prompt += (idx + 1) + '. ' + npc.name + '(' + officeText + ')' + spouseText + familyText + partyText + kejuText + ' \u5FE0' + (npc.loyalty || 50) + charismaText + ambNote + stressNote + ' ' + traitText + ' ' + goal + ' ' + affText + (arcText ? ' ' + arcText : '') + memText + expText + '\n';
    prompt += _buildNpcDecisionComposerAddon(npc, npcs.length > 5 ? { maxLen: batchPersonaMaxLen } : null);
    var actionCards = _buildNpcActionCandidates(npc, context).slice(0, 5);
    if (actionCards.length > 0) {
      prompt += '候选行动ActionCards：' + actionCards.map(function(card) {
        return card.id + '=' + card.behaviorType + ' target=' + (card.target || '') + ' score=' + card.score + ' fit=' + [card.abilityFit || 0, card.wuchangFit || 0, card.economyFit || 0, card.familyFit || 0, card.tierFit || 0].join('/') + ' intent=' + (card.intent || '');
      }).join('; ') + '\n';
    }
  });

  prompt += '\n为每人返回JSON数组：[{"name":"角色名","actionId":"候选行动id，优先填写","behaviorType":"appoint|dismiss|reward|punish|declare_war|request_loyalty|reform|petition|recommend|impeach|conspire|build_network|office_duty|private_life|palace_intrigue|court_politics|train_troops|patrol|fortify|send_letter|private_correspondence|seek_audience|request_funds|develop_local|relief|obstruct|slander|none","target":"对象","intent":"意图描述20字","shouldExecute":true,"publicReason":"对外说辞/冠冕堂皇的理由15字","privateMotiv":"真实内心动机15字","innerThought":"内心独白15字"}]\n';
  prompt += '\u6CE8\u610F\uFF1A\n';
  prompt += '\u2022 \u4F18\u5148\u4ECE ActionCards \u4E2D\u9009 actionId\uFF1B\u53EA\u6709 ActionCards \u4E0D\u8DB3\u4EE5\u8868\u8FBE\u65F6\uFF0C\u624D\u76F4\u63A5\u5199 behaviorType\u3002\n';
  prompt += '\u2022 \u6BCF\u4E2A\u89D2\u8272\u662F\u72EC\u7ACB\u7684\u4EBA\uFF0C\u6709\u81EA\u5DF1\u7684\u559C\u6012\u54C0\u4E50\u3001\u6069\u6028\u60C5\u4EC7\uFF0C\u4E0D\u56F4\u7ED5\u73A9\u5BB6\u3002\n';
  prompt += '\u2022 \u7EFC\u5408\u5224\u65AD\uFF1A\u7279\u8D28\u3001\u5FE0\u8BDA\u3001\u4EB2\u758F\u3001\u76EE\u6807\u3001\u8FD1\u671F\u7ECF\u5386\u3001\u5BB6\u65CF\u5229\u76CA\u3001\u540E\u5BAB\u5173\u7CFB\u3002\n';
  prompt += '\u2022 \u591A\u6570\u89D2\u8272\u5E94\u4E3Anone\uFF08\u89C2\u671B\uFF09\uFF0C\u4EC5\u6709\u5F3A\u52A8\u673A\u8005\u624D\u884C\u52A8\u3002\n';
  prompt += '\u2022 \u515A\u6D3E\u56E0\u7D20\uFF1A\u540C\u515A\u6D3E\u6210\u5458\u503E\u5411\u4E92\u76F8\u652F\u6301\uFF1B\u5BF9\u7ACB\u515A\u6D3E\u6210\u5458\u53EF\u80FD\u4E92\u76F8\u653B\u51FB\uFF1B\u88AB\u538B\u5236\u515A\u6D3E\u6210\u5458\u53EF\u80FD\u6697\u4E2D\u4E32\u8054\u6216\u8F9E\u5B98\u3002\n';
  prompt += '\u2022 \u79D1\u4E3E\u5173\u7CFB\uFF1A\u5EA7\u5E08\u95E8\u751F\u503E\u5411\u4E92\u52A9\u4F46\u975E\u7EDD\u5BF9\u2014\u2014\u5FE0\u6B63\u4E4B\u58EB\u4E0D\u5C51\u653E\u9644\uFF0C\u91CE\u5FC3\u5BB6\u53EF\u80FD\u80CC\u53DB\u5EA7\u5E08\u3002\u540C\u5E74\u8FDB\u58EB\u6709\u4EB2\u8FD1\u611F\u4F46\u4E5F\u53EF\u80FD\u7ADE\u4E89\u3002\u5929\u5B50\u95E8\u751F(\u72B6\u5143\u699C\u773C\u63A2\u82B1)\u5BF9\u541B\u4E3B\u6709\u989D\u5916\u611F\u6069\u3002\n';
  prompt += '\u2022 \u5BB6\u65CF\u56E0\u7D20\uFF1A\u540C\u65CF\u4E0D\u7B49\u4E8E\u540C\u5FC3\u3002\u65CF\u4EBA\u5F97\u52BF\u65F6\uFF0C\u6709\u4EBA\u611F\u6069\u3001\u6709\u4EBA\u5AC9\u5992\u3001\u6709\u4EBA\u5229\u7528\u3002\u5F97\u7F6A\u65CF\u4EBA\u65F6\uFF0C\u6709\u4EBA\u62A5\u590D\u3001\u6709\u4EBA\u5212\u6E05\u754C\u9650\u3001\u6709\u4EBA\u6F20\u4E0D\u5173\u5FC3\u3002\n';
  prompt += '\u2022 \u516C\u79C1\u4E4B\u5206\uFF08\u6838\u5FC3\uFF09\uFF1A\n';
  prompt += '  - publicReason\uFF1A\u5BF9\u5916\u5BA3\u79F0\u7684\u7406\u7531\uFF0C\u53EF\u80FD\u662F\u771F\u5FC3\u4E5F\u53EF\u80FD\u662F\u501F\u53E3\n';
  prompt += '  - privateMotiv\uFF1A\u5185\u5FC3\u771F\u6B63\u7684\u9A71\u52A8\uFF08\u6392\u9664\u5F02\u5DF1\u3001\u6276\u690D\u4EB2\u4FE1\u3001\u62A5\u79C1\u4EC7\u3001\u4E3A\u5BB6\u65CF\u4E89\u5229\uFF09\n';
  prompt += '  - innerThought\uFF1A\u5185\u5FC3\u72EC\u767D\uFF0C\u4F53\u73B0\u6027\u683C\uFF08\u91CE\u5FC3\u8005\u7B97\u8BA1\u3001\u5FE0\u81E3\u5FE7\u56FD\u3001\u6028\u6068\u8005\u6697\u6068\u3001\u5BD2\u95E8\u8005\u4E0D\u5FFF\uFF09\n';
  prompt += '  - \u4E8C\u8005\u53EF\u4EE5\u4E00\u81F4\uFF08\u516C\u5FE0\u4F53\u56FD\uFF09\u4E5F\u53EF\u4EE5\u77DB\u76FE\uFF08\u8868\u9762\u5FE0\u8BDA\u5B9E\u5219\u56FE\u8C0B\uFF09\n';

  var result = await callAI(prompt, options.maxTokens || 2500, null, options.tier || null, {
    priority: options.priority || 'background',
    timeoutMs: options.timeoutMs || 60000,
    maxRetries: 1
  });
  var parsed = extractJSON(result);

  if (Array.isArray(parsed)) return parsed;
  // 如果返回的是对象包含数组
  if (parsed && parsed.decisions && Array.isArray(parsed.decisions)) return parsed.decisions;
  if (parsed && parsed.npc_actions && Array.isArray(parsed.npc_actions)) return parsed.npc_actions;
  return [];
}

// 构建 NPC 行为推演的上下文
function _collectRecentNpcInternalActions(limit) {
  var out = [];
  var seen = {};
  function push(kind, item) {
    if (!item) return;
    var rec = {
      kind: kind,
      from: item.from || item.actor || item.name || '',
      to: item.to || item.target || '',
      intent: _npcShortText(item.intent || item.content || item.subjectLine || item.reason || '', '', 80),
      turn: Number(item.turn || item.createdTurn || GM.turn || 0)
    };
    var key = [rec.kind, rec.from, rec.to, rec.turn, rec.intent].join('|');
    if (seen[key]) return;
    seen[key] = true;
    out.push(rec);
  }
  (Array.isArray(GM._npcInternalActionHistory) ? GM._npcInternalActionHistory : []).forEach(function(item) {
    push(item.kind || 'internal', item);
  });
  (Array.isArray(GM._pendingNpcCorrespondence) ? GM._pendingNpcCorrespondence : []).forEach(function(item) {
    push('private_correspondence', item);
  });
  (Array.isArray(GM._pendingNpcConspiracies) ? GM._pendingNpcConspiracies : []).forEach(function(item) {
    push('conspiracy', item);
  });
  (Array.isArray(GM._npcHiddenMoves) ? GM._npcHiddenMoves : []).forEach(function(item) {
    push('hidden_move', item);
  });
  out.sort(function(a, b) { return (b.turn || 0) - (a.turn || 0); });
  return out.slice(0, limit || 8);
}

function _npcEconomyNum(v) {
  var n = Number(v || 0);
  return isFinite(n) ? n : 0;
}

function _npcBuildCharacterEconomySnapshot(npc) {
  if (!npc || npc.alive === false) return null;
  if (typeof CharEconEngine !== 'undefined' && CharEconEngine && typeof CharEconEngine.buildEconomySnapshot === 'function') {
    try {
      var sharedSnapshot = CharEconEngine.buildEconomySnapshot(npc);
      if (sharedSnapshot) {
        return Object.assign({
          name: npc.name || '',
          title: npc.officialTitle || npc.title || '',
          rank: npc.rank || npc.rankLevel || null,
          faction: npc.faction || '',
          debt: sharedSnapshot.privateWealth ? sharedSnapshot.privateWealth.debt : 0
        }, sharedSnapshot);
      }
    } catch (_) {}
  }
  if (!npc.resources) return null;
  var r = npc.resources || {};
  var privateWealth = r.privateWealth || r.private || {};
  var money = _npcEconomyNum(privateWealth.money);
  var publicPurse = r.publicPurse || null;
  var publicTreasury = r.publicTreasury || null;
  var debt = money < 0 ? Math.abs(money) : _npcEconomyNum(privateWealth.debt);
  return {
    name: npc.name || '',
    title: npc.officialTitle || npc.title || '',
    rank: npc.rank || npc.rankLevel || null,
    faction: npc.faction || '',
    privateWealth: {
      money: money,
      grain: _npcEconomyNum(privateWealth.grain),
      cloth: _npcEconomyNum(privateWealth.cloth),
      land: _npcEconomyNum(privateWealth.land != null ? privateWealth.land : privateWealth.landAcres),
      treasure: _npcEconomyNum(privateWealth.treasure),
      commerce: _npcEconomyNum(privateWealth.commerce),
      debt: debt
    },
    debt: debt,
    hiddenWealth: _npcEconomyNum(r.hiddenWealth),
    fame: _npcEconomyNum(r.fame),
    virtueMerit: _npcEconomyNum(r.virtueMerit),
    virtueStage: _npcEconomyNum(r.virtueStage),
    health: _npcEconomyNum(r.health),
    stress: _npcEconomyNum(r.stress),
    publicPurse: publicPurse ? {
      money: _npcEconomyNum(publicPurse.money),
      grain: _npcEconomyNum(publicPurse.grain),
      cloth: _npcEconomyNum(publicPurse.cloth)
    } : null,
    publicTreasury: publicTreasury ? {
      linkedPost: publicTreasury.linkedPost || publicTreasury.post || null,
      linkedRegion: publicTreasury.linkedRegion || publicTreasury.region || null,
      balance: _npcEconomyNum(publicTreasury.balance != null ? publicTreasury.balance : publicTreasury.money),
      grain: _npcEconomyNum(publicTreasury.grain),
      cloth: _npcEconomyNum(publicTreasury.cloth),
      deficit: _npcEconomyNum(publicTreasury.deficit != null ? publicTreasury.deficit : publicTreasury.lastHandoverDeficit),
      isReadOnly: publicTreasury.isReadOnly !== false
    } : null,
    lastTick: {
      income: npc._lastTickIncome || null,
      expense: npc._lastTickExpense || null,
      net: _npcEconomyNum(npc._lastTickNet)
    }
  };
}

function _npcCharacterEconomyScore(row) {
  if (!row) return 0;
  var score = 0;
  if (row.title) score += 20;
  if (row.publicPurse) score += 12;
  if (row.publicTreasury) score += 12;
  score += Math.min(18, Math.abs(row.privateWealth.money || 0) / 500);
  score += Math.min(12, Math.abs(row.hiddenWealth || 0) / 400);
  score += Math.min(10, Math.abs(row.fame || 0) / 5);
  score += Math.min(10, Math.abs(row.virtueMerit || 0) / 60);
  score += Math.min(10, Math.abs(row.lastTick.net || 0) / 30);
  score += Math.min(10, row.debt / 120);
  if (row.stress >= 60) score += 5;
  return score;
}

function _npcBuildCharacterEconomyContext(limit) {
  var rows = (GM.chars || []).map(_npcBuildCharacterEconomySnapshot).filter(Boolean);
  rows.sort(function(a, b) {
    return _npcCharacterEconomyScore(b) - _npcCharacterEconomyScore(a);
  });
  return rows.slice(0, limit || 12);
}

function buildNpcBehaviorContext() {
  var context = {
    turn: GM.turn,
    date: getTSText(GM.turn),
    eraState: GM.eraState,
    resources: {},
    relations: {},
    officeTree: GM.officeTree,
    factions: GM.facs
  };

  // 资源状态
  Object.keys(GM.vars).forEach(function(key) {
    context.resources[key] = GM.vars[key].value;
  });

  // 关系状态
  Object.keys(GM.rels).forEach(function(key) {
    context.relations[key] = GM.rels[key].value;
  });

  // 后宫/家庭状态
  if (GM.chars) {
    var spouses = GM.chars.filter(function(c) { return c.alive !== false && _npcIsPlayerConsort(c); });
    if (spouses.length > 0) {
      context.harem = spouses.map(function(sp) {
        return { name: sp.name, rank: sp.spouseRank, motherClan: sp.motherClan, children: sp.children || [], loyalty: sp.loyalty || 50 };
      });
    }
    if (GM.harem) {
      context.heirs = GM.harem.heirs || [];
      context.pregnancies = GM.harem.pregnancies || [];
    }
  }

  context.courtWorkload = {
    pendingMemorials: _npcPendingMemorialCount(),
    pendingAudiences: _npcPendingAudienceCount(),
    pendingNpcLetters: _npcPendingLetterCount(),
    pendingNpcCorrespondence: Array.isArray(GM._pendingNpcCorrespondence) ? GM._pendingNpcCorrespondence.length : 0,
    pendingConspiracies: Array.isArray(GM._pendingNpcConspiracies) ? GM._pendingNpcConspiracies.length : 0,
    hiddenMoves: Array.isArray(GM._npcHiddenMoves) ? GM._npcHiddenMoves.length : 0,
    internalActionHistory: Array.isArray(GM._npcInternalActionHistory) ? GM._npcInternalActionHistory.length : 0
  };
  context.npcInternalActions = _collectRecentNpcInternalActions(8);
  context.characterEconomy = _npcBuildCharacterEconomyContext(12);

  return context;
}

/** @param {Array} npcs @returns {Array} 按重要度排序的前10个NPC */
function selectImportantNpcs(npcs) {
  var important = [];

  npcs.forEach(function(npc) {
    var score = 0;

    // 有官职的角色
    if (hasOffice(npc.name)) {
      score += 10;
    }

    // 高野心
    if (npc.ambition && npc.ambition > 70) {
      score += 5;
    }

    // 低忠诚（可能叛乱）
    if (npc.loyalty !== undefined && npc.loyalty < 30) {
      score += 8;
    }

    // 中等忠诚（可能动摇）
    if (npc.loyalty !== undefined && npc.loyalty >= 30 && npc.loyalty < 60) {
      score += 3;
    }

    // 高能力
    if ((typeof getEffectiveAttr === 'function' ? getEffectiveAttr(npc, 'intelligence') : (npc.intelligence || 0)) > 80) {
      score += 3;
    }

    // 高魅力（影响力大、人脉广）
    var _npcCha = typeof getEffectiveAttr === 'function' ? getEffectiveAttr(npc, 'charisma') : (npc.charisma || 0);
    if (_npcCha > 80) score += 4;
    else if (_npcCha > 65) score += 2;

    // 有军队的角色
    if (npc.troops && npc.troops > 0) {
      score += 5;
    }

    // 地方/边地角色必须进入候选池，否则朝堂高分角色会挤掉地方线索
    if (npc.location && npc.location !== (GM._capital || '京师')) {
      score += 4;
      if (GM.provinceStats && GM.provinceStats[npc.jurisdiction || npc.location]) score += 2;
    }

    // 后宫妻室（政治影响力极大）
    if (_npcIsPlayerConsort(npc)) {
      score += 7; // 妻室总是重要角色
      if (npc.spouseRank === 'empress' || npc.spouseRank === 'queen') score += 5;
      if (npc.children && npc.children.length > 0) score += 3; // 有子嗣更重要
    }
    // 皇子/皇女（继承人）
    if (npc.parentOf) score += 4;

    // 频率分级调度：低品级 NPC 间隔执行
    var officeInfo = findNpcOffice(npc.name);
    var rankLevel = 0;
    if (officeInfo && officeInfo.rank) {
      var rankMatch = officeInfo.rank.match(/[一二三四五六七八九]/);
      if (rankMatch) {
        var rankMap = {'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9};
        rankLevel = rankMap[rankMatch[0]] || 9;
      }
    }
    // 所有NPC每回合都有机会参与评估——AI推演的核心是每个角色都是独立主体
    // 品级仅影响最终入选优先级（通过score体现），不再硬性跳过
    // 高品级加分以体现政治影响力
    if (rankLevel >= 1 && rankLevel <= 3) score += 2;
    else if (rankLevel >= 4 && rankLevel <= 6) score += 1;

    if (score > 0) {
      important.push({npc: npc, score: score});
    }
  });

  // Cohort-aware selection: keep elite priority but reserve room for
  // military, local/frontier, and politically unstable actors.
  important.sort(function(a, b) { return b.score - a.score; });
  var selected = [];
  var seen = {};
  function addItem(item) {
    if (!item || !item.npc || seen[item.npc.name]) return false;
    selected.push(item);
    seen[item.npc.name] = true;
    return true;
  }
  function bestWhere(fn) {
    for (var i = 0; i < important.length; i++) {
      if (!seen[important[i].npc.name] && fn(important[i].npc)) return important[i];
    }
    return null;
  }
  important.slice(0, 7).forEach(addItem);
  addItem(bestWhere(function(npc) { return _hasMilitaryCommand(npc); }));
  addItem(bestWhere(function(npc) { return npc.location && npc.location !== (GM._capital || '京师'); }));
  addItem(bestWhere(function(npc) {
    return (npc.loyalty !== undefined && npc.loyalty < 45) || (npc.ambition || 0) >= 75 || (npc.stress || 0) >= 60;
  }));
  for (var j = 0; selected.length < 10 && j < important.length; j++) addItem(important[j]);
  return selected.slice(0, 10).map(function(item) { return item.npc; });
}

/** @param {string} charName @returns {boolean} */
function hasOffice(charName) {
  _ensureOfficeIndex();
  return _officeIndex.has(charName);
}

/** @deprecated 使用 batchNpcDecisions 替代。仅作为批量失败时的回退。 */
// 为单个 NPC 推演行为
// TM_RETENTION_GUARD: executeNpcBehavior-single-npc-fallback.
// Keep until tm-help-social.js and any single-NPC fallback paths are migrated
// away from executeNpcBehavior(npc, context).
async function executeNpcBehavior(npc, context) {
  if (typeof AICache === 'undefined') return null;
  try {
    // 检查缓存
    var cached = AICache.get(npc, context);
    if (cached) {
      AICache.stats.cacheHits++;
      return cached;
    }

    AICache.stats.cacheMisses++;
    var startTime = Date.now();

    // 构建 prompt
    var prompt = '角色：' + npc.name + '\n';
    if (npc.title) prompt += '职位：' + npc.title + '\n';
    // 封臣/头衔上下文
    if (npc.faction && GM.facs) {
      var _nf = GM._indices.facByName ? GM._indices.facByName.get(npc.faction) : null;
      if (_nf && _nf.liege) prompt += '封臣身份：臣属' + _nf.liege + '，贡奉' + Math.round((_nf.tributeRate||0.3)*100) + '%\n';
      if (_nf && _nf.vassals && _nf.vassals.length > 0) prompt += '宗主身份：辖' + _nf.vassals.join('、') + '\n';
    }
    if (npc.titles && npc.titles.length > 0) prompt += '爵位：' + npc.titles.map(function(t){return t.name+(t.hereditary?'(世袭)':'');}).join('、') + '\n';
    if (npc.personality) prompt += '性格：' + npc.personality + '\n';
    if (npc.loyalty !== undefined) prompt += '忠诚度：' + npc.loyalty + '\n';
    if (npc.ambition !== undefined) prompt += '野心：' + npc.ambition + '\n';
    if (npc.intelligence !== undefined) prompt += '智力：' + npc.intelligence + '\n';

    prompt += '\n当前局势：\n';
    prompt += '回合：' + context.turn + '，' + context.date + '\n';

    if (context.eraState) {
      prompt += '时代状态：\n';
      prompt += '  中央集权度：' + context.eraState.centralControl + '\n';
      prompt += '  社会稳定度：' + context.eraState.socialStability + '\n';
      prompt += '  王朝阶段：' + context.eraState.dynastyPhase + '\n';
    }

    prompt += '\n资源状态：' + JSON.stringify(context.resources) + '\n';
    if (context.characterEconomy && context.characterEconomy.length) {
      prompt += 'CharacterEconomy(JSON):' + JSON.stringify(context.characterEconomy.slice(0, 12)).slice(0, 1800) + '\n';
    }
    prompt += '关系状态：' + JSON.stringify(context.relations) + '\n';

    prompt += '\n请推演该角色在本回合可能采取的行动。返回 JSON：\n';
    prompt += '{\n';
    prompt += '  "action": "行动类型",\n';
    prompt += '  "target": "行动目标（人物或地区名）",\n';
    prompt += '  "reason": "行动原因（50-100字）",\n';
    prompt += '  "consequence": "可能后果（50-100字）",\n';
    prompt += '  "shouldExecute": true/false,\n';
    prompt += '  "priority": "high/medium/low"\n';
    prompt += '}\n\n';
    prompt += '行动类型包括：\n';
    prompt += '1. 政治类：请求任命、提出建议、弹劾他人、结盟、背叛\n';
    prompt += '2. 军事类：密谋叛乱、请求出兵、扩张势力、招募军队\n';
    prompt += '3. 经济类：请求资源、贪污受贿、发展经济、减免赋税\n';
    prompt += '4. 外交类：联姻、结盟、威胁、谈判\n';
    prompt += '5. 人事类：推荐人才、辞职、隐退、培养继承人\n';
    prompt += '6. 社会类：赈济灾民、兴修水利、镇压叛乱、安抚民心\n\n';
    prompt += '决策原则：\n';
    prompt += '1. 根据角色性格、忠诚度、野心推断行动\n';
    prompt += '2. 考虑时代背景（如低集权时期更容易叛乱，王朝末期更多人辞职）\n';
    prompt += '3. 考虑资源状态（财政紧张时更多人请求资源或贪污）\n';
    prompt += '4. 考虑关系状态（与其他角色的关系影响行动选择）\n';
    prompt += '5. shouldExecute=true 表示立即执行，false 表示仅记录意图\n';
    prompt += '6. priority 表示行动优先级，影响执行顺序\n';
    prompt += '7. 不是每个角色每回合都要行动，可以返回 null 表示无特殊行动';

    var url = P.ai.url;
    if (url.indexOf('/chat/completions') < 0) url = url.replace(/\/+$/, '') + '/chat/completions';

    var response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + P.ai.key
      },
      body: JSON.stringify({
        model: P.ai.model || 'gpt-4o',
        messages: [{role: 'user', content: prompt}],
        temperature: 0.7,
        max_tokens: Math.round(500 * ((typeof getCompressionParams==='function') ? Math.max(1.0, getCompressionParams().scale) : 1.0))
      })
    });

    if (!response.ok) {
      console.error('NPC 行为推演失败:', npc.name);
      AICache.stats.errors++;
      return null;
    }

    var data = await response.json();
    var content = (data.choices&&data.choices[0]&&data.choices[0].message)?data.choices[0].message.content:'';

    // 提取 JSON
    var jsonMatch = content.match(/\{[\s\S]*\}/);
    var behavior = null;

    if (jsonMatch) {
      behavior = JSON.parse(jsonMatch[0]);

      if (behavior && behavior.action) {
        // 记录 NPC 行为到事件簿
        addEB('NPC行为', npc.name + '：' + behavior.action + '。' + behavior.reason);

        // 缓存结果
        AICache.set(npc, context, behavior);
      }
    }

    // 记录性能
    var duration = Date.now() - startTime;
    AICache.stats.totalCalls++;
    AICache.stats.totalTime += duration;
    AICache.stats.avgTime = AICache.stats.totalTime / AICache.stats.totalCalls;

    return behavior;

  } catch (error) {
    console.error('NPC 行为推演错误:', npc.name, error);
    AICache.stats.errors++;
    return null;
  }
}

// 执行 NPC 行动
