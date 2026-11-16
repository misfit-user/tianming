#!/usr/bin/env node
'use strict';
/* smoke-battle-turn — Phase2 活线「咽喉拦截 + 会战阶段」
 *   ① 包裹咽喉 ② flag OFF=零变更透传 ③ flag ON+涉玩家→延后不立即应用 ④ 防环/纯NPC不拦 ⑤ runPending 委之→原结果落地
 *   ★核心保证:flag 默认 OFF → 现有战斗解算丝毫不变。
 */
const path = require('path');
let A = 0, F = 0; function ok(c, m) { if (c) { A++; console.log('  ✓ ' + m); } else { F++; console.log('  ✗ FAIL: ' + m); } }
console.log('smoke-battle-turn');

const applied = [];
global.window = {};
global.document = { addEventListener: function () {} };
global.window.MilitarySystems = { applyBattleResult: function (br) { applied.push(br); } };
global.window.GM = { _yujiaQinzheng: false, armies: [
  { id: 'pa', faction: '宋', name: '背嵬军', soldiers: 3000, commander: '岳飞' },
  { id: 'ea', faction: '金', name: '金军', soldiers: 2500, commander: '宗弼' }] };
global.window.P = { playerInfo: { factionName: '宋' } };
const GM = global.window.GM;
const TURN = require(path.resolve(__dirname, '..', 'tm-battle-turn.js'));

ok(global.window.MilitarySystems._battleHookInstalled === true, '① 包裹咽喉 applyBattleResult 已装');
ok(typeof global.window.MilitarySystems._origApplyBattleResult === 'function', '① 留存原咽喉引用');

/* ② flag OFF → 透传(零行为变更) */
const br1 = { affectedArmies: [{ armyId: 'pa', loss: 500 }, { armyId: 'ea', loss: 800 }] };
global.window.MilitarySystems.applyBattleResult(br1, GM);
ok(applied.length === 1 && applied[0] === br1, '② flag OFF→透传原咽喉(零变更)');
ok(TURN._pending().length === 0, '② flag OFF→不延后');

/* ③ flag ON + 涉玩家 → 拦下延后 */
GM._yujiaQinzheng = true; applied.length = 0; TURN._clear();
const br2 = { affectedArmies: [{ armyId: 'pa', loss: 500 }, { armyId: 'ea', loss: 800 }] };
global.window.MilitarySystems.applyBattleResult(br2, GM);
ok(applied.length === 0, '③ flag ON+涉玩家→拦下·不立即抽象结算');
ok(TURN._pending().length === 1, '③ 入延后队列');
const item = TURN._pending()[0];
ok(item.playerArmies.length === 1 && item.playerArmies[0].id === 'pa', '③ 分边·玩家军 pa');
ok(item.enemyArmies.length === 1 && item.enemyArmies[0].id === 'ea', '③ 分边·敌军 ea');

/* ④ 防环 + 纯NPC不拦 */
applied.length = 0; TURN._clear();
global.window.MilitarySystems.applyBattleResult({ affectedArmies: [{ armyId: 'pa', loss: 100 }], _fromTactical: true }, GM);
ok(applied.length === 1 && TURN._pending().length === 0, '④ 战术回填(_fromTactical)→不拦(防环)');
applied.length = 0; TURN._clear();
global.window.MilitarySystems.applyBattleResult({ affectedArmies: [{ armyId: 'ea', loss: 100 }] }, GM);
ok(applied.length === 1 && TURN._pending().length === 0, '④ 纯NPC战(无玩家军)→不拦');

/* ⑤ involvesPlayer 判定 */
GM._yujiaQinzheng = false;
ok(TURN.involvesPlayer(br2, GM) === false, '⑤ flag OFF→involvesPlayer=false(零变更根因)');
GM._yujiaQinzheng = true;
ok(TURN.involvesPlayer(br2, GM) === true, '⑤ flag ON+玩家军→involvesPlayer=true');

