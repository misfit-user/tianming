/* smoke-roving-plunder.js — 刀三·流寇/民变劫掠据府（给乱党牙齿）
 * 验：① 流寇据府→RegionStatus 挂「流寇劫掠」负境况(econPct∝烈度·复用 cascade 减税+联动刀一减粮产)
 *   ② 劫掠驱民入既有逃户池(恶性循环)③ 封顶(单股单回合驱民≤CAP)④ 最多劫掠府数封顶 ⑤ 民变 ongoing→「民变扰攘」(轻·按级别)
 *   ⑥ 已平民变/已散流寇不劫 ⑦ 无乱党→no-op ⑧ 装配/导出契约
 * 跑：node scripts/smoke-roving-plunder.js
 */
'use strict';
var pass = 0, fail = 0, fails = [];
function ok(c, m) { if (c) pass++; else { fail++; fails.push(m); console.error('  ✗ ' + m); } }

var addCalls = [];
global.window = undefined;
global.TM = {
  RegionStatus: { add: function (div, raw) { addCalls.push({ div: div && (div.name || div.id), name: raw.name, econPct: raw.econPct, source: raw.source }); return raw; } },
  AIChange: { PathUtils: { findDivisionByNameFuzzy: function (G, name) { return name ? { id: name, name: name, statusEffects: [] } : null; } } },
  errors: { capture: function () {} }
};
global.addEB = function () {};
require('../tm-class-mobility.js');
var F3 = global.PhaseF3;
ok(F3 && typeof F3._tickRovingPlunder === 'function', '0·PhaseF3._tickRovingPlunder 导出');

function freshGM(opts) {
  opts = opts || {};
  return {
    turn: 5,
    rovingRebels: opts.rebels || [],
    minxin: { revolts: opts.revolts || [] },
    population: { byLegalStatus: { taoohu: { mouths: opts.taoohu || 0 } } }
  };
}

// ── T1/T2 流寇据府劫掠 + 喂逃户 ──
global.GM = freshGM({ rebels: [{ id: 'r1', strength: 100000, regions: ['西安府', '延安府'], disbanded: false }] });
addCalls = [];
F3._tickRovingPlunder({ turn: 5 }, 1);
var roCalls = addCalls.filter(function (c) { return c.source === 'roving'; });
ok(roCalls.length === 2 && roCalls.every(function (c) { return c.name === '流寇劫掠'; }), '1·流寇据2府→各挂「流寇劫掠」境况·实得 ' + roCalls.length);
ok(Math.abs(roCalls[0].econPct - (-0.18 * 0.5)) < 1e-9, '1·econPct=-0.18×烈度0.5(强度10w/20w)=-0.09·实得 ' + roCalls[0].econPct);
ok(global.GM.population.byLegalStatus.taoohu.mouths === 2000, '2·劫掠驱民入逃户=强度10w×0.02=2000(恶性循环)·实得 ' + global.GM.population.byLegalStatus.taoohu.mouths);

// ── T3 驱民封顶 ──
global.GM = freshGM({ rebels: [{ id: 'r2', strength: 5000000, regions: ['某府'], disbanded: false }] });
addCalls = [];
F3._tickRovingPlunder({ turn: 5 }, 1);
ok(global.GM.population.byLegalStatus.taoohu.mouths === 20000, '3·巨寇→驱民封顶 20000(防失控)·实得 ' + global.GM.population.byLegalStatus.taoohu.mouths);

// ── T4 最多劫掠府数封顶 ──
global.GM = freshGM({ rebels: [{ id: 'r3', strength: 100000, regions: ['a', 'b', 'c', 'd', 'e', 'f'], disbanded: false }] });
addCalls = [];
F3._tickRovingPlunder({ turn: 5 }, 1);
ok(addCalls.filter(function (c) { return c.source === 'roving'; }).length === 4, '4·6府→最多劫掠4府(PLUNDER_MAX_REGIONS)·实得 ' + addCalls.filter(function (c) { return c.source === 'roving'; }).length);

