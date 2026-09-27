#!/usr/bin/env node
// smoke-endturn-narrative.js — Phase 7 P7-β baseline·10/21
// 锁 record 写回·shiluText / szjTitle / szjSummary / personnelChanges / hourenXishuo
// 拆分 P7-η record 时·5 字段写入路径必保

'use strict';

const fs = require('fs');
const path = require('path');
const { ROOT, readSource, makeAssert, findLines } = require('./smoke-endturn-baseline-helpers');

const passed = { value: 0 };
const assert = makeAssert(passed);

const src = readSource();

// ─── 5 record 字段·初始声明 (L29 around) ───
const recordVars = ['shiluText', 'szjTitle', 'szjSummary', 'personnelChanges', 'hourenXishuo'];
recordVars.forEach(function(v) {
  assert(src.indexOf('var ' + v + '=') >= 0 || src.indexOf('var ' + v + ' =') >= 0 ||
    src.match(new RegExp(',' + v + '\\s*=')) !== null,
    'record 字段初始·"' + v + '" 声明');
});

// ─── 5 字段写入 (sc1·sc2 后)·shiluText/szjTitle/szjSummary 走 p1·hourenXishuo 走 p2 (sc2 文事) ───
// [2026-05-08] _tmFirstText fallback 包装·允许直接赋值或 _tmFirstText() 形式
assert(src.indexOf('shiluText = p1.shilu_text') >= 0 || src.indexOf('_tmFirstText(p1.shilu_text') >= 0,
  'writeback·shiluText ← p1.shilu_text');
assert(src.indexOf('szjTitle = p1.szj_title') >= 0 || src.indexOf('_tmFirstText(p1.szj_title') >= 0,
  'writeback·szjTitle ← p1.szj_title');
assert(src.indexOf('szjSummary = p1.szj_summary') >= 0 || src.indexOf('p1.szj_summary') >= 0,
  'writeback·szjSummary ← p1.szj_summary');
assert(src.indexOf('hourenXishuo = p2.houren_xishuo') >= 0 ||
       src.indexOf('hourenXishuo = _tmPickHouren(p2, c2)') >= 0,
  'writeback·hourenXishuo ← p2.houren_xishuo or fallback picker (sc2 后)');
assert(src.indexOf('p2.houren_xishuo') >= 0 &&
       src.indexOf('p2.hourenXishuo') >= 0 &&
       src.indexOf('p2.zhengwen') >= 0,
  'writeback·hourenXishuo alias fallback fields');
assert(src.indexOf('_sc2Body.response_format') >= 0,
  'sc2·OpenAI json_object response_format');
assert(src.indexOf("id: 'sc1d'") >= 0 && src.indexOf('GM._turnAiResults.subcall1d') >= 0,
  'sc1d·实录/时政记专项调用并写回 subcall1d');
assert(src.indexOf('p1.shizheng') >= 0 &&
       src.indexOf('p1.szj') >= 0 &&
       src.indexOf('p1.zhengwen') >= 0,
  'writeback·shizhengji alias fallback fields');
// personnelChanges·sc1 推演结果·search broader
assert(src.indexOf('personnelChanges') >= 0 && src.indexOf('personnelChanges.push') >= 0 ||
       src.match(/personnelChanges\s*=/) !== null,
  'writeback·personnelChanges populated');

// ─── return shape·12 字段 (含 5 record 字段)·主入口 return obj 锚 ───
// 实际 return = { shizhengji, zhengwen, playerStatus, playerInner, turnSummary, timeRatio,
//                  suggestions, shiluText, szjTitle, szjSummary, personnelChanges, hourenXishuo }
const returnRe = /return\s*\{\s*shizhengji[\s\S]*?turnSummary[\s\S]*?shiluText[\s\S]*?szjTitle[\s\S]*?personnelChanges[\s\S]*?hourenXishuo[\s\S]*?\}/;
assert(returnRe.test(src),
  'return obj 12 字段·shizhengji ... shiluText/szjTitle/szjSummary/personnelChanges/hourenXishuo (record finalize 锚)');

// ─── szj 字数限制·_szjMin / _szjMax (时政记体例) ───
[
  '_szjMin',
  '_szjMax',
  '时政记正文'
].forEach(function(token) {
  assert((src + fs.readFileSync(path.join(ROOT, 'tm-endturn-record-specs.js'), 'utf8')).indexOf(token) >= 0, 'szj 体例·"' + token + '"');
});

// ─── 时政记 体例·朝政纪要 ───
//   体例 spec 已抽取到 tm-endturn-record-specs.js(recordSpecs.shizhengji 的"仿崇祯朝政纪要体"范例)·
//   readSource 的 ENDTURN_FAMILY 不含该文件·故此块单独读 record-specs 核体例。
const recordSpecsSrc = fs.readFileSync(path.join(ROOT, 'tm-endturn-record-specs.js'), 'utf8');
[
  '崇祯朝政纪要',  // 范例朝代(record-specs 的"仿崇祯朝政纪要体"风格范例)
  '【军事】',
  '【朝政】',
  '【经济】',
  '【外交】',
  '【民生】',
  '【宫廷】'
].forEach(function(tag) {
  assert(recordSpecsSrc.indexOf(tag) >= 0, 'szj 体例 tag·"' + tag + '"(record-specs)');
});

// ─── 实录 shilu (历史层)·与时政记体例同源 ───
[
  'shilu_text',
  'shiluText'
].forEach(function(token) {
  assert(src.indexOf(token) >= 0, 'shilu·"' + token + '"');
});

// ─── 后人戏说 hourenXishuo·叙事第三层 ───
assert(src.indexOf('hourenXishuo') >= 0, 'hourenXishuo·后人戏说');
assert(src.indexOf('houren_xishuo') >= 0 || src.indexOf('houren') >= 0,
  '后人戏说·schema field name (houren_*)');

console.log('[smoke-endturn-narrative] pass assertions=' + passed.value);
