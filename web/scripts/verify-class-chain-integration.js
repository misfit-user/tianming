#!/usr/bin/env node
/* eslint-env node */
// verify-class-chain-integration.js — 八刀集成验证台（2026-06-16）
// 把 A→B→C1→C2→C3→D 的真函数按真实回合顺序连跑（非单元·验组装）：
//   SF.tick(drift不对称 + radical蓄水 + legitimacy) → refreshClassPhase(起义态) → PhaseF3._tickRadicalFlight(流民失血+hiddenCount)
// 在苛政剧本下跑 8 回合，断言整条因果链涌现 + 打印可见轨迹表 + 正册 prompt 实样。
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const WEB = path.join(__dirname, '..');
require(path.join(WEB, 'tm-engine-constants.js'));
require(path.join(WEB, 'tm-class-engine.js'));
require(path.join(WEB, 'tm-social-foundation.js'));
require(path.join(WEB, 'tm-class-mobility.js'));
const CE = global.TM.ClassEngine, SF = global.TM.SocialFoundation, PF3 = global.PhaseF3;

let passed = 0, failed = 0;
function ok(cond, msg) { if (cond) { passed += 1; console.log('  PASS', msg); } else { failed += 1; console.error('  FAIL', msg); } }
function r1(n) { return Math.round(Number(n) * 10) / 10; }

// 抽正册构建器（与 smoke-class-roster-ai-inject 同法）
function sliceFn(src, marker) { const a = src.indexOf(marker); let i = src.indexOf('{', a), d = 0, j = i; for (; j < src.length; j++) { const c = src[j]; if (c === '{') d++; else if (c === '}') { d--; if (d === 0) { j++; break; } } } return src.slice(a, j); }
const ctxSrc = fs.readFileSync(path.join(WEB, 'tm-endturn-ai-context.js'), 'utf8');
const fnSrc = sliceFn(ctxSrc, 'function appendPromptPolicyContext(');
function roster(GM) {
  const ctx = { Math: Math, Number: Number, String: String, Array: Array, isFinite: isFinite, console: console, Object: Object, global: {}, window: {}, TM: {} };
  vm.createContext(ctx);
  vm.runInContext('function _capture(){};function _slice(v,n){return String(v==null?"":v).slice(0,n||120);}\n' + fnSrc + '\nthis.go=appendPromptPolicyContext;', ctx);
  return ctx.go('', { GM: GM });
}

// 苛政剧本：重税1.45 + 半数灾区 + 低民心30 → 自耕农生计崩
function makeWorld() {
  const leaves = [];
  for (let i = 0; i < 10; i++) leaves.push({ name: '县' + i, taxRate: 1.45, minxin: 30, statusEffects: i < 5 ? [{ kind: 'disaster', name: '旱蝗' }] : [], warZone: false });
  const GM = {
    turn: 0,
    classes: [
      { name: '自耕农', economicRole: '生产', influence: 10, satisfaction: 58, demands: '减赋', populationKeys: ['peasant_self'], regionalVariants: [] },
      { name: '士绅', economicRole: '治理', influence: 40, satisfaction: 62, demands: '保优免', populationKeys: ['gentry_high'], regionalVariants: [] },
      { name: '商贾', economicRole: '流通', influence: 20, satisfaction: 55, demands: '弛海禁', populationKeys: ['merchant'], regionalVariants: [] }
    ],
    population: { national: { mouths: 10000000 }, byClass: { peasant_self: { mouths: 6000000 }, gentry_high: { mouths: 200000 }, merchant: { mouths: 800000 } }, byLegalStatus: { taoohu: { mouths: 0 } }, hiddenCount: 0 },
    minxin: { trueIndex: 40 }, armies: []
  };
  const P = { adminHierarchy: { player: { divisions: [{ name: '某省', children: leaves }] } } };
  return { GM, P };
}

const TOTAL0 = 6000000 + 200000 + 800000;
const ebLog = [];
global.addEB = function (cat, msg) { ebLog.push(cat + '·' + msg); };

