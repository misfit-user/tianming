#!/usr/bin/env node
// scripts/smoke-ceming.js — 策名系统 smoke 测试
//
// 验证：
//   §1 canSummon 闸门 3 模式 × 5 边界人物
//   §2 历史检查豁免名单生成器
//   §3 黑名单读写
//
// 用法：node scripts/smoke-ceming.js
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

// ─── 准备最小执行环境 ───
const sandbox = {
  console: console,
  window: {},
  global: {},
  setTimeout: setTimeout,
  setInterval: setInterval,
  clearInterval: clearInterval,
  clearTimeout: clearTimeout,
  // 模拟 localStorage (内存版)
  localStorage: (function(){
    var store = {};
    return {
      getItem: function(k){ return store[k] !== undefined ? store[k] : null; },
      setItem: function(k, v){ store[k] = String(v); },
      removeItem: function(k){ delete store[k]; },
      clear: function(){ store = {}; }
    };
  })()
};
sandbox.window = sandbox;
sandbox.global = sandbox;

// 模拟 P/GM 全局
sandbox.P = {
  conf: { gameMode: 'yanyi' },
  ai: null,
  time: { year: 1628 }
};
sandbox.GM = {
  year: 1628,
  turn: 1,
  chars: []
};

// 加载档案库 + 12 个拆分 wave + ceming
const historicalFiles = ['tm-char-historical-profiles.js'].concat(
  fs.readdirSync(ROOT)
    .filter(function(f){ return /^tm-char-historical-wave-\d+\.js$/.test(f); })
    .sort()
).concat(['tm-ceming.js']);

vm.createContext(sandbox);
historicalFiles.forEach(function(f){
  const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
  vm.runInContext(src, sandbox, { filename: f });
});

// ─── 测试 ───
let pass = 0, fail = 0;
function expect(label, actual, expected) {
  const ok = (actual === expected) ||
             (typeof actual === 'object' && actual && actual.ok === expected);
  if (ok) { console.log('  ✓ ' + label); pass++; }
  else { console.log('  ✗ ' + label + '  期望:' + expected + ' 实际:' + (actual && actual.reason ? actual.reason : actual)); fail++; }
}

console.log('\n[smoke-ceming] §1 canSummon 闸门测试');

const TM = sandbox.TM;
const profiles = sandbox.HISTORICAL_CHAR_PROFILES;

// 演义模式：所有人都可召
console.log('\n  演义模式（yanyi · 1628 年崇祯朝）：');
sandbox.P.conf.gameMode = 'yanyi';
expect('诸葛亮(181-234·已死1394年)·演义可召', TM.ceming.canSummon(profiles.zhugeLiang), true);
expect('王守仁(1472-1529·近百年前)·演义可召', TM.ceming.canSummon(profiles.wangshouren), true);
expect('林则徐(1785-1850·尚未出世)·演义可召', TM.ceming.canSummon(profiles.linZexu), true);
expect('和珅(1750-1799·尚未出世)·演义可召', TM.ceming.canSummon(profiles.heshen), true);
expect('姜尚(-1156)·演义可召', TM.ceming.canSummon(profiles.jiangShang), true);

// 严格史实模式
console.log('\n  严格史实（strict_hist · 1628 年）：');
sandbox.P.conf.gameMode = 'strict_hist';
expect('诸葛亮(已死1394年前)·严格不可召', TM.ceming.canSummon(profiles.zhugeLiang), false);
expect('王守仁(死于1529·近百年前)·严格不可召', TM.ceming.canSummon(profiles.wangshouren), false);
expect('林则徐(生于1785·尚未出世)·严格不可召', TM.ceming.canSummon(profiles.linZexu), false);
expect('和珅(生于1750·尚未出世)·严格不可召', TM.ceming.canSummon(profiles.heshen), false);
expect('魏忠贤(1568-1627·1628 年刚死·临界)·严格不可召', TM.ceming.canSummon(profiles.weizhongxian), false);

// 轻度史实模式（默认容差 50 年）
console.log('\n  轻度史实（light_hist · 1628 年·容差 50 年）：');
sandbox.P.conf.gameMode = 'light_hist';
expect('王守仁(死于1529·距今99年·超容差)·轻度不可召', TM.ceming.canSummon(profiles.wangshouren), false);
expect('魏忠贤(死于1627·1年前·容差内)·轻度可召', TM.ceming.canSummon(profiles.weizhongxian), true);
expect('戚继光(死于1588·40年前·容差内)·轻度可召', TM.ceming.canSummon(profiles.qijiguang), true);
expect('林则徐(生于1785·157年后·超容差)·轻度不可召', TM.ceming.canSummon(profiles.linZexu), false);
expect('诸葛亮(死于234·1394年前)·轻度不可召', TM.ceming.canSummon(profiles.zhugeLiang), false);

// §2 豁免名单生成
console.log('\n[smoke-ceming] §2 历史检查豁免名单');
sandbox.GM.chars = [
  { name: '诸葛亮', alive: true, cemingByPlayer: true, cemingTurn: 5, dynasty: '蜀汉', era: '建兴' },
  { name: '岳飞', alive: true, cemingByPlayer: true, cemingTurn: 8, dynasty: '南宋', era: '绍兴' },
  { name: '崇祯帝', alive: true, cemingByPlayer: false, cemingTurn: 0 }, // 非策名·应被忽略
  { name: '王莽', alive: false, cemingByPlayer: true, cemingTurn: 3 }     // 已死·应被忽略
];
const exempt = TM.ceming.buildHistCheckExemption();
expect('豁免段含 诸葛亮', exempt.indexOf('诸葛亮') >= 0, true);
expect('豁免段含 岳飞', exempt.indexOf('岳飞') >= 0, true);
expect('豁免段不含 非策名·崇祯帝', exempt.indexOf('崇祯帝') < 0, true);
expect('豁免段不含 已死·王莽', exempt.indexOf('王莽') < 0, true);

const emptyExempt = (function(){
  sandbox.GM.chars = [];
  return TM.ceming.buildHistCheckExemption();
})();
expect('无策名时返回空串', emptyExempt === '', true);

// §3 黑名单
console.log('\n[smoke-ceming] §3 黑名单读写');
TM.ceming.addToBlacklist('赵无极');
expect('赵无极 入黑名单后查得', TM.ceming.isBlacklisted('赵无极'), true);
expect('未入名单的查不得', TM.ceming.isBlacklisted('张三丰'), false);
TM.ceming.removeFromBlacklist('赵无极');
expect('赵无极 移除后查不得', TM.ceming.isBlacklisted('赵无极'), false);

// 总结
console.log('\n──────────────────────────────────────');
console.log('[smoke-ceming] ' + pass + ' 通过 · ' + fail + ' 失败');
process.exit(fail > 0 ? 1 : 0);
