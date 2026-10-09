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

// Planning requests live in the existing ActionLedger state.  They are an
// index over real messages/appointments/goals, not a second goal database.
function _npcPlanningState() {
  var s = TM.NPC.ActionLedger.state(GM);
  if (!s.planning || typeof s.planning !== 'object') s.planning = { version: 1, actors: {}, pending: [], directions: {}, sequence: 0, diagnostics: [], logicalRequests: 0, compatibilityRequests: 0, modelAttempts: 0 };
  if (!s.planning.actors || typeof s.planning.actors !== 'object') s.planning.actors = {};
  if (!Array.isArray(s.planning.pending)) s.planning.pending = [];
  if (!s.planning.directions || typeof s.planning.directions !== 'object') s.planning.directions = {};
  if (!Array.isArray(s.planning.diagnostics)) s.planning.diagnostics = [];
  if (!Number.isFinite(Number(s.planning.logicalRequests))) s.planning.logicalRequests = 0;
  if (!Number.isFinite(Number(s.planning.compatibilityRequests))) s.planning.compatibilityRequests = 0;
  if (!Number.isFinite(Number(s.planning.modelAttempts))) s.planning.modelAttempts = 0;
  if (!Number.isFinite(Number(s.planning.completedSteps))) s.planning.completedSteps = 0;
  if (!Number.isFinite(Number(s.planning.expiredRequests))) s.planning.expiredRequests = 0;
  return s.planning;
}

function _npcPlanningHash(value) {
  var text = typeof value === 'string' ? value : JSON.stringify(value == null ? null : value);
  var n = 2166136261;
  for (var i = 0; i < text.length; i++) { n ^= text.charCodeAt(i); n = Math.imul(n, 16777619); }
  return (n >>> 0).toString(36);
}

function _npcPlanningGoalFingerprint(ch) {
  var rows = Array.isArray(ch && ch.personalGoals) ? ch.personalGoals.map(function (g) {
    return { id: g && g.id || '', version: g && g.version || 1, longTerm: g && g.longTerm || '', shortTerm: g && g.shortTerm || '', priority: g && g.priority || 0, planningDue: !!(g && g.planningDue) };
  }) : [];
  return _npcPlanningHash({ personalGoal: ch && ch.personalGoal || '', personalGoalRevision: ch && ch.personalGoalRevision || 0, planningRequired: !!(ch && ch.personalGoalRequiresPlanning), goals: rows });
}

function _npcPlanningOfficeFingerprint(ch) {
  var rows = [];
  var failed = false;
  try {
    if (TM.OfficeHolderState && typeof TM.OfficeHolderState.assignments === 'function') {
      rows = TM.OfficeHolderState.assignments(GM, ch).map(function (a) {
        var pos = a.pos || {}, tenure = pos._officeTenureState || {};
        return { positionId: a.positionId || pos.id || '', appointmentId: a.appointmentId || '', organizationId: a.organizationId || '', delegated: !!a.delegated, principalCharacterId: a.principalCharacterId || '', dutyMode: pos.dutyMode || pos.tenureType || '', usualDutyLocationId: pos.usualDutyLocationId || '', leave: (tenure.leaves || []).map(function (x) { return { id: x.id || '', status: x.status || '', termsVersion: x.termsVersion || 1, startDay: x.startDay || null, latestReturnDay: x.latestReturnDay || null }; }).sort(function (x, y) { return String(x.id).localeCompare(String(y.id)); }), delegations: (tenure.delegations || []).map(function (x) { return { id: x.id || '', status: x.status || '', delegateId: x.delegateId || x.delegateCharacterId || '', termsVersion: x.termsVersion || 1 }; }).sort(function (x, y) { return String(x.id).localeCompare(String(y.id)); }) };
      });
    }
  } catch (_) { failed = true; }
  // A failed read is not an empty office.  Returning a stable hash for both
  // cases would turn a query error into a false "known" dismissal.
  if (failed) return null;
  rows.sort(function (a, b) { return String(a.positionId).localeCompare(String(b.positionId)) || String(a.appointmentId).localeCompare(String(b.appointmentId)); });
  return _npcPlanningHash(rows);
}

function _npcPlanningIsPlayer(ch) {
  return !!(ch && TM.PoliticalActions && typeof TM.PoliticalActions.controlled === 'function' && TM.PoliticalActions.controlled(ch, GM));
}

function _npcPlanningSourceKey(plan, message) {
  if (!plan || !message) return '';
  return 'message:' + String(plan.id || '') + ':' + String(message.id || '') + ':' + String(message.termsVersion || plan.termsVersion || 1);
}

