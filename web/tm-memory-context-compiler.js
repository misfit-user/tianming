(function(global) {
  'use strict';

  var root = global || (typeof window !== 'undefined' ? window : {});
  root.TM = root.TM || {};

  var ns = root.TM.MemoryContextCompiler = root.TM.MemoryContextCompiler || {};

  function perfWithSpan(name, fn, metadata) {
    var perf = root.TM && root.TM.perf;
    return perf && typeof perf.withSpan === 'function' ? perf.withSpan(name, fn, metadata) : fn();
  }

  var SECTION_ORDER = [
    'coreFacts',
    'courtRecords',
    'stateAffairs',
    'chronology',
    'characterMemory',
    'recentEvents',
    'relationshipFacts',
    'warnings'
  ];

  var SECTION_META = {
    coreFacts: ['core-facts', 'core facts'],
    courtRecords: ['court-records', 'court records and rulings'],
    stateAffairs: ['state-affairs', 'state affairs and unresolved political issues'],
    chronology: ['chronology', 'chronicle and annals'],
    characterMemory: ['character-memory', 'character memories and actor-scoped facts'],
    recentEvents: ['recent-events', 'recent events'],
    relationshipFacts: ['relationship-facts', 'relationship facts'],
    warnings: ['warnings', 'low authority or cautionary memories']
  };

  // S4(2026-06-03): 本地表数值对齐 MemoryEvidenceRegistry(canonical)，消除 F4 残留漂移 footgun。
  // authorityRank() 已 prefer ER；本表仅在 ER 不可用时作防御回退，对齐后即便回退也不产生口径分歧。
  var AUTHORITY_RANK = {
    engine_state: 100,
    player_pin: 90,
    rule_validated: 80,
    official_record: 72,
    court_report: 66,
    structured_chronicle: 60,
    event_log: 58,
    rule_validated_summary: 55,
    ai_extracted: 45,
    ai_summary: 30,
    vector: 28,
    procedural: 26,
    rumor: 20
  };

  var SOURCE_SECTION = {
    hard_state: 'coreFacts',
    imperialEdict: 'coreFacts',
    activeEdict: 'coreFacts',
    commitment: 'coreFacts',
    accepted_memory: 'coreFacts',
    strategic_issue: 'stateAffairs',
    issue_resolution: 'stateAffairs',
    issue_update: 'stateAffairs',
    ongoing_affair: 'stateAffairs',
    court_record: 'courtRecords',
    chronicle: 'chronology',
    chronicle_event: 'chronology',
    historiography_summary: 'chronology',
    qiju: 'chronology',
    shiji: 'chronology',
    character_memory: 'characterMemory',
    character_belief: 'characterMemory',
    relationship_event: 'characterMemory',
    court_dialogue_record: 'characterMemory',
    playerAction: 'recentEvents',
    eventHistory: 'recentEvents',
    jishi: 'recentEvents',
    relation_event: 'relationshipFacts',
    npc: 'relationshipFacts',
    rumor: 'warnings',
    vector: 'warnings',
    ai_summary: 'warnings',
    procedural: 'warnings'
  };

  function arr(value) {
    return Array.isArray(value) ? value : [];
  }

  function toText(value) {
    if (value == null) return '';
    if (typeof value === 'string') return value;
    try { return JSON.stringify(value); } catch (_) { return String(value); }
  }

  function clean(value, maxLen) {
    var s = toText(value).replace(/\s+/g, ' ').trim();
    if (!s) return '';
    return s.slice(0, maxLen || 240);
  }

  function xml(value) {
    return toText(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  function safeTextOf(hit, maxLen) {
    hit = hit || {};
    var text = hit.safeBody != null
      ? hit.safeBody
      : (hit.text != null ? hit.text : (hit.event != null ? hit.event : (hit.content != null ? hit.content : hit.body)));
    text = clean(text, maxLen || 240);
    return text
      .replace(/ignore\s+previous\s+instructions?/ig, '[redacted-instruction]')
      .replace(/disregard\s+previous/ig, '[redacted-instruction]')
      .replace(/from\s+now\s+on/ig, '[redacted-instruction]')
      .replace(/[<>]/g, '');
  }

  function sourceOf(hit) {
    hit = hit || {};
    return clean(hit.source || (hit.char ? 'npc' : 'unknown'), 80);
  }

  function authorityRank(hit) {
    hit = hit || {};
    if (hit.authorityRank != null && isFinite(Number(hit.authorityRank))) return Number(hit.authorityRank);
    var key = clean(hit.authority || '', 80);
    // F4: MemoryEvidenceRegistry 为权威等级单一真相源（消除本地表与 ER 漂移）。
    // ER 识别该 key（返回 >0）则用 ER；ER 不识别(unknown=0)才回退本地表。
    var ER = root.TM && root.TM.MemoryEvidenceRegistry;
    if (ER && typeof ER.getAuthorityRank === 'function' && key) {
      var r = Number(ER.getAuthorityRank(key));
      if (isFinite(r) && r > 0) return r;
    }
    return AUTHORITY_RANK[key] != null ? AUTHORITY_RANK[key] : 40;
  }

  function lanePriority(hit) {
    var CZ = root.TM && root.TM.ContextZones;
    var lane = clean(hit && hit.lane || '', 80);
    if (CZ && CZ.LANE_PRIORITY && CZ.LANE_PRIORITY[lane] != null) return Number(CZ.LANE_PRIORITY[lane]);
    if (lane === 'L1_world_truth') return 100;
    if (lane === 'L2_active_law_commitment') return 90;
    if (lane === 'L3_long_term_affair') return 80;
    if (lane === 'L4_dialogue_evidence') return 70;
    if (lane === 'L5_advisory_context') return 60;
    if (lane === 'L6_retrieved_evidence') return 45;
    if (lane === 'L7_chronicle_context') return 40;
    if (lane === 'L8_narrative_threads') return 30;
    return 20;
  }

  function recencyScore(hit, opts) {
    opts = opts || {};
    var cur = Number(opts.turn || 0);
    var turn = Number(hit && hit.turn || 0);
    if (!cur || !turn) return 0.5;
    var age = Math.max(0, cur - turn);
    if (age <= 1) return 1;
    if (age <= 5) return 0.8;
    if (age <= 12) return 0.6;
    if (age <= 40) return 0.35;
    return 0.15;
  }

  function normalizedScore(hit, opts) {
    hit = hit || {};
    var modelScore = hit._score != null ? Number(hit._score) : (hit.score != null ? Number(hit.score) : (hit.relevance != null ? Number(hit.relevance) : 0.5));
    if (!isFinite(modelScore)) modelScore = 0.5;
    var importance = hit.importance != null ? Number(hit.importance) : 5;
    if (!isFinite(importance)) importance = 5;
    return lanePriority(hit) * 10 +
      authorityRank(hit) * 4 +
      Math.max(0, Math.min(1, modelScore)) * 100 +
      Math.max(0, Math.min(10, importance)) * 8 +
      recencyScore(hit, opts) * 40;
  }

  function sectionFor(hit) {
    hit = hit || {};
    var src = sourceOf(hit);
    var type = clean(hit.type || hit.factStatus || '', 80);
    var authority = clean(hit.authority || '', 80);
    var lane = clean(hit.lane || '', 80);
    if (authority === 'rumor' || src === 'rumor') return 'warnings';
    if (hit.memoryKind === 'unresolved_thread') return 'stateAffairs';
    if (hit.memoryKind === 'decision_rationale') return 'courtRecords';
    if (hit.memoryKind === 'causal_lesson' || hit.memoryKind === 'economic_pattern') return 'warnings';
    if (hit.memoryKind === 'institutional_memory' || hit.memoryKind === 'territorial_change' || hit.memoryKind === 'correction') return 'chronology';
    if (src === 'court_record' || hit.type === 'court_resolution' || hit.factStatus === 'court_resolution' || hit.factStatus === 'court_record') return 'courtRecords';
    if (type === 'issue_resolution' || type === 'strategic_issue' || type === 'issue_update' || type === 'ongoing_affair') return 'stateAffairs';
    if (type === 'character_memory' || type === 'character_belief' || type === 'relationship_event' || type === 'court_dialogue_record') return 'characterMemory';
    if (type === 'chronicle_event' || type === 'historiography_summary') return 'chronology';
    if (lane === 'L1_world_truth' || lane === 'L2_active_law_commitment') return 'coreFacts';
    if (lane === 'L7_chronicle_context') return 'chronology';
    return SOURCE_SECTION[src] || 'recentEvents';
  }

  function compactRefList(list) {
    return arr(list).slice(0, 4).map(function(ref) {
      if (!ref) return '';
      var t = clean(ref.type || '', 40).replace(/\s+/g, '_');
      var id = clean(ref.id || '', 80).replace(/\s+/g, '_');
      return t && id ? (t + ':' + id) : '';
    }).filter(Boolean).join('|');
  }

  function normalizeHit(hit, index, opts) {
    hit = hit || {};
    var out = {};
    Object.keys(hit).forEach(function(k) { out[k] = hit[k]; });
    out.id = clean(out.id || out.key || out.uuid || ('hit-' + index), 120) || ('hit-' + index);
    out.source = sourceOf(out);
    out.type = clean(out.type || out.kind || '', 80);
    out._factText = safeTextOf(out, Number.MAX_SAFE_INTEGER);
    out.text = safeTextOf(out, opts && opts.perHitMaxChars || 180);
    out.turn = Number(out.turn || 0);
    out.authority = clean(out.authority || '', 80);
    out.authorityRank = authorityRank(out);
    out.lane = clean(out.lane || '', 80);
    out.visibility = clean(out.visibility || '', 80);
    out.factStatus = clean(out.factStatus || '', 80);
    out.sourceRefs = arr(out.sourceRefs);
    out.basisRefs = arr(out.basisRefs);
    if (opts && opts.turn != null) {
      var currentTurn = Number(opts.turn);
      if ((out.validToTurn != null && Number(out.validToTurn) < currentTurn) || (out.expiredAtTurn != null && Number(out.expiredAtTurn) <= currentTurn)) out.temporalUse = 'historical_only';
      if (out.validFromTurn != null && Number(out.validFromTurn) > currentTurn) out.temporalUse = 'not_yet_effective';
    }
    out._compilerScore = normalizedScore(out, opts);
    return out;
  }

  function sortHits(a, b) {
    var d = Number(b._compilerScore || 0) - Number(a._compilerScore || 0);
    if (d) return d;
    d = Number(b.turn || 0) - Number(a.turn || 0);
    if (d) return d;
    return String(a.id).localeCompare(String(b.id));
  }

  function emptySections() {
    var out = {};
    SECTION_ORDER.forEach(function(key) { out[key] = []; });
    return out;
  }

  function flattenRecall(recallResults) {
    var out = [];
    (Array.isArray(recallResults) ? recallResults : []).forEach(function(group, gi) {
      var purpose = clean(group && group.query && group.query.purpose || '', 120);
      arr(group && group.hits).forEach(function(hit, hi) {
        var item = {};
        Object.keys(hit || {}).forEach(function(k) { item[k] = hit[k]; });
        item.queryPurpose = purpose;
        item._groupIndex = gi;
        item._hitIndex = hi;
        out.push(item);
      });
    });
    return out;
  }

  function renderHit(hit) {
    var attrs = [
      'id="' + xml(hit.id) + '"',
      'source="' + xml(hit.source) + '"',
      'turn="' + xml(hit.turn || 0) + '"'
    ];
    if (hit.authority) attrs.push('authority="' + xml(hit.authority) + '"');
    if (hit.authorityRank != null) attrs.push('authority-rank="' + xml(hit.authorityRank) + '"');
    if (hit.factStatus) attrs.push('fact-status="' + xml(hit.factStatus) + '"');
    if (hit.lane) attrs.push('lane="' + xml(hit.lane) + '"');
    if (hit.visibility) attrs.push('visibility="' + xml(hit.visibility) + '"');
    if (hit.memoryKind) attrs.push('memory-kind="' + xml(hit.memoryKind) + '"');
    if (hit.temporalUse) attrs.push('temporal-use="' + xml(hit.temporalUse) + '"');
    if (hit.staleStatus) attrs.push('stale-status="' + xml(hit.staleStatus) + '"');
    if (hit.validFromTurn != null) attrs.push('valid-from="' + xml(hit.validFromTurn) + '"');
    if (hit.validToTurn != null) attrs.push('valid-to="' + xml(hit.validToTurn) + '"');
    if (hit.expiredAtTurn != null) attrs.push('expired-at="' + xml(hit.expiredAtTurn) + '"');
    var sourceRefs = compactRefList(hit.sourceRefs);
    var basisRefs = compactRefList(hit.basisRefs);
    if (sourceRefs) attrs.push('source-refs="' + xml(sourceRefs) + '"');
    if (basisRefs) attrs.push('basis-refs="' + xml(basisRefs) + '"');
    return '    <memory ' + attrs.join(' ') + '>' + xml(hit.text) + '</memory>\n';
  }

  function renderSection(key, hits) {
    if (!hits.length) return '';
    var meta = SECTION_META[key] || [key, key];
    return '  <' + meta[0] + ' label="' + xml(meta[1]) + '">\n' +
      hits.map(renderHit).join('') +
      '  </' + meta[0] + '>\n';
  }

  function perfCount(name, delta) {
    var perf = root.TM && root.TM.perf;
    if (perf && typeof perf.count === 'function') perf.count(name, delta == null ? 1 : delta);
  }

  function tokenCharCounts(text) {
    var value = String(text || '');
    var cjk = 0;
    var other = 0;
    var usesGlobalEstimator = typeof root.estimateTokens === 'function';
    for (var i = 0; i < value.length; i++) {
      var code = value.charCodeAt(i);
      var isCjk = usesGlobalEstimator
        ? ((code >= 0x4e00 && code <= 0x9fff) || (code >= 0x3040 && code <= 0x30ff))
        : (code >= 0x3400 && code <= 0x9fff);
      if (isCjk) cjk++;
      else other++;
    }
    return { cjk: cjk, other: other };
  }

  function tokenCostFromCounts(counts) {
    var usesGlobalEstimator = typeof root.estimateTokens === 'function';
    var cost = Math.ceil(counts.cjk * (usesGlobalEstimator ? 1.3 : 0.75) + counts.other * 0.25);
    return counts.cjk || counts.other ? Math.max(1, cost) : 0;
  }

  function buildSectionPlan(key, hits) {
    var meta = SECTION_META[key] || [key, key];
    var opening = '  <' + meta[0] + ' label="' + xml(meta[1]) + '">\n';
    var closing = '  </' + meta[0] + '>\n';
    var fragments = arr(hits).map(function(hit) {
      perfCount('memory.renderedFragments', 1);
      return renderHit(hit);
    });
    var base = tokenCharCounts(opening + closing);
    var prefixCounts = [{ cjk: base.cjk, other: base.other }];
    var fragmentTokenCosts = [];
    fragments.forEach(function(fragment) {
      var counts = tokenCharCounts(fragment);
      var previous = prefixCounts[prefixCounts.length - 1];
      prefixCounts.push({ cjk: previous.cjk + counts.cjk, other: previous.other + counts.other });
      fragmentTokenCosts.push(tokenCostFromCounts(counts));
    });
    return {
      key: key,
      opening: opening,
      closing: closing,
      fragments: fragments,
      prefixCounts: prefixCounts,
      fragmentTokenCosts: fragmentTokenCosts,
      text: fragments.length ? opening + fragments.join('') + closing : '',
      textForCount: function(count) {
        if (!count) return '';
        return opening + fragments.slice(0, count).join('') + closing;
      },
      tokenCostForCount: function(count) {
        return count > 0 ? tokenCostFromCounts(prefixCounts[Math.min(count, prefixCounts.length - 1)]) : 0;
      }
    };
  }

  function compileHits(hits, opts) {
    return perfWithSpan('memory.compile', function() {
      return compileHitsInner(hits, opts);
    }, { hitCount: Array.isArray(hits) ? hits.length : 0 });
  }

  function governCompilerHits(hits, opts, suppressed) {
    var MR = root.TM && root.TM.MemoryRetrieval;
    var policy = {};
    Object.keys(opts).forEach(function(k) { policy[k] = opts[k]; });
    policy.intent = opts.intent || 'historical_evidence';
    if (MR && typeof MR.rankHitsDetailed === 'function') {
      var ranked = MR.rankHitsDetailed(hits, policy);
      Array.prototype.push.apply(suppressed, arr(ranked.suppressed));
      return arr(ranked.ranked).map(function(hit) { hit._compilerScore = normalizedScore(hit, opts); return hit; }).sort(sortHits);
    }
    return hits.filter(function(hit) {
      var states = [hit.status, hit.reviewStatus, hit.factStatus].join('|').toLowerCase();
      var reason = /(^|\|)(draft|pending_review|rejected|quarantined|quarantine|deleted|deleted_tombstone|redacted)(\||$)/.test(states) ? 'unaccepted_memory' : '';
      var audience = opts.audience || (opts.actorScope && opts.actorScope.kind) || opts.actorScope || 'system';
      var scopes = String(hit.readScope || '').toLowerCase().split(/[\s,;|]+/);
      var actor = String(opts.actorId || (opts.actorScope && (opts.actorScope.actorId || opts.actorScope.npcId)) || '').toLowerCase();
      if (!reason && scopes.length && scopes[0] && ['system', 'gm', 'designer'].indexOf(audience) < 0 && scopes.indexOf('public') < 0 && scopes.indexOf(audience) < 0 && (!actor || scopes.indexOf('npc:' + actor) < 0)) reason = 'read_scope';
      if (!reason && hit.visibility && ['public', 'court', 'internal', 'world_truth', 'player_known'].indexOf(hit.visibility) < 0) reason = 'visibility_policy_unavailable';
      if (!reason && (hit.worldId || hit.saveId || hit.campaignId || hit.timelineId)) reason = 'identity_policy_unavailable';
      if (!reason && opts.turn != null && opts.includeFuture !== true && (Number(hit.turn) > Number(opts.turn) || Number(hit.learnedAtTurn) > Number(opts.turn))) reason = 'future_memory';
      if (!reason) return true;
      suppressed.push({ id: hit.id, source: hit.source, reason: reason });
      return false;
    });
  }

  function compileHitsInner(hits, opts) {
    opts = opts || {};
    var suppressed = arr(opts.suppressed).slice();
    var normalizedInput = governCompilerHits(Array.isArray(hits) ? hits : [], opts, suppressed)
      .map(function(hit, index) { return normalizeHit(hit, index, opts); })
      .filter(function(hit) { return !!hit.text; })
      .sort(sortHits);
    var normalized = [];
    var seenStableIds = Object.create(null);
    var seenFacts = Object.create(null);
    normalizedInput.forEach(function(hit) {
      var status = clean(hit.factStatus || hit.status || '', 80).toLowerCase();
      if (hit.active === false || hit.expired === true || status === 'expired' || status === 'superseded' || status === 'revoked') {
        suppressed.push({ id: hit.id, source: hit.source, reason: 'inactive_or_expired_memory', textPreview: clean(hit.text, 80) });
        return;
      }
      var stableId = hit.id && !/^hit-\d+$/.test(hit.id) ? String(hit.id) : '';
      var factKey = String(hit.source || '') + '|' + String(hit.readScope || hit.ownerScope || '') + '|' + String(hit._factText || hit.text || '').replace(/\s+/g, ' ').trim();
      if ((stableId && seenStableIds[stableId]) || (factKey && seenFacts[factKey])) {
        suppressed.push({ id: hit.id, source: hit.source, reason: 'duplicate_memory_fact', textPreview: clean(hit.text, 80) });
        return;
      }
      if (stableId) seenStableIds[stableId] = true;
      if (factKey) seenFacts[factKey] = true;
      normalized.push(hit);
    });
    var sections = emptySections();
    normalized.forEach(function(hit) {
      sections[sectionFor(hit)].push(hit);
    });

    // Keep a representative current fact, live order and promise before the long character roster.
    var coreCandidates = sections.coreFacts;
    var coreLeads = [];
    [function(h) { return h.source === 'hard_state'; }, function(h) { return h.source === 'activeEdict' || h.source === 'imperialEdict'; }, function(h) { return h.source === 'commitment'; }, function(h) { return h.pinned === true; }].forEach(function(matches) {
      var lead = coreCandidates.find(matches);
      if (lead && coreLeads.indexOf(lead) < 0) coreLeads.push(lead);
    });
    sections.coreFacts = coreLeads.concat(coreCandidates.filter(function(h) { return coreLeads.indexOf(h) < 0; }));
    var sectionPlans = {};
    SECTION_ORDER.forEach(function(key) {
      sectionPlans[key] = buildSectionPlan(key, sections[key]);
    });
    var body = SECTION_ORDER.map(function(key) {
      return sectionPlans[key].text;
    }).filter(Boolean).join('');
    var text = '<memory-context schema-version="memory-context/v0">\n' + body + '</memory-context>\n';
    var packed = null;
    var CZ = root.TM && root.TM.ContextZones;
    var hasBudget = Object.prototype.hasOwnProperty.call(opts, 'maxTokens') && opts.maxTokens != null && opts.maxTokens !== '';
    var maxTokens = 0;
    if (hasBudget) {
      maxTokens = CZ && typeof CZ.finiteNonNegative === 'function'
        ? CZ.finiteNonNegative(opts.maxTokens, CZ.DEFAULT_INVALID_MAX_TOKENS || 8192)
        : (Number.isFinite(Number(opts.maxTokens)) && Number(opts.maxTokens) >= 0 ? Number(opts.maxTokens) : 8192);
      maxTokens = Math.floor(maxTokens);
    }
    if (CZ && typeof CZ.packZones === 'function' && maxTokens > 0) {
      var zones = [
        { id: 'memory-context-header', lane: 'L6_retrieved_evidence', text: '<memory-context schema-version="memory-context/v0">\n', mustKeep: true, structural: true, atomic: true, order: 0, source: 'MemoryContextCompiler' }
      ];
      var order = 10;
      // S4: 低权威/大体量 section 的 per-zone 上限(占预算比)，防其 balloon 挤占其余高价值区。
      var ZONE_CAP_FRAC = { warnings: 0.25 };
      SECTION_ORDER.forEach(function(key) {
        var plan = sectionPlans[key];
        var sectionText = plan.text;
        if (!sectionText) return;
        var z = {
          id: 'memory-context-' + key,
          lane: key === 'coreFacts' ? 'L1_world_truth' : (key === 'chronology' ? 'L7_chronicle_context' : 'L6_retrieved_evidence'),
          text: sectionText,
          order: order++,
          score: sections[key].reduce(function(max, hit) { return Math.max(max, Number(hit._compilerScore || 0)); }, 0) / 1200,
          source: 'MemoryContextCompiler',
          reason: key,
          allowTruncate: false
        };
        // S4: 载重权威 section 永不被预算裁掉(ST「mandatory memory never trimmed」)。coreFacts=hard_state/法令/承诺/裁断级世界硬事实。
        if (key === 'coreFacts') {
          z.mustKeep = true;
          var hasOtherEvidence = SECTION_ORDER.some(function(other) { return other !== 'coreFacts' && other !== 'warnings' && sections[other].length > 0; });
          if (maxTokens >= 600 && hasOtherEvidence) z.maxTokens = Math.max(Math.floor(maxTokens * 0.65), CZ.estimateTokens(plan.textForCount(1)));
        }
        z.compress = function(info) {
          var limit = info && info.maxTokens || 0;
          var low = 0;
          var high = plan.fragments.length;
          var bestCount = 0;
          while (low <= high) {
            var mid = Math.floor((low + high) / 2);
            var candidate = plan.textForCount(mid);
            var cost = info && typeof info.estimateTokens === "function" ? info.estimateTokens(candidate) : plan.tokenCostForCount(mid);
            if (cost <= limit) {
              bestCount = mid;
              low = mid + 1;
            } else {
              high = mid - 1;
            }
          }
          return plan.textForCount(bestCount);
        };
        if (ZONE_CAP_FRAC[key]) z.maxTokens = Math.max(1, Math.floor(maxTokens * ZONE_CAP_FRAC[key]));
        zones.push(z);
      });
      zones.push({ id: 'memory-context-footer', lane: 'L6_retrieved_evidence', text: '</memory-context>\n', mustKeep: true, structural: true, atomic: true, order: 999999, source: 'MemoryContextCompiler' });
      packed = CZ.packZones(zones, { maxTokens: maxTokens });
      text = packed.text;
      suppressed = suppressed.concat(arr(packed.suppressed));
    }

    if ((hasBudget && maxTokens === 0) || !normalized.length) {
      text = '';
      packed = { ok: true, reason: hasBudget && maxTokens === 0 ? 'budget_disabled' : 'empty_context', items: [], tokenEstimate: 0, mandatoryOverflow: [], diagnostics: { kept: [], suppressed: [] } };
    } else if (hasBudget && !(CZ && typeof CZ.packZones === 'function')) {
      text = '';
      packed = { ok: false, reason: 'context_zones_unavailable', items: [], tokenEstimate: 0, mandatoryOverflow: [], diagnostics: { kept: [], suppressed: [] } };
    }
    if (packed && packed.ok === false) text = '';
    var emittedIds = Object.create(null);
    var emittedPattern = /<memory id="([^"]*)"/g;
    var emittedMatch;
    while ((emittedMatch = emittedPattern.exec(text))) emittedIds[emittedMatch[1]] = true;
    var injectedHits = [];
    var injectedSections = emptySections();
    normalized.forEach(function(hit) {
      if (emittedIds[xml(hit.id)]) {
        injectedHits.push(hit);
        injectedSections[sectionFor(hit)].push(hit);
      } else {
        suppressed.push({ id: hit.id, source: hit.source, reason: hasBudget && maxTokens === 0 ? 'budget_disabled' : 'memory_budget_exceeded' });
      }
    });
    var diagnostics = packed ? packed.diagnostics : {};
    diagnostics.zoneKept = arr(diagnostics.kept);
    diagnostics.kept = injectedHits.map(function(hit) { return { id: hit.id, source: hit.source, stage: 'compiled', lane: hit.lane }; });
    diagnostics.suppressed = suppressed.slice();
    diagnostics.candidateCount = normalized.length;
    diagnostics.injectedCount = injectedHits.length;

    var tokenEstimate = packed
      ? packed.tokenEstimate
      : (CZ && typeof CZ.estimateTokens === 'function' ? CZ.estimateTokens(text) : tokenCostFromCounts(tokenCharCounts(text)));

    var compilationIndex = {
      renderedFragments: Object.create(null),
      fragmentTokenCosts: Object.create(null)
    };
    SECTION_ORDER.forEach(function(key) {
      compilationIndex.renderedFragments[key] = sectionPlans[key].fragments;
      compilationIndex.fragmentTokenCosts[key] = sectionPlans[key].fragmentTokenCosts;
    });

    return {
      ok: !packed || packed.ok !== false,
      reason: packed && packed.reason || '',
      schemaVersion: 'memory-context/v0',
      sections: sections,
      hits: normalized,
      injectedSections: injectedSections,
      injectedHits: injectedHits,
      text: text,
      zones: packed ? packed.items : [],
      suppressed: suppressed,
      mandatoryOverflow: packed ? packed.mandatoryOverflow : [],
      compilationIndex: compilationIndex,
      diagnostics: diagnostics,
      tokenEstimate: tokenEstimate,
      maxTokens: maxTokens
    };
  }

  function requireCompiled(compiled, label) {
    if (!compiled || compiled.ok === false || (compiled.maxTokens > 0 && compiled.tokenEstimate > compiled.maxTokens)) {
      var error = new Error((label || 'memory context') + ': mandatory context exceeds the configured token ceiling');
      error.code = 'mandatory_context_overflow';
      error.reason = compiled && compiled.reason || 'mandatory_context_overflow';
      error.diagnostics = compiled && compiled.diagnostics || null;
      error.compiled = compiled || null;
      throw error;
    }
    return compiled;
  }

  function compileRecall(recallResults, opts) {
    opts = opts || {};
    return compileHits(flattenRecall(recallResults), opts);
  }

  function compileFromGM(GM, opts) {
    opts = opts || {};
    var ME = root.TM && root.TM.MemoryEnvelope;
    var MR = root.TM && root.TM.MemoryRetrieval;
    if (!ME || typeof ME.collect !== 'function') {
      return compileHits([], opts);
    }
    var envelopes = ME.collect(GM || {}, { turn: opts.turn != null ? opts.turn : (GM && GM.turn), sc1q: opts.sc1q });
    var hits = envelopes.map(function(env, index) {
      if (MR && typeof MR.hitFromEnvelope === 'function') return MR.hitFromEnvelope(env);
      return {
        id: env.id || ('env-' + index),
        source: env.type || 'unknown',
        type: env.type || '',
        text: env.safeBody || env.body || '',
        safeBody: env.safeBody || '',
        turn: env.turn,
        authority: env.authority,
        authorityRank: env.authorityRank,
        visibility: env.visibility,
        factStatus: env.factStatus,
        lane: env.lane,
        sourceRefs: env.sourceRefs,
        basisRefs: env.basisRefs,
        readScope: env.readScope,
        ownerScope: env.ownerScope
      };
    });
    var suppressed = [];
    // F-focus（2026-06-01·研究增强·非 Codex 原方案）：对本回合焦点实体相关的记忆做 relevance 加成，
    // 令 SC1_PRE_CONTEXT 在 token 预算受限时优先注入"与当下诏令/议题/对话相关"的记忆（Gen-Agents relevance）。
    if (MR && typeof MR.turnFocusTerms === 'function' && typeof MR.applyFocusRelevance === 'function') {
      try { MR.applyFocusRelevance(hits, MR.turnFocusTerms(GM, { sc1q: opts.sc1q })); } catch (_focusE) {}
    }
    var mergedOpts = {};
    Object.keys(opts).forEach(function(k) { mergedOpts[k] = opts[k]; });
    mergedOpts.GM = GM;
    mergedOpts.turn = opts.turn != null ? opts.turn : (GM && GM.turn);
    mergedOpts.suppressed = arr(opts.suppressed).concat(suppressed);
    return compileHits(hits, mergedOpts);
  }

  ns.SECTION_ORDER = SECTION_ORDER;
  ns.requireCompiled = requireCompiled;
  ns.compileHits = compileHits;
  ns.compileRecall = compileRecall;
  ns.compileFromGM = compileFromGM;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
