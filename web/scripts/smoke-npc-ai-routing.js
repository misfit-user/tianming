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

  await test('a real rejection ends a single-step direction without claiming success', async () => {
    const c = setup(), a = c.add('owner:one', '同名'), b = c.add('respondent:two', '同名', { isPlayer: true });
    const source = c.TM.OfficeTenure.notifyOfficeChange(c.GM, a, { kind: 'appointment', sourceVersion: 1, content: '本人收到新的安排，需要另作联系' });
    assert(source && source.message); c.GM.turn = 2; c.deliver();
    c.callAI = async () => JSON.stringify({ planning: { objective: '询问是否愿意往来', nextSteps: [{ id: 'ask:with:colon', kind: 'greeting', targetId: b.id }] } });
    await run(c); c.GM.turn = 3; await run(c);
    const p = c.GM._npcPlans.find(x => x.localActivity && x.actorId === a.id);
    assert(p, 'the model direction starts through the ordinary local activity'); c.deliver();
    const reply = c.TM.NPC.DailyActivities.submitHuman(c.TM.NPC.DailyActivities.ticket(b, { planId: p.id, phase: 'respond' }), { response: 'reject' });
    assert.equal(reply.outcome, 'submitted', reply.reason);
    const planning = c.GM._npcActionState.planning, direction = Object.values(planning.directions)[0];
    assert.notEqual(direction.steps[0].status, 'rejected', 'the author has not received the refusal yet');
    c.GM.turn = 4; c.deliver();
    assert.equal(direction.steps[0].status, 'rejected');
    assert.equal(direction.status, 'ended', 'finished without the proposed objective being achieved');
    assert.equal(planning.completedSteps, 0);
    c.GM = JSON.parse(JSON.stringify(c.GM)); c.GM.turn = 20; c._npcPlanningReconcile(c.GM._npcActionState.planning, c.GM.chars);
    assert.equal(c.GM._npcActionState.planning.directions[direction.id].status, 'ended', 'review and reload cannot reinterpret a refusal as success');
  });

  await test('meeting progress reads actual participation and cannot replay or misassign terminal outcomes', async () => {
    const c = setup(), a = c.add('actor:one', '同名'), b = c.add('actor:two', '同名');
    // Isolated projection regression: the full meeting lifecycle is exercised in the travel and browser suites.
    const planning = c._npcPlanningState();
    const make = (suffix, status, discussion) => {
      const sourceGoal = 'goal:one:' + suffix + ':version:1';
      const dir = { id: 'direction:' + suffix, actorId: a.id, status: 'active', reviewDay: 0, steps: [
        { id: 'first:' + suffix, goalId: 'goal:' + suffix, goalSource: sourceGoal, kind: 'meeting', status: 'started', dependsOn: [] }
      ] };
      planning.directions[dir.id] = dir;
      const p = { id: 'activity:' + suffix, actorId: a.id, targetId: b.id, status,
        localActivity: { kind: 'meeting', sourceGoalId: sourceGoal, meeting: { status: 'returned',
          participation: { id: 'participation:' + suffix, participants: [a.id, b.id] },
          actorReturnJourney: { status: 'returned' }, targetReturnJourney: { status: 'staying' }, discussion } } };
      c.GM._npcPlans.push(p); return { p, dir, sourceGoal };
    };
    const partial = make('partial', 'ended', { status: 'uncompleted', outcome: 'partial', actorContent: '提出理解' });
    c._npcPlanningStepResult(b.id, partial.sourceGoal, { planId: partial.p.id, outcome: 'completed', verified: true });
    assert.equal(partial.dir.steps[0].status, 'ended', 'a different responder updates the owner, and a terminal partial result is not success');
    assert.equal(partial.dir.status, 'ended');
    const plain = make('plain', 'done', null);
    c._npcPlanningStepResult(b.id, plain.sourceGoal, { planId: plain.p.id, outcome: 'completed', verified: true });
    assert.equal(plain.dir.status, 'completed', 'a plain meeting can accomplish its actual meeting purpose');
    const successful = make('discussion', 'done', { status: 'completed', result: { sourcePlanId: 'activity:discussion', topicId: 'reading_understanding', targetContent: '分辨亲见与转述' } });
    successful.dir.steps.push({ id: 'next', goalSource: 'goal:next:1', goalId: 'goal:next', kind: 'greeting', status: 'blocked', dependsOn: [successful.dir.steps[0].id] });
    a.localGoals = [{ id: 'goal:next', planningDirectionId: successful.dir.id, planningStepId: 'next', status: 'blocked' }];
    c._npcPlanningStepResult(b.id, successful.sourceGoal, { planId: successful.p.id, outcome: 'completed', verified: true });
    assert.equal(successful.dir.steps[1].status, 'ready'); assert.equal(a.localGoals[0].status, 'active');
    successful.dir.steps[1].status = 'started';
    c._npcPlanningStepResult(a.id, successful.sourceGoal, { planId: successful.p.id, outcome: 'completed', verified: true });
    assert.equal(successful.dir.steps[1].status, 'started', 'a repeated result cannot activate the next step twice');
    const completedCount = planning.completedSteps;
    c._npcPlanningStepResult(b.id, plain.sourceGoal, { planId: plain.p.id, outcome: 'waiting' });
    c._npcPlanningStepResult(b.id, plain.sourceGoal, { planId: plain.p.id, outcome: 'completed', verified: true });
    assert.equal(plain.dir.status, 'completed'); assert.equal(planning.completedSteps, completedCount, 'late and repeated callbacks do not reopen or reward a finished step');
    const unsupported = make('false-complete', 'done', { status: 'uncompleted', outcome: 'not_started' });
    c._npcPlanningStepResult(a.id, unsupported.sourceGoal, { planId: unsupported.p.id, outcome: 'completed', verified: true });
    assert.notEqual(unsupported.dir.steps[0].status, 'completed', 'old done cannot certify missing discussion');
    for (const outcome of ['cancelled', 'expired', 'rejected', 'ended']) {
      const x = make(outcome, outcome, null);
      c._npcPlanningStepResult(b.id, x.sourceGoal, { planId: x.p.id, outcome, verified: false });
      assert.equal(x.dir.status, 'ended', outcome + ' is a non-success end');
    }
  });

  await test('growth records use stable identities and retain unambiguous name compatibility', async () => {
    const c = setup(), a = c.add('a', '同名'), b = c.add('b', '同名'), d = c.add('d', '独名');
    c.CharacterGrowthSystem.recordExperience(a.name, '现场请益', '仅甲实际听到', { characterId: a.id });
    assert.equal(a._lifeExp.length, 1); assert.equal(b._lifeExp, undefined);
    c.CharacterGrowthSystem.recordExperience(a.name, '现场请益', '错误显式 ID 不回退', { characterId: 'missing' });
    assert.equal(a._lifeExp.length, 1); assert.equal(b._lifeExp, undefined);
    c.CharacterGrowthSystem.recordExperience(a.name, '现场请益', '同名不能任意选人');
    assert.equal(a._lifeExp.length, 1); assert.equal(b._lifeExp, undefined);
    c.CharacterGrowthSystem.recordExperience(d.name, '旧入口', '保留姓名兼容');
    assert.equal(d._lifeExp.length, 1);
  });

  await test('meeting refusal or cancellation reaches its original direction only through actual delivery', async () => {
    for (const cancel of [false, true]) {
      const c = setup(), a = c.add('owner:meeting', '甲'), b = c.add('partner:meeting', '乙', cancel ? { playerControlled: true, location: '别处' } : { stress: 100, location: '别处' });
      c.GM.mapData.regions[0].geographicCenter=[116,40]; c.GM.mapData.regions[0].neighbors=['place-b'];
      c.GM.mapData.regions[1].geographicCenter=[117,40]; c.GM.mapData.regions[1].neighbors=['place-a'];
      c.TM.SimTime.ensure(c.GM);
      const advance = days => { c.P.time.daysPerTurn=days; const interval=c.TM.SimTime.prepare(c.GM); c.GM.turn++; c.TM.SimTime.commit(c.GM,interval); c.GM.busy=true; c.GM._endTurnBusy=true; const r=c.TM.NPC.ActionLedger.advance(c.GM); c.GM.busy=false; c.GM._endTurnBusy=false; assert.equal(r.ok,true,r.reason); };
      const source=c.TM.OfficeTenure.notifyOfficeChange(c.GM,a,{kind:'appointment',sourceVersion:1,content:'本人收到新安排，需要重新商定往来'});
      assert(source&&source.message); advance(1);
      c.callAI=async()=>JSON.stringify({planning:{objective:'询问一次会面的意愿',nextSteps:[{id:'meet:one',kind:'meeting',targetId:b.id,meeting:{locationId:'place-b',requestedStartDay:12,durationDays:2,windowDays:4}}]}});
      await run(c); advance(1); await run(c);
      const direction=Object.values(c._npcPlanningState().directions)[0];
      assert(direction); const D=c.TM.NPC.DailyActivities,p=D.plans().find(x=>x.localActivity.kind==='meeting'&&x.actorId===a.id);assert(p);
      for(let i=0;i<8&&!p.messages.some(m=>m.kind==='meeting_request'&&m.status==='delivered');i++)advance(1);
      if(cancel)assert.equal(D.submitHuman(D.ticket(D.person(b.id),{planId:p.id,phase:'cancel'}),{}).outcome,'submitted');
      const reply=p.messages.find(m=>m.kind===(cancel?'meeting_cancel':'meeting_response'));assert(reply);assert.equal(reply.status,'in_transit');
      assert.equal(c._npcPlanningState().directions[direction.id].steps[0].status,'started','the source owner has not received the remote outcome');
      for(let i=0;i<8&&reply.status!=='delivered';i++)advance(1);
      assert.equal(reply.status,'delivered');
      const updated=c._npcPlanningState().directions[direction.id];
      assert.equal(updated.steps[0].status,cancel?'cancelled':'rejected');assert.equal(updated.status,'ended');assert.equal(c._npcPlanningState().completedSteps,0);
      c.GM=JSON.parse(JSON.stringify(c.GM));advance(1);assert.equal(c._npcPlanningState().directions[direction.id].status,'ended');
    }
  });

  console.log('PASS ' + passed + ' NPC AI routing groups');
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
