'use strict';
// ============================================================
// smoke-agent-mode-s6.js — 「模式 b · agent 模式」S6 实验模式 UI + 门控守卫
//   验:① 门控(实验模式开+选agent → agentModeOn;LLM升级与agent模式互斥) ② 现有flag零回归
//       ③ UI 三段(总闸/模式选择/两模式内容) ④ "agent升级"正名"LLM升级" ⑤ handlers 存在
// ============================================================

const fs = require('fs');
const path = require('path');
const { ROOT, makeAssert } = require('./smoke-endturn-baseline-helpers');

const passed = { value: 0 };
const assert = makeAssert(passed);

require(path.join(ROOT, 'tm-agent-flags.js'));
const agentModeOn = globalThis.agentModeOn, agentFlagOn = globalThis.agentFlagOn;

// ── ① 门控:实验模式 + 模式选择 ──
globalThis.P = undefined;
assert(agentModeOn() === false && agentFlagOn('x') === false, '默认(无P):两者皆 false');

globalThis.P = { conf: { agentUpgradesEnabled: true } };
assert(agentModeOn() === false, 'LLM升级总闸开·非agent模式 → agentModeOn=false');
assert(agentFlagOn('anyUpgrade') === true, 'LLM升级总闸开 → agentFlagOn=true(LLM模式正常)');

globalThis.P = { conf: { experimentalEnabled: true, experimentalMode: 'agent' } };
assert(agentModeOn() === true, '实验模式开+选agent → agentModeOn=true');
assert(agentFlagOn('anyUpgrade') === false, '★互斥:agent模式下 LLM升级一律关(agentFlagOn=false)');

globalThis.P = { conf: { experimentalEnabled: true, experimentalMode: 'llm', agentUpgradesEnabled: true } };
assert(agentModeOn() === false, '实验模式开+选llm → agentModeOn=false');
assert(agentFlagOn('anyUpgrade') === true, 'LLM模式下 LLM升级正常 true');

globalThis.P = { conf: { experimentalEnabled: true, experimentalMode: 'agent', agentUpgradesEnabled: true } };
assert(agentModeOn() === true && agentFlagOn('anyUpgrade') === false, '★互斥铁证:即便LLM总闸也开·agent模式下仍关 LLM升级');

globalThis.P = { conf: { agentModeEnabled: true } };
assert(agentModeOn() === true, 'legacy agentModeEnabled(测试/控制台旁路)仍认');

globalThis.P = { conf: { experimentalEnabled: true } };
assert(agentModeOn() === false, '只开实验模式未选agent(mode缺) → agentModeOn=false');

// ── ② 现有 flag 独立开关零回归(非agent模式下) ──
globalThis.P = { conf: { courtDebateEnabled: true } };
assert(agentFlagOn('courtDebateEnabled') === true && agentFlagOn('other') === false, '独立开关零回归(非agent模式)');

// ── ③④ UI 源码守卫(tm-patches.js) ──
const patchSrc = (fs.readFileSync(path.join(ROOT, 'tm-patches.js'), 'utf8') + '\n' + fs.readFileSync(path.join(ROOT, 'tm-patches-start.js'), 'utf8'));
assert(/s-exp-enabled/.test(patchSrc) && /_toggleExperimentalEnabled/.test(patchSrc), '③ 总闸 toggle(s-exp-enabled+handler)');
// 注:onchange 内是 JS 字符串·单引号被转义为 \'·故宽松匹配 handler 名 + 两模式标签
assert(/name="exp-mode"/.test(patchSrc) && patchSrc.indexOf('_setExperimentalMode(') >= 0, '③ 模式选择 radio + handler 调用');
assert(patchSrc.indexOf('🧠 LLM 模式') >= 0 && patchSrc.indexOf('🤖 Agent 模式') >= 0, '③ 两模式标签(LLM/Agent)齐');
assert(patchSrc.indexOf('🧪 实验模式') >= 0, '③ 区头正名"🧪 实验模式"');
assert(patchSrc.indexOf('回合推演 agent 化') >= 0 && patchSrc.indexOf('局内') >= 0, '③ Agent 模式内容(回合推演 agent化)');
assert(patchSrc.indexOf('启用全部 LLM 升级') >= 0, '④ "agent升级"已正名"LLM 升级"');
assert(patchSrc.indexOf('启用全部 agent 升级') < 0, '④ 旧名"启用全部 agent 升级"已无');
assert(patchSrc.indexOf('🧪 实验玩法') < 0, '④ 旧区头"🧪 实验玩法"已无');
// 原有 toggle 保留(移入 LLM 分支)；「势力按需取数」(s-faction-toolcall) 11-11 已撤：势力调度一次问完
assert(/s-office-activation/.test(patchSrc) && /s-event-unification/.test(patchSrc) && !/s-faction-toolcall/.test(patchSrc), '③ 原 LLM 升级 toggle(官制/事件)保留，势力按需取数已撤');
assert(/s-agent-upgrades/.test(patchSrc), '③ LLM 升级总闸 checkbox(id 留 s-agent-upgrades)保留');

// ── ⑤ handlers(tm-player-settings.js) ──
const psSrc = fs.readFileSync(path.join(ROOT, 'tm-player-settings.js'), 'utf8');
assert(/function _toggleExperimentalEnabled/.test(psSrc) && /function _setExperimentalMode/.test(psSrc), '⑤ 两 handler 已定义');
assert(/experimentalMode\s*=\s*\(mode === 'agent'\)/.test(psSrc), '⑤ _setExperimentalMode 写 experimentalMode');

// ── 门控源码守卫(tm-agent-flags.js) ──
const flagSrc = fs.readFileSync(path.join(ROOT, 'tm-agent-flags.js'), 'utf8');
assert(/if \(agentModeOn\(\)\) return false;/.test(flagSrc), '互斥守卫在 agentFlagOn 内');
assert(/experimentalMode\) === 'agent'/.test(flagSrc), 'agentModeOn 认 experimentalMode===agent');

console.log('[smoke-agent-mode-s6] pass assertions=' + passed.value);
