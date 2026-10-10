'use strict';
const assert = require('node:assert/strict');
const { dailyFixture } = require('./lib-npc-daily-fixture');

function world(threeNodes) {
  const c = dailyFixture();
  c.GM.mapData = { locationBindingContract: { schema: 'source-text-location-v2' }, regions: threeNodes ? [
    { id: 'east', name: '东城', geographicCenter: [116, 40], neighbors: ['mid'] },
    { id: 'mid', name: '中城', geographicCenter: [116.5, 40], neighbors: ['east', 'west'] },
    { id: 'west', name: '西城', geographicCenter: [117, 40], neighbors: ['mid'] }
  ] : [
    { id: 'east', name: '东城', geographicCenter: [116, 40], neighbors: ['west'] },
    { id: 'west', name: '西城', geographicCenter: [117, 40], neighbors: ['east'] },
    { id: 'island', name: '孤岛', geographicCenter: [130, 40], neighbors: [] }
  ] };
  c.add = (id, name, extra = {}) => c.actor(id, name, {
    location: id === 'b' ? '西城' : '东城', publicIdentity: true, faction: '', ...extra
  });
  c.testSequence = 0;
  c.step = (actor, p, phase, response) => c.TM.NPC.DailyActivities.submitNPC(actor, {
    actionId: 'meeting-step-' + (++c.testSequence), planId: p.id, phase, response,
    expectedRevision: p.localActivity.revision, termsVersion: p.localActivity.termsVersion
  });
  return c;
}

function advance(c, days) {
  c.GM.turn += days;
  c.advanceCharTravelByDays(days); // low-level fixture: local meetings advance in ActionLedger
  const r = c.TM.NPC.ActionLedger.advance(c.GM);
  assert.equal(r.ok, true, r.reason);
}

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS ' + name); }

test('strict route separates distance, mode and unknown/unreachable states', () => {
  const c = world(), R = c.TM.MapRouteDays;
  const r = R.planRoute(c.GM.mapData, 'east', 'west', { mode: 'walking' });
  assert.equal(r.status, 'reachable'); assert.equal(r.path.join(','), 'east,west'); assert(r.km > 0 && r.days > 0);
  assert.equal(r.estimated, false);
  assert.equal(R.planRoute(c.GM.mapData, 'east', 'island').status, 'unreachable');
  assert.equal(R.planRoute(c.GM.mapData, 'missing', 'west').status, 'unresolved');
  assert.equal(JSON.stringify(c.GM.mapData.regions[0].neighbors), '["west"]');
});

test('undelivered invitation is invisible and acceptance does not remotely start requester', () => {
  const c = world(), a = c.add('a', '甲'), b = c.add('b', '乙');
  c.GM.affinityMap = { '甲|乙': 70 };
  const req = c.TM.NPC.DailyActivities.submitNPC(a, {
    actionId: 'meeting-knowledge', activityKind: 'meeting', targetId: b.id,
    meeting: { locationId: 'west', requestedStartDay: 8, durationDays: 2 }
  });
  const p = c.TM.NPC.DailyActivities.get(req.planId);
  assert.equal(c.TM.NPC.Meetings.view(p, b), null);
  advance(c, 3);
  assert.ok(c.TM.NPC.Meetings.view(p, b));
  const reply = c.TM.NPC.DailyActivities.submitNPC(b, {
    actionId: 'meeting-knowledge-response', planId: p.id, phase: 'respond', response: 'accept',
    expectedRevision: p.localActivity.revision, termsVersion: p.localActivity.termsVersion
  });
  assert.equal(reply.outcome, 'submitted');
  assert.equal(a._travelTo, undefined);
  assert.equal(p.localActivity.meeting.actorJourney, undefined);
  assert.equal(p.localActivity.meeting.targetJourney.status, 'arrived');
  assert.equal(p.knowledge.a.stage, 'sent');
});

