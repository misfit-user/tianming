#!/usr/bin/env node
'use strict';
// smoke-army-pay-accounts — 军饷按军、按户头出账，短发按军记欠（11-11，甲乙合拆）
//   原先天启军饷是一笔一千二百万两的总额，短发只记一笔不分军的「军饷_欠」，各军欠饷月数从不随实欠涨，
//   欠饷扣军心那条线接不上真账；卫所总览一百三十万屯军也照月饷一两五钱算进太仓与开局旧欠（七百八十万）。
//   写明出饷户头（army.funding）的军：太仓那一份按户头出账；库里不够时各军同比例少发，短的按军记欠；
//   屯军自给（selfSupplied）、地方出饷（localShare:1）的不进太仓，开局所欠也不记太仓；没写户头的军照旧一笔总扣。
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = process.env.TM_WEB_ROOT || path.resolve(__dirname, '..');
let A = 0;
function ok(c, m) { if (!c) throw new Error('FAIL: ' + m); A++; console.log('  ✓ ' + m); }
function near(a, b, m) { ok(Math.abs(a - b) < 0.01, m + '（得 ' + a + '，应 ' + b + '）'); }

console.log('smoke-army-pay-accounts');
const res = (m, g, c) => ({ money: { stock: m, available: m, deficit: 0, thisTurnIn: 0, thisTurnOut: 0 }, grain: { stock: g, available: g, deficit: 0, thisTurnIn: 0, thisTurnOut: 0 }, cloth: { stock: c, available: c, deficit: 0, thisTurnIn: 0, thisTurnOut: 0 } });
function fixture(stock, armies, extraCfg) {
  const cfg = Object.assign({
    fixedExpense: { armyMonthlyPay: { money: 1.5, grain: 0.6, cloth: 0.05 }, salaryAnnualOverride: { money: 0, grain: 0, cloth: 0 } },
    neicangRules: { royalClanPressure: { enabled: true, annualStipendPaid: 300, paidFrom: '存留' } }
  }, extraCfg || {});
  const G = {
    sid: 'acct', turn: 1, playerInfo: { factionName: '明' }, fiscalConfig: cfg,
    guoku: { money: stock, balance: stock, grain: 10000, cloth: 0, ledgers: res(stock, 10000, 0) },
    neitang: { money: 1e7, balance: 1e7, grain: 1e6, cloth: 1e5 },
    armies, chars: [], officeTree: [], facs: [{ id: '明', name: '明' }], adminHierarchy: { player: { divisions: [] } }
  };
  const c = {
    GM: G, P: { playerInfo: G.playerInfo, fiscalConfig: cfg }, Math, Date, JSON, Object, Array, String, Number, Boolean, RegExp, Error,
    console: { log() {}, warn() {}, error() {} }, _getDaysPerTurn: () => 30, setTimeout() {}, clearTimeout() {}, setInterval() {}, clearInterval() {},
    document: { addEventListener() {} }, SettlementPipeline: { register() {} }, EndTurnHooks: { register() {} }, GameHooks: { on() {}, register() {} },
    fetch() { throw Error('network forbidden'); }
  };
  c.window = c; c.globalThis = c;
  vm.createContext(c);
  ['tm-field-pipelines.js', 'tm-fiscal-statements.js', 'tm-public-treasury.js', 'tm-fiscal-engine.js', 'tm-military.js', 'tm-military-arrears.js']
    .forEach((f) => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), c, { filename: f }));
  return { c, G };
}
function mingArmies() {
  return [
    { id: 'liao', name: '关宁军', faction: '明', soldiers: 1000, morale: 60, loyalty: 60, monthlyMoneyPayPerSoldier: 3, monthlyGrainPayPerSoldier: 0, monthlyClothPayPerSoldier: 0, funding: { account: '辽饷' } },
    { id: 'bian', name: '宣府镇', faction: '明', soldiers: 2000, morale: 60, loyalty: 60, monthlyMoneyPayPerSoldier: 1.5, monthlyGrainPayPerSoldier: 0, monthlyClothPayPerSoldier: 0, funding: { account: '年例' } },
    { id: 'jing', name: '京营', faction: '明', soldiers: 500, morale: 60, loyalty: 60, monthlyMoneyPayPerSoldier: 0, monthlyGrainPayPerSoldier: 1, monthlyClothPayPerSoldier: 0, funding: { account: '京营' } },
    { id: 'tun', name: '卫所', faction: '明', soldiers: 100000, morale: 32, loyalty: 60, payArrearsMonths: 4, funding: { account: '屯田', selfSupplied: true } },
    { id: 'nan', name: '南京营', faction: '明', soldiers: 1000, morale: 35, loyalty: 60, payArrearsMonths: 1, funding: { account: '南京户部', localShare: 1 } }
  ];
}
const sinks = (G, k) => G.guoku.ledgers[k].sinks || {};
const rows = (G) => (G.guoku.ledgers.money.deficitDetails || {}).junxiang || [];
// 帑廪册「军饷」一项的细目：按户头
const account = (G, k, name) => (((G.guoku.ledgers[k].sinkDetails || {}).junxiang || []).find((r) => r.name === name) || {}).amount || 0;

