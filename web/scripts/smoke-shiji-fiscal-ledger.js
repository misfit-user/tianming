#!/usr/bin/env node
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const ROOT = path.resolve(__dirname, '..');
let checks = 0;
function ok(value, message) { assert(value, message); checks++; }
function load(c, file) { vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), c, { filename: file }); }
function fixture(provider = 'engine') {
  const g = {
    money: 99999999, balance: 99999999, grain: 9999999, cloth: 999999,
    turnIncome: 17463000, turnExpense: 2606000, monthlyIncome: 17463000,
    turnGrainIncome: 1234567, turnGrainExpense: 345678,
    accounting: { turn: 3, days: 10, daysPerYear: 365 }, turnDays: 30,
    ledgers: {
      money: { stock: 950, thisTurnIn: 300, thisTurnOut: 400, sources: { tianfu: 300 }, sinks: { 军饷: 400 } },
      grain: { stock: 60, thisTurnIn: 30, thisTurnOut: 40, sources: {}, sinks: {} },
      cloth: { stock: 7, thisTurnIn: 0, thisTurnOut: 0, sources: {}, sinks: {} }
    }
  };
  const c = {
    console, GM: { turn: 4, _lastCascadeTurn: 3, guoku: g, _prevGuoku: { money: 1050, grain: 70, cloth: 7 }, chars: [], facs: [], vars: {} },
    P: { conf: {}, time: { daysPerTurn: 30 } },
    TM: { errors: { capture() {}, captureSilent() {} } },
    escHtml: value => String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
    getTSText: t => 'T' + t,
    fetch() { throw Error('Network forbidden in fiscal rendering regression'); }
  };
  c.window = c; c.globalThis = c; vm.createContext(c);
  if (provider !== 'none') load(c, 'tm-fiscal-statements.js');
  if (provider === 'engine') load(c, 'tm-fiscal-engine.js');
  load(c, 'tm-endturn-shiji-compose.js');
  return c;
}
function render(c) {
  const before = JSON.stringify(c.GM);
  const html = c._renderUnifiedChanges({});
  ok(JSON.stringify(c.GM) === before, 'rendering neither posts funds nor changes the save');
  return html;
}
for (const provider of ['engine', 'statement', 'none']) {
  const c = fixture(provider), html = render(c);
  ok(html.includes('本期收入 300两 / 本期支出 400两 · 亏空 100两'), provider + ': real cash totals replace contaminated scalars');
  ok(html.includes('10日') && !html.includes('岁入') && !html.includes('岁出'), provider + ': completed ten-day period is not mislabeled annual');
  ok(!html.includes('1746.3万') && !html.includes('260.6万') && !html.includes('123.5万'), provider + ': stale money and grain flows are excluded');
  ok(html.includes('>950</span>') && html.includes('>60</span>'), provider + ': balances use ledger stocks without topbar helpers');
  ok(html.includes('>900</span>'), provider + ': monthly amount derives from recorded ten-day period');
  const beforeArchive = JSON.stringify(c.GM);
  const archived = c._composeShijiHtml({ turn: 3, oldVars: {} });
  ok(archived.includes('本期收入 300两 / 本期支出 400两'), provider + ': full popup and archived HTML use the same corrected numbers');
  ok(JSON.stringify(c.GM) === beforeArchive, provider + ': composing the archived volume remains read-only');
  const g = c.GM.guoku;
  g.ledgers.money.thisTurnIn = 0; g.ledgers.money.thisTurnOut = 0;
  g.ledgers.money.lastTurnIn = 8888888; g.ledgers.money.lastTurnOut = 7777777;
  const zero = render(c);
  ok(zero.includes('本期收入 0两 / 本期支出 0两 · 结余 0两'), provider + ': settled zero stays visible and never falls back');
  delete g.ledgers.money.thisTurnIn;
  const missing = render(c);
  ok(missing.includes('本期收入 待核 / 本期支出 0两') && missing.includes('结余待核'), provider + ': missing receipt does not become zero or old scalar');
  ok(!missing.includes('1746.3万') && !missing.includes('亏空 100'), provider + ': missing flow cannot create a fake net');
}
{
  const c = fixture(), g = c.GM.guoku;
  g.unit = { money: '贯', grain: '斛', cloth: '匹' }; g.accounting.days = 90;
  const html = render(c);
  ok(html.includes('本期收入 300贯 / 本期支出 400贯') && html.includes('90日'), 'currency unit and quarter duration come from the recorded account');
  ok(html.includes('>100</span>'), 'ninety-day income is normalized to a month once');
}
{
  const c = fixture(), g = c.GM.guoku;
  c.GM._lastCascadeTurn = undefined; delete g.accounting;
  g.flowBasis = 'forecast'; g.turnDays = 10;
  delete g.turnIncome; delete g.turnExpense;
  g.monthlyIncome = 900; g.monthlyExpense = 600;
  for (const l of Object.values(g.ledgers)) { l.thisTurnIn = 0; l.thisTurnOut = 0; }
  const html = render(c);
  ok(html.includes('预计收入 300两 / 预计支出 200两'), 'opening forecast is explicit and uses the same duration on both sides');
  ok(!html.includes('本期收入') && !html.includes('岁入'), 'forecast cannot masquerade as settled or annual receipts');
}
{
  // Exercise actual tax collection and payment providers, including the unified ledger path.
  const source = fs.readFileSync(path.join(__dirname, 'smoke-treasury-account-books.js'), 'utf8').replace(/^#![^\n]*\n/, '');
  const end = source.indexOf('let {c,scenario,elements}=fixture()');
  const create = new Function('require', '__dirname', source.slice(0, end) + '\nreturn fixture;')(require, __dirname);
  const { c } = create(); c.escHtml = c._escHtml; c.getTSText = t => 'T' + t;
  c.GM._prevGuoku = JSON.parse(JSON.stringify(c.GM.guoku));
  c.CascadeTax.collect({ turnDays: 10 }); c.FixedExpense.collect({ turnDays: 10 });
  c.GM.guoku.turnIncome = 17463000; c.GM.guoku.monthlyIncome = 17463000;
  c.GM.turn++; c.P.time.daysPerTurn = 30;
  load(c, 'tm-endturn-shiji-compose.js');
  const html = render(c), ledger = c.GM.guoku.ledgers.money;
  ok(ledger.thisTurnIn === 1000 && Math.round(ledger.thisTurnOut) === 133, 'real unified settlement fixture has expected receipts and payments');
  ok(html.includes('本期收入 1,000贯 / 本期支出 133贯') && html.includes('10日'), 'unified actual settlement retains its original period and unit after the turn advances');
  ok(!html.includes('1746.3万'), 'unified corrupted projection cannot leak into popup');
  ledger.thisTurnIn = 0; ledger.thisTurnOut = 0;
  ok(render(c).includes('本期收入 0贯 / 本期支出 0贯'), 'unified zero receipts stay actual');
}
(async () => {
  const source = fs.readFileSync(path.join(__dirname, 'smoke-native-fiscal-consumers.js'), 'utf8');
  const end = source.indexOf('(async () => {');
  const h = new Function('require', '__dirname', source.slice(0, end) + '\nreturn {ctx, setup, load};')(require, __dirname);
  const { g } = await h.setup(s => {
    s.nativeStart.accounts.forEach(a => { a.balance = 0; a.flowModel = { type: 'fixed', periodDays: 30, income: 0, expense: 10 }; });
    s.military.initialTroops.forEach(a => Object.assign(a, { monthlyMoneyPayPerSoldier: 0, monthlyGrainPayPerSoldier: 0, monthlyClothPayPerSoldier: 0 }));
    s.officeTree.forEach(d => (d.positions || []).forEach(p => { p.salaryPayments = []; }));
    Object.values(s.officeRegistryByFaction || {}).flat().forEach(d => (d.positions || []).forEach(p => { p.salaryPayments = []; }));
  });
  h.load('tm-fiscal-statements.js'); h.load('tm-endturn-shiji-compose.js');
  h.ctx.escHtml = fixture('none').escHtml; h.ctx.getTSText = t => 'T' + t;
  h.ctx.TM.NativeFiscal.settle(g, 'income', { turnDays: 30 });
  h.ctx.TM.NativeFiscal.settle(g, 'expense', { turnDays: 30 });
  g.guoku.turnIncome = 17463000; g.guoku.turnExpense = 2606000;
  const html = render(h.ctx);
  ok(html.includes('本期收入 0两 / 本期支出 0两'), 'native paid-zero settlement must not display budget expense as payment');
  ok(g.guoku.ledgers.money.deficit === 10 && !html.includes('1746.3万'), 'native unpaid liability and cash are preserved while old projections are ignored');
  console.log('[smoke-shiji-fiscal-ledger] PASS ' + checks + ' assertions');
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
