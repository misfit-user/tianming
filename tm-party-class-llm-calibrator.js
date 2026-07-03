// @ts-check
// ── 章节导航（grep 小节标题跳转，行号会漂）──
//   玩家行为 LLM 校准（剧本特定的党派/阶层动态·暴露 TM.* calibrator）
//   监听玩家 UI 点击（P.conf.partyClassLlmObserveUiClicks 开关）→ debounce → callAI 校准党派/阶层信号
//   与 tm-social-political-signals.js（信号账本）配合
// ─────────────────────────────────────────────
/*
 * tm-party-class-llm-calibrator.js
 * Player-action LLM calibration for scenario-specific party/class dynamics.
 */
(function(global) {
  'use strict';

  var TM = global.TM = global.TM || {};
  var _actionTimer = null;
  var _actionBusy = false;
  var _actionPendingPromise = null;
  var _actionPendingLaunch = null;
  var _actionPendingRoot = null;
  var _observerInstalled = false;

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

  function clamp(n, min, max) {
    n = Number(n);
    if (!isFinite(n)) n = min;
    return Math.max(min, Math.min(max, n));
  }

  function pickRoot(root) {
    if (root && typeof root === 'object') return root;
    if (global.GM && typeof global.GM === 'object') return global.GM;
    if (global.scriptData && typeof global.scriptData === 'object') return global.scriptData;
    return {};
  }

  function normalizeName(v) {
    return String(v || '').replace(/[\s\u3000'"`.,;:!?()[\]{}<>\/\\|_-]+/g, '').toLowerCase().trim();
  }

  function textOf(raw) {
    var value = raw;
    if (raw && typeof raw === 'object') {
      value = raw.text || raw.agenda || raw.goal || raw.objective || raw.topic || raw.title || raw.name || raw.summary || raw.desc || raw.demand || '';
    }
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function getClasses(root) {
    var source = pickRoot(root);
    if (Array.isArray(source.classes)) return source.classes;
    if (Array.isArray(source.socialClasses)) return source.socialClasses;
    if (source.scriptData && Array.isArray(source.scriptData.classes)) return source.scriptData.classes;
    if (source.scriptData && Array.isArray(source.scriptData.socialClasses)) return source.scriptData.socialClasses;
    if (global.P && Array.isArray(global.P.classes)) return global.P.classes;
    if (global.P && Array.isArray(global.P.socialClasses)) return global.P.socialClasses;
    if (global.scriptData && Array.isArray(global.scriptData.classes)) return global.scriptData.classes;
    if (global.scriptData && Array.isArray(global.scriptData.socialClasses)) return global.scriptData.socialClasses;
    return [];
  }

  function getParties(root) {
    var source = pickRoot(root);
    if (Array.isArray(source.parties)) return source.parties;
    if (source.scriptData && Array.isArray(source.scriptData.parties)) return source.scriptData.parties;
    if (global.P && Array.isArray(global.P.parties)) return global.P.parties;
    if (global.scriptData && Array.isArray(global.scriptData.parties)) return global.scriptData.parties;
    if (source.partyState && typeof source.partyState === 'object') {
      return Object.keys(source.partyState).map(function(name) {
        var row = source.partyState[name];
        if (row && typeof row === 'object') {
          if (!row.name) row.name = name;
          return row;
        }
        return { name: name };
      });
    }
    return [];
  }

  function getFactions(root) {
    var source = pickRoot(root);
    var lists = [
      source.facs,
      source.factions,
      source.scriptData && source.scriptData.factions,
      global.P && global.P.facs,
      global.P && global.P.factions,
      global.scriptData && global.scriptData.factions
    ];
    var out = [];
    var seen = {};
    lists.forEach(function(list) {
      toArray(list).forEach(function(fac) {
        if (!fac || typeof fac !== 'object') return;
        var key = normalizeName(fac.name || fac.factionName || fac.id || fac.key);
        if (!key || seen[key]) return;
        seen[key] = true;
        out.push(fac);
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

  function factionNameOf(faction) {
    return String(faction && (faction.name || faction.factionName || faction.id || faction.key) || '').trim();
  }

  function findClass(root, className) {
    var n = normalizeName(className);
    if (!n) return null;
    var list = getClasses(root);
    for (var i = 0; i < list.length; i += 1) {
      var cls = list[i];
      if (!cls) continue;
      if (normalizeName(classNameOf(cls)) === n) return cls;
      var aliases = toArray(cls.aliases || cls.alias || cls.otherNames || cls.altNames);
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
      var aliases = toArray(party.aliases || party.alias || party.otherNames || party.altNames);
      for (var j = 0; j < aliases.length; j += 1) {
        if (normalizeName(aliases[j]) === n) return party;
      }
    }
    var source = pickRoot(root);
    if (source.partyState && source.partyState[partyName] && typeof source.partyState[partyName] === 'object') return source.partyState[partyName];
    return null;
  }

  function findFaction(root, factionName) {
    var n = normalizeName(factionName);
    if (!n) return null;
    var list = getFactions(root);
    for (var i = 0; i < list.length; i += 1) {
      var fac = list[i];
      if (!fac) continue;
      if (normalizeName(factionNameOf(fac)) === n) return fac;
      var aliases = toArray(fac.aliases || fac.alias || fac.otherNames || fac.altNames);
      for (var j = 0; j < aliases.length; j += 1) {
        if (normalizeName(aliases[j]) === n) return fac;
      }
    }
    return null;
  }

  function compactGoal(goal) {
    if (!goal) return null;
    return {
      kind: goal.kind || goal.type || '',
      text: textOf(goal),
      priority: goal.priority,
      status: goal.status || '',
      sourceClass: goal.sourceClass || '',
      demandText: goal.demandText || ''
    };
  }

  function snapshotClass(cls, root) {
    // 政治运动（V3式·GM._politicalMovements·SocialFoundation §三E）：取本阶层最盛一支
    var movement;
    if (root && Array.isArray(root._politicalMovements) && cls && cls.name) {
      root._politicalMovements.forEach(function(m) {
        if (m && m.className === cls.name && (!movement || Number(m.support) > Number(movement.support))) {
          movement = { label: String(m.label || m.kind || '').slice(0, 30), phase: m.phase || '', support: Math.round(Number(m.support) || 0) };
        }
      });
      if (movement && movement.support < 40) movement = undefined;
    }
    // 满意度近势：_satLedger 最近一个回合的净变动（主推演正册同款信号·此前校准器全盲）
    var satTrend;
    var ledger = toArray(cls && cls._satLedger);
    if (ledger.length) {
      var maxT = ledger.reduce(function(m, e) { return Math.max(m, Number(e && e.t) || 0); }, 0);
      var sum = 0;
      ledger.forEach(function(e) { if (e && Number(e.t) === maxT) sum += Number(e.d) || 0; });
      if (sum) satTrend = Math.round(sum * 100) / 100;
    }
    // 最艰地域：地域分账中满意度最低的一地
    var worstRegion;
    toArray(cls && cls.regionalVariants).forEach(function(rv) {
      if (!rv || typeof rv.satisfaction !== 'number') return;
      if (!worstRegion || rv.satisfaction < worstRegion.satisfaction) {
        worstRegion = { region: rv.region || rv.name || '', satisfaction: Math.round(rv.satisfaction) };
      }
    });
    return {
      name: classNameOf(cls),
      satisfaction: cls && cls.satisfaction,
      influence: cls && cls.influence,
      structBaseline: (cls && typeof cls._structBaseline === 'number') ? Math.round(cls._structBaseline) : undefined,
      satTrend: satTrend,
      radicalFrac: (cls && typeof cls._radicalFrac === 'number' && cls._radicalFrac > 0.01) ? Math.round(cls._radicalFrac * 100) / 100 : undefined,
      revoltPhase: (cls && cls.revoltState && cls.revoltState.phase) || undefined,
      movement: movement,
      worstRegion: worstRegion,
      demands: clone(cls && (cls.demands || cls.currentDemand || cls.currentAgenda || cls.shortGoal)),
      unrestLevels: clone(cls && cls.unrestLevels),
      supportingParties: clone(cls && (cls.supportingParties || cls.supporting_parties)),
      tags: clone(cls && (cls.tags || cls.labels || cls.keywords)),
      recentHistory: toArray(cls && (cls.partyOutcomeHistory || cls.outcomeHistory || cls._partyClassLlmHistory)).slice(-5)
    };
  }

  function snapshotParty(party, root) {
    // 引擎账补注：占官/清誉/弹劾胜负/运行时盟敌（partyState 侧·主推演有喂而校准器此前全盲）
    var ps = (root && root.partyState && party) ? root.partyState[partyNameOf(party)] : null;
    return {
      name: partyNameOf(party),
      influence: party && party.influence,
      cohesion: party && party.cohesion,
      standing: (ps && ps.standing) || (party && party.standing) || undefined,
      officeCount: (ps && typeof ps.officeCount === 'number' && ps.officeCount > 0) ? ps.officeCount : undefined,
      reputation: (ps && typeof ps.reputationBalance === 'number' && ps.reputationBalance !== 0) ? ps.reputationBalance : undefined,
      recentImpeach: (ps && ((ps.recentImpeachWin || 0) >= 0.5 || (ps.recentImpeachLose || 0) >= 0.5))
        ? { win: Math.round((ps.recentImpeachWin || 0) * 10) / 10, lose: Math.round((ps.recentImpeachLose || 0) * 10) / 10 }
        : undefined,
      alliedWith: (ps && Array.isArray(ps.alliedWith) && ps.alliedWith.length) ? clone(ps.alliedWith) : undefined,
      conflictWith: (ps && Array.isArray(ps.conflictWith) && ps.conflictWith.length) ? clone(ps.conflictWith) : undefined,
      currentAgenda: party && party.currentAgenda,
      shortGoal: party && party.shortGoal,
      policyStance: clone(party && party.policyStance),
      socialBase: clone(party && (party.socialBase || party.social_base || party.baseClasses)),
      rivals: clone(party && (party.rivals || party.enemies || party.rivalParty || party.rival)),
      goals: toArray(party && (party.goals || party.partyGoals)).slice(0, 8).map(compactGoal),
      recentHistory: toArray(party && (party.agenda_history || party._partyClassLlmHistory)).slice(-5)
    };
  }

  function snapshotFaction(faction) {
    return {
      name: factionNameOf(faction),
      id: faction && faction.id,
      strength: faction && faction.strength,
      economy: faction && faction.economy,
      playerRelation: faction && faction.playerRelation,
      attitude: faction && faction.attitude,
      status: faction && faction.status,
      leader: faction && (faction.leader || faction.ruler || faction.head),
      currentAgenda: faction && (faction.currentAgenda || faction.agenda),
      shortGoal: faction && faction.shortGoal,
      policyStance: clone(faction && faction.policyStance),
      tags: clone(faction && (faction.tags || faction.labels || faction.keywords)),
      recentHistory: toArray(faction && (faction._partyClassLlmHistory || faction._factionHistory || faction.historicalEvents)).slice(-5)
    };
  }

  function snapshotRelations(root) {
    var state = root && root.partyClassRelations;
    var edges = state && state.edges && typeof state.edges === 'object' ? state.edges : {};
    return Object.keys(edges).map(function(key) {
      var e = edges[key] || {};
      return {
        className: e.className,
        partyName: e.partyName,
        affinity: e.affinity,
        trust: e.trust,
        grievance: e.grievance,
        momentum: e.momentum,
        status: e.status,
        seeded: !!e.seeded,
        lastReason: e.lastReason || '',
        evidence: toArray(e.evidence).slice(-3)
      };
    }).slice(-80);
  }

  function snapshotRecentCourt(root) {
    var out = [];
    toArray(root && root.tinyiSeals).slice(-6).forEach(function(x) {
      out.push({
        type: 'tinyiSeal',
        topic: x && (x.topic || x.title || x.issue),
        party: x && (x.sourceParty || x.proposerParty || x.party),
        className: x && (x.sourceClass || x.className),
        outcome: x && (x.outcome || x.sealStatus || x.status)
      });
    });
    toArray(root && root.evtLog).slice(-10).forEach(function(x) {
      out.push({ type: x && x.type, text: x && x.text, turn: x && x.turn });
    });
    return out.slice(-12);
  }

  function issueTextOf(issue) {
    if (!issue) return '';
    return textOf(issue.topic || issue.title || issue.issue || issue.name || issue.text || issue.content || issue.detail || issue.summary || issue.description || '');
  }

  function issueIdOf(issue, prefix, idx) {
    return String(issue && (issue.id || issue.issueId || issue.topicId || issue.chaoyiTrackId || issue.trackId) || ((prefix || 'issue') + '-' + idx));
  }

  function snapshotCourtIssues(root) {
    root = pickRoot(root);
    var rows = [];
    var seen = {};
    function add(issue, type, idx) {
      if (!issue || typeof issue !== 'object') return;
      var topic = issueTextOf(issue);
      if (!topic) return;
      var id = issueIdOf(issue, type, idx);
      var key = normalizeName(id + '|' + topic);
      if (seen[key]) return;
      seen[key] = true;
      rows.push({
        id: id,
        type: type || issue.type || '',
        topic: topic,
        status: issue.status || issue.sealStatus || issue.outcome || '',
        category: issue.category || issue.dept || issue.kind || '',
        sourceParty: issue.sourceParty || issue.proposerParty || issue.party || '',
        opposingParties: clone(issue.opposingParties || issue.blockerParty || []),
        sourceClass: issue.sourceClass || issue.className || '',
        demandText: issue.demandText || '',
        linkedParties: clone(issue.linkedParties || issue.parties || []),
        linkedClasses: clone(issue.linkedClasses || issue.classes || []),
        priority: issue.priority || issue.importance || issue.severity || '',
        turn: issue.turn || issue.raisedTurn || issue.sealTurn || issue.dueTurn || 0,
        text: compactPlayerText(issue.content || issue.detail || issue.summary || issue.description || issue.text || '', 180),
        recentHistory: toArray(issue._partyClassLlmHistory).slice(-3)
      });
    }
    var current = root.currentIssues;
    if (Array.isArray(current)) current.forEach(function(x, i) { add(x, 'currentIssue', i); });
    else if (current && typeof current === 'object') Object.keys(current).forEach(function(k, i) { add(current[k], 'currentIssue', i); });
    toArray(root.pendingTinyiTopics || root._pendingTinyiTopics || (root.tinyi && root.tinyi.pendingTopics)).forEach(function(x, i) { add(x, 'pendingTinyi', i); });
    toArray(root._ccHeldItems).forEach(function(x, i) { add(x, 'heldCourtIssue', i); });
    toArray(root.recentChaoyi).forEach(function(x, i) { add(x, 'recentCourt', i); });
    toArray(root._courtRecords).slice(-12).forEach(function(x, i) { add(x, 'courtRecord', i); });
    toArray(root.tinyiSeals).slice(-10).forEach(function(x, i) { add(x, 'tinyiSeal', i); });
    toArray(root.tinyi && root.tinyi.followUpQueue).forEach(function(x, i) { add(x, 'tinyiFollowUp', i); });
    toArray(root._partyClassCourtIssues).forEach(function(x, i) { add(x, 'calibratedCourtIssue', i); });
    return rows.slice(-80);
  }

  function compactPlayerText(v, maxLen) {
    var text = textOf(v);
    maxLen = Number(maxLen) || 160;
    return text.length > maxLen ? text.slice(0, maxLen) : text;
  }

  function snapshotOfficePending(root) {
    var out = [];
    function walk(nodes, path) {
      toArray(nodes).forEach(function(node) {
        if (!node || typeof node !== 'object' || out.length >= 8) return;
        var name = node.name || node.title || node.id || '';
        var nextPath = path ? path + '/' + name : String(name || '');
        toArray(node.positions).forEach(function(pos) {
          if (!pos || typeof pos !== 'object' || out.length >= 8) return;
          if (pos._pendingEdict || pos.pendingEdict || pos.pendingAppointment) {
            out.push({
              officePath: nextPath,
              position: pos.name || pos.title || '',
              holder: pos.holder || '',
              pending: compactPlayerText(pos._pendingEdict || pos.pendingEdict || pos.pendingAppointment, 120)
            });
          }
        });
        walk(node.subs || node.children || node.departments, nextPath);
      });
    }
    walk(root && root.officeTree, '');
    return out;
  }

  function snapshotPlayerOperations(root) {
    root = pickRoot(root);
    var turn = Number(root.turn) || 0;
    var edictSuggestions = toArray(root._edictSuggestions).filter(function(x) {
      return x && x.used !== true;
    }).slice(-8).map(function(x) {
      return {
        source: x.source || '',
        from: x.from || '',
        content: compactPlayerText(x.content || x.text || x.title, 180),
        turn: x.turn || turn
      };
    });
    var edictDrafts = [];
    if (root.edicts && typeof root.edicts === 'object' && !Array.isArray(root.edicts)) {
      Object.keys(root.edicts).forEach(function(k) {
        var text = compactPlayerText(root.edicts[k], 180);
        if (text) edictDrafts.push({ category: k, text: text });
      });
    }
    toArray(root._edictTracker || root._issuedEdicts || root.edictLog).slice(-6).forEach(function(x) {
      if (!x) return;
      edictDrafts.push({
        category: x.category || x.kind || x.type || '',
        text: compactPlayerText(x.text || x.content || x.edict || x.title, 180),
        status: x.status || '',
        turn: x.turn || 0
      });
    });
    var pendingMemorials = toArray(root.memorials).filter(function(m) {
      if (!m) return false;
      var status = String(m.status || '').toLowerCase();
      return m.reviewed !== true && !/resolved|closed|done|rejected|approved/.test(status);
    }).slice(-8).map(function(m) {
      return {
        from: m.from || m.author || m.proposer || '',
        title: m.title || m.subject || '',
        text: compactPlayerText(m.text || m.content || m.body || m.summary, 180),
        dept: m.dept || m.department || '',
        status: m.status || (m.reviewed ? 'reviewed' : 'pending')
      };
    });
    var recentLetters = toArray(root.letters).filter(function(l) {
      if (!l) return false;
      var status = String(l.status || l.state || '').toLowerCase();
      var lTurn = Number(l.turn || l.sentTurn || l.createdTurn) || 0;
      return /pending|draft|reply|arrived|unread|wait|travel/.test(status) || !turn || !lTurn || lTurn >= turn - 4;
    }).slice(-8).map(function(l) {
      return {
        from: l.from || l.sender || '',
        to: l.to || l.receiver || '',
        subject: l.subjectLine || l.subject || l.title || '',
        status: l.status || l.state || '',
        content: compactPlayerText(l.content || l.text || l.reply || l.suggestion, 180),
        turn: l.turn || l.sentTurn || l.createdTurn || 0
      };
    });
    return {
      edictSuggestions: edictSuggestions,
      edictDrafts: edictDrafts.slice(-8),
      pendingMemorials: pendingMemorials,
      recentLetters: recentLetters,
      wenduiTarget: root.wenduiTarget || root._pendingWenduiChar || '',
      pendingLetterTo: root._pendingLetterTo || '',
      officePending: snapshotOfficePending(root)
    };
  }

  function buildSnapshot(root, options) {
    var source = pickRoot(root);
    options = options || {};
    return {
      turn: Number(options.turn != null ? options.turn : source.turn) || 0,
      source: options.source || '',
      phase: options.phase || '',
      scenario: {
        sid: source.sid || '',
        name: source.scenarioName || source.scenario || '',
        eraName: source.eraName || ''
      },
      classes: getClasses(source).map(function(c) { return snapshotClass(c, source); }).filter(function(x) { return !!x.name; }),
      parties: getParties(source).map(function(p) { return snapshotParty(p, source); }).filter(function(x) { return !!x.name; }),
      legitimacy: (source._legitimacy && typeof source._legitimacy === 'object') ? clone(source._legitimacy) : undefined,
      fiscalNote: (typeof source.stateTreasury === 'number') ? { stateTreasury: Math.round(source.stateTreasury) } : undefined,
      factions: getFactions(source).map(snapshotFaction).filter(function(x) { return !!x.name; }),
      relations: snapshotRelations(source),
      classCharacterRelations: (TM.ClassCharacterRelations && typeof TM.ClassCharacterRelations.snapshot === 'function')
        ? TM.ClassCharacterRelations.snapshot(source, { limit: 24 })
        : { count: 0, edges: [], history: [] },
      courtIssues: snapshotCourtIssues(source),
      relationIndex: source._partyGoalRelationIndex || null,
      structuredPlayerSignals: (TM.PlayerActionSignals && typeof TM.PlayerActionSignals.snapshot === 'function')
        ? TM.PlayerActionSignals.snapshot(source, { limit: 12 })
        : null,
      socialPoliticalSignals: (TM.SocialPoliticalSignals && typeof TM.SocialPoliticalSignals.snapshot === 'function')
        ? TM.SocialPoliticalSignals.snapshot(source, { limit: 12 })
        : null,
      partyClassActorMemory: (TM.PartyClassActors && typeof TM.PartyClassActors.snapshot === 'function')
        ? TM.PartyClassActors.snapshot(source, { limit: 20 })
        : null,
      partyActions: toArray(source.party_actions).slice(-20),
      classActions: toArray(source.class_actions).slice(-20),
      playerActionSignals: toArray(source._partyClassLlmActionSignals).slice(-12),
      playerOperations: snapshotPlayerOperations(source),
      recentCourt: snapshotRecentCourt(source)
    };
  }

  function buildMessages(snapshot) {
    var schema = {
      relation_adjustments: [
        { party: 'party name from snapshot', className: 'class name from snapshot', affinityDelta: 0, trustDelta: 0, grievanceDelta: 0, reason: 'short reason' }
      ],
      class_updates: [
        { className: 'class name from snapshot', satisfactionDelta: 0, demands: ['该阶层独有的具体诉求(中文)'], unrestDelta: { grievance: 0, petition: 0, strike: 0, revolt: 0 } }
      ],
      party_updates: [
        { party: 'party name from snapshot', currentAgenda: 'short agenda', shortGoal: 'short goal', cohesionDelta: 0 }
      ],
      faction_updates: [
        { faction: 'faction name from snapshot', strengthDelta: 0, economyDelta: 0, playerRelationDelta: 0, attitude: 'optional stance', shortGoal: 'short goal', reason: 'short reason' }
      ],
      court_issue_updates: [
        { issueId: 'issue id from snapshot', topic: 'issue topic', status: 'pending/linked/held/escalated/resolved', sourceParty: 'party name', sourceClass: 'class name', linkedParties: ['party name'], linkedClasses: ['class name'], priorityDelta: 0, reason: 'short reason' }
      ],
      issue_goal_links: [
        { issueId: 'issue id from snapshot', party: 'party name', className: 'class name', goalText: 'short party objective tied to the court issue', affinityDelta: 0, emergent: true, reason: 'short reason' }
      ],
      class_character_relation_updates: [
        { className: 'class name from snapshot', characterName: 'character name from snapshot.classCharacterRelations or characters', role: 'spokesperson/patron/broker/suppressor/symbol/debtor', affinityDelta: 0, legitimacyDelta: 0, mobilizationDelta: 0, trustDelta: 0, grievanceDelta: 0, evidence: ['short current evidence'], reason: 'short reason' }
      ],
      notes: ['short note']
    };
    var system = [
      'You calibrate a historical simulation game state.',
      'Use only faction, party, class, character, and court issue names present in the snapshot.',
      'Do not create fixed permanent pairings. Infer gradual dynamic changes from current evidence.',
      'Different scenarios may have unrelated factions/classes/parties. Treat all links as runtime evidence that can emerge, cool down, or reverse.',
      'Prefer structuredPlayerSignals and playerOperations when judging the latest player action impact.',
      'Use socialPoliticalSignals as deterministic system/court evidence already produced by game subsystems.',
      'Court issue updates should tie topics to party short goals or class demands only when the snapshot evidence supports it.',
      'Class-character relation updates should describe who a class treats as spokesperson, patron, broker, suppressor, symbol, or debtor from current evidence only.',
      'Return strict JSON only. No markdown, no prose outside JSON.',
      'Deltas should usually be small: affinity/trust/grievance between -25 and 25, satisfaction/cohesion between -10 and 10, faction deltas between -8 and 8.',
      'Never return absolute satisfaction values; use satisfactionDelta only. Class mood must move gradually with evidence.',
      'All demands/agenda/goal texts must be written in Chinese, concise and concrete. Each class has distinct interests rooted in its own economic role and grievances - never reuse the same demand wording across different classes. Only include demands for a class when the evidence shows a genuinely new or shifted demand; omit otherwise.',
      'For class-character relation updates use fractional deltas between -0.25 and 0.25 and keep evidence short.',
      'For new or uncertain party-class links set emergent:true and keep affinityDelta small.',
      'Snapshot field semantics: class.structBaseline = structural equilibrium satisfaction (satisfaction far below it means pressure to recover, far above means drift down); class.satTrend = last-turn net satisfaction drift; class.radicalFrac = radicalized fraction 0-1 (>=0.4 is dangerous); class.revoltPhase = current unrest phase; class.movement = political movement condensed from a long-unmet demand (support 0-100; >=70 is boiling and destabilizing); class.worstRegion = hardest-hit regional account. party.standing = governing/opposition/marginal court position; party.officeCount = offices held; party.reputation = public repute -60..60 (positive = clean-stream prestige); party.recentImpeach = recent impeachment wins/losses; party.alliedWith/conflictWith = live alliances/feuds. legitimacy = mandate weighting; fiscalNote.stateTreasury = court treasury. Ground your deltas in these accounts.'
    ].join('\n');
    var user = [
      'Snapshot JSON:',
      JSON.stringify(snapshot),
      '',
      'Return JSON with this shape:',
      JSON.stringify(schema)
    ].join('\n');
    return [{ role: 'system', content: system }, { role: 'user', content: user }];
  }

  function hasSecondaryConfig() {
    var ai = global.P && P.ai;
    var secondary = ai && ai.secondary;
    if (!secondary || !secondary.key || !secondary.url) return false;
    if (global.P && P.conf && P.conf.secondaryEnabled === false) return false;
    return true;
  }

  function chooseTier() {
    return hasSecondaryConfig() ? 'secondary' : 'primary';
  }

  function hasAnyAiConfig() {
    var ai = global.P && P.ai;
    return !!((ai && ai.key && ai.url) || hasSecondaryConfig());
  }

  function extractJson(raw) {
    var s = String(raw || '').trim();
    if (!s) return null;
    s = s.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
    try { return JSON.parse(s); } catch (_) {}
    var start = s.indexOf('{');
    var end = s.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try { return JSON.parse(s.slice(start, end + 1)); } catch (_) {}
    }
    return null;
  }

  function normalizeResponse(parsed) {
    parsed = parsed && typeof parsed === 'object' ? parsed : {};
    return {
      relation_adjustments: toArray(parsed.relation_adjustments || parsed.relationAdjustments),
      class_updates: toArray(parsed.class_updates || parsed.classUpdates),
      party_updates: toArray(parsed.party_updates || parsed.partyUpdates),
      faction_updates: toArray(parsed.faction_updates || parsed.factionUpdates),
      court_issue_updates: toArray(parsed.court_issue_updates || parsed.courtIssueUpdates),
      issue_goal_links: toArray(parsed.issue_goal_links || parsed.issueGoalLinks),
      class_character_relation_updates: toArray(parsed.class_character_relation_updates || parsed.classCharacterRelationUpdates || parsed.classCharacterUpdates),
      notes: toArray(parsed.notes).map(textOf).filter(Boolean)
    };
  }

  async function callCalibrationLlm(messages, options) {
    options = options || {};
    var tier = options.tier || chooseTier();
    var maxTokens = Math.max(800, Math.min(4000, Number(options.maxTokens || (global.P && P.conf && P.conf.partyClassLlmMaxTokens) || 1800) || 1800));
    var timeoutMs = Number(options.timeoutMs || (global.P && P.conf && P.conf.partyClassLlmTimeoutMs) || 45000) || 45000;
    var callOpts = {
      priority: options.priority || 'background',
      timeoutMs: timeoutMs,
      maxRetries: options.maxRetries != null ? options.maxRetries : 1,
      id: 'party-class-llm-calibrator'
    };
    if (typeof global.callAIMessages === 'function') {
      return {
        text: await global.callAIMessages(messages, maxTokens, null, tier, callOpts),
        tier: tier,
        maxTokens: maxTokens
      };
    }
    if (typeof global.callAI === 'function') {
      var prompt = messages.map(function(m) { return String(m.role || 'user').toUpperCase() + ':\n' + String(m.content || ''); }).join('\n\n');
      return {
        text: await global.callAI(prompt, maxTokens, null, tier, callOpts),
        tier: tier,
        maxTokens: maxTokens
      };
    }
    throw new Error('AI caller missing');
  }

  function applyClassUpdate(root, update, turn, sourceName) {
    update = update || {};
    var cls = findClass(root, update.className || update.sourceClass || update.class || update.name);
    if (!cls) return false;
    var changed = false;
    var beforeSat = Number(cls.satisfaction);
    if (!isFinite(beforeSat)) beforeSat = 50;
    var gateFn = TM.ClassEngine && typeof TM.ClassEngine.gateSatisfaction === 'function' ? TM.ClassEngine.gateSatisfaction : null;
    function pushSat(delta, why) {
      delta = clamp(delta, -8, 8);
      if (!delta) return false;
      if (gateFn) {
        var g = gateFn(root, cls, delta, { turn: turn, source: sourceName || 'llm-calibration', reason: why || update.reason || 'LLM 校准' });
        return !!g.approved;
      }
      var current = Number(cls.satisfaction);
      if (!isFinite(current)) current = 50;
      cls.satisfaction = Math.round(clamp(current + delta, 0, 100) * 100) / 100;
      return true;
    }
    var satDelta = Number(update.satisfactionDelta != null ? update.satisfactionDelta : update.satisfaction_delta);
    if (isFinite(satDelta) && satDelta) {
      if (pushSat(satDelta, update.reason)) changed = true;
    }
    // 绝对值通道关闸：旧版 LLM 返回 satisfaction:0 即硬设 0（「满意度无缘无故跌到 0」病根之一）。
    // 现转为与当前值之差，限幅 ±8 并走满意度总闸。
    if (update.satisfaction != null) {
      var absTarget = Number(update.satisfaction);
      var absCur = Number(cls.satisfaction);
      if (!isFinite(absCur)) absCur = 50;
      if (isFinite(absTarget) && pushSat(absTarget - absCur, update.reason || '校准回归')) changed = true;
    }
    if (update.demands != null || update.currentDemand != null) {
      var demands = toArray(update.demands != null ? update.demands : update.currentDemand).map(textOf).filter(Boolean);
      if (demands.length) {
        var SFD = TM.SocialFoundation;
        if (SFD && typeof SFD.setAiDemand === 'function') {
          SFD.setAiDemand(root, cls, demands.join('·'), { turn: turn, source: sourceName || 'llm-calibration' });
        } else {
          cls.demands = demands.length === 1 ? [demands[0]] : demands;
          cls.currentDemand = demands[0];
        }
        changed = true;
      }
    }
    var unrestDelta = update.unrestDelta || update.unrest_delta || null;
    if (unrestDelta && typeof unrestDelta === 'object') {
      if (!cls.unrestLevels || typeof cls.unrestLevels !== 'object') cls.unrestLevels = {};
      Object.keys(unrestDelta).forEach(function(k) {
        var d = Number(unrestDelta[k]);
        if (!isFinite(d) || !d) return;
        var old = Number(cls.unrestLevels[k]);
        if (!isFinite(old)) old = 50;
        cls.unrestLevels[k] = Math.round(clamp(old + clamp(d, -15, 15), 0, 100) * 100) / 100;
        changed = true;
      });
    }
    if (changed) {
      cls._partyClassLlmHistory = toArray(cls._partyClassLlmHistory);
      cls._partyClassLlmHistory.push({ turn: turn, source: sourceName, update: clone(update) });
      if (cls._partyClassLlmHistory.length > 20) cls._partyClassLlmHistory = cls._partyClassLlmHistory.slice(-20);
    }
    if (changed) {
      try {
        if (TM.ClassMinxinBridge && typeof TM.ClassMinxinBridge.applyClassPressure === 'function') {
          var afterSat = Number(cls.satisfaction);
          var appliedSatDelta = isFinite(afterSat) ? (afterSat - beforeSat) : (isFinite(satDelta) ? satDelta : 0);
          TM.ClassMinxinBridge.applyClassPressure(root, {
            turn: turn,
            sourceSystem: sourceName || 'party-class-llm-calibration',
            sourceId: update.sourceId || update.id || ['llm-class-update', turn, classNameOf(cls), update.linkedIssue || update.issueId || '', update.reason || textOf(update.demands || update.currentDemand || '')].join('|'),
            className: classNameOf(cls),
            satisfactionDelta: appliedSatDelta,
            unrestDelta: update.unrestDelta || update.unrest_delta || null,
            linkedIssue: update.linkedIssue || update.issueId || '',
            reason: update.reason || textOf(update.demands || update.currentDemand || 'LLM class calibration')
          });
        }
      } catch (_classMinxinBridgeE) {}
    }
    return changed;
  }

  function applyPartyUpdate(root, update, turn, sourceName) {
    update = update || {};
    var party = findParty(root, update.party || update.partyName || update.name);
    if (!party) return false;
    var changed = false;
    function setGoalField(kind, value, priority) {
      var text = textOf(value);
      if (!text) return;
      party[kind] = text;
      changed = true;
      if (TM.PartyGoals && typeof TM.PartyGoals.setGoal === 'function') {
        try {
          TM.PartyGoals.setGoal(root, party, {
            kind: kind,
            type: kind,
            text: text,
            priority: priority,
            generatedFrom: 'party-class-llm'
          }, {
            turn: turn,
            source: sourceName,
            priority: priority,
            expiresTurn: turn + (kind === 'currentAgenda' ? 6 : 4),
            generatedFrom: 'party-class-llm'
          });
        } catch (_) {}
      }
    }
    setGoalField('currentAgenda', update.currentAgenda || update.agenda, 92);
    setGoalField('shortGoal', update.shortGoal || update.goal, 74);
    var cohesionDelta = Number(update.cohesionDelta != null ? update.cohesionDelta : update.cohesion_delta);
    if (isFinite(cohesionDelta) && cohesionDelta) {
      var cohesion = Number(party.cohesion);
      if (!isFinite(cohesion)) cohesion = 50;
      party.cohesion = Math.round(clamp(cohesion + clamp(cohesionDelta, -15, 15), 0, 100) * 100) / 100;
      changed = true;
    }
    if (update.cohesion != null) {
      party.cohesion = Math.round(clamp(update.cohesion, 0, 100) * 100) / 100;
      changed = true;
    }
    if (changed) {
      party._partyClassLlmHistory = toArray(party._partyClassLlmHistory);
      party._partyClassLlmHistory.push({ turn: turn, source: sourceName, update: clone(update) });
      if (party._partyClassLlmHistory.length > 20) party._partyClassLlmHistory = party._partyClassLlmHistory.slice(-20);
    }
    return changed;
  }

  function pushUniqueText(list, value) {
    value = textOf(value);
    if (!value || list.indexOf(value) >= 0) return;
    list.push(value);
  }

  function adjustNumberField(obj, field, delta, min, max, fallback) {
    delta = Number(delta);
    if (!obj || !isFinite(delta) || !delta) return false;
    var old = Number(obj[field]);
    if (!isFinite(old)) old = fallback;
    obj[field] = Math.round(clamp(old + delta, min, max) * 100) / 100;
    return true;
  }

  function applyFactionUpdate(root, update, turn, sourceName) {
    update = update || {};
    var faction = findFaction(root, update.faction || update.factionName || update.name);
    if (!faction) return false;
    var changed = false;
    // faction delta 幅度闸：system 提示口头约 ±8 但此前代码零强制——LLM 一条 strengthDelta:90 就能把势力从 50 拉满
    function fdClamp(v) { v = Number(v); return isFinite(v) ? clamp(v, -8, 8) : v; }
    changed = adjustNumberField(faction, 'strength', fdClamp(update.strengthDelta != null ? update.strengthDelta : update.strength_delta), 0, 100, 50) || changed;
    changed = adjustNumberField(faction, 'economy', fdClamp(update.economyDelta != null ? update.economyDelta : update.economy_delta), 0, 100, 50) || changed;
    changed = adjustNumberField(faction, 'playerRelation', fdClamp(update.playerRelationDelta != null ? update.playerRelationDelta : update.playerRelation_delta), -100, 100, 0) || changed;
    if (update.attitude || update.stance) {
      faction.attitude = textOf(update.attitude || update.stance).slice(0, 40);
      changed = true;
    }
    if (update.status) {
      faction.status = textOf(update.status).slice(0, 40);
      changed = true;
    }
    if (update.currentAgenda || update.agenda) {
      faction.currentAgenda = textOf(update.currentAgenda || update.agenda).slice(0, 120);
      changed = true;
    }
    if (update.shortGoal || update.goal) {
      faction.shortGoal = textOf(update.shortGoal || update.goal).slice(0, 120);
      changed = true;
    }
    if (changed) {
      faction._partyClassLlmHistory = toArray(faction._partyClassLlmHistory);
      faction._partyClassLlmHistory.push({ turn: turn, source: sourceName, update: clone(update) });
      if (faction._partyClassLlmHistory.length > 20) faction._partyClassLlmHistory = faction._partyClassLlmHistory.slice(-20);
    }
    return changed;
  }

  // 批内 refs 缓存：applyResult 一批 N 条 court_issue_updates/issue_goal_links 原本每条全量重扫
  // 全部议题集合（currentIssues/pendingTinyi/held/courtRecords/tinyiSeals/…）= O(N×M) 残留热点。
  // 缓存按 root 引用命中·applyResult 进出与影子议题 push 时失效。
  var _cirCache = null;
  function _invalidateCourtIssueRefs() { _cirCache = null; }

  function collectCourtIssueRefs(root) {
    root = pickRoot(root);
    if (_cirCache && _cirCache.root === root) return _cirCache.refs;
    var refs = [];
    function add(item, type, idx) {
      if (item && typeof item === 'object') refs.push({ item: item, type: type, idx: idx, id: issueIdOf(item, type, idx), topic: issueTextOf(item) });
    }
    var current = root.currentIssues;
    if (Array.isArray(current)) current.forEach(function(x, i) { add(x, 'currentIssue', i); });
    else if (current && typeof current === 'object') Object.keys(current).forEach(function(k, i) { add(current[k], 'currentIssue', i); });
    toArray(root.pendingTinyiTopics || root._pendingTinyiTopics || (root.tinyi && root.tinyi.pendingTopics)).forEach(function(x, i) { add(x, 'pendingTinyi', i); });
    toArray(root._ccHeldItems).forEach(function(x, i) { add(x, 'heldCourtIssue', i); });
    toArray(root.recentChaoyi).forEach(function(x, i) { add(x, 'recentCourt', i); });
    toArray(root._courtRecords).forEach(function(x, i) { add(x, 'courtRecord', i); });
    toArray(root.tinyiSeals).forEach(function(x, i) { add(x, 'tinyiSeal', i); });
    toArray(root.tinyi && root.tinyi.followUpQueue).forEach(function(x, i) { add(x, 'tinyiFollowUp', i); });
    toArray(root._partyClassCourtIssues).forEach(function(x, i) { add(x, 'calibratedCourtIssue', i); });
    _cirCache = { root: root, refs: refs };
    return refs;
  }

  function findCourtIssue(root, update) {
    var source = pickRoot(root);
    update = update || {};
    var id = String(update.issueId || update.id || update.topicId || update.chaoyiTrackId || '').trim();
    var topic = issueTextOf(update);
    var nTopic = normalizeName(topic);
    var refs = collectCourtIssueRefs(source);
    for (var i = 0; i < refs.length; i += 1) {
      var ref = refs[i];
      if (id && String(ref.id) === id) return ref.item;
    }
    for (var j = 0; j < refs.length; j += 1) {
      var r = refs[j];
      if (nTopic && normalizeName(r.topic) === nTopic) return r.item;
    }
    return null;
  }

  function ensureShadowCourtIssue(root, update, turn) {
    root = pickRoot(root);
    if (!Array.isArray(root._partyClassCourtIssues)) root._partyClassCourtIssues = [];
    var issue = findCourtIssue(root, update);
    if (issue) return issue;
    issue = {
      id: String(update.issueId || update.id || ('pcci-' + turn + '-' + (root._partyClassCourtIssues.length + 1))),
      topic: issueTextOf(update) || textOf(update.goalText || update.reason || 'court issue'),
      status: update.status || 'linked',
      turn: turn,
      source: 'party-class-llm'
    };
    root._partyClassCourtIssues.push(issue);
    if (root._partyClassCourtIssues.length > 40) root._partyClassCourtIssues = root._partyClassCourtIssues.slice(-40);
    _invalidateCourtIssueRefs();
    return issue;
  }

  function mergeIssueNames(issue, field, values) {
    issue[field] = toArray(issue[field]).map(textOf).filter(Boolean);
    toArray(values).forEach(function(v) { pushUniqueText(issue[field], v); });
  }

  function applyCourtIssueUpdate(root, update, turn, sourceName) {
    update = update || {};
    var issue = ensureShadowCourtIssue(root, update, turn);
    if (!issue) return false;
    var changed = false;
    if (update.topic && !issue.topic) { issue.topic = textOf(update.topic); changed = true; }
    if (update.status) { issue.status = textOf(update.status).slice(0, 40); changed = true; }
    if (update.sourceParty || update.party || update.proposerParty) {
      issue.sourceParty = textOf(update.sourceParty || update.party || update.proposerParty).slice(0, 80);
      changed = true;
    }
    if (update.sourceClass || update.className || update.class) {
      issue.sourceClass = textOf(update.sourceClass || update.className || update.class).slice(0, 80);
      issue.className = issue.sourceClass;
      changed = true;
    }
    if (update.reason) { issue.lastReason = textOf(update.reason).slice(0, 180); changed = true; }
    mergeIssueNames(issue, 'linkedParties', toArray(update.linkedParties || update.parties).concat(update.sourceParty || update.party || []));
    mergeIssueNames(issue, 'linkedClasses', toArray(update.linkedClasses || update.classes).concat(update.sourceClass || update.className || update.class || []));
    var pDelta = Number(update.priorityDelta != null ? update.priorityDelta : update.priority_delta);
    if (isFinite(pDelta) && pDelta) {
      var base = Number(issue.priority != null ? issue.priority : issue.importance);
      if (!isFinite(base)) base = 50;
      issue.priority = Math.round(clamp(base + clamp(pDelta, -20, 20), 0, 100) * 100) / 100;
      changed = true;
    }
    issue._partyClassLlmHistory = toArray(issue._partyClassLlmHistory);
    issue._partyClassLlmHistory.push({ turn: turn, source: sourceName, update: clone(update) });
    if (issue._partyClassLlmHistory.length > 20) issue._partyClassLlmHistory = issue._partyClassLlmHistory.slice(-20);
    enqueueTinyiTopic(root, issue, update, turn, sourceName);
    return changed || true;
  }

  function enqueueTinyiTopic(root, issue, info, turn, sourceName) {
    root = pickRoot(root);
    issue = issue || {};
    info = info || {};
    var status = String(info.status || issue.status || '').toLowerCase();
    if (/resolved|closed|done|held|blocked-final|final/.test(status)) return null;
    var topic = issueTextOf(info) || issueTextOf(issue);
    if (!topic) return null;
    var partyName = textOf(info.party || info.partyName || info.sourceParty || issue.sourceParty || '');
    var className = textOf(info.className || info.sourceClass || info.class || issue.sourceClass || issue.className || '');
    var issueId = textOf(info.issueId || info.id || issue.id || issue.issueId || issue.chaoyiTrackId || '');
    if (!Array.isArray(root._pendingTinyiTopics)) root._pendingTinyiTopics = [];
    var existing = root._pendingTinyiTopics.find(function(row) {
      if (!row) return false;
      if (issueId && (row.issueId === issueId || row.id === issueId || row.topicId === issueId)) return true;
      return normalizeName(row.topic) === normalizeName(topic)
        && normalizeName(row.party || row.sourceParty) === normalizeName(partyName)
        && normalizeName(row.sourceClass || row.className) === normalizeName(className);
    });
    if (existing) {
      existing.status = existing.status || 'pending';
      existing.sourceType = existing.sourceType || 'party_class_calibration';
      existing.party = existing.party || partyName;
      existing.sourceParty = existing.sourceParty || partyName;
      existing.sourceClass = existing.sourceClass || className;
      existing.className = existing.className || className;
      existing.goalText = existing.goalText || textOf(info.goalText || info.goal || info.shortGoal || '');
      existing.demandText = existing.demandText || textOf(info.demandText || issue.demandText || '');
      existing.reason = existing.reason || textOf(info.reason || issue.lastReason || '');
      return existing;
    }
    var item = {
      id: issueId || ('pcci-tinyi-' + turn + '-' + (root._pendingTinyiTopics.length + 1)),
      issueId: issueId || '',
      topic: topic,
      sourceType: 'party_class_calibration',
      source: sourceName,
      party: partyName,
      sourceParty: partyName,
      sourceClass: className,
      className: className,
      demandText: textOf(info.demandText || issue.demandText || ''),
      goalText: textOf(info.goalText || info.goal || info.shortGoal || ''),
      goalKind: info.kind || info.type || 'courtIssue',
      linkedParties: toArray(info.linkedParties || issue.linkedParties || partyName).map(textOf).filter(Boolean),
      linkedClasses: toArray(info.linkedClasses || issue.linkedClasses || className).map(textOf).filter(Boolean),
      priority: info.priority || issue.priority || 78,
      status: 'pending',
      turn: turn,
      reason: textOf(info.reason || issue.lastReason || ''),
      origin: clone(info)
    };
    root._pendingTinyiTopics.push(item);
    if (root._pendingTinyiTopics.length > 80) root._pendingTinyiTopics = root._pendingTinyiTopics.slice(-80);
    return item;
  }

  function applyIssueGoalLink(root, link, turn, sourceName) {
    link = link || {};
    var source = pickRoot(root);
    var issue = ensureShadowCourtIssue(source, link, turn);
    var party = findParty(source, link.party || link.partyName || link.name);
    var className = textOf(link.className || link.sourceClass || link.class || '');
    var goalText = textOf(link.goalText || link.goal || link.shortGoal || issueTextOf(issue));
    var applied = { issue: false, goal: false, relation: false };
    var update = {
      issueId: issue && (issue.id || issue.issueId),
      topic: issueTextOf(issue),
      status: link.status || 'linked',
      sourceParty: link.party || link.partyName || '',
      sourceClass: className,
      linkedParties: link.party || link.partyName ? [link.party || link.partyName] : [],
      linkedClasses: className ? [className] : [],
      reason: link.reason || goalText
    };
    applied.issue = applyCourtIssueUpdate(source, update, turn, sourceName);
    if (party && goalText && TM.PartyGoals && typeof TM.PartyGoals.setGoal === 'function') {
      try {
        var goal = TM.PartyGoals.setGoal(source, party, {
          kind: link.kind || 'courtIssue',
          type: link.type || 'courtIssue',
          text: goalText,
          priority: link.priority || 78,
          linkedClasses: className ? [className] : [],
          linkedTinyi: issue ? [issue.id || issue.issueId || issue.topic || goalText] : [],
          sourceClass: className,
          demandText: link.demandText || '',
          generatedFrom: 'party-class-llm-court-issue'
        }, {
          turn: turn,
          source: sourceName,
          priority: link.priority || 78,
          expiresTurn: turn + 5,
          linkedClasses: className ? [className] : [],
          linkedTinyi: issue ? [issue.id || issue.issueId || issue.topic || goalText] : [],
          sourceClass: className,
          generatedFrom: 'party-class-llm-court-issue'
        });
        applied.goal = !!goal;
      } catch (_) {}
    }
    var affinityDelta = Number(link.affinityDelta != null ? link.affinityDelta : link.affinity_delta);
    if (party && className && isFinite(affinityDelta) && affinityDelta && TM.PartyGoals && typeof TM.PartyGoals.applyDynamicRelationAdjustment === 'function') {
      var edge = TM.PartyGoals.applyDynamicRelationAdjustment(source, {
        party: partyNameOf(party),
        className: className,
        affinityDelta: clamp(affinityDelta, -20, 20),
        trustDelta: link.trustDelta,
        grievanceDelta: link.grievanceDelta,
        emergent: link.emergent !== false,
        reason: link.reason || goalText
      }, {
        turn: turn,
        source: sourceName + '-issue-link',
        emergent: link.emergent !== false
      });
      applied.relation = !!edge;
    }
    source._partyClassCourtIssueLinks = toArray(source._partyClassCourtIssueLinks);
    source._partyClassCourtIssueLinks.push({
      turn: turn,
      source: sourceName,
      issueId: issue && (issue.id || issue.issueId || ''),
      topic: issueTextOf(issue),
      party: party ? partyNameOf(party) : textOf(link.party || link.partyName || ''),
      className: className,
      goalText: goalText,
      applied: clone(applied),
      reason: link.reason || ''
    });
    if (source._partyClassCourtIssueLinks.length > 80) source._partyClassCourtIssueLinks = source._partyClassCourtIssueLinks.slice(-80);
    enqueueTinyiTopic(source, issue, {
      issueId: issue && (issue.id || issue.issueId || ''),
      topic: issueTextOf(issue),
      status: link.status || 'linked',
      party: party ? partyNameOf(party) : textOf(link.party || link.partyName || ''),
      sourceParty: party ? partyNameOf(party) : textOf(link.party || link.partyName || ''),
      className: className,
      sourceClass: className,
      goalText: goalText,
      demandText: link.demandText || '',
      kind: link.kind || 'courtIssue',
      priority: link.priority || 78,
      linkedParties: party ? [partyNameOf(party)] : [],
      linkedClasses: className ? [className] : [],
      reason: link.reason || goalText
    }, turn, sourceName);
    return applied;
  }

  function applyResult(root, result, options) {
    var source = pickRoot(root);
    options = options || {};
    result = normalizeResponse(result);
    var turn = Number(options.turn != null ? options.turn : source.turn) || 0;
    var sourceName = options.source || 'party-class-llm-calibration';
    _invalidateCourtIssueRefs();  // 批开始：外部（廷议/信号）可能已改议题集合·不能吃陈缓存
    var applied = { relations: 0, classes: 0, parties: 0, factions: 0, courtIssues: 0, issueGoalLinks: 0, classCharacterRelations: 0, goals: 0 };
    result.relation_adjustments.forEach(function(adj) {
      if (!TM.PartyGoals || typeof TM.PartyGoals.applyDynamicRelationAdjustment !== 'function') return;
      var edge = TM.PartyGoals.applyDynamicRelationAdjustment(source, adj, {
        turn: turn,
        source: sourceName,
        emergent: adj && (adj.emergent === true || adj.dynamic === true || adj.evidenceOnly === true)
      });
      if (edge) applied.relations++;
    });
    result.class_updates.forEach(function(update) {
      if (applyClassUpdate(source, update, turn, sourceName)) applied.classes++;
    });
    result.party_updates.forEach(function(update) {
      if (applyPartyUpdate(source, update, turn, sourceName)) applied.parties++;
    });
    result.faction_updates.forEach(function(update) {
      if (applyFactionUpdate(source, update, turn, sourceName)) applied.factions++;
    });
    result.court_issue_updates.forEach(function(update) {
      if (applyCourtIssueUpdate(source, update, turn, sourceName)) applied.courtIssues++;
    });
    result.issue_goal_links.forEach(function(link) {
      var linked = applyIssueGoalLink(source, link, turn, sourceName);
      if (linked && (linked.issue || linked.goal || linked.relation)) applied.issueGoalLinks++;
      if (linked && linked.relation) applied.relations++;
    });
    // 2026-06-07·skipMirrors 批量写边·循环结束后只重建一次镜像。
    // 原本每条 update 都触发全量 rebuildMirrors → AI 一次吐 N 条关系更新就是 O(N×(类+人)×边) 的过回合卡死(与 discoverPairs 同病灶)。
    var _ccrTouched = false;
    result.class_character_relation_updates.forEach(function(update) {
      if (!TM.ClassCharacterRelations || typeof TM.ClassCharacterRelations.adjustRelation !== 'function') return;
      var edge = TM.ClassCharacterRelations.adjustRelation(source, Object.assign({}, update, {
        source: update && (update.source || update.reason) ? (update.source || sourceName) : sourceName,
        evidence: update && (update.evidence || update.reason || update.summary)
      }), {
        turn: turn,
        source: sourceName,
        skipMirrors: true
      });
      if (edge) { applied.classCharacterRelations++; _ccrTouched = true; }
    });
    if (_ccrTouched && TM.ClassCharacterRelations && typeof TM.ClassCharacterRelations.syncMirrors === 'function') {
      try { TM.ClassCharacterRelations.syncMirrors(source); } catch (_ccrSyncE) {}
    }
    _invalidateCourtIssueRefs();  // 批结束：缓存不跨批存活（回合间外部系统会改议题集合）
    // 关系索引重建收敛：旧版此处显式 buildScenarioRelationIndex 一次·紧接着 deriveFromClassDemands
    // 内部又无条件重建一次（tm-party-goals.js deriveFromClassDemands 首行）——纯白跑·删显式那次
    try {
      if (TM.PartyGoals && typeof TM.PartyGoals.deriveFromClassDemands === 'function') {
        var derived = TM.PartyGoals.deriveFromClassDemands(source, { turn: turn, source: sourceName + '-derive' });
        applied.goals += toArray(derived && derived.sourceGoals).length + toArray(derived && derived.counterGoals).length;
      }
    } catch (_) {}
    try {
      if (TM.ClassMinxinBridge && typeof TM.ClassMinxinBridge.maintain === 'function') {
        source._partyClassLlmClassMinxin = TM.ClassMinxinBridge.maintain(source, {
          turn: turn,
          source: sourceName + '-class-minxin'
        });
      }
    } catch (_classMinxinMaintainE) {}
    source._partyClassLlmUiDirty = true;
    source._partyClassLlmLastResult = {
      turn: turn,
      source: sourceName,
      applied: clone(applied),
      notes: result.notes,
      at: Date.now()
    };
    refreshDerivedAndUi(source);
    return applied;
  }

  function refreshDerivedAndUi(root) {
    try { if (TM.FactionIndex && typeof TM.FactionIndex.rebuild === 'function') TM.FactionIndex.rebuild(); } catch (_) {}
    try { if (TM.FactionDerived && typeof TM.FactionDerived.compute === 'function') TM.FactionDerived.compute(); } catch (_) {}
    try { if (TM.FactionDerivedEconomy && typeof TM.FactionDerivedEconomy.compute === 'function') TM.FactionDerivedEconomy.compute(); } catch (_) {}
    try { if (TM.FactionDerivedCohesion && typeof TM.FactionDerivedCohesion.compute === 'function') TM.FactionDerivedCohesion.compute(); } catch (_) {}
    try { if (TM.FactionDerivedStrength && typeof TM.FactionDerivedStrength.compute === 'function') TM.FactionDerivedStrength.compute(); } catch (_) {}
    try {
      if (TM.TMPhase8FormalBridge && TM.TMPhase8FormalBridge.modules && typeof TM.TMPhase8FormalBridge.modules.rerenderModule === 'function') {
        TM.TMPhase8FormalBridge.modules.rerenderModule();
      } else if (global.TMPhase8FormalBridge && TMPhase8FormalBridge.modules && typeof TMPhase8FormalBridge.modules.rerenderModule === 'function') {
        TMPhase8FormalBridge.modules.rerenderModule();
      }
    } catch (_) {}
    try { if (typeof global.renderGameState === 'function') global.renderGameState(); } catch (_) {}
    if (root) root._partyClassLlmUiDirty = true;
  }

  function ensureLedger(root, turn) {
    if (!root) return null;
    if (!root._partyClassLlmLedger || root._partyClassLlmLedger.turn !== turn) {
      root._partyClassLlmLedger = {
        turn: turn,
        createdAt: Date.now(),
        runs: [],
        stats: { attempted: 0, applied: 0, noAction: 0, skipped: 0, failed: 0 }
      };
    }
    if (!Array.isArray(root._partyClassLlmLedger.runs)) root._partyClassLlmLedger.runs = [];
    if (!root._partyClassLlmLedger.stats) root._partyClassLlmLedger.stats = { attempted: 0, applied: 0, noAction: 0, skipped: 0, failed: 0 };
    return root._partyClassLlmLedger;
  }

  function alreadyRan(ledger, phase) {
    if (!ledger || !phase) return false;
    return ledger.runs.some(function(row) {
      return row && row.phase === phase && (row.status === 'running' || row.status === 'applied' || row.status === 'completed_no_action');
    });
  }

  function hasFreshActionCalibration(root, turn) {
    if (!root) return false;
    turn = Number(turn != null ? turn : root.turn) || 0;
    var seq = Number(root._partyClassLlmActionSeq) || 0;
    var doneSeq = Number(root._partyClassLlmLastCalibratedSeq) || 0;
    var result = root._partyClassLlmLastActionResult || root._partyClassLlmLastResult || null;
    if (!seq || doneSeq < seq) return false;
    if (result && result.turn && Number(result.turn) !== turn) return false;
    return true;
  }

  function recordPlayerActionSignal(root, seq, options) {
    if (!root) return;
    options = options || {};
    if (options.skipSignalRecord) return;
    if (TM.PlayerActionSignals && typeof TM.PlayerActionSignals.record === 'function') {
      try {
        TM.PlayerActionSignals.record(root, {
          turn: Number(options.turn != null ? options.turn : root.turn) || 0,
          calibrationSeq: seq,
          source: options.source || 'player-action-ui',
          kind: options.kind || options.actionKind || '',
          action: options.action || options.actionKind || '',
          topic: options.topic || options.title || '',
          text: options.text || options.content || options.targetText || '',
          actor: options.actor || options.from || '',
          target: options.target || options.targetId || '',
          targetId: options.targetId || '',
          intensity: options.intensity,
          policyTags: options.policyTags,
          evidence: options.evidence
        });
        return;
      } catch (_) {}
    }
    root._partyClassLlmActionSignals = toArray(root._partyClassLlmActionSignals);
    root._partyClassLlmActionSignals.push({
      turn: Number(options.turn != null ? options.turn : root.turn) || 0,
      seq: seq,
      source: options.source || 'player-action-ui',
      action: options.action || options.actionKind || '',
      targetId: options.targetId || '',
      targetText: textOf(options.targetText || ''),
      at: Date.now()
    });
    if (root._partyClassLlmActionSignals.length > 30) root._partyClassLlmActionSignals = root._partyClassLlmActionSignals.slice(-30);
  }

  async function run(options) {
    options = options || {};
    var source = pickRoot(options.root);
    var turn = Number(options.turn != null ? options.turn : source.turn) || 0;
    var phase = options.phase || options.source || 'player-action';
    var ledger = ensureLedger(source, turn);
    if (global.P && P.conf && P.conf.partyClassLlmEnabled === false) {
      if (ledger) ledger.stats.skipped++;
      return { skipped: true, reason: 'partyClassLlm disabled', turn: turn };
    }
    if (!getClasses(source).length || !getParties(source).length) {
      if (ledger) ledger.stats.skipped++;
      return { skipped: true, reason: 'missing classes or parties', turn: turn };
    }
    if (!hasAnyAiConfig()) {
      if (ledger) ledger.stats.skipped++;
      return { skipped: true, reason: 'AI not configured', turn: turn };
    }
    if (typeof global.callAIMessages !== 'function' && typeof global.callAI !== 'function') {
      if (ledger) ledger.stats.skipped++;
      return { skipped: true, reason: 'AI caller missing', turn: turn };
    }
    if (!options.force && alreadyRan(ledger, phase)) {
      if (ledger) ledger.stats.skipped++;
      return { skipped: true, reason: 'phase already calibrated', turn: turn, phase: phase };
    }
    var row = {
      id: 'party-class-llm-' + turn + '-' + (ledger.runs.length + 1),
      turn: turn,
      phase: phase,
      source: options.source || 'party-class-llm',
      status: 'running',
      tier: chooseTier(),
      startedAt: Date.now(),
      finishedAt: 0,
      applied: null,
      error: ''
    };
    ledger.runs.push(row);
    ledger.stats.attempted++;
    try {
      if (TM.PartyGoals && typeof TM.PartyGoals.buildScenarioRelationIndex === 'function') {
        TM.PartyGoals.buildScenarioRelationIndex(source, { turn: turn, source: options.source || 'party-class-llm-snapshot' });
      }
      var snapshot = buildSnapshot(source, {
        turn: turn,
        source: options.source || '',
        phase: phase
      });
      var messages = buildMessages(snapshot);
      var call = await callCalibrationLlm(messages, {
        tier: row.tier,
        maxTokens: options.maxTokens,
        timeoutMs: options.timeoutMs,
        priority: options.priority,
        maxRetries: options.maxRetries
      });
      row.tier = call.tier || row.tier;
      row.maxTokens = call.maxTokens || 0;
      var parsed = extractJson(call.text);
      if (!parsed) throw new Error('LLM returned no JSON object');
      var applied = applyResult(source, parsed, {
        turn: turn,
        source: options.source || 'party-class-llm'
      });
      var appliedCount = applied.relations + applied.classes + applied.parties + applied.factions + applied.courtIssues + applied.issueGoalLinks + applied.classCharacterRelations + applied.goals;
      row.status = appliedCount ? 'applied' : 'completed_no_action';
      row.finishedAt = Date.now();
      row.applied = clone(applied);
      if (appliedCount) ledger.stats.applied++;
      else ledger.stats.noAction++;
      return {
        ok: true,
        turn: turn,
        phase: phase,
        tier: row.tier,
        attempted: 1,
        applied: applied,
        appliedCount: appliedCount,
        notes: toArray(parsed.notes).map(textOf).filter(Boolean)
      };
    } catch (e) {
      row.status = 'failed';
      row.finishedAt = Date.now();
      row.error = String(e && e.message || e || '');
      ledger.stats.failed++;
      try { console.warn('[party-class-llm-calibrator] failed', e); } catch (_) {}
      return { failed: true, turn: turn, phase: phase, error: row.error, attempted: 1, appliedCount: 0 };
    }
  }

  function notifyPlayerAction(options) {
    options = options || {};
    var source = pickRoot(options.root);
    var turn = Number(options.turn != null ? options.turn : source.turn) || 0;
    if (source && (source.busy || source._endTurnBusy)) return { skipped: true, reason: 'endturn busy', turn: turn };
    if (global.P && P.conf && P.conf.partyClassLlmEnabled === false) return { skipped: true, reason: 'partyClassLlm disabled', turn: turn };
    if (!source._partyClassLlmActionSeq) source._partyClassLlmActionSeq = 0;
    source._partyClassLlmActionSeq += 1;
    var seq = source._partyClassLlmActionSeq;
    recordPlayerActionSignal(source, seq, options);
    if (!getClasses(source).length || !getParties(source).length) return { skipped: true, reason: 'missing classes or parties', turn: turn, seq: seq };
    if (!hasAnyAiConfig()) return { skipped: true, reason: 'AI not configured', turn: turn, seq: seq };
    if (typeof global.callAIMessages !== 'function' && typeof global.callAI !== 'function') return { skipped: true, reason: 'AI caller missing', turn: turn, seq: seq };
    var now = Date.now();
    var cooldownMs = Number(options.cooldownMs != null ? options.cooldownMs : (global.P && P.conf && P.conf.partyClassLlmActionCooldownMs));
    if (!isFinite(cooldownMs)) cooldownMs = 15000;
    var lastStarted = Number(source._partyClassLlmLastActionStartedAt) || 0;
    if (!options.force && cooldownMs > 0 && lastStarted && now - lastStarted < cooldownMs) {
      source._partyClassLlmPendingActionSeq = seq;
      return { scheduled: false, skipped: true, reason: 'cooldown', turn: turn, seq: seq };
    }
    if (_actionTimer && typeof global.clearTimeout === 'function') {
      try { global.clearTimeout(_actionTimer); } catch (_) {}
      _actionTimer = null;
    }
    var delayMs = Number(options.delayMs != null ? options.delayMs : (global.P && P.conf && P.conf.partyClassLlmActionDebounceMs));
    if (!isFinite(delayMs)) delayMs = 1200;
    function launch() {
      _actionPendingLaunch = null;
      if (_actionBusy) {
        source._partyClassLlmPendingActionSeq = seq;
        return { skipped: true, reason: 'already running', turn: turn, seq: seq };
      }
      _actionBusy = true;
      source._partyClassLlmLastActionStartedAt = Date.now();
      var promise = run({
        root: source,
        turn: turn,
        source: options.source || 'player-action-ui',
        phase: options.phase || ('player-action-' + seq),
        priority: options.priority || 'background',
        timeoutMs: options.timeoutMs,
        maxTokens: options.maxTokens,
        maxRetries: options.maxRetries,
        force: options.force === true
      });
      _actionPendingRoot = source;
      _actionPendingPromise = Promise.resolve(promise).then(function(result) {
        source._partyClassLlmLastActionFinishedAt = Date.now();
        source._partyClassLlmLastActionResult = clone(result);
        if (result && (result.ok || result.skipped || result.failed)) {
          source._partyClassLlmLastCalibratedSeq = Math.max(Number(source._partyClassLlmLastCalibratedSeq) || 0, seq);
          if ((Number(source._partyClassLlmActionSeq) || 0) <= seq) source._partyClassLlmPendingActionSeq = 0;
        }
        return result;
      }, function(e) {
        source._partyClassLlmLastActionFinishedAt = Date.now();
        source._partyClassLlmLastActionError = String(e && e.message || e || '');
        throw e;
      }).then(function() {
        _actionBusy = false;
        _actionPendingPromise = null;
        _actionPendingRoot = null;
      }, function(e) {
        _actionBusy = false;
        _actionPendingPromise = null;
        _actionPendingRoot = null;
        throw e;
      });
      return promise;
    }
    if (delayMs <= 0 || options.immediate) return launch();
    if (typeof global.setTimeout !== 'function') return launch();
    _actionPendingRoot = source;
    _actionPendingLaunch = launch;
    _actionTimer = global.setTimeout(function() {
      _actionTimer = null;
      launch();
    }, delayMs);
    return { scheduled: true, turn: turn, seq: seq, delayMs: delayMs };
  }

  async function flushBeforeSubmit(options) {
    options = options || {};
    var source = pickRoot(options.root);
    var turn = Number(options.turn != null ? options.turn : source.turn) || 0;
    if (!options.force && hasFreshActionCalibration(source, turn)) {
      return { skipped: true, reason: 'already fresh', turn: turn, source: options.source || 'pre-submit-player-action' };
    }
    if (_actionTimer && _actionPendingLaunch && (!_actionPendingRoot || _actionPendingRoot === source)) {
      try { if (typeof global.clearTimeout === 'function') global.clearTimeout(_actionTimer); } catch (_) {}
      _actionTimer = null;
      var launched = _actionPendingLaunch();
      if (launched && typeof launched.then === 'function') await launched;
      if (!options.force && hasFreshActionCalibration(source, turn)) {
        return { skipped: true, reason: 'already fresh', turn: turn, source: options.source || 'pre-submit-player-action' };
      }
    }
    if (_actionPendingPromise && (!_actionPendingRoot || _actionPendingRoot === source)) {
      try { await _actionPendingPromise; } catch (_) {}
      if (!options.force && hasFreshActionCalibration(source, turn)) {
        return { skipped: true, reason: 'already fresh', turn: turn, source: options.source || 'pre-submit-player-action' };
      }
    }
    return await run({
      root: source,
      turn: turn,
      source: options.source || 'pre-submit-player-action',
      phase: options.phase || 'pre-submit',
      priority: options.priority || 'background',
      timeoutMs: options.timeoutMs,
      maxTokens: options.maxTokens,
      maxRetries: options.maxRetries,
      force: options.force === true
    });
  }

  function _isEndTurnTarget(node) {
    if (!node) return false;
    var id = String(node.id || '');
    if (/^(btn-end|btn-end-turn|gs-turn-big|gs-turn-float)$/i.test(id)) return true;
    var text = String(node.textContent || node.value || '');
    return /推演|过回合|提交回合|静候有司|开朔朝/.test(text) && /btn-end|turn|post-turn/i.test(id + ' ' + String(node.className || ''));
  }

  function _actionTargetFromEvent(ev) {
    var target = ev && ev.target;
    if (!target) return null;
    if (target.closest) {
      var endTurn = target.closest('#btn-end,#btn-end-turn,#gs-turn-big,#gs-turn-float,#post-turn-court-prompt');
      if (endTurn) return null;
      return target.closest('button,[role="button"],[data-module-action],[data-right-action],[onclick],select,input[type="checkbox"],input[type="radio"]');
    }
    return null;
  }

  function installPlayerActionObserver() {
    if (_observerInstalled) return false;
    if (!(global.P && global.P.conf && global.P.conf.partyClassLlmObserveUiClicks === true)) return false;
    var doc = global.document;
    if (!doc || typeof doc.addEventListener !== 'function') return false;
    _observerInstalled = true;
    function handler(ev) {
      try {
        var root = pickRoot();
        if (!root || !root.running || root.busy || root._endTurnBusy) return;
        var target = _actionTargetFromEvent(ev);
        if (!target || _isEndTurnTarget(target)) return;
        notifyPlayerAction({
          source: 'player-action-ui',
          action: ev && ev.type || '',
          targetId: target.id || '',
          targetText: target.textContent || target.value || ''
        });
      } catch (_) {}
    }
    doc.addEventListener('click', handler, true);
    doc.addEventListener('change', handler, true);
    return true;
  }

  function escapeHtml(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function(ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] || ch;
    });
  }

  function getDiagnostics(root) {
    var source = pickRoot(root);
    var structured = null;
    try {
      structured = (TM.PlayerActionSignals && typeof TM.PlayerActionSignals.snapshot === 'function')
        ? TM.PlayerActionSignals.snapshot(source, { limit: 12 })
        : null;
    } catch (_) { structured = null; }
    var legacySignals = toArray(source._partyClassLlmActionSignals);
    var ledger = source._partyClassLlmLedger || null;
    return {
      turn: Number(source.turn) || 0,
      enabled: !(global.P && P.conf && P.conf.partyClassLlmEnabled === false),
      tier: chooseTier(),
      hasAiConfig: hasAnyAiConfig(),
      actionSeq: Number(source._partyClassLlmActionSeq) || 0,
      lastCalibratedSeq: Number(source._partyClassLlmLastCalibratedSeq) || 0,
      pendingActionSeq: Number(source._partyClassLlmPendingActionSeq) || 0,
      ledger: clone(ledger),
      lastResult: clone(source._partyClassLlmLastResult || source._partyClassLlmLastActionResult || null),
      playerSignals: {
        count: structured ? structured.count : legacySignals.length,
        structured: !!structured,
        policyTags: structured ? structured.policyTags : [],
        candidateClasses: structured ? structured.candidateClasses : [],
        candidateParties: structured ? structured.candidateParties : [],
        recent: structured ? structured.signals : legacySignals.slice(-12)
      },
      courtIssueLinks: toArray(source._partyClassCourtIssueLinks).slice(-8),
      calibratedCourtIssues: toArray(source._partyClassCourtIssues).slice(-8),
      calibratedFactions: getFactions(source).filter(function(f) { return f && f._partyClassLlmHistory && f._partyClassLlmHistory.length; }).map(snapshotFaction).slice(-8),
      uiDirty: !!source._partyClassLlmUiDirty
    };
  }

  function renderDiagnostics(root) {
    var diag = getDiagnostics(root);
    var lines = [];
    lines.push('turn=' + diag.turn + ' tier=' + diag.tier + ' enabled=' + diag.enabled + ' ai=' + diag.hasAiConfig);
    lines.push('seq=' + diag.actionSeq + ' calibrated=' + diag.lastCalibratedSeq + ' pending=' + diag.pendingActionSeq);
    lines.push('signals=' + diag.playerSignals.count + ' tags=' + diag.playerSignals.policyTags.join(','));
    if (diag.lastResult) lines.push('last=' + (diag.lastResult.source || '') + ' applied=' + JSON.stringify(diag.lastResult.applied || {}));
    diag.playerSignals.recent.slice(-8).forEach(function(s) {
      lines.push('- T' + (s.turn || '?') + '#' + (s.seq || '?') + ' ' + compactPlayerText(s.text || s.targetText || s.action || '', 120));
    });
    toArray(diag.courtIssueLinks).slice(-5).forEach(function(x) {
      lines.push('* issue ' + compactPlayerText((x.topic || x.issueId || '') + ' -> ' + (x.party || '') + ' / ' + (x.className || '') + ' ' + (x.goalText || ''), 140));
    });
    return '<pre class="tm-party-class-llm-diagnostics">' + escapeHtml(lines.join('\n')) + '</pre>';
  }

  function openDiagnostics(root) {
    if (!global.document) return false;
    var old = global.document.getElementById && global.document.getElementById('tm-party-class-llm-diagnostics');
    if (old && old.parentNode) old.parentNode.removeChild(old);
    var div = global.document.createElement('div');
    div.id = 'tm-party-class-llm-diagnostics';
    div.className = 'modal-bg show';
    div.innerHTML = '<div class="modal-box" style="max-width:760px;max-height:82vh;overflow:auto;">'
      + '<h3 style="margin-top:0;">Party/Class LLM Diagnostics</h3>'
      + renderDiagnostics(root)
      + '<div style="text-align:right;margin-top:10px;"><button class="bt bs" data-close="1">Close</button></div>'
      + '</div>';
    div.addEventListener('click', function(ev) {
      if (ev.target === div || (ev.target && ev.target.dataset && ev.target.dataset.close)) div.remove();
    });
    global.document.body.appendChild(div);
    return true;
  }

  TM.PartyClassLlmCalibrator = {
    run: run,
    notifyPlayerAction: notifyPlayerAction,
    flushBeforeSubmit: flushBeforeSubmit,
    installPlayerActionObserver: installPlayerActionObserver,
    buildSnapshot: buildSnapshot,
    buildMessages: buildMessages,
    applyResult: applyResult,
    getDiagnostics: getDiagnostics,
    renderDiagnostics: renderDiagnostics,
    openDiagnostics: openDiagnostics,
    chooseTier: chooseTier,
    _extractJson: extractJson
  };

  try {
    if (global.document) {
      if (global.document.readyState === 'loading' && typeof global.document.addEventListener === 'function') {
        global.document.addEventListener('DOMContentLoaded', installPlayerActionObserver, { once: true });
      } else {
        installPlayerActionObserver();
      }
    }
  } catch (_) {}

  if (typeof module !== 'undefined' && module.exports) module.exports = TM.PartyClassLlmCalibrator;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : globalThis));
