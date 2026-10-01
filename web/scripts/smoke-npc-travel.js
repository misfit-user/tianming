'use strict';
const assert = require('node:assert/strict');
const { dailyFixture } = require('./lib-npc-daily-fixture');

function world() {
  const c = dailyFixture();
  c.GM.mapData = { locationBindingContract: { schema: 'source-text-location-v2' }, regions: [
    { id: 'east', name: '东城', geographicCenter: [116, 40], neighbors: ['west'] },
    { id: 'west', name: '西城', geographicCenter: [117, 40], neighbors: ['east'] },
    { id: 'island', name: '孤岛', geographicCenter: [130, 40], neighbors: [] }
  ] };
  c.add = (id, name, extra = {}) => c.actor(id, name, { location: '东城', publicIdentity: true, faction: '', ...extra });
  c.step = (actor, plan, phase, response) => c.TM.NPC.DailyActivities.submitNPC(actor, {
    actionId: 'meeting-step-' + (++c.testSequence), planId: plan.id, phase, response,
    expectedRevision: plan.localActivity.revision, termsVersion: plan.localActivity.termsVersion
  });
  c.testSequence = 0;
  return c;
}
function advance(c, days) {
  c.GM.turn += days;
  const r = c.advanceCharTravelByDays(days);
  const d = c.TM.NPC.ActionLedger.advance(c.GM);
  assert.equal(d.ok, true, d.reason);
  return r;
}

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS ' + name); }

test('strict route separates distance, mode and unknown/unreachable states', () => {
  const c = world(), R = c.TM.MapRouteDays;
  const r = R.planRoute(c.GM.mapData, 'east', 'west', { mode: 'walking' });
  assert.equal(r.status, 'reachable'); assert.equal(r.path.join(','), 'east,west'); assert(r.km > 0 && r.days > 0); assert.equal(r.estimated, false);
  assert.equal(R.planRoute(c.GM.mapData, 'east', 'island').status, 'unreachable');
  assert.equal(R.planRoute(c.GM.mapData, 'missing', 'west').status, 'unresolved');
  assert.equal(R.planRoute({ regions: [{ id: 'a', name: '甲', neighbors: ['b'] }, { id: 'b', name: '乙', neighbors: [] }] }, 'a', 'b').status, 'unresolved');
  assert.equal(JSON.stringify(c.GM.mapData.regions[0].neighbors), '["west"]');
  const beforeVersion = R.routeVersion(c.GM.mapData);
  c.GM.mapData.regions[0].neighbors = [];
  assert.equal(R.planRoute(c.GM.mapData, 'east', 'west').status, 'unreachable', 'in-place route edits invalidate the derived cache');
  assert.notEqual(R.routeVersion(c.GM.mapData), beforeVersion);
});

test('two ungoverned people complete invitation, response, travel, meeting and return', () => {
  const c = world(), a = c.add('a', '甲', { location: '东城', localGoals: [{ id: 'meeting-goal', kind: 'meeting', targetId: 'b', meeting: { purpose: '探望旧友', returnMode: 'return' } }] }), b = c.add('b', '乙', { location: '西城' });
  c.GM.affinityMap = { '甲|乙': 70 };
  c.TM.NPC.LocalAI = null;
  const request = c.TM.NPC.DailyActivities.submitNPC(a, { actionId: 'meeting-request', activityKind: 'meeting', targetId: b.id, meeting: { purpose: '探望旧友', locationId: 'west', mode: 'walking', windowDays: 10, returnMode: 'return' } }, { inlineDelivery: true });
  assert.equal(request.outcome, 'submitted', JSON.stringify(request));
  const p = c.TM.NPC.DailyActivities.get(request.planId); assert.equal(p.status, 'in_transit'); assert.equal(b.location, '西城'); assert.equal(a.location, '东城');
  c.GM.turn = 5; c.TM.NPC.ActionLedger.advance(c.GM);
  assert.equal(p.status, 'awaiting_response'); assert.equal(p.localActivity.meeting.status, 'invitation_in_transit');
  const reply = c.TM.NPC.DailyActivities.submitNPC(b, { actionId: 'meeting-response', planId: p.id, phase: 'respond', response: 'accept', expectedRevision: p.localActivity.revision, termsVersion: p.localActivity.termsVersion });
  assert.equal(reply.outcome, 'started', JSON.stringify(reply)); assert.equal(a._travelTo, '西城'); assert.equal(a.location, '东城');
  advance(c, 5);
  assert.equal(p.localActivity.meeting.participation.participants.length, 2); assert.equal(p.localActivity.meeting.status, 'returning'); assert.equal(a.location, '西城');
  advance(c, 5);
  assert.equal(p.status, 'done'); assert.equal(a.location, '东城'); assert.equal(b.location, '西城'); assert.equal(p.localActivity.meeting.status, 'returned');
  assert.equal(new Set(p.steps.map(s => s.id)).size, p.steps.length); assert.equal(c.apiAttempts.length, 0);
});

