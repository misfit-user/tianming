#!/usr/bin/env node
'use strict';
/* smoke-workshop-ui-redo — 剧本工坊 UI 全面重做（2026-07-03 玄墨案头 W1-W4）防腐线。
 * W1 壳：灭照片纹理(ancient-tabletop-board 不再被引用)·JE-* 自带字体按 ../assets/fonts 声明·玄墨 token 层。
 * W2 rail：九章书脊(朱印左标接管 Slice52 ::before·雕版 glyph 走 --je-font-seal)。
 * W3 纸面：.inspector 语义 token 作用域翻转(纸上墨字)·折子组白面朱丝栏。
 * W4 功能：dock 让宽回退 420 与面板一致·hd 安全插入(✕ 嵌套 .tm-aa-hdbtns 后 insertBefore 不再炸)·
 *          跨模块搜索(他章命中签 data-cross-jump)·换章翻页动效 jePageTurn·
 *          agent-ui 字体基址按脚本位置解析(子目录宿主不再 404)。
 * (视觉真机截图另验·此 smoke 守结构接线防回退) */
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.resolve(__dirname, '..', 'preview', 'scenario-editor-reset-preview.html'), 'utf8');
/* R1 架构整备：CSS 已外提独立样式表·样式断言读 css·页内脚本断言仍读 html */
const css = fs.readFileSync(path.resolve(__dirname, '..', 'preview', 'scenario-editor-reset-style.css'), 'utf8');
/* R2 架构整备：页内九个适配 IIFE 已外提合并·适配层断言读 adapters */
const adapters = fs.readFileSync(path.resolve(__dirname, '..', 'preview', 'scenario-editor-reset-adapters.js'), 'utf8');
const app = fs.readFileSync(path.resolve(__dirname, '..', 'preview', 'scenario-editor-reset-app.js'), 'utf8');
const ui = fs.readFileSync(path.resolve(__dirname, '..', 'editor-authoring-agent-ui-icons.js'), 'utf8') + fs.readFileSync(path.resolve(__dirname, '..', 'editor-authoring-agent-ui.js'), 'utf8') + fs.readFileSync(path.resolve(__dirname, '..', 'editor-authoring-agent-ui-render.js'), 'utf8');
let A = 0, F = 0; function ok(c, m) { if (c) { A++; console.log('  ✓ ' + m); } else { F++; console.log('  ✗ FAIL: ' + m); } }
console.log('smoke-workshop-ui-redo');