test('formal timing requires arrival, start time and full duration before participation', () => {
  const c = world(), a = c.add('a', '甲'), b = c.add('b', '乙');
  c.GM.affinityMap = { '甲|乙': 70 };
  const req = c.TM.NPC.DailyActivities.submitNPC(a, {
    actionId: 'meeting-duration', activityKind: 'meeting', targetId: b.id,
    meeting: { locationId: 'west', requestedStartDay: 8, durationDays: 2, windowDays: 5 }
  });
  const p = c.TM.NPC.DailyActivities.get(req.planId);
  advance(c, 3);
  assert.equal(c.TM.NPC.DailyActivities.submitNPC(b, {
    actionId: 'meeting-duration-response', planId: p.id, phase: 'respond', response: 'accept',
    expectedRevision: p.localActivity.revision, termsVersion: p.localActivity.termsVersion
  }).outcome, 'submitted');
  advance(c, 3); // response reaches the requester; actor starts only now
  assert.equal(a.location, '东城'); assert.equal(p.localActivity.meeting.participation, undefined);
  advance(c, 3); // actor reaches the venue around day 9; the appointment begins
  assert.equal(p.localActivity.meeting.status, 'in_meeting');
  assert.equal(p.localActivity.meeting.participation, undefined);
  advance(c, 1);
  assert.equal(p.localActivity.meeting.status, 'in_meeting');
  assert.equal(p.localActivity.meeting.participation, undefined);
  advance(c, 1);
  assert.equal(p.localActivity.meeting.status, 'returning');
  assert.equal(p.localActivity.meeting.participation.durationDays, 2);
  assert.ok(p.localActivity.meeting.actorReturnJourney);
  assert.ok(p.localActivity.meeting.actorJourney, 'outbound journey is retained');
});

test('one long committed interval and segmented intervals keep the same meeting timeline', () => {
  function run(segmented) {
    const c = world(), a = c.add('a', '甲'), b = c.add('b', '乙');
    c.GM.affinityMap = { '甲|乙': 70 };
    const req = c.TM.NPC.DailyActivities.submitNPC(a, {
      actionId: 'meeting-segment-equivalence', activityKind: 'meeting', targetId: b.id,
      meeting: { locationId: 'west', requestedStartDay: 8, durationDays: 2, windowDays: 6 }
    });
    const p = c.TM.NPC.DailyActivities.get(req.planId);
    advance(c, 3);
    c.TM.NPC.DailyActivities.submitNPC(b, {
      actionId: 'meeting-segment-equivalence-response', planId: p.id, phase: 'respond', response: 'accept',
      expectedRevision: p.localActivity.revision, termsVersion: p.localActivity.termsVersion
    });
    if (segmented) for (let i = 0; i < 12; i++) advance(c, 1); else advance(c, 12);
    const current = c.TM.NPC.DailyActivities.get(p.id), m = current.localActivity.meeting;
    return { status: m.status, start: m.startedDay, end: m.endDay, participation: m.participation && m.participation.durationDays, discussionOutcome: m.participation && m.participation.discussion && m.participation.discussion.outcome,
      actor: a.location, target: b.location, returned: current.status };
  }
  assert.deepEqual(run(true), run(false));
  const longRun = run(false);
  assert.equal(longRun.status, 'returned');
  assert.equal(longRun.discussionOutcome, null);
  assert.equal(longRun.returned, 'ended');
});

test('route segment progress, roadblock and cancellation do not teleport or clear the other journey', () => {
  const c = world(true), a = c.add('a', '甲'), b = c.add('b', '乙');
  c.GM.affinityMap = { '甲|乙': 70 };
  const req = c.TM.NPC.DailyActivities.submitNPC(a, {
    actionId: 'meeting-roadblock-v2', activityKind: 'meeting', targetId: b.id,
    meeting: { locationId: 'west', requestedStartDay: 4, durationDays: 1 }
  });
  const p = c.TM.NPC.DailyActivities.get(req.planId);
  advance(c, 3);
  c.TM.NPC.DailyActivities.submitNPC(b, {
    actionId: 'meeting-roadblock-v2-response', planId: p.id, phase: 'respond', response: 'accept',
    expectedRevision: p.localActivity.revision, termsVersion: p.localActivity.termsVersion
  });
  advance(c, 3); // response delivery and actor departure
  const outbound = p.localActivity.meeting.actorJourney;
  assert.equal(outbound.status, 'in_transit');
  assert.equal(outbound.segmentIndex, 0);
  c.GM.mapData.regions[0].neighbors = [];
  c.TM.NPC.Meetings.beforeTravelAdvance();
  assert.equal(outbound.status, 'blocked');
  assert.equal(p.localActivity.meeting.status, 'roadblocked');
  assert.equal(a.location, '东城');
  const cancel = c.TM.NPC.DailyActivities.submitNPC(a, {
    actionId: 'meeting-roadblock-v2-cancel', planId: p.id, phase: 'cancel',
    expectedRevision: p.localActivity.revision, termsVersion: p.localActivity.termsVersion
  });
  assert.equal(cancel.outcome, 'submitted');
  assert.equal(a.location, '东城');
  assert.equal(p.localActivity.meeting.targetJourney.status, 'arrived');
});

