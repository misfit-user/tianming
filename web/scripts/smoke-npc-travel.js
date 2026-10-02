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
    const m = p.localActivity.meeting;
    return { status: m.status, start: m.startedDay, end: m.endDay, participation: m.participation && m.participation.durationDays,
      actor: a.location, target: b.location, returned: p.status };
  }
  assert.deepEqual(run(true), run(false));
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

test('relationship IDs work without affinity and automatic material selection skips private memory', () => {
  const c = world(), a = c.add('a', '甲', { fatherId: 'b', _memory: [{ id: 'secret', event: '私密经历' }] }), b = c.add('b', '乙');
  assert.equal(c.TM.NPC.DailyActivities.relationKind(a, b), 'family');
  assert.equal(c.TM.NPC.DailyActivities.relationshipIds({ characterId: 'missing' }, c.GM).length, 0);
  assert.equal(c.TM.NPC.DailyActivities.selectMaterial(a, {}), null);
});

console.log('PASS ' + passed + ' travel groups');
