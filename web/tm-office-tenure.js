/*
 * 职任地域、离任许可与有限代办。
 *
 * 这是 OfficeHolderState 上的一个很薄的业务适配层：职位配置描述通常驻地、
 * 履职方式和可转移的权能；申请、许可、交接和报告都仍保存在 _npcPlans，
 * 物理移动则委托 TM.NPC.Meetings 的共用旅行服务。这里不维护人物、时钟或
 * 账户的第二份真源。
 */
(function (root) {
  'use strict';
  var TM = root.TM = root.TM || {};
  var HS = TM.OfficeHolderState;
  var Ledger = TM.NPC && TM.NPC.ActionLedger;
  var VERSION = 1;
  var SCOPES = ['document_transfer', 'notice', 'public_transfer'];

  function G() { return root.GM || null; }
  function A(v) { return Array.isArray(v) ? v : []; }
  function s(v) { return v == null ? '' : String(v).trim(); }
  function n(v, d) { return v != null && v !== '' && isFinite(Number(v)) ? Number(v) : d; }
  function copy(v) { return v == null ? v : JSON.parse(JSON.stringify(v)); }
  function key(v) { return s(v); }
  function alive(ch) { return !!ch && ch.alive !== false && ch.dead !== true && !ch._missing && !ch._imprisoned && !ch.imprisoned; }
  function day(g) { g = g || G(); return TM.SimTime && TM.SimTime.now ? TM.SimTime.now(g) : Math.max(0, n(g && g.turn, 1) - 1) * 30; }
  function result(outcome, reason, refs, extra) { return Ledger && Ledger.result ? Ledger.result(outcome, reason, refs, extra) : Object.assign({ outcome: outcome, reason: reason || '', operationRefs: refs || [] }, extra || {}); }
  function chars(g) { return A(g && g.chars); }
  function findChar(g, ref) {
    var id = ref && typeof ref === 'object' ? key(ref.id || ref.characterId) : key(ref);
    var name = ref && typeof ref === 'object' ? key(ref.name) : '';
    var rows = chars(g).filter(function (c) { return c && (id ? key(c.id) === id : name && c.name === name); });
    return rows.length === 1 ? rows[0] : null;
  }
  function position(g, id, organizationId) {
    if (!HS || !id) return null;
    return HS.position(g, { positionId: id, organizationId: organizationId }) || null;
  }
  function assignment(g, ch, pos) {
    if (!HS || !ch || !pos) return null;
    var row = HS.assignments(g, ch, { organizationId: pos.organizationId }).filter(function (a) { return key(a.pos && a.pos.id) === key(pos.pos && pos.pos.id); });
    return row.length === 1 ? row[0] : null;
  }
  function state(pos, create) {
    pos = pos && pos.pos || pos;
    if (!pos) return null;
    var legacy = pos.officeLeave || pos.leave;
    if (!pos._officeTenureState && legacy && create) {
      pos._officeTenureState = { version: VERSION, sequence: 0, leaves: [], delegations: [], reports: [], reformHistory: [], migratedFrom: 'legacy-office-leave' };
      pos._officeTenureState.leaves.push(Object.assign({ id: 'legacy-leave:' + key(pos.id), positionId: key(pos.id), holderId: key(legacy.characterId || pos.holderId),
        organizationId: '', kind: 'legacy', status: legacy.status || (legacy.approved ? 'approved' : 'requested'), termsVersion: 1, steps: [], travelHistory: [] }, copy(legacy)));
    }
    if (!pos._officeTenureState && legacy && !create) {
      return { version: 0, sequence: 0, leaves: [Object.assign({ id: 'legacy-leave:' + key(pos.id), positionId: key(pos.id), holderId: key(legacy.characterId || pos.holderId),
        organizationId: '', kind: 'legacy', status: legacy.status || (legacy.approved ? 'approved' : 'requested'), termsVersion: 1, steps: [], travelHistory: [] }, copy(legacy))], delegations: [], reports: [], reformHistory: [], legacy: true };
    }
    if (!pos._officeTenureState && create) pos._officeTenureState = { version: VERSION, sequence: 0, leaves: [], delegations: [], reports: [], reformHistory: [] };
    if (pos._officeTenureState && pos._officeTenureState.version !== VERSION && create) {
      pos._officeTenureState = Object.assign({ version: VERSION, sequence: 0, leaves: [], delegations: [], reports: [], reformHistory: [] }, pos._officeTenureState);
    }
    return pos._officeTenureState || null;
  }
  function cfg(pos) {
    pos = pos && pos.pos || pos;
    var raw = (pos && (pos.officeTenure || pos.tenure || pos.dutyRules || pos.dutyConfig)) || {};
    var leave = raw.leave || {};
    var delegation = raw.delegation || {};
    var jurisdiction = raw.jurisdiction || {};
    var scope = raw.jurisdictionIds || jurisdiction.regionIds || jurisdiction.regions || pos && (pos.jurisdictionIds || pos.regionIds) || [];
    return {
      version: Number(raw.version || 1),
      dutyMode: raw.dutyMode || raw.mode || (raw.fieldDuty ? 'field' : raw.usualDutyLocationId ? 'resident' : 'unconfigured'),
      usualDutyLocationId: key(raw.usualDutyLocationId || raw.dutyLocationId || pos && (pos.usualDutyLocationId || pos.dutyLocationId)),
      jurisdictionIds: A(scope).map(key).filter(Boolean),
      onsiteActions: A(raw.onsiteActions || raw.presenceRequiredFor || ['document_transfer']),
      leave: {
        requiresApproval: leave.requiresApproval !== false,
        decisionPositionId: key(leave.decisionPositionId || leave.authorityPositionId || raw.leaveDecisionPositionId),
        authorityRef: key(leave.authorityRef || raw.leaveAuthorityRef),
        maxDays: n(leave.maxDays, 30),
        allowedKinds: A(leave.allowedKinds || ['private', 'field_duty', 'dispatch']),
        delegateRequired: leave.delegateRequired === true,
        allowedLocations: A(leave.allowedLocations || []),
        conditions: copy(leave.conditions || {})
      },
      delegation: {
        allowed: delegation.allowed === true || raw.canDelegate === true,
        grantorPositionId: key(delegation.grantorPositionId || raw.delegateAuthorityPositionId),
        allowedActions: A(delegation.allowedActions || delegation.scope || ['document_transfer']),
        allowedPositionIds: A(delegation.allowedPositionIds || []),
        maxDays: n(delegation.maxDays, 30),
        requiresAcceptance: delegation.requiresAcceptance !== false
      },
      returnLocationId: key(raw.returnLocationId || raw.returnTo || raw.usualDutyLocationId || pos && (pos.usualDutyLocationId || pos.dutyLocationId))
    };
  }
  function map() { var g = G(); return g && (g.mapData || g.map); }
  function route(from, to, mode) {
    if (!TM.MapRouteDays || !TM.MapRouteDays.planRoute) return { status: 'blocked', reason: 'route_service_unavailable' };
    return TM.MapRouteDays.planRoute(map(), from, to, { mode: mode || 'land' });
  }
  function resolveRegion(id) { return TM.MapRouteDays && TM.MapRouteDays.resolveRegion ? TM.MapRouteDays.resolveRegion(map(), id) : null; }
  function currentRegion(ch) {
    if (TM.NPC && TM.NPC.DailyActivities && TM.NPC.DailyActivities.exactLocation) return key(TM.NPC.DailyActivities.exactLocation(ch, G()));
    return key(ch && (ch.regionId || ch.mapRegionId || ch.locationId || ch.location));
  }
  function nextId(g, prefix) {
    var c = (g._officeTenureSequence = n(g._officeTenureSequence, 0) + 1);
    return prefix + ':' + (g._campaignId || g.sid || 'world') + ':' + c;
  }
  function findLeave(pos, id) {
    var st = state(pos, false); return st && A(st.leaves).find(function (v) { return v && v.id === id; }) || null;
  }
  function findDelegation(pos, id) {
    var st = state(pos, false); return st && A(st.delegations).find(function (v) { return v && v.id === id; }) || null;
  }
  function leavePlan(g, leave) { return A(g && g._npcPlans).find(function (p) { return p && p.officeTenure && p.officeTenure.leaveId === leave.id; }) || null; }
  function player(g) { var rows = chars(g).filter(function (c) { return c && (c.isPlayer || c.playerControlled || c.controlledBy === 'player'); }); return rows.length === 1 ? rows[0] : null; }
  function controlled(ch, g) { return TM.PoliticalActions && TM.PoliticalActions.controlled ? TM.PoliticalActions.controlled(ch, g) : !!(ch && ch.isPlayer); }
  function ensurePlans(g) { if (!Array.isArray(g._npcPlans)) g._npcPlans = []; return g._npcPlans; }
  function pushMessage(g, p, from, to, kind, content, data, deliveryTurn) {
    var m = { id: nextId(g, 'office-message'), sourceId: p.id, fromId: key(from && from.id), toId: key(to && to.id), kind: kind,
      content: s(content), data: copy(data || {}), sentTurn: n(g.turn, 0), deliveryTurn: n(deliveryTurn, n(g.turn, 0) + 1), status: 'in_transit' };
    p.messages.push(m); p.updatedTurn = n(g.turn, 0); p.nextActorId = ''; p.nextTurn = m.deliveryTurn;
    return m;
  }
  function addPlayerLetter(g, p, m, from, to) {
    if (!to || !to.isPlayer) return;
    if (!Array.isArray(g.letters)) g.letters = [];
    if (g.letters.some(function (x) { return x && x.id === m.id; })) return;
    g.letters.push({ id: m.id, from: from && from.name || '', fromId: m.fromId, to: to.name, toId: m.toId,
      content: m.content, subjectLine: p.intent, letterType: 'office', sentTurn: m.sentTurn, deliveryTurn: m.deliveredTurn,
      status: 'delivered', _npcInitiated: true, _playerRead: false, _replyExpected: true, npcPlanId: p.id, npcMessageId: m.id });
  }
  function note(g, ch, other, text, sourceId, factStatus) {
    try {
      if (root.NpcMemorySystem && ch) root.NpcMemorySystem.remember(ch.name, text, '平', 5, other && other.name || '', {
        _noMirror: true, relationshipHandled: true, characterId: ch.id, sourceId: sourceId, source: 'witnessed',
        factStatus: factStatus || 'verified_operation', sourceRefs: [{ kind: 'office_tenure', id: sourceId }]
      });
    } catch (_) {}
  }
  function authorityTarget(g, pos) {
    var c = cfg(pos), ref = c.leave;
    if (ref.authorityRef && g.nativeWorld && Array.isArray(g.nativeWorld.authorities)) {
      var grant = g.nativeWorld.authorities.filter(function (a) { return a && a.id === ref.authorityRef && a.status !== 'revoked'; });
      if (grant.length === 1) return findChar(g, grant[0].characterId);
    }
    if (ref.decisionPositionId) {
      var ap = position(g, ref.decisionPositionId, pos.organizationId);
      if (!ap) return { unresolved: true, reason: 'leave_decision_position_unresolved' };
      var ar = HS && HS.read(g, ap.pos); if (!ar || ar.characters.length !== 1) return { unresolved: true, reason: 'leave_decision_holder_unresolved' };
      return ar.primary;
    }
    return { unresolved: true, reason: 'leave_authority_not_configured' };
  }
  function delegateRecord(g, pos, actorId, action, regionId, now) {
    // A position with no leave/delegation state is the normal in-service
    // case.  Keep the read path total: absence of a record means no active
    // delegation, not an exception and not an implicit grant.
    var st = state(pos, false), rows = st ? A(st.delegations) : [];
    var hit = rows.filter(function (d) {
      return d && d.active && key(d.delegateId) === key(actorId) && A(d.scope).indexOf(action) >= 0 &&
        (!d.regionId || d.regionId === regionId) && now >= n(d.startDay, -Infinity) && now < n(d.endDay, Infinity);
    });
    return hit.length === 1 ? hit[0] : null;
  }
  function presence(g, ch, pos, now) {
    now = n(now, day(g)); var c = cfg(pos), region = currentRegion(ch), journey = ch && ch._officeJourney;
    if (journey && journey.status === 'in_transit') return { status: 'in_transit', regionId: journey.currentRegionId || region, dutyMode: c.dutyMode };
    if (!region) return { status: 'unknown', regionId: '', dutyMode: c.dutyMode };
    if (c.dutyMode === 'field' && ch && ch._officeFieldDuty) return { status: 'field_duty', regionId: region, dutyMode: c.dutyMode };
    if (c.usualDutyLocationId && region === c.usualDutyLocationId) return { status: 'on_site', regionId: region, dutyMode: c.dutyMode };
    return { status: 'away', regionId: region, dutyMode: c.dutyMode };
  }
  function canAct(opts) {
    opts = opts || {}; var g = opts.world || G(), ch = findChar(g, opts.actorId || opts.actor), pos = position(g, opts.positionId, opts.organizationId), now = n(opts.day, day(g));
    if (!alive(ch) || !pos) return { ok: false, reason: !ch ? 'actor_identity_unresolved' : 'position_identity_unresolved' };
    var a = assignment(g, ch, pos), action = key(opts.action), region = key(opts.regionId || currentRegion(ch));
    var d = delegateRecord(g, pos, ch.id, action, region, now);
    if (d) return { ok: true, actor: ch, position: pos, assignment: a, delegated: true, delegation: d, authorityRef: d.id, basis: 'limited_delegation' };
    if (!a) return { ok: false, reason: 'current_assignment_required' };
    var c = cfg(pos), st = state(pos, false), leave = st && A(st.leaves).find(function (v) { return v && v.holderId === key(ch.id) && /^(approved|active|at_destination|returning|overdue)$/.test(v.status); });
    if (leave && c.onsiteActions.indexOf(action) >= 0 && presence(g, ch, pos, now).status !== 'on_site' && c.dutyMode !== 'field') return { ok: false, reason: 'holder_away_requires_active_delegate', assignment: a, position: pos };
    if (opts.power && (!pos.pos.powers || pos.pos.powers[opts.power] !== true)) return { ok: false, reason: 'position_power_not_granted', assignment: a, position: pos };
    if (c.jurisdictionIds.length && region && c.jurisdictionIds.indexOf(region) < 0 && opts.requireJurisdiction !== false) return { ok: false, reason: 'jurisdiction_scope_denied', assignment: a, position: pos };
    return { ok: true, actor: ch, position: pos, assignment: a, delegated: false, authorityRef: a.appointmentId || key(pos.pos.id), basis: 'current_office' };
  }
  function makePlan(g, leave, applicant, approver, actionId) {
    var p = { version: 2, id: 'office-leave-plan:' + leave.id, type: 'office_leave', actorId: applicant.id, actor: applicant.name,
      targetId: approver.id, target: approver.name, intent: leave.reason || '申请离任', createdTurn: g.turn, updatedTurn: g.turn,
      progress: 0, messages: [], steps: [], knowledge: {}, status: 'in_transit', nextActorId: '', nextTurn: g.turn,
      officeTenure: { leaveId: leave.id, positionId: leave.positionId, organizationId: leave.organizationId, termsVersion: leave.termsVersion } };
    var msg = pushMessage(g, p, applicant, approver, 'leave_request', '申请以' + (leave.kind || '私人事由') + '离任，拟往' + (leave.destinationId || '未详地点') + '，第' + leave.startDay + '日至第' + leave.latestReturnDay + '日前归任。', { leaveId: leave.id, termsVersion: leave.termsVersion, terms: copy(leave.terms) }, g.turn + 1);
    p.knowledge[applicant.id] = { stage: 'sent', lastMessageId: msg.id, termsVersion: leave.termsVersion };
    p.nextActorId = approver.id; p.nextTurn = msg.deliveryTurn; g._npcPlans.push(p);
    return p;
  }
  function deliveredTo(p, id) { return !!(p && p.knowledge && p.knowledge[key(id)] && /^(delivered|responded|approved|rejected|handoff_received|returned)$/.test(p.knowledge[key(id)].stage)); }
  function markStep(g, pos, leave, d, phase) {
    var st = state(pos, true), row = { id: d.actionId + ':' + phase, actionId: d.actionId, phase: phase, actorId: key(d.actorId), day: day(g), termsVersion: leave.termsVersion };
    if (!Array.isArray(leave.steps)) leave.steps = [];
    if (leave.steps.some(function (x) { return x.id === row.id; })) return row;
    leave.steps.push(row); leave.lastActionId = d.actionId; st.lastActionId = d.actionId; return row;
  }
  function request(g, actor, d) {
    var pos = position(g, d.positionId, d.organizationId), a = assignment(g, actor, pos), c = cfg(pos), now = day(g);
    if (!pos || !a) return result('blocked', 'current_assignment_required');
    if (c.dutyMode === 'unconfigured') return result('blocked', 'position_tenure_not_configured');
    var destination = key(d.destinationId), resolved = resolveRegion(destination);
    if (!destination || !resolved || resolved.status !== 'resolved') return result('blocked', 'leave_destination_unresolved');
    var start = n(d.startDay, now), end = n(d.latestReturnDay, NaN), max = c.leave.maxDays;
    if (!isFinite(start) || !isFinite(end) || start < now || end <= start || end - start > max) return result('blocked', 'leave_terms_invalid');
    if (c.leave.allowedKinds.indexOf(d.kind || 'private') < 0) return result('blocked', 'leave_kind_not_allowed');
    if (c.leave.allowedLocations.length && c.leave.allowedLocations.indexOf(destination) < 0) return result('blocked', 'leave_location_out_of_scope');
    var from = currentRegion(actor), rr = route(from, destination, d.mode || 'land');
    if (!rr || rr.status !== 'reachable') return result('blocked', rr && rr.reason || 'leave_route_unavailable');
    var authority = c.leave.requiresApproval ? authorityTarget(g, pos) : actor;
    if (authority && authority.unresolved) return result('waiting', authority.reason, [{ kind: 'plan', id: 'office-tenure:' + pos.pos.id }]);
    if (!alive(authority)) return result('waiting', 'leave_authority_unavailable', [{ kind: 'plan', id: 'office-tenure:' + pos.pos.id }]);
    var st = state(pos, true), leave = { id: d.leaveId || nextId(g, 'office-leave'), positionId: key(pos.pos.id), organizationId: key(pos.organizationId), holderId: key(actor.id),
      kind: d.kind || 'private', reason: s(d.reason || '个人事务'), destinationId: destination, startDay: start, latestReturnDay: end,
      requestedDay: now, termsVersion: 1, status: c.leave.requiresApproval ? 'requested' : 'approved', deciderId: authority.id,
      authorityRef: c.leave.authorityRef || c.leave.decisionPositionId, terms: { destinationId: destination, startDay: start, latestReturnDay: end, kind: d.kind || 'private', reason: s(d.reason || '') },
      travelHistory: [], steps: [], returnLocationId: c.returnLocationId, autoReturn: d.autoReturn === true };
    st.leaves.push(leave);
    if (!c.leave.requiresApproval) { leave.approvedDay = now; leave.approvalReceivedDay = now; markStep(g, pos, leave, d, 'approve'); }
    var p = makePlan(g, leave, actor, authority, d.actionId);
    if (!c.leave.requiresApproval) {
      p.status = 'approved'; p.nextActorId = actor.id; p.nextTurn = g.turn;
      // A rule-based leave needs no approval message.  Mark the applicant's
      // own rule as known so departure still goes through the same submit and
      // evidence path without inventing a self-delivered request.
      p.messages.forEach(function (m) { m.status = 'delivered'; m.deliveredTurn = g.turn; m.deliveredDay = now; });
      p.knowledge[actor.id] = { stage: 'delivered', lastMessageId: p.messages[0] && p.messages[0].id || '', termsVersion: leave.termsVersion };
    }
    markStep(g, pos, leave, d, 'request');
    return result(c.leave.requiresApproval ? 'submitted' : 'started', c.leave.requiresApproval ? '离任申请已送达审批人' : '制度允许的离任已登记', [{ kind: 'office_tenure', id: d.actionId + ':request', requestId: leave.id, phase: 'request', positionId: pos.pos.id }], { leaveId: leave.id, planId: p.id, authorityRef: leave.authorityRef });
  }
  function decide(g, actor, d) {
    var pos = position(g, d.positionId, d.organizationId), leave = findLeave(pos, d.leaveId), p = leavePlan(g, leave), now = day(g);
    if (!pos || !leave || !p) return result('blocked', 'leave_request_unknown');
    var authority = authorityTarget(g, pos); if (!authority || authority.id !== actor.id) return result('blocked', 'leave_decision_authority_required');
    if (leave.status !== 'requested') return result('noop', 'leave_request_already_decided');
    if (!deliveredTo(p, actor.id)) return result('waiting', 'leave_request_not_received', [{ kind: 'plan', id: p.id }]);
    var decision = d.decision || d.response;
    if (!/^(approve|reject|conditions)$/.test(decision)) return result('blocked', 'leave_decision_required');
    if (decision === 'conditions') {
      var end = n(d.latestReturnDay, leave.latestReturnDay); if (!isFinite(end) || end <= leave.startDay || end - leave.startDay > cfg(pos).leave.maxDays) return result('blocked', 'leave_conditions_invalid');
      leave.latestReturnDay = end; leave.terms.latestReturnDay = end;
    }
    leave.status = decision === 'reject' ? 'rejected' : 'approved'; leave.approvedDay = now; leave.decision = decision; leave.deciderId = actor.id;
    leave.authorityRef = cfg(pos).leave.authorityRef || cfg(pos).leave.decisionPositionId;
    p.status = 'response_in_transit'; p.nextActorId = ''; p.nextTurn = g.turn + 1;
    var applicant = findChar(g, leave.holderId), msg = pushMessage(g, p, actor, applicant, 'leave_response', decision === 'reject' ? '离任申请未获准。' : decision === 'conditions' ? '离任获准，但归任期限已按当前条件确定。' : '离任申请已获准，请按规定期限归任。', { leaveId: leave.id, decision: decision, termsVersion: leave.termsVersion, terms: copy(leave.terms) }, g.turn + 1);
    p.knowledge[actor.id] = { stage: 'responded', lastMessageId: msg.id, termsVersion: leave.termsVersion };
    markStep(g, pos, leave, d, 'decide');
    note(g, actor, applicant, decision === 'reject' ? '已拒绝离任申请' : '已作出离任决定', msg.id);
    return result('submitted', decision === 'reject' ? '拒绝已发出，申请人尚待获知' : '许可已签发，待申请人收到', [{ kind: 'office_tenure', id: d.actionId + ':decide', requestId: leave.id, phase: 'decide', positionId: pos.pos.id }], { leaveId: leave.id, planId: p.id, decision: decision });
  }
  function delegate(g, actor, d) {
    var pos = position(g, d.positionId, d.organizationId), leave = findLeave(pos, d.leaveId), c = cfg(pos), now = day(g);
    if (!pos || !leave) return result('blocked', 'leave_request_unknown');
    if (leave.status !== 'approved') return result('blocked', 'leave_must_be_approved_before_delegation');
    var a = assignment(g, actor, pos); if (!a || key(actor.id) !== leave.holderId) return result('blocked', 'original_holder_delegation_required');
    if (!c.delegation.allowed) return result('blocked', 'delegation_not_granted_for_position');
    var delegate = findChar(g, d.delegateId); if (!alive(delegate) || delegate.id === actor.id) return result('blocked', 'delegate_identity_invalid');
    if (c.delegation.allowedPositionIds.length && !HS.activeAssignments(g, delegate, { organizationId: pos.organizationId }).some(function (x) { return c.delegation.allowedPositionIds.indexOf(key(x.positionId)) >= 0; })) return result('blocked', 'delegate_position_out_of_scope');
    var scope = A(d.scope || ['document_transfer']).map(s).filter(function (x) { return SCOPES.indexOf(x) >= 0 && c.delegation.allowedActions.indexOf(x) >= 0; });
    if (!scope.length || scope.length !== A(d.scope || ['document_transfer']).length) return result('blocked', 'delegation_scope_out_of_bounds');
    var st = state(pos, true), rec = { id: d.delegationId || nextId(g, 'office-delegation'), leaveId: leave.id, positionId: pos.pos.id, grantorId: actor.id,
      delegateId: delegate.id, scope: scope, regionId: d.regionId || pos.pos.jurisdictionId || '', startDay: now, endDay: Math.min(leave.latestReturnDay, now + c.delegation.maxDays),
      active: c.delegation.requiresAcceptance !== true, status: c.delegation.requiresAcceptance ? 'offered' : 'active', sourceActionId: d.actionId };
    st.delegations.push(rec); leave.delegateId = delegate.id; leave.delegationId = rec.id;
    var p = leavePlan(g, leave), msg = pushMessage(g, p, actor, delegate, 'delegation_offer', '请在第' + rec.endDay + '日前代办：' + scope.join('、') + '。', { leaveId: leave.id, delegationId: rec.id, scope: scope, termsVersion: leave.termsVersion }, g.turn + 1);
    p.officeTenure.delegationId = rec.id; p.status = 'handoff_in_transit';
    markStep(g, pos, leave, d, 'delegate');
    return result('submitted', '有限代办已提出，待代理人收悉并接手', [{ kind: 'office_tenure', id: d.actionId + ':delegate', requestId: leave.id, delegationId: rec.id, phase: 'delegate', positionId: pos.pos.id }], { leaveId: leave.id, delegationId: rec.id, messageId: msg.id });
  }
  function acceptDelegate(g, actor, d) {
    var pos = position(g, d.positionId, d.organizationId), leave = findLeave(pos, d.leaveId), rec = leave && findDelegation(pos, leave.delegationId), p = leave && leavePlan(g, leave);
    if (!pos || !leave || !rec || !p) return result('blocked', 'delegation_unknown');
    if (rec.delegateId !== actor.id || rec.status !== 'offered') return result('blocked', 'delegate_acceptance_required');
    if (!p.knowledge[actor.id] || p.knowledge[actor.id].stage !== 'delivered') return result('waiting', 'delegation_offer_not_received');
    rec.active = true; rec.status = 'active'; rec.acceptedDay = day(g); leave.status = 'approved';
    p.knowledge[actor.id].stage = 'handoff_received'; p.status = 'approved'; p.nextActorId = leave.holderId; p.nextTurn = g.turn;
    markStep(g, pos, leave, d, 'accept_delegate');
    return result('completed', '代理已在限定范围内接手', [{ kind: 'office_tenure', id: d.actionId + ':accept_delegate', requestId: leave.id, delegationId: rec.id, phase: 'accept_delegate', positionId: pos.pos.id }], { leaveId: leave.id, delegationId: rec.id });
  }
  function begin(g, actor, d) {
    var pos = position(g, d.positionId, d.organizationId), leave = findLeave(pos, d.leaveId), c = cfg(pos), now = day(g);
    if (!pos || !leave) return result('blocked', 'leave_request_unknown');
    if (leave.holderId !== key(actor.id)) return result('blocked', 'leave_holder_required');
    if (!/^(approved|at_destination)$/.test(leave.status)) return result('blocked', 'leave_not_ready_to_depart');
    var p = leavePlan(g, leave); if (!p || !deliveredTo(p, actor.id)) return result('waiting', 'leave_decision_not_received');
    if (now < leave.startDay) return result('waiting', 'leave_start_day_not_reached');
    if (c.leave.delegateRequired && !leave.delegationId) return result('blocked', 'required_handoff_missing');
    if (!TM.NPC || !TM.NPC.Meetings || !TM.NPC.Meetings.startExternalJourney) return result('blocked', 'shared_travel_service_unavailable');
    var ch = actor, journey = TM.NPC.Meetings.startExternalJourney(ch, { journeyId: 'journey:' + leave.id + ':outbound', planId: p.id, purpose: 'office_leave', phase: 'outbound', toRegionId: leave.destinationId, mode: d.mode || 'land', startAt: now });
    if (!journey || !/^(in_transit|arrived)$/.test(journey.status)) return result('blocked', journey && journey.reason || 'leave_route_unavailable');
    leave.status = journey.status === 'arrived' ? 'at_destination' : 'active'; leave.departedDay = now; leave.travelId = journey.id; leave.travelHistory = A(leave.travelHistory).concat([copy(journey)]);
    markStep(g, pos, leave, d, 'depart');
    return result('started', journey.status === 'arrived' ? '已抵达离任目的地' : '已按许可启程，正在途中', [{ kind: 'office_tenure', id: d.actionId + ':depart', requestId: leave.id, phase: 'depart', positionId: pos.pos.id, journeyId: journey.id }], { leaveId: leave.id, journey: journey });
  }
  function returnHome(g, actor, d) {
    var pos = position(g, d.positionId, d.organizationId), leave = findLeave(pos, d.leaveId), c = cfg(pos), now = day(g);
    if (!pos || !leave) return result('blocked', 'leave_request_unknown');
    if (leave.holderId !== key(actor.id) || !/^(active|at_destination|overdue)$/.test(leave.status)) return result('blocked', 'leave_not_returnable');
    var target = key(leave.returnLocationId || c.returnLocationId || c.usualDutyLocationId); if (!target) return result('blocked', 'return_location_unconfigured');
    if (!TM.NPC || !TM.NPC.Meetings || !TM.NPC.Meetings.startExternalJourney) return result('blocked', 'shared_travel_service_unavailable');
    var p = leavePlan(g, leave), j = TM.NPC.Meetings.startExternalJourney(actor, { journeyId: 'journey:' + leave.id + ':return', planId: p && p.id, purpose: 'return_to_duty', phase: 'return', toRegionId: target, mode: d.mode || 'land', startAt: now });
    if (!j || !/^(in_transit|arrived)$/.test(j.status)) return result('blocked', j && j.reason || 'return_route_unavailable');
    leave.status = j.status === 'arrived' ? 'returned_pending_report' : 'returning'; leave.returnStartedDay = now; leave.returnJourney = copy(j); leave.travelHistory = A(leave.travelHistory).concat([copy(j)]);
    markStep(g, pos, leave, d, 'return');
    return result('started', j.status === 'arrived' ? '已回到任所，待提交归任报告' : '已开始返任', [{ kind: 'office_tenure', id: d.actionId + ':return', requestId: leave.id, phase: 'return', positionId: pos.pos.id, journeyId: j.id }], { leaveId: leave.id, journey: j });
  }
  function report(g, actor, d) {
    var pos = position(g, d.positionId, d.organizationId), leave = findLeave(pos, d.leaveId);
    if (!pos || !leave) return result('blocked', 'leave_request_unknown');
    if (leave.status !== 'returned_pending_report') return result('waiting', 'physical_return_not_recorded');
    var authority = authorityTarget(g, pos); if (!authority || authority.id !== actor.id) return result('blocked', 'return_report_authority_required');
    leave.status = 'returned'; leave.reportedDay = day(g); leave.report = s(d.content || '已归任并交代在途事务');
    var st = state(pos, true); st.reports.push({ id: d.actionId, leaveId: leave.id, actorId: leave.holderId, receiverId: actor.id, day: day(g), content: leave.report });
    markStep(g, pos, leave, d, 'report');
    var p = leavePlan(g, leave); if (p) { p.status = 'done'; p.nextActorId = ''; }
    note(g, actor, findChar(g, leave.holderId), leave.report, d.actionId);
    return result('completed', '归任报告已核验，职责交接闭合', [{ kind: 'office_tenure', id: d.actionId + ':report', requestId: leave.id, phase: 'report', positionId: pos.pos.id }], { leaveId: leave.id });
  }
  function performDocument(g, actor, d) {
    var pos = position(g, d.positionId, d.organizationId), leave = findLeave(pos, d.leaveId), recipient = findChar(g, d.recipientId);
    if (!pos || !leave || !recipient) return result('blocked', 'delegated_document_target_unknown');
    var region = key(d.regionId || pos.pos.jurisdictionId || currentRegion(actor)), auth = canAct({ world: g, actor: actor, positionId: pos.pos.id, organizationId: pos.organizationId, action: 'document_transfer', regionId: region, day: day(g) });
    if (!auth.ok || !auth.delegated) return result('blocked', auth.reason || 'delegated_document_scope_denied');
    var body = s(d.content); if (!body) return result('blocked', 'delegated_document_content_required');
    var p = leavePlan(g, leave); if (!p) return result('blocked', 'leave_plan_unknown');
    if (!Array.isArray(leave.documents)) leave.documents = [];
    var doc = { id: d.documentId || nextId(g, 'office-document'), actionId: d.actionId, authorId: actor.id, recipientId: recipient.id, positionId: pos.pos.id,
      leaveId: leave.id, content: body, sourceRefs: copy(d.sourceRefs || []), status: 'in_transit', createdDay: day(g), deliveryDay: n(g.turn, 0) + 1 };
    leave.documents.push(doc);
    var msg = pushMessage(g, p, actor, recipient, 'delegated_document', body, { documentId: doc.id, leaveId: leave.id, positionId: pos.pos.id, sourceRefs: doc.sourceRefs }, doc.deliveryDay);
    doc.messageId = msg.id; markStep(g, pos, leave, d, 'perform_document');
    return result('submitted', '代理文书已按限定权限形成并递交，待收件人收悉', [{ kind: 'office_delegated_document', id: doc.id, requestId: leave.id, positionId: pos.pos.id, messageId: msg.id }], { leaveId: leave.id, documentId: doc.id, messageId: msg.id });
  }
  function execute(actor, target, d) {
    var g = G(); if (!g || !alive(actor)) return result('blocked', 'actor_unavailable');
    var phase = d.phase || d.step || 'request';
    if (phase === 'request') return request(g, actor, d);
    if (phase === 'decide') return decide(g, actor, d);
    if (phase === 'delegate') return delegate(g, actor, d);
    if (phase === 'accept_delegate') return acceptDelegate(g, actor, d);
    if (phase === 'depart') return begin(g, actor, d);
    if (phase === 'return') return returnHome(g, actor, d);
    if (phase === 'report') return report(g, actor, d);
    if (phase === 'perform_document') return performDocument(g, actor, d);
    return result('blocked', 'unsupported_office_tenure_phase');
  }
  function submit(actor, d, human) {
    if (!Ledger || !actor) return result('blocked', 'action_ledger_unavailable');
    var lease = Ledger.capture(), ctx = { _npcLease: lease }, handler = function (ch, target, data) { return execute(ch, target, data); };
    return human ? Ledger.executeHuman(actor, d, ctx, handler) : Ledger.execute(actor, d, ctx, handler);
  }
  function onMessageDelivered(p, m, g) {
    var leave = p && p.officeTenure && findLeave(position(g, p.officeTenure.positionId, p.officeTenure.organizationId), p.officeTenure.leaveId);
    if (!leave || !m) return false;
    m.status = 'delivered'; m.deliveredTurn = g.turn; m.deliveredDay = day(g); m.deliveryRef = { id: 'office-delivery:' + m.id, sourceMessageId: m.id, leaveId: leave.id, termsVersion: leave.termsVersion };
    p.knowledge[m.toId] = { stage: 'delivered', lastMessageId: m.id, termsVersion: leave.termsVersion };
    p.nextActorId = m.toId; p.nextTurn = g.turn;
    if (m.kind === 'leave_request') { p.status = 'awaiting_response'; leave.receivedBy = m.toId; leave.receivedDay = day(g); }
    else if (m.kind === 'leave_response') { leave.approvalReceivedDay = day(g); p.status = leave.status === 'rejected' ? 'rejected' : 'approved'; leave.applicantInformed = true; }
    else if (m.kind === 'delegation_offer') { p.status = 'handoff_ready'; }
    else if (m.kind === 'delegated_document') {
      var doc = A(leave.documents).find(function (x) { return x && x.messageId === m.id; });
      if (doc) { doc.status = 'delivered'; doc.deliveredDay = day(g); doc.deliveryRef = m.deliveryRef; note(g, findChar(g, doc.recipientId), findChar(g, doc.authorId), '收到代理文书：' + doc.content, doc.id, 'received_claim'); }
      p.status = 'awaiting_feedback';
    }
    addPlayerLetter(g, p, m, findChar(g, m.fromId), findChar(g, m.toId));
    return true;
  }
  function advancePlans(g) {
    var now = n(g && g.turn, 0), count = 0;
    A(g && g._npcPlans).filter(function (p) { return p && p.version === 2 && p.type === 'office_leave'; }).forEach(function (p) {
      A(p.messages).filter(function (m) { return m.status === 'in_transit' && n(m.deliveryTurn, Infinity) <= now; }).forEach(function (m) { if (onMessageDelivered(p, m, g)) count++; });
    });
    return { ok: true, delivered: count };
  }
  function tick(g, opts) {
    g = g || G(); if (!g) return { ok: false, reason: 'world_missing' };
    var now = n(opts && opts.toDay, day(g));
    if (TM.NPC && TM.NPC.Meetings && TM.NPC.Meetings.advanceExternalJourneys) TM.NPC.Meetings.advanceExternalJourneys(now);
    var moved = 0;
    A(g.officeTree).forEach(function () {});
    if (HS) HS.positions(g).forEach(function (row) {
      var st = state(row.pos, false); if (!st) return;
      A(st.leaves).forEach(function (leave) {
        if (!/^(active|returning)$/.test(leave.status)) return;
        var ch = findChar(g, leave.holderId), j = ch && ch._officeJourney;
        if (!j) return;
        if (j.status === 'arrived') { moved++; if (j.phase === 'return') { leave.status = 'returned_pending_report'; leave.returnJourney = copy(j); } else { leave.status = 'at_destination'; leave.travel = copy(j); } }
        if (now > leave.latestReturnDay && !/^(returned|returned_pending_report)$/.test(leave.status)) leave.status = 'overdue';
      });
    });
    return { ok: true, moved: moved };
  }
  function verifyEvidence(ref, d, actor, g, before) {
    if (!ref || !ref.kind || !g) return false;
    var pos = position(g, d.positionId, d.organizationId), leave = pos && findLeave(pos, ref.requestId), oldPos = before && position(before, d.positionId, d.organizationId), oldLeave = oldPos && findLeave(oldPos, ref.requestId);
    if (ref.kind === 'office_tenure') return !!(pos && leave && ref.id === d.actionId + ':' + ref.phase && leave.lastActionId === d.actionId && (!oldLeave || oldLeave.lastActionId !== d.actionId));
    if (ref.kind === 'office_delegated_document') {
      var doc = leave && A(leave.documents).find(function (x) { return x && x.id === ref.id && x.actionId === d.actionId; });
      var oldDoc = oldLeave && A(oldLeave.documents).some(function (x) { return x && x.id === ref.id; });
      return !!(doc && !oldDoc && doc.messageId === ref.messageId && doc.positionId === d.positionId);
    }
    return false;
  }
  function view(g, ch) {
    var out = []; if (!HS || !ch) return out;
    HS.assignments(g, ch).forEach(function (a) { var c = cfg(a.pos), st = state(a.pos, false), p = presence(g, ch, a, day(g)); out.push({ positionId: a.pos.id, organizationId: a.organizationId, dutyMode: c.dutyMode,
      usualDutyLocationId: c.usualDutyLocationId, jurisdictionIds: c.jurisdictionIds.slice(), presence: p, leave: st && A(st.leaves).filter(function (x) { return x.holderId === key(ch.id) && !/^(returned|rejected|withdrawn)$/.test(x.status); }).map(copy) || [], delegation: st && A(st.delegations).filter(function (x) { return x.delegateId === key(ch.id) && x.active; }).map(copy) || [] }); });
    return out;
  }
  function renderPanel() {
    var g = G(), ch = player(g); if (!g || !ch || !HS) return '';
    var rows = view(g, ch); if (!rows.length) return '';
    function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (x) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[x]; }); }
    var html = '<div data-office-tenure-panel style="margin:0 0 10px;padding:8px;border:1px solid var(--color-border-subtle);border-radius:6px;background:var(--color-surface-elevated);"><b>任职地域与在场</b>';
    rows.forEach(function (r) { var l = r.leave[0], label = r.positionId + ' · ' + (r.dutyMode === 'field' ? '巡历/奉差型' : r.dutyMode === 'resident' ? '驻任型' : '尚未配置'); html += '<div style="margin-top:5px;">' + esc(label) + ' · 通常驻地：' + esc(r.usualDutyLocationId || '未详') + ' · 当前：' + esc(r.presence.status) + (l ? ' · 离任：' + esc(l.status) + '<button class="bt bsm" data-office-tenure="report" data-position-id="' + esc(r.positionId) + '" data-leave-id="' + esc(l.id) + '">归任报告</button>' : '<button class="bt bsm" data-office-tenure="request" data-position-id="' + esc(r.positionId) + '">申请离任</button>') + '</div>'; });
    html += '</div>'; return html;
  }
  function uiRequest(positionId) { var g = G(), ch = player(g), dest = root.prompt ? root.prompt('目的地 ID（必须是已解析地块）', '') : ''; if (!dest) return; var start = Number(root.prompt('出发日（当前日为 ' + day(g) + '）', day(g))); var end = Number(root.prompt('最晚归任日', start + 5)); var r = submit(ch, { actionId: 'ui:leave:' + positionId + ':' + g.turn, behaviorType: 'office_tenure', phase: 'request', actorId: ch.id, positionId: positionId, destinationId: dest, startDay: start, latestReturnDay: end, kind: 'private', reason: '个人事务' }, true); if (root.toast) root.toast(r.reason); if (root.renderOfficeTree) root.renderOfficeTree(true); return r; }
  function uiReport(positionId, leaveId) { var g = G(), ch = player(g), r = submit(ch, { actionId: 'ui:report:' + leaveId + ':' + g.turn, behaviorType: 'office_tenure', phase: 'report', actorId: ch.id, positionId: positionId, leaveId: leaveId, content: '已归任并交代在途事务' }, true); if (root.toast) root.toast(r.reason); if (root.renderOfficeTree) root.renderOfficeTree(true); return r; }

  var API = { version: VERSION, config: cfg, state: state, view: view, presence: presence, canAct: canAct, authorityTarget: authorityTarget,
    requestLeave: function (actor, d, human) { return submit(actor, Object.assign({}, d, { behaviorType: 'office_tenure', phase: 'request', actorId: actor && actor.id, leaveKind: d && d.kind }), human === true); },
    decideLeave: function (actor, d, human) { return submit(actor, Object.assign({}, d, { behaviorType: 'office_tenure', phase: 'decide', actorId: actor && actor.id }), human === true); },
    appointDelegate: function (actor, d, human) { return submit(actor, Object.assign({}, d, { behaviorType: 'office_tenure', phase: 'delegate', actorId: actor && actor.id }), human === true); },
    acceptDelegate: function (actor, d, human) { return submit(actor, Object.assign({}, d, { behaviorType: 'office_tenure', phase: 'accept_delegate', actorId: actor && actor.id }), human === true); },
    beginLeave: function (actor, d, human) { return submit(actor, Object.assign({}, d, { behaviorType: 'office_tenure', phase: 'depart', actorId: actor && actor.id }), human === true); },
    returnLeave: function (actor, d, human) { return submit(actor, Object.assign({}, d, { behaviorType: 'office_tenure', phase: 'return', actorId: actor && actor.id }), human === true); },
    receiveReturnReport: function (actor, d, human) { return submit(actor, Object.assign({}, d, { behaviorType: 'office_tenure', phase: 'report', actorId: actor && actor.id }), human === true); },
    performDelegatedDocument: function (actor, d, human) { return submit(actor, Object.assign({}, d, { behaviorType: 'office_tenure', phase: 'perform_document', actorId: actor && actor.id }), human === true); },
    execute: execute, verifyEvidence: verifyEvidence, onMessageDelivered: onMessageDelivered, advancePlans: advancePlans, tick: tick, renderPanel: renderPanel, uiRequest: uiRequest, uiReport: uiReport,
    SCOPES: SCOPES };
  TM.OfficeTenure = API;
  if (root.NpcBehaviorRegistry && typeof root.NpcBehaviorRegistry.register === 'function') root.NpcBehaviorRegistry.register('office_tenure', function (actor, target, d) { return execute(actor, target, d); });
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