test('invalid terms, stale response and test-only local clock are explicit', () => {
  const c = world(), a = c.add('a', '甲'), b = c.add('b', '乙');
  c.GM.affinityMap = { '甲|乙': 70 };
  const bad = c.TM.NPC.DailyActivities.submitNPC(a, {
    actionId: 'meeting-invalid', activityKind: 'meeting', targetId: b.id,
    meeting: { locationId: 'west', durationDays: 0 }
  });
  assert.equal(bad.outcome, 'blocked');
  c.GM._tmTravelTestHarness = false;
  assert.equal(c.TM.NPC.Meetings.advanceLocalDays(1).reason, 'formal_time_entry_required');
  const req = c.TM.NPC.DailyActivities.submitNPC(a, {
    actionId: 'meeting-stale', activityKind: 'meeting', targetId: b.id,
    meeting: { locationId: 'west', requestedStartDay: 8 }
  });
  const p = c.TM.NPC.DailyActivities.get(req.planId); advance(c, 3);
  const stale = c.TM.NPC.DailyActivities.submitNPC(b, {
    actionId: 'meeting-stale-response', planId: p.id, phase: 'respond', response: 'accept',
    expectedRevision: p.localActivity.revision, termsVersion: p.localActivity.termsVersion + 1
  });
  assert.equal(stale.outcome, 'expired');
});

test('defer response is delivered against the current terms and creates a new proposal version', () => {
  const c = world(), a = c.add('a', '甲'), b = c.add('b', '乙');
  c.GM.affinityMap = { '甲|乙': 70 };
  const req = c.TM.NPC.DailyActivities.submitNPC(a, {
    actionId: 'meeting-defer-version', activityKind: 'meeting', targetId: b.id,
    meeting: { locationId: 'west', requestedStartDay: 8, durationDays: 1, windowDays: 3 }
  });
  const p = c.TM.NPC.DailyActivities.get(req.planId);
  advance(c, 3);
  const deferred = c.TM.NPC.DailyActivities.submitNPC(b, {
    actionId: 'meeting-defer-version-response', planId: p.id, phase: 'respond', response: 'defer',
    expectedRevision: p.localActivity.revision, termsVersion: p.localActivity.termsVersion
  });
  assert.equal(deferred.outcome, 'submitted');
  advance(c, 3);
  assert.equal(p.localActivity.meeting.status, 'deferred');
  assert.equal(p.localActivity.meeting.targetDecision.response, 'defer');
  const oldVersion = p.localActivity.termsVersion;
  const rescheduled = c.TM.NPC.DailyActivities.submitNPC(a, {
    actionId: 'meeting-defer-version-reschedule', planId: p.id, phase: 'reschedule',
    expectedRevision: p.localActivity.revision, termsVersion: oldVersion
  });
  assert.equal(rescheduled.outcome, 'submitted');
  assert.equal(p.localActivity.termsVersion, oldVersion + 1);
  assert.equal(p.localActivity.meeting.status, 'invitation_in_transit');
});

test('relationship IDs work without affinity and automatic material selection skips private memory', () => {
  const c = world(), a = c.add('a', '甲', { fatherId: 'b', _memory: [{ id: 'secret', event: '私密经历' }] }), b = c.add('b', '乙');
  assert.equal(c.TM.NPC.DailyActivities.relationKind(a, b), 'family');
  assert.equal(c.TM.NPC.DailyActivities.relationshipIds({ characterId: 'missing' }, c.GM).length, 0);
  assert.equal(c.TM.NPC.DailyActivities.selectMaterial(a, {}), null);
});

