// @ts-check
/*
 * tm-party-class-ecology.js
 * Scenario ecology profiler for emergent party/class relations.
 */
(function(global) {
  'use strict';

  var TM = global.TM = global.TM || {};
  var MAX_HISTORY = 80;

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

  function pickRoot(root) {
    if (root && typeof root === 'object') return root;
    if (global.GM && typeof global.GM === 'object') return global.GM;
    if (global.scriptData && typeof global.scriptData === 'object') return global.scriptData;
    return {};
  }

  function toArray(v) {
    if (v === undefined || v === null || v === '') return [];
    return Array.isArray(v) ? v.slice() : [v];
  }

  function textOf(raw) {
    if (raw === undefined || raw === null) return '';
    if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') return String(raw);
    if (Array.isArray(raw)) return raw.map(textOf).filter(Boolean).join(' ');
    if (typeof raw === 'object') {
      var keys = ['text', 'content', 'summary', 'desc', 'description', 'agenda', 'goal', 'objective', 'topic', 'title', 'name', 'demand', 'reason', 'class', 'party'];
      var parts = [];
      keys.forEach(function(k) {
        if (raw[k] !== undefined && raw[k] !== null && raw[k] !== '') parts.push(textOf(raw[k]));
      });
      return parts.join(' ');
    }
    return '';
  }

  function compact(v, maxLen) {
    var text = String(textOf(v) || '').replace(/\s+/g, ' ').trim();
    maxLen = Number(maxLen) || 160;
    return text.length > maxLen ? text.slice(0, maxLen) : text;
  }

  function normalizeName(v) {
    return String(v || '').replace(/[\s\u3000'"`.,;:!?()[\]{}<>\/\\|_-]+/g, '').toLowerCase().trim();
  }

  function clamp(n, min, max) {
    n = Number(n);
    if (!isFinite(n)) n = min;
    return Math.max(min, Math.min(max, n));
  }

  function uniquePush(list, value) {
    if (!value) return;
    if (list.indexOf(value) < 0) list.push(value);
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

  var CATEGORY_TOKENS = {
    tax: [
      'tax', 'levy', 'fee', 'toll', 'tariff', 'customs', 'revenue', 'fiscal', 'quota',
      'tenant', 'tenancy', 'rent', 'collection', 'exaction', 'extraction', 'grain quota',
      'hearth', 'tribute', '\u7a0e', '\u8d4b', '\u9977', '\u79df', '\u5f81', '\u6d3e'
    ],
    land: [
      'land', 'tenant', 'tenancy', 'rent', 'field', 'estate', 'paddy', 'smallholder',
      'annexation', 'landlord', 'smallholders', '\u7530', '\u5730', '\u4f43', '\u7530\u4ea7', '\u517c\u5e76'
    ],
    corvee: [
      'corvee', 'labor', 'labour', 'service', 'draft', 'transport', 'carrying',
      'conscription', 'conscript', 'forced', '\u5f79', '\u5fAD', '\u5dee', '\u5f81\u53d1', '\u5f3a\u5f81'
    ],
    military: [
      'military', 'army', 'soldier', 'garrison', 'guard', 'patrol', 'wage', 'pay',
      'arrear', 'arrears', 'mutiny', 'border', '\u519b', '\u5175', '\u9977', '\u6b20\u9977', '\u54d7\u53d8'
    ],
    keju: [
      'keju', 'exam', 'degree', 'scholar', 'student', 'academy', 'admission',
      'register', 'literati', '\u79d1\u4e3e', '\u79d1\u573a', '\u58eb', '\u751f\u5458', '\u5f55\u53d6'
    ],
    office: [
      'office', 'appointment', 'post', 'rank', 'official', 'bureaucracy', 'gentry',
      'faction', 'clique', 'purge', 'dismissal', '\u5b98', '\u4efb\u5b98', '\u8f9f\u9664', '\u515a', '\u6e05\u515a'
    ],
    commerce: [
      'merchant', 'guild', 'trade', 'market', 'salt', 'license', 'harbor', 'canal',
      'workshop', 'customs', 'tariff', '\u5546', '\u884c\u4f1a', '\u76d0', '\u5e02', '\u5173'
    ],
    local: [
      'local', 'province', 'county', 'village', 'unrest', 'revolt', 'rebellion',
      'famine', 'uprising', 'commoner', '\u5730\u65b9', '\u5dde\u53bf', '\u6c11\u53d8', '\u9965'
    ],
    corruption: [
      'corruption', 'bribe', 'broker', 'dirty', 'clean', 'license', 'abuse',
      '\u8d2a', '\u8150', '\u8d3f', '\u821e\u5f0a', '\u6e05\u7406'
    ]
  };

  var CATEGORY_DEMANDS = {
    tax: 'relieve tax and arrear pressure',
    land: 'protect land and tenancy rights',
    corvee: 'restrain corvee and forced service',
    military: 'pay arrears and stabilize garrisons',
    keju: 'restore fair exam access',
    office: 'rebalance appointments and stop factional abuse',
    commerce: 'stabilize trade fees and licenses',
    local: 'relieve local exactions before unrest spreads',
    corruption: 'clean administration and punish corrupt brokers'
  };

  var SUPPORT_WORDS = [
    'reduce', 'lower', 'relief', 'relieve', 'remit', 'remission', 'exempt', 'exemption',
    'protect', 'defend tenants', 'fair', 'clean', 'restore', 'support', 'aid',
    '\u51cf', '\u8f7b', '\u8832', '\u6551', '\u4fdd', '\u629a', '\u516c\u5e73', '\u6e05'
  ];

  var HOSTILE_WORDS = [
    'oppose', 'block', 'defend collection', 'defend quota', 'defend arrear',
    'defend extraction', 'tighten', 'raise', 'increase', 'collect', 'collection',
    'purge', 'suppress', 'crackdown', '\u53cd\u5bf9', '\u963b', '\u5f81\u6536', '\u52a0\u5f81', '\u9547\u538b'
  ];

  function searchableClassText(cls) {
    return [
      classNameOf(cls),
      cls && cls.className,
      cls && cls.id,
      cls && cls.demands,
      cls && cls.currentDemand,
      cls && cls.currentAgenda,
      cls && cls.shortGoal,
      cls && cls.economicRole,
      cls && cls.role,
      cls && cls.status,
      cls && cls.description,
      cls && cls.desc,
      toArray(cls && (cls.tags || cls.labels || cls.keywords)).join(' '),
      toArray(cls && (cls.aliases || cls.alias || cls.altNames || cls.otherNames)).join(' ')
    ].map(textOf).join(' ').toLowerCase();
  }

  function searchablePartyText(party) {
    return [
      partyNameOf(party),
      party && party.partyName,
      party && party.id,
      party && party.currentAgenda,
      party && party.shortGoal,
      party && party.longGoal,
      party && party.agenda,
      party && party.platform,
      party && party.ideology,
      party && party.stance,
      party && party.description,
      party && party.desc,
      party && party.rivalParty,
      toArray(party && (party.tags || party.labels || party.keywords)).join(' '),
      toArray(party && (party.socialBase || party.social_base || party.baseClasses)).map(textOf).join(' '),
      toArray(party && (party.aliases || party.alias || party.altNames || party.otherNames)).join(' ')
    ].map(textOf).join(' ').toLowerCase();
  }

  function tokenHits(text, tokens) {
    var score = 0;
    var evidence = [];
    tokens.forEach(function(token) {
      token = String(token || '').toLowerCase();
      if (!token) return;
      if (text.indexOf(token) >= 0) {
        score += token.length >= 6 ? 2 : 1;
        uniquePush(evidence, token);
      }
    });
    return { score: score, evidence: evidence };
  }

  function scoreCategories(text) {
    var profile = {};
    var evidence = {};
    Object.keys(CATEGORY_TOKENS).forEach(function(category) {
      var hit = tokenHits(text, CATEGORY_TOKENS[category]);
      profile[category] = hit.score;
      if (hit.evidence.length) evidence[category] = hit.evidence;
    });
    return { profile: profile, evidence: evidence };
  }

  function categoryListFromTokens(tokens) {
    var text = toArray(tokens).map(textOf).join(' ').toLowerCase();
    var out = [];
    Object.keys(CATEGORY_TOKENS).forEach(function(category) {
      if (tokenHits(text, CATEGORY_TOKENS[category]).score > 0) out.push(category);
    });
    if (!out.length && /fiscal|finance/.test(text)) out.push('tax');
    if (!out.length && /court|office|party/.test(text)) out.push('office');
    return out;
  }

  function stanceForText(text, category) {
    text = String(text || '').toLowerCase();
    var score = 0;
    SUPPORT_WORDS.forEach(function(word) {
      if (text.indexOf(String(word).toLowerCase()) >= 0) score += 1;
    });
    HOSTILE_WORDS.forEach(function(word) {
      if (text.indexOf(String(word).toLowerCase()) >= 0) score -= 1;
    });
    if (/oppose.{0,36}(relief|remit|reduce|lower|exempt|tenant|rent|arrear)/.test(text)) score -= 2;
    if (/defend.{0,36}(collection|quota|arrear|extraction|levy|tax|rent)/.test(text)) score -= 2;
    if (/(remit|reduce|lower|relief|protect).{0,36}(tenant|rent|arrear|tax|levy|field)/.test(text)) score += 2;
    if (category === 'corruption' && /clean|punish|anti/.test(text)) score += 1;
    if (score > 0) return 1;
    if (score < 0) return -1;
    return 0;
  }

  function topCategories(profile) {
    return Object.keys(profile || {}).filter(function(k) {
      return Number(profile[k]) > 0;
    }).sort(function(a, b) {
      return (Number(profile[b]) || 0) - (Number(profile[a]) || 0);
    });
  }

  function buildClassProfile(root, cls) {
    var text = searchableClassText(cls);
    var scored = scoreCategories(text);
    var name = classNameOf(cls);
    return {
      className: name,
      pressureProfile: scored.profile,
      primaryCategories: topCategories(scored.profile).slice(0, 5),
      evidence: scored.evidence,
      satisfaction: Number(cls && cls.satisfaction),
      influence: Number(cls && cls.influence),
      demand: compact(cls && (cls.demands || cls.currentDemand || cls.currentAgenda || cls.shortGoal), 140)
    };
  }

  function buildPartyProfile(root, party) {
    var text = searchablePartyText(party);
    var scored = scoreCategories(text);
    var stance = {};
    Object.keys(CATEGORY_TOKENS).forEach(function(category) {
      stance[category] = scored.profile[category] > 0 ? stanceForText(text, category) : 0;
    });
    var name = partyNameOf(party);
    return {
      partyName: name,
      agendaProfile: scored.profile,
      stanceProfile: stance,
      primaryCategories: topCategories(scored.profile).slice(0, 5),
      evidence: scored.evidence,
      influence: Number(party && party.influence),
      cohesion: Number(party && party.cohesion),
      agenda: compact(party && (party.currentAgenda || party.shortGoal || party.longGoal || party.agenda), 140)
    };
  }

  function ensureStore(root, options) {
    root = pickRoot(root);
    options = options || {};
    var previous = root._partyClassEcology && typeof root._partyClassEcology === 'object' ? root._partyClassEcology : {};
    root._partyClassEcology = {
      turn: Number(options.turn != null ? options.turn : root.turn) || 0,
      source: options.source || 'party-class-ecology',
      classProfiles: {},
      partyProfiles: {},
      affinities: [],
      signalHistory: toArray(previous.signalHistory).slice(-MAX_HISTORY)
    };
    return root._partyClassEcology;
  }

  function build(root, options) {
    root = pickRoot(root);
    options = options || {};
    var store = ensureStore(root, options);
    getClasses(root).forEach(function(cls) {
      var name = classNameOf(cls);
      if (name) store.classProfiles[name] = buildClassProfile(root, cls);
    });
    getParties(root).forEach(function(party) {
      var name = partyNameOf(party);
      if (name) store.partyProfiles[name] = buildPartyProfile(root, party);
    });
    Object.keys(store.classProfiles).forEach(function(className) {
      Object.keys(store.partyProfiles).forEach(function(partyName) {
        var score = affinityScore(store.classProfiles[className], store.partyProfiles[partyName]);
        if (!score.score) return;
        store.affinities.push({
          className: className,
          partyName: partyName,
          score: score.score,
          stance: score.stance,
          categories: score.categories,
          reason: score.reason
        });
      });
    });
    return clone(store);
  }

  function getStore(root) {
    root = pickRoot(root);
    if (!root._partyClassEcology || !root._partyClassEcology.classProfiles || !root._partyClassEcology.partyProfiles) {
      build(root, { turn: root.turn, source: 'party-class-ecology-lazy' });
    }
    return root._partyClassEcology;
  }

  function affinityScore(classProfile, partyProfile) {
    var categories = [];
    var score = 0;
    var stanceTotal = 0;
    Object.keys(CATEGORY_TOKENS).forEach(function(category) {
      var classScore = Number(classProfile && classProfile.pressureProfile && classProfile.pressureProfile[category]) || 0;
      var partyScore = Number(partyProfile && partyProfile.agendaProfile && partyProfile.agendaProfile[category]) || 0;
      if (classScore <= 0 || partyScore <= 0) return;
      var shared = Math.min(classScore, partyScore);
      score += shared;
      uniquePush(categories, category);
      stanceTotal += (Number(partyProfile.stanceProfile && partyProfile.stanceProfile[category]) || 0) * shared;
    });
    var stance = stanceTotal < 0 ? -1 : (stanceTotal > 0 ? 1 : 0);
    return {
      score: score,
      stance: stance,
      categories: categories,
      reason: categories.join('/')
    };
  }

  function classByName(root, name) {
    var wanted = normalizeName(name);
    return getClasses(root).filter(function(cls) { return normalizeName(classNameOf(cls)) === wanted; })[0] || null;
  }

  function partyByName(root, name) {
    var wanted = normalizeName(name);
    return getParties(root).filter(function(party) { return normalizeName(partyNameOf(party)) === wanted; })[0] || null;
  }

  function scoreClass(root, cls, tokens) {
    root = pickRoot(root);
    var categories = categoryListFromTokens(tokens);
    if (!categories.length || !cls) return 0;
    var store = getStore(root);
    var profile = store.classProfiles[classNameOf(cls)] || buildClassProfile(root, cls);
    var score = 0;
    categories.forEach(function(category) {
      score += Number(profile.pressureProfile && profile.pressureProfile[category]) || 0;
      if (category === 'tax') score += (Number(profile.pressureProfile.land) || 0) * 0.35;
      if (category === 'land') score += (Number(profile.pressureProfile.tax) || 0) * 0.25;
    });
    return Math.round(score * 100) / 100;
  }

  function scoreParty(root, party, tokens) {
    root = pickRoot(root);
    var categories = categoryListFromTokens(tokens);
    if (!categories.length || !party) return 0;
    var store = getStore(root);
    var profile = store.partyProfiles[partyNameOf(party)] || buildPartyProfile(root, party);
    var score = 0;
    var stanceTotal = 0;
    categories.forEach(function(category) {
      var part = Number(profile.agendaProfile && profile.agendaProfile[category]) || 0;
      if (category === 'tax') part += (Number(profile.agendaProfile.land) || 0) * 0.35;
      score += part;
      stanceTotal += part * (Number(profile.stanceProfile && profile.stanceProfile[category]) || 0);
    });
    if (!score) return 0;
    var sign = stanceTotal < 0 ? -1 : 1;
    return Math.round(score * sign * 100) / 100;
  }

  function existingClassNames(raw) {
    var out = {};
    toArray(raw.affectedClasses || raw.classes || raw.classImpacts).forEach(function(item) {
      var name = item && (item.name || item.className || item.class || item.group);
      if (name) out[normalizeName(name)] = true;
    });
    return out;
  }

  function existingPartyNames(raw) {
    var out = {};
    toArray(raw.affectedParties || raw.parties || raw.partyImpacts).forEach(function(item) {
      var name = item && (item.name || item.party || item.partyName);
      if (name) out[normalizeName(name)] = true;
    });
    return out;
  }

  function existingRelationKey(raw, className, partyName) {
    var wanted = normalizeName(className) + '::' + normalizeName(partyName);
    return toArray(raw.relationAdjustments || raw.relations || raw.partyClassRelations).some(function(item) {
      if (!item) return false;
      var cls = item.className || item.sourceClass || item.class || item.group;
      var party = item.party || item.partyName || item.name || item.targetParty;
      return normalizeName(cls) + '::' + normalizeName(party) === wanted;
    });
  }

  function demandForCategories(categories, fallback) {
    for (var i = 0; i < categories.length; i += 1) {
      if (CATEGORY_DEMANDS[categories[i]]) return CATEGORY_DEMANDS[categories[i]];
    }
    return fallback || 'answer class pressure';
  }

  function enrichSignalRaw(root, raw, options) {
    root = pickRoot(root);
    raw = clone(raw || {}) || {};
    options = options || {};
    var turn = Number(raw.turn != null ? raw.turn : (options.turn != null ? options.turn : root.turn)) || 0;
    var tokens = toArray(raw.tags || raw.policyTags || raw.labels).concat([raw.kind, raw.type, raw.sourceSystem, raw.source, raw.reason, raw.summary, raw.detail, raw.title]);
    var categories = categoryListFromTokens(tokens);
    if (!categories.length || raw.ecology === false) return raw;
    build(root, { turn: turn, source: options.source || raw.sourceSystem || raw.source || 'party-class-ecology-signal' });
    var intensity = clamp(raw.intensity != null ? raw.intensity : 0.55, 0, 1);
    var classNames = existingClassNames(raw);
    var partyNames = existingPartyNames(raw);
    var classMatches = [];
    var partyMatches = [];
    raw.affectedClasses = toArray(raw.affectedClasses || raw.classes || raw.classImpacts);
    raw.affectedParties = toArray(raw.affectedParties || raw.parties || raw.partyImpacts);
    raw.relationAdjustments = toArray(raw.relationAdjustments || raw.relations || raw.partyClassRelations);

    // 信号极性(修「满意无脑降/影响无脑升」):从信号已列明的 affectedClasses 满意度 delta 取符号——纾解(+1)/民怨(-1)/中性(0)。
    // ecology 扩展据此双向:民怨→满意降·党派借势升;纾解→满意升·党派退潮降;中性→不施加(不再无条件扣满意/加影响)。
    var _pol = 0;
    (raw.affectedClasses || []).forEach(function(x){ var d = x && Number(x.satisfactionDelta); if (isFinite(d) && d) _pol += (d > 0 ? 1 : -1); });
    _pol = _pol > 0 ? 1 : (_pol < 0 ? -1 : 0);

    getClasses(root).forEach(function(cls) {
      var name = classNameOf(cls);
      var score = scoreClass(root, cls, tokens);
      if (!name || score < 2) return;
      classMatches.push({ name: name, score: score, categories: categories.slice() });
      if (!classNames[normalizeName(name)]) {
        if (_pol !== 0) {                                   // 中性信号不波及旁支阶层(不再无脑扣满意)
          var _mag = Math.max(1, Math.round(1 + intensity * 4));
          var _c = {
            name: name,
            satisfactionDelta: _pol * _mag,                 // 双向:纾解则升·民怨则降
            influenceDelta: _pol < 0 ? (intensity >= 0.75 ? 1 : 0) : -1,   // 民怨→动员涨影响·纾解→退潮跌影响(修无脑升)
            demand: demandForCategories(categories, cls && (cls.demands || cls.currentDemand)),
            reason: 'ecology matched ' + categories.join('/')
          };
          if (_pol < 0) _c.unrestDelta = { grievance: -Math.max(2, Math.round(1 + intensity * 4)), petition: -Math.max(1, Math.round(intensity * 3)) };
          raw.affectedClasses.push(_c);
        }
        classNames[normalizeName(name)] = true;
      }
    });

    getParties(root).forEach(function(party) {
      var name = partyNameOf(party);
      var signed = scoreParty(root, party, tokens);
      if (!name || Math.abs(signed) < 2) return;
      partyMatches.push({ name: name, score: Math.abs(signed), stance: signed < 0 ? -1 : 1, categories: categories.slice() });
      if (!partyNames[normalizeName(name)]) {
        raw.affectedParties.push({
          name: name,
          // 双向(修影响力无脑升):民怨(_pol<0)→党派借势涨;纾解(_pol>0)→议题退潮跌;中性→0。幅度按 intensity。
          influenceDelta: _pol < 0 ? Math.max(1, Math.round(intensity * 2)) : (_pol > 0 ? -Math.max(1, Math.round(intensity * 1.5)) : 0),
          cohesionDelta: signed < 0 ? -Math.max(1, Math.round(intensity * 2)) : 0,
          shortGoal: signed < 0 ? 'block ' + demandForCategories(categories, 'class relief') : 'carry ' + demandForCategories(categories, 'class relief'),
          reason: 'ecology matched ' + categories.join('/')
        });
        partyNames[normalizeName(name)] = true;
      }
    });

    classMatches.forEach(function(cls) {
      partyMatches.forEach(function(party) {
        if (existingRelationKey(raw, cls.name, party.name)) return;
        var overlap = Math.min(cls.score, party.score);
        var base = Math.round(clamp(8 + intensity * 7 + Math.min(5, overlap), 8, 18));
        var sign = party.stance < 0 ? -1 : 1;
        raw.relationAdjustments.push({
          className: cls.name,
          party: party.name,
          affinityDelta: base * sign,
          trustDelta: sign > 0 ? 2 : -2,
          grievanceDelta: sign > 0 ? -2 : 3,
          emergent: true,
          reason: 'ecology signal ' + categories.join('/') + ' linked class pressure to party agenda'
        });
      });
    });

    var store = getStore(root);
    store.signalHistory.push({
      turn: turn,
      source: options.source || raw.sourceSystem || raw.source || 'party-class-ecology-signal',
      kind: compact(raw.kind || raw.type || raw.sourceSystem || 'signal', 80),
      categories: categories,
      affectedClasses: classMatches.map(function(x) { return x.name; }),
      affectedParties: partyMatches.map(function(x) { return x.name; }),
      relationAdjustments: raw.relationAdjustments.map(function(x) {
        return { className: x.className, party: x.party || x.partyName, affinityDelta: x.affinityDelta };
      })
    });
    if (store.signalHistory.length > MAX_HISTORY) store.signalHistory = store.signalHistory.slice(-MAX_HISTORY);
    return raw;
  }

  TM.PartyClassEcology = {
    build: build,
    scoreClass: scoreClass,
    scoreParty: scoreParty,
    enrichSignalRaw: enrichSignalRaw,
    categoriesForTokens: categoryListFromTokens,
    classByName: classByName,
    partyByName: partyByName
  };

  global.PartyClassEcology = TM.PartyClassEcology;

  if (typeof module !== 'undefined' && module.exports) module.exports = TM.PartyClassEcology;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : globalThis));
