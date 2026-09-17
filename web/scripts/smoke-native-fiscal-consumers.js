'use strict';
const assert = require('assert/strict'),
  fs = require('fs'),
  path = require('path'),
  vm = require('vm');
const { fixture } = require('./fixtures/native-start-fixture.cjs');
const copy = (x) => JSON.parse(JSON.stringify(x));
const ctx = {
  console,
  TextEncoder,
  TextDecoder,
  AbortController,
  crypto: require('crypto').webcrypto,
  JSON,
  Date,
  Math,
  Map,
  Set,
  Array,
  Object,
  Number,
  String,
  RegExp,
  Boolean,
  parseInt,
  parseFloat,
  isFinite,
  isNaN,
  setTimeout() {},
  clearTimeout() {},
  deepClone: copy,
  initDataListeners() {},
  toast() {},
  addEB() {},
  _dbg() {},
  _launchPostTurnJobs() {},
  _enqueuePostTurnJob() {},
  document: {
    readyState: 'loading',
    head: { appendChild() {} },
    body: { appendChild() {} },
    addEventListener() {},
    getElementById() {
      return null;
    },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
  },
  addEventListener() {},
  SettlementPipeline: { register() {} },
  P: { scenarios: [], conf: {}, playerInfo: { characterId: 'ca', factionName: '甲国' }, time: { daysPerTurn: 30 } },
  GM: {},
};
ctx.window = ctx;
ctx.globalThis = ctx;
vm.createContext(ctx);
function load(file) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), ctx, { filename: file });
}
[
  'tm-start-contracts.js',
  'libs/polygon-clipping-0.15.7.min.js',
  'tm-map-workbench.js',
  'tm-start-compiler.js',
  'tm-faction-membership.js',
  'tm-start-world.js',
  'tm-native-fiscal-adapter.js',
  'tm-native-scope.js',
  'tm-fiscal-engine.js',
  'tm-guoku-engine.js',
  'tm-neitang-engine.js',
  'tm-faction-npc-guoku.js',
  'tm-indices.js',
  'tm-office-system.js',
  'tm-class-engine.js',
].forEach(load);
load('tm-native-fiscal-ui.js');
ctx.getCurrentYear = () => 1000;
ctx.getCurrentMonth = () => 1;
ctx.getTSText = (t) => 'T' + t;
['tm-arcs.js', 'tm-mechanics-memory.js', 'tm-ai-apply-deaths.js'].forEach(load);
const helperSource = fs.readFileSync(path.join(__dirname, '../tm-endturn-helpers.js'), 'utf8');
const helperAst = require('acorn').parse(helperSource, { ecmaVersion: 'latest' });
['resolveHeir', '_heirBasisOf', 'adjudicatePlayerDeath'].forEach((name) => {
  const node = helperAst.body.find((n) => n.type === 'FunctionDeclaration' && n.id.name === name);
  assert(node, 'actual succession function missing');
  vm.runInContext(helperSource.slice(node.start, node.end), ctx, { filename: 'tm-endturn-helpers.js:' + name });
});
let pass = 0;
async function test(name, fn) {
  await fn();
  pass++;
  console.log('PASS ' + name);
}
async function setup(configure) {
  const f = fixture(),
    s = f.scenario;
  s.nativeStart.accounts.forEach((a, i) =>
    Object.assign(a, {
      resource: 'money',
      unit: '两',
      flowModel: { type: 'fixed', periodDays: 30, income: i ? 5 : 20, expense: 0 },
    }),
  );
  s.nativeStart.rulesets.forEach((r) => (r.config = { privateTreasuryEnabled: false }));
  s.military.initialTroops.forEach((a) =>
    Object.assign(a, { monthlyMoneyPayPerSoldier: 0, monthlyGrainPayPerSoldier: 0, monthlyClothPayPerSoldier: 0 }),
  );
  Object.assign(s.military.initialTroops[1], {
    commanderId: 'ca',
    monthlyMoneyPayPerSoldier: 1 / 80,
    payerShares: [
      { accountId: 'account-a', share: 0.5 },
      { accountId: 'account-b', share: 0.5 },
    ],
  });
  s.officeTree[0].positions = [
    { id: 'pos-a', name: '甲执事', holderId: 'ca', salaryPayments: [{ accountId: 'account-a', amountPer30Days: 3 }] },
  ];
  Object.assign(s.officeRegistryByFaction.fb[0].positions[0], {
    name: '乙执事',
    holderId: 'ca',
    appointmentAuthority: 'authority-pb',
    salaryPayments: [{ accountId: 'account-b', amountPer30Days: 2 }],
  });
  if (configure) configure(s);
  const h = await ctx.TM.StartCompiler.createSource(s, { capabilities: f.capabilities }),
    c = await ctx.TM.StartCompiler.compile(h, 'pb', {
      sessionId: 'finance-consumers',
      resolveMapAsset: f.resolveMapAsset,
    });
  ctx.TM.NativeWorld.prepareScenario(c);
  const g = (ctx.GM = {
    turn: 1,
    chars: copy(c.scenario.characters),
    facs: copy(c.scenario.factions),
    classes: copy(s.classes),
    parties: copy(s.parties),
    events: copy(s.events),
    armies: copy(s.military.initialTroops),
    officeTree: [],
    time: { daysPerTurn: 30 },
    adminHierarchy: {},
    mapData: copy(c.scenario.map),
    huangwei: { index: 50 },
  });
  ctx.TM.NativeWorld.initialize(g, ctx.P, c.scenario);
  ctx.TM.NativeWorld.finishInitialization(g);
  return { g, s };
}
function taxWorld(s) {
  s.nativeStart.accounts.forEach((a) => (a.flowModel = { type: 'none' }));
  s.nativeStart.accounts.push({
    id: 'account-c',
    ownerFactionId: 'fc',
    kind: 'public',
    resource: 'money',
    unit: '两',
    balance: 0,
    flowModel: { type: 'region-tax', periodDays: 30, rate: 0.1, expense: 0 },
  });
  Object.assign(s.map.regions[0], {
    sovereignFactionId: 'fa',
    controllerFactionId: 'fb',
    taxAuthorityFactionId: 'fc',
    taxBase: 100,
    taxBaseResource: 'money',
    taxBaseUnit: '两',
  });
}
(async () => {
  await test('sovereign A and controller B never collect C tax receipts, including repeat ticks and a changed colour', async () => {
    const { g, s } = await setup(taxWorld),
      r = g.mapData.regions[0],
      before = JSON.stringify(s);
    for (const id of ['fa', 'fb', 'fc']) ctx.TM.NativeFiscal.settle(g, 'income', { turnDays: 30 }, id);
    assert.equal(g.facs[0].treasury.money, 0);
    assert.equal(g.guoku.money, 7);
    assert.equal(g.facs[2].treasury.money, 10);
    const receipt = g.nativeWorld.fiscalOperations['income:1:account-c'];
    assert.equal(receipt.payments[0].regionId, 'ra');
    assert.equal(receipt.payments[0].taxAuthorityFactionId, 'fc');
    r.controllerFactionId = 'fa';
    ctx.TM.NativeFiscal.settle(g, 'income', { turnDays: 30 }, 'fc');
    assert.equal(g.facs[2].treasury.money, 10);
    g.turn = 2;
    ctx.TM.NativeFiscal.settle(g, 'income', { turnDays: 15 }, 'fc');
    assert.equal(g.facs[2].treasury.money, 15);
    assert.equal(JSON.stringify(s), before);
    const saved = copy(g);
    ctx.TM.NativeWorld.rebind(saved, ctx.P);
    assert.equal(saved.facs[2].treasury.money, 15);
    assert.equal(saved.mapData.regions[0].taxAuthorityFactionId, 'fc');
    assert.equal(
      ctx.TM.NativeFiscal.settle(saved, 'income', { turnDays: 15 }, 'fc').skipped,
      'already-collected-this-turn',
    );
  });
  await test('a deliberate tax-right transfer routes later receipts without changing sovereignty or control', async () => {
    const { g } = await setup(taxWorld),
      r = g.mapData.regions[0];
    g.nativeWorld.accounts[1].flowModel = { type: 'region-tax', periodDays: 30, rate: 0.1, expense: 0 };
    r.taxAuthorityFactionId = 'fb';
    ctx.GuokuEngine.tick();
    ctx.GuokuEngine.tick();
    assert.equal(g.guoku.money, 17);
    assert.equal(g.facs[2].treasury.money, 0);
    assert.equal(r.sovereignFactionId, 'fa');
    assert.equal(r.controllerFactionId, 'fb');
    assert(ctx.TM.NativeFiscalUI.render(g, 'public').includes('按税权收取'));
    r.taxAuthorityFactionId = null;
    g.turn++;
    ctx.GuokuEngine.tick();
    assert.equal(g.guoku.money, 17);
  });
  await test('missing tax authority, wrong units and invalid rates fail before balances or receipts change', async () => {
    for (const mutate of [
      (r) => delete r.taxAuthorityFactionId,
      (r) => (r.taxAuthorityFactionId = 'unknown-faction'),
      (r) => (r.taxBaseUnit = '石'),
      (r) => delete r.taxBaseResource,
    ]) {
      const { g } = await setup(taxWorld);
      mutate(g.mapData.regions[0]);
      const before = JSON.stringify(g);
      assert.throws(() => ctx.TM.NativeFiscal.settle(g, 'income', {}, 'fc'), /税/);
      assert.equal(JSON.stringify(g), before);
    }
    const { s } = await setup(taxWorld);
    s.nativeStart.accounts[2].flowModel.rate = 1.1;
    assert(ctx.TM.NativeFiscal.inspect(s).some((e) => e.code === 'native-tax-model'));
  });
  await test('real fixed expense owner respects joint payers and foreign appointees, not commander nationality', async () => {
    const { g } = await setup();
    const q = ctx.FixedExpense.preview();
    assert.equal(q.army.money, 0.5);
    assert.equal(q.salary.money, 2);
    assert.equal(q.imperial.money, 0);
    assert.equal(q.totalMoney, 2.5);
    assert.equal(g.nativeWorld.baseOfficeTree[0].positions.length, 1);
  });
  await test('actual treasury and NPC consumers skip only explicit current faction despite stale template flags', async () => {
    const { g } = await setup();
    ctx.P.playerInfo = { factionName: '甲国', characterName: '同名君主' };
    g.facs[0].isPlayer = true;
    ctx.CascadeTax.collect();
    ctx.GuokuEngine.tick();
    ctx.NeitangEngine.tick();
    ctx.FixedExpense.collect();
    const npc = ctx.TM.FactionNpcGuoku.generate();
    assert.equal(npc.run, 1);
    assert.equal(g.guoku.money, 9.5);
    assert.equal(g.facs[0].treasury.money, 16.5);
    assert.equal(g.neitang.money, 0);
    assert.equal(g.nativeWorld.accounts[1].balance, 9.5);
    const before = JSON.stringify(g.nativeWorld.fiscalOperations);
    ctx.CascadeTax.collect();
    ctx.GuokuEngine.tick();
    ctx.NeitangEngine.tick();
    ctx.FixedExpense.collect();
    assert.equal(ctx.TM.FactionNpcGuoku.generate().run, 0);
    assert.equal(g.guoku.money, 9.5);
    assert.equal(g.facs[0].treasury.money, 16.5);
    assert.equal(JSON.stringify(g.nativeWorld.fiscalOperations), before);
  });
  await test('a zero private treasury gains no imperial estate income or expenses over ten actual ticks', async () => {
    const { g } = await setup();
    for (let i = 1; i <= 10; i++) {
      g.turn = i;
      ctx.GuokuEngine.tick();
      ctx.NeitangEngine.tick();
      ctx.FixedExpense.collect();
      assert.equal(g.neitang.money, 0);
      assert.equal(g.neitang.ledgers.money.deficit, 0);
    }
    assert.equal(g.guoku.money, 32);
  });
  await test('real expense fault rolls all stocks and idempotency receipts back before a retry', async () => {
    const { g } = await setup();
    ctx.CascadeTax.collect();
    const before = JSON.stringify({ g: g.guoku, n: g.neitang, j: g.nativeWorld.fiscalOperations });
    assert.throws(
      () =>
        ctx.FixedExpense.collect({
          _faultInjector() {
            throw Error('injected');
          },
        }),
      /injected/,
    );
    assert.equal(JSON.stringify({ g: g.guoku, n: g.neitang, j: g.nativeWorld.fiscalOperations }), before);
    ctx.FixedExpense.collect();
    assert.equal(g.guoku.money, 9.5);
  });
  await test('shortfalls remain debt, never an invented refill or money-to-grain exchange', async () => {
    const { g } = await setup();
    g.officeTree[0].positions[0].salaryPayments[0].amountPer30Days = 100;
    const result = ctx.FixedExpense.collect();
    assert.equal(g.guoku.money, 0);
    assert.equal(g.guoku.ledgers.money.deficit, 93.5);
    assert.equal(g.guoku.grain, 0);
    assert.equal(result.receipts[0].deficit, 93.5);
  });
  await test('serialization rebind shares the same canonical stock and does not reseed initial money', async () => {
    const { g } = await setup();
    g.guoku.balance = 3;
    assert.equal(g.nativeWorld.accounts[1].balance, 3);
    assert.equal(g.facs[1].treasury.money, 3);
    const saved = copy(g);
    ctx.GM = saved;
    ctx.TM.NativeWorld.rebind(saved);
    assert.equal(saved.guoku.money, 3);
    assert.strictEqual(saved.facs[1].treasury, saved.guoku);
    saved.nativeWorld.accounts[1].balance = 2;
    assert.equal(saved.guoku.balance, 2);
  });
  await test('unimplemented flows and missing pay rates are explicit errors before initialization', async () => {
    const f = fixture();
    const errors = ctx.TM.NativeFiscal.inspect(f.scenario);
    assert(errors.some((e) => e.code === 'native-finance-flow'));
    assert(errors.some((e) => e.code === 'native-finance-salary'));
    f.scenario.officeRegistryByFaction.fb[0].positions[0].salaryPayments = [];
    assert(ctx.TM.NativeFiscal.inspect(f.scenario).some((e) => e.code === 'native-finance-value'));
  });
  await test('legal succession updates current ID, not the historical profile or treasury, and uses local titles', async () => {
    const { g } = await setup();
    g.guoku.money = 3;
    g.chars.find((c) => c.id === 'cb').alive = false;
    const r = ctx.TM.Succession.transferPlayerControl({ world: g, to: 'cg', reason: 'death' });
    assert(r.ok, r.error && r.error.stack);
    assert.equal(g.startContext.playerCharacterId, 'cb');
    assert.equal(g.startContext.currentPlayerCharacterId, 'cg');
    assert.equal(g.playerCharacterId, 'cg');
    assert.equal(ctx.TM.Player.getCharacter().id, 'cg');
    assert.equal(g.guoku.money, 3);
    assert.equal(g.chars.find((c) => c.id === 'cb').alive, false);
    assert.equal(g.chars.find((c) => c.id === 'cg').title, '公');
    assert.equal(g.startContext.playerFactionId, 'fb');
    assert.equal(ctx.P.playerInfo.characterId, 'cb');
    const saved = copy(g);
    ctx.TM.NativeWorld.rebind(saved);
    assert.equal(ctx.TM.Player.getCharacter(saved).id, 'cg');
    assert.equal(saved.guoku.money, 3);
  });
  await test('native social array edits update the world registry without dropping foreign records', async () => {
    const { g } = await setup(),
      worldRows = g.nativeWorld.classes,
      view = g.classes;
    const extra = { id: 'class-b2', name: '工匠', factionId: 'fb', satisfaction: 0 };
    view.push(extra);
    assert.equal(view.length, 2);
    assert.strictEqual(g.nativeWorld.classes, worldRows);
    assert.strictEqual(
      worldRows.find((c) => c.id === extra.id),
      extra,
    );
    view.splice(0, 1);
    assert(g.nativeWorld.classes.some((c) => c.id === 'class-a'));
    assert(!g.nativeWorld.classes.some((c) => c.id === 'class-b'));
    g.classes = [extra];
    const saved = copy(g);
    ctx.TM.NativeWorld.rebind(saved);
    assert.equal(saved.classes[0].satisfaction, 0);
    assert(saved.nativeWorld.classes.some((c) => c.id === 'class-a'));
    assert.throws(() => g.classes.push({ id: 'class-a', factionId: 'fa' }), /外国/);
  });
  await test('the actual class coupling follows stable support edges and preserves foreign namesakes', async () => {
    const { g } = await setup();
    g.nativeWorld.parties.forEach((p) => (p.cohesion = 50));
    const cls = g.classes[0];
    cls.supportingParties = [{ partyId: 'party-b', affinity: 1 }];
    const first = ctx.TM.ClassEngine.applyClassPartyCoupling(g, cls, -10, {});
    assert.equal(first.applied.length, 1);
    assert.equal(g.nativeWorld.parties.find((p) => p.id === 'party-b').cohesion, 40);
    assert.equal(g.nativeWorld.parties.find((p) => p.id === 'party-a').cohesion, 50);
    cls.supportingParties = [{ partyId: 'party-a', affinity: 0.5 }];
    ctx.TM.ClassEngine.applyClassPartyCoupling(g, cls, -10, {});
    assert.equal(g.nativeWorld.parties.find((p) => p.id === 'party-a').cohesion, 45);
    assert.equal(g.nativeWorld.parties.find((p) => p.id === 'party-b').cohesion, 40);
  });
  await test('actual party outcomes follow stable support edges without changing foreign namesakes', async () => {
    const { g } = await setup(),
      foreign = g.nativeWorld.classes.find((c) => c.id === 'class-a'),
      local = g.nativeWorld.classes.find((c) => c.id === 'class-b');
    foreign.supportingParties = [{ partyId: 'party-a', affinity: 1 }];
    local.supportingParties = [{ partyId: 'party-b', affinity: 1 }];
    const before = foreign.satisfaction;
    ctx.TM.ClassEngine.applyPartyOutcomeToClasses(g, { partyDeltas: { 'party-b': 4 } });
    assert(local.satisfaction > 70);
    assert.equal(foreign.satisfaction, before);
    foreign.supportingParties.push({ partyId: 'party-b', affinity: 1 });
    ctx.TM.ClassEngine.applyPartyOutcomeToClasses(g, { partyDeltas: { 'party-b': 4 } });
    assert(foreign.satisfaction > before);
  });
  await test('displaying an emperor title cannot bypass the actual stable-ID appointment writer', async () => {
    const { g } = await setup(),
      pos = g.officeTree[0].positions[0],
      before = JSON.stringify(pos);
    g.chars.find((c) => c.id === 'cb').title = '皇帝';
    assert.equal(ctx.canPerformAction('cb', 'appointment').can, false);
    const denied = ctx._offAppointCharacter(pos, 'cg', { world: g });
    assert.equal(denied.reason, 'native-appointment-authority-denied');
    assert.equal(JSON.stringify(pos), before);
    g.nativeWorld.authority.grants.push('appoint');
    const allowed = ctx._offAppointCharacter(pos, 'cg', { world: g });
    assert(allowed.ok, allowed.reason);
    assert(pos.actualHolders.some((h) => h.characterId === 'cg'));
  });
  await test('an abdicated living ruler loses inherited head authority; neither title nor stale profile regrants it', async () => {
    const { g } = await setup();
    const r = ctx.TM.Succession.transferPlayerControl({ world: g, to: 'cg', reason: 'abdication' });
    assert(r.ok);
    assert(!ctx.TM.NativeWorld.allowed(g, 'treasury', 'fb', null, 'cb'));
    assert(ctx.TM.NativeWorld.allowed(g, 'treasury', 'fb', null, 'cg'));
    assert.equal(g.chars.find((c) => c.id === 'cb').alive, true);
  });
  await test('actual treasury actions obey authority and reject missing private accounts without partial debits', async () => {
    const { g } = await setup();
    g.nativeWorld.authority.grants = [];
    g.chars.find((c) => c.id === 'cb').title = '皇帝';
    const before = g.guoku.money;
    assert.equal(ctx.GuokuEngine.Actions.extraTax(0.2).code, 'native-treasury-authority-denied');
    assert.equal(ctx.NeitangEngine.Actions.transferFromGuoku(1).code, 'native-treasury-authority-denied');
    assert.equal(g.guoku.money, before);
    g.nativeWorld.authority.grants = ['treasury'];
    assert.equal(ctx.NeitangEngine.Actions.transferFromGuoku(1).code, 'native-transfer-account');
    assert.equal(g.guoku.money, before);
  });
  await test('native fiscal UI and topbar projections use actual rates and escape authored account names', async () => {
    const { g } = await setup();
    assert.equal(g.guoku.monthlyIncome, 5);
    assert.equal(g.guoku.monthlyExpense, 2.5);
    assert.equal(g.neitang.monthlyIncome, 0);
    g.nativeWorld.accounts[1].name = '<img src=x onerror=alert(1)>';
    const before = JSON.stringify(g.nativeWorld.accounts),
      html = ctx.TM.NativeFiscalUI.render(g, 'public');
    assert(html.includes('&lt;img'));
    assert(!html.includes('<img'));
    assert(html.includes('2.5'));
    assert(ctx.TM.NativeFiscalUI.render(g, 'private').includes('未启用皇产'));
    assert.equal(JSON.stringify(g.nativeWorld.accounts), before);
  });
  await test('the real death sink rejects ambiguous names and clears only exact-ID commands and offices', async () => {
    const { g } = await setup(),
      king = g.chars.find((c) => c.id === 'cb'),
      other = g.chars.find((c) => c.id === 'ca');
    const denied = ctx.applyOneDeath({ name: king.name, reason: '病逝' });
    assert.equal(denied.code, 'native-death-target-unresolved');
    assert.equal(other.alive, true);
    assert.equal(king.alive, true);
    g.officeTree[0].positions.push({ id: 'pos-king', name: '兼任议长', holderId: 'cb', salaryPayments: [] });
    ctx.TM.NativeWorld.bindOffices(g);
    g.armies.push({
      id: 'army-own-command',
      ownerFactionId: 'fb',
      commanderId: 'cb',
      commander: king.name,
      soldiers: 0,
      morale: 60,
    });
    g.facs.forEach((f) => {
      f.leaderId = f.leaderCharacterId;
      f.leader = g.chars.find((c) => c.id === f.leaderId)?.name || '';
    });
    king.designatedHeirId = 'cg';
    ctx.applyOneDeath({ characterId: 'cb', name: king.name, reason: '病逝' });
    assert.equal(other.alive, true);
    assert.equal(king.alive, false);
    assert.equal(g.armies.find((a) => a.id === 'army-b').commanderId, 'ca');
    assert.equal(g.armies.find((a) => a.id === 'army-own-command').commanderId, null);
    assert.equal(g.officeTree[0].positions.find((p) => p.id === 'pos-king').holderId, '');
    assert.equal(g.officeTree[0].positions.find((p) => p.id === 'pos-b').holderId, 'ca');
    assert.equal(g.facs.find((f) => f.id === 'fa').leaderId, 'ca');
    assert.equal(g.facs.find((f) => f.id === 'fb').leaderId, 'cg');
    assert.equal(g.startContext.currentPlayerCharacterId, 'cg');
    assert.equal(g.chars.find((c) => c.id === 'cg').title, '公');
    assert.equal(g.guoku.money, 7);
    assert(g.characterArcs.cb);
    assert(!g.characterArcs.ca);
    const after = JSON.stringify(g);
    ctx.applyOneDeath({ characterId: 'cb', reason: '重复死亡' });
    assert.equal(JSON.stringify(g), after);
  });
  console.log(pass + ' PASS / 0 FAIL');
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
