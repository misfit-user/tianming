#!/usr/bin/env node
'use strict';
// smoke-d2-legitimacy-cascade — D2：缙绅离心(clout 加权合法性远低于人口加权民心)加速失威危机。
//   抽 tm-authority-complete.js 的 _tickLostAuthorityCrisis 真函数 sandbox 实跑：
//   验缙绅离心旗标→恶化系数→合规流失/外邦蠢动/抗疏三增量提速·按离心深度分级·封顶·不碰皇威·不活跃 no-op·swap-test。
const fs = require('fs'), path = require('path'), vm = require('vm');
const WEB = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(WEB, 'tm-authority-complete.js'), 'utf8');

function sliceFn(s, marker) { const a = s.indexOf(marker); let j = s.indexOf('{', a), d = 0; for (; j < s.length; j++) { const c = s[j]; if (c === '{') d++; else if (c === '}') { d--; if (d === 0) { j++; break; } } } return s.slice(a, j); }
const fnSrc = sliceFn(src, 'function _tickLostAuthorityCrisis(');

let A = 0, F = 0;
function ok(c, m) { if (c) { A++; console.log('  ✓ ' + m); } else { F++; console.log('  ✗ ' + m); } }
function r4(n) { return Math.round(Number(n) * 10000) / 10000; }

// sandbox：Math.random 固定 1（跳过抗疏自动触发分支）+ _autoTriggerObjection 桩
function runCrisis(legitimacy, opts) {
  opts = opts || {};
  const GM = {
    turn: 1,
    huangwei: { index: 22, lostAuthorityCrisis: { active: opts.active !== false, objectionFrequency: 1, foreignEmboldened: 0 } },
    fiscal: { regions: { r1: { compliance: 0.8 }, r2: { compliance: 0.8 } } },
    population: { jimiHoldings: [] }
  };
  if (legitimacy) GM._legitimacy = legitimacy;
  const FakeMath = Object.create(Math); FakeMath.random = function () { return 1; };
  const ctx = { Math: FakeMath, Number: Number, isFinite: isFinite, Object: Object, console: console, global: {} };
  ctx.global.GM = GM;
  ctx.global.addEB = function () {};
  vm.createContext(ctx);
  vm.runInContext('function _autoTriggerObjection(){}\n' + fnSrc + '\nthis.go=_tickLostAuthorityCrisis;', ctx);
  ctx.go({ turn: 1 }, 1);  // mr=1
  return GM;
}

console.log('smoke-d2-legitimacy-cascade — 缙绅离心加速失威危机（真函数抽取）');

const LICENTIOUS = { clout: 20, pop: 50, flag: '缙绅离心' };  // gap 30 → escMult 封顶 1.6
const CALM = { clout: 48, pop: 50, flag: '相安' };             // escMult 1
const baseDrop = 0.003;

const gx = runCrisis(LICENTIOUS);
const gc = runCrisis(CALM);
const gn = runCrisis(null);   // 无 _legitimacy（swap-test 基线·回归安全）

const dropX = r4(0.8 - gx.fiscal.regions.r1.compliance);
const dropC = r4(0.8 - gc.fiscal.regions.r1.compliance);
const dropN = r4(0.8 - gn.fiscal.regions.r1.compliance);

ok(dropX > dropC, '缙绅离心·合规流失更快 (' + dropX + ' > ' + dropC + ')');
ok(r4(dropX) === r4(baseDrop * 1.6), '缙绅离心·合规流失=基线×1.6封顶 (' + dropX + '==' + r4(baseDrop * 1.6) + ')');
ok(r4(dropC) === r4(baseDrop), '相安·合规流失=基线(escMult 1) (' + dropC + ')');
ok(r4(dropN) === r4(baseDrop), '★swap-test·无 _legitimacy→escMult 1=基线(回归安全) (' + dropN + ')');
ok(gx.huangwei.lostAuthorityCrisis.objectionFrequency > gc.huangwei.lostAuthorityCrisis.objectionFrequency, '缙绅离心·抗疏频次提速');
ok(gx.huangwei.lostAuthorityCrisis.foreignEmboldened > gc.huangwei.lostAuthorityCrisis.foreignEmboldened, '缙绅离心·外邦蠢动提速');
ok(r4(gx.huangwei.lostAuthorityCrisis.foreignEmboldened) === r4(0.02 * 1.6), '缙绅离心·外邦蠢动=0.02×1.6 (' + r4(gx.huangwei.lostAuthorityCrisis.foreignEmboldened) + ')');

