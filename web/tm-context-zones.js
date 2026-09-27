(function(global) {
  'use strict';

  var root = global || (typeof window !== 'undefined' ? window : {});
  root.TM = root.TM || {};

  var ns = root.TM.ContextZones = root.TM.ContextZones || {};

  var LANE_PRIORITY = {
    L1_world_truth: 100,
    L2_active_law_commitment: 90,
    L3_long_term_affair: 80,
    L4_dialogue_evidence: 70,
    L5_advisory_context: 60,
    L6_retrieved_evidence: 45,
    L7_chronicle_context: 40,
    L8_narrative_threads: 30
  };

  var DEFAULT_INVALID_MAX_TOKENS = 8192;

  function hasOwn(obj, key) {
    return !!obj && Object.prototype.hasOwnProperty.call(obj, key);
  }

  function finiteNonNegative(value, fallback) {
    var fallbackNumber = Number(fallback);
    if (!Number.isFinite(fallbackNumber) || fallbackNumber < 0) fallbackNumber = 0;
    var n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : fallbackNumber;
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

  function estimateTokens(text) {
    var MT = root.TM && root.TM.MemoryTrace;
    if (MT && typeof MT.estimateTokens === 'function') return MT.estimateTokens(text);
    var value = toText(text);
    if (!value) return 0;
    var cjk = (value.match(/[\u3400-\u9fff]/g) || []).length;
    var other = Math.max(0, value.length - cjk);
    return Math.max(1, Math.ceil(cjk * 0.75 + other / 4));
  }

  function lanePriority(lane) {
    var key = clean(lane, 80);
    return LANE_PRIORITY[key] != null ? LANE_PRIORITY[key] : 10;
  }

  function normalizeZone(zone, index, opts) {
    zone = zone || {};
    opts = opts || {};
    var text = toText(zone.text || zone.content || '');
    var lane = clean(zone.lane || 'L6_retrieved_evidence', 80) || 'L6_retrieved_evidence';
    var measuredCost = estimateTokens(text);
    var declaredCost = zone.tokenEstimate != null
      ? finiteNonNegative(zone.tokenEstimate, measuredCost)
      : measuredCost;
    var cost = Math.max(measuredCost, declaredCost);
    var overallFallback = finiteNonNegative(opts.invalidMaxTokensFallback, DEFAULT_INVALID_MAX_TOKENS);
    var zoneCap = 0;
    if (hasOwn(zone, 'maxTokens')) {
      zoneCap = finiteNonNegative(zone.maxTokens, overallFallback);
    } else if (hasOwn(opts, 'defaultMaxTokens')) {
      zoneCap = finiteNonNegative(opts.defaultMaxTokens, overallFallback);
    }
    return {
      id: clean(zone.id || zone.key || ('zone-' + index), 120) || ('zone-' + index),
      lane: lane,
      text: text,
      order: finiteNonNegative(zone.order != null ? zone.order : index, index),
      score: finiteNonNegative(zone.score != null ? zone.score : 0, 0),
      mustKeep: zone.mustKeep === true,
      structural: zone.structural === true,
      atomic: zone.atomic === true,
      // A zone cap is a hard boundary, not implicit permission to cut arbitrary markup/text.
      // Mandatory zones may truncate as the final fit step; optional zones must opt in or be suppressed.
      allowTruncate: zone.allowTruncate === true || (zone.allowTruncate !== false && zone.mustKeep === true),
      active: zone.active !== false,
      expired: zone.expired === true,
      source: clean(zone.source || '', 80),
      reason: clean(zone.reason || '', 120),
      tokenEstimate: cost,
      rawTokenEstimate: cost,
      maxTokens: zoneCap,
      summary: toText(zone.summary || zone.compressedText || ''),
      compress: typeof zone.compress === 'function' ? zone.compress : null,
      authority: clean(zone.authority || '', 60),
      authorityRank: zone.authorityRank != null ? Number(zone.authorityRank) : null,
      visibility: clean(zone.visibility || '', 80),
      factStatus: clean(zone.factStatus || '', 80),
      sourceRefs: Array.isArray(zone.sourceRefs) ? zone.sourceRefs : [],
      basisRefs: Array.isArray(zone.basisRefs) ? zone.basisRefs : []
    };
  }

  function rankZone(zone) {
    return lanePriority(zone.lane) + (zone.mustKeep ? 1000 : 0) + (zone.structural ? 2000 : 0) + Math.max(0, Math.min(1, zone.score || 0));
  }

  function sortByRank(a, b) {
    var d = rankZone(b) - rankZone(a);
    if (d) return d;
    return (a.order - b.order) || String(a.id).localeCompare(String(b.id));
  }

  function sortByOrder(a, b) {
    return (a.order - b.order) || String(a.id).localeCompare(String(b.id));
  }

  function suppressedZone(zone, reason, stage) {
    return {
      id: zone.id,
      source: zone.source || 'context_zone',
      lane: zone.lane,
      reason: reason || 'zone_filtered',
      budgetStage: stage || 'fill',
      cost: zone.tokenEstimate,
      textPreview: clean(zone.text, 80)
    };
  }

  function cloneZoneWithText(zone, text, reason) {
    var out = {};
    Object.keys(zone).forEach(function(key) { out[key] = zone[key]; });
    out.text = toText(text);
    out.tokenEstimate = estimateTokens(out.text);
    out.compressed = out.tokenEstimate < zone.rawTokenEstimate;
    out.compressionReason = reason || '';
    return out;
  }

  function truncateTextToTokens(text, maxTokens) {
    text = toText(text);
    maxTokens = Math.floor(finiteNonNegative(maxTokens, 0));
    if (!text || maxTokens <= 0) return '';
    if (estimateTokens(text) <= maxTokens) return text;
    var low = 0;
    var high = text.length;
    var best = '';
    while (low <= high) {
      var mid = Math.floor((low + high) / 2);
      var candidate = text.slice(0, mid);
      if (estimateTokens(candidate) <= maxTokens) {
        best = candidate;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return best;
  }

  function compressedZoneForBudget(zone, maxTokens, diagnostics) {
    maxTokens = Math.floor(finiteNonNegative(maxTokens, 0));
    if (zone.tokenEstimate <= maxTokens) return zone;
    if (maxTokens <= 0 || zone.atomic) return null;

    var candidate = '';
    var reason = '';
    if (zone.summary) {
      candidate = zone.summary;
      reason = 'zone_summary';
    }
    if (zone.compress) {
      try {
        var compressed = zone.compress({
          maxTokens: maxTokens,
          text: zone.text,
          tokenEstimate: zone.tokenEstimate,
          estimateTokens: estimateTokens
        });
        if (compressed && typeof compressed === 'object' && compressed.text != null) compressed = compressed.text;
        if (compressed != null && toText(compressed)) {
          candidate = toText(compressed);
          reason = 'zone_compressor';
        }
      } catch (error) {
        diagnostics.compressionErrors.push({ id: zone.id, message: String(error && error.message || error) });
      }
    }
    if (!candidate) candidate = zone.text;
    if (estimateTokens(candidate) > maxTokens) {
      if (!zone.allowTruncate) return null;
      candidate = truncateTextToTokens(candidate, maxTokens);
      reason = reason ? (reason + '_truncated') : 'zone_truncated';
    }
    if (!candidate || estimateTokens(candidate) > maxTokens) return null;
    var fitted = cloneZoneWithText(zone, candidate, reason);
    diagnostics.compressed.push({
      id: zone.id,
      fromTokens: zone.rawTokenEstimate,
      toTokens: fitted.tokenEstimate,
      reason: reason
    });
    return fitted;
  }

  function configuredMaxTokens(opts) {
    if (!hasOwn(opts, 'maxTokens') || opts.maxTokens == null || opts.maxTokens === '') return 0;
    return Math.floor(finiteNonNegative(
      opts.maxTokens,
      finiteNonNegative(opts.invalidMaxTokensFallback, DEFAULT_INVALID_MAX_TOKENS)
    ));
  }

  function packZones(zones, opts) {
    opts = opts || {};
    var maxTokens = configuredMaxTokens(opts);
    var selected = [];
    var suppressed = [];
    var used = 0;
    var selectedMap = {};
    var diagnostics = {
      kept: [],
      suppressed: [],
      compressed: [],
      compressionErrors: [],
      guaranteed: 0,
      filled: 0,
      dropped: 0,
      rawTokenEstimate: 0,
      compressedTokenEstimate: 0,
      mandatoryRawTokens: 0,
      mandatoryPackedTokens: 0,
      mandatoryOverflowReason: '',
      invalidMaxTokens: hasOwn(opts, 'maxTokens') && !Number.isFinite(Number(opts.maxTokens))
    };
    var input = [];
    (Array.isArray(zones) ? zones : []).forEach(function(zone, index) {
      var normalized = normalizeZone(zone, index, opts);
      if (!normalized.text) return;
      diagnostics.rawTokenEstimate += normalized.rawTokenEstimate;
      if (!normalized.active || normalized.expired) {
        var stale = suppressedZone(normalized, 'inactive_or_expired_zone', normalized.mustKeep ? 'must_keep' : 'fill');
        suppressed.push(stale);
        diagnostics.suppressed.push(stale);
        diagnostics.dropped++;
        return;
      }
      input.push(normalized);
    });
    diagnostics.mandatoryRawTokens = input.filter(function(zone) { return zone.mustKeep; })
      .reduce(function(total, zone) { return total + zone.rawTokenEstimate; }, 0);
    var mandatoryOverflow = [];
    var mandatoryTextSeen = {};

    function budgetFor(zone, hardLimit) {
      var available = maxTokens ? Math.max(0, maxTokens - used) : Number.MAX_SAFE_INTEGER;
      if (zone.maxTokens) available = Math.min(available, Math.floor(zone.maxTokens));
      if (hardLimit != null) available = Math.min(available, Math.floor(finiteNonNegative(hardLimit, 0)));
      return available;
    }

    function keep(zone, stage, hardLimit) {
      if (!zone) return false;
      if (selectedMap[zone.id]) {
        var duplicateId = suppressedZone(zone, 'duplicate_zone_id', stage);
        suppressed.push(duplicateId);
        diagnostics.suppressed.push(duplicateId);
        diagnostics.dropped++;
        return false;
      }
      var fitted = compressedZoneForBudget(zone, budgetFor(zone, hardLimit), diagnostics);
      if (!fitted) return false;
      selectedMap[zone.id] = true;
      selected.push(fitted);
      used += fitted.tokenEstimate;
      diagnostics.kept.push({
        id: fitted.id,
        lane: fitted.lane,
        stage: stage || 'fill',
        cost: fitted.tokenEstimate,
        originalCost: zone.rawTokenEstimate,
        order: fitted.order
      });
      if (stage === 'must_keep') {
        diagnostics.guaranteed++;
        diagnostics.mandatoryPackedTokens += fitted.tokenEstimate;
      }
      else diagnostics.filled++;
      return true;
    }

    var mandatoryZones = [];
    input.filter(function(zone) { return zone.mustKeep; }).sort(sortByRank).forEach(function(zone) {
      var dedupeKey = zone.text.replace(/\s+/g, ' ').trim();
      if (dedupeKey && mandatoryTextSeen[dedupeKey]) {
        var duplicate = suppressedZone(zone, 'duplicate_mandatory_context', 'must_keep');
        suppressed.push(duplicate);
        diagnostics.suppressed.push(duplicate);
        diagnostics.dropped++;
        return;
      }
      if (dedupeKey) mandatoryTextSeen[dedupeKey] = true;
      mandatoryZones.push(zone);
    });

    var structuralMandatory = mandatoryZones.filter(function(zone) { return zone.structural; });
    var regularMandatory = mandatoryZones.filter(function(zone) { return !zone.structural; });
    structuralMandatory.forEach(function(zone) {
      if (!keep(zone, 'must_keep')) {
        var overflow = suppressedZone(zone, 'mandatory_context_overflow', 'must_keep');
        suppressed.push(overflow);
        diagnostics.suppressed.push(overflow);
        diagnostics.dropped++;
        mandatoryOverflow.push(overflow);
      }
    });
    regularMandatory.forEach(function(zone, index) {
      var remainingCount = regularMandatory.length - index;
      var remainingBudget = maxTokens ? Math.max(0, maxTokens - used) : Number.MAX_SAFE_INTEGER;
      var fairLimit = maxTokens ? Math.floor(remainingBudget / Math.max(1, remainingCount)) : null;
      if (!keep(zone, 'must_keep', fairLimit)) {
        var overflow = suppressedZone(zone, 'mandatory_context_overflow', 'must_keep');
        suppressed.push(overflow);
        diagnostics.suppressed.push(overflow);
        diagnostics.dropped++;
        mandatoryOverflow.push(overflow);
      }
    });

    input.filter(function(zone) { return !zone.mustKeep; }).sort(sortByRank).forEach(function(zone) {
      if (selectedMap[zone.id]) return;
      if (!keep(zone, 'fill')) {
        var item = suppressedZone(zone, 'zone_budget_exceeded', 'fill');
        suppressed.push(item);
        diagnostics.suppressed.push(item);
        diagnostics.dropped++;
      }
    });

    var ordered = selected.slice().sort(sortByOrder);
    diagnostics.compressedTokenEstimate = used;
    if (mandatoryOverflow.length) diagnostics.mandatoryOverflowReason = 'mandatory_context_overflow';
    return {
      ok: mandatoryOverflow.length === 0,
      reason: mandatoryOverflow.length ? 'mandatory_context_overflow' : '',
      items: ordered,
      text: ordered.map(function(zone) { return zone.text; }).join(''),
      tokenEstimate: used,
      maxTokens: maxTokens,
      suppressed: suppressed,
      mandatoryOverflow: mandatoryOverflow,
      diagnostics: diagnostics
    };
  }

  function requirePacked(packed, label) {
    if (!packed || packed.ok === false || (packed.maxTokens > 0 && packed.tokenEstimate > packed.maxTokens)) {
      var error = new Error((label || 'context') + ': mandatory context exceeds the configured token ceiling');
      error.code = 'mandatory_context_overflow';
      error.reason = packed && packed.reason || 'mandatory_context_overflow';
      error.diagnostics = packed && packed.diagnostics || null;
      error.packed = packed || null;
      throw error;
    }
    return packed;
  }

  function recordZoneInjection(GM, packed, opts) {
    opts = opts || {};
    var MT = root.TM && root.TM.MemoryTrace;
    if (!MT || typeof MT.recordInjection !== 'function' || !packed) return null;
    return MT.recordInjection(GM, {
      lane: 'context_zones',
      stage: opts.stage || 'context-zones',
      text: packed.text || '',
      tokenEstimate: packed.tokenEstimate,
      suppressed: packed.suppressed,
      items: (packed.items || []).map(function(zone) {
        return {
          id: zone.id,
          source: zone.source || 'context_zone',
          reason: zone.reason || 'context zone',
          lane: zone.lane,
          authority: zone.authority,
          authorityRank: zone.authorityRank,
          visibility: zone.visibility,
          factStatus: zone.factStatus,
          sourceRefs: zone.sourceRefs,
          basisRefs: zone.basisRefs
        };
      })
    });
  }

  ns.LANE_PRIORITY = LANE_PRIORITY;
  ns.DEFAULT_INVALID_MAX_TOKENS = DEFAULT_INVALID_MAX_TOKENS;
  ns.finiteNonNegative = finiteNonNegative;
  ns.estimateTokens = estimateTokens;
  ns.truncateTextToTokens = truncateTextToTokens;
  ns.packZones = packZones;
  ns.requirePacked = requirePacked;
  ns.recordZoneInjection = recordZoneInjection;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
