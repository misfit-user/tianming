'use strict';
// Load historical production blobs into isolated VMs; never checkout or edit
// the shared runtime. The same declared world and actual actions run twice.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict'), cp = require('node:child_process'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..'), web = path.join(root, 'web');
const { fixture } = require(path.join(web, 'scripts/lib-npc-action-fixture.js'));
const baseline = 'e6d5a592fc258f3328fd810c91b61ed0a24599cf';
const sourceCache = new Map(), identities = {};
function dailyFor(version) {
  const loaded = new Map();
  function source(file) {
    const key = version + ':' + file;
    if (!sourceCache.has(key)) sourceCache.set(key, version === 'current' ? fs.readFileSync(path.join(web, file), 'utf8') : cp.execFileSync('git', ['show', version + ':web/' + file], { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }));
    const text = sourceCache.get(key); loaded.set('web/' + file, crypto.createHash('sha256').update(text).digest('hex')); return text;
  }
  const dailySource = fs.readFileSync(path.join(web, 'scripts/lib-npc-daily-fixture.js'), 'utf8');
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', dailySource)(name => {
    assert.equal(name, './lib-npc-action-fixture'); return { fixture: () => fixture({ source }) };
  }, mod, mod.exports);
  const c = mod.exports.dailyFixture();
  identities[version] = Array.from(loaded, ([file, sha256]) => ({ file, sha256 })).sort((a, b) => a.file.localeCompare(b.file));
  return c;
}
const smoke = fs.readFileSync(path.join(web, 'scripts/smoke-npc-meeting-office.js'), 'utf8');
const worldSource = smoke.slice(smoke.indexOf('function world(options'), smoke.indexOf('\nlet passed'));
assert(worldSource.startsWith('function world'));
function createWorld(version, options) {
  return new Function('assert', 'dailyFixture', worldSource + '\nreturn world;')(assert, () => dailyFor(version))(options);
}
function receipt(c, p) {
  const m = p.localActivity.meeting, actor = c.TM.NPC.DailyActivities.person('a');
  return { scenarioDay: c.TM.SimTime.now(c.GM), planId: p.id, actorId: p.actorId, targetId: p.targetId,
    journeyStatus: m.actorJourneyStatus, journey: m.actorJourney ? { id: m.actorJourney.id, status: m.actorJourney.status, fromRegionId: m.actorJourney.fromRegionId, toRegionId: m.actorJourney.toRegionId, departureDay: m.actorJourney.departureDay } : null,
    actorTravel: { to: actor._travelTo || null, reference: actor._localTravelRef || null, exactLocation: c.TM.NPC.DailyActivities.exactLocation(actor), regionId: actor.regionId },
    messages: p.messages.map(x => ({ id: x.id, kind: x.kind, fromId: x.fromId, toId: x.toId, status: x.status })),
    officeMessages: c.GM._npcPlans.filter(x => x.officeTenure).flatMap(x => x.messages.map(m => ({ id: m.id, kind: m.kind, status: m.status, toId: m.toId }))), modelAttempts: c.apiAttempts.length };
}
function run(version) {
  const unseen = createWorld(version), leave = unseen.request(); unseen.advance(); unseen.approve(leave);
  const unseenResult = receipt(unseen, unseen.invite({ actorOfficeConstraint: { positionId: 'seat-0', requiresLeave: false } }));
  assert(unseenResult.officeMessages.some(m => m.kind === 'leave_response' && m.status === 'in_transit'), 'actual approval exists but applicant has not received it');
  const field = createWorld(version, { mode: 'field' }); field.a._officeFieldDuty = true;
  const fieldResult = receipt(field, field.invite());
  const valid = createWorld(version); valid.permit(); const validResult = receipt(valid, valid.invite());
  assert.equal(validResult.journey && validResult.journey.status, 'in_transit', 'real received permission remains a legal positive');
  return { undeliveredApproval: unseenResult, fieldMarkerOnly: fieldResult, receivedValidPermission: validResult };
}
const before = run(baseline), after = run('current');
assert.equal(before.undeliveredApproval.journey.status, 'in_transit', 'historical code actually departed, not merely missing a new helper');
assert.equal(before.fieldMarkerOnly.journey.status, 'in_transit', 'historical field marker actually departed without a private arrangement');
for (const row of [before.undeliveredApproval, before.fieldMarkerOnly]) {
  assert.equal(row.actorTravel.to, '西城'); assert.equal(row.actorTravel.exactLocation, null, 'the actual person is now travelling, not merely an invitation state');
}
assert.equal(after.undeliveredApproval.journey, null); assert.equal(after.undeliveredApproval.journeyStatus, 'meeting_office_leave_not_received');
assert.equal(after.fieldMarkerOnly.journey, null); assert.equal(after.fieldMarkerOnly.journeyStatus, 'meeting_office_leave_required');
for (const group of [before, after]) for (const row of Object.values(group)) assert.equal(row.modelAttempts, 0);
const evidence = { baseline, currentHead: cp.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  scope: 'Production-module action regression with controlled fixture dates; not browser or formal save acceptance.',
  baselineClarification: 'The e6d5 merge already includes PR105 multi-appointment inference and non-weakening explicit hints. Those earlier static issues are not claimed as newly reproduced here.',
  fixtures: 'Four named synthetic people; a three-node real-route fixture; one configured resident or field post. Request, approve, delivery, invitation and independent acceptance use production actions. No journey or receipt is injected.',
  before, after, runtimeFiles: identities };
fs.writeFileSync(path.join(__dirname, 'm1-baseline-reproduction.json'), JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify({ baseline, result: 'PASS', actualHistoricalFailures: 2, legalPositiveInBoth: true,
  before: { undeliveredApproval: before.undeliveredApproval.journey.status, fieldMarkerOnly: before.fieldMarkerOnly.journey.status },
  after: { undeliveredApproval: after.undeliveredApproval.journeyStatus, fieldMarkerOnly: after.fieldMarkerOnly.journeyStatus }, modelAttempts: 0 }));
