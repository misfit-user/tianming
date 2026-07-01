#!/usr/bin/env node
'use strict';
/* smoke-editor-renderall-resilient — 旧编辑器 renderAll 健壮性(W·真bug修复):
 * renderAll 原 25 个无守卫裸调·任一未定义(实测 renderMapSystem/renderTerrainConfig 在 editor.html 上下文非全局·仅 TM.Editor.map.*)
 * 或抛错→整个 renderAll 中断→其后面板(government/officeTree/goals…)初始化漏渲+每次报错。
 * 修复=逐个 try/catch + typeof 守卫(与 editor-core.js _panelRenderers 一致)。真浏览器已验 renderAll 不再抛、尾部函数可达。 */
const fs = require('fs'), path = require('path');
const fg = fs.readFileSync(path.resolve(__dirname, '..', 'editor-fullgen.js'), 'utf8');
let A = 0, F = 0; function ok(c, m) { if (c) { A++; console.log('  ✓ ' + m); } else { F++; console.log('  ✗ FAIL: ' + m); } }
console.log('smoke-editor-renderall-resilient');

// 抽 renderAll 函数体
const m = fg.match(/function renderAll\(\)\s*\{([\s\S]*?)\n  \}/);
ok(!!m, 'renderAll 函数存在');
const body = m ? m[1] : '';

// 不再有无守卫裸调(老 bug:renderMapSystem(); 等顶格裸调)
ok(!/\n\s*renderMapSystem\(\);/.test(body), '不含无守卫裸调 renderMapSystem();(老中断点已除)');
ok(!/\n\s*renderCharacters\(\);/.test(body), '不含无守卫裸调 renderCharacters();');
ok(!/\n\s*renderGovernment\(\);/.test(body), '不含无守卫裸调 renderGovernment();');

// 改为守卫+隔离的循环
ok(/forEach/.test(body), 'renderAll 走 forEach 逐个渲染');
ok(/if \(typeof f === 'function'\) f\(\)/.test(body), '每个渲染器 typeof 守卫(未定义则跳过不崩)');
ok(/try \{[\s\S]*catch \(e\)/.test(body), '每个渲染器 try/catch 隔离(抛错不中断其余)');

// 覆盖:关键渲染器名都在列(顺序/覆盖不丢)
['renderPlayerOverview', 'renderCharacters', 'renderMapSystem', 'renderTerrainConfig', 'renderGovernment', 'renderOfficeTree', 'renderGoalsList', 'renderOffendGroupsList'].forEach(function (n) {
  ok(new RegExp("'" + n + "'").test(body), '渲染器在列: ' + n);
});

console.log('\nsmoke-editor-renderall-resilient ' + (F === 0 ? 'PASS' : 'FAIL') + ' ' + A + '/' + (A + F));
process.exit(F === 0 ? 0 : 1);
