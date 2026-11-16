#!/usr/bin/env node
// scripts/lint-smoke-source-pins.js — 「查源码文字」的断言只减不增（2026-11-16）
//
// 冒烟脚本里曾有近万处这样的判断：把游戏源码当文字读进来，再断言里面「出现了某段字」——
//   ok(/function _buildFoo\(/.test(src), '…')      ok(src.includes('TM.Foo.bar('), '…')
// 它不执行任何代码：代码写错了照样绿，代码没错只是改了个名字、换了种写法就红。
// 改一次代码要陪着改一串这种断言，测的却不是游戏的行为。2026-11-16 清掉了能确认的那批，
// 本守卫只盯一件事——不许再添：
//   - 每支冒烟脚本里这类判断的数目记在基线里，只许减不许增；新脚本从 0 起
//   - 要测一段逻辑，就把它装起来跑（vm 装文件 / require 模块），断言它算出来的结果
//   - 确实只能看文字的（比如「某个旧写法不得再出现」），用否定式——否定式不计数：
//       ok(!src.includes('旧写法'), '…')      ok(!/旧写法/.test(src), '…')
//
// 怎么数：变量是读文件得来的文字（fs.readFileSync 或脚本里包了它的小函数），
//   对它调 includes / indexOf / match / search / startsWith / endsWith，或拿正则 .test(它)，算一处；
//   前面带 ! 的、indexOf(...) 与 -1 / 0 比「没有」的不算。只是静态地数，数不到的写法不追究。
//
// 用法：
//   node scripts/lint-smoke-source-pins.js            # 对比基线
//   node scripts/lint-smoke-source-pins.js --update   # 重写基线（只在数目变少后用来收紧）
//   node scripts/lint-smoke-source-pins.js --top 15   # 列这类判断最多的前 N 支
//
// 基线：scripts/arch-baselines/smoke-source-pins.json

'use strict';

const fs = require('fs');
const path = require('path');
const acorn = require('acorn');

const SCRIPTS_DIR = __dirname;
const BASELINE_FILE = path.join(SCRIPTS_DIR, 'arch-baselines', 'smoke-source-pins.json');
const args = process.argv.slice(2);
const UPDATE = args.includes('--update');
const topIdx = args.indexOf('--top');
const TOP_N = topIdx !== -1 ? parseInt(args[topIdx + 1], 10) || 15 : 0;

const PROBES = new Set(['includes', 'indexOf', 'lastIndexOf', 'match', 'search', 'startsWith', 'endsWith']);
const KEEP_TEXT = new Set(['slice', 'substring', 'substr', 'replace', 'trim', 'toString', 'concat', 'toLowerCase']);

