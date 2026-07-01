#!/usr/bin/env node
'use strict';
/* smoke-endturn-context-caps — S1 降本:势力/党派运行时态 dump 封顶
 * 契约:①常规剧本(≤上限)保持原序原样·无「从略」注(字节不变·不改行为)
 *       ②极大剧本(>上限)按显要度截断到上限·濒临崩溃势力必留·注明从略
 *       ③低显要度势力被截掉 */
const vm = require('vm'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const code = fs.readFileSync(path.resolve(ROOT, 'tm-endturn-ai-context.js'), 'utf8');
const sandbox = { console: console };
sandbox.window = sandbox;          // IIFE 认 window → 模块内 global=sandbox
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: 'tm-endturn-ai-context.js' });
const fn = sandbox.TM.EndTurnAIContext.appendPromptPolicyContext;

let A = 0, F = 0;
function ok(c, m) { if (c) { A++; console.log('  ✓ ' + m); } else { F++; console.log('  ✗ FAIL: ' + m); } }
console.log('smoke-endturn-context-caps');

function fac(name, strength, extra) {
  return Object.assign({ name: name, lifePhase: 'stable', strength: strength, legitimacy: 50, population: 100, morale: 60, stability: 60 }, extra || {});
}
function run(GM) { return fn('', { GM: GM, P: { conf: {} } }); }

// ── ① 常规剧本(3势力/2党派)原序原样·无从略注 ──
(function () {
  var GM = {
    turn: 5,
    facs: [fac('甲势力', 30), fac('乙势力', 20), fac('丙势力', 10)],
    partyState: { '东林': { influence: 40, cohesion: 30, officeCount: 5 }, '阉党': { influence: 35, cohesion: 25, officeCount: 4 } }
  };
  var out = run(GM);
  ok(out.indexOf('甲势力') >= 0 && out.indexOf('乙势力') >= 0 && out.indexOf('丙势力') >= 0, '① 3 势力全在');
  ok(out.indexOf('甲势力') < out.indexOf('乙势力') && out.indexOf('乙势力') < out.indexOf('丙势力'), '① 势力原序保留(甲<乙<丙)');
  ok(out.indexOf('次要势力数值从略') < 0, '① ≤上限无「势力从略」注(字节不变)');
  ok(out.indexOf('东林') >= 0 && out.indexOf('阉党') >= 0 && out.indexOf('次要党派数值从略') < 0, '① 2 党派全在·无党派从略注');
})();

// ── ② 极大剧本(30势力)截断到 24 + 濒临崩溃必留 + 从略注 ──
(function () {
  var facs = [];
  for (var i = 0; i < 29; i++) facs.push(fac('势力' + (i + 10), 10 + i));   // strength 10..38·显要度>0
  facs.push(fac('崩溃小势', 3, { _collapsing: true }));                    // 弱但濒临崩溃(salience+1000)
  facs.push(fac('寂寂无名', 0, { stability: 100, morale: 100 }));          // 显要度≈0·应被截
  var GM = { turn: 5, facs: facs };
  var out = run(GM);
  var lineCount = (out.match(/  - .*阶段=/g) || []).length;
  ok(lineCount === 24, '② 30 势力截到 24 行(实=' + lineCount + ')');
  ok(out.indexOf('崩溃小势') >= 0, '② 濒临崩溃势力(弱实力)因显要度必留');
  ok(out.indexOf('寂寂无名') < 0, '② 最低显要度势力被截掉');
  ok(/另有 \d+ 个次要势力数值从略/.test(out) && out.indexOf('另有 7 个次要势力数值从略') >= 0, '② 从略注(31→24 省 7)present');
})();

// ── ③ 极大党派(20)截到 16 + 从略注 ──
(function () {
  var ps = {};
  for (var i = 0; i < 20; i++) ps['党' + i] = { influence: i, cohesion: 10, officeCount: (i % 3) };
  var GM = { turn: 5, facs: [], partyState: ps };
  var out = run(GM);
  var pLines = (out.match(/  - 党\d+ 影响=/g) || []).length;
  ok(pLines === 16, '③ 20 党派截到 16 行(实=' + pLines + ')');
  ok(out.indexOf('另有 4 个次要党派数值从略') >= 0, '③ 党派从略注(20→16 省 4)');
  ok(out.indexOf('党19') >= 0 && out.indexOf('党0 影响=') < 0, '③ 高影响党留·最低影响党(党0)截');
})();

console.log('\nsmoke-endturn-context-caps ' + (F === 0 ? 'PASS' : 'FAIL') + ' ' + A + '/' + (A + F));
process.exit(F ? 1 : 0);
