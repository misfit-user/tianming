// smoke-heaven-signs-celestial.js — 天象只留天上的，照天时出，不随民心（同志 11-09 定）
//
// 病根：tm-authority-complete 的随机天象表里有地震、大水、大旱、蝗灾，抽中只扣全国民心与皇威，
// 没地点、没伤亡、不进灾害系统（假事件）；而且民心越低凶兆越多（玄幻因果）；tm-prophecy 的天人感应
// 还会在民心暴跌、大灾时再强出一个凶兆。
// 改：表里只留日食、月食、彗星，扣分调小；每月出天象的机会是定值；天人感应只起谶纬（人传的），
// 概率与原先谶纬那一半相同。实灾走环境引擎灾变表与推演报的灾（GM.activeDisasters）。
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
let failed = 0;
function check(cond, msg) {
  if (cond) console.log('  PASS ' + msg);
  else { failed++; console.log('  FAIL ' + msg); }
}

const calls = { minxin: [], huangwei: [], eb: [] };
const sandbox = {
  console,
  setTimeout: (fn) => { if (typeof fn === 'function') fn(); return 1; },
  clearTimeout() {},
  addEB: (kind, text) => calls.eb.push(kind + '：' + text),
};
sandbox.window = sandbox;
sandbox.global = sandbox;
sandbox.globalThis = sandbox;
sandbox.TM = { errors: { capture() {}, captureSilent() {} } };
sandbox.AuthorityEngines = {
  adjustMinxin: (src, d, why) => calls.minxin.push({ src, d, why }),
  adjustHuangwei: (src, d, why) => calls.huangwei.push({ src, d, why }),
};
vm.createContext(sandbox);
for (const rel of ['tm-authority-complete.js', 'tm-prophecy.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), sandbox, { filename: rel });
}
// 掷骰改成按序取的定数（只改沙箱自己的 Math）
let rolls = [];
sandbox.__roll = () => (rolls.length ? rolls.shift() : 0.999);
vm.runInContext('Math.random = function () { return __roll(); };', sandbox);
const AC = sandbox.AuthorityComplete;
const PD = sandbox.PhaseD;

console.log('一、天象表里只留天上的');
const ids = AC.HEAVEN_SIGNS.map((s) => s.id).sort();
check(JSON.stringify(ids) === JSON.stringify(['comet', 'lunar_eclipse', 'solar_eclipse']), '只有日食、月食、彗星：' + AC.HEAVEN_SIGNS.map((s) => s.name).join('、'));
check(!AC.HEAVEN_SIGNS.some((s) => /震|水|旱|蝗/.test(s.name)), '地震、大水、大旱、蝗灾不在天象表里（实灾归灾害系统）');
check(AC.HEAVEN_SIGNS.every((s) => Math.abs(s.minxinDelta) <= 2 && Math.abs(s.hwDelta) <= 2), '每样扣民心、皇威都不过 2');

console.log('二、出不出天象不看民心');
const tickable = typeof AC.tickHeavenSigns === 'function';
check(tickable, '天象可以单跑');
// 一回合内的掷法：第一掷定出不出凶兆，出了第二掷挑哪一样，最后一掷定祥瑞（0.999 = 不出）
function omensAt(minxin, roll, monthRatio) {
  sandbox.GM = { turn: 7, minxin: { trueIndex: minxin }, heavenSigns: [] };
  rolls = [roll, 0.5, 0.999];
  if (tickable) AC.tickHeavenSigns({}, monthRatio || 1);
  return sandbox.GM.heavenSigns.filter((s) => s.type === 'bad');
}
check(omensAt(20, 0.005).length === 1 && omensAt(80, 0.005).length === 1, '同一掷 0.005：民心 20 与 80 都出天象');
check(omensAt(20, 0.02).length === 0 && omensAt(80, 0.02).length === 0, '同一掷 0.02：民心 20 与 80 都不出（旧算式民心 20 时出）');
check(omensAt(50, 0.015, 2).length === 1 && omensAt(50, 0.025, 2).length === 0, '一回合两个月：机会按月数加倍（每月百分之一）');
calls.minxin.length = 0;
calls.huangwei.length = 0;
const got = omensAt(30, 0.001);
check(got.length === 1 && calls.minxin.length === 1 && calls.huangwei.length === 1 && calls.huangwei[0].d < 0 && calls.huangwei[0].d >= -2,
  '出了就记一笔天象、扣一点皇威（' + (got[0] ? got[0].name : '无') + '）');

console.log('三、乱世只起谶纬，不强出天象');
const ganying = PD && typeof PD.tianrenGanying === 'function';
check(ganying, '天人感应可以单跑');
function troubled(roll) {
  calls.eb.length = 0;
  // 民心 20（+0.3）、一回合跌了 20（+0.2）、大灾（+0.3）：强度 0.8，起谶纬的机会 0.8 × 0.5 = 0.4
  sandbox.GM = { turn: 9, minxin: { trueIndex: 20 }, heavenSigns: [], _priorMxForGanying: 40, vars: { disasterLevel: 0.9 } };
  rolls = [roll, 0, 0, 0, 0, 0];
  if (ganying) PD.tianrenGanying({ turn: 9 }, 1);
  return { signs: sandbox.GM.heavenSigns.length, prophecy: calls.eb.some((e) => e.indexOf('谶纬：') === 0) };
}
const hit = troubled(0.35);
check(hit.signs === 0 && hit.prophecy, '掷 0.35：起一条谶纬，不出天象');
const miss = troubled(0.45);
check(miss.signs === 0 && !miss.prophecy, '掷 0.45：谶纬也不起（只剩原先谶纬那一半的机会）');

if (failed) {
  console.log('FAIL smoke-heaven-signs-celestial: ' + failed + ' 处失败');
  process.exit(1);
}
console.log('PASS smoke-heaven-signs-celestial');
