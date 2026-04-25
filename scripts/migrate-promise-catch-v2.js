#!/usr/bin/env node
// scripts/migrate-promise-catch-v2.js — R160 多行 Promise.catch 迁移
//
// R148 v1 只处理单行 .catch(function(e) { console.X(...); })
// v2 处理多行：
//   }).catch(function(e) {
//     console.warn('[label]', e);
//   });
//
// 仅当 catch body 内恰好就一句 console.X 时迁移·有 toast/showLoading/return 等
// 多语句的保留人工
//
// 用法：
//   node scripts/migrate-promise-catch-v2.js --dry-run
//   node scripts/migrate-promise-catch-v2.js --apply

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

function extractModuleHint(consoleArgs) {
  let m = consoleArgs.match(/['"]\s*\[\s*([^\]'"\[]+?)\s*\]/);
  if (m) return m[1].trim().replace(/[^\w·\-一-鿿]/g, '').slice(0, 40);
  m = consoleArgs.match(/['"]\s*([^\s'":,\[\]+]{2,40})/);
  if (m) return m[1].trim().replace(/[^\w·\-一-鿿]/g, '').slice(0, 40);
  return 'unknown';
}

let totalChanges = 0, filesChanged = 0;

for (const f of [...walk(ROOT)]) {
  let content = fs.readFileSync(f, 'utf8');
  let fileChanges = 0;
  // 多行匹配·s 标志让 . 跨行
  // 模式：
  //   .catch( function ( var ) {
  //     console.METHOD( <args>, var(.message)? );
  //   } )
  // 仅当大括号内恰好就一行 console (允许前后空白·允许尾分号)
  const re = /(\.catch\(\s*function\s*\(\s*(\w+)\s*\)\s*\{\s*)console\.(warn|log|error|info)\(\s*([^;]+?),\s*\2(\.message)?\s*\)\s*;?\s*(\}\s*\))/g;
  content = content.replace(re, (full, prefix, varName, method, consoleArgs, msgSuffix, closing) => {
    consoleArgs = consoleArgs.trim();
    const moduleHint = extractModuleHint(consoleArgs);
    fileChanges++;
    return `${prefix}(window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(${varName}, '${moduleHint}') : console.${method}(${consoleArgs}, ${varName}${msgSuffix||''}); ${closing}`;
  });
  if (fileChanges > 0) {
    filesChanged++;
    totalChanges += fileChanges;
    console.log(`  ${DRY?'[DRY]':'[APPLY]'} ${path.relative(ROOT, f).replace(/\\/g, '/')}: ${fileChanges} 处`);
    if (!DRY) fs.writeFileSync(f, content, 'utf8');
  }
}

console.log(`\n${DRY?'[DRY-RUN]':'[APPLIED]'} ${filesChanged} 个文件·共 ${totalChanges} 处`);
if (DRY && totalChanges > 0) console.log('运行 --apply 以实际改写');
