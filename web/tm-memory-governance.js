(function(global) {
  'use strict';

  var root = global || (typeof window !== 'undefined' ? window : {});
  root.TM = root.TM || {};

  var ns = root.TM.MemoryGovernance = root.TM.MemoryGovernance || {};

  function clean(value) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  }

  function add(reasons, code, message) {
    reasons.push({ code: code, message: message || code });
  }

  function numberOrNull(value) {
    if (value == null || value === "" || typeof value === "boolean") return null;
    var n = Number(value);
    return isFinite(n) ? n : null;
  }

  function visibilityDenied(env, actorScope) {
    var vis = clean(env && env.visibility).toLowerCase();
    actorScope = actorScope || {};
    if (!vis || vis === 'public' || vis === 'court' || vis === 'world_truth' || vis === 'player_known' || vis === 'internal') return false;
    if (actorScope.allowHidden === true || actorScope.kind === 'system') return false;
    if (vis === 'hidden' || vis === 'gm_hidden' || vis === 'heaven_secret' || vis === 'quarantine') return true;
    if (vis.indexOf('npc_private:') === 0) {
      return clean(actorScope.npcId).toLowerCase() !== vis.slice('npc_private:'.length);
    }
    if (vis.indexOf('faction_private:') === 0) {
      return clean(actorScope.factionId).toLowerCase() !== vis.slice('faction_private:'.length);
    }
    return false;
  }

  function statusDenied(env, ctx) {
    var status = clean(env && env.status).toLowerCase();
    var intent = clean(ctx && ctx.intent).toLowerCase();
    var review = clean(env && env.reviewStatus).toLowerCase();
    if (status === 'draft' || status === 'pending_review' || review === 'pending_review') return 'pending_review';
    if (status === 'rejected' || review === 'rejected') return 'rejected';
    if (status === 'deleted' || status === 'deleted_tombstone' || status === 'redacted') return 'deleted';
    if ((status === 'stale' || status === 'superseded') && intent !== 'historical_evidence') return 'stale_or_superseded';
    if (status === 'quarantined' || status === 'quarantine') return 'quarantined';
    return '';
  }

  function temporalDenied(env, ctx) {
    env = env || {};
    ctx = ctx || {};
    var turn = numberOrNull(ctx.turn);
    if (turn == null) return '';
    var eventTurn = numberOrNull(env.turn);
    var learnedTurn = numberOrNull(env.learnedAtTurn);
    var intent = clean(ctx.intent).toLowerCase();
    var validFrom = numberOrNull(env.validFromTurn != null ? env.validFromTurn : env.validFrom);
    var validTo = numberOrNull(env.validToTurn != null ? env.validToTurn : env.validTo);
    var expiredAt = numberOrNull(env.expiredAtTurn != null ? env.expiredAtTurn : env.expiredAt);
    if (validFrom != null && turn < validFrom && intent !== 'historical_evidence') return 'not_yet_valid';
    if (ctx.includeFuture !== true && ((eventTurn != null && eventTurn > turn) || (learnedTurn != null && learnedTurn > turn))) return 'future_memory';
    if (((validTo != null && turn > validTo) || (expiredAt != null && turn >= expiredAt)) && intent !== 'historical_evidence') return 'expired_validity';
    return '';
  }

  function isRumor(env) {
    var type = clean(env && (env.type || env.kind)).toLowerCase();
    var authority = clean(env && env.authority).toLowerCase();
    return type === 'rumor' || type === 'rumor_claim' || authority === 'rumor';
  }

  function isProcedural(env) {
    var type = clean(env && (env.type || env.kind)).toLowerCase();
    var authority = clean(env && env.authority).toLowerCase();
    var factStatus = clean(env && env.factStatus).toLowerCase();
    return type === 'procedural_lesson' || authority === 'procedural' || authority === 'reflection' || factStatus === 'procedural_advice';
  }

  function evaluateEnvelope(env, ctx) {
    env = env || {};
    ctx = ctx || {};
    var reasons = [];
    if (visibilityDenied(env, ctx.actorScope || {})) add(reasons, 'visibility_denied', 'actor scope cannot read this memory visibility');
    var statusReason = statusDenied(env, ctx);
    if (statusReason === 'pending_review' || statusReason === 'rejected') add(reasons, statusReason, 'unaccepted memory cannot be injected');
    if (statusReason === 'deleted') add(reasons, 'deleted', 'deleted/tombstone memory cannot be injected');
    if (statusReason === 'stale_or_superseded') add(reasons, 'stale_or_superseded', 'stale/superseded memory cannot serve as current fact');
    if (statusReason === 'quarantined') add(reasons, 'quarantined', 'quarantined memory cannot be injected');
    var temporalReason = temporalDenied(env, ctx);
    if (temporalReason === 'future_memory') add(reasons, 'future_memory', 'memory belongs to a future turn');
    if (temporalReason === 'not_yet_valid') add(reasons, 'not_yet_valid', 'memory is not valid at the current turn');
    if (temporalReason === 'expired_validity') add(reasons, 'expired_validity', 'memory validity window has expired');
    if (isRumor(env) && clean(ctx.intent).toLowerCase() === 'current_fact') add(reasons, 'rumor_as_fact', 'rumor cannot be promoted to current fact');
    if (isProcedural(env) && clean(ctx.intent).toLowerCase() === 'current_fact') add(reasons, 'procedural_as_fact', 'procedural guidance cannot be promoted to current fact');
    if (ctx.requiresAuthority) {
      var auth = clean(env.authority).toLowerCase();
      var low = auth === 'ai_summary' || auth === 'reflection' || auth === 'procedural' || auth === 'vector' || auth === 'external_import' || auth === 'rumor';
      if (low) add(reasons, 'low_authority', 'low authority memory cannot satisfy this request');
    }
    return {
      id: clean(env.id),
      wouldReject: reasons.length > 0,
      reasons: reasons,
      policy: 'memory-governance-v0'
    };
  }

  function annotate(envelopes, ctx) {
    return (Array.isArray(envelopes) ? envelopes : []).map(function(env) {
      var out = {};
      Object.keys(env || {}).forEach(function(k) { out[k] = env[k]; });
      out.governance = evaluateEnvelope(env, ctx);
      return out;
    });
  }

  function canInject(env, ctx) {
    return !evaluateEnvelope(env, ctx).wouldReject;
  }

  ns.evaluateEnvelope = evaluateEnvelope;
  ns.annotate = annotate;
  ns.canInject = canInject;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
