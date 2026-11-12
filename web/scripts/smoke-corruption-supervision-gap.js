'use strict';
// 纠劾缺位（11-12 同志「三种结合」）：没有辖区的纠劾官出缺或失职 →
//   甲 只记到它监察的那一部；丙 作腐败引擎的一个来源，按引擎每月 8% 推高、0.5% 回落；乙 推高的部分以 SUPERVISION_GAP_CAP 为限，越近越慢；
//   报来的缺口只管紧接着的一回合（结算停了就不再生效）；补人后随引擎自然回落；全国性纠劾官不再直接加到全国每个府。
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const WEB = path.resolve(__dirname, '..');
let checks = 0;
function ok(value, message) { assert(value, message); checks++; }
function near(actual, expected, message, eps) { ok(Math.abs(actual - expected) < (eps || 1e-9), message + ': ' + actual + ' / ' + expected); }
function load(c, file) { vm.runInContext(fs.readFileSync(path.join(WEB, file), 'utf8'), c, { filename: file }); }

// —— 引擎：同一局面跑两份，一份报缺口一份不报，比各部差值 ——
function engineContext() {
  const math = Object.create(Math);
  math.random = () => 0.99; // 不触发揭发等随机事件，两份逐回合同步
  const c = {
    console: { log() {}, warn() {}, error() {}, info() {} },
    Math: math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, Date, isFinite, isNaN,
    GM: { turn: 5, corruption: { trueIndex: 50 }, chars: [], facs: [] },
    P: {}, addEB() {}, _getDaysPerTurn: () => 30
  };
  c.window = c; c.globalThis = c; c.global = c;
  vm.createContext(c);
  load(c, 'tm-corruption-engine.js');
  c.CorruptionEngine.ensureModel();
  return c;
}
function dept(c, k) { return c.GM.corruption.subDepts[k].true; }
function step(c, gap) {
  if (gap) c.CorruptionEngine.setSupervisionGap(gap, { posts: [] }); // 结算在本回合落账时报
  c.GM.turn++;                                                        // 引擎在回合数 +1 之后结算
  c.CorruptionEngine.tick({});
}
const DEPTS = ['central', 'provincial', 'military', 'fiscal', 'judicial', 'imperial'];

{
  const E = engineContext().CorruptionEngine;
  ok(E.supervisedDept('兵科都给事中', '六科给事中') === 'military', '兵科监察兵部→军队');
  ok(E.supervisedDept('刑科都给事中', '六科给事中') === 'judicial', '刑科→司法');
  ok(E.supervisedDept('户科都给事中', '六科给事中') === 'fiscal', '户科→税司');
  ok(E.supervisedDept('吏科都给事中', '六科给事中') === 'central', '吏科→中央');
  ok(E.supervisedDept('工科都给事中', '六科给事中') === 'central', '工科→中央');
  ok(E.supervisedDept('左都御史', '都察院') === 'central', '都察院堂官→中央');
  ok(E.supervisedDept('十三道监察御史', '都察院') === 'provincial', '道监察御史→地方');
  ok(E.supervisedDept('都给事中', '兵科') === 'military', '官名看不出时看所属官署');
  ok(E.supervisedDept('提督东厂太监', '东厂') === 'imperial', '东厂→内廷');
  ok(E.SUPERVISION_GAP_CAP === 20, '上限二十');
}

{
  // 一职出缺（兵科）：只推高军队一部，第一回合 = 2.5×8% = 0.2；其他五部与对照逐字相同
  const base = engineContext(), gap = engineContext();
  step(base, null); step(gap, { military: 2.5 });
  near(dept(gap, 'military') - dept(base, 'military'), 0.2, '第一回合军队多涨 2.5×0.08');
  DEPTS.filter((k) => k !== 'military').forEach((k) => near(dept(gap, k), dept(base, k), k + ' 不受兵科缺位影响'));
  near(gap.GM.corruption.supervisionGap.lift.military, 0.2, '推高的部分记在 lift');
  near(gap.GM.corruption.sources.supervisionGap, 2.5, '来源表显示纠缺压力');
  // 连续十年：越近上限越慢，停在上限以下；差值始终等于 lift（同一套线性回落）
  for (let i = 1; i < 120; i++) { step(base, null); step(gap, { military: 2.5 }); }
  const lift = gap.GM.corruption.supervisionGap.lift.military;
  ok(lift > 10 && lift < 20, '十年后抬升在上限以下：' + lift.toFixed(3));
  near(dept(gap, 'military') - dept(base, 'military'), lift, '十年后差值仍等于 lift', 1e-6);
  const firstYear = engineContext(), firstBase = engineContext();
  for (let i = 0; i < 12; i++) { step(firstBase, null); step(firstYear, { military: 2.5 }); }
  const y1 = dept(firstYear, 'military') - dept(firstBase, 'military');
  ok(y1 > 2 && y1 < 2.4, '一职出缺第一年约 +2.2：' + y1.toFixed(3));
  // 同一部三职出缺：压力叠加但仍受同一上限
  const three = engineContext();
  for (let i = 0; i < 600; i++) step(three, { central: 7.5 });
  const l3 = three.GM.corruption.supervisionGap.lift.central;
  ok(l3 > 15 && l3 < 20, '同部三职出缺五十年也不过上限：' + l3.toFixed(3));
}