function _npcPlanningObserveDeliveredMessage(plan, message, game) {
  game = game || GM;
  if (!plan || !message || message.status !== 'delivered' || !game || !Array.isArray(game.chars)) return false;
  var actor = game.chars.find(function (ch) { return ch && String(ch.id) === String(message.toId); });
  if (!actor || actor.alive === false || actor.dead || _npcPlanningIsPlayer(actor) || !_npcPlanningImportantMessage(plan, message)) return false;
  var planning = _npcPlanningState();
  var actorState = planning.actors[String(actor.id)] || (planning.actors[String(actor.id)] = { initialized: false, seenMessages: {}, consumed: {} });
  if (!actorState.knownMessages || typeof actorState.knownMessages !== 'object') actorState.knownMessages = {};
  var key = _npcPlanningSourceKey(plan, message);
  if (!key) return false;
  actorState.knownMessages[key] = {
    planId: String(plan.id || ''), messageId: String(message.id || ''),
    kind: String(message.kind || ''), termsVersion: Number(message.termsVersion || plan.termsVersion || 1),
    knownTurn: Number(game.turn) || 0, knownDay: _npcPlanningDay(),
    sourceVersion: Number(message.data && (message.data.sourceVersion || message.data.goalRevision || message.data.revision) || plan.revision || 1)
  };
  // Office changes are only planning evidence when a delivered notice carries
  // an explicit affected fingerprint.  Reading the current office tree is not
  // proof that this person has learned the change.
  var d = message.data || {};
  if (d.officeFingerprint || d.officeChange === true || /^(appointment|dismissal|dispatch|reform)$/.test(String(message.kind || ''))) {
    var fingerprint = d.officeFingerprint || _npcPlanningOfficeFingerprint(actor);
    if (fingerprint) actorState.knownOfficeFingerprint = fingerprint;
  }
  return true;
}

if (typeof window !== 'undefined') window._npcPlanningObserveDeliveredMessage = _npcPlanningObserveDeliveredMessage;

function _npcPlanningImportantMessage(p, m) {
  if (!p || p.localActivity || !m || m.status !== 'delivered') return false;
  var d = m.data || {}, importance = Number(d.importance);
  if (d.planningRequired === true || d.important === true || d.goalRevision != null || d.replanRequired === true) return true;
  if (isFinite(importance) && importance >= 8) return true;
  return /^(appointment|dismissal|dispatch|reform|treaty|war|command|major_change|goal_revision)$/.test(String(m.kind || ''));
}

function _npcPlanningHasSource(planning, actorId, sourceKey) {
  return planning.pending.some(function (q) { return q && q.actorId === actorId && q.sourceKey === sourceKey && !/^(cancelled|superseded)$/.test(q.status); }) || Object.keys(planning.directions).some(function (id) {
    var d = planning.directions[id]; return d && d.actorId === actorId && d.sourceKey === sourceKey && !/^(cancelled|superseded)$/.test(d.status);
  });
}

function _npcQueuePlanningRequest(planning, actor, kind, sourceKey, reason, details) {
  if (!actor || !sourceKey || _npcPlanningHasSource(planning, String(actor.id), sourceKey)) return null;
  var day = _npcPlanningDay(), turn = Number(GM.turn) || 0;
  var request = Object.assign({
    id: 'npc-plan-request:' + _npcPlanningHash([actor.id, sourceKey]), actorId: String(actor.id), kind: kind, sourceKey: sourceKey,
    reason: reason || '', createdTurn: turn, knownDay: day,
    status: 'pending', attempts: 0, notBeforeTurn: turn, expiresTurn: turn + 12,
    createdDay: day, notBeforeDay: day, expiresDay: day + 12,
    processingToken: '', processingTurn: null, dependencyFingerprint: ''
  }, details || {});
  planning.pending.push(request);
  planning.diagnostics.push({ type: 'queued', requestId: request.id, actorId: request.actorId, sourceKey: sourceKey, kind: kind, turn: GM.turn, reason: request.reason });
  if (planning.diagnostics.length > 160) planning.diagnostics.splice(0, planning.diagnostics.length - 160);
  return request;
}

function _npcPlanningRequestStillValid(request, actor) {
  if (!request || !actor || String(request.actorId) !== String(actor.id)) return { ok: false, reason: 'planning_actor_changed' };
  if (_npcPlanningIsPlayer(actor)) return { ok: false, reason: 'planning_actor_is_player' };
  if (request.goalFingerprint && request.goalFingerprint !== _npcPlanningGoalFingerprint(actor)) return { ok: false, reason: 'planning_goal_changed' };
  if (request.officeFingerprint) {
    var office = _npcPlanningOfficeFingerprint(actor);
    if (!office || office !== request.officeFingerprint) return { ok: false, reason: 'planning_office_changed' };
  }
  if (request.planId && request.messageId) {
    var sourcePlan = (GM._npcPlans || []).find(function (p) { return p && String(p.id) === String(request.planId); });
    var sourceMessage = sourcePlan && (sourcePlan.messages || []).find(function (m) { return m && String(m.id) === String(request.messageId); });
    if (!sourceMessage || sourceMessage.status !== 'delivered') return { ok: false, reason: 'planning_source_not_delivered' };
    if (request.termsVersion != null && Number(sourceMessage.termsVersion || sourcePlan.termsVersion || 1) !== Number(request.termsVersion)) return { ok: false, reason: 'planning_source_version_changed' };
    if (request.sourceVersion != null && Number(sourceMessage.data && (sourceMessage.data.sourceVersion || sourceMessage.data.goalRevision || sourceMessage.data.revision) || sourcePlan.revision || 1) !== Number(request.sourceVersion)) return { ok: false, reason: 'planning_source_version_changed' };
  }
  return { ok: true };
}

