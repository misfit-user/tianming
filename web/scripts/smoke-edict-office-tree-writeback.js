#!/usr/bin/env node
'use strict';
// Actual production office_changes block + actual local edict parser, not a mirrored writer.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const ROOT = path.resolve(__dirname, '..');
const applySource = fs.readFileSync(path.join(ROOT, 'tm-endturn-apply.js'), 'utf8');
const start = applySource.indexOf('// 官制活化 Slice④ 改制裁定 pass');
const end = applySource.indexOf('// ── 官制树确定性任命', start);
assert(start >= 0 && end > start, 'actual office writeback slice exists');
let pass = 0, fail = 0;
function test(name, fn) { try { fn(); pass++; console.log('PASS ' + name); } catch (e) { fail++; console.error('FAIL ' + name + '\n' + e.stack); } }
function context() {
  const c = { console, Date, JSON, Math, setTimeout() {}, clearTimeout() {}, P: { conf: {} },
    GM: { turn: 4, sid: 'office-fixture', month: 2, officeTree: [{ id: 'finance', name: '财政部', positions: [], subs: [] }], chars: [], facs: [],
      guoku: { money: 1000000, balance: 1000000 }, huangquan: { index: 60 }, huangwei: { index: 60 },
      dynamicInstitutions: [], customOffices: [], _pendingMemorials: [], _pendingClarifications: [] },
    events: [], addEB(category, text) { c.events.push({ category, text }); }, toast() {}, _dbg() {}, callAI: async () => null,
    _tmBuildOfficeMoveExitMap() { return {}; }, _tmApplyLoyaltyDelta() {}, findCharByName(name) { return c.GM.chars.find(ch => ch.name === name); }
  };
  c.window = c; c.globalThis = c; vm.createContext(c);
  for (const name of ['tm-office-runtime.js', 'tm-office-runtime-summary-appoint.js', 'tm-office-system.js', 'tm-office-flags.js', 'tm-office-creation.js', 'tm-office-reform.js', 'tm-fiscal-engine.js', 'tm-edict-parser.js']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, name), 'utf8'), c, { filename: name });
  }
  vm.runInContext('function applyOfficePayload(p1){' + applySource.slice(start, end) + '\n}', c, { filename: 'actual-office-writeback-slice.js' });
  return c;
}
function nodes(c, name) { const out = []; (function walk(list) { for (const n of list || []) { if (n.name === name) out.push(n); walk(n.subs); } })(c.GM.officeTree); return out; }
function apply(c, rows) { c.applyOfficePayload({ office_changes: rows }); }

