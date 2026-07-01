#!/usr/bin/env node
'use strict';
/* smoke-fullgen-editor-worldkind — 编辑器 one-shot 生成器(editor-fullgen.js doFullGenerate) 虚构/架空世界观支持：
 *   该生成器已是较全的现代生成器(worldSettings/government/officeTree/adminHierarchy/military/parties/goals/per-char type·
 *   每步 .catch 续步已健壮)，唯一缺口=所有 gameMode(演义/严格史实/轻度史实)都默认中国古代史。
 *   本刀加 worldKind 维度(与 gameMode 正交·fiction 覆盖):面板加「世界类型」选择·doFullGenerate 读·scriptData.worldKind 落库·
 *   fiction 时把强史实指令一次性中和(注入 ctx·传播全步)+关掉 strict_hist 检索/历史检查/名臣年限/参考库·玩家角色 type 随之。
 *   并让国师 genReference(读老编辑器范式) 在 fiction 剧本下附「忽略史实考据」note。 */
const fs = require('fs'), path = require('path');
function deU(s) { return s.replace(/\\u([0-9a-fA-F]{4})/g, function (m, h) { return String.fromCharCode(parseInt(h, 16)); }); }
const html = fs.readFileSync(path.resolve(__dirname, '..', 'editor.html'), 'utf8');
const fg = deU(fs.readFileSync(path.resolve(__dirname, '..', 'editor-fullgen.js'), 'utf8'));
const aa = deU(fs.readFileSync(path.resolve(__dirname, '..', 'editor-authoring-agent.js'), 'utf8'));
let A = 0, F = 0; function ok(c, m) { if (c) { A++; console.log('  ✓ ' + m); } else { F++; console.log('  ✗ FAIL: ' + m); } }
console.log('smoke-fullgen-editor-worldkind');

// ── 模态选择器(editor.html) ──
ok(/id="fullGenWorldKind"/.test(html), '模态含「世界类型」选择器 fullGenWorldKind');
ok(/value="historical" selected>史实/.test(html), '模态史实选项(默认)');
ok(/value="fictional">虚构（架空/.test(html), '模态虚构选项');

// ── doFullGenerate 读取 + 落库(editor-fullgen.js) ──
ok(/var worldKind = \(_wkEl && _wkEl\.value === 'fictional'\) \? 'fictional' : 'historical'/.test(fg), 'doFullGenerate 读 fullGenWorldKind');
ok(/var fiction = worldKind === 'fictional'/.test(fg), 'fiction 标志');
ok(/scriptData\.worldKind = worldKind/.test(fg), 'scriptData.worldKind 落库');

// ── fiction 一次性中和史实(注入 ctx·传播全步) ──
ok(/if \(fiction\) ctx \+=/.test(fg) && /世界观·虚构\/架空/.test(fg), 'fiction 时把史实中和指令注入 ctx');
ok(/type 一律填 "fictional"/.test(fg), 'fiction ctx 指示人物 type 填 fictional');

// ── fiction 关掉真实史实约束(与 gameMode 正交·覆盖) ──
ok(/if \(!fiction && gameMode === 'strict_hist' && refText\)/.test(fg), '严格史实参考库 fiction 时不建');
ok(/if \(fiction\) \{ historicalCharLimit = ''; refContext = ''; \}/.test(fg), 'fiction 清空名臣年限+参考库');
ok(/if \(!fiction && gameMode === 'strict_hist'\) \{/.test(fg), 'fiction 跳过 strict_hist 数据库检索步');
ok(/if \(!fiction && \(gameMode === 'light_hist' \|\| gameMode === 'strict_hist'\)\)/.test(fg), 'fiction 跳过生成后历史检查');

// ── 玩家角色 type 随世界类型 ──
ok(/type: \(scriptData\.worldKind === 'fictional'\) \? 'fictional' : 'historical'/.test(fg), 'syncPlayerCharToList 玩家角色 type 随 worldKind');

// ── 国师 genReference 在 fiction 剧本下中和老范式的史实考据 ──
ok(/function _genReferenceTool\(part, worldKind\)/.test(aa), 'genReference 收 worldKind 参');
ok(/worldKind === 'fictional'[\s\S]{0,80}虚构\/架空世界观/.test(aa), 'genReference fiction 时备中和 note');
ok(/_genReferenceTool\(input\.part, \(draft && draft\.worldKind === 'fictional'\)/.test(aa), 'dispatch 把 draft.worldKind 传给 genReference');

console.log('\nsmoke-fullgen-editor-worldkind ' + (F === 0 ? 'PASS' : 'FAIL') + ' ' + A + '/' + (A + F));
process.exit(F === 0 ? 0 : 1);
