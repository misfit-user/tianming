(function(global) {
  'use strict';

  var root = global || (typeof window !== 'undefined' ? window : {});
  root.TM = root.TM || {};

  var ns = root.TM.MemoryEnvelope = root.TM.MemoryEnvelope || {};
  var SCHEMA_VERSION = 'memory-envelope/v0';
  var PROJECTION_VERSION = 1;

  function toText(value) {
    if (value == null) return '';
    if (typeof value === 'string') return value;
    try { return JSON.stringify(value); } catch (_) { return String(value); }
  }

  function clean(value, maxLen) {
    var s = toText(value).replace(/\s+/g, ' ').trim();
    if (!s) return '';
    return s.slice(0, maxLen || 400);
  }

  function safeBodyText(value, maxLen) {
    var s = clean(value, maxLen || 1000);
    if (!s) return '';
    s = s.replace(/<[^>]*>/g, ' ');
    s = s.replace(/[<>]/g, ' ');
    s = s.replace(/ignore\s+(all\s+)?(previous|system|above)\s+instructions/ig, '[redacted-instruction]');
    s = s.replace(/disregard\s+(previous|system|above)/ig, '[redacted-instruction]');
    s = s.replace(/from\s+now\s+on/ig, '[redacted-transition]');
    return clean(s, maxLen || 1000);
  }

  function hashText(value) {
    var s = toText(value);
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    }
    return ('00000000' + (h >>> 0).toString(16)).slice(-8);
  }

  function authorityRank(authority) {
    var ER = root.TM && root.TM.MemoryEvidenceRegistry;
    if (ER && typeof ER.getAuthorityRank === 'function') return ER.getAuthorityRank(authority);
    var fallback = {
      engine_state: 100,
      player_pin: 90,
      rule_validated: 80,
      internal_sim_state: 78,
      official_record: 72,
      court_report: 66,
      structured_chronicle: 60,
      event_log: 58,
      raw_narrative: 50,
      ai_extracted: 45,
      ai_analysis: 40,
      ai_summary: 30
    };
    return fallback[clean(authority, 60)] || 0;
  }

  function clampConfidence(value, fallback) {
    var n = Number(value);
    if (!isFinite(n)) return fallback == null ? null : fallback;
    return Math.max(0, Math.min(1, n));
  }

  function numberOrNull(value) {
    if (value == null || value === "" || typeof value === "boolean") return null;
    var n = Number(value);
    return isFinite(n) ? n : null;
  }

  function compactRefs(list) {
    return (Array.isArray(list) ? list : []).slice(0, 12).map(function(ref) {
      ref = ref || {};
      var authority = clean(ref.authority, 60);
      var out = {
        type: clean(ref.type, 60) || 'unknown',
        id: clean(ref.id, 120) || 'unknown'
      };
      if (ref.turn != null) out.turn = Number(ref.turn || 0);
      if (authority) {
        out.authority = authority;
        out.authorityRank = ref.authorityRank != null ? Number(ref.authorityRank) : authorityRank(authority);
      }
      if (ref.visibility) out.visibility = clean(ref.visibility, 80);
      if (ref.lane) out.lane = clean(ref.lane, 80);
      if (ref.role) out.role = clean(ref.role, 80);
      return out;
    });
  }

  function sourceRef(type, id, body, extra) {
    var ref = {
      type: clean(type, 40) || 'unknown',
      id: clean(id, 80) || 'unknown',
      hash: hashText(body)
    };
    if (extra && extra.span) ref.span = clean(extra.span, 80);
    if (extra && extra.turn != null) ref.turn = Number(extra.turn || 0);
    return ref;
  }

  function normalizeStatus(status, fallback) {
    var s = clean(status, 40).toLowerCase();
    if (!s) return fallback || 'active';
    if (s === 'active' || s === 'pending' || s === 'executing' || s === 'partial' || s === 'obstructed' || s === 'pending_delivery' || s === 'delayed') return 'active';
    if (s === 'draft' || s === 'pending_review' || s === 'rejected') return s;
    if (s === 'accepted') return 'active';
    if (s === 'stale' || s === 'superseded') return s;
    if (s === 'deleted' || s === 'deleted_tombstone' || s === 'redacted') return 'deleted_tombstone';
    if (s === 'quarantined' || s === 'quarantine') return 'quarantined';
    return 'archived';
  }

  function dedupeList(list) {
    var seen = {};
    var out = [];
    (Array.isArray(list) ? list : []).forEach(function(item) {
      var s = clean(item, 80);
      var key = s.toLowerCase();
      if (!s || seen[key]) return;
      seen[key] = true;
      out.push(s);
    });
    return out;
  }

  function makeEnvelope(input) {
    input = input || {};
    var body = clean(input.body || input.text || input.content, input.maxBody || 1000);
    var sourceRefs = Array.isArray(input.sourceRefs) ? input.sourceRefs : [];
    var env = {
      id: clean(input.id, 120) || ('mem-' + hashText(body + ':' + clean(input.type, 40))),
      schemaVersion: clean(input.schemaVersion, 40) || SCHEMA_VERSION,
      projectionVersion: Number(input.projectionVersion || PROJECTION_VERSION),
      saveId: clean(input.saveId || input.runId || input.campaignId, 128),
      worldId: clean(input.worldId || input.scenarioId || input.scenarioKey, 128),
      ownerScope: clean(input.ownerScope || input.scope || input.owner, 120),
      readScope: clean(Array.isArray(input.readScope) ? input.readScope.join(' ') : (input.readScope || input.visibilityScope || input.audienceScope), 120),
      writeScope: clean(input.writeScope || input.reviewScope || input.writePolicy, 120),
      type: clean(input.type || input.kind, 40) || 'episodic_event',
      body: body,
      safeBody: safeBodyText(input.safeBody != null ? input.safeBody : body, input.safeBodyMax || input.maxBody || 1000),
      sourceRefs: sourceRefs,
      status: normalizeStatus(input.status, input.statusFallback || 'active'),
      reviewStatus: clean(input.reviewStatus, 40),
      campaignId: clean(input.campaignId || input._campaignId, 128),
      timelineId: clean(input.timelineId || input._timelineId, 128),
      authority: clean(input.authority, 40) || 'raw_narrative',
      visibility: clean(input.visibility, 80) || 'public',
      turn: Number(input.turn || 0),
      validFromTurn: numberOrNull(input.validFromTurn != null ? input.validFromTurn : input.validFrom),
      validToTurn: numberOrNull(input.validToTurn != null ? input.validToTurn : input.validTo),
      learnedAtTurn: numberOrNull(input.learnedAtTurn != null ? input.learnedAtTurn : input.learnedAt),
      expiredAtTurn: numberOrNull(input.expiredAtTurn != null ? input.expiredAtTurn : input.expiredAt),
      entities: dedupeList(input.entities),
      audience: dedupeList(input.audience || input.audiences),
      ownerKind: clean(input.ownerKind, 60) || '',
      ownerId: clean(input.ownerId, 120) || '',
      lane: clean(input.lane, 60) || 'L6_retrieved_evidence',
      reason: clean(input.reason, 120) || ('projection:' + clean(input.type || input.kind, 40)),
      extra: input.extra || {},
      derivedFrom: Array.isArray(input.derivedFrom) ? input.derivedFrom : [],
      basisRefs: compactRefs(input.basisRefs || input.evidenceRefs),
      invalidationRefs: compactRefs(input.invalidationRefs || input.expirationRefs || input.supersededByRefs),
      invalidationReason: clean(input.invalidationReason || input.expirationReason || input.supersededReason, 160),
      authorityRank: input.authorityRank != null ? Number(input.authorityRank) : authorityRank(input.authority || 'raw_narrative'),
      confidence: input.confidence != null ? clampConfidence(input.confidence, null) : null,
      factStatus: clean(input.factStatus, 60) || '',
      role: clean(input.role, 60) || '',
      contentHash: hashText(body)
    };
    if (!env.sourceRefs.length) env.sourceRefs = [sourceRef(env.type, env.id, body, { turn: env.turn })];
    return env;
  }

  function isAlive(ch) {
    ch = ch || {};
    var status = clean(ch.status || ch.lifeStatus, 40).toLowerCase();
    if (ch.alive === false || ch.dead === true || ch.isDead === true) return false;
    return !(status === 'dead' || status === 'deceased' || status === 'killed' || status === 'executed');
  }

  function characterBody(ch, alive) {
    return [
      ch && ch.name,
      alive ? 'alive' : 'dead',
      ch && (ch.location || ch.currentLocation || ch.place),
      ch && (ch.officialTitle || ch.officeTitle || ch.title || ch.position),
      ch && (ch.faction || ch.party || ch.group),
      alive ? '' : (ch && (ch.deathReason || ch.deadReason || ch.causeOfDeath)),
      alive ? '' : (ch && (ch.deathTurn || ch.deadTurn) ? 'turn ' + (ch.deathTurn || ch.deadTurn) : '')
    ].filter(Boolean).join(' ');
  }

  function openLike(status) {
    var s = clean(status, 40).toLowerCase();
    return !s || s === 'active' || s === 'pending' || s === 'executing' || s === 'partial' || s === 'obstructed' || s === 'pending_delivery' || s === 'delayed';
  }

  function pushCharacterEnvelopes(out, GM, turn) {
    if (!GM || !Array.isArray(GM.chars)) return;
    GM.chars.forEach(function(ch) {
      if (!ch || !ch.name) return;
      var alive = isAlive(ch);
      var body = characterBody(ch, alive);
      out.push(makeEnvelope({
        id: 'hard-char-' + ch.name,
        type: 'hard_state',
        body: body,
        sourceRefs: [sourceRef('char', ch.id || ch.name, body, { turn: ch.lastUpdateTurn || ch.updatedTurn || ch.deathTurn || turn })],
        status: 'active',
        authority: 'engine_state',
        visibility: 'world_truth',
        turn: Number(alive ? (ch.updatedTurn || ch.lastUpdateTurn || ch.turn || turn || 0) : (ch.deathTurn || ch.deadTurn || ch.updatedTurn || ch.lastUpdateTurn || turn || 0)),
        entities: [ch.name],
        lane: 'L1_world_truth',
        reason: 'projection:character_hard_state',
        extra: {
          alive: alive,
          sourceId: ch.id || ''
        }
      }));
    });
  }

  // 皇命表（MemTables.imperialEdict）的行是数组：[优先级, 皇命内容, 生效条件, 颁布回合, 隐藏]。
  // 按对象字段读会得到空正文，玩家钉的皇命就从统一记忆块里消失了；这里统一转成对象再读。
  function imperialEdictRecord(row) {
    if (!row) return null;
    if (!Array.isArray(row)) return row;
    var body = toText(row[1]), condition = toText(row[2]);
    var hidden = row[4] === true || row[4] === 1 || /^(true|1|是)$/i.test(String(row[4] || ''));
    var record = {
      id: row.id || ('imperial-edict-' + hashText(body + '|' + condition + '|' + row[3])),
      content: body,
      condition: condition,
      turn: numberOrNull(row[3]),
      importance: Number(row[0]) || 5,
      status: row.status || 'active'
    };
    // 「隐藏」列为真的是天机条目，只给系统推演看；其余沿用各读取方原有的可见性默认值
    if (hidden) { record.visibility = 'gm_only'; record.readScope = 'system'; }
    return record;
  }

  function pushEdictEnvelopes(out, GM, turn) {
    if (!GM) return;
    if (Array.isArray(GM.activeEdicts)) {
      GM.activeEdicts.forEach(function(e, i) {
        if (!e || !openLike(e.status || 'active')) return;
        var body = [e.name, e.category, e.reason, e.content, e.feedback, e.assignee, e.target].filter(Boolean).join(' ');
        out.push(makeEnvelope({
          id: e.id || ('active-edict-' + i),
          type: 'active_law',
          body: body,
          sourceRefs: [sourceRef('activeEdict', e.id || ('active-edict-' + i), body, { turn: e.startedTurn || e.turn || turn })],
          status: e.status || 'active',
          authority: 'player_pin',
          visibility: e.visibility || 'world_truth',
          turn: Number(e.startedTurn || e.turn || turn || 0),
          entities: [e.assignee, e.target],
          lane: 'L2_active_law_commitment',
          reason: 'projection:active_edict',
          extra: { category: e.category || '' }
        }));
      });
    }

    if (Array.isArray(GM._edictTracker)) {
      var efficacy = root.TM && root.TM.EdictEfficacy;
      GM._edictTracker.forEach(function(e, i) {
        if (!e) return;
        // 办结不等于废止：仍现行的诏令照样投影为现行法令（tm-edict-efficacy.js）
        var inForce = !!(efficacy && efficacy.isCurrent(e, turn));
        if (!inForce && !openLike(e.status || 'pending')) return;
        var body = [e.content, e.category, e.assignee, e.target, e.feedback, e.reason].filter(Boolean).join(' ');
        out.push(makeEnvelope({
          id: e.id || ('tracked-edict-' + i),
          type: 'active_law',
          body: body,
          sourceRefs: [sourceRef('edictTracker', e.id || ('tracked-edict-' + i), body, { turn: e.turn || turn })],
          status: inForce ? 'active' : (e.status || 'pending'),
          authority: 'player_pin',
          visibility: e.visibility || 'world_truth',
          turn: Number(e.turn || turn || 0),
          entities: [e.assignee, e.target],
          lane: 'L2_active_law_commitment',
          reason: 'projection:edict_tracker',
          extra: { category: e.category || '', efficacy: efficacy ? efficacy.stateOf(e) : '' }
        }));
      });
    }

    var rows = GM._memTables && GM._memTables.imperialEdict && Array.isArray(GM._memTables.imperialEdict.rows)
      ? GM._memTables.imperialEdict.rows
      : [];
    rows.forEach(function(row, i) {
      row = imperialEdictRecord(row);
      if (!row || !openLike(row.status || row.lifecycle || 'active')) return;
      var body = [row.title, row.content, row.text, row.condition, row.notes, row.assignee, row.target].filter(Boolean).join(' ');
      if (!body) return;
      out.push(makeEnvelope({
        id: row.id || row.key || ('imperial-edict-' + i),
        type: 'active_law',
        body: body,
        sourceRefs: [sourceRef('imperialEdict', row.id || row.key || ('imperial-edict-' + i), body, { turn: row.turn || row.createdTurn || turn })],
        status: row.status || row.lifecycle || 'active',
        authority: 'player_pin',
        visibility: row.visibility || 'world_truth',
        readScope: row.readScope,
        turn: Number(row.turn || row.createdTurn || turn || 0),
        entities: [row.assignee, row.target],
        lane: 'L2_active_law_commitment',
        reason: 'projection:imperial_edict_table'
      }));
    });
  }

  function pushCommitmentEnvelopes(out, GM, opts, turn) {
    if (GM && GM._npcCommitments && typeof GM._npcCommitments === 'object') {
      Object.keys(GM._npcCommitments).forEach(function(npc) {
        var list = GM._npcCommitments[npc];
        if (!Array.isArray(list)) return;
        list.forEach(function(c, i) {
          if (!c || !openLike(c.status || 'pending')) return;
          var body = [npc, c.task, c.feedback, c.npcPromise, c.deadline].filter(Boolean).join(' ');
          out.push(makeEnvelope({
            id: c.id || ('commitment-' + npc + '-' + i),
            type: 'commitment',
            body: body,
            sourceRefs: Array.isArray(c.sourceRefs) && c.sourceRefs.length ? c.sourceRefs : [sourceRef('npcCommitment', c.id || ('commitment-' + npc + '-' + i), body, { turn: c.assignedTurn || c.lastUpdateTurn || turn })],
            status: c.status || 'pending',
            authority: 'rule_validated',
            visibility: c.visibility || 'world_truth',
            turn: Number(c.assignedTurn || c.lastUpdateTurn || turn || 0),
            entities: [npc],
            lane: 'L2_active_law_commitment',
            reason: 'projection:npc_commitment',
            basisRefs: c.basisRefs || c.evidenceRefs || c.sourceRefs || []
          }));
        });
      });
    }

    var sc1q = opts && opts.sc1q || {};
    if (Array.isArray(sc1q.dialogue_commitments)) {
      sc1q.dialogue_commitments.forEach(function(c, i) {
        if (!c || !c.npc) return;
        var body = [c.npc, c.task, c.required_npc_action, c.deadline, c.source_type, c.player_emphasis].filter(Boolean).join(' ');
        out.push(makeEnvelope({
          id: c.id || c.source_conv_id || ('sc1q-commitment-' + i),
          type: 'commitment',
          body: body,
          sourceRefs: [sourceRef('dialogueCommitment', c.id || c.source_conv_id || ('sc1q-commitment-' + i), body, { turn: turn })],
          status: 'active',
          authority: 'rule_validated',
          visibility: 'world_truth',
          turn: turn || 0,
          entities: [c.npc],
          lane: 'L2_active_law_commitment',
          reason: 'projection:dialogue_commitment'
        }));
      });
    }
  }

  function qijuBody(q) {
    var ER = root.TM && root.TM.MemoryEvidenceRegistry;
    if (ER && typeof ER.qijuBody === 'function') return ER.qijuBody(q);
    q = q || {};
    return [q.edicts, q.xinglu, q.memorials, q.zhengwen, q.content, q.category].filter(Boolean).map(toText).join(' ');
  }

  function qijuAuthority(q) {
    var ER = root.TM && root.TM.MemoryEvidenceRegistry;
    if (ER && typeof ER.qijuAuthority === 'function') return ER.qijuAuthority(q);
    if (q && (q.edicts || q.xinglu || q.memorials || q.edictsSource)) return 'player_pin';
    if (q && q.zhengwen) return 'official_record';
    return 'event_log';
  }

  function trackAuthority(t) {
    var ER = root.TM && root.TM.MemoryEvidenceRegistry;
    if (ER && typeof ER.trackAuthority === 'function') return ER.trackAuthority(t);
    t = t || {};
    if (t.hidden === true || String(t.sourceType || '').toLowerCase() === 'scheme') return 'internal_sim_state';
    return 'rule_validated';
  }

  function issueHasResolution(issue) {
    return !!(issue && (
      issue.resolution || issue.result || issue.outcome || issue.playerChoice ||
      issue.resolvedTurn || issue.resolvedAtTurn || issue.status === 'resolved'
    ));
  }

  function recordIssueResolutionEdge(GM, issueId, turn) {
    var MIG = root.TM && root.TM.MemoryIssueGovernance;
    if (MIG && typeof MIG.createIssueResolutionEdge === 'function') MIG.createIssueResolutionEdge(GM, issueId, issueId, turn);
  }

  function pushIssueEnvelopes(out, GM, turn) {
    if (!GM || !Array.isArray(GM.currentIssues)) return;
    GM.currentIssues.slice(-40).forEach(function(issue, i) {
      if (!issue) return;
      var body = [issue.title, issue.category, issue.description, issue.narrative, issue.longTermConsequences, issue.resolution, issue.result, issue.outcome, issue.playerChoice].filter(Boolean).join(' ');
      if (!body) return;
      var resolved = issueHasResolution(issue);
      var issueKey = issue.id || ('issue-' + i);
      if (resolved) recordIssueResolutionEdge(GM, issueKey, issue.resolvedTurn || issue.resolvedAtTurn || turn);
      out.push(makeEnvelope({
        id: issueKey,
        type: resolved ? 'issue_resolution' : 'strategic_issue',
        body: body,
        sourceRefs: [sourceRef('currentIssues', issueKey, body, { turn: issue.raisedTurn || issue.turn || turn })],
        status: resolved ? 'active' : (issue.status || 'active'),
        authority: resolved ? (issue.authority || 'rule_validated') : (issue.authorityLevel || issue.authority || 'ai_analysis'),
        visibility: issue.visibility || 'public',
        turn: Number(issue.resolvedTurn || issue.resolvedAtTurn || issue.raisedTurn || issue.turn || turn || 0),
        entities: [].concat(issue.linkedChars || [], issue.linkedFactions || []),
        lane: resolved ? 'L2_active_law_commitment' : 'L5_advisory_context',
        reason: resolved ? 'projection:issue_resolution' : 'projection:current_issue',
        confidence: issue.confidence != null ? issue.confidence : (resolved ? 0.82 : 0.55),
        factStatus: resolved ? 'issue_resolution' : (issue.factStatus || 'advisory'),
        role: resolved ? 'resolution' : 'advisory',
        basisRefs: issue.evidenceRefs || issue.basisRefs || [],
        extra: {
          category: issue.category || '',
          severity: issue.severity || '',
          issueStatus: issue.status || '',
          resolution: issue.resolution || issue.result || issue.outcome || issue.playerChoice || ''
        }
      }));
    });
  }

  function pushQijuEnvelopes(out, GM, turn) {
    if (!GM || !Array.isArray(GM.qijuHistory)) return;
    GM.qijuHistory.slice(-80).forEach(function(q, i) {
      if (!q) return;
      var baseId = q.id || ('qiju-' + (q.turn || turn || i) + '-' + i);
      var body = qijuBody(q);
      if (!body) return;
      var authority = qijuAuthority(q);
      if (q.edicts || q.xinglu || q.memorials || q.edictsSource) {
        out.push(makeEnvelope({
          id: 'qiju-action-' + baseId,
          type: 'player_action_record',
          body: body,
          sourceRefs: [sourceRef('qijuHistory', baseId, body, { turn: q.turn || turn })],
          status: q.status || 'active',
          authority: authority,
          visibility: q.visibility || 'public',
          turn: Number(q.turn || turn || 0),
          lane: 'L2_active_law_commitment',
          reason: 'projection:qiju_player_action',
          factStatus: 'recorded_player_action',
          role: 'command'
        }));
      } else if (q.zhengwen) {
        out.push(makeEnvelope({
          id: 'qiju-record-' + baseId,
          type: 'official_record',
          body: body,
          sourceRefs: [sourceRef('qijuHistory', baseId, body, { turn: q.turn || turn })],
          status: q.status || 'active',
          authority: authority,
          visibility: q.visibility || 'public',
          turn: Number(q.turn || turn || 0),
          lane: 'L6_retrieved_evidence',
          reason: 'projection:qiju_zhengwen',
          factStatus: 'recorded_narrative',
          role: 'record'
        }));
      } else {
        out.push(makeEnvelope({
          id: 'qiju-event-' + baseId,
          type: 'episodic_event',
          body: body,
          sourceRefs: [sourceRef('qijuHistory', baseId, body, { turn: q.turn || turn })],
          status: q.status || 'active',
          authority: authority,
          visibility: q.visibility || 'public',
          turn: Number(q.turn || turn || 0),
          lane: 'L6_retrieved_evidence',
          reason: 'projection:qiju_event',
          factStatus: 'event_log',
          role: 'record'
        }));
      }
    });
  }

  function pushJishiEnvelopes(out, GM, turn) {
    if (!GM || !Array.isArray(GM.jishiRecords)) return;
    GM.jishiRecords.slice(-80).forEach(function(r, i) {
      if (!r) return;
      var body = [r.char, r.mode, r.playerSaid, r.npcSaid, r.topic, r.summary].filter(Boolean).join(' ');
      if (!body) return;
      var id = r.id || ('jishi-' + (r.turn || turn || 0) + '-' + (r.char || i) + '-' + i);
      out.push(makeEnvelope({
        id: id,
        type: 'court_dialogue_record',
        body: body,
        sourceRefs: [sourceRef('jishiRecords', id, body, { turn: r.turn || turn })],
        status: r.status || 'active',
        authority: r.authorityLevel || 'court_report',
        visibility: r.visibility || 'public',
        turn: Number(r.turn || turn || 0),
        entities: [r.char],
        lane: 'L4_dialogue_evidence',
        reason: 'projection:jishi_record',
        confidence: r.confidence != null ? r.confidence : 0.78,
        factStatus: 'reported_dialogue',
        role: 'reported_input'
      }));
    });
  }

  function courtRecordBody(r) {
    r = r || {};
    return [
      r.topic,
      r.title,
      r.name,
      r.decision,
      r.resolution,
      r.result,
      Array.isArray(r.decisions) ? r.decisions.join(' ') : r.decisions,
      Array.isArray(r.adopted) ? r.adopted.join(' ') : r.adopted,
      r.summary,
      r.speaker,
      Array.isArray(r.participants) ? r.participants.join(' ') : r.participants
    ].filter(Boolean).map(toText).join(' ');
  }

  function pushCourtRecordEnvelopes(out, GM, turn) {
    if (!GM || !Array.isArray(GM._courtRecords)) return;
    GM._courtRecords.slice(-80).forEach(function(r, i) {
      if (!r) return;
      var body = courtRecordBody(r);
      if (!body) return;
      var id = r.id || ('court-record-' + (r.turn || r.targetTurn || turn || 0) + '-' + i);
      var hasResolution = !!(r.decision || r.resolution || r.result || r.adopted || r.decisions);
      var type = hasResolution ? 'court_resolution' : 'court_record';
      var authority = r.authorityLevel || r.authority || (hasResolution ? 'rule_validated' : 'court_report');
      var basisRefs = [];
      if (r.sourceType || r.sourceId) {
        basisRefs.push({
          type: r.sourceType || 'courtSource',
          id: r.sourceId || id,
          turn: r.sourceTurn || r.turn || turn,
          authority: authority,
          authorityRank: authorityRank(authority),
          relation: 'supports'
        });
      }
      out.push(makeEnvelope({
        id: id,
        type: type,
        body: body,
        sourceRefs: [sourceRef('courtRecords', id, body, { turn: r.turn || r.targetTurn || turn })],
        status: r.status || 'active',
        authority: authority,
        visibility: r.visibility || 'public',
        turn: Number(r.turn || r.targetTurn || turn || 0),
        entities: [].concat(r.participants || [], r.speaker || [], r.actor || [], r.target || []),
        lane: r.lane || 'L4_dialogue_evidence',
        reason: 'projection:court_record',
        confidence: r.confidence != null ? r.confidence : (hasResolution ? 0.86 : 0.78),
        factStatus: hasResolution ? 'court_resolution' : 'court_record',
        role: hasResolution ? 'resolution' : 'record',
        basisRefs: basisRefs,
        extra: {
          phase: r.phase || '',
          sourceType: r.sourceType || '',
          sourceId: r.sourceId || '',
          importance: r.importance || (hasResolution ? 7 : 5)
        }
      }));
    });
  }

  // F2 说明（2026-06-01）：GM._npcRelationEvents 是「可选外部/剧本输入槽」，正常游玩无写入者、为空属正常。
  // 关系/恩德记忆的常规来源是 MemoryTurnArchive（archiveTurn 把 AI 的 npc_actions + affinity_changes/relations
  // 捕为 relationship_event 投影）+ 人物记忆 character_memory_updates。切勿在游玩路径另写 _npcRelationEvents，否则与 archive 重复。
  function pushNpcRelationEventEnvelopes(out, GM, turn) {
    if (!GM || !Array.isArray(GM._npcRelationEvents)) return;
    GM._npcRelationEvents.slice(-160).forEach(function(evt, i) {
      if (!evt) return;
      var body = [evt.actor, evt.target, evt.kind, evt.text].filter(Boolean).join(' ');
      if (!body) return;
      var id = evt.id || ('npc-relation-event-' + (evt.turn || turn || i) + '-' + i);
      out.push(makeEnvelope({
        id: id,
        type: 'relationship_event',
        body: body,
        sourceRefs: Array.isArray(evt.sourceRefs) && evt.sourceRefs.length ? evt.sourceRefs : [sourceRef('npcRelationEvent', id, body, { turn: evt.turn || turn })],
        status: evt.status || 'active',
        authority: evt.authorityLevel || evt.authority || 'event_log',
        visibility: evt.visibility || 'internal',
        turn: Number(evt.turn || turn || 0),
        entities: [evt.actor, evt.target].concat(evt.participants || []),
        lane: 'L4_dialogue_evidence',
        reason: 'projection:npc_relation_event',
        confidence: evt.confidence != null ? evt.confidence : 0.82,
        factStatus: evt.factStatus || 'event_log',
        role: 'record',
        basisRefs: Array.isArray(evt.basisRefs) && evt.basisRefs.length ? evt.basisRefs : [{ type: 'npcRelationEvent', id: id, turn: evt.turn || turn, authority: evt.authorityLevel || 'event_log', authorityRank: authorityRank(evt.authorityLevel || 'event_log') }],
        extra: {
          importance: evt.importance,
          kind: evt.kind,
          actor: evt.actor,
          target: evt.target
        }
      }));
    });
  }

  function pushBiannianEnvelopes(out, GM, turn) {
    if (!GM || !Array.isArray(GM.biannianItems)) return;
    GM.biannianItems.slice(-80).forEach(function(item, i) {
      if (!item) return;
      var body = [item.title, item.name, item.content, item.desc, item.text, item.type, item.category].filter(Boolean).join(' ');
      if (!body) return;
      var id = item.id || ('biannian-' + (item.turn || item.startTurn || turn || i) + '-' + i);
      out.push(makeEnvelope({
        id: id,
        type: 'chronicle_event',
        body: body,
        sourceRefs: [sourceRef('biannianItems', id, body, { turn: item.turn || item.startTurn || turn })],
        status: item.status || 'active',
        authority: item.authorityLevel || 'structured_chronicle',
        visibility: item.visibility || 'public',
        turn: Number(item.turn || item.startTurn || turn || 0),
        lane: 'L7_chronicle_context',
        reason: 'projection:biannian_item',
        factStatus: 'recorded_event',
        role: 'record'
      }));
    });
  }

  function pushYearlyChronicleEnvelopes(out, GM, turn) {
    if (!GM || !Array.isArray(GM.yearlyChronicles)) return;
    GM.yearlyChronicles.slice(-36).forEach(function(y, i) {
      if (!y) return;
      var body = [y.title, y.year, y.summary, y.content, y.afterword, y.text].filter(Boolean).join(' ');
      if (!body) return;
      var id = y.id || ('yearly-chronicle-' + (y.year || y.turn || i));
      out.push(makeEnvelope({
        id: id,
        type: 'historiography_summary',
        body: body,
        sourceRefs: [sourceRef('yearlyChronicles', id, body, { turn: y.turn || turn })],
        status: y.status || 'active',
        authority: y.authority || 'structured_chronicle',
        visibility: y.visibility || 'public',
        turn: Number(y.turn || turn || 0),
        entities: [].concat(y.entities || []),
        lane: 'L7_chronicle_context',
        reason: 'projection:yearly_chronicle',
        factStatus: 'historiography_summary',
        role: 'record',
        extra: { year: y.year || '' }
      }));
    });
  }

  function pushChronicleTrackEnvelopes(out, GM, turn) {
    var tracks = [];
    if (GM && Array.isArray(GM._chronicleTracks)) tracks = GM._chronicleTracks;
    else if (root.ChronicleTracker && typeof root.ChronicleTracker.getAll === 'function') {
      try { tracks = root.ChronicleTracker.getAll({}) || []; } catch (_) { tracks = []; }
    }
    tracks.slice(-120).forEach(function(t, i) {
      if (!t) return;
      var body = [t.title, t.name, t.summary, t.currentStage, t.stageNote, t.result, t.progress != null ? ('progress ' + t.progress) : '', t.sourceType, t.sourceId].filter(Boolean).join(' ');
      if (!body) return;
      var id = 'chron-track-' + (t.sourceId || t.id || i);
      var authority = trackAuthority(t);
      out.push(makeEnvelope({
        id: id,
        type: 'ongoing_affair',
        body: body,
        sourceRefs: [sourceRef('chronicleTrack', t.id || t.sourceId || id, body, { turn: t.turn || t.startedTurn || turn })],
        status: t.status || 'active',
        authority: authority,
        visibility: t.hidden ? 'gm_hidden' : (t.visibility || 'public'),
        turn: Number(t.turn || t.startedTurn || turn || 0),
        entities: [].concat(t.linkedChars || [], t.entities || []),
        lane: 'L3_long_term_affair',
        reason: 'projection:chronicle_track',
        confidence: t.confidence != null ? t.confidence : (authority === 'internal_sim_state' ? 0.72 : 0.82),
        factStatus: t.status || 'active',
        role: 'constraint',
        basisRefs: t.sourceId ? [{ type: t.sourceType || 'chronicleSource', id: t.sourceId, authority: authority, authorityRank: authorityRank(authority) }] : []
      }));
    });
  }

  function pushChronicleSystemEnvelopes(out, GM, turn) {
    var cs = root.ChronicleSystem || (GM && GM._chronicleSysState) || null;
    if (!cs) return;
    var monthDrafts = cs.monthDrafts || {};
    Object.keys(monthDrafts).slice(-36).forEach(function(key) {
      var d = monthDrafts[key];
      if (!d) return;
      var body = [d.summary, d.detail, d.zhengwen, d.content].filter(Boolean).join(' ');
      if (!body) return;
      out.push(makeEnvelope({
        id: 'chron-month-' + key,
        type: 'historiography_draft',
        body: body,
        sourceRefs: [sourceRef('chronicleMonth', key, body, { turn: d.turn || turn })],
        status: d.status || 'active',
        authority: 'ai_summary',
        visibility: d.visibility || 'public',
        turn: Number(d.turn || turn || 0),
        lane: 'L7_chronicle_context',
        reason: 'projection:chronicle_month_draft',
        factStatus: 'summary',
        role: 'summary'
      }));
    });
    var years = cs.yearChronicles || {};
    Object.keys(years).slice(-12).forEach(function(year) {
      var y = years[year];
      if (!y) return;
      var body = [y.content, y.summary, y.afterword, y.text].filter(Boolean).join(' ');
      if (!body) return;
      out.push(makeEnvelope({
        id: 'chron-year-' + year,
        type: 'historiography_summary',
        body: body,
        sourceRefs: [sourceRef('chronicleYear', year, body, { turn: y.turn || turn })],
        status: y.status || 'active',
        authority: 'ai_summary',
        visibility: y.visibility || 'public',
        turn: Number(y.turn || turn || 0),
        lane: 'L7_chronicle_context',
        reason: 'projection:chronicle_year_summary',
        factStatus: 'summary',
        role: 'summary'
      }));
    });
  }

  function reflectionConfidence(item) {
    item = item || {};
    if (item.confidence != null) return clampConfidence(item.confidence, 0.45);
    var cal = Number(item.confidence_calibration || item.confidenceCalibration || 0);
    if (!isFinite(cal)) cal = 0;
    var base = 0.55 + Math.max(-0.25, Math.min(0.25, cal * 0.25));
    var div = clean(item.divergence, 20).toLowerCase();
    if (div === 'high') base -= 0.08;
    else if (div === 'low') base += 0.05;
    return clampConfidence(base, 0.45);
  }

  function pushProceduralLessonEnvelopes(out, GM, turn) {
    if (!GM) return;
    if (Array.isArray(GM._aiReflections)) {
      GM._aiReflections.slice(-24).forEach(function(ref, i) {
        if (!ref) return;
        var body = [ref.lesson, ref.forecast, ref.actual, ref.divergence].filter(Boolean).join(' ');
        if (!body) return;
        var id = ref.id || ('ai-reflection-' + (ref.turn || turn || i) + '-' + i);
        out.push(makeEnvelope({
          id: id,
          type: 'procedural_lesson',
          body: body,
          sourceRefs: [sourceRef('aiReflection', id, body, { turn: ref.turn || turn })],
          status: ref.status || 'active',
          authority: 'reflection',
          visibility: ref.visibility || 'internal',
          turn: Number(ref.turn || turn || 0),
          entities: ref.entities || [],
          lane: 'L5_advisory_context',
          reason: 'projection:ai_reflection',
          confidence: reflectionConfidence(ref),
          factStatus: 'procedural_advice',
          role: 'procedural',
          basisRefs: ref.basisRefs || ref.evidenceRefs || ref.sourceRefs || [],
          extra: { importance: ref.importance || 4, trigger: ref.trigger || '', scope: ref.scope || '' }
        }));
      });
    }
    if (Array.isArray(GM._proceduralLessons)) {
      GM._proceduralLessons.slice(-40).forEach(function(item, i) {
        if (!item) return;
        var body = [item.lesson, item.text, item.trigger, item.scope].filter(Boolean).join(' ');
        if (!body) return;
        var id = item.id || ('procedural-lesson-' + (item.turn || turn || i) + '-' + i);
        out.push(makeEnvelope({
          id: id,
          type: 'procedural_lesson',
          body: body,
          sourceRefs: Array.isArray(item.sourceRefs) && item.sourceRefs.length ? item.sourceRefs : [sourceRef(item.type || 'proceduralLesson', id, body, { turn: item.turn || turn })],
          status: item.status || 'active',
          authority: item.authorityLevel || item.authority || 'procedural',
          visibility: item.visibility || 'internal',
          turn: Number(item.turn || turn || 0),
          entities: item.entities || item.participants || [],
          lane: 'L5_advisory_context',
          reason: 'projection:procedural_lesson',
          confidence: item.confidence != null ? item.confidence : 0.65,
          factStatus: 'procedural_advice',
          role: 'procedural',
          basisRefs: item.basisRefs || item.evidenceRefs || item.sourceRefs || [],
          extra: { importance: item.importance || 5, trigger: item.trigger || '', scope: item.scope || '', lessonType: item.type || '' }
        }));
      });
    }
  }

  function pushNarrativeEnvelopes(out, GM) {
    if (!GM) return;
    if (Array.isArray(GM.shijiHistory)) {
      GM.shijiHistory.slice(-60).forEach(function(sh, i) {
        if (!sh) return;
        var body = sh.shilu || sh.shizhengji || sh.zhengwen || sh.text || '';
        if (!body) return;
        out.push(makeEnvelope({
          id: sh.id || ('shiji-' + (sh.turn || i)),
          type: 'episodic_event',
          body: body,
          sourceRefs: [sourceRef('shijiHistory', sh.id || ('shiji-' + (sh.turn || i)), body, { turn: sh.turn })],
          status: 'active',
          authority: sh.authorityLevel || sh.authority || 'raw_narrative',
          visibility: sh.visibility || 'public',
          turn: Number(sh.turn || 0),
          lane: 'L6_retrieved_evidence',
          reason: 'projection:shiji_history',
          confidence: sh.confidence,
          factStatus: sh.factStatus || '',
          role: sh.role || 'record',
          basisRefs: sh.evidenceRefs || sh.basisRefs || []
        }));
      });
    }
    if (Array.isArray(GM._foreshadows)) {
      GM._foreshadows.forEach(function(f, i) {
        if (!f) return;
        var body = f.content || f.text || '';
        if (!body) return;
        out.push(makeEnvelope({
          id: f.id || ('foreshadow-' + i),
          type: 'narrative_thread',
          body: body,
          sourceRefs: [sourceRef('foreshadow', f.id || ('foreshadow-' + i), body, { turn: f.turn })],
          status: f.status || 'active',
          authority: 'ai_extracted',
          visibility: f.visibility || 'player_known',
          turn: Number(f.turn || 0),
          lane: 'L8_narrative_threads',
          reason: 'projection:foreshadow'
        }));
      });
    }
    if (Array.isArray(GM.memoryAnchors)) {
      GM.memoryAnchors.forEach(function(a, i) {
        if (!a) return;
        var body = a.text || a.content || a.summary || '';
        if (!body) return;
        out.push(makeEnvelope({
          id: a.id || ('anchor-' + i),
          type: 'summary',
          body: body,
          sourceRefs: Array.isArray(a.sourceRefs) && a.sourceRefs.length ? a.sourceRefs : [sourceRef('memoryAnchor', a.id || ('anchor-' + i), body, { turn: a.turn })],
          status: a.status || 'active',
          authority: 'rule_validated_summary',
          visibility: a.visibility || 'public',
          turn: Number(a.turn || 0),
          entities: a.entities || [],
          lane: 'L8_narrative_threads',
          reason: 'projection:memory_anchor'
        }));
      });
    }
    if (Array.isArray(GM._aiMemorySummaries)) {
      GM._aiMemorySummaries.forEach(function(s, i) {
        if (!s) return;
        var body = s.text || s.summary || s.content || '';
        if (!body) return;
        out.push(makeEnvelope({
          id: s.id || ('ai-summary-' + i),
          type: 'summary',
          body: body,
          sourceRefs: Array.isArray(s.sourceRefs) && s.sourceRefs.length ? s.sourceRefs : [sourceRef('aiMemorySummary', s.id || ('ai-summary-' + i), body, { turn: s.turn })],
          status: s.status || 'active',
          authority: 'ai_summary',
          visibility: s.visibility || 'public',
          turn: Number(s.turn || 0),
          entities: s.entities || [],
          lane: 'L8_narrative_threads',
          reason: 'projection:ai_summary'
        }));
      });
    }
  }

  function pushTurnArchiveEnvelopes(out, GM, turn) {
    if (!GM || !Array.isArray(GM._turnMemoryArchive)) return;
    GM._turnMemoryArchive.slice(-80).forEach(function(bundle) {
      if (!bundle) return;
      function projectList(list, defaults) {
        (Array.isArray(list) ? list : []).forEach(function(item, i) {
          if (!item) return;
          var body = item.body || item.text || item.content || '';
          if (!body) return;
          var id = item.id || ((defaults.idPrefix || 'turn-archive-item') + '-' + (bundle.turn || turn || 0) + '-' + i);
          out.push(makeEnvelope({
            id: id,
            type: item.type || defaults.type || 'episodic_event',
            body: body,
            sourceRefs: Array.isArray(item.sourceRefs) && item.sourceRefs.length ? item.sourceRefs : [sourceRef('turnArchive', id, body, { turn: item.turn || bundle.turn || turn })],
            status: item.status || 'active',
            authority: item.authority || defaults.authority || 'event_log',
            visibility: item.visibility || defaults.visibility || 'public',
            turn: Number(item.turn || bundle.turn || turn || 0),
            saveId: item.saveId || bundle.saveId,
            worldId: item.worldId || bundle.worldId,
            ownerScope: item.ownerScope,
            readScope: item.readScope,
            writeScope: item.writeScope,
            safeBody: item.safeBody,
            entities: item.entities || [],
            lane: item.lane || defaults.lane || 'L6_retrieved_evidence',
            reason: item.reason || defaults.reason || 'projection:turn_archive',
            confidence: item.confidence != null ? item.confidence : defaults.confidence,
            factStatus: item.factStatus || defaults.factStatus || '',
            role: item.role || defaults.role || 'record',
            basisRefs: item.basisRefs || item.evidenceRefs || [],
            extra: item.extra || { stream: defaults.stream || '' }
          }));
        });
      }
      projectList(bundle.chronicle, {
        idPrefix: 'turn-archive-chronicle',
        type: 'chronicle_event',
        authority: 'structured_chronicle',
        lane: 'L7_chronicle_context',
        factStatus: 'recorded_event',
        stream: 'chronicle'
      });
      projectList(bundle.stateAffairs, {
        idPrefix: 'turn-archive-state-affair',
        type: 'issue_update',
        authority: 'ai_analysis',
        lane: 'L5_advisory_context',
        factStatus: 'advisory',
        stream: 'stateAffairs'
      });
      projectList(bundle.characterEvents, {
        idPrefix: 'turn-archive-character-event',
        type: 'relationship_event',
        authority: 'event_log',
        visibility: 'internal',
        lane: 'L4_dialogue_evidence',
        factStatus: 'turn_archive_event',
        stream: 'characterEvents'
      });
    });
  }

  function pushTurnRollupEnvelopes(out, GM, turn) {
    if (!GM) return;
    function projectList(list, defaults) {
      (Array.isArray(list) ? list : []).forEach(function(item, i) {
        if (!item) return;
        var body = item.body || item.text || item.content || '';
        if (!body) return;
        var id = item.id || ((defaults.idPrefix || 'turn-rollup') + '-' + i);
        out.push(makeEnvelope({
          id: id,
          type: item.type || defaults.type || 'summary',
          body: body,
          sourceRefs: Array.isArray(item.sourceRefs) && item.sourceRefs.length ? item.sourceRefs : [sourceRef(defaults.sourceType || 'turnRollup', id, body, { turn: item.turn || turn })],
          status: item.status || 'active',
          authority: item.authority || defaults.authority || 'structured_chronicle',
          visibility: item.visibility || defaults.visibility || 'public',
          turn: Number(item.turn || item.endTurn || turn || 0),
          saveId: item.saveId,
          worldId: item.worldId,
          ownerScope: item.ownerScope,
          readScope: item.readScope,
          writeScope: item.writeScope,
          safeBody: item.safeBody,
          entities: item.entities || [],
          lane: item.lane || defaults.lane || 'L6_retrieved_evidence',
          reason: item.reason || defaults.reason || 'projection:turn_rollup',
          confidence: item.confidence != null ? item.confidence : defaults.confidence,
          factStatus: item.factStatus || defaults.factStatus || '',
          role: item.role || defaults.role || 'rollup',
          basisRefs: item.basisRefs || item.evidenceRefs || [],
          extra: item.extra || { stream: defaults.stream || '' }
        }));
      });
    }
    projectList(GM._memoryChronicleRollups, {
      idPrefix: 'memory-chronicle-rollup',
      sourceType: 'memoryChronicleRollup',
      type: 'historiography_summary',
      authority: 'structured_chronicle',
      lane: 'L7_chronicle_context',
      factStatus: 'historiography_summary',
      stream: 'chronicleRollup'
    });
    projectList(GM._memoryEraRollups, { // S7(2026-06-03): 第二层 era 大略折叠投影进 chronology
      idPrefix: 'memory-era-rollup',
      sourceType: 'memoryEraRollup',
      type: 'historiography_summary',
      authority: 'structured_chronicle',
      lane: 'L7_chronicle_context',
      factStatus: 'historiography_summary',
      stream: 'eraRollup'
    });
    projectList(GM._memoryIssueChains, {
      idPrefix: 'memory-issue-chain',
      sourceType: 'memoryIssueChain',
      type: 'ongoing_affair',
      authority: 'ai_analysis',
      lane: 'L3_long_term_affair',
      factStatus: 'issue_chain_active',
      stream: 'issueChain'
    });
    projectList(GM._memoryCharacterDossiers, {
      idPrefix: 'memory-character-dossier',
      sourceType: 'memoryCharacterDossier',
      type: 'character_memory',
      authority: 'event_log',
      visibility: 'internal',
      lane: 'L6_retrieved_evidence',
      factStatus: 'character_event_rollup',
      stream: 'characterDossier'
    });
  }

  function pushAcceptedMemoryEnvelopes(out, GM, turn) {
    if (!GM || !Array.isArray(GM._memoryAccepted)) return;
    GM._memoryAccepted.slice(-80).forEach(function(item) {
      if (!item || normalizeStatus(item.status || 'active') !== 'active') return;
      var body = item.body || item.text || item.content || '';
      if (!body) return;
      out.push(makeEnvelope({
        id: item.id,
        type: item.type || item.kind || 'semantic_fact',
        body: body,
        sourceRefs: item.sourceRefs || [],
        status: 'active',
        authority: item.authority || item.source || 'ai_extracted',
        visibility: item.visibility || 'player_known',
        turn: item.turn != null ? item.turn : (item.enqueuedAtTurn != null ? item.enqueuedAtTurn : (item.acceptedAtTurn != null ? item.acceptedAtTurn : turn)),
        saveId: item.saveId,
        worldId: item.worldId,
        campaignId: item.campaignId,
        timelineId: item.timelineId,
        reviewStatus: item.reviewStatus,
        validFromTurn: item.validFromTurn,
        validToTurn: item.validToTurn,
        expiredAtTurn: item.expiredAtTurn,
        learnedAtTurn: item.learnedAtTurn,
        ownerScope: item.ownerScope,
        readScope: item.readScope,
        writeScope: item.writeScope,
        safeBody: item.safeBody,
        entities: item.entities || [],
        lane: item.lane || 'L6_retrieved_evidence',
        reason: 'projection:accepted_memory',
        confidence: item.confidence != null ? item.confidence : null,
        factStatus: item.factStatus || 'accepted_memory',
        role: item.role || 'accepted_memory',
        basisRefs: item.basisRefs || item.evidenceRefs || item.sourceRefs || []
      }));
    });
  }

  function dedupe(envelopes) {
    var seen = {};
    var out = [];
    envelopes.forEach(function(env) {
      if (!env || !env.id) return;
      var key = env.type + ':' + env.id;
      if (seen[key]) return;
      seen[key] = true;
      out.push(env);
    });
    return out;
  }

  // —— F3-A 迁移：老路 getMemoryAnchorsForAI 独有的 3 个源，迁入 v6 governed 投影 ——
  // memoryArchive（年代纪要）→ chronology；playerDecisions（玩家决策轨迹）→ recentEvents；characterArcs（角色履历）→ characterMemory
  function pushMemoryArchiveEnvelopes(out, GM, turn) {
    if (!GM || !Array.isArray(GM.memoryArchive)) return;
    GM.memoryArchive.slice(-12).forEach(function(a, i) {
      if (!a) return;
      var body = [a.title, a.content].filter(Boolean).join('：');
      if (!body) return;
      var id = a.id || ('memory-archive-' + (a.year || a.turn || i));
      out.push(makeEnvelope({
        id: id,
        type: 'historiography_summary',
        body: body,
        sourceRefs: [sourceRef('memoryArchive', id, body, { turn: a.turn })],
        status: a.status || 'active',
        authority: a.authority || 'structured_chronicle',
        visibility: a.visibility || 'public',
        turn: Number(a.turn || 0),
        lane: 'L7_chronicle_context',
        reason: 'projection:memory_archive',
        extra: { year: a.year || '' }
      }));
    });
  }

  function pushPlayerDecisionEnvelopes(out, GM, turn) {
    if (!GM || !Array.isArray(GM.playerDecisions)) return;
    GM.playerDecisions.slice(-30).forEach(function(d, i) {
      if (!d) return;
      var core = [d.desc, d.consequences ? ('→ ' + d.consequences) : ''].filter(Boolean).join(' ');
      if (!core) return;
      var cat = d.category || 'decision';
      var id = d.id || ('player-decision-' + (d.turn || 0) + '-' + i);
      out.push(makeEnvelope({
        id: id,
        type: 'player_action_record',
        body: '[' + cat + '] ' + core,
        sourceRefs: [sourceRef('playerDecisions', id, core, { turn: d.turn })],
        status: 'active',
        authority: cat === 'decision_archive' ? 'structured_chronicle' : 'event_log',
        visibility: 'player_known',
        turn: Number(d.turn || 0),
        lane: 'L6_retrieved_evidence',
        reason: 'projection:player_decision',
        extra: { category: cat }
      }));
    });
  }

  function pushCharacterArcEnvelopes(out, GM, turn) {
    if (!GM || !GM.characterArcs || typeof GM.characterArcs !== 'object' || Array.isArray(GM.characterArcs)) return;
    Object.keys(GM.characterArcs).forEach(function(name) {
      var list = GM.characterArcs[name];
      if (!Array.isArray(list) || !list.length) return;
      var summary = list.slice(-4).map(function(e) {
        if (!e || !e.desc) return '';
        return 'T' + (e.turn || 0) + (e.type ? ('[' + e.type + ']') : '') + e.desc;
      }).filter(Boolean).join('；');
      if (!summary) return;
      var id = 'character-arc-' + name;
      out.push(makeEnvelope({
        id: id,
        type: 'character_memory',
        body: name + '：' + summary,
        sourceRefs: [sourceRef('characterArc', id, summary, { turn: turn })],
        status: 'active',
        authority: 'rule_validated_summary',
        visibility: 'public',
        turn: Number(turn || 0),
        entities: [name],
        lane: 'L6_retrieved_evidence',
        reason: 'projection:character_arc'
      }));
    });
  }

  // —— E2（2026-06-01·研究增强·非 Codex 原方案）：恩德/关系记忆「累积→立场」综合 ——
  // MemoryBank「综合过往交互成 persona 立场」的确定性变体（零 AI 调用·绑源不 stale·守 BYOK+distrust）。
  // 把某 NPC 在 _memoryAccepted 里的散点 character_memory/belief 综合为一条「对帝立场综述」，
  // 让演绎脑直接看到净账(累计N条·受恩X·恩怨Y·承诺Z·近事)而非散事件——治「恩德不累积」的呈现层。
  function pushCharacterStanceEnvelopes(out, GM, turn) {
    if (!GM || !Array.isArray(GM._memoryAccepted)) return;
    var byActor = {};
    GM._memoryAccepted.forEach(function(item) {
      if (!item) return;
      var t = String(item.type || '');
      if (t !== 'character_memory' && t !== 'character_belief') return;
      if (String(item.status || 'active') !== 'active') return;
      var extra = item.extra || {};
      var actor = clean(extra.actor || (Array.isArray(item.entities) && item.entities[0]) || '', 80);
      if (!actor) return;
      if (!byActor[actor]) byActor[actor] = { count: 0, fav: 0, grd: 0, commit: 0, latest: '', latestTurn: -1 };
      var g = byActor[actor];
      var ec = Number(extra.eventCount) || 1; // S2: stance accumulator carries merged event count
      g.count += ec;
      var mt = String(extra.memoryType || '').toLowerCase();
      if (mt === 'favor' || mt === 'reward' || mt === 'gratitude' || mt === 'gratitude_debt' || mt === 'boon' || mt === 'kindness') g.fav += ec;
      else if (mt === 'grudge' || mt === 'fear' || mt === 'resentment' || mt === 'grievance' || mt === 'enmity') g.grd += ec;
      else if (mt === 'commitment' || mt === 'commit' || mt === 'promise' || mt === 'pledge') g.commit += ec;
      var it = Number(item.turn || 0);
      if (it >= g.latestTurn) { g.latestTurn = it; g.latest = item.safeBody || item.body || ''; }
    });
    Object.keys(byActor).forEach(function(actor) {
      var g = byActor[actor];
      if (g.count < 2) return; // 仅对累积≥2条记忆的 NPC 综合立场，单条无需综述
      var parts = ['累计' + g.count + '条记忆'];
      if (g.fav) parts.push('受恩' + g.fav);
      if (g.grd) parts.push('恩怨' + g.grd);
      if (g.commit) parts.push('承诺' + g.commit);
      if (g.fav || g.grd) parts.push('净' + ((g.fav - g.grd) >= 0 ? '+' : '') + (g.fav - g.grd)); // S2: favor-grudge net

      var body = actor + '·对帝立场综述：' + parts.join('·') + (g.latest ? ('；近事：' + clean(g.latest, 60)) : '');
      var id = 'character-stance-' + actor;
      out.push(makeEnvelope({
        id: id,
        type: 'character_memory',
        body: body,
        sourceRefs: [sourceRef('characterStance', id, body, { turn: turn })],
        status: 'active',
        authority: 'rule_validated_summary',
        visibility: 'public',
        turn: Number(turn || 0),
        entities: [actor],
        lane: 'L6_retrieved_evidence',
        reason: 'projection:character_stance'
      }));
    });
  }

  // —— E3（2026-06-01·研究增强·非 Codex 原方案）：失败诏令→程序性教训（Reflexion「从失败中学」确定性切片）——
  // procedural 投影槽(_aiReflections/_proceduralLessons)正常游玩无写入者；此处从「失败/废止的诏令」确定性投影
  // procedural_lesson(advisory 低权威·warnings 区)，让演绎脑看到过往失败、不重复犯同类错。零 AI 调用·绑源不 stale。
  var _FAILED_EDICT_STATUS = { failed: 1, abandoned: 1, aborted: 1, cancelled: 1, canceled: 1, rejected: 1, obsolete: 1 };
  function pushFailedEdictLessonEnvelopes(out, GM, turn) {
    if (!GM) return;
    function emit(name, status, reason, t, id) {
      var label = clean(name, 80);
      if (!label) return;
      var body = '诏令/举措「' + label + '」于 T' + Number(t || turn || 0) + ' ' + status +
        (reason ? ('：' + clean(reason, 80)) : '') + '——同类操作宜审时度势、勿重蹈覆辙。';
      out.push(makeEnvelope({
        id: id,
        type: 'procedural_lesson',
        body: body,
        sourceRefs: [sourceRef('failedEdict', id, body, { turn: t })],
        status: 'active',
        authority: 'procedural',
        visibility: 'internal',
        turn: Number(t || turn || 0),
        lane: 'L5_advisory_context',
        reason: 'projection:failed_edict_lesson',
        confidence: 0.6,
        factStatus: 'procedural_advice',
        role: 'procedural',
        extra: { importance: 4, trigger: 'failed_edict' }
      }));
    }
    (Array.isArray(GM.activeEdicts) ? GM.activeEdicts.slice(-30) : []).forEach(function(e, i) {
      if (!e) return;
      var s = String(e.status || '').toLowerCase();
      if (!_FAILED_EDICT_STATUS[s]) return;
      emit(e.name || e.title, s, e.reason || e.feedback, e.endedTurn || e.startedTurn || e.turn, 'failed-edict-a-' + (e.id || i));
    });
    (Array.isArray(GM._edictTracker) ? GM._edictTracker.slice(-30) : []).forEach(function(e, i) {
      if (!e) return;
      var s = String(e.status || '').toLowerCase();
      if (!_FAILED_EDICT_STATUS[s]) return;
      emit(e.content || e.title, s, e.reason || e.feedback, e.turn, 'failed-edict-t-' + (e.id || i));
    });
  }

  function pushPersonalOriginalEnvelopes(out, GM, opts, turn) {
    var lc = root.TM && root.TM.LiveContext;
    if (!lc || !GM) return;
    var actorScope = opts.actorScope || {}, name = opts.actorId || opts.actorName || actorScope.npcId;
    var system = opts.audience === 'system' || actorScope.kind === 'system';
    if (!name && !system) return;
    var query = String(opts.query || opts.topic || '');
    if (!query && system) query = JSON.stringify(GM.edicts || {}) + ' ' + (GM._edictTracker || []).filter(function(e){return e&&e.turn===GM.turn;}).map(function(e){return e.content;}).join(' ');
    var chars = (GM.chars || []).filter(function(ch){return ch && (name ? ch.id===name || ch.name===name : query.indexOf(ch.name)>=0 || GM._npcCommitments && (GM._npcCommitments[ch.name]||[]).some(function(c){return c&&c.status!=='completed';}));});
    chars.slice(0,12).forEach(function(ch){
      lc.recall(GM,ch,query,6).forEach(function(m){
        var id=m.id || 'npc-original-'+hashText(ch.name+':'+m.turn+':'+m.event);
        var unverified=m.factStatus==='unverified_claim'||m.source==='reported'||m.source==='rumor';
        var body=ch.name+'：'+(unverified?'[个人报告，尚未核实] ':'[个人历史记录] ')+String(m.event||'');
        out.push(makeEnvelope({id:id,type:'character_memory',body:body,maxBody:1800,
          sourceRefs:[sourceRef('npcPersonalMemory',id,m.event,{turn:m.turn})],basisRefs:m.sourceRefs||[],
          authority:unverified?'court_report':'event_log',visibility:'npc_private:'+(ch.id||ch.name),
          audience:[ch.id||ch.name,ch.name,'system'],ownerKind:'character',ownerId:ch.id||ch.name,
          status:'active',turn:m.turn,entities:[ch.id||ch.name,ch.name],lane:'L6_retrieved_evidence',
          factStatus:unverified?'unverified_claim':'personal_historical_record',confidence:unverified?.55:.8,
          reason:'projection:personal_original',extra:{taskId:m.taskId||'',importance:m.importance||5}}));
      });
    });
  }

  function collect(GM, opts) {
    opts = opts || {};
    var out = [];
    var turn = Number((GM && GM.turn) || opts.turn || 0);
    pushCharacterEnvelopes(out, GM, turn);
    pushEdictEnvelopes(out, GM, turn);
    pushCommitmentEnvelopes(out, GM, opts, turn);
    pushIssueEnvelopes(out, GM, turn);
    pushQijuEnvelopes(out, GM, turn);
    pushJishiEnvelopes(out, GM, turn);
    pushCourtRecordEnvelopes(out, GM, turn);
    pushNpcRelationEventEnvelopes(out, GM, turn);
    pushBiannianEnvelopes(out, GM, turn);
    pushYearlyChronicleEnvelopes(out, GM, turn);
    pushChronicleTrackEnvelopes(out, GM, turn);
    pushChronicleSystemEnvelopes(out, GM, turn);
    pushTurnArchiveEnvelopes(out, GM, turn);
    pushTurnRollupEnvelopes(out, GM, turn);
    pushProceduralLessonEnvelopes(out, GM, turn);
    pushFailedEdictLessonEnvelopes(out, GM, turn);
    pushNarrativeEnvelopes(out, GM);
    pushMemoryArchiveEnvelopes(out, GM, turn);
    pushPlayerDecisionEnvelopes(out, GM, turn);
    pushCharacterArcEnvelopes(out, GM, turn);
    pushAcceptedMemoryEnvelopes(out, GM, turn);
    pushCharacterStanceEnvelopes(out, GM, turn);
    pushPersonalOriginalEnvelopes(out, GM, opts, turn);
    if (root.TM.MemoryLongTerm && root.TM.MemoryLongTerm.project) out = out.concat(root.TM.MemoryLongTerm.project(GM));
    out.forEach(function(env) {
      if (!GM) return;
      if (!env.worldId) env.worldId = clean(GM.worldId || GM._worldId || GM.scenarioId || GM.scenarioKey, 128);
      if (!env.saveId) env.saveId = clean(GM.saveId || GM._saveId || GM.runId || GM.campaignId || GM._campaignId, 128);
      if (!env.campaignId) env.campaignId = clean(GM.campaignId || GM._campaignId, 128);
      if (!env.timelineId) env.timelineId = clean(GM.timelineId || GM._timelineId, 128);
    });
    return dedupe(out);
  }

  ns.hashText = hashText;
  ns.imperialEdictRecord = imperialEdictRecord;
  ns.sourceRef = sourceRef;
  ns.makeEnvelope = makeEnvelope;
  ns.collect = collect;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
