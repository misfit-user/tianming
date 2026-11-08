'use strict';
// Production modules and real leave actions. Test dates are controlled here;
// the Electron suite separately proves the top-level calendar/save flow.
const assert = require('node:assert/strict');
const { dailyFixture } = require('./lib-npc-daily-fixture');

function world(options = {}) {
  const c = dailyFixture();
  c.GM.mapData = { locationBindingContract: { schema: 'source-text-location-v2' }, regions: [
    { id: 'east', name: '东城', geographicCenter: [116, 40], neighbors: ['mid'] },
    { id: 'mid', name: '中城', geographicCenter: [116.05, 40], neighbors: ['east', 'west'] },
    { id: 'west', name: '西城', geographicCenter: [116.1, 40], neighbors: ['mid'] }
  ] };
  c.add = (id, name) => c.actor(id, name, { location: '东城', regionId: 'east', publicIdentity: true, faction: '' });
  c.a = c.add('a', '甲'); c.b = c.add('b', '乙'); c.boss = c.add('boss', '核准者'); c.delegate = c.add('delegate', '代办者');
  c.GM.facs = [{ id: 'court', name: '本署所属组织' }];
  c.GM.affinityMap = { '甲|乙': 90 };
  c.GM.officeTree = [{ id: 'dept', authorityFactionId: 'court', positions: [
    { id: 'approver', holderId: 'boss', actualHolders: [{ characterId: 'boss', appointmentId: 'appointment:boss' }] },
    ...Array.from({ length: options.count == null ? 1 : options.count }, (_, i) => ({
      id: 'seat-' + i, holderId: 'a', actualHolders: [{ characterId: 'a', appointmentId: 'appointment:' + i }],
      officeTenure: { dutyMode: options.mode || 'resident', usualDutyLocationId: 'east', returnLocationId: 'east', jurisdictionIds: ['east'],
        onsiteActions: ['document_transfer'],
        leave: { requiresApproval: true, decisionPositionId: 'approver', maxDays: 40, allowedKinds: ['private', 'field_duty'], delegateRequired: !!options.delegate },
        delegation: { allowed: true, allowedActions: ['document_transfer'], maxDays: 40, requiresAcceptance: true } }
    }))
  ] }];
  c.seq = 0;
  c.office = (name, actor, data) => c.TM.OfficeTenure[name](actor, { actionId: 'office-test:' + (++c.seq), organizationId: 'court', ...data }, false);
  c.advance = (days = 1) => { c.P.time.daysPerTurn = days; const t = c.TM.SimTime.prepare(c.GM); c.GM.turn++; assert.equal(c.TM.SimTime.commit(c.GM, t).ok, true); c.deliver(); };
  c.request = (positionId = 'seat-0', extra = {}) => {
    const now = c.TM.SimTime.now(c.GM);
    const r = c.office('requestLeave', c.a, { positionId, destinationId: 'west', startDay: now, latestReturnDay: now + 30, kind: 'private', ...extra });
    assert.equal(r.outcome, 'submitted', r.reason); return r;
  };
  c.approve = r => { const p = c.GM._npcPlans.find(p => p.id === r.planId); const d = c.office('decideLeave', c.boss, { positionId: p.officeTenure.positionId, leaveId: r.leaveId, decision: 'approve' }); assert.equal(d.outcome, 'submitted', d.reason); return d; };
  c.permit = (positionId = 'seat-0', extra = {}) => { const r = c.request(positionId, extra); c.advance(); c.approve(r); c.advance(); return r; };
  c.invite = (extra = {}) => {
    const D = c.TM.NPC.DailyActivities;
    const r = D.submitNPC(c.a, { actionId: 'meeting-test:' + (++c.seq), activityKind: 'meeting', targetId: 'b',
      meeting: { locationId: 'west', requestedStartDay: c.TM.SimTime.now(c.GM) + 3, durationDays: 1, ...extra } });
    assert.equal(r.outcome, 'submitted', r.reason); c.deliver();
    let p = D.get(r.planId);
    const response = c.step(c.b, p, 'respond', 'accept'); assert.equal(response.outcome, 'submitted', response.reason); c.deliver();
    return D.get(r.planId);
  };
  return c;
}

let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.error('FAIL ' + name + '\n' + e.stack); } }

