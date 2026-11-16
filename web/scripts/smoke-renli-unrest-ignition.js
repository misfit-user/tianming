/* smoke-renli-unrest-ignition.js — 刀A·物理亏空→既有民变/流寇点火（激活·门控种子省）
 * 验：种子省持续粮荒/逃亡→
 *   ① 民心通道：有界压低 GM 叶 div.minxin（民变真值源·★绕 P/GM adminHierarchy 分叉=落对 GM 那份而非 P）
 *   ② 流寇通道：§5 全崩(逃亡>20% ∧ 连续亏空≥2 ∧ 农户满意度<35)→本回合新逃丁入既有逃户池 taoohu(→流寇凝聚)
 *   ③ deficitTurns 连续亏空计数（缺粮不结转）④ 有界(≤UNREST_MX_STEP/回合·不跳楼)
 *   ⑤ swap-test 摘掉满意度条件→流寇不点火（证 §5 三条 gate）⑥ 未种子地域 inert（零行为）
 *   ⑦ 首回合无 backlog 倾泻（只取每回合增量）⑧ 无丁账泄漏 ⑨ P/GM 同对象亦正确 ⑩ 源契约
 * 跑：node scripts/smoke-renli-unrest-ignition.js
 */
'use strict';
var pass = 0, fail = 0, fails = [];
function ok(c, m) { if (c) pass++; else { fail++; fails.push(m); console.error('  ✗ ' + m); } }
function near(a, b, eps) { return Math.abs(Number(a) - Number(b)) <= (eps == null ? 0.01 : eps); }

global.TM = global.TM || {};
var R = require('../tm-renli.js');

// ── P（Renli 读·有 renliSeed+populationDetail·无 minxin） 与 GM.adminHierarchy（民变读·有 minxin） 故意分叉为两套对象
//    （模拟 tm-save-lifecycle deepClone 后 P≠GM 的真实运行态——民心压力必须落到 GM 那份才被民变看到） ──
function mkP() {
  return { adminHierarchy: { player: { divisions: [
    { id: 'div_xian', name: '西安府', renliSeed: { soilBase: 60 }, populationDetail: { mouths: 200000, households: 40000, ding: 100000, fugitives: 20000 } },
    { id: 'div_song', name: '松江府', populationDetail: { mouths: 200000, households: 40000, ding: 100000, fugitives: 5000 } } // 未种子
  ] } } };
}
function mkGM() {
  return {
    turn: 5, sid: 'sc-x',
    classes: [{ name: '农户', economicRole: '生产', satisfaction: 30, regionalVariants: [{ region: 'div_xian', satisfaction: 30 }] }],
    adminHierarchy: { player: { divisions: [
      { id: 'div_xian', name: '西安府', minxin: 50, minxinLocal: 50 },
      { id: 'div_song', name: '松江府', minxin: 70, minxinLocal: 70 }
    ] } },
    population: { byLegalStatus: {} },
    renli: { byRegion: {
      div_xian: { soil: 60, corveeRate: 0.40, foodNeed: 100000, foodDeficit: 40000, deficitTurns: 0, levyPolicy: { strength: 'normal', remitTurns: 0 }, ledger: [] }
    }, reported: {} }
  };
}

// ── T1 民心通道（分叉安全 + 有界 + 比例）──
var P = mkP(), GM = mkGM(); global.P = P;
// severity = deficitRatio(.4)*1 + max(0,.40-.20)*1.5(.3) + fleeRatio(.2)*.5(.1) = .8 → dMin = -min(.8*4,4) = -3.2
R.applyUnrestPressure(GM, P);
var gmXian = GM.adminHierarchy.player.divisions[0];
ok(near(gmXian.minxin, 46.8), '1·役政崩坏→GM 叶西安府 div.minxin 50→46.8（-3.2·落 GM 那份=民变真值源）·实得 ' + gmXian.minxin);
ok(gmXian.minxinLocal === gmXian.minxin, '1·minxinLocal 同步');
var pXian = P.adminHierarchy.player.divisions[0];
ok(pXian.minxin === undefined, '1·★P 那份叶子未被写 minxin（分叉安全·压力没写飞到 Renli 读的 P 上）');
ok((50 - gmXian.minxin) <= 4 + 1e-9, '1·有界：单回合压降 ≤ UNREST_MX_STEP(4)·不跳楼');
ok(GM.renli.byRegion.div_xian.deficitTurns === 1, '1·deficitTurns 0→1（本回合有亏空）');
ok((GM.population.byLegalStatus.taoohu == null) || (GM.population.byLegalStatus.taoohu.mouths === 0), '1·首回合无 backlog 倾泻入逃户池（deficitTurns<2 且 inc=0）');

// ── T1b 有界封顶（极端 severity→恰 -4）──
var GM2 = mkGM(); GM2.renli.byRegion.div_xian.corveeRate = 0.90; GM2.renli.byRegion.div_xian.foodDeficit = 100000; // ratio 1
R.applyUnrestPressure(GM2, mkP());
ok(near(GM2.adminHierarchy.player.divisions[0].minxin, 46), '1b·极端崩坏 severity 饱和→恰 -4（50→46·封顶不超）·实得 ' + GM2.adminHierarchy.player.divisions[0].minxin);

