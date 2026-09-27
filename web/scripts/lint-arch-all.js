#!/usr/bin/env node
// scripts/lint-arch-all.js — 架构守卫伞形入口（2026-07-04 架构四刀）
//
// 一条命令跑全部静态架构守卫（秒级，适合每刀收尾时跑）：
//   gm-writes（写口棘轮）→ dep-graph（依赖图+悬空棘轮）→ file-size（巨石棘轮）→ ref-check（既有断链检查）
// smoke 全量扫荡是慢路径，另走 run-smokes.js，不在此列。
//
// 用法：node scripts/lint-arch-all.js

'use strict';

const cp = require('child_process');
const path = require('path');

const CHECKS = [
  { name: 'lint-gm-writes', file: 'lint-gm-writes.js' },
  { name: 'lint-dep-graph', file: 'lint-dep-graph.js' },
  { name: 'lint-global-providers', file: 'lint-global-providers.js' },
  { name: 'lint-feature-boundaries', file: 'lint-feature-boundaries.js' },
  { name: 'lint-runtime-template-immutability', file: 'lint-runtime-template-immutability.js' },
  { name: 'lint-renderer-writeback-boundaries', file: 'lint-renderer-writeback-boundaries.js' },
  { name: 'lint-renderer-module-boundaries', file: 'lint-renderer-module-boundaries.js' },
  { name: 'lint-file-size', file: 'lint-file-size.js' },
  { name: 'lint-control-bytes', file: 'lint-control-bytes.js' },
  { name: 'lint-split-contracts', file: 'lint-split-contracts.js' },
  { name: 'lint-split-stamps', file: 'lint-split-stamps.js' },
  { name: 'lint-smoke-family-order', file: 'lint-smoke-family-order.js' },
  { name: 'lint-scenario-data', file: 'lint-scenario-data.js' },
  { name: 'lint-design-tokens', file: 'lint-design-tokens.js' },
  { name: 'ref-check', file: 'ref-check.js' }
];

let failed = 0;
for (const c of CHECKS) {
  const t0 = Date.now();
  const r = cp.spawnSync(process.execPath, [path.join(__dirname, c.file)], { encoding: 'utf8', windowsHide: true });
  const ok = r.status === 0;
  if (!ok) failed++;
  console.log(`[lint-arch-all] ${ok ? 'PASS' : 'FAIL'}  ${c.name} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  if (!ok) {
    const tail = (r.stdout + '\n' + r.stderr).split(/\r?\n/).filter(Boolean).slice(-15);
    tail.forEach(l => console.log('    ' + l));
  }
}
console.log(`\n[lint-arch-all] ${failed === 0 ? 'PASS — 架构守卫全绿' : `FAIL — ${failed}/${CHECKS.length} 项未过`}`);
process.exit(failed === 0 ? 0 : 1);
