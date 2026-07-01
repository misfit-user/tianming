#!/usr/bin/env node
'use strict';
/* smoke-faction-stats-nooverflow — 势力面板统计卡片(.bk-stats 5列网格)溢出到地图修复
 * bug:地块势力面板 户口/实收/民心 三卡溢出 392px 面板、飘到右侧地图上(某些引擎/WebView 下 repeat(5,1fr)
 *      轨道 min=内容宽·不缩→5卡累加超面板宽)。修:①grid 列 minmax(0,1fr)(轨道最小值显式=0·强制五列塞进面板)
 *      ②.bk-stat min-width:0 ③.bk-stats overflow:hidden+max-width:100%(硬兜底·任何引擎都不溢出到地图)。 */
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.resolve(__dirname, '..', 'phase8-formal-bridge.js'), 'utf8');
let A = 0, F = 0;
function ok(c, m) { if (c) { A++; console.log('  ✓ ' + m); } else { F++; console.log('  ✗ FAIL: ' + m); } }
console.log('smoke-faction-stats-nooverflow');

// 抓 .bk-stats 规则体
const m = src.match(/#ppop\.tmf-book \.bk-stats\{([^}]*)\}/);
ok(!!m, '找到 .bk-stats 规则');
const stats = m ? m[1] : '';
ok(/grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/.test(stats), '① 5列用 minmax(0,1fr)(轨道最小值=0·可缩·不再按内容宽撑溢出)');
ok(!/grid-template-columns:repeat\(5,1fr\)/.test(stats), '① 不再是裸 repeat(5,1fr)(旧·某些引擎溢出)');
ok(/overflow:hidden/.test(stats), '③ .bk-stats overflow:hidden(硬兜底·卡片绝不溢出到地图)');
ok(/max-width:100%/.test(stats), '③ .bk-stats max-width:100%(不超面板宽)');

// .bk-stat 加 min-width:0
const m2 = src.match(/#ppop\.tmf-book \.bk-stat\{([^}]*)\}/);
ok(!!m2 && /min-width:0/.test(m2[1]), '② .bk-stat min-width:0(网格项可缩)');

// 卡内文本仍截断(不改·配合列收缩)
const m3 = src.match(/#ppop\.tmf-book \.bk-stat \.v\{([^}]*)\}/);
ok(!!m3 && /text-overflow:ellipsis/.test(m3[1]) && /overflow:hidden/.test(m3[1]), '·.bk-stat .v 仍 nowrap+ellipsis(列缩后文本省略·不外溢)');

console.log('\nsmoke-faction-stats-nooverflow ' + (F === 0 ? 'PASS' : 'FAIL') + ' ' + A + '/' + (A + F));
process.exit(F ? 1 : 0);
