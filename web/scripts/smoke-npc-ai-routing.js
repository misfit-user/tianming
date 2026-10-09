'use strict';
const assert = require('assert/strict');
const { dailyFixture } = require('./lib-npc-daily-fixture');

function setup() {
  const c = dailyFixture();
  c.load('tm-npc-local-ai.js');
  c.P.ai = { key: 'synthetic-planner', url: 'https://planner.invalid/v1', model: 'fixture' };
  c.GM.running = true; c.GM.busy = false; c.GM._endTurnBusy = false;
  c.modelPrompts = [];
  c.extractJSON = JSON.parse;
  return c;
}

function officeFixture(c, actor) {
  c.GM.officeTree = [{ id: 'dept', name: '署', organizationId: 'org', positions: [{
    id: 'seat', name: '主官', holderId: actor.id, holder: actor.name, appointmentId: 'appointment-1',
    actualHolders: [{ characterId: actor.id, name: actor.name, appointmentId: 'appointment-1' }], powers: { supervise: true }
  }] }];
}

async function run(c) { return c.executeNpcBehaviors({ source: 'routing-smoke' }); }

let passed = 0;
async function test(name, fn) { await fn(); console.log('PASS ' + name); passed++; }

(async () => {
  await test('local daily activity stays local even when an API key is configured', async () => {
    const c = setup(), a = c.add('a', '甲'), b = c.add('b', '乙');
    c.GM.affinityMap = { '甲|乙': 80 };
    const D = c.TM.NPC.DailyActivities;
    const started = D.submitNPC(a, { actionId: 'routing-greeting', activityKind: 'greeting', targetId: b.id });
    assert.equal(started.outcome, 'submitted', started.reason);
    assert.equal(await c.npcDecisionLayer(a, c.buildNpcBehaviorContext(a)), null, 'single-NPC compatibility fallback also yields to LocalAI');
    c.deliver();
    await run(c);
    assert.equal(c.modelPrompts.length, 0, 'local activity must not enter the model batch');
    assert.equal(c.apiAttempts.length, 0, 'no hidden model adapter attempt');
    assert.equal(c._scheduleNpcIdleAutonomyLoop({ delayMs: 1, maxRounds: 3 }), false, 'idle timer is not created without planning work');
  });

  await test('an unseen appointment change is not knowledge; a delivered source creates one bounded plan', async () => {
    const c = setup(), a = c.add('a', '甲'), b = c.add('b', '乙'), d = c.add('d', '丁');
    c.GM.affinityMap = { '甲|乙': 80, '甲|丁': 80 };
    officeFixture(c, a);
    c.callAI = async prompt => {
      c.modelPrompts.push(prompt);
      return JSON.stringify([{ actorId: a.id, name: a.name, behaviorType: 'greeting', targetId: b.id, shouldExecute: true }, { actorId: a.id, name: a.name, planning: {
        objective: '任职变化后重新安排日常往来', reviewDay: 9,
        nextSteps: [{ id: 'ask-colleague', kind: 'greeting', targetId: b.id, reason: '先向已知同僚问候' }, { id: 'brief-neighbour', kind: 'greeting', targetId: d.id, dependsOn: ['ask-colleague'], reason: '收到回应后再向另一位联系人说明近况' }]
      } }]);
    };
    await run(c); // first observation establishes the office baseline
    assert.equal(c.modelPrompts.length, 0);
    const seat = c.GM.officeTree[0].positions[0];
    seat.appointmentId = 'appointment-2'; seat.actualHolders[0].appointmentId = 'appointment-2';
    await run(c); // the backend change alone is not a delivered fact
    assert.equal(c.modelPrompts.length, 0);
    const source = c.TM.OfficeTenure.notifyOfficeChange(c.GM, a, { kind: 'appointment', sourceVersion: 2, content: '任职安排已有新通知' });
    assert(source && source.message && source.message.status === 'in_transit');
    c.GM.turn = 2; c.deliver();
    await run(c);
    assert.equal(c.modelPrompts.length, 1, 'the delivered source should cause one bounded planning call');
    const planning = c.GM._npcActionState.planning;
    const direction = planning.directions[Object.keys(planning.directions)[0]];
    assert(direction && direction.status === 'active');
    assert.equal(a.localGoals.filter(g => g.modelPlanId === direction.id && g.status === 'active').length, 1);
    assert.equal(a.localGoals.filter(g => g.modelPlanId === direction.id && g.status === 'blocked').length, 1);
    assert.equal(c.GM._npcPlans.filter(p => p.actorId === a.id && p.localActivity).length, 0, 'planning response cannot execute an ordinary activity directly');
    c.GM.turn = 2; await run(c);
    c.GM.turn = 3; await run(c);
    assert.equal(c.modelPrompts.length, 1, 'local continuation does not ask the model for each step');
    assert(c.GM._npcPlans.some(p => p.localActivity && p.localActivity.sourceGoalId), 'the planned steps entered the existing activity ledger');
  });

  await test('a delivered important message plans once and survives a reload', async () => {
    const c = setup(), author = c.add('author', '发信人'), actor = c.add('actor', '收信人'), other = c.add('other', '同僚');
    c.GM.affinityMap = { '收信人|发信人': 80, '收信人|同僚': 80 };
    let r = c.TM.NPC.ActionLedger.ingest({ actionId: 'important-message', actorId: author.id, name: author.name, targetId: actor.id, target: actor.name,
      behaviorType: 'private_correspondence', intent: '制度变化后的重要通知', planningRequired: true, sourceVersion: 1, task: { kind: 'document' } }, 'test-important-message');
    assert.equal(r.outcome, 'submitted', r.reason);
    const p = c.GM._npcPlans.find(x => x.id === r.planId);
    c.GM.turn = 2; c.deliver();
    c.callAI = async prompt => {
      c.modelPrompts.push(prompt);
      return JSON.stringify({ planning: { actorId: actor.id, objective: '根据收到的通知调整往来', nextSteps: [
        { kind: 'greeting', targetId: author.id }, { kind: 'greeting', targetId: other.id }
      ] } });
    };
    await run(c);
    assert.equal(c.modelPrompts.length, 1);
    const firstDirectionCount = Object.keys(c.GM._npcActionState.planning.directions).length;
    p.status = 'done'; p.nextActorId = '';
    await run(c);
    assert.equal(c.modelPrompts.length, 1, 'same delivered source does not retrigger planning');
    c.GM = JSON.parse(JSON.stringify(c.GM));
    await run(c);
    assert.equal(c.modelPrompts.length, 1, 'reload does not replay the accepted direction');
    assert.equal(Object.keys(c.GM._npcActionState.planning.directions).length, firstDirectionCount);
  });

  await test('a dependent local step waits for the real first response', async () => {
    const c = setup(), a = c.add('a', '甲'), b = c.add('b', '乙', { isPlayer: true }), d = c.add('d', '丁'), sourceAuthor = c.add('source', '丙');
    c.GM.affinityMap = { '甲|乙': 80, '甲|丁': 80, '甲|丙': 80 };
    const source = c.TM.NPC.ActionLedger.ingest({ actionId: 'dependency-source', actorId: sourceAuthor.id, name: sourceAuthor.name, targetId: a.id, target: a.name,
      behaviorType: 'private_correspondence', intent: '合作条件有变化', planningRequired: true, task: { kind: 'notice' } }, 'dependency-source');
    assert.equal(source.outcome, 'submitted', source.reason);
    c.GM.turn = 2; c.deliver();
    c.callAI = async () => JSON.stringify({ planning: { objective: '先确认，再继续', nextSteps: [
      { id: 'ask', kind: 'greeting', targetId: b.id },
      { id: 'continue', kind: 'greeting', targetId: d.id, dependsOn: ['ask'] }
    ] } });
    await run(c);
    c.GM.turn = 3;
    await run(c);
    const firstPlan = c.GM._npcPlans.find(p => p.localActivity && p.actorId === a.id);
    assert(firstPlan, 'first planned action must enter the activity ledger');
    const direction = c.GM._npcActionState.planning.directions[Object.keys(c.GM._npcActionState.planning.directions)[0]];
    assert.equal(direction.steps.find(s => s.id === 'ask').status, 'started');
    assert.equal(direction.steps.find(s => s.id === 'continue').status, 'blocked');
    assert.equal(a.localGoals.filter(g => g.planningStepId === 'continue' && g.status === 'active').length, 0, 'dependent step cannot run before response');
    c.deliver();
    const responseTicket = c.TM.NPC.DailyActivities.ticket(b, { planId: firstPlan.id, phase: 'respond' });
    const response = c.TM.NPC.DailyActivities.submitHuman(responseTicket, { response: 'accept' });
    assert.equal(response.outcome, 'submitted', response.reason);
    c.GM.turn = 4; c.deliver();
    await run(c);
    const updated = c.GM._npcActionState.planning.directions[direction.id];
    assert.equal(updated.steps.find(s => s.id === 'ask').status, 'completed');
    assert(/^(ready|started|completed)$/.test(updated.steps.find(s => s.id === 'continue').status));
    assert(c.GM._npcPlans.filter(p => p.localActivity && p.actorId === a.id).length >= 2, 'dependent step activates only after the response is delivered');
  });

  await test('a late planning result cannot write into a reloaded world', async () => {
    const c = setup(), a = c.add('a', '甲'), b = c.add('b', '乙');
    officeFixture(c, a); await run(c);
    const source = c.TM.NPC.ActionLedger.ingest({ actionId: 'late-planning-source', actorId: b.id, name: b.name, targetId: a.id, target: a.name,
      behaviorType: 'private_correspondence', intent: '稍后才到的重大通知', planningRequired: true, task: { kind: 'notice' } }, 'late-source');
    assert.equal(source.outcome, 'submitted', source.reason);
    c.GM.turn = 2; c.deliver();
    let release;
    c.callAI = () => new Promise(resolve => { release = resolve; });
    const pending = run(c);
    assert.equal(typeof release, 'function');
    const fresh = JSON.parse(JSON.stringify(c.GM)); fresh.sid = 'fresh-world'; c.GM = fresh; c._tmLoadGen = 9;
    release(JSON.stringify([{ actorId: a.id, name: a.name, planning: { objective: '过期方向', nextSteps: [{ kind: 'greeting', targetId: b.id }, { kind: 'greeting', targetId: b.id }] } }]));
    const result = await pending;
    assert.equal(result.skipped, 'expired');
    assert.equal(c.GM._npcActionState.planning.directions && Object.keys(c.GM._npcActionState.planning.directions).length, 0);
    assert.equal(c.GM.chars.find(x => x.id === a.id).localGoals, undefined);
  });

  await test('a same-save goal revision expires an in-flight proposal', async () => {
    const c = setup(), a = c.add('a', '甲'), b = c.add('b', '乙'), source = c.add('source', '丙');
    c.GM.affinityMap = { '甲|乙': 80, '甲|丙': 80 };
    const sent = c.TM.NPC.ActionLedger.ingest({ actionId: 'same-save-stale-source', actorId: source.id, name: source.name, targetId: a.id, target: a.name,
      behaviorType: 'private_correspondence', intent: '需要重新考虑的通知', planningRequired: true, task: { kind: 'notice' } }, 'same-save-source');
    assert.equal(sent.outcome, 'submitted', sent.reason);
    c.GM.turn = 2; c.deliver();
    let release;
    c.callAI = () => new Promise(resolve => { release = resolve; });
    const pending = run(c);
    assert.equal(typeof release, 'function');
    a.personalGoal = '已改为另一项打算';
    release(JSON.stringify({ planning: { objective: '旧目标方向', nextSteps: [{ kind: 'greeting', targetId: b.id }] } }));
    await pending;
    const requests = c.GM._npcActionState.planning.pending.filter(q => q.actorId === a.id);
    assert(requests.some(q => q.status === 'expired' && q.expiredReason === 'planning_goal_changed'));
    assert.equal(Object.keys(c.GM._npcActionState.planning.directions).length, 0);
  });

  await test('planning outcomes and in-flight lease are distinct and bounded', async () => {
    const c = setup(), a = c.add('a', '甲'), b = c.add('b', '乙'), source = c.add('source', '丙');
    c.GM.affinityMap = { '甲|乙': 80, '甲|丙': 80 };
    const sent = c.TM.NPC.ActionLedger.ingest({ actionId: 'bounded-planning-source', actorId: source.id, name: source.name, targetId: a.id, target: a.name,
      behaviorType: 'private_correspondence', intent: '需要判断但暂不行动的通知', planningRequired: true, task: { kind: 'notice' } }, 'bounded-source');
    assert.equal(sent.outcome, 'submitted', sent.reason); c.GM.turn = 2; c.deliver();
    let release; c.callAI = () => { c.modelPrompts.push('bounded'); return new Promise(resolve => { release = resolve; }); };
    const first = run(c), second = run(c);
    assert.equal(typeof release, 'function');
    const secondResult = await second;
    assert.equal(c.modelPrompts.length, 1, 'the second wake must see the processing lease');
    release(JSON.stringify({ planning: null }));
    await first;
    const request = c.GM._npcActionState.planning.pending.find(q => q.actorId === a.id);
    assert.equal(request.status, 'no_change');
    await run(c);
    assert.equal(c.modelPrompts.length, 1, 'a valid no-change result is not retried by a wake');
    assert(secondResult && /no_planning_trigger|expired/.test(secondResult.skipped || ''));
  });

  console.log('PASS ' + passed + ' NPC AI routing groups');
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
