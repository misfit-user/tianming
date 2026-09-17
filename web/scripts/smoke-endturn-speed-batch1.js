#!/usr/bin/env node
// smoke-endturn-speed-batch1.js — 过回合提速批一（玩家群 2026-07-21「一回合四五十分钟」立案）防腐线：
// ① 全局 AI 队列自适应并发默认开（健康时 3→8·失败/429 冷却自动回落 base·显式 0 可关）
// ② 机械/格式化子调用（实录/丰化/快照/审查/记忆落写/收编/压缩）配了次要快模型即分流·
//    未配零变化·高判断调用（sc0/sc1/sc2_prose/sc15）绝不分流
// ③ 奏疏生成（模板化文体）同律分流

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
let A = 0, F = 0;
function assert(cond, msg) {
  if (cond) { A++; console.log('  PASS ' + msg); }
  else { F++; console.log('  FAIL ' + msg); }
}

console.log('smoke-endturn-speed-batch1');

const infra = (fs.readFileSync(path.join(ROOT, 'tm-ai-infra-retry.js'), 'utf8') + '\n' + fs.readFileSync(path.join(ROOT, 'tm-ai-infra.js'), 'utf8'));
const et = fs.readFileSync(path.join(ROOT, 'tm-endturn-ai.js'), 'utf8');
const mem = fs.readFileSync(path.join(ROOT, 'tm-memorials.js'), 'utf8');

// ① 自适应并发默认开
const adFn = infra.slice(infra.indexOf('function _adaptiveMaxConcurrent'), infra.indexOf('function getConf'));
assert(/isNaN\(raw\)/.test(adFn) && /raw = 8/.test(adFn), '自适应并发未配时默认 8（健康时 3→8）');
assert(/cooldownUntil/.test(adFn) && /_recentFailureRate\(\) > 0\.15/.test(adFn) && /return base/.test(adFn),
  '失败率/冷却回落护栏原样在（升并发不越过健康闸）');
assert(/Math\.min\(raw, 8\)/.test(adFn), '并发上限封顶 8 不放飞');

// ② 子调用分流表
const iSec = et.indexOf('_SEC_SUBCALLS');
assert(iSec >= 0, '_callEndturnAI 挂了次要分流表 _SEC_SUBCALLS');
const secBlock = et.slice(iSec, iSec + 900);
['sc1d', 'sc19', 'sc28', 'sc27_review', 'sc27', 'sc_memwrite', 'sc_consolidate'].forEach(id =>
  assert(new RegExp(id + ':\\s*1').test(secBlock), '分流表含机械调用 ' + id));
['sc0', 'sc1:', 'sc2_prose', 'sc15:'].forEach(id =>
  assert(secBlock.indexOf(id) < 0, '高判断调用不入分流表（' + id.replace(':', '') + '）'));
assert(/_useSecondaryTier\(\)/.test(secBlock), '分流以 _useSecondaryTier 守门（未配次要API=零变化）');
assert(/body\.model = _secCfg\.model/.test(secBlock), '分流时请求体 model 同步换成次要模型');
assert(/!opts\.url/.test(secBlock), '调用方显式指定 url 时不抢道（保留覆盖权）');

// ③ 奏疏分流
assert(/callAISmart\(prompt, _dynamicMaxTok, \{[\s\S]{0,200}tier: \(typeof _useSecondaryTier/.test(mem),
  '奏疏 genMemorialsAI 配了次要API即走快模型');

console.log('smoke-endturn-speed-batch1 ' + (F === 0 ? 'PASS' : 'FAIL') + ' ' + A + '/' + (A + F));
process.exit(F === 0 ? 0 : 1);
