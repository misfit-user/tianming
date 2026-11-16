/* smoke-renli-corvee-sat-dedup.js — A2b 激活·役负满意度去重（node 直跑·真 swap-test）
 * 验：huji applyCorveeHardEffect 的 农户 役负满意度扣减，对已种子地域按未种子丁占比让出（归 Renli·避双扣）；
 *   无种子轮=原样（inert·不误伤）；江南(不种子)份额始终由 huji 承担。
 * 跑：node scripts/smoke-renli-corvee-sat-dedup.js
 */
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var ROOT = path.resolve(__dirname, '..');
var pass = 0, fail = 0, fails = [];
function ok(c, m) { if (c) pass++; else { fail++; fails.push(m); console.error('  ✗ ' + m); } }

function makeSandbox() {
  var sb = {
    console: console, Math: Math, Date: Date, JSON: JSON, RegExp: RegExp, Error: Error,
    Array: Array, Object: Object, String: String, Number: Number, Boolean: Boolean, isFinite: isFinite, isNaN: isNaN, parseInt: parseInt, parseFloat: parseFloat,
    setTimeout: function () { return 1; }, clearTimeout: function () {}, addEB: function () {}, toast: function () {}
  };
  sb.window = sb; sb.global = sb; sb.globalThis = sb;
  sb.TM = { errors: { capture: function () {}, captureSilent: function () {} } };
  sb.IntegrationBridge = { getLeafDivisions: function (ah) {
    var out = []; function walk(ns){ (Array.isArray(ns) ? ns : []).forEach(function(n){ if (!n) return; var k = n.children || n.divisions || []; if (k.length) walk(k); else out.push(n); }); }
    walk(ah && ah.player && ah.player.divisions); return out;
  } };
  vm.createContext(sb);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-renli.js'), 'utf8'), sb, { filename: 'tm-renli.js' });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-huji-runtime-bridge.js'), 'utf8'), sb, { filename: 'tm-huji-runtime-bridge.js' });
  return sb;
}
function runHard(seeded) {
  var sb = makeSandbox();
  sb.P = { adminHierarchy: { player: { divisions: [
    { id: '陕西', name: '陕西', renliSeed: seeded ? { soilBase: 70 } : null, populationDetail: { ding: 600000, mouths: 3000000 } },
    { id: '江南', name: '江南', populationDetail: { ding: 400000, mouths: 4000000 } }
  ] } } };
  var root = { turn: 5, minxin: { trueIndex: 50 }, corvee: {}, military: {}, _hujiRuntimeBridge: {} };
  sb.GM = root; sb.P.GM = root;
  var HRB = sb.HujiRuntimeBridge || (sb.TM && sb.TM.HujiRuntimeBridge);
  if (!HRB || typeof HRB.applyHardEffects !== 'function') return { err: 'HujiRuntimeBridge.applyHardEffects 不可用' };
  var eff;
  try {
    eff = HRB.applyHardEffects(root, { hukou: {}, military: {}, corvee: { summary: { totalDemandDays: 1000, gapDays: 500, burden: 16 }, rows: [] } }, { turn: 5 });
  } catch (e) { return { err: e && e.message }; }
  return { minxinDelta: eff && eff.corvee ? Number(eff.corvee.minxinDelta) : null, share: seeded ? 0.6 : 0 };
}

var A = runHard(false); // 无种子（huji 原样）
var B = runHard(true);  // 陕西种子（huji 让出陕西份额=丁占比 0.6）
console.log('  [swap] 无种子 A=' + JSON.stringify(A) + '  陕西种子 B=' + JSON.stringify(B));

ok(!A.err, '②applyHardEffects 可跑（无种子轮）' + (A.err ? '·err=' + A.err : ''));
ok(!B.err, '②applyHardEffects 可跑（种子轮）' + (B.err ? '·err=' + B.err : ''));
if (!A.err && !B.err) {
  ok(A.minxinDelta < 0, '②基线·农户役负满意度扣减 < 0（路径确触发·得 ' + A.minxinDelta + '）');
  ok(B.minxinDelta < 0, '②种子轮仍有扣减（陕西份额归 Renli·余未种子份额·得 ' + B.minxinDelta + '）');
  ok(Math.abs(B.minxinDelta) < Math.abs(A.minxinDelta), '②★种子轮扣减小于基线（huji 让出役负满意度·去重生效）');
  // 0.6 种子 → 应≈ A×0.4（容 round2 误差）
  ok(Math.abs(Math.abs(B.minxinDelta) - Math.abs(A.minxinDelta) * 0.4) < 0.2, '②★缩减幅度≈未种子丁占比 0.4（A ' + A.minxinDelta + ' → B ' + B.minxinDelta + '）');
}

// ── helper 复核：无种子→share 0（inert）──
var Rr = require('../tm-renli.js');
global.P = { adminHierarchy: { player: { divisions: [ { id: '陕西', name: '陕西', populationDetail: { ding: 600000 } } ] } } };
ok(Rr.seededDingShare(global.P) === 0, '①无种子→seededDingShare 0（huji minxinDelta 不缩减·inert）');

// ── 源契约 ──

console.log('\n[smoke-renli-corvee-sat-dedup] ' + pass + ' 通过 / ' + fail + ' 失败');
if (fail) { console.error('失败项：\n - ' + fails.join('\n - ')); process.exit(1); }
process.exit(0);
