'use strict';
const assert = require('assert/strict');
const { dailyFixture } = require('./lib-npc-daily-fixture');

function setup() {
  const c = dailyFixture();
  c.load('tm-npc-local-ai.js');
  return c;
}

function submit(c, actor, plan, phase, extra) {
  const a = plan.localActivity;
  return c.TM.NPC.DailyActivities.submitNPC(actor, Object.assign({
    actionId: 'life-test-' + (++c.testSequence),
    planId: plan.id,
    phase,
    expectedRevision: a.revision,
    termsVersion: a.termsVersion
  }, extra || {}));
}

function completeIntroduction(c, actor, intermediary, third) {
  const D = c.TM.NPC.DailyActivities;
  let r = D.submitNPC(actor, { actionId: 'life-intro-start', activityKind: 'introduction', targetId: intermediary.id, thirdPartyId: third.id });
  assert.equal(r.outcome, 'submitted', r.reason);
  c.deliver();
  let p = D.get(r.planId);
  r = submit(c, intermediary, p, 'respond', { response: 'accept' });
  assert.equal(r.outcome, 'submitted', r.reason);
  c.deliver(); p = D.get(r.planId);
  r = submit(c, intermediary, p, 'forward');
  assert.equal(r.outcome, 'submitted', r.reason);
  c.deliver(); p = D.get(r.planId);
  r = submit(c, third, p, 'respond', { response: 'accept' });
  assert.equal(r.outcome, 'submitted', r.reason);
  c.deliver(); p = D.get(r.planId);
  r = submit(c, intermediary, p, 'report');
  assert.equal(r.outcome, 'submitted', r.reason);
  c.deliver();
  return D.get(r.planId);
}

let passed = 0;
function test(name, fn) { fn(); console.log('PASS ' + name); passed++; }

test('a completed introduction creates a traceable consultation opportunity without localGoals', () => {
  const c = setup();
  const actor = c.add('a', '甲');
  const intermediary = c.add('b', '乙');
  const third = c.add('c', '丙');
  c.GM.affinityMap = { '甲|乙': 90, '丙|乙': 90, '丙|甲': 90 };
  const source = completeIntroduction(c, actor, intermediary, third);
  assert.equal(source.status, 'done');
  assert(source.localActivity.contact, 'the source contact must really exist');
  assert.equal(actor.localGoals, undefined, 'the actor starts without a hand-written goal');
  const sameDay = c.TM.NPC.LocalAI.candidates(actor, [source]);
  assert.equal(sameDay.length, 0, 'the new opportunity respects the same-day start budget');
  c.GM.turn = 2;
  const candidates = c.TM.NPC.LocalAI.candidates(actor, [source]);
  const opportunity = candidates.find(x => x.action && x.action.activityKind === 'consultation');
  assert(opportunity, 'the completed contact should produce a local consultation opportunity');
  assert.equal(opportunity.action.sourceOpportunity.kind, 'contact');
  assert.equal(opportunity.action.sourceOpportunity.sourcePlanId, source.id);
  assert.match(opportunity.action.consultation.topicId, /letter_style|reading_understanding/);
});

