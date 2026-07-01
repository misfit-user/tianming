#!/usr/bin/env node
'use strict';
/* smoke-authoring-ui-worldkind — 国师面板「世界类型」选择器(刀2)源契约：
 *   选择器渲染(史实/虚构) + els 绑定 + 点击写 scenario.worldKind(makeDraft 克隆活对象→draft.worldKind→runAuthoringLoop 自动读) +
 *   开面板反映当前类型 + CSS 注入。DOM 行为另由真浏览器 e2e 验证；此 smoke 守接线防腐。 */
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.resolve(__dirname, '..', 'editor-authoring-agent-ui.js'), 'utf8');
let A = 0, F = 0; function ok(c, m) { if (c) { A++; console.log('  ✓ ' + m); } else { F++; console.log('  ✗ FAIL: ' + m); } }
console.log('smoke-authoring-ui-worldkind');

// 渲染：选择器 + 两档按钮
ok(/id="tm-aa-worldkind"/.test(src), '面板渲染 #tm-aa-worldkind 选择器');
ok(/data-wk="historical"[^>]*>史实</.test(src), '史实档按钮(data-wk=historical)');
ok(/data-wk="fictional"[^>]*>虚构</.test(src), '虚构档按钮(data-wk=fictional)');
// els 绑定
ok(/worldkind:\s*panel\.querySelector\('#tm-aa-worldkind'\)/.test(src), 'els.worldkind 绑定');
// 点击写进活剧本对象 + 同步 ui.draft
ok(/function _setWorldKind/.test(src) && /sc\.worldKind = v/.test(src), '_setWorldKind 写 scenario.worldKind(活对象)');
ok(/if \(ui\.draft\) ui\.draft\.worldKind = v/.test(src), '_setWorldKind 同步续接中的 ui.draft.worldKind');
// 读取 helper 默认史实
ok(/function _worldKind/.test(src) && /worldKind === 'fictional'\) \? 'fictional' : 'historical'/.test(src), '_worldKind 读取(默认史实)');
// 绑定 + 初始/开面板反映
ok(/_ensureWorldKind\(\);/.test(src), '_ensureWorldKind 在 buildPanel 调用');
ok(/function _ensureWorldKind/.test(src) && /_reflectWorldKind\(\)/.test(src), '_ensureWorldKind 绑点击 + 初始反映');
ok(/classList\.contains\('open'\)\) \{ _syncEmpty\(\); _reflectWorldKind\(\)/.test(src), '开面板时反映当前世界类型');
// CSS 注入
ok(/#tm-aa-worldkind\{display:flex/.test(src) && /\.tm-aa-wk-opt\.on\{/.test(src), 'CSS 注入选择器样式(含 .on 选中态)');

console.log('\nsmoke-authoring-ui-worldkind ' + (F === 0 ? 'PASS' : 'FAIL') + ' ' + A + '/' + (A + F));
process.exit(F === 0 ? 0 : 1);
