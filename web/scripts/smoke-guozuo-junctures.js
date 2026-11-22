#!/usr/bin/env node
/* eslint-env node */
// smoke-guozuo-junctures.js — D4 一步之遥·临界具名告警（深挖第七轮B）
//   终局临界此前全静默骰点——可升级而未骰中·玩家不知有多险。国祚卡读侧具名告警(带权臣名真数据)·
//   另补「权臣」崩坏因子(cl>0.75·此前篡位死因链只读皇权指数)。同 sliceFn 抽源范式。
//   11-21 删旧：「民变 4→5 级·距改朝只欠一线」「流寇建制立国·问鼎」两条随五级梯、旧账删了，只剩权臣篡位一条。
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const WEB = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(WEB, 'phase8-formal-rightrail.js'), 'utf8');
function sliceFn(s, marker) { const a = s.indexOf(marker); let j = s.indexOf('{', a), d = 0; for (; j < s.length; j++) { const c = s[j]; if (c === '{') d++; else if (c === '}') { d--; if (d === 0) { j++; break; } } } return s.slice(a, j); }
const fnSrc = sliceFn(src, 'function rightGuozuoCard(');

let A = 0, F = 0;
function ok(c, m) { if (c) { A++; } else { F++; console.log('  ✗ ' + m); } }
function render(GM) {
  const ctx = { Array: Array, Number: Number, Math: Math, console: console,
    rightSocGM: function () { return GM; },
    esc: function (x) { return String(x == null ? '' : x); },
    rightArmyFmtNum: function (n) { return String(n); } };
  vm.createContext(ctx);
  vm.runInContext(fnSrc + '\nthis.go=rightGuozuoCard;', ctx);
  return ctx.go();
}

// ── ① 民变再多也没有「距改朝只欠一线」（五级梯删了） ──
const h1 = render({ minxin: { revolts: [{ source: 'revolt-cases', status: 'ongoing', level: 2, followers: 200000, region: '陕西' }, { source: 'revolt-cases', status: 'ongoing', level: 2, followers: 90000, region: '河南' }] } });
ok(/民变/.test(h1) && !/一步之遥/.test(h1) && !/天命移/.test(h1), '① 民变只作崩坏因子，不出「距改朝」告警');

// ── ② 旧档的五级字段（level 4、5）也不再出告警 ──
ok(!/一步之遥/.test(render({ minxin: { revolts: [{ status: 'ongoing', level: 5, region: '山东' }] } })), '② 旧式 level 5 不出告警');

// ── ③ 权臣 controlLevel>0.9 →篡位一步之遥·具名 ──
const h3 = render({ huangquan: { index: 60, powerMinister: { name: '魏忠贤', controlLevel: 0.93 } } });
ok(/一步之遥/.test(h3) && /魏忠贤/.test(h3) && /神器易主/.test(h3), '③ 权柄逾九分→篡位一步之遥·具名魏忠贤');
ok(/权臣/.test(h3) && /柄移私门/.test(h3), '③ 权臣崩坏因子上卡(此前皇权60时全无预警)');

// ── ④ 权臣 cl 0.8：有因子无「一步之遥」(未到临界) ──
const h4 = render({ huangquan: { index: 60, powerMinister: { name: '严嵩', controlLevel: 0.8 } } });
ok(/权臣/.test(h4) && /严嵩/.test(h4), '④ cl0.8 权臣因子在卡');
ok(!/一步之遥/.test(h4), '④ cl0.8 未到临界无告警');

// ── ⑤ 权臣 cl≤0.75 不上卡(承平权臣不虚报) ──
ok(render({ huangquan: { index: 60, powerMinister: { name: '张居正', controlLevel: 0.6 } } }) === '', '⑤ cl0.6 无因子·承平不显');

// ── ⑥ 旧账「建制」不再出「问鼎」告警（旧账删了） ──
ok(!/问鼎/.test(render({ minxin: { revolts: [] }, _activeRevolts: [{ organizationType: 'builtState', leaderName: '李自成' }] })), '⑥ 旧账建制不出问鼎告警');

// ── ⑦ 权臣临界与民变并见：只一条告警，卡不塌 ──
const h7 = render({
  minxin: { revolts: [{ source: 'revolt-cases', status: 'ongoing', level: 2, followers: 300000, region: '陕西' }] },
  huangquan: { index: 30, powerMinister: { name: '魏忠贤', controlLevel: 0.95 } }
});
const juncCount = (h7.match(/一步之遥/g) || []).length;
ok(juncCount === 1, '⑦ 只剩权臣一条告警(' + juncCount + ')');
ok(/濒亡/.test(h7), '⑦ 多因聚合仍濒亡档');

// ── ⑧ 无临界局面：无告警块 ──
const h8 = render({ guoku: { money: 100000 } });
ok(/将危/.test(h8) && !/一步之遥/.test(h8), '⑧ 仅度支将危·无告警块');

console.log('[smoke-guozuo-junctures] ' + (F ? 'FAIL' : 'PASS') + ' — ' + A + ' 通过 / ' + F + ' 失败');
process.exit(F ? 1 : 0);