function _npcPlanningReconcile(planning, chars) {
  var day = _npcPlanningDay(), turn = Number(GM.turn) || 0;
  planning.pending.forEach(function (q) {
    if (!q || /^(accepted|no_change|waiting|unsupported|expired|failed|cancelled|superseded)$/.test(q.status)) return;
    if (q.status === 'processing' && Number(q.processingTurn || 0) < turn) {
      q.status = 'failed'; q.lastError = 'planning_processing_recovered'; q.retryAfterTurn = turn;
    }
    if ((q.expiresDay != null && day > Number(q.expiresDay)) || (q.expiresTurn != null && turn > Number(q.expiresTurn))) {
      q.status = 'expired'; q.expiredTurn = turn; q.expiredDay = day; q.expiredReason = 'planning_request_expired';
      planning.expiredRequests = Number(planning.expiredRequests || 0) + 1;
    }
  });
  Object.keys(planning.directions || {}).forEach(function (id) {
    var direction = planning.directions[id];
    if (!direction || /^(completed|cancelled|superseded|ended)$/.test(direction.status)) return;
    if (direction.reviewDay != null && day >= Number(direction.reviewDay) && Number(direction.reviewedDay || -1) < day) {
      direction.reviewedDay = day;
      var waiting = (direction.steps || []).some(function (s) { return /^(waiting|blocked|needs_revision)$/.test(s.status); });
      var open = (direction.steps || []).some(function (s) { return !/^(completed|cancelled|rejected|expired)$/.test(s.status); });
      if (!open) direction.status = 'completed';
      else if (waiting) direction.status = direction.status === 'active' ? 'waiting' : direction.status;
    }
  });
}

function _npcCollectPlanningTriggers(npcs) {
  var planning = _npcPlanningState(), out = [], chars = npcs || (GM && GM.chars) || [];
  _npcPlanningReconcile(planning, chars);
  chars.filter(function (c) { return c && c.id != null && c.alive !== false && !c.dead && !_npcPlanningIsPlayer(c); }).forEach(function (ch) {
    var id = String(ch.id), actorState = planning.actors[id] || (planning.actors[id] = { initialized: false, seenMessages: {}, consumed: {} });
    if (!actorState.seenMessages || typeof actorState.seenMessages !== 'object') actorState.seenMessages = {};
    var goalFingerprint = _npcPlanningGoalFingerprint(ch), officeFingerprint = _npcPlanningOfficeFingerprint(ch);
    var first = !actorState.initialized;
    if (first) actorState.initialized = true;
    if (first && String(ch.personalGoal || '').trim() && !(TM.NPC.LocalAI && typeof TM.NPC.LocalAI.localOnlyDue === 'function' && TM.NPC.LocalAI.localOnlyDue(ch))) {
      var initialGoalKey = 'goal-initial:' + id + ':' + goalFingerprint;
      if (_npcQueuePlanningRequest(planning, ch, 'goal_initial', initialGoalKey, '本人已有一个尚未展开的长期打算，首次进入具体规划点。', { goalFingerprint: goalFingerprint })) actorState.goalPlanningQueued = true;
    }
    // The world office tree is a validity check.  A planning trigger requires
    // a delivered notice (recorded as knownOfficeFingerprint), not a backend
    // diff that the character has not yet learned.
    if (!first && actorState.knownOfficeFingerprint && actorState.officeFingerprint && actorState.knownOfficeFingerprint !== actorState.officeFingerprint) {
      var officeKey = 'office:' + id + ':' + officeFingerprint;
      _npcQueuePlanningRequest(planning, ch, 'office_change', officeKey, '本人已收到任职或差遣变化的通知，需要重新安排未来事务。', { officeFingerprint: officeFingerprint, knownOfficeFingerprint: actorState.knownOfficeFingerprint });
    }
    if (!first && actorState.goalFingerprint && actorState.goalFingerprint !== goalFingerprint) {
      var goalKey = 'goal:' + id + ':' + goalFingerprint;
      _npcQueuePlanningRequest(planning, ch, 'goal_revision', goalKey, '本人已有目标或短期打算发生实质修订，需要重新选择后续。', { goalFingerprint: goalFingerprint });
    }
    // Bare personalGoal text is not a per-turn model trigger.  A goal only
    // enters planning when the producer marks a concrete planning review.
    if ((ch.personalGoalRequiresPlanning === true || Array.isArray(ch.personalGoals) && ch.personalGoals.some(function (g) { return g && g.planningDue === true; })) && !actorState.goalPlanningQueued) {
      var initialGoalKey = 'goal-review:' + id + ':' + goalFingerprint;
      if (_npcQueuePlanningRequest(planning, ch, 'goal_review', initialGoalKey, '已有目标进入明确的规划复核点。', { goalFingerprint: goalFingerprint })) actorState.goalPlanningQueued = true;
    }
    (GM._npcPlans || []).forEach(function (p) {
      if (!p || p.localActivity) return;
      var messages = Array.isArray(p.messages) ? p.messages : [];
      messages.forEach(function (m) {
        if (!m || String(m.toId) !== id || m.status !== 'delivered' || !_npcPlanningImportantMessage(p, m)) return;
        _npcPlanningObserveDeliveredMessage(p, m, GM);
        var sourceKey = _npcPlanningSourceKey(p, m);
        if (actorState.seenMessages[sourceKey]) return;
        actorState.seenMessages[sourceKey] = Number(GM.turn) || 0;
        _npcQueuePlanningRequest(planning, ch, 'important_message', sourceKey, '本人实际收到的重要消息改变了现有安排。', { planId: p.id, messageId: m.id, termsVersion: m.termsVersion || p.termsVersion || 1, sourceVersion: Number(m.data && (m.data.sourceVersion || m.data.goalRevision || m.data.revision) || p.revision || 1), goalFingerprint: goalFingerprint, officeFingerprint: actorState.knownOfficeFingerprint || '' });
      });
      if (p.status === 'needs_replan' && String(p.nextActorId || '') === id) {
        var replanKey = 'replan:' + String(p.id) + ':' + String(p.revision || 1);
        _npcQueuePlanningRequest(planning, ch, 'plan_revision', replanKey, '已有事项失去前提或需要新的方向选择。', { planId: p.id, revision: p.revision || 1 });
      }
    });
    actorState.goalFingerprint = goalFingerprint;
    if (officeFingerprint) actorState.officeFingerprint = officeFingerprint;
    planning.pending.forEach(function (q) {
      var retryReady = q && q.status === 'failed' && Number(q.attempts || 0) < 2 && (q.retryAfterDay == null || Number(q.retryAfterDay) <= _npcPlanningDay());
      if (q && q.actorId === id && (q.status === 'pending' || retryReady) && Number(q.notBeforeTurn || 0) <= Number(GM.turn || 0) && Number(q.expiresTurn || 0) >= Number(GM.turn || 0)) out.push({ actor: ch, request: q });
    });
  });
  return out;
}