test('one meeting plan carries a sourced onsite consultation and returns both participants', () => {
  const c = world(), D = c.TM.NPC.DailyActivities;
  c.load('tm-npc-local-ai.js');
  const actor = c.add('a', '甲'), intermediary = c.add('b', '乙'), teacher = c.add('c', '丙');
  actor.location = intermediary.location = teacher.location = '东城';
  c.GM.affinityMap = { '甲|乙': 90, '丙|乙': 90, '丙|甲': 90 };
  let source = D.submitNPC(actor, { actionId: 'composite-intro', activityKind: 'introduction', targetId: intermediary.id, thirdPartyId: teacher.id });
  assert.equal(source.outcome, 'submitted', source.reason); c.deliver();
  let intro = D.get(source.planId);
  assert.equal(D.submitNPC(intermediary, { actionId: 'composite-intro-r', planId: intro.id, phase: 'respond', response: 'accept', expectedRevision: intro.localActivity.revision, termsVersion: intro.localActivity.termsVersion }).outcome, 'submitted'); c.deliver(); intro = D.get(intro.id);
  assert.equal(D.submitNPC(intermediary, { actionId: 'composite-intro-f', planId: intro.id, phase: 'forward', expectedRevision: intro.localActivity.revision, termsVersion: intro.localActivity.termsVersion }).outcome, 'submitted'); c.deliver(); intro = D.get(intro.id);
  assert.equal(D.submitNPC(teacher, { actionId: 'composite-intro-t', planId: intro.id, phase: 'respond', response: 'accept', expectedRevision: intro.localActivity.revision, termsVersion: intro.localActivity.termsVersion }).outcome, 'submitted'); c.deliver(); intro = D.get(intro.id);
  assert.equal(D.submitNPC(intermediary, { actionId: 'composite-intro-report', planId: intro.id, phase: 'report', expectedRevision: intro.localActivity.revision, termsVersion: intro.localActivity.termsVersion }).outcome, 'submitted'); c.deliver();
  c.GM.turn = 2;
  const opportunity = c.TM.NPC.LocalAI.candidates(actor, [intro]).find(x => x.action && x.action.activityKind === 'consultation');
  assert(opportunity && opportunity.action.consultation, 'the meeting purpose must come from the completed contact');
  const request = D.submitNPC(actor, { actionId: 'composite-meeting', activityKind: 'meeting', targetId: teacher.id,
    meeting: { locationId: 'east', requestedStartDay: 2, durationDays: 1, purpose: '相约读札／当面请益', discussion: opportunity.action.consultation } });
  assert.equal(request.outcome, 'submitted', request.reason); let p = D.get(request.planId); c.deliver();
  const reply = D.submitNPC(teacher, { actionId: 'composite-meeting-reply', planId: p.id, phase: 'respond', response: 'accept', expectedRevision: p.localActivity.revision, termsVersion: p.localActivity.termsVersion });
  assert.equal(reply.outcome, 'submitted', reply.reason); c.deliver();
  assert.notEqual(p.localActivity.meeting.status, 'in_meeting', 'acceptance before the agreed day must still wait');
  advance(c, 1); // arrive at the agreed start day before speaking
  assert.equal(p.localActivity.meeting.status, 'in_meeting');
  // A stale arrived flag or a matching old region is not enough.  If the
  // other participant has actually left, the question cannot be recorded.
  let currentTeacher = D.person(teacher.id, c.GM);
  currentTeacher.location = '西城'; currentTeacher.regionId = 'west'; currentTeacher.mapRegionId = 'west'; currentTeacher._travelCurrentRegionId = 'west';
  const unavailable = D.submitNPC(actor, { actionId: 'composite-discuss-away', planId: p.id, phase: 'discuss', exchangeChoice: 'question', expectedRevision: p.localActivity.revision, termsVersion: p.localActivity.termsVersion });
  assert.equal(unavailable.outcome, 'blocked');
  assert.equal(unavailable.reason, 'meeting_discussion_participant_unavailable');
  currentTeacher = D.person(teacher.id, c.GM);
  currentTeacher.location = '东城'; currentTeacher.regionId = 'east'; currentTeacher.mapRegionId = 'east'; currentTeacher._travelCurrentRegionId = 'east';
  const discuss = D.submitNPC(actor, { actionId: 'composite-discuss', planId: p.id, phase: 'discuss', exchangeChoice: 'question', expectedRevision: p.localActivity.revision, termsVersion: p.localActivity.termsVersion });
  assert.equal(discuss.outcome, 'submitted', discuss.reason);
  const targetView = D.view(D.get(p.id), D.person(teacher.id, c.GM));
  assert(targetView && targetView.meeting && targetView.meeting.discussion.heardContent, 'the target sees the spoken onsite question only after it occurs');
  const currentAfterQuestion = D.get(p.id);
  const answer = D.submitNPC(teacher, { actionId: 'composite-discuss-answer', planId: p.id, phase: 'discuss_response', response: 'answer', expectedRevision: currentAfterQuestion.localActivity.revision, termsVersion: currentAfterQuestion.localActivity.termsVersion });
  assert.equal(answer.outcome, 'submitted', answer.reason);
  advance(c, 1);
  p = D.get(p.id);
  assert.equal(p.localActivity.meeting.discussion.status, 'completed');
  assert(p.localActivity.meeting.participation && p.localActivity.meeting.participation.discussion.result);
  assert.equal(p.status, 'done');
  assert.equal(c.TM.NPC.Meetings.topicHistory(actor, opportunity.action.consultation.topicId), 1);
  assert.equal(c.TM.NPC.Meetings.topicHistory(actor, opportunity.action.consultation.topicId), 1, 'reading the result is idempotent');
});

