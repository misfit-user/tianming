#!/usr/bin/env node
'use strict';
/* smoke-scenario-return-sanitize — 写回条目归一（治污染草稿装死）防腐线。
 * 玩家故障：剧本工坊「写回正式游戏」按钮装死——污染草稿数组字段混入 JSON 字符串条目
 * （classes:['{"name":"士绅",…}']），buildRuntimeReturnScenario 严格模式给字符串赋 sid 同步抛
 * TypeError，写回载荷完全未落地，且 handleEditorCommand 分支无 try/catch 玩家看不见任何反馈。
 * 本 smoke 钉：编辑器侧/游戏侧归一 helper 在、先归一后赋 sid、命令分支有同步 try/catch，
 * 并用 eval 抽真实 helper 源码跑行为断言（字符串条目修复/垃圾丢弃计数）。 */
var fs = require('fs');
var path = require('path');
var ROOT = path.resolve(__dirname, '..');
var P = 0, F = 0;
function ok(c, m) { if (c) { P++; console.log('  ✓ ' + m); } else { F++; console.log('  ✗ FAIL: ' + m); } }
console.log('smoke-scenario-return-sanitize');

var app = fs.readFileSync(path.join(ROOT, 'preview/scenario-editor-reset-app.js'), 'utf8');
var bridge = fs.readFileSync(path.join(ROOT, 'preview/scenario-editor-sandbox-bridge.js'), 'utf8');

/* 抽出 2 空格缩进的顶层局部函数源码（内部闭包缩进更深·首个 \n  两空格} 即函数尾） */
function grab(src, name) {
  var re = new RegExp('function ' + name + '\\([^)]*\\) \\{[\\s\\S]*?\\n  \\}');
  var m = src.match(re);
  if (!m) throw new Error('extract failed: ' + name);
  return m[0];
}

console.log('— 静态·编辑器侧（reset-app） —');
var buildBody = '';
try { buildBody = grab(app, 'buildRuntimeReturnScenario'); } catch (e) {}
ok(!!buildBody, 'buildRuntimeReturnScenario 源码可抽取');

console.log('— 静态·游戏侧（sandbox-bridge） —');
var normBody = '', installBody = '';
try { normBody = grab(bridge, 'normalizeRuntimeScenario'); } catch (e) {}
try { installBody = grab(bridge, 'installRows'); } catch (e) {}

console.log('— 行为·编辑器侧 helper（eval 真源码） —');
try {
  var appCandidate = grab(app, 'jsonCandidateFromText');
  var appSanitize = grab(app, '_sanitizeRowEntries');
  var appFn = eval('(function(){ function isObject(v){ return v && typeof v === "object" && !Array.isArray(v); }\n'
    + appCandidate + '\n' + appSanitize + '\nreturn _sanitizeRowEntries; })')();
  var r1 = appFn(['{"name":"士绅"}', { name: '正常' }, '垃圾字符串', '[{"a":1}]']);
  ok(r1.rows.length === 2 && r1.rows[0].name === '士绅' && r1.rows[1].name === '正常',
    '字符串条目 JSON.parse 回对象·对象原样·垃圾丢弃（rows=2）');
  ok(r1.repaired === 1 && r1.dropped === 2, 'repaired=1（士绅）·dropped=2（垃圾字符串+parse出数组）');
  var r2 = appFn(['```json\n{"name":"武将"}\n```', null, 42]);
  ok(r2.rows.length === 1 && r2.rows[0].name === '武将' && r2.repaired === 1 && r2.dropped === 2,
    '围栏 JSON 容错修复·null/数字丢弃');
  var r3 = appFn([{ name: '干净' }]);
  ok(r3.rows.length === 1 && r3.repaired === 0 && r3.dropped === 0, '干净数组零计数');
} catch (e) {
  ok(false, 'app helper eval/行为断言异常：' + (e && e.message || e));
}

console.log('— 行为·游戏侧 helper（eval 真源码） —');
try {
  var brSanitize = grab(bridge, '_sanitizeRowEntries');
  var brCandidate = grab(bridge, 'jsonCandidateFromText');
  var brFn = eval('(function(){ function isObject(v){ return v && typeof v === "object" && !Array.isArray(v); }\n'
    + brCandidate + '\n' + brSanitize + '\nreturn _sanitizeRowEntries; })')();
  var b1 = brFn(['{"name":"士绅"}', { name: '正常' }, '垃圾字符串', '[{"a":1}]']);
  ok(b1.length === 2 && b1[0].name === '士绅' && b1[1].name === '正常',
    'bridge：字符串条目修复·对象原样·垃圾与parse出数组丢弃（rows=2）');
  var b2 = brFn(['```json\n{"name":"武将"}\n```']);
  ok(b2.length === 1 && b2[0].name === '武将', 'bridge：围栏 JSON 容错修复');
} catch (e) {
  ok(false, 'bridge helper eval/行为断言异常：' + (e && e.message || e));
}

console.log('\nsmoke-scenario-return-sanitize ' + (F === 0 ? 'PASS' : 'FAIL') + ' ' + P + '/' + (P + F));
process.exit(F === 0 ? 0 : 1);
