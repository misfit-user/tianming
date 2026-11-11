#!/usr/bin/env node
// smoke-guoku-residual-no-overdraw.js — 帑廪结账补扣赈济、工程、祭祀、赏赐、杂支与内廷转运时，库里有多少付多少（11-12）。
//   原先不论库里有没有照扣：存银扣成负数，内帑照应付全额收转运——帑廪没出的钱，内帑先收到了。
//   现在：各项按应付同比例少付；赈济等短的照俸饷记欠（帑廪册「某某_欠」与欠项明细）；内廷转运短的不记欠，内帑只收实付。
//   跑：node scripts/smoke-guoku-residual-no-overdraw.js
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const REPO = path.resolve(ROOT, '..');
const SCENARIO = JSON.parse(fs.readFileSync(path.join(REPO, 'scenarios', '天启七年·九月（官方）.json'), 'utf8'));

let pass = 0;
let fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ ' + msg); }
}
function near(a, b, msg) {
  ok(Math.abs(Number(a) - b) < 0.01, msg + '（得 ' + a + '，应 ' + b + '）');
}
function clone(x) { return JSON.parse(JSON.stringify(x)); }

// 天启开局走旧账（剧本没写统一预算），帑廪、内帑两库照剧本初始化
function fixture() {
  const s = SCENARIO;
  const days = 30;
  const pi = s.playerInfo;
  const G = {
    sid: s.id, turn: 1, playerInfo: clone(pi),
    facs: [{ id: pi.factionName, name: pi.factionName }],
    chars: [], officeTree: [], armies: [], adminHierarchy: {},
    fiscalConfig: clone(s.fiscalConfig || {}), guoku: {}, neitang: {}, vars: {}
  };
  const c = {
    GM: G,
    P: { fiscalConfig: clone(s.fiscalConfig || {}), playerInfo: clone(pi), time: { daysPerTurn: days } },
    Math, Date, JSON,
    console: { log() {}, warn() {}, error() {} },
    findScenarioById: () => s,
    _getDaysPerTurn: () => days,
    addEB() {},
    setTimeout() {}, clearTimeout() {}, setInterval() {}, clearInterval() {},
    fetch() { throw Error('network forbidden'); }
  };
  c.window = c;
  c.globalThis = c;
  vm.createContext(c);
  for (const f of ['tm-field-pipelines.js', 'tm-public-treasury.js', 'tm-fiscal-statements.js', 'tm-fiscal-engine.js', 'tm-guoku-engine.js', 'tm-neitang-engine.js']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), c, { filename: f });
  }
  c.GuokuEngine.initFromDynasty(s.dynasty, s.dynastyPhaseHint, s);
  c.NeitangEngine.initFromDynasty(s.dynasty, s.dynastyPhaseHint, s);
  return c;
}

// 结一个月：帑廪年支只留赈济、工程、内廷转运各十二万（月各一万），内帑只收帑廪转运
function settleMonth(stockBefore) {
  const c = fixture();
  const G = c.GM, GE = c.GuokuEngine, NE = c.NeitangEngine;
  for (const k of Object.keys(GE.Expenses)) GE.Expenses[k] = () => 0;
  GE.Expenses.zhenzi = () => 120000;
  GE.Expenses.gongcheng = () => 120000;
  GE.Expenses.neiting = () => 120000;
  for (const k of Object.keys(NE.Sources)) if (k !== 'guokuTransfer') NE.Sources[k] = () => 0;
  for (const k of Object.keys(NE.Expenses)) NE.Expenses[k] = () => 0;
  G.turn = 5;
  G._lastCascadeTurn = G.turn;       // 本回合征收已入账：走正路，只补扣杂项
  G._lastFixedExpenseTurn = G.turn;  // 俸饷宗禄已扣过
  const led = G.guoku.ledgers.money;
  led.stock = stockBefore; G.guoku.balance = stockBefore;
  led.thisTurnIn = 0; led.thisTurnOut = 0; led.deficit = 0; led.sinks = {}; led.deficitDetails = {};
  const nLed = G.neitang.ledgers.money;
  const nStock = Number(nLed.stock) || 0, nIn = Number(nLed.thisTurnIn) || 0;
  GE.monthlySettle(1);
  NE.monthlySettle(1);
  return { c, G, led, nGain: (Number(nLed.stock) || 0) - nStock, nIn: (Number(nLed.thisTurnIn) || 0) - nIn };
}

function arrearsRows(led, tag) {
  return ((led.deficitDetails || {})[tag] || []).reduce((s, r) => s + (Number(r.amount) || 0), 0);
}

console.log('案1·库里只够一半：同比例付一半，存银停在零');
{
  const { c, G, led, nGain, nIn } = settleMonth(15000);
  near(led.stock, 0, '存银付到零，不扣成负数');
  near(G.guoku.balance, 0, 'balance 与账同');
  near(led.sinks['赈济'], 5000, '赈济实付一半');
  near(led.sinks['工程'], 5000, '工程实付一半');
  near(led.sinks['内廷转运'], 5000, '内廷转运实付一半');
  near(led.sinks['赈济_欠'], 5000, '赈济短的记欠');
  near(led.sinks['工程_欠'], 5000, '工程短的记欠');
  ok(!led.sinks['内廷转运_欠'], '内廷转运短的不记欠');
  near(led.deficit, 10000, '欠项总数只含赈济、工程');
  near(arrearsRows(led, '赈济') + arrearsRows(led, '工程'), 10000, '欠项明细与总数对得上');
  near(led.thisTurnOut, 15000, '本期支出＝实付');
  near(nIn, 5000, '内帑本期只收实付的转运');
  near(nGain, 5000, '内帑库存只涨实付的那一半');
  c.GuokuEngine.checkBankruptcy(1);
  const b = G.guoku.bankruptcy, annual = Math.max(1, G.guoku.annualIncome || 0);
  ok(b.active, '欠下杂项即在亏空中（破产一级照账上新欠判）');
  near(b.severity, 10000 / annual, '亏空几成年入照新欠算');
}

console.log('案2·库里够：照数付清，不记欠');
{
  const { led, nGain } = settleMonth(100000);
  near(led.stock, 70000, '三项各一万照付');
  ok(!led.deficit, '不记欠');
  ok(!led.sinks['赈济_欠'] && !led.sinks['工程_欠'], '无欠项');
  near(nGain, 10000, '内帑照数收转运');
}

console.log('案3·旧档库存已是负数：本期一文不付，不再往下扣');
{
  const { led, nGain } = settleMonth(-5000);
  near(led.stock, -5000, '负数不再加深');
  near(led.sinks['赈济_欠'], 10000, '赈济全数记欠');
  near(led.sinks['工程_欠'], 10000, '工程全数记欠');
  near(led.deficit, 20000, '欠项总数');
  near(nGain, 0, '内帑不收没出库的转运');
}

console.log('\n结果：' + pass + ' 过 / ' + fail + ' 败');
process.exit(fail ? 1 : 0);
