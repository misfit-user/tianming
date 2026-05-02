// @ts-check
/*
 * tm-influence-groups.js
 * Phase 3 slice 1: runtime state container for court influence groups.
 */
(function(global) {
  'use strict';

  var TM = global.TM = global.TM || {};

  var GROUP_NAMES = {
    eunuch: '\u5ba6\u5b98',
    waiqi: '\u5916\u621a',
    consort: '\u540e\u5bab'
  };

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
      .replace(/[\s\-_.,;:!?()[\]{}"'`~\u3000\u3001\uff0c\u3002\uff1b\uff1a\uff01\uff1f\uff08\uff09\u00b7]/g, '');
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

  function legacyCatalog() {
    return {
      eunuch: {
        name: GROUP_NAMES.eunuch,
        type: 'eunuch',
        titleKeywords: ['\u592a\u76d1', '\u53f8\u793c\u76d1', '\u4e1c\u5382', '\u897f\u5382', '\u9526\u8863\u536b', '\u5185\u5ef7', '\u79c9\u7b14', '\u638c\u5370', '\u5fa1\u9a6c\u76d1', '\u5185\u4f8d'],
        occupationKeywords: ['\u5ba6\u5b98', '\u592a\u76d1', '\u5185\u4f8d'],
        keyOffices: ['\u53f8\u793c\u76d1\u638c\u5370', '\u53f8\u793c\u76d1\u79c9\u7b14', '\u4e1c\u5382\u63d0\u7763', '\u9526\u8863\u536b\u6307\u6325\u4f7f'],
        influenceBaseline: 30,
        officeWeight: 4
      },
      waiqi: {
        name: GROUP_NAMES.waiqi,
        type: 'waiqi',
        relationKeywords: ['empress_family', 'consort_family', '\u7687\u540e\u6bcd\u5bb6', '\u540e\u65cf'],
        titleKeywords: ['\u56fd\u8205', '\u627f\u6069\u516c', '\u9a78\u9a6c', '\u5916\u621a', '\u540e\u65cf'],
        keyOffices: ['\u627f\u6069\u516c', '\u56fd\u8205', '\u9a78\u9a6c'],
        influenceBaseline: 25,
        officeWeight: 3
      },
      consort: {
        name: GROUP_NAMES.consort,
        type: 'consort',
        relationKeywords: ['empress', 'consort', 'former_empress', 'emperor_spouse', '\u7687\u540e', '\u540e\u5983'],
        titleKeywords: ['\u7687\u540e', '\u8d35\u5983', '\u5983', '\u5ad4', '\u9009\u4f8d', '\u592a\u540e', '\u7687\u592a\u540e', '\u61ff\u5b89\u7687\u540e'],
        keyOffices: ['\u7687\u540e', '\u592a\u540e', '\u7687\u592a\u540e'],
        influenceBaseline: 20,
        officeWeight: 3
      }
    };
  }

  function getCatalog(root) {
    var catalog = read('influenceGroupCatalog', root);
    if (catalog && typeof catalog === 'object') return catalog;
    return legacyCatalog();
  }

  function getChars(root) {
    var source = pickRoot(root);
    if (Array.isArray(source.chars)) return source.chars;
    if (Array.isArray(source.characters)) return source.characters;
    if (source.scriptData && Array.isArray(source.scriptData.characters)) return source.scriptData.characters;
    if (global.GM && Array.isArray(global.GM.chars)) return global.GM.chars;
    return [];
  }

  function getDeclaredGroups(root) {
    var source = pickRoot(root);
    if (Array.isArray(source.influenceGroups)) return source.influenceGroups;
    if (source.scriptData && Array.isArray(source.scriptData.influenceGroups)) return source.scriptData.influenceGroups;
    if (global.scriptData && Array.isArray(global.scriptData.influenceGroups)) return global.scriptData.influenceGroups;
    if (global.P && Array.isArray(global.P.influenceGroups)) return global.P.influenceGroups;
    return [];
  }

  function ensureRootContainers(root) {
    var source = pickRoot(root);
    if (!source.influenceGroupState || typeof source.influenceGroupState !== 'object') {
      source.influenceGroupState = {};
    }
    return source;
  }

  function ensureCharacterRuntime(ch) {
    if (!ch || typeof ch !== 'object') return null;
    if (ch.health === undefined || ch.health === null || ch.health === '') ch.health = 80;
    return ch;
  }

  function textOfChar(ch) {
    return [
      ch && ch.name,
      ch && ch.title,
      ch && ch.officialTitle,
      ch && ch.position,
      ch && ch.occupation,
      ch && ch.role,
      ch && ch.faction,
      ch && ch.party,
      ch && ch.royalRelation,
      ch && ch.spouseRank,
      ch && ch.family,
      ch && ch.clan
    ].join(' ');
  }

  function containsAny(text, keywords) {
    var hay = normalizeText(text);
    return toArray(keywords).some(function(k) {
      return k && hay.indexOf(normalizeText(k)) >= 0;
    });
  }

  function isFemale(ch) {
    var g = String((ch && ch.gender) || '').toLowerCase();
    return g === 'female' || g === '\u5973' || g === 'f';
  }

  function isMale(ch) {
    var g = String((ch && ch.gender) || '').toLowerCase();
    if (!g) return true;
    return g === 'male' || g === '\u7537' || g === 'm';
  }

  function isEmperorLike(ch, text) {
    if (!ch) return false;
    if (ch.isEmperor || ch.isRuler || ch.role === 'emperor') return true;
    if (ch.isPlayer && ch.royalRelation === 'emperor_family') return true;
    var hay = text || textOfChar(ch);
    return containsAny(hay, ['\u7687\u5e1d', '\u5929\u5b50', '\u541b\u4e3b', '\u56fd\u541b']);
  }

  function classifyChar(ch, catalog) {
    if (!ch || ch.alive === false || ch.dead === true) return [];
    var text = textOfChar(ch);
    var out = [];
    var eunuch = catalog.eunuch || {};
    var consort = catalog.consort || {};
    var waiqi = catalog.waiqi || {};

    if (containsAny(text, eunuch.titleKeywords) || containsAny(text, eunuch.occupationKeywords)) {
      out.push('eunuch');
    }
    var hasConsortRank = !!(ch.spouseRank || containsAny(text, consort.titleKeywords));
    var hasConsortRelation = !!(ch.royalRelation || containsAny(text, consort.relationKeywords));
    if (isFemale(ch) && hasConsortRank && hasConsortRelation) {
      out.push('consort');
    }
    var hasWaiqiRelation = containsAny(text, waiqi.relationKeywords);
    var hasExplicitWaiqiTitle = containsAny(text, ['\u56fd\u8205', '\u5916\u621a', '\u540e\u65cf', '\u7687\u540e\u6bcd\u5bb6', '\u627f\u6069\u516c', '\u9a78\u9a6c']);
    var hasWaiqiOffice = containsAny(text, waiqi.keyOffices);
    if (!isFemale(ch) && !isEmperorLike(ch, text) && (hasWaiqiRelation || hasExplicitWaiqiTitle || (hasWaiqiOffice && hasWaiqiRelation))) {
      out.push('waiqi');
    }
    return out;
  }

  function findRulerCandidate(root) {
    var source = pickRoot(root);
    var chars = getChars(source);
    var pi = source.playerInfo || (source.scriptData && source.scriptData.playerInfo) || {};
    var names = [];
    if (pi.characterName) names.push(pi.characterName);
    if (source.emperor) names.push(source.emperor);
    if (source.ruler) names.push(source.ruler);
    if (source.currentRuler) names.push(source.currentRuler);
    for (var i = 0; i < names.length; i++) {
      var found = chars.find(function(c) { return c && c.name === names[i]; });
      if (found) return found;
    }
    return chars.find(function(c) {
      if (!c) return false;
      var text = textOfChar(c);
      return !!(c.isEmperor || c.isRuler || c.role === 'emperor' || containsAny(text, ['\u7687\u5e1d', '\u5929\u5b50', '\u541b\u4e3b', '\u56fd\u541b']));
    }) || null;
  }

  function buildRegentSignal(root) {
    var source = pickRoot(root);
    var ec = constantsOf(source) || {};
    var pi = source.playerInfo || (source.scriptData && source.scriptData.playerInfo) || {};
    var ruler = findRulerCandidate(source);
    var turn = Number(source.turn || 0) || 0;
    var age = ruler ? Number(ruler.age || ruler.characterAge || ruler.yearsOld || ruler.ageYears || 0) : 0;
    var health = ruler ? Number(ruler.health || (ruler.resources && ruler.resources.health) || ruler.hp || ruler.vitality || 100) : 100;
    if (!isFinite(age)) age = 0;
    if (!isFinite(health)) health = 100;
    var ageMin = Number(ec.regentTriggerAgeMin);
    if (!isFinite(ageMin) || ageMin <= 0) ageMin = 14;
    var healthMax = Number(ec.regentTriggerHealthMax);
    if (!isFinite(healthMax) || healthMax < 0) healthMax = 30;
    var forceAgeMax = Number(ec.regentForceAgeMax);
    if (!isFinite(forceAgeMax) || forceAgeMax <= 0) forceAgeMax = 10;
    var forceTurnMax = Number(ec.regentForceTurnMax);
    if (!isFinite(forceTurnMax) || forceTurnMax <= 0) forceTurnMax = 6;
    var role = String(pi.playerRole || '').toLowerCase();
    var reasons = [];
    var active = false;
    var hardCeiling = false;

    if (role === 'regent') {
      active = true;
      hardCeiling = true;
      reasons.push('playerRole=regent');
    }
    if (ruler && age > 0 && age <= ageMin) {
      active = true;
      reasons.push('age<=' + ageMin);
    }
    if (ruler && health <= healthMax) {
      active = true;
      reasons.push('health<=' + healthMax);
    }
    if (ruler && age > 0 && age <= forceAgeMax) {
      active = true;
      hardCeiling = true;
      reasons.push('forceAge<=' + forceAgeMax);
    }
    if (active && turn > 0 && turn <= forceTurnMax) {
      hardCeiling = true;
      reasons.push('turn<=' + forceTurnMax);
    }

    return {
      active: active,
      hardCeiling: hardCeiling,
      rulerName: ruler && ruler.name || '',
      rulerTitle: ruler ? (ruler.officialTitle || ruler.title || ruler.position || '') : '',
      rulerAge: ruler ? (age || null) : null,
      rulerHealth: ruler ? health : null,
      playerRole: role || '',
      turn: turn,
      thresholds: {
        ageMin: ageMin,
        healthMax: healthMax,
        forceAgeMax: forceAgeMax,
        forceTurnMax: forceTurnMax
      },
      reasons: reasons,
      source: active ? (hardCeiling ? 'hard-ceiling' : 'threshold') : 'none'
    };
  }

  function charScore(ch, groupType, catalogEntry) {
    var score = 0;
    score += Number(ch.influence || ch.partyInfluence || ch.prestige || ch.favor || 0) || 0;
    if (containsAny(textOfChar(ch), catalogEntry && catalogEntry.keyOffices)) score += 30;
    if (groupType === 'eunuch' && (ch.isImperialFavorite || /favorite/i.test(String(ch.tags || '')))) score += 15;
    if (groupType === 'consort' && (ch.spouseRank === 'empress' || containsAny(textOfChar(ch), ['\u7687\u540e', '\u592a\u540e']))) score += 25;
    return score;
  }

  function matchKeyOffice(ch, catalogEntry) {
    var text = textOfChar(ch);
    var found = [];
    toArray(catalogEntry && catalogEntry.keyOffices).forEach(function(k) {
      if (k && containsAny(text, [k])) found.push(k);
    });
    if (!found.length && containsAny(text, catalogEntry && catalogEntry.titleKeywords)) {
      var title = ch.officialTitle || ch.title || ch.position || '';
      if (title) found.push(title);
    }
    return found;
  }

  function makeEmptyGroup(name, type, baseline, candidateBy) {
    return {
      name: name,
      type: type,
      influence: clamp(baseline, 0, 100),
      cohesion: 50,
      reputationBalance: 0,
      members: [],
      officeCount: 0,
      leader: '',
      keyOffices: [],
      candidateBy: candidateBy || 'auto',
      recentImpeachWin: 0,
      recentImpeachLose: 0,
      recentPolicyWin: 0,
      recentPolicyLose: 0,
      historyLog: [],
      lastShift: { turn: 0, influenceDelta: 0, cohesionDelta: 0, reason: 'init' }
    };
  }

  function normalizeDeclaredGroup(group) {
    if (!group || typeof group !== 'object') return null;
    var type = group.type || group.kind || 'custom';
    var name = group.name || GROUP_NAMES[type] || type;
    return {
      name: name,
      type: type,
      leader: group.leader || '',
      members: toArray(group.members),
      initialInfluence: group.initialInfluence !== undefined ? group.initialInfluence : group.influence,
      initialCohesion: group.initialCohesion !== undefined ? group.initialCohesion : (group.initialCohion !== undefined ? group.initialCohion : group.cohesion),
      keyOffices: toArray(group.keyOffices),
      candidateBy: group.candidateBy || 'script',
      raw: group
    };
  }

  function upsertGroup(source, name, type, baseline, candidateBy) {
    var existing = source.influenceGroupState[name];
    if (!existing || typeof existing !== 'object') {
      existing = makeEmptyGroup(name, type, baseline, candidateBy);
      source.influenceGroupState[name] = existing;
    }
    existing.name = existing.name || name;
    existing.type = existing.type || type;
    if (existing.influence === undefined || existing.influence === null || existing.influence === '') existing.influence = clamp(baseline, 0, 100);
    if (existing.cohesion === undefined || existing.cohesion === null || existing.cohesion === '') existing.cohesion = 50;
    if (!Array.isArray(existing.members)) existing.members = [];
    if (!Array.isArray(existing.keyOffices)) existing.keyOffices = [];
    if (!Array.isArray(existing.historyLog)) existing.historyLog = [];
    if (!existing.lastShift || typeof existing.lastShift !== 'object') existing.lastShift = { turn: 0, influenceDelta: 0, cohesionDelta: 0, reason: 'init' };
    existing.influence = clamp(existing.influence, 0, 100);
    existing.cohesion = clamp(existing.cohesion, 0, 100);
    existing.candidateBy = candidateBy || existing.candidateBy || 'auto';
    return existing;
  }

  function addMember(group, ch, catalogEntry) {
    if (!group || !ch || !ch.name) return;
    if (group.members.indexOf(ch.name) < 0) group.members.push(ch.name);
    var offices = matchKeyOffice(ch, catalogEntry);
    offices.forEach(function(o) {
      if (o && group.keyOffices.indexOf(o) < 0) group.keyOffices.push(o);
    });
  }

  function mergeUniqueList(base, extra) {
    var out = toArray(base);
    toArray(extra).forEach(function(v) {
      if (v && out.indexOf(v) < 0) out.push(v);
    });
    return out;
  }

  function pickLeader(group, chars, type, catalogEntry) {
    if (group.leader && group.members.indexOf(group.leader) >= 0) return group.leader;
    var best = null;
    var bestScore = -Infinity;
    group.members.forEach(function(name) {
      var ch = chars.find(function(c) { return c && c.name === name; });
      if (!ch) return;
      var score = charScore(ch, type, catalogEntry);
      if (score > bestScore) {
        best = ch;
        bestScore = score;
      }
    });
    return best ? best.name : (group.members[0] || '');
  }

  function refreshDerived(group, chars, type, catalogEntry, baseline) {
    group.members = toArray(group.members).filter(function(v, idx, arr) { return v && arr.indexOf(v) === idx; });
    group.keyOffices = toArray(group.keyOffices).filter(function(v, idx, arr) { return v && arr.indexOf(v) === idx; });
    group.officeCount = group.keyOffices.length;
    group.leader = pickLeader(group, chars, type, catalogEntry);
    if (group._autoInfluenceSeeded !== true && group.candidateBy === 'auto') {
      var officeWeight = Number(catalogEntry && catalogEntry.officeWeight);
      if (!isFinite(officeWeight)) officeWeight = 3;
      group.influence = clamp(Number(baseline || 0) + Math.min(20, group.officeCount * officeWeight) + Math.min(15, Math.max(0, group.members.length - 1) * 2), 0, 100);
      group._autoInfluenceSeeded = true;
    }
    group.influence = clamp(group.influence, 0, 100);
    group.cohesion = clamp(group.cohesion, 0, 100);
    return group;
  }

  function bootstrap(root, options) {
    var source = ensureRootContainers(root);
    options = options || {};
    var catalog = getCatalog(source);
    var chars = getChars(source);
    chars.forEach(ensureCharacterRuntime);

    var touched = {};
    var explicitByType = {};
    var explicitCount = 0;
    getDeclaredGroups(source).map(normalizeDeclaredGroup).filter(Boolean).forEach(function(g) {
      var cat = catalog[g.type] || {};
      var baseline = g.initialInfluence !== undefined ? g.initialInfluence : (cat.influenceBaseline || 30);
      var existed = !!(source.influenceGroupState && source.influenceGroupState[g.name]);
      var state = upsertGroup(source, g.name, g.type, baseline, g.candidateBy);
      state.candidateBy = 'script';
      if (!existed && state._scriptSeeded !== true) {
        state.influence = clamp(g.initialInfluence !== undefined ? g.initialInfluence : state.influence, 0, 100);
        state.cohesion = clamp(g.initialCohesion !== undefined ? g.initialCohesion : state.cohesion, 0, 100);
        state.members = toArray(g.members);
        state.keyOffices = toArray(g.keyOffices);
        state.leader = g.leader || state.leader;
        state._scriptSeeded = true;
      } else {
        state.members = mergeUniqueList(state.members, g.members);
        state.keyOffices = mergeUniqueList(state.keyOffices, g.keyOffices);
        if (!state.leader && g.leader) state.leader = g.leader;
      }
      touched[g.name] = true;
      if (g.type) explicitByType[g.type] = g.name;
      explicitCount += 1;
    });

    var autoCount = 0;
    chars.forEach(function(ch) {
      var types = classifyChar(ch, catalog);
      types.forEach(function(type) {
        var cat = catalog[type] || {};
        var name = explicitByType[type] || cat.name || GROUP_NAMES[type] || type;
        if (touched[name] && source.influenceGroupState[name] && source.influenceGroupState[name].candidateBy === 'script') {
          addMember(source.influenceGroupState[name], ch, cat);
          return;
        }
        var state = upsertGroup(source, name, type, cat.influenceBaseline || 30, 'auto');
        addMember(state, ch, cat);
        touched[name] = true;
        autoCount += 1;
      });
    });

    Object.keys(touched).forEach(function(name) {
      var group = source.influenceGroupState[name];
      if (!group) return;
      var cat2 = catalog[group.type] || {};
      refreshDerived(group, chars, group.type, cat2, cat2.influenceBaseline || group.influence || 30);
    });

    source._influenceGroupBootstrap = {
      version: 1,
      turn: Number(source.turn || (options && options.turn) || 0) || 0,
      explicitGroups: explicitCount,
      autoHits: autoCount,
      groups: Object.keys(source.influenceGroupState)
    };
    return {
      ok: true,
      groups: Object.keys(source.influenceGroupState).length,
      explicitGroups: explicitCount,
      autoHits: autoCount
    };
  }

  function getGroup(root, name) {
    var source = ensureRootContainers(root);
    return source.influenceGroupState && source.influenceGroupState[name] || null;
  }

  function clampInfluenceDelta(root, baselineDelta, aiDelta) {
    var clampRatio = read('influenceGroupAiClamp', root);
    if (clampRatio === undefined || clampRatio === null || clampRatio === '') clampRatio = 0.3;
    clampRatio = Math.max(0, Number(clampRatio) || 0.3);
    var base = Number(baselineDelta) || 0;
    var ai = Number(aiDelta) || 0;
    var limit = Math.max(1, Math.ceil(Math.abs(base) * clampRatio));
    return clamp(ai, -limit, limit);
  }

  function applyInfluenceChange(root, groupName, change, options) {
    var source = ensureRootContainers(root);
    options = options || {};
    change = change || {};
    var group = source.influenceGroupState[groupName];
    if (!group) return { ok: false, reason: 'missing-group', group: groupName };
    var rawBaseline = change.baselineDelta !== undefined ? change.baselineDelta : (change.influenceDelta !== undefined ? change.influenceDelta : 0);
    var baselineDelta = Number(rawBaseline);
    if (!isFinite(baselineDelta)) return { ok: false, reason: 'invalid-delta', group: groupName, baselineDelta: null, totalDelta: null };
    if (change.aiDelta !== undefined && !isFinite(Number(change.aiDelta))) {
      return { ok: false, reason: 'invalid-delta', group: groupName, baselineDelta: baselineDelta, aiDelta: null, totalDelta: null };
    }
    var cohesionDelta = Number(change.cohesionDelta || 0);
    if (!isFinite(cohesionDelta)) return { ok: false, reason: 'invalid-delta', group: groupName, baselineDelta: baselineDelta, totalDelta: null };
    var aiDelta = change.aiDelta === undefined ? 0 : clampInfluenceDelta(source, baselineDelta, change.aiDelta);
    if (!isFinite(aiDelta)) return { ok: false, reason: 'invalid-delta', group: groupName, baselineDelta: baselineDelta, aiDelta: null, totalDelta: null };
    var total = baselineDelta + aiDelta;
    if (!isFinite(total)) return { ok: false, reason: 'invalid-delta', group: groupName, baselineDelta: baselineDelta, aiDelta: aiDelta, totalDelta: null };
    var oldInfluence = Number(group.influence) || 0;
    group.influence = clamp(oldInfluence + total, 0, 100);
    if (cohesionDelta) group.cohesion = clamp((Number(group.cohesion) || 50) + cohesionDelta, 0, 100);
    group.lastShift = {
      turn: Number(source.turn || options.turn || 0) || 0,
      influenceDelta: total,
      cohesionDelta: cohesionDelta,
      reason: change.reason || options.reason || ''
    };
    if (!Array.isArray(group.historyLog)) group.historyLog = [];
    group.historyLog.push(clone(group.lastShift));
    if (group.historyLog.length > 40) group.historyLog = group.historyLog.slice(-40);
    return {
      ok: true,
      group: groupName,
      before: oldInfluence,
      after: group.influence,
      baselineDelta: baselineDelta,
      aiDelta: aiDelta,
      totalDelta: total
    };
  }

  function describeInfluence(value) {
    var v = clamp(value, 0, 100);
    if (v >= 80) return 'dominant';
    if (v >= 60) return 'strong';
    if (v >= 40) return 'present';
    if (v >= 20) return 'weak';
    return 'spent';
  }

  function findCharByNameIn(root, name) {
    if (!name) return null;
    var chars = getChars(root);
    for (var i = 0; i < chars.length; i += 1) {
      if (chars[i] && chars[i].name === name) return chars[i];
    }
    return null;
  }

  function pushGroupHistory(root, group, type, text, extra) {
    if (!group) return null;
    if (!Array.isArray(group.historyLog)) group.historyLog = [];
    var entry = {
      turn: Number(root && root.turn || 0) || 0,
      type: type || 'evolution',
      text: text || ''
    };
    Object.keys(extra || {}).forEach(function(k) { entry[k] = extra[k]; });
    group.historyLog.push(entry);
    if (group.historyLog.length > 40) group.historyLog = group.historyLog.slice(-40);
    group.lastShift = {
      turn: entry.turn,
      influenceDelta: Number(entry.influenceDelta || 0) || 0,
      cohesionDelta: Number(entry.cohesionDelta || 0) || 0,
      reason: entry.text
    };
    return entry;
  }

  function findEunuchSuccessor(root, group, catalogEntry) {
    var chars = getChars(root);
    var best = null;
    var bestScore = -Infinity;
    toArray(group.members).forEach(function(name) {
      if (!name || name === group.leader) return;
      var ch = findCharByNameIn(root, name);
      if (!ch || ch.alive === false) return;
      var score = charScore(ch, group.type, catalogEntry || {});
      if (containsAny(textOfChar(ch), group.keyOffices)) score += 20;
      if (score > bestScore) {
        best = ch;
        bestScore = score;
      }
    });
    if (best) return best;
    chars.forEach(function(ch) {
      if (!ch || ch.alive === false || !ch.name || ch.name === group.leader) return;
      var types = classifyChar(ch, getCatalog(root));
      if (types.indexOf('eunuch') < 0 && types.indexOf(group.type) < 0) return;
      var score = charScore(ch, group.type, catalogEntry || {});
      if (score > bestScore) {
        best = ch;
        bestScore = score;
      }
    });
    return best;
  }

  function splinterInfluenceGroup(root, group) {
    if (!root || !group || !group.name) return null;
    var members = toArray(group.members).filter(Boolean);
    if (members.length < 4) return null;
    var baseName = group.name + '\u88c2\u652f';
    var newName = baseName;
    var idx = 1;
    while (root.influenceGroupState[newName]) {
      newName = baseName + idx;
      idx += 1;
    }
    var splitPoint = Math.floor(members.length / 2);
    var newMembers = members.slice(splitPoint);
    if (!newMembers.length) return null;
    var oldInfluence = Number(group.influence) || 0;
    var newGroup = {
      name: newName,
      type: group.type,
      influence: clamp(Math.round(oldInfluence * 0.5), 0, 100),
      cohesion: 30,
      reputationBalance: group.reputationBalance || 0,
      members: newMembers,
      leader: newMembers[0],
      keyOffices: [],
      officeCount: 0,
      candidateBy: 'evolution',
      status: 'active',
      splinterFrom: group.name,
      splinterTurn: Number(root.turn || 0) || 0,
      historyLog: [{
        turn: Number(root.turn || 0) || 0,
        type: 'splinter',
        from: group.name,
        text: '\u5185\u90e8\u88c2\u652f'
      }],
      lastShift: { turn: Number(root.turn || 0) || 0, influenceDelta: 0, cohesionDelta: 0, reason: '\u5185\u90e8\u88c2\u652f' }
    };
    root.influenceGroupState[newName] = newGroup;
    group.members = members.slice(0, splitPoint);
    group.influence = clamp(Math.round(oldInfluence * 0.5), 0, 100);
    group.cohesion = clamp((Number(group.cohesion) || 50) + 8, 0, 100);
    group._splintered = true;
    pushGroupHistory(root, group, 'splinter', '\u5185\u90e8\u5206\u88c2\u00b7\u5206\u51fa ' + newName, { splinterName: newName });
    return newGroup;
  }

  function evolutionTick(root, options) {
    var source = ensureRootContainers(root);
    options = options || {};
    var state = source.influenceGroupState || {};
    var catalog = getCatalog(source);
    var splinterMax = read('influenceGroupSplinterCohesionMax', source);
    splinterMax = splinterMax === undefined ? 10 : Number(splinterMax);
    if (!isFinite(splinterMax)) splinterMax = 10;
    var changed = [];
    Object.keys(state).forEach(function(name) {
      var group = state[name];
      if (!group || typeof group !== 'object') return;
      if (group.status === 'dispersed' || group.status === 'disbanded' || group.status === 'extinct') return;
      if (!Array.isArray(group.historyLog)) group.historyLog = [];
      var beforeStatus = group.status || 'active';
      var beforeLeader = group.leader || '';
      var beforeInfluence = Number(group.influence) || 0;
      var beforeCohesion = Number(group.cohesion) || 50;
      var cat = catalog[group.type] || {};
      var leader = findCharByNameIn(source, group.leader);
      if (group.leader && leader && leader.alive === false) {
        if (group.type === 'consort') {
          group.status = 'dispersed';
          group.influence = clamp(Math.round(beforeInfluence * 0.5), 0, 100);
          group.cohesion = clamp(Math.round(beforeCohesion * 0.3), 0, 100);
          pushGroupHistory(source, group, 'leader_dead', '\u4e3b\u4f4d\u85a8\u901d\u00b7\u540e\u5bab\u5d29\u6563', { leader: beforeLeader });
        } else if (group.type === 'waiqi') {
          group.status = 'disbanded';
          group.influence = clamp(beforeInfluence - 30, 0, 100);
          group.cohesion = clamp(Math.round(beforeCohesion * 0.5), 0, 100);
          pushGroupHistory(source, group, 'leader_dead', '\u5916\u621a\u5173\u952e\u4eba\u7269\u6b81\u843d', { leader: beforeLeader });
        } else if (group.type === 'eunuch') {
          var successor = findEunuchSuccessor(source, group, cat);
          if (successor) {
            group.leader = successor.name;
            if (group.members.indexOf(successor.name) < 0) group.members.push(successor.name);
            group.influence = clamp(Math.round(beforeInfluence * 0.7), 0, 100);
            group.cohesion = clamp(beforeCohesion - 10, 0, 100);
            pushGroupHistory(source, group, 'succession', '\u9609\u515a\u66f4\u5f20\u00b7' + beforeLeader + '\u6b81\u00b7' + successor.name + '\u7ee7', { fromLeader: beforeLeader, toLeader: successor.name });
          } else {
            group.status = 'dispersed';
            group.influence = clamp(Math.round(beforeInfluence * 0.4), 0, 100);
            group.cohesion = clamp(Math.round(beforeCohesion * 0.4), 0, 100);
            pushGroupHistory(source, group, 'leader_dead', '\u9609\u515a\u65e0\u7ee7\u00b7\u7fa4\u9f99\u6563', { leader: beforeLeader });
          }
        }
      }

      var aliveMembers = toArray(group.members).filter(function(memberName) {
        var ch = findCharByNameIn(source, memberName);
        return ch && ch.alive !== false;
      });
      if (toArray(group.members).length > 0 && aliveMembers.length === 0) {
        group.status = 'extinct';
        group.influence = 0;
        group.cohesion = 0;
        pushGroupHistory(source, group, 'extinct', '\u96c6\u56e2\u7edd\u55e3\u00b7\u5168\u5458\u51cb\u4ea1');
      }

      if (!group.status || group.status === 'active') {
        if ((Number(group.cohesion) || 0) < splinterMax && (Number(group.influence) || 0) > 30 && !group._splintered) {
          splinterInfluenceGroup(source, group);
        }
      }

      if ((group.status || 'active') !== beforeStatus || (group.leader || '') !== beforeLeader || (Number(group.influence) || 0) !== beforeInfluence || (Number(group.cohesion) || 0) !== beforeCohesion) {
        changed.push({ name: name, status: group.status || 'active', leader: group.leader || '', influence: group.influence, cohesion: group.cohesion });
      }
    });
    source._influenceGroupEvolution = {
      turn: Number(source.turn || options.turn || 0) || 0,
      changed: changed
    };
    return { ok: true, changed: changed.length, groups: Object.keys(state).length };
  }

  var api = {
    currentVersion: 1,
    groupNames: clone(GROUP_NAMES),
    bootstrap: bootstrap,
    refresh: bootstrap,
    getCatalog: getCatalog,
    getGroup: getGroup,
    classifyChar: classifyChar,
    buildRegentSignal: buildRegentSignal,
    evolutionTick: evolutionTick,
    applyInfluenceChange: applyInfluenceChange,
    clampInfluenceDelta: clampInfluenceDelta,
    describeInfluence: describeInfluence,
    ensureCharacterRuntime: ensureCharacterRuntime,
    ensureRootContainers: ensureRootContainers,
    constantsOf: constantsOf,
    read: read,
    pushGroupHistory: pushGroupHistory,
    splinterInfluenceGroup: splinterInfluenceGroup,
    clone: clone
  };

  TM.InfluenceGroups = api;
  global.InfluenceGroups = api;
})(typeof window !== 'undefined' ? window : globalThis);
