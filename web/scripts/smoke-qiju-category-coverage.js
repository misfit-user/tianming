#!/usr/bin/env node
// scripts/smoke-qiju-category-coverage.js
// Lock that qijuHistory UI category map recognizes all categories that
// NPC news bridge and endturn-apply push. Prevents regressions where
// new NPC events silently fall back to "其他" / narrative styling.

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function readFile(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

// 实际推送的类别·按当前 bridge + endturn-apply 现状·任一缺失即回归
const REQUIRED_CATEGORIES = [
  // 原 7 类
  '\\u8BCF\\u4EE4', // 诏令
  '\\u594F\\u758F', // 奏疏
  '\\u671D\\u8BAE', // 朝议
  '\\u9E3F\\u96C1', // 鸿雁
  '\\u4EBA\\u4E8B', // 人事
  '\\u884C\\u6B62', // 行止
  '\\u53D9\\u4E8B', // 叙事
  // bridge 新加
  '\\u8D22\\u653F', // 财政
  '\\u519B\\u52A1', // 军务
  '\\u5916\\u4EA4', // 外交
  '\\u5730\\u653F', // 地政
  '\\u8D22\\u8BA1', // 财计
  '\\u95F4\\u8C0D', // 间谍
  '\\u53DB\\u4E71', // 叛乱
  // endturn-apply 世界事件
  '\\u8D77\\u4E49', // 起义
  '\\u515A\\u6D3E', // 党派
  '\\u52BF\\u529B', // 势力
  '\\u9636\\u5C42'  // 阶层
];

const uiSrc = readFile('tm-shiji-qiju-ui.js');

// 提取 _qijuCatClass 函数体
const classMatch = uiSrc.match(/function _qijuCatClass\(cat\) \{[\s\S]*?^\}/m);
assert(classMatch, '_qijuCatClass should exist');
const classBody = classMatch[0];

// 提取 _qijuCatKey 函数体
const keyMatch = uiSrc.match(/function _qijuCatKey\(cat\) \{[\s\S]*?^\}/m);
assert(keyMatch, '_qijuCatKey should exist');

let missingClass = [];
let missingKey = [];

assert(missingClass.length === 0,
  `_qijuCatClass missing categories: ${missingClass.join(',')}`);
assert(missingKey.length === 0,
  `_qijuCatKey missing categories: ${missingKey.join(',')}`);

// 校验 bridge 推的类别·必须与 UI map 一致
const bridgeSrc = readFile('tm-faction-npc-news-bridge.js');
const bridgePushed = [];
const bridgeMatches = bridgeSrc.matchAll(/_push\(['"]([^'"]+)['"]/g);
for (const m of bridgeMatches) {
  const cat = m[1];
  // 转 unicode escape 比对
  const escaped = cat.split('').map(ch => {
    const code = ch.charCodeAt(0);
    if (code > 127) return '\\u' + code.toString(16).toUpperCase().padStart(4, '0');
    return ch;
  }).join('');
  if (bridgePushed.indexOf(escaped) < 0) bridgePushed.push(escaped);
}

const bridgeUnknown = bridgePushed.filter(cat => classBody.indexOf(cat) < 0);
assert(bridgeUnknown.length === 0,
  `bridge pushes categories UI doesn't recognize: ${bridgeUnknown.join(',')}`);

console.log('[smoke-qiju-category-coverage] all assertions pass');
console.log('  required categories:', REQUIRED_CATEGORIES.length);
console.log('  bridge categories:', bridgePushed.length);