test('the same meeting reads actual office constraints for allowed and leave-required holders', () => {
  const c = world(), D = c.TM.NPC.DailyActivities, actor = c.add('a', '甲'), leaveHolder = c.add('d', '丁'), target = c.add('b', '乙'), target2 = c.add('e', '戊');
  target2.location = '西城'; target2.regionId = 'west'; target2.mapRegionId = 'west';
  c.GM.affinityMap = { '甲|乙': 80, '丁|戊': 80 };
  c.GM.officeTree = [{ id: 'dept', organizationId: 'org', name: '署', positions: [
    { id: 'seat-ok', name: '主官甲', holderId: actor.id, holder: actor.name,
      actualHolders: [{ characterId: actor.id, name: actor.name, appointmentId: 'appt-ok' }], appointmentId: 'appt-ok',
      officeTenure: { dutyMode: 'resident', usualDutyLocationId: 'east', leave: { requiresApproval: true } } },
    { id: 'seat-leave', name: '主官丁', holderId: leaveHolder.id, holder: leaveHolder.name,
      actualHolders: [{ characterId: leaveHolder.id, name: leaveHolder.name, appointmentId: 'appt-leave' }], appointmentId: 'appt-leave',
      officeTenure: { dutyMode: 'resident', usualDutyLocationId: 'east', leave: { requiresApproval: true } } }
  ] }];
  // The first positive branch has a real, person/position-bound leave
  // arrangement.  The activity hint below is deliberately looser; it must
  // not be able to erase this actual duty requirement.
  c.GM.officeTree[0].positions[0]._officeTenureState = { version: 1, sequence: 1, leaves: [{
    id: 'leave-ok', positionId: 'seat-ok', organizationId: 'org', holderId: actor.id,
    status: 'approved', applicantInformed: true, termsVersion: 1,
    terms: { destinationId: 'west', startDay: 0, latestReturnDay: 20 }
  }], delegations: [], reports: [] };
  const allowed = D.submitNPC(actor, { actionId: 'office-constrained-allowed', activityKind: 'meeting', targetId: target.id,
    meeting: { locationId: 'west', requestedStartDay: 8, durationDays: 1, actorOfficeConstraint: { positionId: 'seat-ok', requiresLeave: false } } });
  assert.equal(allowed.outcome, 'submitted', allowed.reason); const allowedPlan = D.get(allowed.planId); advance(c, 3);
  let reply = D.submitNPC(target, { actionId: 'office-constrained-allowed-reply', planId: allowedPlan.id, phase: 'respond', response: 'accept', expectedRevision: allowedPlan.localActivity.revision, termsVersion: allowedPlan.localActivity.termsVersion });
  assert.equal(reply.outcome, 'submitted', reply.reason); advance(c, 3);
  assert(allowedPlan.localActivity.meeting.actorJourney && /^(in_transit|arrived)$/.test(allowedPlan.localActivity.meeting.actorJourney.status), 'an allowed holder can start the real route');

  const blocked = D.submitNPC(leaveHolder, { actionId: 'office-constrained-leave-required', activityKind: 'meeting', targetId: target2.id,
    meeting: { locationId: 'west', requestedStartDay: 8, durationDays: 1 } });
  assert.equal(blocked.outcome, 'submitted', blocked.reason); const blockedPlan = D.get(blocked.planId); advance(c, 3);
  reply = D.submitNPC(target2, { actionId: 'office-constrained-leave-required-reply', planId: blockedPlan.id, phase: 'respond', response: 'accept', expectedRevision: blockedPlan.localActivity.revision, termsVersion: blockedPlan.localActivity.termsVersion });
  assert.equal(reply.outcome, 'submitted', reply.reason); advance(c, 3);
  assert.equal(blockedPlan.status, 'waiting_departure');
  assert.equal(blockedPlan.localActivity.meeting.actorJourney, undefined, 'leave-required holder cannot start before a valid leave');
});

