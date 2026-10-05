#!/usr/bin/env node
// 新前端分层守卫：web/ui 下只有 adapter/ 可以碰内核全局（GM、P、TM、老函数）；
// 场景层、器物层、页面层一律经 adapter/game.js。违者列出 file:line，退出码 1。
//   node tools/newui/lint-ui-boundary.cjs
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const UI = path.join(ROOT, 'web', 'ui');
const ALLOW = [path.join(UI, 'adapter') + path.sep];
// 直接读写内核状态、内核命名空间，或从 window 上取内核全局
const RULES = [
  [/(^|[^\w.$])(GM|P)\.[A-Za-z_$]/, '直接读写内核状态 GM / P'],
  [/(^|[^\w.$])TM\.[A-Z][A-Za-z]+/, '直接用内核命名空间 TM.*'],
  [/window\.(GM|P|TM|startGame|doActualStart|_endTurnInternal|SaveManager)\b/, '从 window 取内核全局']
];

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'assets') continue;
      walk(full, out);
    } else if (/\.(m?js|html)$/.test(e.name)) out.push(full);
  }
  return out;
}

const problems = [];
for (const file of walk(UI)) {
  if (ALLOW.some((a) => file.startsWith(a))) continue;
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, i) => {
    const code = line.replace(/\/\/.*$/, '');
    if (/^\s*(\*|\/\*)/.test(line)) return;
    for (const [re, msg] of RULES) {
      if (re.test(code)) problems.push(`${path.relative(ROOT, file).replace(/\\/g, '/')}:${i + 1}  ${msg}：${line.trim().slice(0, 100)}`);
    }
  });
}
if (problems.length) {
  console.error(`[lint-ui-boundary] FAIL ${problems.length} 处越层：`);
  problems.forEach((p) => console.error('  ' + p));
  process.exit(1);
}
console.log('[lint-ui-boundary] PASS 只有 adapter/ 碰内核');
