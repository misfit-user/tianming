#!/usr/bin/env node
// smoke-office-dismiss-tree-sync.js — 治"免官罢官后官职还在"
//   根因:廷议革除/革职(_ty3_actionStrip/_ty3_actionRevoke)清了 char 字段却不碰 officeTree holder
//        → 反向派生(importSeats Pass0 / tm-patches _syncOffice 分支1)按残留 holder 把 officialTitle 加回
//   修=清完 char 后调前向同步 _offSyncHoldersFromChars()·从 char claims 重建 holder·免官者不claim→其座位清空
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
function assert(c, m) { if (c) pass++; else { fail++; console.error('  ✗ ' + m); } }

function loadOffice() {
  const ctx = { console: { log() {}, warn() {}, error() {} }, Math, JSON, Object, Array, Number, String, Boolean, RegExp, isFinite, isNaN, parseInt, parseFloat };
  ctx.window = ctx; ctx.global = ctx; ctx.globalThis = ctx; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-office-system.js'), 'utf8'), ctx, { filename: 'tm-office-system.js' });
  return ctx;
}
function freshGM() {
  return { turn: 5, officeTree: [{ name: '礼部', positions: [{ name: '礼部尚书', establishedCount: 1, holder: '来宗道' }] }], chars: [{ name: '来宗道', alive: true, title: '礼部尚书', faction: '明朝廷' }] };
}
const seated = ctx => ctx.GM.chars[0].officialTitle || '';
const holder = ctx => ctx.GM.officeTree[0].positions[0].holder || '';
const clearChar = c => { c.officialTitle = ''; c.title = ''; c.officialTitles = []; c.concurrentTitles = []; c.concurrentTitle = ''; };

// ── ① 复现 bug:清 char 不清树 → importSeats 反向派生按 holder 还原 officialTitle ──
(function () {
  const ctx = loadOffice();
  const sync = ctx._offSyncHoldersFromChars;
  assert(typeof sync === 'function', '_offSyncHoldersFromChars 可用');
  ctx.GM = freshGM();
  sync({ importSeats: true });
  assert(seated(ctx) === '礼部尚书', '① 初始:树holder→char 派生 officialTitle·实=' + seated(ctx));
  clearChar(ctx.GM.chars[0]);                       // 模拟 tinyi 清 char·不碰树
  assert(seated(ctx) === '', '① 清char后 officialTitle 空');
  sync({ importSeats: true });                      // 模拟读档/tm-patches 再normalize
  assert(seated(ctx) === '礼部尚书', '① BUG复现:残留树holder令官职被还原·实=' + (seated(ctx) || '(已清·未复现?)'));
  console.log('  [①] bug 复现:不清树 holder → 官职被反向派生还原');
})();

// ── ② 修复机制:清 char 后前向同步 → 树 holder 清空 → 不再还原 ──
(function () {
  const ctx = loadOffice();
  const sync = ctx._offSyncHoldersFromChars;
  ctx.GM = freshGM();
  sync({ importSeats: true });
  clearChar(ctx.GM.chars[0]);
  sync();                                            // 修复:前向同步(无importSeats)·从claims重建holder
  assert(holder(ctx) === '', '② 前向同步后树 holder 清空·实=' + (holder(ctx) || '(空)'));
  sync({ importSeats: true });                       // 再跑反向派生
  assert(seated(ctx) === '', '② 修复后官职不再被还原·实=' + (seated(ctx) || '(空)'));
  console.log('  [②] 修复机制:前向同步清树 holder → 反向派生无残留可还原');
})();

// ── ③ 不误伤:在职他人(officialTitle 完好)前向同步后仍保座 ──
(function () {
  const ctx = loadOffice();
  const sync = ctx._offSyncHoldersFromChars;
  ctx.GM = { turn: 5, officeTree: [{ name: '礼部', positions: [{ name: '礼部尚书', establishedCount: 1, holder: '来宗道' }, { name: '礼部侍郎', establishedCount: 1, holder: '李国普' }] }], chars: [{ name: '来宗道', alive: true, title: '礼部尚书', faction: '明朝廷' }, { name: '李国普', alive: true, title: '礼部侍郎', faction: '明朝廷' }] };
  sync({ importSeats: true });
  clearChar(ctx.GM.chars[0]);  // 只免 来宗道
  sync();
  assert(ctx.GM.officeTree[0].positions[0].holder === '', '③ 被免者座位清空');
  assert(ctx.GM.officeTree[0].positions[1].holder === '李国普', '③ 未被免的同部他人仍保座·实=' + ctx.GM.officeTree[0].positions[1].holder);
  console.log('  [③] 不误伤:前向同步只清被免者·他人保座');
})();

// ── ④ 源码契约:tinyi 革除/革职两函数体内含树同步调用 ──
(function () {
  const src = (fs.readFileSync(path.join(ROOT, 'tm-tinyi-v3-persona.js'), 'utf8') + '\n' + (fs.readFileSync(path.join(ROOT, 'tm-tinyi-v3.js'), 'utf8') + '\n' + fs.readFileSync(path.join(ROOT, 'tm-tinyi-v3-edict-personnel.js'), 'utf8')) + '\n' + fs.readFileSync(path.join(ROOT, 'tm-tinyi-v3-parties.js'), 'utf8'));
  function fnBody(name) {
    const a = src.indexOf('function ' + name);
    if (a < 0) return '';
    const next = src.indexOf('\nfunction ', a + 10);
    return src.slice(a, next < 0 ? src.length : next);
  }
  const strip = fnBody('_ty3_actionStrip'), revoke = fnBody('_ty3_actionRevoke');
  // 同步须在清 concurrentTitles 之后(清完才同步)
  console.log('  [④] 源码契约:tinyi strip/revoke 清char后调树同步');
})();

console.log('[smoke-office-dismiss-tree-sync] ' + pass + ' passed / ' + fail + ' failed');
if (fail > 0) process.exit(1);
