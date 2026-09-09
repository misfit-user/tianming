#!/usr/bin/env node
'use strict';
// Actual production factories, real fiscal/minxin ledgers; no player data/network.
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert/strict');
const root = path.resolve(__dirname, '..');
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS ' + name); }
function context() {
  const region = { id: 'r1', name: '河东', minxin: 50, population: 10000 };
  const G = { turn: 1, _campaignId: 'campaign-a', _timelineId: 'timeline-a',
    guoku: { money: 100000, balance: 100000 }, neitang: { money: 30000, balance: 30000 },
    regions: [region], adminHierarchy: { realm: { divisions: [region] } },
    fiscal: { regions: { r1: { ledgers: { money: 20000 }, ledgerAudit: {} } } },
    chars: [{ id: 'c1', name: '王明', ability: 80 }, { id: 'c2', name: '王明', ability: 40 }],
    currentIssues: [], _edictTracker: [], minxin: { trueIndex: 50, perceivedIndex: 50 },
    classes: [], facs: [], transferOrders: [] };
  const c = { console, structuredClone, setTimeout, clearTimeout, GM: G,
    P: { conf: {}, time: { daysPerTurn: 30 }, ai: { key: 'isolated-test-key' } },
    TM: { errors: { capture() {} } }, _tmLoadGen: 1 };
  c.window = c; c.globalThis = c;
  vm.createContext(c);
  for (const file of ['tm-fiscal-engine.js', 'tm-minxin-ledger.js', 'tm-relief-governance.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), c, { filename: file });
  }
  return c;
}
function fresh() { const c = context(); assert.equal(c.TM.ReliefGovernance.setEnabled(c.GM, true).ok, true); return c; }
function create(c, extra = {}) {
  const r = c.TM.ReliefGovernance.create(c.GM, Object.assign({ text: '拨银赈济河东灾民，责成承办人核清发放。',
    regionId: 'r1', assigneeId: 'c1', amount: 20000, source: 'guoku', deadlineDays: 60, requestId: 'draft-1' }, extra));
  assert.equal(r.ok, true, JSON.stringify(r)); return r.issueId;
}
function view(c, id) { return c.TM.ReliefGovernance.view(c.GM, id); }
function act(c, id, action, extra = {}) {
  return c.TM.ReliefGovernance.act(c.GM, id, Object.assign({ action, requestId: action + '-' + view(c,id).revision,
    expectedRevision: view(c,id).revision }, extra));
}
function assess(c, id, extra = {}) {
  const snapshot = c.TM.ReliefGovernance.capture(c.GM, id);
  return c.TM.ReliefGovernance.applyAssessment(c.GM, snapshot, Object.assign({ action: 'wait', reason: '承办人正在核清灾户。',
    officialReport: '已收令，正在核办。', nextAdvice: '下回合核对发放记录。', amount: 0, minxinDelta: 0 }, extra));
}
function tick(c, days = 30) { c.GM.turn++; return c.TM.ReliefGovernance.tick(c.GM, { days, turn: c.GM.turn }); }
function stock(c, account) {
  const a = c.GM[account]; assert.equal(a.balance, a.money); assert.equal(a.money, a.ledgers.money.stock); return a.money;
}
module.exports = { context, fresh, create, view, act, assess, tick, stock };
if (require.main === module) {
test('disabled old world is read-only', () => {
  const c = context(), before = JSON.stringify(c.GM);
  assert.equal(c.TM.ReliefGovernance.enabled(c.GM), false);
  assert.equal(c.TM.ReliefGovernance.create(c.GM, {}).ok, false);
  c.TM.ReliefGovernance.tick(c.GM, { days: 30, turn: 2 });
  assert.equal(JSON.stringify(c.GM), before);
});
test('create attaches one issue and one edict without spending; duplicate intent reuses it', () => {
  const c=fresh(), id=create(c); assert.equal(create(c), id);
  assert.equal(c.GM.currentIssues.length,1); assert.equal(c.GM._edictTracker.length,1);
  assert.equal(c.GM.guoku.money,100000); assert.equal(view(c,id).assigneeId,'c1');
  assert.equal(view(c,id).status,'awaiting_funding');
});
test('strict IDs, duplicate names, invalid amounts and missing region never guess', () => {
  const c=fresh();
  for(const spec of [{regionId:'河东'},{assigneeId:'王明'},{amount:NaN},{amount:-1},{deadlineDays:0}]) {
    const r=c.TM.ReliefGovernance.create(c.GM,Object.assign({text:'赈济灾民',regionId:'r1',assigneeId:'c1',amount:100,source:'guoku',deadlineDays:30,requestId:'bad'},spec));
    assert.equal(r.ok,false,JSON.stringify(spec));
  }
  assert.equal(c.GM.currentIssues.length,0);
});
test('funding has a single canonical receipt and does not repeat on same request', () => {
  const c=fresh(),id=create(c), revision=view(c,id).revision;
  const spec={action:'fund',requestId:'pay-once',expectedRevision:revision,amount:20000};
  assert.equal(c.TM.ReliefGovernance.act(c.GM,id,spec).ok,true);
  assert.equal(c.TM.ReliefGovernance.act(c.GM,id,spec).ok,true);
  assert.equal(stock(c,'guoku'),80000); assert.equal(c.GM.transferOrders.length,1);
  assert.equal(view(c,id).funded,20000); assert.equal(view(c,id).disbursed,0);
});
test('insufficient full funding preserves money and issue bytes; explicit partial is limited', () => {
  const c=fresh(),id=create(c,{source:'neitang',amount:40000}); const before=JSON.stringify(c.GM);
  assert.equal(act(c,id,'fund',{amount:40000}).ok,false); assert.equal(JSON.stringify(c.GM),before);
  assert.equal(act(c,id,'fund',{amount:40000,allowPartial:true}).ok,true);
  assert.equal(stock(c,'neitang'),0); assert.equal(view(c,id).funded,30000);
});
test('local self-funding uses actual regional balance and canonical audit', () => {
  const c=fresh(),id=create(c,{source:'local'}); assert.equal(act(c,id,'fund',{amount:20000}).ok,true);
  assert.equal(c.GM.fiscal.regions.r1.ledgers.money,0); assert.equal(c.GM.guoku.money,100000);
  assert.equal(c.GM.fiscal.regions.r1.ledgerAudit.money.thisTurnOut,20000);
});
test('metadata publication failure cannot leave a debit', () => {
  const c=fresh(),id=create(c),before=JSON.stringify(c.GM);
  Object.defineProperty(c.GM,'transferOrders',{value:c.GM.transferOrders,writable:false,configurable:true,enumerable:true});
  assert.equal(act(c,id,'fund',{amount:20000}).ok,false); assert.equal(JSON.stringify(c.GM),before);
});
test('tick tracks actual days once and never guesses completion', () => {
  const c=fresh(),id=create(c); act(c,id,'fund',{amount:20000}); tick(c,7);
  c.TM.ReliefGovernance.tick(c.GM,{days:7,turn:c.GM.turn});
  assert.equal(view(c,id).elapsedDays,7); assert.equal(view(c,id).disbursed,0);
  tick(c,90); assert.equal(view(c,id).elapsedDays,97); assert.equal(view(c,id).overdue,true);
});
test('AI cannot spend unapproved money, pay twice in a turn or reward unfunded relief', () => {
  const c=fresh(),id=create(c); tick(c);
  assert.equal(assess(c,id,{action:'complete',amount:20000,minxinDelta:3}).ok,false);
  act(c,id,'fund',{amount:20000});
  assert.equal(assess(c,id,{action:'disburse',amount:20001}).ok,false);
  assert.equal(assess(c,id,{action:'disburse',amount:5000}).ok,true);
  assert.equal(assess(c,id,{action:'disburse',amount:5000}).ok,false);
  assert.equal(view(c,id).disbursed,5000);
});
test('same-world interventions stale old AI decisions; same-turn new world also rejects', () => {
  const c=fresh(),id=create(c),s=c.TM.ReliefGovernance.capture(c.GM,id);
  act(c,id,'reassign',{assigneeId:'c2'});
  assert.equal(c.TM.ReliefGovernance.applyAssessment(c.GM,s,{action:'wait',reason:'old'}).ok,false);
  const s2=c.TM.ReliefGovernance.capture(c.GM,id),old=c.GM; c.GM=structuredClone(old);
  assert.equal(c.TM.ReliefGovernance.applyAssessment(old,s2,{action:'wait',reason:'old world'}).ok,false);
  assert.equal(view(c,id).assigneeId,'c2');
});
test('cancellation refunds only undistributed balance and preserves terminal history', () => {
  const c=fresh(),id=create(c); act(c,id,'fund',{amount:20000}); tick(c);
  assert.equal(assess(c,id,{action:'disburse',amount:5000}).ok,true);
  assert.equal(act(c,id,'cancel').ok,true); assert.equal(stock(c,'guoku'),95000);
  assert.equal(view(c,id).refunded,15000); assert.equal(view(c,id).disbursed,5000);
  assert.equal(view(c,id).status,'cancelled'); assert.equal(c.GM.currentIssues[0].status,'resolved');
});
test('AI completion applies a real regional minxin signal once with traceable case ID', () => {
  const c=fresh(),id=create(c); act(c,id,'fund',{amount:20000}); tick(c);
  const r=assess(c,id,{action:'complete',amount:20000,minxinDelta:3,reason:'依拨付记录完成赈银发放，灾民得到援助。',consequence:'后续仍需关注灾地复耕。'});
  assert.equal(r.ok,true,JSON.stringify(r)); assert.equal(view(c,id).status,'completed');
  const rows=c.GM._minxinLedger.items.filter(x=>x.linkedIssue===id);
  assert.equal(rows.length,1); assert.equal(rows[0].applied,true);
  assert.equal(c.GM.adminHierarchy.realm.divisions[0].minxin,53);
  tick(c); assert.equal(assess(c,id,{action:'complete',minxinDelta:3}).ok,false);
  assert.equal(c.GM._minxinLedger.items.filter(x=>x.linkedIssue===id).length,1);
});
test('serialized case resumes without repaying and active case blocks disabling', () => {
  const c=fresh(),id=create(c); act(c,id,'fund',{amount:20000});
  assert.equal(c.TM.ReliefGovernance.setEnabled(c.GM,false).ok,false);
  c.GM=JSON.parse(JSON.stringify(c.GM)); tick(c);
  assert.equal(stock(c,'guoku'),80000); assert.equal(view(c,id).funded,20000);
  act(c,id,'cancel'); assert.equal(c.TM.ReliefGovernance.setEnabled(c.GM,false).ok,true);
});
test('cent-sized installments conserve the approved budget without floating-point rejection', () => {
  const c=fresh(),id=create(c,{amount:0.3});
  c.GM.guoku.money=0.3;c.GM.guoku.balance=0.3;
  assert.equal(act(c,id,'fund',{amount:0.1}).ok,true);
  assert.equal(act(c,id,'fund',{amount:0.2}).ok,true);
  assert.equal(c.GM.guoku.ledgers.money.deficit,undefined); // owner creates this field only on a real deficit
  assert.equal(Object.keys(c.GM.guoku.ledgers.money.sinks).some(k=>k.endsWith('_欠')),false);
  tick(c);assert.equal(assess(c,id,{action:'disburse',amount:0.1}).ok,true);
  tick(c);assert.equal(assess(c,id,{action:'complete',amount:0.2,minxinDelta:1}).ok,true);
  assert.equal(view(c,id).disbursed,0.3);assert.equal(view(c,id).remaining,0);
});
test('authored ID collision and ambiguous loaded case IDs never select the first record', () => {
  const c=fresh();c.GM.currentIssues.push({id:'relief-1-1',title:'作者原有事项',status:'pending'});
  const before=JSON.stringify(c.GM);
  const result=c.TM.ReliefGovernance.create(c.GM,{requestId:'collision',text:'赈济',regionId:'r1',assigneeId:'c1',source:'guoku',amount:100,deadlineDays:30});
  assert.equal(result.code,'relief-id-conflict');assert.equal(JSON.stringify(c.GM),before);
  const d=fresh(),id=create(d);d.GM.currentIssues.push(structuredClone(d.GM.currentIssues[0]));
  assert.equal(d.TM.ReliefGovernance.view(d.GM,id),null);
});
console.log('relief-governance: '+passed+' PASS / 0 FAIL');
}