console.log('— W1 壳 · 玄墨地基 —');
ok(!/url\("img\/ancient-tabletop-board\.png"/.test(css), 'W1 照片纹理零真实引用(body 背景不再走图片·仅注释存目)');
ok(/@font-face\s*\{\s*font-family:\s*"JE-XiaoWei";\s*src:\s*url\("\.\.\/assets\/fonts\/ZCOOLXiaoWei-Regular\.ttf"\)/.test(css), 'W1 JE-XiaoWei 自带字体按 ../assets/fonts 正确路径声明');
ok(/--je-chrome-1:\s*#1b1917/.test(css) && /--je-hairline:\s*rgba\(245, 240, 232, \.08\)/.test(css), 'W1 玄墨 chrome token 层在');
ok(/--je-font-seal:\s*"JE-MaShanZheng"/.test(css), 'W1 印章字体栈(毛笔楷)在');

console.log('— W2 rail · 九章书脊 —');
ok(/#module-rail \.module-tile\.active::before\s*\{[^}]*#c04030/.test(css), 'W2 朱印左标接管 Slice52 ::before(朱砂渐变)');
ok(/#module-rail \.module-glyph\s*\{[^}]*var\(--je-font-seal\)/.test(css), 'W2 章 glyph 走毛笔印章字体');
ok(/#module-rail \.module-tile\.active\s*\{[^}]*box-shadow:\s*none/.test(css), 'W2 压掉旧内嵌金圈');

console.log('— W3 纸面 · 案卷=一整张纸 —');
ok(/\.editor-grid > \.inspector\s*\{[^}]*--paper-strong:\s*#262014/.test(css), 'W3 语义 token 纸面作用域翻转(纸上墨字)');
ok(/\.inspector \.folio-group\s*\{[^}]*rgba\(255, 253, 246, \.55\)/.test(css), 'W3 折子组白面');
ok(/\.inspector \.folio-group-head::before\s*\{[^}]*#b23c2c/.test(css), 'W3 组头朱丝栏');
ok(/\.inspector \.je-health\s*\{[^}]*border-left:\s*3px solid #a83228/.test(css), 'W3 体检横幅=朱批眉批条');

console.log('— W4 功能件 —');
ok(/padding-right: calc\(var\(--tm-aa-dock-w, 420px\) \+ 14px\)/.test(css), 'W4 dock 让宽回退 420(与面板 width 回退一致·不再钻面板底下)');
ok(!/hdRow\.insertBefore\(\w+, hdRow\.querySelector\('#tm-aa-x'\)\)/.test(adapters), 'W4 头部注入无裸 insertBefore(#tm-aa-x 已嵌套·全走安全插入)');
// 2026-10-15 国师重做：工坊不再往国师顶栏塞按钮（测试连接/审阅/导入/捆绑/批量/设置等都收进面板自己的 ＋ 菜单、命令面板与设置），故不再有插入点可判
ok(!/querySelector\('#tm-aa-hd'\)/.test(adapters) && !/je-aa-test/.test(adapters), 'W4 工坊不往国师顶栏注入按钮(按钮收归面板)');
ok(/data-cross-jump/.test(app) && /他章命中/.test(app), 'W4 跨模块搜索:他章命中签在 app.js');
ok(/function jePageTurn\(\)/.test(app) && /jeSwitched/.test(app), 'W4 换章翻页动效(重选同章不闪)');
ok(/@keyframes jePageTurn/.test(css) && /\.field-cross-hits/.test(css), 'W4 翻页动画与命中签样式在');
ok(/var FONT_BASE = /.test(ui) && /url\("' \+ FONT_BASE \+ 'assets\/fonts\/ZCOOLXiaoWei-Regular\.ttf"\)/.test(ui), 'W4 agent-ui 字体基址按脚本位置解析(子目录宿主不 404)');

console.log('— X1 总览控制台内部玄墨化 —');
ok(/\.main-stack \.metric,\s*\n\s*\.main-stack \.mode-card/.test(css) && /background: var\(--je-chrome-2\)/.test(css), 'X1 卡片族(统计/模式/健康/模板…)成批玄墨');
ok(/\.main-stack \.section-nav-pill\[data-active="true"\]\s*\{[^}]*rgba\(184, 154, 83, \.14\)/.test(css), 'X1 分节导航 active=金tint(压掉旧金玉渐变)');
ok(/\.main-stack \.workflow-step-card,[\s\S]{0,400}rgba\(126, 184, 167, \.06\)/.test(css), 'X1 青瓷件统一 celadon 色相');
console.log('— X2 弹窗族收敛 —');
ok(/\.je-cmdk,\s*\n\s*\.je-import,\s*\n\s*\.je-pv-modal\s*\{\s*\n\s*background: var\(--je-chrome-2\)/.test(css), 'X2 ⌘K/导入/玩家视角容器=玄墨浮层(去暗金渐变)');
ok(/\.je-cmdk \.je-cmdk-item\.active,[\s\S]{0,80}rgba\(184, 154, 83, \.15\)/.test(css), 'X2 ⌘K active 行金tint');
console.log('— X3 横幅+深度台漏网 —');
ok(/\.je-guard-toast\s*\{\s*\n\s*background: var\(--je-chrome-2\);\s*\n\s*border: 1px solid rgba\(192, 64, 48, \.5\);\s*\n\s*border-left: 3px solid #c04030/.test(css), 'X3 一致性横幅=玄墨朱批浮签(亮珊瑚块退役)');
ok(/\.inspector #field-editor-value\s*\{\s*\n\s*background: #f6f0df/.test(css) && /var\(--je-font-mono\)/.test(css), 'X3 JSON编辑器本尊纸面井+等宽(上轮漏网)');
ok(/\.inspector \.missing-field-callout b \{ color: #7d5e22; \}/.test(css), 'X3 字段缺失 callout 纸上墨字');

console.log('— Z 逐章走查收尾 —');
ok(/function oftObjChip\(val\)/.test(app) && /oftObjChip\(val\) \|\| '<input /.test(app), 'Z 官制对象值渲只读结构签(不再 [object Object] 进可回写 input·防编辑毁结构)');
ok(/::selection \{ background: rgba\(184, 154, 83, \.32\)/.test(css) && /\.inspector ::selection/.test(css), 'Z ::selection 墨面金晕/纸面朱晕(去浏览器默认蓝)');
ok(!/open-api-settings-modal/.test(app) && !/openApiSettingsModal/.test(app), 'Z 顶栏⚙API设置模态退役(owner指认·主API配置在国师模型徽弹层)');
ok(/data-panel="api-settings-workbench"/.test(app) && /renderApiSettingsWorkbench/.test(app), 'Z 生图API面板(api-settings-workbench)保留·能力不失(五幕重构后胶囊没了·面板与渲染器仍在·归更多幕)');

console.log('— C 内容整备 —');
ok(/'worldview': '世界观/.test(app) && /'influenceGroups': '影响集团/.test(app) && /'presetRelations': '预置关系/.test(app), 'C 蓝图差集6字段描述补齐(喂字段搜索·据runtimeSurface证据)');
ok(/军事内容要成体系/.test(adapters) && /财政经济要能跑通/.test(adapters) && /阶层与党派要有张力/.test(adapters), 'C SECTION_GUIDES 补军事/财政/规则/编年/阶层五章领域指引(生成本章不再退化通用句)');

console.log('\nsmoke-workshop-ui-redo ' + (F === 0 ? 'PASS' : 'FAIL') + ' ' + A + '/' + (A + F));
process.exit(F === 0 ? 0 : 1);