test('NPCs complete a bounded consultation with content, time and a saved personal consequence', () => {
  const c = setup();
  const actor = c.add('a', '甲');
  const intermediary = c.add('b', '乙');
  const teacher = c.add('c', '丙');
  c.GM.affinityMap = { '甲|乙': 50, '丙|乙': 50, '丙|甲': 50 };
  const source = completeIntroduction(c, actor, intermediary, teacher);
  c.GM.turn = 2;
  const D = c.TM.NPC.DailyActivities, L = c.TM.NPC.LocalAI;
  const candidate = L.candidates(actor, [source]).find(x => x.action.activityKind === 'consultation');
  assert(candidate, 'the short plan starts from the source event');
  let r = D.submitNPC(actor, Object.assign({}, candidate.action, { actionId: 'life-consultation-start' }));
  assert.equal(r.outcome, 'submitted', r.reason);
  c.deliver();
  let p = D.get(r.planId);
  assert.equal(p.status, 'awaiting_response');
  let choice = L.candidates(teacher, [p])[0];
  assert.equal(choice.action.phase, 'respond');
  r = submit(c, teacher, p, 'respond', { response: choice.action.response });
  assert.equal(r.outcome, 'submitted', r.reason);
  c.deliver(); p = D.get(r.planId);
  assert.equal(p.status, 'working');
  assert(p.localActivity.readyDay > c.TM.NPC.DailyActivities.day(), 'the exchange occupies a later day');
  c.GM.turn = 3;
  choice = L.candidates(teacher, [p])[0];
  assert.equal(choice.action.phase, 'perform');
  r = submit(c, teacher, p, 'perform', { exchangeChoice: choice.action.exchangeChoice });
  assert.equal(r.outcome, 'submitted', r.reason);
  c.deliver(); p = D.get(r.planId);
  assert.equal(p.status, 'awaiting_feedback');
  assert.match(p.localActivity.exchange.content, /要点|理解|看法|边界|赐复/);
  choice = L.candidates(actor, [p])[0];
  assert.equal(choice.action.phase, 'feedback');
  r = submit(c, actor, p, 'feedback', { response: choice.action.response });
  assert.equal(r.outcome, 'completed', r.reason);
  c.deliver(); p = D.get(r.planId);
  assert.equal(p.status, 'done');
  assert(p.localActivity.result && p.localActivity.result.appliedKey);
  assert((actor._lifeExp || []).some(x => /请益/.test(x.domain)));
  assert.equal(D.consultationHistory(actor, p.localActivity.topicId), 1);
  assert.equal(L.candidates(actor, [p]).filter(x => x.action.activityKind === 'consultation').length, 0, 'the source is not retriggered');
  const restored = JSON.parse(JSON.stringify(c.GM));
  c.GM = restored;
  const restoredActor = D.person('a'), restoredPlan = D.get(p.id);
  assert.equal(restoredPlan.status, 'done');
  assert(restoredPlan.localActivity.result && restoredPlan.localActivity.result.appliedKey);
  assert.equal(D.consultationHistory(restoredActor, restoredPlan.localActivity.topicId), 1);
  assert.equal(L.candidates(restoredActor, [restoredPlan]).filter(x => x.action.activityKind === 'consultation').length, 0, 'reload does not replay the source opportunity');
});

test('a received sourced assistance document creates a distinct reading opportunity', () => {
  const c = setup();
  const actor = c.add('a', '甲');
  const helper = c.add('b', '乙');
  const D = c.TM.NPC.DailyActivities, L = c.TM.NPC.LocalAI;
  let r = D.submitNPC(actor, { actionId: 'life-assistance-start', activityKind: 'assistance', targetId: helper.id,
    task: { kind: 'material_summary', title: '整理来往材料', materialRefs: [{ kind: 'character_public', characterId: actor.id }] } });
  assert.equal(r.outcome, 'submitted', r.reason); c.deliver();
  let p = D.get(r.planId);
  r = submit(c, helper, p, 'respond', { response: 'accept' }); assert.equal(r.outcome, 'submitted', r.reason); c.deliver(); p = D.get(r.planId);
  c.GM.turn = 2;
  r = submit(c, helper, p, 'perform'); assert.equal(r.outcome, 'submitted', r.reason); c.deliver(); p = D.get(r.planId);
  r = submit(c, actor, p, 'feedback', { response: 'satisfied' }); assert.equal(r.outcome, 'completed', r.reason); c.deliver(); p = D.get(r.planId);
  assert.equal(p.status, 'done');
  c.GM.turn = 3;
  const candidate = L.candidates(actor, [p]).find(x => x.action.activityKind === 'consultation');
  assert(candidate); assert.equal(candidate.action.consultation.sourceOpportunity.kind, 'document');
  assert.equal(candidate.action.consultation.topicId, 'reading_understanding');
});

