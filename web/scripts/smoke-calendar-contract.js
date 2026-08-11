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

const infra = fs.readFileSync(path.join(ROOT, 'tm-ai-infra.js'), 'utf8');
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

console.log('[smoke-calendar-contract] ' + pass + ' PASS / ' + fail + ' FAIL');
process.exit(fail ? 1 : 0);
