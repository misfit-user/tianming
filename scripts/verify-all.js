#!/usr/bin/env node
// scripts/verify-all.js — 一键跑齐 4 项安全检查 (R149)
//
// 顺序：syntax-check → ref-check → find-orphans → headless-smoke
// 任一失败即非零退出·成功后打印汇总 baseline
//
// 用法：node scripts/verify-all.js
//
// 与逐个跑的区别：
//   · 单输出·避免拷贝 4 条命令
//   · 失败立即停止 (fail-fast)·节省 smoke 的 30s
//   · 末尾汇总 baseline 行·便于 commit message 引用

'use strict';
const cp = require('child_process');
const path = require('path');
const SCRIPTS = path.resolve(__dirname);

// smoke 已知 baseline·允许改善但不允许退步 (R148 把 207/4 推进到 208/3)
const SMOKE_BASELINE = { minPass: 207, maxFail: 4 };

const checks = [
  { name: 'syntax-check', file: 'syntax-check.js',     estSec: 17, expectExit: 0 },
  { name: 'ref-check',    file: 'ref-check.js',        estSec: 1,  expectExit: 0 },
  { name: 'find-orphans', file: 'find-orphans.js',     estSec: 1,  expectExit: 0 },
  { name: 'smoke',        file: 'headless-smoke.js',   estSec: 30, expectExit: null },   // 用 baseline 判断
  { name: 'cc3-smoke',    file: 'smoke-chaoyi-v3.js',  estSec: 1,  expectExit: 0 }       // 常朝 v3 纯逻辑 smoke
];

let totalSec = 0;
const results = [];

for (const c of checks) {
  process.stdout.write(`[verify-all] ▶ ${c.name} (~${c.estSec}s)... `);
  const t0 = Date.now();
  const r = cp.spawnSync('node', [path.join(SCRIPTS, c.file)], { encoding: 'utf8' });
  const dt = ((Date.now() - t0)/1000).toFixed(1);
  totalSec += parseFloat(dt);

  let ok;
  if (c.name === 'smoke') {
    // 解析 stdout 里的 {"passed":N,"failed":M} JSON 行
    const m = (r.stdout || '').match(/"passed"\s*:\s*(\d+)\s*,\s*"failed"\s*:\s*(\d+)/);
    if (m) {
      const passed = +m[1], failed = +m[2];
      ok = (passed >= SMOKE_BASELINE.minPass && failed <= SMOKE_BASELINE.maxFail);
      if (!ok) process.stderr.write('\n[smoke] baseline 退步 (期望 ≥' + SMOKE_BASELINE.minPass + ' pass / ≤' + SMOKE_BASELINE.maxFail + ' fail · 实测 ' + passed + '/' + failed + ')\n');
    } else {
      ok = false;
      process.stderr.write('\n[smoke] 无法解析 passed/failed JSON\n');
    }
  } else {
    ok = r.status === 0;
  }

  process.stdout.write((ok?'\x1b[32m✓':'\x1b[31m✗') + '\x1b[0m  ' + dt + 's\n');
  results.push({ name: c.name, ok, dt, stdout: r.stdout, stderr: r.stderr });
  if (!ok) {
    process.stderr.write('\n[verify-all] ✗ ' + c.name + ' 失败·中止后续检查\n\n');
    process.stderr.write(r.stdout || '');
    process.stderr.write(r.stderr || '');
    process.exit(1);
  }
}

// 汇总末尾 baseline 行
console.log('\n[verify-all] 全部 5 项通过 · 总耗时 ' + totalSec.toFixed(1) + 's\n');
for (const r of results) {
  // 抽 stdout 里关键 1 行
  const lines = (r.stdout || '').split('\n').filter(Boolean);
  const tail = lines.slice(-2).filter(function(l){ return /✓|pass|fail|有效|没有|测试返回值/.test(l); }).slice(-1)[0] || lines.slice(-1)[0] || '';
  console.log('  · ' + r.name.padEnd(14) + tail.trim());
}
process.exit(0);
