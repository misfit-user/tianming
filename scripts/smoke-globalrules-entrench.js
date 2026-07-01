/*
 * smoke-globalrules-entrench.js — B5：成风之赏·皇威巩固（走 adjustHuangwei structuralReform·一次性·不可刷）
 * node scripts/smoke-globalrules-entrench.js
 */
global.window = global;
function mockAE() {
  return {
    calls: [], hw: { index: 60 },
    adjustHuangwei: function (s, d) { this.calls.push({ source: s, delta: d }); this.hw.index = Math.max(0, Math.min(100, this.hw.index + d)); return { ok: true }; }
  };
}
var GR = require('../tm-globalrules.js');

var pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log('  ✗ FAIL: ' + m); } }
function setup() { global.GM = { turn: 5, _chronicle: [] }; global.AuthorityEngines = mockAE(); }

// 1·之制扎根至 entrenched → 一次性抬皇威（structuralReform 正向）
setup();
GR.register({ name: '变法之制', tendencies: [{ key: 'a', mag: 'minor' }], strength: 66 }); // established
var r = GR.find('变法之制');
GM.turn = 6; GR.tick();   // 66+3=69 established
ok(AuthorityEngines.calls.length === 0, '未成风前不赏皇威');
GM.turn = 7; GR.tick();   // 69+3=72 entrenched
ok(AuthorityEngines.calls.length === 1, '成风一次性抬皇威');
ok(AuthorityEngines.calls[0].source === 'structuralReform', '走 structuralReform 改制有成源');
ok(AuthorityEngines.calls[0].delta > 0, '皇威 delta 为正（赏）');
ok(r._entrenchRewarded === true, '成风赏标记置位');

// 2·成风后续回合不再赏（不可刷）
GM.turn = 8; GR.tick();
GM.turn = 9; GR.tick();
ok(AuthorityEngines.calls.length === 1, '成风之赏仅一次（不可刷皇威）');

// 3·无 AuthorityEngines → 不报错
setup(); delete global.AuthorityEngines;
GR.register({ name: 'X', tendencies: [{ key: 'a', mag: 'minor' }], strength: 68 });
var threw = false;
try { GM.turn = 6; GR.tick(); GM.turn = 7; GR.tick(); } catch (e) { threw = true; }
ok(!threw, '缺权制引擎成风不报错');

console.log('\nsmoke-globalrules-entrench: PASS ' + pass + '/' + (pass + fail));
if (fail > 0) process.exit(1);
