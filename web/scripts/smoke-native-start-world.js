'use strict';
const assert = require('assert/strict');
const { fixture } = require('./fixtures/native-start-fixture.cjs');
const compiler = require('../tm-start-compiler.js'),
  world = require('../tm-start-world.js');
require('../tm-native-fiscal-adapter.js');
const copy = (x) => JSON.parse(JSON.stringify(x));
let passed = 0;
async function test(name, fn) {
  await fn();
  passed++;
  console.log('PASS ' + name);
}
async function candidate() {
  const f = fixture();
  f.scenario.nativeStart.accounts.forEach((a) => {
    a.resource = 'money';
    a.flowModel = { type: 'none' };
  });
  f.scenario.military.initialTroops.forEach((a) =>
    Object.assign(a, { monthlyMoneyPayPerSoldier: 0, monthlyGrainPayPerSoldier: 0, monthlyClothPayPerSoldier: 0 }),
  );
  f.scenario.officeRegistryByFaction.fb[0].positions[0].salaryPayments = [];
  f.scenario.nativeStart.rulesets.forEach((r) => {
    r.config = { privateTreasuryEnabled: false };
  });
  const h = await compiler.createSource(f.scenario, { capabilities: f.capabilities });
  return compiler.compile(h, 'pb', { sessionId: 'native-world-test', resolveMapAsset: f.resolveMapAsset });
}
(async () => {
  await test('runtime refuses unknown resource mappings and unimplemented rule keys', () => {
    const f = fixture();
    assert(world.inspect(f.scenario).some((x) => x.code === 'account-resource'));
    assert(world.inspect(f.scenario).some((x) => x.code === 'rule-unsupported'));
  });
  await test('runtime projection uses verified map bytes and an explicit invertible display transform', async () => {
    const c = await candidate(),
      s = world.prepareScenario(c),
      t = s.map.coordinateTransform;
    assert.equal(s.map.regions.length, 3);
    assert.equal(s.map.width, 1200);
    assert.equal(s.map.height, 800);
    assert.deepEqual(
      s.map.regions[1].coords.map((n, i) => (n - t.offset[i % 2]) / t.scale),
      [10, 0, 20, 0, 20, 10, 10, 10, 10, 0],
    );
    assert.equal(s.startContext.mapAssetText, c.mapProof.assetText);
    assert.equal(s.keju.enabled, false);
    assert.equal(s.haremConfig.enabled, false);
  });
  await test('initialization selects exact IDs and keeps foreign social objects in the same world', async () => {
    const c = await candidate(),
      s = world.prepareScenario(c);
    const g = {
        chars: copy(s.characters),
        facs: copy(s.factions),
        classes: copy(s.classes),
        parties: copy(s.parties),
        events: copy(s.events),
        officeTree: [],
      },
      p = {};
    const all = g.classes;
    world.initialize(g, p, s);
    assert.equal(g.playerCharacterId, 'cb');
    assert.equal(g.chars.filter((x) => x.isPlayer).length, 1);
    assert.equal(g.chars.find((x) => x.isPlayer).id, 'cb');
    assert.strictEqual(g.nativeWorld.classes, all);
    assert.strictEqual(g.classes[0], all[1]);
    assert.equal(g.nativeWorld.classes.length, 2);
    assert.equal(g.classes.length, 1);
    g.classes[0].satisfaction = 12;
    assert.equal(all[1].satisfaction, 12);
    assert.equal(all[0].satisfaction, 30);
  });
  await test('zero public/private resources stay zero and cannot inherit imperial startup funds', async () => {
    const c = await candidate(),
      s = world.prepareScenario(c);
    const g = {
        chars: copy(s.characters),
        facs: copy(s.factions),
        classes: [],
        parties: [],
        events: [],
        guoku: { money: 9000, balance: 9000, ledgers: { money: { stock: 479938 } } },
        neitang: { money: 10000, balance: 10000, ledgers: { money: { stock: 10000 } } },
      },
      p = {};
    world.initialize(g, p, s);
    world.finishInitialization(g);
    assert.equal(g.guoku.money, 7);
    assert.equal(g.guoku.balance, 7);
    assert.equal(g.guoku.ledgers.money.stock, 7);
    assert.equal(g.neitang.money, 0);
    assert.equal(g.neitang.balance, 0);
    assert.equal(g.neitang.ledgers.money.stock, 0);
    assert.equal(g.neitang.enabled, false);
  });
  await test('save rebind preserves changed balances and validates the original map hash', async () => {
    const c = await candidate(),
      s = world.prepareScenario(c);
    const g = {
        chars: copy(s.characters),
        facs: copy(s.factions),
        classes: copy(s.classes),
        parties: copy(s.parties),
        events: copy(s.events),
      },
      p = {};
    world.initialize(g, p, s);
    world.finishInitialization(g);
    g.guoku.money = 3;
    g.startContext.currentPlayerCharacterId = 'cg';
    const saved = copy(g);
    world.rebind(saved);
    await world.validateSnapshot(saved);
    assert.equal(saved.guoku.money, 3);
    assert.strictEqual(saved.classes[0], saved.nativeWorld.classes[1]);
    assert.equal(world.info(saved).character.id, 'cg');
    saved.startContext.mapAssetText += ' ';
    await assert.rejects(world.validateSnapshot(saved), (e) => e.code === 'native-save-map-hash');
  });
  await test('role labels cannot create authority or grant foreign jurisdiction', async () => {
    const c = await candidate(),
      s = world.prepareScenario(c),
      g = { chars: copy(s.characters), facs: copy(s.factions), classes: [], parties: [], events: [] };
    world.initialize(g, {}, s);
    assert(world.allowed(g, 'govern', 'fb', 'rb'));
    assert(!world.allowed(g, 'appoint', 'fb', 'rb'));
    assert(!world.allowed(g, 'govern', 'fa', 'ra'));
    g.playerInfo.characterTitle = '皇帝';
    assert(!world.allowed(g, 'appoint', 'fb', 'rb'));
  });
  console.log(passed + ' PASS / 0 FAIL');
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
