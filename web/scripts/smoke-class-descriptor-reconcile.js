#!/usr/bin/env node
/* eslint-env node */
// smoke-class-descriptor-reconcile.js — E·阶层描述符 schema + 现生对账（2026-06-16）实跑断言（真模块）
//   验：stratum 强制地板（含非法值纠正）+ 三开放栏确定性派生 + 主标 sticky（尊重 AI/种子给的含表外原词）+
//       待补账记 novel 标签 + 驱动规则（fiscalStatus=优免→tax 暴露≈0·负担挤编户）+ tick 懒对账 + 幂等 + 现生契约。
'use strict';

const path = require('path');
const WEB = path.join(__dirname, '..');
require(path.join(WEB, 'tm-field-pipelines.js'));
require(path.join(WEB, 'tm-engine-constants.js'));
require(path.join(WEB, 'tm-class-engine.js'));
const SF = require(path.join(WEB, 'tm-social-foundation.js'));

let A = 0, F = 0;
function ok(c, m) { if (c) { A++; console.log('  ✓ ' + m); } else { F++; console.log('  ✗ ' + m); } }
function r2(n) { return Math.round(Number(n) * 100) / 100; }

console.log('smoke-class-descriptor-reconcile — E 描述符 schema + 现生对账');

// 真剧本式阶层
const jinshen = { name: '缙绅', economicRole: '治理', influence: 74, status: '良民(绅)', privileges: '免徭役·包揽赋税·免科', economicIndicators: { taxBurden: 15 } };
const zigeng = { name: '自耕农', economicRole: '生产', influence: 25, status: '良民(民)', privileges: '编户齐民·科举资格', economicIndicators: { taxBurden: 82 } };
const junhu = { name: '军户', economicRole: '军事', influence: 30, status: '军籍', obligations: '军籍不能脱·无饷即逃' };
const shang = { name: '商人', economicRole: '商贸', influence: 55 };
const root = { _descriptorLedger: [] };

// 1. 确定性对账（缺栏全派生）
var dj = SF.reconcileClassDescriptor(jinshen, root);
ok(dj.stratum === '上' && dj.fiscalStatus === '优免' && dj.economicBase === '地租' && dj.unrestArchetype === '不合作', '缙绅→上/优免/地租/不合作 (got ' + dj.stratum + '/' + dj.fiscalStatus + '/' + dj.economicBase + '/' + dj.unrestArchetype + ')');
var dz = SF.reconcileClassDescriptor(zigeng, root);
ok(dz.stratum === '下' && dz.fiscalStatus === '编户' && dz.economicBase === '自耕' && dz.unrestArchetype === '暴烈', '自耕农→下/编户/自耕/暴烈 (got ' + dz.stratum + '/' + dz.fiscalStatus + '/' + dz.economicBase + '/' + dz.unrestArchetype + ')');
var dh = SF.reconcileClassDescriptor(junhu, root);
ok(dh.fiscalStatus === '受饷' && dh.economicBase === '俸饷' && dh.unrestArchetype === '哗变', '军户→受饷/俸饷/哗变 (got ' + dh.fiscalStatus + '/' + dh.economicBase + '/' + dh.unrestArchetype + ')');
var ds = SF.reconcileClassDescriptor(shang, root);
ok(ds.stratum === '中' && ds.economicBase === '工商' && ds.unrestArchetype === '撤离', '商人→中/工商/撤离 (got ' + ds.stratum + '/' + ds.economicBase + '/' + ds.unrestArchetype + ')');

// 2. 主标 sticky：AI/种子给的标签被尊重（只补缺）+ stratum 强制闭合（非法值纠正）
const seeded = { name: '盐枭', economicRole: '商贸', influence: 40, descriptor: { stratum: '乱来', fiscalStatus: '盐课专营' } };
var dse = SF.reconcileClassDescriptor(seeded, root);
ok(dse.fiscalStatus === '盐课专营', '主标 sticky·尊重表外原词 fiscalStatus=盐课专营 (got ' + dse.fiscalStatus + ')');
ok(dse.stratum !== '乱来' && SF.reconcileClassDescriptor && ['上', '中', '下'].indexOf(dse.stratum) >= 0, '★stratum 强制闭合·非法值「乱来」被纠正 (got ' + dse.stratum + ')');
ok(dse.economicBase && dse.unrestArchetype, '只补缺·其余栏派生补全');

// 3. 待补账：表外 novel 标签入 _descriptorLedger
ok(root._descriptorLedger.some(function (e) { return e.field === 'fiscalStatus' && e.tag === '盐课专营'; }), '待补账·novel 标签「盐课专营」入 _descriptorLedger');

// 4. 驱动规则：fiscalStatus=优免→tax 暴露≈0（负担挤编户）
const expJin = SF.classExposure(jinshen);
const expZi = SF.classExposure(zigeng);
ok(r2(expJin.tax) === 0.05, '优免缙绅·tax 暴露夹至 0.05 (got ' + expJin.tax + ')');
ok(expZi.tax >= 0.8, '编户自耕农·tax 暴露满载 (got ' + expZi.tax + ')');
ok(expZi.tax > expJin.tax * 10, '★负担挤编户：自耕农税暴露 ≫ 优免缙绅（' + expZi.tax + ' vs ' + expJin.tax + '）');
const expJun = SF.classExposure(junhu);
ok(expJun.arrears >= 1, '受饷军户·欠饷暴露拉满 (got ' + expJun.arrears + ')');

// 5. 驱动落到 baseline：加派下优免阶层几乎无感、编户重创
const bJin = SF.structuralBaseline(jinshen, { taxFactor: 1.5, minxin: 50 }).baseline;
const bZi = SF.structuralBaseline(zigeng, { taxFactor: 1.5, minxin: 50 }).baseline;
ok(bZi < bJin - 10, '★加派 1.5×·编户基线 ≪ 优免基线（负担挤编户涌现·' + bZi + ' vs ' + bJin + '）');

// 6. tick 懒对账：无描述符阶层经 tick 自动固化
const gm = { turn: 3, classes: [{ name: '工匠', economicRole: '手工', influence: 15, satisfaction: 40 }] };
SF.tick(gm, {});
ok(gm.classes[0].descriptor && gm.classes[0].descriptor._reconciled === true, 'tick 懒对账·工匠首遇即固化描述符');
ok(gm.classes[0].descriptor.economicBase === '工役' && gm.classes[0].descriptor.stratum === '下', 'tick 对账·工匠→工役/下');

// 7. 幂等：再对账不变
const before = JSON.stringify(jinshen.descriptor);
SF.reconcileClassDescriptor(jinshen, root);
ok(JSON.stringify(jinshen.descriptor) === before, '幂等·再对账描述符不变');

// 8. 现生契约：apply class_emerge 即对账
const applySrc = require('fs').readFileSync(path.join(WEB, 'tm-social-formation.js'), 'utf8');
ok(/reconcileClassDescriptor\(c,g\)/.test(applySrc), '源契约·现生阶层(class_emerge)即对账描述符');

console.log('\n[smoke-class-descriptor-reconcile] ' + (F ? 'FAIL' : 'PASS') + ' — ' + A + ' 通过 / ' + F + ' 失败');
process.exit(F ? 1 : 0);
