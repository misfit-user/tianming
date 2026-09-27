#!/usr/bin/env node
/* eslint-env node */
// smoke-class-descriptor-adjudicate.js — ⑤·E 现生管线「硬骨头升 secondary-LLM 裁」（2026-06-16·b 续）
//   纯逻辑可测：reconcile 对表外 novel 标签置 _needsAdjudication；applyAdjudicatedDescriptor 采用 LLM 归一的通用词表
//   (表外原词存 _raw_*·非法不采用保兜底·_adjudicated 止重裁)。AI 调用本身 fire-and-forget→只验源契约。
'use strict';

const fs = require('fs'), path = require('path');
const WEB = path.join(__dirname, '..');
require(path.join(WEB, 'tm-field-pipelines.js'));
require(path.join(WEB, 'tm-engine-constants.js'));
require(path.join(WEB, 'tm-class-engine.js'));
const SF = require(path.join(WEB, 'tm-social-foundation.js'));

let A = 0, F = 0;
function ok(c, m) { if (c) { A++; console.log('  ✓ ' + m); } else { F++; console.log('  ✗ ' + m); } }

console.log('smoke-class-descriptor-adjudicate — ⑤ secondary-LLM 裁（硬骨头归一）');

// 1. 表外 novel 标签 → reconcile 置 _needsAdjudication
const root = { _descriptorLedger: [] };
const hard = { name: '盐枭', economicRole: '商贸', influence: 40, descriptor: { stratum: '中', fiscalStatus: '盐课专营' } };
SF.reconcileClassDescriptor(hard, root);
ok(hard.descriptor._needsAdjudication === true, '表外 novel 标签(盐课专营)→_needsAdjudication 置位(待裁)');

// 2. 全通用词表 → 不置 _needsAdjudication
const easy = { name: '自耕农', economicRole: '生产', influence: 25 };
SF.reconcileClassDescriptor(easy, { _descriptorLedger: [] });
ok(!easy.descriptor._needsAdjudication, '全确定性派生(通用词表)→不待裁');

// 3. applyAdjudicatedDescriptor：采用 LLM 归一的通用词表·表外原词留 _raw_*
const applied = SF.applyAdjudicatedDescriptor(hard, { stratum: '中', fiscalStatus: '法外', unrestArchetype: '撤离' });
ok(applied === true, '裁定有效→applied true');
ok(hard.descriptor.fiscalStatus === '法外', '★novel「盐课专营」归一为通用「法外」(drive 规则可用)');
ok(hard.descriptor._raw_fiscalStatus === '盐课专营', '表外原词留 _raw_fiscalStatus(开放词表「留原词」)');
ok(hard.descriptor.unrestArchetype === '撤离', 'unrestArchetype 归一为撤离');
ok(hard.descriptor._adjudicated === true && hard.descriptor._needsAdjudication === false, '_adjudicated 置位·_needsAdjudication 清除');

// 4. 非法裁定 → 不采用（保确定性兜底）
const hard2 = { name: '某教门', economicRole: '其他', influence: 30, descriptor: { fiscalStatus: '什一奉献' } };
SF.reconcileClassDescriptor(hard2, { _descriptorLedger: [] });
const fsBefore = hard2.descriptor.fiscalStatus;
const applied2 = SF.applyAdjudicatedDescriptor(hard2, { stratum: '瞎填', fiscalStatus: '胡诌', unrestArchetype: '乱来' });
ok(applied2 === false, '裁定全非法→applied false');
ok(hard2.descriptor.fiscalStatus === fsBefore, '非法裁定→保原值(确定性兜底不被破坏)');

// 5. 已裁过 → 再 reconcile 不重置 _needsAdjudication（_adjudicated 守卫）
hard.descriptor.fiscalStatus = '盐课专营';  // 模拟原词仍在(若回退)
SF.reconcileClassDescriptor(hard, root);
ok(!hard.descriptor._needsAdjudication, '★已裁过→再 reconcile 不重裁(_adjudicated 守卫·防反复调 AI)');

// 6. 源契约：apply 层 secondary AI 调用接通
const applySrc = fs.readFileSync(path.join(WEB, 'tm-social-formation.js'), 'utf8');
ok(fs.readFileSync(path.join(WEB,'tm-endturn-apply.js'),'utf8').includes('TM.SocialFormation.apply(GM, p1'),'主回合接入统一创建器');
ok(/_needsAdjudication.*typeof root\.callAI/.test(applySrc), '源契约·apply class_emerge 对硬骨头触发 secondary AI');
ok(/'secondary',\{priority:'low'/.test(applySrc) && /applyAdjudicatedDescriptor\(c,verdict\)/.test(applySrc), '源契约·走 secondary 低优先 callAI + applyAdjudicatedDescriptor 落地');
ok(/applyAdjudicatedDescriptor:/.test(fs.readFileSync(path.join(WEB, 'tm-social-foundation.js'), 'utf8')), '源契约·foundation 导出 applyAdjudicatedDescriptor');

console.log('\n[smoke-class-descriptor-adjudicate] ' + (F ? 'FAIL' : 'PASS') + ' — ' + A + ' 通过 / ' + F + ' 失败');
process.exit(F ? 1 : 0);
