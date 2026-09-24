(function(global) {
  'use strict';

  var root = global || (typeof window !== 'undefined' ? window : {});
  root.TM = root.TM || {};

  var ns = root.TM.MemoryRetrieval = root.TM.MemoryRetrieval || {};
  var _worldIndexCache = typeof WeakMap === 'function' ? new WeakMap() : null;
  var _fallbackWorldIndex = [];

  function _perfCount(name, delta) {
    var perf = root.TM && root.TM.perf;
    if (perf && typeof perf.count === 'function') perf.count(name, delta == null ? 1 : delta);
  }

  function _perfSpan(name, fn, metadata) {
    var perf = root.TM && root.TM.perf;
    if (perf && typeof perf.withSpan === 'function') return perf.withSpan(name, fn, metadata);
    return fn();
  }

  function _worldIndexEntry(GM) {
    if (!GM || typeof GM !== 'object') return null;
    if (_worldIndexCache) {
      var cached = _worldIndexCache.get(GM);
      if (!cached) {
        cached = {};
        _worldIndexCache.set(GM, cached);
      }
      return cached;
    }
    for (var i = 0; i < _fallbackWorldIndex.length; i++) {
      if (_fallbackWorldIndex[i].world === GM) return _fallbackWorldIndex[i].entry;
    }
    var entry = {};
    _fallbackWorldIndex.push({ world: GM, entry: entry });
    if (_fallbackWorldIndex.length > 8) _fallbackWorldIndex.shift();
    return entry;
  }

  function _memoryRevision(GM, domain) {
    if (!GM || typeof GM !== 'object') return 0;
    var field = domain === 'edges' ? '_memoryEdgeRevision' : '_memoryRevision';
    var value = Number(GM[field]);
    return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
  }

  function bumpMemoryRevision(GM, domain) {
    if (!GM || typeof GM !== 'object') return 0;
    var field = domain === 'edges' ? '_memoryEdgeRevision' : '_memoryRevision';
    var next = _memoryRevision(GM, domain) + 1;
    GM[field] = next; // arch-ok MemoryRetrieval owns the world-scoped compilation revision ledger
    invalidateCompilationIndex(GM);
    return next;
  }

  function invalidateCompilationIndex(GM) {
    if (GM && _worldIndexCache) _worldIndexCache.delete(GM);
    if (GM && !_worldIndexCache) {
      _fallbackWorldIndex = _fallbackWorldIndex.filter(function(row) { return row.world !== GM; });
    }
  }

  var SOURCE_PRIORITY = {
    hard_state: 1.0,
    imperialEdict: 1.0,
    pinned: 1.0,
    activeEdict: 0.95,
    eventHistory: 0.85,
    chronicle: 0.8,
    playerAction: 0.88,
    relation_event: 0.76,
    qiju: 0.74,
    jishi: 0.74,
    court_record: 0.78,
    issue: 0.5,
    shiji: 0.72,
    commitment: 0.72,
    npc: 0.62,
    foreshadow: 0.6,
    accepted_memory: 0.55,
    vector: 0.45,
    ai_summary: 0.42,
    procedural: 0.4,
    unknown: 0.35
  };

  function clamp01(v) {
    v = Number(v);
    if (!isFinite(v)) return 0;
    return Math.max(0, Math.min(1, v));
  }

  function arr(value) {
    return Array.isArray(value) ? value : [];
  }

  function numberOrNull(value) {
    if (value == null || value === "" || typeof value === "boolean") return null;
    var n = Number(value);
    return isFinite(n) ? n : null;
  }

  function textOf(hit) {
    hit = hit || {};
    return String(hit.safeBody != null ? hit.safeBody : (hit.text != null ? hit.text : (hit.event != null ? hit.event : (hit.content != null ? hit.content : ''))));
  }

  function sourceOf(hit) {
    hit = hit || {};
    return String(hit.source || (hit.char ? 'npc' : 'unknown'));
  }

  function visibilityOf(hit) {
    hit = hit || {};
    if (hit.hidden === true || hit.visibility === false) return 'hidden';
    var vis = String(hit.visibility || 'internal');
    var low = vis.toLowerCase();
    if (low === 'hidden' || low === 'gm_hidden' || low === 'heaven_secret' || low === 'quarantine' || low === 'quarantined') return 'hidden';
    return vis;
  }

  function isClosedLiveStatus(hit) {
    hit = hit || {};
    var src = sourceOf(hit);
    if (src !== 'activeEdict' && src !== 'imperialEdict' && src !== 'commitment') return false;
    var s = String(hit.status || hit.lifecycle || '').toLowerCase();
    if (!s) return false;
    return s === 'completed' || s === 'complete' || s === 'failed' || s === 'abandoned' ||
      s === 'aborted' || s === 'cancelled' || s === 'canceled' || s === 'rejected' ||
      s === 'expired' || s === 'obsolete' || s === 'superseded';
  }

  function isVisible(hit, opts) {
    opts = opts || {};
    if (!hit) return false;
    if (visibilityOf(hit) === 'hidden' && opts.includeHidden !== true) return false;
    if (isClosedLiveStatus(hit)) return false;
    var turn = Number(opts.turn || 0);
    if (turn && hit.expiresTurn && Number(hit.expiresTurn) < turn) return false;
    if (temporalSuppressionReason(hit, opts)) return false;
    return true;
  }

  function pushUnique(out, seen, value) {
    value = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
    if (!value || seen[value]) return;
    seen[value] = true;
    out.push(value);
  }

  function memoryControlKeys(hit) {
    hit = hit || {};
    var keys = [];
    var seen = {};
    arr(hit.sourceRefs).concat(arr(hit.basisRefs)).forEach(function(ref) {
      if (!ref) return;
      var type = String(ref.type || '').trim();
      var id = String(ref.id || '').trim();
      if (!type || !id) return;
      pushUnique(keys, seen, type + ':' + id);
      pushUnique(keys, seen, type + ':id:' + id);
      pushUnique(keys, seen, id);
    });
    var src = sourceOf(hit);
    var id = hit.id || hit.key || hit.uuid || hit.sourceId || '';
    if (id) {
      pushUnique(keys, seen, src + ':' + id);
      pushUnique(keys, seen, src + ':id:' + id);
      pushUnique(keys, seen, id);
    }
    return keys;
  }

  function memoryControlKey(hit) {
    return memoryControlKeys(hit)[0] || '';
  }

  function compactMemoryControl(ctrl, key) {
    ctrl = ctrl || {};
    var out = { key: key || '' };
    if (ctrl.resident === true) out.resident = true;
    if (ctrl.pinned === true) out.pinned = true;
    if (ctrl.locked === true) out.locked = true;
    if (ctrl.hidden === true) out.hidden = true;
    if (ctrl.archived === true) out.archived = true;
    if (ctrl.markedFalse === true) out.markedFalse = true;
    if (ctrl.supersededBy) out.supersededBy = String(ctrl.supersededBy).slice(0, 180);
    if (ctrl.cooldownUntilTurn != null) out.cooldownUntilTurn = Number(ctrl.cooldownUntilTurn);
    if (ctrl.reason) out.reason = String(ctrl.reason).slice(0, 120);
    return out;
  }

  function memoryControlForHit(hit, opts) {
    opts = opts || {};
    var GM = opts.GM || {};
    var durable = null, store = GM._memoryLongTerm;
    if (!opts.ignoreDurable) {
      var entry = _worldIndexEntry(GM);
      if (entry && entry.longTermStore !== store) {
        entry.longTermStore = store; entry.longTermControls = Object.create(null);
        arr(store && store.records).forEach(function(record) { if (record.durableControl) entry.longTermControls[record.id] = record.durableControl; });
      }
      durable = hit && hit.durableControl || (entry && entry.longTermControls && hit && entry.longTermControls[hit.id]) || null;
    }
    var controls = GM._memoryControls;
    if (!controls) return durable;
    var keys = memoryControlKeys(hit);
    if (Array.isArray(controls)) {
      for (var i = 0; i < controls.length; i++) {
        var item = controls[i] || {};
        var key = item.key || (item.type && item.id ? (item.type + ':' + item.id) : '');
        if (key && keys.indexOf(String(key)) >= 0) return compactMemoryControl(item, key);
      }
      return durable;
    }
    if (typeof controls === 'object') {
      for (var j = 0; j < keys.length; j++) {
        var ctrl = controls[keys[j]];
        if (ctrl) return compactMemoryControl(ctrl, keys[j]);
      }
    }
    return durable;
  }

  function applyMemoryControls(hit, opts) {
    var ctrl = memoryControlForHit(hit, opts);
    if (!ctrl) return hit;
    var out = cloneHit(hit);
    if (ctrl.resident === true || ctrl.pinned === true) out.pinned = true;
    if (ctrl.locked === true) out.locked = true;
    out.memoryControl = ctrl;
    return out;
  }

  function lowerList(list) {
    return arr(list).map(function(v) {
      return String(v == null ? '' : v).toLowerCase();
    }).filter(Boolean);
  }

  function scopeList(value) {
    var list = [];
    if (Array.isArray(value)) list = value;
    else if (value != null) list = String(value).split(/[\s,;|]+/);
    return list.map(function(v) {
      return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().toLowerCase();
    }).filter(Boolean);
  }

  function readScopeSuppressionReason(hit, opts) {
    opts = opts || {};
    hit = hit || {};
    var scopes = scopeList(hit.readScope || hit.readScopes || hit.audienceScope);
    if (!scopes.length) return '';
    if (scopes.indexOf('public') >= 0 || scopes.indexOf('world') >= 0 || scopes.indexOf('world:public') >= 0 ||
      scopes.indexOf('global') >= 0 || scopes.indexOf('all') >= 0 || scopes.indexOf('*') >= 0) return '';
    var actorScope = opts.actorScope || {};
    if (typeof actorScope === 'string') actorScope = { kind: actorScope };
    var audience = String(opts.audience || actorScope.kind || opts.actorKind || '').toLowerCase();
    var actorId = String(opts.actorId || opts.actor || actorScope.actorId || actorScope.npcId || actorScope.id || '').toLowerCase();
    var factionId = String(opts.factionId || opts.faction || actorScope.factionId || '').toLowerCase();
    if (!audience || audience === 'gm' || audience === 'system' || audience === 'designer') return '';

    function has(token) { return scopes.indexOf(token) >= 0; }
    if (has(audience)) return '';
    if (actorId && (has(actorId) || has(audience + ':' + actorId) || has('actor:' + actorId) || has('npc:' + actorId))) return '';
    if (factionId && (has(factionId) || has('faction:' + factionId))) return '';
    if (audience === 'player' && (has('player') || has('player_known') || has('player:known'))) return '';
    if (audience === 'npc' && (has('npc') || has('npc:any'))) return '';
    if (audience === 'faction' && (has('faction') || has('faction:any'))) return '';
    return 'read_scope';
  }

  function audienceSuppressionReason(hit, opts) {
    opts = opts || {};
    hit = hit || {};
    var scope = opts.actorScope || {};
    if (typeof scope === 'string') scope = { kind: scope };
    var audience = String(opts.audience || scope.kind || '').toLowerCase();
    if (!audience || audience === 'gm' || audience === 'system' || audience === 'designer') return '';
    var vis = String(hit.visibility || '').toLowerCase();
    var actorId = String(opts.actorId || opts.actor || scope.actorId || scope.npcId || scope.id || '').toLowerCase();
    var factionId = String(opts.factionId || opts.faction || scope.factionId || '').toLowerCase();
    var allowed = lowerList(hit.audience).concat(lowerList(hit.audiences));
    scopeList(hit.readScope).concat(scopeList(hit.ownerScope)).forEach(function(token) { if (token.indexOf('npc:') === 0 || token.indexOf('faction:') === 0) allowed.push(token.slice(token.indexOf(':') + 1)); });
    if (hit.ownerId) allowed.push(String(hit.ownerId).toLowerCase());
    if (vis.indexOf('npc_private:') === 0) { allowed.push(vis.slice(12)); vis = 'npc_private'; }
    if (vis.indexOf('faction_private:') === 0) { allowed.push(vis.slice(16)); vis = 'faction_private'; }
    if (audience === 'npc') {
      if (vis === 'player_known' || vis === 'player_only' || vis === 'gm_only') return 'audience_scope';
      if (vis === 'npc_private' && (!actorId || allowed.indexOf(actorId) < 0)) return 'audience_scope';
      if (vis === 'faction_private') return 'audience_scope';
    }
    if (audience === 'faction') {
      if (vis === 'player_known' || vis === 'player_only' || vis === 'gm_only' || vis === 'npc_private') return 'audience_scope';
      if (vis === 'faction_private' && (!factionId || allowed.indexOf(factionId) < 0)) return 'audience_scope';
    }
    if (audience === 'player') {
      if (vis === 'npc_private' || vis === 'faction_private' || vis === 'gm_only') return 'audience_scope';
    }
    return '';
  }

  function memoryBoundaryReason(hit, opts) {
    hit = hit || {};
    opts = opts || {};
    var gm = opts.GM || {};
    var states = [hit.status, hit.reviewStatus, hit.factStatus].map(function(s) { return String(s || '').toLowerCase(); });
    if (states.indexOf('draft') >= 0 || states.indexOf('pending_review') >= 0) return 'pending_review';
    if (states.indexOf('rejected') >= 0) return 'rejected';
    if (states.indexOf('quarantine') >= 0 || states.indexOf('quarantined') >= 0) return 'quarantined';
    if (states.indexOf('deleted') >= 0 || states.indexOf('deleted_tombstone') >= 0 || states.indexOf('redacted') >= 0) return 'deleted';
    if (hit.active === false) return 'inactive';
    if (hit.safeBody != null && !String(hit.safeBody).trim()) return 'empty_safe_body';
    var bindings = [
      ['worldId', opts.worldId || gm.worldId || gm._worldId || gm.scenarioId || gm.scenarioKey],
      ['saveId', opts.saveId || gm.saveId || gm._saveId || gm.runId || gm.campaignId || gm._campaignId],
      ['campaignId', opts.campaignId || gm.campaignId || gm._campaignId],
      ['timelineId', opts.timelineId || gm.timelineId || gm._timelineId]
    ];
    for (var i = 0; i < bindings.length; i++) {
      var field = bindings[i][0], expected = bindings[i][1];
      if (expected != null && expected !== '' && hit[field] != null && hit[field] !== '' && String(hit[field]) !== String(expected)) {
        // Loading forks the timeline: common parent history remains valid up to the fork, never after it.
        var forkTurn = numberOrNull(gm._forkTurn);
        var eventTurn = numberOrNull(hit.turn);
        var learnedTurn = numberOrNull(hit.learnedAtTurn);
        var parentHistory = field === 'timelineId' && String(expected) === String(gm.timelineId || gm._timelineId || '') && gm._parentTimelineId && String(hit[field]) === String(gm._parentTimelineId)
          && forkTurn != null && eventTurn != null && eventTurn <= forkTurn && (learnedTurn == null || learnedTurn <= forkTurn);
        if (!parentHistory) return 'world_scope';
      }
    }
    return '';
  }

  function suppressionReason(hit, opts) {
    opts = opts || {};
    if (!hit) return 'empty';
    var boundary = memoryBoundaryReason(hit, opts);
    if (boundary) return boundary;
    var turn = Number(opts.turn || 0);
    var ctrl = memoryControlForHit(hit, opts);
    if (ctrl && ctrl.markedFalse === true) return 'marked_false';
    if (ctrl && ctrl.archived === true) return 'archived_control';
    if (ctrl && ctrl.supersededBy) return 'superseded';
    if (ctrl && ctrl.hidden === true && opts.includeHidden !== true) return 'hidden_control';
    if (visibilityOf(hit) === 'hidden' && opts.includeHidden !== true) return 'hidden';
    var audienceReason = audienceSuppressionReason(hit, opts);
    if (audienceReason) return audienceReason;
    var readScopeReason = readScopeSuppressionReason(hit, opts);
    if (readScopeReason) return readScopeReason;
    if (isClosedLiveStatus(hit)) return 'closed_status';
    if (ctrl && turn && ctrl.cooldownUntilTurn != null && Number(ctrl.cooldownUntilTurn) >= turn) return 'cooldown';
    if (turn && hit.expiresTurn && Number(hit.expiresTurn) < turn) return 'expired';
    var temporalReason = temporalSuppressionReason(hit, opts);
    if (temporalReason) return temporalReason;
    var governanceReason = governanceSuppressionReason(hit, opts);
    if (governanceReason) return governanceReason;
    return '';
  }

  function temporalSuppressionReason(hit, opts) {
    hit = hit || {};
    opts = opts || {};
    var turn = numberOrNull(opts.turn);
    if (turn == null || opts.includeFuture === true) return '';
    var eventTurn = numberOrNull(hit.turn);
    var learnedTurn = numberOrNull(hit.learnedAtTurn);
    var intent = String(opts.intent || 'current_fact').toLowerCase();
    var validFrom = numberOrNull(hit.validFromTurn != null ? hit.validFromTurn : hit.validFrom);
    var validTo = numberOrNull(hit.validToTurn != null ? hit.validToTurn : hit.validTo);
    var expiredAt = numberOrNull(hit.expiredAtTurn != null ? hit.expiredAtTurn : hit.expiredAt);
    if (validFrom != null && turn < validFrom && intent !== 'historical_evidence') return 'not_yet_valid';
    if ((eventTurn != null && eventTurn > turn) || (learnedTurn != null && learnedTurn > turn)) return 'future_memory';
    if ((validTo != null && turn > validTo) || (expiredAt != null && turn >= expiredAt)) {
      return intent === 'historical_evidence' ? '' : 'expired';
    }
    return '';
  }

  function governanceTypeForHit(hit) {
    hit = hit || {};
    var src = sourceOf(hit);
    var type = String(hit.type || hit.kind || '').toLowerCase();
    if (type) return type;
    if (src === 'rumor') return 'rumor_claim';
    if (src === 'procedural') return 'procedural_lesson';
    if (src === 'ai_summary') return 'summary';
    if (src === 'hard_state') return 'hard_state';
    if (src === 'commitment') return 'commitment';
    if (src === 'imperialEdict' || src === 'activeEdict') return 'active_law';
    if (src === 'accepted_memory') return 'semantic_fact';
    return 'episodic_event';
  }

  function governanceAuthorityForHit(hit) {
    hit = hit || {};
    if (hit.authority) return hit.authority;
    var src = sourceOf(hit);
    if (src === 'rumor') return 'rumor';
    if (src === 'procedural') return 'procedural';
    if (src === 'ai_summary') return 'ai_summary';
    if (src === 'hard_state') return 'engine_state';
    if (src === 'imperialEdict' || src === 'activeEdict') return 'player_pin';
    if (src === 'commitment') return 'rule_validated';
    if (src === 'vector') return 'vector';
    return '';
  }

  function governanceEnvFromHit(hit) {
    hit = hit || {};
    return {
      id: hit.id || hit.key || hit.uuid || '',
      type: governanceTypeForHit(hit),
      body: textOf(hit),
      status: hit.status || 'active',
      reviewStatus: hit.reviewStatus || '',
      turn: hit.turn,
      learnedAtTurn: hit.learnedAtTurn,
      authority: governanceAuthorityForHit(hit),
      visibility: visibilityOf(hit),
      factStatus: hit.factStatus || '',
      validFromTurn: hit.validFromTurn,
      validToTurn: hit.validToTurn,
      expiredAtTurn: hit.expiredAtTurn,
      sourceRefs: arr(hit.sourceRefs),
      basisRefs: arr(hit.basisRefs)
    };
  }

  function governanceSuppressionReason(hit, opts) {
    opts = opts || {};
    var MG = root.TM && root.TM.MemoryGovernance;
    if (!MG || typeof MG.evaluateEnvelope !== 'function') return '';
    var actorScope = {};
    if (opts.actorScope && typeof opts.actorScope === 'object') Object.keys(opts.actorScope).forEach(function(k) { actorScope[k] = opts.actorScope[k]; });
    actorScope.kind = opts.audience || actorScope.kind || (typeof opts.actorScope === 'string' ? opts.actorScope : '');
    actorScope.npcId = opts.actorId || opts.actor || actorScope.npcId || actorScope.actorId || actorScope.id || '';
    actorScope.factionId = opts.factionId || opts.faction || actorScope.factionId || '';
    var evalResult = MG.evaluateEnvelope(governanceEnvFromHit(hit), {
      turn: opts.turn,
      includeFuture: opts.includeFuture,
      intent: opts.intent || opts.retrievalIntent || 'current_fact',
      requiresAuthority: opts.requiresAuthority,
      actorScope: actorScope
    });
    if (!evalResult || !evalResult.wouldReject || !Array.isArray(evalResult.reasons) || !evalResult.reasons.length) return '';
    return evalResult.reasons[0].code || 'governance_rejected';
  }

  function compactSuppressed(hit, reason, extra) {
    hit = hit || {};
    var item = {
      id: String(hit.id || hit.key || hit.uuid || ''),
      source: sourceOf(hit),
      reason: String(reason || 'filtered'),
      status: hit.status != null ? String(hit.status) : '',
      turn: Number(hit.turn || 0),
      textPreview: textOf(hit).replace(/\s+/g, ' ').trim().slice(0, 80)
    };
    if (extra && extra.by) item.by = String(extra.by);
    if (extra && extra.edgeReason) item.edgeReason = String(extra.edgeReason).slice(0, 80);
    if (extra && extra.budgetStage) item.budgetStage = String(extra.budgetStage).slice(0, 40);
    if (extra && typeof extra.cost === 'number') item.cost = Number(extra.cost || 0);
    return item;
  }

  function filterVisibleHits(hits, opts) {
    if (!Array.isArray(hits)) return [];
    return hits.filter(function(hit) { return isVisible(hit, opts); });
  }

  function importanceOf(hit) {
    hit = hit || {};
    if (typeof hit.importance === 'number') return clamp01(hit.importance / 10);
    if (typeof hit.weight === 'number') return clamp01(hit.weight / 10);
    if (hit.affects_future === true || hit.affects_future === 'true') return 0.85;
    return 0.5;
  }

  function relevanceOf(hit) {
    hit = hit || {};
    if (typeof hit.relevance === 'number') return clamp01(hit.relevance);
    if (typeof hit.sim === 'number') return clamp01(hit.sim);
    if (typeof hit.score === 'number') return clamp01(hit.score);
    if (typeof hit._score === 'number') return clamp01(hit._score);
    return 0.65;
  }

  // S5b(2026-06-03): 连续 salience 衰减——穿过原 5 桶锚点(dt=1→1.0/5→0.85/15→0.65/50→0.45/远→0.30)的单调线性插值，
  // 取代阶梯硬跳，使"老但曾重要"的记忆渐进降权而非突降；边界值与原桶一致(保 golden 排序·recency 仅占评分 0.15)。
  function _recLerp(d, d0, v0, d1, v1) { return v0 + (v1 - v0) * (d - d0) / (d1 - d0); }
  function recencyOf(hit, opts) {
    hit = hit || {};
    opts = opts || {};
    var cur = Number(opts.turn || 0);
    var turn = Number(hit.turn || 0);
    if (!cur || !turn) return 0.55;
    var dt = cur - turn;
    if (dt <= 1) return 1.0;
    if (dt <= 5) return _recLerp(dt, 1, 1.0, 5, 0.85);
    if (dt <= 15) return _recLerp(dt, 5, 0.85, 15, 0.65);
    if (dt <= 50) return _recLerp(dt, 15, 0.65, 50, 0.45);
    if (dt <= 150) return _recLerp(dt, 50, 0.45, 150, 0.30);
    return 0.30;
  }

  function sourcePriorityOf(hit) {
    var src = sourceOf(hit);
    return SOURCE_PRIORITY[src] != null ? SOURCE_PRIORITY[src] : SOURCE_PRIORITY.unknown;
  }

  function isOpenStatus(status) {
    var s = String(status || '').toLowerCase();
    if (!s) return true;
    return s === 'active' || s === 'pending' || s === 'executing' || s === 'partial' || s === 'obstructed' || s === 'pending_delivery' || s === 'delayed';
  }

  function queryTerms(q) {
    q = q || {};
    var terms = [];
    if (Array.isArray(q.keywords)) terms = terms.concat(q.keywords);
    else if (q.keywords) terms.push(q.keywords);
    if (q.participant) terms.push(q.participant);
    if (q.query) terms.push(q.query);
    if (q.purpose) terms.push(q.purpose);
    return terms.map(function(t) { return String(t || '').trim().toLowerCase(); })
      .filter(function(t) { return t && t.length <= 80; })
      .slice(0, 12);
  }

  function matchesQuery(text, q) {
    var terms = queryTerms(q);
    if (!terms.length) return true;
    var hay = String(text || '').toLowerCase();
    return terms.some(function(t) { return hay.indexOf(t) >= 0; });
  }

  function cleanTerm(value, maxLen) {
    var s = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
    if (!s) return '';
    return s.slice(0, maxLen || 60);
  }

  function normalizeKeywords(value) {
    var list = [];
    if (Array.isArray(value)) list = value;
    else if (value != null) list = [value];
    var seen = {};
    var out = [];
    list.forEach(function(item) {
      var term = cleanTerm(item, 40);
      var key = term.toLowerCase();
      if (!term || seen[key]) return;
      seen[key] = true;
      out.push(term);
    });
    return out.slice(0, 6);
  }

  function copyRecallQuery(q) {
    q = q || {};
    var out = {};
    Object.keys(q).forEach(function(k) { out[k] = q[k]; });
    out.keywords = normalizeKeywords(q.keywords);
    if (!out.keywords.length && q.query) out.keywords = normalizeKeywords(q.query);
    if (q.participant) out.participant = cleanTerm(q.participant, 40);
    if (q.purpose) out.purpose = cleanTerm(q.purpose, 120);
    if (out.participant && out.keywords.indexOf(out.participant) < 0) {
      out.keywords = [out.participant].concat(out.keywords).slice(0, 6);
    }
    return out;
  }

  function recallQueryKey(q) {
    q = q || {};
    var participant = cleanTerm(q.participant, 40).toLowerCase();
    if (participant) return 'participant:' + participant;
    return 'keywords:' + normalizeKeywords(q.keywords).map(function(k) { return k.toLowerCase(); }).sort().join('|');
  }

  function pushRecallQuery(out, seen, q, maxQueries) {
    if (!q || out.length >= maxQueries) return;
    var item = copyRecallQuery(q);
    if (!item.keywords.length && !item.participant) return;
    var key = recallQueryKey(item);
    if (!key || seen[key]) return;
    seen[key] = true;
    out.push(item);
  }

  function addAutoRecallQuery(out, seen, maxQueries, name, source, purpose, extraKeywords) {
    name = cleanTerm(name, 40);
    if (!name) return;
    var keywords = [name].concat(normalizeKeywords(extraKeywords)).slice(0, 6);
    pushRecallQuery(out, seen, {
      keywords: keywords,
      participant: name,
      minImportance: 5,
      purpose: purpose,
      _auto: true,
      _source: source
    }, maxQueries);
  }

  function recentPlayerDecisionText(GM) {
    var parts = [];
    if (GM && Array.isArray(GM.playerDecisions)) {
      GM.playerDecisions.slice(-8).forEach(function(d) {
        if (!d) return;
        parts.push([d.type, d.content, d.description, d.target, d.result].filter(Boolean).join(' '));
      });
    }
    return parts.join(' ');
  }

  // 办结不等于废止：诏令按效力仍现行时，照样算作现行法令（tm-edict-efficacy.js）
  function edictInForce(GM, e) {
    var efficacy = root.TM && root.TM.EdictEfficacy;
    return !!(efficacy && efficacy.isCurrent(e, Number(GM && GM.turn) || 0));
  }

  // 皇命表的行是数组，与信封模块共用同一读法（tm-memory-envelope.js imperialEdictRecord）
  function imperialRow(row) {
    var envelope = root.TM && root.TM.MemoryEnvelope;
    return envelope && envelope.imperialEdictRecord ? envelope.imperialEdictRecord(row) : row;
  }

  function activeEdictTexts(GM) {
    var parts = [];
    if (!GM) return parts;
    if (Array.isArray(GM.activeEdicts)) {
      GM.activeEdicts.forEach(function(e) {
        if (!e || !isOpenStatus(e.status || 'active')) return;
        parts.push([e.name, e.category, e.assignee, e.target, e.content, e.reason, e.feedback].filter(Boolean).join(' '));
      });
    }
    if (Array.isArray(GM._edictTracker)) {
      GM._edictTracker.forEach(function(e) {
        if (!e || !(isOpenStatus(e.status || 'pending') || edictInForce(GM, e))) return;
        parts.push([e.content, e.category, e.assignee, e.target, e.feedback, e.reason].filter(Boolean).join(' '));
      });
    }
    var rows = GM._memTables && GM._memTables.imperialEdict && Array.isArray(GM._memTables.imperialEdict.rows)
      ? GM._memTables.imperialEdict.rows
      : [];
    rows.forEach(function(row) {
      row = imperialRow(row);
      if (!row || !isOpenStatus(row.status || row.lifecycle || 'active')) return;
      parts.push([row.title, row.content, row.text, row.assignee, row.target, row.condition, row.notes].filter(Boolean).join(' '));
    });
    return parts;
  }

  function addCharacterQueriesFromText(out, seen, maxQueries, GM, text, source, purpose) {
    if (!GM || !Array.isArray(GM.chars) || !text) return;
    var hay = String(text).toLowerCase();
    GM.chars.forEach(function(ch) {
      if (!ch || !ch.name) return;
      var name = cleanTerm(ch.name, 40);
      if (!name) return;
      if (hay.indexOf(name.toLowerCase()) < 0) return;
      addAutoRecallQuery(out, seen, maxQueries, name, source, purpose, []);
    });
  }

  function buildRecallQueries(GM, baseQueries, opts) {
    opts = opts || {};
    var maxQueries = Math.max(1, Number(opts.maxQueries || 6));
    var out = [];
    var seen = {};
    (Array.isArray(baseQueries) ? baseQueries : []).forEach(function(q) {
      pushRecallQuery(out, seen, q, maxQueries);
    });

    var sc1q = opts.sc1q || {};
    if (Array.isArray(sc1q.dialogue_commitments)) {
      sc1q.dialogue_commitments.forEach(function(c) {
        if (!c || !c.npc) return;
        addAutoRecallQuery(out, seen, maxQueries, c.npc, 'dialogue_commitment', 'auto_priority: dialogue commitment', [c.task, c.required_npc_action, c.deadline]);
      });
    }

    addCharacterQueriesFromText(out, seen, maxQueries, GM, recentPlayerDecisionText(GM), 'player_decision', 'auto_priority: player decision mentions character');
    activeEdictTexts(GM).forEach(function(text) {
      addCharacterQueriesFromText(out, seen, maxQueries, GM, text, 'active_edict', 'auto_priority: active edict mentions character');
    });

    return out.slice(0, maxQueries);
  }

  function pushPriorityHit(out, q, hit) {
    if (!hit || !matchesQuery(hit.text, q)) return;
    out.push(hit);
  }

  function envelopeSource(env) {
    env = env || {};
    var type = String(env.type || env.kind || '');
    var refType = env.sourceRefs && env.sourceRefs[0] && env.sourceRefs[0].type || '';
    if (type === 'hard_state') return 'hard_state';
    if (type === 'commitment') return 'commitment';
    if (type === 'active_law') return refType === 'imperialEdict' ? 'imperialEdict' : 'activeEdict';
    if (type === 'player_action_record') return 'playerAction';
    if (type === 'ongoing_affair' || type === 'chronicle_event') return 'chronicle';
    if (type === 'court_dialogue_record') return 'jishi';
    if (type === 'court_resolution' || type === 'court_record') return 'court_record';
    if (type === 'relationship_event') return 'relation_event';
    if (type === 'strategic_issue' || type === 'issue_update' || type === 'issue_resolution') return 'issue';
    if (type === 'official_record') return refType === 'qijuHistory' ? 'qiju' : 'eventHistory';
    if (type === 'historiography_draft' || type === 'historiography_summary') return 'ai_summary';
    if (type === 'procedural_lesson') return 'procedural';
    if (type === 'semantic_fact' || type === 'accepted_memory') return 'accepted_memory';
    if (type === 'narrative_thread') return 'foreshadow';
    if (type === 'summary') return env.authority === 'ai_summary' ? 'ai_summary' : 'eventHistory';
    if (type === 'episodic_event') return refType === 'shijiHistory' ? 'shiji' : 'eventHistory';
    if (type === 'rumor_claim') return 'rumor';
    return 'unknown';
  }

  function hitFromEnvelope(env) {
    env = env || {};
    var source = envelopeSource(env);
    var extra = env.extra || {};
    var hit = {
      id: env.id,
      source: source,
      type: env.type || env.kind || '',
      turn: Number(env.turn || 0),
      text: textOf({ text: env.safeBody != null ? env.safeBody : env.body }),
      safeBody: env.safeBody != null ? env.safeBody : (env.body || ''),
      reviewStatus: env.reviewStatus || '',
      campaignId: env.campaignId || '',
      timelineId: env.timelineId || '',
      entities: Array.isArray(env.entities) ? env.entities.slice() : [],
      status: env.status || 'active',
      importance: extra.importance != null ? Number(extra.importance) : (source === 'hard_state' ? 10 : (source === 'activeEdict' || source === 'imperialEdict' ? 9 : (source === 'commitment' ? 8 : 5))),
      relevance: source === 'hard_state' ? 0.95 : (source === 'activeEdict' || source === 'imperialEdict' ? 0.9 : 0.75),
      affects_future: source === 'hard_state' || source === 'activeEdict' || source === 'imperialEdict' || source === 'commitment',
      visibility: env.visibility || 'internal',
      authority: env.authority || '',
      authorityRank: env.authorityRank != null ? Number(env.authorityRank) : null,
      confidence: env.confidence != null ? Number(env.confidence) : null,
      factStatus: env.factStatus || '',
      validFromTurn: env.validFromTurn != null ? Number(env.validFromTurn) : null,
      validToTurn: env.validToTurn != null ? Number(env.validToTurn) : null,
      learnedAtTurn: env.learnedAtTurn != null ? Number(env.learnedAtTurn) : null,
      expiredAtTurn: env.expiredAtTurn != null ? Number(env.expiredAtTurn) : null,
      invalidationRefs: Array.isArray(env.invalidationRefs) ? env.invalidationRefs : [],
      invalidationReason: env.invalidationReason || '',
      sourceRefs: Array.isArray(env.sourceRefs) ? env.sourceRefs : [],
      basisRefs: Array.isArray(env.basisRefs) ? env.basisRefs : [],
      audience: Array.isArray(env.audience) ? env.audience : (Array.isArray(extra.audience) ? extra.audience : []),
      readScope: env.readScope || extra.readScope || '',
      ownerScope: env.ownerScope || extra.ownerScope || '',
      writeScope: env.writeScope || extra.writeScope || '',
      schemaVersion: env.schemaVersion || '',
      projectionVersion: env.projectionVersion,
      memoryKind: env.memoryKind || (env.extra && env.extra.memoryKind) || (root.TM.MemoryLongTerm && Object.prototype.hasOwnProperty.call(root.TM.MemoryLongTerm.types, env.type) ? env.type : ""),
      longTerm: env.longTerm === true,
      durableControl: env.durableControl || null,
      saveId: env.saveId || '',
      worldId: env.worldId || '',
      ownerKind: env.ownerKind || extra.ownerKind || '',
      ownerId: env.ownerId || extra.ownerId || '',
      lane: env.lane || '',
      reason: 'envelope:' + (env.type || 'unknown')
    };
    if (Array.isArray(env.entities) && env.entities.length) hit.char = env.entities[0];
    if (source === 'hard_state') {
      hit.status = extra.alive === false ? 'dead' : 'alive';
      hit.hardStateType = 'character';
      hit.alive = extra.alive !== false;
      hit.sourceId = extra.sourceId || '';
    }
    return hit;
  }

  function envelopeNodes(env) {
    env = env || {};
    var nodes = [env.id, env.key, env.uuid, env.type && env.id ? (env.type + ':' + env.id) : ''];
    arr(env.sourceRefs).concat(arr(env.basisRefs)).forEach(function(ref) {
      if (!ref) return;
      if (ref.type && ref.id) nodes.push(String(ref.type) + ':' + String(ref.id));
      if (ref.id) nodes.push(ref.id);
    });
    return nodes.map(normalizeNode).filter(Boolean);
  }

  function nodeListMatches(nodes, node) {
    var target = normalizeNode(node);
    if (!target) return false;
    return arr(nodes).some(function(n) {
      return n === target || (target.length >= 4 && n.indexOf(target) >= 0) || (n.length >= 4 && target.indexOf(n) >= 0);
    });
  }

  function graphExpansionAllowed(edge) {
    var t = String(edge && edge.type || '').toLowerCase();
    return t === 'causes' || t === 'continues' || t === 'elaborates' || t === 'mentions' ||
      t === 'supports' || t === 'related' || t === 'related_to' || t === 'resolves';
  }

  function graphExpandHits(GM, hits, opts) {
    opts = opts || {};
    if (!GM || !Array.isArray(hits) || !hits.length) return [];
    var ME = root.TM && root.TM.MemoryEnvelope;
    if (!ME || typeof ME.collect !== 'function') return [];
    var edges = allRelationEdges(GM).filter(graphExpansionAllowed);
    if (!edges.length) return [];
    var envelopes = _perfSpan('memory.collect', function() {
      return ME.collect(GM, { turn: opts.turn, sc1q: opts.sc1q });
    }, { reason: 'graph-expand' });
    _perfCount('memory.envelopesProjected', envelopes.length);
    var envRows = envelopes.map(function(env) {
      return { env: env, nodes: envelopeNodes(env) };
    });
    var out = [];
    var seen = {};
    hits.forEach(function(hit) {
      var hnodes = hitNodes(hit);
      edges.forEach(function(edge) {
        var targetNode = '';
        if (nodeListMatches(hnodes, edge.src)) targetNode = edge.dst;
        else if (nodeListMatches(hnodes, edge.dst)) targetNode = edge.src;
        if (!targetNode) return;
        envRows.forEach(function(row) {
          if (!row || !row.env || !nodeListMatches(row.nodes, targetNode)) return;
          var key = row.env.type + ':' + row.env.id;
          if (seen[key]) return;
          seen[key] = true;
          var gh = hitFromEnvelope(row.env);
          gh.reason = 'graph:' + String(edge.type || 'related');
          gh.relevance = Math.max(Number(gh.relevance || 0), 0.68);
          gh.importance = Math.max(Number(gh.importance || 0), 5);
          gh.graphEdge = {
            type: String(edge.type || ''),
            src: edge.src,
            dst: edge.dst,
            reason: edge.reason || '',
            turn: edge.turn
          };
          out.push(gh);
        });
      });
    });
    return out;
  }

  function collectEnvelopePriorityHits(GM, q, opts) {
    opts = opts || {};
    var ME = root.TM && root.TM.MemoryEnvelope;
    if (!ME || typeof ME.collect !== 'function') return [];
    var out = [];
    var envelopes = _perfSpan('memory.collect', function() {
      return ME.collect(GM, { turn: opts.turn, sc1q: opts.sc1q });
    }, { reason: 'priority-hits' });
    _perfCount('memory.envelopesProjected', envelopes.length);
    envelopes.forEach(function(env) {
      var source = envelopeSource(env);
      if (source !== 'hard_state' &&
        source !== 'activeEdict' &&
        source !== 'imperialEdict' &&
        source !== 'commitment' &&
        source !== 'issue' &&
        !(source === 'chronicle' && env.type === 'ongoing_affair') &&
        source !== 'court_record' &&
        source !== 'relation_event' &&
        source !== 'accepted_memory' &&
        source !== 'procedural' &&
        source !== 'playerAction') return;
      pushPriorityHit(out, q, hitFromEnvelope(env));
    });
    return out;
  }

  function isCharacterAlive(ch) {
    ch = ch || {};
    var status = String(ch.status || ch.lifeStatus || '').toLowerCase();
    if (ch.alive === false || ch.dead === true || ch.isDead === true) return false;
    return !(status === 'dead' || status === 'deceased' || status === 'killed' || status === 'executed');
  }

  function characterHardStateText(ch, alive) {
    ch = ch || {};
    return [
      ch.name,
      alive ? 'alive' : 'dead',
      ch.location || ch.currentLocation || ch.place,
      ch.officialTitle || ch.officeTitle || ch.title || ch.position,
      ch.faction || ch.party || ch.group,
      alive ? '' : (ch.deathReason || ch.deadReason || ch.causeOfDeath),
      alive ? '' : (ch.deathTurn || ch.deadTurn ? 'turn ' + (ch.deathTurn || ch.deadTurn) : '')
    ].filter(Boolean).join(' ');
  }

  function collectPriorityHits(GM, q, opts) {
    opts = opts || {};
    var out = [];
    if (!GM) return out;
    var turn = Number(GM.turn || opts.turn || 0);
    out = out.concat(collectEnvelopePriorityHits(GM, q, opts));

    if (Array.isArray(GM.chars)) {
      GM.chars.forEach(function(ch, i) {
        if (!ch || !ch.name) return;
        var alive = isCharacterAlive(ch);
        var sourceTurn = alive
          ? Number(ch.updatedTurn || ch.lastUpdateTurn || ch.turn || turn || 0)
          : Number(ch.deathTurn || ch.deadTurn || ch.updatedTurn || ch.lastUpdateTurn || ch.turn || turn || 0);
        pushPriorityHit(out, q, {
          id: 'hard-char-' + ch.name,
          sourceId: ch.id || '',
          source: 'hard_state',
          char: ch.name,
          turn: sourceTurn,
          text: characterHardStateText(ch, alive),
          status: alive ? 'alive' : 'dead',
          importance: 10,
          relevance: 0.95,
          affects_future: true,
          visibility: 'internal',
          hardStateType: 'character',
          alive: alive
        });
      });
    }

    if (Array.isArray(GM.activeEdicts)) {
      GM.activeEdicts.forEach(function(e, i) {
        if (!e || !isOpenStatus(e.status || 'active')) return;
        var text = [e.name, e.category, e.reason, e.content, e.feedback].filter(Boolean).join(' ');
        pushPriorityHit(out, q, {
          id: e.id || ('active-edict-' + i),
          source: 'activeEdict',
          turn: Number(e.startedTurn || e.turn || turn || 0),
          text: text,
          status: e.status || 'active',
          importance: 9,
          relevance: 0.9,
          affects_future: true,
          visibility: 'internal'
        });
      });
    }

    if (Array.isArray(GM._edictTracker)) {
      GM._edictTracker.forEach(function(e, i) {
        var inForce = !!e && edictInForce(GM, e);
        if (!e || !(inForce || isOpenStatus(e.status))) return;
        var text = [e.content, e.category, e.assignee, e.feedback, e.reason].filter(Boolean).join(' ');
        pushPriorityHit(out, q, {
          id: e.id || ('tracked-edict-' + i),
          source: 'activeEdict',
          turn: Number(e.turn || turn || 0),
          text: text,
          status: inForce ? 'active' : (e.status || 'pending'),
          importance: 9,
          relevance: 0.92,
          affects_future: true,
          visibility: 'internal'
        });
      });
    }

    var tableRows = GM._memTables && GM._memTables.imperialEdict && Array.isArray(GM._memTables.imperialEdict.rows)
      ? GM._memTables.imperialEdict.rows
      : [];
    tableRows.forEach(function(row, i) {
      row = imperialRow(row);
      if (!row || !isOpenStatus(row.status || row.lifecycle || 'active')) return;
      var text = [row.title, row.content, row.text, row.condition, row.notes].filter(Boolean).join(' ');
      if (!text) return;
      pushPriorityHit(out, q, {
        id: row.id || row.key || ('imperial-edict-' + i),
        source: 'imperialEdict',
        turn: Number(row.turn || row.createdTurn || turn || 0),
        text: text,
        status: row.status || row.lifecycle || 'active',
        importance: Number(row.importance || 10),
        relevance: 0.92,
        affects_future: row.affects_future !== false,
        visibility: row.visibility || 'internal'
      });
    });

    if (GM._npcCommitments && typeof GM._npcCommitments === 'object') {
      Object.keys(GM._npcCommitments).forEach(function(npc) {
        var list = GM._npcCommitments[npc];
        if (!Array.isArray(list)) return;
        list.forEach(function(c, i) {
          if (!c || !isOpenStatus(c.status || 'pending')) return;
          var text = [npc, c.task, c.feedback, c.npcPromise, c.deadline].filter(Boolean).join(' ');
          pushPriorityHit(out, q, {
            id: c.id || ('commitment-' + npc + '-' + i),
            source: 'commitment',
            char: npc,
            turn: Number(c.assignedTurn || c.lastUpdateTurn || turn || 0),
            text: text,
            status: c.status || 'pending',
            importance: 8,
            relevance: 0.88,
            affects_future: true,
            visibility: 'internal'
          });
        });
      });
    }

    var sc1q = opts.sc1q || {};
    if (Array.isArray(sc1q.dialogue_commitments)) {
      sc1q.dialogue_commitments.forEach(function(c, i) {
        if (!c || !c.npc) return;
        var text = [c.npc, c.task, c.required_npc_action, c.deadline, c.source_type, c.player_emphasis].filter(Boolean).join(' ');
        pushPriorityHit(out, q, {
          id: c.id || c.source_conv_id || ('sc1q-commitment-' + i),
          source: 'commitment',
          char: c.npc,
          turn: turn || 0,
          text: text,
          status: 'pending',
          importance: 8,
          relevance: 0.9,
          affects_future: true,
          visibility: 'internal'
        });
      });
    }

    out = out.concat(graphExpandHits(GM, out, opts));
    return dedupeHits(out);
  }

  function dimensionWeightOf(hit) {
    hit = hit || {};
    if (hit.affects_future === true || hit.affects_future === 'true') return 1.0;
    if (hit.locked === true || hit.pinned === true) return 0.95;
    if (sourceOf(hit) === 'vector') return 0.7;
    return 0.5;
  }

  function scoreHit(hit, opts) {
    opts = opts || {};
    var parts = {
      relevance: relevanceOf(hit),
      importance: importanceOf(hit),
      recency: recencyOf(hit, opts),
      source: sourcePriorityOf(hit),
      dimension: dimensionWeightOf(hit)
    };
    var score = parts.relevance * 0.35
      + parts.importance * 0.20
      + parts.recency * 0.15
      + parts.source * 0.20
      + parts.dimension * 0.10;
    return {
      score: Math.round(score * 10000) / 10000,
      reason: parts
    };
  }

  function dedupeKey(hit) {
    hit = hit || {};
    var src = sourceOf(hit);
    var id = hit.id || hit.key || hit.uuid || '';
    var type = hit.type || hit.kind || hit.factStatus || '';
    if (id) return src + ':' + String(type || 'event') + ':id:' + String(id);
    return src + ':text:' + textOf(hit).replace(/\s+/g, ' ').trim();
  }

  function dedupeHits(hits, onDuplicate) {
    if (!Array.isArray(hits)) return [];
    var seen = Object.create(null);
    var seenText = Object.create(null);
    var out = [];
    hits.forEach(function(hit) {
      var key = dedupeKey(hit);
      var tkey = sourceOf(hit) + ':' + String(hit.readScope || hit.ownerScope || '') + ':text:' + textOf(hit).replace(/\s+/g, ' ').trim();
      if (!key || seen[key] || (tkey && seenText[tkey])) {
        if (typeof onDuplicate === 'function') onDuplicate(hit);
        return;
      }
      seen[key] = true;
      if (tkey) seenText[tkey] = true;
      out.push(hit);
    });
    return out;
  }

  function normalizeNode(value) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function hitNodes(hit) {
    hit = hit || {};
    var nodes = [
      hit.id,
      hit.key,
      hit.uuid,
      hit.name,
      hit.title,
      hit.edictId,
      hit.sourceId
    ];
    var type = String(hit.type || hit.kind || '').trim();
    var factStatus = String(hit.factStatus || '').trim();
    var rawId = String(hit.id || hit.key || hit.uuid || hit.sourceId || '').trim();
    if (type && rawId) nodes.push(type + ':' + rawId);
    if (factStatus && rawId) nodes.push(factStatus + ':' + rawId);
    var text = textOf(hit);
    if (text) nodes.push(text.slice(0, 120));
    arr(hit.sourceRefs).forEach(function(ref) {
      if (!ref) return;
      if (ref.type && ref.id) nodes.push(String(ref.type) + ':' + String(ref.id));
      if (ref.id) nodes.push(ref.id);
    });
    return nodes.map(normalizeNode).filter(Boolean);
  }

  function _nodesMatchTarget(nodes, node) {
    var target = normalizeNode(node);
    if (!target) return false;
    return arr(nodes).some(function(n) {
      return n === target || (target.length >= 4 && n.indexOf(target) >= 0);
    });
  }

  function hitMatchesNode(hit, node) {
    return _nodesMatchTarget(hitNodes(hit), node);
  }

  function _collectRelationEdges(GM) {
    var edges = [];
    if (!GM) return edges;
    if (Array.isArray(GM._memEdges)) {
      GM._memEdges.forEach(function(e) {
        if (!e) return;
        edges.push({ src: e.src, dst: e.dst, type: e.type, reason: e.reason, turn: e.turn });
      });
    }
    if (Array.isArray(GM._edictRelations)) {
      GM._edictRelations.forEach(function(e) {
        if (!e) return;
        edges.push({ src: e.from || e.src, dst: e.to || e.dst, type: e.type, reason: e.reason, turn: e.turn });
      });
    }
    return edges;
  }

  function _edgeSignature(GM) {
    return [
      _memoryRevision(GM, 'edges'),
      arr(GM && GM._memEdges).length,
      arr(GM && GM._edictRelations).length
    ].join(':');
  }

  function _relationIndex(GM) {
    if (!GM || typeof GM !== 'object') return { relationEdges: [], signature: 'none' };
    var entry = _worldIndexEntry(GM);
    var signature = _edgeSignature(GM);
    if (entry.relation && entry.relation.signature === signature) return entry.relation;
    entry.relation = _perfSpan('memory.edgeIndex', function() {
      _perfCount('memory.edgeTableBuilds', 1);
      return {
        campaignId: String(GM._campaignId || GM.campaignId || GM._runId || ''),
        timelineId: String(GM._timelineId || GM.timelineId || ''),
        turn: Number(GM.turn || 0),
        memoryRevision: _memoryRevision(GM, 'memory'),
        edgeRevision: _memoryRevision(GM, 'edges'),
        signature: signature,
        relationEdges: _collectRelationEdges(GM)
      };
    }, { edgeRevision: _memoryRevision(GM, 'edges') });
    return entry.relation;
  }

  function allRelationEdges(GM) {
    return _relationIndex(GM).relationEdges;
  }

  function _eligibleSourcesByThreshold(matches, destinations) {
    var thresholds = {};
    destinations.forEach(function(row) {
      thresholds[String(row.priority)] = { threshold: row.priority, first: null, second: null };
    });
    Object.keys(thresholds).forEach(function(key) {
      var bucket = thresholds[key];
      for (var i = 0; i < matches.length; i++) {
        _perfCount('memory.edgeCandidateChecks', 1);
        if (matches[i].priority < bucket.threshold) continue;
        if (!bucket.first) bucket.first = matches[i];
        else {
          bucket.second = matches[i];
          break;
        }
      }
    });
    return thresholds;
  }

  function _buildHitRelationIndex(hits, opts) {
    opts = opts || {};
    var worldEntry = opts.GM ? _worldIndexEntry(opts.GM) : null;
    if (worldEntry && !worldEntry.nodeCache && typeof WeakMap === 'function') worldEntry.nodeCache = new WeakMap();
    var nodeRevision = [
      _memoryRevision(opts.GM, 'memory'),
      _memoryRevision(opts.GM, 'edges'),
      Number(opts.turn || (opts.GM && opts.GM.turn) || 0)
    ].join(':');
    var rows = arr(hits).map(function(hit, index) {
      var signature = [
        nodeRevision,
        hit && hit.id,
        hit && hit.key,
        hit && hit.uuid,
        hit && hit.name,
        hit && hit.title,
        hit && hit.edictId,
        hit && hit.sourceId,
        hit && hit.type,
        hit && hit.kind,
        hit && hit.factStatus,
        textOf(hit).slice(0, 120),
        arr(hit && hit.sourceRefs).length
      ].join('|');
      var cachedNodes = worldEntry && worldEntry.nodeCache && hit && typeof hit === 'object'
        ? worldEntry.nodeCache.get(hit)
        : null;
      var nodes;
      if (cachedNodes && cachedNodes.signature === signature) {
        nodes = cachedNodes.nodes;
      } else {
        _perfCount('memory.hitNodeBuilds', 1);
        nodes = hitNodes(hit);
        if (worldEntry && worldEntry.nodeCache && hit && typeof hit === 'object') {
          worldEntry.nodeCache.set(hit, { signature: signature, nodes: nodes });
        }
      }
      return {
        hit: hit,
        index: index,
        nodes: nodes,
        priority: sourcePriorityOf(hit)
      };
    });
    var relation = _relationIndex(opts.GM);
    var hitsById = Object.create(null);
    var hitsByNode = Object.create(null);
    var rowsByNode = Object.create(null);
    var rowsByGram = Object.create(null);
    rows.forEach(function(row) {
      var hitId = String(row.hit && (row.hit.id || row.hit.key || row.hit.uuid || row.hit.sourceId) || ('hit-' + row.index));
      hitsById[hitId] = row.hit;
      row.nodes.forEach(function(node) {
        if (!hitsByNode[node]) hitsByNode[node] = [];
        hitsByNode[node].push(row.hit);
        if (!rowsByNode[node]) rowsByNode[node] = [];
        rowsByNode[node].push(row);
      });
    });
    // Only unresolved legacy/fuzzy targets need a substring index. Stable
    // exact edges use rowsByNode and allocate no gram buckets at all.
    var fuzzyTargets = Object.create(null);
    relation.relationEdges.forEach(function(edge) {
      if (!edge) return;
      var type = String(edge.type || '').toLowerCase();
      if (type !== 'supersedes' && type !== 'contradicts') return;
      [edge.dst].concat(type === 'contradicts' ? [edge.src] : []).forEach(function(value) {
        var target = normalizeNode(value);
        if (target.length >= 4 && !rowsByNode[target]) fuzzyTargets[target] = true;
      });
    });
    var wantedGrams = Object.create(null);
    Object.keys(fuzzyTargets).forEach(function(target) {
      for (var at = 0; at <= target.length - 4; at++) wantedGrams[target.slice(at, at + 4)] = true;
    });
    if (Object.keys(wantedGrams).length) {
      rows.forEach(function(row) {
        var rowGrams = Object.create(null);
        row.nodes.forEach(function(node) {
          if (node.length < 4) return;
          for (var at = 0; at <= node.length - 4; at++) {
            var gram = node.slice(at, at + 4);
            if (!wantedGrams[gram] || rowGrams[gram]) continue;
            rowGrams[gram] = true;
            if (!rowsByGram[gram]) rowsByGram[gram] = [];
            rowsByGram[gram].push(row);
          }
        });
      });
    }
    function rowsMatchingTarget(targetValue) {
      var target = normalizeNode(targetValue);
      if (!target) return [];
      var candidates = [];
      var seenRows = Object.create(null);
      function addCandidates(list) {
        arr(list).forEach(function(row) {
          if (!row || seenRows[row.index]) return;
          seenRows[row.index] = true;
          candidates.push(row);
        });
      }
      addCandidates(rowsByNode[target]);
      // Stable/exact node identities are authoritative. Substring matching is
      // only a compatibility fallback for legacy fuzzy relations that have no
      // exact destination in the current hit set.
      if (!candidates.length && target.length >= 4) {
        var smallestBucket = null;
        for (var gramAt = 0; gramAt <= target.length - 4; gramAt++) {
          var bucket = rowsByGram[target.slice(gramAt, gramAt + 4)];
          if (bucket && (!smallestBucket || bucket.length < smallestBucket.length)) smallestBucket = bucket;
        }
        addCandidates(smallestBucket);
      }
      candidates.sort(function(left, right) { return left.index - right.index; });
      return candidates.filter(function(row) {
        _perfCount('memory.edgeCandidateChecks', 1);
        return _nodesMatchTarget(row.nodes, target);
      });
    }
    var supersededByHit = [];
    var contradictionByHit = [];
    relation.relationEdges.forEach(function(edge) {
      if (!edge) return;
      var type = String(edge.type || '').toLowerCase();
      if (type !== 'supersedes' && type !== 'contradicts') return;
      var destinations = rowsMatchingTarget(edge.dst);
      var sources = type === 'contradicts' ? rowsMatchingTarget(edge.src) : [];
      if (type === 'supersedes') {
        destinations.forEach(function(row) {
          if (!supersededByHit[row.index]) supersededByHit[row.index] = edge;
        });
        return;
      }
      var eligibleByThreshold = _eligibleSourcesByThreshold(sources, destinations);
      destinations.forEach(function(row) {
        if (contradictionByHit[row.index]) return;
        var eligible = eligibleByThreshold[String(row.priority)] || {};
        var source = eligible.first && eligible.first.hit !== row.hit
          ? eligible.first
          : eligible.second;
        if (source) contradictionByHit[row.index] = { edge: edge, sourceHit: source.hit };
      });
    });
    return {
      campaignId: relation.campaignId,
      timelineId: relation.timelineId,
      turn: Number(opts.turn || relation.turn || 0),
      memoryRevision: relation.memoryRevision,
      edgeRevision: relation.edgeRevision,
      envelopes: arr(opts.envelopes),
      hitsById: hitsById,
      normalizedNodesByHitId: rows,
      hitsByNode: hitsByNode,
      supersededByDestination: supersededByHit,
      contradictionsByDestination: contradictionByHit,
      relationEdges: relation.relationEdges
    };
  }

  function supersededEdgeForHit(hit, opts) {
    opts = opts || {};
    if (!hit || !opts.GM) return null;
    var edges = allRelationEdges(opts.GM).filter(function(e) {
      return e && e.type === 'supersedes' && e.dst != null;
    });
    if (!edges.length) return null;
    var nodes = hitNodes(hit);
    for (var i = 0; i < edges.length; i++) {
      var dst = normalizeNode(edges[i].dst);
      if (!dst) continue;
      var matched = nodes.some(function(n) {
        return n === dst || (dst.length >= 4 && n.indexOf(dst) >= 0);
      });
      if (matched) return edges[i];
    }
    return null;
  }

  function contradictionEdgeForHit(hit, candidates, opts) {
    opts = opts || {};
    if (!hit || !opts.GM || !Array.isArray(candidates)) return null;
    var edges = allRelationEdges(opts.GM).filter(function(e) {
      return e && e.type === 'contradicts' && e.src != null && e.dst != null;
    });
    if (!edges.length) return null;
    for (var i = 0; i < edges.length; i++) {
      var edge = edges[i];
      if (!hitMatchesNode(hit, edge.dst)) continue;
      for (var j = 0; j < candidates.length; j++) {
        var sourceHit = candidates[j];
        if (sourceHit === hit) continue;
        if (!hitMatchesNode(sourceHit, edge.src)) continue;
        if (sourcePriorityOf(sourceHit) >= sourcePriorityOf(hit)) {
          return { edge: edge, sourceHit: sourceHit };
        }
      }
    }
    return null;
  }

  function cloneHit(hit) {
    var out = {};
    hit = hit || {};
    Object.keys(hit).forEach(function(k) { out[k] = hit[k]; });
    return out;
  }

  function scoreAndSortHits(hits, opts) {
    opts = opts || {};
    return hits.map(function(hit) {
      var out = cloneHit(hit);
      var scored = scoreHit(out, opts);
      out._score = scored.score;
      out._reason = scored.reason;
      out.visibility = visibilityOf(out);
      return out;
    }).sort(function(a, b) {
      return (b._score || 0) - (a._score || 0);
    });
  }

  function rankHitsDetailed(hits, opts) {
    return _perfSpan('memory.rank', function() {
      opts = opts || {};
      var input = Array.isArray(hits) ? hits : [];
      var suppressed = [];
      var visible = [];
      input.forEach(function(rawHit) {
        var hit = applyMemoryControls(rawHit, opts);
        var reason = suppressionReason(hit, opts);
        if (reason) suppressed.push(compactSuppressed(hit, reason));
        else visible.push(hit);
      });
      var deduped = dedupeHits(visible, function(hit) { suppressed.push(compactSuppressed(hit, 'duplicate_memory_fact')); });
      var relationIndex = _buildHitRelationIndex(deduped, opts);
      var kept = [];
      deduped.forEach(function(hit, index) {
        var edge = relationIndex.supersededByDestination[index] || null;
        if (edge) {
          if (opts.includeSuperseded === true) {
            var stale = cloneHit(hit);
            stale.staleStatus = 'superseded';
            stale.supersededBy = edge.src;
            stale.edgeReason = edge.reason || '';
            kept.push(stale);
          } else {
            suppressed.push(compactSuppressed(hit, 'superseded', {
              by: edge.src,
              edgeReason: edge.reason
            }));
          }
        } else {
          var conflict = relationIndex.contradictionsByDestination[index] || null;
          if (conflict) {
            suppressed.push(compactSuppressed(hit, 'contradicted', {
              by: conflict.edge.src,
              edgeReason: conflict.edge.reason
            }));
          } else {
            kept.push(hit);
          }
        }
      });
      return {
        inputCount: input.length,
        ranked: scoreAndSortHits(kept, opts),
        suppressed: suppressed,
        compilationIndex: relationIndex
      };
    }, { turn: opts && opts.turn });
  }

  function rankHits(hits, opts) {
    return rankHitsDetailed(hits, opts).ranked;
  }

  function estimateInjectionTokens(hit, opts) {
    opts = opts || {};
    var maxChars = Number(opts.perHitMaxChars || 100);
    var text = textOf(hit).slice(0, Math.max(1, maxChars));
    var cjk = (text.match(/[\u3400-\u9fff]/g) || []).length;
    var other = Math.max(0, text.length - cjk);
    return Math.max(1, Math.ceil(cjk * 0.75 + other / 4 + 18));
  }

  function isPriorityHit(hit) {
    var src = sourceOf(hit);
    return src === 'hard_state' || src === 'imperialEdict' || src === 'activeEdict' || src === 'commitment' || hit.pinned === true || hit.affects_future === true;
  }

  function isEdictHit(hit) {
    var src = sourceOf(hit);
    return src === 'imperialEdict' || src === 'activeEdict' || hit.pinned === true;
  }

  function budgetRank(item) {
    var hit = item && item.hit || {};
    var src = sourceOf(hit);
    var lane = src === 'hard_state' ? 100 : (isEdictHit(hit) ? 90 : (src === 'commitment' ? 80 : (hit.affects_future === true || hit.affects_future === 'true' ? 70 : 0)));
    var score = typeof hit._score === 'number' ? hit._score : (typeof hit.score === 'number' ? hit.score : (typeof hit.sim === 'number' ? hit.sim : 0));
    return lane + score;
  }

  function sortBudgetItems(a, b) {
    var d = budgetRank(b) - budgetRank(a);
    if (d) return d;
    return (a.groupIndex - b.groupIndex) || (a.hitIndex - b.hitIndex);
  }

  function packForInjection(recallResults, opts) {
    opts = opts || {};
    var hasBudget = opts.maxTokens != null && opts.maxTokens !== '';
    var numericBudget = Number(opts.maxTokens);
    var maxTokens = hasBudget ? (Number.isFinite(numericBudget) && numericBudget >= 0 ? Math.floor(numericBudget) : 8192) : 0;
    var groups = Array.isArray(recallResults) ? recallResults : [];
    var flat = [];
    groups.forEach(function(group, gi) {
      (group && Array.isArray(group.hits) ? group.hits : []).forEach(function(hit, hi) {
        flat.push({
          groupIndex: gi,
          hitIndex: hi,
          hit: hit,
          cost: estimateInjectionTokens(hit, opts),
          priority: isPriorityHit(hit) ? 1 : 0
        });
      });
    });

    var used = 0;
    var selected = {};
    var rejected = {};
    var suppressed = [];
    var diagnostics = {
      guaranteed: 0,
      fair: 0,
      filled: 0,
      dropped: 0,
      kept: [],
      suppressed: []
    };

    var seenRecallIds = Object.create(null), seenRecallFacts = Object.create(null);
    var recallPolicy = {};
    Object.keys(opts).forEach(function(k) { recallPolicy[k] = opts[k]; });
    recallPolicy.intent = opts.intent || 'historical_evidence';
    diagnostics.duplicates = 0;
    function duplicateAuthority(item) {
      var h = item.hit || {}, registry = root.TM && root.TM.MemoryEvidenceRegistry;
      var rank = h.authorityRank != null ? Number(h.authorityRank) : (registry && registry.getAuthorityRank ? registry.getAuthorityRank(h.authority) : 0);
      return Number.isFinite(rank) ? rank : 0;
    }
    flat = flat.slice().sort(function(a, b) { return duplicateAuthority(b) - duplicateAuthority(a) || sortBudgetItems(a, b); }).filter(function(item) {
      var hit = item.hit || {};
      var reason = suppressionReason(hit, recallPolicy);
      var scope = [hit.worldId, hit.saveId, hit.timelineId, hit.readScope, hit.ownerScope].join('|');
      var id = hit.id || hit.key || hit.uuid;
      var idKey = id ? scope + '|id:' + String(id) : '';
      var factKey = scope + '|' + sourceOf(hit) + '|' + textOf(hit).replace(/\s+/g, ' ').trim();
      if (!reason && ((idKey && seenRecallIds[idKey]) || seenRecallFacts[factKey])) reason = 'duplicate_memory_fact';
      if (reason) {
        var omitted = compactSuppressed(hit, reason, { budgetStage: 'dedupe', cost: item.cost });
        suppressed.push(omitted); diagnostics.suppressed.push(omitted); diagnostics.dropped++;
        if (reason === 'duplicate_memory_fact') diagnostics.duplicates++;
        return false;
      }
      if (idKey) seenRecallIds[idKey] = true;
      seenRecallFacts[factKey] = true;
      return true;
    }).sort(function(a, b) { return a.groupIndex - b.groupIndex || a.hitIndex - b.hitIndex; });

    function itemKey(item) {
      return item.groupIndex + ':' + item.hitIndex;
    }

    function recordKept(item, stage) {
      var hit = item.hit || {};
      diagnostics.kept.push({
        id: String(hit.id || hit.key || ''),
        source: sourceOf(hit),
        stage: String(stage || 'fill'),
        cost: Number(item.cost || 0),
        groupIndex: item.groupIndex,
        hitIndex: item.hitIndex
      });
      if (String(stage || '').indexOf('guarantee:') === 0) diagnostics.guaranteed++;
      else if (stage === 'fair_query') diagnostics.fair++;
      else diagnostics.filled++;
    }

    function recordSuppressed(item, stage) {
      var key = itemKey(item);
      if (rejected[key] || selected[key]) return;
      rejected[key] = true;
      var compact = compactSuppressed(item.hit, 'budget_exceeded', {
        budgetStage: stage || 'fill',
        cost: item.cost
      });
      suppressed.push(compact);
      diagnostics.suppressed.push({
        id: compact.id,
        source: compact.source,
        reason: compact.reason,
        stage: compact.budgetStage || String(stage || 'fill'),
        cost: Number(item.cost || 0),
        groupIndex: item.groupIndex,
        hitIndex: item.hitIndex
      });
      diagnostics.dropped++;
    }

    function trySelect(item, stage) {
      if (!item) return false;
      var key = itemKey(item);
      if (selected[key] || rejected[key]) return false;
      var canFit = !hasBudget || (used + item.cost <= maxTokens);
      if (canFit) {
        used += item.cost;
        selected[key] = true;
        recordKept(item, stage);
        return true;
      }
      recordSuppressed(item, stage);
      return false;
    }

    function selectSorted(items, stage) {
      items.slice().sort(sortBudgetItems).forEach(function(item) {
        trySelect(item, stage);
      });
    }

    selectSorted(flat.filter(function(item) { return sourceOf(item.hit) === 'hard_state'; }), 'guarantee:hard_state');
    selectSorted(flat.filter(function(item) { return sourceOf(item.hit) === 'commitment'; }), 'guarantee:commitment');

    var edictByGroup = {};
    flat.filter(function(item) { return isEdictHit(item.hit); }).forEach(function(item) {
      var cur = edictByGroup[item.groupIndex];
      if (!cur || sortBudgetItems(item, cur) < 0) edictByGroup[item.groupIndex] = item;
    });
    selectSorted(Object.keys(edictByGroup).map(function(k) { return edictByGroup[k]; }), 'guarantee:edict');

    groups.forEach(function(_group, gi) {
      var groupHasSelection = Object.keys(selected).some(function(key) {
        return key.indexOf(gi + ':') === 0;
      });
      if (groupHasSelection) return;
      var best = flat.filter(function(item) {
        return item.groupIndex === gi && !selected[itemKey(item)] && !rejected[itemKey(item)];
      }).sort(sortBudgetItems)[0];
      trySelect(best, 'fair_query');
    });

    flat.slice().sort(sortBudgetItems).forEach(function(item) {
      if (selected[itemKey(item)] || rejected[itemKey(item)]) return;
      trySelect(item, 'fill');
    });

    flat.forEach(function(item) {
      if (!selected[itemKey(item)] && !rejected[itemKey(item)]) {
        recordSuppressed(item, 'fill');
      }
    });

    var packedGroups = groups.map(function(group, gi) {
      var out = {};
      group = group || {};
      Object.keys(group).forEach(function(k) {
        if (k !== 'hits') out[k] = group[k];
      });
      out.hits = (Array.isArray(group.hits) ? group.hits : []).filter(function(_hit, hi) {
        return !!selected[gi + ':' + hi];
      });
      return out;
    }).filter(function(group) {
      return group && Array.isArray(group.hits) && group.hits.length > 0;
    });

    return {
      recallResults: packedGroups,
      suppressed: suppressed,
      tokenEstimate: used,
      maxTokens: maxTokens || 0,
      diagnostics: diagnostics
    };
  }

  // —— 本回合焦点感知 relevance（Generative Agents 三因子之 relevance·纯文本/实体匹配·BYOK 友好）——
  // 收集"焦点实体"：出现在 活法令 / 玩家近期决策 / 当前议题 / sc1q 对话 文本里的 NPC/势力名。
  function turnFocusTerms(GM, opts) {
    opts = opts || {};
    if (!GM) return [];
    var text = ' ' + recentPlayerDecisionText(GM);
    activeEdictTexts(GM).forEach(function(t) { text += ' ' + t; });
    if (Array.isArray(GM.currentIssues)) {
      GM.currentIssues.slice(-12).forEach(function(iss) {
        if (iss) text += ' ' + [iss.title, iss.description].filter(Boolean).join(' ');
      });
    }
    var sc1q = opts.sc1q || {};
    if (Array.isArray(sc1q.dialogue_commitments)) {
      sc1q.dialogue_commitments.forEach(function(c) {
        if (c) text += ' ' + [c.npc, c.task, c.required_npc_action].filter(Boolean).join(' ');
      });
    }
    var hay = String(text).toLowerCase();
    var terms = {};
    function addNames(list) {
      arr(list).forEach(function(e) {
        var n = cleanTerm(e && e.name, 40);
        if (n && n.length >= 2 && hay.indexOf(n.toLowerCase()) >= 0) terms[n.toLowerCase()] = true;
      });
    }
    addNames(GM.chars);
    addNames(GM.facs);
    return Object.keys(terms).slice(0, 24);
  }

  // 对命中本回合焦点实体的记忆做 relevance 加成（不惩罚未命中·只抬升相关项·令预算受限时优先注入与当下相关的记忆）。
  function applyFocusRelevance(hits, focusTerms) {
    if (!Array.isArray(hits) || !Array.isArray(focusTerms) || !focusTerms.length) return hits;
    hits.forEach(function(hit) {
      if (!hit) return;
      var entHay = (textOf(hit) + ' ' + String(hit.char || '')).toLowerCase();
      var matches = 0;
      for (var i = 0; i < focusTerms.length && matches < 3; i++) {
        if (entHay.indexOf(focusTerms[i]) >= 0) matches++;
      }
      if (matches > 0) {
        var base = (typeof hit.relevance === 'number' && isFinite(hit.relevance)) ? hit.relevance : 0.75;
        hit.relevance = Math.max(0, Math.min(1, base + 0.12 * matches));
        hit._focusMatches = matches;
      }
    });
    return hits;
  }

  ns.SOURCE_PRIORITY = SOURCE_PRIORITY;
  ns.visibilityOf = visibilityOf;
  ns.isVisible = isVisible;
  ns.filterVisibleHits = filterVisibleHits;
  ns.memoryControlKey = memoryControlKey;
  ns.memoryControlForHit = memoryControlForHit;
  ns.dedupeHits = dedupeHits;
  ns.buildRecallQueries = buildRecallQueries;
  ns.collectPriorityHits = collectPriorityHits;
  ns.envelopeSource = envelopeSource;
  ns.hitFromEnvelope = hitFromEnvelope;
  ns.scoreHit = scoreHit;
  ns.rankHitsDetailed = rankHitsDetailed;
  ns.rankHits = rankHits;
  ns.bumpRevision = bumpMemoryRevision;
  ns.invalidateCompilationIndex = invalidateCompilationIndex;
  ns.relationIndex = _relationIndex;
  ns.buildCompilationIndex = _buildHitRelationIndex;
  ns.packForInjection = packForInjection;
  ns.turnFocusTerms = turnFocusTerms;
  ns.applyFocusRelevance = applyFocusRelevance;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