test('multiple appointments cannot be hidden by a loose hint and valid leave covers the full return window', () => {
  const c = world(), D = c.TM.NPC.DailyActivities, actor = c.add('a', '甲'), target = c.add('b', '乙');
  c.GM.affinityMap = { '甲|乙': 80 };
  c.GM.officeTree = [{ id: 'dept', organizationId: 'org', name: '署', positions: [
    { id: 'seat-a', holderId: actor.id, actualHolders: [{ characterId: actor.id, appointmentId: 'appt-a' }], appointmentId: 'appt-a', officeTenure: { dutyMode: 'resident', usualDutyLocationId: 'east', leave: { requiresApproval: true } } },
    { id: 'seat-b', holderId: actor.id, actualHolders: [{ characterId: actor.id, appointmentId: 'appt-b' }], appointmentId: 'appt-b', officeTenure: { dutyMode: 'resident', usualDutyLocationId: 'east', leave: { requiresApproval: true } } }
  ] }];
  const request = D.submitNPC(actor, { actionId: 'office-multi-duty', activityKind: 'meeting', targetId: target.id,
    meeting: { locationId: 'west', requestedStartDay: 8, durationDays: 1, actorOfficeConstraint: { positionId: 'seat-a', requiresLeave: false } } });
  assert.equal(request.outcome, 'submitted', request.reason); let p = D.get(request.planId);
  advance(c, 3);
  assert.equal(D.submitNPC(target, { actionId: 'office-multi-duty-response', planId: p.id, phase: 'respond', response: 'accept', expectedRevision: p.localActivity.revision, termsVersion: p.localActivity.termsVersion }).outcome, 'submitted');
  advance(c, 3);
  assert.equal(p.status, 'waiting_departure', 'one loose constraint must not erase either resident duty');
  assert.equal(p.localActivity.meeting.actorJourney, undefined);
  // Only one leave is sufficient to identify the remaining unmet duty; the
  // second one is added below to prove the positive path.
  c.GM.officeTree[0].positions.forEach(function (pos, index) {
    pos._officeTenureState = { version: 1, sequence: 1, leaves: index === 0 ? [{ id: 'leave-a', positionId: pos.id, organizationId: 'org', holderId: actor.id, status: 'approved', applicantInformed: true, termsVersion: 1, terms: { destinationId: 'west', startDay: 0, latestReturnDay: 20 } }] : [], delegations: [], reports: [] };
  });
  let depart = D.submitNPC(actor, { actionId: 'office-multi-duty-depart-one', planId: p.id, phase: 'depart', expectedRevision: p.localActivity.revision, termsVersion: p.localActivity.termsVersion });
  assert.equal(depart.outcome, 'blocked');
  assert.equal(p.localActivity.meeting.actorJourney, undefined, 'one of two duties still blocks departure');
  c.GM.officeTree[0].positions[1]._officeTenureState = { version: 1, sequence: 1, leaves: [{ id: 'leave-b', positionId: 'seat-b', organizationId: 'org', holderId: actor.id, status: 'approved', applicantInformed: true, termsVersion: 1, terms: { destinationId: 'west', startDay: 0, latestReturnDay: 20 } }], delegations: [], reports: [] };
  depart = D.submitNPC(actor, { actionId: 'office-multi-duty-depart-both', planId: p.id, phase: 'depart', expectedRevision: p.localActivity.revision, termsVersion: p.localActivity.termsVersion });
  p = D.get(p.id);
  assert.equal(depart.outcome, 'started', depart.reason);
  assert(p.localActivity.meeting.actorJourney && /^(in_transit|arrived)$/.test(p.localActivity.meeting.actorJourney.status));
});

console.log('PASS ' + passed + ' travel groups');
