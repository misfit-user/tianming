// tm-npc-action-ledger.js - unified character NPC action ledger.
(function(global) {
  'use strict';

  var TM = global.TM = global.TM || {};
  TM.NPC = TM.NPC || {};

  function _gm() { return global.GM || null; }
  function _p() { return global.P || {}; }
  function _arr(v) { return Array.isArray(v) ? v : []; }
  function _str(v) { return String(v == null ? '' : v).trim(); }
  function safeId(v) { return /^[A-Za-z0-9_.:/-]{1,200}$/.test(_str(v)); }
  function _turn(g) {
    var n = Number(g && g.turn);
    return isFinite(n) ? n : 0;
  }
  function _uid(prefix) {
    if (typeof global.uid === 'function') {
      try { return global.uid(); } catch(_) {}
    }
    return (prefix || 'npcact') + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  }

  function ensureLedger(g) {
    g = g || _gm();
    if (!g) return [];
    if (!Array.isArray(g._npcActionLedger)) g._npcActionLedger = [];
    return g._npcActionLedger;
  }

  function ensureDiagnostics(g) {
    g = g || _gm();
    if (!g) return [];
    if (!Array.isArray(g._npcDecisionDiagnostics)) g._npcDecisionDiagnostics = [];
    return g._npcDecisionDiagnostics;
  }

  function ensurePlans(g) {
    g = g || _gm();
    if (!g) return [];
    if (!Array.isArray(g._npcPlans)) g._npcPlans = [];
    return g._npcPlans;
  }

  function getHandledNames(g) {
    g = g || _gm();
    if (!g) return [];
    if (!g._turnContext) g._turnContext = {};
    if (!Array.isArray(g._turnContext.npcActionsThisTurn)) g._turnContext.npcActionsThisTurn = [];
    return g._turnContext.npcActionsThisTurn;
  }

  function markHandled(name, g) {
    name = _str(name);
    if (!name) return false;
    var handled = getHandledNames(g);
    if (handled.indexOf(name) < 0) handled.push(name);
    return true;
  }

  function isHandled(name, g) {
    name = _str(name);
    return !!name && getHandledNames(g).indexOf(name) >= 0;
  }

  function findChar(ref, world) {
    var g = world || _gm(), id = ref && typeof ref === 'object' ? _str(ref.characterId != null ? ref.characterId : ref.id) : '';
    var name = ref && typeof ref === 'object' ? _str(ref.name || ref.actor) : _str(ref);
    var chars = _arr(g && g.chars);
    var matches = chars.filter(function(c) { return c && (id ? _str(c.id) === id : !!name && c.name === name); });
    return matches.length === 1 ? matches[0] : null;
  }

  function inferKind(raw, opts) {
    raw = raw || {};
    opts = opts || {};
    if (opts.kind) return opts.kind;
    if (raw.kind) return raw.kind;
    var source = _str(raw.source || opts.source).toLowerCase();
    if (source.indexOf('npc_interactions') >= 0) return 'npc_interaction';
    if (source.indexOf('npc_letters') >= 0) return 'npc_letter';
    if (source.indexOf('npc_correspondence') >= 0) return 'npc_correspondence';
    if (source.indexOf('wendui') >= 0 || source.indexOf('commitment') >= 0) return 'npc_commitment';
    return 'npc_action';
  }

  function inferUiRoutes(kind, raw) {
    if (Array.isArray(raw.uiRoutes)) return raw.uiRoutes.slice();
    if (kind === 'npc_interaction') {
      var t = raw.type || raw.behaviorType || '';
      if (/impeach|slander|frame_up|expose_secret|recommend|guarantee|petition|express_gratitude|intercede/.test(t)) return ['relations', 'memorials', 'memory'];
      if (/private_visit|invite_banquet|duel_poetry|condole|celebrate_birthday|farewell_feast|welcome_feast|seek_instruction|entrust_orphan|propose_match/.test(t)) return ['relations', 'audience', 'memory'];
      if (/gift_present|correspond_secret|share_intelligence|gift_medicine/.test(t)) return ['relations', 'letters', 'memory'];
      return ['relations', 'memory'];
    }
    if (kind === 'npc_letter') return ['letters', 'memory'];
    if (kind === 'npc_correspondence') return ['correspondence', 'memory'];
    return ['event', 'memory'];
  }

  function normalize(raw, opts) {
    raw = raw || {};
    opts = opts || {};
    var kind = inferKind(raw, opts);
    var actor = _str(raw.actor || raw.name || raw.from || raw.schemer || opts.actor);
    var type = _str(raw.type || raw.behaviorType || raw.actionType || opts.type || kind);
    var behaviorType = _str(raw.behaviorType || raw.type || raw.actionType || opts.behaviorType || type || kind);
    var target = _str(raw.target || raw.to || raw.recipient || raw.object || opts.target);
    var action = _str(raw.action || raw.description || raw.content || raw.intent || raw.summary || raw.result || type);
    var source = _str(raw.source || opts.source || 'unknown');
    return {
      id: safeId(raw.id || raw.actionLedgerId) ? _str(raw.id || raw.actionLedgerId) : _uid('npcact'),
      schemaVersion: raw.schemaVersion || 2,
      phase: _str(raw.phase || opts.phase || 'execute'),
      targetId: _str(raw.targetId),
      operationRefs: raw.operationRefs || [],
      turn: raw.turn != null ? Number(raw.turn) : _turn(opts.GM || _gm()),
      actor: actor,
      characterId: _str(raw.characterId != null ? raw.characterId : raw.actorId),
      kind: kind,
      type: type,
      behaviorType: behaviorType,
      target: target,
      action: action,
      result: _str(raw.result || raw.outcome),
      source: source,
      publicReason: _str(raw.publicReason || raw.reasonPublic || raw.reason),
      motivePrivate: _str(raw.privateMotiv || raw.privateMotive || raw.innerThought),
      intent: _str(raw.intent || raw.action || raw.description || action),
      actionId: _str(raw.actionId || raw.cardId),
      status: _str(raw.status || opts.status || 'reported'),
      stateEffects: raw.stateEffects || raw.effects || opts.stateEffects || null,
      memoryEffects: raw.memoryEffects || opts.memoryEffects || null,
      uiRoutes: inferUiRoutes(kind, raw),
      preconditions: raw.preconditions || opts.preconditions || null,
      createdAt: Date.now()
    };
  }

  function preflight(raw, world) {
    var entry = normalize(raw, { GM: world || _gm() });
    var errors = [];
    var warnings = [];
    if (!entry.actor) errors.push('missing_actor');
    var actorWorld = world || _gm();
    var actorMatches = _arr(actorWorld && actorWorld.chars).filter(function(c) { return c && (entry.characterId ? _str(c.id) === entry.characterId : c.name === entry.actor); });
    var ch = actorMatches.length === 1 ? actorMatches[0] : null;
    if (!ch) {
      errors.push('unknown_actor');
    } else {
      if (ch.alive === false || ch.dead === true) errors.push('dead_actor');
      var p = _p();
      var playerName = p && p.playerInfo && p.playerInfo.characterName;
      var playerId = p && p.playerInfo && p.playerInfo.characterId;
      var playerMatch = playerId ? _str(ch.id) === _str(playerId) : playerName && ch.name === playerName && actorWorld === _gm() && _arr(actorWorld.chars).filter(function(c){return c.name===playerName;}).length === 1;
      if (ch.isPlayer || playerMatch) errors.push('player_actor');
    }
    if (entry.target) {
      var abstractTarget = /^(?:\u5929\u5b50|\u7687\u5e1d|\u965b\u4e0b|\u671d\u5ef7|\u671d\u5802|\u73a9\u5bb6|\u541b\u4e3b|\u540c\u515a|\u653f\u654c|\u4eac\u5e08|\u4eac\u57ce|\u672c\u90e8|\u5730\u65b9)$/;
      if (!abstractTarget.test(entry.target) && !findChar(entry.target, world)) warnings.push('unknown_target');
    }
    return { ok: errors.length === 0, errors: errors, warnings: warnings, entry: entry };
  }

  function sameEntry(a, b) {
    if (!a || !b) return false;
    return !!a.actionId && a.actionId === b.actionId && a.phase === b.phase;
  }

  function record(raw, opts) {
    opts = opts || {};
    var g = opts.GM || _gm();
    if (!g) return null;
    var entry = normalize(raw, { GM: g, source: opts.source, kind: opts.kind, status: opts.status });
    var pf = preflight(entry, g);
    entry.preflight = { ok: pf.ok, errors: pf.errors, warnings: pf.warnings };
    if (!pf.ok && opts.recordInvalid !== true) return null;
    if (!pf.ok) entry.status = 'blocked';
    var ledger = ensureLedger(g);
    for (var i = 0; i < ledger.length; i++) {
      if (sameEntry(ledger[i], entry)) {
        var verified=g._npcActionState&&g._npcActionState.receipts&&g._npcActionState.receipts[JSON.stringify([entry.actionId,entry.phase])];
        if(verified&&/^(reported|legacy_reported|narrative_only)$/.test(ledger[i].status)&&entry.operationRefs.length)Object.assign(ledger[i],entry);
        if (opts.markHandled === true && entry.preflight.ok) markHandled(entry.actor, g);
        return ledger[i];
      }
    }
    ledger.push(entry);
    var max = Number(opts.max || 300);
    if (ledger.length > max) ledger.splice(0, ledger.length - max);
    if (opts.markHandled === true && entry.preflight.ok) markHandled(entry.actor, g);
    return entry;
  }

  function recordConsideration(raw, opts) {
    opts = opts || {};
    var g = opts.GM || _gm();
    if (!g) return null;
    raw = raw || {};
    var rec = {
      id: raw.id || _uid('npcdiag'),
      turn: raw.turn != null ? Number(raw.turn) : _turn(g),
      actor: _str(raw.actor || raw.name),
      status: _str(raw.status || opts.status || 'considered'),
      behaviorType: _str(raw.behaviorType || raw.type || raw.actionType),
      target: _str(raw.target || raw.to || raw.object),
      reason: _str(raw.reason || raw.skipReason || raw.intent || raw.action),
      score: raw.score != null ? Number(raw.score) : null,
      motive: _str(raw.motive),
      source: _str(raw.source || opts.source || 'npc-autonomy'),
      createdAt: Date.now()
    };
    var list = ensureDiagnostics(g);
    list.push(rec);
    var max = Number(opts.max || 240);
    if (list.length > max) list.splice(0, list.length - max);
    return rec;
  }

  function recordPlan(raw, opts) {
    opts = opts || {};
    var g = opts.GM || _gm();
    if (!g) return null;
    raw = raw || {};
    var actor = _str(raw.actor || raw.name || raw.from);
    var type = _str(raw.type || raw.behaviorType || raw.actionType || 'plan');
    var target = _str(raw.target || raw.to || raw.object);
    var pf = preflight({ actor: actor, characterId: raw.actorId || raw.characterId, behaviorType: type, target: target, source: raw.source || opts.source || 'npc-plan' }, g);
    if (!pf.ok && opts.recordInvalid !== true) return null;
    var plans = ensurePlans(g);
    var turn = raw.turn != null ? Number(raw.turn) : _turn(g);
    var existing = null;
    for (var i = 0; i < plans.length; i++) {
      if (plans[i] && raw.id && plans[i].id === raw.id) {
        existing = plans[i];
        break;
      }
    }
    var plan = existing || {
      id: raw.id || _uid('npcplan'),
      actor: actor,
      actorId: _str(raw.actorId || raw.characterId || (findChar(actor, g) || {}).id),
      targetId: _str(raw.targetId || (findChar(target, g) || {}).id),
      type: type,
      target: target,
      createdTurn: turn,
      progress: 0,
      status: 'active'
    };
    plan.intent = _str(raw.intent || raw.action || raw.reason || plan.intent || type);
    plan.source = _str(raw.source || opts.source || plan.source || 'npc-autonomy');
    plan.updatedTurn = turn;
    // Registration is an intention; only verified steps advance progress.
    plan.progress = Number(plan.progress || 0);
    plan.stage = _str(raw.stage || plan.stage || 'preparing');
    plan.preflight = { ok: pf.ok, errors: pf.errors, warnings: pf.warnings };
    if (!pf.ok) plan.status = 'blocked';
    if (!existing) plans.push(plan);
    var max = Number(opts.max || 160);
    // Display limits may trim terminal archives; outstanding obligations survive.
    var terminal = plans.filter(function(p) { return /^(done|failed|cancelled|rejected)$/.test(p.status); });
    terminal.slice(0, Math.max(0, terminal.length - max)).forEach(function(p) { plans.splice(plans.indexOf(p), 1); });
    return plan;
  }

  function _pushName(out, seen, name) {
    name = _str(name);
    if (!name || seen[name]) return;
    seen[name] = true;
    out.push(name);
  }

  function collectHandledNamesFromP1(p1) {
    var out = [];
    var seen = {};
    _arr(p1 && p1.npc_actions).forEach(function(a) { _pushName(out, seen, a && (a.name || a.actor)); });
    _arr(p1 && p1.npc_interactions).forEach(function(a) { _pushName(out, seen, a && a.actor); });
    _arr(p1 && p1.npc_letters).forEach(function(a) { _pushName(out, seen, a && a.from); });
    _arr(p1 && p1.npc_correspondence).forEach(function(a) { _pushName(out, seen, a && a.from); });
    _arr(p1 && p1.scheme_actions).forEach(function(a) { _pushName(out, seen, a && (a.schemer || a.actor)); });
    return out;
  }

  function primeTurnContextFromP1(p1, g) {
    g = g || _gm();
    if (!g) return [];
    var names = collectHandledNamesFromP1(p1);
    // Appearing in generated text is not an action or an energy expenditure.
    if (!g._turnContext) g._turnContext = {};
    g._turnContext.npcMentionedThisTurn = names;
    return getHandledNames(g).slice();
  }

  function diagnose(g) {
    g = g || _gm();
    var ledger = ensureLedger(g);
    var byKind = {};
    var bySource = {};
    var blocked = 0;
    ledger.forEach(function(e) {
      byKind[e.kind || '?'] = (byKind[e.kind || '?'] || 0) + 1;
      bySource[e.source || '?'] = (bySource[e.source || '?'] || 0) + 1;
      if (e.status === 'blocked' || (e.preflight && e.preflight.ok === false)) blocked++;
    });
    return {
      turn: _turn(g),
      total: ledger.length,
      handled: getHandledNames(g).slice(),
      blocked: blocked,
      plans: ensurePlans(g).length,
      diagnostics: ensureDiagnostics(g).length,
      byKind: byKind,
      bySource: bySource,
      recent: ledger.slice(-10)
    };
  }

  // Versioned receipt index belongs to the existing ledger. It outlives display history.
  function migrate(g) {
    g = g || _gm();
    if (!g) return;
    if(g._npcActionState) {
      if(g._npcActionState.version!==2||!g._npcActionState.receipts||typeof g._npcActionState.receipts!=='object'||!g._npcActionState.schedule)throw Error('unsupported_or_invalid_npc_action_state');
      return;
    }
    var ledger = _arr(g._npcActionLedger).map(function(e) {
      if (e.schemaVersion === 2) return e;
      return Object.assign({}, e, { schemaVersion: 1, legacyStatus: e.status, status: 'legacy_reported' });
    });
    var next = { version: 2, sequence: 0, receipts: {}, schedule: {} };
    // No old assertion of completion creates an operation, resource or penalty.
    g._npcActionLedger = ledger;
    g._npcActionState = next;
  }
  function state(g) { g = g || _gm(); migrate(g); return g._npcActionState; }
  function prepare(raw, g) {
    g = g || _gm();
    delete raw._npcInvalidActionId;
    if(raw.actionId && !/^npcact:|^npccard:/.test(raw.actionId) && !safeId(raw.actionId)) {raw._npcInvalidActionId=true;return raw;}
    if (!raw.actionId || /^npcact:|^npccard:/.test(raw.actionId)) {
      if (raw.actionId) raw.cardId = raw.actionId;
      raw.actionId = 'npc:' + _str(g._campaignId || g.sid || 'world').replace(/[^A-Za-z0-9_-]/g,'_') + ':' + (++state(g).sequence);
    }
    raw.phase = raw.planId ? _str(raw.phase || 'execute') : 'execute';
    return raw;
  }
  function result(outcome, reason, refs, extra) {
    return Object.assign({ outcome: outcome, reason: reason || '', operationRefs: refs || [] }, extra || {});
  }
  function capture() {
    return typeof global._tmCaptureWorldLease === 'function' ? global._tmCaptureWorldLease() :
      { gmRef: _gm(), pRef: global.P, turn: _turn(_gm()), loadGen: global._tmLoadGen || 0 };
  }
  function current(lease) {
    if (!lease) return true;
    if (typeof global._tmWorldLeaseCurrent === 'function' && Object.prototype.hasOwnProperty.call(lease, 'sid')) return global._tmWorldLeaseCurrent(lease);
    return lease.gmRef === _gm() && lease.pRef === global.P && lease.turn === _turn(_gm()) && lease.loadGen === (global._tmLoadGen || 0);
  }
  function due(ch, g) {
    g = g || _gm();
    var id = _str(ch && ch.id), turn = _turn(g);
    return ensurePlans(g).some(function(p) {
      if (!p || /^(done|failed|cancelled|rejected)$/.test(p.status)) return false;
      if (p.version === 2) return p.nextActorId === id && p.nextTurn <= turn && p.status !== 'in_transit';
      return (p.actorId ? p.actorId === id : p.actor === ch.name) && (!p.nextTurn || p.nextTurn <= turn);
    }) || commitments(ch,g).some(function(p) {
      if(p.dueDay!=null && TM.TaxPolicy)return Number(p.dueDay)<=TM.TaxPolicy.now(g)+TM.TaxPolicy.turnDays(g);
      var dueTurn=p.dueTurn!=null?p.dueTurn:p.deadlineTurn!=null?p.deadlineTurn:Number.isFinite(p.assignedTurn)?p.assignedTurn+(Number(p.deadline)||3):turn;
      return dueTurn<=turn+1;
    });
  }
  function commitments(ch,g) {
    g=g||_gm();var rows=[];
    if(TM.ImperialOrders&&TM.ImperialOrders.all)rows=TM.ImperialOrders.all(g);
    else if(Array.isArray(g._npcCommitments)) rows=g._npcCommitments.map(function(c){return {c:c,name:c.npc||c.name};});
    else Object.keys(g._npcCommitments||{}).forEach(function(name){_arr(g._npcCommitments[name]).forEach(function(c){rows.push({c:c,name:name});});});
    return rows.filter(function(r){return r.c&&!/^(done|completed|failed|cancelled|fulfilled)$/.test(r.c.status)&&findChar({id:r.c.actorId||r.c.characterId,name:r.name},g)===ch;}).map(function(r){return r.c;});
  }
  var humanContexts=new WeakSet();
  function executeHuman(npc,d,context,handler) {
    if(!TM.PoliticalActions||!TM.PoliticalActions.controlled(npc,_gm())||findChar({id:npc.id},_gm())!==npc)return result('blocked','trusted_player_identity_required');
    var c=Object.assign({},context||{});humanContexts.add(c);
    try{return execute(npc,d,c,handler);}finally{humanContexts.delete(c);}
  }
  function executionSignature(d,actor) {
    var fields=['behaviorType','decision','content','intent','warId','casusBelli','cb','targetType','targetId','target','planId','response','positionId','fromPositionId','organizationId','actingPositionId','appointmentId','authorityRef','amount','fromAccount','toAccount','amounts','purpose','task','diplomacyAction','treatyId','proposalId','obligationId','proposalVersion','proposalType','type','terms','counterTerms','durationTurns','obligations','recipientId','successorId','toFactionId','targetOrganizationId','soldiersDelta','troopsDelta','moraleDelta','trainingDelta','destinationId','armyId','commandReceipt','destination','commanderId','commander','commandHandoverTo','casusBelliId','sourcePlanId','documentType'];
    var data={actorId:_str(actor.id)};fields.forEach(function(k){if(d[k]!=null&&d[k]!==''&&!(k==='target'&&d.targetId))data[k]=d[k];});
    return TM.PoliticalActions?TM.PoliticalActions.signature(data):JSON.stringify(data);
  }
  function execute(npc, d, context, handler) {
    var g = _gm();
    prepare(d, g);
    if(d._npcInvalidActionId)return result('blocked','invalid_action_id');
    var actor = findChar({ id: d.actorId || d.characterId || npc && npc.id, name: d.name || npc && npc.name }, g);
    var pf = preflight({ actor: actor && actor.name, characterId: actor && actor.id, target: d.target, behaviorType: d.behaviorType }, g);
    if(context&&humanContexts.has(context)){pf.errors=pf.errors.filter(function(e){return e!=='player_actor';});pf.ok=!pf.errors.length;}
    if (!actor || !pf.ok) return result('blocked', pf.errors.join(',') || 'unknown_actor');
    if(!_str(actor.id))return result('blocked','stable_actor_id_required');
    if(d.behaviorType!=='declare_war'&&(!d.targetType||d.targetType==='character')) {
      var concreteTarget=findChar({id:d.targetId,name:d.target},g);
      if(concreteTarget){d.targetId=_str(concreteTarget.id);d.target=concreteTarget.name;}
    }
    if (context && !current(context._npcLease)) return result('expired', 'world_changed');
    if(TM.PoliticalActions&&/^(declare_war|join_war)$/.test(d.behaviorType)){
      var enemy=TM.PoliticalActions.resolve('organization',{id:d.targetOrganizationId||d.targetId,name:d.targetFaction||d.target||d.enemy||d.against},g);
      if(!enemy)return result('blocked','organization_target_unresolved');d.targetType='organization';d.targetOrganizationId=enemy.id;
    }
    var st = state(g), key = JSON.stringify([d.actionId, d.phase]), signature = executionSignature(d,actor);
    var prior = st.receipts[key];
    if (prior) return prior.signature === signature ? Object.assign({}, prior.result, { duplicate: true }) : result('blocked', 'action_id_conflict');
    if (typeof handler !== 'function') return result('blocked', 'unregistered_behavior');
    if (handler.constructor && handler.constructor.name === 'AsyncFunction') return result('blocked', 'async_handler_requires_synchronous_commit');
    var guards = TM.AIChange && TM.AIChange.WriteGuards;
    if (!guards || typeof guards.runAtomicMutation !== 'function') return result('blocked', 'atomic_writer_unavailable');
    var receipt;
    var tx = guards.runAtomicMutation(function(snapshot) {
      var returned = handler(actor, d.target, d, context);
      if (returned && typeof returned.then === 'function') {
        returned.catch(function() {});
        throw new Error('async_handler_requires_synchronous_commit');
      }
      receipt = returned;
      if (!receipt || !/^(noop|blocked|submitted|waiting|started|partial|completed|failed|expired)$/.test(receipt.outcome)) {
        receipt = result('failed', 'handler_result_missing_or_invalid');
        return { ok: false, reason: receipt.reason };
      }
      if (/^(noop|blocked|failed|expired)$/.test(receipt.outcome)) return { ok: false, reason: receipt.reason || receipt.outcome };
      if (!Array.isArray(receipt.operationRefs) || !receipt.operationRefs.length) {
        receipt = result('failed', 'operation_evidence_missing');
        return { ok: false, reason: receipt.reason };
      }
      if (!receipt.operationRefs.every(function(ref){return verifyEvidence(ref,d,actor,g,snapshot.beforeGM);})) {
        receipt=result('failed','unverified_operation_reference');
        return {ok:false,reason:receipt.reason};
      }
      receipt = Object.assign({}, receipt, { actionId: d.actionId, phase: d.phase, actorId: _str(actor.id), actor: actor.name,
        targetId: _str(d.targetId), target: d.target || '', behaviorType: d.behaviorType, turn: _turn(g), schemaVersion: 2 });
      if(TM.PoliticalActions&&TM.PoliticalActions.onReceipt)TM.PoliticalActions.onReceipt(d,receipt,g);
      st.receipts[key] = { signature: signature, result: receipt };
      record(Object.assign({}, receipt, { characterId: actor.id, status: receipt.outcome, source: d.source || 'npc-autonomy',
        action: d.intent || d.action || d.behaviorType, stateEffects: { executionResult: receipt } }), { GM: g, markHandled: false });
      if (!Array.isArray(g._npcExecutionResults)) g._npcExecutionResults = [];
      g._npcExecutionResults.push(receipt);
      if (g._npcExecutionResults.length > 120) g._npcExecutionResults.splice(0, g._npcExecutionResults.length - 120);
      actor._lastNpcExecution = receipt;
      return { ok: true, receipt: receipt };
    });
    if (!tx.ok) return receipt && /^(noop|blocked|failed|expired)$/.test(receipt.outcome) ? receipt : result('failed', tx.reason || 'transaction_failed');
    return receipt;
  }

  function verifyEvidence(ref,d,actor,g,before) {
    if(!ref||!ref.kind)return false;
    if(['march','command','army_operation'].indexOf(ref.kind)>=0)return !!(TM.PoliticalActions&&TM.PoliticalActions.verifyEvidence(ref,d,g,before));
    if(ref.kind==='diplomacy_step'||ref.kind==='treaty'||ref.kind==='treaty_termination')return !!(TM.FactionDiplomacy&&TM.FactionDiplomacy.verifyEvidence(ref,d,g,before));
    if(ref.kind==='political_review')return !!(TM.PoliticalActions&&TM.PoliticalActions.verifyReview(ref,d,g,before));
    if(ref.kind==='plan')return ensurePlans(g).some(function(p){return p.id===ref.id;});
    if(ref.kind==='npc_message')return ensurePlans(g).some(function(p){return _arr(p.messages).some(function(m){return m.id===ref.id;});});
    if(ref.kind==='memorial')return _arr(g.memorials).some(function(m){return m.id===ref.id&&m._actionId===d.actionId;});
    if(ref.kind==='letter_queue')return _arr(g._pendingNpcLetters).some(function(m){return m.id===ref.id&&m._actionId===d.actionId;});
    if(ref.kind==='audience')return _arr(g._pendingAudiences).some(function(m){return m._actionId===ref.id;});
    if(ref.kind==='public_transfer') {
      var transfer=_arr(g._publicTreasuryTransfers).find(function(t){return t.id===ref.id;});
      var task=d.planId&&planById(d.planId,g),spec=task&&task.task||d,service=TM.PublicTreasury;
      if(!transfer||!transfer.result||!transfer.result.ok||!service||ref.id!==d.actionId+':'+d.phase||_arr(before._publicTreasuryTransfers).some(function(t){return t.id===ref.id;}))return false;
      var from=service.getAccountView({game:g,ref:spec.fromAccount}),to=service.getAccountView({game:g,ref:spec.toAccount}),oldFrom=service.getAccountView({game:before,ref:spec.fromAccount}),oldTo=service.getAccountView({game:before,ref:spec.toAccount});
      return from.exists&&to.exists&&oldFrom.exists&&oldTo.exists&&Object.keys(spec.amounts||{}).some(function(k){return spec.amounts[k]>0;})&&['money','grain','cloth'].every(function(k){
        var amount=Number(spec.amounts&&spec.amounts[k]||0),r=transfer.result;
        return r.paid[k]===amount&&_arr(r.debits).filter(function(x){return x.accountId===from.id&&x.resource===k;}).reduce(function(n,x){return n+x.amount;},0)===amount&&
          _arr(r.credits).filter(function(x){return x.accountId===to.id&&x.resource===k;}).reduce(function(n,x){return n+x.amount;},0)===amount&&
          (!amount||Math.abs(oldFrom.resources[k].stock-from.resources[k].stock-amount)<0.00001&&Math.abs(to.resources[k].stock-oldTo.resources[k].stock-amount)<0.00001);
      });
    }
    if(ref.kind==='private_transfer') {
      var from=findChar({id:ref.fromId},g),to=findChar({id:ref.toId},g),oldFrom=findChar({id:ref.fromId},before),oldTo=findChar({id:ref.toId},before);
      return ref.fromId===actor.id&&ref.id===d.actionId&&ref.amount>0&&from&&to&&oldFrom&&oldTo&&
        oldFrom.resources.privateWealth.money-from.resources.privateWealth.money===ref.amount&&to.resources.privateWealth.money-oldTo.resources.privateWealth.money===ref.amount;
    }
    if(ref.kind==='office') {
      var hs=TM.OfficeHolderState,scope={organizationId:ref.organizationId||d.organizationId,positionId:ref.positionId};
      var seat=hs&&hs.position(g,scope),oldSeat=hs&&hs.position(before,scope),who=findChar({id:ref.characterId},g),oldWho=findChar({id:ref.characterId},before);
      if(!seat||!oldSeat||!who||!oldWho||ref.actionId!==d.actionId||String(ref.positionId)!==String(d.positionId))return false;
      var seated=hs.read(g,seat.pos).characters.some(function(h){return h.char===who;}),wasSeated=hs.read(before,oldSeat.pos).characters.some(function(h){return h.char===oldWho;});
      return d.behaviorType==='dismiss'?wasSeated&&!seated:!wasSeated&&seated;
    }
    if(ref.kind==='army_training')return _arr(g.armies).some(function(a){return (a.id||a.name)===ref.id&&a._npcTrainingTurn===ref.turn;});
    if(ref.kind==='war')return !_arr(before.activeWars).some(function(w){return w.id===ref.id;})&&_arr(g.activeWars).some(function(w){return w.id===ref.id&&w.sourceActionId===d.actionId&&w.decisionActorId===actor.id&&(!d.organizationId||w.attackerId===d.organizationId)&&w.defenderId===(d.targetOrganizationId||d.targetId);});
    if(ref.kind==='reform')return _arr(g._pendingReforms).some(function(r){return r._key===ref.id;});
    return false;
  }


  function alive(ch) { return !!ch && ch.alive !== false && ch.dead !== true; }
  function planById(id, g) { return ensurePlans(g).find(function(p) { return p && p.id === id && p.version === 2; }) || null; }
  function clone(v) { return v == null ? v : JSON.parse(JSON.stringify(v)); }
  function message(plan, from, to, kind, content, data) {
    var id = 'npcmsg:' + (++state(_gm()).sequence);
    var m = { id:id, fromId:_str(from.id), toId:_str(to.id), kind:kind, content:_str(content), data:clone(data || {}),
      sentTurn:_turn(_gm()), deliveryTurn:_turn(_gm())+1, status:'in_transit', sourceId:plan.id };
    plan.messages.push(m);
    plan.status='in_transit'; plan.nextActorId=''; plan.nextTurn=m.deliveryTurn;
    return m;
  }
  function rememberPlan(ch, other, plan, m, text, factStatus) {
    if (!ch || !global.NpcMemorySystem) return;
    global.NpcMemorySystem.remember(ch.name,text,'平',5,other && other.name || '',{
      _noMirror:true,relationshipHandled:true,characterId:ch.id,sourceId:m.id,taskId:plan.id,source:'witnessed',factStatus:factStatus||'personal_experience',
      sourceRefs:[{kind:'npc_message',id:m.id,planId:plan.id}],participants:[ch.name,other && other.name || '']
    });
  }
  function social(npc,d) {
    var g=_gm(), p=d.planId ? planById(d.planId,g) : null, who, legacy=null;
    if(d.planId && !p) {
      legacy=ensurePlans(g).find(function(x){return x.id===d.planId&&x.version!==2;});
      var legacyActor=legacy&&findChar({id:legacy.actorId,name:legacy.actor},g);
      if(!legacy||legacyActor!==npc||d.phase!=='replan')return result('blocked','legacy_plan_requires_owner_replanning');
      d=Object.assign({},d,{planId:null,targetId:d.targetId||legacy.targetId,target:d.target||legacy.target,intent:d.intent||legacy.intent});
    }
    if (d.planId && !p) return result('blocked','unknown_plan');
    if (!p) {
      who=findChar({id:d.targetId,name:d.target},g);
      if (!alive(who) || who===npc) return result('blocked','specific_living_recipient_required');
      if (!d.intent && !d.content) return result('blocked','concrete_request_required');
      p={version:2,id:legacy?legacy.id:'plan:'+d.actionId,actorId:_str(npc.id),actor:npc.name,targetId:_str(who.id),target:who.name,
        type:d.behaviorType,intent:_str(d.intent || d.content),createdTurn:_turn(g),updatedTurn:_turn(g),progress:0,
        task:clone(d.task || {kind:'document'}),messages:[],steps:[],knowledge:{},status:'in_transit',
        actingPositionId:_str(d.actingPositionId),appointmentId:_str(d.appointmentId)};
      // An unsupported task remains a negotiation; it cannot produce money or state by naming an effect.
      if (!/^(document|public_transfer|notice)$/.test(p.task.kind)) return result('blocked','unsupported_concrete_task');
      var request=message(p,npc,who,'request',d.content||d.intent,{task:p.task});
      p.knowledge[p.actorId]={stage:'awaiting_delivery',lastMessageId:request.id};
      if(legacy){p.legacyEvidence={status:legacy.status,progress:legacy.progress,intent:legacy.intent};ensurePlans(g)[ensurePlans(g).indexOf(legacy)]=p;}
      else ensurePlans(g).push(p);
      rememberPlan(npc,who,p,request,'已向'+who.name+'提出：'+p.intent);
      return result('submitted','请求已寄出，尚未同意',[{kind:'npc_message',id:request.id,planId:p.id}],{planId:p.id});
    }
    var initiator=findChar({id:p.actorId},g), recipient=findChar({id:p.targetId},g), id=_str(npc.id);
    if (id!==p.actorId && id!==p.targetId) return result('blocked','not_a_participant');
    if (!alive(initiator) || !alive(recipient)) return result('blocked','participant_unavailable');
    if (/^(done|rejected|cancelled|failed)$/.test(p.status)) return result('noop','plan_terminal');
    who=id===p.actorId ? recipient : initiator;
    if(d.phase==='handoff' && p.task.kind==='public_transfer' && p.performerPositionId) {
      var seat=global._npcPosition(p.performerPositionId),successor=seat&&TM.OfficeHolderState.read(g,seat.pos).primary;
      if(!successor||successor===recipient||!alive(successor))return result('blocked','current_successor_required');
      var handover=message(p,npc,successor,'request','任职交接待续办：'+p.intent,{task:p.task,fromPlanId:p.id});
      p.previousParticipants=_arr(p.previousParticipants).concat([p.targetId]);
      p.knowledge[p.targetId]={stage:'handed_over',lastMessageId:handover.id};
      p.targetId=_str(successor.id);p.target=successor.name;p.performerAppointmentId='';p.cancelRequested=false;
      return result('submitted','职责交接已提出，新任尚未承诺',[{kind:'npc_message',id:handover.id,planId:p.id}]);
    }
    if (d.phase==='cancel') {
      var cancelled=message(p,npc,who,'cancel',d.content||'取消此项请求',{});
      p.knowledge[id]={stage:'cancelled',lastMessageId:cancelled.id};
      p.cancelRequested=true;
      return result('submitted','取消通知待送达',[{kind:'npc_message',id:cancelled.id,planId:p.id}]);
    }
    if (p.cancelRequested) return result('blocked','cancellation_pending');
    if (p.nextActorId!==id || p.nextTurn>_turn(g)) return result('waiting','尚未收到下一步所需信息',[{kind:'plan',id:p.id}]);
    if (d.phase==='respond' && /^(awaiting_response|needs_replan)$/.test(p.status) && id===p.targetId) {
      if (!/^(accept|reject|conditions|defer|partial)$/.test(d.response||'')) return result('blocked','explicit_response_required');
      if(d.task&&!/^(document|public_transfer)$/.test(d.task.kind))return result('blocked','unsupported_revised_task');
      var ability=typeof global._npcAbilityProfile==='function'?global._npcAbilityProfile(npc):{};
      var workTurns=Math.max(1,Math.min(3,Math.ceil(60/Math.max(20,((Number(ability.administration)||50)+(Number(ability.intelligence)||50))/2+20))));
      var response=message(p,npc,who,'response',d.content||d.response,{response:d.response,terms:_str(d.terms||d.content),revisedTask:clone(d.task||null),workTurns:workTurns,dueTurn:Number.isFinite(Number(d.dueTurn))?Math.max(_turn(g)+1,Number(d.dueTurn)):_turn(g)+1});
      if(p.task.kind==='public_transfer' && TM.PublicTreasury) {
        var material=TM.PublicTreasury.getCharacterPublicAccounts({game:g,characterId:npc.id});
        response.data.materials={source:'public_treasury',turn:_turn(g),accounts:clone(material.accounts.filter(function(a){return a.id===p.task.fromAccount;}))};
      }
      p.knowledge[id]={stage:'responded',lastMessageId:response.id};
      if (d.response==='accept') { p.performerPositionId=_str(d.actingPositionId);p.performerAppointmentId=_str(d.appointmentId); }
      rememberPlan(npc,who,p,response,'已答复'+who.name+'：'+response.content);
      return result('submitted','答复已寄出，对方尚未获知',[{kind:'npc_message',id:response.id,planId:p.id}]);
    }
    if (d.phase==='agree' && p.status==='awaiting_agreement' && id===p.actorId) {
      if (!/^(accept|reject)$/.test(d.response||'')) return result('blocked','explicit_agreement_required');
      var agreement=message(p,npc,who,'agreement',d.content||d.response,{response:d.response});
      p.knowledge[id]={stage:'agreement_sent',lastMessageId:agreement.id};
      return result('submitted','约定变更待对方收悉',[{kind:'npc_message',id:agreement.id,planId:p.id}]);
    }
    if (d.phase==='perform' && /^(ready|needs_replan)$/.test(p.status) && id===p.targetId) {
      var execution, body;
      if (p.task.kind==='public_transfer') {
        execution=global._npcTransferPublic(npc,{
          actionId:d.actionId,phase:d.phase,actingPositionId:d.actingPositionId||p.performerPositionId,
          appointmentId:d.appointmentId||p.performerAppointmentId,fromAccount:p.task.fromAccount,toAccount:p.task.toAccount,
          amounts:p.task.amounts,purpose:p.intent
        });
        if (execution.outcome!=='completed') {
          p.status='needs_replan';p.nextTurn=_turn(g)+1;p.blockedReason=execution.reason;
          return result('waiting',execution.reason,[{kind:'plan',id:p.id}],{planId:p.id});
        }
        body='已核验公库转移：'+JSON.stringify(execution.transfer.paid);
      } else {
        body=_str(d.content);
        if (!body) return result('blocked','document_content_required');
        execution=result('submitted','文书已形成',[]);
      }
      var document=message(p,npc,who,'delivery',body,{operationRefs:execution.operationRefs});
      p.steps.push({id:d.actionId,turn:_turn(g),kind:p.task.kind,operationRefs:execution.operationRefs.concat([{kind:'npc_message',id:document.id}])});
      p.progress=p.steps.length;
      p.knowledge[id]={stage:'delivery_sent',lastMessageId:document.id};
      rememberPlan(npc,who,p,document,'已向'+who.name+'交付文书：'+body);
      return result(p.task.kind==='public_transfer'?'completed':'submitted',execution.reason,p.steps[p.steps.length-1].operationRefs,{planId:p.id});
    }
    if (d.phase==='feedback' && p.status==='awaiting_feedback' && id===p.actorId) {
      var feedback=message(p,npc,who,'feedback',d.content||'已收到交付',{});
      if (global.OpinionSystem && /^(satisfied|unsatisfied)$/.test(d.evaluation||'')) global.OpinionSystem.addEventOpinion(npc,who,d.evaluation==='satisfied'?2:-2,feedback.content,{sourceId:feedback.id});
      p.knowledge[id]={stage:'done',lastMessageId:feedback.id};
      return result('completed','收件方已反馈，反馈尚在传递',[{kind:'npc_message',id:feedback.id,planId:p.id}]);
    }
    return result('blocked','phase_not_available');
  }
  function deliver(p,m,g) {
    var from=findChar({id:m.fromId},g),to=findChar({id:m.toId},g);
    if (!alive(to)) { m.status='undeliverable';p.status='waiting_contact';p.nextActorId='';return; }
    if (to._missing || to.missing) { p.status='in_transit';p.nextTurn=_turn(g)+1;return; }
    m.status='delivered';m.deliveredTurn=_turn(g);p.updatedTurn=_turn(g);
    p.nextTurn=_turn(g);p.nextActorId=_str(to.id);
    if(m.kind==='request') {p.status=p.task.kind==='notice'?'done':'awaiting_response';if(p.status==='done')p.nextActorId='';}
    if(m.kind==='response') {
      if(m.data.response==='reject') {p.status='rejected';p.nextActorId='';}
      else if(m.data.response==='accept') {p.status='ready';p.nextActorId=p.targetId;p.nextTurn=Math.max(_turn(g)+(m.data.workTurns||1),m.data.dueTurn);}
      else {p.status='awaiting_agreement';p.terms=m.data.terms;p.agreedDueTurn=m.data.dueTurn;p.proposedTask=m.data.revisedTask;p.requiresRevisedTask=p.task.kind==='public_transfer'&&/^(conditions|partial)$/.test(m.data.response)&&!m.data.revisedTask;}
    }
    if(m.kind==='agreement') {
      p.status=m.data.response==='accept'?(p.requiresRevisedTask?'needs_replan':'ready'):'rejected';p.nextActorId=m.data.response==='accept'?p.targetId:'';
      if(m.data.response==='accept'&&p.proposedTask)p.task=clone(p.proposedTask);
      p.nextTurn=Math.max(_turn(g),p.agreedDueTurn||0);
    }
    if(m.kind==='delivery') p.status='awaiting_feedback';
    if(m.kind==='feedback') {p.status='done';p.nextActorId='';}
    if(m.kind==='cancel') {p.status='cancelled';p.nextActorId='';}
    p.knowledge[m.toId]={stage:p.status,lastMessageId:m.id};
    var playerNext=findChar({id:p.nextActorId},g);
    if(playerNext&&playerNext.isPlayer) _arr(g.letters).filter(function(l){return l.npcPlanId===p.id;}).forEach(function(l){l._playerReplied=false;l._npcPlanPhase=p.status;});
    rememberPlan(to,from,p,m,'收到'+(from&&from.name||'来人')+'文书：'+m.content,m.kind==='delivery'?'personal_experience':'received_claim');
    // The existing letter UI is a view of the canonical plan/message, never a second executable request.
    if(to.isPlayer) {
      if(!Array.isArray(g.letters))g.letters=[];
      if(!g.letters.some(function(l){return l.id===m.id;}))g.letters.push({id:m.id,from:from&&from.name||'',fromId:m.fromId,to:to.name,toId:to.id,
        content:m.content,subjectLine:p.intent,letterType:'personal',sentTurn:m.sentTurn,deliveryTurn:m.deliveredTurn,status:'delivered',
        _npcInitiated:true,_playerRead:false,_replyExpected:/^(request|response|delivery)$/.test(m.kind),npcPlanId:p.id,npcMessageId:m.id});
    }
  }
  function advance(g) {
    g=g||_gm();if(g!==_gm())return {ok:false,reason:'world_mismatch'};
    migrate(g);
    var guard=TM.AIChange&&TM.AIChange.WriteGuards;
    if(!guard)return {ok:false,reason:'atomic_writer_unavailable'};
    return guard.runAtomicMutation(function(){
      ensurePlans(g).filter(function(p){return p&&p.version===2&&!/^(done|rejected|cancelled|failed)$/.test(p.status);}).forEach(function(p){
        p.messages.filter(function(m){return m.status==='in_transit'&&m.deliveryTurn<=_turn(g);}).forEach(function(m){deliver(p,m,g);});
      });
      return {ok:true};
    });
  }
  function planView(p,ch) {
    var id=_str(ch.id), knowledge=p.knowledge&&p.knowledge[id];
    if(p.version!==2){
      var owner=findChar({id:p.actorId,name:p.actor},_gm());
      return owner===ch?{id:p.id,actorId:id,intent:p.intent,target:p.target,stage:'needs_replan',nextPhase:'replan',factStatus:'legacy_reported'}:null;
    }
    if(!knowledge)return null;
    return {id:p.id,actorId:p.actorId,targetId:p.targetId,intent:p.intent,stage:knowledge.stage,
      messages:_arr(p.messages).filter(function(m){return m.fromId===id||m.toId===id&&m.status==='delivered';}).map(function(m){return {id:m.id,fromId:m.fromId,toId:m.toId,kind:m.kind,content:m.content,data:clone(m.data),factStatus:'received_claim',status:m.fromId===id&&m.status!=='delivered'?'sent':m.status};}),
      nextPhase:p.nextActorId===id&&p.nextTurn<=_turn(_gm())?({awaiting_response:'respond',awaiting_agreement:'agree',ready:'perform',needs_replan:'perform',awaiting_feedback:'feedback'}[p.status]||''):''};
  }
  function playerRespond(planId,response,content) {
    var g=_gm(),p=planById(planId,g),player=_arr(g.chars).filter(function(c){return c&&c.isPlayer;});
    if(!p||player.length!==1)return result('blocked','player_or_plan_unknown');
    var ch=player[0],view=planView(p,ch);
    if(!view||!/^(respond|agree|perform|feedback)$/.test(view.nextPhase))return result('blocked','player_response_not_due');
    if(view.nextPhase==='perform'&&response!=='deliver')return result('blocked','explicit_delivery_required');
    // Only this explicit UI call may commit the player's choice; the automatic dispatcher keeps its guard.
    var guard=TM.AIChange&&TM.AIChange.WriteGuards,answer;
    if(!guard)return result('blocked','atomic_writer_unavailable');
    var tx=guard.runAtomicMutation(function(){answer=social(ch,{actionId:p.id+':player:'+p.messages.length,planId:p.id,phase:view.nextPhase,response:response,content:content,terms:content,evaluation:response});return {ok:!!answer&&answer.outcome!=='blocked'};});
    return tx.ok?answer:result('failed',tx.reason);
  }

  function owns(type) { return !!(global.NpcBehaviorRegistry && global.NpcBehaviorRegistry._behaviors[type]); }
  function ingest(raw, source) {
    if (!raw) return result('noop','empty_input');
    prepare(raw,_gm());
    if(raw._npcInvalidActionId)return result('blocked','invalid_action_id');
    var mode=raw.executionMode || raw.mode || '';
    if (/^(report|observation|history|self_report)$/.test(mode)) {
      record(Object.assign({},raw,{source:source,status:'reported'}),{markHandled:false});
      return result('noop','report_is_not_an_instruction');
    }
    raw.name=raw.name||raw.actor||raw.from;
    raw.target=raw.target||raw.to;
    raw.behaviorType=raw.behaviorType||raw.type;
    raw.intent=raw.intent||raw.action||raw.description||raw.content||raw.behaviorType;
    raw.source=source||raw.source;
    var actor=findChar({id:raw.actorId||raw.characterId,name:raw.name},_gm());
    if(!actor)return result('blocked','unknown_actor');
    raw.actorId=_str(actor.id);raw.name=actor.name;
    global._executeNormalizedNpcDecision(raw,actor,global.buildNpcBehaviorContext(actor));
    var receipt=raw._executionResult||result('noop','not_executed');
    raw.reportedResult=raw.reportedResult||raw.result||'';
    raw.result=receipt.reason;raw.status=receipt.outcome;raw.operationRefs=receipt.operationRefs;
    raw.factStatus=/^(completed|started|partial)$/.test(receipt.outcome)?'verified_operation':'intention_or_report';
    return receipt;
  }
  function defer(d) {
    var s=state(_gm());if(!Array.isArray(s.pending))s.pending=[];
    if(!s.pending.some(function(p){return p.actionId===d.actionId&&p.phase===d.phase;}))s.pending.push(clone(d));
  }
  function flushDeferred() {
    var s=state(_gm()),ready=_arr(s.pending).filter(function(d){return Number(d.proposedTurn)<_turn(_gm());});
    s.pending=_arr(s.pending).filter(function(d){return ready.indexOf(d)<0;});
    ready.forEach(function(d){ingest(d,'npc-deferred');});
    return ready.length;
  }

  TM.NPC.ActionLedger = {
    commitments: commitments,
    ingest: ingest, owns: owns, defer: defer, flushDeferred: flushDeferred,
    social: social, advance: advance, planView: planView, playerRespond: playerRespond,
    state: state,
    migrate: migrate,
    prepare: prepare,
    execute: execute, executeHuman: executeHuman,
    result: result,
    capture: capture,
    current: current,
    due: due,
    ensureLedger: ensureLedger,
    ensureDiagnostics: ensureDiagnostics,
    ensurePlans: ensurePlans,
    getHandledNames: getHandledNames,
    markHandled: markHandled,
    isHandled: isHandled,
    findChar: findChar,
    normalize: normalize,
    preflight: preflight,
    record: record,
    recordConsideration: recordConsideration,
    recordPlan: recordPlan,
    collectHandledNamesFromP1: collectHandledNamesFromP1,
    primeTurnContextFromP1: primeTurnContextFromP1,
    diagnose: diagnose
  };

  global.NpcActionLedger = TM.NPC.ActionLedger;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