const { GM, P } = makeWorld();
const traj = [];
for (let t = 1; t <= 8; t++) {
  GM.turn = t;
  SF.tick(GM, P);                                        // A 不对称缓变 + B 乱民蓄水 + D 合法性
  GM.classes.forEach(function (c) { CE.refreshClassPhase(GM, c); });   // C1 起义态机
  global.GM = GM; PF3._tickRadicalFlight({}, 1);          // C2 流民失血 + C3 hiddenCount/督抚奏报
  const z = GM.classes[0];
  const L = GM._legitimacy || {};
  traj.push({ t: t, sat: r1(z.satisfaction), rf: r1(z._radicalFrac), phase: (z.revoltState || {}).phase || 'calm',
    peasant: GM.population.byClass.peasant_self.mouths, taoohu: GM.population.byLegalStatus.taoohu.mouths,
    hidden: GM.population.hiddenCount, leg: (L.clout != null ? L.clout + '/' + L.pop + '·' + L.flag : '-') });
}
delete global.addEB;

// ── 可见轨迹表 ──
console.log('\n  回合 | 自耕农满意 | 乱民 | 起义态 | 自耕人口 | 逃户 | 隐口 | 天命权重(clout/民心·旗)');
traj.forEach(function (x) {
  console.log('   ' + String(x.t).padEnd(3) + '|  ' + String(x.sat).padEnd(8) + '|' + String(x.rf).padEnd(5) + '|' + String(x.phase).padEnd(8) + '|' + String(x.peasant).padEnd(9) + '|' + String(x.taoohu).padEnd(6) + '|' + String(x.hidden).padEnd(6) + '| ' + x.leg);
});
console.log('');

const f = traj[0], l = traj[traj.length - 1];
const byClassSum = GM.population.byClass.peasant_self.mouths + GM.population.byClass.gentry_high.mouths + GM.population.byClass.merchant.mouths;

// ── 因果链涌现断言 ──
ok(l.sat < f.sat - 5, 'A·自耕农满意度逐回合下行(不对称恶化快) ' + f.sat + '→' + l.sat);
ok(l.rf > (f.rf || 0) && l.rf >= 0.4, 'B·乱民比例逐回合上涨且越阈 ' + (f.rf || 0) + '→' + l.rf);
ok(traj.some(function (x) { return x.phase === 'brewing' || x.phase === 'uprising'; }), 'C1·起义态机被乱民点燃(brewing/uprising 出现)');
ok(l.taoohu > 0 && l.peasant < 6000000, 'C2·人口向逃户失血·自耕格子缩 (逃户 ' + l.taoohu + '·自耕 ' + l.peasant + ')');
ok(byClassSum + GM.population.byLegalStatus.taoohu.mouths === TOTAL0, 'C2·总人口守恒(byClass+逃户=' + TOTAL0 + ')');
ok(l.hidden > 0 && l.hidden === l.taoohu, 'C3·hiddenCount 增(喂 huji 税基↓)·与逃户同步');
ok(GM._legitimacy && typeof GM._legitimacy.flag === 'string' && GM._legitimacy.flag.length > 0, 'D·天命权重旗标每回合计算 (末 ' + (GM._legitimacy || {}).flag + ')');
ok(ebLog.some(function (e) { return /流民载道/.test(e); }), 'C3·起义后督抚奏报入邸报 (' + (ebLog.find(function (e) { return /流民载道/.test(e); }) || 'none').slice(0, 40) + '…)');

// ── 正册 prompt 实样（喂 LLM）──
const out = roster(GM);
ok(/乱民\d成/.test(out) && /态:/.test(out), 'prompt·正册含乱民N成 + 态:(喂 LLM·阶段一庶民反而权贵未离心→天命权重相安·按设计不显)');
console.log('  ── 末回合阶层正册实样（喂 LLM）──');
out.split('\n').filter(function (ln) { return /正册|自耕农|士绅|商贾|天命权重/.test(ln); }).forEach(function (ln) { console.log('  ' + ln.trim()); });

