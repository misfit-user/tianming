#!/usr/bin/env node
'use strict';
// smoke-army-pay-retained — 本路军饷出存留（11-13 同志「按你推荐来」）
//   剧本给军写了 funding.localShare（本路自筹）的，地方那一份每回合从承付诸路的地方库扣：
//   承付之路由剧本写明（funding.regionIds 几路合用，或 funding.regionId 一路）；没写的不扣、也不按驻地去猜（旧档的军都没写，照旧）；
//   钱粮布各从地方库钱粮布出，同一组路下各军同比例；
//   不够的按军记在本路欠账上（钱粮布与折成的月数）；太仓只出朝廷那一份。
//   本路欠账对账写回军上、接军心、余钱还旧欠、截川纲、太仓代补（11-14）见 smoke-army-route-arrears-morale；本测试不载对账模块，只看存留这一步。
//   同一回合只扣一次；写了承付之路却在区划里找不到的记 missing，不扣不记欠。
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = process.env.TM_WEB_ROOT || path.resolve(__dirname, '..');
let A = 0;
function ok(c, m) { if (!c) throw new Error('FAIL: ' + m); A++; console.log('  ✓ ' + m); }
function near(a, b, m) { ok(Math.abs(a - b) < 0.01, m + '（得 ' + a + '，应 ' + b + '）'); }

console.log('smoke-army-pay-retained');
const res = (m, g, c) => ({ money: { stock: m, available: m, deficit: 0, quota: 0, used: 0 }, grain: { stock: g, available: g, deficit: 0, quota: 0, used: 0 }, cloth: { stock: c, available: c, deficit: 0, quota: 0, used: 0 } });
const led = (m, g, c) => ({ money: { stock: m, thisTurnIn: 0, thisTurnOut: 0 }, grain: { stock: g, thisTurnIn: 0, thisTurnOut: 0 }, cloth: { stock: c, thisTurnIn: 0, thisTurnOut: 0 } });
const leafOf = (id, name, m, g, c) => ({ id, name, publicTreasury: res(m, g, c), fiscal: { ledgers: led(m, g, c) } });
// 每兵每月钱 10、粮 2、布 0.1；一回合三十天
const army = (id, name, soldiers, funding, extra) => Object.assign({ id, name, faction: '宋', soldiers, monthlyMoneyPayPerSoldier: 10, monthlyGrainPayPerSoldier: 2, monthlyClothPayPerSoldier: 0.1, funding }, extra || {});
function fixture(opts) {
  opts = opts || {};
  const cfg = { fixedExpense: { salaryAnnualOverride: { money: 0, grain: 0, cloth: 0 } } };
  const G = {
    sid: 'army-retained', turn: 1, playerInfo: { factionName: '宋' }, fiscalConfig: cfg,
    guoku: { money: 100000, balance: 100000, grain: 100000, cloth: 10000 },
    neitang: { money: 1e6, balance: 1e6, grain: 1e5, cloth: 1e4 },
    chars: [], officeTree: [], facs: [{ id: '宋', name: '宋' }],
    armies: [
      army('xijun', '泾原西军', 100, { account: '陕西诸路', localShare: 1, regionIds: ['sx'] }, { garrisonRegionId: 'wz', payArrearsMonths: 0 }),
      army('wujie', '吴玠部', 300, { account: '陕西诸路', localShare: 1, regionIds: ['sx'] }, { garrisonRegionId: 'xy' }),
      army('dongjing', '东京留守司', 100, { account: '东京留守司', localShare: 1, regionId: 'jj' }, { garrisonRegionId: 'hz' }),
      army('half', '两浙半本路', 100, { account: '本路', localShare: 0.5, regionId: 'zj' }, { garrisonRegionId: 'hz', payArrearsMonths: 2 }),
      army('yijun', '义军', 1000, { account: '义军', selfSupplied: true }, { garrisonRegionId: 'kf' }),
      army('nopayer', '未写承付之路军', 100, { account: '本路', localShare: 1 }, { garrisonRegionId: 'hz', payArrearsMonths: 1 }),
      army('ghost', '承付之路已撤军', 100, { account: '本路', localShare: 1, regionId: 'gone' }),
      army('yuying', '御营', 100, { account: '御营' })
    ],
    adminHierarchy: { player: { divisions: [
      { id: 'sx', name: '陕西', children: [leafOf('jz', '京兆府', 500, 400, 20), leafOf('wz', '渭州', 1500, 1600, 60)] },
      { id: 'xy', name: '襄阳', children: [leafOf('xyf', '襄阳府', 9999, 9999, 99)] },
      { id: 'jj', name: '京畿', children: [leafOf('kf', '开封府', 0, 0, 0)] },
      { id: 'zj', name: '两浙', children: [leafOf('hz', '杭州', 5000, 5000, 100)] }
    ] } }
  };
  const c = {
    GM: G, P: { playerInfo: G.playerInfo, fiscalConfig: cfg, conf: { difficulty: opts.difficulty || '' } },
    Math, Date, JSON, Object, Array, String, Number, Boolean, RegExp, Error,
    console: { log() {}, warn() {}, error() {} }, _getDaysPerTurn: () => 30, setTimeout() {}, clearTimeout() {}, setInterval() {}, clearInterval() {},
    document: { addEventListener() {} }, SettlementPipeline: { register() {} }, EndTurnHooks: { register() {} }, GameHooks: { on() {}, register() {} },
    fetch() { throw Error('network forbidden'); }
  };
  c.window = c; c.globalThis = c;
  vm.createContext(c);
  ['tm-field-pipelines.js', 'tm-fiscal-statements.js', 'tm-public-treasury.js', 'tm-fiscal-engine.js', 'tm-fiscal-army-pay.js', 'tm-fiscal-local-expense.js']
    .forEach((f) => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), c, { filename: f }));
  return { c, G };
}
const leaf = (G, id) => {
  let hit = null;
  (function visit(list) { (list || []).forEach((n) => { if (hit) return; if (n.id === id) hit = n; else visit(n.children); }); })(G.adminHierarchy.player.divisions);
  return hit;
};
const stock = (G, id, k) => leaf(G, id).publicTreasury[k || 'money'].stock;
const armyOf = (G, id) => G.armies.find((a) => a.id === id);
const armySink = (G) => ((G.guoku.ledgers && G.guoku.ledgers.money && G.guoku.ledgers.money.sinks) || {})['军饷'] || 0;