function _npcPlanningCandidates(npcs) {
  return _npcCollectPlanningTriggers(npcs).filter(function (x) { return x.request.attempts < 2 && /^(pending|failed)$/.test(x.request.status); });
}

function _npcPlanningMarkRequest(request, status, extra) {
  if (!request) return;
  request.status = status;
  request.lastAttemptTurn = Number(GM.turn) || 0;
  Object.assign(request, extra || {});
  if (/^(accepted|no_change|waiting|unsupported|expired|failed)$/.test(status)) request.processingToken = '';
}

function _npcPlanningGoalReady(goal) {
  if (!goal || !goal.planningDirectionId || !goal.planningStepId) return true;
  var planning = _npcPlanningState(), direction = planning.directions[String(goal.planningDirectionId)];
  if (!direction) return false;
  var step = (direction.steps || []).find(function (s) { return String(s.id || s.goalId) === String(goal.planningStepId) || String(s.goalId) === String(goal.id); });
  if (!step || /^(blocked|waiting|needs_revision|rejected|cancelled|expired)$/.test(step.status)) return false;
  return (step.dependsOn || []).every(function (dependency) {
    var prior = (direction.steps || []).find(function (s) { return String(s.id || s.goalId) === String(dependency); });
    return prior && prior.status === 'completed';
  });
}

if (typeof window !== 'undefined') window._npcPlanningGoalReady = _npcPlanningGoalReady;

function _npcPlanningStepResult(actorId, sourceGoalId, receipt) {
  if (!sourceGoalId) return;
  var planning = _npcPlanningState();
  var ownerId = receipt && (receipt.planningOwnerId || receipt.planOwnerId || receipt.ownerId) || actorId;
  Object.keys(planning.directions).forEach(function (id) {
    var direction = planning.directions[id];
    if (!direction || direction.actorId !== String(ownerId)) return;
    var step = (direction.steps || []).find(function (s) { return s.goalSource === sourceGoalId || s.goalId === sourceGoalId; });
    if (!step) return;
    var wasCompleted = step.status === 'completed';
    step.lastOutcome = receipt && receipt.outcome || '';
    step.lastReason = receipt && receipt.reason || '';
    if (!receipt) return;
    if (/^(submitted|started)$/.test(receipt.outcome)) step.status = 'started';
    else if (receipt.outcome === 'waiting' || receipt.outcome === 'partial') step.status = 'waiting';
    else if (receipt.outcome === 'completed' && receipt.verified !== false) step.status = 'completed';
    else if (receipt.outcome === 'rejected') step.status = 'rejected';
    else if (receipt.outcome === 'cancelled') step.status = 'cancelled';
    else if (receipt.outcome === 'expired') step.status = 'expired';
    else if (receipt.outcome === 'blocked' || receipt.outcome === 'failed') step.status = 'needs_revision';
    if (step.status === 'completed' && !wasCompleted) {
      planning.completedSteps = Number(planning.completedSteps || 0) + 1;
      step.lastCompletionTurn = Number(GM.turn) || 0;
      (direction.steps || []).forEach(function (next) {
        if (next.status !== 'pending' && next.status !== 'blocked') return;
        if ((next.dependsOn || []).every(function (dependency) {
          var prior = (direction.steps || []).find(function (s) { return String(s.id || s.goalId) === String(dependency); });
          return prior && prior.status === 'completed';
        })) {
          next.status = 'ready';
          var owner = (GM.chars || []).find(function (c) { return String(c.id) === String(direction.actorId); });
          if (owner && Array.isArray(owner.localGoals)) owner.localGoals.forEach(function (goal) { if (goal && goal.planningDirectionId === direction.id && goal.planningStepId === next.id) goal.status = 'active'; });
        }
      });
    }
    if (step.status === 'rejected' || step.status === 'needs_revision') {
      (direction.steps || []).forEach(function (next) { if ((next.dependsOn || []).indexOf(step.id) >= 0 && next.status === 'pending') next.status = 'blocked'; });
      direction.status = 'needs_revision';
    }
    var active = (direction.steps || []).filter(function (s) { return !/^(completed|cancelled|rejected|expired)$/.test(s.status); });
    if (!active.length) direction.status = 'completed';
  });
}

