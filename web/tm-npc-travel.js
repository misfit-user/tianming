// Local meeting travel. A meeting uses the existing NPC plans/messages and
// the canonical character location fields. It owns only the physical
// progress of a local meeting journey; office travel keeps its own domain.
(function (root) {
  'use strict';
  var TM = root.TM = root.TM || {}, NPC = TM.NPC = TM.NPC || {};
  var config = Object.freeze({
    responseDays: 30, defaultWindowDays: 3, defaultDurationDays: 1,
    defaultMode: 'land', maxDistanceDays: 365, epsilon: 0.000001
  });
  var advancing = false, activeEvent = null;

  function D() { return NPC.DailyActivities; }
  function L() { return NPC.ActionLedger; }
  function G() { return root.GM; }
  function rows(v) { return Array.isArray(v) ? v : []; }
  function text(v) { return String(v == null ? '' : v).trim(); }
  function key(v) { return text(v); }
  function copy(v) { return v == null ? v : JSON.parse(JSON.stringify(v)); }
  function id(v) { return text(v && v.id); }
  function person(key) { return D() && D().person(key, G()); }
  function day() { return D() ? D().day(G()) : (TM.SimTime ? TM.SimTime.now(G()) : 0); }
  function result(outcome, reason, refs, extra) { return L().result(outcome, reason, refs, extra); }
  function map() { return G() && (G().mapData || G().map); }
  function route(from, to, mode, fresh) {
    return TM.MapRouteDays && TM.MapRouteDays.planRoute ? TM.MapRouteDays.planRoute(map(), from, to, { mode: mode || config.defaultMode, fresh: !!fresh }) : { status: 'blocked', reason: 'route_service_unavailable' };
  }
  function locationName(regionId) {
    var r = TM.MapRouteDays && TM.MapRouteDays.resolveRegion && TM.MapRouteDays.resolveRegion(map(), regionId);
    return r && r.region ? r.region.name || r.region.id : String(regionId || '');
  }
  function currentRegion(ch) { return D() && D().exactLocation ? D().exactLocation(ch, G()) : ''; }
  function alive(ch) { return !!ch && ch.alive !== false && ch.dead !== true; }
  function plan(idValue) { return D() && D().get(idValue, G()); }
  function isMeeting(p) { return !!(p && p.localActivity && p.localActivity.kind === 'meeting' && p.localActivity.meeting); }
  function terminal(p) { return /^(done|ended|rejected|cancelled|expired|missed)$/.test(p && p.status || ''); }
  function signature(v) { return TM.PoliticalActions && TM.PoliticalActions.signature ? TM.PoliticalActions.signature(v) : JSON.stringify(v); }
  function nextId() { return 'daily-message:' + (++L().state(G()).sequence); }
  function participant(p, key) { return p && (p.actorId === key || p.targetId === key); }
  function roleFor(p, key) { return p.actorId === key ? 'actor' : p.targetId === key ? 'target' : ''; }
  function journeyKey(role, returning) { return role + (returning ? 'ReturnJourney' : 'Journey'); }
  function journeyFor(m, role, returning) { return m && m[journeyKey(role, returning)] || null; }
  function setJourney(m, role, returning, value) { m[journeyKey(role, returning)] = value; return value; }
  function charForRole(p, role) { return person(role === 'actor' ? p.actorId : p.targetId); }
  function finiteNonNegative(v) { return Number.isFinite(Number(v)) && Number(v) >= 0; }

  function discussionTopic(m) {
    return m && m.discussion && D() && typeof D().topicInfo === 'function' ? D().topicInfo(m.discussion.topicId) : null;
  }

  function discussionContent(topic, choice, role) {
    if (!topic) return '';
    if (role === 'actor') return choice === 'question' ? topic.questionPrompt : choice === 'counter' ? topic.counter : topic.explain;
    return choice === 'uncertain' ? topic.uncertain : choice === 'counter' ? topic.counter : topic.answer;
  }

  function normalizeDiscussion(actor, spec) {
    spec = spec || {};
    var topic = D() && typeof D().topicInfo === 'function' ? D().topicInfo(spec.topicId) : null;
    if (!topic || !D().consultationBasis) return null;
    var basis = D().consultationBasis({ sourceOpportunity: spec.sourceOpportunity }, actor, G());
    if (!basis || !basis.source) return null;
    return { topicId: topic.id, question: text(spec.question || topic.question), status: 'pending',
      sourceOpportunity: copy(basis.source), sourceRefs: copy(basis.source.basisRefs || []),
      preferredExchange: /^(explain|question|counter)$/.test(text(spec.preferredExchange)) ? text(spec.preferredExchange) : 'explain',
      actorChoice: '', actorContent: '', targetChoice: '', targetContent: '', result: null };
  }

  function officeRows(ch) {
    var office = TM.OfficeTenure;
    if (!office || typeof office.privateTravelDuties !== 'function' || !ch) return { status: 'unknown', reason: 'office_constraint_unavailable', rows: [] };
    return office.privateTravelDuties(G(), ch);
  }

  // A caller supplied office constraint is only a hint about which duty is
  // relevant to the meeting.  It cannot remove another active appointment or
  // weaken its leave requirement.  Returning a structured read also keeps a
  // missing query distinct from a person who genuinely has no appointments.
  function inferredOfficeConstraints(ch, m, role) {
    var read = officeRows(ch);
    if (!read || read.status !== 'resolved') return { status: 'unknown', constraints: [], reason: read && read.reason || 'office_constraint_unavailable' };
    var unidentified = read.rows.find(function (r) { return r.configurationStatus !== 'legacy_unspecified' && (!r.positionId || !r.organizationId); });
    if (unidentified) return { status: 'unknown', constraints: [], reason: 'meeting_office_assignment_identity_unknown', positionId: unidentified.positionId, organizationId: unidentified.organizationId };
    var incomplete = read.rows.find(function (r) { return r.configurationStatus === 'incomplete'; });
    if (incomplete) return { status: 'unknown', constraints: [], reason: 'meeting_office_configuration_incomplete', positionId: incomplete.positionId, organizationId: incomplete.organizationId };
    var location = String(m && m.locationId || '');
    var journey = role && m && m[role + 'Journey'];
    var privateOrigin = journey && journey.fromRegionId || currentRegion(ch);
    var constraints = read.rows.map(function (row) {
      if (!row || !row.positionId || row.configurationStatus === 'legacy_unspecified') return null;
      var outsideResident = row.dutyMode === 'resident' && row.usualDutyLocationId && String(row.usualDutyLocationId) !== location;
      // Field service is not a private travel exemption. A local discussion
      // at the current duty site is possible; a private excursion still needs
      // the position's actual arrangement, even within its public jurisdiction.
      var privateFieldTrip = row.dutyMode === 'field' && (location !== privateOrigin || row.usualDutyLocationId && location !== row.usualDutyLocationId || row.jurisdictionIds.length && row.jurisdictionIds.indexOf(location) < 0);
      if (!outsideResident && !privateFieldTrip) return null;
      return { positionId: row.positionId, organizationId: row.organizationId, requiresLeave: true,
        action: 'private_travel', dutyMode: row.dutyMode, row: row };
    }).filter(Boolean);
    return { status: constraints.length ? 'constrained' : read.rows.some(function (r) { return r.configurationStatus === 'legacy_unspecified'; }) ? 'legacy_unspecified' : 'unconstrained', constraints: constraints, rows: read.rows };
  }

  // Kept as a small compatibility projection for diagnostics and older callers.
  function inferredOfficeConstraint(ch, m) {
    var found = inferredOfficeConstraints(ch, m);
    return found.constraints.length === 1 ? found.constraints[0] : null;
  }

  function routeDays(from, to, mode) {
    if (!from || !to || String(from) === String(to)) return 0;
    var r = route(from, to, mode);
    if (!r || r.status !== 'reachable' || !finiteNonNegative(r.days)) return NaN;
    return Math.max(Number(r.days), rows(r.segments).reduce(function (total, segment) { return total + Number(segment.days || 0); }, 0));
  }

  function leaveSupportsMeeting(row, ch, m, phase, role) {
    var home = row.returnLocationId || row.usualDutyLocationId, from = currentRegion(ch);
    var outbound = routeDays(from, m.locationId, m.mode), back = routeDays(m.locationId, home, m.mode);
    var now = day(), requested = Number(m.requestedStartDay), duration = Number(m.durationDays || 0);
    // If a route cannot be evaluated, the office constraint is unknown rather
    // than an invitation to leave.  Same-location meetings still work.
    if (!home || !from || !Number.isFinite(outbound) || !Number.isFinite(back) || !Number.isFinite(requested) || !Number.isFinite(duration)) return { ok: false, reason: 'meeting_office_return_route_unknown' };
    if (m[role + 'ReturnMode'] === 'stay' && home !== String(m.locationId)) return { ok: false, reason: 'meeting_office_return_arrangement_required' };
    var journey = m[role + 'Journey'], departure = journey && Number.isFinite(journey.startedDay) ? journey.startedDay : now;
    var end = Number.isFinite(m.endDay) && phase === 'onsite' ? m.endDay : Math.max(requested, now + outbound) + duration;
    var latestNeeded = end + back;
    return TM.OfficeTenure.privateTravelPermission({ world: G(), actorId: id(ch), positionId: row.positionId,
      organizationId: row.organizationId, appointmentId: row.appointmentId, destinationId: m.locationId,
      departureDay: departure, returnDay: latestNeeded, returnLocationId: home });
  }

  function officeConstraintCheck(ch, m, role, phase) {
    var office = TM.OfficeTenure, explicit = m && m[role + 'OfficeConstraint'], found = inferredOfficeConstraints(ch, m, role);
    if (found.status === 'unknown') return Object.assign({ ok: false }, found);
    var rows = found.rows || [], constraints = found.constraints.slice();
    // Validate an explicit hint against the actual appointment identity.  It
    // may select an already inferred row, but never erase the inferred rows.
    if (explicit) {
      var matching = rows.filter(function (v) { return String(v.positionId) === String(explicit.positionId) && (!explicit.organizationId || String(v.organizationId) === String(explicit.organizationId)) && (!explicit.appointmentId || v.appointmentId === explicit.appointmentId); });
      if (matching.length !== 1) return { ok: false, status: 'blocked', reason: 'meeting_office_constraint_identity_mismatch' };
    }
    if (!constraints.length) return { ok: true, status: found.status, obligations: [] };
    if (!office || typeof office.privateTravelPermission !== 'function') return { ok: false, status: 'unknown', reason: 'office_constraint_unavailable' };
    var obligations = [];
    for (var i = 0; i < constraints.length; i++) {
      var constraint = constraints[i];
      if (constraint.row.delegationId) return { ok: false, status: 'blocked', reason: 'meeting_office_delegate_duty_conflict', positionId: constraint.positionId, organizationId: constraint.organizationId, delegationId: constraint.row.delegationId };
      if (constraint.requiresLeave) {
        var leave = leaveSupportsMeeting(constraint.row, ch, m, phase, role);
        if (!leave.ok) return Object.assign({ status: 'blocked', positionId: constraint.positionId, positionName: constraint.row.positionName, organizationId: constraint.organizationId }, leave);
        obligations.push({ positionId: constraint.positionId, organizationId: constraint.organizationId, leaveId: leave.leaveId, delegationId: leave.delegationId, returnLocationId: leave.returnLocationId, latestNeeded: leave.latestNeeded });
      }
    }
    return { ok: true, status: 'allowed', obligations: obligations };
  }

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
      beforeRevision: before, afterRevision: p.localActivity.revision,
      inputHash: signature({ actionId: d.actionId, phase: d.phase, actorId: id(actor), response: d.response,
        exchangeChoice: d.exchangeChoice, termsVersion: d.termsVersion, meeting: d.meeting }),
      day: day(), termsVersion: p.localActivity.termsVersion };
    p.steps.push(row);
    return result(outcome, reason, [{ kind: 'meeting_step', id: row.id, planId: p.id }], {
      planId: p.id, activityKind: 'meeting', revision: p.localActivity.revision
    });
  }

  function notifyPlanningOutcome(p, outcome, reason) {
    if (p.localActivity.sourceGoalId && typeof root._npcPlanningStepResult === 'function') {
      root._npcPlanningStepResult(p.actorId, p.localActivity.sourceGoalId, { outcome: outcome, reason: reason,
        planId: p.id, planningOwnerId: p.actorId, verified: false });
    }
  }

  function termsFrom(m) {
    return { locationId: m.venueLocationId || m.locationId, locationName: m.locationName,
      requestedStartDay: m.requestedStartDay, windowDays: m.windowDays, durationDays: m.durationDays,
      purpose: m.purpose, mode: m.mode, version: m.version || 1 };
  }

  function informedMessage(p, from, to, kind, content, data, delivery) {
    data = data || {}; delivery = delivery || {};
    var a = p.localActivity, m = a.meeting;
    var termsVersion = data.termsVersion != null ? data.termsVersion : a.termsVersion;
    var msg = { id: nextId(), sourceId: p.id, actionId: data.actionId, phase: data.phase,
      fromId: id(from), toId: id(to), kind: kind, content: content, data: copy(data), channel: 'travel',
      sentTurn: G().turn, sentDay: day(), deliveryDay: Number(delivery.day), deliveryRegionId: text(delivery.regionId),
      deliveryAddressType: delivery.addressType || 'known_location', status: 'in_transit', termsVersion: termsVersion,
      venueLocationId: m && (m.venueLocationId || m.locationId) || '' };
    if (!Number.isFinite(msg.deliveryDay)) msg.deliveryDay = day();
    p.messages.push(msg);
    p.status = kind === 'meeting_request' ? 'invitation_in_transit' : 'response_in_transit';
    p.nextActorId = ''; p.nextTurn = G().turn;
    p.knowledge[id(from)] = { stage: 'sent', lastMessageId: msg.id, termsVersion: termsVersion };
    remember(from, to, p, msg.id, '向' + (to && to.name || '对方') + '发出约见文书：' + content, 'personal_experience');
    return msg;
  }

  function setOwnKnowledge(p, key, stage, message) {
    p.knowledge[key] = { stage: stage, lastMessageId: message && message.id || '', termsVersion: message && message.termsVersion || p.localActivity.termsVersion };
  }

  function stopJourney(p, role, returning, reason) {
    var j = journeyFor(p.localActivity.meeting, role, returning), ch = charForRole(p, role);
    if (!j || !ch) return false;
    if (j.status === 'in_transit' || j.status === 'ready') {
      j.status = 'stopped'; j.stopDay = day(); j.pauseReason = reason || 'stopped';
      // Keep the stopped journey as the physical fact.  Clearing only the old
      // mirror fields used to make a mid-route character look as if they had
      // returned to the last saved origin.  The segment index/progress remains
      // resumable and the read model can still distinguish a stopped traveller.
      ch._stoppedTravelRef = { journeyId: j.id, currentRegionId: j.currentRegionId || j.fromRegionId || currentRegion(ch) || '',
        segmentIndex: j.segmentIndex || 0, segmentElapsedDays: Number(j.segmentElapsedDays || 0), stoppedDay: day(), reason: reason || 'stopped' };
      if (ch._localTravelRef && ch._localTravelRef.journeyId === j.id) {
        delete ch._localTravelRef; delete ch._travelTo; delete ch._travelRemainingDays;
        delete ch._travelExpectedDays; delete ch._travelReason; delete ch._travelPaused;
      }
      ch._travelCurrentRegionId = ch._stoppedTravelRef.currentRegionId;
      return true;
    }
    return false;
  }

  function routeSegmentAvailable(j) {
    if (!j || !j.route || !Array.isArray(j.route.segments)) return false;
    var currentVersion = TM.MapRouteDays && TM.MapRouteDays.routeVersion ? TM.MapRouteDays.routeVersion(map()) : '';
    if (!currentVersion || String(currentVersion) === String(j.route.routeVersion)) return true;
    function edges(region) {
      var out = rows(region && region.routeEdges).map(function (e) { return Object.assign({}, e, { from: e.from || region.id }); });
      if (Array.isArray(map() && map().routeEdges)) out = out.concat(map().routeEdges.filter(function (e) { return e && String(e.from || '') === String(region && region.id); }));
      if (!out.length) out = rows(region && region.neighbors).map(function (v) { return { to: v, mode: 'land' }; });
      return out;
    }
    for (var i = j.segmentIndex || 0; i < j.route.segments.length; i++) {
      var seg = j.route.segments[i], rr = TM.MapRouteDays.resolveRegion(map(), seg.fromRegionId);
      if (!rr || rr.status !== 'resolved') return false;
      var found = edges(rr.region).some(function (e) {
        var to = e.to != null ? e.to : e.target != null ? e.target : e.regionId;
        if (String(to) !== String(seg.toRegionId) || e.available === false) return false;
        var mode = String(e.mode || e.transport || e.kind || 'land').toLowerCase();
        return !seg.mode || mode === String(seg.mode).toLowerCase() || (mode === 'land' && ['walking', 'horse', 'courier', 'land'].indexOf(String(seg.mode).toLowerCase()) >= 0);
      });
      if (!found) return false;
    }
    j.route.routeVersion = currentVersion;
    return true;
  }

  function projectJourney(ch, j, p) {
    if (!ch || !j || j.status !== 'in_transit') return;
    ch._travelFrom = locationName(j.fromRegionId);
    ch._travelTo = locationName(j.toRegionId);
    ch._travelCurrentRegionId = j.currentRegionId || j.fromRegionId;
    ch._travelStartTurn = j.startedTurn;
    ch._travelRemainingDays = Math.max(0, Number(j.remainingDays || 0));
    ch._travelExpectedDays = Number(j.expectedDays || 0);
    ch._travelElapsedDays = Number(j.elapsedDays || 0);
    ch._travelReason = 'local-meeting:' + p.id + ':' + j.role + ':' + j.phase;
    ch._localTravelRef = { planId: p.id, journeyId: j.id, role: j.role, phase: j.phase, toRegionId: j.toRegionId, routeVersion: j.route.routeVersion };
  }

  function buildJourney(ch, targetRegionId, mode, role, p, phase) {
    var from = currentRegion(ch), resolved = TM.MapRouteDays.resolveRegion(map(), targetRegionId);
    var base = { id: 'journey:' + p.id + ':' + role + ':' + (phase || 'outbound'), role: role, phase: phase || 'outbound' };
    if (!from) return Object.assign(base, { status: 'unresolved', reason: 'current_location_unknown' });
    if (!resolved || resolved.status !== 'resolved') return Object.assign(base, { status: resolved && resolved.status || 'unresolved', reason: resolved && resolved.reason || 'destination_unresolved' });
    var to = String(resolved.region.id), r = route(from, to, mode);
    var j = Object.assign(base, { status: 'ready', fromRegionId: String(from), toRegionId: to, currentRegionId: String(from),
      fromName: locationName(from), toName: locationName(to), route: copy(r), expectedDays: Number(r.days),
      elapsedDays: 0, remainingDays: Number(r.days), segmentIndex: 0, segmentElapsedDays: 0,
      startedDay: null, startedTurn: null, lastAdvancedDay: null, arrivedDay: null, planId: p.id });
    if (r.status !== 'reachable' || !finiteNonNegative(r.days) || Number(r.days) > config.maxDistanceDays) {
      j.status = r.status || 'blocked'; j.reason = r.reason || 'route_unavailable'; return j;
    }
    if (String(from) === to || Number(r.days) <= config.epsilon) {
      j.status = 'arrived'; j.arrivedDay = day(); j.remainingDays = 0;
    }
    return j;
  }

  function markTravel(ch, journey, p, startAt) {
    if (!journey || !ch) return false;
    if (journey.status === 'arrived') return true;
    if (journey.status !== 'ready') return false;
    if (ch._localTravelRef && ch._localTravelRef.journeyId !== journey.id) return false;
    if (ch._enRouteToOffice || ch._travelTo && !ch._localTravelRef) return false;
    var startDay = Number.isFinite(Number(startAt)) ? Number(startAt) : day();
    journey.status = 'in_transit'; journey.startedDay = startDay; journey.startedTurn = G().turn; journey.lastAdvancedDay = startDay;
    projectJourney(ch, journey, p);
    return true;
  }

  function startJourneyFor(p, role, reason, startAt) {
    var a = p.localActivity, m = a.meeting, ch = charForRole(p, role), returning = /^return$/.test(reason || '');
    if (!alive(ch)) { m[role + 'JourneyStatus'] = 'participant_unavailable'; return false; }
    if (!returning) {
      var officeCheck = officeConstraintCheck(ch, m, role, 'depart');
      if (!officeCheck.ok) { m[role + 'JourneyStatus'] = officeCheck.reason; return false; }
      var returnPlaces = rows(officeCheck.obligations).map(function (v) { return v.returnLocationId; }).filter(Boolean);
      if (returnPlaces.some(function (v) { return v !== returnPlaces[0]; })) { m[role + 'JourneyStatus'] = 'meeting_office_return_locations_conflict'; return false; }
      if (returnPlaces.length) m[role + 'HomeRegionId'] = returnPlaces[0];
    }
    var existing = journeyFor(m, role, returning);
    if (existing && /^(in_transit|arrived|stopped|returned|staying)$/.test(existing.status)) return /^(in_transit|arrived|returned|staying)$/.test(existing.status);
    var destination = returning ? m[role + 'HomeRegionId'] : (m.venueLocationId || m.locationId);
    if (!destination) { m[role + 'JourneyStatus'] = 'unresolved'; return false; }
    if (!returning) m[role + 'HomeRegionId'] = m[role + 'HomeRegionId'] || currentRegion(ch);
    var j = buildJourney(ch, destination, m.mode, role, p, returning ? 'return' : 'outbound');
    setJourney(m, role, returning, j);
    if (j.status === 'unresolved' || j.status === 'unreachable' || j.status === 'blocked') { m[role + 'JourneyStatus'] = j.status; return false; }
    if (j.status === 'arrived') { m[role + 'JourneyStatus'] = 'arrived'; return true; }
    var started = markTravel(ch, j, p, startAt); m[role + 'JourneyStatus'] = started ? 'in_transit' : 'schedule_conflict';
    if (!started) { j.status = 'blocked'; j.reason = 'schedule_conflict'; }
    return started;
  }

  function actorResponseKnown(p) {
    var m = p.localActivity.meeting, k = p.knowledge[p.actorId];
    return !!(m.actorResponseDelivered && k && k.termsVersion === p.localActivity.termsVersion);
  }

  function aggregateStatus(p) {
    var m = p.localActivity.meeting;
    if (/^(in_meeting|participated|ended|returning|returned|cancelled|missed|rejected)$/.test(m.status || '')) return;
    if (/^(roadblocked|return_route_unavailable)$/.test(m.status || '')) return;
    if (m.status === 'deferred') { p.status = 'awaiting_reschedule'; return; }
    var aj = m.actorJourney, tj = m.targetJourney;
    if (actorResponseKnown(p) && (!aj || /^(blocked|ready|unresolved|unreachable)$/.test(aj.status))) { p.status = 'waiting_departure'; m.status = 'scheduled'; p.nextActorId = p.actorId; return; }
    if (m.targetDecision && m.targetDecision.response === 'accept' && (!tj || /^(blocked|ready|unresolved|unreachable)$/.test(tj.status))) { p.nextActorId = p.targetId; }
    if (aj && aj.status === 'in_transit' || tj && tj.status === 'in_transit') { p.status = 'traveling'; m.status = 'traveling'; return; }
    if (actorResponseKnown(p) && m.actorDeparturePolicy === 'manual' && (!aj || !/^(in_transit|arrived)$/.test(aj.status))) { p.status = 'waiting_departure'; m.status = 'scheduled'; return; }
    if (m.targetDecision && !actorResponseKnown(p)) { p.status = 'response_in_transit'; m.status = 'response_in_transit'; return; }
    if (aj && tj && aj.status === 'arrived' && tj.status === 'arrived') { p.status = 'arrived_waiting'; m.status = 'arrived_waiting'; return; }
    if (m.targetDecision && (!aj || aj.status === 'ready') && (!tj || tj.status === 'ready')) { p.status = 'scheduled'; m.status = 'scheduled'; }
  }

  function revalidateJourney(p, role, returning) {
    var m = p.localActivity.meeting, j = journeyFor(m, role, returning), ch = charForRole(p, role);
    if (!j || j.status !== 'in_transit') return true;
    if (routeSegmentAvailable(j)) return true;
    j.status = 'blocked'; j.pauseReason = 'route_changed'; j.blockedDay = day();
    if (ch && ch._localTravelRef && ch._localTravelRef.journeyId === j.id) ch._travelPaused = true;
    m.status = returning ? 'return_route_unavailable' : 'roadblocked';
    m.roadblock = { day: day(), role: role, journeyId: j.id, action: 'paused', reason: 'current_route_segment_unavailable' };
    p.status = 'waiting_route';
    return false;
  }

  function advanceJourney(p, role, returning, now) {
    var m = p.localActivity.meeting, j = journeyFor(m, role, returning), ch = charForRole(p, role);
    if (!j || !ch || j.status !== 'in_transit') return false;
    if (!j.route || !Array.isArray(j.route.segments)) {
      j.status = 'blocked'; j.pauseReason = 'journey_route_missing';
      m.status = returning ? 'return_route_unavailable' : 'roadblocked'; p.status = 'waiting_route';
      return false;
    }
    if (!revalidateJourney(p, role, returning)) return false;
    var last = Number(j.lastAdvancedDay); if (!Number.isFinite(last)) last = Number(j.startedDay); if (!Number.isFinite(last)) last = now;
    var left = Math.max(0, now - last); if (!(left > config.epsilon)) return false;
    j.lastAdvancedDay = now;
    while (left > config.epsilon && j.status === 'in_transit') {
      var seg = rows(j.route.segments)[j.segmentIndex];
      if (!seg) { j.status = 'arrived'; j.arrivedDay = Number(j.startedDay) + Number(j.expectedDays || 0); j.currentRegionId = j.toRegionId; j.remainingDays = 0; break; }
      var segmentDays = Math.max(config.epsilon, Number(seg.days) || 0), rem = Math.max(0, segmentDays - Number(j.segmentElapsedDays || 0)), used = Math.min(left, rem);
      j.segmentElapsedDays = Number(j.segmentElapsedDays || 0) + used; j.elapsedDays = Number(j.elapsedDays || 0) + used; j.remainingDays = Math.max(0, Number(j.expectedDays) - j.elapsedDays); left -= used;
      if (j.segmentElapsedDays + config.epsilon >= segmentDays) {
        j.currentRegionId = seg.toRegionId; j.segmentIndex++; j.segmentElapsedDays = 0;
        ch.location = locationName(j.currentRegionId); ch.regionId = j.currentRegionId; ch.mapRegionId = j.currentRegionId;
        if (j.segmentIndex >= rows(j.route.segments).length) { j.status = 'arrived'; j.arrivedDay = Number(j.startedDay) + Number(j.expectedDays || 0); j.remainingDays = 0; }
      }
    }
    if (j.status === 'arrived') {
      ch._travelCurrentRegionId = j.toRegionId;
      if (ch._localTravelRef && ch._localTravelRef.journeyId === j.id) {
        delete ch._localTravelRef; delete ch._travelTo; delete ch._travelRemainingDays; delete ch._travelExpectedDays; delete ch._travelReason; delete ch._travelPaused;
      }
    } else projectJourney(ch, j, p);
    return true;
  }

  // Shared physical travel adapter for non-meeting activities (currently
  // office leave/return).  It deliberately lives in this module so there is
  // one route planner, one segment progress model and one set of location
  // mirrors.  The office-tenure layer only owns the purpose and permissions.
  function projectExternalJourney(ch, j) {
    if (!ch || !j || j.status !== 'in_transit') return;
    ch._travelFrom = locationName(j.fromRegionId); ch._travelTo = locationName(j.toRegionId);
    ch._travelCurrentRegionId = j.currentRegionId || j.fromRegionId;
    ch._travelStartTurn = j.startedTurn; ch._travelRemainingDays = Math.max(0, Number(j.remainingDays || 0));
    ch._travelExpectedDays = Number(j.expectedDays || 0); ch._travelElapsedDays = Number(j.elapsedDays || 0);
    ch._travelReason = 'external:' + (j.planId || j.id); ch._localTravelRef = { planId: j.planId || '', journeyId: j.id, role: 'external', phase: j.phase, toRegionId: j.toRegionId, routeVersion: j.route && j.route.routeVersion };
  }
  function externalJourney(ch) { return ch && ch._officeJourney || null; }
  function buildExternalJourney(ch, opts) {
    opts = opts || {}; var from = currentRegion(ch), target = key(opts.toRegionId), resolved = TM.MapRouteDays && TM.MapRouteDays.resolveRegion ? TM.MapRouteDays.resolveRegion(map(), target) : null;
    var base = { id: key(opts.journeyId) || 'journey:external:' + Date.now(), role: 'external', phase: opts.phase || 'outbound', planId: key(opts.planId), purpose: key(opts.purpose), status: 'ready' };
    if (!from) return Object.assign(base, { status: 'unresolved', reason: 'current_location_unknown' });
    if (!resolved || resolved.status !== 'resolved') return Object.assign(base, { status: resolved && resolved.status || 'unresolved', reason: resolved && resolved.reason || 'destination_unresolved' });
    var to = String(resolved.region.id), r = route(from, to, opts.mode || config.defaultMode);
    var j = Object.assign(base, { fromRegionId: String(from), toRegionId: to, currentRegionId: String(from), fromName: locationName(from), toName: locationName(to),
      route: copy(r), expectedDays: Number(r && r.days), elapsedDays: 0, remainingDays: Number(r && r.days), segmentIndex: 0, segmentElapsedDays: 0,
      startedDay: null, startedTurn: null, lastAdvancedDay: null, arrivedDay: null, history: [] });
    if (!r || r.status !== 'reachable' || !finiteNonNegative(r.days) || Number(r.days) > config.maxDistanceDays) { j.status = r && r.status || 'blocked'; j.reason = r && r.reason || 'route_unavailable'; return j; }
    if (String(from) === to || Number(r.days) <= config.epsilon) { j.status = 'arrived'; j.arrivedDay = day(); j.remainingDays = 0; }
    return j;
  }
  function startExternalJourney(ch, opts) {
    opts = opts || {}; if (!ch) return { status: 'blocked', reason: 'character_unavailable' };
    var existing = externalJourney(ch);
    if (existing && existing.status === 'in_transit') return existing;
    if (existing && existing.status === 'stopped' && String(existing.toRegionId) === String(opts.toRegionId)) {
      existing.status = 'in_transit'; existing.pauseReason = ''; existing.startedDay = existing.startedDay == null ? (Number.isFinite(Number(opts.startAt)) ? Number(opts.startAt) : day()) : existing.startedDay;
      existing.lastAdvancedDay = Number.isFinite(Number(opts.startAt)) ? Number(opts.startAt) : day(); projectExternalJourney(ch, existing); return existing;
    }
    if (ch._localTravelRef && ch._localTravelRef.role !== 'external') return { status: 'blocked', reason: 'schedule_conflict_with_existing_travel' };
    var j = buildExternalJourney(ch, opts); ch._officeJourney = j;
    if (j.status === 'unresolved' || j.status === 'unreachable' || j.status === 'blocked') return j;
    if (j.status === 'arrived') { ch._travelCurrentRegionId = j.toRegionId; ch.location = locationName(j.toRegionId); ch.regionId = j.toRegionId; ch.mapRegionId = j.toRegionId; return j; }
    var startAt = Number.isFinite(Number(opts.startAt)) ? Number(opts.startAt) : day();
    j.status = 'in_transit'; j.startedDay = startAt; j.startedTurn = G().turn; j.lastAdvancedDay = startAt; projectExternalJourney(ch, j); return j;
  }
  function stopExternalJourney(ch, reason) {
    var j = externalJourney(ch); if (!j || !/^(in_transit|ready)$/.test(j.status)) return { ok: false, reason: 'external_journey_not_active' };
    j.status = 'stopped'; j.stopDay = day(); j.pauseReason = reason || 'stopped'; ch._stoppedTravelRef = { journeyId: j.id, currentRegionId: j.currentRegionId, segmentIndex: j.segmentIndex || 0, segmentElapsedDays: Number(j.segmentElapsedDays || 0), stoppedDay: day(), reason: j.pauseReason };
    if (ch._localTravelRef && ch._localTravelRef.journeyId === j.id) delete ch._localTravelRef;
    delete ch._travelTo; delete ch._travelRemainingDays; delete ch._travelExpectedDays; delete ch._travelReason; delete ch._travelPaused;
    ch._travelCurrentRegionId = j.currentRegionId || currentRegion(ch); return { ok: true, journey: j };
  }
  function advanceExternalJourney(ch, now) {
    var j = externalJourney(ch); if (!j || !ch || j.status !== 'in_transit') return false;
    if (!j.route || !Array.isArray(j.route.segments)) { j.status = 'blocked'; j.pauseReason = 'journey_route_missing'; return false; }
    if (!routeSegmentAvailable(j)) { j.status = 'blocked'; j.pauseReason = 'route_changed'; ch._travelPaused = true; return false; }
    var last = Number(j.lastAdvancedDay); if (!Number.isFinite(last)) last = Number(j.startedDay); if (!Number.isFinite(last)) last = now;
    var left = Math.max(0, now - last); if (!(left > config.epsilon)) return false; j.lastAdvancedDay = now;
    while (left > config.epsilon && j.status === 'in_transit') {
      var seg = rows(j.route.segments)[j.segmentIndex]; if (!seg) { j.status = 'arrived'; j.arrivedDay = Number(j.startedDay) + Number(j.expectedDays || 0); j.currentRegionId = j.toRegionId; j.remainingDays = 0; break; }
      var segmentDays = Math.max(config.epsilon, Number(seg.days) || 0), rem = Math.max(0, segmentDays - Number(j.segmentElapsedDays || 0)), used = Math.min(left, rem);
      j.segmentElapsedDays = Number(j.segmentElapsedDays || 0) + used; j.elapsedDays = Number(j.elapsedDays || 0) + used; j.remainingDays = Math.max(0, Number(j.expectedDays) - j.elapsedDays); left -= used;
      if (j.segmentElapsedDays + config.epsilon >= segmentDays) { j.currentRegionId = seg.toRegionId; j.segmentIndex++; j.segmentElapsedDays = 0; ch.location = locationName(j.currentRegionId); ch.regionId = j.currentRegionId; ch.mapRegionId = j.currentRegionId; if (j.segmentIndex >= rows(j.route.segments).length) { j.status = 'arrived'; j.arrivedDay = Number(j.startedDay) + Number(j.expectedDays || 0); j.remainingDays = 0; } }
    }
    if (j.status === 'arrived') { ch._travelCurrentRegionId = j.toRegionId; if (ch._localTravelRef && ch._localTravelRef.journeyId === j.id) delete ch._localTravelRef; delete ch._travelTo; delete ch._travelRemainingDays; delete ch._travelExpectedDays; delete ch._travelReason; delete ch._travelPaused; }
    else projectExternalJourney(ch, j);
    return true;
  }
  function advanceExternalJourneys(now) { var total = 0; rows(G() && G().chars).forEach(function (ch) { if (advanceExternalJourney(ch, now)) total++; }); return total; }

  function syncJourneys(p) {
    var m = p.localActivity.meeting;
    ['actor', 'target'].forEach(function (role) {
      var ch = charForRole(p, role), j = journeyFor(m, role, false);
      if (!ch || !j || !alive(ch)) { if (j) j.status = 'unavailable'; return; }
      if (j.status === 'arrived' && currentRegion(ch) === j.toRegionId) j.arrivedDay = j.arrivedDay || day();
    });
    ['actor', 'target'].forEach(function (role) {
      var ch = charForRole(p, role), j = journeyFor(m, role, true);
      if (j && j.status === 'arrived' && ch && currentRegion(ch) === j.toRegionId) j.status = 'returned';
    });
  }

  function hasConflict(ch, p, start, end) {
    return rows(G()._npcPlans).some(function (other) {
      if (!other || other === p || !isMeeting(other)) return false;
      var om = other.localActivity.meeting;
      if (other.actorId !== id(ch) && other.targetId !== id(ch)) return false;
      if (!om || !Number.isFinite(om.startedDay) || !Number.isFinite(om.endDay)) return false;
      return om.status === 'in_meeting' && start < om.endDay && end > om.startedDay;
    });
  }

  function participantPresent(p, role) {
    var m = p && p.localActivity && p.localActivity.meeting, ch = charForRole(p, role), j = m && journeyFor(m, role, false);
    if (!m || !alive(ch) || !j || j.status !== 'arrived') return false;
    if (journeyFor(m, role, true)) return false;
    if (ch._localTravelRef && (ch._localTravelRef.role !== role || ch._localTravelRef.planId !== p.id)) return false;
    return currentRegion(ch) === String(m.locationId) && (!ch._officeJourney || ch._officeJourney.status !== 'in_transit');
  }

  function bothParticipantsPresent(p) { return participantPresent(p, 'actor') && participantPresent(p, 'target'); }
  function onsitePermission(p) {
    var m = p.localActivity.meeting;
    var a = officeConstraintCheck(person(p.actorId), m, 'actor', 'onsite');
    return a.ok ? officeConstraintCheck(person(p.targetId), m, 'target', 'onsite') : a;
  }

  function beginMeeting(p, now, startOverride) {
    var a = p.localActivity, m = a.meeting, aj = m.actorJourney, tj = m.targetJourney;
    if (m.status === 'in_meeting' || m.participation || !aj || !tj || aj.status !== 'arrived' || tj.status !== 'arrived') return false;
    var start = Number.isFinite(Number(startOverride)) ? Number(startOverride) : now;
    if (start < m.requestedStartDay) { m.status = 'arrived_waiting'; p.status = 'arrived_waiting'; return false; }
    if (start > m.requestedStartDay + m.windowDays) { m.status = 'missed'; p.status = 'missed'; return false; }
    var end = start + m.durationDays, actor = person(p.actorId), target = person(p.targetId);
    // A stale arrived flag is not enough: both characters must still occupy
    // the agreed venue when the meeting actually starts.
    if (!bothParticipantsPresent(p)) {
      m.status = 'arrived_waiting'; p.status = 'arrived_waiting'; return false;
    }
    if (!officeConstraintCheck(actor, m, 'actor', 'onsite').ok || !officeConstraintCheck(target, m, 'target', 'onsite').ok) {
      m.status = 'schedule_conflict'; p.status = 'waiting_schedule'; m.startBlockedDay = now; return false;
    }
    if (hasConflict(actor, p, start, end) || hasConflict(target, p, start, end)) { m.status = 'schedule_conflict'; p.status = 'waiting_schedule'; m.startBlockedDay = now; return false; }
    m.status = 'in_meeting'; p.status = 'in_meeting'; m.startedDay = start; m.endDay = end;
    delete m.nextStartDay;
    if (m.discussion) { m.discussion.status = 'awaiting_actor'; p.nextActorId = p.actorId; p.nextTurn = G().turn; }
    m.participationStart = { id: 'meeting-start:' + p.id, day: start, participants: [p.actorId, p.targetId], locationId: m.locationId, sourcePlanId: p.id };
    return true;
  }

  function beginReturnFor(p, role, startAt) {
    var m = p.localActivity.meeting, mode = m[role + 'ReturnMode'] || 'return', ch = charForRole(p, role);
    if (!alive(ch)) { setJourney(m, role, true, { id: 'journey:' + p.id + ':' + role + ':return', role: role, phase: 'return', status: 'unavailable', reason: 'participant_unavailable', day: day(), planId: p.id }); return false; }
    if (ch._localTravelRef && ch._localTravelRef.planId !== p.id) {
      // A real subsequent journey is owned by its original domain. Do not
      // start a competing return or erase the route already being travelled.
      setJourney(m, role, true, { id: 'journey:' + p.id + ':' + role + ':return', role: role, phase: 'return', status: 'continued_elsewhere', sourceJourneyId: ch._localTravelRef.journeyId, day: day(), planId: p.id }); return false;
    }
    if (mode === 'stay') { setJourney(m, role, true, { id: 'journey:' + p.id + ':' + role + ':return', role: role, phase: 'return', status: 'staying', fromRegionId: currentRegion(ch), toRegionId: currentRegion(ch), arrivedDay: day(), planId: p.id }); return true; }
    m[role + 'HomeRegionId'] = m[role + 'HomeRegionId'] || currentRegion(ch);
    return startJourneyFor(p, role, 'return', startAt);
  }

  function finishMeeting(p, now) {
    var a = p.localActivity, m = a.meeting;
    if (m.status !== 'in_meeting' || !Number.isFinite(m.endDay) || now < m.endDay) return false;
    if (m.discussion && m.discussion.status !== 'completed') m.discussion.status = 'uncompleted';
    if (!m.participation) {
      var discussionCompleted = !!(m.discussion && m.discussion.status === 'completed');
      if (m.discussion && !discussionCompleted) {
        m.discussion.status = 'uncompleted';
        m.discussion.outcome = m.discussion.actorContent ? 'partial' : 'not_started';
      }
      m.participation = { id: 'meeting:' + p.id, startDay: m.startedDay, endDay: now, durationDays: now - m.startedDay,
        participants: [p.actorId, p.targetId], interruptionReason: m.interruptionReason || '', locationId: m.locationId, purpose: m.purpose, sourcePlanId: p.id,
        discussion: m.discussion && { status: m.discussion.status, outcome: m.discussion.outcome || (discussionCompleted ? 'completed' : 'not_started'), topicId: m.discussion.topicId, result: copy(m.discussion.result || null) } };
      var actor = person(p.actorId), target = person(p.targetId);
      remember(actor, target, p, m.participation.id, '与' + (target && target.name || p.target) + '在' + m.locationName + '实际会面，议题：' + m.purpose, 'personal_experience');
      remember(target, actor, p, m.participation.id + ':target', '与' + (actor && actor.name || p.actor) + '在' + m.locationName + '实际会面，议题：' + m.purpose, 'personal_experience');
      if (m.discussion && m.discussion.result && !m.discussion.effectsApplied) {
        var discussionText = m.discussion.result.targetContent || m.discussion.result.actorContent || '';
        remember(actor, target, p, m.discussion.result.id + ':actor', '现场围绕' + m.discussion.result.topicId + '讨论：' + discussionText, 'personal_experience');
        remember(target, actor, p, m.discussion.result.id + ':target', '现场围绕' + m.discussion.result.topicId + '讨论：' + discussionText, 'personal_experience');
        if (actor && root.CharacterGrowthSystem && typeof root.CharacterGrowthSystem.recordExperience === 'function') root.CharacterGrowthSystem.recordExperience(actor.name, '现场请益·' + m.discussion.result.topicId, discussionText, { characterId: actor.id });
        m.discussion.effectsApplied = true;
      }
      if (actor && target && !m.interruptionReason && (!m.discussion || discussionCompleted) && root.OpinionSystem && typeof root.OpinionSystem.addEventOpinion === 'function') root.OpinionSystem.addEventOpinion(actor, target, 1, '实际约见已完成', { sourceId: m.participation.id });
      m.effectsApplied = true;
    }
    m.status = 'returning'; p.status = 'returning';
    ['actor', 'target'].forEach(function (role) { if (!journeyFor(m, role, true)) beginReturnFor(p, role, now); });
    syncJourneys(p); finalizeReturn(p);
    return true;
  }

  function finalizeReturn(p) {
    var m = p.localActivity.meeting;
    if (m.status !== 'returning') return;
    var done = ['actor', 'target'].every(function (role) { var j = journeyFor(m, role, true); return j && /^(arrived|returned|staying|unavailable|continued_elsewhere)$/.test(j.status); });
    if (done) { ['actor', 'target'].forEach(function (role) { var j = journeyFor(m, role, true); if (j.status === 'arrived') j.status = 'returned'; }); m.status = 'returned';
      var completed = !!m.participation && !m.interruptionReason && (!m.discussion || !!(m.discussion.status === 'completed' && m.discussion.result)) && ['actor', 'target'].every(function (role) { return /^(arrived|returned|staying)$/.test(journeyFor(m, role, true).status); }); p.status = completed ? 'done' : 'ended'; p.nextActorId = '';
      if (['actor', 'target'].some(function (role) { return /^(unavailable|continued_elsewhere)$/.test(journeyFor(m, role, true).status); })) m.status = 'ended';
      if (typeof root._npcPlanningStepResult === 'function' && p.localActivity.sourceGoalId) {
        var discussionOutcome = completed ? 'completed' : (m.discussion && m.discussion.outcome === 'partial' ? 'partial' : 'ended');
        root._npcPlanningStepResult(p.actorId, p.localActivity.sourceGoalId, { outcome: discussionOutcome, reason: completed ? 'meeting_returned' : 'meeting_returned_without_discussion', planId: p.id, planningOwnerId: p.actorId, verified: completed });
      }
    }
  }

  function deliver(p, msg, deliveredAt) {
    var to = person(msg.toId), from = person(msg.fromId), a = p.localActivity, m = a.meeting;
    if (!alive(to) || !msg.deliveryRegionId || currentRegion(to) !== msg.deliveryRegionId) return false;
    msg.status = 'delivered'; msg.deliveredDay = deliveredAt; msg.deliveredTurn = G().turn;
    msg.deliveryRef = { id: 'travel-delivery:' + msg.id, sourceMessageId: msg.id, fromId: msg.fromId, toId: msg.toId, termsVersion: msg.termsVersion };
    setOwnKnowledge(p, msg.toId, 'delivered', msg);
    remember(to, from, p, msg.id, '收到' + (from && from.name || '来人') + '的约见文书：' + msg.content, 'received_claim');
    if (msg.kind === 'meeting_request' && msg.termsVersion === a.termsVersion) { p.status = 'awaiting_response'; p.nextActorId = p.targetId; m.status = 'awaiting_response'; }
    if (msg.kind === 'meeting_response') {
      // A defer response is authored against the current terms.  The next
      // terms version is carried separately and is created only when the
      // requester explicitly accepts the reschedule.
      if (msg.termsVersion !== a.termsVersion) { msg.stale = true; return true; }
      m.actorResponseDelivered = true; m.responseDeliveredDay = deliveredAt;
      if (msg.data.response === 'reject') { m.status = 'rejected'; p.status = 'rejected'; }
      else if (msg.data.response === 'defer') { m.pendingTerms = copy(msg.data.proposedTerms || null); m.status = 'deferred'; p.status = 'awaiting_reschedule'; p.nextActorId = p.actorId; }
      else {
        m.status = 'scheduled';
        if (m.actorDeparturePolicy === 'after_acceptance_delivery') {
          var startedAfterAcceptance = startJourneyFor(p, 'actor', 'acceptance_delivered', deliveredAt);
          if (!startedAfterAcceptance) { p.status = 'waiting_departure'; p.nextActorId = p.actorId; }
          else aggregateStatus(p);
        } else { p.status = 'waiting_departure'; p.nextActorId = p.actorId; }
      }
    }
    if (msg.kind === 'meeting_cancel') {
      var r = roleFor(p, msg.toId); if (r) stopJourney(p, r, false, 'cancel_notice_received');
      m.status = 'cancelled'; p.status = 'cancelled'; p.nextActorId = '';
    }
    // A remote refusal/cancellation affects the owner's known progress only
    // when its actual message reaches that owner, never when it is authored.
    if (String(msg.toId) === String(p.actorId) && /^(rejected|cancelled)$/.test(p.status)) notifyPlanningOutcome(p, p.status, 'meeting_outcome_delivered');
    return true;
  }

  function failedDelivery(p, msg) {
    msg.status = 'undeliverable'; msg.failedDay = day(); msg.failure = 'recipient_not_at_known_address';
    if (msg.kind === 'meeting_request' && !terminal(p)) { p.status = 'waiting_contact'; p.nextActorId = ''; }
    if (msg.kind === 'meeting_response' && !terminal(p)) { p.status = 'waiting_contact'; p.nextActorId = ''; }
    return false;
  }

  function processMessages(p, now) {
    p.messages.slice().filter(function (m) { return m.status === 'in_transit' && m.deliveryDay <= now; }).forEach(function (m) {
      if (!deliver(p, m, Number(m.deliveryDay))) failedDelivery(p, m);
    });
  }

  function advanceAt(now, autonomous) {
    // External (office leave/return) journeys use the same physical route
    // service and progress clock as meetings, but never create a meeting plan.
    advanceExternalJourneys(now);
    rows(G()._npcPlans).filter(isMeeting).forEach(function (p) {
      var a = p.localActivity, m = a.meeting;
      if (now < Number(m.lastProcessedDay == null ? a.createdDay : m.lastProcessedDay)) return;
      processMessages(p, now);
      ['actor', 'target'].forEach(function (role) { advanceJourney(p, role, false, now); });
      syncJourneys(p);
      if (m.status === 'traveling' || m.status === 'scheduled' || m.status === 'response_in_transit' || m.status === 'arrived_waiting') {
        if (m.actorJourney && m.targetJourney && m.actorJourney.status === 'arrived' && m.targetJourney.status === 'arrived') {
          var arrivalDay = Math.max(Number(m.actorJourney.arrivedDay || now), Number(m.targetJourney.arrivedDay || now));
          var startDay = Math.max(Number(m.requestedStartDay), arrivalDay, m.startBlockedDay != null ? now : -Infinity);
          if (startDay > Number(m.requestedStartDay) + Number(m.windowDays)) {
            m.missedDay = now; m.status = 'returning'; p.status = 'returning'; p.nextActorId = '';
            if (m.discussion) { m.discussion.status = 'uncompleted'; m.discussion.outcome = 'not_started'; }
            ['actor', 'target'].forEach(function (role) { if (!journeyFor(m, role, true)) beginReturnFor(p, role, now); });
          }
          // Arrival is a physical fact; it does not consume the future
          // appointment window.  Keep the plan waiting until the actual
          // simulation day reaches the agreed start.  If one committed
          // interval crosses the start, replay the event at its real day and
          // then continue through the interval; never stamp a future start
          // into an in_meeting state.
          else if (startDay > now) { m.status = 'arrived_waiting'; p.status = 'arrived_waiting'; m.nextStartDay = startDay; }
          else {
            beginMeeting(p, startDay, startDay);
          }
        }
      }
      if (m.status === 'in_meeting' && !bothParticipantsPresent(p)) {
        m.interruptedDay = now; m.interruptionReason = 'participant_left';
        m.endDay = Math.min(m.endDay, now);
      }
      if (autonomous && !terminal(p) && p.nextActorId && NPC.LocalAI && NPC.LocalAI.meetingEvent) {
        var who = person(p.nextActorId), v = who && view(p, who);
        var attempt = v && v.nextPhase ? a.revision + ':' + v.nextPhase : '';
        var budgetRenewed = Number.isFinite(m.nextEventRetryDay) && now >= m.nextEventRetryDay;
        if (attempt && !D().controlled(who) && (m.lastEventAttempt !== attempt || budgetRenewed)) {
          activeEvent = { world: G(), planId: p.id, actorId: id(who), phase: v.nextPhase, day: now };
          var eventReceipt;
          try { eventReceipt = NPC.LocalAI.meetingEvent(p); } finally { activeEvent = null; }
          // Transactions that fail replace nested objects. Reacquire the plan.
          p = plan(p.id); a = p.localActivity; m = a.meeting;
          if (eventReceipt) {
            m.lastEventAttempt = attempt;
            if (/^(daily_activity_budget|local_computation_budget)$/.test(eventReceipt.reason) && Number.isFinite(eventReceipt.retryDay) && eventReceipt.retryDay > now) {
              m.nextEventRetryDay = eventReceipt.retryDay; m.eventRetryReason = eventReceipt.reason;
            } else { delete m.nextEventRetryDay; delete m.eventRetryReason; }
          }
        }
      }
      if (m.status === 'in_meeting' && now >= Number(m.endDay)) finishMeeting(p, Number(m.endDay));
      ['actor', 'target'].forEach(function (role) { advanceJourney(p, role, true, now); });
      syncJourneys(p); finalizeReturn(p);
      if (!terminal(p) && m.status === 'invitation_in_transit' && now >= a.expiresDay) { m.status = 'expired'; p.status = 'expired'; notifyPlanningOutcome(p, 'expired', 'meeting_known_deadline_elapsed'); }
      aggregateStatus(p);
      m.lastProcessedDay = now;
    });
    return true;
  }

  function acceptsEventChoice(ch, command) {
    return !!(activeEvent && activeEvent.world === G() && activeEvent.actorId === id(ch) &&
      activeEvent.planId === command.planId && (!command.phase || activeEvent.phase === command.phase) &&
      /^(respond|reschedule|depart|discuss|discuss_response)$/.test(activeEvent.phase) && !D().controlled(ch));
  }
  function departureReady(p, ch) {
    if (!isMeeting(p) || !ch || !participant(p, id(ch))) return { ok: false, reason: 'meeting_participant_required' };
    return officeConstraintCheck(ch, p.localActivity.meeting, roleFor(p, id(ch)), 'depart');
  }
  function eventDays(p) {
    var m = p.localActivity.meeting, out = [];
    if (Number.isFinite(m.nextEventRetryDay)) out.push(m.nextEventRetryDay);
    if (!m.participation && m.status !== 'in_meeting') out.push(Number(m.requestedStartDay));
    rows(p.messages).forEach(function (msg) { if (msg.status === 'in_transit') out.push(Number(msg.deliveryDay)); });
    ['actor', 'target'].forEach(function (role) {
      [false, true].forEach(function (returning) { var j = journeyFor(m, role, returning);
        if (j && j.status === 'in_transit') out.push(Number(j.lastAdvancedDay) + Number(j.remainingDays));
      });
    });
    if (!m.participation && m.actorJourney && m.targetJourney && !/^in_meeting$/.test(m.status)) {
      var arrivals = [m.actorJourney, m.targetJourney].map(function (j) { return j.status === 'arrived' ? j.arrivedDay : j.status === 'in_transit' ? Number(j.lastAdvancedDay) + Number(j.remainingDays) : NaN; });
      if (arrivals.every(Number.isFinite)) out.push(Math.max(m.requestedStartDay, arrivals[0], arrivals[1]));
    }
    if (m.status === 'in_meeting') {
      out.push(m.endDay);
      var waitingPlayer = person(p.nextActorId), nextWorkDay = Math.floor(day()) + 1;
      if (waitingPlayer && D().controlled(waitingPlayer) && D().budget(waitingPlayer).steps >= D().config.dailySteps && nextWorkDay < m.endDay) out.push(nextWorkDay);
      if (m.discussion && m.discussion.status === 'awaiting_target') out.push(m.discussion.responseDay);
    }
    return out.filter(Number.isFinite);
  }
  function advanceWithin(options) {
    if (advancing) return true;
    options = options || {};
    var now = Number.isFinite(options.toDay) ? options.toDay : day();
    var clock = TM.SimTime && TM.SimTime.read(G()), interval = clock && clock.pending;
    var replay = !options.passive && interval && interval.status === 'committed' && interval.toDay === now;
    advancing = true;
    try {
      if (!replay) return advanceAt(now, false);
      var at = interval.fromDay, rounds = 0;
      while (at <= now && rounds++ < 256) {
        // Same-time deliveries may expose a new choice, but each activity
        // revision is attempted once and the common local budget still applies.
        for (var pass = 0; pass < 4; pass++) TM.SimTime.atCommittedEvent(G(), at, function () { advanceAt(at, true); });
        var next = now;
        rows(G()._npcPlans).filter(isMeeting).filter(function (p) { return !terminal(p); }).forEach(function (p) {
          eventDays(p).forEach(function (v) { if (v > at + config.epsilon && v < next) next = v; });
        });
        if (at === now) break;
        at = next;
      }
      return true;
    } finally { advancing = false; activeEvent = null; }
  }
  function pendingPlayerChoice() {
    var found = null;
    rows(G() && G()._npcPlans).filter(isMeeting).some(function (p) {
      var ch = person(p.nextActorId), v = ch && D().controlled(ch) && view(p, ch);
      if (v && /^(discuss|discuss_response)$/.test(v.nextPhase) && D().budget(ch).steps < D().config.dailySteps && onsitePermission(p).ok) { found = { planId: p.id, actorId: id(ch), phase: v.nextPhase }; return true; }
      return false;
    });
    return found;
  }
  function nextPlayerBoundary(from, to) {
    var boundary = null;
    rows(G() && G()._npcPlans).filter(isMeeting).filter(function (p) {
      return !terminal(p) && [person(p.actorId), person(p.targetId)].some(function (ch) { return ch && D().controlled(ch); });
    }).forEach(function (p) {
      var m = p.localActivity.meeting, actor = person(p.actorId), target = person(p.targetId), days = eventDays(p);
      // Only omit outer stops for an already informed player's committed
      // travel/answer sequence. The complete eventDays replay stays unchanged.
      var committed = alive(actor) && alive(target) && D().controlled(actor) && !D().controlled(target)
        && actorResponseKnown(p) && m.targetDecision && m.targetDecision.response === 'accept'
        && !rows(p.messages).some(function (msg) { return msg.status === 'in_transit'; })
        && !m.pendingTerms && m.startBlockedDay == null && !m.interruptionReason && !Number.isFinite(m.nextEventRetryDay);
      if (committed) {
        var version = TM.MapRouteDays && TM.MapRouteDays.routeVersion && TM.MapRouteDays.routeVersion(map());
        function stableJourney(role, returning) {
          var j = journeyFor(m, role, returning), ch = charForRole(p, role);
          if (!j || ch._travelPaused || ch._officeJourney && ch._officeJourney.status === 'in_transit') return false;
          if (j.status === 'in_transit') return !!(version && j.route && j.route.status === 'reachable'
            && String(j.route.routeVersion) === String(version) && ch._localTravelRef && ch._localTravelRef.journeyId === j.id);
          return /^(arrived|returned|staying)$/.test(j.status) && currentRegion(ch) === j.toRegionId
            && (!j.route || String(j.route.routeVersion) === String(version));
        }
        if (!m.participation && /^(traveling|scheduled|arrived_waiting)$/.test(m.status)
            && !m.actorReturnJourney && !m.targetReturnJourney && stableJourney('actor', false) && stableJourney('target', false)) {
          var arrivals = [m.actorJourney, m.targetJourney].map(function (j) { return j.status === 'arrived' ? j.arrivedDay : Number(j.lastAdvancedDay) + Number(j.remainingDays); });
          var start = Math.max(Number(m.requestedStartDay), arrivals[0], arrivals[1]);
          // A rounded route estimate cannot establish physical presence. Keep
          // the original stops when unfinished segments extend past this ETA.
          var presentByStart = [m.actorJourney, m.targetJourney].every(function (j) {
            if (j.status === 'arrived') return true;
            var remaining = rows(j.route.segments).slice(j.segmentIndex || 0).reduce(function (sum, segment) { return sum + Number(segment.days); }, 0) - Number(j.segmentElapsedDays || 0);
            return Number.isFinite(remaining) && Number(j.lastAdvancedDay) + Math.max(0, remaining) <= start + config.epsilon;
          });
          if (arrivals.every(Number.isFinite) && presentByStart && start > from + config.epsilon && start <= Number(m.requestedStartDay) + Number(m.windowDays)) days = [start];
        } else if (m.discussion && m.discussion.actorContent && /^(awaiting_target|completed)$/.test(m.discussion.status)
            && (!p.nextActorId || p.nextActorId === p.targetId)) {
          if (m.status === 'in_meeting' && bothParticipantsPresent(p) && onsitePermission(p).ok
              && stableJourney('actor', false) && stableJourney('target', false)
              && (m.discussion.status === 'completed' || D().budget(target).steps < D().config.dailySteps)
              && ['actor', 'target'].every(function (role) { return m[role + 'ReturnMode'] === 'stay'
                || route(m.locationId, m[role + 'HomeRegionId'], m.mode).status === 'reachable'; })) days = [];
          else if (m.status === 'returning' && m.participation && m.discussion.status === 'completed'
              && stableJourney('actor', true) && stableJourney('target', true)) days = [];
        }
      }
      days.forEach(function (v) {
        if (v > from + config.epsilon && v < to && (!boundary || v < boundary.day)) boundary = { day: v, planId: p.id, reason: 'meeting_event' };
      });
    });
    return boundary;
  }

  function beforeTravelAdvance() {
    rows(G() && G().chars).forEach(function (ch) {
      var j = externalJourney(ch); if (j && j.status === 'in_transit' && !routeSegmentAvailable(j)) { j.status = 'blocked'; j.pauseReason = 'route_changed'; ch._travelPaused = true; }
    });
    rows(G()._npcPlans).filter(isMeeting).forEach(function (p) {
      ['actor', 'target'].forEach(function (role) { revalidateJourney(p, role, false); revalidateJourney(p, role, true); });
    });
  }

  function knownTargetLocation(actor, target) {
    if (!target || target.locationPublic === false || target._locationSecret || target.visibility === 'private' || target.visibility === 'secret') return '';
    return currentRegion(target) || '';
  }

  function validTerms(spec, inviteRoute) {
    spec = spec || {};
    var start = spec.requestedStartDay == null ? day() + Math.max(1, Math.ceil(inviteRoute.days)) : Number(spec.requestedStartDay);
    var window = spec.windowDays == null ? config.defaultWindowDays : Number(spec.windowDays);
    var duration = spec.durationDays == null ? config.defaultDurationDays : Number(spec.durationDays);
    if (!Number.isFinite(start) || start < day() || !Number.isFinite(window) || window < 0 || !Number.isFinite(duration) || duration <= 0) return null;
    return { requestedStartDay: start, windowDays: window, durationDays: duration };
  }

  function createMeeting(actor, d, target, targetRegion, inviteRoute, locationId) {
    var t = validTerms(d.meeting, inviteRoute); if (!t) return null;
    var a = d.meeting || {}, fallbackReturn = a.returnMode === 'stay' ? 'stay' : 'return';
    var discussionSpec = a.discussion || a.consultation, discussion = discussionSpec ? normalizeDiscussion(actor, discussionSpec) : null;
    if (discussionSpec && !discussion) return null;
    return { version: 1, status: 'invitation_in_transit', locationId: locationId, venueLocationId: locationId, locationName: locationName(locationId),
      purpose: text(a.purpose) || '探望与叙谈', mode: text(a.mode) || config.defaultMode, requestedStartDay: t.requestedStartDay,
      windowDays: t.windowDays, durationDays: t.durationDays, actorReturnMode: a.actorReturnMode === 'stay' ? 'stay' : fallbackReturn,
      targetReturnMode: 'return',
      actorOfficeConstraint: copy(a.actorOfficeConstraint || a.officeConstraint || null), targetOfficeConstraint: copy(a.targetOfficeConstraint || null),
      actorDeparturePolicy: a.departurePolicy === 'manual' || D().controlled(actor) ? 'manual' : 'after_acceptance_delivery',
      actorReplyAddressRegionId: currentRegion(actor), inviteDeliveryRegionId: targetRegion, targetKnownRegionId: targetRegion,
      inviteRoute: copy(inviteRoute), termsHistory: [{ version: 1, terms: copy(t) }], actorResponseDelivered: false, discussion: discussion };
  }

  function commit(actor, d) {
    var p = d.planId ? plan(d.planId) : null, key = id(actor);
    if (!p) {
      var target = person(d.targetId);
      if (!target || target === actor || !alive(target)) return result('blocked', 'meeting_target_unavailable');
      if (!D().knows(actor, target)) return result('blocked', 'meeting_target_not_known');
      var targetRegion = knownTargetLocation(actor, target), fromRegion = currentRegion(actor);
      if (!targetRegion) return result('blocked', 'meeting_target_location_unknown');
      var inviteRoute = route(fromRegion, targetRegion, d.meeting && d.meeting.mode);
      if (!inviteRoute || inviteRoute.status !== 'reachable') return result('blocked', inviteRoute && inviteRoute.reason || 'meeting_invite_route_unavailable');
      var locationId = text(d.meeting && (d.meeting.locationId || d.meeting.venueLocationId)); if (!locationId) locationId = targetRegion;
      var loc = TM.MapRouteDays.resolveRegion(map(), locationId); if (!loc || loc.status !== 'resolved') return result('blocked', 'meeting_location_unresolved');
      var meeting = createMeeting(actor, d, target, targetRegion, inviteRoute, String(loc.region.id)); if (!meeting) return result('blocked', d.meeting && (d.meeting.discussion || d.meeting.consultation) ? 'meeting_discussion_source_required' : 'meeting_terms_invalid');
      if (!D().spend(actor, true)) return result('blocked', 'daily_activity_budget');
      p = { id: 'plan:' + d.actionId, version: 2, type: 'ordinary_interaction', actorId: key, actor: actor.name, targetId: id(target), target: target.name,
        createdTurn: G().turn, updatedTurn: G().turn, progress: 0, intent: '约见与探望', messages: [], steps: [], knowledge: {}, status: 'invitation_in_transit', nextActorId: '', nextTurn: G().turn,
        localActivity: { schemaVersion: 1, definitionVersion: 1, kind: 'meeting', revision: 0, termsVersion: 1, createdDay: day(), expiresDay: day() + config.responseDays,
          sourceGoalId: text(d.sourceGoalId), meeting: meeting } };
      L().ensurePlans(G()).push(p);
      var requestPhase = d.phase || 'execute';
      informedMessage(p, actor, target, 'meeting_request', '邀请你于第' + meeting.requestedStartDay + '日前后在' + meeting.locationName + '会面，议题：' + meeting.purpose + '。请按自己的日程决定。',
        { actionId: d.actionId, phase: requestPhase, purpose: meeting.purpose, terms: termsFrom(meeting), termsVersion: 1 },
        { day: day() + Math.ceil(inviteRoute.days), regionId: targetRegion, addressType: 'known_recipient_location' });
      p.localActivity.revision++;
      p.steps.push({ id: d.actionId + ':' + requestPhase, actionId: d.actionId, phase: requestPhase, actorId: key, beforeRevision: 0, afterRevision: p.localActivity.revision, inputHash: signature(d), day: day(), termsVersion: 1 });
      return result('submitted', '约见邀请已按已知收件地点递送，尚待对方收到并回应', [{ kind: 'meeting_step', id: d.actionId + ':' + requestPhase, planId: p.id }], { planId: p.id, activityKind: 'meeting', revision: p.localActivity.revision });
    }
    var a = p.localActivity, m = a.meeting;
    if (!isMeeting(p) || a.definitionVersion !== 1) return result('blocked', 'meeting_definition_requires_migration');
    if (!participant(p, key) || !p.knowledge[key]) return result('blocked', 'meeting_participant_not_informed');
    if (d.expectedRevision != null && d.expectedRevision !== a.revision || d.termsVersion != null && d.termsVersion !== a.termsVersion) return result('expired', 'meeting_or_terms_changed');
    if (/^(discuss|discuss_response)$/.test(d.phase)) {
      var permission = onsitePermission(p);
      if (!permission.ok) return result('blocked', permission.reason || 'meeting_office_presence_required');
    }
    if (d.phase === 'discuss' && key === p.actorId && m.status === 'in_meeting' && m.discussion && m.discussion.status === 'awaiting_actor') {
      if (day() < Number(m.startedDay || 0) || day() >= Number(m.endDay || 0)) return result('blocked', 'meeting_discussion_time_unavailable');
      if (!bothParticipantsPresent(p)) return result('blocked', 'meeting_discussion_participant_unavailable');
      var actorChoice = text(d.exchangeChoice || d.response || 'explain');
      if (!/^(explain|question|counter)$/.test(actorChoice)) return result('blocked', 'meeting_discussion_choice_required');
      var actorTopic = discussionTopic(m); if (!actorTopic) return result('blocked', 'meeting_discussion_topic_missing');
      if (!D().spend(actor, false)) return result('blocked', 'daily_activity_budget');
      m.discussion.actorChoice = actorChoice; m.discussion.actorContent = discussionContent(actorTopic, actorChoice, 'actor');
      m.discussion.spokenDay = day(); m.discussion.responseDay = Math.min(m.endDay - config.epsilon, day() + Math.min(0.5, m.durationDays / 2));
      m.discussion.status = 'awaiting_target'; p.nextActorId = p.targetId; p.nextTurn = G().turn;
      return step(p, actor, d, 'submitted', '现场已提出具体理解，等待对方独立回应');
    }
    if (d.phase === 'discuss_response' && key === p.targetId && m.status === 'in_meeting' && m.discussion && m.discussion.status === 'awaiting_target') {
      if (day() < Number(m.startedDay || 0) || day() >= Number(m.endDay || 0)) return result('blocked', 'meeting_discussion_time_unavailable');
      if (!bothParticipantsPresent(p)) return result('blocked', 'meeting_discussion_participant_unavailable');
      if (m.discussion.responseDay != null && day() < m.discussion.responseDay) return result('blocked', 'meeting_response_not_yet_due');
      var targetChoice = text(d.response || 'answer');
      if (!/^(answer|uncertain|counter)$/.test(targetChoice)) return result('blocked', 'meeting_discussion_response_required');
      var targetTopic = discussionTopic(m); if (!targetTopic) return result('blocked', 'meeting_discussion_topic_missing');
      if (!D().spend(actor, false)) return result('blocked', 'daily_activity_budget');
      m.discussion.targetChoice = targetChoice; m.discussion.targetContent = discussionContent(targetTopic, targetChoice, 'target');
      m.discussion.result = { id: 'meeting-discussion:' + p.id + ':1', topicId: targetTopic.id, question: m.discussion.question,
        actorChoice: m.discussion.actorChoice, targetChoice: targetChoice, actorContent: m.discussion.actorContent,
        targetContent: m.discussion.targetContent, sourceRefs: [{ kind: 'game_exercise', topicId: targetTopic.id, definitionVersion: 2 }], day: day(), sourcePlanId: p.id };
      m.discussion.status = 'completed'; p.nextActorId = '';
      return step(p, actor, d, 'submitted', '对方已在现场作出独立回应，讨论结果待会面结束后结算');
    }
    if (d.phase === 'cancel') {
      if (terminal(p)) return result('noop', 'meeting_terminal');
      if (!D().spend(actor, false)) return result('blocked', 'daily_activity_budget');
      stopJourney(p, roleFor(p, key), false, 'cancelled_by_self');
      var informed = [p.actorId, p.targetId].filter(function (v) { return v !== key && p.knowledge[v]; });
      if (!informed.length) { p.messages.forEach(function (msg) { if (msg.fromId === key && msg.status === 'in_transit') msg.status = 'withdrawn'; }); m.status = 'cancelled'; p.status = 'cancelled'; }
      else {
        informed.forEach(function (v) {
          var to = person(v), address = currentRegion(to), rr = route(currentRegion(actor), address, m.mode);
          informedMessage(p, actor, to, 'meeting_cancel', '此次约见已由发起方取消；已走过的路程不因此倒退。', { actionId: d.actionId, phase: d.phase, termsVersion: a.termsVersion }, { day: day() + Math.ceil(rr && rr.status === 'reachable' ? rr.days : 0), regionId: address, addressType: 'last_known_location' });
        });
        m.status = 'cancel_pending'; p.status = 'cancel_pending';
      }
      p.nextActorId = ''; return step(p, actor, d, 'submitted', informed.length ? '取消通知已发，其他参与者收到后再决定自己的行程' : '未送达的约见已撤回');
    }
    if (d.phase === 'depart' && (key === p.actorId && p.status === 'waiting_departure' || key === p.targetId && m.targetDecision && m.targetDecision.response === 'accept' && (!m.targetJourney || /^(blocked|unresolved|unreachable)$/.test(m.targetJourney.status)))) {
      var departureRole = roleFor(p, key);
      var departureCheck = officeConstraintCheck(actor, m, departureRole, 'depart');
      if (!departureCheck.ok) return result('blocked', departureCheck.reason || 'meeting_schedule_not_ready', [], { positionId: departureCheck.positionId, organizationId: departureCheck.organizationId, positionName: departureCheck.positionName });
      if (!D().spend(actor, false)) return result('blocked', 'daily_activity_budget');
      var departure = startJourneyFor(p, departureRole, 'manual');
      if (!departure) return result('blocked', m[departureRole + 'JourneyStatus'] || '当前路线或日程不能安全启程');
      aggregateStatus(p); return step(p, actor, d, 'started', '本人已按收到的接受回信启程');
    }
    if (d.phase === 'reschedule' && key === p.actorId && p.status === 'awaiting_reschedule' && m.pendingTerms) {
      m.version++; a.termsVersion++; m.requestedStartDay = m.pendingTerms.requestedStartDay; m.windowDays = m.pendingTerms.windowDays; m.durationDays = m.pendingTerms.durationDays; m.termsHistory.push({ version: m.version, terms: copy(m.pendingTerms) }); m.pendingTerms = null;
      // A deferred response belongs to the old version.  Clear its decision
      // before creating the new invitation so the post-commit advance cannot
      // reinterpret the old acceptance as approval of the new terms.
      m.targetDecision = null; m.actorResponseDelivered = false; m.responseDeliveredDay = null;
      m.status = 'invitation_in_transit'; p.status = 'invitation_in_transit';
      var rr2 = route(currentRegion(actor), m.inviteDeliveryRegionId, m.mode);
      informedMessage(p, actor, person(p.targetId), 'meeting_request', '改期后的约见安排如下，请重新按当前条款决定。', { actionId: d.actionId, phase: d.phase, purpose: m.purpose, terms: termsFrom(m), termsVersion: a.termsVersion }, { day: day() + Math.ceil(rr2 && rr2.status === 'reachable' ? rr2.days : 0), regionId: m.inviteDeliveryRegionId, addressType: 'known_recipient_location' });
      return step(p, actor, d, 'submitted', '改期形成新的条款版本，旧同意不再适用');
    }
    if (p.status !== 'awaiting_response' || key !== p.targetId || d.phase !== 'respond') return result('blocked', 'meeting_response_not_due');
    if (!/^(accept|reject|defer)$/.test(d.response || '')) return result('blocked', 'supported_meeting_response_required');
    if (!D().spend(actor, false)) return result('blocked', 'daily_activity_budget');
    var target = person(p.targetId), requester = person(p.actorId), replyAddress = m.actorReplyAddressRegionId;
    var responseRoute = route(currentRegion(target), replyAddress, m.mode);
    if (!responseRoute || responseRoute.status !== 'reachable') return result('blocked', 'meeting_response_route_unavailable');
    if (d.response === 'reject') {
      m.targetDecision = { response: 'reject', day: day(), termsVersion: a.termsVersion }; m.status = 'response_in_transit';
      informedMessage(p, target, requester, 'meeting_response', '这次不便赴约，约见暂且作罢。', { actionId: d.actionId, phase: d.phase, response: 'reject', termsVersion: a.termsVersion }, { day: day() + Math.ceil(responseRoute.days), regionId: replyAddress, addressType: 'reply_address_snapshot' });
      return step(p, actor, d, 'submitted', '拒绝已递出，发起者收到后事项才结束');
    }
    if (d.response === 'defer') {
      if (Number(a.deferrals || 0) >= D().config.maxDeferrals) return result('blocked', 'deferral_limit_reached');
      a.deferrals = Number(a.deferrals || 0) + 1;
      var proposed = { requestedStartDay: Math.max(m.requestedStartDay + 1, day() + Math.ceil(responseRoute.days) + 1), windowDays: m.windowDays, durationDays: m.durationDays };
      m.targetDecision = { response: 'defer', day: day(), termsVersion: a.termsVersion, proposedTerms: proposed }; m.status = 'response_in_transit';
      informedMessage(p, target, requester, 'meeting_response', '眼下尚有安排，请按新的明确时间再议。', { actionId: d.actionId, phase: d.phase, response: 'defer', proposedTerms: proposed, nextTermsVersion: a.termsVersion + 1, termsVersion: a.termsVersion }, { day: day() + Math.ceil(responseRoute.days), regionId: replyAddress, addressType: 'reply_address_snapshot' });
      return step(p, actor, d, 'submitted', '改期建议已递出，须收到后形成新条款');
    }
    m.targetDecision = { response: 'accept', day: day(), termsVersion: a.termsVersion };
    m.targetReturnMode = d.meeting && d.meeting.ownReturnMode === 'stay' ? 'stay' : 'return';
    var targetStarted = startJourneyFor(p, 'target', 'accepted');
    informedMessage(p, target, requester, 'meeting_response', '愿按当前约期赴约；双方各自按已知安排准备。', { actionId: d.actionId, phase: d.phase, response: 'accept', termsVersion: a.termsVersion }, { day: day() + Math.ceil(responseRoute.days), regionId: replyAddress, addressType: 'reply_address_snapshot' });
    aggregateStatus(p);
    return step(p, actor, d, targetStarted ? 'submitted' : 'waiting', targetStarted ? '本人已接受并按自己的安排准备；回信送达后发起者再决定是否启程' : '本人已接受但当前路线或日程暂不能出发');
  }

  function needsAdvance(g) {
    var now = D().day(g);
    return rows(g._npcPlans).some(function (p) {
      if (!isMeeting(p)) return false;
      var m = p.localActivity.meeting;
      return p.messages.some(function (x) { return x.status === 'in_transit' && x.deliveryDay <= now; }) ||
        ['actor', 'target'].some(function (r) { return [false, true].some(function (back) { var j = journeyFor(m, r, back); return j && j.status === 'in_transit' && now > Number(j.lastAdvancedDay); }); }) ||
        m.status === 'in_meeting' && (now >= m.endDay || !bothParticipantsPresent(p) || now > Number(m.lastProcessedDay)) ||
        m.status === 'arrived_waiting' && now >= m.requestedStartDay && now > Number(m.lastProcessedDay) ||
        m.nextEventRetryDay != null && now >= m.nextEventRetryDay ||
        !terminal(p) && m.status === 'invitation_in_transit' && now >= p.localActivity.expiresDay;
    });
  }

  function publicJourney(j) {
    if (!j) return null;
    return { id: j.id, role: j.role, phase: j.phase, status: j.status, fromRegionId: j.fromRegionId, toRegionId: j.toRegionId,
      currentRegionId: j.currentRegionId, segmentIndex: j.segmentIndex, elapsedDays: j.elapsedDays, remainingDays: j.remainingDays,
      startedDay: j.startedDay, arrivedDay: j.arrivedDay, pauseReason: j.pauseReason || '' };
  }

  function view(p, ch) {
    if (!isMeeting(p) || !ch || !p.knowledge[id(ch)]) return null;
    var key = id(ch), role = roleFor(p, key), m = p.localActivity.meeting, k = p.knowledge[key];
    var messages = p.messages.filter(function (x) { return x.fromId === key || x.toId === key && x.status === 'delivered'; });
    var next = '';
    if (p.status === 'awaiting_response' && key === p.targetId) next = 'respond';
    if (p.status === 'waiting_departure' && key === p.actorId) next = 'depart';
    if (!terminal(p) && key === p.targetId && m.targetDecision && m.targetDecision.response === 'accept' && (!m.targetJourney || /^(blocked|unresolved|unreachable)$/.test(m.targetJourney.status))) next = 'depart';
    if (p.status === 'awaiting_reschedule' && key === p.actorId) next = 'reschedule';
    if (m.status === 'in_meeting' && m.discussion && m.discussion.status === 'awaiting_actor' && key === p.actorId && day() >= m.startedDay && day() < m.endDay && bothParticipantsPresent(p)) next = 'discuss';
    if (m.status === 'in_meeting' && m.discussion && m.discussion.status === 'awaiting_target' && key === p.targetId && day() >= m.startedDay && day() < m.endDay && bothParticipantsPresent(p) && (m.discussion.responseDay == null || day() >= m.discussion.responseDay)) next = 'discuss_response';
    var ownDiscussion = m.discussion && { status: m.discussion.status, topicId: m.discussion.topicId, question: m.discussion.question, preferredExchange: m.discussion.preferredExchange,
      ownChoice: role === 'actor' ? m.discussion.actorChoice : m.discussion.targetChoice,
      ownContent: role === 'actor' ? m.discussion.actorContent : m.discussion.targetContent,
      heardChoice: role === 'target' && /^(awaiting_target|completed|uncompleted)$/.test(m.discussion.status) ? m.discussion.actorChoice : '',
      heardContent: role === 'target' && /^(awaiting_target|completed|uncompleted)$/.test(m.discussion.status) ? m.discussion.actorContent : '',
      result: m.discussion.status === 'completed' || m.discussion.status === 'uncompleted' ? Object.assign({ outcome: m.discussion.outcome || (m.discussion.status === 'completed' ? 'completed' : 'partial') }, copy(m.discussion.result || {})) : null };
    return { id: p.id, kind: 'meeting', actorId: p.actorId, targetId: p.targetId, intent: p.intent,
      stage: k.stage, nextPhase: next, revision: p.localActivity.revision, termsVersion: p.localActivity.termsVersion,
      expiresDay: p.localActivity.expiresDay, messages: copy(messages), documents: [], contact: null,
      meeting: { version: m.version, status: m.status, locationId: m.locationId, locationName: m.locationName, purpose: m.purpose,
        mode: m.mode, requestedStartDay: m.requestedStartDay, windowDays: m.windowDays, durationDays: m.durationDays,
        actorReturnMode: role === 'actor' ? m.actorReturnMode : undefined, targetReturnMode: role === 'target' ? m.targetReturnMode : undefined,
        ownDecision: role && copy(m[role + 'Decision'] || null), ownJourney: role && publicJourney(journeyFor(m, role, false)),
        ownReturnJourney: role && publicJourney(journeyFor(m, role, true)), participationStart: m.participationStart && copy(m.participationStart),
        participation: m.participation && copy(m.participation), discussion: ownDiscussion }, canCancel: !terminal(p), factStatus: 'own_meeting_view' };
  }

  function topicHistory(ch, topicId) {
    var characterId = id(ch), topic = text(topicId), count = 0;
    rows(G() && G()._npcPlans).filter(isMeeting).forEach(function (p) {
      var d = p.localActivity && p.localActivity.meeting && p.localActivity.meeting.discussion;
      if (p.actorId === characterId && d && d.result && d.result.topicId === topic && d.effectsApplied) count++;
    });
    return count;
  }

  function verifyEvidence(ref, d, actor, g, before) {
    var p = plan(ref.planId), old = before && rows(before._npcPlans).find(function (x) { return x.id === ref.planId; }), row = p && rows(p.steps).find(function (x) { return x.id === ref.id; });
    if (!(p && isMeeting(p) && row && row.actionId === d.actionId && row.phase === d.phase && row.actorId === id(actor) && row.termsVersion === p.localActivity.termsVersion && (!old || !rows(old.steps).some(function (x) { return x.id === ref.id; })) && p.localActivity.revision === row.afterRevision)) return false;
    var messages = rows(p.messages).filter(function (m) { return m.actionId === d.actionId && m.phase === d.phase; });
    if (d.phase === 'execute' && !messages.some(function (m) { return m.kind === 'meeting_request' && m.fromId === id(actor) && m.termsVersion === p.localActivity.termsVersion; })) return false;
    if (d.phase === 'respond' && !messages.some(function (m) { return m.kind === 'meeting_response' && m.fromId === id(actor) && m.data && m.data.response === d.response; })) return false;
    if (d.phase === 'depart') { var departed = journeyFor(p.localActivity.meeting, roleFor(p, id(actor)), false); if (!departed || !/^(in_transit|arrived)$/.test(departed.status)) return false; }
    if (d.phase === 'cancel' && !/^(cancelled|cancel_pending)$/.test(p.localActivity.meeting.status)) return false;
    if (d.phase === 'discuss') {
      var discussion = p.localActivity.meeting.discussion;
      if (row.actorId !== p.actorId || !discussion || discussion.status !== 'awaiting_target' ||
          discussion.actorChoice !== text(d.exchangeChoice) || !text(discussion.actorContent) ||
          day() < Number(p.localActivity.meeting.startedDay || 0) || day() >= Number(p.localActivity.meeting.endDay || 0)) return false;
    }
    if (d.phase === 'discuss_response') {
      var responseDiscussion = p.localActivity.meeting.discussion, responseResult = responseDiscussion && responseDiscussion.result;
      if (row.actorId !== p.targetId || !responseDiscussion || responseDiscussion.status !== 'completed' ||
          responseDiscussion.targetChoice !== text(d.response) || !text(responseDiscussion.targetContent) ||
          !responseResult || responseResult.sourcePlanId !== p.id) return false;
    }
    return true;
  }

  // Test-only compatibility shim. Production callers must use the canonical endTurn pipeline.
  function advanceLocalDays(days) {
    var left = Number(days), advanced = 0, interval;
    if (!G() || G()._tmTravelTestHarness !== true) return { ok: false, reason: 'formal_time_entry_required' };
    if (!(left > 0) || G().busy || G()._endTurnBusy) return { ok: false, reason: 'world_busy_or_invalid_days' };
    while (left > 0) {
      if (!TM.SimTime || !TM.SimTime.prepare || !TM.SimTime.commit) return { ok: false, reason: 'simulation_clock_unavailable' };
      interval = TM.SimTime.prepare(G()); if (interval.days > left) return { ok: false, reason: 'local_step_smaller_than_turn_interval' };
      var guards = TM.AIChange && TM.AIChange.WriteGuards;
      if (!guards || typeof guards.runAtomicMutation !== 'function') return { ok: false, reason: 'atomic_writer_unavailable' };
      var receipt = guards.runAtomicMutation(function () {
        G().turn++; var clockReceipt = TM.SimTime.commit(G(), interval);
        if (!clockReceipt || clockReceipt.ok !== true) return { ok: false, reason: 'simulation_clock_commit_failed' };
        var dailyReceipt = L().advance(G()); if (!dailyReceipt || dailyReceipt.ok !== true) return { ok: false, reason: dailyReceipt && dailyReceipt.reason || 'daily_travel_advance_failed' };
        return { ok: true, clock: clockReceipt, travel: dailyReceipt };
      });
      if (!receipt || receipt.ok !== true) { if (TM.SimTime.discardPrepared) TM.SimTime.discardPrepared(G(), interval); return receipt || { ok: false, reason: 'daily_travel_advance_failed' }; }
      left -= interval.days; advanced += interval.days;
    }
    return { ok: true, advancedDays: advanced, day: day() };
  }

  NPC.Meetings = { config: config, isPlan: isMeeting, topicHistory: topicHistory, commit: commit, beforeTravelAdvance: beforeTravelAdvance, needsAdvance: needsAdvance,
    advanceWithin: advanceWithin, advanceExternalJourneys: advanceExternalJourneys, startExternalJourney: startExternalJourney, stopExternalJourney: stopExternalJourney, externalJourney: externalJourney,
    view: view, verifyEvidence: verifyEvidence, advanceLocalDays: advanceLocalDays,
    acceptsEventChoice: acceptsEventChoice, departureReady: departureReady, pendingPlayerChoice: pendingPlayerChoice, nextPlayerBoundary: nextPlayerBoundary,
    afterVerifiedCommit: function (d, receipt) {
      advanceWithin({ passive: true });
      var p = d.planId && plan(d.planId);
      if (p && d.phase === 'cancel' && String(d.actorId) === String(p.actorId) && /^(cancelled|cancel_pending)$/.test(p.status)) notifyPlanningOutcome(p, 'cancelled', 'meeting_cancelled_by_owner');
      return receipt;
    } };
})(typeof window !== 'undefined' ? window : globalThis);