// 1. 第一回合。陕西一组（西军驻渭州、吴玠部驻襄阳，都写明 regionIds 陕西）：应支钱 4000、粮 800、布 40；
//    陕西库银 2000（京兆 500、渭州 1500）只够一半，库粮 2000 够、库布 80 够。两军各欠半个月。
//    东京留守司写明京畿（驻杭州也不扣两浙）：京畿库空，全欠，记一个月。两浙半本路写明两浙：地方出一半（钱 500），太仓出一半。
//    义军自给，不扣；没写承付之路的驻杭州也不扣杭州、不记欠（旧档即如此）；写了却找不到的记 missing；御营全由太仓出。
{
  const { c, G } = fixture();
  const r = c.FixedExpense.collect({ game: G, turnDays: 30, force: true });
  ok(r && r.ok, '固定支出结完');
  const s = r.turnExpense.armyRetained;
  ok(s && s.armies === 4, '四军由本路出（西军、吴玠部、东京留守司、两浙半本路）：' + (s && s.armies));
  near(s.due.money, 4000 + 1000 + 500, '本路应支钱五千五百');
  near(s.paid.money, 2000 + 500, '实支：陕西二千、两浙五百');
  near(s.short.money, 2000 + 1000, '欠：陕西二千、京畿一千');
  near(stock(G, 'jz'), 0, '京兆府库银扣尽');
  near(stock(G, 'wz'), 0, '渭州库银扣尽');
  near(stock(G, 'jz', 'grain'), 400 - 160, '京兆府库粮按库存比例出 160');
  near(stock(G, 'wz', 'grain'), 1600 - 640, '渭州库粮出 640');
  near(stock(G, 'wz', 'cloth'), 60 - 30, '渭州库布出 30');
  near(leaf(G, 'wz').fiscal.ledgers.money.thisTurnOut, 1500, '区划财政账记本期出');
  near(stock(G, 'xyf'), 9999, '吴玠部驻襄阳，写明陕西出饷，襄阳不扣');
  near(stock(G, 'hz'), 4500, '两浙只出半本路那五百；东京留守司写明京畿、未写承付之路的驻杭州，都不扣杭州');
  near(stock(G, 'kf'), 0, '义军自给，开封不扣');
  ok(s.missing.length === 1 && s.missing[0] === '承付之路已撤军', '写了承付之路却找不到的记 missing：' + JSON.stringify(s.missing));
  near(armyOf(G, 'nopayer').payArrearsMonths, 1, '未写承付之路的军不记欠，原欠不动');
  near(armySink(G), 500 + 1000, '太仓军饷只出半本路那一半与御营');
  const L = G._armyRetained.byArmy;
  near(L.xijun.arrears.money, 500, '西军欠钱五百');
  near(L.wujie.arrears.money, 1500, '吴玠部欠钱一千五百（同比例）');
  near(L.xijun.arrears.grain, 0, '粮够不欠');
  near(L.dongjing.arrears.money, 1000, '东京留守司欠钱一千');
  near(L.dongjing.arrears.grain, 200, '东京留守司欠粮二百');
  near(L.xijun.months, 0.5, '西军记欠半个月');
  near(L.dongjing.months, 1, '东京留守司记欠一个月');
  near(Number(armyOf(G, 'xijun').payArrearsMonths) || 0, 0, '存留这一步本身不改西军的欠饷月数（对账在 TM.MilitaryArrears）');
  near(Number(armyOf(G, 'wujie').payArrearsMonths) || 0, 0, '存留这一步不改吴玠部欠饷月数');
  near(Number(armyOf(G, 'dongjing').payArrearsMonths) || 0, 0, '存留这一步不改东京留守司欠饷月数');
  near(armyOf(G, 'half').payArrearsMonths, 2, '半本路的军足额，原欠不动');
  ok(L.nopayer === undefined && L.ghost === undefined && L.yijun === undefined && L.yuying === undefined, '未写承付之路、找不到、自给、朝廷四军不进本路账');
  ok(L.xijun.regionIds.join() === 'sx' && L.dongjing.regionIds.join() === 'jj', '记明承付之路');
  ok(G._armyRetained.turn === 1, '记下扣的回合');

  // 2. 同一回合强制重结：太仓照重结，地方库不再扣、欠不翻倍
  c.FixedExpense.collect({ game: G, turnDays: 30, force: true });
  near(stock(G, 'wz', 'grain'), 960, '同回合重结不再扣渭州库粮');
  near(G._armyRetained.byArmy.dongjing.months, 1, '同回合重结记欠月数不翻倍');
  near(G._armyRetained.byArmy.dongjing.arrears.money, 1000, '同回合重结欠钱不翻倍');

  // 3. 第二回合：陕西库银已空，两军整月全欠；京畿仍空
  G.turn = 2;
  c.FixedExpense.collect({ game: G, turnDays: 30 });
  near(G._armyRetained.byArmy.xijun.months, 1.5, '西军第二回合再欠一个月，累计一个半月');
  near(G._armyRetained.byArmy.wujie.arrears.money, 1500 + 3000, '吴玠部欠钱累计');
  near(G._armyRetained.byArmy.dongjing.months, 2, '东京留守司累计两个月');
  near(Number(armyOf(G, 'xijun').payArrearsMonths) || 0, 0, '两回合下来存留这一步仍不改西军欠饷月数');
}

