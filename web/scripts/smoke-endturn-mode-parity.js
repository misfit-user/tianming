'use strict';
// 正式游戏 LLM/Agent 平行模式：入口互斥、能力对应、失败不穿越。
const path = require('path');
const { ROOT, makeAssert } = require('./smoke-endturn-baseline-helpers');
const passed = { value: 0 };
const assert = makeAssert(passed);

require(path.join(ROOT, 'tm-agent-kernel.js'));
const MC = require(path.join(ROOT, 'tm-endturn-mode-contract.js'));
assert(MC.MODES.join(',') === 'llm,agent', '正式模式仅有平行的 llm/agent 两入口');
const parity = MC.assertParity();
assert(parity.ok && parity.total >= 14, 'LLM/Agent 能力对应表完整');
assert(MC.selectedMode({ conf: {} }) === 'llm', '默认选 LLM');
assert(MC.selectedMode({ conf: { agentModeEnabled: true } }) === 'agent', '玩家选择 Agent 时只选 Agent');
assert(MC.selectedMode({ conf: { experimentalEnabled: true, experimentalMode: 'agent' } }) === 'agent', '实验模式选择 Agent 时只选 Agent');

const ar = MC.normalizeResult({ summary: 'x' }, 'agent');
assert(ar.agentMode === true && ar.mode === 'agent' && Array.isArray(ar.personnelChanges), 'Agent 结果归一到共同 aiResult 契约');
assert(MC.validateResult(ar, 'agent').ok, '归一后的 Agent 结果通过契约');
assert(!MC.validateResult({ agentMode: true, personnelChanges: [], suggestions: [] }, 'llm').ok, 'LLM 结果不能冒充 Agent');

console.log('[smoke-endturn-mode-parity] pass assertions=' + passed.value);
