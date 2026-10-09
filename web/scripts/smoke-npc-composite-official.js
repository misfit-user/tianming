'use strict';

// Production-module smoke over one complete official scenario.  The scenario
// JSON remains the source of truth; this fixture only materializes its normal
// population/map and marks the two selected public identities readable for
// the test.  It does not pre-create a goal, agreement, arrival or result.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { dailyFixture } = require('./lib-npc-daily-fixture');

const ROOT = path.resolve(__dirname, '..', '..');
const SCENARIO = path.join(ROOT, 'scenarios', '绍宋·建炎元年八月（官方）.json');
const clone = value => JSON.parse(JSON.stringify(value));

function materializeOfficial(c) {
  const source = JSON.parse(fs.readFileSync(SCENARIO, 'utf8'));
  c.GM.sid = source.id;
  c.GM.mapData = clone(source.mapData || source.map);
  c.GM.chars = clone(source.characters || []);
  c.GM.facs = clone(source.factions || []);
  c.GM.officeTree = clone(source.officeTree || []);
  c.GM.running = true;
  c.P.scenarios = [clone(source)];
  return source;
}

function setKnownPublicPair(c, source, actorName, targetName) {
  const actor = c.GM.chars.find(ch => ch.name === actorName);
  const target = c.GM.chars.find(ch => ch.name === targetName);
  assert(actor && target, 'official selected characters must exist');
  [actor, target].forEach(ch => { ch.publicIdentity = true; });
  c.GM.affinityMap = {};
  for (const relation of source.relations || []) {
    const from = c.GM.chars.find(ch => ch.name === relation.from);
    const to = c.GM.chars.find(ch => ch.name === relation.to);
    if (!from || !to) continue;
    const key = [from.name, to.name].sort().join('|');
    const value = Number(relation.value ?? relation.affinity ?? relation.strength ?? 0);
    c.GM.affinityMap[key] = Math.max(Number(c.GM.affinityMap[key] || 0), value);
  }
  return { actor, target };
}

function advance(c, days) {
  let left = days;
  while (left > 0) {
    const interval = c.TM.SimTime.prepare(c.GM);
    assert(interval && interval.days > 0 && interval.days <= left, 'official fixture clock interval mismatch');
    c.GM.turn++;
    const clock = c.TM.SimTime.commit(c.GM, interval);
    assert.equal(clock.ok, true, clock.reason || 'official fixture clock commit failed');
    const receipt = c.TM.NPC.ActionLedger.advance(c.GM);
    assert.equal(receipt.ok, true, receipt.reason || 'official daily advance failed');
    left -= interval.days;
  }
}

function submit(c, actor, plan, phase, extra) {
  return c.TM.NPC.DailyActivities.submitNPC(actor, Object.assign({
    actionId: 'official-composite:' + phase + ':' + c.GM.turn,
    planId: plan.id,
    phase,
    expectedRevision: plan.localActivity.revision,
    termsVersion: plan.localActivity.termsVersion
  }, extra || {}));
}

const c = dailyFixture();
c.load('tm-npc-local-ai.js');
const source = materializeOfficial(c);
const selected = setKnownPublicPair(c, source, '韩世忠', '张俊');
const D = c.TM.NPC.DailyActivities;

// First form the source through the existing assistance/material path.
let receipt = D.submitNPC(selected.actor, {
  actionId: 'official-composite:assistance',
  activityKind: 'assistance',
  targetId: selected.target.id,
  task: { kind: 'material_summary', title: '整理来往材料', materialRefs: [{ kind: 'character_public', characterId: selected.actor.id }] }
});
assert.equal(receipt.outcome, 'submitted', receipt.reason);
advance(c, 1);
let sourcePlan = D.get(receipt.planId);
receipt = submit(c, selected.target, sourcePlan, 'respond', { response: 'accept' });
assert.equal(receipt.outcome, 'submitted', receipt.reason);
advance(c, 1);
sourcePlan = D.get(sourcePlan.id);
receipt = submit(c, selected.target, sourcePlan, 'perform');
assert.equal(receipt.outcome, 'submitted', receipt.reason);
advance(c, 1);
sourcePlan = D.get(sourcePlan.id);
receipt = submit(c, selected.actor, sourcePlan, 'feedback', { response: 'satisfied' });
assert.equal(receipt.outcome, 'completed', receipt.reason);
advance(c, 1);
sourcePlan = D.get(sourcePlan.id);
assert.equal(sourcePlan.status, 'done');
assert.equal(sourcePlan.localActivity.documents.length, 1);
assert.equal(sourcePlan.localActivity.documents[0].receivedBy, selected.actor.id);

