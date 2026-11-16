#!/usr/bin/env node
// scripts/smoke-death-office-travel-roster.js
// 2026-07-04·锁住两处「人物状态⇄AI叙事一致性」修复(玩家复报):
//   Slice 2 (tm-ai-apply-deaths.js)：结构化死亡须清 ch.officialTitle(此前只摘 officeTree holder 却留官衔
//     → 死者仍显"现任陕西巡抚")·殁前官衔存 positionAtDeath 供墓志铭/图志「原任X」。
//   Slice 3 (tm-endturn-prompt.js)：赴任在途·尚未到任者须进确定性硬名册(此前仅在 race-prone 的 AI 长期
//     摘要里·非硬约束 → AI 把还在路上的孙传庭叙事成"已在陕西赈灾")。
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) { passed++; console.log('  ✓ ' + msg); } else { failed++; console.error('  ✗ ' + msg); } }

// ───────────────────────────────────────────────────────────────────
// Slice 2: applyCharacterDeaths 清官衔 + 存 positionAtDeath
// ───────────────────────────────────────────────────────────────────
console.log('===== Slice 2·结构化死亡清官衔 =====');
(function(){
  const ctx = { console: { log(){}, warn(){}, info(){}, error(){} },
    Math, Date, JSON, Object, Array, Number, String, Boolean, RegExp,
    isFinite, isNaN, parseInt, parseFloat, setTimeout: () => 0, clearTimeout: () => {}, Error };
  ctx.window = ctx; ctx.global = ctx; ctx.globalThis = ctx;
  ctx.addEB = () => {};
  ctx._dbg = () => {};
  ctx.getTSText = () => 'T5';
  // officeTree 摘 holder 桩(真函数在 tm-office-system.js·此处只验官衔清理)
  ctx._offDismissPerson = function(p, name){ if (p && p.holder === name) p.holder = ''; if (Array.isArray(p && p.actualHolders)) p.actualHolders = p.actualHolders.filter(h => h && h.name !== name); };
  vm.createContext(ctx);
  ctx.GM = {
    turn: 5, officeTree: [{ name: '陕西', positions: [{ name: '巡抚', holder: '胡廷晏', actualHolders: [{ name: '胡廷晏' }] }] }],
    chars: [{ name: '胡廷晏', alive: true, officialTitle: '陕西巡抚', position: '巡抚', title: '陕西巡抚', officialTitles: ['陕西巡抚'], faction: '明朝廷' }],
    _turnReport: []
  };
  ctx.P = {};
  ctx.findCharByName = (n) => ctx.GM.chars.find(c => c.name === n);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-ai-apply-deaths.js'), 'utf8'), ctx, { filename: 'tm-ai-apply-deaths.js' });
  ctx.applyCharacterDeaths({ character_deaths: [{ name: '胡廷晏', reason: '遇害' }] });
  const hu = ctx.GM.chars[0];
  assert(hu.alive === false, '死者 alive=false');
  assert(hu.officialTitle == null || hu.officialTitle === '', '死者 officialTitle 已清(不再显"现任陕西巡抚")');
  assert(hu.title === '' && (!hu.officialTitles || hu.officialTitles.length === 0), '死者 title/officialTitles 已清');
  assert(hu.positionAtDeath === '陕西巡抚', '殁前官衔存 positionAtDeath(供墓志铭/图志「原任X」)');
  assert(hu._removedFromOfficeTurn === 5 && hu._removedReason === '身故', '记去职标记 _removedFromOfficeTurn/_removedReason');
  const pos = ctx.GM.officeTree[0].positions[0];
  assert(pos.holder === '', 'officeTree 座位 holder 已摘(职官表显示空缺)');
})();

// ───────────────────────────────────────────────────────────────────
// Slice 3a: 在途硬名册·逻辑副本(与 tm-endturn-prompt.js firewall 块同构)
// ───────────────────────────────────────────────────────────────────
console.log('===== Slice 3·赴任在途硬名册逻辑 =====');
(function(){
  const GM = { chars: [
    { name: '孙传庭', alive: true, officialTitle: '陕西巡抚', _travelFrom: '京师', _travelTo: '西安', _travelRemainingDays: 12, _travelAssignPost: '陕西/巡抚' },
    { name: '张三', alive: true, officialTitle: '兵部尚书' },                    // 已到任·不在途
    { name: '李四', alive: false, officialTitle: '侍郎', _travelTo: '南京' },     // 死者·须排除
    { name: '王五', alive: true, _travelTo: '辽东', _travelArrival: 8 }           // 旧回合制 ETA
  ]};
  const _enRoute = [];
  (GM.chars || []).forEach(function(c){
    if (!c || c.alive === false || !c.name || !c._travelTo) return;
    var _eta = '';
    if (typeof c._travelRemainingDays === 'number' && c._travelRemainingDays > 0) _eta = '·约剩' + c._travelRemainingDays + '日抵';
    else if (typeof c._travelArrival === 'number') _eta = '·预计T' + c._travelArrival + '抵';
    var _post = c._travelAssignPost ? '·将就任' + String(c._travelAssignPost).replace('/', ' ') : (c.officialTitle ? '·已授' + c.officialTitle : '');
    _enRoute.push('· ' + c.name + '：自' + (c._travelFrom || '原任所') + '赴' + c._travelTo + _post + _eta + '（在途·尚未到任）');
  });
  assert(_enRoute.length === 2, '在途名册含且仅含 2 名活着的在途者(孙传庭/王五·排除已到任张三与死者李四)');
  assert(_enRoute.some(l => l.indexOf('孙传庭') >= 0 && l.indexOf('西安') >= 0 && l.indexOf('尚未到任') >= 0), '孙传庭条含目的地+尚未到任');
  assert(_enRoute.some(l => l.indexOf('孙传庭') >= 0 && l.indexOf('约剩12日抵') >= 0), '孙传庭条含剩余天数 ETA');
  assert(_enRoute.some(l => l.indexOf('王五') >= 0 && l.indexOf('预计T8抵') >= 0), '王五条走旧回合制 ETA');
  assert(!_enRoute.some(l => l.indexOf('李四') >= 0), '死者李四不入在途名册');
})();

console.log('');
console.log(`[smoke-death-office-travel-roster] ${passed} passed / ${failed} failed`);
if (failed > 0) process.exit(1);
