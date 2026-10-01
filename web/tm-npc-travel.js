// Local meeting travel. It stores plans/messages in the existing NPC ledger;
// _travel* remains the shared physical movement state used by office travel.
(function (root) {
  'use strict';
  var TM = root.TM = root.TM || {}, NPC = TM.NPC = TM.NPC || {};
  var config = Object.freeze({ responseDays: 30, defaultWindowDays: 3, defaultDurationDays: 1, defaultMode: 'land', maxDistanceDays: 365 });
  function D() { return NPC.DailyActivities; }
  function L() { return NPC.ActionLedger; }
  function G() { return root.GM; }
  function rows(v) { return Array.isArray(v) ? v : []; }
  function text(v) { return String(v == null ? '' : v).trim(); }
  function copy(v) { return v == null ? v : JSON.parse(JSON.stringify(v)); }
  function id(v) { return text(v && v.id); }
  function person(key) { return D().person(key, G()); }
  function day() { return D().day(G()); }
  function result(outcome, reason, refs, extra) { return L().result(outcome, reason, refs, extra); }
  function map() { return G() && (G().mapData || G().map); }
  function route(from, to, mode) {
    return root.TM && TM.MapRouteDays && TM.MapRouteDays.planRoute ? TM.MapRouteDays.planRoute(map(), from, to, { mode: mode || config.defaultMode }) : { status: 'blocked', reason: 'route_service_unavailable' };
  }
  function locationName(regionId) {
    var r = TM.MapRouteDays && TM.MapRouteDays.resolveRegion && TM.MapRouteDays.resolveRegion(map(), regionId);
    return r && r.region ? r.region.name || r.region.id : String(regionId || '');
  }
  function currentRegion(ch) { return D().exactLocation(ch, G()); }
  function alive(ch) { return !!ch && ch.alive !== false && ch.dead !== true; }
  function plan(idValue) { return D().get(idValue, G()); }
  function isMeeting(p) { return !!(p && p.localActivity && p.localActivity.kind === 'meeting'); }
  function terminal(p) { return /^(done|rejected|cancelled|expired|missed)$/.test(p.status); }
  function signature(v) { return TM.PoliticalActions && TM.PoliticalActions.signature ? TM.PoliticalActions.signature(v) : JSON.stringify(v); }
  function nextId() { return 'daily-message:' + (++L().state(G()).sequence); }
  function participant(p, key) { return p.actorId === key || p.targetId === key; }
  function remember(ch, other, p, source, content, factStatus) {
    if (!ch || !root.NpcMemorySystem) return;
    root.NpcMemorySystem.remember(ch.name, content, '平', 4, other && other.name || '', {
      characterId: id(ch), _noMirror: true, relationshipHandled: true, sourceId: source, taskId: p.id,
      type: 'meeting', source: 'witnessed', factStatus: factStatus || 'personal_experience',
      sourceRefs: [{ kind: 'meeting_step', planId: p.id, id: source }]
    });
  }
  function step(p, actor, d, outcome, reason) {
    var before = p.localActivity.revision;
    p.localActivity.revision++; p.updatedTurn = G().turn;
    var row = { id: d.actionId + ':' + d.phase, actionId: d.actionId, phase: d.phase, actorId: id(actor),
      beforeRevision: before, afterRevision: p.localActivity.revision, inputHash: signature({ actionId: d.actionId, phase: d.phase, actorId: id(actor), response: d.response, meeting: d.meeting }),
      day: day(), termsVersion: p.localActivity.termsVersion };
    p.steps.push(row);
    return result(outcome, reason, [{ kind: 'meeting_step', id: row.id, planId: p.id }], { planId: p.id, activityKind: 'meeting', revision: p.localActivity.revision });
  }
  function informedMessage(p, from, to, kind, content, data, delivery) {
    var m = { id: nextId(), sourceId: p.id, actionId: data.actionId, phase: data.phase, fromId: id(from), toId: id(to), kind: kind,
      content: content, data: copy(data), channel: 'travel', sentTurn: G().turn, sentDay: day(), deliveryDay: delivery.day,
      deliveryRegionId: delivery.regionId, status: 'in_transit', termsVersion: p.localActivity.termsVersion };
    p.messages.push(m); p.status = 'in_transit'; p.nextActorId = ''; p.nextTurn = G().turn;
    p.knowledge[id(from)] = { stage: 'sent', lastMessageId: m.id, termsVersion: p.localActivity.termsVersion };
    remember(from, to, p, m.id, '向' + to.name + '发出约见邀约：' + content, 'personal_experience');
    return m;
  }
  function deliver(p, m) {
    var to = person(m.toId), from = person(m.fromId);
    if (!alive(to) || !m.deliveryRegionId || currentRegion(to) !== m.deliveryRegionId) return false;
    m.status = 'delivered'; m.deliveredDay = day(); m.deliveredTurn = G().turn;
    m.deliveryRef = { id: 'travel-delivery:' + m.id, sourceMessageId: m.id, fromId: m.fromId, toId: m.toId, termsVersion: m.termsVersion };
    p.knowledge[m.toId] = { stage: 'delivered', lastMessageId: m.id, termsVersion: m.termsVersion };
    remember(to, from, p, m.id, '收到' + (from && from.name || '来人') + '的约见文书：' + m.content, 'received_claim');
    if (m.kind === 'meeting_request') { p.status = 'awaiting_response'; p.nextActorId = p.targetId; p.nextTurn = G().turn; }
    if (m.kind === 'meeting_response' && /^(in_transit|awaiting_response|deferred)$/.test(p.status)) { p.status = m.data.response === 'accept' ? 'scheduled' : m.data.response === 'defer' ? 'deferred' : 'rejected'; p.nextActorId = ''; }
    return true;
  }
  function knownTargetLocation(actor, target, requested) {
    var explicit = text(requested && (requested.regionId || requested.locationId));
    if (explicit) return TM.MapRouteDays.resolveRegion(map(), explicit).status === 'resolved' ? explicit : '';
    if (target.locationPublic === false || target._locationSecret || target.visibility === 'private' || target.visibility === 'secret') return '';
    return currentRegion(target) || '';
  }
  function buildJourney(ch, targetRegionId, mode, role, p) {
    var from = currentRegion(ch); if (!from) return { status: 'unresolved', reason: 'current_location_unknown' };
    var r = route(from, targetRegionId, mode); if (r.status !== 'reachable' || r.days > config.maxDistanceDays) return { status: r.status, reason: r.reason || 'route_unavailable', route: r };
    return { role: role, status: String(from) === String(targetRegionId) ? 'arrived' : 'ready', fromRegionId: from, toRegionId: targetRegionId,
      fromName: locationName(from), toName: locationName(targetRegionId), route: copy(r), expectedDays: r.days, elapsedDays: 0, startedDay: null, arrivedDay: String(from) === String(targetRegionId) ? day() : null, planId: p.id };
  }
  function markTravel(ch, journey, p) {
    if (journey.status !== 'ready') return true;
    if (ch._travelTo || ch._travel && ch._travel.status === 'traveling' || ch._enRouteToOffice) return false;
    delete ch._travelPaused;
    ch._travelFrom = journey.fromName; ch._travelTo = journey.toName; ch._travelStartTurn = G().turn;
    ch._travelRemainingDays = Math.max(0, Math.ceil(journey.expectedDays)); ch._travelExpectedDays = journey.expectedDays;
    ch._travelReason = 'local-meeting:' + p.id + ':' + journey.role;
    ch._localTravelRef = { planId: p.id, role: journey.role, toRegionId: journey.toRegionId, routeVersion: journey.route.routeVersion };
    journey.status = journey.expectedDays > 0 ? 'in_transit' : 'arrived'; journey.startedDay = day();
    if (journey.status === 'arrived') { journey.arrivedDay = day(); delete ch._localTravelRef; }
    return true;
  }
  function beforeTravelAdvance() {
    var currentVersion = TM.MapRouteDays && TM.MapRouteDays.routeVersion ? TM.MapRouteDays.routeVersion(map()) : '';
    rows(G()._npcPlans).filter(isMeeting).forEach(function (p) {
      var m = p.localActivity.meeting;
      if (m.status !== 'traveling' || !currentVersion) return;
      var journeys = [m.actorJourney, m.targetJourney].filter(Boolean), blocked = journeys.some(function (j) {
        return j.status === 'in_transit' && j.route && String(j.route.routeVersion) !== String(currentVersion);
      });
      if (!blocked) return;
      m.status = 'roadblocked'; p.status = 'waiting_route'; p.nextActorId = '';
      m.roadblock = { day: day(), previousRouteVersion: journeys[0] && journeys[0].route && journeys[0].route.routeVersion || '', routeVersion: currentVersion, action: 'paused' };
      journeys.forEach(function (j) {
        if (j.status !== 'in_transit') return;
        var ch = person(/^actor/.test(j.role) ? p.actorId : p.targetId);
        if (ch) ch._travelPaused = true;
      });
    });
  }
  function syncJourneys(p) {
    var a = p.localActivity, all = [a.meeting.actorJourney, a.meeting.targetJourney, a.meeting.actorReturnJourney, a.meeting.targetReturnJourney].filter(Boolean);
    all.forEach(function (j) {
      var ch = person(/^actor/.test(j.role) ? p.actorId : p.targetId); if (!ch || !alive(ch)) { j.status = 'unavailable'; return; }
      var ref = ch._localTravelRef;
      if (j.status === 'in_transit' && (!ref || ref.planId !== p.id || ch._travelTo)) return;
      if ((j.status === 'in_transit' || j.status === 'ready') && currentRegion(ch) === j.toRegionId) { j.status = 'arrived'; j.arrivedDay = day(); delete ch._localTravelRef; }
      if (j.status === 'arrived' && a.meeting.status === 'returning' && currentRegion(ch) === j.toRegionId) j.status = 'returned';
    });
  }
  function completeMeeting(p) {
    var a = p.localActivity, m = a.meeting;
    if (m.participation) return;
    m.status = 'participated'; m.participation = { id: 'meeting:' + p.id, startDay: day(), endDay: day() + m.durationDays, participants: [p.actorId, p.targetId], locationId: m.locationId, purpose: m.purpose, sourcePlanId: p.id };
    p.status = m.returnMode === 'return' ? 'returning' : 'done'; p.nextActorId = '';
    var actor = person(p.actorId), target = person(p.targetId);
    remember(actor, target, p, m.participation.id, '与' + target.name + '在' + m.locationName + '实际会面，议题：' + m.purpose, 'personal_experience');
    remember(target, actor, p, m.participation.id + ':target', '与' + actor.name + '在' + m.locationName + '实际会面，议题：' + m.purpose, 'personal_experience');
    if (root.OpinionSystem) root.OpinionSystem.addEventOpinion(actor, target, 1, '实际约见已完成', { sourceId: m.participation.id });
    if (m.returnMode === 'return') {
      m.status = 'returning';
      m.actorJourney = buildJourney(actor, m.actorHomeRegionId, m.mode, 'actor_return', p);
      m.targetJourney = buildJourney(target, m.targetHomeRegionId, m.mode, 'target_return', p);
      m.actorJourney.role = 'actor_return'; m.targetJourney.role = 'target_return';
      if (m.actorJourney.status === 'unresolved' || m.targetJourney.status === 'unresolved') { m.status = 'staying'; p.status = 'done'; return; }
      markTravel(actor, m.actorJourney, p); markTravel(target, m.targetJourney, p);
    }
  }
  function startScheduled(p) {
    var a = p.localActivity, m = a.meeting, actor = person(p.actorId), target = person(p.targetId);
    if (!alive(actor) || !alive(target)) { p.status = 'cancelled'; m.status = 'participant_unavailable'; return false; }
    m.actorJourney = buildJourney(actor, m.locationId, m.mode, 'actor', p); m.targetJourney = buildJourney(target, m.locationId, m.mode, 'target', p);
    if (m.actorJourney.status === 'unresolved' || m.targetJourney.status === 'unresolved') { p.status = 'waiting_route'; m.status = 'route_unavailable'; return false; }
    m.status = 'traveling'; p.status = 'traveling'; m.startDay = Math.max(day(), m.requestedStartDay);
    m.actorHomeRegionId = m.actorJourney.fromRegionId; m.targetHomeRegionId = m.targetJourney.fromRegionId;
    var actorStarted = markTravel(actor, m.actorJourney, p), targetStarted = markTravel(target, m.targetJourney, p);
    if (!actorStarted || !targetStarted) { m.status = 'schedule_conflict'; p.status = 'waiting_route'; return false; }
    syncJourneys(p);
    return true;
  }
  function commit(actor, d) {
    var p = d.planId ? plan(d.planId) : null, key = id(actor), kind = 'meeting';
    if (!p) {
      var target = person(d.targetId); if (!target || target === actor || !alive(target)) return result('blocked', 'meeting_target_unavailable');
      if (!D().knows(actor, target)) return result('blocked', 'meeting_target_not_known');
      var targetRegion = knownTargetLocation(actor, target, d.meeting); if (!targetRegion) return result('blocked', 'meeting_target_location_unknown');
      var fromRegion = currentRegion(actor), inviteRoute = route(fromRegion, targetRegion, d.meeting && d.meeting.mode); if (inviteRoute.status !== 'reachable') return result('blocked', inviteRoute.reason || 'meeting_invite_route_unavailable');
      var locationId = text(d.meeting && (d.meeting.locationId || d.meeting.regionId)) || targetRegion, loc = TM.MapRouteDays.resolveRegion(map(), locationId);
      if (loc.status !== 'resolved') return result('blocked', 'meeting_location_unresolved');
      var meeting = { version: 1, status: 'invitation_in_transit', locationId: locationId, locationName: locationName(locationId), purpose: text(d.meeting && d.meeting.purpose) || '探望与叙谈', mode: text(d.meeting && d.meeting.mode) || config.defaultMode,
        requestedStartDay: Number(d.meeting && d.meeting.requestedStartDay || day() + inviteRoute.days), windowDays: Number(d.meeting && d.meeting.windowDays || config.defaultWindowDays), durationDays: Number(d.meeting && d.meeting.durationDays || config.defaultDurationDays), returnMode: d.meeting && d.meeting.returnMode === 'stay' ? 'stay' : 'return', inviteRoute: copy(inviteRoute), targetKnownRegionId: targetRegion };
      p = { id: 'plan:' + d.actionId, version: 2, type: 'ordinary_interaction', actorId: key, actor: actor.name, targetId: id(target), target: target.name,
        createdTurn: G().turn, updatedTurn: G().turn, progress: 0, intent: '约见与探望', messages: [], steps: [], knowledge: {}, status: 'in_transit', nextActorId: '', nextTurn: G().turn,
        localActivity: { schemaVersion: 1, definitionVersion: 1, kind: kind, revision: 0, termsVersion: 1, createdDay: day(), expiresDay: day() + config.responseDays,
          sourceGoalId: text(d.sourceGoalId), meeting: meeting } };
      L().ensurePlans(G()).push(p);
      var requestPhase = d.phase || 'execute';
      var m = informedMessage(p, actor, target, 'meeting_request', '邀请你于第' + meeting.requestedStartDay + '日前后在' + meeting.locationName + '会面，议题：' + meeting.purpose + '。请按自己的日程决定。', { actionId: d.actionId, phase: requestPhase, purpose: meeting.purpose }, { day: day() + Math.ceil(inviteRoute.days), regionId: targetRegion });
      p.localActivity.revision++;
      p.steps.push({ id: d.actionId + ':' + requestPhase, actionId: d.actionId, phase: requestPhase, actorId: key, beforeRevision: 0, afterRevision: p.localActivity.revision, inputHash: signature(d), day: day(), termsVersion: 1 });
      return result('submitted', '约见邀请已按路线递送，尚待对方收到并回应', [{ kind: 'meeting_step', id: d.actionId + ':' + requestPhase, planId: p.id }], { planId: p.id, activityKind: kind, revision: p.localActivity.revision });
    }
    var a = p.localActivity, m = a.meeting;
    if (!isMeeting(p) || a.definitionVersion !== 1) return result('blocked', 'meeting_definition_requires_migration');
    if (!participant(p, key) || !p.knowledge[key] && key !== p.targetId) return result('blocked', 'meeting_participant_not_informed');
    if (d.expectedRevision != null && d.expectedRevision !== a.revision || d.termsVersion != null && d.termsVersion !== a.termsVersion) return result('expired', 'meeting_or_terms_changed');
    if (d.phase === 'cancel') {
      if (terminal(p)) return result('noop', 'meeting_terminal');
      [m.actorJourney, m.targetJourney].filter(Boolean).forEach(function (j) {
        var ch = person(/^actor/.test(j.role) ? p.actorId : p.targetId);
        if (ch && ch._travelPaused) {
          delete ch._travelPaused; delete ch._travelTo; delete ch._travelFrom; delete ch._travelStartTurn;
          delete ch._travelRemainingDays; delete ch._travelExpectedDays; delete ch._travelReason; delete ch._localTravelRef;
          j.status = 'stopped';
        }
      });
      m.status = 'cancelled'; p.status = 'cancelled'; p.nextActorId = '';
      return step(p, actor, d, 'completed', '约见已取消；已走路程保留，受阻行程在当前地点停止');
    }
    if (p.status !== 'awaiting_response' || key !== p.targetId || d.phase !== 'respond') return result('blocked', 'meeting_response_not_due');
    if (!/^(accept|reject|defer)$/.test(d.response || '')) return result('blocked', 'supported_meeting_response_required');
    var target = person(p.targetId), requester = person(p.actorId), responseRoute = route(currentRegion(target), currentRegion(requester), m.mode);
    if (!responseRoute || responseRoute.status !== 'reachable') return result('blocked', 'meeting_response_route_unavailable');
    if (d.response === 'reject') { m.status = 'rejected'; p.status = 'rejected'; informedMessage(p, target, requester, 'meeting_response', '这次不便赴约，约见暂且作罢。', { actionId: d.actionId, phase: d.phase, response: 'reject' }, { day: day() + Math.ceil(responseRoute.days), regionId: currentRegion(requester) }); return step(p, actor, d, 'completed', '对方拒绝约见'); }
    if (d.response === 'defer') { p.status = 'deferred'; m.status = 'deferred'; m.requestedStartDay += 1; informedMessage(p, target, requester, 'meeting_response', '眼下尚有安排，请改期再议。', { actionId: d.actionId, phase: d.phase, response: 'defer' }, { day: day() + Math.ceil(responseRoute.days), regionId: currentRegion(requester) }); return step(p, actor, d, 'submitted', '对方要求改期，尚未同意出行'); }
    m.targetDecision = { response: 'accept', day: day(), termsVersion: a.termsVersion };
    informedMessage(p, target, requester, 'meeting_response', '愿按当前约期赴约；双方到场后再行会面。', { actionId: d.actionId, phase: d.phase, response: 'accept' }, { day: day() + Math.ceil(responseRoute.days), regionId: currentRegion(requester) });
    var started = startScheduled(p);
    return step(p, actor, d, started ? 'started' : 'waiting', started ? '对方已接受当前约期，双方按程序出发' : '对方已答应，但当前位置或既有行程暂不能安全出发');
  }
  function needsAdvance(g) { return rows(g._npcPlans).some(function (p) { var a = p && p.localActivity; return isMeeting(p) && (!terminal(p) || rows(p.messages).some(function (m) { return m.status === 'in_transit' && m.deliveryDay <= day(); })); }); }
  function advanceWithin() {
    rows(G()._npcPlans).filter(isMeeting).forEach(function (p) {
      var a = p.localActivity, m = a.meeting;
      p.messages.slice().filter(function (x) { return x.status === 'in_transit' && x.deliveryDay <= day(); }).forEach(function (x) { deliver(p, x); });
      if (p.status === 'deferred' && day() >= m.requestedStartDay - 1) { p.status = 'awaiting_response'; p.nextActorId = p.targetId; }
      if (p.status === 'waiting_route' && m.targetDecision && /^(schedule_conflict|route_unavailable)$/.test(m.status)) startScheduled(p);
      syncJourneys(p);
      if (m.actorJourney && (m.actorJourney.status === 'unavailable' || m.targetJourney && m.targetJourney.status === 'unavailable')) { m.status = 'participant_unavailable'; p.status = 'cancelled'; }
      if (m.status === 'traveling' && m.actorJourney && m.targetJourney && m.actorJourney.status === 'arrived' && m.targetJourney.status === 'arrived') {
        if (day() <= m.startDay + m.windowDays) completeMeeting(p); else { m.status = 'missed'; p.status = 'missed'; }
      }
      if (m.status === 'returning') {
        syncJourneys(p);
        if (m.actorJourney.status === 'returned' && m.targetJourney.status === 'returned') { m.status = 'returned'; p.status = 'done'; }
      }
      if (!terminal(p) && day() >= a.expiresDay && p.status === 'in_transit') { p.status = 'expired'; m.status = 'expired'; }
    });
  }
  function view(p, ch) {
    if (!isMeeting(p) || !ch || !p.knowledge[id(ch)] && id(ch) !== p.targetId) return null;
    var m = p.localActivity.meeting, phase = p.status === 'awaiting_response' && id(ch) === p.targetId ? 'respond' : '';
    return { id: p.id, kind: 'meeting', actorId: p.actorId, targetId: p.targetId, intent: p.intent, stage: p.knowledge[id(ch)] && p.knowledge[id(ch)].stage || p.status,
      nextPhase: phase, revision: p.localActivity.revision, termsVersion: p.localActivity.termsVersion, expiresDay: p.localActivity.expiresDay, messages: copy(p.messages.filter(function (x) { return x.fromId === id(ch) || x.toId === id(ch) && x.status === 'delivered'; })), documents: [], contact: null,
      meeting: copy(m), canCancel: !terminal(p), factStatus: 'own_meeting_view' };
  }
  function verifyEvidence(ref, d, actor, g, before) {
    var p = plan(ref.planId), old = before && rows(before._npcPlans).find(function (x) { return x.id === ref.planId; }), row = p && rows(p.steps).find(function (x) { return x.id === ref.id; });
    var ok = !!(p && isMeeting(p) && row && row.actionId === d.actionId && row.phase === d.phase && row.actorId === id(actor) && (!old || !rows(old.steps).some(function (x) { return x.id === ref.id; })) && p.localActivity.revision === row.afterRevision);
    return ok;
  }
  function advanceLocalDays(days) {
    var left = Number(days), advanced = 0, interval;
    if (!(left > 0) || !G() || G().busy || G()._endTurnBusy) return { ok: false, reason: 'world_busy_or_invalid_days' };
    while (left > 0) {
      if (!TM.SimTime || !TM.SimTime.prepare || !TM.SimTime.commit) return { ok: false, reason: 'simulation_clock_unavailable' };
      interval = TM.SimTime.prepare(G());
      if (interval.days > left) return { ok: false, reason: 'local_step_smaller_than_turn_interval' };
      var guards = TM.AIChange && TM.AIChange.WriteGuards;
      if (!guards || typeof guards.runAtomicMutation !== 'function') return { ok: false, reason: 'atomic_writer_unavailable' };
      var receipt = guards.runAtomicMutation(function () {
        G().turn++;
        var clockReceipt = TM.SimTime.commit(G(), interval);
        if (!clockReceipt || clockReceipt.ok !== true) return { ok: false, reason: 'simulation_clock_commit_failed' };
        if (typeof root.advanceCharTravelByDays === 'function') root.advanceCharTravelByDays(interval.days);
        var dailyReceipt = L().advance(G());
        if (!dailyReceipt || dailyReceipt.ok !== true) return { ok: false, reason: dailyReceipt && dailyReceipt.reason || 'daily_travel_advance_failed' };
        return { ok: true, clock: clockReceipt, travel: dailyReceipt };
      });
      if (!receipt || receipt.ok !== true) {
        if (TM.SimTime.discardPrepared) TM.SimTime.discardPrepared(G(), interval);
        return receipt || { ok: false, reason: 'daily_travel_advance_failed' };
      }
      left -= interval.days; advanced += interval.days;
    }
    return { ok: true, advancedDays: advanced, day: day() };
  }
  NPC.Meetings = { config: config, isPlan: isMeeting, commit: commit, beforeTravelAdvance: beforeTravelAdvance, needsAdvance: needsAdvance, advanceWithin: advanceWithin, view: view,
    verifyEvidence: verifyEvidence, advanceLocalDays: advanceLocalDays, afterVerifiedCommit: function (d, receipt) { advanceWithin(); return receipt; } };
})(typeof window !== 'undefined' ? window : globalThis);