function children(node) {
  const out = [];
  for (const key of Object.keys(node)) {
    if (key === 'parent') continue;
    const value = node[key];
    if (Array.isArray(value)) { for (const item of value) if (item && typeof item.type === 'string') out.push(item); }
    else if (value && typeof value.type === 'string') out.push(value);
  }
  return out;
}
function walk(root, visit) {
  const stack = [root];
  while (stack.length) {
    const node = stack.pop();
    visit(node);
    for (const child of children(node)) { child.parent = node; stack.push(child); }
  }
}
function isFunction(node) {
  return !!node && (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression');
}

function countPins(text) {
  let ast;
  try {
    ast = acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'script', allowHashBang: true, allowReturnOutsideFunction: true, allowAwaitOutsideFunction: true });
  } catch (_) {
    return 0; // 解析不了的不归这里管（语法检查另有其人）
  }
  const all = [];
  walk(ast, (node) => all.push(node));

  const readers = new Set();  // 返回「读进来的文字」的本地小函数
  const textVars = new Set(); // 装着「读进来的文字」的变量
  const isRead = (node) => node.type === 'CallExpression' && node.callee.type === 'MemberExpression'
    && !node.callee.computed && node.callee.property.name === 'readFileSync';
  function isText(node) {
    if (!node) return false;
    if (node.type === 'Identifier') return textVars.has(node.name);
    if (node.type === 'CallExpression') {
      if (isRead(node)) return true;
      if (node.callee.type === 'Identifier') return readers.has(node.callee.name);
      if (node.callee.type === 'MemberExpression' && !node.callee.computed && KEEP_TEXT.has(node.callee.property.name)) return isText(node.callee.object);
      return false;
    }
    if (node.type === 'BinaryExpression' && node.operator === '+') return isText(node.left) || isText(node.right);
    if (node.type === 'LogicalExpression') return isText(node.left) || isText(node.right);
    if (node.type === 'ConditionalExpression') return isText(node.consequent) || isText(node.alternate);
    if (node.type === 'TemplateLiteral') return node.expressions.some(isText);
    return false;
  }
  function returnsText(fn) {
    if (fn.body.type !== 'BlockStatement') return isText(fn.body);
    let hit = false;
    walk(fn.body, (node) => { if (node.type === 'ReturnStatement' && node.argument && isText(node.argument)) hit = true; });
    return hit;
  }
  // 变量和小函数互相依赖，多扫几轮到不再变为止
  for (let round = 0; round < 4; round += 1) {
    const before = readers.size + textVars.size;
    for (const node of all) {
      if (node.type === 'FunctionDeclaration' && node.id && returnsText(node)) readers.add(node.id.name);
      if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier' && node.init) {
        if (isFunction(node.init)) { if (returnsText(node.init)) readers.add(node.id.name); }
        else if (isText(node.init)) textVars.add(node.id.name);
      }
      if (node.type === 'AssignmentExpression' && node.left.type === 'Identifier' && isText(node.right)) textVars.add(node.left.name);
    }
    if (readers.size + textVars.size === before) break;
  }

  let pins = 0;
  for (const node of all) {
    if (node.type !== 'CallExpression' || node.callee.type !== 'MemberExpression' || node.callee.computed) continue;
    const method = node.callee.property.name;
    let subject = null;
    if (method === 'test') subject = node.arguments[0];
    else if (PROBES.has(method)) subject = node.callee.object;
    if (!subject || !isText(subject)) continue;
    const parent = node.parent;
    if (parent && parent.type === 'UnaryExpression' && parent.operator === '!') continue; // 否定式不计
    if (parent && parent.type === 'BinaryExpression' && (method === 'indexOf' || method === 'lastIndexOf' || method === 'search')) {
      const other = parent.left === node ? parent.right : parent.left;
      const minusOne = other.type === 'UnaryExpression' && other.operator === '-' && other.argument.type === 'Literal' && other.argument.value === 1;
      const zero = other.type === 'Literal' && other.value === 0;
      if ((minusOne && /^[=!]==?$/.test(parent.operator) && parent.operator[0] === '=') || (zero && parent.operator === '<' && parent.left === node)) continue; // 「没有」
    }
    pins += 1;
  }
  return pins;
}

const names = fs.readdirSync(SCRIPTS_DIR).filter((name) => /^smoke-.*\.js$/.test(name)).sort();
const current = {};
let total = 0;
for (const name of names) {
  const n = countPins(fs.readFileSync(path.join(SCRIPTS_DIR, name), 'utf8'));
  if (n) current[name] = n;
  total += n;
}

console.log('[lint-smoke-source-pins] 冒烟脚本 ' + names.length + ' 支 · 查源码文字的判断 ' + total + ' 处 / ' + Object.keys(current).length + ' 支');
if (TOP_N) {
  Object.keys(current).sort((a, b) => current[b] - current[a]).slice(0, TOP_N)
    .forEach((name) => console.log('  ' + String(current[name]).padStart(5) + '  ' + name));
}

if (UPDATE) {
  fs.writeFileSync(BASELINE_FILE, JSON.stringify({ updatedAt: new Date().toISOString(), total, files: current }, null, 2) + '\n');
  console.log('[lint-smoke-source-pins] 基线已重写 → arch-baselines/smoke-source-pins.json');
  process.exit(0);
}

let baseline = null;
try { baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8')); } catch (_) { baseline = null; }
if (!baseline) {
  console.error('[lint-smoke-source-pins] FAIL — 没有基线文件 arch-baselines/smoke-source-pins.json（首次请跑 --update）');
  process.exit(1);
}

const base = baseline.files || {};
const grew = Object.keys(current)
  .filter((name) => current[name] > (base[name] || 0))
  .map((name) => ({ name, from: base[name] || 0, to: current[name] }));

if (grew.length) {
  console.error('[lint-smoke-source-pins] FAIL — ' + grew.length + ' 支冒烟脚本里「查源码文字」的判断变多了：');
  grew.forEach((g) => console.error('  ' + g.name + '  ' + g.from + ' → ' + g.to));
  console.error('这类判断不执行代码：代码错了照样绿，只是改了写法就红。要测一段逻辑，就把它装起来跑，断言算出来的结果。');
  console.error('确实只能看文字的（某个旧写法不得再出现），写成否定式 ok(!src.includes(…))，否定式不计数。');
  process.exit(1);
}
console.log('[lint-smoke-source-pins] PASS' + (total < baseline.total ? '（比基线少了 ' + (baseline.total - total) + ' 处，可跑 --update 收紧）' : ''));