test('an issued but undelivered leave decision does not permit departure', () => {
  const c = world(), r = c.request(); c.advance(); c.approve(r);
  const p = c.invite({ actorOfficeConstraint: { positionId: 'seat-0', requiresLeave: false } });
  assert.equal(p.localActivity.meeting.actorJourney, undefined, 'the holder has not received the leave decision');
  assert.equal(p.localActivity.meeting.actorJourneyStatus, 'meeting_office_leave_not_received');
});

test('a new permission binds the actual appointment identity', () => {
  const c = world(), r = c.request();
  const leave = c.TM.OfficeTenure.state(c.GM.officeTree[0].positions[1], false).leaves.find(l => l.id === r.leaveId);
  assert.equal(leave.appointmentId, 'appointment:0');
});

test('no office is distinct from an incomplete rule or failed query', () => {
  const c = world({ count: 0 }); const p = c.invite();
  assert.equal(p.localActivity.meeting.actorJourney.status, 'in_transit');
  const missing = world(); delete missing.GM.officeTree[0].positions[1].officeTenure.usualDutyLocationId;
  assert.equal(missing.invite().localActivity.meeting.actorJourneyStatus, 'meeting_office_configuration_incomplete');
  const broken = world(), query = broken.TM.OfficeHolderState.assignments;
  broken.TM.OfficeHolderState.assignments = (g, ch, ref) => { if (ch.id === 'a') throw Error('test query failure'); return query(g, ch, ref); };
  assert.equal(broken.invite().localActivity.meeting.actorJourneyStatus, 'office_constraint_query_failed');
});

test('configured duties need a unique post and organization identity before departure', () => {
  for (const fault of ['missing-post', 'missing-organization', 'duplicate-scoped-id', 'nonexistent-organization', 'duplicate-organization']) {
    const c = world({ count: fault === 'duplicate-scoped-id' ? 2 : 1 });
    if (fault === 'missing-post') delete c.GM.officeTree[0].positions[1].id;
    if (fault === 'missing-organization') delete c.GM.officeTree[0].authorityFactionId;
    if (fault === 'duplicate-scoped-id') c.GM.officeTree[0].positions[2].id = 'seat-0';
    if (fault === 'nonexistent-organization') c.GM.officeTree[0].authorityFactionId = 'missing-explicit-org';
    if (fault === 'duplicate-organization') c.GM.facs.push({ id: 'court', name: '另一组织误用同一ID' });
    if (/^(nonexistent|duplicate)-organization$/.test(fault)) {
      c.GM.officeTree[0].positions[1].officeTenure.leave.requiresApproval = false;
      const r = c.office('requestLeave', c.a, { organizationId: c.GM.officeTree[0].authorityFactionId, positionId: 'seat-0', destinationId: 'west', startDay: 0, latestReturnDay: 20, kind: 'private' });
      assert.equal(r.outcome, 'started', 'an old standing-rule record does not supply a missing organization identity');
    }
    const read = c.TM.OfficeTenure.privateTravelDuties(c.GM, c.a);
    assert.equal(read.status, 'unknown', fault);
    assert.equal(read.reason, 'meeting_office_assignment_identity_unknown', fault);
    const p = c.invite();
    assert.equal(p.localActivity.meeting.actorJourney, undefined, fault + ' cannot erase an explicit duty');
    assert.equal(p.localActivity.meeting.actorJourneyStatus, read.reason, fault);
    assert.equal(c.TM.NPC.DailyActivities.exactLocation(c.a), 'east');
  }
  const legacy = world(); delete legacy.GM.officeTree[0].positions[1].officeTenure; delete legacy.GM.officeTree[0].positions[1].id;
  assert.equal(legacy.TM.OfficeTenure.privateTravelDuties(legacy.GM, legacy.a).rows[0].configurationStatus, 'legacy_unspecified');
  assert.equal(legacy.invite().localActivity.meeting.actorJourney.status, 'in_transit', 'this patch does not invent leave rules on entirely unconfigured legacy posts');
  const failedQuery = world(); failedQuery.TM.OfficeHolderState.positions = () => { throw Error('test positions query failure'); };
  assert.equal(failedQuery.TM.OfficeTenure.privateTravelDuties(failedQuery.GM, failedQuery.a).reason, 'office_constraint_query_failed');
});

