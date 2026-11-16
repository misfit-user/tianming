/* smoke-renli-reported-fog.js — 刀C·官报雾（reported 死桩写活 + 官报vs真相喂AI/供UI）
 * 验：① refreshReported 按督抚 disposition(stress高/loyalty低/fame高)+危情→瞒报幅度·官报恒比真相乐观
 *   ② 清官(低stress高loyalty)→几乎不瞒 ③ 危情放大但封顶60% ④ 主官继承(府无主官→省巡抚)⑤ 无主官→例行轻度0.15
 *   ⑥ getReportedVsTruth 返 {reported,truth} ⑦ formatReportedForPrompt 只在有粉饰+有坏事时出欺君块·sorted·labels
 *   ⑧ 未激活→refreshReported no-op + formatReportedForPrompt null ⑨ 装配/导出契约 ⑩ 中立
 * 跑：node scripts/smoke-renli-reported-fog.js
 */
'use strict';
var pass = 0, fail = 0, fails = [];
function ok(c, m) { if (c) pass++; else { fail++; fails.push(m); console.error('  ✗ ' + m); } }

global.TM = global.TM || {};
var R = require('../tm-renli.js');

function mkP() {
  return { adminHierarchy: { player: { divisions: [
    { id: 'div_prov', name: '陕西布政使司', governor: '王巡抚', children: [
      { id: 'div_xa', name: '西安府', governor: '李督抚', renliSeed: { soilBase: 60 }, populationDetail: { ding: 100000, fugitives: 30000 } }, // 自己的督抚·重灾
      { id: 'div_ya', name: '延安府', renliSeed: { soilBase: 55 }, populationDetail: { ding: 80000, fugitives: 4000 } }                       // 无主官→继承省巡抚·安
    ] },
    { id: 'div_gz', name: '甘州卫', renliSeed: { soilBase: 50 }, populationDetail: { ding: 60000, fugitives: 18000 } }                          // 无主官·无上级主官·重灾
  ] } } };
}
function mkGM() {
  return {
    turn: 8, sid: 'sc-x',
    chars: [
      { name: '李督抚', alive: true, loyalty: 20, resources: { stress: 90, fame: 60 } }, // 怕担责+不忠+要脸→重瞒
      { name: '王巡抚', alive: true, loyalty: 90, resources: { stress: 20, fame: 0 } }   // 清直→几乎不瞒
    ],
    renli: { byRegion: {
      div_xa: { corveeRate: 0.45, cultivatedLand: 50000, fallowLand: 50000, foodNeed: 100000, foodDeficit: 60000, levyPolicy: {} },
      div_ya: { corveeRate: 0.15, cultivatedLand: 80000, fallowLand: 0, foodNeed: 80000, foodDeficit: 0, levyPolicy: {} },
      div_gz: { corveeRate: 0.42, cultivatedLand: 40000, fallowLand: 30000, foodNeed: 60000, foodDeficit: 30000, levyPolicy: {} }
    }, reported: {} }
  };
}

var P = mkP(), GM = mkGM(); global.P = P;
R.refreshReported(GM, P);
var rxa = GM.renli.reported.div_xa, rya = GM.renli.reported.div_ya, rgz = GM.renli.reported.div_gz;

// ── T1 重瞒督抚（西安府·封顶60%）──
ok(rxa && rxa.corveeRate < 0.45, '1·官报役负 ' + (rxa && rxa.corveeRate) + ' < 真相0.45（瞒报·官报更乐观）');
ok(rxa && rxa.conceal === 0.6, '1·李督抚 stress90/loy20/fame60 + 重危情→瞒报封顶0.60·实得 ' + (rxa && rxa.conceal));
ok(rxa && rxa.governor === '李督抚', '1·官报记奏报者=李督抚');
ok(rxa && rxa.fugitiveRate < 0.30 && rxa.fallowShare < 0.5 && rxa.deficitRatio < 0.6, '1·逃亡/抛荒/缺粮 全被一并粉饰下去');
ok(rxa && rxa.trueDing === 100000 && rxa.ding === 40000, '1·据报丁口=真丁口10万×keep0.4=4万（瞒税基/隐户·slice-1b 方志「默认看上报值」消费）');