// ── T5 民变 ongoing 扰攘（轻·按级别）+ 已平不扰 ──
global.GM = freshGM({ revolts: [{ region: '凤阳府', status: 'ongoing', level: 3 }, { region: '安定府', status: 'suppressed', level: 2 }] });
addCalls = [];
F3._tickRovingPlunder({ turn: 5 }, 1);
var rvCalls = addCalls.filter(function (c) { return c.source === 'revolt'; });
ok(rvCalls.length === 1 && rvCalls[0].div === '凤阳府' && rvCalls[0].name === '民变扰攘', '5·ongoing民变→「民变扰攘」·已平民变不扰·实得 ' + rvCalls.length);
ok(Math.abs(rvCalls[0].econPct - (-0.10 * (3 / 5))) < 1e-9, '5·民变扰攘 econPct=-0.10×(级3/5)=-0.06(轻于流寇)·实得 ' + rvCalls[0].econPct);

// ── T6 已散流寇/0强度不劫 ──
global.GM = freshGM({ rebels: [{ id: 'r4', strength: 0, regions: ['x'], disbanded: false }, { id: 'r5', strength: 99999, regions: ['y'], disbanded: true }] });
addCalls = [];
F3._tickRovingPlunder({ turn: 5 }, 1);
ok(addCalls.length === 0 && global.GM.population.byLegalStatus.taoohu.mouths === 0, '6·0强度/已散流寇→不劫不驱民(no-op)');

// ── T7 无乱党→no-op ──
global.GM = freshGM({});
addCalls = [];
F3._tickRovingPlunder({ turn: 5 }, 1);
ok(addCalls.length === 0 && global.GM.population.byLegalStatus.taoohu.mouths === 0, '7·无流寇无民变→no-op(零行为)');

// ── T9 地名对不上任何州：一处没挂上就不报劫掠；只报真劫掠到的州 ──
//   （天启流寇的地方是阶层数据里的「北方燕齐」这类泛称，旧写法照样每回合报「劫掠北方燕齐等地」，地方上什么都没发生）
var ebTexts = [];
global.addEB = function (cat, text) { ebTexts.push(String(text || '')); };
var realFind = global.TM.AIChange.PathUtils.findDivisionByNameFuzzy;
global.TM.AIChange.PathUtils.findDivisionByNameFuzzy = function (G, name) { return name === '西安府' ? { id: name, name: name, statusEffects: [] } : null; };
global.GM = freshGM({ rebels: [{ id: 'r6', strength: 100000, regions: ['北方燕齐', '江南苏松'], disbanded: false }] });
addCalls = [];
F3._tickRovingPlunder({ turn: 5 }, 1);
ok(addCalls.length === 0 && !ebTexts.some(function (t) { return /劫掠/.test(t); }), '9·地名对不上任何州→不挂境况也不报劫掠·实得 ' + JSON.stringify(ebTexts));
global.GM = freshGM({ rebels: [{ id: 'r7', strength: 100000, regions: ['北方燕齐', '西安府'], disbanded: false }] });
addCalls = []; ebTexts = [];
F3._tickRovingPlunder({ turn: 5 }, 1);
ok(addCalls.length === 1 && ebTexts.length === 1 && /劫掠西安府，/.test(ebTexts[0]), '9·只报真劫掠到的州·实得 ' + JSON.stringify(ebTexts));
global.TM.AIChange.PathUtils.findDivisionByNameFuzzy = realFind;
global.addEB = function () {};

// ── T8 装配契约 ──
var fs = require('fs'), path = require('path');
var src = fs.readFileSync(path.join(__dirname, '..', 'tm-class-mobility.js'), 'utf8');
ok(/_tickRovingCoalesce\(ctx, mr\);[\s\S]{0,160}_tickRovingPlunder\(ctx, mr\);/.test(src), '8·tick 链在凝聚后接劫掠(_tickRovingPlunder)');
ok(/name: '流寇劫掠'[\s\S]{0,120}source: 'roving'/.test(src) && /RegionStatus/.test(src), '8·复用 RegionStatus 挂境况(→cascade 减税+联动刀一)');

console.log('\n[smoke-roving-plunder] ' + pass + ' 通过 / ' + fail + ' 失败');
if (fail) { console.error('失败项：\n - ' + fails.join('\n - ')); process.exit(1); }
process.exit(0);
