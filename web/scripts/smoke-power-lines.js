'use strict';
// smoke-power-lines.js — 职权按线列权能（总纲 3.2、3.15，11-23 同志定）：外交线谈判、署名、定夺
// 表本身；核权读它（只按新记法标的权，约照样能成，只握谈判的定不了约）；旧键照认；官职深编存一次，别的权一个不少。
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { politicalFixture } = require('./lib-political-action-fixture');

const ROOT = path.resolve(__dirname, '..');
let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.error('FAIL ' + name + ': ' + e.message); }
}
// 页面里（vm）造的数组原型属另一套，比之前先倒成本地的
const plain = (x) => JSON.parse(JSON.stringify(x));
function run(sb, file) { vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sb, { filename: file }); }
function table() {
  const sb = { console };
  sb.window = sb;
  vm.createContext(sb);
  run(sb, 'tm-power-lines.js');
  return sb.TM.PowerLines;
}

test('[1] 旧键照认：先前的「谈」算谈判，「签」算署名加定夺；按旧名问也认新记法', () => {
  const L = table();
  assert.deepEqual(plain(L.held({ diplomacy: true }, 'diplomacy')), ['negotiate']);
  assert.deepEqual(plain(L.held({ treatySign: true }, 'diplomacy')), ['sign', 'decide']);
  assert.deepEqual(plain(L.held({ diplomacy: true, treatySign: true }, 'diplomacy')), ['negotiate', 'sign', 'decide']);
  assert.equal(L.holds({ 'diplomacy.decide': true }, 'treatySign'), true, '按旧名问「签」，认新记的定夺');
  assert.equal(L.holds({ 'diplomacy.sign': true }, 'treatySign'), false, '只握署名不算能定约');
  assert.equal(L.holds({ 'diplomacy.negotiate': true }, 'diplomacy'), true);
  assert.equal(L.holds({ appointment: true }, 'appointment'), true, '还没并进线的旧键照原名问');
  assert.equal(L.holds({ treatySign: 'yes' }, 'diplomacy.decide'), false, '只认 true');
});

test('[2] 改一条线只动这条线；握的没变就原样不动', () => {
  const L = table();
  const same = { treatySign: true, judicial: true };
  L.write(same, 'diplomacy', ['decide', 'sign']);
  assert.deepEqual(same, { treatySign: true, judicial: true }, '与原来一样，旧键不改写');
  const p = { treatySign: true, judicial: true, works: false };
  L.write(p, 'diplomacy', ['negotiate', 'decide']);
  assert.deepEqual(p, { judicial: true, works: false, 'diplomacy.negotiate': true, 'diplomacy.decide': true },
    '旧键展开成新记法再改，去掉的署名不会被旧键算回来');
  L.write(p, 'diplomacy', []);
  assert.deepEqual(p, { judicial: true, works: false });
});

test('[3] 署名的级：写了照写的；没写的，握定夺算国书，其余算边书', () => {
  const L = table();
  assert.equal(L.signLevel({ powers: { 'diplomacy.decide': true } }), 'state');
  assert.equal(L.signLevel({ powers: { treatySign: true } }), 'state');
  assert.equal(L.signLevel({ powers: { 'diplomacy.sign': true } }), 'border');
  assert.equal(L.signLevel({ powers: { 'diplomacy.sign': true }, authorityScope: { signLevel: 'ministry' } }), 'ministry');
  assert.equal(L.signLevel({ powers: { 'diplomacy.decide': true }, authorityScope: { signLevel: '乱写' } }), 'state');
  assert.equal(L.label('diplomacy.decide'), '外交·定夺');
  assert.equal(L.label('appointment'), 'appointment');
});

// 两国的使臣都只按新记法标权：握谈判与定夺
function newKeys() {
  const c = politicalFixture();
  c.fa.officeTree[0].positions[0].powers = { appointment: true, treasurySpend: true, 'diplomacy.negotiate': true, 'diplomacy.decide': true };
  c.fb.officeTree[0].positions[0].powers = { appointment: true, treasurySpend: true, 'diplomacy.negotiate': true, 'diplomacy.decide': true };
  return c;
}

