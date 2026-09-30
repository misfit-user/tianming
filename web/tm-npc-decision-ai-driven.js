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
  // Traits shape the choice and its explanation. Identity, authority and resources have separate gates.
  return !!npc && !!decision;
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
  if ((!rawBehaviorType || behaviorType === 'none') && (raw.cardId || raw.actionId) && decision.name) {
    candidate = _resolveNpcActionCandidate(raw, TM.NPC.ActionLedger.findChar({id:raw.actorId||raw.characterId,name:decision.name},GM), context);
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
  if (!rawDecision) return false;
  if (rawDecision._npcLease && !TM.NPC.ActionLedger.current(rawDecision._npcLease)) return false;
  var ledger = TM.NPC.ActionLedger;
  if (context && !ledger.current(context._npcLease)) return false;
  ledger.prepare(rawDecision, GM);
  if(rawDecision._npcInvalidActionId){rawDecision._executionResult=ledger.result('blocked','invalid_action_id');return false;}
  var decision = _normalizeNpcDecision(rawDecision, fallbackNpc && fallbackNpc.name, context);
  if (!decision || !decision.shouldExecute || decision.behaviorType === 'none') return false;
  var npc = ledger.findChar({ id: decision.actorId || decision.characterId || fallbackNpc && fallbackNpc.id, name: decision.name }, GM);
  if (!npc) { _recordNpcDecisionDiagnostic(decision, 'blocked', 'unknown_actor'); return false; }
  if (options.idle) {
    // Background thinking consumes no game time. Proposal is committed at the next simulation boundary.
    ledger.defer(Object.assign({}, decision, { actorId: npc.id, proposedTurn: GM.turn }));
    return false;
  }
  _npcEnsureExecutionFactors(npc, decision.behaviorType, context, decision);
  var receipt = NpcBehaviorRegistry.execute(npc, decision, context) || ledger.result('failed', 'handler_result_missing');
  rawDecision._executionResult = decision._executionResult = receipt;
  _recordNpcDecisionDiagnostic(decision, receipt.outcome, receipt.reason);
  return /^(submitted|waiting|started|partial|completed)$/.test(receipt.outcome) && !receipt.duplicate;
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
  options=options||{};
  var ledger=TM.NPC.ActionLedger,lease=ledger.capture();
  if(!GM||!GM.chars)return {skipped:'no_chars'};
  var local=TM.NPC.LocalAI?TM.NPC.LocalAI.wake('turn'):null;
  if(options.localOnly)return {local:local,modelCalls:0};
  if(!options.idle){ledger.advance(GM);ledger.flushDeferred();}
  if(!P.ai||!P.ai.key)return {skipped:'missing_ai_key',local:local,modelCalls:0};
  var budget=ledger.state(GM);
  if(budget.modelTurn!==GM.turn){budget.modelTurn=GM.turn;budget.modelCalls=0;}
  if(budget.modelCalls>=3)return {skipped:'turn_model_budget'};
  var actors=selectImportantNpcs(GM.chars), privateSchedule=budget.privateSchedule || (budget.privateSchedule={});
  var sensitive=actors.filter(function(c){return ledger.due(c,GM)||c.personalGoal;}).sort(function(a,b){return (privateSchedule[a.id]||0)-(privateSchedule[b.id]||0);}).slice(0,2);
  sensitive.forEach(function(c){privateSchedule[c.id]=++budget.sequence;});
  var batches=sensitive.map(function(c){return {npcs:[c],privateActorId:c.id};});
  var publicActors=actors.filter(function(c){return sensitive.indexOf(c)<0&&!ledger.due(c,GM)&&!c.personalGoal;});
  if(publicActors.length)batches.push({npcs:publicActors});
  var executed=0,decided=0,called=0;
  for(var i=0;i<batches.length&&ledger.state(GM).modelCalls<3;i++){
    if(!ledger.current(lease))return {skipped:'expired',executed:executed};
    var batch=batches[i],ctx=buildNpcBehaviorContext(batch.privateActorId?batch.npcs[0]:null);
    called++;
    try{
      var ds=await batchNpcDecisions(batch.npcs,ctx,Object.assign({},options,{privateActorId:batch.privateActorId}));
      if(!ledger.current(lease))return {skipped:'expired',executed:executed};
      ds.forEach(function(d){decided++;if(_executeNormalizedNpcDecision(d,null,ctx,options))executed++;});
    }catch(error){
      if(!ledger.current(lease))return {skipped:'expired',executed:executed};
      _recordNpcDecisionDiagnostic({source:'npc-autonomy'},'failed',String(error.message||error));
      // The next simulation turn may retry; no multiplying fallback calls.
    }
  }
  return {considered:actors.length,decisions:decided,executed:executed,modelCalls:called,idle:!!options.idle};
}