// graded（未封顶）：gap 12 → escMult 1.3
const gGrad = runCrisis({ clout: 38, pop: 50, flag: '缙绅离心' });
ok(r4(0.8 - gGrad.fiscal.regions.r1.compliance) === r4(baseDrop * 1.3), '缙绅离心·按离心深度分级(gap12→×1.3) (' + r4(0.8 - gGrad.fiscal.regions.r1.compliance) + ')');

// 民怨上达（clout 高于 pop·flag 非缙绅离心）不加速
const gPop = runCrisis({ clout: 70, pop: 40, flag: '民怨上达' });
ok(r4(0.8 - gPop.fiscal.regions.r1.compliance) === r4(baseDrop), '民怨上达旗标·不加速失威危机(escMult 1)');

// 防御：flag 缙绅离心 但 gap<=0（脏数据）→ escMult 1
const gBad = runCrisis({ clout: 50, pop: 40, flag: '缙绅离心' });
ok(r4(0.8 - gBad.fiscal.regions.r1.compliance) === r4(baseDrop), '防御·缙绅离心但 gap<=0→escMult 1(不误加速)');

// 皇威不被触碰（D2 纯读·不写皇威）
ok(gx.huangwei.index === 22, '★D2 不碰皇威·index 不变 (' + gx.huangwei.index + ')');

// 不活跃则 no-op
const gOff = runCrisis(LICENTIOUS, { active: false });
ok(r4(gOff.fiscal.regions.r1.compliance) === 0.8, '危机未激活→no-op(合规不变)');

// ── ③·D2 余级联：缙绅离心→权臣坐大加速（_tickPowerMinister）──
const pmSrc = sliceFn(src, 'function _tickPowerMinister(');
function runPM(legitimacy) {
  const GM = { huangquan: { index: 40, powerMinister: { name: '权臣', controlLevel: 0.3, faction: [], interceptions: 0 } }, chars: [{ name: '权臣', alive: true }] };
  if (legitimacy) GM._legitimacy = legitimacy;
  const FakeMath = Object.create(Math); FakeMath.random = function () { return 1; };   // random=1→跳过截奏/篡位分支
  const ctx = { Math: FakeMath, Number: Number, isFinite: isFinite, Object: Object, console: console, global: {} };
  ctx.global.GM = GM; ctx.global.addEB = function () {};
  vm.createContext(ctx);
  vm.runInContext('function _powerMinisterCounterEdict(){};function _powerMinisterEndgame(){}\n' + pmSrc + '\nthis.go=_tickPowerMinister;', ctx);
  ctx.go({ turn: 1 }, 1);
  return GM.huangquan.powerMinister.controlLevel;
}
const pmLizin = runPM({ clout: 20, pop: 50, flag: '缙绅离心' });   // +0.01×1.5=+0.015 → 0.315
const pmCalm = runPM({ clout: 48, pop: 50, flag: '相安' });        // +0.01 → 0.31
const pmNone = runPM(null);
ok(r4(pmLizin) === r4(0.315), '缙绅离心·权臣坐大 +50%(0.3→0.315) (got ' + pmLizin + ')');
ok(r4(pmCalm) === r4(0.31), '相安·权臣常速(0.3→0.31) (got ' + pmCalm + ')');
ok(pmLizin > pmCalm, '★缙绅离心·权臣坐大快于相安');
ok(r4(pmNone) === r4(0.31), 'swap-test·无 _legitimacy→常速(回归安全) (got ' + pmNone + ')');

// 源契约
const escUses = (src.match(/\*\s*_escMult/g) || []).length;
ok(escUses >= 3, '源契约·_escMult 施于≥3 增量(抗疏/合规/外邦) → ' + escUses);

console.log('\n[smoke-d2-legitimacy-cascade] ' + (F ? 'FAIL' : 'PASS') + ' — ' + A + ' 通过 / ' + F + ' 失败');
process.exit(F ? 1 : 0);