test('[4] 只按新记法标的权：甲国提案、送到乙国、乙国定夺，约成', () => {
  const c = newKeys(), D = c.TM.FactionDiplomacy, B = c.TM.PoliticalActions;
  const r = D.recordProposals(c.fa, [{ toFactionId: 'fb', type: 'alliance', terms: '共同防御' }], c.GM.turn,
    { binding: B.bind(c.fa, 'a', { actingPositionId: 'pa', sourceId: 'new-key-talks' }) });
  const p = D.get(r.results[0].proposalId);
  assert(p, JSON.stringify(r));
  assert.equal(p.status, 'in_transit', '甲使握谈判，提案正式发出，不是私人建议');
  assert.equal(p.decisions.length, 1, '甲使握定夺，发出时本方已准');
  D.advance();
  const reply = D.applyResponses(c.fb, [{ proposalId: p.id, proposalVersion: 1, decision: 'accept' }], c.GM.turn,
    { binding: B.bind(c.fb, 'b', { actingPositionId: 'pb', sourceId: 'new-key-sign' }) });
  assert.equal(reply.resolved, 1, JSON.stringify(reply));
  assert.equal(c.GM.treaties.length, 1);
  assert.equal(c.TreatySystem.hasTreaty('甲国', '乙国', 'alliance'), true);
});

test('[5] 只握谈判的能谈、定不了约；对方准了以后，草约送到本方握定夺的人', () => {
  const c = newKeys(), D = c.TM.FactionDiplomacy, B = c.TM.PoliticalActions;
  c.fa.officeTree[0].positions[0].powers = { 'diplomacy.negotiate': true };
  const z = c.actor('z', '甲国定夺者', { factionId: 'fa', faction: '甲国', officialTitle: '定夺官' });
  c.fa.officeTree[0].positions.push({ id: 'pz', name: '定夺官', holderId: z.id, powers: { 'diplomacy.decide': true } });
  const r = D.recordProposals(c.fa, [{ toFactionId: 'fb', type: 'alliance', terms: '约定共同防御' }], c.GM.turn,
    { binding: B.bind(c.fa, 'a', { actingPositionId: 'pa', sourceId: 'negotiate-only' }) });
  const p = D.get(r.results[0].proposalId);
  assert.equal(p.status, 'in_transit', '握谈判就能正式提案');
  assert.equal(p.decisions.length, 0, '没有定夺权，本方还没准');
  D.advance();
  let reply = D.applyResponses(c.fb, [{ proposalId: p.id, proposalVersion: 1, decision: 'accept' }], c.GM.turn,
    { binding: B.bind(c.fb, 'b', { actingPositionId: 'pb', sourceId: 'b-decides' }) });
  assert.equal(reply.resolved, 0);
  assert.equal(p.recipientId, 'z', '对方准了的草约送到本方握定夺的人');
  D.advance();
  reply = D.applyResponses(c.fa, [{ proposalId: p.id, proposalVersion: 1, decision: 'accept' }], c.GM.turn,
    { binding: B.bind(c.fa, 'a', { actingPositionId: 'pa', sourceId: 'a-overreach' }) });
  assert.equal(reply.results[0].reason, 'final_signature_authority_required', '谈判的人自己准不了');
  assert.equal(c.GM.treaties, undefined);
  reply = D.applyResponses(c.fa, [{ proposalId: p.id, proposalVersion: 1, decision: 'accept' }], c.GM.turn,
    { binding: B.bind(c.fa, 'z', { actingPositionId: 'pz', sourceId: 'z-decides' }) });
  assert.equal(reply.resolved, 1, JSON.stringify(reply));
  assert.equal(c.GM.treaties.length, 1);
});

test('[6] 按旧名问拿主意的人，认新记法；只握署名的不算能定约', () => {
  const c = newKeys(), B = c.TM.PoliticalActions;
  assert.deepEqual(plain(B.principals(c.fa, 'treatySign').map((x) => x.actor.id)), ['a']);
  assert.deepEqual(plain(B.principals(c.fa, 'diplomacy').map((x) => x.actor.id)), ['a']);
  c.fa.officeTree[0].positions[0].powers = { 'diplomacy.sign': true };
  assert.deepEqual(plain(B.principals(c.fa, 'treatySign').map((x) => x.actor.id)), []);
  assert.deepEqual(plain(B.principals(c.fa, 'diplomacy.sign').map((x) => x.actor.id)), ['a']);
});

