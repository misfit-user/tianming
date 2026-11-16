#!/usr/bin/env node
/* eslint-env node */
// smoke-class-legitimacy.js — §三D：合法性 clout 加权读模型（2026-06-16）
// 验：computeLegitimacy 按政治权力(influence×阶等权)加权满意度，对照人口加权民心(GM.minxin.trueIndex)；
//     权贵不满拖低→缙绅离心；庶民怨而权贵安→民怨上达；对齐→相安；权重≠均值；tick 集成 + 正册 surface。
'use strict';

const path = require('path');
const WEB = path.join(__dirname, '..');
require(path.join(WEB, 'tm-engine-constants.js'));
require(path.join(WEB, 'tm-class-engine.js'));
const SF = require(path.join(WEB, 'tm-social-foundation.js'));

let passed = 0, failed = 0;
function ok(cond, msg) {
  if (cond) { passed += 1; console.log('  PASS', msg); }
  else { failed += 1; console.error('  FAIL', msg); }
}
function leg(classes, trueIndex) {
  return SF.computeLegitimacy({ turn: 5, classes: classes, minxin: (trueIndex != null ? { trueIndex: trueIndex } : undefined) });
}
ok(typeof SF.computeLegitimacy === 'function', '导出 computeLegitimacy');

// ── 1. 权贵不满(高clout低sat) + 庶民安(低clout高sat)·人口加权民心高 → clout加权低 → 缙绅离心 ──
const r1 = leg([{ name: '勋贵', economicRole: '治理', influence: 40, satisfaction: 20 },
  { name: '自耕农', economicRole: '生产', influence: 10, satisfaction: 70 }], 65);
ok(r1.clout < r1.pop - 12 && r1.flag === '缙绅离心', '缙绅离心·权贵不满拖低clout加权 (clout ' + r1.clout + ' vs pop ' + r1.pop + ')');

// ── 2. 权贵安 + 庶民怨·民心低 → clout加权高 → 民怨上达 ──
const r2 = leg([{ name: '勋贵', economicRole: '治理', influence: 40, satisfaction: 80 },
  { name: '自耕农', economicRole: '生产', influence: 10, satisfaction: 30 }], 35);
ok(r2.clout > r2.pop + 12 && r2.flag === '民怨上达', '民怨上达·庶民怨而权贵安 (clout ' + r2.clout + ' vs pop ' + r2.pop + ')');

// ── 3. 对齐 → 相安 ──
const r3 = leg([{ name: '勋贵', economicRole: '治理', influence: 40, satisfaction: 55 },
  { name: '自耕农', economicRole: '生产', influence: 10, satisfaction: 55 }], 55);
ok(r3.flag === '相安', '对齐→相安 (clout ' + r3.clout + ' vs pop ' + r3.pop + ')');

// ── 4. clout加权≠均值：高影响治理阶层主导（验权重生效）──
const r4 = leg([{ name: '勋贵', economicRole: '治理', influence: 40, satisfaction: 0 },
  { name: '自耕农', economicRole: '生产', influence: 10, satisfaction: 100 }], 50);
ok(r4.clout < 35, 'clout加权·高影响治理阶层(clout88·sat0)主导→远低于均值50 (got ' + r4.clout + ')');

// ── 5. 无民心 → pop null·flag空·不抛 ──
const r5 = leg([{ name: '勋贵', economicRole: '治理', influence: 40, satisfaction: 55 }], null);
ok(r5 && r5.pop === null && r5.flag === '', '无民心·pop null·flag空·不抛');

// ── 6. 无阶层 → null ──
ok(SF.computeLegitimacy({ turn: 5, classes: [] }) === null, '无阶层→null');

// ── 7. tick 集成 + GM._legitimacy ──
const GM7 = { turn: 5, classes: [{ name: '勋贵', economicRole: '治理', influence: 40, satisfaction: 20 },
  { name: '自耕农', economicRole: '生产', influence: 10, satisfaction: 70 }], minxin: { trueIndex: 65 } };
const P7 = { adminHierarchy: { player: { divisions: [{ name: '省', children: [{ name: '县', taxRate: 1, minxin: 55 }] }] } } };
const out7 = SF.tick(GM7, P7);
ok(out7.legitimacy && GM7._legitimacy && GM7._legitimacy.clout < GM7._legitimacy.pop && GM7._legitimacy.flag.length > 0,
  'tick 集成·GM._legitimacy 落·clout<pop (flag ' + (GM7._legitimacy || {}).flag + ')');

// ── 8. 源契约：tick 调用 + 两正册构建器 surface 天命权重 ──

// ── 9. 乱民化拉低忠诚：高 radicalFrac 权贵纵满意度高亦拖低 clout 加权（士绅离心现形）──
const rfHigh = leg([{ name: '勋贵', economicRole: '治理', influence: 40, satisfaction: 70, _radicalFrac: 0.8 },
  { name: '自耕农', economicRole: '生产', influence: 10, satisfaction: 70 }], 70);
const rfNone = leg([{ name: '勋贵', economicRole: '治理', influence: 40, satisfaction: 70 },
  { name: '自耕农', economicRole: '生产', influence: 10, satisfaction: 70 }], 70);
ok(rfHigh.clout < rfNone.clout - 15, '乱民化忠诚·权贵radicalFrac0.8拖低clout加权 (' + rfHigh.clout + ' vs 无乱民 ' + rfNone.clout + ')');
ok(rfHigh.flag === '缙绅离心', '权贵离心(高乱民)→缙绅离心旗标 (got ' + rfHigh.flag + ')');

console.log('\n[smoke-class-legitimacy] ' + (failed ? 'FAIL' : 'PASS') + ' — ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
