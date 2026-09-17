'use strict';
// smoke-agent-trunc-selfheal.js — 刀H2(2026-07-02·CC max_tokens 动态调整对照)
//   回合推演 agent 输出截断自愈:深化/落地工具带长入参·输出上限(默认2400)腰斩时此前直接
//   `if (!calls.length) break` 弃整轮转 scaffold。现 infra 纯增量 truncated 字段 + 循环检测
//   → 上限×2重试本轮(≤2次·封顶9600)·截断叙事不污染 state.narrative。

const fs = require('fs');
const path = require('path');
const { ROOT, makeAssert } = require('./smoke-endturn-baseline-helpers');
const passed = { value: 0 };
const assert = makeAssert(passed);

// ── ① infra 源契约:callAIWithTools 返回带纯增量 truncated(三家 finish_reason) ──
const infraSrc = (fs.readFileSync(path.join(ROOT, 'tm-ai-infra-retry.js'), 'utf8') + '\n' + fs.readFileSync(path.join(ROOT, 'tm-ai-infra.js'), 'utf8'));
assert(/return \{ text: text, toolCalls: toolCalls, truncated: _truncH2 \};/.test(infraSrc), '① infra 工具调用返回带 truncated 字段(纯增量·不读则如旧)');
assert(/finish_reason === 'length'/.test(infraSrc) && /data\.stop_reason === 'max_tokens'/.test(infraSrc) && /finishReason === 'MAX_TOKENS'/.test(infraSrc), '① 三家截断信号全覆盖(OpenAI/Anthropic/Gemini)');

// ── ② agent-mode 源契约:截断分支在 narrative 赋值之前(截断叙事不污染产出) ──
const modeSrc = fs.readFileSync(path.join(ROOT, 'tm-endturn-agent-mode.js'), 'utf8').replace(/\r/g, '');
const truncIdx = modeSrc.indexOf('resp.truncated && !(Array.isArray(resp.toolCalls)');
const narrIdx = modeSrc.indexOf('if (resp.text && !state.narrative) state.narrative = resp.text;');
assert(truncIdx > 0 && narrIdx > truncIdx, '② 截断重试分支先于 narrative 赋值(截断文本不入产出)');
assert(/round--; continue;/.test(modeSrc) && /_tokBump < 2/.test(modeSrc), '② 重试同一轮·≤2 次熔断');

// ── ③ 行为:真跑 run()·首轮截断 → maxTok 2400→4800 重试 → 落地 → 完成 ──
(async function () {
  require(path.join(ROOT, 'tm-ai-change-pathutils.js'));
  require(path.join(ROOT, 'tm-endturn-agent-read-tools.js'));
  require(path.join(ROOT, 'tm-endturn-agent-write-tools.js'));
  require(path.join(ROOT, 'tm-endturn-agent-mode.js'));
  const AM = globalThis.TM.Endturn.AgentMode;
  const gm = { turn: 7, guoku: 12000, neitang: 3000, chars: [{ id: 'c1', name: '张三' }], facs: [{ name: '北府' }], evtLog: [], memorials: [], _turnReport: [] };
  const ctx = { GM: gm, input: {}, results: {} };
  globalThis.P = { conf: {} };
  globalThis._endTurn_updateSystems = async function () { gm.turn += 1; return { ok: true }; };
  let call = 0; const seenTok = [];
  globalThis.callAIWithTools = async function (prompt, tools, opts) {
    call++; seenTok.push(opts && opts.maxTok);
    if (call === 1) return { text: '写到一半被上限腰斩的叙事……', toolCalls: [], truncated: true };
    if (call === 2) return { text: '拨款赈灾', toolCalls: [{ name: 'adjust_field', input: { path: 'guoku', delta: -1500, reason: '赈灾拨款' } }] };
    return { text: '', toolCalls: [] };   // 其后(循环退出/scaffold 等)一律安静
  };
  const res = await AM.run(ctx);
  assert(res && res.ok === true, '③ 截断自愈后回合正常完成(不回落)');
  assert(seenTok[0] === 2400 && seenTok[1] === 4800, '③ 首轮截断 → 输出上限 2400→4800 重试同轮(实测 ' + seenTok.slice(0, 2).join('/') + ')');
  assert(gm.guoku === 10500, '③ 重试轮的落地写入生效(guoku 12000→10500)');
  console.log('PASS · ' + passed.value + ' 断言');
})().catch(function (e) { console.error(e); process.exit(1); });
