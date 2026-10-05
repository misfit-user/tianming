#!/usr/bin/env node
// 只刷新热更基线（web/.hot-update-manifest.json）里指定几件的 sha256 与 size，其余原样不动。
// 用于在缺少未跟踪资产（立绘、模型等）的工作树里改了几份 web 文件之后：整份重生成会把缺的资产从基线里抹掉。
//   node tools/newui/refresh-baseline-entries.cjs index.html tm-patches-start.js …（路径相对 web/）
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const WEB = path.resolve(__dirname, '..', '..', 'web');
const MANIFEST = path.join(WEB, '.hot-update-manifest.json');
const files = process.argv.slice(2);
if (!files.length) {
  console.error('用法：refresh-baseline-entries.cjs <相对 web/ 的路径>...');
  process.exit(2);
}
const raw = fs.readFileSync(MANIFEST, 'utf8');
const doc = JSON.parse(raw);
let text = raw;
for (const rel of files) {
  const entry = doc.files.find((f) => f.path === rel);
  if (!entry) {
    console.error(`基线里没有 ${rel}（新增文件请走正式的基线重生成）`);
    process.exit(1);
  }
  const buf = fs.readFileSync(path.join(WEB, rel));
  const sha = crypto.createHash('sha256').update(buf).digest('hex');
  // 按原文逐字替换这一条，保持其余字节（缩进、顺序、换行）不变
  const before = `"path": ${JSON.stringify(rel)},\n      "sha256": "${entry.sha256}",\n      "size": ${entry.size}`;
  const after = `"path": ${JSON.stringify(rel)},\n      "sha256": "${sha}",\n      "size": ${buf.length}`;
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const b = before.replace(/\n/g, eol), a = after.replace(/\n/g, eol);
  if (!text.includes(b)) {
    console.error(`没找到 ${rel} 这一条的原文`);
    process.exit(1);
  }
  text = text.replace(b, a);
  console.log(`${rel}: ${entry.size} → ${buf.length}`);
}
fs.writeFileSync(MANIFEST, text);
