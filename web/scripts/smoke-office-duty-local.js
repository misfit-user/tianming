'use strict';

// Production-module fixture: the request, plan, authority check, local choice,
// ActionLedger commit and PublicTreasury transfer are all shipped code.  The
// fixture supplies only a small world and deliberately throws if callAI runs.
const assert = require('node:assert/strict');
const { fixture } = require('./lib-npc-action-fixture');

const c = fixture();
c.P.time = { daysPerTurn: 1 };
c.GM.turn = 1;
c.GM._tmTime = null;
let apiCalls = 0;
c.callAI = () => { apiCalls++; throw new Error('local office duty must not call a model'); };
c.load('tm-sim-time.js');
c.load('tm-political-actions.js');
c.load('tm-npc-daily-activities.js');
c.load('tm-npc-local-ai.js');

const a = c.actor('a', '主簿', { officialTitle: '主簿' });
const b = c.actor('b', '库吏', { officialTitle: '库吏' });
const outsider = c.actor('x', '无权经办');
const box = n => ({ stock: n, available: n, quota: 100, used: 0 });
c.GM.officeTree = [{ id: 'source', name: '甲署', authorityFactionId: 'court', publicTreasury: { money: box(100), grain: box(0), cloth: box(0) }, positions: [
  { id: 'supervise', name: '主簿', holderId: a.id, holder: a.name, actualHolders: [{ characterId: a.id, name: a.name }], powers: { supervise: true } },
  { id: 'cashier', name: '库吏', holderId: b.id, holder: b.name, actualHolders: [{ characterId: b.id, name: b.name }], powers: { treasurySpend: true }, treasuryBinding: { role: 'custodian', accountRef: 'source' } }
] }, { id: 'dest', name: '乙署', authorityFactionId: 'court', publicTreasury: { money: box(0), grain: box(0), cloth: box(0) }, positions: [] }];
c.GM.publicTreasuryConfig = { schema: 'tm-public-treasury/2', accounts: ['source', 'dest'].map(id => ({ id, kind: 'physical', factionId: 'court', source: { kind: 'department', id } })) };

const request = c.TM.NPC.LocalAI.requestPublicTransfer(a, {
  actionId: 'local-duty-request-1', targetId: b.id, target: b.name, organizationId: 'court', actingPositionId: 'supervise',
  fromAccount: 'source', toAccount: 'dest', amounts: { money: 30 }, purpose: '核验春耕水利材料后拨付三十贯', intent: '办理水利材料公库交割'
}, false);
assert.equal(request.outcome, 'submitted', request.reason);
assert.equal(c.GM._npcPlans.length, 1, 'the request is the existing ActionLedger plan');
assert.equal(c.GM.chars.find(ch => ch.id === a.id).localGoals, undefined, 'no localGoal was supplied');

function step() {
  c.GM.turn += 1;
  c.TM.NPC.LocalAI.wake('turn');
  const advanced = c.TM.NPC.ActionLedger.advance(c.GM);
  assert.equal(advanced.ok, true, advanced.reason);
}

for (let i = 0; i < 10 && c.GM._npcPlans[0].status !== 'done'; i++) step();
const plan = c.GM._npcPlans[0];
assert.equal(plan.status, 'done', JSON.stringify(plan));
assert.equal(c.GM.officeTree[0].publicTreasury.money.stock, 70, 'the real source account was debited');
assert.equal(c.GM.officeTree[1].publicTreasury.money.stock, 30, 'the real destination account was credited');
assert.equal(c.GM._publicTreasuryTransfers.length, 1, 'one domain transfer receipt exists');
assert.ok(plan.steps.some(s => s.kind === 'public_transfer' && s.operationRefs.some(r => r.kind === 'public_transfer')), 'the plan cites the actual transfer');
assert.equal(apiCalls, 0, 'the complete local duty loop made no model attempt');

const revised = c.TM.NPC.LocalAI.requestPublicTransfer(a, {
  actionId: 'local-duty-shortfall', targetId: b.id, target: b.name, organizationId: 'court', actingPositionId: 'supervise',
  fromAccount: 'source', toAccount: 'dest', amounts: { money: 100 }, purpose: '按当前余额分段办理', intent: '核验余额后分段交割'
}, false);
assert.equal(revised.outcome, 'submitted', revised.reason);
for (let i = 0; i < 10 && c.GM._npcPlans.find(p => p.id === revised.planId).status !== 'done'; i++) step();
const revisedPlan = c.GM._npcPlans.find(p => p.id === revised.planId);
assert.equal(revisedPlan.status, 'done', JSON.stringify(revisedPlan));
assert.equal(c.GM.officeTree[0].publicTreasury.money.stock, 0, 'the revised task is capped by the material actually available');
assert.equal(c.GM.officeTree[1].publicTreasury.money.stock, 100, 'the revised transfer remains conserved');

const denied = c.TM.NPC.LocalAI.requestPublicTransfer(a, {
  actionId: 'local-duty-unauthorized', targetId: outsider.id, target: outsider.name, organizationId: 'court', actingPositionId: 'supervise',
  fromAccount: 'source', toAccount: 'dest', amounts: { money: 1 }, purpose: '不应由无权人员承办', intent: '越权公库事项'
}, false);
assert.equal(denied.outcome, 'submitted', denied.reason);
for (let i = 0; i < 8 && c.GM._npcPlans.find(p => p.id === denied.planId).status !== 'rejected'; i++) step();
assert.equal(c.GM._npcPlans.find(p => p.id === denied.planId).status, 'rejected', 'an unqualified recipient is refused without a transfer');
assert.equal(c.GM._publicTreasuryTransfers.length, 2, 'the rejected matter adds no financial receipt');

const player = c.actor('p', '玩家承办人', { isPlayer: true });
c.GM.playerInfo = { characterId: player.id, factionId: 'court' };
c.GM.officeTree[0].positions.push({ id: 'player-supervise', name: '玩家主簿', holderId: player.id, holder: player.name, actualHolders: [{ characterId: player.id, name: player.name }], powers: { supervise: true } });
const dutyHtml = c.TM.NPC.LocalAI.renderDutyPanel();
assert.match(dutyHtml, /data-office-duty="request-transfer"/, 'the existing office page receives a structured duty entry');
const humanRequest = c.TM.NPC.LocalAI.requestPublicTransfer(player, {
  actionId: 'human-duty-request', targetId: b.id, target: b.name, organizationId: 'court', actingPositionId: 'player-supervise',
  fromAccount: 'source', toAccount: 'dest', amounts: { money: 1 }, purpose: '玩家提出一项有明确用途的交割请求'
}, true);
assert.equal(humanRequest.outcome, 'submitted', humanRequest.reason);
assert.equal(c.GM._publicTreasuryTransfers.length, 2, 'a player request is not an automatic payment');

const before = JSON.stringify(c.GM);
const restored = JSON.parse(before);
assert.equal(restored._npcPlans[0].status, 'done', 'save-shaped state preserves the completed matter');
assert.equal(restored._publicTreasuryTransfers.length, 2, 'save-shaped state preserves both receipts without replay');
console.log('PASS office-duty-local: sourced request → local authority/material check → real treasury transfer → feedback → save-shaped restore (no API)');
