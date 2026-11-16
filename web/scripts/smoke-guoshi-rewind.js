#!/usr/bin/env node
/* eslint-env node */
'use strict';
// smoke-guoshi-rewind — 国师「改了重发」（2026-10-15 国师重做 S3）：
//   每句话发出时记下当时的对话与没应用草稿的差异；改了重发 = 对话回到那句之前、草稿回到那时、
//   那之后应用过的改动按改动账连带撤销（可关）、流里删掉那句及之后再按原来的方式重跑。
//   另用核心函数验证「只存差异也能把草稿复原」这一做法本身。
const fs = require('fs'), path = require('path');
const AA = require(path.join(__dirname, '..', 'editor-authoring-agent.js'));
let P = 0, F = 0;
function ok(c, m) { if (c) { P++; console.log('  ✓ ' + m); } else { F++; console.log('  ✗ FAIL: ' + m); } }
console.log('smoke-guoshi-rewind');

// 做法本身：草稿 = 开工剧本 + 差异；差异落回当前剧本即复原（当前剧本在那几处没变时）
const base = { name: '甲', characters: [{ name: '袁崇焕', title: '巡抚' }] };
const draft = AA.makeDraft(base); draft.characters[0].title = '督师'; draft.characters.push({ name: '文震孟' });
const dd = AA.computeDiff(base, draft);
const restored = AA.applySelectedDiffs(base, null, dd);
ok(JSON.stringify(restored) === JSON.stringify(draft), '只存差异：落回开工剧本即得原草稿');
const live = JSON.parse(JSON.stringify(base)); live.name = '甲·手改';
const restored2 = AA.applySelectedDiffs(live, null, dd);
ok(restored2.name === '甲·手改' && restored2.characters[0].title === '督师' && restored2.characters.length === 2, '别处手改过也能落回（只动那几处）');

console.log('\nsmoke-guoshi-rewind ' + (F === 0 ? 'PASS' : 'FAIL') + ' ' + P + '/' + (P + F));
process.exit(F === 0 ? 0 : 1);
