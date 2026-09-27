#!/usr/bin/env node
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const ROOT = path.resolve(__dirname, '..');
let passed = 0, failed = 0;
function test(name, body) { try { body(); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.error('FAIL ' + name + ': ' + e.message); } }
function context(extra) {
  const c = Object.assign({ console, P: { conf: {} }, GM: {}, fetch() { throw Error('Network forbidden'); } }, extra);
  c.window = c; c.global = c; c.globalThis = c; vm.createContext(c); return c;
}
function load(c, name) { vm.runInContext(fs.readFileSync(path.join(ROOT, name), 'utf8'), c, { filename: name }); }
test('reported missing values stay missing, not fabricated zero', () => {
  const c = context({ P: { conf: { gameMode: 'strict_hist', reportedViewEnabled: true } }, GM: { turn: 2, corruption: { trueIndex: 80 } } });
  load(c, 'tm-reported-view.js'); const before = JSON.stringify(c.GM);
  for (const missing of [null, undefined, '', '待核']) {
    const r = c.TM.ReportedView.value('fiscal', 'income', missing, { direction: 'good' });
    assert.strictEqual(r.shown, missing); assert.strictEqual(r.distorted, false);
  }
  assert.strictEqual(JSON.stringify(c.GM), before);
});
test('reported negative treasury paints a smaller deficit without changing the ledger', () => {
  const c = context({ P: { conf: { gameMode: 'strict_hist', reportedViewEnabled: true } }, GM: { sid: 'reported-negative', turn: 2, guoku: { money: -100 }, corruption: { trueIndex: 80 } } });
  load(c, 'tm-reported-view.js'); const before = JSON.stringify(c.GM);
  const r = c.TM.ReportedView.value('fiscal', 'guoku.money', -100, { direction: 'good' });
  assert(r.shown > -100 && r.shown <= -65 && r.distorted);
  assert(c.TM.ReportedView.badge(r).includes('据奏'));
  assert.strictEqual(JSON.stringify(c.GM), before);
});
function scandal(corruption) {
  const c = context({
    P: { conf: { useNewKejuScandal: true }, keju: { currentExam: { id: 'exam-1', stage: 'marking', chiefExaminerId: 'chief-1', chiefExaminer: '主考甲', examinerView: { factionBias: 0.8 } } } },
    GM: { turn: 8, year: 840, corruption, keju: {}, chars: [{ id: 'chief-1', name: '主考甲', alive: true }], vars: { 吏治: { value: 90 } } }
  }); load(c, 'tm-keju-scandal.js'); return c;
}
test('exam scandal uses canonical corruption, including valid zero', () => {
  const c = scandal({ trueIndex: 80 }); delete c.GM.vars.吏治;
  assert.strictEqual(c._kjCheckScandalTriggers(), 1);
  assert.strictEqual(c.GM.keju._scandal.spawned[0].detail.corruption, 80);
  assert.strictEqual(c._kjCheckScandalTriggers(), 0, 'same exam cannot spawn twice');
  const zero = scandal({ trueIndex: 0 });
  assert.strictEqual(zero._kjCheckScandalTriggers(), 0, 'zero canonical corruption must not fall back to stale scalar');
});
test('agency does not lose a report when the agenda collection is not ready', () => {
  const c = context({ P: { conf: { agencyWatchEnabled: true } } }); load(c, 'tm-conspiracy.js');
  const g = { turn: 4, _activePlots: [{ id: 'plot-1', ringleader: '某甲', conspirators: [], exposure: 60, momentum: 40, _knownToPlayer: true }], corruption: { supervision: { institutions: [{ independence: 5, radius: 100, corruption: 0, vacancies: 0 }] } } };
  c.ConspiracyEngine._agencyWatch(g);
  assert(!g._activePlots[0]._agencyReported, 'missing agenda cannot count as delivered');
  g.currentIssues = []; c.ConspiracyEngine._agencyWatch(g);
  assert.strictEqual(g.currentIssues.length, 1);
  c.ConspiracyEngine._agencyWatch(g); assert.strictEqual(g.currentIssues.length, 1, 'successful report is deduplicated');
});
console.log('[smoke-gameplay-default-audit] ' + passed + ' PASS / ' + failed + ' FAIL');
process.exitCode = failed ? 1 : 0;
