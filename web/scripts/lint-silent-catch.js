#!/usr/bin/env node
// scripts/lint-silent-catch.js — 空 catch 棘轮守卫（2026-11-15）
//
// 运行时代码里有两千多处 `catch (e) {}`：错被整个吞掉，不记日志、不留一句为什么可以吞。
// 出了事连现场都没有，只能靠猜。这些旧账不在这里清，本守卫只盯一件事——不许再添：
//   - 空 catch 的总数记在基线里，只许减不许增
//   - 新写的 catch 要么真处理、要么在块里写一句为什么可以不管（一行注释就够，带了注释就不算空）
//   - 顺手还掉几处的，用 --update 收紧基线
//
// 算作「空」的两种写法：
//   try { … } catch (e) {}          catch 块里什么都没有
//   promise.catch(function () {})   或  .catch(() => {})   空的回调
//
// 用法：
//   node scripts/lint-silent-catch.js            # 对比基线
//   node scripts/lint-silent-catch.js --update   # 重写基线
//   node scripts/lint-silent-catch.js --top 15   # 列空 catch 最多的前 N 个文件
//
// 基线：scripts/arch-baselines/silent-catch.json

'use strict';

const fs = require('fs');
const path = require('path');
const lib = require('./lib-arch-guard');

const BASELINE_FILE = path.join(lib.BASELINE_DIR, 'silent-catch.json');
const args = process.argv.slice(2);
const UPDATE = args.includes('--update');
const topIdx = args.indexOf('--top');
const TOP_N = topIdx !== -1 ? parseInt(args[topIdx + 1], 10) || 15 : 0;

const EMPTY_CATCH_RE = /\bcatch\s*(?:\(\s*[\w$]*\s*\))?\s*\{\s*\}/g;
const EMPTY_PROMISE_CATCH_RE = /\.catch\(\s*(?:function\s*[\w$]*\s*\(\s*[\w$]*\s*\)|\(\s*[\w$]*\s*\)\s*=>|[\w$]+\s*=>)\s*\{\s*\}\s*\)/g;

function countIn(text) {
  return (text.match(EMPTY_CATCH_RE) || []).length + (text.match(EMPTY_PROMISE_CATCH_RE) || []).length;
}

// 新前端（web/ui）不走 index.html 的脚本清单，单独扫；dev/ 是开发用的台子，不算运行时。
function newUiFiles() {
  const root = path.join(lib.WEB_ROOT, 'ui');
  const out = [];
  (function walk(dir) {
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'dev' && entry.name !== 'assets' && entry.name !== 'fonts') walk(abs);
      } else if (/\.js$/.test(entry.name)) {
        out.push({ src: lib.rel(abs), abs });
      }
    });
  })(root);
  return out;
}

const seen = new Set();
const files = lib.runtimeCodeFiles().concat(newUiFiles()).filter((file) => {
  if (seen.has(file.src)) return false;
  seen.add(file.src);
  return true;
});

const current = {};
let total = 0;
files.forEach((file) => {
  const n = countIn(fs.readFileSync(file.abs, 'utf8'));
  if (n) current[file.src] = n;
  total += n;
});

console.log('[lint-silent-catch] 运行时代码 ' + files.length + ' 个文件 · 空 catch ' + total + ' 处 / ' + Object.keys(current).length + ' 个文件');
if (TOP_N) {
  Object.keys(current).sort((a, b) => current[b] - current[a]).slice(0, TOP_N)
    .forEach((src) => console.log('  ' + String(current[src]).padStart(5) + '  ' + src));
}

if (UPDATE) {
  const sorted = {};
  Object.keys(current).sort().forEach((src) => { sorted[src] = current[src]; });
  lib.saveJSON(BASELINE_FILE, { updatedAt: new Date().toISOString(), total, files: sorted });
  console.log('[lint-silent-catch] 基线已重写 → ' + lib.rel(BASELINE_FILE));
  process.exit(0);
}

const baseline = lib.loadJSON(BASELINE_FILE, null);
if (!baseline) {
  console.error('[lint-silent-catch] FAIL — 没有基线文件 ' + lib.rel(BASELINE_FILE) + '（首次请跑 --update）');
  process.exit(1);
}

const base = baseline.files || {};
const grew = Object.keys(current)
  .filter((src) => current[src] > (base[src] || 0))
  .map((src) => ({ src, from: base[src] || 0, to: current[src] }));

if (total > baseline.total) {
  console.error('[lint-silent-catch] FAIL — 空 catch 比基线多了 ' + (total - baseline.total) + ' 处（基线 ' + baseline.total + '，现在 ' + total + '）。变多的文件：');
  grew.forEach((g) => console.error('  ' + g.src + '  ' + g.from + ' → ' + g.to));
  console.error('新写的 catch 要么处理这个错，要么在块里写一句为什么可以不管（一行注释就够）。');
  console.error('只是把旧代码从一个文件搬到另一个文件，总数不会变，不会走到这里。');
  process.exit(1);
}

if (grew.length) {
  // 总数没涨，多半是拆文件搬了代码；列出来提醒，不挡路。
  console.log('[lint-silent-catch] 提醒：' + grew.length + ' 个文件的空 catch 变多，但总数没涨（多半是搬代码）：'
    + grew.slice(0, 5).map((g) => g.src + ' ' + g.from + '→' + g.to).join('，') + (grew.length > 5 ? ' …' : ''));
}
console.log('[lint-silent-catch] PASS' + (total < baseline.total ? '（比基线少了 ' + (baseline.total - total) + ' 处，可跑 --update 收紧）' : ''));
