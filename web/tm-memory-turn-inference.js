(function(global) {
  'use strict';

  var root = global || (typeof window !== 'undefined' ? window : {});
  root.TM = root.TM || {};
  var ns = root.TM.MemoryTurnInference = root.TM.MemoryTurnInference || {};

  function arr(value) {
    return Array.isArray(value) ? value : [];
  }

  function clean(value, maxLen) {
    var s = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
    return maxLen ? s.slice(0, maxLen) : s;
  }

  function canonicalCharName(value) {
    var s = clean(value, 120);
    if (!s) return '';
    try {
      if (root && typeof root.canonicalizeCharName === 'function') return clean(root.canonicalizeCharName(s) || s, 120);
      if (typeof canonicalizeCharName === 'function') return clean(canonicalizeCharName(s) || s, 120);
    } catch (_) {}
    return s;
  }

  function canonicalNameList(list) {
    var out = [];
    arr(list).forEach(function(value) {
      var n = canonicalCharName(value);
      if (n && out.indexOf(n) < 0) out.push(n);
    });
    return out;
  }

  function stableSlug(value, maxLen) {
    var s = clean(value, maxLen || 120).toLowerCase()
      .replace(/[^\w\u3400-\u9fff]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return s || 'unknown';
  }

  function stableBodyKey(value, maxLen) {
    return stableSlug(clean(value, 260), maxLen || 80);
  }

  function explicitFactKey(item) {
    item = item || {};
    var extra = item.extra || {};
    return clean(item.factKey || item.fact_key || item.stableKey || item.stable_key || item.memoryKey || item.memory_key || extra.factKey || extra.stableKey, 180);
  }

  function normalizeGovernanceRef(ref, fallbackType) {
    if (!ref) return null;
    if (typeof ref === 'string') return { type: fallbackType || 'accepted_memory', id: clean(ref, 160) };
    var id = clean(ref.id || ref.key || ref.uuid || ref.sourceId || ref.memoryId, 160);
    if (!id) return null;
    var out = {
      type: clean(ref.type || ref.kind || fallbackType || 'accepted_memory', 80),
      id: id
    };
    if (ref.turn != null) out.turn = Number(ref.turn || 0);
    if (ref.reason) out.reason = clean(ref.reason, 160);
    return out;
  }

  function governanceRefsFromItem(item, names, fallbackType) {
    item = item || {};
    var refs = [];
    names.forEach(function(name) {
      var value = item[name];
      if (Array.isArray(value)) refs = refs.concat(value);
      else if (value != null) refs.push(value);
    });
    return refs.map(function(ref) {
      return normalizeGovernanceRef(ref, fallbackType || 'accepted_memory');
    }).filter(Boolean);
  }

  function mergeGovernanceRefs() {
    var seen = {};
    var out = [];
    for (var i = 0; i < arguments.length; i++) {
      arr(arguments[i]).forEach(function(ref) {
        ref = normalizeGovernanceRef(ref, 'accepted_memory');
        if (!ref) return;
        var key = clean(ref.type, 80) + ':' + clean(ref.id, 160);
        if (seen[key]) return;
        seen[key] = true;
        out.push(ref);
      });
    }
    return out;
  }

  function acceptedFactKey(item) {
    item = item || {};
    var extra = item.extra || {};
    return clean(item.factKey || item.fact_key || item.stableKey || item.stable_key || extra.factKey || extra.stableKey, 180).toLowerCase();
  }

  function acceptedRefsByFactKey(GM, factKey, opts) {
    opts = opts || {};
    var key = clean(factKey, 180).toLowerCase();
    if (!GM || !key) return [];
    return arr(GM._memoryAccepted).filter(function(item) {
      if (!item || !item.id) return false;
      if (opts.excludeId && item.id === opts.excludeId) return false;
      var status = clean(item.status || 'active', 40).toLowerCase();
      return status === 'active' && acceptedFactKey(item) === key;
    }).map(function(item) {
      return {
        type: 'accepted_memory',
        id: item.id,
        turn: Number(item.acceptedAtTurn || item.reviewedAtTurn || item.turn || 0)
      };
    }).slice(-6);
  }

  function scopeForActor(actor) {
    actor = canonicalCharName(actor);
    if (!actor) return '';
    return /^npc:/i.test(actor) ? actor : ('npc:' + actor);
  }

  function sourceRef(type, id, body, turn) {
    var ME = root.TM && root.TM.MemoryEnvelope;
    if (ME && typeof ME.sourceRef === 'function') {
      return ME.sourceRef(type, id, body, { turn: turn });
    }
    return { type: type, id: id, turn: Number(turn || 0) };
  }

  function compactRefKey(ref) {
    ref = ref || {};
    return clean(ref.type, 80) + ':' + clean(ref.id, 160);
  }

  function mergeRefs() {
    var seen = {};
    var out = [];
    for (var i = 0; i < arguments.length; i++) {
      arr(arguments[i]).forEach(function(ref) {
        if (!ref || (!ref.type && !ref.id)) return;
        var key = compactRefKey(ref);
        if (seen[key]) return;
        seen[key] = true;
        out.push(ref);
      });
    }
    return out;
  }

  function traceReadContextRefs(GM, opts) {
    opts = opts || {};
    if (Array.isArray(opts.readContextRefs) && opts.readContextRefs.length) return opts.readContextRefs.slice(0, 12);
    var trace = GM && GM._turnAiResults && GM._turnAiResults.memoryTrace;
    var refs = [];
    arr(trace && trace.compiledContexts).forEach(function(ctx) {
      if (!ctx || ctx.id !== 'SC1_PRE_CONTEXT') return;
      refs.push({
        type: 'memoryTrace.compiledContext',
        id: ctx.id,
        turn: Number((GM && GM.turn) || ctx.turn || opts.turn || 0),
        hash: ctx.textHash || '',
        role: 'read_context'
      });
    });
    return refs.slice(-3);
  }

  function memoryText(item) {
    return clean(item && (item.memory || item.text || item.summary || item.body || item.content), 500);
  }

  function clamp01(value) {
    value = Number(value);
    if (!isFinite(value)) return null;
    return Math.max(0, Math.min(1, value));
  }

  function refsFromItem(item, primaryNames) {
    item = item || {};
    var out = [];
    primaryNames.forEach(function(name) {
      out = out.concat(arr(item[name]));
    });
    return out.filter(function(ref) {
      return ref && (ref.type || ref.id);
    });
  }

  function normalizeMemoryType(item) {
    var raw = clean(item && (item.memory_type || item.memoryType || item.kind || item.type), 60).toLowerCase();
    if (!raw || raw === 'character_memory' || raw === 'character_belief') return raw || 'memory';
    if (raw === 'commit' || raw === 'promise') return 'commitment';
    if (raw === 'relation') return 'relationship';
    return raw;
  }

  function evaluateCharacterMemoryUpdate(item, opts) {
    opts = opts || {};
    item = item || {};
    var actor = canonicalCharName(item.actor || item.char || item.name || item.character || item.ownerId);
    var body = memoryText(item);
    var confidence = clamp01(item.confidence);
    var explicitRefs = refsFromItem(item, ['source_refs', 'sourceRefs', 'basis_refs', 'basisRefs', 'evidenceRefs']);
    var reasons = [];
    if (!actor) reasons.push({ code: 'missing_actor', message: 'character memory has no actor' });
    if (!body) reasons.push({ code: 'missing_body', message: 'character memory has no body' });
    if (body && body.length < Number(opts.minBodyChars || 10)) reasons.push({ code: 'too_short', message: 'character memory is too short to review safely' });
    if (confidence == null) reasons.push({ code: 'missing_confidence', message: 'character memory has no confidence' });
    else if (confidence < Number(opts.minConfidence || 0.55)) reasons.push({ code: 'low_confidence', message: 'character memory confidence below review threshold' });
    if (!explicitRefs.length) reasons.push({ code: 'missing_source_refs', message: 'character memory has no explicit source refs' });
    return {
      actor: actor,
      body: body,
      confidence: confidence,
      memoryType: normalizeMemoryType(item),
      sourceRefs: refsFromItem(item, ['source_refs', 'sourceRefs']),
      basisRefs: refsFromItem(item, ['basis_refs', 'basisRefs', 'evidenceRefs']),
      reasons: reasons,
      qualityStatus: reasons.length ? 'quarantined' : 'draftable'
    };
  }

  function characterMemoryCandidates(GM, aiResult, opts) {
    opts = opts || {};
    var turn = Number((GM && GM.turn) || opts.turn || 0);
    var readRefs = traceReadContextRefs(GM, opts);
    var out = [];
    var updates = []
      .concat(arr(aiResult && aiResult.character_memory_updates))
      .concat(arr(aiResult && aiResult.character_memories))
      .concat(arr(aiResult && aiResult.memory_updates));

    updates.forEach(function(item, i) {
      if (!item) return;
      var quality = evaluateCharacterMemoryUpdate(item, opts);
      var actor = quality.actor;
      var body = quality.body;
      if (!actor || !body) return;
      var ownerScope = clean(item.ownerScope, 120) || scopeForActor(actor);
      var isPrivate = item.private === true || item.visibility === 'private' ||
        (item.readScope && clean(item.readScope, 120) !== 'public') || quality.memoryType === 'belief' || quality.memoryType === 'character_belief';
      var readScope = clean(item.readScope, 120) || (isPrivate ? ownerScope : 'public');
      var sourceId = clean(item.sourceId || opts.sourceId || ('turn-' + turn), 120);
      var sourceType = clean(item.sourceType || opts.sourceType || 'aiTurnResult', 80);
      var aiRef = sourceRef(sourceType, sourceId, body, turn);
      var sourceRefs = mergeRefs(quality.sourceRefs, [aiRef]);
      var factKey = explicitFactKey(item) || ('character:' + stableSlug(actor, 80) + ':' + stableSlug(quality.memoryType || 'memory', 40) + ':' + stableBodyKey(body, 90));
      var supersedesRefs = governanceRefsFromItem(item, ['supersedes_refs', 'supersedesRefs', 'supersedes', 'supersededRefs', 'replaces_id', 'replacesId', 'replaces'], 'accepted_memory');
      var contradictsRefs = governanceRefsFromItem(item, ['contradicts_refs', 'contradictsRefs', 'contradicts', 'conflicts_with_refs', 'conflictsWithRefs', 'conflicts_with', 'conflictsWith'], 'accepted_memory');

      var candidate = {
        id: clean(item.id, 120) || ('char-memory-' + turn + '-' + i + '-' + clean(actor, 40).replace(/[^a-zA-Z0-9_-]+/g, '-')),
        type: isPrivate ? 'character_belief' : 'character_memory',
        factKey: factKey,
        body: body,
        safeBody: body,
        authority: 'ai_extracted',
        source: 'ai_extracted',
        turn: turn,
        entities: [actor].concat(canonicalNameList(item.entities)),
        ownerScope: ownerScope,
        readScope: readScope,
        sourceRefs: sourceRefs,
        basisRefs: mergeRefs(quality.basisRefs, readRefs),
        lane: 'L6_retrieved_evidence',
        reason: 'turn-inference:character-memory:' + quality.memoryType,
        extra: {
          private: isPrivate,
          actor: actor,
          confidence: quality.confidence,
          memoryType: quality.memoryType,
          qualityStatus: quality.qualityStatus
        }
      };
      if (supersedesRefs.length) candidate.supersedesRefs = supersedesRefs;
      if (contradictsRefs.length) candidate.contradictsRefs = contradictsRefs;
      if (quality.reasons.length) {
        candidate.status = 'quarantined';
        candidate.reviewStatus = 'quarantined';
        candidate.reasons = quality.reasons;
      }
      out.push(candidate);
    });

    return out;
  }

  function chronicleBody(aiResult) {
    aiResult = aiResult || {};
    return clean([
      aiResult.turn_summary || aiResult.turnSummary || aiResult.summary,
      aiResult.shizhengji_basis,
      aiResult.szj_summary || aiResult.shizhengji_summary,
      aiResult.shizhengji || aiResult.szj
    ].filter(Boolean).join(' '), 900);
  }

  // —— S3（2026-06-03·DELETE/forget）：AI 吐 memory_forgets 标某事实作废(恩怨已了/承诺已兑现/事实更正)。
  // 候选走 draft 人审(type 非 character_memory → autoAccept lane 不收)，接受后由 writegate 把目标翻 tombstone。
  function forgetCandidates(GM, aiResult, opts) {
    opts = opts || {};
    var turn = Number((GM && GM.turn) || opts.turn || 0);
    var readRefs = traceReadContextRefs(GM, opts);
    var out = [];
    var forgets = []
      .concat(arr(aiResult && aiResult.memory_forgets))
      .concat(arr(aiResult && aiResult.forgets))
      .concat(arr(aiResult && aiResult.memory_invalidations));
    forgets.forEach(function(item, i) {
      if (!item) return;
      var targetId = clean(item.target_id || item.targetId || item.id, 160);
      var targetFactKey = clean(item.target_fact_key || item.targetFactKey || item.factKey, 200);
      var actor = canonicalCharName(item.actor || item.char || item.name || item.character);
      var memoryType = normalizeMemoryType({ memory_type: item.memory_type || item.memoryType });
      var reasonText = clean(item.reason || item.memory || item.why || item.note, 400);
      var confidence = clamp01(item.confidence);
      var explicitRefs = refsFromItem(item, ['source_refs', 'sourceRefs', 'basis_refs', 'basisRefs', 'evidenceRefs']);
      var reasons = [];
      if (!(targetId || targetFactKey || actor)) reasons.push({ code: 'missing_forget_target', message: 'forget has no target id/factKey/actor' });
      if (!reasonText) reasons.push({ code: 'missing_reason', message: 'forget has no reason' });
      if (confidence == null) reasons.push({ code: 'missing_confidence', message: 'forget has no confidence' });
      else if (confidence < Number(opts.minConfidence || 0.55)) reasons.push({ code: 'low_confidence', message: 'forget confidence below review threshold' });
      if (!explicitRefs.length) reasons.push({ code: 'missing_source_refs', message: 'forget has no explicit source refs' });
      var locator = targetId || targetFactKey || actor || ('idx-' + i);
      var sourceId = clean(item.sourceId || opts.sourceId || ('turn-' + turn), 120);
      var sourceType = clean(item.sourceType || opts.sourceType || 'aiTurnResult', 80);
      var aiRef = sourceRef(sourceType, sourceId, reasonText || locator, turn);
      var candidate = {
        id: clean(item.id, 120) || ('memory-forget-' + turn + '-' + i),
        type: 'memory_forget',
        body: reasonText || ('forget ' + locator),
        safeBody: reasonText || ('forget ' + locator),
        authority: 'ai_extracted',
        source: 'ai_extracted',
        turn: turn,
        ownerScope: 'system',
        readScope: 'system',
        lane: 'L5_advisory_context',
        reason: 'turn-inference:memory-forget',
        sourceRefs: mergeRefs(refsFromItem(item, ['source_refs', 'sourceRefs']), [aiRef]),
        basisRefs: mergeRefs(refsFromItem(item, ['basis_refs', 'basisRefs', 'evidenceRefs']), readRefs),
        extra: {
          confidence: confidence,
          reason: reasonText,
          forget: {
            id: targetId,
            factKey: targetFactKey,
            actor: actor,
            memoryType: memoryType,
            readScope: clean(item.target_read_scope || item.targetReadScope || item.readScope, 60)
          }
        }
      };
      if (reasons.length) {
        candidate.status = 'quarantined';
        candidate.reviewStatus = 'quarantined';
        candidate.reasons = reasons;
      }
      out.push(candidate);
    });
    return out;
  }

  function chronicleCandidates(GM, aiResult, opts) {
    opts = opts || {};
    var turn = Number((GM && GM.turn) || opts.turn || 0);
    var body = chronicleBody(aiResult);
    if (!body) return [];
    var sourceId = clean(opts.sourceId || 'SC1', 120);
    var sourceType = clean(opts.sourceType || 'aiTurnResult', 80);
    var explicitRefs = refsFromItem(aiResult, ['basis_refs', 'basisRefs', 'source_refs', 'sourceRefs', 'evidenceRefs']);
    return [{
      id: 'turn-inference-summary-' + turn + '-' + sourceId,
      type: 'turn_inference_summary',
      factKey: 'chronicle:turn:' + turn + ':' + (clean(sourceId, 80).replace(/[^\w-]+/g, '-') || 'source'),
      body: body,
      safeBody: body,
      authority: 'ai_summary',
      source: 'ai_extracted',
      visibility: 'public',
      turn: turn,
      ownerScope: 'world',
      readScope: 'public',
      sourceRefs: mergeRefs([sourceRef(sourceType, sourceId, body, turn)]),
      basisRefs: mergeRefs(explicitRefs, traceReadContextRefs(GM, opts)),
      lane: 'L7_chronicle_context',
      reason: 'turn-inference:chronicle-summary',
      extra: {
        stream: 'chronicle',
        sourceId: sourceId,
        title: clean(aiResult && (aiResult.szj_title || aiResult.shizhengji_title || aiResult.title), 120)
      }
    }];
  }

  function issueUpdateType(update) {
    var action = clean(update && update.action, 40).toLowerCase();
    if (action === 'resolve' || action === 'resolved' || action === 'close') return 'issue_resolution';
    if (action === 'add' || action === 'create' || action === 'open') return 'strategic_issue';
    return 'issue_update';
  }

  function issueBody(update) {
    update = update || {};
    return clean([
      update.title,
      update.category,
      update.description,
      update.summary,
      update.resolution,
      update.result,
      update.outcome,
      update.reason,
      update.nextStep
    ].filter(Boolean).join(' '), 800);
  }

  function issueKey(update, index, turn) {
    update = update || {};
    return clean(update.id || update.issueId || update.issue_id, 120) || ('issue-' + Number(turn || 0) + '-' + index);
  }

  function issueFactKey(update, issueId) {
    return explicitFactKey(update) || ('state-affair:' + stableSlug(issueId, 120));
  }

  function issueShouldSupersede(update, type) {
    var action = clean(update && update.action, 40).toLowerCase();
    return type === 'issue_resolution' ||
      action === 'update' ||
      action === 'revise' ||
      action === 'correct' ||
      action === 'supersede' ||
      action === 'replace';
  }

  function issueCandidates(GM, aiResult, opts) {
    opts = opts || {};
    var turn = Number((GM && GM.turn) || opts.turn || 0);
    var sourceId = clean(opts.sourceId || 'SC1', 120);
    var sourceType = clean(opts.sourceType || 'aiTurnResult', 80);
    var readRefs = traceReadContextRefs(GM, opts);
    var out = [];
    arr(aiResult && aiResult.current_issues_update).forEach(function(update, index) {
      if (!update) return;
      var body = issueBody(update);
      if (!body) return;
      var type = issueUpdateType(update);
      var issueId = issueKey(update, index, turn);
      var explicitRefs = refsFromItem(update, ['source_refs', 'sourceRefs']);
      var basisRefs = refsFromItem(update, ['basis_refs', 'basisRefs', 'evidenceRefs']);
      var factKey = issueFactKey(update, issueId);
      var explicitSupersedesRefs = governanceRefsFromItem(update, ['supersedes_refs', 'supersedesRefs', 'supersedes', 'supersededRefs', 'replaces_id', 'replacesId', 'replaces'], 'accepted_memory');
      var autoSupersedesRefs = issueShouldSupersede(update, type) ? acceptedRefsByFactKey(GM, factKey) : [];
      var supersedesRefs = mergeGovernanceRefs(explicitSupersedesRefs, autoSupersedesRefs);
      var contradictsRefs = governanceRefsFromItem(update, ['contradicts_refs', 'contradictsRefs', 'contradicts', 'conflicts_with_refs', 'conflictsWithRefs', 'conflicts_with', 'conflictsWith'], 'accepted_memory');
      out.push({
        id: 'turn-issue-' + turn + '-' + index + '-' + issueId,
        type: type,
        issueId: issueId,
        factKey: factKey,
        body: body,
        safeBody: body,
        authority: 'ai_analysis',
        source: 'ai_extracted',
        visibility: update.visibility || 'public',
        turn: turn,
        ownerScope: 'world',
        readScope: 'public',
        sourceRefs: mergeRefs(explicitRefs, [sourceRef(sourceType, sourceId, body, turn)]),
        basisRefs: mergeRefs(basisRefs, readRefs),
        lane: type === 'issue_resolution' ? 'L2_active_law_commitment' : 'L5_advisory_context',
        reason: 'turn-inference:current-issue:' + clean(update.action || 'update', 40),
        confidence: clamp01(update.confidence) == null ? 0.58 : clamp01(update.confidence),
        entities: [].concat(arr(update.linkedChars), arr(update.linkedFactions), arr(update.entities)),
        extra: {
          stream: 'stateAffairs',
          factKey: factKey,
          action: clean(update.action, 40),
          category: clean(update.category, 80),
          severity: clean(update.severity, 80)
        }
      });
      if (supersedesRefs.length) out[out.length - 1].supersedesRefs = supersedesRefs;
      if (contradictsRefs.length) out[out.length - 1].contradictsRefs = contradictsRefs;
    });
    return out;
  }

  function enqueueCandidates(GM, candidates, opts) {
    var WG = root.TM && root.TM.MemoryWriteGate;
    if (!WG || typeof WG.enqueue !== 'function') return { added: 0, missingWriteGate: true };
    var added = 0;
    var items = [];
    var counts = { drafts: 0, quarantined: 0, accepted: 0, archived: 0 };
    arr(candidates).forEach(function(candidate) {
      var item = WG.enqueue(GM, candidate, opts || {});
      if (item) {
        added++;
        items.push(item);
        if (item.status === 'draft') counts.drafts++;
        else if (item.status === 'quarantined') counts.quarantined++;
        else if (item.status === 'active' && item.reviewStatus === 'accepted') counts.accepted++;
        else if (item.status === 'archived') counts.archived++;
      }
    });
    return { added: added, items: items, drafts: counts.drafts, quarantined: counts.quarantined, accepted: counts.accepted, archived: counts.archived };
  }

  // 低风险公开人物记忆的"可信系统自动接受"lane（opt-in，仅活回合路径传 autoAcceptTrusted:true）。
  // 不绕过 evaluateCandidate：候选先经写闸的注入/hard_state/质量门，只对已落 draft 的低风险项做提升。
  // 私密 belief、低置信、非 character_memory、隔离项、摘要一律不自动接受，仍待人审。
  function autoAcceptLowRiskDrafts(GM, items, opts) {
    opts = opts || {};
    if (opts.autoAcceptTrusted !== true) return 0;
    var WG = root.TM && root.TM.MemoryWriteGate;
    if (!WG || typeof WG.acceptDraft !== 'function') return 0;
    var minConf = Number(opts.autoAcceptMinConfidence != null ? opts.autoAcceptMinConfidence : 0.7);
    var accepted = 0;
    arr(items).forEach(function(item) {
      if (!item || item.status !== 'draft' || !item.id) return;
      if (item.type !== 'character_memory' && !(item.extra && item.extra.sourceBound === true && item.extra.literalEvidence === true)) return;
      var extra = item.extra || {};
      if (extra.private === true) return;
      var readScope = clean(item.readScope, 120);
      if (readScope && readScope !== 'public') return;
      var conf = Number(extra.confidence);
      if (!isFinite(conf) || conf < minConf) return;
      var res = WG.acceptDraft(GM, item.id, { reviewer: 'auto-trusted', reason: 'low-risk public character memory auto-accept' });
      if (res) accepted++;
    });
    return accepted;
  }

  function enqueuePostTurnCandidates(GM, aiResult, opts) {
    opts = opts || {};
    try {
      var candidates = collectPostTurnCandidates(GM, aiResult || {}, opts);
      var queued = enqueueCandidates(GM, candidates, { forceDraft: opts.forceDraft !== false });
      var autoAccepted = autoAcceptLowRiskDrafts(GM, queued.items, opts);
      var result = {
        added: queued.added || 0,
        candidates: candidates.length,
        drafts: queued.drafts || 0,
        quarantined: queued.quarantined || 0,
        accepted: (queued.accepted || 0) + autoAccepted,
        autoAccepted: autoAccepted,
        archived: queued.archived || 0,
        ids: arr(queued.items).map(function(item) { return item && item.id; }).filter(Boolean),
        status: queued.added ? 'drafted' : 'empty'
      };
      if ((queued.added || 0) && root.TM && root.TM.MemoryTrace) {
        if (typeof root.TM.MemoryTrace.recordWrite === 'function') {
          root.TM.MemoryTrace.recordWrite(GM, {
            id: 'SC1_WRITEBACK',
            stage: 'postturn-memory-writeback',
            sourceId: clean(opts.sourceId || 'SC1', 120),
            status: result.status,
            candidates: candidates.length,
            added: result.added,
            drafts: result.drafts,
            quarantined: result.quarantined,
            accepted: result.accepted,
            archived: result.archived,
            readContextRefs: traceReadContextRefs(GM, opts),
            items: queued.items || []
          });
        } else if (typeof root.TM.MemoryTrace.recordInjection === 'function') {
          root.TM.MemoryTrace.recordInjection(GM, {
            stage: 'postturn-memory-candidates',
            status: result.status,
            count: result.added
          });
        }
      }
      return result;
    } catch (err) {
      try {
        if (root.TM && root.TM.MemoryTrace && typeof root.TM.MemoryTrace.recordWrite === 'function') {
          root.TM.MemoryTrace.recordWrite(GM, {
            id: 'SC1_WRITEBACK',
            stage: 'postturn-memory-writeback',
            sourceId: clean(opts.sourceId || 'SC1', 120),
            status: 'error',
            error: String(err && err.message || err),
            readContextRefs: traceReadContextRefs(GM, opts),
            items: []
          });
        }
      } catch (_) {}
      try {
        if (root.TM && root.TM.errors && typeof root.TM.errors.captureSilent === 'function') {
          root.TM.errors.captureSilent(err, 'postturn-memory-candidates');
        }
      } catch (_) {}
      return { added: 0, candidates: 0, status: 'error', error: String(err && err.message || err) };
    }
  }

  function collectPostTurnCandidates(GM, aiResult, opts) {
    opts = opts || {};
    return []
      .concat(chronicleCandidates(GM, aiResult || {}, opts))
      .concat(issueCandidates(GM, aiResult || {}, opts))
      .concat(characterMemoryCandidates(GM, aiResult || {}, opts))
      .concat(forgetCandidates(GM, aiResult || {}, opts))
      .concat(root.TM.MemoryLongTerm ? root.TM.MemoryLongTerm.candidates(GM, aiResult || {}) : []);
  }

  ns.characterMemoryCandidates = characterMemoryCandidates;
  ns.chronicleCandidates = chronicleCandidates;
  ns.issueCandidates = issueCandidates;
  ns.forgetCandidates = forgetCandidates;
  ns.evaluateCharacterMemoryUpdate = evaluateCharacterMemoryUpdate;
  ns.collectPostTurnCandidates = collectPostTurnCandidates;
  ns.enqueueCandidates = enqueueCandidates;
ns.enqueuePostTurnCandidates = enqueuePostTurnCandidates;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
