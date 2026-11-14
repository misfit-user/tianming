#!/usr/bin/env node
'use strict';
// smoke-army-feast — 依例犒设（11-14 同志「按你想法来」）
//   剧本给军写了 funding.feast（everyDays 隔几日一犒、perSoldier 每人每次钱数）的：
//   ① 按回合日数累计，到期由太仓发一次，记帑廪册「军饷」、细目「依例犒设」；不到期不发；同一回合只发一次。
//   ② 太仓钱不够的按军记欠（同军饷短发），欠饷月数照算、扣军心；补饷可补、回军心。
//   ③ 固定支出整笔回滚时，犒设的计日状态一并还原，重结只发一次。
//   ④ 下诏罢犒设（G._armyFeast.stopped）后到期不发、不记欠。没写 funding.feast 的军不动；演义难度同军饷乘 0.7。
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = process.env.TM_WEB_ROOT || path.resolve(__dirname, '..');
let A = 0;
function ok(c, m) { if (!c) throw new Error('FAIL: ' + m); A++; console.log('  ✓ ' + m); }
function near(a, b, m) { ok(Math.abs(a - b) < 0.01, m + '（得 ' + a + '，应 ' + b + '）'); }

console.log('smoke-army-feast');
// 每兵每月钱 10、粮 0、布 0；御营每人每次犒设 5，六十日一犒；一回合三十天
const FEAST = { everyDays: 60, perSoldier: 5 };
const army = (id, name, soldiers, funding, extra) => Object.assign({ id, name, faction: '宋', soldiers, monthlyMoneyPayPerSoldier: 10, monthlyGrainPayPerSoldier: 0, monthlyClothPayPerSoldier: 0, morale: 60, loyalty: 60, mutinyRisk: 30, funding }, extra || {});
const YY = () => ({ account: '御营', feast: Object.assign({}, FEAST) });

function fixture(armies, opts) {
  opts = opts || {};
  const cfg = { fixedExpense: { salaryAnnualOverride: { money: 0, grain: 0, cloth: 0 } } };
  const money = opts.guokuMoney != null ? opts.guokuMoney : 100000;
  const G = {
    sid: 'army-feast', turn: 1, playerInfo: { factionName: '宋' }, fiscalConfig: cfg,
    guoku: { money, balance: money, grain: 100000, cloth: 10000 },
    neitang: { money: 1e6, balance: 1e6, grain: 1e5, cloth: 1e4 },
    chars: [], officeTree: [], facs: [{ id: '宋', name: '宋', money: 100 }],
    armies, adminHierarchy: { player: { divisions: [] } }, _militaryPayArrearsLog: []
  };
  const c = {
    GM: G, P: { playerInfo: G.playerInfo, fiscalConfig: cfg, conf: { difficulty: opts.difficulty || '' } }, TM: {}, scriptData: {},
    Math, Date, JSON, Object, Array, String, Number, Boolean, RegExp, Error, Map, Set, parseInt, parseFloat, isFinite, isNaN,
    console: { log() {}, warn() {}, error() {} }, _getDaysPerTurn: () => 30, setTimeout() {}, clearTimeout() {}, setInterval() {}, clearInterval() {},
    document: { addEventListener() {} }, SettlementPipeline: { register() {} }, EndTurnHooks: { register() {} }, GameHooks: { on() {}, register() {} },
    getTimeRatio: () => 1 / 12, _dbg() {}, addEB() {}, toast() {},
    fetch() { throw Error('network forbidden'); }
  };
  c.window = c; c.globalThis = c;
  vm.createContext(c);
  ['tm-engine-constants.js', 'tm-faction-membership.js', 'tm-field-pipelines.js', 'tm-fiscal-statements.js', 'tm-public-treasury.js', 'tm-fiscal-engine.js',
    'tm-fiscal-army-pay.js', 'tm-fiscal-local-expense.js', 'tm-military-arrears.js', 'tm-military.js']
    .forEach((f) => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), c, { filename: f }));
  G.engineConstants = c.TM.EngineConstants.getTemplate('generic');
  return { c, G, MS: c.MilitarySystems, MA: c.TM.MilitaryArrears };
}
const armyOf = (G, id) => G.armies.find((a) => a.id === id);
const sink = (G, tag) => ((G.guoku.ledgers && G.guoku.ledgers.money && G.guoku.ledgers.money.sinks) || {})[tag] || 0;
// 帑廪册「军饷」细目里「依例犒设」一行（id army-feast）
const feastRow = (G) => ((((G.guoku.ledgers && G.guoku.ledgers.money && G.guoku.ledgers.money.sinkDetails) || {}).junxiang) || []).filter((r) => r.id === 'army-feast').reduce((n, r) => n + r.amount, 0);
const collect = (c, G, extra) => c.FixedExpense.collect(Object.assign({ game: G, turnDays: 30, force: true }, extra || {}));
// 本次结账「依例犒设」一行增了多少（测试里没有征税那一步，太仓本期账不按回合清零，看增量）
const feastOf = (c, G, extra) => { const b = feastRow(G); collect(c, G, extra); return feastRow(G) - b; };
const pressure = (MS, G) => G.armies.forEach((a) => MS.applyPayArrearsPressure(a, { source: 'smoke' }, G));
const setGuoku = (G, v) => { G.guoku.money = v; G.guoku.balance = v; if (G.guoku.ledgers && G.guoku.ledgers.money) G.guoku.ledgers.money.stock = v; };