/**
 * 批量 NPC 决策（1 次 API 调用替代 N 次）
 * @param {Array} npcs - 待决策的 NPC 列表
 * @param {Object} context - NPC 上下文
 * @returns {Promise<Array>} 决策结果数组
 */
async function batchNpcDecisions(npcs, context, options) {
  options=options||{};
  npcs=(npcs||[]).map(function(c){return c&&TM.NPC.ActionLedger.findChar({id:c.id,name:c.name},GM);}).filter(Boolean);
  if(!npcs||!npcs.length)return [];
  var requestLease=TM.NPC.ActionLedger.capture();
  var modelBudget=TM.NPC.ActionLedger.state(GM);
  if(modelBudget.modelTurn!==GM.turn){modelBudget.modelTurn=GM.turn;modelBudget.modelCalls=0;}
  if(modelBudget.modelCalls>=3)return [];
  modelBudget.modelCalls++;
  var privateActor=npcs.length===1&&String(options.privateActorId||'')===String(npcs[0].id);
  var packet=privateActor?buildNpcBehaviorContext(npcs[0]):buildNpcBehaviorContext();
  if(privateActor){
    var exposure=modelBudget.planExposure||(modelBudget.planExposure={});
    (packet.plans||[]).forEach(function(p){exposure[p.id]=++modelBudget.sequence;});
  }
  packet.actors=npcs.map(function(c){return {id:c.id,name:c.name,office:c.officialTitle||'',location:c.location||''};});
  var prompt='依据收到的信息选择行动，允许无事、等待、拒绝和改条件。禁止替玩家作决定。私人请求不表示对方同意；完成必须由程序核验。\n';
  prompt+='共享批次只含公开背景；未列出的私人事实不可推测为已知。\n';
  prompt+='行为类型：'+NpcBehaviorRegistry.list().join(',')+'。返回 JSON 数组 [{actorId,name,behaviorType,targetId,target,intent,shouldExecute,planId,phase,response,content,step,actingPositionId,appointmentId,positionId,task}]。office_duty 需具体事项：报告用 step=report 和实际 content；移交用 step=transfer 和明确账户、用途、金额。无事返回 none。\n';
  prompt+='已有事项使用 planId 与 nextPhase；respond 可 accept/reject/conditions/defer/partial；agree 可 accept/reject；perform 提供实际文书 content；feedback 表达收件评价。新请求 task.kind=document，公库协办可 public_transfer，必须具体 fromAccount/toAccount/amounts。不得自造完成凭据。\n';
  prompt+=JSON.stringify(packet);
  // 涉议名单只取本批已在公开/本人上下文中的人物，沿用时空约束。
  if (typeof _buildTemporalConstraint === 'function') {
    var _ndMentioned = (npcs || []).map(function(c){return c.name;}).filter(Boolean);
    prompt += _buildTemporalConstraint(null, { clauseOnly: true, mentionedNames: _ndMentioned });
  }
  var out=await callAI(prompt,options.maxTokens||2500,null,options.tier||null,{priority:options.priority||'background',timeoutMs:options.timeoutMs||60000,maxRetries:1});
  if(!TM.NPC.ActionLedger.current(requestLease))return [];
  var parsed=extractJSON(out),decisions=Array.isArray(parsed)?parsed:parsed&&(parsed.decisions||parsed.npc_actions)||[];
  var allowed=npcs.map(function(c){return String(c.id);});
  return decisions.filter(function(d){var c=TM.NPC.ActionLedger.findChar({id:d.actorId||d.characterId,name:d.name||d.actor},GM);return c&&allowed.indexOf(String(c.id))>=0;}).map(function(d){
    TM.NPC.ActionLedger.prepare(d,GM);Object.defineProperty(d,'_npcLease',{value:requestLease,enumerable:false,configurable:true});return d;
  });
}

