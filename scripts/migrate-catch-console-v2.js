#!/usr/bin/env node
// scripts/migrate-catch-console-v2.js — R151 扩展版 (2 代)
//
// 在 R145 migrate-catch-console.js 基础上扩展·处理 R145 strict regex 漏掉的场景：
//   1. 同行复合 try-catch：`try {...} catch(e) { console.X(...); }` (无前导 `}`)
//   2. 动态拼接标签：`console.X('[prefix]'+x+'suffix', e)` (R145 只匹配纯字符串字面量)
//
// 仍仅处理"类1"（catch 内只有 console.* 单语句·无 toast/showLoading 等多动作）
// 类2 (console + toast 等) 仍保留人工
//
// 用法：
//   node scripts/migrate-catch-console-v2.js --dry-run [files...]
//   node scripts/migrate-catch-console-v2.js --apply [files...]

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

// 提取 console.X(...args) 里第一个参数的字面量前缀作为 module 名 (粗糙·够用即可)
function extractModuleHint(consoleArgs) {
  // 形式 1：'[label]...' 或 "[label]..." — 取方括号内
  let m = consoleArgs.match(/['"]\s*\[\s*([^\]'"\[]+?)\s*\]/);
  if (m) return m[1].trim().replace(/[^\w·\-一-鿿]/g, '').slice(0, 40);
  // 形式 2：'label:' 或 'label '... — 取首段标识符
  m = consoleArgs.match(/['"]\s*([^\s'":,\[\]+]{2,40})/);
  if (m) return m[1].trim().replace(/[^\w·\-一-鿿]/g, '').slice(0, 40);
  return 'unknown';
}

for (const f of files) {
  if (!fs.existsSync(f)) { console.warn('skip (not found):', f); continue; }
  const before = fs.readFileSync(f, 'utf8');
  const lines = before.split('\n');
  let fileChanges = 0;
  const newLines = lines.map((line) => {
    // 形态A：标准 } catch(e) { console.X('...', e); }  ← R145 已处理但兜底重跑无害
    // 形态B：catch(e) { console.X(<expr>, e); }  含动态拼接
    //   匹配整段 catch·确保 console.X(...) 是唯一语句·结尾要么 ; 要么直接 }
    //
    // 核心思路：捕获 catch(var) { console.METHOD(<args until var)>) ;? }
    // 用 lazy 匹配 + 锚定 var 引用作为最后一个参数
    const re = /(\bcatch\s*\(\s*(\w+)\s*\)\s*\{\s*)console\.(warn|log|error|info)\(\s*([^;]+?),\s*\2\s*\)\s*;?\s*\}/;
    const m = line.match(re);
    if (!m) return line;

    const varName = m[2];
    const method = m[3];
    const consoleArgs = m[4].trim();  // 第一个参数·可能是 'literal' 或 'a'+b+'c'
    const moduleHint = extractModuleHint(consoleArgs);

    fileChanges++;
    return line.replace(re,
      `$1(window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(${varName}, '${moduleHint}') : console.${method}(${consoleArgs}, ${varName}); }`
    );
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
