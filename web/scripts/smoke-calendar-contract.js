#!/usr/bin/env node
'use strict';
// GM.year/month/day 兼容镜像：权威始终是 GM.turn + P.time；新局、回合推进、两条读档路径必须同步。

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; console.log('  PASS ' + msg); } else { fail++; console.error('  FAIL ' + msg); } }
function sliceFn(src, marker) {
  const a = src.indexOf(marker); if (a < 0) return '';
  let i = src.indexOf('{', a), depth = 0, j = i;
  for (; j < src.length; j++) { const c = src[j]; if (c === '{') depth++; else if (c === '}' && --depth === 0) { j++; break; } }
  return src.slice(a, j);
}

const infra = (fs.readFileSync(path.join(ROOT, 'tm-ai-infra-retry.js'), 'utf8') + '\n' + fs.readFileSync(path.join(ROOT, 'tm-ai-infra.js'), 'utf8'));
const start = fs.readFileSync(path.join(ROOT, 'tm-patches-start.js'), 'utf8');
const systems = fs.readFileSync(path.join(ROOT, 'tm-endturn-systems.js'), 'utf8');
const lifecycle = fs.readFileSync(path.join(ROOT, 'tm-save-lifecycle.js'), 'utf8');
const manager = fs.readFileSync(path.join(ROOT, 'tm-save-manager.js'), 'utf8');
const calcSrc = sliceFn(infra, 'function calcDateFromTurn(');
const syncSrc = sliceFn(infra, 'function _tmSyncGMCalendar(');
ok(!!calcSrc && !!syncSrc, '可抽取权威日期计算与唯一镜像写口');

const ctx = {
  P: { time: { year: 1600, startMonth: 1, startDay: 1, startLunarMonth: 1, startLunarDay: 1, enableEraName: false, reignY: 1 } },
  GM: { turn: 25, eraNames: [] },
  _getDaysPerTurn: () => 30,
  _SEASON_FROM_MONTH: { 1: '春', 2: '春', 3: '春', 4: '春', 5: '夏', 6: '夏', 7: '夏', 8: '秋', 9: '秋', 10: '秋', 11: '冬', 12: '冬' },
  gzYear: () => '', gzDay: () => '', getEraDisplay: () => null,
  isFinite, Number, Math
};
vm.createContext(ctx);
vm.runInContext(calcSrc + '\n' + syncSrc, ctx);
const di = ctx.calcDateFromTurn(25);
ok(di.adYear === 1601 && di.solarMonth === 12 && di.solarDay === 21, 'T25 从 1600-01-01 每回合30日推到 1601-12-21');
const mirrored = ctx._tmSyncGMCalendar(ctx.GM, 25);
ok(mirrored.year === 1601 && ctx.GM.year === 1601 && ctx.GM.month === 12 && ctx.GM.day === 21, 'GM 兼容字段与权威日期一致');
ctx.P = {};
ctx.GM = { turn: 25, year: 1598, month: 7, day: 3 };
const legacyWithoutTime = ctx._tmSyncGMCalendar(ctx.GM, 25);
ok(legacyWithoutTime === null && ctx.GM.year === 1598 && ctx.GM.month === 7 && ctx.GM.day === 3, '旧档缺 P.time 时保留日期镜像，不写入 adYear=0 占位');

ok(/_tmSyncGMCalendar\(GM, GM\.turn \|\| 1\)/.test(start), '新局在时间配置落定后同步');
ok(/GM\.turn\+\+;[\s\S]{0,300}_tmSyncGMCalendar\(GM, GM\.turn\)/.test(systems), '回合推进后立即同步');
ok(/function fullLoadGame[\s\S]*?_tmSyncGMCalendar\(GM, GM\.turn \|\| 1\)/.test(lifecycle), '完整读档同步旧档/陈旧镜像');
ok(/GM = deepClone\(gs\.GM \|\| gs\);[\s\S]{0,300}_tmSyncGMCalendar\(GM, GM\.turn \|\| 1\)/.test(manager), '降级读档路径同样同步');

// Load the real cumulative clock: an onsite response can stop a formal turn
// at a fractional day, while calendar dates still name a whole civil day.
vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-sim-time.js'), 'utf8'), ctx, { filename: 'tm-sim-time.js' });
vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-time-utils.js'), 'utf8'), ctx, { filename: 'tm-time-utils.js' });
ctx.P = { time: { year: 1600, startMonth: 1, startDay: 1, daysPerTurn: 30, enableEraName: false } };
ctx.GM = { turn: 1, eraNames: [] };
ctx.TM.NPC = { Meetings: { nextPlayerBoundary: (from) => from === 0 ? { day: 8.5, planId: 'calendar-fixture', reason: 'meeting_event' } : null } };
const fractional = ctx.TM.SimTime.prepare(ctx.GM);
ctx.GM.turn++; ctx.TM.SimTime.commit(ctx.GM, fractional);
const fractionalDate = ctx.calcDateFromTurn(ctx.GM.turn), fractionMirror = ctx._tmSyncGMCalendar(ctx.GM, ctx.GM.turn);
ok(fractionalDate.solarDay === 9 && fractionalDate.lunarDay === 9 && fractionMirror.day === 9, '小数模拟时点只投影为所在日，旧日期镜像不保存9.5日');
const timeUtilsDate = ctx.TimeUtils.turnToDate(ctx.GM.turn);
ok(timeUtilsDate.day === 9 && timeUtilsDate.daysFromStart === 8.5, 'TimeUtils日期为整数，实际已过时间保留半日');
ok(ctx.TM.SimTime.now(ctx.GM) === 8.5 && fractional.days === 8.5 && ctx.GM._tmTime.continuationEndDay === 30, '日期显示不截短实际区间与已承诺剩余时间');
ctx.GM = JSON.parse(JSON.stringify(ctx.GM)); // Clock serialization only; formal disk load has its own gate.
ctx.P.time.daysPerTurn = 7;
const continuation = ctx.TM.SimTime.prepare(ctx.GM);
ok(continuation.days === 21.5 && continuation.toDay === 30, '恢复后即使改变下回合设置，仍继续原区间的21.5日');
ctx.GM.turn++; ctx.TM.SimTime.commit(ctx.GM, continuation);
ok(ctx.TM.SimTime.dayAtTurn(ctx.GM, 2) === 8.5 && ctx.TM.SimTime.now(ctx.GM) === 30, '续办保留先前精确时点，不把历史区间改成整数');
ok(ctx.TM.SimTime.commit(ctx.GM, continuation).duplicate === true && ctx.TM.SimTime.now(ctx.GM) === 30, '恢复后的重复提交不再次推进时间');

console.log('[smoke-calendar-contract] ' + pass + ' PASS / ' + fail + ' FAIL');
process.exit(fail ? 1 : 0);
