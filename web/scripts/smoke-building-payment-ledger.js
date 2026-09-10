'use strict';
// Execute the real fiscal/building modules; only inject payment boundary faults.
const assert = require('assert/strict'), fs = require('fs'), path = require('path'), vm = require('vm');
const web = path.resolve(__dirname, '..');
const refAt = process.argv.indexOf('--source-ref');
const read = file => refAt < 0 ? fs.readFileSync(path.join(web, file), 'utf8') :
  require('child_process').execFileSync('git', ['show', process.argv[refAt + 1] + ':web/' + file], { cwd: path.dirname(web), encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
const { functionSource } = require('./lib-perf-round1');
const card = functionSource(read('phase8-formal-map-dossier.js'), 'bkYeCard');
const sources = ['tm-fiscal-engine.js', 'tm-building-works.js', 'tm-custom-build-agent.js']
  .map(file => [file, read(file)]);
function fixture() {
  const div = { name: '测试府', buildings: [], fortLevel: 0, economyBase: { commerceVolume: 20000 }, publicTreasury: { money: { stock: 100000, available: 100000 } } };
  const P = { conf: {}, buildingSystem: { buildingTypes: [] }, adminHierarchy: { player: { divisions: [div] } } };
  const GM = { turn: 1, guoku: { balance: 10000, money: 10000, grain: 0, cloth: 0 } };
  const grants = [], c = { P, GM, TM: {}, console, Date, Math, Set, Map, WeakMap, addEB() {} };
  c.window = c; vm.createContext(c);
  sources.forEach(([file, source]) => vm.runInContext(source, c, { filename: file }));
  c.TM.RegionStatus = { add: (_div, value) => grants.push(value), remove() {} };
  return { c, div, grants, build(cost = 5000) { return c.TM.CustomBuildAgent.approveBuild('测试府', { feasibility: '合理', costActual: cost, timeActual: 1, effectsStructured: { abs: { fortLevel: 1 } } }, { name: '城墙' }, { P, GM }); } };
}
let pass = 0, fail = 0;
function test(name, fn) { try { fn(); pass++; console.log('PASS ' + name); } catch (e) { fail++; console.error('FAIL ' + name + ': ' + e.stack); } }
test('canonical payment and one completion remain functional', () => {
  const f = fixture(), r = f.build(); assert.equal(r.ok, true); assert.equal(r.spent.money, 5000);
  const g = f.c.GM.guoku; assert.equal(g.money, 5000); assert.equal(g.balance, g.money); assert.equal(g.ledgers.money.stock, g.money);
  assert.equal(f.div.buildings.length, 1); assert.equal(f.div.fortLevel, 0);
  f.c.TM.BuildingWorks.tick(f.c.GM, f.c.P); assert.equal(f.div.fortLevel, 1);
  f.c.TM.BuildingWorks.tick(f.c.GM, f.c.P); assert.equal(f.div.fortLevel, 1);
});
for (const [name, inject] of [
  ['throw', f => { f.c.FiscalEngine.spendFromGuoku = () => { throw Error('injected-payment'); }; }],
  ['explicit rejection', f => { f.c.FiscalEngine.spendFromGuoku = () => ({ ok: false, reason: 'injected-rejection' }); }],
  ['missing engine', f => { f.c.FiscalEngine = null; }],
  ['invalid receipt', f => { f.c.FiscalEngine.spendFromGuoku = () => ({ ok: true, deducted: {} }); }]
]) test('payment ' + name + ' cannot create a free building or success record', () => {
  const f = fixture(); inject(f); const before = JSON.stringify({ gm: f.c.GM, div: f.div }); const r = f.build();
  assert.equal(r.ok, false); assert(r.reason); assert.equal(r.building, null);
  assert.equal(JSON.stringify({ gm: f.c.GM, div: f.div }), before);
});
test('rejected payment can be retried once without a duplicate building', () => {
  const f = fixture(), spend = f.c.FiscalEngine.spendFromGuoku;
  f.c.FiscalEngine.spendFromGuoku = () => { throw Error('injected'); }; assert.equal(f.build().ok, false);
  f.c.FiscalEngine.spendFromGuoku = spend; assert.equal(f.build().ok, true); assert.equal(f.div.buildings.length, 1);
  assert.equal(f.c.GM._pendingCustomBuilds.length, 1); assert.equal(f.c.GM.guoku.money, 5000);
});
test('payment uses the explicitly supplied world, not a different global GM', () => {
  const f = fixture(), owner = f.c.GM;
  f.c.GM = { turn: 1, guoku: { money: 90000, balance: 90000 } };
  assert.equal(f.build().ok, true); assert.equal(owner.guoku.money, 5000); assert.equal(f.c.GM.guoku.money, 90000);
});
test('ordinary shortfall keeps existing partial-payment policy', () => {
  const f = fixture(), r = f.build(20000);
  assert.equal(r.ok, true); assert.equal(r.spent.money, 10000); assert.equal(r.spent.deficit, 10000);
  assert.equal(f.c.GM.guoku.money, 0); f.c.TM.BuildingWorks.tick(f.c.GM, f.c.P); assert.equal(r.building.status, 'completed');
});
test('free narrative work does not require a treasury debit', () => {
  const f = fixture(); f.c.FiscalEngine = null; assert.equal(f.build(0).ok, true); assert.equal(f.c.GM.guoku.money, 10000);
});
test('shown benefit equals the actually granted per-building six-percent cap', () => {
  const f = fixture(), b = { name: '城墙', level: 5, status: 'building', remainingTurns: 1, timeActual: 1, costActual: 100000 };
  f.div.buildings = [b]; f.c.TM.BuildingWorks.tick(f.c.GM, f.c.P);
  assert.equal(f.grants[0].econPct, 0.06); assert.equal(f.c.TM.BuildingWorks.buildingLedger(b).flowPct, 6);
});
for (const status of ['building', 'damaged', 'neglected']) test(status + ' does not display active completed-building flow', () => {
  const f = fixture(); assert.equal(f.c.TM.BuildingWorks.buildingLedger({ name: '城墙', status, costActual: 100000, level: 5 }).flowPct, 0);
});
test('maintenance and repair use local treasury without debiting central treasury', () => {
  const f = fixture(), b = { name: '城墙', level: 1, status: 'completed', costActual: 100000 };
  f.div.buildings = [b]; f.c.TM.BuildingWorks.tick(f.c.GM, f.c.P); assert.equal(f.div.publicTreasury.money.stock, 97000);
  b.status = 'damaged'; f.c.TM.BuildingWorks.tick(f.c.GM, f.c.P);
  assert.equal(f.div.publicTreasury.money.stock, 67000); assert.equal(b.status, 'completed'); assert.equal(f.c.GM.guoku.money, 10000);
});
test('real dossier card shows capped flow even without a stock delta, and truthful payer/repair fee', () => {
  const f = fixture(); Object.assign(f.c, { esc: String, hasDisplayValue: v => v != null && v !== '', compactText: String });
  vm.runInContext(card, f.c, { filename: 'phase8-formal-map-dossier.js:bkYeCard' });
  const b = { name: '城墙', level: 5, status: 'completed', costActual: 100000 };
  let html = f.c.bkYeCard(b, f.c.P); assert(html.includes('+6%/回合') && !html.includes('+15%')); assert(html.includes('地方库银 3000 两/回合'));
  b.status = 'damaged'; html = f.c.bkYeCard(b, f.c.P); assert(!html.includes('+6%')); assert(html.includes('修缮费 30000 两'));
  b.status = 'neglected'; html = f.c.bkYeCard(b, f.c.P); assert(!html.includes('+6%')); assert(html.includes('工成之利暂停'));
});
console.log(JSON.stringify({ pass, fail, skip: 0, waived: 0 })); process.exitCode = fail ? 1 : 0;