if (typeof window !== 'undefined') window._npcPlanningStepResult = _npcPlanningStepResult;

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

function _npcPlanningDay() {
  if (TM.SimTime && typeof TM.SimTime.now === 'function') return Number(TM.SimTime.now(GM)) || 0;
  return typeof getCurrentGameDay === 'function' ? Number(getCurrentGameDay()) || 0 : Number(GM && GM.turn || 0);
}

function _npcPlanningValidStep(actor, step, directionId, index, stepId, dependsOn) {
  step = step || {};
  var kind = String(step.kind || step.activityKind || '').trim();
  if (!/^(greeting|introduction|assistance|consultation|meeting)$/.test(kind)) return null;
  var D = TM.NPC && TM.NPC.DailyActivities;
  if (!D || typeof D.person !== 'function' || typeof D.knows !== 'function') return null;
  var target = D.person(step.targetId, GM);
  if (!target || target === actor || !D.knows(actor, target, GM)) return null;
  var third = null;
  if (kind === 'introduction') {
    third = D.person(step.thirdPartyId, GM);
    if (!third || third === actor || third === target || !D.knows(actor, third, GM)) return null;
  }
  var goal = { id: 'npc-model-step:' + directionId + ':' + index, version: 1, status: dependsOn && dependsOn.length ? 'blocked' : 'active', kind: kind, targetId: String(target.id), thirdPartyId: third && String(third.id) || '', source: 'model-planning', modelPlanId: directionId, planningDirectionId: directionId, planningStepId: stepId, planningDependsOn: (dependsOn || []).slice(), stepIndex: index, reason: String(step.reason || step.intent || ''), planningSourceKey: String(step.sourceKey || '') };
  if (kind === 'assistance') {
    if (!step.task || typeof step.task !== 'object') return null;
    goal.task = step.task;
  }
  if (kind === 'consultation') {
    var opportunities = typeof D.consultationOpportunities === 'function' ? D.consultationOpportunities(actor, GM) : [];
    var consultation = step.consultation && typeof step.consultation === 'object' ? step.consultation : {};
    var topicId = String(consultation.topicId || step.topicId || '');
    var sourceOpportunity = consultation.sourceOpportunity || step.sourceOpportunity;
    var match = opportunities.find(function (o) { return o && o.sendable !== false && o.action && String(o.action.targetId) === String(target.id) && o.action.consultation && String(o.action.consultation.topicId) === topicId && (!sourceOpportunity || o.action.consultation.sourceOpportunity && o.action.consultation.sourceOpportunity.key === sourceOpportunity.key); });
    if (!match) return null;
    goal.consultation = { topicId: topicId, question: String(consultation.question || match.action.consultation.question || ''), sourceOpportunity: match.action.consultation.sourceOpportunity, preferredExchange: consultation.preferredExchange || match.action.consultation.preferredExchange };
  }
  if (kind === 'meeting') goal.meeting = step.meeting || null;
  goal.sourceGoalKey = goal.id + ':1';
  return goal;
}

