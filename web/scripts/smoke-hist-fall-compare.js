#!/usr/bin/env node
'use strict';
/* smoke-hist-fall-compare — D3「多延N月」史上国祚对照（2026-07-06）防腐线。
 * 行为级：vm 切片实跑 _histFallCompareHtml（tm-endturn-helpers.js）·
 * 契约级：终局屏败局分支接线 + 两官方剧本 historicalFallYear 字段在。 */
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var ROOT = path.resolve(__dirname, '..');
var officialSync = require('./sync-official-scenarios.js');
var P0 = 0, F0 = 0;
function ok(c, m) { if (c) { P0++; console.log('  ✓ ' + m); } else { F0++; console.log('  ✗ FAIL: ' + m); } }
function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }
console.log('smoke-hist-fall-compare');

var src = read('tm-endturn-helpers.js');
var s = src.indexOf('function _histFallCompareHtml');
var e = src.indexOf('function _showEndgameScreen');
ok(s >= 0 && e > s, '切片边界在(_histFallCompareHtml 位于 _showEndgameScreen 前)');

function mkCtx(di, pTime) {
  var ctx = {
    GM: { turn: 10 },
    P: { time: (pTime === undefined ? {} : pTime) },
    calcDateFromTurn: function () { if (di === 'throw') throw new Error('boom'); return di; },
    escHtml: function (x) { return String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(src.slice(s, e), ctx, { filename: 'histfall-slice.js' });
  return ctx;
}

/* ── 行为 ─────────────────────────────────────────────────────── */
var scMing = { historicalFallYear: 1644, historicalFallMonth: 3, historicalFallNote: '甲申之变·京师陷' };

var c1 = mkCtx({ adYear: 1650, lunarMonth: 4 });
var h1 = c1._histFallCompareHtml(scMing);
ok(h1.indexOf('延祚6年1月') >= 0 && h1.indexOf('已胜史册') >= 0, '多延：1650年4月 vs 1644年3月 → 延祚6年1月');
ok(h1.indexOf('公元1644年3月') >= 0 && h1.indexOf('甲申之变') >= 0, '对照带史上亡期+注');
ok(h1.indexOf('--gold-400') >= 0, '胜史册用金色');

var c2 = mkCtx({ adYear: 1640, lunarMonth: 1 });
var h2 = c2._histFallCompareHtml(scMing);
ok(h2.indexOf('提前4年2月而倾') >= 0, '早倾：1640年1月 → 提前4年2月而倾');

var c3 = mkCtx({ adYear: 1644, lunarMonth: 3 });
ok(c3._histFallCompareHtml(scMing).indexOf('岂天数耶') >= 0, '同际而倾走专句');

ok(mkCtx({ adYear: 1650, lunarMonth: 4 })._histFallCompareHtml({}) === '', '剧本无 historicalFallYear → 静默空串');
ok(mkCtx({ adYear: 1650, lunarMonth: 4 })._histFallCompareHtml(null) === '', 'sc 为空 → 空串');
ok(mkCtx({ adYear: 1650, lunarMonth: 4 }, null)._histFallCompareHtml(scMing) === '', '无 P.time(无时间系统) → 空串');
ok(mkCtx('throw')._histFallCompareHtml(scMing) === '', 'calcDateFromTurn 抛错 → 兜底空串');

var c7 = mkCtx({ adYear: 1644, lunarMonth: 6 });
var h7 = c7._histFallCompareHtml({ historicalFallYear: 1644 });
ok(h7.indexOf('公元1644年' + '——') >= 0 && h7.indexOf('1644年3月') < 0, '未注月：史期不带月·按年中6月折算(同际)');
ok(h7.indexOf('岂天数耶') >= 0, '年中折算生效(1644年6月 vs 缺省6月 → 同际)');

var c8 = mkCtx({ adYear: 1644, lunarMonth: 12 });
var h8 = c8._histFallCompareHtml({ historicalFallYear: 1644, historicalFallMonth: 15 });
ok(h8.indexOf('岂天数耶') >= 0, '月越界夹取到12(15→12·与在游12月同际)');

var c9 = mkCtx({ adYear: -200, lunarMonth: 6 });
var h9 = c9._histFallCompareHtml({ historicalFallYear: -206, historicalFallMonth: 6 });
ok(h9.indexOf('公元前206年') >= 0 && h9.indexOf('延祚6年') >= 0, '负公元年显「公元前」·跨0轴月算不乱');

var c10 = mkCtx({ adYear: 1650, lunarMonth: 4 });
var h10 = c10._histFallCompareHtml({ historicalFallYear: 1644, historicalFallMonth: 3, historicalFallNote: '<b>x</b>注' });
ok(h10.indexOf('<b>') < 0 && h10.indexOf('&lt;b&gt;') >= 0, '注文 escHtml 转义(防剧本数据注入)');

/* ── 契约 ─────────────────────────────────────────────────────── */
// ★tm-endturn-helpers.js 以 \uXXXX 转义存中文·Edit 落盘自动归一化→中文正则断言在此文件不可靠·契约用 ASCII 锚
function readOfficial(key) {
  var entry = officialSync.ENTRIES.find(function (item) { return item.key === key; });
  return JSON.parse(fs.readFileSync(path.join(officialSync.SOURCE_DIR, entry.filename), 'utf8'));
}
var scT = readOfficial('tianqi7');
ok(scT.historicalFallYear === 1644 && scT.historicalFallMonth === 3, '官方剧本真源·天启七年带明亡1644年3月');
var scS = readOfficial('shaosong');
ok(scS.historicalFallYear === 1279 && /崖山海战/.test(scS.historicalFallNote || ''), '官方剧本真源·绍宋带宋亡1279崖山');

console.log('\nsmoke-hist-fall-compare ' + (F0 === 0 ? 'PASS' : 'FAIL') + ' ' + P0 + '/' + (P0 + F0));
process.exit(F0 === 0 ? 0 : 1);
