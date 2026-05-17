// tm-npc-action-ledger.js - unified character NPC action ledger.
(function(global) {
  'use strict';

  var TM = global.TM = global.TM || {};
  TM.NPC = TM.NPC || {};

  function _gm() { return global.GM || null; }
  function _p() { return global.P || {}; }
  function _arr(v) { return Array.isArray(v) ? v : []; }
  function _str(v) { return String(v == null ? '' : v).trim(); }
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

  function findChar(name, world) {
    name = _str(name);
    if (!name) return null;
    if (world && Array.isArray(world.chars)) {
      for (var i = 0; i < world.chars.length; i++) {
        if (world.chars[i] && world.chars[i].name === name) return world.chars[i];
      }
    }
    if (typeof global.findCharByName === 'function') {
      try {
        var found = global.findCharByName(name);
        if (found) return found;
      } catch(_) {}
    }
    var g = world || _gm();
    var chars = _arr(g && g.chars);
    for (var j = 0; j < chars.length; j++) {
      if (chars[j] && chars[j].name === name) return chars[j];
    }
    return null;
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
      if (/impeach|slander|frame_up|expose_secret|recommend|guarantee|petition/.test(t)) return ['relations', 'memorials', 'memory'];
      if (/private_visit|invite_banquet|duel_poetry/.test(t)) return ['relations', 'audience', 'memory'];
      if (/gift_present|correspond_secret|share_intelligence/.test(t)) return ['relations', 'letters', 'memory'];
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
      id: raw.id || raw.actionLedgerId || _uid('npcact'),
      turn: raw.turn != null ? Number(raw.turn) : _turn(opts.GM || _gm()),
      actor: actor,
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
      status: _str(raw.status || opts.status || 'applied'),
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
    var ch = findChar(entry.actor, world);
    if (!ch) {
      errors.push('unknown_actor');
    } else {
      if (ch.alive === false || ch.dead === true) errors.push('dead_actor');
      var p = _p();
      var playerName = p && p.playerInfo && p.playerInfo.characterName;
      if (ch.isPlayer || (playerName && ch.name === playerName)) errors.push('player_actor');
    }
    if (entry.target) {
      var abstractTarget = /^(?:\u5929\u5b50|\u7687\u5e1d|\u965b\u4e0b|\u671d\u5ef7|\u671d\u5802|\u73a9\u5bb6|\u541b\u4e3b|\u540c\u515a|\u653f\u654c|\u4eac\u5e08|\u4eac\u57ce|\u672c\u90e8|\u5730\u65b9)$/;
      if (!abstractTarget.test(entry.target) && !findChar(entry.target, world)) warnings.push('unknown_target');
    }
    return { ok: errors.length === 0, errors: errors, warnings: warnings, entry: entry };
  }

  function sameEntry(a, b) {
    if (!a || !b) return false;
    return Number(a.turn || 0) === Number(b.turn || 0)
      && _str(a.actor) === _str(b.actor)
      && _str(a.kind) === _str(b.kind)
      && _str(a.behaviorType) === _str(b.behaviorType)
      && _str(a.target) === _str(b.target)
      && _str(a.source) === _str(b.source);
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
        if (opts.markHandled !== false && entry.preflight.ok) markHandled(entry.actor, g);
        return ledger[i];
      }
    }
    ledger.push(entry);
    var max = Number(opts.max || 300);
    if (ledger.length > max) ledger.splice(0, ledger.length - max);
    if (opts.markHandled !== false && entry.preflight.ok) markHandled(entry.actor, g);
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
    var pf = preflight({ actor: actor, behaviorType: type, target: target, source: raw.source || opts.source || 'npc-plan' }, g);
    if (!pf.ok && opts.recordInvalid !== true) return null;
    var plans = ensurePlans(g);
    var turn = raw.turn != null ? Number(raw.turn) : _turn(g);
    var existing = null;
    for (var i = 0; i < plans.length; i++) {
      if (plans[i] && plans[i].actor === actor && plans[i].type === type && plans[i].target === target && plans[i].status !== 'done' && plans[i].status !== 'failed') {
        existing = plans[i];
        break;
      }
    }
    var plan = existing || {
      id: raw.id || _uid('npcplan'),
      actor: actor,
      type: type,
      target: target,
      createdTurn: turn,
      progress: 0,
      status: 'active'
    };
    plan.intent = _str(raw.intent || raw.action || raw.reason || plan.intent || type);
    plan.source = _str(raw.source || opts.source || plan.source || 'npc-autonomy');
    plan.updatedTurn = turn;
    plan.progress = Math.max(Number(plan.progress || 0), Number(raw.progress || opts.progress || 1));
    plan.stage = _str(raw.stage || plan.stage || 'preparing');
    plan.preflight = { ok: pf.ok, errors: pf.errors, warnings: pf.warnings };
    if (!pf.ok) plan.status = 'blocked';
    if (!existing) plans.push(plan);
    var max = Number(opts.max || 160);
    if (plans.length > max) plans.splice(0, plans.length - max);
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
    names.forEach(function(n) { markHandled(n, g); });
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

  TM.NPC.ActionLedger = {
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