// 1. 库银够：各户头足额出账；屯军、南京营不进太仓；宗禄出存留，太仓不出
{
  const { c, G } = fixture(10000, mingArmies());
  c.MilitarySystems.initializeArmyArrears({ game: G });
  near(G.guoku.ledgers.money.deficit, 0, '开局：屯军四个月、南京营一个月的旧欠都不记太仓');
  const r = c.FixedExpense.collect({ game: G, turnDays: 30, force: true });
  ok(r && r.ok, '固定支出结算成功');
  near(account(G, 'money', '辽饷'), 3000, '辽饷户头：关宁军一千人×三两');
  near(account(G, 'money', '年例'), 3000, '年例户头：宣府镇两千人×一两五');
  near(sinks(G, 'money')['军饷'], 6000, '帑廪册「军饷」一项合计六千（屯军十万、南京营不进太仓）');
  near(account(G, 'grain', '京营'), 500, '京营户头：月粮五百石出京仓');
  ok(!sinks(G, 'money')['宗禄'] && !sinks(G, 'grain')['宗禄'], '宗禄出存留，太仓不出');
  near(G.guoku.ledgers.money.deficit, 0, '足额：不记欠');
}

// 2. 库银只够一半：各军同比例少发，短的按军记欠；欠饷月数随实欠涨，扣军心一次
{
  const { c, G } = fixture(3000, mingArmies());
  c.MilitarySystems.initializeArmyArrears({ game: G });
  c.FixedExpense.collect({ game: G, turnDays: 30, force: true });
  near(sinks(G, 'money')['军饷'], 3000, '库里三千全发出');
  near(sinks(G, 'money')['军饷_欠'], 3000, '短的三千记「军饷_欠」（破产「军饷断裂」认这一项）');
  const byArmy = {}; rows(G).forEach((r) => { byArmy[r.subject && r.subject.id] = r.amount; });
  near(byArmy.liao, 1500, '关宁军短一千五，记在关宁军名下');
  near(byArmy.bian, 1500, '宣府镇短一千五，记在宣府镇名下');
  near(G.guoku.ledgers.money.deficit, 3000, '帑廪欠项合计三千');
  const liao = G.armies[0], tun = G.armies[3];
  c.MilitarySystems.applyPayArrearsPressure(liao, { source: 'smoke' }, G);
  c.MilitarySystems.applyPayArrearsPressure(tun, { source: 'smoke' }, G);
  ok(liao.payArrearsMonths === 1 && liao.morale === 50, '关宁军按实欠算出欠饷一个月，士气扣十（60→50）');
  ok(tun.morale === 32, '屯军开局所欠是底子，不扣');
}

// 3. 开局旧欠只记太仓出饷的军
{
  const armies = mingArmies(); armies[0].payArrearsMonths = 2;
  const { c, G } = fixture(10000, armies);
  c.MilitarySystems.initializeArmyArrears({ game: G });
  near(G.guoku.ledgers.money.deficit, 6000, '关宁军开局欠两个月记六千（屯军、南京营不记）');
}