// ── T2 清官（延安府·王巡抚·几乎不瞒）──
ok(rya && rya.conceal < 0.2, '2·王巡抚 stress20/loy90/fame0 + 低危情→瞒报<0.2·实得 ' + (rya && rya.conceal));
ok(rya && Math.abs(rya.corveeRate - 0.15 * (1 - rya.conceal)) < 0.001, '2·清官官报≈真相×keep（几乎照实）');

// ── T4 主官继承（延安府无主官→继承省巡抚）──
ok(rya && rya.governor === '王巡抚', '4·延安府无主官→官报奏报者继承省巡抚王巡抚·实得 ' + (rya && rya.governor));

// ── T5 无主官→例行轻度0.15（甘州卫·危情放大后>0.15）──
ok(rgz && rgz.governor === '', '5·甘州卫无任何主官→奏报者空');
ok(rgz && rgz.conceal >= 0.15 && rgz.conceal <= 0.6, '5·无主官→例行轻度0.15起·危情放大但封顶·实得 ' + (rgz && rgz.conceal));

// ── T3 危情放大：同一无主官基线下·重灾甘州卫 conceal > 例行0.15 ──
ok(rgz && rgz.conceal > 0.15, '3·危情放大：甘州卫重灾→瞒报>例行基线0.15（坏事越多越想盖）·实得 ' + rgz.conceal);

// ── T6 getReportedVsTruth ──
var vt = R.getReportedVsTruth(GM, 'div_xa');
ok(vt && vt.reported && vt.truth && vt.truth.corveeRate === 0.45 && vt.reported.corveeRate === rxa.corveeRate, '6·getReportedVsTruth 返 {reported,truth}（真相役负0.45）');

// ── T7 formatReportedForPrompt：欺君块 ──
var fp = R.formatReportedForPrompt(GM, { limit: 8 });
ok(typeof fp === 'string' && fp.indexOf('督抚奏报与实情之差') >= 0, '7·欺君块带表头');
ok(fp.indexOf('西安府') >= 0 && fp.indexOf('督抚李督抚奏报') >= 0 && fp.indexOf('瞒报~60%') >= 0, '7·西安府欺君行（督抚李督抚·瞒报~60%）');
ok(fp.indexOf('甘州卫') >= 0, '7·甘州卫(重灾+瞒报≥12%)亦入欺君块');
ok(fp.indexOf('延安府') < 0, '7·延安府(清官·无坏事可瞒·hasBad=false)不入欺君块（省 token·只报有诈之地）');
ok(fp.indexOf('西安府') < fp.indexOf('甘州卫'), '7·按瞒报+危情排序（西安府瞒报60%在前）');

// ── T8 未激活 inert ──
global.P = { adminHierarchy: { player: { divisions: [{ id: 'div_n', name: '某府', populationDetail: { ding: 100000, fugitives: 0 } }] } } }; // 无 renliSeed
var GM2 = { turn: 3, chars: [], renli: { byRegion: {}, reported: {} } };
R.refreshReported(GM2, global.P);
ok(Object.keys(GM2.renli.reported).length === 0, '8·未推行役政→refreshReported no-op（reported 空·零行为）');
ok(R.formatReportedForPrompt(GM2, { limit: 8 }) === null, '8·未激活→formatReportedForPrompt 返 null');

// ── T9 装配/导出契约 ──
var fs = require('fs'), path = require('path');
ok(typeof R.refreshReported === 'function' && typeof R.getReportedVsTruth === 'function' && typeof R.formatReportedForPrompt === 'function', '9·三函数全导出');
var src = fs.readFileSync(path.join(__dirname, '..', 'tm-renli.js'), 'utf8');
// slice-1b·方志「默认看上报值」pilot 契约（薛定谔奏报范式·真值藏于聚光）
// 第二十五拆：户口志据报行已迁出至 dossier sibling(而 _reportedPop 读口仍在 origin)·源码契约需并检两片(origin 先·sibling 后·合装载序)

// ── T10 中立 ──
var body = src.slice(src.indexOf('function refreshReported'), src.indexOf('function refreshReported') + 1800);
ok(!/天启|陕西|延安|西安|甘州|sc-tianqi/.test(body), '10·refreshReported 无朝代/地名硬编（中立·主官/地名来自数据）');

console.log('\n[smoke-renli-reported-fog] ' + pass + ' 通过 / ' + fail + ' 失败');
if (fail) { console.error('失败项：\n - ' + fails.join('\n - ')); process.exit(1); }
process.exit(0);
