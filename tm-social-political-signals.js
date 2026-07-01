// @ts-check
// ── 章节导航（grep 小节标题跳转，行号会漂）──
//   标准社会/政治信号账本（阶层·党派·朝堂动态·暴露 SocialPoliticalSignals·MAX_ITEMS=160）
//   recordChange 记录信号 → 派生趋势/势位 → 供御案社会层地基 helpers 读
//   与 tm-party-class-llm-calibrator.js（LLM 校准）配合
// ─────────────────────────────────────────────
/*
 * tm-social-political-signals.js
 * Standard social/political signal ledger for class, party, and court dynamics.
 */
(function(global) {
  'use strict';

  var TM = global.TM = global.TM || {};
  var MAX_ITEMS = 160;

  function clone(v) {
    if (v === undefined || v === null) return v;
    try { return JSON.parse(JSON.stringify(v)); }
    catch (_) {
      if (Array.isArray(v)) return v.slice();
      if (typeof v === 'object') {
        var out = {};
        Object.keys(v).forEach(function(k) { out[k] = v[k]; });
        return out;
      }
      return v;
    }
  }

  function toArray(v) {
    if (v === undefined || v === null || v === '') return [];
    return Array.isArray(v) ? v.slice() : [v];
  }

  function pickRoot(root) {
    if (root && typeof root === 'object') return root;
    if (global.GM && typeof global.GM === 'object') return global.GM;
    if (global.scriptData && typeof global.scriptData === 'object') return global.scriptData;
    return {};
  }

  function clamp(n, min, max) {
    n = Number(n);
    if (!isFinite(n)) n = min;
    return Math.max(min, Math.min(max, n));
  }

  function textOf(raw) {
    if (raw === undefined || raw === null) return '';
    if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') return String(raw);
    if (Array.isArray(raw)) return raw.map(textOf).filter(Boolean).join(' ');
    if (typeof raw === 'object') {
      var keys = ['text', 'content', 'summary', 'desc', 'description', 'agenda', 'goal', 'objective', 'topic', 'title', 'name', 'demand', 'reason'];
      for (var i = 0; i < keys.length; i += 1) {
        if (raw[keys[i]] !== undefined && raw[keys[i]] !== null && raw[keys[i]] !== '') return textOf(raw[keys[i]]);
      }
    }
    return '';
  }

  function normalizeName(v) {
    return String(v || '').replace(/[\s\u3000'"`.,;:!?()[\]{}<>\/\\|_-]+/g, '').toLowerCase().trim();
  }

  function compact(v, maxLen) {
    var text = String(textOf(v) || '').replace(/\s+/g, ' ').trim();
    maxLen = Number(maxLen) || 180;
    return text.length > maxLen ? text.slice(0, maxLen) : text;
  }

  function uniqueTexts(list) {
    var seen = {};
    var out = [];
    toArray(list).forEach(function(v) {
      var text = compact(v, 80);
      if (!text || seen[text]) return;
      seen[text] = true;
      out.push(text);
    });
    return out;
  }

  function getClasses(root) {
    root = pickRoot(root);
    if (Array.isArray(root.classes)) return root.classes;
    if (Array.isArray(root.socialClasses)) return root.socialClasses;
    if (root.scriptData && Array.isArray(root.scriptData.classes)) return root.scriptData.classes;
    if (root.scriptData && Array.isArray(root.scriptData.socialClasses)) return root.scriptData.socialClasses;
    if (global.P && Array.isArray(global.P.classes)) return global.P.classes;
    if (global.P && Array.isArray(global.P.socialClasses)) return global.P.socialClasses;
    if (global.scriptData && Array.isArray(global.scriptData.classes)) return global.scriptData.classes;
    if (global.scriptData && Array.isArray(global.scriptData.socialClasses)) return global.scriptData.socialClasses;
    return [];
  }

  function getParties(root) {
    root = pickRoot(root);
    if (Array.isArray(root.parties)) return root.parties;
    if (root.scriptData && Array.isArray(root.scriptData.parties)) return root.scriptData.parties;
    if (global.P && Array.isArray(global.P.parties)) return global.P.parties;
    if (global.scriptData && Array.isArray(global.scriptData.parties)) return global.scriptData.parties;
    if (root.partyState && typeof root.partyState === 'object') {
      return Object.keys(root.partyState).map(function(name) {
        var row = root.partyState[name];
        if (row && typeof row === 'object') {
          if (!row.name) row.name = name;
          return row;
        }
        return { name: name };
      });
    }
    return [];
  }

  function classNameOf(cls) {
    return String(cls && (cls.name || cls.className || cls.id) || '').trim();
  }

  function partyNameOf(party) {
    return String(party && (party.name || party.partyName || party.id) || '').trim();
  }

  function findClass(root, className) {
    var n = normalizeName(className);
    if (!n) return null;
    var list = getClasses(root);
    for (var i = 0; i < list.length; i += 1) {
      var cls = list[i];
      if (!cls) continue;
      if (normalizeName(classNameOf(cls)) === n) return cls;
      var aliases = toArray(cls.aliases || cls.alias || cls.altNames || cls.otherNames);
      for (var j = 0; j < aliases.length; j += 1) {
        if (normalizeName(aliases[j]) === n) return cls;
      }
    }
    return null;
  }

  function findParty(root, partyName) {
    var n = normalizeName(partyName);
    if (!n) return null;
    var list = getParties(root);
    for (var i = 0; i < list.length; i += 1) {
      var party = list[i];
      if (!party) continue;
      if (normalizeName(partyNameOf(party)) === n) return party;
      var aliases = toArray(party.aliases || party.alias || party.altNames || party.otherNames);
      for (var j = 0; j < aliases.length; j += 1) {
        if (normalizeName(aliases[j]) === n) return party;
      }
    }
    if (root && root.partyState && root.partyState[partyName] && typeof root.partyState[partyName] === 'object') return root.partyState[partyName];
    return null;
  }

  function ensureStore(root) {
    root = pickRoot(root);
    if (!root._socialPoliticalSignals || typeof root._socialPoliticalSignals !== 'object' || Array.isArray(root._socialPoliticalSignals)) {
      root._socialPoliticalSignals = {
        turn: Number(root.turn) || 0,
        seq: 0,
        items: [],
        stats: { recorded: 0, applied: 0 }
      };
    }
    if (!Array.isArray(root._socialPoliticalSignals.items)) root._socialPoliticalSignals.items = [];
    if (!root._socialPoliticalSignals.stats) root._socialPoliticalSignals.stats = { recorded: 0, applied: 0 };
    return root._socialPoliticalSignals;
  }

  function normalizeClassImpact(raw) {
    raw = raw || {};
    var name = raw.name || raw.className || raw.sourceClass || raw.class || raw.group || '';
    return {
      name: textOf(name),
      satisfactionDelta: numberOrNull(raw.satisfactionDelta != null ? raw.satisfactionDelta : raw.satisfaction_delta),
      influenceDelta: numberOrNull(raw.influenceDelta != null ? raw.influenceDelta : raw.influence_delta),
      demand: compact(raw.demand || raw.demands || raw.currentDemand || raw.newDemand || raw.new_demands, 140),
      status: compact(raw.status || raw.newStatus || raw.new_status, 80),
      unrestDelta: clone(raw.unrestDelta || raw.unrest_delta || null),
      reason: compact(raw.reason, 180)
    };
  }

  function normalizePartyImpact(raw) {
    raw = raw || {};
    var name = raw.name || raw.party || raw.partyName || raw.targetParty || '';
    return {
      name: textOf(name),
      influenceDelta: numberOrNull(raw.influenceDelta != null ? raw.influenceDelta : raw.influence_delta),
      cohesionDelta: numberOrNull(raw.cohesionDelta != null ? raw.cohesionDelta : raw.cohesion_delta),
      currentAgenda: compact(raw.currentAgenda || raw.agenda || raw.newAgenda || raw.new_agenda, 140),
      shortGoal: compact(raw.shortGoal || raw.goal || raw.newShortGoal || raw.new_shortGoal, 140),
      status: compact(raw.status || raw.newStatus || raw.new_status, 80),
      reason: compact(raw.reason, 180)
    };
  }

  function normalizeRelationAdjustment(raw) {
    raw = raw || {};
    return {
      className: textOf(raw.className || raw.sourceClass || raw.class || raw.group || ''),
      party: textOf(raw.party || raw.partyName || raw.name || raw.targetParty || ''),
      affinityDelta: numberOrNull(raw.affinityDelta != null ? raw.affinityDelta : raw.affinity_delta),
      trustDelta: numberOrNull(raw.trustDelta != null ? raw.trustDelta : raw.trust_delta),
      grievanceDelta: numberOrNull(raw.grievanceDelta != null ? raw.grievanceDelta : raw.grievance_delta),
      emergent: raw.emergent !== false,
      reason: compact(raw.reason, 180)
    };
  }

  function numberOrNull(v) {
    var n = Number(v);
    return isFinite(n) ? n : null;
  }

  function enrichRawWithEcology(root, raw) {
    if (raw && (raw.skipEcology || raw.disableEcologyEnrichment)) return raw;
    try {
      if (TM.PartyClassEcology && typeof TM.PartyClassEcology.enrichSignalRaw === 'function') {
        return TM.PartyClassEcology.enrichSignalRaw(root, raw, {
          turn: raw && raw.turn != null ? raw.turn : root && root.turn,
          source: raw && (raw.sourceSystem || raw.source || raw.kind)
        });
      }
    } catch (_) {}
    return raw;
  }

  function buildSignal(root, raw, seq) {
    raw = raw || {};
    raw = enrichRawWithEcology(root, raw) || raw;
    var sourceSystem = compact(raw.sourceSystem || raw.system || raw.source || 'unknown', 80);
    var kind = compact(raw.kind || raw.type || raw.action || raw.event || sourceSystem, 80);
    var reason = compact(raw.reason || raw.text || raw.summary || raw.detail || raw.title || raw.topic, 220);
    return {
      id: 'sps-' + (Number(root.turn) || 0) + '-' + seq,
      turn: Number(raw.turn != null ? raw.turn : root.turn) || 0,
      seq: seq,
      sourceSystem: sourceSystem || 'unknown',
      kind: kind || 'social-political-signal',
      tags: uniqueTexts(toArray(raw.tags || raw.policyTags || raw.labels)),
      intensity: clamp(raw.intensity != null ? raw.intensity : 0.5, 0, 1),
      confidence: clamp(raw.confidence != null ? raw.confidence : 0.7, 0, 1),
      linkedIssue: compact(raw.linkedIssue || raw.issueId || raw.topicId || raw.chaoyiTrackId || '', 100),
      reason: reason,
      // W2c·上游因（此信号「由什么引发」）——供 WorldDigest 串成「因→果→牵动谁」因果链；缺省空串不改既有行为
      cause: compact(raw.cause || raw.causedBy || raw.upstream || raw.trigger || '', 160),
      characterName: compact(raw.characterName || raw.character || raw.executorName || raw.delegateCharacter || raw.sourceCharacter || raw.actorName || '', 80),
      characterId: compact(raw.characterId || raw.charId || raw.executorId || raw.delegateCharacterId || raw.sourceCharacterId || '', 80),
      executorName: compact(raw.executorName || raw.executor || '', 80),
      delegateCharacter: compact(raw.delegateCharacter || '', 80),
      sourceCharacter: compact(raw.sourceCharacter || '', 80),
      affectedClasses: toArray(raw.affectedClasses || raw.classes || raw.classImpacts).map(normalizeClassImpact).filter(function(x) { return !!x.name; }),
      affectedParties: toArray(raw.affectedParties || raw.parties || raw.partyImpacts).map(normalizePartyImpact).filter(function(x) { return !!x.name; }),
      relationAdjustments: toArray(raw.relationAdjustments || raw.relations || raw.partyClassRelations).map(normalizeRelationAdjustment).filter(function(x) { return !!(x.className && x.party); }),
      evidence: toArray(raw.evidence).map(function(x) { return compact(x, 120); }).filter(Boolean).slice(0, 8),
      applied: false,
      at: Date.now()
    };
  }

  function record(rootOrSignal, maybeSignal) {
    var root;
    var raw;
    if (maybeSignal === undefined && rootOrSignal && typeof rootOrSignal === 'object' && (rootOrSignal.sourceSystem || rootOrSignal.affectedClasses || rootOrSignal.affectedParties || rootOrSignal.relationAdjustments)) {
      root = pickRoot();
      raw = rootOrSignal;
    } else {
      root = pickRoot(rootOrSignal);
      raw = maybeSignal || {};
    }
    var store = ensureStore(root);
    store.turn = Number(root.turn) || store.turn || 0;
    store.seq = (Number(store.seq) || 0) + 1;
    store.stats.recorded = (Number(store.stats.recorded) || 0) + 1;
    var signal = buildSignal(root, raw, store.seq);
    store.items.push(signal);
    if (store.items.length > MAX_ITEMS) store.items = store.items.slice(-MAX_ITEMS);
    return clone(signal);
  }

  function recordFieldChange(root, category, name, field, oldValue, newValue, reason) {
    if (oldValue === newValue) return;
    try {
      if (typeof global.recordChange === 'function') {
        global.recordChange(category, name, field, oldValue, newValue, reason || 'social-political-signal');
      } else {
        if (!root.turnChanges || typeof root.turnChanges !== 'object' || Array.isArray(root.turnChanges)) root.turnChanges = {};
        if (!Array.isArray(root.turnChanges[category])) root.turnChanges[category] = [];
        var item = root.turnChanges[category].find(function(x) { return x && x.name === name; });
        if (!item) {
          item = { name: name, changes: [] };
          root.turnChanges[category].push(item);
        }
        item.changes.push({ field: field, oldValue: oldValue, newValue: newValue, reason: reason || 'social-political-signal' });
      }
    } catch (_) {}
  }

  function pushHistory(obj, field, item, maxLen) {
    if (!obj) return;
    if (!Array.isArray(obj[field])) obj[field] = [];
    obj[field].push(clone(item));
    if (obj[field].length > (maxLen || 24)) obj[field] = obj[field].slice(-(maxLen || 24));
  }

  function applyClassImpact(root, signal, impact, options) {
    var cls = findClass(root, impact.name);
    if (!cls) return null;
    var turn = Number(options.turn != null ? options.turn : signal.turn) || 0;
    var reason = impact.reason || signal.reason || signal.kind;
    var before = {
      satisfaction: Number(cls.satisfaction),
      influence: Number(cls.influence || cls.classInfluence)
    };
    if (!isFinite(before.satisfaction)) before.satisfaction = 50;
    if (!isFinite(before.influence)) before.influence = 50;
    var satDelta = impact.satisfactionDelta == null ? 0 : clamp(impact.satisfactionDelta, -25, 25);
    var infDelta = impact.influenceDelta == null ? 0 : clamp(impact.influenceDelta, -20, 20);
    var changed = false;
    if (satDelta) {
      // 2026-06-14·满意度走 ClassEngine.gateSatisfaction 总闸(每回合每阶层 ±14 预算·跨信号/AI/foundation 共享),
      // 防 ecology 等多源信号单回合各自直写 -6 把阶层从 73 连扣 19 次砸到 0(跳楼式下降)。
      var _gateRes = null;
      try {
        if (TM.ClassEngine && typeof TM.ClassEngine.gateSatisfaction === 'function') {
          _gateRes = TM.ClassEngine.gateSatisfaction(root, cls, satDelta, {
            turn: turn,
            source: signal.sourceSystem || options.source || 'social-political-signal',
            reason: reason
          });
        }
      } catch (_gateE) {}
      if (_gateRes && typeof _gateRes.approved === 'number') {
        // gate 已写 cls.satisfaction(含预算扣减/[0,100] 夹取);satDelta 收敛为实批准量·供下游 coupling/minxin 反馈
        satDelta = _gateRes.approved;
        if (_gateRes.approved) {
          recordFieldChange(root, 'classes', classNameOf(cls), 'satisfaction', _gateRes.before, _gateRes.after, reason);
          changed = true;
        }
      } else {
        // 兜底:ClassEngine 不可用时退回旧直写(保证不因依赖缺失而失效)
        cls.satisfaction = Math.round(clamp(before.satisfaction + satDelta, 0, 100) * 100) / 100;
        recordFieldChange(root, 'classes', classNameOf(cls), 'satisfaction', before.satisfaction, cls.satisfaction, reason);
        changed = true;
      }
    }
    if (infDelta) {
      cls.influence = Math.round(clamp(before.influence + infDelta, 0, 100) * 100) / 100;
      recordFieldChange(root, 'classes', classNameOf(cls), 'influence', before.influence, cls.influence, reason);
      changed = true;
    }
    if (impact.demand) {
      cls.demands = impact.demand;
      cls.currentDemand = impact.demand;
      changed = true;
    }
    if (impact.status) {
      cls.status = impact.status;
      changed = true;
    }
    if (impact.unrestDelta && typeof impact.unrestDelta === 'object') {
      if (!cls.unrestLevels || typeof cls.unrestLevels !== 'object') cls.unrestLevels = {};
      Object.keys(impact.unrestDelta).forEach(function(k) {
        var d = Number(impact.unrestDelta[k]);
        if (!isFinite(d) || !d) return;
        var old = Number(cls.unrestLevels[k]);
        if (!isFinite(old)) old = 50;
        cls.unrestLevels[k] = Math.round(clamp(old + clamp(d, -20, 20), 0, 100) * 100) / 100;
        changed = true;
      });
    }
    if (!changed) return null;
    cls.lastClassReason = reason;
    pushHistory(cls, '_socialPoliticalHistory', {
      turn: turn,
      signalId: signal.id,
      sourceSystem: signal.sourceSystem,
      kind: signal.kind,
      reason: reason,
      impact: clone(impact)
    });
    var coupling = null;
    try {
      if (TM.ClassEngine && typeof TM.ClassEngine.applyClassPartyCoupling === 'function' && satDelta) {
        coupling = TM.ClassEngine.applyClassPartyCoupling(root, cls, satDelta, {
          turn: turn,
          source: options.source || signal.sourceSystem,
          reason: reason
        });
      }
    } catch (_) {}
    try {
      if (TM.ClassEngine && typeof TM.ClassEngine.refreshClassPhase === 'function') {
        TM.ClassEngine.refreshClassPhase(root, cls);
      }
    } catch (_) {}
    try {
      if (TM.ClassMinxinBridge && typeof TM.ClassMinxinBridge.applyClassPressure === 'function') {
        var feedbackSource = String(signal.kind || signal.sourceSystem || '');
        TM.ClassMinxinBridge.applyClassPressure(root, {
          turn: turn,
          sourceSystem: signal.sourceSystem || options.source || 'social-political-signal',
          sourceId: signal.id || [signal.turn, signal.seq, impact.name].join('|'),
          className: impact.name,
          satisfactionDelta: satDelta,
          influenceDelta: infDelta,
          unrestDelta: impact.unrestDelta || null,
          linkedIssue: signal.linkedIssue || '',
          reason: reason,
          allowMinxinFeedback: !/local-revolt-risk|minxin/i.test(feedbackSource),
          deferLedgerFinalize: options.deferLedgerFinalize === true
        });
      }
    } catch (_classMinxinBridgeE) {}
    return {
      className: classNameOf(cls),
      before: before,
      after: { satisfaction: cls.satisfaction, influence: cls.influence },
      coupling: coupling
    };
  }

  function applyPartyImpact(root, signal, impact, options) {
    var party = findParty(root, impact.name);
    if (!party) return null;
    var turn = Number(options.turn != null ? options.turn : signal.turn) || 0;
    var reason = impact.reason || signal.reason || signal.kind;
    var before = {
      influence: Number(party.influence),
      cohesion: Number(party.cohesion)
    };
    if (!isFinite(before.influence)) before.influence = 50;
    if (!isFinite(before.cohesion)) before.cohesion = 50;
    var changed = false;
    var infDelta = impact.influenceDelta == null ? 0 : clamp(impact.influenceDelta, -20, 20);
    var cohDelta = impact.cohesionDelta == null ? 0 : clamp(impact.cohesionDelta, -20, 20);
    if (infDelta) {
      party.influence = Math.round(clamp(before.influence + infDelta, 0, 100) * 100) / 100;
      recordFieldChange(root, 'parties', partyNameOf(party), 'influence', before.influence, party.influence, reason);
      changed = true;
    }
    if (cohDelta) {
      party.cohesion = Math.round(clamp(before.cohesion + cohDelta, 0, 100) * 100) / 100;
      recordFieldChange(root, 'parties', partyNameOf(party), 'cohesion', before.cohesion, party.cohesion, reason);
      changed = true;
    }
    if (impact.currentAgenda) {
      party.currentAgenda = impact.currentAgenda;
      changed = true;
    }
    if (impact.shortGoal) {
      party.shortGoal = impact.shortGoal;
      changed = true;
    }
    if (impact.status) {
      party.status = impact.status;
      changed = true;
    }
    if (!changed) return null;
    pushHistory(party, 'agenda_history', {
      turn: turn,
      source: options.source || signal.sourceSystem,
      reason: reason,
      currentAgenda: impact.currentAgenda || '',
      shortGoal: impact.shortGoal || ''
    });
    pushHistory(party, '_socialPoliticalHistory', {
      turn: turn,
      signalId: signal.id,
      sourceSystem: signal.sourceSystem,
      kind: signal.kind,
      reason: reason,
      impact: clone(impact)
    });
    try {
      if (TM.PartyGoals && typeof TM.PartyGoals.setGoal === 'function') {
        if (impact.currentAgenda) {
          TM.PartyGoals.setGoal(root, party, {
            kind: 'currentAgenda',
            type: 'currentAgenda',
            text: impact.currentAgenda,
            priority: 82,
            generatedFrom: 'social-political-signal'
          }, {
            turn: turn,
            source: options.source || signal.sourceSystem,
            expiresTurn: turn + 6,
            generatedFrom: 'social-political-signal'
          });
        }
        if (impact.shortGoal) {
          TM.PartyGoals.setGoal(root, party, {
            kind: 'shortGoal',
            type: 'shortGoal',
            text: impact.shortGoal,
            priority: 74,
            generatedFrom: 'social-political-signal'
          }, {
            turn: turn,
            source: options.source || signal.sourceSystem,
            expiresTurn: turn + 4,
            generatedFrom: 'social-political-signal'
          });
        }
      }
    } catch (_) {}
    return {
      partyName: partyNameOf(party),
      before: before,
      after: { influence: party.influence, cohesion: party.cohesion }
    };
  }

  function applyRelationAdjustment(root, signal, adjustment, options) {
    if (!TM.PartyGoals || typeof TM.PartyGoals.applyDynamicRelationAdjustment !== 'function') return null;
    var turn = Number(options.turn != null ? options.turn : signal.turn) || 0;
    return TM.PartyGoals.applyDynamicRelationAdjustment(root, {
      className: adjustment.className,
      party: adjustment.party,
      affinityDelta: adjustment.affinityDelta == null ? 0 : clamp(adjustment.affinityDelta, -30, 30),
      trustDelta: adjustment.trustDelta == null ? 0 : clamp(adjustment.trustDelta, -20, 20),
      grievanceDelta: adjustment.grievanceDelta == null ? 0 : clamp(adjustment.grievanceDelta, -20, 20),
      emergent: adjustment.emergent !== false,
      reason: adjustment.reason || signal.reason || signal.kind
    }, {
      turn: turn,
      source: options.source || signal.sourceSystem,
      emergent: adjustment.emergent !== false
    });
  }

  function applySignal(root, signal, options) {
    options = options || {};
    var summary = { classes: 0, parties: 0, relations: 0, goals: 0, classResults: [], partyResults: [], relationResults: [] };
    try {
      if (TM.MinxinLedger && typeof TM.MinxinLedger.recordFromSocialSignal === 'function') {
        var minxinSignal = TM.MinxinLedger.recordFromSocialSignal(root, signal, {
          source: options.source || signal.sourceSystem,
          turn: options.turn || signal.turn
        });
        if (minxinSignal) summary.minxinLedger = true;
      }
    } catch (_) {}
    try {
      if (!options.skipScenarioMaintenance && TM.PartyGoals && typeof TM.PartyGoals.buildScenarioRelationIndex === 'function') {
        TM.PartyGoals.buildScenarioRelationIndex(root, { turn: options.turn || signal.turn, source: options.source || signal.sourceSystem });
      }
    } catch (_) {}
    signal.affectedClasses.forEach(function(impact) {
      var result = applyClassImpact(root, signal, impact, options);
      if (result) {
        summary.classes++;
        summary.classResults.push(result);
      }
    });
    signal.affectedParties.forEach(function(impact) {
      var result = applyPartyImpact(root, signal, impact, options);
      if (result) {
        summary.parties++;
        summary.partyResults.push(result);
      }
    });
    signal.relationAdjustments.forEach(function(adjustment) {
      var result = applyRelationAdjustment(root, signal, adjustment, options);
      if (result) {
        summary.relations++;
        summary.relationResults.push(result);
      }
    });
    try {
      if (!options.skipScenarioMaintenance && TM.PartyGoals && typeof TM.PartyGoals.deriveFromClassDemands === 'function') {
        var derived = TM.PartyGoals.deriveFromClassDemands(root, { turn: options.turn || signal.turn, source: (options.source || signal.sourceSystem) + '-derive' });
        summary.goals += toArray(derived && derived.sourceGoals).length + toArray(derived && derived.counterGoals).length;
      }
    } catch (_) {}
    return summary;
  }

  // 2026-06-10·性能:审计账本摘要化。applyPending 原把每个 signal 的完整应用结果深拷三份
  // (total.results + 账本 clone(total) + 调度器 lastRun)·classResults[].coupling / relationResults
  // 内嵌整棵关系/证据结构·真存档实测每回合涨 2~7MB(40 条 cap 形同虚设·存档/deepClone/IPC 全被拖累)·
  // 且 clone=JSON 往返·单次 applyPending 实测 ~950ms 主线程尖刺。
  // 账本只承担审计职责:运行时无人读深结构(右栏读 _socialPoliticalSignals.items·调度器 formatForPrompt
  // 只读标量·smoke 只断言计数)·故只留标量摘要(计数+名称+before/after)·深结构不入账。
  function digestImpactRow(r) {
    if (!r || typeof r !== 'object') return r == null ? null : r;
    var slim = {};
    Object.keys(r).forEach(function(k) {
      var v = r[k];
      if (v == null || typeof v === 'number' || typeof v === 'boolean') { slim[k] = v; return; }
      if (typeof v === 'string') { slim[k] = v.length > 160 ? v.slice(0, 160) : v; return; }
      if (k === 'before' || k === 'after') {
        var bo = {};
        Object.keys(v).forEach(function(k2) {
          var v2 = v[k2];
          if (v2 == null || typeof v2 === 'number' || typeof v2 === 'boolean' || typeof v2 === 'string') bo[k2] = v2;
        });
        slim[k] = bo;
        return;
      }
      if (k === 'coupling') { slim.couplingParties = toArray(v && v.applied).length; return; }
      // 其余深结构(edge/evidence/mirror 等)一律不入账本
    });
    if (slim.couplingParties == null && typeof r.couplingParties === 'number') slim.couplingParties = r.couplingParties;
    return slim;
  }
  function digestApplyResult(result) {
    if (!result || typeof result !== 'object') return result == null ? null : result;
    return {
      classes: Number(result.classes) || 0,
      parties: Number(result.parties) || 0,
      relations: Number(result.relations) || 0,
      goals: Number(result.goals) || 0,
      classResults: toArray(result.classResults).slice(0, 12).map(digestImpactRow),
      partyResults: toArray(result.partyResults).slice(0, 12).map(digestImpactRow),
      relationResults: toArray(result.relationResults).slice(0, 12).map(digestImpactRow)
    };
  }

  function applyPending(root, options) {
    root = pickRoot(root);
    options = options || {};
    var store = ensureStore(root);
    var total = { signals: 0, classes: 0, parties: 0, relations: 0, goals: 0, results: [] };
    // 2026-06-06·整剧本级 PartyGoals 维护(buildScenarioRelationIndex/deriveFromClassDemands)从「每signal一次」提到整批一次·治过回合 applyPending 卡顿
    var _turn = Number(options.turn != null ? options.turn : root.turn) || 0;
    var _src = options.source || 'social-political-signal';
    var _hasPending = store.items.some(function(s){ return s && s.applied !== true; });
    if (_hasPending) { try { if (TM.PartyGoals && typeof TM.PartyGoals.buildScenarioRelationIndex === 'function') TM.PartyGoals.buildScenarioRelationIndex(root, { turn: _turn, source: _src }); } catch (_) {} }
    var _signalOptions = Object.assign({}, options, { skipScenarioMaintenance: true, deferLedgerFinalize: true });
    store.items.forEach(function(signal) {
      if (!signal || signal.applied === true) return;
      var result = applySignal(root, signal, _signalOptions);
      signal.applied = true;
      signal.appliedTurn = Number(options.turn != null ? options.turn : root.turn) || 0;
      signal.appliedSource = options.source || 'social-political-signal';
      total.signals++;
      total.classes += result.classes;
      total.parties += result.parties;
      total.relations += result.relations;
      total.goals += result.goals;
      total.results.push({ signalId: signal.id, result: digestApplyResult(result) });
    });
    // 2026-06-10·批末收口:循环内 deferLedgerFinalize 跳过的 aggregateTrue/rebuildMatrix/updatePerception
    // 在此一次补齐(无欠账时 no-op)·治逐笔全量重建矩阵的主线程冻结
    try {
      if (TM.MinxinLedger && typeof TM.MinxinLedger.finalizeBatch === 'function') {
        TM.MinxinLedger.finalizeBatch(root, { turn: _turn, source: _src });
      }
    } catch (_) {}
    if (total.signals > 0) {
      try {
        if (TM.PartyGoals && typeof TM.PartyGoals.deriveFromClassDemands === 'function') {
          var _derived = TM.PartyGoals.deriveFromClassDemands(root, { turn: _turn, source: _src + '-derive' });
          total.goals += toArray(_derived && _derived.sourceGoals).length + toArray(_derived && _derived.counterGoals).length;
        }
      } catch (_) {}
    }
    store.stats.applied = (Number(store.stats.applied) || 0) + total.signals;
    if (!Array.isArray(root._socialPoliticalSignalApplications)) root._socialPoliticalSignalApplications = [];
    if (total.signals > 0) {
      root._socialPoliticalSignalApplications.push({
        turn: Number(options.turn != null ? options.turn : root.turn) || 0,
        source: options.source || 'social-political-signal',
        summary: clone(total),
        at: Date.now()
      });
      if (root._socialPoliticalSignalApplications.length > 40) root._socialPoliticalSignalApplications = root._socialPoliticalSignalApplications.slice(-40);
      root._socialPoliticalSignalsUiDirty = true;
    }
    // 一次性削平旧存档遗留的整结果深拷账本(读档削平范式·条目已 slim 时近零成本·idempotent)
    if (Array.isArray(root._socialPoliticalSignalApplications)) {
      root._socialPoliticalSignalApplications.forEach(function(entry) {
        var s = entry && entry.summary;
        if (!s || !Array.isArray(s.results)) return;
        s.results = s.results.slice(0, 40).map(function(row) {
          if (!row || typeof row !== 'object') return row;
          return { signalId: row.signalId, result: digestApplyResult(row.result) };
        });
      });
    }
    return total;
  }

  function snapshot(root, options) {
    root = pickRoot(root);
    options = options || {};
    var store = ensureStore(root);
    var limit = Math.max(1, Math.min(60, Number(options.limit || 12) || 12));
    var recent = store.items.slice(-limit).map(clone);
    var bySystem = {};
    var pending = 0;
    store.items.forEach(function(signal) {
      if (!signal) return;
      var key = signal.sourceSystem || 'unknown';
      bySystem[key] = (bySystem[key] || 0) + 1;
      if (signal.applied !== true) pending++;
    });
    return {
      turn: Number(root.turn) || 0,
      count: store.items.length,
      pending: pending,
      seq: Number(store.seq) || 0,
      bySystem: bySystem,
      recent: recent,
      stats: clone(store.stats)
    };
  }

  function signedDelta(v) {
    var n = Number(v);
    if (!isFinite(n) || !n) return '';
    n = round2(n);
    return (n > 0 ? '+' : '') + String(n);
  }

  function pushDeltaSummary(parts, label, value) {
    var text = signedDelta(value);
    if (text) parts.push(label + ' ' + text);
  }

  function signalSourceLabel(signal) {
    var hay = [
      signal && signal.sourceSystem,
      signal && signal.kind,
      signal && signal.appliedSource
    ].map(function(x) { return String(x || '').toLowerCase(); }).join(' ');
    if (/turn-result/.test(hay)) return '本回合推演';
    if (/player-action|player|desk|edict|memorial|letter|shizheng|hongyan|奏疏|诏|传书|问对/.test(hay)) return '玩家操作';
    if (/court|tinyi|chaoyi|ruling|issue|廷议|朝议|裁决/.test(hay)) return '廷议结果';
    if (/llm|calibrator|calibration/.test(hay)) return 'LLM校准';
    if (/fiscal|tax|military|local|keju|office|runtime|event|pressure|signal|class|party/.test(hay)) return '系统压力';
    return compact(signal && signal.sourceSystem || '信号', 24);
  }

  function unrestDeltaSummary(unrestDelta) {
    if (!unrestDelta || typeof unrestDelta !== 'object') return '';
    var labels = {
      grievance: '怨气',
      petition: '请愿',
      strike: '罢工',
      revolt: '民变',
      unrest: '动荡'
    };
    return Object.keys(unrestDelta).map(function(k) {
      var text = signedDelta(unrestDelta[k]);
      return text ? ((labels[k] || k) + ' ' + text) : '';
    }).filter(Boolean).join('；');
  }

  function impactSummaryForCause(actorType, impact, relations, signal) {
    var parts = [];
    impact = impact || {};
    if (actorType === 'party') {
      pushDeltaSummary(parts, '影响', impact.influenceDelta);
      pushDeltaSummary(parts, '凝聚', impact.cohesionDelta);
      if (impact.currentAgenda) parts.push('议程 ' + compact(impact.currentAgenda, 42));
      if (impact.shortGoal) parts.push('目标 ' + compact(impact.shortGoal, 42));
      if (impact.status) parts.push('状态 ' + compact(impact.status, 28));
    } else {
      pushDeltaSummary(parts, '满意', impact.satisfactionDelta);
      pushDeltaSummary(parts, '影响', impact.influenceDelta);
      var unrest = unrestDeltaSummary(impact.unrestDelta);
      if (unrest) parts.push(unrest);
      if (impact.demand) parts.push('诉求 ' + compact(impact.demand, 42));
      if (impact.status) parts.push('状态 ' + compact(impact.status, 28));
    }
    toArray(relations).forEach(function(rel) {
      var relParts = [];
      pushDeltaSummary(relParts, '亲和', rel && rel.affinityDelta);
      pushDeltaSummary(relParts, '信任', rel && rel.trustDelta);
      pushDeltaSummary(relParts, '怨气', rel && rel.grievanceDelta);
      if (relParts.length) parts.push('关系 ' + relParts.join('/'));
    });
    if (!parts.length && impact.reason) parts.push(compact(impact.reason, 72));
    if (!parts.length && signal && signal.reason) parts.push(compact(signal.reason, 72));
    return parts.join('；');
  }

  function relationMatchesActor(rel, actorType, classTarget, partyTarget) {
    if (!rel) return false;
    if (actorType === 'party') return normalizeName(rel.party) === partyTarget;
    if (actorType === 'relation') {
      return (!classTarget || normalizeName(rel.className) === classTarget)
        && (!partyTarget || normalizeName(rel.party) === partyTarget);
    }
    return normalizeName(rel.className) === classTarget;
  }

  function getCauseTargets(actorType, actorId) {
    actorType = String(actorType || '').toLowerCase();
    var out = { actorType: actorType, classTarget: '', partyTarget: '', actorName: '' };
    if (actorId && typeof actorId === 'object') {
      out.classTarget = normalizeName(classNameOf(actorId) || actorId.className || actorId.sourceClass);
      out.partyTarget = normalizeName(partyNameOf(actorId) || actorId.party || actorId.partyName || actorId.sourceParty);
      out.actorName = classNameOf(actorId) || partyNameOf(actorId) || actorId.name || actorId.id || '';
    } else if (actorType === 'party') {
      out.partyTarget = normalizeName(actorId);
      out.actorName = String(actorId || '');
    } else {
      out.classTarget = normalizeName(actorId);
      out.actorName = String(actorId || '');
    }
    return out;
  }

  function getRecentCauses(root, actorType, actorId, options) {
    root = pickRoot(root);
    options = options || {};
    var store = ensureStore(root);
    var targets = getCauseTargets(actorType, actorId);
    var limit = Math.max(1, Math.min(20, Number(options.limit || 6) || 6));
    var out = [];
    store.items.forEach(function(signal) {
      if (!signal) return;
      var direct = null;
      if (targets.actorType === 'party') {
        direct = toArray(signal.affectedParties).filter(function(x) { return normalizeName(x && x.name) === targets.partyTarget; })[0] || null;
      } else if (targets.actorType === 'relation') {
        direct = null;
      } else {
        direct = toArray(signal.affectedClasses).filter(function(x) { return normalizeName(x && x.name) === targets.classTarget; })[0] || null;
      }
      var relations = toArray(signal.relationAdjustments).filter(function(rel) {
        return relationMatchesActor(rel, targets.actorType, targets.classTarget, targets.partyTarget);
      });
      if (!direct && !relations.length) return;
      var summary = impactSummaryForCause(targets.actorType, direct, relations, signal);
      out.push({
        id: signal.id,
        turn: signal.turn,
        seq: signal.seq,
        sourceSystem: signal.sourceSystem,
        sourceLabel: signalSourceLabel(signal),
        kind: signal.kind,
        reason: signal.reason,
        linkedIssue: signal.linkedIssue,
        intensity: signal.intensity,
        confidence: signal.confidence,
        applied: signal.applied === true,
        appliedTurn: signal.appliedTurn,
        appliedSource: signal.appliedSource,
        actorType: targets.actorType,
        actorName: targets.actorName,
        summary: summary,
        evidence: clone(signal.evidence || [])
      });
    });
    out.sort(function(a, b) {
      var at = Number(a.turn) || 0;
      var bt = Number(b.turn) || 0;
      if (at !== bt) return bt - at;
      return (Number(b.seq) || 0) - (Number(a.seq) || 0);
    });
    return out.slice(0, limit).map(clone);
  }

  function round2(n) {
    n = Number(n);
    if (!isFinite(n)) n = 0;
    return Math.round(n * 100) / 100;
  }

  function tuneNumber(root, path, fallback) {
    try {
      if (TM.PartyClassTuning && typeof TM.PartyClassTuning.number === 'function') {
        return TM.PartyClassTuning.number(root, path, fallback);
      }
    } catch (_) {}
    return fallback;
  }

  function isResolvedCourtStatus(status) {
    return /issued|reissued|resolved|fulfilled|closed|done|approved|enacted/.test(String(status || '').toLowerCase());
  }

  function issueKeyOf(row) {
    return [
      row && row.id,
      row && row.issueId,
      row && row.topicId,
      row && row.chaoyiTrackId,
      row && row.linkedIssue,
      row && row.topic,
      row && row.title
    ].map(function(x) { return normalizeName(x); }).filter(Boolean);
  }

  function findResolvedCourtRecord(root, signal) {
    var linked = normalizeName(signal && signal.linkedIssue);
    var reason = normalizeName(signal && (signal.reason || signal.kind));
    if (!linked && !reason) return null;
    var lists = [
      root && root._courtRecords,
      root && root.tinyiSeals,
      root && root.recentChaoyi,
      root && root._partyClassCourtIssues
    ];
    var found = null;
    lists.forEach(function(list) {
      if (found) return;
      toArray(list).forEach(function(row) {
        if (!row || found) return;
        var status = row.sealStatus || row.status || row.result || row.outcome || '';
        if (!isResolvedCourtStatus(status)) return;
        var keys = issueKeyOf(row);
        var matched = linked && keys.some(function(k) { return k === linked || k.indexOf(linked) >= 0 || linked.indexOf(k) >= 0; });
        if (!matched && reason) {
          matched = keys.some(function(k) { return k && reason.indexOf(k) >= 0; });
        }
        if (matched) found = row;
      });
    });
    return found;
  }

  function actorMemoryFromEscalation(root, signal, turn, sourceName) {
    var written = 0;
    if (!TM.PartyClassActors || typeof TM.PartyClassActors.remember !== 'function') return written;
    var expiry = turn + 4;
    toArray(signal.affectedClasses).forEach(function(impact) {
      var className = impact && impact.name;
      if (!className) return;
      try {
        TM.PartyClassActors.remember(root, {
          turn: signal.turn,
          actorType: 'class',
          actorId: className,
          agenda: impact.demand || signal.reason || signal.kind,
          grievance: signal.reason || signal.kind,
          belief: 'unresolved pressure escalates if no court response arrives',
          source: sourceName,
          confidence: signal.confidence,
          expiry: expiry,
          linkedIssue: signal.linkedIssue || ''
        });
        written++;
      } catch (_) {}
    });
    toArray(signal.affectedParties).forEach(function(impact) {
      var partyName = impact && impact.name;
      if (!partyName) return;
      try {
        TM.PartyClassActors.remember(root, {
          turn: signal.turn,
          actorType: 'party',
          actorId: partyName,
          agenda: impact.shortGoal || impact.currentAgenda || signal.reason || signal.kind,
          grievance: signal.reason || signal.kind,
          belief: 'party pressure hardens around unresolved class/court issue',
          source: sourceName,
          confidence: signal.confidence,
          expiry: expiry,
          linkedIssue: signal.linkedIssue || ''
        });
        written++;
      } catch (_) {}
    });
    return written;
  }

  function decayAndResolve(root, options) {
    root = pickRoot(root);
    options = options || {};
    var store = ensureStore(root);
    var turn = Number(options.turn != null ? options.turn : root.turn) || 0;
    var decayPerTurn = Number(options.decayPerTurn != null ? options.decayPerTurn : tuneNumber(root, 'socialSignals.decayPerTurn', 0.035));
    if (!isFinite(decayPerTurn) || decayPerTurn < 0) decayPerTurn = 0.035;
    var confidenceDecayCap = Number(options.confidenceDecayCap != null ? options.confidenceDecayCap : tuneNumber(root, 'socialSignals.confidenceDecayCap', 0.32));
    if (!isFinite(confidenceDecayCap) || confidenceDecayCap < 0) confidenceDecayCap = 0.32;
    var escalateAfter = Number(options.escalateAfter != null ? options.escalateAfter : tuneNumber(root, 'socialSignals.escalationAfter', 3));
    if (!isFinite(escalateAfter)) escalateAfter = 3;
    var expireAfter = Number(options.expireAfter != null ? options.expireAfter : tuneNumber(root, 'socialSignals.expireAfter', 10));
    if (!isFinite(expireAfter)) expireAfter = 10;
    var escalationIntensity = Number(options.escalationIntensity != null ? options.escalationIntensity : tuneNumber(root, 'socialSignals.escalationIntensity', 0.65));
    if (!isFinite(escalationIntensity)) escalationIntensity = 0.65;
    var resolvedIntensityFactor = tuneNumber(root, 'socialSignals.resolvedIntensityFactor', 0.35);
    var resolvedConfidenceFactor = tuneNumber(root, 'socialSignals.resolvedConfidenceFactor', 0.65);
    var summary = { turn: turn, resolved: 0, decayed: 0, expired: 0, escalated: 0, memories: 0 };
    if (!Array.isArray(root._socialPoliticalSignalEscalations)) root._socialPoliticalSignalEscalations = [];
    store.items.forEach(function(signal) {
      if (!signal || signal.expired === true) return;
      var age = Math.max(0, turn - (Number(signal.turn) || turn));
      var court = findResolvedCourtRecord(root, signal);
      if (court && signal.resolved !== true) {
        signal.resolved = true;
        signal.resolvedTurn = turn;
        signal.resolutionSource = 'court-record';
        signal.resolution = {
          topic: court.topic || court.title || '',
          status: court.sealStatus || court.status || court.result || '',
          grade: court.grade || ''
        };
        signal.intensity = round2(clamp((Number(signal.intensity) || 0) * resolvedIntensityFactor, 0, 1));
        signal.confidence = round2(clamp((Number(signal.confidence) || 0) * resolvedConfidenceFactor, 0, 1));
        summary.resolved++;
        summary.decayed++;
        return;
      }
      if (age > 0 && signal.resolved !== true) {
        var oldConfidence = Number(signal.confidence);
        if (!isFinite(oldConfidence)) oldConfidence = 0.7;
        var nextConfidence = round2(clamp(oldConfidence - Math.min(confidenceDecayCap, age * decayPerTurn), 0.08, 1));
        if (nextConfidence !== oldConfidence) {
          signal.confidence = nextConfidence;
          summary.decayed++;
        }
      }
      if (age >= expireAfter && Number(signal.intensity) < 0.45) {
        signal.expired = true;
        signal.expiredTurn = turn;
        summary.expired++;
        return;
      }
      if (signal.applied === true && signal.resolved !== true && signal.escalated !== true && age >= escalateAfter && Number(signal.intensity) >= escalationIntensity) {
        signal.escalated = true;
        signal.escalatedTurn = turn;
        signal.escalationSource = options.source || 'social-political-signal-decay';
        var escalation = {
          turn: turn,
          signalId: signal.id,
          linkedIssue: signal.linkedIssue || '',
          sourceSystem: signal.sourceSystem,
          kind: signal.kind,
          intensity: signal.intensity,
          confidence: signal.confidence,
          affectedClasses: toArray(signal.affectedClasses).map(function(x) { return x && x.name; }).filter(Boolean),
          affectedParties: toArray(signal.affectedParties).map(function(x) { return x && x.name; }).filter(Boolean),
          reason: signal.reason || ''
        };
        root._socialPoliticalSignalEscalations.push(escalation);
        if (root._socialPoliticalSignalEscalations.length > 80) root._socialPoliticalSignalEscalations = root._socialPoliticalSignalEscalations.slice(-80);
        summary.escalated++;
        summary.memories += actorMemoryFromEscalation(root, signal, turn, 'social-political-signal-escalation');
      }
    });
    if (!Array.isArray(root._socialPoliticalSignalMaintenance)) root._socialPoliticalSignalMaintenance = [];
    root._socialPoliticalSignalMaintenance.push({
      turn: turn,
      source: options.source || 'social-political-signal-maintenance',
      summary: clone(summary),
      at: Date.now()
    });
    if (root._socialPoliticalSignalMaintenance.length > 40) root._socialPoliticalSignalMaintenance = root._socialPoliticalSignalMaintenance.slice(-40);
    if (summary.resolved || summary.decayed || summary.expired || summary.escalated) root._socialPoliticalSignalsUiDirty = true;
    return summary;
  }

  function classSearchText(cls) {
    return [
      classNameOf(cls),
      cls && cls.className,
      cls && cls.id,
      cls && cls.demands,
      cls && cls.currentDemand,
      cls && cls.currentAgenda,
      cls && cls.shortGoal,
      cls && cls.economicRole,
      cls && cls.status,
      cls && cls.description,
      cls && cls.desc,
      toArray(cls && (cls.tags || cls.labels || cls.keywords)).join(' '),
      toArray(cls && (cls.aliases || cls.alias || cls.altNames || cls.otherNames)).join(' ')
    ].map(textOf).join(' ').toLowerCase();
  }

  function scoreClassForTokens(cls, tokens) {
    var text = classSearchText(cls);
    var score = 0;
    tokens.forEach(function(token) {
      token = String(token || '').toLowerCase();
      if (!token) return;
      if (text.indexOf(token) >= 0) score += token.length >= 4 ? 3 : 2;
    });
    return score;
  }

  function inferClassImpacts(root, tokens, buildImpact) {
    return getClasses(root).map(function(cls) {
      if (!cls) return null;
      var score = scoreClassForTokens(cls, tokens || []);
      try {
        if (TM.PartyClassEcology && typeof TM.PartyClassEcology.scoreClass === 'function') {
          score = Math.max(score, Number(TM.PartyClassEcology.scoreClass(root, cls, tokens || [])) || 0);
        }
      } catch (_) {}
      if (score <= 0) return null;
      var impact = buildImpact(cls, score);
      if (!impact) return null;
      impact.name = impact.name || classNameOf(cls);
      return impact;
    }).filter(Boolean);
  }

  function partySearchText(party) {
    return [
      partyNameOf(party),
      party && party.partyName,
      party && party.id,
      party && party.currentAgenda,
      party && party.shortGoal,
      party && party.longGoal,
      party && party.ideology,
      party && party.stance,
      party && party.description,
      party && party.desc,
      toArray(party && (party.tags || party.labels || party.keywords)).join(' '),
      toArray(party && (party.aliases || party.alias || party.altNames || party.otherNames)).join(' '),
      toArray(party && (party.socialBase || party.social_base || party.baseClasses)).join(' ')
    ].map(textOf).join(' ').toLowerCase();
  }

  function scorePartyForTokens(party, tokens) {
    var text = partySearchText(party);
    var score = 0;
    tokens.forEach(function(token) {
      token = String(token || '').toLowerCase();
      if (!token) return;
      if (text.indexOf(token) >= 0) score += token.length >= 4 ? 3 : 2;
    });
    return score;
  }

  function inferPartyImpacts(root, tokens, buildImpact) {
    return getParties(root).map(function(party) {
      if (!party) return null;
      var score = scorePartyForTokens(party, tokens || []);
      try {
        if (TM.PartyClassEcology && typeof TM.PartyClassEcology.scoreParty === 'function') {
          score = Math.max(score, Math.abs(Number(TM.PartyClassEcology.scoreParty(root, party, tokens || [])) || 0));
        }
      } catch (_) {}
      if (score <= 0) return null;
      var impact = buildImpact(party, score);
      if (!impact) return null;
      impact.name = impact.name || partyNameOf(party);
      return impact;
    }).filter(Boolean);
  }

  function readFirstFinite(list) {
    for (var i = 0; i < list.length; i += 1) {
      var n = Number(list[i]);
      if (isFinite(n)) return n;
    }
    return null;
  }

  function readMaxFinite(list) {
    var vals = [];
    list.forEach(function(v) {
      if (Array.isArray(v)) {
        v.forEach(function(x) {
          var n = Number(x);
          if (isFinite(n)) vals.push(n);
        });
        return;
      }
      var n = Number(v);
      if (isFinite(n)) vals.push(n);
    });
    if (!vals.length) return null;
    return Math.max.apply(Math, vals);
  }

  function readTaxPressure(root) {
    var fiscal = root && root.fiscal || {};
    return readFirstFinite([
      fiscal.taxPressureIndex,
      fiscal.taxPressure,
      fiscal.taxBurdenIndex,
      fiscal.levyPressure,
      root && root.taxPressureIndex
    ]);
  }

  function readForcedConscription(root) {
    var fiscal = root && root.fiscal || {};
    var military = root && root.military || {};
    var conscription = root && root.conscription || {};
    return readMaxFinite([
      fiscal.forcedLevyIndex,
      fiscal.forcedCorveeIndex,
      military.forcedConscriptionIndex,
      military.conscriptionPressure,
      conscription.forcedIndex,
      conscription.pressure,
      root && root.forcedConscriptionIndex
    ]);
  }

  function readKejuAdmissionShock(root) {
    var keju = root && (root.keju || (root.P && root.P.keju)) || {};
    var direct = readFirstFinite([keju.admissionShock, keju.admissionPressure, keju.admissionTension]);
    if (direct != null && isFinite(direct)) return direct;
    var rate = readFirstFinite([keju.admissionRate, keju.acceptanceRate, keju.passRate]);
    if (rate != null && isFinite(rate)) return rate <= 1 ? clamp((0.38 - rate) / 0.38, 0, 1) : clamp((38 - rate) / 38, 0, 1);
    var admitted = Number(keju.admitted != null ? keju.admitted : keju.admissionCount);
    var expected = Number(keju.expectedAdmission != null ? keju.expectedAdmission : keju.quota);
    if (isFinite(admitted) && isFinite(expected) && expected > 0) return clamp((0.45 - admitted / expected) / 0.45, 0, 1);
    return null;
  }

  function readOfficeDonation(root) {
    var office = root && root.office || {};
    var policy = root && root.policyPressure || {};
    return readFirstFinite([
      office.donationIntensity,
      office.donationPressure,
      office.donationOfficeIndex,
      policy.donationOfficeIndex,
      root && root.donationOfficeIndex
    ]);
  }

  function readPartyPurge(root) {
    var office = root && root.office || {};
    var politics = root && root.politics || {};
    var policy = root && root.policyPressure || {};
    return readFirstFinite([
      office.purgeIntensity,
      politics.purgeIntensity,
      politics.partyPurgeIndex,
      policy.partyPurgeIndex,
      root && root.partyPurgeIndex
    ]);
  }

  function readSamePartyAppointments(root) {
    var office = root && root.office || {};
    var appointments = office.samePartyAppointments || root && root.samePartyAppointments;
    var ratio = readFirstFinite([
      office.samePartyAppointmentRatio,
      office.samePartyRatio,
      root && root.samePartyAppointmentRatio
    ]);
    var party = textOf(office.dominantParty || office.appointmentParty || root && root.dominantAppointmentParty);
    if (Array.isArray(appointments) && appointments.length) {
      appointments.forEach(function(row) {
        if (!row || typeof row !== 'object') return;
        var r = readFirstFinite([row.ratio, row.share]);
        var count = Number(row.count);
        var total = Number(row.total);
        if (!isFinite(r) && isFinite(count) && isFinite(total) && total > 0) r = count / total;
        if (isFinite(r) && (!isFinite(ratio) || r > ratio)) {
          ratio = r;
          party = textOf(row.party || row.partyName || row.name || party);
        }
      });
    }
    if (ratio == null || !isFinite(ratio)) return null;
    return { ratio: ratio, party: party };
  }

  function readMilitaryArrears(root) {
    var military = root && root.military || {};
    var armies = toArray(root && (root.armies || root.troops || root.forces));
    var months = readMaxFinite([military.wageArrearsMonths, military.arrearsMonths, root && root.wageArrearsMonths]);
    var ratio = readMaxFinite([military.arrearsRatio, military.unpaidWageRatio, root && root.militaryArrearsRatio]);
    var mutiny = readMaxFinite([military.mutinyRisk, root && root.mutinyRisk, armies.map(function(a) { return a && (a.mutinyRisk != null ? a.mutinyRisk : a.mutiny); })]);
    var severity = null;
    if (months != null && isFinite(months)) severity = clamp(months / 5, 0, 1);
    if (ratio != null && isFinite(ratio)) severity = Math.max(severity || 0, ratio > 1 ? clamp(ratio / 100, 0, 1) : clamp(ratio, 0, 1));
    if (mutiny != null && isFinite(mutiny)) severity = Math.max(severity || 0, mutiny > 1 ? clamp(mutiny / 100, 0, 1) : clamp(mutiny, 0, 1));
    return severity;
  }

  function localMinxinRevoltSeverity(minxin) {
    var value = Number(minxin);
    if (!isFinite(value) || value >= 45) return null;
    return clamp(0.65 + ((45 - value) / 45) * 0.35, 0, 1);
  }

  function readLocalRevoltRisk(root) {
    var local = root && root.local || {};
    var vals = [
      local.revoltRisk,
      local.rebellionRisk,
      local.unrestRisk,
      root && root.revoltRisk,
      root && root.rebellionRisk
    ];
    toArray(root && (root.provinces || root.regions || root.divisions)).forEach(function(r) {
      if (!r || typeof r !== 'object') return;
      vals.push(r.revoltRisk, r.rebellionRisk, r.unrestRisk);
      var minxin = Number(r.minxinLocal != null ? r.minxinLocal : r.minxin);
      var minxinRisk = localMinxinRevoltSeverity(minxin);
      if (minxinRisk != null) vals.push(minxinRisk);
    });
    try {
      var leaves = [];
      var bridge = global.IntegrationBridge || (global.window && global.window.IntegrationBridge);
      if (bridge && typeof bridge.getLeafDivisions === 'function' && root && root.adminHierarchy) {
        leaves = bridge.getLeafDivisions(root.adminHierarchy, 'player') || [];
      } else {
        function walk(nodes) {
          toArray(nodes).forEach(function(node) {
            if (!node || typeof node !== 'object') return;
            var kids = toArray(node.children || node.divisions || node.subs);
            if (!kids.length) leaves.push(node);
            else walk(kids);
          });
        }
        var ah = root && root.adminHierarchy;
        if (ah && typeof ah === 'object') {
          if (Array.isArray(ah.divisions)) walk(ah.divisions);
          else Object.keys(ah).forEach(function(k) {
            var fac = ah[k];
            walk(fac && (fac.divisions || fac.children || fac.subs));
          });
        }
      }
      leaves.forEach(function(leaf) {
        var minxin = Number(leaf && (leaf.minxin != null ? leaf.minxin : leaf.minxinLocal));
        var minxinRisk = localMinxinRevoltSeverity(minxin);
        if (minxinRisk != null) vals.push(minxinRisk);
        vals.push(leaf && leaf.revoltRisk, leaf && leaf.rebellionRisk, leaf && leaf.unrestRisk);
      });
    } catch (_adminMinxinE) {}
    return readMaxFinite(vals);
  }

  function linkedIssueForTokens(root, tokens) {
    var issueLists = [
      root && root.currentIssues,
      root && root._pendingTinyiTopics,
      root && root.pendingTinyiTopics,
      root && root._partyClassCourtIssues,
      root && root._courtRecords
    ];
    var wanted = toArray(tokens).map(function(x) { return String(x || '').toLowerCase(); }).filter(Boolean);
    var best = null;
    issueLists.forEach(function(list) {
      toArray(list).forEach(function(issue) {
        if (!issue || best) return;
        var text = textOf([
          issue.id,
          issue.issueId,
          issue.topic,
          issue.title,
          issue.category,
          issue.tags,
          issue.content,
          issue.summary
        ]).toLowerCase();
        if (!text) return;
        for (var i = 0; i < wanted.length; i += 1) {
          if (text.indexOf(wanted[i]) >= 0) {
            best = issue.id || issue.issueId || issue.topic || issue.title || '';
            break;
          }
        }
      });
    });
    return compact(best, 100);
  }

  function readCorruptionIndex(root) {
    var c = root && root.corruption;
    if (typeof c === 'number' && isFinite(c)) return c;
    if (!c || typeof c !== 'object') return null;
    var values = [];
    ['trueIndex', 'overall', 'index', 'value'].forEach(function(k) {
      var n = Number(c[k]);
      if (isFinite(n)) values.push(n);
    });
    if (c.subDepts && typeof c.subDepts === 'object') {
      Object.keys(c.subDepts).forEach(function(k) {
        var row = c.subDepts[k];
        var n = Number(row && (row.true != null ? row.true : row.overall));
        if (isFinite(n)) values.push(n);
      });
    }
    if (!values.length) return null;
    return Math.max.apply(Math, values);
  }

  function readPeasantBurden(root) {
    var fiscal = root && root.fiscal;
    if (!fiscal || typeof fiscal !== 'object') return null;
    var direct = Number(fiscal._peasantBurdenAvg != null ? fiscal._peasantBurdenAvg : fiscal.peasantBurdenAvg);
    if (isFinite(direct)) return direct;
    var burden = fiscal.peasantBurden;
    if (!burden || typeof burden !== 'object') return null;
    var rows = Array.isArray(burden) ? burden : Object.keys(burden).map(function(k) { return burden[k]; });
    var vals = rows.map(function(row) {
      if (!row || typeof row !== 'object') return null;
      var ratio = Number(row.burdenRatio != null ? row.burdenRatio : row.ratio);
      if (isFinite(ratio)) return ratio;
      var actual = Number(row.peasantActual);
      var nominal = Number(row.nominalTax || row.officialReceived);
      if (isFinite(actual) && isFinite(nominal) && nominal > 0) return Math.max(0, actual / nominal - 1);
      return null;
    }).filter(function(v) { return isFinite(v); });
    if (!vals.length) return null;
    return vals.reduce(function(a, b) { return a + b; }, 0) / vals.length;
  }

  // W2b·国库紧张（破产/赤字）→ 牵动流民·农户（赈济救荒无力、欠饷积压）。读 GM.guoku 确定性态，
  //   与既有 fiscal-peasant-burden（民负/加派→农户）互补：那条管「负担重」，这条管「国库空·赈不起」。
  function readTreasuryStrain(root) {
    var gk = root && root.guoku;
    if (!gk || typeof gk !== 'object') return null;
    var bk = gk.bankruptcy;
    if (bk && bk.active) {                                  // 破产态最重（与 guoku-engine.checkBankruptcy 同源）
      var sev = Number(bk.severity);
      sev = isFinite(sev) && sev > 0 ? (sev > 1 ? sev / 100 : sev) : 0.85;   // severity 容 0-1 或 0-100 两种口径
      return { severity: clamp(sev, 0.5, 1), cause: '帑廪告罄·国库破产', trigger: 'bankruptcy' };
    }
    var bal = Number(gk.balance);
    var annual = Number(gk.annualIncome) || (Number(gk.monthlyIncome) || 0) * 12 || 0;
    if (isFinite(bal) && bal < 0 && annual > 0) {
      var deficitRatio = -bal / annual;                    // = 赤字/年入·与 guoku-engine:835 同口径
      var thr = tuneNumber(root, 'socialSignals.thresholds.treasuryDeficit', 0.15);
      if (deficitRatio >= thr) {
        return { severity: clamp(deficitRatio / 0.5, 0, 1), cause: '国库赤字·岁入不抵岁出', trigger: 'deficit' };  // 国库赤字·岁入不抵岁出
      }
    }
    return null;
  }

  function scanKey(root, source, kind, turn) {
    return [turn || 0, source || 'runtime-pressure', kind || 'signal'].join(':');
  }

  function shouldScanRecord(root, source, kind, turn) {
    if (!root._socialPoliticalPressureScanKeys || typeof root._socialPoliticalPressureScanKeys !== 'object') root._socialPoliticalPressureScanKeys = {};
    var key = scanKey(root, source, kind, turn);
    if (root._socialPoliticalPressureScanKeys[key]) return false;
    root._socialPoliticalPressureScanKeys[key] = true;
    return true;
  }

  function scanRuntimePressures(root, options) {
    root = pickRoot(root);
    options = options || {};
    var source = options.source || 'runtime-pressure-scan';
    var turn = Number(options.turn != null ? options.turn : root.turn) || 0;
    var out = { recorded: 0, kinds: [], signals: [] };
    function emit(kind, raw) {
      raw = raw || {};
      raw.kind = kind;
      raw.sourceSystem = raw.sourceSystem || source;
      raw.turn = turn;
      raw.linkedIssue = raw.linkedIssue || linkedIssueForTokens(root, toArray(raw.tags).concat([kind, raw.reason]));
      if (!toArray(raw.affectedClasses).length && !toArray(raw.affectedParties).length && !toArray(raw.relationAdjustments).length) return;
      if (!shouldScanRecord(root, source, kind, turn)) return;
      var signal = record(root, raw);
      out.recorded++;
      out.kinds.push(kind);
      out.signals.push(signal);
    }

    var burden = readPeasantBurden(root);
    var burdenThreshold = tuneNumber(root, 'socialSignals.thresholds.peasantBurden', 0.7);
    if (isFinite(burden) && burden >= burdenThreshold) {
      var bSeverity = clamp((burden - 0.65) / 0.35, 0, 1);
      emit('fiscal-peasant-burden', {
        tags: ['fiscal', 'tax', 'corvee', 'peasant'],
        intensity: bSeverity,
        confidence: 0.88,
        reason: 'Runtime fiscal data shows high rural tax or corvee burden.',
        affectedClasses: inferClassImpacts(root, ['peasant', 'farmer', 'rural', 'household', 'tax', 'corvee', 'agriculture', '\u519c', '\u6c11', '\u5f79', '\u7a0e'], function() {
          return {
            satisfactionDelta: -Math.max(3, Math.round(4 + bSeverity * 6)),
            influenceDelta: bSeverity >= 0.7 ? 1 : 0,
            unrestDelta: { grievance: -Math.round(3 + bSeverity * 5), petition: -Math.round(2 + bSeverity * 4) },
            demand: 'reduce tax and corvee burden',
            reason: 'high rural burden'
          };
        })
      });
    }

    var taxPressure = readTaxPressure(root);
    var taxPressureThreshold = tuneNumber(root, 'socialSignals.thresholds.taxPressure', 0.7);
    var taxPressureBase = tuneNumber(root, 'socialSignals.severityBases.taxPressure', 0.65);
    if (isFinite(taxPressure) && taxPressure >= taxPressureThreshold) {
      var tSeverity = clamp((taxPressure - taxPressureBase) / Math.max(0.01, 1 - taxPressureBase), 0, 1);
      emit('tax-pressure', {
        tags: ['fiscal', 'tax', 'levy', 'peasant', 'merchant'],
        intensity: tSeverity,
        confidence: 0.84,
        reason: 'Runtime fiscal data shows high tax pressure.',
        affectedClasses: inferClassImpacts(root, ['tax', 'levy', 'fee', 'peasant', 'farmer', 'rural', 'merchant', 'guild', '\u7a0e', '\u8d4b', '\u9977', '\u5546', '\u6c11'], function() {
          return {
            satisfactionDelta: -Math.max(2, Math.round(2 + tSeverity * 5)),
            influenceDelta: tSeverity >= 0.75 ? 1 : 0,
            unrestDelta: { grievance: -Math.round(2 + tSeverity * 4), petition: -Math.round(1 + tSeverity * 3) },
            demand: 'reduce tax and levy pressure',
            reason: 'tax pressure'
          };
        })
      });
    }

    // W2b·国库紧张（破产/赤字）→ 牵动流民·农户。带 cause 上游因 → WorldDigest 串「因→致→果→牵动」因果链（W2c）。
    var strain = readTreasuryStrain(root);
    if (strain) {
      var sSeverity = strain.severity;
      emit('treasury-strain', {
        tags: ['fiscal', 'treasury', 'deficit', 'relief', 'refugee'],
        intensity: sSeverity,
        confidence: 0.86,
        cause: strain.cause,
        // reason=下游后果（不复述 cause 里的「国库赤字/告罄」，避免链条重复）
        reason: strain.trigger === 'bankruptcy' ? '府库一空，赈济停摆、边饷断绝、民生失养' : '赈济救荒无力、欠饷积压，民生渐困',
        affectedClasses: inferClassImpacts(root, ['refugee', 'famine', 'relief', 'displaced', 'poor', 'peasant', 'rural', 'household', '流民', '灾民', '赈', '农', '民', '贫'], function() {
          return {
            satisfactionDelta: -Math.max(3, Math.round(3 + sSeverity * 6)),
            influenceDelta: 0,
            unrestDelta: { grievance: -Math.round(3 + sSeverity * 5), petition: -Math.round(2 + sSeverity * 3) },
            demand: 'state relief and back-pay',
            reason: 'treasury strain cuts relief capacity'
          };
        })
      });
    }

    var conscription = readForcedConscription(root);
    var conscriptionThreshold = tuneNumber(root, 'socialSignals.thresholds.forcedConscription', 0.65);
    if (isFinite(conscription) && conscription >= conscriptionThreshold) {
      var csSeverity = clamp((conscription - 0.6) / 0.4, 0, 1);
      emit('forced-conscription', {
        sourceSystem: 'military',
        tags: ['military', 'conscription', 'corvee', 'levy', 'soldier', 'peasant'],
        intensity: csSeverity,
        confidence: 0.8,
        reason: 'Runtime data shows forced conscription or heavy corvee extraction.',
        affectedClasses: inferClassImpacts(root, ['conscription', 'conscript', 'corvee', 'levy', 'soldier', 'military', 'peasant', 'farmer', 'rural', '\u5f3a\u5f81', '\u5f81\u53d1', '\u5f79', '\u5175', '\u519b'], function() {
          return {
            satisfactionDelta: -Math.max(3, Math.round(3 + csSeverity * 6)),
            influenceDelta: csSeverity >= 0.75 ? 1 : 0,
            unrestDelta: { grievance: -Math.round(3 + csSeverity * 5), petition: -Math.round(2 + csSeverity * 4) },
            demand: 'restrain forced conscription and corvee',
            reason: 'forced conscription pressure'
          };
        })
      });
    }

    var land = root && root.landAnnexation;
    var concentration = Number(land && (land.concentration != null ? land.concentration : land.index));
    var landThreshold = tuneNumber(root, 'socialSignals.thresholds.landAnnexation', 0.68);
    if (isFinite(concentration) && concentration >= landThreshold) {
      var lSeverity = clamp((concentration - 0.65) / 0.35, 0, 1);
      emit('land-annexation', {
        tags: ['land', 'annexation', 'peasant', 'gentry'],
        intensity: lSeverity,
        confidence: 0.82,
        reason: 'Runtime land concentration is high enough to reshape class pressure.',
        affectedClasses: inferClassImpacts(root, ['peasant', 'farmer', 'rural', 'household', 'land', 'tenant', '\u519c', '\u7530', '\u4f43'], function() {
          return {
            satisfactionDelta: -Math.max(3, Math.round(3 + lSeverity * 7)),
            influenceDelta: -Math.round(lSeverity * 2),
            unrestDelta: { grievance: -Math.round(3 + lSeverity * 5) },
            demand: 'check land annexation and protect smallholders',
            reason: 'land annexation pressure'
          };
        })
      });
    }

    var corruption = readCorruptionIndex(root);
    var corruptionThreshold = tuneNumber(root, 'socialSignals.thresholds.corruption', 65);
    if (isFinite(corruption) && corruption >= corruptionThreshold) {
      var cSeverity = clamp((corruption - 60) / 40, 0, 1);
      emit('corruption-high', {
        tags: ['corruption', 'office', 'merchant', 'scholar'],
        intensity: cSeverity,
        confidence: 0.78,
        reason: 'Runtime corruption index is high and is affecting organized social groups.',
        affectedClasses: inferClassImpacts(root, ['corruption', 'official', 'office', 'scholar', 'gentry', 'merchant', 'guild', 'law', '\u8d2a', '\u5b98', '\u58eb', '\u5546'], function() {
          return {
            satisfactionDelta: -Math.max(2, Math.round(2 + cSeverity * 5)),
            unrestDelta: { grievance: -Math.round(2 + cSeverity * 4) },
            demand: 'clean administration and punish corrupt brokers',
            reason: 'corruption pressure'
          };
        })
      });
    }

    var keju = root && (root.keju || (root.P && root.P.keju));
    var fairness = Number(keju && (keju.fairnessIndex != null ? keju.fairnessIndex : (keju.fairness != null ? keju.fairness : keju.accessFairness)));
    var kejuFairnessThreshold = tuneNumber(root, 'socialSignals.thresholds.kejuFairness', 45);
    if (isFinite(fairness) && fairness <= kejuFairnessThreshold) {
      var kSeverity = clamp((kejuFairnessThreshold - fairness) / Math.max(1, kejuFairnessThreshold), 0, 1);
      emit('keju-access-tension', {
        tags: ['keju', 'exam', 'scholar', 'education'],
        intensity: kSeverity,
        confidence: 0.8,
        reason: 'Runtime keju fairness/access index is low.',
        affectedClasses: inferClassImpacts(root, ['keju', 'exam', 'scholar', 'student', 'education', 'degree', '\u79d1\u4e3e', '\u58eb', '\u751f\u5458', '\u4e66\u9662'], function() {
          return {
            satisfactionDelta: -Math.max(2, Math.round(2 + kSeverity * 6)),
            unrestDelta: { grievance: -Math.round(1 + kSeverity * 4), petition: -Math.round(2 + kSeverity * 4) },
            demand: 'restore fair exam access',
            reason: 'keju access tension'
          };
        })
      });
    }

    var admissionShock = readKejuAdmissionShock(root);
    var admissionShockThreshold = tuneNumber(root, 'socialSignals.thresholds.kejuAdmissionShock', 0.35);
    if (isFinite(admissionShock) && admissionShock >= admissionShockThreshold) {
      var kaSeverity = clamp(admissionShock, 0, 1);
      emit('keju-admission-shock', {
        sourceSystem: 'keju',
        tags: ['keju', 'exam', 'admission', 'scholar', 'office'],
        intensity: kaSeverity,
        confidence: 0.78,
        reason: 'Runtime keju admission data indicates unusually tight or distorted admissions.',
        affectedClasses: inferClassImpacts(root, ['keju', 'exam', 'admission', 'scholar', 'student', 'degree', 'office', 'gentry', '\u79d1\u4e3e', '\u5f55\u53d6', '\u58eb', '\u751f\u5458'], function() {
          return {
            satisfactionDelta: -Math.max(2, Math.round(2 + kaSeverity * 5)),
            unrestDelta: { grievance: -Math.round(2 + kaSeverity * 4), petition: -Math.round(2 + kaSeverity * 4) },
            demand: 'restore credible exam admissions',
            reason: 'keju admission pressure'
          };
        })
      });
    }

    var donation = readOfficeDonation(root);
    var donationThreshold = tuneNumber(root, 'socialSignals.thresholds.officeDonation', 0.65);
    if (isFinite(donation) && donation >= donationThreshold) {
      var dSeverity = clamp((donation - 0.6) / 0.4, 0, 1);
      emit('office-donation', {
        sourceSystem: 'office',
        tags: ['office', 'donation', 'appointment', 'gentry', 'merchant'],
        intensity: dSeverity,
        confidence: 0.78,
        reason: 'Runtime office data indicates donation-for-office pressure.',
        affectedClasses: inferClassImpacts(root, ['office', 'donation', 'appointment', 'gentry', 'scholar', 'merchant', '\u6350\u7eb3', '\u4e70\u5b98', '\u4efb\u5b98', '\u58eb', '\u5546'], function() {
          return {
            satisfactionDelta: -Math.max(2, Math.round(2 + dSeverity * 5)),
            unrestDelta: { grievance: -Math.round(1 + dSeverity * 4), petition: -Math.round(2 + dSeverity * 4) },
            demand: 'curb donation-for-office appointments',
            reason: 'donation office pressure'
          };
        }),
        affectedParties: inferPartyImpacts(root, ['office', 'donation', 'appointment', 'gentry', 'merchant', 'purge'], function() {
          return {
            influenceDelta: Math.max(1, Math.round(dSeverity * 3)),
            cohesionDelta: -Math.max(1, Math.round(dSeverity * 2)),
            currentAgenda: 'defend office appointment interests',
            reason: 'donation office pressure'
          };
        })
      });
    }

    var purge = readPartyPurge(root);
    var purgeThreshold = tuneNumber(root, 'socialSignals.thresholds.partyPurge', 0.6);
    if (isFinite(purge) && purge >= purgeThreshold) {
      var pSeverity = clamp((purge - 0.55) / 0.45, 0, 1);
      emit('party-purge', {
        sourceSystem: 'office',
        tags: ['party', 'purge', 'office', 'gentry', 'scholar'],
        intensity: pSeverity,
        confidence: 0.76,
        reason: 'Runtime office/political data indicates purge pressure against organized factions.',
        affectedClasses: inferClassImpacts(root, ['party', 'purge', 'office', 'gentry', 'scholar', 'appointment', '\u6e05\u515a', '\u515a\u4e89', '\u4efb\u5b98', '\u58eb'], function() {
          return {
            satisfactionDelta: -Math.max(2, Math.round(2 + pSeverity * 4)),
            unrestDelta: { grievance: -Math.round(2 + pSeverity * 4), petition: -Math.round(1 + pSeverity * 3) },
            demand: 'stop factional purge and arbitrary dismissal',
            reason: 'party purge pressure'
          };
        }),
        affectedParties: inferPartyImpacts(root, ['party', 'purge', 'office', 'appointment'], function() {
          return {
            influenceDelta: Math.max(1, Math.round(pSeverity * 4)),
            cohesionDelta: -Math.max(1, Math.round(pSeverity * 3)),
            shortGoal: 'survive purge and protect office network',
            reason: 'party purge pressure'
          };
        })
      });
    }

    var appointments = readSamePartyAppointments(root);
    var samePartyThreshold = tuneNumber(root, 'socialSignals.thresholds.samePartyAppointment', 0.65);
    if (appointments && isFinite(appointments.ratio) && appointments.ratio >= samePartyThreshold) {
      var aSeverity = clamp((appointments.ratio - 0.6) / 0.4, 0, 1);
      var partyTokens = ['party', 'office', 'appointment', 'gentry', 'scholar'];
      if (appointments.party) partyTokens.push(appointments.party);
      emit('same-party-appointments', {
        sourceSystem: 'office',
        tags: ['office', 'appointment', 'party', 'patronage'],
        intensity: aSeverity,
        confidence: 0.82,
        reason: 'Runtime office appointments are concentrated in one party network.',
        affectedClasses: inferClassImpacts(root, ['office', 'appointment', 'gentry', 'scholar', 'student', 'party', '\u540c\u515a', '\u4efb\u5b98', '\u58eb'], function() {
          return {
            satisfactionDelta: -Math.max(2, Math.round(2 + aSeverity * 4)),
            unrestDelta: { grievance: -Math.round(2 + aSeverity * 4), petition: -Math.round(1 + aSeverity * 3) },
            demand: 'rebalance appointments away from one party',
            reason: 'same-party appointment pressure'
          };
        }),
        affectedParties: inferPartyImpacts(root, partyTokens, function(party) {
          var matchName = appointments.party && normalizeName(partyNameOf(party)) === normalizeName(appointments.party);
          return {
            influenceDelta: matchName ? Math.max(2, Math.round(aSeverity * 5)) : Math.max(1, Math.round(aSeverity * 2)),
            cohesionDelta: matchName ? Math.max(1, Math.round(aSeverity * 2)) : -Math.max(1, Math.round(aSeverity * 2)),
            shortGoal: 'consolidate appointment network',
            reason: 'same-party appointment concentration'
          };
        })
      });
    }

    var arrears = readMilitaryArrears(root);
    var arrearsThreshold = tuneNumber(root, 'socialSignals.thresholds.militaryArrears', 0.5);
    if (isFinite(arrears) && arrears >= arrearsThreshold) {
      var mSeverity = clamp((arrears - 0.45) / 0.55, 0, 1);
      emit('military-wage-arrears', {
        sourceSystem: 'military',
        tags: ['military', 'wage', 'arrears', 'mutiny', 'soldier'],
        intensity: mSeverity,
        confidence: 0.86,
        reason: 'Runtime military data indicates unpaid wages or mutiny pressure.',
        affectedClasses: inferClassImpacts(root, ['military', 'soldier', 'wage', 'arrears', 'mutiny', 'garrison', '\u519b\u9977', '\u6b20\u9977', '\u54d7\u53d8', '\u5175'], function() {
          return {
            satisfactionDelta: -Math.max(3, Math.round(3 + mSeverity * 7)),
            influenceDelta: Math.max(1, Math.round(mSeverity * 3)),
            unrestDelta: { grievance: -Math.round(3 + mSeverity * 5), revolt: -Math.round(2 + mSeverity * 5) },
            demand: 'pay military wage arrears',
            reason: 'military wage arrears'
          };
        })
      });
    }

    var revoltRisk = readLocalRevoltRisk(root);
    var revoltRiskThreshold = tuneNumber(root, 'socialSignals.thresholds.localRevoltRisk', 0.65);
    var revoltRiskBase = tuneNumber(root, 'socialSignals.severityBases.localRevoltRisk', 0.6);
    if (isFinite(revoltRisk) && revoltRisk >= revoltRiskThreshold) {
      var rSeverity = clamp((revoltRisk - revoltRiskBase) / Math.max(0.01, 1 - revoltRiskBase), 0, 1);
      emit('local-revolt-risk', {
        sourceSystem: 'local',
        tags: ['local', 'revolt', 'rebellion', 'unrest', 'peasant'],
        intensity: rSeverity,
        confidence: 0.84,
        reason: 'Runtime local data indicates rising revolt or rebellion risk.',
        affectedClasses: inferClassImpacts(root, ['local', 'revolt', 'rebellion', 'uprising', 'unrest', 'peasant', 'commoner', 'rural', '\u5730\u65b9', '\u6c11\u53d8', '\u8d77\u4e49', '\u6c11'], function() {
          return {
            satisfactionDelta: -Math.max(3, Math.round(3 + rSeverity * 6)),
            influenceDelta: Math.max(1, Math.round(rSeverity * 3)),
            unrestDelta: { grievance: -Math.round(3 + rSeverity * 5), revolt: -Math.round(3 + rSeverity * 6) },
            demand: 'relieve local exactions before revolt spreads',
            reason: 'local revolt risk'
          };
        })
      });
    }
    return out;
  }

  function turnResultPayload(input) {
    input = input || {};
    if (input.results || input.record || input.apply || input.followup) {
      return {
        result: (input.results && input.results.aiResult) || {},
        record: input.record || {},
        apply: input.apply || {},
        followup: input.followup || {}
      };
    }
    return { result: input, record: input, apply: {}, followup: {} };
  }

  function turnResultTextParts(payload) {
    var result = payload.result || {};
    var record = payload.record || {};
    var followup = payload.followup || {};
    var parts = [
      result.turnSummary, result.shizhengji, result.zhengwen, result.shiluText,
      result.szjTitle, result.szjSummary, result.playerStatus, result.playerInner,
      record.turnSummary, record.shizhengji, record.zhengwen, record.shiluText,
      record.szjTitle, record.szjSummary, record.playerStatus, record.playerInner,
      toArray(result.personnelChanges).map(textOf).join(' '),
      toArray(record.personnelChanges).map(textOf).join(' '),
      toArray(result.events || result.eventLog || result.structuredEvents).map(textOf).join(' '),
      toArray(followup._changeSummary || followup.changeSummary).map(textOf).join(' ')
    ].map(textOf).filter(Boolean);
    return uniqueTexts(parts).slice(0, 12);
  }

  function turnChangesEvidence(root, key) {
    var tc = root && root.turnChanges && root.turnChanges[key];
    return toArray(tc).map(function(row) {
      if (!row) return null;
      var name = row.name || row.className || row.party || row.partyName || row.id || '';
      if (!name) return null;
      var reason = toArray(row.changes).map(function(ch) {
        if (!ch) return '';
        return [ch.field, ch.oldValue, ch.newValue, ch.reason || ch.desc || ch.description].map(textOf).filter(Boolean).join(' ');
      }).filter(Boolean).join('; ');
      return { name: textOf(name), reason: compact(reason || row.reason || row.desc || name, 180) };
    }).filter(Boolean);
  }

  function recordTurnResult(rootOrResult, maybeResult, maybeOptions) {
    var root;
    var turnResult;
    var options;
    if (maybeResult === undefined || (maybeResult && (maybeResult.source || maybeResult.turn) && !maybeResult.results && !maybeResult.record && !maybeResult.turnSummary && !maybeResult.shizhengji)) {
      root = pickRoot();
      turnResult = rootOrResult || {};
      options = maybeResult || {};
    } else {
      root = pickRoot(rootOrResult);
      turnResult = maybeResult || {};
      options = maybeOptions || {};
    }
    var source = options.source || 'turn-result-ai';
    var turn = Number(options.turn != null ? options.turn : root.turn) || 0;
    if (!root._socialPoliticalTurnResultKeys || typeof root._socialPoliticalTurnResultKeys !== 'object') root._socialPoliticalTurnResultKeys = {};
    var batchKey = source + '::' + turn;
    var out = { recorded: 0, kinds: [], signals: [] };
    if (root._socialPoliticalTurnResultKeys[batchKey]) return out;
    root._socialPoliticalTurnResultKeys[batchKey] = true;

    var payload = turnResultPayload(turnResult);
    var parts = turnResultTextParts(payload);
    var text = parts.join(' ').toLowerCase();
    var evidence = parts.slice(0, 8);
    function has(re) { return re.test(text); }
    function positive(re) { return re.test(text); }
    function emit(kind, raw) {
      raw = raw || {};
      raw.sourceSystem = 'turn-result';
      raw.kind = kind;
      raw.turn = turn;
      raw.confidence = raw.confidence == null ? 0.74 : raw.confidence;
      raw.evidence = uniqueTexts(toArray(raw.evidence).concat(evidence)).slice(0, 8);
      if (!raw.reason) raw.reason = compact(evidence.join(' '), 220) || kind;
      if (!toArray(raw.affectedClasses).length && !toArray(raw.affectedParties).length && !toArray(raw.relationAdjustments).length) return;
      var signal = record(root, raw);
      out.recorded++;
      out.kinds.push(kind);
      out.signals.push(signal);
    }

    if (has(/tax|levy|arrear|rent|corvee|tenant|quota|赋|税|租|役|欠粮|加派|催科|催征/)) {
      var taxRelief = positive(/relief|remit|remission|reduce|lower|exempt|减免|蠲|赈|抚/);
      var taxStress = has(/unrest|complain|anger|pressed|tighten|caused|pressure|new levy|加派|催|怨|困|骚动|民变/);
      var taxSign = taxRelief && !taxStress ? 1 : (taxStress ? -1 : 0);   // \u4e2d\u6027(\u65e0\u7ebe\u89e3\u65e0\u538b)\u21920\u00b7\u4e0d\u518d\u65e0\u8111\u5224\u574f
      emit('turn-result-tax-pressure', {
        tags: ['turn-result', 'tax', 'levy', 'peasant', 'merchant'],
        intensity: taxSign > 0 ? 0.42 : 0.68,
        reason: compact(evidence.join(' '), 220),
        affectedClasses: inferClassImpacts(root, ['tax', 'levy', 'arrear', 'rent', 'tenant', 'peasant', 'farmer', 'merchant', 'guild', '\u7a0e', '\u8d4b', '\u79df', '\u6c11'], function() {
          return {
            satisfactionDelta: taxSign > 0 ? 3 : (taxSign < 0 ? -4 : 0),
            influenceDelta: taxSign < 0 ? 1 : (taxSign > 0 ? -1 : 0),        // \u7ebe\u89e3\u2192\u9000\u6f6e\u8dcc\u5f71\u54cd(\u4fee\u65e0\u8111\u5347)
            unrestDelta: { grievance: taxSign > 0 ? 2 : (taxSign < 0 ? -3 : 0), petition: taxSign > 0 ? 1 : (taxSign < 0 ? -2 : 0) },
            demand: taxSign > 0 ? 'preserve tax and levy relief' : 'reduce tax and levy pressure',
            reason: 'AI turn result tax/levy pressure'
          };
        }),
        affectedParties: inferPartyImpacts(root, ['tax', 'levy', 'relief', 'tenant', 'peasant', 'merchant'], function() {
          return {
            influenceDelta: taxSign < 0 ? 1 : (taxSign > 0 ? -1 : 0),        // \u53cc\u5411
            cohesionDelta: taxSign > 0 ? 1 : 0,
            shortGoal: taxSign > 0 ? 'defend turn-result tax relief' : 'respond to turn-result tax pressure',
            reason: 'AI turn result tax/levy pressure'
          };
        })
      });
    }

    if (has(/land|tenant|estate|annexation|field|田|地|佃|兼并|庄田/)) {
      var landRelief = positive(/protect|survey|check|restrain|清丈|抑兼并|保护|均田|安抚/);
      var landStress = has(/annexation|seize|encroach|displace|兼并|夺|侵占|失地|流离|逼佃/);
      var landSign = landRelief ? 1 : (landStress ? -1 : 0);   // 「田/地」常中性出现·无兼并压则不判坏(中性→0)
      emit('turn-result-land-pressure', {
        tags: ['turn-result', 'land', 'tenant', 'peasant'],
        intensity: landRelief ? 0.4 : 0.64,
        affectedClasses: inferClassImpacts(root, ['land', 'tenant', 'field', 'peasant', 'farmer', '\u7530', '\u5730', '\u4f43'], function() {
          return {
            satisfactionDelta: landSign > 0 ? 3 : (landSign < 0 ? -4 : 0),
            unrestDelta: { grievance: landSign > 0 ? 2 : (landSign < 0 ? -3 : 0) },
            demand: landRelief ? 'keep land protection credible' : 'check land annexation and protect tenants',
            reason: 'AI turn result land pressure'
          };
        })
      });
    }

    if (has(/military|soldier|garrison|wage|arrear|mutiny|conscription|army|兵|军|饷|欠饷|哗变|强征|征发/)) {
      var milRelief = positive(/pay|paid|repaid|settle|补饷|发饷|给饷|安抚/);
      var milStress = has(/arrear|mutiny|unpaid|complain|欠饷|哗变|强征|怨/);
      var milSign = milRelief && !milStress ? 1 : (milStress ? -1 : 0);   // \u4e2d\u6027\u21920
      emit('turn-result-military-arrears', {
        sourceSystem: 'turn-result',
        tags: ['turn-result', 'military', 'wage', 'arrears', 'soldier'],
        intensity: milSign > 0 ? 0.42 : 0.7,
        affectedClasses: inferClassImpacts(root, ['military', 'soldier', 'wage', 'arrears', 'garrison', '\u519b', '\u5175', '\u9977', '\u6b20\u9977'], function() {
          return {
            satisfactionDelta: milSign > 0 ? 3 : (milSign < 0 ? -5 : 0),
            influenceDelta: milSign < 0 ? 1 : (milSign > 0 ? -1 : 0),
            unrestDelta: { grievance: milSign > 0 ? 2 : (milSign < 0 ? -4 : 0), revolt: milSign > 0 ? 1 : (milSign < 0 ? -3 : 0) },
            demand: milSign > 0 ? 'keep military pay current' : 'pay military wage arrears',
            reason: 'AI turn result military arrears'
          };
        }),
        affectedParties: inferPartyImpacts(root, ['military', 'soldier', 'wage', 'arrears'], function() {
          return {
            influenceDelta: milSign < 0 ? 1 : (milSign > 0 ? -1 : 0),
            shortGoal: milSign > 0 ? 'defend wage settlement' : 'press for wage arrears settlement',
            reason: 'AI turn result military arrears'
          };
        })
      });
    }

    if (has(/keju|exam|admission|scholar|degree|科举|科场|录取|士子|生员|举人|舞弊/)) {
      var kejuRelief = positive(/fair|restore|open|admit|enke|公平|开科|恩科|录取|澄清/);
      var kejuStress = has(/fraud|anger|unfair|tight|distorted|舞弊|怨|不公|壅滞/);
      var kejuSign = kejuRelief && !kejuStress ? 1 : (kejuStress ? -1 : 0);   // \u4e2d\u6027\u21920
      emit('turn-result-keju-pressure', {
        sourceSystem: 'turn-result',
        tags: ['turn-result', 'keju', 'exam', 'scholar', 'office'],
        intensity: kejuSign > 0 ? 0.42 : 0.64,
        affectedClasses: inferClassImpacts(root, ['keju', 'exam', 'admission', 'scholar', 'student', 'office', '\u79d1\u4e3e', '\u58eb', '\u751f\u5458'], function() {
          return {
            satisfactionDelta: kejuSign > 0 ? 3 : (kejuSign < 0 ? -4 : 0),
            unrestDelta: { grievance: kejuSign > 0 ? 1 : (kejuSign < 0 ? -3 : 0), petition: kejuSign > 0 ? 1 : (kejuSign < 0 ? -3 : 0) },
            demand: kejuSign > 0 ? 'preserve credible exam access' : 'restore fair exam access',
            reason: 'AI turn result keju pressure'
          };
        }),
        affectedParties: inferPartyImpacts(root, ['keju', 'exam', 'scholar', 'office'], function() {
          return {
            influenceDelta: kejuSign < 0 ? 1 : (kejuSign > 0 ? -1 : 0),
            shortGoal: kejuSign > 0 ? 'claim credit for exam access' : 'push exam admission review',
            reason: 'AI turn result keju pressure'
          };
        })
      });
    }

    if (has(/corruption|bribe|fraud|embezzle|贪|腐|贿|舞弊|侵吞/)) {
      var clean = positive(/clean|punish|audit|investigate|肃贪|惩贪|清查|审计|问责/);
      emit('turn-result-corruption-pressure', {
        sourceSystem: 'turn-result',
        tags: ['turn-result', 'corruption', 'office', 'merchant', 'scholar'],
        intensity: clean ? 0.42 : 0.62,
        affectedClasses: inferClassImpacts(root, ['corruption', 'office', 'merchant', 'scholar', '\u8d2a', '\u8150', '\u5b98', '\u5546', '\u58eb'], function() {
          return {
            satisfactionDelta: clean ? 2 : -3,
            unrestDelta: { grievance: clean ? 1 : -2 },
            demand: clean ? 'keep anti-corruption enforcement visible' : 'clean administration and punish corrupt brokers',
            reason: 'AI turn result corruption pressure'
          };
        })
      });
    }

    if (has(/revolt|rebellion|uprising|unrest|riot|famine|refugee|民变|起义|骚乱|流民|饥/)) {
      emit('turn-result-local-unrest', {
        sourceSystem: 'turn-result',
        tags: ['turn-result', 'local', 'revolt', 'unrest', 'peasant'],
        intensity: 0.72,
        affectedClasses: inferClassImpacts(root, ['local', 'revolt', 'unrest', 'peasant', 'commoner', 'rural', '\u5730\u65b9', '\u6c11\u53d8', '\u6c11'], function() {
          return {
            satisfactionDelta: -5,
            influenceDelta: 1,
            unrestDelta: { grievance: -4, revolt: -4 },
            demand: 'relieve local exactions before unrest spreads',
            reason: 'AI turn result local unrest'
          };
        })
      });
    }

    var classEvidence = turnChangesEvidence(root, 'classes').map(function(x) {
      return { name: x.name, reason: x.reason };
    });
    if (classEvidence.length) {
      emit('turn-result-class-evidence', {
        tags: ['turn-result', 'class-change'],
        intensity: 0.35,
        confidence: 0.82,
        reason: classEvidence.map(function(x) { return x.name + ': ' + x.reason; }).join('; '),
        affectedClasses: classEvidence
      });
    }

    var partyEvidence = turnChangesEvidence(root, 'parties').map(function(x) {
      return { name: x.name, reason: x.reason };
    });
    if (partyEvidence.length) {
      emit('turn-result-party-evidence', {
        tags: ['turn-result', 'party-change'],
        intensity: 0.35,
        confidence: 0.82,
        reason: partyEvidence.map(function(x) { return x.name + ': ' + x.reason; }).join('; '),
        affectedParties: partyEvidence
      });
    }

    if (!Array.isArray(root._socialPoliticalTurnResultApplications)) root._socialPoliticalTurnResultApplications = [];
    if (out.recorded) {
      root._socialPoliticalTurnResultApplications.push({
        turn: turn,
        source: source,
        recorded: out.recorded,
        kinds: out.kinds.slice(),
        at: Date.now()
      });
      if (root._socialPoliticalTurnResultApplications.length > 40) root._socialPoliticalTurnResultApplications = root._socialPoliticalTurnResultApplications.slice(-40);
    }
    return out;
  }

  function formatForPrompt(root, options) {
    var snap = snapshot(root, options || {});
    if (!snap.recent.length) return '';
    var lines = ['\n\n=== Social Political Signals ==='];
    lines.push('Use these as deterministic system/player/court evidence for class and party dynamics.');
    Object.keys(snap.bySystem).forEach(function(k) {
      lines.push('- system ' + k + ': ' + snap.bySystem[k]);
    });
    snap.recent.forEach(function(signal) {
      var cls = signal.affectedClasses.map(function(x) { return x.name; }).join('/');
      var parties = signal.affectedParties.map(function(x) { return x.name; }).join('/');
      var rels = signal.relationAdjustments.map(function(x) { return x.party + '->' + x.className; }).join('/');
      lines.push('- T' + signal.turn + '#' + signal.seq + ' [' + signal.sourceSystem + '/' + signal.kind + '] '
        + compact(signal.reason, 120)
        + (signal.linkedIssue ? ' issue=' + signal.linkedIssue : '')
        + (signal.characterName ? ' char=' + signal.characterName : '')
        + (cls ? ' classes=' + cls : '')
        + (parties ? ' parties=' + parties : '')
        + (rels ? ' relations=' + rels : ''));
    });
    return lines.join('\n');
  }

  function recordFromEvent(root, eventName, payload) {
    payload = payload || {};
    var raw = payload.socialPoliticalSignal || payload.signal || null;
    if (!raw && (payload.affectedClasses || payload.affectedParties || payload.relationAdjustments)) raw = payload;
    if (!raw) return null;
    raw.sourceSystem = raw.sourceSystem || payload.sourceSystem || 'event-bus';
    raw.kind = raw.kind || payload.kind || eventName;
    raw.turn = raw.turn != null ? raw.turn : payload.turn;
    raw.reason = raw.reason || payload.reason || payload.eventName || eventName;
    return record(root, raw);
  }

  function installEventBridge(root, bus) {
    var installedRoot = root;
    bus = bus || global.EventBus || (global.PhaseF2 && global.PhaseF2.eventBus);
    if (!bus || typeof bus.on !== 'function') return false;
    if (bus._socialPoliticalSignalsInstalled) return true;
    [
      'fiscal.treasury.critical',
      'fiscal.bankruptcy.trigger',
      'peasantBurden.critical',
      'central_local.region_defiance',
      'central_local.autonomous_rise',
      'landAnnex.crisis',
      'population.fugitive.surge',
      'population.corveeDeath.peak',
      'authority.rebellion.upgrade',
      'audit.fraud.exposed',
      'bankruptcy.step',
      'leakage.triangle.critical'
    ].forEach(function(eventName) {
      try {
        bus.on(eventName, function(payload) {
          payload = payload || {};
          var eventRoot = payload.root || payload.state || pickRoot(installedRoot);
          recordFromEvent(eventRoot, eventName, payload);
        });
      } catch (_) {}
    });
    bus._socialPoliticalSignalsInstalled = true;
    return true;
  }

  TM.PartyClassSignalBridge = {
    applySignal: applySignal,
    applyPending: applyPending,
    scanAndApply: function(root, options) {
      root = pickRoot(root);
      options = options || {};
      var scanned = scanRuntimePressures(root, options);
      var applied = applyPending(root, options);
      return { scanned: scanned, applied: applied };
    }
  };

  TM.SocialPoliticalSignals = {
    record: record,
    recordFromEvent: recordFromEvent,
    recordTurnResult: recordTurnResult,
    scanRuntimePressures: scanRuntimePressures,
    decayAndResolve: decayAndResolve,
    applyPending: applyPending,
    snapshot: snapshot,
    getRecentCauses: getRecentCauses,
    formatForPrompt: formatForPrompt,
    installEventBridge: installEventBridge,
    _findClass: findClass,
    _findParty: findParty
  };

  global.SocialPoliticalSignals = TM.SocialPoliticalSignals;

  if (typeof module !== 'undefined' && module.exports) module.exports = TM.SocialPoliticalSignals;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : globalThis));
