// @ts-check
/*
 * tm-class-engine.js
 * 阶层情绪 / 阶层口数桥接 / 民变阶段处理
 * 只处理 scriptData.classes / GM.classes 与 GM.population.byClass 的同步，
 * 不改人口深层引擎本体。
 */
(function(global) {
  'use strict';

  var TM = global.TM = global.TM || {};

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

  function clamp(n, min, max) {
    n = Number(n);
    if (!isFinite(n)) n = 0;
    return Math.max(min, Math.min(max, n));
  }

  function toArray(v) {
    if (Array.isArray(v)) return v.slice();
    if (v === undefined || v === null || v === '') return [];
    return [v];
  }

  function pickRoot(root) {
    if (root && typeof root === 'object') return root;
    if (global.GM && typeof global.GM === 'object') return global.GM;
    if (global.scriptData && typeof global.scriptData === 'object') return global.scriptData;
    return {};
  }

  function normalizeText(v) {
    return String(v || '')
      .toLowerCase()
      .replace(/[\s\-_·,，。.!?、/\\()（）【】\[\]{}:：;；'"\u3000]/g, '');
  }

  function constantsOf(root) {
    var source = pickRoot(root);
    if (TM.EngineConstants && typeof TM.EngineConstants.constantsOf === 'function') {
      return TM.EngineConstants.constantsOf(source) || null;
    }
    return source && source.engineConstants && typeof source.engineConstants === 'object'
      ? source.engineConstants : null;
  }

  function read(path, root) {
    var ec = constantsOf(root);
    if (!ec || !path) return undefined;
    var cur = ec;
    String(path).split('.').forEach(function(part) {
      if (cur === undefined || cur === null) return;
      cur = cur[part];
    });
    return cur === undefined ? undefined : clone(cur);
  }

  function getClasses(root) {
    var source = pickRoot(root);
    if (Array.isArray(source.classes)) return source.classes;
    if (source.scriptData && Array.isArray(source.scriptData.classes)) return source.scriptData.classes;
    if (global.P && Array.isArray(global.P.classes)) return global.P.classes;
    return [];
  }

  function ensureRootContainers(root) {
    var source = pickRoot(root);
    if (!source.population || typeof source.population !== 'object') source.population = {};
    if (!source.population.byClass || typeof source.population.byClass !== 'object') source.population.byClass = {};
    if (!source.population.national || typeof source.population.national !== 'object') source.population.national = {};
    if (!source.minxin || typeof source.minxin !== 'object') source.minxin = {};
    if (!Array.isArray(source.minxin.alerts)) source.minxin.alerts = [];
    return source;
  }

  function ensureClassRuntime(cls) {
    if (!cls || typeof cls !== 'object') return null;
    if (!Array.isArray(cls.representativeNpcs)) cls.representativeNpcs = [];
    if (!Array.isArray(cls.leaders)) cls.leaders = [];
    if (!Array.isArray(cls.supportingParties)) cls.supportingParties = [];
    if (!Array.isArray(cls.regionalVariants)) cls.regionalVariants = [];
    if (!Array.isArray(cls.internalFaction)) cls.internalFaction = [];
    if (!cls.unrestLevels || typeof cls.unrestLevels !== 'object') {
      cls.unrestLevels = { grievance: 60, petition: 70, strike: 80, revolt: 90 };
    }
    if (!cls.economicIndicators || typeof cls.economicIndicators !== 'object') {
      cls.economicIndicators = { wealth: 40, taxBurden: 40, landHolding: 20 };
    }
    if (!cls.revoltState || typeof cls.revoltState !== 'object') {
      cls.revoltState = { phase: 'calm', turns: 0, lastTurn: 0, note: '' };
    }
    if (cls._populationBridgeMode === undefined) cls._populationBridgeMode = '';
    return cls;
  }

  function buildPopulationIndex(root) {
    var map = read('classPopulationMap', root) || {};
    var index = {};
    Object.keys(map).forEach(function(k) {
      index[normalizeText(k)] = toArray(map[k]);
    });
    return index;
  }

  function resolvePopulationKeys(cls, root) {
    var source = pickRoot(root);
    var name = cls && (cls.name || cls.class || cls.id || cls.title || '');
    var explicit = toArray(cls && (cls.populationKeys || cls.classPopulationKeys || cls.popKeys));
    if (explicit.length > 0) return explicit;

    var index = buildPopulationIndex(source);
    var norm = normalizeText(name);
    if (index[norm]) return index[norm].slice();

    if (/士绅|门阀|世家|高门/.test(name)) return ['gentry_high', 'gentry_low'];
    if (/地主|豪强/.test(name)) return ['landlord'];
    if (/商|贾/.test(name)) return ['merchant'];
    if (/自耕|编户|农/.test(name)) return ['peasant_self', 'bianhu'];
    if (/佃/.test(name)) return ['peasant_tenant'];
    if (/工匠|匠户/.test(name)) return ['craftsman', 'jianghu'];
    if (/僧|道|寺/.test(name)) return ['clergy', 'sengdao'];
    if (/军户|武人|军/.test(name)) return ['military', 'junhu'];
    if (/乐户|疍户|奴婢|贱民/.test(name)) return ['debased', 'yuehu', 'danhu', 'nubi'];
    if (/皇族|宗室|皇亲/.test(name)) return ['imperial'];
    if (norm) return [norm];
    return [];
  }

  function parseSizeShare(size) {
    if (size === undefined || size === null || size === '') return null;
    if (typeof size === 'number' && isFinite(size)) {
      return size > 1 ? clamp(size / 100, 0, 1) : clamp(size, 0, 1);
    }
    var text = String(size);
    var m = text.match(/(\d+(?:\.\d+)?)\s*%/);
    if (m) return clamp(parseFloat(m[1]) / 100, 0, 1);
    m = text.match(/(\d+(?:\.\d+)?)/);
    if (m) {
      var n = parseFloat(m[1]);
      if (isFinite(n)) return n > 1 ? clamp(n / 100, 0, 1) : clamp(n, 0, 1);
    }
    return null;
  }

  function formatSizeText(share) {
    var pct = Math.max(0, Math.round(clamp(share, 0, 1) * 100));
    return '约' + pct + '%人口';
  }

  function parseTurnNumber(v) {
    var n = parseInt(v, 10);
    return isFinite(n) ? n : 0;
  }

  function sumBuckets(pop, keys) {
    var total = 0;
    (keys || []).forEach(function(key) {
      var bucket = pop.byClass[key];
      if (bucket && typeof bucket === 'object') total += parseTurnNumber(bucket.mouths);
    });
    return total;
  }

  function writeBuckets(pop, keys, mouths) {
    keys = keys || [];
    if (keys.length === 0) return 0;
    mouths = Math.max(0, parseTurnNumber(mouths));
    if (keys.length === 1) {
      var only = pop.byClass[keys[0]] = pop.byClass[keys[0]] || {};
      only.mouths = mouths;
      only.households = Math.max(0, Math.round(mouths / 5));
      only.ding = Math.max(0, Math.round(mouths * 0.25));
      return mouths;
    }
    var existing = keys.map(function(key) {
      var bucket = pop.byClass[key];
      return bucket && typeof bucket === 'object' ? parseTurnNumber(bucket.mouths) : 0;
    });
    var existingTotal = existing.reduce(function(sum, n) { return sum + n; }, 0);
    var assigned = 0;
    keys.forEach(function(key, idx) {
      var bucket = pop.byClass[key] = pop.byClass[key] || {};
      var share = existingTotal > 0 ? (existing[idx] / existingTotal) : (1 / keys.length);
      var value = idx === keys.length - 1 ? (mouths - assigned) : Math.max(0, Math.round(mouths * share));
      assigned += value;
      bucket.mouths = value;
      bucket.households = Math.max(0, Math.round(value / 5));
      bucket.ding = Math.max(0, Math.round(value * 0.25));
    });
    return mouths;
  }

  function mergeAlert(root, cls, phase, note) {
    var source = ensureRootContainers(root);
    var key = 'class:' + (cls.name || 'unknown');
    var text;
    if (phase === 'uprising') text = (cls.name || '某阶层') + '已转入起事阶段';
    else if (phase === 'brewing') text = (cls.name || '某阶层') + '正在酝酿不满';
    else text = (cls.name || '某阶层') + '情绪趋稳';
    if (note) text += '，' + note;
    var idx = source.minxin.alerts.findIndex(function(a) { return a && a.id === key; });
    var payload = {
      id: key,
      className: cls.name || '',
      phase: phase,
      note: note || '',
      text: text,
      turn: parseTurnNumber(source.turn)
    };
    if (idx >= 0) {
      var old = source.minxin.alerts[idx] || {};
      ['acknowledged','responseAction','responseReason','responseTurn','resolved','resolvedTurn','missedCount','lastMissedTurn','status'].forEach(function(k) {
        if (old[k] !== undefined) payload[k] = old[k];
      });
      source.minxin.alerts[idx] = payload;
    }
    else source.minxin.alerts.push(payload);
    return payload;
  }

  function activeAlerts(root) {
    var source = ensureRootContainers(root);
    return source.minxin.alerts.filter(function(a) {
      return a && a.id && !a.resolved;
    });
  }

  function buildAlertPrompt(root, options) {
    var source = ensureRootContainers(root);
    options = options || {};
    var list = activeAlerts(source).slice(0, options.limit || 8);
    if (!list.length) {
      source._classAlertPromptIds = [];
      return '';
    }
    source._classAlertPromptIds = list.map(function(a) { return a.id; });
    var out = '\n\n【阶层临界警报·AI 必须回应】';
    out += '\n以下警报来自阶层引擎，不能沉默忽略。必须在 class_alert_responses 中逐条回应。';
    out += '\n输出格式：class_alert_responses:[{alertId, action:"address|defer|partial", reason:"处置理由"}]';
    out += '\n若处置，应在 class_changes / class_revolt / npc_actions / zhengwen 中体现；若搁置或部分处理，必须说明原因。';
    list.forEach(function(a) {
      out += '\n- [' + a.id + '] ' + (a.className || '某阶层') + '：' + (a.phase || '') + '，' + String(a.text || a.note || '').slice(0, 120);
    });
    return out;
  }

  function applyAlertResponses(root, responses, options) {
    var source = ensureRootContainers(root);
    options = options || {};
    if (!Array.isArray(source.minxin.alertResponseLog)) source.minxin.alertResponseLog = [];
    responses = Array.isArray(responses) ? responses : [];
    var byId = {};
    source.minxin.alerts.forEach(function(a) { if (a && a.id) byId[a.id] = a; });

    var seen = {};
    var summary = { responded: 0, missed: 0, unknown: 0 };
    responses.forEach(function(r) {
      if (!r || typeof r !== 'object') return;
      var id = r.alertId || r.id || r.alert_id;
      var action = String(r.action || 'defer').toLowerCase();
      if (['address','defer','partial'].indexOf(action) < 0) action = 'defer';
      if (!id || !byId[id]) {
        summary.unknown++;
        source.minxin.alertResponseLog.push({
          turn: parseTurnNumber(source.turn || (options && options.turn)),
          alertId: id || '',
          action: action,
          reason: r.reason || '',
          status: 'unknown'
        });
        return;
      }
      var alert = byId[id];
      seen[id] = true;
      alert.acknowledged = true;
      alert.responseAction = action;
      alert.responseReason = r.reason || '';
      alert.responseTurn = parseTurnNumber(source.turn || (options && options.turn));
      alert.status = action === 'address' ? 'addressed' : (action === 'partial' ? 'partial' : 'deferred');
      if (action === 'address') {
        alert.resolved = true;
        alert.resolvedTurn = alert.responseTurn;
      }
      source.minxin.alertResponseLog.push({
        turn: alert.responseTurn,
        alertId: id,
        className: alert.className || '',
        action: action,
        reason: alert.responseReason,
        status: alert.status
      });
      summary.responded++;
    });

    var required = Array.isArray(source._classAlertPromptIds) ? source._classAlertPromptIds : activeAlerts(source).map(function(a) { return a.id; });
    required.forEach(function(id) {
      var alert = byId[id];
      if (!alert || alert.resolved || seen[id]) return;
      alert.missedCount = parseTurnNumber(alert.missedCount) + 1;
      alert.lastMissedTurn = parseTurnNumber(source.turn || (options && options.turn));
      source.minxin.alertResponseLog.push({
        turn: alert.lastMissedTurn,
        alertId: id,
        className: alert.className || '',
        action: 'missed',
        reason: 'AI未回应阶层临界警报',
        status: 'missed'
      });
      summary.missed++;
    });
    return summary;
  }

  function ensurePartyState(root) {
    var source = ensureRootContainers(root);
    if (!source.partyState || typeof source.partyState !== 'object') source.partyState = {};
    var parties = Array.isArray(source.parties) ? source.parties : [];
    parties.forEach(function(p) {
      if (!p || !p.name) return;
      if (!source.partyState[p.name]) {
        source.partyState[p.name] = {
          name: p.name,
          influence: parseTurnNumber(p.influence) || 30,
          cohesion: parseTurnNumber(p.cohesion) || 50,
          reputationBalance: 0,
          alliedWith: [],
          conflictWith: [],
          neutralWith: [],
          officeCount: 0,
          recentImpeachWin: 0,
          recentImpeachLose: 0,
          recentPolicyWin: 0,
          recentPolicyLose: 0,
          lastShift: { turn: 0, influenceDelta: 0, cohesionDelta: 0, reason: '初始' },
          historyLog: []
        };
      }
    });
    return source.partyState;
  }

  function resolveSupportingPartyName(entry) {
    if (!entry) return '';
    if (typeof entry === 'string') return entry.trim();
    if (typeof entry !== 'object') return String(entry || '').trim();
    return String(entry.party || entry.name || entry.class || entry.partyName || entry.target || '').trim();
  }

  function resolveSupportingAffinity(entry, fallback) {
    var n;
    if (entry && typeof entry === 'object') {
      n = entry.affinity;
      if (n === undefined || n === null || n === '') n = entry.weight;
      if (n === undefined || n === null || n === '') n = entry.strength;
      n = parseFloat(n);
      if (isFinite(n)) return n;
    }
    n = parseFloat(fallback);
    return isFinite(n) ? n : 0.5;
  }

  function applyClassPartyCoupling(root, cls, satDelta, options) {
    var source = ensureRootContainers(root);
    options = options || {};
    ensureClassRuntime(cls);
    var delta = parseFloat(satDelta);
    if (!isFinite(delta) || delta === 0) {
      return { ok: false, className: cls && cls.name || '', applied: [], totalDelta: 0 };
    }
    var parties = ensurePartyState(source);
    var supportList = Array.isArray(cls.supportingParties) ? cls.supportingParties : [];
    if (!supportList.length) {
      return { ok: false, className: cls && cls.name || '', applied: [], totalDelta: 0 };
    }
    var weight = read('classToPartyWeight', source);
    if (weight === undefined || weight === null || weight === '') weight = 1;
    weight = parseFloat(weight);
    if (!isFinite(weight)) weight = 1;
    var defaultAffinity = read('classPartyDefaultAffinity', source);
    if (defaultAffinity === undefined || defaultAffinity === null || defaultAffinity === '') defaultAffinity = 0.5;
    defaultAffinity = parseFloat(defaultAffinity);
    if (!isFinite(defaultAffinity)) defaultAffinity = 0.5;

    var applied = [];
    var total = 0;
    supportList.forEach(function(entry) {
      var partyName = resolveSupportingPartyName(entry);
      if (!partyName) return;
      var affinity = resolveSupportingAffinity(entry, defaultAffinity);
      var partyDelta = delta * affinity * weight;
      if (!isFinite(partyDelta) || partyDelta === 0) return;
      var ps = parties[partyName];
      if (!ps) {
        ps = parties[partyName] = {
          name: partyName,
          influence: 30,
          cohesion: 50,
          reputationBalance: 0,
          alliedWith: [],
          conflictWith: [],
          neutralWith: [],
          officeCount: 0,
          recentImpeachWin: 0,
          recentImpeachLose: 0,
          recentPolicyWin: 0,
          recentPolicyLose: 0,
          lastShift: { turn: 0, influenceDelta: 0, cohesionDelta: 0, reason: '阶层耦合补建' },
          historyLog: []
        };
      }
      var oldC = parseTurnNumber(ps.cohesion);
      if (!isFinite(oldC) || oldC === 0) oldC = 50;
      var nextC = clamp(oldC + partyDelta, 0, 100);
      ps.cohesion = nextC;
      ps.lastShift = {
        turn: parseTurnNumber(source.turn || (options && options.turn)),
        influenceDelta: 0,
        cohesionDelta: partyDelta,
        reason: '阶层' + (cls.name || '') + '满意度变化'
      };
      if (entry && typeof entry === 'object') {
        entry.cohesionDelta = partyDelta;
        entry.cohesionBefore = oldC;
        entry.cohesionAfter = nextC;
        entry.cohesionTurn = parseTurnNumber(source.turn || (options && options.turn));
        entry.cohesionReason = cls.lastClassReason || (options && options.reason) || '';
      }
      if (!Array.isArray(ps.historyLog)) ps.historyLog = [];
      ps.historyLog.push({
        turn: ps.lastShift.turn,
        type: 'class-coupling',
        className: cls.name || '',
        cohesionDelta: partyDelta,
        reason: cls.lastClassReason || (options && options.reason) || ''
      });
      if (Array.isArray(source.parties)) {
        var partyObj = source.parties.find(function(p) { return p && p.name === partyName; });
        if (partyObj) partyObj.cohesion = nextC;
      }
      if (!Array.isArray(source._classPartyCouplingLog)) source._classPartyCouplingLog = [];
      source._classPartyCouplingLog.push({
        turn: parseTurnNumber(source.turn || (options && options.turn)),
        className: cls.name || '',
        partyName: partyName,
        cohesionDelta: partyDelta,
        affinity: affinity,
        weight: weight,
        reason: cls.lastClassReason || (options && options.reason) || ''
      });
      applied.push({ partyName: partyName, oldCohesion: oldC, newCohesion: nextC, delta: partyDelta, affinity: affinity });
      total += partyDelta;
      if (typeof global.addEB === 'function') {
        try {
          global.addEB('党争', (cls.name || '某阶层') + '情绪波动影响' + partyName + '凝聚力');
        } catch(_ebE) {}
      }
    });

    return {
      ok: applied.length > 0,
      className: cls.name || '',
      classKey: normalizeText(cls.name || ''),
      applied: applied,
      totalDelta: total,
      weight: weight,
      defaultAffinity: defaultAffinity
    };
  }

  function resolvePartyToClassWeight(root) {
    var weight = read('partyToClassWeight', root);
    if (weight === undefined || weight === null || weight === '') weight = 1;
    weight = parseFloat(weight);
    return isFinite(weight) ? weight : 1;
  }

  function getPolicySanction(root, grade) {
    var table = read('tinyiPolicySanctionByGrade', root);
    if (!table || typeof table !== 'object') table = { S: 16, A: 12, B: 9, C: 6, D: 3 };
    return parseTurnNumber(table[grade] || table.C || 6);
  }

  function normalizePartyNameList(list) {
    if (!list) return [];
    if (typeof list === 'string') list = [list];
    if (!Array.isArray(list)) return [];
    var seen = {};
    var out = [];
    list.forEach(function(item) {
      var name = typeof item === 'string' ? item : resolveSupportingPartyName(item);
      if (!name || seen[name]) return;
      seen[name] = true;
      out.push(name);
    });
    return out;
  }

  function buildPartyOutcomeDeltas(root, outcome) {
    outcome = outcome || {};
    var grade = outcome.grade || 'C';
    var sanction = getPolicySanction(root, grade);
    var strength = outcome.strength;
    if (strength === undefined || strength === null || strength === '') {
      var status = outcome.outcome || outcome.mode || outcome.sealStatus || 'issued';
      strength = { fulfilled: 1, issued: 1, partial: 0.6, contested: -0.3, blocked: -0.6 }[status];
      if (strength === undefined) strength = 1;
    }
    strength = parseFloat(strength);
    if (!isFinite(strength)) strength = 1;
    var sourceParty = outcome.sourceParty || outcome.proposerParty || '';
    var blockerParty = outcome.blockerParty || '';
    var opposers = normalizePartyNameList(outcome.opposingParties || outcome.oppositionParties || []);
    if (blockerParty) opposers = normalizePartyNameList([blockerParty].concat(opposers));
    var sourceBase = outcome.sourceDelta;
    var opposingBase = outcome.opposingDelta;
    if (sourceBase === undefined || sourceBase === null || sourceBase === '') {
      sourceBase = (outcome.sealStatus === 'blocked' || outcome.outcome === 'blocked') ? -(sanction / 4) : (sanction / 4);
    }
    if (opposingBase === undefined || opposingBase === null || opposingBase === '') {
      opposingBase = (outcome.sealStatus === 'blocked' || outcome.outcome === 'blocked') ? (sanction / 4) : -(sanction / 8);
    }
    sourceBase = parseFloat(sourceBase);
    opposingBase = parseFloat(opposingBase);
    if (!isFinite(sourceBase)) sourceBase = 0;
    if (!isFinite(opposingBase)) opposingBase = 0;
    var map = {};
    if (sourceParty) map[sourceParty] = (map[sourceParty] || 0) + sourceBase * Math.abs(strength);
    opposers.forEach(function(pn) {
      if (!pn || pn === sourceParty) return;
      map[pn] = (map[pn] || 0) + opposingBase * Math.abs(strength);
    });
    if (outcome.partyDeltas && typeof outcome.partyDeltas === 'object') {
      Object.keys(outcome.partyDeltas).forEach(function(pn) {
        var n = parseFloat(outcome.partyDeltas[pn]);
        if (isFinite(n)) map[pn] = (map[pn] || 0) + n;
      });
    }
    return map;
  }

  function applyPartyOutcomeToClasses(root, outcome, options) {
    var source = ensureRootContainers(root);
    options = options || {};
    var classes = getClasses(source);
    if (!classes.length) return { ok: false, applied: [], totalDelta: 0 };
    var partyDeltas = buildPartyOutcomeDeltas(source, outcome || {});
    var parties = Object.keys(partyDeltas);
    if (!parties.length) return { ok: false, applied: [], totalDelta: 0 };
    var weight = resolvePartyToClassWeight(source);
    var defaultAffinity = read('classPartyDefaultAffinity', source);
    if (defaultAffinity === undefined || defaultAffinity === null || defaultAffinity === '') defaultAffinity = 0.5;
    defaultAffinity = parseFloat(defaultAffinity);
    if (!isFinite(defaultAffinity)) defaultAffinity = 0.5;
    var turn = parseTurnNumber(source.turn || options.turn);
    var applied = [];
    var total = 0;
    classes.forEach(function(cls) {
      ensureClassRuntime(cls);
      var supportList = Array.isArray(cls.supportingParties) ? cls.supportingParties : [];
      if (!supportList.length) return;
      var classDelta = 0;
      var refs = [];
      supportList.forEach(function(entry) {
        var partyName = resolveSupportingPartyName(entry);
        if (!partyName || partyDeltas[partyName] === undefined) return;
        var affinity = resolveSupportingAffinity(entry, defaultAffinity);
        var d = partyDeltas[partyName] * affinity * weight;
        if (!isFinite(d) || d === 0) return;
        classDelta += d;
        refs.push({ partyName: partyName, outcome: outcome && (outcome.outcome || outcome.sealStatus || outcome.mode) || '', delta: d });
        if (entry && typeof entry === 'object') {
          entry.classDelta = d;
          entry.classDeltaTurn = turn;
        }
      });
      if (!classDelta) return;
      var oldSat = parseTurnNumber(cls.satisfaction) || 50;
      var nextSat = clamp(oldSat + classDelta, 0, 100);
      cls.satisfaction = nextSat;
      cls.lastPartyOutcomeRef = refs;
      cls.lastPartyOutcomeTurn = turn;
      if (!Array.isArray(cls.partyOutcomeHistory)) cls.partyOutcomeHistory = [];
      cls.partyOutcomeHistory.push({
        turn: turn,
        outcome: outcome && (outcome.outcome || outcome.sealStatus || outcome.mode) || '',
        grade: outcome && outcome.grade || '',
        satisfactionDelta: classDelta,
        refs: refs
      });
      if (!Array.isArray(source._partyClassCouplingLog)) source._partyClassCouplingLog = [];
      source._partyClassCouplingLog.push({
        turn: turn,
        className: cls.name || '',
        satisfactionDelta: classDelta,
        before: oldSat,
        after: nextSat,
        refs: refs,
        source: options.source || 'party-outcome'
      });
      refreshClassPhase(source, cls);
      applied.push({ className: cls.name || '', oldSatisfaction: oldSat, newSatisfaction: nextSat, delta: classDelta, refs: refs });
      total += classDelta;
    });
    return { ok: applied.length > 0, applied: applied, totalDelta: total, weight: weight, partyDeltas: partyDeltas };
  }

  function decayRecentPolicyScores(root, options) {
    var source = ensureRootContainers(root);
    var decay = read('recentPolicyDecay', source);
    if (decay === undefined || decay === null || decay === '') return { ok: false, decayed: 0, reason: 'missing recentPolicyDecay' };
    decay = parseFloat(decay);
    if (!isFinite(decay) || decay <= 0) return { ok: false, decayed: 0, reason: 'invalid recentPolicyDecay' };
    decay = Math.max(0, Math.min(1, decay));
    var parties = ensurePartyState(source);
    var turn = parseTurnNumber(source.turn || (options && options.turn));
    var decayed = 0;
    Object.keys(parties).forEach(function(pn) {
      var ps = parties[pn];
      if (!ps || typeof ps !== 'object') return;
      ['recentPolicyWin', 'recentPolicyLose', 'recentImpeachWin', 'recentImpeachLose'].forEach(function(k) {
        var old = parseFloat(ps[k]);
        if (!isFinite(old) || old === 0) return;
        ps[k] = Math.round(old * (1 - decay) * 100) / 100;
        decayed++;
      });
      ps.lastPolicyDecayTurn = turn;
    });
    return { ok: decayed > 0, decayed: decayed, decay: decay, turn: turn };
  }

  function deriveTagsFromReason(cc, cls, root) {
    var text = [
      cc && cc.reason,
      cc && cc.new_demands,
      cls && cls.demands,
      cls && cls.description
    ].filter(Boolean).join(' ');
    var lower = normalizeText(text);
    var tags = [];
    function has(re) { return re.test(lower); }
    if (has(/税|赋税|税负|钱粮|征敛|苛税/)) tags.push('tax');
    if (has(/徭|役|差役|服役|征发|民夫|工役/)) tags.push('corvee');
    if (has(/特权|门阀|世家|免役|荫封|优免|既得/)) tags.push('privilege');
    if (has(/宗教|寺|庙|僧|道|佛|教门|香火|清规/)) tags.push('religion');
    if (has(/军|兵|征发|募兵|军户|戍边|调兵|武力/)) tags.push('military');
    if (has(/法|律|刑|案|冤|狱|官司|审判|缉捕/)) tags.push('law');
    if (has(/外贸|海贸|互市|边贸|禁海|海禁|关税|番商|通商/)) tags.push('foreign_trade');
    if (tags.length === 0) tags.push('privilege');
    return tags;
  }

  function getDeltaForTag(matrix, tag, classKey) {
    var row = matrix && matrix[tag];
    if (!row) return { satisfaction: 0, influence: 0 };
    return clone(row[classKey] || row.default || row.general || { satisfaction: 0, influence: 0 });
  }

  function applyClassChange(root, cls, cc, options) {
    var source = ensureRootContainers(root);
    if (!cls || !cc || !cc.name) return { ok: false, reason: 'missing class or change' };
    ensureClassRuntime(cls);
    var classKeys = resolvePopulationKeys(cls, source);
    var classKey = classKeys[0] || normalizeText(cls.name || cc.name || 'class');
    var matrix = read('classTagDeltaMatrix', source) || {};
    var tags = deriveTagsFromReason(cc, cls, source);
    var baseline = { satisfaction: 0, influence: 0 };
    tags.forEach(function(tag) {
      var delta = getDeltaForTag(matrix, tag, classKey);
      baseline.satisfaction += parseTurnNumber(delta.satisfaction);
      baseline.influence += parseTurnNumber(delta.influence);
    });

    var aiSat = parseTurnNumber(cc.satisfaction_delta);
    var aiInf = parseTurnNumber(cc.influence_delta);
    var satLimit = Math.max(1, Math.round(Math.max(1, Math.abs(baseline.satisfaction)) * 0.3));
    var infLimit = Math.max(1, Math.round(Math.max(1, Math.abs(baseline.influence)) * 0.3));
    var satAi = clamp(aiSat, -satLimit, satLimit);
    var infAi = clamp(aiInf, -infLimit, infLimit);
    var totalSatDelta = baseline.satisfaction + satAi;
    var totalInfDelta = baseline.influence + infAi;
    var oldSat = parseTurnNumber(cls.satisfaction) || 50;
    var oldInf = parseTurnNumber(cls.influence || cls.classInfluence) || 50;
    var nextSat = clamp(oldSat + totalSatDelta, 0, 100);
    var nextInf = clamp(oldInf + totalInfDelta, 0, 100);

    cls.satisfaction = nextSat;
    cls.influence = nextInf;
    if (cc.new_demands !== undefined) cls.demands = cc.new_demands;
    if (cc.new_status !== undefined) cls.status = cc.new_status;
    if (cc.reason) cls.lastClassReason = cc.reason;

    var levels = cls.unrestLevels || (cls.unrestLevels = { grievance: 60, petition: 70, strike: 80, revolt: 90 });
    var unrestShift = 0;
    if (totalSatDelta < 0) unrestShift += Math.abs(totalSatDelta) * 1.1;
    else if (totalSatDelta > 0) unrestShift -= totalSatDelta * 0.6;
    if (totalInfDelta < 0) unrestShift += Math.abs(totalInfDelta) * 0.4;
    else if (totalInfDelta > 0) unrestShift -= totalInfDelta * 0.2;
    if (tags.indexOf('tax') >= 0) unrestShift += 2;
    if (tags.indexOf('corvee') >= 0) unrestShift += 2;
    if (tags.indexOf('privilege') >= 0) unrestShift += 1;

    var move = Math.round(Math.max(-8, Math.min(8, unrestShift)));
    if (move > 0) {
      levels.grievance = clamp((levels.grievance || 60) - move * 1.0, 0, 100);
      levels.petition = clamp((levels.petition || 70) - move * 0.7, 0, 100);
      levels.strike = clamp((levels.strike || 80) - move * 0.5, 0, 100);
      levels.revolt = clamp((levels.revolt || 90) - move * 0.35, 0, 100);
    } else if (move < 0) {
      var relax = Math.abs(move);
      levels.grievance = clamp((levels.grievance || 60) + relax * 0.8, 0, 100);
      levels.petition = clamp((levels.petition || 70) + relax * 0.6, 0, 100);
      levels.strike = clamp((levels.strike || 80) + relax * 0.45, 0, 100);
      levels.revolt = clamp((levels.revolt || 90) + relax * 0.3, 0, 100);
    }

    var result = {
      ok: true,
      className: cls.name || cc.name,
      classKey: classKey,
      tags: tags,
      baseline: clone(baseline),
      ai: { satisfaction: satAi, influence: infAi },
      applied: { satisfaction: totalSatDelta, influence: totalInfDelta },
      before: { satisfaction: oldSat, influence: oldInf },
      after: { satisfaction: nextSat, influence: nextInf },
      clamp: { satisfaction: satLimit, influence: infLimit },
      turn: parseTurnNumber(source.turn || (options && options.turn))
    };
    result.partyCoupling = applyClassPartyCoupling(source, cls, totalSatDelta, {
      turn: result.turn,
      source: options && options.source || 'class-change',
      reason: cc.reason || ''
    });
    cls._lastClassChange = clone(result);
    cls._populationBridgeMode = cls._populationBridgeMode || 'population';
    cls._lastClassUpdateTurn = result.turn;
    return result;
  }

  function refreshClassPhase(root, cls) {
    var source = ensureRootContainers(root);
    ensureClassRuntime(cls);
    var revolt = cls.unrestLevels && parseTurnNumber(cls.unrestLevels.revolt);
    if (!revolt) revolt = 90;
    var sat = parseTurnNumber(cls.satisfaction);
    var state = cls.revoltState || (cls.revoltState = { phase: 'calm', turns: 0, lastTurn: 0, note: '' });
    var phase = state.phase || 'calm';
    var nextPhase = phase;
    var note = '';
    if (revolt <= 20 || sat <= 30) {
      nextPhase = 'uprising';
      note = '临界已到';
    } else if (revolt <= 35 || sat <= 45) {
      nextPhase = 'brewing';
      note = '局势趋紧';
    } else {
      nextPhase = 'calm';
    }

    if (nextPhase === 'brewing') {
      state.turns = phase === 'brewing' ? (parseTurnNumber(state.turns) + 1) : 1;
      if (state.turns >= 12) {
        nextPhase = 'uprising';
        note = '酝酿已久';
        state.turns = Math.max(state.turns, 12);
      }
    } else if (nextPhase === 'uprising') {
      state.turns = Math.max(12, parseTurnNumber(state.turns) + 1);
    } else {
      state.turns = 0;
    }

    var changed = nextPhase !== phase;
    state.phase = nextPhase;
    state.lastTurn = parseTurnNumber(source.turn);
    state.note = note;
    if (changed || nextPhase !== 'calm') mergeAlert(source, cls, nextPhase, note);
    return {
      className: cls.name || '',
      phase: nextPhase,
      changed: changed,
      turns: state.turns,
      revolt: revolt,
      satisfaction: sat
    };
  }

  function syncPopulationBridge(root, options) {
    var source = ensureRootContainers(root);
    options = options || {};
    var mode = options.mode || 'refresh';
    var classes = getClasses(source);
    var result = {
      mode: mode,
      classes: [],
      bridged: 0,
      seeded: 0,
      refreshed: 0,
      alerts: []
    };
    var pop = source.population;
    var nationalMouths = parseTurnNumber(pop.national && pop.national.mouths);
    classes.forEach(function(cls) {
      if (!cls || typeof cls !== 'object') return;
      ensureClassRuntime(cls);
      var keys = resolvePopulationKeys(cls, source);
      var current = sumBuckets(pop, keys);
      var share = parseSizeShare(cls.size);
      var hiddenMouths = parseTurnNumber(cls._populationMouths);
      var nextMouths = current;
      if (mode === 'bootstrap') {
        if (hiddenMouths > 0) nextMouths = hiddenMouths;
        else if (share !== null && nationalMouths > 0) nextMouths = Math.round(nationalMouths * share);
        else if (current > 0) nextMouths = current;
        if (nextMouths > 0) {
          writeBuckets(pop, keys, nextMouths);
          cls._populationBridgeMode = 'bootstrap';
          cls._populationMouths = nextMouths;
          cls._populationShare = nationalMouths > 0 ? (nextMouths / nationalMouths) : (share || 0);
          if (share !== null || !cls.size) cls.size = formatSizeText(cls._populationShare);
          result.seeded++;
        }
      } else {
        nextMouths = current > 0 ? current : hiddenMouths;
        if (current > 0) {
          cls._populationBridgeMode = 'population';
          cls._populationMouths = current;
          cls._populationShare = nationalMouths > 0 ? (current / nationalMouths) : (share || 0);
          if (options.writeSize !== false) cls.size = formatSizeText(cls._populationShare);
          result.refreshed++;
        } else if (share !== null && nationalMouths > 0) {
          nextMouths = Math.round(nationalMouths * share);
          writeBuckets(pop, keys, nextMouths);
          cls._populationBridgeMode = 'bootstrap';
          cls._populationMouths = nextMouths;
          cls._populationShare = nextMouths / nationalMouths;
          if (options.writeSize !== false) cls.size = formatSizeText(cls._populationShare);
          result.seeded++;
        }
      }
      result.bridged += 1;
      result.classes.push({
        name: cls.name || '',
        keys: keys,
        mouths: parseTurnNumber(cls._populationMouths),
        phase: cls.revoltState && cls.revoltState.phase || 'calm'
      });
      result.alerts.push(refreshClassPhase(source, cls));
    });
    return result;
  }

  function bootstrap(root, options) {
    options = options || {};
    options.mode = 'bootstrap';
    options.writeSize = options.writeSize !== false;
    return syncPopulationBridge(root, options);
  }

  function refresh(root, options) {
    options = options || {};
    options.mode = 'refresh';
    if (options.writeSize === undefined) options.writeSize = true;
    return syncPopulationBridge(root, options);
  }

  function finalizeTurn(root, payload, options) {
    var source = ensureRootContainers(root);
    var summary = refresh(source, options || {});
    summary.policyDecay = decayRecentPolicyScores(source, options || {});
    if (payload && Array.isArray(payload.class_changes)) {
      payload.class_changes.forEach(function(cc) {
        var cls = getClasses(source).find(function(c) { return c && c.name === cc.name; });
        if (cls) summary.alerts.push(refreshClassPhase(source, cls));
      });
    }
    return summary;
  }

  function applyTurn(root, payload, options) {
    var source = ensureRootContainers(root);
    var summary = {
      bridge: refresh(source, options || {}),
      applied: []
    };
    if (payload && Array.isArray(payload.class_changes)) {
      payload.class_changes.forEach(function(cc) {
        var cls = getClasses(source).find(function(c) { return c && c.name === cc.name; });
        if (!cls) return;
        summary.applied.push(applyClassChange(source, cls, cc, options || {}));
        summary.bridge.alerts.push(refreshClassPhase(source, cls));
      });
    }
    if (Array.isArray(payload && payload.class_emerge)) {
      payload.class_emerge.forEach(function(ce) {
        var cls = getClasses(source).find(function(c) { return c && c.name === ce.name; });
        if (cls) summary.bridge.alerts.push(refreshClassPhase(source, cls));
      });
    }
    if (Array.isArray(payload && payload.class_revolt)) {
      payload.class_revolt.forEach(function(rv) {
        var cls = getClasses(source).find(function(c) { return c && c.name === rv.class; });
        if (cls) {
          ensureClassRuntime(cls);
          cls.revoltState.phase = 'uprising';
          cls.revoltState.turns = Math.max(12, parseTurnNumber(cls.revoltState.turns) + 1);
          cls.revoltState.note = rv.reason || 'AI 触发起义';
          summary.bridge.alerts.push(mergeAlert(source, cls, 'uprising', cls.revoltState.note));
        }
      });
    }
    return summary;
  }

  var api = {
    currentVersion: 1,
    bootstrap: bootstrap,
    refresh: refresh,
    syncPopulationBridge: syncPopulationBridge,
    finalizeTurn: finalizeTurn,
    applyTurn: applyTurn,
    applyClassChange: applyClassChange,
    applyClassPartyCoupling: applyClassPartyCoupling,
    applyPartyOutcomeToClasses: applyPartyOutcomeToClasses,
    decayRecentPolicyScores: decayRecentPolicyScores,
    buildAlertPrompt: buildAlertPrompt,
    applyAlertResponses: applyAlertResponses,
    activeAlerts: activeAlerts,
    refreshClassPhase: refreshClassPhase,
    ensureClassRuntime: ensureClassRuntime,
    resolvePopulationKeys: resolvePopulationKeys,
    parseSizeShare: parseSizeShare,
    formatSizeText: formatSizeText,
    deriveTagsFromReason: deriveTagsFromReason,
    constantsOf: constantsOf,
    read: read,
    clone: clone
  };

  TM.ClassEngine = api;
  global.ClassEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
