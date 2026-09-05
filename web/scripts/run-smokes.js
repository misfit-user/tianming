#!/usr/bin/env node
// scripts/run-smokes.js — 架构四刀之三：smoke 统一 runner（2026-07-04）
//
// scripts/ 下 670+ 个 smoke-*.js 一直没有统一入口，「这刀该跑哪些」全靠人肉 grep。
// 本 runner 做四件事：发现、并发跑、超时熔断、失败聚类。
// 与 verify-all.js 分工：verify-all = 手工精选的快速门禁（fail-fast）；
// run-smokes = 全量/按主题的发现式扫荡（周期性跑或大改后跑）。
//
// 用法：
//   node scripts/run-smokes.js --grep tinyi          # 只跑名字含 tinyi 的
//   node scripts/run-smokes.js --grep tinyi --grep class   # 多个 grep = 并集
//   node scripts/run-smokes.js --list                # 只列出会跑哪些，不执行
//   node scripts/run-smokes.js --jobs 8 --timeout 90 # 并发数 / 单脚本秒数上限
//   node scripts/run-smokes.js --all                 # 忽略 NORUN 标记和 skip 清单
//   node scripts/run-smokes.js                       # 全量（几百个，喝口茶）
//
// 约定（沿袭现有 smoke 生态）：
//   - PASS = 退出码 0 且输出无行首 FAIL；退出码 0 但输出带 FAIL → 记为 suspect（脚本忘了 exit 1）
//   - 失败 ≤15 个时自动串行重跑一次：过了标 flaky（汇总/报告单列·不掩盖）·--no-retry 关闭（严格模式）
//   - scripts/_<TOKEN>_NORUN.flag 存在 → 跳过名字含 <token> 的 smoke（并行会话施工标记）
//   - scripts/arch-baselines/smoke-skip.json 登记已知不能 headless 跑的脚本及原因
//   - 报告落 dev-tools/arch-guard/smoke-report.json

'use strict';

const lib = require('./lib-arch-guard');
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const os = require('os');

const SCRIPTS_DIR = __dirname;
const SKIP_FILE = path.join(lib.BASELINE_DIR, 'smoke-skip.json');

const args = process.argv.slice(2);
const REPORT_FILE = path.resolve(flagVal('--report', path.join(lib.REPORT_DIR, 'smoke-report.json')));
const RUN_ID = flagVal('--run-id', require('crypto').randomUUID());
const HEAD = cp.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: SCRIPTS_DIR, encoding: 'utf8' }).trim();
function flagVal(name, dflt) {
  const i = args.indexOf(name);
  return i !== -1 ? args[i + 1] : dflt;
}
const GREPS = [];
args.forEach((a, i) => { if (a === '--grep' && args[i + 1]) GREPS.push(args[i + 1].toLowerCase()); });
const LIST_ONLY = args.includes('--list');
const RUN_ALL = args.includes('--all');
const JOBS = parseInt(flagVal('--jobs', ''), 10) || Math.min(8, Math.max(2, os.cpus().length - 2));
const TIMEOUT_MS = (parseInt(flagVal('--timeout', ''), 10) || 120) * 1000;

// ---- 发现 ----
let smokes = fs.readdirSync(SCRIPTS_DIR).filter(n => /^smoke-.*\.js$/.test(n)).sort();
const totalFound = smokes.length;

if (GREPS.length) smokes = smokes.filter(n => GREPS.some(g => n.toLowerCase().includes(g)));

// NORUN 施工标记：_TALENT_NORUN.flag → 跳过名字含 talent 的
const norunTokens = fs.readdirSync(SCRIPTS_DIR)
  .map(n => { const m = n.match(/^_(.+)_NORUN\.flag$/i); return m ? m[1].toLowerCase() : null; })
  .filter(Boolean);
// skip 清单：{ "smoke-xxx.js": "原因" }
const skipMap = lib.loadJSON(SKIP_FILE, {});