test('same post IDs in distinct organizations retain separate lawful arrangements', () => {
  const c = world(), other = JSON.parse(JSON.stringify(c.GM.officeTree[0]));
  c.GM.facs.push({ id: 'other-court', name: '另一署所属组织' });
  other.id = 'other-dept'; other.authorityFactionId = 'other-court';
  other.positions[1].actualHolders[0].appointmentId = 'appointment:other'; c.GM.officeTree.push(other);
  assert.equal(c.TM.OfficeTenure.privateTravelDuties(c.GM, c.a).status, 'resolved');
  c.permit();
  const now = c.TM.SimTime.now(c.GM), r = c.office('requestLeave', c.a, { organizationId: 'other-court', positionId: 'seat-0', destinationId: 'west', startDay: now, latestReturnDay: now + 30, kind: 'private' });
  assert.equal(r.outcome, 'submitted', r.reason); c.advance();
  const approved = c.office('decideLeave', c.boss, { organizationId: 'other-court', positionId: 'seat-0', leaveId: r.leaveId, decision: 'approve' });
  assert.equal(approved.outcome, 'submitted', approved.reason); c.advance();
  const p = c.invite({ actorOfficeConstraint: { positionId: 'seat-0', organizationId: 'court', requiresLeave: false } });
  assert.equal(p.localActivity.meeting.actorJourney.status, 'in_transit');
});

test('resident private leave permits travel outside public jurisdiction and actual return', () => {
  const c = world(); c.permit(); const p = c.invite();
  assert.equal(p.localActivity.meeting.actorJourney.status, 'in_transit');
  assert.equal(c.TM.OfficeTenure.canAct({ world: c.GM, actorId: 'a', organizationId: 'court', positionId: 'seat-0', action: 'document_transfer', regionId: 'west' }).ok, false, 'private leave grants no public jurisdiction');
  c.advance(6);
  const done = c.TM.NPC.DailyActivities.get(p.id), a = c.TM.NPC.DailyActivities.person('a');
  assert.equal(done.localActivity.meeting.participation.locationId, 'west');
  assert.equal(done.localActivity.meeting.actorReturnJourney.status, 'returned');
  assert.equal(a.regionId, 'east');
  const history = JSON.stringify(done.localActivity.meeting.participation); c.deliver();
  assert.equal(JSON.stringify(c.TM.NPC.DailyActivities.get(p.id).localActivity.meeting.participation), history);
});

test('both appointments need actual permits; a relaxed hint cannot hide either one', () => {
  const c = world({ count: 2 }); c.permit('seat-0');
  let p = c.invite({ actorOfficeConstraint: { positionId: 'seat-0', requiresLeave: false } });
  assert.equal(p.localActivity.meeting.actorJourney, undefined);
  assert.equal(p.localActivity.meeting.actorJourneyStatus, 'meeting_office_leave_required');
  const second = c.permit('seat-1'); assert.ok(second.leaveId);
  p = c.TM.NPC.DailyActivities.get(p.id);
  const departed = c.step(c.TM.NPC.DailyActivities.person('a'), p, 'depart');
  assert.equal(departed.outcome, 'started', departed.reason);
  assert.equal(c.TM.NPC.DailyActivities.get(p.id).localActivity.meeting.actorJourney.status, 'in_transit');
});

test('permit scope, real return deadline, and appointment binding cannot be borrowed', () => {
  const late = world(); late.permit('seat-0', { latestReturnDay: 6 });
  assert.equal(late.invite().localActivity.meeting.actorJourneyStatus, 'meeting_office_leave_window_insufficient', 'the return journey also consumes the permitted window');
  const other = world(); other.permit();
  other.GM.officeTree[0].positions[1]._officeTenureState.leaves[0].holderId = 'b'; // malformed old-save boundary
  assert.equal(other.invite().localActivity.meeting.actorJourneyStatus, 'meeting_office_leave_required');
  const changed = world(); changed.permit();
  changed.GM.officeTree[0].positions[1].actualHolders[0].appointmentId = 'appointment:new'; // same-holder reappointment boundary
  assert.equal(changed.invite().localActivity.meeting.actorJourneyStatus, 'meeting_office_leave_required');
  const wrongDestination = world(); wrongDestination.permit('seat-0', { destinationId: 'mid' });
  assert.equal(wrongDestination.invite().localActivity.meeting.actorJourneyStatus, 'meeting_office_leave_destination_mismatch');
  const expired = world(); expired.GM.officeTree[0].positions[1].actualHolders[0].expiresTurn = 1;
  const r = expired.office('requestLeave', expired.a, { positionId: 'seat-0', destinationId: 'west', startDay: 0, latestReturnDay: 10, kind: 'private' });
  assert.equal(r.outcome, 'blocked');
  assert.equal(expired.invite({ actorOfficeConstraint: { positionId: 'seat-0' } }).localActivity.meeting.actorJourneyStatus, 'meeting_office_constraint_identity_mismatch');
});

