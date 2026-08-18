#!/usr/bin/env node
'use strict';
// smoke-endgame-screen-unify — 终局UI合一（鼎革R1e·2026-07-07）
// 病灶(勘察D)：玩家之死走简版「天命已尽」屏(无太史公/指标/时间轴)·亡国走富屏「天命已绝」——两套分裂。
// 修：_playerDead 消费统一走 _showEndgameScreen 富屏(owner「玩家死或亡国都走太史公」)·
// 死因分类入标题(battle崩于军中/regicide遇弑/natural崩逝)·富屏缺位回落简版(沙箱兜底)。
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let N = 0;
function assert(c, m) { N++; if (!c) { console.error('ASSERT FAIL [' + N + ']:', m); process.exit(1); } }

const src = fs.readFileSync(path.join(ROOT, 'tm-endturn-core.js'), 'utf8');
const marker = 'if (GM._playerDead) {';
const mi = src.indexOf(marker);
assert(mi > 0, '① 消费块锚在位');
let j = mi + marker.length - 1, d = 0;
for (let k = j; k < src.length; k++) { const c = src[k]; if (c === '{') d++; else if (c === '}') { d--; if (d === 0) { j = k + 1; break; } } }
const blockSrc = 'async function consumePlayerDead() { ' + src.slice(mi, j) + ' }';

function mk(over) {
  const ctx = { console: { log() {}, warn() {}, error() {} }, Math, JSON, String, Number, Array, Object, parseInt, parseFloat, isFinite, isNaN };
  ctx.window = ctx; ctx.global = ctx; ctx.globalThis = ctx;
  ctx.setTimeout = (fn) => fn();   // 立即执行·免等
  ctx._rich = []; ctx._simple = [];
  if (!over || !over.noRich) ctx._showEndgameScreen = (mode, goal) => ctx._rich.push({ mode, goal });
  ctx.showTurnResult = (html) => ctx._simple.push(html);
  ctx.escHtml = (s) => String(s == null ? '' : s);
  ctx.getTSText = () => '天启十年';
  ctx._obsCtx = {};
  ctx._turnTxn = {};
  ctx._tmFinalizeEndTurnTransaction = async () => {};
  ctx.GM = Object.assign({ busy: true, running: true, turn: 40, _playerDead: true, _playerDeathReason: '御驾亲征，崩于军中', _playerDeathKind: 'battle' }, (over && over.GM) || {});
  ctx.P = { playerInfo: { characterName: '天子' } };
  vm.createContext(ctx);
  vm.runInContext(blockSrc, ctx, { filename: 'playerdead-slice.js' });
  void ctx.consumePlayerDead();
  return ctx;
}

// ── 富屏可用：统一走 _showEndgameScreen ──
var c1 = mk();
assert(c1._rich.length === 1 && c1._simple.length === 0, '② 玩家之死走富屏(不再简版)');
assert(c1._rich[0].mode === 'defeat', '③ defeat 分支(与亡国/败局同屏)');
assert(c1._rich[0].goal.title.indexOf('天命已尽') >= 0 && c1._rich[0].goal.title.indexOf('崩于军中') >= 0, '④ 标题带死因分类(battle→崩于军中)');
assert(c1._rich[0].goal.description.indexOf('御驾亲征') >= 0, '⑤ 死因原文入败因(太史公可读)');
assert(c1._rich[0].goal._dynastyEnd === true && c1._rich[0].goal._signal === 'player_death', '⑥ 终局对象契约(_dynastyEnd·太史公 _fgDetail 路可用)');
assert(!c1.GM._playerDead && !c1.GM._playerDeathReason && !c1.GM._playerDeathKind, '⑦ 信号消费即清(防重弹)');
assert(c1.GM.running === false && c1.GM.busy === false, '⑧ 局止(running=false)');

// ── 遇弑分类 ──
var c2 = mk({ GM: { _playerDeathKind: 'regicide', _playerDeathReason: '为权奸所弑' } });
assert(c2._rich[0].goal.title.indexOf('遇弑') >= 0, '⑨ regicide→遇弑标题');

// ── 分类缺省→崩逝 ──
var c3 = mk({ GM: { _playerDeathKind: '' } });
assert(c3._rich[0].goal.title.indexOf('崩逝') >= 0, '⑩ 无分类回落崩逝');

// ── 富屏缺位：回落简版(沙箱兜底不黑屏) ──
var c4 = mk({ noRich: true });
assert(c4._simple.length === 1 && c4._simple[0].indexOf('天命已尽') >= 0, '⑪ 富屏缺位回落简版');

// ── 静态契约 ──
assert(src.indexOf("_showEndgameScreen('defeat', _pdGoal)") >= 0, '⑫ 富屏接线在核(源契约)');

console.log('smoke-endgame-screen-unify OK — ' + N + ' 断言全绿（富屏合一/死因分类/信号清/缺位回落）');
