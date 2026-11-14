#!/usr/bin/env node
'use strict';
// smoke-army-route-arrears-morale — 本路欠饷接军心（11-14 同志「按你推荐来」）
//   剧本写明承付之路的军，地方那一份付不足记在本路账（G._armyRetained.byArmy）；本片起：
//   ① 欠饷月数＝太仓账＋本路账，对账后写回军上（取整给界面与推演看）；本路账按全饷折（本路只出一半的，欠一个月只算半个月）。
//   ② 军务按本路新欠下的月数扣军心（每月士气十、忠诚五），按本路余钱还掉的月数回军心（同补饷：士气四、忠诚二、兵变险十）。
//   ③ 本路当月饷都付完还有余钱粮布的，先还旧欠，月数按钱粮里还剩多的那项同比例减。
//   ④ 截川纲：军写了 interceptRegionIds 的，本路钱不够时从那几路本回合起运到太仓的钱里截，最多截到起运数，太仓不透支。
//   ⑤ 补饷（诏书、发饷按钮）对本路所欠由太仓代补，太仓有多少补多少、不欠新账。
//   ⑥ 开局剧本所欠、旧档已有的欠饷月数第一次对账时记进本路账作既欠，不扣军心；旧档本路账已记的，接上时当作已扣。
//   ⑦ 老「三系统」每回合白减一月对写明承付之路的军不再管，别的军照旧。
//   ⑧ 本色不足支折色：军写了折色价（funding.grainCommute）的，库粮不够的月粮照价改支银；余银还旧欠时粮欠也照价折还。
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = process.env.TM_WEB_ROOT || path.resolve(__dirname, '..');
let A = 0;
function ok(c, m) { if (!c) throw new Error('FAIL: ' + m); A++; console.log('  ✓ ' + m); }
function near(a, b, m) { ok(Math.abs(a - b) < 0.01, m + '（得 ' + a + '，应 ' + b + '）'); }

console.log('smoke-army-route-arrears-morale');
const res = (m, g, c) => ({ money: { stock: m, available: m, deficit: 0, quota: 0, used: 0 }, grain: { stock: g, available: g, deficit: 0, quota: 0, used: 0 }, cloth: { stock: c, available: c, deficit: 0, quota: 0, used: 0 } });
const led = (m, g, c) => ({ money: { stock: m, thisTurnIn: 0, thisTurnOut: 0 }, grain: { stock: g, thisTurnIn: 0, thisTurnOut: 0 }, cloth: { stock: c, thisTurnIn: 0, thisTurnOut: 0 } });
const leafOf = (id, name, m, g, c, remit) => Object.assign({ id, name, publicTreasury: res(m, g, c), fiscal: Object.assign({ ledgers: led(m, g, c) }, remit || {}) });
// 每兵每月钱 10、粮 2、布 0.1；一回合三十天
const army = (id, name, soldiers, funding, extra) => Object.assign({ id, name, faction: '宋', soldiers, monthlyMoneyPayPerSoldier: 10, monthlyGrainPayPerSoldier: 2, monthlyClothPayPerSoldier: 0.1, morale: 60, loyalty: 60, mutinyRisk: 30, funding }, extra || {});
const SX = { account: '陕西诸路', localShare: 1, regionIds: ['sx'] };

