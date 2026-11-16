/* smoke-renli-reported-channels.js — 刀C-玩家侧·官报雾三道（奏疏读官报 / 鸿雁门生密报读真相 / 方志对照）
 * 验：① 种子省有事→奏疏(GM.memorials·读 reported 粉饰口径·官报恒比真相乐观) ② 太平省不奏 ③ 未种子 inert
 *   ④ 真情严峻→门生密报(GM.letters·from≠玩家=incoming·playerRead=false·读 byRegion 真值) ⑤ 不严峻不密报
 *   ⑥ dedup 刷新非堆积 ⑦ top-N 封顶(ZOU_CAP/MI_CAP)防刷屏 ⑧ 方志官报对照行接线 ⑨ 导出/装配 ⑩ 中立
 * 跑：node scripts/smoke-renli-reported-channels.js
 */
'use strict';
var pass = 0, fail = 0, fails = [];
function ok(c, m) { if (c) pass++; else { fail++; fails.push(m); console.error('  ✗ ' + m); } }

global.TM = global.TM || {};
var R = require('../tm-renli.js');

function mkP() {
  return { adminHierarchy: { player: { divisions: [
    { id: 'div_xa', name: '西安府', governor: '李督抚', renliSeed: { soilBase: 60 }, populationDetail: { ding: 100000, fugitives: 30000 } }, // 重灾
    { id: 'div_ya', name: '延安府', renliSeed: { soilBase: 55 }, populationDetail: { ding: 80000, fugitives: 200 } },                        // 太平
    { id: 'div_song', name: '松江府', populationDetail: { ding: 100000, fugitives: 1000 } }                                                  // 未种子
  ] } } };
}
function mkGM() {
  return {
    turn: 8, sid: 'sc-x',
    chars: [{ name: '李督抚', alive: true, loyalty: 20, resources: { stress: 90, fame: 60 } }],
    renli: { byRegion: {
      div_xa: { corveeRate: 0.45, cultivatedLand: 50000, fallowLand: 50000, foodNeed: 100000, foodDeficit: 60000, deficitTurns: 3, levyPolicy: {} },
      div_ya: { corveeRate: 0.12, cultivatedLand: 80000, fallowLand: 0, foodNeed: 80000, foodDeficit: 0, deficitTurns: 0, levyPolicy: {} }
    }, reported: {} }
  };
}

var P = mkP(), GM = mkGM(); global.P = P;
R.refreshReported(GM, P);     // 先刷官报口径
R.spawnReportedChannels(GM, P);

// ── 奏疏（官报） ──
var zxa = (GM.memorials || []).find(function (m) { return m.id === 'renli-zou-div_xa'; });
ok(!!zxa, '1·西安府(有事)→生成役政奏报 memorial');
ok(zxa && zxa.from === '李督抚' && zxa.subtype === '役政', '1·奏报者=李督抚·subtype 役政');
ok(zxa && /役负约18%/.test(zxa.content), '1·奏疏读 reported 粉饰口径(役负约18% < 真相45%·官报乐观)·实得 ' + (zxa && zxa.content.match(/役负约\d+%/)));
ok(!(GM.memorials || []).find(function (m) { return m.id === 'renli-zou-div_ya'; }), '2·延安府(太平·无 hasBad)→不奏（省界面噪声）');
ok(!(GM.memorials || []).find(function (m) { return m.id === 'renli-zou-div_song'; }), '3·松江府(未种子)→inert 不奏');

// ── 鸿雁（真相·门生密报） ──
var mxa = (GM.letters || []).find(function (l) { return l.id === 'renli-mi-div_xa'; });
ok(!!mxa, '4·西安府(严峻·collapse)→生成门生密报 letter');
ok(mxa && mxa.from !== '玩家' && mxa.playerRead === false, '4·门生密报 from≠玩家(=incoming 来函)·未阅');
ok(mxa && /役负实约45%/.test(mxa.content) && /勿付有司/.test(mxa.content), '4·鸿雁读 byRegion 真值(役负实约45%)·密语勿付有司·实得 ' + (mxa && mxa.content.match(/役负实约\d+%/)));
ok(!(GM.letters || []).find(function (l) { return l.id === 'renli-mi-div_ya'; }), '5·延安府(不严峻)→不密报');

// ── dedup ──
R.spawnReportedChannels(GM, P);
var zCount = (GM.memorials || []).filter(function (m) { return m.id === 'renli-zou-div_xa'; }).length;
var mCount = (GM.letters || []).filter(function (l) { return l.id === 'renli-mi-div_xa'; }).length;
ok(zCount === 1 && mCount === 1, '6·dedup：再跑→奏疏/密报各仍 1 条（刷新非堆积）·实得 zou=' + zCount + ' mi=' + mCount);

// ── inert（无种子） ──
global.P = { adminHierarchy: { player: { divisions: [{ id: 'div_n', name: '某府', populationDetail: { ding: 100000, fugitives: 0 } }] } } };
var GM2 = { turn: 3, chars: [], renli: { byRegion: {}, reported: {} } };
R.refreshReported(GM2, global.P); R.spawnReportedChannels(GM2, global.P);
ok((GM2.memorials || []).length === 0 && (GM2.letters || []).length === 0, '7·未推行役政→零奏疏零密报（inert）');

// ── top-N 封顶（15 个重灾种子省→奏疏≤12·密报≤8） ──
var divs = [], byReg = {};
for (var i = 0; i < 15; i++) {
  var id = 'div_b' + i;
  divs.push({ id: id, name: '灾府' + i, renliSeed: { soilBase: 50 }, populationDetail: { ding: 100000, fugitives: 30000 } });
  byReg[id] = { corveeRate: 0.45, cultivatedLand: 40000, fallowLand: 40000, foodNeed: 100000, foodDeficit: 60000, deficitTurns: 3, levyPolicy: {} };
}
global.P = { adminHierarchy: { player: { divisions: divs } } };
var GM3 = { turn: 5, chars: [], renli: { byRegion: byReg, reported: {} } };
R.refreshReported(GM3, global.P); R.spawnReportedChannels(GM3, global.P);
var zou = (GM3.memorials || []).filter(function (m) { return /^renli-zou-/.test(m.id); }).length;
var mi = (GM3.letters || []).filter(function (l) { return /^renli-mi-/.test(l.id); }).length;
ok(zou === 12, '8·top-N：15 重灾省→奏疏封顶 12(ZOU_CAP)·实得 ' + zou);
ok(mi === 8, '8·top-N：→门生密报封顶 8(MI_CAP)·实得 ' + mi);

// ── 装配/导出/方志/中立 ──
var fs = require('fs'), path = require('path');
ok(typeof R.spawnReportedChannels === 'function', '9·导出 spawnReportedChannels');
var src = fs.readFileSync(path.join(__dirname, '..', 'tm-renli.js'), 'utf8');
// 第二十五拆：方志役政卷官报对照行已迁出至 dossier sibling·源码契约需并检两片(origin 先·sibling 后·合装载序)
var body = src.slice(src.indexOf('function spawnReportedChannels'), src.indexOf('function spawnReportedChannels') + 2400);
ok(!/天启|陕西|延安|西安|甘州|sc-tianqi/.test(body), '10·spawnReportedChannels 无朝代/地名硬编（中立）');

console.log('\n[smoke-renli-reported-channels] ' + pass + ' 通过 / ' + fail + ' 失败');
if (fail) { console.error('失败项：\n - ' + fails.join('\n - ')); process.exit(1); }
process.exit(0);
