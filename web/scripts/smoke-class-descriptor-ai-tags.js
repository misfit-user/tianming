#!/usr/bin/env node
/* eslint-env node */
// smoke-class-descriptor-ai-tags.js — ⑤·E 主标：AI 现生时提供 descriptor 标签（2026-06-16）
//   验：apply class_emerge 透传 ce.descriptor→newC.descriptor→reconciler 尊重主标(含表外原词)+补缺；
//       无 descriptor 则确定性派生；prompt 模板/schema/apply 三处接通。
'use strict';

const fs = require('fs'), path = require('path');
const WEB = path.join(__dirname, '..');
require(path.join(WEB, 'tm-field-pipelines.js'));
require(path.join(WEB, 'tm-engine-constants.js'));
require(path.join(WEB, 'tm-class-engine.js'));
const SF = require(path.join(WEB, 'tm-social-foundation.js'));

let A = 0, F = 0;
function ok(c, m) { if (c) { A++; console.log('  ✓ ' + m); } else { F++; console.log('  ✗ ' + m); } }

console.log('smoke-class-descriptor-ai-tags — ⑤ E 主标(AI 现生提供描述符)');

// 镜像 apply class_emerge 的 newC.descriptor 透传 + reconcile
function emerge(ce, root) {
  var newC = {
    name: ce.name, economicRole: ce.economicRole || '其他', status: ce.status || '良民',
    privileges: ce.privileges || '', influence: parseInt(ce.influence, 10) || 15,
    descriptor: (ce.descriptor && typeof ce.descriptor === 'object') ? ce.descriptor : undefined
  };
  SF.reconcileClassDescriptor(newC, root);
  return newC;
}

// 1. AI 主标被尊重（含表外原词）+ 缺栏补全
const root1 = { _descriptorLedger: [] };
const c1 = emerge({ name: '盐枭', economicRole: '商贸', influence: 40, descriptor: { stratum: '中', fiscalStatus: '盐课专营' } }, root1);
ok(c1.descriptor.fiscalStatus === '盐课专营', '★AI 主标尊重·表外原词 fiscalStatus=盐课专营 (got ' + c1.descriptor.fiscalStatus + ')');
ok(c1.descriptor.stratum === '中', 'AI 主标尊重·stratum=中');
ok(c1.descriptor.economicBase && c1.descriptor.unrestArchetype, '缺栏(economicBase/unrestArchetype)确定性补全');
ok(root1._descriptorLedger.some(function (e) { return e.tag === '盐课专营'; }), '表外主标入待补账');

// 2. 无 descriptor → 全确定性派生（现生零代码插入·既有行为）
const root2 = { _descriptorLedger: [] };
const c2 = emerge({ name: '教民', economicRole: '其他', status: '良民', influence: 20 }, root2);
ok(c2.descriptor && c2.descriptor.stratum && c2.descriptor.fiscalStatus && c2.descriptor.unrestArchetype, '无主标→确定性补全 stratum/fiscalStatus/unrestArchetype');

// 3. 非法 stratum 主标被纠正（强制闭合地板）
const c3 = emerge({ name: '某新阶层', economicRole: '生产', influence: 22, descriptor: { stratum: '乱填' } }, { _descriptorLedger: [] });
ok(['上', '中', '下'].indexOf(c3.descriptor.stratum) >= 0, 'AI 非法 stratum「乱填」被纠正 (got ' + c3.descriptor.stratum + ')');

// 4. 三处源契约
const applySrc = fs.readFileSync(path.join(WEB, 'tm-social-formation.js'), 'utf8');
const schemaSrc = fs.readFileSync(path.join(WEB, 'tm-ai-schema.js'), 'utf8');
const aiSrc = fs.readFileSync(path.join(WEB, 'tm-endturn-ai.js'), 'utf8');
ok(/raw\.descriptor&&typeof raw\.descriptor==='object'\)c\.descriptor=JSON\.parse\(JSON\.stringify\(raw\.descriptor\)\)/.test(applySrc), '源契约·apply class_emerge 透传 ce.descriptor→newC');
ok(/class_emerge.*descriptor/.test(schemaSrc), '源契约·schema class_emerge desc 含 descriptor');
ok(/class_emerge.*\\"descriptor\\":\{/.test(aiSrc), '源契约·prompt 模板含 descriptor 示例(内联词表)');

console.log('\n[smoke-class-descriptor-ai-tags] ' + (F ? 'FAIL' : 'PASS') + ' — ' + A + ' 通过 / ' + F + ' 失败');
process.exit(F ? 1 : 0);