const skipped = [];
if (!RUN_ALL) {
  smokes = smokes.filter(n => {
    const tok = norunTokens.find(t => n.toLowerCase().includes(t));
    if (tok) { skipped.push({ name: n, reason: `NORUN标记(_${tok}_)` }); return false; }
    if (skipMap[n]) { skipped.push({ name: n, reason: skipMap[n] }); return false; }
    return true;
  });
}

console.log(`[run-smokes] 共 ${totalFound} 个 smoke · 选中 ${smokes.length} · 跳过 ${skipped.length} · 并发 ${JOBS} · 超时 ${TIMEOUT_MS / 1000}s`);
if (skipped.length && !LIST_ONLY) skipped.slice(0, 10).forEach(s => console.log(`  跳过 ${s.name} — ${s.reason}`));

if (LIST_ONLY) {
  smokes.forEach(n => console.log('  ' + n));
  process.exit(0);
}
if (!smokes.length) { console.log('[run-smokes] 没有匹配的 smoke'); process.exit(0); }

// ---- 执行 ----
function runOne(name) {
  return new Promise(resolve => {
    const t0 = Date.now();
    let out = '';
    const child = cp.spawn(process.execPath, [path.join(SCRIPTS_DIR, name)], { cwd: SCRIPTS_DIR, windowsHide: true });
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; try { child.kill('SIGKILL'); } catch (e) {} }, TIMEOUT_MS);
    const grab = d => { if (out.length < 200 * 1024) out += d; };
    child.stdout.on('data', grab);
    child.stderr.on('data', grab);
    child.on('error', err => { clearTimeout(timer); resolve({ name, exit: -1, ms: Date.now() - t0, timedOut, out: String(err) }); });
    child.on('close', code => {
      clearTimeout(timer);
      resolve({ name, exit: code === null ? -1 : code, ms: Date.now() - t0, timedOut, out });
    });
  });
}

