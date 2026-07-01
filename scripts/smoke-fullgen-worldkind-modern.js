#!/usr/bin/env node
'use strict';
/* smoke-fullgen-worldkind-modern — 一键造卷(execFullGen / aiGenFullScenario) 三刀源契约：
 *   3a 健壮性：_fgFire 提到 try 外函数作用域，Step1/2 改走 _fgFire（API/网络错误降级为''→走兜底，不再整体「生成失败」）；
 *   3b worldKind：面板加「世界类型」选择，execFullGen 读 fg-worldkind、按 fiction 分支 histNote、scn.worldKind 落库；
 *   3c 现代化：人物补 isFictional/isHistorical、确保 isPlayer 主角入口、gameSettings.startYear/startMonth、新增社会阶层(P.classes)生成。
 * 真浏览器已端到端验证两档 execFullGen 均 ok:true（classes/players/worldKind/fictionFlagged 正确）；此 smoke 守接线防腐。 */
const fs = require('fs'), path = require('path');
const raw = fs.readFileSync(path.resolve(__dirname, '..', 'tm-launch.js'), 'utf8');
// tm-launch.js 把中文存为 \uXXXX 转义——先解码，统一按字面中文匹配(兼容 literal/escaped 两形)。
const src = raw.replace(/\\u([0-9a-fA-F]{4})/g, function (m, h) { return String.fromCharCode(parseInt(h, 16)); });
let A = 0, F = 0; function ok(c, m) { if (c) { A++; console.log('  ✓ ' + m); } else { F++; console.log('  ✗ FAIL: ' + m); } }
console.log('smoke-fullgen-worldkind-modern');

// ── 3b worldKind ──
ok(/id="fg-worldkind"/.test(src), '3b 面板含「世界类型」选择器 fg-worldkind');
ok(/value="historical" selected>史实（按正史考据）/.test(src), '3b 史实选项');
ok(/value="fictional">虚构（架空/.test(src), '3b 虚构选项');
ok(/var worldKind=\(_\$\("fg-worldkind"\)&&_\$\("fg-worldkind"\)\.value==="fictional"\)\?"fictional":"historical"/.test(src), '3b execFullGen 读 fg-worldkind');
ok(/var fiction=worldKind==="fictional"/.test(src), '3b fiction 标志');
ok(/var histNote=fiction[\s\S]{0,40}虚构\/架空世界观剧本/.test(src), '3b histNote 按 fiction 分支(虚构去史实锚定)');
ok(/不要套用真实历史/.test(src), '3b 虚构 histNote 中和下文「真实历史」字样');
ok(/worldKind:worldKind\}/.test(src), '3b scn.worldKind 落库');

// ── 3a 健壮性 ──
ok(/function _fgFire\(p,tok,o\)\{return callAISmart/.test(src), '3a _fgFire 仍定义');
// _fgFire 定义在 try 之前（函数作用域·供 Step1/2 用）：定义出现在 "try{" + "Step 1" 之前
const fgFirePos = src.indexOf('function _fgFire(p,tok,o){return callAISmart');
const step1Pos = src.indexOf('// Step 1');
ok(fgFirePos > 0 && step1Pos > 0 && fgFirePos < step1Pos, '3a _fgFire 定义提到 Step1 之前(函数作用域·避免严格模式块级歧义)');
ok(/var r1=await _fgFire\(prompt1,/.test(src), '3a Step1 改走 _fgFire(API 错误降级不整体失败)');
ok(/var r2=await _fgFire\(prompt2,/.test(src), '3a Step2 改走 _fgFire');
// 不应再有裸 callAISmart 直调 Step1/2（防回归）
ok(!/var r1=await callAISmart\(/.test(src) && !/var r2=await callAISmart\(/.test(src), '3a Step1/2 不再裸调 callAISmart');

// ── 3c 现代化 ──
ok(/isFictional:fiction,isHistorical:!fiction/.test(src), '3c 人物补 isFictional/isHistorical(随世界类型)');
ok(/!_scnChars\.some\(function\(c\)\{return c\.isPlayer;\}\)/.test(src) && /\.isPlayer=true/.test(src), '3c 确保 isPlayer 主角入口(运行时需·旧版从不设)');
ok(/scn\.gameSettings\.startYear = /.test(src) && /scn\.gameSettings\.startMonth = /.test(src), '3c gameSettings.startYear/startMonth(引擎权威读)');
ok(/var prompt11=/.test(src) && /社会阶层/.test(src), '3c 新增社会阶层生成 prompt11');
ok(/_fgFire\(prompt11,/.test(src), '3c prompt11 进并发批');
ok(/var r3=_fgR\[0\][\s\S]*?r11=_fgR\[8\]/.test(src), '3c r11 解构(并发批扩到 9 项)');
ok(/P\.classes\.push\(\{id:uid\(\),sid:sid,name:cl\.name/.test(src), '3c 社会阶层入库 P.classes(satisfaction/influence)');

console.log('\nsmoke-fullgen-worldkind-modern ' + (F === 0 ? 'PASS' : 'FAIL') + ' ' + A + '/' + (A + F));
process.exit(F === 0 ? 0 : 1);
