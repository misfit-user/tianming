#!/usr/bin/env node
// scripts/migrate-promise-catch.js — 把 Promise .catch() 里的 console.* 自动改为 TM.errors.capture
//
// 姊妹脚本: migrate-catch-console.js (try-catch 版)
//
// 仅处理"类1"（纯 console·无 toast/showLoading 等多语句）的 .catch()
// 模式：.catch(function(e) { console.warn('[label]', e); })
// 改为：.catch(function(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'label') : console.warn('[label]', e); })
//
// 用法：
//   node scripts/migrate-promise-catch.js --dry-run [file1.js ...]   预览
//   node scripts/migrate-promise-catch.js --apply [file1.js ...]     改写

'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const DRY = !args.includes('--apply');
const targetFiles = args.filter(a => !a.startsWith('--'));
const SKIP_DIRS = new Set(['.bak-r103', '.bak-r106', '.git', 'node_modules', 'scripts', 'docs']);

function* walk(dir, ext) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      yield* walk(path.join(dir, e.name), ext);
    } else if (e.isFile() && ext.test(e.name)) yield path.join(dir, e.name);
  }
}

const files = targetFiles.length
  ? targetFiles.map(f => path.resolve(ROOT, f))
  : [...walk(ROOT, /\.js$/)];

let totalChanges = 0;
let filesChanged = 0;

for (const f of files) {
  if (!fs.existsSync(f)) { console.warn('skip (not found):', f); continue; }
  const before = fs.readFileSync(f, 'utf8');
  const lines = before.split('\n');
  let fileChanges = 0;
  const newLines = lines.map((line) => {
    // 形态A：.catch(function(var) { console.METHOD('[label]', var); })
    const reA = /(\.catch\(\s*function\s*\(\s*(\w+)\s*\)\s*\{\s*)console\.(warn|log|error|info)\(\s*('([^']*)'|"([^"]*)")\s*,\s*\2\s*\)\s*;?\s*\}\s*\)/;
    const mA = line.match(reA);
    if (mA) {
      const varName = mA[2];
      const label = mA[5] || mA[6] || 'unknown';
      const cleanLabel = label.replace(/^\[/, '').replace(/\]$/, '');
      fileChanges++;
      return line.replace(reA,
        `$1(window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(${varName}, '${cleanLabel}') : console.$3('${label}', ${varName}); })`
      );
    }
    // 形态B：.catch(function(var) { console.METHOD(var); })  — 单参数·无标签
    const reB = /(\.catch\(\s*function\s*\(\s*(\w+)\s*\)\s*\{\s*)console\.(warn|log|error|info)\(\s*\2\s*\)\s*;?\s*\}\s*\)/;
    const mB = line.match(reB);
    if (mB) {
      const varName = mB[2];
      fileChanges++;
      return line.replace(reB,
        `$1(window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(${varName}, 'promise-catch') : console.$3(${varName}); })`
      );
    }
    return line;
  });
  if (fileChanges > 0) {
    filesChanged++;
    totalChanges += fileChanges;
    console.log(`  ${DRY?'[DRY]':'[APPLY]'} ${path.relative(ROOT, f)}: ${fileChanges} 处`);
    if (!DRY) fs.writeFileSync(f, newLines.join('\n'), 'utf8');
  }
}

console.log(`\n${DRY?'[DRY-RUN]':'[APPLIED]'} ${filesChanged} 个文件·共 ${totalChanges} 处`);
if (DRY && totalChanges > 0) console.log(`运行 --apply 以实际改写`);