// 4. 叙事难度：本路那一份与太仓军饷同样按七成算
{
  const { c, G } = fixture({ difficulty: '叙事' });
  const r = c.FixedExpense.collect({ game: G, turnDays: 30, force: true });
  near(r.turnExpense.armyRetained.due.money, 5500 * 0.7, '叙事难度本路应支打七折');
}

// 5. 没有本路的军（旧档、未写 localShare 的剧本）：不建本路账，太仓照旧全出
{
  const { c, G } = fixture();
  G.armies = [army('a', '甲军', 100, null), army('b', '乙军', 100, { account: '年例' })];
  const r = c.FixedExpense.collect({ game: G, turnDays: 30, force: true });
  ok(!r.turnExpense.armyRetained, '没有本路的军就不走存留');
  ok(G._armyRetained === undefined, '不建本路账');
  near(armySink(G), 2000, '太仓照旧出两军全饷');
}

// 6. 旧档：军是开局时从剧本抄进存档的，有 localShare 而没写承付之路——不建本路账、地方库不动、欠饷月数不动，太仓也不替出
{
  const { c, G } = fixture();
  G.armies = [
    army('x', '泾原西军', 100, { account: '陕西五路', localShare: 1 }, { garrisonRegionId: 'wz', payArrearsMonths: 0 }),
    army('y', '御营', 100, { account: '御营' })
  ];
  const r = c.FixedExpense.collect({ game: G, turnDays: 30, force: true });
  ok(!r.turnExpense.armyRetained, '旧档不走存留');
  ok(G._armyRetained === undefined, '旧档不建本路账');
  near(stock(G, 'wz'), 1500, '旧档渭州库银不动');
  near(armyOf(G, 'x').payArrearsMonths, 0, '旧档欠饷月数不动');
  near(armySink(G), 1000, '太仓只出御营，本路那份照旧不替出');
}

console.log('PASS army-pay-retained ' + A + ' assertions');
