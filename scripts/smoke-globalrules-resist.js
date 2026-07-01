/*
 * smoke-globalrules-resist.js — B3a：阻力→既得阶层满意度承压（走 gateSatisfaction 总闸）
 * node scripts/smoke-globalrules-resist.js
 */
global.window = global;

// mock TM.ClassEngine.gateSatisfaction（含 ±14/回合总闸·仿 tm-class-engine）
global.TM = {
  ClassEngine: {
    gateSatisfaction: function (root, cls, raw, info) {
      var turn = info && info.turn;
      if (!cls._satBudget || cls._satBudget.turn !== turn) cls._satBudget = { turn: turn, used: 0 };
      var room = Math.max(0, 14 - cls._satBudget.used);
      var approved = Math.max(-room, Math.min(room, raw));
      var before = (typeof cls.satisfaction === 'number') ? cls.satisfaction : 50;
      var after = Math.max(0, Math.min(100, before + approved));
      approved = Math.round((after - before) * 100) / 100;
      cls.satisfaction = after; cls._satBudget.used += Math.abs(approved);
      return { approved: approved, before: before, after: after };
    }
  }
};
var GR = require('../tm-globalrules.js');

var pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log('  ✗ FAIL: ' + m); } }
function setup() {
  global.GM = { turn: 5, _chronicle: [],
    classes: [{ name: '士绅', satisfaction: 60 }, { name: '农户', satisfaction: 55 }, { name: '商贾', satisfaction: 50 }] };
}

// 1·active 阻力 from 士绅/旧学官 → 士绅满意度降（走总闸），农户不动
setup();
GR.register({ name: '实学之制', tendencies: [{ key: 'reform_success', label: '改革', mag: 'moderate' }],
  resistance: { from: ['士绅', '旧学官'], intensity: 'active' } });
GM.turn = 6; GR.tick();
var shenshen = GM.classes[0], nonghu = GM.classes[1];
ok(shenshen.satisfaction < 60, '士绅满意度被阻力压低 (now ' + shenshen.satisfaction + ')');
ok(nonghu.satisfaction === 55, '无关阶层（农户）不受影响');
ok(Array.isArray(shenshen._satLedger ? shenshen._satLedger : shenshen._satBudget ? [1] : null), '承压走了 gateSatisfaction（_satBudget 记账）');
ok(shenshen._satBudget && shenshen._satBudget.used > 0, '走总闸预算（非绕闸直写）');

// 2·成风（entrenched）之制不再施压（新序已立·士绅认了）
setup();
GR.register({ name: '通商之制', tendencies: [{ key: 'commerce', label: '通商', mag: 'minor' }], strength: 75,
  resistance: { from: ['海禁旧党', '士绅'], intensity: 'fierce' } });
var s0 = GM.classes[0].satisfaction;
GM.turn = 6; GR.tick();
ok(GM.classes[0].satisfaction === s0, 'entrenched 之制不再压既得阶层');

// 3·被罢（suppressed）之制不施压
setup();
GR.register({ name: 'K', tendencies: [{ key: 'a', mag: 'minor' }], resistance: { from: ['士绅'], intensity: 'active' } });
var rk = GR.find('K');
for (var i = 0; i < 7; i++) { GM.turn = 6 + i; GR.tick(); } // 衰减至 suppressed
var sBefore = GM.classes[0].satisfaction;
GM.turn = 20; GR.tick();
ok(rk.status === 'suppressed', '规则已 suppressed');
ok(GM.classes[0].satisfaction === sBefore, 'suppressed 之制不再压');

// 4·无 TM.ClassEngine（缺总闸）→ 不施压不报错（守纪律·不绕闸）
var savedTM = global.TM; global.TM = {};
setup();
GR.register({ name: 'N', tendencies: [{ key: 'a', mag: 'minor' }], resistance: { from: ['士绅'], intensity: 'active' } });
var sN = GM.classes[0].satisfaction;
GM.turn = 6;
var threw = false; try { GR.tick(); } catch (e) { threw = true; }
ok(!threw, '无总闸 tick 不报错');
ok(GM.classes[0].satisfaction === sN, '无总闸不绕闸直写满意度');
global.TM = savedTM;

// 5·无 resistance 之制不施压
setup();
GR.register({ name: 'Q', tendencies: [{ key: 'a', mag: 'minor' }] });
GM.turn = 6; GR.tick();
ok(GM.classes[0].satisfaction === 60 && GM.classes[1].satisfaction === 55, '无阻力之制不压任何阶层');

console.log('\nsmoke-globalrules-resist: PASS ' + pass + '/' + (pass + fail));
if (fail > 0) process.exit(1);
