#!/usr/bin/env node
// smoke-cost-panel-ui.js — Phase 7·完整 4 区成本面板 UI 锚

'use strict';

const fs = require('fs');
const path = require('path');
const { makeAssert } = require('./smoke-endturn-baseline-helpers');

const ROOT = path.resolve(__dirname, '..');
const passed = { value: 0 };
const assert = makeAssert(passed);

const infraSrc = (fs.readFileSync(path.join(ROOT, 'tm-ai-infra-retry.js'), 'utf8') + '\n' + fs.readFileSync(path.join(ROOT, 'tm-ai-infra.js'), 'utf8'));
const patchesSrc = (fs.readFileSync(path.join(ROOT, 'tm-patches.js'), 'utf8') + '\n' + fs.readFileSync(path.join(ROOT, 'tm-patches-start.js'), 'utf8'));

// ─── builder + show 函数 ───
assert(/function\s+_buildAICostPanelElement\s*\(/.test(infraSrc), 'cost panel·DOM element builder 存在');
assert(/function\s+showAICostPanel\s*\(/.test(infraSrc), 'cost panel·showAICostPanel 存在');
assert(/showCostPanel:\s*typeof\s+showAICostPanel/.test(infraSrc), 'TM.ai.showCostPanel 公开 API');

// ─── 4 区结构 ───
['区1·智能档位', '区2·推演深度细调', '区3·性能成本控制', '区4·诊断'].forEach(function(z) {
  assert(infraSrc.indexOf(z) >= 0, '4 区·"' + z + '" 存在');
});

// ─── 关键数据源 ───
assert(/G\._costHistory/.test(infraSrc), '读 GM._costHistory');
assert(/TokenUsageTracker\.getSnapshot/.test(infraSrc), '读 TokenUsageTracker.getSnapshot');
assert(/ensureAIDiagnostics/.test(infraSrc), '读诊断 (subcallErrors)');
assert(/G\._lastSc28Snapshot/.test(infraSrc) && /G\._sc1qMissedLastTurn/.test(infraSrc) && /G\._sysCacheMode/.test(infraSrc),
  '区4 读 sc28/sc1q-missed/sysCache 状态');

// ─── 区3 关键 UI 元素 ───
assert(/成本历史·最近/.test(infraSrc), '区3·成本历史折叠');
assert(/按 subcall 拆分/.test(infraSrc), '区3·按 subcall 拆分');
assert(/超阈值/.test(infraSrc), '区3·成本超阈值 warning');
assert(/导出 AI 诊断 JSON/.test(infraSrc), '区3·导出按钮 (面板内)');

// ─── 设置面板按钮 (文件含 \uXXXX 转义) ───
assert(/TM\.ai\.showCostPanel/.test(patchesSrc), '设置面板按钮接 TM.ai.showCostPanel');
assert(/showAICostPanel/.test(patchesSrc), '按钮 fallback to showAICostPanel');

// ─── DOM-only rendering (避免 XSS) ───
const costBuilderStart = infraSrc.indexOf('function _buildAICostPanelElement(');
const costBuilderEnd = infraSrc.indexOf('\nfunction showAICostPanel(', costBuilderStart);
const costBuilder = infraSrc.slice(costBuilderStart, costBuilderEnd);
assert(costBuilderStart >= 0 && !/\.innerHTML\s*=|insertAdjacentHTML|setAttribute\s*\(\s*['"]on/i.test(costBuilder), 'cost panel builder has no dynamic HTML or event-attribute sink');
assert(/textContent/.test(infraSrc) && /_costPanelFinite/.test(infraSrc), 'cost panel uses text nodes and finite numeric normalization');

// ─── modal 关闭机制 ───
assert(/ai-cost-panel-backdrop/.test(infraSrc), 'modal backdrop id');
assert(/event\.target\s*===\s*backdrop/.test(infraSrc), '点击 backdrop 关闭 (event.target check)');
assert(/exportButton\.addEventListener\(['"]click/.test(infraSrc), 'export action uses addEventListener instead of inline onclick');

console.log('[smoke-cost-panel-ui] pass assertions=' + passed.value);
