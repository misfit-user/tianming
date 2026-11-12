'use strict';
// 征收缺口（11-13 同志「按你推荐来」，同纠劾那套）：没有辖区的掌征收官出缺或失职 →
//   不再每回合把合计直接加到全国每个府的实征率（原先每职每月 −0.025，只夹 0.1 底）；
//   改记一个偏移（lift）：每月压力照 6-20 定的档（出缺/履职<35 每职 −0.025，称职 +0.01），以 0.15 为限、越近越慢，
//   另每月向零回落一成（补齐人手后约七个月退一半）；每回合只把偏移的变化量加减到各府。有辖区的照旧只落本辖区。
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const WEB = path.resolve(__dirname, '..');
let checks = 0;
function ok(value, message) { assert(value, message); checks++; }
function near(actual, expected, message, eps) { ok(Math.abs(actual - expected) < (eps || 1e-9), message + ': ' + actual + ' / ' + expected); }
function load(c, file) { vm.runInContext(fs.readFileSync(path.join(WEB, file), 'utf8'), c, { filename: file }); }

// 偏移按 dL/dt = p − (|p|/0.15 + 0.1)·L 整段求解（与引擎同式，在此独立写一遍）
const CAP = 0.15, RECOVERY = 0.1;
function expectedLift(lift, pressure, months) {
  const rate = Math.abs(pressure) / CAP + RECOVERY, settle = pressure / rate;
  return settle + (lift - settle) * Math.exp(-rate * months);
}

