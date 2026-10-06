#!/usr/bin/env node
// 新前端导入核对：web/ui 下每个 import { a, b as c } from './x.js'，目标模块必须真的导出 a、b。
// 浏览器里缺一个导出整个新前端就载不起来，这里在提交前静态查一遍。违者列出 file:line，退出码 1。
//   node tools/newui/check-imports.cjs
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const UI = path.join(ROOT, 'web', 'ui');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'assets') walk(full, out); }
    else if (/\.m?js$/.test(e.name)) out.push(full);
  }
  return out;
}

const cache = new Map();
// 一个模块导出的名字：export function/class/const/let/var 名、export { a, b as c }、export * from（递归）
function exportsOf(file, seen = new Set()) {
  if (cache.has(file)) return cache.get(file);
  if (seen.has(file)) return new Set();
  seen.add(file);
  const src = fs.readFileSync(file, 'utf8');
  const names = new Set();
  for (const m of src.matchAll(/^\s*export\s+(?:async\s+)?(?:function\*?|class|const|let|var)\s+([A-Za-z_$][\w$]*)/gm)) names.add(m[1]);
  for (const m of src.matchAll(/^\s*export\s+(?:const|let|var)\s+\{([^}]*)\}/gm)) for (const n of m[1].split(',')) { const k = n.split(':').pop().trim(); if (k) names.add(k); }
  for (const m of src.matchAll(/^\s*export\s*\{([^}]*)\}(?:\s*from\s*['"]([^'"]+)['"])?/gm)) {
    for (const part of m[1].split(',')) {
      const p = part.trim();
      if (!p) continue;
      const as = p.split(/\s+as\s+/);
      names.add((as[1] || as[0]).trim());
    }
  }
  for (const m of src.matchAll(/^\s*export\s*\*\s*from\s*['"]([^'"]+)['"]/gm)) {
    const target = resolve(file, m[1]);
    if (target) for (const n of exportsOf(target, seen)) names.add(n);
  }
  if (/^\s*export\s+default\b/m.test(src)) names.add('default');
  cache.set(file, names);
  return names;
}
function resolve(from, spec) {
  if (!spec.startsWith('.')) return null;                  // three 等外部包不查
  const p = path.resolve(path.dirname(from), spec);
  return fs.existsSync(p) ? p : null;
}

const problems = [];
for (const file of walk(UI)) {
  const src = fs.readFileSync(file, 'utf8');
  const lines = src.split(/\r?\n/);
  const re = /import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(src))) {
    const spec = m[2];
    const line = src.slice(0, m.index).split('\n').length;
    if (!spec.startsWith('.')) continue;
    const target = resolve(file, spec);
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    if (!target) { problems.push(`${rel}:${line}  找不到模块 ${spec}`); continue; }
    const have = exportsOf(target);
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/)[0].trim();
      if (name && !have.has(name)) problems.push(`${rel}:${line}  ${spec} 没有导出 ${name}`);
    }
  }
  void lines;
}
if (problems.length) {
  console.error(`[check-imports] FAIL ${problems.length} 处：`);
  problems.forEach((p) => console.error('  ' + p));
  process.exit(1);
}
console.log('[check-imports] PASS 新前端各处导入都有着落');