test('meeting rejection, cancellation and stale terms never start physical travel', () => {
  const c = world(), a = c.add('a', '甲', { location: '东城' }), b = c.add('b', '乙', { location: '西城' });
  const req = c.TM.NPC.DailyActivities.submitNPC(a, { actionId: 'meeting-reject-request', activityKind: 'meeting', targetId: b.id, meeting: { locationId: 'west' } });
  c.GM.turn = 5; c.TM.NPC.ActionLedger.advance(c.GM); const p = c.TM.NPC.DailyActivities.get(req.planId);
  const reject = c.TM.NPC.DailyActivities.submitNPC(b, { actionId: 'meeting-reject', planId: p.id, phase: 'respond', response: 'reject', expectedRevision: p.localActivity.revision, termsVersion: p.localActivity.termsVersion });
  assert.equal(reject.outcome, 'completed'); assert.equal(p.status, 'in_transit'); advance(c, 5); assert.equal(p.status, 'rejected'); assert.equal(a._travelTo, undefined);
  c.GM.turn += 8;
  const req2 = c.TM.NPC.DailyActivities.submitNPC(a, { actionId: 'meeting-cancel-request', activityKind: 'meeting', targetId: b.id, meeting: { locationId: 'west' } });
  assert.equal(req2.outcome, 'submitted'); const p2 = c.TM.NPC.DailyActivities.get(req2.planId); const cancel = c.TM.NPC.DailyActivities.submitNPC(a, { actionId: 'meeting-cancel', planId: p2.id, phase: 'cancel', expectedRevision: p2.localActivity.revision, termsVersion: p2.localActivity.termsVersion });
  assert.equal(cancel.outcome, 'completed'); assert.equal(p2.status, 'cancelled'); assert.equal(a._travelTo, undefined);
});

test('local date and travel advance roll back together when the canonical ledger rejects', () => {
  const c = world(), a = c.add('a', '甲', { location: '东城' }), b = c.add('b', '乙', { location: '西城' });
  const req = c.TM.NPC.DailyActivities.submitNPC(a, { actionId: 'meeting-atomic-request', activityKind: 'meeting', targetId: b.id, meeting: { locationId: 'west' } });
  c.GM.turn = 5; c.TM.NPC.ActionLedger.advance(c.GM); const p = c.TM.NPC.DailyActivities.get(req.planId);
  const reply = c.TM.NPC.DailyActivities.submitNPC(b, { actionId: 'meeting-atomic-response', planId: p.id, phase: 'respond', response: 'accept', expectedRevision: p.localActivity.revision, termsVersion: p.localActivity.termsVersion });
  assert.equal(reply.outcome, 'started');
  const state = () => { const live = c.GM.chars.find(x => x.id === 'a'), livePlan = c.TM.NPC.DailyActivities.get(req.planId); return JSON.stringify({ turn: c.GM.turn, day: c.TM.SimTime.now(c.GM), a: { location: live.location, to: live._travelTo, remaining: live._travelRemainingDays }, status: livePlan.status }); };
  const before = state();
  const originalAdvance = c.TM.NPC.ActionLedger.advance;
  c.TM.NPC.ActionLedger.advance = () => ({ ok: false, reason: 'forced_daily_failure' });
  const failed = c.TM.NPC.Meetings.advanceLocalDays(1);
  c.TM.NPC.ActionLedger.advance = originalAdvance;
  assert.equal(failed.ok, false); assert.equal(state(), before);
});

test('a route revision roadblocks travel and cancellation stops without teleporting', () => {
  const c = world(), a = c.add('a', '甲', { location: '东城' }), b = c.add('b', '乙', { location: '西城' });
  const req = c.TM.NPC.DailyActivities.submitNPC(a, { actionId: 'meeting-roadblock-request', activityKind: 'meeting', targetId: b.id, meeting: { locationId: 'west' } });
  c.GM.turn = 5; c.TM.NPC.ActionLedger.advance(c.GM); const p = c.TM.NPC.DailyActivities.get(req.planId);
  assert.equal(c.TM.NPC.DailyActivities.submitNPC(b, { actionId: 'meeting-roadblock-response', planId: p.id, phase: 'respond', response: 'accept', expectedRevision: p.localActivity.revision, termsVersion: p.localActivity.termsVersion }).outcome, 'started');
  c.GM.mapData.regions[0].neighbors = [];
  c.TM.NPC.Meetings.beforeTravelAdvance(); c.advanceCharTravelByDays(5);
  assert.equal(p.status, 'waiting_route'); assert.equal(p.localActivity.meeting.status, 'roadblocked'); assert.equal(a.location, '东城'); assert.equal(a._travelTo, '西城'); assert.equal(a._travelPaused, true);
  const cancel = c.TM.NPC.DailyActivities.submitNPC(b, { actionId: 'meeting-roadblock-cancel', planId: p.id, phase: 'cancel', expectedRevision: p.localActivity.revision, termsVersion: p.localActivity.termsVersion });
  assert.equal(cancel.outcome, 'completed'); assert.equal(p.status, 'cancelled'); assert.equal(a.location, '东城'); assert.equal(a._travelTo, undefined);
});

test('relationship IDs work without affinity and automatic material selection skips private memory', () => {
  const c = world(), a = c.add('a', '甲', { fatherId: 'b', _memory: [{ id: 'secret', event: '私密经历' }] }), b = c.add('b', '乙');
  assert.equal(c.TM.NPC.DailyActivities.relationKind(a, b), 'family');
  assert.equal(c.TM.NPC.DailyActivities.relationshipIds({ characterId: 'missing' }, c.GM).length, 0);
  assert.equal(c.TM.NPC.DailyActivities.selectMaterial(a, {}), null, 'without a declared material scope, automatic assistance waits');
});

console.log('PASS ' + passed + ' travel groups');