// The local candidate comes from the received document; no localGoal is
// supplied for this follow-up.  The formal UI uses the same transformation.
const candidate = c.TM.NPC.LocalAI.candidates(selected.actor, [sourcePlan])
  .find(row => row.action && row.action.activityKind === 'consultation');
assert(candidate && candidate.action.consultation, 'official sourced opportunity must produce a consultation choice');
assert.equal(candidate.action.consultation.topicId, 'reading_understanding');
const now = D.day(c.GM);
const meeting = D.submitNPC(selected.actor, {
  actionId: 'official-composite:meeting',
  activityKind: 'meeting',
  targetId: selected.target.id,
  meeting: {
    purpose: '相约读札／当面请益',
    locationId: selected.actor.regionId,
    requestedStartDay: now + 3,
    durationDays: 1,
    discussion: candidate.action.consultation
  }
});
assert.equal(meeting.outcome, 'submitted', meeting.reason);
const meetingPlan = D.get(meeting.planId);
assert(meetingPlan && meetingPlan.localActivity.meeting.discussion.sourceOpportunity,
  'the combination must retain the sourced opportunity');
advance(c, 1);
let current = D.get(meetingPlan.id);
receipt = submit(c, selected.target, current, 'respond', { response: 'accept' });
assert.equal(receipt.outcome, 'submitted', receipt.reason);
advance(c, 1);
current = D.get(meetingPlan.id);
for (let i = 0; i < 3 && current.localActivity.meeting.status !== 'in_meeting'; i++) {
  advance(c, 1);
  current = D.get(meetingPlan.id);
}
assert.equal(current.localActivity.meeting.status, 'in_meeting');
receipt = D.submitNPC(selected.actor, {
  actionId: 'official-composite:discuss', planId: current.id, phase: 'discuss',
  exchangeChoice: 'question', expectedRevision: current.localActivity.revision,
  termsVersion: current.localActivity.termsVersion
});
assert.equal(receipt.outcome, 'submitted', receipt.reason);
current = D.get(meetingPlan.id);
receipt = D.submitNPC(selected.target, {
  actionId: 'official-composite:answer', planId: current.id, phase: 'discuss_response',
  response: 'answer', expectedRevision: current.localActivity.revision,
  termsVersion: current.localActivity.termsVersion
});
assert.equal(receipt.outcome, 'submitted', receipt.reason);
advance(c, 1);
current = D.get(meetingPlan.id);
assert.equal(current.status, 'done');
assert.equal(current.localActivity.meeting.discussion.status, 'completed');
assert(current.localActivity.meeting.participation.discussion.result);
assert.equal(current.localActivity.meeting.participation.discussion.result.topicId, 'reading_understanding');
assert(current.localActivity.meeting.actorReturnJourney, 'the actor retains a physical return journey');
assert.equal(c.apiAttempts.length, 0, 'ordinary official composite flow is local-only');

console.log(JSON.stringify({
  status: 'PASS', scenario: source.id, scenarioName: source.name,
  population: c.GM.chars.length, factions: c.GM.facs.length,
  actor: { id: selected.actor.id, name: selected.actor.name },
  target: { id: selected.target.id, name: selected.target.name },
  sourcePlanId: sourcePlan.id, meetingPlanId: meetingPlan.id,
  sourceMaterialId: sourcePlan.localActivity.documents[0].id,
  topicId: current.localActivity.meeting.discussion.topicId,
  discussionResultId: current.localActivity.meeting.discussion.result.id,
  statusAfterReturn: current.status, modelAttempts: c.apiAttempts.length,
  day: D.day(c.GM), turn: c.GM.turn
}));