// 4. 没写户头的军（绍宋式）照旧一笔总扣、不分军记欠
{
  const armies = [{ id: 'x', name: '御营中军', faction: '明', soldiers: 1000, morale: 60, monthlyMoneyPayPerSoldier: 4, monthlyGrainPayPerSoldier: 0, monthlyClothPayPerSoldier: 0 }];
  const { c, G } = fixture(1000, armies);
  c.FixedExpense.collect({ game: G, turnDays: 30, force: true });
  near(sinks(G, 'money')['军饷'], 1000, '没写户头：照旧记在「军饷」一笔');
  near(sinks(G, 'money')['军饷_欠'], 3000, '短的照旧记「军饷_欠」');
  ok(rows(G).length === 0, '不分军记欠');
}

// 5. 屯军、地方出饷的军开局带着欠饷月数：补饷照常返回、不动库、写明缘由
//    （初版报账簿不全，下诏「补发全部欠饷」整道诏书抛错、发饷按钮报「补饷未能交割」）
{
  const { c, G } = fixture(10000, mingArmies());
  c.MilitarySystems.initializeArmyArrears({ game: G });
  const tun = G.armies[3], nan = G.armies[4];
  const r1 = c.MilitarySystems.settleArmyArrears(tun, { game: G });
  ok(r1 && r1.ok && r1.skipped && r1.monthsCleared === 0 && /屯军自给/.test(r1.note || ''), '屯军补饷：照常返回、写明屯军自给');
  const r2 = c.MilitarySystems.settleArmyArrears(nan, { game: G });
  ok(r2 && r2.ok && r2.skipped && r2.monthsCleared === 0 && /地方存留/.test(r2.note || ''), '南京营补饷：照常返回、写明地方出饷');
  near(G.guoku.ledgers.money.stock, 10000, '太仓分文未动');
}

// 6. 1.3.5.3 以前开局的旧档（存档里没有整份财政配置）：照剧本 legacyTaxConfig 写明的军饷总额与宗禄出太仓
{
  const armies = mingArmies().map((a) => { const b = Object.assign({}, a); delete b.funding; return b; });
  const { c, G } = fixture(1e7, armies);
  G.sid = 'tq'; G.fiscalConfig = { taxes: {} }; G._isFreshNewGame = false; c.P.fiscalConfig = undefined;
  const scnFc = {
    productionTaxVersion: 1,
    fixedExpense: { armyMonthlyPay: { money: 1.5, grain: 0.6, cloth: 0.05 } },
    neicangRules: { royalClanPressure: { enabled: true, annualStipendPaid: 300, paidFrom: '存留' } },
    legacyTaxConfig: {
      fixedExpense: { armyMonthlyPay: { money: 1.5, grain: 0.6, cloth: 0.05 }, armyAnnualOverride: { money: 12000000, grain: 0, cloth: 0 } },
      neicangRules: { royalClanPressure: { enabled: true, annualStipendPaid: 300 } }
    }
  };
  c.findScenarioById = (id) => (id === 'tq' ? { id: 'tq', fiscalConfig: scnFc } : null);
  c.FixedExpense.collect({ game: G, turnDays: 30, force: true });
  near(sinks(G, 'money')['军饷'], Math.round(12000000 * 30 / 365 * 100) / 100, '旧档军饷照原额一千二百万折月（不按每兵月饷重算）');
  const royal = ['money', 'grain'].reduce((s, k) => s + (sinks(G, k)['宗禄'] || 0) + (sinks(G, k)['宗禄_欠'] || 0), 0);
  ok(royal > 0, '旧档宗禄照旧出太仓');
}

// 7. 剧本里旧档口径在：天启 legacyTaxConfig 留着改前的军饷总额与宗禄
{
  const sc = JSON.parse(fs.readFileSync(path.join(ROOT, '..', 'scenarios', '天启七年·九月（官方）.json'), 'utf8'));
  const legacy = sc.fiscalConfig.legacyTaxConfig || {};
  ok(legacy.fixedExpense && legacy.fixedExpense.armyAnnualOverride && legacy.fixedExpense.armyAnnualOverride.money === 12000000, '天启 legacyTaxConfig 留着军饷总额一千二百万');
  ok(legacy.neicangRules && legacy.neicangRules.royalClanPressure && !legacy.neicangRules.royalClanPressure.paidFrom, '天启 legacyTaxConfig 宗禄照旧出太仓');
  ok(!sc.fiscalConfig.fixedExpense.armyAnnualOverride, '新开局不再有军饷总额');
}

console.log('\n结果: ' + A + ' 通过 / 0 失败');
