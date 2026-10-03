'use strict';

// Regression coverage for the production composition.  Unlike the older
// office-duty smoke, this fixture loads OfficeTenure and checks the strict
// payment path when optional chooser code is absent.
const assert = require('node:assert/strict');
const { fixture } = require('./lib-npc-action-fixture');

function box(n) { return { stock: n, available: n, quota: 100, used: 0 }; }
function setup() {
  const c = fixture();
  c.P.time = { daysPerTurn: 1 };
  c.GM.turn = 1;
  c.GM.facs = [{ id: 'court', name: '朝廷', isPlayer: true }];
  c.GM.officeTree = [
    { id: 'source', name: '甲署', authorityFactionId: 'court', publicTreasury: { money: box(100), grain: box(0), cloth: box(0) }, positions: [
      { id: 'cashier', name: '库吏', holderId: 'b', holder: '库吏', actualHolders: [{ characterId: 'b', name: '库吏', appointmentId: 'cashier-appt' }], powers: { treasurySpend: true }, treasuryBinding: { role: 'custodian', accountRef: 'source' }, authorityScope: { accountRefs: ['dest'] } }
    ] },
    { id: 'dest', name: '乙署', authorityFactionId: 'court', publicTreasury: { money: box(0), grain: box(0), cloth: box(0) }, positions: [] }
  ];
  c.GM.publicTreasuryConfig = { schema: 'tm-public-treasury/2', accounts: ['source', 'dest'].map(id => ({ id, kind: 'physical', factionId: 'court', source: { kind: 'department', id } })) };
  c.load('tm-sim-time.js');
  c.load('tm-political-actions.js');
  c.load('tm-npc-daily-activities.js');
  c.load('tm-npc-local-ai.js');
  const requester = c.actor('a', '申请人');
  const cashier = c.actor('b', '库吏', { officialTitle: '库吏' });
  c.GM.documents = [
    { id: 'doc-related', version: 1, kind: 'document', public: true, status: 'confirmed', factStatus: 'confirmed', organizationId: 'court', subjectId: 'water-1', content: '已核对材料' },
    { id: 'doc-unrelated', version: 1, kind: 'document', public: true, status: 'confirmed', factStatus: 'confirmed', organizationId: 'court', subjectId: 'other-1', content: '另一事项材料' },
    { id: 'doc-unknown', version: 1, kind: 'document', public: true, organizationId: 'court', subjectId: 'water-1', content: '来源质量未详' },
    { id: 'doc-private', version: 1, kind: 'document', organizationId: 'court', subjectId: 'water-1', status: 'confirmed', factStatus: 'confirmed', content: '未送达的内部材料' }
  ];
  c.GM.memorials = [{ id: 'matter-water', version: 1, kind: 'public_work', public: true, status: 'open', organizationId: 'court', subjectId: 'water-1', allowPublicTransfer: true,
    transferPolicy: { allowMoney: true, maxMoney: 100, allowPartial: true }, sourceRefs: [{ kind: 'document', id: 'doc-related', version: 1 }] }];
  return { c, requester, cashier };
}
function basis(material) { return { matterRef: { kind: 'memorial', id: 'matter-water', version: 1 }, sourceRefs: [{ kind: 'document', id: material, version: 1 }], organizationId: 'court', subjectId: 'water-1' }; }

{
  const { c, cashier } = setup();
  const allowed = c.TM.OfficeTenure.canAct({ world: c.GM, actor: cashier, positionId: 'cashier', organizationId: 'court', action: 'public_transfer', power: 'treasurySpend' });
  assert.equal(allowed.ok, true, 'ordinary in-service holder is usable without a leave/delegation row');
}

{
  const { c, requester, cashier } = setup();
  const before = c.GM.officeTree[0].publicTreasury.money.stock;
  const savedLocal = c.TM.NPC.LocalAI;
  delete c.TM.NPC.LocalAI;
  const receipt = c._npcTransferPublic(cashier, { actionId: 'strict-without-validator', phase: 'execute', behaviorType: 'office_duty', dutyRequest: true,
    organizationId: 'court', actingPositionId: 'cashier', appointmentId: 'cashier-appt', fromAccount: 'source', toAccount: 'dest', amounts: { money: 5 }, purpose: '水利材料', basis: basis('doc-related') });
  c.TM.NPC.LocalAI = savedLocal;
  assert.equal(receipt.outcome, 'blocked');
  assert.equal(receipt.reason, 'duty_validator_unavailable');
  assert.equal(c.GM.officeTree[0].publicTreasury.money.stock, before, 'missing strict validator cannot fall back to legacy payment');
  assert.equal((c.GM._publicTreasuryTransfers || []).length, 0);
  void requester;
}

{
  const { c, requester } = setup();
  function evidence(material) { return c.TM.NPC.LocalAI.dutyEvidence({ kind: 'public_transfer', organizationId: 'court', fromAccount: 'source', toAccount: 'dest', amounts: { money: 5 }, purpose: '水利材料', basis: basis(material) }, requester); }
  assert.equal(evidence('doc-unrelated').reason, 'duty_material_not_related', 'confirmed material for another matter is not enough');
  assert.equal(evidence('doc-unknown').reason, 'duty_material_unverified', 'missing fact status remains unknown');
  assert.equal(evidence('doc-private').reason, 'duty_material_not_readable', 'same-organization private material is not automatically known');
}

