#!/usr/bin/env node
'use strict';
/* smoke-region-age-settlement-labels — 地块面板 年龄/聚落 字段原始键泄漏修复
 * bug:地块势力面板 年龄行显 "旧值/count/ratio/丁口"、聚落行显 "fang/shi/zhen"(嵌套对象键走泛型 dump·
 *      fieldLabel 兜底 readableUnknownField 把 old→"旧值"(年龄语境错)、count/ratio/fang/shi/zhen 吐原文)。
 * 修:byAge/bySettlement 走专用格式化器 fmtByAge/fmtBySettlement(显式键→中文·朝代中立·绕开泛型 dump)。 */
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.resolve(__dirname, '..', 'phase8-formal-map.js'), 'utf8');
let A = 0, F = 0;
function ok(c, m) { if (c) { A++; console.log('  ✓ ' + m); } else { F++; console.log('  ✗ FAIL: ' + m); } }
console.log('smoke-region-age-settlement-labels');

// 专用格式化器存在
ok(/function fmtByAge\(a\)\{/.test(src), 'fmtByAge 定义');
ok(/function fmtBySettlement\(s\)\{/.test(src), 'fmtBySettlement 定义');

// 年龄键→中文(old=老弱 非"旧值"·young=少壮·ding=丁壮)
const age = src.match(/function fmtByAge[\s\S]*?\n  \}/);
const ageBody = age ? age[0] : '';
ok(/young: '少壮'/.test(ageBody) && /ding: '丁壮'/.test(ageBody) && /old: '老弱'/.test(ageBody), '① 年龄 young→少壮/ding→丁壮/old→老弱(old 不再误译旧值)');
ok(/g\.count/.test(ageBody) && /mapNum\(cnt\)/.test(ageBody), '① 取 count·mapNum 格式化(万/亿)·不吐 count/ratio 键');

// 聚落键→中文(fang=坊/shi=市/zhen=镇)
const set = src.match(/function fmtBySettlement[\s\S]*?\n  \}/);
const setBody = set ? set[0] : '';
ok(/fang: '坊'/.test(setBody) && /shi: '市'/.test(setBody) && /zhen: '镇'/.test(setBody), '② 聚落 fang→坊/shi→市/zhen→镇');

// 渲染点接入格式化器(非裸 data.byAge/data.bySettlement)
ok(/\['年龄', fmtByAge\(data\.byAge\)\]/.test(src), '③ 渲染:年龄走 fmtByAge(data.byAge)');
ok(/\['聚落', fmtBySettlement\(data\.bySettlement\)\]/.test(src), '③ 渲染:聚落走 fmtBySettlement(data.bySettlement)');
ok(!/\['年龄', data\.byAge\]/.test(src) && !/\['聚落', data\.bySettlement\]/.test(src), '③ 不再裸 dump data.byAge/data.bySettlement');

// 性别/族群/信仰不动(本就正确·不误改)
ok(/\['性别', data\.byGender\]/.test(src) && /\['族群', data\.byEthnicity\]/.test(src) && /\['信仰', data\.byFaith\]/.test(src), '· 性别/族群/信仰保持原样(不误改)');

console.log('\nsmoke-region-age-settlement-labels ' + (F === 0 ? 'PASS' : 'FAIL') + ' ' + A + '/' + (A + F));
process.exit(F ? 1 : 0);
