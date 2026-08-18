'use strict';
// ============================================================
// smoke-agent-mode-s3.js — 「模式 b · agent 模式」S3 守护写工具 + 校验闸守卫
//   验:真复用 PathUtils 真 mutate + 六步闸(黑名单/数值/玩家保护/引擎让步标记/写即报告) + 失败可见 + 注册
//   关键:require 真 tm-ai-change-pathutils.js(非 mock)·证「真复用现成」非另起炉灶
// ============================================================

const fs = require('fs');
const path = require('path');
const { ROOT, makeAssert } = require('./smoke-endturn-baseline-helpers');

const passed = { value: 0 };
const assert = makeAssert(passed);

// 真 PathUtils(证真复用)·再 write-tools
require(path.join(ROOT, 'tm-ai-change-pathutils.js'));
require(path.join(ROOT, 'tm-endturn-agent-write-tools.js'));

const PU = globalThis.TM && globalThis.TM.AIChange && globalThis.TM.AIChange.PathUtils;
const WT = globalThis.TM && globalThis.TM.Endturn && globalThis.TM.Endturn.AgentWriteTools;
assert(PU && typeof PU.applyPathSet === 'function', '真 PathUtils 已加载(复用源)');
assert(WT && typeof WT.handle === 'function', 'AgentWriteTools.handle 已导出');
assert(WT.defs().length >= 3 && WT.isToolName('set_field') && WT.isToolName('adjust_field') && WT.isToolName('push_field'), '3 个通用守护写工具在(S8 后另加语义工具)');
assert(!WT.isToolName('get_field'), 'isToolName 拒读工具');

function makeGM() {
  return {
    turn: 7, guoku: 12000, neitang: 3000,
    agentTest: { flag: 'off', counter: 10, list: [] },
    chars: [{ id: 'c1', name: '张三', mood: '平' }],
    _secret: 1, playerCharId: 'c1', evtLog: []
  };
}

(async function () {
  let gm = makeGM();
  let ctx = { GM: gm };

  // ── 真 mutate(自定义路径·避 normalizeCoreVarPath 歧义)──
  let r = await WT.handle('set_field', { path: 'agentTest.flag', value: 'on', reason: '测试设值' }, ctx);
  assert(r.ok && gm.agentTest.flag === 'on', 'set_field 真改 GM(agentTest.flag=on)');
  assert(/✓ 已改/.test(r.text), 'set_field 成功文案');

  r = await WT.handle('adjust_field', { path: 'agentTest.counter', delta: 5, reason: '增5' }, ctx);
  assert(r.ok && gm.agentTest.counter === 15, 'adjust_field 真改(10+5=15)');

  r = await WT.handle('push_field', { path: 'agentTest.list', value: { x: 1 }, reason: '追加' }, ctx);
  assert(r.ok && gm.agentTest.list.length === 1 && gm.agentTest.list[0].x === 1, 'push_field 真追加数组');

  // ── ⑥ 写即报告(产出焊缝)──
  assert(Array.isArray(gm._turnReport) && gm._turnReport.length === 3, '3 次成功写 → _turnReport 3 条');
  const e0 = gm._turnReport[0];
  assert(e0.type === 'change' && e0._agent === true && e0.path && ('new' in e0), 'report 条目 type=change/_agent/path/new(与模式a同构)');
  assert(Array.isArray(gm._agentWriteLog) && gm._agentWriteLog.length === 3, '_agentWriteLog 记 3 条(观测/对拍用)');

  // ── ① 黑名单:时序字段 turn ──
  r = await WT.handle('set_field', { path: 'turn', value: 999 }, ctx);
  assert(!r.ok && gm.turn === 7 && /黑名单/.test(r.text), '① set turn 被黑名单拦·turn 不变');
  // ① 黑名单:_ 内部字段
  r = await WT.handle('set_field', { path: '_secret', value: 2 }, ctx);
  assert(!r.ok && gm._secret === 1, '① set _secret(下划线内部)被拦');

  // ── ④ 玩家保护 ──
  r = await WT.handle('set_field', { path: 'playerCharId', value: 'cX' }, ctx);
  assert(!r.ok && gm.playerCharId === 'c1' && /玩家保护/.test(r.text), '④ set playerCharId 被玩家保护拦');
  assert(WT.isPlayerProtected('chars.0.isPlayer') === true, '④ isPlayerProtected 认 .isPlayer');

  // ── ② 数值合法 ──
  r = await WT.handle('adjust_field', { path: 'guoku', delta: NaN }, ctx);
  assert(!r.ok && /非法数值/.test(r.text), '② adjust NaN 被拦');

  // ── ⑤ 引擎让步标记 ──
  r = await WT.handle('set_field', { path: 'guoku', value: 15000, reason: '赏赐' }, ctx);
  assert(r.ok, '⑤ set guoku 成功');
  assert(gm._agentOverrides && gm._agentOverrides['guoku'], '⑤ 写引擎域 guoku → 打覆写标 _agentOverrides[guoku]');
  assert(WT.isEngineOwned('guoku') === true && WT.isEngineOwned('agentTest.flag') === false, '⑤ isEngineOwned 区分引擎域/非引擎域');
  // 非引擎域不打标
  assert(!gm._agentOverrides['agentTest.flag'], '⑤ 非引擎域 agentTest.flag 不打覆写标');

  // ── 失败可见性(landing-fix 同纪律)──
  assert(Array.isArray(gm._agentWriteFailed) && gm._agentWriteFailed.length >= 3, '失败写记入 _agentWriteFailed(可见)');
  const reasons = gm._agentWriteFailed.map(function (f) { return f.reason; });
  assert(reasons.indexOf('黑名单禁区') >= 0 && reasons.indexOf('玩家保护') >= 0, '失败原因含黑名单/玩家保护');

  // ── 未知工具兜底 ──
  r = await WT.handle('zap', {}, ctx);
  assert(r.ok === false && /未知写工具/.test(r.text), '未知写工具→兜底');

  // ── 源码/注册守卫 ──
  const indexSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const regWrite = indexSrc.indexOf('tm-endturn-agent-write-tools.js');
  const regPathUtils = indexSrc.indexOf('tm-ai-change-pathutils.js');
  const regRead = indexSrc.indexOf('tm-endturn-agent-read-tools.js');
  assert(regWrite >= 0, 'index.html 注册 tm-endturn-agent-write-tools.js');
  // PathUtils 依赖是 call-time 解析(endTurn 时所有脚本早已加载)·不要求加载顺序·仅须都注册
  assert(regPathUtils >= 0, 'PathUtils 已注册(写工具 call-time 解析)');
  assert(regRead >= 0 && regWrite > regRead, 'agent-mode 工具簇内聚(write 紧随 read)');

  console.log('[smoke-agent-mode-s3] pass assertions=' + passed.value);
})().catch(function (e) { console.error(e); process.exit(1); });
