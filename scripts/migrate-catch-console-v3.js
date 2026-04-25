#!/usr/bin/env node
// scripts/migrate-catch-console-v3.js — R155 三代版
//
// 在 R145 v1 + R151 v2 基础上扩展·处理：
//   3. e.message 变体：`console.X('label', e.message)` (R145/v2 要求 var 直传)
//      这种把 message 拆出来的写法 TM.errors 仍能从原 e 捕获完整 stack
//
// 仍仅处理"类1"（catch 内只有 console.* 单语句·无 toast）
//
// 用法：
//   node scripts/migrate-catch-console-v3.js --dry-run [files...]
//   node scripts/migrate-catch-console-v3.js --apply [files...]

'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const DRY = !args.includes('--apply');
const targetFiles = args.filter(a => !a.startsWith('--'));
const SKIP = new Set(['.bak-r103', '.bak-r106', '.git', 'node_modules', 'scripts', 'docs']);

function* walk(dir, ext) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory() && !SKIP.has(e.name)) yield* walk(path.join(dir, e.name), ext);
    else if (e.isFile() && ext.test(e.name)) yield path.join(dir, e.name);
  }
}

const files = targetFiles.length ? targetFiles.map(f => path.resolve(ROOT, f)) : [...walk(ROOT, /\.js$/)];

let totalChanges = 0, filesChanged = 0;

function extractModuleHint(consoleArgs) {
  let m = consoleArgs.match(/['"]\s*\[\s*([^\]'"\[]+?)\s*\]/);
  if (m) return m[1].trim().replace(/[^\w·\-一-鿿]/g, '').slice(0, 40);
  m = consoleArgs.match(/['"]\s*([^\s'":,\[\]+]{2,40})/);
  if (m) return m[1].trim().replace(/[^\w·\-一-鿿]/g, '').slice(0, 40);
  return 'unknown';
}

for (const f of files) {
  if (!fs.existsSync(f)) { console.warn('skip:', f); continue; }
  const before = fs.readFileSync(f, 'utf8');
  const lines = before.split('\n');
  let fileChanges = 0;
  const newLines = lines.map((line) => {
    // 形态 C：catch(var) { console.METHOD(<args>, var.message) ;? }
    //   末尾是 var.message 而非 var
    const re = /(\bcatch\s*\(\s*(\w+)\s*\)\s*\{\s*)console\.(warn|log|error|info)\(\s*([^;]+?),\s*\2\.message\s*\)\s*;?\s*\}/;
    const m = line.match(re);
    if (!m) return line;
    const varName = m[2];
    const method = m[3];
    const consoleArgs = m[4].trim();
    const moduleHint = extractModuleHint(consoleArgs);
    fileChanges++;
    return line.replace(re,
      `$1(window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(${varName}, '${moduleHint}') : console.${method}(${consoleArgs}, ${varName}.message); }`
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
