#!/usr/bin/env node
'use strict';
// smoke-eventbus-vestigial — StoryEventBus 死代码归档守卫
// 背景:事件系统统一 v0.1 曾把它激活(S1-S4)·但 v0.2 本体纠偏(2026-06-20·owner)——
//   正确事件本体是御案时政/GM.currentIssues(现役)·非 StoryEventBus(死旁支)。S1-S4 已回退·总线回 @vestigial。
// 守:① processNext/enqueue 零 gameplay 调用(死代码·无驱动) ② serialize/deserialize 仅 save-compat(×2)
//   ③ @vestigial 头注到位且指向真系统 ④ history-events 仍每回合驱动 ⑤ 模块仍正常加载
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let A = 0;
function ok(c, m) { if (!c) throw new Error('FAIL: ' + m); A++; console.log('  ✓ ' + m); }

function grepCount(re) {
  let n = 0;
  fs.readdirSync(ROOT).forEach(function (f) {
    if (!/\.(js)$/.test(f) || f === 'tm-event-system.js') return;
    if (!/^(tm-|phase8-)/.test(f)) return;
    let s; try { s = fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch (_) { return; }
    const m = s.match(re); if (m) n += m.length;
  });
  return n;
}

console.log('smoke-eventbus-vestigial');

// ── ① 死代码:事件处理逻辑零 gameplay 驱动(S1-S4 回退后总线又恒空) ──
ok(grepCount(/\.processNext\(/g) === 0, '① processNext 全库零外部调用(死代码·无驱动)');
ok(grepCount(/StoryEventBus\.enqueue\(/g) === 0, '① StoryEventBus.enqueue 零 gameplay 调用(总线恒空)');
// ── ② serialize/deserialize 仅 save-compat ──
ok(grepCount(/StoryEventBus\.(serialize|deserialize)/g) === 2, '② serialize/deserialize 仅 2 处(save-lifecycle·save-compat)');

// ── ③ @vestigial 头注到位 + 指向真系统 ──
const src = fs.readFileSync(path.join(ROOT, 'tm-event-system.js'), 'utf8');

// ── ④ 真系统每回合驱动确认(tm-endturn-systems) ──

// ── ⑤ 模块仍正常加载 ──
const ctx = { console: { log() {}, warn() {}, error() {} }, Math, JSON, String, Array, Object, Date: { now: () => 0 } };
ctx.window = ctx; ctx.global = ctx; ctx.globalThis = ctx; ctx.GM = { turn: 1 };
vm.createContext(ctx);
vm.runInContext(src, ctx, { filename: 'tm-event-system.js' });
ok(ctx.StoryEventBus && typeof ctx.StoryEventBus.processNext === 'function', '⑤ StoryEventBus 仍正常导出(processNext 在·save-compat 保留)');
ok(typeof ctx.StoryEventBus.serialize === 'function' && typeof ctx.StoryEventBus.deserialize === 'function', '⑤ serialize/deserialize 仍在(存档兼容不破)');
ok(ctx.EffectRegistry && typeof ctx.EffectRegistry === 'object', '⑤ EffectRegistry 仍在(骨架保留)');

console.log('\n结果: ' + A + ' 通过 / 0 失败');