/* ⑥ runPending 委之(node 无 DOM→delegate)→原结果走 applyReal 落地 */
applied.length = 0; TURN._clear(); GM._pendingAbstractBattles = [];   // 清前序测试遗留的持久化镜像(真实游戏每回合 runPending 自排空)
global.window.MilitarySystems.applyBattleResult(br2, GM);   // defer
TURN.runPending(GM).then(function () {
  ok(applied.length === 1, '⑥ runPending→委之(无DOM)→原 battleResult 走原咽喉落地');
  ok(applied[0] === br2 && !applied[0]._fromTactical, '⑥ 委之默认(无方略)=原 abstract 结果');

  /* ⑦ 方略缩放(§12.5) */
  var item = { battleResult: { affectedArmies: [{ armyId: 'pa', loss: 1000 }, { armyId: 'ea', loss: 1000 }] }, playerArmies: [{ id: 'pa' }], enemyArmies: [{ id: 'ea' }] };
  applied.length = 0; TURN.applyDelegate(item, 'aggressive', GM);
  var r = applied[0];
  ok(r.affectedArmies.find(function (x) { return x.armyId === 'pa'; }).loss === 1120, '⑦ 主攻:我损×1.12=1120');
  ok(r.affectedArmies.find(function (x) { return x.armyId === 'ea'; }).loss === 1150, '⑦ 主攻:敌损×1.15=1150');
  ok(r._strategy === 'aggressive' && item.battleResult.affectedArmies[0].loss === 1000, '⑦ 标方略·原 battleResult 不被改(拷贝)');
  applied.length = 0; TURN.applyDelegate(item, 'cautious', GM);
  ok(applied[0].affectedArmies.find(function (x) { return x.armyId === 'pa'; }).loss === 850, '⑦ 持重:我损×0.85=850');
  ok(applied[0].affectedArmies.find(function (x) { return x.armyId === 'ea'; }).loss === 920, '⑦ 持重:敌损×0.92=920');
  applied.length = 0; TURN.applyDelegate(item, 'swift', GM);
  var sw = applied[0].affectedArmies.find(function (x) { return x.armyId === 'ea'; }).loss;
  ok(sw === 1400 || sw === 800, '⑦ 速决:敌损赌(好1400/坏800)·高方差');
  applied.length = 0; TURN.applyDelegate(item, null, GM);
  ok(applied[0] === item.battleResult, '⑦ 无方略→原结果(委之默认)');

  /* ⑧ 中途存档 checkpoint:持久化镜像 + 排空残留(刀三) */
  GM._yujiaQinzheng = true; applied.length = 0; TURN._clear(); GM._pendingAbstractBattles = [];
  var brP = { affectedArmies: [{ armyId: 'pa', loss: 300 }] };
  global.window.MilitarySystems.applyBattleResult(brP, GM);
  ok((GM._pendingAbstractBattles || []).length === 1 && GM._pendingAbstractBattles[0] === brP, '⑧ 拦截→持久化镜像入 GM._pendingAbstractBattles(随存档)');
  applied.length = 0;
  TURN.recoverPending(GM);
  ok(applied.length === 1 && applied[0] === brP, '⑧ recoverPending→残留抽象兜底落地(该战不丢)');
  ok((GM._pendingAbstractBattles || []).length === 0, '⑧ recover 后镜像清空');

  /* ⑨ 御营军判定(刀四) */
  var GM2 = { chars: [{ name: '崇祯', role: '皇帝' }] };
  ok(TURN.emperorName(GM2) === '崇祯', '⑨ emperorName 朝代中立(role=皇帝)');
  ok(TURN.emperorArmyId(GM2, [{ id: 'x', commander: '某', soldiers: 5000 }, { id: 'y', commander: '崇祯', soldiers: 1200 }]) === 'y', '⑨ 御营=皇帝亲领的军(commander=皇帝名·非最大军)');
  ok(TURN.emperorArmyId({}, [{ id: 'a', name: '边军', soldiers: 1000 }, { id: 'b', name: '御营亲军', soldiers: 800 }]) === 'b', '⑨ 无皇帝→标御营/亲军名的军');
  ok(TURN.emperorArmyId({}, [{ id: 'a', soldiers: 1000 }, { id: 'b', soldiers: 3000 }]) === 'b', '⑨ 兜底→御驾随最大军');

  /* ⑩ O11 出兵预勾(v2):army._battleStance 三态——always→免modal径入战术(headless本会auto-delegate·故launch被调=预勾生效铁证)·delegate→径庙算·未设→照旧 */
  var launches = [];
  global.window.TMBattleAdapter = { buildBattleConfig: function () { return { armies: { ming: [], jin: [] } }; } };
  global.window.TMBattleResolve = {
    predictBattleBand: function () { return { swing: true, winner: 'player', playerLoss: {}, enemyLoss: {}, k: 0.25, strA: 1, strB: 1, winProb: 0.5, playerSoldiers: 0, enemySoldiers: 0 }; },
    tacticalToBattleResult: function (tac, ctx) { return { affectedArmies: [{ armyId: 'pa', loss: 123 }], winnerFactionId: '宋', loserFactionId: '金', _fromTactical: true }; }
  };
  global.window.TMBattleEmbed = { launch: function (cfg) { launches.push(cfg); return Promise.resolve({ outcome: 'win', units: [], commanders: [] }); } };
  GM._yujiaQinzheng = true;
  var paArmy = GM.armies[0];
  function stanceRun(stance) {
    paArmy._battleStance = stance; applied.length = 0; launches.length = 0; TURN._clear(); GM._pendingAbstractBattles = [];
    global.window.MilitarySystems.applyBattleResult({ affectedArmies: [{ armyId: 'pa', loss: 400 }, { armyId: 'ea', loss: 500 }] }, GM);
    return TURN.runPending(GM);
  }
  stanceRun('always').then(function () {
    ok(launches.length === 1, '⑩ 预勾必亲征→免临场请旨·TMBattleEmbed.launch 被调(headless无modal仍入战术)');
    ok(applied.length === 1 && applied[0]._fromTactical === true, '⑩ 预勾亲征→战术战果经原咽喉回填');
    return stanceRun('delegate');
  }).then(function () {
    ok(launches.length === 0 && applied.length === 1 && !applied[0]._fromTactical, '⑩ 预勾必委之→不入战术·原 abstract 落地');
    return stanceRun(undefined);
  }).then(function () {
    ok(launches.length === 0 && applied.length === 1, '⑩ 未预勾→照旧(headless modal auto-delegate·零行为变更)');
    delete paArmy._battleStance;
    /* ⑩ UI 源契约:军卡带 stance 三态按钮 + 命令分支 + 刷新 */
    var fs2 = require('fs');
    var rr = fs2.readFileSync(path.resolve(__dirname, '..', 'phase8-formal-rightrail.js'), 'utf8');

    console.log('\n结果: ' + A + ' 通过 / ' + F + ' 失败');
    process.exit(F ? 1 : 0);
  });
});