test('field assignment is not a private exemption, but a real private arrangement works', () => {
  const c = world({ mode: 'field' }); c.a._officeFieldDuty = true;
  let p = c.invite(); assert.equal(p.localActivity.meeting.actorJourneyStatus, 'meeting_office_leave_required');
  c.permit(); p = c.TM.NPC.DailyActivities.get(p.id);
  const departed = c.step(c.TM.NPC.DailyActivities.person('a'), p, 'depart'); assert.equal(departed.outcome, 'started', departed.reason);
  const dispatch = world({ mode: 'field' }); dispatch.permit('seat-0', { kind: 'field_duty' });
  assert.equal(dispatch.invite().localActivity.meeting.actorJourneyStatus, 'meeting_office_private_purpose_required');
  const local = world({ mode: 'field' });
  const localMeeting = local.invite({ locationId: 'east' });
  assert.equal(localMeeting.localActivity.meeting.actorJourney.status, 'arrived', 'local private discussion is not public field authority');
});

test('required handoff needs delivered acceptance, scope, place and expiry', () => {
  const c = world({ delegate: true }); const r = c.permit();
  const offer = c.office('appointDelegate', c.a, { positionId: 'seat-0', leaveId: r.leaveId, delegateId: 'delegate', scope: ['document_transfer'] });
  assert.equal(offer.outcome, 'submitted');
  let p = c.invite(); assert.equal(p.localActivity.meeting.actorJourneyStatus, 'meeting_office_handoff_required');
  c.advance();
  const accepted = c.office('acceptDelegate', c.delegate, { positionId: 'seat-0', leaveId: r.leaveId }); assert.equal(accepted.outcome, 'completed', accepted.reason);
  p = c.TM.NPC.DailyActivities.get(p.id);
  const departed = c.step(c.TM.NPC.DailyActivities.person('a'), p, 'depart'); assert.equal(departed.outcome, 'started', departed.reason);
  const g = c.GM.officeTree[0].positions[1]._officeTenureState.delegations[0];
  assert.deepEqual(Array.from(g.scope), ['document_transfer']);
  assert.equal(c.TM.OfficeTenure.canAct({ world: c.GM, actorId: 'delegate', organizationId: 'court', positionId: 'seat-0', action: 'public_transfer', regionId: 'east' }).ok, false);
  c.advance(1);
  const doc = c.office('performDelegatedDocument', c.TM.NPC.DailyActivities.person('delegate'), { positionId: 'seat-0', leaveId: r.leaveId, recipientId: 'boss', content: '已按约转达现有材料。', sourceRefs: [{ kind: 'known_document', id: 'material-1' }] });
  assert.equal(doc.outcome, 'submitted', doc.reason);
  c.advance();
  const leave = c.GM.officeTree[0].positions[1]._officeTenureState.leaves.find(l => l.id === r.leaveId);
  assert.equal(leave.documents.find(d => d.id === doc.documentId).status, 'delivered');
});

test('a delegate cannot lend an unrelated, narrow, short or travelling handoff', () => {
  function handoff(extra = {}) {
    const c = world({ delegate: true });
    const rules = c.GM.officeTree[0].positions[1].officeTenure;
    rules.delegation.allowedActions = ['document_transfer', 'notice'];
    if (extra.maxDays) rules.delegation.maxDays = extra.maxDays;
    const r = c.permit();
    const offer = c.office('appointDelegate', c.a, { positionId: 'seat-0', leaveId: r.leaveId, delegateId: 'delegate', scope: extra.scope || ['document_transfer'] });
    assert.equal(offer.outcome, 'submitted'); c.advance();
    assert.equal(c.office('acceptDelegate', c.delegate, { positionId: 'seat-0', leaveId: r.leaveId }).outcome, 'completed');
    return c;
  }
  const narrow = handoff({ scope: ['notice'] });
  assert.equal(narrow.invite().localActivity.meeting.actorJourneyStatus, 'meeting_office_handoff_scope_incomplete');
  const short = handoff({ maxDays: 2 });
  assert.equal(short.invite().localActivity.meeting.actorJourneyStatus, 'meeting_office_handoff_required');
  const travelling = handoff();
  const journey = travelling.TM.NPC.Meetings.startExternalJourney(travelling.TM.NPC.DailyActivities.person('delegate'), { journeyId: 'handoff-negative-trip', planId: 'other-trip', purpose: 'private', toRegionId: 'mid', mode: 'land' });
  assert.equal(journey.status, 'in_transit');
  assert.equal(travelling.invite().localActivity.meeting.actorJourneyStatus, 'meeting_office_delegate_not_present');
  const unrelated = handoff();
  unrelated.GM.officeTree[0].positions[1]._officeTenureState.delegations[0].leaveId = 'unrelated-leave'; // invalid-save reference boundary
  assert.equal(unrelated.invite().localActivity.meeting.actorJourneyStatus, 'meeting_office_handoff_required');
});

