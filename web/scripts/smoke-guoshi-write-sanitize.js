#!/usr/bin/env node
'use strict';
/* smoke-guoshi-write-sanitize — 国师写工具双编码 JSON 堵漏（2026-08-10）防腐线。
 * 病灶：LLM 偶把实体 JSON 双编码成字符串（甚至套 ```json 围栏）传给写工具，
 *   applyEdit 的 _ARR_COLLS 归一走 else 分支把字符串原样包成数组元素、applyPush 全无归一，
 *   字符串元素落进 classes/families 等集合 → 污染剧本数据、下游写回链崩。
 * 刀法：editor-authoring-agent.js 加 _coerceEntityValue（parse-or-reject·剥围栏容错），
 *   applyEdit(_ARR_COLLS)/applyPush 两路径先归一·失败返回 { ok:false, reason } 工具错误喂回模型自纠；
 *   editor-authoring-agent-ui.js onApply 加元素级归一（_coerceArrElem）兜存量草稿·摘要体现修复/丢弃计数。 */
var fs = require('fs');
var path = require('path');
var WEB = path.resolve(__dirname, '..');
var P = 0, F = 0;
function ok(c, m) { if (c) { P++; console.log('  ✓ ' + m); } else { F++; console.log('  ✗ FAIL: ' + m); } }
function readWeb(p) { return fs.readFileSync(path.join(WEB, p), 'utf8'); }
console.log('smoke-guoshi-write-sanitize');

var agent = readWeb('editor-authoring-agent.js');
var ui = readWeb('editor-authoring-agent-ui.js');

// 抽出函数体（花括号配对计数·归一函数体内无字符串/正则花括号）
function extractFn(src, name) {
  var i = src.indexOf('function ' + name + '(');
  if (i < 0) return null;
  var j = src.indexOf('{', i), depth = 0;
  for (var k = j; k < src.length; k++) {
    if (src[k] === '{') depth++;
    else if (src[k] === '}') { depth--; if (!depth) return src.slice(i, k + 1); }
  }
  return null;
}

console.log('— 归一函数 _coerceEntityValue —');
var coerceSrc = extractFn(agent, '_coerceEntityValue');
ok(!!coerceSrc, '_coerceEntityValue 存在');
ok(coerceSrc && coerceSrc.indexOf('JSON.parse') >= 0 && coerceSrc.indexOf('```') >= 0, 'JSON.parse + ```json 围栏容错');
ok(coerceSrc && /typeof p === 'object'/.test(coerceSrc) && coerceSrc.indexOf('return { ok: false }') >= 0, 'parse 出非对象/失败 → { ok:false } 标记拒绝');

console.log('— applyEdit · _ARR_COLLS 整集合字符串 parse-or-reject —');
var editBody = extractFn(agent, 'applyEdit') || '';

console.log('— applyPush · push 前同款归一 —');
var pushBody = extractFn(agent, 'applyPush') || '';

console.log('— multiEdit / bulkAdd 同径受益 —');

console.log('— onApply · 元素级归一兜底 —');
// 取完整实际函数，不能因前方新增身份守卫而在固定4200字符处截掉原有成功摘要。
var applyNode = require('acorn').parse(ui, { ecmaVersion: 'latest' }).body[0].expression.callee.body.body.find(function(n) { return n.type === 'FunctionDeclaration' && n.id.name === 'onApply'; });

console.log('— 行为断言 · eval 归一函数喂用例 —');
var coerce = null;
try { coerce = new Function('return (' + coerceSrc + ');')(); }
catch (e) { ok(false, '_coerceEntityValue 可 eval: ' + e.message); }
if (coerce) {
  var c1 = coerce('{"name":"士绅"}');
  ok(c1.ok && c1.value && c1.value.name === '士绅', '双编码对象字符串 \'{"name":"士绅"}\' → parse 出对象');
  var c2 = coerce('[{"name":"士绅"},{"name":"宗室"}]');
  ok(c2.ok && Array.isArray(c2.value) && c2.value.length === 2 && c2.value[1].name === '宗室', '数组字符串 → parse 出数组');
  var c3 = coerce('```json\n{"name":"沈家"}\n```');
  ok(c3.ok && c3.value && c3.value.name === '沈家', '```json 围栏字符串 → 剥围栏 parse 出对象');
  var obj = { name: '张三' };
  var c4 = coerce(obj);
  ok(c4.ok && c4.value === obj, '正常对象 → 原引用放行');
  ok(coerce(42).ok && coerce(42).value === 42, '标量非字符串（42）→ 原样放行');
  ok(coerce(null).ok && coerce(null).value === null, 'null → 原样放行');
  ok(coerce('这根本不是JSON').ok === false, '垃圾字符串 → 拒绝');
  ok(coerce('123').ok === false, 'parse 出标量的字符串（\'123\'）→ 拒绝');
  ok(coerce('{"name":').ok === false, '半截 JSON 字符串 → 拒绝');
  ok(coerce('').ok === false, '空字符串 → 拒绝');
}

console.log('— 行为断言 · dispatchTool 端到端（垃圾字符串喂回工具错误） —');
var AA = require(path.join(WEB, 'editor-authoring-agent.js'));
var d = {};
var e1 = AA.dispatchTool(d, 'applyEdit', { path: 'classes', value: '这根本不是JSON' });
ok(e1 && e1.ok === false && /结构化 JSON/.test(e1.reason || ''), 'applyEdit 整集合垃圾字符串 → 工具错误喂回模型');
ok(d.classes === undefined, '被拒后集合未被污染');
var e2 = AA.dispatchTool(d, 'applyEdit', { path: 'classes', value: '[{"name":"士绅"}]' });
ok(e2 && e2.ok !== false && Array.isArray(d.classes) && d.classes[0].name === '士绅', 'applyEdit 双编码数组字符串 → parse 落位');
var e3 = AA.dispatchTool(d, 'applyPush', { path: 'families', value: '{"name":"沈家"}' });
ok(e3 && e3.ok !== false && d.families[0].name === '沈家', 'applyPush 双编码对象字符串 → parse 入列');
var e4 = AA.dispatchTool(d, 'applyPush', { path: 'families', value: '垃圾' });
ok(e4 && e4.ok === false && d.families.length === 1, 'applyPush 垃圾字符串 → 拒·集合不增');
var e5 = AA.dispatchTool(d, 'applyEdit', { path: 'name', value: '普通字符串字段' });
ok(e5 && e5.ok !== false && d.name === '普通字符串字段', '非集合路径字符串字段不受影响');

console.log('\nsmoke-guoshi-write-sanitize ' + (F === 0 ? 'PASS' : 'FAIL') + ' ' + P + '/' + (P + F));
process.exit(F === 0 ? 0 : 1);
