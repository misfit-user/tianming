/* smoke-renli-grain-shortfall.js — 刀B-深做·粮荒田赋欠征（单写者直扣 guoku.grain·防双算）
 * 验：① 种子省失收→guoku.grain 扣欠征(=Σ foodDeficit×份额) ② 只动粮·不动 money/income(与逃亡通道零重叠=非双算)
 *   ③ 封顶：欠征总额≤国库现粮×GUARD·绝不扣破 0 ④ 无亏空(deficit=0)→不扣 ⑤ 未种子/无帑廪→inert
 *   ⑥ 逐区 ledger 'grainShortfall' + r._grainShortfall ⑦ 导出/装配 ⑧ 中立
 * 跑：node scripts/smoke-renli-grain-shortfall.js
 */
'use strict';
var pass = 0, fail = 0, fails = [];
function ok(c, m) { if (c) pass++; else { fail++; fails.push(m); console.error('  ✗ ' + m); } }

global.TM = global.TM || {};
var R = require('../tm-renli.js');

function mkP() {
  return { adminHierarchy: { player: { divisions: [
    { id: 'div_xa', name: '西安府', renliSeed: { soilBase: 60 }, populationDetail: { ding: 100000 } },
    { id: 'div_ya', name: '延安府', renliSeed: { soilBase: 55 }, populationDetail: { ding: 80000 } },
    { id: 'div_song', name: '松江府', populationDetail: { ding: 100000 } } // 未种子
  ] } } };
}

// ── T1 基本欠征（西安府失收60000·延安府足）──
global.P = mkP();
var GM = { turn: 8, guoku: { grain: 1000000, money: 500000 },
  renli: { byRegion: {
    div_xa: { foodNeed: 100000, foodDeficit: 60000, levyPolicy: {}, ledger: [] },
    div_ya: { foodNeed: 80000, foodDeficit: 0, levyPolicy: {}, ledger: [] }
  }, reported: {} } };
var ded = R.applyGrainShortfall(GM, global.P);
ok(ded === Math.round(60000 * 0.12), '1·欠征=失收60000×份额0.12=7200·实得 ' + ded);
ok(GM.guoku.grain === 1000000 - 7200, '1·guoku.grain 扣欠征(1000000→992800)·实得 ' + GM.guoku.grain);
ok(GM.guoku.money === 500000, '2·★只动粮·money 不动(与逃亡通道砍 money 月入零重叠=非双算)·实得 ' + GM.guoku.money);
ok(GM.renli.byRegion.div_xa._grainShortfall === 7200, '6·西安府 r._grainShortfall=7200');
ok(GM.renli.byRegion.div_ya._grainShortfall === 0, '4·延安府(无亏空)→欠征0(不扣)');
var lg = (GM.renli.byRegion.div_xa.ledger || []).find(function (e) { return e.key === 'grainShortfall'; });
ok(lg && lg.delta === -7200, '6·逐区 ledger 记 grainShortfall -7200');

// ── T3 封顶防掏空（小粮库+巨灾）──
global.P = mkP();
var GM2 = { turn: 5, guoku: { grain: 10000, money: 9 },
  renli: { byRegion: {
    div_xa: { foodNeed: 2000000, foodDeficit: 2000000, levyPolicy: {}, ledger: [] }, // 巨灾 raw=240000
    div_ya: { foodNeed: 80000, foodDeficit: 0, levyPolicy: {}, ledger: [] }
  }, reported: {} } };
var ded2 = R.applyGrainShortfall(GM2, global.P);
ok(ded2 === Math.round(10000 * 0.20), '3·封顶：raw 远超→扣 ≤ 国库现粮×0.20=2000·实得 ' + ded2);
ok(GM2.guoku.grain === 8000 && GM2.guoku.grain > 0, '3·绝不扣破 0(10000→8000)·实得 ' + GM2.guoku.grain);

// ── T5 inert ──
global.P = { adminHierarchy: { player: { divisions: [{ id: 'div_n', name: '某府', populationDetail: { ding: 100000 } }] } } }; // 无 renliSeed
var GM3 = { turn: 3, guoku: { grain: 500000 }, renli: { byRegion: {}, reported: {} } };
ok(R.applyGrainShortfall(GM3, global.P) === 0 && GM3.guoku.grain === 500000, '5·未种子→inert(欠征0·粮库不动)');
global.P = mkP();
var GM4 = { turn: 3, renli: { byRegion: { div_xa: { foodNeed: 100000, foodDeficit: 60000, ledger: [] } }, reported: {} } }; // 无 guoku
ok(R.applyGrainShortfall(GM4, global.P) === 0, '5·无帑廪粮账→inert(返0·不崩)');

// ── T7 装配/导出 + T8 中立 ──
var fs = require('fs'), path = require('path');
ok(typeof R.applyGrainShortfall === 'function', '7·导出 applyGrainShortfall');
var src = fs.readFileSync(path.join(__dirname, '..', 'tm-renli.js'), 'utf8');
var body = src.slice(src.indexOf('function applyGrainShortfall'), src.indexOf('function applyGrainShortfall') + 1400);
ok(!/天启|陕西|延安|西安|sc-tianqi/.test(body), '8·applyGrainShortfall 无朝代/地名硬编（中立）');

console.log('\n[smoke-renli-grain-shortfall] ' + pass + ' 通过 / ' + fail + ' 失败');
if (fail) { console.error('失败项：\n - ' + fails.join('\n - ')); process.exit(1); }
process.exit(0);
