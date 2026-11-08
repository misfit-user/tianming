'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const helperFile = path.join(__dirname, 'reproduce-m1-baseline.cjs'), source = fs.readFileSync(helperFile, 'utf8');
const h = new Function('require', '__dirname', source.slice(0, source.indexOf('const before = run')) + '\nreturn {createWorld,receipt,identities};')(createRequire(helperFile), __dirname);
const baseline = '91f76d2495f005d46597050d1a7c9180cbca7aab';
const cases = [];
for (const fault of ['missing-post', 'nonexistent-organization', 'duplicate-organization']) {
  const results = [];
  for (const version of [baseline, 'current']) {
    const c = h.createWorld(version), post = c.GM.officeTree[0].positions[1];
    let permission = null;
    if (fault === 'missing-post') delete post.id;
    else {
      post.officeTenure.leave.requiresApproval = false;
      const org = fault === 'nonexistent-organization' ? 'missing-explicit-org' : 'court';
      c.GM.officeTree[0].authorityFactionId = org;
      if (fault === 'duplicate-organization') c.GM.facs.push({ id: 'court', name: '另一组织误用同一ID' });
      assert.equal(c.TM.PoliticalActions.resolve('organization', { id: org }, c.GM), null);
      permission = c.office('requestLeave', c.a, { organizationId: org, positionId: 'seat-0', destinationId: 'west', startDay: 0, latestReturnDay: 20, kind: 'private' }).outcome;
      assert.equal(permission, 'started', 'a standing-rule record is not proof that the referenced organization exists');
    }
    const read = c.TM.OfficeTenure.privateTravelDuties(c.GM, c.a), result = h.receipt(c, c.invite());
    results.push({ version, permission, read, result });
  }
  assert.equal(results[0].result.journey.status, 'in_transit');
  assert.equal(results[0].result.actorTravel.to, '西城');
  assert.equal(results[1].read.status, 'unknown');
  assert.equal(results[1].result.journey, null);
  assert.equal(results[1].result.journeyStatus, 'meeting_office_assignment_identity_unknown');
  cases.push({ fault, results });
}
const legal = h.createWorld('current'); legal.GM.officeTree[0].positions[1].officeTenure.leave.requiresApproval = false;
assert.equal(legal.office('requestLeave', legal.a, { positionId: 'seat-0', destinationId: 'west', startDay: 0, latestReturnDay: 20, kind: 'private' }).outcome, 'started');
const positive = h.receipt(legal, legal.invite()); assert.equal(positive.journey.status, 'in_transit');
const evidence = { baseline, scope: 'isolated production VM; real invitation, independent response and standing-rule request; no UI/full-save claim', cases, legalPositive: positive, runtimeFiles: h.identities };
fs.writeFileSync(path.join(__dirname, 'm1-missing-identity-reproduction.json'), JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify({ status: 'PASS', cases: cases.map(c => ({ fault: c.fault, before: c.results[0].result.journeyStatus, after: c.results[1].result.journeyStatus })), legalPositive: positive.journey.status, modelAttempts: 0 }));
