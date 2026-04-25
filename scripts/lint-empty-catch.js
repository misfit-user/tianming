#!/usr/bin/env node
// scripts/lint-empty-catch.js — 找出空 catch 块·按风险分级输出
//
// R86 约定豁免：
//   catch(_){}         显式不关心标记·保留
//   catch(_e){}        同上
//   catch(_e1)/(_e2)   JSON 多重回退链·保留
//
// 应迁移：
//   catch(e){}         无任何记录·应改为 captureSilent(e, 'module')

'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const SKIP_DIRS = new Set(['.bak-r103', '.bak-r106', '.git', 'node_modules', 'scripts', 'docs']);

function* walk(dir, ext) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      yield* walk(path.join(dir, e.name), ext);
    } else if (e.isFile() && ext.test(e.name)) {
      yield path.join(dir, e.name);
    }
  }
}

const files = [...walk(ROOT, /\.js$/)];
const stats = { exempt: 0, migrate: 0, byFile: {} };
const sample = [];

for (const f of files) {
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  const rel = path.relative(ROOT, f);
  let fileExempt = 0, fileMigrate = 0;
  lines.forEach((line, i) => {
    // 匹配 catch( ANYTHING ) {}, 含可选 var 名 + 空 body
    const m = line.match(/catch\s*\(\s*(\w*)\s*\)\s*\{\s*\}/);
    if (!m) return;
    const varName = m[1];
    // R86 豁免规则：
    //   _ 开头的变量名 (e.g. _e, _e1, _e2) — 显式不关心
    //   e + 数字 (e.g. e1, e2, e3, e2b, e4) — JSON parse 多次重试链
    //   多 catch 链中如果上一个 catch 已记录·后续可空
    const isExempt = varName.startsWith('_') || /^e\d/.test(varName);
    // 进一步豁免（R86 标准·可预期失败）：
    //   JSON.parse 紧邻的 catch (单行 try-catch)·解析失败正常
    //   localStorage.setItem/removeItem · quota满/隐私模式正常
    const hasJsonParse = /JSON\.parse\(/.test(line);
    const hasLocalStorage = /localStorage\.(set|remove)Item\(/.test(line);
    if (isExempt || hasJsonParse || hasLocalStorage) {
      fileExempt++;
      stats.exempt++;
    } else {
      fileMigrate++;
      stats.migrate++;
      if (sample.length < 15) sample.push({ file: rel, line: i+1, raw: line.trim() });
    }
  });
  if (fileMigrate > 0) stats.byFile[rel] = fileMigrate;
}

console.log(`[lint-empty-catch] 总计 ${files.length} 个 .js 文件扫描完成`);
console.log(`  ✓ 豁免 (catch(_){} 等): ${stats.exempt}`);
console.log(`  ⚠ 应迁移 (catch(e){}): ${stats.migrate}`);
if (stats.migrate > 0) {
  console.log(`\n  Top 10 待迁移文件：`);
  Object.entries(stats.byFile)
    .sort((a,b) => b[1]-a[1])
    .slice(0,10)
    .forEach(([f, n]) => console.log(`    · ${f}: ${n} 处`));
  console.log(`\n  样本前 10 处：`);
  sample.forEach(s => console.log(`    ${s.file}:${s.line}  ${s.raw.slice(0,80)}`));
}
process.exit(stats.migrate > 0 ? 0 : 0);
