'use strict';

const assert = require('node:assert/strict');
const { fixture } = require('./lib-npc-action-fixture');

function world(options = {}) {
  const c = fixture();
  c.P.time = { daysPerTurn: 1 };
  c.GM.turn = 2;
  c.GM.facs = [{ id: 'court', name: '朝廷', isPlayer: true }];
  c.GM.officeTree = [{ id: 'source', name: '甲署', authorityFactionId: 'court', publicTreasury: { money: box(80), grain: box(0), cloth: box(0) }, positions: [
    { id: 'cashier', name: '库吏', holderId: 'b', holder: '库吏', actualHolders: [{ characterId: 'b', name: '库吏' }], powers: { treasurySpend: true }, treasuryBinding: { role: 'custodian', accountRef: 'source' } }
  ] }, { id: 'dest', name: '乙署', authorityFactionId: 'court', publicTreasury: { money: box(0), grain: box(0), cloth: box(0) }, positions: [] }];
  c.GM.publicTreasuryConfig = { schema: 'tm-public-treasury/2', accounts: ['source', 'dest'].map(id => ({ id, kind: 'physical', factionId: 'court', source: { kind: 'department', id } })) };
  c.GM.documents = [{ id: 'doc-water', version: 1, kind: 'document', public: true, status: 'confirmed', factStatus: 'confirmed', organizationId: 'court', subjectId: 'water-1', content: '已核对水利材料' }];
  c.GM.memorials = [{ id: 'matter-water', version: 1, kind: 'public_work', public: true, status: 'open', organizationId: 'court', subjectId: 'water-1', allowPublicTransfer: true, transferPolicy: { allowMoney: true, maxMoney: 80, allowPartial: true }, sourceRefs: options.missing ? [] : [{ kind: 'document', id: 'doc-water', version: 1 }] }];
  c.actor('b', '库吏', { officialTitle: '库吏' });
  c.load('tm-sim-time.js');
  c.load('tm-political-actions.js');
  c.load('tm-npc-daily-activities.js');
  c.load('tm-npc-local-ai.js');
  return c;
}
function box(n) { return { stock: n, available: n, quota: 100, used: 0 }; }
function advance(c) { c.GM.turn += 1; c.TM.NPC.LocalAI.wake('turn'); const r = c.TM.NPC.ActionLedger.advance(c.GM); assert.equal(r.ok, true, r.reason); }
function request(c, actor, extra = {}, human = false) {
  return c.TM.NPC.LocalAI.requestPublicTransfer(actor, Object.assign({ actionId: 'evidence:' + actor.id + ':' + c.GM.turn, targetId: 'b', organizationId: 'court', fromAccount: 'source', toAccount: 'dest', amounts: { money: 10 }, purpose: '春耕水利', subjectId: 'water-1', matter: { kind: 'memorial', id: 'matter-water', version: 1 }, sourceRefs: [{ kind: 'document', id: 'doc-water', version: 1 }] }, extra), human);
}

{
  const c = world(), requester = c.actor('a', '无官申请人');
  const noBasis = c.TM.NPC.LocalAI.requestPublicTransfer(requester, { actionId: 'no-basis', targetId: 'b', organizationId: 'court', fromAccount: 'source', toAccount: 'dest', amounts: { money: 10 }, purpose: '只有用途文字' }, false);
  assert.equal(noBasis.outcome, 'blocked');
  assert.equal(noBasis.reason, 'duty_matter_reference_required');
  const submitted = request(c, requester);
  assert.equal(submitted.outcome, 'submitted');
  let plan = c.GM._npcPlans.find(p => p.id === submitted.planId);
  assert.equal(plan.task.basis.matterRef.id, 'matter-water');
  for (let i = 0; i < 12 && plan.status !== 'done'; i++) advance(c);
  assert.equal(plan.status, 'done', JSON.stringify(plan));
  assert.equal(c.GM._publicTreasuryTransfers.length, 1);
  assert.equal(c.GM._publicTreasuryTransfers[0].dutyEvidence.materialRefs[0].id, 'doc-water');
  assert.equal(c.GM.officeTree[0].publicTreasury.money.stock, 70);
  assert.equal(c.GM.officeTree[1].publicTreasury.money.stock, 10);
  assert.equal(Number(c.TM.NPC.LocalAI.wake('turn').dutyCompleted || 0), 0, 'a render or extra wake does not count a submitted phase as a new completion');
}

{
  const c = world({ missing: true }), player = c.actor('p', '玩家申请人', { isPlayer: true });
  c.GM.playerInfo = { characterId: player.id, factionId: 'court' };
  const submitted = request(c, player, { actionId: 'player-missing-material', sourceRefs: [] }, true);
  assert.equal(submitted.outcome, 'submitted');
  let plan = c.GM._npcPlans.find(p => p.id === submitted.planId);
  advance(c); // request delivery
  advance(c); // NPC asks for material
  advance(c); // response delivery
  assert.equal(plan.status, 'awaiting_agreement');
  const panel = c.TM.NPC.LocalAI.renderDutyPanel();
  assert.match(panel, /data-office-duty-plan/);
  assert.match(panel, /data-office-duty-material/);
  const stale = c.TM.NPC.ActionLedger.playerRespond(plan.id, 'accept', '旧版本补充', { expectedRevision: 0 });
  assert.notEqual(stale.outcome, 'submitted');
  const accepted = c.TM.NPC.ActionLedger.playerRespond(plan.id, 'accept', '补充已核对材料', { expectedRevision: plan.revision, sourceRefs: [{ kind: 'document', id: 'doc-water', version: 1 }], basis: { matterRef: { kind: 'memorial', id: 'matter-water', version: 1 }, sourceRefs: [{ kind: 'document', id: 'doc-water', version: 1 }], organizationId: 'court', subjectId: 'water-1' } });
  assert.equal(accepted.outcome, 'submitted', accepted.reason);
  plan = c.GM._npcPlans.find(p => p.id === plan.id);
  advance(c); advance(c); advance(c);
  plan = c.GM._npcPlans.find(p => p.id === plan.id);
  assert.equal(plan.status, 'awaiting_feedback');
  const feedback = c.TM.NPC.ActionLedger.playerRespond(plan.id, 'satisfied', '已收到实际交割');
  assert.equal(feedback.outcome, 'completed', feedback.reason);
  advance(c);
  assert.equal(plan.status, 'done');
  assert.equal(c.GM._publicTreasuryTransfers.length, 1);
  assert.equal(c.GM.officeTree[0].publicTreasury.money.stock, 70);
  const restored = JSON.parse(JSON.stringify(c.GM));
  assert.equal(restored._npcPlans.find(p => p.id === plan.id).task.basis.sourceRefs[0].id, 'doc-water');
  assert.equal(restored._publicTreasuryTransfers.length, 1);
}

console.log('PASS office-duty-evidence: stable matter/material → role-aware NPC choice → player supplement with revision guard → real payment → feedback/save');