function _applyNpcPlanningProposal(actor, request, proposal, lease) {
  if (!actor || !request || !proposal || !lease || !TM.NPC.ActionLedger.current(lease)) return { ok: false, reason: 'planning_world_changed' };
  var planning = _npcPlanningState(), current = planning.pending.find(function (q) { return q.id === request.id && /^(pending|processing)$/.test(q.status); });
  if (!current || current.actorId !== String(actor.id) || current.sourceKey !== request.sourceKey) return { ok: false, reason: 'planning_trigger_stale' };
  var requestValidity = _npcPlanningRequestStillValid(current, actor);
  if (!requestValidity.ok) { _npcPlanningMarkRequest(current, 'expired', { expiredReason: requestValidity.reason }); return { ok: false, reason: requestValidity.reason }; }
  var directionId = 'npc-direction:' + request.id, rawSteps = Array.isArray(proposal.nextSteps) ? proposal.nextSteps : Array.isArray(proposal.steps) ? proposal.steps : [];
  rawSteps = rawSteps.slice(0, 4);
  if (!rawSteps.length) return { ok: false, reason: 'planning_no_supported_steps' };
  var stepIds = rawSteps.map(function (step, index) { return String(step && (step.id || step.stepId) || 'step-' + index); });
  var deps = rawSteps.map(function (step, index) {
    var raw = step && (step.dependsOn != null ? step.dependsOn : step.after != null ? [step.after] : []);
    return (Array.isArray(raw) ? raw : [raw]).filter(function (v) { return v != null && String(v) !== ''; }).map(String);
  });
  var entries = rawSteps.map(function (step, index) { return { raw: step, id: stepIds[index], dependsOn: deps[index], goal: _npcPlanningValidStep(actor, step, directionId, index, stepIds[index], deps[index]) }; });
  var invalidDependent = entries.some(function (entry) { return !entry.goal && deps.some(function (list) { return list.indexOf(entry.id) >= 0; }); });
  if (invalidDependent) return { ok: false, reason: 'planning_dependency_step_unsupported' };
  var valid = entries.filter(function (entry) { return !!entry.goal; });
  if (!valid.length) return { ok: false, reason: 'planning_steps_not_executable' };
  var validIds = valid.map(function (entry) { return entry.id; });
  if (valid.some(function (entry) { return entry.dependsOn.some(function (dep) { return validIds.indexOf(dep) < 0; }); })) return { ok: false, reason: 'planning_dependency_unknown' };
  var guard = TM.AIChange && TM.AIChange.WriteGuards;
  if (!guard || typeof guard.runAtomicMutation !== 'function') return { ok: false, reason: 'atomic_writer_unavailable' };
  var result = { ok: false, reason: 'planning_not_committed' };
  var committed = guard.runAtomicMutation(function () {
    if (!TM.NPC.ActionLedger.current(lease)) throw Error('planning_world_changed');
    var goals = Array.isArray(actor.localGoals) ? actor.localGoals : (actor.localGoals = []);
    valid.forEach(function (entry) {
      var goal = entry.goal;
      if (!goals.some(function (old) { return old && old.id === goal.id; })) goals.push(goal);
    });
    var proposedReviewDay = Number(proposal.reviewDay), currentPlanningDay = _npcPlanningDay();
    var reviewDay = Number.isFinite(proposedReviewDay) && proposedReviewDay >= currentPlanningDay ? proposedReviewDay : currentPlanningDay + 7;
    var unsupported = entries.filter(function (entry) { return !entry.goal; });
    var direction = { id: directionId, actorId: String(actor.id), sourceKey: request.sourceKey, sourceKind: request.kind, objective: String(proposal.objective || proposal.intent || request.reason || ''), status: unsupported.length ? 'needs_revision' : 'active', createdTurn: Number(GM.turn) || 0, createdDay: currentPlanningDay, reviewDay: reviewDay, unsupportedSteps: unsupported.map(function (entry) { return { id: entry.id, reason: 'planning_step_unsupported' }; }), steps: entries.map(function (entry) {
      if (!entry.goal) return { id: entry.id, goalId: '', goalSource: '', kind: String(entry.raw && (entry.raw.kind || entry.raw.activityKind) || ''), status: 'needs_revision', dependsOn: entry.dependsOn.slice(), targetId: String(entry.raw && entry.raw.targetId || ''), reason: 'planning_step_unsupported' };
      var goal = entry.goal; return { id: entry.id, goalId: goal.id, goalSource: goal.sourceGoalKey, kind: goal.kind, status: entry.dependsOn.length ? 'blocked' : 'ready', dependsOn: entry.dependsOn.slice(), targetId: goal.targetId };
    }) };
    planning.directions[directionId] = direction;
    _npcPlanningMarkRequest(current, 'accepted', { directionId: directionId, acceptedTurn: Number(GM.turn) || 0, unsupportedSteps: unsupported.map(function (entry) { return entry.id; }) });
    planning.diagnostics.push({ type: 'accepted', requestId: current.id, actorId: String(actor.id), directionId: directionId, steps: valid.length, turn: GM.turn });
    if (planning.diagnostics.length > 160) planning.diagnostics.splice(0, planning.diagnostics.length - 160);
    result = { ok: true, directionId: directionId, steps: valid.length };
    return result;
  });
  return committed && committed.ok === true ? committed : result;
}