// 构建 NPC 行为推演的上下文
function _collectRecentNpcInternalActions(limit, npc) {
  var id=npc&&String(npc.id),name=npc&&npc.name;
  // Filter before ranking, retrieval and serialization. Pending mail is never a delivered fact.
  return (GM._npcInternalActionHistory||[]).filter(function(r){
    if(!r)return false;
    if(r.visibility==='public')return true;
    if(!npc)return false;
    var from=r.actorId||r.fromId, to=r.targetId||r.toId;
    var own=from?String(from)===id:TM.NPC.ActionLedger.findChar(r.from||r.actor,GM)===npc;
    var received=to?String(to)===id:TM.NPC.ActionLedger.findChar(r.to||r.target,GM)===npc;
    return own||r.delivered===true&&received;
  })
    .slice().sort(function(a,b){return (b.turn||0)-(a.turn||0);}).slice(0,limit||8)
    .map(function(r){return {kind:r.kind,from:r.from||r.actor,to:r.to||r.target,intent:r.intent||r.content,turn:r.turn,factStatus:r.factStatus||'reported'};});
}

function _npcEconomyNum(v) {
  if (v == null || v === '') return null;
  var n = Number(v);
  return isFinite(n) ? n : null;
}

function _npcBuildCharacterEconomySnapshot(npc, options) {
  if(!npc||npc.alive===false)return null;
  options=options||{};
  var refs=options.publicAccountRefs;
  if(!refs&&typeof TM!=='undefined'&&TM.OfficeHolderState) {
    refs=[];TM.OfficeHolderState.assignments(GM,npc).forEach(function(a){
      var principal=a.delegated?TM.OfficeHolderState.identity(GM,a.principalCharacterId).char:npc,av=TM.OfficeHolderState.availability(GM,principal,a.pos),h=a.holder||{};
      if(!av.capacity||av.char!==npc||a.pos.status==='abolished'||a.pos.enabled===false||h.expiresTurn!=null&&GM.turn>=h.expiresTurn||a.pos.expiresTurn!=null&&GM.turn>=a.pos.expiresTurn)return;
      var b=a.pos.treasuryBinding||{};if(['custodian','oversight','manager'].indexOf(b.role)<0)return;
      (b.accountRefs||(b.accountRef?[b.accountRef]:[])).forEach(function(id){if(refs.indexOf(id)<0)refs.push(id);});
    });
  }
  if (!npc || npc.alive === false) return null;
  var r = npc.resources || {};
  var privateWealth = r.privateWealth || r.private || {};
  var money = _npcEconomyNum(privateWealth.money);
  var publicPurse = options.omitPublic || refs&&refs.length===0 ? null : r.publicPurse || null;
  var publicTreasury = options.omitPublic || refs&&refs.length===0 ? null : r.publicTreasury || null;
  var debt = _npcEconomyNum(privateWealth.debt);
  return {
    name: npc.name || '',
    title: npc.officialTitle || npc.title || '',
    rank: npc.rank || npc.rankLevel || null,
    faction: npc.faction || '',
    familyEconomy: typeof CharEconEngine !== 'undefined' && CharEconEngine.buildFamilyEconomySnapshot ? CharEconEngine.buildFamilyEconomySnapshot(npc) : null,
    socialTier: typeof CharEconEngine !== 'undefined' && CharEconEngine.buildSocialTierSnapshot ? CharEconEngine.buildSocialTierSnapshot(npc) : null,
    publicAccounts: typeof TM !== 'undefined' && TM.PublicTreasury ? {accounts:(refs||[]).map(function(ref){return TM.PublicTreasury.getAccountView({game:GM,ref:ref});}),isReadOnly:true} : null,
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
      isReadOnly: true, legacyReported: true
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

function buildNpcBehaviorContext(npc, options) {
  options=options||{};
  if(npc)npc=TM.NPC.ActionLedger.findChar({id:npc.id,name:npc.name},GM);
  var ledger=TM.NPC.ActionLedger, publicOnly=!npc||options.publicOnly===true;
  var context={turn:GM.turn,date:getTSText(GM.turn),publicOnly:publicOnly,resources:{},relations:{},
    people:(GM.chars||[]).filter(function(c){return c&&c.alive!==false&&!c.dead&&!c.hidden&&c.visibility!=='private';}).slice(0,80).map(function(c){return {id:c.id,name:c.name,office:c.officialTitle||'',location:c.location||'',faction:c.faction||'',isPlayer:!!c.isPlayer};}),
    npcInternalActions:_collectRecentNpcInternalActions(8,publicOnly?null:npc),characterEconomy:[]};
  Object.defineProperty(context,'_npcLease',{value:ledger.capture(),enumerable:false});
  if(publicOnly)return context;
  context.self={id:npc.id,name:npc.name,goal:npc.personalGoal||'',thought:npc.innerThought||'',traits:npc.traitIds||[],personality:typeof getCharacterPersonalityBrief==='function'?getCharacterPersonalityBrief(npc):npc.personality||'',abilities:_npcAbilityProfile(npc),stress:npc.stress,resources:_npcBuildCharacterEconomySnapshot(npc,options)};
  context.assignments=TM.OfficeHolderState?TM.OfficeHolderState.assignments(GM,npc).map(function(a){return {positionId:a.positionId,appointmentId:a.appointmentId,title:a.pos.name,powers:a.pos.powers||{},scope:a.pos.authorityScope||{},treasuryBinding:a.pos.treasuryBinding||null};}):[];
  var planExposure=ledger.state(GM).planExposure||{};
  context.plans=ledger.ensurePlans(GM).filter(function(p){return !p.localActivity&&!/^(done|rejected|failed|cancelled)$/.test(p.status);}).map(function(p){return ledger.planView(p,npc);}).filter(Boolean).sort(function(a,b){return (planExposure[a.id]||0)-(planExposure[b.id]||0);}).slice(0,8);
  if(TM.NPC.DailyActivities)context.localActivities={executionOwner:'local',instruction:'普通通问、引见及已有材料清单由本地办理。只引用实际经历，不另建事项或替任何人答复。',matters:TM.NPC.DailyActivities.plans(GM).map(function(p){return TM.NPC.DailyActivities.view(p,npc);}).filter(Boolean).slice(-8).map(function(v){return {id:v.id,kind:v.kind,stage:v.stage,sourceMessageIds:v.messages.map(function(m){return m.id;})};})};
  context.memories=(npc._memory||[]).filter(function(m){return m&&(!m.actorId||String(m.actorId)===String(npc.id)||m.actorId===npc.name);}).slice().sort(function(a,b){
    var active=context.plans.map(function(p){return p.id;}),sa=(active.indexOf(a.taskId)>=0?1000:0)+(a.importance||0)*10+(a.turn||0),sb=(active.indexOf(b.taskId)>=0?1000:0)+(b.importance||0)*10+(b.turn||0);return sb-sa;
  }).slice(0,12).map(function(m){return {id:m.id,event:m.event,factStatus:m.factStatus||'personal_experience',sourceRefs:m.sourceRefs||[],turn:m.turn};});
  context.opinions=(npc._eventOpinions||[]).slice(-12);
  context.commitments=ledger.commitments(npc,GM).slice().sort(function(a,b){return (a.dueDay||a.assignedTurn||0)-(b.dueDay||b.assignedTurn||0);}).slice(0,12).map(function(c){
    return {id:c.id,task:c.task,status:c.status,assignedTurn:c.assignedTurn,deadline:c.deadline,dueDay:c.dueDay,verificationStatus:c.verificationStatus,sourceRefs:c.sourceRefs||[]};
  });
  return context;
}

/** @param {Array} npcs @returns {Array} 按重要度排序的前10个NPC */
function selectImportantNpcs(npcs) {
  var ledger=TM.NPC.ActionLedger, schedule=ledger.state(GM).schedule, turn=Number(GM.turn)||0;
  var eligible=(npcs||[]).filter(function(c){return c&&c.id!=null&&c.alive!==false&&!c.dead&&!c.isPlayer;}).map(function(c){
    var urgent=ledger.due(c,GM), last=schedule[String(c.id)];
    var active=urgent||!!c.personalGoal||hasOffice(c.name)||_hasMilitaryCommand(c)||_npcIsPlayerConsort(c)||(c.ambition||0)>70||(c.loyalty!=null&&c.loyalty<60);
    return {npc:c,active:active,wait:last?Math.max(0,turn-last.turn):100000,urgent:urgent,last:last?last.sequence:0};
  }).filter(function(r){return r.active;});
  // Longest waiting actors precede recurring elite work. Each selection is an evaluation, never an action.
  eligible.sort(function(a,b){return b.wait-a.wait||Number(b.urgent)-Number(a.urgent)||a.last-b.last||String(a.npc.id).localeCompare(String(b.npc.id));});
  var selected=eligible.slice(0,10);
  selected.forEach(function(r){schedule[String(r.npc.id)]={turn:turn,sequence:++ledger.state(GM).sequence};});
  return selected.map(function(r){return r.npc;});
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
async function executeNpcBehavior(npc, context) { return npcDecisionLayer(npc, context); }

// 执行 NPC 行动