test('a burdened participant can defer once and the short plan has a bounded retry', () => {
  const c = setup();
  const actor = c.add('a', '甲');
  const intermediary = c.add('b', '乙');
  const teacher = c.add('c', '丙', { stress: 85 });
  c.GM.affinityMap = { '甲|乙': 90, '丙|乙': 90, '丙|甲': 90 };
  const source = completeIntroduction(c, actor, intermediary, teacher);
  c.GM.turn = 2;
  const D = c.TM.NPC.DailyActivities, L = c.TM.NPC.LocalAI;
  const candidate = L.candidates(actor, [source]).find(x => x.action.activityKind === 'consultation');
  let r = D.submitNPC(actor, Object.assign({}, candidate.action, { actionId: 'life-consultation-defer' })); assert.equal(r.outcome, 'submitted', r.reason); c.deliver();
  let p = D.get(r.planId), choice = L.candidates(teacher, [p])[0];
  assert.equal(choice.action.response, 'defer');
  r = submit(c, teacher, p, 'respond', { response: 'defer' }); assert.equal(r.outcome, 'submitted', r.reason); c.deliver(); p = D.get(r.planId);
  assert.equal(p.status, 'deferred'); assert.equal(p.localActivity.deferrals, 1);
  c.GM.turn = 3; D.advanceWithin(); p = D.get(r.planId);
  assert.equal(p.status, 'awaiting_response');
  assert(L.candidates(teacher, [p]).length >= 1, 'the retry is a real due choice, not a permanent pending state');
});

test('a player can be the independent consultation participant without an NPC proxy choice', () => {
  const c = setup();
  const actor = c.add('a', '甲');
  const intermediary = c.add('b', '乙');
  const player = c.add('p', '玩家', { isPlayer: true });
  c.GM.playerInfo = { characterId: player.id };
  c.GM.affinityMap = { '甲|乙': 70, '玩家|甲': 70 };
  const D = c.TM.NPC.DailyActivities, L = c.TM.NPC.LocalAI;
  let r = D.submitNPC(actor, { actionId: 'player-source-intro', activityKind: 'introduction', targetId: intermediary.id, thirdPartyId: player.id });
  assert.equal(r.outcome, 'submitted', r.reason); c.deliver();
  let p = D.get(r.planId);
  r = submit(c, intermediary, p, 'respond', { response: 'accept' }); assert.equal(r.outcome, 'submitted', r.reason); c.deliver(); p = D.get(r.planId);
  r = submit(c, intermediary, p, 'forward'); assert.equal(r.outcome, 'submitted', r.reason); c.deliver(); p = D.get(r.planId);
  const playerTicket = D.ticket(player, { planId: p.id, phase: 'respond' });
  r = D.submitHuman(playerTicket, { response: 'accept' }); assert.equal(r.outcome, 'submitted', r.reason); c.deliver(); p = D.get(r.planId);
  r = submit(c, intermediary, p, 'report'); assert.equal(r.outcome, 'submitted', r.reason); c.deliver(); p = D.get(r.planId);
  assert.equal(p.status, 'done');
  c.GM.turn = 2;
  const opportunity = L.candidates(actor, [p]).find(x => x.action.activityKind === 'consultation');
  assert(opportunity);
  r = D.submitNPC(actor, Object.assign({}, opportunity.action, { actionId: 'player-consultation' })); assert.equal(r.outcome, 'submitted', r.reason); c.deliver();
  p = D.get(r.planId); assert.equal(D.view(p, player).nextPhase, 'respond'); assert.equal(D.view(p, player).sourceOpportunity, null, 'the player sees the topic but not the NPC source rationale');
  const responseTicket = D.ticket(player, { planId: p.id, phase: 'respond' });
  r = D.submitHuman(responseTicket, { response: 'accept' }); assert.equal(r.outcome, 'submitted', r.reason); c.deliver(); p = D.get(r.planId);
  c.GM.turn = 3;
  const playerChoice = L.candidates(player, [p]);
  assert.equal(playerChoice[0].action.phase, 'perform');
  r = submit(c, player, p, 'perform', { exchangeChoice: 'question' });
  assert.equal(r.outcome, 'blocked', 'the player cannot be made to perform through NPC submission');
  const exchangeTicket = D.ticket(player, { planId: p.id, phase: 'perform' });
  r = D.submitHuman(exchangeTicket, { exchangeChoice: 'question' }); assert.equal(r.outcome, 'submitted', r.reason); c.deliver(); p = D.get(r.planId);
  const npcFeedback = L.candidates(actor, [p]);
  assert.equal(npcFeedback[0].action.phase, 'feedback');
  r = D.submitNPC(actor, Object.assign({}, npcFeedback[0].action, { actionId: 'player-consultation-feedback' })); assert.equal(r.outcome, 'completed', r.reason); c.deliver();
  assert.equal(D.get(p.id).status, 'done'); assert(D.get(p.id).localActivity.result);
});

console.log('PASS ' + passed + ' life opportunity groups');