test('an accepted onsite delegation constrains the delegate without granting all the post', () => {
  const c = world({ delegate: true }), r = c.permit();
  assert.equal(c.office('appointDelegate', c.a, { positionId: 'seat-0', leaveId: r.leaveId, delegateId: 'delegate', scope: ['document_transfer'] }).outcome, 'submitted');
  c.advance(); assert.equal(c.office('acceptDelegate', c.delegate, { positionId: 'seat-0', leaveId: r.leaveId }).outcome, 'completed');
  const duties = c.TM.OfficeTenure.privateTravelDuties(c.GM, c.delegate);
  assert.equal(duties.rows.length, 1); assert.ok(duties.rows[0].delegationId);
  c.GM.affinityMap['乙|代办者'] = 90;
  const D = c.TM.NPC.DailyActivities;
  const request = D.submitNPC(c.delegate, { actionId: 'delegate-own-meeting', activityKind: 'meeting', targetId: 'b', meeting: { locationId: 'west', requestedStartDay: c.TM.SimTime.now(c.GM) + 3, durationDays: 1 } });
  assert.equal(request.outcome, 'submitted', request.reason); c.deliver();
  let p = D.get(request.planId); assert.equal(c.step(c.b, p, 'respond', 'accept').outcome, 'submitted'); c.deliver(); p = D.get(request.planId);
  assert.equal(p.localActivity.meeting.actorJourneyStatus, 'meeting_office_delegate_duty_conflict');
});

test('saved permits and retries keep their evidence and do not grant a new appointment', () => {
  const c = world(), r = c.permit(), before = JSON.stringify(c.GM.officeTree[0].positions[1]._officeTenureState);
  // Serialization unit only. The formal Electron gate must additionally use
  // the real save menu and load path; this assertion is not that gate.
  c.GM = JSON.parse(JSON.stringify(c.GM));
  c.a = c.TM.NPC.DailyActivities.person('a'); c.b = c.TM.NPC.DailyActivities.person('b');
  c.boss = c.TM.NPC.DailyActivities.person('boss'); c.delegate = c.TM.NPC.DailyActivities.person('delegate');
  const p = c.invite(); assert.equal(p.localActivity.meeting.actorJourney.status, 'in_transit');
  c.deliver(); c.deliver();
  assert.equal(JSON.stringify(c.GM.officeTree[0].positions[1]._officeTenureState), before);
  assert.equal(c.GM._npcPlans.filter(x => x.officeTenure && x.officeTenure.leaveId === r.leaveId).length, 1);
  assert.equal(c.GM._npcPlans.filter(x => x.localActivity && x.localActivity.kind === 'meeting').length, 1);
  assert.equal(c.apiAttempts.length, 0);
});