// ── 死亡螺旋闭合相：皇威坍塌（模拟持续民变经既有 authority 引擎反哺）→ 士绅墙头草离心 → 缙绅离心 ──
console.log('\n  ── 死亡螺旋闭合：皇威坍塌后（模拟持续民变已把皇威打到濒危） ──');
GM.huangwei = { index: 8 };
const gentry0 = GM.classes[1]._radicalFrac || 0;
const legClout0 = (GM._legitimacy || {}).clout;
const traj2 = [];
for (let t = 9; t <= 16; t++) {
  GM.turn = t;
  SF.tick(GM, P);
  GM.classes.forEach(function (c) { CE.refreshClassPhase(GM, c); });
  global.GM = GM; PF3._tickRadicalFlight({}, 1);
  const g = GM.classes[1]; const L = GM._legitimacy || {};
  traj2.push({ t: t, grf: r1(g._radicalFrac), gphase: (g.revoltState || {}).phase || 'calm', leg: (L.clout != null ? L.clout + '/' + L.pop + '·' + L.flag : '-') });
}
console.log('  回合 | 士绅乱民 | 士绅态 | 天命权重(clout/民心·旗)');
traj2.forEach(function (x) { console.log('   ' + String(x.t).padEnd(3) + '|  ' + String(x.grf).padEnd(7) + '|' + String(x.gphase).padEnd(7) + '| ' + x.leg); });
const gLast = traj2[traj2.length - 1];
ok(gLast.grf > gentry0 + 0.1, '闭合·皇威坍→士绅墙头草离心·乱民涨 ' + r1(gentry0) + '→' + gLast.grf);
ok(GM._legitimacy && GM._legitimacy.clout < legClout0 - 10, '闭合·士绅离心拖低 clout 加权合法性 ' + legClout0 + '→' + (GM._legitimacy || {}).clout);
ok(GM._legitimacy && GM._legitimacy.flag === '缙绅离心', '闭合·天命旗标转「缙绅离心」(死亡螺旋那一脚·got ' + (GM._legitimacy || {}).flag + ')');
const out2 = roster(GM);
ok(out2.indexOf('天命权重') >= 0 && out2.indexOf('缙绅离心') >= 0, '闭合·正册 surface 天命权重·缙绅离心(喂 LLM 叙事士绅离心)');

// ── C4 端到端相（2026-06-16 起；民变重做·民2c 11-14 改）：苛政链产出的逃户 + 起义阶层 → 不再凝成全国流寇（流寇池并进游击，
//   流寇只从各州起事来）；旧档里已有的流寇招抚照旧守恒回编户 ──
console.log('\n  ── C4 端到端：链产逃户+起义→不凝流寇；旧流寇招抚 ──');
global.GM = GM;
var _taoohuB4 = GM.population.byLegalStatus.taoohu.mouths;
PF3._tickRovingCoalesce({ turn: GM.turn }, 1);
ok((GM.rovingRebels || []).length === 0 && GM.population.byLegalStatus.taoohu.mouths === _taoohuB4, 'C4·链产逃户+起义→不再凝成全国流寇，逃户池不动 (逃户 ' + _taoohuB4 + ')');
GM.rovingRebels = [{ id: 'roving_old', name: '流寇', strength: 40000, regions: ['陕西'], _lastGrewTurn: GM.turn - 2, disbanded: false }];
var _rebels = GM.rovingRebels;
var _hj0 = (GM.population.byLegalStatus.huangji && GM.population.byLegalStatus.huangji.mouths) || 0;
var _pac = PF3.pacifyRovingRebel(_rebels[0]);
ok(_pac.ok && (GM.rovingRebels || []).length === 0, 'C4·招抚→流寇消编');
ok(((GM.population.byLegalStatus.huangji || {}).mouths || 0) - _hj0 === _pac.absorbed, 'C4·招抚守恒回编户/军户 (+' + _pac.absorbed + ')');

console.log('\n[verify-class-chain-integration] ' + (failed ? 'FAIL' : 'PASS') + ' — ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
