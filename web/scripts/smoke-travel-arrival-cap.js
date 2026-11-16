#!/usr/bin/env node
// smoke-travel-arrival-cap.js
// 验证「玩家任命后人物好几回合无法赴任」已治·且**按天计·不破坏精细时间刻度剧本(1回合=1天)**。
//   ① 正常 20 日·daysPerTurn=30 → 1 回合抵达就任(硬闸不抢)
//   ② ★1回合=1天剧本:20 日旅程**老实走 20 回合**正常抵达·绝不被硬闸提前压成 3 回合(回归点)
//   ③ 卡死(剩余天数每回合被重置·精细刻度永不递减到 0)→ 按「天」兜底(应耗×2/≥40天)强制抵达
//   ④ 抵达后所有 _travel* 字段(含 _travelElapsedDays/_travelExpectedDays)清干净
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const WEB = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } }

function mkCtx() {
  const sb = {};
  sb.window = sb; sb.global = sb; sb.globalThis = sb;
  sb.console = { log() {}, warn() {}, error() {} };
  sb.GM = { turn: 5, chars: [], officeTree: [] };
  sb.getTSText = function (t) { return 'T' + t; };
  sb.addEB = function () {}; sb.toast = function () {};
  sb.buildIndices = function () {}; sb.renderGameState = function () {};
  vm.createContext(sb);
  ['tm-ai-change-pathutils.js', 'tm-ai-change-army.js', 'tm-ai-change-narrative.js'].forEach(function (file) {
    vm.runInContext(fs.readFileSync(path.join(WEB, file), 'utf8'), sb, { filename: file });
  });
  vm.runInContext(fs.readFileSync(path.join(WEB, 'generated/tm-ai-change-applier.bundle.js'), 'utf8'), sb, { filename: 'generated/tm-ai-change-applier.bundle.js' });
  return sb;
}

console.log('smoke-travel-arrival-cap');

// ── ① 正常:20日·daysPerTurn=30 → 1 回合抵达 ──
let sb = mkCtx();
let ch = { name: '甲', location: '南京', _travelTo: '京师', _travelFrom: '南京', _travelStartTurn: 4, _travelRemainingDays: 20, _travelArrival: 6, _travelAssignPost: '内阁/大学士' };
sb.GM.chars = [ch];
let r = sb.advanceCharTravelByDays(30);
ok(r.arrived === 1 && !ch._travelTo, '① 正常 20 日·daysPerTurn=30 → 1 回合抵达');
ok(ch.location === '京师', '① 抵达后 location 落到 京师');

// ── ② ★1回合=1天:20 日旅程老实走 20 回合·绝不被硬闸提前(回归点) ──
sb = mkCtx();
ch = { name: '乙', location: '南京', _travelTo: '京师', _travelFrom: '南京', _travelStartTurn: 4, _travelRemainingDays: 20, _travelAssignPost: '内阁/大学士' };
sb.GM.chars = [ch];
let arrTurn = 0;
for (let t = 1; t <= 30; t++) {
  sb.GM.turn = 4 + t;
  const rr = sb.advanceCharTravelByDays(1); // daysPerTurn=1
  if (rr.arrived) { arrTurn = t; break; }
}
ok(arrTurn === 20, '② 1回合=1天·20日旅程在第 ' + arrTurn + ' 回合正常抵达(按天·非旧3回合硬闸误伤)');
// 显式回归:第 3 回合时仍在途(证明不再瞬移)
sb = mkCtx();
ch = { name: '乙2', location: '南京', _travelTo: '京师', _travelRemainingDays: 20, _travelAssignPost: '内阁/大学士' };
sb.GM.chars = [ch];
for (let t = 1; t <= 3; t++) { sb.GM.turn = 4 + t; sb.advanceCharTravelByDays(1); }
ok(!!ch._travelTo && ch._travelRemainingDays === 17, '② 第 3 回合(1天/回合)仍在途·剩余 17 日·绝不提前到任');

// ── ③ 卡死:剩余天数每回合被重置(精细刻度·daysPassed<重置值→永不到0)→ 按天兜底 ──
sb = mkCtx();
ch = { name: '丙', location: '陕西', _travelTo: '陕西', _travelFrom: '西安', _travelRemainingDays: 8, _travelAssignPost: '陕西/巡抚' };
sb.GM.chars = [ch];
arrTurn = 0;
for (let t = 1; t <= 30; t++) {
  sb.GM.turn = 4 + t;
  ch._travelRemainingDays = 8;        // 模拟 AI 每回合重置(8 > daysPassed 5 → 永不递减到 0)
  ch._travelStartTurn = sb.GM.turn;   // 起程回合也被刷
  const rr = sb.advanceCharTravelByDays(5); // daysPerTurn=5
  if (rr.arrived) { arrTurn = t; break; }
}
// 应耗锚定=8·cap=max(16,40)=40 天·实耗 5/回合 → 第 8 回合(40 天)强制抵达
ok(arrTurn === 8, '③ 每回合重置卡死·按天兜底第 ' + arrTurn + ' 回合(40天)强制抵达·不再永久卡');
ok(!ch._travelTo, '③ 卡死场景最终仍抵达·_travelTo 清空');

// ── ④ 抵达清字段 ──
ok(ch._travelElapsedDays === undefined && ch._travelExpectedDays === undefined && ch._travelRemainingDays === undefined,
  '④ 抵达后 _travelElapsedDays/_travelExpectedDays/_travelRemainingDays 全清');

// ── 源契约 ──
const src = fs.readFileSync(path.join(WEB, 'modules/ai-change-applier/core.js'), 'utf8');
ok(!/MAX_TRAVEL_TURNS/.test(src), '⑤ 不再含旧的按回合计硬上限 MAX_TRAVEL_TURNS');

console.log('\n结果: ' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