function vacantTaxPost(id, name, extra) {
  return Object.assign({ id, name, holder: '', establishedCount: 1, vacancyCount: 1, powers: { taxCollect: true }, _dutyState: { fulfillment: 20 } }, extra || {});
}
function applierContext(realmPosts, regionalPosts) {
  const h = fs.readFileSync(path.join(__dirname, 'smoke-ai-writeback-integrity.js'), 'utf8').replace(/^#![^\n]*\n/, '').split('async function main()')[0];
  const helpers = new Function('require', '__dirname', h + ';return {makeContext,baseGM};')(require, __dirname);
  const c = helpers.makeContext();
  const tree = [];
  if (realmPosts.length) tree.push({ name: '户部', positions: realmPosts });
  if (regionalPosts.length) tree.push({ name: '地方', positions: regionalPosts });
  c.GM = helpers.baseGM({
    turn: 3,
    adminHierarchy: { player: { divisions: [
      { id: 'a', name: '甲府', fiscal: { compliance: 0.7 }, corruption: 30 },
      { id: 'b', name: '乙府', fiscal: { compliance: 0.7 }, corruption: 30 },
      { id: 'c', name: '丙府', fiscal: { compliance: 0.11 }, corruption: 30 }
    ] } },
    officeTree: tree
  });
  c.P = { playerInfo: { factionName: '本朝' }, time: { daysPerTurn: 30 } };
  c._getDaysPerTurn = () => 30;
  c.officeFlagOn = (k) => k === 'officeDutyStateEnabled';
  ['tm-office-holder-state.js', 'tm-office-action-evidence.js', 'tm-office-dutystate.js', 'tm-fiscal-engine.js'].forEach((f) => load(c, f));
  return c;
}
function divs(c) { return c.GM.adminHierarchy.player.divisions; }
function comp(c, i) { return divs(c)[i].fiscal.compliance; }
function nextTurn(c, fulfillment) {
  c.GM.turn++;
  c.GM.officeTree.forEach((d) => d.positions.forEach((p) => { p._dutyState = { fulfillment }; }));
  c._applyOfficeDutyTick(c.GM);
}

{
  // 一职（户部侍郎）出缺：本回合整月低于失职线，压力 −0.025/月；不再给各府直接 −0.025，只加减偏移的变化量
  const c = applierContext([vacantTaxPost('shilang', '户部侍郎')], []);
  const notes = []; c.addEB = (cat, text) => notes.push(text);
  c._applyOfficeDutyTick(c.GM);
  const g = c.GM._taxCollectGap;
  const l1 = expectedLift(0, -0.025, 1);
  ok(g && g.turn === 3, '建账并记下回合');
  near(g.pressure, -0.025, '压力：一职出缺每月 −0.025');
  near(g.lift, l1, '偏移按整段解：' + l1.toFixed(5));
  ok(l1 > -0.025 && l1 < -0.02, '第一回合比原先直接 −0.025 略少');
  near(comp(c, 0), 0.7 + l1, '甲府实征率只变偏移那么多');
  near(comp(c, 1), 0.7 + l1, '乙府同');
  near(comp(c, 2), 0.1, '丙府夹在 0.1 底');
  ok(g.posts.length === 1 && g.posts[0].pos === '户部侍郎', '缺口记明是哪一职');
  ok(notes.some((t) => /征收缺口：各府实征率-0\.02\d（累计-0\.02\d，以 0\.15 为限）/.test(t)), '事件写明本回合加减与累计：' + notes.join(' | '));
  ok(!notes.some((t) => /（实征率/.test(t)), '没有有辖区的官，就不写直接落地的实征率');
  // 同一回合再结一次（重试）：不再扣
  const before = comp(c, 0);
  c._applyOfficeDutyTick(c.GM);
  near(comp(c, 0), before, '同一回合重结不重扣');
  near(c.GM._taxCollectGap.lift, l1, '偏移不动');
}

{
  // 九职出缺（绍宋户部那样）：连扣十二回合，偏移逼近而不越过 0.15；各府实征率的总降幅等于偏移
  const posts = [];
  for (let i = 0; i < 9; i++) posts.push(vacantTaxPost('p' + i, '郎官' + i));
  const c = applierContext(posts, []);
  let lift = 0;
  for (let t = 0; t < 12; t++) {
    nextTurn(c, 20);
    lift = expectedLift(lift, -0.225, 1);
    near(c.GM._taxCollectGap.lift, lift, '第' + (t + 1) + '回合偏移', 1e-9);
  }
  ok(lift > -CAP && lift < -0.13, '十二回合后偏移在上限以内：' + lift.toFixed(4));
  near(comp(c, 0), 0.7 + lift, '甲府总降幅等于偏移', 1e-9);
  ok(comp(c, 0) > 0.55, '九职出缺一年，甲府实征率仍在 0.55 以上（原先三回合就到 0.36）：' + comp(c, 0).toFixed(4));
  // 补齐人手（履职回到中档，压力归零）：偏移每月按一成回落，实征率随之回升
  const l0 = c.GM._taxCollectGap.lift, a0 = comp(c, 0);
  for (let t = 0; t < 7; t++) nextTurn(c, 50);
  const l7 = c.GM._taxCollectGap.lift;
  near(l7, l0 * Math.exp(-RECOVERY * 7), '补人后七个月偏移按每月一成回落', 1e-9);
  ok(Math.abs(l7) < Math.abs(l0) * 0.51 && Math.abs(l7) > Math.abs(l0) * 0.49, '约七个月退一半');
  near(comp(c, 0), a0 + (l7 - l0), '甲府实征率回升同样多', 1e-9);
  near(c.GM._taxCollectGap.pressure, 0, '补人后压力归零');
}

{
  // 称职（压力为正）：往上抬，同样以 0.15 为限
  const c = applierContext([vacantTaxPost('shangshu', '户部尚书', { holder: '某公', vacancyCount: 0 })], []);
  for (let t = 0; t < 3; t++) nextTurn(c, 90);
  const l = c.GM._taxCollectGap.lift;
  ok(l > 0 && l < CAP, '称职三回合偏移为正且在上限以内：' + l.toFixed(5));
  near(comp(c, 0), 0.7 + l, '甲府实征率抬高同样多', 1e-9);
}

{
  // 有辖区的掌征收官（知府）照旧只落本辖区：乙府 −0.025；全国性的不出缺就不建账
  const c = applierContext([], [vacantTaxPost('zhifu', '知府', { jurisdictionId: 'b' })]);
  c._applyOfficeDutyTick(c.GM);
  near(comp(c, 0), 0.7, '甲府不受乙府知府影响');
  near(comp(c, 1), 0.675, '乙府照旧直接 −0.025');
  ok(c.GM._taxCollectGap === undefined, '没有全国性缺口就不建账（旧档照旧）');
}

{
  // 全国性与有辖区的同在：乙府 = 直接 −0.025 加上偏移
  const c = applierContext([vacantTaxPost('shilang', '户部侍郎')], [vacantTaxPost('zhifu', '知府', { jurisdictionId: 'b' })]);
  const notes = []; c.addEB = (cat, text) => notes.push(text);
  c._applyOfficeDutyTick(c.GM);
  const l1 = expectedLift(0, -0.025, 1);
  near(comp(c, 0), 0.7 + l1, '甲府只有偏移');
  near(comp(c, 1), 0.7 - 0.025 + l1, '乙府直接扣加偏移');
  ok(notes.some((t) => /（实征率-0\.025·征收缺口：各府实征率-0\.02\d/.test(t)), '事件把直接落地的与征收缺口分开写：' + notes.join(' | '));
}

console.log('PASS tax-collect-gap ' + checks + ' assertions');
