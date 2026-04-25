#!/usr/bin/env node
// scripts/migrate-catch-toast-console.js — R156 类2 toast+console 双语句迁移
//
// 处理：`} catch(e) { showToast(...); console.X('[Mod]', e); }` (或 toast/showLoading)
//   保留 toast/showToast/showLoading (UI 反馈不变)·只把 console.X 部分换成 TM.errors.capture 三元
//
// 用法：
//   node scripts/migrate-catch-toast-console.js --dry-run
//   node scripts/migrate-catch-toast-console.js --apply

'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const DRY = !args.includes('--apply');
const SKIP = new Set(['.bak-r103', '.bak-r106', '.git', 'node_modules', 'scripts', 'docs']);

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory() && !SKIP.has(e.name)) yield* walk(path.join(dir, e.name));
    else if (e.isFile() && e.name.endsWith('.js')) yield path.join(dir, e.name);
  }
}

let totalChanges = 0, filesChanged = 0;

function extractModuleHint(consoleArgs) {
  let m = consoleArgs.match(/['"]\s*\[\s*([^\]'"\[]+?)\s*\]/);
  if (m) return m[1].trim().replace(/[^\w·\-一-鿿]/g, '').slice(0, 40);
  m = consoleArgs.match(/['"]\s*([^\s'":,\[\]+]{2,40})/);
  if (m) return m[1].trim().replace(/[^\w·\-一-鿿]/g, '').slice(0, 40);
  return 'unknown';
}

for (const f of [...walk(ROOT)]) {
  const before = fs.readFileSync(f, 'utf8');
  const lines = before.split('\n');
  let fileChanges = 0;
  const newLines = lines.map((line) => {
    // 形态 D：catch(var) { (toast|showToast|showLoading)(<X>); console.METHOD(<args>, var(.message)?); }
    //   保留 toast 调用·只换 console
    const re = /(\bcatch\s*\(\s*(\w+)\s*\)\s*\{\s*)((?:toast|showToast|showLoading)\([^;]+;\s*)console\.(warn|log|error|info)\(\s*([^;]+?),\s*\2(\.message)?\s*\)\s*;?\s*\}/;
    const m = line.match(re);
    if (!m) return line;
    const varName = m[2];
    const toastPart = m[3];
    const method = m[4];
    const consoleArgs = m[5].trim();
    const messageSuffix = m[6] || '';
    const moduleHint = extractModuleHint(consoleArgs);
    fileChanges++;
    return line.replace(re,
      `$1${toastPart}(window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(${varName}, '${moduleHint}') : console.${method}(${consoleArgs}, ${varName}${messageSuffix}); }`
    );
  });
  if (fileChanges > 0) {
    filesChanged++;
    totalChanges += fileChanges;
    console.log(`  ${DRY?'[DRY]':'[APPLY]'} ${path.relative(ROOT, f).replace(/\\/g, '/')}: ${fileChanges} 处`);
    if (!DRY) fs.writeFileSync(f, newLines.join('\n'), 'utf8');
  }
}

console.log(`\n${DRY?'[DRY-RUN]':'[APPLIED]'} ${filesChanged} 个文件·共 ${totalChanges} 处`);
if (DRY && totalChanges > 0) console.log('运行 --apply 以实际改写');