test('the actual return follows the duty site, and conflicting return duties stay explicit', () => {
  const c = world(); c.a.location = '中城'; c.a.regionId = 'mid'; // declared starting location, before all actions
  c.permit();
  const D = c.TM.NPC.DailyActivities;
  const request = D.submitNPC(c.a, { actionId: 'return-to-duty-site', activityKind: 'meeting', targetId: 'b', meeting: { locationId: 'west', requestedStartDay: 6, durationDays: 1 } });
  assert.equal(request.outcome, 'submitted', request.reason); c.advance();
  let p = D.get(request.planId); assert.equal(c.step(c.b, p, 'respond', 'accept').outcome, 'submitted'); c.advance();
  p = D.get(request.planId); assert.equal(p.localActivity.meeting.actorHomeRegionId, 'east', 'return obligation is not the private departure location');
  c.advance(6); p = D.get(request.planId);
  assert.equal(p.localActivity.meeting.actorReturnJourney.toRegionId, 'east');
  assert.equal(D.person('a').regionId, 'east');
  const conflicting = world({ count: 2 }); conflicting.GM.officeTree[0].positions[2].officeTenure.returnLocationId = 'mid';
  conflicting.permit('seat-0'); conflicting.permit('seat-1');
  assert.equal(conflicting.invite().localActivity.meeting.actorJourneyStatus, 'meeting_office_return_locations_conflict');
});

test('a future departure permit waits until its date; standing private rules need no extra approver', () => {
  const c = world(); c.permit('seat-0', { startDay: 5 });
  let p = c.invite(); assert.equal(p.localActivity.meeting.actorJourneyStatus, 'meeting_office_leave_window_insufficient');
  c.advance(3); p = c.TM.NPC.DailyActivities.get(p.id);
  assert.equal(c.step(c.TM.NPC.DailyActivities.person('a'), p, 'depart').outcome, 'started');
  const routine = world(); routine.GM.officeTree[0].positions[1].officeTenure.leave.requiresApproval = false;
  const leave = routine.office('requestLeave', routine.a, { positionId: 'seat-0', destinationId: 'west', startDay: 0, latestReturnDay: 20, kind: 'private' });
  assert.equal(leave.outcome, 'started', leave.reason);
  assert.equal(routine.invite().localActivity.meeting.actorJourney.status, 'in_transit');
  const expired = world(); expired.permit(); expired.advance(29);
  assert.equal(expired.invite().localActivity.meeting.actorJourneyStatus, 'meeting_office_leave_window_insufficient');
});

test('the accepted target resumes locally after its real leave decision arrives', () => {
  const c = world(), pos = c.GM.officeTree[0].positions[1], D = c.TM.NPC.DailyActivities;
  pos.holderId = 'b'; pos.actualHolders = [{ characterId: 'b', appointmentId: 'appointment:target' }];
  const request = D.submitNPC(c.a, { actionId: 'target-permit-invitation', activityKind: 'meeting', targetId: 'b', meeting: { locationId: 'west', requestedStartDay: 6, durationDays: 1 } });
  assert.equal(request.outcome, 'submitted', request.reason); c.deliver();
  let p = D.get(request.planId); assert.equal(c.step(c.b, p, 'respond', 'accept').outcome, 'waiting'); c.deliver();
  const leave = c.office('requestLeave', c.b, { positionId: 'seat-0', destinationId: 'west', startDay: 0, latestReturnDay: 20, kind: 'private' });
  assert.equal(leave.outcome, 'submitted', leave.reason); c.advance(); c.approve(leave); c.advance();
  p = D.get(request.planId); assert.equal(D.view(p, D.person('b')).nextPhase, 'depart');
  c.load('tm-npc-local-ai.js'); c.advance(3);
  p = D.get(request.planId);
  assert.ok(p.localActivity.meeting.targetJourney && /^(in_transit|arrived)$/.test(p.localActivity.meeting.targetJourney.status), 'interval dispatch must give the permitted target an actual departure opportunity');
});

test('field duties inside their scope do not lose the original private-trip check on arrival', () => {
  const c = world({ mode: 'field' }), pos = c.GM.officeTree[0].positions[1];
  delete pos.officeTenure.usualDutyLocationId; pos.officeTenure.jurisdictionIds = ['east', 'mid', 'west'];
  c.a._officeFieldDuty = true; const permit = c.permit(); const p = c.invite();
  assert.equal(p.localActivity.meeting.actorJourney.status, 'in_transit'); c.advance();
  assert.equal(c.TM.NPC.DailyActivities.get(p.id).localActivity.meeting.actorJourney.status, 'arrived');
  // Exact boundary test of revoked permission between arrival and start.
  // The normal positive path above obtains its permit through real actions.
  pos._officeTenureState.leaves.find(l => l.id === permit.leaveId).status = 'withdrawn';
  c.advance(3);
  assert.equal(c.TM.NPC.DailyActivities.get(p.id).localActivity.meeting.participation, undefined, 'arrival within public field scope must not erase a private-trip obligation');
  const legal = world({ mode: 'field' }), rules = legal.GM.officeTree[0].positions[1].officeTenure;
  delete rules.usualDutyLocationId; rules.jurisdictionIds = ['east', 'mid', 'west'];
  legal.permit(); const accepted = legal.invite(); legal.advance(6);
  const returned = legal.TM.NPC.DailyActivities.get(accepted.id);
  assert.ok(returned.localActivity.meeting.participation);
  assert.equal(returned.localActivity.meeting.actorReturnJourney.status, 'returned');
  assert.equal(legal.TM.NPC.DailyActivities.person('a').regionId, 'east');
});