// ── T2 流寇通道（2 回合全崩→新逃丁入既有逃户池）──
// 续 T1（_renliFugSeen 已=20000·deficitTurns=1）。本回合新逃 5000、逃亡率 .25>.20、满意度30<35、亏空连续→全崩
P.adminHierarchy.player.divisions[0].populationDetail.fugitives = 25000;
GM.turn = 6;
R.applyUnrestPressure(GM, P);
ok(GM.renli.byRegion.div_xian.deficitTurns === 2, '2·deficitTurns 1→2（连续亏空·达 §5 阈）·实得 ' + GM.renli.byRegion.div_xian.deficitTurns);
var taoohu = GM.population.byLegalStatus.taoohu;
ok(taoohu && taoohu.mouths === 2500, '2·★全崩→本回合新逃丁 5000×0.5=2500 入既有逃户池 taoohu（→流寇凝聚机器接管）·实得 ' + (taoohu ? taoohu.mouths : 'none'));
ok(GM.renli.byRegion.div_xian._collapseTurn === 6, '2·_collapseTurn 记当前回合');

// ── T3 deficitTurns 重置（缺粮不结转）──
GM.renli.byRegion.div_xian.foodDeficit = 0;
R.applyUnrestPressure(GM, P);
ok(GM.renli.byRegion.div_xian.deficitTurns === 0, '3·亏空消失→deficitTurns 归零（不结转）·实得 ' + GM.renli.byRegion.div_xian.deficitTurns);

// ── T4 swap-test：摘掉满意度条件（sat 60>35）→流寇不点火（证 §5 三条 gate）──
var P4 = mkP(), GM4 = mkGM();
GM4.classes[0].satisfaction = 60; GM4.classes[0].regionalVariants[0].satisfaction = 60; // 满意度高
GM4.renli.byRegion.div_xian.deficitTurns = 2;                                            // 亏空已够
P4.adminHierarchy.player.divisions[0].populationDetail._renliFugSeen = 20000;            // 基线
P4.adminHierarchy.player.divisions[0].populationDetail.fugitives = 26000;                // inc 6000>0·逃亡率 .26>.20
R.applyUnrestPressure(GM4, P4);
var t4 = GM4.population.byLegalStatus.taoohu;
ok((t4 == null) || (t4.mouths === 0), '4·swap-test：满意度 60≥35→全崩条件不成立→逃户池不增（§5 gate 生效·非无条件点火）·实得 ' + (t4 ? t4.mouths : 0));
ok(GM4.adminHierarchy.player.divisions[0].minxin < 50, '4·但民心通道仍照施压（民心不需全崩·粮荒即缓蚀）·实得 ' + GM4.adminHierarchy.player.divisions[0].minxin);

// ── T5 未种子地域 inert（零行为）──
var P5 = mkP(), GM5 = mkGM();
GM5.renli.byRegion.div_song = { soil: 70, corveeRate: 0.5, foodNeed: 100000, foodDeficit: 80000, deficitTurns: 5, levyPolicy: {}, ledger: [] }; // 即便造账
R.applyUnrestPressure(GM5, P5);
ok(GM5.adminHierarchy.player.divisions[1].minxin === 70, '5·未种子松江府 div.minxin 不动（70·inert）·实得 ' + GM5.adminHierarchy.player.divisions[1].minxin);
ok(GM5.renli.byRegion.div_song.deficitTurns === 5, '5·未种子地域 deficitTurns 不被本层触碰（仍 5·loop 早跳过）');

// ── T6 P/GM 同对象亦正确（同一份 adminHierarchy·真值源即叶本身）──
var shared = { player: { divisions: [
  { id: 'div_x', name: '同源府', renliSeed: { soilBase: 60 }, minxin: 48, minxinLocal: 48, populationDetail: { mouths: 200000, ding: 100000, fugitives: 22000 } }
] } };
var GM6 = { turn: 3, sid: 's', classes: [{ name: '农户', economicRole: '生产', satisfaction: 30, regionalVariants: [] }], adminHierarchy: shared, population: { byLegalStatus: {} },
  renli: { byRegion: { div_x: { soil: 60, corveeRate: 0.45, foodNeed: 100000, foodDeficit: 50000, deficitTurns: 0, levyPolicy: {}, ledger: [] } }, reported: {} } };
var P6 = { adminHierarchy: shared }; global.P = P6;
R.applyUnrestPressure(GM6, P6);
ok(shared.player.divisions[0].minxin < 48, '6·P===GM 同对象→直接压该叶 div.minxin（48→下降）·实得 ' + shared.player.divisions[0].minxin);

// ── T7 无丁账泄漏（deficitTurns/_collapseTurn 不是丁计数·assertNoDingInRenli 仍净）──
ok(R.assertNoDingInRenli(GM).length === 0, '7·GM.renli 无丁计数泄漏（deficitTurns/_collapseTurn 非 FORBIDDEN 丁键）');

// ── T8 源契约 ──
ok(typeof R.applyUnrestPressure === 'function', '8·导出 applyUnrestPressure');
var fs = require('fs'); var src = fs.readFileSync(require('path').join(__dirname, '..', 'tm-renli.js'), 'utf8');
ok(!/天启|陕西'|sc-tianqi/.test(src.slice(src.indexOf('function applyUnrestPressure'), src.indexOf('function applyUnrestPressure') + 1600)), '8·applyUnrestPressure 无朝代/地名硬编（中立）');

console.log('\n[smoke-renli-unrest-ignition] ' + pass + ' 通过 / ' + fail + ' 失败');
if (fail) { console.error('失败项：\n - ' + fails.join('\n - ')); process.exit(1); }
process.exit(0);