test('ordinary AI writeback creates a top-level department without a fictitious position', () => {
  const c = context(); apply(c, [{ action: 'reform', reformDetail: '增设', dept: '文书署', reason: '掌诏令档案' }]);
  assert.equal(nodes(c, '文书署').length, 1);
});
test('ordinary AI writeback creates a nested department and preserves its parent', () => {
  const c = context(); apply(c, [{ action: 'reform', reformDetail: '增设', dept: '财政部', newDept: '度支司' }]);
  assert.equal(nodes(c, '财政部')[0].subs[0].name, '度支司');
});
test('new department and explicit posts are created before their appointment payload', () => {
  const c = context(); c.GM.chars.push({ id: 'clerk', name: '张谨', alive: true, faction: '本国' });
  apply(c, [{ action: 'reform', reformDetail: '设立', dept: '文书署', positions: [{ name: '校书郎', rank: '正六品', count: 2 }] },
    { action: 'appoint', dept: '文书署', position: '校书郎', person: '张谨' }]);
  const department = nodes(c, '文书署')[0]; assert(department); assert.equal(department.positions[0].establishedCount, 2);
  assert.equal(department.positions[0].holder, '张谨'); assert.equal(c.GM.chars[0].officialTitle, '校书郎');
});
test('creation preserves explicit establishment and is idempotent across repeated payloads', () => {
  const c = context(), row = { action: 'reform', reformDetail: '增设', dept: '财政部', position: '审计官', newRank: '正六品', establishedCount: 3 };
  apply(c, [row, row]); apply(c, [row]);
  const positions = nodes(c, '财政部')[0].positions; assert.equal(positions.length, 1); assert.equal(positions[0].establishedCount, 3);
});
test('missing parent never produces a false successful reform event', () => {
  const c = context(); apply(c, [{ action: 'reform', reformDetail: '增设', dept: '不存在部', position: '校书郎' }]);
  assert.equal(nodes(c, '不存在部').length, 0);
  assert(!c.events.some(e => e.category === '官制改革' && /增设校书郎/.test(e.text)));
  assert(c.events.some(e => /未找到|未执行|未落地|未施行/.test(e.text)));
});
test('ambiguous same-named parents cannot create the position in both branches', () => {
  const c = context(); c.GM.officeTree.push({ name: '其他部', positions: [], subs: [{ name: '财政部', positions: [], subs: [] }] });
  const before = JSON.stringify(c.GM.officeTree);
  apply(c, [{ action: 'reform', reformDetail: '增设', dept: '财政部', position: '审计官' }]);
  assert.equal(JSON.stringify(c.GM.officeTree), before);
});
test('local direct edict uses the true tree and parses the whole creation verb', () => {
  const c = context(), r = c.EdictParser.tryExecute('诏令：设立文书司，正五品，掌诏令档案。', {}, {});
  assert(r && r.ok); assert.equal(nodes(c, '文书司').length, 1); assert.equal(nodes(c, '立文书司').length, 0);
});
test('explicit office creation is not misclassified as the policy mentioned in its duties', () => {
  const c = context(), r = c.EdictParser.tryExecute('设立水利司，正五品，掌河道水利。', {}, {});
  assert(r && r.classification && r.classification.typeKey === 'office_reform'); assert.equal(nodes(c, '水利司').length, 1);
});
test('direct edict creates a named post under an existing department with stated headcount', () => {
  const c = context(), r = c.EdictParser.tryExecute('在财政部增设审计官二人，正六品，掌账簿稽核。', {}, {});
  assert(r && r.ok); const p = nodes(c, '财政部')[0].positions.find(p => p.name === '审计官'); assert(p); assert.equal(p.establishedCount, 2);
});
test('adjudication mode stays pending then applies the complete named structure after approval', () => {
  const c = context(); c.P.conf.officeReformAdjudicationEnabled = true;
  apply(c, [{ action: 'reform', reformDetail: '增设', dept: '文书署', positions: [{ name: '校书郎', rank: '正六品', count: 2 }] }]);
  assert.equal(nodes(c, '文书署').length, 0); assert.equal(c.GM._pendingReforms.length, 1);
  c.GM.turn++; const result = c.adjudicatePendingReforms(c.GM, { authority: 100 }); assert(result[0].applied);
  assert.equal(nodes(c, '文书署')[0].positions[0].name, '校书郎'); assert.equal(nodes(c, '文书署')[0].positions[0].establishedCount, 2);
});
test('creating structure never modifies the source project template or invents an incumbent', () => {
  const c = context(); c.P.officeTree = JSON.parse(JSON.stringify(c.GM.officeTree)); const before = JSON.stringify(c.P);
  apply(c, [{ action: 'reform', reformDetail: '增设', dept: '财政部', position: '审计官' }]); c._offSyncHoldersFromChars({ force: true });
  assert.equal(JSON.stringify(c.P), before); assert.equal(nodes(c, '财政部')[0].positions[0].holder, '');
});
test('repeated direct edicts neither duplicate the department nor charge its establishment twice', () => {
  const c = context(), text = '设立文书司，正五品，掌诏令档案。';
  const first = c.EdictParser.tryExecute(text, {}, {}); assert(first.ok); const balance = c.GM.guoku.balance;
  assert(c.EdictParser.tryExecute(text, {}, {}).ok); assert.equal(nodes(c, '文书司').length, 1); assert.equal(c.GM.guoku.balance, balance);
  assert.equal(c.GM.dynamicInstitutions.length, 1);
});
test('negated proposal does not create structure, a shallow institution, or a financial charge', () => {
  const c = context(), before = JSON.stringify(c.GM);
  const r = c.EdictParser.tryExecute('暂不设立文书司，先行讨论其必要性。', {}, {});
  assert.equal(r.ok, false); assert.equal(JSON.stringify(c.GM), before);
});
test('invalid establishment is rejected atomically before creating the department or any other post', () => {
  const c = context(), before = JSON.stringify(c.GM.officeTree);
  apply(c, [{ action: 'reform', reformDetail: '增设', dept: '文书署', positions: [{ name: '校书郎', count: 1 }, { name: '审计官', count: -1 }] }]);
  assert.equal(JSON.stringify(c.GM.officeTree), before);
});
test('department with posts in the same edict preserves each post grade and Chinese headcount', () => {
  const c = context(), r = c.EdictParser.tryExecute('设立文书司，正五品，设校书郎二人，正六品。', {}, {});
  assert(r.ok); const p = nodes(c, '文书司')[0].positions[0]; assert.equal(p.name, '校书郎'); assert.equal(p.establishedCount, 2); assert.equal(p.rank, '正六品');
});
test('approved memorial uses the same real writer and is safe to approve again', () => {
  const c = context(); c.GM._pendingMemorials.push({ id: 'memo1', typeKey: 'office_reform', typeName: '官制设立', status: 'pending_draft',
    originalEdictText: '设立文书司', draftParams: { officeName: '文书司', rank: 5, duties: '掌档案', positions: [{ name: '校书郎', rank: '正六品', count: 2 }] } });
  assert(c.EdictParser.processImperialAssent('memo1', 'approve', {}).ok);
  assert.equal(nodes(c, '文书司')[0].positions.length, 1); const balance = c.GM.guoku.balance;
  assert(c.EdictParser.processImperialAssent('memo1', 'approve', {}).ok); assert.equal(c.GM.guoku.balance, balance); assert.equal(c.GM.dynamicInstitutions.length, 1);
});
test('actual generated AI institution bridge creates only the requested nested department and charges once', () => {
  const c = context(); Object.assign(c.GM, { _turnReport: [], parties: [], classes: [], armies: [], items: [], regions: [] });
  c.escHtml = String; c.getTSText = turn => 'T' + turn;
  for (const file of ['tm-ai-change-pathutils.js', 'tm-ai-change-army.js', 'tm-ai-change-narrative.js', 'generated/tm-ai-change-applier.bundle.js']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), c, { filename: file });
  }
  const input = { institution_changes: [{ action: 'create', name: '度支司', subordinateTo: '财政部', positions: [{ name: '郎中', count: 2, rank: '正六品' }] }] };
  const first = c.AIChangeApplier.applyAITurnChanges(input); assert(first && first.ok && first.applied, JSON.stringify(first)); assert.equal(first.applied.failed.length, 0);
  assert.equal(nodes(c, '财政部')[0].subs[0].name, '度支司'); assert.equal(c.GM.officeTree.length, 1);
  assert.equal(nodes(c, '度支司')[0].positions[0].establishedCount, 2); const balance = c.GM.guoku.balance;
  c.AIChangeApplier.applyAITurnChanges(input); assert.equal(nodes(c, '度支司').length, 1); assert.equal(c.GM.guoku.balance, balance);
});
test('approved duplicate or invalid creation does not spend setup cost or falsely report enacted', () => {
  const c = context(), charter = { name: '文书司', desc: '', setupCost: 100, positions: [{ name: '校书郎', rank: '正六品', count: 1, salary: 10 }], heads: [] };
  c.GM._pendingReforms = [{ reformDetail: '增设', dept: '文书司', status: '拟制中', proposedTurn: 2, _charter: charter }];
  assert(c.adjudicatePendingReforms(c.GM, { authority: 100 })[0].applied); const balance = c.GM.guoku.balance, authority = c.GM.huangwei.index;
  c.GM._pendingReforms.push({ reformDetail: '增设', dept: '文书司', status: '拟制中', proposedTurn: 2, _charter: charter });
  const again = c.adjudicatePendingReforms(c.GM, { authority: 100 }); assert(again[0].unchanged); assert.equal(c.GM.guoku.balance, balance); assert.equal(c.GM.huangwei.index, authority);
});
test('abolishing a created department removes its exact stable ID without deleting a namesake', () => {
  const c = context(); assert(c.EdictParser.tryExecute('设立文书司，正五品，掌档案。', {}, {}).ok);
  const inst = c.GM.dynamicInstitutions[0]; c.GM.officeTree[0].subs.push({ id: 'other-namesake', name: '文书司', positions: [], subs: [] });
  assert(c.EdictParser.abolishInstitution(inst.id)); assert.equal(nodes(c, '文书司').length, 1); assert.equal(nodes(c, '文书司')[0].id, 'other-namesake');
  assert(c.EdictParser.abolishInstitution(inst.id)); assert.equal(nodes(c, '文书司').length, 1);
});
test('later sentence in the same edict can add a post to the newly created department', () => {
  const c = context(), r = c.EdictParser.tryExecute('设立文书司，掌档案；在文书司增设校书郎二人，正六品。', {}, {});
  assert(r.ok); const p = nodes(c, '文书司')[0].positions[0]; assert.equal(p.name, '校书郎'); assert.equal(p.establishedCount, 2);
});
test('same-named departments retain separate stable institution links and lifecycle', () => {
  const c = context(); c.GM.officeTree.push({ id: 'works', name: '工部', subs: [], positions: [] });
  assert(c.EdictParser.tryExecute('财政部下设簿籍司，掌档案。', {}, {}).ok);
  assert(c.EdictParser.tryExecute('工部下设簿籍司，掌工料。', {}, {}).ok);
  assert.equal(nodes(c, '簿籍司').length, 2); assert.equal(c.GM.dynamicInstitutions.length, 2);
  assert.notEqual(c.GM.dynamicInstitutions[0]._officeTreeNodeId, c.GM.dynamicInstitutions[1]._officeTreeNodeId);
  assert(c.EdictParser.abolishInstitution(c.GM.dynamicInstitutions[1].id));
  assert.equal(nodes(c, '财政部')[0].subs[0].name, '簿籍司'); assert.equal(nodes(c, '工部')[0].subs.length, 0);
});
test('pending creation queue retains different posts while deduplicating exact replay', () => {
  const c = context(); c.P.conf.officeReformAdjudicationEnabled = true;
  const first = { action: 'reform', reformDetail: '增设', dept: '文书司', positions: [{ name: '校书郎', rank: '正六品', count: 1 }] };
  const second = { ...first, positions: [{ name: '校书郎', rank: '正六品', count: 1 }, { name: '主事', rank: '正七品', count: 1 }] };
  apply(c, [first, first, second]); assert.equal(c.GM._pendingReforms.length, 2);
  c.GM.turn++; c.adjudicatePendingReforms(c.GM, { authority: 100 }); assert.equal(nodes(c, '文书司')[0].positions.length, 2);
});
test('approved creation locates the requested parent ID despite duplicate names elsewhere', () => {
  const c = context(); c.GM.officeTree.push({ id: 'other-finance', name: '财政部', subs: [], positions: [] });
  c.GM._pendingMemorials.push({ id: 'same-name-parent', typeKey: 'office_reform', status: 'pending_draft', draftParams:
    { officeName: '税核司', subordinateTo: '财政部', deptId: 'other-finance', duties: '掌税', rank: 5 } });
  const result = c.EdictParser.processImperialAssent('same-name-parent', 'approve', {});
  assert(result.ok); assert.equal(c.GM.officeTree[0].subs.length, 0); assert.equal(c.GM.officeTree[1].subs[0].name, '税核司');
});
test('irrelevant null office row does not prevent subsequent valid creation', () => {
  const c = context(); apply(c, [null, { action: 'reform', reformDetail: '增设', dept: '文书司' }]); assert.equal(nodes(c, '文书司').length, 1);
});
console.log(`${pass} PASS / ${fail} FAIL`); process.exitCode = fail ? 1 : 0;
