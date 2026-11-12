#!/usr/bin/env node
'use strict';
// smoke-royal-stipend-retained — 宗禄出存留（11-12 同志「按推荐来」）
//   剧本写明宗禄出存留并给各布政司份额（byRegion）：每回合宗禄岁额按回合天数折算、按份额分到各司，从该司下各府地方库扣——
//   本色出库粮，库粮不够的本色与折色都照石折银从库银出，各府按库存多少分摊；银粮都不够的折成石记该司欠禄。太仓不出宗禄。
//   同一回合只扣一次；没写 byRegion 的（11-11 后、11-12 前开局的存档）照旧不扣；叙事难度宗禄减半与太仓宗禄同。
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = process.env.TM_WEB_ROOT || path.resolve(__dirname, '..');
let A = 0;
function ok(c, m) { if (!c) throw new Error('FAIL: ' + m); A++; console.log('  ✓ ' + m); }
function near(a, b, m) { ok(Math.abs(a - b) < 0.01, m + '（得 ' + a + '，应 ' + b + '）'); }

console.log('smoke-royal-stipend-retained');
const res = (m, g) => ({ money: { stock: m, available: m, deficit: 0, quota: 0, used: 0 }, grain: { stock: g, available: g, deficit: 0, quota: 0, used: 0 }, cloth: { stock: 0, available: 0, deficit: 0, quota: 0, used: 0 } });
const led = (m, g) => ({ money: { stock: m, thisTurnIn: 0, thisTurnOut: 0 }, grain: { stock: g, thisTurnIn: 0, thisTurnOut: 0 }, cloth: { stock: 0, thisTurnIn: 0, thisTurnOut: 0 } });
const BY_REGION = [{ regionId: 'sx', name: '山西', share: 0.75 }, { regionId: 'sn', name: '陕西', share: 0.25 }];
// 岁额 3.65 万石：一回合三十天 = 三千石
function fixture(opts) {
  opts = opts || {};
  const rcp = { enabled: true, annualStipendPaid: 3.65, paidFrom: '存留' };
  if (opts.byRegion !== false) rcp.byRegion = BY_REGION;
  const cfg = {
    fixedExpense: { armyMonthlyPay: { money: 0, grain: 0, cloth: 0 }, salaryAnnualOverride: { money: 0, grain: 0, cloth: 0 } },
    neicangRules: { royalClanPressure: rcp }
  };
  const G = {
    sid: 'royal', turn: 1, playerInfo: { factionName: '明' }, fiscalConfig: cfg,
    guoku: { money: 100000, balance: 100000, grain: 10000, cloth: 0 },
    neitang: { money: 1e6, balance: 1e6, grain: 1e5, cloth: 1e4 },
    armies: [], chars: [], officeTree: [], facs: [{ id: '明', name: '明' }],
    adminHierarchy: { player: { divisions: [
      { id: 'sx', name: '山西', children: [
        { id: 'ty', name: '太原府', publicTreasury: res(1000, 0), fiscal: { ledgers: led(1000, 0) } },
        { id: 'dt', name: '大同府', publicTreasury: res(3000, 0), fiscal: { ledgers: led(3000, 0) } }
      ] },
      { id: 'sn', name: '陕西', children: [{ id: 'xa', name: '西安府', publicTreasury: res(0, opts.snGrain || 0), fiscal: { ledgers: led(0, opts.snGrain || 0) } }] },
      { id: 'zj', name: '浙江', children: [{ id: 'hz', name: '杭州府', publicTreasury: res(5000, 0) }] }
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
const royalSink = (G) => ((G.guoku.ledgers && G.guoku.ledgers.money && G.guoku.ledgers.money.sinks) || {})['宗禄'] || 0;

// 1. 第一回合：山西三千石的七成五 = 二千二百五十石，库粮无，全照石折银（六钱）= 一千三百五十两，按库存一比三分给太原、大同；
//    陕西七百五十石，库里银粮皆无，全记欠禄；浙江不在份额里不动；太仓不出宗禄
{
  const { c, G } = fixture();
  const r = c.FixedExpense.collect({ game: G, turnDays: 30, force: true });
  ok(r && r.ok, '固定支出结完');
  near(royalSink(G), 0, '太仓不出宗禄');
  near(stock(G, 'ty'), 662.5, '太原府库银 1000−337.5');
  near(stock(G, 'dt'), 1987.5, '大同府库银 3000−1012.5');
  near(leaf(G, 'ty').publicTreasury.money.available, 662.5, '可用数同扣');
  near(leaf(G, 'ty').fiscal.ledgers.money.stock, 662.5, '区划财政账同扣');
  near(leaf(G, 'ty').fiscal.ledgers.money.thisTurnOut, 337.5, '区划财政账记本期出');
  near(stock(G, 'hz'), 5000, '浙江不支宗禄');
  const L = G._royalRetained;
  near(L.byRegion.sx.dueStone, 2250, '山西应支二千二百五十石');
  near(L.byRegion.sx.paidMoney, 1350, '山西实支银一千三百五十两');
  near(L.byRegion.sx.arrearsStone, 0, '山西不欠');
  near(L.byRegion.sn.arrearsStone, 750, '陕西欠禄七百五十石');
  near(r.turnExpense.royalRetained.dueStone, 3000, '本回合应支三千石');
  near(r.turnExpense.royalRetained.paidStone, 2250, '实支二千二百五十石');
  near(r.turnExpense.royalRetained.shortStone, 750, '欠七百五十石');
  ok(L.turn === 1, '记下扣的回合');

  // 2. 同一回合强制重结：太仓照重结，地方库不再扣
  c.FixedExpense.collect({ game: G, turnDays: 30, force: true });
  near(stock(G, 'ty'), 662.5, '同回合重结不再扣太原');
  near(G._royalRetained.byRegion.sn.arrearsStone, 750, '同回合重结欠禄不翻倍');

  // 3. 第二回合：再按库存比例扣，陕西欠禄累计
  G.turn = 2;
  c.FixedExpense.collect({ game: G, turnDays: 30 });
  near(stock(G, 'ty'), 325, '第二回合太原 662.5−337.5');
  near(stock(G, 'dt'), 975, '第二回合大同 1987.5−1012.5');
  near(G._royalRetained.byRegion.sn.arrearsStone, 1500, '陕西欠禄累计一千五百石');
}

// 4. 库粮先支本色，不够的才折银；银也没有的记欠
{
  const { c, G } = fixture({ snGrain: 500 });
  c.FixedExpense.collect({ game: G, turnDays: 30, force: true });
  near(stock(G, 'xa', 'grain'), 125, '陕西本色三百七十五石出库粮');
  near(G._royalRetained.byRegion.sn.paidGrain, 375, '陕西实支粮');
  near(G._royalRetained.byRegion.sn.arrearsStone, 375, '折色那一半无银可支，记欠三百七十五石');
}

// 5. 库粮够、库银不够：本色照付，折色按库银付多少算多少
{
  const { c, G } = fixture();
  leaf(G, 'ty').publicTreasury.grain.stock = 10000; leaf(G, 'ty').publicTreasury.grain.available = 10000;
  leaf(G, 'ty').publicTreasury.money.stock = 100; leaf(G, 'dt').publicTreasury.money.stock = 0;
  c.FixedExpense.collect({ game: G, turnDays: 30, force: true });
  near(G._royalRetained.byRegion.sx.paidGrain, 1125, '山西本色一千一百二十五石出库粮');
  near(G._royalRetained.byRegion.sx.paidMoney, 100, '折色只付得出库银一百两');
  near(G._royalRetained.byRegion.sx.arrearsStone, 2250 - 1125 - 100 / 0.6, '其余折成石记欠');
}

// 6. 没写份额（11-11 后、11-12 前开局的存档自带的宗禄配置）：照旧不扣地方库，太仓也不出
{
  const { c, G } = fixture({ byRegion: false });
  c.FixedExpense.collect({ game: G, turnDays: 30, force: true });
  near(stock(G, 'ty'), 1000, '没写份额不扣太原');
  ok(!G._royalRetained, '不建欠禄账');
  near(royalSink(G), 0, '太仓仍不出宗禄');
}

// 7. 叙事难度宗禄减半（同太仓宗禄的演义旋钮）
{
  const { c, G } = fixture({ difficulty: '叙事' });
  c.FixedExpense.collect({ game: G, turnDays: 30, force: true });
  near(G._royalRetained.byRegion.sx.dueStone, 1125, '叙事档山西应支减半');
}

// 8. 份额里的布政司在本局找不到：记下，不报错，别的照扣
{
  const { c, G } = fixture();
  G.fiscalConfig.neicangRules.royalClanPressure.byRegion = BY_REGION.concat([{ regionId: 'nowhere', share: 0.1 }]);
  const r = c.FixedExpense.collect({ game: G, turnDays: 30, force: true });
  ok(r.turnExpense.royalRetained.missing.indexOf('nowhere') >= 0, '找不到的布政司记在 missing');
  near(stock(G, 'ty'), 662.5, '其余照扣');
}

console.log('结果: ' + A + ' 通过 / 0 失败');
