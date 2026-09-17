#!/usr/bin/env node
/* eslint-env node */
// smoke-rank-display-sources.js — 品级单一真相源·接线源码契约 (2026-06-13)
// 锁住：解析器强化(tm-promotion) + 图志品级显示走权威(tm-renwu-tuzhi) + 头衔真源吸收 title 段(tm-office-system) + AI prompt 完整官职(tm-endturn-prompt)。
'use strict';

const fs = require('fs');
const path = require('path');
const R = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

let passed = 0, failed = 0;
function ok(cond, msg) { if (cond) { passed += 1; console.log('  PASS', msg); } else { failed += 1; console.error('  FAIL', msg); } }

// ── 解析器强化 tm-promotion ──
const PROM = R('tm-promotion.js');
ok(/function _rankOfSeg\(seg, nameRank\)/.test(PROM), 'tm-promotion 有 _rankOfSeg(单段官衔→品级)');
ok(/function _rankFromTitleStr\(raw, nameRank\)/.test(PROM), 'tm-promotion 有 _rankFromTitleStr(复合串拆段取最高)');
ok(/'尚书': 3/.test(PROM) && /'侍郎': 5/.test(PROM) && /'大学士': 9/.test(PROM), 'SUPPLEMENTARY 补全核心京官(尚书/侍郎/大学士)');
ok(/keys\[i\]\.length > hitKw\.length/.test(PROM), '最长关键字匹配(右副都御史不被都御史截胡)');
ok(/Math\.min\(_rankFromTitleStr\(ch\.officialTitle, nameRank\), _rankFromTitleStr\(ch\.title, nameRank\)\)/.test(PROM), 'resolveRankLevel 合并 officialTitle∪title 取最高');

// ── 图志品级显示走权威 tm-renwu-tuzhi ──
const TUZHI = R('tm-renwu-tuzhi.js');
ok(/function _rankLabel\(c\)/.test(TUZHI), '_rankLabel 存在');
ok(/getCharacterRankLabel\(c,_g\(\)\)/.test(TUZHI), '_rankLabel 走官制可见品秩真源（不同于升迁资历数值）');
ok(/可见品秩走官制显示真源/.test(TUZHI), '_rankLabel 注释标明显示真源');

// ── 头衔真源吸收 title 段 tm-office-system ──
const OFF = R('tm-office-system.js');
ok(/var _OFF_TITLE_SUFFIX = /.test(OFF), 'office-system 有官职后缀正则 _OFF_TITLE_SUFFIX');
ok(/ch\.title && ch\.title !== ch\.officialTitle && !\/罢\|致仕/.test(OFF), '_offGetCharOfficeTitles 吸收 title 段(治兼职丢高职·已罢保护)');
ok(/_OFF_TITLE_SUFFIX\.test\(clean\)/.test(OFF), 'title 段官职后缀过滤(防吸收描述/状态垃圾)');
ok(/arr\.push\(ch\.officialTitle\)/.test(OFF), 'officialTitle 原项保留不拆(保状态)');

// ── AI prompt 完整官职 tm-endturn-prompt ──
const PROMPT = R('tm-endturn-prompt.js');
ok(/_offFormatCharTitles\(c, \{ fallback/.test(PROMPT), 'npc-hearts curTitle 走 _offFormatCharTitles(主⊕兼·治 AI 只认主职)');

console.log('\n[smoke-rank-display-sources] ' + (failed === 0 ? 'PASS' : 'FAIL') + ' — ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
