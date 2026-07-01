#!/usr/bin/env node
'use strict';
/* smoke-editor-pipeline-shim — 旧编辑器 SettlementPipeline/GameHooks no-op 垫片(W·真bug修复):
 * editor.html 不加载 tm-ai-infra.js(故意·见 editor-authoring-agent.js 注释)·但所加载的引擎文件
 * (tm-mechanics/tm-mechanics-world/tm-military/tm-feudal)顶层有无守卫 SettlementPipeline.register / GameHooks.on 裸调
 * →编辑器上下文抛 ReferenceError·截断该文件其后所有顶层定义(含末尾导出)。
 * 修复=在 defer 引擎脚本之前注入 no-op 垫片(typeof 守卫·不覆盖正式游戏真实版)。真浏览器已验 editor.html 非favicon错误=0。 */
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.resolve(__dirname, '..', 'editor.html'), 'utf8');
let A = 0, F = 0; function ok(c, m) { if (c) { A++; console.log('  ✓ ' + m); } else { F++; console.log('  ✗ FAIL: ' + m); } }
console.log('smoke-editor-pipeline-shim');

// 垫片存在 + no-op + 守卫
ok(/typeof window\.SettlementPipeline === 'undefined'/.test(html), 'SettlementPipeline 垫片 typeof 守卫(不覆盖游戏真实版)');
ok(/window\.SettlementPipeline = \{ register: function\(\)\{\}/.test(html), 'SettlementPipeline.register = no-op');
ok(/typeof window\.GameHooks === 'undefined'/.test(html), 'GameHooks 垫片 typeof 守卫');
ok(/window\.GameHooks = \{ on: function\(\)\{\}/.test(html), 'GameHooks.on = no-op');

// 垫片必须在 defer 引擎脚本之前(否则裸调先抛)
var shimIdx = html.indexOf('window.SettlementPipeline = {');
var firstEngineIdx = html.indexOf('src="tm-mechanics.js"');
var militaryIdx = html.indexOf('src="tm-military.js"');
ok(shimIdx > 0 && firstEngineIdx > 0 && shimIdx < firstEngineIdx, '垫片位于 tm-mechanics.js 之前(parse 时先执行)');
ok(shimIdx > 0 && militaryIdx > 0 && shimIdx < militaryIdx, '垫片位于 tm-military.js 之前');

// 确认那 4 个有顶层无守卫 register 的引擎文件确被 editor.html 加载(垫片确有必要)
['tm-mechanics.js', 'tm-mechanics-world.js', 'tm-military.js', 'tm-feudal.js'].forEach(function (f) {
  ok(html.indexOf('src="' + f + '"') > 0, 'editor.html 加载 ' + f + '(需垫片护其顶层 register)');
});

console.log('\nsmoke-editor-pipeline-shim ' + (F === 0 ? 'PASS' : 'FAIL') + ' ' + A + '/' + (A + F));
process.exit(F === 0 ? 0 : 1);