function fixture(armies, divisions, opts) {
  opts = opts || {};
  const cfg = { fixedExpense: { salaryAnnualOverride: { money: 0, grain: 0, cloth: 0 } } };
  const G = {
    sid: 'route-arrears', turn: 1, playerInfo: { factionName: '宋' }, fiscalConfig: cfg,
    guoku: { money: opts.guokuMoney != null ? opts.guokuMoney : 100000, balance: opts.guokuMoney != null ? opts.guokuMoney : 100000, grain: opts.guokuGrain != null ? opts.guokuGrain : 100000, cloth: 10000 },
    neitang: { money: 1e6, balance: 1e6, grain: 1e5, cloth: 1e4 },
    chars: [], officeTree: [], facs: [{ id: '宋', name: '宋', money: 100 }],
    armies, adminHierarchy: { player: { divisions } }, _militaryPayArrearsLog: []
  };
  const c = {
    GM: G, P: { playerInfo: G.playerInfo, fiscalConfig: cfg, conf: { difficulty: '' } }, TM: {}, scriptData: {},
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
const leaf = (G, id) => {
  let hit = null;
  (function visit(list) { (list || []).forEach((n) => { if (hit) return; if (n.id === id) hit = n; else visit(n.children); }); })(G.adminHierarchy.player.divisions);
  return hit;
};
const stock = (G, id, k) => leaf(G, id).publicTreasury[k || 'money'].stock;
const setStock = (G, id, k, v) => { const d = leaf(G, id); d.publicTreasury[k].stock = v; d.publicTreasury[k].available = v; d.fiscal.ledgers[k].stock = v; };
const armyOf = (G, id) => G.armies.find((a) => a.id === id);
const rec = (G, id) => G._armyRetained.byArmy[id];
const sink = (G, tag) => ((G.guoku.ledgers && G.guoku.ledgers.money && G.guoku.ledgers.money.sinks) || {})[tag] || 0;
const collect = (c, G) => c.FixedExpense.collect({ game: G, turnDays: 30, force: true });
const pressure = (MS, G) => G.armies.forEach((a) => MS.applyPayArrearsPressure(a, { source: 'smoke' }, G));

// 1. 陕西库银只够一半：两军各欠半个月，对账写回欠饷月数；下回合按新欠半个月扣军心，同回合再算不重扣
{
  const { c, G, MS, MA } = fixture(
    [army('xijun', '泾原西军', 100, SX), army('wujie', '吴玠部', 300, SX)],
    [{ id: 'sx', name: '陕西', children: [leafOf('jz', '京兆府', 500, 4000, 100), leafOf('wz', '渭州', 1500, 4000, 100)] }]);
  ok(MA && typeof MA.routeView === 'function' && typeof MA.isRouteFunded === 'function', '本路账读口就绪');
  MS.initializeArmyArrears({ game: G });
  ok(armyOf(G, 'xijun')._routeAccruedSeen === 0 && armyOf(G, 'xijun')._payArrearsAppliedMonths === 0, '开局记下已看过的本路欠下月数（零）');
  collect(c, G);
  near(rec(G, 'xijun').months, 0.5, '西军本路欠半个月');
  near(rec(G, 'xijun').accruedMonths, 0.5, '累计欠下半个月');
  near(MA.routeView({ game: G, army: armyOf(G, 'wujie') }).months, 0.5, '读口给出本路欠半个月');
  ok(armyOf(G, 'xijun').payArrearsMonths === 1 && armyOf(G, 'wujie').payArrearsMonths === 1, '对账写回军上欠饷月数（半个月取整为一）');
  G.turn = 2;
  pressure(MS, G);
  ok(armyOf(G, 'xijun').morale === 55, '新欠半个月扣士气五（60→55）：' + armyOf(G, 'xijun').morale);
  ok(armyOf(G, 'xijun').loyalty === 58, '忠诚扣二点五（60→58，取整）：' + armyOf(G, 'xijun').loyalty);
  const log = G._militaryPayArrearsLog.find((x) => x.army === '泾原西军');
  near(log.newMonths, 0.5, '扣饷记一笔，新欠半个月');
  pressure(MS, G);
  ok(armyOf(G, 'xijun').morale === 55, '同回合再算不重扣');

  // 2. 本路进了钱：当月付足，余钱先还旧欠，月数清零、累计还掉半个月；下回合按还掉的半个月回军心
  setStock(G, 'jz', 'money', 10000);
  collect(c, G);
  near(rec(G, 'xijun').arrears.money, 0, '西军旧欠钱还清');
  near(rec(G, 'wujie').arrears.money, 0, '吴玠部旧欠钱还清');
  near(rec(G, 'xijun').months, 0, '欠的月数清零');
  near(rec(G, 'xijun').repaidMonths, 0.5, '累计还掉半个月');
  near(G._armyRetained.last.repaid.money, 2000, '本回合拿余钱还旧欠两千');
  near(stock(G, 'jz') + stock(G, 'wz'), 10000 - 4000 - 2000, '库银先付当月四千、再还旧欠两千');
  ok(armyOf(G, 'xijun').payArrearsMonths === 0, '欠饷月数写回为零');
  G.turn = 3;
  pressure(MS, G);
  ok(armyOf(G, 'xijun').morale === 57, '还掉半个月回士气二（55→57）：' + armyOf(G, 'xijun').morale);
  ok(armyOf(G, 'xijun').loyalty === 59, '回忠诚一（58→59）');
  ok(armyOf(G, 'xijun').mutinyRisk === 25, '兵变险减五（30→25）');
  pressure(MS, G);
  ok(armyOf(G, 'xijun').morale === 57, '还掉的不重复回');

  // 3. 同回合强制重结：不再扣库、不再还、不再记
  const before = stock(G, 'jz');
  G.turn = 3; collect(c, G); collect(c, G);
  near(stock(G, 'jz'), before - 4000, '同回合两次结算只扣一回当月饷');
}

// 4. 本路只出一半的军：本路那份全欠一个月，只算欠半个月
{
  const { c, G, MS } = fixture(
    [army('half', '两浙半本路', 100, { account: '本路', localShare: 0.5, regionId: 'jj' })],
    [{ id: 'jj', name: '京畿', children: [leafOf('kf', '开封府', 0, 0, 0)] }]);
  MS.initializeArmyArrears({ game: G });
  collect(c, G);
  near(rec(G, 'half').arrears.money, 500, '本路那份欠钱五百');
  near(rec(G, 'half').months, 0.5, '按全饷折只算半个月');
}

// 5. 截川纲：陕西库空，从川峡本回合起运到太仓的钱里截——只认本回合征过的府，最多截到起运数
{
  const SXC = Object.assign({}, SX, { interceptRegionIds: ['cx'] });
  const { c, G, MS } = fixture(
    [army('xijun', '泾原西军', 100, SXC), army('wujie', '吴玠部', 300, SXC)],
    [{ id: 'sx', name: '陕西', children: [leafOf('jz', '京兆府', 0, 4000, 100)] },
      { id: 'cx', name: '川峡', children: [leafOf('cd', '成都府', 0, 0, 0, { _thisTurnRemitMoney: 1500, _thisTurnRemitTurn: 1 }), leafOf('cq', '重庆府', 0, 0, 0, { _thisTurnRemitMoney: 1000, _thisTurnRemitTurn: 0 })] }]);
  MS.initializeArmyArrears({ game: G });
  const r = collect(c, G);
  near(r.turnExpense.armyRetained.intercepted, 1500, '截川纲一千五百（重庆府是上回合的起运数，不算）');
  near(sink(G, '截川纲'), 1500, '太仓钱账记「截川纲」');
  near(G.guoku.money, 100000 - 1500, '太仓少了截去的数');
  near(rec(G, 'xijun').arrears.money, 1000 - 375, '西军欠钱按截后同比例：一千里付了三成七五');
  near(rec(G, 'xijun').months, 0.625, '截后欠六成二五个月');
  collect(c, G);
  near(sink(G, '截川纲'), 1500, '同回合重结不再截');
}
{
  const SXC = Object.assign({}, SX, { interceptRegionIds: ['cx'] });
  const { c, G } = fixture(
    [army('xijun', '泾原西军', 100, SXC)],
    [{ id: 'sx', name: '陕西', children: [leafOf('jz', '京兆府', 0, 4000, 100)] },
      { id: 'cx', name: '川峡', children: [leafOf('cd', '成都府', 0, 0, 0, { _thisTurnRemitMoney: 5000, _thisTurnRemitTurn: 1 })] }],
    { guokuMoney: 300 });
  collect(c, G);
  near(G._armyRetained.last.intercepted, 300, '太仓只剩三百就只截三百');
  ok(!(G.guoku.ledgers.money.deficit > 0) && !sink(G, '截川纲_欠'), '截川纲不把太仓扣成欠');
}

// 6. 补饷由太仓代补本路所欠：补足回军心；太仓钱不够补多少算多少，不欠新账
{
  const { c, G, MS } = fixture(
    [army('xijun', '泾原西军', 100, SX)],
    [{ id: 'sx', name: '陕西', children: [leafOf('jz', '京兆府', 0, 0, 0)] }]);
  MS.initializeArmyArrears({ game: G });
  collect(c, G);
  near(rec(G, 'xijun').months, 1, '库空全欠一个月');
  G.turn = 2; pressure(MS, G);
  ok(armyOf(G, 'xijun').morale === 50, '欠一个月扣士气十');
  const r = MS.settleArmyArrears(armyOf(G, 'xijun'), { game: G });
  ok(r.ok && Math.abs(r.monthsCleared - 1) < 0.01, '补饷清本路所欠一个月：' + JSON.stringify(r.monthsCleared));
  near(r.paid.money, 1000, '太仓出钱一千');
  near(rec(G, 'xijun').months, 0, '本路账清零');
  ok(armyOf(G, 'xijun').payArrearsMonths === 0, '欠饷月数写回为零');
  ok(armyOf(G, 'xijun').morale === 54, '补饷回士气四（50→54）');
  G.turn = 3; pressure(MS, G);
  ok(armyOf(G, 'xijun').morale === 54, '太仓代补的不再由本路还旧欠那头重复回');
}
{
  const { c, G, MS } = fixture(
    [army('xijun', '泾原西军', 100, SX)],
    [{ id: 'sx', name: '陕西', children: [leafOf('jz', '京兆府', 0, 0, 0)] }],
    { guokuMoney: 300 });
  MS.initializeArmyArrears({ game: G });
  collect(c, G);
  G.guoku.money = 300; G.guoku.balance = 300; G.guoku.ledgers.money.stock = 300;
  const r = MS.settleArmyArrears(armyOf(G, 'xijun'), { game: G });
  near(r.paid.money, 300, '太仓只剩三百就补三百');
  near(rec(G, 'xijun').arrears.money, 700, '本路还欠七百');
  near(rec(G, 'xijun').months, 0.7, '粮补足了，月数照钱里还剩的七成算');
  ok(!(G.guoku.ledgers.money.deficit > 0), '补饷不把太仓扣成欠');
}

// 7. 开局剧本所欠：记进本路账作既欠、不扣军心；本路有余钱就还，还了回军心
{
  const { c, G, MS } = fixture(
    [army('fj', '福建水师', 100, { account: '存留', localShare: 1, regionId: 'fjl' }, { payArrearsMonths: 2 })],
    [{ id: 'fjl', name: '福建', children: [leafOf('fz', '福州', 100000, 100000, 1000)] }]);
  MS.initializeArmyArrears({ game: G });
  near(rec(G, 'fj').months, 2, '开局所欠两个月记进本路账');
  near(rec(G, 'fj').arrears.money, 2000, '按月饷折钱两千');
  ok(armyOf(G, 'fj').payArrearsMonths === 2, '欠饷月数仍是两个月');
  G.turn = 1; pressure(MS, G);
  ok(armyOf(G, 'fj').morale === 60, '开局所欠不扣军心');
  collect(c, G);
  near(rec(G, 'fj').months, 0, '本路有余钱，开局所欠还清');
  G.turn = 2; pressure(MS, G);
  ok(armyOf(G, 'fj').morale === 68, '还掉两个月回士气八（60→68）：' + armyOf(G, 'fj').morale);
  ok(armyOf(G, 'fj').mutinyRisk === 10, '兵变险减二十（30→10）');
}

// 8. 11-13 存的旧档：本路账已记、军上没有已看过的记号——接上时当作已扣，不一次扣下；此后新欠照扣
{
  const { c, G, MS } = fixture(
    [army('xijun', '泾原西军', 100, SX, { payArrearsMonths: 0, _payArrearsAppliedMonths: 0 })],
    [{ id: 'sx', name: '陕西', children: [leafOf('jz', '京兆府', 0, 0, 0)] }]);
  G._armyRetained = { turn: 0, byArmy: { xijun: { name: '泾原西军', arrears: { money: 1500, grain: 300, cloth: 15 }, months: 1.5, regionIds: ['sx'] } } };
  G.turn = 1; pressure(MS, G);
  ok(armyOf(G, 'xijun').morale === 60, '旧档已记的一个半月不一次扣下');
  ok(armyOf(G, 'xijun').payArrearsMonths === 2, '欠饷月数写回（一个半月取整为二）');
  collect(c, G);
  near(rec(G, 'xijun').accruedMonths, 2.5, '旧账补上累计欠下，再欠一个月');
  G.turn = 2; pressure(MS, G);
  ok(armyOf(G, 'xijun').morale === 50, '此后新欠一个月照扣十');
}

// 9. 老「三系统」每回合白减一月：写明承付之路的军不再管，别的军照旧
{
  // 旧档（开局在本片之前、已记过开局底子）：军上欠两个月、还没对过本路账——三系统回合更新先跑，不能先白减一月再记进本路账
  const { c, G } = fixture(
    [army('xijun', '泾原西军', 100, SX, { payArrearsMonths: 2, controlLevel: 20, _payArrearsAppliedMonths: 2 })],
    [{ id: 'sx', name: '陕西', children: [leafOf('jz', '京兆府', 0, 0, 0)] }]);
  let loaded = true;
  try { vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-three-systems-ext.js'), 'utf8'), c, { filename: 'tm-three-systems-ext.js' }); }
  catch (e) { loaded = false; console.log('  （三系统模块装不进测试环境：' + e.message + '）'); }
  ok(loaded && c.ThreeSystemsExt && typeof c.ThreeSystemsExt.updateMilitaryState === 'function', '三系统军务回合更新可调');
  // 对照：没写承付之路、太仓账上也没有它欠账的旧档军（有账的军月数照账走，白减了也会被对回去）
  G.armies.push(army('old', '旧档军', 100, null, { payArrearsMonths: 2, controlLevel: 20, _payArrearsAppliedMonths: 2 }));
  c.ThreeSystemsExt.updateMilitaryState();
  near(rec(G, 'xijun').months, 2, '写明承付之路的军不白减，两个月整记进本路账');
  ok(armyOf(G, 'xijun').payArrearsMonths === 2 && armyOf(G, 'xijun').morale === 60, '欠饷月数仍两个月、不扣军心');
  ok(armyOf(G, 'old').payArrearsMonths === 1, '没写承付之路、也没欠账的军照旧每回合减一月');
}

// 10. 本色不足支折色：写了折色价（funding.grainCommute）的军，库粮不够的月粮照价改支银；没写的军照旧按粮记欠
{
  const SC = (extra) => Object.assign({ account: '存留', localShare: 1, regionId: 'sc' }, extra || {});
  const { c, G, MS } = fixture(
    [army('bgb', '白杆兵', 100, SC({ grainCommute: 0.5 })), army('lb', '狼兵', 100, SC())],
    [{ id: 'sc', name: '四川', children: [leafOf('cd', '成都府', 5000, 0, 100)] }]);
  MS.initializeArmyArrears({ game: G });
  collect(c, G);
  const last = G._armyRetained.last;
  near(last.commuted.grain, 200, '白杆兵月粮二百石库粮全无，全数折色');
  near(last.commuted.money, 100, '折色每石五钱，出银一百');
  near(stock(G, 'cd'), 5000 - 2000 - 100, '库银付两军饷钱二千、白杆兵折色一百');
  near(rec(G, 'bgb').months, 0, '折色付足，白杆兵不欠');
  near(rec(G, 'bgb').arrears.grain, 0, '白杆兵不欠粮');
  near(rec(G, 'lb').months, 1, '没写折色价的狼兵照旧欠粮一个月');
  near(rec(G, 'lb').arrears.grain, 200, '狼兵欠粮二百石');
  near(last.short.grain, 200, '本回合短粮只算狼兵的二百石');
}
{
  const { c, G, MS } = fixture(
    [army('bgb', '白杆兵', 100, { account: '存留', localShare: 1, regionId: 'sc', grainCommute: 0.5 })],
    [{ id: 'sc', name: '四川', children: [leafOf('cd', '成都府', 550, 0, 100)] }]);
  MS.initializeArmyArrears({ game: G });
  collect(c, G);
  near(G._armyRetained.last.paid.money, 500, '库银五百五只够一半：饷钱付五百');
  near(G._armyRetained.last.commuted.money, 50, '折色付五十');
  near(rec(G, 'bgb').arrears.money, 500, '欠饷钱五百');
  near(rec(G, 'bgb').arrears.grain, 100, '折色短发的一百石仍按粮记欠');
  near(rec(G, 'bgb').months, 0.5, '欠半个月');
  G.turn = 2; pressure(MS, G);
  ok(armyOf(G, 'bgb').morale === 55, '新欠半个月扣士气五');
  // 下回合库银充裕：当月付足，余银先还旧欠饷钱，粮欠库粮还不上的照价折还
  setStock(G, 'cd', 'money', 10000);
  collect(c, G);
  near(G._armyRetained.last.repaid.money, 500, '余银还旧欠饷钱五百');
  near(G._armyRetained.last.repaidCommuted.grain, 100, '旧欠粮一百石折色还清');
  near(G._armyRetained.last.repaidCommuted.money, 50, '折还出银五十');
  near(stock(G, 'cd'), 10000 - 1100 - 500 - 50, '库银：当月一千一百、旧欠五百、折还五十');
  near(rec(G, 'bgb').months, 0, '旧欠清零');
  near(rec(G, 'bgb').repaidMonths, 0.5, '累计还掉半个月');
  G.turn = 3; pressure(MS, G);
  ok(armyOf(G, 'bgb').morale === 57, '还掉半个月回士气二（55→57）：' + armyOf(G, 'bgb').morale);
}

console.log('PASS army-route-arrears-morale ' + A + ' assertions');
