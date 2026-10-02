'use strict';

// Production-module fixture: this loads the shipped OfficeHolderState,
// ActionLedger, MapRouteDays, DailyActivities, Meetings and the new tenure
// adapter.  It does not write leave/delegation effects directly in the test.
const assert = require('node:assert/strict');
const { fixture } = require('./lib-npc-action-fixture');

const c = fixture();
c.P.time = { daysPerTurn: 1 };
c.GM.turn = 1;
c.GM._tmTime = null;
c.load('tm-sim-time.js');
c.load('tm-map-locations.js');
c.load('tm-map-route-days.js');
c.load('tm-npc-daily-activities.js');
c.load('tm-npc-travel.js');
c.load('tm-office-reform.js');
c.load('tm-office-tenure.js');
c.load('tm-npc-local-ai.js');
c.GM.mapData = {
  locationBindingContract: { schema: 'source-text-location-v2' },
  regions: [
    { id: 'east', name: '东城', geographicCenter: [116, 40], neighbors: ['mid'] },
    { id: 'mid', name: '中城', geographicCenter: [116.5, 40], neighbors: ['east', 'west'] },
    { id: 'west', name: '西城', geographicCenter: [117, 40], neighbors: ['mid'] }
  ]
};
const a = c.actor('a', '甲', { location: '东城', regionId: 'east' });
const boss = c.actor('boss', '乙', { location: '东城', regionId: 'east' });
const delegate = c.actor('d', '丙', { location: '东城', regionId: 'east' });
const recipient = c.actor('r', '丁', { location: '东城', regionId: 'east' });

const tenure = {
  version: 1, dutyMode: 'resident', usualDutyLocationId: 'east', jurisdictionIds: ['east', 'west'],
  onsiteActions: ['document_transfer'],
  leave: { requiresApproval: true, decisionPositionId: 'pos-approver', maxDays: 20, allowedKinds: ['private'] },
  delegation: { allowed: true, allowedActions: ['document_transfer'], allowedPositionIds: ['pos-delegate'], maxDays: 20, requiresAcceptance: true }
};
c.GM.officeTree = [{ id: 'dept', name: '东城署', authorityFactionId: 'court', positions: [
  { id: 'pos-a', name: '署丞', holderId: 'a', holder: '甲', actualHolders: [{ characterId: 'a', name: '甲' }], powers: { drafting: true }, officeTenure: tenure },
  { id: 'pos-approver', name: '长官', holderId: 'boss', holder: '乙', actualHolders: [{ characterId: 'boss', name: '乙' }], powers: { supervise: true } },
  { id: 'pos-delegate', name: '书佐', holderId: 'd', holder: '丙', actualHolders: [{ characterId: 'd', name: '丙' }], powers: { drafting: true } },
  { id: 'pos-new-approver', name: '新长官', holderId: 'r', holder: '丁', actualHolders: [{ characterId: 'r', name: '丁' }], powers: { supervise: true } }
] }];

function formalDay() {
  const interval = c.TM.SimTime.prepare(c.GM);
  c.GM.turn++;
  const receipt = c.TM.SimTime.commit(c.GM, interval);
  assert.equal(receipt.ok, true);
  const ledger = c.TM.NPC.ActionLedger.advance(c.GM);
  assert.equal(ledger.ok, true, ledger.reason);
  const t = c.TM.OfficeTenure.tick(c.GM, { toDay: c.TM.SimTime.now(c.GM) });
  assert.equal(t.ok, true, t.reason);
}
function act(fn, ch, data) {
  const r = fn.call(c.TM.OfficeTenure, ch, Object.assign({ organizationId: 'court' }, data), false);
  assert.ok(r && r.outcome, JSON.stringify(r));
  return r;
}

const requested = act(c.TM.OfficeTenure.requestLeave, a, { actionId: 'tenure-request-1', positionId: 'pos-a', destinationId: 'west', startDay: 1, latestReturnDay: 14, kind: 'private', reason: '探亲' });
assert.equal(requested.outcome, 'submitted');
const leaveId = requested.leaveId;
formalDay(); // request reaches the approver
const localOffice = c.TM.NPC.LocalAI.wake('turn');
assert.ok(localOffice && localOffice.apiCalls === 0);
const decided = c.GM._npcPlans.find(p => p.officeTenure && p.officeTenure.leaveId === leaveId);
assert.equal(decided.status, 'response_in_transit');
formalDay(); // approval reaches the applicant
const delegated = act(c.TM.OfficeTenure.appointDelegate, a, { actionId: 'tenure-delegate-1', positionId: 'pos-a', leaveId, delegateId: 'd', scope: ['document_transfer'] });
assert.equal(delegated.outcome, 'submitted');
formalDay();
const accepted = act(c.TM.OfficeTenure.acceptDelegate, delegate, { actionId: 'tenure-delegate-accept-1', positionId: 'pos-a', leaveId, delegationId: delegated.delegationId });
assert.equal(accepted.outcome, 'completed');
const departed = act(c.TM.OfficeTenure.beginLeave, a, { actionId: 'tenure-depart-1', positionId: 'pos-a', leaveId });
assert.equal(departed.outcome, 'started');
assert.ok(a._officeJourney && /^(in_transit|arrived)$/.test(a._officeJourney.status));