function _npcApplyPlanningOutput(actor, request, decision, lease) {
  var proposal = decision && (decision.planning || decision.planDirection || decision.direction || decision.plan);
  if (!proposal) return { ok: false, reason: 'planning_proposal_missing' };
  return _applyNpcPlanningProposal(actor, request, proposal, lease);
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
  if (typeof _npcPlanningStepResult === 'function' && decision.sourceGoalId) _npcPlanningStepResult(npc.id, decision.sourceGoalId, receipt);
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
    if (summary && /^(no_candidates|no_planning_trigger|missing_ai_key)$/.test(summary.skipped || '')) {
      state.stopped = true;
      state.stopReason = summary.skipped;
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
  var planningRows = typeof _npcPlanningCandidates === 'function' ? _npcPlanningCandidates(GM.chars || []) : [];
  var hasLegacyDue = TM.NPC && TM.NPC.ActionLedger && (GM.chars || []).some(function (c) { return c && !c.isPlayer && (TM.NPC.ActionLedger.due(c, GM) || c._npcMajorDecisionPending === true); });
  var hasLegacyAttention = (GM.chars || []).some(function (c) {
    return c && !c.isPlayer && (hasLegacyDue || typeof hasOffice === 'function' && hasOffice(c.name) || typeof _hasMilitaryCommand === 'function' && _hasMilitaryCommand(c) || typeof _npcIsPlayerConsort === 'function' && _npcIsPlayerConsort(c) || Number(c.ambition || 0) > 70 || c.loyalty != null && Number(c.loyalty) < 60);
  });
  if (!planningRows.length && !hasLegacyDue && !hasLegacyAttention) return false;
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
  var planningRows=_npcPlanningCandidates(GM.chars), planningState=_npcPlanningState();
  if(!P.ai||!P.ai.key)return {skipped:'missing_ai_key',local:local,planningRequests:planningRows.length,modelCalls:0};
  var budget=ledger.state(GM);
  if(budget.modelTurn!==GM.turn){budget.modelTurn=GM.turn;budget.modelCalls=0;}
  if(budget.modelCalls>=3)return {skipped:'turn_model_budget'};
  var actors=selectImportantNpcs(GM.chars), privateSchedule=budget.privateSchedule || (budget.privateSchedule={});
  var sensitive=planningRows.slice().sort(function(a,b){return (privateSchedule[a.actor.id]||0)-(privateSchedule[b.actor.id]||0);}).slice(0,2);
  sensitive.forEach(function(row){privateSchedule[row.actor.id]=++budget.sequence;});
  var batches=sensitive.map(function(row){return {npcs:[row.actor],privateActorId:row.actor.id,planningRequest:row.request};});
  // Unmanaged, non-local obligations keep the existing compatibility path.
  // Office rank, ambition and loyalty alone do not make a model request.
  // Planning and compatibility work are separate obligations.  A planning
  // trigger on one NPC must not starve an unrelated legacy obligation on the
  // same NPC, and a local activity must not be re-run by this batch.
  var legacyActors=actors.filter(function(c){
    var planningOwnedDue = (ledger.ensurePlans ? ledger.ensurePlans(GM) : []).some(function(p){
      if(!p || p.localActivity || String(p.nextActorId||'')!==String(c.id) || /^(done|failed|cancelled|rejected)$/.test(p.status)) return false;
      return (p.messages||[]).some(function(m){var d=m&&m.data||{};return d.planningRequired===true||d.replanRequired===true||d.goalRevision!=null;});
    });
    var legacyDue = ledger.due(c,GM) && !planningOwnedDue;
    return (legacyDue || c._npcMajorDecisionPending===true) && !planningRows.some(function(row){return String(row.actor.id)===String(c.id) && row.request && row.request.kind === 'compatibility';});
  });
  if(legacyActors.length)batches.push({npcs:legacyActors});
  if(!batches.length)return {skipped:'no_planning_trigger',local:local,considered:actors.length,planningRequests:0,modelCalls:0};
  var executed=0,decided=0,called=0,planningAccepted=0,planningEvaluated=0;
  for(var i=0;i<batches.length&&ledger.state(GM).modelCalls<3;i++){
    if(!ledger.current(lease))return {skipped:'expired',executed:executed};
    var batch=batches[i],ctx=buildNpcBehaviorContext(batch.privateActorId?batch.npcs[0]:null);
    if(batch.planningRequest)ctx.planningTrigger=Object.assign({},batch.planningRequest);
    if(batch.planningRequest){
      var processingToken='npc-planning-attempt:'+_npcPlanningHash([batch.planningRequest.id,GM.sid||'',GM.turn,Date.now()]);
      _npcPlanningMarkRequest(batch.planningRequest,'processing',{processingToken:processingToken,processingTurn:Number(GM.turn)||0,lastAttemptTurn:Number(GM.turn)||0});
    }
    called++;
    try{
      var ds=await batchNpcDecisions(batch.npcs,ctx,Object.assign({},options,{privateActorId:batch.privateActorId,planningRequest:batch.planningRequest || null}));
      if(!ledger.current(lease))return {skipped:'expired',executed:executed};
      if(batch.planningRequest){
        planningEvaluated++;
        var accepted=false, applyReason='';
        ds.forEach(function(d){
          decided++;
          // A planning request is a direction-only contract.  Even if a
          // model returns a normal behavior beside its proposal, do not let
          // this batch bypass LocalAI's ordinary activity owner.
          if(d && Object.prototype.hasOwnProperty.call(d,'planning')){var applied=d.planning&&_applyNpcPlanningProposal(batch.npcs[0],batch.planningRequest,d.planning,lease) || {ok:false,reason:'planning_no_change'};applyReason=applied.reason||applyReason;if(applied.ok){accepted=true;planningAccepted++;}return;}
        });
        if(!accepted){
          var explicit = ds.find(function(d){return d && Object.prototype.hasOwnProperty.call(d,'planning');});
          var proposal = explicit && explicit.planning;
          var nextStatus = /stale|changed|expired|not_delivered|world_changed/.test(applyReason) ? 'expired' : proposal && (proposal.waitFor || proposal.waitingFor) ? 'waiting' : proposal === null ? 'no_change' : explicit ? 'unsupported' : 'no_change';
          _npcPlanningMarkRequest(batch.planningRequest,nextStatus,{evaluatedTurn:Number(GM.turn)||0,cooldownUntilTurn:(Number(GM.turn)||0)+3,waitFor:proposal&& (proposal.waitFor || proposal.waitingFor) || null,
            unsupportedReason:nextStatus==='unsupported'?'planning_no_supported_steps':''});
          planningState.diagnostics.push({type:nextStatus,requestId:batch.planningRequest.id,actorId:batch.planningRequest.actorId,turn:GM.turn});
        }
      } else ds.forEach(function(d){decided++;if(_executeNormalizedNpcDecision(d,null,ctx,options))executed++;});
    }catch(error){
      if(!ledger.current(lease))return {skipped:'expired',executed:executed};
      if(batch.planningRequest){batch.planningRequest.attempts=Number(batch.planningRequest.attempts||0)+1;var failedStatus=batch.planningRequest.attempts>=2?'failed':'failed';_npcPlanningMarkRequest(batch.planningRequest,failedStatus,{lastError:String(error.message||error),retryAfterTurn:(Number(GM.turn)||0)+1,retryAfterDay:_npcPlanningDay()+1,processingToken:''});}
      _recordNpcDecisionDiagnostic({source:'npc-autonomy'},'failed',String(error.message||error));
      // The next simulation turn may retry; no multiplying fallback calls.
    }
  }
  return {considered:actors.length,decisions:decided,executed:executed,modelCalls:called,planningRequests:planningEvaluated,planningAccepted:planningAccepted,idle:!!options.idle};
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
  var planningStats=_npcPlanningState();
  if(options.planningRequest)planningStats.logicalRequests=Number(planningStats.logicalRequests||0)+1;
  else planningStats.compatibilityRequests=Number(planningStats.compatibilityRequests||0)+1;
  planningStats.modelAttempts=Number(planningStats.modelAttempts||0)+1;
  var privateActor=npcs.length===1&&String(options.privateActorId||'')===String(npcs[0].id);
  var packet=privateActor?buildNpcBehaviorContext(npcs[0]):buildNpcBehaviorContext();
  if(options.planningRequest)packet.planningTrigger=Object.assign({},options.planningRequest);
  if(privateActor){
    var exposure=modelBudget.planExposure||(modelBudget.planExposure={});
    (packet.plans||[]).forEach(function(p){exposure[p.id]=++modelBudget.sequence;});
  }
  packet.actors=npcs.map(function(c){return {id:c.id,name:c.name,office:c.officialTitle||'',location:c.location||''};});
  var prompt='依据收到的信息选择行动，允许无事、等待、拒绝和改条件。禁止替玩家作决定。私人请求不表示对方同意；完成必须由程序核验。\n';
  prompt+='共享批次只含公开背景；未列出的私人事实不可推测为已知。\n';
  prompt+='行为类型：'+NpcBehaviorRegistry.list().join(',')+'。返回 JSON 数组 [{actorId,name,behaviorType,targetId,target,intent,shouldExecute,planId,phase,response,content,step,actingPositionId,appointmentId,positionId,task}]。office_duty 需具体事项：报告用 step=report 和实际 content；移交用 step=transfer 和明确账户、用途、金额。无事返回 none。\n';
  prompt+='已有事项使用 planId 与 nextPhase；respond 可 accept/reject/conditions/defer/partial；agree 可 accept/reject；perform 提供实际文书 content；feedback 表达收件评价。新请求 task.kind=document，公库协办可 public_transfer，必须具体 fromAccount/toAccount/amounts。不得自造完成凭据。\n';
  if(options.planningRequest)prompt+='当前有一个本人已知的重要变化，必须优先给出可持续方向而非直接宣布结果。可返回 planning:{objective,reviewDay,nextSteps:[{kind,targetId,thirdPartyId,task,consultation,meeting,reason}]}；nextSteps 只能使用已有普通机制，不能替任何人同意、付款、任命或瞬移。若无需新方向，返回 planning:null。\n';
  prompt+=JSON.stringify(packet);
  // 涉议名单只取本批已在公开/本人上下文中的人物，沿用时空约束。
  if (typeof _buildTemporalConstraint === 'function') {
    var _ndMentioned = (npcs || []).map(function(c){return c.name;}).filter(Boolean);
    prompt += _buildTemporalConstraint(null, { clauseOnly: true, mentionedNames: _ndMentioned });
  }
  var out=await callAI(prompt,options.maxTokens||2500,null,options.tier||null,{priority:options.priority||'background',timeoutMs:options.timeoutMs||60000,maxRetries:1});
  if(!TM.NPC.ActionLedger.current(requestLease))return [];
  var parsed=extractJSON(out),decisions=Array.isArray(parsed)?parsed:parsed&&(parsed.decisions||parsed.npc_actions)||[];
  if(parsed&&!Array.isArray(parsed)&&Object.prototype.hasOwnProperty.call(parsed,'planning')){
    decisions=decisions.slice();
    decisions.push({actorId:parsed.actorId||privateActor&&npcs[0].id,name:parsed.name||privateActor&&npcs[0].name,planning:parsed.planning,shouldExecute:false,behaviorType:'none'});
  }
  if(parsed&&!Array.isArray(parsed)&&Array.isArray(parsed.plans)){
    decisions=decisions.concat(parsed.plans.map(function(plan){return {actorId:plan.actorId||privateActor&&npcs[0].id,name:plan.name||privateActor&&npcs[0].name,planning:plan.planning||plan,shouldExecute:false,behaviorType:'none'};}));
  }
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
  var eligible=(npcs||[]).filter(function(c){return c&&c.id!=null&&c.alive!==false&&!c.dead&&!_npcPlanningIsPlayer(c);}).map(function(c){
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
