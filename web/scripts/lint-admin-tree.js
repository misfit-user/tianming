#!/usr/bin/env node
// scripts/lint-admin-tree.js — 区划只留一份（2026-11-16）
//
// 区划有两份：游戏里那份（GM.adminHierarchy，开局时从剧本深拷贝，算税、户口、央地、营造、AI 写回都认它）
// 和剧本库那份（P.adminHierarchy，只给开局与编辑器）。2026-11-15 以前不少代码读写剧本库那份：
// AI 封的藩、建的楼、挂的地块状态落在死拷贝上，算税看不到。同志定「区划只留一份」，玩法全部迁到 GM。
//
// 本守卫只盯一件事：运行时代码不许再碰 P.adminHierarchy。认的写法有 P.adminHierarchy、
// window.P / global.P / root.P / ctx.P 之类再点 adminHierarchy，以及方括号写法；注释与字符串不算。
// 下面名单里的几个文件除外，各写明理由。名单里的文件不再碰剧本库那份了也会报，请把它从名单删去。
//
// 盯不住的：先把 P 存进别的变量再取（var lib = P; lib.adminHierarchy）。宁缺勿噪，审代码时留意。
//
// 用法：node scripts/lint-admin-tree.js
// 范围：index.html 脚本清单里的运行时代码，加上新前端 web/ui/（dev/ 除外）。

'use strict';

const fs = require('fs');
const path = require('path');
const acorn = require('acorn');
const lib = require('./lib-arch-guard');

const ALLOW = {
  'tm-patches-start.js': '开局：从剧本拷入剧本库那份，再深拷成游戏那份；开局按剧本钉民心时两份一起钉',
  'tm-save-lifecycle.js': '存读档：旧档里只写在剧本库那份上的封藩、状态、营造并进游戏那份；存档不带剧本库那份、读档从剧本补回；游戏那份为空时从它恢复',
  'tm-integration-bridge.js': '游戏那份为空时（极旧存档、单测）从剧本库那份兜底',
  'tm-endturn-qiaozhi.js': '侨置只认旧档遗留的失地记录（新局不再产生）；搬到游戏那份须接户口账，归行2',
  'map-editor-to-game.js': '地图编辑器产物装进游戏：剧本库那份与游戏那份换成同一棵新树（导入，不是玩法读写）'
};

function newUiFiles() {
  const root = path.join(lib.WEB_ROOT, 'ui');
  const out = [];
  (function walk(dir) {
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'dev' && entry.name !== 'assets' && entry.name !== 'fonts') walk(abs);
      } else if (/\.js$/.test(entry.name)) {
        out.push({ src: lib.rel(abs), abs });
      }
    });
  })(root);
  return out;
}

function parse(text) {
  const opts = { ecmaVersion: 'latest', locations: true, allowHashBang: true, allowReturnOutsideFunction: true };
  try {
    return acorn.parse(text, Object.assign({ sourceType: 'script' }, opts));
  } catch (_) {
    // 新前端是 ES 模块（import/export），按模块再解析一次；还解析不了就让外层报出来
    return acorn.parse(text, Object.assign({ sourceType: 'module' }, opts));
  }
}

function propName(node) {
  if (!node) return '';
  if (!node.computed && node.property && node.property.type === 'Identifier') return node.property.name;
  if (node.computed && node.property && node.property.type === 'Literal') return String(node.property.value);
  return '';
}

// 对象是不是 P：裸的 P，或者 某某.P（window.P、global.P、root.P、ctx.P……）
function isLibraryP(obj) {
  if (!obj) return false;
  if (obj.type === 'Identifier') return obj.name === 'P';
  if (obj.type === 'MemberExpression') return propName(obj) === 'P';
  return false;
}

function findHits(ast) {
  const hits = [];
  (function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(visit); return; }
    if (node.type === 'MemberExpression' && propName(node) === 'adminHierarchy' && isLibraryP(node.object)) {
      hits.push(node.loc.start.line);
    }
    Object.keys(node).forEach((key) => {
      if (key === 'loc' || key === 'start' || key === 'end') return;
      const child = node[key];
      if (child && typeof child === 'object') visit(child);
    });
  })(ast);
  return hits;
}

const seen = new Set();
const files = lib.runtimeCodeFiles().concat(newUiFiles()).filter((file) => {
  if (seen.has(file.src)) return false;
  seen.add(file.src);
  return true;
});

const violations = [];
const parseErrors = [];
const allowUsed = {};
let scanned = 0;
files.forEach((file) => {
  const text = fs.readFileSync(file.abs, 'utf8');
  if (text.indexOf('adminHierarchy') < 0) return;   // 不沾区划的文件不必解析
  scanned++;
  let ast;
  try {
    ast = parse(text);
  } catch (e) {
    parseErrors.push(file.src + '：' + e.message);
    return;
  }
  const lines = findHits(ast);
  if (!lines.length) return;
  if (Object.prototype.hasOwnProperty.call(ALLOW, file.src)) {
    allowUsed[file.src] = lines.length;
    return;
  }
  const raw = text.split('\n');
  lines.forEach((line) => violations.push({ src: file.src, line, code: String(raw[line - 1] || '').trim().slice(0, 140) }));
});

const staleAllow = Object.keys(ALLOW).filter((src) => !allowUsed[src]);

console.log('[lint-admin-tree] 运行时代码 ' + files.length + ' 个文件，沾区划的 ' + scanned + ' 个；名单内 '
  + Object.keys(allowUsed).map((src) => src + '×' + allowUsed[src]).join('、'));

let failed = false;
if (parseErrors.length) {
  failed = true;
  console.error('[lint-admin-tree] FAIL — 有文件解析不了，没法核：');
  parseErrors.forEach((m) => console.error('  ' + m));
}
if (violations.length) {
  failed = true;
  console.error('[lint-admin-tree] FAIL — 玩法代码碰了剧本库那份区划（P.adminHierarchy）' + violations.length + ' 处：');
  violations.forEach((v) => console.error('  ' + v.src + ':' + v.line + '  ' + v.code));
  console.error('改读写游戏里那份 GM.adminHierarchy。剧本库那份只给开局与编辑器；确属开局、存读档、导入这类，');
  console.error('把文件加进本脚本的 ALLOW 名单并写明理由。');
}
if (staleAllow.length) {
  failed = true;
  console.error('[lint-admin-tree] FAIL — 名单里这些文件已不碰剧本库那份区划，请从 ALLOW 删去：' + staleAllow.join('、'));
}
if (failed) process.exit(1);
console.log('[lint-admin-tree] PASS — 玩法只认游戏里那份区划');