// 1. 到期才发：第一回合三十日不发，第二回合满六十日发一次；同回合重结不重发；第四回合再发
{
  const { c, G } = fixture([army('zj', '御营中军', 100, YY()), army('qj', '御营前军', 300, YY()), army('xj', '沿江水军', 200, { account: '沿江水军' })]);
  near(feastOf(c, G), 0, '第一回合三十日，不到期不发');
  near(G._armyFeast.byArmy.zj.days, 30, '记下距上次三十日');
  G.turn = 2;
  near(feastOf(c, G), (100 + 300) * 5, '第二回合满六十日，发御营两军犒设二千');
  near(G._armyFeast.byArmy.zj.days, 0, '发后重新计日');
  ok(G._armyFeast.last.armies.length === 2 && G._armyFeast.last.armies.indexOf('沿江水军') < 0, '没写犒设的沿江水军不发');
  const stock = G.guoku.ledgers.money.stock;
  collect(c, G);
  near(G._armyFeast.last.paid, 2000, '同回合重结返回原结果');
  near(G.guoku.ledgers.money.stock, stock - (100 + 300 + 200) * 10, '同回合重结只再扣军饷（force），犒设不重发');
  G.turn = 3;
  near(feastOf(c, G), 0, '第三回合不到期');
  G.turn = 4;
  near(feastOf(c, G), 2000, '第四回合再发一次');
  ok(armyOf(G, 'zj').payArrearsMonths === 0 || armyOf(G, 'zj').payArrearsMonths == null, '太仓够，不欠');
}

// 2. 太仓不够：军饷先付，犒设付不起的按军记欠，欠饷月数照算、扣军心；补饷补上、回军心
{
  const { c, G, MS, MA } = fixture([army('zj', '御营中军', 100, YY()), army('qj', '御营前军', 300, YY())]);
  MS.initializeArmyArrears({ game: G });
  G._armyFeast = { byArmy: { zj: { days: 30 }, qj: { days: 30 } } };   // 本回合到期
  setGuoku(G, 4000);   // 只够军饷四千
  collect(c, G);
  near(feastRow(G), 0, '军饷付完库空，犒设一文未发');
  near(G._armyFeast.last.short, 2000, '犒设欠二千');
  near(G.guoku.ledgers.money.deficit, 2000, '太仓欠账只记这二千（按军记在军饷欠项，不重记）');
  near(sink(G, '军饷_欠'), 2000, '欠的二千记在「军饷_欠」（破产「军饷断裂」认这一项）');
  near(MA.view({ game: G, army: armyOf(G, 'zj') }).exactMonths, 0.5, '中军欠犒五百＝欠饷半个月（按月饷一千折）');
  G.turn = 2; pressure(MS, G);
  ok(armyOf(G, 'zj').payArrearsMonths === 1, '军务对账后欠饷月数半个月取整为一（同军饷短发）');
  ok(armyOf(G, 'zj').morale === 50, '太仓账欠不足一月按一月扣（同军饷短发）：士气 60→50：' + armyOf(G, 'zj').morale);
  setGuoku(G, 100000);
  const r = MS.settleArmyArrears(armyOf(G, 'zj'), { game: G });
  ok(r && r.ok && Math.abs(r.monthsCleared - 1) < 0.01, '补饷清欠（按整月取整）：' + JSON.stringify(r && r.monthsCleared));
  near(r.paid.money, 500, '补饷出钱五百');
  ok(armyOf(G, 'zj').morale === 54, '补饷补掉一个月，回士气四（50→54）：' + armyOf(G, 'zj').morale);
}

// 3. 固定支出整笔回滚：犒设计日与太仓一并还原，重结只发一次
{
  const { c, G } = fixture([army('zj', '御营中军', 100, YY())]);
  G._armyFeast = { byArmy: { zj: { days: 30 } } };
  const before = G.guoku.money;
  let threw = false;
  try { collect(c, G, { _faultInjector: (stage) => { if (stage === 'after-deductions') throw new Error('注入故障'); } }); } catch (e) { threw = /注入故障/.test(e.message); }
  ok(threw, '注入故障，固定支出整笔回滚');
  near(G._armyFeast.byArmy.zj.days, 30, '犒设计日还原为三十日');
  ok(G._armyFeast.turn == null, '犒设本回合标记还原');
  near(G.guoku.money, before, '太仓还原');
  collect(c, G);
  near(feastRow(G), 500, '重结发一次犒设');
}

// 4. 罢犒设：到期不发、不记欠，照旧计日
{
  const { c, G, MA } = fixture([army('zj', '御营中军', 100, YY())]);
  G._armyFeast = { byArmy: { zj: { days: 30 } }, stopped: true };
  collect(c, G);
  near(feastRow(G), 0, '罢犒设后到期不发');
  ok(!(MA.view({ game: G, army: armyOf(G, 'zj') }).exactMonths > 0), '不记欠');
  near(G._armyFeast.byArmy.zj.days, 0, '照旧计日');
}

// 5. 演义难度：犒设同军饷乘 0.7；自给的军写了犒设也不发
{
  const { c, G } = fixture([army('zj', '御营中军', 100, YY()), army('yj', '义军', 100, { account: '义军', selfSupplied: true, feast: Object.assign({}, FEAST) })], { difficulty: '演义' });
  G._armyFeast = { byArmy: { zj: { days: 30 }, yj: { days: 30 } } };
  collect(c, G);
  near(feastRow(G), 100 * 5 * 0.7, '演义难度犒设乘 0.7');
  ok(!G._armyFeast.byArmy.yj.lastTurn, '自给的义军不发');
}

console.log('PASS army-feast ' + A + ' assertions');