test('malformed appointment dates remain unknown instead of becoming unlimited', () => {
  const c = world(); c.GM.officeTree[0].positions[1].actualHolders[0].expiresTurn = '资料未详';
  const read = c.TM.OfficeTenure.privateTravelDuties(c.GM, c.a);
  assert.ok(read.status === 'unknown' || read.rows.some(r => r.configurationStatus === 'incomplete'), 'an explicit non-date expiry cannot become Infinity');
});

test('an invalid effective permit date cannot fall back to a superseded mirror', () => {
  const permit = world(); permit.permit(); permit.GM.officeTree[0].positions[1]._officeTenureState.leaves[0].terms.latestReturnDay = '资料未详';
  assert.equal(permit.invite().localActivity.meeting.actorJourneyStatus, 'meeting_office_leave_time_unknown', 'an invalid effective term cannot fall back to an older top-level mirror');
});

test('unknown active delegation dates do not erase the duty; expired and revoked mandates do', () => {
  function acceptedDelegate() {
    const c = world({ delegate: true }), r = c.permit();
    assert.equal(c.office('appointDelegate', c.a, { positionId: 'seat-0', leaveId: r.leaveId, delegateId: 'delegate', scope: ['document_transfer'] }).outcome, 'submitted');
    c.advance(); assert.equal(c.office('acceptDelegate', c.delegate, { positionId: 'seat-0', leaveId: r.leaveId }).outcome, 'completed');
    return c;
  }
  for (const field of ['startDay', 'endDay']) {
    const c = acceptedDelegate(), d = c.GM.officeTree[0].positions[1]._officeTenureState.delegations[0];
    assert.equal(c.TM.OfficeTenure.privateTravelDuties(c.GM, c.delegate).rows.length, 1);
    d[field] = '资料未详'; // explicit incomplete old-save boundary after a real handoff
    const read = c.TM.OfficeTenure.privateTravelDuties(c.GM, c.delegate);
    assert.ok(read.status === 'unknown' || read.rows.some(r => r.configurationStatus === 'incomplete'), field + ' must not erase a currently accepted mandate');
  }
  for (const fault of ['missing-post', 'missing-organization', 'duplicate-scoped-id', 'nonexistent-organization', 'duplicate-organization']) {
    const c = acceptedDelegate(), pos = c.GM.officeTree[0].positions[1];
    if (fault === 'missing-post') delete pos.id;
    if (fault === 'missing-organization') delete c.GM.officeTree[0].authorityFactionId;
    if (fault === 'duplicate-scoped-id') c.GM.officeTree[0].positions.push({ ...pos, actualHolders: [{ characterId: 'boss', appointmentId: 'other-appointment' }], _officeTenureState: undefined });
    if (fault === 'nonexistent-organization') c.GM.officeTree[0].authorityFactionId = 'missing-explicit-org';
    if (fault === 'duplicate-organization') c.GM.facs.push({ id: 'court', name: '另一组织误用同一ID' });
    const read = c.TM.OfficeTenure.privateTravelDuties(c.GM, c.delegate);
    assert.ok(read.status === 'unknown' || read.rows.some(r => r.configurationStatus === 'incomplete'), fault + ' must not erase an active accepted onsite mandate');
  }
  const expired = acceptedDelegate(), old = expired.GM.officeTree[0].positions[1]._officeTenureState.delegations[0];
  expired.advance(old.endDay - expired.TM.SimTime.now(expired.GM));
  assert.equal(expired.TM.OfficeTenure.privateTravelDuties(expired.GM, expired.TM.NPC.DailyActivities.person('delegate')).rows.length, 0);
  const revoked = acceptedDelegate(), ended = revoked.GM.officeTree[0].positions[1]._officeTenureState.delegations[0];
  ended.active = false; ended.status = 'revoked'; ended.endDay = '资料未详';
  assert.equal(revoked.TM.OfficeTenure.privateTravelDuties(revoked.GM, revoked.delegate).rows.length, 0);
});

