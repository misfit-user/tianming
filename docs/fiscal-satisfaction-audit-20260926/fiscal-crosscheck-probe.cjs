'use strict';

// Read-only reproduction: all game state lives in a fresh VM.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const repo = path.resolve(__dirname, '../..');
const input = 'scenarios/天启七年·九月（官方）.json';
const raw = fs.readFileSync(path.join(repo, input), 'utf8');
const scenario = JSON.parse(raw);
const clone = x => JSON.parse(JSON.stringify(x));
const providers = [
  'tm-integration-bridge.js',
  'tm-minxin-hard-links.js',
  'tm-minxin-hard-link-consumers.js',
  'tm-reported-view.js',
];
const g = {
  turn: 4,
  sid: scenario.id,
  adminHierarchy: clone(scenario.adminHierarchy),
  corruption: clone(scenario.corruption),
  fiscalConfig: clone(scenario.fiscalConfig),
  facs: clone(scenario.factions),
  guoku: {
    money: 95000, balance: 95000, turnIncome: 915557, monthlyIncome: 915557,
    turnExpense: 2606000,
    ledgers: {money: {stock: 95000, thisTurnIn: 915557, thisTurnOut: 1105557}},
  },
  minxin: {trueIndex: 3}, huji: {}, hukou: {}, military: {}, huangquan: {index: 59},
};
const c = {GM: g, P: {conf: {}}, TM: {}, console};
c.window = c; c.global = c; c.globalThis = c;
vm.createContext(c);
const hashes = {[input]: crypto.createHash('sha256').update(raw).digest('hex')};
providers.forEach(name => {
  const source = fs.readFileSync(path.join(repo, 'web', name), 'utf8');
  hashes['web/' + name] = crypto.createHash('sha256').update(source).digest('hex');
  vm.runInContext(source, c, {filename: name});
});
assert.equal(scenario.fiscalConfig.accounting, undefined);
const leaves = c.IntegrationBridge.getLeafDivisions(g.adminHierarchy, 'player');
const sourceTotals = leaves.reduce((a, row) => {
  a.claimed += Number(row.fiscalDetail?.claimedRevenue) || 0;
  a.remitted += Number(row.fiscalDetail?.remittedToCenter) || 0;
  return a;
}, {claimed: 0, remitted: 0});
const before = clone(g.guoku);
const hard = c.TM.MinxinHardLinks.tick(g, {turn: g.turn});
const consumed = c.TM.MinxinHardLinkConsumers.consume(g, {turn: g.turn});
assert.notEqual(g.guoku.turnIncome, before.turnIncome);
assert.equal(g.guoku.turnIncome, hard.summary.fiscal.remittedToCenter);
assert.equal(g.guoku.monthlyIncome, g.guoku.turnIncome);
assert.equal(g.guoku.money, before.money);
assert.equal(g.guoku.balance, before.balance);
assert.deepEqual(clone(g.guoku.ledgers), before.ledgers);
assert.equal(c.TM.ReportedView.active(c.P), false);
const incomeWithoutReported = g.guoku.turnIncome;
c.P.conf = {gameMode: 'strict_hist', reportedViewEnabled: true};
const reported = c.TM.ReportedView.value('fiscal', 'fiscal.turnIncome', before.turnIncome, {direction: 'good', dept: 'fiscal'});
assert.ok(reported.shown <= Math.ceil(before.turnIncome * 1.35));

// Independent source/consumer contract reproduction with the screenshot's displayed value.
// This deliberately supplied hard-link summary is not the player's save or its actual source.
g._minxinHardLinks.summary.fiscal.remittedToCenter = 17463000;
c.P.conf = {};
c.TM.MinxinHardLinkConsumers.consume(g, {turn: g.turn});
assert.equal(g.guoku.turnIncome, 17463000);
assert.equal(g.guoku.money, before.money);
assert.equal(g.guoku.ledgers.money.thisTurnIn, before.ledgers.money.thisTurnIn);
console.log(JSON.stringify({
  description: 'Current official data plus real providers; synthetic treasury inputs, not player-save reproduction',
  hashes,
  screenshotCaveat: 'Image 1 is turn 4 and image 2 is turn 2; their income values are not directly comparable as the same period.',
  leafCount: leaves.length,
  sourceTotals,
  before,
  officialDataHardLink: hard.summary.fiscal,
  officialDataConsumer: consumed.summary.fiscal,
  incomeWithoutReported,
  actualStockUnchanged: g.guoku.money,
  ledgerUnchanged: g.guoku.ledgers,
  reportedOnOriginalIncome: clone(reported),
  syntheticScreenshotScalar: {income: g.guoku.turnIncome, expense: g.guoku.turnExpense, net: g.guoku.turnIncome - g.guoku.turnExpense},
  passed: true,
}, null, 2));
