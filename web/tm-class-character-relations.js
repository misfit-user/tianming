// @ts-check
/*
 * tm-class-character-relations.js
 * Dynamic backing network between social classes and characters.
 */
(function(global) {
  'use strict';

  var TM = global.TM = global.TM || {};
  var MAX_HISTORY = 160;

  function toArray(v) {
    if (v === undefined || v === null || v === '') return [];
    return Array.isArray(v) ? v.slice() : [v];
  }

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

  function clamp(n, min, max) {
    n = Number(n);
    if (!isFinite(n)) n = min;
    return Math.max(min, Math.min(max, n));
  }

  function compact(v, maxLen) {
    var text = String(textOf(v) || '').replace(/\s+/g, ' ').trim();
    maxLen = Number(maxLen) || 160;
    return text.length > maxLen ? text.slice(0, maxLen) : text;
  }

  function normalizeName(v) {
    return String(v || '').replace(/[\s\u3000'"`.,;:!?()[\]{}<>\/\\|_-]+/g, '').toLowerCase().trim();
  }

  function textOf(raw) {
    if (raw === undefined || raw === null) return '';
    if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') return String(raw);
    if (Array.isArray(raw)) return raw.map(textOf).filter(Boolean).join(' ');
    if (typeof raw === 'object') {
      var keys = [
        'text', 'content', 'summary', 'desc', 'description', 'agenda', 'goal',
        'objective', 'topic', 'title', 'name', 'demand', 'reason', 'class',
        'className', 'party', 'partyName', 'characterName', 'officialTitle'
      ];
      var parts = [];
      keys.forEach(function(k) {
        if (raw[k] !== undefined && raw[k] !== null && raw[k] !== '') parts.push(textOf(raw[k]));
      });
      return parts.join(' ');
    }
    return '';
  }

  function uniquePush(list, value) {
    value = compact(value, 120);
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

  function getCharacters(root) {
    root = pickRoot(root);
    var lists = [
      root.characters,
      root.chars,
      root.people,
      root.ministers,
      root.scriptData && root.scriptData.characters,
      root.scriptData && root.scriptData.chars,
      global.P && global.P.characters,
      global.P && global.P.chars,
      global.scriptData && global.scriptData.characters,
      global.scriptData && global.scriptData.chars
    ];
    var out = [];
    var seen = {};
    lists.forEach(function(list) {
      toArray(list).forEach(function(ch) {
        if (!ch || typeof ch !== 'object') return;
        var name = characterNameOf(ch);
        var key = characterIdOf(ch) || name;
        var norm = normalizeName(key);
        if (!name || !norm || seen[norm]) return;
        seen[norm] = true;
        out.push(ch);
      });
    });
    return out;
  }

  function classNameOf(cls) {
    return String(cls && (cls.name || cls.className || cls.id) || '').trim();
  }

  function partyNameOf(party) {
    return String(party && (party.name || party.partyName || party.id) || '').trim();
  }

  function characterNameOf(ch) {
    return String(ch && (ch.name || ch.characterName || ch.id) || '').trim();
  }

  function characterIdOf(ch) {
    return String(ch && (ch.id || ch.key || ch.charId || ch.characterId) || '').trim();
  }

  function ensureState(root) {
    root = pickRoot(root);
    if (!root.classCharacterRelations || typeof root.classCharacterRelations !== 'object' || Array.isArray(root.classCharacterRelations)) {
      root.classCharacterRelations = {
        turn: Number(root.turn) || 0,
        seq: 0,
        edges: {},
        history: []
      };
    }
    if (!root.classCharacterRelations.edges || typeof root.classCharacterRelations.edges !== 'object') root.classCharacterRelations.edges = {};
    if (!Array.isArray(root.classCharacterRelations.history)) root.classCharacterRelations.history = [];
    return root.classCharacterRelations;
  }

  function edgeKey(className, characterId, characterName) {
    return normalizeName(className) + '::' + normalizeName(characterId || characterName);
  }

  function classText(cls) {
    return textOf([
      classNameOf(cls),
      cls && cls.className,
      cls && cls.id,
      cls && cls.demands,
      cls && cls.currentDemand,
      cls && cls.economicRole,
      cls && cls.role,
      cls && cls.status,
      cls && cls.description,
      cls && cls.desc,
      cls && cls.mobility,
      cls && cls.privileges,
      cls && cls.obligations,
      toArray(cls && (cls.tags || cls.labels || cls.keywords)).join(' '),
      toArray(cls && (cls.aliases || cls.alias || cls.otherNames || cls.altNames)).join(' ')
    ]).toLowerCase();
  }

  function charText(ch) {
    return textOf([
      characterNameOf(ch),
      ch && ch.title,
      ch && ch.officialTitle,
      ch && ch.concurrentTitle,
      ch && ch.officeDuties,
      ch && ch.role,
      ch && ch.occupation,
      ch && ch.birthplace,
      ch && ch.ethnicity,
      ch && ch.culture,
      ch && ch.learning,
      ch && ch.party,
      ch && ch.faction,
      ch && ch.stance,
      ch && ch.personalGoal,
      ch && ch.innerThought,
      ch && ch.familyTier,
      ch && ch.family,
      toArray(ch && ch.stressSources).join(' '),
      toArray(ch && (ch.tags || ch.labels || ch.keywords || ch.traits || ch.traitIds)).join(' ')
    ]).toLowerCase();
  }

  var CATEGORY = {
    gentry: {
      classTokens: ['gentry', 'scholar', 'literati', 'keju', 'office', '士', '绅', '科举', '士林', '清议'],
      charTokens: ['gentry', 'scholar', 'literati', 'keju', 'jinshi', 'academy', '礼部', '翰林', '进士', '士林', '清议', '科举']
    },
    military: {
      classTokens: ['military', 'soldier', 'army', 'garrison', 'guard', 'wage', 'arrears', '军', '兵', '军户', '边饷'],
      charTokens: ['military', 'soldier', 'general', 'commander', 'marshal', '督师', '总兵', '将军', '兵部', '边', '武将']
    },
    peasant: {
      classTokens: ['peasant', 'farmer', 'tax', 'corvee', 'land', 'tenant', 'rural', '农', '编户', '田', '税', '役', '佃'],
      charTokens: ['户部', '知县', '知府', '巡抚', '布政', '清丈', '减派', '田', '税', '赋', '役', '赈']
    },
    commerce: {
      classTokens: ['merchant', 'commerce', 'guild', 'trade', 'salt', 'market', '商', '贾', '市', '盐', '行会'],
      charTokens: ['户部', '盐', '市舶', '商税', '榷', '关税', '漕运', '商']
    },
    court: {
      classTokens: ['eunuch', 'imperial', 'inner', 'court', '宦', '内廷', '皇亲', '宗室'],
      charTokens: ['司礼监', '内廷', '太监', '宦官', '宗室', '皇亲']
    }
  };

  function hasAny(text, tokens) {
    if (!text) return false;
    for (var i = 0; i < tokens.length; i += 1) {
      if (text.indexOf(String(tokens[i]).toLowerCase()) >= 0) return true;
    }
    return false;
  }

  function entryName(entry) {
    if (typeof entry === 'string') return entry.trim();
    if (!entry || typeof entry !== 'object') return '';
    return String(entry.name || entry.characterName || entry.person || entry.npc || entry.id || entry.party || entry.partyName || entry.class || entry.className || '').trim();
  }

  function inferRole(cls, ch, evidence, precomputedText) {
    var text = precomputedText != null ? precomputedText : (charText(ch) + ' ' + classText(cls));
    if (evidence.some(function(e) { return /representative|leader/i.test(e); })) return 'spokesperson';
    if (/减免|蠲|赈|抚|减派|清丈|保护|relief|remit|reduce|exempt|protect/.test(text)) return 'broker';
    if (/镇压|清党|加派|严征|suppress|purge|crackdown/.test(text)) return 'suppressor';
    if (/户部|知县|知府|巡抚|布政|broker|调停|清丈|减派/.test(text)) return 'broker';
    if (/督师|总兵|将军|military|army|兵部/.test(text)) return 'patron';
    if (/进士|翰林|士林|宗室|皇亲|symbol/.test(text)) return 'symbol';
    if (evidence.some(function(e) { return /party/i.test(e); })) return 'broker';
    return 'spokesperson';
  }

  function history(root, entry) {
    var state = ensureState(root);
    state.seq = (Number(state.seq) || 0) + 1;
    var item = Object.assign({
      id: 'ccr-' + (Number(entry.turn != null ? entry.turn : root.turn) || 0) + '-' + state.seq,
      turn: Number(entry.turn != null ? entry.turn : root.turn) || 0
    }, clone(entry));
    state.history.push(item);
    if (state.history.length > MAX_HISTORY) state.history = state.history.slice(-MAX_HISTORY);
    return item;
  }

  function findCharacter(root, nameOrId) {
    var n = normalizeName(nameOrId);
    if (!n) return null;
    var chars = getCharacters(root);
    for (var i = 0; i < chars.length; i += 1) {
      var ch = chars[i];
      if (normalizeName(characterNameOf(ch)) === n || normalizeName(characterIdOf(ch)) === n) return ch;
    }
    return null;
  }

  function adjustRelation(root, raw, options) {
    root = pickRoot(root);
    raw = raw || {};
    options = options || {};
    var state = ensureState(root);
    var turn = Number(options.turn != null ? options.turn : (raw.turn != null ? raw.turn : root.turn)) || 0;
    var className = compact(raw.className || raw.class || raw.actorId, 80);
    var charObj = raw.character || findCharacter(root, raw.characterId || raw.characterName || raw.name);
    var characterName = compact(raw.characterName || raw.name || characterNameOf(charObj), 80);
    var characterId = compact(raw.characterId || characterIdOf(charObj), 80);
    if (!className || !characterName) return null;
    var key = edgeKey(className, characterId, characterName);
    var prev = state.edges[key] || {
      className: className,
      characterId: characterId,
      characterName: characterName,
      role: 'spokesperson',
      affinity: 0.45,
      legitimacy: 0.45,
      mobilization: 0.35,
      trust: 0.45,
      grievance: 0.1,
      source: '',
      evidence: [],
      lastTurn: turn,
      expiry: turn + 6
    };
    var next = clone(prev);
    next.className = className;
    next.characterId = characterId || next.characterId || '';
    next.characterName = characterName;
    next.role = raw.role || next.role || 'spokesperson';
    next.affinity = clamp(raw.affinity != null ? raw.affinity : (next.affinity + Number(raw.affinityDelta || 0)), 0, 1);
    next.legitimacy = clamp(raw.legitimacy != null ? raw.legitimacy : (next.legitimacy + Number(raw.legitimacyDelta || 0)), 0, 1);
    next.mobilization = clamp(raw.mobilization != null ? raw.mobilization : (next.mobilization + Number(raw.mobilizationDelta || 0)), 0, 1);
    next.trust = clamp(raw.trust != null ? raw.trust : (next.trust + Number(raw.trustDelta || 0)), 0, 1);
    next.grievance = clamp(raw.grievance != null ? raw.grievance : (next.grievance + Number(raw.grievanceDelta || 0)), 0, 1);
    var sources = String(next.source || '').split(/[\/|,]+/).filter(Boolean);
    toArray(raw.source || options.source || 'class-character-relations').forEach(function(s) { uniquePush(sources, s); });
    next.source = sources.slice(-8).join('/');
    next.evidence = toArray(next.evidence).slice(-8);
    toArray(raw.evidence || raw.reason).forEach(function(e) { uniquePush(next.evidence, e); });
    next.lastTurn = turn;
    next.expiry = Number(raw.expiry != null ? raw.expiry : raw.expiresTurn);
    if (!isFinite(next.expiry)) next.expiry = turn + 6;
    state.edges[key] = next;
    history(root, {
      type: state.edges[key] && prev.lastTurn === turn ? 'update' : 'upsert',
      className: next.className,
      characterName: next.characterName,
      role: next.role,
      source: raw.source || options.source || 'class-character-relations',
      evidence: toArray(raw.evidence || raw.reason).slice(0, 3)
    });
    if (!options || !options.skipMirrors) rebuildMirrors(root);
    return clone(next);
  }

  // 2026-06-06·把 scorePair 里的 class 级计算(代表集/支持党派集/类目class侧/诉求tokens)从内层 char 循环(×人物数)
  // 提到每阶层预算一次·内层只做 char 侧·语义与 scorePair 完全等价(治过回合 discover 3.9s 卡顿)
  function buildClassScoreCtx(root, cls, parties) {
    var cn = normalizeName(classNameOf(cls));
    var repNames = Object.create(null);
    [cls && cls.representativeNpcs, cls && cls.leaders, cls && cls.representatives].forEach(function(list) {
      toArray(list).forEach(function(entry) { var n = normalizeName(entryName(entry)); if (n) repNames[n] = 1; });
    });
    var supportParties = Object.create(null);
    toArray(cls && (cls.supportingParties || cls.supporting_parties || cls.parties || cls.linkedParties)).forEach(function(entry) {
      var n = normalizeName(entryName(entry)); if (n) supportParties[n] = 1;
    });
    toArray(parties).forEach(function(party) {
      var hit = false;
      toArray(party.socialBase || party.social_base || party.baseClasses || party.supportBase).forEach(function(entry) {
        if (normalizeName(entryName(entry)) === cn) hit = true;
      });
      if (hit) { var pn = normalizeName(partyNameOf(party)); if (pn) supportParties[pn] = 1; }
    });
    var ct = classText(cls);
    var catClass = Object.create(null);
    Object.keys(CATEGORY).forEach(function(k) { if (hasAny(ct, CATEGORY[k].classTokens)) catClass[k] = 1; });
    var demand = String(cls && (cls.demands || cls.currentDemand) || '');
    var demandTokens = [];
    if (demand && normalizeName(demand).length >= 2) {
      demand.split(/[\s,.;:!?，。；、]+/).forEach(function(tok) { tok = normalizeName(tok); if (tok.length >= 2) demandTokens.push(tok); });
    }
    return {
      ct: ct, repNames: repNames, supportParties: supportParties, catClass: catClass,
      milClass: hasAny(ct, CATEGORY.military.classTokens), gentryClass: hasAny(ct, CATEGORY.gentry.classTokens),
      demandTokens: demandTokens
    };
  }
  function scorePairCtx(ctx, ch, htCache) {
    var evidence = [], source = [], score = 0;
    var cname = normalizeName(characterNameOf(ch)), cid = normalizeName(characterIdOf(ch));
    if (ctx.repNames[cname] || (cid && ctx.repNames[cid])) {
      score += 0.48; uniquePush(source, 'representative'); uniquePush(evidence, 'representativeNpcs matched ' + characterNameOf(ch));
    }
    var pn = normalizeName(ch && ch.party);
    if (pn && ctx.supportParties[pn]) {
      score += 0.24; uniquePush(source, 'party'); uniquePush(evidence, 'party social base matched ' + (ch && ch.party));
    }
    var ht = htCache.get(ch); if (ht === undefined) { ht = charText(ch); htCache.set(ch, ht); }
    var hits = [];
    Object.keys(CATEGORY).forEach(function(k) { if (ctx.catClass[k] && hasAny(ht, CATEGORY[k].charTokens)) hits.push(k); });
    var military = Number(ch && ch.military) || 0, valor = Number(ch && ch.valor) || 0;
    if (ctx.milClass && (military >= 75 || valor >= 80)) uniquePush(hits, 'military');
    if (ctx.gentryClass && /gentry|noble|imperial|士|绅|进士|举人/i.test(String((ch && ch.familyTier) || '') + ' ' + String((ch && ch.learning) || ''))) uniquePush(hits, 'gentry');
    hits.forEach(function(hit) { score += hit === 'military' ? 0.28 : 0.22; uniquePush(source, 'category:' + hit); uniquePush(evidence, 'category matched ' + hit); });
    if (ctx.demandTokens.length) {
      var stance = String(ch && (ch.stance || ch.personalGoal || ch.officeDuties || '') || '');
      if (stance && normalizeName(stance).length >= 2) {
        var ns = normalizeName(stance);
        if (ctx.demandTokens.some(function(token) { return ns.indexOf(token) >= 0; })) {
          score += 0.12; uniquePush(source, 'stance'); uniquePush(evidence, 'stance echoes class demand');
        }
      }
    }
    return { score: score, source: source, evidence: evidence };
  }

  function discoverPairs(root, options) {
    root = pickRoot(root);
    options = options || {};
    var turn = Number(options.turn != null ? options.turn : root.turn) || 0;
    var count = 0;
    var _parties = getParties(root);
    var _chars = getCharacters(root);
    var _htCache = new Map();
    getClasses(root).forEach(function(cls) {
      if (!cls) return;
      var _ctx = buildClassScoreCtx(root, cls, _parties);
      _chars.forEach(function(ch) {
        var scored = scorePairCtx(_ctx, ch, _htCache);
        if (scored.score < 0.22) return;
        var cname = classNameOf(cls);
        var sat = Number(cls.satisfaction != null ? cls.satisfaction : cls.support);
        if (!isFinite(sat)) sat = 50;
        var inf = Number(cls.influence != null ? cls.influence : cls.power);
        if (!isFinite(inf)) inf = 50;
        var charisma = Number(ch.charisma || 0);
        var admin = Number(ch.administration || ch.management || 0);
        var military = Number(ch.military || ch.valor || 0);
        var loyalty = Number(ch.loyalty || ch.loyal || 50);
        var role = inferRole(cls, ch, scored.evidence, (_htCache.get(ch) || '') + ' ' + (_ctx.ct || ''));
        adjustRelation(root, {
          character: ch,
          className: cname,
          characterId: characterIdOf(ch),
          characterName: characterNameOf(ch),
          role: role,
          affinity: clamp(0.32 + scored.score, 0, 1),
          legitimacy: clamp(0.36 + scored.score * 0.35 + inf / 320 + Math.max(charisma, admin) / 520, 0, 1),
          mobilization: clamp(0.28 + inf / 230 + Math.max(charisma, military) / 520, 0, 1),
          trust: clamp(0.38 + loyalty / 500 + scored.score * 0.16, 0, 1),
          grievance: clamp((50 - sat) / 260 + (role === 'suppressor' ? 0.28 : 0.08), 0, 1),
          source: ['discovery'].concat(scored.source).join('/'),
          evidence: scored.evidence,
          expiry: turn + 6
        }, { turn: turn, source: options.source || 'class-character-discovery', skipMirrors: true });
        count += 1;
      });
    });
    return count;
  }

  function signalCharacterName(signal) {
    return signal && (
      signal.characterName || signal.character || signal.executor || signal.executorName ||
      signal.delegateCharacter || signal.sourceCharacter || signal.leaderName || signal.actorName || signal.actor ||
      signal.assignee || signal.holder || signal.holderName || signal.personName || signal.officialName
    ) || '';
  }

  function signalAffectedClasses(signal) {
    var out = [];
    toArray(signal && signal.affectedClasses).forEach(function(entry) {
      var name = entryName(entry);
      if (name) uniquePush(out, name);
    });
    toArray(signal && (signal.className || signal.sourceClass || signal.class)).forEach(function(entry) {
      var name = entryName(entry);
      if (name) uniquePush(out, name);
    });
    return out;
  }

  function signalSourceKind(signal) {
    signal = signal || {};
    var explicit = signal.sourceSystem || signal.source || signal.sourceType || signal.from || signal.kind;
    if (explicit) return explicit;
    if (signal.office || signal.officialTitle || signal.oldOffice || signal.newOffice || signal.appointment || signal.appointedOffice) return 'office';
    if (signal.topic || signal.issueId || signal.tinyiId || signal.courtIssue || signal.courtTopic) return 'tinyi';
    return 'runtime';
  }

  function ingestSignals(root, options) {
    root = pickRoot(root);
    options = options || {};
    var turn = Number(options.turn != null ? options.turn : root.turn) || 0;
    var count = 0;
    var items = toArray(root._socialPoliticalSignals && root._socialPoliticalSignals.items)
      .concat(toArray(root._playerActionSignals && root._playerActionSignals.items))
      .concat(toArray(root._partyClassCourtIssueLinks))
      .concat(toArray(root._pendingTinyiTopics))
      .concat(toArray(root._courtRecords))
      .concat(toArray(root.tinyiSeals))
      .concat(toArray(root.office_changes || root.officeChanges))
      .concat(toArray(root.personnelChanges || root.personnel_changes));
    items.forEach(function(sig) {
      if (!sig || typeof sig !== 'object') return;
      var chName = signalCharacterName(sig);
      if (!chName) return;
      var classes = signalAffectedClasses(sig);
      if (!classes.length && sig.className) classes = [sig.className];
      classes.forEach(function(className) {
        var reason = compact([sig.id || sig.issueId || sig.topic || '', sig.reason || sig.summary || sig.goalText || sig.demandText || ''].filter(Boolean).join(' / '), 180);
        var text = textOf(sig).toLowerCase();
        var helpful = /relief|reduce|remit|protect|清丈|减派|赈|抚|减|蠲|免/.test(text);
        var hostile = /suppress|purge|block|crackdown|镇压|清党|阻挠|加派/.test(text) && !helpful;
        adjustRelation(root, {
          className: className,
          characterName: chName,
          role: hostile ? 'suppressor' : 'broker',
          affinityDelta: hostile ? -0.08 : (helpful ? 0.09 : 0.04),
          trustDelta: hostile ? -0.12 : (helpful ? 0.14 : 0.06),
          legitimacyDelta: helpful ? 0.08 : 0.03,
          grievanceDelta: hostile ? 0.18 : -0.03,
          source: 'signal:' + signalSourceKind(sig),
          evidence: reason,
          expiry: turn + 6
        }, { turn: turn, source: options.source || 'class-character-signal', skipMirrors: true });
        count += 1;
      });
    });
    return count;
  }

  function expireStale(root, options) {
    root = pickRoot(root);
    options = options || {};
    var state = ensureState(root);
    var turn = Number(options.turn != null ? options.turn : root.turn) || 0;
    var expired = 0;
    Object.keys(state.edges).forEach(function(key) {
      var edge = state.edges[key];
      if (!edge) return;
      var expiry = Number(edge.expiry);
      if (isFinite(expiry) && expiry < turn) {
        delete state.edges[key];
        expired += 1;
        history(root, {
          type: 'expired',
          className: edge.className,
          characterName: edge.characterName,
          role: edge.role,
          source: options.source || 'class-character-expiry'
        });
      }
    });
    if (expired) rebuildMirrors(root);
    return expired;
  }

  function compactEdge(edge) {
    return {
      className: edge.className,
      characterId: edge.characterId || '',
      characterName: edge.characterName,
      role: edge.role,
      affinity: edge.affinity,
      legitimacy: edge.legitimacy,
      mobilization: edge.mobilization,
      trust: edge.trust,
      grievance: edge.grievance,
      source: edge.source,
      evidence: toArray(edge.evidence).slice(-3),
      lastTurn: edge.lastTurn,
      expiry: edge.expiry
    };
  }

  // 2026-06-06·把 O((阶层+人物)×边) 的逐项 filter 改为一次性建索引·normalizeName 调用从 ~数十万降到 ~数千(治过回合卡死)
  function buildEdgeIndex(edges) {
    var byClass = Object.create(null), byChar1 = Object.create(null), byChar2 = Object.create(null);
    for (var i = 0; i < edges.length; i += 1) {
      var e = edges[i];
      var cn = normalizeName(e.className); if (cn) (byClass[cn] || (byClass[cn] = [])).push(e);
      var k1 = normalizeName(e.characterId || e.characterName); if (k1) (byChar1[k1] || (byChar1[k1] = [])).push(e);
      var k2 = normalizeName(e.characterName); if (k2) (byChar2[k2] || (byChar2[k2] = [])).push(e);
    }
    return { byClass: byClass, byChar1: byChar1, byChar2: byChar2 };
  }
  // 与原 filter 等价:边匹配人物 = norm(charId||charName)===norm(id||name) 或 norm(charName)===norm(name)
  function charEdgesFromIndex(idx, ch) {
    var id = characterIdOf(ch), nm = characterNameOf(ch);
    var k1 = normalizeName(id || nm), k2 = normalizeName(nm);
    var b1 = (k1 && idx.byChar1[k1]) || [];
    if (!k2 || k2 === k1) return b1.slice();
    var b2 = idx.byChar2[k2] || [];
    if (!b2.length) return b1.slice();
    if (!b1.length) return b2.slice();
    var seen = new Set(b1), out = b1.slice();
    for (var i = 0; i < b2.length; i += 1) if (!seen.has(b2[i])) out.push(b2[i]);
    return out;
  }
  function rebuildMirrors(root) {
    root = pickRoot(root);
    var state = ensureState(root);
    var edges = Object.keys(state.edges).map(function(k) { return state.edges[k]; }).filter(Boolean);
    var idx = buildEdgeIndex(edges);
    getClasses(root).forEach(function(cls) {
      var name = normalizeName(classNameOf(cls));
      cls.classCharacterRelations = ((name && idx.byClass[name]) || []).slice().sort(edgeSort).slice(0, 8).map(compactEdge);
    });
    getCharacters(root).forEach(function(ch) {
      ch.classBackings = charEdgesFromIndex(idx, ch).sort(edgeSort).slice(0, 8).map(compactEdge);
    });
    rebuildCharacterEffects(root, edges, idx);
  }

  function classByName(root, className) {
    var n = normalizeName(className);
    if (!n) return null;
    var classes = getClasses(root);
    for (var i = 0; i < classes.length; i += 1) {
      if (normalizeName(classNameOf(classes[i])) === n) return classes[i];
    }
    return null;
  }

  function classInfluenceWeight(root, className) {
    var cls = classByName(root, className);
    var n = Number(cls && (cls.influence != null ? cls.influence : cls.power));
    if (!isFinite(n)) n = 50;
    return clamp(n / 100, 0.1, 1);
  }

  function roleLabel(role) {
    role = String(role || '').toLowerCase();
    if (role === 'patron') return '庇护';
    if (role === 'broker') return '调停';
    if (role === 'suppressor') return '压制';
    if (role === 'symbol') return '象征';
    if (role === 'debtor') return '亏欠';
    if (role === 'enemy') return '仇怨';
    return '代表';
  }

  function pct(v) {
    var n = Number(v);
    if (!isFinite(n)) return 0;
    if (Math.abs(n) <= 1) n *= 100;
    return Math.round(clamp(n, 0, 100));
  }

  function supportScore(root, edge) {
    edge = edge || {};
    if (/suppressor|enemy/i.test(String(edge.role || ''))) return 0;
    if ((Number(edge.grievance) || 0) >= 0.45) return 0;
    var base = ((Number(edge.affinity) || 0) + (Number(edge.legitimacy) || 0) + (Number(edge.trust) || 0)) / 3;
    return base * (0.65 + classInfluenceWeight(root, edge.className) * 0.35);
  }

  function pressureScore(root, edge) {
    edge = edge || {};
    var grievance = Number(edge.grievance) || 0;
    if (/suppressor|enemy/i.test(String(edge.role || ''))) grievance = Math.max(grievance, 0.55);
    if (grievance < 0.35) return 0;
    return grievance * (0.65 + classInfluenceWeight(root, edge.className) * 0.35);
  }

  function edgeBrief(edge, mode) {
    edge = edge || {};
    var value = mode === 'pressure' ? edge.grievance : edge.trust;
    return (edge.className || '未名阶层') + '(' + roleLabel(edge.role) + '/' + (mode === 'pressure' ? '怨' : '信') + pct(value) + ')';
  }

  function rebuildCharacterEffects(root, edges, idx) {
    root = pickRoot(root);
    edges = toArray(edges);
    if (!idx) idx = buildEdgeIndex(edges);
    getCharacters(root).forEach(function(ch) {
      var mine = charEdgesFromIndex(idx, ch).sort(edgeSort);
      var backing = mine.filter(function(e) { return supportScore(root, e) > 0; }).sort(function(a, b) { return supportScore(root, b) - supportScore(root, a); });
      var opposing = mine.filter(function(e) { return pressureScore(root, e) > 0; }).sort(function(a, b) { return pressureScore(root, b) - pressureScore(root, a); });
      var support = backing.reduce(function(sum, e) { return sum + supportScore(root, e); }, 0);
      var pressure = opposing.reduce(function(sum, e) { return sum + pressureScore(root, e); }, 0);
      ch.socialCapital = pct(Math.min(1, support));
      ch.classPoliticalCapital = ch.socialCapital;
      ch.classPressure = pct(Math.min(1, pressure));
      ch.classSupportSummary = backing.slice(0, 4).map(function(e) { return edgeBrief(e, 'support'); }).join('、');
      ch.classOppositionSummary = opposing.slice(0, 4).map(function(e) { return edgeBrief(e, 'pressure'); }).join('、');
      ch._classCharacterEffect = {
        turn: Number(root.turn) || 0,
        socialCapital: ch.socialCapital,
        classPressure: ch.classPressure,
        backingClasses: backing.slice(0, 6).map(compactEdge),
        opposingClasses: opposing.slice(0, 6).map(compactEdge)
      };
      var stress = toArray(ch.stressSources || ch.pressureSources).filter(function(x) {
        return String(x || '').indexOf('阶层怨望：') !== 0;
      });
      if (opposing.length && ch.classPressure >= 35) {
        stress.push('阶层怨望：' + opposing.slice(0, 3).map(function(e) { return edgeBrief(e, 'pressure'); }).join('、'));
      }
      ch.stressSources = stress;
    });
  }

  function edgeSort(a, b) {
    function score(e) {
      return (Number(e.affinity) || 0) + (Number(e.legitimacy) || 0) + (Number(e.trust) || 0) - (Number(e.grievance) || 0) * 0.5;
    }
    return score(b) - score(a);
  }

  function run(root, options) {
    root = pickRoot(root);
    options = options || {};
    var state = ensureState(root);
    state.turn = Number(options.turn != null ? options.turn : root.turn) || state.turn || 0;
    var discovered = options.skipDiscovery ? 0 : discoverPairs(root, options);
    var signals = options.skipSignals ? 0 : ingestSignals(root, options);
    var expired = expireStale(root, options);
    rebuildMirrors(root);
    return {
      ok: true,
      edges: Object.keys(state.edges).length,
      discovered: discovered,
      signals: signals,
      expired: expired,
      history: state.history.length
    };
  }

  function snapshot(root, options) {
    root = pickRoot(root);
    options = options || {};
    var state = ensureState(root);
    var limit = Number(options.limit) || 20;
    var edges = Object.keys(state.edges).map(function(k) { return state.edges[k]; }).filter(Boolean).sort(edgeSort);
    return {
      count: edges.length,
      edges: edges.slice(0, limit).map(compactEdge),
      history: state.history.slice(-limit).map(clone)
    };
  }

  TM.ClassCharacterRelations = {
    run: run,
    adjustRelation: adjustRelation,
    // 2026-06-07·供外部批量 adjustRelation(skipMirrors:true) 后一次性重建镜像·避免每条更新都全量重建(O(n²)卡死)
    syncMirrors: function(root) { return rebuildMirrors(root); },
    snapshot: snapshot,
    ensureState: ensureState,
    getCharacters: getCharacters
  };
})(typeof window !== 'undefined' ? window : globalThis);