while (a._officeJourney.status === 'in_transit') formalDay();
const state = c.TM.OfficeTenure.state(c.TM.OfficeHolderState.position(c.GM, { positionId: 'pos-a' }).pos, false);
const leave = state.leaves.find(x => x.id === leaveId);
assert.equal(leave.status, 'at_destination');
const doc = act(c.TM.OfficeTenure.performDelegatedDocument, delegate, { actionId: 'tenure-doc-1', positionId: 'pos-a', leaveId, delegateId: 'd', recipientId: 'r', content: '已核查并转呈东城署材料。', sourceRefs: [{ kind: 'known_document', id: 'material-1' }] });
assert.equal(doc.outcome, 'submitted');
formalDay();
const storedDoc = leave.documents.find(x => x.id === doc.documentId);
assert.equal(storedDoc.status, 'delivered');
assert.ok(c.GM._npcPlans.some(p => p.officeTenure && p.officeTenure.leaveId === leaveId));

const returned = act(c.TM.OfficeTenure.returnLeave, a, { actionId: 'tenure-return-1', positionId: 'pos-a', leaveId });
assert.equal(returned.outcome, 'started');
while (a._officeJourney.status === 'in_transit') formalDay();
assert.equal(leave.status, 'returned_pending_report');
const report = act(c.TM.OfficeTenure.receiveReturnReport, boss, { actionId: 'tenure-report-1', positionId: 'pos-a', leaveId, content: '已按期归任，交代在途事项。' });
assert.equal(report.outcome, 'completed');
assert.equal(leave.status, 'returned');

// The existing reform queue changes the actual leave-decision position.  The
// old holder cannot approve a later request; the new holder can.
const reform = c.enqueuePendingReform(c.GM, { kind: 'authority_transfer', reformDetail: '权责调整', fromPositionId: 'pos-a', toPositionId: 'pos-new-approver', authorityKey: 'leave_decision', reason: '改制测试' }, c.GM.turn);
assert.ok(reform);
reform.proposedTurn = c.GM.turn - 1;
const reformResult = c.adjudicatePendingReforms(c.GM, { authority: 100 });
assert.equal(reformResult.length, 1);
assert.equal(reformResult[0].applied, true);
const newPos = c.TM.OfficeHolderState.position(c.GM, { positionId: 'pos-a' }).pos;
assert.equal(newPos.officeTenure.leave.decisionPositionId, 'pos-new-approver');
const second = act(c.TM.OfficeTenure.requestLeave, a, { actionId: 'tenure-request-after-reform', positionId: 'pos-a', destinationId: 'west', startDay: c.TM.SimTime.now(c.GM) + 1, latestReturnDay: c.TM.SimTime.now(c.GM) + 8, kind: 'private', reason: '改制后复核' });
assert.equal(second.outcome, 'submitted');
assert.equal(c.TM.OfficeTenure.state(newPos, false).leaves.find(x => x.id === second.leaveId).deciderId, 'r');
formalDay();
const oldDecision = act(c.TM.OfficeTenure.decideLeave, boss, { actionId: 'tenure-old-authority-after-reform', positionId: 'pos-a', leaveId: second.leaveId, decision: 'approve' });
assert.equal(oldDecision.outcome, 'blocked');
const newDecision = act(c.TM.OfficeTenure.decideLeave, recipient, { actionId: 'tenure-new-authority-after-reform', positionId: 'pos-a', leaveId: second.leaveId, decision: 'approve' });
assert.equal(newDecision.outcome, 'submitted');

// Save/restore is the ordinary detached clone used by the game.  The leave,
// document and reform history are all on the existing officeTree object.
const restored = JSON.parse(JSON.stringify(c.GM));
const restoredPos = restored.officeTree[0].positions.find(p => p.id === 'pos-a');
assert.equal(restoredPos._officeTenureState.leaves[0].status, 'returned');
assert.equal(restoredPos._officeTenureState.leaves[0].documents[0].status, 'delivered');
assert.equal(restoredPos.officeTenure.leave.decisionPositionId, 'pos-new-approver');

console.log('PASS office-tenure: request → approval → handoff → real delegated delivery → travel → return → report → reform → save');
