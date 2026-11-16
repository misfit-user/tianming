'use strict';
// ============================================================
// smoke-agent-mode-s5.js — 「模式 b · agent 模式」S5 甲案 engine-first + 安全闭环守卫
//   验:① 引擎先算(engine-first 在 agent 前跑·置 _systemsRan) ② 快照/自检/回滚单元
//       ③ 引擎抛错→回滚并留在 Agent ④ 自检不过→回滚并留在 Agent ⑤ systems 步幂等源码守卫
//   注:真 50-tick 引擎 node 跑不动·此处用 stub 验**编排逻辑**;真集成留真机验。
// ============================================================

const path = require('path');
const { ROOT, makeAssert } = require('./smoke-endturn-baseline-helpers');

const passed = { value: 0 };
const assert = makeAssert(passed);

require(path.join(ROOT, 'tm-ai-change-pathutils.js'));
require(path.join(ROOT, 'tm-endturn-agent-read-tools.js'));
require(path.join(ROOT, 'tm-endturn-agent-write-tools.js'));
require(path.join(ROOT, 'tm-endturn-agent-mode.js'));

const AM = globalThis.TM.Endturn.AgentMode;
assert(typeof AM._stage === 'string' && AM._stage.length > 0, '_stage 为进度标记字符串(随刀推进·不锁具体值)');

function makeGM() {
  return { turn: 7, eraName: '建炎元年', guoku: 12000, neitang: 3000, chars: [{ id: 'c1', name: '张三', mood: '平' }], facs: [{ name: '北府' }], evtLog: [], memorials: [], _turnReport: [] };
}
function setScript(arr) { let i = 0; globalThis.callAIWithTools = async function () { return arr[i++] || { toolCalls: [], text: '' }; }; }

// ── ② 安全闭环单元:selfCheck / snapshot / rollback ──
// 健康的回合末 GM 须有产出(_turnReport 非空)·每个 bad fixture 只坏一处
function healthyGM() { var g = makeGM(); g._turnReport = [{ type: 'narrative', text: 'x' }]; return g; }
assert(AM.selfCheck(healthyGM()).ok === true, 'selfCheck:健康 GM(有产出) → ok');
let bad = healthyGM(); bad.guoku = NaN;
assert(AM.selfCheck(bad).ok === false, 'selfCheck:guoku=NaN → 不过');
bad = healthyGM(); bad._turnReport = [];
assert(AM.selfCheck(bad).ok === false, 'selfCheck:_turnReport 空 → 不过(无产出)');
bad = healthyGM(); bad.chars = { broken: 1 };
assert(AM.selfCheck(bad).ok === false, 'selfCheck:chars 非数组 → 不过');
bad = healthyGM(); bad.turn = 'x';
assert(AM.selfCheck(bad).ok === false, 'selfCheck:turn 非法 → 不过');
// ★真实游戏:guoku/neitang 是结构化对象(fiscal-engine 形状)·不能误判"非有限数"(否则 agent 模式永远自检失败→静默回落)
let objG = healthyGM(); objG.guoku = { balance: 1000000, ledgers: {} }; objG.neitang = { balance: 5000 };
assert(AM.selfCheck(objG).ok === true, 'selfCheck:对象形 guoku/neitang(真实游戏形状)→ ok(不误判)');
let objBad = healthyGM(); objBad.guoku = { balance: NaN };
assert(AM.selfCheck(objBad).ok === false, 'selfCheck:对象形 guoku.balance=NaN → 仍判坏');

let g = makeGM(); const snap = AM.snapshot(g);
g.turn = 99; g.guoku = -1; g.chars.push({ name: '李四' }); const c = { input: { _systemsRan: true } };
assert(AM.rollback(g, snap, c) === true && g.turn === 7 && g.guoku === 12000 && g.chars.length === 1, 'rollback:原地还原 GM');
assert(c.input._systemsRan === undefined, 'rollback:清 _systemsRan(让 mode a 重跑引擎)');