{
  const { c, requester, cashier } = setup();
  const submitted = c.TM.NPC.LocalAI.requestPublicTransfer(requester, { actionId: 'proposal-in-transit', targetId: cashier.id, organizationId: 'court', fromAccount: 'source', toAccount: 'dest', amounts: { money: 90 }, purpose: '水利材料', subjectId: 'water-1', matter: { kind: 'memorial', id: 'matter-water', version: 1 }, sourceRefs: [{ kind: 'document', id: 'doc-related', version: 1 }] }, false);
  assert.equal(submitted.outcome, 'submitted');
  const plan = c.GM._npcPlans.find(p => p.id === submitted.planId);
  c.GM.turn = 2;
  c.TM.NPC.ActionLedger.advance(c.GM);
  assert.equal(plan.status, 'awaiting_response');
  const original = plan.task.amounts.money;
  const response = c.TM.NPC.ActionLedger.social(cashier, { planId: plan.id, phase: 'respond', response: 'conditions', actionId: 'proposal-in-transit:respond', expectedRevision: plan.revision,
    task: Object.assign({}, plan.task, { amounts: { money: 20 } }), actingPositionId: 'cashier', appointmentId: 'cashier-appt', content: '先按阶段额度办理' });
  assert.equal(response.outcome, 'submitted');
  assert.equal(plan.task.amounts.money, original, 'a proposal in transit cannot overwrite the current task');
  assert.equal(plan.messages.at(-1).data.revisedTask.amounts.money, 20);
}

{
  const { c, requester, cashier } = setup();
  const submitted = c.TM.NPC.LocalAI.requestPublicTransfer(requester, { actionId: 'defer-wakeup', targetId: cashier.id, organizationId: 'court', fromAccount: 'source', toAccount: 'dest', amounts: { money: 5 }, purpose: '水利材料', subjectId: 'water-1', matter: { kind: 'memorial', id: 'matter-water', version: 1 }, sourceRefs: [{ kind: 'document', id: 'doc-related', version: 1 }] }, false);
  const plan = c.GM._npcPlans.find(p => p.id === submitted.planId);
  c.GM.turn = 2;
  c.TM.NPC.ActionLedger.advance(c.GM);
  const deferred = c.TM.NPC.ActionLedger.social(cashier, { planId: plan.id, phase: 'respond', response: 'defer', dueTurn: 6, actionId: 'defer-wakeup:respond', expectedRevision: plan.revision, content: '待下一办理时段复核' });
  assert.equal(deferred.outcome, 'submitted');
  c.GM.turn = 3;
  c.TM.NPC.ActionLedger.advance(c.GM);
  assert.equal(plan.status, 'deferred');
  assert.equal(plan.nextActorId, cashier.id, 'defer keeps a concrete wake actor');
  c.GM.turn = 6;
  const view = c.TM.NPC.ActionLedger.planView(plan, cashier);
  assert.equal(view.nextPhase, 'respond', 'deferred duty is due again instead of being orphaned');
}

{
  const { c, cashier } = setup();
  const player = c.actor('p', '玩家申请人', { isPlayer: true });
  c.GM.playerInfo = { characterId: player.id, factionId: 'court' };
  const created = c.TM.NPC.LocalAI.createDutyMatter(player, { actionId: 'formal-matter-1', title: '登记春耕水利事项', purpose: '春耕水利', amount: 8, organizationId: 'court', subjectId: 'water-1', sourceRefs: [{ kind: 'document', id: 'doc-related', version: 1 }] }, true);
  assert.equal(created.outcome, 'submitted', created.reason);
  const matter = c.GM._npcDutyMatters.find(row => row.id === created.matterId);
  assert.ok(matter && matter.requestedTransfer && !matter.transferPolicy, 'formal entry creates an unapproved request, not a pre-paid result');
  const request = c.TM.NPC.LocalAI.requestPublicTransfer(player, { actionId: 'formal-transfer-1', targetId: cashier.id, organizationId: 'court', fromAccount: 'source', toAccount: 'dest', amounts: { money: 8 }, purpose: '春耕水利', subjectId: 'water-1', matter: { kind: 'duty_matter', id: matter.id, version: 1 }, sourceRefs: [{ kind: 'document', id: 'doc-related', version: 1 }] }, true);
  assert.equal(request.outcome, 'submitted', request.reason);
  for (let i = 0; i < 12 && !/^(done|awaiting_feedback)$/.test(c.GM._npcPlans.find(p => p.id === request.planId).status); i++) { c.GM.turn += 1; c.TM.NPC.LocalAI.wake('turn'); c.TM.NPC.ActionLedger.advance(c.GM); }
  const plan = c.GM._npcPlans.find(p => p.id === request.planId);
  assert.equal(plan.status, 'awaiting_feedback');
  const feedback = c.TM.NPC.ActionLedger.playerRespond(plan.id, 'satisfied', '已收到实际交割');
  assert.equal(feedback.outcome, 'completed');
  c.GM.turn += 1;
  c.TM.NPC.ActionLedger.advance(c.GM);
  assert.equal(plan.status, 'done', JSON.stringify(plan));
  assert.equal(matter.transferPolicy.source, 'office-duty-decision');
  assert.equal(c.GM.officeTree[0].publicTreasury.money.stock, 92);
  assert.equal(c.GM.officeTree[1].publicTreasury.money.stock, 8);
  assert.equal(c.GM._publicTreasuryTransfers.length, 1);
}

console.log('PASS office-duty-reliability: OfficeTenure composition, strict validator boundary, matter/material association, and non-destructive revisions');
