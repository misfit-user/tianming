#!/usr/bin/env node
'use strict';
/* smoke-battle-observe — 御驾亲征 v2·O12 他方战事旁观(战况重演)
 *   ★铁律:抽象战果照常即时落地(v1 语义不变)·旁观纯视觉战果丢弃。
 *   flag GM._yujiaObserve 默认 OFF;开启→纯 NPC 战在咽喉透传前快照双方名册(变异前拷贝)→会战阶段末列表重演。
 */
const path = require('path');
let A = 0, F = 0; function ok(c, m) { if (c) { A++; console.log('  ✓ ' + m); } else { F++; console.log('  ✗ FAIL: ' + m); } }
console.log('smoke-battle-observe');

const applied = [];
global.window = {};
global.document = { addEventListener: function () {} };
global.window.MilitarySystems = { applyBattleResult: function (br, GM) {   // stub 咽喉:落地时真扣兵(证快照取的是变异前值)
  applied.push(br);
  (br && br.affectedArmies || []).forEach(function (aa) { var a = (GM.armies || []).find(function (x) { return x && x.id === aa.armyId; }); if (a) a.soldiers = Math.max(0, a.soldiers - (aa.loss || 0)); });
} };
global.window.P = { playerInfo: { factionName: '明' } };
global.window.GM = { _yujiaQinzheng: false, _yujiaObserve: false, armies: [
  { id: 'n1', faction: '后金', name: '正白旗', soldiers: 8000, composition: [{ type: '铁骑', count: 8000 }], location: '辽东' },
  { id: 'n2', faction: '察哈尔', name: '察哈尔骑', soldiers: 6000, composition: [{ type: '骑兵', count: 6000 }] },
  { id: 'p1', faction: '明', name: '京营', soldiers: 9000, composition: [{ type: '步兵', count: 9000 }] }
] };
const GM = global.window.GM;
const TURN = require(path.resolve(__dirname, '..', 'tm-battle-turn.js'));
const npcBr = () => ({ winnerFactionId: '后金', loserFactionId: '察哈尔', affectedArmies: [{ armyId: 'n1', loss: 500 }, { armyId: 'n2', loss: 1500 }] });

/* ① flag OFF → 不快照·抽象照常 */
applied.length = 0;
global.window.MilitarySystems.applyBattleResult(npcBr(), GM);
ok(applied.length === 1 && TURN._observePending().length === 0, '① flag OFF→不快照·抽象照常落地(零变更)');

/* ② flag ON + 纯NPC战 → 抽象仍即时落地(铁律) + 变异前快照 */
GM._yujiaObserve = true; GM.armies[0].soldiers = 8000; GM.armies[1].soldiers = 6000; applied.length = 0; TURN._clearObserve();
global.window.MilitarySystems.applyBattleResult(npcBr(), GM);
ok(applied.length === 1, '② 旁观开启→抽象战果仍即时落地(O12 v1 语义不变·铁律)');
const obs = TURN._observePending();
ok(obs.length === 1 && obs[0].facA === '后金' && obs[0].facB === '察哈尔', '② 快照捕获·分边 后金 vs 察哈尔');
ok(obs[0].menA === 8000 && obs[0].menB === 6000, '② 快照=变异前兵力(8000/6000·咽喉已扣至7500/4500)');
ok(GM.armies[0].soldiers === 7500 && GM.armies[1].soldiers === 4500, '② 真军已被抽象扣损(快照是拷贝非引用)');
ok(obs[0].sideA[0].composition.length === 1 && obs[0].sideA[0].id === 'n1', '② 快照带 composition(供 buildBattleConfig 派生兵牌)');
ok(obs[0].provinceName === '辽东', '② 快照带省名(地形档解析用)');

/* ③ 涉玩家战 → 不快照(玩家自己的战走亲征/庙算·非旁观) */
TURN._clearObserve(); applied.length = 0;
global.window.MilitarySystems.applyBattleResult({ winnerFactionId: '明', loserFactionId: '后金', affectedArmies: [{ armyId: 'p1', loss: 300 }, { armyId: 'n1', loss: 400 }] }, GM);
ok(applied.length === 1 && TURN._observePending().length === 0, '③ 涉玩家(明)战→不入旁观列表');

/* ④ _fromTactical 回填 → 不快照(防环) */
TURN._clearObserve(); applied.length = 0;
global.window.MilitarySystems.applyBattleResult(Object.assign(npcBr(), { _fromTactical: true }), GM);
ok(TURN._observePending().length === 0, '④ 战术回填→不快照(防环)');

/* ⑤ 上限4场/回合(防弹窗轰炸) */
TURN._clearObserve();
for (let i = 0; i < 6; i++) { GM.armies[0].soldiers = 8000; GM.armies[1].soldiers = 6000; global.window.MilitarySystems.applyBattleResult(npcBr(), GM); }
ok(TURN._observePending().length === 4, '⑤ 快照封顶4场·实=' + TURN._observePending().length);

/* ⑥ headless runPending → _offerObserve 即返·列表排空(splice)不外泄 */
(async () => {
  await TURN.runPending(GM);
  ok(TURN._observePending().length === 0, '⑥ headless runPending→旁观列表排空(无 DOM 即返·不滞留)');

  /* ⑦ 源契约:原型 observe 封指挥·config.observe 传递·设置开关 */

  /* ⑧ 开关处理器 */
  global.window._tmSetYujiaObserve(false, null);
  ok(GM._yujiaObserve === false, '⑧ _tmSetYujiaObserve(false)→flag 关');
  global.window._tmSetYujiaObserve(true, null);
  ok(GM._yujiaObserve === true, '⑧ _tmSetYujiaObserve(true)→flag 开');

  console.log('\n结果: ' + A + ' 通过 / ' + F + ' 失败');
  process.exit(F ? 1 : 0);
})();
