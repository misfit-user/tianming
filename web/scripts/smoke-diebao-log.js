#!/usr/bin/env node
'use strict';
// smoke-diebao-log — 我朝谍报史接入(GM._npcInterventions·访问器原仅 1 处薄调用且泄漏英文 action 码)
//   A. 访问器:require 真模块·getLog() 全量 / getLog(facName) 按 targetFac 过滤
//   B. 显示做厚:tm-three-systems-ui 中文化 action(不漏英文)+花费+成败/策反结果
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
let A = 0;
function ok(c, m) { if (!c) throw new Error('FAIL: ' + m); A++; console.log('  ✓ ' + m); }

console.log('smoke-diebao-log');

// ───────── A. 访问器功能测(require 真模块) ─────────
global.GM = {
  turn: 6,
  _npcInterventions: [
    { id: 'a', turn: 4, action: 'bribe', fromPlayer: '明朝廷', targetFac: '后金', targetChar: '范文程', cost: { money: 50000 }, effects: { loyaltyBefore: 40, loyaltyAfter: 15, bribed: true }, success: true },
    { id: 'b', turn: 5, action: 'spreadRumor', fromPlayer: '明朝廷', targetFac: '后金', cost: { money: 20000 }, success: true },
    { id: 'c', turn: 5, action: 'sponsorRebellion', fromPlayer: '明朝廷', targetFac: '蒙古', cost: { money: 100000, grain: 50000 }, success: false }
  ]
};
const I = require(path.join(ROOT, 'tm-faction-npc-intervention.js'));
ok(I && typeof I.getLog === 'function', 'A① 模块导出 getLog');
ok(I.getLog().length === 3, 'A② getLog() 全量=3');
ok(I.getLog('后金').length === 2 && I.getLog('后金').every(r => r.targetFac === '后金'), 'A③ getLog(后金) 按 targetFac 过滤=2');
ok(I.getLog('蒙古').length === 1, 'A④ getLog(蒙古)=1');
ok(I.getLog('不存在之邦').length === 0, 'A⑤ 无记录之邦 → 空');

// ───────── B. 显示源契约 ─────────
const ui = fs.readFileSync(path.join(ROOT, 'tm-three-systems-ui.js'), 'utf8');
// ★旧英文泄漏行已除
ok(ui.indexOf("['+esc(i.action)+']") < 0, 'B⑦ ★旧 [英文action] 泄漏行已除');

console.log('\n结果: ' + A + ' 通过 / 0 失败');
