#!/usr/bin/env node
// scripts/migrate-promise-catch-multiline.js — R160 多行 + 多语句 Promise.catch 迁移
//
// 处理：
//   }).catch(function(e) {
//     <pre stuff>           ← 保留
//     console.X('[label]', e[.message]);
//     <post stuff>           ← 保留
//   });
//
// 替换策略：仅把 console.X 那一行换成 TM.errors.capture 三元
// 其他 toast/hideLoading/return/setTimeout 等业务语句原样保留
//
// 用法：
//   node scripts/migrate-promise-catch-multiline.js --dry-run
//   node scripts/migrate-promise-catch-multiline.js --apply

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
  const before = fs.readFileSync(f, 'utf8');
  const lines = before.split('\n');
  let fileChanges = 0;

  // 状态机：扫到 .catch(function(VAR) { 进入 catch body 模式·记 VAR
  // 在 catch body 内·遇到单行 `console.X(args, VAR(.message)?);` 则迁移
  // 遇到 } 退出 catch body
  // 注：仅处理 "干净" catch (无嵌套大括号)·有嵌套 (if/for/try) 跳过避免错误处理
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // 匹配 `.catch(function(VAR) {`·VAR 可空
    const m = line.match(/\.catch\(\s*function\s*\(\s*(\w*)\s*\)\s*\{\s*$/);
    if (!m) { i++; continue; }
    const varName = m[1];
    if (!varName) { i++; continue; }  // 没变量名就跳过

    // 找匹配的 `}`·假设 catch body 内无嵌套大括号
    let bodyEnd = -1;
    for (let j = i + 1; j < lines.length && j < i + 30; j++) {
      const lj = lines[j];
      // 简单检测：行首 `}` (允许缩进+闭包参数)
      if (/^\s*\}\s*\)\s*;?\s*$/.test(lj) || /^\s*\}\s*\)?\s*;?\s*$/.test(lj)) {
        bodyEnd = j;
        break;
      }
      // 嵌套大括号·跳过此 catch
      if (/[\{][^}]*$/.test(lj.trim()) && !/['"`].*\{/.test(lj)) {
        bodyEnd = -2;
        break;
      }
    }
    if (bodyEnd < 0) { i++; continue; }

    // body 内寻找单行 console.X·只迁移恰一行
    let consoleLine = -1;
    for (let j = i + 1; j < bodyEnd; j++) {
      const lj = lines[j];
      const cm = lj.match(/^(\s*)console\.(warn|log|error|info)\(\s*([^;]+?),\s*\b\w+(\.message)?\s*\)\s*;?\s*$/);
      if (cm) {
        // 必须以 varName 结尾
        const tail = cm[3] + ',' + ' ' + (lj.match(/,\s*(\w+)(\.message)?\s*\)/) || ['',''])[1];
        const lineMatch = lj.match(new RegExp(',\\s*' + varName + '(\\.message)?\\s*\\)'));
        if (!lineMatch) continue;
        consoleLine = j;
        break;
      }
    }
    if (consoleLine < 0) { i = bodyEnd + 1; continue; }

    // 重新提取 console.X 的细节
    const cl = lines[consoleLine];
    const cm = cl.match(/^(\s*)console\.(warn|log|error|info)\(\s*([^;]+?),\s*(\w+)(\.message)?\s*\)\s*;?\s*$/);
    if (!cm || cm[4] !== varName) { i = bodyEnd + 1; continue; }
    const indent = cm[1];
    const method = cm[2];
    const consoleArgs = cm[3].trim();
    const messageSuffix = cm[5] || '';
    const moduleHint = extractModuleHint(consoleArgs);

    // 替换该行
    lines[consoleLine] = indent + '(window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(' + varName + ", '" + moduleHint + "') : console." + method + '(' + consoleArgs + ', ' + varName + messageSuffix + ');';
    fileChanges++;
    i = bodyEnd + 1;
  }

  if (fileChanges > 0) {
    filesChanged++;
    totalChanges += fileChanges;
    console.log(`  ${DRY?'[DRY]':'[APPLY]'} ${path.relative(ROOT, f).replace(/\\/g, '/')}: ${fileChanges} 处`);
    if (!DRY) fs.writeFileSync(f, lines.join('\n'), 'utf8');
  }
}

console.log(`\n${DRY?'[DRY-RUN]':'[APPLIED]'} ${filesChanged} 个文件·共 ${totalChanges} 处`);
if (DRY && totalChanges > 0) console.log('运行 --apply 以实际改写');