// 失败签名：末条有信息量的行，去掉数字/路径噪声 → 同签名聚一簇
function signature(r) {
  if (r.timedOut) return '（超时）';
  const lines = r.out.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const failLine = [...lines].reverse().find(l => /FAIL|Error|error:|Cannot|undefined is not|TypeError|ReferenceError/i.test(l)) || lines[lines.length - 1] || '（无输出）';
  return failLine.replace(/\d+/g, '#').replace(/[A-Z]:\\[^\s'")]+|\/[\w./-]{10,}/g, '<path>').slice(0, 160);
}

(async () => {
  const queue = [...smokes];
  const results = [];
  let done = 0;
  async function worker() {
    while (queue.length) {
      const name = queue.shift();
      const r = await runOne(name);
      r.pass = r.exit === 0 && !r.timedOut;
      r.suspect = r.pass && /^\s*FAIL\b/m.test(r.out);
      r.waivers = [];
      for (const line of r.out.split(/\r?\n/).filter(line => line.startsWith('TM_SMOKE_WAIVER '))) {
        try { r.waivers.push(JSON.parse(line.slice(16))); } catch (_) { r.pass = false; }
      }
      results.push(r);
      done++;
      const mark = r.timedOut ? 'TIMEOUT' : r.pass ? (r.suspect ? 'PASS?' : 'PASS') : 'FAIL';
      if (mark !== 'PASS' || done % 25 === 0 || done === smokes.length) {
        console.log(`  [${done}/${smokes.length}] ${mark.padEnd(7)} ${r.name} (${(r.ms / 1000).toFixed(1)}s)`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(JOBS, smokes.length) }, worker));

  // —— flake 自愈（2026-07-06）：并行高负载下 DOM-stub/AI 超时类假阳性反复咬人（每轮全量都要人肉隔离重跑解释）。
  //    失败者串行重跑一次：过了标 flaky（可见不掩盖，报告/汇总单列）；失败 >15 视为真损坏不重跑；--no-retry 关闭。
  const NO_RETRY = args.includes('--no-retry');
  {
    const firstFails = results.filter(r => !r.pass);
    if (firstFails.length && firstFails.length <= 15 && !NO_RETRY) {
      console.log(`\n[run-smokes] ${firstFails.length} 个失败串行重跑一次（排除并行负载 flake·--no-retry 可关）`);
      for (const r of firstFails) {
        const r2 = await runOne(r.name);
        const pass2 = r2.exit === 0 && !r2.timedOut && !/^\s*FAIL\b/m.test(r2.out);
        if (pass2) {
          r.pass = true; r.flaky = true; r.retryMs = r2.ms;
          console.log(`  重跑 PASS(flaky) ${r.name} (${(r2.ms / 1000).toFixed(1)}s)`);
        } else {
          r.out = r2.out || r.out; r.timedOut = r2.timedOut;   // 串行输出更干净·供聚类
          console.log(`  重跑仍 FAIL     ${r.name}`);
        }
      }
    }
  }

  const fails = results.filter(r => !r.pass);
  const flakies = results.filter(r => r.flaky);
  const suspects = results.filter(r => r.suspect);
  const waived = results.filter(r => r.pass && !r.suspect && r.waivers.length);
  const cleanPasses = results.length - fails.length - suspects.length - waived.length;
  const slowest = [...results].sort((a, b) => b.ms - a.ms).slice(0, 10);

  // 聚类
  const clusters = new Map();
  for (const r of fails) {
    const sig = signature(r);
    if (!clusters.has(sig)) clusters.set(sig, []);
    clusters.get(sig).push(r.name);
  }

  console.log(`\n[run-smokes] 完成：${cleanPasses} PASS · ${fails.length + suspects.length} FAIL · ${skipped.length} SKIP · ${waived.length} WAIVED / ${results.length} executed${flakies.length ? ` · ${flakies.length} flaky(首跑败·串行重跑过)` : ''} · ${suspects.length} suspect(退出码0但输出FAIL) · 总耗时 ${(results.reduce((s, r) => s + r.ms, 0) / 1000).toFixed(0)}s(并行墙钟更短)`);
  if (flakies.length) {
    console.log('\n--- flaky（并行负载嫌疑·反复上榜再查真因）---');
    flakies.forEach(r => console.log(`  ${r.name}（首跑 ${(r.ms / 1000).toFixed(1)}s → 重跑 ${(r.retryMs / 1000).toFixed(1)}s PASS）`));
  }
  if (clusters.size) {
    console.log(`\n--- 失败聚类（${clusters.size} 簇）---`);
    for (const [sig, names] of [...clusters.entries()].sort((a, b) => b[1].length - a[1].length)) {
      console.log(`  ×${names.length}  ${sig}`);
      names.slice(0, 5).forEach(n => console.log(`      ${n}`));
      if (names.length > 5) console.log(`      …等 ${names.length} 个`);
    }
  }
  if (suspects.length) {
    console.log('\n--- suspect（建议给脚本补 process.exit(1)）---');
    suspects.slice(0, 10).forEach(r => console.log('  ' + r.name));
  }
  console.log('\n--- 最慢 Top 10 ---');
  slowest.forEach(r => console.log(`  ${(r.ms / 1000).toFixed(1)}s  ${r.name}`));

  lib.saveJSON(REPORT_FILE, {
    version: 2, complete: true, runId: RUN_ID, head: HEAD, expected: smokes,
    generatedAt: new Date().toISOString(),
    args: process.argv.slice(2),
    summary: { selected: smokes.length, pass: cleanPasses, fail: fails.length + suspects.length, waived: waived.length, flaky: flakies.length, suspect: suspects.length, skipped: skipped.length },
    clusters: [...clusters.entries()].map(([sig, names]) => ({ sig, names })),
    results: results.map(r => ({ name: r.name, pass: r.pass, flaky: !!r.flaky, suspect: r.suspect, exit: r.exit, ms: r.ms, timedOut: r.timedOut, waivers: r.waivers, output: r.out })).sort((a, b) => a.name.localeCompare(b.name)),
    skipped
  });
  console.log(`\n[run-smokes] 报告 → ${lib.rel(REPORT_FILE)}`);
  process.exit(fails.length || suspects.length ? 1 : 0);
})().catch(error => { console.error(error); process.exitCode = 1; });
