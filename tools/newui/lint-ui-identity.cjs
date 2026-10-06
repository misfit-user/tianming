#!/usr/bin/env node
// 新前端身份守卫：界面不许把「皇帝」写死（官本位设计稿第九章「案头即身份」）。
// web/ui 下的界面代码，其字符串里不许出现只属元首一档的字；这些字只能写在身份档 ui/model/identity.js 里，界面从档里取。
// 适配层（adapter/）转述内核原话，开发页（dev/）不进游戏，都不在此列。注释不查。违者列出 file:line，退出码 1。
//   node tools/newui/lint-ui-identity.cjs
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const UI = path.join(ROOT, 'web', 'ui');
const SKIP = [path.join(UI, 'adapter') + path.sep, path.join(UI, 'dev') + path.sep, path.join(UI, 'assets') + path.sep, path.join(UI, 'model', 'identity.js')];
const WORDS = ['朕', '陛下', '皇上', '圣上', '圣旨', '天子', '御案', '御览', '御批', '御前', '臨朝', '临朝', '诏书', '诏令', '诏付有司', '奏疏', '奏折', '玉玺', '百官', '批红', '朱批'];
const RE = new RegExp(WORDS.join('|'));

// 取出一份 JS 源码里的全部字符串字面量（含模板字符串），带起始行号；跳过注释与正则字面量
function strings(src) {
  const out = [];
  let i = 0, line = 1, prev = '';
  const n = src.length;
  const regexAllowed = () => !prev || /[(,=:[!&|?{};+\-*%<>~^]/.test(prev);
  while (i < n) {
    const c = src[i];
    if (c === '\n') { line++; i++; continue; }
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') line++; i++; }
      i += 2;
      continue;
    }
    if (c === '/' && regexAllowed()) {
      i++;
      let inClass = false;
      while (i < n && src[i] !== '\n') {
        if (src[i] === '\\') { i += 2; continue; }
        if (src[i] === '[') inClass = true;
        else if (src[i] === ']') inClass = false;
        else if (src[i] === '/' && !inClass) break;
        i++;
      }
      i++;
      prev = '/';
      continue;
    }
    if (c === '\'' || c === '"' || c === '`') {
      const start = line;
      let text = '';
      i++;
      while (i < n && src[i] !== c) {
        if (src[i] === '\\') { text += src[i + 1] || ''; i += 2; continue; }
        if (src[i] === '\n') { if (c !== '`') break; line++; }
        text += src[i];
        i++;
      }
      i++;
      out.push({ line: start, text });
      prev = c;
      continue;
    }
    if (!/\s/.test(c)) prev = c;
    i++;
  }
  return out;
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (/\.m?js$/.test(e.name)) out.push(full);
  }
  return out;
}

const problems = [];
for (const file of walk(UI)) {
  if (SKIP.some((s) => file === s || file.startsWith(s))) continue;
  for (const { line, text } of strings(fs.readFileSync(file, 'utf8'))) {
    const m = text.match(RE);
    if (m) problems.push(`${path.relative(ROOT, file).replace(/\\/g, '/')}:${line}  「${m[0]}」：${text.trim().slice(0, 60)}`);
  }
}
if (problems.length) {
  console.error(`[lint-ui-identity] FAIL ${problems.length} 处把元首的字写死在界面里（改从 ui/model/identity.js 的身份档取）：`);
  problems.forEach((p) => console.error('  ' + p));
  process.exit(1);
}
console.log('[lint-ui-identity] PASS 界面不写死元首的字');