(async function () {
  // ── ① engine-first:引擎在 agent 前跑·agent 看真数·置 _systemsRan ──
  let gm = makeGM(); let ctx = { GM: gm, input: { edicts: ['赈灾'] }, results: {} };
  globalThis.P = undefined;
  let engineRanBeforeAgent = null;
  globalThis._endTurn_updateSystems = async function () { gm.turn += 1; gm.guoku += 500; gm._engineBaseline = true; return { ok: true, appliedCount: 2, failedCount: 0 }; }; // 模拟引擎:turn++ + 税入500
  // cawt:首次调用时记录「引擎是否已先跑」(证 engine-first 排序)
  const script = [
    { toolCalls: [{ name: 'adjust_field', input: { path: 'guoku', delta: -1000, reason: '赈灾拨款' } }], text: '' },
    { toolCalls: [{ name: 'finalize_turn', input: { narrative: '开仓赈灾', summary: '赈灾' } }], text: '' }
  ];
  let si = 0;
  globalThis.callAIWithTools = async function () { if (engineRanBeforeAgent === null) engineRanBeforeAgent = !!gm._engineBaseline; return script[si++] || { toolCalls: [], text: '' }; };
  let res = await AM.run(ctx);
  assert(res.ok === true && res.fallback === false, '① engine-first happy → 提交');
  assert(engineRanBeforeAgent === true, '① 引擎在 agent 首轮之前已跑(看真数)');
  assert(gm.turn === 8, '① 引擎 turn++ 生效(7→8)');
  assert(ctx.input._systemsRan === true, '① 置 _systemsRan(后续 systems 步幂等跳)');
  assert(ctx.results.queueResult && ctx.results.queueResult.appliedCount === 2, '① engine-first 返回 queueResult 须保留给 render/legacy 消费');
  // agent 在引擎基线(12000+500=12500)之上 -1000 = 11500
  const ge = gm._turnReport.find(function (e) { return e.type === 'change' && /guoku/.test(String(e.path)); });
  assert(ge && ge.old === 12500 && ge.new === 11500, '① agent 在引擎真数(12500)之上覆写→11500');
  assert(gm._agentTurnMeta.engineFirst === true && gm._agentTurnMeta.resolutionTurn === 7, '① meta:engineFirst + resolutionTurn=7(引擎前)');

  // ── ③ 引擎抛错(已部分 mutate)→ 显式回滚 + Agent 失败 ──
  gm = makeGM(); ctx = { GM: gm, input: {} };
  globalThis._endTurn_updateSystems = async function () { gm.turn += 1; gm.guoku = 999; throw new Error('引擎炸'); };
  setScript([{ toolCalls: [], text: '' }]);
  res = await AM.run(ctx);
  assert(res.fallback === false && res.mode === 'agent' && /引擎基线/.test(res.reason || ''), '③ 引擎抛错 → Agent 失败且不穿越 LLM');
  assert(gm.turn === 7 && gm.guoku === 12000, '③ 引擎部分 mutate 被回滚(turn/guoku 还原)');
  assert(ctx.input._systemsRan === undefined, '③ 回滚清 _systemsRan');

  // ── ④ 自检不过(引擎留下 NaN·agent 有落地非退化)→ 回滚 + Agent 失败 ──
  gm = makeGM(); ctx = { GM: gm, input: {} };
  globalThis._endTurn_updateSystems = async function () { gm.turn += 1; gm.guoku = NaN; }; // 引擎产出坏值
  setScript([
    { toolCalls: [{ name: 'set_field', input: { path: 'chars.0.mood', value: '忧', reason: '心绪' } }], text: '' },
    { toolCalls: [{ name: 'finalize_turn', input: { summary: '推演' } }], text: '' }
  ]);
  res = await AM.run(ctx);
  assert(res.fallback === false && res.mode === 'agent' && /自检/.test(res.reason || ''), '④ 状态自检不过(guoku=NaN)→ Agent 失败且不穿越 LLM');
  assert(gm.turn === 7 && !Number.isNaN(gm.guoku) && gm.guoku === 12000, '④ 自检失败 → 回滚还原(guoku 复原)');

  // ── 引擎缺失时优雅降级(不跑 engine-first·仍走 agent)——证 engine-first 是可选增强 ──
  gm = makeGM(); ctx = { GM: gm, input: {} };
  delete globalThis._endTurn_updateSystems;
  setScript([{ toolCalls: [{ name: 'set_field', input: { path: 'chars.0.mood', value: '安', reason: 'x' } }, { name: 'finalize_turn', input: { summary: 's' } }], text: '' }]);
  res = await AM.run(ctx);
  assert(res.ok === true && gm._agentTurnMeta.engineFirst === false, '引擎缺失 → engineFirst=false 仍正常提交(优雅降级)');

  // ── ⑤ systems 步幂等源码守卫 ──

  console.log('[smoke-agent-mode-s5] pass assertions=' + passed.value);
})().catch(function (e) { console.error(e); process.exit(1); });