test('two real resident permits cover sourced onsite discussion and the actual return', () => {
  const c = world({ count: 2 }), D = c.TM.NPC.DailyActivities;
  assert.equal((c.a.localGoals || []).length, 0, 'the source is a performed activity, not a prefilled plan');
  const source = D.submitNPC(c.a, { actionId: 'office-composite:source', activityKind: 'assistance', targetId: c.b.id,
    task: { kind: 'material_summary', title: 'Read the supplied identity material', materialRefs: [{ kind: 'character_public', characterId: c.a.id }] } });
  assert.equal(source.outcome, 'submitted', source.reason);
  c.advance(); let sourcePlan = D.get(source.planId);
  assert.equal(c.step(c.b, sourcePlan, 'respond', 'accept').outcome, 'submitted');
  c.advance(); sourcePlan = D.get(source.planId);
  assert.equal(c.step(c.b, sourcePlan, 'perform').outcome, 'submitted');
  c.advance(); sourcePlan = D.get(source.planId);
  assert.equal(c.step(c.a, sourcePlan, 'feedback', 'satisfied').outcome, 'completed');
  c.advance(); sourcePlan = D.get(source.planId);
  assert.equal(sourcePlan.status, 'done');
  assert.equal(sourcePlan.localActivity.documents[0].receivedBy, c.a.id);
  const opportunity = D.consultationOpportunities(D.person(c.a.id)).find(row => row.action.targetId === c.b.id);
  assert(opportunity, 'the actual received assistance supplies a discussion purpose');
  const permits = [c.permit('seat-0'), c.permit('seat-1')];
  c.load('tm-npc-local-ai.js');
  const request = D.submitNPC(D.person(c.a.id), { actionId: 'office-composite:meeting', activityKind: 'meeting', targetId: c.b.id,
    meeting: { locationId: 'west', requestedStartDay: D.day() + 4, durationDays: 2, windowDays: 3,
      discussion: opportunity.action.consultation } });
  assert.equal(request.outcome, 'submitted', request.reason);
  c.advance(12);
  const current = D.get(request.planId), m = current.localActivity.meeting;
  assert.equal(current.status, 'done');
  assert.equal(m.targetDecision.response, 'accept', 'the local participant independently accepts');
  assert(current.messages.some(message => message.kind === 'meeting_response' && message.status === 'delivered'));
  assert.equal(m.discussion.status, 'completed');
  assert.equal(current.steps.filter(step => step.phase === 'discuss').length, 1);
  assert.equal(current.steps.filter(step => step.phase === 'discuss_response').length, 1);
  assert(m.discussion.result.actorContent && m.discussion.result.targetContent, 'both participants actually contribute content');
  assert.equal(m.participation.discussion.result.sourcePlanId, current.id);
  assert.equal(m.actorReturnJourney.status, 'returned');
  assert.equal(m.actorReturnJourney.toRegionId, 'east');
  assert.equal(m.targetReturnJourney.status, 'returned');
  assert.equal(D.exactLocation(D.person(c.a.id)), 'east');
  assert.equal(D.exactLocation(D.person(c.b.id)), 'east');
  const evidence = JSON.stringify({ participation: m.participation, discussion: m.discussion, steps: current.steps });
  c.deliver();
  const replay = D.get(request.planId).localActivity.meeting;
  assert.equal(JSON.stringify({ participation: replay.participation, discussion: replay.discussion, steps: D.get(request.planId).steps }), evidence, 'a replay cannot repeat the discussion or its effects');
  assert.equal(c.apiAttempts.length, 0);
  console.log(JSON.stringify({ fixture: 'resident-composite-with-two-permits', sourcePlanId: source.planId,
    permitPlanIds: permits.map(permit => permit.planId), meetingPlanId: current.id,
    startedDay: m.startedDay, resultDay: m.discussion.result.day, endDay: m.endDay,
    actorReturnDay: m.actorReturnJourney.arrivedDay, resultId: m.discussion.result.id, modelAttempts: c.apiAttempts.length }));
});

console.log(JSON.stringify({ suite: 'npc-meeting-office', passed, failed }));
if (failed) process.exitCode = 1;