{
  // 补人：压力归零，lift 每月按 0.5% 回落，差值随之退回
  const base = engineContext(), gap = engineContext();
  for (let i = 0; i < 60; i++) { step(base, null); step(gap, { judicial: 2.5 }); }
  const l0 = gap.GM.corruption.supervisionGap.lift.judicial;
  for (let i = 0; i < 24; i++) { step(base, null); step(gap, {}); }
  const l1 = gap.GM.corruption.supervisionGap.lift.judicial;
  near(l1, l0 * Math.pow(0.995, 24), '补人后两年 lift 按每月 0.5% 回落', 1e-9);
  near(dept(gap, 'judicial') - dept(base, 'judicial'), l1, '司法部差值随 lift 退回', 1e-6);
}

{
  // 结算停了（不再报）：上回合报的缺口只管紧接着的一回合，再往后不生效
  const base = engineContext(), gap = engineContext();
  step(base, null); step(gap, { military: 2.5 });
  const l0 = gap.GM.corruption.supervisionGap.lift.military;
  gap.GM.turn++; base.GM.turn++;      // 空过一回合不报
  step(base, null); step(gap, null);   // 此时缺口已是两回合前的
  near(gap.GM.corruption.supervisionGap.lift.military, l0 * 0.995, '过期缺口不再推高，只回落');
  near(gap.GM.corruption.sources.supervisionGap, 0, '过期缺口来源归零');
}

{
  // 称职（压力为负）：该部腐败往下，同样有界
  const base = engineContext(), gap = engineContext();
  step(base, null); step(gap, { central: -1 });
  near(dept(gap, 'central') - dept(base, 'central'), -0.08, '称职一回合中央少 1×0.08');
}

{
  // 旧档：没有 supervisionGap 这一键，tick 照旧；报一次就建起来
  const c = engineContext();
  ok(!c.GM.corruption.supervisionGap, '旧档无纠缺账');
  c.CorruptionEngine.tick({});
  ok(!c.GM.corruption.supervisionGap, '不报就不建账');
}

// —— 履职结算：全国性纠劾官不再加到各府，交引擎记到它监察的那一部；没有腐败引擎时照旧 ——
function applierContext(withEngine) {
  const h = fs.readFileSync(path.join(__dirname, 'smoke-ai-writeback-integrity.js'), 'utf8').replace(/^#![^\n]*\n/, '').split('async function main()')[0];
  const helpers = new Function('require', '__dirname', h + ';return {makeContext,baseGM};')(require, __dirname);
  const c = helpers.makeContext();
  c.GM = helpers.baseGM({
    turn: 3,
    adminHierarchy: { player: { divisions: [
      { id: 'a', name: '甲府', fiscal: { compliance: 0.7 }, corruption: 50 },
      { id: 'b', name: '乙府', fiscal: { compliance: 0.7 }, corruption: 60 }
    ] } },
    officeTree: [
      { name: '六科给事中', positions: [{ id: 'bingke', name: '兵科都给事中', holder: '', establishedCount: 1, vacancyCount: 1, powers: { impeach: true }, _dutyState: { fulfillment: 20 } }] },
      { name: '地方', positions: [{ id: 'xunan', name: '巡按御史', holder: '', jurisdictionId: 'b', powers: { supervise: true }, _dutyState: { fulfillment: 20 } }] }
    ]
  });
  c.P = { playerInfo: { factionName: '本朝' }, time: { daysPerTurn: 30 } };
  c._getDaysPerTurn = () => 30;
  c.officeFlagOn = (k) => k === 'officeDutyStateEnabled';
  ['tm-office-holder-state.js', 'tm-office-action-evidence.js', 'tm-office-dutystate.js', 'tm-fiscal-engine.js'].forEach((f) => load(c, f));
  if (withEngine) load(c, 'tm-corruption-engine.js');
  return c;
}
{
  const c = applierContext(true);
  const notes = []; c.addEB = (cat, text) => notes.push(text);
  c._applyOfficeDutyTick(c.GM);
  const [a, b] = c.GM.adminHierarchy.player.divisions;
  near(a.corruption, 50, '兵科缺位不再加到甲府');
  near(b.corruption, 62.5, '巡按（有辖区）照旧落本辖区：乙府 +2.5');
  const g = c.GM.corruption.supervisionGap;
  near(g.pressure.military, 2.5, '兵科缺口记到军队，每月 2.5');
  ok(Object.keys(g.pressure).length === 1, '只记一部');
  ok(g.posts.length === 1 && g.posts[0].supervises === 'military' && g.posts[0].pos === '兵科都给事中', '缺口记明是哪一职');
  ok(g.turn === 3, '记下报的回合');
  ok(notes.some((t) => /监察缺口：军队\+2\.5/.test(t) && /腐败\+2\.5/.test(t)), '事件写明：直接落地的腐败（巡按）与监察缺口（兵科）分开写');
  // 第二回合补了人（履职回到中档）：报空缺口，不留上回合的
  c.GM.officeTree[0].positions[0]._dutyState = { fulfillment: 50 };
  c.GM.officeTree[1].positions[0]._dutyState = { fulfillment: 50 };
  c.GM.turn++;
  c._applyOfficeDutyTick(c.GM);
  ok(Object.keys(c.GM.corruption.supervisionGap.pressure).length === 0 && c.GM.corruption.supervisionGap.turn === 4, '补人后报空缺口');
}
{
  const c = applierContext(false);
  c._applyOfficeDutyTick(c.GM);
  const [a, b] = c.GM.adminHierarchy.player.divisions;
  near(a.corruption, 52.5, '没有腐败引擎（单测沙箱）照旧加到各府');
  near(b.corruption, 65, '没有腐败引擎时乙府 = 巡按 +2.5 与全国 +2.5');
}

console.log('PASS corruption-supervision-gap ' + checks + ' assertions');
