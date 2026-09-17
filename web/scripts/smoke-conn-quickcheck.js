#!/usr/bin/env node
'use strict';
// smoke-conn-quickcheck — 「测试连接」连接体检（2026-07-04 全面加强模型能力检测）防腐线。
// 快检三小调用（连通/回声/流式/严格JSON）+ 判读报告卡 + 深度项转交既有探测 + 未保存值零污染。

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
function read(name) {
  return fs.readFileSync(path.join(ROOT, name), 'utf8');
}
function assert(cond, msg) {
  if (!cond) throw new Error('[assert] ' + msg);
}

// 第二十三拆：快检引擎(probeModelQuickCheck 等)迁 tm-ai-infra-model-detect.js·拼接(origin 先·契约随人走)
const infra = (read('tm-ai-infra-retry.js') + '\n' + read('tm-ai-infra.js')) + '\n' + read('tm-ai-infra-model-detect.js');
const patches = read('tm-patches.js');
const settings = read('tm-player-settings.js');

// ── 快检引擎（tm-ai-infra）──
assert(infra.includes('async function probeModelQuickCheck'), 'probeModelQuickCheck missing');
assert(infra.includes('tm-quick-v1'), 'strict-JSON quick probe payload missing');
assert(/stream:\s*true/.test(infra), 'stream SSE probe missing');
assert(infra.includes("quickCheck_secondary"), 'quickCheck history storage (secondary) missing');
assert(/_tmProbeFamily/.test(infra), 'model family compare helper referenced');
assert(infra.includes('疑中转偷换模型') || infra.includes('\\u75D1\\u4E2D\\u8F6C'), 'model-echo mismatch warning missing');

// ── 接线与报告卡（tm-patches）──
assert(/sTestConn/.test(patches) && /probeModelQuickCheck\(\{tier:'primary'/.test(patches), 'sTestConn not wired to quick check');
assert(/sTestSecondaryConn/.test(patches) && /probeModelQuickCheck\(\{tier:'secondary'/.test(patches), 'sTestSecondaryConn not wired to quick check');
assert(/function _sConnVerdict\(/.test(patches), 'verdict fn missing');
assert(/function _sRenderConnReport\(/.test(patches), 'report card renderer missing');
assert(/_probeRunEvidence\(' \+ t \+ '\)/.test(patches) || patches.includes("_probeRunEvidence(' + t + ')"), 'deep evidence handoff button missing');
assert(patches.includes("_probeRunOutput(' + t + ')"), 'measured-output handoff button missing');
assert(patches.includes("_showAvailableModels(' + t + ')"), 'model list handoff button missing');
// 未保存值零污染（体检临时应用后必须恢复）
assert(patches.includes('P.ai.key=_origKey; P.ai.url=_origUrl; P.ai.model=_origModel;'), 'primary temp-apply restore missing');
assert(patches.includes('P.ai.secondary.key=_orig.key'), 'secondary temp-apply restore missing');

// ── 校验页联动（tm-player-settings）──
assert(settings.includes('quickCheck_secondary : probe.quickCheck'), 'probe panel quick-check echo row missing');

console.log('smoke-conn-quickcheck PASS');
