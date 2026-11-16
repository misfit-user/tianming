/* smoke-renli-fugitive-authority.js — A2a 激活·逃亡单一权威（node 直跑·真 swap-test）
 * 验：①Renli helper（已种子键集含 id+name / 已种子丁占比）②huji 运行期 swap-test：
 *   陕西种子→huji deep-field 跳过陕西逃亡 + corvée 全国逃亡按未种子丁占比缩减；
 *   江南（不种子）两轮逃亡相同=未种子地域零影响（inert）；无种子轮=huji 原样（去重不误伤）。
 * 跑：node scripts/smoke-renli-fugitive-authority.js
 */
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var ROOT = path.resolve(__dirname, '..');
var pass = 0, fail = 0, fails = [];
function ok(c, m) { if (c) pass++; else { fail++; fails.push(m); console.error('  ✗ ' + m); } }
function eq(a, b, m) { ok(a === b, m + ' (得 ' + JSON.stringify(a) + '·期 ' + JSON.stringify(b) + ')'); }

// ── ① Renli helper 单测（require·直接验去重所依据的数学）──
(function () {
  global.P = { adminHierarchy: { player: { divisions: [
    { id: '陕西', name: '陕西', renliSeed: { soilBase: 70 }, populationDetail: { ding: 600000, mouths: 3000000 } },
    { id: '江南', name: '江南', populationDetail: { ding: 400000, mouths: 4000000 } } // 不种子
  ] } } };
  var R = require('../tm-renli.js');
  var set = R.seededRegionKeySet(global.P);
  ok(set['陕西'] === true, '①已种子键集含「陕西」(name)');
  ok(set['江南'] !== true, '①不种子「江南」不在键集');
  var share = R.seededDingShare(global.P);
  ok(Math.abs(share - 0.6) < 1e-9, '①已种子丁占比 = 陕西600k/(600k+400k) = 0.6 (得 ' + share + ')');
  // 无种子→空集/0（inert 基础）
  global.P.adminHierarchy.player.divisions[0].renliSeed = null;
  ok(Object.keys(R.seededRegionKeySet(global.P)).length === 0, '①无种子→键集空（huji 不让出·inert）');
  eq(R.seededDingShare(global.P), 0, '①无种子→占比 0');
})();

// ── ② huji 运行期 swap-test（vm sandbox·跑真 HujiEngine.tick）──
function makeSandbox() {
  var sb = {
    console: console, Math: Math, Date: Date, JSON: JSON, RegExp: RegExp, Error: Error,
    Array: Array, Object: Object, String: String, Number: Number, Boolean: Boolean, isFinite: isFinite, isNaN: isNaN, parseInt: parseInt, parseFloat: parseFloat,
    setTimeout: function (fn) { return 1; }, clearTimeout: function () {}, addEB: function () {}, toast: function () {}
  };
  sb.window = sb; sb.global = sb; sb.globalThis = sb;
  sb.TM = { errors: { capture: function () {}, captureSilent: function () {} } };
  sb.IntegrationBridge = { getLeafDivisions: function (ah) {
    var out = []; function walk(ns){ (Array.isArray(ns) ? ns : []).forEach(function(n){ if (!n) return; var k = n.children || n.divisions || []; if (k.length) walk(k); else out.push(n); }); }
    walk(ah && ah.player && ah.player.divisions); return out;
  } };
  vm.createContext(sb);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-renli.js'), 'utf8'), sb, { filename: 'tm-renli.js' });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-huji-engine.js'), 'utf8'), sb, { filename: 'tm-huji-engine.js' });
  return sb;
}
function diverseRegion(mouths, ding) {
  return { mouths: mouths, ding: ding, households: Math.round(mouths / 5),
    byEthnicity: { a: 0.5, b: 0.5 }, byFaith: { x: 0.5, y: 0.5 }, // maxShare 0.5 → pressure 0.75 > 0.35
    baojiaUnits: 0, fugitives: 0, hiddenCount: 0 };
}
function runHuji(seeded) {
  var sb = makeSandbox();
  sb.P = { adminHierarchy: { player: { divisions: [
    { id: '陕西', name: '陕西', renliSeed: seeded ? { soilBase: 70 } : null, populationDetail: { ding: 600000, mouths: 3000000, fugitives: 0, hiddenCount: 0 } },
    { id: '江南', name: '江南', populationDetail: { ding: 400000, mouths: 4000000, fugitives: 0, hiddenCount: 0 } }
  ] } } };
  var bigDays = 1000000 * 365 * 0.4; // 令役负 burden ≈ 0.8 > 阈值 0.4
  sb.GM = {
    sid: 't', turn: 5, minxin: 30, huangquan: 40, guoku: { money: 0 }, chars: [], activeWars: [],
    population: {
      national: { ding: 1000000, mouths: 7000000, households: 1400000 },
      byRegion: { '陕西': diverseRegion(3000000, 600000), '江南': diverseRegion(4000000, 400000) },
      byCategory: {}, byLegalStatus: { taoohu: { households: 0, mouths: 0, ding: 0 } },
      corvee: { enabled: true, fullyCommuted: false, burdenThreshold: 0.4, annualCorveeDays: 30, commutationRate: 0.5, exemptions: [],
        byType: { junyi: { totalDays: bigDays, fulfilled: 0, deaths: 0 }, gongyi: { totalDays: bigDays, fulfilled: 0, deaths: 0 } } },
      deepFieldEffects: { serviceAgeDing: 1000000 }, meta: { registrationAccuracy: 0.85 }
    }
  };
  sb.P.GM = sb.GM;
  try { sb.HujiEngine.tick({ monthRatio: 1 }); } catch (e) { console.error('tick err', e && e.message); }
  return { nationalFug: sb.GM.population.fugitives || 0,
    shaanxiFug: sb.GM.population.byRegion['陕西'].fugitives || 0,
    jiangnanFug: sb.GM.population.byRegion['江南'].fugitives || 0 };
}

var A = runHuji(false); // 基线·无种子（huji 原样·去重 inert）
var B = runHuji(true);  // 陕西种子（huji 让出陕西份额）
console.log('  [swap] 无种子 A=' + JSON.stringify(A) + '  陕西种子 B=' + JSON.stringify(B));

ok(A.nationalFug > 0, '②基线无种子·huji 产全国逃亡 > 0（路径确触发）');
ok(B.nationalFug < A.nationalFug, '②★陕西种子→全国逃亡少于基线（huji 让出陕西份额·去重生效）');
ok(A.shaanxiFug > 0, '②基线·陕西 deep-field 逃亡 > 0');
eq(B.shaanxiFug, 0, '②★陕西种子→陕西 deep-field 逃亡=0（huji 跳过·归 Renli）');
ok(A.jiangnanFug > 0 && B.jiangnanFug > 0, '②江南(不种子)两轮均产逃亡');
eq(B.jiangnanFug, A.jiangnanFug, '②★江南两轮逃亡相同=未种子地域零影响（inert·去重不误伤）');

// ── ③ 源契约：huji 两处产出已 gated ──

console.log('\n[smoke-renli-fugitive-authority] ' + pass + ' 通过 / ' + fail + ' 失败');
if (fail) { console.error('失败项：\n - ' + fails.join('\n - ')); process.exit(1); }
process.exit(0);