test('[7] 旧档照认：只记旧键（谈、签）的职位照样提案、定约', () => {
  const c = politicalFixture(), D = c.TM.FactionDiplomacy, B = c.TM.PoliticalActions;
  const r = D.recordProposals(c.fa, [{ toFactionId: 'fb', type: 'alliance', terms: '共同防御' }], c.GM.turn,
    { binding: B.bind(c.fa, 'a', { actingPositionId: 'pa', sourceId: 'legacy-talks' }) });
  const p = D.get(r.results[0].proposalId);
  D.advance();
  const reply = D.applyResponses(c.fb, [{ proposalId: p.id, proposalVersion: 1, decision: 'accept' }], c.GM.turn,
    { binding: B.bind(c.fb, 'b', { actingPositionId: 'pb', sourceId: 'legacy-sign' }) });
  assert.equal(reply.resolved, 1, JSON.stringify(reply));
  assert.equal(c.GM.treaties.length, 1);
});

// 官职深编（editor-office-deep.js）跑在假页面里：它包住「编辑官职」弹窗，存时把深化表单并进职位
function deepEditor() {
  const timers = [], elements = {};
  let opened = null;
  const sb = { console };
  sb.window = sb;
  sb.setTimeout = (fn) => { timers.push(fn); return timers.length; };
  sb.document = { readyState: 'complete', getElementById: (id) => elements[id] || null, addEventListener() {} };
  sb.openGenericModal = function (title, body, onOk) { opened = { title, body, onOk }; return true; };
  vm.createContext(sb);
  run(sb, 'tm-power-lines.js');
  run(sb, 'editor-office-deep.js');
  const flush = () => { for (let i = 0; i < 20 && timers.length; i++) timers.splice(0).forEach((fn) => fn()); };
  flush();
  return { sb, elements, flush, opened: () => opened };
}

test('[8] 官职深编：旧记的「签」勾在署名、定夺上；存一次，别的权一个不少，外交按勾选写成新记法', () => {
  const ed = deepEditor();
  const pos = { name: '辽东经略', powers: { appointment: false, judicial: true, works: true, treatySign: true, treasurySpend: true } };
  ed.sb._pd_currentPos = pos;
  ed.sb._pd_mode = 'edit';
  let saved = 0;
  ed.sb.openGenericModal('编辑官职', '<div>官职表单</div>', function () { saved++; });
  const shown = ed.opened();
  assert(shown && shown.title === '编辑官职', '弹窗经深编包过');
  assert.match(shown.body, /id="pd_pwDipSign" checked/, '旧记的「签」勾在署名上');
  assert.match(shown.body, /id="pd_pwDipDecide" checked/, '旧记的「签」勾在定夺上');
  assert.doesNotMatch(shown.body, /id="pd_pwDipNegotiate" checked/, '没记「谈」，谈判不勾');
  Object.assign(ed.elements, {
    pd_pwAppoint: { checked: true }, pd_pwYin: { checked: false }, pd_pwImpeach: { checked: false },
    pd_pwSuperv: { checked: false }, pd_pwTax: { checked: false }, pd_pwMil: { checked: false },
    pd_pwDipNegotiate: { checked: true }, pd_pwDipSign: { checked: false }, pd_pwDipDecide: { checked: true }
  });
  shown.onOk();
  ed.flush();
  assert.equal(saved, 1, '原来的存盘照跑');
  assert.deepEqual(pos.powers, {
    appointment: true, yinBu: false, impeach: false, supervise: false, taxCollect: false, militaryCommand: false,
    judicial: true, works: true, treasurySpend: true, 'diplomacy.negotiate': true, 'diplomacy.decide': true
  });
});

if (failed) { console.log('FAIL smoke-power-lines: ' + failed + ' 项'); process.exit(1); }
console.log('PASS smoke-power-lines（' + passed + ' 项）');
